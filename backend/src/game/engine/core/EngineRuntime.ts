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
  EngineTickResult,
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
import {
  normalizeEngineTickResult,
} from './EngineContracts';
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
}

const STEP_TO_ENGINE: Partial<Record<TickStep, EngineId>> = {
  STEP_02_TIME: 'time',
  STEP_03_PRESSURE: 'pressure',
  STEP_04_TENSION: 'tension',
  STEP_05_BATTLE: 'battle',
  STEP_06_SHIELD: 'shield',
  STEP_07_CASCADE: 'cascade',
  STEP_10_SOVEREIGNTY_SNAPSHOT: 'sovereignty',
};

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

function resolveSafeTickDurationMs(snapshot: RunStateSnapshot): number {
  const configured = Number(snapshot.timers.currentTickDurationMs);

  if (Number.isFinite(configured) && configured > 0) {
    return Math.trunc(configured);
  }

  return TIER_DURATIONS_MS[snapshot.pressure.tier];
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

export class EngineRuntime {
  private readonly registry: EngineRegistry;
  private readonly bus: EventBus<EngineEventMap & Record<string, unknown>>;
  private readonly clock: DeterministicClock;
  private readonly windows: DecisionWindowService;
  private readonly overlays: CardOverlayResolver;

  private snapshot: RunStateSnapshot | null = null;
  private activeStep: TickStep = 'STEP_01_PREPARE';
  private runStartedEmitted = false;

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
    this.emitRunStartedIfNeeded();
    return this.requireSnapshot();
  }

  public current(): RunStateSnapshot {
    return this.requireSnapshot();
  }

  public flushEvents(): Array<RuntimeEventEnvelope> {
    return this.bus.flush() as Array<RuntimeEventEnvelope>;
  }

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
      };
    }

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

    return {
      accepted: true,
      snapshot: this.requireSnapshot(),
      playedCard: instance,
      chosenTimingClass: validation.chosenTimingClass,
      reasons: [],
    };
  }

  public tick(): RuntimeTickResult {
    const base = this.requireSnapshot();

    if (base.outcome !== null) {
      return {
        snapshot: base,
        checksum: base.telemetry.lastTickChecksum ?? computeTickChecksum(base),
        events: [],
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

    return {
      snapshot: sealedSnapshot,
      checksum,
      events,
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