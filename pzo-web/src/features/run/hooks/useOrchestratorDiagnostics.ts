// pzo-web/src/features/run/hooks/useOrchestratorDiagnostics.ts

/**
 * ============================================================================
 * POINT ZERO ONE — ENGINE 0 ORCHESTRATOR DIAGNOSTICS HOOK
 * FILE: pzo-web/src/features/run/hooks/useOrchestratorDiagnostics.ts
 * ============================================================================
 *
 * Purpose:
 * - expose a production-grade diagnostics surface for Engine 0 consumers
 * - preserve repo-specific event flow: EventBus -> store bindings -> React hooks
 * - support BOTH lanes:
 *   1) provider-backed diagnostics from EngineOrchestrator / ZeroFacade / devtools
 *   2) fallback diagnostics synthesized from the current store + EventBus contracts
 *
 * Doctrine:
 * - no direct engine-to-engine coupling
 * - no store mutation from this hook
 * - no assumption that orchestrator already exposes diagnostics methods
 * - diagnostics must remain additive and non-authoritative over gameplay state
 * ============================================================================
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useEngineStore } from '../../../store/engineStore';
import { useRunStore } from '../../../store/runStore';
import { sharedEventBus } from '../../../engines/core/EventBus';
import type {
  OrchestratorAlert,
  OrchestratorDiagnosticsSnapshot,
  OrchestratorStepName,
  TickWindowSample,
} from '../../../engines/core/OrchestratorDiagnostics';
import type {
  EngineHealth,
  EngineId,
  RunLifecycleState,
  RunOutcome,
  TickTier,
} from '../../../engines/zero/types';

/* ============================================================================
 * PUBLIC TYPES
 * ============================================================================
 */

export interface DiagnosticsThresholds {
  maxAllowedDriftMs: number;
  maxAllowedFlushMs: number;
  maxAllowedSingleStepMs: number;
  maxAllowedOpenDecisionWindows: number;
  maxAllowedEventsPerTick: number;
  maxTickStalenessMs: number;
  tierOscillationWindow: number;
  tierOscillationTripCount: number;
}

export interface OrchestratorDiagnosticsProviderLike {
  getDiagnosticsSnapshot?: () => OrchestratorDiagnosticsSnapshot;
  getDiagnostics?: () => OrchestratorDiagnosticsSnapshot;
  getOrchestratorDiagnosticsSnapshot?: () => OrchestratorDiagnosticsSnapshot;
  getDiagnosticsInstance?: () => {
    getSnapshot: () => OrchestratorDiagnosticsSnapshot;
    getLastTickCompletedAtMs?: () => number | null;
  };
  subscribeDiagnostics?: (
    listener: (snapshot: OrchestratorDiagnosticsSnapshot) => void,
  ) => (() => void) | void;
}

export interface UseOrchestratorDiagnosticsOptions {
  provider?: OrchestratorDiagnosticsProviderLike | null;
  refreshIntervalMs?: number;
  thresholds?: Partial<DiagnosticsThresholds>;
  historySize?: number;
}

export interface DerivedDiagnosticsStatus {
  isProviderBacked: boolean;
  isFallbackBacked: boolean;
  isTickStale: boolean;
  hasAlerts: boolean;
  hasEngineErrors: boolean;
  hasSlowFlush: boolean;
  hasHighDrift: boolean;
  hasWindowBacklog: boolean;
  hasTierOscillation: boolean;
  hasRunawayEventVolume: boolean;
  lifecycleState: RunLifecycleState;
  isRunActive: boolean;
  isTickLocked: boolean;
  lastTickAgeMs: number | null;
  healthyEngineCount: number;
  erroredEngineCount: number;
  degradedEngineIds: EngineId[];
}

export interface UseOrchestratorDiagnosticsResult {
  snapshot: OrchestratorDiagnosticsSnapshot;
  status: DerivedDiagnosticsStatus;
  alerts: OrchestratorAlert[];
  lastTick: TickWindowSample | null;
  healthReport: Partial<Record<EngineId, EngineHealth>> | null;
  refresh: () => void;
  resetFallbackRuntime: () => void;
  source: 'provider' | 'fallback';
}

/* ============================================================================
 * CONSTANTS
 * ============================================================================
 */

