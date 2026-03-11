/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND TENSION TEST MOCKS
 * /backend/src/game/engine/tension/__tests__/mocks.ts
 * ============================================================================
 *
 * Purpose:
 * - provide repo-aligned mocks, harnesses, and spy helpers for Engine 3 tests
 * - preserve real backend behavior where possible by wrapping actual classes
 * - keep tests deterministic while still allowing assertion-friendly spies
 *
 * Doctrine:
 * - prefer real EventBus + real DeterministicClock + real TensionEngine
 * - add spies around the real objects instead of replacing behavior wholesale
 * - make tick-context creation cheap, deterministic, and tension-step native
 * ============================================================================
 */

import { vi } from 'vitest';

import { DeterministicClock, type MutableClockSource } from '../../core/ClockSource';
import type {
  TickContext,
  TickTrace,
} from '../../core/EngineContracts';
import { EventBus } from '../../core/EventBus';
import type { EngineEventMap, ModeCode } from '../../core/GamePrimitives';
import type { RunStateSnapshot } from '../../core/RunStateSnapshot';
import { TensionEngine } from '../TensionEngine';
import type { TensionRuntimeSnapshot } from '../types';
import {
  createRunStateSnapshotFixture,
  createTensionRuntimeSnapshotFixture,
  type RunStateFixtureOverrides,
} from './fixtures';

type TestEventMap = EngineEventMap & Record<string, unknown>;

export interface TickContextBundle {
  readonly bus: EventBus<TestEventMap>;
  readonly clock: MutableClockSource;
  readonly context: TickContext;
}

export interface EventCapture<EventMap extends Record<string, unknown>> {
  readonly events: Array<{
    readonly sequence: number;
    readonly event: keyof EventMap;
    readonly payload: EventMap[keyof EventMap];
    readonly emittedAtTick?: number;
    readonly tags?: readonly string[];
  }>;
  stop(): void;
  clear(): void;
}

export interface TensionHarness {
  readonly engine: TensionEngine;
  readonly bus: EventBus<TestEventMap>;
  readonly clock: MutableClockSource;
  readonly context: TickContext;
  readonly snapshot: RunStateSnapshot;
  readonly capture: EventCapture<TestEventMap>;
  tick(nextSnapshot?: RunStateSnapshot, nextContext?: TickContext): RunStateSnapshot;
  runtime(): TensionRuntimeSnapshot;
  reset(): void;
}

export interface MockTickContextOverrides {
  readonly step?: TickContext['step'];
  readonly nowMs?: number;
  readonly runId?: string;
  readonly tick?: number;
  readonly mode?: ModeCode;
  readonly phase?: RunStateSnapshot['phase'];
  readonly traceId?: string;
  readonly bus?: EventBus<TestEventMap>;
  readonly clock?: MutableClockSource;
}

function nextTraceId(): string {
  return `trace_tension_${Math.random().toString(36).slice(2, 10)}`;
}

export function createMockClock(initialMs = 1_700_000_000_000): MutableClockSource {
  return new DeterministicClock(initialMs);
}

export function spyOnEventBus<EventMap extends Record<string, unknown>>(
  bus: EventBus<EventMap>,
) {
  return {
    emit: vi.spyOn(bus, 'emit'),
    flush: vi.spyOn(bus, 'flush'),
    on: vi.spyOn(bus, 'on'),
    onAny: vi.spyOn(bus, 'onAny'),
    emitBatch: vi.spyOn(bus, 'emitBatch'),
    last: vi.spyOn(bus, 'last'),
    getHistory: vi.spyOn(bus, 'getHistory'),
  };
}

export function createMockEventBus(): EventBus<TestEventMap> {
  const bus = new EventBus<TestEventMap>();
  spyOnEventBus(bus);
  return bus;
}

