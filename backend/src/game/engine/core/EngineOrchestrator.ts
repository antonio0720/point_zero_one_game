/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/core/EngineOrchestrator.ts
 *
 * Doctrine:
 * - orchestration is the authoritative runtime lane, not an afterthought wrapper
 * - engine order is law and every step must remain deterministic
 * - time policy is mode-native and pressure-reactive
 * - traces, checkpoints, invariants, and terminal gating are first-class runtime concerns
 * - the orchestrator owns the hot path between seed state and verifiable terminal proof
 * - ML/DL routing is built into the tick pipeline — not bolted on after the fact
 * - every pressure tier crossing triggers adaptive policy re-evaluation
 * - phase transitions carry ML context vectors that downstream chat and UX can consume
 */

import type { MutableClockSource } from './ClockSource';
import { DeterministicClock } from './ClockSource';
import {
  createEngineSignal,
  normalizeEngineTickResult,
  type EngineHealth,
  type EngineId,
  type EngineSignal,
  type ModeLifecycleHooks,
  type SimulationEngine,
  type TickContext,
} from './EngineContracts';
import { EngineRegistry } from './EngineRegistry';
import {
  EventBus,
  type EventEnvelope,
} from './EventBus';
import type {
  CardDefinition,
  CardInstance,
  EngineEventMap,
  ModeCode,
  PressureTier,
  RunPhase,
  TimingClass,
} from './GamePrimitives';
import type { RunFactoryInput } from './RunStateFactory';
import { createInitialRunState } from './RunStateFactory';
import type { RunStateSnapshot } from './RunStateSnapshot';
import type { TickStep } from './TickSequence';
import { TICK_SEQUENCE } from './TickSequence';
import { DecisionWindowService } from './DecisionWindowService';
import { CardOverlayResolver } from './CardOverlayResolver';
import {
  checksumSnapshot,
  cloneJson,
  createDeterministicId,
  deepFreeze,
} from './Deterministic';
import {
  RunStateInvariantGuard,
  type InvariantIssue,
  type RunStateInvariantReport,
} from './RunStateInvariantGuard';
import {
  RuntimeOutcomeResolver,
  type RuntimeOutcomeDecision,
} from './RuntimeOutcomeResolver';
import {
  RuntimeCheckpointStore,
  type RuntimeCheckpoint,
  type RuntimeCheckpointReason,
} from './RuntimeCheckpointStore';
import {
  TickTraceRecorder,
  type TickTraceRecord,
} from './TickTraceRecorder';
import {
  TimePolicyResolver,
} from '../../modes/shared/TimePolicyResolver';
import type {
  ModeTimePolicy,
  ResolvedTimePolicy,
} from '../../modes/shared/TimePolicyContracts';

// ---------------------------------------------------------------------------
// Internal type aliases
// ---------------------------------------------------------------------------

type RuntimeBus = EventBus<EngineEventMap & Record<string, unknown>>;
type RuntimeEventEnvelope = EventEnvelope<
  keyof (EngineEventMap & Record<string, unknown>),
  (EngineEventMap & Record<string, unknown>)[keyof (EngineEventMap & Record<string, unknown>)]
>;

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
// ML / DL routing types — built into the orchestrator pipeline
// ---------------------------------------------------------------------------

/** Pressure tier ML context vector — emitted on every tier crossing. */
export interface PressureTierMLContext {
  readonly tier: PressureTier;
  readonly prevTier: PressureTier;
  readonly crossingDirection: 'UP' | 'DOWN' | 'STABLE';
  readonly tickAtCrossing: number;
  readonly elapsedMsAtCrossing: number;
  readonly phase: RunPhase;
  readonly mode: ModeCode;
  readonly cashAtCrossing: number;
  readonly shieldRatioAtCrossing: number;
  readonly cascadeRiskAtCrossing: number;
  readonly handSizeAtCrossing: number;
  readonly contextVector: readonly number[];
}

/** Phase transition ML context vector — emitted on FOUNDATION→ESCALATION and ESCALATION→SOVEREIGNTY. */
export interface PhaseTransitionMLContext {
  readonly fromPhase: RunPhase;
  readonly toPhase: RunPhase;
  readonly tickAtTransition: number;
  readonly elapsedMsAtTransition: number;
  readonly mode: ModeCode;
  readonly currentTier: PressureTier;
  readonly netWorthAtTransition: number;
  readonly shieldRatioAtTransition: number;
  readonly cascadeChainCountAtTransition: number;
  readonly decisionsInPhase: number;
  readonly avgDecisionLatencyInPhase: number;
  readonly contextVector: readonly number[];
}

