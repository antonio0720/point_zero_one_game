/*
 * POINT ZERO ONE — BACKEND ENGINE TIME
 * /backend/src/game/engine/time/TimeSnapshotProjector.ts
 * VERSION: 4.0.0
 *
 * Doctrine:
 * - snapshot projection is the final immutable assembly layer for time mutations
 * - this file does not decide cadence policy; it applies already-resolved time results
 * - tags, warnings, and telemetry updates must be deduplicated and serialization-safe
 * - outcome mutation from timeout is delegated to RunTimeoutGuard, not re-derived here
 * - projection must preserve prior snapshot history unless an explicit override is supplied
 * - ML feature extraction (28-dim) and DL tensor (40×6) are first-class projection outputs
 * - chat signal emission via LIVEOPS_SIGNAL bridges every projection into the social layer
 * - mode-aware and phase-aware scoring amplify projection quality in real time
 * - resilience scoring tracks delta health between consecutive snapshots
 * - urgency scoring drives UX escalation across tier × phase × budget axes
 * - all scoring is pure: zero mutation, zero side effects, zero hidden state
 * - the audit trail is immutable: every projection, failure, and outcome is recorded
 *
 * Extended Capabilities:
 * - ProjectorAuditTrail: immutable per-run audit of all projection operations
 * - ProjectorTrendAnalyzer: trend detection across projection history
 * - ProjectorMLExtractor: 28-dimensional ML feature vector extraction
 * - ProjectorDLBuilder: 40×6 DL tensor ring buffer from projection history
 * - ProjectorChatBridge: builds ChatInputEnvelope for LIVEOPS_SIGNAL lane
 * - ProjectorNarrator: UX narrative generation for player-facing projection signals
 * - ProjectorModeAdvisor: mode-specific projection behavior and multipliers
 * - ProjectorPhaseAdvisor: phase-aware projection scoring and interpolation
 * - ProjectorResilienceScorer: resilience scoring from snapshot-delta health signals
 * - ProjectorUrgencyScorer: composite urgency from tier × phase × budget × outcome
 * - TimeSnapshotProjector: master class wiring all subsystems
 *
 * Surface summary:
 *   § 1  — Imports (100% used, all in runtime code)
 *   § 2  — Module constants (version, dims, thresholds, manifests)
 *   § 3  — ML feature label registry (28 labels)
 *   § 4  — DL column label registry (6 columns)
 *   § 5  — Type definitions
 *   § 6  — Private utility functions
 *   § 7  — ProjectorAuditTrail
 *   § 8  — ProjectorTrendAnalyzer
 *   § 9  — ProjectorMLExtractor
 *   § 10 — ProjectorDLBuilder
 *   § 11 — ProjectorChatBridge
 *   § 12 — ProjectorNarrator
 *   § 13 — ProjectorModeAdvisor
 *   § 14 — ProjectorPhaseAdvisor
 *   § 15 — ProjectorResilienceScorer
 *   § 16 — ProjectorUrgencyScorer
 *   § 17 — TimeSnapshotProjector (master class)
 *   § 18 — Factory functions
 *   § 19 — Pure helper exports
 *   § 20 — Module manifest
 */

/* ============================================================================
 * § 1 — IMPORTS
 * ============================================================================ */

import type {
  ModeCode,
  RunOutcome,
  RunPhase,
  PressureTier,
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
  MODE_NORMALIZED,
  MODE_DIFFICULTY_MULTIPLIER,
  MODE_TENSION_FLOOR,
  SHIELD_LAYER_CAPACITY_WEIGHT,
  isModeCode,
  isPressureTier,
  isRunPhase,
  isRunOutcome,
  computePressureRiskScore,
  canEscalatePressure,
  canDeescalatePressure,
  describePressureTierExperience,
  computeRunProgressFraction,
  computeEffectiveStakes,
  isEndgamePhase,
  isWinOutcome,
  isLossOutcome,
  scoreOutcomeExcitement,
  computeShieldIntegrityRatio,
  estimateShieldRegenPerTick,
} from '../core/GamePrimitives';

import type {
  OutcomeReasonCode,
  RunStateSnapshot,
  TelemetryState,
  TimerState,
  EconomyState,
  PressureState,
  ShieldState,
  BattleState,
} from '../core/RunStateSnapshot';

import { RunTimeoutGuard, type RunTimeoutResolution } from './RunTimeoutGuard';

import {
  TickTier,
  TICK_TIER_CONFIGS,
  TIER_DURATIONS_MS,
  DECISION_WINDOW_DURATIONS_MS,
  DEFAULT_HOLD_DURATION_MS,
  DEFAULT_PHASE_TRANSITION_WINDOWS,
  PHASE_BOUNDARIES_MS,
  TICK_TIER_BY_PRESSURE_TIER,
  PRESSURE_TIER_BY_TICK_TIER,
  pressureTierToTickTier,
  tickTierToPressureTier,
  getTickTierConfig,
  getDecisionWindowDurationMs,
  getDefaultTickDurationMs,
  clampTickDurationMs,
  normalizeTickDurationMs,
  resolvePhaseFromElapsedMs,
  isPhaseBoundaryTransition,
  createInterpolationPlan,
  computeInterpolationTickCount,
  type TickTierConfig,
  type TickInterpolationPlan,
  type PhaseBoundary,
} from './types';

import type {
  Score01,
  UnixMs,
  ChatSignalEnvelope,
  ChatInputEnvelope,
  ChatRunSnapshot,
  ChatLiveOpsSnapshot,
  Nullable,
  JsonValue,
  ChatSignalType,
  ChatRoomId,
} from '../chat/types';

/* ============================================================================
 * § 2 — MODULE CONSTANTS
 * ============================================================================ */

export const PROJECTOR_VERSION = '4.0.0' as const;
export const PROJECTOR_ML_DIM = 28 as const;
export const PROJECTOR_DL_ROWS = 40 as const;
export const PROJECTOR_DL_COLS = 6 as const;
export const PROJECTOR_AUDIT_CAPACITY = 1_000 as const;
export const PROJECTOR_TREND_HISTORY_SIZE = 50 as const;

/** Budget fraction thresholds driving UX escalation ladder. */
export const PROJECTOR_BUDGET_THRESHOLDS = Object.freeze({
  SAFE_BELOW: 0.5,
  CAUTION_BELOW: 0.7,
  WARNING_BELOW: 0.85,
  CRITICAL_BELOW: 0.95,
  EXHAUSTED_AT: 1.0,
});

/** Urgency weights per axis (must sum to 1.0). */
export const PROJECTOR_URGENCY_WEIGHTS = Object.freeze({
  TIER_WEIGHT: 0.35,
  PHASE_WEIGHT: 0.25,
  BUDGET_WEIGHT: 0.25,
  OUTCOME_WEIGHT: 0.15,
});

/** Resilience dimension weights (must sum to 1.0). */
export const PROJECTOR_RESILIENCE_WEIGHTS = Object.freeze({
  PRESSURE_WEIGHT: 0.30,
  SHIELD_WEIGHT: 0.30,
  ECONOMY_WEIGHT: 0.25,
  BATTLE_WEIGHT: 0.15,
});

/** Default hold charge cap per mode. */
export const PROJECTOR_HOLD_CAP_BY_MODE: Readonly<Record<ModeCode, number>> = Object.freeze({
  solo:  1,
  pvp:   0,
  coop:  2,
  ghost: 1,
});

/** Chat signal type used for time projection events. */
export const PROJECTOR_CHAT_SIGNAL_TYPE: ChatSignalType = 'LIVEOPS';

/* ============================================================================
 * § 3 — ML FEATURE LABEL REGISTRY (28-dim)
 * ============================================================================ */

export const PROJECTOR_ML_FEATURE_LABELS: readonly string[] = Object.freeze([
  /* [0]  */ 'mode_normalized',
  /* [1]  */ 'pressure_tier_normalized',
  /* [2]  */ 'run_phase_normalized',
  /* [3]  */ 'tick_duration_normalized',
  /* [4]  */ 'decision_window_normalized',
  /* [5]  */ 'elapsed_budget_fraction',
  /* [6]  */ 'remaining_budget_fraction',
  /* [7]  */ 'outcome_is_terminal',
  /* [8]  */ 'outcome_is_win',
  /* [9]  */ 'escalation_risk_score',
  /* [10] */ 'effective_stakes',
  /* [11] */ 'mode_tension_floor',
  /* [12] */ 'hold_charges_normalized',
  /* [13] */ 'active_decision_windows_count',
  /* [14] */ 'frozen_decision_windows_count',
  /* [15] */ 'tag_count_normalized',
  /* [16] */ 'warning_count_normalized',
  /* [17] */ 'phase_boundary_crossed',
  /* [18] */ 'endgame_flag',
  /* [19] */ 'pressure_risk_score',
  /* [20] */ 'shield_integrity_ratio',
  /* [21] */ 'avg_shield_regen_rate',
  /* [22] */ 'outcome_excitement_score',
  /* [23] */ 'tier_duration_ms_normalized',
  /* [24] */ 'interpolation_tick_count_normalized',
  /* [25] */ 'mode_difficulty_multiplier_normalized',
  /* [26] */ 'phase_stakes_multiplier',
  /* [27] */ 'timeout_proximity_score',
]);

/* ============================================================================
 * § 4 — DL COLUMN LABEL REGISTRY (6-col)
 * ============================================================================ */

export const PROJECTOR_DL_COLUMN_LABELS: readonly string[] = Object.freeze([
  /* [0] */ 'pressure_normalized',
  /* [1] */ 'tick_duration_normalized',
  /* [2] */ 'elapsed_fraction',
  /* [3] */ 'phase_score',
  /* [4] */ 'outcome_code',
  /* [5] */ 'effective_stakes',
]);

/* ============================================================================
 * § 5 — TYPE DEFINITIONS
 * ============================================================================ */

/** The core projection request shape — unchanged from v1. */
export interface TimeSnapshotProjectionRequest {
  readonly tick: number;
  readonly phase: RunPhase;
  readonly timers: TimerState;
  readonly tags?: readonly string[];
  readonly warnings?: readonly string[];
  readonly outcome?: RunOutcome | null;
  readonly outcomeReason?: string | null;
  readonly outcomeReasonCode?: OutcomeReasonCode | null;
  readonly decisionWindowExpired?: boolean;
}

/** Single audit entry recorded for every projection call. */
export interface ProjectorAuditEntry {
  readonly sequence: number;
  readonly createdAtMs: number;
  readonly tick: number;
  readonly phase: RunPhase;
  readonly pressureTier: PressureTier;
  readonly mode: ModeCode;
  readonly outcome: RunOutcome | null;
  readonly elapsedMs: number;
  readonly tagCount: number;
  readonly warningCount: number;
  readonly hadTimeout: boolean;
  readonly decisionWindowExpired: boolean;
  readonly budgetFraction: number;
}

/** Aggregated summary of all audit entries. */
export interface ProjectorAuditSummary {
  readonly totalProjections: number;
  readonly winCount: number;
  readonly lossCount: number;
  readonly timeoutCount: number;
  readonly bankruptCount: number;
  readonly abandonCount: number;
  readonly phaseDistribution: Readonly<Record<RunPhase, number>>;
  readonly tierDistribution: Readonly<Record<PressureTier, number>>;
  readonly modeDistribution: Readonly<Record<ModeCode, number>>;
  readonly avgBudgetFraction: number;
  readonly decisionWindowExpiredCount: number;
}

/** Single history entry for trend analysis. */
export interface ProjectorTrendEntry {
  readonly tick: number;
  readonly elapsedMs: number;
  readonly pressureTier: PressureTier;
  readonly phase: RunPhase;
  readonly pressureScore: number;
  readonly recordedAtMs: number;
}

