// FILE: backend/src/game/engine/tension/__tests__/fixtures.ts

/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND TENSION TEST FIXTURES
 * /backend/src/game/engine/tension/__tests__/fixtures.ts
 * ============================================================================
 *
 * Purpose:
 * - provide deterministic, repo-aligned fixtures for Engine 3 backend tests
 * - keep individual spec files focused on behavior rather than object assembly
 * - expose both expressive builders and ready-to-use baseline fixtures
 *
 * Doctrine:
 * - fixtures must match backend contracts, not ad-hoc test-only shapes
 * - all arrays returned from fixtures are frozen
 * - defaults favor solo mode and STEP_04_TENSION-era state assumptions
 * ============================================================================
 */

import type { ThreatEnvelope } from '../../core/GamePrimitives';
import { createInitialRunState } from '../../core/RunStateFactory';
import type { RunStateSnapshot } from '../../core/RunStateSnapshot';
import {
  ENTRY_STATE,
  THREAT_SEVERITY,
  THREAT_SEVERITY_WEIGHTS,
  THREAT_TYPE,
  TENSION_CONSTANTS,
  TENSION_VISIBILITY_STATE,
  type AnticipationEntry,
  type DecayComputeInput,
  type DecayContributionBreakdown,
  type QueueUpsertInput,
  type TensionRuntimeSnapshot,
} from '../types';

export interface RunStateFixtureOverrides
  extends Partial<
    Omit<
      RunStateSnapshot,
      | 'economy'
      | 'pressure'
      | 'tension'
      | 'shield'
      | 'battle'
      | 'cascade'
      | 'sovereignty'
      | 'cards'
      | 'modeState'
      | 'timers'
      | 'telemetry'
    >
  > {
  readonly economy?: Partial<RunStateSnapshot['economy']>;
  readonly pressure?: Partial<RunStateSnapshot['pressure']>;
  readonly tension?: Partial<RunStateSnapshot['tension']>;
  readonly shield?: Partial<RunStateSnapshot['shield']>;
  readonly battle?: Partial<RunStateSnapshot['battle']>;
  readonly cascade?: Partial<RunStateSnapshot['cascade']>;
  readonly sovereignty?: Partial<RunStateSnapshot['sovereignty']>;
  readonly cards?: Partial<RunStateSnapshot['cards']>;
  readonly modeState?: Partial<RunStateSnapshot['modeState']>;
  readonly timers?: Partial<RunStateSnapshot['timers']>;
  readonly telemetry?: Partial<RunStateSnapshot['telemetry']>;
}

export interface ThreatEnvelopeFixtureOverrides extends Partial<ThreatEnvelope> {}
export interface QueueInputFixtureOverrides extends Partial<QueueUpsertInput> {}
export interface AnticipationEntryFixtureOverrides
  extends Partial<AnticipationEntry> {}
export interface RuntimeSnapshotFixtureOverrides
  extends Partial<TensionRuntimeSnapshot> {}
export interface DecayInputFixtureOverrides
  extends Partial<DecayComputeInput> {}

const DEFAULT_RUN_ID = 'run_tension_fixture';
const DEFAULT_USER_ID = 'user_tension_fixture';
const DEFAULT_SEED = 'seed_tension_fixture';
const DEFAULT_MODE: RunStateSnapshot['mode'] = 'solo';

let fixtureSequence = 0;

function nextFixtureId(prefix: string): string {
  fixtureSequence += 1;
  return `${prefix}_${String(fixtureSequence).padStart(4, '0')}`;
}

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

function freezeBreakdown(
  overrides: Partial<DecayContributionBreakdown> = {},
): DecayContributionBreakdown {
  return Object.freeze({
    queuedThreats: overrides.queuedThreats ?? 0,
    arrivedThreats: overrides.arrivedThreats ?? 0,
    expiredGhosts: overrides.expiredGhosts ?? 0,
    mitigationDecay: overrides.mitigationDecay ?? 0,
    nullifyDecay: overrides.nullifyDecay ?? 0,
    emptyQueueBonus: overrides.emptyQueueBonus ?? 0,
    visibilityBonus: overrides.visibilityBonus ?? 0,
    sovereigntyBonus: overrides.sovereigntyBonus ?? 0,
  });
}