const DEFAULT_THRESHOLDS: DiagnosticsThresholds = {
  maxAllowedDriftMs: 150,
  maxAllowedFlushMs: 32,
  maxAllowedSingleStepMs: 24,
  maxAllowedOpenDecisionWindows: 8,
  maxAllowedEventsPerTick: 128,
  maxTickStalenessMs: 5_000,
  tierOscillationWindow: 8,
  tierOscillationTripCount: 4,
};

const DIAGNOSTIC_EVENT_NAMES = [
  'RUN_STARTED',
  'RUN_ENDED',
  'TICK_START',
  'TICK_COMPLETE',
  'TICK_TIER_CHANGED',
  'TICK_TIER_FORCED',
  'DECISION_WINDOW_OPENED',
  'DECISION_WINDOW_EXPIRED',
  'DECISION_WINDOW_RESOLVED',
  'SEASON_TIMEOUT_IMMINENT',
  'PRESSURE_TIER_CHANGED',
  'PRESSURE_CRITICAL',
  'PRESSURE_SCORE_UPDATED',
  'TENSION_SCORE_UPDATED',
  'ANTICIPATION_PULSE',
  'THREAT_VISIBILITY_CHANGED',
  'THREAT_QUEUED',
  'THREAT_ARRIVED',
  'THREAT_MITIGATED',
  'THREAT_EXPIRED',
  'SHIELD_LAYER_DAMAGED',
  'SHIELD_LAYER_BREACHED',
  'SHIELD_REPAIRED',
  'SHIELD_PASSIVE_REGEN',
  'BOT_STATE_CHANGED',
  'BOT_ATTACK_FIRED',
  'BOT_NEUTRALIZED',
  'COUNTER_INTEL_AVAILABLE',
  'BATTLE_BUDGET_UPDATED',
  'CASCADE_CHAIN_TRIGGERED',
  'CASCADE_LINK_FIRED',
  'CASCADE_CHAIN_BROKEN',
  'CASCADE_CHAIN_COMPLETED',
  'POSITIVE_CASCADE_ACTIVATED',
  'RUN_COMPLETED',
  'RUN_REWARD_DISPATCHED',
  'PROOF_ARTIFACT_READY',
  'PROOF_VERIFICATION_FAILED',
  'ENGINE_ERROR',
  'TICK_STEP_ERROR',
] as const;

const EMPTY_SNAPSHOT: OrchestratorDiagnosticsSnapshot = {
  generatedAt: Date.now(),
  totalTicksObserved: 0,
  lastTickIndex: 0,
  currentTier: null,
  avgScheduledDurationMs: 0,
  avgActualDurationMs: 0,
  avgDriftMs: 0,
  maxDriftMs: 0,
  avgFlushDurationMs: 0,
  maxFlushDurationMs: 0,
  maxSingleStepMs: 0,
  totalEventsObserved: 0,
  avgEventsPerTick: 0,
  maxOpenDecisionWindowCount: 0,
  tierTransitionCount: 0,
  recentTierSequence: [],
  alerts: [],
  lastTick: null,
};

/* ============================================================================
 * HELPERS
 * ============================================================================
 */

function clampMin(value: number, min: number): number {
  return Number.isFinite(value) ? Math.max(min, value) : min;
}

function safeAvg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function nowMs(): number {
  return Date.now();
}

function mergeThresholds(
  overrides?: Partial<DiagnosticsThresholds>,
): DiagnosticsThresholds {
  return {
    ...DEFAULT_THRESHOLDS,
    ...overrides,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readProviderSnapshot(
  provider?: OrchestratorDiagnosticsProviderLike | null,
): OrchestratorDiagnosticsSnapshot | null {
  if (!provider) return null;

  try {
    if (provider.getDiagnosticsSnapshot) {
      return provider.getDiagnosticsSnapshot();
    }

    if (provider.getOrchestratorDiagnosticsSnapshot) {
      return provider.getOrchestratorDiagnosticsSnapshot();
    }

    if (provider.getDiagnostics) {
      return provider.getDiagnostics();
    }

    if (provider.getDiagnosticsInstance) {
      const instance = provider.getDiagnosticsInstance();
      if (instance && typeof instance.getSnapshot === 'function') {
        return instance.getSnapshot();
      }
    }
  } catch {
    return null;
  }

  return null;
}

function buildHealthReportFromStore(): Partial<Record<EngineId, EngineHealth>> | null {
  const state = useEngineStore.getState();
  const report = state.run.healthReport;
  if (!report) return null;
  return report;
}

function buildLifecycleStateFromStore(): RunLifecycleState {
  return useEngineStore.getState().run.lifecycleState;
}

function buildRunActiveFromStore(): boolean {
  const state = useEngineStore.getState();
  return Boolean(
    state.time.isRunActive ||
      state.tension.isRunActive ||
      state.shield.isRunActive ||
      state.battle.isRunActive ||
      state.cascade.isRunActive ||
      state.sovereignty.isRunActive ||
      state.run.lifecycleState === 'ACTIVE' ||
      state.run.lifecycleState === 'TICK_LOCKED',
  );
}

function buildFallbackAlert(
  code: OrchestratorAlert['code'],
  message: string,
  tickIndex: number,
  metadata?: Record<string, unknown>,
): OrchestratorAlert {
  return {
    code,
    message,
    tickIndex,
    metadata,
  };
}

function computeMaxSingleStepMs(
  samples: TickWindowSample[],
): number {
  let max = 0;

  for (const sample of samples) {
    const values = Object.values(sample.stepDurationsMs ?? {});
    for (const value of values) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        max = Math.max(max, value);
      }
    }
  }

  return max;
}

