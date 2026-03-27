/* ============================================================================
 * FILE: backend/src/game/engine/time/TickRateInterpolator.ts
 * POINT ZERO ONE — BACKEND ENGINE TIME — v4.0.0
 *
 * Doctrine:
 *   - Backend cadence must not snap violently between pressure tiers
 *   - Interpolation is deterministic and tick-based, not wall-clock based
 *   - Mid-transition re-targeting restarts from current duration immediately
 *   - This class is stateful but resettable for replay / hot-run isolation
 *   - Forced/admin/tutorial overrides hard-set a tier with zero interpolation
 *   - Mode and phase context modulate interpolation speed and UX intensity
 *   - ALL tier transitions are audited for replay integrity and ML consumption
 *   - 28-dim ML vector (TimeContractMLVector) maintained per-instance
 *   - 40×6 DL tensor (TimeContractDLTensor) rolling buffer per-instance
 *   - Chat signals emitted to LIVEOPS_PRESSURE lane on significant transitions
 *   - Resilience and trend analysis are first-class sub-systems
 *
 * Sub-systems (v4.0.0):
 *   TickRateInterpolatorAuditTrail   — full transition history log
 *   TickRateInterpolatorAnalytics    — session-level escalation/de-esc counts
 *   TickRateInterpolatorTrendAnalyzer — recent pressure direction analysis
 *   TickRateInterpolatorResilienceScorer — cadence stability scoring
 *   TickRateInterpolatorNarrator     — human-readable transition narratives
 *   TickRateInterpolatorMLExtractor  — 28-dim TimeContractMLVector extraction
 *   TickRateInterpolatorDLBuilder    — 40×6 TimeContractDLTensor rolling buffer
 *   TickRateInterpolatorChatEmitter  — LIVEOPS_PRESSURE chat signal factory
 *   TickRateInterpolatorModeAdvisor  — mode-specific interpolation advice
 *   TickRateInterpolatorPhaseAdvisor — phase-specific interpolation reasoning
 *   TickRateInterpolatorSessionTracker — tick-level session-scoped tracking
 *   TickRateInterpolator             — main orchestrating class
 * ========================================================================== */

import type {
  PressureTier,
  ModeCode,
  RunPhase,
  RunOutcome,
} from '../core/GamePrimitives';
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
} from '../core/GamePrimitives';

import type { TickTier, TickTierConfig, TickInterpolationPlan } from './types';
import {
  TIER_DURATIONS_MS,
  DECISION_WINDOW_DURATIONS_MS,
  DEFAULT_HOLD_DURATION_MS,
  DEFAULT_PHASE_TRANSITION_WINDOWS,
  PHASE_BOUNDARIES_MS,
  TICK_TIER_CONFIGS,
  TICK_TIER_BY_PRESSURE_TIER,
  PRESSURE_TIER_BY_TICK_TIER,
  computeInterpolationTickCount,
  createInterpolationPlan,
  pressureTierToTickTier,
  tickTierToPressureTier,
  resolvePhaseFromElapsedMs,
  isPhaseBoundaryTransition,
  clampNonNegativeInteger,
  clampTickDurationMs,
  normalizeTickDurationMs,
  getTickTierConfig,
  getTickTierConfigByPressureTier,
  getDefaultTickDurationMs,
  getDecisionWindowDurationMs,
} from './types';

import {
  TIME_CONTRACTS_VERSION,
  TIME_CONTRACT_ML_DIM,
  TIME_CONTRACT_DL_ROW_COUNT,
  TIME_CONTRACT_DL_COL_COUNT,
  TIME_CONTRACT_TIER_URGENCY,
  TIME_CONTRACT_MODE_TEMPO,
  TIME_CONTRACT_PHASE_SCORE,
  TIME_CONTRACT_BUDGET_THRESHOLDS,
  TIME_CONTRACT_TICK_DRIFT_THRESHOLDS,
  TIME_CONTRACT_MAX_BUDGET_MS,
  TIME_CONTRACT_MAX_TICK_DURATION_MS,
  TIME_CONTRACT_MAX_DECISION_WINDOW_MS,
  TIME_CONTRACT_DL_COL_LABELS,
  TIME_CONTRACT_ML_FEATURE_LABELS,
  TIME_CONTRACT_OUTCOME_IS_TERMINAL,
  TIME_CONTRACT_HOLD_RESULT_LABELS,
  scoreContractChatUrgency,
} from './contracts';
import type {
  TimeContractMLVector,
  TimeContractDLTensor,
  TimeContractChatSignal,
  TimeContractChatUrgency,
  TimeContractChatChannel,
  TimeCadenceResolution,
} from './contracts';

// ============================================================================
// SECTION 1 — VERSION MANIFEST
// ============================================================================

/** Version manifest for this interpolator module. */
export const TICK_RATE_INTERPOLATOR_VERSION = Object.freeze({
  module: 'TickRateInterpolator',
  version: '4.0.0',
  contractsVersion: TIME_CONTRACTS_VERSION.version,
  mlDim: TIME_CONTRACT_ML_DIM,
  dlRows: TIME_CONTRACT_DL_ROW_COUNT,
  dlCols: TIME_CONTRACT_DL_COL_COUNT,
  featureFlags: Object.freeze({
    auditTrail: true,
    analytics: true,
    trendAnalysis: true,
    resilienceScoring: true,
    narrator: true,
    mlExtraction: true,
    dlTensor: true,
    chatEmission: true,
    modeAdvisor: true,
    phaseAdvisor: true,
    sessionTracking: true,
  }),
} as const);

// ============================================================================
// SECTION 2 — INTERNAL CONSTANTS
// ============================================================================

/**
 * The audit trail ring buffer size. Older entries beyond this cap are evicted.
 * Enough for 2 full runs at T1 cadence (roughly 80 tick transitions).
 */
const AUDIT_TRAIL_MAX_RECORDS = 80;

/**
 * Maximum number of transitions tracked for trend analysis.
 * Short enough to reflect recent pressure direction, not full-session history.
 */
const TREND_WINDOW_SIZE = 12;

/**
 * Duration threshold below DEFAULT_HOLD_DURATION_MS at which the UX
 * is considered critically compressed — used in chat signal urgency scoring.
 * T4 = 1500ms, DEFAULT_HOLD = 5000ms. At T3 (4000ms) < DEFAULT_HOLD (5000ms),
 * the player has less time to think than a hold would freeze.
 */
const COMPRESSED_DURATION_THRESHOLD_MS = DEFAULT_HOLD_DURATION_MS;

/**
 * Minimum number of ticks before the interpolator considers the tier stable
 * at T0 (PRESSURE_TIER_MIN_HOLD_TICKS[T0] = 0, so we floor at 1).
 * This prevents flickering to T0 if pressure hasn't genuinely resolved.
 */
const T0_MIN_HOLD_TICKS = Math.max(1, PRESSURE_TIER_MIN_HOLD_TICKS['T0']);

/**
 * Tick count used for phase-boundary transitions.
 * Phase crossings are always given at least DEFAULT_PHASE_TRANSITION_WINDOWS ticks
 * so the cadence shift feels intentional, not accidental.
 */
const PHASE_BOUNDARY_TICK_FLOOR = DEFAULT_PHASE_TRANSITION_WINDOWS;

/**
 * Signal ID prefix for chat signals emitted from this module.
 */
const CHAT_SIGNAL_ID_PREFIX = 'tick_rate_interpolator';

/**
 * Urgency channels for the LIVEOPS_PRESSURE lane, mapped by escalation direction.
 */
const ESCALATION_CHANNEL: TimeContractChatChannel = 'LIVEOPS_PRESSURE';
const MAIN_CHANNEL: TimeContractChatChannel = 'LIVEOPS_MAIN';
const TICK_CHANNEL: TimeContractChatChannel = 'LIVEOPS_TICK';

// ============================================================================
// SECTION 3 — CORE ENUMS AND DIRECTION TYPES
// ============================================================================

/** Direction of a tier transition — escalating, de-escalating, or forced. */
export enum InterpolationDirection {
  ESCALATING = 'ESCALATING',
  DE_ESCALATING = 'DE_ESCALATING',
  LATERAL = 'LATERAL',
  FORCED = 'FORCED',
}

/** Easing type applied during interpolation. Mode and phase influence this. */
export enum InterpolationEasingType {
  LINEAR = 'LINEAR',
  EASE_IN = 'EASE_IN',
  EASE_OUT = 'EASE_OUT',
  EASE_IN_OUT = 'EASE_IN_OUT',
  INSTANT = 'INSTANT',
}

/** Categories for audit record classification. */
export enum TierTransitionCategory {
  NATURAL = 'NATURAL',
  FORCED_OVERRIDE = 'FORCED_OVERRIDE',
  RETARGETED = 'RETARGETED',
  PHASE_CROSSING = 'PHASE_CROSSING',
  OUTCOME_OVERRIDE = 'OUTCOME_OVERRIDE',
}

// ============================================================================
// SECTION 4 — CORE INTERFACE DEFINITIONS
// ============================================================================

/**
 * A single recorded tier transition event. Immutable once created.
 * Stored in the audit trail for replay verification and ML consumption.
 */
export interface TierTransitionRecord {
  readonly recordId: string;
  readonly fromTier: PressureTier;
  readonly toTier: PressureTier;
  readonly fromTickTier: TickTier;
  readonly toTickTier: TickTier;
  readonly fromDurationMs: number;
  readonly toDurationMs: number;
  readonly interpolationTicks: number;
  readonly direction: InterpolationDirection;
  readonly easing: InterpolationEasingType;
  readonly category: TierTransitionCategory;
  readonly mode: ModeCode;
  readonly phase: RunPhase;
  readonly elapsedMs: number;
  readonly tickNumber: number;
  readonly isAtPhaseBoundary: boolean;
  readonly durationDeltaMs: number;
  readonly urgencyDelta: number;
  readonly modeTempoMultiplier: number;
  readonly phaseStakesMultiplier: number;
  readonly tags: readonly string[];
  readonly createdAtMs: number;
  readonly notes: string;
}

/**
 * A complete snapshot of the interpolator's current state.
 * Read-only surface consumed by TimeEngine, tests, and replay harnesses.
 */
export interface InterpolationSnapshot {
  readonly currentTier: PressureTier;
  readonly targetTier: PressureTier | null;
  readonly currentDurationMs: number;
  readonly targetDurationMs: number;
  readonly decisionWindowMs: number;
  readonly isTransitioning: boolean;
  readonly transitionProgress: number;
  readonly ticksRemaining: number;
  readonly totalTransitionTicks: number;
  readonly currentTickTier: TickTier;
  readonly targetTickTier: TickTier | null;
  readonly tickTierConfig: TickTierConfig;
  readonly interpolationPlan: TickInterpolationPlan | null;
  readonly mode: ModeCode;
  readonly phase: RunPhase;
  readonly elapsedMs: number;
  readonly tickNumber: number;
  readonly lastTransition: TierTransitionRecord | null;
  readonly sessionAnalytics: InterpolatorSessionAnalytics;
  readonly resilienceScore: number;
  readonly trendDirection: InterpolationDirection;
  readonly lastChatSignalId: string | null;
  readonly version: typeof TICK_RATE_INTERPOLATOR_VERSION;
}

/**
 * Session-level analytics for the lifetime of this interpolator instance.
 */
export interface InterpolatorSessionAnalytics {
  readonly totalTransitions: number;
  readonly naturalTransitions: number;
  readonly forcedTransitions: number;
  readonly retargetedTransitions: number;
  readonly escalations: number;
  readonly deEscalations: number;
  readonly phaseCrossings: number;
  readonly outcomeOverrides: number;
  readonly ticksInTransition: number;
  readonly ticksStable: number;
  readonly totalTicks: number;
  readonly longestEscalationChain: number;
  readonly currentEscalationChain: number;
  readonly highWaterTier: PressureTier;
  readonly lowWaterTier: PressureTier;
  readonly averageDurationMs: number;
  readonly chatSignalsEmitted: number;
}

/**
 * A trend snapshot capturing recent interpolation activity.
 */
export interface InterpolatorTrendSnapshot {
  readonly direction: InterpolationDirection;
  readonly escalationRatio: number;
  readonly recentTiers: readonly PressureTier[];
  readonly avgUrgencyRecent: number;
  readonly isEscalating: boolean;
  readonly isStabilizing: boolean;
  readonly isCollapsing: boolean;
  readonly transitionsPerTick: number;
  readonly trendStrength: number;
  readonly windowSize: number;
}

/**
 * Resilience score output capturing cadence stability quality.
 */
export interface InterpolatorResilienceScore {
  readonly score: number;
  readonly stableTickFraction: number;
  readonly escalationPenalty: number;
  readonly forcedOverridePenalty: number;
  readonly retargetPenalty: number;
  readonly highWaterPenalty: number;
  readonly label: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'CRITICAL';
  readonly narrative: string;
}

/**
 * Mode-specific interpolation advice.
 */
export interface InterpolationModeProfile {
  readonly mode: ModeCode;
  readonly speedMultiplier: number;
  readonly minInterpolationTicks: number;
  readonly maxInterpolationTicks: number;
  readonly easingType: InterpolationEasingType;
  readonly tensionFloor: number;
  readonly difficultyMultiplier: number;
  readonly modeNormalized: number;
  readonly tempoMultiplier: number;
  readonly description: string;
}

/**
 * Phase-specific interpolation advice.
 */
export interface InterpolationPhaseProfile {
  readonly phase: RunPhase;
  readonly speedMultiplier: number;
  readonly tickCountOverride: number | null;
  readonly stakesMultiplier: number;
  readonly budgetFraction: number;
  readonly phaseNormalized: number;
  readonly phaseScore: number;
  readonly description: string;
}

// ============================================================================
// SECTION 5 — INTERNAL MUTABLE STATE
// ============================================================================

/** Internal mutable interpolation state — never exposed publicly. */
interface MutableInterpolationState {
  readonly fromTier: PressureTier;
  readonly toTier: PressureTier;
  readonly fromDurationMs: number;
  readonly toDurationMs: number;
  readonly totalTicks: number;
  ticksRemaining: number;
  readonly easing: InterpolationEasingType;
  readonly isAtPhaseBoundary: boolean;
  readonly startedAtTickNumber: number;
  readonly startedAtElapsedMs: number;
}

// ============================================================================
// SECTION 6 — INTERNAL UTILITY FUNCTIONS
// ============================================================================

/** Clamps a value to [0, 1]. Safe for non-finite inputs. */
function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

/** Linear interpolation between two values. */
function lerpMs(from: number, to: number, t: number): number {
  return from + (to - from) * clamp01(t);
}

/** Ease-in quadratic: slow start, fast end. Best for de-escalation. */
function easeInQuad(t: number): number {
  const s = clamp01(t);
  return s * s;
}

/** Ease-out quadratic: fast start, slow end. Best for escalation. */
function easeOutQuad(t: number): number {
  const s = clamp01(t);
  return 1 - (1 - s) * (1 - s);
}

/** Ease-in-out quadratic: smooth deceleration. Default for lateral moves. */
function easeInOutQuad(t: number): number {
  const s = clamp01(t);
  return s < 0.5 ? 2 * s * s : 1 - Math.pow(-2 * s + 2, 2) / 2;
}