export function createThreatEnvelopeFixture(
  overrides: ThreatEnvelopeFixtureOverrides = {},
): ThreatEnvelope {
  return Object.freeze({
    threatId: overrides.threatId ?? nextFixtureId('threat'),
    source: overrides.source ?? 'SYSTEM_PRESSURE',
    etaTicks: overrides.etaTicks ?? 2,
    severity: overrides.severity ?? 6,
    visibleAs: overrides.visibleAs ?? 'PARTIAL',
    summary:
      overrides.summary ??
      'Debt spiral projected to breach player finances if left untreated.',
  });
}

export function createRunStateSnapshotFixture(
  overrides: RunStateFixtureOverrides = {},
): RunStateSnapshot {
  const base = createInitialRunState({
    runId: overrides.runId ?? DEFAULT_RUN_ID,
    userId: overrides.userId ?? DEFAULT_USER_ID,
    seed: overrides.seed ?? DEFAULT_SEED,
    mode: overrides.mode ?? DEFAULT_MODE,
    tags: overrides.tags,
  });

  return Object.freeze({
    ...base,
    ...overrides,
    economy: Object.freeze({
      ...base.economy,
      ...(overrides.economy ?? {}),
    }),
    pressure: Object.freeze({
      ...base.pressure,
      ...(overrides.pressure ?? {}),
    }),
    tension: Object.freeze({
      ...base.tension,
      ...(overrides.tension ?? {}),
      visibleThreats: freezeArray(
        overrides.tension?.visibleThreats ?? base.tension.visibleThreats,
      ),
    }),
    shield: Object.freeze({
      ...base.shield,
      ...(overrides.shield ?? {}),
      layers: freezeArray(overrides.shield?.layers ?? base.shield.layers),
    }),
    battle: Object.freeze({
      ...base.battle,
      ...(overrides.battle ?? {}),
      bots: freezeArray(overrides.battle?.bots ?? base.battle.bots),
      pendingAttacks: freezeArray(
        overrides.battle?.pendingAttacks ?? base.battle.pendingAttacks,
      ),
      neutralizedBotIds: freezeArray(
        overrides.battle?.neutralizedBotIds ?? base.battle.neutralizedBotIds,
      ),
    }),
    cascade: Object.freeze({
      ...base.cascade,
      ...(overrides.cascade ?? {}),
      activeChains: freezeArray(
        overrides.cascade?.activeChains ?? base.cascade.activeChains,
      ),
      positiveTrackers: freezeArray(
        overrides.cascade?.positiveTrackers ?? base.cascade.positiveTrackers,
      ),
      repeatedTriggerCounts: Object.freeze({
        ...base.cascade.repeatedTriggerCounts,
        ...(overrides.cascade?.repeatedTriggerCounts ?? {}),
      }),
    }),
    sovereignty: Object.freeze({
      ...base.sovereignty,
      ...(overrides.sovereignty ?? {}),
      tickChecksums: freezeArray(
        overrides.sovereignty?.tickChecksums ?? base.sovereignty.tickChecksums,
      ),
      proofBadges: freezeArray(
        overrides.sovereignty?.proofBadges ?? base.sovereignty.proofBadges,
      ),
      auditFlags: freezeArray(
        overrides.sovereignty?.auditFlags ?? base.sovereignty.auditFlags,
      ),
    }),
    cards: Object.freeze({
      ...base.cards,
      ...(overrides.cards ?? {}),
      hand: freezeArray(overrides.cards?.hand ?? base.cards.hand),
      discard: freezeArray(overrides.cards?.discard ?? base.cards.discard),
      exhaust: freezeArray(overrides.cards?.exhaust ?? base.cards.exhaust),
      drawHistory: freezeArray(
        overrides.cards?.drawHistory ?? base.cards.drawHistory,
      ),
      lastPlayed: freezeArray(
        overrides.cards?.lastPlayed ?? base.cards.lastPlayed,
      ),
      ghostMarkers: freezeArray(
        overrides.cards?.ghostMarkers ?? base.cards.ghostMarkers,
      ),
    }),
    modeState: Object.freeze({
      ...base.modeState,
      ...(overrides.modeState ?? {}),
      trustScores: Object.freeze({
        ...base.modeState.trustScores,
        ...(overrides.modeState?.trustScores ?? {}),
      }),
      roleAssignments: Object.freeze({
        ...base.modeState.roleAssignments,
        ...(overrides.modeState?.roleAssignments ?? {}),
      }),
      defectionStepByPlayer: Object.freeze({
        ...base.modeState.defectionStepByPlayer,
        ...(overrides.modeState?.defectionStepByPlayer ?? {}),
      }),
      handicapIds: freezeArray(
        overrides.modeState?.handicapIds ?? base.modeState.handicapIds,
      ),
      disabledBots: freezeArray(
        overrides.modeState?.disabledBots ?? base.modeState.disabledBots,
      ),
    }),
    timers: Object.freeze({
      ...base.timers,
      ...(overrides.timers ?? {}),
      activeDecisionWindows: Object.freeze({
        ...base.timers.activeDecisionWindows,
        ...(overrides.timers?.activeDecisionWindows ?? {}),
      }),
      frozenWindowIds: freezeArray(
        overrides.timers?.frozenWindowIds ?? base.timers.frozenWindowIds,
      ),
    }),
    telemetry: Object.freeze({
      ...base.telemetry,
      ...(overrides.telemetry ?? {}),
      decisions: freezeArray(
        overrides.telemetry?.decisions ?? base.telemetry.decisions,
      ),
      forkHints: freezeArray(
        overrides.telemetry?.forkHints ?? base.telemetry.forkHints,
      ),
      warnings: freezeArray(
        overrides.telemetry?.warnings ?? base.telemetry.warnings,
      ),
    }),
  });
}

