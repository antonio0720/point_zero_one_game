// /backend/src/game/engine/tension/__tests__/TensionEngine.spec.ts

import { beforeEach, describe, expect, it } from 'vitest';
import { EventBus } from '../../core/EventBus';
import { DeterministicClock } from '../../core/ClockSource';
import type { TickContext } from '../../core/EngineContracts';
import type { EngineEventMap } from '../../core/GamePrimitives';
import type { RunStateSnapshot } from '../../core/RunStateSnapshot';
import { TensionEngine } from '../TensionEngine';
import {
  TENSION_EVENT_NAMES,
  TENSION_VISIBILITY_STATE,
  THREAT_SEVERITY,
  THREAT_TYPE,
} from '../types';

type TestEventMap = EngineEventMap & Record<string, unknown>;

interface SnapshotOverrides {
  readonly runId?: string;
  readonly tick?: number;
  readonly phase?: RunStateSnapshot['phase'];
  readonly outcome?: RunStateSnapshot['outcome'];
  readonly netWorth?: number;
  readonly freedomTarget?: number;
  readonly pressureTier?: RunStateSnapshot['pressure']['tier'];
  readonly pressureScore?: number;
  readonly pressureBand?: RunStateSnapshot['pressure']['band'];
  readonly pendingAttacks?: RunStateSnapshot['battle']['pendingAttacks'];
  readonly extractionCooldownTicks?: number;
  readonly counterIntelTier?: number;
  readonly visibleThreats?: RunStateSnapshot['tension']['visibleThreats'];
  readonly tensionScore?: number;
  readonly integrityStatus?: RunStateSnapshot['sovereignty']['integrityStatus'];
  readonly gapVsLegend?: number;
  readonly auditFlags?: readonly string[];
}

function buildAttack(
  id: string,
  magnitude = 100,
  category: RunStateSnapshot['battle']['pendingAttacks'][number]['category'] = 'DEBT',
): RunStateSnapshot['battle']['pendingAttacks'][number] {
  return {
    attackId: id,
    source: 'SYSTEM',
    targetEntity: 'SELF',
    targetLayer: 'DIRECT',
    category,
    magnitude,
    createdAtTick: 1,
    notes: Object.freeze([]),
  };
}

