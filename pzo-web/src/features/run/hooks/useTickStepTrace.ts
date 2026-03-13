// pzo-web/src/features/run/hooks/useTickStepTrace.ts

/**
 * ============================================================================
 * POINT ZERO ONE — ENGINE 0 TICK STEP TRACE HOOK
 * FILE: pzo-web/src/features/run/hooks/useTickStepTrace.ts
 * ============================================================================
 *
 * Purpose:
 * - expose a high-density, UI-ready tick-step trace surface for Engine 0
 * - map the immutable 13-step orchestration contract into recent trace frames
 * - remain compatible with BOTH:
 *   1) provider-backed orchestrator diagnostics with stepDurationsMs
 *   2) fallback diagnostics where only tick-level timing / error events are known
 *
 * Doctrine:
 * - never assume new engine methods exist unless duck-typed
 * - preserve the authoritative 13-step sequence
 * - let the hook degrade gracefully when fine-grained timings are unavailable
 * ============================================================================
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import { sharedEventBus } from '../../../engines/core/EventBus';
import type {
  OrchestratorStepName,
  TickWindowSample,
} from '../../../engines/core/OrchestratorDiagnostics';
import type {
  EngineId,
  RunOutcome,
} from '../../../engines/zero/types';

import {
  useOrchestratorDiagnostics,
  type OrchestratorDiagnosticsProviderLike,
} from './useOrchestratorDiagnostics';

/* ============================================================================
 * TYPES
 * ============================================================================
 */

export type TickStepExecutionState =
  | 'COMPLETED'
  | 'FAILED'
  | 'UNKNOWN';

export interface TickStepDefinition {
  stepNumber: number;
  stepName: OrchestratorStepName;
  label: string;
  description: string;
  engineId: EngineId | 'EVENT_BUS';
}

export interface TickStepErrorRecord {
  tickIndex: number;
  step: number;
  engineId?: EngineId;
  error: string;
  timestamp: number;
}

export interface TickStepTraceRow extends TickStepDefinition {
  durationMs: number | null;
  state: TickStepExecutionState;
  error: string | null;
  sourceEngineId: EngineId | null;
  hasTiming: boolean;
}

export interface TickTraceFrame {
  tickIndex: number;
  outcome: RunOutcome | null;
  scheduledDurationMs: number;
  actualDurationMs: number;
  driftMs: number;
  flushDurationMs: number;
  emittedEventCount: number;
  openDecisionWindowCount: number;
  totalKnownStepDurationMs: number;
  completedStepCount: number;
  failedStepCount: number;
  unknownStepCount: number;
  longestStep: TickStepTraceRow | null;
  hasAnyTiming: boolean;
  steps: TickStepTraceRow[];
  timestamp: number;
}

export interface UseTickStepTraceOptions {
  provider?: OrchestratorDiagnosticsProviderLike | null;
  historySize?: number;
}

export interface UseTickStepTraceResult {
  currentFrame: TickTraceFrame | null;
  history: TickTraceFrame[];
  latestErrors: TickStepErrorRecord[];
  hasAnyTiming: boolean;
  hasFailures: boolean;
  lastFailedStep: TickStepTraceRow | null;
  stepDefinitions: TickStepDefinition[];
  clearHistory: () => void;
}

/* ============================================================================
 * STEP CONTRACT
 * ============================================================================
 */