export function createQueueUpsertInputFixture(
  overrides: QueueInputFixtureOverrides = {},
): QueueUpsertInput {
  const threatSeverity = overrides.threatSeverity ?? THREAT_SEVERITY.MODERATE;

  return Object.freeze({
    runId: overrides.runId ?? DEFAULT_RUN_ID,
    sourceKey: overrides.sourceKey ?? nextFixtureId('source_key'),
    threatId: overrides.threatId ?? nextFixtureId('threat_id'),
    source: overrides.source ?? 'TEST_HARNESS',
    threatType: overrides.threatType ?? THREAT_TYPE.DEBT_SPIRAL,
    threatSeverity,
    currentTick: overrides.currentTick ?? 1,
    arrivalTick: overrides.arrivalTick ?? 4,
    isCascadeTriggered: overrides.isCascadeTriggered ?? false,
    cascadeTriggerEventId: overrides.cascadeTriggerEventId ?? null,
    worstCaseOutcome:
      overrides.worstCaseOutcome ??
      'Recurring cashflow destruction overwhelms the player economy.',
    mitigationCardTypes: freezeArray(
      overrides.mitigationCardTypes ?? ['REFINANCE', 'INCOME_SHIELD'],
    ),
    summary:
      overrides.summary ??
      'Debt spiral forecast has entered the anticipation queue.',
    severityWeight:
      overrides.severityWeight ?? THREAT_SEVERITY_WEIGHTS[threatSeverity],
  });
}

