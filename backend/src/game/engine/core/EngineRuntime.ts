/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/core/EngineRuntime.ts
 *
 * Doctrine:
 * - backend is the authoritative simulation runtime
 * - engines tick in deterministic order
 * - cards are backend-validated against open timing windows
 * - run state, tick checksums, and proof hashes are backend-owned
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
} from './EngineContracts';
import type { RunFactoryInput } from './RunStateFactory';

import { DeterministicClock } from './ClockSource';
import {
  cloneJson,
  createDeterministicId,
  deepFreeze,
  checksumSnapshot,
} from './Deterministic';
import { EngineRegistry } from './EngineRegistry';
import { EventBus } from './EventBus';
import { createInitialRunState } from './RunStateFactory';
import { TICK_SEQUENCE } from './TickSequence';
import { DecisionWindowService } from './DecisionWindowService';
import { CardOverlayResolver, type ResourceType } from './CardOverlayResolver';

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

const PRESSURE_TICK_DURATION_MS = {
  T0: 2_000,
  T1: 4_000,
  T2: 6_000,
  T3: 8_500,
  T4: 12_000,
} as const;

function latestThree(values: readonly string[]): string[] {
  return values.slice(Math.max(0, values.length - 3));
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

  return Math.round(
    (snapshot.economy.cash - snapshot.economy.debt + recurring + shieldValue) * 100,
  ) / 100;
}

function weakestLayerId(
  snapshot: RunStateSnapshot,
): RunStateSnapshot['shield']['weakestLayerId'] {
  return snapshot.shield.layers
    .slice()
    .sort((a, b) => a.current - b.current)[0]?.layerId ?? 'L1';
}

function currentPhase(snapshot: RunStateSnapshot): RunStateSnapshot['phase'] {
  const totalBudgetMs =
    snapshot.timers.seasonBudgetMs + snapshot.timers.extensionBudgetMs;
  const third = totalBudgetMs / 3;

  if (snapshot.timers.elapsedMs < third) {
    return 'FOUNDATION';
  }

  if (snapshot.timers.elapsedMs < third * 2) {
    return 'ESCALATION';
  }

  return 'SOVEREIGNTY';
}

