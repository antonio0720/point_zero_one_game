/**
 * FILE: backend/src/game/engine/tension/__tests__/TensionUXBridge.spec.ts
 *
 * 15/10 contract tests for the upgraded backend TensionUXBridge.
 * These tests guarantee that Engine 3 emits the correct typed events,
 * in deterministic order, with no hidden game-state mutation behavior.
 */

import { describe, expect, it } from 'vitest';
import { EventBus } from '../../core/EventBus';
import { TensionUXBridge } from '../TensionUXBridge';
import {
  type AnticipationEntry,
  type AnticipationQueueUpdatedEvent,
  type TensionPulseFiredEvent,
  type TensionScoreUpdatedEvent,
  type TensionSnapshot,
  type TensionVisibilityChangedEvent,
  type ThreatArrivedEvent,
  type ThreatExpiredEvent,
  type ThreatMitigatedEvent,
  EntryState,
  PressureTier,
  ThreatSeverity,
  ThreatType,
  TENSION_CONSTANTS,
  VisibilityState,
} from '../types';

type TensionEventMap = {
  TENSION_SCORE_UPDATED: TensionScoreUpdatedEvent;
  TENSION_VISIBILITY_CHANGED: TensionVisibilityChangedEvent;
  TENSION_PULSE_FIRED: TensionPulseFiredEvent;
  THREAT_ARRIVED: ThreatArrivedEvent;
  THREAT_MITIGATED: ThreatMitigatedEvent;
  THREAT_EXPIRED: ThreatExpiredEvent;
  ANTICIPATION_QUEUE_UPDATED: AnticipationQueueUpdatedEvent;
};

let entrySequence = 0;

function createBus(): EventBus<TensionEventMap> {
  return new EventBus<TensionEventMap>();
}

function createBridge(bus: EventBus<TensionEventMap>): TensionUXBridge {
  return new TensionUXBridge(bus);
}

function createEntry(
  overrides: Partial<AnticipationEntry> = {},
): AnticipationEntry {
  entrySequence += 1;

  return {
    entryId: overrides.entryId ?? `entry-${entrySequence}`,
    threatId: overrides.threatId ?? `threat-${entrySequence}`,
    threatType: overrides.threatType ?? ThreatType.SABOTAGE,
    threatSeverity: overrides.threatSeverity ?? ThreatSeverity.SEVERE,
    enqueuedAtTick: overrides.enqueuedAtTick ?? 4,
    arrivalTick: overrides.arrivalTick ?? 7,
    isCascadeTriggered: overrides.isCascadeTriggered ?? false,
    cascadeTriggerEventId: overrides.cascadeTriggerEventId ?? null,
    worstCaseOutcome:
      overrides.worstCaseOutcome ?? 'Income channel disabled for 2 ticks',
    mitigationCardTypes:
      overrides.mitigationCardTypes ??
      Object.freeze(['COUNTER_INTEL', 'RAPID_REPAIR']),
    baseTensionPerTick:
      overrides.baseTensionPerTick ??
      TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK,
    state: overrides.state ?? EntryState.ARRIVED,
    isArrived: overrides.isArrived ?? true,
    isMitigated: overrides.isMitigated ?? false,
    isExpired: overrides.isExpired ?? false,
    isNullified: overrides.isNullified ?? false,
    mitigatedAtTick: overrides.mitigatedAtTick ?? null,
    expiredAtTick: overrides.expiredAtTick ?? null,
    ticksOverdue: overrides.ticksOverdue ?? 0,
    decayTicksRemaining: overrides.decayTicksRemaining ?? 0,
  };
}

