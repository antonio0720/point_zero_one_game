// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — RUN STATE SNAPSHOT
// FILE: pzo-web/src/engines/core/RunStateSnapshot.ts
// VERSION: 2026.03.23-sovereign-depth.v2
// AUTHORSHIP: Antonio T. Smith Jr.
// LICENSE: Internal / Proprietary / All Rights Reserved
// ═══════════════════════════════════════════════════════════════════════════════
//
// Purpose
// -------
// Build, freeze, validate, and inspect the per-tick read model consumed by the
// engine stack. This module is not a thin adapter. It is the deterministic
// staging layer that converts mutable simulation state into a stable, auditable,
// replay-friendly snapshot surface.
//
// Design doctrine
// ---------------
// - Build once per tick. Never mutate after freeze.
// - Preserve current repo snapshot surface while adding Engine 0-compatible
//   overlays that the broader orchestration doctrine expects.
// - Track enough meta-state for proof, replay, diagnostics, and UI legibility.
// - Do not flatten shield, bot, or cascade detail into generic bags.
// - Give engines one authoritative object to read.
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  RunStateSnapshot as CoreRunStateSnapshot,
  ShieldState,
  ShieldLayer,
  ShieldLayerId,
  BotRuntimeState,
  BotId,
  CascadeChainInstance,
  CascadeSeverity,
  RunMode,
  RunLifecycleState,
  PressureTier,
  TickTier,
  DecisionTelemetryRecord,
  SnapshotDiff,
  SnapshotReceipt,
  ShieldSnapshotSurface,
  Engine0SnapshotEnvelope,
} from './types';
import {
  BOT_IDS,
  DECISION_WINDOW_S,
  HOLD_BUDGET_BY_TIER,
  PRESSURE_TIER_THRESHOLDS,
  SHIELD_LAYER_IDS,
  SHIELD_LAYER_LABELS,
  SHIELD_MAX_INTEGRITY,
  SHIELD_REGEN_PER_TICK,
  TICK_DURATION_MS,
} from './types';

export type { RunStateSnapshot } from './types';

// ── Mutable live state (written by engines, read at snapshot time) ────────────

export interface TickMetrics {
  haterAttemptsThisTick: number;
  haterBlockedThisTick: number;
  haterDamagedThisTick: number;
  cascadesTriggeredThisTick: number;
  cascadesBrokenThisTick: number;
  decisionsThisTick: DecisionTelemetryRecord[];
}

export interface LiveRunState {
  tick: number;
  cash: number;
  income: number;
  expenses: number;
  netWorth: number;
  haterHeat: number;
  pressureScore: number;
  tickTier: TickTier;
  shields: MutableShieldState;
  botStates: Record<BotId, BotRuntimeState>;
  activeCascades: CascadeChainInstance[];
  runMode: RunMode;
  seed: number;
  lifecycle: RunLifecycleState;
  tickMetrics?: TickMetrics;
  engine0?: Partial<Engine0RuntimeState>;
}

export interface Engine0RuntimeState {
  runId: string;
  userId: string;
  seasonTickBudget: number;
  freedomThreshold: number;
  ticksRemaining: number;
  currentTickDurationMs: number;
  activeDecisionWindows: number;
  holdsRemaining: number;
  ticksWithoutIncomeGrowth: number;
  tensionScore: number;
  anticipationQueueDepth: number;
  threatVisibilityState: string;
  activeThreatCardCount: number;
}

export interface MutableShieldState {
  layers: Record<ShieldLayerId, MutableShieldLayer>;
  l4BreachCount: number;
}

export interface MutableShieldLayer {
  id: ShieldLayerId;
  label: string;
  current: number;
  max: number;
  breached: boolean;
  lastBreach: number | null;
  regenActive: boolean;
}

export interface SnapshotBuildOptions {
  readonly includeEngine0Envelope?: boolean;
  readonly runId?: string;
  readonly userId?: string;
  readonly seasonTickBudget?: number;
  readonly freedomThreshold?: number;
  readonly ticksRemaining?: number;
  readonly currentTickDurationMs?: number;
  readonly activeDecisionWindows?: number;
  readonly holdsRemaining?: number;
  readonly ticksWithoutIncomeGrowth?: number;
  readonly tensionScore?: number;
  readonly anticipationQueueDepth?: number;
  readonly threatVisibilityState?: string;
  readonly activeThreatCardCount?: number;
}

export interface SnapshotBuildResult {
  readonly snapshot: CoreRunStateSnapshot;
  readonly receipt: SnapshotReceipt;
  readonly issues: readonly SnapshotValidationIssue[];
}

export interface SnapshotValidationIssue {
  readonly code:
    | 'INVALID_NUMBER'
    | 'MISSING_BOT_STATE'
    | 'MISSING_SHIELD_LAYER'
    | 'NEGATIVE_TICK'
    | 'OUT_OF_RANGE_PRESSURE'
    | 'OUT_OF_RANGE_HEAT'
    | 'OUT_OF_RANGE_SHIELD'
    | 'CASCADE_LINK_NEGATIVE_OFFSET'
    | 'DECISION_INVALID_WINDOW'
    | 'DECISION_INVALID_SPEED'
    | 'ENGINE0_INCOMPLETE'
    | 'INTEGRITY_MISMATCH';
  readonly severity: 'WARN' | 'ERROR';
  readonly message: string;
  readonly path: string;
}

export interface SnapshotInspection {
  readonly receipt: SnapshotReceipt;
  readonly tierDescriptor: {
    readonly tickDurationMs: number;
    readonly decisionWindowSeconds: number;
    readonly holdBudget: number;
  };
  readonly shieldSurface: ShieldSnapshotSurface;
  readonly activeBotCount: number;
  readonly highestCascadeSeverity: CascadeSeverity | null;
  readonly hasCriticalPressure: boolean;
  readonly isFrozen: boolean;
}

