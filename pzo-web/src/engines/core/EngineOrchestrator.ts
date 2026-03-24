/**
 * POINT ZERO ONE — FRONTEND ENGINE ORCHESTRATOR
 * FILE: pzo-web/src/engines/core/EngineOrchestrator.ts
 *
 * Purpose
 * - Be the authoritative frontend tick coordinator for Engines 0–7.
 * - Preserve deterministic step ordering.
 * - Bind EventBus emissions to UI/store surfaces without hard-coding a single
 *   store implementation.
 * - Coordinate TimeEngine + DecisionTimer cleanly while the repo continues to
 *   converge on the fuller seven-engine architecture.
 *
 * Doctrine
 * - One orchestrator owns the tick loop.
 * - EventBus.flush() happens once per completed tick.
 * - The orchestrator is the only module that may advance TimeEngine and stamp
 *   EventBus tick context.
 * - Store writes happen through event reactions, not from UI components.
 *
 * Notes
 * - This implementation is intentionally compatibility-heavy so it can operate
 *   against both the current repo’s monolithic engineStore lane and an extracted
 *   time slice lane.
 * - Engine interfaces below are structural and minimal by design. The current
 *   repo is still heterogeneous across engines, so strict class imports would
 *   create brittle coupling.
 *
 * Density6 LLC · Point Zero One · Confidential
 */

import { sharedEventBus, type EventBus } from './EventBus';
import { OrchestratorDiagnostics, type OrchestratorStepName } from './OrchestratorDiagnostics';
import { WallClockSource, type ClockSource } from './ClockSource';
import { DecisionTimer } from '../time/DecisionTimer';
import { TimeEngine } from '../time/TimeEngine';
import type { PressureReader } from '../pressure/types';
import type { RunLifecycleState, RunOutcome } from '../zero/types';

// ───────────────────────────────────────────────────────────────────────────────
// Structural engine contracts
// ───────────────────────────────────────────────────────────────────────────────

export interface OrchestratorSnapshot {
  readonly tickIndex: number;
  readonly tickTier: string;
  readonly tickDurationMs: number;
  readonly pressureScore: number;
  readonly pressureTier: string | null;
  readonly seasonBudget: number;
  readonly ticksRemaining: number;
  readonly timeoutImminent: boolean;
  readonly activeDecisionWindows: number;
  readonly pendingEventCount: number;
  readonly runtime: Readonly<Record<string, unknown>>;
}

export interface PressureEngineLike extends PressureReader {
  computeScore?(snapshot: OrchestratorSnapshot): number;
  recomputePostActions?(snapshot: OrchestratorSnapshot): number;
}

export interface TensionEngineLike {
  updateQueue?(snapshot: OrchestratorSnapshot): void;
}

export interface ShieldEngineLike {
  applyPassiveDecay?(snapshot: OrchestratorSnapshot): void;
  applyAttacks?(snapshot: OrchestratorSnapshot): unknown[];
}

export interface BattleEngineLike {
  evaluateBotStates?(snapshot: OrchestratorSnapshot): void;
  executeAttacks?(snapshot: OrchestratorSnapshot): unknown[];
}

export interface CascadeEngineLike {
  executeScheduledLinks?(snapshot: OrchestratorSnapshot): unknown[];
  checkRecoveryConditions?(snapshot: OrchestratorSnapshot): unknown[];
}

export interface SovereigntyEngineLike {
  snapshotTick?(snapshot: OrchestratorSnapshot): void;
}

export interface DecisionWindowRegistration {
  readonly windowId: string;
  readonly durationMs: number;
  readonly optionCount: number;
}

export interface EngineBundle {
  readonly pressure?: PressureEngineLike | null;
  readonly tension?: TensionEngineLike | null;
  readonly shield?: ShieldEngineLike | null;
  readonly battle?: BattleEngineLike | null;
  readonly cascade?: CascadeEngineLike | null;
  readonly sovereignty?: SovereigntyEngineLike | null;
}

