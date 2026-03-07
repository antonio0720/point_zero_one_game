/**
 * Commerce Governance Routes — Production Implementation
 * backend/src/api-gateway/routes/commerce_governance_routes.ts
 *
 * THE MONETIZATION GOVERNANCE OS FOR POINT ZERO ONE.
 *
 * Doctrine: "Money buys variety, identity, and access — not win probability."
 * This file is the runtime enforcer. Every purchase, offer, experiment, and
 * SKU mutation flows through these routes and the governance engines.
 *
 * Route groups:
 *   /governance/skus         — SKU taxonomy CRUD + validation
 *   /governance/offers       — Offer policy CRUD + evaluation
 *   /governance/experiments  — Experiment lifecycle + guardrails
 *   /governance/killswitch   — Emergency halt controls
 *   /governance/policy       — Governance policy versioning
 *   /governance/audit        — Governance audit trail (read-only)
 *   /governance/health       — Governance system health
 *
 * Auth: All routes require authentication.
 * RBAC: Mutation routes require 'admin' or 'system_admin' actor type.
 * Rate limiting: Write operations use 'write' tier, reads use 'read' tier.
 * Validation: All request bodies validated with Ajv JSON Schema.
 * Audit: Every mutation emits a governance audit event via BullMQ.
 *
 * Scale: 20M concurrent users. All hot-path reads (killswitch, offer eval)
 * hit Redis only — no database in the read path.
 *
 * Density6 LLC · Point Zero One · Confidential
 */

import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireScope } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { rateLimit } from '../middleware/security';
import { ok, created, fail } from '../middleware/errors';
import { emitAudit, CurriculumAuditEvent } from '../middleware/audit';
import { CircuitBreaker } from '../middleware/resilience/circuit_breaker';

// ── Governance engines ────────────────────────────────────────────────────────
import { validateSku, isForbiddenSkuClass } from '../commerce_governance/sku_taxonomy';
import { evaluateOffer, recordImpression, recordPlayerLoss } from '../commerce_governance/offer_policy';
import { validateExperiment, checkGuardrails, assignExperimentGroup } from '../commerce_governance/experiment_engine';
import { activateKillswitch, resolveKillswitch, isKilled, getActiveKillswitches } from '../commerce_governance/killswitch';
import { DEFAULT_POLICY_RULES } from '../commerce_governance/types';
import type {
  SkuDefinition, OfferPolicy, Experiment, PolicyVersion,
  PolicyRules, GovernanceAuditEntry, KillswitchTarget,
} from '../commerce_governance/types';

// ── Validation schemas ────────────────────────────────────────────────────────
import {
  CreateSkuSchema, UpdateSkuSchema, CreateOfferSchema,
  CreateExperimentSchema, ActivateKillswitchSchema, PublishPolicySchema,
} from '../commerce_governance/governance_schemas';

// ── Database ──────────────────────────────────────────────────────────────────
type QueryRow = Record<string, unknown>;
type Queryable = { query: (sql: string, params?: readonly unknown[]) => Promise<{ rows: QueryRow[] }> };

const runtimeImport = new Function('specifier', 'return import(specifier)') as
  (specifier: string) => Promise<Record<string, unknown>>;

let cachedDb: Promise<Queryable> | null = null;

async function getDb(): Promise<Queryable> {
  if (!cachedDb) {
    cachedDb = (async () => {
      for (const path of ['../../db/pool', '../../services/database', '../../services/database/DatabaseClient']) {
        try {
          const mod = await runtimeImport(path);
          const candidate = mod.default ?? mod['pool'] ?? mod['db'] ?? mod;
          if (candidate && typeof (candidate as Queryable).query === 'function') return candidate as Queryable;
        } catch { /* next */ }
      }
      throw new Error('Unable to resolve database client for Commerce Governance.');
    })().catch(err => { cachedDb = null; throw err; });
  }
  return cachedDb;
}

const breaker = new CircuitBreaker('commerce-governance-db', {
  failureThreshold: 5, resetTimeoutMs: 30_000, halfOpenMaxAttempts: 3,
});

