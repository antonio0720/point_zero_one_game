// backend/src/game/engine/chat/adapters/TickResultBuilderSignalAdapter.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE CHAT
 * /backend/src/game/engine/chat/adapters/TickResultBuilderSignalAdapter.ts
 *
 * Translates TickResultBuilder signals from the Zero layer into
 * backend chat lane LIVEOPS_SIGNAL envelopes.
 *
 * No direct imports from zero/ — all types are structural compat shapes.
 * Prevents circular dependency: chat/ → zero/ → chat/.
 *
 * Tick result signals enter the chat lane after each tick execution completes.
 * They carry:
 *   - operation kind (BUILD / REBUILD / PATCH / VALIDATE / NOOP)
 *   - severity (LOW / MEDIUM / HIGH / CRITICAL)
 *   - health score (ML-derived [0,1])
 *   - per-step DL tensor for 13-step tick profile
 *   - 32-dim ML feature vector for real-time inference
 *   - narration phrase and urgency label for companion routing
 *   - run/tick context for downstream routing
 *   - battle/shield/cascade/pressure summaries
 *
 * Chat doctrine:
 *   - LOW      → tick nominal, companion advisory optional
 *   - MEDIUM   → some steps degraded, companion coaching fires
 *   - HIGH     → critical degradation, companion escalates
 *   - CRITICAL → tick integrity at risk, rescue + max heat fires
 *
 * Adapter modes:
 *   DEFAULT  — emits for MEDIUM/HIGH/CRITICAL only
 *   STRICT   — emits only for HIGH/CRITICAL
 *   VERBOSE  — emits for all operations including LOW; full ML vector
 *
 * Singletons:
 *   TICK_RESULT_DEFAULT_SIGNAL_ADAPTER
 *   TICK_RESULT_STRICT_SIGNAL_ADAPTER
 *   TICK_RESULT_VERBOSE_SIGNAL_ADAPTER
 *   TICK_RESULT_SIGNAL_ADAPTER_MANIFEST
 */

import {
  clamp01,
  type ChatInputEnvelope,
  type ChatRoomId,
  type ChatSignalEnvelope,
  type JsonValue,
  type Nullable,
  type Score01,
  type UnixMs,
} from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Returns the current unix timestamp in milliseconds. */
function nowMs(): UnixMs {
  return Date.now() as UnixMs;
}

// ─────────────────────────────────────────────────────────────────────────────
// STRUCTURAL COMPAT TYPES (no zero/ imports — all inline)
// ─────────────────────────────────────────────────────────────────────────────

/** Severity compat — mirrors TickResultSeverity from the Zero layer. */
export type TickResultSeverityCompat = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/** Operation kind compat — mirrors TickResultOperationKind from the Zero layer. */
export type TickResultOperationKindCompat =
  | 'BUILD'
  | 'REBUILD'
  | 'PATCH'
  | 'VALIDATE'
  | 'NOOP';

/** Run mode compat — mirrors RunStateSnapshot['mode']. */
export type TickResultModeCompat = 'solo' | 'pvp' | 'coop' | 'ghost';

/** Run phase compat — mirrors RunStateSnapshot['phase']. */
export type TickResultRunPhaseCompat = 'FOUNDATION' | 'ESCALATION' | 'SOVEREIGNTY';

/** Run outcome compat — nullable to represent an ongoing run. */
export type TickResultRunOutcomeCompat =
  | 'FREEDOM'
  | 'TIMEOUT'
  | 'BANKRUPT'
  | 'ABANDONED'
  | null;

/** 32-dimensional ML feature vector compat shape. */
export interface TickResultMLVectorCompat {
  readonly tickNormalized: number;
  readonly durationNormalized: number;
  readonly activeBots01: number;
  readonly pendingAttacks01: number;
  readonly shieldIntegrity01: number;
  readonly breachedLayerRatio: number;
  readonly activeChains01: number;
  readonly brokenChains01: number;
  readonly completedChains01: number;
  readonly positiveChains01: number;
  readonly pressureScore01: number;
  readonly pressureTier01: number;
  readonly outcomePresent: number;
  readonly hasProofHash: number;
  readonly integrityOk: number;
  readonly warningCount01: number;
  readonly forkHintCount01: number;
  readonly signalCount01: number;
  readonly eventCount01: number;
  readonly traceCount01: number;
  readonly engineHealthCount01: number;
  readonly battleBotRatio: number;
  readonly cascadePositiveRatio: number;
  readonly shieldBreachRatio: number;
  readonly stepErrorCount01: number;
  readonly stepWarningCount01: number;
  readonly snapshotMutatedRatio: number;
  readonly rollbackRatio: number;
  readonly modeNormalized: number;
  readonly phaseNormalized: number;
  readonly tickSealPresent: number;
  readonly checksumPresent: number;
}

/** 8-feature DL tensor row compat. */
export interface TickResultDLTensorRowCompat {
  readonly stepNormalized: number;
  readonly durationMs01: number;
  readonly emittedEvents01: number;
  readonly snapshotMutated: number;
  readonly rolledBack: number;
  readonly skipped: number;
  readonly errorCount01: number;
  readonly warningCount01: number;
}

/** 13-row DL tensor compat. */
export type TickResultDLTensorCompat = readonly TickResultDLTensorRowCompat[];

/** Battle summary compat. */
export interface TickResultBattleSummaryCompat {
  readonly activeBots: number;
  readonly pendingAttacks: number;
  readonly injectedAttackCount: number;
}

/** Shield summary compat. */
export interface TickResultShieldSummaryCompat {
  readonly weakestLayer: string | null;
  readonly breachedLayerCount: number;
  readonly aggregateIntegrity: number;
}

/** Cascade summary compat. */
export interface TickResultCascadeSummaryCompat {
  readonly activeChains: number;
  readonly brokenChains: number;
  readonly completedChains: number;
  readonly positiveChains: number;
}

/** Pressure summary compat. */
export interface TickResultPressureSummaryCompat {
  readonly tier: string;
  readonly score: number;
}

/** Integrity summary compat. */
export interface TickResultIntegritySummaryCompat {
  readonly integrityStatus: string;
  readonly proofHash: string | null;
  readonly warningCount: number;
  readonly forkHintCount: number;
}

/** Full tick result signal compat shape emitted from the Zero layer. */
export interface TickResultSignalCompat {
  readonly runId: string;
  readonly tick: number;
  readonly phase: TickResultRunPhaseCompat;
  readonly mode: TickResultModeCompat;
  readonly outcome: TickResultRunOutcomeCompat;
  readonly operationKind: TickResultOperationKindCompat;
  readonly severity: TickResultSeverityCompat;
  readonly healthScore: number;
  readonly tickDurationMs: number;
  readonly checksum: string | null;
  readonly tickSeal: string | null;
  readonly battle: TickResultBattleSummaryCompat;
  readonly shield: TickResultShieldSummaryCompat;
  readonly cascade: TickResultCascadeSummaryCompat;
  readonly pressure: TickResultPressureSummaryCompat;
  readonly integrity: TickResultIntegritySummaryCompat;
  readonly mlVector: TickResultMLVectorCompat;
  readonly dlTensor: TickResultDLTensorCompat;
  readonly narrationPhrase: string;
  readonly signalCount: number;
  readonly eventCount: number;
  readonly traceCount: number;
  readonly engineHealthCount: number;
}

/** Annotation produced by the adapter for a translated signal. */
export interface TickResultAnnotationCompat {
  readonly fingerprint: string;
  readonly severity: TickResultSeverityCompat;
  readonly healthScore: number;
  readonly label: string;
  readonly description: string;
  readonly operationKind: TickResultOperationKindCompat;
  readonly tags: readonly string[];
  readonly criticalIssues: readonly string[];
  readonly warnings: readonly string[];
  readonly emittedAtMs: number;
}

/** Narration hint compat produced during translation. */
export interface TickResultNarrationCompat {
  readonly phrase: string;
  readonly urgency: string;
  readonly mode: string;
  readonly heatMultiplier: number;
  readonly companionIntent: string;
  readonly audienceReaction: string;
}

/** Trend snapshot compat. */
export interface TickResultTrendCompat {
  readonly healthTrend: number;
  readonly dominantSeverity: TickResultSeverityCompat;
  readonly averageHealthScore: number;
  readonly windowSize: number;
  readonly degrading: boolean;
}

/** Session summary compat. */
export interface TickResultSessionCompat {
  readonly totalRecorded: number;
  readonly averageHealthScore: number;
  readonly latestTick: number;
  readonly atCapacity: boolean;
  readonly severityDistribution: Readonly<Record<TickResultSeverityCompat, number>>;
}

/** Health snapshot compat. */
export interface TickResultHealthSnapshotCompat {
  readonly healthScore: number;
  readonly severity: TickResultSeverityCompat;
  readonly tier: string;
  readonly integrityStatus: string;
  readonly breachedLayerCount: number;
  readonly proofHash: Nullable<string>;
}

/** Run summary compat. */
export interface TickResultRunSummaryCompat {
  readonly runId: string;
  readonly tick: number;
  readonly phase: TickResultRunPhaseCompat;
  readonly mode: TickResultModeCompat;
  readonly outcome: TickResultRunOutcomeCompat;
  readonly durationMs: number;
}

/**
 * The result of translating a TickResultSignalCompat through the adapter.
 * `accepted` is false when the mode filter suppresses the signal.
 */
