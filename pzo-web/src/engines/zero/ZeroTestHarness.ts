/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * POINT ZERO ONE — ENGINE 0 ZERO TEST HARNESS
 * pzo-web/src/engines/zero/ZeroTestHarness.ts
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Purpose
 * - Provide a deterministic, zero-owned harness for UI tests, system tests,
 *   replay tests, smoke tests, and manual operator verification.
 * - Drive the REAL Engine 0 runtime manually, tick-by-tick, without introducing
 *   a parallel orchestrator or generic fake-engine abstraction.
 * - Support two lawful testing lanes:
 *
 *   1) LIVE RUNTIME LANE
 *      - Uses the real EngineOrchestrator + EventBus + Zustand stores
 *      - Manual start / tick / end / reset
 *      - Deterministic through explicit seed + explicit manual tick advancement
 *
 *   2) SYNTHETIC OBSERVATION LANE
 *      - Emits lawful EventBus events for UI/system tests that do not require
 *        all engine internals to compute a live tick
 *      - Preserves store wiring / event flush / diagnostics / devtools surfaces
 *      - Useful for panels, overlays, snapshot tests, and event-driven views
 *
 * Doctrine
 * - This harness never calls engine methods directly.
 * - It routes runtime execution through EngineOrchestrator / LifecycleController.
 * - It routes synthetic UI/runtime stimulation through EventBus.
 * - It never replaces repo-native stores, modes, or diagnostics.
 *
 * Determinism doctrine
 * - No internal interval loop.
 * - No hidden scheduler.
 * - No autonomous ticking.
 * - The harness advances only when the caller explicitly tells it to.
 *
 * Scope
 * - Frontend Engine 0 only.
 * - Uses repo-native singletons by default because the real orchestrator is
 *   already bound to the shared EventBus/store topology.
 *
 * Density6 LLC · Point Zero One · Confidential
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { sharedEventBus } from '../core/EventBus';
import type { EventBus } from '../core/EventBus';
import type {
  OrchestratorDiagnosticThresholds,
  OrchestratorStepName,
  TickWindowSample,
} from '../core/OrchestratorDiagnostics';

import {
  EngineOrchestrator,
  type StartRunParams,
} from './EngineOrchestrator';
import type {
  EngineEvent,
  EngineEventName,
  EngineId,
  RunLifecycleState,
  RunOutcome,
  TickResult,
  TickTier,
} from './types';

import {
  ZeroLifecycleController,
  zeroLifecycleController,
} from './ZeroLifecycleController';
import {
  ZeroEventBridge,
  zeroEventBridge,
  type ZeroEventBridgeMetrics,
  type ZeroObservedEventRecord,
} from './ZeroEventBridge';
import {
  ZeroDiagnostics,
  zeroDiagnostics,
  type ZeroDiagnosticsSnapshot,
} from './ZeroDiagnostics';
import {
  ZeroStoreBridge,
  zeroStoreBridge,
  type ZeroStoreBridgeSnapshot,
} from './ZeroStoreBridge';
import {
  ZeroRuntimeStatus,
  zeroRuntimeStatus,
  type ZeroRuntimeStatusSnapshot,
} from './ZeroRuntimeStatus';

import {
  useEngineStore,
  type EngineStoreState,
} from '../../store/engineStore';
import {
  runStore,
  readEngineStoreMirrorSnapshot,
  selectEngineStoreMirrorSnapshot,
  writeRunStoreFromCardReader,
  writeRunStoreFromOrchestratorSnapshot,
  type EngineStoreMirrorSnapshot,
  type RunStoreSlice,
} from '../../store/runStore';

import { frontendModeDirector } from '../../game/modes/FrontendModeDirector';
import type {
  BaseCardLike,
  EngineSnapshotLike,
  FrontendModeState,
  FrontendRunMode,
} from '../../game/modes/contracts';

/* =============================================================================
 * TYPES — HARNESS CONFIG
 * ========================================================================== */

export interface ZeroHarnessOptions {
  controller?: ZeroLifecycleController;
  orchestrator?: EngineOrchestrator;
  eventBridge?: ZeroEventBridge;
  diagnostics?: ZeroDiagnostics;
  storeBridge?: ZeroStoreBridge;
  runtimeStatus?: ZeroRuntimeStatus;