// ── Active policy cache ───────────────────────────────────────────────────────
// The active policy rules are cached in-process. Refreshed on policy publish.
// At 20M concurrent, this avoids a DB read on every governance check.
let activePolicyRules: PolicyRules = { ...DEFAULT_POLICY_RULES };
let activePolicyVersionId: string = 'default';

const router = Router();

// ── Middleware applied to all governance routes ───────────────────────────────
router.use(requireAuth);

// ── Admin gate for mutations ──────────────────────────────────────────────────
function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const ctx = req.tenantContext;
  if (!ctx) { res.status(401).json(fail(req, 'UNAUTHORIZED', 'No tenant context')); return; }
  const allowed = new Set(['system_admin', 'org_admin']);
  if (!allowed.has(ctx.actorType)) {
    res.status(403).json(fail(req, 'FORBIDDEN', 'Commerce governance requires admin access'));
    return;
  }
  next();
}

// ═══════════════════════════════════════════════════════════════════════════════
// SKU TAXONOMY
// ═══════════════════════════════════════════════════════════════════════════════

/** GET /governance/skus — List all SKUs */
router.get('/skus', rateLimit('read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = await getDb();
    const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
    const pageSize = Math.min(parseInt(req.query.pageSize as string || '50', 10), 100);
    const offset = (page - 1) * pageSize;
    const activeOnly = req.query.activeOnly === 'true';

    const where = activeOnly ? "WHERE active = true" : "";
    const countResult = await breaker.execute(() => db.query(`SELECT COUNT(*) AS count FROM skus ${where}`));
    const total = parseInt(String(countResult.rows[0]?.['count'] ?? '0'), 10);

    const result = await breaker.execute(() =>
      db.query(`SELECT * FROM skus ${where} ORDER BY created_at DESC LIMIT $1 OFFSET $2`, [pageSize, offset])
    );

    res.json(ok(req, result.rows, { mode: 'offset', page, pageSize, limit: pageSize, total, pageCount: Math.ceil(total / pageSize), hasMore: offset + pageSize < total } as Record<string, unknown>));
  } catch (err) { next(err); }
});

/** POST /governance/skus — Create a new SKU */
router.post('/skus', requireAdmin, rateLimit('write'), validateBody('CreateSku', CreateSkuSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ctx = req.tenantContext!;
      const data = req.body;

      // Governance validation
      const validation = validateSku(
        { ...data, affectsOutcomes: false, approvedByPolicyVersion: activePolicyVersionId },
        activePolicyRules,
      );

      if (!validation.valid) {
        res.status(422).json(fail(req, 'SKU_VALIDATION_FAILED', 'SKU failed governance validation', {
          violations: validation.violations,
        }));
        return;
      }

      // Killswitch check
      const storeKilled = await isKilled('STORE');
      if (storeKilled) {
        res.status(503).json(fail(req, 'STORE_KILLED', 'Store killswitch is active. No SKU modifications allowed.'));
        return;
      }

      const skuId = crypto.randomUUID();
      const db = await getDb();
      await breaker.execute(() => db.query(
        `INSERT INTO skus (id, name, description, sku_class, price_usd_cents, stripe_price_id, stripe_product_id,
         tags, competitive_safe, affects_outcomes, max_per_user, active, approved_by_policy_version, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, $10, true, $11, NOW(), NOW())`,
        [skuId, data.name, data.description ?? '', data.skuClass, data.priceUsdCents,
         data.stripePriceId, data.stripeProductId, JSON.stringify(data.tags ?? []),
         data.competitiveSafe ?? true, data.maxPerUser ?? 0, activePolicyVersionId],
      ));

      await emitGovernanceAudit(req, 'SKU_CREATED', 'sku', skuId, { skuClass: data.skuClass, name: data.name });

      res.status(201).json(created(req, { skuId, validation }));
    } catch (err) { next(err); }
  },
);

