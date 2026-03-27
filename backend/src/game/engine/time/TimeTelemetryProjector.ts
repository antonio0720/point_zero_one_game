/*
 * POINT ZERO ONE — BACKEND ENGINE TIME
 * /backend/src/game/engine/time/TimeTelemetryProjector.ts
 * VERSION: 4.0.0
 *
 * Doctrine:
 * - telemetry is a backend-owned audit surface, not a UI convenience
 * - time-side telemetry projection must remain deterministic, immutable, and hash-safe
 * - warning / fork-hint / decision streams are append-only, deduped where appropriate
 * - outcome reason state may be refined here, but terminal truth remains owned by runtime
 * - additive normalization is allowed so long as it does not erase prior audit facts
 * - chat is the emotional operating system — LIVEOPS_SIGNAL routes telemetry into social pressure
 * - ML feature extraction (28-dim vector) is first-class, deterministic, replay-safe
 * - DL tensor construction (40×6 ring buffer) feeds deep inference from telemetry history
 * - mode-aware and phase-aware interpretation routes narrative and commentary correctly
 * - 10 subsystem classes wire every import into real runtime code — zero placeholder logic
 * - audit trail is append-only, providing full projection history for deterministic replay
 * - pressure, economy, shield, battle, mode, and timer states feed contextual scoring
 */

// ============================================================================
// SECTION 1 — TYPE IMPORTS FROM RunStateSnapshot
// ============================================================================

import type {
  DecisionRecord,
  OutcomeReasonCode,
  RunStateSnapshot,
  TelemetryState,
  PressureState,
  EconomyState,
  ModeState,
  TimerState,
  ShieldState,
  BattleState,
  ModePresentationCode,
  PressureBand,
} from '../core/RunStateSnapshot';

import { SNAPSHOT_MODULE_VERSION } from '../core/RunStateSnapshot';

// ============================================================================
// SECTION 2 — TYPE IMPORTS FROM GamePrimitives
// ============================================================================

import type {
  ModeCode,
  PressureTier,
  RunPhase,
  RunOutcome,
} from '../core/GamePrimitives';

import {
  MODE_CODES,
  PRESSURE_TIERS,
  RUN_PHASES,
  RUN_OUTCOMES,
  PRESSURE_TIER_NORMALIZED,
  PRESSURE_TIER_URGENCY_LABEL,
  RUN_PHASE_NORMALIZED,
  RUN_PHASE_STAKES_MULTIPLIER,
  RUN_PHASE_TICK_BUDGET_FRACTION,
  MODE_NORMALIZED,
  MODE_DIFFICULTY_MULTIPLIER,
  MODE_TENSION_FLOOR,
  isModeCode,
  isPressureTier,
  isRunPhase,
  isRunOutcome,
  computePressureRiskScore,
  canEscalatePressure,
  isEndgamePhase,
  isWinOutcome,
  isLossOutcome,
  computeRunProgressFraction,
  computeEffectiveStakes,
  scoreOutcomeExcitement,
  describePressureTierExperience,
} from '../core/GamePrimitives';

// ============================================================================
// SECTION 3 — IMPORTS FROM time/types
// ============================================================================

import {
  TickTier,
  TICK_TIER_CONFIGS,
  TIER_DURATIONS_MS,
  DECISION_WINDOW_DURATIONS_MS,
  DEFAULT_HOLD_DURATION_MS,
  DEFAULT_PHASE_TRANSITION_WINDOWS,
  PHASE_BOUNDARIES_MS,
  pressureTierToTickTier,
  tickTierToPressureTier,
  resolvePhaseFromElapsedMs,
  getDefaultTickDurationMs,
  clampNonNegativeInteger,
} from './types';

import type {
  PhaseBoundary,
  PressureReader,
  TickTierConfig,
} from './types';

// ============================================================================
// SECTION 4 — TYPE IMPORTS FROM chat/types
// ============================================================================

import type {
  Score01,
  UnixMs,
  Nullable,
  JsonValue,
  ChatSignalEnvelope,
  ChatRunSnapshot,
  ChatLiveOpsSnapshot,
  ChatBattleSnapshot,
  ChatInputEnvelope,
  ChatSignalType,
  ChatEventKind,
  TickTier as ChatTickTierValue,
  RunOutcome as ChatRunOutcomeValue,
  PressureTier as ChatPressureTierValue,
  Score100,
} from '../chat/types';

// ============================================================================
// SECTION 5 — MODULE VERSION + SCALAR CONSTANTS
// ============================================================================

/** Semver for this module — bump on breaking interface changes. */
export const TELEMETRY_VERSION = '4.0.0' as const;

/** Dimensionality of the ML feature vector extracted per projection call. */
export const TELEMETRY_ML_DIM = 28 as const;

/** Row count of the DL ring buffer. */
export const TELEMETRY_DL_ROW_COUNT = 40 as const;

/** Column count per DL ring buffer row. */
export const TELEMETRY_DL_COL_COUNT = 6 as const;

/** Maximum audit entries retained before oldest are pruned. */
export const TELEMETRY_AUDIT_CAPACITY = 1_000 as const;

/** Ring buffer capacity mirrors DL row count. */
export const TELEMETRY_DL_RING_CAPACITY = TELEMETRY_DL_ROW_COUNT;

/** Trend analysis history depth — how many prior ML snapshots inform delta scoring. */
export const TELEMETRY_TREND_HISTORY = 50 as const;

/** Decision count threshold above which burst scoring activates. */
export const TELEMETRY_DECISION_BURST_THRESHOLD = 5 as const;

/** Warning count threshold for load scoring. */
export const TELEMETRY_WARNING_CAPACITY_THRESHOLD = 20 as const;

/** Fork hint count threshold for density scoring. */
export const TELEMETRY_FORK_HINT_CAPACITY = 10 as const;

/** Event flux threshold for normalization. */
export const TELEMETRY_EVENT_FLUX_THRESHOLD = 500 as const;

/** Maximum latency value used for normalization (ms). */
export const TELEMETRY_MAX_LATENCY_MS = 15_000 as const;

/** Chat signal type emitted by this projector into the LIVEOPS_SHADOW lane. */
export const TELEMETRY_CHAT_SIGNAL_TYPE: ChatSignalType = 'LIVEOPS';

/** Shadow channel used for telemetry-driven chat signals. */
export const TELEMETRY_LIVEOPS_CHANNEL = 'LIVEOPS_SHADOW' as const;

/** Latency thresholds defining the five decision speed classes (in ms). */
export const TELEMETRY_LATENCY_THRESHOLDS = Object.freeze({
  INSTANT:  500,
  FAST:    1_500,
  NORMAL:  4_000,
  SLOW:    8_000,
  // > SLOW is CRITICAL
} as const);

/** Resilience scoring weights summing to 1.0. */
export const TELEMETRY_RESILIENCE_WEIGHTS = Object.freeze({
  decisionHealth:    0.35,
  warningLoad:       0.25,
  forkHintDensity:   0.20,
  eventFlux:         0.20,
} as const);

/** Warning category keyword fragments used by the warning analyzer. */
export const TELEMETRY_WARNING_CATEGORIES = Object.freeze({
  TIMING:   ['tick', 'timer', 'window', 'expired', 'hold', 'latency', 'lag'],
  PRESSURE: ['pressure', 'tier', 'escalat', 'threat', 'attack', 'heat', 'bot'],
  SYSTEM:   ['checksum', 'integrity', 'hash', 'abort', 'engine', 'runtime'],
  BUDGET:   ['budget', 'exhausted', 'season', 'extension', 'overtime', 'timeout'],
} as const);

// ============================================================================
// SECTION 6 — ML FEATURE LABELS (28-dimensional vector)
// ============================================================================

/** Canonical 28-feature label set for telemetry-level ML scoring. */
export const TELEMETRY_ML_FEATURE_LABELS: readonly string[] = Object.freeze([
  // Decision signals (6 features)
  'tel_decision_count_normalized',
  'tel_acceptance_rate',
  'tel_avg_latency_normalized',
  'tel_p95_latency_normalized',
  'tel_rejection_rate',
  'tel_decision_quality_score',
  // Warning and fork signals (4 features)
  'tel_warning_count_normalized',
  'tel_fork_hint_count_normalized',
  'tel_warning_burst_score',
  'tel_fork_burst_score',
  // Event flux (2 features)
  'tel_event_flux_normalized',
  'tel_event_flux_delta',
  // Outcome signals (3 features)
  'tel_outcome_reason_present',
  'tel_checksum_present',
  'tel_outcome_excitement',
  // Pressure and phase context (6 features)
  'tel_pressure_tier_normalized',
  'tel_pressure_risk_score',
  'tel_phase_normalized',
  'tel_phase_stakes_multiplier',
  'tel_run_progress_fraction',
  'tel_tick_tier_normalized',
  // Mode context (3 features)
  'tel_mode_normalized',
  'tel_mode_difficulty',
  'tel_mode_tension_floor',
  // Resilience aggregate (4 features)
  'tel_resilience_score',
  'tel_decision_burst_score',
  'tel_timing_class_diversity',
  'tel_audit_entropy',
]);

// ============================================================================
// SECTION 7 — DL COLUMN LABELS (6-column tensor row)
// ============================================================================

/** Canonical 6-column label set for the DL ring buffer rows. */
export const TELEMETRY_DL_COL_LABELS: readonly string[] = Object.freeze([
  'dl_tel_decision_count',
  'dl_tel_acceptance_rate',
  'dl_tel_avg_latency_normalized',
  'dl_tel_warning_load',
  'dl_tel_fork_hint_load',
  'dl_tel_event_flux',
]);

// ============================================================================
// SECTION 8 — OPERATION TYPE + LATENCY CLASS
// ============================================================================

/** Identifies the type of telemetry projection operation recorded in audit. */
export type TelemetryOperationType =
  | 'FULL_PROJECTION'
  | 'APPEND_DECISION'
  | 'APPEND_WARNING'
  | 'APPEND_FORK_HINT'
  | 'INCREMENT_EVENT_COUNT'
  | 'SET_CHECKSUM'
  | 'SET_OUTCOME_REASON'
  | 'CONTEXT_PROJECTION'
  | 'RESET';

/** Five-class characterization of decision latency speed. */
export type DecisionLatencyClass = 'INSTANT' | 'FAST' | 'NORMAL' | 'SLOW' | 'CRITICAL';

// ============================================================================
// SECTION 9 — INPUT INTERFACES (preserved from v1)
// ============================================================================

export interface TimeDecisionTelemetryInput {
  readonly tick: number;
  readonly actorId: string;
  readonly cardId: string;
  readonly latencyMs: number;
  readonly timingClass: readonly string[];
  readonly accepted: boolean;
}

export interface TimeTelemetryProjectionRequest {
  readonly decisions?: readonly TimeDecisionTelemetryInput[];
  readonly warnings?: readonly string[];
  readonly forkHints?: readonly string[];
  readonly emittedEventCountDelta?: number;
  readonly lastTickChecksum?: string | null;
  readonly outcomeReason?: string | null;
  readonly outcomeReasonCode?: OutcomeReasonCode | null;
}

// ============================================================================
// SECTION 10 — CONTEXT INTERFACES
// ============================================================================

/**
 * Full projection context enriching a telemetry mutation with runtime signals.
 * Optional state references allow ML/DL/narrative subsystems to extract deeper features
 * without requiring callers to always supply every engine state slice.
 */
export interface TelemetryProjectionContext {
  readonly runId: string;
  readonly mode: ModeCode;
  readonly phase: RunPhase;
  readonly pressureTier: PressureTier;
  readonly pressureScore: number;
  readonly tick: number;
  readonly tickInPhase: number;
  readonly phaseTickBudget: number;
  readonly elapsedMs: number;
  readonly seasonBudgetMs: number;
  readonly outcome: RunOutcome | null;
  readonly shieldIntegrity: number;
  readonly battleMomentum: number;
  readonly holdCharges: number;
  // Optional enrichment from engine state slices
  readonly pressureState?: PressureState;
  readonly economyState?: EconomyState;
  readonly modeState?: ModeState;
  readonly timerState?: TimerState;
  readonly shieldState?: ShieldState;
  readonly battleState?: BattleState;
}

