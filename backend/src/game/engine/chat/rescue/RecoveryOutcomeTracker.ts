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
      (room.rescuePlans.map((plan, index) => ({
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
      })) as any),
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

    const ledgerEntry = { ...toRecoveryLedgerEntry(current, outcome, now), notes: withNotes(current.notes, request.notes) };
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
      outcome: { ...outcome, kind: 'FAILED' as const, successBand: 'NO_LIFT' as const },
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
      outcome: { ...outcome, kind: 'ABANDONED' as const, successBand: 'NO_LIFT' as const },
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

// ============================================================================
// MARK: Profile system
// ============================================================================

export type RecoveryOutcomeTrackerProfile =
  | 'STANDARD'
  | 'CINEMATIC'
  | 'AGGRESSIVE'
  | 'PATIENT'
  | 'ANALYTICS'
  | 'MINIMAL';

export interface RecoveryOutcomeTrackerProfileConfig {
  readonly profile: RecoveryOutcomeTrackerProfile;
  readonly options: Partial<RecoveryOutcomeTrackerOptions>;
  readonly description: string;
  readonly useCases: readonly string[];
}

export const RECOVERY_OUTCOME_TRACKER_PROFILE_CONFIGS: Readonly<Record<RecoveryOutcomeTrackerProfile, RecoveryOutcomeTrackerProfileConfig>> = Object.freeze({
  STANDARD: Object.freeze({
    profile: 'STANDARD',
    options: {},
    description: 'Default tracking behavior for standard game rooms.',
    useCases: Object.freeze(['General narrative rooms', 'Default session tracking']),
  }),
  CINEMATIC: Object.freeze({
    profile: 'CINEMATIC',
    options: Object.freeze({
      retainLedgerEntriesPerRoom: 72,
      retainActiveRecordsPerRoom: 8,
      relapseWindowMs: 45_000,
      reinforcementDecayHalfLifeMs: 240_000,
    }),
    description: 'Extended retention and slow decay for cinematic story beats.',
    useCases: Object.freeze(['Legend runs', 'Authored narrative chambers', 'Boss fight sequences']),
  }),
  AGGRESSIVE: Object.freeze({
    profile: 'AGGRESSIVE',
    options: Object.freeze({
      retainLedgerEntriesPerRoom: 36,
      retainActiveRecordsPerRoom: 6,
      relapseWindowMs: 8_000,
      reinforcementDecayHalfLifeMs: 45_000,
    }),
    description: 'Short windows and fast decay for high-churn rooms.',
    useCases: Object.freeze(['Hater-heavy syndicate rooms', 'Rapid escalation sequences']),
  }),
  PATIENT: Object.freeze({
    profile: 'PATIENT',
    options: Object.freeze({
      retainLedgerEntriesPerRoom: 48,
      retainActiveRecordsPerRoom: 6,
      relapseWindowMs: 60_000,
      reinforcementDecayHalfLifeMs: 360_000,
    }),
    description: 'Extended relapse window and slow decay for helper-focused rooms.',
    useCases: Object.freeze(['Onboarding rooms', 'Helper-assigned sessions', 'Low-pressure contexts']),
  }),
  ANALYTICS: Object.freeze({
    profile: 'ANALYTICS',
    options: Object.freeze({
      retainLedgerEntriesPerRoom: 200,
      retainActiveRecordsPerRoom: 12,
      relapseWindowMs: 90_000,
      reinforcementDecayHalfLifeMs: 600_000,
    }),
    description: 'Maximum retention for analytics, audit, and replay review.',
    useCases: Object.freeze(['Offline analytics pipelines', 'QA and replay review sessions']),
  }),
  MINIMAL: Object.freeze({
    profile: 'MINIMAL',
    options: Object.freeze({
      retainLedgerEntriesPerRoom: 24,
      retainActiveRecordsPerRoom: 4,
      relapseWindowMs: 5_000,
      reinforcementDecayHalfLifeMs: 30_000,
    }),
    description: 'Minimum retention footprint for lightweight runtime contexts.',
    useCases: Object.freeze(['Edge contexts', 'Memory-constrained environments']),
  }),
});

// ============================================================================
// MARK: Extended audit and diagnostic contracts
// ============================================================================

export interface RecoveryOutcomeTrackerAuditEntry {
  readonly roomId: string;
  readonly recoveryId: string;
  readonly rescueId: string | null;
  readonly eventKind: 'BEGIN' | 'ACCEPT' | 'RESOLVE' | 'TIMEOUT' | 'ABANDON' | 'RELAPSE';
  readonly recordedAt: UnixMs;
  readonly outcomeKind: ChatRecoveryOutcomeKind | null;
  readonly successBand: ChatRecoverySuccessBand | null;
  readonly cohort: RecoveryOutcomeTrackerCohort;
  readonly reinforcementScore01: Score01;
  readonly relapseRisk01: Score01;
  readonly notes: readonly string[];
}

export interface RecoveryOutcomeTrackerAuditReport {
  readonly generatedAt: UnixMs;
  readonly roomCount: number;
  readonly totalEntries: number;
  readonly beginCount: number;
  readonly resolveCount: number;
  readonly timeoutCount: number;
  readonly abandonCount: number;
  readonly relapseCount: number;
  readonly cohortBreakdown: Readonly<Record<RecoveryOutcomeTrackerCohort, number>>;
  readonly successBandBreakdown: Readonly<Record<ChatRecoverySuccessBand, number>>;
  readonly averageReinforcement01: Score01;
  readonly averageRelapseRisk01: Score01;
  readonly entries: readonly RecoveryOutcomeTrackerAuditEntry[];
}