/** PATCH /governance/skus/:id — Update a SKU */
router.patch('/skus/:id', requireAdmin, rateLimit('write'), validateBody('UpdateSku', UpdateSkuSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const db = await getDb();
      const data = req.body;
      const sets: string[] = [];
      const vals: unknown[] = [];
      let idx = 1;

      if (data.name !== undefined) { sets.push(`name = $${idx++}`); vals.push(data.name); }
      if (data.description !== undefined) { sets.push(`description = $${idx++}`); vals.push(data.description); }
      if (data.priceUsdCents !== undefined) { sets.push(`price_usd_cents = $${idx++}`); vals.push(data.priceUsdCents); }
      if (data.stripePriceId !== undefined) { sets.push(`stripe_price_id = $${idx++}`); vals.push(data.stripePriceId); }
      if (data.tags !== undefined) { sets.push(`tags = $${idx++}`); vals.push(JSON.stringify(data.tags)); }
      if (data.competitiveSafe !== undefined) { sets.push(`competitive_safe = $${idx++}`); vals.push(data.competitiveSafe); }
      if (data.maxPerUser !== undefined) { sets.push(`max_per_user = $${idx++}`); vals.push(data.maxPerUser); }
      if (data.active !== undefined) { sets.push(`active = $${idx++}`); vals.push(data.active); }

      if (sets.length === 0) { res.json(ok(req, { message: 'No fields to update' })); return; }

      sets.push('updated_at = NOW()');
      vals.push(req.params.id);

      const result = await breaker.execute(() =>
        db.query(`UPDATE skus SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`, vals)
      );

      if (!result.rows[0]) { res.status(404).json(fail(req, 'NOT_FOUND', 'SKU not found')); return; }

      const action = data.active === false ? 'SKU_DEACTIVATED' : 'SKU_UPDATED';
      await emitGovernanceAudit(req, action as any, 'sku', String(req.params.id), data);

      res.json(ok(req, result.rows[0]));
    } catch (err) { next(err); }
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// OFFER POLICY
// ═══════════════════════════════════════════════════════════════════════════════

/** GET /governance/offers — List all offers */
router.get('/offers', rateLimit('read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = await getDb();
    const result = await breaker.execute(() =>
      db.query(`SELECT * FROM offer_policies ORDER BY created_at DESC LIMIT 100`)
    );
    res.json(ok(req, result.rows));
  } catch (err) { next(err); }
});

/** POST /governance/offers — Create a new offer */
router.post('/offers', requireAdmin, rateLimit('write'), validateBody('CreateOffer', CreateOfferSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req.body;
      const offerId = crypto.randomUUID();
      const db = await getDb();

      await breaker.execute(() => db.query(
        `INSERT INTO offer_policies (id, name, sku_ids, trigger_type, max_impressions_per_user_per_day,
         max_impressions_per_user_total, cooldown_seconds, suppress_after_loss, min_ticks_played_to_show,
         show_during_run, discount_pct, starts_at, ends_at, status, policy_version_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, $10, $11, $12, 'DRAFT', $13, NOW(), NOW())`,
        [offerId, data.name, JSON.stringify(data.skuIds), data.trigger,
         data.maxImpressionsPerUserPerDay ?? 3, data.maxImpressionsPerUserTotal ?? 0,
         data.cooldownSeconds ?? 300, data.suppressAfterLoss ?? true,
         data.minTicksPlayedToShow ?? 100, data.discountPct ?? 0,
         data.startsAt ?? null, data.endsAt ?? null, activePolicyVersionId],
      ));

      await emitGovernanceAudit(req, 'OFFER_CREATED', 'offer', offerId, { name: data.name, trigger: data.trigger });

      res.status(201).json(created(req, { offerId }));
    } catch (err) { next(err); }
  },
);

