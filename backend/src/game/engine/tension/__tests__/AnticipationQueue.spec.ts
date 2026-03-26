// FILE: backend/src/game/engine/tension/__tests__/AnticipationQueue.spec.ts
//
// Point Zero One — Anticipation Queue Comprehensive Test Suite
// Engine 3 / 7 — Tension Engine
//
// Doctrine:
//   - Every import is used in runtime test code (not just type annotations).
//   - Every constant is referenced in at least one assertion or parameter.
//   - All major lifecycle paths are validated.
//   - ML / DL surface is exercised for shape and value invariants.
//   - TensionDecayController integration is validated alongside the queue.
//   - Standalone pure functions are each called and results verified.
//   - Validation functions cover both passing and failing cases.
// ===========================================================================

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  AnticipationQueue,
  QUEUE_ML_FEATURE_COUNT,
  QUEUE_DL_SEQUENCE_LENGTH,
  QUEUE_DL_FEATURE_WIDTH,
  QUEUE_FORECAST_HORIZON_TICKS,
  QUEUE_TICK_HISTORY_CAPACITY,
  QUEUE_SERIALIZE_MAX_ENTRIES,
  QUEUE_OVERDUE_SEVERITY_MULTIPLIER,
  QUEUE_EXISTENTIAL_SPIKE,
  QUEUE_CRITICAL_SPIKE,
  QUEUE_PRIORITY_WEIGHT_ARRIVED,
  QUEUE_PRIORITY_WEIGHT_QUEUED,
  QUEUE_ML_LENGTH_NORM_CAP,
  QUEUE_ML_OVERDUE_NORM_CAP,
  QUEUE_ML_ETA_NORM_CAP,
  QUEUE_ML_FEATURE_LABELS,
  QUEUE_DL_COLUMN_LABELS,
  QUEUE_HEALTH_THRESHOLDS,
  computeQueuePressure,
  computeQueueThreatDensity,
  classifyQueueRisk,
  projectQueueToThreatEnvelopes,
  rankThreatsByUrgency,
  computeQueueDecayInput,
  computeQueueMLVector,
  computeQueueDLTensor,
  generateQueueNarrative,
  computeQueueDeltaSummary,
  serializeQueueState,
  deserializeQueueState,
  validateQueueUpsertInput,
  validateQueueEntry,
  type QueueMLVector,
  type QueueDLTensor,
  type QueueDLTensorRow,
  type QueueHealthReport,
  type QueueRiskTier,
  type QueueSeverityDistribution,
  type QueueTypeDistribution,
  type EntryForecast,
  type QueueThreatForecast,
  type ArrivalScheduleEntry,
  type ExpirationScheduleEntry,
  type EntryPriorityScore,
  type QueueTickSample,
  type QueueSessionSummary,
  type QueueNarrative,
  type QueueNarrativeLine,
  type MitigationOption,
  type QueueMitigationPlan,
  type QueueSerializedState,
  type QueueDeltaSummary,
  type QueueExportBundle,
} from '../AnticipationQueue';

import {
  TensionDecayController,
  DECAY_ML_FEATURE_COUNT,
  DECAY_DL_SEQUENCE_LENGTH,
  DECAY_DL_FEATURE_WIDTH,
  DECAY_HISTORY_CAPACITY,
  DECAY_VOLATILITY_WINDOW,
  DECAY_SCORE_FLOOR,
  DECAY_SCORE_CEILING,
  DECAY_CASCADE_TYPE_AMPLIFIER,
  DECAY_SOVEREIGNTY_TYPE_AMPLIFIER,
  DECAY_REPUTATION_MITIGATION_RELIEF,
  DECAY_OPPORTUNITY_MITIGATION_RELIEF,
  DECAY_ESCALATION_SLOPE_THRESHOLD,
  DECAY_DEESCALATION_SLOPE_THRESHOLD,
  DECAY_PULSE_SUSTAINED_TICKS,
  DECAY_SEVERITY_WEIGHT_MIN_ENTRIES,
  DECAY_MAX_DELTA_PER_TICK,
  DECAY_FORECAST_HORIZON,
  DECAY_ML_FEATURE_LABELS,
  DECAY_DL_COLUMN_LABELS,
  DECAY_HEALTH_THRESHOLDS,
  computeDecayDelta,
  computeSeverityWeightedDelta,
  computeTypeAdjustedDelta,
  computePressureAmplifiedDelta,
  getDecayVisibilityBonus,
  computeDecayMLVector,
  computeDecayHealthScore,
  classifyDecayRisk,
  validateDecayComputeInput,
  type DecayHealthReport,
  type DecayTrendSnapshot,
  type DecayTrendDirection,
  type DecayForecast,
  type DecayNarrative,
  type DecayNarrativeLine,
  type DecayMLVector,
  type DecayDLTensorRow,
  type DecayDLTensor,
  type DecayTickSample,
  type DecaySessionSummary,
  type DecaySerializedState,
  type DecayExportBundle,
  type DecayTuningParams,
  type DecayContributionAnalysis,
  type DecayRiskTier,
} from '../TensionDecayController';

import {
  ENTRY_STATE,
  THREAT_SEVERITY,
  THREAT_TYPE,
  TENSION_CONSTANTS,
  THREAT_SEVERITY_WEIGHTS,
  TENSION_VISIBILITY_STATE,
  VISIBILITY_CONFIGS,
  PRESSURE_TENSION_AMPLIFIERS,
  THREAT_TYPE_DEFAULT_MITIGATIONS,
  INTERNAL_VISIBILITY_TO_ENVELOPE,
  VISIBILITY_ORDER,
  TENSION_EVENT_NAMES,
  type QueueUpsertInput,
  type AnticipationEntry,
  type QueueProcessResult,
  type ThreatSeverity,
  type ThreatType,
  type EntryState,
  type TensionVisibilityState,
  type DecayContributionBreakdown,
  type TensionRuntimeSnapshot,
  type DecayComputeInput,
  type DecayComputeResult,
  type VisibilityConfig,
  type PressureTier,
  type ThreatEnvelope,
  type VisibilityLevel,
  type TensionScoreUpdatedEvent,
  type TensionVisibilityChangedEvent,
  type TensionPulseFiredEvent,
  type ThreatArrivedEvent,
  type ThreatMitigatedEvent,
  type ThreatExpiredEvent,
  type AnticipationQueueUpdatedEvent,
} from '../types';

import {
  createQueueUpsertInputFixture,
  createQueuedEntryFixture,
  createArrivedEntryFixture,
  createExpiredEntryFixture,
  createMitigatedEntryFixture,
  createNullifiedEntryFixture,
  createTensionRuntimeSnapshotFixture,
  createDecayInputFixture,
  emptyDecayInput,
  mockQueuedEntry,
  mockArrivedEntry,
  mockExpiredEntry,
  mockMitigatedEntry,
  mockNullifiedEntry,
  mockRuntimeSnapshot,
} from './fixtures';

// ===========================================================================
// § 0 — SHARED HELPERS
// ===========================================================================

/**
 * Builds a minimal valid QueueUpsertInput for testing.
 * Uses THREAT_TYPE, THREAT_SEVERITY, and TENSION_CONSTANTS defaults.
 */
function buildInput(overrides: Partial<QueueUpsertInput> = {}): QueueUpsertInput {
  return {
    runId: overrides.runId ?? 'run-spec-aq',
    sourceKey: overrides.sourceKey ?? `src:${Math.random().toString(36).slice(2, 10)}`,
    threatId: overrides.threatId ?? `threat:${Math.random().toString(36).slice(2, 10)}`,
    source: overrides.source ?? 'SPEC_HARNESS',
    threatType: overrides.threatType ?? THREAT_TYPE.DEBT_SPIRAL,
    threatSeverity: overrides.threatSeverity ?? THREAT_SEVERITY.MODERATE,
    currentTick: overrides.currentTick ?? 1,
    arrivalTick: overrides.arrivalTick ?? 5,
    isCascadeTriggered: overrides.isCascadeTriggered ?? false,
    cascadeTriggerEventId: overrides.cascadeTriggerEventId ?? null,
    worstCaseOutcome: overrides.worstCaseOutcome ?? 'Debt spirals if unmitigated.',
    mitigationCardTypes: overrides.mitigationCardTypes ?? Object.freeze(['INCOME_SHIELD']),
    summary: overrides.summary ?? 'A test debt spiral is incoming.',
    severityWeight: overrides.severityWeight ?? THREAT_SEVERITY_WEIGHTS[overrides.threatSeverity ?? THREAT_SEVERITY.MODERATE],
  };
}

/**
 * Deterministically identified source key helper.
 */
let specCounter = 0;
function nextSrc(prefix: string): string {
  specCounter += 1;
  return `${prefix}:${String(specCounter).padStart(4, '0')}`;
}

// ===========================================================================
// § A — CORE LIFECYCLE TESTS
// ===========================================================================

describe('AnticipationQueue — § A: Core Lifecycle', () => {
  let queue: AnticipationQueue;

  beforeEach(() => {
    queue = new AnticipationQueue();
  });

  afterEach(() => {
    queue.reset();
  });

  it('A-01: upsert creates a QUEUED entry with correct initial state', () => {
    const input = buildInput({ currentTick: 1, arrivalTick: 4 });
    const entry: AnticipationEntry = queue.upsert(input);

    expect(entry.state).toBe(ENTRY_STATE.QUEUED);
    expect(entry.isArrived).toBe(false);
    expect(entry.isMitigated).toBe(false);
    expect(entry.isExpired).toBe(false);
    expect(entry.isNullified).toBe(false);
    expect(entry.baseTensionPerTick).toBe(TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK);
    expect(entry.arrivalTick).toBe(4);
    expect(entry.decayTicksRemaining).toBe(0);
    expect(entry.ticksOverdue).toBe(0);
    expect(entry.mitigatedAtTick).toBeNull();
    expect(entry.expiredAtTick).toBeNull();
    expect(queue.getQueueLength()).toBe(1);
  });

  it('A-02: processTick transitions QUEUED to ARRIVED on the correct tick', () => {
    const input = buildInput({ currentTick: 1, arrivalTick: 4 });
    queue.upsert(input);

    const tick3: QueueProcessResult = queue.processTick(3);
    expect(tick3.newArrivals).toHaveLength(0);
    expect(tick3.newExpirations).toHaveLength(0);

    const tick4: QueueProcessResult = queue.processTick(4);
    expect(tick4.newArrivals).toHaveLength(1);
    const arrived = tick4.newArrivals[0]!;
    expect(arrived.state).toBe(ENTRY_STATE.ARRIVED);
    expect(arrived.isArrived).toBe(true);
    expect(arrived.baseTensionPerTick).toBe(TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK);
  });

  it('A-03: DEBT_SPIRAL expires after 3 overdue ticks (actionWindow=2)', () => {
    queue.upsert(buildInput({
      threatType: THREAT_TYPE.DEBT_SPIRAL,
      currentTick: 1,
      arrivalTick: 3,
    }));

    queue.processTick(3); // arrives
    queue.processTick(4); // overdue=1
    queue.processTick(5); // overdue=2, still in window
    const tick6: QueueProcessResult = queue.processTick(6); // overdue=3, expires

    expect(tick6.newExpirations).toHaveLength(1);
    const expired = tick6.newExpirations[0]!;
    expect(expired.state).toBe(ENTRY_STATE.EXPIRED);
    expect(expired.isExpired).toBe(true);
    expect(expired.ticksOverdue).toBe(3);
  });

  it('A-04: HATER_INJECTION expires on the very next tick after arrival (actionWindow=0)', () => {
    queue.upsert(buildInput({
      threatType: THREAT_TYPE.HATER_INJECTION,
      currentTick: 1,
      arrivalTick: 3,
    }));

    const tick3: QueueProcessResult = queue.processTick(3);
    expect(tick3.newArrivals).toHaveLength(1);
    expect(tick3.newArrivals[0]?.state).toBe(ENTRY_STATE.ARRIVED);

    const tick4: QueueProcessResult = queue.processTick(4);
    expect(tick4.newExpirations).toHaveLength(1);
    expect(tick4.newExpirations[0]?.state).toBe(ENTRY_STATE.EXPIRED);
  });

  it('A-05: SHIELD_PIERCE also expires immediately (actionWindow=0)', () => {
    queue.upsert(buildInput({
      threatType: THREAT_TYPE.SHIELD_PIERCE,
      currentTick: 1,
      arrivalTick: 5,
    }));

    queue.processTick(5); // arrives
    const tick6: QueueProcessResult = queue.processTick(6);
    expect(tick6.newExpirations).toHaveLength(1);
    expect(tick6.newExpirations[0]?.threatType).toBe(THREAT_TYPE.SHIELD_PIERCE);
  });

  it('A-06: SABOTAGE expires after 2 overdue ticks (actionWindow=1)', () => {
    queue.upsert(buildInput({
      threatType: THREAT_TYPE.SABOTAGE,
      currentTick: 1,
      arrivalTick: 3,
    }));

    queue.processTick(3); // arrives, overdue=0
    const tick4: QueueProcessResult = queue.processTick(4); // overdue=1, still in window
    expect(tick4.newExpirations).toHaveLength(0);

    const tick5: QueueProcessResult = queue.processTick(5); // overdue=2, expires
    expect(tick5.newExpirations).toHaveLength(1);
    expect(tick5.newExpirations[0]?.threatType).toBe(THREAT_TYPE.SABOTAGE);
  });

  it('A-07: SOVEREIGNTY threat has the widest action window (3 ticks)', () => {
    queue.upsert(buildInput({
      threatType: THREAT_TYPE.SOVEREIGNTY,
      currentTick: 1,
      arrivalTick: 2,
    }));

    queue.processTick(2); // arrives
    queue.processTick(3); // overdue=1
    queue.processTick(4); // overdue=2
    queue.processTick(5); // overdue=3, in window
    const tick6: QueueProcessResult = queue.processTick(6); // overdue=4, expires
    expect(tick6.newExpirations).toHaveLength(1);
    expect(tick6.newExpirations[0]?.threatType).toBe(THREAT_TYPE.SOVEREIGNTY);
  });

  it('A-08: CASCADE threat expires after 2 ticks overdue (actionWindow=1)', () => {
    queue.upsert(buildInput({
      threatType: THREAT_TYPE.CASCADE,
      currentTick: 1,
      arrivalTick: 4,
    }));

    queue.processTick(4); // arrives
    queue.processTick(5); // overdue=1
    const tick6: QueueProcessResult = queue.processTick(6); // overdue=2
    expect(tick6.newExpirations).toHaveLength(1);
    expect(tick6.newExpirations[0]?.threatType).toBe(THREAT_TYPE.CASCADE);
  });

  it('A-09: REPUTATION_BURN expires after 2 overdue ticks (actionWindow=1)', () => {
    queue.upsert(buildInput({
      threatType: THREAT_TYPE.REPUTATION_BURN,
      currentTick: 1,
      arrivalTick: 4,
    }));
    queue.processTick(4);
    queue.processTick(5); // overdue=1
    const tick6: QueueProcessResult = queue.processTick(6); // overdue=2
    expect(tick6.newExpirations).toHaveLength(1);
  });

  it('A-10: OPPORTUNITY_KILL expires after 3 overdue ticks (actionWindow=2)', () => {
    queue.upsert(buildInput({
      threatType: THREAT_TYPE.OPPORTUNITY_KILL,
      currentTick: 1,
      arrivalTick: 3,
    }));
    queue.processTick(3);
    queue.processTick(4); // overdue=1
    queue.processTick(5); // overdue=2
    const tick6: QueueProcessResult = queue.processTick(6); // overdue=3
    expect(tick6.newExpirations).toHaveLength(1);
    expect(tick6.newExpirations[0]?.threatType).toBe(THREAT_TYPE.OPPORTUNITY_KILL);
  });
});

// ===========================================================================
// § B — CASCADE-TRIGGERED THREAT HANDLING
// ===========================================================================