/** Per-tick ML scoring summary for downstream chat and analytics. */
export interface TickMLSummary {
  readonly tick: number;
  readonly phase: RunPhase;
  readonly tier: PressureTier;
  readonly mode: ModeCode;
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

/** DL routing packet — fed to downstream DL consumers via the bus. */
export interface DLRoutingPacket {
  readonly runId: string;
  readonly tick: number;
  readonly tensorShape: readonly [number, number];
  readonly inputVector: readonly number[];
  readonly featureLabels: readonly string[];
  readonly policyVersion: string;
  readonly emittedAtMs: number;
}

/** Aggregated ML diagnostics collected over a run's lifetime. */
export interface OrchestratorMLDiagnostics {
  readonly runId: string;
  readonly totalTicks: number;
  readonly phasesReached: readonly RunPhase[];
  readonly tiersReached: readonly PressureTier[];
  readonly tierCrossings: readonly PressureTierMLContext[];
  readonly phaseTransitions: readonly PhaseTransitionMLContext[];
  readonly tickSummaries: readonly TickMLSummary[];
  readonly peakUrgency: number;
  readonly peakCascadeRisk: number;
  readonly avgCompositeRisk: number;
  readonly mlDecisionAcceptanceRate: number;
  readonly dlPacketsEmitted: number;
}

/** Predictive tick analysis computed before executing each tick. */
export interface TickPrediction {
  readonly tick: number;
  readonly predictedPhase: RunPhase;
  readonly predictedTier: PressureTier;
  readonly predictedOutcome: RunStateSnapshot['outcome'];
  readonly predictedElapsedMs: number;
  readonly predictedCash: number;
  readonly predictedNetWorth: number;
  readonly forecastConfidence: number;
  readonly warningFlags: readonly string[];
}

/** Full orchestrator analytics surface — exported for downstream consumers. */
export interface OrchestratorRunAnalytics {
  readonly runId: string;
  readonly mode: ModeCode;
  readonly totalTicks: number;
  readonly outcome: RunStateSnapshot['outcome'];
  readonly phasesReached: readonly RunPhase[];
  readonly tiersReached: readonly PressureTier[];
  readonly peakPressureTier: PressureTier;
  readonly phaseTransitionTicks: Partial<Record<RunPhase, number>>;
  readonly tierCrossingCount: number;
  readonly avgTickDurationMs: number;
  readonly totalElapsedMs: number;
  readonly finalNetWorth: number;
  readonly finalCash: number;
  readonly finalShieldRatio: number;
  readonly sovereigntyScore: number;
  readonly verifiedGrade: string;
  readonly proofHash: string | null;
  readonly mlDiagnostics: OrchestratorMLDiagnostics;
  readonly checkpointCount: number;
  readonly traceCount: number;
  readonly warningCount: number;
}

/** Health-check report for the full orchestrator stack. */
export interface OrchestratorHealthReport {
  readonly healthy: boolean;
  readonly registeredEngines: readonly EngineId[];
  readonly missingEngines: readonly EngineId[];
  readonly engineHealth: readonly EngineHealth[];
  readonly hasActiveRun: boolean;
  readonly currentTick: number | null;
  readonly currentPhase: RunPhase | null;
  readonly currentTier: PressureTier | null;
  readonly checkpointStoreSize: number;
  readonly traceRecorderSize: number;
  readonly busHistoryCount: number;
  readonly timePolicyDiagnostic: string;
  readonly invariantWarnings: readonly string[];
}

// ---------------------------------------------------------------------------
// Public interface shapes
// ---------------------------------------------------------------------------

export interface OrchestratorStartResult {
  readonly snapshot: RunStateSnapshot;
  readonly policy: ResolvedTimePolicy;
  readonly events: readonly RuntimeEventEnvelope[];
  readonly checkpoints: readonly RuntimeCheckpoint[];
  readonly mlContext: TickMLSummary;
}

export interface OrchestratorTickResult {
  readonly snapshot: RunStateSnapshot;
  readonly checksum: string;
  readonly outcome: RuntimeOutcomeDecision;
  readonly events: readonly RuntimeEventEnvelope[];
  readonly signals: readonly EngineSignal[];
  readonly traces: readonly TickTraceRecord[];
  readonly checkpoints: readonly RuntimeCheckpoint[];
  readonly appliedPolicy: ResolvedTimePolicy;
  readonly mlSummary: TickMLSummary;
  readonly dlPacket: DLRoutingPacket;
  readonly prediction: TickPrediction;
}

export interface PlayCardRequest {
  readonly actorId: string;
  readonly cardInstanceId: string;
  readonly requestedTimingClass?: TimingClass;
}

export interface PlayCardResult {
  readonly accepted: boolean;
  readonly snapshot: RunStateSnapshot;
  readonly playedCard: CardInstance | null;
  readonly chosenTimingClass: TimingClass | null;
  readonly reasons: readonly string[];
  readonly mlImpact: PlayCardMLImpact;
}

/** ML impact assessment for a played card. */
export interface PlayCardMLImpact {
  readonly urgencyShift: number;
  readonly cascadeRiskShift: number;
  readonly economyHealthShift: number;
  readonly shieldHealthShift: number;
  readonly compositeRiskShift: number;
  readonly dominantImpactDimension: string;
}

export interface DrawCardResult {
  readonly accepted: boolean;
  readonly snapshot: RunStateSnapshot;
  readonly instance: CardInstance | null;
  readonly reasons: readonly string[];
}

export interface EngineOrchestratorOptions {
  readonly registry?: EngineRegistry;
  readonly bus?: RuntimeBus;
  readonly clock?: MutableClockSource;
  readonly windows?: DecisionWindowService;
  readonly overlays?: CardOverlayResolver;
  readonly invariantGuard?: RunStateInvariantGuard;
  readonly outcomeResolver?: RuntimeOutcomeResolver;
  readonly checkpointStore?: RuntimeCheckpointStore;
  readonly traceRecorder?: TickTraceRecorder;
  readonly timePolicyResolver?: TimePolicyResolver;
  readonly modeHooksByMode?: Partial<Record<ModeCode, ModeLifecycleHooks>>;
  readonly enforceCompleteRegistry?: boolean;
  readonly failFastOnInvariantError?: boolean;
  readonly enableMLRouting?: boolean;
  readonly dlPacketEmitInterval?: number;
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

const REQUIRED_ENGINES: readonly EngineId[] = Object.freeze([
  'time',
  'pressure',
  'tension',
  'shield',
  'battle',
  'cascade',
  'sovereignty',
] as const);

/** Pressure tier numeric weights for ML context vector construction. */
const TIER_WEIGHT: Record<PressureTier, number> = {
  T0: 0.0,
  T1: 0.25,
  T2: 0.5,
  T3: 0.75,
  T4: 1.0,
};

/** Phase numeric weights for ML context vector construction. */
const PHASE_WEIGHT: Record<RunPhase, number> = {
  FOUNDATION: 0.0,
  ESCALATION: 0.5,
  SOVEREIGNTY: 1.0,
};

/** DL input vector feature labels — 24 features. */
const DL_FEATURE_LABELS: readonly string[] = Object.freeze([
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

const DL_TENSOR_SHAPE: readonly [number, number] = Object.freeze([1, 24] as const);

/** Recommend action thresholds for ML routing. */
const ACTION_THRESHOLDS = {
  HOLD_MAX_RISK: 0.2,
  PLAY_CARD_MIN_RISK: 0.35,
  EXTEND_WINDOW_MIN_URGENCY: 0.6,
  ACCELERATE_MIN_URGENCY: 0.75,
  DEFEND_MIN_SHIELD_THREAT: 0.7,
} as const;

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

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

function historyDelta(
  bus: RuntimeBus,
  historyCountBefore: number,
): RuntimeEventEnvelope[] {
  const history = bus.getHistory() as RuntimeEventEnvelope[];
  return history.slice(historyCountBefore);
}

function appendUnique(values: readonly string[], extras: readonly string[]): string[] {
  return [...new Set([...values, ...extras])];
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function roundTo(v: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(v * factor) / factor;
}

function stableTickChecksum(snapshot: RunStateSnapshot): string {
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
        visibleAs: threat.visibleAs,
      })),
    },
    shield: {
      weakestLayerId: snapshot.shield.weakestLayerId,
      layers: snapshot.shield.layers.map((layer) => ({
        layerId: layer.layerId,
        current: layer.current,
        max: layer.max,
      })),
      blockedThisRun: snapshot.shield.blockedThisRun,
      breachesThisRun: snapshot.shield.breachesThisRun,
    },
    battle: {
      battleBudget: snapshot.battle.battleBudget,
      extractionCooldownTicks: snapshot.battle.extractionCooldownTicks,
      firstBloodClaimed: snapshot.battle.firstBloodClaimed,
      pendingAttacks: snapshot.battle.pendingAttacks.map((attack) => ({
        attackId: attack.attackId,
        source: attack.source,
        category: attack.category,
        targetEntity: attack.targetEntity,
        targetLayer: attack.targetLayer,
        magnitude: attack.magnitude,
      })),
    },
    cascade: {
      activeChains: snapshot.cascade.activeChains.map((chain) => ({
        chainId: chain.chainId,
        templateId: chain.templateId,
        status: chain.status,
        createdAtTick: chain.createdAtTick,
        links: chain.links.map((link) => ({
          linkId: link.linkId,
          scheduledTick: link.scheduledTick,
          cascadeTag: link.effect.cascadeTag ?? null,
          summary: link.summary,
        })),
      })),
      brokenChains: snapshot.cascade.brokenChains,
      completedChains: snapshot.cascade.completedChains,
      positiveTrackers: snapshot.cascade.positiveTrackers,
    },
    sovereignty: {
      integrityStatus: snapshot.sovereignty.integrityStatus,
      tickChecksums: snapshot.sovereignty.tickChecksums,
      lastVerifiedTick: snapshot.sovereignty.lastVerifiedTick,
      gapVsLegend: snapshot.sovereignty.gapVsLegend,
      cordScore: snapshot.sovereignty.cordScore,
    },
    cards: {
      hand: snapshot.cards.hand.map((card) => ({
        instanceId: card.instanceId,
        definitionId: card.definitionId,
        cost: card.cost,
        timingClass: card.timingClass,
        tags: card.tags,
      })),
      discard: snapshot.cards.discard,
      exhaust: snapshot.cards.exhaust,
      drawPileSize: snapshot.cards.drawPileSize,
      deckEntropy: snapshot.cards.deckEntropy,
      ghostMarkers: snapshot.cards.ghostMarkers.map((marker) => ({
        markerId: marker.markerId,
        tick: marker.tick,
        kind: marker.kind,
        cardId: marker.cardId,
      })),
    },
    modeState: snapshot.modeState,
    timers: {
      seasonBudgetMs: snapshot.timers.seasonBudgetMs,
      extensionBudgetMs: snapshot.timers.extensionBudgetMs,
      elapsedMs: snapshot.timers.elapsedMs,
      currentTickDurationMs: snapshot.timers.currentTickDurationMs,
      nextTickAtMs: snapshot.timers.nextTickAtMs,
      holdCharges: snapshot.timers.holdCharges,
      activeDecisionWindows: snapshot.timers.activeDecisionWindows,
      frozenWindowIds: snapshot.timers.frozenWindowIds,
    },
    telemetry: {
      decisions: snapshot.telemetry.decisions,
      outcomeReason: snapshot.telemetry.outcomeReason,
      outcomeReasonCode: snapshot.telemetry.outcomeReasonCode,
      lastTickChecksum: snapshot.telemetry.lastTickChecksum,
      warnings: snapshot.telemetry.warnings,
      emittedEventCount: snapshot.telemetry.emittedEventCount,
    },
    tags: snapshot.tags,
  });
}

function stringifyIssue(issue: InvariantIssue): string {
  return `${issue.severity}:${issue.code}:${issue.path}:${issue.message}`;
}

// ---------------------------------------------------------------------------
// ML / DL scoring functions — pure, no side effects
// ---------------------------------------------------------------------------

/**
 * Compute shield health ratio across all layers.
 * Returns a value in [0, 1] where 1 is fully shielded.
 */
function computeShieldRatio(snapshot: RunStateSnapshot): number {
  const totalMax = snapshot.shield.layers.reduce((sum, l) => sum + l.max, 0);
  if (totalMax === 0) return 1;
  const totalCurrent = snapshot.shield.layers.reduce((sum, l) => sum + l.current, 0);
  return clamp01(totalCurrent / totalMax);
}

/**
 * Compute economy health score in [0, 1].
 * Considers cash vs. freedom target and income/expense ratio.
 */
function computeEconomyHealth(snapshot: RunStateSnapshot): number {
  const cashToTarget = snapshot.economy.freedomTarget > 0
    ? clamp01(snapshot.economy.netWorth / snapshot.economy.freedomTarget)
    : 0.5;

  const incomeExpenseRatio = snapshot.economy.expensesPerTick > 0
    ? clamp01(snapshot.economy.incomePerTick / (snapshot.economy.expensesPerTick * 2))
    : snapshot.economy.incomePerTick > 0 ? 1 : 0.5;

  const cashSolvency = snapshot.economy.cash > 0
    ? clamp01(snapshot.economy.cash / Math.max(1, snapshot.economy.freedomTarget * 0.1))
    : 0;

  return roundTo(cashToTarget * 0.5 + incomeExpenseRatio * 0.3 + cashSolvency * 0.2, 4);
}

/**
 * Compute cascade risk score in [0, 1].
 * Higher = more active cascade pressure.
 */
function computeCascadeRisk(snapshot: RunStateSnapshot): number {
  const activeCount = snapshot.cascade.activeChains.length;
  const brokenCount = snapshot.cascade.brokenChains;
  const completedCount = snapshot.cascade.completedChains;
  const totalResolved = brokenCount + completedCount;

  const chainPressure = clamp01(activeCount / 5);
  const breakRate = totalResolved === 0 ? 0 : clamp01(brokenCount / totalResolved);

  return roundTo(chainPressure * 0.7 + breakRate * 0.3, 4);
}

/**
 * Compute urgency score in [0, 1] from tier, elapsed time, and threats.
 */