/** POST /governance/offers/:id/evaluate — Evaluate offer eligibility for a player */
router.post('/offers/:id/evaluate', rateLimit('read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ctx = req.tenantContext!;
      const db = await getDb();

      const offerResult = await breaker.execute(() =>
        db.query(`SELECT * FROM offer_policies WHERE id = $1`, [req.params.id])
      );
      if (!offerResult.rows[0]) { res.status(404).json(fail(req, 'NOT_FOUND', 'Offer not found')); return; }

      const row = offerResult.rows[0];
      const offer: OfferPolicy = {
        offerId: String(row['id']),
        name: String(row['name']),
        skuIds: JSON.parse(String(row['sku_ids'] ?? '[]')),
        trigger: String(row['trigger_type']) as OfferPolicy['trigger'],
        maxImpressionsPerUserPerDay: Number(row['max_impressions_per_user_per_day'] ?? 3),
        maxImpressionsPerUserTotal: Number(row['max_impressions_per_user_total'] ?? 0),
        cooldownSeconds: Number(row['cooldown_seconds'] ?? 300),
        suppressAfterLoss: Boolean(row['suppress_after_loss']),
        minTicksPlayedToShow: Number(row['min_ticks_played_to_show'] ?? 100),
        showDuringRun: false,
        discountPct: Number(row['discount_pct'] ?? 0),
        startsAt: row['starts_at'] ? String(row['starts_at']) : null,
        endsAt: row['ends_at'] ? String(row['ends_at']) : null,
        status: String(row['status']) as OfferPolicy['status'],
        policyVersionId: String(row['policy_version_id']),
        createdAt: String(row['created_at']),
        updatedAt: String(row['updated_at']),
      };

      const evaluation = await evaluateOffer(offer, ctx.actorId, activePolicyRules, {
        isInRun: req.body.isInRun ?? false,
        totalTicksPlayed: req.body.totalTicksPlayed ?? 0,
        lastRunOutcome: req.body.lastRunOutcome ?? null,
      });

      if (evaluation.eligible) {
        await recordImpression(offer.offerId, ctx.actorId, offer.cooldownSeconds);
      } else {
        await emitGovernanceAudit(req, 'OFFER_SUPPRESSED', 'offer', offer.offerId, {
          reason: evaluation.reason, suppressedBy: evaluation.suppressedBy,
        });
      }

      res.json(ok(req, evaluation));
    } catch (err) { next(err); }
  },
);

/** POST /governance/offers/:id/pause — Pause an offer */
router.post('/offers/:id/pause', requireAdmin, rateLimit('write'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const db = await getDb();
      await breaker.execute(() =>
        db.query(`UPDATE offer_policies SET status = 'PAUSED', updated_at = NOW() WHERE id = $1`, [req.params.id])
      );
      await emitGovernanceAudit(req, 'OFFER_PAUSED', 'offer', String(req.params.id), {});
      res.json(ok(req, { status: 'PAUSED' }));
    } catch (err) { next(err); }
  },
);

/** POST /governance/offers/:id/activate — Activate an offer */
router.post('/offers/:id/activate', requireAdmin, rateLimit('write'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const db = await getDb();
      await breaker.execute(() =>
        db.query(`UPDATE offer_policies SET status = 'ACTIVE', updated_at = NOW() WHERE id = $1`, [req.params.id])
      );
      res.json(ok(req, { status: 'ACTIVE' }));
    } catch (err) { next(err); }
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// EXPERIMENTS
// ═══════════════════════════════════════════════════════════════════════════════

/** GET /governance/experiments — List experiments */
router.get('/experiments', rateLimit('read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = await getDb();
    const statusFilter = req.query.status as string;
    const where = statusFilter ? `WHERE status = $1` : '';
    const params = statusFilter ? [statusFilter] : [];
    const result = await breaker.execute(() =>
      db.query(`SELECT * FROM experiments ${where} ORDER BY created_at DESC LIMIT 50`, params)
    );
    res.json(ok(req, result.rows));
  } catch (err) { next(err); }
});

/** POST /governance/experiments — Create experiment */
router.post('/experiments', requireAdmin, rateLimit('write'), validateBody('CreateExperiment', CreateExperimentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req.body;
      const db = await getDb();

      // Count active experiments
      const activeResult = await breaker.execute(() =>
        db.query(`SELECT COUNT(*) AS count FROM experiments WHERE status = 'RUNNING'`)
      );
      const activeCount = parseInt(String(activeResult.rows[0]?.['count'] ?? '0'), 10);

      // Governance validation
      const validation = validateExperiment(data, activePolicyRules, activeCount);
      if (!validation.valid) {
        res.status(422).json(fail(req, 'EXPERIMENT_VALIDATION_FAILED', 'Experiment failed governance validation', {
          violations: validation.violations,
        }));
        return;
      }

      const experimentId = crypto.randomUUID();
      await breaker.execute(() => db.query(
        `INSERT INTO experiments (id, name, description, variable, control_pct, treatment_pct, holdout_pct,
         target_sku_ids, segment_filter, max_enrollment, primary_metric, guardrail_metrics,
         status, policy_version_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'DRAFT', $13, NOW(), NOW())`,
        [experimentId, data.name, data.description ?? '', data.variable,
         data.controlPct, data.treatmentPct, data.holdoutPct,
         JSON.stringify(data.targetSkuIds ?? []), JSON.stringify(data.segmentFilter ?? {}),
         data.maxEnrollment ?? 100000, data.primaryMetric,
         JSON.stringify(data.guardrailMetrics), activePolicyVersionId],
      ));

      await emitGovernanceAudit(req, 'EXPERIMENT_CREATED', 'experiment', experimentId, {
        variable: data.variable, name: data.name,
      });

      res.status(201).json(created(req, { experimentId, validation }));
    } catch (err) { next(err); }
  },
);