  /**
   * If provided, the harness will set this mode before startRun() or when
   * explicit mode projections are requested.
   */
  initialMode?: FrontendRunMode | null;
  initialModeOverrides?: Record<string, unknown>;

  /**
   * Runtime thresholds forwarded into a dedicated diagnostics instance when the
   * caller wants a harness-local diagnostics surface.
   *
   * When omitted, the shared zeroDiagnostics singleton is used.
   */
  diagnosticThresholds?: OrchestratorDiagnosticThresholds;

  /**
   * Automatically attaches a broad passive capture subscriber so all observed
   * events enter ZeroEventBridge history/metrics during real or synthetic runs.
   */
  autoInstallEventCapture?: boolean;

  /**
   * If true, constructor will hard-reset shared runtime state immediately.
   * Default: false.
   */
  autoResetOnConstruct?: boolean;
}

export interface ZeroHarnessStartOptions {
  mode?: FrontendRunMode;
  modeOverrides?: Record<string, unknown>;

  /**
   * Reset stores + diagnostics before starting the run.
   * Default: true.
   */
  resetRuntimeBeforeStart?: boolean;

  /**
   * Whether to bind the store bridge before startRun().
   * Default: true.
   */
  bindStoreBridge?: boolean;

  /**
   * If true, build a mode projection immediately after start.
   * Default: true when mode is present, otherwise false.
   */
  initializeModeProjection?: boolean;
}

export interface ZeroHarnessTickOptions {
  /**
   * If true, record diagnostics scheduling + completion around the live tick.
   * Default: true.
   */
  instrumentDiagnostics?: boolean;

  /**
   * If provided, override the scheduled duration used by diagnostics for this
   * tick. Otherwise the harness reads currentTickDurationMs from engineStore.
   */
  scheduledDurationMsOverride?: number;
}

export interface ZeroHarnessTickBatchOptions extends ZeroHarnessTickOptions {
  stopOnOutcome?: boolean;
  stopWhenPaused?: boolean;
}

export interface ZeroHarnessSyntheticEvent {
  eventType: string;
  payload: unknown;
  sourceEngine?: EngineId;
}

export interface ZeroHarnessSyntheticTickScript {
  tickIndex: number;
  scheduledDurationMs: number;
  tier: TickTier | null;

  /**
   * Optional diagnostics-only step timing injection.
   * Useful for debug panels and orchestration tests when not running a live tick.
   */
  stepDurationsMs?: Partial<Record<OrchestratorStepName, number>>;

  /**
   * Optional diagnostics-only decision window count at this synthetic boundary.
   */
  openDecisionWindowCount?: number;

  /**
   * Event sequence to queue before final flush.
   */
  events?: readonly ZeroHarnessSyntheticEvent[];

  /**
   * Whether to emit a synthetic TICK_START envelope.
   * Default: true.
   */
  emitTickStart?: boolean;

  /**
   * Whether to emit a synthetic TICK_COMPLETE envelope.
   * Default: true.
   */
  emitTickComplete?: boolean;

  /**
   * Terminal outcome to embed in synthetic TICK_COMPLETE.
   * Default: null.
   */
  outcome?: RunOutcome | null;

  /**
   * If true, diagnostics.onFlushStarted() is called before flush.
   * Default: true.
   */
  markFlushStart?: boolean;

  /**
   * If true, capture a runtime sample after flush.
   * Default: true.
   */
  captureRuntimeSample?: boolean;
}

export interface ZeroHarnessModeProjection {
  readonly mode: FrontendRunMode;
  readonly metadata: ReturnType<typeof frontendModeDirector.getModeMetadata>;
  readonly engineConfig: Record<string, unknown>;
  readonly snapshot: EngineSnapshotLike;
  readonly cards: BaseCardLike[];
  readonly state: FrontendModeState;
}

export interface ZeroHarnessSnapshot {
  readonly generatedAt: number;
  readonly lifecycleState: RunLifecycleState | 'UNKNOWN';
  readonly isPaused: boolean;
  readonly lastTickResult: TickResult | null;
  readonly lastSyntheticTickSample: TickWindowSample | null;
  readonly status: ZeroRuntimeStatusSnapshot;
  readonly diagnostics: ZeroDiagnosticsSnapshot;
  readonly eventMetrics: ZeroEventBridgeMetrics;
  readonly storeBridge: ZeroStoreBridgeSnapshot;
  readonly engineStore: EngineStoreState;
  readonly runStore: RunStoreSlice;
  readonly runMirror: EngineStoreMirrorSnapshot;
  readonly handSnapshot: ReturnType<EngineOrchestrator['getHandSnapshot']> | null;
  readonly modeProjection: ZeroHarnessModeProjection | null;
}

