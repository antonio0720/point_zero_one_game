// FILE: backend/src/game/engine/tension/__tests__/TensionDecayController.spec.ts

import { describe, expect, it } from 'vitest';

import { TensionDecayController } from '../TensionDecayController';
import type { AnticipationEntry, DecayComputeInput } from '../types';
import {
  ENTRY_STATE,
  THREAT_SEVERITY,
  THREAT_SEVERITY_WEIGHTS,
  THREAT_TYPE,
  TENSION_CONSTANTS,
} from '../types';

let entrySequence = 0;

function createEntry(
  state: AnticipationEntry['state'],
  overrides: Partial<AnticipationEntry> = {},
): AnticipationEntry {
  entrySequence += 1;

  const threatType =
    overrides.threatType ??
    (state === ENTRY_STATE.NULLIFIED
      ? THREAT_TYPE.OPPORTUNITY_KILL
      : THREAT_TYPE.DEBT_SPIRAL);

  const threatSeverity = overrides.threatSeverity ?? THREAT_SEVERITY.MODERATE;
  const isArrived = state === ENTRY_STATE.ARRIVED || state === ENTRY_STATE.EXPIRED;
  const isMitigated = state === ENTRY_STATE.MITIGATED;
  const isExpired = state === ENTRY_STATE.EXPIRED;
  const isNullified = state === ENTRY_STATE.NULLIFIED;

  return {
    entryId: overrides.entryId ?? `entry-${entrySequence}`,
    runId: overrides.runId ?? 'run-decay-spec',
    sourceKey: overrides.sourceKey ?? `source-${entrySequence}`,
    threatId: overrides.threatId ?? `threat-${entrySequence}`,
    source: overrides.source ?? 'TEST_HARNESS',
    threatType,
    threatSeverity,
    enqueuedAtTick: overrides.enqueuedAtTick ?? 1,
    arrivalTick: overrides.arrivalTick ?? 4,
    isCascadeTriggered: overrides.isCascadeTriggered ?? false,
    cascadeTriggerEventId: overrides.cascadeTriggerEventId ?? null,
    worstCaseOutcome:
      overrides.worstCaseOutcome ?? 'Lose recurring income for 3 ticks',
    mitigationCardTypes:
      overrides.mitigationCardTypes ??
      Object.freeze(['INCOME_SHIELD', 'LEGAL_COUNTERMEASURE']),
    baseTensionPerTick:
      overrides.baseTensionPerTick ??
      (state === ENTRY_STATE.ARRIVED || state === ENTRY_STATE.EXPIRED
        ? TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK
        : TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK),
    severityWeight:
      overrides.severityWeight ??
      THREAT_SEVERITY_WEIGHTS[threatSeverity],
    summary:
      overrides.summary ?? 'Deterministic tension test entry',
    state: overrides.state ?? state,
    isArrived: overrides.isArrived ?? isArrived,
    isMitigated: overrides.isMitigated ?? isMitigated,
    isExpired: overrides.isExpired ?? isExpired,
    isNullified: overrides.isNullified ?? isNullified,
    mitigatedAtTick:
      overrides.mitigatedAtTick ?? (isMitigated ? 6 : null),
    expiredAtTick:
      overrides.expiredAtTick ?? (isExpired ? 7 : null),
    ticksOverdue: overrides.ticksOverdue ?? (isExpired ? 2 : 0),
    decayTicksRemaining:
      overrides.decayTicksRemaining ??
      (isMitigated
        ? TENSION_CONSTANTS.MITIGATION_DECAY_TICKS
        : isNullified
          ? TENSION_CONSTANTS.NULLIFY_DECAY_TICKS
          : 0),
  };
}

function queuedEntry(
  overrides: Partial<AnticipationEntry> = {},
): AnticipationEntry {
  return createEntry(ENTRY_STATE.QUEUED, overrides);
}

function arrivedEntry(
  overrides: Partial<AnticipationEntry> = {},
): AnticipationEntry {
  return createEntry(ENTRY_STATE.ARRIVED, overrides);
}

function expiredEntry(
  overrides: Partial<AnticipationEntry> = {},
): AnticipationEntry {
  return createEntry(ENTRY_STATE.EXPIRED, overrides);
}

function mitigatedEntry(
  overrides: Partial<AnticipationEntry> = {},
): AnticipationEntry {
  return createEntry(ENTRY_STATE.MITIGATED, overrides);
}