export interface EngineOrchestratorConfig {
  readonly eventBus?: EventBus;
  readonly timeEngine?: TimeEngine;
  readonly decisionTimer?: DecisionTimer;
  readonly pressureReader?: PressureReader | null;
  readonly engines?: EngineBundle;
  readonly snapshotProvider?: () => Record<string, unknown>;
  readonly outcomeResolver?: (snapshot: OrchestratorSnapshot) => RunOutcome | null;
  readonly defaultSeasonTickBudget?: number;
  readonly autoBindStore?: boolean;
  readonly autoStart?: boolean;
  /** Injected clock — default WallClockSource. Use FixedClockSource/ManualClockSource in tests. */
  readonly clockSource?: ClockSource;
  /** When true, OrchestratorDiagnostics runs per-step timing. Default: true. */
  readonly enableDiagnostics?: boolean;
}

export interface StartRunOptions {
  readonly seasonTickBudget?: number;
  readonly immediateFirstTick?: boolean;
}

export interface TickExecutionRecord {
  readonly tickIndex: number;
  readonly pressureScore: number;
  readonly postActionPressure: number;
  readonly attacksFired: readonly unknown[];
  readonly damageResults: readonly unknown[];
  readonly cascadeEffects: readonly unknown[];
  readonly recoveryResults: readonly unknown[];
  readonly runOutcome: RunOutcome | null;
  readonly tickDurationMs: number;
  readonly activeDecisionWindows: number;
}

interface StepMetric {
  readonly step: string;
  readonly startedAtMs: number;
  readonly endedAtMs: number;
  readonly durationMs: number;
  readonly ok: boolean;
  readonly errorMessage: string | null;
}

interface StoreDispatchAdapter {
  onRunStarted?: (budget: number) => void;
  onRunEnded?: () => void;
  onTickComplete?: (event: unknown) => void;
  onTierChanged?: (event: unknown) => void;
  onDecisionWindowOpened?: (window: unknown) => void;
  onDecisionWindowClosed?: (windowId: string) => void;
  onDecisionWindowTick?: (payload: Record<string, number>) => void;
  onHoldUsed?: (windowId: string, holdsRemaining: number) => void;
}

// ───────────────────────────────────────────────────────────────────────────────
// Orchestrator
// ───────────────────────────────────────────────────────────────────────────────

export class EngineOrchestrator {
  private readonly eventBus: EventBus;
  private readonly timeEngine: TimeEngine;
  private readonly decisionTimer: DecisionTimer;
  private readonly pressureReader: PressureReader | null;
  private engines: EngineBundle;
  private readonly snapshotProvider: () => Record<string, unknown>;
  private readonly outcomeResolver: (snapshot: OrchestratorSnapshot) => RunOutcome | null;
  private readonly clock: ClockSource;
  private readonly diagnostics: OrchestratorDiagnostics;
  private readonly diagnosticsEnabled: boolean;

  private lifecycleState: RunLifecycleState = 'IDLE';
  private readonly defaultSeasonTickBudget: number;
  private currentRunOutcome: RunOutcome | null = null;
  private tickTimer: ReturnType<typeof setTimeout> | null = null;
  private isPaused = false;
  private isTickExecuting = false;
  private runGeneration = 0;

  private readonly stepMetrics: StepMetric[] = [];
  private lastTickRecord: TickExecutionRecord | null = null;
  private readonly listenerTeardowns: Array<() => void> = [];
  private storeDispatchPromise: Promise<StoreDispatchAdapter | null> | null = null;

