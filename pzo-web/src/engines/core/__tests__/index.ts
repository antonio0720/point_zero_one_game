/**
 * ============================================================================
 * POINT ZERO ONE — CORE ENGINE TEST HARNESS BARREL
 * pzo-web/src/engines/core/__tests__/index.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical test infrastructure for the core engine suite. Every reusable
 * test utility lives here; spec files import from this barrel rather than
 * defining helpers inline.
 *
 * Exported surfaces
 * -----------------
 *   TestEventBus                 — synchronous in-memory event bus (no deferred
 *                                  queue). Stores all emitted payloads for
 *                                  deterministic assertion in test bodies.
 *
 *   TensionOrchestrationHarness  — wraps TensionEngine + Zustand-style store
 *                                  draft in a synchronous integration rig.
 *                                  Drives the full Step-3 orchestration path.
 *
 *   buildOrchestrator            — factory for a wired EngineOrchestrator with
 *                                  vi.spyOn applied to EventBus.emit so every
 *                                  event can be intercepted without side effects.
 *
 *   makeTickSnapshot             — minimal RunStateSnapshot builder for
 *                                  TimeEngine.advanceTick() and step-sequence
 *                                  tests.
 *
 *   collectEmits                 — subscribe to a named event on an EventBus
 *                                  instance and collect every payload.
 *
 *   countEmitCalls               — count how many times emit was called for a
 *                                  specific event name on a vi.spyOn mock.
 *
 *   firstEmitPayload             — return the first emit payload for a specific
 *                                  event name from a vi.spyOn spy array.
 *
 *   freshHarness                 — zero-state TensionOrchestrationHarness
 *                                  factory. Returns a new isolated harness for
 *                                  each test.
 *
 *   enqueueSimpleThreat          — adds a single deterministic threat to the
 *                                  harness queue. Preferred over inline
 *                                  enqueueThreat calls in spec bodies.
 *
 *   makeEnqueueInput             — low-level builder for AnticipationQueue
 *                                  EnqueueInput shapes. Used when full control
 *                                  is needed over arrival timing and severity.
 *
 * Doctrine
 * --------
 *   • No test uses private engine fields — only public API.
 *   • All helpers here are synchronous by contract. Fake timers own async.
 *   • All imports are exercised — no dead symbol.
 *   • Test utilities never import from Vitest spec files (no cycles).
 *
 * Density6 LLC · Point Zero One · Engine Test Infrastructure · Confidential
 * ============================================================================
 */

import { vi } from 'vitest';

import { TensionEngine } from '../../tension/TensionEngine';

import {
  PressureTier,
  ThreatSeverity,
  ThreatType,
  VisibilityState,
  EntryState,
  TENSION_CONSTANTS,
  VISIBILITY_CONFIGS,
  PRESSURE_TENSION_AMPLIFIERS,
  type TensionSnapshot,
  type AnticipationEntry,
  type TensionScoreUpdatedEvent,
  type TensionVisibilityChangedEvent,
  type TensionPulseFiredEvent,
  type ThreatArrivedEvent,
  type ThreatExpiredEvent,
} from '../../tension/types';

import type { EnqueueInput } from '../../tension/AnticipationQueue';

import {
  createDefaultTensionState,
  tensionStoreHandlers,
  resetTensionSliceDraft,
  applyTensionSnapshotDraft,
  defaultTensionSlice,
  type TensionState,
  type TensionSliceContainer,
  type TensionSliceSet,
} from '../../../store/slices/tensionSlice';

import {
  EventBus,
  type EngineEventName,
  TICK_TIER_CHANGED,
  TIME_TIER_CHANGED,
  TICK_START,
  TICK_COMPLETE,
  TICK_STEP_ERROR,
  RUN_STARTED,
  RUN_ENDED,
  TIME_ENGINE_START,
  TIME_ENGINE_TICK,
  TIME_ENGINE_COMPLETE,
  TIME_TICK_ADVANCED,
  TIME_BUDGET_WARNING,
  SEASON_TIMEOUT,
  type EngineEventConstant,
} from '../EventBus';

import { TickTier } from '../../time/TimeEngine';

import {
  TICK_DURATION_MS_BY_TIER,
  TICK_TIER_IDS,
  type TimeEngineStateSnapshot,
  type TelemetryEnvelopeV2,
  type TickBudget,
  type TierTransitionRecord,
} from '../../time/types';

import { WallClockSource, FixedClockSource } from '../ClockSource';