// ── Snapshot view class ───────────────────────────────────────────────────────

/**
 * Frozen runtime view with deterministic helper getters. The object surface is
 * still compatible with the `RunStateSnapshot` interface exported from types.ts.
 */
export class RunStateSnapshotRecord implements Readonly<CoreRunStateSnapshot> {
  readonly tick!: number;
  readonly cash!: number;
  readonly income!: number;
  readonly expenses!: number;
  readonly netWorth!: number;
  readonly shields!: ShieldState;
  readonly haterHeat!: number;
  readonly botStates!: Readonly<Record<BotId, BotRuntimeState>>;
  readonly pressureScore!: number;
  readonly pressureTier!: PressureTier;
  readonly tickTier!: TickTier;
  readonly activeCascades!: CascadeChainInstance[];
  readonly runMode!: RunMode;
  readonly seed!: number;
  readonly lifecycleState!: RunLifecycleState;
  readonly tickIndex!: number;
  readonly shieldAvgIntegrityPct!: number;
  readonly activeCascadeChains!: number;
  readonly haterAttemptsThisTick!: number;
  readonly haterBlockedThisTick!: number;
  readonly haterDamagedThisTick!: number;
  readonly cascadesTriggeredThisTick!: number;
  readonly cascadesBrokenThisTick!: number;
  readonly decisionsThisTick!: readonly DecisionTelemetryRecord[];
  readonly runId?: string;
  readonly userId?: string;
  readonly seasonTickBudget?: number;
  readonly ticksRemaining?: number;
  readonly freedomThreshold?: number;
  readonly cashflow?: number;
  readonly currentTickTier?: TickTier;
  readonly currentTickDurationMs?: number;
  readonly activeDecisionWindows?: number;
  readonly holdsRemaining?: number;
  readonly ticksWithoutIncomeGrowth?: number;
  readonly tensionScore?: number;
  readonly anticipationQueueDepth?: number;
  readonly threatVisibilityState?: string;
  readonly activeBotCount?: number;
  readonly activeThreatCardCount?: number;

  constructor(snapshot: CoreRunStateSnapshot) {
    Object.assign(this, snapshot);
    Object.freeze(this);
  }

  get isBankrupt(): boolean {
    const cashflow = this.cashflow ?? this.income - this.expenses;
    return this.cash < 0 && cashflow < 0;
  }

  get hasCrossedFreedomThreshold(): boolean {
    if (typeof this.freedomThreshold !== 'number') {
      return false;
    }
    return this.netWorth >= this.freedomThreshold;
  }

  get isTimedOut(): boolean {
    if (typeof this.ticksRemaining !== 'number') {
      return false;
    }
    return this.ticksRemaining <= 0;
  }

  get shieldHealthNormalized(): number {
    return roundTo(this.shieldAvgIntegrityPct / 100, 6);
  }

  get resolvedTickDurationMs(): number {
    return this.currentTickDurationMs ?? TICK_DURATION_MS[this.tickTier];
  }

  get resolvedDecisionWindowMs(): number {
    return Math.round(DECISION_WINDOW_S[this.tickTier] * 1000);
  }
}

// ── Snapshot builder ──────────────────────────────────────────────────────────

/**
 * Builds a frozen `RunStateSnapshot` from the current live state.
 * Called exclusively by EngineOrchestrator at tick start.
 */
export function buildSnapshot(
  live: LiveRunState,
  options: SnapshotBuildOptions = {},
): CoreRunStateSnapshot {
  return buildSnapshotResult(live, options).snapshot;
}

/** Same as `buildSnapshot`, but returns diagnostics and the receipt. */
export function buildSnapshotResult(
  live: LiveRunState,
  options: SnapshotBuildOptions = {},
): SnapshotBuildResult {
  const sanitized = normalizeLiveRunState(live);
  const issues = validateLiveRunState(sanitized, options);

  const pressureTier = computePressureTier(sanitized.pressureScore);
  const shields = buildFrozenShieldState(sanitized.shields, issues);
  const botStates = buildFrozenBotStates(sanitized.botStates, issues);
  const activeCascades = buildFrozenCascades(sanitized.activeCascades, issues);
  const tickMetrics = normalizeTickMetrics(sanitized.tickMetrics, issues);
  const engine0 = buildEngine0Envelope(sanitized, options, shields, botStates, activeCascades, tickMetrics, pressureTier, issues);

  const snapshot: CoreRunStateSnapshot = new RunStateSnapshotRecord({
    tick: sanitized.tick,
    cash: sanitized.cash,
    income: sanitized.income,
    expenses: sanitized.expenses,
    netWorth: sanitized.netWorth,
    haterHeat: sanitized.haterHeat,
    pressureScore: sanitized.pressureScore,
    pressureTier,
    tickTier: sanitized.tickTier,
    shields,
    botStates,
    activeCascades: activeCascades as CascadeChainInstance[],
    runMode: sanitized.runMode,
    seed: sanitized.seed,
    lifecycleState: sanitized.lifecycle,

    tickIndex: sanitized.tick,
    shieldAvgIntegrityPct: roundTo(shields.overallIntegrityPct * 100, 4),
    activeCascadeChains: activeCascades.length,
    haterAttemptsThisTick: tickMetrics.haterAttemptsThisTick,
    haterBlockedThisTick: tickMetrics.haterBlockedThisTick,
    haterDamagedThisTick: tickMetrics.haterDamagedThisTick,
    cascadesTriggeredThisTick: tickMetrics.cascadesTriggeredThisTick,
    cascadesBrokenThisTick: tickMetrics.cascadesBrokenThisTick,
    decisionsThisTick: Object.freeze(
      tickMetrics.decisionsThisTick.map((decision) => Object.freeze(cloneDecisionRecord(decision))),
    ),

    runId: engine0?.runId,
    userId: engine0?.userId,
    seasonTickBudget: engine0?.seasonTickBudget,
    ticksRemaining: engine0?.ticksRemaining,
    freedomThreshold: engine0?.freedomThreshold,
    cashflow: engine0 ? engine0.cashflow : sanitized.income - sanitized.expenses,
    currentTickTier: sanitized.tickTier,
    currentTickDurationMs: engine0?.currentTickDurationMs ?? TICK_DURATION_MS[sanitized.tickTier],
    activeDecisionWindows: engine0?.activeDecisionWindows ?? 0,
    holdsRemaining: engine0?.holdsRemaining ?? HOLD_BUDGET_BY_TIER[sanitized.tickTier],
    ticksWithoutIncomeGrowth: engine0?.ticksWithoutIncomeGrowth ?? 0,
    tensionScore: engine0?.tensionScore ?? 0,
    anticipationQueueDepth: engine0?.anticipationQueueDepth ?? 0,
    threatVisibilityState: engine0?.threatVisibilityState ?? 'SHADOWED',
    activeBotCount: countActiveBots(botStates),
    activeThreatCardCount: engine0?.activeThreatCardCount ?? 0,
  } as CoreRunStateSnapshot);

  const receipt = createSnapshotReceipt(snapshot);
  return Object.freeze({
    snapshot,
    receipt,
    issues: Object.freeze(issues.map((issue) => Object.freeze(issue))),
  });
}

