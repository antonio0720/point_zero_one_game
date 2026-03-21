/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT RECOVERY OUTCOME TRACKER
 * FILE: backend/src/game/engine/chat/rescue/RecoveryOutcomeTracker.ts
 * VERSION: 2026.03.19
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * RecoveryOutcomeTracker is the backend durability and analytics surface for
 * what happens *after* a rescue offer exists. It tracks accepted recovery
 * options, timeout / abandonment paths, lift vectors, helper trust deltas,
 * reinforcement cohorts, and replay-safe recovery ledger projections.
 *
 * Why this file exists separately from RescueInterventionPlanner
 * -------------------------------------------------------------
 * RescueInterventionPlanner owns rescue-window orchestration.
 * ChurnRescuePolicy owns intervention law.
 * RecoveryOutcomeTracker owns downstream recovery-state truth, reinforcement,
 * and cohort-oriented analysis.
 *
 * The split matters because a rescue may open, accept, partially stabilize,
 * relapse, recover, or fail on a later beat. That needs a lawful backend lane
 * that is not just UI state and not just one-off planner output.
 * ============================================================================
 */

import type {
  ChatRecoveryBundle,
  ChatRecoveryDigest,
  ChatRecoveryEntryPoint,
  ChatRecoveryId,
  ChatRecoveryKind,
  ChatRecoveryLedgerEntry,
  ChatRecoveryOptionId,
  ChatRecoveryOutcome,
  ChatRecoveryOutcomeKind,
  ChatRecoveryPlan,
  ChatRecoverySuccessBand,
} from '../../../../../../shared/contracts/chat/ChatRecovery';
import {
  createRecoveryOutcome,
  deriveRecoveryDigest,
  deriveRecoveryLiftSnapshot,
} from '../../../../../../shared/contracts/chat/ChatRecovery';
import type {
  ChatRescueDigest,
  ChatRescueId,
  ChatRescuePlan,
} from '../../../../../../shared/contracts/chat/ChatRescue';
import { deriveRescueDigest } from '../../../../../../shared/contracts/chat/ChatRescue';

import type {
  ChatRoomId,
  JsonValue,
  Score01,
  UnixMs,
} from '../types';
import { asUnixMs, clamp01 } from '../types';

// ============================================================================
// MARK: Public contracts
// ============================================================================

export interface RecoveryOutcomeTrackerClock {
  now(): number;
}

