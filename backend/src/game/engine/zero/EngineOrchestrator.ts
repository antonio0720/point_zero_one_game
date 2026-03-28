/*
 * POINT ZERO ONE — BACKEND ENGINE ZERO
 * /backend/src/game/engine/zero/EngineOrchestrator.ts
 *
 * Purpose:
 * - authoritative backend orchestration for the seven-engine simulation stack
 * - preserve repo-native engine contracts, event flow, mode rules, and card legality
 * - deepen runtime diagnostics, tick sealing, lifecycle handling, and terminal proof flow
 *
 * Constraints:
 * - no cross-engine direct calls outside Engine 0 wiring
 * - engines execute only through TickSequence + TickContext
 * - cards are validated backend-side before effect application
 * - mode-native rules remain authoritative and deterministic
 * - terminal outcome, integrity quarantine, and proof finalization remain backend-owned
 */

import { EventBus, type EventEnvelope } from '../core/EventBus';
import { SystemClock } from '../core/ClockSource';
import {
  checksumSnapshot,
  cloneJson,
  createDeterministicId,
  deepFreeze,
  deepFrozenClone,
} from '../core/Deterministic';
import {
  type EngineId,
  type EngineSignal,
  type EngineTickResult,
  type SimulationEngine,
  type TickContext,
  createEngineSignal,
  normalizeEngineTickResult,
} from '../core/EngineContracts';
import { EngineRegistry } from '../core/EngineRegistry';
import type {
  EngineEventMap,
  ModeCode,
  Targeting,
  TimingClass,
} from '../core/GamePrimitives';

type RuntimeEventMap = EngineEventMap & Record<string, unknown>;
import { createInitialRunState } from '../core/RunStateFactory';
import type {
  DecisionRecord,
  OutcomeReasonCode,
  RunStateSnapshot,
  RuntimeDecisionWindowSnapshot,
} from '../core/RunStateSnapshot';
import { RuntimeOutcomeResolver } from '../core/RuntimeOutcomeResolver';
import { TICK_SEQUENCE, type TickStep } from '../core/TickSequence';

import { TimeEngine } from '../time/TimeEngine';
import { PressureEngine } from '../pressure/PressureEngine';
import { TensionEngine } from '../tension/TensionEngine';
import { ShieldEngine } from '../shield/ShieldEngine';
import { BattleEngine } from '../battle/BattleEngine';
import { CascadeEngine } from '../cascade/CascadeEngine';
import { SovereigntyEngine } from '../sovereignty/SovereigntyEngine';

import { CardRegistry } from '../cards/CardRegistry';
import { CardLegalityService } from '../cards/CardLegalityService';
import { CardEffectExecutor } from '../cards/CardEffectExecutor';

import { ModeRuntimeDirector } from '../modes/ModeRuntimeDirector';
import type { ModeActionId, ModeConfigureOptions } from '../modes/ModeContracts';

export type OrchestratorLifecycle =
  | 'IDLE'
  | 'RUN_STARTED'
  | 'IN_TICK'
  | 'TERMINAL_PENDING_FINALIZE'
  | 'FINALIZED';

export interface StartRunInput {
  readonly userId: string;
  readonly mode: ModeCode;
  readonly seed?: string;
  readonly runId?: string;
  readonly communityHeatModifier?: number;
  readonly tags?: readonly string[];
  readonly modeOptions?: ModeConfigureOptions;
  readonly forceProofFinalizeOnTerminal?: boolean;
}

export interface PlayCardInput {
  readonly definitionId: string;
  readonly actorId: string;
  readonly targeting?: Targeting;
}

export interface ModeActionInput {
  readonly actionId: ModeActionId;
  readonly payload?: Readonly<Record<string, unknown>>;
}

export interface TickStepDiagnostics {
  readonly step: TickStep;
  readonly engineId: EngineId | 'mode' | 'system';
  readonly startedAtMs: number;
  readonly endedAtMs: number;
  readonly durationMs: number;
  readonly queueDepthBefore: number;
  readonly queueDepthAfter: number;
  readonly changedSnapshot: boolean;
  readonly snapshotChecksumBefore: string;
  readonly snapshotChecksumAfter: string;
  readonly signals: readonly EngineSignal[];
}

export interface TickExecutionSummary {
  readonly traceId: string;
  readonly runId: string;
  readonly tick: number;
  readonly phase: RunStateSnapshot['phase'];
  readonly startedAtMs: number;
  readonly endedAtMs: number;
  readonly durationMs: number;
  readonly outcome: RunStateSnapshot['outcome'];
  readonly outcomeReasonCode: OutcomeReasonCode | null;
  readonly stepDiagnostics: readonly TickStepDiagnostics[];
  readonly flushedEventCount: number;
  readonly emittedWarnings: readonly string[];
  readonly lastTickChecksum: string | null;
}