function buildSnapshot(
  overrides: SnapshotOverrides = {},
): RunStateSnapshot {
  const runId = overrides.runId ?? 'run-tension-engine';
  const tick = overrides.tick ?? 1;
  const pressureTier = overrides.pressureTier ?? 'T0';
  const pressureScore = overrides.pressureScore ?? 0.1;
  const pressureBand = overrides.pressureBand ?? 'CALM';

  return {
    schemaVersion: 'engine-run-state.v2',
    runId,
    userId: 'user-001',
    seed: 'seed-001',
    mode: 'solo',
    tick,
    phase: overrides.phase ?? 'FOUNDATION',
    outcome: overrides.outcome ?? null,
    tags: Object.freeze([]),
    economy: {
      cash: 2_500,
      debt: 400,
      incomePerTick: 120,
      expensesPerTick: 80,
      netWorth: overrides.netWorth ?? 2_000,
      freedomTarget: overrides.freedomTarget ?? 10_000,
      haterHeat: 0.15,
      opportunitiesPurchased: 0,
      privilegePlays: 0,
    },
    pressure: {
      score: pressureScore,
      tier: pressureTier,
      band: pressureBand,
      previousTier: 'T0',
      previousBand: 'CALM',
      upwardCrossings: 0,
      survivedHighPressureTicks: 0,
      lastEscalationTick: null,
      maxScoreSeen: pressureScore,
    },
    tension: {
      score: overrides.tensionScore ?? 0,
      anticipation: 0,
      visibleThreats: overrides.visibleThreats ?? Object.freeze([]),
      maxPulseTriggered: false,
      lastSpikeTick: null,
    },
    shield: {
      layers: Object.freeze([
        {
          layerId: 'L1',
          label: 'CASH_RESERVE',
          current: 100,
          max: 100,
          regenPerTick: 2,
          breached: false,
          integrityRatio: 1,
          lastDamagedTick: null,
          lastRecoveredTick: null,
        },
        {
          layerId: 'L2',
          label: 'CREDIT_LINE',
          current: 100,
          max: 100,
          regenPerTick: 1,
          breached: false,
          integrityRatio: 1,
          lastDamagedTick: null,
          lastRecoveredTick: null,
        },
        {
          layerId: 'L3',
          label: 'INCOME_BASE',
          current: 100,
          max: 100,
          regenPerTick: 1,
          breached: false,
          integrityRatio: 1,
          lastDamagedTick: null,
          lastRecoveredTick: null,
        },
        {
          layerId: 'L4',
          label: 'NETWORK_CORE',
          current: 100,
          max: 100,
          regenPerTick: 1,
          breached: false,
          integrityRatio: 1,
          lastDamagedTick: null,
          lastRecoveredTick: null,
        },
      ]),
      weakestLayerId: 'L1',
      weakestLayerRatio: 1,
      blockedThisRun: 0,
      damagedThisRun: 0,
      breachesThisRun: 0,
      repairQueueDepth: 0,
    },
    battle: {
      bots: Object.freeze([
        {
          botId: 'BOT_01',
          label: 'Bot 01',
          state: 'WATCHING',
          heat: 0.2,
          lastAttackTick: null,
          attacksLanded: 0,
          attacksBlocked: 0,
          neutralized: false,
        },
      ]),
      battleBudget: 100,
      battleBudgetCap: 100,
      extractionCooldownTicks: overrides.extractionCooldownTicks ?? 0,
      firstBloodClaimed: false,
      pendingAttacks: overrides.pendingAttacks ?? Object.freeze([]),
      sharedOpportunityDeckCursor: 0,
      rivalryHeatCarry: 0,
      neutralizedBotIds: Object.freeze([]),
    },
    cascade: {
      activeChains: Object.freeze([]),
      positiveTrackers: Object.freeze([]),
      brokenChains: 0,
      completedChains: 0,
      repeatedTriggerCounts:
        Object.freeze({}) as RunStateSnapshot['cascade']['repeatedTriggerCounts'],
      lastResolvedTick: null,
    },
    sovereignty: {
      integrityStatus: overrides.integrityStatus ?? 'VERIFIED',
      tickChecksums: Object.freeze([]),
      proofHash: null,
      sovereigntyScore: 0.35,
      verifiedGrade: 'B',
      proofBadges: Object.freeze([]),
      gapVsLegend: overrides.gapVsLegend ?? 0.1,
      gapClosingRate: 0.02,
      cordScore: 0.35,
      auditFlags: overrides.auditFlags ?? Object.freeze([]),
      lastVerifiedTick: null,
    },
    cards: {
      hand: Object.freeze([]),
      discard: Object.freeze([]),
      exhaust: Object.freeze([]),
      drawHistory: Object.freeze([]),
      lastPlayed: Object.freeze([]),
      ghostMarkers: Object.freeze([]),
      drawPileSize: 20,
      deckEntropy: 0.15,
    },
    modeState: {
      holdEnabled: false,
      loadoutEnabled: false,
      sharedTreasury: false,
      sharedTreasuryBalance: 0,
      trustScores:
        Object.freeze({}) as RunStateSnapshot['modeState']['trustScores'],
      roleAssignments:
        Object.freeze({}) as RunStateSnapshot['modeState']['roleAssignments'],
      defectionStepByPlayer:
        Object.freeze({}) as RunStateSnapshot['modeState']['defectionStepByPlayer'],
      legendMarkersEnabled: false,
      communityHeatModifier: 1,
      sharedOpportunityDeck: false,
      counterIntelTier: overrides.counterIntelTier ?? 0,
      spectatorLimit: 0,
      phaseBoundaryWindowsRemaining: 0,
      bleedMode: false,
      handicapIds: Object.freeze([]),
      advantageId: null,
      disabledBots: Object.freeze([]),
      modePresentation: 'empire',
      roleLockEnabled: false,
      extractionActionsRemaining: 0,
      ghostBaselineRunId: null,
      legendOwnerUserId: null,
    },
    timers: {
      seasonBudgetMs: 60_000,
      extensionBudgetMs: 0,
      elapsedMs: tick * 1_000,
      currentTickDurationMs: 1_000,
      nextTickAtMs: tick * 1_000 + 1_000,
      holdCharges: 0,
      activeDecisionWindows:
        Object.freeze({}) as RunStateSnapshot['timers']['activeDecisionWindows'],
      frozenWindowIds: Object.freeze([]),
    },
    telemetry: {
      decisions: Object.freeze([]),
      outcomeReason: null,
      outcomeReasonCode: null,
      lastTickChecksum: null,
      forkHints: Object.freeze([]),
      emittedEventCount: 0,
      warnings: Object.freeze([]),
    },
  };
}