/** Throws if validation produced any ERROR issues. */
export function buildSnapshotOrThrow(
  live: LiveRunState,
  options: SnapshotBuildOptions = {},
): CoreRunStateSnapshot {
  const result = buildSnapshotResult(live, options);
  const fatal = result.issues.filter((issue) => issue.severity === 'ERROR');
  if (fatal.length > 0) {
    throw new Error(
      `[RunStateSnapshot] Invalid live state for tick ${live.tick}: ${fatal.map((i) => `${i.code}@${i.path}`).join(', ')}`,
    );
  }
  return result.snapshot;
}

// ── Public live-state helpers ─────────────────────────────────────────────────

/** Creates the initial live state for a new run. */
export function createInitialLiveState(params: {
  seed: number;
  startingCash: number;
  startingIncome: number;
  startingExpenses: number;
  runMode: RunMode;
  runId?: string;
  userId?: string;
  seasonTickBudget?: number;
  freedomThreshold?: number;
}): LiveRunState {
  return {
    tick: 0,
    cash: params.startingCash,
    income: params.startingIncome,
    expenses: params.startingExpenses,
    netWorth: params.startingCash,
    haterHeat: 0,
    pressureScore: 0,
    tickTier: 'T1',
    runMode: params.runMode,
    seed: params.seed,
    lifecycle: 'IDLE',
    shields: createInitialShields(),
    botStates: createInitialBotStates(),
    activeCascades: [],
    tickMetrics: createEmptyTickMetrics(),
    engine0: {
      runId: params.runId ?? `RUN_${params.seed}`,
      userId: params.userId ?? 'LOCAL_USER',
      seasonTickBudget: params.seasonTickBudget ?? 720,
      freedomThreshold: params.freedomThreshold ?? Math.max(params.startingCash * 10, 1_000_000),
      ticksRemaining: params.seasonTickBudget ?? 720,
      currentTickDurationMs: TICK_DURATION_MS.T1,
      activeDecisionWindows: 0,
      holdsRemaining: HOLD_BUDGET_BY_TIER.T1,
      ticksWithoutIncomeGrowth: 0,
      tensionScore: 0,
      anticipationQueueDepth: 0,
      threatVisibilityState: 'SHADOWED',
      activeThreatCardCount: 0,
    },
  };
}

export function createEmptyTickMetrics(): TickMetrics {
  return {
    haterAttemptsThisTick: 0,
    haterBlockedThisTick: 0,
    haterDamagedThisTick: 0,
    cascadesTriggeredThisTick: 0,
    cascadesBrokenThisTick: 0,
    decisionsThisTick: [],
  };
}

export function resetTickMetrics(live: LiveRunState): LiveRunState {
  return {
    ...live,
    tickMetrics: createEmptyTickMetrics(),
  };
}

export function recordHaterAttempt(live: LiveRunState, count = 1): LiveRunState {
  const next = cloneLiveRunState(live);
  const metrics = next.tickMetrics ?? createEmptyTickMetrics();
  metrics.haterAttemptsThisTick += Math.max(0, Math.trunc(count));
  next.tickMetrics = metrics;
  return next;
}

export function recordHaterBlocked(live: LiveRunState, count = 1): LiveRunState {
  const next = cloneLiveRunState(live);
  const metrics = next.tickMetrics ?? createEmptyTickMetrics();
  metrics.haterBlockedThisTick += Math.max(0, Math.trunc(count));
  next.tickMetrics = metrics;
  return next;
}

export function recordHaterDamaged(live: LiveRunState, count = 1): LiveRunState {
  const next = cloneLiveRunState(live);
  const metrics = next.tickMetrics ?? createEmptyTickMetrics();
  metrics.haterDamagedThisTick += Math.max(0, Math.trunc(count));
  next.tickMetrics = metrics;
  return next;
}

export function recordCascadeTriggered(live: LiveRunState, count = 1): LiveRunState {
  const next = cloneLiveRunState(live);
  const metrics = next.tickMetrics ?? createEmptyTickMetrics();
  metrics.cascadesTriggeredThisTick += Math.max(0, Math.trunc(count));
  next.tickMetrics = metrics;
  return next;
}

export function recordCascadeBroken(live: LiveRunState, count = 1): LiveRunState {
  const next = cloneLiveRunState(live);
  const metrics = next.tickMetrics ?? createEmptyTickMetrics();
  metrics.cascadesBrokenThisTick += Math.max(0, Math.trunc(count));
  next.tickMetrics = metrics;
  return next;
}