export interface TickResultTranslationResult {
  readonly accepted: boolean;
  readonly envelope: ChatInputEnvelope | null;
  readonly reason: string;
  readonly signal: TickResultSignalCompat | null;
}

/** Adapter mode controlling which signals are emitted. */
export type TickResultAdapterMode = 'DEFAULT' | 'STRICT' | 'VERBOSE';

/** Manifest describing the adapter module. */
export interface TickResultSignalAdapterManifest {
  readonly version: string;
  readonly schema: string;
  readonly ready: boolean;
  readonly mode: TickResultAdapterMode;
  readonly mlFeatureCount: number;
  readonly dlTensorShape: readonly [number, number];
  readonly maxHeat: number;
  readonly worldEventPrefix: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Adapter module version. */
export const TICK_RESULT_SIGNAL_ADAPTER_VERSION = '2026.03.27.1';

/** Adapter ready flag. */
export const TICK_RESULT_SIGNAL_ADAPTER_READY = true;

/** Schema identifier for tick-result signal envelopes. */
export const TICK_RESULT_SIGNAL_ADAPTER_SCHEMA = 'tick-result-signal/v1';

/** Number of ML features in the signal vector. */
export const TICK_RESULT_SIGNAL_ADAPTER_ML_FEATURE_COUNT = 32;

/** Shape of the DL tensor: [steps, features_per_step]. */
export const TICK_RESULT_SIGNAL_ADAPTER_DL_TENSOR_SHAPE: readonly [number, number] = [
  13, 8,
] as const;

/** Maximum heat multiplier value. */
export const TICK_RESULT_SIGNAL_ADAPTER_MAX_HEAT = 1.0;

/** World event name prefix used for liveops routing. */
export const TICK_RESULT_SIGNAL_WORLD_EVENT_PREFIX = 'world.tick_result';

// ─────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Translates a severity level into a heat multiplier [0,1].
 * CRITICAL → 1.0, HIGH → 0.75, MEDIUM → 0.5, LOW → 0.25.
 */
export function translateTickResultSeverityToHeat(
  sev: TickResultSeverityCompat,
): Score01 {
  switch (sev) {
    case 'CRITICAL': return clamp01(1.0) as Score01;
    case 'HIGH':     return clamp01(0.75) as Score01;
    case 'MEDIUM':   return clamp01(0.5) as Score01;
    case 'LOW':      return clamp01(0.25) as Score01;
  }
}

/**
 * Builds a ChatInputEnvelope for a TickResultSignalCompat.
 *
 * Produces a LIVEOPS_SIGNAL envelope whose payload carries:
 *   worldEventName, heatMultiplier01, helperBlackout, haterRaidActive
 */
export function buildTickResultLiveOpsPayload(
  signal: TickResultSignalCompat,
  roomId: ChatRoomId,
  atMs: UnixMs,
): ChatInputEnvelope {
  const heat = translateTickResultSeverityToHeat(signal.severity);

  const signalPayload: ChatSignalEnvelope = {
    type: 'LIVEOPS' as const,
    emittedAt: atMs,
    roomId,
    liveops: {
      worldEventName: `${TICK_RESULT_SIGNAL_WORLD_EVENT_PREFIX}.${signal.severity.toLowerCase()}`,
      heatMultiplier01: clamp01(signal.healthScore) as Score01,
      helperBlackout: signal.severity === 'CRITICAL',
      haterRaidActive: signal.severity === 'HIGH' || signal.severity === 'CRITICAL',
    },
    metadata: {
      runId: signal.runId as JsonValue,
      tick: signal.tick as JsonValue,
      operationKind: signal.operationKind as JsonValue,
      severity: signal.severity as JsonValue,
      healthScore: signal.healthScore as JsonValue,
      adapterVersion: TICK_RESULT_SIGNAL_ADAPTER_VERSION as JsonValue,
      schema: TICK_RESULT_SIGNAL_ADAPTER_SCHEMA as JsonValue,
      narrationPhrase: signal.narrationPhrase as JsonValue,
      heat: heat as unknown as JsonValue,
    },
  };

  return {
    kind: 'LIVEOPS_SIGNAL',
    emittedAt: atMs,
    payload: signalPayload,
  } satisfies ChatInputEnvelope;
}

/**
 * Builds a zero-value ML vector compat for use as a default.
 */
export function buildTickResultDefaultMLVector(): TickResultMLVectorCompat {
  return Object.freeze({
    tickNormalized: 0,
    durationNormalized: 0,
    activeBots01: 0,
    pendingAttacks01: 0,
    shieldIntegrity01: 0,
    breachedLayerRatio: 0,
    activeChains01: 0,
    brokenChains01: 0,
    completedChains01: 0,
    positiveChains01: 0,
    pressureScore01: 0,
    pressureTier01: 0,
    outcomePresent: 0,
    hasProofHash: 0,
    integrityOk: 0,
    warningCount01: 0,
    forkHintCount01: 0,
    signalCount01: 0,
    eventCount01: 0,
    traceCount01: 0,
    engineHealthCount01: 0,
    battleBotRatio: 0,
    cascadePositiveRatio: 0,
    shieldBreachRatio: 0,
    stepErrorCount01: 0,
    stepWarningCount01: 0,
    snapshotMutatedRatio: 0,
    rollbackRatio: 0,
    modeNormalized: 0,
    phaseNormalized: 0,
    tickSealPresent: 0,
    checksumPresent: 0,
  });
}

/**
 * Builds a zero-value DL tensor compat (13 rows × 8 cols) for use as a default.
 */
export function buildTickResultDefaultDLTensor(): TickResultDLTensorCompat {
  const rows: TickResultDLTensorRowCompat[] = [];
  for (let i = 0; i < 13; i++) {
    rows.push(
      Object.freeze({
        stepNormalized: i / 12,
        durationMs01: 0,
        emittedEvents01: 0,
        snapshotMutated: 0,
        rolledBack: 0,
        skipped: 1,
        errorCount01: 0,
        warningCount01: 0,
      }),
    );
  }
  return Object.freeze(rows);
}

/**
 * Computes a health score [0,1] from a TickResultSignalCompat.
 * Uses the signal's embedded healthScore as the primary source.
 */
export function computeTickResultSignalHealthScore(signal: TickResultSignalCompat): number {
  return Math.max(0, Math.min(1, signal.healthScore));
}

/**
 * Classifies the severity of a TickResultSignalCompat.
 * Derives from the embedded health score when the severity field is missing.
 */
export function classifyTickResultSignalSeverity(
  signal: TickResultSignalCompat,
): TickResultSeverityCompat {
  if (isTickResultSeverityCompat(signal.severity)) return signal.severity;
  const score = computeTickResultSignalHealthScore(signal);
  if (score >= 0.75) return 'LOW';
  if (score >= 0.5) return 'MEDIUM';
  if (score >= 0.25) return 'HIGH';
  return 'CRITICAL';
}

// ─────────────────────────────────────────────────────────────────────────────
// OPTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Options for TickResultBuilderSignalAdapter construction.
 */
export interface TickResultBuilderSignalAdapterOptions {
  /** Adapter mode. Defaults to DEFAULT. */
  mode?: TickResultAdapterMode;
  /** Minimum severity to emit. Defaults to mode-appropriate value. */
  minSeverity?: TickResultSeverityCompat;
  /** Optional logger for diagnostic output. */
  logger?: (msg: string) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPE GUARDS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if `v` is a valid TickResultSeverityCompat string.
 */
export function isTickResultSeverityCompat(v: unknown): v is TickResultSeverityCompat {
  return v === 'LOW' || v === 'MEDIUM' || v === 'HIGH' || v === 'CRITICAL';
}

/**
 * Returns true if `v` is a valid TickResultOperationKindCompat string.
 */
export function isTickResultOperationKindCompat(
  v: unknown,
): v is TickResultOperationKindCompat {
  return (
    v === 'BUILD' ||
    v === 'REBUILD' ||
    v === 'PATCH' ||
    v === 'VALIDATE' ||
    v === 'NOOP'
  );
}

/**
 * Returns true if `v` is a valid TickResultModeCompat string.
 */
export function isTickResultModeCompat(v: unknown): v is TickResultModeCompat {
  return v === 'solo' || v === 'pvp' || v === 'coop' || v === 'ghost';
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ADAPTER CLASS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * TickResultBuilderSignalAdapter
 *
 * Translates TickResultSignalCompat objects emitted by the Zero layer into
 * ChatInputEnvelope objects for the backend chat LIVEOPS lane.
 *
 * Mode behaviour:
 *   DEFAULT  — accepts MEDIUM / HIGH / CRITICAL signals
 *   STRICT   — accepts HIGH / CRITICAL only
 *   VERBOSE  — accepts all signals including LOW
 */
export class TickResultBuilderSignalAdapter {
  private readonly mode: TickResultAdapterMode;
  private readonly minSeverity: TickResultSeverityCompat;
  private readonly logger: ((msg: string) => void) | undefined;
  private acceptedCount = 0;
  private rejectedCount = 0;
  private lastSignalAtMs: number | null = null;

  constructor(options: TickResultBuilderSignalAdapterOptions = {}) {
    this.mode = options.mode ?? 'DEFAULT';
    this.minSeverity = options.minSeverity ?? this.defaultMinSeverity(this.mode);
    this.logger = options.logger;
  }

  private defaultMinSeverity(mode: TickResultAdapterMode): TickResultSeverityCompat {
    switch (mode) {
      case 'STRICT':  return 'HIGH';
      case 'VERBOSE': return 'LOW';
      case 'DEFAULT': return 'MEDIUM';
    }
  }

  private severityRank(sev: TickResultSeverityCompat): number {
    switch (sev) {
      case 'LOW':      return 0;
      case 'MEDIUM':   return 1;
      case 'HIGH':     return 2;
      case 'CRITICAL': return 3;
    }
  }

  private shouldAccept(signal: TickResultSignalCompat): boolean {
    return (
      this.severityRank(signal.severity) >= this.severityRank(this.minSeverity)
    );
  }

  /**
   * Translates a single TickResultSignalCompat into a ChatInputEnvelope.
   * Returns a TickResultTranslationResult indicating acceptance status.
   */
  public translate(
    signal: TickResultSignalCompat,
    roomId: ChatRoomId,
    atMs?: UnixMs,
  ): TickResultTranslationResult {
    const ts = atMs ?? nowMs();

    if (!this.shouldAccept(signal)) {
      this.rejectedCount++;
      this.logger?.(`[TickResultAdapter] rejected tick=${signal.tick} sev=${signal.severity}`);
      return Object.freeze({
        accepted: false,
        envelope: null,
        reason: `severity ${signal.severity} below minSeverity ${this.minSeverity}`,
        signal,
      });
    }

    const envelope = buildTickResultLiveOpsPayload(signal, roomId, ts);
    this.acceptedCount++;
    this.lastSignalAtMs = ts;
    this.logger?.(`[TickResultAdapter] accepted tick=${signal.tick} sev=${signal.severity}`);

    return Object.freeze({
      accepted: true,
      envelope,
      reason: 'accepted',
      signal,
    });
  }

  /**
   * Translates a batch of TickResultSignalCompat objects.
   */
  public translateBatch(
    signals: readonly TickResultSignalCompat[],
    roomId: ChatRoomId,
  ): readonly TickResultTranslationResult[] {
    return Object.freeze(signals.map((s) => this.translate(s, roomId)));
  }

  /**
   * Convenience method for translating a BUILD operation signal.
   */
  public translateBuildSignal(
    runId: string,
    tick: number,
    healthScore: number,
    mode: TickResultModeCompat,
    roomId: ChatRoomId,
  ): TickResultTranslationResult {
    const signal = buildMinimalTickResultSignal(runId, tick, healthScore, mode, 'BUILD');
    return this.translate(signal, roomId);
  }

  /**
   * Convenience method for translating a REBUILD operation signal.
   */
  public translateRebuildSignal(
    runId: string,
    tick: number,
    healthScore: number,
    mode: TickResultModeCompat,
    roomId: ChatRoomId,
  ): TickResultTranslationResult {
    const signal = buildMinimalTickResultSignal(runId, tick, healthScore, mode, 'REBUILD');
    return this.translate(signal, roomId);
  }

  /**
   * Convenience method for translating a VALIDATE operation signal.
   */
  public translateValidateSignal(
    runId: string,
    tick: number,
    healthScore: number,
    roomId: ChatRoomId,
  ): TickResultTranslationResult {
    const signal = buildMinimalTickResultSignal(runId, tick, healthScore, 'solo', 'VALIDATE');
    return this.translate(signal, roomId);
  }

  /**
   * Translates a critical degradation event directly.
   * Forces CRITICAL severity regardless of health score.
   */
  public translateCriticalDegradation(
    runId: string,
    tick: number,
    outcome: TickResultRunOutcomeCompat,
    roomId: ChatRoomId,
  ): TickResultTranslationResult {
    const signal: TickResultSignalCompat = Object.freeze({
      ...buildMinimalTickResultSignal(runId, tick, 0, 'solo', 'BUILD'),
      severity: 'CRITICAL' as TickResultSeverityCompat,
      outcome,
      narrationPhrase: '[solo] Run integrity compromised — emergency protocols engaged.',
    });
    return this.translate(signal, roomId);
  }

  /**
   * Translates a run outcome signal.
   * Severity is derived from the outcome type.
   */
  public translateOutcomeSignal(
    runId: string,
    tick: number,
    outcome: TickResultRunOutcomeCompat,
    roomId: ChatRoomId,
  ): TickResultTranslationResult {
    const sev = outcomeToSeverity(outcome);
    const signal: TickResultSignalCompat = Object.freeze({
      ...buildMinimalTickResultSignal(runId, tick, outcomeToHealthScore(outcome), 'solo', 'VALIDATE'),
      severity: sev,
      outcome,
      narrationPhrase: outcomeToNarration(outcome),
    });
    return this.translate(signal, roomId);
  }

  /**
   * Returns diagnostic information about the adapter's current state.
   */
  public diagnostics(): {
    version: string;
    mode: TickResultAdapterMode;
    acceptedCount: number;
    rejectedCount: number;
    lastSignalAtMs: number | null;
  } {
    return Object.freeze({
      version: TICK_RESULT_SIGNAL_ADAPTER_VERSION,
      mode: this.mode,
      acceptedCount: this.acceptedCount,
      rejectedCount: this.rejectedCount,
      lastSignalAtMs: this.lastSignalAtMs,
    });
  }

  /** Resets adapter counters. */
  public reset(): void {
    this.acceptedCount = 0;
    this.rejectedCount = 0;
    this.lastSignalAtMs = null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL SIGNAL FACTORY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Derives severity from a RunOutcome value. */
function outcomeToSeverity(outcome: TickResultRunOutcomeCompat): TickResultSeverityCompat {
  switch (outcome) {
    case 'FREEDOM':   return 'LOW';
    case 'TIMEOUT':   return 'MEDIUM';
    case 'BANKRUPT':  return 'HIGH';
    case 'ABANDONED': return 'MEDIUM';
    case null:        return 'LOW';
  }
}

/** Derives a health score [0,1] from a RunOutcome value. */
function outcomeToHealthScore(outcome: TickResultRunOutcomeCompat): number {
  switch (outcome) {
    case 'FREEDOM':   return 1.0;
    case 'TIMEOUT':   return 0.5;
    case 'BANKRUPT':  return 0.1;
    case 'ABANDONED': return 0.4;
    case null:        return 0.8;
  }
}

/** Returns a narration phrase for a RunOutcome. */
function outcomeToNarration(outcome: TickResultRunOutcomeCompat): string {
  switch (outcome) {
    case 'FREEDOM':   return 'Freedom achieved — congratulations!';
    case 'TIMEOUT':   return 'Timeout — the run has expired.';
    case 'BANKRUPT':  return 'Bankrupt — financial collapse detected.';
    case 'ABANDONED': return 'Run abandoned by operator.';
    case null:        return 'Run ongoing — tick nominal.';
  }
}

/** Builds a minimal TickResultSignalCompat for convenience methods. */
function buildMinimalTickResultSignal(
  runId: string,
  tick: number,
  healthScore: number,
  mode: TickResultModeCompat,
  operationKind: TickResultOperationKindCompat,
): TickResultSignalCompat {
  const clampedScore = Math.max(0, Math.min(1, healthScore));
  let severity: TickResultSeverityCompat;
  if (clampedScore >= 0.75) severity = 'LOW';
  else if (clampedScore >= 0.5) severity = 'MEDIUM';
  else if (clampedScore >= 0.25) severity = 'HIGH';
  else severity = 'CRITICAL';

  const phaseMap: Record<TickResultModeCompat, TickResultRunPhaseCompat> = {
    solo: 'FOUNDATION',
    pvp: 'ESCALATION',
    coop: 'FOUNDATION',
    ghost: 'SOVEREIGNTY',
  };

  return Object.freeze({
    runId,
    tick,
    phase: phaseMap[mode],
    mode,
    outcome: null,
    operationKind,
    severity,
    healthScore: clampedScore,
    tickDurationMs: 0,
    checksum: null,
    tickSeal: null,
    battle: Object.freeze({ activeBots: 0, pendingAttacks: 0, injectedAttackCount: 0 }),
    shield: Object.freeze({ weakestLayer: null, breachedLayerCount: 0, aggregateIntegrity: 0 }),
    cascade: Object.freeze({ activeChains: 0, brokenChains: 0, completedChains: 0, positiveChains: 0 }),
    pressure: Object.freeze({ tier: 'T0', score: 0 }),
    integrity: Object.freeze({
      integrityStatus: 'CLEAN',
      proofHash: null,
      warningCount: 0,
      forkHintCount: 0,
    }),
    mlVector: buildTickResultDefaultMLVector(),
    dlTensor: buildTickResultDefaultDLTensor(),
    narrationPhrase: `[${mode}] Tick complete — all systems stable.`,
    signalCount: 0,
    eventCount: 0,
    traceCount: 0,
    engineHealthCount: 0,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// DOMAIN-SPECIFIC TRANSLATORS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Translates a battle-domain tick result signal into a ChatInputEnvelope.
 * Fires only when activeBots or pendingAttacks exceed threshold.
 */
export function translateTickResultBattleSignal(
  signal: TickResultSignalCompat,
  roomId: ChatRoomId,
  atMs?: UnixMs,
): TickResultTranslationResult {
  const ts = atMs ?? nowMs();
  const threshold = 5;
  const hasBattleActivity =
    signal.battle.activeBots > threshold || signal.battle.pendingAttacks > threshold;

  if (!hasBattleActivity) {
    return Object.freeze({
      accepted: false,
      envelope: null,
      reason: `battle activity below threshold (bots=${signal.battle.activeBots}, pending=${signal.battle.pendingAttacks})`,
      signal,
    });
  }

  const battlesignal: TickResultSignalCompat = Object.freeze({
    ...signal,
    severity: signal.battle.activeBots > 15 ? 'CRITICAL' : signal.battle.activeBots > 10 ? 'HIGH' : 'MEDIUM',
    narrationPhrase: `[${signal.mode}] Battle surge detected — ${signal.battle.activeBots} bots active.`,
  });

  const envelope = buildTickResultLiveOpsPayload(battlesignal, roomId, ts);
  return Object.freeze({ accepted: true, envelope, reason: 'battle activity detected', signal: battlesignal });
}

/**
 * Translates a shield-domain tick result signal into a ChatInputEnvelope.
 * Fires when shields are breached or integrity is critically low.
 */
export function translateTickResultShieldSignal(
  signal: TickResultSignalCompat,
  roomId: ChatRoomId,
  atMs?: UnixMs,
): TickResultTranslationResult {
  const ts = atMs ?? nowMs();
  const shieldCritical =
    signal.shield.breachedLayerCount > 0 || signal.shield.aggregateIntegrity < 100;

  if (!shieldCritical) {
    return Object.freeze({
      accepted: false,
      envelope: null,
      reason: 'shield integrity nominal',
      signal,
    });
  }

  const shieldSeverity: TickResultSeverityCompat =
    signal.shield.breachedLayerCount >= 3 ? 'CRITICAL' :
    signal.shield.breachedLayerCount >= 2 ? 'HIGH' : 'MEDIUM';

  const shieldSignal: TickResultSignalCompat = Object.freeze({
    ...signal,
    severity: shieldSeverity,
    narrationPhrase: `[${signal.mode}] Shield compromised — ${signal.shield.breachedLayerCount} layer(s) breached.`,
  });

  const envelope = buildTickResultLiveOpsPayload(shieldSignal, roomId, ts);
  return Object.freeze({ accepted: true, envelope, reason: 'shield breach detected', signal: shieldSignal });
}

/**
 * Translates a cascade-domain tick result signal into a ChatInputEnvelope.
 * Fires when broken chains outnumber positive chains.
 */
export function translateTickResultCascadeSignal(
  signal: TickResultSignalCompat,
  roomId: ChatRoomId,
  atMs?: UnixMs,
): TickResultTranslationResult {
  const ts = atMs ?? nowMs();
  const cascadeWarning = signal.cascade.brokenChains > signal.cascade.positiveChains;

  if (!cascadeWarning) {
    return Object.freeze({
      accepted: false,
      envelope: null,
      reason: 'cascade nominal',
      signal,
    });
  }

  const cascadeSeverity: TickResultSeverityCompat =
    signal.cascade.brokenChains > 5 ? 'CRITICAL' :
    signal.cascade.brokenChains > 2 ? 'HIGH' : 'MEDIUM';

  const cascadeSignal: TickResultSignalCompat = Object.freeze({
    ...signal,
    severity: cascadeSeverity,
    narrationPhrase: `[${signal.mode}] Cascade instability — ${signal.cascade.brokenChains} chain(s) broken.`,
  });

  const envelope = buildTickResultLiveOpsPayload(cascadeSignal, roomId, ts);
  return Object.freeze({ accepted: true, envelope, reason: 'cascade instability detected', signal: cascadeSignal });
}

/**
 * Translates a pressure-domain tick result signal.
 * Fires when tier is T3 or T4.
 */
export function translateTickResultPressureSignal(
  signal: TickResultSignalCompat,
  roomId: ChatRoomId,
  atMs?: UnixMs,
): TickResultTranslationResult {
  const ts = atMs ?? nowMs();
  const highPressure = signal.pressure.tier === 'T3' || signal.pressure.tier === 'T4';

  if (!highPressure) {
    return Object.freeze({
      accepted: false,
      envelope: null,
      reason: `pressure tier ${signal.pressure.tier} below threshold`,
      signal,
    });
  }

  const pressureSeverity: TickResultSeverityCompat =
    signal.pressure.tier === 'T4' ? 'CRITICAL' : 'HIGH';

  const pressureSignal: TickResultSignalCompat = Object.freeze({
    ...signal,
    severity: pressureSeverity,
    narrationPhrase: `[${signal.mode}] Pressure critical — tier ${signal.pressure.tier} engaged.`,
  });

  const envelope = buildTickResultLiveOpsPayload(pressureSignal, roomId, ts);
  return Object.freeze({ accepted: true, envelope, reason: 'high pressure detected', signal: pressureSignal });
}

/**
 * Translates an integrity-domain tick result signal.
 * Fires when integrityStatus is not CLEAN.
 */
export function translateTickResultIntegritySignal(
  signal: TickResultSignalCompat,
  roomId: ChatRoomId,
  atMs?: UnixMs,
): TickResultTranslationResult {
  const ts = atMs ?? nowMs();
  const integrityIssue = signal.integrity.integrityStatus !== 'CLEAN';

  if (!integrityIssue) {
    return Object.freeze({
      accepted: false,
      envelope: null,
      reason: 'integrity nominal',
      signal,
    });
  }

  const integritySeverity: TickResultSeverityCompat =
    signal.integrity.forkHintCount > 0 ? 'CRITICAL' :
    signal.integrity.warningCount > 5 ? 'HIGH' : 'MEDIUM';

  const integritySignal: TickResultSignalCompat = Object.freeze({
    ...signal,
    severity: integritySeverity,
    narrationPhrase: `[${signal.mode}] Integrity alert — status: ${signal.integrity.integrityStatus}.`,
  });

  const envelope = buildTickResultLiveOpsPayload(integritySignal, roomId, ts);
  return Object.freeze({ accepted: true, envelope, reason: 'integrity issue detected', signal: integritySignal });
}

// ─────────────────────────────────────────────────────────────────────────────
// ML FEATURE EXTRACTION (adapter-level, uses compat shapes)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extracts a 32-dimensional ML feature vector compat from a TickResultSignalCompat.
 * Reuses the embedded mlVector where possible, supplementing with signal-level fields.
 */
export function extractTickResultSignalMLVector(
  signal: TickResultSignalCompat,
): TickResultMLVectorCompat {
  const base = signal.mlVector;

  // Override with signal-level fields that might be more up-to-date
  return Object.freeze({
    ...base,
    tickNormalized: Math.max(0, Math.min(1, signal.tick / 99999)),
    durationNormalized: Math.max(0, Math.min(1, signal.tickDurationMs / 2000)),
    signalCount01: Math.max(0, Math.min(1, signal.signalCount / 50)),
    eventCount01: Math.max(0, Math.min(1, signal.eventCount / 100)),
    traceCount01: Math.max(0, Math.min(1, signal.traceCount / 100)),
    engineHealthCount01: Math.max(0, Math.min(1, signal.engineHealthCount / 10)),
    tickSealPresent: signal.tickSeal !== null ? 1 : 0,
    checksumPresent: signal.checksum !== null ? 1 : 0,
    outcomePresent: signal.outcome !== null ? 1 : 0,
    hasProofHash: signal.integrity.proofHash !== null ? 1 : 0,
    integrityOk: signal.integrity.integrityStatus === 'CLEAN' ? 1 : 0,
  });
}

/**
 * Builds a 13-row DL tensor compat from a TickResultSignalCompat.
 * Reuses the embedded dlTensor where possible.
 */
export function buildTickResultSignalDLTensor(
  signal: TickResultSignalCompat,
): TickResultDLTensorCompat {
  if (signal.dlTensor.length === 13) return signal.dlTensor;
  return buildTickResultDefaultDLTensor();
}

// ─────────────────────────────────────────────────────────────────────────────
// ANNOTATION & NARRATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds a TickResultAnnotationCompat from a TickResultSignalCompat.
 */
export function buildTickResultSignalAnnotation(
  signal: TickResultSignalCompat,
): TickResultAnnotationCompat {
  const tags: string[] = [
    `tick:${signal.tick}`,
    `mode:${signal.mode}`,
    `phase:${signal.phase}`,
    `severity:${signal.severity}`,
    `op:${signal.operationKind}`,
  ];
  if (signal.outcome !== null) tags.push(`outcome:${signal.outcome}`);
  if (signal.shield.breachedLayerCount > 0) tags.push('shield:breached');
  if (signal.cascade.brokenChains > 0) tags.push('cascade:broken');
  if (signal.integrity.integrityStatus !== 'CLEAN') tags.push('integrity:dirty');

  const criticalIssues: string[] = [];
  if (signal.severity === 'CRITICAL') criticalIssues.push('tick result critical');
  if (signal.shield.breachedLayerCount >= 3) criticalIssues.push('all shield layers breached');
  if (signal.cascade.brokenChains > 5) criticalIssues.push('cascade collapse');
  if (signal.pressure.tier === 'T4') criticalIssues.push('pressure tier T4');

  const warnings: string[] = [];
  if (signal.integrity.warningCount > 0)
    warnings.push(`${signal.integrity.warningCount} integrity warning(s)`);
  if (signal.cascade.brokenChains > 0)
    warnings.push(`${signal.cascade.brokenChains} broken cascade chain(s)`);

  return Object.freeze({
    fingerprint: `${signal.runId}:${signal.tick}:${signal.checksum ?? 'nochk'}`,
    severity: signal.severity,
    healthScore: signal.healthScore,
    label: `tick-result[${signal.tick}] ${signal.severity}`,
    description: `Tick ${signal.tick} executed with ${signal.operationKind} — ${signal.severity} severity.`,
    operationKind: signal.operationKind,
    tags: Object.freeze(tags),
    criticalIssues: Object.freeze(criticalIssues),
    warnings: Object.freeze(warnings),
    emittedAtMs: nowMs(),
  });
}

/**
 * Builds a TickResultNarrationCompat from a TickResultSignalCompat.
 */
export function buildTickResultSignalNarrationHint(
  signal: TickResultSignalCompat,
): TickResultNarrationCompat {
  const urgencyMap: Record<TickResultSeverityCompat, string> = {
    LOW: 'nominal',
    MEDIUM: 'advisory',
    HIGH: 'elevated',
    CRITICAL: 'emergency',
  };

  const intentMap: Record<TickResultSeverityCompat, string> = {
    LOW: 'companion_idle',
    MEDIUM: 'companion_coaching',
    HIGH: 'companion_escalate',
    CRITICAL: 'companion_rescue',
  };

  const reactionMap: Record<TickResultSeverityCompat, string> = {
    LOW: 'audience_nominal',
    MEDIUM: 'audience_alert',
    HIGH: 'audience_excited',
    CRITICAL: 'audience_max_heat',
  };

  const heatMap: Record<TickResultSeverityCompat, number> = {
    LOW: 0.25,
    MEDIUM: 0.5,
    HIGH: 0.75,
    CRITICAL: 1.0,
  };

  return Object.freeze({
    phrase: signal.narrationPhrase,
    urgency: urgencyMap[signal.severity],
    mode: signal.mode,
    heatMultiplier: heatMap[signal.severity],
    companionIntent: intentMap[signal.severity],
    audienceReaction: reactionMap[signal.severity],
  });
}

/**
 * Builds a TickResultHealthSnapshotCompat from a TickResultSignalCompat.
 */
export function buildTickResultSignalHealthSnapshot(
  signal: TickResultSignalCompat,
): TickResultHealthSnapshotCompat {
  return Object.freeze({
    healthScore: signal.healthScore,
    severity: signal.severity,
    tier: signal.pressure.tier,
    integrityStatus: signal.integrity.integrityStatus,
    breachedLayerCount: signal.shield.breachedLayerCount,
    proofHash: signal.integrity.proofHash as Nullable<string>,
  });
}

/**
 * Builds a TickResultRunSummaryCompat from a TickResultSignalCompat.
 */
export function buildTickResultSignalRunSummary(
  signal: TickResultSignalCompat,
): TickResultRunSummaryCompat {
  return Object.freeze({
    runId: signal.runId,
    tick: signal.tick,
    phase: signal.phase,
    mode: signal.mode,
    outcome: signal.outcome,
    durationMs: signal.tickDurationMs,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// TREND ANALYSER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * TickResultSignalTrendAnalyzer
 *
 * Computes health and severity trends over a rolling window of signals.
 */
export class TickResultSignalTrendAnalyzer {
  private readonly window: TickResultSignalCompat[] = [];
  private readonly maxWindow: number;

  constructor(windowSize = 10) {
    this.maxWindow = windowSize;
  }

  /** Push a new signal into the rolling window. */
  public push(signal: TickResultSignalCompat): void {
    this.window.push(signal);
    if (this.window.length > this.maxWindow) {
      this.window.shift();
    }
  }

  /** Returns the current trend snapshot. */
  public getSnapshot(): TickResultTrendCompat {
    if (this.window.length === 0) {
      return Object.freeze({
        healthTrend: 0,
        dominantSeverity: 'LOW' as TickResultSeverityCompat,
        averageHealthScore: 0,
        windowSize: 0,
        degrading: false,
      });
    }

    const scores = this.window.map((s) => s.healthScore);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const trend = scores.length > 1 ? scores[scores.length - 1] - scores[0] : 0;

    const dist: Record<TickResultSeverityCompat, number> = {
      LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0,
    };
    for (const s of this.window) {
      dist[s.severity]++;
    }
    const dominant = (Object.entries(dist) as [TickResultSeverityCompat, number][])
      .sort((a, b) => b[1] - a[1])[0][0];

    return Object.freeze({
      healthTrend: trend,
      dominantSeverity: dominant,
      averageHealthScore: avg,
      windowSize: this.window.length,
      degrading: trend < -0.05,
    });
  }

  /** Resets the trend window. */
  public reset(): void {
    this.window.length = 0;
  }

  /** Returns health trend as array (oldest to newest). */
  public getHealthTrend(): readonly number[] {
    return Object.freeze(this.window.map((s) => s.healthScore));
  }

  /** Returns severity trend as array (oldest to newest). */
  public getSeverityTrend(): readonly TickResultSeverityCompat[] {
    return Object.freeze(this.window.map((s) => s.severity));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SESSION TRACKER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * TickResultSignalSessionTracker
 *
 * Tracks session-level history of TickResultSignalCompat objects.
 */
export class TickResultSignalSessionTracker {
  private readonly history: TickResultSignalCompat[] = [];
  private readonly maxHistory: number;

  constructor(maxHistory = 100) {
    this.maxHistory = maxHistory;
  }

  /** Record a new signal. */
  public record(signal: TickResultSignalCompat): void {
    this.history.push(signal);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  }

  /** Returns the session compat summary. */
  public getReport(): TickResultSessionCompat {
    const dist: Record<TickResultSeverityCompat, number> = {
      LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0,
    };
    let totalScore = 0;
    let latestTick = 0;

    for (const s of this.history) {
      dist[s.severity]++;
      totalScore += s.healthScore;
      if (s.tick > latestTick) latestTick = s.tick;
    }

    const n = this.history.length;
    return Object.freeze({
      totalRecorded: n,
      averageHealthScore: n > 0 ? totalScore / n : 0,
      latestTick,
      atCapacity: this.history.length >= this.maxHistory,
      severityDistribution: Object.freeze(dist),
    });
  }

  /** Returns the latest signal or null. */
  public getLatest(): TickResultSignalCompat | null {
    return this.history.length > 0 ? this.history[this.history.length - 1] : null;
  }

  /** Resets the history. */
  public reset(): void {
    this.history.length = 0;
  }

  /** Returns severity distribution. */
  public getSeverityDistribution(): Readonly<Record<TickResultSeverityCompat, number>> {
    return this.getReport().severityDistribution;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EVENT LOG
// ─────────────────────────────────────────────────────────────────────────────

/** Entry in the TickResultSignalEventLog. */
export interface TickResultSignalEventLogEntry {
  readonly tick: number;
  readonly runId: string;
  readonly severity: TickResultSeverityCompat;
  readonly operationKind: TickResultOperationKindCompat;
  readonly healthScore: number;
  readonly outcome: TickResultRunOutcomeCompat;
  readonly atMs: number;
}

/**
 * TickResultSignalEventLog
 *
 * Bounded event log for tick result signal events.
 */
export class TickResultSignalEventLog {
  private readonly entries: TickResultSignalEventLogEntry[] = [];
  private readonly maxEntries: number;

  constructor(maxEntries = 500) {
    this.maxEntries = maxEntries;
  }

  /** Appends an entry from a signal. */
  public append(signal: TickResultSignalCompat): void {
    const entry: TickResultSignalEventLogEntry = Object.freeze({
      tick: signal.tick,
      runId: signal.runId,
      severity: signal.severity,
      operationKind: signal.operationKind,
      healthScore: signal.healthScore,
      outcome: signal.outcome,
      atMs: nowMs(),
    });
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }
  }

  /** Returns all entries. */
  public getEntries(): readonly TickResultSignalEventLogEntry[] {
    return Object.freeze([...this.entries]);
  }

  /** Clears all entries. */
  public clear(): void {
    this.entries.length = 0;
  }

  /** Returns entries for a specific tick. */
  public getByTick(tick: number): readonly TickResultSignalEventLogEntry[] {
    return Object.freeze(this.entries.filter((e) => e.tick === tick));
  }

  /** Returns entries for a specific runId. */
  public getByRunId(runId: string): readonly TickResultSignalEventLogEntry[] {
    return Object.freeze(this.entries.filter((e) => e.runId === runId));
  }

  /** Returns a batch copy of all entries. */
  public toBatch(): readonly TickResultSignalEventLogEntry[] {
    return this.getEntries();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BATCH & DEDUPE UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Deduplicates a batch of TickResultSignalCompat by runId+tick uniqueness.
 * Returns the last signal seen for each runId+tick pair.
 */
export function deduplicateTickResultSignals(
  signals: readonly TickResultSignalCompat[],
): readonly TickResultSignalCompat[] {
  const seen = new Map<string, TickResultSignalCompat>();
  for (const s of signals) {
    seen.set(`${s.runId}:${s.tick}`, s);
  }
  return Object.freeze([...seen.values()]);
}

/**
 * Batch-translates a deduplicated list of signals through the default adapter.
 */
export function batchTranslateTickResultSignals(
  signals: readonly TickResultSignalCompat[],
  roomId: ChatRoomId,
  options?: TickResultBuilderSignalAdapterOptions,
): readonly TickResultTranslationResult[] {
  const adapter = new TickResultBuilderSignalAdapter(options);
  const deduped = deduplicateTickResultSignals(signals);
  return adapter.translateBatch(deduped, roomId);
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLETONS
// ─────────────────────────────────────────────────────────────────────────────

/** Default signal adapter (MEDIUM/HIGH/CRITICAL). */
export const TICK_RESULT_DEFAULT_SIGNAL_ADAPTER = new TickResultBuilderSignalAdapter({
  mode: 'DEFAULT',
});

/** Strict signal adapter (HIGH/CRITICAL only). */
export const TICK_RESULT_STRICT_SIGNAL_ADAPTER = new TickResultBuilderSignalAdapter({
  mode: 'STRICT',
});

/** Verbose signal adapter (all severities). */
export const TICK_RESULT_VERBOSE_SIGNAL_ADAPTER = new TickResultBuilderSignalAdapter({
  mode: 'VERBOSE',
});

/** Adapter module manifest. */
export const TICK_RESULT_SIGNAL_ADAPTER_MANIFEST: TickResultSignalAdapterManifest =
  Object.freeze({
    version: TICK_RESULT_SIGNAL_ADAPTER_VERSION,
    schema: TICK_RESULT_SIGNAL_ADAPTER_SCHEMA,
    ready: TICK_RESULT_SIGNAL_ADAPTER_READY,
    mode: 'DEFAULT' as TickResultAdapterMode,
    mlFeatureCount: TICK_RESULT_SIGNAL_ADAPTER_ML_FEATURE_COUNT,
    dlTensorShape: TICK_RESULT_SIGNAL_ADAPTER_DL_TENSOR_SHAPE,
    maxHeat: TICK_RESULT_SIGNAL_ADAPTER_MAX_HEAT,
    worldEventPrefix: TICK_RESULT_SIGNAL_WORLD_EVENT_PREFIX,
  });

// ─────────────────────────────────────────────────────────────────────────────
// FACTORY FUNCTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Factory function for creating a TickResultBuilderSignalAdapter with options.
 */
export function createTickResultBuilderSignalAdapter(
  options?: TickResultBuilderSignalAdapterOptions,
): TickResultBuilderSignalAdapter {
  return new TickResultBuilderSignalAdapter(options);
}

// ─────────────────────────────────────────────────────────────────────────────
// ADDITIONAL UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if a TickResultSignalCompat represents a terminal run state.
 */
export function isTickResultSignalTerminal(signal: TickResultSignalCompat): boolean {
  return signal.outcome !== null;
}

/**
 * Returns true if the signal represents a healthy tick (LOW severity).
 */
export function isTickResultSignalHealthy(signal: TickResultSignalCompat): boolean {
  return signal.severity === 'LOW';
}

/**
 * Returns true if the signal represents a critical tick.
 */
export function isTickResultSignalCritical(signal: TickResultSignalCompat): boolean {
  return signal.severity === 'CRITICAL';
}

/**
 * Computes a fingerprint string for a TickResultSignalCompat.
 */
export function fingerprintTickResultSignal(signal: TickResultSignalCompat): string {
  return [
    signal.runId,
    signal.tick,
    signal.checksum ?? 'nochk',
    signal.tickSeal ?? 'noseal',
    signal.integrity.integrityStatus,
    signal.severity,
    signal.operationKind,
  ].join(':');
}

/**
 * Returns a compact log string for a TickResultSignalCompat.
 */
export function formatTickResultSignalForLog(signal: TickResultSignalCompat): string {
  return (
    `[TickResultSignal] run=${signal.runId} tick=${signal.tick} ` +
    `op=${signal.operationKind} sev=${signal.severity} ` +
    `health=${signal.healthScore.toFixed(3)} mode=${signal.mode} ` +
    `phase=${signal.phase} outcome=${signal.outcome ?? 'null'} ` +
    `shield=${signal.shield.aggregateIntegrity.toFixed(0)} ` +
    `bots=${signal.battle.activeBots} chains=${signal.cascade.activeChains}`
  );
}

/**
 * Compares two TickResultSignalCompat objects by health score.
 * Returns negative if a is healthier than b, positive if b is healthier.
 */
export function compareTickResultSignalsByHealth(
  a: TickResultSignalCompat,
  b: TickResultSignalCompat,
): number {
  return b.healthScore - a.healthScore;
}

/**
 * Sorts a batch of signals from healthiest to least healthy.
 */
export function sortTickResultSignalsByHealth(
  signals: readonly TickResultSignalCompat[],
): readonly TickResultSignalCompat[] {
  return Object.freeze([...signals].sort(compareTickResultSignalsByHealth));
}

/**
 * Filters signals to those belonging to a specific runId.
 */
export function filterTickResultSignalsByRun(
  signals: readonly TickResultSignalCompat[],
  runId: string,
): readonly TickResultSignalCompat[] {
  return Object.freeze(signals.filter((s) => s.runId === runId));
}

/**
 * Filters signals to those matching a specific severity.
 */
export function filterTickResultSignalsBySeverity(
  signals: readonly TickResultSignalCompat[],
  severity: TickResultSeverityCompat,
): readonly TickResultSignalCompat[] {
  return Object.freeze(signals.filter((s) => s.severity === severity));
}

/**
 * Groups signals by severity.
 */
export function groupTickResultSignalsBySeverity(
  signals: readonly TickResultSignalCompat[],
): Readonly<Record<TickResultSeverityCompat, readonly TickResultSignalCompat[]>> {
  const groups: Record<TickResultSeverityCompat, TickResultSignalCompat[]> = {
    LOW: [], MEDIUM: [], HIGH: [], CRITICAL: [],
  };
  for (const s of signals) {
    groups[s.severity].push(s);
  }
  return Object.freeze({
    LOW: Object.freeze(groups.LOW),
    MEDIUM: Object.freeze(groups.MEDIUM),
    HIGH: Object.freeze(groups.HIGH),
    CRITICAL: Object.freeze(groups.CRITICAL),
  });
}

/**
 * Computes the average health score across a batch of signals.
 */
export function computeAverageTickResultSignalHealth(
  signals: readonly TickResultSignalCompat[],
): number {
  if (signals.length === 0) return 0;
  return signals.reduce((sum, s) => sum + s.healthScore, 0) / signals.length;
}

/**
 * Returns the signal with the highest health score in a batch.
 */
export function findBestTickResultSignal(
  signals: readonly TickResultSignalCompat[],
): TickResultSignalCompat | null {
  if (signals.length === 0) return null;
  return signals.reduce((best, s) =>
    s.healthScore > best.healthScore ? s : best,
  );
}

/**
 * Returns the signal with the lowest health score in a batch.
 */
export function findWorstTickResultSignal(
  signals: readonly TickResultSignalCompat[],
): TickResultSignalCompat | null {
  if (signals.length === 0) return null;
  return signals.reduce((worst, s) =>
    s.healthScore < worst.healthScore ? s : worst,
  );
}

/**
 * Validates that a TickResultSignalCompat has the required fields populated.
 * Returns an array of missing/invalid field names (empty = valid).
 */
export function validateTickResultSignal(
  signal: TickResultSignalCompat,
): readonly string[] {
  const errors: string[] = [];
  if (!signal.runId) errors.push('runId');
  if (typeof signal.tick !== 'number' || signal.tick < 0) errors.push('tick');
  if (!isTickResultSeverityCompat(signal.severity)) errors.push('severity');
  if (!isTickResultOperationKindCompat(signal.operationKind)) errors.push('operationKind');
  if (!isTickResultModeCompat(signal.mode)) errors.push('mode');
  if (typeof signal.healthScore !== 'number' || signal.healthScore < 0 || signal.healthScore > 1)
    errors.push('healthScore');
  if (!signal.mlVector) errors.push('mlVector');
  if (!signal.dlTensor) errors.push('dlTensor');
  return Object.freeze(errors);
}

/**
 * Builds a summary string for a batch translation result set.
 */
export function summarizeBatchTranslationResults(
  results: readonly TickResultTranslationResult[],
): string {
  const accepted = results.filter((r) => r.accepted).length;
  const rejected = results.filter((r) => !r.accepted).length;
  return `[BatchTranslation] total=${results.length} accepted=${accepted} rejected=${rejected}`;
}

/**
 * Returns all accepted envelopes from a batch translation result set.
 */
export function extractAcceptedEnvelopes(
  results: readonly TickResultTranslationResult[],
): readonly ChatInputEnvelope[] {
  return Object.freeze(
    results
      .filter((r) => r.accepted && r.envelope !== null)
      .map((r) => r.envelope as ChatInputEnvelope),
  );
}

/**
 * Returns all rejected signals from a batch translation result set.
 */
export function extractRejectedSignals(
  results: readonly TickResultTranslationResult[],
): readonly TickResultSignalCompat[] {
  return Object.freeze(
    results
      .filter((r) => !r.accepted && r.signal !== null)
      .map((r) => r.signal as TickResultSignalCompat),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADVANCED SIGNAL BUILDERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds a full TickResultSignalCompat from individual domain summaries.
 * Useful for manual signal construction in tests or diagnostics.
 */
export function buildTickResultSignalFromSummaries(
  runId: string,
  tick: number,
  mode: TickResultModeCompat,
  phase: TickResultRunPhaseCompat,
  battle: TickResultBattleSummaryCompat,
  shield: TickResultShieldSummaryCompat,
  cascade: TickResultCascadeSummaryCompat,
  pressure: TickResultPressureSummaryCompat,
  integrity: TickResultIntegritySummaryCompat,
  operationKind: TickResultOperationKindCompat,
): TickResultSignalCompat {
  // Compute health score from summaries
  const shieldScore = Math.min(1, shield.aggregateIntegrity / 1000);
  const totalChains = cascade.activeChains + cascade.brokenChains + cascade.completedChains;
  const cascadeScore = totalChains > 0 ? cascade.positiveChains / totalChains : 1;
  const tierIndex = ['T0', 'T1', 'T2', 'T3', 'T4'].indexOf(pressure.tier);
  const pressureScore = tierIndex >= 0 ? 1 - tierIndex / 4 : 0.5;
  const integrityScore = integrity.integrityStatus === 'CLEAN' ? 1 : 0;
  const warningPenalty = Math.min(0.2, integrity.warningCount * 0.02);
  const healthScore = Math.max(
    0,
    Math.min(1, shieldScore * 0.35 + cascadeScore * 0.2 + pressureScore * 0.25 + integrityScore * 0.2 - warningPenalty),
  );

  let severity: TickResultSeverityCompat;
  if (healthScore >= 0.75) severity = 'LOW';
  else if (healthScore >= 0.5) severity = 'MEDIUM';
  else if (healthScore >= 0.25) severity = 'HIGH';
  else severity = 'CRITICAL';

  const mlVector: TickResultMLVectorCompat = buildTickResultDefaultMLVector();
  const dlTensor = buildTickResultDefaultDLTensor();

  return Object.freeze({
    runId,
    tick,
    phase,
    mode,
    outcome: null,
    operationKind,
    severity,
    healthScore,
    tickDurationMs: 0,
    checksum: null,
    tickSeal: null,
    battle,
    shield,
    cascade,
    pressure,
    integrity,
    mlVector,
    dlTensor,
    narrationPhrase: `[${mode}] Tick ${tick} complete — ${severity} severity.`,
    signalCount: 0,
    eventCount: 0,
    traceCount: 0,
    engineHealthCount: 0,
  });
}

/**
 * Merges two TickResultSignalCompat objects, preferring fields from `override`.
 * Health score is recomputed from the merged integrity fields.
 */
export function mergeTickResultSignals(
  base: TickResultSignalCompat,
  override: Partial<TickResultSignalCompat>,
): TickResultSignalCompat {
  return Object.freeze({
    ...base,
    ...override,
  });
}

/**
 * Serialises a TickResultSignalCompat to compact JSON (excludes dlTensor for size).
 */
export function serializeTickResultSignal(signal: TickResultSignalCompat): string {
  return JSON.stringify({
    runId: signal.runId,
    tick: signal.tick,
    severity: signal.severity,
    operationKind: signal.operationKind,
    healthScore: signal.healthScore,
    mode: signal.mode,
    phase: signal.phase,
    outcome: signal.outcome,
    narrationPhrase: signal.narrationPhrase,
  });
}

/**
 * Returns a human-readable summary of a TickResultSignalAdapterManifest.
 */
export function summarizeTickResultSignalAdapterManifest(
  manifest: TickResultSignalAdapterManifest,
): string {
  return (
    `[TickResultSignalAdapterManifest] v=${manifest.version} ` +
    `schema=${manifest.schema} ready=${manifest.ready} ` +
    `mode=${manifest.mode} mlFeatures=${manifest.mlFeatureCount} ` +
    `dlShape=${manifest.dlTensorShape[0]}x${manifest.dlTensorShape[1]} ` +
    `maxHeat=${manifest.maxHeat} prefix=${manifest.worldEventPrefix}`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EXTENDED ANALYSIS — ML VECTOR DIFF & CENTROID
// ─────────────────────────────────────────────────────────────────────────────

/** 32 canonical ML feature label keys. */
const ML_VECTOR_KEYS: readonly (keyof TickResultMLVectorCompat)[] = Object.freeze([
  'tickNormalized', 'durationNormalized', 'activeBots01', 'pendingAttacks01',
  'shieldIntegrity01', 'breachedLayerRatio', 'activeChains01', 'brokenChains01',
  'completedChains01', 'positiveChains01', 'pressureScore01', 'pressureTier01',
  'outcomePresent', 'hasProofHash', 'integrityOk', 'warningCount01',
  'forkHintCount01', 'signalCount01', 'eventCount01', 'traceCount01',
  'engineHealthCount01', 'battleBotRatio', 'cascadePositiveRatio', 'shieldBreachRatio',
  'stepErrorCount01', 'stepWarningCount01', 'snapshotMutatedRatio', 'rollbackRatio',
  'modeNormalized', 'phaseNormalized', 'tickSealPresent', 'checksumPresent',
] as (keyof TickResultMLVectorCompat)[]);

/**
 * Flattens a TickResultMLVectorCompat to a Float32Array.
 */
export function flattenTickResultSignalMLVector(
  vec: TickResultMLVectorCompat,
): Float32Array {
  return Float32Array.from(ML_VECTOR_KEYS.map((k) => vec[k]));
}

/**
 * Computes cosine similarity between two TickResultMLVectorCompat objects.
 */
export function computeTickResultSignalMLSimilarity(
  a: TickResultMLVectorCompat,
  b: TickResultMLVectorCompat,
): number {
  const aFlat = flattenTickResultSignalMLVector(a);
  const bFlat = flattenTickResultSignalMLVector(b);
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < aFlat.length; i++) {
    dot  += aFlat[i] * bFlat[i];
    magA += aFlat[i] * aFlat[i];
    magB += bFlat[i] * bFlat[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Computes Euclidean distance between two TickResultMLVectorCompat objects.
 */
export function computeTickResultSignalMLDistance(
  a: TickResultMLVectorCompat,
  b: TickResultMLVectorCompat,
): number {
  const aFlat = flattenTickResultSignalMLVector(a);
  const bFlat = flattenTickResultSignalMLVector(b);
  let sum = 0;
  for (let i = 0; i < aFlat.length; i++) {
    const d = aFlat[i] - bFlat[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/**
 * Computes the elementwise delta vector (|b - a|) between two ML vectors.
 */
export function computeTickResultSignalMLDelta(
  a: TickResultMLVectorCompat,
  b: TickResultMLVectorCompat,
): TickResultMLVectorCompat {
  const result: Partial<Record<keyof TickResultMLVectorCompat, number>> = {};
  for (const k of ML_VECTOR_KEYS) {
    result[k] = Math.abs(b[k] - a[k]);
  }
  return Object.freeze(result) as TickResultMLVectorCompat;
}

/**
 * Computes the centroid ML vector from a list of signals.
 */
export function computeTickResultSignalMLCentroid(
  signals: readonly TickResultSignalCompat[],
): TickResultMLVectorCompat {
  if (signals.length === 0) return buildTickResultDefaultMLVector();
  const sums: Partial<Record<keyof TickResultMLVectorCompat, number>> = {};
  for (const k of ML_VECTOR_KEYS) sums[k] = 0;
  for (const s of signals) {
    for (const k of ML_VECTOR_KEYS) {
      sums[k] = (sums[k] ?? 0) + s.mlVector[k];
    }
  }
  const n = signals.length;
  const centroid: Partial<Record<keyof TickResultMLVectorCompat, number>> = {};
  for (const k of ML_VECTOR_KEYS) {
    centroid[k] = (sums[k] ?? 0) / n;
  }
  return Object.freeze(centroid) as TickResultMLVectorCompat;
}

/**
 * Returns the top N features by absolute value from a TickResultMLVectorCompat.
 */
export function getTopTickResultSignalMLFeatures(
  vec: TickResultMLVectorCompat,
  n: number,
): Array<{ label: string; value: number }> {
  const entries = ML_VECTOR_KEYS.map((k) => ({ label: k, value: vec[k] }));
  entries.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  return entries.slice(0, n);
}

// ─────────────────────────────────────────────────────────────────────────────
// DL TENSOR DIFF & UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Flattens a TickResultDLTensorCompat to a Float32Array of 13×8 = 104 elements.
 */
export function flattenTickResultSignalDLTensor(
  tensor: TickResultDLTensorCompat,
): Float32Array {
  const result = new Float32Array(tensor.length * 8);
  tensor.forEach((row, i) => {
    result[i * 8 + 0] = row.stepNormalized;
    result[i * 8 + 1] = row.durationMs01;
    result[i * 8 + 2] = row.emittedEvents01;
    result[i * 8 + 3] = row.snapshotMutated;
    result[i * 8 + 4] = row.rolledBack;
    result[i * 8 + 5] = row.skipped;
    result[i * 8 + 6] = row.errorCount01;
    result[i * 8 + 7] = row.warningCount01;
  });
  return result;
}

/**
 * Extracts a column (0-indexed) from a TickResultDLTensorCompat.
 */
export function extractTickResultSignalDLColumn(
  tensor: TickResultDLTensorCompat,
  col: number,
): Float32Array {
  return Float32Array.from(tensor.map((row) => {
    const vals = [
      row.stepNormalized, row.durationMs01, row.emittedEvents01,
      row.snapshotMutated, row.rolledBack, row.skipped,
      row.errorCount01, row.warningCount01,
    ];
    return vals[col] ?? 0;
  }));
}

/**
 * Serialises a TickResultDLTensorCompat to a compact JSON string.
 */
export function serializeTickResultSignalDLTensor(tensor: TickResultDLTensorCompat): string {
  return JSON.stringify(tensor);
}

/**
 * Computes a scalar health score from the DL tensor by averaging non-zero step
 * health contributions (inverse of error/rollback features).
 */
export function computeTickResultDLTensorHealthScore(
  tensor: TickResultDLTensorCompat,
): number {
  if (tensor.length === 0) return 0;
  const stepScores = tensor.map((row) => {
    const penalty = row.errorCount01 * 0.5 + row.rolledBack * 0.4 + row.warningCount01 * 0.1;
    return Math.max(0, 1 - penalty);
  });
  return stepScores.reduce((a, b) => a + b, 0) / stepScores.length;
}

// ─────────────────────────────────────────────────────────────────────────────
// BATCH DIFF REPORT
// ─────────────────────────────────────────────────────────────────────────────

/** Report produced by diffing two TickResultSignalCompat objects. */
export interface TickResultSignalDiffReport {
  readonly runId: string;
  readonly tickA: number;
  readonly tickB: number;
  readonly deltaTick: number;
  readonly deltaHealthScore: number;
  readonly severityChanged: boolean;
  readonly outcomeChanged: boolean;
  readonly modeChanged: boolean;
  readonly phaseChanged: boolean;
  readonly deltaShieldIntegrity: number;
  readonly deltaActiveBots: number;
  readonly deltaActiveChains: number;
  readonly deltaPressureScore: number;
  readonly mlSimilarity: number;
  readonly changedFields: readonly string[];
}

/**
 * Diffs two TickResultSignalCompat objects and returns a TickResultSignalDiffReport.
 */
export function diffTickResultSignals(
  a: TickResultSignalCompat,
  b: TickResultSignalCompat,
): TickResultSignalDiffReport {
  const changed: string[] = [];
  if (a.severity !== b.severity) changed.push('severity');
  if (a.outcome !== b.outcome) changed.push('outcome');
  if (a.mode !== b.mode) changed.push('mode');
  if (a.phase !== b.phase) changed.push('phase');
  if (a.checksum !== b.checksum) changed.push('checksum');
  if (a.tickSeal !== b.tickSeal) changed.push('tickSeal');
  if (a.battle.activeBots !== b.battle.activeBots) changed.push('battle.activeBots');
  if (a.battle.pendingAttacks !== b.battle.pendingAttacks) changed.push('battle.pendingAttacks');
  if (a.shield.aggregateIntegrity !== b.shield.aggregateIntegrity)
    changed.push('shield.aggregateIntegrity');
  if (a.cascade.activeChains !== b.cascade.activeChains) changed.push('cascade.activeChains');
  if (a.pressure.tier !== b.pressure.tier) changed.push('pressure.tier');
  if (a.integrity.integrityStatus !== b.integrity.integrityStatus)
    changed.push('integrity.integrityStatus');

  return Object.freeze({
    runId: a.runId,
    tickA: a.tick,
    tickB: b.tick,
    deltaTick: b.tick - a.tick,
    deltaHealthScore: b.healthScore - a.healthScore,
    severityChanged: a.severity !== b.severity,
    outcomeChanged: a.outcome !== b.outcome,
    modeChanged: a.mode !== b.mode,
    phaseChanged: a.phase !== b.phase,
    deltaShieldIntegrity: b.shield.aggregateIntegrity - a.shield.aggregateIntegrity,
    deltaActiveBots: b.battle.activeBots - a.battle.activeBots,
    deltaActiveChains: b.cascade.activeChains - a.cascade.activeChains,
    deltaPressureScore: b.pressure.score - a.pressure.score,
    mlSimilarity: computeTickResultSignalMLSimilarity(a.mlVector, b.mlVector),
    changedFields: Object.freeze(changed),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ENHANCED ANNOTATION BUNDLE
// ─────────────────────────────────────────────────────────────────────────────

/** Full annotation bundle for a TickResultSignalCompat. */
export interface TickResultSignalAnnotationBundle {
  readonly annotation: TickResultAnnotationCompat;
  readonly narration: TickResultNarrationCompat;
  readonly healthSnapshot: TickResultHealthSnapshotCompat;
  readonly runSummary: TickResultRunSummaryCompat;
  readonly mlVector: TickResultMLVectorCompat;
  readonly dlTensor: TickResultDLTensorCompat;
  readonly topMLFeatures: ReadonlyArray<{ label: string; value: number }>;
  readonly fingerpint: string;
}

/**
 * Builds a complete TickResultSignalAnnotationBundle from a signal.
 */
export function buildTickResultSignalAnnotationBundle(
  signal: TickResultSignalCompat,
): TickResultSignalAnnotationBundle {
  return Object.freeze({
    annotation: buildTickResultSignalAnnotation(signal),
    narration: buildTickResultSignalNarrationHint(signal),
    healthSnapshot: buildTickResultSignalHealthSnapshot(signal),
    runSummary: buildTickResultSignalRunSummary(signal),
    mlVector: extractTickResultSignalMLVector(signal),
    dlTensor: buildTickResultSignalDLTensor(signal),
    topMLFeatures: Object.freeze(
      getTopTickResultSignalMLFeatures(signal.mlVector, 5),
    ),
    fingerpint: fingerprintTickResultSignal(signal),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ADAPTER METRICS SNAPSHOT
// ─────────────────────────────────────────────────────────────────────────────

/** Snapshot of adapter metrics at a point in time. */
export interface TickResultAdapterMetricsSnapshot {
  readonly version: string;
  readonly mode: TickResultAdapterMode;
  readonly acceptedCount: number;
  readonly rejectedCount: number;
  readonly lastSignalAtMs: Nullable<number>;
  readonly acceptanceRate: number;
  readonly snapshotAtMs: number;
}

/**
 * Builds an adapter metrics snapshot from diagnostics output.
 */
export function buildTickResultAdapterMetricsSnapshot(
  diagnostics: ReturnType<TickResultBuilderSignalAdapter['diagnostics']>,
): TickResultAdapterMetricsSnapshot {
  const total = diagnostics.acceptedCount + diagnostics.rejectedCount;
  return Object.freeze({
    version: diagnostics.version,
    mode: diagnostics.mode,
    acceptedCount: diagnostics.acceptedCount,
    rejectedCount: diagnostics.rejectedCount,
    lastSignalAtMs: diagnostics.lastSignalAtMs as Nullable<number>,
    acceptanceRate: total > 0 ? diagnostics.acceptedCount / total : 0,
    snapshotAtMs: nowMs(),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT BUNDLE
// ─────────────────────────────────────────────────────────────────────────────

/** Complete export bundle for a translated tick result signal. */
export interface TickResultSignalExportBundle {
  readonly schemaVersion: string;
  readonly adapterVersion: string;
  readonly signal: TickResultSignalCompat;
  readonly translationResult: TickResultTranslationResult;
  readonly annotationBundle: TickResultSignalAnnotationBundle;
  readonly dlTensorFlat: Float32Array;
  readonly mlVectorFlat: Float32Array;
  readonly serializedSignal: string;
  readonly builtAtMs: number;
}

/**
 * Builds a complete export bundle for a signal and its translation result.
 */
export function buildTickResultSignalExportBundle(
  signal: TickResultSignalCompat,
  translationResult: TickResultTranslationResult,
): TickResultSignalExportBundle {
  return Object.freeze({
    schemaVersion: TICK_RESULT_SIGNAL_ADAPTER_SCHEMA,
    adapterVersion: TICK_RESULT_SIGNAL_ADAPTER_VERSION,
    signal,
    translationResult,
    annotationBundle: buildTickResultSignalAnnotationBundle(signal),
    dlTensorFlat: flattenTickResultSignalDLTensor(signal.dlTensor),
    mlVectorFlat: flattenTickResultSignalMLVector(signal.mlVector),
    serializedSignal: serializeTickResultSignal(signal),
    builtAtMs: nowMs(),
  });
}

/**
 * Returns a compact human-readable summary of a TickResultSignalExportBundle.
 */
export function summarizeTickResultSignalExportBundle(
  bundle: TickResultSignalExportBundle,
): string {
  return (
    `[SignalExportBundle] run=${bundle.signal.runId} tick=${bundle.signal.tick} ` +
    `sev=${bundle.signal.severity} health=${bundle.signal.healthScore.toFixed(3)} ` +
    `accepted=${bundle.translationResult.accepted} ` +
    `builtAt=${bundle.builtAtMs}`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE MANIFEST & VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if the adapter module is healthy (ready flag set).
 */
export function isTickResultSignalAdapterReady(): boolean {
  return TICK_RESULT_SIGNAL_ADAPTER_READY;
}

/**
 * Returns a full readiness report for the adapter module.
 */
export function getTickResultSignalAdapterReadinessReport(): {
  ready: boolean;
  version: string;
  schema: string;
  singletonsInitialized: boolean;
  mlFeatureCount: number;
  dlTensorShape: readonly [number, number];
} {
  return Object.freeze({
    ready: TICK_RESULT_SIGNAL_ADAPTER_READY,
    version: TICK_RESULT_SIGNAL_ADAPTER_VERSION,
    schema: TICK_RESULT_SIGNAL_ADAPTER_SCHEMA,
    singletonsInitialized:
      TICK_RESULT_DEFAULT_SIGNAL_ADAPTER !== undefined &&
      TICK_RESULT_STRICT_SIGNAL_ADAPTER !== undefined &&
      TICK_RESULT_VERBOSE_SIGNAL_ADAPTER !== undefined,
    mlFeatureCount: TICK_RESULT_SIGNAL_ADAPTER_ML_FEATURE_COUNT,
    dlTensorShape: TICK_RESULT_SIGNAL_ADAPTER_DL_TENSOR_SHAPE,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// END OF FILE
// ─────────────────────────────────────────────────────────────────────────────