export interface EngineOrchestratorOptions {
  readonly clock?: SystemClock;
  readonly bus?: EventBus<RuntimeEventMap>;
  readonly registry?: EngineRegistry;
  readonly modeDirector?: ModeRuntimeDirector;
  readonly cardRegistry?: CardRegistry;
  readonly cardLegality?: CardLegalityService;
  readonly cardExecutor?: CardEffectExecutor;
  readonly outcomeResolver?: RuntimeOutcomeResolver;
  readonly forceProofFinalizeOnTerminal?: boolean;
  readonly maxWarningsBeforeIntegrityQuarantine?: number;
  readonly maxTickHistory?: number;
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

type ResolvedPlayableCard = {
  readonly definitionId: string;
  readonly instanceId: string;
  readonly card: {
    readonly decisionTimerOverrideMs?: number | null;
    readonly id?: string;
  };
  readonly timingClass: readonly string[] | readonly TimingClass[];
};

type FlushEnvelope = EventEnvelope<keyof RuntimeEventMap, RuntimeEventMap[keyof RuntimeEventMap]>;

interface EngineCatalog {
  readonly time: TimeEngine;
  readonly pressure: PressureEngine;
  readonly tension: TensionEngine;
  readonly shield: ShieldEngine;
  readonly battle: BattleEngine;
  readonly cascade: CascadeEngine;
  readonly sovereignty: SovereigntyEngine;
}

const DEFAULT_MAX_TICK_HISTORY = 64;
const DEFAULT_MAX_WARNINGS_BEFORE_INTEGRITY_QUARANTINE = 25;
const DEFAULT_PLAY_TARGETING: Targeting = 'SELF';


function createMutableClone<T>(value: T): Mutable<T> {
  return cloneJson(value) as Mutable<T>;
}

function freezeSnapshot<T>(snapshot: T): T {
  return deepFreeze(snapshot) as T;
}

function isTerminalOutcome(outcome: RunStateSnapshot['outcome']): boolean {
  return outcome !== null;
}

function limitArray<T>(items: readonly T[], max: number): readonly T[] {
  if (max <= 0) {
    return Object.freeze([]) as readonly T[];
  }
  if (items.length <= max) {
    return Object.freeze([...items]) as readonly T[];
  }
  return Object.freeze(items.slice(items.length - max)) as readonly T[];
}

function coerceTimingClassList(value: readonly string[] | readonly TimingClass[] | undefined): readonly string[] {
  return Object.freeze([...(value ?? [])]);
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeDecisionLatency(
  snapshot: RunStateSnapshot,
  card: ResolvedPlayableCard,
): number {
  const timerOverride = card.card.decisionTimerOverrideMs;
  if (typeof timerOverride === 'number' && Number.isFinite(timerOverride) && timerOverride >= 0) {
    return timerOverride;
  }
  return snapshot.timers.currentTickDurationMs;
}

type TerminalRunOutcome = NonNullable<RunStateSnapshot['outcome']>;


export class EngineOrchestrator {
  private readonly clock: SystemClock;
  private readonly bus: EventBus<RuntimeEventMap>;
  private readonly registry: EngineRegistry;
  private readonly modeDirector: ModeRuntimeDirector;
  private readonly cardRegistry: CardRegistry;
  private readonly cardLegality: CardLegalityService;
  private readonly cardExecutor: CardEffectExecutor;
  private readonly outcomeResolver: RuntimeOutcomeResolver;
  private readonly engines: EngineCatalog;

  private readonly forceProofFinalizeOnTerminalByDefault: boolean;
  private readonly maxWarningsBeforeIntegrityQuarantine: number;
  private readonly maxTickHistory: number;

  private current: RunStateSnapshot | null = null;
  private lifecycle: OrchestratorLifecycle = 'IDLE';
  private forceProofFinalizeOnTerminalForCurrentRun: boolean;
  private lastFlushedEvents: readonly FlushEnvelope[] = Object.freeze([]);
  private tickHistory: readonly TickExecutionSummary[] = Object.freeze([]);
  private currentTraceId: string | null = null;

  public constructor(options: EngineOrchestratorOptions = {}) {
    this.clock = options.clock ?? new SystemClock();
    this.bus = options.bus ?? new EventBus<RuntimeEventMap>();
    this.registry = options.registry ?? new EngineRegistry();
    this.modeDirector = options.modeDirector ?? new ModeRuntimeDirector();
    this.cardRegistry = options.cardRegistry ?? new CardRegistry();
    this.cardLegality = options.cardLegality ?? new CardLegalityService(this.cardRegistry);
    this.cardExecutor = options.cardExecutor ?? new CardEffectExecutor();
    this.outcomeResolver = options.outcomeResolver ?? new RuntimeOutcomeResolver();

    this.forceProofFinalizeOnTerminalByDefault =
      options.forceProofFinalizeOnTerminal ?? true;
    this.forceProofFinalizeOnTerminalForCurrentRun =
      this.forceProofFinalizeOnTerminalByDefault;
    this.maxWarningsBeforeIntegrityQuarantine =
      options.maxWarningsBeforeIntegrityQuarantine ??
      DEFAULT_MAX_WARNINGS_BEFORE_INTEGRITY_QUARANTINE;
    this.maxTickHistory = options.maxTickHistory ?? DEFAULT_MAX_TICK_HISTORY;

    this.engines = {
      time: new TimeEngine(),
      pressure: new PressureEngine(),
      tension: new TensionEngine(),
      shield: new ShieldEngine(),
      battle: new BattleEngine(),
      cascade: new CascadeEngine(),
      sovereignty: new SovereigntyEngine(),
    };

    this.registerEngines();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Public lifecycle surface
  // ─────────────────────────────────────────────────────────────────────────────

  public startRun(input: StartRunInput): RunStateSnapshot {
    this.assertCanStartRun();

    const nowMs = this.clock.now();
    const normalized = this.normalizeStartInput(input, nowMs);

    this.forceProofFinalizeOnTerminalForCurrentRun =
      normalized.forceProofFinalizeOnTerminal;
    this.resetRuntimeSurfacesForNewRun();

    let snapshot = createInitialRunState({
      runId: normalized.runId,
      userId: normalized.userId,
      seed: normalized.seed,
      mode: normalized.mode,
      communityHeatModifier: normalized.communityHeatModifier,
    });

    snapshot = this.applyStartTags(snapshot, normalized.tags);
    snapshot = this.applyStartPresentationMetadata(snapshot, normalized);
    snapshot = this.modeDirector.configure(snapshot, normalized.modeOptions);
    snapshot = this.applyRunStartedTelemetry(snapshot, nowMs);

    this.bus.emit(
      'run.started',
      {
        runId: snapshot.runId,
        mode: snapshot.mode,
        seed: snapshot.seed,
      },
      {
        emittedAtTick: snapshot.tick,
        tags: ['run', 'start', `mode:${snapshot.mode}`],
      },
    );

    this.current = deepFrozenClone(snapshot);
    this.lifecycle = 'RUN_STARTED';

    return this.current;
  }

  public getSnapshot(): RunStateSnapshot {
    this.assertActiveRun();
    return this.current as RunStateSnapshot;
  }

  public getLifecycle(): OrchestratorLifecycle {
    return this.lifecycle;
  }

  public getLastFlush(): readonly FlushEnvelope[] {
    return this.lastFlushedEvents;
  }

  public getTickHistory(): readonly TickExecutionSummary[] {
    return this.tickHistory;
  }

  public getCurrentTraceId(): string | null {
    return this.currentTraceId;
  }

  public getQueuedEventCount(): number {
    return this.bus.queuedCount();
  }

  public getEventHistory(limit?: number): readonly FlushEnvelope[] {
    return this.bus.getHistory(limit) as readonly FlushEnvelope[];
  }

  public getCurrentRunId(): string | null {
    return this.current?.runId ?? null;
  }

  public getCurrentUserId(): string | null {
    return this.current?.userId ?? null;
  }

  public getCurrentMode(): ModeCode | null {
    return this.current?.mode ?? null;
  }

  public getCurrentSeed(): string | null {
    return this.current?.seed ?? null;
  }

  public isRunActive(): boolean {
    return this.current !== null && this.current.outcome === null;
  }

  public canStartRun(): boolean {
    return this.lifecycle === 'IDLE' && this.current === null;
  }

  public canEndRun(): boolean {
    return this.current !== null && this.lifecycle !== 'FINALIZED';
  }

  public endRun(outcome?: TerminalRunOutcome): RunStateSnapshot | null {
    if (this.current === null) {
      return null;
    }

    const resolvedOutcome = outcome ?? this.current.outcome;
    if (resolvedOutcome === null) {
      throw new Error('endRun() requires a terminal outcome when the current run is still active.');
    }

    this.lifecycle = 'TERMINAL_PENDING_FINALIZE';

    let next = this.current;
    if (next.outcome !== resolvedOutcome) {
      next = this.applyTerminalOutcome(next, resolvedOutcome);
    }

    next = this.finalizeTerminalSnapshotIfNeeded(
      next,
      this.forceProofFinalizeOnTerminalForCurrentRun,
    );

    this.current = deepFrozenClone(next);
    this.currentTraceId = null;
    this.lifecycle = 'FINALIZED';

    return this.current;
  }

  public playCard(
    definitionIdOrInput: string | PlayCardInput,
    actorIdArg?: string,
    targetingArg: Targeting = DEFAULT_PLAY_TARGETING,
  ): RunStateSnapshot {
    const input = this.normalizePlayInput(definitionIdOrInput, actorIdArg, targetingArg);
    const current = this.getSnapshot();

    if (isTerminalOutcome(current.outcome)) {
      return current;
    }

    const resolved = this.cardLegality.mustResolve(
      current,
      input.definitionId,
      input.targeting,
    ) as ResolvedPlayableCard;

    let next = this.cardExecutor.apply(
      current,
      resolved as unknown as Parameters<CardEffectExecutor['apply']>[1],
      input.actorId,
    ) as RunStateSnapshot;

    next = this.consumePlayedCard(next, resolved);
    next = this.recordDecisionForPlayedCard(next, resolved, input.actorId);
    next = this.closeDecisionWindowsForPlayedCard(next, resolved, input.actorId);
    next = this.reconcileSnapshotBoundaries(next, 'card.played');

    this.bus.emit(
      'card.played',
      {
        runId: next.runId,
        actorId: input.actorId,
        cardId: resolved.definitionId,
        tick: next.tick,
        mode: next.mode,
      },
      {
        emittedAtTick: next.tick,
        tags: ['card', 'play', `mode:${next.mode}`],
      },
    );

    this.current = deepFrozenClone(next);
    return this.current;
  }

  public dispatchModeAction(input: ModeActionInput): RunStateSnapshot {
    const current = this.getSnapshot();

    if (isTerminalOutcome(current.outcome)) {
      return current;
    }

    let next = this.modeDirector.resolveAction(current, input.actionId, input.payload);
    next = this.reconcileSnapshotBoundaries(next, `mode.action:${input.actionId}`);

    this.current = deepFrozenClone(next);
    return this.current;
  }

  public advanceTick(): RunStateSnapshot {
    const current = this.getSnapshot();

    if (isTerminalOutcome(current.outcome)) {
      this.lifecycle = 'TERMINAL_PENDING_FINALIZE';
      const finalized = this.finalizeTerminalSnapshotIfNeeded(
        current,
        this.forceProofFinalizeOnTerminalForCurrentRun,
      );
      this.current = deepFrozenClone(finalized);
      this.currentTraceId = null;
      this.lifecycle = 'FINALIZED';
      return this.current;
    }

    const tickStartMs = this.clock.now();
    const nextTickNumber = current.tick + 1;
    const traceId = createDeterministicId(current.runId, 'tick-trace', nextTickNumber, tickStartMs);

    this.currentTraceId = traceId;
    this.lifecycle = 'IN_TICK';

    this.bus.emit(
      'tick.started',
      {
        runId: current.runId,
        tick: nextTickNumber,
        phase: current.phase,
      },
      {
        emittedAtTick: nextTickNumber,
        tags: ['tick', 'start', `phase:${current.phase}`],
      },
    );

    let snapshot = this.modeDirector.onTickStart(current);
    snapshot = this.reconcileSnapshotBoundaries(snapshot, 'mode.onTickStart');

    const stepDiagnostics: TickStepDiagnostics[] = [];
    const warningsBeforeTick = snapshot.telemetry.warnings.length;

    for (const step of TICK_SEQUENCE) {
      const stepResult = this.executeTickStep(snapshot, step, tickStartMs, traceId);
      snapshot = stepResult.snapshot;
      stepDiagnostics.push(stepResult.diagnostics);
    }

    snapshot = this.modeDirector.onTickEnd(snapshot);
    snapshot = this.reconcileSnapshotBoundaries(snapshot, 'mode.onTickEnd');

    const flushed = this.flushAndProjectTelemetry(snapshot);
    snapshot = flushed.snapshot;
    this.lastFlushedEvents = flushed.flushedEvents;

    const finalized = this.finalizeTerminalSnapshotIfNeeded(
      snapshot,
      this.forceProofFinalizeOnTerminalForCurrentRun,
    );

    const tickEndedAtMs = this.clock.now();
    const summary = this.createTickExecutionSummary(
      finalized,
      traceId,
      tickStartMs,
      tickEndedAtMs,
      stepDiagnostics,
      warningsBeforeTick,
      this.lastFlushedEvents.length,
    );

    this.pushTickHistory(summary);
    this.current = deepFrozenClone(finalized);
    this.lifecycle = isTerminalOutcome(this.current.outcome)
      ? 'FINALIZED'
      : 'RUN_STARTED';
    this.currentTraceId = null;

    return this.current;
  }

  public tick(count = 1): RunStateSnapshot {
    let snapshot = this.getSnapshot();

    for (let index = 0; index < count; index += 1) {
      snapshot = this.advanceTick();
      if (isTerminalOutcome(snapshot.outcome)) {
        return snapshot;
      }
    }

    return snapshot;
  }

  public runUntilDone(maxTicks = 500): RunStateSnapshot {
    let snapshot = this.getSnapshot();

    for (let index = 0; index < maxTicks; index += 1) {
      snapshot = this.advanceTick();
      if (isTerminalOutcome(snapshot.outcome)) {
        return snapshot;
      }
    }

    return snapshot;
  }

  public reset(): void {
    this.registry.reset();
    this.bus.clear({
      clearQueue: true,
      clearHistory: true,
      clearListeners: false,
      clearAnyListeners: false,
    });
    this.current = null;
    this.lifecycle = 'IDLE';
    this.forceProofFinalizeOnTerminalForCurrentRun =
      this.forceProofFinalizeOnTerminalByDefault;
    this.lastFlushedEvents = Object.freeze([]);
    this.tickHistory = Object.freeze([]);
    this.currentTraceId = null;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Engine registration
  // ─────────────────────────────────────────────────────────────────────────────

  private registerEngines(): void {
    this.registry.register(this.engines.time);
    this.registry.register(this.engines.pressure);
    this.registry.register(this.engines.tension);
    this.registry.register(this.engines.shield);
    this.registry.register(this.engines.battle);
    this.registry.register(this.engines.cascade);
    this.registry.register(this.engines.sovereignty);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Input normalization
  // ─────────────────────────────────────────────────────────────────────────────

  private normalizeStartInput(
    input: StartRunInput,
    nowMs: number,
  ): Required<
    Pick<StartRunInput, 'userId' | 'mode' | 'communityHeatModifier' | 'modeOptions'>
  > & {
    readonly seed: string;
    readonly runId: string;
    readonly tags: readonly string[];
    readonly forceProofFinalizeOnTerminal: boolean;
  } {
    const seed =
      input.seed ??
      createDeterministicId(input.userId, input.mode, 'seed', nowMs);

    const runId =
      input.runId ??
      createDeterministicId(seed, 'run');

    return {
      userId: input.userId,
      mode: input.mode,
      communityHeatModifier: input.communityHeatModifier ?? 0,
      modeOptions: input.modeOptions ?? {},
      seed,
      runId,
      tags: Object.freeze([...(input.tags ?? [])]),
      forceProofFinalizeOnTerminal:
        input.forceProofFinalizeOnTerminal ??
        this.forceProofFinalizeOnTerminalByDefault,
    };
  }

  private normalizePlayInput(
    definitionIdOrInput: string | PlayCardInput,
    actorIdArg?: string,
    targetingArg: Targeting = DEFAULT_PLAY_TARGETING,
  ): Required<PlayCardInput> {
    if (typeof definitionIdOrInput === 'string') {
      if (!actorIdArg) {
        throw new Error('actorId is required when playCard() is called with a definitionId string.');
      }

      return {
        definitionId: definitionIdOrInput,
        actorId: actorIdArg,
        targeting: targetingArg,
      };
    }

    return {
      definitionId: definitionIdOrInput.definitionId,
      actorId: definitionIdOrInput.actorId,
      targeting: definitionIdOrInput.targeting ?? DEFAULT_PLAY_TARGETING,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Start-run projections
  // ─────────────────────────────────────────────────────────────────────────────

  private applyStartTags(
    snapshot: RunStateSnapshot,
    tags: readonly string[],
  ): RunStateSnapshot {
    if (tags.length === 0) {
      return snapshot;
    }

    const next = createMutableClone(snapshot);
    (next as { tags: readonly string[] }).tags = Object.freeze([
      ...new Set([...snapshot.tags, ...tags]),
    ]);

    return freezeSnapshot(next);
  }

  private applyStartPresentationMetadata(
    snapshot: RunStateSnapshot,
    normalized: ReturnType<EngineOrchestrator['normalizeStartInput']>,
  ): RunStateSnapshot {
    const next = createMutableClone(snapshot);

    const nextModeState = createMutableClone(snapshot.modeState);
    nextModeState.communityHeatModifier = normalized.communityHeatModifier;

    next.modeState = freezeSnapshot(nextModeState) as RunStateSnapshot['modeState'];

    return freezeSnapshot(next);
  }

  private applyRunStartedTelemetry(
    snapshot: RunStateSnapshot,
    nowMs: number,
  ): RunStateSnapshot {
    const next = createMutableClone(snapshot);
    const nextTelemetry = createMutableClone(snapshot.telemetry);

    nextTelemetry.outcomeReason = null;
    nextTelemetry.outcomeReasonCode = null;
    nextTelemetry.lastTickChecksum = null;
    nextTelemetry.warnings = Object.freeze([
      ...snapshot.telemetry.warnings,
    ]);

    next.telemetry = freezeSnapshot(nextTelemetry) as RunStateSnapshot['telemetry'];

    const nextTags = [...next.tags];
    nextTags.push(`runtime:start:${nowMs}`);
    next.tags = Object.freeze(nextTags);

    return freezeSnapshot(next);
  }

  private resetRuntimeSurfacesForNewRun(): void {
    this.registry.reset();
    this.bus.clear({
      clearQueue: true,
      clearHistory: true,
      clearListeners: false,
      clearAnyListeners: false,
    });
    this.lastFlushedEvents = Object.freeze([]);
    this.tickHistory = Object.freeze([]);
    this.currentTraceId = null;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Tick-step execution
  // ─────────────────────────────────────────────────────────────────────────────

  private executeTickStep(
    snapshot: RunStateSnapshot,
    step: TickStep,
    tickStartMs: number,
    traceId: string,
  ): {
    readonly snapshot: RunStateSnapshot;
    readonly diagnostics: TickStepDiagnostics;
  } {
    const stepStartedAtMs = this.clock.now();
    const queueDepthBefore = this.bus.queuedCount();
    const checksumBefore = this.createTickChecksum(snapshot);
    const baselineTick = snapshot.tick;

    let nextSnapshot = snapshot;
    let stepSignals: readonly EngineSignal[] = Object.freeze([]);
    let engineId: EngineId | 'mode' | 'system' = 'system';

    try {
      switch (step) {
        case 'STEP_02_TIME': {
          engineId = 'time';
          const result = this.runEngine(this.engines.time, snapshot, step, tickStartMs, traceId);
          nextSnapshot = result.snapshot;
          stepSignals = result.signals;
          break;
        }

        case 'STEP_03_PRESSURE': {
          engineId = 'pressure';
          const result = this.runEngine(this.engines.pressure, snapshot, step, tickStartMs, traceId);
          nextSnapshot = result.snapshot;
          stepSignals = result.signals;
          break;
        }

        case 'STEP_04_TENSION': {
          engineId = 'tension';
          const result = this.runEngine(this.engines.tension, snapshot, step, tickStartMs, traceId);
          nextSnapshot = result.snapshot;
          stepSignals = result.signals;
          break;
        }

        case 'STEP_05_BATTLE': {
          engineId = 'battle';
          const result = this.runEngine(this.engines.battle, snapshot, step, tickStartMs, traceId);
          nextSnapshot = result.snapshot;
          stepSignals = result.signals;
          break;
        }

        case 'STEP_06_SHIELD': {
          engineId = 'shield';
          const result = this.runEngine(this.engines.shield, snapshot, step, tickStartMs, traceId);
          nextSnapshot = result.snapshot;
          stepSignals = result.signals;
          break;
        }

        case 'STEP_07_CASCADE': {
          engineId = 'cascade';
          const result = this.runEngine(this.engines.cascade, snapshot, step, tickStartMs, traceId);
          nextSnapshot = result.snapshot;
          stepSignals = result.signals;
          break;
        }

        case 'STEP_10_SOVEREIGNTY_SNAPSHOT': {
          engineId = 'sovereignty';
          const result = this.runEngine(this.engines.sovereignty, snapshot, step, tickStartMs, traceId);
          nextSnapshot = result.snapshot;
          stepSignals = result.signals;
          break;
        }

        case 'STEP_11_OUTCOME_GATE': {
          engineId = 'system';
          nextSnapshot = this.resolveOutcome(nextSnapshot);
          stepSignals = this.createOutcomeSignals(snapshot, nextSnapshot);
          break;
        }

        case 'STEP_12_EVENT_SEAL': {
          engineId = 'system';
          nextSnapshot = this.applyTickSeal(nextSnapshot);
          stepSignals = Object.freeze([
            createEngineSignal(
              'mode',
              'INFO',
              'STEP_12_EVENT_SEAL_OK',
              'tick seal applied',
              nextSnapshot.tick,
              ['seal'],
            ),
          ]);
          break;
        }

        case 'STEP_13_FLUSH': {
          engineId = 'system';
          nextSnapshot = this.projectPendingEventCount(nextSnapshot);
          stepSignals = Object.freeze([
            createEngineSignal(
              'mode',
              'INFO',
              'STEP_13_FLUSH_PREPARED',
              'flush projection applied',
              nextSnapshot.tick,
              ['flush'],
            ),
          ]);
          break;
        }

        default: {
          engineId = 'system';
          nextSnapshot = this.reconcileSnapshotBoundaries(
            nextSnapshot,
            `pass-through:${step}`,
          );
          stepSignals = Object.freeze([
            createEngineSignal(
              'mode',
              'INFO',
              'STEP_PASSTHROUGH',
              `${step} preserved without extra orchestration mutation`,
              nextSnapshot.tick,
              ['step', 'passthrough'],
            ),
          ]);
          break;
        }
      }
    } catch (error) {
      const handled = this.handleStepError(snapshot, step, engineId, error);
      nextSnapshot = handled.snapshot;
      stepSignals = handled.signals;
    }

    nextSnapshot = this.reconcileSnapshotBoundaries(nextSnapshot, `post:${step}`);

    const stepEndedAtMs = this.clock.now();
    const queueDepthAfter = this.bus.queuedCount();
    const checksumAfter = this.createTickChecksum(nextSnapshot);

    return {
      snapshot: nextSnapshot,
      diagnostics: {
        step,
        engineId,
        startedAtMs: stepStartedAtMs,
        endedAtMs: stepEndedAtMs,
        durationMs: stepEndedAtMs - stepStartedAtMs,
        queueDepthBefore,
        queueDepthAfter,
        changedSnapshot:
          checksumBefore !== checksumAfter ||
          baselineTick !== nextSnapshot.tick,
        snapshotChecksumBefore: checksumBefore,
        snapshotChecksumAfter: checksumAfter,
        signals: stepSignals,
      },
    };
  }

  private runEngine(
    engine: SimulationEngine,
    snapshot: RunStateSnapshot,
    step: TickStep,
    tickStartMs: number,
    traceId: string,
  ): EngineTickResult {
    const context = this.createTickContext(snapshot, step, tickStartMs, traceId);

    if (engine.canRun && !engine.canRun(snapshot, context)) {
      return {
        snapshot,
        signals: Object.freeze([
          createEngineSignal(
            engine.engineId,
            'INFO',
            'ENGINE_SKIPPED',
            `${engine.engineId} skipped ${step}`,
            snapshot.tick,
            ['skip', step],
          ),
        ]),
      };
    }

    const result = engine.tick(snapshot, context);
    const normalized = normalizeEngineTickResult(engine.engineId, snapshot.tick, result);

    return {
      snapshot: normalized.snapshot,
      signals: this.normalizeSignals(normalized.signals, engine.engineId, snapshot.tick),
    };
  }

  private createTickContext(
    snapshot: RunStateSnapshot,
    step: TickStep,
    tickStartMs: number,
    traceId: string,
  ): TickContext {
    return {
      step,
      nowMs: tickStartMs,
      clock: this.clock,
      bus: this.bus,
      trace: {
        runId: snapshot.runId,
        tick: snapshot.tick + (step === 'STEP_02_TIME' ? 1 : 0),
        step,
        mode: snapshot.mode,
        phase: snapshot.phase,
        traceId,
      },
    };
  }

  private normalizeSignals(
    signals: readonly EngineSignal[] | undefined,
    engineId: EngineId,
    tick: number,
  ): readonly EngineSignal[] {
    if (signals && signals.length > 0) {
      return Object.freeze([...signals]);
    }

    return Object.freeze([
      createEngineSignal(
        engineId,
        'INFO',
        'ENGINE_OK',
        `${engineId} completed`,
        tick,
        ['engine'],
      ),
    ]);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Outcome resolution and tick sealing
  // ─────────────────────────────────────────────────────────────────────────────

  private resolveOutcome(snapshot: RunStateSnapshot): RunStateSnapshot {
    const resolved = this.outcomeResolver.apply(snapshot);
    return this.reconcileSnapshotBoundaries(resolved, 'runtime.outcome');
  }

  private createOutcomeSignals(
    before: RunStateSnapshot,
    after: RunStateSnapshot,
  ): readonly EngineSignal[] {
    if (before.outcome === after.outcome) {
      return Object.freeze([
        createEngineSignal(
          'mode',
          'INFO',
          'OUTCOME_GATE_NO_CHANGE',
          'outcome gate left run open',
          after.tick,
          ['outcome'],
        ),
      ]);
    }

    return Object.freeze([
      createEngineSignal(
        'mode',
        'WARN',
        'OUTCOME_GATE_CHANGED',
        `outcome set to ${String(after.outcome)}`,
        after.tick,
        ['outcome', `reason:${String(after.telemetry.outcomeReasonCode ?? 'none')}`],
      ),
    ]);
  }

  private applyTickSeal(snapshot: RunStateSnapshot): RunStateSnapshot {
    const checksum = this.createTickChecksum(snapshot);
    const next = createMutableClone(snapshot);

    const nextSovereignty = createMutableClone(snapshot.sovereignty);
    nextSovereignty.tickChecksums = Object.freeze([
      ...snapshot.sovereignty.tickChecksums,
      checksum,
    ]);

    const nextTelemetry = createMutableClone(snapshot.telemetry);
    nextTelemetry.lastTickChecksum = checksum;

    next.sovereignty = freezeSnapshot(nextSovereignty) as RunStateSnapshot['sovereignty'];
    next.telemetry = freezeSnapshot(nextTelemetry) as RunStateSnapshot['telemetry'];

    this.bus.emit(
      'tick.completed',
      {
        runId: snapshot.runId,
        tick: snapshot.tick,
        phase: snapshot.phase,
        checksum,
      },
      {
        emittedAtTick: snapshot.tick,
        tags: ['tick', 'complete', `phase:${snapshot.phase}`],
      },
    );

    return freezeSnapshot(next);
  }

  private projectPendingEventCount(snapshot: RunStateSnapshot): RunStateSnapshot {
    return snapshot;
  }

  private applyTerminalOutcome(
    snapshot: RunStateSnapshot,
    outcome: TerminalRunOutcome,
  ): RunStateSnapshot {
    const next = createMutableClone(snapshot);
    const nextTelemetry = createMutableClone(snapshot.telemetry);

    next.outcome = outcome;
    nextTelemetry.outcomeReason =
      nextTelemetry.outcomeReason ?? 'orchestrator.endRun';
    nextTelemetry.outcomeReasonCode =
      nextTelemetry.outcomeReasonCode ?? ('MANUAL_TERMINATION' as OutcomeReasonCode);
    nextTelemetry.warnings = limitArray(
      [...snapshot.telemetry.warnings, `RUN_ENDED:${String(outcome)}`],
      this.maxWarningsBeforeIntegrityQuarantine * 2,
    );

    next.telemetry = freezeSnapshot(nextTelemetry) as RunStateSnapshot['telemetry'];
    next.tags = Object.freeze([
      ...new Set([...snapshot.tags, `runtime:end:${String(outcome)}`]),
    ]);

    return freezeSnapshot(next);
  }

  private flushAndProjectTelemetry(
    snapshot: RunStateSnapshot,
  ): {
    readonly snapshot: RunStateSnapshot;
    readonly flushedEvents: readonly FlushEnvelope[];
  } {
    const flushedEvents = this.bus.flush() as readonly FlushEnvelope[];

    if (flushedEvents.length === 0) {
      return {
        snapshot,
        flushedEvents,
      };
    }

    const next = createMutableClone(snapshot);
    const nextTelemetry = createMutableClone(snapshot.telemetry);

    nextTelemetry.emittedEventCount = snapshot.telemetry.emittedEventCount + flushedEvents.length;
    next.telemetry = freezeSnapshot(nextTelemetry) as RunStateSnapshot['telemetry'];

    return {
      snapshot: freezeSnapshot(next),
      flushedEvents: Object.freeze([...flushedEvents]),
    };
  }

  private finalizeTerminalSnapshotIfNeeded(
    snapshot: RunStateSnapshot,
    forceProofFinalizeOnTerminal: boolean,
  ): RunStateSnapshot {
    if (!isTerminalOutcome(snapshot.outcome)) {
      return snapshot;
    }

    let next = snapshot;

    if (forceProofFinalizeOnTerminal) {
      next = this.modeDirector.finalize(next);
      next = this.reconcileSnapshotBoundaries(next, 'mode.finalize');
    }

    if (next.sovereignty.proofHash === null) {
      next = this.engines.sovereignty.finalizeRun(
        next,
        this.bus,
        this.clock.now(),
      ) as RunStateSnapshot;
      next = this.reconcileSnapshotBoundaries(next, 'sovereignty.finalizeRun');

      const proofFlush = this.bus.flush() as readonly FlushEnvelope[];
      if (proofFlush.length > 0) {
        this.lastFlushedEvents = Object.freeze([
          ...this.lastFlushedEvents,
          ...proofFlush,
        ]);

        const nextClone = createMutableClone(next);
        const nextTelemetry = createMutableClone(next.telemetry);
        nextTelemetry.emittedEventCount =
          next.telemetry.emittedEventCount + proofFlush.length;
        nextClone.telemetry = freezeSnapshot(nextTelemetry) as RunStateSnapshot['telemetry'];
        next = freezeSnapshot(nextClone);
      }
    }

    return next;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Card-play reconciliation
  // ─────────────────────────────────────────────────────────────────────────────

  private consumePlayedCard(
    snapshot: RunStateSnapshot,
    card: ResolvedPlayableCard,
  ): RunStateSnapshot {
    const next = createMutableClone(snapshot);
    const nextCards = createMutableClone(snapshot.cards);

    nextCards.lastPlayed = Object.freeze([
      card.definitionId,
      ...snapshot.cards.lastPlayed,
    ].slice(0, 3));

    nextCards.discard = Object.freeze([
      ...snapshot.cards.discard,
      card.definitionId,
    ]);

    nextCards.hand = Object.freeze(
      snapshot.cards.hand.filter((entry) => entry.instanceId !== card.instanceId),
    );

    next.cards = freezeSnapshot(nextCards) as RunStateSnapshot['cards'];

    return freezeSnapshot(next);
  }

  private recordDecisionForPlayedCard(
    snapshot: RunStateSnapshot,
    card: ResolvedPlayableCard,
    actorId: string,
  ): RunStateSnapshot {
    const next = createMutableClone(snapshot);
    const nextTelemetry = createMutableClone(snapshot.telemetry);

    const decision: DecisionRecord = {
      tick: snapshot.tick,
      actorId,
      cardId: card.definitionId,
      latencyMs: normalizeDecisionLatency(snapshot, card),
      timingClass: coerceTimingClassList(card.timingClass),
      accepted: true,
    };

    nextTelemetry.decisions = Object.freeze([
      ...snapshot.telemetry.decisions,
      decision,
    ]);

    next.telemetry = freezeSnapshot(nextTelemetry) as RunStateSnapshot['telemetry'];

    return freezeSnapshot(next);
  }

  private closeDecisionWindowsForPlayedCard(
    snapshot: RunStateSnapshot,
    card: ResolvedPlayableCard,
    actorId: string,
  ): RunStateSnapshot {
    const windows = snapshot.timers.activeDecisionWindows;
    const entries = Object.entries(windows);

    if (entries.length === 0) {
      return snapshot;
    }

    const closedWindowIds = entries
      .filter(([, window]) => this.windowMatchesCard(window, card))
      .map(([windowId]) => windowId);

    if (closedWindowIds.length === 0) {
      return snapshot;
    }

    const next = createMutableClone(snapshot);
    const nextTimers = createMutableClone(snapshot.timers);
    const nextWindowMap: Record<string, RuntimeDecisionWindowSnapshot> = {};

    for (const [windowId, window] of entries) {
      if (closedWindowIds.includes(windowId)) {
        this.bus.emit(
          'decision.window.closed',
          {
            windowId,
            tick: snapshot.tick,
            accepted: true,
            actorId,
          },
          {
            emittedAtTick: snapshot.tick,
            tags: ['decision-window', 'closed', 'accepted'],
          },
        );
        continue;
      }

      nextWindowMap[windowId] = window;
    }

    nextTimers.activeDecisionWindows = freezeSnapshot(nextWindowMap) as RunStateSnapshot['timers']['activeDecisionWindows'];
    nextTimers.frozenWindowIds = Object.freeze(
      snapshot.timers.frozenWindowIds.filter((windowId) => !closedWindowIds.includes(windowId)),
    );

    next.timers = freezeSnapshot(nextTimers) as RunStateSnapshot['timers'];

    return freezeSnapshot(next);
  }

  private windowMatchesCard(
    window: RuntimeDecisionWindowSnapshot,
    card: ResolvedPlayableCard,
  ): boolean {
    if (window.cardInstanceId && window.cardInstanceId === card.instanceId) {
      return true;
    }

    if (window.metadata && isObjectRecord(window.metadata)) {
      const definitionId = window.metadata['definitionId'];
      if (typeof definitionId === 'string' && definitionId === card.definitionId) {
        return true;
      }
    }

    return false;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Error handling
  // ─────────────────────────────────────────────────────────────────────────────

  private handleStepError(
    snapshot: RunStateSnapshot,
    step: TickStep,
    engineId: EngineId | 'mode' | 'system',
    error: unknown,
  ): {
    readonly snapshot: RunStateSnapshot;
    readonly signals: readonly EngineSignal[];
  } {
    const message = error instanceof Error ? error.message : String(error);

    let next = this.appendWarning(
      snapshot,
      `[${step}] ${engineId}: ${message}`,
    );

    const signalOwner = engineId === 'system' ? 'mode' : engineId;

    const signals = Object.freeze([
      createEngineSignal(
        signalOwner,
        'ERROR',
        'TICK_STEP_ERROR',
        message,
        snapshot.tick,
        ['error', `step:${step}`],
      ),
    ]);

    if (next.telemetry.warnings.length >= this.maxWarningsBeforeIntegrityQuarantine) {
      next = this.applyIntegrityQuarantine(
        next,
        `warning threshold exceeded at ${step}`,
      );
    }

    return {
      snapshot: next,
      signals,
    };
  }

  private appendWarning(
    snapshot: RunStateSnapshot,
    warning: string,
  ): RunStateSnapshot {
    const next = createMutableClone(snapshot);
    const nextTelemetry = createMutableClone(snapshot.telemetry);

    nextTelemetry.warnings = limitArray(
      [...snapshot.telemetry.warnings, warning],
      this.maxWarningsBeforeIntegrityQuarantine * 2,
    );

    next.telemetry = freezeSnapshot(nextTelemetry) as RunStateSnapshot['telemetry'];
    return freezeSnapshot(next);
  }

  private applyIntegrityQuarantine(
    snapshot: RunStateSnapshot,
    reason: string,
  ): RunStateSnapshot {
    const next = createMutableClone(snapshot);

    const nextSovereignty = createMutableClone(snapshot.sovereignty);
    nextSovereignty.integrityStatus = 'QUARANTINED';
    nextSovereignty.auditFlags = Object.freeze([
      ...snapshot.sovereignty.auditFlags,
      'integrity.quarantined',
      reason,
    ]);

    const nextTelemetry = createMutableClone(snapshot.telemetry);
    nextTelemetry.outcomeReason = 'integrity.quarantined';
    nextTelemetry.outcomeReasonCode = 'INTEGRITY_QUARANTINE';

    next.sovereignty = freezeSnapshot(nextSovereignty) as RunStateSnapshot['sovereignty'];
    next.telemetry = freezeSnapshot(nextTelemetry) as RunStateSnapshot['telemetry'];

    this.bus.emit(
      'integrity.quarantined',
      {
        runId: snapshot.runId,
        tick: snapshot.tick,
        reasons: [reason],
      },
      {
        emittedAtTick: snapshot.tick,
        tags: ['integrity', 'quarantine'],
      },
    );

    return freezeSnapshot(next);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Snapshot boundary normalization
  // ─────────────────────────────────────────────────────────────────────────────

  private reconcileSnapshotBoundaries(
    snapshot: RunStateSnapshot,
    _origin: string,
  ): RunStateSnapshot {
    const next = createMutableClone(snapshot);

    next.tags = Object.freeze([...new Set(snapshot.tags)]);

    const nextTelemetry = createMutableClone(snapshot.telemetry);
    nextTelemetry.decisions = Object.freeze([...snapshot.telemetry.decisions]);
    nextTelemetry.forkHints = Object.freeze([...snapshot.telemetry.forkHints]);
    nextTelemetry.warnings = Object.freeze([...snapshot.telemetry.warnings]);
    next.telemetry = freezeSnapshot(nextTelemetry) as RunStateSnapshot['telemetry'];

    const nextCards = createMutableClone(snapshot.cards);
    nextCards.hand = Object.freeze([...snapshot.cards.hand]);
    nextCards.discard = Object.freeze([...snapshot.cards.discard]);
    nextCards.exhaust = Object.freeze([...snapshot.cards.exhaust]);
    nextCards.drawHistory = Object.freeze([...snapshot.cards.drawHistory]);
    nextCards.lastPlayed = Object.freeze([...snapshot.cards.lastPlayed]);
    nextCards.ghostMarkers = Object.freeze([...snapshot.cards.ghostMarkers]);
    next.cards = freezeSnapshot(nextCards) as RunStateSnapshot['cards'];

    const nextBattle = createMutableClone(snapshot.battle);
    nextBattle.bots = Object.freeze([...snapshot.battle.bots]);
    nextBattle.pendingAttacks = Object.freeze([...snapshot.battle.pendingAttacks]);
    nextBattle.neutralizedBotIds = Object.freeze([...snapshot.battle.neutralizedBotIds]);
    next.battle = freezeSnapshot(nextBattle) as RunStateSnapshot['battle'];

    const nextCascade = createMutableClone(snapshot.cascade);
    nextCascade.activeChains = Object.freeze([...snapshot.cascade.activeChains]);
    nextCascade.positiveTrackers = Object.freeze([...snapshot.cascade.positiveTrackers]);
    next.cascade = freezeSnapshot(nextCascade) as RunStateSnapshot['cascade'];

    const nextTension = createMutableClone(snapshot.tension);
    nextTension.visibleThreats = Object.freeze([...snapshot.tension.visibleThreats]);
    next.tension = freezeSnapshot(nextTension) as RunStateSnapshot['tension'];

    const nextShield = createMutableClone(snapshot.shield);
    nextShield.layers = Object.freeze([...snapshot.shield.layers]);
    next.shield = freezeSnapshot(nextShield) as RunStateSnapshot['shield'];

    const nextTimers = createMutableClone(snapshot.timers);
    nextTimers.frozenWindowIds = Object.freeze([...snapshot.timers.frozenWindowIds]);
    nextTimers.activeDecisionWindows = freezeSnapshot({
      ...snapshot.timers.activeDecisionWindows,
    }) as RunStateSnapshot['timers']['activeDecisionWindows'];
    next.timers = freezeSnapshot(nextTimers) as RunStateSnapshot['timers'];

    const nextSovereignty = createMutableClone(snapshot.sovereignty);
    nextSovereignty.tickChecksums = Object.freeze([...snapshot.sovereignty.tickChecksums]);
    nextSovereignty.proofBadges = Object.freeze([...snapshot.sovereignty.proofBadges]);
    nextSovereignty.auditFlags = Object.freeze([
      ...snapshot.sovereignty.auditFlags,
    ]);
    next.sovereignty = freezeSnapshot(nextSovereignty) as RunStateSnapshot['sovereignty'];

    const nextModeState = createMutableClone(snapshot.modeState);
    nextModeState.disabledBots = Object.freeze([...snapshot.modeState.disabledBots]);
    nextModeState.handicapIds = Object.freeze([...snapshot.modeState.handicapIds]);
    next.modeState = freezeSnapshot(nextModeState) as RunStateSnapshot['modeState'];

    return freezeSnapshot(next);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Tick summary
  // ─────────────────────────────────────────────────────────────────────────────

  private createTickExecutionSummary(
    snapshot: RunStateSnapshot,
    traceId: string,
    startedAtMs: number,
    endedAtMs: number,
    stepDiagnostics: readonly TickStepDiagnostics[],
    warningsBeforeTick: number,
    flushedEventCount: number,
  ): TickExecutionSummary {
    const emittedWarnings =
      snapshot.telemetry.warnings.length <= warningsBeforeTick
        ? Object.freeze([]) as readonly string[]
        : Object.freeze(
            snapshot.telemetry.warnings.slice(warningsBeforeTick),
          );

    return {
      traceId,
      runId: snapshot.runId,
      tick: snapshot.tick,
      phase: snapshot.phase,
      startedAtMs,
      endedAtMs,
      durationMs: endedAtMs - startedAtMs,
      outcome: snapshot.outcome,
      outcomeReasonCode: snapshot.telemetry.outcomeReasonCode,
      stepDiagnostics: Object.freeze([...stepDiagnostics]),
      flushedEventCount,
      emittedWarnings,
      lastTickChecksum: snapshot.telemetry.lastTickChecksum,
    };
  }

  private pushTickHistory(summary: TickExecutionSummary): void {
    this.tickHistory = limitArray(
      [...this.tickHistory, summary],
      this.maxTickHistory,
    ) as readonly TickExecutionSummary[];
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Checksums and canonical projection
  // ─────────────────────────────────────────────────────────────────────────────

  private createTickChecksum(snapshot: RunStateSnapshot): string {
    return checksumSnapshot({
      runId: snapshot.runId,
      tick: snapshot.tick,
      phase: snapshot.phase,
      mode: snapshot.mode,
      outcome: snapshot.outcome,
      economy: snapshot.economy,
      pressure: {
        score: snapshot.pressure.score,
        tier: snapshot.pressure.tier,
        band: snapshot.pressure.band,
        lastEscalationTick: snapshot.pressure.lastEscalationTick,
      },
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
      shield: snapshot.shield.layers.map((layer) => ({
        layerId: layer.layerId,
        current: layer.current,
        max: layer.max,
        breached: layer.breached,
        integrityRatio: layer.integrityRatio,
      })),
      battle: {
        battleBudget: snapshot.battle.battleBudget,
        pendingAttacks: snapshot.battle.pendingAttacks.map((attack) => ({
          attackId: attack.attackId,
          source: attack.source,
          targetLayer: attack.targetLayer,
          targetEntity: attack.targetEntity,
          category: attack.category,
          magnitude: attack.magnitude,
          createdAtTick: attack.createdAtTick,
        })),
        bots: snapshot.battle.bots.map((bot) => ({
          botId: bot.botId,
          state: bot.state,
          heat: bot.heat,
          neutralized: bot.neutralized,
          attacksLanded: bot.attacksLanded,
          attacksBlocked: bot.attacksBlocked,
        })),
      },
      cascade: snapshot.cascade.activeChains.map((chain) => ({
        chainId: chain.chainId,
        templateId: chain.templateId,
        status: chain.status,
        positive: chain.positive,
        links: chain.links.map((link) => ({
          linkId: link.linkId,
          scheduledTick: link.scheduledTick,
          summary: link.summary,
        })),
      })),
      sovereignty: {
        integrityStatus: snapshot.sovereignty.integrityStatus,
        cordScore: snapshot.sovereignty.cordScore,
        sovereigntyScore: snapshot.sovereignty.sovereigntyScore,
        proofHash: snapshot.sovereignty.proofHash,
      },
      cards: {
        hand: snapshot.cards.hand.map((card) => ({
          instanceId: card.instanceId,
          definitionId: card.definitionId,
          cost: card.cost,
          tags: card.tags,
          targeting: card.targeting,
          timingClass: card.timingClass,
        })),
        discard: snapshot.cards.discard,
        exhaust: snapshot.cards.exhaust,
        lastPlayed: snapshot.cards.lastPlayed,
      },
      timers: {
        elapsedMs: snapshot.timers.elapsedMs,
        currentTickDurationMs: snapshot.timers.currentTickDurationMs,
        holdCharges: snapshot.timers.holdCharges,
        frozenWindowIds: snapshot.timers.frozenWindowIds,
        activeDecisionWindows: Object.values(snapshot.timers.activeDecisionWindows).map((window) => ({
          id: window.id,
          label: window.label,
          timingClass: window.timingClass,
          openedAtTick: window.openedAtTick,
          closesAtTick: window.closesAtTick,
          actorId: window.actorId,
          targetActorId: window.targetActorId,
          cardInstanceId: window.cardInstanceId,
          consumed: window.consumed,
          frozen: window.frozen,
          exclusive: window.exclusive,
        })),
      },
      telemetry: {
        decisionCount: snapshot.telemetry.decisions.length,
        outcomeReasonCode: snapshot.telemetry.outcomeReasonCode,
        lastTickChecksum: snapshot.telemetry.lastTickChecksum,
        warningCount: snapshot.telemetry.warnings.length,
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Assertions
  // ─────────────────────────────────────────────────────────────────────────────

  private assertCanStartRun(): void {
    if (this.lifecycle !== 'IDLE') {
      throw new Error(`Cannot start run while orchestrator lifecycle is ${this.lifecycle}.`);
    }
  }

  private assertActiveRun(): void {
    if (this.current === null) {
      throw new Error('No active run. Call startRun() first.');
    }
  }
}