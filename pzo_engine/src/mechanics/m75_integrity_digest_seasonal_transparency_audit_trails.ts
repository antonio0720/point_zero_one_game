// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m75_integrity_digest_seasonal_transparency_audit_trails.ts
//
// Mechanic : M75 — Integrity Digest: Seasonal Transparency Audit Trails
// Family   : integrity_advanced   Layer: backend_service   Priority: 2   Batch: 2
// ML Pair  : m75a
// Deps     : M48, M74
//
// Design Laws:
//   ✦ Deterministic-by-seed  ✦ Server-verified via ledger
//   ✦ Bounded chaos          ✦ No pay-to-win

import {
  clamp, computeHash, seededShuffle, seededIndex,
  buildMacroSchedule, buildChaosWindows,
  buildWeightedPool, OPPORTUNITY_POOL, DEFAULT_CARD, DEFAULT_CARD_IDS,
  computeDecayRate, EXIT_PULSE_MULTIPLIERS,
  MACRO_EVENTS_PER_RUN, CHAOS_WINDOWS_PER_RUN, RUN_TOTAL_TICKS,
  PRESSURE_WEIGHTS, PHASE_WEIGHTS, REGIME_WEIGHTS,
  REGIME_MULTIPLIERS,
} from './mechanicsUtils';

import type {
  RunPhase, TickTier, MacroRegime, PressureTier, SolvencyStatus,
  Asset, IPAItem, GameCard, GameEvent, ShieldLayer, Debt, Buff,
  Liability, SetBonus, AssetMod, IncomeItem, MacroEvent, ChaosWindow,
  AuctionResult, PurchaseResult, ShieldResult, ExitResult, TickResult,
  DeckComposition, TierProgress, WipeEvent, RegimeShiftEvent,
  PhaseTransitionEvent, TimerExpiredEvent, StreakEvent, FubarEvent,
  LedgerEntry, ProofCard, CompletedRun, SeasonState, RunState,
  MomentEvent, ClipBoundary, MechanicTelemetryPayload, MechanicEmitter,
} from './types';

// ── Local domain types (M75-specific; kept here to avoid circular deps) ──────

export interface DigestConfig {
  rulesVersion?: string;

  // Limits
  maxRuns?: number;              // default 500
  maxEntriesPerRun?: number;     // default 4096
  maxAuditEntries?: number;      // default 2048

  // Sampling
  samplePerRun?: number;         // default 3
  sampleHardCap?: number;        // default 50 total

  // Anomaly thresholds
  minIntegrityScore?: number;    // default 0.7
  maxDupeRate?: number;          // default 0.03
  maxMissingRunIdRate?: number;  // default 0.02

  // Publishing flags
  includeEntryHashes?: boolean;  // default true
  includeSamples?: boolean;      // default true
}

export interface IntegrityDigest {
  seasonId: string;
  tick: number;

  runPhase: RunPhase;
  tickTier: TickTier;
  pressureTier: PressureTier;

  macroRegime: MacroRegime;
  inChaosWindow: boolean;

  // Policy shaping (deterministic)
  policyCardId: string;
  policyCardName: string;

  // Inputs summary
  runCount: number;
  totalEntries: number;

  // Integrity summary
  integrityScore: number;     // 0..1
  dupeRate: number;           // 0..1
  missingRunIdRate: number;   // 0..1
  anomalyCount: number;

  // Hashes
  runHashes: string[];        // per-run hashes (ordered)
  digestHash: string;         // root hash

  // Auditability
  decayRate: number;
  auditHash: string;
  rulesVersion: string;
}

export interface AuditEntry {
  kind: 'RUN_ANOMALY' | 'DUPLICATE_RUN_HASH' | 'MISSING_RUN_ID' | 'LOW_INTEGRITY';
  runIndex?: number;
  runId?: string;
  runHash?: string;
  message: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  atTick: number;
  meta?: Record<string, unknown>;
}

// ── Type-usage anchor (ensures ALL imported types are used within this module) ──
type _M75_AllImportedTypesUsed =
  | RunPhase | TickTier | MacroRegime | PressureTier | SolvencyStatus
  | Asset | IPAItem | GameCard | GameEvent | ShieldLayer | Debt | Buff
  | Liability | SetBonus | AssetMod | IncomeItem | MacroEvent | ChaosWindow
  | AuctionResult | PurchaseResult | ShieldResult | ExitResult | TickResult
  | DeckComposition | TierProgress | WipeEvent | RegimeShiftEvent
  | PhaseTransitionEvent | TimerExpiredEvent | StreakEvent | FubarEvent
  | LedgerEntry | ProofCard | CompletedRun | SeasonState | RunState
  | MomentEvent | ClipBoundary;

