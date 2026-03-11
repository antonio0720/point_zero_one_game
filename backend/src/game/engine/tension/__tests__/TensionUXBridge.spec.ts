// FILE: backend/src/game/engine/tension/__tests__/TensionUXBridge.spec.ts

import { describe, expect, it } from 'vitest';

import { EventBus, type EventEnvelope } from '../../core/EventBus';
import { TensionUXBridge } from '../TensionUXBridge';
import type {
  AnticipationEntry,
  AnticipationQueueUpdatedEvent,
  ThreatArrivedEvent,
  ThreatExpiredEvent,
  ThreatMitigatedEvent,
  TensionPulseFiredEvent,
  TensionRuntimeSnapshot,
  TensionScoreUpdatedEvent,
  TensionVisibilityChangedEvent,
} from '../types';
import {
  ENTRY_STATE,
  THREAT_SEVERITY,
  THREAT_SEVERITY_WEIGHTS,
  THREAT_TYPE,
  TENSION_CONSTANTS,
  TENSION_EVENT_NAMES,
  TENSION_VISIBILITY_STATE,
} from '../types';

type LooseEventMap = Record<string, unknown>;

let entrySequence = 0;

function createBus(): EventBus<LooseEventMap> {
  return new EventBus<LooseEventMap>();
}

function createBridge(bus: EventBus<LooseEventMap>): TensionUXBridge {
  return new TensionUXBridge(bus);
}