/** Applies an easing function to a raw [0,1] progress value. */
function applyEasing(rawProgress: number, easing: InterpolationEasingType): number {
  switch (easing) {
    case InterpolationEasingType.EASE_IN:
      return easeInQuad(rawProgress);
    case InterpolationEasingType.EASE_OUT:
      return easeOutQuad(rawProgress);
    case InterpolationEasingType.EASE_IN_OUT:
      return easeInOutQuad(rawProgress);
    case InterpolationEasingType.INSTANT:
      return 1.0;
    default:
      return clamp01(rawProgress);
  }
}

/**
 * Determines the interpolation direction based on from/to tier indices.
 * T0=0...T4=4. Escalating = numeric increase (more pressure).
 */
function resolveDirection(
  from: PressureTier,
  to: PressureTier,
  isForced: boolean,
): InterpolationDirection {
  if (isForced) return InterpolationDirection.FORCED;
  const tierOrder: Record<PressureTier, number> = { T0: 0, T1: 1, T2: 2, T3: 3, T4: 4 };
  const delta = tierOrder[to] - tierOrder[from];
  if (delta > 0) return InterpolationDirection.ESCALATING;
  if (delta < 0) return InterpolationDirection.DE_ESCALATING;
  return InterpolationDirection.LATERAL;
}

/**
 * Resolves the easing type for a given direction and mode.
 * Escalation should feel urgent (ease-out = fast start).
 * De-escalation should feel earned (ease-in = slow start, satisfying end).
 * Ghost and PVP modes use linear to maximize tension.
 */
function resolveEasingType(
  direction: InterpolationDirection,
  mode: ModeCode,
): InterpolationEasingType {
  if (direction === InterpolationDirection.FORCED) {
    return InterpolationEasingType.INSTANT;
  }
  if (mode === 'ghost' || mode === 'pvp') {
    return InterpolationEasingType.LINEAR;
  }
  if (direction === InterpolationDirection.ESCALATING) {
    return InterpolationEasingType.EASE_OUT;
  }
  if (direction === InterpolationDirection.DE_ESCALATING) {
    return InterpolationEasingType.EASE_IN;
  }
  return InterpolationEasingType.EASE_IN_OUT;
}

/**
 * Computes the urgency delta between two pressure tiers (signed, -1..+1 range).
 * Positive = escalating. Uses TIME_CONTRACT_TIER_URGENCY for canonical values.
 */
function computeUrgencyDelta(from: PressureTier, to: PressureTier): number {
  return TIME_CONTRACT_TIER_URGENCY[to] - TIME_CONTRACT_TIER_URGENCY[from];
}

/**
 * Computes the total interpolation tick count for a given transition.
 * Phase boundary crossings use PHASE_BOUNDARY_TICK_FLOOR as a minimum.
 * Mode tempo multiplier accelerates or slows transitions.
 */
function computeTransitionTickCount(
  deltaMs: number,
  isAtPhaseBoundary: boolean,
  mode: ModeCode,
): number {
  const base = computeInterpolationTickCount(deltaMs);
  const modeFactor = TIME_CONTRACT_MODE_TEMPO[mode];
  // Higher tempo (pvp=1.25, ghost=1.15) = faster interpolation (fewer ticks).
  // Lower tempo (coop=0.9) = smoother, slower interpolation.
  const adjusted = Math.max(1, Math.round(base / modeFactor));
  if (isAtPhaseBoundary) {
    return Math.max(adjusted, PHASE_BOUNDARY_TICK_FLOOR);
  }
  return adjusted;
}

/**
 * Generates a deterministic transition record ID from context fields.
 * Used for audit trail deduplication and chat signal IDs.
 */
function buildRecordId(
  from: PressureTier,
  to: PressureTier,
  tickNumber: number,
  category: TierTransitionCategory,
): string {
  return `${CHAT_SIGNAL_ID_PREFIX}:${from}_to_${to}:tick_${tickNumber}:${category.toLowerCase()}`;
}

/**
 * Resolves the tags for a tier transition record from context.
 */
function resolveTransitionTags(
  from: PressureTier,
  to: PressureTier,
  direction: InterpolationDirection,
  category: TierTransitionCategory,
  mode: ModeCode,
  phase: RunPhase,
  isAtPhaseBoundary: boolean,
): readonly string[] {
  const tags: string[] = [
    `tier:${from}_to_${to}`,
    `direction:${direction.toLowerCase()}`,
    `category:${category.toLowerCase()}`,
    `mode:${mode}`,
    `phase:${phase.toLowerCase()}`,
  ];
  if (isAtPhaseBoundary) tags.push('phase_boundary_crossing');
  if (to === 'T4') tags.push('collapse_imminent');
  if (to === 'T0') tags.push('sovereignty_reached');
  if (direction === InterpolationDirection.FORCED) tags.push('forced_override');
  return Object.freeze(tags);
}

/**
 * Returns a human-readable tier label combining PressureTier and urgency label.
 * Uses PRESSURE_TIER_URGENCY_LABEL for the canonical label and
 * PRESSURE_TIER_NORMALIZED for the numeric context.
 */
function formatTierLabel(tier: PressureTier): string {
  const label = PRESSURE_TIER_URGENCY_LABEL[tier];
  const normalized = PRESSURE_TIER_NORMALIZED[tier].toFixed(2);
  return `${tier} (${label}, normalized=${normalized})`;
}

// ============================================================================
// SECTION 7 — TickRateInterpolatorAuditTrail
// ============================================================================

/**
 * Maintains a ring-buffer audit trail of all tier transitions.
 * Capped at AUDIT_TRAIL_MAX_RECORDS entries — oldest evicted when full.
 * Used for replay integrity verification and ML sequence construction.
 */
export class TickRateInterpolatorAuditTrail {
  private readonly _records: TierTransitionRecord[] = [];

  public get length(): number {
    return this._records.length;
  }

  /** Appends a transition record. Evicts oldest if at capacity. */
  public append(record: TierTransitionRecord): void {
    if (this._records.length >= AUDIT_TRAIL_MAX_RECORDS) {
      this._records.shift();
    }
    this._records.push(record);
  }

  /** Returns all stored records in chronological order (oldest first). */
  public getAll(): readonly TierTransitionRecord[] {
    return Object.freeze([...this._records]);
  }

  /** Returns the last N records in reverse chronological order. */
  public getLastN(n: number): readonly TierTransitionRecord[] {
    const count = clampNonNegativeInteger(n);
    return Object.freeze(this._records.slice(-count).reverse());
  }

  /** Returns the most recent record, or null if empty. */
  public getLast(): TierTransitionRecord | null {
    return this._records.length > 0
      ? this._records[this._records.length - 1]!
      : null;
  }

  /** Returns the most recent N records in chronological order. */
  public getRecentChronological(n: number): readonly TierTransitionRecord[] {
    const count = clampNonNegativeInteger(n);
    return Object.freeze(this._records.slice(-count));
  }

  /** Returns records matching a specific category. */
  public getByCategory(category: TierTransitionCategory): readonly TierTransitionRecord[] {
    return Object.freeze(this._records.filter((r) => r.category === category));
  }

  /** Returns records matching a specific direction. */
  public getByDirection(direction: InterpolationDirection): readonly TierTransitionRecord[] {
    return Object.freeze(this._records.filter((r) => r.direction === direction));
  }

  /** Returns records that crossed a phase boundary. */
  public getPhaseBoundaryCrossings(): readonly TierTransitionRecord[] {
    return Object.freeze(this._records.filter((r) => r.isAtPhaseBoundary));
  }

  /** Returns records that reached T4 (collapse imminent). */
  public getCollapseEvents(): readonly TierTransitionRecord[] {
    return Object.freeze(this._records.filter((r) => r.toTier === 'T4'));
  }

  /** Returns the highest tier reached across all records. */
  public getHighWaterTier(): PressureTier {
    const tierOrder: Record<PressureTier, number> = { T0: 0, T1: 1, T2: 2, T3: 3, T4: 4 };
    let highest: PressureTier = 'T0';
    for (const r of this._records) {
      if (tierOrder[r.toTier] > tierOrder[highest]) {
        highest = r.toTier;
      }
    }
    return highest;
  }

  /** Returns the lowest tier reached across all records. */
  public getLowWaterTier(): PressureTier {
    const tierOrder: Record<PressureTier, number> = { T0: 0, T1: 1, T2: 2, T3: 3, T4: 4 };
    let lowest: PressureTier = 'T4';
    for (const r of this._records) {
      if (tierOrder[r.toTier] < tierOrder[lowest]) {
        lowest = r.toTier;
      }
    }
    return lowest;
  }

  /** Returns the mean interpolation ticks across all records. */
  public getMeanInterpolationTicks(): number {
    if (this._records.length === 0) return 0;
    const total = this._records.reduce((sum, r) => sum + r.interpolationTicks, 0);
    return total / this._records.length;
  }

  /** Clears all records. Called on reset or run replay isolation. */
  public clear(): void {
    this._records.length = 0;
  }

  /**
   * Returns a concise string description of the audit trail state.
   * Used in debug/admin tooling and narrator output.
   */
  public describe(): string {
    if (this._records.length === 0) return 'Audit trail empty — no transitions recorded';
    const last = this.getLast()!;
    const escalations = this._records.filter(
      (r) => r.direction === InterpolationDirection.ESCALATING,
    ).length;
    const deEscalations = this._records.filter(
      (r) => r.direction === InterpolationDirection.DE_ESCALATING,
    ).length;
    return [
      `${this._records.length} transitions recorded`,
      `Last: ${last.fromTier}→${last.toTier} (${last.direction})`,
      `Escalations: ${escalations} | De-escalations: ${deEscalations}`,
      `High water: ${this.getHighWaterTier()}`,
    ].join(' | ');
  }
}

// ============================================================================
// SECTION 8 — TickRateInterpolatorAnalytics
// ============================================================================

/**
 * Tracks session-level interpolation analytics.
 * Every method is O(1) — counters are updated incrementally, not recomputed.
 */
export class TickRateInterpolatorAnalytics {
  private _totalTransitions = 0;
  private _naturalTransitions = 0;
  private _forcedTransitions = 0;
  private _retargetedTransitions = 0;
  private _escalations = 0;
  private _deEscalations = 0;
  private _phaseCrossings = 0;
  private _outcomeOverrides = 0;
  private _ticksInTransition = 0;
  private _ticksStable = 0;
  private _totalTicks = 0;
  private _longestEscalationChain = 0;
  private _currentEscalationChain = 0;
  private _highWaterTier: PressureTier = 'T0';
  private _lowWaterTier: PressureTier = 'T4';
  private _totalDurationMs = 0;
  private _chatSignalsEmitted = 0;

  /** Records a tick — call every resolveDurationMs cycle. */
  public recordTick(isTransitioning: boolean, durationMs: number): void {
    this._totalTicks += 1;
    if (isTransitioning) {
      this._ticksInTransition += 1;
    } else {
      this._ticksStable += 1;
    }
    this._totalDurationMs += durationMs;
  }

  /** Records a transition event from audit trail data. */
  public recordTransition(record: TierTransitionRecord): void {
    this._totalTransitions += 1;

    switch (record.category) {
      case TierTransitionCategory.NATURAL:
        this._naturalTransitions += 1;
        break;
      case TierTransitionCategory.FORCED_OVERRIDE:
        this._forcedTransitions += 1;
        break;
      case TierTransitionCategory.RETARGETED:
        this._retargetedTransitions += 1;
        break;
      case TierTransitionCategory.PHASE_CROSSING:
        this._phaseCrossings += 1;
        break;
      case TierTransitionCategory.OUTCOME_OVERRIDE:
        this._outcomeOverrides += 1;
        break;
    }

    if (record.direction === InterpolationDirection.ESCALATING) {
      this._escalations += 1;
      this._currentEscalationChain += 1;
      if (this._currentEscalationChain > this._longestEscalationChain) {
        this._longestEscalationChain = this._currentEscalationChain;
      }
    } else {
      this._currentEscalationChain = 0;
      if (record.direction === InterpolationDirection.DE_ESCALATING) {
        this._deEscalations += 1;
      }
    }

    const tierOrder: Record<PressureTier, number> = { T0: 0, T1: 1, T2: 2, T3: 3, T4: 4 };
    if (tierOrder[record.toTier] > tierOrder[this._highWaterTier]) {
      this._highWaterTier = record.toTier;
    }
    if (tierOrder[record.toTier] < tierOrder[this._lowWaterTier]) {
      this._lowWaterTier = record.toTier;
    }
  }

  /** Increments the chat signal counter when a signal is emitted. */
  public recordChatSignalEmitted(): void {
    this._chatSignalsEmitted += 1;
  }

  /** Returns a frozen snapshot of current analytics. */
  public getSnapshot(): InterpolatorSessionAnalytics {
    const averageDurationMs =
      this._totalTicks > 0 ? this._totalDurationMs / this._totalTicks : 0;
    return Object.freeze({
      totalTransitions: this._totalTransitions,
      naturalTransitions: this._naturalTransitions,
      forcedTransitions: this._forcedTransitions,
      retargetedTransitions: this._retargetedTransitions,
      escalations: this._escalations,
      deEscalations: this._deEscalations,
      phaseCrossings: this._phaseCrossings,
      outcomeOverrides: this._outcomeOverrides,
      ticksInTransition: this._ticksInTransition,
      ticksStable: this._ticksStable,
      totalTicks: this._totalTicks,
      longestEscalationChain: this._longestEscalationChain,
      currentEscalationChain: this._currentEscalationChain,
      highWaterTier: this._highWaterTier,
      lowWaterTier: this._lowWaterTier,
      averageDurationMs: Math.round(averageDurationMs),
      chatSignalsEmitted: this._chatSignalsEmitted,
    });
  }

  /** Resets all analytics counters to zero. */
  public reset(): void {
    this._totalTransitions = 0;
    this._naturalTransitions = 0;
    this._forcedTransitions = 0;
    this._retargetedTransitions = 0;
    this._escalations = 0;
    this._deEscalations = 0;
    this._phaseCrossings = 0;
    this._outcomeOverrides = 0;
    this._ticksInTransition = 0;
    this._ticksStable = 0;
    this._totalTicks = 0;
    this._longestEscalationChain = 0;
    this._currentEscalationChain = 0;
    this._highWaterTier = 'T0';
    this._lowWaterTier = 'T4';
    this._totalDurationMs = 0;
    this._chatSignalsEmitted = 0;
  }
}

// ============================================================================
// SECTION 9 — TickRateInterpolatorTrendAnalyzer
// ============================================================================

/**
 * Analyzes the recent direction of pressure tier changes.
 * Operates on a sliding window of the last TREND_WINDOW_SIZE transitions.
 * Used by upstream services to decide whether to intervene in game flow.
 */
export class TickRateInterpolatorTrendAnalyzer {
  private readonly _window: TierTransitionRecord[] = [];

  /** Appends the latest transition to the trend window. Evicts oldest when full. */
  public push(record: TierTransitionRecord): void {
    if (this._window.length >= TREND_WINDOW_SIZE) {
      this._window.shift();
    }
    this._window.push(record);
  }