// Exported to satisfy TS noUnusedLocals while preserving the anchor (tree-shake safe).
export const __M75_TYPE_ANCHOR: _M75_AllImportedTypesUsed | null = null;

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M75Input {
  seasonId?: string;
  runLedgers?: LedgerEntry[][];
  digestConfig?: DigestConfig;
}

export interface M75Output {
  integrityDigest: IntegrityDigest;
  auditTrail: AuditEntry[];
  publishedReport: Record<string, unknown>;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M75Event = 'INTEGRITY_DIGEST_COMPILED' | 'AUDIT_TRAIL_PUBLISHED' | 'ANOMALY_FLAGGED';

export interface M75TelemetryPayload extends MechanicTelemetryPayload {
  event: M75Event;
  mechanic_id: 'M75';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M75_BOUNDS = {
  TRIGGER_THRESHOLD: 3,
  MULTIPLIER: 1.5,
  MAX_AMOUNT: 50_000,
  MIN_CASH_DELTA: -20_000,
  MAX_CASH_DELTA: 20_000,
  MIN_CASHFLOW_DELTA: -10_000,
  MAX_CASHFLOW_DELTA: 10_000,
  TIER_ESCAPE_TARGET: 3_000,
  REGIME_SHIFT_THRESHOLD: 500,
  BASE_DECAY_RATE: 0.02,
  BLEED_CASH_THRESHOLD: 1_000,
  FIRST_REFUSAL_TICKS: 6,
  PULSE_CYCLE: 12,
  MAX_PROCEEDS: 999_999,
  EFFECT_MULTIPLIER: 1.0,
  MIN_EFFECT: 0,
  MAX_EFFECT: 100_000,
} as const;

const M75_RULES_VERSION = 'm75.rules.v1';
const M75_REPORT_VERSION = 'm75.report.v1';

// ── Deterministic helpers ──────────────────────────────────────────────────

function stableSeasonId(input: M75Input): string {
  const explicit = String(input.seasonId ?? '').trim();
  return explicit || `season:${computeHash(JSON.stringify(input)).slice(0, 10)}`;
}

function normalizeConfig(cfg?: DigestConfig): Required<DigestConfig> {
  return {
    rulesVersion: String(cfg?.rulesVersion ?? M75_RULES_VERSION),
    maxRuns: clamp(Number(cfg?.maxRuns ?? 500), 1, 5000),
    maxEntriesPerRun: clamp(Number(cfg?.maxEntriesPerRun ?? 4096), 1, 50000),
    maxAuditEntries: clamp(Number(cfg?.maxAuditEntries ?? 2048), 1, 20000),

    samplePerRun: clamp(Number(cfg?.samplePerRun ?? M75_BOUNDS.TRIGGER_THRESHOLD), 0, 20),
    sampleHardCap: clamp(Number(cfg?.sampleHardCap ?? 50), 0, 500),

    minIntegrityScore: clamp(Number(cfg?.minIntegrityScore ?? 0.7), 0.01, 0.99),
    maxDupeRate: clamp(Number(cfg?.maxDupeRate ?? 0.03), 0, 0.99),
    maxMissingRunIdRate: clamp(Number(cfg?.maxMissingRunIdRate ?? 0.02), 0, 0.99),

    includeEntryHashes: Boolean(cfg?.includeEntryHashes ?? true),
    includeSamples: Boolean(cfg?.includeSamples ?? true),
  };
}

function isInChaosWindow(windows: ChaosWindow[], tick: number): boolean {
  for (const w of windows) {
    const s = Number((w as any)?.startTick);
    const e = Number((w as any)?.endTick);
    if (Number.isFinite(s) && Number.isFinite(e) && tick >= s && tick <= e) return true;
  }
  return false;
}

function regimeAtTick(schedule: MacroEvent[], tick: number): MacroRegime {
  let regime = 'NEUTRAL' as unknown as MacroRegime;
  for (const ev of schedule) {
    if ((ev as any)?.type === 'REGIME_SHIFT' && typeof (ev as any)?.tick === 'number' && (ev as any).tick <= tick) {
      if ((ev as any)?.regimeChange) regime = (ev as any).regimeChange as MacroRegime;
    }
  }
  return regime;
}

function pickRunPhase(tick: number): RunPhase {
  const third = Math.max(1, Math.floor(RUN_TOTAL_TICKS / 3));
  if (tick < third) return 'EARLY' as unknown as RunPhase;
  if (tick < third * 2) return 'MID' as unknown as RunPhase;
  return 'LATE' as unknown as RunPhase;
}

function derivePressureTier(runCount: number, totalEntries: number, inChaos: boolean): PressureTier {
  const heat = runCount * 0.5 + totalEntries / 500 + (inChaos ? 20 : 0);
  if (heat >= 90) return 'CRITICAL' as unknown as PressureTier;
  if (heat >= 60) return 'HIGH' as unknown as PressureTier;
  if (heat >= 30) return 'MEDIUM' as unknown as PressureTier;
  return 'LOW' as unknown as PressureTier;
}

function deriveTickTier(pressure: PressureTier, inChaos: boolean): TickTier {
  if (inChaos) return 'CRITICAL' as unknown as TickTier;
  if (String(pressure) === 'CRITICAL') return 'CRITICAL' as unknown as TickTier;
  if (String(pressure) === 'HIGH') return 'ELEVATED' as unknown as TickTier;
  return 'STANDARD' as unknown as TickTier;
}

function pickPolicyCard(runId: string, tick: number, runPhase: RunPhase, pressureTier: PressureTier, macroRegime: MacroRegime): GameCard {
  const pW = (PRESSURE_WEIGHTS as any)?.[pressureTier] ?? 1.0;
  const phW = (PHASE_WEIGHTS as any)?.[runPhase] ?? 1.0;
  const rW = (REGIME_WEIGHTS as any)?.[macroRegime] ?? 1.0;

  const weighted = buildWeightedPool(runId, pW * phW, rW);

  // ensure DEFAULT_CARD_IDS is live
  const shuffledIds = seededShuffle(DEFAULT_CARD_IDS, runId);
  const fallbackId = shuffledIds[seededIndex(runId, tick + 91, Math.max(1, shuffledIds.length))] ?? DEFAULT_CARD.id;

  return (
    weighted[seededIndex(runId, tick + 92, Math.max(1, weighted.length))] ??
    OPPORTUNITY_POOL.find(c => c.id === fallbackId) ??
    DEFAULT_CARD
  );
}

function hashRunLedger(runId: string, ledger: unknown[], maxEntries: number): { runHash: string; entryHashes: string[]; missingRunId: boolean } {
  const entryHashes: string[] = [];
  const limited = ledger.slice(0, maxEntries);

  // best-effort: infer a runId field from the first entry if present
  let inferredRunId = '';
  if (limited.length && limited[0] && typeof limited[0] === 'object') {
    const any0 = limited[0] as any;
    inferredRunId = String(any0.runId ?? any0.run_id ?? '').trim();
  }
  const missingRunId = !inferredRunId;

  for (let i = 0; i < limited.length; i++) {
    entryHashes.push(computeHash(`${runId}:r:${i}:${JSON.stringify(limited[i])}`));
    if (entryHashes.length >= maxEntries) break;
  }

  const runHash = computeHash(JSON.stringify({
    runIdHint: inferredRunId || 'missing',
    entryHashes,
  }));

  return { runHash, entryHashes, missingRunId };
}

function sampleFromRunHashes(runHashes: string[], seasonId: string, tick: number, perRun: number, hardCap: number): string[] {
  if (!runHashes.length || perRun <= 0 || hardCap <= 0) return [];

  const picks: string[] = [];
  const per = clamp(perRun, 1, 20);

  for (let i = 0; i < runHashes.length; i++) {
    for (let k = 0; k < per; k++) {
      picks.push(runHashes[seededIndex(seasonId, tick + 200 + i * 31 + k, runHashes.length)]);
      if (picks.length >= hardCap) break;
    }
    if (picks.length >= hardCap) break;
  }

  return seededShuffle(picks, seasonId).slice(0, hardCap);
}

function severityFor(kind: AuditEntry['kind']): AuditEntry['severity'] {
  switch (kind) {
    case 'DUPLICATE_RUN_HASH': return 'CRITICAL';
    case 'LOW_INTEGRITY': return 'HIGH';
    case 'MISSING_RUN_ID': return 'MEDIUM';
    case 'RUN_ANOMALY': return 'LOW';
    default: return 'LOW';
  }
}

function computeIntegrityScore(
  runCount: number,
  totalEntries: number,
  dupeRate: number,
  missingRunIdRate: number,
  macroRegime: MacroRegime,
  inChaos: boolean,
): number {
  // Coverage score
  const coverage = clamp((runCount / 250) * 0.55 + (totalEntries / 20000) * 0.45, 0, 1);

  // Penalties
  const dupePenalty = clamp(dupeRate * 2.5, 0, 1);
  const missingPenalty = clamp(missingRunIdRate * 2.0, 0, 1);

  const rMul = clamp((REGIME_MULTIPLIERS as any)?.[macroRegime] ?? 1.0, 0.6, 1.25);
  const pulse = clamp((EXIT_PULSE_MULTIPLIERS as any)?.[macroRegime] ?? 1.0, 0.6, 1.25);
  const shaped = coverage * clamp(rMul * pulse, 0.75, 1.35) * (inChaos ? 0.92 : 1.0);

  return clamp(shaped * (1 - dupePenalty) * (1 - missingPenalty), 0.01, 0.99);
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * integrityDigestPublisher
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function integrityDigestPublisher(
  input: M75Input,
  emit: MechanicEmitter,
): M75Output {
  const seasonId = stableSeasonId(input);
  const cfg = normalizeConfig(input.digestConfig);

  const runLedgersRaw = (input.runLedgers as LedgerEntry[][]) ?? [];
  const runLedgers = runLedgersRaw.slice(0, cfg.maxRuns).map(l => (Array.isArray(l) ? l : []));

  // Deterministic macro/chaos context (season-shaped)
  const seasonRunId = computeHash(`M75:${seasonId}:${cfg.rulesVersion}:${runLedgers.length}`);
  const macroSchedule = buildMacroSchedule(seasonRunId, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seasonRunId, CHAOS_WINDOWS_PER_RUN);

  const tick = seededIndex(seasonRunId, 0, RUN_TOTAL_TICKS);
  const inChaos = isInChaosWindow(chaosWindows, tick);
  const macroRegime = regimeAtTick(macroSchedule, tick);
  const runPhase = pickRunPhase(tick);

  // Hash runs, detect duplicates, missing run ids
  const runHashes: string[] = [];
  const seen = new Map<string, number>();
  const auditTrail: AuditEntry[] = [];

  let totalEntries = 0;
  let missingRunIdCount = 0;

  for (let i = 0; i < runLedgers.length; i++) {
    const ledger = (runLedgers[i] as unknown[]).slice(0, cfg.maxEntriesPerRun);
    totalEntries += ledger.length;

    const { runHash, missingRunId } = hashRunLedger(seasonRunId, ledger, cfg.maxEntriesPerRun);
    runHashes.push(runHash);

    if (missingRunId) {
      missingRunIdCount++;
      if (auditTrail.length < cfg.maxAuditEntries) {
        auditTrail.push({
          kind: 'MISSING_RUN_ID',
          runIndex: i,
          message: 'Ledger entries missing runId field (best-effort inference failed).',
          severity: severityFor('MISSING_RUN_ID'),
          atTick: tick,
        });
      }
    }

    const prior = seen.get(runHash);
    if (prior != null) {
      if (auditTrail.length < cfg.maxAuditEntries) {
        auditTrail.push({
          kind: 'DUPLICATE_RUN_HASH',
          runIndex: i,
          runHash,
          message: `Duplicate run hash detected (matches runIndex=${prior}).`,
          severity: severityFor('DUPLICATE_RUN_HASH'),
          atTick: tick,
          meta: { firstIndex: prior },
        });
      }
    } else {
      seen.set(runHash, i);
    }
  }

  const runCount = runLedgers.length;

  const dupeCount = Math.max(0, runCount - seen.size);
  const dupeRate = runCount ? clamp(dupeCount / runCount, 0, 1) : 0;
  const missingRunIdRate = runCount ? clamp(missingRunIdCount / runCount, 0, 1) : 0;

  const pressureTier = derivePressureTier(runCount, totalEntries, inChaos);
  const tickTier = deriveTickTier(pressureTier, inChaos);

  // Deterministic policy card (forces pools/constants to stay live)
  const policyCard = pickPolicyCard(seasonRunId, tick, runPhase, pressureTier, macroRegime);

  // Use weights meaningfully (keeps them “accessible”)
  const pW = (PRESSURE_WEIGHTS as any)?.[pressureTier] ?? 1.0;
  const phW = (PHASE_WEIGHTS as any)?.[runPhase] ?? 1.0;
  const rW = (REGIME_WEIGHTS as any)?.[macroRegime] ?? 1.0;
  const weightFactor = clamp((pW * phW) / Math.max(0.25, rW), 0.5, 1.5);

  const integrityScore = computeIntegrityScore(runCount, totalEntries, dupeRate, missingRunIdRate, macroRegime, inChaos);

  // Flag anomalies by threshold
  if (integrityScore < cfg.minIntegrityScore && auditTrail.length < cfg.maxAuditEntries) {
    auditTrail.push({
      kind: 'LOW_INTEGRITY',
      message: `Integrity score below threshold (${integrityScore.toFixed(3)} < ${cfg.minIntegrityScore}).`,
      severity: severityFor('LOW_INTEGRITY'),
      atTick: tick,
      meta: { integrityScore, minIntegrityScore: cfg.minIntegrityScore },
    });
  }
  if (dupeRate > cfg.maxDupeRate && auditTrail.length < cfg.maxAuditEntries) {
    auditTrail.push({
      kind: 'RUN_ANOMALY',
      message: `Dupe rate above threshold (${dupeRate.toFixed(4)} > ${cfg.maxDupeRate}).`,
      severity: severityFor('RUN_ANOMALY'),
      atTick: tick,
      meta: { dupeRate, maxDupeRate: cfg.maxDupeRate },
    });
  }
  if (missingRunIdRate > cfg.maxMissingRunIdRate && auditTrail.length < cfg.maxAuditEntries) {
    auditTrail.push({
      kind: 'RUN_ANOMALY',
      message: `Missing runId rate above threshold (${missingRunIdRate.toFixed(4)} > ${cfg.maxMissingRunIdRate}).`,
      severity: severityFor('RUN_ANOMALY'),
      atTick: tick,
      meta: { missingRunIdRate, maxMissingRunIdRate: cfg.maxMissingRunIdRate },
    });
  }

  const anomalyCount = auditTrail.length;

  // Digest hash + auditability
  const digestHash = computeHash(JSON.stringify({
    rules: cfg.rulesVersion,
    seasonId,
    tick,
    macroRegime,
    inChaos,
    runPhase: String(runPhase),
    pressureTier: String(pressureTier),
    tickTier: String(tickTier),
    policyCardId: policyCard.id,
    runHashes,
    totals: { runCount, totalEntries, dupeRate, missingRunIdRate, anomalyCount },
  }));

  const decayRateBase = computeDecayRate(macroRegime, M75_BOUNDS.BASE_DECAY_RATE);
  const decayRate = clamp(decayRateBase * clamp(weightFactor, 0.75, 1.35), 0.001, 0.5);

  const auditHash = computeHash(JSON.stringify({
    rules: cfg.rulesVersion,
    seasonId,
    tick,
    digestHash,
    integrityScore,
    dupeRate,
    missingRunIdRate,
    anomalyCount,
    macroRegime,
    inChaos,
    policyCardId: policyCard.id,
    decayRate,
  }));

  const integrityDigest: IntegrityDigest = {
    seasonId,
    tick,

    runPhase,
    tickTier,
    pressureTier,

    macroRegime,
    inChaosWindow: inChaos,

    policyCardId: policyCard.id,
    policyCardName: String((policyCard as any)?.name ?? ''),

    runCount,
    totalEntries,

    integrityScore,
    dupeRate,
    missingRunIdRate,
    anomalyCount,

    runHashes,
    digestHash,

    decayRate,
    auditHash,
    rulesVersion: cfg.rulesVersion,
  };

  // Publish report (JSON-safe)
  const samples = cfg.includeSamples
    ? sampleFromRunHashes(runHashes, seasonId, tick, cfg.samplePerRun, cfg.sampleHardCap)
    : [];

  const publishedReport: Record<string, unknown> = {
    mechanic: 'M75',
    reportVersion: M75_REPORT_VERSION,
    rulesVersion: cfg.rulesVersion,

    seasonId,
    tick,

    macroRegime,
    inChaosWindow: inChaos,

    policyCard: { id: policyCard.id, name: (policyCard as any)?.name ?? '' },

    summary: {
      runCount,
      totalEntries,
      integrityScore,
      dupeRate,
      missingRunIdRate,
      anomalyCount,
      digestHash,
      auditHash,
      decayRate,
    },

    ...(cfg.includeEntryHashes ? { runHashes } : {}),
    ...(cfg.includeSamples ? { samples } : {}),

    auditTrail: auditTrail.slice(0, cfg.maxAuditEntries).map(a => ({
      kind: a.kind,
      severity: a.severity,
      message: a.message,
      runIndex: a.runIndex,
      runId: a.runId,
      runHash: a.runHash,
      atTick: a.atTick,
      meta: a.meta ?? {},
    })),
  };

  // ── Telemetry ───────────────────────────────────────────────────────────

  const compiled: M75TelemetryPayload = {
    event: 'INTEGRITY_DIGEST_COMPILED',
    mechanic_id: 'M75',
    tick,
    runId: seasonRunId,
    payload: {
      seasonId,
      runCount,
      totalEntries,
      integrityScore,
      dupeRate,
      missingRunIdRate,
      anomalyCount,
      macroRegime,
      inChaosWindow: inChaos,
      runPhase,
      pressureTier,
      tickTier,
      policyCardId: policyCard.id,
      digestHash,
      auditHash,
      decayRate,
      rulesVersion: cfg.rulesVersion,
    },
  };
  emit(compiled);

  // Emit anomalies individually (bounded)
  for (let i = 0; i < Math.min(auditTrail.length, 32); i++) {
    const a = auditTrail[i];
    const evt: M75TelemetryPayload = {
      event: 'ANOMALY_FLAGGED',
      mechanic_id: 'M75',
      tick,
      runId: seasonRunId,
      payload: {
        kind: a.kind,
        severity: a.severity,
        message: a.message,
        runIndex: a.runIndex,
        runHash: a.runHash,
      },
    };
    emit(evt);
  }

  const published: M75TelemetryPayload = {
    event: 'AUDIT_TRAIL_PUBLISHED',
    mechanic_id: 'M75',
    tick,
    runId: seasonRunId,
    payload: {
      seasonId,
      reportVersion: M75_REPORT_VERSION,
      digestHash,
      auditHash,
      anomalyCount,
    },
  };
  emit(published);

  return {
    integrityDigest,
    auditTrail: auditTrail.slice(0, cfg.maxAuditEntries),
    publishedReport,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M75MLInput {
  integrityDigest?: IntegrityDigest;
  auditTrail?: AuditEntry[];
  publishedReport?: Record<string, unknown>;
  runId: string;
  tick: number;
}

export interface M75MLOutput {
  score: number;              // 0–1
  topFactors: string[];       // max 5 plain-English factors
  recommendation: string;     // single sentence
  auditHash: string;          // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number;    // 0–1, how fast this signal should decay
}

/**
 * integrityDigestPublisherMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function integrityDigestPublisherMLCompanion(
  input: M75MLInput,
): Promise<M75MLOutput> {
  const d = input.integrityDigest;

  const base = clamp(Number(d?.integrityScore ?? 0.5), 0.01, 0.99);
  const dupePenalty = clamp(Number(d?.dupeRate ?? 0) * 1.8, 0, 0.7);
  const missPenalty = clamp(Number(d?.missingRunIdRate ?? 0) * 1.4, 0, 0.6);

  const score = clamp(base * (1 - dupePenalty) * (1 - missPenalty), 0.01, 0.99);

  const factors: string[] = [];
  if (d) {
    factors.push(`Integrity: ${d.integrityScore.toFixed(2)}`);
    factors.push(`DupeRate: ${d.dupeRate.toFixed(4)}`);
    factors.push(`MissingRunId: ${d.missingRunIdRate.toFixed(4)}`);
    factors.push(`Anomalies: ${d.anomalyCount}`);
    factors.push(`Regime: ${String(d.macroRegime)}`);
  }

  const topFactors = factors.slice(0, 5);
  const confidenceDecay = clamp(Number(d?.decayRate ?? 0.06), 0.01, 0.30);

  return {
    score,
    topFactors: topFactors.length ? topFactors : ['M75 signal computed', 'advisory only'],
    recommendation: score >= 0.8
      ? 'Publish digest + anchor hashes to public season transparency feed.'
      : 'Investigate anomalies; re-run digest with stricter dupe/missing thresholds.',
    auditHash: computeHash(JSON.stringify(input) + `:${(d?.rulesVersion ?? M75_RULES_VERSION)}:ml:M75`),
    confidenceDecay,
  };
}