export interface RecoveryOutcomeTrackerLogger {
  debug(event: string, payload?: Readonly<Record<string, JsonValue>>): void;
  info(event: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(event: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

export interface RecoveryOutcomeTrackerOptions {
  readonly clock?: RecoveryOutcomeTrackerClock;
  readonly logger?: RecoveryOutcomeTrackerLogger;
  readonly retainLedgerEntriesPerRoom?: number;
  readonly retainActiveRecordsPerRoom?: number;
  readonly relapseWindowMs?: number;
  readonly reinforcementDecayHalfLifeMs?: number;
}

export interface RecoveryOutcomeTrackerBeginRequest {
  readonly roomId: ChatRoomId;
  readonly rescuePlan?: ChatRescuePlan | null;
  readonly recoveryPlan: ChatRecoveryPlan;
  readonly predictedOutcome?: ChatRecoveryOutcome | null;
  readonly now?: UnixMs;
  readonly notes?: readonly string[];
}

export interface RecoveryOutcomeTrackerAcceptRequest {
  readonly roomId: ChatRoomId;
  readonly recoveryId: ChatRecoveryId;
  readonly acceptedOptionId?: ChatRecoveryOptionId | null;
  readonly now?: UnixMs;
  readonly notes?: readonly string[];
}

export interface RecoveryOutcomeTrackerResolutionRequest {
  readonly roomId: ChatRoomId;
  readonly recoveryId: ChatRecoveryId;
  readonly acceptedOptionId?: ChatRecoveryOptionId | null;
  readonly stabilityLift01: Score01;
  readonly embarrassmentReduction01: Score01;
  readonly confidenceLift01: Score01;
  readonly trustLift01: Score01;
  readonly now?: UnixMs;
  readonly notes?: readonly string[];
}

export interface RecoveryOutcomeTrackerTimeoutRequest {
  readonly roomId: ChatRoomId;
  readonly recoveryId: ChatRecoveryId;
  readonly now?: UnixMs;
  readonly notes?: readonly string[];
}

export interface RecoveryOutcomeTrackerAbandonRequest {
  readonly roomId: ChatRoomId;
  readonly recoveryId: ChatRecoveryId;
  readonly now?: UnixMs;
  readonly notes?: readonly string[];
}

export interface RecoveryOutcomeTrackerRelapseRequest {
  readonly roomId: ChatRoomId;
  readonly recoveryId: ChatRecoveryId;
  readonly relapseSeverity01: Score01;
  readonly now?: UnixMs;
  readonly notes?: readonly string[];
}

export interface RecoveryOutcomeTrackerRoomLedger {
  readonly roomId: ChatRoomId;
  readonly activeRecoveries: readonly ActiveRecoveryRecord[];
  readonly settledRecoveries: readonly SettledRecoveryRecord[];
  readonly recoveryLedger: readonly ChatRecoveryLedgerEntry[];
  readonly recoveryDigest: ChatRecoveryDigest;
  readonly rescueDigest: ChatRescueDigest;
}

export interface RecoveryOutcomeTrackerProjection {
  readonly roomId: ChatRoomId;
  readonly strongestSuccessBand?: ChatRecoverySuccessBand | null;
  readonly strongestOutcomeKind?: ChatRecoveryOutcomeKind | null;
  readonly activeRecoveryId?: ChatRecoveryId | null;
  readonly acceptedOptionId?: ChatRecoveryOptionId | null;
  readonly reinforcementScore01: Score01;
  readonly relapseRisk01: Score01;
  readonly cohort: RecoveryOutcomeTrackerCohort;
  readonly notes: readonly string[];
}

export interface RecoveryOutcomeTrackerSummary {
  readonly roomId: ChatRoomId;
  readonly activeCount: number;
  readonly settledCount: number;
  readonly recoveredCount: number;
  readonly stabilizedCount: number;
  readonly partialCount: number;
  readonly failedCount: number;
  readonly abandonedCount: number;
  readonly timedOutCount: number;
  readonly strongestSuccessBand?: ChatRecoverySuccessBand | null;
  readonly strongestOutcomeKind?: ChatRecoveryOutcomeKind | null;
  readonly averageReinforcement01: Score01;
  readonly averageRelapseRisk01: Score01;
}

export const RECOVERY_TRACKER_COHORTS = [
  'UNKNOWN',
  'SAVEABLE',
  'FRAGILE',
  'STABLE',
  'VOLATILE',
  'COMEBACK_READY',
  'HELPER_RELIANT',
] as const;
export type RecoveryOutcomeTrackerCohort = (typeof RECOVERY_TRACKER_COHORTS)[number];

export const RECOVERY_TRACKER_STATUS = [
  'ACTIVE',
  'ACCEPTED',
  'RESOLVED',
  'TIMED_OUT',
  'ABANDONED',
  'RELAPSED',
] as const;
export type RecoveryOutcomeTrackerStatus = (typeof RECOVERY_TRACKER_STATUS)[number];

export interface ActiveRecoveryRecord {
  readonly roomId: ChatRoomId;
  readonly recoveryId: ChatRecoveryId;
  readonly rescueId?: ChatRescueId | null;
  readonly plan: ChatRecoveryPlan;
  readonly predictedOutcome?: ChatRecoveryOutcome | null;
  readonly acceptedOptionId?: ChatRecoveryOptionId | null;
  readonly status: RecoveryOutcomeTrackerStatus;
  readonly createdAt: UnixMs;
  readonly acceptedAt?: UnixMs | null;
  readonly updatedAt: UnixMs;
  readonly lastResolvedAt?: UnixMs | null;
  readonly reinforcementScore01: Score01;
  readonly relapseRisk01: Score01;
  readonly cohort: RecoveryOutcomeTrackerCohort;
  readonly notes: readonly string[];
}

export interface SettledRecoveryRecord {
  readonly roomId: ChatRoomId;
  readonly recoveryId: ChatRecoveryId;
  readonly rescueId?: ChatRescueId | null;
  readonly outcome: ChatRecoveryOutcome;
  readonly ledgerEntry: ChatRecoveryLedgerEntry;
  readonly settledAt: UnixMs;
  readonly reinforcementScore01: Score01;
  readonly relapseRisk01: Score01;
  readonly cohort: RecoveryOutcomeTrackerCohort;
  readonly notes: readonly string[];
}

interface MutableRoomState {
  roomId: ChatRoomId;
  activeRecoveries: ActiveRecoveryRecord[];
  settledRecoveries: SettledRecoveryRecord[];
  recoveryLedger: ChatRecoveryLedgerEntry[];
  rescuePlans: ChatRescuePlan[];
}

const DEFAULT_CLOCK: RecoveryOutcomeTrackerClock = Object.freeze({
  now: () => Date.now(),
});

const DEFAULT_LOGGER: RecoveryOutcomeTrackerLogger = Object.freeze({
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
});

const DEFAULT_RETAIN_LEDGER = 240;
const DEFAULT_RETAIN_ACTIVE = 24;
const DEFAULT_RELAPSE_WINDOW_MS = 60_000;
const DEFAULT_REINFORCEMENT_HALF_LIFE_MS = 180_000;

// ============================================================================
// MARK: Utility helpers
// ============================================================================

function unix(value: number): UnixMs {
  return asUnixMs(Math.max(0, Math.trunc(value)));
}

function score01(value: number): Score01 {
  return clamp01(value) as Score01;
}

function safeArray<T>(value: readonly T[] | undefined | null): readonly T[] {
  return value ? Object.freeze(value.slice()) : Object.freeze([]);
}

function safeNumber(value: number | undefined | null, fallback: number): number {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function toRecoveryLedgerEntry(
  record: ActiveRecoveryRecord,
  outcome: ChatRecoveryOutcome,
  now: UnixMs,
): ChatRecoveryLedgerEntry {
  return {
    ledgerId: (`recovery-ledger:${String(record.recoveryId)}:${Number(now)}` as any),
    recoveryId: record.recoveryId,
    recoveryPlanId: record.plan.recoveryPlanId,
    visibleChannel: record.plan.visibleChannel,
    entryPoint: record.plan.entryPoint,
    outcomeKind: outcome.kind,
    successBand: outcome.successBand,
    createdAt: record.createdAt,
    updatedAt: now,
    replayId: null,
    acceptedOptionId: outcome.acceptedOptionId ?? null,
    notes: safeArray(record.notes),
  };
}

function deriveCohortFromRecord(input: {
  readonly predictedOutcome?: ChatRecoveryOutcome | null;
  readonly status: RecoveryOutcomeTrackerStatus;
  readonly reinforcementScore01: Score01;
  readonly relapseRisk01: Score01;
  readonly trustLift01?: Score01 | null;
}): RecoveryOutcomeTrackerCohort {
  const reinforcement = Number(input.reinforcementScore01);
  const relapse = Number(input.relapseRisk01);
  const trust = Number(input.trustLift01 ?? score01(0));

  if (input.status === 'RELAPSED') return 'VOLATILE';
  if (relapse >= 0.78) return 'FRAGILE';
  if (reinforcement >= 0.78 && trust >= 0.20) return 'COMEBACK_READY';
  if (reinforcement >= 0.68 && relapse <= 0.28) return 'STABLE';
  if (trust >= 0.28 && reinforcement >= 0.42) return 'HELPER_RELIANT';
  if (input.predictedOutcome?.successBand === 'RUN_SAVED') return 'SAVEABLE';
  return 'UNKNOWN';
}

function deriveReinforcementScore(input: {
  readonly stabilityLift01: Score01;
  readonly confidenceLift01: Score01;
  readonly trustLift01: Score01;
  readonly embarrassmentReduction01: Score01;
  readonly ageMs?: number;
  readonly halfLifeMs: number;
}): Score01 {
  const core =
    Number(input.stabilityLift01) * 0.42 +
    Number(input.confidenceLift01) * 0.26 +
    Number(input.trustLift01) * 0.18 +
    Number(input.embarrassmentReduction01) * 0.14;

  const ageMs = Math.max(0, safeNumber(input.ageMs, 0));
  const halfLifeMs = Math.max(1, input.halfLifeMs);
  const decay = Math.pow(0.5, ageMs / halfLifeMs);
  return score01(core * decay);
}

function deriveRelapseRisk(input: {
  readonly stabilityLift01: Score01;
  readonly confidenceLift01: Score01;
  readonly embarrassmentReduction01: Score01;
  readonly trustLift01: Score01;
  readonly predictedOutcome?: ChatRecoveryOutcome | null;
}): Score01 {
  const risk =
    (1 - Number(input.stabilityLift01)) * 0.40 +
    (1 - Number(input.confidenceLift01)) * 0.24 +
    (1 - Number(input.embarrassmentReduction01)) * 0.18 +
    (1 - Number(input.trustLift01)) * 0.10 +
    (input.predictedOutcome?.kind === 'FAILED' ? 0.08 : 0);
  return score01(risk);
}

function outcomeKindToStatus(kind: ChatRecoveryOutcomeKind): RecoveryOutcomeTrackerStatus {
  switch (kind) {
    case 'RECOVERED':
    case 'STABILIZED':
    case 'PARTIAL':
      return 'RESOLVED';
    case 'FAILED':
      return 'TIMED_OUT';
    case 'ABANDONED':
      return 'ABANDONED';
    default:
      return 'ACTIVE';
  }
}

function acceptedOptionIdFromBundle(bundle: ChatRecoveryBundle): ChatRecoveryOptionId | null {
  return bundle.options[0]?.optionId ?? null;
}

function withNotes(...groups: readonly (readonly string[] | undefined | null)[]): readonly string[] {
  const merged: string[] = [];
  for (const group of groups) {
    if (!group) continue;
    for (const note of group) {
      if (note && !merged.includes(note)) merged.push(note);
    }
  }
  return Object.freeze(merged);
}

function freezeRoom(room: MutableRoomState): RecoveryOutcomeTrackerRoomLedger {
  return Object.freeze({
    roomId: room.roomId,
    activeRecoveries: Object.freeze(room.activeRecoveries.slice()),
    settledRecoveries: Object.freeze(room.settledRecoveries.slice()),
    recoveryLedger: Object.freeze(room.recoveryLedger.slice()),
    recoveryDigest: deriveRecoveryDigest(room.recoveryLedger, unix(Date.now())),
    rescueDigest: deriveRescueDigest(
      room.rescuePlans.map((plan, index) => ({
        ledgerId: (`rescue-ledger-projection:${index}` as any),
        rescueId: plan.rescueId,
        roomId: plan.roomId,
        visibleChannel: plan.visibleChannel,
        kind: plan.kind,
        style: plan.style,
        urgency: plan.urgency,
        offeredAt: plan.offeredAt,
        expiresAt: plan.resolvedAt ?? null,
        outcome: plan.state,
        acceptedOfferId: plan.selectedOffer.offerId,
        acceptedActionId: plan.selectedOffer.actions[0]?.actionId ?? null,
        notes: plan.notes,
      })),
      unix(Date.now()),
    ),
  });
}

// ============================================================================
// MARK: RecoveryOutcomeTracker
// ============================================================================

export class RecoveryOutcomeTracker {
  private readonly clock: RecoveryOutcomeTrackerClock;
  private readonly logger: RecoveryOutcomeTrackerLogger;
  private readonly retainLedgerEntriesPerRoom: number;
  private readonly retainActiveRecordsPerRoom: number;
  private readonly relapseWindowMs: number;
  private readonly reinforcementDecayHalfLifeMs: number;
  private readonly rooms = new Map<string, MutableRoomState>();

  public constructor(options: RecoveryOutcomeTrackerOptions = {}) {
    this.clock = options.clock ?? DEFAULT_CLOCK;
    this.logger = options.logger ?? DEFAULT_LOGGER;
    this.retainLedgerEntriesPerRoom = Math.max(24, safeNumber(options.retainLedgerEntriesPerRoom, DEFAULT_RETAIN_LEDGER));
    this.retainActiveRecordsPerRoom = Math.max(4, safeNumber(options.retainActiveRecordsPerRoom, DEFAULT_RETAIN_ACTIVE));
    this.relapseWindowMs = Math.max(5_000, safeNumber(options.relapseWindowMs, DEFAULT_RELAPSE_WINDOW_MS));
    this.reinforcementDecayHalfLifeMs = Math.max(30_000, safeNumber(options.reinforcementDecayHalfLifeMs, DEFAULT_REINFORCEMENT_HALF_LIFE_MS));
  }

  public begin(request: RecoveryOutcomeTrackerBeginRequest): RecoveryOutcomeTrackerRoomLedger {
    const room = this.ensureRoom(request.roomId);
    const now = request.now ?? unix(this.clock.now());
    const existingIndex = room.activeRecoveries.findIndex((entry) => String(entry.recoveryId) === String(request.recoveryPlan.recoveryId));
    const predicted = request.predictedOutcome ?? null;
    const reinforcementScore01 = deriveReinforcementScore({
      stabilityLift01: predicted?.stabilityLift01 ?? score01(0.16),
      confidenceLift01: predicted?.confidenceLift01 ?? score01(0.12),
      trustLift01: predicted?.trustLift01 ?? score01(0.08),
      embarrassmentReduction01: predicted?.embarrassmentReduction01 ?? score01(0.10),
      ageMs: 0,
      halfLifeMs: this.reinforcementDecayHalfLifeMs,
    });
    const relapseRisk01 = deriveRelapseRisk({
      stabilityLift01: predicted?.stabilityLift01 ?? score01(0.16),
      confidenceLift01: predicted?.confidenceLift01 ?? score01(0.12),
      embarrassmentReduction01: predicted?.embarrassmentReduction01 ?? score01(0.10),
      trustLift01: predicted?.trustLift01 ?? score01(0.08),
      predictedOutcome: predicted,
    });
    const cohort = deriveCohortFromRecord({
      predictedOutcome: predicted,
      status: 'ACTIVE',
      reinforcementScore01,
      relapseRisk01,
      trustLift01: predicted?.trustLift01 ?? score01(0.08),
    });

    const next: ActiveRecoveryRecord = Object.freeze({
      roomId: request.roomId,
      recoveryId: request.recoveryPlan.recoveryId,
      rescueId: request.rescuePlan?.rescueId ?? request.recoveryPlan.rescueId ?? null,
      plan: request.recoveryPlan,
      predictedOutcome: predicted,
      acceptedOptionId: null,
      status: 'ACTIVE',
      createdAt: now,
      acceptedAt: null,
      updatedAt: now,
      lastResolvedAt: null,
      reinforcementScore01,
      relapseRisk01,
      cohort,
      notes: withNotes(request.recoveryPlan.notes, request.notes),
    });

    if (request.rescuePlan) {
      room.rescuePlans = [request.rescuePlan, ...room.rescuePlans.filter((value) => String(value.rescueId) !== String(request.rescuePlan!.rescueId))];
    }

    if (existingIndex >= 0) room.activeRecoveries.splice(existingIndex, 1);
    room.activeRecoveries.unshift(next);
    room.activeRecoveries = room.activeRecoveries.slice(0, this.retainActiveRecordsPerRoom);
    this.trim(room);

    this.logger.info('chat.recovery.backend.begin', {
      roomId: request.roomId as any,
      recoveryId: request.recoveryPlan.recoveryId as any,
      predictedKind: predicted?.kind ?? null,
      cohort,
    });

    return freezeRoom(room);
  }

  public acceptOption(request: RecoveryOutcomeTrackerAcceptRequest): RecoveryOutcomeTrackerRoomLedger {
    const room = this.ensureRoom(request.roomId);
    const now = request.now ?? unix(this.clock.now());
    const index = room.activeRecoveries.findIndex((entry) => String(entry.recoveryId) === String(request.recoveryId));
    if (index < 0) return freezeRoom(room);

    const current = room.activeRecoveries[index];
    const acceptedOptionId = request.acceptedOptionId ?? acceptedOptionIdFromBundle(current.plan.bundle);
    const next: ActiveRecoveryRecord = Object.freeze({
      ...current,
      acceptedOptionId,
      status: 'ACCEPTED',
      acceptedAt: now,
      updatedAt: now,
      notes: withNotes(current.notes, request.notes, [`accepted-option=${String(acceptedOptionId ?? 'none')}`]),
    });
    room.activeRecoveries[index] = next;
    this.trim(room);

    this.logger.debug('chat.recovery.backend.accept', {
      roomId: request.roomId as any,
      recoveryId: request.recoveryId as any,
      acceptedOptionId: acceptedOptionId as any,
    });

    return freezeRoom(room);
  }

  public resolve(request: RecoveryOutcomeTrackerResolutionRequest): RecoveryOutcomeTrackerRoomLedger {
    const room = this.ensureRoom(request.roomId);
    const now = request.now ?? unix(this.clock.now());
    const index = room.activeRecoveries.findIndex((entry) => String(entry.recoveryId) === String(request.recoveryId));
    if (index < 0) return freezeRoom(room);

    const current = room.activeRecoveries[index];
    const outcome = createRecoveryOutcome({
      recoveryId: request.recoveryId,
      acceptedOptionId: request.acceptedOptionId ?? current.acceptedOptionId ?? acceptedOptionIdFromBundle(current.plan.bundle),
      stabilityLift01: Number(request.stabilityLift01),
      embarrassmentReduction01: Number(request.embarrassmentReduction01),
      confidenceLift01: Number(request.confidenceLift01),
      trustLift01: Number(request.trustLift01),
      updatedAt: now,
      notes: request.notes,
    });

    const ageMs = Math.max(0, Number(now) - Number(current.createdAt));
    const reinforcementScore01 = deriveReinforcementScore({
      stabilityLift01: outcome.stabilityLift01,
      confidenceLift01: outcome.confidenceLift01,
      trustLift01: outcome.trustLift01,
      embarrassmentReduction01: outcome.embarrassmentReduction01,
      ageMs,
      halfLifeMs: this.reinforcementDecayHalfLifeMs,
    });
    const relapseRisk01 = deriveRelapseRisk({
      stabilityLift01: outcome.stabilityLift01,
      confidenceLift01: outcome.confidenceLift01,
      embarrassmentReduction01: outcome.embarrassmentReduction01,
      trustLift01: outcome.trustLift01,
      predictedOutcome: current.predictedOutcome,
    });
    const cohort = deriveCohortFromRecord({
      predictedOutcome: outcome,
      status: outcomeKindToStatus(outcome.kind),
      reinforcementScore01,
      relapseRisk01,
      trustLift01: outcome.trustLift01,
    });

    const ledgerEntry = toRecoveryLedgerEntry(current, outcome, now);
    const settled: SettledRecoveryRecord = Object.freeze({
      roomId: request.roomId,
      recoveryId: request.recoveryId,
      rescueId: current.rescueId ?? null,
      outcome,
      ledgerEntry,
      settledAt: now,
      reinforcementScore01,
      relapseRisk01,
      cohort,
      notes: withNotes(current.notes, request.notes, [`outcome=${outcome.kind}`, `successBand=${outcome.successBand}`]),
    });

    room.activeRecoveries.splice(index, 1);
    room.settledRecoveries.unshift(settled);
    room.recoveryLedger.unshift(ledgerEntry);
    this.trim(room);

    this.logger.info('chat.recovery.backend.resolve', {
      roomId: request.roomId as any,
      recoveryId: request.recoveryId as any,
      outcomeKind: outcome.kind,
      successBand: outcome.successBand,
      cohort,
    });

    return freezeRoom(room);
  }

  public timeout(request: RecoveryOutcomeTrackerTimeoutRequest): RecoveryOutcomeTrackerRoomLedger {
    const room = this.ensureRoom(request.roomId);
    const now = request.now ?? unix(this.clock.now());
    const index = room.activeRecoveries.findIndex((entry) => String(entry.recoveryId) === String(request.recoveryId));
    if (index < 0) return freezeRoom(room);

    const current = room.activeRecoveries[index];
    const outcome = createRecoveryOutcome({
      recoveryId: request.recoveryId,
      acceptedOptionId: current.acceptedOptionId ?? null,
      stabilityLift01: 0.02,
      embarrassmentReduction01: 0.01,
      confidenceLift01: 0.0,
      trustLift01: 0.0,
      updatedAt: now,
      notes: request.notes,
    });
    const ledgerEntry: ChatRecoveryLedgerEntry = {
      ...toRecoveryLedgerEntry(current, outcome, now),
      outcomeKind: 'FAILED',
      successBand: 'NO_LIFT',
      notes: withNotes(current.notes, request.notes, ['timeout']),
    };
    const settled: SettledRecoveryRecord = Object.freeze({
      roomId: request.roomId,
      recoveryId: request.recoveryId,
      rescueId: current.rescueId ?? null,
      outcome: { ...outcome, kind: 'FAILED', successBand: 'NO_LIFT' },
      ledgerEntry,
      settledAt: now,
      reinforcementScore01: score01(0),
      relapseRisk01: score01(1),
      cohort: 'VOLATILE',
      notes: withNotes(current.notes, request.notes, ['timed-out']),
    });

    room.activeRecoveries.splice(index, 1);
    room.settledRecoveries.unshift(settled);
    room.recoveryLedger.unshift(ledgerEntry);
    this.trim(room);

    this.logger.warn('chat.recovery.backend.timeout', {
      roomId: request.roomId as any,
      recoveryId: request.recoveryId as any,
    });

    return freezeRoom(room);
  }

  public abandon(request: RecoveryOutcomeTrackerAbandonRequest): RecoveryOutcomeTrackerRoomLedger {
    const room = this.ensureRoom(request.roomId);
    const now = request.now ?? unix(this.clock.now());
    const index = room.activeRecoveries.findIndex((entry) => String(entry.recoveryId) === String(request.recoveryId));
    if (index < 0) return freezeRoom(room);

    const current = room.activeRecoveries[index];
    const outcome = createRecoveryOutcome({
      recoveryId: request.recoveryId,
      acceptedOptionId: current.acceptedOptionId ?? null,
      stabilityLift01: 0.0,
      embarrassmentReduction01: 0.0,
      confidenceLift01: 0.0,
      trustLift01: 0.0,
      updatedAt: now,
      notes: request.notes,
    });
    const ledgerEntry: ChatRecoveryLedgerEntry = {
      ...toRecoveryLedgerEntry(current, outcome, now),
      outcomeKind: 'ABANDONED',
      successBand: 'NO_LIFT',
      notes: withNotes(current.notes, request.notes, ['abandoned']),
    };
    const settled: SettledRecoveryRecord = Object.freeze({
      roomId: request.roomId,
      recoveryId: request.recoveryId,
      rescueId: current.rescueId ?? null,
      outcome: { ...outcome, kind: 'ABANDONED', successBand: 'NO_LIFT' },
      ledgerEntry,
      settledAt: now,
      reinforcementScore01: score01(0),
      relapseRisk01: score01(1),
      cohort: 'VOLATILE',
      notes: withNotes(current.notes, request.notes, ['abandoned']),
    });

    room.activeRecoveries.splice(index, 1);
    room.settledRecoveries.unshift(settled);
    room.recoveryLedger.unshift(ledgerEntry);
    this.trim(room);

    this.logger.warn('chat.recovery.backend.abandon', {
      roomId: request.roomId as any,
      recoveryId: request.recoveryId as any,
    });

    return freezeRoom(room);
  }

  public relapse(request: RecoveryOutcomeTrackerRelapseRequest): RecoveryOutcomeTrackerRoomLedger {
    const room = this.ensureRoom(request.roomId);
    const now = request.now ?? unix(this.clock.now());
    const settledIndex = room.settledRecoveries.findIndex((entry) => String(entry.recoveryId) === String(request.recoveryId));
    if (settledIndex < 0) return freezeRoom(room);

    const current = room.settledRecoveries[settledIndex];
    if (Number(now) - Number(current.settledAt) > this.relapseWindowMs) return freezeRoom(room);

    const reducedReinforcement = score01(Math.max(0, Number(current.reinforcementScore01) - Number(request.relapseSeverity01) * 0.62));
    const elevatedRisk = score01(Math.min(1, Number(current.relapseRisk01) + Number(request.relapseSeverity01) * 0.72));
    const relapsed: SettledRecoveryRecord = Object.freeze({
      ...current,
      settledAt: now,
      reinforcementScore01: reducedReinforcement,
      relapseRisk01: elevatedRisk,
      cohort: 'VOLATILE',
      notes: withNotes(current.notes, request.notes, ['relapsed']),
    });

    room.settledRecoveries[settledIndex] = relapsed;
    this.trim(room);

    this.logger.warn('chat.recovery.backend.relapse', {
      roomId: request.roomId as any,
      recoveryId: request.recoveryId as any,
      relapseSeverity01: request.relapseSeverity01 as any,
    });

    return freezeRoom(room);
  }

  public getRoomLedger(roomId: ChatRoomId): RecoveryOutcomeTrackerRoomLedger {
    return freezeRoom(this.ensureRoom(roomId));
  }

  public summarizeRoom(roomId: ChatRoomId): string {
    const summary = this.buildSummary(roomId);
    return [
      `active=${summary.activeCount}`,
      `settled=${summary.settledCount}`,
      `recovered=${summary.recoveredCount}`,
      `stabilized=${summary.stabilizedCount}`,
      `band=${summary.strongestSuccessBand ?? 'NONE'}`,
      `risk=${Number(summary.averageRelapseRisk01).toFixed(2)}`,
    ].join(' | ');
  }

  public project(roomId: ChatRoomId): RecoveryOutcomeTrackerProjection {
    const room = this.ensureRoom(roomId);
    const active = room.activeRecoveries[0] ?? null;
    const strongest = room.settledRecoveries[0]?.outcome ?? active?.predictedOutcome ?? null;
    const reinforcementScore01 = active?.reinforcementScore01 ?? room.settledRecoveries[0]?.reinforcementScore01 ?? score01(0);
    const relapseRisk01 = active?.relapseRisk01 ?? room.settledRecoveries[0]?.relapseRisk01 ?? score01(0);
    const cohort = active?.cohort ?? room.settledRecoveries[0]?.cohort ?? 'UNKNOWN';
    return Object.freeze({
      roomId,
      strongestSuccessBand: strongest?.successBand ?? null,
      strongestOutcomeKind: strongest?.kind ?? null,
      activeRecoveryId: active?.recoveryId ?? null,
      acceptedOptionId: active?.acceptedOptionId ?? null,
      reinforcementScore01,
      relapseRisk01,
      cohort,
      notes: active?.notes ?? room.settledRecoveries[0]?.notes ?? [],
    });
  }

  public buildSummary(roomId: ChatRoomId): RecoveryOutcomeTrackerSummary {
    const room = this.ensureRoom(roomId);
    const recoveredCount = room.recoveryLedger.filter((value) => value.outcomeKind === 'RECOVERED').length;
    const stabilizedCount = room.recoveryLedger.filter((value) => value.outcomeKind === 'STABILIZED').length;
    const partialCount = room.recoveryLedger.filter((value) => value.outcomeKind === 'PARTIAL').length;
    const failedCount = room.recoveryLedger.filter((value) => value.outcomeKind === 'FAILED').length;
    const abandonedCount = room.recoveryLedger.filter((value) => value.outcomeKind === 'ABANDONED').length;
    const timedOutCount = room.settledRecoveries.filter((value) => value.notes.includes('timed-out')).length;
    const strongestSuccessBand = deriveRecoveryDigest(room.recoveryLedger, unix(this.clock.now())).strongestSuccessBand ?? null;
    const strongestOutcomeKind = deriveRecoveryDigest(room.recoveryLedger, unix(this.clock.now())).strongestOutcomeKind ?? null;
    const averageReinforcement01 = room.settledRecoveries.length
      ? score01(room.settledRecoveries.reduce((sum, value) => sum + Number(value.reinforcementScore01), 0) / room.settledRecoveries.length)
      : score01(0);
    const averageRelapseRisk01 = room.settledRecoveries.length
      ? score01(room.settledRecoveries.reduce((sum, value) => sum + Number(value.relapseRisk01), 0) / room.settledRecoveries.length)
      : score01(0);

    return Object.freeze({
      roomId,
      activeCount: room.activeRecoveries.length,
      settledCount: room.settledRecoveries.length,
      recoveredCount,
      stabilizedCount,
      partialCount,
      failedCount,
      abandonedCount,
      timedOutCount,
      strongestSuccessBand,
      strongestOutcomeKind,
      averageReinforcement01,
      averageRelapseRisk01,
    });
  }

  private ensureRoom(roomId: ChatRoomId): MutableRoomState {
    const key = String(roomId);
    let room = this.rooms.get(key);
    if (!room) {
      room = {
        roomId,
        activeRecoveries: [],
        settledRecoveries: [],
        recoveryLedger: [],
        rescuePlans: [],
      };
      this.rooms.set(key, room);
    }
    return room;
  }

  private trim(room: MutableRoomState): void {
    room.activeRecoveries = room.activeRecoveries.slice(0, this.retainActiveRecordsPerRoom);
    room.settledRecoveries = room.settledRecoveries.slice(0, this.retainLedgerEntriesPerRoom);
    room.recoveryLedger = room.recoveryLedger.slice(0, this.retainLedgerEntriesPerRoom);
    room.rescuePlans = room.rescuePlans.slice(0, this.retainLedgerEntriesPerRoom);
  }
}

export function createRecoveryOutcomeTracker(options: RecoveryOutcomeTrackerOptions = {}): RecoveryOutcomeTracker {
  return new RecoveryOutcomeTracker(options);
}

// ============================================================================
// MARK: Analytics helpers
// ============================================================================

export interface RecoveryOutcomeReplaySlice {
  readonly roomId: ChatRoomId;
  readonly recoveryId: ChatRecoveryId;
  readonly rescueId?: ChatRescueId | null;
  readonly outcomeKind: ChatRecoveryOutcomeKind;
  readonly successBand: ChatRecoverySuccessBand;
  readonly settledAt: UnixMs;
  readonly acceptedOptionId?: ChatRecoveryOptionId | null;
  readonly reinforcementScore01: Score01;
  readonly relapseRisk01: Score01;
  readonly cohort: RecoveryOutcomeTrackerCohort;
  readonly notes: readonly string[];
}

export interface RecoveryOutcomeQuery {
  readonly roomId: ChatRoomId;
  readonly outcomeKind?: ChatRecoveryOutcomeKind | null;
  readonly successBand?: ChatRecoverySuccessBand | null;
  readonly cohort?: RecoveryOutcomeTrackerCohort | null;
  readonly minReinforcement01?: Score01 | null;
  readonly maxRelapseRisk01?: Score01 | null;
  readonly limit?: number | null;
}

export function settledToReplaySlice(settled: SettledRecoveryRecord): RecoveryOutcomeReplaySlice {
  return Object.freeze({
    roomId: settled.roomId,
    recoveryId: settled.recoveryId,
    rescueId: settled.rescueId ?? null,
    outcomeKind: settled.outcome.kind,
    successBand: settled.outcome.successBand,
    settledAt: settled.settledAt,
    acceptedOptionId: settled.outcome.acceptedOptionId ?? null,
    reinforcementScore01: settled.reinforcementScore01,
    relapseRisk01: settled.relapseRisk01,
    cohort: settled.cohort,
    notes: settled.notes,
  });
}

export function filterRecoveryReplaySlices(
  entries: readonly SettledRecoveryRecord[],
  query: RecoveryOutcomeQuery,
): readonly RecoveryOutcomeReplaySlice[] {
  const limit = Math.max(1, Number(query.limit ?? 50));
  return Object.freeze(
    entries
      .map(settledToReplaySlice)
      .filter((value) => {
        if (query.outcomeKind && value.outcomeKind !== query.outcomeKind) return false;
        if (query.successBand && value.successBand !== query.successBand) return false;
        if (query.cohort && value.cohort !== query.cohort) return false;
        if (query.minReinforcement01 !== null && query.minReinforcement01 !== undefined && Number(value.reinforcementScore01) < Number(query.minReinforcement01)) return false;
        if (query.maxRelapseRisk01 !== null && query.maxRelapseRisk01 !== undefined && Number(value.relapseRisk01) > Number(query.maxRelapseRisk01)) return false;
        return true;
      })
      .slice(0, limit),
  );
}

export class RecoveryOutcomeAnalytics {
  public projection(tracker: RecoveryOutcomeTracker, roomId: ChatRoomId): RecoveryOutcomeTrackerProjection {
    return tracker.project(roomId);
  }

  public summary(tracker: RecoveryOutcomeTracker, roomId: ChatRoomId): RecoveryOutcomeTrackerSummary {
    return tracker.buildSummary(roomId);
  }

  public replay(tracker: RecoveryOutcomeTracker, query: RecoveryOutcomeQuery): readonly RecoveryOutcomeReplaySlice[] {
    return filterRecoveryReplaySlices(tracker.getRoomLedger(query.roomId).settledRecoveries, query);
  }

  public narrative(tracker: RecoveryOutcomeTracker, roomId: ChatRoomId): string {
    const summary = tracker.buildSummary(roomId);
    return [
      `active=${summary.activeCount}`,
      `settled=${summary.settledCount}`,
      `recovered=${summary.recoveredCount}`,
      `stabilized=${summary.stabilizedCount}`,
      `partial=${summary.partialCount}`,
      `failed=${summary.failedCount}`,
      `band=${summary.strongestSuccessBand ?? 'NONE'}`,
    ].join(' | ');
  }
}

export function createRecoveryOutcomeAnalytics(): RecoveryOutcomeAnalytics {
  return new RecoveryOutcomeAnalytics();
}

// ============================================================================
// MARK: Reinforcement / cohort notes
// ============================================================================

export const RECOVERY_OUTCOME_TRACKER_NOTES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  BEGIN: Object.freeze([
    'Recovery tracking begins when a recovery plan exists, not only when it resolves.',
    'Predicted outcome may be revised by later backend truth.',
  ]),
  ACCEPT: Object.freeze([
    'Accepted option does not guarantee stabilization.',
    'Acceptance matters because later reinforcement analysis needs intent as well as result.',
  ]),
  RESOLVE: Object.freeze([
    'Resolution records lift, not just binary success.',
    'Strong lift may still carry relapse risk if trust remains weak.',
  ]),
  TIMEOUT: Object.freeze([
    'Timeout is backend truth, not a UI guess.',
    'Timeout may still be followed by another rescue or recovery lane.',
  ]),
  ABANDON: Object.freeze([
    'Abandonment must remain explicit in replay and analytics.',
    'Do not reinterpret abandonment as silent success.',
  ]),
  RELAPSE: Object.freeze([
    'Relapse exists to preserve emotional truth after initial stabilization.',
    'A saved run can still degrade if the player re-enters pressure too fast.',
  ]),
});

export const RECOVERY_OUTCOME_TRACKER_COHORT_GUIDE: Readonly<Record<RecoveryOutcomeTrackerCohort, readonly string[]>> = Object.freeze({
  UNKNOWN: Object.freeze([
    'Signals are not yet strong enough to classify the room.',
  ]),
  SAVEABLE: Object.freeze([
    'Player is still in danger but responds to intervention.',
  ]),
  FRAGILE: Object.freeze([
    'Stability exists, but humiliation or pressure can still shatter it.',
  ]),
  STABLE: Object.freeze([
    'Recovery reinforcement currently outweighs relapse risk.',
  ]),
  VOLATILE: Object.freeze([
    'Recent outcomes suggest failure, timeout, abandonment, or relapse danger.',
  ]),
  COMEBACK_READY: Object.freeze([
    'Player can be escalated back into authored pressure without immediate rescue.',
  ]),
  HELPER_RELIANT: Object.freeze([
    'Stability is real but still depends on helper reinforcement.',
  ]),
});

// ============================================================================
// MARK: Batch ingestion helpers
// ============================================================================

export interface RecoveryOutcomeIngestRecord {
  readonly roomId: ChatRoomId;
  readonly rescuePlan?: ChatRescuePlan | null;
  readonly recoveryPlan: ChatRecoveryPlan;
  readonly predictedOutcome?: ChatRecoveryOutcome | null;
  readonly acceptedOptionId?: ChatRecoveryOptionId | null;
  readonly resolvedOutcome?: ChatRecoveryOutcome | null;
  readonly notes?: readonly string[];
}

export function ingestRecoveryOutcomeRecords(
  tracker: RecoveryOutcomeTracker,
  records: readonly RecoveryOutcomeIngestRecord[],
): readonly RecoveryOutcomeTrackerRoomLedger[] {
  const ledgers: RecoveryOutcomeTrackerRoomLedger[] = [];
  for (const record of records) {
    tracker.begin({
      roomId: record.roomId,
      rescuePlan: record.rescuePlan,
      recoveryPlan: record.recoveryPlan,
      predictedOutcome: record.predictedOutcome ?? null,
      notes: record.notes,
    });
    if (record.acceptedOptionId) {
      tracker.acceptOption({
        roomId: record.roomId,
        recoveryId: record.recoveryPlan.recoveryId,
        acceptedOptionId: record.acceptedOptionId,
        notes: record.notes,
      });
    }
    if (record.resolvedOutcome) {
      tracker.resolve({
        roomId: record.roomId,
        recoveryId: record.recoveryPlan.recoveryId,
        acceptedOptionId: record.resolvedOutcome.acceptedOptionId ?? null,
        stabilityLift01: record.resolvedOutcome.stabilityLift01,
        embarrassmentReduction01: record.resolvedOutcome.embarrassmentReduction01,
        confidenceLift01: record.resolvedOutcome.confidenceLift01,
        trustLift01: record.resolvedOutcome.trustLift01,
        notes: record.notes,
      });
    }
    ledgers.push(tracker.getRoomLedger(record.roomId));
  }
  return Object.freeze(ledgers);
}

// ============================================================================
// MARK: Static projections for tests / reporting / policy wiring
// ============================================================================

export function projectRecoveryTrackerHealth(
  tracker: RecoveryOutcomeTracker,
  roomId: ChatRoomId,
): Score01 {
  const projection = tracker.project(roomId);
  return score01(Number(projection.reinforcementScore01) * (1 - Number(projection.relapseRisk01)));
}

export function recoveryTrackerWouldPermitEscalation(
  tracker: RecoveryOutcomeTracker,
  roomId: ChatRoomId,
): boolean {
  const projection = tracker.project(roomId);
  return Number(projection.reinforcementScore01) >= 0.52 && Number(projection.relapseRisk01) <= 0.34;
}

export function recoveryTrackerNeedsHelperCover(
  tracker: RecoveryOutcomeTracker,
  roomId: ChatRoomId,
): boolean {
  const projection = tracker.project(roomId);
  return projection.cohort === 'HELPER_RELIANT' || projection.cohort === 'FRAGILE';
}