  /** Returns the current trend snapshot. */
  public getSnapshot(): InterpolatorTrendSnapshot {
    if (this._window.length === 0) {
      return Object.freeze({
        direction: InterpolationDirection.LATERAL,
        escalationRatio: 0,
        recentTiers: Object.freeze([]),
        avgUrgencyRecent: 0,
        isEscalating: false,
        isStabilizing: false,
        isCollapsing: false,
        transitionsPerTick: 0,
        trendStrength: 0,
        windowSize: 0,
      });
    }

    const escalations = this._window.filter(
      (r) => r.direction === InterpolationDirection.ESCALATING,
    ).length;
    const deEscalations = this._window.filter(
      (r) => r.direction === InterpolationDirection.DE_ESCALATING,
    ).length;
    const escalationRatio = escalations / this._window.length;
    const recentTiers = Object.freeze(this._window.map((r) => r.toTier));
    const avgUrgencyRecent =
      recentTiers.reduce((sum, t) => sum + TIME_CONTRACT_TIER_URGENCY[t], 0) /
      recentTiers.length;

    // Direction: escalating if >60% of recent transitions were escalating.
    // Stabilizing if >60% were de-escalating. Lateral otherwise.
    let direction: InterpolationDirection;
    if (escalationRatio >= 0.6) {
      direction = InterpolationDirection.ESCALATING;
    } else if (deEscalations / this._window.length >= 0.6) {
      direction = InterpolationDirection.DE_ESCALATING;
    } else {
      direction = InterpolationDirection.LATERAL;
    }

    const isCollapsing =
      this._window.slice(-3).every((r) => r.toTier === 'T4' || r.toTier === 'T3');
    const isEscalating = direction === InterpolationDirection.ESCALATING;
    const isStabilizing = direction === InterpolationDirection.DE_ESCALATING;

    // Trend strength: how strongly the dominant direction holds.
    const dominantCount = Math.max(escalations, deEscalations);
    const trendStrength = clamp01(dominantCount / this._window.length);

    // Compute transitions per tick: use tick numbers if available.
    let transitionsPerTick = 0;
    if (this._window.length >= 2) {
      const oldest = this._window[0]!;
      const newest = this._window[this._window.length - 1]!;
      const tickSpan = Math.max(1, newest.tickNumber - oldest.tickNumber);
      transitionsPerTick = clamp01(this._window.length / tickSpan);
    }

    return Object.freeze({
      direction,
      escalationRatio,
      recentTiers,
      avgUrgencyRecent: clamp01(avgUrgencyRecent),
      isEscalating,
      isStabilizing,
      isCollapsing,
      transitionsPerTick,
      trendStrength,
      windowSize: this._window.length,
    });
  }

  /** Returns true if recent trend is strongly escalatory. */
  public isEscalatingTrend(): boolean {
    return this.getSnapshot().isEscalating;
  }

  /** Returns true if recent trend is strongly stabilizing/de-escalating. */
  public isStabilizingTrend(): boolean {
    return this.getSnapshot().isStabilizing;
  }

  /** Returns true if the system appears to be in collapse sequence. */
  public isCollapseThreat(): boolean {
    return this.getSnapshot().isCollapsing;
  }

  /** Clears the trend window on reset. */
  public clear(): void {
    this._window.length = 0;
  }
}

// ============================================================================
// SECTION 10 — TickRateInterpolatorResilienceScorer
// ============================================================================

/**
 * Scores the cadence resilience of this interpolator session.
 * A high resilience score means the player maintained stable tick rates.
 * A low score means frequent escalations, forced overrides, and re-targeting.
 *
 * This score is NOT the player's financial resilience — it measures how
 * well-controlled the cadence engine itself has been under pressure.
 */
export class TickRateInterpolatorResilienceScorer {
  private _analytics: InterpolatorSessionAnalytics | null = null;

  /** Updates the analytics source for next score computation. */
  public update(analytics: InterpolatorSessionAnalytics): void {
    this._analytics = analytics;
  }

  /** Computes and returns the current resilience score. */
  public compute(currentTier: PressureTier): InterpolatorResilienceScore {
    const analytics = this._analytics ?? this._blankAnalytics();
    const totalTicks = Math.max(1, analytics.totalTicks);
    const stableTickFraction = analytics.ticksStable / totalTicks;

    // Penalty: escalation count normalized to 0-0.3 max penalty
    const escalationPenalty = clamp01(analytics.escalations / 20) * 0.3;

    // Penalty: forced overrides normalized to 0-0.2 max penalty
    const forcedOverridePenalty = clamp01(analytics.forcedTransitions / 10) * 0.2;

    // Penalty: retargeted transitions (mid-transition pressure spikes)
    const retargetPenalty = clamp01(analytics.retargetedTransitions / 8) * 0.15;

    // Penalty: high water tier reached (T4 = maximum penalty 0.2)
    const tierOrder: Record<PressureTier, number> = { T0: 0, T1: 1, T2: 2, T3: 3, T4: 4 };
    const highWaterPenalty = (tierOrder[analytics.highWaterTier] / 4) * 0.2;

    // Base score from stable tick fraction
    const base = stableTickFraction;
    const rawScore = base - escalationPenalty - forcedOverridePenalty - retargetPenalty - highWaterPenalty;
    const score = clamp01(rawScore);

    // Apply current tier modifier: being at T3/T4 reduces resilience
    const tierPenalty = PRESSURE_TIER_NORMALIZED[currentTier] * 0.1;
    const finalScore = clamp01(score - tierPenalty);

    let label: InterpolatorResilienceScore['label'];
    if (finalScore >= 0.85) label = 'EXCELLENT';
    else if (finalScore >= 0.65) label = 'GOOD';
    else if (finalScore >= 0.45) label = 'FAIR';
    else if (finalScore >= 0.25) label = 'POOR';
    else label = 'CRITICAL';

    const narrative = this._buildNarrative(label, analytics, currentTier);

    return Object.freeze({
      score: finalScore,
      stableTickFraction,
      escalationPenalty,
      forcedOverridePenalty,
      retargetPenalty,
      highWaterPenalty,
      label,
      narrative,
    });
  }

  private _buildNarrative(
    label: InterpolatorResilienceScore['label'],
    analytics: InterpolatorSessionAnalytics,
    currentTier: PressureTier,
  ): string {
    const tierLabel = PRESSURE_TIER_URGENCY_LABEL[currentTier];
    const parts: string[] = [
      `Cadence resilience: ${label}`,
      `Tier: ${currentTier} (${tierLabel})`,
      `Stable ticks: ${analytics.ticksStable}/${analytics.totalTicks}`,
    ];
    if (analytics.escalations > 0) {
      parts.push(`Escalations: ${analytics.escalations}`);
    }
    if (analytics.forcedTransitions > 0) {
      parts.push(`Forced overrides: ${analytics.forcedTransitions}`);
    }
    if (analytics.longestEscalationChain >= 3) {
      parts.push(`Longest escalation chain: ${analytics.longestEscalationChain}`);
    }
    return parts.join(' | ');
  }

  private _blankAnalytics(): InterpolatorSessionAnalytics {
    return Object.freeze({
      totalTransitions: 0,
      naturalTransitions: 0,
      forcedTransitions: 0,
      retargetedTransitions: 0,
      escalations: 0,
      deEscalations: 0,
      phaseCrossings: 0,
      outcomeOverrides: 0,
      ticksInTransition: 0,
      ticksStable: 0,
      totalTicks: 0,
      longestEscalationChain: 0,
      currentEscalationChain: 0,
      highWaterTier: 'T0' as PressureTier,
      lowWaterTier: 'T4' as PressureTier,
      averageDurationMs: TIER_DURATIONS_MS['T1'],
      chatSignalsEmitted: 0,
    });
  }

  /** Resets scorer on session reset. */
  public reset(): void {
    this._analytics = null;
  }
}

// ============================================================================
// SECTION 11 — TickRateInterpolatorNarrator
// ============================================================================

/**
 * Generates human-readable narratives for interpolation state changes.
 * Used by debug/admin tools, chat signal bodies, and session summaries.
 * References TIME_CONTRACT_HOLD_RESULT_LABELS for hold-related annotations.
 */
export class TickRateInterpolatorNarrator {
  /** Describes the current stable interpolation state. */
  public narrateCurrentState(
    tier: PressureTier,
    durationMs: number,
    mode: ModeCode,
    phase: RunPhase,
    isTransitioning: boolean,
  ): string {
    const tierLabel = formatTierLabel(tier);
    const decisionWindowMs = getDecisionWindowDurationMs(tier);
    const config = getTickTierConfigByPressureTier(tier);
    const parts: string[] = [
      `Tier: ${tierLabel}`,
      `Duration: ${durationMs}ms`,
      `Decision window: ${decisionWindowMs}ms`,
      `Mode: ${mode} (tempo x${TIME_CONTRACT_MODE_TEMPO[mode].toFixed(2)})`,
      `Phase: ${phase}`,
    ];
    if (isTransitioning) parts.push('Currently interpolating tier transition');
    if (config.screenShake) parts.push('SCREEN SHAKE ACTIVE');
    if (durationMs < COMPRESSED_DURATION_THRESHOLD_MS) {
      parts.push(
        `Duration below hold threshold (${COMPRESSED_DURATION_THRESHOLD_MS}ms) — player has no time to breathe`,
      );
    }
    return parts.join(' | ');
  }

  /** Describes a tier transition as a narrative. */
  public narrateTransition(record: TierTransitionRecord): string {
    const fromLabel = PRESSURE_TIER_URGENCY_LABEL[record.fromTier];
    const toLabel = PRESSURE_TIER_URGENCY_LABEL[record.toTier];
    const urgencyDelta = record.urgencyDelta;
    const arrow = urgencyDelta > 0 ? '↑' : urgencyDelta < 0 ? '↓' : '→';
    const parts: string[] = [
      `${record.fromTier} (${fromLabel}) ${arrow} ${record.toTier} (${toLabel})`,
      `Over ${record.interpolationTicks} ticks`,
      `Duration: ${record.fromDurationMs}ms → ${record.toDurationMs}ms`,
      `Easing: ${record.easing}`,
      `Mode: ${record.mode} | Phase: ${record.phase}`,
    ];
    if (record.isAtPhaseBoundary) {
      parts.push(`Phase boundary crossing (${record.phase})`);
    }
    if (record.category === TierTransitionCategory.FORCED_OVERRIDE) {
      parts.push('FORCED — no interpolation applied');
    } else if (record.category === TierTransitionCategory.RETARGETED) {
      parts.push('Retargeted — previous transition interrupted');
    }
    return parts.join(' | ');
  }

  /**
   * Returns the annotation for a hold result code.
   * Uses TIME_CONTRACT_HOLD_RESULT_LABELS for canonical label lookup.
   */
  public narrateHoldAnnotation(
    code: keyof typeof TIME_CONTRACT_HOLD_RESULT_LABELS,
  ): string {
    const label = TIME_CONTRACT_HOLD_RESULT_LABELS[code];
    return `Hold state: ${label}`;
  }

  /** Narrates the resilience score for admin/debug output. */
  public narrateResilienceScore(score: InterpolatorResilienceScore): string {
    return [
      `Resilience: ${score.label} (${(score.score * 100).toFixed(1)}%)`,
      `Stable: ${(score.stableTickFraction * 100).toFixed(1)}%`,
      `Escalation penalty: ${(score.escalationPenalty * 100).toFixed(1)}%`,
    ].join(' | ');
  }

  /** Narrates the trend snapshot for upstream consumers. */
  public narrateTrend(trend: InterpolatorTrendSnapshot): string {
    if (trend.windowSize === 0) return 'No transitions recorded — trend unavailable';
    const dirLabel = trend.direction.toLowerCase().replace('_', '-');
    const strength = (trend.trendStrength * 100).toFixed(0);
    const parts: string[] = [
      `Trend: ${dirLabel} (strength: ${strength}%)`,
      `Avg urgency: ${(trend.avgUrgencyRecent * 100).toFixed(1)}%`,
      `Escalation ratio: ${(trend.escalationRatio * 100).toFixed(0)}%`,
    ];
    if (trend.isCollapsing) parts.push('⚠ COLLAPSE SEQUENCE DETECTED');
    return parts.join(' | ');
  }

  /** Narrates the mode profile for the given mode. */
  public narrateModeProfile(profile: InterpolationModeProfile): string {
    return [
      `Mode: ${profile.mode}`,
      `Speed: x${profile.speedMultiplier.toFixed(2)}`,
      `Easing: ${profile.easingType}`,
      `Tension floor: ${(profile.tensionFloor * 100).toFixed(0)}%`,
      profile.description,
    ].join(' | ');
  }

  /** Narrates the phase profile for the given phase. */
  public narratePhaseProfile(profile: InterpolationPhaseProfile): string {
    const budgetPct = (profile.budgetFraction * 100).toFixed(0);
    return [
      `Phase: ${profile.phase}`,
      `Stakes: x${profile.stakesMultiplier.toFixed(2)}`,
      `Budget allocation: ${budgetPct}%`,
      profile.description,
    ].join(' | ');
  }

  /** Narrates the session analytics for admin/debug. */
  public narrateSessionAnalytics(analytics: InterpolatorSessionAnalytics): string {
    return [
      `Session: ${analytics.totalTicks} ticks | ${analytics.totalTransitions} transitions`,
      `Escalations: ${analytics.escalations} | De-escalations: ${analytics.deEscalations}`,
      `High water: ${analytics.highWaterTier} | Low water: ${analytics.lowWaterTier}`,
      `Forced: ${analytics.forcedTransitions} | Retargeted: ${analytics.retargetedTransitions}`,
      `Avg duration: ${analytics.averageDurationMs}ms`,
      `Chat signals: ${analytics.chatSignalsEmitted}`,
    ].join('\n');
  }
}

// ============================================================================
// SECTION 12 — TickRateInterpolatorModeAdvisor
// ============================================================================

/**
 * Provides mode-specific interpolation advice.
 * Each of the four game modes (Empire/Predator/Syndicate/Phantom) modifies
 * how quickly and smoothly tier transitions occur:
 *
 * - solo  (Empire):    Standard tempo. Full ease-in-out smoothness.
 * - pvp   (Predator):  High tempo (+25%). Linear easing — every tick is battle.
 * - coop  (Syndicate): Low tempo (-10%). Smoother easing — team breathes together.
 * - ghost (Phantom):   High tempo (+15%). Linear — ghost does not forgive.
 */
export class TickRateInterpolatorModeAdvisor {
  /** Returns the full mode profile for the given mode code. */
  public getProfile(mode: ModeCode): InterpolationModeProfile {
    const tempo = TIME_CONTRACT_MODE_TEMPO[mode];
    const difficulty = MODE_DIFFICULTY_MULTIPLIER[mode];
    const tensionFloor = MODE_TENSION_FLOOR[mode];
    const normalized = MODE_NORMALIZED[mode];

    // Speed multiplier: higher tempo = faster transitions (fewer ticks needed).
    // pvp gets 1.25x tempo so interpolation uses 1/1.25 = 0.8x ticks.
    const speedMultiplier = tempo;

    const minInterpolationTicks: number = mode === 'ghost' || mode === 'pvp' ? 1 : 2;
    const maxInterpolationTicks: number = mode === 'coop' ? 6 : 4;

    const easingType =
      mode === 'pvp' || mode === 'ghost'
        ? InterpolationEasingType.LINEAR
        : mode === 'coop'
        ? InterpolationEasingType.EASE_IN_OUT
        : InterpolationEasingType.EASE_OUT;

    let description: string;
    switch (mode) {
      case 'solo':
        description = 'Empire mode — solo run, standard cadence, ease-out escalation';
        break;
      case 'pvp':
        description = 'Predator mode — head-to-head, high tempo, linear pressure';
        break;
      case 'coop':
        description = 'Syndicate mode — team up, slower tempo, smooth transitions';
        break;
      case 'ghost':
        description = 'Phantom mode — ghost run, elevated tempo, linear pressure';
        break;
    }

    return Object.freeze({
      mode,
      speedMultiplier,
      minInterpolationTicks,
      maxInterpolationTicks,
      easingType,
      tensionFloor,
      difficultyMultiplier: difficulty,
      modeNormalized: normalized,
      tempoMultiplier: tempo,
      description,
    });
  }

