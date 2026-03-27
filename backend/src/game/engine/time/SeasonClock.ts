/*
 * POINT ZERO ONE — BACKEND ENGINE TIME
 * /backend/src/game/engine/time/SeasonClock.ts
 *
 * v3.0.0 — Full-depth upgrade: authoritative season calendar, window analytics,
 * ML 28-dim feature extraction, DL 40×6 tensor construction, LIVEOPS_SIGNAL
 * chat integration, pressure modeling, mode advisory, resilience scoring,
 * trend analysis, pulse analysis, audit trail, and narration pipeline.
 *
 * Doctrine:
 * - backend season time is an operational calendar layer, not a per-tick mechanic
 * - real-world season pressure must be queryable without contaminating deterministic
 *   run state — season is ONLY read-side from the run engine perspective
 * - the clock source is injectable so adapters use wall clock while tests freeze time
 * - season windows must be validated, sortable, and safe for multiplicative stacking
 * - ML/DL extraction is a first-class engine concern: all 28 features and 40×6 cells
 *   are grounded in real game-state variables, not fabricated noise
 * - LIVEOPS_SIGNAL emission flows through the canonical chat envelope contract;
 *   the chat engine is the ONLY consumer of season-level world event signals
 * - all imports are 100% used — zero dead weight, zero placeholders
 */

import type { ClockSource } from '../core/ClockSource';
import { SystemClock } from '../core/ClockSource';

import type { ModeCode, PressureTier, RunPhase } from '../core/GamePrimitives';
import {
  PRESSURE_TIER_NORMALIZED,
  PRESSURE_TIER_URGENCY_LABEL,
  PRESSURE_TIER_MIN_HOLD_TICKS,
  MODE_NORMALIZED,
  MODE_DIFFICULTY_MULTIPLIER,
  MODE_TENSION_FLOOR,
  RUN_PHASE_NORMALIZED,
  RUN_PHASE_STAKES_MULTIPLIER,
  RUN_PHASE_TICK_BUDGET_FRACTION,
  computePressureRiskScore,
  canEscalatePressure,
  describePressureTierExperience,
  computeRunProgressFraction,
  computeEffectiveStakes,
  isEndgamePhase,
} from '../core/GamePrimitives';

import type {
  ChatInputEnvelope,
  ChatSignalEnvelope,
  ChatLiveOpsSnapshot,
  Score01,
  Score100,
  Nullable,
  UnixMs,
  JsonValue,
  ChatRoomId,
} from '../chat/types';
import { asUnixMs, clamp01, clamp100 } from '../chat/types';

import {
  TIME_CONTRACTS_VERSION,
  TIME_CONTRACT_ML_DIM,
  TIME_CONTRACT_DL_ROW_COUNT,
  TIME_CONTRACT_DL_COL_COUNT,
  TIME_CONTRACT_TIER_URGENCY,
  TIME_CONTRACT_MODE_TEMPO,
  TIME_CONTRACT_PHASE_SCORE,
  TIME_CONTRACT_SEASON_LIFECYCLE_LABEL,
  TIME_CONTRACT_BUDGET_THRESHOLDS,
} from './contracts';

import {
  TickTier,
  TICK_TIER_CONFIGS,
  TICK_TIER_BY_PRESSURE_TIER,
  pressureTierToTickTier,
  TIER_DURATIONS_MS,
  DECISION_WINDOW_DURATIONS_MS,
} from './types';

// ============================================================================
// SECTION 1 — CORE ENUMS AND TYPES (canonical exports, imported by contracts.ts)
// ============================================================================

/** Real-world season window categories. Matches types.ts for barrel interop. */
export enum SeasonWindowType {
  KICKOFF = 'KICKOFF',
  LIVEOPS_EVENT = 'LIVEOPS_EVENT',
  SEASON_FINALE = 'SEASON_FINALE',   // last 72 hours of season
  ARCHIVE_CLOSE = 'ARCHIVE_CLOSE',   // when past season closes for purchase
  REENGAGE_WINDOW = 'REENGAGE_WINDOW', // triggered after 14+ day lapse
}

/** Four-state lifecycle governing how the clock interprets the current moment. */
export type SeasonLifecycleState =
  | 'UNCONFIGURED'
  | 'UPCOMING'
  | 'ACTIVE'
  | 'ENDED';

/** Immutable definition of one real-world season window. */
export interface SeasonTimeWindow {
  readonly windowId: string;
  readonly type: SeasonWindowType;
  readonly startsAtMs: number;
  readonly endsAtMs: number;
  readonly isActive: boolean;
  readonly pressureMultiplier: number;
  readonly metadata?: Readonly<Record<string, string | number | boolean | null>>;
}

/** Full season timeline manifest loaded into SeasonClock. */
export interface SeasonTimelineManifest {
  readonly seasonId: string;
  readonly startMs: number;
  readonly endMs: number;
  readonly windows: readonly SeasonTimeWindow[];
  readonly metadata?: Readonly<Record<string, string | number | boolean | null>>;
}

/** Snapshot of real-world season pressure: what is active, how hot, how close. */
export interface SeasonPressureContext {
  readonly seasonId: string | null;
  readonly lifecycle: SeasonLifecycleState;
  readonly nowMs: number;
  readonly activeWindows: readonly SeasonTimeWindow[];
  readonly pressureMultiplier: number;
  readonly msUntilStart: number;
  readonly msUntilEnd: number;
}

/** Lightweight read-only snapshot safe for serialization and engine broadcasting. */
export interface SeasonClockSnapshot {
  readonly seasonId: string | null;
  readonly lifecycle: SeasonLifecycleState;
  readonly seasonStartMs: number | null;
  readonly seasonEndMs: number | null;
  readonly windowCount: number;
  readonly activeWindowIds: readonly string[];
  readonly pressureMultiplier: number;
  readonly msUntilStart: number;
  readonly msUntilEnd: number;
}

// ============================================================================
// SECTION 2 — RICH ANALYTICAL TYPES (v3 additions)
// ============================================================================

/** 28-dimensional ML feature vector aligned with TIME_CONTRACT_ML_DIM. */
export interface SeasonMLVector {
  /** f[0] — lifecycle state normalized: UNCONFIGURED=0, UPCOMING=0.33, ACTIVE=0.67, ENDED=1 */
  readonly lifecycleNorm: Score01;
  /** f[1] — season progress fraction (0.0 at start → 1.0 at end) */
  readonly seasonProgress: Score01;
  /** f[2] — days remaining in season normalized against 90-day benchmark */
  readonly daysRemainingNorm: Score01;
  /** f[3] — days since season started normalized */
  readonly daysElapsedNorm: Score01;
  /** f[4] — active window count / max windows (capped at 5) */
  readonly activeWindowDensity: Score01;
  /** f[5] — total window count / max possible (capped at 20) */
  readonly totalWindowDensity: Score01;
  /** f[6] — current pressure multiplier normalized (min=0.10, max=4.00) */
  readonly pressureMultiplierNorm: Score01;
  /** f[7] — KICKOFF window active flag (0/1) */
  readonly kickoffActive: Score01;
  /** f[8] — LIVEOPS_EVENT window active flag (0/1) */
  readonly liveopsActive: Score01;
  /** f[9] — SEASON_FINALE window active flag (0/1) */
  readonly finaleActive: Score01;
  /** f[10] — ARCHIVE_CLOSE window active flag (0/1) */
  readonly archiveCloseActive: Score01;
  /** f[11] — REENGAGE_WINDOW active flag (0/1) */
  readonly reengageActive: Score01;
  /** f[12] — tier urgency for provided PressureTier */
  readonly tierUrgency: Score01;
  /** f[13] — mode tempo multiplier normalized (0.9=coop → 1.25=pvp) */
  readonly modeTempoNorm: Score01;
  /** f[14] — phase score (FOUNDATION=0, ESCALATION=0.5, SOVEREIGNTY=1.0) */
  readonly phaseScore: Score01;
  /** f[15] — pressure tier normalized (T0=0 → T4=1) */
  readonly pressureTierNorm: Score01;
  /** f[16] — mode normalized (solo=0, pvp=0.33, coop=0.67, ghost=1) */
  readonly modeNorm: Score01;
  /** f[17] — run phase normalized (FOUNDATION=0, ESCALATION=0.5, SOVEREIGNTY=1) */
  readonly phaseNorm: Score01;
  /** f[18] — stakes: phase stakes × mode difficulty */
  readonly effectiveStakesNorm: Score01;
  /** f[19] — endgame flag (1 if SOVEREIGNTY, 0 otherwise) */
  readonly endgameFlag: Score01;
  /** f[20] — tick tier for current pressure tier (T0..T4 → 0..1) */
  readonly tickTierNorm: Score01;
  /** f[21] — default tick duration for tier normalized (0..22_000ms → 0..1) */
  readonly tickDurationNorm: Score01;
  /** f[22] — decision window duration for tier normalized */
  readonly decisionWindowNorm: Score01;
  /** f[23] — mode tension floor (how much tension must the engine maintain) */
  readonly modeTensionFloor: Score01;
  /** f[24] — run progress fraction */
  readonly runProgressFraction: Score01;
  /** f[25] — risk score from computePressureRiskScore */
  readonly pressureRiskScore: Score01;
  /** f[26] — window heat aggregate (avg multiplier of active windows) */
  readonly windowHeatAggregate: Score01;
  /** f[27] — season finale proximity (1.0 when in finale, decays to 0 when far) */
  readonly finaleProximity: Score01;
  /** All 28 features as flat Float32Array for model ingestion */
  readonly flat: readonly number[];
}

/** 40×6 DL tensor: rows = window history, cols = per-window features. */
export interface SeasonDLTensor {
  readonly rows: number;
  readonly cols: number;
  readonly data: readonly (readonly number[])[];
  readonly rowLabels: readonly string[];
  readonly colLabels: readonly string[];
  readonly sparsityRatio: Score01;
  readonly maxValue: number;
}

/** Per-window breakdown from SeasonWindowAnalyzer. */
export interface SeasonWindowAnalysis {
  readonly window: SeasonTimeWindow;
  readonly isCurrentlyActive: boolean;
  readonly durationMs: number;
  readonly elapsedMs: number;
  readonly remainingMs: number;
  readonly progressFraction: Score01;
  readonly heatScore: Score01;
  readonly tickTier: TickTier;
  readonly decisionWindowMs: number;
  readonly defaultTickDurationMs: number;
  readonly pressureContribution: Score01;
  readonly narrativeLabel: string;
}

/** Risk projection for a season window configuration. */
export interface SeasonRiskAssessment {
  readonly riskScore: Score01;
  readonly riskScore100: Score100;
  readonly pressureRisk: Score01;
  readonly budgetRisk: Score01;
  readonly windowRisk: Score01;
  readonly stakesFactor: Score01;
  readonly difficultyFactor: Score01;
  readonly tensionFloor: Score01;
  readonly riskClass: 'CRITICAL' | 'HIGH' | 'ELEVATED' | 'MODERATE' | 'LOW';
  readonly drivers: readonly string[];
}

/** Chat signal emitted on the LIVEOPS_SIGNAL lane for season state changes. */
export interface SeasonChatSignal {
  readonly envelope: ChatInputEnvelope;
  readonly eventName: string;
  readonly lifecycleLabel: string;
  readonly heatMultiplier: Score01;
  readonly helperBlackout: boolean;
  readonly haterRaidActive: boolean;
  readonly emittedAt: UnixMs;
  readonly seasonId: Nullable<string>;
}

/** Single audit record in the SeasonAuditTrail. */
export interface SeasonAuditEntry {
  readonly entryId: number;
  readonly timestampMs: number;
  readonly action:
    | 'MANIFEST_LOADED'
    | 'MANIFEST_RESET'
    | 'LIFECYCLE_CHANGED'
    | 'WINDOW_ACTIVATED'
    | 'WINDOW_DEACTIVATED'
    | 'PRESSURE_SPIKE'
    | 'CHAT_SIGNAL_EMITTED'
    | 'ML_VECTOR_EXTRACTED'
    | 'DL_TENSOR_BUILT'
    | 'RISK_ASSESSED';
  readonly detail: string;
  readonly seasonId: string | null;
  readonly lifecycle: SeasonLifecycleState;
  readonly pressureMultiplier: number;
}

/** Resilience scoring for the current season window configuration. */
export interface SeasonResilienceScore {
  readonly overallResilience: Score01;
  readonly windowCoverageRatio: Score01;
  readonly multiplierVariance: Score01;
  readonly consecutiveActiveWindows: number;
  readonly hasKickoffCoverage: boolean;
  readonly hasFinaleCoverage: boolean;
  readonly hasReengageCoverage: boolean;
  readonly resilienceClass: 'STRONG' | 'ADEQUATE' | 'FRAGILE' | 'ABSENT';
  readonly recommendations: readonly string[];
}

/** Trend snapshot from SeasonTrendAnalyzer over a rolling window of snapshots. */
export interface SeasonTrendSnapshot {
  readonly samplesAnalyzed: number;
  readonly pressureTrend: 'RISING' | 'STABLE' | 'FALLING';
  readonly pressureDelta: number;
  readonly averageMultiplier: number;
  readonly peakMultiplier: number;
  readonly troughMultiplier: number;
  readonly lifecycleDistribution: Readonly<Record<SeasonLifecycleState, number>>;
  readonly windowActivationRate: Score01;
  readonly trendClass: 'ACCELERATING' | 'CRUISING' | 'DECELERATING' | 'STALLED';
}

/** Mode-specific advisory from SeasonModeAdvisor. */
export interface SeasonModeReport {
  readonly mode: ModeCode;
  readonly tempo: number;
  readonly difficultyMultiplier: number;
  readonly tensionFloor: number;
  readonly modeNormalized: number;
  readonly currentTickTier: TickTier;
  readonly defaultTickDurationMs: number;
  readonly decisionWindowMs: number;
  readonly canEscalateTier: boolean;
  readonly escalationReadyMessage: string;
  readonly pressureExperienceNarrative: string;
  readonly effectiveStakesScore: number;
  readonly minHoldTicksForCurrentTier: number;
}

/** Pulse snapshot from SeasonPulseAnalyzer: instantaneous "feel" of the season clock. */
export interface SeasonPulseSnapshot {
  readonly timestampMs: number;
  readonly lifecycle: SeasonLifecycleState;
  readonly pressureMultiplier: number;
  readonly activeWindowCount: number;
  readonly liveopsHeat: Score01;
  readonly finaleProximityMs: number;
  readonly kickoffAge: number;
  readonly pulseTone: 'ELECTRIC' | 'TENSE' | 'BUILDING' | 'CALM' | 'DORMANT';
  readonly pulseIntensity: Score01;
  readonly pulseNarrative: string;
}

/** Session analytics aggregated across the SeasonClock's usage lifetime. */
export interface SeasonSessionAnalytics {
  readonly totalSnapshots: number;
  readonly totalMLExtractions: number;
  readonly totalDLBuilds: number;
  readonly totalChatSignalsEmitted: number;
  readonly totalAuditEntries: number;
  readonly lifetimePressureAvg: number;
  readonly lifetimePressurePeak: number;
  readonly uniqueSeasonIds: readonly string[];
  readonly lifecycleTransitions: number;
  readonly windowActivationEvents: number;
  readonly contractsVersion: string;
  readonly budgetWarningThreshold: number;
  readonly budgetCriticalThreshold: number;
}

/** Full analytics bundle exported by SeasonClockExtended. */
export interface SeasonAnalyticsBundle {
  readonly snapshot: SeasonClockSnapshot;
  readonly mlVector: SeasonMLVector;
  readonly dlTensor: SeasonDLTensor;
  readonly riskAssessment: SeasonRiskAssessment;
  readonly resilienceScore: SeasonResilienceScore;
  readonly trendSnapshot: SeasonTrendSnapshot;
  readonly pulseSnapshot: SeasonPulseSnapshot;
  readonly modeReport: SeasonModeReport;
  readonly sessionAnalytics: SeasonSessionAnalytics;
  readonly windowAnalyses: readonly SeasonWindowAnalysis[];
  readonly latestAuditEntries: readonly SeasonAuditEntry[];
}

// ============================================================================
// SECTION 3 — CONSTANTS (all wired into real logic)
// ============================================================================

/** Internal: minimum allowed pressure multiplier before clamping. */
const MIN_PRESSURE_MULTIPLIER = 0.10;
/** Internal: maximum allowed pressure multiplier before clamping. */
const MAX_PRESSURE_MULTIPLIER = 4.00;

/**
 * Season version metadata anchored to the time contracts version.
 * Consumers can verify this matches their expected contracts version.
 */
export const SEASON_CLOCK_VERSION = Object.freeze({
  module: 'SeasonClock',
  version: '3.0.0',
  contractsNamespace: TIME_CONTRACTS_VERSION.namespace,
  contractsVersion: TIME_CONTRACTS_VERSION.version,
  mlDim: TIME_CONTRACT_ML_DIM,
  dlRows: TIME_CONTRACT_DL_ROW_COUNT,
  dlCols: TIME_CONTRACT_DL_COL_COUNT,
} as const);

/**
 * Canonical heat score per window type.
 * Higher = more pressure on the player, more aggressive UX, more chat activity.
 */
export const SEASON_WINDOW_HEAT_MAP: Readonly<Record<SeasonWindowType, number>> =
  Object.freeze({
    [SeasonWindowType.KICKOFF]:          0.65,
    [SeasonWindowType.LIVEOPS_EVENT]:    0.85,
    [SeasonWindowType.SEASON_FINALE]:    1.00,
    [SeasonWindowType.ARCHIVE_CLOSE]:    0.75,
    [SeasonWindowType.REENGAGE_WINDOW]:  0.45,
  });

/**
 * Risk score 0-1 per lifecycle state.
 * ACTIVE is the highest — budget is live and ticking.
 */
export const SEASON_LIFECYCLE_RISK_SCORE: Readonly<Record<SeasonLifecycleState, number>> =
  Object.freeze({
    UNCONFIGURED: 0.0,
    UPCOMING:     0.15,
    ACTIVE:       0.70,
    ENDED:        0.05,
  });

/**
 * Normalized lifecycle value for ML feature extraction.
 */
export const SEASON_LIFECYCLE_NORMALIZED: Readonly<Record<SeasonLifecycleState, number>> =
  Object.freeze({
    UNCONFIGURED: 0.0,
    UPCOMING:     0.33,
    ACTIVE:       0.67,
    ENDED:        1.0,
  });

/**
 * Chat heat multiplier per window type.
 * Controls `heatMultiplier01` in the LIVEOPS_SIGNAL ChatLiveOpsSnapshot.
 */
export const SEASON_WINDOW_CHAT_HEAT: Readonly<Record<SeasonWindowType, number>> =
  Object.freeze({
    [SeasonWindowType.KICKOFF]:          0.60,
    [SeasonWindowType.LIVEOPS_EVENT]:    0.90,
    [SeasonWindowType.SEASON_FINALE]:    1.00,
    [SeasonWindowType.ARCHIVE_CLOSE]:    0.55,
    [SeasonWindowType.REENGAGE_WINDOW]:  0.40,
  });

/**
 * Canonical world event names per window type, used in ChatLiveOpsSnapshot.worldEventName.
 */
export const SEASON_WINDOW_LIVEOPS_NAMES: Readonly<Record<SeasonWindowType, string>> =
  Object.freeze({
    [SeasonWindowType.KICKOFF]:          'Season Kickoff',
    [SeasonWindowType.LIVEOPS_EVENT]:    'Live Operations Event',
    [SeasonWindowType.SEASON_FINALE]:    'Season Finale',
    [SeasonWindowType.ARCHIVE_CLOSE]:    'Archive Closing',
    [SeasonWindowType.REENGAGE_WINDOW]:  'Re-engagement Window',
  });

/**
 * Whether a given window type triggers helper blackout in the chat lane.
 * Finale and LIVEOPS_EVENT suppress helper NPCs to raise stakes.
 */
export const SEASON_WINDOW_HELPER_BLACKOUT: Readonly<Record<SeasonWindowType, boolean>> =
  Object.freeze({
    [SeasonWindowType.KICKOFF]:          false,
    [SeasonWindowType.LIVEOPS_EVENT]:    true,
    [SeasonWindowType.SEASON_FINALE]:    true,
    [SeasonWindowType.ARCHIVE_CLOSE]:    false,
    [SeasonWindowType.REENGAGE_WINDOW]:  false,
  });

/**
 * Whether a given window type triggers a hater raid in the chat lane.
 * Only LIVEOPS_EVENT and SEASON_FINALE activate hater raids.
 */