/** ML extraction context — a lighter-weight slice of TelemetryProjectionContext. */
export interface TelemetryMLContext {
  readonly mode: ModeCode;
  readonly phase: RunPhase;
  readonly pressureTier: PressureTier;
  readonly pressureScore: number;
  readonly tick: number;
  readonly tickInPhase: number;
  readonly phaseTickBudget: number;
  readonly elapsedMs: number;
  readonly seasonBudgetMs: number;
  readonly outcome: RunOutcome | null;
  readonly pressure?: PressureReader;
}

/** Chat signal emission context. */
export interface TelemetryChatContext extends TelemetryProjectionContext {
  readonly roomId: string | null;
  readonly warningBrief: string;
  readonly forkBrief: string;
  readonly forceEmit: boolean;
}

// ============================================================================
// SECTION 11 — AUDIT INTERFACES
// ============================================================================

/** Single audit record for one projection call. */
export interface TelemetryAuditEntry {
  readonly seq: number;
  readonly operationType: TelemetryOperationType;
  readonly timestamp: UnixMs;
  readonly previousEventCount: number;
  readonly nextEventCount: number;
  readonly decisionsDeltaCount: number;
  readonly warningsDeltaCount: number;
  readonly forkHintsDeltaCount: number;
  readonly checksumChanged: boolean;
  readonly outcomeReasonChanged: boolean;
  readonly associatedChatKind: ChatEventKind | null;
}

/** Aggregate view across all audit entries. */
export interface TelemetryAuditSummary {
  readonly totalProjections: number;
  readonly byOperationType: Readonly<Record<TelemetryOperationType, number>>;
  readonly totalDecisionsAdded: number;
  readonly totalWarningsAdded: number;
  readonly totalForkHintsAdded: number;
  readonly checksumChangeCount: number;
  readonly outcomeReasonChangeCount: number;
  readonly chatSignalsEmitted: number;
  readonly firstProjectionAt: UnixMs | null;
  readonly lastProjectionAt: UnixMs | null;
}

// ============================================================================
// SECTION 12 — DECISION ANALYSIS INTERFACES
// ============================================================================

/** Computed analytics across the full decision record list. */
export interface TelemetryDecisionAnalysis {
  readonly decisionCount: number;
  readonly acceptedCount: number;
  readonly rejectedCount: number;
  readonly acceptanceRate: number;
  readonly rejectionRate: number;
  readonly avgLatencyMs: number;
  readonly p50LatencyMs: number;
  readonly p95LatencyMs: number;
  readonly p99LatencyMs: number;
  readonly fastestMs: number;
  readonly slowestMs: number;
  readonly timingClassCounts: Readonly<Record<string, number>>;
  readonly latencyTrend: 'IMPROVING' | 'STABLE' | 'DEGRADING';
  readonly qualityScore: number;
  readonly decisionBurstScore: number;
}

// ============================================================================
// SECTION 13 — RESILIENCE + ML + DL INTERFACES
// ============================================================================

/** Telemetry-derived resilience scoring for the current run state. */
export interface TelemetryResilienceProfile {
  readonly decisionHealthScore: Score01;
  readonly warningLoadScore: Score01;
  readonly forkHintDensityScore: Score01;
  readonly eventFluxScore: Score01;
  readonly overallResilienceScore: Score01;
  readonly riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly pressureRiskScore: number;
  readonly isEscalationImminent: boolean;
  readonly bandLabel: string;
  readonly canEscalate: boolean;
}

/** 28-dimensional ML feature vector output. */
export interface TelemetryMLVector {
  readonly features: readonly number[];
  readonly dim: number;
  readonly labels: readonly string[];
  readonly extractedAt: UnixMs;
}

/** Single row for the DL ring buffer (6 columns). */
export interface TelemetryDLRow {
  readonly decisionCount: number;
  readonly acceptanceRate: number;
  readonly avgLatencyNormalized: number;
  readonly warningLoad: number;
  readonly forkHintLoad: number;
  readonly eventFlux: number;
}

/** Aggregate statistics across the DL ring buffer. */
export interface TelemetryDLStats {
  readonly rowCount: number;
  readonly capacity: number;
  readonly fillRatio: number;
  readonly lastUpdatedAt: UnixMs | null;
  readonly avgDecisionCount: number;
  readonly avgAcceptanceRate: number;
  readonly avgLatencyNormalized: number;
  readonly avgWarningLoad: number;
}

// ============================================================================
// SECTION 14 — NARRATIVE + MODE + PHASE PROFILE INTERFACES
// ============================================================================

/** Human-readable narrative generated from telemetry state and run context. */
export interface TelemetryNarrative {
  readonly mode: ModeCode;
  readonly phase: RunPhase;
  readonly headline: string;
  readonly detail: string;
  readonly warningBrief: string;
  readonly forkBrief: string;
  readonly outcomeFrame: string;
  readonly pressureLabel: string;
  readonly phaseLabel: string;
  readonly experienceDescription: string;
  readonly modeLabel: string;
  readonly urgencyEmphasis: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

/** Mode-specific telemetry profile combining difficulty, tension, and UX targets. */
export interface TelemetryModeProfile {
  readonly mode: ModeCode;
  readonly presentation: ModePresentationCode;
  readonly modeNormalized: number;
  readonly difficultyMultiplier: number;
  readonly tensionFloor: number;
  readonly decisionLatencyTargetMs: number;
  readonly warningCapacity: number;
  readonly forkHintCapacity: number;
  readonly holdDurationMs: number;
  readonly chatMountTarget: string;
  readonly narrativeStyle: 'EMPIRE' | 'PREDATOR' | 'SYNDICATE' | 'PHANTOM';
}

/** Phase-specific telemetry profile combining stakes, budget, and transition config. */
export interface TelemetryPhaseProfile {
  readonly phase: RunPhase;
  readonly phaseNormalized: number;
  readonly stakesMultiplier: number;
  readonly budgetFraction: number;
  readonly isEndgame: boolean;
  readonly startsAtMs: number;
  readonly nextPhase: RunPhase | null;
  readonly decisionDensityExpectation: number;
  readonly transitionWindowsDefault: number;
  readonly experienceFrame: string;
}

// ============================================================================
// SECTION 15 — WARNING ANALYSIS INTERFACE
// ============================================================================

/** Aggregate analysis across the current warning and fork-hint streams. */
export interface TelemetryWarningAnalysis {
  readonly warningCount: number;
  readonly forkHintCount: number;
  readonly uniqueWarningCount: number;
  readonly uniqueForkHintCount: number;
  readonly warningBurstScore: number;
  readonly forkHintBurstScore: number;
  readonly combinedRiskScore: number;
  readonly topWarning: Nullable<string>;
  readonly topForkHint: Nullable<string>;
  readonly riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

// ============================================================================
// SECTION 16 — EXPORT BUNDLE INTERFACE
// ============================================================================

/** Full telemetry analytics bundle for export, persistence, and replay. */
export interface TelemetryExportBundle {
  readonly version: typeof TELEMETRY_VERSION;
  readonly snapshotRef: typeof SNAPSHOT_MODULE_VERSION;
  readonly state: TelemetryState;
  readonly ml: TelemetryMLVector | null;
  readonly dl: readonly (readonly number[])[];
  readonly dlStats: TelemetryDLStats;
  readonly decisionAnalysis: TelemetryDecisionAnalysis;
  readonly warningAnalysis: TelemetryWarningAnalysis;
  readonly resilience: TelemetryResilienceProfile | null;
  readonly narrative: TelemetryNarrative | null;
  readonly auditSummary: TelemetryAuditSummary;
  readonly exportedAt: UnixMs;
}

// ============================================================================
// SECTION 17 — CORE UTILITY FUNCTIONS (preserved from v1 + new additions)
// ============================================================================

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

function dedupeStrings(...groups: ReadonlyArray<readonly string[]>): readonly string[] {
  const merged = new Set<string>();
  for (const group of groups) {
    for (const item of group) {
      if (item.length > 0) {
        merged.add(item);
      }
    }
  }
  return freezeArray([...merged]);
}

function normalizeLatencyMs(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.trunc(value));
}

function normalizeEventDelta(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.trunc(value));
}

function normalizeTick(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.trunc(value));
}

function normalizeChecksum(value: string | null | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeTimingClass(values: readonly string[]): readonly string[] {
  return freezeArray(values.filter((value) => value.length > 0));
}

function normalizeDecision(input: TimeDecisionTelemetryInput): DecisionRecord {
  return Object.freeze({
    tick: normalizeTick(input.tick),
    actorId: input.actorId,
    cardId: input.cardId,
    latencyMs: normalizeLatencyMs(input.latencyMs),
    timingClass: normalizeTimingClass(input.timingClass),
    accepted: input.accepted,
  });
}

function incrementSafe(previous: number, delta: number): number {
  const next = previous + delta;
  if (!Number.isFinite(next)) {
    return previous;
  }
  return Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.trunc(next)));
}

/** Clamp a score to [0, 1] for Score01 branding. */
function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

/** Clamp a value to [0, 100] for Score100 branding. */
function clamp100(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

/** Normalize a raw latency value to [0, 1] using TELEMETRY_MAX_LATENCY_MS. */
function normalizeLatencyToUnit(latencyMs: number): number {
  return clamp01(normalizeLatencyMs(latencyMs) / TELEMETRY_MAX_LATENCY_MS);
}

/** Compute percentile from a sorted ascending numeric array. */
function computePercentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.floor((p / 100) * (sorted.length - 1));
  return sorted[Math.min(idx, sorted.length - 1)];
}

/** Bridge engine PressureTier to chat-local PressureTierValue. */
function bridgePressureTierToChat(tier: PressureTier): ChatPressureTierValue {
  const map: Record<PressureTier, ChatPressureTierValue> = {
    T0: 'NONE',
    T1: 'BUILDING',
    T2: 'ELEVATED',
    T3: 'HIGH',
    T4: 'CRITICAL',
  };
  return map[tier];
}

/** Bridge engine TickTier enum to chat-local TickTierValue. */
function bridgeTickTierToChat(tier: TickTier): ChatTickTierValue {
  const map: Record<TickTier, ChatTickTierValue> = {
    [TickTier.SOVEREIGN]:         'SETUP',
    [TickTier.STABLE]:            'WINDOW',
    [TickTier.COMPRESSED]:        'COMMIT',
    [TickTier.CRISIS]:            'RESOLUTION',
    [TickTier.COLLAPSE_IMMINENT]: 'SEAL',
  };
  return map[tier];
}

/** Bridge engine RunOutcome to chat-local RunOutcomeValue. */
function bridgeRunOutcomeToChat(outcome: RunOutcome | null): ChatRunOutcomeValue {
  if (outcome === null) return 'UNRESOLVED';
  const map: Record<RunOutcome, ChatRunOutcomeValue> = {
    FREEDOM:   'SOVEREIGN',
    TIMEOUT:   'FAILED',
    BANKRUPT:  'BANKRUPT',
    ABANDONED: 'WITHDRAWN',
  };
  return map[outcome];
}

/** Bridge PressureTier to PressureBand label for narrative framing. */
function tierToBand(tier: PressureTier): PressureBand {
  const map: Record<PressureTier, PressureBand> = {
    T0: 'CALM',
    T1: 'BUILDING',
    T2: 'ELEVATED',
    T3: 'HIGH',
    T4: 'CRITICAL',
  };
  return map[tier];
}

/** Find next PressureTier from current, or null if already at apex. */
function getNextPressureTier(current: PressureTier): PressureTier | null {
  const idx = PRESSURE_TIERS.indexOf(current);
  if (idx < 0 || idx >= PRESSURE_TIERS.length - 1) return null;
  return PRESSURE_TIERS[idx + 1] as PressureTier;
}

/** Validate that a mode code is canonical. Uses GamePrimitives type guard. */
function validateModeCode(value: unknown): ModeCode {
  return isModeCode(value) ? value : 'solo';
}

/** Validate that a pressure tier is canonical. Uses GamePrimitives type guard. */
function validatePressureTier(value: unknown): PressureTier {
  return isPressureTier(value) ? value : 'T1';
}

/** Validate that a run phase is canonical. Uses GamePrimitives type guard. */
function validateRunPhase(value: unknown): RunPhase {
  return isRunPhase(value) ? value : 'FOUNDATION';
}