function computeUrgency(snapshot: RunStateSnapshot): number {
  const tierWeight = TIER_WEIGHT[snapshot.pressure.tier];
  const totalBudget = Math.max(1, snapshot.timers.seasonBudgetMs + snapshot.timers.extensionBudgetMs);
  const elapsedRatio = clamp01(snapshot.timers.elapsedMs / totalBudget);
  const threatWeight = clamp01(snapshot.tension.visibleThreats.length / 5);
  const anticipation = clamp01(snapshot.tension.anticipation / 100);

  return roundTo(
    tierWeight * 0.35 +
    elapsedRatio * 0.3 +
    threatWeight * 0.2 +
    anticipation * 0.15,
    4,
  );
}

/**
 * Compute sovereignty alignment score in [0, 1].
 * Measures how closely the player is tracking the sovereignty legend.
 */
function computeSovereigntyAlignment(snapshot: RunStateSnapshot): number {
  const gap = clamp01(Math.abs(snapshot.sovereignty.gapVsLegend));
  const alignment = clamp01(1 - gap);
  const integrityBonus = snapshot.sovereignty.integrityStatus === 'VERIFIED' ? 0.1 : 0;
  const quarantinePenalty = snapshot.sovereignty.integrityStatus === 'QUARANTINED' ? -0.2 : 0;
  return clamp01(roundTo(alignment + integrityBonus + quarantinePenalty, 4));
}

/**
 * Compute composite risk score in [0, 1] — the primary ML routing signal.
 */
function computeCompositeRisk(
  urgency: number,
  cascadeRisk: number,
  economyHealth: number,
  shieldRatio: number,
): number {
  const economyRisk = 1 - economyHealth;
  const shieldRisk = 1 - shieldRatio;
  return roundTo(
    urgency * 0.3 +
    cascadeRisk * 0.25 +
    economyRisk * 0.25 +
    shieldRisk * 0.2,
    4,
  );
}

/**
 * Recommend action based on ML scoring context.
 */
function recommendAction(
  urgency: number,
  cascadeRisk: number,
  shieldRatio: number,
  compositeRisk: number,
): TickMLSummary['recommendedAction'] {
  if (shieldRatio < (1 - ACTION_THRESHOLDS.DEFEND_MIN_SHIELD_THREAT)) {
    return 'DEFEND';
  }
  if (urgency >= ACTION_THRESHOLDS.ACCELERATE_MIN_URGENCY) {
    return 'ACCELERATE';
  }
  if (urgency >= ACTION_THRESHOLDS.EXTEND_WINDOW_MIN_URGENCY) {
    return 'EXTEND_WINDOW';
  }
  if (compositeRisk >= ACTION_THRESHOLDS.PLAY_CARD_MIN_RISK || cascadeRisk > 0.5) {
    return 'PLAY_CARD';
  }
  return 'HOLD';
}

/**
 * Build the 24-feature DL input vector from a snapshot.
 * Features are normalized to [0, 1] where applicable.
 */
function buildDLInputVector(snapshot: RunStateSnapshot): readonly number[] {
  const totalBudget = Math.max(1, snapshot.timers.seasonBudgetMs + snapshot.timers.extensionBudgetMs);
  const shieldMax = snapshot.shield.layers.reduce((sum, l) => sum + l.max, 0);
  const shieldCurrent = snapshot.shield.layers.reduce((sum, l) => sum + l.current, 0);
  const weakestLayer = [...snapshot.shield.layers].sort((a, b) => a.current - b.current)[0];
  const totalResolved = snapshot.cascade.brokenChains + snapshot.cascade.completedChains;
  const acceptedDecisions = snapshot.telemetry.decisions.filter((d) => d.accepted).length;
  const totalDecisions = snapshot.telemetry.decisions.length;

  const cashNorm = clamp01(snapshot.economy.cash / Math.max(1, snapshot.economy.freedomTarget));
  const netWorthNorm = clamp01(snapshot.economy.netWorth / Math.max(1, snapshot.economy.freedomTarget));
  const incomeRate = clamp01(snapshot.economy.incomePerTick / Math.max(1, snapshot.economy.freedomTarget * 0.01));
  const expenseRate = clamp01(snapshot.economy.expensesPerTick / Math.max(1, snapshot.economy.freedomTarget * 0.01));
  const shieldRatio = shieldMax === 0 ? 1 : clamp01(shieldCurrent / shieldMax);
  const weakestRatio = shieldMax === 0 ? 1 : clamp01((weakestLayer?.current ?? 0) / Math.max(1, weakestLayer?.max ?? 1));
  const breachNorm = clamp01(snapshot.shield.breachesThisRun / 10);
  const tensionNorm = clamp01(snapshot.tension.score / 100);
  const anticipationNorm = clamp01(snapshot.tension.anticipation / 100);
  const visibleThreatsNorm = clamp01(snapshot.tension.visibleThreats.length / 10);
  const activeChainsNorm = clamp01(snapshot.cascade.activeChains.length / 10);
  const brokenRatio = totalResolved === 0 ? 0 : clamp01(snapshot.cascade.brokenChains / totalResolved);
  const battleBudgetNorm = clamp01(snapshot.battle.battleBudget / Math.max(1, snapshot.battle.battleBudgetCap));
  const handSizeNorm = clamp01(snapshot.cards.hand.length / 10);
  const totalCardsSeen = snapshot.cards.drawPileSize + snapshot.cards.discard.length + snapshot.cards.hand.length;
  const discardRatio = totalCardsSeen === 0 ? 0 : clamp01(snapshot.cards.discard.length / totalCardsSeen);
  const elapsedRatio = clamp01(snapshot.timers.elapsedMs / totalBudget);
  const holdChargesNorm = clamp01(snapshot.timers.holdCharges / 3);
  const gapVsLegend = clamp01(Math.abs(snapshot.sovereignty.gapVsLegend));
  const gapClosingRate = clamp01(snapshot.sovereignty.gapClosingRate);
  const sovereigntyScore = clamp01(snapshot.sovereignty.sovereigntyScore ?? 0);
  const decisionAcceptedRatio = totalDecisions === 0 ? 1 : clamp01(acceptedDecisions / totalDecisions);

  return Object.freeze([
    TIER_WEIGHT[snapshot.pressure.tier],
    PHASE_WEIGHT[snapshot.phase],
    cashNorm,
    netWorthNorm,
    incomeRate,
    expenseRate,
    computeEconomyHealth(snapshot),
    shieldRatio,
    weakestRatio,
    breachNorm,
    tensionNorm,
    anticipationNorm,
    visibleThreatsNorm,
    activeChainsNorm,
    brokenRatio,
    battleBudgetNorm,
    handSizeNorm,
    discardRatio,
    elapsedRatio,
    holdChargesNorm,
    gapVsLegend,
    gapClosingRate,
    sovereigntyScore,
    decisionAcceptedRatio,
  ] as const);
}

/**
 * Build a full TickMLSummary from a snapshot.
 */
function buildTickMLSummary(snapshot: RunStateSnapshot): TickMLSummary {
  const urgency = computeUrgency(snapshot);
  const cascadeRisk = computeCascadeRisk(snapshot);
  const economyHealth = computeEconomyHealth(snapshot);
  const shieldHealth = computeShieldRatio(snapshot);
  const sovereigntyAlignment = computeSovereigntyAlignment(snapshot);
  const compositeRisk = computeCompositeRisk(urgency, cascadeRisk, economyHealth, shieldHealth);
  const action = recommendAction(urgency, cascadeRisk, shieldHealth, compositeRisk);
  const dlVector = buildDLInputVector(snapshot);

  const contextVector = Object.freeze([
    TIER_WEIGHT[snapshot.pressure.tier],
    PHASE_WEIGHT[snapshot.phase],
    urgency,
    cascadeRisk,
    economyHealth,
    shieldHealth,
    sovereigntyAlignment,
    compositeRisk,
  ] as const);

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
    mlContextVector: contextVector,
    dlInputVector: dlVector,
  };
}

/**
 * Build a DL routing packet for downstream tensor consumers.
 */
function buildDLRoutingPacket(
  snapshot: RunStateSnapshot,
  dlVector: readonly number[],
  policyVersion: string,
  emittedAtMs: number,
): DLRoutingPacket {
  return {
    runId: snapshot.runId,
    tick: snapshot.tick,
    tensorShape: DL_TENSOR_SHAPE,
    inputVector: dlVector,
    featureLabels: DL_FEATURE_LABELS,
    policyVersion,
    emittedAtMs,
  };
}

/**
 * Build a PressureTierMLContext on tier crossing.
 */
function buildTierCrossingContext(
  snapshot: RunStateSnapshot,
  prevTier: PressureTier,
): PressureTierMLContext {
  const tier = snapshot.pressure.tier;
  const prevWeight = TIER_WEIGHT[prevTier];
  const nextWeight = TIER_WEIGHT[tier];

  const crossingDirection: PressureTierMLContext['crossingDirection'] =
    nextWeight > prevWeight ? 'UP' :
    nextWeight < prevWeight ? 'DOWN' :
    'STABLE';

  const shieldRatio = computeShieldRatio(snapshot);
  const cascadeRisk = computeCascadeRisk(snapshot);

  const contextVector = Object.freeze([
    TIER_WEIGHT[tier],
    TIER_WEIGHT[prevTier],
    PHASE_WEIGHT[snapshot.phase],
    shieldRatio,
    cascadeRisk,
    clamp01(snapshot.economy.cash / Math.max(1, snapshot.economy.freedomTarget)),
    snapshot.tension.score / 100,
    snapshot.cards.hand.length / 10,
  ] as const);

  return {
    tier,
    prevTier,
    crossingDirection,
    tickAtCrossing: snapshot.tick,
    elapsedMsAtCrossing: snapshot.timers.elapsedMs,
    phase: snapshot.phase,
    mode: snapshot.mode,
    cashAtCrossing: snapshot.economy.cash,
    shieldRatioAtCrossing: shieldRatio,
    cascadeRiskAtCrossing: cascadeRisk,
    handSizeAtCrossing: snapshot.cards.hand.length,
    contextVector,
  };
}