export interface RecoveryOutcomeTrackerDiff {
  readonly roomId: string;
  readonly before: RecoveryOutcomeTrackerSummary;
  readonly after: RecoveryOutcomeTrackerSummary;
  readonly activeCountDelta: number;
  readonly settledCountDelta: number;
  readonly recoveredCountDelta: number;
  readonly reinforcementDelta: number;
  readonly relapseRiskDelta: number;
  readonly notes: readonly string[];
}

export interface RecoveryOutcomeTrackerStatsSummary {
  readonly snapshotAt: UnixMs;
  readonly rooms: readonly string[];
  readonly totalActiveRecoveries: number;
  readonly totalSettledRecoveries: number;
  readonly globalAverageReinforcement01: Score01;
  readonly globalAverageRelapseRisk01: Score01;
  readonly cohortBreakdown: Readonly<Record<RecoveryOutcomeTrackerCohort, number>>;
  readonly successBandBreakdown: Readonly<Record<ChatRecoverySuccessBand, number>>;
  readonly highRiskRooms: readonly string[];
  readonly stableRooms: readonly string[];
}

export interface RecoveryOutcomeBatchIngestResult {
  readonly processed: number;
  readonly errors: number;
  readonly ledgers: readonly RecoveryOutcomeTrackerRoomLedger[];
  readonly errorMessages: readonly string[];
}

// ============================================================================
// MARK: Cross-room analytics
// ============================================================================

export function buildCrossRoomTrackerStats(
  tracker: RecoveryOutcomeTracker,
  roomIds: readonly ChatRoomId[],
  now: UnixMs,
): RecoveryOutcomeTrackerStatsSummary {
  const cohortBreakdown: Record<RecoveryOutcomeTrackerCohort, number> = {
    UNKNOWN: 0, SAVEABLE: 0, FRAGILE: 0, STABLE: 0,
    VOLATILE: 0, COMEBACK_READY: 0, HELPER_RELIANT: 0,
  };
  const successBandBreakdown: Record<ChatRecoverySuccessBand, number> = {
    NO_LIFT: 0, SMALL_LIFT: 0, CLEAR_LIFT: 0, STRONG_LIFT: 0, RUN_SAVED: 0,
  };
  let totalActive = 0;
  let totalSettled = 0;
  let totalReinforcement = 0;
  let totalRelapseRisk = 0;
  let reinforcementCount = 0;
  const highRiskRooms: string[] = [];
  const stableRooms: string[] = [];

  for (const roomId of roomIds) {
    const summary = tracker.buildSummary(roomId);
    const ledger = tracker.getRoomLedger(roomId);
    totalActive += summary.activeCount;
    totalSettled += summary.settledCount;

    const projection = tracker.project(roomId);
    const cohort = projection.cohort as RecoveryOutcomeTrackerCohort;
    cohortBreakdown[cohort] = (cohortBreakdown[cohort] ?? 0) + 1;

    if (Number(summary.averageRelapseRisk01) > 0.58) highRiskRooms.push(String(roomId));
    if (projection.cohort === 'STABLE' || projection.cohort === 'COMEBACK_READY') stableRooms.push(String(roomId));

    for (const settled of ledger.settledRecoveries) {
      const band = settled.outcome.successBand;
      successBandBreakdown[band] = (successBandBreakdown[band] ?? 0) + 1;
      totalReinforcement += Number(settled.reinforcementScore01);
      totalRelapseRisk += Number(settled.relapseRisk01);
      reinforcementCount++;
    }
  }

  return Object.freeze({
    snapshotAt: now,
    rooms: Object.freeze(roomIds.map(String)),
    totalActiveRecoveries: totalActive,
    totalSettledRecoveries: totalSettled,
    globalAverageReinforcement01: (reinforcementCount > 0 ? totalReinforcement / reinforcementCount : 0) as Score01,
    globalAverageRelapseRisk01: (reinforcementCount > 0 ? totalRelapseRisk / reinforcementCount : 0) as Score01,
    cohortBreakdown: Object.freeze(cohortBreakdown),
    successBandBreakdown: Object.freeze(successBandBreakdown),
    highRiskRooms: Object.freeze(highRiskRooms),
    stableRooms: Object.freeze(stableRooms),
  });
}

export function buildGlobalCohortMap(
  tracker: RecoveryOutcomeTracker,
  roomIds: readonly ChatRoomId[],
): Readonly<Record<string, RecoveryOutcomeTrackerCohort>> {
  const map: Record<string, RecoveryOutcomeTrackerCohort> = {};
  for (const roomId of roomIds) {
    const projection = tracker.project(roomId);
    map[String(roomId)] = projection.cohort as RecoveryOutcomeTrackerCohort;
  }
  return Object.freeze(map);
}