/* =============================================================================
 * TYPES — ASSERTIONS / HELPERS
 * ========================================================================== */

export interface ZeroHarnessAssertionOptions {
  message?: string;
}

export interface ZeroHarnessObservedEventMatch<
  TEventName extends string = string,
> {
  readonly eventType: TEventName;
  readonly tickIndex: number;
  readonly sourceEngine: string | null;
  readonly payload: unknown;
}

type GenericEventHandler = (event: EngineEvent<any>) => void;

/* =============================================================================
 * HELPERS
 * ========================================================================== */

const NOOP = () => {};

function asNonNegativeInteger(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

function assertCondition(
  condition: boolean,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(`[ZeroTestHarness] ${message}`);
  }
}

function safeNow(): number {
  return Date.now();
}

function safeRunLifecycleState(
  controller: ZeroLifecycleController,
): RunLifecycleState | 'UNKNOWN' {
  try {
    return controller.getLifecycleState();
  } catch {
    return 'UNKNOWN';
  }
}

function shallowClone<T>(value: T): T {
  if (Array.isArray(value)) {
    return [...value] as T;
  }
  if (value && typeof value === 'object') {
    return { ...(value as Record<string, unknown>) } as T;
  }
  return value;
}

function normalizeModeOverrides(
  overrides?: Record<string, unknown>,
): Record<string, unknown> {
  return { ...(overrides ?? {}) };
}

/**
 * Hand snapshots across game layers can vary in richness. For harness-mode
 * projection we only need a BaseCardLike-compatible view.
 */
function extractBaseCardsFromHandSnapshot(
  handSnapshot: unknown,
): BaseCardLike[] {
  const out: BaseCardLike[] = [];

  if (!handSnapshot || typeof handSnapshot !== 'object') {
    return out;
  }

  const candidateLists: unknown[] = [
    (handSnapshot as any).cards,
    (handSnapshot as any).hand,
    handSnapshot,
  ];

  for (const candidate of candidateLists) {
    if (!Array.isArray(candidate)) {
      continue;
    }

    for (const entry of candidate) {
      if (!entry || typeof entry !== 'object') {
        continue;
      }

      const definition = (entry as any).definition;
      if (definition && typeof definition === 'object') {
        out.push(definition as BaseCardLike);
        continue;
      }

      out.push(entry as BaseCardLike);
    }

    if (out.length > 0) {
      return out;
    }
  }

  return out;
}

function buildEngineSnapshotLikeFromStores(
  engineState: EngineStoreState,
  runMirror: EngineStoreMirrorSnapshot,
  freedomThreshold: number,
): EngineSnapshotLike {
  const tick = engineState.time.ticksElapsed ?? engineState.run.lastTickIndex ?? 0;
  const elapsedMs =
    engineState.time.lastTickTimestamp ??
    tick * (engineState.time.currentTickDurationMs || 0);

  const snapshot = {
    runId: runMirror.runId ?? engineState.run.runId ?? 'HARNESS_RUN',
    seed: runMirror.seed ?? engineState.run.seed ?? 'HARNESS_SEED',
    tick,
    elapsedMs,
    totalRunMs: elapsedMs,

    cash: runMirror.cashBalance,
    netWorth: runMirror.netWorth,
    incomePerTick: runMirror.monthlyIncome,
    expensePerTick: runMirror.monthlyExpenses,
    freedomThreshold,

    pressureTier: engineState.time.currentTier ?? 'T1',
    pressureValue: engineState.pressure.score ?? 0,

    shields: {
      L1: Number(
        (engineState.shield.snapshot as any)?.layers?.find?.(
          (layer: any) => layer?.id === 'LIQUIDITY_BUFFER' || layer?.id === 'L1',
        )?.currentIntegrity ?? 0,
      ),
      L2: Number(
        (engineState.shield.snapshot as any)?.layers?.find?.(
          (layer: any) => layer?.id === 'CREDIT_LINE' || layer?.id === 'L2',
        )?.currentIntegrity ?? 0,
      ),
      L3: Number(
        (engineState.shield.snapshot as any)?.layers?.find?.(
          (layer: any) => layer?.id === 'ASSET_FLOOR' || layer?.id === 'L3',
        )?.currentIntegrity ?? 0,
      ),
      L4: Number(
        (engineState.shield.snapshot as any)?.layers?.find?.(
          (layer: any) => layer?.id === 'NETWORK_CORE' || layer?.id === 'L4',
        )?.currentIntegrity ?? 0,
      ),
    },

    blockedSabotages: engineState.shield.lastDamageResult ? 1 : 0,
    cascadeChainsBroken: engineState.cascade.totalLinksDefeated ?? 0,
    battleBudget:
      Number(
        (engineState.battle.budget as any)?.remaining ??
          (engineState.battle.budget as any)?.remainingBudget ??
          0,
      ) || 0,
  } as EngineSnapshotLike;

  return snapshot;
}