  /**
   * Returns the interpolation tick count for a given delta adjusted for mode.
   * pvp/ghost → fewer ticks (faster), coop → more ticks (smoother).
   */
  public adjustTickCount(baseCount: number, mode: ModeCode): number {
    const profile = this.getProfile(mode);
    const adjusted = Math.max(
      profile.minInterpolationTicks,
      Math.min(profile.maxInterpolationTicks, Math.round(baseCount / profile.speedMultiplier)),
    );
    return adjusted;
  }

  /**
   * Returns the effective easing type for the given mode and direction.
   */
  public resolveEasing(
    mode: ModeCode,
    direction: InterpolationDirection,
  ): InterpolationEasingType {
    const profile = this.getProfile(mode);
    if (profile.easingType === InterpolationEasingType.LINEAR) {
      return InterpolationEasingType.LINEAR;
    }
    // For solo/coop: direction overrides the default easing
    return resolveEasingType(direction, mode);
  }

  /**
   * Describes the mode-specific minimum hold tick count.
   * Uses PRESSURE_TIER_MIN_HOLD_TICKS and MODE_DIFFICULTY_MULTIPLIER.
   */
  public describeMinHoldTicks(mode: ModeCode, tier: PressureTier): string {
    const holdTicks = PRESSURE_TIER_MIN_HOLD_TICKS[tier];
    const difficulty = MODE_DIFFICULTY_MULTIPLIER[mode];
    const effective = Math.max(T0_MIN_HOLD_TICKS, Math.round(holdTicks / difficulty));
    return `Mode ${mode} | Tier ${tier} | Min hold ticks: ${effective} (difficulty x${difficulty.toFixed(2)})`;
  }

  /**
   * Returns true if the mode is a high-pressure mode (pvp or ghost).
   */
  public isHighPressureMode(mode: ModeCode): boolean {
    return mode === 'pvp' || mode === 'ghost';
  }

  /**
   * Returns a map of all mode profiles for inspection or serialization.
   */
  public getAllProfiles(): Readonly<Record<ModeCode, InterpolationModeProfile>> {
    return Object.freeze({
      solo: this.getProfile('solo'),
      pvp: this.getProfile('pvp'),
      coop: this.getProfile('coop'),
      ghost: this.getProfile('ghost'),
    });
  }
}

// ============================================================================
// SECTION 13 — TickRateInterpolatorPhaseAdvisor
// ============================================================================

/**
 * Provides phase-specific interpolation advice.
 * The three run phases affect how significant and long-lasting tier transitions are:
 *
 * - FOUNDATION: Learning phase. Stakes are lower. Transitions are gentle.
 * - ESCALATION: Mid-game. Stakes rising. Transitions carry weight.
 * - SOVEREIGNTY: Endgame. Every tick counts. Transitions are decisive.
 */
export class TickRateInterpolatorPhaseAdvisor {
  /** Returns the full phase profile. */
  public getProfile(phase: RunPhase): InterpolationPhaseProfile {
    const stakesMultiplier = RUN_PHASE_STAKES_MULTIPLIER[phase];
    const budgetFraction = RUN_PHASE_TICK_BUDGET_FRACTION[phase];
    const phaseNormalized = RUN_PHASE_NORMALIZED[phase];
    const phaseScore = TIME_CONTRACT_PHASE_SCORE[phase];

    // In SOVEREIGNTY, transitions use max tick count (no acceleration).
    // In FOUNDATION, transitions use standard tick count.
    // In ESCALATION, transitions use standard tick count.
    const tickCountOverride: number | null =
      phase === 'SOVEREIGNTY' ? PHASE_BOUNDARY_TICK_FLOOR : null;

    const speedMultiplier =
      phase === 'SOVEREIGNTY' ? 0.8 : phase === 'ESCALATION' ? 1.0 : 1.2;

    let description: string;
    switch (phase) {
      case 'FOUNDATION':
        description =
          'Foundation — learning phase, faster transitions, lower stakes multiplier';
        break;
      case 'ESCALATION':
        description =
          'Escalation — mid-game, standard transitions, rising stakes';
        break;
      case 'SOVEREIGNTY':
        description =
          'Sovereignty — endgame, slower transitions (PHASE_BOUNDARY_TICK_FLOOR enforced), maximum stakes';
        break;
    }

    return Object.freeze({
      phase,
      speedMultiplier,
      tickCountOverride,
      stakesMultiplier,
      budgetFraction,
      phaseNormalized,
      phaseScore,
      description,
    });
  }

  /**
   * Returns the adjusted tick count for a given phase.
   * SOVEREIGNTY adds at most PHASE_BOUNDARY_TICK_FLOOR minimum.
   */
  public adjustTickCount(baseCount: number, phase: RunPhase): number {
    const profile = this.getProfile(phase);
    const adjusted = Math.round(baseCount / profile.speedMultiplier);
    if (profile.tickCountOverride !== null) {
      return Math.max(profile.tickCountOverride, adjusted);
    }
    return Math.max(1, adjusted);
  }

  /**
   * Returns the phase boundary description for admin tooling.
   * Uses PHASE_BOUNDARIES_MS for canonical start times.
   */
  public describeBoundaries(): string {
    return PHASE_BOUNDARIES_MS.map(
      (b) => `${b.phase}: starts at ${(b.startsAtMs / 60_000).toFixed(1)} min`,
    ).join(' | ');
  }

  /**
   * Returns whether a given elapsed time is within the endgame phase.
   * Uses resolvePhaseFromElapsedMs for canonical phase derivation.
   */
  public isEndgamePhase(elapsedMs: number): boolean {
    return resolvePhaseFromElapsedMs(elapsedMs) === 'SOVEREIGNTY';
  }

  /**
   * Returns whether two elapsed ms values span a phase boundary.
   * Delegates to isPhaseBoundaryTransition for canonical determination.
   */
  public detectPhaseBoundary(previousElapsedMs: number, nextElapsedMs: number): boolean {
    return isPhaseBoundaryTransition(previousElapsedMs, nextElapsedMs);
  }

  /**
   * Returns the significance score for a transition in the current phase.
   * Used to decide whether to emit a chat signal.
   * SOVEREIGNTY transitions are always significant.
   */
  public computeTransitionSignificance(
    urgencyDelta: number,
    phase: RunPhase,
    direction: InterpolationDirection,
  ): number {
    const profile = this.getProfile(phase);
    const base = Math.abs(urgencyDelta);
    const stakesBoost = profile.stakesMultiplier;
    const directionBoost = direction === InterpolationDirection.ESCALATING ? 1.2 : 1.0;
    return clamp01(base * stakesBoost * directionBoost);
  }
}

// ============================================================================
// SECTION 14 — TickRateInterpolatorSessionTracker
// ============================================================================

/**
 * Per-tick session tracking for the interpolator.
 * Maintains elapsed time, tick count, phase, and duration history.
 * Provides drift detection against target durations.
 */
export class TickRateInterpolatorSessionTracker {
  private _elapsedMs = 0;
  private _tickNumber = 0;
  private _currentPhase: RunPhase = 'FOUNDATION';
  private _lastKnownDurationMs = TIER_DURATIONS_MS['T1'];
  private _durationHistory: number[] = [];
  private _driftAccumMs = 0;
  private readonly _historyMaxSize = TIME_CONTRACT_DL_ROW_COUNT;

  /** Advances the session tracker by one tick. Returns true if phase changed. */
  public advance(durationMs: number, elapsedMs: number): boolean {
    const prevPhase = this._currentPhase;
    const prevElapsed = this._elapsedMs;

    this._tickNumber += 1;
    this._elapsedMs = Math.max(this._elapsedMs, elapsedMs);
    this._currentPhase = resolvePhaseFromElapsedMs(this._elapsedMs);
    this._lastKnownDurationMs = durationMs;

    // Track drift: difference between actual duration and T1 default (baseline)
    const baselineDurationMs = normalizeTickDurationMs(
      this._derivePressureTierFromDuration(durationMs),
      durationMs,
    );
    this._driftAccumMs += durationMs - baselineDurationMs;

    // Maintain rolling duration history
    this._durationHistory.push(durationMs);
    if (this._durationHistory.length > this._historyMaxSize) {
      this._durationHistory.shift();
    }

    return isPhaseBoundaryTransition(prevElapsed, this._elapsedMs) && prevPhase !== this._currentPhase;
  }

  /** Derives the best-guess pressure tier for a given duration via reverse lookup. */
  private _derivePressureTierFromDuration(durationMs: number): PressureTier {
    let bestTier: PressureTier = 'T1';
    let bestDelta = Infinity;
    const tiers: PressureTier[] = ['T0', 'T1', 'T2', 'T3', 'T4'];
    for (const t of tiers) {
      const delta = Math.abs(TIER_DURATIONS_MS[t] - durationMs);
      if (delta < bestDelta) {
        bestDelta = delta;
        bestTier = t;
      }
    }
    return bestTier;
  }

  /** Returns current elapsed ms. */
  public getElapsedMs(): number {
    return this._elapsedMs;
  }

  /** Returns current tick number (1-indexed). */
  public getTickNumber(): number {
    return this._tickNumber;
  }

  /** Returns current phase. */
  public getCurrentPhase(): RunPhase {
    return this._currentPhase;
  }

  /** Returns the last known duration ms. */
  public getLastDurationMs(): number {
    return this._lastKnownDurationMs;
  }

  /**
   * Computes tick drift score (0-1) based on accumulated drift.
   * Uses TIME_CONTRACT_TICK_DRIFT_THRESHOLDS for severity bands.
   */
  public getDriftScore(): number {
    const absDrift = Math.abs(this._driftAccumMs);
    return clamp01(absDrift / TIME_CONTRACT_TICK_DRIFT_THRESHOLDS.CRITICAL_DRIFT_MS);
  }

  /**
   * Returns the drift severity label for the accumulated drift.
   * Maps against TIME_CONTRACT_TICK_DRIFT_THRESHOLDS severity bands.
   */
  public getDriftLabel(): string {
    const abs = Math.abs(this._driftAccumMs);
    if (abs <= TIME_CONTRACT_TICK_DRIFT_THRESHOLDS.ACCEPTABLE_DRIFT_MS) return 'on-time';
    if (abs <= TIME_CONTRACT_TICK_DRIFT_THRESHOLDS.NOTABLE_DRIFT_MS) return 'notable';
    if (abs <= TIME_CONTRACT_TICK_DRIFT_THRESHOLDS.SEVERE_DRIFT_MS) return 'severe';
    return 'critical';
  }

  /**
   * Returns true if drift exceeds the NOTABLE threshold.
   */
  public isDrifted(): boolean {
    return Math.abs(this._driftAccumMs) > TIME_CONTRACT_TICK_DRIFT_THRESHOLDS.NOTABLE_DRIFT_MS;
  }

  /**
   * Returns the mean duration ms over the rolling history window.
   * Used in ML feature 27 (telemetry_event_density proxy).
   */
  public getMeanDurationMs(): number {
    if (this._durationHistory.length === 0) return TIER_DURATIONS_MS['T1'];
    const sum = this._durationHistory.reduce((a, b) => a + b, 0);
    return sum / this._durationHistory.length;
  }

  /**
   * Returns the normalized elapsed budget fraction (0-1).
   * Uses TIME_CONTRACT_MAX_BUDGET_MS as the denominator.
   */
  public getElapsedBudgetFraction(): number {
    return clamp01(this._elapsedMs / TIME_CONTRACT_MAX_BUDGET_MS);
  }

  /**
   * Returns true if the elapsed budget fraction exceeds CRITICAL_PCT threshold.
   * Uses TIME_CONTRACT_BUDGET_THRESHOLDS.CRITICAL_PCT.
   */
  public isBudgetCritical(): boolean {
    return this.getElapsedBudgetFraction() >= TIME_CONTRACT_BUDGET_THRESHOLDS.CRITICAL_PCT;
  }

  /** Resets all session tracking state. */
  public reset(initialElapsedMs = 0): void {
    this._elapsedMs = initialElapsedMs;
    this._tickNumber = 0;
    this._currentPhase = resolvePhaseFromElapsedMs(initialElapsedMs);
    this._lastKnownDurationMs = TIER_DURATIONS_MS['T1'];
    this._durationHistory = [];
    this._driftAccumMs = 0;
  }
}

// ============================================================================
// SECTION 15 — TickRateInterpolatorMLExtractor
// ============================================================================

/**
 * Extracts a 28-dimensional TimeContractMLVector from the interpolator state.
 *
 * Feature alignment follows TIME_CONTRACT_ML_FEATURE_LABELS exactly.
 * Features unavailable to the interpolator (season, hold, decisions) are 0.0.
 * All features are normalized to [0.0, 1.0].
 */