/** Full trend analysis result from history window. */
export interface ProjectorTrendAnalysis {
  readonly sampleCount: number;
  readonly pressureTrend: 'IMPROVING' | 'STABLE' | 'DEGRADING';
  readonly escalationCount: number;
  readonly deescalationCount: number;
  readonly phaseTransitions: number;
  readonly tickVelocity: number;
  readonly sustainedHighPressureTicks: number;
  readonly budgetBurnRate: number;
  readonly dominantTier: PressureTier;
  readonly dominantPhase: RunPhase;
}

/** 28-dimensional ML feature output from a single projection. */
export interface ProjectorMLOutput {
  readonly features: Float32Array;
  readonly labels: readonly string[];
  readonly dim: 28;
  readonly tick: number;
  readonly createdAtMs: number;
}

/** 40×6 DL tensor output assembled from ring buffer. */
export interface ProjectorDLOutput {
  readonly tensor: Float32Array;
  readonly rows: number;
  readonly cols: 6;
  readonly rowsFilled: number;
  readonly columnLabels: readonly string[];
  readonly createdAtMs: number;
}

/** Chat signal output ready for LIVEOPS_SIGNAL emission. */
export interface ProjectorChatSignal {
  readonly envelope: ChatInputEnvelope;
  readonly tick: number;
  readonly phase: RunPhase;
  readonly pressureTier: PressureTier;
  readonly narrative: string;
  readonly urgencyLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly createdAtMs: number;
}

/** UX narrative output for player-facing projection display. */
export interface ProjectorNarrative {
  readonly headline: string;
  readonly detail: string;
  readonly urgencyLabel: string;
  readonly modeContext: string;
  readonly phaseContext: string;
  readonly outcomeContext: string;
  readonly excitement: number;
  readonly pressureDescription: string;
  readonly isEndgame: boolean;
}

/** Mode-specific multipliers used throughout projection scoring. */
export interface ModeMultipliers {
  readonly mode: ModeCode;
  readonly normalized: number;
  readonly difficultyMultiplier: number;
  readonly tensionFloor: number;
  readonly holdCap: number;
  readonly tempoFactor: number;
}

/** Phase-specific profile combining stakes, progress, and interpolation. */
export interface ProjectorPhaseProfile {
  readonly phase: RunPhase;
  readonly normalized: number;
  readonly stakesMultiplier: number;
  readonly progressFraction: number;
  readonly effectiveStakes: number;
  readonly isEndgame: boolean;
  readonly activeBoundary: PhaseBoundary | null;
  readonly interpolationPlan: TickInterpolationPlan | null;
  readonly transitionCapacity: number;
}

/** Resilience score comparing consecutive snapshot health states. */
export interface ResilienceScore {
  readonly composite: number;
  readonly pressureComponent: number;
  readonly shieldComponent: number;
  readonly economyComponent: number;
  readonly battleComponent: number;
  readonly direction: 'RECOVERING' | 'STABLE' | 'DECLINING';
  readonly shieldIntegrityRatio: number;
  readonly avgRegenRate: number;
}

/** Composite urgency score from all threat axes. */
export interface UrgencyScore {
  readonly composite: number;
  readonly tierComponent: number;
  readonly phaseComponent: number;
  readonly budgetComponent: number;
  readonly outcomeComponent: number;
  readonly urgencyLabel: string;
  readonly escalationBand: 'CALM' | 'BUILDING' | 'ELEVATED' | 'CRITICAL' | 'APEX';
  readonly recommendedDecisionWindowMs: number;
}

/** Validation result for a projection request. */
export interface ProjectionValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

/** Full bundle export for external analytics or replay systems. */
export interface ProjectorExportBundle {
  readonly version: string;
  readonly exportedAtMs: number;
  readonly runId: string;
  readonly mode: ModeCode;
  readonly auditSummary: ProjectorAuditSummary;
  readonly latestTrendAnalysis: ProjectorTrendAnalysis | null;
  readonly latestMLOutput: ProjectorMLOutput | null;
  readonly latestDLOutput: ProjectorDLOutput | null;
  readonly latestNarrative: ProjectorNarrative | null;
  readonly latestUrgency: UrgencyScore | null;
  readonly latestResilience: ResilienceScore | null;
  readonly projectionCount: number;
}

/* ============================================================================
 * § 6 — PRIVATE UTILITY FUNCTIONS
 * ============================================================================ */

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

function normalizeTick(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.trunc(value));
}

function clampToUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function safeDiv(numerator: number, denominator: number, fallback = 0): number {
  if (!Number.isFinite(denominator) || denominator === 0) return fallback;
  return numerator / denominator;
}

function resolveTelemetry(
  previous: TelemetryState,
  timeout: RunTimeoutResolution,
  request: TimeSnapshotProjectionRequest,
): TelemetryState {
  const warnings = dedupeStrings(
    previous.warnings,
    timeout.warnings,
    request.warnings ?? [],
  );
  return Object.freeze({
    ...previous,
    outcomeReason:
      request.outcomeReason !== undefined
        ? request.outcomeReason
        : timeout.outcomeReason !== null
          ? timeout.outcomeReason
          : previous.outcomeReason,
    outcomeReasonCode:
      request.outcomeReasonCode !== undefined
        ? request.outcomeReasonCode
        : timeout.outcomeReasonCode !== null
          ? timeout.outcomeReasonCode
          : previous.outcomeReasonCode,
    warnings,
  });
}

function resolveTags(
  snapshot: RunStateSnapshot,
  timeout: RunTimeoutResolution,
  request: TimeSnapshotProjectionRequest,
): readonly string[] {
  return dedupeStrings(
    snapshot.tags,
    timeout.tags,
    request.tags ?? [],
    request.decisionWindowExpired === true ? ['decision_window:expired'] : [],
  );
}

function resolveOutcome(
  snapshot: RunStateSnapshot,
  timeout: RunTimeoutResolution,
  request: TimeSnapshotProjectionRequest,
): RunOutcome | null {
  if (request.outcome !== undefined) {
    return request.outcome;
  }
  if (timeout.nextOutcome !== null) {
    return timeout.nextOutcome;
  }
  return snapshot.outcome;
}

/** Compute economy health from 0 (collapsing) to 1 (thriving). */
function computeEconomyHealthScore(economy: EconomyState): number {
  const cashScore = economy.cash >= 0 ? clampToUnit(economy.cash / Math.max(1, economy.freedomTarget)) : 0;
  const debtPenalty = economy.debt > 0 ? clampToUnit(economy.debt / Math.max(1, economy.freedomTarget)) * 0.3 : 0;
  const flowScore = economy.incomePerTick > economy.expensesPerTick ? 1.0 : 0.3;
  const heatPenalty = clampToUnit(economy.haterHeat / 100) * 0.2;
  return clampToUnit(cashScore * 0.5 + flowScore * 0.3 - debtPenalty - heatPenalty);
}

/** Compute aggregate shield integrity (0 = fully broken, 1 = fully intact). */
function computeAggregateShieldIntegrity(shield: ShieldState): number {
  if (shield.layers.length === 0) return 1.0;
  return computeShieldIntegrityRatio(
    shield.layers.map((l) => ({ id: l.layerId, current: l.current, max: l.max })),
  );
}

/** Compute weighted shield vulnerability from layer capacity weights. */
function computeWeightedShieldVulnerability(shield: ShieldState): number {
  if (shield.layers.length === 0) return 0;
  let weightedVuln = 0;
  let totalWeight = 0;
  for (const layer of shield.layers) {
    const weight = SHIELD_LAYER_CAPACITY_WEIGHT[layer.layerId];
    const integrityRatio = layer.max > 0 ? Math.min(1, layer.current / layer.max) : 0;
    weightedVuln += (1 - integrityRatio) * weight;
    totalWeight += weight;
  }
  return totalWeight > 0 ? clampToUnit(weightedVuln / totalWeight) : 0;
}

/** Compute average shield regen rate across all layers. */
function computeAvgShieldRegenRate(shield: ShieldState): number {
  if (shield.layers.length === 0) return 0;
  const totalRegen = shield.layers.reduce(
    (sum, l) => sum + estimateShieldRegenPerTick(l.layerId, l.max),
    0,
  );
  return totalRegen / shield.layers.length;
}

/** Compute battle load score: how much active combat is happening (0=none, 1=max). */
function assessBattleLoad(battle: BattleState): number {
  const attackingBots = battle.bots.filter((b) => b.state === 'ATTACKING').length;
  const pendingAttacks = battle.pendingAttacks.length;
  const budgetUsedFraction = safeDiv(battle.battleBudget, battle.battleBudgetCap);
  const botScore = clampToUnit(attackingBots / Math.max(1, battle.bots.length));
  const attackScore = clampToUnit(pendingAttacks / 5);
  return clampToUnit(botScore * 0.4 + attackScore * 0.3 + budgetUsedFraction * 0.3);
}

/** Assess pressure state context returning a normalized composite score. */
function assessPressureContext(pressure: PressureState): number {
  const tierScore = PRESSURE_TIER_NORMALIZED[pressure.tier];
  const upwardBias = clampToUnit(pressure.upwardCrossings / 10);
  const sustainedBias = clampToUnit(pressure.survivedHighPressureTicks / 20);
  return clampToUnit(tierScore * 0.6 + upwardBias * 0.2 + sustainedBias * 0.2);
}

/** Get the next pressure tier above current, or null if at apex. */
function nextPressureTierAbove(tier: PressureTier): PressureTier | null {
  const idx = PRESSURE_TIERS.indexOf(tier);
  return idx < PRESSURE_TIERS.length - 1
    ? (PRESSURE_TIERS[idx + 1] as PressureTier)
    : null;
}

/** Get the pressure tier below current, or null if at baseline. */
function prevPressureTierBelow(tier: PressureTier): PressureTier | null {
  const idx = PRESSURE_TIERS.indexOf(tier);
  return idx > 0 ? (PRESSURE_TIERS[idx - 1] as PressureTier) : null;
}

/** Compute budget fraction consumed (0=fresh, 1=exhausted). */
function computeBudgetFraction(timers: TimerState): number {
  const total = timers.seasonBudgetMs + timers.extensionBudgetMs;
  return total > 0 ? clampToUnit(timers.elapsedMs / total) : 1.0;
}

/** Map a RunOutcome to a numeric code for DL tensor encoding. */
function outcomeToCode(outcome: RunOutcome | null): number {
  if (outcome === null) return 0;
  switch (outcome) {
    case 'FREEDOM':   return 1;
    case 'TIMEOUT':   return 2;
    case 'BANKRUPT':  return 3;
    case 'ABANDONED': return 4;
    default:          return 0;
  }
}

/** Validate a TimerState for projector safety checks. */
function validateTimerState(timers: TimerState, pressureTier: PressureTier): string[] {
  const issues: string[] = [];
  const normalizedDuration = normalizeTickDurationMs(pressureTier, timers.currentTickDurationMs);
  const clamped = clampTickDurationMs(pressureTier, timers.currentTickDurationMs);
  if (clamped !== timers.currentTickDurationMs) {
    issues.push(`tick_duration_clamped:${timers.currentTickDurationMs}→${clamped}`);
  }
  if (normalizedDuration !== timers.currentTickDurationMs) {
    issues.push(`tick_duration_normalized:${timers.currentTickDurationMs}→${normalizedDuration}`);
  }
  if (timers.elapsedMs < 0) {
    issues.push('elapsed_ms_negative');
  }
  if (timers.seasonBudgetMs <= 0) {
    issues.push('season_budget_zero_or_negative');
  }
  if (timers.holdCharges > PROJECTOR_HOLD_CAP_BY_MODE['solo']) {
    // non-blocking warning only
    issues.push(`hold_charges_elevated:${timers.holdCharges}`);
  }
  return issues;
}

