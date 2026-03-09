// pzo-web/src/telemetry/runTimeTelemetry.ts
import type { RunTimeSnapshot } from './RunTimeSnapshot.stub';
import {
  TICK_DURATION_MS_BY_TIER,
  coerceTickTierId,
  type TelemetryEnvelopeV2,
  type TickBudget,
  type TickTierId,
  type TimeEngineStateSnapshot,
  toTierAtEnd,
} from '../engines/time/types';
import { TimeEngineTelemetry } from './schemas/timeEngineTelemetry';

export interface TimeEngineReadable {
  getTickIndex(): number;
  getSeasonBudget(): number;
  getTicksRemaining(): number;
  getCurrentTier(): unknown;
  getTickDurationMs(): number;
  isTimeoutImminent(): boolean;
  getState(): Record<string, unknown>;
  getTelemetry(): Partial<TelemetryEnvelopeV2> & Record<string, unknown>;
}

function buildTickBudget(engine: TimeEngineReadable): TickBudget {
  const allocated = engine.getSeasonBudget();
  const consumed = engine.getTickIndex();
  const remaining = engine.getTicksRemaining();

  return {
    allocated,
    consumed,
    remaining,
  };
}

function normalizeState(engine: TimeEngineReadable): TimeEngineStateSnapshot {
  const state = engine.getState();
  const tickTier = coerceTickTierId(state.tickTier, coerceTickTierId(engine.getCurrentTier()));

  return {
    tickIndex: typeof state.tickIndex === 'number' ? state.tickIndex : engine.getTickIndex(),
    tickTier,
    tickDurationMs: typeof state.tickDurationMs === 'number'
      ? state.tickDurationMs
      : engine.getTickDurationMs(),
    seasonBudget: typeof state.seasonBudget === 'number'
      ? state.seasonBudget
      : engine.getSeasonBudget(),
    ticksRemaining: typeof state.ticksRemaining === 'number'
      ? state.ticksRemaining
      : engine.getTicksRemaining(),
    timeoutImminent: typeof state.timeoutImminent === 'boolean'
      ? state.timeoutImminent
      : engine.isTimeoutImminent(),
    decisionWindows: typeof state.decisionWindows === 'number' ? state.decisionWindows : 0,
  };
}

function computeAverageTickDurationMs(
  dwell: Record<TickTierId, number>,
  fallbackDurationMs: number,
): number {
  const weightedDurationMs =
    dwell.T0 * TICK_DURATION_MS_BY_TIER.T0 +
    dwell.T1 * TICK_DURATION_MS_BY_TIER.T1 +
    dwell.T2 * TICK_DURATION_MS_BY_TIER.T2 +
    dwell.T3 * TICK_DURATION_MS_BY_TIER.T3 +
    dwell.T4 * TICK_DURATION_MS_BY_TIER.T4;

  const totalTicks = dwell.T0 + dwell.T1 + dwell.T2 + dwell.T3 + dwell.T4;

  return totalTicks > 0 ? weightedDurationMs / totalTicks : fallbackDurationMs;
}

export async function captureRunTimeSnapshot(
  runId: string,
  engine: TimeEngineReadable,
  telemetryOverrides?: Partial<TelemetryEnvelopeV2>,
): Promise<RunTimeSnapshot> {
  const telemetry = new TimeEngineTelemetry({
    ...engine.getTelemetry(),
    ...telemetryOverrides,
  }).toJSON();

  const lastKnownState = normalizeState(engine);
  const tickBudget = buildTickBudget(engine);
  const avgTickDurationMs = computeAverageTickDurationMs(
    telemetry.tickTierDwell,
    lastKnownState.tickDurationMs,
  );

  return {
    runId,
    capturedAtMs: Date.now(),
    ticksElapsed: engine.getTickIndex(),
    tickBudget,
    tierAtEnd: toTierAtEnd(engine.getCurrentTier()),
    avgTickDurationMs,
    decisionsOpenedTotal: telemetry.decisionWindowLifecycleMetrics.openedTotal,
    decisionsExpiredTotal: telemetry.decisionWindowLifecycleMetrics.expiredTotal,
    decisionsResolvedTotal: telemetry.decisionWindowLifecycleMetrics.resolvedTotal,
    autoResolvedTotal: telemetry.decisionWindowLifecycleMetrics.autoResolvedTotal,
    holdUsedTotal: telemetry.decisionWindowLifecycleMetrics.holdUsedTotal,
    tierTransitionsTotal: telemetry.tierTransitions.length,
    timeoutOccurred: telemetry.runTimeoutFlags.timeoutOccurred,
    timeoutImminent: telemetry.runTimeoutFlags.timeoutImminent,
    tickTierDwell: { ...telemetry.tickTierDwell },
    decisionWindowLifecycleMetrics: {
      ...telemetry.decisionWindowLifecycleMetrics,
      tierAtOpenCounts: { ...telemetry.decisionWindowLifecycleMetrics.tierAtOpenCounts },
      tierAtResolveCounts: { ...telemetry.decisionWindowLifecycleMetrics.tierAtResolveCounts },
      tierAtExpiryCounts: { ...telemetry.decisionWindowLifecycleMetrics.tierAtExpiryCounts },
    },
    lastKnownState,
  };
}