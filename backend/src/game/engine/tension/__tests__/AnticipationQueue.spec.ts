// /backend/src/game/engine/tension/__tests__/AnticipationQueue.spec.ts

import { beforeEach, describe, expect, it } from 'vitest';
import { AnticipationQueue } from '../AnticipationQueue';
import {
  ENTRY_STATE,
  THREAT_SEVERITY,
  THREAT_TYPE,
  TENSION_CONSTANTS,
  type QueueUpsertInput,
} from '../types';

function buildQueueInput(
  overrides: Partial<QueueUpsertInput> = {},
): QueueUpsertInput {
  return {
    runId: overrides.runId ?? 'run-tension-queue',
    sourceKey: overrides.sourceKey ?? 'attack:001',
    threatId: overrides.threatId ?? 'threat-001',
    source: overrides.source ?? 'SYSTEM',
    threatType: overrides.threatType ?? THREAT_TYPE.DEBT_SPIRAL,
    threatSeverity: overrides.threatSeverity ?? THREAT_SEVERITY.MODERATE,
    currentTick: overrides.currentTick ?? 1,
    arrivalTick: overrides.arrivalTick ?? 4,
    isCascadeTriggered: overrides.isCascadeTriggered ?? false,
    cascadeTriggerEventId: overrides.cascadeTriggerEventId ?? null,
    worstCaseOutcome:
      overrides.worstCaseOutcome ?? 'Cashflow collapses under a debt spiral.',
    mitigationCardTypes:
      overrides.mitigationCardTypes ?? Object.freeze(['INCOME_SHIELD']),
    summary: overrides.summary ?? 'Debt spiral inbound.',
    severityWeight: overrides.severityWeight ?? 0.4,
  };
}