/** Validate the projection request before applying it. */
export function validateProjectionRequest(
  request: TimeSnapshotProjectionRequest,
  snapshot: RunStateSnapshot,
): ProjectionValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isRunPhase(request.phase)) {
    errors.push(`invalid_phase:${String(request.phase)}`);
  }
  if (request.outcome !== undefined && request.outcome !== null && !isRunOutcome(request.outcome)) {
    errors.push(`invalid_outcome:${String(request.outcome)}`);
  }
  if (!Number.isFinite(request.tick) || request.tick < 0) {
    errors.push(`invalid_tick:${request.tick}`);
  }
  if (!isModeCode(snapshot.mode)) {
    warnings.push(`unexpected_mode:${String(snapshot.mode)}`);
  }
  if (!isPressureTier(snapshot.pressure.tier)) {
    warnings.push(`unexpected_pressure_tier:${String(snapshot.pressure.tier)}`);
  }

  const timerIssues = validateTimerState(request.timers, snapshot.pressure.tier);
  for (const issue of timerIssues) {
    warnings.push(`timer:${issue}`);
  }

  if ((request.warnings?.length ?? 0) > 50) {
    warnings.push('excessive_warning_count');
  }

  return { valid: errors.length === 0, errors: freezeArray(errors), warnings: freezeArray(warnings) };
}

/* ============================================================================
 * § 7 — ProjectorAuditTrail
 * ============================================================================ */

class ProjectorAuditTrail {
  private readonly entries: ProjectorAuditEntry[] = [];
  private sequence = 0;

  public record(
    snapshot: RunStateSnapshot,
    request: TimeSnapshotProjectionRequest,
    timeout: RunTimeoutResolution,
  ): void {
    if (this.entries.length >= PROJECTOR_AUDIT_CAPACITY) {
      this.entries.shift();
    }
    const budgetFraction = computeBudgetFraction(request.timers);
    const entry: ProjectorAuditEntry = {
      sequence: ++this.sequence,
      createdAtMs: Date.now(),
      tick: normalizeTick(request.tick),
      phase: request.phase,
      pressureTier: snapshot.pressure.tier,
      mode: snapshot.mode,
      outcome: resolveOutcome(snapshot, timeout, request),
      elapsedMs: request.timers.elapsedMs,
      tagCount: (request.tags?.length ?? 0) + (timeout.tags?.length ?? 0),
      warningCount: (request.warnings?.length ?? 0) + (timeout.warnings?.length ?? 0),
      hadTimeout: timeout.nextOutcome === 'TIMEOUT',
      decisionWindowExpired: request.decisionWindowExpired === true,
      budgetFraction,
    };
    this.entries.push(entry);
  }

  public getAll(): readonly ProjectorAuditEntry[] {
    return freezeArray(this.entries);
  }

  public getRecent(limit = 10): readonly ProjectorAuditEntry[] {
    return freezeArray(this.entries.slice(-Math.min(limit, this.entries.length)));
  }

  public getByPhase(phase: RunPhase): readonly ProjectorAuditEntry[] {
    return freezeArray(this.entries.filter((e) => e.phase === phase));
  }

  public getByTier(tier: PressureTier): readonly ProjectorAuditEntry[] {
    return freezeArray(this.entries.filter((e) => e.pressureTier === tier));
  }

  public getSummary(): ProjectorAuditSummary {
    const phaseDistribution = Object.fromEntries(
      RUN_PHASES.map((p) => [p, this.entries.filter((e) => e.phase === p).length]),
    ) as Record<RunPhase, number>;

    const tierDistribution = Object.fromEntries(
      PRESSURE_TIERS.map((t) => [t, this.entries.filter((e) => e.pressureTier === t).length]),
    ) as Record<PressureTier, number>;

    const modeDistribution = Object.fromEntries(
      MODE_CODES.map((m) => [m, this.entries.filter((e) => e.mode === m).length]),
    ) as Record<ModeCode, number>;

    const outcomeEntries = this.entries.filter((e) => e.outcome !== null);
    const winCount = outcomeEntries.filter((e) => e.outcome !== null && isWinOutcome(e.outcome)).length;
    const lossCount = outcomeEntries.filter((e) => e.outcome !== null && isLossOutcome(e.outcome)).length;
    const timeoutCount = this.entries.filter((e) => e.hadTimeout).length;
    const bankruptCount = this.entries.filter((e) => e.outcome === 'BANKRUPT').length;
    const abandonCount = this.entries.filter((e) => e.outcome === 'ABANDONED').length;

    const totalBudgetFraction = this.entries.reduce((sum, e) => sum + e.budgetFraction, 0);
    const avgBudgetFraction = this.entries.length > 0
      ? safeDiv(totalBudgetFraction, this.entries.length)
      : 0;

    const decisionWindowExpiredCount = this.entries.filter((e) => e.decisionWindowExpired).length;

    return Object.freeze({
      totalProjections: this.entries.length,
      winCount,
      lossCount,
      timeoutCount,
      bankruptCount,
      abandonCount,
      phaseDistribution: Object.freeze(phaseDistribution),
      tierDistribution: Object.freeze(tierDistribution),
      modeDistribution: Object.freeze(modeDistribution),
      avgBudgetFraction,
      decisionWindowExpiredCount,
    });
  }

  public getOutcomeDistribution(): Readonly<Record<string, number>> {
    const dist: Record<string, number> = {};
    for (const outcome of RUN_OUTCOMES) {
      dist[outcome] = this.entries.filter((e) => e.outcome === outcome).length;
    }
    dist['null'] = this.entries.filter((e) => e.outcome === null).length;
    return Object.freeze(dist);
  }

  public clear(): void {
    this.entries.length = 0;
    this.sequence = 0;
  }

  public getSequence(): number {
    return this.sequence;
  }
}

/* ============================================================================
 * § 8 — ProjectorTrendAnalyzer
 * ============================================================================ */

class ProjectorTrendAnalyzer {
  private readonly history: ProjectorTrendEntry[] = [];
  private escalationCount = 0;
  private deescalationCount = 0;
  private phaseTransitions = 0;

  public appendHistory(snapshot: RunStateSnapshot): void {
    if (this.history.length >= PROJECTOR_TREND_HISTORY_SIZE) {
      this.history.shift();
    }

    const prev = this.history[this.history.length - 1] ?? null;

    if (prev !== null) {
      // Detect phase transitions using engine utility
      if (isPhaseBoundaryTransition(prev.elapsedMs, snapshot.timers.elapsedMs)) {
        this.phaseTransitions++;
      }
      // Detect tier escalation/deescalation
      const prevTierIndex = PRESSURE_TIERS.indexOf(prev.pressureTier);
      const currTierIndex = PRESSURE_TIERS.indexOf(snapshot.pressure.tier);
      if (currTierIndex > prevTierIndex) {
        this.escalationCount++;
      } else if (currTierIndex < prevTierIndex) {
        this.deescalationCount++;
      }
    }

    this.history.push({
      tick: snapshot.tick,
      elapsedMs: snapshot.timers.elapsedMs,
      pressureTier: snapshot.pressure.tier,
      phase: snapshot.phase,
      pressureScore: snapshot.pressure.score,
      recordedAtMs: Date.now(),
    });
  }

  public analyzeEscalationPotential(snapshot: RunStateSnapshot): boolean {
    const nextTier = nextPressureTierAbove(snapshot.pressure.tier);
    if (nextTier === null) return false;
    return canEscalatePressure(
      snapshot.pressure.tier,
      nextTier,
      snapshot.pressure.score,
      snapshot.pressure.survivedHighPressureTicks,
    );
  }

  public analyzeDeescalationPotential(snapshot: RunStateSnapshot): boolean {
    const prevTier = prevPressureTierBelow(snapshot.pressure.tier);
    if (prevTier === null) return false;
    return canDeescalatePressure(
      snapshot.pressure.tier,
      prevTier,
      snapshot.pressure.score,
    );
  }

  public getPressureTrend(): 'IMPROVING' | 'STABLE' | 'DEGRADING' {
    if (this.history.length < 3) return 'STABLE';
    const recent = this.history.slice(-5);
    const firstNorm = PRESSURE_TIER_NORMALIZED[recent[0].pressureTier];
    const lastNorm = PRESSURE_TIER_NORMALIZED[recent[recent.length - 1].pressureTier];
    const delta = lastNorm - firstNorm;
    if (delta < -0.15) return 'IMPROVING';
    if (delta > 0.15) return 'DEGRADING';
    return 'STABLE';
  }

  public getDominantTier(): PressureTier {
    if (this.history.length === 0) return 'T1';
    const counts = Object.fromEntries(PRESSURE_TIERS.map((t) => [t, 0])) as Record<PressureTier, number>;
    for (const entry of this.history) {
      counts[entry.pressureTier]++;
    }
    let max = -1;
    let dominant: PressureTier = 'T1';
    for (const tier of PRESSURE_TIERS) {
      if (counts[tier] > max) {
        max = counts[tier];
        dominant = tier;
      }
    }
    return dominant;
  }

  public getDominantPhase(): RunPhase {
    if (this.history.length === 0) return 'FOUNDATION';
    const counts = Object.fromEntries(RUN_PHASES.map((p) => [p, 0])) as Record<RunPhase, number>;
    for (const entry of this.history) {
      counts[entry.phase]++;
    }
    let max = -1;
    let dominant: RunPhase = 'FOUNDATION';
    for (const phase of RUN_PHASES) {
      if (counts[phase] > max) {
        max = counts[phase];
        dominant = phase;
      }
    }
    return dominant;
  }

  public getTickVelocity(): number {
    if (this.history.length < 2) return 0;
    const oldest = this.history[0];
    const newest = this.history[this.history.length - 1];
    const tickDelta = newest.tick - oldest.tick;
    const timeDeltaMs = newest.recordedAtMs - oldest.recordedAtMs;
    return timeDeltaMs > 0 ? safeDiv(tickDelta * 1000, timeDeltaMs) : 0;
  }

  public getBudgetBurnRate(): number {
    if (this.history.length < 2) return 0;
    const oldest = this.history[0];
    const newest = this.history[this.history.length - 1];
    const elapsedDelta = newest.elapsedMs - oldest.elapsedMs;
    const wallTimeDelta = newest.recordedAtMs - oldest.recordedAtMs;
    return wallTimeDelta > 0 ? safeDiv(elapsedDelta, wallTimeDelta) : 0;
  }

  public getSustainedHighPressureTicks(): number {
    let count = 0;
    for (const entry of [...this.history].reverse()) {
      if (entry.pressureTier === 'T3' || entry.pressureTier === 'T4') {
        count++;
      } else {
        break;
      }
    }
    return count;
  }

  public analyze(snapshot: RunStateSnapshot): ProjectorTrendAnalysis {
    // Resolve phase from elapsed to cross-validate with resolvePhaseFromElapsedMs
    const resolvedPhase = resolvePhaseFromElapsedMs(snapshot.timers.elapsedMs);
    const domPhase = this.getDominantPhase();

    return {
      sampleCount: this.history.length,
      pressureTrend: this.getPressureTrend(),
      escalationCount: this.escalationCount,
      deescalationCount: this.deescalationCount,
      phaseTransitions: this.phaseTransitions,
      tickVelocity: this.getTickVelocity(),
      sustainedHighPressureTicks: this.getSustainedHighPressureTicks(),
      budgetBurnRate: this.getBudgetBurnRate(),
      dominantTier: this.getDominantTier(),
      dominantPhase: resolvedPhase !== domPhase ? resolvedPhase : domPhase,
    };
  }

  public reset(): void {
    this.history.length = 0;
    this.escalationCount = 0;
    this.deescalationCount = 0;
    this.phaseTransitions = 0;
  }
}

/* ============================================================================
 * § 9 — ProjectorMLExtractor
 * ============================================================================ */

class ProjectorMLExtractor {
  private lastOutput: ProjectorMLOutput | null = null;

