
/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT RESCUE INTERVENTION PLANNER
 * FILE: backend/src/game/engine/chat/rescue/RescueInterventionPlanner.ts
 * VERSION: 2026.03.19
 * AUTHORSHIP: OpenAI for Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Backend rescue orchestration authority sitting above rescue/churn policy and
 * below transcript mutation / transport fanout. It opens rescue windows,
 * persists active rescue state, expires stale rescue offers, resolves recovery
 * outcomes, and returns backend-truth packages that higher layers can render,
 * narrate, or fan out.
 *
 * This file does not own React/UI rendering.
 * This file does not own sockets.
 * This file does not replace helper or hater authored-line systems.
 *
 * It exists because rescue must be replayable, explicable, and lawful.
 * ============================================================================
 */

import type {
  ChatRecoveryDigest,
  ChatRecoveryLedgerEntry,
  ChatRecoveryOutcome,
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
  ChatRescueLedgerEntry,
  ChatRescueOffer,
  ChatRescueOutcome,
  ChatRescuePlan,
  ChatRescueStateSnapshot,
  ChatRescueWindow,
} from '../../../../../../shared/contracts/chat/ChatRescue';
import {
  createRescueLedgerEntry,
  deriveRescueDigest,
  deriveRescueStateSnapshot,
} from '../../../../../../shared/contracts/chat/ChatRescue';

import type {
  ChatEventId,
  ChatMessage,
  ChatRoomId,
  ChatRoomState,
  ChatSessionId,
  ChatSessionState,
  ChatSignalEnvelope,
  ChatState,
  JsonValue,
  Score01,
  UnixMs,
} from '../types';
import { asUnixMs, clamp01 } from '../types';
import {
  ChurnRescuePolicy,
  createChurnRescuePolicy,
  type ChurnRescuePolicyDecision,
  type ChurnRescuePolicyOptions,
  type ChurnRescuePolicyRequest,
} from './ChurnRescuePolicy';
import {
  RecoveryOutcomeTracker,
  createRecoveryOutcomeTracker,
  type RecoveryOutcomeTrackerOptions,
  type RecoveryOutcomeTrackerResolutionRequest,
} from './RecoveryOutcomeTracker';

// ============================================================================
// MARK: Public contracts
// ============================================================================

export interface RescueInterventionPlannerClock {
  now(): number;
}

