/**
 * Partner Distribution Metrics
 * backend/src/observability/metrics_partner_distribution.ts
 *
 * Spec: PZO_DIST_T130
 * "Metrics: enroll conversion, time-to-first-run, cohort retention, share rate,
 *  ladder participation, season completion, renewal proxies."
 *
 * This module exposes typed metric recording functions that emit structured
 * events. At 20M concurrent, these are fire-and-forget — Redis counters
 * for hot-path, with periodic flushes to the reporting warehouse.
 *
 * Metric hierarchy:
 *   Partner → Cohort → Individual
 *
 * All metrics are privacy-safe: no PII, no individual player identification
 * in aggregate exports. Individual metrics use opaque player IDs.
 *
 * Density6 LLC · Point Zero One · Confidential
 */

import Redis from 'ioredis';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type MetricName =
  | 'partner.enroll.invited'
  | 'partner.enroll.accepted'
  | 'partner.enroll.conversion'
  | 'partner.time_to_first_run_ms'
  | 'partner.cohort.retention_d7'
  | 'partner.cohort.retention_d14'
  | 'partner.cohort.retention_d30'
  | 'partner.share.rate'
  | 'partner.share.count'
  | 'partner.ladder.participation_rate'
  | 'partner.ladder.entries'
  | 'partner.season.completion_rate'
  | 'partner.season.runs_per_member'
  | 'partner.renewal.proxy_score'
  | 'partner.renewal.engagement_velocity'
  | 'partner.active_members'
  | 'partner.runs_today'
  | 'partner.proof_cards_generated';

export interface MetricEvent {
  name: MetricName;
  value: number;
  partnerId: string;
  cohortId?: string;
  playerId?: string;
  tags: Record<string, string>;
  timestamp: string;
}

export interface PartnerMetricSnapshot {
  partnerId: string;
  cohortId: string | null;
  period: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  periodStart: string;
  metrics: Record<MetricName, number>;
  computedAt: string;
}

export interface RenewalProxyInputs {
  enrollConversionRate: number;
  d7RetentionRate: number;
  d30RetentionRate: number;
  shareRate: number;
  ladderParticipationRate: number;
  seasonCompletionRate: number;
  avgRunsPerMember: number;
  proofCardsGenerated: number;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// REDIS CONNECTION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const redis = new Redis(process.env.PZO_REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 1, enableReadyCheck: false, lazyConnect: true,
});

redis.on('error', () => { /* logged elsewhere */ });

const KEY_PREFIX = 'metrics:partner:';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DATABASE ABSTRACTION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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
      throw new Error('Unable to resolve database client for PartnerMetrics.');
    })().catch(err => { cachedDb = null; throw err; });
  }
  return cachedDb;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// METRIC RECORDING (HOT PATH — REDIS COUNTERS)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Record a single metric event.
 * Fire-and-forget — never blocks the calling code.
 */
export function recordMetric(event: MetricEvent): void {
  const dateKey = event.timestamp.slice(0, 10); // YYYY-MM-DD
  const baseKey = `${KEY_PREFIX}${event.partnerId}:${dateKey}:${event.name}`;

  const pipeline = redis.pipeline();

  // Increment counter
  pipeline.incrbyfloat(baseKey, event.value);
  pipeline.expire(baseKey, 90 * 86400); // 90 day TTL

  // Cohort-level counter if applicable
  if (event.cohortId) {
    const cohortKey = `${KEY_PREFIX}${event.partnerId}:${event.cohortId}:${dateKey}:${event.name}`;
    pipeline.incrbyfloat(cohortKey, event.value);
    pipeline.expire(cohortKey, 90 * 86400);
  }

  pipeline.exec().catch(() => { /* non-critical */ });
}

/**
 * Record enrollment invitation.
 */
export function recordEnrollmentInvited(partnerId: string, cohortId: string): void {
  recordMetric({
    name: 'partner.enroll.invited', value: 1,
    partnerId, cohortId, tags: {}, timestamp: new Date().toISOString(),
  });
}

/**
 * Record enrollment acceptance.
 */
export function recordEnrollmentAccepted(partnerId: string, cohortId: string): void {
  recordMetric({
    name: 'partner.enroll.accepted', value: 1,
    partnerId, cohortId, tags: {}, timestamp: new Date().toISOString(),
  });
}

/**
 * Record time from enrollment to first run (ms).
 */
export function recordTimeToFirstRun(partnerId: string, cohortId: string, durationMs: number): void {
  recordMetric({
    name: 'partner.time_to_first_run_ms', value: durationMs,
    partnerId, cohortId, tags: {}, timestamp: new Date().toISOString(),
  });
}