  public extract(
    snapshot: RunStateSnapshot,
    request: TimeSnapshotProjectionRequest,
    timeout: RunTimeoutResolution,
  ): ProjectorMLOutput {
    const features = new Float32Array(PROJECTOR_ML_DIM);
    const tier = snapshot.pressure.tier;
    const phase = request.phase;
    const mode = snapshot.mode;
    const outcome = resolveOutcome(snapshot, timeout, request);
    const budgetFraction = computeBudgetFraction(request.timers);
    const totalBudgetMs = request.timers.seasonBudgetMs + request.timers.extensionBudgetMs;

    // [0] mode_normalized
    features[0] = MODE_NORMALIZED[mode] ?? 0;

    // [1] pressure_tier_normalized
    features[1] = PRESSURE_TIER_NORMALIZED[tier] ?? 0;

    // [2] run_phase_normalized
    features[2] = RUN_PHASE_NORMALIZED[phase] ?? 0;

    // [3] tick_duration_normalized
    const defaultDuration = getDefaultTickDurationMs(tier);
    features[3] = clampToUnit(safeDiv(request.timers.currentTickDurationMs, TIER_DURATIONS_MS['T0']));

    // [4] decision_window_normalized
    const decisionWindowMs = getDecisionWindowDurationMs(tier);
    features[4] = clampToUnit(safeDiv(decisionWindowMs, DECISION_WINDOW_DURATIONS_MS['T0']));

    // [5] elapsed_budget_fraction
    features[5] = budgetFraction;

    // [6] remaining_budget_fraction
    features[6] = 1 - budgetFraction;

    // [7] outcome_is_terminal
    features[7] = outcome !== null ? 1 : 0;

    // [8] outcome_is_win
    features[8] = outcome !== null && isWinOutcome(outcome) ? 1 : 0;

    // [9] escalation_risk_score
    features[9] = clampToUnit(computePressureRiskScore(tier, snapshot.pressure.score));

    // [10] effective_stakes
    features[10] = clampToUnit(safeDiv(computeEffectiveStakes(phase, mode), 2.0));

    // [11] mode_tension_floor
    features[11] = MODE_TENSION_FLOOR[mode] ?? 0;

    // [12] hold_charges_normalized
    const holdCap = Math.max(1, PROJECTOR_HOLD_CAP_BY_MODE[mode] + 1);
    features[12] = clampToUnit(safeDiv(request.timers.holdCharges, holdCap));

    // [13] active_decision_windows_count
    const activeWindowCount = Object.keys(request.timers.activeDecisionWindows).length;
    features[13] = clampToUnit(safeDiv(activeWindowCount, 10));

    // [14] frozen_decision_windows_count
    features[14] = clampToUnit(safeDiv(request.timers.frozenWindowIds.length, 5));

    // [15] tag_count_normalized
    const tagCount = (request.tags?.length ?? 0) + (timeout.tags?.length ?? 0);
    features[15] = clampToUnit(safeDiv(tagCount, 20));

    // [16] warning_count_normalized
    const warnCount = (request.warnings?.length ?? 0) + (timeout.warnings?.length ?? 0);
    features[16] = clampToUnit(safeDiv(warnCount, 10));

    // [17] phase_boundary_crossed
    const prevElapsedMs = Math.max(0, request.timers.elapsedMs - request.timers.currentTickDurationMs);
    features[17] = isPhaseBoundaryTransition(prevElapsedMs, request.timers.elapsedMs) ? 1 : 0;

    // [18] endgame_flag
    features[18] = isEndgamePhase(phase) ? 1 : 0;

    // [19] pressure_risk_score
    features[19] = clampToUnit(computePressureRiskScore(tier, snapshot.pressure.score));

    // [20] shield_integrity_ratio
    features[20] = clampToUnit(computeAggregateShieldIntegrity(snapshot.shield));

    // [21] avg_shield_regen_rate
    features[21] = clampToUnit(safeDiv(computeAvgShieldRegenRate(snapshot.shield), DEFAULT_HOLD_DURATION_MS));

    // [22] outcome_excitement_score
    const excitement = outcome !== null
      ? scoreOutcomeExcitement(outcome, mode)
      : scoreOutcomeExcitement('TIMEOUT', mode);
    features[22] = clampToUnit(safeDiv(excitement, 5));

    // [23] tier_duration_ms_normalized
    features[23] = clampToUnit(safeDiv(defaultDuration, TIER_DURATIONS_MS['T0']));

    // [24] interpolation_tick_count_normalized
    const interpolCount = computeInterpolationTickCount(Math.abs(defaultDuration - TIER_DURATIONS_MS['T1']));
    features[24] = clampToUnit(safeDiv(interpolCount, 4));

    // [25] mode_difficulty_multiplier_normalized
    features[25] = clampToUnit(safeDiv(MODE_DIFFICULTY_MULTIPLIER[mode], 2.0));

    // [26] phase_stakes_multiplier
    features[26] = RUN_PHASE_STAKES_MULTIPLIER[phase] ?? 0;

    // [27] timeout_proximity_score
    const remainingMs = totalBudgetMs - request.timers.elapsedMs;
    features[27] = clampToUnit(1 - safeDiv(remainingMs, totalBudgetMs));

    const output: ProjectorMLOutput = {
      features,
      labels: PROJECTOR_ML_FEATURE_LABELS,
      dim: PROJECTOR_ML_DIM,
      tick: normalizeTick(request.tick),
      createdAtMs: Date.now(),
    };
    this.lastOutput = output;
    return output;
  }

  public getLastOutput(): ProjectorMLOutput | null {
    return this.lastOutput;
  }

  public getFeatureByLabel(output: ProjectorMLOutput, label: string): number | null {
    const idx = PROJECTOR_ML_FEATURE_LABELS.indexOf(label);
    if (idx < 0 || idx >= output.features.length) return null;
    return output.features[idx] ?? null;
  }

  public reset(): void {
    this.lastOutput = null;
  }
}

/* ============================================================================
 * § 10 — ProjectorDLBuilder
 * ============================================================================ */

class ProjectorDLBuilder {
  private readonly buffer: Float32Array;
  private rowHead = 0;
  private rowsFilled = 0;

  public constructor() {
    this.buffer = new Float32Array(PROJECTOR_DL_ROWS * PROJECTOR_DL_COLS);
  }

  public appendRow(
    snapshot: RunStateSnapshot,
    request: TimeSnapshotProjectionRequest,
  ): void {
    const tier = snapshot.pressure.tier;
    const phase = request.phase;
    const mode = snapshot.mode;
    const budgetFraction = computeBudgetFraction(request.timers);
    const outcome = snapshot.outcome;

    // Get tick tier config for this tier
    const engineTickTier = pressureTierToTickTier(tier);
    const tickTierCfg: TickTierConfig = getTickTierConfig(engineTickTier);

    const row = new Float32Array(PROJECTOR_DL_COLS);

    // [0] pressure_normalized
    row[0] = PRESSURE_TIER_NORMALIZED[tier] ?? 0;

    // [1] tick_duration_normalized
    row[1] = clampToUnit(safeDiv(tickTierCfg.defaultDurationMs, TICK_TIER_CONFIGS[TickTier.SOVEREIGN].defaultDurationMs));

    // [2] elapsed_fraction
    row[2] = budgetFraction;

    // [3] phase_score
    row[3] = RUN_PHASE_NORMALIZED[phase] ?? 0;

    // [4] outcome_code (normalized 0-1)
    row[4] = safeDiv(outcomeToCode(outcome), 4);

    // [5] effective_stakes
    row[5] = clampToUnit(safeDiv(computeEffectiveStakes(phase, mode), 2.0));

    const offset = this.rowHead * PROJECTOR_DL_COLS;
    this.buffer.set(row, offset);

    this.rowHead = (this.rowHead + 1) % PROJECTOR_DL_ROWS;
    if (this.rowsFilled < PROJECTOR_DL_ROWS) {
      this.rowsFilled++;
    }
  }

  public getTensor(): ProjectorDLOutput {
    // Re-order buffer so most-recent entries are last
    const tensor = new Float32Array(PROJECTOR_DL_ROWS * PROJECTOR_DL_COLS);
    const filledRows = this.rowsFilled;
    for (let i = 0; i < filledRows; i++) {
      const srcIdx = ((this.rowHead - filledRows + i + PROJECTOR_DL_ROWS) % PROJECTOR_DL_ROWS) * PROJECTOR_DL_COLS;
      const dstIdx = i * PROJECTOR_DL_COLS;
      for (let c = 0; c < PROJECTOR_DL_COLS; c++) {
        tensor[dstIdx + c] = this.buffer[srcIdx + c] ?? 0;
      }
    }
    return {
      tensor,
      rows: PROJECTOR_DL_ROWS,
      cols: PROJECTOR_DL_COLS,
      rowsFilled: this.rowsFilled,
      columnLabels: PROJECTOR_DL_COLUMN_LABELS,
      createdAtMs: Date.now(),
    };
  }

  public getRowCount(): number {
    return this.rowsFilled;
  }

  public isFull(): boolean {
    return this.rowsFilled >= PROJECTOR_DL_ROWS;
  }

  public reset(): void {
    this.buffer.fill(0);
    this.rowHead = 0;
    this.rowsFilled = 0;
  }

  /** Access a single column across all filled rows. */
  public getColumnSlice(colIndex: number): Float32Array {
    if (colIndex < 0 || colIndex >= PROJECTOR_DL_COLS) {
      return new Float32Array(0);
    }
    const slice = new Float32Array(this.rowsFilled);
    for (let i = 0; i < this.rowsFilled; i++) {
      const srcRow = ((this.rowHead - this.rowsFilled + i + PROJECTOR_DL_ROWS) % PROJECTOR_DL_ROWS);
      slice[i] = this.buffer[srcRow * PROJECTOR_DL_COLS + colIndex] ?? 0;
    }
    return slice;
  }
}

/* ============================================================================
 * § 11 — ProjectorChatBridge
 * ============================================================================ */

class ProjectorChatBridge {
  private lastSignal: ProjectorChatSignal | null = null;
  private emitCount = 0;

  /** Bridge engine TickTier enum → chat-local TickTier string union. */
  private bridgeToChatTickTier(
    tier: TickTier,
  ): 'SETUP' | 'WINDOW' | 'COMMIT' | 'RESOLUTION' | 'SEAL' {
    switch (tier) {
      case TickTier.SOVEREIGN:         return 'SEAL';
      case TickTier.STABLE:            return 'RESOLUTION';
      case TickTier.COMPRESSED:        return 'COMMIT';
      case TickTier.CRISIS:            return 'WINDOW';
      case TickTier.COLLAPSE_IMMINENT: return 'SETUP';
      default:                         return 'COMMIT';
    }
  }

  /** Bridge engine RunOutcome → chat-local RunOutcome string union. */
  private bridgeToChatOutcome(
    outcome: RunOutcome | null,
  ): 'UNRESOLVED' | 'SURVIVED' | 'FAILED' | 'BANKRUPT' | 'SOVEREIGN' | 'WITHDRAWN' {
    if (outcome === null) return 'UNRESOLVED';
    switch (outcome) {
      case 'FREEDOM':   return 'SOVEREIGN';
      case 'TIMEOUT':   return 'FAILED';
      case 'BANKRUPT':  return 'BANKRUPT';
      case 'ABANDONED': return 'WITHDRAWN';
      default:          return 'UNRESOLVED';
    }
  }