export function recordDecisionTelemetry(
  live: LiveRunState,
  record: DecisionTelemetryRecord,
): LiveRunState {
  const next = cloneLiveRunState(live);
  const metrics = next.tickMetrics ?? createEmptyTickMetrics();
  metrics.decisionsThisTick = [...metrics.decisionsThisTick, cloneDecisionRecord(record)];
  next.tickMetrics = metrics;
  return next;
}

export function cloneLiveRunState(live: LiveRunState): LiveRunState {
  return {
    ...live,
    shields: cloneMutableShieldState(live.shields),
    botStates: cloneMutableBotStates(live.botStates),
    activeCascades: cloneMutableCascades(live.activeCascades),
    ...(live.tickMetrics ? { tickMetrics: normalizeTickMetrics(live.tickMetrics) } : {}),
    ...(live.engine0 ? { engine0: { ...live.engine0 } } : {}),
  };
}

// ── Snapshot inspection and diff helpers ──────────────────────────────────────

export function createSnapshotReceipt(snapshot: CoreRunStateSnapshot): SnapshotReceipt {
  return Object.freeze({
    tickIndex: snapshot.tickIndex,
    ...(snapshot.runId !== undefined ? { runId: snapshot.runId } : {}),
    mode: snapshot.runMode,
    seed: snapshot.seed,
    pressureTier: snapshot.pressureTier,
    tickTier: snapshot.tickTier,
    activeBotCount: snapshot.activeBotCount ?? countActiveBots(snapshot.botStates),
    activeCascadeChains: snapshot.activeCascadeChains,
    integrityPct: snapshot.shieldAvgIntegrityPct,
  } as SnapshotReceipt);
}

export function inspectSnapshot(snapshot: CoreRunStateSnapshot): SnapshotInspection {
  const shieldSurface = createShieldSurface(snapshot.shields);
  return Object.freeze({
    receipt: createSnapshotReceipt(snapshot),
    tierDescriptor: Object.freeze({
      tickDurationMs: snapshot.currentTickDurationMs ?? TICK_DURATION_MS[snapshot.tickTier],
      decisionWindowSeconds: DECISION_WINDOW_S[snapshot.tickTier],
      holdBudget: snapshot.holdsRemaining ?? HOLD_BUDGET_BY_TIER[snapshot.tickTier],
    }),
    shieldSurface,
    activeBotCount: snapshot.activeBotCount ?? countActiveBots(snapshot.botStates),
    highestCascadeSeverity: detectHighestCascadeSeverity(snapshot.activeCascades),
    hasCriticalPressure: snapshot.pressureTier === 'CRITICAL',
    isFrozen: isDeepFrozenSnapshot(snapshot),
  });
}

export function diffSnapshots(
  before: CoreRunStateSnapshot,
  after: CoreRunStateSnapshot,
): readonly SnapshotDiff[] {
  const diffs: SnapshotDiff[] = [];
  pushDiffIfChanged(diffs, 'tickIndex', before.tickIndex, after.tickIndex);
  pushDiffIfChanged(diffs, 'cash', before.cash, after.cash);
  pushDiffIfChanged(diffs, 'income', before.income, after.income);
  pushDiffIfChanged(diffs, 'expenses', before.expenses, after.expenses);
  pushDiffIfChanged(diffs, 'netWorth', before.netWorth, after.netWorth);
  pushDiffIfChanged(diffs, 'pressureScore', before.pressureScore, after.pressureScore);
  pushDiffIfChanged(diffs, 'pressureTier', before.pressureTier, after.pressureTier);
  pushDiffIfChanged(diffs, 'tickTier', before.tickTier, after.tickTier);
  pushDiffIfChanged(diffs, 'haterHeat', before.haterHeat, after.haterHeat);
  pushDiffIfChanged(diffs, 'shieldAvgIntegrityPct', before.shieldAvgIntegrityPct, after.shieldAvgIntegrityPct);
  pushDiffIfChanged(diffs, 'activeCascadeChains', before.activeCascadeChains, after.activeCascadeChains);
  return Object.freeze(diffs);
}

export function isDeepFrozenSnapshot(snapshot: CoreRunStateSnapshot): boolean {
  if (!Object.isFrozen(snapshot)) {
    return false;
  }
  if (!Object.isFrozen(snapshot.shields)) {
    return false;
  }
  if (!Object.isFrozen(snapshot.shields.layers)) {
    return false;
  }
  for (const layerId of SHIELD_LAYER_IDS) {
    if (!Object.isFrozen(snapshot.shields.layers[layerId])) {
      return false;
    }
  }
  if (!Object.isFrozen(snapshot.botStates)) {
    return false;
  }
  for (const botId of BOT_IDS) {
    if (!Object.isFrozen(snapshot.botStates[botId])) {
      return false;
    }
  }
  if (!Object.isFrozen(snapshot.activeCascades)) {
    return false;
  }
  if (!Object.isFrozen(snapshot.decisionsThisTick)) {
    return false;
  }
  return true;
}

// ── Internal builders ─────────────────────────────────────────────────────────