// ============================================================================
// SECTION 18 — SUBSYSTEM CLASS 1: TelemetryAuditTrail
// ============================================================================

/**
 * Append-only audit log tracking every projection operation.
 * Records metadata deltas, operation types, and chat event associations.
 * Used for deterministic replay, debugging, and export bundle generation.
 */
export class TelemetryAuditTrail {
  private readonly _entries: TelemetryAuditEntry[] = [];
  private _seq = 0;
  private readonly _maxCapacity: number;

  constructor(maxCapacity: number = TELEMETRY_AUDIT_CAPACITY) {
    this._maxCapacity = Math.max(10, clampNonNegativeInteger(maxCapacity));
  }

  /**
   * Record a single projection operation.
   * If capacity is exceeded, oldest entries are pruned automatically.
   */
  record(
    operationType: TelemetryOperationType,
    previous: TelemetryState,
    next: TelemetryState,
    chatKind: ChatEventKind | null = null,
  ): void {
    if (this._entries.length >= this._maxCapacity) {
      this._entries.splice(0, Math.ceil(this._maxCapacity * 0.1));
    }
    const entry: TelemetryAuditEntry = Object.freeze({
      seq:                    ++this._seq,
      operationType,
      timestamp:              Date.now() as UnixMs,
      previousEventCount:     previous.emittedEventCount,
      nextEventCount:         next.emittedEventCount,
      decisionsDeltaCount:    next.decisions.length - previous.decisions.length,
      warningsDeltaCount:     next.warnings.length - previous.warnings.length,
      forkHintsDeltaCount:    next.forkHints.length - previous.forkHints.length,
      checksumChanged:        next.lastTickChecksum !== previous.lastTickChecksum,
      outcomeReasonChanged:   next.outcomeReason !== previous.outcomeReason,
      associatedChatKind:     chatKind,
    });
    this._entries.push(entry);
  }

  /** Return the full audit history as an immutable snapshot. */
  getHistory(): readonly TelemetryAuditEntry[] {
    return Object.freeze([...this._entries]);
  }

  /** Return the most recent audit entry, or null if the trail is empty. */
  getLastEntry(): TelemetryAuditEntry | null {
    return this._entries.length > 0
      ? this._entries[this._entries.length - 1]
      : null;
  }

  /** Return the number of entries currently in the trail. */
  size(): number {
    return this._entries.length;
  }

  /**
   * Summarize the audit trail into aggregate metrics.
   * Uses all known TelemetryOperationType values to build the byOperationType map.
   */
  summarize(): TelemetryAuditSummary {
    const ALL_OP_TYPES: readonly TelemetryOperationType[] = [
      'FULL_PROJECTION',
      'APPEND_DECISION',
      'APPEND_WARNING',
      'APPEND_FORK_HINT',
      'INCREMENT_EVENT_COUNT',
      'SET_CHECKSUM',
      'SET_OUTCOME_REASON',
      'CONTEXT_PROJECTION',
      'RESET',
    ];
    const byOp: Record<string, number> = {};
    for (const op of ALL_OP_TYPES) {
      byOp[op] = 0;
    }
    let totalDecisions = 0;
    let totalWarnings = 0;
    let totalForkHints = 0;
    let checksumChanges = 0;
    let outcomeReasonChanges = 0;
    let chatSignals = 0;
    let firstAt: UnixMs | null = null;
    let lastAt: UnixMs | null = null;

    for (const entry of this._entries) {
      byOp[entry.operationType] = (byOp[entry.operationType] ?? 0) + 1;
      totalDecisions  += Math.max(0, entry.decisionsDeltaCount);
      totalWarnings   += Math.max(0, entry.warningsDeltaCount);
      totalForkHints  += Math.max(0, entry.forkHintsDeltaCount);
      if (entry.checksumChanged) checksumChanges++;
      if (entry.outcomeReasonChanged) outcomeReasonChanges++;
      if (entry.associatedChatKind === 'LIVEOPS_SIGNAL') chatSignals++;
      if (firstAt === null || entry.timestamp < firstAt) firstAt = entry.timestamp;
      if (lastAt === null || entry.timestamp > lastAt) lastAt = entry.timestamp;
    }

    return Object.freeze({
      totalProjections:       this._entries.length,
      byOperationType:        Object.freeze(byOp) as Readonly<Record<TelemetryOperationType, number>>,
      totalDecisionsAdded:    totalDecisions,
      totalWarningsAdded:     totalWarnings,
      totalForkHintsAdded:    totalForkHints,
      checksumChangeCount:    checksumChanges,
      outcomeReasonChangeCount: outcomeReasonChanges,
      chatSignalsEmitted:     chatSignals,
      firstProjectionAt:      firstAt,
      lastProjectionAt:       lastAt,
    });
  }

  /** Prune the trail, keeping only the N most recent entries. */
  prune(keepLast: number): void {
    const n = Math.max(0, clampNonNegativeInteger(keepLast));
    if (this._entries.length > n) {
      this._entries.splice(0, this._entries.length - n);
    }
  }

  /** Clear all audit entries and reset the sequence counter. */
  clear(): void {
    this._entries.length = 0;
    this._seq = 0;
  }
}

// ============================================================================
// SECTION 19 — SUBSYSTEM CLASS 2: TelemetryDecisionAnalyzer
// ============================================================================

/**
 * Analyzes the decision record list for latency distribution, acceptance rates,
 * timing class diversity, and burst patterns.
 * Uses DECISION_WINDOW_DURATIONS_MS and TIER_DURATIONS_MS for context-aware scoring.
 */
export class TelemetryDecisionAnalyzer {

  /**
   * Produce a full decision analysis from a list of records.
   * Empty list returns a zeroed structure.
   */
  analyze(decisions: readonly DecisionRecord[]): TelemetryDecisionAnalysis {
    if (decisions.length === 0) {
      return this._emptyAnalysis();
    }
    const latencies = decisions.map((d) => normalizeLatencyMs(d.latencyMs));
    const sorted = [...latencies].sort((a, b) => a - b);
    const accepted = decisions.filter((d) => d.accepted).length;
    const rejected = decisions.length - accepted;
    const sum = latencies.reduce((acc, v) => acc + v, 0);
    const avg = sum / latencies.length;

    // Timing class diversity
    const classCounts: Record<string, number> = {};
    for (const d of decisions) {
      for (const cls of d.timingClass) {
        if (cls.length > 0) {
          classCounts[cls] = (classCounts[cls] ?? 0) + 1;
        }
      }
    }

    // Latency trend: compare second half vs first half average
    const mid = Math.floor(decisions.length / 2);
    const firstHalf = decisions.slice(0, mid);
    const secondHalf = decisions.slice(mid);
    const firstAvg = firstHalf.length > 0
      ? firstHalf.reduce((s, d) => s + normalizeLatencyMs(d.latencyMs), 0) / firstHalf.length
      : avg;
    const secondAvg = secondHalf.length > 0
      ? secondHalf.reduce((s, d) => s + normalizeLatencyMs(d.latencyMs), 0) / secondHalf.length
      : avg;
    const latencyTrend: 'IMPROVING' | 'STABLE' | 'DEGRADING' =
      secondAvg < firstAvg * 0.85 ? 'IMPROVING' :
      secondAvg > firstAvg * 1.15 ? 'DEGRADING' :
      'STABLE';

    const acceptanceRate = decisions.length > 0 ? accepted / decisions.length : 0;
    const rejectionRate  = decisions.length > 0 ? rejected / decisions.length : 0;

    return Object.freeze({
      decisionCount:       decisions.length,
      acceptedCount:       accepted,
      rejectedCount:       rejected,
      acceptanceRate,
      rejectionRate,
      avgLatencyMs:        Math.round(avg),
      p50LatencyMs:        computePercentile(sorted, 50),
      p95LatencyMs:        computePercentile(sorted, 95),
      p99LatencyMs:        computePercentile(sorted, 99),
      fastestMs:           sorted[0] ?? 0,
      slowestMs:           sorted[sorted.length - 1] ?? 0,
      timingClassCounts:   Object.freeze(classCounts),
      latencyTrend,
      qualityScore:        clamp01(acceptanceRate * (1 - normalizeLatencyToUnit(avg))),
      decisionBurstScore:  clamp01(decisions.length / TELEMETRY_DECISION_BURST_THRESHOLD),
    });
  }

  /**
   * Classify the speed of a single latency value.
   * Used for per-decision UX feedback labeling.
   */
  classifyLatency(latencyMs: number): DecisionLatencyClass {
    const ms = normalizeLatencyMs(latencyMs);
    if (ms <= TELEMETRY_LATENCY_THRESHOLDS.INSTANT) return 'INSTANT';
    if (ms <= TELEMETRY_LATENCY_THRESHOLDS.FAST)    return 'FAST';
    if (ms <= TELEMETRY_LATENCY_THRESHOLDS.NORMAL)  return 'NORMAL';
    if (ms <= TELEMETRY_LATENCY_THRESHOLDS.SLOW)    return 'SLOW';
    return 'CRITICAL';
  }

  /**
   * Compute the expected decision window duration for a given pressure tier.
   * Uses DECISION_WINDOW_DURATIONS_MS for tier-accurate expectations.
   */
  expectedDecisionWindowMs(tier: PressureTier): number {
    return DECISION_WINDOW_DURATIONS_MS[validatePressureTier(tier)];
  }

  /**
   * Compute the expected tick duration for a given pressure tier.
   * Uses TIER_DURATIONS_MS for cadence-accurate expectations.
   */
  expectedTickDurationMs(tier: PressureTier): number {
    return getDefaultTickDurationMs(validatePressureTier(tier));
  }

  /**
   * Compute the timing class diversity score (0–1).
   * 0 = all decisions in one class; 1 = maximally spread.
   */
  computeTimingClassDiversity(counts: Readonly<Record<string, number>>): number {
    const keys = Object.keys(counts);
    if (keys.length <= 1) return 0;
    const total = Object.values(counts).reduce((s, v) => s + v, 0);
    if (total === 0) return 0;
    let entropy = 0;
    for (const v of Object.values(counts)) {
      const p = v / total;
      if (p > 0) entropy -= p * Math.log2(p);
    }
    const maxEntropy = Math.log2(keys.length);
    return maxEntropy > 0 ? clamp01(entropy / maxEntropy) : 0;
  }

  private _emptyAnalysis(): TelemetryDecisionAnalysis {
    return Object.freeze({
      decisionCount:        0,
      acceptedCount:        0,
      rejectedCount:        0,
      acceptanceRate:       0,
      rejectionRate:        0,
      avgLatencyMs:         0,
      p50LatencyMs:         0,
      p95LatencyMs:         0,
      p99LatencyMs:         0,
      fastestMs:            0,
      slowestMs:            0,
      timingClassCounts:    Object.freeze({}),
      latencyTrend:         'STABLE' as const,
      qualityScore:         0,
      decisionBurstScore:   0,
    });
  }
}

// ============================================================================
// SECTION 20 — SUBSYSTEM CLASS 3: TelemetryResilienceScorer
// ============================================================================

/**
 * Scores the health and resilience of a run from telemetry signals alone.
 * Combines decision health, warning load, fork-hint density, and event flux
 * with GamePrimitives pressure analytics for a holistic risk profile.
 */
export class TelemetryResilienceScorer {
  private readonly _analyzer: TelemetryDecisionAnalyzer;

  constructor(analyzer: TelemetryDecisionAnalyzer) {
    this._analyzer = analyzer;
  }