  /** Compute urgency level label from composite score. */
  private computeUrgencyLevel(
    pressureTier: PressureTier,
    budgetFraction: number,
  ): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const tierScore = PRESSURE_TIER_NORMALIZED[pressureTier] ?? 0;
    const composite = tierScore * 0.6 + budgetFraction * 0.4;
    if (composite >= 0.85) return 'CRITICAL';
    if (composite >= 0.6) return 'HIGH';
    if (composite >= 0.35) return 'MEDIUM';
    return 'LOW';
  }

  /** Build the ChatRunSnapshot for the signal envelope. */
  private buildRunSnapshot(
    snapshot: RunStateSnapshot,
    request: TimeSnapshotProjectionRequest,
    timeout: RunTimeoutResolution,
  ): ChatRunSnapshot {
    const engineTier = pressureTierToTickTier(snapshot.pressure.tier);
    const chatTier = this.bridgeToChatTickTier(engineTier);
    const resolvedOutcome = resolveOutcome(snapshot, timeout, request);
    const chatOutcome = this.bridgeToChatOutcome(resolvedOutcome);

    return {
      runId: snapshot.runId,
      runPhase: request.phase,
      tickTier: chatTier,
      outcome: chatOutcome,
      bankruptcyWarning: snapshot.economy.cash < 0 || snapshot.economy.netWorth < 0,
      nearSovereignty: snapshot.economy.netWorth >= snapshot.economy.freedomTarget * 0.85,
      elapsedMs: request.timers.elapsedMs,
    };
  }

  /** Build the ChatLiveOpsSnapshot for the signal envelope. */
  private buildLiveOpsSnapshot(
    snapshot: RunStateSnapshot,
    budgetFraction: number,
  ): ChatLiveOpsSnapshot {
    const heatMultiplier = clampToUnit(
      PRESSURE_TIER_NORMALIZED[snapshot.pressure.tier] * 0.7 + budgetFraction * 0.3,
    );
    return {
      worldEventName: null as Nullable<string>,
      heatMultiplier01: heatMultiplier as Score01,
      helperBlackout: snapshot.pressure.tier === 'T4',
      haterRaidActive: snapshot.battle.bots.some((b) => b.state === 'ATTACKING'),
    };
  }

  /** Build the full ChatSignalEnvelope. */
  private buildSignalEnvelope(
    snapshot: RunStateSnapshot,
    request: TimeSnapshotProjectionRequest,
    timeout: RunTimeoutResolution,
    roomId: Nullable<ChatRoomId>,
  ): ChatSignalEnvelope {
    const budgetFraction = computeBudgetFraction(request.timers);
    const metadata: Record<string, JsonValue> = {
      tick: request.tick,
      phase: request.phase,
      pressureTier: snapshot.pressure.tier,
      budgetFraction: Number(budgetFraction.toFixed(4)),
      hadTimeout: timeout.nextOutcome === 'TIMEOUT',
    };

    return {
      type: PROJECTOR_CHAT_SIGNAL_TYPE,
      emittedAt: Date.now() as UnixMs,
      roomId,
      run: this.buildRunSnapshot(snapshot, request, timeout),
      liveops: this.buildLiveOpsSnapshot(snapshot, budgetFraction),
      metadata: Object.freeze(metadata),
    };
  }

  /** Build the full LIVEOPS_SIGNAL ChatInputEnvelope. */
  public buildSignal(
    snapshot: RunStateSnapshot,
    request: TimeSnapshotProjectionRequest,
    timeout: RunTimeoutResolution,
    options: {
      readonly roomId?: Nullable<ChatRoomId>;
      readonly narrative?: string;
    } = {},
  ): ProjectorChatSignal {
    const roomId: Nullable<ChatRoomId> = options.roomId ?? null;
    const budgetFraction = computeBudgetFraction(request.timers);
    const urgencyLevel = this.computeUrgencyLevel(snapshot.pressure.tier, budgetFraction);
    const narrative = options.narrative ?? PRESSURE_TIER_URGENCY_LABEL[snapshot.pressure.tier];

    const signalEnvelope = this.buildSignalEnvelope(snapshot, request, timeout, roomId);

    const envelope: ChatInputEnvelope = {
      kind: 'LIVEOPS_SIGNAL',
      emittedAt: Date.now() as UnixMs,
      payload: signalEnvelope,
    };

    const signal: ProjectorChatSignal = {
      envelope,
      tick: normalizeTick(request.tick),
      phase: request.phase,
      pressureTier: snapshot.pressure.tier,
      narrative,
      urgencyLevel,
      createdAtMs: Date.now(),
    };

    this.lastSignal = signal;
    this.emitCount++;
    return signal;
  }

  public getLastSignal(): ProjectorChatSignal | null {
    return this.lastSignal;
  }

  public getEmitCount(): number {
    return this.emitCount;
  }

  public reset(): void {
    this.lastSignal = null;
    this.emitCount = 0;
  }
}

/* ============================================================================
 * § 12 — ProjectorNarrator
 * ============================================================================ */

class ProjectorNarrator {
  private lastNarrative: ProjectorNarrative | null = null;

  public narrateProjection(
    snapshot: RunStateSnapshot,
    request: TimeSnapshotProjectionRequest,
    timeout: RunTimeoutResolution,
  ): ProjectorNarrative {
    const tier = snapshot.pressure.tier;
    const phase = request.phase;
    const mode = snapshot.mode;
    const outcome = resolveOutcome(snapshot, timeout, request);

    const pressureDescription = describePressureTierExperience(tier);
    const urgencyLabel = PRESSURE_TIER_URGENCY_LABEL[tier];
    const endgame = isEndgamePhase(phase);
    const excitement = outcome !== null
      ? scoreOutcomeExcitement(outcome, mode)
      : scoreOutcomeExcitement('TIMEOUT', mode);

    const headline = this.buildHeadline(tier, phase, outcome, endgame);
    const detail = this.buildDetail(snapshot, request, timeout, endgame);
    const modeContext = this.buildModeContext(mode);
    const phaseContext = this.buildPhaseContext(phase, endgame);
    const outcomeContext = this.buildOutcomeContext(outcome, mode);

    const narrative: ProjectorNarrative = {
      headline,
      detail,
      urgencyLabel,
      modeContext,
      phaseContext,
      outcomeContext,
      excitement,
      pressureDescription,
      isEndgame: endgame,
    };

    this.lastNarrative = narrative;
    return narrative;
  }

  private buildHeadline(
    tier: PressureTier,
    phase: RunPhase,
    outcome: RunOutcome | null,
    endgame: boolean,
  ): string {
    if (outcome === 'FREEDOM') {
      return 'Financial Freedom Achieved';
    }
    if (outcome === 'BANKRUPT') {
      return 'Game Over — Financial Collapse';
    }
    if (outcome === 'TIMEOUT') {
      return 'Time Expired — Run Concluded';
    }
    if (outcome === 'ABANDONED') {
      return 'Run Abandoned';
    }
    if (endgame) {
      return `Sovereignty Phase — ${PRESSURE_TIER_URGENCY_LABEL[tier]} Pressure`;
    }
    switch (tier) {
      case 'T0': return 'Sovereign Mode — Building Empire';
      case 'T1': return 'Stable Progress — Momentum Building';
      case 'T2': return 'Compressed Timeline — Decisions Critical';
      case 'T3': return 'Crisis Mode — Immediate Action Required';
      case 'T4': return 'Collapse Imminent — Last Chance';
      default:   return `${phase} Phase — ${PRESSURE_TIER_URGENCY_LABEL[tier]} Pressure`;
    }
  }

  private buildDetail(
    snapshot: RunStateSnapshot,
    request: TimeSnapshotProjectionRequest,
    timeout: RunTimeoutResolution,
    endgame: boolean,
  ): string {
    const budgetFraction = computeBudgetFraction(request.timers);
    const remainingMs = request.timers.seasonBudgetMs + request.timers.extensionBudgetMs - request.timers.elapsedMs;
    const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));
    const shieldIntegrity = computeAggregateShieldIntegrity(snapshot.shield);
    const warnLabel = timeout.nextOutcome === 'TIMEOUT' ? ' ⚠ Budget exhausted.' : '';
    const shieldLabel = shieldIntegrity < 0.3 ? ' Shield critically low.' : '';
    const endgameLabel = endgame ? ' Endgame — every decision counts.' : '';
    const budgetLabel = budgetFraction > 0.9
      ? ` Only ${remainingSec}s remaining.`
      : ` ${remainingSec}s of budget left.`;
    return `Tick ${request.tick} · ${request.phase}${budgetLabel}${warnLabel}${shieldLabel}${endgameLabel}`;
  }

  private buildModeContext(mode: ModeCode): string {
    const tensionFloor = MODE_TENSION_FLOOR[mode];
    switch (mode) {
      case 'solo':  return `Empire Mode — solo run (tension floor ${(tensionFloor * 100).toFixed(0)}%)`;
      case 'pvp':   return `Predator Mode — competing against rivals (tension floor ${(tensionFloor * 100).toFixed(0)}%)`;
      case 'coop':  return `Syndicate Mode — cooperating with allies (tension floor ${(tensionFloor * 100).toFixed(0)}%)`;
      case 'ghost': return `Phantom Mode — ghost run vs legend (tension floor ${(tensionFloor * 100).toFixed(0)}%)`;
      default:      return `Unknown mode`;
    }
  }

  private buildPhaseContext(phase: RunPhase, endgame: boolean): string {
    const stakesMultiplier = RUN_PHASE_STAKES_MULTIPLIER[phase];
    const phaseNorm = RUN_PHASE_NORMALIZED[phase];
    const endgameTag = endgame ? ' [ENDGAME]' : '';
    return `${phase}${endgameTag} — stakes ${(stakesMultiplier * 100).toFixed(0)}%, phase progress ${(phaseNorm * 100).toFixed(0)}%`;
  }

  private buildOutcomeContext(outcome: RunOutcome | null, mode: ModeCode): string {
    if (outcome === null) return 'Run still active — no final outcome yet.';
    const win = isWinOutcome(outcome);
    const loss = isLossOutcome(outcome);
    const excitement = scoreOutcomeExcitement(outcome, mode);
    const sign = win ? '✓' : loss ? '✗' : '—';
    return `${sign} ${outcome} (excitement ${excitement.toFixed(1)}/5 in ${mode} mode)`;
  }

  public getLastNarrative(): ProjectorNarrative | null {
    return this.lastNarrative;
  }

  public reset(): void {
    this.lastNarrative = null;
  }
}

/* ============================================================================
 * § 13 — ProjectorModeAdvisor
 * ============================================================================ */

class ProjectorModeAdvisor {
  /** Get all valid mode codes. */
  public getAllModes(): readonly ModeCode[] {
    return MODE_CODES;
  }

  /** Validate a mode code at runtime. */
  public isValidMode(mode: unknown): mode is ModeCode {
    return isModeCode(mode);
  }

  /** Get the full multiplier profile for a mode. */
  public getMultipliers(mode: ModeCode): ModeMultipliers {
    return {
      mode,
      normalized: MODE_NORMALIZED[mode],
      difficultyMultiplier: MODE_DIFFICULTY_MULTIPLIER[mode],
      tensionFloor: MODE_TENSION_FLOOR[mode],
      holdCap: PROJECTOR_HOLD_CAP_BY_MODE[mode],
      tempoFactor: this.getTempoFactor(mode),
    };
  }

  /** Tempo factor — how fast time runs relative to solo baseline. */
  public getTempoFactor(mode: ModeCode): number {
    switch (mode) {
      case 'solo':  return 1.0;
      case 'pvp':   return 1.25;
      case 'coop':  return 0.9;
      case 'ghost': return 1.15;
      default:      return 1.0;
    }
  }

  /** Get the tension floor for a mode. */
  public getTensionFloor(mode: ModeCode): number {
    return MODE_TENSION_FLOOR[mode];
  }

  /** Get the difficulty multiplier for a mode. */
  public getDifficultyMultiplier(mode: ModeCode): number {
    return MODE_DIFFICULTY_MULTIPLIER[mode];
  }

  /** Rank all modes by difficulty (ascending). */
  public rankByDifficulty(): readonly ModeCode[] {
    return [...MODE_CODES].sort(
      (a, b) => MODE_DIFFICULTY_MULTIPLIER[a] - MODE_DIFFICULTY_MULTIPLIER[b],
    );
  }