export function buildTrackerAuditReport(
  tracker: RecoveryOutcomeTracker,
  roomIds: readonly ChatRoomId[],
  now: UnixMs,
): RecoveryOutcomeTrackerAuditReport {
  const cohortBreakdown: Record<RecoveryOutcomeTrackerCohort, number> = {
    UNKNOWN: 0, SAVEABLE: 0, FRAGILE: 0, STABLE: 0,
    VOLATILE: 0, COMEBACK_READY: 0, HELPER_RELIANT: 0,
  };
  const successBandBreakdown: Record<ChatRecoverySuccessBand, number> = {
    NO_LIFT: 0, SMALL_LIFT: 0, CLEAR_LIFT: 0, STRONG_LIFT: 0, RUN_SAVED: 0,
  };
  const entries: RecoveryOutcomeTrackerAuditEntry[] = [];
  let totalReinforcement = 0;
  let totalRelapseRisk = 0;
  let entryCount = 0;
  let beginCount = 0;
  let resolveCount = 0;
  let timeoutCount = 0;
  let abandonCount = 0;
  let relapseCount = 0;

  for (const roomId of roomIds) {
    const ledger = tracker.getRoomLedger(roomId);

    for (const active of ledger.activeRecoveries) {
      beginCount++;
      const cohort = active.cohort as RecoveryOutcomeTrackerCohort;
      cohortBreakdown[cohort] = (cohortBreakdown[cohort] ?? 0) + 1;
      entries.push(Object.freeze({
        roomId: String(roomId),
        recoveryId: String(active.recoveryId),
        rescueId: active.rescueId ? String(active.rescueId) : null,
        eventKind: 'BEGIN',
        recordedAt: active.createdAt,
        outcomeKind: null,
        successBand: null,
        cohort,
        reinforcementScore01: active.reinforcementScore01,
        relapseRisk01: active.relapseRisk01,
        notes: active.notes,
      }));
    }

    for (const settled of ledger.settledRecoveries) {
      const band = settled.outcome.successBand;
      successBandBreakdown[band] = (successBandBreakdown[band] ?? 0) + 1;
      const cohort = settled.cohort as RecoveryOutcomeTrackerCohort;
      cohortBreakdown[cohort] = (cohortBreakdown[cohort] ?? 0) + 1;
      totalReinforcement += Number(settled.reinforcementScore01);
      totalRelapseRisk += Number(settled.relapseRisk01);
      entryCount++;

      const isTimeout = settled.notes.includes('timed-out');
      const isAbandon = settled.notes.includes('abandoned');
      const isRelapse = settled.notes.includes('relapsed');
      if (isRelapse) relapseCount++;
      else if (isTimeout) timeoutCount++;
      else if (isAbandon) abandonCount++;
      else resolveCount++;

      const eventKind: RecoveryOutcomeTrackerAuditEntry['eventKind'] = isRelapse ? 'RELAPSE'
        : isTimeout ? 'TIMEOUT'
        : isAbandon ? 'ABANDON'
        : 'RESOLVE';

      entries.push(Object.freeze({
        roomId: String(roomId),
        recoveryId: String(settled.recoveryId),
        rescueId: settled.rescueId ? String(settled.rescueId) : null,
        eventKind,
        recordedAt: settled.settledAt,
        outcomeKind: settled.outcome.kind,
        successBand: band,
        cohort,
        reinforcementScore01: settled.reinforcementScore01,
        relapseRisk01: settled.relapseRisk01,
        notes: settled.notes,
      }));
    }
  }

  return Object.freeze({
    generatedAt: now,
    roomCount: roomIds.length,
    totalEntries: entries.length,
    beginCount,
    resolveCount,
    timeoutCount,
    abandonCount,
    relapseCount,
    cohortBreakdown: Object.freeze(cohortBreakdown),
    successBandBreakdown: Object.freeze(successBandBreakdown),
    averageReinforcement01: (entryCount > 0 ? totalReinforcement / entryCount : 0) as Score01,
    averageRelapseRisk01: (entryCount > 0 ? totalRelapseRisk / entryCount : 0) as Score01,
    entries: Object.freeze(entries),
  });
}

export function computeTrackerDiff(
  tracker: RecoveryOutcomeTracker,
  roomId: ChatRoomId,
  before: RecoveryOutcomeTrackerSummary,
  now: UnixMs,
): RecoveryOutcomeTrackerDiff {
  const after = tracker.buildSummary(roomId);
  const notes: string[] = [];
  if (after.recoveredCount > before.recoveredCount) {
    notes.push(`+${after.recoveredCount - before.recoveredCount} recovered`);
  }
  if (after.settledCount > before.settledCount) {
    notes.push(`+${after.settledCount - before.settledCount} settled`);
  }
  return Object.freeze({
    roomId: String(roomId),
    before,
    after,
    activeCountDelta: after.activeCount - before.activeCount,
    settledCountDelta: after.settledCount - before.settledCount,
    recoveredCountDelta: after.recoveredCount - before.recoveredCount,
    reinforcementDelta: Number(after.averageReinforcement01) - Number(before.averageReinforcement01),
    relapseRiskDelta: Number(after.averageRelapseRisk01) - Number(before.averageRelapseRisk01),
    notes: Object.freeze(notes),
  });
}

// ============================================================================
// MARK: Batch ingest with result tracking
// ============================================================================

export function batchIngestRecoveryOutcomeRecords(
  tracker: RecoveryOutcomeTracker,
  records: readonly RecoveryOutcomeIngestRecord[],
): RecoveryOutcomeBatchIngestResult {
  const ledgers: RecoveryOutcomeTrackerRoomLedger[] = [];
  const errorMessages: string[] = [];
  let errors = 0;

  for (const record of records) {
    try {
      const result = ingestRecoveryOutcomeRecords(tracker, [record]);
      ledgers.push(...result);
    } catch (err) {
      errors++;
      errorMessages.push(err instanceof Error ? err.message : String(err));
    }
  }

  return Object.freeze({
    processed: records.length - errors,
    errors,
    ledgers: Object.freeze(ledgers),
    errorMessages: Object.freeze(errorMessages),
  });
}

// ============================================================================
// MARK: Reinforcement and relapse scoring helpers
// ============================================================================

export function scoreRecoveryHealth(ledger: RecoveryOutcomeTrackerRoomLedger): Score01 {
  const settled = ledger.settledRecoveries;
  if (settled.length === 0) return 0 as Score01;
  const avgReinforcement = settled.reduce((s, r) => s + Number(r.reinforcementScore01), 0) / settled.length;
  const avgRelapseRisk = settled.reduce((s, r) => s + Number(r.relapseRisk01), 0) / settled.length;
  return Math.max(0, Math.min(1, avgReinforcement * (1 - avgRelapseRisk * 0.5))) as Score01;
}