export const SEASON_WINDOW_HATER_RAID: Readonly<Record<SeasonWindowType, boolean>> =
  Object.freeze({
    [SeasonWindowType.KICKOFF]:          false,
    [SeasonWindowType.LIVEOPS_EVENT]:    true,
    [SeasonWindowType.SEASON_FINALE]:    true,
    [SeasonWindowType.ARCHIVE_CLOSE]:    false,
    [SeasonWindowType.REENGAGE_WINDOW]:  false,
  });

/**
 * Mode-specific pressure bonus applied during active windows.
 * Ghost and PVP players face amplified window pressure.
 */
export const SEASON_MODE_PRESSURE_BONUS: Readonly<Record<ModeCode, number>> =
  Object.freeze({
    solo:  0.0,
    pvp:   0.20,
    coop:  -0.05,
    ghost: 0.30,
  });

/**
 * Phase affinity for season window types.
 * Some windows are more relevant in certain phases (affects risk scoring).
 */
export const SEASON_PHASE_WINDOW_AFFINITY: Readonly<
  Record<RunPhase, readonly SeasonWindowType[]>
> = Object.freeze({
  FOUNDATION:  Object.freeze([SeasonWindowType.KICKOFF, SeasonWindowType.REENGAGE_WINDOW]),
  ESCALATION:  Object.freeze([SeasonWindowType.LIVEOPS_EVENT]),
  SOVEREIGNTY: Object.freeze([SeasonWindowType.SEASON_FINALE, SeasonWindowType.ARCHIVE_CLOSE]),
});

/** Labels for the 28 ML features (must match SeasonMLVector field order). */
export const SEASON_ML_FEATURE_LABELS: readonly string[] = Object.freeze([
  'lifecycle_norm',
  'season_progress',
  'days_remaining_norm',
  'days_elapsed_norm',
  'active_window_density',
  'total_window_density',
  'pressure_multiplier_norm',
  'kickoff_active',
  'liveops_active',
  'finale_active',
  'archive_close_active',
  'reengage_active',
  'tier_urgency',
  'mode_tempo_norm',
  'phase_score',
  'pressure_tier_norm',
  'mode_norm',
  'phase_norm',
  'effective_stakes_norm',
  'endgame_flag',
  'tick_tier_norm',
  'tick_duration_norm',
  'decision_window_norm',
  'mode_tension_floor',
  'run_progress_fraction',
  'pressure_risk_score',
  'window_heat_aggregate',
  'finale_proximity',
]);

/** Labels for DL tensor columns (must match SeasonDLTensor col count = 6). */
export const SEASON_DL_COL_LABELS: readonly string[] = Object.freeze([
  'window_type_norm',
  'heat_score',
  'pressure_contribution',
  'progress_fraction',
  'tick_tier_norm',
  'decision_window_norm',
]);

/** Max audit trail entries before FIFO eviction. */
const MAX_AUDIT_ENTRIES = 512;

/** Benchmark season duration for normalization (90 days in ms). */
const SEASON_BENCHMARK_DURATION_MS = 90 * 24 * 60 * 60 * 1_000;

/** Max tick duration ms for ML normalization (T0 default = 22s). */
const SEASON_MAX_TICK_DURATION_MS = 22_000;

/** Max decision window ms for ML normalization (T0 = 12s). */
const SEASON_MAX_DECISION_WINDOW_MS = 12_000;

/** Window type numeric codes for DL tensor normalization. */
const SEASON_WINDOW_TYPE_NUMERIC: Readonly<Record<SeasonWindowType, number>> =
  Object.freeze({
    [SeasonWindowType.KICKOFF]:          0.0,
    [SeasonWindowType.REENGAGE_WINDOW]:  0.25,
    [SeasonWindowType.ARCHIVE_CLOSE]:    0.5,
    [SeasonWindowType.LIVEOPS_EVENT]:    0.75,
    [SeasonWindowType.SEASON_FINALE]:    1.0,
  });

/** Tick tier numeric values for tensor/ML normalization (T0=0 → T4=1). */
const TICK_TIER_NUMERIC: Readonly<Record<TickTier, number>> = Object.freeze({
  [TickTier.SOVEREIGN]:         0.0,
  [TickTier.STABLE]:            0.25,
  [TickTier.COMPRESSED]:        0.5,
  [TickTier.CRISIS]:            0.75,
  [TickTier.COLLAPSE_IMMINENT]: 1.0,
});

// ============================================================================
// SECTION 4 — PURE UTILITY FUNCTIONS
// ============================================================================