  /** Rank all modes by tension floor (ascending). */
  public rankByTensionFloor(): readonly ModeCode[] {
    return [...MODE_CODES].sort(
      (a, b) => MODE_TENSION_FLOOR[a] - MODE_TENSION_FLOOR[b],
    );
  }

  /** Get hold charge capacity for mode. */
  public getHoldCap(mode: ModeCode): number {
    return PROJECTOR_HOLD_CAP_BY_MODE[mode];
  }

  /** Estimate effective tick duration given mode tempo and base duration. */
  public estimateEffectiveDurationMs(mode: ModeCode, baseDurationMs: number): number {
    return Math.round(baseDurationMs / this.getTempoFactor(mode));
  }

  /** Summary string for mode profile (used in exports). */
  public summarize(mode: ModeCode): string {
    const m = this.getMultipliers(mode);
    return (
      `Mode[${mode}]: difficulty=${m.difficultyMultiplier}x ` +
      `tension_floor=${(m.tensionFloor * 100).toFixed(0)}% ` +
      `tempo=${m.tempoFactor}x hold_cap=${m.holdCap}`
    );
  }
}

/* ============================================================================
 * § 14 — ProjectorPhaseAdvisor
 * ============================================================================ */

class ProjectorPhaseAdvisor {
  /** Get all valid run phases. */
  public getAllPhases(): readonly RunPhase[] {
    return RUN_PHASES;
  }

  /** Validate a run phase at runtime. */
  public isValidPhase(phase: unknown): phase is RunPhase {
    return isRunPhase(phase);
  }

  /** Get the stakes multiplier for a phase. */
  public getStakesMultiplier(phase: RunPhase): number {
    return RUN_PHASE_STAKES_MULTIPLIER[phase];
  }

  /** Get the normalized phase score (0=FOUNDATION, 1=SOVEREIGNTY). */
  public getPhaseScore(phase: RunPhase): number {
    return RUN_PHASE_NORMALIZED[phase];
  }

  /** Whether this phase is the endgame. */
  public isEndgame(phase: RunPhase): boolean {
    return isEndgamePhase(phase);
  }

  /** Compute effective stakes combining phase and mode. */
  public getEffectiveStakes(phase: RunPhase, mode: ModeCode): number {
    return computeEffectiveStakes(phase, mode);
  }

  /**
   * Compute run progress fraction from phase, tick number, and budget size.
   * Uses DEFAULT_PHASE_TRANSITION_WINDOWS as phase tick budget reference.
   */
  public getProgressFraction(snapshot: RunStateSnapshot): number {
    const phaseTickBudget = DEFAULT_PHASE_TRANSITION_WINDOWS * 10;
    return computeRunProgressFraction(snapshot.phase, snapshot.tick, phaseTickBudget);
  }

  /** Get the active phase boundary from the elapsed time. */
  public getActiveBoundary(elapsedMs: number): PhaseBoundary | null {
    let active: PhaseBoundary | null = null;
    for (const boundary of PHASE_BOUNDARIES_MS) {
      if (elapsedMs >= boundary.startsAtMs) {
        active = boundary;
      }
    }
    return active;
  }

  /** How many phase transition windows remain for the current phase. */
  public getTransitionCapacity(snapshot: RunStateSnapshot): number {
    const base = DEFAULT_PHASE_TRANSITION_WINDOWS;
    const phaseOffset = RUN_PHASES.indexOf(snapshot.phase);
    return Math.max(0, base - phaseOffset * 2);
  }

  /** Build a tick interpolation plan for a tier change within this phase. */
  public buildInterpolationPlan(
    fromTier: PressureTier,
    toTier: PressureTier,
  ): TickInterpolationPlan {
    const fromEngTier = TICK_TIER_BY_PRESSURE_TIER[fromTier];
    const toEngTier = TICK_TIER_BY_PRESSURE_TIER[toTier];
    const fromMs = TICK_TIER_CONFIGS[fromEngTier].defaultDurationMs;
    const toMs = TICK_TIER_CONFIGS[toEngTier].defaultDurationMs;
    return createInterpolationPlan(fromEngTier, toEngTier, fromMs, toMs);
  }

  /** Estimate ticks needed to interpolate between two tier durations. */
  public estimateInterpolationTicks(fromTier: PressureTier, toTier: PressureTier): number {
    const fromMs = TICK_TIER_CONFIGS[TICK_TIER_BY_PRESSURE_TIER[fromTier]].defaultDurationMs;
    const toMs = TICK_TIER_CONFIGS[TICK_TIER_BY_PRESSURE_TIER[toTier]].defaultDurationMs;
    return computeInterpolationTickCount(Math.abs(toMs - fromMs));
  }

  /** Build the full phase profile for the current snapshot state. */
  public buildProfile(
    snapshot: RunStateSnapshot,
    request: TimeSnapshotProjectionRequest,
  ): ProjectorPhaseProfile {
    const phase = request.phase;
    const activeBoundary = this.getActiveBoundary(request.timers.elapsedMs);
    const prevTier = prevPressureTierBelow(snapshot.pressure.tier);
    const currTier = snapshot.pressure.tier;
    const interpolationPlan = prevTier !== null
      ? this.buildInterpolationPlan(prevTier, currTier)
      : null;

    return {
      phase,
      normalized: RUN_PHASE_NORMALIZED[phase],
      stakesMultiplier: this.getStakesMultiplier(phase),
      progressFraction: this.getProgressFraction(snapshot),
      effectiveStakes: this.getEffectiveStakes(phase, snapshot.mode),
      isEndgame: this.isEndgame(phase),
      activeBoundary,
      interpolationPlan,
      transitionCapacity: this.getTransitionCapacity(snapshot),
    };
  }
}

/* ============================================================================
 * § 15 — ProjectorResilienceScorer
 * ============================================================================ */

class ProjectorResilienceScorer {
  private previousSnapshot: RunStateSnapshot | null = null;

  /** Update previous snapshot reference for delta scoring. */
  public recordSnapshot(snapshot: RunStateSnapshot): void {
    this.previousSnapshot = snapshot;
  }

  /** Score shield resilience for a snapshot. */
  public scoreShield(snapshot: RunStateSnapshot): number {
    const integrityRatio = computeAggregateShieldIntegrity(snapshot.shield);
    const weightedVuln = computeWeightedShieldVulnerability(snapshot.shield);
    return clampToUnit(integrityRatio * 0.6 + (1 - weightedVuln) * 0.4);
  }

  /** Project expected shield recovery ticks to full integrity. */
  public projectShieldRecovery(snapshot: RunStateSnapshot): number {
    if (snapshot.shield.layers.length === 0) return 0;
    let totalDeficit = 0;
    let totalRegen = 0;
    for (const layer of snapshot.shield.layers) {
      totalDeficit += Math.max(0, layer.max - layer.current);
      totalRegen += estimateShieldRegenPerTick(layer.layerId, layer.max);
    }
    return totalRegen > 0 ? Math.ceil(safeDiv(totalDeficit, totalRegen)) : 999;
  }

  /** Full resilience score comparing current vs previous snapshot. */
  public score(current: RunStateSnapshot): ResilienceScore {
    const prev = this.previousSnapshot ?? current;

    // Pressure component: improvement if tier dropped
    const prevTierNorm = PRESSURE_TIER_NORMALIZED[prev.pressure.tier];
    const currTierNorm = PRESSURE_TIER_NORMALIZED[current.pressure.tier];
    const pressureComponent = clampToUnit(1 - currTierNorm);
    const pressureDelta = prevTierNorm - currTierNorm; // positive = improving

    // Shield component
    const shieldIntegrityRatio = computeAggregateShieldIntegrity(current.shield);
    const shieldComponent = this.scoreShield(current);
    const avgRegenRate = computeAvgShieldRegenRate(current.shield);

    // Economy component
    const economyComponent = computeEconomyHealthScore(current.economy);

    // Battle component
    const battleLoad = assessBattleLoad(current.battle);
    const battleComponent = clampToUnit(1 - battleLoad);

    // Composite
    const composite = clampToUnit(
      pressureComponent * PROJECTOR_RESILIENCE_WEIGHTS.PRESSURE_WEIGHT +
      shieldComponent * PROJECTOR_RESILIENCE_WEIGHTS.SHIELD_WEIGHT +
      economyComponent * PROJECTOR_RESILIENCE_WEIGHTS.ECONOMY_WEIGHT +
      battleComponent * PROJECTOR_RESILIENCE_WEIGHTS.BATTLE_WEIGHT,
    );

    // Direction from delta
    const direction: ResilienceScore['direction'] =
      pressureDelta > 0.1 && economyComponent > 0.5
        ? 'RECOVERING'
        : pressureDelta < -0.1 || economyComponent < 0.3
          ? 'DECLINING'
          : 'STABLE';

    return {
      composite,
      pressureComponent,
      shieldComponent,
      economyComponent,
      battleComponent,
      direction,
      shieldIntegrityRatio,
      avgRegenRate,
    };
  }

  public reset(): void {
    this.previousSnapshot = null;
  }
}

/* ============================================================================
 * § 16 — ProjectorUrgencyScorer
 * ============================================================================ */

class ProjectorUrgencyScorer {
  private lastScore: UrgencyScore | null = null;

  /** Determine the escalation band label from a composite urgency score. */
  private resolveEscalationBand(
    composite: number,
  ): 'CALM' | 'BUILDING' | 'ELEVATED' | 'CRITICAL' | 'APEX' {
    if (composite >= 0.90) return 'APEX';
    if (composite >= 0.70) return 'CRITICAL';
    if (composite >= 0.50) return 'ELEVATED';
    if (composite >= 0.25) return 'BUILDING';
    return 'CALM';
  }

  /** Compute the full urgency score for a snapshot + request + timeout triple. */
  public score(
    snapshot: RunStateSnapshot,
    request: TimeSnapshotProjectionRequest,
    timeout: RunTimeoutResolution,
  ): UrgencyScore {
    const tier = snapshot.pressure.tier;
    const phase = request.phase;
    const mode = snapshot.mode;
    const outcome = resolveOutcome(snapshot, timeout, request);
    const budgetFraction = computeBudgetFraction(request.timers);

    // Tier component: pressure tier normalized urgency
    const tierComponent = PRESSURE_TIER_NORMALIZED[tier] ?? 0;

    // Phase component: how high the stakes are right now
    const phaseComponent = clampToUnit(
      RUN_PHASE_STAKES_MULTIPLIER[phase] * MODE_DIFFICULTY_MULTIPLIER[mode] - 0.5,
    );

    // Budget component: exponential urgency near exhaustion
    const budgetComponent = budgetFraction > PROJECTOR_BUDGET_THRESHOLDS.CAUTION_BELOW
      ? clampToUnit((budgetFraction - PROJECTOR_BUDGET_THRESHOLDS.CAUTION_BELOW) / 0.3)
      : 0;

    // Outcome component: unresolved is neutral, loss outcomes add urgency
    const outcomeComponent = outcome !== null && isLossOutcome(outcome) ? 0.8 : 0;

    // Composite
    const composite = clampToUnit(
      tierComponent * PROJECTOR_URGENCY_WEIGHTS.TIER_WEIGHT +
      phaseComponent * PROJECTOR_URGENCY_WEIGHTS.PHASE_WEIGHT +
      budgetComponent * PROJECTOR_URGENCY_WEIGHTS.BUDGET_WEIGHT +
      outcomeComponent * PROJECTOR_URGENCY_WEIGHTS.OUTCOME_WEIGHT,
    );

    const urgencyLabel = PRESSURE_TIER_URGENCY_LABEL[tier];
    const escalationBand = this.resolveEscalationBand(composite);

    // Recommended decision window: shorter under high urgency
    const baseDW = getDecisionWindowDurationMs(tier);
    const recommendedDecisionWindowMs = Math.max(
      DECISION_WINDOW_DURATIONS_MS['T4'],
      Math.round(baseDW * (1 - composite * 0.4)),
    );

    const urgencyScore: UrgencyScore = {
      composite,
      tierComponent,
      phaseComponent,
      budgetComponent,
      outcomeComponent,
      urgencyLabel,
      escalationBand,
      recommendedDecisionWindowMs,
    };

    this.lastScore = urgencyScore;
    return urgencyScore;
  }