function copyStepDurations(
  source?: Partial<Record<OrchestratorStepName, number>>,
): Partial<Record<OrchestratorStepName, number>> {
  return source ? { ...source } : {};
}

/* ============================================================================
 * FALLBACK RUNTIME
 * ============================================================================
 */

interface TickStartRecord {
  tickIndex: number;
  scheduledDurationMs: number;
  tier: TickTier | null;
  startedAtMs: number;
}

class FallbackDiagnosticsRuntime {
  private readonly history: TickWindowSample[] = [];
  private readonly alerts: OrchestratorAlert[] = [];
  private readonly recentTierSequence: TickTier[] = [];
  private readonly subscribers = new Set<() => void>();
  private readonly eventCountByTick = new Map<number, number>();
  private readonly stepErrorsByTick = new Map<
    number,
    Array<{ step: number; engineId?: EngineId; error: string; timestamp: number }>
  >();

  private thresholds: DiagnosticsThresholds = DEFAULT_THRESHOLDS;
  private maxHistory = 256;
  private wired = false;
  private unsubs: Array<() => void> = [];
  private lastTickStart: TickStartRecord | null = null;
  private tierTransitionCount = 0;
  private lastSnapshot: OrchestratorDiagnosticsSnapshot = {
    ...EMPTY_SNAPSHOT,
  };

  public configure(
    thresholds: DiagnosticsThresholds,
    historySize: number,
  ): void {
    this.thresholds = thresholds;
    this.maxHistory = clampMin(historySize, 32);
  }

  public subscribe(listener: () => void): () => void {
    this.ensureWired();
    this.subscribers.add(listener);

    return () => {
      this.subscribers.delete(listener);
    };
  }

  public getSnapshot(): OrchestratorDiagnosticsSnapshot {
    this.ensureWired();
    return this.lastSnapshot;
  }

  public reset(): void {
    this.history.length = 0;
    this.alerts.length = 0;
    this.recentTierSequence.length = 0;
    this.eventCountByTick.clear();
    this.stepErrorsByTick.clear();
    this.lastTickStart = null;
    this.tierTransitionCount = 0;
    this.lastSnapshot = {
      ...EMPTY_SNAPSHOT,
      generatedAt: nowMs(),
    };
    this.emit();
  }

  private ensureWired(): void {
    if (this.wired) return;
    this.wired = true;

    for (const eventName of DIAGNOSTIC_EVENT_NAMES) {
      const unsub = sharedEventBus.on(
        eventName as never,
        ((event: any) => {
          this.onAnyEvent(eventName, event);
        }) as never,
      );

      this.unsubs.push(unsub);
    }
  }