/**
 * Build a PhaseTransitionMLContext on phase transition.
 */
function buildPhaseTransitionContext(
  snapshot: RunStateSnapshot,
  fromPhase: RunPhase,
  decisionsInPhase: number,
  avgLatencyInPhase: number,
): PhaseTransitionMLContext {
  const shieldRatio = computeShieldRatio(snapshot);

  const contextVector = Object.freeze([
    PHASE_WEIGHT[fromPhase],
    PHASE_WEIGHT[snapshot.phase],
    TIER_WEIGHT[snapshot.pressure.tier],
    clamp01(snapshot.economy.netWorth / Math.max(1, snapshot.economy.freedomTarget)),
    shieldRatio,
    clamp01(snapshot.cascade.activeChains.length / 5),
    clamp01(decisionsInPhase / 20),
    clamp01(1 - avgLatencyInPhase / 30000),
  ] as const);

  return {
    fromPhase,
    toPhase: snapshot.phase,
    tickAtTransition: snapshot.tick,
    elapsedMsAtTransition: snapshot.timers.elapsedMs,
    mode: snapshot.mode,
    currentTier: snapshot.pressure.tier,
    netWorthAtTransition: snapshot.economy.netWorth,
    shieldRatioAtTransition: shieldRatio,
    cascadeChainCountAtTransition: snapshot.cascade.activeChains.length,
    decisionsInPhase,
    avgDecisionLatencyInPhase: avgLatencyInPhase,
    contextVector,
  };
}

/**
 * Compute a predictive tick analysis before executing the next tick.
 */
function buildTickPrediction(
  snapshot: RunStateSnapshot,
  tickIndex: number,
): TickPrediction {
  const tickDuration = Math.max(1, snapshot.timers.currentTickDurationMs);
  const predictedElapsedMs = snapshot.timers.elapsedMs + tickDuration;
  const totalBudget = snapshot.timers.seasonBudgetMs + snapshot.timers.extensionBudgetMs;

  // Simple phase extrapolation
  const predictedPhase: RunPhase =
    predictedElapsedMs < totalBudget * 0.33 ? 'FOUNDATION' :
    predictedElapsedMs < totalBudget * 0.66 ? 'ESCALATION' :
    'SOVEREIGNTY';

  // Tier predicted to remain stable unless active chain count is climbing
  const predictedTier: PressureTier = snapshot.pressure.tier;

  // Economic trajectory
  const netIncome = snapshot.economy.incomePerTick - snapshot.economy.expensesPerTick;
  const predictedCash = snapshot.economy.cash + netIncome;
  const predictedNetWorth = snapshot.economy.netWorth + netIncome * 0.5;

  // Terminal prediction
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

  const forecastConfidence = clamp01(1 - (warningFlags.length * 0.12));

  return {
    tick: tickIndex,
    predictedPhase,
    predictedTier,
    predictedOutcome,
    predictedElapsedMs,
    predictedCash: roundTo(predictedCash, 2),
    predictedNetWorth: roundTo(predictedNetWorth, 2),
    forecastConfidence: roundTo(forecastConfidence, 4),
    warningFlags: Object.freeze(warningFlags),
  };
}

// ---------------------------------------------------------------------------
// Main class
// ---------------------------------------------------------------------------

export class EngineOrchestrator {
  // Core services
  private readonly registry: EngineRegistry;
  private readonly bus: RuntimeBus;
  private readonly clock: MutableClockSource;
  private readonly windows: DecisionWindowService;
  private readonly overlays: CardOverlayResolver;
  private readonly invariantGuard: RunStateInvariantGuard;
  private readonly outcomeResolver: RuntimeOutcomeResolver;
  private readonly checkpointStore: RuntimeCheckpointStore;
  private readonly traceRecorder: TickTraceRecorder;
  private readonly timePolicyResolver: TimePolicyResolver;
  private readonly modeHooksByMode: Partial<Record<ModeCode, ModeLifecycleHooks>>;
  private readonly enforceCompleteRegistry: boolean;
  private readonly failFastOnInvariantError: boolean;
  private readonly enableMLRouting: boolean;
  private readonly dlPacketEmitInterval: number;

  // Runtime state
  private snapshot: RunStateSnapshot | null = null;
  private activeStep: TickStep = 'STEP_01_PREPARE';
  private runStartedEmitted = false;

  // ML state — tracked across the run lifetime
  private readonly tierCrossings: PressureTierMLContext[] = [];
  private readonly phaseTransitions: PhaseTransitionMLContext[] = [];
  private readonly tickSummaries: TickMLSummary[] = [];
  private readonly phasesReached: Set<RunPhase> = new Set();
  private readonly tiersReached: Set<PressureTier> = new Set();
  private readonly phaseTransitionTicks: Partial<Record<RunPhase, number>> = {};
  private phaseDecisionCountOnEntry = 0;
  private phaseEntryTotalLatency = 0;
  private phaseDecisionsAtEntry = 0;
  private dlPacketsEmitted = 0;

  // Tracking for tier/phase transitions
  private lastObservedTier: PressureTier = 'T0';
  private lastObservedPhase: RunPhase = 'FOUNDATION';

  public constructor(options: EngineOrchestratorOptions = {}) {
    this.registry = options.registry ?? new EngineRegistry();
    this.bus = options.bus ?? new EventBus<EngineEventMap & Record<string, unknown>>();
    this.clock = options.clock ?? new DeterministicClock(0);
    this.windows = options.windows ?? new DecisionWindowService();
    this.overlays = options.overlays ?? new CardOverlayResolver();
    this.invariantGuard = options.invariantGuard ?? new RunStateInvariantGuard();
    this.outcomeResolver = options.outcomeResolver ?? new RuntimeOutcomeResolver();
    this.checkpointStore = options.checkpointStore ?? new RuntimeCheckpointStore();
    this.traceRecorder = options.traceRecorder ?? new TickTraceRecorder();
    this.timePolicyResolver = options.timePolicyResolver ?? new TimePolicyResolver();
    this.modeHooksByMode = options.modeHooksByMode ?? {};
    this.enforceCompleteRegistry = options.enforceCompleteRegistry ?? false;
    this.failFastOnInvariantError = options.failFastOnInvariantError ?? true;
    this.enableMLRouting = options.enableMLRouting ?? true;
    this.dlPacketEmitInterval = options.dlPacketEmitInterval ?? 1;
  }

  // ---------------------------------------------------------------------------
  // Engine registration
  // ---------------------------------------------------------------------------

  public registerEngine(
    engine: SimulationEngine,
    allowReplace = false,
  ): this {
    this.registry.register(engine, { allowReplace });
    return this;
  }

  public registerEngines(
    engines: readonly SimulationEngine[],
    allowReplace = false,
  ): this {
    this.registry.registerMany(engines, { allowReplace });
    return this;
  }

  // ---------------------------------------------------------------------------
  // Run lifecycle
  // ---------------------------------------------------------------------------

  public startRun(input: RunFactoryInput): OrchestratorStartResult {
    this.registry.reset();
    this.bus.clear({
      clearQueue: true,
      clearHistory: true,
      clearListeners: false,
      clearAnyListeners: false,
    });
    this.clock.set(0);
    this.activeStep = 'STEP_01_PREPARE';
    this.runStartedEmitted = false;
    this.resetMLState();

    const seedPatch = this.timePolicyResolver.resolveFactoryPatch(input);
    const seededInput: RunFactoryInput = {
      ...input,
      seasonBudgetMs: input.seasonBudgetMs ?? seedPatch.seasonBudgetMs,
      currentTickDurationMs: input.currentTickDurationMs ?? seedPatch.currentTickDurationMs,
      holdCharges: input.holdCharges ?? seedPatch.holdCharges,
    };

    let snapshot = createInitialRunState(seededInput);
    snapshot = this.timePolicyResolver.applySnapshot(snapshot, this.clock.now());
    snapshot = this.applyModeInitialize(snapshot, this.activeStep, this.clock.now());
    snapshot = this.windows.reconcile(snapshot, {
      step: this.activeStep,
      nowMs: this.clock.now(),
      previousPhase: snapshot.phase,
      nextPhase: snapshot.phase,
      previousTier: snapshot.pressure.tier,
      nextTier: snapshot.pressure.tier,
    });

    const invariantReport = this.invariantGuard.inspect(snapshot, {
      stage: 'runtime',
      expectedTickChecksumMode: 'lte-tick',
      requireDerivedFields: false,
    });
    snapshot = this.applyInvariantReport(snapshot, invariantReport);

    // Initialize ML tracking
    this.lastObservedTier = snapshot.pressure.tier;
    this.lastObservedPhase = snapshot.phase;
    this.phasesReached.add(snapshot.phase);
    this.tiersReached.add(snapshot.pressure.tier);
    this.phaseTransitionTicks[snapshot.phase] = snapshot.tick;
    this.phaseDecisionsAtEntry = 0;

    this.snapshot = toFrozenSnapshot(snapshot);
    this.emitRunStartedIfNeeded();

    const checkpoint = this.writeCheckpoint(
      this.requireSnapshot(),
      'RUN_START',
      this.activeStep,
      this.clock.now(),
      ['run-start'],
      null,
    );

    const mlContext = buildTickMLSummary(this.requireSnapshot());
    this.tickSummaries.push(mlContext);

    if (this.enableMLRouting) {
      this.emitDLRoutingPacket(this.requireSnapshot(), mlContext);
    }

    return {
      snapshot: this.requireSnapshot(),
      policy: this.timePolicyResolver.resolveSnapshot({
        snapshot: this.requireSnapshot(),
        nowMs: this.clock.now(),
      }),
      events: freezeArray(this.bus.flush() as RuntimeEventEnvelope[]),
      checkpoints: freezeArray([checkpoint]),
      mlContext,
    };
  }