function createObservedEventMatch(
  record: ZeroObservedEventRecord,
): ZeroHarnessObservedEventMatch {
  return {
    eventType: record.event.eventType,
    tickIndex: record.event.tickIndex,
    sourceEngine: record.event.sourceEngine ?? null,
    payload: record.event.payload,
  };
}

/* =============================================================================
 * ZERO TEST HARNESS
 * ========================================================================== */

export class ZeroTestHarness {
  private readonly controller: ZeroLifecycleController;
  private readonly orchestrator: EngineOrchestrator;
  private readonly eventBridge: ZeroEventBridge;
  private readonly diagnostics: ZeroDiagnostics;
  private readonly storeBridge: ZeroStoreBridge;
  private readonly runtimeStatus: ZeroRuntimeStatus;
  private readonly eventBus: EventBus;

  private currentMode: FrontendRunMode | null;
  private currentModeOverrides: Record<string, unknown>;
  private currentModeProjection: ZeroHarnessModeProjection | null = null;

  private lastTickResult: TickResult | null = null;
  private lastSyntheticTickSample: TickWindowSample | null = null;
  private lastStartParams: StartRunParams | null = null;

  private captureUnsubscribe: (() => void) | null = null;

  public constructor(options: ZeroHarnessOptions = {}) {
    /**
     * Use repo-native singletons by default.
     *
     * This is intentional because the real EngineOrchestrator is already wired to
     * the shared runtime topology. The harness should sit on top of that topology,
     * not pretend there is an isolated production graph when there is not.
     */
    this.controller = options.controller ?? zeroLifecycleController;
    this.orchestrator = options.orchestrator ?? this.controller.getOrchestrator();
    this.eventBridge = options.eventBridge ?? zeroEventBridge;
    this.diagnostics = options.diagnostics ?? zeroDiagnostics;
    this.storeBridge = options.storeBridge ?? zeroStoreBridge;
    this.runtimeStatus = options.runtimeStatus ?? zeroRuntimeStatus;
    this.eventBus = sharedEventBus;

    this.currentMode = options.initialMode ?? null;
    this.currentModeOverrides = normalizeModeOverrides(options.initialModeOverrides);

    this.controller.setMode(this.currentMode, this.currentModeOverrides);

    if (options.autoInstallEventCapture !== false) {
      this.installPassiveEventCapture();
    }

    if (options.autoResetOnConstruct) {
      this.hardReset();
    }
  }

  /* ===========================================================================
   * INSTALL / RESET / DESTROY
   * ========================================================================= */

  public installPassiveEventCapture(): void {
    if (this.captureUnsubscribe) {
      return;
    }

    /**
     * A passive no-op subscriber across ALL channel groups causes ZeroEventBridge
     * to observe real emitted events and maintain a history/metrics stream.
     */
    this.captureUnsubscribe = this.eventBridge.subscribeScope(
      'ALL',
      NOOP as GenericEventHandler,
      { captureHistory: true },
    );
  }

  public removePassiveEventCapture(): void {
    if (this.captureUnsubscribe) {
      this.captureUnsubscribe();
      this.captureUnsubscribe = null;
    }
  }