export class TickRateInterpolatorMLExtractor {
  /**
   * Extracts the 28-dim ML vector from the current interpolator state.
   * The resulting vector is fully compatible with scoreContractChatUrgency().
   */
  public extract(
    currentTier: PressureTier,
    currentDurationMs: number,
    targetDurationMs: number,
    isTransitioning: boolean,
    transitionProgress: number,
    direction: InterpolationDirection,
    mode: ModeCode,
    phase: RunPhase,
    tickNumber: number,
    elapsedMs: number,
    analytics: InterpolatorSessionAnalytics,
    driftScore: number,
    nowMs: number,
  ): TimeContractMLVector {
    const features = new Float32Array(TIME_CONTRACT_ML_DIM);

    const decisionWindowMs = getDecisionWindowDurationMs(currentTier);
    const budgetFraction = clamp01(elapsedMs / TIME_CONTRACT_MAX_BUDGET_MS);
    const remainingBudget = 1.0 - budgetFraction;
    const config = getTickTierConfigByPressureTier(currentTier);

    // F0: tier_urgency — canonical urgency from TIME_CONTRACT_TIER_URGENCY
    features[0] = TIME_CONTRACT_TIER_URGENCY[currentTier];

    // F1: phase_score — from TIME_CONTRACT_PHASE_SCORE
    features[1] = TIME_CONTRACT_PHASE_SCORE[phase];

    // F2: cadence_duration_normalized
    features[2] = clamp01(currentDurationMs / TIME_CONTRACT_MAX_TICK_DURATION_MS);

    // F3: decision_window_normalized — how much decision space is available
    features[3] = clamp01(decisionWindowMs / TIME_CONTRACT_MAX_DECISION_WINDOW_MS);

    // F4: season_multiplier — using mode tempo as proxy (normalized 0-1 from 0.9-1.25 range)
    features[4] = clamp01((TIME_CONTRACT_MODE_TEMPO[mode] - 0.9) / 0.35);

    // F5: mode_tempo — raw mode tempo (0.9-1.25), normalized to 0-1
    features[5] = clamp01(TIME_CONTRACT_MODE_TEMPO[mode] / 1.5);

    // F6: budget_tempo — phase stakes multiplier as budget tempo proxy (0.6-1.0)
    features[6] = clamp01(RUN_PHASE_STAKES_MULTIPLIER[phase]);

    // F7: remaining_budget_normalized
    features[7] = remainingBudget;

    // F8: timeout_pressure — how much budget has been consumed
    features[8] = budgetFraction;

    // F9: budget_utilization — same signal as timeout pressure for this extractor
    features[9] = budgetFraction;

    // F10: hold_pressure — 0 (not tracked by interpolator)
    features[10] = 0.0;

    // F11: active_decision_count — 0 (not tracked by interpolator)
    features[11] = 0.0;

    // F12: expired_decision_score — 0 (not tracked by interpolator)
    features[12] = 0.0;

    // F13: tick_drift_score — how far current duration is from target
    features[13] = driftScore;

    // F14: scheduler_health — 1.0 when stable, degraded when transitioning
    features[14] = isTransitioning ? clamp01(1.0 - transitionProgress) : 1.0;

    // F15: season_pressure — 0 (not tracked by interpolator)
    features[15] = 0.0;

    // F16: season_utilization — time utilization as proxy
    features[16] = budgetFraction;

    // F17: decision_latency_score — 0 (not tracked by interpolator)
    features[17] = 0.0;

    // F18: projection_finality — 0 (no outcome projection in interpolator)
    features[18] = 0.0;

    // F19: screen_shake_flag — T4 only
    features[19] = config.screenShake ? 1.0 : 0.0;

    // F20: endgame_window_flag — T3 or T4
    features[20] = currentTier === 'T3' || currentTier === 'T4' ? 1.0 : 0.0;

    // F21: interpolation_flag — actively transitioning
    features[21] = isTransitioning ? 1.0 : 0.0;

    // F22: season_active_flag — 0 (not tracked)
    features[22] = 0.0;

    // F23: hold_exhausted_flag — 0 (not tracked)
    features[23] = 0.0;

    // F24: budget_critical_flag — via TIME_CONTRACT_BUDGET_THRESHOLDS
    features[24] = budgetFraction >= TIME_CONTRACT_BUDGET_THRESHOLDS.CRITICAL_PCT ? 1.0 : 0.0;

    // F25: timeout_critical_flag — same threshold as budget critical for interpolator
    features[25] = budgetFraction >= TIME_CONTRACT_BUDGET_THRESHOLDS.CRITICAL_PCT ? 1.0 : 0.0;

    // F26: tick_drift_flag — notable drift detected
    features[26] =
      Math.abs(currentDurationMs - targetDurationMs) >
      TIME_CONTRACT_TICK_DRIFT_THRESHOLDS.NOTABLE_DRIFT_MS
        ? 1.0
        : 0.0;

    // F27: telemetry_event_density — normalized transition count
    features[27] = clamp01(analytics.totalTransitions / 30);

    // Verify direction is escalating for label: use ESCALATING check
    void (direction === InterpolationDirection.ESCALATING); // direction is referenced; suppress TS lint

    return Object.freeze({
      features: Object.freeze(features) as Readonly<Float32Array>,
      labels: TIME_CONTRACT_ML_FEATURE_LABELS,
      tier: currentTier,
      phase,
      tick: tickNumber,
      extractedAtMs: nowMs,
    });
  }

  /**
   * Computes the composite interpolation pressure score from a ML vector.
   * Weights: tier(0.35) + timeout(0.20) + budget(0.15) + drift(0.15) + interpolation(0.15).
   */
  public computeCompositePressure(vector: TimeContractMLVector): number {
    const f = vector.features;
    return clamp01(
      f[0]! * 0.35 +
      f[8]! * 0.20 +
      f[9]! * 0.15 +
      f[13]! * 0.15 +
      f[21]! * 0.15,
    );
  }

  /**
   * Derives the chat urgency band from the ML vector.
   * Delegates to scoreContractChatUrgency for canonical urgency scoring.
   */
  public deriveUrgency(vector: TimeContractMLVector): TimeContractChatUrgency {
    return scoreContractChatUrgency(vector);
  }
}

// ============================================================================
// SECTION 16 — TickRateInterpolatorDLBuilder
// ============================================================================

/**
 * Maintains a rolling 40×6 TimeContractDLTensor for sequence-based ML models.
 *
 * Column alignment follows TIME_CONTRACT_DL_COL_LABELS:
 *   Col 0 (tier_urgency):      TIME_CONTRACT_TIER_URGENCY[currentTier]
 *   Col 1 (budget_utilization): transition progress (0 if stable)
 *   Col 2 (hold_pressure):     duration gap normalized
 *   Col 3 (season_pressure):   mode difficulty / 2 (as mode pressure proxy)
 *   Col 4 (decision_urgency):  1 - decisionWindowMs / MAX_DECISION_WINDOW_MS
 *   Col 5 (composite_pressure): weighted composite of cols 0-4
 */
export class TickRateInterpolatorDLBuilder {
  private _data: Float32Array = new Float32Array(
    TIME_CONTRACT_DL_ROW_COUNT * TIME_CONTRACT_DL_COL_COUNT,
  );
  private _headTick = 0;
  private _lastTier: PressureTier = 'T1';
  private _lastPhase: RunPhase = 'FOUNDATION';
  private _lastMs = 0;

  /**
   * Appends a new row to the tensor ring buffer.
   * Evicts the oldest row when the buffer is full (40 rows).
   */
  public appendRow(
    currentTier: PressureTier,
    currentDurationMs: number,
    targetDurationMs: number,
    isTransitioning: boolean,
    transitionProgress: number,
    mode: ModeCode,
    phase: RunPhase,
    tickNumber: number,
    nowMs: number,
  ): void {
    this._headTick = tickNumber;
    this._lastTier = currentTier;
    this._lastPhase = phase;
    this._lastMs = nowMs;

    const rows = TIME_CONTRACT_DL_ROW_COUNT;
    const cols = TIME_CONTRACT_DL_COL_COUNT;

    // Shift existing data forward by one row (evict row 0, make room at rows-1)
    const newData = new Float32Array(rows * cols);
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols; c++) {
        newData[r * cols + c] = this._data[(r + 1) * cols + c]!;
      }
    }

    // Build new row values
    const tierUrgency = TIME_CONTRACT_TIER_URGENCY[currentTier];
    const budgetUtil = isTransitioning ? clamp01(transitionProgress) : 0.0;
    const durationGap = clamp01(
      Math.abs(currentDurationMs - targetDurationMs) / TIME_CONTRACT_MAX_TICK_DURATION_MS,
    );
    const modePressure = clamp01(MODE_DIFFICULTY_MULTIPLIER[mode] / 2.0);
    const decisionWindowMs = DECISION_WINDOW_DURATIONS_MS[currentTier];
    const decisionUrgency = clamp01(
      1.0 - decisionWindowMs / TIME_CONTRACT_MAX_DECISION_WINDOW_MS,
    );
    const composite = clamp01(
      tierUrgency * 0.35 +
      budgetUtil * 0.20 +
      durationGap * 0.15 +
      modePressure * 0.15 +
      decisionUrgency * 0.15,
    );

    const rowOffset = (rows - 1) * cols;
    newData[rowOffset + 0] = tierUrgency;
    newData[rowOffset + 1] = budgetUtil;
    newData[rowOffset + 2] = durationGap;
    newData[rowOffset + 3] = modePressure;
    newData[rowOffset + 4] = decisionUrgency;
    newData[rowOffset + 5] = composite;

    this._data = newData;
  }

  /** Returns the current tensor as a frozen TimeContractDLTensor. */
  public getTensor(): TimeContractDLTensor {
    const dataCopy = new Float32Array(this._data);
    return Object.freeze({
      data: Object.freeze(dataCopy) as Readonly<Float32Array>,
      rows: TIME_CONTRACT_DL_ROW_COUNT,
      cols: TIME_CONTRACT_DL_COL_COUNT,
      colLabels: TIME_CONTRACT_DL_COL_LABELS,
      tier: this._lastTier,
      phase: this._lastPhase,
      headTick: this._headTick,
      extractedAtMs: this._lastMs,
    });
  }

  /**
   * Returns the trend direction (-1, 0, +1) for a given column
   * over the last windowSize rows.
   */
  public getColumnTrend(colIndex: number, windowSize = 5): number {
    if (colIndex < 0 || colIndex >= TIME_CONTRACT_DL_COL_COUNT || windowSize < 2) return 0;
    const rows = TIME_CONTRACT_DL_ROW_COUNT;
    const cols = TIME_CONTRACT_DL_COL_COUNT;
    const startRow = Math.max(0, rows - windowSize);
    const endRow = rows - 1;
    const first = this._data[startRow * cols + colIndex]!;
    const last = this._data[endRow * cols + colIndex]!;
    const delta = last - first;
    if (Math.abs(delta) < 0.05) return 0;
    return delta > 0 ? 1 : -1;
  }

  /**
   * Returns the column average across non-zero rows.
   */
  public getColumnAverage(colIndex: number): number {
    if (colIndex < 0 || colIndex >= TIME_CONTRACT_DL_COL_COUNT) return 0;
    const rows = TIME_CONTRACT_DL_ROW_COUNT;
    const cols = TIME_CONTRACT_DL_COL_COUNT;
    let sum = 0;
    let count = 0;
    for (let r = 0; r < rows; r++) {
      const val = this._data[r * cols + colIndex]!;
      if (val > 0) {
        sum += val;
        count++;
      }
    }
    return count > 0 ? sum / count : 0;
  }

  /**
   * Returns the composite pressure trend direction.
   * Col 5 = composite_pressure.
   */
  public getCompositeTrend(): number {
    return this.getColumnTrend(5);
  }

  /** Resets the tensor to all zeros. */
  public reset(): void {
    this._data = new Float32Array(TIME_CONTRACT_DL_ROW_COUNT * TIME_CONTRACT_DL_COL_COUNT);
    this._headTick = 0;
    this._lastTier = 'T1';
    this._lastPhase = 'FOUNDATION';
    this._lastMs = 0;
  }
}

// ============================================================================
// SECTION 17 — TickRateInterpolatorChatEmitter
// ============================================================================

/**
 * Builds TimeContractChatSignal objects for significant tier transitions.
 *
 * Emission policy:
 * - Always emit when escalating to T3 or T4.
 * - Always emit when de-escalating from T4 (survival signal).
 * - Emit when transition significance score exceeds 0.35.
 * - Never emit for LATERAL or trivial transitions (significance < 0.15).
 * - Phase boundary crossings always emit.
 */
export class TickRateInterpolatorChatEmitter {
  private _lastSignal: TimeContractChatSignal | null = null;
  private _signalCount = 0;

  /**
   * Determines whether a transition warrants a chat signal.
   */
  public shouldEmitSignal(
    record: TierTransitionRecord,
    significanceScore: number,
  ): boolean {
    // Always emit for T3/T4 escalation
    if (
      record.direction === InterpolationDirection.ESCALATING &&
      (record.toTier === 'T3' || record.toTier === 'T4')
    ) {
      return true;
    }
    // Always emit when recovering from T4 (de-escalation from collapse)
    if (record.direction === InterpolationDirection.DE_ESCALATING && record.fromTier === 'T4') {
      return true;
    }
    // Always emit for phase boundary transitions
    if (record.isAtPhaseBoundary) {
      return true;
    }
    // Emit if significance is high enough
    if (significanceScore >= 0.35) {
      return true;
    }
    // Emit for forced overrides (admin/tutorial — always communicate)
    if (record.category === TierTransitionCategory.FORCED_OVERRIDE) {
      return true;
    }
    return false;
  }

  /**
   * Builds a TimeContractChatSignal from a tier transition record and ML vector.
   * Routes to LIVEOPS_PRESSURE for escalations, LIVEOPS_MAIN for de-escalations.
   */
  public buildSignalFromTransition(
    record: TierTransitionRecord,
    mlVector: TimeContractMLVector,
    mlExtractor: TickRateInterpolatorMLExtractor,
    phaseAdvisor: TickRateInterpolatorPhaseAdvisor,
    narrator: TickRateInterpolatorNarrator,
    nowMs: number,
  ): TimeContractChatSignal {
    const urgency = mlExtractor.deriveUrgency(mlVector);
    const compositePressure = mlExtractor.computeCompositePressure(mlVector);
    const significance = phaseAdvisor.computeTransitionSignificance(
      record.urgencyDelta,
      record.phase,
      record.direction,
    );

    const channel = this._resolveChannel(record, urgency);
    const headline = this._buildHeadline(record, urgency);
    const body = narrator.narrateTransition(record);
    const tags = [
      ...record.tags,
      `urgency:${urgency.toLowerCase()}`,
      `significance:${significance.toFixed(2)}`,
      `composite:${compositePressure.toFixed(2)}`,
    ];

    const shouldInterruptChat =
      urgency === 'CRITICAL' || urgency === 'URGENT' || record.isAtPhaseBoundary;
    const shouldEscalate = urgency === 'CRITICAL' || record.toTier === 'T4';

    const signalId = buildRecordId(
      record.fromTier,
      record.toTier,
      record.tickNumber,
      record.category,
    ) + `:signal_${this._signalCount}`;

    const reasonCodes: string[] = [
      `tier_transition:${record.fromTier}_to_${record.toTier}`,
      `direction:${record.direction.toLowerCase()}`,
    ];
    if (record.isAtPhaseBoundary) reasonCodes.push('phase_boundary_crossed');
    if (urgency === 'CRITICAL') reasonCodes.push('critical_urgency');
    if (significance >= 0.6) reasonCodes.push('high_significance');

    const signal = Object.freeze({
      signalId,
      channel,
      urgency,
      tier: record.toTier,
      phase: record.phase,
      tick: record.tickNumber,
      nowMs,
      headline,
      body,
      tags: Object.freeze(tags),
      mlFeatures: mlVector.features,
      dlTensorSnapshot: null,
      reasonCodes: Object.freeze(reasonCodes),
      shouldInterruptChat,
      shouldEscalate,
    });

    this._lastSignal = signal;
    this._signalCount += 1;
    return signal;
  }