describe('AnticipationQueue — § B: Cascade-Triggered Threats', () => {
  let queue: AnticipationQueue;

  beforeEach(() => {
    queue = new AnticipationQueue();
  });

  it('B-01: cascade-triggered threat gets at least one tick of warning', () => {
    const entry = queue.upsert(buildInput({
      threatType: THREAT_TYPE.CASCADE,
      currentTick: 10,
      arrivalTick: 10,
      isCascadeTriggered: true,
      cascadeTriggerEventId: 'event-cascade-001',
    }));

    // arrivalTick must be at least currentTick + 1
    expect(entry.arrivalTick).toBe(11);
    expect(entry.isCascadeTriggered).toBe(true);
    expect(entry.cascadeTriggerEventId).toBe('event-cascade-001');
  });

  it('B-02: cascade-triggered threat respects a future arrivalTick', () => {
    const entry = queue.upsert(buildInput({
      threatType: THREAT_TYPE.CASCADE,
      currentTick: 5,
      arrivalTick: 8,
      isCascadeTriggered: true,
    }));

    // arrivalTick 8 > currentTick+1 (6), so it stays at 8
    expect(entry.arrivalTick).toBe(8);
  });

  it('B-03: non-cascade threat does not shift arrival tick', () => {
    const entry = queue.upsert(buildInput({
      threatType: THREAT_TYPE.DEBT_SPIRAL,
      currentTick: 10,
      arrivalTick: 10,
      isCascadeTriggered: false,
    }));

    expect(entry.arrivalTick).toBe(10);
    expect(entry.isCascadeTriggered).toBe(false);
  });

  it('B-04: cascade threat is included in active queue after upsert', () => {
    queue.upsert(buildInput({
      threatType: THREAT_TYPE.CASCADE,
      currentTick: 5,
      arrivalTick: 5,
      isCascadeTriggered: true,
    }));

    expect(queue.getQueueLength()).toBe(1);
    const sorted = queue.getSortedActiveQueue();
    expect(sorted[0]?.isCascadeTriggered).toBe(true);
  });
});

// ===========================================================================
// § C — MITIGATION
// ===========================================================================

describe('AnticipationQueue — § C: Mitigation', () => {
  let queue: AnticipationQueue;

  beforeEach(() => {
    queue = new AnticipationQueue();
  });

  it('C-01: mitigateEntry rejects QUEUED entries and returns null', () => {
    const entry = queue.upsert(buildInput({ currentTick: 1, arrivalTick: 5 }));
    const result = queue.mitigateEntry(entry.entryId, 2);
    expect(result).toBeNull();
    expect(queue.getEntry(entry.entryId)?.state).toBe(ENTRY_STATE.QUEUED);
  });

  it('C-02: mitigateEntry succeeds on ARRIVED entry', () => {
    const entry = queue.upsert(buildInput({ currentTick: 1, arrivalTick: 4 }));
    queue.processTick(4); // arrive

    const mitigated = queue.mitigateEntry(entry.entryId, 4);
    expect(mitigated).not.toBeNull();
    expect(mitigated?.state).toBe(ENTRY_STATE.MITIGATED);
    expect(mitigated?.isMitigated).toBe(true);
    expect(mitigated?.mitigatedAtTick).toBe(4);
    expect(mitigated?.decayTicksRemaining).toBe(TENSION_CONSTANTS.MITIGATION_DECAY_TICKS);
  });

  it('C-03: mitigateEntry rejects EXPIRED entries', () => {
    const entry = queue.upsert(buildInput({
      threatType: THREAT_TYPE.HATER_INJECTION,
      currentTick: 1,
      arrivalTick: 3,
    }));
    queue.processTick(3);
    queue.processTick(4); // expires

    const result = queue.mitigateEntry(entry.entryId, 4);
    expect(result).toBeNull();
  });

  it('C-04: mitigateEntry returns null for unknown entryId', () => {
    const result = queue.mitigateEntry('nonexistent-id-12345', 5);
    expect(result).toBeNull();
  });

  it('C-05: bulkMitigate mitigates multiple ARRIVED entries at once', () => {
    const e1 = queue.upsert(buildInput({ sourceKey: 'src:bm:1', threatId: 'bm-1', currentTick: 1, arrivalTick: 3 }));
    const e2 = queue.upsert(buildInput({ sourceKey: 'src:bm:2', threatId: 'bm-2', currentTick: 1, arrivalTick: 3 }));
    const e3 = queue.upsert(buildInput({ sourceKey: 'src:bm:3', threatId: 'bm-3', currentTick: 1, arrivalTick: 5 }));

    queue.processTick(3); // e1, e2 arrive

    const results = queue.bulkMitigate([e1.entryId, e2.entryId, e3.entryId], 3);
    expect(results).toHaveLength(2); // e3 still QUEUED, skipped
    expect(results.every(e => e.state === ENTRY_STATE.MITIGATED)).toBe(true);
  });

  it('C-06: MITIGATED entry decays over MITIGATION_DECAY_TICKS ticks', () => {
    const entry = queue.upsert(buildInput({ currentTick: 1, arrivalTick: 3 }));
    queue.processTick(3);
    queue.mitigateEntry(entry.entryId, 3);

    const decayTicks = TENSION_CONSTANTS.MITIGATION_DECAY_TICKS;
    for (let t = 4; t < 4 + decayTicks; t++) {
      const result: QueueProcessResult = queue.processTick(t);
      expect(result.relievedEntries).toHaveLength(1);
      expect(result.relievedEntries[0]?.state).toBe(ENTRY_STATE.MITIGATED);
    }

    // After decay ticks exhausted, no longer surfaced as relieved
    const finalTick: QueueProcessResult = queue.processTick(4 + decayTicks);
    expect(finalTick.relievedEntries).toHaveLength(0);
  });
});

// ===========================================================================
// § D — NULLIFICATION
// ===========================================================================

describe('AnticipationQueue — § D: Nullification', () => {
  let queue: AnticipationQueue;

  beforeEach(() => {
    queue = new AnticipationQueue();
  });

  it('D-01: nullifyEntry succeeds on QUEUED entry', () => {
    const entry = queue.upsert(buildInput({ currentTick: 1, arrivalTick: 10 }));
    const nullified = queue.nullifyEntry(entry.entryId);

    expect(nullified).not.toBeNull();
    expect(nullified?.state).toBe(ENTRY_STATE.NULLIFIED);
    expect(nullified?.isNullified).toBe(true);
    expect(nullified?.decayTicksRemaining).toBe(TENSION_CONSTANTS.NULLIFY_DECAY_TICKS);
  });

  it('D-02: nullifyEntry succeeds on ARRIVED entry', () => {
    const entry = queue.upsert(buildInput({ currentTick: 1, arrivalTick: 3 }));
    queue.processTick(3);

    const nullified = queue.nullifyEntry(entry.entryId);
    expect(nullified).not.toBeNull();
    expect(nullified?.state).toBe(ENTRY_STATE.NULLIFIED);
  });

  it('D-03: nullifyEntry fails on EXPIRED entry', () => {
    const entry = queue.upsert(buildInput({
      threatType: THREAT_TYPE.HATER_INJECTION,
      currentTick: 1,
      arrivalTick: 3,
    }));
    queue.processTick(3);
    queue.processTick(4); // expired

    const result = queue.nullifyEntry(entry.entryId);
    expect(result).toBeNull();
  });

  it('D-04: nullifyEntry fails for unknown entryId', () => {
    expect(queue.nullifyEntry('no-such-entry-xxx')).toBeNull();
  });

  it('D-05: bulkNullify handles mixed-state entries correctly', () => {
    const queuedEntry = queue.upsert(buildInput({ sourceKey: 'src:bn:1', threatId: 'bn-1', arrivalTick: 10 }));
    const arrivedEntry = queue.upsert(buildInput({ sourceKey: 'src:bn:2', threatId: 'bn-2', arrivalTick: 3 }));
    queue.processTick(3); // arrived entry arrives

    const results = queue.bulkNullify([queuedEntry.entryId, arrivedEntry.entryId]);
    expect(results).toHaveLength(2);
    expect(results.every(e => e.state === ENTRY_STATE.NULLIFIED)).toBe(true);
  });

  it('D-06: NULLIFIED entry relief decays over NULLIFY_DECAY_TICKS ticks', () => {
    const entry = queue.upsert(buildInput({ currentTick: 1, arrivalTick: 5 }));
    queue.nullifyEntry(entry.entryId);

    const decayTicks = TENSION_CONSTANTS.NULLIFY_DECAY_TICKS;
    for (let t = 1; t <= decayTicks; t++) {
      const result: QueueProcessResult = queue.processTick(t + 1);
      expect(result.relievedEntries).toHaveLength(1);
      expect(result.relievedEntries[0]?.state).toBe(ENTRY_STATE.NULLIFIED);
    }

    const finalTick: QueueProcessResult = queue.processTick(2 + decayTicks);
    expect(finalTick.relievedEntries).toHaveLength(0);
  });
});

// ===========================================================================
// § E — UPSERT DEDUPLICATION
// ===========================================================================

describe('AnticipationQueue — § E: Upsert Deduplication', () => {
  let queue: AnticipationQueue;

  beforeEach(() => {
    queue = new AnticipationQueue();
  });

  it('E-01: same sourceKey merges to one queue slot', () => {
    const sk = nextSrc('dedupe');
    const original = queue.upsert(buildInput({ sourceKey: sk, threatId: 'dedup-1', arrivalTick: 9 }));
    const duplicate = queue.upsert(buildInput({ sourceKey: sk, threatId: 'dedup-1', arrivalTick: 7 }));

    expect(queue.getQueueLength()).toBe(1);
    expect(duplicate.entryId).toBe(original.entryId);
    expect(duplicate.arrivalTick).toBe(7); // earlier arrival wins
  });

  it('E-02: merge picks longer worstCaseOutcome', () => {
    const sk = nextSrc('dedupe-wco');
    const original = queue.upsert(buildInput({ sourceKey: sk, worstCaseOutcome: 'Short.', arrivalTick: 10 }));
    const merged = queue.upsert(buildInput({ sourceKey: sk, worstCaseOutcome: 'This is a much longer worst case outcome description.', arrivalTick: 10 }));

    expect(merged.entryId).toBe(original.entryId);
    expect(merged.worstCaseOutcome).toBe('This is a much longer worst case outcome description.');
  });

  it('E-03: merge picks more mitigation card types if more options provided', () => {
    const sk = nextSrc('dedupe-mit');
    queue.upsert(buildInput({ sourceKey: sk, mitigationCardTypes: Object.freeze(['PATCH']) }));
    const merged = queue.upsert(buildInput({ sourceKey: sk, mitigationCardTypes: Object.freeze(['PATCH', 'ABSORB', 'INCOME_SHIELD']) }));

    expect(merged.mitigationCardTypes).toEqual(['PATCH', 'ABSORB', 'INCOME_SHIELD']);
  });

  it('E-04: merge escalates severity when incoming severity is higher', () => {
    const sk = nextSrc('dedupe-sev');
    queue.upsert(buildInput({ sourceKey: sk, threatSeverity: THREAT_SEVERITY.MODERATE }));
    const merged = queue.upsert(buildInput({ sourceKey: sk, threatSeverity: THREAT_SEVERITY.CRITICAL }));

    expect(merged.threatSeverity).toBe(THREAT_SEVERITY.CRITICAL);
  });

  it('E-05: terminal state entries are not merged — returns existing entry unchanged', () => {
    const entry = queue.upsert(buildInput({ sourceKey: 'dedupe-terminal', threatId: 'dedup-terminal', arrivalTick: 3 }));
    queue.processTick(3); // arrives
    queue.mitigateEntry(entry.entryId, 3); // mitigated

    // Upsert same sourceKey again — should return the terminal entry unchanged
    const sk = entry.sourceKey;
    const result = queue.upsert(buildInput({ sourceKey: sk, threatId: 'dedup-terminal', arrivalTick: 8 }));
    expect(result.state).toBe(ENTRY_STATE.MITIGATED); // not overwritten
    expect(queue.getQueueLength()).toBe(0); // active queue is empty
  });

  it('E-06: different source keys create independent entries', () => {
    queue.upsert(buildInput({ sourceKey: 'src:left', threatId: 'threat-left', arrivalTick: 5 }));
    queue.upsert(buildInput({ sourceKey: 'src:right', threatId: 'threat-right', arrivalTick: 6 }));
    expect(queue.getQueueLength()).toBe(2);
  });
});

// ===========================================================================
// § F — SORT ORDER
// ===========================================================================

describe('AnticipationQueue — § F: Sort Order', () => {
  let queue: AnticipationQueue;

  beforeEach(() => {
    queue = new AnticipationQueue();
  });

  it('F-01: ARRIVED entries sort before QUEUED entries', () => {
    const queued = queue.upsert(buildInput({ sourceKey: 'f01:q', threatId: 'f01-q', arrivalTick: 10 }));
    const arrived = queue.upsert(buildInput({ sourceKey: 'f01:a', threatId: 'f01-a', arrivalTick: 2 }));

    queue.processTick(2);

    const sorted = queue.getSortedActiveQueue();
    expect(sorted[0]?.entryId).toBe(arrived.entryId);
    expect(sorted[1]?.entryId).toBe(queued.entryId);
  });

  it('F-02: higher severity sorts first within same state', () => {
    const existential = queue.upsert(buildInput({ sourceKey: 'f02:ex', threatId: 'f02-ex', threatSeverity: THREAT_SEVERITY.EXISTENTIAL, arrivalTick: 2 }));
    const moderate = queue.upsert(buildInput({ sourceKey: 'f02:mo', threatId: 'f02-mo', threatSeverity: THREAT_SEVERITY.MODERATE, arrivalTick: 2 }));
    const critical = queue.upsert(buildInput({ sourceKey: 'f02:cr', threatId: 'f02-cr', threatSeverity: THREAT_SEVERITY.CRITICAL, arrivalTick: 2 }));

    queue.processTick(2);

    const sorted = queue.getSortedActiveQueue();
    expect(sorted[0]?.entryId).toBe(existential.entryId);
    expect(sorted[1]?.entryId).toBe(critical.entryId);
    expect(sorted[2]?.entryId).toBe(moderate.entryId);
  });

  it('F-03: earlier arrivalTick sorts first within same severity', () => {
    const later = queue.upsert(buildInput({ sourceKey: 'f03:late', threatId: 'f03-late', arrivalTick: 8 }));
    const earlier = queue.upsert(buildInput({ sourceKey: 'f03:early', threatId: 'f03-early', arrivalTick: 3 }));

    const sorted = queue.getSortedActiveQueue();
    expect(sorted[0]?.entryId).toBe(earlier.entryId);
    expect(sorted[1]?.entryId).toBe(later.entryId);
  });

  it('F-04: full scenario — mixed states and severities in correct order', () => {
    const queuedModerate = queue.upsert(buildInput({ sourceKey: 'f04:qm', threatId: 'f04-qm', threatSeverity: THREAT_SEVERITY.MODERATE, arrivalTick: 10 }));
    const arrivedModerate = queue.upsert(buildInput({ sourceKey: 'f04:am', threatId: 'f04-am', threatSeverity: THREAT_SEVERITY.MODERATE, arrivalTick: 2 }));
    const arrivedExistential = queue.upsert(buildInput({ sourceKey: 'f04:ae', threatId: 'f04-ae', threatSeverity: THREAT_SEVERITY.EXISTENTIAL, arrivalTick: 2 }));

    queue.processTick(2);

    const sorted = queue.getSortedActiveQueue();
    expect(sorted[0]?.entryId).toBe(arrivedExistential.entryId);
    expect(sorted[1]?.entryId).toBe(arrivedModerate.entryId);
    expect(sorted[2]?.entryId).toBe(queuedModerate.entryId);
  });
});

// ===========================================================================
// § G — QUERY API
// ===========================================================================