  private onAnyEvent(eventName: string, event: any): void {
    const tickIndex =
      typeof event?.tickIndex === 'number'
        ? event.tickIndex
        : useEngineStore.getState().run.lastTickIndex;

    if (typeof tickIndex === 'number' && Number.isFinite(tickIndex)) {
      this.eventCountByTick.set(
        tickIndex,
        (this.eventCountByTick.get(tickIndex) ?? 0) + 1,
      );
    }

    switch (eventName) {
      case 'TICK_START': {
        const payload = event?.payload ?? {};
        this.lastTickStart = {
          tickIndex:
            typeof payload.tickIndex === 'number'
              ? payload.tickIndex
              : useEngineStore.getState().run.lastTickIndex,
          scheduledDurationMs:
            typeof payload.tickDurationMs === 'number'
              ? payload.tickDurationMs
              : useEngineStore.getState().time.currentTickDurationMs,
          tier: useEngineStore.getState().time.currentTier,
          startedAtMs: nowMs(),
        };
        break;
      }

      case 'TICK_TIER_CHANGED': {
        const payload = event?.payload ?? {};
        const nextTier = payload?.to as TickTier | undefined;
        if (nextTier) {
          this.tierTransitionCount += 1;
          this.recentTierSequence.push(nextTier);

          while (
            this.recentTierSequence.length >
            this.thresholds.tierOscillationWindow
          ) {
            this.recentTierSequence.shift();
          }

          let changes = 0;
          for (let i = 1; i < this.recentTierSequence.length; i += 1) {
            if (this.recentTierSequence[i] !== this.recentTierSequence[i - 1]) {
              changes += 1;
            }
          }

          if (changes >= this.thresholds.tierOscillationTripCount) {
            this.pushAlert(
              buildFallbackAlert(
                'TIER_OSCILLATION',
                'Tick tier is oscillating too frequently across recent ticks.',
                tickIndex,
                {
                  recentTierSequence: [...this.recentTierSequence],
                  changes,
                },
              ),
            );
          }
        }
        break;
      }

      case 'TICK_STEP_ERROR': {
        const payload = event?.payload ?? {};
        const next = this.stepErrorsByTick.get(tickIndex) ?? [];
        next.push({
          step: typeof payload.step === 'number' ? payload.step : -1,
          engineId: payload.engineId as EngineId | undefined,
          error:
            typeof payload.error === 'string'
              ? payload.error
              : 'Unknown step error.',
          timestamp: nowMs(),
        });
        this.stepErrorsByTick.set(tickIndex, next);

        this.pushAlert(
          buildFallbackAlert(
            'SLOW_STEP',
            `Tick step ${String(payload.step ?? '?')} reported an execution error.`,
            tickIndex,
            {
              engineId: payload.engineId,
              error: payload.error,
              step: payload.step,
            },
          ),
        );
        break;
      }

      case 'ENGINE_ERROR': {
        const payload = event?.payload ?? {};
        this.pushAlert(
          buildFallbackAlert(
            'SLOW_STEP',
            `Engine ${String(payload.engineId ?? 'UNKNOWN')} reported an error.`,
            tickIndex,
            {
              engineId: payload.engineId,
              error: payload.error,
              step: payload.step,
            },
          ),
        );
        break;
      }

      case 'TICK_COMPLETE': {
        const payload = event?.payload ?? {};
        const store = useEngineStore.getState();
        const actualDurationMs =
          typeof payload.tickDurationMs === 'number'
            ? payload.tickDurationMs
            : store.run.lastTickDurationMs;

        const scheduledDurationMs =
          this.lastTickStart?.tickIndex === tickIndex
            ? this.lastTickStart.scheduledDurationMs
            : store.time.currentTickDurationMs;

        const emittedEventCount = this.eventCountByTick.get(tickIndex) ?? 0;
        const openDecisionWindowCount = store.time.activeDecisionWindows.length;

        const sample: TickWindowSample = {
          tickIndex,
          tier:
            (store.time.currentTier as TickTier | null) ??
            this.lastTickStart?.tier ??
            null,
          scheduledDurationMs,
          actualDurationMs,
          driftMs: actualDurationMs - scheduledDurationMs,
          stepDurationsMs: {},
          flushDurationMs: 0,
          emittedEventCount,
          openDecisionWindowCount,
          timestamp: nowMs(),
        };

        this.history.push(sample);
        while (this.history.length > this.maxHistory) {
          this.history.shift();
        }

        if (
          Math.abs(sample.driftMs) > this.thresholds.maxAllowedDriftMs
        ) {
          this.pushAlert(
            buildFallbackAlert(
              'HIGH_TICK_DRIFT',
              'Actual tick wall time drifted too far from scheduled duration.',
              tickIndex,
              {
                actualDurationMs: sample.actualDurationMs,
                scheduledDurationMs: sample.scheduledDurationMs,
                driftMs: sample.driftMs,
              },
            ),
          );
        }

        if (
          sample.openDecisionWindowCount >
          this.thresholds.maxAllowedOpenDecisionWindows
        ) {
          this.pushAlert(
            buildFallbackAlert(
              'WINDOW_BACKLOG',
              'Open decision window backlog exceeded configured threshold.',
              tickIndex,
              {
                openDecisionWindowCount: sample.openDecisionWindowCount,
                threshold: this.thresholds.maxAllowedOpenDecisionWindows,
              },
            ),
          );
        }

        if (
          sample.emittedEventCount > this.thresholds.maxAllowedEventsPerTick
        ) {
          this.pushAlert(
            buildFallbackAlert(
              'RUNAWAY_EVENT_VOLUME',
              'Per-tick event volume exceeded configured threshold.',
              tickIndex,
              {
                emittedEventCount: sample.emittedEventCount,
                threshold: this.thresholds.maxAllowedEventsPerTick,
              },
            ),
          );
        }

        this.lastTickStart = null;
        break;
      }

      default:
        break;
    }

    this.lastSnapshot = this.buildSnapshot();
    this.emit();
  }