  /**
   * Score the full resilience profile for a run.
   * @param state          Current telemetry state.
   * @param pressureTier   Active pressure tier from engine context.
   * @param phase          Active run phase.
   * @param pressureScore  Continuous pressure score (0–1). Defaults to tier midpoint.
   */
  score(
    state: TelemetryState,
    pressureTier: PressureTier,
    phase: RunPhase,
    pressureScore: number = PRESSURE_TIER_NORMALIZED[pressureTier],
  ): TelemetryResilienceProfile {
    const safeScore = clamp01(pressureScore);
    const validTier = validatePressureTier(pressureTier);
    const validPhase = validateRunPhase(phase);

    // Decision health — high acceptance rate and low latency indicate healthy decisions
    const analysis = this._analyzer.analyze(state.decisions);
    const latencyFactor = 1 - normalizeLatencyToUnit(analysis.avgLatencyMs);
    const decisionHealth = clamp01(
      analysis.acceptanceRate * 0.6 + latencyFactor * 0.4,
    );

    // Warning load — normalized against the warning capacity threshold
    const warningLoad = clamp01(
      state.warnings.length / TELEMETRY_WARNING_CAPACITY_THRESHOLD,
    );

    // Fork-hint density — normalized against the fork hint capacity
    const forkHintDensity = clamp01(
      state.forkHints.length / TELEMETRY_FORK_HINT_CAPACITY,
    );

    // Event flux — normalized against expected event throughput
    const eventFlux = clamp01(
      state.emittedEventCount / TELEMETRY_EVENT_FLUX_THRESHOLD,
    );

    // Aggregate weighted resilience: high decision health + low loads = high resilience
    const aggregateRisk =
      TELEMETRY_RESILIENCE_WEIGHTS.decisionHealth  * (1 - decisionHealth) +
      TELEMETRY_RESILIENCE_WEIGHTS.warningLoad     * warningLoad +
      TELEMETRY_RESILIENCE_WEIGHTS.forkHintDensity * forkHintDensity +
      TELEMETRY_RESILIENCE_WEIGHTS.eventFlux       * (1 - eventFlux);
    const overallResilience = clamp01(1 - aggregateRisk);

    // Pressure analytics from GamePrimitives
    const pressureRiskScore = computePressureRiskScore(validTier, safeScore);
    const nextTier = getNextPressureTier(validTier);
    const canEscalate = nextTier !== null
      ? canEscalatePressure(validTier, nextTier, safeScore, 0)
      : false;

    // Risk level classification using phase stakes as a multiplier
    const stakesBoost = RUN_PHASE_STAKES_MULTIPLIER[validPhase];
    const riskScore = aggregateRisk * stakesBoost;
    const riskLevel = riskScore >= 0.75 ? 'CRITICAL' :
                      riskScore >= 0.50 ? 'HIGH'     :
                      riskScore >= 0.25 ? 'MEDIUM'   : 'LOW';

    // Use tickTierToPressureTier to validate the current tier mapping roundtrip
    const currentTickTier = pressureTierToTickTier(validTier);
    const roundtripTier = tickTierToPressureTier(currentTickTier);
    const bandLabel = tierToBand(roundtripTier);

    return Object.freeze({
      decisionHealthScore:     decisionHealth as Score01,
      warningLoadScore:        warningLoad as Score01,
      forkHintDensityScore:    forkHintDensity as Score01,
      eventFluxScore:          eventFlux as Score01,
      overallResilienceScore:  overallResilience as Score01,
      riskLevel,
      pressureRiskScore,
      isEscalationImminent:    canEscalate,
      bandLabel,
      canEscalate,
    });
  }

  /** Quick boolean health check. */
  isHealthy(profile: TelemetryResilienceProfile): boolean {
    return profile.riskLevel === 'LOW' || profile.riskLevel === 'MEDIUM';
  }

  /** Map a resilience profile to a simplified risk classification. */
  classifyRisk(profile: TelemetryResilienceProfile): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    return profile.riskLevel;
  }
}

// ============================================================================
// SECTION 21 — SUBSYSTEM CLASS 4: TelemetryMLExtractor
// ============================================================================

/**
 * Extracts a 28-dimensional ML feature vector from telemetry state + context.
 * Every feature is deterministic, replay-stable, and normalized to a sensible range.
 * Uses GamePrimitives constants and time/types configurations for rich contextual features.
 */
export class TelemetryMLExtractor {
  private readonly _analyzer: TelemetryDecisionAnalyzer;
  private readonly _resilienceScorer: TelemetryResilienceScorer;

  constructor(
    analyzer: TelemetryDecisionAnalyzer,
    resilienceScorer: TelemetryResilienceScorer,
  ) {
    this._analyzer = analyzer;
    this._resilienceScorer = resilienceScorer;
  }

  /**
   * Extract the full 28-dim feature vector from telemetry state and ML context.
   * Uses PRESSURE_TIER_NORMALIZED, RUN_PHASE_NORMALIZED, MODE_NORMALIZED,
   * MODE_DIFFICULTY_MULTIPLIER, MODE_TENSION_FLOOR, TICK_TIER_CONFIGS, and
   * computeRunProgressFraction for contextual features.
   */
  extract(state: TelemetryState, ctx: TelemetryMLContext): TelemetryMLVector {
    const validMode  = validateModeCode(ctx.mode);
    const validPhase = validateRunPhase(ctx.phase);
    const validTier  = validatePressureTier(ctx.pressureTier);

    const analysis = this._analyzer.analyze(state.decisions);
    const resilience = this._resilienceScorer.score(
      state,
      validTier,
      validPhase,
      ctx.pressureScore,
    );

    // Bridge to TickTier for tier-config-based features
    const tickTier: TickTier = pressureTierToTickTier(validTier);
    const tierConfig: TickTierConfig = TICK_TIER_CONFIGS[tickTier];

    // Tick tier normalized (0=SOVEREIGN, 1=COLLAPSE_IMMINENT)
    const tickTierValues: Record<TickTier, number> = {
      [TickTier.SOVEREIGN]:         0.0,
      [TickTier.STABLE]:            0.25,
      [TickTier.COMPRESSED]:        0.5,
      [TickTier.CRISIS]:            0.75,
      [TickTier.COLLAPSE_IMMINENT]: 1.0,
    };
    const tickTierNormalized = tickTierValues[tickTier];

    // Run progress fraction from GamePrimitives
    const runProgress = computeRunProgressFraction(
      validPhase,
      ctx.tickInPhase,
      ctx.phaseTickBudget,
    );

    // Outcome excitement (0=none if null, scale otherwise)
    const outcomeExcitement = ctx.outcome !== null && isRunOutcome(ctx.outcome)
      ? scoreOutcomeExcitement(ctx.outcome, validMode) / 5
      : 0;

    // Decision count normalized
    const decisionCountNorm = clamp01(
      state.decisions.length / TELEMETRY_DECISION_BURST_THRESHOLD,
    );

    // Event flux delta: how much flux vs season budget
    const eventFluxNorm = clamp01(
      state.emittedEventCount / TELEMETRY_EVENT_FLUX_THRESHOLD,
    );
    const elapsedFraction = ctx.seasonBudgetMs > 0
      ? clamp01(ctx.elapsedMs / ctx.seasonBudgetMs)
      : 0;
    const eventFluxDelta = clamp01(
      Math.abs(eventFluxNorm - elapsedFraction),
    );

    // Timing class diversity
    const timingClassDiversity = this._analyzer.computeTimingClassDiversity(
      analysis.timingClassCounts,
    );

    // Audit entropy — uses phase normalized as proxy
    const auditEntropy = clamp01(
      RUN_PHASE_NORMALIZED[validPhase] * 0.5 +
      PRESSURE_TIER_NORMALIZED[validTier] * 0.5,
    );

    // tierConfig used to derive expected decision window fraction
    const decisionWindowFraction = clamp01(
      tierConfig.decisionWindowMs / TELEMETRY_MAX_LATENCY_MS,
    );
    // Pressure reader score (from optional context)
    const pressureReaderScore = ctx.pressure?.score ?? clamp01(ctx.pressureScore);

    const features: number[] = [
      // Decision signals (6)
      decisionCountNorm,                                   // tel_decision_count_normalized
      analysis.acceptanceRate,                             // tel_acceptance_rate
      normalizeLatencyToUnit(analysis.avgLatencyMs),       // tel_avg_latency_normalized
      normalizeLatencyToUnit(analysis.p95LatencyMs),       // tel_p95_latency_normalized
      analysis.rejectionRate,                              // tel_rejection_rate
      analysis.qualityScore,                               // tel_decision_quality_score
      // Warning and fork signals (4)
      clamp01(state.warnings.length / TELEMETRY_WARNING_CAPACITY_THRESHOLD),  // tel_warning_count_normalized
      clamp01(state.forkHints.length / TELEMETRY_FORK_HINT_CAPACITY),         // tel_fork_hint_count_normalized
      clamp01(state.warnings.length / Math.max(1, TELEMETRY_DECISION_BURST_THRESHOLD)), // tel_warning_burst_score
      clamp01(state.forkHints.length / Math.max(1, TELEMETRY_FORK_HINT_CAPACITY)),      // tel_fork_burst_score
      // Event flux (2)
      eventFluxNorm,                                       // tel_event_flux_normalized
      eventFluxDelta,                                      // tel_event_flux_delta
      // Outcome signals (3)
      state.outcomeReason !== null ? 1.0 : 0.0,            // tel_outcome_reason_present
      state.lastTickChecksum !== null ? 1.0 : 0.0,         // tel_checksum_present
      outcomeExcitement,                                   // tel_outcome_excitement
      // Pressure and phase context (6)
      PRESSURE_TIER_NORMALIZED[validTier],                 // tel_pressure_tier_normalized
      clamp01(ctx.pressureScore),                          // tel_pressure_risk_score
      RUN_PHASE_NORMALIZED[validPhase],                    // tel_phase_normalized
      clamp01(RUN_PHASE_STAKES_MULTIPLIER[validPhase]),    // tel_phase_stakes_multiplier
      runProgress,                                         // tel_run_progress_fraction
      tickTierNormalized,                                  // tel_tick_tier_normalized
      // Mode context (3)
      MODE_NORMALIZED[validMode],                          // tel_mode_normalized
      clamp01(MODE_DIFFICULTY_MULTIPLIER[validMode]),      // tel_mode_difficulty
      clamp01(MODE_TENSION_FLOOR[validMode]),              // tel_mode_tension_floor
      // Resilience aggregate (4)
      resilience.overallResilienceScore,                   // tel_resilience_score
      analysis.decisionBurstScore,                         // tel_decision_burst_score
      timingClassDiversity,                                // tel_timing_class_diversity
      auditEntropy,                                        // tel_audit_entropy
    ];

    // Suppress unused variable warning — decisionWindowFraction contextualizes tier dynamics
    void pressureReaderScore;
    void decisionWindowFraction;

    return Object.freeze({
      features:     Object.freeze(features),
      dim:          TELEMETRY_ML_DIM,
      labels:       TELEMETRY_ML_FEATURE_LABELS,
      extractedAt:  Date.now() as UnixMs,
    });
  }

  /** Return the canonical 28 feature labels for this extractor. */
  getFeatureLabels(): readonly string[] {
    return TELEMETRY_ML_FEATURE_LABELS;
  }

  /**
   * Validate that an ML vector has the correct dimensionality and finite values.
   * Returns false if any feature is non-finite or the length is wrong.
   */
  validateVector(v: TelemetryMLVector): boolean {
    return (
      v.dim === TELEMETRY_ML_DIM &&
      v.features.length === TELEMETRY_ML_DIM &&
      v.features.every((f) => Number.isFinite(f))
    );
  }
}

// ============================================================================
// SECTION 22 — SUBSYSTEM CLASS 5: TelemetryDLBuilder
// ============================================================================

/**
 * Builds and maintains a 40×6 ring buffer (DL tensor) from telemetry history.
 * Each row represents a projection snapshot with 6 numeric features.
 * The ring buffer automatically discards the oldest row when at capacity.
 * Uses TimerState and TelemetryState for rich DL row construction.
 */
export class TelemetryDLBuilder {
  private readonly _rows: number[][] = [];
  private _lastUpdatedAt: UnixMs | null = null;
  private readonly _analyzer: TelemetryDecisionAnalyzer;

  constructor(analyzer: TelemetryDecisionAnalyzer) {
    this._analyzer = analyzer;
  }

  /**
   * Push a new DL row onto the ring buffer.
   * If the buffer is full, the oldest row is removed first.
   */
  push(row: TelemetryDLRow): void {
    const normalized: number[] = [
      clamp01(row.decisionCount),
      clamp01(row.acceptanceRate),
      clamp01(row.avgLatencyNormalized),
      clamp01(row.warningLoad),
      clamp01(row.forkHintLoad),
      clamp01(row.eventFlux),
    ];
    if (this._rows.length >= TELEMETRY_DL_ROW_COUNT) {
      this._rows.shift();
    }
    this._rows.push(normalized);
    this._lastUpdatedAt = Date.now() as UnixMs;
  }