function computeTickChecksum(snapshot: RunStateSnapshot): string {
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
      windows: Object.keys(snapshot.timers.activeDecisionWindows ?? {}).sort(),
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
      ? snapshot.timers.currentTickDurationMs
      : acceptedDecisions.reduce((sum, decision) => sum + decision.latencyMs, 0) /
        acceptedDecisions.length;

  const decisionSpeedScore = Math.max(
    0,
    1 - avgDecisionLatency / Math.max(1, snapshot.timers.currentTickDurationMs),
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

  return Math.round(score * 1000) / 1000;
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

    this.snapshot = snapshot;
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

    const next = cloneJson(snapshot);
    next.cards.hand.push(instance);
    next.cards.drawHistory.push(instance.instanceId);

    this.snapshot = deepFreeze(next);

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

    const next = cloneJson(snapshot);
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

    this.snapshot = deepFreeze(next);

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
    let next = cloneJson(base);

    this.emitRunStartedIfNeeded();

    const previousPhase = next.phase;
    const previousTier = next.pressure.tier;
    const previousTickDuration = next.timers.currentTickDurationMs;

    next.tick += 1;
    next.timers.elapsedMs += previousTickDuration;
    this.clock.advance(previousTickDuration);

    const nowMs = this.clock.now();

    this.bus.emit('tick.started', {
      runId: next.runId,
      tick: next.tick,
      phase: next.phase,
    });

    next = cloneJson(
      this.windows.reconcile(deepFreeze(next), {
        step: 'STEP_01_PREPARE',
        nowMs,
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
      }

      if (step === 'STEP_11_OUTCOME_GATE') {
        next = this.applyOutcomeGate(next);
        continue;
      }

      if (step === 'STEP_12_EVENT_SEAL') {
        continue;
      }

      if (step === 'STEP_13_FLUSH') {
        continue;
      }

      next = this.executeEngineStep(next, step, nowMs);
    }

    const phaseAfterTick = currentPhase(next);
    if (phaseAfterTick !== next.phase) {
      next.phase = phaseAfterTick;
    }

    const pressureTierAfterTick = next.pressure.tier;
    next.timers.currentTickDurationMs =
      PRESSURE_TICK_DURATION_MS[pressureTierAfterTick];

    next = cloneJson(
      this.windows.reconcile(deepFreeze(next), {
        step: 'STEP_08_MODE_POST',
        nowMs,
        previousPhase,
        nextPhase: next.phase,
        previousTier,
        nextTier: next.pressure.tier,
      }),
    );

    const checksum = computeTickChecksum(next);
    next.sovereignty.tickChecksums.push(checksum);
    next.telemetry.lastTickChecksum = checksum;
    next.economy.netWorth = recomputeNetWorth(next);
    next.shield.weakestLayerId = weakestLayerId(next);

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

    this.snapshot = deepFreeze(next);

    return {
      snapshot: this.requireSnapshot(),
      checksum,
      events: this.flushEvents(),
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

  private prepareForTick(snapshot: RunStateSnapshot): RunStateSnapshot {
    const next = cloneJson(snapshot);

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

  private applyModePostProcessing(snapshot: RunStateSnapshot): RunStateSnapshot {
    const next = cloneJson(snapshot);
    const newPhase = currentPhase(next);

    if (newPhase !== next.phase) {
      next.phase = newPhase;

      if (next.mode === 'solo') {
        next.modeState.phaseBoundaryWindowsRemaining = 5;
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
    snapshot: RunStateSnapshot,
  ): RunStateSnapshot {
    const next = cloneJson(snapshot);

    if (next.pressure.tier === 'T3' || next.pressure.tier === 'T4') {
      next.pressure.survivedHighPressureTicks += 1;
    }

    return next;
  }

  private applySovereigntySnapshot(
    snapshot: RunStateSnapshot,
  ): RunStateSnapshot {
    const next = cloneJson(snapshot);
    next.sovereignty.integrityStatus =
      next.outcome === null ? 'PENDING' : 'VERIFIED';
    return next;
  }

  private applyOutcomeGate(snapshot: RunStateSnapshot): RunStateSnapshot {
    const next = cloneJson(snapshot);
    next.outcome = determineOutcome(next);

    if (next.outcome === 'BANKRUPT') {
      next.telemetry.outcomeReason = 'economy.cash_below_zero';
    } else if (next.outcome === 'TIMEOUT') {
      next.telemetry.outcomeReason = 'timer.expired';
    } else if (next.outcome === 'FREEDOM') {
      next.telemetry.outcomeReason = 'economy.freedom_target_reached';
    }

    return next;
  }

  private isEngineTickResult(
    value: RunStateSnapshot | EngineTickResult,
  ): value is EngineTickResult {
    return (
      value !== null &&
      typeof value === 'object' &&
      'snapshot' in value &&
      value.snapshot !== undefined
    );
  }

  private normalizeEngineOutput(
    value: RunStateSnapshot | EngineTickResult,
  ): RunStateSnapshot {
    return this.isEngineTickResult(value) ? value.snapshot : value;
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

  private executeEngineStep(
    snapshot: RunStateSnapshot,
    step: TickStep,
    nowMs: number,
  ): RunStateSnapshot {
    const engineId = STEP_TO_ENGINE[step];
    if (!engineId) {
      return snapshot;
    }

    const engine = this.tryGetEngine(engineId);
    if (!engine) {
      return snapshot;
    }

    const context: TickContext = {
      step,
      nowMs,
      clock: this.clock,
      bus: this.bus as TickContext['bus'],
      trace: this.createTickTrace(snapshot, step, nowMs),
    };

    const output = engine.tick(snapshot, context);
    const normalizedSnapshot = this.normalizeEngineOutput(output);

    return cloneJson(normalizedSnapshot);
  }

  private tryGetEngine(engineId: EngineId) {
    try {
      return this.registry.get(engineId);
    } catch {
      return null;
    }
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
    snapshot: RunStateSnapshot,
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

      snapshot.economy.cash =
        Math.round((snapshot.economy.cash - amount) * 100) / 100;
      return true;
    }

    if (resourceType === 'battle_budget') {
      if (snapshot.battle.battleBudget < amount) {
        return false;
      }

      snapshot.battle.battleBudget =
        Math.round((snapshot.battle.battleBudget - amount) * 100) / 100;

      return true;
    }

    if (resourceType === 'shared_treasury') {
      if (snapshot.modeState.sharedTreasuryBalance < amount) {
        return false;
      }

      snapshot.modeState.sharedTreasuryBalance =
        Math.round((snapshot.modeState.sharedTreasuryBalance - amount) * 100) / 100;

      return true;
    }

    return false;
  }

  private applyEffectPayload(
    snapshot: RunStateSnapshot,
    effect: EffectPayload,
    targeting: Targeting,
  ): void {
    if (typeof effect.cashDelta === 'number') {
      if (targeting === 'TEAM' && snapshot.mode === 'coop') {
        snapshot.modeState.sharedTreasuryBalance =
          Math.round((snapshot.modeState.sharedTreasuryBalance + effect.cashDelta) * 100) /
          100;
      } else {
        snapshot.economy.cash =
          Math.round((snapshot.economy.cash + effect.cashDelta) * 100) / 100;
      }
    }

    if (typeof effect.incomeDelta === 'number') {
      snapshot.economy.incomePerTick =
        Math.round((snapshot.economy.incomePerTick + effect.incomeDelta) * 100) /
        100;
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
      snapshot.economy.haterHeat =
        Math.round((snapshot.economy.haterHeat + effect.heatDelta) * 100) / 100;
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
      snapshot.sovereignty.gapVsLegend =
        Math.round((snapshot.sovereignty.gapVsLegend + effect.divergenceDelta) * 1000) /
        1000;
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