export function labelCohortStrength(cohort: RecoveryOutcomeTrackerCohort): 'STRONG' | 'MODERATE' | 'WEAK' | 'UNKNOWN' {
  switch (cohort) {
    case 'STABLE': return 'STRONG';
    case 'COMEBACK_READY': return 'STRONG';
    case 'SAVEABLE': return 'MODERATE';
    case 'HELPER_RELIANT': return 'MODERATE';
    case 'FRAGILE': return 'WEAK';
    case 'VOLATILE': return 'WEAK';
    case 'UNKNOWN': return 'UNKNOWN';
  }
}

export function cohortNeedsMonitoring(cohort: RecoveryOutcomeTrackerCohort): boolean {
  return cohort === 'VOLATILE' || cohort === 'FRAGILE' || cohort === 'HELPER_RELIANT';
}

export function projectCohortTrend(
  tracker: RecoveryOutcomeTracker,
  roomId: ChatRoomId,
): 'IMPROVING' | 'STABLE' | 'DETERIORATING' | 'UNKNOWN' {
  const summary = tracker.buildSummary(roomId);
  if (summary.settledCount < 2) return 'UNKNOWN';
  const recoveredRate = summary.recoveredCount / Math.max(1, summary.settledCount);
  const failureRate = (summary.failedCount + summary.timedOutCount + summary.abandonedCount) / Math.max(1, summary.settledCount);
  if (recoveredRate >= 0.50 && failureRate <= 0.20) return 'IMPROVING';
  if (failureRate >= 0.55 || summary.timedOutCount >= 3) return 'DETERIORATING';
  return 'STABLE';
}

export function buildTrackerNarrativeSummary(
  tracker: RecoveryOutcomeTracker,
  roomId: ChatRoomId,
): string {
  const summary = tracker.buildSummary(roomId);
  const projection = tracker.project(roomId);
  const trend = projectCohortTrend(tracker, roomId);
  return [
    `cohort=${projection.cohort}`,
    `trend=${trend}`,
    `active=${summary.activeCount}`,
    `settled=${summary.settledCount}`,
    `recovered=${summary.recoveredCount}`,
    `failed=${summary.failedCount}`,
    `reinforcement=${Number(summary.averageReinforcement01).toFixed(2)}`,
    `relapseRisk=${Number(summary.averageRelapseRisk01).toFixed(2)}`,
    `band=${summary.strongestSuccessBand ?? 'NONE'}`,
  ].join(' | ');
}

// ============================================================================
// MARK: Serialization helpers
// ============================================================================

export function serializeTrackerProjection(projection: RecoveryOutcomeTrackerProjection): Readonly<Record<string, unknown>> {
  return Object.freeze({
    roomId: String(projection.roomId),
    cohort: projection.cohort,
    activeRecoveryId: projection.activeRecoveryId ? String(projection.activeRecoveryId) : null,
    acceptedOptionId: projection.acceptedOptionId ? String(projection.acceptedOptionId) : null,
    reinforcementScore01: Number(projection.reinforcementScore01).toFixed(3),
    relapseRisk01: Number(projection.relapseRisk01).toFixed(3),
    strongestSuccessBand: projection.strongestSuccessBand ?? null,
    strongestOutcomeKind: projection.strongestOutcomeKind ?? null,
    noteCount: projection.notes.length,
    firstNote: projection.notes[0] ?? null,
  });
}

export function buildSettledSliceSummary(settled: readonly SettledRecoveryRecord[]): string {
  if (settled.length === 0) return 'no-settled-records';
  const recovered = settled.filter((s) => s.outcome.kind === 'RECOVERED').length;
  const stabilized = settled.filter((s) => s.outcome.kind === 'STABILIZED').length;
  const failed = settled.filter((s) => s.outcome.kind === 'FAILED').length;
  const abandoned = settled.filter((s) => s.outcome.kind === 'ABANDONED').length;
  return `total=${settled.length} recovered=${recovered} stabilized=${stabilized} failed=${failed} abandoned=${abandoned}`;
}

// ============================================================================
// MARK: Profile-aware extended factory
// ============================================================================

export interface RecoveryOutcomeTrackerExtended {
  readonly tracker: RecoveryOutcomeTracker;
  readonly profile: RecoveryOutcomeTrackerProfile;
  begin(request: RecoveryOutcomeTrackerBeginRequest): RecoveryOutcomeTrackerRoomLedger;
  acceptOption(request: RecoveryOutcomeTrackerAcceptRequest): RecoveryOutcomeTrackerRoomLedger;
  resolve(request: RecoveryOutcomeTrackerResolutionRequest): RecoveryOutcomeTrackerRoomLedger;
  timeout(request: RecoveryOutcomeTrackerTimeoutRequest): RecoveryOutcomeTrackerRoomLedger;
  abandon(request: RecoveryOutcomeTrackerAbandonRequest): RecoveryOutcomeTrackerRoomLedger;
  relapse(request: RecoveryOutcomeTrackerRelapseRequest): RecoveryOutcomeTrackerRoomLedger;
  project(roomId: ChatRoomId): RecoveryOutcomeTrackerProjection;
  buildSummary(roomId: ChatRoomId): RecoveryOutcomeTrackerSummary;
  buildAuditReport(roomIds: readonly ChatRoomId[], now: UnixMs): RecoveryOutcomeTrackerAuditReport;
  buildCrossRoomStats(roomIds: readonly ChatRoomId[], now: UnixMs): RecoveryOutcomeTrackerStatsSummary;
  computeDiff(roomId: ChatRoomId, before: RecoveryOutcomeTrackerSummary, now: UnixMs): RecoveryOutcomeTrackerDiff;
  batchIngest(records: readonly RecoveryOutcomeIngestRecord[]): RecoveryOutcomeBatchIngestResult;
  scoreHealth(roomId: ChatRoomId): Score01;
  projectTrend(roomId: ChatRoomId): ReturnType<typeof projectCohortTrend>;
  narrativeSummary(roomId: ChatRoomId): string;
  toJSON(): Readonly<{ profile: RecoveryOutcomeTrackerProfile; profileConfig: RecoveryOutcomeTrackerProfileConfig }>;
}