  public hardReset(): void {
    /**
     * Reset order matters:
     * 1) stop lifecycle runtime
     * 2) reset engineStore slices
     * 3) reset runStore
     * 4) reset event observations / diagnostics
     * 5) sync mirrored runtime view back into engineStore
     */
    try {
      this.controller.reset({ resetEngineStoreSlices: true });
    } catch {
      // If controller reset fails because runtime is in a strange state, we still
      // continue with store-level cleanup for test determinism.
    }

    useEngineStore.getState().resetAllSlices();
    runStore.getState().reset();

    this.eventBridge.resetMetrics();
    this.diagnostics.reset();

    this.storeBridge.bind({
      eventBus: this.eventBus,
      wireEngineHandlers: true,
      wireRunMirror: true,
      resetEngineSlicesBeforeBind: false,
      syncRunMirrorImmediately: true,
    });

    this.storeBridge.syncRunMirrorNow();

    this.lastTickResult = null;
    this.lastSyntheticTickSample = null;
    this.lastStartParams = null;
    this.currentModeProjection = null;
  }

  public destroy(): void {
    this.removePassiveEventCapture();
  }

  /* ===========================================================================
   * MODE / SNAPSHOT HELPERS
   * ========================================================================= */

  public setMode(
    mode: FrontendRunMode | null,
    overrides: Record<string, unknown> = {},
  ): void {
    this.currentMode = mode;
    this.currentModeOverrides = normalizeModeOverrides(overrides);
    this.currentModeProjection = null;
    this.controller.setMode(mode, this.currentModeOverrides);
  }

  public getMode(): FrontendRunMode | null {
    return this.currentMode;
  }

  public getModeProjection(): ZeroHarnessModeProjection | null {
    return this.currentModeProjection;
  }

  public buildModeProjection(
    mode: FrontendRunMode = this.requireCurrentMode(),
    overrides: Record<string, unknown> = this.currentModeOverrides,
    cardsOverride?: BaseCardLike[],
  ): ZeroHarnessModeProjection {
    const engineStoreState = useEngineStore.getState();
    const runMirror = selectEngineStoreMirrorSnapshot(runStore.getState());
    const handSnapshot = this.safeGetHandSnapshot();
    const cards = cardsOverride ?? extractBaseCardsFromHandSnapshot(handSnapshot);

    const snapshot = buildEngineSnapshotLikeFromStores(
      engineStoreState,
      runMirror,
      this.lastStartParams?.freedomThreshold ?? 0,
    );

    const projection: ZeroHarnessModeProjection = {
      mode,
      metadata: frontendModeDirector.getModeMetadata(mode),
      engineConfig: frontendModeDirector.createEngineConfig(
        mode,
        snapshot.seed,
        overrides,
      ) as Record<string, unknown>,
      snapshot,
      cards,
      state: frontendModeDirector.createInitialState(mode, snapshot, cards),
    };

    this.currentModeProjection = projection;
    return projection;
  }

  public reduceModeProjection(
    previous: FrontendModeState,
    mode: FrontendRunMode = this.requireCurrentMode(),
    cardsOverride?: BaseCardLike[],
  ): FrontendModeState {
    const engineStoreState = useEngineStore.getState();
    const runMirror = selectEngineStoreMirrorSnapshot(runStore.getState());
    const handSnapshot = this.safeGetHandSnapshot();
    const cards = cardsOverride ?? extractBaseCardsFromHandSnapshot(handSnapshot);

    const snapshot = buildEngineSnapshotLikeFromStores(
      engineStoreState,
      runMirror,
      this.lastStartParams?.freedomThreshold ?? 0,
    );

    return frontendModeDirector.reduce(mode, previous, snapshot, cards);
  }

  /* ===========================================================================
   * LIVE RUNTIME LANE
   * ========================================================================= */

  public startRun(
    params: StartRunParams,
    options: ZeroHarnessStartOptions = {},
  ): ZeroHarnessSnapshot {
    const shouldReset = options.resetRuntimeBeforeStart !== false;
    if (shouldReset) {
      this.hardReset();
    } else {
      this.storeBridge.bind({
        eventBus: this.eventBus,
        wireEngineHandlers: true,
        wireRunMirror: true,
        resetEngineSlicesBeforeBind: false,
        syncRunMirrorImmediately: true,
      });
    }

    if (options.mode !== undefined) {
      this.setMode(options.mode, options.modeOverrides ?? {});
    }

    this.lastStartParams = params;

    this.controller.startRun(params, {
      mode: this.currentMode ?? undefined,
      modeOverrides: this.currentModeOverrides,
      bindStoreBridge: options.bindStoreBridge !== false,
      wireEngineHandlers: true,
      wireRunMirror: true,
      resetEngineSlicesBeforeBind: false,
      syncRunMirrorImmediately: true,
    });

    /**
     * Mirror run metadata aggressively to keep engineStore/runtime views aligned
     * for immediate UI assertions right after start.
     */
    writeRunStoreFromOrchestratorSnapshot({
      runId: params.runId,
      userId: params.userId,
      seed: params.seed,
    });
    this.storeBridge.syncRunMirrorNow();

    if (
      (this.currentMode && options.initializeModeProjection !== false) ||
      options.initializeModeProjection === true
    ) {
      this.buildModeProjection();
    }

    return this.getSnapshot();
  }