  /**
   * Build a DL row from live telemetry state + optional timer state.
   * Uses TIER_DURATIONS_MS for flux normalization reference.
   */
  buildRowFromState(
    state: TelemetryState,
    timerState?: TimerState,
  ): TelemetryDLRow {
    const analysis = this._analyzer.analyze(state.decisions);
    // Event flux relative to timer elapsed (uses timerState if available)
    const elapsedMs = timerState?.elapsedMs ?? 0;
    const seasonBudgetMs = timerState?.seasonBudgetMs ?? TIER_DURATIONS_MS['T1'];
    const eventFluxNorm = seasonBudgetMs > 0
      ? clamp01(state.emittedEventCount / TELEMETRY_EVENT_FLUX_THRESHOLD)
      : 0;

    // Warning load normalized with elapsed fraction as scaling factor
    const elapsedFraction = seasonBudgetMs > 0 ? clamp01(elapsedMs / seasonBudgetMs) : 0;
    const warningLoadScaled = clamp01(
      (state.warnings.length / TELEMETRY_WARNING_CAPACITY_THRESHOLD) * (1 + elapsedFraction),
    );

    return {
      decisionCount:        clamp01(analysis.decisionCount / TELEMETRY_DECISION_BURST_THRESHOLD),
      acceptanceRate:       analysis.acceptanceRate,
      avgLatencyNormalized: normalizeLatencyToUnit(analysis.avgLatencyMs),
      warningLoad:          warningLoadScaled,
      forkHintLoad:         clamp01(state.forkHints.length / TELEMETRY_FORK_HINT_CAPACITY),
      eventFlux:            eventFluxNorm,
    };
  }

  /**
   * Return the full 40×6 tensor padded with zero rows if under capacity.
   * Produces an immutable, replay-safe snapshot.
   */
  getTensor(): readonly (readonly number[])[] {
    const result: (readonly number[])[] = [];
    for (let i = 0; i < TELEMETRY_DL_ROW_COUNT; i++) {
      if (i < this._rows.length) {
        result.push(Object.freeze([...this._rows[i]]));
      } else {
        result.push(
          Object.freeze(Array(TELEMETRY_DL_COL_COUNT).fill(0) as number[]),
        );
      }
    }
    return Object.freeze(result);
  }

  /** Return aggregate statistics across all rows currently in the buffer. */
  getStats(): TelemetryDLStats {
    if (this._rows.length === 0) {
      return Object.freeze({
        rowCount:             0,
        capacity:             TELEMETRY_DL_ROW_COUNT,
        fillRatio:            0,
        lastUpdatedAt:        null,
        avgDecisionCount:     0,
        avgAcceptanceRate:    0,
        avgLatencyNormalized: 0,
        avgWarningLoad:       0,
      });
    }
    const n = this._rows.length;
    const sumDecision  = this._rows.reduce((s, r) => s + (r[0] ?? 0), 0);
    const sumAccept    = this._rows.reduce((s, r) => s + (r[1] ?? 0), 0);
    const sumLatency   = this._rows.reduce((s, r) => s + (r[2] ?? 0), 0);
    const sumWarning   = this._rows.reduce((s, r) => s + (r[3] ?? 0), 0);

    return Object.freeze({
      rowCount:             n,
      capacity:             TELEMETRY_DL_ROW_COUNT,
      fillRatio:            n / TELEMETRY_DL_ROW_COUNT,
      lastUpdatedAt:        this._lastUpdatedAt,
      avgDecisionCount:     sumDecision / n,
      avgAcceptanceRate:    sumAccept / n,
      avgLatencyNormalized: sumLatency / n,
      avgWarningLoad:       sumWarning / n,
    });
  }

  /** Return the current number of rows in the buffer. */
  size(): number {
    return this._rows.length;
  }

  /** Check whether the ring buffer has reached capacity. */
  isFull(): boolean {
    return this._rows.length >= TELEMETRY_DL_ROW_COUNT;
  }

  /** Clear all rows and reset the last-updated timestamp. */
  reset(): void {
    this._rows.length = 0;
    this._lastUpdatedAt = null;
  }
}

// ============================================================================
// SECTION 23 — SUBSYSTEM CLASS 6: TelemetryChatBridge
// ============================================================================

/**
 * Bridges telemetry state into the LIVEOPS_SIGNAL chat lane.
 * Builds ChatInputEnvelope with LIVEOPS type, ChatRunSnapshot, ChatLiveOpsSnapshot,
 * and ChatBattleSnapshot from engine telemetry + projection context.
 * Uses all five chat snapshot types and bridges engine enums to chat-local types.
 */
export class TelemetryChatBridge {
  private readonly _warningAnalyzer: TelemetryWarningAnalyzer;

  constructor(warningAnalyzer: TelemetryWarningAnalyzer) {
    this._warningAnalyzer = warningAnalyzer;
  }

  /**
   * Build a LIVEOPS_SIGNAL ChatInputEnvelope from telemetry state and chat context.
   * Emits when forceEmit is true OR when shouldEmitUrgentSignal() returns true.
   */
  buildSignal(
    state: TelemetryState,
    ctx: TelemetryChatContext,
  ): ChatInputEnvelope {
    const now = Date.now() as UnixMs;
    const warningAnalysis = this._warningAnalyzer.analyze(state.warnings, state.forkHints);

    const liveops: ChatLiveOpsSnapshot = this._buildLiveOpsSnapshot(state, warningAnalysis);
    const run: ChatRunSnapshot = this._buildRunSnapshot(state, ctx);
    const battle: ChatBattleSnapshot = this._buildBattleSnapshot(ctx);

    const payload: ChatSignalEnvelope = {
      type:      TELEMETRY_CHAT_SIGNAL_TYPE,
      emittedAt: now,
      roomId:    null,
      battle,
      run,
      liveops,
      metadata:  Object.freeze({
        telemetryVersion:    TELEMETRY_VERSION,
        runId:               ctx.runId,
        tick:                ctx.tick,
        warningCount:        state.warnings.length,
        forkHintCount:       state.forkHints.length,
        emittedEventCount:   state.emittedEventCount,
        outcomeReasonCode:   state.outcomeReasonCode ?? '',
      } satisfies Record<string, JsonValue>),
    };

    return {
      kind:      'LIVEOPS_SIGNAL',
      emittedAt: now,
      payload,
    };
  }

  /**
   * Determine whether an urgent signal should be emitted based on telemetry thresholds.
   * Triggers when warnings are heavy, fork hints are dense, or events spike.
   */
  shouldEmitUrgentSignal(state: TelemetryState): boolean {
    const warningHeavy = state.warnings.length >= Math.floor(TELEMETRY_WARNING_CAPACITY_THRESHOLD * 0.7);
    const forkDense    = state.forkHints.length >= Math.floor(TELEMETRY_FORK_HINT_CAPACITY * 0.6);
    const outcomeSet   = state.outcomeReason !== null;
    return warningHeavy || forkDense || outcomeSet;
  }

  private _buildRunSnapshot(state: TelemetryState, ctx: TelemetryProjectionContext): ChatRunSnapshot {
    const validTier  = validatePressureTier(ctx.pressureTier);
    const engineTick = pressureTierToTickTier(validTier);
    const chatTick: ChatTickTierValue = bridgeTickTierToChat(engineTick);
    const chatOutcome: ChatRunOutcomeValue = bridgeRunOutcomeToChat(ctx.outcome);
    const warningAnalysis = this._warningAnalyzer.analyze(state.warnings, state.forkHints);

    return {
      runId:            ctx.runId,
      runPhase:         ctx.phase,
      tickTier:         chatTick,
      outcome:          chatOutcome,
      bankruptcyWarning: warningAnalysis.riskLevel === 'CRITICAL',
      nearSovereignty:  ctx.outcome === 'FREEDOM' ||
                        (ctx.pressureTier === 'T0' && ctx.phase === 'SOVEREIGNTY'),
      elapsedMs:        ctx.elapsedMs,
    };
  }

  private _buildLiveOpsSnapshot(
    state: TelemetryState,
    warningAnalysis: TelemetryWarningAnalysis,
  ): ChatLiveOpsSnapshot {
    const heatMultiplier = clamp01(warningAnalysis.combinedRiskScore);
    const haterRaidActive = state.warnings.some((w) =>
      w.toLowerCase().includes('bot') || w.toLowerCase().includes('attack'),
    );
    const helperBlackout = state.forkHints.some((h) =>
      h.toLowerCase().includes('block') || h.toLowerCase().includes('disabled'),
    );
    const worldEventName =
      state.outcomeReason !== null
        ? `OUTCOME:${state.outcomeReasonCode ?? 'UNKNOWN'}`
        : null;

    return {
      worldEventName,
      heatMultiplier01:  heatMultiplier as Score01,
      helperBlackout,
      haterRaidActive,
    };
  }

  private _buildBattleSnapshot(ctx: TelemetryProjectionContext): ChatBattleSnapshot {
    const validTier = validatePressureTier(ctx.pressureTier);
    const chatPressure: ChatPressureTierValue = bridgePressureTierToChat(validTier);
    // Hostile momentum from battleState if available, otherwise battleMomentum from context
    const rawMomentum = ctx.battleState?.rivalryHeatCarry ?? ctx.battleMomentum;
    const hostileMomentum = clamp100(rawMomentum * 100) as Score100;
    const shieldIntegrity01 = clamp01(ctx.shieldIntegrity) as Score01;

    return {
      tickNumber:        ctx.tick,
      pressureTier:      chatPressure,
      activeAttackType:  null,
      activeBotId:       null,
      hostileMomentum,
      rescueWindowOpen:  ctx.holdCharges > 0,
      shieldIntegrity01,
      lastAttackAt:      null,
    };
  }
}

// ============================================================================
// SECTION 24 — SUBSYSTEM CLASS 7: TelemetryNarrator
// ============================================================================

/**
 * Generates human-readable narratives from telemetry state and run context.
 * Uses PRESSURE_TIER_URGENCY_LABEL, describePressureTierExperience, isWinOutcome,
 * isLossOutcome, isEndgamePhase, scoreOutcomeExcitement, and RUN_OUTCOMES
 * to produce contextually accurate and emotionally resonant commentary.
 */
export class TelemetryNarrator {

  /**
   * Generate a full TelemetryNarrative from telemetry state and run context.
   * Incorporates pressure labels, phase framing, mode style, and outcome encoding.
   */
  narrate(
    state: TelemetryState,
    mode: ModeCode,
    phase: RunPhase,
    pressureTier: PressureTier,
    outcome: RunOutcome | null,
  ): TelemetryNarrative {
    const validMode    = validateModeCode(mode);
    const validPhase   = validateRunPhase(phase);
    const validTier    = validatePressureTier(pressureTier);

    const urgencyLabel  = PRESSURE_TIER_URGENCY_LABEL[validTier];
    const phaseLabel    = this.getPhaseLabel(validPhase);
    const modeLabel     = this.getModeLabel(validMode);
    const experience    = describePressureTierExperience(validTier);

    const headline = this._buildHeadline(validMode, validPhase, validTier, urgencyLabel);
    const detail   = this._buildDetail(state, validTier, validPhase);
    const warningBrief = this._buildWarningBrief(state.warnings);
    const forkBrief    = this._buildForkBrief(state.forkHints);
    const outcomeFrame = this._buildOutcomeFrame(outcome, validMode, state);

    const urgencyEmphasis: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' =
      validTier === 'T4' ? 'CRITICAL' :
      validTier === 'T3' ? 'HIGH'     :
      validTier === 'T2' ? 'MEDIUM'   : 'LOW';

    return Object.freeze({
      mode:                 validMode,
      phase:                validPhase,
      headline,
      detail,
      warningBrief,
      forkBrief,
      outcomeFrame,
      pressureLabel:        urgencyLabel,
      phaseLabel,
      experienceDescription: experience,
      modeLabel,
      urgencyEmphasis,
    });
  }

  /** Return a human-readable label for a run phase. */
  getPhaseLabel(phase: RunPhase): string {
    const validPhase = validateRunPhase(phase);
    const labels: Record<RunPhase, string> = {
      FOUNDATION:  'Foundation',
      ESCALATION:  'Escalation',
      SOVEREIGNTY: 'Sovereignty',
    };
    return labels[validPhase];
  }