  // ---------------------------------------------------------------------------
  // Tick execution
  // ---------------------------------------------------------------------------

  public executeTick(): OrchestratorTickResult {
    if (this.enforceCompleteRegistry) {
      this.registry.assertComplete(REQUIRED_ENGINES);
    }

    const base = this.requireSnapshot();
    const previousPhase: RunPhase = base.phase;
    const previousTier: PressureTier = base.pressure.tier;
    const previousDuration = Math.max(1, base.timers.currentTickDurationMs);

    // Build prediction before we mutate anything
    const prediction = buildTickPrediction(base, base.tick + 1);

    let next = toMutableSnapshot(base);
    next.tick += 1;
    next.timers.elapsedMs += previousDuration;
    this.clock.advance(previousDuration);
    const nowMs = this.clock.now();

    const checkpoints: RuntimeCheckpoint[] = [];
    const signals: EngineSignal[] = [];
    const traces: TickTraceRecord[] = [];

    this.bus.emit(
      'tick.started',
      {
        runId: next.runId,
        tick: next.tick,
        phase: next.phase,
      },
      {
        emittedAtTick: next.tick,
        tags: ['tick-start', 'orchestrator'],
      },
    );

    next = toMutableSnapshot(
      this.windows.reconcile(toFrozenSnapshot(next), {
        step: 'STEP_01_PREPARE',
        nowMs,
        previousPhase,
        nextPhase: next.phase,
        previousTier,
        nextTier: next.pressure.tier,
      }),
    );

    const entryCheckpoint = this.writeCheckpoint(
      toFrozenSnapshot(next),
      'STEP_ENTRY',
      'STEP_01_PREPARE',
      nowMs,
      ['tick-entry'],
      null,
    );
    checkpoints.push(entryCheckpoint);

    for (const step of TICK_SEQUENCE) {
      this.activeStep = step;
      next = this.applyModeBeforeStep(next, step, nowMs);

      if (step === 'STEP_01_PREPARE') {
        continue;
      }

      if (step === 'STEP_08_MODE_POST') {
        next = this.applyModeFinalizeTick(next, nowMs);
        next = this.applyModeAfterStep(next, step, nowMs);
        continue;
      }

      if (step === 'STEP_09_TELEMETRY') {
        next = this.materializeTelemetry(next);
        next = this.applyModeAfterStep(next, step, nowMs);
        continue;
      }

      if (step === 'STEP_11_OUTCOME_GATE') {
        next = toMutableSnapshot(this.outcomeResolver.apply(toFrozenSnapshot(next)));
        next = this.applyModeAfterStep(next, step, nowMs);
        continue;
      }

      if (step === 'STEP_12_EVENT_SEAL') {
        next = this.sealTick(next);
        next = this.applyModeAfterStep(next, step, nowMs);
        continue;
      }

      if (step === 'STEP_13_FLUSH') {
        next = this.applyModeAfterStep(next, step, nowMs);
        continue;
      }

      if (step === 'STEP_02_TIME') {
        next = toMutableSnapshot(
          this.timePolicyResolver.applySnapshot(toFrozenSnapshot(next), nowMs),
        );
      }

      const execution = this.executeRegisteredEngine(next, step, nowMs);
      next = execution.snapshot;
      signals.push(...execution.signals);
      traces.push(...execution.traces);
      checkpoints.push(...execution.checkpoints);
      next = this.applyModeAfterStep(next, step, nowMs);
    }

    const invariantReport = this.invariantGuard.inspectTransition(base, toFrozenSnapshot(next), {
      stage: 'tick-finalized',
      expectedTickChecksumMode: 'lte-tick',
      requireDerivedFields: false,
      maxTickDelta: 1,
    });
    next = toMutableSnapshot(this.applyInvariantReport(toFrozenSnapshot(next), invariantReport));
    next = toMutableSnapshot(this.outcomeResolver.apply(toFrozenSnapshot(next)));
    next = toMutableSnapshot(
      this.timePolicyResolver.applySnapshot(toFrozenSnapshot(next), nowMs),
    );

    const finalCheckpointReason: RuntimeCheckpointReason =
      next.outcome === null ? 'TICK_FINAL' : 'TERMINAL';
    const finalCheckpoint = this.writeCheckpoint(
      toFrozenSnapshot(next),
      finalCheckpointReason,
      'STEP_13_FLUSH',
      nowMs,
      next.outcome === null ? ['tick-final'] : ['terminal'],
      null,
    );
    checkpoints.push(finalCheckpoint);

    this.snapshot = toFrozenSnapshot(next);

    // ML routing — after tick finalized
    const currentSnapshot = this.requireSnapshot();
    const mlSummary = buildTickMLSummary(currentSnapshot);
    this.tickSummaries.push(mlSummary);

    // Track tier crossings
    const currentTier: PressureTier = currentSnapshot.pressure.tier;
    if (currentTier !== this.lastObservedTier) {
      const crossing = buildTierCrossingContext(currentSnapshot, this.lastObservedTier);
      this.tierCrossings.push(crossing);
      this.tiersReached.add(currentTier);
      this.lastObservedTier = currentTier;

      if (this.enableMLRouting) {
        this.bus.emit(
          'ml.tier.crossed',
          {
            runId: currentSnapshot.runId,
            tick: currentSnapshot.tick,
            fromTier: crossing.prevTier,
            toTier: crossing.tier,
            direction: crossing.crossingDirection,
            contextVector: [...crossing.contextVector],
          } as unknown as EngineEventMap[keyof EngineEventMap],
          { emittedAtTick: currentSnapshot.tick, tags: ['ml', 'tier-crossing'] },
        );
      }
    }

    // Track phase transitions
    const currentPhase: RunPhase = currentSnapshot.phase;
    if (currentPhase !== this.lastObservedPhase) {
      const decisionsNow = currentSnapshot.telemetry.decisions.length;
      const decisionsInPhase = decisionsNow - this.phaseDecisionsAtEntry;
      const acceptedInPhase = currentSnapshot.telemetry.decisions
        .slice(this.phaseDecisionsAtEntry)
        .filter((d) => d.accepted);
      const avgLatency = acceptedInPhase.length === 0 ? 0
        : acceptedInPhase.reduce((sum, d) => sum + d.latencyMs, 0) / acceptedInPhase.length;

      const transition = buildPhaseTransitionContext(
        currentSnapshot,
        this.lastObservedPhase,
        decisionsInPhase,
        avgLatency,
      );
      this.phaseTransitions.push(transition);
      this.phasesReached.add(currentPhase);
      this.phaseTransitionTicks[currentPhase] = currentSnapshot.tick;
      this.lastObservedPhase = currentPhase;
      this.phaseDecisionsAtEntry = decisionsNow;

      if (this.enableMLRouting) {
        this.bus.emit(
          'ml.phase.transitioned',
          {
            runId: currentSnapshot.runId,
            tick: currentSnapshot.tick,
            fromPhase: transition.fromPhase,
            toPhase: transition.toPhase,
            avgDecisionLatencyInPhase: transition.avgDecisionLatencyInPhase,
            decisionsInPhase: transition.decisionsInPhase,
            contextVector: [...transition.contextVector],
          } as unknown as EngineEventMap[keyof EngineEventMap],
          { emittedAtTick: currentSnapshot.tick, tags: ['ml', 'phase-transition'] },
        );
      }
    }

    // Emit DL packet per configured interval
    const dlPacket = buildDLRoutingPacket(
      currentSnapshot,
      mlSummary.dlInputVector,
      this.timePolicyResolver.serializeForHash(),
      nowMs,
    );

    if (this.enableMLRouting && currentSnapshot.tick % this.dlPacketEmitInterval === 0) {
      this.emitDLRoutingPacketRaw(dlPacket);
    }

    const outcome = this.outcomeResolver.resolve(currentSnapshot);
    const events = freezeArray(this.bus.flush() as RuntimeEventEnvelope[]);

    return {
      snapshot: currentSnapshot,
      checksum:
        currentSnapshot.telemetry.lastTickChecksum ??
        stableTickChecksum(currentSnapshot),
      outcome,
      events,
      signals: freezeArray(signals),
      traces: freezeArray(traces),
      checkpoints: freezeArray(checkpoints),
      appliedPolicy: this.timePolicyResolver.resolveSnapshot({
        snapshot: currentSnapshot,
        nowMs,
      }),
      mlSummary,
      dlPacket,
      prediction,
    };
  }

  public tick(): OrchestratorTickResult {
    return this.executeTick();
  }

  public tickMany(count: number): readonly OrchestratorTickResult[] {
    const normalized = Math.max(0, Math.trunc(count));
    const results: OrchestratorTickResult[] = [];

    for (let index = 0; index < normalized; index += 1) {
      const result = this.executeTick();
      results.push(result);
      if (result.snapshot.outcome !== null) {
        break;
      }
    }

    return freezeArray(results);
  }