  private buildSnapshot(): OrchestratorDiagnosticsSnapshot {
    const scheduledValues = this.history.map((sample) => sample.scheduledDurationMs);
    const actualValues = this.history.map((sample) => sample.actualDurationMs);
    const driftValues = this.history.map((sample) => sample.driftMs);
    const flushValues = this.history.map((sample) => sample.flushDurationMs);
    const eventValues = this.history.map((sample) => sample.emittedEventCount);

    return {
      generatedAt: nowMs(),
      totalTicksObserved: this.history.length,
      lastTickIndex:
        this.history.length > 0
          ? this.history[this.history.length - 1].tickIndex
          : useEngineStore.getState().run.lastTickIndex,
      currentTier:
        (useEngineStore.getState().time.currentTier as TickTier | null) ?? null,
      avgScheduledDurationMs: safeAvg(scheduledValues),
      avgActualDurationMs: safeAvg(actualValues),
      avgDriftMs: safeAvg(driftValues),
      maxDriftMs:
        driftValues.length > 0
          ? Math.max(...driftValues.map((value) => Math.abs(value)))
          : 0,
      avgFlushDurationMs: safeAvg(flushValues),
      maxFlushDurationMs:
        flushValues.length > 0 ? Math.max(...flushValues) : 0,
      maxSingleStepMs: computeMaxSingleStepMs(this.history),
      totalEventsObserved: eventValues.reduce((sum, value) => sum + value, 0),
      avgEventsPerTick: safeAvg(eventValues),
      maxOpenDecisionWindowCount:
        this.history.length > 0
          ? Math.max(...this.history.map((sample) => sample.openDecisionWindowCount))
          : 0,
      tierTransitionCount: this.tierTransitionCount,
      recentTierSequence: [...this.recentTierSequence],
      alerts: [...this.alerts],
      lastTick:
        this.history.length > 0 ? this.history[this.history.length - 1] : null,
    };
  }

  private pushAlert(alert: OrchestratorAlert): void {
    this.alerts.push(alert);
    while (this.alerts.length > 64) {
      this.alerts.shift();
    }
  }

  private emit(): void {
    for (const listener of this.subscribers) {
      listener();
    }
  }
}

const fallbackRuntime = new FallbackDiagnosticsRuntime();

/* ============================================================================
 * HOOK
 * ============================================================================
 */

