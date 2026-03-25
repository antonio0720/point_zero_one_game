/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/core/EngineRuntime.ts
 *
 * Doctrine:
 * - backend is the authoritative simulation runtime
 * - engines tick in deterministic order
 * - cards are backend-validated against open timing windows
 * - run state, tick checksums, and proof hashes are backend-owned
 * - snapshots are immutable at the runtime boundary
 * - mutations happen only against an internal writable draft
 * - STEP_02_TIME owns authoritative time advancement; core only orchestrates
 * - ML signals (urgency, cascade risk, economy health) are produced every tick
 * - DL input vectors are deterministically computed for downstream tensor routing
 */

import type {
  CardDefinition,
  CardInstance,
  EffectPayload,
  EngineEventMap,
  Targeting,
  TimingClass,
} from './GamePrimitives';
import type { RunStateSnapshot } from './RunStateSnapshot';
import type { TickStep } from './TickSequence';
import type {
  TickContext,
  EngineId,
  EngineSignal,
  SimulationEngine,
} from './EngineContracts';
import type { RunFactoryInput } from './RunStateFactory';

import { DeterministicClock } from './ClockSource';
import {
  cloneJson,
  createDeterministicId,
  deepFreeze,
  checksumSnapshot,
} from './Deterministic';
import { normalizeEngineTickResult } from './EngineContracts';
import { EngineRegistry } from './EngineRegistry';
import { EventBus } from './EventBus';
import { createInitialRunState } from './RunStateFactory';
import { TICK_SEQUENCE } from './TickSequence';
import { DecisionWindowService } from './DecisionWindowService';
import {
  CardOverlayResolver,
  type ResourceType,
} from './CardOverlayResolver';
import {
  DEFAULT_PHASE_TRANSITION_WINDOWS,
  TIER_DURATIONS_MS,
  resolvePhaseFromElapsedMs,
} from '../time/types';

// ---------------------------------------------------------------------------
// Public interface shapes
// ---------------------------------------------------------------------------

export interface RuntimeEventEnvelope<
  K extends keyof EngineEventMap = keyof EngineEventMap,
> {
  event: K;
  payload: EngineEventMap[K];
}

export interface RuntimeTickResult {
  snapshot: RunStateSnapshot;
  checksum: string;
  events: Array<RuntimeEventEnvelope>;
  mlSummary: RuntimeTickMLSummary;
  dlPacket: RuntimeDLPacket;
}

export interface DrawCardResult {
  accepted: boolean;
  snapshot: RunStateSnapshot;
  instance: CardInstance | null;
  reasons: string[];
}

export interface PlayCardRequest {
  actorId: string;
  cardInstanceId: string;
  requestedTimingClass?: TimingClass;
}

export interface PlayCardResult {
  accepted: boolean;
  snapshot: RunStateSnapshot;
  playedCard: CardInstance | null;
  chosenTimingClass: TimingClass | null;
  reasons: string[];
  mlImpact: RuntimePlayMLImpact;
}

// ---------------------------------------------------------------------------
// ML / DL types — runtime-native
// ---------------------------------------------------------------------------

/** Per-tick ML scoring for downstream chat and analytics. */
export interface RuntimeTickMLSummary {
  readonly tick: number;
  readonly phase: RunStateSnapshot['phase'];
  readonly tier: RunStateSnapshot['pressure']['tier'];
  readonly mode: RunStateSnapshot['mode'];
  readonly urgencyScore: number;
  readonly cascadeRiskScore: number;
  readonly economyHealthScore: number;
  readonly shieldHealthScore: number;
  readonly sovereigntyAlignmentScore: number;
  readonly compositeRiskScore: number;
  readonly recommendedAction: 'HOLD' | 'PLAY_CARD' | 'EXTEND_WINDOW' | 'ACCELERATE' | 'DEFEND';
  readonly mlContextVector: readonly number[];
  readonly dlInputVector: readonly number[];
}

/** DL routing packet — 24-feature normalized input tensor. */
export interface RuntimeDLPacket {
  readonly runId: string;
  readonly tick: number;
  readonly tensorShape: readonly [number, number];
  readonly inputVector: readonly number[];
  readonly featureLabels: readonly string[];
  readonly emittedAtMs: number;
}

/** ML impact of a card play — delta on each scoring dimension. */
export interface RuntimePlayMLImpact {
  readonly urgencyShift: number;
  readonly cascadeRiskShift: number;
  readonly economyHealthShift: number;
  readonly shieldHealthShift: number;
  readonly compositeRiskShift: number;
  readonly dominantImpactDimension: string;
}

/** Predictive analysis for the next tick without executing it. */
export interface RuntimeTickPrediction {
  readonly tick: number;
  readonly predictedPhase: RunStateSnapshot['phase'];
  readonly predictedTier: RunStateSnapshot['pressure']['tier'];
  readonly predictedOutcome: RunStateSnapshot['outcome'];
  readonly predictedElapsedMs: number;
  readonly predictedCash: number;
  readonly predictedNetWorth: number;
  readonly forecastConfidence: number;
  readonly warningFlags: readonly string[];
}

/** Full run analytics — computed on demand. */
export interface RuntimeRunAnalytics {
  readonly runId: string;
  readonly mode: RunStateSnapshot['mode'];
  readonly totalTicks: number;
  readonly outcome: RunStateSnapshot['outcome'];
  readonly totalElapsedMs: number;
  readonly avgTickDurationMs: number;
  readonly finalNetWorth: number;
  readonly finalCash: number;
  readonly finalShieldRatio: number;
  readonly sovereigntyScore: number;
  readonly verifiedGrade: string;
  readonly proofHash: string | null;
  readonly decisionsAccepted: number;
  readonly decisionsRejected: number;
  readonly avgDecisionLatencyMs: number;
  readonly peakUrgency: number;
  readonly peakCascadeRisk: number;
  readonly avgCompositeRisk: number;
  readonly tierCrossingCount: number;
  readonly phaseTransitionCount: number;
  readonly warningCount: number;
  readonly mlSummaries: readonly RuntimeTickMLSummary[];
}

/** Lightweight health snapshot — safe to call at any time. */
export interface RuntimeHealthSnapshot {
  readonly hasActiveRun: boolean;
  readonly currentTick: number | null;
  readonly currentPhase: RunStateSnapshot['phase'] | null;
  readonly currentTier: RunStateSnapshot['pressure']['tier'] | null;
  readonly registeredEngineCount: number;
  readonly busEventCount: number;
  readonly warningCount: number;
  readonly outcome: RunStateSnapshot['outcome'];
}

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

const STEP_TO_ENGINE: Partial<Record<TickStep, EngineId>> = {
  STEP_02_TIME: 'time',
  STEP_03_PRESSURE: 'pressure',
  STEP_04_TENSION: 'tension',
  STEP_05_BATTLE: 'battle',
  STEP_06_SHIELD: 'shield',
  STEP_07_CASCADE: 'cascade',
  STEP_10_SOVEREIGNTY_SNAPSHOT: 'sovereignty',
};

/** Tier numeric weights for ML vectors. */
const TIER_ML_WEIGHT: Record<string, number> = {
  T0: 0.0,
  T1: 0.25,
  T2: 0.5,
  T3: 0.75,
  T4: 1.0,
};

/** Phase numeric weights for ML vectors. */
const PHASE_ML_WEIGHT: Record<string, number> = {
  FOUNDATION: 0.0,
  ESCALATION: 0.5,
  SOVEREIGNTY: 1.0,
};

/** 24-feature DL input vector labels. */
const RT_DL_FEATURE_LABELS: readonly string[] = Object.freeze([
  'tier_weight',
  'phase_weight',
  'cash_normalized',
  'net_worth_normalized',
  'income_rate',
  'expense_rate',
  'economy_health',
  'shield_ratio',
  'weakest_layer_ratio',
  'breach_count_normalized',
  'tension_score',
  'anticipation',
  'visible_threats',
  'cascade_active_chains',
  'cascade_broken_ratio',
  'battle_budget_normalized',
  'hand_size_normalized',
  'discard_ratio',
  'elapsed_ratio',
  'hold_charges_normalized',
  'gap_vs_legend',
  'gap_closing_rate',
  'sovereignty_score',
  'decisions_accepted_ratio',
] as const);

const RT_DL_TENSOR_SHAPE: readonly [number, number] = Object.freeze([1, 24] as const);

// ---------------------------------------------------------------------------
// Internal type aliases
// ---------------------------------------------------------------------------

type Primitive =
  | string
  | number
  | boolean
  | bigint
  | symbol
  | null
  | undefined;

type MutableDeep<T> = T extends Primitive
  ? T
  : T extends (...args: never[]) => unknown
    ? T
    : T extends ReadonlyArray<infer U>
      ? MutableDeep<U>[]
      : T extends object
        ? { -readonly [K in keyof T]: MutableDeep<T[K]> }
        : T;

type MutableRunStateSnapshot = MutableDeep<RunStateSnapshot>;

// ---------------------------------------------------------------------------
// Pure helper functions
// ---------------------------------------------------------------------------

function toMutableSnapshot(snapshot: RunStateSnapshot): MutableRunStateSnapshot {
  return cloneJson(snapshot) as MutableRunStateSnapshot;
}