export function createRecoveryOutcomeTrackerFromProfile(
  profile: RecoveryOutcomeTrackerProfile,
  extraOptions: Omit<RecoveryOutcomeTrackerOptions, keyof RecoveryOutcomeTrackerProfileConfig['options']> = {},
): RecoveryOutcomeTrackerExtended {
  const profileConfig = RECOVERY_OUTCOME_TRACKER_PROFILE_CONFIGS[profile];
  const tracker = createRecoveryOutcomeTracker({ ...extraOptions, ...profileConfig.options });
  return Object.freeze({
    tracker,
    profile,
    begin: (r) => tracker.begin(r),
    acceptOption: (r) => tracker.acceptOption(r),
    resolve: (r) => tracker.resolve(r),
    timeout: (r) => tracker.timeout(r),
    abandon: (r) => tracker.abandon(r),
    relapse: (r) => tracker.relapse(r),
    project: (roomId) => tracker.project(roomId),
    buildSummary: (roomId) => tracker.buildSummary(roomId),
    buildAuditReport: (roomIds, now) => buildTrackerAuditReport(tracker, roomIds, now),
    buildCrossRoomStats: (roomIds, now) => buildCrossRoomTrackerStats(tracker, roomIds, now),
    computeDiff: (roomId, before, now) => computeTrackerDiff(tracker, roomId, before, now),
    batchIngest: (records) => batchIngestRecoveryOutcomeRecords(tracker, records),
    scoreHealth: (roomId) => scoreRecoveryHealth(tracker.getRoomLedger(roomId)),
    projectTrend: (roomId) => projectCohortTrend(tracker, roomId),
    narrativeSummary: (roomId) => buildTrackerNarrativeSummary(tracker, roomId),
    toJSON: () => Object.freeze({ profile, profileConfig }),
  });
}

// ============================================================================
// MARK: Named profile factories
// ============================================================================

export function createStandardRecoveryOutcomeTracker(options: RecoveryOutcomeTrackerOptions = {}): RecoveryOutcomeTrackerExtended {
  return createRecoveryOutcomeTrackerFromProfile('STANDARD', options);
}

export function createCinematicRecoveryOutcomeTracker(options: RecoveryOutcomeTrackerOptions = {}): RecoveryOutcomeTrackerExtended {
  return createRecoveryOutcomeTrackerFromProfile('CINEMATIC', options);
}

export function createAggressiveRecoveryOutcomeTracker(options: RecoveryOutcomeTrackerOptions = {}): RecoveryOutcomeTrackerExtended {
  return createRecoveryOutcomeTrackerFromProfile('AGGRESSIVE', options);
}

export function createPatientRecoveryOutcomeTracker(options: RecoveryOutcomeTrackerOptions = {}): RecoveryOutcomeTrackerExtended {
  return createRecoveryOutcomeTrackerFromProfile('PATIENT', options);
}

export function createAnalyticsRecoveryOutcomeTracker(options: RecoveryOutcomeTrackerOptions = {}): RecoveryOutcomeTrackerExtended {
  return createRecoveryOutcomeTrackerFromProfile('ANALYTICS', options);
}

export function createMinimalRecoveryOutcomeTracker(options: RecoveryOutcomeTrackerOptions = {}): RecoveryOutcomeTrackerExtended {
  return createRecoveryOutcomeTrackerFromProfile('MINIMAL', options);
}

// ============================================================================
// MARK: Outcome filtering and ranking
// ============================================================================

export function filterSettledByCohort(
  tracker: RecoveryOutcomeTracker,
  roomId: ChatRoomId,
  cohort: RecoveryOutcomeTrackerCohort,
): readonly SettledRecoveryRecord[] {
  return Object.freeze(tracker.getRoomLedger(roomId).settledRecoveries.filter((s) => s.cohort === cohort));
}

export function filterSettledBySuccessBand(
  tracker: RecoveryOutcomeTracker,
  roomId: ChatRoomId,
  band: ChatRecoverySuccessBand,
): readonly SettledRecoveryRecord[] {
  return Object.freeze(tracker.getRoomLedger(roomId).settledRecoveries.filter((s) => s.outcome.successBand === band));
}

export function sortSettledByReinforcement(
  records: readonly SettledRecoveryRecord[],
  direction: 'ASC' | 'DESC' = 'DESC',
): readonly SettledRecoveryRecord[] {
  return Object.freeze([...records].sort((a, b) => {
    const delta = Number(b.reinforcementScore01) - Number(a.reinforcementScore01);
    return direction === 'DESC' ? delta : -delta;
  }));
}

export function sortSettledByRelapseRisk(
  records: readonly SettledRecoveryRecord[],
  direction: 'DESC' | 'ASC' = 'DESC',
): readonly SettledRecoveryRecord[] {
  return Object.freeze([...records].sort((a, b) => {
    const delta = Number(b.relapseRisk01) - Number(a.relapseRisk01);
    return direction === 'DESC' ? delta : -delta;
  }));
}

export function findMostRecentSettled(
  tracker: RecoveryOutcomeTracker,
  roomId: ChatRoomId,
): SettledRecoveryRecord | null {
  const settled = tracker.getRoomLedger(roomId).settledRecoveries;
  if (settled.length === 0) return null;
  return [...settled].sort((a, b) => Number(b.settledAt) - Number(a.settledAt))[0] ?? null;
}