export interface RescueInterventionPlannerLogger {
  debug(event: string, payload?: Readonly<Record<string, JsonValue>>): void;
  info(event: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(event: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

export interface RescueInterventionPlannerOptions {
  readonly clock?: RescueInterventionPlannerClock;
  readonly logger?: RescueInterventionPlannerLogger;
  readonly churnPolicy?: ChurnRescuePolicy;
  readonly churnPolicyOptions?: ChurnRescuePolicyOptions;
  readonly outcomeTracker?: RecoveryOutcomeTracker;
  readonly outcomeTrackerOptions?: RecoveryOutcomeTrackerOptions;
  readonly maxActiveRescuesPerRoom?: number;
  readonly retainLedgerEntriesPerRoom?: number;
}

export interface RescueInterventionPlanRequest extends ChurnRescuePolicyRequest {
  readonly actorMessage?: ChatMessage | null;
  readonly sourceEventId?: ChatEventId | null;
}

export interface RescueAcceptActionRequest {
  readonly roomId: ChatRoomId;
  readonly rescueId: string;
  readonly recoveryId?: string | null;
  readonly acceptedOfferId?: string | null;
  readonly acceptedActionId?: string | null;
  readonly now?: UnixMs;
  readonly notes?: readonly string[];
}

export interface RescueResolveRequest {
  readonly roomId: ChatRoomId;
  readonly rescueId: string;
  readonly recoveryId?: string | null;
  readonly success01: Score01;
  readonly embarrassmentReduction01?: Score01;
  readonly confidenceLift01?: Score01;
  readonly trustLift01?: Score01;
  readonly now?: UnixMs;
  readonly notes?: readonly string[];
}

export interface RescueExpireRequest {
  readonly roomId: ChatRoomId;
  readonly now?: UnixMs;
}

export interface ActiveRescueIntervention {
  readonly rescuePlan: ChatRescuePlan;
  readonly rescueWindow: ChatRescueWindow;
  readonly rescueState: ChatRescueStateSnapshot;
  readonly recoveryPlan: ChatRecoveryPlan;
  readonly predictedOutcome: ChatRecoveryOutcome | null;
  readonly openedAt: UnixMs;
  readonly updatedAt: UnixMs;
  readonly reasons: readonly string[];
}

export interface RescueInterventionPlannerResult {
  readonly opened: boolean;
  readonly suppressed: boolean;
  readonly expired: boolean;
  readonly decision: ChurnRescuePolicyDecision;
  readonly active: ActiveRescueIntervention | null;
  readonly rescueDigest: ChatRescueDigest;
  readonly recoveryDigest: ChatRecoveryDigest;
  readonly notes: readonly string[];
}

export interface RescueRoomLedger {
  readonly roomId: ChatRoomId;
  readonly active: readonly ActiveRescueIntervention[];
  readonly rescueLedger: readonly ChatRescueLedgerEntry[];
  readonly recoveryLedger: readonly ChatRecoveryLedgerEntry[];
  readonly rescueDigest: ChatRescueDigest;
  readonly recoveryDigest: ChatRecoveryDigest;
}

// ============================================================================
// MARK: Defaults and room state
// ============================================================================

const DEFAULT_CLOCK: RescueInterventionPlannerClock = Object.freeze({ now: () => Date.now() });
const DEFAULT_LOGGER: RescueInterventionPlannerLogger = Object.freeze({
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
});

interface MutableRoomLedger {
  roomId: ChatRoomId;
  active: ActiveRescueIntervention[];
  rescueLedger: ChatRescueLedgerEntry[];
  recoveryLedger: ChatRecoveryLedgerEntry[];
}

function unix(value: number | UnixMs): UnixMs {
  return asUnixMs(Number(value));
}

function safeNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function safeArray(value: readonly string[] | undefined | null): readonly string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

function score01(value: number): Score01 {
  return clamp01(value) as Score01;
}

function freezeLedger(room: MutableRoomLedger): RescueRoomLedger {
  const rescueDigest = deriveRescueDigest(room.rescueLedger, unix(Date.now()));
  const recoveryDigest = deriveRecoveryDigest(room.recoveryLedger, unix(Date.now()));
  return Object.freeze({
    roomId: room.roomId,
    active: Object.freeze(room.active.slice()),
    rescueLedger: Object.freeze(room.rescueLedger.slice()),
    recoveryLedger: Object.freeze(room.recoveryLedger.slice()),
    rescueDigest,
    recoveryDigest,
  });
}

function rescueLedgerEntryFromActive(active: ActiveRescueIntervention, now: UnixMs): ChatRescueLedgerEntry {
  return createRescueLedgerEntry({
    rescueId: active.rescuePlan.rescueId,
    rescuePlanId: active.rescuePlan.rescuePlanId,
    roomId: active.rescuePlan.roomId,
    channelId: active.rescuePlan.channelId,
    visibleChannel: active.rescuePlan.visibleChannel,
    outcome: active.rescuePlan.state,
    reasonCode: active.rescuePlan.trigger.reasonCode,
    urgency: active.rescuePlan.urgency,
    style: active.rescuePlan.style,
    createdAt: active.openedAt,
    updatedAt: now,
    acceptedOfferId: active.rescuePlan.selectedOffer.offerId,
    acceptedActionId: null,
    winningHelperId: active.rescuePlan.helperActor?.actorId ?? null,
    replayId: null,
    notes: active.reasons,
  } as any);
}

function recoveryLedgerEntryFromOutcome(active: ActiveRescueIntervention, outcome: ChatRecoveryOutcome, now: UnixMs): ChatRecoveryLedgerEntry {
  return {
    ledgerId: (`recovery-ledger:${String(active.recoveryPlan.recoveryId)}:${Number(now)}` as any),
    recoveryId: active.recoveryPlan.recoveryId,
    recoveryPlanId: active.recoveryPlan.recoveryPlanId,
    visibleChannel: active.recoveryPlan.visibleChannel,
    entryPoint: active.recoveryPlan.entryPoint,
    outcomeKind: outcome.kind,
    successBand: outcome.successBand,
    createdAt: active.openedAt,
    updatedAt: now,
    replayId: null,
    acceptedOptionId: outcome.acceptedOptionId ?? null,
    notes: active.reasons,
  } as ChatRecoveryLedgerEntry;
}

// ============================================================================
// MARK: RescueInterventionPlanner
// ============================================================================

export class RescueInterventionPlanner {
  private readonly clock: RescueInterventionPlannerClock;
  private readonly logger: RescueInterventionPlannerLogger;
  private readonly churnPolicy: ChurnRescuePolicy;
  private readonly outcomeTracker: RecoveryOutcomeTracker;
  private readonly maxActiveRescuesPerRoom: number;
  private readonly retainLedgerEntriesPerRoom: number;
  private readonly rooms = new Map<string, MutableRoomLedger>();

  public constructor(options: RescueInterventionPlannerOptions = {}) {
    this.clock = options.clock ?? DEFAULT_CLOCK;
    this.logger = options.logger ?? DEFAULT_LOGGER;
    this.churnPolicy = options.churnPolicy ?? createChurnRescuePolicy(options.churnPolicyOptions);
    this.outcomeTracker = options.outcomeTracker ?? createRecoveryOutcomeTracker(options.outcomeTrackerOptions);
    this.maxActiveRescuesPerRoom = Math.max(1, safeNumber(options.maxActiveRescuesPerRoom, 3));
    this.retainLedgerEntriesPerRoom = Math.max(10, safeNumber(options.retainLedgerEntriesPerRoom, 120));
  }

  public evaluate(request: RescueInterventionPlanRequest): RescueInterventionPlannerResult {
    const now = request.telemetry?.now ?? unix(this.clock.now());
    const decision = this.churnPolicy.evaluate({ ...request, telemetry: { ...(request.telemetry ?? {}), now } });
    const room = this.ensureRoom(request.roomId);

    this.expireActiveInRoom(room, now);

    if (!decision.shouldIntervene || !decision.rescuePlan || !decision.rescueWindow || !decision.recoveryPlan || !decision.rescueState) {
      const frozen = freezeLedger(room);
      return {
        opened: false,
        suppressed: true,
        expired: false,
        decision,
        active: null,
        rescueDigest: frozen.rescueDigest,
        recoveryDigest: frozen.recoveryDigest,
        notes: decision.notes,
      };
    }

    const existing = room.active.find((value) => String(value.rescuePlan.rescueId) === String(decision.rescuePlan!.rescueId));
    if (existing) {
      const frozen = freezeLedger(room);
      return {
        opened: false,
        suppressed: false,
        expired: false,
        decision,
        active: existing,
        rescueDigest: frozen.rescueDigest,
        recoveryDigest: frozen.recoveryDigest,
        notes: [...decision.notes, 'duplicate-rescue-id'],
      };
    }

    const intervention: ActiveRescueIntervention = Object.freeze({
      rescuePlan: decision.rescuePlan,
      rescueWindow: decision.rescueWindow,
      rescueState: decision.rescueState,
      recoveryPlan: decision.recoveryPlan,
      predictedOutcome: decision.predictedOutcome,
      openedAt: now,
      updatedAt: now,
      reasons: Object.freeze(decision.notes.slice()),
    });

    room.active.unshift(intervention);
    while (room.active.length > this.maxActiveRescuesPerRoom) {
      const removed = room.active.pop();
      if (removed) {
        room.rescueLedger.unshift({
          ...rescueLedgerEntryFromActive(removed, now),
          outcome: 'SUPPRESSED',
          notes: [...removed.reasons, 'trimmed-by-room-cap'],
        });
      }
    }

    room.rescueLedger.unshift(rescueLedgerEntryFromActive(intervention, now));
    if (intervention.predictedOutcome) {
      room.recoveryLedger.unshift(recoveryLedgerEntryFromOutcome(intervention, intervention.predictedOutcome, now));
    }
    this.outcomeTracker.begin({
      roomId: request.roomId,
      rescuePlan: intervention.rescuePlan,
      recoveryPlan: intervention.recoveryPlan,
      predictedOutcome: intervention.predictedOutcome ?? null,
      now,
      notes: intervention.reasons,
    });
    this.trimRoom(room);

    const frozen = freezeLedger(room);
    this.logger.info('chat.rescue.backend.opened', {
      roomId: request.roomId as any,
      rescueId: intervention.rescuePlan.rescueId as any,
      recoveryId: intervention.recoveryPlan.recoveryId as any,
      urgency: intervention.rescuePlan.urgency,
      kind: intervention.rescuePlan.kind,
    });

    return {
      opened: true,
      suppressed: false,
      expired: false,
      decision,
      active: intervention,
      rescueDigest: frozen.rescueDigest,
      recoveryDigest: frozen.recoveryDigest,
      notes: intervention.reasons,
    };
  }

  public acceptAction(request: RescueAcceptActionRequest): RescueRoomLedger {
    const now = request.now ?? unix(this.clock.now());
    const room = this.ensureRoom(request.roomId);
    const index = room.active.findIndex((value) => String(value.rescuePlan.rescueId) === String(request.rescueId));
    if (index < 0) return freezeLedger(room);

    const current = room.active[index];
    const rescuePlan: ChatRescuePlan = {
      ...current.rescuePlan,
      state: 'ACCEPTED',
      offeredAt: current.rescuePlan.offeredAt ?? current.openedAt,
      resolvedAt: now,
      notes: [...(current.rescuePlan.notes ?? []), ...safeArray(request.notes), `accepted-offer=${request.acceptedOfferId ?? 'selected'}`],
    };

    const active: ActiveRescueIntervention = Object.freeze({
      ...current,
      rescuePlan,
      updatedAt: now,
      reasons: Object.freeze([...current.reasons, ...safeArray(request.notes), 'accepted']),
    });
    room.active[index] = active;
    room.rescueLedger.unshift({
      ...rescueLedgerEntryFromActive(active, now),
      outcome: 'ACCEPTED',
      acceptedOfferId: (request.acceptedOfferId as any) ?? active.rescuePlan.selectedOffer.offerId,
      acceptedActionId: (request.acceptedActionId as any) ?? null,
    });
    this.outcomeTracker.acceptOption({
      roomId: request.roomId,
      recoveryId: active.recoveryPlan.recoveryId,
      acceptedOptionId: (request.acceptedActionId as any) ?? active.recoveryPlan.bundle.options[0]?.optionId ?? null,
      now,
      notes: safeArray(request.notes),
    });
    this.trimRoom(room);
    return freezeLedger(room);
  }

  public resolve(request: RescueResolveRequest): RescueRoomLedger {
    const now = request.now ?? unix(this.clock.now());
    const room = this.ensureRoom(request.roomId);
    const index = room.active.findIndex((value) => String(value.rescuePlan.rescueId) === String(request.rescueId));
    if (index < 0) return freezeLedger(room);

    const current = room.active[index];
    const acceptedOptionId = current.recoveryPlan.bundle.options[0]?.optionId ?? null;
    const outcome = createRecoveryOutcome({
      recoveryId: current.recoveryPlan.recoveryId,
      acceptedOptionId,
      stabilityLift01: Number(request.success01),
      embarrassmentReduction01: Number(request.embarrassmentReduction01 ?? score01(Number(request.success01) * 0.52)),
      confidenceLift01: Number(request.confidenceLift01 ?? score01(Number(request.success01) * 0.47)),
      trustLift01: Number(request.trustLift01 ?? score01(Number(request.success01) * 0.20)),
      updatedAt: now,
    });

    const resolvedState: ChatRescueOutcome =
      outcome.kind === 'RECOVERED' || outcome.kind === 'STABILIZED'
        ? 'RESOLVED'
        : outcome.kind === 'PARTIAL'
          ? 'ESCALATED'
          : 'ABANDONED';

    const active: ActiveRescueIntervention = Object.freeze({
      ...current,
      rescuePlan: {
        ...current.rescuePlan,
        state: resolvedState,
        resolvedAt: now,
        notes: [...(current.rescuePlan.notes ?? []), ...safeArray(request.notes), `resolved=${outcome.kind}`],
      },
      predictedOutcome: outcome,
      updatedAt: now,
      reasons: Object.freeze([...current.reasons, ...safeArray(request.notes), `successBand=${outcome.successBand}`]),
    });

    room.active.splice(index, 1);
    room.rescueLedger.unshift({
      ...rescueLedgerEntryFromActive(active, now),
      outcome: resolvedState,
      notes: active.reasons,
    });
    room.recoveryLedger.unshift(recoveryLedgerEntryFromOutcome(active, outcome, now));
    const trackerResolutionRequest: RecoveryOutcomeTrackerResolutionRequest = {
      roomId: request.roomId,
      recoveryId: current.recoveryPlan.recoveryId,
      acceptedOptionId,
      stabilityLift01: outcome.stabilityLift01,
      embarrassmentReduction01: outcome.embarrassmentReduction01,
      confidenceLift01: outcome.confidenceLift01,
      trustLift01: outcome.trustLift01,
      now,
      notes: active.reasons,
    };
    this.outcomeTracker.resolve(trackerResolutionRequest);
    this.trimRoom(room);

    this.logger.info('chat.rescue.backend.resolved', {
      roomId: request.roomId as any,
      rescueId: request.rescueId,
      recoveryId: current.recoveryPlan.recoveryId as any,
      outcomeKind: outcome.kind,
      successBand: outcome.successBand,
    });

    return freezeLedger(room);
  }

  public expire(request: RescueExpireRequest): RescueRoomLedger {
    const now = request.now ?? unix(this.clock.now());
    const room = this.ensureRoom(request.roomId);
    const expired = this.expireActiveInRoom(room, now);
    const frozen = freezeLedger(room);
    if (expired > 0) {
      this.logger.debug('chat.rescue.backend.expired', {
        roomId: request.roomId as any,
        expired,
      });
    }
    return frozen;
  }

  public getRoomLedger(roomId: ChatRoomId): RescueRoomLedger {
    return freezeLedger(this.ensureRoom(roomId));
  }

  public listActive(roomId: ChatRoomId): readonly ActiveRescueIntervention[] {
    return Object.freeze(this.ensureRoom(roomId).active.slice());
  }

  public summarizeRoom(roomId: ChatRoomId): string {
    const room = this.ensureRoom(roomId);
    const rescueDigest = deriveRescueDigest(room.rescueLedger, unix(this.clock.now()));
    const recoveryDigest = deriveRecoveryDigest(room.recoveryLedger, unix(this.clock.now()));
    const trackerSummary = this.outcomeTracker.summarizeRoom(roomId);
    return [
      `active=${room.active.length}`,
      `rescueActive=${rescueDigest.activeRescueIds.length}`,
      `recoveryActive=${recoveryDigest.activeRecoveryIds.length}`,
      `recoveryStrongest=${recoveryDigest.strongestSuccessBand ?? 'NONE'}`,
      `tracker=${trackerSummary}`,
    ].join(' | ');
  }

  private ensureRoom(roomId: ChatRoomId): MutableRoomLedger {
    const key = String(roomId);
    let room = this.rooms.get(key);
    if (!room) {
      room = {
        roomId,
        active: [],
        rescueLedger: [],
        recoveryLedger: [],
      };
      this.rooms.set(key, room);
    }
    return room;
  }

  private expireActiveInRoom(room: MutableRoomLedger, now: UnixMs): number {
    if (room.active.length === 0) return 0;
    const survivors: ActiveRescueIntervention[] = [];
    let expired = 0;
    for (const active of room.active) {
      if (Number(active.rescueWindow.closesAt) > Number(now)) {
        survivors.push(active);
        continue;
      }
      expired += 1;
      room.rescueLedger.unshift({
        ...rescueLedgerEntryFromActive(active, now),
        outcome: active.rescueWindow.allowSilenceAsSuccess ? 'RESOLVED' : 'TIMED_OUT',
        notes: [...active.reasons, active.rescueWindow.allowSilenceAsSuccess ? 'silent-success' : 'window-expired'],
      });
      if (active.predictedOutcome) {
        const predicted = active.rescueWindow.allowSilenceAsSuccess
          ? createRecoveryOutcome({
              recoveryId: active.recoveryPlan.recoveryId,
              acceptedOptionId: active.recoveryPlan.bundle.options[0]?.optionId ?? null,
              stabilityLift01: 0.42,
              embarrassmentReduction01: 0.32,
              confidenceLift01: 0.18,
              trustLift01: 0.11,
              updatedAt: now,
            })
          : createRecoveryOutcome({
              recoveryId: active.recoveryPlan.recoveryId,
              acceptedOptionId: null,
              stabilityLift01: 0.02,
              embarrassmentReduction01: 0.01,
              confidenceLift01: 0.0,
              trustLift01: 0.0,
              updatedAt: now,
            });
        room.recoveryLedger.unshift(recoveryLedgerEntryFromOutcome(active, predicted, now));
        if (active.rescueWindow.allowSilenceAsSuccess) {
          this.outcomeTracker.resolve({
            roomId: active.rescuePlan.roomId,
            recoveryId: active.recoveryPlan.recoveryId,
            acceptedOptionId: active.recoveryPlan.bundle.options[0]?.optionId ?? null,
            stabilityLift01: predicted.stabilityLift01,
            embarrassmentReduction01: predicted.embarrassmentReduction01,
            confidenceLift01: predicted.confidenceLift01,
            trustLift01: predicted.trustLift01,
            now,
            notes: [...active.reasons, 'silent-success'],
          });
        } else {
          this.outcomeTracker.timeout({
            roomId: active.rescuePlan.roomId,
            recoveryId: active.recoveryPlan.recoveryId,
            now,
            notes: [...active.reasons, 'window-expired'],
          });
        }
      } else {
        this.outcomeTracker.timeout({
          roomId: active.rescuePlan.roomId,
          recoveryId: active.recoveryPlan.recoveryId,
          now,
          notes: [...active.reasons, 'window-expired-no-predicted-outcome'],
        });
      }
    }
    room.active = survivors;
    this.trimRoom(room);
    return expired;
  }

  private trimRoom(room: MutableRoomLedger): void {
    room.rescueLedger = room.rescueLedger.slice(0, this.retainLedgerEntriesPerRoom);
    room.recoveryLedger = room.recoveryLedger.slice(0, this.retainLedgerEntriesPerRoom);
  }
}

export function createRescueInterventionPlanner(options: RescueInterventionPlannerOptions = {}): RescueInterventionPlanner {
  return new RescueInterventionPlanner(options);
}

// ============================================================================
// MARK: Static analysis helpers
// ============================================================================

export function interventionWouldLikelySaveRun(successBand: ChatRecoverySuccessBand): boolean {
  return successBand === 'STRONG_LIFT' || successBand === 'RUN_SAVED';
}

export function interventionIsStillActive(active: ActiveRescueIntervention, now: UnixMs): boolean {
  return Number(active.rescueWindow.closesAt) > Number(now);
}

export function projectRescueWindowHealth(active: ActiveRescueIntervention, now: UnixMs): Score01 {
  const remaining = Math.max(0, Number(active.rescueWindow.closesAt) - Number(now));
  const total = Math.max(1, Number(active.rescueWindow.closesAt) - Number(active.rescueWindow.openedAt));
  return score01(remaining / total);
}

export function listExpiringSoon(active: readonly ActiveRescueIntervention[], now: UnixMs, thresholdMs = 2500): readonly ActiveRescueIntervention[] {
  return Object.freeze(active.filter((entry) => Number(entry.rescueWindow.closesAt) - Number(now) <= thresholdMs));
}


// ============================================================================
// MARK: Extended analytics / replay helpers / room projections
// ============================================================================

export interface RescueInterventionProjection {
  readonly roomId: ChatRoomId;
  readonly activeRescueId?: string | null;
  readonly activeRecoveryId?: string | null;
  readonly urgency?: string | null;
  readonly style?: string | null;
  readonly channel?: string | null;
  readonly helperName?: string | null;
  readonly windowHealth01: Score01;
  readonly predictedSuccessBand?: ChatRecoverySuccessBand | null;
  readonly rescueDigest: ChatRescueDigest;
  readonly recoveryDigest: ChatRecoveryDigest;
  readonly notes: readonly string[];
}

export interface RescueInterventionReplaySlice {
  readonly roomId: ChatRoomId;
  readonly openedAt: UnixMs;
  readonly resolvedAt?: UnixMs | null;
  readonly rescueId: string;
  readonly recoveryId: string;
  readonly rescueKind: string;
  readonly recoveryEntryPoint: string;
  readonly urgency: string;
  readonly style: string;
  readonly visibleChannel: string;
  readonly outcome?: string | null;
  readonly successBand?: ChatRecoverySuccessBand | null;
  readonly reasons: readonly string[];
}

export interface RescueInterventionMetrics {
  readonly roomId: ChatRoomId;
  readonly activeCount: number;
  readonly totalRescueEntries: number;
  readonly totalRecoveryEntries: number;
  readonly acceptedCount: number;
  readonly resolvedCount: number;
  readonly abandonedCount: number;
  readonly timedOutCount: number;
  readonly recoveredCount: number;
  readonly stabilizedCount: number;
  readonly failedCount: number;
  readonly latestSuccessBand?: ChatRecoverySuccessBand | null;
  readonly averageProjectedHealth01: Score01;
}

export interface RescueInterventionQuery {
  readonly roomId: ChatRoomId;
  readonly outcome?: string | null;
  readonly successBand?: ChatRecoverySuccessBand | null;
  readonly visibleChannel?: string | null;
  readonly since?: UnixMs | null;
  readonly limit?: number | null;
}

export function projectActiveIntervention(
  roomId: ChatRoomId,
  active: ActiveRescueIntervention | null,
  rescueDigest: ChatRescueDigest,
  recoveryDigest: ChatRecoveryDigest,
  now: UnixMs,
): RescueInterventionProjection {
  return Object.freeze({
    roomId,
    activeRescueId: active?.rescuePlan.rescueId ?? null,
    activeRecoveryId: active?.recoveryPlan.recoveryId ?? null,
    urgency: active?.rescuePlan.urgency ?? null,
    style: active?.rescuePlan.style ?? null,
    channel: active?.rescuePlan.visibleChannel ?? null,
    helperName: active?.rescuePlan.helperActor?.displayName ?? null,
    windowHealth01: active ? projectRescueWindowHealth(active, now) : score01(0),
    predictedSuccessBand: active?.predictedOutcome?.successBand ?? null,
    rescueDigest,
    recoveryDigest,
    notes: active?.reasons ?? [],
  });
}

export function toReplaySlice(active: ActiveRescueIntervention): RescueInterventionReplaySlice {
  return Object.freeze({
    roomId: active.rescuePlan.roomId,
    openedAt: active.openedAt,
    resolvedAt: active.rescuePlan.resolvedAt ?? null,
    rescueId: String(active.rescuePlan.rescueId),
    recoveryId: String(active.recoveryPlan.recoveryId),
    rescueKind: active.rescuePlan.kind,
    recoveryEntryPoint: active.recoveryPlan.entryPoint,
    urgency: active.rescuePlan.urgency,
    style: active.rescuePlan.style,
    visibleChannel: active.rescuePlan.visibleChannel,
    outcome: active.predictedOutcome?.kind ?? null,
    successBand: active.predictedOutcome?.successBand ?? null,
    reasons: active.reasons,
  });
}

export function summarizeRecoveryBand(entries: readonly ChatRecoveryLedgerEntry[]): ChatRecoverySuccessBand | null {
  const rank: Record<ChatRecoverySuccessBand, number> = {
    NO_LIFT: 0,
    SMALL_LIFT: 1,
    CLEAR_LIFT: 2,
    STRONG_LIFT: 3,
    RUN_SAVED: 4,
  };
  let best: ChatRecoverySuccessBand | null = null;
  for (const entry of entries) {
    if (!best || rank[entry.successBand] > rank[best]) best = entry.successBand;
  }
  return best;
}

export function computeRoomMetrics(room: RescueRoomLedger, now: UnixMs): RescueInterventionMetrics {
  const acceptedCount = room.rescueLedger.filter((entry) => entry.outcome === 'ACCEPTED').length;
  const resolvedCount = room.rescueLedger.filter((entry) => entry.outcome === 'RESOLVED').length;
  const abandonedCount = room.rescueLedger.filter((entry) => entry.outcome === 'ABANDONED').length;
  const timedOutCount = room.rescueLedger.filter((entry) => entry.outcome === 'TIMED_OUT').length;
  const recoveredCount = room.recoveryLedger.filter((entry) => entry.outcomeKind === 'RECOVERED').length;
  const stabilizedCount = room.recoveryLedger.filter((entry) => entry.outcomeKind === 'STABILIZED').length;
  const failedCount = room.recoveryLedger.filter((entry) => entry.outcomeKind === 'FAILED').length;
  const averageProjectedHealth01 = room.active.length
    ? score01(room.active.reduce((sum, value) => sum + Number(projectRescueWindowHealth(value, now)), 0) / room.active.length)
    : score01(0);
  return Object.freeze({
    roomId: room.roomId,
    activeCount: room.active.length,
    totalRescueEntries: room.rescueLedger.length,
    totalRecoveryEntries: room.recoveryLedger.length,
    acceptedCount,
    resolvedCount,
    abandonedCount,
    timedOutCount,
    recoveredCount,
    stabilizedCount,
    failedCount,
    latestSuccessBand: summarizeRecoveryBand(room.recoveryLedger),
    averageProjectedHealth01,
  });
}

export function filterReplaySlices(
  entries: readonly ActiveRescueIntervention[],
  query: RescueInterventionQuery,
): readonly RescueInterventionReplaySlice[] {
  const since = query.since ? Number(query.since) : null;
  const limit = query.limit ? Math.max(1, Number(query.limit)) : 50;
  return Object.freeze(
    entries
      .map(toReplaySlice)
      .filter((slice) => {
        if (query.outcome && slice.outcome !== query.outcome) return false;
        if (query.successBand && slice.successBand !== query.successBand) return false;
        if (query.visibleChannel && slice.visibleChannel !== query.visibleChannel) return false;
        if (since !== null && Number(slice.openedAt) < since) return false;
        return true;
      })
      .slice(0, limit),
  );
}

export const RESCUE_INTERVENTION_NOTES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  OPEN: Object.freeze([
    'Intervention opened from backend truth.',
    'Frontend may preview, but backend owns the window.',
  ]),
  ACCEPT: Object.freeze([
    'Accepted rescue still requires recovery validation.',
    'Acceptance is not the same as stabilization.',
  ]),
  RESOLVE: Object.freeze([
    'Resolved rescue moves into ledger truth and replay truth.',
    'Outcome kind should remain explainable from lift values.',
  ]),
  EXPIRE: Object.freeze([
    'Expiry is not always failure; silent recovery can count.',
    'Window timing remains part of the authored record.',
  ]),
});

export const RESCUE_INTERVENTION_OUTCOME_GUIDE: Readonly<Record<string, readonly string[]>> = Object.freeze({
  RESOLVED: Object.freeze([
    'Player stabilized enough to continue.',
    'Narrative pressure can resume without softening the game.',
  ]),
  ESCALATED: Object.freeze([
    'Recovery exists, but risk remains active.',
    'Use for partial improvement that still requires cover.',
  ]),
  ABANDONED: Object.freeze([
    'Rescue failed to establish traction.',
    'Do not fake success in the ledger.',
  ]),
  TIMED_OUT: Object.freeze([
    'Window expired before explicit action.',
    'Interpret through allowSilenceAsSuccess before scoring failure.',
  ]),
});

export class RescueInterventionAnalytics {
  public projectRoom(room: RescueRoomLedger, now: UnixMs): RescueInterventionProjection {
    return projectActiveIntervention(
      room.roomId,
      room.active[0] ?? null,
      room.rescueDigest,
      room.recoveryDigest,
      now,
    );
  }