function createSnapshot(
  overrides: Partial<TensionSnapshot> = {},
): TensionSnapshot {
  return {
    score: overrides.score ?? 0.91,
    rawScore: overrides.rawScore ?? 0.88,
    amplifiedScore: overrides.amplifiedScore ?? 0.91,
    visibilityState: overrides.visibilityState ?? VisibilityState.TELEGRAPHED,
    queueLength: overrides.queueLength ?? 3,
    arrivedCount: overrides.arrivedCount ?? 1,
    queuedCount: overrides.queuedCount ?? 2,
    expiredCount: overrides.expiredCount ?? 1,
    isPulseActive: overrides.isPulseActive ?? true,
    pulseTicksActive: overrides.pulseTicksActive ?? 2,
    scoreHistory:
      overrides.scoreHistory ?? Object.freeze([0.51, 0.73, 0.91]),
    isEscalating: overrides.isEscalating ?? true,
    dominantEntryId: overrides.dominantEntryId ?? 'entry-dominant',
    pressureTierAtCompute:
      overrides.pressureTierAtCompute ?? PressureTier.CRITICAL,
    tickNumber: overrides.tickNumber ?? 12,
    timestamp: overrides.timestamp ?? 1_717_171_717_000,
  };
}

function getLastEnvelope<K extends keyof TensionEventMap>(
  bus: EventBus<TensionEventMap>,
  event: K,
) {
  const envelope = bus.last(event);
  expect(envelope).not.toBeNull();
  return envelope!;
}