function nullifiedEntry(
  overrides: Partial<AnticipationEntry> = {},
): AnticipationEntry {
  return createEntry(ENTRY_STATE.NULLIFIED, overrides);
}

function createInput(
  overrides: Partial<DecayComputeInput> = {},
): DecayComputeInput {
  return {
    activeEntries: overrides.activeEntries ?? [],
    expiredEntries: overrides.expiredEntries ?? [],
    relievedEntries: overrides.relievedEntries ?? [],
    pressureTier: overrides.pressureTier ?? 'T0',
    visibilityAwarenessBonus: overrides.visibilityAwarenessBonus ?? 0,
    queueIsEmpty: overrides.queueIsEmpty ?? true,
    sovereigntyMilestoneReached:
      overrides.sovereigntyMilestoneReached ?? false,
  };
}

describe('TensionDecayController', () => {
  it('computes positive delta when threats are queued', () => {
    const controller = new TensionDecayController();

    const result = controller.computeDelta(
      createInput({
        activeEntries: [queuedEntry(), queuedEntry()],
        queueIsEmpty: false,
      }),
    );

    expect(result.rawDelta).toBeCloseTo(0.24, 6);
    expect(result.amplifiedDelta).toBeCloseTo(0.24, 6);
    expect(result.contributionBreakdown.queuedThreats).toBeCloseTo(0.24, 6);
    expect(result.contributionBreakdown.arrivedThreats).toBe(0);
  });

  it('ARRIVED threats contribute more than QUEUED threats', () => {
    const controller = new TensionDecayController();

    const queuedResult = controller.computeDelta(
      createInput({
        activeEntries: [queuedEntry()],
        queueIsEmpty: false,
      }),
    );

    const arrivedResult = controller.computeDelta(
      createInput({
        activeEntries: [arrivedEntry()],
        queueIsEmpty: false,
      }),
    );

    expect(queuedResult.amplifiedDelta).toBeCloseTo(
      TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK,
      6,
    );
    expect(arrivedResult.amplifiedDelta).toBeCloseTo(
      TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK,
      6,
    );
    expect(arrivedResult.amplifiedDelta).toBeGreaterThan(
      queuedResult.amplifiedDelta,
    );
  });

  it('amplifies only positive contributions and leaves decay unamplified', () => {
    const controller = new TensionDecayController();

    const result = controller.computeDelta(
      createInput({
        activeEntries: [queuedEntry()],
        relievedEntries: [mitigatedEntry()],
        pressureTier: 'T4',
        queueIsEmpty: false,
      }),
    );

    const expectedPositive =
      TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK * 1.5;
    const expectedNegative =
      -TENSION_CONSTANTS.MITIGATION_DECAY_PER_TICK;
    const expectedTotal = expectedPositive + expectedNegative;

    expect(result.rawDelta).toBeCloseTo(
      TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK -
        TENSION_CONSTANTS.MITIGATION_DECAY_PER_TICK,
      6,
    );
    expect(result.amplifiedDelta).toBeCloseTo(expectedTotal, 6);
    expect(result.contributionBreakdown.mitigationDecay).toBeCloseTo(
      expectedNegative,
      6,
    );
  });

  it('applies visibility awareness bonus on top of queue pressure', () => {
    const controller = new TensionDecayController();

    const result = controller.computeDelta(
      createInput({
        activeEntries: [queuedEntry()],
        visibilityAwarenessBonus: 0.05,
        queueIsEmpty: false,
      }),
    );

    expect(result.contributionBreakdown.visibilityBonus).toBeCloseTo(0.05, 6);
    expect(result.amplifiedDelta).toBeCloseTo(0.17, 6);
  });

  it('produces a negative delta when the active queue is empty', () => {
    const controller = new TensionDecayController();

    const result = controller.computeDelta(
      createInput({
        queueIsEmpty: true,
      }),
    );

    expect(result.contributionBreakdown.emptyQueueBonus).toBeCloseTo(-0.05, 6);
    expect(result.amplifiedDelta).toBeLessThan(0);
    expect(result.amplifiedDelta).toBeCloseTo(-0.05, 6);
  });

  it('sovereignty bonus fires exactly once per run', () => {
    const controller = new TensionDecayController();

    const first = controller.computeDelta(
      createInput({
        sovereigntyMilestoneReached: true,
        queueIsEmpty: true,
      }),
    );

    const second = controller.computeDelta(
      createInput({
        sovereigntyMilestoneReached: true,
        queueIsEmpty: true,
      }),
    );

    expect(first.contributionBreakdown.sovereigntyBonus).toBeCloseTo(-0.15, 6);
    expect(second.contributionBreakdown.sovereigntyBonus).toBe(0);
  });

  it('reset rearms sovereignty bonus for the next run', () => {
    const controller = new TensionDecayController();

    const first = controller.computeDelta(
      createInput({
        sovereigntyMilestoneReached: true,
        queueIsEmpty: true,
      }),
    );

    controller.reset();

    const second = controller.computeDelta(
      createInput({
        sovereigntyMilestoneReached: true,
        queueIsEmpty: true,
      }),
    );

    expect(first.contributionBreakdown.sovereigntyBonus).toBeCloseTo(-0.15, 6);
    expect(second.contributionBreakdown.sovereigntyBonus).toBeCloseTo(-0.15, 6);
  });

  it('expired ghost penalty accumulates per expired threat', () => {
    const controller = new TensionDecayController();

    const result = controller.computeDelta(
      createInput({
        expiredEntries: [expiredEntry(), expiredEntry(), expiredEntry()],
        queueIsEmpty: true,
      }),
    );

    expect(result.contributionBreakdown.expiredGhosts).toBeCloseTo(0.24, 6);
    expect(result.amplifiedDelta).toBeCloseTo(0.19, 6);
  });

  it('nullified threats apply partial relief rather than full mitigation relief', () => {
    const controller = new TensionDecayController();

    const nullifiedResult = controller.computeDelta(
      createInput({
        relievedEntries: [nullifiedEntry(), nullifiedEntry()],
        queueIsEmpty: false,
      }),
    );

    const mitigatedResult = controller.computeDelta(
      createInput({
        relievedEntries: [mitigatedEntry(), mitigatedEntry()],
        queueIsEmpty: false,
      }),
    );

    expect(nullifiedResult.contributionBreakdown.nullifyDecay).toBeCloseTo(
      -0.08,
      6,
    );
    expect(mitigatedResult.contributionBreakdown.mitigationDecay).toBeCloseTo(
      -0.16,
      6,
    );
    expect(mitigatedResult.amplifiedDelta).toBeLessThan(
      nullifiedResult.amplifiedDelta,
    );
  });

  it('stacks empty queue recovery with post-mitigation decay', () => {
    const controller = new TensionDecayController();

    const result = controller.computeDelta(
      createInput({
        relievedEntries: [mitigatedEntry()],
        queueIsEmpty: true,
      }),
    );

    expect(result.contributionBreakdown.mitigationDecay).toBeCloseTo(-0.08, 6);
    expect(result.contributionBreakdown.emptyQueueBonus).toBeCloseTo(-0.05, 6);
    expect(result.amplifiedDelta).toBeCloseTo(-0.13, 6);
  });

  it('honors the pressure amplifier table across all repo tiers', () => {
    const controller = new TensionDecayController();

    const t0 = controller.computeDelta(
      createInput({
        activeEntries: [queuedEntry()],
        pressureTier: 'T0',
        queueIsEmpty: false,
      }),
    );

    const t1 = controller.computeDelta(
      createInput({
        activeEntries: [queuedEntry()],
        pressureTier: 'T1',
        queueIsEmpty: false,
      }),
    );

    const t2 = controller.computeDelta(
      createInput({
        activeEntries: [queuedEntry()],
        pressureTier: 'T2',
        queueIsEmpty: false,
      }),
    );

    const t3 = controller.computeDelta(
      createInput({
        activeEntries: [queuedEntry()],
        pressureTier: 'T3',
        queueIsEmpty: false,
      }),
    );

    const t4 = controller.computeDelta(
      createInput({
        activeEntries: [queuedEntry()],
        pressureTier: 'T4',
        queueIsEmpty: false,
      }),
    );

    expect(t0.amplifiedDelta).toBeCloseTo(0.12, 6);
    expect(t1.amplifiedDelta).toBeCloseTo(0.132, 6);
    expect(t2.amplifiedDelta).toBeCloseTo(0.144, 6);
    expect(t3.amplifiedDelta).toBeCloseTo(0.162, 6);
    expect(t4.amplifiedDelta).toBeCloseTo(0.18, 6);
  });
});