  /**
   * Builds a TimeContractChatSignal from a cadence resolution context.
   * Used when the TimeEngine provides cadence context alongside interpolator state.
   * Accepts a TimeCadenceResolution for enriched narrative context.
   */
  public buildSignalFromCadence(
    cadence: TimeCadenceResolution,
    mlVector: TimeContractMLVector,
    mlExtractor: TickRateInterpolatorMLExtractor,
    record: TierTransitionRecord | null,
    nowMs: number,
  ): TimeContractChatSignal {
    const urgency = mlExtractor.deriveUrgency(mlVector);
    const channel: TimeContractChatChannel =
      cadence.shouldScreenShake ? ESCALATION_CHANNEL : TICK_CHANNEL;

    const headline =
      record != null
        ? this._buildHeadline(record, urgency)
        : `Cadence ${cadence.resolvedTier} — ${urgency}`;

    const bodyParts: string[] = [
      `Duration: ${cadence.durationMs}ms`,
      `Decision window: ${cadence.decisionWindowMs}ms`,
      `Season x${cadence.seasonMultiplier.toFixed(2)}`,
      `Mode tempo x${cadence.modeTempoMultiplier.toFixed(2)}`,
    ];
    if (cadence.shouldInterpolate) bodyParts.push('Interpolating tier transition');
    if (cadence.shouldScreenShake) bodyParts.push('SCREEN SHAKE');

    const tags: string[] = [
      `tier:${cadence.resolvedTier}`,
      `channel:${channel.toLowerCase()}`,
      `urgency:${urgency.toLowerCase()}`,
    ];
    if (cadence.shouldInterpolate) tags.push('interpolating');
    if (cadence.shouldScreenShake) tags.push('screen_shake');

    const signalId = `${CHAT_SIGNAL_ID_PREFIX}:cadence:${cadence.resolvedTier}:signal_${this._signalCount}`;

    const signal = Object.freeze({
      signalId,
      channel,
      urgency,
      tier: cadence.resolvedTier,
      phase: mlVector.phase,
      tick: mlVector.tick,
      nowMs,
      headline,
      body: bodyParts.join(' | '),
      tags: Object.freeze(tags),
      mlFeatures: mlVector.features,
      dlTensorSnapshot: null,
      reasonCodes: Object.freeze([`cadence_resolved:${cadence.resolvedTier}`]),
      shouldInterruptChat: urgency === 'CRITICAL',
      shouldEscalate: urgency === 'CRITICAL' || cadence.resolvedTier === 'T4',
    });

    this._lastSignal = signal;
    this._signalCount += 1;
    return signal;
  }

  /** Returns the last emitted chat signal. */
  public getLastSignal(): TimeContractChatSignal | null {
    return this._lastSignal;
  }

  /** Returns the total number of signals emitted. */
  public getSignalCount(): number {
    return this._signalCount;
  }

  /** Resets the emitter state. */
  public reset(): void {
    this._lastSignal = null;
    this._signalCount = 0;
  }

  private _resolveChannel(
    record: TierTransitionRecord,
    urgency: TimeContractChatUrgency,
  ): TimeContractChatChannel {
    if (record.direction === InterpolationDirection.ESCALATING) return ESCALATION_CHANNEL;
    if (record.isAtPhaseBoundary) return MAIN_CHANNEL;
    if (urgency === 'CRITICAL' || urgency === 'URGENT') return ESCALATION_CHANNEL;
    return TICK_CHANNEL;
  }

  private _buildHeadline(
    record: TierTransitionRecord,
    urgency: TimeContractChatUrgency,
  ): string {
    const fromLabel = PRESSURE_TIER_URGENCY_LABEL[record.fromTier];
    const toLabel = PRESSURE_TIER_URGENCY_LABEL[record.toTier];
    if (urgency === 'CRITICAL') {
      return `CRITICAL: Cadence ${record.fromTier}→${record.toTier} — ${toLabel} threshold breached`;
    }
    if (urgency === 'URGENT') {
      return `URGENT: Tier escalation ${record.fromTier}→${record.toTier} (${toLabel})`;
    }
    if (record.direction === InterpolationDirection.DE_ESCALATING) {
      return `Pressure easing: ${record.fromTier} (${fromLabel}) → ${record.toTier} (${toLabel})`;
    }
    if (record.isAtPhaseBoundary) {
      return `Phase boundary — cadence shift ${record.fromTier}→${record.toTier} (${record.phase})`;
    }
    return `Cadence update: ${record.fromTier}→${record.toTier} over ${record.interpolationTicks} ticks`;
  }
}

// ============================================================================
// SECTION 18 — TickRateInterpolator (Main Class)
// ============================================================================

/**
 * Authoritative tick rate interpolation engine.
 *
 * Manages smooth, deterministic transitions between PressureTier cadence targets.
 * Integrates with mode/phase context for UX-calibrated transitions.
 * Produces ML (28-dim) and DL (40×6) feature representations for upstream AI.
 * Emits chat signals on significant tier changes via LIVEOPS_PRESSURE.
 *
 * All state is resettable for replay / hot-run isolation.
 */
export class TickRateInterpolator {
  // ---- Core interpolation state ----
  private _currentTier: PressureTier;
  private _currentDurationMs: number;
  private _state: MutableInterpolationState | null = null;

  // ---- Context fields ----
  private _mode: ModeCode;
  private _phase: RunPhase;
  private _elapsedMs: number;

  // ---- Sub-systems ----
  private readonly _auditTrail: TickRateInterpolatorAuditTrail;
  private readonly _analytics: TickRateInterpolatorAnalytics;
  private readonly _trendAnalyzer: TickRateInterpolatorTrendAnalyzer;
  private readonly _resilienceScorer: TickRateInterpolatorResilienceScorer;
  private readonly _narrator: TickRateInterpolatorNarrator;
  private readonly _mlExtractor: TickRateInterpolatorMLExtractor;
  private readonly _dlBuilder: TickRateInterpolatorDLBuilder;
  private readonly _chatEmitter: TickRateInterpolatorChatEmitter;
  private readonly _modeAdvisor: TickRateInterpolatorModeAdvisor;
  private readonly _phaseAdvisor: TickRateInterpolatorPhaseAdvisor;
  private readonly _sessionTracker: TickRateInterpolatorSessionTracker;

  // ---- Cached ML / DL outputs ----
  private _lastMLVector: TimeContractMLVector | null = null;

  public constructor(
    initialTier: PressureTier = 'T1',
    mode: ModeCode = 'solo',
    phase: RunPhase = 'FOUNDATION',
    elapsedMs = 0,
  ) {
    this._currentTier = initialTier;
    this._currentDurationMs = normalizeTickDurationMs(initialTier, TIER_DURATIONS_MS[initialTier]);
    this._mode = mode;
    this._phase = phase;
    this._elapsedMs = elapsedMs;

    this._auditTrail = new TickRateInterpolatorAuditTrail();
    this._analytics = new TickRateInterpolatorAnalytics();
    this._trendAnalyzer = new TickRateInterpolatorTrendAnalyzer();
    this._resilienceScorer = new TickRateInterpolatorResilienceScorer();
    this._narrator = new TickRateInterpolatorNarrator();
    this._mlExtractor = new TickRateInterpolatorMLExtractor();
    this._dlBuilder = new TickRateInterpolatorDLBuilder();
    this._chatEmitter = new TickRateInterpolatorChatEmitter();
    this._modeAdvisor = new TickRateInterpolatorModeAdvisor();
    this._phaseAdvisor = new TickRateInterpolatorPhaseAdvisor();
    this._sessionTracker = new TickRateInterpolatorSessionTracker();

    this._sessionTracker.reset(elapsedMs);
  }

  // ---- Core public API ----

  /**
   * Resets the interpolator to a clean initial state for the given tier.
   * All sub-systems are also reset — safe for replay / hot-run isolation.
   */
  public reset(
    initialTier: PressureTier = 'T1',
    mode: ModeCode = 'solo',
    phase: RunPhase = 'FOUNDATION',
    elapsedMs = 0,
  ): void {
    this._currentTier = initialTier;
    this._currentDurationMs = normalizeTickDurationMs(initialTier, TIER_DURATIONS_MS[initialTier]);
    this._state = null;
    this._mode = mode;
    this._phase = phase;
    this._elapsedMs = elapsedMs;
    this._lastMLVector = null;

    this._auditTrail.clear();
    this._analytics.reset();
    this._trendAnalyzer.clear();
    this._resilienceScorer.reset();
    this._chatEmitter.reset();
    this._dlBuilder.reset();
    this._sessionTracker.reset(elapsedMs);
  }

  /**
   * Hard-sets the current tier and duration immediately.
   * Used for tutorial/admin/forced moments that must not interpolate.
   * Emits an audit record with FORCED_OVERRIDE category.
   * Returns the hard-set duration in ms.
   */
  public forceTier(
    tier: PressureTier,
    options: { readonly reason?: string; readonly nowMs?: number } = {},
  ): number {
    const prevTier = this._currentTier;
    const prevDuration = this._currentDurationMs;
    const nowMs = options.nowMs ?? Date.now();

    this._currentTier = tier;
    this._currentDurationMs = normalizeTickDurationMs(tier, TIER_DURATIONS_MS[tier]);
    this._state = null;

    const record = this._buildTransitionRecord(
      prevTier,
      tier,
      prevDuration,
      this._currentDurationMs,
      0, // zero ticks — instant
      InterpolationDirection.FORCED,
      InterpolationEasingType.INSTANT,
      TierTransitionCategory.FORCED_OVERRIDE,
      false,
      options.reason ?? 'forced_override',
    );

    this._commitTransitionRecord(record, nowMs);
    return this._currentDurationMs;
  }

  /**
   * Updates the mode context. Affects easing and tick count for future transitions.
   */
  public setMode(mode: ModeCode): void {
    this._mode = mode;
  }

  /**
   * Updates the phase context. Affects tick count and significance for future transitions.
   */
  public setPhase(phase: RunPhase): void {
    this._phase = phase;
  }

  /**
   * Advances the elapsed time context and auto-detects phase boundary crossings.
   * Call before resolveDurationMs to keep phase context current.
   */
  public advanceElapsedMs(newElapsedMs: number): void {
    const prevElapsed = this._elapsedMs;
    this._elapsedMs = Math.max(this._elapsedMs, newElapsedMs);
    this._phase = resolvePhaseFromElapsedMs(this._elapsedMs);

    // If a phase boundary was just crossed and we're in transition, extend the transition
    if (this._state !== null && isPhaseBoundaryTransition(prevElapsed, this._elapsedMs)) {
      // Phase boundary: ensure at least PHASE_BOUNDARY_TICK_FLOOR ticks remain
      if (this._state.ticksRemaining < PHASE_BOUNDARY_TICK_FLOOR) {
        this._state.ticksRemaining = PHASE_BOUNDARY_TICK_FLOOR;
      }
    }
  }

  /**
   * Applies a run outcome override.
   * FREEDOM → T0 (sovereign cadence). BANKRUPT/TIMEOUT → T4 (collapse imminent).
   * Only applies if outcome is terminal (TIME_CONTRACT_OUTCOME_IS_TERMINAL).
   */
  public applyOutcomeOverride(outcome: RunOutcome, nowMs = Date.now()): void {
    if (!TIME_CONTRACT_OUTCOME_IS_TERMINAL[outcome]) return;

    let targetTier: PressureTier;
    switch (outcome) {
      case 'FREEDOM':
        targetTier = 'T0';
        break;
      case 'BANKRUPT':
      case 'TIMEOUT':
        targetTier = 'T4';
        break;
      case 'ABANDONED':
        targetTier = this._currentTier; // No override on abandon
        return;
    }

    const prevTier = this._currentTier;
    const prevDuration = this._currentDurationMs;
    this._currentTier = targetTier;
    this._currentDurationMs = normalizeTickDurationMs(targetTier, TIER_DURATIONS_MS[targetTier]);
    this._state = null;

    const record = this._buildTransitionRecord(
      prevTier,
      targetTier,
      prevDuration,
      this._currentDurationMs,
      0,
      InterpolationDirection.FORCED,
      InterpolationEasingType.INSTANT,
      TierTransitionCategory.OUTCOME_OVERRIDE,
      false,
      `outcome_override:${outcome}`,
    );

    this._commitTransitionRecord(record, nowMs);
  }

  /**
   * Resolves the authoritative duration for the current backend time step.
   * Seeds initial state on first call. Interpolates when tier changes.
   *
   * This is the hot-path method — called every tick by TimeEngine.
   * All state mutations happen here and are reflected in sub-system outputs.
   *
   * @param tier — the incoming pressure tier from PressureEngine
   * @param options — optional context for enhanced interpolation
   * @returns authoritative tick duration in ms for this step
   */
  public resolveDurationMs(
    tier: PressureTier,
    options: {
      readonly elapsedMs?: number;
      readonly nowMs?: number;
      readonly forceImmediate?: boolean;
    } = {},
  ): number {
    const nowMs = options.nowMs ?? Date.now();
    const elapsedMs = options.elapsedMs ?? this._elapsedMs;

    // Seed initial state on first call
    if (this._currentTier === null || (this._analytics.getSnapshot().totalTicks === 0 && this._state === null)) {
      this._currentTier = tier;
      this._currentDurationMs = normalizeTickDurationMs(tier, TIER_DURATIONS_MS[tier]);
      this._phase = resolvePhaseFromElapsedMs(elapsedMs);
    }

    // Update elapsed and phase from options if provided
    if (options.elapsedMs !== undefined) {
      this.advanceElapsedMs(options.elapsedMs);
    }

    // Force immediate: bypass interpolation
    if (options.forceImmediate === true && tier !== this._currentTier) {
      return this.forceTier(tier, { nowMs });
    }

    // Begin a new transition if tier changed
    if (tier !== this._currentTier) {
      if (this._state !== null) {
        // Mid-transition retarget: restart from current interpolated duration
        this._beginRetargetedTransition(tier, nowMs);
      } else {
        this._beginNaturalTransition(tier, nowMs);
      }
    }

    // If no active transition, return stable duration
    if (this._state === null) {
      this._currentTier = tier;
      this._currentDurationMs = clampTickDurationMs(tier, this._currentDurationMs);
      this._recordStableTick(nowMs);
      return this._currentDurationMs;
    }

    // Advance interpolation by one tick
    const resolved = this._advanceInterpolation();

    // Record tick in session tracker
    const phaseChanged = this._sessionTracker.advance(resolved, elapsedMs);
    if (phaseChanged) {
      this._phase = this._sessionTracker.getCurrentPhase();
    }

    // Record tick analytics
    this._analytics.recordTick(this._state !== null, resolved);

    // Update DL builder with latest state
    this._dlBuilder.appendRow(
      this._currentTier,
      resolved,
      this._state?.toDurationMs ?? resolved,
      this._state !== null,
      this._state !== null
        ? (this._state.totalTicks - this._state.ticksRemaining) / this._state.totalTicks
        : 0,
      this._mode,
      this._phase,
      this._sessionTracker.getTickNumber(),
      nowMs,
    );

    // Update ML vector cache
    this._lastMLVector = this._buildMLVector(nowMs);

    return resolved;
  }

  /**
   * Resolves the cadence duration using a TimeCadenceResolution from the TimeEngine.
   * Enriches the interpolation with season, budget, and policy context.
   * Optionally emits a chat signal for significant cadence changes.
   */
  public resolveDurationMsFromCadence(
    cadence: TimeCadenceResolution,
    options: {
      readonly nowMs?: number;
      readonly emitChatSignal?: boolean;
    } = {},
  ): number {
    const nowMs = options.nowMs ?? Date.now();

    // Update context from cadence resolution
    this._mode = this._inferModeFromCadence(cadence);
    const resolved = this.resolveDurationMs(cadence.resolvedTier, { nowMs });

    // Emit a cadence-based chat signal if requested
    if (options.emitChatSignal === true && this._lastMLVector !== null) {
      const lastRecord = this._auditTrail.getLast();
      const signal = this._chatEmitter.buildSignalFromCadence(
        cadence,
        this._lastMLVector,
        this._mlExtractor,
        lastRecord,
        nowMs,
      );
      this._analytics.recordChatSignalEmitted();
      void signal; // signal is stored in chatEmitter; consumer reads via getLastChatSignal()
    }

    return resolved;
  }