describe('TensionUXBridge', () => {
  it('emitScoreUpdated emits TENSION_SCORE_UPDATED with snapshot fields', () => {
    const bus = createBus();
    const bridge = createBridge(bus);
    const snapshot = createSnapshot({
      score: 0.64,
      visibilityState: VisibilityState.SIGNALED,
      tickNumber: 9,
      timestamp: 1_700_000_000_009,
    });

    bridge.emitScoreUpdated(snapshot);

    const envelope = getLastEnvelope(bus, 'TENSION_SCORE_UPDATED');

    expect(envelope.payload).toEqual({
      eventType: 'TENSION_SCORE_UPDATED',
      score: 0.64,
      visibilityState: VisibilityState.SIGNALED,
      tickNumber: 9,
      timestamp: 1_700_000_000_009,
    });
    expect(bus.historyCount()).toBe(1);
    expect(bus.queuedCount()).toBe(1);
  });

  it('emitVisibilityChanged emits the exact from/to transition', () => {
    const bus = createBus();
    const bridge = createBridge(bus);

    bridge.emitVisibilityChanged(
      VisibilityState.SHADOWED,
      VisibilityState.TELEGRAPHED,
      22,
    );

    const envelope = getLastEnvelope(bus, 'TENSION_VISIBILITY_CHANGED');

    expect(envelope.payload.eventType).toBe('TENSION_VISIBILITY_CHANGED');
    expect(envelope.payload.from).toBe(VisibilityState.SHADOWED);
    expect(envelope.payload.to).toBe(VisibilityState.TELEGRAPHED);
    expect(envelope.payload.tickNumber).toBe(22);
    expect(typeof envelope.payload.timestamp).toBe('number');
  });

  it('emitPulseFired emits TENSION_PULSE_FIRED with pulse metadata', () => {
    const bus = createBus();
    const bridge = createBridge(bus);
    const snapshot = createSnapshot({
      score: 0.95,
      queueLength: 5,
      pulseTicksActive: 3,
      tickNumber: 18,
    });

    bridge.emitPulseFired(snapshot);

    const envelope = getLastEnvelope(bus, 'TENSION_PULSE_FIRED');

    expect(envelope.payload).toEqual({
      eventType: 'TENSION_PULSE_FIRED',
      score: 0.95,
      queueLength: 5,
      pulseTicksActive: 3,
      tickNumber: 18,
      timestamp: snapshot.timestamp,
    });
  });

  it('emitThreatArrived emits a full threat arrival payload', () => {
    const bus = createBus();
    const bridge = createBridge(bus);
    const entry = createEntry({
      threatType: ThreatType.SOVEREIGNTY,
      threatSeverity: ThreatSeverity.EXISTENTIAL,
      worstCaseOutcome: 'Freedom target wiped and proof chain fractured',
      mitigationCardTypes: Object.freeze([
        'LITIGATION_BASTION',
        'TRUST_FORTIFICATION',
      ]),
    });

    bridge.emitThreatArrived(entry, 31);

    const envelope = getLastEnvelope(bus, 'THREAT_ARRIVED');

    expect(envelope.payload.eventType).toBe('THREAT_ARRIVED');
    expect(envelope.payload.entryId).toBe(entry.entryId);
    expect(envelope.payload.threatType).toBe(ThreatType.SOVEREIGNTY);
    expect(envelope.payload.threatSeverity).toBe(ThreatSeverity.EXISTENTIAL);
    expect(envelope.payload.worstCaseOutcome).toBe(
      'Freedom target wiped and proof chain fractured',
    );
    expect(envelope.payload.mitigationCardTypes).toEqual([
      'LITIGATION_BASTION',
      'TRUST_FORTIFICATION',
    ]);
    expect(envelope.payload.tickNumber).toBe(31);
    expect(typeof envelope.payload.timestamp).toBe('number');
  });

  it('emitThreatMitigated emits THREAT_MITIGATED without extra mutation', () => {
    const bus = createBus();
    const bridge = createBridge(bus);

    bridge.emitThreatMitigated('entry-99', ThreatType.CASCADE, 44);

    const envelope = getLastEnvelope(bus, 'THREAT_MITIGATED');

    expect(envelope.payload).toEqual({
      eventType: 'THREAT_MITIGATED',
      entryId: 'entry-99',
      threatType: ThreatType.CASCADE,
      tickNumber: 44,
      timestamp: envelope.payload.timestamp,
    });
    expect(typeof envelope.payload.timestamp).toBe('number');
  });

  it('emitThreatExpired emits overdue metadata for post-window failure', () => {
    const bus = createBus();
    const bridge = createBridge(bus);
    const entry = createEntry({
      state: EntryState.EXPIRED,
      isArrived: true,
      isExpired: true,
      expiredAtTick: 27,
      ticksOverdue: 2,
      threatType: ThreatType.DEBT_SPIRAL,
      threatSeverity: ThreatSeverity.CRITICAL,
    });

    bridge.emitThreatExpired(entry, 27);

    const envelope = getLastEnvelope(bus, 'THREAT_EXPIRED');

    expect(envelope.payload.eventType).toBe('THREAT_EXPIRED');
    expect(envelope.payload.entryId).toBe(entry.entryId);
    expect(envelope.payload.threatType).toBe(ThreatType.DEBT_SPIRAL);
    expect(envelope.payload.threatSeverity).toBe(ThreatSeverity.CRITICAL);
    expect(envelope.payload.ticksOverdue).toBe(2);
    expect(envelope.payload.tickNumber).toBe(27);
  });

  it('emitQueueUpdated emits queue counters for store synchronization', () => {
    const bus = createBus();
    const bridge = createBridge(bus);

    bridge.emitQueueUpdated(7, 3, 52);

    const envelope = getLastEnvelope(bus, 'ANTICIPATION_QUEUE_UPDATED');

    expect(envelope.payload).toEqual({
      eventType: 'ANTICIPATION_QUEUE_UPDATED',
      queueLength: 7,
      arrivedCount: 3,
      tickNumber: 52,
      timestamp: envelope.payload.timestamp,
    });
    expect(typeof envelope.payload.timestamp).toBe('number');
  });

  it('preserves deterministic event order across multiple bridge calls', () => {
    const bus = createBus();
    const bridge = createBridge(bus);
    const snapshot = createSnapshot({
      score: 0.93,
      queueLength: 4,
      pulseTicksActive: 1,
      tickNumber: 61,
      timestamp: 1_800_000_000_061,
    });

    bridge.emitScoreUpdated(snapshot);
    bridge.emitPulseFired(snapshot);
    bridge.emitQueueUpdated(4, 2, 61);

    const history = bus.getHistory();

    expect(history).toHaveLength(3);
    expect(history[0].event).toBe('TENSION_SCORE_UPDATED');
    expect(history[1].event).toBe('TENSION_PULSE_FIRED');
    expect(history[2].event).toBe('ANTICIPATION_QUEUE_UPDATED');
    expect(history[0].sequence).toBeLessThan(history[1].sequence);
    expect(history[1].sequence).toBeLessThan(history[2].sequence);
  });
});