/**
 * Record a proof card share.
 */
export function recordShare(partnerId: string, cohortId: string): void {
  recordMetric({
    name: 'partner.share.count', value: 1,
    partnerId, cohortId, tags: {}, timestamp: new Date().toISOString(),
  });
}

/**
 * Record a ladder entry.
 */
export function recordLadderEntry(partnerId: string, cohortId: string): void {
  recordMetric({
    name: 'partner.ladder.entries', value: 1,
    partnerId, cohortId, tags: {}, timestamp: new Date().toISOString(),
  });
}

/**
 * Record a run completion.
 */
export function recordRunCompleted(partnerId: string, cohortId: string): void {
  recordMetric({
    name: 'partner.runs_today', value: 1,
    partnerId, cohortId, tags: {}, timestamp: new Date().toISOString(),
  });
}

/**
 * Record a proof card generation.
 */
export function recordProofCardGenerated(partnerId: string, cohortId: string): void {
  recordMetric({
    name: 'partner.proof_cards_generated', value: 1,
    partnerId, cohortId, tags: {}, timestamp: new Date().toISOString(),
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPUTED METRICS (BATCH / ROLLUP JOBS)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Compute cohort retention rate for a given day offset.
 * Returns the percentage of members who have played within the last `dayOffset` days.
 */
export async function computeCohortRetention(
  partnerId: string, cohortId: string, dayOffset: number,
): Promise<number> {
  const db = await getDb();

  const result = await db.query(
    `SELECT
       COUNT(DISTINCT cm.id) AS total_members,
       COUNT(DISTINCT CASE WHEN r.last_run_at > NOW() - ($3 || ' days')::INTERVAL THEN cm.id END) AS active_members
     FROM cohort_members cm
     LEFT JOIN (
       SELECT player_id, MAX(created_at) AS last_run_at
       FROM runs
       GROUP BY player_id
     ) r ON r.player_id = cm.id
     WHERE cm.institution_id = (SELECT institution_id FROM partner_cohorts WHERE id = $2 LIMIT 1)
       AND cm.cohort_id = $2`,
    [partnerId, cohortId, String(dayOffset)],
  );

  const total = Number(result.rows[0]?.['total_members'] ?? 0);
  const active = Number(result.rows[0]?.['active_members'] ?? 0);

  return total > 0 ? Math.round((active / total) * 10000) / 100 : 0;
}

/**
 * Compute enrollment conversion rate.
 */
export async function computeEnrollConversion(partnerId: string, cohortId: string, dateKey: string): Promise<number> {
  const invited = await getRedisCounter(partnerId, cohortId, dateKey, 'partner.enroll.invited');
  const accepted = await getRedisCounter(partnerId, cohortId, dateKey, 'partner.enroll.accepted');
  return invited > 0 ? Math.round((accepted / invited) * 10000) / 100 : 0;
}

/**
 * Compute share rate (shares per active member per day).
 */
export async function computeShareRate(partnerId: string, cohortId: string, dateKey: string): Promise<number> {
  const shares = await getRedisCounter(partnerId, cohortId, dateKey, 'partner.share.count');
  const runs = await getRedisCounter(partnerId, cohortId, dateKey, 'partner.runs_today');
  return runs > 0 ? Math.round((shares / runs) * 10000) / 100 : 0;
}

/**
 * Compute renewal proxy score (0–100).
 * Weighted composite of engagement metrics that predict renewal likelihood.
 */
export function computeRenewalProxyScore(inputs: RenewalProxyInputs): number {
  const weights = {
    enrollConversion: 0.10,
    d7Retention: 0.15,
    d30Retention: 0.25,
    shareRate: 0.10,
    ladderParticipation: 0.10,
    seasonCompletion: 0.15,
    runsPerMember: 0.10,
    proofCards: 0.05,
  };

  const normalized = {
    enrollConversion: Math.min(100, inputs.enrollConversionRate),
    d7Retention: Math.min(100, inputs.d7RetentionRate),
    d30Retention: Math.min(100, inputs.d30RetentionRate),
    shareRate: Math.min(100, inputs.shareRate * 5), // 20% share rate → 100
    ladderParticipation: Math.min(100, inputs.ladderParticipationRate),
    seasonCompletion: Math.min(100, inputs.seasonCompletionRate),
    runsPerMember: Math.min(100, inputs.avgRunsPerMember * 2), // 50 runs → 100
    proofCards: Math.min(100, inputs.proofCardsGenerated / 10), // 1000 cards → 100
  };

  const score =
    normalized.enrollConversion * weights.enrollConversion +
    normalized.d7Retention * weights.d7Retention +
    normalized.d30Retention * weights.d30Retention +
    normalized.shareRate * weights.shareRate +
    normalized.ladderParticipation * weights.ladderParticipation +
    normalized.seasonCompletion * weights.seasonCompletion +
    normalized.runsPerMember * weights.runsPerMember +
    normalized.proofCards * weights.proofCards;

  return Math.round(Math.min(100, Math.max(0, score)) * 100) / 100;
}

/**
 * Generate a full metric snapshot for a partner/cohort.
 * Called by the daily/weekly rollup job.
 */
export async function generateSnapshot(
  partnerId: string,
  cohortId: string | null,
  period: 'DAILY' | 'WEEKLY' | 'MONTHLY',
  periodStart: string,
): Promise<PartnerMetricSnapshot> {
  const dateKey = periodStart.slice(0, 10);

  const metrics: Partial<Record<MetricName, number>> = {};

  // Read counters from Redis
  const counterMetrics: MetricName[] = [
    'partner.enroll.invited', 'partner.enroll.accepted',
    'partner.share.count', 'partner.ladder.entries',
    'partner.runs_today', 'partner.proof_cards_generated',
  ];

  for (const name of counterMetrics) {
    metrics[name] = await getRedisCounter(partnerId, cohortId, dateKey, name);
  }

  // Compute derived metrics
  const invited = metrics['partner.enroll.invited'] ?? 0;
  const accepted = metrics['partner.enroll.accepted'] ?? 0;
  metrics['partner.enroll.conversion'] = invited > 0 ? Math.round((accepted / invited) * 10000) / 100 : 0;

  const runs = metrics['partner.runs_today'] ?? 0;
  const shares = metrics['partner.share.count'] ?? 0;
  metrics['partner.share.rate'] = runs > 0 ? Math.round((shares / runs) * 10000) / 100 : 0;

  // Retention (requires DB queries)
  if (cohortId) {
    metrics['partner.cohort.retention_d7'] = await computeCohortRetention(partnerId, cohortId, 7);
    metrics['partner.cohort.retention_d14'] = await computeCohortRetention(partnerId, cohortId, 14);
    metrics['partner.cohort.retention_d30'] = await computeCohortRetention(partnerId, cohortId, 30);
  }

  // Renewal proxy
  metrics['partner.renewal.proxy_score'] = computeRenewalProxyScore({
    enrollConversionRate: metrics['partner.enroll.conversion'] ?? 0,
    d7RetentionRate: metrics['partner.cohort.retention_d7'] ?? 0,
    d30RetentionRate: metrics['partner.cohort.retention_d30'] ?? 0,
    shareRate: metrics['partner.share.rate'] ?? 0,
    ladderParticipationRate: 0, // computed separately
    seasonCompletionRate: 0,    // computed separately
    avgRunsPerMember: 0,        // computed separately
    proofCardsGenerated: metrics['partner.proof_cards_generated'] ?? 0,
  });

  return {
    partnerId,
    cohortId,
    period,
    periodStart,
    metrics: metrics as Record<MetricName, number>,
    computedAt: new Date().toISOString(),
  };
}

/**
 * Persist a snapshot to the reporting warehouse.
 */
export async function persistSnapshot(snapshot: PartnerMetricSnapshot): Promise<void> {
  const db = await getDb();
  await db.query(
    `INSERT INTO partner_reporting_rollups
       (id, partner_id, cohort_id, period, period_start, metrics, computed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (partner_id, cohort_id, period, period_start) DO UPDATE SET
       metrics = EXCLUDED.metrics,
       computed_at = EXCLUDED.computed_at`,
    [
      crypto.randomUUID(), snapshot.partnerId, snapshot.cohortId,
      snapshot.period, snapshot.periodStart,
      JSON.stringify(snapshot.metrics), snapshot.computedAt,
    ],
  ).catch(() => { /* non-critical */ });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function getRedisCounter(
  partnerId: string, cohortId: string | null, dateKey: string, name: string,
): Promise<number> {
  try {
    const key = cohortId
      ? `${KEY_PREFIX}${partnerId}:${cohortId}:${dateKey}:${name}`
      : `${KEY_PREFIX}${partnerId}:${dateKey}:${name}`;
    const val = await redis.get(key);
    return val ? parseFloat(val) : 0;
  } catch {
    return 0;
  }
}