function buildFrozenShieldState(
  mutable: MutableShieldState,
  issues: SnapshotValidationIssue[],
): ShieldState {
  const frozenLayers = {} as Record<ShieldLayerId, ShieldLayer>;

  for (const layerId of SHIELD_LAYER_IDS) {
    const layer = mutable.layers[layerId];
    if (!layer) {
      issues.push({
        code: 'MISSING_SHIELD_LAYER',
        severity: 'ERROR',
        message: `Missing shield layer ${layerId}`,
        path: `shields.layers.${layerId}`,
      });

      frozenLayers[layerId] = Object.freeze({
        id: layerId,
        label: SHIELD_LAYER_LABELS[layerId],
        current: 0,
        max: SHIELD_MAX_INTEGRITY[layerId],
        breached: true,
        lastBreach: null,
        regenActive: true,
      });
      continue;
    }

    const max = Math.max(0, coerceFiniteNumber(layer.max, SHIELD_MAX_INTEGRITY[layerId]));
    const current = clamp(coerceFiniteNumber(layer.current, max), 0, max);
    const breached = Boolean(layer.breached || current <= 0);

    if (current > max) {
      issues.push({
        code: 'OUT_OF_RANGE_SHIELD',
        severity: 'WARN',
        message: `Shield current integrity exceeded max for ${layerId} and was clamped.`,
        path: `shields.layers.${layerId}.current`,
      });
    }

    frozenLayers[layerId] = Object.freeze({
      id: layerId,
      label: layer.label || SHIELD_LAYER_LABELS[layerId],
      current,
      max,
      breached,
      lastBreach: layer.lastBreach == null ? null : Math.max(0, Math.trunc(layer.lastBreach)),
      regenActive: Boolean(layer.regenActive),
    });
  }

  const overallIntegrityPct = computeOverallIntegrity(frozenLayers);

  return Object.freeze({
    layers: Object.freeze(frozenLayers),
    overallIntegrityPct,
    l4BreachCount: Math.max(0, Math.trunc(coerceFiniteNumber(mutable.l4BreachCount, 0))),
  });
}

function buildFrozenBotStates(
  botStates: Record<BotId, BotRuntimeState>,
  issues: SnapshotValidationIssue[],
): Readonly<Record<BotId, BotRuntimeState>> {
  const frozen = {} as Record<BotId, BotRuntimeState>;

  for (const botId of BOT_IDS) {
    const state = botStates[botId];
    if (!state) {
      issues.push({
        code: 'MISSING_BOT_STATE',
        severity: 'ERROR',
        message: `Missing bot runtime state for ${botId}`,
        path: `botStates.${botId}`,
      });

      frozen[botId] = Object.freeze({
        id: botId,
        state: 'DORMANT',
        ticksInState: 0,
        preloadedArrival: null,
        isCritical: false,
        lastAttackTick: null,
      });
      continue;
    }

    frozen[botId] = Object.freeze({
      ...state,
      ticksInState: Math.max(0, Math.trunc(coerceFiniteNumber(state.ticksInState, 0))),
      preloadedArrival: state.preloadedArrival == null ? null : Math.max(0, Math.trunc(state.preloadedArrival)),
      isCritical: Boolean(state.isCritical),
      lastAttackTick: state.lastAttackTick == null ? null : Math.max(0, Math.trunc(state.lastAttackTick)),
    });
  }

  return Object.freeze(frozen);
}

function buildFrozenCascades(
  activeCascades: CascadeChainInstance[],
  issues: SnapshotValidationIssue[],
): ReadonlyArray<CascadeChainInstance> {
  return Object.freeze(
    activeCascades.map((cascade, cascadeIndex) => {
      const links = cascade.links.map((link, linkIndex) => {
        if (link.tickOffset < 0) {
          issues.push({
            code: 'CASCADE_LINK_NEGATIVE_OFFSET',
            severity: 'ERROR',
            message: `Cascade ${cascade.id} has negative tickOffset at link ${linkIndex}`,
            path: `activeCascades.${cascadeIndex}.links.${linkIndex}.tickOffset`,
          });
        }

        return Object.freeze({
          ...link,
          tickOffset: Math.max(0, Math.trunc(coerceFiniteNumber(link.tickOffset, 0))),
          magnitude: coerceFiniteNumber(link.magnitude, 0),
        });
      });

      return Object.freeze({
        ...cascade,
        triggerTick: Math.max(0, Math.trunc(coerceFiniteNumber(cascade.triggerTick, 0))),
        links,
      });
    }),
  );
}

function normalizeTickMetrics(
  metrics?: TickMetrics,
  issues: SnapshotValidationIssue[] = [],
): TickMetrics {
  if (!metrics) {
    return createEmptyTickMetrics();
  }

  const normalizedDecisions = metrics.decisionsThisTick.map((decision, index) => {
    const clone = cloneDecisionRecord(decision);
    if (clone.decisionWindowMs < 0 || clone.resolvedInMs < 0) {
      issues.push({
        code: 'DECISION_INVALID_WINDOW',
        severity: 'ERROR',
        message: 'Decision telemetry contained a negative window or resolution duration.',
        path: `tickMetrics.decisionsThisTick.${index}`,
      });
    }
    if (clone.speedScore < 0 || clone.speedScore > 1) {
      issues.push({
        code: 'DECISION_INVALID_SPEED',
        severity: 'WARN',
        message: 'Decision speed score was outside 0..1 and was clamped.',
        path: `tickMetrics.decisionsThisTick.${index}.speedScore`,
      });
    }
    return clone;
  });

  return {
    haterAttemptsThisTick: Math.max(0, Math.trunc(coerceFiniteNumber(metrics.haterAttemptsThisTick, 0))),
    haterBlockedThisTick: Math.max(0, Math.trunc(coerceFiniteNumber(metrics.haterBlockedThisTick, 0))),
    haterDamagedThisTick: Math.max(0, Math.trunc(coerceFiniteNumber(metrics.haterDamagedThisTick, 0))),
    cascadesTriggeredThisTick: Math.max(0, Math.trunc(coerceFiniteNumber(metrics.cascadesTriggeredThisTick, 0))),
    cascadesBrokenThisTick: Math.max(0, Math.trunc(coerceFiniteNumber(metrics.cascadesBrokenThisTick, 0))),
    decisionsThisTick: normalizedDecisions,
  };
}