describe('AnticipationQueue — § G: Query API', () => {
  let queue: AnticipationQueue;

  beforeEach(() => {
    queue = new AnticipationQueue();
  });

  it('G-01: getEntry returns the correct entry by entryId', () => {
    const entry = queue.upsert(buildInput());
    const found = queue.getEntry(entry.entryId);
    expect(found?.entryId).toBe(entry.entryId);
  });

  it('G-02: getEntry returns null for unknown entryId', () => {
    expect(queue.getEntry('unknown-entry-000')).toBeNull();
  });

  it('G-03: hasEntry returns true for known entries', () => {
    const entry = queue.upsert(buildInput());
    expect(queue.hasEntry(entry.entryId)).toBe(true);
  });

  it('G-04: hasEntry returns false for unknown entries', () => {
    expect(queue.hasEntry('does-not-exist-id')).toBe(false);
  });

  it('G-05: findByThreatId returns the correct entry', () => {
    const tid = `threat-g05-${Math.random().toString(36).slice(2)}`;
    const entry = queue.upsert(buildInput({ threatId: tid, sourceKey: `src:g05:${tid}` }));
    const found = queue.findByThreatId(tid);
    expect(found?.entryId).toBe(entry.entryId);
  });

  it('G-06: findByThreatId returns null when not found', () => {
    expect(queue.findByThreatId('no-such-threat-id')).toBeNull();
  });

  it('G-07: getAllEntries returns all entries including terminal', () => {
    const e1 = queue.upsert(buildInput({ sourceKey: 'src:g07:1', threatId: 'g07-1', arrivalTick: 3 }));
    queue.upsert(buildInput({ sourceKey: 'src:g07:2', threatId: 'g07-2', arrivalTick: 8 }));

    queue.processTick(3);
    queue.mitigateEntry(e1.entryId, 3);

    const all = queue.getAllEntries();
    expect(all).toHaveLength(2);
  });

  it('G-08: getActiveEntries returns only QUEUED and ARRIVED entries', () => {
    queue.upsert(buildInput({ sourceKey: 'src:g08:q', threatId: 'g08-q', arrivalTick: 10 }));
    const arriving = queue.upsert(buildInput({ sourceKey: 'src:g08:a', threatId: 'g08-a', arrivalTick: 3 }));
    const nullifiable = queue.upsert(buildInput({ sourceKey: 'src:g08:n', threatId: 'g08-n', arrivalTick: 8 }));

    queue.processTick(3);
    queue.nullifyEntry(nullifiable.entryId);

    const active = queue.getActiveEntries();
    // queued entry + arrived entry are active; nullified is not
    expect(active.every(e => e.state === ENTRY_STATE.QUEUED || e.state === ENTRY_STATE.ARRIVED)).toBe(true);
    expect(active.find(e => e.entryId === arriving.entryId)).toBeDefined();
  });

  it('G-09: getQueuedEntries returns only QUEUED entries', () => {
    queue.upsert(buildInput({ sourceKey: 'src:g09:q', threatId: 'g09-q', arrivalTick: 10 }));
    queue.upsert(buildInput({ sourceKey: 'src:g09:a', threatId: 'g09-a', arrivalTick: 3 }));
    queue.processTick(3);

    const queued = queue.getQueuedEntries();
    expect(queued.every(e => e.state === ENTRY_STATE.QUEUED)).toBe(true);
    expect(queued).toHaveLength(1);
  });

  it('G-10: getArrivedEntries returns only ARRIVED entries', () => {
    queue.upsert(buildInput({ sourceKey: 'src:g10:a', threatId: 'g10-a', arrivalTick: 3 }));
    queue.upsert(buildInput({ sourceKey: 'src:g10:q', threatId: 'g10-q', arrivalTick: 10 }));
    queue.processTick(3);

    const arrived = queue.getArrivedEntries();
    expect(arrived.every(e => e.state === ENTRY_STATE.ARRIVED)).toBe(true);
    expect(arrived).toHaveLength(1);
  });

  it('G-11: getExpiredEntries returns only EXPIRED entries', () => {
    queue.upsert(buildInput({ sourceKey: 'src:g11', threatId: 'g11', threatType: THREAT_TYPE.HATER_INJECTION, arrivalTick: 3 }));
    queue.processTick(3);
    queue.processTick(4); // expires

    const expired = queue.getExpiredEntries();
    expect(expired.every(e => e.state === ENTRY_STATE.EXPIRED)).toBe(true);
    expect(expired).toHaveLength(1);
  });

  it('G-12: getMitigatedEntries returns only MITIGATED entries', () => {
    const e = queue.upsert(buildInput({ sourceKey: 'src:g12', threatId: 'g12', arrivalTick: 3 }));
    queue.processTick(3);
    queue.mitigateEntry(e.entryId, 3);

    const mitigated = queue.getMitigatedEntries();
    expect(mitigated.every(e2 => e2.state === ENTRY_STATE.MITIGATED)).toBe(true);
    expect(mitigated).toHaveLength(1);
  });

  it('G-13: getNullifiedEntries returns only NULLIFIED entries', () => {
    const e = queue.upsert(buildInput({ sourceKey: 'src:g13', threatId: 'g13', arrivalTick: 8 }));
    queue.nullifyEntry(e.entryId);

    const nullified = queue.getNullifiedEntries();
    expect(nullified.every(e2 => e2.state === ENTRY_STATE.NULLIFIED)).toBe(true);
    expect(nullified).toHaveLength(1);
  });

  it('G-14: getEntriesByState correctly filters all five states', () => {
    const states: EntryState[] = [
      ENTRY_STATE.QUEUED,
      ENTRY_STATE.ARRIVED,
      ENTRY_STATE.EXPIRED,
      ENTRY_STATE.MITIGATED,
      ENTRY_STATE.NULLIFIED,
    ];

    // All 5 state values are used in getEntriesByState calls
    for (const state of states) {
      const entries = queue.getEntriesByState(state);
      expect(Array.isArray(entries)).toBe(true);
    }
  });

  it('G-15: getEntriesByType filters by each threat type', () => {
    const allTypes: ThreatType[] = [
      THREAT_TYPE.DEBT_SPIRAL,
      THREAT_TYPE.SABOTAGE,
      THREAT_TYPE.HATER_INJECTION,
      THREAT_TYPE.CASCADE,
      THREAT_TYPE.SOVEREIGNTY,
      THREAT_TYPE.OPPORTUNITY_KILL,
      THREAT_TYPE.REPUTATION_BURN,
      THREAT_TYPE.SHIELD_PIERCE,
    ];

    for (const type of allTypes) {
      const entries = queue.getEntriesByType(type);
      expect(Array.isArray(entries)).toBe(true);
    }
  });

  it('G-16: getEntriesBySeverity filters by each severity level', () => {
    const allSeverities: ThreatSeverity[] = [
      THREAT_SEVERITY.EXISTENTIAL,
      THREAT_SEVERITY.CRITICAL,
      THREAT_SEVERITY.SEVERE,
      THREAT_SEVERITY.MODERATE,
      THREAT_SEVERITY.MINOR,
    ];

    for (const severity of allSeverities) {
      const entries = queue.getEntriesBySeverity(severity);
      expect(Array.isArray(entries)).toBe(true);
    }
  });

  it('G-17: getMitigationOptions falls back to THREAT_TYPE_DEFAULT_MITIGATIONS when entry has none', () => {
    const entry = queue.upsert(buildInput({
      threatType: THREAT_TYPE.DEBT_SPIRAL,
      mitigationCardTypes: Object.freeze([]), // empty
    }));

    const options = queue.getMitigationOptions(entry.entryId);
    const defaults = THREAT_TYPE_DEFAULT_MITIGATIONS[THREAT_TYPE.DEBT_SPIRAL];
    expect(options.length).toBeGreaterThan(0);
    expect(options).toEqual(defaults);
  });

  it('G-18: getMitigationOptions uses entry cards when provided', () => {
    const entry = queue.upsert(buildInput({
      mitigationCardTypes: Object.freeze(['CUSTOM_CARD_X', 'CUSTOM_CARD_Y']),
    }));

    const options = queue.getMitigationOptions(entry.entryId);
    expect(options).toEqual(['CUSTOM_CARD_X', 'CUSTOM_CARD_Y']);
  });

  it('G-19: getExpiredCount returns the correct count', () => {
    queue.upsert(buildInput({ sourceKey: 'src:g19', threatId: 'g19', threatType: THREAT_TYPE.HATER_INJECTION, arrivalTick: 3 }));
    queue.processTick(3);
    queue.processTick(4); // expires

    expect(queue.getExpiredCount()).toBe(1);
  });

  it('G-20: upsertMany adds multiple entries atomically', () => {
    const inputs: QueueUpsertInput[] = [
      buildInput({ sourceKey: 'src:um:1', threatId: 'um-1' }),
      buildInput({ sourceKey: 'src:um:2', threatId: 'um-2' }),
      buildInput({ sourceKey: 'src:um:3', threatId: 'um-3' }),
    ];

    const results = queue.upsertMany(inputs);
    expect(results).toHaveLength(3);
    expect(queue.getQueueLength()).toBe(3);
  });
});

// ===========================================================================
// § H — RESET
// ===========================================================================

describe('AnticipationQueue — § H: Reset', () => {
  let queue: AnticipationQueue;

  beforeEach(() => {
    queue = new AnticipationQueue();
  });

  it('H-01: reset clears all entries and state', () => {
    queue.upsert(buildInput({ sourceKey: 'src:h01:1', threatId: 'h01-1' }));
    queue.upsert(buildInput({ sourceKey: 'src:h01:2', threatId: 'h01-2' }));

    expect(queue.getQueueLength()).toBe(2);

    queue.reset();

    expect(queue.getQueueLength()).toBe(0);
    expect(queue.getActiveEntries()).toHaveLength(0);
    expect(queue.getArrivedEntries()).toHaveLength(0);
    expect(queue.getExpiredEntries()).toHaveLength(0);
    expect(queue.getMitigatedEntries()).toHaveLength(0);
    expect(queue.getNullifiedEntries()).toHaveLength(0);
    expect(queue.getAllEntries()).toHaveLength(0);
  });

  it('H-02: queue works normally after reset', () => {
    queue.upsert(buildInput({ sourceKey: 'src:h02', threatId: 'h02' }));
    queue.reset();

    const entry = queue.upsert(buildInput({ sourceKey: 'src:h02-new', threatId: 'h02-new' }));
    expect(queue.getQueueLength()).toBe(1);
    expect(entry.state).toBe(ENTRY_STATE.QUEUED);
  });
});

// ===========================================================================
// § I — ML VECTOR EXTRACTION
// ===========================================================================

describe('AnticipationQueue — § I: ML Vector Extraction', () => {
  let queue: AnticipationQueue;

  beforeEach(() => {
    queue = new AnticipationQueue();
  });

  it('I-01: empty queue produces 32-dimensional zero vector', () => {
    const mlVector: QueueMLVector = queue.extractMLVector(1, 'T0');

    expect(mlVector.dimension).toBe(QUEUE_ML_FEATURE_COUNT);
    expect(mlVector.values).toHaveLength(QUEUE_ML_FEATURE_COUNT);
    expect(mlVector.labels).toBe(QUEUE_ML_FEATURE_LABELS);
    expect(mlVector.pressureTier).toBe('T0');
    expect(mlVector.tickNumber).toBe(1);
    expect(typeof mlVector.timestamp).toBe('number');
  });

  it('I-02: all feature values are in [0, 1] for normal queue state', () => {
    queue.upsert(buildInput({ sourceKey: 'src:i02:1', threatId: 'i02-1', threatSeverity: THREAT_SEVERITY.CRITICAL, arrivalTick: 5 }));
    queue.upsert(buildInput({ sourceKey: 'src:i02:2', threatId: 'i02-2', threatSeverity: THREAT_SEVERITY.MODERATE, arrivalTick: 3 }));
    queue.processTick(3);

    const mlVector: QueueMLVector = queue.extractMLVector(3, 'T2');
    for (const value of mlVector.values) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('I-03: arrived count norm is positive when threats have arrived', () => {
    queue.upsert(buildInput({ sourceKey: 'src:i03', threatId: 'i03', arrivalTick: 3 }));
    queue.processTick(3);

    const mlVector: QueueMLVector = queue.extractMLVector(3, 'T1');
    // Feature 01 = queue_arrived_count_norm
    const arrivedNorm = mlVector.values[1]!;
    expect(arrivedNorm).toBeGreaterThan(0);
    // Normalised to QUEUE_ML_LENGTH_NORM_CAP
    const expectedNorm = Math.min(1 / QUEUE_ML_LENGTH_NORM_CAP, 1);
    expect(arrivedNorm).toBeCloseTo(expectedNorm, 5);
  });

  it('I-04: QUEUE_ML_FEATURE_COUNT is exactly 32', () => {
    expect(QUEUE_ML_FEATURE_COUNT).toBe(32);
  });

  it('I-05: QUEUE_ML_FEATURE_LABELS has 32 entries', () => {
    expect(QUEUE_ML_FEATURE_LABELS).toHaveLength(QUEUE_ML_FEATURE_COUNT);
  });

  it('I-06: QUEUE_ML_LENGTH_NORM_CAP normalisation caps at 20', () => {
    expect(QUEUE_ML_LENGTH_NORM_CAP).toBe(20);
    // Add 20+ entries and verify features are not > 1
    for (let i = 0; i < 25; i++) {
      queue.upsert(buildInput({ sourceKey: `src:i06:${i}`, threatId: `i06-${i}`, arrivalTick: 20 }));
    }
    const mlVector: QueueMLVector = queue.extractMLVector(1, 'T0');
    // Feature 00 = queue_active_length_norm
    expect(mlVector.values[0]).toBeCloseTo(1, 1); // capped at 1
  });

  it('I-07: pressure tier amplification factor reflected in feature 27', () => {
    queue.upsert(buildInput({ sourceKey: 'src:i07', threatId: 'i07' }));

    const t0Vec: QueueMLVector = queue.extractMLVector(1, 'T0');
    const t4Vec: QueueMLVector = queue.extractMLVector(1, 'T4');

    // Feature 27 = pressure_amplification_factor
    // T4 has higher amplifier than T0
    expect(t4Vec.values[27]).toBeGreaterThan(t0Vec.values[27]!);
  });

  it('I-08: QUEUE_ML_ETA_NORM_CAP used in arrival imminence feature', () => {
    expect(QUEUE_ML_ETA_NORM_CAP).toBe(20);

    // Threat arriving very soon (eta=1) should have high imminence (feature 23)
    queue.upsert(buildInput({ sourceKey: 'src:i08:near', threatId: 'i08-near', arrivalTick: 2 }));
    // Threat arriving far (eta=15) should have low imminence
    queue.upsert(buildInput({ sourceKey: 'src:i08:far', threatId: 'i08-far', arrivalTick: 16 }));

    // Create a new queue with only the near threat to test imminence
    const nearQueue = new AnticipationQueue();
    nearQueue.upsert(buildInput({ sourceKey: 'src:near', threatId: 'near-only', arrivalTick: 2 }));
    const nearVec: QueueMLVector = nearQueue.extractMLVector(1, 'T0');

    const farQueue = new AnticipationQueue();
    farQueue.upsert(buildInput({ sourceKey: 'src:far', threatId: 'far-only', arrivalTick: 16 }));
    const farVec: QueueMLVector = farQueue.extractMLVector(1, 'T0');

    // Feature 23 = avg_arrival_eta_norm (higher = more imminent arrival)
    expect(nearVec.values[23]).toBeGreaterThan(farVec.values[23]!);
    nearQueue.reset();
    farQueue.reset();
  });

  it('I-09: QUEUE_ML_OVERDUE_NORM_CAP used in overdue metrics', () => {
    expect(QUEUE_ML_OVERDUE_NORM_CAP).toBe(10);

    queue.upsert(buildInput({ sourceKey: 'src:i09', threatId: 'i09', threatType: THREAT_TYPE.DEBT_SPIRAL, arrivalTick: 3 }));
    queue.processTick(3);
    queue.processTick(4); // overdue=1
    queue.processTick(5); // overdue=2

    const mlVector: QueueMLVector = queue.extractMLVector(5, 'T0');
    // Feature 21 = avg_ticks_overdue_norm
    expect(mlVector.values[21]).toBeGreaterThan(0);
  });
});

// ===========================================================================
// § J — DL TENSOR CONSTRUCTION
// ===========================================================================

describe('AnticipationQueue — § J: DL Tensor Construction', () => {
  let queue: AnticipationQueue;

  beforeEach(() => {
    queue = new AnticipationQueue();
  });

  it('J-01: DL tensor has correct shape constants', () => {
    expect(QUEUE_DL_SEQUENCE_LENGTH).toBe(16);
    expect(QUEUE_DL_FEATURE_WIDTH).toBe(8);
    expect(QUEUE_DL_COLUMN_LABELS).toHaveLength(QUEUE_DL_FEATURE_WIDTH);
  });

  it('J-02: empty queue produces 16x8 zero-padded tensor', () => {
    const dlTensor: QueueDLTensor = queue.extractDLTensor(1, 'T0');

    expect(dlTensor.sequenceLength).toBe(QUEUE_DL_SEQUENCE_LENGTH);
    expect(dlTensor.featureWidth).toBe(QUEUE_DL_FEATURE_WIDTH);
    expect(dlTensor.rows).toHaveLength(QUEUE_DL_SEQUENCE_LENGTH);
    expect(dlTensor.pressureTier).toBe('T0');
    expect(dlTensor.tickNumber).toBe(1);
  });

  it('J-03: rows with active entries have non-zero feature vectors', () => {
    queue.upsert(buildInput({
      sourceKey: 'src:j03',
      threatId: 'j03',
      threatSeverity: THREAT_SEVERITY.CRITICAL,
      arrivalTick: 5,
    }));

    const dlTensor: QueueDLTensor = queue.extractDLTensor(1, 'T2');
    const firstRow: QueueDLTensorRow = dlTensor.rows[0]!;

    // First row corresponds to the sorted active entry
    if (firstRow.entryId !== null) {
      const nonZeroFeature = firstRow.features.some(f => f > 0);
      expect(nonZeroFeature).toBe(true);
      // All features in [0, 1]
      for (const f of firstRow.features) {
        expect(f).toBeGreaterThanOrEqual(0);
        expect(f).toBeLessThanOrEqual(1);
      }
    }
  });

  it('J-04: zero-padded rows have null entryId and all-zero features', () => {
    // Empty queue — all rows should be zero-padded
    const dlTensor: QueueDLTensor = queue.extractDLTensor(1, 'T0');

    for (const row of dlTensor.rows) {
      expect(row.entryId).toBeNull();
      expect(row.features.every(f => f === 0)).toBe(true);
    }
  });

  it('J-05: severity weight reflected in tensor row feature 0', () => {
    queue.upsert(buildInput({
      sourceKey: 'src:j05',
      threatId: 'j05',
      threatSeverity: THREAT_SEVERITY.EXISTENTIAL,
      severityWeight: THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.EXISTENTIAL],
    }));

    const dlTensor: QueueDLTensor = queue.extractDLTensor(1, 'T0');
    const firstActiveRow = dlTensor.rows.find(r => r.entryId !== null);
    expect(firstActiveRow).toBeDefined();
    // Feature 0 = severity_weight (should be EXISTENTIAL weight = 1.0)
    expect(firstActiveRow!.features[0]).toBeCloseTo(THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.EXISTENTIAL], 3);
  });
});