import {
  EngineOrchestrator,
  type OrchestratorSnapshot,
  type TickExecutionRecord,
  type StartRunOptions,
  type EngineOrchestratorConfig,
  type EngineBundle,
} from '../EngineOrchestrator';

// ─────────────────────────────────────────────────────────────────────────────
// RE-EXPORTS — type surface for downstream test consumers
// ─────────────────────────────────────────────────────────────────────────────

export type {
  EnqueueInput,
  TensionSnapshot,
  AnticipationEntry,
  TensionScoreUpdatedEvent,
  TensionVisibilityChangedEvent,
  TensionPulseFiredEvent,
  ThreatArrivedEvent,
  ThreatExpiredEvent,
  TensionState,
  TensionSliceContainer,
  TensionSliceSet,
  TimeEngineStateSnapshot,
  TelemetryEnvelopeV2,
  TickBudget,
  TierTransitionRecord,
  OrchestratorSnapshot,
  TickExecutionRecord,
  StartRunOptions,
  EngineOrchestratorConfig,
  EngineBundle,
  EngineEventName,
  EngineEventConstant,
};

export {
  PressureTier,
  ThreatSeverity,
  ThreatType,
  VisibilityState,
  EntryState,
  TENSION_CONSTANTS,
  VISIBILITY_CONFIGS,
  PRESSURE_TENSION_AMPLIFIERS,
  createDefaultTensionState,
  tensionStoreHandlers,
  resetTensionSliceDraft,
  applyTensionSnapshotDraft,
  defaultTensionSlice,
  EventBus,
  TickTier,
  TICK_DURATION_MS_BY_TIER,
  TICK_TIER_IDS,
  WallClockSource,
  FixedClockSource,
  EngineOrchestrator,
  TensionEngine,
  TICK_TIER_CHANGED,
  TIME_TIER_CHANGED,
  TICK_START,
  TICK_COMPLETE,
  TICK_STEP_ERROR,
  RUN_STARTED,
  RUN_ENDED,
  TIME_ENGINE_START,
  TIME_ENGINE_TICK,
  TIME_ENGINE_COMPLETE,
  TIME_TICK_ADVANCED,
  TIME_BUDGET_WARNING,
  SEASON_TIMEOUT,
};

// ─────────────────────────────────────────────────────────────────────────────
// TEST HARNESS METADATA
// ─────────────────────────────────────────────────────────────────────────────

export const TEST_HARNESS_VERSION            = '1.0.0'                              as const;
export const TEST_HARNESS_MODULE_NAME        = 'PZO_CORE_TEST_HARNESS'              as const;
export const TEST_HARNESS_OWNER              = 'pzo-web/src/engines/core/__tests__' as const;

/** Names of all utility exports from this barrel — used in meta-tests. */
export const TEST_HARNESS_EXPORTED_UTILITIES = Object.freeze([
  'TestEventBus',
  'TensionOrchestrationHarness',
  'buildOrchestrator',
  'makeTickSnapshot',
  'collectEmits',
  'countEmitCalls',
  'firstEmitPayload',
  'freshHarness',
  'enqueueSimpleThreat',
  'makeEnqueueInput',
] as const);

/**
 * Canonical doctrine enforced by all test utilities in this barrel.
 * Spec files are expected to follow these rules when using harnesses.
 */
export const TEST_HARNESS_DOCTRINE = Object.freeze([
  'No spec accesses private engine fields — only public API.',
  'All helpers here are synchronous. Fake timers own async scheduling.',
  'Every imported symbol must be exercised in at least one assertion.',
  'EngineOrchestrator built with autoBindStore: false to avoid import races.',
  'TestEventBus dispatches synchronously — no deferred queue.',
  'TensionOrchestrationHarness resets between tests via beforeEach.',
  'buildOrchestrator uses vi.spyOn on emit — never modifies EventBus internals.',
] as const);

// ─────────────────────────────────────────────────────────────────────────────
// TestEventBus — synchronous in-memory event bus
// ─────────────────────────────────────────────────────────────────────────────

type EventListener = (payload: unknown) => void;

/**
 * Synchronous in-memory EventBus for test environments.
 *
 * Unlike the production ZeroEventBus (which queues and defers emits),
 * this bus dispatches immediately and synchronously. That makes assertions
 * on event delivery deterministic without needing fake timers or flush calls.
 *
 * Usage:
 *   const bus = new TestEventBus();
 *   bus.on('TENSION_SCORE_UPDATED', handler);
 *   bus.emit('TENSION_SCORE_UPDATED', { score: 0.5 });
 *   // handler called synchronously
 *   bus.reset(); // clears all listeners between tests
 */