export function createMockTickTrace(
  overrides: Omit<MockTickContextOverrides, 'bus' | 'clock' | 'nowMs'> = {},
): TickTrace {
  return Object.freeze({
    runId: overrides.runId ?? 'run_tension_fixture',
    tick: overrides.tick ?? 1,
    step: overrides.step ?? 'STEP_04_TENSION',
    mode: overrides.mode ?? 'solo',
    phase: overrides.phase ?? 'FOUNDATION',
    traceId: overrides.traceId ?? nextTraceId(),
  });
}

export function createMockTickContextBundle(
  overrides: MockTickContextOverrides = {},
): TickContextBundle {
  const clock = overrides.clock ?? createMockClock(overrides.nowMs);
  const bus = overrides.bus ?? createMockEventBus();
  const nowMs = overrides.nowMs ?? clock.now();
  const trace = createMockTickTrace({
    step: overrides.step,
    runId: overrides.runId,
    tick: overrides.tick,
    mode: overrides.mode,
    phase: overrides.phase,
    traceId: overrides.traceId,
  });

  const context: TickContext = Object.freeze({
    step: overrides.step ?? 'STEP_04_TENSION',
    nowMs,
    clock,
    bus,
    trace,
  });

  return Object.freeze({
    bus,
    clock,
    context,
  });
}

export function createMockTickContext(
  overrides: MockTickContextOverrides = {},
): TickContext {
  return createMockTickContextBundle(overrides).context;
}

export function createEventCapture<EventMap extends Record<string, unknown>>(
  bus: EventBus<EventMap>,
): EventCapture<EventMap> {
  const events: Array<{
    readonly sequence: number;
    readonly event: keyof EventMap;
    readonly payload: EventMap[keyof EventMap];
    readonly emittedAtTick?: number;
    readonly tags?: readonly string[];
  }> = [];

  const stop = bus.onAny((envelope) => {
    events.push(envelope);
  });

  return {
    events,
    stop,
    clear() {
      events.length = 0;
    },
  };
}

export function createMockRunState(
  overrides: RunStateFixtureOverrides = {},
): RunStateSnapshot {
  return createRunStateSnapshotFixture(overrides);
}

export function createTensionHarness(
  options: {
    readonly snapshotOverrides?: RunStateFixtureOverrides;
    readonly contextOverrides?: MockTickContextOverrides;
  } = {},
): TensionHarness {
  const engine = new TensionEngine();
  const bundle = createMockTickContextBundle(options.contextOverrides);
  let snapshot = createRunStateSnapshotFixture(options.snapshotOverrides);
  const capture = createEventCapture(bundle.bus);

  return {
    engine,
    bus: bundle.bus,
    clock: bundle.clock,
    context: bundle.context,
    snapshot,
    capture,
    tick(nextSnapshot?: RunStateSnapshot, nextContext?: TickContext): RunStateSnapshot {
      snapshot = engine.tick(
        nextSnapshot ?? snapshot,
        nextContext ?? bundle.context,
      );
      return snapshot;
    },
    runtime(): TensionRuntimeSnapshot {
      return engine.getRuntimeSnapshot();
    },
    reset(): void {
      engine.reset();
      capture.clear();
      bundle.bus.clear({
        clearQueue: true,
        clearHistory: true,
        clearListeners: false,
        clearAnyListeners: false,
      });
      snapshot = createRunStateSnapshotFixture(options.snapshotOverrides);
    },
  };
}

export function createPulseReadyHarness(
  score = 0.95,
  options: {
    readonly snapshotOverrides?: RunStateFixtureOverrides;
    readonly contextOverrides?: MockTickContextOverrides;
  } = {},
): TensionHarness {
  const harness = createTensionHarness({
    snapshotOverrides: {
      tension: {
        score,
        anticipation: 0,
        visibleThreats: Object.freeze([]),
        maxPulseTriggered: score >= 0.9,
        lastSpikeTick: 1,
      },
      ...(options.snapshotOverrides ?? {}),
    },
    contextOverrides: options.contextOverrides,
  });

  return harness;
}

export function createMockRuntimeSnapshot(
  overrides: Partial<TensionRuntimeSnapshot> = {},
): TensionRuntimeSnapshot {
  return createTensionRuntimeSnapshotFixture(overrides);
}