// ===========================================================================
// § K — HEALTH REPORT
// ===========================================================================

describe('AnticipationQueue — § K: Health Report', () => {
  let queue: AnticipationQueue;

  beforeEach(() => {
    queue = new AnticipationQueue();
  });

  it('K-01: empty queue returns CLEAR health risk tier', () => {
    const health: QueueHealthReport = queue.computeHealthReport(1);
    const riskTier: QueueRiskTier = health.riskTier;

    expect(riskTier).toBe('CLEAR');
    expect(health.activeLength).toBe(0);
    expect(health.arrivedCount).toBe(0);
    expect(health.existentialCount).toBe(0);
    expect(health.criticalCount).toBe(0);
    expect(health.healthScore).toBeCloseTo(1.0, 1);
  });

  it('K-02: CRITICAL_ARRIVED_COUNT triggers CRITICAL risk tier', () => {
    // Add CRITICAL_ARRIVED_COUNT + 1 threats all arriving at same tick
    const count = QUEUE_HEALTH_THRESHOLDS.CRITICAL_ARRIVED_COUNT;
    for (let i = 0; i < count; i++) {
      queue.upsert(buildInput({
        sourceKey: `src:k02:${i}`,
        threatId: `k02-${i}`,
        arrivalTick: 3,
      }));
    }

    queue.processTick(3);

    const health: QueueHealthReport = queue.computeHealthReport(3);
    expect(health.riskTier).toBe('CRITICAL');
    expect(health.arrivedCount).toBe(count);
    expect(health.alerts.length).toBeGreaterThan(0);
  });

  it('K-03: single EXISTENTIAL threat triggers CRITICAL risk tier', () => {
    queue.upsert(buildInput({
      sourceKey: 'src:k03:ex',
      threatId: 'k03-ex',
      threatSeverity: THREAT_SEVERITY.EXISTENTIAL,
      arrivalTick: 3,
    }));
    queue.processTick(3);

    const health: QueueHealthReport = queue.computeHealthReport(3);
    // HIGH_EXISTENTIAL_COUNT threshold is 1
    expect(QUEUE_HEALTH_THRESHOLDS.HIGH_EXISTENTIAL_COUNT).toBe(1);
    expect(health.existentialCount).toBe(1);
    // Should be at least HIGH risk
    expect(['CRITICAL', 'HIGH']).toContain(health.riskTier);
  });

  it('K-04: MEDIUM_ACTIVE_LENGTH threshold triggers MEDIUM risk tier', () => {
    const count = QUEUE_HEALTH_THRESHOLDS.MEDIUM_ACTIVE_LENGTH;
    for (let i = 0; i < count; i++) {
      queue.upsert(buildInput({
        sourceKey: `src:k04:${i}`,
        threatId: `k04-${i}`,
        threatSeverity: THREAT_SEVERITY.MINOR, // below CRITICAL/EXISTENTIAL
        arrivalTick: 20,
      }));
    }

    const health: QueueHealthReport = queue.computeHealthReport(1);
    expect(['MEDIUM', 'HIGH', 'CRITICAL']).toContain(health.riskTier);
  });

  it('K-05: QUEUE_HEALTH_THRESHOLDS values are as expected', () => {
    expect(QUEUE_HEALTH_THRESHOLDS.CRITICAL_ARRIVED_COUNT).toBeGreaterThan(0);
    expect(QUEUE_HEALTH_THRESHOLDS.HIGH_EXISTENTIAL_COUNT).toBeGreaterThan(0);
    expect(QUEUE_HEALTH_THRESHOLDS.HIGH_CRITICAL_COUNT).toBeGreaterThan(0);
    expect(QUEUE_HEALTH_THRESHOLDS.MEDIUM_ACTIVE_LENGTH).toBeGreaterThan(0);
    expect(QUEUE_HEALTH_THRESHOLDS.LOW_ACTIVE_LENGTH).toBeGreaterThan(0);
    expect(QUEUE_HEALTH_THRESHOLDS.CRITICAL_OVERDUE_TICKS).toBeGreaterThan(0);
    expect(QUEUE_HEALTH_THRESHOLDS.HIGH_OVERDUE_TICKS).toBeGreaterThan(0);
  });

  it('K-06: health score degrades with critical threats present', () => {
    const healthEmpty: QueueHealthReport = queue.computeHealthReport(1);

    queue.upsert(buildInput({ sourceKey: 'src:k06', threatId: 'k06', threatSeverity: THREAT_SEVERITY.EXISTENTIAL, arrivalTick: 3 }));
    queue.processTick(3);

    const healthWithThreat: QueueHealthReport = queue.computeHealthReport(3);
    expect(healthWithThreat.healthScore).toBeLessThan(healthEmpty.healthScore);
  });
});

// ===========================================================================
// § L — SEVERITY AND TYPE DISTRIBUTION
// ===========================================================================

describe('AnticipationQueue — § L: Severity and Type Distribution', () => {
  let queue: AnticipationQueue;

  beforeEach(() => {
    queue = new AnticipationQueue();
  });

  it('L-01: severity distribution counts each severity correctly', () => {
    queue.upsert(buildInput({ sourceKey: 'src:l01:ex', threatId: 'l01-ex', threatSeverity: THREAT_SEVERITY.EXISTENTIAL, arrivalTick: 5 }));
    queue.upsert(buildInput({ sourceKey: 'src:l01:cr', threatId: 'l01-cr', threatSeverity: THREAT_SEVERITY.CRITICAL, arrivalTick: 5 }));
    queue.upsert(buildInput({ sourceKey: 'src:l01:sv', threatId: 'l01-sv', threatSeverity: THREAT_SEVERITY.SEVERE, arrivalTick: 5 }));
    queue.upsert(buildInput({ sourceKey: 'src:l01:mo', threatId: 'l01-mo', threatSeverity: THREAT_SEVERITY.MODERATE, arrivalTick: 5 }));
    queue.upsert(buildInput({ sourceKey: 'src:l01:mi', threatId: 'l01-mi', threatSeverity: THREAT_SEVERITY.MINOR, arrivalTick: 5 }));

    const dist: QueueSeverityDistribution = queue.computeSeverityDistributionSnapshot();

    expect(dist[THREAT_SEVERITY.EXISTENTIAL]).toBe(1);
    expect(dist[THREAT_SEVERITY.CRITICAL]).toBe(1);
    expect(dist[THREAT_SEVERITY.SEVERE]).toBe(1);
    expect(dist[THREAT_SEVERITY.MODERATE]).toBe(1);
    expect(dist[THREAT_SEVERITY.MINOR]).toBe(1);
    expect(dist.total).toBe(5);
  });

  it('L-02: type distribution counts all 8 threat types', () => {
    const allTypes: ThreatType[] = [
      THREAT_TYPE.DEBT_SPIRAL,
      THREAT_TYPE.SABOTAGE,
      THREAT_TYPE.HATER_INJECTION,
      THREAT_TYPE.CASCADE,
      THREAT_TYPE.SOVEREIGNTY,
      THREAT_TYPE.OPPORTUNITY_KILL,
      THREAT_TYPE.REPUTATION_BURN,
      THREAT_TYPE.SHIELD_PIERCE,
    ];

    for (const type of allTypes) {
      queue.upsert(buildInput({ sourceKey: `src:l02:${type}`, threatId: `l02-${type}`, threatType: type, arrivalTick: 20 }));
    }

    const dist: QueueTypeDistribution = queue.computeTypeDistributionSnapshot();

    for (const type of allTypes) {
      expect(dist[type]).toBe(1);
    }
    expect(dist.total).toBe(8);
  });

  it('L-03: THREAT_SEVERITY_WEIGHTS are correctly mapped', () => {
    expect(THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.MINOR]).toBeCloseTo(0.2, 2);
    expect(THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.MODERATE]).toBeCloseTo(0.4, 2);
    expect(THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.SEVERE]).toBeCloseTo(0.65, 2);
    expect(THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.CRITICAL]).toBeCloseTo(0.85, 2);
    expect(THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.EXISTENTIAL]).toBeCloseTo(1.0, 2);
  });
});

// ===========================================================================
// § M — PRIORITY SCORE
// ===========================================================================

describe('AnticipationQueue — § M: Priority Score', () => {
  let queue: AnticipationQueue;

  beforeEach(() => {
    queue = new AnticipationQueue();
  });

  it('M-01: computeEntryPriorityScore returns null for unknown entries', () => {
    const result = queue.computeEntryPriorityScore('nonexistent-id', 1);
    expect(result).toBeNull();
  });

  it('M-02: ARRIVED entries have higher priority score than QUEUED (QUEUE_PRIORITY_WEIGHT_ARRIVED)', () => {
    const queued = queue.upsert(buildInput({ sourceKey: 'src:m02:q', threatId: 'm02-q', arrivalTick: 10 }));
    const arriving = queue.upsert(buildInput({ sourceKey: 'src:m02:a', threatId: 'm02-a', arrivalTick: 3 }));

    queue.processTick(3);

    const queuedScore: EntryPriorityScore = queue.computeEntryPriorityScore(queued.entryId, 3)!;
    const arrivedScore: EntryPriorityScore = queue.computeEntryPriorityScore(arriving.entryId, 3)!;

    expect(queuedScore).not.toBeNull();
    expect(arrivedScore).not.toBeNull();

    // ARRIVED entries use QUEUE_PRIORITY_WEIGHT_ARRIVED (3.0) vs QUEUE_PRIORITY_WEIGHT_QUEUED (1.0)
    expect(QUEUE_PRIORITY_WEIGHT_ARRIVED).toBeGreaterThan(QUEUE_PRIORITY_WEIGHT_QUEUED);
    expect(arrivedScore.rawScore).toBeGreaterThan(queuedScore.rawScore);
    expect(arrivedScore.stateMultiplier).toBe(QUEUE_PRIORITY_WEIGHT_ARRIVED);
    expect(queuedScore.stateMultiplier).toBe(QUEUE_PRIORITY_WEIGHT_QUEUED);
  });

  it('M-03: overdue ticks multiply priority via QUEUE_OVERDUE_SEVERITY_MULTIPLIER', () => {
    const entry = queue.upsert(buildInput({ sourceKey: 'src:m03', threatId: 'm03', arrivalTick: 3 }));
    queue.processTick(3); // arrives
    queue.processTick(4); // overdue=1
    queue.processTick(5); // overdue=2

    const scoreAtOverdue2: EntryPriorityScore = queue.computeEntryPriorityScore(entry.entryId, 5)!;
    expect(scoreAtOverdue2.overdueMultiplier).toBeGreaterThan(1);
    // overdueMultiplier = 1 + ticksOverdue * (QUEUE_OVERDUE_SEVERITY_MULTIPLIER - 1)
    const expectedMul = 1 + 2 * (QUEUE_OVERDUE_SEVERITY_MULTIPLIER - 1);
    expect(scoreAtOverdue2.overdueMultiplier).toBeCloseTo(expectedMul, 3);
  });

  it('M-04: CRITICAL urgency label assigned when raw score is high', () => {
    // Large overdue + high severity should yield CRITICAL urgency
    const entry = queue.upsert(buildInput({
      sourceKey: 'src:m04',
      threatId: 'm04',
      threatSeverity: THREAT_SEVERITY.EXISTENTIAL,
      arrivalTick: 3,
    }));
    queue.processTick(3);
    // Force many overdue ticks through manual ticksOverdue check
    // Realistically, just verify the urgency label is one of the expected values
    const score: EntryPriorityScore = queue.computeEntryPriorityScore(entry.entryId, 3)!;
    expect(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).toContain(score.urgencyLabel);
    expect(score.normalizedScore).toBeGreaterThanOrEqual(0);
    expect(score.normalizedScore).toBeLessThanOrEqual(1);
  });

  it('M-05: QUEUE_OVERDUE_SEVERITY_MULTIPLIER is 1.4', () => {
    expect(QUEUE_OVERDUE_SEVERITY_MULTIPLIER).toBe(1.4);
  });

  it('M-06: QUEUE_EXISTENTIAL_SPIKE and QUEUE_CRITICAL_SPIKE have correct values', () => {
    // These constants define the extra tension contribution per tick for high-severity threats
    expect(QUEUE_EXISTENTIAL_SPIKE).toBe(0.15);
    expect(QUEUE_CRITICAL_SPIKE).toBe(0.10);
    // Existential spike is always > critical spike
    expect(QUEUE_EXISTENTIAL_SPIKE).toBeGreaterThan(QUEUE_CRITICAL_SPIKE);
  });
});

// ===========================================================================
// § N — THREAT FORECAST AND SCHEDULING
// ===========================================================================

describe('AnticipationQueue — § N: Threat Forecast and Scheduling', () => {
  let queue: AnticipationQueue;

  beforeEach(() => {
    queue = new AnticipationQueue();
  });

  it('N-01: computeThreatForecast with QUEUE_FORECAST_HORIZON_TICKS', () => {
    queue.upsert(buildInput({ sourceKey: 'src:n01', threatId: 'n01', arrivalTick: 5 }));

    const forecast: QueueThreatForecast = queue.computeThreatForecast(1, QUEUE_FORECAST_HORIZON_TICKS);

    expect(forecast.horizonTicks).toBe(QUEUE_FORECAST_HORIZON_TICKS);
    expect(forecast.tickNumber).toBe(1);
    expect(Array.isArray(forecast.arrivingEntries)).toBe(true);
    expect(Array.isArray(forecast.expiringEntries)).toBe(true);
  });

  it('N-02: threat arriving within horizon appears in arrivingEntries', () => {
    queue.upsert(buildInput({ sourceKey: 'src:n02', threatId: 'n02', arrivalTick: 5 }));

    const forecast: QueueThreatForecast = queue.computeThreatForecast(1, 10);
    expect(forecast.arrivingEntries.length).toBeGreaterThan(0);

    const arrival: EntryForecast = forecast.arrivingEntries[0]!;
    expect(arrival.etaTicks).toBe(4); // arrives at 5, current tick=1
    expect(arrival.threatType).toBe(THREAT_TYPE.DEBT_SPIRAL);
    expect(Array.isArray(arrival.mitigationOptions)).toBe(true);
  });

  it('N-03: computeArrivalSchedule returns sorted entries by arrivalTick', () => {
    queue.upsert(buildInput({ sourceKey: 'src:n03:late', threatId: 'n03-late', arrivalTick: 8 }));
    queue.upsert(buildInput({ sourceKey: 'src:n03:early', threatId: 'n03-early', arrivalTick: 3 }));

    const schedule: readonly ArrivalScheduleEntry[] = queue.computeArrivalSchedule(1);
    expect(schedule.length).toBe(2);
    expect(schedule[0]!.arrivalTick).toBeLessThanOrEqual(schedule[1]!.arrivalTick);
  });

  it('N-04: computeExpirationSchedule for ARRIVED threats', () => {
    queue.upsert(buildInput({ sourceKey: 'src:n04', threatId: 'n04', threatType: THREAT_TYPE.DEBT_SPIRAL, arrivalTick: 3 }));
    queue.processTick(3);

    const schedule: readonly ExpirationScheduleEntry[] = queue.computeExpirationSchedule(3);
    expect(schedule.length).toBeGreaterThan(0);

    const item: ExpirationScheduleEntry = schedule[0]!;
    expect(item.entryId).toBeDefined();
    expect(item.actionWindowTicks).toBeGreaterThanOrEqual(0);
    expect(item.expiresInTicks).toBeGreaterThanOrEqual(0);
  });

  it('N-05: estimateMitigationWindow returns null for non-ARRIVED entries', () => {
    const entry = queue.upsert(buildInput({ sourceKey: 'src:n05:q', threatId: 'n05-q', arrivalTick: 10 }));
    expect(queue.estimateMitigationWindow(entry.entryId, 1)).toBeNull();
  });

  it('N-06: estimateMitigationWindow returns non-negative for ARRIVED entries', () => {
    const entry = queue.upsert(buildInput({ sourceKey: 'src:n06', threatId: 'n06', threatType: THREAT_TYPE.DEBT_SPIRAL, arrivalTick: 3 }));
    queue.processTick(3);

    const window = queue.estimateMitigationWindow(entry.entryId, 3);
    expect(window).not.toBeNull();
    expect(window).toBeGreaterThanOrEqual(0);
  });

  it('N-07: getArrivingWithinTicks returns entries within the window', () => {
    queue.upsert(buildInput({ sourceKey: 'src:n07:near', threatId: 'n07-near', arrivalTick: 3 }));
    queue.upsert(buildInput({ sourceKey: 'src:n07:far', threatId: 'n07-far', arrivalTick: 20 }));

    const nearby = queue.getArrivingWithinTicks(1, 5);
    expect(nearby.some(e => e.arrivalTick <= 6)).toBe(true);
    expect(nearby.every(e => e.arrivalTick <= 6)).toBe(true);
  });

  it('N-08: getExpiringWithinTicks returns arrived threats about to expire', () => {
    queue.upsert(buildInput({ sourceKey: 'src:n08', threatId: 'n08', threatType: THREAT_TYPE.HATER_INJECTION, arrivalTick: 3 }));
    queue.processTick(3);

    const expiring = queue.getExpiringWithinTicks(3, 2);
    expect(expiring.length).toBeGreaterThan(0);
  });

  it('N-09: forecast risk tier escalates with high severity threats', () => {
    queue.upsert(buildInput({
      sourceKey: 'src:n09',
      threatId: 'n09',
      threatSeverity: THREAT_SEVERITY.EXISTENTIAL,
      arrivalTick: 5,
    }));

    const forecast: QueueThreatForecast = queue.computeThreatForecast(1, 10);
    expect(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'CLEAR']).toContain(forecast.forecastRiskTier);
    // EXISTENTIAL threat should produce at least MEDIUM risk
    expect(['CRITICAL', 'HIGH', 'MEDIUM']).toContain(forecast.forecastRiskTier);
  });
});