  public getLastScore(): UrgencyScore | null {
    return this.lastScore;
  }

  public reset(): void {
    this.lastScore = null;
  }
}

/* ============================================================================
 * § 17 — TimeSnapshotProjector (master class)
 * ============================================================================ */

export class TimeSnapshotProjector {
  private readonly audit: ProjectorAuditTrail;
  private readonly trend: ProjectorTrendAnalyzer;
  private readonly mlExtractor: ProjectorMLExtractor;
  private readonly dlBuilder: ProjectorDLBuilder;
  private readonly chatBridge: ProjectorChatBridge;
  private readonly narrator: ProjectorNarrator;
  private readonly modeAdvisor: ProjectorModeAdvisor;
  private readonly phaseAdvisor: ProjectorPhaseAdvisor;
  private readonly resilienceScorer: ProjectorResilienceScorer;
  private readonly urgencyScorer: ProjectorUrgencyScorer;

  private projectionCount = 0;
  private lastSnapshot: RunStateSnapshot | null = null;
  private lastRequest: TimeSnapshotProjectionRequest | null = null;

  public constructor(
    private readonly timeoutGuard: RunTimeoutGuard = new RunTimeoutGuard(),
    private readonly options: {
      readonly enableML: boolean;
      readonly enableDL: boolean;
      readonly enableChat: boolean;
      readonly enableNarration: boolean;
      readonly enableAudit: boolean;
      readonly enableTrendAnalysis: boolean;
    } = {
      enableML: true,
      enableDL: true,
      enableChat: true,
      enableNarration: true,
      enableAudit: true,
      enableTrendAnalysis: true,
    },
  ) {
    this.audit = new ProjectorAuditTrail();
    this.trend = new ProjectorTrendAnalyzer();
    this.mlExtractor = new ProjectorMLExtractor();
    this.dlBuilder = new ProjectorDLBuilder();
    this.chatBridge = new ProjectorChatBridge();
    this.narrator = new ProjectorNarrator();
    this.modeAdvisor = new ProjectorModeAdvisor();
    this.phaseAdvisor = new ProjectorPhaseAdvisor();
    this.resilienceScorer = new ProjectorResilienceScorer();
    this.urgencyScorer = new ProjectorUrgencyScorer();
  }

  // ────────────────────────────────────────────────────────────
  // CORE PROJECTION — original API preserved exactly
  // ────────────────────────────────────────────────────────────

  public project(
    snapshot: RunStateSnapshot,
    request: TimeSnapshotProjectionRequest,
  ): RunStateSnapshot {
    const timeout = this.timeoutGuard.resolve(snapshot, request.timers.elapsedMs);
    const tags = resolveTags(snapshot, timeout, request);
    const telemetry = resolveTelemetry(snapshot.telemetry, timeout, request);

    // Record in resilience scorer before mutating
    if (this.options.enableTrendAnalysis) {
      this.trend.appendHistory(snapshot);
      this.resilienceScorer.recordSnapshot(snapshot);
    }

    // Audit the projection
    if (this.options.enableAudit) {
      this.audit.record(snapshot, request, timeout);
    }

    // ML extraction
    if (this.options.enableML) {
      this.mlExtractor.extract(snapshot, request, timeout);
    }

    // DL tensor append
    if (this.options.enableDL) {
      this.dlBuilder.appendRow(snapshot, request);
    }

    const next = Object.freeze({
      ...snapshot,
      tick: normalizeTick(request.tick),
      phase: request.phase,
      outcome: resolveOutcome(snapshot, timeout, request),
      timers: request.timers,
      telemetry,
      tags,
    });

    this.projectionCount++;
    this.lastSnapshot = next;
    this.lastRequest = request;

    return next;
  }

  public projectTimeAdvance(
    snapshot: RunStateSnapshot,
    tick: number,
    phase: RunPhase,
    timers: TimerState,
    extra: Omit<TimeSnapshotProjectionRequest, 'tick' | 'phase' | 'timers'> = {},
  ): RunStateSnapshot {
    return this.project(snapshot, { tick, phase, timers, ...extra });
  }

  // ────────────────────────────────────────────────────────────
  // EXTENDED API — analytics, chat, ML/DL, validation
  // ────────────────────────────────────────────────────────────

  /**
   * Project and simultaneously emit a LIVEOPS_SIGNAL chat envelope.
   * Returns both the projected snapshot and the chat signal.
   */
  public projectWithSignal(
    snapshot: RunStateSnapshot,
    request: TimeSnapshotProjectionRequest,
    options: { readonly roomId?: Nullable<ChatRoomId> } = {},
  ): { readonly snapshot: RunStateSnapshot; readonly signal: ProjectorChatSignal } {
    const next = this.project(snapshot, request);
    const timeout = this.timeoutGuard.resolve(snapshot, request.timers.elapsedMs);

    let signal: ProjectorChatSignal | null = null;
    if (this.options.enableChat) {
      const narrative = this.options.enableNarration
        ? this.narrator.narrateProjection(snapshot, request, timeout).headline
        : PRESSURE_TIER_URGENCY_LABEL[snapshot.pressure.tier];
      signal = this.chatBridge.buildSignal(snapshot, request, timeout, {
        roomId: options.roomId ?? null,
        narrative,
      });
    }

    return {
      snapshot: next,
      signal: signal ?? this.chatBridge.buildSignal(snapshot, request, timeout, {}),
    };
  }

  /** Extract the 28-dim ML feature vector from current snapshot + request state. */
  public extractML(
    snapshot: RunStateSnapshot,
    request: TimeSnapshotProjectionRequest,
  ): ProjectorMLOutput {
    const timeout = this.timeoutGuard.resolve(snapshot, request.timers.elapsedMs);
    return this.mlExtractor.extract(snapshot, request, timeout);
  }

  /** Append a DL row without doing a full projection. */
  public appendDLRow(
    snapshot: RunStateSnapshot,
    request: TimeSnapshotProjectionRequest,
  ): void {
    this.dlBuilder.appendRow(snapshot, request);
  }

  /** Get the current 40×6 DL tensor. */
  public getDLTensor(): ProjectorDLOutput {
    return this.dlBuilder.getTensor();
  }

  /** Generate narrative for current state. */
  public narrateCurrentState(
    snapshot: RunStateSnapshot,
    request: TimeSnapshotProjectionRequest,
  ): ProjectorNarrative {
    const timeout = this.timeoutGuard.resolve(snapshot, request.timers.elapsedMs);
    return this.narrator.narrateProjection(snapshot, request, timeout);
  }

  /** Build a standalone chat signal without projecting. */
  public buildChatSignal(
    snapshot: RunStateSnapshot,
    request: TimeSnapshotProjectionRequest,
    options: { readonly roomId?: Nullable<ChatRoomId>; readonly narrative?: string } = {},
  ): ProjectorChatSignal {
    const timeout = this.timeoutGuard.resolve(snapshot, request.timers.elapsedMs);
    return this.chatBridge.buildSignal(snapshot, request, timeout, options);
  }

  /** Get the mode multiplier profile. */
  public getModeProfile(mode: ModeCode): ModeMultipliers {
    return this.modeAdvisor.getMultipliers(mode);
  }

  /** Get the phase profile for the current state. */
  public getPhaseProfile(
    snapshot: RunStateSnapshot,
    request: TimeSnapshotProjectionRequest,
  ): ProjectorPhaseProfile {
    return this.phaseAdvisor.buildProfile(snapshot, request);
  }

  /** Get urgency score for current state. */
  public getUrgencyScore(
    snapshot: RunStateSnapshot,
    request: TimeSnapshotProjectionRequest,
  ): UrgencyScore {
    const timeout = this.timeoutGuard.resolve(snapshot, request.timers.elapsedMs);
    return this.urgencyScorer.score(snapshot, request, timeout);
  }

  /** Get resilience score for current snapshot. */
  public getResilienceScore(snapshot: RunStateSnapshot): ResilienceScore {
    return this.resilienceScorer.score(snapshot);
  }

  /** Get trend analysis from projection history. */
  public getTrendAnalysis(snapshot: RunStateSnapshot): ProjectorTrendAnalysis {
    return this.trend.analyze(snapshot);
  }

  /** Get audit summary. */
  public getAuditSummary(): ProjectorAuditSummary {
    return this.audit.getSummary();
  }

  /** Validate a projection request before applying it. */
  public validate(
    request: TimeSnapshotProjectionRequest,
    snapshot: RunStateSnapshot,
  ): ProjectionValidationResult {
    return validateProjectionRequest(request, snapshot);
  }

  /** Get the last projected snapshot. */
  public getLastSnapshot(): RunStateSnapshot | null {
    return this.lastSnapshot;
  }

  /** Get the last projection request. */
  public getLastRequest(): TimeSnapshotProjectionRequest | null {
    return this.lastRequest;
  }

  /** Get total number of projections performed. */
  public getProjectionCount(): number {
    return this.projectionCount;
  }

  /** Get last chat signal emitted. */
  public getLastChatSignal(): ProjectorChatSignal | null {
    return this.chatBridge.getLastSignal();
  }

  /** Get last ML output. */
  public getLastMLOutput(): ProjectorMLOutput | null {
    return this.mlExtractor.getLastOutput();
  }

  /** Get last urgency score. */
  public getLastUrgencyScore(): UrgencyScore | null {
    return this.urgencyScorer.getLastScore();
  }

  /** Get last narrator output. */
  public getLastNarrative(): ProjectorNarrative | null {
    return this.narrator.getLastNarrative();
  }

  /** Check if DL tensor is fully warmed up (40 rows filled). */
  public isDLWarm(): boolean {
    return this.dlBuilder.isFull();
  }

  /** Get a column slice from the DL ring buffer. */
  public getDLColumnSlice(colIndex: number): Float32Array {
    return this.dlBuilder.getColumnSlice(colIndex);
  }

  /** Get a specific ML feature value by label from last output. */
  public getMLFeature(label: string): number | null {
    const last = this.mlExtractor.getLastOutput();
    if (last === null) return null;
    return this.mlExtractor.getFeatureByLabel(last, label);
  }

  /** Get mode advisor for direct access. */
  public getModeAdvisor(): ProjectorModeAdvisor {
    return this.modeAdvisor;
  }

  /** Get phase advisor for direct access. */
  public getPhaseAdvisor(): ProjectorPhaseAdvisor {
    return this.phaseAdvisor;
  }

  /** Build an interpolation plan between two pressure tiers. */
  public buildTierInterpolationPlan(
    fromTier: PressureTier,
    toTier: PressureTier,
  ): TickInterpolationPlan {
    return this.phaseAdvisor.buildInterpolationPlan(fromTier, toTier);
  }

  /** Estimate tick count to interpolate between tiers. */
  public estimateTierInterpolationTicks(fromTier: PressureTier, toTier: PressureTier): number {
    return this.phaseAdvisor.estimateInterpolationTicks(fromTier, toTier);
  }

  /** Get tick tier config for a pressure tier. */
  public getTickTierConfig(pressureTier: PressureTier): TickTierConfig {
    return getTickTierConfig(TICK_TIER_BY_PRESSURE_TIER[pressureTier]);
  }

  /** Convert pressure tier to tick tier. */
  public toTickTier(pressureTier: PressureTier): TickTier {
    return pressureTierToTickTier(pressureTier);
  }