function buildEngine0Envelope(
  live: LiveRunState,
  options: SnapshotBuildOptions,
  shields: ShieldState,
  botStates: Readonly<Record<BotId, BotRuntimeState>>,
  activeCascades: ReadonlyArray<CascadeChainInstance>,
  tickMetrics: TickMetrics,
  pressureTier: PressureTier,
  issues: SnapshotValidationIssue[],
): Engine0SnapshotEnvelope | null {
  const merged = {
    ...live.engine0,
    runId: options.runId ?? live.engine0?.runId,
    userId: options.userId ?? live.engine0?.userId,
    seasonTickBudget: options.seasonTickBudget ?? live.engine0?.seasonTickBudget,
    freedomThreshold: options.freedomThreshold ?? live.engine0?.freedomThreshold,
    ticksRemaining: options.ticksRemaining ?? live.engine0?.ticksRemaining,
    currentTickDurationMs: options.currentTickDurationMs ?? live.engine0?.currentTickDurationMs,
    activeDecisionWindows: options.activeDecisionWindows ?? live.engine0?.activeDecisionWindows,
    holdsRemaining: options.holdsRemaining ?? live.engine0?.holdsRemaining,
    ticksWithoutIncomeGrowth: options.ticksWithoutIncomeGrowth ?? live.engine0?.ticksWithoutIncomeGrowth,
    tensionScore: options.tensionScore ?? live.engine0?.tensionScore,
    anticipationQueueDepth: options.anticipationQueueDepth ?? live.engine0?.anticipationQueueDepth,
    threatVisibilityState: options.threatVisibilityState ?? live.engine0?.threatVisibilityState,
    activeThreatCardCount: options.activeThreatCardCount ?? live.engine0?.activeThreatCardCount,
  } as Partial<Engine0RuntimeState>;

  const shouldBuild = Boolean(options.includeEngine0Envelope || live.engine0 || options.runId || options.userId);
  if (!shouldBuild) {
    return null;
  }

  const missing: string[] = [];
  const runId = merged.runId;
  const userId = merged.userId;
  const seasonTickBudget = merged.seasonTickBudget;
  const freedomThreshold = merged.freedomThreshold;

  if (!runId) missing.push('runId');
  if (!userId) missing.push('userId');
  if (typeof seasonTickBudget !== 'number') missing.push('seasonTickBudget');
  if (typeof freedomThreshold !== 'number') missing.push('freedomThreshold');

  if (missing.length > 0) {
    issues.push({
      code: 'ENGINE0_INCOMPLETE',
      severity: 'WARN',
      message: `Engine0 envelope incomplete: ${missing.join(', ')}`,
      path: 'engine0',
    });
  }

  const activeBotCount = countActiveBots(botStates);
  return Object.freeze({
    runId: runId ?? `RUN_${live.seed}`,
    userId: userId ?? 'LOCAL_USER',
    seed: String(live.seed),
    tickIndex: live.tick,
    seasonTickBudget: Math.max(0, Math.trunc(coerceFiniteNumber(seasonTickBudget, 0))),
    ticksRemaining: Math.max(0, Math.trunc(coerceFiniteNumber(merged.ticksRemaining, 0))),
    freedomThreshold: Math.max(0, coerceFiniteNumber(freedomThreshold, 0)),

    netWorth: live.netWorth,
    cashBalance: live.cash,
    monthlyIncome: live.income,
    monthlyExpenses: live.expenses,
    cashflow: live.income - live.expenses,

    currentTickTier: live.tickTier,
    currentTickDurationMs: Math.max(0, Math.trunc(coerceFiniteNumber(merged.currentTickDurationMs, TICK_DURATION_MS[live.tickTier]))),
    activeDecisionWindows: Math.max(0, Math.trunc(coerceFiniteNumber(merged.activeDecisionWindows, 0))),
    holdsRemaining: Math.max(0, Math.trunc(coerceFiniteNumber(merged.holdsRemaining, HOLD_BUDGET_BY_TIER[live.tickTier]))),

    pressureScore: live.pressureScore,
    pressureTier,
    ticksWithoutIncomeGrowth: Math.max(0, Math.trunc(coerceFiniteNumber(merged.ticksWithoutIncomeGrowth, 0))),

    tensionScore: clamp(coerceFiniteNumber(merged.tensionScore, 0), 0, 1),
    anticipationQueueDepth: Math.max(0, Math.trunc(coerceFiniteNumber(merged.anticipationQueueDepth, 0))),
    threatVisibilityState: merged.threatVisibilityState ?? 'SHADOWED',

    shieldAvgIntegrityPct: roundTo(shields.overallIntegrityPct * 100, 4),
    shieldL1Integrity: shields.layers.L1_LIQUIDITY_BUFFER.current,
    shieldL2Integrity: shields.layers.L2_CREDIT_LINE.current,
    shieldL3Integrity: shields.layers.L3_ASSET_FLOOR.current,
    shieldL4Integrity: shields.layers.L4_NETWORK_CORE.current,
    shieldL1Max: shields.layers.L1_LIQUIDITY_BUFFER.max,
    shieldL2Max: shields.layers.L2_CREDIT_LINE.max,
    shieldL3Max: shields.layers.L3_ASSET_FLOOR.max,
    shieldL4Max: shields.layers.L4_NETWORK_CORE.max,

    haterHeat: live.haterHeat,
    activeBotCount,
    haterAttemptsThisTick: tickMetrics.haterAttemptsThisTick,
    haterBlockedThisTick: tickMetrics.haterBlockedThisTick,
    haterDamagedThisTick: tickMetrics.haterDamagedThisTick,
    activeThreatCardCount: Math.max(0, Math.trunc(coerceFiniteNumber(merged.activeThreatCardCount, 0))),

    activeCascadeChains: activeCascades.length,
    cascadesTriggeredThisTick: tickMetrics.cascadesTriggeredThisTick,
    cascadesBrokenThisTick: tickMetrics.cascadesBrokenThisTick,

    decisionsThisTick: Object.freeze(tickMetrics.decisionsThisTick.map((item) => Object.freeze(item))),
    outcomeCheckPriority: Object.freeze(['FREEDOM', 'BANKRUPT', 'TIMEOUT', 'ABANDONED'] as const),
  });
}