  public async tick(
    options: ZeroHarnessTickOptions = {},
  ): Promise<TickResult | null> {
    assertCondition(
      !this.controller.isPaused(),
      'Cannot execute live tick while harness is paused',
    );

    const instrument = options.instrumentDiagnostics !== false;

    if (instrument) {
      const engineStateBefore = useEngineStore.getState();
      const tickIndexBefore =
        engineStateBefore.time.ticksElapsed ??
        engineStateBefore.run.lastTickIndex ??
        0;

      const tierBefore = engineStateBefore.time.currentTier ?? null;
      const scheduledDurationMs =
        options.scheduledDurationMsOverride ??
        engineStateBefore.time.currentTickDurationMs ??
        0;

      this.diagnostics.onTickScheduled(
        tickIndexBefore,
        scheduledDurationMs,
        tierBefore,
      );
      this.diagnostics.onDecisionWindowCountUpdated(
        engineStateBefore.time.activeDecisionWindows.length,
      );
      this.diagnostics.onTickStarted();
    }

    const result = await this.controller.executeTick();
    this.storeBridge.syncRunMirrorNow();

    if (instrument) {
      const engineStateAfter = useEngineStore.getState();
      this.diagnostics.onDecisionWindowCountUpdated(
        engineStateAfter.time.activeDecisionWindows.length,
      );
      this.lastSyntheticTickSample = this.diagnostics.getCoreDiagnostics().onTickCompleted();
    }

    this.lastTickResult = result;

    if (this.currentMode) {
      this.buildModeProjection();
    }

    return result;
  }

  public async tickMany(
    count: number,
    options: ZeroHarnessTickBatchOptions = {},
  ): Promise<TickResult[]> {
    const target = asNonNegativeInteger(count);
    const results: TickResult[] = [];

    for (let i = 0; i < target; i += 1) {
      if (options.stopWhenPaused !== false && this.controller.isPaused()) {
        break;
      }

      const result = await this.tick(options);
      if (!result) {
        break;
      }

      results.push(result);

      if (options.stopOnOutcome !== false && result.runOutcome !== null) {
        break;
      }
    }

    return results;
  }

  public pause(reason = 'HARNESS_PAUSE'): boolean {
    return this.controller.pause(reason);
  }

  public resume(): boolean {
    return this.controller.resume();
  }

  public async endRun(outcome: RunOutcome): Promise<void> {
    await this.controller.endRun(outcome);
    this.storeBridge.syncRunMirrorNow();

    if (this.currentMode) {
      this.buildModeProjection();
    }
  }

  public async abandonRun(reason = 'HARNESS_ABANDONED'): Promise<void> {
    await this.controller.abandonRun(reason);
    this.storeBridge.syncRunMirrorNow();

    if (this.currentMode) {
      this.buildModeProjection();
    }
  }

  /* ===========================================================================
   * CARD / INPUT HELPERS
   * ========================================================================= */

  public queueCardPlay(
    request: Parameters<EngineOrchestrator['queueCardPlay']>[0],
  ): void {
    this.orchestrator.queueCardPlay(request);
    const cardReader = this.orchestrator.getCardReader();
    writeRunStoreFromCardReader(cardReader);
    this.storeBridge.syncRunMirrorNow();
  }

  public holdCard(instanceId: string): boolean {
    const result = this.orchestrator.holdCard(instanceId);
    const cardReader = this.orchestrator.getCardReader();
    writeRunStoreFromCardReader(cardReader);
    this.storeBridge.syncRunMirrorNow();
    return result;
  }

  public releaseHold(): unknown {
    const result = this.orchestrator.releaseHold();
    const cardReader = this.orchestrator.getCardReader();
    writeRunStoreFromCardReader(cardReader);
    this.storeBridge.syncRunMirrorNow();
    return result;
  }