export function findStrongestOutcome(
  tracker: RecoveryOutcomeTracker,
  roomId: ChatRoomId,
): SettledRecoveryRecord | null {
  const settled = tracker.getRoomLedger(roomId).settledRecoveries;
  const bandRank: Record<ChatRecoverySuccessBand, number> = {
    NO_LIFT: 0, SMALL_LIFT: 1, CLEAR_LIFT: 2, STRONG_LIFT: 3, RUN_SAVED: 4,
  };
  let best: SettledRecoveryRecord | null = null;
  for (const s of settled) {
    if (!best || bandRank[s.outcome.successBand] > bandRank[best.outcome.successBand]) {
      best = s;
    }
  }
  return best;
}

// ============================================================================
// MARK: RecoveryOutcomeTrackerModule — combined barrel export
// ============================================================================

export const RecoveryOutcomeTrackerModule = Object.freeze({
  // Core class + factory
  RecoveryOutcomeTracker,
  createRecoveryOutcomeTracker,

  // Profile system
  createFromProfile: createRecoveryOutcomeTrackerFromProfile,
  createStandard: createStandardRecoveryOutcomeTracker,
  createCinematic: createCinematicRecoveryOutcomeTracker,
  createAggressive: createAggressiveRecoveryOutcomeTracker,
  createPatient: createPatientRecoveryOutcomeTracker,
  createAnalytics: createAnalyticsRecoveryOutcomeTracker,
  createMinimal: createMinimalRecoveryOutcomeTracker,

  // Analytics
  RecoveryOutcomeAnalytics,
  createRecoveryOutcomeAnalytics,

  // Batch ops
  batchIngest: batchIngestRecoveryOutcomeRecords,
  ingestRecords: ingestRecoveryOutcomeRecords,

  // Audit + stats
  buildAuditReport: buildTrackerAuditReport,
  buildCrossRoomStats: buildCrossRoomTrackerStats,
  computeDiff: computeTrackerDiff,

  // Cohort + projection
  buildGlobalCohortMap,
  projectCohortTrend,
  cohortNeedsMonitoring,
  labelCohortStrength,

  // Scoring
  scoreHealth: scoreRecoveryHealth,
  projectHealth: projectRecoveryTrackerHealth,
  wouldPermitEscalation: recoveryTrackerWouldPermitEscalation,
  needsHelperCover: recoveryTrackerNeedsHelperCover,

  // Filtering and ranking
  filterSettledByCohort,
  filterSettledBySuccessBand,
  sortSettledByReinforcement,
  sortSettledByRelapseRisk,
  filterReplaySlices: filterRecoveryReplaySlices,
  settledToReplaySlice,
  findMostRecentSettled,
  findStrongestOutcome,

  // Serialization
  serializeProjection: serializeTrackerProjection,
  buildSettledSliceSummary,
  buildNarrativeSummary: buildTrackerNarrativeSummary,

  // Data tables
  PROFILES: RECOVERY_OUTCOME_TRACKER_PROFILE_CONFIGS,
  NOTES: RECOVERY_OUTCOME_TRACKER_NOTES,
  COHORT_GUIDE: RECOVERY_OUTCOME_TRACKER_COHORT_GUIDE,
  COHORTS: RECOVERY_TRACKER_COHORTS,
  STATUSES: RECOVERY_TRACKER_STATUS,
} as const);

// ============================================================================
// MARK: Room health monitoring
// ============================================================================

export interface RecoveryRoomHealthSnapshot {
  readonly roomId: string;
  readonly health01: Score01;
  readonly cohort: RecoveryOutcomeTrackerCohort;
  readonly trend: 'IMPROVING' | 'STABLE' | 'DETERIORATING' | 'UNKNOWN';
  readonly needsMonitoring: boolean;
  readonly cohortStrength: 'STRONG' | 'MODERATE' | 'WEAK' | 'UNKNOWN';
  readonly reinforcementScore01: Score01;
  readonly relapseRisk01: Score01;
  readonly activeCount: number;
  readonly settledCount: number;
}

export function buildRoomHealthSnapshot(
  tracker: RecoveryOutcomeTracker,
  roomId: ChatRoomId,
): RecoveryRoomHealthSnapshot {
  const ledger = tracker.getRoomLedger(roomId);
  const projection = tracker.project(roomId);
  const summary = tracker.buildSummary(roomId);
  const trend = projectCohortTrend(tracker, roomId);
  const health01 = scoreRecoveryHealth(ledger);
  const cohort = projection.cohort as RecoveryOutcomeTrackerCohort;
  return Object.freeze({
    roomId: String(roomId),
    health01,
    cohort,
    trend,
    needsMonitoring: cohortNeedsMonitoring(cohort),
    cohortStrength: labelCohortStrength(cohort),
    reinforcementScore01: projection.reinforcementScore01,
    relapseRisk01: projection.relapseRisk01,
    activeCount: summary.activeCount,
    settledCount: summary.settledCount,
  });
}

export function buildMultiRoomHealthMap(
  tracker: RecoveryOutcomeTracker,
  roomIds: readonly ChatRoomId[],
): readonly RecoveryRoomHealthSnapshot[] {
  return Object.freeze(roomIds.map((roomId) => buildRoomHealthSnapshot(tracker, roomId)));
}

export function findHighestRiskRoom(
  tracker: RecoveryOutcomeTracker,
  roomIds: readonly ChatRoomId[],
): ChatRoomId | null {
  let highestRisk: Score01 = 0 as Score01;
  let highestRoomId: ChatRoomId | null = null;
  for (const roomId of roomIds) {
    const projection = tracker.project(roomId);
    if (Number(projection.relapseRisk01) > Number(highestRisk)) {
      highestRisk = projection.relapseRisk01;
      highestRoomId = roomId;
    }
  }
  return highestRoomId;
}