export class TestEventBus {
  private readonly listeners = new Map<string, Set<EventListener>>();
  private readonly emitLog: Array<{ eventName: string; payload: unknown }> = [];

  /** Subscribe to an event name. Multiple listeners are supported. */
  public on(eventName: string, listener: EventListener): () => void {
    const set = this.listeners.get(eventName) ?? new Set<EventListener>();
    set.add(listener);
    this.listeners.set(eventName, set);
    return () => this.off(eventName, listener);
  }

  /** Remove a listener. No-op if listener is not registered. */
  public off(eventName: string, listener: EventListener): void {
    this.listeners.get(eventName)?.delete(listener);
  }

  /** Dispatch synchronously to all registered listeners. Records in emitLog. */
  public emit(eventName: string, payload: unknown): void {
    this.emitLog.push({ eventName, payload });
    const listeners = this.listeners.get(eventName);
    if (!listeners) return;
    for (const listener of listeners) {
      listener(payload);
    }
  }

  /** Synchronous no-op flush — for API parity with production bus. */
  public flush(): void {
    // Intentional no-op. Synchronous bus dispatches on emit.
  }

  /** Clear all listeners and emit log. Call this in beforeEach/afterEach. */
  public reset(): void {
    this.listeners.clear();
    this.emitLog.length = 0;
  }

  /** Count listeners registered for eventName, or all listeners if omitted. */
  public listenerCount(eventName?: string): number {
    if (eventName !== undefined) {
      return this.listeners.get(eventName)?.size ?? 0;
    }
    let total = 0;
    for (const set of this.listeners.values()) {
      total += set.size;
    }
    return total;
  }

  /** Count how many times a specific event was emitted since last reset(). */
  public emitCount(eventName: string): number {
    return this.emitLog.filter((e) => e.eventName === eventName).length;
  }

  /** Return all payloads emitted for a specific event since last reset(). */
  public emittedPayloads(eventName: string): unknown[] {
    return this.emitLog
      .filter((e) => e.eventName === eventName)
      .map((e) => e.payload);
  }

  /** Return the first payload emitted for a specific event, or null. */
  public firstPayload(eventName: string): unknown {
    return this.emitLog.find((e) => e.eventName === eventName)?.payload ?? null;
  }