  public getHandSnapshot(): ReturnType<EngineOrchestrator['getHandSnapshot']> {
    return this.orchestrator.getHandSnapshot();
  }

  public getBaseCardsFromHand(): BaseCardLike[] {
    return extractBaseCardsFromHandSnapshot(this.safeGetHandSnapshot());
  }

  /* ===========================================================================
   * SYNTHETIC OBSERVATION LANE
   * ========================================================================= */

  public emitSyntheticEvent(
    event: ZeroHarnessSyntheticEvent,
    tickIndex = this.getCurrentTickIndex(),
  ): void {
    this.eventBus.setTickContext(tickIndex);

    /**
     * Queue through the REAL EventBus so subscribers/stores receive the same
     * flush semantics as production runtime.
     */
    (this.eventBus as any).emit(
      event.eventType,
      event.payload,
      event.sourceEngine,
    );
  }

  public runSyntheticTick(
    script: ZeroHarnessSyntheticTickScript,
  ): TickWindowSample {
    this.eventBus.setTickContext(script.tickIndex);

    this.diagnostics.onTickScheduled(
      script.tickIndex,
      script.scheduledDurationMs,
      script.tier,
    );
    this.diagnostics.onTickStarted();

    if (typeof script.openDecisionWindowCount === 'number') {
      this.diagnostics.onDecisionWindowCountUpdated(
        asNonNegativeInteger(script.openDecisionWindowCount),
      );
    } else {
      this.diagnostics.onDecisionWindowCountUpdated(
        useEngineStore.getState().time.activeDecisionWindows.length,
      );
    }

    if (script.emitTickStart !== false) {
      (this.eventBus as any).emit('TICK_START', {
        tickIndex: script.tickIndex,
        tickDurationMs: script.scheduledDurationMs,
      });
    }

    const stepEntries = Object.entries(script.stepDurationsMs ?? {}) as Array<
      [OrchestratorStepName, number]
    >;

    for (const [step, durationMs] of stepEntries) {
      this.diagnostics.onStepCompleted(step, durationMs);
    }

    for (const syntheticEvent of script.events ?? []) {
      (this.eventBus as any).emit(
        syntheticEvent.eventType,
        syntheticEvent.payload,
        syntheticEvent.sourceEngine,
      );
    }

    if (script.emitTickComplete !== false) {
      (this.eventBus as any).emit('TICK_COMPLETE', {
        tickIndex: script.tickIndex,
        tickDurationMs: script.scheduledDurationMs,
        outcome: script.outcome ?? null,
      });
    }

    if (script.markFlushStart !== false) {
      this.diagnostics.onFlushStarted();
    }

    this.eventBus.flush();
    this.storeBridge.syncRunMirrorNow();

    const sample = this.diagnostics.getCoreDiagnostics().onTickCompleted();
    this.lastSyntheticTickSample = sample;

    if (script.captureRuntimeSample !== false) {
      this.diagnostics.captureRuntimeSample();
    }

    if (this.currentMode) {
      this.buildModeProjection();
    }

    return sample;
  }

  /* ===========================================================================
   * SNAPSHOTS / OBSERVATION / METRICS
   * ========================================================================= */

  public getSnapshot(): ZeroHarnessSnapshot {
    const runMirror = readEngineStoreMirrorSnapshot();
    const handSnapshot = this.safeGetHandSnapshot();

    return {
      generatedAt: safeNow(),
      lifecycleState: safeRunLifecycleState(this.controller),
      isPaused: this.controller.isPaused(),
      lastTickResult: this.lastTickResult,
      lastSyntheticTickSample: this.lastSyntheticTickSample,
      status: this.runtimeStatus.getSnapshot(),
      diagnostics: this.diagnostics.getSnapshot(),
      eventMetrics: this.eventBridge.getMetrics(),
      storeBridge: this.storeBridge.getSnapshot(),
      engineStore: useEngineStore.getState(),
      runStore: runStore.getState(),
      runMirror,
      handSnapshot,
      modeProjection: this.currentModeProjection,
    };
  }

  public getRuntimeStatus(): ZeroRuntimeStatusSnapshot {
    return this.runtimeStatus.getSnapshot();
  }

  public getDiagnosticsSnapshot(): ZeroDiagnosticsSnapshot {
    return this.diagnostics.getSnapshot();
  }