// ── Validation and normalization ──────────────────────────────────────────────

function normalizeLiveRunState(live: LiveRunState): LiveRunState {
  return {
    ...live,
    tick: Math.max(0, Math.trunc(coerceFiniteNumber(live.tick, 0))),
    cash: coerceFiniteNumber(live.cash, 0),
    income: coerceFiniteNumber(live.income, 0),
    expenses: coerceFiniteNumber(live.expenses, 0),
    netWorth: coerceFiniteNumber(live.netWorth, 0),
    haterHeat: clamp(coerceFiniteNumber(live.haterHeat, 0), 0, 100),
    pressureScore: clamp(coerceFiniteNumber(live.pressureScore, 0), 0, 1),
    shields: cloneMutableShieldState(live.shields),
    botStates: cloneMutableBotStates(live.botStates),
    activeCascades: cloneMutableCascades(live.activeCascades),
    ...(live.tickMetrics ? { tickMetrics: normalizeTickMetrics(live.tickMetrics) } : {}),
    ...(live.engine0 ? { engine0: { ...live.engine0 } } : {}),
  };
}

export function validateLiveRunState(
  live: LiveRunState,
  options: SnapshotBuildOptions = {},
): SnapshotValidationIssue[] {
  const issues: SnapshotValidationIssue[] = [];

  if (live.tick < 0) {
    issues.push({
      code: 'NEGATIVE_TICK',
      severity: 'ERROR',
      message: 'Tick index cannot be negative.',
      path: 'tick',
    });
  }

  if (!Number.isFinite(live.pressureScore) || live.pressureScore < 0 || live.pressureScore > 1) {
    issues.push({
      code: 'OUT_OF_RANGE_PRESSURE',
      severity: 'WARN',
      message: 'Pressure score was outside 0..1 and will be clamped.',
      path: 'pressureScore',
    });
  }

  if (!Number.isFinite(live.haterHeat) || live.haterHeat < 0 || live.haterHeat > 100) {
    issues.push({
      code: 'OUT_OF_RANGE_HEAT',
      severity: 'WARN',
      message: 'Hater heat was outside 0..100 and will be clamped.',
      path: 'haterHeat',
    });
  }

  for (const layerId of SHIELD_LAYER_IDS) {
    const layer = live.shields.layers[layerId];
    if (!layer) {
      issues.push({
        code: 'MISSING_SHIELD_LAYER',
        severity: 'ERROR',
        message: `Missing shield layer ${layerId}`,
        path: `shields.layers.${layerId}`,
      });
      continue;
    }
    if (!Number.isFinite(layer.current) || !Number.isFinite(layer.max)) {
      issues.push({
        code: 'INVALID_NUMBER',
        severity: 'ERROR',
        message: `Shield layer ${layerId} contains a non-finite number.`,
        path: `shields.layers.${layerId}`,
      });
    }
  }

  for (const botId of BOT_IDS) {
    if (!live.botStates[botId]) {
      issues.push({
        code: 'MISSING_BOT_STATE',
        severity: 'ERROR',
        message: `Missing bot state for ${botId}`,
        path: `botStates.${botId}`,
      });
    }
  }

  if (options.includeEngine0Envelope && !live.engine0 && !options.runId) {
    issues.push({
      code: 'ENGINE0_INCOMPLETE',
      severity: 'WARN',
      message: 'Engine0 envelope requested but no engine0 data or runId was supplied.',
      path: 'engine0',
    });
  }

  const recalculatedNetWorth = coerceFiniteNumber(live.cash, 0);
  if (!Number.isFinite(live.netWorth) || Math.abs(live.netWorth - recalculatedNetWorth) > 1_000_000_000) {
    issues.push({
      code: 'INTEGRITY_MISMATCH',
      severity: 'WARN',
      message: 'Net worth looks structurally inconsistent with the current mutable state.',
      path: 'netWorth',
    });
  }

  return issues;
}

// ── Mutable state factories ───────────────────────────────────────────────────

function createInitialShields(): MutableShieldState {
  const layers: Record<ShieldLayerId, MutableShieldLayer> = {
    L1_LIQUIDITY_BUFFER: {
      id: 'L1_LIQUIDITY_BUFFER',
      label: SHIELD_LAYER_LABELS.L1_LIQUIDITY_BUFFER,
      current: SHIELD_MAX_INTEGRITY.L1_LIQUIDITY_BUFFER,
      max: SHIELD_MAX_INTEGRITY.L1_LIQUIDITY_BUFFER,
      breached: false,
      lastBreach: null,
      regenActive: SHIELD_REGEN_PER_TICK.L1_LIQUIDITY_BUFFER > 0,
    },
    L2_CREDIT_LINE: {
      id: 'L2_CREDIT_LINE',
      label: SHIELD_LAYER_LABELS.L2_CREDIT_LINE,
      current: SHIELD_MAX_INTEGRITY.L2_CREDIT_LINE,
      max: SHIELD_MAX_INTEGRITY.L2_CREDIT_LINE,
      breached: false,
      lastBreach: null,
      regenActive: SHIELD_REGEN_PER_TICK.L2_CREDIT_LINE > 0,
    },
    L3_ASSET_FLOOR: {
      id: 'L3_ASSET_FLOOR',
      label: SHIELD_LAYER_LABELS.L3_ASSET_FLOOR,
      current: SHIELD_MAX_INTEGRITY.L3_ASSET_FLOOR,
      max: SHIELD_MAX_INTEGRITY.L3_ASSET_FLOOR,
      breached: false,
      lastBreach: null,
      regenActive: SHIELD_REGEN_PER_TICK.L3_ASSET_FLOOR > 0,
    },
    L4_NETWORK_CORE: {
      id: 'L4_NETWORK_CORE',
      label: SHIELD_LAYER_LABELS.L4_NETWORK_CORE,
      current: SHIELD_MAX_INTEGRITY.L4_NETWORK_CORE,
      max: SHIELD_MAX_INTEGRITY.L4_NETWORK_CORE,
      breached: false,
      lastBreach: null,
      regenActive: SHIELD_REGEN_PER_TICK.L4_NETWORK_CORE > 0,
    },
  };

  return { layers, l4BreachCount: 0 };
}