export function findStrongestRecoveryRoom(
  tracker: RecoveryOutcomeTracker,
  roomIds: readonly ChatRoomId[],
): ChatRoomId | null {
  const bandRank: Record<ChatRecoverySuccessBand, number> = {
    NO_LIFT: 0, SMALL_LIFT: 1, CLEAR_LIFT: 2, STRONG_LIFT: 3, RUN_SAVED: 4,
  };
  let bestRank = -1;
  let bestRoomId: ChatRoomId | null = null;
  for (const roomId of roomIds) {
    const projection = tracker.project(roomId);
    const band = projection.strongestSuccessBand;
    const rank = band ? (bandRank[band] ?? 0) : -1;
    if (rank > bestRank) {
      bestRank = rank;
      bestRoomId = roomId;
    }
  }
  return bestRoomId;
}

// ============================================================================
// MARK: Recovery ledger serialization
// ============================================================================

export function serializeLedgerEntry(entry: ChatRecoveryLedgerEntry): Readonly<Record<string, unknown>> {
  return Object.freeze({
    ledgerId: String(entry.ledgerId),
    recoveryId: String(entry.recoveryId),
    recoveryPlanId: String(entry.recoveryPlanId),
    visibleChannel: entry.visibleChannel,
    entryPoint: entry.entryPoint,
    outcomeKind: entry.outcomeKind,
    successBand: entry.successBand,
    createdAt: Number(entry.createdAt),
    updatedAt: Number(entry.updatedAt),
    acceptedOptionId: entry.acceptedOptionId ? String(entry.acceptedOptionId) : null,
    noteCount: entry.notes?.length ?? 0,
  });
}

export function serializeRoomLedger(ledger: RecoveryOutcomeTrackerRoomLedger): Readonly<Record<string, unknown>> {
  return Object.freeze({
    roomId: String(ledger.roomId),
    activeCount: ledger.activeRecoveries.length,
    settledCount: ledger.settledRecoveries.length,
    recoveryLedgerCount: ledger.recoveryLedger.length,
    rescuePlanCount: ledger.settledRecoveries.length,
    latestActiveId: ledger.activeRecoveries[0]?.recoveryId ? String(ledger.activeRecoveries[0].recoveryId) : null,
    latestSettledId: ledger.settledRecoveries[0]?.recoveryId ? String(ledger.settledRecoveries[0].recoveryId) : null,
  });
}

// ============================================================================
// MARK: Outcome prediction helpers
// ============================================================================

export function predictReinforcement(
  stabilityLift01: Score01,
  confidenceLift01: Score01,
  trustLift01: Score01,
  embarrassmentReduction01: Score01,
  ageMs: number = 0,
  halfLifeMs: number = 180_000,
): Score01 {
  return deriveReinforcementScore({
    stabilityLift01,
    confidenceLift01,
    trustLift01,
    embarrassmentReduction01,
    ageMs,
    halfLifeMs,
  });
}

export function estimateCohortFromLifts(
  stabilityLift01: Score01,
  confidenceLift01: Score01,
  trustLift01: Score01,
  relapseRisk01: Score01,
): RecoveryOutcomeTrackerCohort {
  const total = (Number(stabilityLift01) + Number(confidenceLift01) + Number(trustLift01)) / 3;
  if (total >= 0.62 && Number(relapseRisk01) <= 0.24) return 'COMEBACK_READY';
  if (total >= 0.48 && Number(relapseRisk01) <= 0.34) return 'STABLE';
  if (total >= 0.34 && Number(trustLift01) >= 0.28) return 'HELPER_RELIANT';
  if (total >= 0.22) return 'FRAGILE';
  if (Number(relapseRisk01) >= 0.58) return 'VOLATILE';
  return 'SAVEABLE';
}

// ============================================================================
// MARK: Validation helpers
// ============================================================================

export function validateTrackerBeginRequest(request: RecoveryOutcomeTrackerBeginRequest): readonly string[] {
  const errors: string[] = [];
  if (!request.roomId) errors.push('roomId is required');
  if (!request.recoveryPlan) errors.push('recoveryPlan is required');
  if (!request.recoveryPlan?.recoveryId) errors.push('recoveryPlan.recoveryId is required');
  return Object.freeze(errors);
}

export function validateTrackerResolutionRequest(request: RecoveryOutcomeTrackerResolutionRequest): readonly string[] {
  const errors: string[] = [];
  if (!request.roomId) errors.push('roomId is required');
  if (!request.recoveryId) errors.push('recoveryId is required');
  const s01 = Number(request.stabilityLift01);
  if (s01 < 0 || s01 > 1) errors.push(`stabilityLift01 out of range: ${s01}`);
  return Object.freeze(errors);
}

// ============================================================================
// MARK: Reinforcement decay utility
// ============================================================================

export function decayReinforcementScore(
  score01: Score01,
  elapsedMs: number,
  halfLifeMs: number,
): Score01 {
  if (halfLifeMs <= 0 || elapsedMs <= 0) return score01;
  const decayFactor = Math.pow(0.5, elapsedMs / halfLifeMs);
  return Math.max(0, Math.min(1, Number(score01) * decayFactor)) as Score01;
}

export function applyRelapseImpact(
  reinforcementScore01: Score01,
  relapseRisk01: Score01,
  relapseSeverity01: Score01,
): { reinforcement: Score01; relapseRisk: Score01 } {
  const newReinforcement = Math.max(0, Number(reinforcementScore01) - Number(relapseSeverity01) * 0.62) as Score01;
  const newRelapseRisk = Math.min(1, Number(relapseRisk01) + Number(relapseSeverity01) * 0.72) as Score01;
  return { reinforcement: newReinforcement, relapseRisk: newRelapseRisk };
}