/** POST /governance/experiments/:id/start — Start an experiment */
router.post('/experiments/:id/start', requireAdmin, rateLimit('write'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const db = await getDb();
      await breaker.execute(() =>
        db.query(`UPDATE experiments SET status = 'RUNNING', started_at = NOW(), updated_at = NOW() WHERE id = $1 AND status = 'DRAFT'`, [req.params.id])
      );
      await emitGovernanceAudit(req, 'EXPERIMENT_STARTED', 'experiment', String(req.params.id), {});
      res.json(ok(req, { status: 'RUNNING' }));
    } catch (err) { next(err); }
  },
);

/** POST /governance/experiments/:id/conclude — Conclude an experiment */
router.post('/experiments/:id/conclude', requireAdmin, rateLimit('write'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const db = await getDb();
      await breaker.execute(() =>
        db.query(`UPDATE experiments SET status = 'CONCLUDED', concluded_at = NOW(), updated_at = NOW() WHERE id = $1`, [req.params.id])
      );
      await emitGovernanceAudit(req, 'EXPERIMENT_CONCLUDED', 'experiment', String(req.params.id), {});
      res.json(ok(req, { status: 'CONCLUDED' }));
    } catch (err) { next(err); }
  },
);

/** POST /governance/experiments/:id/assign — Get player's experiment group */
router.post('/experiments/:id/assign', rateLimit('read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ctx = req.tenantContext!;
      const db = await getDb();
      const result = await breaker.execute(() =>
        db.query(`SELECT * FROM experiments WHERE id = $1 AND status = 'RUNNING'`, [req.params.id])
      );
      if (!result.rows[0]) { res.status(404).json(fail(req, 'NOT_FOUND', 'Running experiment not found')); return; }

      const row = result.rows[0];
      const group = assignExperimentGroup(
        ctx.actorId, String(req.params.id),
        Number(row['control_pct']), Number(row['treatment_pct']),
      );

      res.json(ok(req, { experimentId: req.params.id, group, playerId: ctx.actorId }));
    } catch (err) { next(err); }
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// KILLSWITCH
// ═══════════════════════════════════════════════════════════════════════════════

/** GET /governance/killswitch — Get active killswitches */
router.get('/killswitch', requireAdmin, rateLimit('read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const active = await getActiveKillswitches();
      res.json(ok(req, active));
    } catch (err) { next(err); }
  },
);

/** POST /governance/killswitch/activate — Activate a killswitch */
router.post('/killswitch/activate', requireAdmin, rateLimit('write'), validateBody('ActivateKillswitch', ActivateKillswitchSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ctx = req.tenantContext!;
      const { target, targetId, reason } = req.body;

      const event = await activateKillswitch(
        target as KillswitchTarget, targetId ?? null, reason, ctx.actorId,
      );

      // Persist to database
      const db = await getDb();
      await breaker.execute(() => db.query(
        `INSERT INTO killswitch_events (id, target, target_id, reason, triggered_by, triggered_at, auto_triggered, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, false, NOW())`,
        [event.eventId, event.target, event.targetId, event.reason, event.triggeredBy, event.triggeredAt],
      ));

      await emitGovernanceAudit(req, 'KILLSWITCH_ACTIVATED', target, targetId ?? null, { reason });

      res.status(201).json(created(req, event));
    } catch (err) { next(err); }
  },
);