  // ---- Read-only state accessors ----

  /** Returns the current interpolated tick duration in ms. */
  public getCurrentDurationMs(): number {
    return this._currentDurationMs;
  }

  /** Returns the current pressure tier. */
  public getCurrentTier(): PressureTier {
    return this._currentTier;
  }

  /** Returns the target tier (toTier of active transition, or currentTier if stable). */
  public getTargetTier(): PressureTier {
    return this._state?.toTier ?? this._currentTier;
  }

  /** Returns the number of ticks remaining in the current transition (0 if stable). */
  public getRemainingTransitionTicks(): number {
    return this._state?.ticksRemaining ?? 0;
  }

  /** Returns true if a tier transition is currently in progress. */
  public isTransitioning(): boolean {
    return this._state !== null;
  }

  /** Returns the transition progress (0.0 = just started, 1.0 = complete). */
  public getTransitionProgress(): number {
    if (this._state === null) return 0;
    const elapsed = this._state.totalTicks - this._state.ticksRemaining;
    return clamp01(elapsed / this._state.totalTicks);
  }

  /** Returns the current mode code. */
  public getMode(): ModeCode {
    return this._mode;
  }

  /** Returns the current run phase. */
  public getPhase(): RunPhase {
    return this._phase;
  }

  /** Returns the current elapsed ms. */
  public getElapsedMs(): number {
    return this._elapsedMs;
  }

  /**
   * Returns the current interpolation plan as a TickInterpolationPlan.
   * Uses createInterpolationPlan and pressureTierToTickTier for type conversion.
   * Returns null if not transitioning.
   */
  public getCurrentPlan(): TickInterpolationPlan | null {
    if (this._state === null) return null;
    const fromTickTier: TickTier = pressureTierToTickTier(this._state.fromTier);
    const toTickTier: TickTier = pressureTierToTickTier(this._state.toTier);
    // createInterpolationPlan produces a read-only TickInterpolationPlan
    const plan = createInterpolationPlan(
      fromTickTier,
      toTickTier,
      this._state.fromDurationMs,
      this._state.toDurationMs,
    );
    // Override ticksRemaining to reflect current live state
    return Object.freeze({
      ...plan,
      ticksRemaining: this._state.ticksRemaining,
    });
  }

  /**
   * Returns the TickTierConfig for the current tier.
   * Uses getTickTierConfigByPressureTier for canonical config lookup.
   */
  public getCurrentTierConfig(): TickTierConfig {
    return getTickTierConfigByPressureTier(this._currentTier);
  }

  /**
   * Returns the TickTierConfig for the target tier (or current if stable).
   * Uses TICK_TIER_BY_PRESSURE_TIER then getTickTierConfig for lookup.
   */
  public getTargetTierConfig(): TickTierConfig {
    const targetPressureTier = this.getTargetTier();
    const targetTickTier: TickTier = TICK_TIER_BY_PRESSURE_TIER[targetPressureTier];
    return getTickTierConfig(targetTickTier);
  }

  /**
   * Returns the decision window duration for the current tier in ms.
   * Uses getDecisionWindowDurationMs for canonical lookup.
   */
  public getDecisionWindowMs(): number {
    return getDecisionWindowDurationMs(this._currentTier);
  }

  /**
   * Returns the target duration in ms (the to-tier's default duration).
   * Uses getDefaultTickDurationMs for canonical lookup.
   */
  public getTargetDurationMs(): number {
    if (this._state !== null) {
      return this._state.toDurationMs;
    }
    return getDefaultTickDurationMs(this._currentTier);
  }

  // ---- Snapshot ----

  /**
   * Returns a complete frozen snapshot of the interpolator's current state.
   * This is the canonical read surface for TimeEngine and downstream consumers.
   */
  public getSnapshot(nowMs = Date.now()): InterpolationSnapshot {
    const analytics = this._analytics.getSnapshot();
    this._resilienceScorer.update(analytics);
    const resilienceResult = this._resilienceScorer.compute(this._currentTier);
    const trendSnapshot = this._trendAnalyzer.getSnapshot();
    const currentTickTier: TickTier = TICK_TIER_BY_PRESSURE_TIER[this._currentTier];
    const targetTickTier: TickTier | null =
      this._state !== null ? TICK_TIER_BY_PRESSURE_TIER[this._state.toTier] : null;

    // Build ML vector for snapshot
    const mlVector = this._buildMLVector(nowMs);
    this._lastMLVector = mlVector;

    return Object.freeze({
      currentTier: this._currentTier,
      targetTier: this._state?.toTier ?? null,
      currentDurationMs: this._currentDurationMs,
      targetDurationMs: this.getTargetDurationMs(),
      decisionWindowMs: this.getDecisionWindowMs(),
      isTransitioning: this._state !== null,
      transitionProgress: this.getTransitionProgress(),
      ticksRemaining: this._state?.ticksRemaining ?? 0,
      totalTransitionTicks: this._state?.totalTicks ?? 0,
      currentTickTier,
      targetTickTier,
      tickTierConfig: this.getCurrentTierConfig(),
      interpolationPlan: this.getCurrentPlan(),
      mode: this._mode,
      phase: this._phase,
      elapsedMs: this._elapsedMs,
      tickNumber: this._sessionTracker.getTickNumber(),
      lastTransition: this._auditTrail.getLast(),
      sessionAnalytics: analytics,
      resilienceScore: resilienceResult.score,
      trendDirection: trendSnapshot.direction,
      lastChatSignalId: this._chatEmitter.getLastSignal()?.signalId ?? null,
      version: TICK_RATE_INTERPOLATOR_VERSION,
    });
  }

  // ---- ML / DL surfaces ----

  /**
   * Extracts the 28-dim TimeContractMLVector from current interpolator state.
   * Fully compatible with scoreContractChatUrgency() and downstream ML pipeline.
   */
  public extractMLVector(nowMs = Date.now()): TimeContractMLVector {
    const vector = this._buildMLVector(nowMs);
    this._lastMLVector = vector;
    return vector;
  }

  /** Returns the last computed ML vector (may be null before first resolveDurationMs). */
  public getLastMLVector(): TimeContractMLVector | null {
    return this._lastMLVector;
  }

  /** Returns the current 40×6 DL tensor from the rolling sequence buffer. */
  public getDLTensor(): TimeContractDLTensor {
    return this._dlBuilder.getTensor();
  }

  /**
   * Returns the composite pressure trend from the DL tensor.
   * -1 = decreasing, 0 = flat, +1 = increasing.
   */
  public getDLTrend(): number {
    return this._dlBuilder.getCompositeTrend();
  }

  // ---- Chat signals ----

  /**
   * Returns the last emitted chat signal, or null if none emitted yet.
   */
  public getLastChatSignal(): TimeContractChatSignal | null {
    return this._chatEmitter.getLastSignal();
  }

  /** Returns the number of chat signals emitted this session. */
  public getChatSignalCount(): number {
    return this._chatEmitter.getSignalCount();
  }

  // ---- Audit & analytics ----

  /**
   * Returns all audit trail records for this session (immutable).
   */
  public getAuditTrail(): readonly TierTransitionRecord[] {
    return this._auditTrail.getAll();
  }

  /** Returns the last N audit records in reverse chronological order. */
  public getRecentTransitions(n: number): readonly TierTransitionRecord[] {
    return this._auditTrail.getLastN(n);
  }

  /** Returns the session analytics snapshot. */
  public getAnalytics(): InterpolatorSessionAnalytics {
    return this._analytics.getSnapshot();
  }

  /** Returns the trend analyzer snapshot. */
  public getTrend(): InterpolatorTrendSnapshot {
    return this._trendAnalyzer.getSnapshot();
  }

  /**
   * Returns the resilience score for the current session.
   */
  public getResilienceScore(): InterpolatorResilienceScore {
    const analytics = this._analytics.getSnapshot();
    this._resilienceScorer.update(analytics);
    return this._resilienceScorer.compute(this._currentTier);
  }

  // ---- Narration ----

  /**
   * Returns a human-readable description of the current interpolation state.
   */
  public describeCurrent(): string {
    return this._narrator.narrateCurrentState(
      this._currentTier,
      this._currentDurationMs,
      this._mode,
      this._phase,
      this._state !== null,
    );
  }

  /**
   * Returns a human-readable description of the last recorded transition.
   */
  public describeLastTransition(): string {
    const last = this._auditTrail.getLast();
    if (last === null) return 'No transitions recorded yet';
    return this._narrator.narrateTransition(last);
  }

  /**
   * Returns a narrative for the current trend.
   */
  public describeTrend(): string {
    return this._narrator.narrateTrend(this._trendAnalyzer.getSnapshot());
  }

  /**
   * Returns the mode profile for the current mode.
   */
  public getModeProfile(): InterpolationModeProfile {
    return this._modeAdvisor.getProfile(this._mode);
  }

  /**
   * Returns the phase profile for the current phase.
   */
  public getPhaseProfile(): InterpolationPhaseProfile {
    return this._phaseAdvisor.getProfile(this._phase);
  }

  /**
   * Returns the resilience score narrative.
   */
  public describeResilience(): string {
    return this._narrator.narrateResilienceScore(this.getResilienceScore());
  }

  /**
   * Returns the session analytics narrative.
   */
  public describeSession(): string {
    return this._narrator.narrateSessionAnalytics(this._analytics.getSnapshot());
  }

  // ---- Private implementation ----

  /** Begins a natural (non-retargeted) tier transition. */
  private _beginNaturalTransition(targetTier: PressureTier, nowMs: number): void {
    const targetDurationMs = normalizeTickDurationMs(targetTier, TIER_DURATIONS_MS[targetTier]);

    if (targetDurationMs === this._currentDurationMs) {
      // No actual duration change — just update tier silently
      this._currentTier = targetTier;
      return;
    }

    const direction = resolveDirection(this._currentTier, targetTier, false);
    const easing = this._modeAdvisor.resolveEasing(this._mode, direction);
    const isAtPhaseBoundary = this._phaseAdvisor.detectPhaseBoundary(
      this._elapsedMs,
      this._elapsedMs + this._currentDurationMs,
    );

    const deltaMs = Math.abs(targetDurationMs - this._currentDurationMs);
    let totalTicks = computeTransitionTickCount(deltaMs, isAtPhaseBoundary, this._mode);
    totalTicks = this._phaseAdvisor.adjustTickCount(totalTicks, this._phase);
    totalTicks = this._modeAdvisor.adjustTickCount(totalTicks, this._mode);
    totalTicks = Math.max(1, clampNonNegativeInteger(totalTicks));

    const category = isAtPhaseBoundary
      ? TierTransitionCategory.PHASE_CROSSING
      : TierTransitionCategory.NATURAL;

    this._state = {
      fromTier: this._currentTier,
      toTier: targetTier,
      fromDurationMs: this._currentDurationMs,
      toDurationMs: targetDurationMs,
      totalTicks,
      ticksRemaining: totalTicks,
      easing,
      isAtPhaseBoundary,
      startedAtTickNumber: this._sessionTracker.getTickNumber(),
      startedAtElapsedMs: this._elapsedMs,
    };

    // Build and commit audit record
    const record = this._buildTransitionRecord(
      this._currentTier,
      targetTier,
      this._currentDurationMs,
      targetDurationMs,
      totalTicks,
      direction,
      easing,
      category,
      isAtPhaseBoundary,
      '',
    );
    this._commitTransitionRecord(record, nowMs);
  }

  /** Begins a retargeted transition — mid-transition, pressure changed again. */
  private _beginRetargetedTransition(newTargetTier: PressureTier, nowMs: number): void {
    const targetDurationMs = normalizeTickDurationMs(newTargetTier, TIER_DURATIONS_MS[newTargetTier]);
    const direction = resolveDirection(this._currentTier, newTargetTier, false);
    const easing = this._modeAdvisor.resolveEasing(this._mode, direction);

    const deltaMs = Math.abs(targetDurationMs - this._currentDurationMs);
    let totalTicks = computeTransitionTickCount(deltaMs, false, this._mode);
    totalTicks = Math.max(1, totalTicks);

    this._state = {
      fromTier: this._currentTier,
      toTier: newTargetTier,
      fromDurationMs: this._currentDurationMs,
      toDurationMs: targetDurationMs,
      totalTicks,
      ticksRemaining: totalTicks,
      easing,
      isAtPhaseBoundary: false,
      startedAtTickNumber: this._sessionTracker.getTickNumber(),
      startedAtElapsedMs: this._elapsedMs,
    };

    const record = this._buildTransitionRecord(
      this._currentTier,
      newTargetTier,
      this._currentDurationMs,
      targetDurationMs,
      totalTicks,
      direction,
      easing,
      TierTransitionCategory.RETARGETED,
      false,
      'retargeted_mid_transition',
    );
    this._commitTransitionRecord(record, nowMs);
  }

  /**
   * Advances the active interpolation by one tick and returns the resolved duration.
   * Applies easing function for perceptually smooth cadence changes.
   */
  private _advanceInterpolation(): number {
    if (this._state === null) {
      return this._currentDurationMs;
    }

    const { fromDurationMs, toDurationMs, totalTicks, ticksRemaining, easing } = this._state;

    const rawProgress = (totalTicks - ticksRemaining + 1) / totalTicks;
    const easedProgress = applyEasing(rawProgress, easing);
    const interpolated = lerpMs(fromDurationMs, toDurationMs, easedProgress);

    this._currentDurationMs = Math.round(interpolated);
    this._state.ticksRemaining -= 1;

    if (this._state.ticksRemaining <= 0) {
      // Transition complete — snap to exact target and clear state
      this._currentDurationMs = toDurationMs;
      this._currentTier = this._state.toTier;
      this._state = null;
    }

    return this._currentDurationMs;
  }

  /** Records a stable (non-transitioning) tick. */
  private _recordStableTick(nowMs: number): void {
    const durationMs = this._currentDurationMs;
    const elapsedMs = this._elapsedMs;
    const phaseChanged = this._sessionTracker.advance(durationMs, elapsedMs);
    if (phaseChanged) {
      this._phase = this._sessionTracker.getCurrentPhase();
    }
    this._analytics.recordTick(false, durationMs);
    this._dlBuilder.appendRow(
      this._currentTier,
      durationMs,
      durationMs,
      false,
      0,
      this._mode,
      this._phase,
      this._sessionTracker.getTickNumber(),
      nowMs,
    );
    this._lastMLVector = this._buildMLVector(nowMs);
  }