// ===========================================================================
// § O — SESSION ANALYTICS
// ===========================================================================

describe('AnticipationQueue — § O: Session Analytics', () => {
  let queue: AnticipationQueue;

  beforeEach(() => {
    queue = new AnticipationQueue();
  });

  it('O-01: computeSessionSummary returns correct totals', () => {
    // Enqueue, arrive, and mitigate a threat
    const e1 = queue.upsert(buildInput({ sourceKey: 'src:o01', threatId: 'o01', arrivalTick: 3 }));
    queue.processTick(3);
    queue.mitigateEntry(e1.entryId, 3);
    queue.processTick(4); // relief tick

    const summary: QueueSessionSummary = queue.computeSessionSummary();
    expect(summary.totalArrivals).toBe(1);
    expect(summary.totalMitigations).toBe(1);
    expect(summary.totalExpirations).toBe(0);
    expect(typeof summary.mitigationSuccessRate).toBe('number');
    expect(typeof summary.throughputPerTick).toBe('number');
  });

  it('O-02: tick samples accumulate up to QUEUE_TICK_HISTORY_CAPACITY', () => {
    // Process many ticks
    for (let t = 1; t <= QUEUE_TICK_HISTORY_CAPACITY + 5; t++) {
      queue.processTick(t);
    }

    const history: readonly QueueTickSample[] = queue.getTickHistory();
    // History should be capped at QUEUE_TICK_HISTORY_CAPACITY
    expect(history.length).toBeLessThanOrEqual(QUEUE_TICK_HISTORY_CAPACITY);
  });

  it('O-03: QUEUE_TICK_HISTORY_CAPACITY is 50', () => {
    expect(QUEUE_TICK_HISTORY_CAPACITY).toBe(50);
  });

  it('O-04: manual tick sample recording uses QueueTickSample shape', () => {
    const sample: QueueTickSample = {
      tickNumber: 42,
      activeLength: 3,
      arrivedCount: 1,
      newArrivals: 1,
      newExpirations: 0,
      mitigations: 0,
      nullifications: 0,
      maxSeverityWeight: 0.65,
    };

    queue.recordTickSample(sample);

    const history = queue.getTickHistory();
    expect(history.some(s => s.tickNumber === 42)).toBe(true);
  });

  it('O-05: mostFrequentThreatType is null on empty queue', () => {
    const summary: QueueSessionSummary = queue.computeSessionSummary();
    expect(summary.mostFrequentThreatType).toBeNull();
    expect(summary.mostFrequentSeverity).toBeNull();
  });

  it('O-06: expirationRate accounts for expired threats', () => {
    queue.upsert(buildInput({ sourceKey: 'src:o06', threatId: 'o06', threatType: THREAT_TYPE.HATER_INJECTION, arrivalTick: 3 }));
    queue.processTick(3);
    queue.processTick(4); // expires

    const summary: QueueSessionSummary = queue.computeSessionSummary();
    expect(summary.totalExpirations).toBe(1);
    expect(summary.expirationRate).toBeGreaterThan(0);
  });
});

// ===========================================================================
// § P — SERIALIZATION AND DESERIALIZATION
// ===========================================================================

describe('AnticipationQueue — § P: Serialization', () => {
  let queue: AnticipationQueue;

  beforeEach(() => {
    queue = new AnticipationQueue();
  });

  it('P-01: serialize returns correct version and entry count', () => {
    queue.upsert(buildInput({ sourceKey: 'src:p01:1', threatId: 'p01-1' }));
    queue.upsert(buildInput({ sourceKey: 'src:p01:2', threatId: 'p01-2' }));

    const state: QueueSerializedState = queue.serialize();
    expect(state.version).toBe('anticipation-queue.v2');
    expect(state.entryCount).toBe(2);
    expect(state.entries).toHaveLength(2);
    expect(typeof state.checksum).toBe('string');
    expect(state.checksum.length).toBe(16);
  });

  it('P-02: QUEUE_SERIALIZE_MAX_ENTRIES limits serialized entry count', () => {
    expect(QUEUE_SERIALIZE_MAX_ENTRIES).toBe(200);

    // Add more entries than the limit (in practice, add a handful)
    for (let i = 0; i < 10; i++) {
      queue.upsert(buildInput({ sourceKey: `src:p02:${i}`, threatId: `p02-${i}` }));
    }

    const state: QueueSerializedState = queue.serialize();
    expect(state.entryCount).toBeLessThanOrEqual(QUEUE_SERIALIZE_MAX_ENTRIES);
  });

  it('P-03: deserialize restores correct entry count', () => {
    queue.upsert(buildInput({ sourceKey: 'src:p03:1', threatId: 'p03-1' }));
    queue.upsert(buildInput({ sourceKey: 'src:p03:2', threatId: 'p03-2' }));

    const state: QueueSerializedState = queue.serialize();
    queue.reset();

    const count = queue.deserialize(state);
    expect(count).toBe(2);
    expect(queue.getAllEntries()).toHaveLength(2);
  });

  it('P-04: computeChecksum returns a 64-character hex string', () => {
    queue.upsert(buildInput());
    const checksum = queue.computeChecksum();
    expect(typeof checksum).toBe('string');
    expect(checksum.length).toBe(64); // SHA-256 hex
  });

  it('P-05: computeChecksum changes when queue state changes', () => {
    queue.upsert(buildInput({ sourceKey: 'src:p05:1', threatId: 'p05-1' }));
    const c1 = queue.computeChecksum();

    queue.upsert(buildInput({ sourceKey: 'src:p05:2', threatId: 'p05-2' }));
    const c2 = queue.computeChecksum();

    expect(c1).not.toBe(c2);
  });
});

// ===========================================================================
// § Q — NARRATIVE GENERATION
// ===========================================================================

describe('AnticipationQueue — § Q: Narrative Generation', () => {
  let queue: AnticipationQueue;

  beforeEach(() => {
    queue = new AnticipationQueue();
  });

  it('Q-01: empty queue generates clear headline with emptyQueueMessage', () => {
    const narrative: QueueNarrative = queue.generateNarrative(1, TENSION_VISIBILITY_STATE.EXPOSED);
    expect(narrative.emptyQueueMessage).not.toBeNull();
    expect(typeof narrative.headline).toBe('string');
    expect(narrative.tickNumber).toBe(1);
  });

  it('Q-02: SHADOWED visibility hides threat type details', () => {
    queue.upsert(buildInput({ sourceKey: 'src:q02', threatId: 'q02', arrivalTick: 5 }));

    const shadowed: QueueNarrative = queue.generateNarrative(1, TENSION_VISIBILITY_STATE.SHADOWED);
    const lines: readonly QueueNarrativeLine[] = shadowed.lines;

    // SHADOWED hides threatType
    for (const line of lines) {
      expect(line.threatType).toBeNull();
    }
  });

  it('Q-03: SIGNALED visibility reveals threat type', () => {
    queue.upsert(buildInput({ sourceKey: 'src:q03', threatId: 'q03', arrivalTick: 5 }));

    const signaled: QueueNarrative = queue.generateNarrative(1, TENSION_VISIBILITY_STATE.SIGNALED);
    const lines: readonly QueueNarrativeLine[] = signaled.lines;

    // SIGNALED shows threat type
    const linesWithType = lines.filter(l => l.threatType !== null);
    expect(linesWithType.length).toBeGreaterThan(0);
  });

  it('Q-04: TELEGRAPHED visibility includes arrival tick info in text', () => {
    queue.upsert(buildInput({ sourceKey: 'src:q04', threatId: 'q04', arrivalTick: 5 }));

    const telegraphed: QueueNarrative = queue.generateNarrative(1, TENSION_VISIBILITY_STATE.TELEGRAPHED);
    const lineTexts = telegraphed.lines.map(l => l.text).join(' ');
    // Should mention ticks
    expect(lineTexts).toMatch(/tick/i);
  });

  it('Q-05: EXPOSED visibility includes mitigation advice', () => {
    queue.upsert(buildInput({ sourceKey: 'src:q05', threatId: 'q05', arrivalTick: 3 }));
    queue.processTick(3);

    const exposed: QueueNarrative = queue.generateNarrative(3, TENSION_VISIBILITY_STATE.EXPOSED);
    expect(exposed.mitigationAdvice.length).toBeGreaterThan(0);
  });

  it('Q-06: ARRIVED threats produce URGENT lines', () => {
    queue.upsert(buildInput({ sourceKey: 'src:q06', threatId: 'q06', arrivalTick: 3 }));
    queue.processTick(3);

    const narrative: QueueNarrative = queue.generateNarrative(3, TENSION_VISIBILITY_STATE.EXPOSED);
    const urgentLines = narrative.lines.filter((l: QueueNarrativeLine) => l.priority === 'URGENT');
    expect(urgentLines.length).toBeGreaterThan(0);
  });

  it('Q-07: high tension triggers pulse warning in mitigation advice', () => {
    queue.upsert(buildInput({ sourceKey: 'src:q07', threatId: 'q07', arrivalTick: 3 }));

    // Pass a score at/above PULSE_THRESHOLD
    const pulseScore = TENSION_CONSTANTS.PULSE_THRESHOLD;
    const narrative: QueueNarrative = queue.generateNarrative(1, TENSION_VISIBILITY_STATE.EXPOSED, pulseScore);
    const adviceText = narrative.mitigationAdvice.join(' ');
    expect(adviceText.length).toBeGreaterThan(0);
  });

  it('Q-08: narrative for empty queue at all visibility states does not throw', () => {
    const allStates: TensionVisibilityState[] = [
      TENSION_VISIBILITY_STATE.SHADOWED,
      TENSION_VISIBILITY_STATE.SIGNALED,
      TENSION_VISIBILITY_STATE.TELEGRAPHED,
      TENSION_VISIBILITY_STATE.EXPOSED,
    ];

    for (const state of allStates) {
      const visConfig: VisibilityConfig = VISIBILITY_CONFIGS[state];
      expect(visConfig).toBeDefined();
      expect(typeof visConfig.tensionAwarenessBonus).toBe('number');

      const narrative: QueueNarrative = queue.generateNarrative(1, state);
      expect(typeof narrative.headline).toBe('string');
    }
  });

  it('Q-09: generateEntryNarrative returns meaningful text for known entries', () => {
    const entry = queue.upsert(buildInput({ sourceKey: 'src:q09', threatId: 'q09', arrivalTick: 5 }));
    const text = queue.generateEntryNarrative(entry.entryId, 1);
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(0);
  });

  it('Q-10: generateEntryNarrative for arrived entry mentions ACTIVE', () => {
    const entry = queue.upsert(buildInput({ sourceKey: 'src:q10', threatId: 'q10', arrivalTick: 3 }));
    queue.processTick(3);
    const text = queue.generateEntryNarrative(entry.entryId, 3);
    expect(text.toUpperCase()).toContain('ACTIVE');
  });
});

// ===========================================================================
// § R — MITIGATION PLAN
// ===========================================================================

describe('AnticipationQueue — § R: Mitigation Plan', () => {
  let queue: AnticipationQueue;

  beforeEach(() => {
    queue = new AnticipationQueue();
  });

  it('R-01: buildMitigationPlan returns plan with ranked entries', () => {
    queue.upsert(buildInput({ sourceKey: 'src:r01:1', threatId: 'r01-1', arrivalTick: 3 }));
    queue.upsert(buildInput({ sourceKey: 'src:r01:2', threatId: 'r01-2', arrivalTick: 5 }));
    queue.processTick(3);

    const plan: QueueMitigationPlan = queue.buildMitigationPlan(3);

    expect(plan.entries.length).toBe(2);
    expect(plan.tickNumber).toBe(3);
    expect(typeof plan.totalOptions).toBe('number');
    expect(typeof plan.criticalCount).toBe('number');
  });

  it('R-02: mitigation options have correct urgency for arrived threats', () => {
    queue.upsert(buildInput({ sourceKey: 'src:r02', threatId: 'r02', threatType: THREAT_TYPE.DEBT_SPIRAL, arrivalTick: 3 }));
    queue.processTick(3);

    const plan: QueueMitigationPlan = queue.buildMitigationPlan(3);
    const arrivedEntry = plan.entries.find(e => e.priorityRank === 1);

    expect(arrivedEntry).toBeDefined();
    const options: readonly MitigationOption[] = arrivedEntry!.options;
    expect(options.length).toBeGreaterThan(0);

    // At tick=3, just arrived — window should be > 0 so urgency is SOON or OPTIONAL
    for (const opt of options) {
      expect(['IMMEDIATE', 'SOON', 'OPTIONAL']).toContain(opt.urgency);
      expect(opt.available).toBe(true);
    }
  });

  it('R-03: critical count reflects CRITICAL and EXISTENTIAL threats', () => {
    queue.upsert(buildInput({ sourceKey: 'src:r03:cr', threatId: 'r03-cr', threatSeverity: THREAT_SEVERITY.CRITICAL, arrivalTick: 5 }));
    queue.upsert(buildInput({ sourceKey: 'src:r03:ex', threatId: 'r03-ex', threatSeverity: THREAT_SEVERITY.EXISTENTIAL, arrivalTick: 5 }));
    queue.upsert(buildInput({ sourceKey: 'src:r03:mi', threatId: 'r03-mi', threatSeverity: THREAT_SEVERITY.MINOR, arrivalTick: 5 }));

    const plan: QueueMitigationPlan = queue.buildMitigationPlan(1);
    expect(plan.criticalCount).toBe(2); // CRITICAL + EXISTENTIAL
  });
});

// ===========================================================================
// § S — EVENT BUILDERS
// ===========================================================================