  public getStoreBridgeSnapshot(): ZeroStoreBridgeSnapshot {
    return this.storeBridge.getSnapshot();
  }

  public getEventMetrics(): ZeroEventBridgeMetrics {
    return this.eventBridge.getMetrics();
  }

  public getObservedEvents(limit = 256): readonly ZeroObservedEventRecord[] {
    return this.eventBridge.getObservedHistory(limit);
  }

  public getObservedEventMatches(
    limit = 256,
  ): readonly ZeroHarnessObservedEventMatch[] {
    return this.eventBridge
      .getObservedHistory(limit)
      .map(createObservedEventMatch);
  }

  public clearObservedEvents(): void {
    this.eventBridge.clearObservedHistory();
  }

  public clearDiagnostics(): void {
    this.diagnostics.clearJournals();
  }

  public getCurrentTickIndex(): number {
    const state = useEngineStore.getState();
    return state.time.ticksElapsed ?? state.run.lastTickIndex ?? 0;
  }

  public getCurrentRunId(): string | null {
    return this.orchestrator.getCurrentRunId();
  }

  public getHealthReport(): ReturnType<EngineOrchestrator['getHealthReport']> {
    return this.orchestrator.getHealthReport();
  }

  /* ===========================================================================
   * ASSERTION HELPERS
   * ========================================================================= */

  public expectLifecycleState(
    expected: RunLifecycleState | 'UNKNOWN',
    options: ZeroHarnessAssertionOptions = {},
  ): this {
    const actual = safeRunLifecycleState(this.controller);
    assertCondition(
      actual === expected,
      options.message ??
        `Expected lifecycle state "${expected}" but received "${actual}"`,
    );
    return this;
  }

  public expectPaused(
    expected: boolean,
    options: ZeroHarnessAssertionOptions = {},
  ): this {
    const actual = this.controller.isPaused();
    assertCondition(
      actual === expected,
      options.message ??
        `Expected paused=${String(expected)} but received ${String(actual)}`,
    );
    return this;
  }

  public expectCurrentRunId(
    expected: string | null,
    options: ZeroHarnessAssertionOptions = {},
  ): this {
    const actual = this.getCurrentRunId();
    assertCondition(
      actual === expected,
      options.message ??
        `Expected runId "${String(expected)}" but received "${String(actual)}"`,
    );
    return this;
  }

  public expectObservedEvent(
    eventType: string,
    predicate?: (match: ZeroHarnessObservedEventMatch) => boolean,
    options: ZeroHarnessAssertionOptions = {},
  ): this {
    const match = this.getObservedEventMatches().find((entry) => {
      if (entry.eventType !== eventType) {
        return false;
      }
      return predicate ? predicate(entry) : true;
    });

    assertCondition(
      Boolean(match),
      options.message ??
        `Expected to observe event "${eventType}" in ZeroEventBridge history`,
    );

    return this;
  }

  public expectPendingEventQueueDepth(
    expected: number,
    options: ZeroHarnessAssertionOptions = {},
  ): this {
    const actual = this.eventBus.getPendingCount();
    assertCondition(
      actual === expected,
      options.message ??
        `Expected pending event queue depth ${expected} but received ${actual}`,
    );
    return this;
  }

  public expectHealthInitialized(
    options: ZeroHarnessAssertionOptions = {},
  ): this {
    const report = this.getHealthReport();
    const failingEntry = Object.entries(report).find(([, state]) => state !== 'INITIALIZED');

    assertCondition(
      !failingEntry,
      options.message ??
        `Expected all registered engines to be INITIALIZED, but found ${String(
          failingEntry?.[0] ?? 'unknown',
        )}=${String(failingEntry?.[1] ?? 'unknown')}`,
    );

    return this;
  }

  /* ===========================================================================
   * INTERNAL HELPERS
   * ========================================================================= */

  private requireCurrentMode(): FrontendRunMode {
    assertCondition(
      this.currentMode !== null,
      'No current FrontendRunMode is set on the harness',
    );
    return this.currentMode;
  }

  private safeGetHandSnapshot():
    | ReturnType<EngineOrchestrator['getHandSnapshot']>
    | null {
    try {
      return this.orchestrator.getHandSnapshot();
    } catch {
      return null;
    }
  }
}

export const zeroTestHarness = new ZeroTestHarness();

export default zeroTestHarness;