// ============================================================================
// MARK: Cohort transition law
// ============================================================================

export const RECOVERY_COHORT_TRANSITION_LAW: Readonly<Record<RecoveryOutcomeTrackerCohort, readonly RecoveryOutcomeTrackerCohort[]>> = Object.freeze({
  UNKNOWN: ['SAVEABLE', 'FRAGILE', 'VOLATILE'] as const,
  SAVEABLE: ['STABLE', 'FRAGILE', 'VOLATILE'] as const,
  FRAGILE: ['STABLE', 'HELPER_RELIANT', 'VOLATILE'] as const,
  STABLE: ['COMEBACK_READY', 'HELPER_RELIANT', 'FRAGILE'] as const,
  VOLATILE: ['SAVEABLE', 'FRAGILE', 'UNKNOWN'] as const,
  COMEBACK_READY: ['STABLE', 'FRAGILE'] as const,
  HELPER_RELIANT: ['STABLE', 'FRAGILE', 'VOLATILE'] as const,
});

export function cohortCanTransitionTo(
  from: RecoveryOutcomeTrackerCohort,
  to: RecoveryOutcomeTrackerCohort,
): boolean {
  const allowed = RECOVERY_COHORT_TRANSITION_LAW[from] ?? [];
  return (allowed as readonly string[]).includes(to);
}

export function describeSettledPath(settled: SettledRecoveryRecord): string {
  const parts = [
    `id=${String(settled.recoveryId).slice(0, 8)}`,
    `kind=${settled.outcome.kind}`,
    `band=${settled.outcome.successBand}`,
    `cohort=${settled.cohort}`,
    `reinf=${Number(settled.reinforcementScore01).toFixed(2)}`,
    `relapse=${Number(settled.relapseRisk01).toFixed(2)}`,
  ];
  return parts.join(' | ');
}

export function buildSettledPathLog(tracker: RecoveryOutcomeTracker, roomId: ChatRoomId): readonly string[] {
  return Object.freeze(tracker.getRoomLedger(roomId).settledRecoveries.map(describeSettledPath));
}

export function activeRecoveryNeedsHelperCover(active: ActiveRecoveryRecord): boolean {
  return active.cohort === 'FRAGILE' || active.cohort === 'HELPER_RELIANT' ||
    Number(active.relapseRisk01) >= 0.52;
}

export function activeRecoveryIsAtRisk(active: ActiveRecoveryRecord): boolean {
  return Number(active.relapseRisk01) >= 0.65 || active.cohort === 'VOLATILE';
}

// ============================================================================
// MARK: Lift digest — computed from affect deltas
// ============================================================================

/**
 * Typed lift digest produced from before/after affect snapshots.
 * Stamped with the recovery kind and entry point for downstream ledger use.
 */
export interface RecoveryOutcomeTrackerLiftDigest {
  readonly kind: ChatRecoveryKind;
  readonly entryPoint: ChatRecoveryEntryPoint;
  readonly stabilityLift01: Score01;
  readonly embarrassmentReduction01: Score01;
  readonly confidenceLift01: Score01;
  readonly trustLift01: Score01;
}

/**
 * Compute a typed lift digest from before/after affect snapshots.
 * Uses `deriveRecoveryLiftSnapshot` from the shared recovery contract to
 * produce canonical lift metrics stamped with kind and entry point.
 */
export function buildTrackerLiftDigest(input: {
  readonly kind: ChatRecoveryKind;
  readonly entryPoint: ChatRecoveryEntryPoint;
  readonly before: {
    readonly confidence: Score01;
    readonly frustration: Score01;
    readonly socialEmbarrassment: Score01;
    readonly trust: Score01;
  };
  readonly after: {
    readonly confidence: Score01;
    readonly frustration: Score01;
    readonly socialEmbarrassment: Score01;
    readonly trust: Score01;
  };
}): RecoveryOutcomeTrackerLiftDigest {
  const lift = deriveRecoveryLiftSnapshot({ before: input.before as any, after: input.after as any });
  return Object.freeze({
    kind: input.kind,
    entryPoint: input.entryPoint,
    stabilityLift01: lift.stabilityLift01 as Score01,
    embarrassmentReduction01: lift.embarrassmentReduction01 as Score01,
    confidenceLift01: lift.confidenceLift01 as Score01,
    trustLift01: lift.trustLift01 as Score01,
  });
}

// ============================================================================
// MARK: Tracker doctrine notes
// ============================================================================

export const RECOVERY_OUTCOME_TRACKER_DEFAULT_OPTIONS: Readonly<RecoveryOutcomeTrackerOptions> = Object.freeze({
  retainLedgerEntriesPerRoom: 24,
  retainActiveRecordsPerRoom: 4,
  relapseWindowMs: 30_000,
  reinforcementDecayHalfLifeMs: 180_000,
});

export const RECOVERY_OUTCOME_TRACKER_DOCTRINE: Readonly<Record<string, readonly string[]>> = Object.freeze({
  TRACKING_BOUNDARY: Object.freeze([
    'The tracker owns outcome state from the moment a recovery plan exists.',
    'It does not own the rescue decision — that belongs to ChurnRescuePolicy.',
    'It does not own the window — that belongs to RescueInterventionPlanner.',
  ]),
  COHORT_ASSIGNMENT: Object.freeze([
    'Cohorts are assigned from backend lift vectors, not player self-assessment.',
    'A player can be STABLE on paper but VOLATILE by the next signal update.',
    'Cohort transitions should be audited for replay accuracy.',
  ]),
  REINFORCEMENT: Object.freeze([
    'Reinforcement is not permanent; it decays over time by design.',
    'Decay is calibrated per profile to match the authored pressure curve.',
    'High reinforcement with high relapse risk is an unstable equilibrium.',
  ]),
});