  /** Convert tick tier back to pressure tier. */
  public toPressureTier(tickTier: TickTier): PressureTier {
    return tickTierToPressureTier(tickTier);
  }

  /** Export a full analytics bundle for external systems. */
  public exportBundle(snapshot: RunStateSnapshot): ProjectorExportBundle {
    const request = this.lastRequest;
    const auditSummary = this.audit.getSummary();

    const latestTrendAnalysis = request !== null
      ? this.trend.analyze(snapshot)
      : null;

    const latestMLOutput = this.mlExtractor.getLastOutput();
    const latestDLOutput = this.dlBuilder.getRowCount() > 0
      ? this.dlBuilder.getTensor()
      : null;

    const latestNarrative = this.narrator.getLastNarrative();
    const latestUrgency = this.urgencyScorer.getLastScore();
    const latestResilience = request !== null
      ? this.resilienceScorer.score(snapshot)
      : null;

    return Object.freeze({
      version: PROJECTOR_VERSION,
      exportedAtMs: Date.now(),
      runId: snapshot.runId,
      mode: snapshot.mode,
      auditSummary,
      latestTrendAnalysis,
      latestMLOutput,
      latestDLOutput,
      latestNarrative,
      latestUrgency,
      latestResilience,
      projectionCount: this.projectionCount,
    });
  }

  /** Reset all subsystems for a new run. */
  public reset(): void {
    this.audit.clear();
    this.trend.reset();
    this.mlExtractor.reset();
    this.dlBuilder.reset();
    this.chatBridge.reset();
    this.narrator.reset();
    this.resilienceScorer.reset();
    this.urgencyScorer.reset();
    this.projectionCount = 0;
    this.lastSnapshot = null;
    this.lastRequest = null;
  }

  /** Get a human-readable health report. */
  public getHealthReport(): string {
    const summary = this.audit.getSummary();
    const dlRows = this.dlBuilder.getRowCount();
    const chatEmits = this.chatBridge.getEmitCount();
    return (
      `TimeSnapshotProjector v${PROJECTOR_VERSION}\n` +
      `  Projections: ${this.projectionCount}\n` +
      `  Win/Loss: ${summary.winCount}/${summary.lossCount}\n` +
      `  Timeouts: ${summary.timeoutCount}\n` +
      `  DL rows: ${dlRows}/${PROJECTOR_DL_ROWS}\n` +
      `  Chat signals: ${chatEmits}\n` +
      `  Avg budget fraction: ${(summary.avgBudgetFraction * 100).toFixed(1)}%\n`
    );
  }
}

/* ============================================================================
 * § 18 — FACTORY FUNCTIONS
 * ============================================================================ */

/** Create a standard projector with all analytics enabled. */
export function createTimeSnapshotProjector(
  timeoutGuard?: RunTimeoutGuard,
): TimeSnapshotProjector {
  return new TimeSnapshotProjector(
    timeoutGuard ?? new RunTimeoutGuard(),
    {
      enableML: true,
      enableDL: true,
      enableChat: true,
      enableNarration: true,
      enableAudit: true,
      enableTrendAnalysis: true,
    },
  );
}

/** Create a full analytics projector — all subsystems on, maximum observability. */
export function createFullAnalyticsProjector(
  timeoutGuard?: RunTimeoutGuard,
): TimeSnapshotProjector {
  return new TimeSnapshotProjector(
    timeoutGuard ?? new RunTimeoutGuard(),
    {
      enableML: true,
      enableDL: true,
      enableChat: true,
      enableNarration: true,
      enableAudit: true,
      enableTrendAnalysis: true,
    },
  );
}

/** Create a chat-bridge projector — ML/DL disabled, chat fully enabled for low-latency paths. */
export function createChatBridgeProjector(
  timeoutGuard?: RunTimeoutGuard,
): TimeSnapshotProjector {
  return new TimeSnapshotProjector(
    timeoutGuard ?? new RunTimeoutGuard(),
    {
      enableML: false,
      enableDL: false,
      enableChat: true,
      enableNarration: true,
      enableAudit: true,
      enableTrendAnalysis: false,
    },
  );
}

/** Create a lightweight projector — minimal overhead for hot paths. */
export function createLightweightProjector(
  timeoutGuard?: RunTimeoutGuard,
): TimeSnapshotProjector {
  return new TimeSnapshotProjector(
    timeoutGuard ?? new RunTimeoutGuard(),
    {
      enableML: false,
      enableDL: false,
      enableChat: false,
      enableNarration: false,
      enableAudit: false,
      enableTrendAnalysis: false,
    },
  );
}

/* ============================================================================
 * § 19 — PURE HELPER EXPORTS
 * ============================================================================ */

/**
 * Compute a normalized budget utilization score (0=fresh, 1=exhausted).
 * Pure function — no side effects.
 */
export function computeSnapshotBudgetUtilization(timers: TimerState): number {
  return computeBudgetFraction(timers);
}

/**
 * Determine budget criticality class from timer state.
 */
export function classifySnapshotBudgetCriticality(
  timers: TimerState,
): 'SAFE' | 'CAUTION' | 'WARNING' | 'CRITICAL' | 'EXHAUSTED' {
  const fraction = computeBudgetFraction(timers);
  if (fraction >= PROJECTOR_BUDGET_THRESHOLDS.EXHAUSTED_AT) return 'EXHAUSTED';
  if (fraction >= PROJECTOR_BUDGET_THRESHOLDS.CRITICAL_BELOW) return 'CRITICAL';
  if (fraction >= PROJECTOR_BUDGET_THRESHOLDS.WARNING_BELOW) return 'WARNING';
  if (fraction >= PROJECTOR_BUDGET_THRESHOLDS.CAUTION_BELOW) return 'CAUTION';
  return 'SAFE';
}

/**
 * Check whether a projection request would result in a phase transition.
 */
export function wouldCrossPhase(snapshot: RunStateSnapshot, request: TimeSnapshotProjectionRequest): boolean {
  return isPhaseBoundaryTransition(snapshot.timers.elapsedMs, request.timers.elapsedMs);
}

/**
 * Compute the effective tick duration from a pressure tier and timer state.
 * Uses clampTickDurationMs to enforce tier boundaries.
 */
export function resolveEffectiveTickDuration(
  tier: PressureTier,
  timers: TimerState,
): number {
  return normalizeTickDurationMs(tier, timers.currentTickDurationMs);
}

/**
 * Get the recommended decision window duration for a pressure tier.
 */
export function resolveDecisionWindowMs(tier: PressureTier): number {
  return getDecisionWindowDurationMs(tier);
}

/**
 * Determine whether a hold charge can be used given mode and current state.
 */
export function canUseHoldCharge(mode: ModeCode, timers: TimerState): boolean {
  const cap = PROJECTOR_HOLD_CAP_BY_MODE[mode];
  return cap > 0 && timers.holdCharges > 0;
}

/**
 * Compute how many ms a hold would freeze a decision window by default.
 */
export function getDefaultHoldDurationMs(): number {
  return DEFAULT_HOLD_DURATION_MS;
}

/**
 * Get the pressure tier that corresponds to a given TickTier.
 */
export function resolvePressureTierFromTickTier(tickTier: TickTier): PressureTier {
  return PRESSURE_TIER_BY_TICK_TIER[tickTier];
}

/**
 * Get the TickTier that corresponds to a given PressureTier.
 */
export function resolveTickTierFromPressureTier(pressureTier: PressureTier): TickTier {
  return TICK_TIER_BY_PRESSURE_TIER[pressureTier];
}

/**
 * Get all valid run outcomes.
 */
export function getProjectorRunOutcomes(): readonly RunOutcome[] {
  return RUN_OUTCOMES;
}

/**
 * Get all valid pressure tiers.
 */
export function getProjectorPressureTiers(): readonly PressureTier[] {
  return PRESSURE_TIERS;
}

/**
 * Validate a complete projection request, snapshot, and timer combination.
 * Returns a flat list of all issues found.
 */
export function auditProjectionRequest(
  request: TimeSnapshotProjectionRequest,
  snapshot: RunStateSnapshot,
): readonly string[] {
  const result = validateProjectionRequest(request, snapshot);
  return [...result.errors, ...result.warnings.map((w) => `WARN:${w}`)];
}

/**
 * Compute a composite risk score from snapshot state (0=safe, 1=critical).
 */
export function computeSnapshotRiskScore(snapshot: RunStateSnapshot): number {
  const pressureRisk = assessPressureContext(snapshot.pressure);
  const shieldRisk = computeWeightedShieldVulnerability(snapshot.shield);
  const economyRisk = 1 - computeEconomyHealthScore(snapshot.economy);
  const battleRisk = assessBattleLoad(snapshot.battle);
  return clampToUnit(
    pressureRisk * 0.35 +
    shieldRisk * 0.25 +
    economyRisk * 0.25 +
    battleRisk * 0.15,
  );
}

/**
 * Summarize snapshot state into a short label string for logging/debugging.
 */
export function snapshotLabel(snapshot: RunStateSnapshot): string {
  return (
    `[T${snapshot.tick} · ${snapshot.phase} · ${snapshot.pressure.tier} ` +
    `· ${snapshot.mode} · ${snapshot.outcome ?? 'active'}]`
  );
}

/**
 * Get the pressure tier urgency label.
 */
export function getPressureUrgencyLabel(tier: PressureTier): string {
  return PRESSURE_TIER_URGENCY_LABEL[tier];
}

/**
 * Whether the projector should emit a warning given the current urgency band.
 */
export function shouldEmitUrgencyWarning(tier: PressureTier, budgetFraction: number): boolean {
  const tierScore = PRESSURE_TIER_NORMALIZED[tier] ?? 0;
  const composite = tierScore * 0.6 + budgetFraction * 0.4;
  return composite >= 0.5;
}

/**
 * Check if the given outcome is in the canonical RUN_OUTCOMES set.
 */
export function isValidRunOutcome(value: unknown): value is RunOutcome {
  return isRunOutcome(value);
}

/**
 * Check if the given pressure tier string is valid.
 */
export function isProjectorPressureTier(value: unknown): value is PressureTier {
  return isPressureTier(value);
}

/* ============================================================================
 * § 20 — MODULE MANIFEST
 * ============================================================================ */

export interface TimeSnapshotProjectorVersion {
  readonly namespace: 'backend.time.projector';
  readonly version: '4.0.0';
  readonly featureFlags: {
    readonly mlFeatureExtraction: boolean;
    readonly dlTensorProjection: boolean;
    readonly chatBridgeEnabled: boolean;
    readonly auditTrailEnabled: boolean;
    readonly trendAnalysisEnabled: boolean;
    readonly resilienceScoringEnabled: boolean;
    readonly urgencyScoringEnabled: boolean;
    readonly modeAdvisorEnabled: boolean;
    readonly phaseAdvisorEnabled: boolean;
    readonly narrationEnabled: boolean;
  };
}

export const TIME_SNAPSHOT_PROJECTOR_VERSION: TimeSnapshotProjectorVersion = Object.freeze({
  namespace: 'backend.time.projector',
  version: '4.0.0',
  featureFlags: Object.freeze({
    mlFeatureExtraction: true,
    dlTensorProjection: true,
    chatBridgeEnabled: true,
    auditTrailEnabled: true,
    trendAnalysisEnabled: true,
    resilienceScoringEnabled: true,
    urgencyScoringEnabled: true,
    modeAdvisorEnabled: true,
    phaseAdvisorEnabled: true,
    narrationEnabled: true,
  }),
} as const);

export const TIME_SNAPSHOT_PROJECTOR_READY = true as const;
export const TIME_SNAPSHOT_PROJECTOR_ML_DIM = PROJECTOR_ML_DIM;
export const TIME_SNAPSHOT_PROJECTOR_DL_ROWS = PROJECTOR_DL_ROWS;
export const TIME_SNAPSHOT_PROJECTOR_DL_COLS = PROJECTOR_DL_COLS;