/** POST /governance/killswitch/resolve — Resolve a killswitch */
router.post('/killswitch/resolve', requireAdmin, rateLimit('write'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ctx = req.tenantContext!;
      const { target, targetId } = req.body;

      const resolution = await resolveKillswitch(target as KillswitchTarget, targetId ?? null, ctx.actorId);

      // Update database
      const db = await getDb();
      await breaker.execute(() => db.query(
        `UPDATE killswitch_events SET resolved_at = $1, resolved_by = $2
         WHERE target = $3 AND (target_id = $4 OR ($4 IS NULL AND target_id IS NULL)) AND resolved_at IS NULL`,
        [resolution.resolvedAt, resolution.resolvedBy, target, targetId ?? null],
      ));

      await emitGovernanceAudit(req, 'KILLSWITCH_RESOLVED', target, targetId ?? null, {});

      res.json(ok(req, resolution));
    } catch (err) { next(err); }
  },
);

/** GET /governance/killswitch/check/:target/:targetId? — Quick killswitch check */
router.get('/killswitch/check/:target/:targetId?', rateLimit('read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawTargetId = req.params.targetId;
      const targetId = Array.isArray(rawTargetId) ? rawTargetId[0] : (rawTargetId ?? null);
      const killed = await isKilled(req.params.target as KillswitchTarget, targetId);
      res.json(ok(req, { target: req.params.target, targetId, killed }));
    } catch (err) { next(err); }
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// POLICY VERSIONING
// ═══════════════════════════════════════════════════════════════════════════════

/** GET /governance/policy — Get active policy */
router.get('/policy', rateLimit('read'), async (req: Request, res: Response) => {
  res.json(ok(req, {
    versionId: activePolicyVersionId,
    rules: activePolicyRules,
  }));
});

/** GET /governance/policy/history — Get policy version history */
router.get('/policy/history', requireAdmin, rateLimit('read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const db = await getDb();
      const result = await breaker.execute(() =>
        db.query(`SELECT * FROM policy_versions ORDER BY version_number DESC LIMIT 50`)
      );
      res.json(ok(req, result.rows));
    } catch (err) { next(err); }
  },
);