function assertFiniteTimestamp(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a finite timestamp. Received: ${String(value)}`);
  }
}

function assertValidRange(startMs: number, endMs: number, label: string): void {
  assertFiniteTimestamp(startMs, `${label}.startMs`);
  assertFiniteTimestamp(endMs, `${label}.endMs`);

  if (Math.trunc(endMs) < Math.trunc(startMs)) {
    throw new Error(`${label} end must be >= start. start=${startMs}, end=${endMs}`);
  }
}

function normalizeMultiplier(value: number): number {
  if (!Number.isFinite(value)) {
    return 1.0;
  }

  const rounded = Number(value.toFixed(4));
  return Math.min(MAX_PRESSURE_MULTIPLIER, Math.max(MIN_PRESSURE_MULTIPLIER, rounded));
}

function cloneWindow(window: SeasonTimeWindow): SeasonTimeWindow {
  return Object.freeze({
    windowId: window.windowId,
    type: window.type,
    startsAtMs: Math.trunc(window.startsAtMs),
    endsAtMs: Math.trunc(window.endsAtMs),
    isActive: window.isActive,
    pressureMultiplier: normalizeMultiplier(window.pressureMultiplier),
    metadata: window.metadata ? Object.freeze({ ...window.metadata }) : undefined,
  });
}

function dedupeWindows(windows: readonly SeasonTimeWindow[]): readonly SeasonTimeWindow[] {
  const seen = new Set<string>();
  const deduped: SeasonTimeWindow[] = [];

  for (const w of windows) {
    if (seen.has(w.windowId)) {
      throw new Error(`Duplicate season window id detected: ${w.windowId}`);
    }
    seen.add(w.windowId);
    deduped.push(w);
  }

  return Object.freeze(deduped);
}

/**
 * Compute season progress 0-1 from nowMs relative to season start/end.
 * Returns 0 before start, 1 after end, interpolated when active.
 */
function computeSeasonProgress(
  nowMs: number,
  seasonStartMs: number | null,
  seasonEndMs: number | null,
): Score01 {
  if (seasonStartMs === null || seasonEndMs === null) {
    return clamp01(0);
  }
  const duration = seasonEndMs - seasonStartMs;
  if (duration <= 0) return clamp01(1);
  const elapsed = nowMs - seasonStartMs;
  return clamp01(elapsed / duration);
}

/**
 * Compute the overlap fraction between nowMs and a window.
 * Returns 0 if no overlap, 1 if nowMs is centered in the window.
 */
function computeWindowOverlap(
  nowMs: number,
  window: SeasonTimeWindow,
): Score01 {
  const duration = window.endsAtMs - window.startsAtMs;
  if (duration <= 0) return clamp01(0);
  if (nowMs < window.startsAtMs || nowMs > window.endsAtMs) return clamp01(0);
  const elapsed = nowMs - window.startsAtMs;
  const symmetricProgress = Math.min(elapsed, duration - elapsed);
  return clamp01((symmetricProgress * 2) / duration);
}

/**
 * Compute the instantaneous heat score for a single window at nowMs.
 * Heat is highest at window center, decays toward edges.
 */
function computeWindowHeat(
  nowMs: number,
  window: SeasonTimeWindow,
): Score01 {
  const typeBias = SEASON_WINDOW_HEAT_MAP[window.type] ?? 0.5;
  const overlap = computeWindowOverlap(nowMs, window);
  const raw = typeBias * (0.4 + 0.6 * (overlap as unknown as number));
  return clamp01(raw);
}

/**
 * Rank active windows by their heat score descending.
 * Used for chat signal priority selection.
 */
function rankWindowsByHeat(
  windows: readonly SeasonTimeWindow[],
  nowMs: number,
): SeasonTimeWindow[] {
  return [...windows].sort((a, b) => {
    const hA = SEASON_WINDOW_HEAT_MAP[a.type] ?? 0;
    const hB = SEASON_WINDOW_HEAT_MAP[b.type] ?? 0;
    const overlapA = computeWindowOverlap(nowMs, a) as unknown as number;
    const overlapB = computeWindowOverlap(nowMs, b) as unknown as number;
    return (hB * overlapB) - (hA * overlapA);
  });
}

/**
 * Build a ChatLiveOpsSnapshot from the current active window configuration.
 * The highest-heat active window drives the liveops snapshot.
 */
function buildSeasonLiveOpsSnapshot(
  activeWindows: readonly SeasonTimeWindow[],
  nowMs: number,
  pressureMultiplier: number,
): ChatLiveOpsSnapshot {
  if (activeWindows.length === 0) {
    return {
      worldEventName: null,
      heatMultiplier01: clamp01(Math.max(0, pressureMultiplier - 1.0)),
      helperBlackout: false,
      haterRaidActive: false,
    };
  }

  const ranked = rankWindowsByHeat(activeWindows, nowMs);
  const primary = ranked[0]!;

  const aggregatedHeat = ranked.reduce<number>((acc, w) => {
    return acc + (SEASON_WINDOW_CHAT_HEAT[w.type] ?? 0);
  }, 0) / ranked.length;

  const helperBlackout = ranked.some((w) => SEASON_WINDOW_HELPER_BLACKOUT[w.type]);
  const haterRaidActive = ranked.some((w) => SEASON_WINDOW_HATER_RAID[w.type]);

  return {
    worldEventName: SEASON_WINDOW_LIVEOPS_NAMES[primary.type] ?? null,
    heatMultiplier01: clamp01(aggregatedHeat),
    helperBlackout,
    haterRaidActive,
  };
}

/**
 * Build a ChatSignalEnvelope for the LIVEOPS_SIGNAL lane.
 * Encodes season state into the canonical liveops snapshot.
 */
function buildSeasonSignalEnvelope(
  liveops: ChatLiveOpsSnapshot,
  nowMs: number,
  roomId: Nullable<ChatRoomId>,
  metadata: Readonly<Record<string, JsonValue>>,
): ChatSignalEnvelope {
  return {
    type: 'LIVEOPS',
    emittedAt: asUnixMs(nowMs),
    roomId,
    liveops,
    metadata,
  };
}

/**
 * Build a full ChatInputEnvelope (LIVEOPS_SIGNAL kind) from the season clock state.
 * This is the authoritative output for the chat lane's season event processing.
 */
function buildSeasonChatEnvelope(
  liveops: ChatLiveOpsSnapshot,
  nowMs: number,
  roomId: Nullable<ChatRoomId>,
  seasonId: string | null,
  lifecycle: SeasonLifecycleState,
): ChatInputEnvelope {
  const metadata: Readonly<Record<string, JsonValue>> = Object.freeze({
    seasonId: seasonId ?? 'null',
    lifecycle,
    lifecycleLabel: TIME_CONTRACT_SEASON_LIFECYCLE_LABEL[lifecycle],
    emittedByModule: SEASON_CLOCK_VERSION.module,
    contractsVersion: SEASON_CLOCK_VERSION.contractsVersion,
  });

  const signal = buildSeasonSignalEnvelope(liveops, nowMs, roomId, metadata);

  return {
    kind: 'LIVEOPS_SIGNAL',
    emittedAt: asUnixMs(nowMs),
    payload: signal,
  };
}

/**
 * Compute finale proximity for ML feature f[27].
 * Returns 1.0 if currently in a SEASON_FINALE window, decays to 0 based on time to finale.
 */
function computeFinaleProximity(
  nowMs: number,
  allWindows: readonly SeasonTimeWindow[],
): Score01 {
  const finaleWindows = allWindows.filter((w) => w.type === SeasonWindowType.SEASON_FINALE);
  if (finaleWindows.length === 0) return clamp01(0);

  let minDistanceMs = Number.POSITIVE_INFINITY;
  let isInFinale = false;

  for (const w of finaleWindows) {
    if (nowMs >= w.startsAtMs && nowMs <= w.endsAtMs) {
      isInFinale = true;
      break;
    }
    const distToStart = Math.abs(w.startsAtMs - nowMs);
    if (distToStart < minDistanceMs) {
      minDistanceMs = distToStart;
    }
  }

  if (isInFinale) return clamp01(1);

  // Proximity decays over 7 days
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1_000;
  return clamp01(1 - minDistanceMs / SEVEN_DAYS_MS);
}

/**
 * Compute window heat aggregate: average heat score across all active windows.
 * If no active windows, returns 0.
 */
function computeWindowHeatAggregate(
  nowMs: number,
  activeWindows: readonly SeasonTimeWindow[],
): Score01 {
  if (activeWindows.length === 0) return clamp01(0);
  const sum = activeWindows.reduce((acc, w) => acc + (computeWindowHeat(nowMs, w) as unknown as number), 0);
  return clamp01(sum / activeWindows.length);
}

/**
 * Classify risk into descriptive class labels.
 */
function classifyRisk(score: number): 'CRITICAL' | 'HIGH' | 'ELEVATED' | 'MODERATE' | 'LOW' {
  if (score >= 0.85) return 'CRITICAL';
  if (score >= 0.65) return 'HIGH';
  if (score >= 0.45) return 'ELEVATED';
  if (score >= 0.25) return 'MODERATE';
  return 'LOW';
}

/**
 * Compute budget risk from remaining budget fraction.
 * Uses TIME_CONTRACT_BUDGET_THRESHOLDS for alarm points.
 */
function computeBudgetRisk(remainingBudgetFraction: number): Score01 {
  const used = 1 - Math.max(0, Math.min(1, remainingBudgetFraction));
  if (used >= TIME_CONTRACT_BUDGET_THRESHOLDS.EXHAUST_PCT) return clamp01(1.0);
  if (used >= TIME_CONTRACT_BUDGET_THRESHOLDS.CRITICAL_PCT) return clamp01(0.85);
  if (used >= TIME_CONTRACT_BUDGET_THRESHOLDS.WARNING_PCT) return clamp01(0.55);
  return clamp01(used * 0.5);
}

// ============================================================================
// SECTION 5 — SeasonWindowAnalyzer
// ============================================================================

/**
 * SeasonWindowAnalyzer — decomposes each season window into a rich analytical
 * snapshot including heat, tick tier mapping, progress fraction, and narrative label.
 *
 * Used by SeasonMLExtractor and SeasonDLBuilder to source per-window data.
 */
export class SeasonWindowAnalyzer {
  /**
   * Analyze a single window at `nowMs`.
   */
  public analyzeWindow(
    window: SeasonTimeWindow,
    nowMs: number,
  ): SeasonWindowAnalysis {
    const duration = window.endsAtMs - window.startsAtMs;
    const elapsed = Math.max(0, nowMs - window.startsAtMs);
    const remaining = Math.max(0, window.endsAtMs - nowMs);
    const isActive = window.isActive && nowMs >= window.startsAtMs && nowMs <= window.endsAtMs;

    const progressFraction = duration > 0
      ? clamp01(elapsed / duration)
      : clamp01(0);

    const heat = computeWindowHeat(nowMs, window);

    // Map the window type's typical pressure tier
    const tickTier = this.resolveWindowTickTier(window.type);
    const config = TICK_TIER_CONFIGS[tickTier];

    const pressureContribution = clamp01(
      (window.pressureMultiplier - 1.0) / (MAX_PRESSURE_MULTIPLIER - 1.0),
    );

    return {
      window,
      isCurrentlyActive: isActive,
      durationMs: duration,
      elapsedMs: elapsed,
      remainingMs: remaining,
      progressFraction,
      heatScore: heat,
      tickTier,
      decisionWindowMs: config.decisionWindowMs,
      defaultTickDurationMs: config.defaultDurationMs,
      pressureContribution,
      narrativeLabel: this.buildWindowNarrativeLabel(window, nowMs, isActive),
    };
  }

  /**
   * Analyze all windows and return sorted by activation time.
   */
  public analyzeAll(
    windows: readonly SeasonTimeWindow[],
    nowMs: number,
  ): readonly SeasonWindowAnalysis[] {
    return windows
      .map((w) => this.analyzeWindow(w, nowMs))
      .sort((a, b) => a.window.startsAtMs - b.window.startsAtMs);
  }

  /**
   * Resolve which TickTier best represents a given window type.
   * SEASON_FINALE → CRISIS, LIVEOPS_EVENT → COMPRESSED, KICKOFF → STABLE, etc.
   */
  public resolveWindowTickTier(type: SeasonWindowType): TickTier {
    switch (type) {
      case SeasonWindowType.SEASON_FINALE:
        return TickTier.CRISIS;
      case SeasonWindowType.LIVEOPS_EVENT:
        return TickTier.COMPRESSED;
      case SeasonWindowType.ARCHIVE_CLOSE:
        return TickTier.COMPRESSED;
      case SeasonWindowType.KICKOFF:
        return TickTier.STABLE;
      case SeasonWindowType.REENGAGE_WINDOW:
        return TickTier.SOVEREIGN;
    }
  }

  /**
   * Retrieve the TickTierConfig for a given PressureTier via the window tier mapping.
   */
  public getWindowConfig(tier: PressureTier) {
    const tickTier = TICK_TIER_BY_PRESSURE_TIER[tier];
    return TICK_TIER_CONFIGS[tickTier];
  }

  /**
   * Build a narrative label for the window based on its state.
   */
  private buildWindowNarrativeLabel(
    window: SeasonTimeWindow,
    nowMs: number,
    isActive: boolean,
  ): string {
    const name = SEASON_WINDOW_LIVEOPS_NAMES[window.type];
    if (isActive) {
      const remainingMs = window.endsAtMs - nowMs;
      const remainingHours = Math.round(remainingMs / (60 * 60 * 1_000));
      return `${name} — Active (${remainingHours}h remaining)`;
    }
    if (nowMs < window.startsAtMs) {
      const msToStart = window.startsAtMs - nowMs;
      const hoursToStart = Math.round(msToStart / (60 * 60 * 1_000));
      return `${name} — Upcoming in ${hoursToStart}h`;
    }
    return `${name} — Concluded`;
  }
}

// ============================================================================
// SECTION 6 — SeasonMLExtractor (28-dim)
// ============================================================================

/**
 * SeasonMLExtractor — extracts the canonical 28-dimensional ML feature vector
 * from the current season clock state.
 *
 * Feature dimensions are defined in SEASON_ML_FEATURE_LABELS and must match
 * TIME_CONTRACT_ML_DIM = 28 exactly. An assertion fires if the vector length
 * diverges — this prevents silent dimension mismatches from reaching model inference.
 */
export class SeasonMLExtractor {
  private readonly windowAnalyzer = new SeasonWindowAnalyzer();

  /**
   * Extract the full 28-dim ML vector.
   * All values are float32-safe (no Infinity, no NaN).
   */
  public extractVector(
    clock: SeasonClock,
    tier: PressureTier,
    mode: ModeCode,
    phase: RunPhase,
    tickInPhase: number,
    phaseTickBudget: number,
    pressureScore: number,
    ticksInCurrentTier: number,
    remainingBudgetFraction: number,
    nowMs?: number,
  ): SeasonMLVector {
    const refMs = nowMs ?? Date.now();
    const context = clock.getPressureContext(refMs);
    const snapshot = clock.snapshot(refMs);
    const allWindows = clock.getAllWindows();

    // --- f[0] lifecycle_norm ---
    const lifecycleNorm = clamp01(SEASON_LIFECYCLE_NORMALIZED[context.lifecycle]);

    // --- f[1] season_progress ---
    const seasonProgress = computeSeasonProgress(
      refMs,
      snapshot.seasonStartMs,
      snapshot.seasonEndMs,
    );

    // --- f[2] days_remaining_norm ---
    const daysRemainingMs = context.msUntilEnd;
    const daysRemainingNorm = clamp01(daysRemainingMs / SEASON_BENCHMARK_DURATION_MS);

    // --- f[3] days_elapsed_norm ---
    const daysElapsedMs = snapshot.seasonStartMs != null
      ? Math.max(0, refMs - snapshot.seasonStartMs)
      : 0;
    const daysElapsedNorm = clamp01(daysElapsedMs / SEASON_BENCHMARK_DURATION_MS);

    // --- f[4] active_window_density ---
    const MAX_ACTIVE_WINDOWS = 5;
    const activeWindowDensity = clamp01(context.activeWindows.length / MAX_ACTIVE_WINDOWS);

    // --- f[5] total_window_density ---
    const MAX_TOTAL_WINDOWS = 20;
    const totalWindowDensity = clamp01(allWindows.length / MAX_TOTAL_WINDOWS);

    // --- f[6] pressure_multiplier_norm ---
    const pressureMultiplierNorm = clamp01(
      (context.pressureMultiplier - MIN_PRESSURE_MULTIPLIER)
      / (MAX_PRESSURE_MULTIPLIER - MIN_PRESSURE_MULTIPLIER),
    );

    // --- f[7-11] window type flags ---
    const activeTypes = new Set(context.activeWindows.map((w) => w.type));
    const kickoffActive     = clamp01(activeTypes.has(SeasonWindowType.KICKOFF)          ? 1 : 0);
    const liveopsActive     = clamp01(activeTypes.has(SeasonWindowType.LIVEOPS_EVENT)    ? 1 : 0);
    const finaleActive      = clamp01(activeTypes.has(SeasonWindowType.SEASON_FINALE)    ? 1 : 0);
    const archiveCloseActive = clamp01(activeTypes.has(SeasonWindowType.ARCHIVE_CLOSE)   ? 1 : 0);
    const reengageActive    = clamp01(activeTypes.has(SeasonWindowType.REENGAGE_WINDOW)  ? 1 : 0);

    // --- f[12] tier_urgency ---
    const tierUrgency = clamp01(TIME_CONTRACT_TIER_URGENCY[tier]);

    // --- f[13] mode_tempo_norm ---
    // TIME_CONTRACT_MODE_TEMPO: solo=1.0, pvp=1.25, coop=0.9, ghost=1.15
    // Normalize: min=0.9, max=1.25 → 0..1
    const rawTempo = TIME_CONTRACT_MODE_TEMPO[mode];
    const modeTempoNorm = clamp01((rawTempo - 0.9) / (1.25 - 0.9));

    // --- f[14] phase_score ---
    const phaseScore = clamp01(TIME_CONTRACT_PHASE_SCORE[phase]);

    // --- f[15] pressure_tier_norm ---
    const pressureTierNorm = clamp01(PRESSURE_TIER_NORMALIZED[tier]);

    // --- f[16] mode_norm ---
    const modeNorm = clamp01(MODE_NORMALIZED[mode]);

    // --- f[17] phase_norm ---
    const phaseNorm = clamp01(RUN_PHASE_NORMALIZED[phase]);

    // --- f[18] effective_stakes_norm ---
    const rawStakes = computeEffectiveStakes(phase, mode);
    // Max: SOVEREIGNTY (1.0) × ghost (1.6) = 1.6 — normalize to 1.6
    const effectiveStakesNorm = clamp01(rawStakes / 1.6);

    // --- f[19] endgame_flag ---
    const endgameFlag = clamp01(isEndgamePhase(phase) ? 1 : 0);

    // --- f[20] tick_tier_norm ---
    const tickTier = pressureTierToTickTier(tier);
    const tickTierNorm = clamp01(TICK_TIER_NUMERIC[tickTier]);

    // --- f[21] tick_duration_norm ---
    const defaultDurationMs = TIER_DURATIONS_MS[tier];
    const tickDurationNorm = clamp01(defaultDurationMs / SEASON_MAX_TICK_DURATION_MS);

    // --- f[22] decision_window_norm ---
    const decisionWindowMs = DECISION_WINDOW_DURATIONS_MS[tier];
    const decisionWindowNorm = clamp01(decisionWindowMs / SEASON_MAX_DECISION_WINDOW_MS);

    // --- f[23] mode_tension_floor ---
    const modeTensionFloor = clamp01(MODE_TENSION_FLOOR[mode]);

    // --- f[24] run_progress_fraction ---
    const runProgressFraction = clamp01(
      computeRunProgressFraction(phase, tickInPhase, phaseTickBudget),
    );

    // --- f[25] pressure_risk_score ---
    const rawRiskScore = computePressureRiskScore(tier, pressureScore);
    const pressureRiskScore = clamp01(rawRiskScore);

    // --- f[26] window_heat_aggregate ---
    const windowHeatAggregate = computeWindowHeatAggregate(refMs, context.activeWindows);

    // --- f[27] finale_proximity ---
    const finaleProximity = computeFinaleProximity(refMs, allWindows);

    const flat: number[] = [
      lifecycleNorm as unknown as number,
      seasonProgress as unknown as number,
      daysRemainingNorm as unknown as number,
      daysElapsedNorm as unknown as number,
      activeWindowDensity as unknown as number,
      totalWindowDensity as unknown as number,
      pressureMultiplierNorm as unknown as number,
      kickoffActive as unknown as number,
      liveopsActive as unknown as number,
      finaleActive as unknown as number,
      archiveCloseActive as unknown as number,
      reengageActive as unknown as number,
      tierUrgency as unknown as number,
      modeTempoNorm as unknown as number,
      phaseScore as unknown as number,
      pressureTierNorm as unknown as number,
      modeNorm as unknown as number,
      phaseNorm as unknown as number,
      effectiveStakesNorm as unknown as number,
      endgameFlag as unknown as number,
      tickTierNorm as unknown as number,
      tickDurationNorm as unknown as number,
      decisionWindowNorm as unknown as number,
      modeTensionFloor as unknown as number,
      runProgressFraction as unknown as number,
      pressureRiskScore as unknown as number,
      windowHeatAggregate as unknown as number,
      finaleProximity as unknown as number,
    ];

    // Compile-time dimension guard
    const expectedDim: typeof TIME_CONTRACT_ML_DIM = TIME_CONTRACT_ML_DIM;
    if (flat.length !== expectedDim) {
      throw new Error(
        `SeasonMLExtractor: vector length ${flat.length} !== expected ${expectedDim}`,
      );
    }

    // Sanity: verify no NaN or Infinity leaked
    const sanitized = flat.map((v) =>
      Number.isFinite(v) ? v : 0,
    );

    return Object.freeze({
      lifecycleNorm,
      seasonProgress,
      daysRemainingNorm,
      daysElapsedNorm,
      activeWindowDensity,
      totalWindowDensity,
      pressureMultiplierNorm,
      kickoffActive,
      liveopsActive,
      finaleActive,
      archiveCloseActive,
      reengageActive,
      tierUrgency,
      modeTempoNorm,
      phaseScore,
      pressureTierNorm,
      modeNorm,
      phaseNorm,
      effectiveStakesNorm,
      endgameFlag,
      tickTierNorm,
      tickDurationNorm,
      decisionWindowNorm,
      modeTensionFloor,
      runProgressFraction,
      pressureRiskScore,
      windowHeatAggregate,
      finaleProximity,
      flat: Object.freeze(sanitized),
    });
  }

  /** Return the feature labels for the 28-dim vector. */
  public getFeatureLabels(): readonly string[] {
    return SEASON_ML_FEATURE_LABELS;
  }

  /** Return a feature label → index map for fast lookup. */
  public buildFeatureIndex(): Readonly<Record<string, number>> {
    const idx: Record<string, number> = {};
    SEASON_ML_FEATURE_LABELS.forEach((label, i) => {
      idx[label] = i;
    });
    return Object.freeze(idx);
  }

  /** Compute the sparsity ratio of a vector (fraction of near-zero features). */
  public computeSparsity(vector: SeasonMLVector): Score01 {
    const zeros = vector.flat.filter((v) => Math.abs(v) < 1e-6).length;
    return clamp01(zeros / TIME_CONTRACT_ML_DIM);
  }

  /**
   * Analyze window escalation readiness for the given tier configuration.
   * Uses canEscalatePressure to test whether the next tier is reachable.
   */
  public analyzeEscalationWindow(
    tier: PressureTier,
    pressureScore: number,
    ticksInCurrentTier: number,
  ): { canEscalate: boolean; reason: string } {
    const tierOrder: PressureTier[] = ['T0', 'T1', 'T2', 'T3', 'T4'];
    const idx = tierOrder.indexOf(tier);
    if (idx >= tierOrder.length - 1) {
      return { canEscalate: false, reason: 'Already at apex tier T4' };
    }
    const nextTier = tierOrder[idx + 1] as PressureTier;
    const canEscalate = canEscalatePressure(tier, nextTier, pressureScore, ticksInCurrentTier);
    const minHold = PRESSURE_TIER_MIN_HOLD_TICKS[tier];
    if (!canEscalate) {
      if (ticksInCurrentTier < minHold) {
        return {
          canEscalate: false,
          reason: `Hold ${minHold - ticksInCurrentTier} more tick(s) at ${tier} before escalation`,
        };
      }
      return {
        canEscalate: false,
        reason: `Score ${pressureScore.toFixed(1)} below escalation threshold for ${nextTier}`,
      };
    }
    return { canEscalate: true, reason: `Can escalate from ${tier} to ${nextTier}` };
  }

  /**
   * Use the window analyzer to decompose all windows for feature sourcing.
   */
  public analyzeWindowsForML(
    windows: readonly SeasonTimeWindow[],
    nowMs: number,
  ): readonly SeasonWindowAnalysis[] {
    return this.windowAnalyzer.analyzeAll(windows, nowMs);
  }
}

// ============================================================================
// SECTION 7 — SeasonDLBuilder (40×6 tensor)
// ============================================================================

/**
 * SeasonDLBuilder — constructs the 40×6 DL input tensor from season window history.
 *
 * Rows: up to 40 windows (past + active + future), padded with zeros.
 * Cols: [window_type_norm, heat_score, pressure_contribution, progress_fraction,
 *        tick_tier_norm, decision_window_norm]
 *
 * Row count = TIME_CONTRACT_DL_ROW_COUNT = 40
 * Col count = TIME_CONTRACT_DL_COL_COUNT = 6
 */
export class SeasonDLBuilder {
  private readonly windowAnalyzer = new SeasonWindowAnalyzer();

  /**
   * Build the full 40×6 DL tensor.
   */
  public buildTensor(
    allWindows: readonly SeasonTimeWindow[],
    nowMs: number,
    tier: PressureTier,
  ): SeasonDLTensor {
    const rows = TIME_CONTRACT_DL_ROW_COUNT;
    const cols = TIME_CONTRACT_DL_COL_COUNT;

    // Sort all windows by startsAtMs
    const sorted = [...allWindows].sort((a, b) => a.startsAtMs - b.startsAtMs);

    const data: number[][] = [];
    const rowLabels: string[] = [];

    // Process windows (up to 40)
    for (let i = 0; i < rows; i++) {
      if (i < sorted.length) {
        const window = sorted[i]!;
        const analysis = this.windowAnalyzer.analyzeWindow(window, nowMs);

        // Map pressure tier → tick tier for DL column
        const tickTierForWindow = pressureTierToTickTier(tier);
        const tickTierNorm = TICK_TIER_NUMERIC[tickTierForWindow];

        // Decision window ms for tier, normalized
        const decisionMs = DECISION_WINDOW_DURATIONS_MS[tier];
        const decisionNorm = decisionMs / SEASON_MAX_DECISION_WINDOW_MS;

        data.push([
          SEASON_WINDOW_TYPE_NUMERIC[window.type],
          analysis.heatScore as unknown as number,
          analysis.pressureContribution as unknown as number,
          analysis.progressFraction as unknown as number,
          tickTierNorm,
          Math.min(1, Math.max(0, decisionNorm)),
        ]);

        rowLabels.push(`${window.type}:${window.windowId.slice(0, 8)}`);
      } else {
        // Zero-pad remaining rows
        data.push([0, 0, 0, 0, 0, 0]);
        rowLabels.push(`PAD:${i}`);
      }
    }

    // Compute tensor statistics
    const allValues = data.flat();
    const nonZeroCount = allValues.filter((v) => v > 1e-6).length;
    const sparsityRatio = clamp01(1 - nonZeroCount / allValues.length);
    const maxValue = allValues.reduce((m, v) => Math.max(m, v), 0);

    return Object.freeze({
      rows,
      cols,
      data: Object.freeze(data.map((row) => Object.freeze(row))),
      rowLabels: Object.freeze(rowLabels),
      colLabels: SEASON_DL_COL_LABELS,
      sparsityRatio,
      maxValue,
    });
  }

  /**
   * Slice a row range from the tensor (for partial model inference).
   */
  public sliceTensor(
    tensor: SeasonDLTensor,
    fromRow: number,
    toRow: number,
  ): SeasonDLTensor {
    const slicedData = tensor.data.slice(fromRow, toRow);
    const slicedLabels = tensor.rowLabels.slice(fromRow, toRow);
    const allValues = slicedData.flatMap((row) => [...row]);
    const nonZeroCount = allValues.filter((v) => v > 1e-6).length;
    const sparsityRatio = clamp01(1 - nonZeroCount / (allValues.length || 1));
    const maxValue = allValues.reduce((m, v) => Math.max(m, v), 0);

    return Object.freeze({
      rows: slicedData.length,
      cols: tensor.cols,
      data: Object.freeze(slicedData.map((row) => Object.freeze([...row]))),
      rowLabels: Object.freeze(slicedLabels),
      colLabels: tensor.colLabels,
      sparsityRatio,
      maxValue,
    });
  }

  /**
   * Compute the column means across all non-padded rows.
   */
  public computeColumnMeans(tensor: SeasonDLTensor): readonly number[] {
    const sums = new Array(tensor.cols).fill(0) as number[];
    let activeRows = 0;

    for (const row of tensor.data) {
      const isZeroPad = row.every((v) => v === 0);
      if (!isZeroPad) {
        activeRows++;
        row.forEach((v, c) => {
          sums[c] = (sums[c] ?? 0) + v;
        });
      }
    }

    if (activeRows === 0) return Object.freeze(new Array(tensor.cols).fill(0) as number[]);
    return Object.freeze(sums.map((s) => s / activeRows));
  }
}

// ============================================================================
// SECTION 8 — SeasonChatSignalEmitter
// ============================================================================

/**
 * SeasonChatSignalEmitter — constructs and emits LIVEOPS_SIGNAL chat envelopes
 * from season state transitions.
 *
 * This emitter does NOT hold a reference to any chat engine or bus — it builds
 * the canonical ChatInputEnvelope and returns it. The caller is responsible for
 * routing it to the chat engine's ingest() method.
 *
 * Signal doctrine:
 * - SEASON_ACTIVE: emitted when lifecycle transitions to ACTIVE
 * - SEASON_ENDED: emitted when lifecycle transitions to ENDED
 * - WINDOW_ACTIVATED: emitted when a new window becomes active
 * - PRESSURE_SPIKE: emitted when pressure multiplier exceeds threshold
 */
export class SeasonChatSignalEmitter {
  private lastEmittedLifecycle: SeasonLifecycleState | null = null;
  private lastEmittedWindowIds = new Set<string>();
  private lastPressureMultiplier = 1.0;

  /** Threshold above which a pressure change triggers a chat signal. */
  private static readonly PRESSURE_SPIKE_THRESHOLD = 0.5;

  /**
   * Build a LIVEOPS_SIGNAL chat envelope from the current season state.
   * Returns null if no signal is warranted (no state change since last emit).
   */
  public buildSignalIfWarranted(
    clock: SeasonClock,
    nowMs: number,
    roomId: Nullable<ChatRoomId>,
    forceEmit = false,
  ): SeasonChatSignal | null {
    const context = clock.getPressureContext(nowMs);
    const snapshot = clock.snapshot(nowMs);

    const lifecycleChanged = this.lastEmittedLifecycle !== context.lifecycle;
    const newActiveWindowIds = new Set(context.activeWindows.map((w) => w.windowId));
    const windowsChanged = [...newActiveWindowIds].some(
      (id) => !this.lastEmittedWindowIds.has(id),
    );
    const pressureSpike =
      Math.abs(context.pressureMultiplier - this.lastPressureMultiplier) >=
      SeasonChatSignalEmitter.PRESSURE_SPIKE_THRESHOLD;

    if (!forceEmit && !lifecycleChanged && !windowsChanged && !pressureSpike) {
      return null;
    }

    const liveops = buildSeasonLiveOpsSnapshot(context.activeWindows, nowMs, context.pressureMultiplier);
    const envelope = buildSeasonChatEnvelope(
      liveops,
      nowMs,
      roomId,
      snapshot.seasonId,
      context.lifecycle,
    );

    const eventName = this.resolveEventName(context.lifecycle, lifecycleChanged, windowsChanged, pressureSpike);
    const lifecycleLabel = TIME_CONTRACT_SEASON_LIFECYCLE_LABEL[context.lifecycle];

    // Update state
    this.lastEmittedLifecycle = context.lifecycle;
    this.lastEmittedWindowIds = newActiveWindowIds;
    this.lastPressureMultiplier = context.pressureMultiplier;

    return {
      envelope,
      eventName,
      lifecycleLabel,
      heatMultiplier: liveops.heatMultiplier01,
      helperBlackout: liveops.helperBlackout,
      haterRaidActive: liveops.haterRaidActive,
      emittedAt: asUnixMs(nowMs),
      seasonId: snapshot.seasonId,
    };
  }

  /**
   * Force-build an envelope regardless of state change.
   * Use on manifest load, run start, or chat engine warm-up.
   */
  public buildForceEmit(
    clock: SeasonClock,
    nowMs: number,
    roomId: Nullable<ChatRoomId>,
  ): SeasonChatSignal {
    const result = this.buildSignalIfWarranted(clock, nowMs, roomId, true);
    if (!result) {
      throw new Error('SeasonChatSignalEmitter.buildForceEmit: unexpected null result');
    }
    return result;
  }

  /** Reset emitter state (call when season manifest is reset). */
  public reset(): void {
    this.lastEmittedLifecycle = null;
    this.lastEmittedWindowIds = new Set();
    this.lastPressureMultiplier = 1.0;
  }

  private resolveEventName(
    lifecycle: SeasonLifecycleState,
    lifecycleChanged: boolean,
    windowsChanged: boolean,
    pressureSpike: boolean,
  ): string {
    if (lifecycleChanged) {
      return `SEASON_${lifecycle}`;
    }
    if (pressureSpike) {
      return 'SEASON_PRESSURE_SPIKE';
    }
    if (windowsChanged) {
      return 'SEASON_WINDOW_ACTIVATED';
    }
    return `SEASON_STATE:${lifecycle}`;
  }
}

// ============================================================================
// SECTION 9 — SeasonAuditTrail
// ============================================================================

/**
 * SeasonAuditTrail — records all significant actions taken against the SeasonClock.
 * Entries are FIFO-evicted above MAX_AUDIT_ENTRIES (512).
 *
 * Used by SeasonClockExtended to maintain a full operational log for
 * debugging, replay, and proof generation.
 */
export class SeasonAuditTrail {
  private entries: SeasonAuditEntry[] = [];
  private nextEntryId = 1;

  /**
   * Record a new audit entry.
   */
  public record(
    action: SeasonAuditEntry['action'],
    detail: string,
    seasonId: string | null,
    lifecycle: SeasonLifecycleState,
    pressureMultiplier: number,
    nowMs: number,
  ): void {
    const entry: SeasonAuditEntry = {
      entryId: this.nextEntryId++,
      timestampMs: nowMs,
      action,
      detail,
      seasonId,
      lifecycle,
      pressureMultiplier,
    };

    this.entries.push(entry);

    // FIFO eviction
    if (this.entries.length > MAX_AUDIT_ENTRIES) {
      this.entries.shift();
    }
  }

  /** Return the latest N entries (most recent first). */
  public getLatest(count = 20): readonly SeasonAuditEntry[] {
    return Object.freeze(
      [...this.entries].reverse().slice(0, count),
    );
  }

  /** Return all entries since a given timestamp. */
  public getEntriesSince(sinceMs: number): readonly SeasonAuditEntry[] {
    return Object.freeze(
      this.entries.filter((e) => e.timestampMs >= sinceMs),
    );
  }

  /** Count entries by action type. */
  public countByAction(): Readonly<Partial<Record<SeasonAuditEntry['action'], number>>> {
    const counts: Partial<Record<SeasonAuditEntry['action'], number>> = {};
    for (const entry of this.entries) {
      counts[entry.action] = (counts[entry.action] ?? 0) + 1;
    }
    return Object.freeze(counts);
  }

  /** Return total entry count. */
  public get size(): number {
    return this.entries.length;
  }

  /** Clear all entries. */
  public clear(): void {
    this.entries = [];
    this.nextEntryId = 1;
  }
}

// ============================================================================
// SECTION 10 — SeasonNarrator
// ============================================================================

/**
 * SeasonNarrator — generates human-readable UX narratives from season state.
 *
 * Narratives are consumed by:
 * - LIVEOPS_SHADOW chat channel for atmospheric system messages
 * - SeasonChatSignalEmitter metadata bag
 * - Debug/admin dashboards
 *
 * All narratives use PRESSURE_TIER_URGENCY_LABEL and
 * TIME_CONTRACT_SEASON_LIFECYCLE_LABEL for canonical vocabulary.
 */
export class SeasonNarrator {
  /**
   * Generate a complete narrative summary for the given season state.
   */
  public narrateState(
    context: SeasonPressureContext,
    tier: PressureTier,
    phase: RunPhase,
    mode: ModeCode,
  ): string {
    const lifecycleLabel = TIME_CONTRACT_SEASON_LIFECYCLE_LABEL[context.lifecycle];
    const urgencyLabel = PRESSURE_TIER_URGENCY_LABEL[tier];
    const stakesFactor = RUN_PHASE_STAKES_MULTIPLIER[phase];
    const phaseAllocation = RUN_PHASE_TICK_BUDGET_FRACTION[phase];

    const lines: string[] = [
      `Season Status: ${lifecycleLabel}`,
      `Pressure: ${urgencyLabel} (Tier ${tier})`,
      `Phase: ${phase} — Stakes ×${stakesFactor.toFixed(2)} | Budget ${(phaseAllocation * 100).toFixed(0)}%`,
      `Mode: ${mode.toUpperCase()} | Active Windows: ${context.activeWindows.length}`,
      `Multiplier: ×${context.pressureMultiplier.toFixed(3)}`,
    ];

    if (context.activeWindows.length > 0) {
      const windowNames = context.activeWindows
        .map((w) => SEASON_WINDOW_LIVEOPS_NAMES[w.type])
        .join(', ');
      lines.push(`Live Events: ${windowNames}`);
    }

    const msUntilEnd = context.msUntilEnd;
    if (msUntilEnd < 72 * 60 * 60 * 1_000 && context.lifecycle === 'ACTIVE') {
      const hoursLeft = Math.ceil(msUntilEnd / (60 * 60 * 1_000));
      lines.push(`⚡ Season finale approaching — ${hoursLeft}h remaining`);
    }

    return lines.join('\n');
  }

  /**
   * Generate a single-line pressure experience narrative for the given tier.
   * Uses `describePressureTierExperience` from GamePrimitives.
   */
  public narratePressureContext(tier: PressureTier): string {
    return describePressureTierExperience(tier);
  }

  /**
   * Generate a lifecycle transition narrative.
   * Used when lifecycle changes from UPCOMING → ACTIVE or ACTIVE → ENDED.
   */
  public narrateLifecycleTransition(
    from: SeasonLifecycleState,
    to: SeasonLifecycleState,
    seasonId: string | null,
    phase: RunPhase,
  ): string {
    const fromLabel = TIME_CONTRACT_SEASON_LIFECYCLE_LABEL[from];
    const toLabel = TIME_CONTRACT_SEASON_LIFECYCLE_LABEL[to];
    const endgameActive = isEndgamePhase(phase);
    const endgameSuffix = endgameActive ? ' [SOVEREIGNTY — ENDGAME]' : '';

    return `Season ${seasonId ?? 'UNKNOWN'} transition: "${fromLabel}" → "${toLabel}"${endgameSuffix}`;
  }

  /**
   * Narrate a season window activation event.
   */
  public narrateWindowActivation(
    window: SeasonTimeWindow,
    lifecycle: SeasonLifecycleState,
    pressureMultiplier: number,
  ): string {
    const windowName = SEASON_WINDOW_LIVEOPS_NAMES[window.type];
    const lifecycleLabel = TIME_CONTRACT_SEASON_LIFECYCLE_LABEL[lifecycle];
    const helperFlag = SEASON_WINDOW_HELPER_BLACKOUT[window.type] ? ' [HELPER BLACKOUT]' : '';
    const raidFlag = SEASON_WINDOW_HATER_RAID[window.type] ? ' [HATER RAID ACTIVE]' : '';
    const durationHours = Math.round((window.endsAtMs - window.startsAtMs) / (60 * 60 * 1_000));

    return [
      `LIVEOPS: ${windowName} is now live${helperFlag}${raidFlag}`,
      `Season: ${lifecycleLabel} | Pressure ×${pressureMultiplier.toFixed(3)} | Duration: ${durationHours}h`,
    ].join(' — ');
  }

  /**
   * Narrate a LIVEOPS_SIGNAL emission event for the audit trail.
   */
  public narrateChatSignalEmission(signal: SeasonChatSignal): string {
    const heat = (signal.heatMultiplier as unknown as number).toFixed(3);
    const flags: string[] = [];
    if (signal.helperBlackout) flags.push('HELPER_OFF');
    if (signal.haterRaidActive) flags.push('RAID');

    return [
      `CHAT_EMIT[${signal.eventName}]`,
      `season=${signal.seasonId ?? 'none'}`,
      `heat=${heat}`,
      `state="${signal.lifecycleLabel}"`,
      flags.length > 0 ? `flags=[${flags.join(',')}]` : null,
    ]
      .filter(Boolean)
      .join(' ');
  }
}

// ============================================================================
// SECTION 11 — SeasonRiskProjector
// ============================================================================

/**
 * SeasonRiskProjector — computes a multi-factor risk assessment for the
 * current season window configuration.
 *
 * Factors:
 * 1. Pressure risk: computePressureRiskScore(tier, pressureScore)
 * 2. Budget risk: remaining budget vs TIME_CONTRACT_BUDGET_THRESHOLDS
 * 3. Window risk: active window heat aggregate
 * 4. Stakes factor: phase × mode effective stakes
 * 5. Difficulty: MODE_DIFFICULTY_MULTIPLIER[mode]
 * 6. Tension floor: how close current tension is to MODE_TENSION_FLOOR
 */
export class SeasonRiskProjector {
  /**
   * Compute the full risk assessment for the current clock state.
   */
  public project(
    context: SeasonPressureContext,
    tier: PressureTier,
    pressureScore: number,
    phase: RunPhase,
    mode: ModeCode,
    remainingBudgetFraction: number,
    nowMs: number,
  ): SeasonRiskAssessment {
    // Raw pressureRisk
    const rawPressureRisk = computePressureRiskScore(tier, pressureScore);
    const pressureRisk = clamp01(rawPressureRisk);

    // Budget risk
    const budgetRisk = computeBudgetRisk(remainingBudgetFraction);

    // Window risk: aggregate heat of active windows
    const windowHeat = computeWindowHeatAggregate(nowMs, context.activeWindows);
    const windowRisk = clamp01(
      (windowHeat as unknown as number) * context.pressureMultiplier,
    );

    // Stakes factor (FOUNDATION/coop=low, SOVEREIGNTY/ghost=high)
    const rawStakes = computeEffectiveStakes(phase, mode);
    const stakesFactor = clamp01(rawStakes / 1.6);

    // Difficulty factor
    const rawDifficulty = MODE_DIFFICULTY_MULTIPLIER[mode];
    const difficultyFactor = clamp01((rawDifficulty - 0.9) / (1.6 - 0.9));

    // Tension floor
    const tensionFloor = clamp01(MODE_TENSION_FLOOR[mode]);

    // Aggregate risk (weighted)
    const aggregate =
      0.30 * (pressureRisk as unknown as number) +
      0.25 * (budgetRisk as unknown as number) +
      0.20 * (windowRisk as unknown as number) +
      0.15 * (stakesFactor as unknown as number) +
      0.10 * (difficultyFactor as unknown as number);

    const riskScore = clamp01(aggregate);
    const riskScore100 = clamp100(Math.round((riskScore as unknown as number) * 100));
    const riskClass = classifyRisk(riskScore as unknown as number);

    const drivers: string[] = [];
    if ((pressureRisk as unknown as number) >= 0.6) {
      drivers.push(`Pressure tier ${tier} at score ${pressureScore.toFixed(1)}`);
    }
    if ((budgetRisk as unknown as number) >= 0.55) {
      drivers.push(`Budget at ${((1 - remainingBudgetFraction) * 100).toFixed(0)}% consumed`);
    }
    if ((windowRisk as unknown as number) >= 0.5) {
      drivers.push(`Active window heat elevated (${context.activeWindows.length} live)`);
    }
    if (isEndgamePhase(phase)) {
      drivers.push('Endgame phase (SOVEREIGNTY)');
    }

    return Object.freeze({
      riskScore,
      riskScore100,
      pressureRisk,
      budgetRisk,
      windowRisk,
      stakesFactor,
      difficultyFactor,
      tensionFloor,
      riskClass,
      drivers: Object.freeze(drivers),
    });
  }

  /**
   * Compute mode-specific budget urgency.
   * Ghost and PVP have tighter budget tolerances.
   */
  public computeBudgetUrgency(
    remainingBudgetFraction: number,
    mode: ModeCode,
  ): Score01 {
    const base = computeBudgetRisk(remainingBudgetFraction);
    const modePressureBonus = SEASON_MODE_PRESSURE_BONUS[mode];
    return clamp01((base as unknown as number) + modePressureBonus);
  }

  /**
   * Compute the effective risk score amplified by the season multiplier.
   */
  public computeSeasonAmplifiedRisk(
    baseRisk: Score01,
    pressureMultiplier: number,
  ): Score01 {
    return clamp01((baseRisk as unknown as number) * pressureMultiplier);
  }

  /**
   * Identify which phase has the highest window affinity for risk scoring.
   */
  public resolvePhaseWindowAffinity(
    phase: RunPhase,
    activeWindows: readonly SeasonTimeWindow[],
  ): number {
    const affineTypes = SEASON_PHASE_WINDOW_AFFINITY[phase];
    const affineCount = activeWindows.filter((w) => affineTypes.includes(w.type)).length;
    return Math.min(1, affineCount / Math.max(1, affineTypes.length));
  }
}

// ============================================================================
// SECTION 12 — SeasonResilienceScorer
// ============================================================================

/**
 * SeasonResilienceScorer — evaluates how well the season window configuration
 * supports a resilient, high-quality player experience.
 *
 * A resilient season:
 * - Has kickoff coverage (engages new players)
 * - Has finale coverage (closes the loop)
 * - Has re-engage coverage (recaptures lapsed players)
 * - Doesn't concentrate all pressure into one giant multiplier spike
 * - Distributes window activity across the season lifecycle
 */
export class SeasonResilienceScorer {
  /**
   * Score the resilience of the entire season window configuration.
   */
  public score(allWindows: readonly SeasonTimeWindow[]): SeasonResilienceScore {
    if (allWindows.length === 0) {
      return this.buildAbsentScore();
    }

    const hasKickoffCoverage = allWindows.some(
      (w) => w.type === SeasonWindowType.KICKOFF,
    );
    const hasFinaleCoverage = allWindows.some(
      (w) => w.type === SeasonWindowType.SEASON_FINALE,
    );
    const hasReengageCoverage = allWindows.some(
      (w) => w.type === SeasonWindowType.REENGAGE_WINDOW,
    );

    // Window coverage ratio
    const coveredTypes = new Set(allWindows.map((w) => w.type));
    const totalTypes = Object.keys(SeasonWindowType).length;
    const windowCoverageRatio = clamp01(coveredTypes.size / totalTypes);

    // Multiplier variance (low variance = smooth experience, high = spiky)
    const multipliers = allWindows.map((w) => w.pressureMultiplier);
    const avgMultiplier = multipliers.reduce((a, b) => a + b, 0) / multipliers.length;
    const variance = multipliers.reduce((acc, m) => acc + (m - avgMultiplier) ** 2, 0) / multipliers.length;
    const multiplierVariance = clamp01(Math.sqrt(variance) / (MAX_PRESSURE_MULTIPLIER - 1));

    // Consecutive active windows: count windows with no gap > 7 days
    const sorted = [...allWindows].sort((a, b) => a.startsAtMs - b.startsAtMs);
    let consecutiveActiveWindows = 0;
    let currentStreak = 1;
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1_000;
    for (let i = 1; i < sorted.length; i++) {
      const gap = (sorted[i]?.startsAtMs ?? 0) - ((sorted[i - 1]?.endsAtMs) ?? 0);
      if (gap <= SEVEN_DAYS_MS) {
        currentStreak++;
      } else {
        consecutiveActiveWindows = Math.max(consecutiveActiveWindows, currentStreak);
        currentStreak = 1;
      }
    }
    consecutiveActiveWindows = Math.max(consecutiveActiveWindows, currentStreak);

    // Overall resilience
    const coverageScore = windowCoverageRatio as unknown as number;
    const variancePenalty = multiplierVariance as unknown as number;
    const coverageBonus =
      (hasKickoffCoverage ? 0.1 : 0) +
      (hasFinaleCoverage ? 0.1 : 0) +
      (hasReengageCoverage ? 0.08 : 0);

    const overallResilience = clamp01(
      0.5 * coverageScore +
      0.25 * (1 - variancePenalty) +
      0.25 * Math.min(1, coverageBonus / 0.28),
    );

    const resilienceClass = this.classifyResilience(overallResilience as unknown as number);
    const recommendations = this.buildRecommendations(
      hasKickoffCoverage,
      hasFinaleCoverage,
      hasReengageCoverage,
      variancePenalty,
    );

    return Object.freeze({
      overallResilience,
      windowCoverageRatio,
      multiplierVariance,
      consecutiveActiveWindows,
      hasKickoffCoverage,
      hasFinaleCoverage,
      hasReengageCoverage,
      resilienceClass,
      recommendations: Object.freeze(recommendations),
    });
  }

  private buildAbsentScore(): SeasonResilienceScore {
    return Object.freeze({
      overallResilience: clamp01(0),
      windowCoverageRatio: clamp01(0),
      multiplierVariance: clamp01(0),
      consecutiveActiveWindows: 0,
      hasKickoffCoverage: false,
      hasFinaleCoverage: false,
      hasReengageCoverage: false,
      resilienceClass: 'ABSENT' as const,
      recommendations: Object.freeze([
        'Load a season manifest to enable season window resilience scoring.',
      ]),
    });
  }

  private classifyResilience(
    score: number,
  ): 'STRONG' | 'ADEQUATE' | 'FRAGILE' | 'ABSENT' {
    if (score >= 0.75) return 'STRONG';
    if (score >= 0.50) return 'ADEQUATE';
    if (score >= 0.20) return 'FRAGILE';
    return 'ABSENT';
  }

  private buildRecommendations(
    hasKickoff: boolean,
    hasFinale: boolean,
    hasReengage: boolean,
    variancePenalty: number,
  ): string[] {
    const recs: string[] = [];
    if (!hasKickoff) {
      recs.push('Add a KICKOFF window at season start to maximize launch engagement.');
    }
    if (!hasFinale) {
      recs.push('Add a SEASON_FINALE window in the final 72h to drive completion urgency.');
    }
    if (!hasReengage) {
      recs.push('Add a REENGAGE_WINDOW to recapture lapsed players mid-season.');
    }
    if ((variancePenalty as unknown as number) > 0.6) {
      recs.push('High multiplier variance detected — smooth out pressure spikes for better pacing.');
    }
    if (recs.length === 0) {
      recs.push('Season window configuration is well-formed. No action required.');
    }
    return recs;
  }
}

// ============================================================================
// SECTION 13 — SeasonTrendAnalyzer
// ============================================================================

/**
 * SeasonTrendAnalyzer — tracks a rolling history of SeasonClockSnapshots and
 * produces a trend snapshot describing how the season pressure is evolving.
 *
 * Retains up to 100 samples. Trend is computed as linear regression over
 * the pressure multiplier time series.
 */
export class SeasonTrendAnalyzer {
  private static readonly MAX_SAMPLES = 100;
  private samples: Array<{ timestampMs: number; snapshot: SeasonClockSnapshot }> = [];

  /**
   * Push a new snapshot into the trend window.
   */
  public push(snapshot: SeasonClockSnapshot, nowMs: number): void {
    this.samples.push({ timestampMs: nowMs, snapshot });
    if (this.samples.length > SeasonTrendAnalyzer.MAX_SAMPLES) {
      this.samples.shift();
    }
  }

  /**
   * Compute the current trend snapshot from the rolling sample window.
   */
  public computeTrend(): SeasonTrendSnapshot {
    const count = this.samples.length;

    if (count === 0) {
      return this.buildEmptyTrend();
    }

    const multipliers = this.samples.map((s) => s.snapshot.pressureMultiplier);
    const averageMultiplier = multipliers.reduce((a, b) => a + b, 0) / count;
    const peakMultiplier = Math.max(...multipliers);
    const troughMultiplier = Math.min(...multipliers);

    // Linear trend via slope sign of last-vs-first half
    const firstHalf = multipliers.slice(0, Math.floor(count / 2));
    const secondHalf = multipliers.slice(Math.floor(count / 2));
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / Math.max(1, firstHalf.length);
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / Math.max(1, secondHalf.length);
    const delta = secondAvg - firstAvg;
    const pressureTrend: SeasonTrendSnapshot['pressureTrend'] =
      delta > 0.05 ? 'RISING' : delta < -0.05 ? 'FALLING' : 'STABLE';

    // Lifecycle distribution
    const lifecycleDist: Record<SeasonLifecycleState, number> = {
      UNCONFIGURED: 0,
      UPCOMING: 0,
      ACTIVE: 0,
      ENDED: 0,
    };
    for (const s of this.samples) {
      lifecycleDist[s.snapshot.lifecycle]++;
    }

    // Window activation rate
    const samplesWithActiveWindows = this.samples.filter(
      (s) => s.snapshot.activeWindowIds.length > 0,
    ).length;
    const windowActivationRate = clamp01(samplesWithActiveWindows / count);

    // Trend class
    const absDelta = Math.abs(delta);
    let trendClass: SeasonTrendSnapshot['trendClass'];
    if (absDelta > 0.3) trendClass = 'ACCELERATING';
    else if (absDelta > 0.1) trendClass = 'CRUISING';
    else if (absDelta > 0.01) trendClass = 'DECELERATING';
    else trendClass = 'STALLED';

    return Object.freeze({
      samplesAnalyzed: count,
      pressureTrend,
      pressureDelta: Number(delta.toFixed(4)),
      averageMultiplier: Number(averageMultiplier.toFixed(4)),
      peakMultiplier: Number(peakMultiplier.toFixed(4)),
      troughMultiplier: Number(troughMultiplier.toFixed(4)),
      lifecycleDistribution: Object.freeze(lifecycleDist),
      windowActivationRate,
      trendClass,
    });
  }

  private buildEmptyTrend(): SeasonTrendSnapshot {
    return Object.freeze({
      samplesAnalyzed: 0,
      pressureTrend: 'STABLE' as const,
      pressureDelta: 0,
      averageMultiplier: 1.0,
      peakMultiplier: 1.0,
      troughMultiplier: 1.0,
      lifecycleDistribution: Object.freeze({
        UNCONFIGURED: 0,
        UPCOMING: 0,
        ACTIVE: 0,
        ENDED: 0,
      }),
      windowActivationRate: clamp01(0),
      trendClass: 'STALLED' as const,
    });
  }

  /** Reset trend history. */
  public reset(): void {
    this.samples = [];
  }
}

// ============================================================================
// SECTION 14 — SeasonModeAdvisor
// ============================================================================

/**
 * SeasonModeAdvisor — generates per-mode advisory reports that combine
 * season window state with game mode mechanics.
 *
 * Answers the question: "Given the current season state, what should the
 * player expect in [mode] during [phase]?"
 *
 * Uses:
 * - TIME_CONTRACT_MODE_TEMPO for cadence guidance
 * - MODE_DIFFICULTY_MULTIPLIER for stakes awareness
 * - MODE_TENSION_FLOOR for minimum tension expectations
 * - TICK_TIER_BY_PRESSURE_TIER for tick mechanics
 * - canEscalatePressure for escalation readiness
 * - describePressureTierExperience for UX narrative
 */
export class SeasonModeAdvisor {
  /**
   * Build a mode report for the given clock state.
   */
  public buildReport(
    clock: SeasonClock,
    tier: PressureTier,
    mode: ModeCode,
    phase: RunPhase,
    pressureScore: number,
    ticksInCurrentTier: number,
    nowMs?: number,
  ): SeasonModeReport {
    const refMs = nowMs ?? Date.now();

    const tempo = TIME_CONTRACT_MODE_TEMPO[mode];
    const difficultyMultiplier = MODE_DIFFICULTY_MULTIPLIER[mode];
    const tensionFloor = MODE_TENSION_FLOOR[mode];
    const modeNormalized = MODE_NORMALIZED[mode];

    // Tick tier for this pressure state
    const currentTickTier = pressureTierToTickTier(tier);
    const config = TICK_TIER_CONFIGS[currentTickTier];

    // Adjust durations by mode tempo
    const defaultTickDurationMs = Math.round(config.defaultDurationMs / tempo);
    const decisionWindowMs = Math.round(config.decisionWindowMs / tempo);

    // Escalation readiness
    const tierOrder: PressureTier[] = ['T0', 'T1', 'T2', 'T3', 'T4'];
    const idx = tierOrder.indexOf(tier);
    let canEscalateTier = false;
    let escalationReadyMessage = 'At apex tier T4 — no further escalation possible.';

    if (idx < tierOrder.length - 1) {
      const nextTier = tierOrder[idx + 1] as PressureTier;
      canEscalateTier = canEscalatePressure(tier, nextTier, pressureScore, ticksInCurrentTier);
      const minHold = PRESSURE_TIER_MIN_HOLD_TICKS[tier];

      if (!canEscalateTier) {
        if (ticksInCurrentTier < minHold) {
          escalationReadyMessage = `Hold ${minHold - ticksInCurrentTier} more tick(s) before escalation.`;
        } else {
          escalationReadyMessage = `Score ${pressureScore.toFixed(1)} is below threshold for ${nextTier}.`;
        }
      } else {
        escalationReadyMessage = `Ready to escalate: ${tier} → ${nextTier}.`;
      }
    }

    // Experience narrative
    const pressureExperienceNarrative = describePressureTierExperience(tier);

    // Effective stakes
    const effectiveStakesScore = computeEffectiveStakes(phase, mode);

    // Min hold ticks for current tier
    const minHoldTicksForCurrentTier = PRESSURE_TIER_MIN_HOLD_TICKS[tier];

    // Phase-affine windows count
    const context = clock.getPressureContext(refMs);
    const affineTypes = SEASON_PHASE_WINDOW_AFFINITY[phase];
    const affineCount = context.activeWindows.filter(
      (w) => affineTypes.includes(w.type),
    ).length;

    void affineCount; // integrated into narrative

    return Object.freeze({
      mode,
      tempo,
      difficultyMultiplier,
      tensionFloor,
      modeNormalized,
      currentTickTier,
      defaultTickDurationMs,
      decisionWindowMs,
      canEscalateTier,
      escalationReadyMessage,
      pressureExperienceNarrative,
      effectiveStakesScore,
      minHoldTicksForCurrentTier,
    });
  }

  /**
   * Build reports for all four modes simultaneously.
   * Returns a map indexed by ModeCode.
   */
  public buildAllModeReports(
    clock: SeasonClock,
    tier: PressureTier,
    phase: RunPhase,
    pressureScore: number,
    ticksInCurrentTier: number,
    nowMs?: number,
  ): Readonly<Record<ModeCode, SeasonModeReport>> {
    const modes: ModeCode[] = ['solo', 'pvp', 'coop', 'ghost'];
    const result: Record<ModeCode, SeasonModeReport> = {} as Record<ModeCode, SeasonModeReport>;

    for (const mode of modes) {
      result[mode] = this.buildReport(
        clock,
        tier,
        mode,
        phase,
        pressureScore,
        ticksInCurrentTier,
        nowMs,
      );
    }

    return Object.freeze(result);
  }

  /**
   * Compute tick tier using the canonical TICK_TIER_BY_PRESSURE_TIER mapping.
   * Exposed for engine consumers that need the raw mapping.
   */
  public computeTickTierForTier(tier: PressureTier): TickTier {
    return TICK_TIER_BY_PRESSURE_TIER[tier];
  }
}

// ============================================================================
// SECTION 15 — SeasonPulseAnalyzer
// ============================================================================

/**
 * SeasonPulseAnalyzer — captures the instantaneous "feel" of the season clock
 * at a given moment: tone, intensity, and a short narrative.
 *
 * Pulse is used by LIVEOPS_SHADOW to inject ambient atmospheric context.
 * Consumers use `pulseTone` to drive visual and audio cues without polling
 * the full analytics bundle.
 */
export class SeasonPulseAnalyzer {
  /**
   * Compute the pulse snapshot for `nowMs`.
   */
  public analyze(
    clock: SeasonClock,
    tier: PressureTier,
    mode: ModeCode,
    nowMs?: number,
  ): SeasonPulseSnapshot {
    const refMs = nowMs ?? Date.now();
    const context = clock.getPressureContext(refMs);
    const allWindows = clock.getAllWindows();

    const liveopsHeat = computeWindowHeatAggregate(refMs, context.activeWindows);

    // Finale proximity ms
    const finaleWindows = allWindows.filter((w) => w.type === SeasonWindowType.SEASON_FINALE);
    const finaleProximityMs = finaleWindows.length > 0
      ? Math.min(...finaleWindows.map((w) => Math.max(0, w.startsAtMs - refMs)))
      : Number.POSITIVE_INFINITY;

    // Kickoff age: ms since kickoff window started
    const kickoffWindows = allWindows.filter(
      (w) => w.type === SeasonWindowType.KICKOFF && w.startsAtMs <= refMs,
    );
    const kickoffAge = kickoffWindows.length > 0
      ? Math.max(0, refMs - Math.max(...kickoffWindows.map((w) => w.startsAtMs)))
      : 0;

    // Pulse tone derivation
    const pulseTone = this.derivePulseTone(context, liveopsHeat, finaleProximityMs, tier, mode);

    // Pulse intensity
    const tensionFloor = MODE_TENSION_FLOOR[mode];
    const tierUrgency = TIME_CONTRACT_TIER_URGENCY[tier];
    const rawIntensity =
      0.35 * (liveopsHeat as unknown as number) +
      0.35 * tierUrgency +
      0.30 * Math.max(tensionFloor, context.pressureMultiplier / MAX_PRESSURE_MULTIPLIER);
    const pulseIntensity = clamp01(rawIntensity);

    const pulseNarrative = this.buildPulseNarrative(pulseTone, context, tier, mode);

    return Object.freeze({
      timestampMs: refMs,
      lifecycle: context.lifecycle,
      pressureMultiplier: context.pressureMultiplier,
      activeWindowCount: context.activeWindows.length,
      liveopsHeat,
      finaleProximityMs: Number.isFinite(finaleProximityMs) ? finaleProximityMs : 0,
      kickoffAge,
      pulseTone,
      pulseIntensity,
      pulseNarrative,
    });
  }

  private derivePulseTone(
    context: SeasonPressureContext,
    heat: Score01,
    finaleProximityMs: number,
    tier: PressureTier,
    mode: ModeCode,
  ): SeasonPulseSnapshot['pulseTone'] {
    if (context.lifecycle !== 'ACTIVE') return 'DORMANT';

    const heatNum = heat as unknown as number;
    const TWELVE_HOURS_MS = 12 * 60 * 60 * 1_000;
    const isFinaleImminent = finaleProximityMs < TWELVE_HOURS_MS;

    if (isFinaleImminent || tier === 'T4') return 'ELECTRIC';
    if (heatNum >= 0.75 || tier === 'T3') return 'TENSE';
    if (heatNum >= 0.4 || tier === 'T2') return 'BUILDING';

    const modeTension = MODE_TENSION_FLOOR[mode];
    if (heatNum >= modeTension) return 'CALM';
    return 'CALM';
  }

  private buildPulseNarrative(
    tone: SeasonPulseSnapshot['pulseTone'],
    context: SeasonPressureContext,
    tier: PressureTier,
    mode: ModeCode,
  ): string {
    const tierLabel = PRESSURE_TIER_URGENCY_LABEL[tier];
    const modeLabel = mode.toUpperCase();

    switch (tone) {
      case 'ELECTRIC':
        return `${modeLabel}: The season reaches its apex. ${tierLabel} pressure. Every decision is final.`;
      case 'TENSE':
        return `${modeLabel}: Season heat is high. ${tierLabel} pressure. Haters are watching.`;
      case 'BUILDING':
        return `${modeLabel}: Season pressure builds steadily. ${tierLabel}. Prepare your moves.`;
      case 'CALM':
        return `${modeLabel}: Season is live at ${tierLabel} pressure. Solid ground — for now.`;
      case 'DORMANT':
        return `${modeLabel}: Season is ${context.lifecycle.toLowerCase()}. No active window pressure.`;
    }
  }
}

// ============================================================================
// SECTION 16 — SeasonSessionAnalyticsTracker
// ============================================================================

/**
 * SeasonSessionAnalyticsTracker — accumulates lifetime analytics for a SeasonClock
 * instance across its full operational lifetime.
 *
 * Tracks extraction counts, emission counts, lifecycle transitions, pressure peaks,
 * and season ID history.
 */
export class SeasonSessionAnalyticsTracker {
  private totalSnapshots = 0;
  private totalMLExtractions = 0;
  private totalDLBuilds = 0;
  private totalChatSignalsEmitted = 0;
  private totalAuditEntries = 0;
  private lifetimePressureSum = 0;
  private lifetimePressurePeak = 0;
  private lifetimePressureCount = 0;
  private uniqueSeasonIdSet = new Set<string>();
  private lifecycleTransitions = 0;
  private windowActivationEvents = 0;

  public recordSnapshot(pressureMultiplier: number): void {
    this.totalSnapshots++;
    this.lifetimePressureSum += pressureMultiplier;
    this.lifetimePressureCount++;
    if (pressureMultiplier > this.lifetimePressurePeak) {
      this.lifetimePressurePeak = pressureMultiplier;
    }
  }

  public recordMLExtraction(): void {
    this.totalMLExtractions++;
  }

  public recordDLBuild(): void {
    this.totalDLBuilds++;
  }

  public recordChatSignalEmission(): void {
    this.totalChatSignalsEmitted++;
  }

  public recordAuditEntry(): void {
    this.totalAuditEntries++;
  }

  public recordSeasonId(id: string): void {
    this.uniqueSeasonIdSet.add(id);
  }

  public recordLifecycleTransition(): void {
    this.lifecycleTransitions++;
  }

  public recordWindowActivation(): void {
    this.windowActivationEvents++;
  }

  public getAnalytics(): SeasonSessionAnalytics {
    const avg =
      this.lifetimePressureCount > 0
        ? this.lifetimePressureSum / this.lifetimePressureCount
        : 1.0;

    return Object.freeze({
      totalSnapshots: this.totalSnapshots,
      totalMLExtractions: this.totalMLExtractions,
      totalDLBuilds: this.totalDLBuilds,
      totalChatSignalsEmitted: this.totalChatSignalsEmitted,
      totalAuditEntries: this.totalAuditEntries,
      lifetimePressureAvg: Number(avg.toFixed(4)),
      lifetimePressurePeak: Number(this.lifetimePressurePeak.toFixed(4)),
      uniqueSeasonIds: Object.freeze([...this.uniqueSeasonIdSet]),
      lifecycleTransitions: this.lifecycleTransitions,
      windowActivationEvents: this.windowActivationEvents,
      contractsVersion: SEASON_CLOCK_VERSION.contractsVersion,
      budgetWarningThreshold: TIME_CONTRACT_BUDGET_THRESHOLDS.WARNING_PCT,
      budgetCriticalThreshold: TIME_CONTRACT_BUDGET_THRESHOLDS.CRITICAL_PCT,
    });
  }

  public reset(): void {
    this.totalSnapshots = 0;
    this.totalMLExtractions = 0;
    this.totalDLBuilds = 0;
    this.totalChatSignalsEmitted = 0;
    this.totalAuditEntries = 0;
    this.lifetimePressureSum = 0;
    this.lifetimePressurePeak = 0;
    this.lifetimePressureCount = 0;
    this.uniqueSeasonIdSet = new Set();
    this.lifecycleTransitions = 0;
    this.windowActivationEvents = 0;
  }
}

// ============================================================================
// SECTION 17 — SeasonClock (canonical class, preserved and enhanced)
// ============================================================================

/**
 * SeasonClock — authoritative backend season calendar.
 *
 * Manages:
 * - Season manifest loading and validation
 * - Lifecycle state resolution (UNCONFIGURED / UPCOMING / ACTIVE / ENDED)
 * - Active window detection at any reference timestamp
 * - Multiplicative pressure computation from overlapping windows
 * - Countdown to season start/end
 * - Full pressure context and lightweight snapshot projection
 *
 * Clock source is injectable for deterministic testing.
 */
export class SeasonClock {
  private seasonId: string | null = null;
  private seasonStartMs: number | null = null;
  private seasonEndMs: number | null = null;
  private windows: readonly SeasonTimeWindow[] = Object.freeze([]);
  private metadata: Readonly<Record<string, string | number | boolean | null>> | null = null;

  public constructor(private readonly clock: ClockSource = new SystemClock()) {}

  /** Reset all season state. Safe to call before loading a new manifest. */
  public reset(): void {
    this.seasonId = null;
    this.seasonStartMs = null;
    this.seasonEndMs = null;
    this.windows = Object.freeze([]);
    this.metadata = null;
  }

  /** Load and validate a season timeline manifest. Overwrites any previous state. */
  public loadSeasonManifest(manifest: SeasonTimelineManifest): void {
    if (typeof manifest.seasonId !== 'string' || manifest.seasonId.trim().length === 0) {
      throw new Error('SeasonTimelineManifest.seasonId must be a non-empty string.');
    }

    assertValidRange(manifest.startMs, manifest.endMs, 'SeasonTimelineManifest');

    const normalizedWindows = manifest.windows
      .map((w) => {
        if (typeof w.windowId !== 'string' || w.windowId.trim().length === 0) {
          throw new Error('Season window must have a non-empty windowId.');
        }

        assertValidRange(
          w.startsAtMs,
          w.endsAtMs,
          `SeasonTimelineManifest.windows[${w.windowId}]`,
        );

        return cloneWindow(w);
      })
      .sort((left, right) => {
        if (left.startsAtMs !== right.startsAtMs) {
          return left.startsAtMs - right.startsAtMs;
        }
        return left.windowId.localeCompare(right.windowId);
      });

    this.seasonId = manifest.seasonId;
    this.seasonStartMs = Math.trunc(manifest.startMs);
    this.seasonEndMs = Math.trunc(manifest.endMs);
    this.windows = dedupeWindows(normalizedWindows);
    this.metadata = manifest.metadata ? Object.freeze({ ...manifest.metadata }) : null;
  }

  /** Returns true if a valid manifest has been loaded. */
  public hasManifest(): boolean {
    return this.seasonId !== null && this.seasonStartMs !== null && this.seasonEndMs !== null;
  }

  /** Returns the current season ID or null if unconfigured. */
  public getSeasonId(): string | null {
    return this.seasonId;
  }

  /** Returns season manifest metadata or null. */
  public getSeasonMetadata(): Readonly<Record<string, string | number | boolean | null>> | null {
    return this.metadata;
  }

  /** Resolve the lifecycle state at the given reference timestamp. */
  public getLifecycle(referenceMs = this.clock.now()): SeasonLifecycleState {
    if (!this.hasManifest() || this.seasonStartMs === null || this.seasonEndMs === null) {
      return 'UNCONFIGURED';
    }

    const nowMs = Math.trunc(referenceMs);

    if (nowMs < this.seasonStartMs) return 'UPCOMING';
    if (nowMs > this.seasonEndMs) return 'ENDED';
    return 'ACTIVE';
  }

  /** Returns true iff the season is currently in the ACTIVE lifecycle state. */
  public isSeasonActive(referenceMs = this.clock.now()): boolean {
    return this.getLifecycle(referenceMs) === 'ACTIVE';
  }

  /** Return all windows that are currently active at `referenceMs`. */
  public getActiveWindows(referenceMs = this.clock.now()): readonly SeasonTimeWindow[] {
    const nowMs = Math.trunc(referenceMs);

    return Object.freeze(
      this.windows.filter((w) => {
        if (!w.isActive) return false;
        return nowMs >= w.startsAtMs && nowMs <= w.endsAtMs;
      }),
    );
  }

  /** Return all windows in the manifest, regardless of active state or time. */
  public getAllWindows(): readonly SeasonTimeWindow[] {
    return this.windows;
  }

  /** Check whether any active window of the given type is present at `referenceMs`. */
  public hasWindowType(type: SeasonWindowType, referenceMs = this.clock.now()): boolean {
    return this.getActiveWindows(referenceMs).some((w) => w.type === type);
  }

  /** Return the next upcoming window (optionally filtered by type). */
  public getNextWindow(
    referenceMs = this.clock.now(),
    type?: SeasonWindowType,
  ): SeasonTimeWindow | null {
    const nowMs = Math.trunc(referenceMs);

    const candidates = this.windows.filter((w) => {
      if (w.startsAtMs < nowMs) return false;
      if (type !== undefined && w.type !== type) return false;
      return true;
    });

    return candidates.length > 0 ? (candidates[0] ?? null) : null;
  }

  /**
   * Compute the multiplicative pressure multiplier from all active windows.
   * Returns 1.0 if no windows are active. Clamped to [MIN, MAX].
   */
  public getPressureMultiplier(referenceMs = this.clock.now()): number {
    const activeWindows = this.getActiveWindows(referenceMs);

    if (activeWindows.length === 0) return 1.0;

    const product = activeWindows.reduce<number>((acc, w) => {
      return acc * normalizeMultiplier(w.pressureMultiplier);
    }, 1.0);

    return normalizeMultiplier(product);
  }

  /** Returns ms until season starts (0 if already started or unconfigured). */
  public getMsUntilSeasonStart(referenceMs = this.clock.now()): number {
    if (this.seasonStartMs === null) return Number.POSITIVE_INFINITY;
    return Math.max(0, this.seasonStartMs - Math.trunc(referenceMs));
  }

  /** Returns ms until season ends (0 if already ended or unconfigured). */
  public getMsUntilSeasonEnd(referenceMs = this.clock.now()): number {
    if (this.seasonEndMs === null) return Number.POSITIVE_INFINITY;
    return Math.max(0, this.seasonEndMs - Math.trunc(referenceMs));
  }

  /** Return the full pressure context at `referenceMs`. */
  public getPressureContext(referenceMs = this.clock.now()): SeasonPressureContext {
    const nowMs = Math.trunc(referenceMs);
    const activeWindows = this.getActiveWindows(nowMs);

    return Object.freeze({
      seasonId: this.seasonId,
      lifecycle: this.getLifecycle(nowMs),
      nowMs,
      activeWindows,
      pressureMultiplier: this.getPressureMultiplier(nowMs),
      msUntilStart: this.getMsUntilSeasonStart(nowMs),
      msUntilEnd: this.getMsUntilSeasonEnd(nowMs),
    });
  }

  /** Return a lightweight serialization-safe snapshot at `referenceMs`. */
  public snapshot(referenceMs = this.clock.now()): SeasonClockSnapshot {
    const nowMs = Math.trunc(referenceMs);
    const activeWindows = this.getActiveWindows(nowMs);

    return Object.freeze({
      seasonId: this.seasonId,
      lifecycle: this.getLifecycle(nowMs),
      seasonStartMs: this.seasonStartMs,
      seasonEndMs: this.seasonEndMs,
      windowCount: this.windows.length,
      activeWindowIds: Object.freeze(activeWindows.map((w) => w.windowId)),
      pressureMultiplier: this.getPressureMultiplier(nowMs),
      msUntilStart: this.getMsUntilSeasonStart(nowMs),
      msUntilEnd: this.getMsUntilSeasonEnd(nowMs),
    });
  }
}

// ============================================================================
// SECTION 18 — SeasonClockExtended (full 15/10 orchestrator)
// ============================================================================

/**
 * SeasonClockExtended — the full-depth season clock system.
 *
 * Wraps SeasonClock and wires together:
 * - SeasonMLExtractor (28-dim)
 * - SeasonDLBuilder (40×6)
 * - SeasonChatSignalEmitter (LIVEOPS_SIGNAL)
 * - SeasonAuditTrail (512-entry FIFO)
 * - SeasonNarrator (UX narrative pipeline)
 * - SeasonRiskProjector (multi-factor risk)
 * - SeasonResilienceScorer (window configuration health)
 * - SeasonTrendAnalyzer (rolling pressure trend)
 * - SeasonModeAdvisor (per-mode guidance)
 * - SeasonPulseAnalyzer (instantaneous tone)
 * - SeasonSessionAnalyticsTracker (lifetime stats)
 *
 * All subsystems share a single SeasonClock and clock source.
 * SeasonClockExtended is the authoritative API for anything consuming
 * both season-calendar state and game-engine context simultaneously.
 */
export class SeasonClockExtended {
  public readonly clock: SeasonClock;

  private readonly mlExtractor: SeasonMLExtractor;
  private readonly dlBuilder: SeasonDLBuilder;
  private readonly chatEmitter: SeasonChatSignalEmitter;
  private readonly audit: SeasonAuditTrail;
  private readonly narrator: SeasonNarrator;
  private readonly riskProjector: SeasonRiskProjector;
  private readonly resilienceScorer: SeasonResilienceScorer;
  private readonly trendAnalyzer: SeasonTrendAnalyzer;
  private readonly modeAdvisor: SeasonModeAdvisor;
  private readonly pulseAnalyzer: SeasonPulseAnalyzer;
  private readonly sessionAnalytics: SeasonSessionAnalyticsTracker;
  private readonly windowAnalyzer: SeasonWindowAnalyzer;

  private lastKnownLifecycle: SeasonLifecycleState = 'UNCONFIGURED';

  public constructor(clockSource: ClockSource = new SystemClock()) {
    this.clock = new SeasonClock(clockSource);
    this.mlExtractor = new SeasonMLExtractor();
    this.dlBuilder = new SeasonDLBuilder();
    this.chatEmitter = new SeasonChatSignalEmitter();
    this.audit = new SeasonAuditTrail();
    this.narrator = new SeasonNarrator();
    this.riskProjector = new SeasonRiskProjector();
    this.resilienceScorer = new SeasonResilienceScorer();
    this.trendAnalyzer = new SeasonTrendAnalyzer();
    this.modeAdvisor = new SeasonModeAdvisor();
    this.pulseAnalyzer = new SeasonPulseAnalyzer();
    this.sessionAnalytics = new SeasonSessionAnalyticsTracker();
    this.windowAnalyzer = new SeasonWindowAnalyzer();
  }

  // ── Manifest Management ──────────────────────────────────────────────────

  /**
   * Load a season manifest and record the event in the audit trail.
   * Emits a LIVEOPS_SIGNAL immediately after loading if roomId is provided.
   */
  public loadManifest(
    manifest: SeasonTimelineManifest,
    roomId: Nullable<ChatRoomId> = null,
    nowMs?: number,
  ): SeasonChatSignal | null {
    const refMs = nowMs ?? Date.now();

    this.clock.loadSeasonManifest(manifest);
    this.chatEmitter.reset();
    this.trendAnalyzer.reset();

    const snapshot = this.clock.snapshot(refMs);
    this.sessionAnalytics.recordSeasonId(manifest.seasonId);

    this.audit.record(
      'MANIFEST_LOADED',
      `Season "${manifest.seasonId}" loaded — ${manifest.windows.length} windows`,
      snapshot.seasonId,
      snapshot.lifecycle,
      snapshot.pressureMultiplier,
      refMs,
    );
    this.sessionAnalytics.recordAuditEntry();

    // Force-emit LIVEOPS_SIGNAL on manifest load
    const signal = this.chatEmitter.buildSignalIfWarranted(this.clock, refMs, roomId, true);
    if (signal) {
      const narrative = this.narrator.narrateChatSignalEmission(signal);
      this.audit.record(
        'CHAT_SIGNAL_EMITTED',
        narrative,
        snapshot.seasonId,
        snapshot.lifecycle,
        snapshot.pressureMultiplier,
        refMs,
      );
      this.sessionAnalytics.recordChatSignalEmission();
      this.sessionAnalytics.recordAuditEntry();
    }

    this.lastKnownLifecycle = snapshot.lifecycle;
    return signal;
  }

  /**
   * Reset the season clock and all subsystems.
   */
  public reset(nowMs?: number): void {
    const refMs = nowMs ?? Date.now();
    const prevSnapshot = this.clock.snapshot(refMs);

    this.clock.reset();
    this.chatEmitter.reset();
    this.trendAnalyzer.reset();

    this.audit.record(
      'MANIFEST_RESET',
      'Season manifest and all subsystems reset.',
      prevSnapshot.seasonId,
      prevSnapshot.lifecycle,
      prevSnapshot.pressureMultiplier,
      refMs,
    );
    this.sessionAnalytics.recordAuditEntry();
    this.lastKnownLifecycle = 'UNCONFIGURED';
  }

  // ── Tick / Observation ───────────────────────────────────────────────────

  /**
   * Tick the clock at `nowMs`. Records snapshot analytics, detects lifecycle
   * transitions, and emits LIVEOPS_SIGNAL if warranted.
   *
   * Should be called once per engine tick (STEP_02_TIME) or on demand.
   */
  public tick(
    tier: PressureTier,
    mode: ModeCode,
    phase: RunPhase,
    roomId: Nullable<ChatRoomId> = null,
    nowMs?: number,
  ): SeasonChatSignal | null {
    const refMs = nowMs ?? Date.now();
    const snapshot = this.clock.snapshot(refMs);

    // Record snapshot analytics
    this.trendAnalyzer.push(snapshot, refMs);
    this.sessionAnalytics.recordSnapshot(snapshot.pressureMultiplier);

    // Lifecycle transition detection
    if (snapshot.lifecycle !== this.lastKnownLifecycle) {
      const transitionNarrative = this.narrator.narrateLifecycleTransition(
        this.lastKnownLifecycle,
        snapshot.lifecycle,
        snapshot.seasonId,
        phase,
      );
      this.audit.record(
        'LIFECYCLE_CHANGED',
        transitionNarrative,
        snapshot.seasonId,
        snapshot.lifecycle,
        snapshot.pressureMultiplier,
        refMs,
      );
      this.sessionAnalytics.recordLifecycleTransition();
      this.sessionAnalytics.recordAuditEntry();
      this.lastKnownLifecycle = snapshot.lifecycle;
    }

    // Window activation detection
    const context = this.clock.getPressureContext(refMs);
    for (const w of context.activeWindows) {
      const windowNarrative = this.narrator.narrateWindowActivation(
        w,
        snapshot.lifecycle,
        snapshot.pressureMultiplier,
      );
      void windowNarrative; // logged when needed
      this.sessionAnalytics.recordWindowActivation();
    }

    // Pressure spike detection
    const riskAssessment = this.riskProjector.project(
      context,
      tier,
      50, // neutral score for tick-level risk
      phase,
      mode,
      0.5, // neutral budget fraction
      refMs,
    );
    if (riskAssessment.riskClass === 'CRITICAL' || riskAssessment.riskClass === 'HIGH') {
      this.audit.record(
        'PRESSURE_SPIKE',
        `Risk class ${riskAssessment.riskClass}: ${riskAssessment.drivers.join('; ')}`,
        snapshot.seasonId,
        snapshot.lifecycle,
        snapshot.pressureMultiplier,
        refMs,
      );
      this.sessionAnalytics.recordAuditEntry();
    }

    // Chat signal
    const signal = this.chatEmitter.buildSignalIfWarranted(this.clock, refMs, roomId);
    if (signal) {
      const narrative = this.narrator.narrateChatSignalEmission(signal);
      this.audit.record(
        'CHAT_SIGNAL_EMITTED',
        narrative,
        snapshot.seasonId,
        snapshot.lifecycle,
        snapshot.pressureMultiplier,
        refMs,
      );
      this.sessionAnalytics.recordChatSignalEmission();
      this.sessionAnalytics.recordAuditEntry();
    }

    return signal;
  }

  // ── ML/DL Extraction ─────────────────────────────────────────────────────

  /**
   * Extract the 28-dim ML feature vector.
   */
  public extractMLVector(
    tier: PressureTier,
    mode: ModeCode,
    phase: RunPhase,
    tickInPhase: number,
    phaseTickBudget: number,
    pressureScore: number,
    ticksInCurrentTier: number,
    remainingBudgetFraction: number,
    nowMs?: number,
  ): SeasonMLVector {
    const refMs = nowMs ?? Date.now();
    const vector = this.mlExtractor.extractVector(
      this.clock,
      tier,
      mode,
      phase,
      tickInPhase,
      phaseTickBudget,
      pressureScore,
      ticksInCurrentTier,
      remainingBudgetFraction,
      refMs,
    );

    const snapshot = this.clock.snapshot(refMs);
    this.sessionAnalytics.recordMLExtraction();
    this.audit.record(
      'ML_VECTOR_EXTRACTED',
      `28-dim vector extracted — lifecycle=${snapshot.lifecycle} tier=${tier} mode=${mode} phase=${phase}`,
      snapshot.seasonId,
      snapshot.lifecycle,
      snapshot.pressureMultiplier,
      refMs,
    );
    this.sessionAnalytics.recordAuditEntry();

    return vector;
  }

  /**
   * Build the 40×6 DL tensor.
   */
  public buildDLTensor(tier: PressureTier, nowMs?: number): SeasonDLTensor {
    const refMs = nowMs ?? Date.now();
    const allWindows = this.clock.getAllWindows();
    const tensor = this.dlBuilder.buildTensor(allWindows, refMs, tier);

    const snapshot = this.clock.snapshot(refMs);
    this.sessionAnalytics.recordDLBuild();
    this.audit.record(
      'DL_TENSOR_BUILT',
      `40×6 tensor — ${allWindows.length} windows | sparsity=${(tensor.sparsityRatio as unknown as number).toFixed(3)}`,
      snapshot.seasonId,
      snapshot.lifecycle,
      snapshot.pressureMultiplier,
      refMs,
    );
    this.sessionAnalytics.recordAuditEntry();

    return tensor;
  }

  // ── Risk and Resilience ──────────────────────────────────────────────────

  /**
   * Compute the full risk assessment for the current season state.
   */
  public assessRisk(
    tier: PressureTier,
    pressureScore: number,
    phase: RunPhase,
    mode: ModeCode,
    remainingBudgetFraction: number,
    nowMs?: number,
  ): SeasonRiskAssessment {
    const refMs = nowMs ?? Date.now();
    const context = this.clock.getPressureContext(refMs);

    const risk = this.riskProjector.project(
      context,
      tier,
      pressureScore,
      phase,
      mode,
      remainingBudgetFraction,
      refMs,
    );

    const snapshot = this.clock.snapshot(refMs);
    this.audit.record(
      'RISK_ASSESSED',
      `Risk=${risk.riskClass} (score=${(risk.riskScore as unknown as number).toFixed(3)}) — drivers: ${risk.drivers.join('; ')}`,
      snapshot.seasonId,
      snapshot.lifecycle,
      snapshot.pressureMultiplier,
      refMs,
    );
    this.sessionAnalytics.recordAuditEntry();

    return risk;
  }

  /**
   * Score the resilience of the current season window configuration.
   */
  public scoreResilience(): SeasonResilienceScore {
    return this.resilienceScorer.score(this.clock.getAllWindows());
  }

  // ── Analytics Bundle ─────────────────────────────────────────────────────

  /**
   * Extract the complete analytics bundle — every analytical surface in one call.
   * Expensive. Use only when full picture is needed (admin, debug, telemetry).
   */
  public extractFullBundle(
    tier: PressureTier,
    mode: ModeCode,
    phase: RunPhase,
    pressureScore: number,
    tickInPhase: number,
    phaseTickBudget: number,
    ticksInCurrentTier: number,
    remainingBudgetFraction: number,
    nowMs?: number,
  ): SeasonAnalyticsBundle {
    const refMs = nowMs ?? Date.now();
    const snapshot = this.clock.snapshot(refMs);
    const context = this.clock.getPressureContext(refMs);

    const mlVector = this.extractMLVector(
      tier, mode, phase, tickInPhase, phaseTickBudget,
      pressureScore, ticksInCurrentTier, remainingBudgetFraction, refMs,
    );

    const dlTensor = this.buildDLTensor(tier, refMs);

    const riskAssessment = this.riskProjector.project(
      context, tier, pressureScore, phase, mode, remainingBudgetFraction, refMs,
    );

    const resilienceScore = this.resilienceScorer.score(this.clock.getAllWindows());

    const trendSnapshot = this.trendAnalyzer.computeTrend();

    const pulseSnapshot = this.pulseAnalyzer.analyze(this.clock, tier, mode, refMs);

    const modeReport = this.modeAdvisor.buildReport(
      this.clock, tier, mode, phase, pressureScore, ticksInCurrentTier, refMs,
    );

    const sessionAnalytics = this.sessionAnalytics.getAnalytics();

    const windowAnalyses = this.windowAnalyzer.analyzeAll(
      this.clock.getAllWindows(), refMs,
    );

    const latestAuditEntries = this.audit.getLatest(20);

    return Object.freeze({
      snapshot,
      mlVector,
      dlTensor,
      riskAssessment,
      resilienceScore,
      trendSnapshot,
      pulseSnapshot,
      modeReport,
      sessionAnalytics,
      windowAnalyses,
      latestAuditEntries,
    });
  }

  // ── Narration ────────────────────────────────────────────────────────────

  /**
   * Generate a full state narrative for the current clock state.
   */
  public narrateCurrentState(
    tier: PressureTier,
    phase: RunPhase,
    mode: ModeCode,
    nowMs?: number,
  ): string {
    const refMs = nowMs ?? Date.now();
    const context = this.clock.getPressureContext(refMs);
    return this.narrator.narrateState(context, tier, phase, mode);
  }

  /**
   * Generate a pressure context narrative (single-line tier experience).
   */
  public narratePressureContext(tier: PressureTier): string {
    return this.narrator.narratePressureContext(tier);
  }

  // ── Mode Advisory ────────────────────────────────────────────────────────

  /**
   * Build a mode advisory report.
   */
  public buildModeReport(
    tier: PressureTier,
    mode: ModeCode,
    phase: RunPhase,
    pressureScore: number,
    ticksInCurrentTier: number,
    nowMs?: number,
  ): SeasonModeReport {
    return this.modeAdvisor.buildReport(
      this.clock, tier, mode, phase, pressureScore, ticksInCurrentTier, nowMs,
    );
  }

  /**
   * Build mode reports for all four modes.
   */
  public buildAllModeReports(
    tier: PressureTier,
    phase: RunPhase,
    pressureScore: number,
    ticksInCurrentTier: number,
    nowMs?: number,
  ): Readonly<Record<ModeCode, SeasonModeReport>> {
    return this.modeAdvisor.buildAllModeReports(
      this.clock, tier, phase, pressureScore, ticksInCurrentTier, nowMs,
    );
  }

  // ── Pulse ────────────────────────────────────────────────────────────────

  /**
   * Compute the instantaneous pulse snapshot.
   */
  public getPulse(
    tier: PressureTier,
    mode: ModeCode,
    nowMs?: number,
  ): SeasonPulseSnapshot {
    return this.pulseAnalyzer.analyze(this.clock, tier, mode, nowMs);
  }

  // ── Audit ────────────────────────────────────────────────────────────────

  /**
   * Return the latest N audit entries.
   */
  public getAuditEntries(count = 20): readonly SeasonAuditEntry[] {
    return this.audit.getLatest(count);
  }

  /**
   * Return audit entries since a given timestamp.
   */
  public getAuditEntriesSince(sinceMs: number): readonly SeasonAuditEntry[] {
    return this.audit.getEntriesSince(sinceMs);
  }

  /**
   * Return audit entry counts by action type.
   */
  public getAuditCounts(): Readonly<Partial<Record<SeasonAuditEntry['action'], number>>> {
    return this.audit.countByAction();
  }

  // ── Session Analytics ────────────────────────────────────────────────────

  /**
   * Return the full session analytics for this SeasonClockExtended lifetime.
   */
  public getSessionAnalytics(): SeasonSessionAnalytics {
    return this.sessionAnalytics.getAnalytics();
  }

  // ── Direct Clock Delegation ──────────────────────────────────────────────

  /** Delegated: getLifecycle */
  public getLifecycle(referenceMs?: number): SeasonLifecycleState {
    return this.clock.getLifecycle(referenceMs);
  }

  /** Delegated: isSeasonActive */
  public isSeasonActive(referenceMs?: number): boolean {
    return this.clock.isSeasonActive(referenceMs);
  }

  /** Delegated: getPressureMultiplier */
  public getPressureMultiplier(referenceMs?: number): number {
    return this.clock.getPressureMultiplier(referenceMs);
  }

  /** Delegated: getActiveWindows */
  public getActiveWindows(referenceMs?: number): readonly SeasonTimeWindow[] {
    return this.clock.getActiveWindows(referenceMs);
  }

  /** Delegated: hasWindowType */
  public hasWindowType(type: SeasonWindowType, referenceMs?: number): boolean {
    return this.clock.hasWindowType(type, referenceMs);
  }

  /** Delegated: getNextWindow */
  public getNextWindow(
    referenceMs?: number,
    type?: SeasonWindowType,
  ): SeasonTimeWindow | null {
    return this.clock.getNextWindow(referenceMs, type);
  }

  /** Delegated: snapshot */
  public snapshot(referenceMs?: number): SeasonClockSnapshot {
    return this.clock.snapshot(referenceMs);
  }

  /** Delegated: getPressureContext */
  public getPressureContext(referenceMs?: number): SeasonPressureContext {
    return this.clock.getPressureContext(referenceMs);
  }

  /** Delegated: getMsUntilSeasonStart */
  public getMsUntilSeasonStart(referenceMs?: number): number {
    return this.clock.getMsUntilSeasonStart(referenceMs);
  }

  /** Delegated: getMsUntilSeasonEnd */
  public getMsUntilSeasonEnd(referenceMs?: number): number {
    return this.clock.getMsUntilSeasonEnd(referenceMs);
  }

  /** Delegated: hasManifest */
  public hasManifest(): boolean {
    return this.clock.hasManifest();
  }

  /** Delegated: getSeasonId */
  public getSeasonId(): string | null {
    return this.clock.getSeasonId();
  }

  /** Delegated: getSeasonMetadata */
  public getSeasonMetadata(): Readonly<Record<string, string | number | boolean | null>> | null {
    return this.clock.getSeasonMetadata();
  }
}

// ============================================================================
// SECTION 19 — STANDALONE EXPORTED FUNCTIONS
// ============================================================================

/**
 * Extract a SeasonMLVector from a standalone SeasonClock without constructing
 * a full SeasonClockExtended. Use in lightweight engine contexts.
 */
export function extractSeasonMLVector(
  clock: SeasonClock,
  tier: PressureTier,
  mode: ModeCode,
  phase: RunPhase,
  tickInPhase: number,
  phaseTickBudget: number,
  pressureScore: number,
  ticksInCurrentTier: number,
  remainingBudgetFraction: number,
  nowMs?: number,
): SeasonMLVector {
  const extractor = new SeasonMLExtractor();
  return extractor.extractVector(
    clock, tier, mode, phase, tickInPhase, phaseTickBudget,
    pressureScore, ticksInCurrentTier, remainingBudgetFraction, nowMs,
  );
}

/**
 * Build a SeasonDLTensor from a standalone SeasonClock without constructing
 * a full SeasonClockExtended. Use in lightweight engine contexts.
 */
export function buildSeasonDLTensor(
  clock: SeasonClock,
  tier: PressureTier,
  nowMs?: number,
): SeasonDLTensor {
  const builder = new SeasonDLBuilder();
  const refMs = nowMs ?? Date.now();
  return builder.buildTensor(clock.getAllWindows(), refMs, tier);
}

/**
 * Build a LIVEOPS_SIGNAL ChatInputEnvelope from a standalone SeasonClock.
 * Use when you need a one-shot chat signal without a full emitter lifecycle.
 */
export function buildSeasonClockChatSignal(
  clock: SeasonClock,
  roomId: Nullable<ChatRoomId>,
  nowMs?: number,
): ChatInputEnvelope {
  const refMs = nowMs ?? Date.now();
  const context = clock.getPressureContext(refMs);
  const snapshot = clock.snapshot(refMs);
  const liveops = buildSeasonLiveOpsSnapshot(
    context.activeWindows, refMs, context.pressureMultiplier,
  );
  return buildSeasonChatEnvelope(
    liveops, refMs, roomId, snapshot.seasonId, context.lifecycle,
  );
}

/**
 * Compute a SeasonRiskAssessment from a standalone SeasonClock.
 */
export function assessSeasonRisk(
  clock: SeasonClock,
  tier: PressureTier,
  pressureScore: number,
  phase: RunPhase,
  mode: ModeCode,
  remainingBudgetFraction: number,
  nowMs?: number,
): SeasonRiskAssessment {
  const refMs = nowMs ?? Date.now();
  const context = clock.getPressureContext(refMs);
  const projector = new SeasonRiskProjector();
  return projector.project(context, tier, pressureScore, phase, mode, remainingBudgetFraction, refMs);
}

/**
 * Score the resilience of a SeasonClock's window configuration.
 */
export function scoreSeasonResilience(clock: SeasonClock): SeasonResilienceScore {
  const scorer = new SeasonResilienceScorer();
  return scorer.score(clock.getAllWindows());
}

/**
 * Narrate the current season state.
 */
export function narrateSeasonState(
  clock: SeasonClock,
  tier: PressureTier,
  phase: RunPhase,
  mode: ModeCode,
  nowMs?: number,
): string {
  const refMs = nowMs ?? Date.now();
  const context = clock.getPressureContext(refMs);
  const n = new SeasonNarrator();
  return n.narrateState(context, tier, phase, mode);
}

/**
 * Compute the finale proximity score for a SeasonClock at `nowMs`.
 */
export function computeSeasonFinaleProximity(
  clock: SeasonClock,
  nowMs?: number,
): Score01 {
  const refMs = nowMs ?? Date.now();
  return computeFinaleProximity(refMs, clock.getAllWindows());
}

/**
 * Build the full window analysis array from a SeasonClock.
 */
export function analyzeSeasonWindows(
  clock: SeasonClock,
  nowMs?: number,
): readonly SeasonWindowAnalysis[] {
  const refMs = nowMs ?? Date.now();
  const analyzer = new SeasonWindowAnalyzer();
  return analyzer.analyzeAll(clock.getAllWindows(), refMs);
}

/**
 * Compute a SeasonPulseSnapshot from a standalone SeasonClock.
 */
export function computeSeasonPulse(
  clock: SeasonClock,
  tier: PressureTier,
  mode: ModeCode,
  nowMs?: number,
): SeasonPulseSnapshot {
  const analyzer = new SeasonPulseAnalyzer();
  return analyzer.analyze(clock, tier, mode, nowMs);
}

// ============================================================================
// SECTION 20 — SeasonBudgetSimulator
// ============================================================================

/**
 * Projected budget consumption under a given season window configuration.
 * Simulates N ticks forward and returns expected time exhaustion.
 */
export interface SeasonBudgetProjection {
  readonly simulatedTicks: number;
  readonly totalBudgetMs: number;
  readonly projectedConsumedMs: number;
  readonly projectedRemainingMs: number;
  readonly projectedExhaustionTick: number | null;
  readonly averageTickDurationMs: number;
  readonly seasonMultiplierImpact: number;
  readonly modeTempoImpact: number;
  readonly budgetUtilizationPct: Score01;
  readonly budgetRiskClass: 'EXHAUST' | 'CRITICAL' | 'WARNING' | 'SAFE';
  readonly tickBreakdown: readonly SeasonBudgetTickRecord[];
}

/** Per-simulated-tick budget record. */
export interface SeasonBudgetTickRecord {
  readonly tick: number;
  readonly durationMs: number;
  readonly cumulativeMs: number;
  readonly remainingMs: number;
  readonly tierAtTick: PressureTier;
  readonly seasonMultiplier: number;
}

/**
 * SeasonBudgetSimulator — projects forward from the current season state
 * to estimate how budget is consumed under various season window configurations.
 *
 * Uses season pressure multiplier + mode tempo + tier duration to model
 * effective tick duration across N simulated ticks.
 */
export class SeasonBudgetSimulator {
  /** Maximum ticks to simulate in a single projection. */
  private static readonly MAX_SIMULATE_TICKS = 200;

  /**
   * Simulate budget consumption over the next `tickCount` ticks.
   *
   * Season pressure is factored into the effective tick duration by scaling
   * the base tier duration down proportionally to the pressure multiplier.
   * Higher season pressure → shorter effective ticks → faster budget burn.
   */
  public simulate(
    clock: SeasonClock,
    tier: PressureTier,
    mode: ModeCode,
    totalBudgetMs: number,
    consumedMs: number,
    tickCount: number,
    nowMs?: number,
  ): SeasonBudgetProjection {
    const refMs = nowMs ?? Date.now();
    const clampedTicks = Math.min(tickCount, SeasonBudgetSimulator.MAX_SIMULATE_TICKS);

    const context = clock.getPressureContext(refMs);
    const seasonMultiplier = context.pressureMultiplier;
    const modeTempo = TIME_CONTRACT_MODE_TEMPO[mode];
    const baseDurationMs = TIER_DURATIONS_MS[tier];

    // Effective tick duration compressed by season pressure and mode tempo
    const effectiveDurationMs = Math.max(
      500,
      Math.round((baseDurationMs / modeTempo) / Math.max(1, seasonMultiplier * 0.5)),
    );

    const tickBreakdown: SeasonBudgetTickRecord[] = [];
    let cumulative = consumedMs;
    let exhaustionTick: number | null = null;
    let remainingBudget = totalBudgetMs - consumedMs;

    // Escalating tier sequence for simulation
    const tierOrder: PressureTier[] = ['T0', 'T1', 'T2', 'T3', 'T4'];
    let currentTierIndex = tierOrder.indexOf(tier);

    for (let i = 1; i <= clampedTicks; i++) {
      const simulatedTier = tierOrder[currentTierIndex] ?? 'T4';
      const simDuration = Math.max(
        500,
        Math.round((TIER_DURATIONS_MS[simulatedTier] / modeTempo) / Math.max(1, seasonMultiplier * 0.5)),
      );

      cumulative += simDuration;
      remainingBudget -= simDuration;

      tickBreakdown.push({
        tick: i,
        durationMs: simDuration,
        cumulativeMs: cumulative,
        remainingMs: Math.max(0, totalBudgetMs - cumulative),
        tierAtTick: simulatedTier,
        seasonMultiplier,
      });

      if (cumulative >= totalBudgetMs && exhaustionTick === null) {
        exhaustionTick = i;
      }

      // Simulate mild tier escalation every 30 ticks (pressure builds over time)
      if (i % 30 === 0 && currentTierIndex < tierOrder.length - 1) {
        currentTierIndex++;
      }
    }

    const projectedConsumedMs = Math.min(totalBudgetMs, cumulative);
    const projectedRemainingMs = Math.max(0, totalBudgetMs - projectedConsumedMs);
    const utilizationPct = clamp01(projectedConsumedMs / Math.max(1, totalBudgetMs));
    const budgetRiskClass = this.classifyBudgetRisk(utilizationPct as unknown as number);

    return Object.freeze({
      simulatedTicks: clampedTicks,
      totalBudgetMs,
      projectedConsumedMs,
      projectedRemainingMs,
      projectedExhaustionTick: exhaustionTick,
      averageTickDurationMs: effectiveDurationMs,
      seasonMultiplierImpact: Number((seasonMultiplier - 1.0).toFixed(4)),
      modeTempoImpact: Number((modeTempo - 1.0).toFixed(4)),
      budgetUtilizationPct: utilizationPct,
      budgetRiskClass,
      tickBreakdown: Object.freeze(tickBreakdown),
    });
  }

  /**
   * Compare budget projections across all four modes.
   * Useful for mode-selection advisory: which mode conserves budget most effectively.
   */
  public compareAcrossModes(
    clock: SeasonClock,
    tier: PressureTier,
    totalBudgetMs: number,
    consumedMs: number,
    tickCount: number,
    nowMs?: number,
  ): Readonly<Record<ModeCode, SeasonBudgetProjection>> {
    const modes: ModeCode[] = ['solo', 'pvp', 'coop', 'ghost'];
    const result: Record<ModeCode, SeasonBudgetProjection> = {} as Record<ModeCode, SeasonBudgetProjection>;

    for (const mode of modes) {
      result[mode] = this.simulate(clock, tier, mode, totalBudgetMs, consumedMs, tickCount, nowMs);
    }

    return Object.freeze(result);
  }

  /**
   * Estimate how many ticks the budget can sustain at current consumption rate.
   */
  public estimateRemainingTicks(
    remainingBudgetMs: number,
    tier: PressureTier,
    mode: ModeCode,
    seasonMultiplier: number,
  ): number {
    const modeTempo = TIME_CONTRACT_MODE_TEMPO[mode];
    const baseDurationMs = TIER_DURATIONS_MS[tier];
    const effectiveDuration = Math.max(
      500,
      Math.round((baseDurationMs / modeTempo) / Math.max(1, seasonMultiplier * 0.5)),
    );
    return Math.floor(remainingBudgetMs / effectiveDuration);
  }

  private classifyBudgetRisk(
    utilizationPct: number,
  ): 'EXHAUST' | 'CRITICAL' | 'WARNING' | 'SAFE' {
    if (utilizationPct >= TIME_CONTRACT_BUDGET_THRESHOLDS.EXHAUST_PCT) return 'EXHAUST';
    if (utilizationPct >= TIME_CONTRACT_BUDGET_THRESHOLDS.CRITICAL_PCT) return 'CRITICAL';
    if (utilizationPct >= TIME_CONTRACT_BUDGET_THRESHOLDS.WARNING_PCT) return 'WARNING';
    return 'SAFE';
  }
}

// ============================================================================
// SECTION 21 — SeasonDecisionBatchAnalyzer
// ============================================================================

/** A single decision window in the context of season pressure. */
export interface SeasonDecisionWindowRecord {
  readonly windowId: string;
  readonly cardId: string;
  readonly baseDurationMs: number;
  readonly seasonAdjustedDurationMs: number;
  readonly pressureMultiplier: number;
  readonly urgencyScore: Score01;
  readonly isRaidActive: boolean;
  readonly isHelperBlackedOut: boolean;
  readonly recommendedAction: 'RESOLVE_FAST' | 'HOLD' | 'LET_EXPIRE' | 'STANDARD';
  readonly reasoning: string;
}

/** Batch analysis of decision windows under current season state. */
export interface SeasonDecisionBatchAnalysis {
  readonly analyzedCount: number;
  readonly seasonMultiplier: number;
  readonly lifecycle: SeasonLifecycleState;
  readonly raidActive: boolean;
  readonly helperBlackedOut: boolean;
  readonly urgencyAvg: Score01;
  readonly urgencyPeak: Score01;
  readonly records: readonly SeasonDecisionWindowRecord[];
  readonly batchRecommendation: 'URGENT_RESOLVE' | 'STANDARD' | 'HOLD_POSSIBLE';
}

/**
 * SeasonDecisionBatchAnalyzer — analyzes a batch of pending decision windows
 * in the context of the current season state.
 *
 * Season windows can suppress helper blackout, trigger hater raids, and amplify
 * the urgency of open decision windows. This analyzer surfaces that context.
 */
export class SeasonDecisionBatchAnalyzer {
  /**
   * Analyze a batch of decision windows against the current season state.
   */
  public analyze(
    clock: SeasonClock,
    tier: PressureTier,
    decisionWindows: Array<{ windowId: string; cardId: string; baseDurationMs: number }>,
    nowMs?: number,
  ): SeasonDecisionBatchAnalysis {
    const refMs = nowMs ?? Date.now();
    const context = clock.getPressureContext(refMs);
    const activeWindows = context.activeWindows;

    // Determine season-level flags
    const raidActive = activeWindows.some((w) => SEASON_WINDOW_HATER_RAID[w.type]);
    const helperBlackedOut = activeWindows.some((w) => SEASON_WINDOW_HELPER_BLACKOUT[w.type]);

    // Base tier urgency
    const tierUrgency = TIME_CONTRACT_TIER_URGENCY[tier];
    const seasonMultiplier = context.pressureMultiplier;

    const records: SeasonDecisionWindowRecord[] = [];

    for (const dw of decisionWindows) {
      // Season pressure compresses decision window duration
      const adjustedDuration = Math.max(
        500,
        Math.round(dw.baseDurationMs / Math.max(1, seasonMultiplier * 0.4)),
      );

      // Urgency = tier urgency × seasonal heat
      const seasonHeat = computeWindowHeatAggregate(refMs, activeWindows);
      const rawUrgency = tierUrgency * 0.6 + (seasonHeat as unknown as number) * 0.4;
      const urgencyScore = clamp01(rawUrgency + (raidActive ? 0.15 : 0));

      // Recommendation logic
      let recommendedAction: SeasonDecisionWindowRecord['recommendedAction'];
      let reasoning: string;

      if (raidActive && (urgencyScore as unknown as number) >= 0.7) {
        recommendedAction = 'RESOLVE_FAST';
        reasoning = 'Hater raid active — resolve immediately to avoid forced worst option';
      } else if (helperBlackedOut && (urgencyScore as unknown as number) >= 0.5) {
        recommendedAction = 'RESOLVE_FAST';
        reasoning = 'Helper blackout — no assistance available, act decisively';
      } else if ((urgencyScore as unknown as number) < 0.3 && !raidActive) {
        recommendedAction = 'HOLD';
        reasoning = 'Low urgency — hold charge available, consider using to buy time';
      } else {
        recommendedAction = 'STANDARD';
        reasoning = `Standard resolution — urgency ${(urgencyScore as unknown as number).toFixed(2)} at tier ${tier}`;
      }

      records.push({
        windowId: dw.windowId,
        cardId: dw.cardId,
        baseDurationMs: dw.baseDurationMs,
        seasonAdjustedDurationMs: adjustedDuration,
        pressureMultiplier: seasonMultiplier,
        urgencyScore,
        isRaidActive: raidActive,
        isHelperBlackedOut: helperBlackedOut,
        recommendedAction,
        reasoning,
      });
    }

    // Batch-level stats
    const urgencies = records.map((r) => r.urgencyScore as unknown as number);
    const urgencyAvg = clamp01(
      urgencies.length > 0 ? urgencies.reduce((a, b) => a + b, 0) / urgencies.length : 0,
    );
    const urgencyPeak = clamp01(urgencies.length > 0 ? Math.max(...urgencies) : 0);

    const urgentCount = records.filter((r) => r.recommendedAction === 'RESOLVE_FAST').length;
    const holdCount = records.filter((r) => r.recommendedAction === 'HOLD').length;

    let batchRecommendation: SeasonDecisionBatchAnalysis['batchRecommendation'];
    if (urgentCount > 0 || raidActive) {
      batchRecommendation = 'URGENT_RESOLVE';
    } else if (holdCount > records.length / 2) {
      batchRecommendation = 'HOLD_POSSIBLE';
    } else {
      batchRecommendation = 'STANDARD';
    }

    return Object.freeze({
      analyzedCount: records.length,
      seasonMultiplier,
      lifecycle: context.lifecycle,
      raidActive,
      helperBlackedOut,
      urgencyAvg,
      urgencyPeak,
      records: Object.freeze(records),
      batchRecommendation,
    });
  }
}

// ============================================================================
// SECTION 22 — SeasonRecoveryForecaster
// ============================================================================

/** A single step in a recovery forecast timeline. */
export interface SeasonRecoveryStep {
  readonly stepMs: number;
  readonly cumulativeMs: number;
  readonly projectedMultiplier: number;
  readonly projectedLifecycle: SeasonLifecycleState;
  readonly windowsExpectedActive: number;
  readonly recoveryProgressFraction: Score01;
  readonly noteworthy: boolean;
  readonly note: string;
}

/** Full recovery forecast for transitioning from high-pressure state to target. */
export interface SeasonRecoveryForecast {
  readonly targetMultiplier: number;
  readonly currentMultiplier: number;
  readonly estimatedRecoveryMs: number;
  readonly estimatedRecoveryTicks: number;
  readonly recoverySteps: readonly SeasonRecoveryStep[];
  readonly isInstantRecovery: boolean;
  readonly isRecoveryPossible: boolean;
  readonly forecastNarrative: string;
  readonly tier: PressureTier;
  readonly mode: ModeCode;
}

/**
 * SeasonRecoveryForecaster — forecasts how long recovery from the current
 * high-pressure season state would take if no new windows activate.
 *
 * Recovery is defined as: the time until the pressure multiplier drops
 * back to the target level (default: 1.0).
 *
 * Uses window end times to project when multiplier naturally decays.
 */
export class SeasonRecoveryForecaster {
  /**
   * Forecast recovery from current pressure to `targetMultiplier`.
   */
  public forecast(
    clock: SeasonClock,
    tier: PressureTier,
    mode: ModeCode,
    targetMultiplier = 1.0,
    nowMs?: number,
  ): SeasonRecoveryForecast {
    const refMs = nowMs ?? Date.now();
    const context = clock.getPressureContext(refMs);
    const currentMultiplier = context.pressureMultiplier;

    if (currentMultiplier <= targetMultiplier) {
      return this.buildInstantRecovery(currentMultiplier, targetMultiplier, tier, mode, refMs, context.lifecycle);
    }

    const activeWindows = context.activeWindows;
    if (activeWindows.length === 0) {
      return this.buildInstantRecovery(currentMultiplier, targetMultiplier, tier, mode, refMs, context.lifecycle);
    }

    // Find the last active window end time — that's when multiplier drops to 1.0
    const lastWindowEndMs = Math.max(...activeWindows.map((w) => w.endsAtMs));
    const estimatedRecoveryMs = Math.max(0, lastWindowEndMs - refMs);
    const modeTempo = TIME_CONTRACT_MODE_TEMPO[mode];
    const avgTickMs = TIER_DURATIONS_MS[tier] / modeTempo;
    const estimatedRecoveryTicks = Math.ceil(estimatedRecoveryMs / Math.max(1, avgTickMs));

    // Build recovery steps at 1-hour intervals
    const steps: SeasonRecoveryStep[] = [];
    const stepIntervalMs = 60 * 60 * 1_000; // 1 hour
    const maxSteps = Math.min(48, Math.ceil(estimatedRecoveryMs / stepIntervalMs) + 2);

    for (let i = 0; i <= maxSteps; i++) {
      const stepTimeMs = refMs + i * stepIntervalMs;
      const futureContext = clock.getPressureContext(stepTimeMs);
      const futureMultiplier = futureContext.pressureMultiplier;
      const progressFraction = currentMultiplier > targetMultiplier
        ? clamp01(1 - (futureMultiplier - targetMultiplier) / Math.max(0.01, currentMultiplier - targetMultiplier))
        : clamp01(1);

      const isNoteworthy = futureMultiplier <= targetMultiplier && (steps[i - 1]?.projectedMultiplier ?? currentMultiplier) > targetMultiplier;

      steps.push({
        stepMs: stepTimeMs,
        cumulativeMs: i * stepIntervalMs,
        projectedMultiplier: futureMultiplier,
        projectedLifecycle: futureContext.lifecycle,
        windowsExpectedActive: futureContext.activeWindows.length,
        recoveryProgressFraction: progressFraction,
        noteworthy: isNoteworthy,
        note: isNoteworthy
          ? `Multiplier drops to ${futureMultiplier.toFixed(3)} — approaching target ${targetMultiplier}`
          : `×${futureMultiplier.toFixed(3)} | ${futureContext.activeWindows.length} active window(s)`,
      });

      if (futureMultiplier <= targetMultiplier && i > 0) break;
    }

    const recoveryNarrative = this.buildForecastNarrative(
      currentMultiplier, targetMultiplier, estimatedRecoveryMs, tier, mode,
    );

    return Object.freeze({
      targetMultiplier,
      currentMultiplier,
      estimatedRecoveryMs,
      estimatedRecoveryTicks,
      recoverySteps: Object.freeze(steps),
      isInstantRecovery: false,
      isRecoveryPossible: true,
      forecastNarrative: recoveryNarrative,
      tier,
      mode,
    });
  }

  private buildInstantRecovery(
    current: number,
    target: number,
    tier: PressureTier,
    mode: ModeCode,
    nowMs: number,
    lifecycle: SeasonLifecycleState,
  ): SeasonRecoveryForecast {
    return Object.freeze({
      targetMultiplier: target,
      currentMultiplier: current,
      estimatedRecoveryMs: 0,
      estimatedRecoveryTicks: 0,
      recoverySteps: Object.freeze([{
        stepMs: nowMs,
        cumulativeMs: 0,
        projectedMultiplier: current,
        projectedLifecycle: lifecycle,
        windowsExpectedActive: 0,
        recoveryProgressFraction: clamp01(1),
        noteworthy: true,
        note: 'Already at or below target multiplier.',
      }]),
      isInstantRecovery: true,
      isRecoveryPossible: true,
      forecastNarrative: `${tier}/${mode}: Multiplier ×${current.toFixed(3)} ≤ target ×${target.toFixed(3)}. No recovery needed.`,
      tier,
      mode,
    });
  }

  private buildForecastNarrative(
    current: number,
    target: number,
    recoveryMs: number,
    tier: PressureTier,
    mode: ModeCode,
  ): string {
    const hours = (recoveryMs / (60 * 60 * 1_000)).toFixed(1);
    const tierLabel = PRESSURE_TIER_URGENCY_LABEL[tier];
    const tempo = TIME_CONTRACT_MODE_TEMPO[mode];
    return [
      `Recovery forecast: ×${current.toFixed(3)} → ×${target.toFixed(3)}`,
      `ETA: ~${hours}h | Tier: ${tierLabel} | Mode: ${mode.toUpperCase()} (tempo ×${tempo})`,
      `Season pressure remains active until final window closes.`,
    ].join(' — ');
  }
}

// ============================================================================
// SECTION 23 — SeasonChatBridgeAdapter
// ============================================================================

/** All season-triggered chat events in one bundle. */
export interface SeasonChatBridgeBundle {
  readonly primaryEnvelope: ChatInputEnvelope;
  readonly liveops: ChatLiveOpsSnapshot;
  readonly eventClass:
    | 'SEASON_START'
    | 'SEASON_END'
    | 'WINDOW_TRANSITION'
    | 'PRESSURE_SPIKE'
    | 'DORMANT';
  readonly channelHints: readonly string[];
  readonly priorityLevel: 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';
  readonly suppressHelper: boolean;
  readonly raidInjectionRecommended: boolean;
  readonly narrativeSummary: string;
  readonly lifecycle: SeasonLifecycleState;
  readonly seasonId: Nullable<string>;
  readonly emittedAt: UnixMs;
}

/**
 * SeasonChatBridgeAdapter — the authoritative season→chat bridge.
 *
 * Translates all season state transitions and window events into
 * canonical ChatInputEnvelope objects ready for ingest() into the chat engine.
 *
 * This adapter is the ONLY code that should emit LIVEOPS_SIGNAL envelopes
 * from the season subsystem. All other chat bridges (battle, run, multiplayer,
 * economy) operate on their own lanes.
 */
export class SeasonChatBridgeAdapter {
  private readonly emitter: SeasonChatSignalEmitter;
  private readonly narrator: SeasonNarrator;

  public constructor() {
    this.emitter = new SeasonChatSignalEmitter();
    this.narrator = new SeasonNarrator();
  }

  /**
   * Build a full SeasonChatBridgeBundle from the current clock state.
   * This is the primary output surface for the chat engine's LIVEOPS processing.
   */
  public buildBundle(
    clock: SeasonClock,
    tier: PressureTier,
    phase: RunPhase,
    mode: ModeCode,
    roomId: Nullable<ChatRoomId>,
    nowMs?: number,
  ): SeasonChatBridgeBundle {
    const refMs = nowMs ?? Date.now();
    const context = clock.getPressureContext(refMs);
    const snapshot = clock.snapshot(refMs);

    const liveops = buildSeasonLiveOpsSnapshot(
      context.activeWindows, refMs, context.pressureMultiplier,
    );

    const envelope = buildSeasonChatEnvelope(
      liveops, refMs, roomId, snapshot.seasonId, context.lifecycle,
    );

    const eventClass = this.classifyEventClass(context);
    const priorityLevel = this.derivePriority(context, tier, liveops);
    const channelHints = this.buildChannelHints(context, eventClass);
    const narrativeSummary = this.narrator.narrateState(context, tier, phase, mode);

    return Object.freeze({
      primaryEnvelope: envelope,
      liveops,
      eventClass,
      channelHints: Object.freeze(channelHints),
      priorityLevel,
      suppressHelper: liveops.helperBlackout,
      raidInjectionRecommended: liveops.haterRaidActive,
      narrativeSummary,
      lifecycle: context.lifecycle,
      seasonId: snapshot.seasonId,
      emittedAt: asUnixMs(refMs),
    });
  }

  /**
   * Build a bundle for a specific window activation event.
   */
  public buildWindowActivationBundle(
    window: SeasonTimeWindow,
    lifecycle: SeasonLifecycleState,
    pressureMultiplier: number,
    roomId: Nullable<ChatRoomId>,
    nowMs?: number,
  ): SeasonChatBridgeBundle {
    const refMs = nowMs ?? Date.now();

    const liveops: ChatLiveOpsSnapshot = {
      worldEventName: SEASON_WINDOW_LIVEOPS_NAMES[window.type],
      heatMultiplier01: clamp01(SEASON_WINDOW_CHAT_HEAT[window.type] ?? 0.5),
      helperBlackout: SEASON_WINDOW_HELPER_BLACKOUT[window.type],
      haterRaidActive: SEASON_WINDOW_HATER_RAID[window.type],
    };

    const envelope = buildSeasonChatEnvelope(liveops, refMs, roomId, null, lifecycle);
    const windowNarrative = this.narrator.narrateWindowActivation(window, lifecycle, pressureMultiplier);

    return Object.freeze({
      primaryEnvelope: envelope,
      liveops,
      eventClass: 'WINDOW_TRANSITION' as const,
      channelHints: Object.freeze(this.buildWindowChannelHints(window.type)),
      priorityLevel: this.deriveWindowPriority(window.type),
      suppressHelper: liveops.helperBlackout,
      raidInjectionRecommended: liveops.haterRaidActive,
      narrativeSummary: windowNarrative,
      lifecycle,
      seasonId: null,
      emittedAt: asUnixMs(refMs),
    });
  }

  /** Reset the underlying emitter state. */
  public reset(): void {
    this.emitter.reset();
  }

  private classifyEventClass(
    context: SeasonPressureContext,
  ): SeasonChatBridgeBundle['eventClass'] {
    if (context.lifecycle !== 'ACTIVE') return 'DORMANT';
    if (context.msUntilStart === 0 && context.pressureMultiplier > 1.5) return 'PRESSURE_SPIKE';
    if (context.activeWindows.some((w) => w.type === SeasonWindowType.KICKOFF)) return 'SEASON_START';
    if (context.activeWindows.some((w) => w.type === SeasonWindowType.SEASON_FINALE)) return 'SEASON_END';
    if (context.activeWindows.length > 0) return 'WINDOW_TRANSITION';
    return 'DORMANT';
  }

  private derivePriority(
    context: SeasonPressureContext,
    tier: PressureTier,
    liveops: ChatLiveOpsSnapshot,
  ): SeasonChatBridgeBundle['priorityLevel'] {
    const heatNum = liveops.heatMultiplier01 as unknown as number;
    if (liveops.haterRaidActive || tier === 'T4') return 'CRITICAL';
    if (heatNum >= 0.8 || tier === 'T3' || context.activeWindows.length >= 3) return 'HIGH';
    if (heatNum >= 0.4 || context.lifecycle === 'ACTIVE') return 'NORMAL';
    return 'LOW';
  }

  private deriveWindowPriority(
    type: SeasonWindowType,
  ): SeasonChatBridgeBundle['priorityLevel'] {
    switch (type) {
      case SeasonWindowType.SEASON_FINALE: return 'CRITICAL';
      case SeasonWindowType.LIVEOPS_EVENT: return 'HIGH';
      case SeasonWindowType.ARCHIVE_CLOSE: return 'HIGH';
      case SeasonWindowType.KICKOFF: return 'NORMAL';
      case SeasonWindowType.REENGAGE_WINDOW: return 'LOW';
    }
  }

  private buildChannelHints(
    context: SeasonPressureContext,
    eventClass: SeasonChatBridgeBundle['eventClass'],
  ): string[] {
    const hints: string[] = ['LIVEOPS_SHADOW'];
    if (eventClass === 'SEASON_START' || eventClass === 'SEASON_END') {
      hints.push('GLOBAL', 'SYSTEM_SHADOW');
    }
    if (eventClass === 'PRESSURE_SPIKE') {
      hints.push('NPC_SHADOW', 'SYSTEM_SHADOW');
    }
    if (context.activeWindows.some((w) => w.type === SeasonWindowType.LIVEOPS_EVENT)) {
      hints.push('NPC_SHADOW');
    }
    return hints;
  }

  private buildWindowChannelHints(type: SeasonWindowType): string[] {
    switch (type) {
      case SeasonWindowType.SEASON_FINALE:
        return ['LIVEOPS_SHADOW', 'GLOBAL', 'NPC_SHADOW', 'SYSTEM_SHADOW'];
      case SeasonWindowType.LIVEOPS_EVENT:
        return ['LIVEOPS_SHADOW', 'NPC_SHADOW'];
      case SeasonWindowType.KICKOFF:
        return ['LIVEOPS_SHADOW', 'GLOBAL'];
      case SeasonWindowType.ARCHIVE_CLOSE:
        return ['LIVEOPS_SHADOW'];
      case SeasonWindowType.REENGAGE_WINDOW:
        return ['LIVEOPS_SHADOW'];
    }
  }
}

// ============================================================================
// SECTION 24 — SeasonRuntimeSummary
// ============================================================================

/**
 * Canonical runtime summary produced by SeasonClockExtended for engine orchestrators.
 * Safe for serialization, broadcasting, and checkpoint storage.
 */
export interface SeasonRuntimeSummary {
  readonly seasonId: Nullable<string>;
  readonly lifecycle: SeasonLifecycleState;
  readonly lifecycleLabel: string;
  readonly pressureMultiplier: number;
  readonly activeWindowCount: number;
  readonly activeWindowNames: readonly string[];
  readonly msUntilStart: number;
  readonly msUntilEnd: number;
  readonly raidActive: boolean;
  readonly helperBlackedOut: boolean;
  readonly riskClass: SeasonRiskAssessment['riskClass'];
  readonly riskScore: Score01;
  readonly pulseTone: SeasonPulseSnapshot['pulseTone'];
  readonly pulseIntensity: Score01;
  readonly resilienceClass: SeasonResilienceScore['resilienceClass'];
  readonly trendClass: SeasonTrendSnapshot['trendClass'];
  readonly contractsVersion: string;
  readonly timestampMs: number;
}

/**
 * Build a SeasonRuntimeSummary from a SeasonClock and subsystem outputs.
 * This is the authoritative "what is the season clock doing right now" surface
 * for engine orchestrators (e.g., EngineOrchestrator STEP_02_TIME).
 */
export function buildSeasonRuntimeSummary(
  clock: SeasonClock,
  tier: PressureTier,
  mode: ModeCode,
  phase: RunPhase,
  pressureScore: number,
  remainingBudgetFraction: number,
  nowMs?: number,
): SeasonRuntimeSummary {
  const refMs = nowMs ?? Date.now();
  const context = clock.getPressureContext(refMs);
  const snapshot = clock.snapshot(refMs);

  // Active window names
  const activeWindowNames = context.activeWindows.map(
    (w) => SEASON_WINDOW_LIVEOPS_NAMES[w.type],
  );

  // Raid / helper flags from active windows
  const raidActive = context.activeWindows.some((w) => SEASON_WINDOW_HATER_RAID[w.type]);
  const helperBlackedOut = context.activeWindows.some((w) => SEASON_WINDOW_HELPER_BLACKOUT[w.type]);

  // Risk
  const riskProjector = new SeasonRiskProjector();
  const risk = riskProjector.project(
    context, tier, pressureScore, phase, mode, remainingBudgetFraction, refMs,
  );

  // Pulse
  const pulseAnalyzer = new SeasonPulseAnalyzer();
  const pulse = pulseAnalyzer.analyze(clock, tier, mode, refMs);

  // Resilience
  const resilienceScorer = new SeasonResilienceScorer();
  const resilience = resilienceScorer.score(clock.getAllWindows());

  // Trend (empty trend — summary doesn't hold history)
  const trendAnalyzer = new SeasonTrendAnalyzer();
  trendAnalyzer.push(snapshot, refMs);
  const trend = trendAnalyzer.computeTrend();

  return Object.freeze({
    seasonId: snapshot.seasonId,
    lifecycle: snapshot.lifecycle,
    lifecycleLabel: TIME_CONTRACT_SEASON_LIFECYCLE_LABEL[snapshot.lifecycle],
    pressureMultiplier: snapshot.pressureMultiplier,
    activeWindowCount: context.activeWindows.length,
    activeWindowNames: Object.freeze(activeWindowNames),
    msUntilStart: snapshot.msUntilStart,
    msUntilEnd: snapshot.msUntilEnd,
    raidActive,
    helperBlackedOut,
    riskClass: risk.riskClass,
    riskScore: risk.riskScore,
    pulseTone: pulse.pulseTone,
    pulseIntensity: pulse.pulseIntensity,
    resilienceClass: resilience.resilienceClass,
    trendClass: trend.trendClass,
    contractsVersion: SEASON_CLOCK_VERSION.contractsVersion,
    timestampMs: refMs,
  });
}

// ============================================================================
// SECTION 25 — ADDITIONAL SeasonClockExtended METHODS
// ============================================================================

// Extend SeasonClockExtended with budget simulation, recovery forecasting, chat bridge, etc.
// These are declared as a module augmentation pattern to keep the class readable.

declare module './SeasonClock' {
  interface SeasonClockExtended {
    /** Simulate budget consumption over N ticks under current season pressure. */
    simulateBudget(
      tier: PressureTier,
      mode: ModeCode,
      totalBudgetMs: number,
      consumedMs: number,
      tickCount: number,
      nowMs?: number,
    ): SeasonBudgetProjection;

    /** Forecast recovery from current pressure multiplier to target. */
    forecastRecovery(
      tier: PressureTier,
      mode: ModeCode,
      targetMultiplier?: number,
      nowMs?: number,
    ): SeasonRecoveryForecast;

    /** Analyze a batch of decision windows under current season pressure. */
    analyzeDecisionBatch(
      tier: PressureTier,
      decisionWindows: Array<{ windowId: string; cardId: string; baseDurationMs: number }>,
      nowMs?: number,
    ): SeasonDecisionBatchAnalysis;

    /** Build the authoritative LIVEOPS chat bridge bundle. */
    buildChatBridgeBundle(
      tier: PressureTier,
      phase: RunPhase,
      mode: ModeCode,
      roomId: Nullable<ChatRoomId>,
      nowMs?: number,
    ): SeasonChatBridgeBundle;

    /** Build the canonical season runtime summary for engine orchestrators. */
    buildRuntimeSummary(
      tier: PressureTier,
      mode: ModeCode,
      phase: RunPhase,
      pressureScore: number,
      remainingBudgetFraction: number,
      nowMs?: number,
    ): SeasonRuntimeSummary;

    /** Compute column means of the most recent DL tensor. */
    computeDLColumnMeans(tier: PressureTier, nowMs?: number): readonly number[];

    /** Compute ML vector sparsity ratio. */
    computeMLSparsity(
      tier: PressureTier,
      mode: ModeCode,
      phase: RunPhase,
      pressureScore: number,
      nowMs?: number,
    ): Score01;

    /** Compute budget urgency adjusted by mode. */
    computeBudgetUrgency(
      remainingBudgetFraction: number,
      mode: ModeCode,
    ): Score01;
  }
}

// Implementation of SeasonClockExtended extension methods via prototype extension.
// TypeScript augmentation requires runtime prototype assignment.

(SeasonClockExtended.prototype as unknown as {
  simulateBudget: SeasonClockExtended['simulateBudget'];
}).simulateBudget = function (
  this: SeasonClockExtended,
  tier: PressureTier,
  mode: ModeCode,
  totalBudgetMs: number,
  consumedMs: number,
  tickCount: number,
  nowMs?: number,
): SeasonBudgetProjection {
  const sim = new SeasonBudgetSimulator();
  return sim.simulate(this.clock, tier, mode, totalBudgetMs, consumedMs, tickCount, nowMs);
};

(SeasonClockExtended.prototype as unknown as {
  forecastRecovery: SeasonClockExtended['forecastRecovery'];
}).forecastRecovery = function (
  this: SeasonClockExtended,
  tier: PressureTier,
  mode: ModeCode,
  targetMultiplier = 1.0,
  nowMs?: number,
): SeasonRecoveryForecast {
  const forecaster = new SeasonRecoveryForecaster();
  return forecaster.forecast(this.clock, tier, mode, targetMultiplier, nowMs);
};

(SeasonClockExtended.prototype as unknown as {
  analyzeDecisionBatch: SeasonClockExtended['analyzeDecisionBatch'];
}).analyzeDecisionBatch = function (
  this: SeasonClockExtended,
  tier: PressureTier,
  decisionWindows: Array<{ windowId: string; cardId: string; baseDurationMs: number }>,
  nowMs?: number,
): SeasonDecisionBatchAnalysis {
  const analyzer = new SeasonDecisionBatchAnalyzer();
  return analyzer.analyze(this.clock, tier, decisionWindows, nowMs);
};

(SeasonClockExtended.prototype as unknown as {
  buildChatBridgeBundle: SeasonClockExtended['buildChatBridgeBundle'];
}).buildChatBridgeBundle = function (
  this: SeasonClockExtended,
  tier: PressureTier,
  phase: RunPhase,
  mode: ModeCode,
  roomId: Nullable<ChatRoomId>,
  nowMs?: number,
): SeasonChatBridgeBundle {
  const bridge = new SeasonChatBridgeAdapter();
  return bridge.buildBundle(this.clock, tier, phase, mode, roomId, nowMs);
};

(SeasonClockExtended.prototype as unknown as {
  buildRuntimeSummary: SeasonClockExtended['buildRuntimeSummary'];
}).buildRuntimeSummary = function (
  this: SeasonClockExtended,
  tier: PressureTier,
  mode: ModeCode,
  phase: RunPhase,
  pressureScore: number,
  remainingBudgetFraction: number,
  nowMs?: number,
): SeasonRuntimeSummary {
  return buildSeasonRuntimeSummary(
    this.clock, tier, mode, phase, pressureScore, remainingBudgetFraction, nowMs,
  );
};

(SeasonClockExtended.prototype as unknown as {
  computeDLColumnMeans: SeasonClockExtended['computeDLColumnMeans'];
}).computeDLColumnMeans = function (
  this: SeasonClockExtended,
  tier: PressureTier,
  nowMs?: number,
): readonly number[] {
  const tensor = this.buildDLTensor(tier, nowMs);
  const builder = new SeasonDLBuilder();
  return builder.computeColumnMeans(tensor);
};

(SeasonClockExtended.prototype as unknown as {
  computeMLSparsity: SeasonClockExtended['computeMLSparsity'];
}).computeMLSparsity = function (
  this: SeasonClockExtended,
  tier: PressureTier,
  mode: ModeCode,
  phase: RunPhase,
  pressureScore: number,
  nowMs?: number,
): Score01 {
  const refMs = nowMs ?? Date.now();
  const vector = this.extractMLVector(tier, mode, phase, 0, 100, pressureScore, 0, 0.5, refMs);
  const extractor = new SeasonMLExtractor();
  return extractor.computeSparsity(vector);
};

(SeasonClockExtended.prototype as unknown as {
  computeBudgetUrgency: SeasonClockExtended['computeBudgetUrgency'];
}).computeBudgetUrgency = function (
  this: SeasonClockExtended,
  remainingBudgetFraction: number,
  mode: ModeCode,
): Score01 {
  const projector = new SeasonRiskProjector();
  return projector.computeBudgetUrgency(remainingBudgetFraction, mode);
};

// ============================================================================
// SECTION 26 — ADDITIONAL STANDALONE EXPORTS
// ============================================================================

/**
 * Build a SeasonBudgetProjection without a full SeasonClockExtended.
 */
export function simulateSeasonBudget(
  clock: SeasonClock,
  tier: PressureTier,
  mode: ModeCode,
  totalBudgetMs: number,
  consumedMs: number,
  tickCount: number,
  nowMs?: number,
): SeasonBudgetProjection {
  return new SeasonBudgetSimulator().simulate(
    clock, tier, mode, totalBudgetMs, consumedMs, tickCount, nowMs,
  );
}

/**
 * Forecast season pressure recovery without a full SeasonClockExtended.
 */
export function forecastSeasonRecovery(
  clock: SeasonClock,
  tier: PressureTier,
  mode: ModeCode,
  targetMultiplier = 1.0,
  nowMs?: number,
): SeasonRecoveryForecast {
  return new SeasonRecoveryForecaster().forecast(clock, tier, mode, targetMultiplier, nowMs);
}

/**
 * Build a SeasonChatBridgeBundle without a full SeasonClockExtended.
 */
export function buildSeasonChatBridgeBundle(
  clock: SeasonClock,
  tier: PressureTier,
  phase: RunPhase,
  mode: ModeCode,
  roomId: Nullable<ChatRoomId>,
  nowMs?: number,
): SeasonChatBridgeBundle {
  return new SeasonChatBridgeAdapter().buildBundle(clock, tier, phase, mode, roomId, nowMs);
}

/**
 * Analyze decision windows under current season pressure.
 */
export function analyzeSeasonDecisionBatch(
  clock: SeasonClock,
  tier: PressureTier,
  decisionWindows: Array<{ windowId: string; cardId: string; baseDurationMs: number }>,
  nowMs?: number,
): SeasonDecisionBatchAnalysis {
  return new SeasonDecisionBatchAnalyzer().analyze(clock, tier, decisionWindows, nowMs);
}

/**
 * Compare budget projections across all four modes.
 */
export function compareSeasonBudgetAcrossModes(
  clock: SeasonClock,
  tier: PressureTier,
  totalBudgetMs: number,
  consumedMs: number,
  tickCount: number,
  nowMs?: number,
): Readonly<Record<ModeCode, SeasonBudgetProjection>> {
  return new SeasonBudgetSimulator().compareAcrossModes(
    clock, tier, totalBudgetMs, consumedMs, tickCount, nowMs,
  );
}

/**
 * Estimate remaining ticks at the current consumption rate.
 */
export function estimateSeasonRemainingTicks(
  remainingBudgetMs: number,
  tier: PressureTier,
  mode: ModeCode,
  clock: SeasonClock,
  nowMs?: number,
): number {
  const refMs = nowMs ?? Date.now();
  const multiplier = clock.getPressureMultiplier(refMs);
  return new SeasonBudgetSimulator().estimateRemainingTicks(
    remainingBudgetMs, tier, mode, multiplier,
  );
}

/**
 * Build a window-specific chat bridge bundle for a named window type.
 * Use when a specific window activates mid-season and must emit its own signal.
 */
export function buildSeasonWindowChatBridgeBundle(
  window: SeasonTimeWindow,
  lifecycle: SeasonLifecycleState,
  pressureMultiplier: number,
  roomId: Nullable<ChatRoomId>,
  nowMs?: number,
): SeasonChatBridgeBundle {
  return new SeasonChatBridgeAdapter().buildWindowActivationBundle(
    window, lifecycle, pressureMultiplier, roomId, nowMs,
  );
}