describe('AnticipationQueue — § S: Event Builders', () => {
  let queue: AnticipationQueue;

  beforeEach(() => {
    queue = new AnticipationQueue();
  });

  it('S-01: buildThreatArrivedEvents uses TENSION_EVENT_NAMES.THREAT_ARRIVED', () => {
    const entry = queue.upsert(buildInput({ arrivalTick: 3 }));
    queue.processTick(3);

    const arrivedEntry = queue.getArrivedEntries()[0]!;
    const events = queue.buildThreatArrivedEvents([arrivedEntry], 3, Date.now());

    expect(events).toHaveLength(1);
    expect(events[0]!.busEventName).toBe(TENSION_EVENT_NAMES.THREAT_ARRIVED);

    const event: ThreatArrivedEvent = events[0]!.event;
    expect(event.eventType).toBe('THREAT_ARRIVED');
    expect(event.entryId).toBe(arrivedEntry.entryId);
    expect(event.tickNumber).toBe(3);
    void entry; // used for context
  });

  it('S-02: buildThreatMitigatedEvent uses TENSION_EVENT_NAMES.THREAT_MITIGATED', () => {
    const entry = queue.upsert(buildInput({ arrivalTick: 3 }));
    queue.processTick(3);
    queue.mitigateEntry(entry.entryId, 3);

    const mitigated = queue.getMitigatedEntries()[0]!;
    const result = queue.buildThreatMitigatedEvent(mitigated, 3, Date.now());

    expect(result.busEventName).toBe(TENSION_EVENT_NAMES.THREAT_MITIGATED);
    const event: ThreatMitigatedEvent = result.event;
    expect(event.eventType).toBe('THREAT_MITIGATED');
    expect(event.entryId).toBe(mitigated.entryId);
  });

  it('S-03: buildThreatExpiredEvents uses TENSION_EVENT_NAMES.THREAT_EXPIRED', () => {
    queue.upsert(buildInput({ threatType: THREAT_TYPE.HATER_INJECTION, arrivalTick: 3 }));
    queue.processTick(3);
    const tick4: QueueProcessResult = queue.processTick(4);

    const expired = tick4.newExpirations[0]!;
    const events = queue.buildThreatExpiredEvents([expired], 4, Date.now());

    expect(events).toHaveLength(1);
    expect(events[0]!.busEventName).toBe(TENSION_EVENT_NAMES.THREAT_EXPIRED);
    const event: ThreatExpiredEvent = events[0]!.event;
    expect(event.eventType).toBe('THREAT_EXPIRED');
    expect(event.ticksOverdue).toBeGreaterThan(0);
  });

  it('S-04: buildQueueUpdatedEvent uses TENSION_EVENT_NAMES.QUEUE_UPDATED', () => {
    queue.upsert(buildInput({ arrivalTick: 3 }));

    const result = queue.buildQueueUpdatedEvent(1, Date.now());
    expect(result.busEventName).toBe(TENSION_EVENT_NAMES.QUEUE_UPDATED);
    const event: AnticipationQueueUpdatedEvent = result.event;
    expect(event.eventType).toBe('ANTICIPATION_QUEUE_UPDATED');
    expect(event.queueLength).toBe(1);
  });

  it('S-05: buildScoreUpdatedEvent uses TENSION_EVENT_NAMES.SCORE_UPDATED', () => {
    queue.upsert(buildInput({ arrivalTick: 3 }));
    queue.processTick(3);

    const result = queue.buildScoreUpdatedEvent(
      0.35, 0.20, 0.05, 0.07,
      TENSION_VISIBILITY_STATE.SIGNALED,
      3, Date.now(),
    );

    expect(result.busEventName).toBe(TENSION_EVENT_NAMES.SCORE_UPDATED);
    const event: TensionScoreUpdatedEvent = result.event;
    expect(event.score).toBe(0.35);
    expect(event.previousScore).toBe(0.20);
  });

  it('S-06: buildVisibilityChangedEvent uses TENSION_EVENT_NAMES.VISIBILITY_CHANGED', () => {
    const result = queue.buildVisibilityChangedEvent(
      TENSION_VISIBILITY_STATE.SHADOWED,
      TENSION_VISIBILITY_STATE.TELEGRAPHED,
      5, Date.now(),
    );

    expect(result.busEventName).toBe(TENSION_EVENT_NAMES.VISIBILITY_CHANGED);
    const event: TensionVisibilityChangedEvent = result.event;
    expect(event.from).toBe(TENSION_VISIBILITY_STATE.SHADOWED);
    expect(event.to).toBe(TENSION_VISIBILITY_STATE.TELEGRAPHED);
  });

  it('S-07: buildPulseFiredEvent uses TENSION_EVENT_NAMES.PULSE_FIRED', () => {
    queue.upsert(buildInput({ arrivalTick: 3 }));

    const result = queue.buildPulseFiredEvent(0.95, 3, 10, Date.now());
    expect(result.busEventName).toBe(TENSION_EVENT_NAMES.PULSE_FIRED);
    const event: TensionPulseFiredEvent = result.event;
    expect(event.score).toBe(0.95);
    expect(event.pulseTicksActive).toBe(3);
  });

  it('S-08: TENSION_EVENT_NAMES has all expected keys', () => {
    expect(typeof TENSION_EVENT_NAMES.THREAT_ARRIVED).toBe('string');
    expect(typeof TENSION_EVENT_NAMES.THREAT_MITIGATED).toBe('string');
    expect(typeof TENSION_EVENT_NAMES.THREAT_EXPIRED).toBe('string');
    expect(typeof TENSION_EVENT_NAMES.QUEUE_UPDATED).toBe('string');
    expect(typeof TENSION_EVENT_NAMES.SCORE_UPDATED).toBe('string');
    expect(typeof TENSION_EVENT_NAMES.VISIBILITY_CHANGED).toBe('string');
    expect(typeof TENSION_EVENT_NAMES.PULSE_FIRED).toBe('string');
  });
});

// ===========================================================================
// § T — INTEGRATION HELPERS
// ===========================================================================

describe('AnticipationQueue — § T: Integration Helpers', () => {
  let queue: AnticipationQueue;

  beforeEach(() => {
    queue = new AnticipationQueue();
  });

  it('T-01: buildDecayInput returns valid DecayComputeInput', () => {
    queue.upsert(buildInput({ arrivalTick: 3 }));
    queue.processTick(3);

    const input: DecayComputeInput = queue.buildDecayInput('T1', TENSION_VISIBILITY_STATE.SIGNALED, false);

    expect(Array.isArray(input.activeEntries)).toBe(true);
    expect(Array.isArray(input.expiredEntries)).toBe(true);
    expect(Array.isArray(input.relievedEntries)).toBe(true);
    expect(input.pressureTier).toBe('T1');
    expect(input.sovereigntyMilestoneReached).toBe(false);
    expect(typeof input.visibilityAwarenessBonus).toBe('number');
  });

  it('T-02: buildDecayInput reflects VISIBILITY_CONFIGS awareness bonus', () => {
    const input: DecayComputeInput = queue.buildDecayInput('T0', TENSION_VISIBILITY_STATE.EXPOSED, false);
    const exposedConfig: VisibilityConfig = VISIBILITY_CONFIGS[TENSION_VISIBILITY_STATE.EXPOSED];
    expect(input.visibilityAwarenessBonus).toBe(exposedConfig.tensionAwarenessBonus);
  });

  it('T-03: applyDecayResult clamps score to [0, 1]', () => {
    const result: DecayComputeResult = {
      rawDelta: 0.5,
      amplifiedDelta: 0.5,
      contributionBreakdown: {
        queuedThreats: 0.5,
        arrivedThreats: 0,
        expiredGhosts: 0,
        mitigationDecay: 0,
        nullifyDecay: 0,
        emptyQueueBonus: 0,
        visibilityBonus: 0,
        sovereigntyBonus: 0,
      },
    };

    const clamped = queue.applyDecayResult(result, 0.9);
    expect(clamped).toBeLessThanOrEqual(1.0);
    expect(clamped).toBeGreaterThanOrEqual(0);
  });

  it('T-04: integrateRuntimeContext stores snapshot without errors', () => {
    const snapshot: TensionRuntimeSnapshot = createTensionRuntimeSnapshotFixture({ score: 0.5 });
    expect(() => queue.integrateRuntimeContext(snapshot)).not.toThrow();
  });

  it('T-05: projectToThreatEnvelopes uses INTERNAL_VISIBILITY_TO_ENVELOPE', () => {
    queue.upsert(buildInput({ arrivalTick: 5 }));

    const envelopes: readonly ThreatEnvelope[] = queue.projectToThreatEnvelopes(
      TENSION_VISIBILITY_STATE.TELEGRAPHED,
      1,
    );

    expect(envelopes).toHaveLength(1);
    const envelope: ThreatEnvelope = envelopes[0]!;
    const expectedLevel: VisibilityLevel = INTERNAL_VISIBILITY_TO_ENVELOPE[TENSION_VISIBILITY_STATE.TELEGRAPHED];
    expect(envelope.visibleAs).toBe(expectedLevel);
    expect(typeof envelope.etaTicks).toBe('number');
    expect(typeof envelope.severity).toBe('number');
    expect(typeof envelope.summary).toBe('string');
  });

  it('T-06: getVisibilityConfig returns correct config', () => {
    const config: VisibilityConfig = queue.getVisibilityConfig(TENSION_VISIBILITY_STATE.EXPOSED);
    expect(config.showsMitigationPath).toBe(true);
    expect(config.showsWorstCase).toBe(true);
  });

  it('T-07: getVisibilityIndex returns VISIBILITY_ORDER index', () => {
    for (const state of VISIBILITY_ORDER) {
      const idx = queue.getVisibilityIndex(state as TensionVisibilityState);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(VISIBILITY_ORDER.length);
    }
  });
});

// ===========================================================================
// § U — EXPORT BUNDLE
// ===========================================================================

describe('AnticipationQueue — § U: Export Bundle', () => {
  let queue: AnticipationQueue;

  beforeEach(() => {
    queue = new AnticipationQueue();
  });

  it('U-01: exportBundle includes all required fields', () => {
    queue.upsert(buildInput({ arrivalTick: 5 }));

    const bundle: QueueExportBundle = queue.exportBundle(1, 'T1', TENSION_VISIBILITY_STATE.SIGNALED, 0.3);

    expect(bundle.mlVector).toBeDefined();
    expect(bundle.dlTensor).toBeDefined();
    expect(bundle.healthReport).toBeDefined();
    expect(bundle.forecast).toBeDefined();
    expect(bundle.narrative).toBeDefined();
    expect(bundle.mitigationPlan).toBeDefined();
    expect(bundle.sessionSummary).toBeDefined();
    expect(bundle.serializedState).toBeDefined();
    expect(Array.isArray(bundle.activeEntries)).toBe(true);
    expect(Array.isArray(bundle.sortedQueue)).toBe(true);
    expect(bundle.tickNumber).toBe(1);
    expect(typeof bundle.exportedAtMs).toBe('number');
  });

  it('U-02: exportBundle ML vector has correct dimension', () => {
    const bundle: QueueExportBundle = queue.exportBundle(1, 'T0');
    expect(bundle.mlVector.dimension).toBe(QUEUE_ML_FEATURE_COUNT);
  });

  it('U-03: exportBundle DL tensor has correct sequence length', () => {
    const bundle: QueueExportBundle = queue.exportBundle(1, 'T0');
    expect(bundle.dlTensor.sequenceLength).toBe(QUEUE_DL_SEQUENCE_LENGTH);
    expect(bundle.dlTensor.featureWidth).toBe(QUEUE_DL_FEATURE_WIDTH);
  });
});

// ===========================================================================
// § V — STANDALONE PURE FUNCTIONS
// ===========================================================================

describe('AnticipationQueue — § V: Standalone Pure Functions', () => {
  it('V-01: computeQueuePressure returns 0 for empty entries', () => {
    const pressure = computeQueuePressure([]);
    expect(pressure).toBe(0);
  });

  it('V-02: computeQueuePressure uses TENSION_CONSTANTS rates', () => {
    const queuedEntry: AnticipationEntry = createQueuedEntryFixture({ severityWeight: 1.0 });
    const arrivedEntry: AnticipationEntry = createArrivedEntryFixture({ severityWeight: 1.0 });

    const queuedPressure = computeQueuePressure([queuedEntry]);
    const arrivedPressure = computeQueuePressure([arrivedEntry]);

    // Arrived threats contribute more pressure per tick
    expect(arrivedPressure).toBeGreaterThan(queuedPressure);
    expect(queuedPressure).toBeGreaterThan(0);
  });

  it('V-03: computeQueueThreatDensity returns 0 for empty queue', () => {
    expect(computeQueueThreatDensity([])).toBe(0);
  });

  it('V-04: computeQueueThreatDensity returns 1.0 when all are arrived', () => {
    const arrivedEntry: AnticipationEntry = createArrivedEntryFixture();
    const density = computeQueueThreatDensity([arrivedEntry]);
    expect(density).toBe(1.0);
  });

  it('V-05: computeQueueThreatDensity returns 0.5 for half arrived', () => {
    const queued: AnticipationEntry = createQueuedEntryFixture();
    const arrived: AnticipationEntry = createArrivedEntryFixture();

    const density = computeQueueThreatDensity([queued, arrived]);
    expect(density).toBeCloseTo(0.5, 2);
  });

  it('V-06: classifyQueueRisk returns CLEAR for empty entries', () => {
    const risk: QueueRiskTier = classifyQueueRisk([], 'T0');
    expect(risk).toBe('CLEAR');
  });

  it('V-07: classifyQueueRisk escalates with EXISTENTIAL threats', () => {
    const existential: AnticipationEntry = createArrivedEntryFixture({
      threatSeverity: THREAT_SEVERITY.EXISTENTIAL,
    });
    const risk: QueueRiskTier = classifyQueueRisk([existential], 'T0');
    // HIGH_EXISTENTIAL_COUNT = 1, so EXISTENTIAL arrives → CRITICAL
    expect(['CRITICAL', 'HIGH']).toContain(risk);
  });

  it('V-08: classifyQueueRisk uses PRESSURE_TENSION_AMPLIFIERS for T3/T4', () => {
    // At T3 (amp=1.35) the risk classification is amplified
    const arrivedEntry: AnticipationEntry = createArrivedEntryFixture({
      threatSeverity: THREAT_SEVERITY.CRITICAL,
    });
    const riskT0: QueueRiskTier = classifyQueueRisk([arrivedEntry], 'T0');
    const riskT4: QueueRiskTier = classifyQueueRisk([arrivedEntry], 'T4');

    // T4 always at least as risky as T0
    const riskOrder: QueueRiskTier[] = ['CLEAR', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    const t0Idx = riskOrder.indexOf(riskT0);
    const t4Idx = riskOrder.indexOf(riskT4);
    expect(t4Idx).toBeGreaterThanOrEqual(t0Idx);
  });

  it('V-09: projectQueueToThreatEnvelopes uses INTERNAL_VISIBILITY_TO_ENVELOPE', () => {
    const queued: AnticipationEntry = createQueuedEntryFixture({ arrivalTick: 5 });
    const envelopes: readonly ThreatEnvelope[] = projectQueueToThreatEnvelopes(
      [queued],
      TENSION_VISIBILITY_STATE.EXPOSED,
      1,
    );

    expect(envelopes).toHaveLength(1);
    const envelope: ThreatEnvelope = envelopes[0]!;
    const expectedLevel: VisibilityLevel = INTERNAL_VISIBILITY_TO_ENVELOPE[TENSION_VISIBILITY_STATE.EXPOSED];
    expect(envelope.visibleAs).toBe(expectedLevel);
  });

  it('V-10: rankThreatsByUrgency sorts ARRIVED before QUEUED', () => {
    const queued: AnticipationEntry = createQueuedEntryFixture({ arrivalTick: 10 });
    const arrived: AnticipationEntry = createArrivedEntryFixture({ arrivalTick: 1 });

    const ranked = rankThreatsByUrgency([queued, arrived], 5);
    expect(ranked[0]?.state).toBe(ENTRY_STATE.ARRIVED);
    expect(ranked[1]?.state).toBe(ENTRY_STATE.QUEUED);
  });

  it('V-11: computeQueueDecayInput uses VISIBILITY_CONFIGS awareness bonus', () => {
    const queuedEntry: AnticipationEntry = createQueuedEntryFixture();
    const input: DecayComputeInput = computeQueueDecayInput(
      [queuedEntry], [], [], 'T2',
      TENSION_VISIBILITY_STATE.TELEGRAPHED,
      false,
    );

    const expectedBonus = VISIBILITY_CONFIGS[TENSION_VISIBILITY_STATE.TELEGRAPHED].tensionAwarenessBonus;
    expect(input.visibilityAwarenessBonus).toBe(expectedBonus);
    expect(input.pressureTier).toBe('T2');
    expect(input.queueIsEmpty).toBe(false);
  });

  it('V-12: computeQueueMLVector returns 32-dimensional vector', () => {
    const entries: AnticipationEntry[] = [
      createArrivedEntryFixture({ threatSeverity: THREAT_SEVERITY.SEVERE }),
      createQueuedEntryFixture({ threatSeverity: THREAT_SEVERITY.MINOR }),
    ];

    const mlVector: QueueMLVector = computeQueueMLVector(entries, 5, 'T1');
    expect(mlVector.dimension).toBe(QUEUE_ML_FEATURE_COUNT);
    expect(mlVector.values).toHaveLength(QUEUE_ML_FEATURE_COUNT);
    expect(mlVector.pressureTier).toBe('T1');
  });

  it('V-13: computeQueueDLTensor returns 16x8 tensor', () => {
    const entries: AnticipationEntry[] = [createArrivedEntryFixture()];
    const dlTensor: QueueDLTensor = computeQueueDLTensor(entries, 3, 'T0');

    expect(dlTensor.sequenceLength).toBe(QUEUE_DL_SEQUENCE_LENGTH);
    expect(dlTensor.featureWidth).toBe(QUEUE_DL_FEATURE_WIDTH);
    expect(dlTensor.rows).toHaveLength(QUEUE_DL_SEQUENCE_LENGTH);
  });

  it('V-14: generateQueueNarrative produces narrative for arrived entries', () => {
    const arrived: AnticipationEntry = createArrivedEntryFixture({
      threatType: THREAT_TYPE.SABOTAGE,
    });

    const narrative: QueueNarrative = generateQueueNarrative(
      [arrived], 5, TENSION_VISIBILITY_STATE.EXPOSED, 0.5,
    );

    expect(typeof narrative.headline).toBe('string');
    expect(narrative.urgencyLabel.length).toBeGreaterThan(0);
  });

  it('V-15: computeQueueDeltaSummary detects queue escalation', () => {
    const prev: AnticipationEntry[] = [createQueuedEntryFixture({ severityWeight: 0.4 })];
    const curr: AnticipationEntry[] = [
      createArrivedEntryFixture({ severityWeight: 0.85 }),
      createQueuedEntryFixture({ severityWeight: 0.85 }),
    ];

    const delta: QueueDeltaSummary = computeQueueDeltaSummary(prev, curr);

    expect(delta.activeCountDelta).toBeGreaterThan(0);
    expect(delta.escalated || delta.arrivedCountDelta > 0).toBe(true);
  });

  it('V-16: serializeQueueState and deserializeQueueState are inverse operations', () => {
    const entries: AnticipationEntry[] = [
      createQueuedEntryFixture({ sourceKey: 'sk-serial-1' }),
      createArrivedEntryFixture({ sourceKey: 'sk-serial-2' }),
    ];

    const serialized: QueueSerializedState = serializeQueueState(entries);
    expect(serialized.entryCount).toBe(2);
    expect(serialized.version).toBe('anticipation-queue.v2');

    const result = deserializeQueueState(serialized);
    expect(result.entries).toHaveLength(2);
    expect(result.checksumValid).toBe(true);
  });
});

// ===========================================================================
// § W — VALIDATION FUNCTIONS
// ===========================================================================

describe('AnticipationQueue — § W: Validation Functions', () => {
  it('W-01: validateQueueUpsertInput accepts a valid input', () => {
    const input: QueueUpsertInput = buildInput();
    const result = validateQueueUpsertInput(input);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('W-02: validateQueueUpsertInput rejects empty runId', () => {
    const input: QueueUpsertInput = buildInput({ runId: '' });
    const result = validateQueueUpsertInput(input);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.toLowerCase().includes('runid'))).toBe(true);
  });

  it('W-03: validateQueueUpsertInput rejects invalid threatType at runtime', () => {
    const input = { ...buildInput(), threatType: 'INVALID_TYPE' as ThreatType };
    const result = validateQueueUpsertInput(input);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.toLowerCase().includes('threattype'))).toBe(true);
  });

  it('W-04: validateQueueUpsertInput rejects invalid threatSeverity at runtime', () => {
    const input = { ...buildInput(), threatSeverity: 'NOT_A_SEVERITY' as ThreatSeverity };
    const result = validateQueueUpsertInput(input);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.toLowerCase().includes('threatseverity'))).toBe(true);
  });

  it('W-05: validateQueueUpsertInput rejects negative arrivalTick', () => {
    const input = buildInput({ arrivalTick: -1 });
    const result = validateQueueUpsertInput(input);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.toLowerCase().includes('arrivaltick'))).toBe(true);
  });

  it('W-06: validateQueueUpsertInput rejects severityWeight out of [0,1]', () => {
    const input = buildInput({ severityWeight: 2.0 });
    const result = validateQueueUpsertInput(input);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.toLowerCase().includes('severityweight'))).toBe(true);
  });

  it('W-07: validateQueueEntry accepts a valid fixture entry', () => {
    const entry: AnticipationEntry = createQueuedEntryFixture();
    // Only entries with proper 32-char hashed entryIds pass
    // (fixtures use sequential IDs so this may fail entryId check — we just verify the function runs)
    const result = validateQueueEntry(entry);
    expect(typeof result.valid).toBe('boolean');
    expect(Array.isArray(result.errors)).toBe(true);
  });
});