function createBus(): EventBus<TestEventMap> {
  return new EventBus<TestEventMap>();
}

function createContext(
  snapshot: RunStateSnapshot,
  bus: EventBus<TestEventMap>,
  nowMs = 1_000,
): TickContext {
  return {
    step: 'STEP_04_TENSION',
    nowMs,
    clock: new DeterministicClock(nowMs),
    bus: bus as unknown as TickContext['bus'],
    trace: {
      runId: snapshot.runId,
      tick: snapshot.tick,
      step: 'STEP_04_TENSION',
      mode: snapshot.mode,
      phase: snapshot.phase,
      traceId: `trace-${snapshot.runId}-${snapshot.tick}`,
    },
  };
}

function buildManualThreatInput(
  currentTick = 1,
): Parameters<TensionEngine['enqueueThreat']>[0] {
  return {
    runId: 'run-manual-threat',
    sourceKey: `manual:${currentTick}:001`,
    threatId: `manual-threat:${currentTick}:001`,
    source: 'SYSTEM',
    threatType: THREAT_TYPE.DEBT_SPIRAL,
    threatSeverity: THREAT_SEVERITY.MODERATE,
    currentTick,
    arrivalTick: currentTick + 3,
    isCascadeTriggered: false,
    cascadeTriggerEventId: null,
    worstCaseOutcome: 'Debt spiral destroys liquidity.',
    mitigationCardTypes: Object.freeze(['INCOME_SHIELD']),
    summary: 'Manual debt spiral threat.',
    severityWeight: 0.4,
  };
}