  public metrics(room: RescueRoomLedger, now: UnixMs): RescueInterventionMetrics {
    return computeRoomMetrics(room, now);
  }

  public replay(room: RescueRoomLedger, query: RescueInterventionQuery): readonly RescueInterventionReplaySlice[] {
    return filterReplaySlices(room.active, query);
  }

  public summary(room: RescueRoomLedger, now: UnixMs): string {
    const metrics = this.metrics(room, now);
    return [
      `active=${metrics.activeCount}`,
      `accepted=${metrics.acceptedCount}`,
      `resolved=${metrics.resolvedCount}`,
      `timedOut=${metrics.timedOutCount}`,
      `recovered=${metrics.recoveredCount}`,
      `failed=${metrics.failedCount}`,
      `band=${metrics.latestSuccessBand ?? 'NONE'}`,
    ].join(' | ');
  }
}

export function createRescueInterventionAnalytics(): RescueInterventionAnalytics {
  return new RescueInterventionAnalytics();
}


// ============================================================================
// MARK: Cross-authority tracker projections
// ============================================================================

export interface RescueInterventionTrackerProjection {
  readonly roomId: ChatRoomId;
  readonly plannerSummary: string;
  readonly trackerSummary: string;
  readonly activeInterventions: number;
  readonly rescueDigest: ChatRescueDigest;
  readonly recoveryDigest: ChatRecoveryDigest;
  readonly notes: readonly string[];
}

export function buildRescueInterventionTrackerProjection(
  planner: RescueInterventionPlanner,
  roomId: ChatRoomId,
): RescueInterventionTrackerProjection {
  const room = planner.getRoomLedger(roomId);
  return Object.freeze({
    roomId,
    plannerSummary: planner.summarizeRoom(roomId),
    trackerSummary: 'delegated-to-recovery-outcome-tracker',
    activeInterventions: room.active.length,
    rescueDigest: room.rescueDigest,
    recoveryDigest: room.recoveryDigest,
    notes: Object.freeze([
      'Planner summary remains backend truth for rescue openings and closures.',
      'Outcome tracker summary remains backend truth for reinforcement and recovery cohorts.',
    ]),
  });
}