const STEP_DEFINITIONS: TickStepDefinition[] = [
  {
    stepNumber: 1,
    stepName: 'STEP_01_TIME_ADVANCE',
    label: 'Step 01 — Time Advance',
    description:
      'Advance the season clock, expire decision windows, and update timeout pressure.',
    engineId: 'TIME_ENGINE',
  },
  {
    stepNumber: 2,
    stepName: 'STEP_02_PRESSURE_COMPUTE',
    label: 'Step 02 — Pressure Compute',
    description:
      'Compute the pre-action pressure score from the current run snapshot.',
    engineId: 'PRESSURE_ENGINE',
  },
  {
    stepNumber: 3,
    stepName: 'STEP_03_TENSION_UPDATE',
    label: 'Step 03 — Tension Update',
    description:
      'Advance the anticipation queue, resolve arrivals, and recompute visibility.',
    engineId: 'TENSION_ENGINE',
  },
  {
    stepNumber: 4,
    stepName: 'STEP_04_SHIELD_PASSIVE',
    label: 'Step 04 — Shield Passive',
    description:
      'Apply passive shield regeneration before any incoming attacks land.',
    engineId: 'SHIELD_ENGINE',
  },
  {
    stepNumber: 5,
    stepName: 'STEP_05_BATTLE_STATE',
    label: 'Step 05 — Battle State',
    description:
      'Evaluate hater bot state machines without firing attacks yet.',
    engineId: 'BATTLE_ENGINE',
  },
  {
    stepNumber: 6,
    stepName: 'STEP_06_BATTLE_ATTACKS',
    label: 'Step 06 — Battle Attacks',
    description:
      'Emit attack events for bots currently in ATTACKING state.',
    engineId: 'BATTLE_ENGINE',
  },
  {
    stepNumber: 7,
    stepName: 'STEP_07_SHIELD_ATTACK_APPLY',
    label: 'Step 07 — Shield Attack Apply',
    description:
      'Route attacks into shield layers, apply damage, and trigger breaches.',
    engineId: 'SHIELD_ENGINE',
  },
  {
    stepNumber: 8,
    stepName: 'STEP_08_CASCADE_EXECUTE',
    label: 'Step 08 — Cascade Execute',
    description:
      'Fire due cascade links and initialize new chains from breach outcomes.',
    engineId: 'CASCADE_ENGINE',
  },
  {
    stepNumber: 9,
    stepName: 'STEP_09_CASCADE_RECOVERY',
    label: 'Step 09 — Cascade Recovery',
    description:
      'Break eligible cascade chains when recovery conditions are satisfied.',
    engineId: 'CASCADE_ENGINE',
  },
  {
    stepNumber: 10,
    stepName: 'STEP_10_PRESSURE_RECOMPUTE',
    label: 'Step 10 — Pressure Recompute',
    description:
      'Recompute post-action pressure after attacks and cascades have landed.',
    engineId: 'PRESSURE_ENGINE',
  },
  {
    stepNumber: 11,
    stepName: 'STEP_11_TIME_TIER_UPDATE',
    label: 'Step 11 — Time Tier Update',
    description:
      'Set the next tick tier from the post-action pressure score.',
    engineId: 'TIME_ENGINE',
  },
  {
    stepNumber: 12,
    stepName: 'STEP_12_SOVEREIGNTY_SNAPSHOT',
    label: 'Step 12 — Sovereignty Snapshot',
    description:
      'Record the completed tick into proof / grading accumulation state.',
    engineId: 'SOVEREIGNTY_ENGINE',
  },
  {
    stepNumber: 13,
    stepName: 'STEP_13_EVENT_FLUSH',
    label: 'Step 13 — Event Flush',
    description:
      'Flush all deferred EventBus events to subscribers after the tick.',
    engineId: 'EVENT_BUS',
  },
];

/* ============================================================================
 * FALLBACK ERROR RUNTIME
 * ============================================================================
 */

class StepErrorRuntime {
  private readonly subscribers = new Set<() => void>();
  private readonly errorsByTick = new Map<number, TickStepErrorRecord[]>();
  private readonly outcomesByTick = new Map<number, RunOutcome | null>();
  private wired = false;

  public subscribe(listener: () => void): () => void {
    this.ensureWired();
    this.subscribers.add(listener);

    return () => {
      this.subscribers.delete(listener);
    };
  }

  public getErrorsForTick(tickIndex: number): TickStepErrorRecord[] {
    return [...(this.errorsByTick.get(tickIndex) ?? [])];
  }

  public getRecentErrors(limit = 32): TickStepErrorRecord[] {
    const all = [...this.errorsByTick.values()].flat();
    return all.slice(Math.max(0, all.length - limit));
  }

  public getOutcomeForTick(tickIndex: number): RunOutcome | null {
    return this.outcomesByTick.get(tickIndex) ?? null;
  }

  public reset(): void {
    this.errorsByTick.clear();
    this.outcomesByTick.clear();
    this.emit();
  }

  private ensureWired(): void {
    if (this.wired) return;
    this.wired = true;

    sharedEventBus.on(
      'TICK_STEP_ERROR',
      ((event: any) => {
        const tickIndex =
          typeof event?.tickIndex === 'number' ? event.tickIndex : 0;
        const payload = event?.payload ?? {};

        const next: TickStepErrorRecord[] = this.errorsByTick.get(tickIndex) ?? [];
        next.push({
          tickIndex,
          step: typeof payload.step === 'number' ? payload.step : -1,
          engineId: payload.engineId as EngineId | undefined,
          error:
            typeof payload.error === 'string'
              ? payload.error
              : 'Unknown step error.',
          timestamp: Date.now(),
        });

        this.errorsByTick.set(tickIndex, next);
        this.emit();
      }) as never,
    );

    sharedEventBus.on(
      'TICK_COMPLETE',
      ((event: any) => {
        const payload = event?.payload ?? {};
        const tickIndex =
          typeof payload.tickIndex === 'number'
            ? payload.tickIndex
            : typeof event?.tickIndex === 'number'
              ? event.tickIndex
              : 0;

        this.outcomesByTick.set(
          tickIndex,
          (payload.outcome as RunOutcome | null | undefined) ?? null,
        );

        this.emit();
      }) as never,
    );
  }

  private emit(): void {
    for (const listener of this.subscribers) {
      listener();
    }
  }
}

const stepErrorRuntime = new StepErrorRuntime();

/* ============================================================================
 * HELPERS
 * ============================================================================
 */

function safeNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function buildTraceRow(
  definition: TickStepDefinition,
  sample: TickWindowSample,
  tickErrors: TickStepErrorRecord[],
): TickStepTraceRow {
  const errorRecord =
    tickErrors.find((entry) => entry.step === definition.stepNumber) ?? null;

  const durationMs =
    definition.stepNumber === 13
      ? sample.flushDurationMs
      : safeNumber(sample.stepDurationsMs?.[definition.stepName]);

  let state: TickStepExecutionState = 'UNKNOWN';

  if (errorRecord) {
    state = 'FAILED';
  } else if (durationMs !== null) {
    state = 'COMPLETED';
  }

  return {
    ...definition,
    durationMs,
    state,
    error: errorRecord?.error ?? null,
    sourceEngineId: errorRecord?.engineId ?? null,
    hasTiming: durationMs !== null,
  };
}

function buildTraceFrame(
  sample: TickWindowSample,
  tickErrors: TickStepErrorRecord[],
  outcome: RunOutcome | null,
): TickTraceFrame {
  const steps = STEP_DEFINITIONS.map((definition) =>
    buildTraceRow(definition, sample, tickErrors),
  );

  const totalKnownStepDurationMs = steps.reduce(
    (sum, row) => sum + (row.durationMs ?? 0),
    0,
  );

  const completedStepCount = steps.filter(
    (row) => row.state === 'COMPLETED',
  ).length;

  const failedStepCount = steps.filter((row) => row.state === 'FAILED').length;
  const unknownStepCount = steps.filter(
    (row) => row.state === 'UNKNOWN',
  ).length;

  const longestStep =
    steps
      .filter((row) => row.durationMs !== null)
      .sort((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0))[0] ?? null;

  return {
    tickIndex: sample.tickIndex,
    outcome,
    scheduledDurationMs: sample.scheduledDurationMs,
    actualDurationMs: sample.actualDurationMs,
    driftMs: sample.driftMs,
    flushDurationMs: sample.flushDurationMs,
    emittedEventCount: sample.emittedEventCount,
    openDecisionWindowCount: sample.openDecisionWindowCount,
    totalKnownStepDurationMs,
    completedStepCount,
    failedStepCount,
    unknownStepCount,
    longestStep,
    hasAnyTiming: steps.some((row) => row.hasTiming),
    steps,
    timestamp: sample.timestamp,
  };
}

/* ============================================================================
 * HOOK
 * ============================================================================
 */

export function useTickStepTrace(
  options: UseTickStepTraceOptions = {},
): UseTickStepTraceResult {
  const historySize = Math.max(8, options.historySize ?? 64);

  const diagnostics = useOrchestratorDiagnostics({
    provider: options.provider ?? null,
  });

  const [runtimeVersion, setRuntimeVersion] = useState(0);
  const [history, setHistory] = useState<TickTraceFrame[]>([]);

  const lastCommittedTickRef = useRef<number | null>(null);

  useEffect(() => {
    return stepErrorRuntime.subscribe(() => {
      setRuntimeVersion((value) => value + 1);
    });
  }, []);

  useEffect(() => {
    const sample = diagnostics.snapshot.lastTick;
    if (!sample) return;

    if (lastCommittedTickRef.current === sample.tickIndex) return;
    lastCommittedTickRef.current = sample.tickIndex;

    const frame = buildTraceFrame(
      sample,
      stepErrorRuntime.getErrorsForTick(sample.tickIndex),
      stepErrorRuntime.getOutcomeForTick(sample.tickIndex),
    );

    setHistory((current) => {
      const next = [...current, frame];
      if (next.length > historySize) {
        next.splice(0, next.length - historySize);
      }
      return next;
    });
  }, [diagnostics.snapshot, historySize, runtimeVersion]);

  const currentFrame = useMemo(() => {
    if (!diagnostics.snapshot.lastTick) return null;

    return buildTraceFrame(
      diagnostics.snapshot.lastTick,
      stepErrorRuntime.getErrorsForTick(diagnostics.snapshot.lastTick.tickIndex),
      stepErrorRuntime.getOutcomeForTick(diagnostics.snapshot.lastTick.tickIndex),
    );
  }, [diagnostics.snapshot, runtimeVersion]);

  const latestErrors = useMemo(
    () => stepErrorRuntime.getRecentErrors(32),
    [runtimeVersion],
  );

  const lastFailedStep = useMemo(() => {
    if (!currentFrame) return null;
    return [...currentFrame.steps]
      .reverse()
      .find((step) => step.state === 'FAILED') ?? null;
  }, [currentFrame]);

  const clearHistory = () => {
    lastCommittedTickRef.current = null;
    stepErrorRuntime.reset();
    setHistory([]);
  };

  return {
    currentFrame,
    history,
    latestErrors,
    hasAnyTiming: currentFrame?.hasAnyTiming ?? false,
    hasFailures:
      Boolean(lastFailedStep) || latestErrors.length > 0,
    lastFailedStep,
    stepDefinitions: STEP_DEFINITIONS,
    clearHistory,
  };
}

export default useTickStepTrace;