describe('TensionEngine', () => {
  let engine: TensionEngine;
  let bus: EventBus<TestEventMap>;

  beforeEach(() => {
    engine = new TensionEngine();
    bus = createBus();
  });

  it('enqueueThreat increases queue length immediately on the backend surface', () => {
    engine.enqueueThreat(buildManualThreatInput(1));

    expect(engine.getQueueLength()).toBe(1);
  });

  it('tick materializes discovered threats and computes SIGNALED visibility at T1', () => {
    const snapshot = buildSnapshot({
      tick: 2,
      pressureTier: 'T1',
      pressureScore: 0.25,
      pressureBand: 'BUILDING',
      pendingAttacks: Object.freeze([buildAttack('attack-001', 50, 'DEBT')]),
    });

    const next = engine.tick(snapshot, createContext(snapshot, bus));
    const runtime = engine.getRuntimeSnapshot();

    expect(next.tension.anticipation).toBe(1);
    expect(runtime.visibilityState).toBe(TENSION_VISIBILITY_STATE.SIGNALED);
    expect(runtime.queueLength).toBe(1);
    expect(runtime.queuedCount).toBe(1);
    expect(runtime.arrivedCount).toBe(0);
  });

  it('tick reaches TELEGRAPHED at T2 and projects visible threat envelopes', () => {
    const snapshot = buildSnapshot({
      tick: 3,
      pressureTier: 'T2',
      pressureScore: 0.45,
      pressureBand: 'ELEVATED',
      pendingAttacks: Object.freeze([buildAttack('attack-telegraph', 80, 'DEBT')]),
    });

    engine.tick(snapshot, createContext(snapshot, bus));
    const runtime = engine.getRuntimeSnapshot();

    expect(runtime.visibilityState).toBe(TENSION_VISIBILITY_STATE.TELEGRAPHED);
    expect(runtime.visibleThreats.length).toBe(1);
    expect(runtime.visibleThreats[0]?.visibleAs).toBe('PARTIAL');
  });

  it('EXPOSED visibility requires T4 pressure plus near-death economics', () => {
    const healthySnapshot = buildSnapshot({
      tick: 1,
      pressureTier: 'T4',
      pressureScore: 0.95,
      pressureBand: 'CRITICAL',
      netWorth: 2_000,
      pendingAttacks: Object.freeze([buildAttack('attack-safe', 100, 'DEBT')]),
    });

    engine.tick(healthySnapshot, createContext(healthySnapshot, bus));
    expect(engine.getRuntimeSnapshot().visibilityState).not.toBe(
      TENSION_VISIBILITY_STATE.EXPOSED,
    );

    const nearDeathSnapshot = buildSnapshot({
      runId: healthySnapshot.runId,
      tick: 2,
      pressureTier: 'T4',
      pressureScore: 0.95,
      pressureBand: 'CRITICAL',
      netWorth: 10,
      pendingAttacks: Object.freeze([buildAttack('attack-dying', 100, 'DEBT')]),
    });

    engine.tick(nearDeathSnapshot, createContext(nearDeathSnapshot, bus, 2_000));
    expect(engine.getRuntimeSnapshot().visibilityState).toBe(
      TENSION_VISIBILITY_STATE.EXPOSED,
    );
  });

  it('fires a pulse event when the score reaches the pulse threshold', () => {
    const nightmareSnapshot = buildSnapshot({
      tick: 5,
      pressureTier: 'T4',
      pressureScore: 1,
      pressureBand: 'CRITICAL',
      netWorth: 5,
      pendingAttacks: Object.freeze([
        buildAttack('pulse-001', 1_500, 'DEBT'),
        buildAttack('pulse-002', 1_500, 'DEBT'),
        buildAttack('pulse-003', 1_500, 'DEBT'),
        buildAttack('pulse-004', 1_500, 'DEBT'),
        buildAttack('pulse-005', 1_500, 'DEBT'),
      ]),
    });

    engine.tick(nightmareSnapshot, createContext(nightmareSnapshot, bus, 5_000));

    const runtime = engine.getRuntimeSnapshot();
    const pulseEnvelope = bus.last(TENSION_EVENT_NAMES.PULSE_FIRED);

    expect(runtime.score).toBeGreaterThanOrEqual(0.9);
    expect(runtime.isPulseActive).toBe(true);
    expect(runtime.pulseTicksActive).toBeGreaterThanOrEqual(1);
    expect(pulseEnvelope).not.toBeNull();
    expect(pulseEnvelope?.payload).toEqual(
      expect.objectContaining({
        eventType: 'TENSION_PULSE_FIRED',
      }),
    );
  });

  it('emits queue and score update events during tick execution', () => {
    const snapshot = buildSnapshot({
      tick: 4,
      pressureTier: 'T2',
      pressureScore: 0.5,
      pressureBand: 'ELEVATED',
      pendingAttacks: Object.freeze([buildAttack('event-001', 100, 'DEBT')]),
    });

    engine.tick(snapshot, createContext(snapshot, bus, 4_000));

    const queueEnvelope = bus.last(TENSION_EVENT_NAMES.QUEUE_UPDATED);
    const scoreEnvelope = bus.last(TENSION_EVENT_NAMES.SCORE_UPDATED);
    const legacyEnvelope = bus.last(TENSION_EVENT_NAMES.UPDATED_LEGACY);

    expect(queueEnvelope).not.toBeNull();
    expect(scoreEnvelope).not.toBeNull();
    expect(legacyEnvelope).not.toBeNull();
  });

  it('mitigateThreat returns false for a QUEUED entry that has not arrived', () => {
    const entryId = engine.enqueueThreat(buildManualThreatInput(1));

    expect(engine.mitigateThreat(entryId, 2)).toBe(false);
  });

  it('score remains clamped inside [0, 1] across repeated nightmare ticks', () => {
    const runId = 'run-clamp-001';

    for (let tick = 1; tick <= 10; tick += 1) {
      const snapshot = buildSnapshot({
        runId,
        tick,
        pressureTier: 'T4',
        pressureScore: 1,
        pressureBand: 'CRITICAL',
        netWorth: 5,
        pendingAttacks: Object.freeze([
          buildAttack(`clamp-${tick}-01`, 10_000, 'DEBT'),
          buildAttack(`clamp-${tick}-02`, 10_000, 'DEBT'),
          buildAttack(`clamp-${tick}-03`, 10_000, 'DEBT'),
          buildAttack(`clamp-${tick}-04`, 10_000, 'DEBT'),
          buildAttack(`clamp-${tick}-05`, 10_000, 'DEBT'),
          buildAttack(`clamp-${tick}-06`, 10_000, 'DEBT'),
        ]),
      });

      const next = engine.tick(snapshot, createContext(snapshot, bus, tick * 1_000));

      expect(next.tension.score).toBeGreaterThanOrEqual(0);
      expect(next.tension.score).toBeLessThanOrEqual(1);
      expect(engine.getRuntimeSnapshot().score).toBeGreaterThanOrEqual(0);
      expect(engine.getRuntimeSnapshot().score).toBeLessThanOrEqual(1);
    }
  });

  it('reset clears queue, score history, runtime snapshot pulse state, and health surface stays queryable', () => {
    const snapshot = buildSnapshot({
      tick: 3,
      pressureTier: 'T4',
      pressureScore: 0.9,
      pressureBand: 'CRITICAL',
      pendingAttacks: Object.freeze([
        buildAttack('reset-001', 500, 'DEBT'),
        buildAttack('reset-002', 500, 'DEBT'),
      ]),
    });

    engine.tick(snapshot, createContext(snapshot, bus, 3_000));
    expect(engine.getQueueLength()).toBeGreaterThan(0);
    expect(engine.getCurrentScore()).toBeGreaterThan(0);

    engine.reset();

    expect(engine.getQueueLength()).toBe(0);
    expect(engine.getCurrentScore()).toBe(0);
    expect(engine.isAnticipationPulseActive()).toBe(false);
    expect(engine.getRuntimeSnapshot().score).toBe(0);
    expect(engine.getHealth().engineId).toBe('tension');
  });

  it('returns the input snapshot unchanged when the run is already terminal', () => {
    const terminalSnapshot = buildSnapshot({
      tick: 7,
      outcome: 'BANKRUPT',
      pendingAttacks: Object.freeze([buildAttack('terminal-001', 500, 'DEBT')]),
    });

    const next = engine.tick(terminalSnapshot, createContext(terminalSnapshot, bus, 7_000));

    expect(next).toBe(terminalSnapshot);
    expect(engine.getQueueLength()).toBe(0);
    expect(bus.queuedCount()).toBe(0);
  });

  it('raises a sovereignty dread threat when integrity is quarantined or audit flags are active', () => {
    const snapshot = buildSnapshot({
      tick: 8,
      pressureTier: 'T1',
      pressureScore: 0.25,
      pressureBand: 'BUILDING',
      integrityStatus: 'QUARANTINED',
      auditFlags: Object.freeze(['checksum-gap']),
    });

    engine.tick(snapshot, createContext(snapshot, bus, 8_000));
    const runtime = engine.getRuntimeSnapshot();

    expect(runtime.queueLength).toBeGreaterThanOrEqual(1);
    expect(runtime.visibleThreats.length).toBeGreaterThanOrEqual(1);
  });
});