  public constructor(config: EngineOrchestratorConfig = {}) {
    this.eventBus = config.eventBus ?? sharedEventBus;
    this.pressureReader = config.pressureReader ?? null;
    this.timeEngine = config.timeEngine ?? new TimeEngine(this.eventBus);
    this.decisionTimer = config.decisionTimer ?? new DecisionTimer(this.eventBus);
    this.engines = config.engines ?? {};
    this.snapshotProvider = config.snapshotProvider ?? (() => ({}));
    this.outcomeResolver = config.outcomeResolver ?? (() => null);
    this.defaultSeasonTickBudget = Math.max(1, config.defaultSeasonTickBudget ?? 300);
    this.clock = config.clockSource ?? new WallClockSource();
    this.diagnosticsEnabled = config.enableDiagnostics !== false;
    this.diagnostics = new OrchestratorDiagnostics();

    if (this.pressureReader && 'setPressureReader' in this.timeEngine) {
      this.timeEngine.setPressureReader(this.pressureReader);
    }

    this.registerEventListeners();

    if (config.autoBindStore !== false) {
      void this.resolveStoreDispatch();
    }

    if (config.autoStart === true) {
      this.startRun({ immediateFirstTick: true });
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Public lifecycle
  // ───────────────────────────────────────────────────────────────────────────

  public startRun(options: StartRunOptions = {}): void {
    const seasonTickBudget = Math.max(1, options.seasonTickBudget ?? this.defaultSeasonTickBudget);

    this.runGeneration += 1;
    this.clearScheduledTick();
    this.isPaused = false;
    this.isTickExecuting = false;
    this.currentRunOutcome = null;
    this.stepMetrics.length = 0;
    this.lastTickRecord = null;
    this.lifecycleState = 'STARTING';

    if ('clearQueue' in this.eventBus) {
      this.eventBus.clearQueue();
    }

    this.decisionTimer.reset();
    this.timeEngine.reset();
    this.timeEngine.setSeasonBudget(seasonTickBudget);
    this.timeEngine.setDecisionWindowCount(0);

    const startedPayload = {
      lifecycleState: this.lifecycleState,
      seasonTickBudget,
      tickIndex: 0,
      tickTier: this.timeEngine.getCurrentTier(),
      tickDurationMs: this.timeEngine.getTickDurationMs(),
      timestamp: this.clock.now(),
    };

    this.eventBus.emit('RUN_STARTED' as never, startedPayload as never);
    this.eventBus.flush();
    this.lifecycleState = 'ACTIVE';

    void this.resolveStoreDispatch().then((store) => {
      store?.onRunStarted?.(seasonTickBudget);
    });

    this.scheduleNextTick(options.immediateFirstTick === true ? 0 : this.timeEngine.getTickDurationMs());
  }

  public pause(): void {
    if (this.lifecycleState !== 'ACTIVE') return;
    this.isPaused = true;
    this.clearScheduledTick();
  }

  public resume(): void {
    if (this.lifecycleState !== 'ACTIVE' || !this.isPaused) return;
    this.isPaused = false;
    this.scheduleNextTick(this.timeEngine.getTickDurationMs());
  }

  public endRun(reason: RunOutcome = 'ABANDONED'): void {
    if (this.lifecycleState === 'ENDED' || this.lifecycleState === 'ENDING') {
      return;
    }

    this.lifecycleState = 'ENDING';
    this.clearScheduledTick();
    this.isPaused = false;
    this.isTickExecuting = false;
    this.currentRunOutcome = reason;

    this.timeEngine.completeRun(reason === 'ABANDONED' ? 'ABANDONED' : reason === 'TIMEOUT' ? 'TIMEOUT' : 'RUN_ENDED');
    this.timeEngine.setDecisionWindowCount(0);
    this.decisionTimer.reset();

    this.eventBus.emit('RUN_ENDED' as never, {
      outcome: reason,
      tickIndex: this.timeEngine.getTickIndex(),
      tickTier: this.timeEngine.getCurrentTier(),
      ticksRemaining: this.timeEngine.getTicksRemaining(),
      timestamp: this.clock.now(),
    } as never);
    this.eventBus.flush();

    void this.resolveStoreDispatch().then((store) => {
      store?.onRunEnded?.();
    });

    this.lifecycleState = 'ENDED';
  }

  public reset(): void {
    this.endRun('ABANDONED');
    this.eventBus.reset();
    this.listenerTeardowns.splice(0).forEach((fn) => fn());
    this.registerEventListeners();
    this.lifecycleState = 'IDLE';
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Public decision-window actions
  // ───────────────────────────────────────────────────────────────────────────

  public onForcedCardEntersPlay(windowId: string, durationMs: number, optionCount: number): void {
    this.decisionTimer.registerDecisionWindow(windowId, durationMs, optionCount);
    this.syncDecisionWindowCount();
  }

  public applyHold(windowId: string): boolean {
    const applied = this.decisionTimer.applyHold(windowId);
    this.syncDecisionWindowCount();
    return applied;
  }

  public resolveDecisionWindow(windowId: string, optionIndex: number): void {
    this.decisionTimer.resolveDecisionWindow(windowId, optionIndex);
    this.syncDecisionWindowCount();
  }

  public nullifyDecisionWindow(windowId: string): void {
    this.decisionTimer.nullifyWindow(windowId);
    this.syncDecisionWindowCount();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Public tick execution
  // ───────────────────────────────────────────────────────────────────────────

  public executeTick(): TickExecutionRecord | null {
    if (this.lifecycleState !== 'ACTIVE' || this.isPaused || this.isTickExecuting) {
      return null;
    }

    this.isTickExecuting = true;
    this.lifecycleState = 'TICK_LOCKED';
    this.stepMetrics.length = 0;

    const nextTickIndex = this.timeEngine.getTickIndex() + 1;
    const tickDurationMs = this.timeEngine.getTickDurationMs();
    const currentTierForDiag = this.timeEngine.getCurrentTier() as import('./types').TickTier | null;
    if (this.diagnosticsEnabled) {
      this.diagnostics.onTickScheduled(nextTickIndex, tickDurationMs, currentTierForDiag);
      this.diagnostics.onTickStarted();
    }

    const attacksFired: unknown[] = [];
    const damageResults: unknown[] = [];
    const cascadeEffects: unknown[] = [];
    const recoveryResults: unknown[] = [];

    try {
      this.eventBus.setTickContext(nextTickIndex);

      const preSnapshot = this.captureSnapshot();

      this.runStep('STEP_01_TIME_ADVANCE', () => {
        this.timeEngine.advanceTick({
          tick: preSnapshot.tickIndex,
          pressureScore: preSnapshot.pressureScore,
          tickTier: preSnapshot.tickTier,
        });
        this.syncDecisionWindowCount();
      });

      const pressureScore = this.runStep('STEP_02_PRESSURE_COMPUTE', () => {
        if (this.engines.pressure?.computeScore) {
          return this.engines.pressure.computeScore(this.captureSnapshot());
        }
        return this.pressureReader?.getCurrentScore?.() ?? 0;
      }) ?? (this.pressureReader?.getCurrentScore?.() ?? 0);

      this.runStep('STEP_03_TENSION_UPDATE', () => {
        this.engines.tension?.updateQueue?.(this.captureSnapshot());
      });

      this.runStep('STEP_04_SHIELD_PASSIVE_DECAY', () => {
        this.engines.shield?.applyPassiveDecay?.(this.captureSnapshot());
      });

      this.runStep('STEP_05_BATTLE_EVALUATE', () => {
        this.engines.battle?.evaluateBotStates?.(this.captureSnapshot());
      });

      this.runStep('STEP_06_BATTLE_ATTACKS', () => {
        const emitted = this.engines.battle?.executeAttacks?.(this.captureSnapshot()) ?? [];
        attacksFired.push(...emitted);
      });

      this.runStep('STEP_07_SHIELD_APPLY_ATTACKS', () => {
        const results = this.engines.shield?.applyAttacks?.(this.captureSnapshot()) ?? [];
        damageResults.push(...results);
      });

      this.runStep('STEP_08_CASCADE_EXECUTE_LINKS', () => {
        const effects = this.engines.cascade?.executeScheduledLinks?.(this.captureSnapshot()) ?? [];
        cascadeEffects.push(...effects);
      });

      this.runStep('STEP_09_CASCADE_RECOVERY', () => {
        const results = this.engines.cascade?.checkRecoveryConditions?.(this.captureSnapshot()) ?? [];
        recoveryResults.push(...results);
      });

      const postActionPressure = this.runStep('STEP_10_PRESSURE_RECOMPUTE', () => {
        if (this.engines.pressure?.recomputePostActions) {
          return this.engines.pressure.recomputePostActions(this.captureSnapshot());
        }
        return this.pressureReader?.getCurrentScore?.() ?? pressureScore;
      }) ?? pressureScore;

      this.runStep('STEP_11_TIME_SET_TIER', () => {
        this.timeEngine.setTierFromPressure(postActionPressure);
      });

      this.runStep('STEP_12_SOVEREIGNTY_SNAPSHOT', () => {
        this.engines.sovereignty?.snapshotTick?.(this.captureSnapshot());
      });

      const runOutcome = this.runStep('STEP_13_OUTCOME_RESOLUTION', () => this.outcomeResolver(this.captureSnapshot())) ?? null;

      const tickCompletePayload = {
        tickIndex: this.timeEngine.getTickIndex(),
        tickTier: this.timeEngine.getCurrentTier(),
        tickDurationMs: this.timeEngine.getTickDurationMs(),
        pressureScore,
        postActionPressure,
        activeDecisionWindows: this.decisionTimer.getActiveWindows().length,
        ticksRemaining: this.timeEngine.getTicksRemaining(),
        seasonBudget: this.timeEngine.getSeasonBudget(),
        timeoutImminent: this.timeEngine.isTimeoutImminent(),
        pendingEventCount: this.eventBus.getPendingCount(),
        timestamp: this.clock.now(),
      };

      if (this.diagnosticsEnabled) {
        this.diagnostics.onFlushStarted();
        this.diagnostics.onEventEmitted(this.eventBus.getPendingCount());
        this.diagnostics.onDecisionWindowCountUpdated(this.decisionTimer.getActiveWindows().length);
      }

      this.eventBus.emit('TICK_COMPLETE' as never, tickCompletePayload as never);
      this.eventBus.flush();

      if (this.diagnosticsEnabled) {
        this.diagnostics.onTickCompleted();
      }

      this.lastTickRecord = {
        tickIndex: this.timeEngine.getTickIndex(),
        pressureScore,
        postActionPressure,
        attacksFired,
        damageResults,
        cascadeEffects,
        recoveryResults,
        runOutcome,
        tickDurationMs: this.timeEngine.getTickDurationMs(),
        activeDecisionWindows: this.decisionTimer.getActiveWindows().length,
      };

      if (runOutcome !== null) {
        this.endRun(runOutcome);
      } else if (this.timeEngine.getTicksRemaining() <= 0) {
        this.endRun('TIMEOUT');
      } else {
        this.lifecycleState = 'ACTIVE';
      }

      return this.lastTickRecord;
    } finally {
      this.isTickExecuting = false;

      if (this.lifecycleState === 'ACTIVE' && !this.isPaused) {
        this.scheduleNextTick(this.timeEngine.getTickDurationMs());
      }
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Public reads
  // ───────────────────────────────────────────────────────────────────────────

  public getLifecycleState(): RunLifecycleState {
    return this.lifecycleState;
  }

  public getLastTickRecord(): TickExecutionRecord | null {
    return this.lastTickRecord;
  }

  public getDiagnostics(): ReadonlyArray<StepMetric> {
    return [...this.stepMetrics];
  }

  public getTimeEngine(): TimeEngine {
    return this.timeEngine;
  }

  public getDecisionTimer(): DecisionTimer {
    return this.decisionTimer;
  }

  /**
   * Returns the current OrchestratorSnapshot (a read-only structural view of live
   * orchestrator state). Safe to call at any time — never mutates internal state.
   */
  public getSnapshot(): OrchestratorSnapshot {
    return this.captureSnapshot();
  }

  /**
   * Replaces the engine bundle at runtime. Safe to call between ticks (not
   * while isTickExecuting). Calling mid-tick has no effect on the current tick.
   */
  public registerEngines(bundle: EngineBundle): void {
    this.engines = { ...this.engines, ...bundle };
  }

  /**
   * Returns a frozen copy of the current engine bundle. Useful in tests to
   * verify which engines are wired to the orchestrator.
   */
  public getEngineBundle(): Readonly<EngineBundle> {
    return Object.freeze({ ...this.engines });
  }

  /**
   * Returns the OrchestratorDiagnostics snapshot. Only populated when
   * enableDiagnostics was not set to false in config.
   */
  public getDiagnosticsSnapshot(): ReturnType<OrchestratorDiagnostics['getSnapshot']> | null {
    if (!this.diagnosticsEnabled) return null;
    return this.diagnostics.getSnapshot();
  }

  /**
   * Returns the injected ClockSource so consumers can inspect which clock
   * implementation is active (wall vs fixed vs manual).
   */
  public getClockSource(): ClockSource {
    return this.clock;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Internal helpers
  // ───────────────────────────────────────────────────────────────────────────

  private runStep<T>(step: string, fn: () => T): T | null {
    const startedAtMs = this.clock.now();
    try {
      const result = fn();
      const endedAtMs = this.clock.now();
      const durationMs = endedAtMs - startedAtMs;
      this.stepMetrics.push({
        step,
        startedAtMs,
        endedAtMs,
        durationMs,
        ok: true,
        errorMessage: null,
      });
      if (this.diagnosticsEnabled) {
        this.diagnostics.onStepCompleted(step as OrchestratorStepName, durationMs);
      }
      return result;
    } catch (error) {
      const endedAtMs = this.clock.now();
      const durationMs = endedAtMs - startedAtMs;
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.stepMetrics.push({
        step,
        startedAtMs,
        endedAtMs,
        durationMs,
        ok: false,
        errorMessage,
      });
      this.eventBus.emit('TICK_STEP_ERROR' as never, {
        step,
        errorMessage,
        tickIndex: this.timeEngine.getTickIndex() + 1,
        timestamp: endedAtMs,
      } as never);
      return null;
    }
  }

  private captureSnapshot(): OrchestratorSnapshot {
    const pressureScore = this.pressureReader?.getCurrentScore?.() ?? 0;
    const pressureTier = this.pressureReader?.getCurrentTier?.() ?? null;

    return {
      tickIndex: this.timeEngine.getTickIndex(),
      tickTier: this.timeEngine.getCurrentTier(),
      tickDurationMs: this.timeEngine.getTickDurationMs(),
      pressureScore,
      pressureTier,
      seasonBudget: this.timeEngine.getSeasonBudget(),
      ticksRemaining: this.timeEngine.getTicksRemaining(),
      timeoutImminent: this.timeEngine.isTimeoutImminent(),
      activeDecisionWindows: this.decisionTimer.getActiveWindows().length,
      pendingEventCount: this.eventBus.getPendingCount(),
      runtime: this.snapshotProvider(),
    };
  }

  private scheduleNextTick(delayMs: number): void {
    this.clearScheduledTick();

    const generationAtSchedule = this.runGeneration;
    const safeDelay = Math.max(0, Math.floor(delayMs));

    this.tickTimer = setTimeout(() => {
      if (generationAtSchedule !== this.runGeneration) return;
      void this.executeTick();
    }, safeDelay);
  }

  private clearScheduledTick(): void {
    if (this.tickTimer !== null) {
      clearTimeout(this.tickTimer);
      this.tickTimer = null;
    }
  }

  private syncDecisionWindowCount(): void {
    this.timeEngine.setDecisionWindowCount(this.decisionTimer.getActiveWindows().length);
  }

  private registerEventListeners(): void {
    const on = <T = unknown>(eventName: string, handler: (event: T) => void): void => {
      const teardown = this.eventBus.on(eventName as never, handler as never);
      this.listenerTeardowns.push(teardown);
    };

    on('decision:window_opened', (event) => {
      const payload = this.unwrapDecisionPayload<Record<string, unknown>>(event);
      this.syncDecisionWindowCount();
      void this.resolveStoreDispatch().then((store) => {
        store?.onDecisionWindowOpened?.(payload);
      });
    });

    on('decision:resolved', (event) => {
      const payload = this.unwrapDecisionPayload<{ windowId?: string }>(event);
      this.syncDecisionWindowCount();
      if (payload.windowId) {
        void this.resolveStoreDispatch().then((store) => {
          store?.onDecisionWindowClosed?.(payload.windowId!);
        });
      }
    });

    on('decision:countdown_tick', (event) => {
      const payload = this.unwrapDecisionPayload<Record<string, number>>(event);
      void this.resolveStoreDispatch().then((store) => {
        store?.onDecisionWindowTick?.(payload);
      });
    });

    on('decision:hold_applied', (event) => {
      const payload = this.unwrapDecisionPayload<{ windowId?: string }>(event);
      void this.resolveStoreDispatch().then((store) => {
        if (payload.windowId) {
          store?.onHoldUsed?.(payload.windowId, 0);
        }
      });
    });

    on('TICK_COMPLETE', (event) => {
      const payload = this.unwrapEventPayload(event);
      void this.resolveStoreDispatch().then((store) => {
        store?.onTickComplete?.(payload);
      });
    });

    on('TICK_TIER_CHANGED', (event) => {
      const payload = this.unwrapEventPayload<{ from?: string; to?: string }>(event);
      if (this.diagnosticsEnabled && payload?.to) {
        const from = (payload.from ?? null) as import('./types').TickTier | null;
        const to = payload.to as import('./types').TickTier;
        this.diagnostics.onTierChanged(from, to);
      }
      void this.resolveStoreDispatch().then((store) => {
        store?.onTierChanged?.(payload);
      });
    });

    on('RUN_ENDED', () => {
      void this.resolveStoreDispatch().then((store) => {
        store?.onRunEnded?.();
      });
    });
  }

  private unwrapEventPayload<T = unknown>(event: unknown): T {
    if (event && typeof event === 'object' && 'payload' in (event as Record<string, unknown>)) {
      return (event as { payload: T }).payload;
    }
    return event as T;
  }

  private unwrapDecisionPayload<T = unknown>(event: unknown): T {
    const outer = this.unwrapEventPayload<unknown>(event);
    if (outer && typeof outer === 'object' && 'payload' in (outer as Record<string, unknown>)) {
      return (outer as { payload: T }).payload;
    }
    return outer as T;
  }

  private async resolveStoreDispatch(): Promise<StoreDispatchAdapter | null> {
    if (this.storeDispatchPromise) {
      return this.storeDispatchPromise;
    }

    this.storeDispatchPromise = (async () => {
      const candidates = await Promise.allSettled([
        import('../../store/slices/timeSlice'),
        import('../../store/engineStore'),
      ]);

      for (const candidate of candidates) {
        if (candidate.status !== 'fulfilled') continue;
        const mod = candidate.value as Record<string, unknown>;

        const maybeHook =
          (mod.useTimeEngineStore as { getState?: () => Record<string, unknown> } | undefined) ??
          (mod.useEngineStore as { getState?: () => Record<string, unknown> } | undefined);

        if (!maybeHook?.getState) continue;

        const getState = (): Record<string, unknown> => maybeHook.getState!();

        const invoke = (...names: string[]) => {
          return (...args: unknown[]) => {
            const state = getState();
            for (const name of names) {
              const fn = state[name];
              if (typeof fn === 'function') {
                (fn as (...inner: unknown[]) => void)(...args);
                return;
              }
            }
          };
        };

        return {
          onRunStarted: invoke('onRunStarted', 'time_runStarted', 'runStarted'),
          onRunEnded: invoke('onRunEnded', 'time_runEnded', 'runEnded'),
          onTickComplete: invoke('onTickComplete', 'time_onTickComplete', 'applyTickComplete'),
          onTierChanged: invoke('onTierChanged', 'time_onTierChanged', 'applyTierChanged'),
          onDecisionWindowOpened: invoke('onDecisionWindowOpened', 'time_onDecisionWindowOpened', 'addDecisionWindow'),
          onDecisionWindowClosed: invoke('onDecisionWindowClosed', 'clearDecisionWindowTick', 'removeDecisionWindow'),
          onDecisionWindowTick: invoke('onDecisionWindowTick', 'time_onDecisionWindowTick', 'applyDecisionWindowTick'),
          onHoldUsed: invoke('onHoldUsed', 'time_onHoldUsed', 'markDecisionWindowHoldUsed'),
        } satisfies StoreDispatchAdapter;
      }

      return null;
    })();

    return this.storeDispatchPromise;
  }
}

export default EngineOrchestrator;