  public tickUntilTerminal(limit = 10_000): readonly OrchestratorTickResult[] {
    const normalized = Math.max(1, Math.trunc(limit));
    const results: OrchestratorTickResult[] = [];

    for (let index = 0; index < normalized; index += 1) {
      const result = this.executeTick();
      results.push(result);

      if (result.snapshot.outcome !== null) {
        return freezeArray(results);
      }
    }

    throw new Error(
      `EngineOrchestrator.tickUntilTerminal exceeded ${String(normalized)} ticks without a terminal outcome.`,
    );
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
        reasons: freezeArray([
          `Card ${definition.id} is not currently legal for draw in mode ${snapshot.mode}.`,
        ]),
      };
    }

    const next = toMutableSnapshot(snapshot);
    next.cards.hand.push(cloneJson(instance) as MutableDeep<CardInstance>);
    next.cards.drawHistory.push(instance.instanceId);
    this.snapshot = toFrozenSnapshot(next);

    return {
      accepted: true,
      snapshot: this.requireSnapshot(),
      instance,
      reasons: freezeArray([]),
    };
  }

  public playCard(request: PlayCardRequest): PlayCardResult {
    const snapshot = this.requireSnapshot();
    const instance =
      snapshot.cards.hand.find((card) => card.instanceId === request.cardInstanceId) ??
      null;

    if (!instance) {
      return {
        accepted: false,
        snapshot,
        playedCard: null,
        chosenTimingClass: null,
        reasons: freezeArray([
          `Card instance ${request.cardInstanceId} not found in hand.`,
        ]),
        mlImpact: this.buildNullPlayCardMLImpact(),
      };
    }

    const availableTimingClasses = this.windows.getAvailableTimingClasses(
      snapshot,
      this.activeStep,
      { actorId: request.actorId },
    );

    const chosenTimingClass =
      request.requestedTimingClass ??
      instance.timingClass.find((timing) => availableTimingClasses.includes(timing)) ??
      null;

    if (!chosenTimingClass || !availableTimingClasses.includes(chosenTimingClass)) {
      return {
        accepted: false,
        snapshot,
        playedCard: null,
        chosenTimingClass: null,
        reasons: freezeArray([
          `Card ${instance.definitionId} is not legal during ${this.activeStep}.`,
        ]),
        mlImpact: this.buildNullPlayCardMLImpact(),
      };
    }

    // Capture pre-play ML scores for impact calculation
    const preUrgency = computeUrgency(snapshot);
    const preCascadeRisk = computeCascadeRisk(snapshot);
    const preEconomyHealth = computeEconomyHealth(snapshot);
    const preShieldHealth = computeShieldRatio(snapshot);
    const preCompositeRisk = computeCompositeRisk(preUrgency, preCascadeRisk, preEconomyHealth, preShieldHealth);

    const next = toMutableSnapshot(snapshot);
    next.cards.hand = next.cards.hand.filter(
      (card) => card.instanceId !== request.cardInstanceId,
    );
    next.cards.lastPlayed.push(instance.instanceId);
    next.cards.discard.push(instance.instanceId);
    next.telemetry.decisions.push({
      tick: next.tick,
      actorId: request.actorId,
      cardId: instance.definitionId,
      latencyMs: 0,
      timingClass: [chosenTimingClass],
      accepted: true,
    });

    this.bus.emit(
      'card.played',
      {
        runId: next.runId,
        actorId: request.actorId,
        cardId: instance.definitionId,
        tick: next.tick,
        mode: next.mode,
      },
      {
        emittedAtTick: next.tick,
        tags: ['card-play'],
      },
    );

    if (
      chosenTimingClass !== 'ANY' &&
      chosenTimingClass !== 'PRE' &&
      chosenTimingClass !== 'POST' &&
      chosenTimingClass !== 'END'
    ) {
      const consumed = this.windows.consumeFirstWindowForTimingClass(
        toFrozenSnapshot(next),
        chosenTimingClass,
        request.actorId,
      );
      this.snapshot = consumed;
    } else {
      this.snapshot = toFrozenSnapshot(next);
    }

    // Compute post-play ML scores for impact
    const postSnapshot = this.requireSnapshot();
    const postUrgency = computeUrgency(postSnapshot);
    const postCascadeRisk = computeCascadeRisk(postSnapshot);
    const postEconomyHealth = computeEconomyHealth(postSnapshot);
    const postShieldHealth = computeShieldRatio(postSnapshot);
    const postCompositeRisk = computeCompositeRisk(postUrgency, postCascadeRisk, postEconomyHealth, postShieldHealth);

    const mlImpact = this.buildPlayCardMLImpact(
      preUrgency, postUrgency,
      preCascadeRisk, postCascadeRisk,
      preEconomyHealth, postEconomyHealth,
      preShieldHealth, postShieldHealth,
      preCompositeRisk, postCompositeRisk,
    );

    return {
      accepted: true,
      snapshot: this.requireSnapshot(),
      playedCard: instance,
      chosenTimingClass,
      reasons: freezeArray([]),
      mlImpact,
    };
  }

  // ---------------------------------------------------------------------------
  // State accessors
  // ---------------------------------------------------------------------------

  public current(): RunStateSnapshot {
    return this.requireSnapshot();
  }

  public getPolicy(): ModeTimePolicy {
    return this.timePolicyResolver.getPolicy(this.requireSnapshot().mode);
  }

  public getBus(): RuntimeBus {
    return this.bus;
  }

  public getCheckpointStore(): RuntimeCheckpointStore {
    return this.checkpointStore;
  }

  public getTraceRecorder(): TickTraceRecorder {
    return this.traceRecorder;
  }

  public getHealth(): readonly EngineHealth[] {
    return this.registry.health();
  }

  public listRecentTraces(limit?: number): readonly TickTraceRecord[] {
    return this.traceRecorder.listRecent(limit);
  }

  public listRunCheckpoints(runId?: string): readonly RuntimeCheckpoint[] {
    const targetRunId = runId ?? this.requireSnapshot().runId;
    return this.checkpointStore.listRun(targetRunId);
  }

  // ---------------------------------------------------------------------------
  // ML / DL analytics
  // ---------------------------------------------------------------------------

  /** Get the latest tick ML summary without executing a tick. */
  public getLatestMLSummary(): TickMLSummary | null {
    return this.tickSummaries[this.tickSummaries.length - 1] ?? null;
  }

  /** Get all tick ML summaries collected in this run. */
  public getAllTickMLSummaries(): readonly TickMLSummary[] {
    return freezeArray(this.tickSummaries);
  }

  /** Get all tier crossings detected during this run. */
  public getTierCrossings(): readonly PressureTierMLContext[] {
    return freezeArray(this.tierCrossings);
  }

  /** Get all phase transitions detected during this run. */
  public getPhaseTransitions(): readonly PhaseTransitionMLContext[] {
    return freezeArray(this.phaseTransitions);
  }

  /** Build a prediction for the next N ticks without executing them. */
  public previewNextTicks(count: number): readonly TickPrediction[] {
    const snapshot = this.requireSnapshot();
    const results: TickPrediction[] = [];
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

      const predictedPhase: RunPhase =
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
        predictedCash: roundTo(simCash, 2),
        predictedNetWorth: roundTo(simNetWorth, 2),
        forecastConfidence: clamp01(1 - warningFlags.length * 0.12 - i * 0.03),
        warningFlags: Object.freeze(warningFlags),
      });

      if (predictedOutcome !== null) break;
    }

    return freezeArray(results);
  }

  /** Compute a full ML diagnostics report for this run. */
  public buildMLDiagnostics(): OrchestratorMLDiagnostics {
    const snapshot = this.snapshot;
    const runId = snapshot?.runId ?? 'unknown';
    const totalTicks = snapshot?.tick ?? 0;

    const peakUrgency = this.tickSummaries.reduce(
      (max, s) => Math.max(max, s.urgencyScore), 0,
    );
    const peakCascadeRisk = this.tickSummaries.reduce(
      (max, s) => Math.max(max, s.cascadeRiskScore), 0,
    );
    const avgCompositeRisk = this.tickSummaries.length === 0 ? 0
      : roundTo(
          this.tickSummaries.reduce((sum, s) => sum + s.compositeRiskScore, 0)
          / this.tickSummaries.length,
          4,
        );

    const allDecisions = snapshot?.telemetry.decisions ?? [];
    const mlDecisionAcceptanceRate = allDecisions.length === 0 ? 1
      : roundTo(
          allDecisions.filter((d) => d.accepted).length / allDecisions.length,
          4,
        );

    return {
      runId,
      totalTicks,
      phasesReached: freezeArray([...this.phasesReached]),
      tiersReached: freezeArray([...this.tiersReached]),
      tierCrossings: freezeArray(this.tierCrossings),
      phaseTransitions: freezeArray(this.phaseTransitions),
      tickSummaries: freezeArray(this.tickSummaries),
      peakUrgency: roundTo(peakUrgency, 4),
      peakCascadeRisk: roundTo(peakCascadeRisk, 4),
      avgCompositeRisk,
      mlDecisionAcceptanceRate,
      dlPacketsEmitted: this.dlPacketsEmitted,
    };
  }

  /** Build a full run analytics report — available after run completes. */
  public buildRunAnalytics(): OrchestratorRunAnalytics {
    const snapshot = this.requireSnapshot();
    const mlDiagnostics = this.buildMLDiagnostics();

    const tierOrder: PressureTier[] = ['T0', 'T1', 'T2', 'T3', 'T4'];
    const peakPressureTier: PressureTier = tierOrder.reduce(
      (peak, t) => (this.tiersReached.has(t) ? t : peak),
      'T0' as PressureTier,
    );

    const avgTickDurationMs = snapshot.tick === 0 ? 0
      : roundTo(snapshot.timers.elapsedMs / snapshot.tick, 0);

    const shieldMax = snapshot.shield.layers.reduce((sum, l) => sum + l.max, 0);
    const shieldCurrent = snapshot.shield.layers.reduce((sum, l) => sum + l.current, 0);
    const finalShieldRatio = shieldMax === 0 ? 1 : roundTo(shieldCurrent / shieldMax, 4);

    return {
      runId: snapshot.runId,
      mode: snapshot.mode,
      totalTicks: snapshot.tick,
      outcome: snapshot.outcome,
      phasesReached: freezeArray([...this.phasesReached]),
      tiersReached: freezeArray([...this.tiersReached]),
      peakPressureTier,
      phaseTransitionTicks: { ...this.phaseTransitionTicks },
      tierCrossingCount: this.tierCrossings.length,
      avgTickDurationMs,
      totalElapsedMs: snapshot.timers.elapsedMs,
      finalNetWorth: snapshot.economy.netWorth,
      finalCash: snapshot.economy.cash,
      finalShieldRatio,
      sovereigntyScore: snapshot.sovereignty.sovereigntyScore ?? 0,
      verifiedGrade: snapshot.sovereignty.verifiedGrade ?? 'UNGRADED',
      proofHash: snapshot.sovereignty.proofHash ?? null,
      mlDiagnostics,
      checkpointCount: this.checkpointStore.listRun(snapshot.runId).length,
      traceCount: this.traceRecorder.listRecent().length,
      warningCount: snapshot.telemetry.warnings.length,
    };
  }

  /** Build a real-time health report for monitoring. */
  public buildHealthReport(): OrchestratorHealthReport {
    const snapshot = this.snapshot;
    const registered = REQUIRED_ENGINES.filter((id) => {
      try { this.registry.get(id); return true; } catch { return false; }
    });
    const missing = REQUIRED_ENGINES.filter((id) => !registered.includes(id));

    const timePolicyDiagnostic = snapshot
      ? (() => {
          try {
            const diag = this.timePolicyResolver.diagnose(snapshot, this.clock.now());
            return `${diag.mode}:${diag.tier}:ok=${String(diag.ok)}`;
          } catch {
            return 'unavailable';
          }
        })()
      : 'no-active-run';

    return {
      healthy: missing.length === 0 && snapshot !== null,
      registeredEngines: freezeArray(registered),
      missingEngines: freezeArray(missing),
      engineHealth: this.registry.health(),
      hasActiveRun: snapshot !== null,
      currentTick: snapshot?.tick ?? null,
      currentPhase: (snapshot?.phase ?? null) as RunPhase | null,
      currentTier: (snapshot?.pressure.tier ?? null) as PressureTier | null,
      checkpointStoreSize: snapshot ? this.checkpointStore.listRun(snapshot.runId).length : 0,
      traceRecorderSize: this.traceRecorder.listRecent().length,
      busHistoryCount: this.bus.historyCount(),
      timePolicyDiagnostic,
      invariantWarnings: freezeArray(snapshot?.telemetry.warnings ?? []),
    };
  }

  // ---------------------------------------------------------------------------
  // Reset
  // ---------------------------------------------------------------------------

  public reset(): void {
    this.registry.reset();
    this.bus.clear({
      clearQueue: true,
      clearHistory: true,
      clearListeners: false,
      clearAnyListeners: false,
    });
    this.snapshot = null;
    this.activeStep = 'STEP_01_PREPARE';
    this.runStartedEmitted = false;
    this.resetMLState();
  }

  // ---------------------------------------------------------------------------
  // Private — mode hooks
  // ---------------------------------------------------------------------------

  private applyModeInitialize(
    snapshot: RunStateSnapshot,
    step: TickStep,
    nowMs: number,
  ): RunStateSnapshot {
    const hooks = this.modeHooksByMode[snapshot.mode];
    if (!hooks) {
      return snapshot;
    }

    const context = this.createContext(snapshot, step, nowMs);
    return hooks.initialize(snapshot, context);
  }

  private applyModeBeforeStep(
    snapshot: MutableRunStateSnapshot,
    step: TickStep,
    nowMs: number,
  ): MutableRunStateSnapshot {
    const hooks = this.modeHooksByMode[snapshot.mode];
    if (!hooks?.beforeStep) {
      return snapshot;
    }

    return toMutableSnapshot(
      hooks.beforeStep(
        toFrozenSnapshot(snapshot),
        this.createContext(toFrozenSnapshot(snapshot), step, nowMs),
      ),
    );
  }

  private applyModeAfterStep(
    snapshot: MutableRunStateSnapshot,
    step: TickStep,
    nowMs: number,
  ): MutableRunStateSnapshot {
    const hooks = this.modeHooksByMode[snapshot.mode];
    if (!hooks?.afterStep) {
      return snapshot;
    }

    return toMutableSnapshot(
      hooks.afterStep(
        toFrozenSnapshot(snapshot),
        this.createContext(toFrozenSnapshot(snapshot), step, nowMs),
      ),
    );
  }

  private applyModeFinalizeTick(
    snapshot: MutableRunStateSnapshot,
    nowMs: number,
  ): MutableRunStateSnapshot {
    const hooks = this.modeHooksByMode[snapshot.mode];
    if (!hooks?.finalizeTick) {
      return snapshot;
    }

    return toMutableSnapshot(
      hooks.finalizeTick(
        toFrozenSnapshot(snapshot),
        this.createContext(toFrozenSnapshot(snapshot), 'STEP_08_MODE_POST', nowMs),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Private — tick internals
  // ---------------------------------------------------------------------------

  private materializeTelemetry(
    snapshot: MutableRunStateSnapshot,
  ): MutableRunStateSnapshot {
    const next = toMutableSnapshot(snapshot);
    next.telemetry.emittedEventCount = this.bus.historyCount();

    const policy = this.timePolicyResolver.resolveSnapshot({
      snapshot: toFrozenSnapshot(next),
      nowMs: this.clock.now(),
    });
    if (
      next.timers.currentTickDurationMs < policy.tierConfig.minDurationMs ||
      next.timers.currentTickDurationMs > policy.tierConfig.maxDurationMs
    ) {
      next.telemetry.warnings = appendUnique(next.telemetry.warnings, [
        `TIME_POLICY_DRIFT:${next.mode}:${next.pressure.tier}:${String(next.timers.currentTickDurationMs)}`,
      ]);
    }

    return next;
  }

  private sealTick(snapshot: MutableRunStateSnapshot): MutableRunStateSnapshot {
    const next = toMutableSnapshot(snapshot);
    const checksum = stableTickChecksum(toFrozenSnapshot(next));

    next.sovereignty.tickChecksums = [
      ...next.sovereignty.tickChecksums,
      checksum,
    ];
    next.telemetry.lastTickChecksum = checksum;
    next.telemetry.emittedEventCount = this.bus.historyCount();

    this.bus.emit(
      'tick.completed',
      {
        runId: next.runId,
        tick: next.tick,
        phase: next.phase,
        checksum,
      },
      {
        emittedAtTick: next.tick,
        tags: ['tick-complete', 'seal'],
      },
    );

    if (next.outcome !== null && next.sovereignty.proofHash) {
      this.bus.emit(
        'proof.sealed',
        {
          runId: next.runId,
          proofHash: next.sovereignty.proofHash,
          integrityStatus: next.sovereignty.integrityStatus,
          grade: next.sovereignty.verifiedGrade ?? 'UNGRADED',
          outcome: next.outcome,
        },
        {
          emittedAtTick: next.tick,
          tags: ['proof', 'sealed'],
        },
      );
    }

    return next;
  }

  private executeRegisteredEngine(
    snapshot: MutableRunStateSnapshot,
    step: TickStep,
    nowMs: number,
  ): {
    readonly snapshot: MutableRunStateSnapshot;
    readonly signals: readonly EngineSignal[];
    readonly traces: readonly TickTraceRecord[];
    readonly checkpoints: readonly RuntimeCheckpoint[];
  } {
    const engineId = STEP_TO_ENGINE[step];
    if (!engineId) {
      return {
        snapshot,
        signals: freezeArray([]),
        traces: freezeArray([]),
        checkpoints: freezeArray([]),
      };
    }

    const engine = this.registry.maybeGet(engineId);
    if (!engine) {
      return {
        snapshot,
        signals: freezeArray([]),
        traces: freezeArray([]),
        checkpoints: freezeArray([]),
      };
    }

    const beforeSnapshot = toFrozenSnapshot(snapshot);
    const context = this.createContext(beforeSnapshot, step, nowMs);
    const checkpoints: RuntimeCheckpoint[] = [];
    const signals: EngineSignal[] = [];
    const traces: TickTraceRecord[] = [];

    const entryCheckpoint = this.writeCheckpoint(
      beforeSnapshot,
      'STEP_ENTRY',
      step,
      nowMs,
      ['step-entry', engineId],
      context.trace.traceId,
    );
    checkpoints.push(entryCheckpoint);

    const historyBefore = this.bus.historyCount();
    const traceHandle = this.traceRecorder.begin(
      beforeSnapshot,
      context.trace,
      nowMs,
    );

    try {
      if (engine.canRun && !engine.canRun(beforeSnapshot, context)) {
        const skipped = this.traceRecorder.commitSuccess(traceHandle, {
          afterSnapshot: beforeSnapshot,
          finishedAtMs: nowMs,
          events: [],
          signals: [],
        });
        traces.push(skipped);

        return {
          snapshot,
          signals: freezeArray([]),
          traces: freezeArray(traces),
          checkpoints: freezeArray(checkpoints),
        };
      }

      const result = normalizeEngineTickResult(
        engineId,
        beforeSnapshot.tick,
        engine.tick(beforeSnapshot, context),
      );

      let next = toMutableSnapshot(result.snapshot);
      if (step === 'STEP_02_TIME') {
        next = toMutableSnapshot(
          this.timePolicyResolver.applySnapshot(toFrozenSnapshot(next), nowMs),
        );
      }

      const deltaEvents = historyDelta(this.bus, historyBefore);
      const committed = this.traceRecorder.commitSuccess(traceHandle, {
        afterSnapshot: toFrozenSnapshot(next),
        finishedAtMs: nowMs,
        events: deltaEvents,
        signals: result.signals ?? [],
      });

      traces.push(committed);
      signals.push(...(result.signals ?? []));

      const exitCheckpoint = this.writeCheckpoint(
        toFrozenSnapshot(next),
        'STEP_EXIT',
        step,
        nowMs,
        ['step-exit', engineId],
        context.trace.traceId,
      );
      checkpoints.push(exitCheckpoint);

      return {
        snapshot: next,
        signals: freezeArray(signals),
        traces: freezeArray(traces),
        checkpoints: freezeArray(checkpoints),
      };
    } catch (error) {
      const deltaEvents = historyDelta(this.bus, historyBefore);
      const failed = this.traceRecorder.commitFailure(traceHandle, {
        finishedAtMs: nowMs,
        error,
        afterSnapshot: beforeSnapshot,
        events: deltaEvents,
        signals: [],
      });
      traces.push(failed);

      const message =
        error instanceof Error ? error.message : 'Unknown engine step failure.';
      const signal = createEngineSignal(
        engineId,
        'ERROR',
        'ENGINE_STEP_FAILED',
        `${engineId} failed during ${step}: ${message}`,
        beforeSnapshot.tick,
        [step],
      );
      signals.push(signal);

      const next = toMutableSnapshot(beforeSnapshot);
      next.sovereignty.integrityStatus = 'QUARANTINED';
      next.sovereignty.auditFlags = appendUnique(next.sovereignty.auditFlags, [
        `${engineId}:${step}:FAILED`,
      ]);
      next.telemetry.warnings = appendUnique(next.telemetry.warnings, [message]);

      this.bus.emit(
        'integrity.quarantined',
        {
          runId: next.runId,
          tick: next.tick,
          reasons: [message],
        },
        {
          emittedAtTick: next.tick,
          tags: ['integrity', 'quarantine', engineId],
        },
      );

      const exitCheckpoint = this.writeCheckpoint(
        toFrozenSnapshot(next),
        'STEP_EXIT',
        step,
        nowMs,
        ['step-failed', engineId],
        context.trace.traceId,
      );
      checkpoints.push(exitCheckpoint);

      return {
        snapshot: next,
        signals: freezeArray(signals),
        traces: freezeArray(traces),
        checkpoints: freezeArray(checkpoints),
      };
    }
  }

  private applyInvariantReport(
    snapshot: RunStateSnapshot,
    report: RunStateInvariantReport,
  ): RunStateSnapshot {
    if (report.ok) {
      return snapshot;
    }

    const next = toMutableSnapshot(snapshot);
    const errorCodes = report.errors.map(stringifyIssue);
    const warningCodes = report.warnings.map(stringifyIssue);
    next.telemetry.warnings = appendUnique(next.telemetry.warnings, warningCodes);

    if (errorCodes.length > 0) {
      next.sovereignty.integrityStatus = 'QUARANTINED';
      next.sovereignty.auditFlags = appendUnique(
        next.sovereignty.auditFlags,
        errorCodes,
      );
      this.bus.emit(
        'integrity.quarantined',
        {
          runId: next.runId,
          tick: next.tick,
          reasons: errorCodes,
        },
        {
          emittedAtTick: next.tick,
          tags: ['integrity', 'quarantine', report.stage],
        },
      );

      if (this.failFastOnInvariantError) {
        return toFrozenSnapshot(next);
      }
    }

    return toFrozenSnapshot(next);
  }

  private writeCheckpoint(
    snapshot: RunStateSnapshot,
    reason: RuntimeCheckpointReason,
    step: TickStep,
    capturedAtMs: number,
    tags: readonly string[],
    traceId: string | null,
  ): RuntimeCheckpoint {
    return this.checkpointStore.write({
      snapshot,
      capturedAtMs,
      step,
      reason,
      traceId,
      tags,
    });
  }

  private createContext(
    snapshot: RunStateSnapshot,
    step: TickStep,
    nowMs: number,
  ): TickContext {
    return {
      step,
      nowMs,
      clock: this.clock,
      bus: this.bus as unknown as TickContext['bus'],
      trace: {
        runId: snapshot.runId,
        tick: snapshot.tick,
        step,
        mode: snapshot.mode,
        phase: snapshot.phase,
        traceId: createDeterministicId(
          'orchestrator-trace',
          snapshot.runId,
          snapshot.tick,
          step,
          nowMs,
        ),
      },
    };
  }

  private emitRunStartedIfNeeded(): void {
    if (this.runStartedEmitted) {
      return;
    }

    const snapshot = this.requireSnapshot();
    this.bus.emit(
      'run.started',
      {
        runId: snapshot.runId,
        mode: snapshot.mode,
        seed: snapshot.seed,
      },
      {
        emittedAtTick: snapshot.tick,
        tags: ['run-start'],
      },
    );
    this.runStartedEmitted = true;
  }

  private requireSnapshot(): RunStateSnapshot {
    if (!this.snapshot) {
      throw new Error('EngineOrchestrator requires startRun() before use.');
    }

    return this.snapshot;
  }

  // ---------------------------------------------------------------------------
  // Private — ML routing helpers
  // ---------------------------------------------------------------------------

  private resetMLState(): void {
    this.tierCrossings.length = 0;
    this.phaseTransitions.length = 0;
    this.tickSummaries.length = 0;
    this.phasesReached.clear();
    this.tiersReached.clear();
    Object.keys(this.phaseTransitionTicks).forEach((k) => {
      delete this.phaseTransitionTicks[k as RunPhase];
    });
    this.lastObservedTier = 'T0';
    this.lastObservedPhase = 'FOUNDATION';
    this.phaseDecisionsAtEntry = 0;
    this.phaseDecisionCountOnEntry = 0;
    this.phaseEntryTotalLatency = 0;
    this.dlPacketsEmitted = 0;
  }

  private emitDLRoutingPacket(
    snapshot: RunStateSnapshot,
    mlSummary: TickMLSummary,
  ): void {
    const packet = buildDLRoutingPacket(
      snapshot,
      mlSummary.dlInputVector,
      this.timePolicyResolver.serializeForHash(),
      this.clock.now(),
    );
    this.emitDLRoutingPacketRaw(packet);
  }

  private emitDLRoutingPacketRaw(packet: DLRoutingPacket): void {
    this.bus.emit(
      'ml.dl.packet',
      {
        runId: packet.runId,
        tick: packet.tick,
        tensorShape: [...packet.tensorShape],
        inputVector: [...packet.inputVector],
        policyVersion: packet.policyVersion,
        emittedAtMs: packet.emittedAtMs,
      } as unknown as EngineEventMap[keyof EngineEventMap],
      {
        emittedAtTick: packet.tick,
        tags: ['ml', 'dl', 'tensor'],
      },
    );
    this.dlPacketsEmitted += 1;
  }

  private buildNullPlayCardMLImpact(): PlayCardMLImpact {
    return {
      urgencyShift: 0,
      cascadeRiskShift: 0,
      economyHealthShift: 0,
      shieldHealthShift: 0,
      compositeRiskShift: 0,
      dominantImpactDimension: 'none',
    };
  }

  private buildPlayCardMLImpact(
    preUrgency: number, postUrgency: number,
    preCascadeRisk: number, postCascadeRisk: number,
    preEconomy: number, postEconomy: number,
    preShield: number, postShield: number,
    preComposite: number, postComposite: number,
  ): PlayCardMLImpact {
    const urgencyShift = roundTo(postUrgency - preUrgency, 4);
    const cascadeRiskShift = roundTo(postCascadeRisk - preCascadeRisk, 4);
    const economyHealthShift = roundTo(postEconomy - preEconomy, 4);
    const shieldHealthShift = roundTo(postShield - preShield, 4);
    const compositeRiskShift = roundTo(postComposite - preComposite, 4);

    const dims: Array<[string, number]> = [
      ['urgency', Math.abs(urgencyShift)],
      ['cascade_risk', Math.abs(cascadeRiskShift)],
      ['economy_health', Math.abs(economyHealthShift)],
      ['shield_health', Math.abs(shieldHealthShift)],
    ];
    dims.sort((a, b) => b[1] - a[1]);
    const dominantImpactDimension = dims[0]?.[0] ?? 'none';

    return {
      urgencyShift,
      cascadeRiskShift,
      economyHealthShift,
      shieldHealthShift,
      compositeRiskShift,
      dominantImpactDimension,
    };
  }
}