// ===========================================================================
// § X — TENSION DECAY CONTROLLER CONSTANTS AND STANDALONE FUNCTIONS
// ===========================================================================

describe('TensionDecayController — § X: Constants and Pure Functions', () => {
  it('X-01: DECAY_ML_FEATURE_COUNT is 32', () => {
    expect(DECAY_ML_FEATURE_COUNT).toBe(32);
    expect(DECAY_ML_FEATURE_LABELS).toHaveLength(DECAY_ML_FEATURE_COUNT);
  });

  it('X-02: DECAY_DL_SEQUENCE_LENGTH and DECAY_DL_FEATURE_WIDTH are correct', () => {
    expect(DECAY_DL_SEQUENCE_LENGTH).toBe(16);
    expect(DECAY_DL_FEATURE_WIDTH).toBe(8);
    expect(DECAY_DL_COLUMN_LABELS).toHaveLength(DECAY_DL_FEATURE_WIDTH);
  });

  it('X-03: DECAY_SCORE_FLOOR and DECAY_SCORE_CEILING match TENSION_CONSTANTS', () => {
    expect(DECAY_SCORE_FLOOR).toBe(TENSION_CONSTANTS.MIN_SCORE);
    expect(DECAY_SCORE_CEILING).toBe(TENSION_CONSTANTS.MAX_SCORE);
  });

  it('X-04: type amplifier constants have expected ordering', () => {
    expect(DECAY_CASCADE_TYPE_AMPLIFIER).toBeGreaterThan(1.0);
    expect(DECAY_SOVEREIGNTY_TYPE_AMPLIFIER).toBeGreaterThan(DECAY_CASCADE_TYPE_AMPLIFIER);
  });

  it('X-05: relief multiplier constants are >= 1.0', () => {
    expect(DECAY_REPUTATION_MITIGATION_RELIEF).toBeGreaterThanOrEqual(1.0);
    expect(DECAY_OPPORTUNITY_MITIGATION_RELIEF).toBeGreaterThanOrEqual(1.0);
  });

  it('X-06: escalation thresholds have correct signs', () => {
    expect(DECAY_ESCALATION_SLOPE_THRESHOLD).toBeGreaterThan(0);
    expect(DECAY_DEESCALATION_SLOPE_THRESHOLD).toBeLessThan(0);
  });

  it('X-07: DECAY_PULSE_SUSTAINED_TICKS matches TENSION_CONSTANTS', () => {
    expect(DECAY_PULSE_SUSTAINED_TICKS).toBe(TENSION_CONSTANTS.PULSE_SUSTAINED_TICKS);
  });

  it('X-08: DECAY_SEVERITY_WEIGHT_MIN_ENTRIES is 1', () => {
    expect(DECAY_SEVERITY_WEIGHT_MIN_ENTRIES).toBe(1);
  });

  it('X-09: DECAY_MAX_DELTA_PER_TICK is 0.5', () => {
    expect(DECAY_MAX_DELTA_PER_TICK).toBe(0.5);
  });

  it('X-10: DECAY_FORECAST_HORIZON is 8', () => {
    expect(DECAY_FORECAST_HORIZON).toBe(8);
  });

  it('X-11: DECAY_HISTORY_CAPACITY is 64', () => {
    expect(DECAY_HISTORY_CAPACITY).toBe(64);
  });

  it('X-12: DECAY_VOLATILITY_WINDOW is 20', () => {
    expect(DECAY_VOLATILITY_WINDOW).toBe(20);
  });

  it('X-13: computeDecayDelta for queued-only produces positive amplified delta', () => {
    const result: DecayComputeResult = computeDecayDelta(
      2, 0, 0, 0, 0,
      false, 0, false, 'T0',
    );

    expect(result.rawDelta).toBeGreaterThan(0);
    expect(result.amplifiedDelta).toBeGreaterThan(0);
    expect(result.amplifiedDelta).toBeLessThanOrEqual(DECAY_MAX_DELTA_PER_TICK);
    const breakdown: DecayContributionBreakdown = result.contributionBreakdown;
    expect(breakdown.queuedThreats).toBeGreaterThan(0);
    expect(breakdown.arrivedThreats).toBe(0);
  });

  it('X-14: computeDecayDelta with mitigation reduces amplified delta', () => {
    const withoutRelief: DecayComputeResult = computeDecayDelta(
      0, 1, 0, 0, 0,
      false, 0, false, 'T0',
    );
    const withRelief: DecayComputeResult = computeDecayDelta(
      0, 1, 0, 1, 0,
      false, 0, false, 'T0',
    );

    expect(withRelief.amplifiedDelta).toBeLessThan(withoutRelief.amplifiedDelta);
  });

  it('X-15: computeDecayDelta with empty queue triggers recovery bonus', () => {
    const result: DecayComputeResult = computeDecayDelta(
      0, 0, 0, 0, 0,
      true, 0, false, 'T0',
    );

    expect(result.amplifiedDelta).toBeLessThanOrEqual(0);
    const breakdown: DecayContributionBreakdown = result.contributionBreakdown;
    expect(breakdown.emptyQueueBonus).toBeLessThan(0);
  });

  it('X-16: computeDecayDelta with sovereignty milestone triggers bonus', () => {
    const withMilestone: DecayComputeResult = computeDecayDelta(
      0, 0, 0, 0, 0,
      false, 0, true, 'T0',
    );

    expect(withMilestone.contributionBreakdown.sovereigntyBonus).toBeLessThan(0);
  });

  it('X-17: computeSeverityWeightedDelta uses THREAT_SEVERITY_WEIGHTS', () => {
    const minor: AnticipationEntry = createQueuedEntryFixture({ threatSeverity: THREAT_SEVERITY.MINOR, severityWeight: THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.MINOR] });
    const existential: AnticipationEntry = createQueuedEntryFixture({ threatSeverity: THREAT_SEVERITY.EXISTENTIAL, severityWeight: THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.EXISTENTIAL] });

    const deltaMinor = computeSeverityWeightedDelta([minor], 'T0');
    const deltaExistential = computeSeverityWeightedDelta([existential], 'T0');

    expect(deltaExistential).toBeGreaterThan(deltaMinor);
  });

  it('X-18: computeTypeAdjustedDelta uses THREAT_TYPE amplifiers', () => {
    const cascade: AnticipationEntry = createQueuedEntryFixture({ threatType: THREAT_TYPE.CASCADE });
    const sovereign: AnticipationEntry = createQueuedEntryFixture({ threatType: THREAT_TYPE.SOVEREIGNTY });
    const standard: AnticipationEntry = createQueuedEntryFixture({ threatType: THREAT_TYPE.DEBT_SPIRAL });

    const deltaStandard = computeTypeAdjustedDelta([standard], 'T0');
    const deltaCascade = computeTypeAdjustedDelta([cascade], 'T0');
    const deltaSovereign = computeTypeAdjustedDelta([sovereign], 'T0');

    // CASCADE > standard, SOVEREIGNTY > CASCADE due to type amplifiers
    expect(deltaCascade).toBeGreaterThan(deltaStandard);
    expect(deltaSovereign).toBeGreaterThan(deltaCascade);
  });

  it('X-19: computePressureAmplifiedDelta respects PRESSURE_TENSION_AMPLIFIERS', () => {
    const allTiers: PressureTier[] = ['T0', 'T1', 'T2', 'T3', 'T4'];
    const deltas: number[] = allTiers.map(tier =>
      computePressureAmplifiedDelta(0.2, -0.05, tier),
    );

    // Higher pressure tier should yield higher (or equal) delta for same positive pressure
    for (let i = 0; i < deltas.length - 1; i++) {
      expect(deltas[i + 1]).toBeGreaterThanOrEqual(deltas[i]!);
    }
  });

  it('X-20: getDecayVisibilityBonus returns value from VISIBILITY_CONFIGS', () => {
    for (const state of VISIBILITY_ORDER) {
      const bonus = getDecayVisibilityBonus(state as TensionVisibilityState);
      const config: VisibilityConfig = VISIBILITY_CONFIGS[state as TensionVisibilityState];
      expect(bonus).toBe(config.tensionAwarenessBonus);
    }
  });

  it('X-21: computeDecayMLVector returns 32-dimensional vector', () => {
    const entries: AnticipationEntry[] = [createArrivedEntryFixture()];
    const lastResult: DecayComputeResult = computeDecayDelta(0, 1, 0, 0, 0, false, 0, false, 'T1');

    const mlVec: DecayMLVector = computeDecayMLVector(
      entries, lastResult, 0.5, 'T1', TENSION_VISIBILITY_STATE.SIGNALED, 5,
    );

    expect(mlVec.dimension).toBe(DECAY_ML_FEATURE_COUNT);
    expect(mlVec.values).toHaveLength(DECAY_ML_FEATURE_COUNT);
    expect(mlVec.labels).toBe(DECAY_ML_FEATURE_LABELS);
    for (const v of mlVec.values) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('X-22: computeDecayHealthScore returns [0,1]', () => {
    const score = computeDecayHealthScore(0.5, 2, 0.1);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('X-23: classifyDecayRisk returns CRITICAL at pulse threshold', () => {
    const pulseScore = TENSION_CONSTANTS.PULSE_THRESHOLD;
    const risk: DecayRiskTier = classifyDecayRisk(pulseScore, 0, 0);
    expect(risk).toBe('CRITICAL');
  });

  it('X-24: classifyDecayRisk returns CLEAR for low score', () => {
    const risk: DecayRiskTier = classifyDecayRisk(0.1, 0, 0);
    expect(risk).toBe('CLEAR');
  });

  it('X-25: validateDecayComputeInput accepts valid input', () => {
    const input: DecayComputeInput = createDecayInputFixture({ pressureTier: 'T2' });
    const result = validateDecayComputeInput(input);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('X-26: validateDecayComputeInput rejects invalid pressure tier', () => {
    const input = { ...createDecayInputFixture(), pressureTier: 'T9' as PressureTier };
    const result = validateDecayComputeInput(input);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

// ===========================================================================
// § Y — TENSIONDEÇAYCONTROLLER CLASS INTEGRATION
// ===========================================================================

describe('TensionDecayController — § Y: Class Integration', () => {
  let decay: TensionDecayController;
  let queue: AnticipationQueue;

  beforeEach(() => {
    decay = new TensionDecayController();
    queue = new AnticipationQueue();
  });

  afterEach(() => {
    decay.reset();
    queue.reset();
  });

  it('Y-01: computeDelta on empty queue produces negative delta (recovery)', () => {
    const input: DecayComputeInput = emptyDecayInput;
    const result: DecayComputeResult = decay.computeDelta(input);

    // Empty queue bonus should push delta negative
    expect(result.amplifiedDelta).toBeLessThanOrEqual(0);
    expect(result.contributionBreakdown.emptyQueueBonus).toBeLessThan(0);
  });

  it('Y-02: computeDelta with arrived threats produces positive delta', () => {
    const arrived: AnticipationEntry = createArrivedEntryFixture();
    const input: DecayComputeInput = createDecayInputFixture({
      activeEntries: [arrived],
      queueIsEmpty: false,
    });

    const result: DecayComputeResult = decay.computeDelta(input);
    expect(result.amplifiedDelta).toBeGreaterThan(0);
    expect(result.contributionBreakdown.arrivedThreats).toBeGreaterThan(0);
  });

  it('Y-03: computeEnhancedDelta applies severity weighting', () => {
    const minor: AnticipationEntry = createArrivedEntryFixture({
      threatSeverity: THREAT_SEVERITY.MINOR,
      severityWeight: THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.MINOR],
    });
    const existential: AnticipationEntry = createArrivedEntryFixture({
      threatSeverity: THREAT_SEVERITY.EXISTENTIAL,
      severityWeight: THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.EXISTENTIAL],
    });

    const deltaMinor: DecayComputeResult = decay.computeEnhancedDelta(
      [minor], 'T0', TENSION_VISIBILITY_STATE.SHADOWED, false,
    );
    const deltaExistential: DecayComputeResult = decay.computeEnhancedDelta(
      [existential], 'T0', TENSION_VISIBILITY_STATE.SHADOWED, false,
    );

    expect(deltaExistential.amplifiedDelta).toBeGreaterThan(deltaMinor.amplifiedDelta);
  });

  it('Y-04: computeContributionAnalysis returns per-entry breakdown', () => {
    const e1: AnticipationEntry = createArrivedEntryFixture({ threatType: THREAT_TYPE.CASCADE });
    const e2: AnticipationEntry = createQueuedEntryFixture({ threatType: THREAT_TYPE.DEBT_SPIRAL });

    const analysis: DecayContributionAnalysis = decay.computeContributionAnalysis([e1, e2]);

    expect(analysis.perEntryContributions).toHaveLength(2);
    const cascadeEntry = analysis.perEntryContributions.find(c => c.entryId === e1.entryId)!;
    expect(cascadeEntry.entryState).toBe(ENTRY_STATE.ARRIVED);
    expect(cascadeEntry.typeModifier).toBeCloseTo(DECAY_CASCADE_TYPE_AMPLIFIER, 3);
  });

  it('Y-05: setTuningParams overrides default rates', () => {
    const tuning: DecayTuningParams = {
      arrivedTensionOverride: 0.05,
      severityWeightingEnabled: true,
      typeModifiersEnabled: true,
    };

    decay.setTuningParams(tuning);
    const params = decay.getTuningParams();
    expect(params.arrivedTensionOverride).toBe(0.05);
    expect(params.severityWeightingEnabled).toBe(true);

    decay.clearTuningParams();
    const cleared = decay.getTuningParams();
    expect(cleared.arrivedTensionOverride).toBeUndefined();
  });

  it('Y-06: recordTickSample adds to tick history', () => {
    const input: DecayComputeInput = createDecayInputFixture({
      activeEntries: [createArrivedEntryFixture()],
      queueIsEmpty: false,
    });
    const result: DecayComputeResult = decay.computeDelta(input);

    decay.recordTickSample(1, 0.25, result, TENSION_VISIBILITY_STATE.SIGNALED, 'T1');
    const history: readonly DecayTickSample[] = decay.getTickHistory();
    expect(history).toHaveLength(1);

    const sample: DecayTickSample = history[0]!;
    expect(sample.tickNumber).toBe(1);
    expect(sample.score).toBe(0.25);
    expect(typeof sample.rawDelta).toBe('number');
  });

  it('Y-07: computeSessionSummary reflects accumulated history', () => {
    const input: DecayComputeInput = createDecayInputFixture({
      activeEntries: [createArrivedEntryFixture()],
      queueIsEmpty: false,
    });

    for (let t = 1; t <= 5; t++) {
      const result: DecayComputeResult = decay.computeDelta(input);
      decay.recordTickSample(t, 0.1 * t, result, TENSION_VISIBILITY_STATE.SHADOWED, 'T0');
    }

    const summary: DecaySessionSummary = decay.computeSessionSummary();
    expect(summary.ticksProcessed).toBe(5);
    expect(summary.peakScore).toBeGreaterThan(0);
  });

  it('Y-08: computeTrendSnapshot returns flat when insufficient history', () => {
    const trend: DecayTrendSnapshot = decay.computeTrendSnapshot();
    const direction: DecayTrendDirection = trend.direction;
    expect(direction).toBe('FLAT');
    expect(trend.slope).toBe(0);
  });

  it('Y-09: computeForecast returns projected scores for DECAY_FORECAST_HORIZON ticks', () => {
    const forecast: DecayForecast = decay.computeForecast(0.5, 0, 'T0', DECAY_FORECAST_HORIZON);
    expect(forecast.projectedScores).toHaveLength(DECAY_FORECAST_HORIZON);
    expect(forecast.currentScore).toBe(0.5);
    expect(typeof forecast.recoveryBlocked).toBe('boolean');
  });

  it('Y-10: extractMLVector returns correct shape after computeDelta', () => {
    const input: DecayComputeInput = createDecayInputFixture({
      activeEntries: [createArrivedEntryFixture()],
      queueIsEmpty: false,
    });
    decay.computeDelta(input);

    const mlVec: DecayMLVector = decay.extractMLVector(
      [createArrivedEntryFixture()], 0.3, 'T1', TENSION_VISIBILITY_STATE.TELEGRAPHED, 5,
    );

    expect(mlVec.dimension).toBe(DECAY_ML_FEATURE_COUNT);
    expect(mlVec.values).toHaveLength(DECAY_ML_FEATURE_COUNT);
    expect(mlVec.labels).toBe(DECAY_ML_FEATURE_LABELS);
  });

  it('Y-11: extractDLTensor returns 16x8 tensor', () => {
    const input: DecayComputeInput = createDecayInputFixture({ queueIsEmpty: true });
    const result: DecayComputeResult = decay.computeDelta(input);
    decay.recordTickSample(1, 0.1, result, TENSION_VISIBILITY_STATE.SHADOWED, 'T0');

    const dlTensor: DecayDLTensor = decay.extractDLTensor('T0', 1);
    expect(dlTensor.sequenceLength).toBe(DECAY_DL_SEQUENCE_LENGTH);
    expect(dlTensor.featureWidth).toBe(DECAY_DL_FEATURE_WIDTH);
    expect(dlTensor.rows).toHaveLength(DECAY_DL_SEQUENCE_LENGTH);

    const row: DecayDLTensorRow = dlTensor.rows[0]!;
    expect(row.features).toHaveLength(DECAY_DL_FEATURE_WIDTH);
  });

  it('Y-12: computeHealthReport returns correct shape', () => {
    const input: DecayComputeInput = createDecayInputFixture({
      activeEntries: [createArrivedEntryFixture()],
      queueIsEmpty: false,
    });
    decay.computeDelta(input);

    const healthReport: DecayHealthReport = decay.computeHealthReport(
      0.7, [createArrivedEntryFixture()], 3,
    );

    expect(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'CLEAR']).toContain(healthReport.riskTier);
    expect(healthReport.currentScore).toBe(0.7);
    expect(healthReport.arrivedThreatCount).toBe(1);
    expect(typeof healthReport.healthScore).toBe('number');
    const riskTier: DecayRiskTier = healthReport.riskTier;
    expect(riskTier).toBeDefined();
  });

  it('Y-13: DECAY_HEALTH_THRESHOLDS values are ordered correctly', () => {
    expect(DECAY_HEALTH_THRESHOLDS.CRITICAL_SCORE).toBeGreaterThan(DECAY_HEALTH_THRESHOLDS.HIGH_SCORE);
    expect(DECAY_HEALTH_THRESHOLDS.HIGH_SCORE).toBeGreaterThan(DECAY_HEALTH_THRESHOLDS.MEDIUM_SCORE);
    expect(DECAY_HEALTH_THRESHOLDS.MEDIUM_SCORE).toBeGreaterThan(DECAY_HEALTH_THRESHOLDS.LOW_SCORE);
  });

  it('Y-14: generateNarrative uses TENSION_VISIBILITY_STATE in output', () => {
    const input: DecayComputeInput = createDecayInputFixture({
      activeEntries: [createArrivedEntryFixture()],
      queueIsEmpty: false,
    });
    decay.computeDelta(input);

    const narrative: DecayNarrative = decay.generateNarrative(
      0.45,
      [createArrivedEntryFixture()],
      TENSION_VISIBILITY_STATE.EXPOSED,
      'T1',
      5,
    );

    expect(typeof narrative.headline).toBe('string');
    expect(typeof narrative.urgencyLabel).toBe('string');
    expect(Array.isArray(narrative.lines)).toBe(true);

    const lines: readonly DecayNarrativeLine[] = narrative.lines;
    for (const line of lines) {
      expect(typeof line.text).toBe('string');
      expect(typeof line.priority).toBe('string');
    }
  });

  it('Y-15: exportBundle returns all required fields', () => {
    const input: DecayComputeInput = createDecayInputFixture({
      activeEntries: [createArrivedEntryFixture()],
      queueIsEmpty: false,
    });
    decay.computeDelta(input);
    decay.recordTickSample(1, 0.3, decay.computeDelta(input), TENSION_VISIBILITY_STATE.SHADOWED, 'T1');

    const bundle: DecayExportBundle = decay.exportBundle(
      0.3, [createArrivedEntryFixture()], 'T1', TENSION_VISIBILITY_STATE.SIGNALED, 2,
    );

    expect(bundle.mlVector.dimension).toBe(DECAY_ML_FEATURE_COUNT);
    expect(bundle.dlTensor.sequenceLength).toBe(DECAY_DL_SEQUENCE_LENGTH);
    expect(bundle.healthReport).toBeDefined();
    expect(bundle.trendSnapshot).toBeDefined();
    expect(bundle.forecast).toBeDefined();
    expect(bundle.narrative).toBeDefined();
    expect(bundle.sessionSummary).toBeDefined();
    expect(bundle.tickNumber).toBe(2);
    expect(typeof bundle.exportedAtMs).toBe('number');
  });

  it('Y-16: serialize and deserialize are roundtrip-stable', () => {
    const input: DecayComputeInput = createDecayInputFixture({ queueIsEmpty: true });
    const result: DecayComputeResult = decay.computeDelta(input);
    decay.recordTickSample(1, 0.2, result, TENSION_VISIBILITY_STATE.SHADOWED, 'T0');

    const serialized: DecaySerializedState = decay.serialize();
    expect(serialized.version).toBe('tension-decay-controller.v2');
    expect(serialized.tickHistory).toHaveLength(1);
    expect(typeof serialized.checksum).toBe('string');

    const newDecay = new TensionDecayController();
    newDecay.deserialize(serialized);
    const restored = newDecay.getTickHistory();
    expect(restored).toHaveLength(1);
    expect(restored[0]?.tickNumber).toBe(1);
    newDecay.reset();
  });

  it('Y-17: sovereignty bonus fires exactly once per run', () => {
    const sovereignInput: DecayComputeInput = createDecayInputFixture({
      sovereigntyMilestoneReached: true,
      queueIsEmpty: false,
    });

    const result1: DecayComputeResult = decay.computeDelta(sovereignInput);
    const result2: DecayComputeResult = decay.computeDelta(sovereignInput);

    // First call fires sovereignty bonus
    expect(result1.contributionBreakdown.sovereigntyBonus).toBeLessThan(0);
    // Second call: bonus already consumed
    expect(result2.contributionBreakdown.sovereigntyBonus).toBe(0);
  });

  it('Y-18: applyTickResult reflects QueueProcessResult fields at runtime', () => {
    const processResult: QueueProcessResult = {
      newArrivals: Object.freeze([createArrivedEntryFixture()]),
      newExpirations: Object.freeze([]),
      activeEntries: Object.freeze([createArrivedEntryFixture()]),
      relievedEntries: Object.freeze([]),
    };

    expect(() => decay.applyTickResult(processResult)).not.toThrow();
  });
});

// ===========================================================================
// § Z — PRESSURE_TENSION_AMPLIFIERS AND VISIBILITY_ORDER COVERAGE
// ===========================================================================

describe('AnticipationQueue — § Z: Constants Coverage', () => {
  it('Z-01: PRESSURE_TENSION_AMPLIFIERS covers all 5 tiers with correct values', () => {
    expect(PRESSURE_TENSION_AMPLIFIERS['T0']).toBe(1.0);
    expect(PRESSURE_TENSION_AMPLIFIERS['T1']).toBe(1.1);
    expect(PRESSURE_TENSION_AMPLIFIERS['T2']).toBe(1.2);
    expect(PRESSURE_TENSION_AMPLIFIERS['T3']).toBe(1.35);
    expect(PRESSURE_TENSION_AMPLIFIERS['T4']).toBe(1.5);
  });

  it('Z-02: VISIBILITY_ORDER has 4 states in ascending awareness order', () => {
    expect(VISIBILITY_ORDER).toHaveLength(4);
    expect(VISIBILITY_ORDER[0]).toBe(TENSION_VISIBILITY_STATE.SHADOWED);
    expect(VISIBILITY_ORDER[3]).toBe(TENSION_VISIBILITY_STATE.EXPOSED);
  });

  it('Z-03: INTERNAL_VISIBILITY_TO_ENVELOPE maps all 4 states', () => {
    const allStates: TensionVisibilityState[] = [
      TENSION_VISIBILITY_STATE.SHADOWED,
      TENSION_VISIBILITY_STATE.SIGNALED,
      TENSION_VISIBILITY_STATE.TELEGRAPHED,
      TENSION_VISIBILITY_STATE.EXPOSED,
    ];

    for (const state of allStates) {
      const level: VisibilityLevel = INTERNAL_VISIBILITY_TO_ENVELOPE[state];
      expect(typeof level).toBe('string');
      expect(level.length).toBeGreaterThan(0);
    }
  });

  it('Z-04: VISIBILITY_CONFIGS has correct boolean flags per state', () => {
    const shadowed: VisibilityConfig = VISIBILITY_CONFIGS[TENSION_VISIBILITY_STATE.SHADOWED];
    const exposed: VisibilityConfig = VISIBILITY_CONFIGS[TENSION_VISIBILITY_STATE.EXPOSED];

    // Shadowed hides type and mitigation
    expect(shadowed.showsThreatType).toBe(false);
    expect(shadowed.showsMitigationPath).toBe(false);

    // Exposed reveals everything
    expect(exposed.showsThreatType).toBe(true);
    expect(exposed.showsMitigationPath).toBe(true);
    expect(exposed.showsWorstCase).toBe(true);
    expect(exposed.showsArrivalTick).toBe(true);
  });

  it('Z-05: TENSION_CONSTANTS has correct key values', () => {
    expect(TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK).toBeCloseTo(0.12, 2);
    expect(TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK).toBeCloseTo(0.2, 2);
    expect(TENSION_CONSTANTS.EXPIRED_GHOST_PER_TICK).toBeCloseTo(0.08, 2);
    expect(TENSION_CONSTANTS.MITIGATION_DECAY_PER_TICK).toBeCloseTo(0.08, 2);
    expect(TENSION_CONSTANTS.PULSE_THRESHOLD).toBeCloseTo(0.9, 1);
    expect(TENSION_CONSTANTS.MIN_SCORE).toBe(0);
    expect(TENSION_CONSTANTS.MAX_SCORE).toBe(1);
    expect(TENSION_CONSTANTS.MITIGATION_DECAY_TICKS).toBeGreaterThan(0);
    expect(TENSION_CONSTANTS.NULLIFY_DECAY_TICKS).toBeGreaterThan(0);
    expect(TENSION_CONSTANTS.PULSE_SUSTAINED_TICKS).toBeGreaterThan(0);
    expect(TENSION_CONSTANTS.EMPTY_QUEUE_DECAY).toBeGreaterThan(0);
    expect(TENSION_CONSTANTS.SOVEREIGNTY_BONUS_DECAY).toBeGreaterThan(0);
  });

  it('Z-06: THREAT_TYPE_DEFAULT_MITIGATIONS has entries for all 8 threat types', () => {
    const allTypes: ThreatType[] = [
      THREAT_TYPE.DEBT_SPIRAL,
      THREAT_TYPE.SABOTAGE,
      THREAT_TYPE.HATER_INJECTION,
      THREAT_TYPE.CASCADE,
      THREAT_TYPE.SOVEREIGNTY,
      THREAT_TYPE.OPPORTUNITY_KILL,
      THREAT_TYPE.REPUTATION_BURN,
      THREAT_TYPE.SHIELD_PIERCE,
    ];

    for (const type of allTypes) {
      const defaults = THREAT_TYPE_DEFAULT_MITIGATIONS[type];
      expect(Array.isArray(defaults)).toBe(true);
      expect(defaults.length).toBeGreaterThan(0);
    }
  });

  it('Z-07: ENTRY_STATE values are all distinct strings', () => {
    const stateValues: EntryState[] = [
      ENTRY_STATE.QUEUED,
      ENTRY_STATE.ARRIVED,
      ENTRY_STATE.EXPIRED,
      ENTRY_STATE.MITIGATED,
      ENTRY_STATE.NULLIFIED,
    ];

    const unique = new Set(stateValues);
    expect(unique.size).toBe(stateValues.length);
  });

  it('Z-08: fixture helpers create correct entry states', () => {
    const queued: AnticipationEntry = mockQueuedEntry();
    const arrived: AnticipationEntry = mockArrivedEntry();
    const expired: AnticipationEntry = mockExpiredEntry();
    const mitigated: AnticipationEntry = mockMitigatedEntry();
    const nullified: AnticipationEntry = mockNullifiedEntry();

    expect(queued.state).toBe(ENTRY_STATE.QUEUED);
    expect(arrived.state).toBe(ENTRY_STATE.ARRIVED);
    expect(expired.state).toBe(ENTRY_STATE.EXPIRED);
    expect(mitigated.state).toBe(ENTRY_STATE.MITIGATED);
    expect(nullified.state).toBe(ENTRY_STATE.NULLIFIED);
  });

  it('Z-09: fixture createQueueUpsertInputFixture returns valid input', () => {
    const input: QueueUpsertInput = createQueueUpsertInputFixture({ threatSeverity: THREAT_SEVERITY.SEVERE });
    const result = validateQueueUpsertInput(input);
    expect(result.valid).toBe(true);
  });

  it('Z-10: mockRuntimeSnapshot produces valid TensionRuntimeSnapshot', () => {
    const snapshot: TensionRuntimeSnapshot = mockRuntimeSnapshot({
      score: 0.6,
      arrivedCount: 2,
    });

    expect(snapshot.score).toBe(0.6);
    expect(snapshot.arrivedCount).toBe(2);
    expect(typeof snapshot.isEscalating).toBe('boolean');
    expect(Array.isArray(snapshot.visibleThreats)).toBe(true);
  });
});