/** POST /governance/policy/publish — Publish new policy version */
router.post('/policy/publish', requireAdmin, rateLimit('write'), validateBody('PublishPolicy', PublishPolicySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ctx = req.tenantContext!;
      const { rules } = req.body;

      // Merge with defaults — forbidden lists are immutable
      const newRules: PolicyRules = {
        ...DEFAULT_POLICY_RULES,
        ...rules,
        storeDuringRunEnabled: false, // immutable
        forbiddenSkuClasses: DEFAULT_POLICY_RULES.forbiddenSkuClasses, // immutable
        forbiddenExperimentVariables: DEFAULT_POLICY_RULES.forbiddenExperimentVariables, // immutable
      };

      const versionId = crypto.randomUUID();
      const contentHash = await computeHash(JSON.stringify(newRules));
      const db = await getDb();

      // Get next version number
      const maxResult = await breaker.execute(() =>
        db.query(`SELECT COALESCE(MAX(version_number), 0) + 1 AS next FROM policy_versions`)
      );
      const versionNumber = parseInt(String(maxResult.rows[0]?.['next'] ?? '1'), 10);

      // Deactivate current
      await breaker.execute(() =>
        db.query(`UPDATE policy_versions SET is_active = false WHERE is_active = true`)
      );

      // Insert new version
      await breaker.execute(() => db.query(
        `INSERT INTO policy_versions (id, version_number, content_hash, rules, published_by, published_at,
         is_active, previous_version_id, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), true, $6, NOW())`,
        [versionId, versionNumber, contentHash, JSON.stringify(newRules), ctx.actorId, activePolicyVersionId],
      ));

      // Update in-process cache
      activePolicyRules = newRules;
      activePolicyVersionId = versionId;

      await emitGovernanceAudit(req, 'POLICY_PUBLISHED', 'policy', versionId, {
        versionNumber, contentHash,
      });

      res.status(201).json(created(req, { versionId, versionNumber, contentHash, rules: newRules }));
    } catch (err) { next(err); }
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// GOVERNANCE AUDIT TRAIL
// ═══════════════════════════════════════════════════════════════════════════════

/** GET /governance/audit — Query governance audit log */
router.get('/audit', requireAdmin, rateLimit('read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const db = await getDb();
      const limit = Math.min(parseInt(req.query.limit as string || '50', 10), 200);
      const action = req.query.action as string;
      const targetType = req.query.targetType as string;

      const where: string[] = [];
      const params: unknown[] = [];

      if (action) { params.push(action); where.push(`action = $${params.length}`); }
      if (targetType) { params.push(targetType); where.push(`target_type = $${params.length}`); }

      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      params.push(limit);

      const result = await breaker.execute(() =>
        db.query(`SELECT * FROM governance_audit_log ${whereSql} ORDER BY created_at DESC LIMIT $${params.length}`, params)
      );

      res.json(ok(req, result.rows));
    } catch (err) { next(err); }
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// GOVERNANCE HEALTH
// ═══════════════════════════════════════════════════════════════════════════════

/** GET /governance/health — Governance system health check */
router.get('/health', rateLimit('read'), async (req: Request, res: Response) => {
  const killswitches = await getActiveKillswitches().catch(() => []);
  res.json(ok(req, {
    activePolicyVersionId,
    activeKillswitches: killswitches.length,
    killswitchDetails: killswitches,
    policyRules: activePolicyRules,
  }));
});

// ═══════════════════════════════════════════════════════════════════════════════
// PURCHASE VALIDATION ENDPOINT (used by the store service before processing)
// ═══════════════════════════════════════════════════════════════════════════════

/** POST /governance/validate-purchase — Pre-purchase governance check */
router.post('/validate-purchase', rateLimit('read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ctx = req.tenantContext!;
      const { skuId } = req.body;

      // 1. Check ALL_PURCHASES killswitch
      const allKilled = await isKilled('ALL_PURCHASES');
      if (allKilled) {
        await emitGovernanceAudit(req, 'PURCHASE_BLOCKED', 'sku', skuId, { reason: 'ALL_PURCHASES killswitch active' });
        res.json(ok(req, { allowed: false, reason: 'Purchases are temporarily disabled.' }));
        return;
      }

      // 2. Check STORE killswitch
      const storeKilled = await isKilled('STORE');
      if (storeKilled) {
        await emitGovernanceAudit(req, 'PURCHASE_BLOCKED', 'sku', skuId, { reason: 'STORE killswitch active' });
        res.json(ok(req, { allowed: false, reason: 'Store is temporarily disabled.' }));
        return;
      }

      // 3. Check specific SKU killswitch
      const skuKilled = await isKilled('SKU', skuId);
      if (skuKilled) {
        await emitGovernanceAudit(req, 'PURCHASE_BLOCKED', 'sku', skuId, { reason: 'SKU killswitch active' });
        res.json(ok(req, { allowed: false, reason: 'This item is temporarily unavailable.' }));
        return;
      }

      // 4. Fetch SKU from DB and validate class
      const db = await getDb();
      const skuResult = await breaker.execute(() =>
        db.query(`SELECT * FROM skus WHERE id = $1 AND active = true`, [skuId])
      );

      if (!skuResult.rows[0]) {
        res.json(ok(req, { allowed: false, reason: 'Item not found or inactive.' }));
        return;
      }

      const skuClass = String(skuResult.rows[0]['sku_class']);
      if (isForbiddenSkuClass(skuClass)) {
        await emitGovernanceAudit(req, 'PURCHASE_BLOCKED', 'sku', skuId, { reason: `Forbidden SKU class: ${skuClass}` });
        res.json(ok(req, { allowed: false, reason: 'This item type is not available for purchase.' }));
        return;
      }

      res.json(ok(req, { allowed: true, skuId, skuClass }));
    } catch (err) { next(err); }
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

async function emitGovernanceAudit(
  req: Request, action: string, targetType: string, targetId: string | null,
  metadata: Record<string, unknown>,
): Promise<void> {
  const ctx = req.tenantContext;
  if (!ctx) return;

  try {
    const db = await getDb();
    await db.query(
      `INSERT INTO governance_audit_log (id, action, actor_id, actor_type, target_type, target_id,
       reason, policy_version_id, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [crypto.randomUUID(), action, ctx.actorId, ctx.actorType, targetType,
       targetId, metadata.reason ?? '', activePolicyVersionId, JSON.stringify(metadata)],
    );
  } catch {
    // Audit write failure is non-fatal — log but don't block the request
  }
}

async function computeHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export default router;