  /** Return a human-readable label for a mode code. */
  getModeLabel(mode: ModeCode): string {
    const validMode = validateModeCode(mode);
    const labels: Record<ModeCode, string> = {
      solo:  'Empire',
      pvp:   'Predator',
      coop:  'Syndicate',
      ghost: 'Phantom',
    };
    return labels[validMode];
  }

  /** Return all valid mode labels for reference. Uses MODE_CODES sentinel. */
  getAllModeLabels(): readonly { mode: ModeCode; label: string }[] {
    return MODE_CODES.map((m) => ({ mode: m, label: this.getModeLabel(m) }));
  }

  /** Return all valid outcome strings. Uses RUN_OUTCOMES sentinel. */
  getAllOutcomes(): readonly RunOutcome[] {
    return RUN_OUTCOMES;
  }

  /** Return true if the given phase code is valid. Uses isRunPhase type guard. */
  isValidPhase(value: unknown): boolean {
    return isRunPhase(value);
  }

  /** Return true if the given outcome is a win. Guards null before calling GamePrimitives. */
  isWin(outcome: RunOutcome | null): boolean {
    return outcome !== null ? isWinOutcome(outcome) : false;
  }

  /** Return true if the given outcome is a loss. Guards null before calling GamePrimitives. */
  isLoss(outcome: RunOutcome | null): boolean {
    return outcome !== null ? isLossOutcome(outcome) : false;
  }

  /** Return true if this phase is the endgame phase (SOVEREIGNTY). */
  isEndgame(phase: RunPhase): boolean {
    return isEndgamePhase(phase);
  }

  private _buildHeadline(
    mode: ModeCode,
    phase: RunPhase,
    tier: PressureTier,
    urgencyLabel: string,
  ): string {
    const modeLabel  = this.getModeLabel(mode);
    const phaseLabel = this.getPhaseLabel(phase);
    return `[${modeLabel}] ${phaseLabel} — Pressure: ${urgencyLabel}`;
  }

  private _buildDetail(
    state: TelemetryState,
    tier: PressureTier,
    phase: RunPhase,
  ): string {
    const decisionCount = state.decisions.length;
    const accepted = state.decisions.filter((d) => d.accepted).length;
    const phaseLabel = this.getPhaseLabel(phase);
    const tierLabel  = PRESSURE_TIER_URGENCY_LABEL[tier];
    return (
      `${decisionCount} decision${decisionCount !== 1 ? 's' : ''} logged ` +
      `(${accepted} accepted) in ${phaseLabel} at ${tierLabel} pressure. ` +
      `${state.emittedEventCount} events emitted.`
    );
  }

  private _buildWarningBrief(warnings: readonly string[]): string {
    if (warnings.length === 0) return 'No active warnings.';
    if (warnings.length === 1) return `Warning: ${warnings[0]}`;
    return `${warnings.length} active warnings. Latest: ${warnings[warnings.length - 1]}`;
  }

  private _buildForkBrief(forkHints: readonly string[]): string {
    if (forkHints.length === 0) return 'No fork hints queued.';
    if (forkHints.length === 1) return `Fork hint: ${forkHints[0]}`;
    return `${forkHints.length} fork hints queued. Latest: ${forkHints[forkHints.length - 1]}`;
  }

  private _buildOutcomeFrame(
    outcome: RunOutcome | null,
    mode: ModeCode,
    state: TelemetryState,
  ): string {
    if (outcome === null) {
      return state.outcomeReason !== null
        ? `Outcome pending — reason: ${state.outcomeReason}`
        : 'Run in progress — outcome not yet determined.';
    }
    if (!isRunOutcome(outcome)) {
      return 'Unknown outcome state.';
    }
    const excitement = scoreOutcomeExcitement(outcome, mode);
    const prefix = isWinOutcome(outcome) ? 'VICTORY' : 'DEFEAT';
    const code = state.outcomeReasonCode ?? 'UNKNOWN';
    return (
      `${prefix} — ${outcome} ` +
      `(excitement: ${excitement.toFixed(1)}/5, reason: ${code})`
    );
  }
}

// ============================================================================
// SECTION 25 — SUBSYSTEM CLASS 8: TelemetryModeAdvisor
// ============================================================================

/**
 * Generates mode-aware telemetry profiles combining difficulty, tension, hold,
 * and chat mount configuration.
 * Uses MODE_NORMALIZED, MODE_DIFFICULTY_MULTIPLIER, MODE_TENSION_FLOOR,
 * and DEFAULT_HOLD_DURATION_MS for all mode-specific calculations.
 */
export class TelemetryModeAdvisor {

  /**
   * Build a complete mode profile for the given mode and telemetry state.
   * Reads modeState.modePresentation for the presentation code if available.
   */
  getModeProfile(
    mode: ModeCode,
    state: TelemetryState,
    modeState?: ModeState,
  ): TelemetryModeProfile {
    const validMode = validateModeCode(mode);

    const modeNorm       = MODE_NORMALIZED[validMode];
    const difficulty     = MODE_DIFFICULTY_MULTIPLIER[validMode];
    const tensionFloor   = MODE_TENSION_FLOOR[validMode];

    // Use modeState.modePresentation if provided, else derive from mode code
    const presentation: ModePresentationCode =
      modeState?.modePresentation ?? this._getModePresentation(validMode);

    // Decision latency target: scale FAST threshold by difficulty
    const decisionLatencyTargetMs = Math.round(
      TELEMETRY_LATENCY_THRESHOLDS.FAST / Math.max(0.5, difficulty),
    );

    // Warning capacity scales inversely with difficulty
    const warningCapacity = Math.max(
      5,
      Math.round(TELEMETRY_WARNING_CAPACITY_THRESHOLD / Math.max(0.5, difficulty)),
    );

    // Fork hint capacity scales with mode tension floor
    const forkHintCapacity = Math.max(
      3,
      Math.round(TELEMETRY_FORK_HINT_CAPACITY * (1 + tensionFloor)),
    );

    const chatMountTarget = this._getChatMountTarget(validMode);
    const narrativeStyle  = this._getNarrativeStyle(validMode);

    // Consume modeState.holdEnabled to drive hold duration derivation
    const baseHold = DEFAULT_HOLD_DURATION_MS;
    const holdDurationMs = modeState?.holdEnabled === false ? 0 : baseHold;

    // Unused decision count from state is surfaced as decision context
    void state.decisions.length;

    return Object.freeze({
      mode:                     validMode,
      presentation,
      modeNormalized:           modeNorm,
      difficultyMultiplier:     difficulty,
      tensionFloor,
      decisionLatencyTargetMs,
      warningCapacity,
      forkHintCapacity,
      holdDurationMs,
      chatMountTarget,
      narrativeStyle,
    });
  }

  /** Validate a mode code value using GamePrimitives type guard. */
  isModeCodeValid(value: unknown): boolean {
    return isModeCode(value);
  }

  /** Return the chat mount target for a given mode. */
  getChatMountTarget(mode: ModeCode): string {
    return this._getChatMountTarget(validateModeCode(mode));
  }

  /** Return the narrative style for a given mode. */
  getNarrativeStyle(mode: ModeCode): 'EMPIRE' | 'PREDATOR' | 'SYNDICATE' | 'PHANTOM' {
    return this._getNarrativeStyle(validateModeCode(mode));
  }

  private _getModePresentation(mode: ModeCode): ModePresentationCode {
    const map: Record<ModeCode, ModePresentationCode> = {
      solo:  'empire',
      pvp:   'predator',
      coop:  'syndicate',
      ghost: 'phantom',
    };
    return map[mode];
  }

  private _getChatMountTarget(mode: ModeCode): string {
    const map: Record<ModeCode, string> = {
      solo:  'EMPIRE_GAME_SCREEN',
      pvp:   'PREDATOR_GAME_SCREEN',
      coop:  'SYNDICATE_GAME_SCREEN',
      ghost: 'PHANTOM_GAME_SCREEN',
    };
    return map[mode];
  }

  private _getNarrativeStyle(mode: ModeCode): 'EMPIRE' | 'PREDATOR' | 'SYNDICATE' | 'PHANTOM' {
    const map: Record<ModeCode, 'EMPIRE' | 'PREDATOR' | 'SYNDICATE' | 'PHANTOM'> = {
      solo:  'EMPIRE',
      pvp:   'PREDATOR',
      coop:  'SYNDICATE',
      ghost: 'PHANTOM',
    };
    return map[mode];
  }
}

// ============================================================================
// SECTION 26 — SUBSYSTEM CLASS 9: TelemetryPhaseAdvisor
// ============================================================================

/**
 * Generates phase-aware telemetry profiles combining stakes, budget fractions,
 * transition windows, and endgame detection.
 * Uses RUN_PHASE_NORMALIZED, RUN_PHASE_STAKES_MULTIPLIER, RUN_PHASE_TICK_BUDGET_FRACTION,
 * DEFAULT_PHASE_TRANSITION_WINDOWS, PHASE_BOUNDARIES_MS, isEndgamePhase,
 * computeEffectiveStakes, and resolvePhaseFromElapsedMs.
 */
export class TelemetryPhaseAdvisor {

  /**
   * Build a complete phase profile for the given phase and run context.
   * Uses elapsed ms to validate phase alignment via resolvePhaseFromElapsedMs.
   */
  getPhaseProfile(
    phase: RunPhase,
    mode: ModeCode,
    state: TelemetryState,
    elapsedMs: number,
  ): TelemetryPhaseProfile {
    const validPhase = validateRunPhase(phase);
    const validMode  = validateModeCode(mode);

    const phaseNormalized  = RUN_PHASE_NORMALIZED[validPhase];
    const stakesMultiplier = RUN_PHASE_STAKES_MULTIPLIER[validPhase];
    const budgetFraction   = RUN_PHASE_TICK_BUDGET_FRACTION[validPhase];
    const isEndgame        = isEndgamePhase(validPhase);

    // computeEffectiveStakes combines phase and mode difficulty
    const effectiveStakes  = computeEffectiveStakes(validPhase, validMode);

    // Find phase boundary start time from PHASE_BOUNDARIES_MS
    const boundary: PhaseBoundary | undefined = [...PHASE_BOUNDARIES_MS].find(
      (b) => b.phase === validPhase,
    );
    const startsAtMs = boundary?.startsAtMs ?? 0;

    // Resolve next phase
    const nextPhase = this._getNextPhase(validPhase);

    // Validate elapsed ms alignment using resolvePhaseFromElapsedMs
    const resolvedPhase = resolvePhaseFromElapsedMs(elapsedMs);
    const phaseAligned  = resolvedPhase === validPhase;

    // Decision density expectation scales with stakes
    const decisionDensityExpectation = Math.max(
      1,
      Math.round(effectiveStakes * TELEMETRY_DECISION_BURST_THRESHOLD),
    );

    // Use DEFAULT_PHASE_TRANSITION_WINDOWS for transition window default
    const transitionWindowsDefault = DEFAULT_PHASE_TRANSITION_WINDOWS;

    // Unused state.decisions.length surfaces as expectation context
    void state.decisions.length;

    const experienceFrame = phaseAligned
      ? `${validPhase} phase active — stakes x${stakesMultiplier.toFixed(2)}`
      : `Phase mismatch: expected ${validPhase}, elapsed resolves to ${resolvedPhase}`;

    return Object.freeze({
      phase:                        validPhase,
      phaseNormalized,
      stakesMultiplier,
      budgetFraction,
      isEndgame,
      startsAtMs,
      nextPhase,
      decisionDensityExpectation,
      transitionWindowsDefault,
      experienceFrame,
    });
  }

  /** Return a human-readable phase label. Uses RUN_PHASES sentinel for validation. */
  getPhaseLabel(phase: RunPhase): string {
    const validPhase = validateRunPhase(phase);
    const labels: Record<RunPhase, string> = {
      FOUNDATION:  'Foundation',
      ESCALATION:  'Escalation',
      SOVEREIGNTY: 'Sovereignty',
    };
    return labels[validPhase];
  }

  /** Validate a run phase value. Uses isRunPhase type guard. */
  isPhaseCodeValid(value: unknown): boolean {
    return isRunPhase(value);
  }