describe('AnticipationQueue', () => {
  let queue: AnticipationQueue;

  beforeEach(() => {
    queue = new AnticipationQueue();
  });

  it('upsert creates a queued entry with the expected lifecycle state', () => {
    const entry = queue.upsert(
      buildQueueInput({
        threatId: 'threat-queue-001',
        currentTick: 5,
        arrivalTick: 9,
      }),
    );

    expect(entry.state).toBe(ENTRY_STATE.QUEUED);
    expect(entry.isArrived).toBe(false);
    expect(entry.isMitigated).toBe(false);
    expect(entry.isExpired).toBe(false);
    expect(entry.arrivalTick).toBe(9);
    expect(entry.baseTensionPerTick).toBe(
      TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK,
    );
    expect(queue.getQueueLength()).toBe(1);
  });

  it('cascade-triggered threats always get at least one tick of warning', () => {
    const entry = queue.upsert(
      buildQueueInput({
        sourceKey: 'cascade:alpha:001',
        threatType: THREAT_TYPE.CASCADE,
        currentTick: 10,
        arrivalTick: 10,
        isCascadeTriggered: true,
        cascadeTriggerEventId: 'event-abc',
      }),
    );

    expect(entry.arrivalTick).toBe(11);
    expect(entry.isCascadeTriggered).toBe(true);
  });

  it('processTick transitions QUEUED to ARRIVED on the correct tick', () => {
    queue.upsert(
      buildQueueInput({
        currentTick: 1,
        arrivalTick: 4,
      }),
    );

    const tick3 = queue.processTick(3);
    expect(tick3.newArrivals).toHaveLength(0);

    const tick4 = queue.processTick(4);
    expect(tick4.newArrivals).toHaveLength(1);
    expect(tick4.newArrivals[0]?.state).toBe(ENTRY_STATE.ARRIVED);
    expect(tick4.newArrivals[0]?.isArrived).toBe(true);
  });

  it('ARRIVED debt spiral expires after its full action window is exceeded', () => {
    queue.upsert(
      buildQueueInput({
        threatType: THREAT_TYPE.DEBT_SPIRAL,
        currentTick: 1,
        arrivalTick: 3,
      }),
    );

    queue.processTick(3); // arrives, overdue = 0
    queue.processTick(4); // overdue = 1
    queue.processTick(5); // overdue = 2
    const tick6 = queue.processTick(6); // overdue = 3 => expires

    expect(tick6.newExpirations).toHaveLength(1);
    expect(tick6.newExpirations[0]?.state).toBe(ENTRY_STATE.EXPIRED);
    expect(tick6.newExpirations[0]?.isExpired).toBe(true);
    expect(tick6.newExpirations[0]?.ticksOverdue).toBe(3);
  });

  it('HATER_INJECTION expires immediately after its zero-window arrival tick', () => {
    queue.upsert(
      buildQueueInput({
        threatType: THREAT_TYPE.HATER_INJECTION,
        currentTick: 1,
        arrivalTick: 3,
      }),
    );

    const tick3 = queue.processTick(3);
    expect(tick3.newArrivals).toHaveLength(1);
    expect(tick3.newArrivals[0]?.state).toBe(ENTRY_STATE.ARRIVED);

    const tick4 = queue.processTick(4);
    expect(tick4.newExpirations).toHaveLength(1);
    expect(tick4.newExpirations[0]?.state).toBe(ENTRY_STATE.EXPIRED);
  });

  it('mitigateEntry succeeds only on ARRIVED entries', () => {
    const entry = queue.upsert(
      buildQueueInput({
        currentTick: 1,
        arrivalTick: 5,
      }),
    );

    const tooEarly = queue.mitigateEntry(entry.entryId, 2);
    expect(tooEarly).toBeNull();

    queue.processTick(5);

    const mitigated = queue.mitigateEntry(entry.entryId, 5);
    expect(mitigated).not.toBeNull();
    expect(mitigated?.state).toBe(ENTRY_STATE.MITIGATED);
    expect(mitigated?.isMitigated).toBe(true);
    expect(mitigated?.mitigatedAtTick).toBe(5);
    expect(mitigated?.decayTicksRemaining).toBe(
      TENSION_CONSTANTS.MITIGATION_DECAY_TICKS,
    );
  });

  it('nullifyEntry works for QUEUED and ARRIVED entries, but not terminal ones', () => {
    const queued = queue.upsert(
      buildQueueInput({
        sourceKey: 'queued-nullify',
        threatId: 'queued-nullify',
        arrivalTick: 10,
      }),
    );

    const queuedNullified = queue.nullifyEntry(queued.entryId);
    expect(queuedNullified).not.toBeNull();
    expect(queuedNullified?.state).toBe(ENTRY_STATE.NULLIFIED);
    expect(queuedNullified?.isNullified).toBe(true);

    const arrived = queue.upsert(
      buildQueueInput({
        sourceKey: 'arrived-nullify',
        threatId: 'arrived-nullify',
        arrivalTick: 2,
      }),
    );

    queue.processTick(2);

    const arrivedNullified = queue.nullifyEntry(arrived.entryId);
    expect(arrivedNullified).not.toBeNull();
    expect(arrivedNullified?.state).toBe(ENTRY_STATE.NULLIFIED);

    const impossible = queue.nullifyEntry('missing-entry-id');
    expect(impossible).toBeNull();
  });

  it('same threat type with different source keys remains independent', () => {
    const left = queue.upsert(
      buildQueueInput({
        sourceKey: 'attack:left',
        threatId: 'threat-left',
        threatType: THREAT_TYPE.SABOTAGE,
        arrivalTick: 5,
      }),
    );

    const right = queue.upsert(
      buildQueueInput({
        sourceKey: 'attack:right',
        threatId: 'threat-right',
        threatType: THREAT_TYPE.SABOTAGE,
        arrivalTick: 6,
      }),
    );

    expect(left.entryId).not.toBe(right.entryId);
    expect(queue.getQueueLength()).toBe(2);
  });

  it('upsert de-duplicates identical source keys while preserving one queue slot', () => {
    const original = queue.upsert(
      buildQueueInput({
        sourceKey: 'attack:dedupe',
        threatId: 'threat-dedupe',
        arrivalTick: 9,
        worstCaseOutcome: 'Short outcome.',
        mitigationCardTypes: Object.freeze(['PATCH']),
      }),
    );

    const duplicate = queue.upsert(
      buildQueueInput({
        sourceKey: 'attack:dedupe',
        threatId: 'threat-dedupe',
        arrivalTick: 7,
        worstCaseOutcome: 'Longer, more severe outcome description.',
        mitigationCardTypes: Object.freeze(['PATCH', 'ABSORB']),
      }),
    );

    expect(queue.getQueueLength()).toBe(1);
    expect(duplicate.entryId).toBe(original.entryId);
    expect(duplicate.arrivalTick).toBe(7);
    expect(duplicate.mitigationCardTypes).toEqual(['PATCH', 'ABSORB']);
    expect(duplicate.worstCaseOutcome).toBe(
      'Longer, more severe outcome description.',
    );
  });

  it('getSortedActiveQueue puts ARRIVED threats before QUEUED and sorts arrived by severity', () => {
    const queued = queue.upsert(
      buildQueueInput({
        sourceKey: 'queued-late',
        threatId: 'queued-late',
        threatSeverity: THREAT_SEVERITY.MODERATE,
        arrivalTick: 10,
      }),
    );

    const arrivedModerate = queue.upsert(
      buildQueueInput({
        sourceKey: 'arrived-moderate',
        threatId: 'arrived-moderate',
        threatSeverity: THREAT_SEVERITY.MODERATE,
        arrivalTick: 2,
      }),
    );

    const arrivedExistential = queue.upsert(
      buildQueueInput({
        sourceKey: 'arrived-existential',
        threatId: 'arrived-existential',
        threatSeverity: THREAT_SEVERITY.EXISTENTIAL,
        arrivalTick: 2,
      }),
    );

    queue.processTick(2);

    const sorted = queue.getSortedActiveQueue();

    expect(sorted[0]?.entryId).toBe(arrivedExistential.entryId);
    expect(sorted[1]?.entryId).toBe(arrivedModerate.entryId);
    expect(sorted[2]?.entryId).toBe(queued.entryId);
  });

  it('relieved entries are surfaced while mitigation decay is still running', () => {
    const entry = queue.upsert(
      buildQueueInput({
        sourceKey: 'relief-track',
        threatId: 'relief-track',
        arrivalTick: 3,
      }),
    );

    queue.processTick(3);
    queue.mitigateEntry(entry.entryId, 3);

    const tick4 = queue.processTick(4);
    expect(tick4.relievedEntries).toHaveLength(1);
    expect(tick4.relievedEntries[0]?.state).toBe(ENTRY_STATE.MITIGATED);

    const tick5 = queue.processTick(5);
    expect(tick5.relievedEntries).toHaveLength(1);

    const tick6 = queue.processTick(6);
    expect(tick6.relievedEntries).toHaveLength(1);

    const tick7 = queue.processTick(7);
    expect(tick7.relievedEntries).toHaveLength(0);
  });

  it('reset clears queue state completely', () => {
    queue.upsert(buildQueueInput());
    queue.upsert(
      buildQueueInput({
        sourceKey: 'attack:002',
        threatId: 'threat-002',
      }),
    );

    expect(queue.getQueueLength()).toBe(2);

    queue.reset();

    expect(queue.getQueueLength()).toBe(0);
    expect(queue.getActiveEntries()).toHaveLength(0);
    expect(queue.getArrivedEntries()).toHaveLength(0);
    expect(queue.getExpiredEntries()).toHaveLength(0);
  });
});