function toFrozenSnapshot(
  snapshot: MutableRunStateSnapshot | RunStateSnapshot,
): RunStateSnapshot {
  return deepFreeze(snapshot as RunStateSnapshot) as RunStateSnapshot;
}

function latestThree(values: readonly string[]): string[] {
  return values.slice(Math.max(0, values.length - 3));
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundThousandths(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function roundTo4(v: number): number {
  return Math.round(v * 10000) / 10000;
}

function resolveSafeTickDurationMs(snapshot: RunStateSnapshot): number {
  const configured = Number(snapshot.timers.currentTickDurationMs);

  if (Number.isFinite(configured) && configured > 0) {
    return Math.trunc(configured);
  }

  const fallback = TIER_DURATIONS_MS[snapshot.pressure.tier];

  if (Number.isFinite(fallback) && fallback > 0) {
    return Math.trunc(fallback);
  }

  return 8_000;
}

function recomputeNetWorth(snapshot: RunStateSnapshot): number {
  const shieldValue = snapshot.shield.layers.reduce(
    (sum, layer) => sum + layer.current,
    0,
  );

  const recurring = Math.max(
    0,
    (snapshot.economy.incomePerTick - snapshot.economy.expensesPerTick) * 12,
  );

  return roundMoney(
    snapshot.economy.cash - snapshot.economy.debt + recurring + shieldValue,
  );
}

function weakestLayerId(
  snapshot: RunStateSnapshot,
): RunStateSnapshot['shield']['weakestLayerId'] {
  return snapshot.shield.layers
    .slice()
    .sort((a, b) => a.current - b.current)[0]?.layerId ?? 'L1';
}

function computeTickChecksum(snapshot: RunStateSnapshot): string {
  const windows = Object.values(snapshot.timers.activeDecisionWindows ?? {})
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((window) => ({
      id: window.id,
      timingClass: window.timingClass,
      closesAtTick: window.closesAtTick,
      closesAtMs: window.closesAtMs,
      consumed: window.consumed,
      frozen: window.frozen,
    }));

  return checksumSnapshot({
    runId: snapshot.runId,
    tick: snapshot.tick,
    phase: snapshot.phase,
    outcome: snapshot.outcome,
    economy: snapshot.economy,
    pressure: snapshot.pressure,
    tension: {
      score: snapshot.tension.score,
      anticipation: snapshot.tension.anticipation,
      visibleThreats: snapshot.tension.visibleThreats.map((threat) => ({
        threatId: threat.threatId,
        etaTicks: threat.etaTicks,
        severity: threat.severity,
      })),
    },
    shield: snapshot.shield,
    battle: {
      battleBudget: snapshot.battle.battleBudget,
      extractionCooldownTicks: snapshot.battle.extractionCooldownTicks,
      pendingAttacks: snapshot.battle.pendingAttacks.map((attack) => ({
        attackId: attack.attackId,
        category: attack.category,
        magnitude: attack.magnitude,
      })),
    },
    cascade: {
      activeChains: snapshot.cascade.activeChains.map((chain) => ({
        chainId: chain.chainId,
        status: chain.status,
        createdAtTick: chain.createdAtTick,
      })),
      completedChains: snapshot.cascade.completedChains,
      brokenChains: snapshot.cascade.brokenChains,
    },
    sovereignty: {
      integrityStatus: snapshot.sovereignty.integrityStatus,
      gapVsLegend: snapshot.sovereignty.gapVsLegend,
      gapClosingRate: snapshot.sovereignty.gapClosingRate,
    },
    cards: {
      hand: snapshot.cards.hand.map((card) => card.instanceId),
      discardSize: snapshot.cards.discard.length,
      exhaustSize: snapshot.cards.exhaust.length,
      lastPlayed: snapshot.cards.lastPlayed,
    },
    timers: {
      elapsedMs: snapshot.timers.elapsedMs,
      currentTickDurationMs: snapshot.timers.currentTickDurationMs,
      holdCharges: snapshot.timers.holdCharges,
      windows,
    },
  });
}

function computeProofHash(snapshot: RunStateSnapshot): string {
  return checksumSnapshot({
    seed: snapshot.seed,
    tickStreamChecksum: snapshot.sovereignty.tickChecksums.join('|'),
    outcome: snapshot.outcome,
    finalNetWorth: snapshot.economy.netWorth,
    userId: snapshot.userId,
  });
}

function determineOutcome(
  snapshot: RunStateSnapshot,
): RunStateSnapshot['outcome'] {
  if (snapshot.economy.netWorth >= snapshot.economy.freedomTarget) {
    return 'FREEDOM';
  }

  if (snapshot.economy.cash < 0) {
    return 'BANKRUPT';
  }

  const totalBudgetMs =
    snapshot.timers.seasonBudgetMs + snapshot.timers.extensionBudgetMs;

  if (snapshot.timers.elapsedMs >= totalBudgetMs) {
    return 'TIMEOUT';
  }

  return null;
}

function gradeForScore(score: number, bleedMode: boolean): string {
  if (bleedMode && score >= 1.5) {
    return 'S';
  }

  if (score >= 1.2) {
    return 'A';
  }

  if (score >= 0.9) {
    return 'B';
  }

  if (score >= 0.6) {
    return 'C';
  }

  if (score >= 0.3) {
    return 'D';
  }

  return 'F';
}

function estimateSovereigntyScore(snapshot: RunStateSnapshot): number {
  const outcomeMultiplier =
    snapshot.outcome === 'FREEDOM'
      ? 1.5
      : snapshot.outcome === 'TIMEOUT'
        ? 0.8
        : snapshot.outcome === 'BANKRUPT'
          ? 0.4
          : 0;

  const shieldMax = snapshot.shield.layers.reduce(
    (sum, layer) => sum + layer.max,
    0,
  );
  const shieldCurrent = snapshot.shield.layers.reduce(
    (sum, layer) => sum + layer.current,
    0,
  );

  const shieldPct = shieldMax === 0 ? 0 : shieldCurrent / shieldMax;
  const decisions = snapshot.telemetry.decisions;
  const acceptedDecisions = decisions.filter((decision) => decision.accepted);
  const avgDecisionLatency =
    acceptedDecisions.length === 0
      ? resolveSafeTickDurationMs(snapshot)
      : acceptedDecisions.reduce((sum, decision) => sum + decision.latencyMs, 0) /
        acceptedDecisions.length;

  const decisionSpeedScore = Math.max(
    0,
    1 - avgDecisionLatency / Math.max(1, resolveSafeTickDurationMs(snapshot)),
  );

  const blocked = snapshot.shield.blockedThisRun;
  const totalSabotageExposure = blocked + snapshot.shield.breachesThisRun;
  const sabotageBlockedPct =
    totalSabotageExposure === 0 ? 1 : blocked / totalSabotageExposure;

  const cascadeInterceptScore =
    snapshot.cascade.completedChains + snapshot.cascade.brokenChains === 0
      ? 1
      : snapshot.cascade.brokenChains /
        (snapshot.cascade.completedChains + snapshot.cascade.brokenChains);

  const pressureSurvivedScore =
    snapshot.pressure.upwardCrossings === 0
      ? 1
      : Math.min(
          1,
          snapshot.pressure.survivedHighPressureTicks /
            Math.max(1, snapshot.pressure.upwardCrossings * 10),
        );

  const base =
    decisionSpeedScore * 0.25 +
    shieldPct * 0.2 +
    sabotageBlockedPct * 0.2 +
    cascadeInterceptScore * 0.2 +
    pressureSurvivedScore * 0.15;

  let score = base * outcomeMultiplier;

  if (
    snapshot.mode === 'solo' &&
    decisions.filter((decision) => decision.latencyMs < 2_000).length >= 3
  ) {
    score += 0.4;
  }

  if (snapshot.mode === 'solo' && snapshot.timers.holdCharges === 1) {
    score += 0.25;
  }

  if (snapshot.mode === 'pvp' && snapshot.battle.firstBloodClaimed) {
    score += 0.15;
  }

  if (
    snapshot.mode === 'coop' &&
    Object.keys(snapshot.modeState.roleAssignments).length >= 4
  ) {
    score += 0.1;
  }

  if (snapshot.mode === 'ghost' && snapshot.sovereignty.gapVsLegend > 0.2) {
    score += 0.2;
  }

  if (snapshot.modeState.bleedMode && snapshot.outcome === 'FREEDOM') {
    score += 0.8;
  }

  return roundThousandths(score);
}

// ---------------------------------------------------------------------------
// ML scoring functions — pure, no side effects
// ---------------------------------------------------------------------------

/** Compute shield health ratio across all layers [0, 1]. */
function rtComputeShieldRatio(snapshot: RunStateSnapshot): number {
  const totalMax = snapshot.shield.layers.reduce((sum, l) => sum + l.max, 0);
  if (totalMax === 0) return 1;
  const totalCurrent = snapshot.shield.layers.reduce((sum, l) => sum + l.current, 0);
  return clamp01(totalCurrent / totalMax);
}

/** Compute economy health score [0, 1]. */
function rtComputeEconomyHealth(snapshot: RunStateSnapshot): number {
  const cashToTarget = snapshot.economy.freedomTarget > 0
    ? clamp01(snapshot.economy.netWorth / snapshot.economy.freedomTarget)
    : 0.5;
  const incomeExpenseRatio = snapshot.economy.expensesPerTick > 0
    ? clamp01(snapshot.economy.incomePerTick / (snapshot.economy.expensesPerTick * 2))
    : snapshot.economy.incomePerTick > 0 ? 1 : 0.5;
  const cashSolvency = snapshot.economy.cash > 0
    ? clamp01(snapshot.economy.cash / Math.max(1, snapshot.economy.freedomTarget * 0.1))
    : 0;
  return roundTo4(cashToTarget * 0.5 + incomeExpenseRatio * 0.3 + cashSolvency * 0.2);
}

/** Compute cascade risk score [0, 1]. */
function rtComputeCascadeRisk(snapshot: RunStateSnapshot): number {
  const activeCount = snapshot.cascade.activeChains.length;
  const totalResolved = snapshot.cascade.brokenChains + snapshot.cascade.completedChains;
  const chainPressure = clamp01(activeCount / 5);
  const breakRate = totalResolved === 0 ? 0 : clamp01(snapshot.cascade.brokenChains / totalResolved);
  return roundTo4(chainPressure * 0.7 + breakRate * 0.3);
}

/** Compute urgency score [0, 1]. */
function rtComputeUrgency(snapshot: RunStateSnapshot): number {
  const tierWeight = TIER_ML_WEIGHT[snapshot.pressure.tier] ?? 0;
  const totalBudget = Math.max(1, snapshot.timers.seasonBudgetMs + snapshot.timers.extensionBudgetMs);
  const elapsedRatio = clamp01(snapshot.timers.elapsedMs / totalBudget);
  const threatWeight = clamp01(snapshot.tension.visibleThreats.length / 5);
  const anticipation = clamp01(snapshot.tension.anticipation / 100);
  return roundTo4(tierWeight * 0.35 + elapsedRatio * 0.3 + threatWeight * 0.2 + anticipation * 0.15);
}

/** Compute sovereignty alignment score [0, 1]. */
function rtComputeSovereigntyAlignment(snapshot: RunStateSnapshot): number {
  const gap = clamp01(Math.abs(snapshot.sovereignty.gapVsLegend));
  const alignment = clamp01(1 - gap);
  const integrityBonus = snapshot.sovereignty.integrityStatus === 'VERIFIED' ? 0.1 : 0;
  const quarantinePenalty = snapshot.sovereignty.integrityStatus === 'QUARANTINED' ? -0.2 : 0;
  return clamp01(roundTo4(alignment + integrityBonus + quarantinePenalty));
}

/** Compute composite risk score [0, 1] — primary ML routing signal. */
function rtComputeCompositeRisk(
  urgency: number,
  cascadeRisk: number,
  economyHealth: number,
  shieldRatio: number,
): number {
  const economyRisk = 1 - economyHealth;
  const shieldRisk = 1 - shieldRatio;
  return roundTo4(urgency * 0.3 + cascadeRisk * 0.25 + economyRisk * 0.25 + shieldRisk * 0.2);
}

/** Recommend action based on ML scoring context. */
function rtRecommendAction(
  urgency: number,
  cascadeRisk: number,
  shieldRatio: number,
  compositeRisk: number,
): RuntimeTickMLSummary['recommendedAction'] {
  if (shieldRatio < 0.3) return 'DEFEND';
  if (urgency >= 0.75) return 'ACCELERATE';
  if (urgency >= 0.6) return 'EXTEND_WINDOW';
  if (compositeRisk >= 0.35 || cascadeRisk > 0.5) return 'PLAY_CARD';
  return 'HOLD';
}

/** Build 24-feature DL input vector from snapshot. */
function rtBuildDLInputVector(snapshot: RunStateSnapshot): readonly number[] {
  const totalBudget = Math.max(1, snapshot.timers.seasonBudgetMs + snapshot.timers.extensionBudgetMs);
  const shieldMax = snapshot.shield.layers.reduce((sum, l) => sum + l.max, 0);
  const shieldCurrent = snapshot.shield.layers.reduce((sum, l) => sum + l.current, 0);
  const weakestLayer = [...snapshot.shield.layers].sort((a, b) => a.current - b.current)[0];
  const totalResolved = snapshot.cascade.brokenChains + snapshot.cascade.completedChains;
  const acceptedDecisions = snapshot.telemetry.decisions.filter((d) => d.accepted).length;
  const totalDecisions = snapshot.telemetry.decisions.length;
  const totalCardsSeen = snapshot.cards.drawPileSize + snapshot.cards.discard.length + snapshot.cards.hand.length;

  return Object.freeze([
    TIER_ML_WEIGHT[snapshot.pressure.tier] ?? 0,
    PHASE_ML_WEIGHT[snapshot.phase] ?? 0,
    clamp01(snapshot.economy.cash / Math.max(1, snapshot.economy.freedomTarget)),
    clamp01(snapshot.economy.netWorth / Math.max(1, snapshot.economy.freedomTarget)),
    clamp01(snapshot.economy.incomePerTick / Math.max(1, snapshot.economy.freedomTarget * 0.01)),
    clamp01(snapshot.economy.expensesPerTick / Math.max(1, snapshot.economy.freedomTarget * 0.01)),
    rtComputeEconomyHealth(snapshot),
    shieldMax === 0 ? 1 : clamp01(shieldCurrent / shieldMax),
    shieldMax === 0 ? 1 : clamp01((weakestLayer?.current ?? 0) / Math.max(1, weakestLayer?.max ?? 1)),
    clamp01(snapshot.shield.breachesThisRun / 10),
    clamp01(snapshot.tension.score / 100),
    clamp01(snapshot.tension.anticipation / 100),
    clamp01(snapshot.tension.visibleThreats.length / 10),
    clamp01(snapshot.cascade.activeChains.length / 10),
    totalResolved === 0 ? 0 : clamp01(snapshot.cascade.brokenChains / totalResolved),
    clamp01(snapshot.battle.battleBudget / Math.max(1, snapshot.battle.battleBudgetCap)),
    clamp01(snapshot.cards.hand.length / 10),
    totalCardsSeen === 0 ? 0 : clamp01(snapshot.cards.discard.length / totalCardsSeen),
    clamp01(snapshot.timers.elapsedMs / totalBudget),
    clamp01(snapshot.timers.holdCharges / 3),
    clamp01(Math.abs(snapshot.sovereignty.gapVsLegend)),
    clamp01(snapshot.sovereignty.gapClosingRate),
    clamp01(snapshot.sovereignty.sovereigntyScore ?? 0),
    totalDecisions === 0 ? 1 : clamp01(acceptedDecisions / totalDecisions),
  ] as const);
}

/** Build a complete RuntimeTickMLSummary from a snapshot. */
function rtBuildMLSummary(snapshot: RunStateSnapshot): RuntimeTickMLSummary {
  const urgency = rtComputeUrgency(snapshot);
  const cascadeRisk = rtComputeCascadeRisk(snapshot);
  const economyHealth = rtComputeEconomyHealth(snapshot);
  const shieldHealth = rtComputeShieldRatio(snapshot);
  const sovereigntyAlignment = rtComputeSovereigntyAlignment(snapshot);
  const compositeRisk = rtComputeCompositeRisk(urgency, cascadeRisk, economyHealth, shieldHealth);
  const action = rtRecommendAction(urgency, cascadeRisk, shieldHealth, compositeRisk);
  const dlVector = rtBuildDLInputVector(snapshot);

  return {
    tick: snapshot.tick,
    phase: snapshot.phase,
    tier: snapshot.pressure.tier,
    mode: snapshot.mode,
    urgencyScore: urgency,
    cascadeRiskScore: cascadeRisk,
    economyHealthScore: economyHealth,
    shieldHealthScore: shieldHealth,
    sovereigntyAlignmentScore: sovereigntyAlignment,
    compositeRiskScore: compositeRisk,
    recommendedAction: action,
    mlContextVector: Object.freeze([
      TIER_ML_WEIGHT[snapshot.pressure.tier] ?? 0,
      PHASE_ML_WEIGHT[snapshot.phase] ?? 0,
      urgency,
      cascadeRisk,
      economyHealth,
      shieldHealth,
      sovereigntyAlignment,
      compositeRisk,
    ] as const),
    dlInputVector: dlVector,
  };
}

/** Build a RuntimeDLPacket from a snapshot. */
function rtBuildDLPacket(snapshot: RunStateSnapshot, dlVector: readonly number[], nowMs: number): RuntimeDLPacket {
  return {
    runId: snapshot.runId,
    tick: snapshot.tick,
    tensorShape: RT_DL_TENSOR_SHAPE,
    inputVector: dlVector,
    featureLabels: RT_DL_FEATURE_LABELS,
    emittedAtMs: nowMs,
  };
}

/** Build a tick prediction without mutating state. */
function rtBuildTickPrediction(snapshot: RunStateSnapshot): RuntimeTickPrediction {
  const tickDuration = Math.max(1, snapshot.timers.currentTickDurationMs);
  const predictedElapsedMs = snapshot.timers.elapsedMs + tickDuration;
  const totalBudget = snapshot.timers.seasonBudgetMs + snapshot.timers.extensionBudgetMs;
  const netIncome = snapshot.economy.incomePerTick - snapshot.economy.expensesPerTick;
  const predictedCash = snapshot.economy.cash + netIncome;
  const predictedNetWorth = snapshot.economy.netWorth + netIncome * 0.5;

  const predictedPhase: RunStateSnapshot['phase'] =
    predictedElapsedMs < totalBudget * 0.33 ? 'FOUNDATION' :
    predictedElapsedMs < totalBudget * 0.66 ? 'ESCALATION' :
    'SOVEREIGNTY';

  let predictedOutcome: RunStateSnapshot['outcome'] = null;
  if (predictedCash < 0) predictedOutcome = 'BANKRUPT';
  else if (predictedElapsedMs >= totalBudget) predictedOutcome = 'TIMEOUT';
  else if (predictedNetWorth >= snapshot.economy.freedomTarget) predictedOutcome = 'FREEDOM';

  const warningFlags: string[] = [];
  if (predictedCash < snapshot.economy.freedomTarget * 0.05) warningFlags.push('CRITICAL_CASH_LOW');
  if (snapshot.cascade.activeChains.length >= 3) warningFlags.push('CASCADE_OVERLOAD');
  if (snapshot.shield.breachesThisRun > 2) warningFlags.push('REPEATED_BREACH');
  if (snapshot.tension.visibleThreats.length >= 4) warningFlags.push('THREAT_SATURATION');
  if (snapshot.pressure.tier === 'T4') warningFlags.push('MAX_PRESSURE');
  if (predictedElapsedMs > totalBudget * 0.9) warningFlags.push('TIME_CRITICAL');

  return {
    tick: snapshot.tick + 1,
    predictedPhase,
    predictedTier: snapshot.pressure.tier,
    predictedOutcome,
    predictedElapsedMs,
    predictedCash: roundMoney(predictedCash),
    predictedNetWorth: roundMoney(predictedNetWorth),
    forecastConfidence: clamp01(roundTo4(1 - warningFlags.length * 0.12)),
    warningFlags: Object.freeze(warningFlags),
  };
}

/** Compute a null ML impact for rejected plays. */
function rtNullMLImpact(): RuntimePlayMLImpact {
  return {
    urgencyShift: 0,
    cascadeRiskShift: 0,
    economyHealthShift: 0,
    shieldHealthShift: 0,
    compositeRiskShift: 0,
    dominantImpactDimension: 'none',
  };
}

function mergeEngineSignals(
  snapshot: MutableRunStateSnapshot,
  signals: readonly EngineSignal[] | undefined,
): void {
  if (!signals || signals.length === 0) {
    return;
  }

  const warnings = new Set<string>(snapshot.telemetry.warnings);

  for (const signal of signals) {
    if (signal.severity === 'WARN' || signal.severity === 'ERROR') {
      warnings.add(
        `[${signal.engineId}] ${signal.code}: ${signal.message}`,
      );
    }
  }

  snapshot.telemetry.warnings = [...warnings];
}

// ---------------------------------------------------------------------------
// Main class
// ---------------------------------------------------------------------------

export class EngineRuntime {
  private readonly registry: EngineRegistry;
  private readonly bus: EventBus<EngineEventMap & Record<string, unknown>>;
  private readonly clock: DeterministicClock;
  private readonly windows: DecisionWindowService;
  private readonly overlays: CardOverlayResolver;

  private snapshot: RunStateSnapshot | null = null;
  private activeStep: TickStep = 'STEP_01_PREPARE';
  private runStartedEmitted = false;

  // ML tracking across the run
  private readonly mlSummaries: RuntimeTickMLSummary[] = [];
  private lastObservedTier: string = 'T0';
  private lastObservedPhase: string = 'FOUNDATION';
  private tierCrossingCount = 0;
  private phaseTransitionCount = 0;
  private peakUrgency = 0;
  private peakCascadeRisk = 0;
  private cumulativeCompositeRisk = 0;

  public constructor(options?: {
    registry?: EngineRegistry;
    bus?: EventBus<EngineEventMap & Record<string, unknown>>;
    clock?: DeterministicClock;
    windows?: DecisionWindowService;
    overlays?: CardOverlayResolver;
  }) {
    this.registry = options?.registry ?? new EngineRegistry();
    this.bus =
      options?.bus ??
      new EventBus<EngineEventMap & Record<string, unknown>>();
    this.clock = options?.clock ?? new DeterministicClock(0);
    this.windows = options?.windows ?? new DecisionWindowService();
    this.overlays = options?.overlays ?? new CardOverlayResolver();
  }

  public registerEngine(
    engine: Parameters<EngineRegistry['register']>[0],
  ): void {
    this.registry.register(engine);
  }

  public startRun(input: RunFactoryInput): RunStateSnapshot {
    this.registry.reset();
    this.bus.clear();
    this.clock.set(0);
    this.activeStep = 'STEP_01_PREPARE';
    this.runStartedEmitted = false;
    this.resetMLTracking();

    let snapshot = createInitialRunState(input);
    snapshot = this.windows.reconcile(snapshot, {
      step: this.activeStep,
      nowMs: this.clock.now(),
      previousPhase: snapshot.phase,
      nextPhase: snapshot.phase,
      previousTier: snapshot.pressure.tier,
      nextTier: snapshot.pressure.tier,
    });

    this.snapshot = toFrozenSnapshot(snapshot);
    this.lastObservedTier = snapshot.pressure.tier;
    this.lastObservedPhase = snapshot.phase;

    this.emitRunStartedIfNeeded();
    return this.requireSnapshot();
  }

  public current(): RunStateSnapshot {
    return this.requireSnapshot();
  }

  public flushEvents(): Array<RuntimeEventEnvelope> {
    return this.bus.flush() as Array<RuntimeEventEnvelope>;
  }

  // ---------------------------------------------------------------------------
  // Card operations
  // ---------------------------------------------------------------------------

  public drawCardToHand(definition: CardDefinition): DrawCardResult {
    const snapshot = this.requireSnapshot();
    const instance = this.overlays.createInstance(definition, snapshot);

    if (!instance) {
      return {
        accepted: false,
        snapshot,
        instance: null,
        reasons: [
          `Card ${definition.id} is not currently legal for draw in mode ${snapshot.mode}.`,
        ],
      };
    }

    const next = toMutableSnapshot(snapshot);
    const mutableInstance = cloneJson(instance) as MutableDeep<CardInstance>;

    next.cards.hand.push(mutableInstance);
    next.cards.drawHistory.push(mutableInstance.instanceId);

    this.snapshot = toFrozenSnapshot(next);

    return {
      accepted: true,
      snapshot: this.requireSnapshot(),
      instance,
      reasons: [],
    };
  }

  public playCard(request: PlayCardRequest): PlayCardResult {
    const snapshot = this.requireSnapshot();
    const instance = snapshot.cards.hand.find(
      (card) => card.instanceId === request.cardInstanceId,
    );

    if (!instance) {
      return {
        accepted: false,
        snapshot,
        playedCard: null,
        chosenTimingClass: null,
        reasons: [`Card instance ${request.cardInstanceId} not found in hand.`],
        mlImpact: rtNullMLImpact(),
      };
    }

    const availableTimingClasses = this.windows.getAvailableTimingClasses(
      snapshot,
      this.activeStep,
      { actorId: request.actorId },
    );

    const validation = this.overlays.validateCardPlay({
      snapshot,
      card: instance,
      requestedTimingClass: request.requestedTimingClass,
      availableTimingClasses,
      actorId: request.actorId,
    });

    if (!validation.legal || validation.chosenTimingClass === null) {
      return {
        accepted: false,
        snapshot,
        playedCard: null,
        chosenTimingClass: validation.chosenTimingClass,
        reasons: validation.reasons,
        mlImpact: rtNullMLImpact(),
      };
    }

    // Capture pre-play ML scores
    const preUrgency = rtComputeUrgency(snapshot);
    const preCascadeRisk = rtComputeCascadeRisk(snapshot);
    const preEconomy = rtComputeEconomyHealth(snapshot);
    const preShield = rtComputeShieldRatio(snapshot);
    const preComposite = rtComputeCompositeRisk(preUrgency, preCascadeRisk, preEconomy, preShield);

    const next = toMutableSnapshot(snapshot);
    const handIndex = next.cards.hand.findIndex(
      (card) => card.instanceId === request.cardInstanceId,
    );

    if (handIndex === -1) {
      return {
        accepted: false,
        snapshot,
        playedCard: null,
        chosenTimingClass: validation.chosenTimingClass,
        reasons: ['Card disappeared from hand during play resolution.'],
        mlImpact: rtNullMLImpact(),
      };
    }

    const resourceDebited = this.debitResource(
      next,
      validation.resolved.resourceType,
      validation.resolved.cost,
    );

    if (!resourceDebited) {
      return {
        accepted: false,
        snapshot,
        playedCard: null,
        chosenTimingClass: validation.chosenTimingClass,
        reasons: [
          ...validation.reasons,
          `Unable to debit ${validation.resolved.resourceType} for card ${instance.definitionId}.`,
        ],
        mlImpact: rtNullMLImpact(),
      };
    }

    this.applyEffectPayload(
      next,
      validation.resolved.effect,
      validation.resolved.targeting,
    );

    next.cards.hand.splice(handIndex, 1);
    next.cards.discard.push(instance.instanceId);
    next.cards.lastPlayed = latestThree([
      ...next.cards.lastPlayed,
      instance.definitionId,
    ]);

    next.telemetry.decisions.push({
      tick: next.tick,
      actorId: request.actorId,
      cardId: instance.definitionId,
      latencyMs: 0,
      timingClass: [validation.chosenTimingClass],
      accepted: true,
    });

    next.economy.netWorth = recomputeNetWorth(next);
    next.shield.weakestLayerId = weakestLayerId(next);

    this.bus.emit('card.played', {
      runId: next.runId,
      actorId: request.actorId,
      cardId: instance.definitionId,
      tick: next.tick,
      mode: next.mode,
    });

    this.snapshot = toFrozenSnapshot(next);

    if (
      validation.chosenTimingClass !== 'ANY' &&
      validation.chosenTimingClass !== 'PRE' &&
      validation.chosenTimingClass !== 'POST' &&
      validation.chosenTimingClass !== 'END'
    ) {
      this.snapshot = this.windows.consumeFirstWindowForTimingClass(
        this.requireSnapshot(),
        validation.chosenTimingClass,
        request.actorId,
      );
    }

    // Compute post-play ML impact
    const postSnapshot = this.requireSnapshot();
    const postUrgency = rtComputeUrgency(postSnapshot);
    const postCascadeRisk = rtComputeCascadeRisk(postSnapshot);
    const postEconomy = rtComputeEconomyHealth(postSnapshot);
    const postShield = rtComputeShieldRatio(postSnapshot);
    const postComposite = rtComputeCompositeRisk(postUrgency, postCascadeRisk, postEconomy, postShield);

    const urgencyShift = roundTo4(postUrgency - preUrgency);
    const cascadeRiskShift = roundTo4(postCascadeRisk - preCascadeRisk);
    const economyHealthShift = roundTo4(postEconomy - preEconomy);
    const shieldHealthShift = roundTo4(postShield - preShield);
    const compositeRiskShift = roundTo4(postComposite - preComposite);

    const dims: Array<[string, number]> = [
      ['urgency', Math.abs(urgencyShift)],
      ['cascade_risk', Math.abs(cascadeRiskShift)],
      ['economy_health', Math.abs(economyHealthShift)],
      ['shield_health', Math.abs(shieldHealthShift)],
    ];
    dims.sort((a, b) => b[1] - a[1]);
    const dominantImpactDimension = dims[0]?.[0] ?? 'none';

    return {
      accepted: true,
      snapshot: this.requireSnapshot(),
      playedCard: instance,
      chosenTimingClass: validation.chosenTimingClass,
      reasons: [],
      mlImpact: {
        urgencyShift,
        cascadeRiskShift,
        economyHealthShift,
        shieldHealthShift,
        compositeRiskShift,
        dominantImpactDimension,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Tick
  // ---------------------------------------------------------------------------

  public tick(): RuntimeTickResult {
    const base = this.requireSnapshot();

    if (base.outcome !== null) {
      const frozenML = rtBuildMLSummary(base);
      const frozenDL = rtBuildDLPacket(base, frozenML.dlInputVector, this.clock.now());
      return {
        snapshot: base,
        checksum: base.telemetry.lastTickChecksum ?? computeTickChecksum(base),
        events: [],
        mlSummary: frozenML,
        dlPacket: frozenDL,
      };
    }

    this.emitRunStartedIfNeeded();

    let next = toMutableSnapshot(base);
    const previousPhase = next.phase;
    const previousTier = next.pressure.tier;

    const prepareNowMs = this.clock.now();

    next = toMutableSnapshot(
      this.windows.reconcile(toFrozenSnapshot(next), {
        step: 'STEP_01_PREPARE',
        nowMs: prepareNowMs,
        previousPhase,
        nextPhase: next.phase,
        previousTier,
        nextTier: next.pressure.tier,
      }),
    );

    this.activeStep = 'STEP_01_PREPARE';
    next = this.prepareForTick(next);

    for (const step of TICK_SEQUENCE) {
      this.activeStep = step;

      if (step === 'STEP_01_PREPARE') {
        continue;
      }

      if (step === 'STEP_08_MODE_POST') {
        next = this.applyModePostProcessing(next);
        continue;
      }

      if (step === 'STEP_09_TELEMETRY') {
        next = this.applyTelemetryPostProcessing(next);
        continue;
      }

      if (step === 'STEP_10_SOVEREIGNTY_SNAPSHOT') {
        next = this.applySovereigntySnapshot(next);
        continue;
      }

      if (step === 'STEP_11_OUTCOME_GATE') {
        next = this.applyOutcomeGate(next);
        continue;
      }

      if (step === 'STEP_12_EVENT_SEAL' || step === 'STEP_13_FLUSH') {
        continue;
      }

      const stepNowMs = this.clock.now();

      if (step === 'STEP_02_TIME') {
        const previousTick = next.tick;
        const previousElapsedMs = next.timers.elapsedMs;
        const fallbackDurationMs = resolveSafeTickDurationMs(next);

        next = this.executeEngineStep(next, step, stepNowMs);
        next = this.ensureTimeStepAdvanced(
          next,
          previousTick,
          previousElapsedMs,
          fallbackDurationMs,
        );

        const advancedMs = Math.max(
          0,
          next.timers.elapsedMs - previousElapsedMs,
        );

        if (advancedMs > 0) {
          this.clock.advance(advancedMs);
        }

        continue;
      }

      next = this.executeEngineStep(next, step, stepNowMs);
    }

    const normalizedPhase = resolvePhaseFromElapsedMs(next.timers.elapsedMs);

    if (normalizedPhase !== next.phase) {
      next.phase = normalizedPhase;
    }

    next.timers.currentTickDurationMs = resolveSafeTickDurationMs(next);
    next.timers.nextTickAtMs =
      next.outcome === null
        ? this.clock.now() + next.timers.currentTickDurationMs
        : null;

    next = toMutableSnapshot(
      this.windows.reconcile(toFrozenSnapshot(next), {
        step: 'STEP_08_MODE_POST',
        nowMs: this.clock.now(),
        previousPhase,
        nextPhase: next.phase,
        previousTier,
        nextTier: next.pressure.tier,
      }),
    );

    next.economy.netWorth = recomputeNetWorth(next);
    next.shield.weakestLayerId = weakestLayerId(next);

    const checksum = computeTickChecksum(next);

    next.sovereignty.tickChecksums.push(checksum);
    next.telemetry.lastTickChecksum = checksum;

    this.bus.emit('tick.completed', {
      runId: next.runId,
      tick: next.tick,
      phase: next.phase,
      checksum,
    });

    if (next.outcome !== null) {
      next.sovereignty.proofHash = computeProofHash(next);
      next.sovereignty.sovereigntyScore = estimateSovereigntyScore(next);
      next.sovereignty.verifiedGrade = gradeForScore(
        next.sovereignty.sovereigntyScore,
        next.modeState.bleedMode,
      );

      this.bus.emit('sovereignty.completed', {
        runId: next.runId,
        score: next.sovereignty.sovereigntyScore,
        grade: next.sovereignty.verifiedGrade,
        proofHash: next.sovereignty.proofHash,
        outcome: next.outcome,
      });
    }

    let sealedSnapshot = toFrozenSnapshot(next);
    const events = this.flushEvents();

    const sealedMutable = toMutableSnapshot(sealedSnapshot);
    sealedMutable.telemetry.emittedEventCount = events.length;
    sealedSnapshot = toFrozenSnapshot(sealedMutable);

    this.snapshot = sealedSnapshot;

    // Build ML summary and DL packet after tick finalized
    const mlSummary = rtBuildMLSummary(sealedSnapshot);
    const dlPacket = rtBuildDLPacket(sealedSnapshot, mlSummary.dlInputVector, this.clock.now());

    // Track ML state
    this.mlSummaries.push(mlSummary);
    this.peakUrgency = Math.max(this.peakUrgency, mlSummary.urgencyScore);
    this.peakCascadeRisk = Math.max(this.peakCascadeRisk, mlSummary.cascadeRiskScore);
    this.cumulativeCompositeRisk += mlSummary.compositeRiskScore;

    if (sealedSnapshot.pressure.tier !== this.lastObservedTier) {
      this.tierCrossingCount += 1;
      this.lastObservedTier = sealedSnapshot.pressure.tier;
    }

    if (sealedSnapshot.phase !== this.lastObservedPhase) {
      this.phaseTransitionCount += 1;
      this.lastObservedPhase = sealedSnapshot.phase;
    }

    // Emit ML event for downstream consumers
    this.bus.emit('ml.tick.scored', {
      runId: sealedSnapshot.runId,
      tick: sealedSnapshot.tick,
      urgencyScore: mlSummary.urgencyScore,
      cascadeRiskScore: mlSummary.cascadeRiskScore,
      compositeRiskScore: mlSummary.compositeRiskScore,
      recommendedAction: mlSummary.recommendedAction,
    } as unknown as EngineEventMap[keyof EngineEventMap]);

    return {
      snapshot: sealedSnapshot,
      checksum,
      events,
      mlSummary,
      dlPacket,
    };
  }

  public tickMany(count: number): RuntimeTickResult[] {
    const results: RuntimeTickResult[] = [];

    for (let i = 0; i < count; i += 1) {
      const result = this.tick();
      results.push(result);

      if (result.snapshot.outcome !== null) {
        break;
      }
    }

    return results;
  }

  public tickUntilTerminal(limit = 10_000): RuntimeTickResult[] {
    const results: RuntimeTickResult[] = [];

    for (let i = 0; i < limit; i += 1) {
      const result = this.tick();
      results.push(result);

      if (result.snapshot.outcome !== null) {
        return results;
      }
    }

    throw new Error(
      `tickUntilTerminal exceeded limit ${String(limit)} without terminal outcome.`,
    );
  }

  // ---------------------------------------------------------------------------
  // Analytics and ML accessors
  // ---------------------------------------------------------------------------

  /** Get the latest tick ML summary without running a tick. */
  public getLatestMLSummary(): RuntimeTickMLSummary | null {
    return this.mlSummaries[this.mlSummaries.length - 1] ?? null;
  }

  /** Get all ML summaries collected during this run. */
  public getAllMLSummaries(): readonly RuntimeTickMLSummary[] {
    return Object.freeze([...this.mlSummaries]);
  }

  /** Build a prediction for the next tick without executing it. */
  public previewNextTick(): RuntimeTickPrediction {
    return rtBuildTickPrediction(this.requireSnapshot());
  }

  /** Preview the next N ticks (up to 50) via forward simulation. */
  public previewNextTicks(count: number): readonly RuntimeTickPrediction[] {
    const snapshot = this.requireSnapshot();
    const results: RuntimeTickPrediction[] = [];
    let simElapsed = snapshot.timers.elapsedMs;
    let simCash = snapshot.economy.cash;
    let simNetWorth = snapshot.economy.netWorth;
    const tickDuration = Math.max(1, snapshot.timers.currentTickDurationMs);
    const netIncome = snapshot.economy.incomePerTick - snapshot.economy.expensesPerTick;
    const totalBudget = snapshot.timers.seasonBudgetMs + snapshot.timers.extensionBudgetMs;
    const normalized = Math.max(1, Math.min(50, Math.trunc(count)));

    for (let i = 0; i < normalized; i += 1) {
      simElapsed += tickDuration;
      simCash += netIncome;
      simNetWorth += netIncome * 0.5;

      const predictedPhase: RunStateSnapshot['phase'] =
        simElapsed < totalBudget * 0.33 ? 'FOUNDATION' :
        simElapsed < totalBudget * 0.66 ? 'ESCALATION' :
        'SOVEREIGNTY';

      let predictedOutcome: RunStateSnapshot['outcome'] = null;
      if (simCash < 0) predictedOutcome = 'BANKRUPT';
      else if (simElapsed >= totalBudget) predictedOutcome = 'TIMEOUT';
      else if (simNetWorth >= snapshot.economy.freedomTarget) predictedOutcome = 'FREEDOM';

      const warningFlags: string[] = [];
      if (simCash < snapshot.economy.freedomTarget * 0.05) warningFlags.push('CRITICAL_CASH_LOW');
      if (simElapsed > totalBudget * 0.9) warningFlags.push('TIME_CRITICAL');
      if (snapshot.pressure.tier === 'T4') warningFlags.push('MAX_PRESSURE');

      results.push({
        tick: snapshot.tick + i + 1,
        predictedPhase,
        predictedTier: snapshot.pressure.tier,
        predictedOutcome,
        predictedElapsedMs: simElapsed,
        predictedCash: roundMoney(simCash),
        predictedNetWorth: roundMoney(simNetWorth),
        forecastConfidence: clamp01(roundTo4(1 - warningFlags.length * 0.12 - i * 0.03)),
        warningFlags: Object.freeze(warningFlags),
      });

      if (predictedOutcome !== null) break;
    }

    return Object.freeze(results);
  }

  /** Build a full run analytics report — call after terminal outcome. */
  public buildRunAnalytics(): RuntimeRunAnalytics {
    const snapshot = this.requireSnapshot();
    const decisions = snapshot.telemetry.decisions;
    const accepted = decisions.filter((d) => d.accepted);
    const rejected = decisions.filter((d) => !d.accepted);
    const avgLatency = accepted.length === 0 ? 0
      : roundTo4(accepted.reduce((sum, d) => sum + d.latencyMs, 0) / accepted.length);
    const avgCompositeRisk = this.mlSummaries.length === 0 ? 0
      : roundTo4(this.cumulativeCompositeRisk / this.mlSummaries.length);
    const avgTickMs = snapshot.tick === 0 ? 0
      : Math.round(snapshot.timers.elapsedMs / snapshot.tick);

    const shieldMax = snapshot.shield.layers.reduce((sum, l) => sum + l.max, 0);
    const shieldCurrent = snapshot.shield.layers.reduce((sum, l) => sum + l.current, 0);
    const finalShieldRatio = shieldMax === 0 ? 1 : roundTo4(shieldCurrent / shieldMax);

    return {
      runId: snapshot.runId,
      mode: snapshot.mode,
      totalTicks: snapshot.tick,
      outcome: snapshot.outcome,
      totalElapsedMs: snapshot.timers.elapsedMs,
      avgTickDurationMs: avgTickMs,
      finalNetWorth: snapshot.economy.netWorth,
      finalCash: snapshot.economy.cash,
      finalShieldRatio,
      sovereigntyScore: snapshot.sovereignty.sovereigntyScore ?? 0,
      verifiedGrade: snapshot.sovereignty.verifiedGrade ?? 'UNGRADED',
      proofHash: snapshot.sovereignty.proofHash ?? null,
      decisionsAccepted: accepted.length,
      decisionsRejected: rejected.length,
      avgDecisionLatencyMs: avgLatency,
      peakUrgency: roundTo4(this.peakUrgency),
      peakCascadeRisk: roundTo4(this.peakCascadeRisk),
      avgCompositeRisk,
      tierCrossingCount: this.tierCrossingCount,
      phaseTransitionCount: this.phaseTransitionCount,
      warningCount: snapshot.telemetry.warnings.length,
      mlSummaries: Object.freeze([...this.mlSummaries]),
    };
  }

  /** Get a lightweight health snapshot without requiring an active run. */
  public getHealthSnapshot(): RuntimeHealthSnapshot {
    const snapshot = this.snapshot;
    return {
      hasActiveRun: snapshot !== null,
      currentTick: snapshot?.tick ?? null,
      currentPhase: snapshot?.phase ?? null,
      currentTier: snapshot?.pressure.tier ?? null,
      registeredEngineCount: this.registry.health().length,
      busEventCount: this.bus.historyCount(),
      warningCount: snapshot?.telemetry.warnings.length ?? 0,
      outcome: snapshot?.outcome ?? null,
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private resetMLTracking(): void {
    this.mlSummaries.length = 0;
    this.lastObservedTier = 'T0';
    this.lastObservedPhase = 'FOUNDATION';
    this.tierCrossingCount = 0;
    this.phaseTransitionCount = 0;
    this.peakUrgency = 0;
    this.peakCascadeRisk = 0;
    this.cumulativeCompositeRisk = 0;
  }

  private prepareForTick(
    snapshot: MutableRunStateSnapshot,
  ): MutableRunStateSnapshot {
    const next = toMutableSnapshot(snapshot);

    if (next.modeState.phaseBoundaryWindowsRemaining > 0) {
      next.modeState.phaseBoundaryWindowsRemaining -= 1;
    }

    next.cards.hand = next.cards.hand.flatMap((card) => {
      if (card.decayTicksRemaining === null) {
        return [card];
      }

      const updatedDecay = card.decayTicksRemaining - 1;

      if (updatedDecay < 0) {
        next.cards.discard.push(card.instanceId);
        return [];
      }

      return [
        {
          ...card,
          decayTicksRemaining: updatedDecay,
        },
      ];
    });

    if (next.battle.extractionCooldownTicks > 0) {
      next.battle.extractionCooldownTicks -= 1;
    }

    if (next.mode === 'solo' && next.economy.cash < 5_000) {
      next.shield.layers = next.shield.layers.map((layer) =>
        layer.layerId === 'L1'
          ? {
              ...layer,
              regenPerTick: Math.max(0, Math.floor(layer.regenPerTick / 2)),
            }
          : layer,
      );
    }

    if (
      next.mode === 'solo' &&
      next.cards.hand.every((card) => !card.tags.includes('income'))
    ) {
      next.tags = Array.from(new Set([...next.tags, 'solo:isolation-tax']));
      next.sovereignty.gapVsLegend -= 0.002;
    }

    return next;
  }

  private applyModePostProcessing(
    snapshot: MutableRunStateSnapshot,
  ): MutableRunStateSnapshot {
    const next = toMutableSnapshot(snapshot);
    const newPhase = resolvePhaseFromElapsedMs(next.timers.elapsedMs);

    if (newPhase !== next.phase) {
      next.phase = newPhase;

      if (next.mode === 'solo') {
        next.modeState.phaseBoundaryWindowsRemaining =
          DEFAULT_PHASE_TRANSITION_WINDOWS;
      }
    }

    if (next.mode === 'solo' && next.modeState.bleedMode) {
      next.tags = Array.from(new Set([...next.tags, 'solo:bleed-mode']));
    }

    if (next.mode === 'pvp') {
      next.battle.battleBudget = Math.min(
        next.battle.battleBudgetCap,
        next.battle.battleBudget +
          (next.pressure.tier === 'T3' || next.pressure.tier === 'T4' ? 4 : 2),
      );
    }

    if (next.mode === 'ghost' && next.cards.ghostMarkers.length > 0) {
      const nearbyMarkers = next.cards.ghostMarkers.filter(
        (marker) => Math.abs(marker.tick - next.tick) <= 3,
      );

      next.sovereignty.gapClosingRate = nearbyMarkers.length > 0 ? 0.02 : 0;
    }

    return next;
  }

  private applyTelemetryPostProcessing(
    snapshot: MutableRunStateSnapshot,
  ): MutableRunStateSnapshot {
    const next = toMutableSnapshot(snapshot);

    if (next.pressure.tier === 'T3' || next.pressure.tier === 'T4') {
      next.pressure.survivedHighPressureTicks += 1;
    }

    return next;
  }

  private applySovereigntySnapshot(
    snapshot: MutableRunStateSnapshot,
  ): MutableRunStateSnapshot {
    const next = toMutableSnapshot(snapshot);
    next.sovereignty.integrityStatus =
      next.outcome === null ? 'PENDING' : 'VERIFIED';
    return next;
  }

  private applyOutcomeGate(
    snapshot: MutableRunStateSnapshot,
  ): MutableRunStateSnapshot {
    const next = toMutableSnapshot(snapshot);
    const outcome = determineOutcome(next);

    next.outcome = outcome;

    if (outcome === 'BANKRUPT') {
      next.telemetry.outcomeReason = 'economy.cash_below_zero';
      next.telemetry.outcomeReasonCode = 'NET_WORTH_COLLAPSE';
    } else if (outcome === 'TIMEOUT') {
      next.telemetry.outcomeReason = 'timer.expired';
      next.telemetry.outcomeReasonCode = 'SEASON_BUDGET_EXHAUSTED';
    } else if (outcome === 'FREEDOM') {
      next.telemetry.outcomeReason = 'economy.freedom_target_reached';
      next.telemetry.outcomeReasonCode = 'TARGET_REACHED';
    } else {
      next.telemetry.outcomeReason = null;
      next.telemetry.outcomeReasonCode = null;
    }

    return next;
  }

  private ensureTimeStepAdvanced(
    snapshot: MutableRunStateSnapshot,
    previousTick: number,
    previousElapsedMs: number,
    fallbackDurationMs: number,
  ): MutableRunStateSnapshot {
    const next = toMutableSnapshot(snapshot);

    if (next.tick <= previousTick) {
      next.tick = previousTick + 1;
    }

    if (next.timers.elapsedMs <= previousElapsedMs) {
      next.timers.elapsedMs = previousElapsedMs + fallbackDurationMs;
    }

    if (
      !Number.isFinite(next.timers.currentTickDurationMs) ||
      next.timers.currentTickDurationMs <= 0
    ) {
      next.timers.currentTickDurationMs = fallbackDurationMs;
    }

    return next;
  }

  private executeEngineStep(
    snapshot: MutableRunStateSnapshot,
    step: TickStep,
    nowMs: number,
  ): MutableRunStateSnapshot {
    const engineId = STEP_TO_ENGINE[step];

    if (!engineId) {
      return snapshot;
    }

    const engine = this.tryGetEngine(engineId);

    if (!engine) {
      return snapshot;
    }

    const frozenInput = toFrozenSnapshot(snapshot);

    const context: TickContext = {
      step,
      nowMs,
      clock: this.clock,
      bus: this.bus as TickContext['bus'],
      trace: this.createTickTrace(frozenInput, step, nowMs),
    };

    if (engine.canRun && engine.canRun(frozenInput, context) === false) {
      return snapshot;
    }

    const result = normalizeEngineTickResult(
      engine.engineId,
      frozenInput.tick,
      engine.tick(frozenInput, context),
    );

    const next = toMutableSnapshot(result.snapshot);
    mergeEngineSignals(next, result.signals);

    return next;
  }

  private tryGetEngine(engineId: EngineId): SimulationEngine | null {
    try {
      return this.registry.get(engineId);
    } catch {
      return null;
    }
  }

  private createTickTrace(
    snapshot: RunStateSnapshot,
    step: TickStep,
    nowMs: number,
  ): TickContext['trace'] {
    return {
      runId: snapshot.runId,
      tick: snapshot.tick,
      step,
      mode: snapshot.mode,
      phase: snapshot.phase,
      traceId: createDeterministicId(
        'tick-trace',
        snapshot.runId,
        snapshot.tick,
        step,
        nowMs,
      ),
    };
  }

  private emitRunStartedIfNeeded(): void {
    if (this.runStartedEmitted) {
      return;
    }

    const snapshot = this.requireSnapshot();

    this.bus.emit('run.started', {
      runId: snapshot.runId,
      mode: snapshot.mode,
      seed: snapshot.seed,
    });

    this.runStartedEmitted = true;
  }

  private requireSnapshot(): RunStateSnapshot {
    if (!this.snapshot) {
      throw new Error('EngineRuntime has no active run. Call startRun() first.');
    }

    return this.snapshot;
  }

  private debitResource(
    snapshot: MutableRunStateSnapshot,
    resourceType: ResourceType,
    amount: number,
  ): boolean {
    if (resourceType === 'free') {
      return true;
    }

    if (resourceType === 'cash') {
      if (snapshot.economy.cash < amount) {
        return false;
      }

      snapshot.economy.cash = roundMoney(snapshot.economy.cash - amount);
      return true;
    }

    if (resourceType === 'battle_budget') {
      if (snapshot.battle.battleBudget < amount) {
        return false;
      }

      snapshot.battle.battleBudget = roundMoney(
        snapshot.battle.battleBudget - amount,
      );
      return true;
    }

    if (resourceType === 'shared_treasury') {
      if (snapshot.modeState.sharedTreasuryBalance < amount) {
        return false;
      }

      snapshot.modeState.sharedTreasuryBalance = roundMoney(
        snapshot.modeState.sharedTreasuryBalance - amount,
      );
      return true;
    }

    return false;
  }

  private applyEffectPayload(
    snapshot: MutableRunStateSnapshot,
    effect: EffectPayload,
    targeting: Targeting,
  ): void {
    if (typeof effect.cashDelta === 'number') {
      if (targeting === 'TEAM' && snapshot.mode === 'coop') {
        snapshot.modeState.sharedTreasuryBalance = roundMoney(
          snapshot.modeState.sharedTreasuryBalance + effect.cashDelta,
        );
      } else {
        snapshot.economy.cash = roundMoney(
          snapshot.economy.cash + effect.cashDelta,
        );
      }
    }

    if (typeof effect.incomeDelta === 'number') {
      snapshot.economy.incomePerTick = roundMoney(
        snapshot.economy.incomePerTick + effect.incomeDelta,
      );
    }

    if (typeof effect.shieldDelta === 'number') {
      const deltaPerLayer =
        snapshot.shield.layers.length === 0
          ? 0
          : effect.shieldDelta / snapshot.shield.layers.length;

      snapshot.shield.layers = snapshot.shield.layers.map((layer) => ({
        ...layer,
        current: Math.max(0, Math.min(layer.max, layer.current + deltaPerLayer)),
      }));
    }

    if (typeof effect.heatDelta === 'number') {
      snapshot.economy.haterHeat = roundMoney(
        snapshot.economy.haterHeat + effect.heatDelta,
      );
    }

    if (typeof effect.trustDelta === 'number' && snapshot.mode === 'coop') {
      const actorKey = 'TEAMMATE_01';
      const currentTrust = Number(snapshot.modeState.trustScores[actorKey] ?? 50);

      snapshot.modeState.trustScores[actorKey] = Math.max(
        0,
        Math.min(100, Math.round(currentTrust + effect.trustDelta)),
      );
    }

    if (typeof effect.timeDeltaMs === 'number') {
      snapshot.timers.extensionBudgetMs += Math.trunc(effect.timeDeltaMs);
    }

    if (typeof effect.divergenceDelta === 'number') {
      snapshot.sovereignty.gapVsLegend = roundThousandths(
        snapshot.sovereignty.gapVsLegend + effect.divergenceDelta,
      );
    }

    if (effect.cascadeTag) {
      snapshot.cascade.positiveTrackers = Array.from(
        new Set([...snapshot.cascade.positiveTrackers, effect.cascadeTag]),
      );
    }

    if (effect.injectCards && effect.injectCards.length > 0) {
      snapshot.telemetry.forkHints = Array.from(
        new Set([...snapshot.telemetry.forkHints, ...effect.injectCards]),
      );
    }

    snapshot.economy.netWorth = recomputeNetWorth(snapshot);
    snapshot.shield.weakestLayerId = weakestLayerId(snapshot);
  }
}

// ---------------------------------------------------------------------------
// EngineRuntimeRollingWindow — 60-tick rolling window of runtime metrics
// ---------------------------------------------------------------------------

export interface EngineRuntimeTickSnapshot {
  readonly tick: number;
  readonly netWorth: number;
  readonly shieldIntegrity: number;
  readonly pressureTier: string;
  readonly cascadeHealth: number;
  readonly sovereigntyGap: number;
  readonly tensionMomentum: number;
  readonly isLegendMoment: boolean;
}

export type EngineRuntimeTrend = 'ASCENDING' | 'DESCENDING' | 'STABLE';

export class EngineRuntimeRollingWindow {
  private readonly capacity: number;
  private readonly snapshots: EngineRuntimeTickSnapshot[] = [];

  public constructor(capacity = 60) { this.capacity = capacity; }

  public record(snap: EngineRuntimeTickSnapshot): void {
    if (this.snapshots.length >= this.capacity) this.snapshots.shift();
    this.snapshots.push(Object.freeze(snap));
  }

  public avgNetWorth(): number {
    if (this.snapshots.length === 0) return 0;
    return this.snapshots.reduce((s, r) => s + r.netWorth, 0) / this.snapshots.length;
  }

  public avgShieldIntegrity(): number {
    if (this.snapshots.length === 0) return 1;
    return this.snapshots.reduce((s, r) => s + r.shieldIntegrity, 0) / this.snapshots.length;
  }

  public legendMomentRate(): number {
    if (this.snapshots.length === 0) return 0;
    return this.snapshots.filter(s => s.isLegendMoment).length / this.snapshots.length;
  }

  public trend(): EngineRuntimeTrend {
    if (this.snapshots.length < 10) return 'STABLE';
    const half = Math.floor(this.snapshots.length / 2);
    const recentAvg = this.snapshots.slice(-half).reduce((s, r) => s + r.netWorth, 0) / half;
    const olderAvg = this.snapshots.slice(0, half).reduce((s, r) => s + r.netWorth, 0) / half;
    const delta = recentAvg - olderAvg;
    if (delta > 100) return 'ASCENDING';
    if (delta < -100) return 'DESCENDING';
    return 'STABLE';
  }

  public peakNetWorth(): number {
    if (this.snapshots.length === 0) return 0;
    return Math.max(...this.snapshots.map(s => s.netWorth));
  }

  public minShieldIntegrity(): number {
    if (this.snapshots.length === 0) return 1;
    return Math.min(...this.snapshots.map(s => s.shieldIntegrity));
  }

  public dominantPressureTier(): string {
    const counts: Record<string, number> = {};
    for (const s of this.snapshots) counts[s.pressureTier] = (counts[s.pressureTier] ?? 0) + 1;
    let max = 0; let tier = 'T0';
    for (const [t, c] of Object.entries(counts)) { if (c > max) { max = c; tier = t; } }
    return tier;
  }

  public clear(): void { this.snapshots.length = 0; }
  public size(): number { return this.snapshots.length; }
  public latest(): EngineRuntimeTickSnapshot | undefined {
    return this.snapshots[this.snapshots.length - 1];
  }
}

// ---------------------------------------------------------------------------
// EngineRuntimeHealthTracker
// ---------------------------------------------------------------------------

export type EngineRuntimeHealthGrade = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';

export interface EngineRuntimeHealthReport {
  readonly grade: EngineRuntimeHealthGrade;
  readonly avgNetWorth: number;
  readonly avgShieldIntegrity: number;
  readonly legendMomentRate: number;
  readonly trend: EngineRuntimeTrend;
  readonly dominantTier: string;
  readonly isHealthy: boolean;
  readonly isLegendSequence: boolean;
  readonly isCritical: boolean;
}

export class EngineRuntimeHealthTracker {
  private readonly window: EngineRuntimeRollingWindow;

  public constructor(window: EngineRuntimeRollingWindow) {
    this.window = window;
  }

  public computeGrade(): EngineRuntimeHealthGrade {
    const shield = this.window.avgShieldIntegrity();
    const legend = this.window.legendMomentRate();
    const trend = this.window.trend();
    const composite = shield * 0.5 + legend * 0.2 + (trend === 'ASCENDING' ? 0.3 : trend === 'STABLE' ? 0.15 : 0);
    if (composite >= 0.78) return 'S';
    if (composite >= 0.62) return 'A';
    if (composite >= 0.46) return 'B';
    if (composite >= 0.32) return 'C';
    if (composite >= 0.18) return 'D';
    return 'F';
  }

  public buildReport(): EngineRuntimeHealthReport {
    const grade = this.computeGrade();
    return Object.freeze({
      grade,
      avgNetWorth: this.window.avgNetWorth(),
      avgShieldIntegrity: this.window.avgShieldIntegrity(),
      legendMomentRate: this.window.legendMomentRate(),
      trend: this.window.trend(),
      dominantTier: this.window.dominantPressureTier(),
      isHealthy: grade === 'S' || grade === 'A' || grade === 'B',
      isLegendSequence: this.window.legendMomentRate() > 0.25,
      isCritical: grade === 'F' || grade === 'D',
    });
  }
}

// ---------------------------------------------------------------------------
// EngineRuntimeMLExtractor — 10-feature DL vector
// ---------------------------------------------------------------------------

export const ENGINE_RUNTIME_DL_FEATURE_LABELS: readonly string[] = Object.freeze([
  'avgNetWorthNorm',
  'avgShieldIntegrity',
  'legendMomentRate',
  'trendScore',
  'pressureTierNumeric',
  'cascadeHealthNorm',
  'sovereigntyGapNorm',
  'tensionMomentumNorm',
  'peakNetWorthNorm',
  'gradeNorm',
]);

export const ENGINE_RUNTIME_PRESSURE_NUMERIC: Record<string, number> = {
  T0: 0, T1: 0.25, T2: 0.5, T3: 0.75, T4: 1,
};

export interface EngineRuntimeDLVector {
  readonly tick: number;
  readonly features: readonly number[];
  readonly labels: readonly string[];
  readonly dominantTrend: EngineRuntimeTrend;
}

export class EngineRuntimeMLExtractor {
  private readonly window: EngineRuntimeRollingWindow;
  private readonly healthTracker: EngineRuntimeHealthTracker;

  public constructor(window: EngineRuntimeRollingWindow, healthTracker: EngineRuntimeHealthTracker) {
    this.window = window;
    this.healthTracker = healthTracker;
  }

  public extract(tick: number): EngineRuntimeDLVector {
    const gradeMap: Record<EngineRuntimeHealthGrade, number> = { S: 1, A: 0.85, B: 0.7, C: 0.5, D: 0.3, F: 0 };
    const latest = this.window.latest();
    const avgNW = Math.min(this.window.avgNetWorth() / 10_000, 1);
    const shield = this.window.avgShieldIntegrity();
    const legend = this.window.legendMomentRate();
    const trend = this.window.trend();
    const trendScore = trend === 'ASCENDING' ? 1 : trend === 'DESCENDING' ? 0 : 0.5;
    const tierNumeric = ENGINE_RUNTIME_PRESSURE_NUMERIC[this.window.dominantPressureTier()] ?? 0;
    const cascadeNorm = Math.min((latest?.cascadeHealth ?? 0) / 100, 1);
    const sovNorm = Math.min(Math.abs(latest?.sovereigntyGap ?? 0) / 500, 1);
    const tensionNorm = Math.min(Math.abs(latest?.tensionMomentum ?? 0) / 100, 1);
    const peakNW = Math.min(this.window.peakNetWorth() / 10_000, 1);
    const gradeNorm = gradeMap[this.healthTracker.computeGrade()];

    return Object.freeze({
      tick,
      features: Object.freeze([avgNW, shield, legend, trendScore, tierNumeric, cascadeNorm, sovNorm, tensionNorm, peakNW, gradeNorm]),
      labels: ENGINE_RUNTIME_DL_FEATURE_LABELS,
      dominantTrend: trend,
    });
  }
}

// ---------------------------------------------------------------------------
// EngineRuntimeDiagnosticsService
// ---------------------------------------------------------------------------

export class EngineRuntimeDiagnosticsService {
  public readonly window: EngineRuntimeRollingWindow;
  public readonly healthTracker: EngineRuntimeHealthTracker;
  public readonly mlExtractor: EngineRuntimeMLExtractor;

  public constructor() {
    this.window = new EngineRuntimeRollingWindow(60);
    this.healthTracker = new EngineRuntimeHealthTracker(this.window);
    this.mlExtractor = new EngineRuntimeMLExtractor(this.window, this.healthTracker);
  }

  public healthReport(): EngineRuntimeHealthReport {
    return this.healthTracker.buildReport();
  }

  public mlVector(tick: number): EngineRuntimeDLVector {
    return this.mlExtractor.extract(tick);
  }

  public reset(): void { this.window.clear(); }
}

// ---------------------------------------------------------------------------
// Module constants
// ---------------------------------------------------------------------------

export const ENGINE_RUNTIME_MODULE_VERSION = '2.0.0' as const;
export const ENGINE_RUNTIME_MODULE_READY = true;
export const ENGINE_RUNTIME_DL_FEATURE_COUNT = ENGINE_RUNTIME_DL_FEATURE_LABELS.length;
export const ENGINE_RUNTIME_COMPLETE = true;