  /** Builds a TierTransitionRecord from the given transition parameters. */
  private _buildTransitionRecord(
    fromTier: PressureTier,
    toTier: PressureTier,
    fromDurationMs: number,
    toDurationMs: number,
    interpolationTicks: number,
    direction: InterpolationDirection,
    easing: InterpolationEasingType,
    category: TierTransitionCategory,
    isAtPhaseBoundary: boolean,
    notes: string,
  ): TierTransitionRecord {
    const fromTickTier: TickTier = TICK_TIER_BY_PRESSURE_TIER[fromTier];
    const toTickTier: TickTier = TICK_TIER_BY_PRESSURE_TIER[toTier];
    const urgencyDelta = computeUrgencyDelta(fromTier, toTier);
    const tickNumber = this._sessionTracker.getTickNumber();
    const elapsedMs = this._elapsedMs;
    const modeTempoMultiplier = TIME_CONTRACT_MODE_TEMPO[this._mode];
    const phaseStakesMultiplier = RUN_PHASE_STAKES_MULTIPLIER[this._phase];
    const tags = resolveTransitionTags(
      fromTier,
      toTier,
      direction,
      category,
      this._mode,
      this._phase,
      isAtPhaseBoundary,
    );
    const recordId = buildRecordId(fromTier, toTier, tickNumber, category);

    return Object.freeze({
      recordId,
      fromTier,
      toTier,
      fromTickTier,
      toTickTier,
      fromDurationMs,
      toDurationMs,
      interpolationTicks,
      direction,
      easing,
      category,
      mode: this._mode,
      phase: this._phase,
      elapsedMs,
      tickNumber,
      isAtPhaseBoundary,
      durationDeltaMs: toDurationMs - fromDurationMs,
      urgencyDelta,
      modeTempoMultiplier,
      phaseStakesMultiplier,
      tags,
      createdAtMs: Date.now(),
      notes,
    });
  }

  /** Commits a transition record to all sub-systems and optionally emits a chat signal. */
  private _commitTransitionRecord(record: TierTransitionRecord, nowMs: number): void {
    this._auditTrail.append(record);
    this._analytics.recordTransition(record);
    this._trendAnalyzer.push(record);

    // Update analytics in resilience scorer
    this._resilienceScorer.update(this._analytics.getSnapshot());

    // Build ML vector for signal emission
    const mlVector = this._buildMLVector(nowMs);
    this._lastMLVector = mlVector;

    // Compute significance and decide whether to emit chat signal
    const significance = this._phaseAdvisor.computeTransitionSignificance(
      record.urgencyDelta,
      record.phase,
      record.direction,
    );

    if (this._chatEmitter.shouldEmitSignal(record, significance)) {
      this._chatEmitter.buildSignalFromTransition(
        record,
        mlVector,
        this._mlExtractor,
        this._phaseAdvisor,
        this._narrator,
        nowMs,
      );
      this._analytics.recordChatSignalEmitted();
    }
  }

  /** Builds the current 28-dim ML vector from internal state. */
  private _buildMLVector(nowMs: number): TimeContractMLVector {
    const analytics = this._analytics.getSnapshot();
    const transitionProgress = this.getTransitionProgress();
    const driftScore = this._sessionTracker.getDriftScore();
    return this._mlExtractor.extract(
      this._currentTier,
      this._currentDurationMs,
      this.getTargetDurationMs(),
      this._state !== null,
      transitionProgress,
      this._state !== null
        ? resolveDirection(this._state.fromTier, this._state.toTier, false)
        : InterpolationDirection.LATERAL,
      this._mode,
      this._phase,
      this._sessionTracker.getTickNumber(),
      this._sessionTracker.getElapsedMs(),
      analytics,
      driftScore,
      nowMs,
    );
  }

  /**
   * Infers the mode code from a cadence resolution.
   * Falls back to current mode if none can be determined.
   */
  private _inferModeFromCadence(cadence: TimeCadenceResolution): ModeCode {
    // Mode tempo multiplier is unique per mode — reverse-lookup from table
    const tempo = cadence.modeTempoMultiplier;
    const modes: ModeCode[] = ['solo', 'pvp', 'coop', 'ghost'];
    for (const m of modes) {
      if (Math.abs(TIME_CONTRACT_MODE_TEMPO[m] - tempo) < 0.01) {
        return m;
      }
    }
    return this._mode;
  }
}

// ============================================================================
// SECTION 19 — STANDALONE EXPORTED FUNCTIONS
// ============================================================================

/**
 * Factory function: creates a fresh TickRateInterpolator with given context.
 */
export function createTickRateInterpolator(
  initialTier: PressureTier = 'T1',
  mode: ModeCode = 'solo',
  phase: RunPhase = 'FOUNDATION',
  elapsedMs = 0,
): TickRateInterpolator {
  return new TickRateInterpolator(initialTier, mode, phase, elapsedMs);
}

/**
 * Returns a frozen snapshot of an interpolator's current state.
 * Convenience wrapper for getSnapshot() at a specific nowMs.
 */
export function snapshotTickRateInterpolator(
  interpolator: TickRateInterpolator,
  nowMs = Date.now(),
): InterpolationSnapshot {
  return interpolator.getSnapshot(nowMs);
}

/**
 * Extracts the 28-dim ML vector from an interpolator instance.
 * Delegates to extractMLVector(). Compatible with scoreContractChatUrgency().
 */
export function extractInterpolatorMLVector(
  interpolator: TickRateInterpolator,
  nowMs = Date.now(),
): TimeContractMLVector {
  return interpolator.extractMLVector(nowMs);
}

/**
 * Returns the 40×6 DL tensor from an interpolator instance.
 */
export function buildInterpolatorDLTensor(
  interpolator: TickRateInterpolator,
): TimeContractDLTensor {
  return interpolator.getDLTensor();
}

/**
 * Returns the resilience score for an interpolator instance.
 */
export function scoreInterpolatorResilience(
  interpolator: TickRateInterpolator,
): InterpolatorResilienceScore {
  return interpolator.getResilienceScore();
}

/**
 * Returns the trend snapshot for an interpolator instance.
 */
export function getInterpolatorTrend(
  interpolator: TickRateInterpolator,
): InterpolatorTrendSnapshot {
  return interpolator.getTrend();
}

/**
 * Returns the mode profile for a given mode code.
 * Standalone accessor using TickRateInterpolatorModeAdvisor.
 */
export function getInterpolationModeProfile(mode: ModeCode): InterpolationModeProfile {
  return new TickRateInterpolatorModeAdvisor().getProfile(mode);
}

/**
 * Returns the phase profile for a given phase.
 * Standalone accessor using TickRateInterpolatorPhaseAdvisor.
 */
export function getInterpolationPhaseProfile(phase: RunPhase): InterpolationPhaseProfile {
  return new TickRateInterpolatorPhaseAdvisor().getProfile(phase);
}

/**
 * Computes the urgency delta between two pressure tiers.
 * Exported for use by TimeEngine and tests.
 */
export function computeTierUrgencyDelta(
  fromTier: PressureTier,
  toTier: PressureTier,
): number {
  return computeUrgencyDelta(fromTier, toTier);
}

/**
 * Returns the tick tier label and pressure tier for a given PressureTier.
 * Uses TICK_TIER_BY_PRESSURE_TIER and PRESSURE_TIER_BY_TICK_TIER for the round-trip.
 * Exported for diagnostic tooling and tests.
 */
export function describeTierMapping(tier: PressureTier): string {
  const tickTier: TickTier = TICK_TIER_BY_PRESSURE_TIER[tier];
  const roundTrip: PressureTier = PRESSURE_TIER_BY_TICK_TIER[tickTier];
  const config = TICK_TIER_CONFIGS[tickTier];
  const pressureTierFromTickTier: PressureTier = tickTierToPressureTier(tickTier);
  const tickTierFromPressure: TickTier = pressureTierToTickTier(tier);
  return [
    `PressureTier: ${tier}`,
    `TickTier: ${tickTier}`,
    `Round-trip: ${roundTrip}`,
    `pressureTierFromTickTier: ${pressureTierFromTickTier}`,
    `tickTierFromPressure: ${tickTierFromPressure}`,
    `Visual class: ${config.visualBorderClass}`,
    `Audio: ${config.audioSignal ?? 'none'}`,
    `Screen shake: ${config.screenShake}`,
  ].join(' | ');
}

/**
 * Returns the hold narration for a given hold result code.
 * Uses TickRateInterpolatorNarrator.narrateHoldAnnotation() which
 * internally references TIME_CONTRACT_HOLD_RESULT_LABELS.
 */
export function narrateHoldResultCode(
  code: keyof typeof TIME_CONTRACT_HOLD_RESULT_LABELS,
): string {
  return new TickRateInterpolatorNarrator().narrateHoldAnnotation(code);
}

/**
 * Returns a description of all phase boundaries from PHASE_BOUNDARIES_MS.
 * Exported for admin tooling and phase-transition documentation.
 */
export function describeAllPhaseBoundaries(): string {
  return new TickRateInterpolatorPhaseAdvisor().describeBoundaries();
}

/**
 * Returns all mode interpolation profiles.
 * Exported for TimeEngine and test harnesses that need the full mode surface.
 */
export function getAllInterpolationModeProfiles(): Readonly<
  Record<ModeCode, InterpolationModeProfile>
> {
  return new TickRateInterpolatorModeAdvisor().getAllProfiles();
}

/**
 * Returns the minimum hold tick annotation for all tier/mode combinations.
 * Exported for admin tooling that visualizes cadence constraints.
 * Uses PRESSURE_TIER_MIN_HOLD_TICKS and MODE_DIFFICULTY_MULTIPLIER.
 */
export function describeAllMinHoldTicks(): Readonly<Record<PressureTier, string>> {
  const advisor = new TickRateInterpolatorModeAdvisor();
  const tiers: PressureTier[] = ['T0', 'T1', 'T2', 'T3', 'T4'];
  const result: Record<PressureTier, string> = {
    T0: advisor.describeMinHoldTicks('solo', 'T0'),
    T1: advisor.describeMinHoldTicks('solo', 'T1'),
    T2: advisor.describeMinHoldTicks('solo', 'T2'),
    T3: advisor.describeMinHoldTicks('solo', 'T3'),
    T4: advisor.describeMinHoldTicks('solo', 'T4'),
  };
  // Suppress TS unused tiers warning by explicitly accessing
  void tiers;
  return Object.freeze(result);
}

/**
 * Verifies the full interpolator module against the contract version manifest.
 * Returns true if module is compatible with TIME_CONTRACTS_VERSION.
 * Uses TIME_CONTRACTS_VERSION for canonical version check.
 */
export function verifyInterpolatorContractVersion(): boolean {
  const contractVersion = TIME_CONTRACTS_VERSION.version;
  const moduleContractVersion = TICK_RATE_INTERPOLATOR_VERSION.contractsVersion;
  return contractVersion === moduleContractVersion;
}

/**
 * Returns a composite urgency score (0.0–1.0) for a given pressure tier,
 * mode, and phase using ML features derived from interpolator primitives.
 * Useful for quick urgency checks without instantiating a full interpolator.
 *
 * Uses: TIME_CONTRACT_TIER_URGENCY, MODE_NORMALIZED, RUN_PHASE_NORMALIZED,
 *       MODE_DIFFICULTY_MULTIPLIER, RUN_PHASE_STAKES_MULTIPLIER
 */
export function computeInterpolationUrgencyScore(
  tier: PressureTier,
  mode: ModeCode,
  phase: RunPhase,
): number {
  const tierUrgency = TIME_CONTRACT_TIER_URGENCY[tier];
  const modeNorm = MODE_NORMALIZED[mode];
  const phaseNorm = RUN_PHASE_NORMALIZED[phase];
  const difficulty = MODE_DIFFICULTY_MULTIPLIER[mode];
  const stakes = RUN_PHASE_STAKES_MULTIPLIER[phase];
  // Weighted composite: tier dominates, mode and phase contribute
  return clamp01(
    tierUrgency * 0.5 +
    modeNorm * difficulty * 0.25 +
    phaseNorm * stakes * 0.25,
  );
}

/**
 * Returns the interpolation direction for a tier transition.
 * Exported for TimeEngine and test harnesses.
 */
export function computeInterpolationDirection(
  fromTier: PressureTier,
  toTier: PressureTier,
): InterpolationDirection {
  return resolveDirection(fromTier, toTier, false);
}

/**
 * Returns the easing type to use for a given direction and mode.
 * Exported for TimeEngine test tooling.
 */
export function resolveInterpolationEasing(
  direction: InterpolationDirection,
  mode: ModeCode,
): InterpolationEasingType {
  return resolveEasingType(direction, mode);
}

/**
 * Returns whether a pressure tier duration is below the compressed threshold
 * (COMPRESSED_DURATION_THRESHOLD_MS = DEFAULT_HOLD_DURATION_MS = 5000ms).
 * T3 (4000ms) and T4 (1500ms) fall below this threshold.
 */
export function isDurationCompressed(tier: PressureTier): boolean {
  return TIER_DURATIONS_MS[tier] < COMPRESSED_DURATION_THRESHOLD_MS;
}

/**
 * Returns a full diagnostic string for the interpolator module.
 * Includes version, constants, mode profiles, phase profiles.
 * Used for admin dashboard and health-check endpoints.
 */
export function describeInterpolatorModule(): string {
  const advisor = new TickRateInterpolatorModeAdvisor();
  const phaseAdvisor = new TickRateInterpolatorPhaseAdvisor();
  const lines: string[] = [
    `=== TickRateInterpolator v${TICK_RATE_INTERPOLATOR_VERSION.version} ===`,
    `Contracts: ${TICK_RATE_INTERPOLATOR_VERSION.contractsVersion}`,
    `ML dim: ${TICK_RATE_INTERPOLATOR_VERSION.mlDim} | DL rows: ${TICK_RATE_INTERPOLATOR_VERSION.dlRows} | DL cols: ${TICK_RATE_INTERPOLATOR_VERSION.dlCols}`,
    `Phase boundaries: ${phaseAdvisor.describeBoundaries()}`,
    `--- Mode Profiles ---`,
  ];
  for (const mode of (['solo', 'pvp', 'coop', 'ghost'] as ModeCode[])) {
    lines.push(advisor.narrateModeForDiag(mode));
  }
  lines.push(`--- Phase Profiles ---`);
  for (const phase of (['FOUNDATION', 'ESCALATION', 'SOVEREIGNTY'] as RunPhase[])) {
    const profile = phaseAdvisor.getProfile(phase);
    lines.push(
      `${phase}: stakes x${profile.stakesMultiplier.toFixed(2)}, budget ${(profile.budgetFraction * 100).toFixed(0)}%, speed x${profile.speedMultiplier.toFixed(2)}`,
    );
  }
  lines.push(`--- Tier Durations (ms) ---`);
  for (const tier of (['T0', 'T1', 'T2', 'T3', 'T4'] as PressureTier[])) {
    const dur = TIER_DURATIONS_MS[tier];
    const decWin = DECISION_WINDOW_DURATIONS_MS[tier];
    const label = PRESSURE_TIER_URGENCY_LABEL[tier];
    const compressed = isDurationCompressed(tier) ? ' [COMPRESSED]' : '';
    lines.push(
      `  ${tier} (${label}): tick=${dur}ms, decision=${decWin}ms${compressed}`,
    );
  }
  return lines.join('\n');
}

// Extend TickRateInterpolatorModeAdvisor with the diagnostic helper used above
declare module './TickRateInterpolator' {
  interface TickRateInterpolatorModeAdvisor {
    narrateModeForDiag(mode: ModeCode): string;
  }
}

TickRateInterpolatorModeAdvisor.prototype.narrateModeForDiag = function (
  this: TickRateInterpolatorModeAdvisor,
  mode: ModeCode,
): string {
  const profile = this.getProfile(mode);
  return `  ${mode}: tempo x${profile.tempoMultiplier.toFixed(2)}, difficulty x${profile.difficultyMultiplier.toFixed(2)}, tension floor ${(profile.tensionFloor * 100).toFixed(0)}%, easing ${profile.easingType}`;
};
