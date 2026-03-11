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

export interface OrchestratorStartResult {
  readonly snapshot: RunStateSnapshot;
  readonly policy: ResolvedTimePolicy;
  readonly events: readonly RuntimeEventEnvelope[];
  readonly checkpoints: readonly RuntimeCheckpoint[];
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

const REQUIRED_ENGINES: readonly EngineId[] = Object.freeze([
  'time',
  'pressure',
  'tension',
  'shield',
  'battle',
  'cascade',
  'sovereignty',
] as const);

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

export class EngineOrchestrator {
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

  private snapshot: RunStateSnapshot | null = null;
  private activeStep: TickStep = 'STEP_01_PREPARE';
  private runStartedEmitted = false;

  public constructor(options: EngineOrchestratorOptions = {}) {
    this.registry = options.registry ?? new EngineRegistry();
    this.bus = options.bus ?? new EventBus<EngineEventMap & Record<string, unknown>>();
    this.clock = options.clock ?? new DeterministicClock(0);
    this.windows = options.windows ?? new DecisionWindowService();
    this.overlays = options.overlays ?? new CardOverlayResolver();
    this.invariantGuard = options.invariantGuard ?? new RunStateInvariantGuard();
    this.outcomeResolver = options.outcomeResolver ?? new RuntimeOutcomeResolver();
    this.checkpointStore =
      options.checkpointStore ?? new RuntimeCheckpointStore();
    this.traceRecorder = options.traceRecorder ?? new TickTraceRecorder();
    this.timePolicyResolver = options.timePolicyResolver ?? new TimePolicyResolver();
    this.modeHooksByMode = options.modeHooksByMode ?? {};
    this.enforceCompleteRegistry = options.enforceCompleteRegistry ?? false;
    this.failFastOnInvariantError = options.failFastOnInvariantError ?? true;
  }

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

    const seedPatch = this.timePolicyResolver.resolveFactoryPatch(input);
    const seededInput: RunFactoryInput = {
      ...input,
      seasonBudgetMs: input.seasonBudgetMs ?? seedPatch.seasonBudgetMs,
      currentTickDurationMs:
        input.currentTickDurationMs ?? seedPatch.currentTickDurationMs,
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

    return {
      snapshot: this.requireSnapshot(),
      policy: this.timePolicyResolver.resolveSnapshot(
        this.requireSnapshot(),
        this.clock.now(),
      ),
      events: freezeArray(this.bus.flush() as RuntimeEventEnvelope[]),
      checkpoints: freezeArray([checkpoint]),
    };
  }

  public executeTick(): OrchestratorTickResult {
    if (this.enforceCompleteRegistry) {
      this.registry.assertComplete(REQUIRED_ENGINES);
    }

    const base = this.requireSnapshot();
    const previousPhase = base.phase;
    const previousTier = base.pressure.tier;
    const previousDuration = Math.max(1, base.timers.currentTickDurationMs);

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
    const outcome = this.outcomeResolver.resolve(this.requireSnapshot());
    const events = freezeArray(this.bus.flush() as RuntimeEventEnvelope[]);

    return {
      snapshot: this.requireSnapshot(),
      checksum: this.requireSnapshot().telemetry.lastTickChecksum ?? stableTickChecksum(this.requireSnapshot()),
      outcome,
      events,
      signals: freezeArray(signals),
      traces: freezeArray(traces),
      checkpoints: freezeArray(checkpoints),
      appliedPolicy: this.timePolicyResolver.resolveSnapshot(
        this.requireSnapshot(),
        nowMs,
      ),
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
      };
    }

    const availableTimingClasses = this.windows.getAvailableTimingClasses(
      snapshot,
      this.activeStep,
      {
        actorId: request.actorId,
      },
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
      };
    }

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
      timingClass: freezeArray([chosenTimingClass]),
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
      return {
        accepted: true,
        snapshot: this.requireSnapshot(),
        playedCard: instance,
        chosenTimingClass,
        reasons: freezeArray([]),
      };
    }

    this.snapshot = toFrozenSnapshot(next);
    return {
      accepted: true,
      snapshot: this.requireSnapshot(),
      playedCard: instance,
      chosenTimingClass,
      reasons: freezeArray([]),
    };
  }

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
  }

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
      hooks.beforeStep(toFrozenSnapshot(snapshot), this.createContext(toFrozenSnapshot(snapshot), step, nowMs)),
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
      hooks.afterStep(toFrozenSnapshot(snapshot), this.createContext(toFrozenSnapshot(snapshot), step, nowMs)),
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

  private materializeTelemetry(
    snapshot: MutableRunStateSnapshot,
  ): MutableRunStateSnapshot {
    const next = toMutableSnapshot(snapshot);
    next.telemetry.emittedEventCount = this.bus.historyCount();

    const policy = this.timePolicyResolver.resolveSnapshot(
      toFrozenSnapshot(next),
      this.clock.now(),
    );
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
        engine.engineId,
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
}