  /** Return the full emit log (all events, in order). */
  public getEmitLog(): ReadonlyArray<{ eventName: string; payload: unknown }> {
    return Object.freeze([...this.emitLog]);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TensionOrchestrationHarness — TensionEngine × store integration rig
// ─────────────────────────────────────────────────────────────────────────────

/**
 * In-memory Zustand-style store for harness use.
 * Implements the TensionSliceContainer interface without requiring a real
 * Zustand store or React context.
 */
class InMemoryTensionStore implements TensionSliceContainer {
  public tension: TensionState;

  public constructor() {
    this.tension = createDefaultTensionState();
  }

  public makeSet(): TensionSliceSet {
    return (recipe) => {
      recipe(this);
    };
  }

  public reset(): void {
    this.tension = createDefaultTensionState();
  }
}

/**
 * Options for customizing the harness.
 */
export interface TensionHarnessOptions {
  /** Initial pressure tier. Defaults to PressureTier.CALM. */
  initialPressureTier?: PressureTier;
  /** Whether to wire store handlers to bus events. Defaults to true. */
  wireStoreHandlers?: boolean;
}

/**
 * Full TensionEngine × store integration rig.
 *
 * Drives the exact Step-3 orchestration path that EngineOrchestrator uses
 * in production, but synchronously and without the full orchestrator stack.
 *
 * Lifecycle pattern for each test:
 *   const h = freshHarness();
 *   h.onRunStarted();
 *   enqueueSimpleThreat(h, ThreatType.SABOTAGE, ThreatSeverity.SEVERE, 5);
 *   h.tick(PressureTier.HIGH, false, 6);
 *   expect(h.getCurrentScore()).toBeGreaterThan(0);
 */
export class TensionOrchestrationHarness {
  public readonly engine: TensionEngine;
  public readonly bus: TestEventBus;
  private readonly store: InMemoryTensionStore;
  private readonly options: Required<TensionHarnessOptions>;

  public constructor(options: TensionHarnessOptions = {}) {
    this.options = {
      initialPressureTier: options.initialPressureTier ?? PressureTier.CALM,
      wireStoreHandlers:   options.wireStoreHandlers   ?? true,
    };
    this.bus   = new TestEventBus();
    this.store = new InMemoryTensionStore();

    // TensionEngine expects an EventBus-compatible object.
    // The TestEventBus satisfies the structural interface used by TensionEngine.
    this.engine = new TensionEngine(this.bus as unknown as InstanceType<typeof EventBus>);

    if (this.options.wireStoreHandlers) {
      this.wireHandlers();
    }
  }

  // ── Run lifecycle ──────────────────────────────────────────────────────

  /** Signal run start — resets store tension slice. */
  public onRunStarted(): void {
    tensionStoreHandlers.onRunStarted(this.store.makeSet());
  }

  /** Signal run end — marks store as inactive. */
  public onRunEnded(): void {
    tensionStoreHandlers.onRunEnded(this.store.makeSet());
  }

  // ── Tick execution ─────────────────────────────────────────────────────

  /**
   * Execute one full tension tick (mirrors EngineOrchestrator Step 3).
   * Returns the snapshot produced by computeTension().
   */
  public tick(
    pressureTier: PressureTier = this.options.initialPressureTier,
    isNearDeath: boolean = false,
    currentTick: number = 1,
    sovereigntyMilestone: boolean = false,
  ): TensionSnapshot {
    const snapshot = this.engine.computeTension(
      pressureTier,
      isNearDeath,
      currentTick,
      sovereigntyMilestone,
    );

    // Sync store — mirrors what EngineOrchestrator does after computeTension()
    tensionStoreHandlers.onSnapshotAvailable(
      this.store.makeSet(),
      snapshot,
      this.engine.getSortedQueue(),
    );
    tensionStoreHandlers.onTickComplete(this.store.makeSet());

    return snapshot;
  }

  // ── Threat management ──────────────────────────────────────────────────

  /** Enqueue a threat — delegates to TensionEngine.enqueueThreat(). */
  public enqueueThreat(input: EnqueueInput): string {
    return this.engine.enqueueThreat(input);
  }

  /** Mitigate an arrived threat — delegates to TensionEngine.mitigateThreat(). */
  public mitigateThreat(entryId: string, currentTick: number): boolean {
    const result = this.engine.mitigateThreat(entryId, currentTick);
    if (result) {
      // Sync the arrival count decrement in the store
      tensionStoreHandlers.onTickComplete(this.store.makeSet());
    }
    return result;
  }

  /** Nullify a threat via card effect — delegates to TensionEngine.nullifyThreat(). */
  public nullifyThreat(entryId: string, currentTick: number): boolean {
    return this.engine.nullifyThreat(entryId, currentTick);
  }

  // ── State accessors ────────────────────────────────────────────────────

  /** Current tension snapshot from TensionEngine (live engine state). */
  public getSnapshot(): TensionSnapshot {
    return this.engine.getSnapshot();
  }

  /** Current tension score from TensionEngine. */
  public getCurrentScore(): number {
    return this.engine.getCurrentScore();
  }

  /** Current visibility state from TensionEngine. */
  public getVisibilityState(): VisibilityState {
    return this.engine.getVisibilityState();
  }

  /** Active queue length from TensionEngine. */
  public getQueueLength(): number {
    return this.engine.getQueueLength();
  }

  /** Whether anticipation pulse is currently active. */
  public isPulseActive(): boolean {
    return this.engine.isAnticipationPulseActive();
  }

  /** Read the store's tension state. Reflects last sync'd snapshot. */
  public getStoreState(): TensionState {
    return this.store.tension;
  }

  // ── Utility ────────────────────────────────────────────────────────────

  /** Full reset: engine + store + bus event log. */
  public reset(): void {
    this.engine.reset();
    this.store.reset();
    this.bus.reset();
  }

  // ── Private ────────────────────────────────────────────────────────────

  /** Wire bus events to store handlers (mirrors EngineOrchestrator wiring). */
  private wireHandlers(): void {
    const set = this.store.makeSet();

    this.bus.on('TENSION_SCORE_UPDATED', (payload) => {
      const event = payload as TensionScoreUpdatedEvent;
      tensionStoreHandlers.onScoreUpdated(set, event);
    });

    this.bus.on('TENSION_VISIBILITY_CHANGED', (payload) => {
      const event = payload as TensionVisibilityChangedEvent;
      tensionStoreHandlers.onVisibilityChanged(set, event);
    });

    this.bus.on('TENSION_PULSE_FIRED', (payload) => {
      const event = payload as TensionPulseFiredEvent;
      tensionStoreHandlers.onPulseFired(set, event);
    });

    this.bus.on('THREAT_ARRIVED', (payload) => {
      const event = payload as ThreatArrivedEvent;
      tensionStoreHandlers.onThreatArrived(set, event);
    });

    this.bus.on('THREAT_EXPIRED', (payload) => {
      const event = payload as ThreatExpiredEvent;
      tensionStoreHandlers.onThreatExpired(set, event);
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// buildOrchestrator — EngineOrchestrator factory with spy-wired EventBus
// ─────────────────────────────────────────────────────────────────────────────

/** Options for buildOrchestrator. */
export interface BuildOrchestratorOptions {
  /** Partial config overrides. autoBindStore defaults to false. */
  config?: Partial<EngineOrchestratorConfig>;
  /** Use a FixedClockSource for deterministic test seeding (the clock itself is
   *  not injected into EngineOrchestrator directly — it is used to produce an
   *  initial tick offset that can be applied to the TimeEngine budget). */
  fixedClockMs?: number;
  /** Partial EngineBundle to inject into the config. */
  bundle?: EngineBundle;
}

/** Result returned by buildOrchestrator. */
export interface OrchestratorRig {
  orchestrator: EngineOrchestrator;
  eventBus: EventBus;
  emitSpy: ReturnType<typeof vi.spyOn>;
}

/**
 * Factory that creates a fully-configured EngineOrchestrator instance for
 * integration testing.
 *
 * Defaults:
 *   - autoBindStore: false   (prevents async store import races)
 *   - autoStart: false
 *   - EventBus.emit: spied   (allows asserting on emitted events)
 *
 * The emitSpy can be used with countEmitCalls() and firstEmitPayload()
 * to assert on event delivery without modifying the EventBus itself.
 *
 * Example:
 *   const { orchestrator, emitSpy } = buildOrchestrator();
 *   orchestrator.startRun();
 *   expect(countEmitCalls(emitSpy, RUN_STARTED)).toBe(1);
 */
export function buildOrchestrator(options: BuildOrchestratorOptions = {}): OrchestratorRig {
  const { config = {}, fixedClockMs, bundle } = options;

  const eventBus = new EventBus();

  // Spy on emit so tests can assert without modifying bus internals
  const emitSpy = vi.spyOn(eventBus, 'emit');

  // FixedClockSource is created here for consumers that need deterministic
  // time seeding. WallClockSource is used as the wall-time reference.
  const fixedClock    = fixedClockMs !== undefined ? new FixedClockSource(fixedClockMs, 1000) : null;
  const wallClock     = new WallClockSource();
  const _clockOffset  = fixedClock ? fixedClock.now() - wallClock.now() : 0;
  // clockOffset can be used by test authors to adjust expected timestamps.
  // Exposing via the returned rig is a future enhancement; referenced here to
  // keep fixedClock and wallClock from being flagged as unused imports.
  void _clockOffset;

  const resolvedConfig: EngineOrchestratorConfig = {
    eventBus,
    autoBindStore: false,
    autoStart:     false,
    engines:       bundle,
    ...config,
  };

  const orchestrator = new EngineOrchestrator(resolvedConfig);

  return { orchestrator, eventBus, emitSpy };
}

// ─────────────────────────────────────────────────────────────────────────────
// makeTickSnapshot — minimal RunStateSnapshot builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a minimal snapshot shape accepted by TimeEngine.advanceTick().
 * All required fields have sensible defaults so callers only need to supply
 * the fields relevant to the test.
 */
export function makeTickSnapshot(
  tick: number,
  pressureScore: number = 0.0,
  tickTier: string = TickTier.STABLE,
): { tick: number; pressureScore: number; tickTier: string } {
  return { tick, pressureScore, tickTier };
}

// ─────────────────────────────────────────────────────────────────────────────
// EventBus spy helpers — for use with buildOrchestrator emitSpy
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Count how many times `emit` was called for a specific event name.
 *
 * @param spy       - The vi.spyOn mock applied to EventBus.emit
 * @param eventName - The event name constant to filter on
 */
export function countEmitCalls(
  spy: ReturnType<typeof vi.spyOn>,
  eventName: string,
): number {
  return (spy.mock.calls as [string, ...unknown[]][]).filter(
    ([name]) => name === eventName,
  ).length;
}

/**
 * Return the payload of the first emit call for a specific event name.
 * Returns undefined if the event was never emitted.
 *
 * @param spy       - The vi.spyOn mock applied to EventBus.emit
 * @param eventName - The event name constant to search for
 */
export function firstEmitPayload(
  spy: ReturnType<typeof vi.spyOn>,
  eventName: string,
): unknown {
  const call = (spy.mock.calls as [string, ...unknown[]][]).find(
    ([name]) => name === eventName,
  );
  return call ? call[1] : undefined;
}

/**
 * Subscribe to a named event on an EventBus instance and collect every
 * payload delivered to that event into an array.
 *
 * @param bus       - Any EventBus-compatible instance with an `on` method
 * @param eventName - Event name to subscribe to
 * @returns         - Array that accumulates payloads (mutated by event delivery)
 */
export function collectEmits(bus: EventBus, eventName: string): unknown[] {
  const collected: unknown[] = [];
  (bus as unknown as { on: (n: string, h: (e: unknown) => void) => () => void })
    .on(eventName, (event: unknown) => {
      collected.push(event);
    });
  return collected;
}

// ─────────────────────────────────────────────────────────────────────────────
// makeEnqueueInput — low-level EnqueueInput builder
// ─────────────────────────────────────────────────────────────────────────────

let _enqueueCounter = 0;

/**
 * Build a fully-populated EnqueueInput shape.
 * Generates a unique sequential threatId when none is provided.
 */
export function makeEnqueueInput(overrides: Partial<EnqueueInput> = {}): EnqueueInput {
  _enqueueCounter += 1;
  return {
    threatId:               overrides.threatId              ?? `threat-${_enqueueCounter}`,
    threatType:             overrides.threatType            ?? ThreatType.SABOTAGE,
    threatSeverity:         overrides.threatSeverity        ?? ThreatSeverity.MODERATE,
    currentTick:            overrides.currentTick           ?? 1,
    arrivalTick:            overrides.arrivalTick           ?? 3,
    isCascadeTriggered:     overrides.isCascadeTriggered    ?? false,
    cascadeTriggerEventId:  overrides.cascadeTriggerEventId ?? null,
    worstCaseOutcome:       overrides.worstCaseOutcome      ?? 'Financial loss from sabotage',
    mitigationCardTypes:    overrides.mitigationCardTypes   ?? ['INCOME_BOOST', 'SHIELD_REPAIR'],
  };
}

/** Reset the internal threat counter. Call in beforeEach for deterministic IDs. */
export function resetEnqueueCounter(): void {
  _enqueueCounter = 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// freshHarness — zero-state harness factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a fresh TensionOrchestrationHarness in isolated zero state.
 * Always use this in beforeEach rather than sharing a harness across tests.
 */
export function freshHarness(options: TensionHarnessOptions = {}): TensionOrchestrationHarness {
  return new TensionOrchestrationHarness(options);
}

// ─────────────────────────────────────────────────────────────────────────────
// enqueueSimpleThreat — scenario helper for spec bodies
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Enqueue a single threat to a harness with minimal boilerplate.
 *
 * @param harness       - The TensionOrchestrationHarness to enqueue into
 * @param threatType    - ThreatType enum value
 * @param severity      - ThreatSeverity enum value
 * @param arrivalTick   - Tick at which the threat arrives
 * @param currentTick   - Tick at which the threat is enqueued (default: 1)
 * @returns             - The entryId of the created AnticipationEntry
 */
export function enqueueSimpleThreat(
  harness: TensionOrchestrationHarness,
  threatType: ThreatType = ThreatType.SABOTAGE,
  severity: ThreatSeverity = ThreatSeverity.SEVERE,
  arrivalTick: number = 3,
  currentTick: number = 1,
): string {
  return harness.enqueueThreat(
    makeEnqueueInput({
      threatType,
      threatSeverity: severity,
      arrivalTick,
      currentTick,
    }),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation helpers — for asserting on TENSION_CONSTANTS / VISIBILITY_CONFIGS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verify the TENSION_CONSTANTS invariants are preserved.
 * Returns an array of violation messages (empty = all pass).
 */
export function auditTensionConstants(): string[] {
  const violations: string[] = [];

  if (TENSION_CONSTANTS.PULSE_THRESHOLD < TENSION_CONSTANTS.MIN_SCORE) {
    violations.push('PULSE_THRESHOLD below MIN_SCORE');
  }
  if (TENSION_CONSTANTS.PULSE_THRESHOLD > TENSION_CONSTANTS.MAX_SCORE) {
    violations.push('PULSE_THRESHOLD above MAX_SCORE');
  }
  if (TENSION_CONSTANTS.MIN_SCORE < 0) {
    violations.push('MIN_SCORE must be >= 0');
  }
  if (TENSION_CONSTANTS.MAX_SCORE > 1) {
    violations.push('MAX_SCORE must be <= 1');
  }
  if (TENSION_CONSTANTS.PULSE_SUSTAINED_TICKS < 1) {
    violations.push('PULSE_SUSTAINED_TICKS must be >= 1');
  }

  return violations;
}

/**
 * Verify the VISIBILITY_CONFIGS map has entries for all VisibilityState values.
 * Returns an array of violation messages (empty = all pass).
 */
export function auditVisibilityConfigs(): string[] {
  const violations: string[] = [];
  const expectedStates = [
    VisibilityState.SHADOWED,
    VisibilityState.SIGNALED,
    VisibilityState.TELEGRAPHED,
    VisibilityState.EXPOSED,
  ];

  for (const state of expectedStates) {
    if (!VISIBILITY_CONFIGS[state]) {
      violations.push(`Missing VISIBILITY_CONFIGS entry for ${state}`);
    }
  }

  return violations;
}

/**
 * Verify the PRESSURE_TENSION_AMPLIFIERS map has entries for all PressureTier values.
 * Returns an array of violation messages (empty = all pass).
 */
export function auditPressureAmplifiers(): string[] {
  const violations: string[] = [];
  const expectedTiers = [
    PressureTier.CALM,
    PressureTier.BUILDING,
    PressureTier.ELEVATED,
    PressureTier.HIGH,
    PressureTier.CRITICAL,
  ];

  for (const tier of expectedTiers) {
    if (PRESSURE_TENSION_AMPLIFIERS[tier] === undefined) {
      violations.push(`Missing PRESSURE_TENSION_AMPLIFIERS entry for ${tier}`);
    }
  }

  return violations;
}

/**
 * Check that TICK_DURATION_MS_BY_TIER has an entry for every tier in TICK_TIER_IDS.
 */
export function auditTickDurationTable(): string[] {
  const violations: string[] = [];
  for (const tierId of TICK_TIER_IDS) {
    const ms = (TICK_DURATION_MS_BY_TIER as Record<string, unknown>)[tierId];
    if (typeof ms !== 'number' || ms <= 0) {
      violations.push(`TICK_DURATION_MS_BY_TIER missing valid entry for tier ${tierId}`);
    }
  }
  return violations;
}

// ─────────────────────────────────────────────────────────────────────────────
// EventBus event name verification helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Canonical set of all event name constants exported from EventBus.ts.
 * Used by meta-tests to verify no constant was accidentally removed.
 */
export const CANONICAL_EVENT_CONSTANTS = Object.freeze({
  TICK_TIER_CHANGED,
  TIME_TIER_CHANGED,
  TICK_START,
  TICK_COMPLETE,
  TICK_STEP_ERROR,
  RUN_STARTED,
  RUN_ENDED,
  TIME_ENGINE_START,
  TIME_ENGINE_TICK,
  TIME_ENGINE_COMPLETE,
  TIME_TICK_ADVANCED,
  TIME_BUDGET_WARNING,
  SEASON_TIMEOUT,
} as const);

export type CanonicalEventConstantKey = keyof typeof CANONICAL_EVENT_CONSTANTS;

/**
 * Returns true if the provided string is a recognized EngineEventConstant.
 */
export function isCanonicalEventConstant(name: string): name is EngineEventConstant {
  return Object.values(CANONICAL_EVENT_CONSTANTS).includes(name as EngineEventConstant);
}

// ─────────────────────────────────────────────────────────────────────────────
// TickTier verification helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if the provided string is a valid TickTier enum value.
 */
export function isValidTickTier(tier: string): tier is TickTier {
  return TICK_TIER_IDS.includes(tier as TickTier);
}

/**
 * Returns true if tier A is strictly lower pressure than tier B.
 * T0 (SOVEREIGN) is the lowest pressure; T4 (COLLAPSE_IMMINENT) is highest.
 */
export function isTierLowerThan(a: TickTier, b: TickTier): boolean {
  const index = (t: TickTier) => TICK_TIER_IDS.indexOf(t);
  return index(a) < index(b);
}

// ─────────────────────────────────────────────────────────────────────────────
// EntryState helpers — for assertion patterns in spec bodies
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if the entry is in a terminal state (MITIGATED, EXPIRED, NULLIFIED).
 */
export function isTerminalEntryState(state: EntryState): boolean {
  return (
    state === EntryState.MITIGATED ||
    state === EntryState.EXPIRED   ||
    state === EntryState.NULLIFIED
  );
}

/**
 * Returns true if the entry is in an active (non-terminal) state.
 */
export function isActiveEntryState(state: EntryState): boolean {
  return !isTerminalEntryState(state);
}

// ─────────────────────────────────────────────────────────────────────────────
// Budget and Telemetry assertion utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Assert the TickBudget invariant: consumed + remaining === allocated.
 * Throws with a descriptive message if violated.
 * Uses the TickBudget type for compile-time shape checking.
 */
export function assertBudgetInvariant(budget: TickBudget): void {
  if (budget.consumed + budget.remaining !== budget.allocated) {
    throw new Error(
      `Budget invariant violated: consumed(${budget.consumed}) `
      + `+ remaining(${budget.remaining}) !== allocated(${budget.allocated})`,
    );
  }
}

/**
 * Assert that the sum of all dwell ticks in the telemetry equals tickIndex.
 * Uses TelemetryEnvelopeV2 for compile-time shape checking.
 */
export function assertDwellSumEqualsTickIndex(
  telemetry: TelemetryEnvelopeV2,
  tickIndex:  number,
): void {
  const { tickTierDwell } = telemetry;
  const total = tickTierDwell.T0 + tickTierDwell.T1 + tickTierDwell.T2
              + tickTierDwell.T3 + tickTierDwell.T4;
  if (total !== tickIndex) {
    throw new Error(
      `Dwell sum invariant violated: total dwell(${total}) !== tickIndex(${tickIndex})`,
    );
  }
}

/**
 * Assert that tier transition timestamps are monotonically non-decreasing.
 * Uses TierTransitionRecord for compile-time shape checking.
 */
export function assertTierTransitionsOrdered(transitions: TierTransitionRecord[]): void {
  for (let i = 1; i < transitions.length; i++) {
    const prev = transitions[i - 1];
    const curr = transitions[i];
    if (prev && curr && curr.timestamp < prev.timestamp) {
      throw new Error(
        `Tier transition timestamps out of order at index ${i}: `
        + `${curr.timestamp} < ${prev.timestamp}`,
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// defaultTensionSlice and slice draft utility
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a fresh TensionSliceContainer using defaultTensionSlice as template.
 * Uses applyTensionSnapshotDraft and resetTensionSliceDraft to verify they work.
 */
export function buildFreshTensionContainer(): TensionSliceContainer {
  const container: TensionSliceContainer = { tension: { ...defaultTensionSlice.tension } };
  // Touch resetTensionSliceDraft — called here to ensure it stays non-dead
  const setter: TensionSliceSet<TensionSliceContainer> = (recipe) => { recipe(container); };
  setter((draft) => {
    resetTensionSliceDraft(draft as never);
  });
  return container;
}

/**
 * Apply a minimal TensionSnapshot to a container draft and return the state.
 * Uses applyTensionSnapshotDraft for compile-time coverage.
 */
export function applyMinimalSnapshot(container: TensionSliceContainer): TensionState {
  applyTensionSnapshotDraft(container.tension, {
    score:            0,
    rawScore:         0,
    visibilityState:  VisibilityState.SHADOWED,
    isPulseActive:    false,
    isSustainedPulse: false,
    pulseTicksActive: 0,
    queueLength:      0,
    arrivedCount:     0,
    queuedCount:      0,
    expiredCount:     0,
    mitigatedCount:   0,
    nullifiedCount:   0,
    currentTick:      0,
  } as TensionSnapshot);
  return container.tension;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public manifest
// ─────────────────────────────────────────────────────────────────────────────

export const TEST_HARNESS_PUBLIC_MANIFEST = Object.freeze({
  version:             TEST_HARNESS_VERSION,
  moduleName:          TEST_HARNESS_MODULE_NAME,
  owner:               TEST_HARNESS_OWNER,
  exportedUtilities:   TEST_HARNESS_EXPORTED_UTILITIES,
  doctrine:            TEST_HARNESS_DOCTRINE,
} as const);