export function createAnticipationEntryFixture(
  overrides: AnticipationEntryFixtureOverrides = {},
): AnticipationEntry {
  const baseInput = createQueueUpsertInputFixture({
    runId: overrides.runId,
    sourceKey: overrides.sourceKey,
    threatId: overrides.threatId,
    source: overrides.source,
    threatType: overrides.threatType,
    threatSeverity: overrides.threatSeverity,
    currentTick: overrides.enqueuedAtTick,
    arrivalTick: overrides.arrivalTick,
    isCascadeTriggered: overrides.isCascadeTriggered,
    cascadeTriggerEventId: overrides.cascadeTriggerEventId,
    worstCaseOutcome: overrides.worstCaseOutcome,
    mitigationCardTypes: overrides.mitigationCardTypes,
    summary: overrides.summary,
    severityWeight: overrides.severityWeight,
  });

  const state = overrides.state ?? ENTRY_STATE.QUEUED;
  const isArrived =
    overrides.isArrived ??
    (state === ENTRY_STATE.ARRIVED || state === ENTRY_STATE.EXPIRED);
  const isMitigated =
    overrides.isMitigated ?? state === ENTRY_STATE.MITIGATED;
  const isExpired = overrides.isExpired ?? state === ENTRY_STATE.EXPIRED;
  const isNullified = overrides.isNullified ?? state === ENTRY_STATE.NULLIFIED;

  return {
    entryId: overrides.entryId ?? nextFixtureId('tension_entry'),
    runId: overrides.runId ?? baseInput.runId,
    sourceKey: overrides.sourceKey ?? baseInput.sourceKey,
    threatId: overrides.threatId ?? baseInput.threatId,
    source: overrides.source ?? baseInput.source,
    threatType: overrides.threatType ?? baseInput.threatType,
    threatSeverity: overrides.threatSeverity ?? baseInput.threatSeverity,
    enqueuedAtTick: overrides.enqueuedAtTick ?? baseInput.currentTick,
    arrivalTick: overrides.arrivalTick ?? baseInput.arrivalTick,
    isCascadeTriggered:
      overrides.isCascadeTriggered ?? baseInput.isCascadeTriggered,
    cascadeTriggerEventId:
      overrides.cascadeTriggerEventId ?? baseInput.cascadeTriggerEventId,
    worstCaseOutcome:
      overrides.worstCaseOutcome ?? baseInput.worstCaseOutcome,
    mitigationCardTypes: freezeArray(
      overrides.mitigationCardTypes ?? baseInput.mitigationCardTypes,
    ),
    baseTensionPerTick:
      overrides.baseTensionPerTick ??
      (state === ENTRY_STATE.ARRIVED || state === ENTRY_STATE.EXPIRED
        ? TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK
        : TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK),
    severityWeight:
      overrides.severityWeight ??
      baseInput.severityWeight ??
      THREAT_SEVERITY_WEIGHTS[baseInput.threatSeverity],
    summary: overrides.summary ?? baseInput.summary,
    state,
    isArrived,
    isMitigated,
    isExpired,
    isNullified,
    mitigatedAtTick:
      overrides.mitigatedAtTick ?? (isMitigated ? baseInput.arrivalTick : null),
    expiredAtTick:
      overrides.expiredAtTick ?? (isExpired ? baseInput.arrivalTick + 1 : null),
    ticksOverdue: overrides.ticksOverdue ?? 0,
    decayTicksRemaining:
      overrides.decayTicksRemaining ??
      (state === ENTRY_STATE.MITIGATED
        ? TENSION_CONSTANTS.MITIGATION_DECAY_TICKS
        : state === ENTRY_STATE.NULLIFIED
          ? TENSION_CONSTANTS.NULLIFY_DECAY_TICKS
          : 0),
  };
}

export function createQueuedEntryFixture(
  overrides: AnticipationEntryFixtureOverrides = {},
): AnticipationEntry {
  return createAnticipationEntryFixture({
    state: ENTRY_STATE.QUEUED,
    isArrived: false,
    isMitigated: false,
    isExpired: false,
    isNullified: false,
    ticksOverdue: 0,
    decayTicksRemaining: 0,
    ...overrides,
  });
}

export function createArrivedEntryFixture(
  overrides: AnticipationEntryFixtureOverrides = {},
): AnticipationEntry {
  return createAnticipationEntryFixture({
    state: ENTRY_STATE.ARRIVED,
    isArrived: true,
    isMitigated: false,
    isExpired: false,
    isNullified: false,
    baseTensionPerTick: TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK,
    arrivalTick: overrides.arrivalTick ?? 1,
    enqueuedAtTick: overrides.enqueuedAtTick ?? 0,
    ticksOverdue: overrides.ticksOverdue ?? 0,
    ...overrides,
  });
}

export function createExpiredEntryFixture(
  overrides: AnticipationEntryFixtureOverrides = {},
): AnticipationEntry {
  return createAnticipationEntryFixture({
    state: ENTRY_STATE.EXPIRED,
    isArrived: true,
    isMitigated: false,
    isExpired: true,
    isNullified: false,
    baseTensionPerTick: TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK,
    arrivalTick: overrides.arrivalTick ?? 1,
    expiredAtTick: overrides.expiredAtTick ?? 4,
    ticksOverdue: overrides.ticksOverdue ?? 3,
    ...overrides,
  });
}

export function createMitigatedEntryFixture(
  overrides: AnticipationEntryFixtureOverrides = {},
): AnticipationEntry {
  return createAnticipationEntryFixture({
    state: ENTRY_STATE.MITIGATED,
    isArrived: true,
    isMitigated: true,
    isExpired: false,
    isNullified: false,
    baseTensionPerTick: TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK,
    mitigatedAtTick: overrides.mitigatedAtTick ?? 3,
    decayTicksRemaining:
      overrides.decayTicksRemaining ??
      TENSION_CONSTANTS.MITIGATION_DECAY_TICKS,
    ...overrides,
  });
}

export function createNullifiedEntryFixture(
  overrides: AnticipationEntryFixtureOverrides = {},
): AnticipationEntry {
  return createAnticipationEntryFixture({
    state: ENTRY_STATE.NULLIFIED,
    isArrived: overrides.isArrived ?? false,
    isMitigated: false,
    isExpired: false,
    isNullified: true,
    decayTicksRemaining:
      overrides.decayTicksRemaining ?? TENSION_CONSTANTS.NULLIFY_DECAY_TICKS,
    ...overrides,
  });
}

