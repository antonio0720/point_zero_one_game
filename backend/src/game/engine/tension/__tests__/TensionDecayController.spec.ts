/**
 * FILE: backend/src/game/engine/tension/__tests__/TensionDecayController.spec.ts
 *
 * 15/10 contract tests for the upgraded backend TensionDecayController.
 * These tests intentionally target the richer Engine 3 doctrine:
 * - queued dread
 * - arrived urgency
 * - expired ghost penalties
 * - positive-only pressure amplification
 * - empty-board recovery
 * - sovereignty milestone relief (once per run)
 */

import { describe, expect, it } from 'vitest';
import {
  TensionDecayController,
  type DecayComputeInput,
} from '../TensionDecayController';
import {
  type AnticipationEntry,
  EntryState,
  PressureTier,
  ThreatSeverity,
  ThreatType,
  TENSION_CONSTANTS,
} from '../types';

let entrySequence = 0;

function createEntry(
  state: EntryState,
  overrides: Partial<AnticipationEntry> = {},
): AnticipationEntry {
  entrySequence += 1;

  const defaultThreatType =
    state === EntryState.NULLIFIED
      ? ThreatType.OPPORTUNITY_KILL
      : ThreatType.DEBT_SPIRAL;

  const isArrived = state === EntryState.ARRIVED;
  const isMitigated = state === EntryState.MITIGATED;
  const isExpired = state === EntryState.EXPIRED;
  const isNullified = state === EntryState.NULLIFIED;

  return {
    entryId: overrides.entryId ?? `entry-${entrySequence}`,
    threatId: overrides.threatId ?? `threat-${entrySequence}`,
    threatType: overrides.threatType ?? defaultThreatType,
    threatSeverity: overrides.threatSeverity ?? ThreatSeverity.MODERATE,
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
      (state === EntryState.ARRIVED
        ? TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK
        : TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK),

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
      (isMitigated || isNullified
        ? TENSION_CONSTANTS.MITIGATION_DECAY_TICKS
        : 0),
  };
}

function queuedEntry(
  overrides: Partial<AnticipationEntry> = {},
): AnticipationEntry {
  return createEntry(EntryState.QUEUED, overrides);
}

function arrivedEntry(
  overrides: Partial<AnticipationEntry> = {},
): AnticipationEntry {
  return createEntry(EntryState.ARRIVED, overrides);
}

function expiredEntry(
  overrides: Partial<AnticipationEntry> = {},
): AnticipationEntry {
  return createEntry(EntryState.EXPIRED, overrides);
}

function mitigatedEntry(
  overrides: Partial<AnticipationEntry> = {},
): AnticipationEntry {
  return createEntry(EntryState.MITIGATED, overrides);
}

function nullifiedEntry(
  overrides: Partial<AnticipationEntry> = {},
): AnticipationEntry {
  return createEntry(EntryState.NULLIFIED, overrides);
}

function createInput(
  overrides: Partial<DecayComputeInput> = {},
): DecayComputeInput {
  return {
    activeEntries: [],
    expiredEntries: [],
    mitigatingEntries: [],
    pressureTier: PressureTier.CALM,
    visibilityAwarenessBonus: 0,
    queueIsEmpty: true,
    sovereigntyMilestoneReached: false,
    ...overrides,
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
        mitigatingEntries: [mitigatedEntry()],
        pressureTier: PressureTier.CRITICAL,
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
        mitigatingEntries: [nullifiedEntry(), nullifiedEntry()],
        queueIsEmpty: false,
      }),
    );

    const mitigatedResult = controller.computeDelta(
      createInput({
        mitigatingEntries: [mitigatedEntry(), mitigatedEntry()],
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
        mitigatingEntries: [mitigatedEntry()],
        queueIsEmpty: true,
      }),
    );

    expect(result.contributionBreakdown.mitigationDecay).toBeCloseTo(-0.08, 6);
    expect(result.contributionBreakdown.emptyQueueBonus).toBeCloseTo(-0.05, 6);
    expect(result.amplifiedDelta).toBeCloseTo(-0.13, 6);
  });

  it('honors the pressure amplifier table across tiers', () => {
    const controller = new TensionDecayController();

    const calm = controller.computeDelta(
      createInput({
        activeEntries: [queuedEntry()],
        pressureTier: PressureTier.CALM,
        queueIsEmpty: false,
      }),
    );

    const elevated = controller.computeDelta(
      createInput({
        activeEntries: [queuedEntry()],
        pressureTier: PressureTier.ELEVATED,
        queueIsEmpty: false,
      }),
    );

    const high = controller.computeDelta(
      createInput({
        activeEntries: [queuedEntry()],
        pressureTier: PressureTier.HIGH,
        queueIsEmpty: false,
      }),
    );

    const critical = controller.computeDelta(
      createInput({
        activeEntries: [queuedEntry()],
        pressureTier: PressureTier.CRITICAL,
        queueIsEmpty: false,
      }),
    );

    expect(calm.amplifiedDelta).toBeCloseTo(0.12, 6);
    expect(elevated.amplifiedDelta).toBeCloseTo(0.144, 6);
    expect(high.amplifiedDelta).toBeCloseTo(0.162, 6);
    expect(critical.amplifiedDelta).toBeCloseTo(0.18, 6);
  });
});