function createEntry(
  overrides: Partial<AnticipationEntry> = {},
): AnticipationEntry {
  entrySequence += 1;

  const threatSeverity = overrides.threatSeverity ?? THREAT_SEVERITY.SEVERE;

  return {
    entryId: overrides.entryId ?? `entry-${entrySequence}`,
    runId: overrides.runId ?? 'run-tension-ux-bridge',
    sourceKey: overrides.sourceKey ?? `source-${entrySequence}`,
    threatId: overrides.threatId ?? `threat-${entrySequence}`,
    source: overrides.source ?? 'TEST_HARNESS',
    threatType: overrides.threatType ?? THREAT_TYPE.SABOTAGE,
    threatSeverity,
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
    severityWeight:
      overrides.severityWeight ?? THREAT_SEVERITY_WEIGHTS[threatSeverity],
    summary:
      overrides.summary ?? 'Sabotage window projected to arrive.',
    state: overrides.state ?? ENTRY_STATE.ARRIVED,
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
  overrides: Partial<TensionRuntimeSnapshot> = {},
): TensionRuntimeSnapshot {
  return {
    score: overrides.score ?? 0.91,
    previousScore: overrides.previousScore ?? 0.88,
    rawDelta: overrides.rawDelta ?? 0.03,
    amplifiedDelta: overrides.amplifiedDelta ?? 0.03,
    visibilityState:
      overrides.visibilityState ?? TENSION_VISIBILITY_STATE.TELEGRAPHED,
    queueLength: overrides.queueLength ?? 3,
    arrivedCount: overrides.arrivedCount ?? 1,
    queuedCount: overrides.queuedCount ?? 2,
    expiredCount: overrides.expiredCount ?? 1,
    relievedCount: overrides.relievedCount ?? 0,
    visibleThreats: overrides.visibleThreats ?? Object.freeze([]),
    isPulseActive: overrides.isPulseActive ?? true,
    pulseTicksActive: overrides.pulseTicksActive ?? 2,
    isEscalating: overrides.isEscalating ?? true,
    dominantEntryId: overrides.dominantEntryId ?? 'entry-dominant',
    lastSpikeTick: overrides.lastSpikeTick ?? 11,
    tickNumber: overrides.tickNumber ?? 12,
    timestamp: overrides.timestamp ?? 1_717_171_717_000,
    contributionBreakdown:
      overrides.contributionBreakdown ??
      Object.freeze({
        queuedThreats: 0.24,
        arrivedThreats: 0.2,
        expiredGhosts: 0.08,
        mitigationDecay: 0,
        nullifyDecay: 0,
        emptyQueueBonus: 0,
        visibilityBonus: 0.05,
        sovereigntyBonus: 0,
      }),
  };
}

function getLastEnvelope(
  bus: EventBus<LooseEventMap>,
  event: string,
): EventEnvelope<string, unknown> {
  const envelope = bus.last(event);
  expect(envelope).not.toBeNull();
  return envelope as EventEnvelope<string, unknown>;
}

describe('TensionUXBridge', () => {
  it('emitScoreUpdated emits the typed score event and the legacy update event', () => {
    const bus = createBus();
    const bridge = createBridge(bus);
    const snapshot = createSnapshot({
      score: 0.64,
      previousScore: 0.51,
      rawDelta: 0.08,
      amplifiedDelta: 0.13,
      visibilityState: TENSION_VISIBILITY_STATE.SIGNALED,
      queueLength: 4,
      arrivedCount: 1,
      queuedCount: 3,
      expiredCount: 0,
      dominantEntryId: 'entry-9',
      tickNumber: 9,
      timestamp: 1_700_000_000_009,
    });

    bridge.emitScoreUpdated(snapshot);

    const scoreEnvelope = getLastEnvelope(bus, TENSION_EVENT_NAMES.SCORE_UPDATED);
    const legacyEnvelope = getLastEnvelope(bus, TENSION_EVENT_NAMES.UPDATED_LEGACY);

    const scorePayload =
      scoreEnvelope.payload as TensionScoreUpdatedEvent;

    expect(scorePayload).toEqual({
      eventType: 'TENSION_SCORE_UPDATED',
      score: 0.64,
      previousScore: 0.51,
      rawDelta: 0.08,
      amplifiedDelta: 0.13,
      visibilityState: TENSION_VISIBILITY_STATE.SIGNALED,
      queueLength: 4,
      arrivedCount: 1,
      queuedCount: 3,
      expiredCount: 0,
      dominantEntryId: 'entry-9',
      tickNumber: 9,
      timestamp: 1_700_000_000_009,
    });

    expect(legacyEnvelope.payload).toEqual(snapshot);
    expect(bus.historyCount()).toBe(2);
    expect(bus.queuedCount()).toBe(2);
  });

  it('emitVisibilityChanged emits the exact from/to transition', () => {
    const bus = createBus();
    const bridge = createBridge(bus);

    bridge.emitVisibilityChanged(
      TENSION_VISIBILITY_STATE.SHADOWED,
      TENSION_VISIBILITY_STATE.TELEGRAPHED,
      22,
      1_700_000_000_022,
    );

    const envelope = getLastEnvelope(bus, TENSION_EVENT_NAMES.VISIBILITY_CHANGED);
    const payload =
      envelope.payload as TensionVisibilityChangedEvent;

    expect(payload).toEqual({
      eventType: 'TENSION_VISIBILITY_CHANGED',
      from: TENSION_VISIBILITY_STATE.SHADOWED,
      to: TENSION_VISIBILITY_STATE.TELEGRAPHED,
      tickNumber: 22,
      timestamp: 1_700_000_000_022,
    });
  });

  it('emitPulseFired emits pulse metadata from the runtime snapshot', () => {
    const bus = createBus();
    const bridge = createBridge(bus);
    const snapshot = createSnapshot({
      score: 0.95,
      queueLength: 5,
      pulseTicksActive: 3,
      tickNumber: 18,
      timestamp: 1_700_000_000_018,
    });

    bridge.emitPulseFired(snapshot);

    const envelope = getLastEnvelope(bus, TENSION_EVENT_NAMES.PULSE_FIRED);
    const payload = envelope.payload as TensionPulseFiredEvent;

    expect(payload).toEqual({
      eventType: 'TENSION_PULSE_FIRED',
      score: 0.95,
      queueLength: 5,
      pulseTicksActive: 3,
      tickNumber: 18,
      timestamp: 1_700_000_000_018,
    });
  });

  it('emitThreatArrived emits a full threat arrival payload', () => {
    const bus = createBus();
    const bridge = createBridge(bus);
    const entry = createEntry({
      threatType: THREAT_TYPE.SOVEREIGNTY,
      threatSeverity: THREAT_SEVERITY.EXISTENTIAL,
      source: 'SOVEREIGN_WATCH',
      worstCaseOutcome: 'Freedom target wiped and proof chain fractured',
      mitigationCardTypes: Object.freeze([
        'LITIGATION_BASTION',
        'TRUST_FORTIFICATION',
      ]),
    });

    bridge.emitThreatArrived(entry, 31);

    const envelope = getLastEnvelope(bus, TENSION_EVENT_NAMES.THREAT_ARRIVED);
    const payload = envelope.payload as ThreatArrivedEvent;

    expect(payload.eventType).toBe('THREAT_ARRIVED');
    expect(payload.entryId).toBe(entry.entryId);
    expect(payload.threatType).toBe(THREAT_TYPE.SOVEREIGNTY);
    expect(payload.threatSeverity).toBe(THREAT_SEVERITY.EXISTENTIAL);
    expect(payload.source).toBe('SOVEREIGN_WATCH');
    expect(payload.worstCaseOutcome).toBe(
      'Freedom target wiped and proof chain fractured',
    );
    expect(payload.mitigationCardTypes).toEqual([
      'LITIGATION_BASTION',
      'TRUST_FORTIFICATION',
    ]);
    expect(payload.tickNumber).toBe(31);
    expect(typeof payload.timestamp).toBe('number');
  });

  it('emitThreatMitigated emits THREAT_MITIGATED without extra mutation', () => {
    const bus = createBus();
    const bridge = createBridge(bus);
    const entry = createEntry({
      entryId: 'entry-99',
      threatType: THREAT_TYPE.CASCADE,
    });

    bridge.emitThreatMitigated(entry, 44);

    const envelope = getLastEnvelope(bus, TENSION_EVENT_NAMES.THREAT_MITIGATED);
    const payload = envelope.payload as ThreatMitigatedEvent;

    expect(payload.eventType).toBe('THREAT_MITIGATED');
    expect(payload.entryId).toBe('entry-99');
    expect(payload.threatType).toBe(THREAT_TYPE.CASCADE);
    expect(payload.tickNumber).toBe(44);
    expect(typeof payload.timestamp).toBe('number');
  });

  it('emitThreatExpired emits overdue metadata for post-window failure', () => {
    const bus = createBus();
    const bridge = createBridge(bus);
    const entry = createEntry({
      state: ENTRY_STATE.EXPIRED,
      isArrived: true,
      isExpired: true,
      expiredAtTick: 27,
      ticksOverdue: 2,
      threatType: THREAT_TYPE.DEBT_SPIRAL,
      threatSeverity: THREAT_SEVERITY.CRITICAL,
    });

    bridge.emitThreatExpired(entry, 27);

    const envelope = getLastEnvelope(bus, TENSION_EVENT_NAMES.THREAT_EXPIRED);
    const payload = envelope.payload as ThreatExpiredEvent;

    expect(payload.eventType).toBe('THREAT_EXPIRED');
    expect(payload.entryId).toBe(entry.entryId);
    expect(payload.threatType).toBe(THREAT_TYPE.DEBT_SPIRAL);
    expect(payload.threatSeverity).toBe(THREAT_SEVERITY.CRITICAL);
    expect(payload.ticksOverdue).toBe(2);
    expect(payload.tickNumber).toBe(27);
    expect(typeof payload.timestamp).toBe('number');
  });

  it('emitQueueUpdated emits queue counters for store synchronization', () => {
    const bus = createBus();
    const bridge = createBridge(bus);

    bridge.emitQueueUpdated(7, 3, 4, 1, 52);

    const envelope = getLastEnvelope(bus, TENSION_EVENT_NAMES.QUEUE_UPDATED);
    const payload =
      envelope.payload as AnticipationQueueUpdatedEvent;

    expect(payload.eventType).toBe('ANTICIPATION_QUEUE_UPDATED');
    expect(payload.queueLength).toBe(7);
    expect(payload.arrivedCount).toBe(3);
    expect(payload.queuedCount).toBe(4);
    expect(payload.expiredCount).toBe(1);
    expect(payload.tickNumber).toBe(52);
    expect(typeof payload.timestamp).toBe('number');
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
    bridge.emitQueueUpdated(4, 2, 2, 0, 61);

    const history = bus.getHistory();

    expect(history).toHaveLength(4);
    expect(history[0].event).toBe(TENSION_EVENT_NAMES.SCORE_UPDATED);
    expect(history[1].event).toBe(TENSION_EVENT_NAMES.UPDATED_LEGACY);
    expect(history[2].event).toBe(TENSION_EVENT_NAMES.PULSE_FIRED);
    expect(history[3].event).toBe(TENSION_EVENT_NAMES.QUEUE_UPDATED);
    expect(history[0].sequence).toBeLessThan(history[1].sequence);
    expect(history[1].sequence).toBeLessThan(history[2].sequence);
    expect(history[2].sequence).toBeLessThan(history[3].sequence);
  });
});