export function createTensionRuntimeSnapshotFixture(
  overrides: RuntimeSnapshotFixtureOverrides = {},
): TensionRuntimeSnapshot {
  const visibleThreats = freezeArray(overrides.visibleThreats ?? []);
  const queueLength = overrides.queueLength ?? visibleThreats.length;
  const arrivedCount = overrides.arrivedCount ?? 0;
  const queuedCount =
    overrides.queuedCount ?? Math.max(0, queueLength - arrivedCount);

  return Object.freeze({
    score: overrides.score ?? 0,
    previousScore: overrides.previousScore ?? 0,
    rawDelta: overrides.rawDelta ?? 0,
    amplifiedDelta: overrides.amplifiedDelta ?? 0,
    visibilityState:
      overrides.visibilityState ?? TENSION_VISIBILITY_STATE.SHADOWED,
    queueLength,
    arrivedCount,
    queuedCount,
    expiredCount: overrides.expiredCount ?? 0,
    relievedCount: overrides.relievedCount ?? 0,
    visibleThreats,
    isPulseActive:
      overrides.isPulseActive ??
      (overrides.score ?? 0) >= TENSION_CONSTANTS.PULSE_THRESHOLD,
    pulseTicksActive: overrides.pulseTicksActive ?? 0,
    isEscalating: overrides.isEscalating ?? false,
    dominantEntryId: overrides.dominantEntryId ?? null,
    lastSpikeTick: overrides.lastSpikeTick ?? null,
    tickNumber: overrides.tickNumber ?? 1,
    timestamp: overrides.timestamp ?? 1_700_000_000_000,
    contributionBreakdown: freezeBreakdown(overrides.contributionBreakdown),
  });
}

export function createDecayInputFixture(
  overrides: DecayInputFixtureOverrides = {},
): DecayComputeInput {
  return Object.freeze({
    activeEntries: freezeArray(overrides.activeEntries ?? []),
    expiredEntries: freezeArray(overrides.expiredEntries ?? []),
    relievedEntries: freezeArray(overrides.relievedEntries ?? []),
    pressureTier: overrides.pressureTier ?? 'T0',
    visibilityAwarenessBonus: overrides.visibilityAwarenessBonus ?? 0,
    queueIsEmpty: overrides.queueIsEmpty ?? true,
    sovereigntyMilestoneReached:
      overrides.sovereigntyMilestoneReached ?? false,
  });
}

/* -------------------------------------------------------------------------
 * Baseline exports for terse test ergonomics
 * ---------------------------------------------------------------------- */

export const baseEnqueueInput: QueueUpsertInput = createQueueUpsertInputFixture();
export const baseQueueUpsertInput: QueueUpsertInput = baseEnqueueInput;

export const emptyDecayInput: DecayComputeInput = createDecayInputFixture();

export function mockThreatEnvelope(
  overrides: ThreatEnvelopeFixtureOverrides = {},
): ThreatEnvelope {
  return createThreatEnvelopeFixture(overrides);
}

export function mockQueuedEntry(
  overrides: AnticipationEntryFixtureOverrides = {},
): AnticipationEntry {
  return createQueuedEntryFixture(overrides);
}

export function mockArrivedEntry(
  overrides: AnticipationEntryFixtureOverrides = {},
): AnticipationEntry {
  return createArrivedEntryFixture(overrides);
}

export function mockExpiredEntry(
  overrides: AnticipationEntryFixtureOverrides = {},
): AnticipationEntry {
  return createExpiredEntryFixture(overrides);
}

export function mockMitigatedEntry(
  overrides: AnticipationEntryFixtureOverrides = {},
): AnticipationEntry {
  return createMitigatedEntryFixture(overrides);
}

export function mockNullifiedEntry(
  overrides: AnticipationEntryFixtureOverrides = {},
): AnticipationEntry {
  return createNullifiedEntryFixture(overrides);
}

export function mockRuntimeSnapshot(
  overrides: RuntimeSnapshotFixtureOverrides = {},
): TensionRuntimeSnapshot {
  return createTensionRuntimeSnapshotFixture(overrides);
}

export function mockRunStateSnapshot(
  overrides: RunStateFixtureOverrides = {},
): RunStateSnapshot {
  return createRunStateSnapshotFixture(overrides);
}