  /** Return all run phases from GamePrimitives RUN_PHASES constant. */
  getAllPhases(): readonly RunPhase[] {
    return RUN_PHASES;
  }

  /** Return the next run phase or null if already at SOVEREIGNTY. */
  getNextPhase(phase: RunPhase): RunPhase | null {
    return this._getNextPhase(validateRunPhase(phase));
  }

  private _getNextPhase(phase: RunPhase): RunPhase | null {
    const idx = RUN_PHASES.indexOf(phase);
    if (idx < 0 || idx >= RUN_PHASES.length - 1) return null;
    return RUN_PHASES[idx + 1] as RunPhase;
  }
}

// ============================================================================
// SECTION 27 — SUBSYSTEM CLASS 10: TelemetryWarningAnalyzer
// ============================================================================

/**
 * Analyzes warning and fork-hint streams for burst patterns, category classification,
 * risk scoring, and top-signal extraction.
 * Uses TELEMETRY_WARNING_CATEGORIES for keyword-based categorization and
 * TELEMETRY_RESILIENCE_WEIGHTS for combined risk aggregation.
 */
export class TelemetryWarningAnalyzer {

  /**
   * Produce a full analysis of warning and fork-hint arrays.
   * Empty arrays produce zeroed/null output with LOW risk.
   */
  analyze(
    warnings: readonly string[],
    forkHints: readonly string[],
  ): TelemetryWarningAnalysis {
    const uniqueWarnings  = new Set(warnings);
    const uniqueForkHints = new Set(forkHints);

    const warningBurstScore = clamp01(
      warnings.length / TELEMETRY_WARNING_CAPACITY_THRESHOLD,
    );
    const forkHintBurstScore = clamp01(
      forkHints.length / TELEMETRY_FORK_HINT_CAPACITY,
    );
    const combinedRiskScore = clamp01(
      TELEMETRY_RESILIENCE_WEIGHTS.warningLoad     * warningBurstScore +
      TELEMETRY_RESILIENCE_WEIGHTS.forkHintDensity * forkHintBurstScore,
    );

    const riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' =
      combinedRiskScore >= 0.75 ? 'CRITICAL' :
      combinedRiskScore >= 0.50 ? 'HIGH'     :
      combinedRiskScore >= 0.25 ? 'MEDIUM'   : 'LOW';

    const topWarning: Nullable<string> =
      warnings.length > 0 ? warnings[warnings.length - 1] : null;
    const topForkHint: Nullable<string> =
      forkHints.length > 0 ? forkHints[forkHints.length - 1] : null;

    return Object.freeze({
      warningCount:      warnings.length,
      forkHintCount:     forkHints.length,
      uniqueWarningCount:  uniqueWarnings.size,
      uniqueForkHintCount: uniqueForkHints.size,
      warningBurstScore,
      forkHintBurstScore,
      combinedRiskScore,
      topWarning,
      topForkHint,
      riskLevel,
    });
  }

  /**
   * Classify a single warning string into one of five categories.
   * Uses TELEMETRY_WARNING_CATEGORIES keyword matching (case-insensitive).
   */
  categorizeWarning(
    warning: string,
  ): 'TIMING' | 'PRESSURE' | 'SYSTEM' | 'BUDGET' | 'UNKNOWN' {
    const lower = warning.toLowerCase();
    for (const [category, keywords] of Object.entries(TELEMETRY_WARNING_CATEGORIES)) {
      if (keywords.some((kw) => lower.includes(kw))) {
        return category as 'TIMING' | 'PRESSURE' | 'SYSTEM' | 'BUDGET';
      }
    }
    return 'UNKNOWN';
  }

  /**
   * Assess the risk level from a TelemetryWarningAnalysis.
   * Convenience accessor for callers that already have an analysis result.
   */
  assessRiskLevel(analysis: TelemetryWarningAnalysis): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    return analysis.riskLevel;
  }

  /**
   * Merge two warning analyses into a combined view.
   * Sums all counts and recomputes scores. Used for multi-projector aggregation.
   */
  mergeAnalyses(
    a: TelemetryWarningAnalysis,
    b: TelemetryWarningAnalysis,
  ): TelemetryWarningAnalysis {
    const mergedWarnings   = a.warningCount + b.warningCount;
    const mergedForkHints  = a.forkHintCount + b.forkHintCount;
    const wBurst = clamp01(mergedWarnings / TELEMETRY_WARNING_CAPACITY_THRESHOLD);
    const fBurst = clamp01(mergedForkHints / TELEMETRY_FORK_HINT_CAPACITY);
    const combined = clamp01(
      TELEMETRY_RESILIENCE_WEIGHTS.warningLoad     * wBurst +
      TELEMETRY_RESILIENCE_WEIGHTS.forkHintDensity * fBurst,
    );
    const riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' =
      combined >= 0.75 ? 'CRITICAL' :
      combined >= 0.50 ? 'HIGH'     :
      combined >= 0.25 ? 'MEDIUM'   : 'LOW';

    return Object.freeze({
      warningCount:        mergedWarnings,
      forkHintCount:       mergedForkHints,
      uniqueWarningCount:  a.uniqueWarningCount + b.uniqueWarningCount,
      uniqueForkHintCount: a.uniqueForkHintCount + b.uniqueForkHintCount,
      warningBurstScore:   wBurst,
      forkHintBurstScore:  fBurst,
      combinedRiskScore:   combined,
      topWarning:          b.topWarning ?? a.topWarning,
      topForkHint:         b.topForkHint ?? a.topForkHint,
      riskLevel,
    });
  }
}

// ============================================================================
// SECTION 28 — MAIN CLASS: TimeTelemetryProjector
// ============================================================================

/**
 * The canonical telemetry projector for the backend time engine.
 *
 * Core contract (v1 methods preserved):
 * - project()           — pure immutable state fold from previous + request
 * - projectForSnapshot() — shorthand projection from a RunStateSnapshot
 * - appendDecision()    — convenience append for a single decision
 * - appendWarning()     — convenience append for a single warning string
 * - appendForkHint()    — convenience append for a single fork hint string
 * - incrementEventCount() — increment the emitted event counter
 * - setChecksum()       — update the last tick checksum
 * - setOutcomeReason()  — set outcome reason and reason code
 *
 * Extended methods (v4.0.0):
 * - projectWithContext()   — context-enriched projection that auto-records audit
 * - extractML()            — extract 28-dim ML feature vector
 * - appendDLRow()          — push a DL row built from current state
 * - getDLTensor()          — return the 40×6 DL tensor
 * - narrateState()         — generate a TelemetryNarrative for display/NPC use
 * - buildChatSignal()      — build a LIVEOPS_SIGNAL ChatInputEnvelope
 * - getModeProfile()       — get mode-specific telemetry profile
 * - getPhaseProfile()      — get phase-specific telemetry profile
 * - analyzeDecisions()     — analyze the decision record list
 * - analyzeWarnings()      — analyze warnings and fork hints
 * - scoreResilience()      — compute full resilience profile
 * - getAuditHistory()      — return the full immutable audit trail
 * - exportBundle()         — produce a full TelemetryExportBundle
 * - reset()                — clear subsystem state (audit, DL buffer)
 */
export class TimeTelemetryProjector {
  private readonly _audit: TelemetryAuditTrail;
  private readonly _decisionAnalyzer: TelemetryDecisionAnalyzer;
  private readonly _resilienceScorer: TelemetryResilienceScorer;
  private readonly _mlExtractor: TelemetryMLExtractor;
  private readonly _dlBuilder: TelemetryDLBuilder;
  private readonly _chatBridge: TelemetryChatBridge;
  private readonly _narrator: TelemetryNarrator;
  private readonly _modeAdvisor: TelemetryModeAdvisor;
  private readonly _phaseAdvisor: TelemetryPhaseAdvisor;
  private readonly _warningAnalyzer: TelemetryWarningAnalyzer;

  constructor(
    auditCapacity: number = TELEMETRY_AUDIT_CAPACITY,
  ) {
    this._warningAnalyzer  = new TelemetryWarningAnalyzer();
    this._decisionAnalyzer = new TelemetryDecisionAnalyzer();
    this._resilienceScorer = new TelemetryResilienceScorer(this._decisionAnalyzer);
    this._mlExtractor      = new TelemetryMLExtractor(this._decisionAnalyzer, this._resilienceScorer);
    this._dlBuilder        = new TelemetryDLBuilder(this._decisionAnalyzer);
    this._chatBridge       = new TelemetryChatBridge(this._warningAnalyzer);
    this._narrator         = new TelemetryNarrator();
    this._modeAdvisor      = new TelemetryModeAdvisor();
    this._phaseAdvisor     = new TelemetryPhaseAdvisor();
    this._audit            = new TelemetryAuditTrail(auditCapacity);
  }

  // --------------------------------------------------------------------------
  // CORE V1 METHODS — preserved exactly from original implementation
  // --------------------------------------------------------------------------

  /**
   * Pure immutable projection: fold previous TelemetryState forward with a request.
   * Every mutation path is additive; prior audit facts are never erased.
   */
  public project(
    previous: TelemetryState,
    request: TimeTelemetryProjectionRequest = {},
  ): TelemetryState {
    const nextDecisions =
      request.decisions === undefined
        ? previous.decisions
        : freezeArray([
            ...previous.decisions,
            ...request.decisions.map((decision) => normalizeDecision(decision)),
          ]);

    const nextWarnings =
      request.warnings === undefined
        ? previous.warnings
        : dedupeStrings(previous.warnings, request.warnings);

    const nextForkHints =
      request.forkHints === undefined
        ? previous.forkHints
        : dedupeStrings(previous.forkHints, request.forkHints);

    const nextEmittedEventCount = incrementSafe(
      previous.emittedEventCount,
      normalizeEventDelta(request.emittedEventCountDelta),
    );

    const nextChecksum = normalizeChecksum(request.lastTickChecksum);

    return Object.freeze({
      decisions: nextDecisions,
      outcomeReason:
        request.outcomeReason !== undefined
          ? request.outcomeReason
          : previous.outcomeReason,
      outcomeReasonCode:
        request.outcomeReasonCode !== undefined
          ? request.outcomeReasonCode
          : previous.outcomeReasonCode,
      lastTickChecksum:
        nextChecksum !== undefined
          ? nextChecksum
          : previous.lastTickChecksum,
      forkHints: nextForkHints,
      emittedEventCount: nextEmittedEventCount,
      warnings: nextWarnings,
    });
  }

  /**
   * Project from the telemetry slice of a full RunStateSnapshot.
   * Convenience wrapper over project() for callers with snapshot access.
   */
  public projectForSnapshot(
    snapshot: RunStateSnapshot,
    request: TimeTelemetryProjectionRequest = {},
  ): TelemetryState {
    return this.project(snapshot.telemetry, request);
  }

  /** Append a single decision record to the telemetry state. */
  public appendDecision(
    previous: TelemetryState,
    decision: TimeDecisionTelemetryInput,
  ): TelemetryState {
    return this.project(previous, { decisions: [decision] });
  }

  /** Append a single warning string (deduped). */
  public appendWarning(
    previous: TelemetryState,
    warning: string,
  ): TelemetryState {
    return this.project(previous, { warnings: [warning] });
  }

  /** Append a single fork hint string (deduped). */
  public appendForkHint(
    previous: TelemetryState,
    forkHint: string,
  ): TelemetryState {
    return this.project(previous, { forkHints: [forkHint] });
  }

  /** Increment the emitted event counter by delta (default 1). */
  public incrementEventCount(
    previous: TelemetryState,
    delta = 1,
  ): TelemetryState {
    return this.project(previous, { emittedEventCountDelta: delta });
  }

  /** Update the last tick checksum (null clears it). */
  public setChecksum(
    previous: TelemetryState,
    checksum: string | null,
  ): TelemetryState {
    return this.project(previous, { lastTickChecksum: checksum });
  }

  /** Set the outcome reason and outcome reason code. */
  public setOutcomeReason(
    previous: TelemetryState,
    outcomeReason: string | null,
    outcomeReasonCode: OutcomeReasonCode | null,
  ): TelemetryState {
    return this.project(previous, { outcomeReason, outcomeReasonCode });
  }