export function useOrchestratorDiagnostics(
  options: UseOrchestratorDiagnosticsOptions = {},
): UseOrchestratorDiagnosticsResult {
  const thresholds = useMemo(
    () => mergeThresholds(options.thresholds),
    [options.thresholds],
  );

  const refreshIntervalMs = clampMin(options.refreshIntervalMs ?? 250, 50);
  const historySize = clampMin(options.historySize ?? 256, 32);

  const providerRef = useRef<OrchestratorDiagnosticsProviderLike | null>(
    options.provider ?? null,
  );

  providerRef.current = options.provider ?? null;

  const lifecycleState = useEngineStore((state) => state.run.lifecycleState);
  const healthReport = useEngineStore((state) => state.run.healthReport);
  const time = useEngineStore((state) => state.time);
  const run = useEngineStore((state) => state.run);
  const runMirror = useRunStore((state) => ({
    lastUpdated: state.lastUpdated,
    isInitialized: state.isInitialized,
  }));

  const [fallbackSnapshot, setFallbackSnapshot] = useState<OrchestratorDiagnosticsSnapshot>(() => {
    fallbackRuntime.configure(thresholds, historySize);
    return fallbackRuntime.getSnapshot();
  });

  const [providerSnapshot, setProviderSnapshot] =
    useState<OrchestratorDiagnosticsSnapshot | null>(() =>
      readProviderSnapshot(providerRef.current),
    );

  useEffect(() => {
    fallbackRuntime.configure(thresholds, historySize);
    setFallbackSnapshot(fallbackRuntime.getSnapshot());
  }, [thresholds, historySize]);

  useEffect(() => {
    return fallbackRuntime.subscribe(() => {
      setFallbackSnapshot(fallbackRuntime.getSnapshot());
    });
  }, []);

  useEffect(() => {
    const provider = providerRef.current;
    if (!provider) {
      setProviderSnapshot(null);
      return;
    }

    let cancelled = false;
    const publish = (snapshot: OrchestratorDiagnosticsSnapshot | null) => {
      if (!cancelled) setProviderSnapshot(snapshot);
    };

    publish(readProviderSnapshot(provider));

    const unsub =
      provider.subscribeDiagnostics?.((snapshot) => {
        publish(snapshot);
      }) ?? null;

    const interval = window.setInterval(() => {
      publish(readProviderSnapshot(provider));
    }, refreshIntervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      if (typeof unsub === 'function') unsub();
    };
  }, [options.provider, refreshIntervalMs]);

  const source: 'provider' | 'fallback' = providerSnapshot ? 'provider' : 'fallback';
  const snapshot = providerSnapshot ?? fallbackSnapshot;

  const alerts = snapshot.alerts;
  const lastTick = snapshot.lastTick;

  const lastTickAgeMs =
    lastTick?.timestamp != null ? Math.max(0, nowMs() - lastTick.timestamp) : null;

  const degradedEngineIds = useMemo(() => {
    if (!healthReport) return [];
    return (Object.keys(healthReport) as EngineId[]).filter(
      (engineId) => healthReport[engineId] === 'ERROR',
    );
  }, [healthReport]);

  const healthyEngineCount = useMemo(() => {
    if (!healthReport) return 0;
    return (Object.keys(healthReport) as EngineId[]).filter(
      (engineId) => healthReport[engineId] === 'INITIALIZED',
    ).length;
  }, [healthReport]);

  const erroredEngineCount = degradedEngineIds.length;

  const hasSlowFlush = alerts.some((alert) => alert.code === 'SLOW_FLUSH');
  const hasHighDrift = alerts.some((alert) => alert.code === 'HIGH_TICK_DRIFT');
  const hasWindowBacklog = alerts.some((alert) => alert.code === 'WINDOW_BACKLOG');
  const hasTierOscillation = alerts.some((alert) => alert.code === 'TIER_OSCILLATION');
  const hasRunawayEventVolume = alerts.some(
    (alert) => alert.code === 'RUNAWAY_EVENT_VOLUME',
  );

  const status: DerivedDiagnosticsStatus = {
    isProviderBacked: source === 'provider',
    isFallbackBacked: source === 'fallback',
    isTickStale:
      lastTickAgeMs !== null && lastTickAgeMs > thresholds.maxTickStalenessMs,
    hasAlerts: alerts.length > 0,
    hasEngineErrors: erroredEngineCount > 0,
    hasSlowFlush,
    hasHighDrift,
    hasWindowBacklog,
    hasTierOscillation,
    hasRunawayEventVolume,
    lifecycleState,
    isRunActive: buildRunActiveFromStore(),
    isTickLocked: lifecycleState === 'TICK_LOCKED',
    lastTickAgeMs,
    healthyEngineCount,
    erroredEngineCount,
    degradedEngineIds,
  };

  const refresh = useCallback(() => {
    const provider = providerRef.current;
    setProviderSnapshot(readProviderSnapshot(provider));
    setFallbackSnapshot(fallbackRuntime.getSnapshot());
  }, []);

  const resetFallbackRuntime = useCallback(() => {
    fallbackRuntime.reset();
    setFallbackSnapshot(fallbackRuntime.getSnapshot());
  }, []);

  return {
    snapshot,
    status,
    alerts,
    lastTick,
    healthReport: healthReport ?? buildHealthReportFromStore(),
    refresh,
    resetFallbackRuntime,
    source,
  };
}

export default useOrchestratorDiagnostics;