function createInitialBotStates(): Record<BotId, BotRuntimeState> {
  const states = {} as Record<BotId, BotRuntimeState>;

  for (const id of BOT_IDS) {
    states[id] = {
      id,
      state: 'DORMANT',
      ticksInState: 0,
      preloadedArrival: null,
      isCritical: false,
      lastAttackTick: null,
    };
  }

  return states;
}

function cloneMutableShieldState(shields: MutableShieldState): MutableShieldState {
  const layers = {} as Record<ShieldLayerId, MutableShieldLayer>;
  for (const layerId of SHIELD_LAYER_IDS) {
    const layer = shields.layers[layerId];
    if (!layer) {
      continue;
    }
    layers[layerId] = { ...layer };
  }
  return {
    layers,
    l4BreachCount: shields.l4BreachCount,
  };
}

function cloneMutableBotStates(states: Record<BotId, BotRuntimeState>): Record<BotId, BotRuntimeState> {
  const cloned = {} as Record<BotId, BotRuntimeState>;
  for (const botId of BOT_IDS) {
    const state = states[botId];
    if (!state) {
      continue;
    }
    cloned[botId] = { ...state };
  }
  return cloned;
}

function cloneMutableCascades(activeCascades: CascadeChainInstance[]): CascadeChainInstance[] {
  return activeCascades.map((cascade) => ({
    ...cascade,
    links: cascade.links.map((link) => ({ ...link })),
  }));
}

// ── Primitive helpers ─────────────────────────────────────────────────────────

function cloneDecisionRecord(decision: DecisionTelemetryRecord): DecisionTelemetryRecord {
  return {
    cardId: decision.cardId,
    decisionWindowMs: Math.max(0, Math.trunc(coerceFiniteNumber(decision.decisionWindowMs, 0))),
    resolvedInMs: Math.max(0, Math.trunc(coerceFiniteNumber(decision.resolvedInMs, 0))),
    wasAutoResolved: Boolean(decision.wasAutoResolved),
    wasOptimalChoice: Boolean(decision.wasOptimalChoice),
    speedScore: clamp(coerceFiniteNumber(decision.speedScore, 0), 0, 1),
  };
}

function computeOverallIntegrity(layers: Record<ShieldLayerId, ShieldLayer>): number {
  let totalMax = 0;
  let totalCurrent = 0;

  for (const layerId of SHIELD_LAYER_IDS) {
    totalMax += layers[layerId].max;
    totalCurrent += layers[layerId].current;
  }

  if (totalMax === 0) {
    return 0;
  }

  return roundTo(totalCurrent / totalMax, 6);
}

function computePressureTier(score: number): PressureTier {
  if (score >= PRESSURE_TIER_THRESHOLDS.CRITICAL) return 'CRITICAL';
  if (score >= PRESSURE_TIER_THRESHOLDS.HIGH) return 'HIGH';
  if (score >= PRESSURE_TIER_THRESHOLDS.ELEVATED) return 'ELEVATED';
  if (score >= PRESSURE_TIER_THRESHOLDS.BUILDING) return 'BUILDING';
  return 'CALM';
}

function countActiveBots(botStates: Readonly<Record<BotId, BotRuntimeState>>): number {
  let count = 0;
  for (const botId of BOT_IDS) {
    const state = botStates[botId]?.state;
    if (state === 'WATCHING' || state === 'TARGETING' || state === 'ATTACKING') {
      count += 1;
    }
  }
  return count;
}

function createShieldSurface(shields: ShieldState): ShieldSnapshotSurface {
  return Object.freeze({
    shieldAvgIntegrityPct: roundTo(shields.overallIntegrityPct * 100, 4),
    shieldL1Integrity: shields.layers.L1_LIQUIDITY_BUFFER.current,
    shieldL2Integrity: shields.layers.L2_CREDIT_LINE.current,
    shieldL3Integrity: shields.layers.L3_ASSET_FLOOR.current,
    shieldL4Integrity: shields.layers.L4_NETWORK_CORE.current,
    shieldL1Max: shields.layers.L1_LIQUIDITY_BUFFER.max,
    shieldL2Max: shields.layers.L2_CREDIT_LINE.max,
    shieldL3Max: shields.layers.L3_ASSET_FLOOR.max,
    shieldL4Max: shields.layers.L4_NETWORK_CORE.max,
  });
}

function detectHighestCascadeSeverity(
  cascades: readonly CascadeChainInstance[],
): CascadeSeverity | null {
  if (cascades.length === 0) {
    return null;
  }

  let highest: CascadeSeverity = 'LOW';
  const weightBySeverity: Record<CascadeSeverity, number> = {
    LOW: 1,
    MEDIUM: 2,
    HIGH: 3,
    CATASTROPHIC: 4,
  };

  for (const cascade of cascades) {
    if (weightBySeverity[cascade.severity] > weightBySeverity[highest]) {
      highest = cascade.severity;
    }
  }

  return highest;
}

function pushDiffIfChanged<T>(
  diffs: SnapshotDiff[],
  key: string,
  before: T,
  after: T,
): void {
  if (Object.is(before, after)) {
    return;
  }
  diffs.push(Object.freeze({ key, before, after }));
}

function coerceFiniteNumber(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