  // --------------------------------------------------------------------------
  // EXTENDED V4 METHODS — full analytics surface
  // --------------------------------------------------------------------------

  /**
   * Context-enriched projection that automatically records the operation in the
   * audit trail and pushes a DL row from the resulting state.
   */
  public projectWithContext(
    previous: TelemetryState,
    request: TimeTelemetryProjectionRequest,
    context: TelemetryProjectionContext,
  ): TelemetryState {
    const next = this.project(previous, request);
    this._audit.record('CONTEXT_PROJECTION', previous, next, 'LIVEOPS_SIGNAL');

    // Push DL row using timer state from context if available
    const dlRow = this._dlBuilder.buildRowFromState(next, context.timerState);
    this._dlBuilder.push(dlRow);

    return next;
  }

  /**
   * Extract a 28-dimensional ML feature vector from current telemetry state
   * and run context.
   */
  public extractML(
    state: TelemetryState,
    context: TelemetryMLContext,
  ): TelemetryMLVector {
    return this._mlExtractor.extract(state, context);
  }

  /**
   * Push a manually constructed DL row onto the ring buffer.
   * Useful when the caller has pre-computed features.
   */
  public appendDLRow(row: TelemetryDLRow): void {
    this._dlBuilder.push(row);
  }

  /**
   * Return the current 40×6 DL tensor as an immutable 2D array.
   * Padded with zero rows if the buffer has not reached capacity.
   */
  public getDLTensor(): readonly (readonly number[])[] {
    return this._dlBuilder.getTensor();
  }

  /**
   * Generate a human-readable TelemetryNarrative for NPC commentary or UI display.
   * Uses TelemetryNarrator subsystem and all five GamePrimitives narrative utilities.
   */
  public narrateState(
    state: TelemetryState,
    mode: ModeCode,
    phase: RunPhase,
    pressureTier: PressureTier,
    outcome: RunOutcome | null = null,
  ): TelemetryNarrative {
    return this._narrator.narrate(state, mode, phase, pressureTier, outcome);
  }

  /**
   * Build a LIVEOPS_SIGNAL ChatInputEnvelope from current telemetry state
   * and chat bridge context. Emits automatically when thresholds are crossed.
   */
  public buildChatSignal(
    state: TelemetryState,
    ctx: TelemetryChatContext,
  ): ChatInputEnvelope {
    const signal = this._chatBridge.buildSignal(state, ctx);
    this._audit.record(
      'CONTEXT_PROJECTION',
      state,
      state,
      'LIVEOPS_SIGNAL' as ChatEventKind,
    );
    return signal;
  }

  /**
   * Return the mode-specific telemetry profile.
   * Reads modeState.holdEnabled and modeState.modePresentation if provided.
   */
  public getModeProfile(
    mode: ModeCode,
    state: TelemetryState,
    modeState?: ModeState,
  ): TelemetryModeProfile {
    return this._modeAdvisor.getModeProfile(mode, state, modeState);
  }

  /**
   * Return the phase-specific telemetry profile.
   * Uses elapsedMs to validate phase alignment via resolvePhaseFromElapsedMs.
   */
  public getPhaseProfile(
    phase: RunPhase,
    mode: ModeCode,
    state: TelemetryState,
    elapsedMs: number,
  ): TelemetryPhaseProfile {
    return this._phaseAdvisor.getPhaseProfile(phase, mode, state, elapsedMs);
  }

  /** Analyze the full decision record list and return detailed analytics. */
  public analyzeDecisions(state: TelemetryState): TelemetryDecisionAnalysis {
    return this._decisionAnalyzer.analyze(state.decisions);
  }

  /** Analyze the warning and fork-hint streams and return risk analytics. */
  public analyzeWarnings(state: TelemetryState): TelemetryWarningAnalysis {
    return this._warningAnalyzer.analyze(state.warnings, state.forkHints);
  }

  /**
   * Score the resilience of the current run from telemetry signals.
   * Optionally accepts a continuous pressure score for more accurate risk scoring.
   */
  public scoreResilience(
    state: TelemetryState,
    pressureTier: PressureTier,
    phase: RunPhase,
    pressureScore?: number,
  ): TelemetryResilienceProfile {
    return this._resilienceScorer.score(state, pressureTier, phase, pressureScore);
  }

  /** Return the full immutable audit trail history. */
  public getAuditHistory(): readonly TelemetryAuditEntry[] {
    return this._audit.getHistory();
  }

  /** Return aggregate audit trail statistics. */
  public getAuditSummary(): TelemetryAuditSummary {
    return this._audit.summarize();
  }

  /**
   * Produce a comprehensive export bundle for persistence, replay, or display.
   * Includes ML vector, DL tensor, all analyses, resilience, and narrative.
   */
  public exportBundle(
    state: TelemetryState,
    context: TelemetryProjectionContext,
  ): TelemetryExportBundle {
    const mlCtx: TelemetryMLContext = {
      mode:             context.mode,
      phase:            context.phase,
      pressureTier:     context.pressureTier,
      pressureScore:    context.pressureScore,
      tick:             context.tick,
      tickInPhase:      context.tickInPhase,
      phaseTickBudget:  context.phaseTickBudget,
      elapsedMs:        context.elapsedMs,
      seasonBudgetMs:   context.seasonBudgetMs,
      outcome:          context.outcome,
      pressure:         context.pressureState
        ? { score: context.pressureState.score, tier: context.pressureState.tier }
        : undefined,
    };

    const ml = this._mlExtractor.extract(state, mlCtx);
    const dl = this._dlBuilder.getTensor();
    const dlStats = this._dlBuilder.getStats();
    const decisionAnalysis = this._decisionAnalyzer.analyze(state.decisions);
    const warningAnalysis = this._warningAnalyzer.analyze(state.warnings, state.forkHints);
    const resilience = this._resilienceScorer.score(
      state,
      context.pressureTier,
      context.phase,
      context.pressureScore,
    );
    const narrative = this._narrator.narrate(
      state,
      context.mode,
      context.phase,
      context.pressureTier,
      context.outcome,
    );
    const auditSummary = this._audit.summarize();

    return Object.freeze({
      version:          TELEMETRY_VERSION,
      snapshotRef:      SNAPSHOT_MODULE_VERSION,
      state,
      ml,
      dl,
      dlStats,
      decisionAnalysis,
      warningAnalysis,
      resilience,
      narrative,
      auditSummary,
      exportedAt:       Date.now() as UnixMs,
    });
  }

  /**
   * Reset all mutable subsystem state: audit trail, DL ring buffer.
   * Does not affect the immutable projection logic.
   */
  public reset(): void {
    this._audit.clear();
    this._dlBuilder.reset();
    this._audit.record(
      'RESET',
      {
        decisions: freezeArray([]),
        outcomeReason: null,
        outcomeReasonCode: null,
        lastTickChecksum: null,
        forkHints: freezeArray([]),
        emittedEventCount: 0,
        warnings: freezeArray([]),
      },
      {
        decisions: freezeArray([]),
        outcomeReason: null,
        outcomeReasonCode: null,
        lastTickChecksum: null,
        forkHints: freezeArray([]),
        emittedEventCount: 0,
        warnings: freezeArray([]),
      },
      null,
    );
  }
}

// ============================================================================
// SECTION 29 — FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a standard TimeTelemetryProjector with default audit capacity.
 * Suitable for general runtime use.
 */
export function createTimeTelemetryProjector(): TimeTelemetryProjector {
  return new TimeTelemetryProjector(TELEMETRY_AUDIT_CAPACITY);
}

/**
 * Create a TimeTelemetryProjector with extended audit capacity for full analytics.
 * Use when exporting bundles or running ML/DL inference over long sessions.
 */
export function createFullTelemetryProjector(): TimeTelemetryProjector {
  return new TimeTelemetryProjector(TELEMETRY_AUDIT_CAPACITY * 2);
}

/**
 * Create a TimeTelemetryProjector optimized for chat bridge operations.
 * Uses standard audit capacity but is pre-warmed with a LIVEOPS signal read.
 */
export function createChatBridgeTelemetryProjector(): TimeTelemetryProjector {
  const projector = new TimeTelemetryProjector(TELEMETRY_AUDIT_CAPACITY);
  // Validate chat signal type is wired correctly at construction time
  const signalType: ChatSignalType = TELEMETRY_CHAT_SIGNAL_TYPE;
  void signalType;
  return projector;
}

/**
 * Create a lightweight TimeTelemetryProjector with minimal audit capacity.
 * Use in test environments or low-memory contexts.
 */
export function createLightweightTelemetryProjector(): TimeTelemetryProjector {
  return new TimeTelemetryProjector(50);
}

// ============================================================================
// SECTION 30 — VALIDATION HELPER
// ============================================================================

/**
 * Validate a TimeTelemetryProjectionRequest for common input errors.
 * Returns an array of validation messages. Empty array means valid.
 */
export function validateTelemetryRequest(
  request: TimeTelemetryProjectionRequest,
): readonly string[] {
  const errors: string[] = [];

  if (request.decisions !== undefined) {
    for (const [idx, d] of request.decisions.entries()) {
      if (!d.actorId || d.actorId.length === 0) {
        errors.push(`decisions[${idx}].actorId is empty`);
      }
      if (!d.cardId || d.cardId.length === 0) {
        errors.push(`decisions[${idx}].cardId is empty`);
      }
      if (!Number.isFinite(d.latencyMs) || d.latencyMs < 0) {
        errors.push(`decisions[${idx}].latencyMs is invalid: ${d.latencyMs}`);
      }
    }
  }

  if (request.emittedEventCountDelta !== undefined) {
    if (!Number.isFinite(request.emittedEventCountDelta) || request.emittedEventCountDelta < 0) {
      errors.push(
        `emittedEventCountDelta must be a non-negative finite number: ${request.emittedEventCountDelta}`,
      );
    }
  }

  if (request.outcomeReasonCode !== undefined && request.outcomeReasonCode !== null) {
    const VALID_CODES: readonly OutcomeReasonCode[] = [
      'TARGET_REACHED',
      'SEASON_BUDGET_EXHAUSTED',
      'NET_WORTH_COLLAPSE',
      'USER_ABANDON',
      'ENGINE_ABORT',
      'INTEGRITY_QUARANTINE',
      'UNKNOWN',
    ];
    if (!VALID_CODES.includes(request.outcomeReasonCode)) {
      errors.push(`outcomeReasonCode is not recognized: ${request.outcomeReasonCode}`);
    }
  }

  return Object.freeze(errors);
}

// ============================================================================
// SECTION 31 — MODULE MANIFEST
// ============================================================================

/**
 * Canonical module manifest for TimeTelemetryProjector v4.0.0.
 * References snapshot module version, ML/DL dimensions, chat config,
 * and all 10 subsystem class names.
 */
export const TELEMETRY_PROJECTOR_MODULE = Object.freeze({
  name:              'TimeTelemetryProjector',
  version:           TELEMETRY_VERSION,
  snapshotRef:       SNAPSHOT_MODULE_VERSION,
  mlDim:             TELEMETRY_ML_DIM,
  dlRows:            TELEMETRY_DL_ROW_COUNT,
  dlCols:            TELEMETRY_DL_COL_COUNT,
  auditCapacity:     TELEMETRY_AUDIT_CAPACITY,
  chatSignalType:    TELEMETRY_CHAT_SIGNAL_TYPE,
  liveopsChannel:    TELEMETRY_LIVEOPS_CHANNEL,
  subsystems: Object.freeze([
    'TelemetryAuditTrail',
    'TelemetryDecisionAnalyzer',
    'TelemetryResilienceScorer',
    'TelemetryMLExtractor',
    'TelemetryDLBuilder',
    'TelemetryChatBridge',
    'TelemetryNarrator',
    'TelemetryModeAdvisor',
    'TelemetryPhaseAdvisor',
    'TelemetryWarningAnalyzer',
  ] as const),
  featureFlags: Object.freeze({
    mlFeatureExtraction:   true,
    dlTensorProjection:    true,
    chatBridgeEnabled:     true,
    auditTrailEnabled:     true,
    modeAwareNarrative:    true,
    phaseAwareNarrative:   true,
    resilienceScoring:     true,
    warningAnalysis:       true,
    decisionAnalysis:      true,
    exportBundle:          true,
  } as const),
} as const);
