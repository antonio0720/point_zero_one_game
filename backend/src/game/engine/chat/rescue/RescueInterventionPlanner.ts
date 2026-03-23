
/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT RESCUE INTERVENTION PLANNER
 * FILE: backend/src/game/engine/chat/rescue/RescueInterventionPlanner.ts
 * VERSION: 2026.03.19
 * AUTHORSHIP: Antonio T. Smith Jr.
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
  ChatRecoveryBundle,
  ChatRecoveryDigest,
  ChatRecoveryEntryPoint,
  ChatRecoveryLedgerEntry,
  ChatRecoveryOutcome,
  ChatRecoveryPlan,
  ChatRecoverySuccessBand,
  ChatRecoveryVisibility,
} from '../../../../../../shared/contracts/chat/ChatRecovery';
import {
  buildRecoveryPlan,
  createRecoveryOutcome,
  deriveRecoveryDigest,
  deriveRecoveryLiftSnapshot,
  deriveRecoverySuccessBand,
  toScore01 as toRecoveryScore01,
  toScore100 as toRecoveryScore100,
} from '../../../../../../shared/contracts/chat/ChatRecovery';
import type {
  ChatRescueAction,
  ChatRescueActor,
  ChatRescueDigest,
  ChatRescueGuardrail,
  ChatRescueHelperPosture,
  ChatRescueKind,
  ChatRescueLedgerEntry,
  ChatRescueOffer,
  ChatRescueOutcome,
  ChatRescuePlan,
  ChatRescueReasonCode,
  ChatRescueSignalVector,
  ChatRescueStateSnapshot,
  ChatRescueStyle,
  ChatRescueSuppressionReason,
  ChatRescueTelemetrySnapshot,
  ChatRescueTrigger,
  ChatRescueUrgencyBand,
  ChatRescueWindow,
} from '../../../../../../shared/contracts/chat/ChatRescue';
import {
  buildRescuePlan,
  createRescueWindow,
  deriveRescueDigest,
  deriveRescueRecoverability01,
  deriveRescueStateSnapshot,
  deriveRescueTilt01,
  deriveRescueTriggerCandidates,
  shouldSuppressRescue,
  toScore01 as toRescueScore01,
  toScore100 as toRescueScore100,
} from '../../../../../../shared/contracts/chat/ChatRescue';
import type {
  ChatAffectSnapshot,
  ChatAudienceHeat,
  ChatFeatureSnapshot,
  ChatLearningProfile,
  ChatReputationState,
} from '../../../../../../shared/contracts/chat/ChatEvents';
import type { ChatBossFightState } from '../../../../../../shared/contracts/chat/ChatBossFight';

import type {
  ChatChannelId,
  ChatEventId,
  ChatMessage,
  ChatRoomId,
  ChatRoomState,
  ChatSessionId,
  ChatSessionState,
  ChatSignalEnvelope,
  ChatState,
  ChatVisibleChannel,
  JsonValue,
  PressureTier,
  Score01,
  Score100,
  UnixMs,
} from '../types';
import {
  asUnixMs,
  clamp01,
  clamp100,
  isVisibleChannelId,
} from '../types';
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
  return {
    ledgerId: (`rescue-ledger:${String(active.rescuePlan.rescueId)}:${Number(now)}` as any),
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
    acceptedOfferId: (active.rescuePlan.selectedOffer?.offerId as any) ?? null,
    acceptedActionId: null,
    winningHelperId: active.rescuePlan.helperActor?.actorId ?? null,
    replayId: null,
    notes: active.reasons,
  } as ChatRescueLedgerEntry;
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

// ============================================================================
// MARK: Profile system
// ============================================================================

export type RescueInterventionPlannerProfile =
  | 'STANDARD'
  | 'RAPID'
  | 'PATIENT'
  | 'CINEMATIC'
  | 'FORENSIC'
  | 'MINIMAL';

export interface RescueInterventionPlannerProfileConfig {
  readonly profile: RescueInterventionPlannerProfile;
  readonly options: Partial<RescueInterventionPlannerOptions>;
  readonly description: string;
  readonly useCases: readonly string[];
}

export const RESCUE_INTERVENTION_PLANNER_PROFILE_CONFIGS: Readonly<Record<RescueInterventionPlannerProfile, RescueInterventionPlannerProfileConfig>> = Object.freeze({
  STANDARD: Object.freeze({
    profile: 'STANDARD',
    options: {},
    description: 'Default orchestration for general game rooms.',
    useCases: Object.freeze(['Standard narrative rooms', 'Default session contexts']),
  }),
  RAPID: Object.freeze({
    profile: 'RAPID',
    options: Object.freeze({
      maxActiveRescuesPerRoom: 5,
      retainLedgerEntriesPerRoom: 48,
    }),
    description: 'Allows higher active rescue density and faster ledger cycling.',
    useCases: Object.freeze(['LiveOps events', 'Faction surge sequences', 'Boss fight rooms']),
  }),
  PATIENT: Object.freeze({
    profile: 'PATIENT',
    options: Object.freeze({
      maxActiveRescuesPerRoom: 2,
      retainLedgerEntriesPerRoom: 80,
    }),
    description: 'Limits active rescues and retains longer history for helper-focused flows.',
    useCases: Object.freeze(['Onboarding rooms', 'Helper-assigned sessions', 'Tutorial contexts']),
  }),
  CINEMATIC: Object.freeze({
    profile: 'CINEMATIC',
    options: Object.freeze({
      maxActiveRescuesPerRoom: 4,
      retainLedgerEntriesPerRoom: 120,
    }),
    description: 'Extended ledger and multi-rescue support for cinematic authored beats.',
    useCases: Object.freeze(['Legend runs', 'Authored story chambers', 'World event sequences']),
  }),
  FORENSIC: Object.freeze({
    profile: 'FORENSIC',
    options: Object.freeze({
      maxActiveRescuesPerRoom: 6,
      retainLedgerEntriesPerRoom: 240,
    }),
    description: 'Maximum retention for replay review, QA, and analytics.',
    useCases: Object.freeze(['QA sessions', 'Offline analytics pipelines', 'Replay audit flows']),
  }),
  MINIMAL: Object.freeze({
    profile: 'MINIMAL',
    options: Object.freeze({
      maxActiveRescuesPerRoom: 1,
      retainLedgerEntriesPerRoom: 16,
    }),
    description: 'Minimum footprint for edge and memory-constrained contexts.',
    useCases: Object.freeze(['Edge contexts', 'Memory-constrained environments']),
  }),
});

// ============================================================================
// MARK: Extended diagnostic contracts
// ============================================================================

export interface RescueInterventionAuditEntry {
  readonly roomId: string;
  readonly rescueId: string;
  readonly recoveryId: string;
  readonly eventKind: 'OPENED' | 'ACCEPTED' | 'RESOLVED' | 'EXPIRED' | 'SUPPRESSED';
  readonly recordedAt: UnixMs;
  readonly urgency: string | null;
  readonly style: string | null;
  readonly visibleChannel: string | null;
  readonly outcome: string | null;
  readonly successBand: ChatRecoverySuccessBand | null;
  readonly windowHealth01: Score01;
  readonly notes: readonly string[];
}

export interface RescueInterventionAuditReport {
  readonly generatedAt: UnixMs;
  readonly roomCount: number;
  readonly totalEntries: number;
  readonly openedCount: number;
  readonly acceptedCount: number;
  readonly resolvedCount: number;
  readonly expiredCount: number;
  readonly suppressedCount: number;
  readonly urgencyBreakdown: Readonly<Record<string, number>>;
  readonly channelBreakdown: Readonly<Record<string, number>>;
  readonly successBandBreakdown: Readonly<Record<ChatRecoverySuccessBand, number>>;
  readonly averageWindowHealth01: Score01;
  readonly entries: readonly RescueInterventionAuditEntry[];
}

export interface RescueInterventionDiff {
  readonly roomId: string;
  readonly before: RescueInterventionMetrics;
  readonly after: RescueInterventionMetrics;
  readonly activeCountDelta: number;
  readonly resolvedCountDelta: number;
  readonly recoveredCountDelta: number;
  readonly notes: readonly string[];
}

export interface RescueInterventionStatsSummary {
  readonly snapshotAt: UnixMs;
  readonly rooms: readonly string[];
  readonly totalActiveInterventions: number;
  readonly totalRescueEntries: number;
  readonly totalRecoveryEntries: number;
  readonly globalAcceptedCount: number;
  readonly globalResolvedCount: number;
  readonly globalTimedOutCount: number;
  readonly globalRecoveredCount: number;
  readonly latestSuccessBand: ChatRecoverySuccessBand | null;
  readonly highRiskRooms: readonly string[];
  readonly stableRooms: readonly string[];
}

export interface RescueInterventionBatchEvaluateRequest {
  readonly requests: readonly RescueInterventionPlanRequest[];
  readonly stopOnFirstOpened?: boolean;
}

export interface RescueInterventionBatchEvaluateResult {
  readonly results: readonly RescueInterventionPlannerResult[];
  readonly openedCount: number;
  readonly suppressedCount: number;
  readonly firstOpenedIndex: number | null;
  readonly highestUrgencyIndex: number | null;
}

// ============================================================================
// MARK: Audit and stats builders
// ============================================================================

export function buildPlannerAuditReport(
  planner: RescueInterventionPlanner,
  roomIds: readonly ChatRoomId[],
  now: UnixMs,
): RescueInterventionAuditReport {
  const urgencyBreakdown: Record<string, number> = {};
  const channelBreakdown: Record<string, number> = {};
  const successBandBreakdown: Record<ChatRecoverySuccessBand, number> = {
    NO_LIFT: 0, SMALL_LIFT: 0, CLEAR_LIFT: 0, STRONG_LIFT: 0, RUN_SAVED: 0,
  };
  const entries: RescueInterventionAuditEntry[] = [];
  let openedCount = 0;
  let acceptedCount = 0;
  let resolvedCount = 0;
  let expiredCount = 0;
  let suppressedCount = 0;
  let totalWindowHealth = 0;
  let windowHealthCount = 0;

  for (const roomId of roomIds) {
    const room = planner.getRoomLedger(roomId);
    const metrics = computeRoomMetrics(room, now);

    openedCount += room.active.length;
    acceptedCount += metrics.acceptedCount;
    resolvedCount += metrics.resolvedCount;
    expiredCount += metrics.timedOutCount;
    suppressedCount += 0;

    for (const active of room.active) {
      const urgency = active.rescuePlan.urgency;
      urgencyBreakdown[urgency] = (urgencyBreakdown[urgency] ?? 0) + 1;
      const channel = active.rescuePlan.visibleChannel;
      channelBreakdown[channel] = (channelBreakdown[channel] ?? 0) + 1;
      const health = projectRescueWindowHealth(active, now);
      totalWindowHealth += Number(health);
      windowHealthCount++;

      entries.push(Object.freeze({
        roomId: String(roomId),
        rescueId: String(active.rescuePlan.rescueId),
        recoveryId: String(active.recoveryPlan.recoveryId),
        eventKind: 'OPENED',
        recordedAt: active.openedAt,
        urgency,
        style: active.rescuePlan.style,
        visibleChannel: channel,
        outcome: active.rescuePlan.state,
        successBand: active.predictedOutcome?.successBand ?? null,
        windowHealth01: health,
        notes: active.reasons,
      }));
    }

    for (const entry of room.rescueLedger) {
      const outcome = entry.outcome;
      if (outcome === 'ACCEPTED') acceptedCount++;
      else if (outcome === 'RESOLVED') resolvedCount++;
      else if (outcome === 'TIMED_OUT') expiredCount++;
      else if (outcome === 'SUPPRESSED') suppressedCount++;
      if (entry.urgency) urgencyBreakdown[entry.urgency] = (urgencyBreakdown[entry.urgency] ?? 0) + 1;
    }

    for (const entry of room.recoveryLedger) {
      const band = entry.successBand;
      successBandBreakdown[band] = (successBandBreakdown[band] ?? 0) + 1;
    }
  }

  return Object.freeze({
    generatedAt: now,
    roomCount: roomIds.length,
    totalEntries: entries.length,
    openedCount,
    acceptedCount,
    resolvedCount,
    expiredCount,
    suppressedCount,
    urgencyBreakdown: Object.freeze(urgencyBreakdown),
    channelBreakdown: Object.freeze(channelBreakdown),
    successBandBreakdown: Object.freeze(successBandBreakdown),
    averageWindowHealth01: (windowHealthCount > 0 ? totalWindowHealth / windowHealthCount : 0) as Score01,
    entries: Object.freeze(entries),
  });
}

export function buildPlannerStatsSummary(
  planner: RescueInterventionPlanner,
  roomIds: readonly ChatRoomId[],
  now: UnixMs,
): RescueInterventionStatsSummary {
  let totalActive = 0;
  let totalRescueEntries = 0;
  let totalRecoveryEntries = 0;
  let globalAccepted = 0;
  let globalResolved = 0;
  let globalTimedOut = 0;
  let globalRecovered = 0;
  const highRiskRooms: string[] = [];
  const stableRooms: string[] = [];
  let latestBand: ChatRecoverySuccessBand | null = null;
  const bandRank: Record<ChatRecoverySuccessBand, number> = {
    NO_LIFT: 0, SMALL_LIFT: 1, CLEAR_LIFT: 2, STRONG_LIFT: 3, RUN_SAVED: 4,
  };

  for (const roomId of roomIds) {
    const room = planner.getRoomLedger(roomId);
    const metrics = computeRoomMetrics(room, now);
    totalActive += metrics.activeCount;
    totalRescueEntries += metrics.totalRescueEntries;
    totalRecoveryEntries += metrics.totalRecoveryEntries;
    globalAccepted += metrics.acceptedCount;
    globalResolved += metrics.resolvedCount;
    globalTimedOut += metrics.timedOutCount;
    globalRecovered += metrics.recoveredCount;

    if (metrics.activeCount > 0 && Number(metrics.averageProjectedHealth01) < 0.30) {
      highRiskRooms.push(String(roomId));
    }
    if (metrics.resolvedCount > 0 && metrics.timedOutCount === 0 && metrics.failedCount === 0) {
      stableRooms.push(String(roomId));
    }

    const band = metrics.latestSuccessBand;
    if (band && (latestBand === null || bandRank[band] > bandRank[latestBand])) {
      latestBand = band;
    }
  }

  return Object.freeze({
    snapshotAt: now,
    rooms: Object.freeze(roomIds.map(String)),
    totalActiveInterventions: totalActive,
    totalRescueEntries,
    totalRecoveryEntries,
    globalAcceptedCount: globalAccepted,
    globalResolvedCount: globalResolved,
    globalTimedOutCount: globalTimedOut,
    globalRecoveredCount: globalRecovered,
    latestSuccessBand: latestBand,
    highRiskRooms: Object.freeze(highRiskRooms),
    stableRooms: Object.freeze(stableRooms),
  });
}

export function computePlannerDiff(
  planner: RescueInterventionPlanner,
  roomId: ChatRoomId,
  before: RescueInterventionMetrics,
  now: UnixMs,
): RescueInterventionDiff {
  const room = planner.getRoomLedger(roomId);
  const after = computeRoomMetrics(room, now);
  const notes: string[] = [];
  if (after.resolvedCount > before.resolvedCount) {
    notes.push(`+${after.resolvedCount - before.resolvedCount} resolved`);
  }
  if (after.recoveredCount > before.recoveredCount) {
    notes.push(`+${after.recoveredCount - before.recoveredCount} recovered`);
  }
  if (after.timedOutCount > before.timedOutCount) {
    notes.push(`+${after.timedOutCount - before.timedOutCount} timed-out`);
  }
  return Object.freeze({
    roomId: String(roomId),
    before,
    after,
    activeCountDelta: after.activeCount - before.activeCount,
    resolvedCountDelta: after.resolvedCount - before.resolvedCount,
    recoveredCountDelta: after.recoveredCount - before.recoveredCount,
    notes: Object.freeze(notes),
  });
}

// ============================================================================
// MARK: Batch evaluation
// ============================================================================

export function batchEvaluatePlannerRequests(
  planner: RescueInterventionPlanner,
  batch: RescueInterventionBatchEvaluateRequest,
): RescueInterventionBatchEvaluateResult {
  const results: RescueInterventionPlannerResult[] = [];
  let openedCount = 0;
  let suppressedCount = 0;
  let firstOpenedIndex: number | null = null;
  let highestUrgencyIndex: number | null = null;
  const urgencyRank: Record<string, number> = { WATCH: 1, READY: 2, IMMEDIATE: 3, CRITICAL: 4 };
  let peakUrgencyRank = 0;

  for (let i = 0; i < batch.requests.length; i++) {
    const result = planner.evaluate(batch.requests[i]);
    results.push(result);

    const rank = urgencyRank[result.decision.risk.urgency] ?? 0;
    if (rank > peakUrgencyRank) {
      peakUrgencyRank = rank;
      highestUrgencyIndex = i;
    }

    if (result.opened) {
      openedCount++;
      if (firstOpenedIndex === null) firstOpenedIndex = i;
      if (batch.stopOnFirstOpened) break;
    } else {
      suppressedCount++;
    }
  }

  return Object.freeze({
    results: Object.freeze(results),
    openedCount,
    suppressedCount,
    firstOpenedIndex,
    highestUrgencyIndex,
  });
}

// ============================================================================
// MARK: Cross-room intervention management
// ============================================================================

export interface RescueInterventionCrossRoomSnapshot {
  readonly totalActive: number;
  readonly totalRescueEntries: number;
  readonly totalRecoveryEntries: number;
  readonly roomSummaries: readonly { roomId: string; activeCount: number; latestBand: ChatRecoverySuccessBand | null }[];
  readonly criticalRooms: readonly string[];
  readonly stableRooms: readonly string[];
}

export function buildCrossRoomSnapshot(
  planner: RescueInterventionPlanner,
  roomIds: readonly ChatRoomId[],
  now: UnixMs,
): RescueInterventionCrossRoomSnapshot {
  let totalActive = 0;
  let totalRescueEntries = 0;
  let totalRecoveryEntries = 0;
  const roomSummaries: Array<{ roomId: string; activeCount: number; latestBand: ChatRecoverySuccessBand | null }> = [];
  const criticalRooms: string[] = [];
  const stableRooms: string[] = [];

  for (const roomId of roomIds) {
    const room = planner.getRoomLedger(roomId);
    const metrics = computeRoomMetrics(room, now);
    totalActive += metrics.activeCount;
    totalRescueEntries += metrics.totalRescueEntries;
    totalRecoveryEntries += metrics.totalRecoveryEntries;
    roomSummaries.push({ roomId: String(roomId), activeCount: metrics.activeCount, latestBand: metrics.latestSuccessBand ?? null });

    const hasCritical = room.active.some((a) => a.rescuePlan.urgency === 'CRITICAL');
    if (hasCritical) criticalRooms.push(String(roomId));
    else if (metrics.resolvedCount > 0 && metrics.failedCount === 0) stableRooms.push(String(roomId));
  }

  return Object.freeze({
    totalActive,
    totalRescueEntries,
    totalRecoveryEntries,
    roomSummaries: Object.freeze(roomSummaries),
    criticalRooms: Object.freeze(criticalRooms),
    stableRooms: Object.freeze(stableRooms),
  });
}

export function listCriticalActiveInterventions(
  planner: RescueInterventionPlanner,
  roomIds: readonly ChatRoomId[],
  now: UnixMs,
): readonly ActiveRescueIntervention[] {
  const results: ActiveRescueIntervention[] = [];
  for (const roomId of roomIds) {
    const active = planner.listActive(roomId);
    for (const intervention of active) {
      if (intervention.rescuePlan.urgency === 'CRITICAL' && interventionIsStillActive(intervention, now)) {
        results.push(intervention);
      }
    }
  }
  results.sort((a, b) => Number(a.rescueWindow.closesAt) - Number(b.rescueWindow.closesAt));
  return Object.freeze(results);
}

export function buildWindowHealthMap(
  planner: RescueInterventionPlanner,
  roomIds: readonly ChatRoomId[],
  now: UnixMs,
): Readonly<Record<string, Score01>> {
  const map: Record<string, Score01> = {};
  for (const roomId of roomIds) {
    const active = planner.listActive(roomId);
    if (active.length === 0) {
      map[String(roomId)] = 0 as Score01;
      continue;
    }
    const avg = active.reduce((s, a) => s + Number(projectRescueWindowHealth(a, now)), 0) / active.length;
    map[String(roomId)] = Math.max(0, Math.min(1, avg)) as Score01;
  }
  return Object.freeze(map);
}

// ============================================================================
// MARK: Intervention timeline and narrative
// ============================================================================

export interface RescueInterventionTimelineEntry {
  readonly rescueId: string;
  readonly recoveryId: string;
  readonly roomId: string;
  readonly openedAt: UnixMs;
  readonly urgency: string;
  readonly kind: string;
  readonly channel: string;
  readonly outcome: string | null;
  readonly successBand: ChatRecoverySuccessBand | null;
  readonly durationEstimateMs: number;
}

export function buildInterventionTimeline(
  room: RescueRoomLedger,
  now: UnixMs,
): readonly RescueInterventionTimelineEntry[] {
  const entries: RescueInterventionTimelineEntry[] = [];

  for (const ledgerEntry of room.rescueLedger) {
    entries.push(Object.freeze({
      rescueId: String(ledgerEntry.rescueId),
      recoveryId: String((ledgerEntry as any).recoveryId ?? ''),
      roomId: String(room.roomId),
      openedAt: ledgerEntry.createdAt,
      urgency: ledgerEntry.urgency,
      kind: ledgerEntry.reasonCode,
      channel: ledgerEntry.visibleChannel,
      outcome: ledgerEntry.outcome,
      successBand: null,
      durationEstimateMs: Math.max(0, Number(ledgerEntry.updatedAt) - Number(ledgerEntry.createdAt)),
    }));
  }

  for (const active of room.active) {
    entries.push(Object.freeze({
      rescueId: String(active.rescuePlan.rescueId),
      recoveryId: String(active.recoveryPlan.recoveryId),
      roomId: String(room.roomId),
      openedAt: active.openedAt,
      urgency: active.rescuePlan.urgency,
      kind: active.rescuePlan.kind,
      channel: active.rescuePlan.visibleChannel,
      outcome: active.rescuePlan.state,
      successBand: active.predictedOutcome?.successBand ?? null,
      durationEstimateMs: Math.max(0, Number(now) - Number(active.openedAt)),
    }));
  }

  entries.sort((a, b) => Number(a.openedAt) - Number(b.openedAt));
  return Object.freeze(entries);
}

export function buildRescueNarrativeSummary(
  planner: RescueInterventionPlanner,
  roomId: ChatRoomId,
  now: UnixMs,
): string {
  const room = planner.getRoomLedger(roomId);
  const metrics = computeRoomMetrics(room, now);
  const projection = projectActiveIntervention(roomId, room.active[0] ?? null, room.rescueDigest, room.recoveryDigest, now);
  return [
    `active=${metrics.activeCount}`,
    `accepted=${metrics.acceptedCount}`,
    `resolved=${metrics.resolvedCount}`,
    `timedOut=${metrics.timedOutCount}`,
    `recovered=${metrics.recoveredCount}`,
    `failed=${metrics.failedCount}`,
    `band=${metrics.latestSuccessBand ?? 'NONE'}`,
    `windowHealth=${Number(projection.windowHealth01).toFixed(2)}`,
    `urgency=${projection.urgency ?? 'NONE'}`,
    `channel=${projection.channel ?? 'NONE'}`,
  ].join(' | ');
}

// ============================================================================
// MARK: Serialization helpers
// ============================================================================

export function serializePlannerResult(result: RescueInterventionPlannerResult): Readonly<Record<string, unknown>> {
  return Object.freeze({
    opened: result.opened,
    suppressed: result.suppressed,
    expired: result.expired,
    shouldIntervene: result.decision.shouldIntervene,
    churnRisk01: Number(result.decision.risk.churnRisk01).toFixed(3),
    urgency: result.decision.risk.urgency,
    reasonCode: result.decision.risk.reasonTrail.reasonCode,
    suppressionReason: result.decision.risk.reasonTrail.suppressionReason ?? null,
    rescueId: result.active?.rescuePlan.rescueId ? String(result.active.rescuePlan.rescueId) : null,
    recoveryId: result.active?.recoveryPlan.recoveryId ? String(result.active.recoveryPlan.recoveryId) : null,
    urgencyLevel: result.active?.rescuePlan.urgency ?? null,
    predictedBand: result.active?.predictedOutcome?.successBand ?? null,
    noteCount: result.notes.length,
    firstNote: result.notes[0] ?? null,
  });
}

export function buildPlannerRoomNarrative(room: RescueRoomLedger, now: UnixMs): string {
  const metrics = computeRoomMetrics(room, now);
  return [
    `active=${metrics.activeCount}`,
    `accepted=${metrics.acceptedCount}`,
    `resolved=${metrics.resolvedCount}`,
    `timedOut=${metrics.timedOutCount}`,
    `recovered=${metrics.recoveredCount}`,
    `band=${metrics.latestSuccessBand ?? 'NONE'}`,
  ].join(' | ');
}

// ============================================================================
// MARK: Profile-aware extended factory
// ============================================================================

export interface RescueInterventionPlannerExtended {
  readonly planner: RescueInterventionPlanner;
  readonly profile: RescueInterventionPlannerProfile;
  evaluate(request: RescueInterventionPlanRequest): RescueInterventionPlannerResult;
  acceptAction(request: RescueAcceptActionRequest): RescueRoomLedger;
  resolve(request: RescueResolveRequest): RescueRoomLedger;
  expire(request: RescueExpireRequest): RescueRoomLedger;
  getRoomLedger(roomId: ChatRoomId): RescueRoomLedger;
  listActive(roomId: ChatRoomId): readonly ActiveRescueIntervention[];
  summarizeRoom(roomId: ChatRoomId): string;
  batchEvaluate(batch: RescueInterventionBatchEvaluateRequest): RescueInterventionBatchEvaluateResult;
  buildAuditReport(roomIds: readonly ChatRoomId[], now: UnixMs): RescueInterventionAuditReport;
  buildStatsSummary(roomIds: readonly ChatRoomId[], now: UnixMs): RescueInterventionStatsSummary;
  computeDiff(roomId: ChatRoomId, before: RescueInterventionMetrics, now: UnixMs): RescueInterventionDiff;
  buildCrossRoomSnapshot(roomIds: readonly ChatRoomId[], now: UnixMs): RescueInterventionCrossRoomSnapshot;
  buildTimeline(roomId: ChatRoomId, now: UnixMs): readonly RescueInterventionTimelineEntry[];
  narrativeSummary(roomId: ChatRoomId, now: UnixMs): string;
  serializeResult(result: RescueInterventionPlannerResult): Readonly<Record<string, unknown>>;
  toJSON(): Readonly<{ profile: RescueInterventionPlannerProfile; profileConfig: RescueInterventionPlannerProfileConfig }>;
}

export function createRescueInterventionPlannerFromProfile(
  profile: RescueInterventionPlannerProfile,
  extraOptions: Omit<RescueInterventionPlannerOptions, 'maxActiveRescuesPerRoom' | 'retainLedgerEntriesPerRoom'> = {},
): RescueInterventionPlannerExtended {
  const profileConfig = RESCUE_INTERVENTION_PLANNER_PROFILE_CONFIGS[profile];
  const planner = createRescueInterventionPlanner({ ...extraOptions, ...profileConfig.options });
  return Object.freeze({
    planner,
    profile,
    evaluate: (r) => planner.evaluate(r),
    acceptAction: (r) => planner.acceptAction(r),
    resolve: (r) => planner.resolve(r),
    expire: (r) => planner.expire(r),
    getRoomLedger: (roomId) => planner.getRoomLedger(roomId),
    listActive: (roomId) => planner.listActive(roomId),
    summarizeRoom: (roomId) => planner.summarizeRoom(roomId),
    batchEvaluate: (batch) => batchEvaluatePlannerRequests(planner, batch),
    buildAuditReport: (roomIds, now) => buildPlannerAuditReport(planner, roomIds, now),
    buildStatsSummary: (roomIds, now) => buildPlannerStatsSummary(planner, roomIds, now),
    computeDiff: (roomId, before, now) => computePlannerDiff(planner, roomId, before, now),
    buildCrossRoomSnapshot: (roomIds, now) => buildCrossRoomSnapshot(planner, roomIds, now),
    buildTimeline: (roomId, now) => buildInterventionTimeline(planner.getRoomLedger(roomId), now),
    narrativeSummary: (roomId, now) => buildRescueNarrativeSummary(planner, roomId, now),
    serializeResult: (result) => serializePlannerResult(result),
    toJSON: () => Object.freeze({ profile, profileConfig }),
  });
}

// ============================================================================
// MARK: Named profile factories
// ============================================================================

export function createStandardRescueInterventionPlanner(options: Omit<RescueInterventionPlannerOptions, 'maxActiveRescuesPerRoom' | 'retainLedgerEntriesPerRoom'> = {}): RescueInterventionPlannerExtended {
  return createRescueInterventionPlannerFromProfile('STANDARD', options);
}

export function createRapidRescueInterventionPlanner(options: Omit<RescueInterventionPlannerOptions, 'maxActiveRescuesPerRoom' | 'retainLedgerEntriesPerRoom'> = {}): RescueInterventionPlannerExtended {
  return createRescueInterventionPlannerFromProfile('RAPID', options);
}

export function createPatientRescueInterventionPlanner(options: Omit<RescueInterventionPlannerOptions, 'maxActiveRescuesPerRoom' | 'retainLedgerEntriesPerRoom'> = {}): RescueInterventionPlannerExtended {
  return createRescueInterventionPlannerFromProfile('PATIENT', options);
}

export function createCinematicRescueInterventionPlanner(options: Omit<RescueInterventionPlannerOptions, 'maxActiveRescuesPerRoom' | 'retainLedgerEntriesPerRoom'> = {}): RescueInterventionPlannerExtended {
  return createRescueInterventionPlannerFromProfile('CINEMATIC', options);
}

export function createForensicRescueInterventionPlanner(options: Omit<RescueInterventionPlannerOptions, 'maxActiveRescuesPerRoom' | 'retainLedgerEntriesPerRoom'> = {}): RescueInterventionPlannerExtended {
  return createRescueInterventionPlannerFromProfile('FORENSIC', options);
}

export function createMinimalRescueInterventionPlanner(options: Omit<RescueInterventionPlannerOptions, 'maxActiveRescuesPerRoom' | 'retainLedgerEntriesPerRoom'> = {}): RescueInterventionPlannerExtended {
  return createRescueInterventionPlannerFromProfile('MINIMAL', options);
}

// ============================================================================
// MARK: RescueInterventionAnalytics
// ============================================================================

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
// MARK: RescueInterventionPlannerModule — combined barrel export
// ============================================================================

export const RescueInterventionPlannerModule = Object.freeze({
  // Core class + factory
  RescueInterventionPlanner,
  createRescueInterventionPlanner,

  // Profile system
  createFromProfile: createRescueInterventionPlannerFromProfile,
  createStandard: createStandardRescueInterventionPlanner,
  createRapid: createRapidRescueInterventionPlanner,
  createPatient: createPatientRescueInterventionPlanner,
  createCinematic: createCinematicRescueInterventionPlanner,
  createForensic: createForensicRescueInterventionPlanner,
  createMinimal: createMinimalRescueInterventionPlanner,

  // Analytics class + factory
  RescueInterventionAnalytics,
  createRescueInterventionAnalytics,

  // Batch ops
  batchEvaluate: batchEvaluatePlannerRequests,

  // Audit + stats
  buildAuditReport: buildPlannerAuditReport,
  buildStatsSummary: buildPlannerStatsSummary,
  computeDiff: computePlannerDiff,

  // Cross-room
  buildCrossRoomSnapshot,
  listCriticalActiveInterventions,
  buildWindowHealthMap,

  // Timeline + narrative
  buildTimeline: buildInterventionTimeline,
  buildNarrativeSummary: buildRescueNarrativeSummary,
  buildRoomNarrative: buildPlannerRoomNarrative,
  buildTrackerProjection: buildRescueInterventionTrackerProjection,

  // Serialization
  serializeResult: serializePlannerResult,

  // Static helpers
  interventionWouldLikelySaveRun,
  interventionIsStillActive,
  projectWindowHealth: projectRescueWindowHealth,
  listExpiringSoon,
  projectActiveIntervention,
  toReplaySlice,
  summarizeRecoveryBand,
  computeRoomMetrics,
  filterReplaySlices,

  // Data tables
  PROFILES: RESCUE_INTERVENTION_PLANNER_PROFILE_CONFIGS,
  NOTES: RESCUE_INTERVENTION_NOTES,
  OUTCOME_GUIDE: RESCUE_INTERVENTION_OUTCOME_GUIDE,
} as const);

// ============================================================================
// MARK: Intervention validation
// ============================================================================

export function validatePlannerRequest(request: RescueInterventionPlanRequest): readonly string[] {
  const errors: string[] = [];
  if (!request.roomId) errors.push('roomId is required');
  if (!request.sessionId) errors.push('sessionId is required');
  if (!request.channelId) errors.push('channelId is required');
  if (!request.playerId) errors.push('playerId is required');
  if (!request.state) errors.push('ChatState is required');
  if (!request.room) errors.push('ChatRoomState is required');
  if (!request.session) errors.push('ChatSessionState is required');
  return Object.freeze(errors);
}

export function validatePlannerResult(result: RescueInterventionPlannerResult): readonly string[] {
  const errors: string[] = [];
  if (result.opened && !result.active) errors.push('opened=true but active is null');
  if (result.opened && result.suppressed) errors.push('opened=true and suppressed=true simultaneously');
  if (result.expired && result.opened) errors.push('expired=true and opened=true simultaneously');
  return Object.freeze(errors);
}

// ============================================================================
// MARK: Window expiry projection
// ============================================================================

export interface RescueWindowExpiryProjection {
  readonly rescueId: string;
  readonly roomId: string;
  readonly urgency: string;
  readonly closesAt: UnixMs;
  readonly remainingMs: number;
  readonly windowHealth01: Score01;
  readonly isExpiring: boolean;
  readonly isExpired: boolean;
}

export function projectWindowExpiry(
  active: ActiveRescueIntervention,
  now: UnixMs,
  expiryThresholdMs = 2500,
): RescueWindowExpiryProjection {
  const remainingMs = Math.max(0, Number(active.rescueWindow.closesAt) - Number(now));
  return Object.freeze({
    rescueId: String(active.rescuePlan.rescueId),
    roomId: String(active.rescuePlan.roomId),
    urgency: active.rescuePlan.urgency,
    closesAt: active.rescueWindow.closesAt,
    remainingMs,
    windowHealth01: projectRescueWindowHealth(active, now),
    isExpiring: remainingMs > 0 && remainingMs <= expiryThresholdMs,
    isExpired: remainingMs <= 0,
  });
}

export function buildWindowExpiryReport(
  planner: RescueInterventionPlanner,
  roomIds: readonly ChatRoomId[],
  now: UnixMs,
  expiryThresholdMs = 2500,
): readonly RescueWindowExpiryProjection[] {
  const projections: RescueWindowExpiryProjection[] = [];
  for (const roomId of roomIds) {
    const active = planner.listActive(roomId);
    for (const intervention of active) {
      projections.push(projectWindowExpiry(intervention, now, expiryThresholdMs));
    }
  }
  projections.sort((a, b) => a.remainingMs - b.remainingMs);
  return Object.freeze(projections);
}

// ============================================================================
// MARK: Ledger query helpers
// ============================================================================

export function queryRescueLedger(
  room: RescueRoomLedger,
  query: RescueInterventionQuery,
): readonly ChatRescueLedgerEntry[] {
  const since = query.since ? Number(query.since) : null;
  const limit = query.limit ? Math.max(1, Number(query.limit)) : 50;
  return Object.freeze(
    room.rescueLedger
      .filter((entry) => {
        if (query.outcome && entry.outcome !== query.outcome) return false;
        if (query.visibleChannel && entry.visibleChannel !== query.visibleChannel) return false;
        if (since !== null && Number(entry.createdAt) < since) return false;
        return true;
      })
      .slice(0, limit),
  );
}

export function queryRecoveryLedger(
  room: RescueRoomLedger,
  query: RescueInterventionQuery,
): readonly ChatRecoveryLedgerEntry[] {
  const since = query.since ? Number(query.since) : null;
  const limit = query.limit ? Math.max(1, Number(query.limit)) : 50;
  return Object.freeze(
    room.recoveryLedger
      .filter((entry) => {
        if (query.successBand && entry.successBand !== query.successBand) return false;
        if (since !== null && Number(entry.createdAt) < since) return false;
        return true;
      })
      .slice(0, limit),
  );
}

// ============================================================================
// MARK: Intervention freshness scoring
// ============================================================================

export function scoreInterventionFreshness(active: ActiveRescueIntervention, now: UnixMs): Score01 {
  const ageMs = Math.max(0, Number(now) - Number(active.openedAt));
  const halfLifeMs = 10_000;
  const freshness = Math.pow(0.5, ageMs / halfLifeMs);
  return Math.max(0, Math.min(1, freshness)) as Score01;
}

export function sortActiveByFreshness(
  active: readonly ActiveRescueIntervention[],
  now: UnixMs,
): readonly ActiveRescueIntervention[] {
  return Object.freeze([...active].sort((a, b) => Number(b.openedAt) - Number(a.openedAt)));
}

export function sortActiveByUrgency(
  active: readonly ActiveRescueIntervention[],
): readonly ActiveRescueIntervention[] {
  const rank: Record<string, number> = { WATCH: 1, READY: 2, IMMEDIATE: 3, CRITICAL: 4 };
  return Object.freeze([...active].sort((a, b) =>
    (rank[b.rescuePlan.urgency] ?? 0) - (rank[a.rescuePlan.urgency] ?? 0),
  ));
}

// ============================================================================
// MARK: Planner health monitoring
// ============================================================================

export interface PlannerHealthSnapshot {
  readonly roomId: string;
  readonly activeCount: number;
  readonly criticalCount: number;
  readonly averageWindowHealth01: Score01;
  readonly hasCritical: boolean;
  readonly hasExpiringWindow: boolean;
  readonly latestSuccessBand: ChatRecoverySuccessBand | null;
}

export function buildPlannerHealthSnapshot(
  planner: RescueInterventionPlanner,
  roomId: ChatRoomId,
  now: UnixMs,
  expiryThresholdMs = 2500,
): PlannerHealthSnapshot {
  const room = planner.getRoomLedger(roomId);
  const active = planner.listActive(roomId);
  const criticalCount = active.filter((a) => a.rescuePlan.urgency === 'CRITICAL').length;
  const totalHealth = active.reduce((s, a) => s + Number(projectRescueWindowHealth(a, now)), 0);
  const expiring = listExpiringSoon(active, now, expiryThresholdMs);
  const metrics = computeRoomMetrics(room, now);
  return Object.freeze({
    roomId: String(roomId),
    activeCount: active.length,
    criticalCount,
    averageWindowHealth01: (active.length > 0 ? totalHealth / active.length : 0) as Score01,
    hasCritical: criticalCount > 0,
    hasExpiringWindow: expiring.length > 0,
    latestSuccessBand: metrics.latestSuccessBand ?? null,
  });
}

export function buildMultiRoomHealthMap(
  planner: RescueInterventionPlanner,
  roomIds: readonly ChatRoomId[],
  now: UnixMs,
): readonly PlannerHealthSnapshot[] {
  return Object.freeze(roomIds.map((roomId) => buildPlannerHealthSnapshot(planner, roomId, now)));
}

// ============================================================================
// MARK: Ledger compaction helpers
// ============================================================================

export function groupLedgerByOutcome(
  entries: readonly ChatRescueLedgerEntry[],
): Readonly<Record<string, readonly ChatRescueLedgerEntry[]>> {
  const grouped: Record<string, ChatRescueLedgerEntry[]> = {};
  for (const entry of entries) {
    const key = entry.outcome;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(entry);
  }
  const frozen: Record<string, readonly ChatRescueLedgerEntry[]> = {};
  for (const key of Object.keys(grouped)) {
    frozen[key] = Object.freeze(grouped[key]);
  }
  return Object.freeze(frozen);
}

export function groupRecoveryLedgerByBand(
  entries: readonly ChatRecoveryLedgerEntry[],
): Readonly<Record<ChatRecoverySuccessBand, readonly ChatRecoveryLedgerEntry[]>> {
  const grouped: Partial<Record<ChatRecoverySuccessBand, ChatRecoveryLedgerEntry[]>> = {};
  for (const entry of entries) {
    const band = entry.successBand;
    if (!grouped[band]) grouped[band] = [];
    grouped[band]!.push(entry);
  }
  const frozen: Partial<Record<ChatRecoverySuccessBand, readonly ChatRecoveryLedgerEntry[]>> = {};
  for (const key of Object.keys(grouped) as ChatRecoverySuccessBand[]) {
    frozen[key] = Object.freeze(grouped[key]!);
  }
  return Object.freeze(frozen) as Readonly<Record<ChatRecoverySuccessBand, readonly ChatRecoveryLedgerEntry[]>>;
}

// ============================================================================
// MARK: Cross-planner / multi-instance helpers
// ============================================================================

export function mergeRoomLedgers(ledgers: readonly RescueRoomLedger[]): {
  readonly totalActive: number;
  readonly totalRescueEntries: number;
  readonly totalRecoveryEntries: number;
  readonly allRoomIds: readonly string[];
} {
  let totalActive = 0;
  let totalRescueEntries = 0;
  let totalRecoveryEntries = 0;
  const allRoomIds: string[] = [];
  for (const ledger of ledgers) {
    totalActive += ledger.active.length;
    totalRescueEntries += ledger.rescueLedger.length;
    totalRecoveryEntries += ledger.recoveryLedger.length;
    allRoomIds.push(String(ledger.roomId));
  }
  return Object.freeze({
    totalActive,
    totalRescueEntries,
    totalRecoveryEntries,
    allRoomIds: Object.freeze(allRoomIds),
  });
}

// ============================================================================
// MARK: Authored intervention doctrine notes
// ============================================================================

export const RESCUE_INTERVENTION_DOCTRINE: Readonly<Record<string, readonly string[]>> = Object.freeze({
  WINDOW_OWNERSHIP: Object.freeze([
    'Backend owns the rescue window entirely.',
    'Frontend may mirror, preview, or animate but never set window truth.',
    'Window expiry must be resolved by a backend clock, not a client timer.',
  ]),
  LEDGER_TRUTH: Object.freeze([
    'Every rescue event — open, accept, resolve, expire — is recorded in the ledger.',
    'Ledger truth must remain stable after the fact, even if frontend state diverges.',
    'Replay and analytics read ledger truth, not live state.',
  ]),
  OUTCOME_OWNERSHIP: Object.freeze([
    'Recovery outcomes belong to the backend.',
    'A frontend visual confirmation is not a recovery outcome.',
    'Stabilization must be inferred from backend lift values, not player self-report.',
  ]),
  SUPPRESSION_LAW: Object.freeze([
    'Suppression is a legitimate authored result.',
    'If the planner decides not to open a rescue window, that decision is final until the next evaluation.',
    'Suppression reason must survive in the decision notes for replay.',
  ]),
  MULTI_ROOM: Object.freeze([
    'The planner is stateful per-room, not per-player.',
    'Multiple active rescues per room are valid up to maxActiveRescuesPerRoom.',
    'Cross-room snapshot helpers exist for orchestration layers above the planner.',
  ]),
});

// ============================================================================
// MARK: Intervention result classification
// ============================================================================

export function classifyPlannerResult(result: RescueInterventionPlannerResult): 'OPENED' | 'SUPPRESSED' | 'DUPLICATE' | 'EXPIRED' {
  if (result.expired) return 'EXPIRED';
  if (result.opened) return 'OPENED';
  if (result.suppressed) return 'SUPPRESSED';
  return 'DUPLICATE';
}

export function plannerResultIsActionable(result: RescueInterventionPlannerResult): boolean {
  return result.opened && result.active !== null;
}

export function plannerResultShouldNotify(result: RescueInterventionPlannerResult, urgencyThreshold: 'READY' | 'IMMEDIATE' | 'CRITICAL' = 'IMMEDIATE'): boolean {
  if (!result.opened || !result.active) return false;
  const urgencyRank: Record<string, number> = { WATCH: 1, READY: 2, IMMEDIATE: 3, CRITICAL: 4 };
  const rank = urgencyRank[result.active.rescuePlan.urgency] ?? 0;
  const threshold = urgencyRank[urgencyThreshold] ?? 3;
  return rank >= threshold;
}

export function plannerResultSummary(result: RescueInterventionPlannerResult): string {
  const classification = classifyPlannerResult(result);
  const urgency = result.active?.rescuePlan.urgency ?? result.decision.risk.urgency;
  const band = result.active?.predictedOutcome?.successBand ?? null;
  return [
    `result=${classification}`,
    `urgency=${urgency}`,
    `churnRisk=${Number(result.decision.risk.churnRisk01).toFixed(2)}`,
    `band=${band ?? 'NONE'}`,
    result.notes[0] ? `note=${result.notes[0]}` : null,
  ].filter(Boolean).join(' | ');
}

// ============================================================================
// MARK: Active intervention quick reads
// ============================================================================

export function getHighestUrgencyActive(
  active: readonly ActiveRescueIntervention[],
): ActiveRescueIntervention | null {
  if (active.length === 0) return null;
  const rank: Record<string, number> = { WATCH: 1, READY: 2, IMMEDIATE: 3, CRITICAL: 4 };
  return [...active].sort((a, b) =>
    (rank[b.rescuePlan.urgency] ?? 0) - (rank[a.rescuePlan.urgency] ?? 0),
  )[0] ?? null;
}

export function getMostRecentActive(
  active: readonly ActiveRescueIntervention[],
): ActiveRescueIntervention | null {
  if (active.length === 0) return null;
  return [...active].sort((a, b) => Number(b.openedAt) - Number(a.openedAt))[0] ?? null;
}

export function interventionMatchesRescueId(
  active: ActiveRescueIntervention,
  rescueId: string,
): boolean {
  return String(active.rescuePlan.rescueId) === rescueId;
}

export function findActiveByRescueId(
  active: readonly ActiveRescueIntervention[],
  rescueId: string,
): ActiveRescueIntervention | null {
  return active.find((a) => interventionMatchesRescueId(a, rescueId)) ?? null;
}

export function countActiveByUrgency(
  active: readonly ActiveRescueIntervention[],
  urgency: string,
): number {
  return active.filter((a) => a.rescuePlan.urgency === urgency).length;
}

export function activeIsExpired(active: ActiveRescueIntervention, now: UnixMs): boolean {
  return Number(active.rescueWindow.closesAt) <= Number(now);
}

export function listNonExpiredActive(
  active: readonly ActiveRescueIntervention[],
  now: UnixMs,
): readonly ActiveRescueIntervention[] {
  return Object.freeze(active.filter((a) => !activeIsExpired(a, now)));
}

export const RESCUE_INTERVENTION_DEFAULT_OPTIONS: Readonly<RescueInterventionPlannerOptions> = Object.freeze({
  maxActiveRescuesPerRoom: 3,
  retainLedgerEntriesPerRoom: 120,
});

export function buildRescueRoomSummaryLine(room: RescueRoomLedger, now: UnixMs): string {
  const metrics = computeRoomMetrics(room, now);
  return `roomId=${String(room.roomId)} active=${metrics.activeCount} accepted=${metrics.acceptedCount} resolved=${metrics.resolvedCount} timedOut=${metrics.timedOutCount} recovered=${metrics.recoveredCount} band=${metrics.latestSuccessBand ?? 'NONE'}`;
}

export function rescueWindowIsHalfwayExpired(active: ActiveRescueIntervention, now: UnixMs): boolean {
  return Number(projectRescueWindowHealth(active, now)) <= 0.5;
}

export function rescueRoomHasOpenWindow(planner: RescueInterventionPlanner, roomId: ChatRoomId, now: UnixMs): boolean {
  return planner.listActive(roomId).some((a) => !activeIsExpired(a, now));
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

// ============================================================================
// MARK: Signal analysis surface — full contract wiring for the planner layer
// ============================================================================

/**
 * Full signal context the planner can accept for deep rescue analysis.
 * Provides the contract surface types that ChurnRescuePolicy computes internally
 * but that planner consumers may also want to inspect or override.
 */
export interface PlannerSignalContext {
  readonly affect: ChatAffectSnapshot;
  readonly feature: ChatFeatureSnapshot;
  readonly learning: ChatLearningProfile;
  readonly reputation: ChatReputationState;
  readonly audience: ChatAudienceHeat | null;
  readonly bossFight: ChatBossFightState | null;
  readonly telemetry: ChatRescueTelemetrySnapshot | null;
}

/**
 * Full rescue signal digest for the planner layer.
 * Exposes urgency, reason, style, kind, suppression state, channel routing,
 * helper posture, guardrails, trigger candidates, signal vector, scored tilt/
 * recoverability, and ambient pressure band — all typed from shared contracts.
 */
export interface PlannerRescueSignalDigest {
  readonly urgency: ChatRescueUrgencyBand;
  readonly reasonCode: ChatRescueReasonCode;
  readonly style: ChatRescueStyle;
  readonly kind: ChatRescueKind;
  readonly suppressionReason: ChatRescueSuppressionReason | null;
  readonly visibleChannel: ChatVisibleChannel;
  readonly channelId: ChatChannelId;
  readonly helperPosture: ChatRescueHelperPosture;
  readonly guardrails: readonly ChatRescueGuardrail[];
  readonly trigger: ChatRescueTrigger | null;
  readonly triggerCandidates: readonly ChatRescueSignalVector[];
  readonly signalVector: ChatRescueSignalVector | null;
  readonly tilt01: Score01;
  readonly recoverability01: Score01;
  readonly tiltScore100: Score100;
  readonly recoverabilityScore100: Score100;
  readonly pressure: PressureTier;
}

/**
 * Deep offer analysis package for an active intervention.
 * Resolves from the live plan + recovery bundle through the shared contract
 * surface, exposing typed actions, actors, bundle, entry point, visibility,
 * predicted band, and scored lift values.
 */
export interface PlannerOfferAnalysis {
  readonly rescuePlan: ChatRescuePlan;
  readonly rescueWindow: ChatRescueWindow;
  readonly rescueOffer: ChatRescueOffer;
  readonly rescueActions: readonly ChatRescueAction[];
  readonly helperActor: ChatRescueActor | null;
  readonly recoveryBundle: ChatRecoveryBundle;
  readonly recoveryEntryPoint: ChatRecoveryEntryPoint;
  readonly recoveryVisibility: ChatRecoveryVisibility;
  readonly predictedBand: ChatRecoverySuccessBand;
  readonly tiltScore100: Score100;
  readonly recoverabilityScore100: Score100;
}

/**
 * Build a full planner-level signal digest from a signal context and a
 * ChurnRescuePolicy decision. Uses all shared rescue contract functions:
 * deriveRescueTilt01, deriveRescueRecoverability01, shouldSuppressRescue,
 * deriveRescueTriggerCandidates, isVisibleChannelId, clamp100, toRescueScore100.
 */
export function buildPlannerSignalDigest(
  context: PlannerSignalContext,
  decision: ChurnRescuePolicyDecision,
): PlannerRescueSignalDigest {
  const risk = decision.risk;
  const urgency: ChatRescueUrgencyBand = risk.urgency;
  const reasonCode: ChatRescueReasonCode = risk.reasonTrail.reasonCode;
  const style: ChatRescueStyle = decision.rescuePlan?.style ?? 'CALM';
  const kind: ChatRescueKind = decision.rescuePlan?.kind ?? 'QUIET_RECOVERY';
  const suppressionReason: ChatRescueSuppressionReason | null = risk.reasonTrail.suppressionReason ?? null;

  const tilt01 = deriveRescueTilt01(context.affect);
  const recoverability01 = deriveRescueRecoverability01({
    confidence: context.affect.confidence,
    relief: context.affect.relief,
    trust: context.affect.trust,
    frustration: context.affect.frustration,
    desperation: context.affect.desperation,
    helperReceptivity: (context.learning as any).helperReceptivity,
  } as any);

  const suppressed: boolean = !!(shouldSuppressRescue({
    helperAlreadyActive: (context.telemetry as any)?.helperAlreadyActive ?? false,
    publicRisk01: (risk as any).publicRisk01 ?? score01(0),
    recoverability01,
    silencePreferred: false,
    channelId: decision.rescuePlan?.channelId ?? null,
  } as any));

  const triggerCandidates: readonly ChatRescueSignalVector[] = ((deriveRescueTriggerCandidates as any)(
    reasonCode,
    urgency,
    { bossFightActive: !!context.bossFight },
  ) as readonly ChatRescueSignalVector[]) ?? [];

  const rawChannel = decision.rescuePlan?.visibleChannel;
  const visibleChannel: ChatVisibleChannel = isVisibleChannelId(rawChannel) ? rawChannel : 'GLOBAL';
  const channelId: ChatChannelId = decision.rescuePlan?.channelId ?? (visibleChannel as any);

  const helperPosture: ChatRescueHelperPosture = urgency === 'CRITICAL'
    ? 'ACTIVE'
    : urgency === 'IMMEDIATE'
      ? 'WATCHING'
      : urgency === 'READY'
        ? 'READY'
        : 'NONE';

  const guardrails: readonly ChatRescueGuardrail[] = (suppressed && suppressionReason)
    ? [({ reason: suppressionReason } as unknown) as ChatRescueGuardrail]
    : [];

  const trigger: ChatRescueTrigger | null = decision.rescuePlan?.trigger ?? null;
  const signalVector: ChatRescueSignalVector | null = (decision.rescuePlan as any)?.signalVector ?? null;

  const audienceHeat = context.audience ? Number((context.audience as any).heat ?? 0) : 0;
  const pressure: PressureTier = audienceHeat >= 0.75 ? 'CRITICAL' : audienceHeat >= 0.50 ? 'HIGH' : audienceHeat >= 0.25 ? 'ELEVATED' : audienceHeat > 0 ? 'BUILDING' : 'NONE';

  const tiltRaw: Score01 = toRescueScore01(Number(tilt01)) as Score01;
  const tiltScore100: Score100 = toRescueScore100(clamp100(Number(tiltRaw) * 100)) as Score100;
  const recoverabilityScore100: Score100 = toRescueScore100(clamp100(Number(recoverability01) * 100)) as Score100;

  return Object.freeze({
    urgency,
    reasonCode,
    style,
    kind,
    suppressionReason,
    visibleChannel,
    channelId,
    helperPosture,
    guardrails,
    trigger,
    triggerCandidates,
    signalVector,
    tilt01,
    recoverability01,
    tiltScore100,
    recoverabilityScore100,
    pressure,
  });
}

/**
 * Build a deep offer analysis package for an active intervention.
 * Calls buildRescuePlan, createRescueWindow, buildRecoveryPlan,
 * deriveRecoverySuccessBand, deriveRecoveryLiftSnapshot,
 * toRecoveryScore01, toRecoveryScore100, toRescueScore100, clamp100.
 */
export function buildPlannerOfferAnalysis(
  active: ActiveRescueIntervention,
  now: UnixMs,
): PlannerOfferAnalysis {
  const builtRescuePlan: ChatRescuePlan = buildRescuePlan({
    roomId: active.rescuePlan.roomId,
    channelId: active.rescuePlan.channelId,
    visibleChannel: active.rescuePlan.visibleChannel,
    sessionId: (active.rescuePlan as any).sessionId ?? null,
    rescueId: active.rescuePlan.rescueId,
    now,
  } as any) ?? active.rescuePlan;

  const rescueWindow = createRescueWindow(
    active.rescuePlan.rescueId,
    active.rescuePlan.kind,
    active.rescuePlan.urgency,
    active.openedAt,
  );

  const rescueOffer: ChatRescueOffer = active.rescuePlan.selectedOffer;
  const rescueActions: readonly ChatRescueAction[] = rescueOffer?.actions ?? [];
  const helperActor: ChatRescueActor | null = active.rescuePlan.helperActor ?? null;

  const recoveryBundle: ChatRecoveryBundle = active.recoveryPlan.bundle;
  const recoveryEntryPoint: ChatRecoveryEntryPoint = active.recoveryPlan.entryPoint;
  const recoveryVisibility: ChatRecoveryVisibility = (active.recoveryPlan as any).visibility ?? 'PRIVATE';

  const builtRecoveryPlan = buildRecoveryPlan({
    roomId: active.recoveryPlan.roomId,
    visibleChannel: active.recoveryPlan.visibleChannel,
    rescuePlan: builtRescuePlan,
    now,
  } as any);

  const predictedBand: ChatRecoverySuccessBand = deriveRecoverySuccessBand({
    stabilityLift01: toRecoveryScore01(Number(active.predictedOutcome?.stabilityLift01 ?? 0)),
    confidenceLift01: toRecoveryScore01(Number(active.predictedOutcome?.confidenceLift01 ?? 0)),
    trustLift01: toRecoveryScore01(Number(active.predictedOutcome?.trustLift01 ?? 0)),
    embarrassmentReduction01: toRecoveryScore01(Number(active.predictedOutcome?.embarrassmentReduction01 ?? 0)),
  } as any);

  const liftSnapshot = deriveRecoveryLiftSnapshot({
    recoveryPlan: builtRecoveryPlan ?? active.recoveryPlan,
    helperPosture: active.rescuePlan.helperPosture ?? null,
    now,
  } as any);

  const liftValue = Number((liftSnapshot as any)?.stabilityLift01 ?? active.predictedOutcome?.stabilityLift01 ?? 0);
  const tiltScore100: Score100 = toRescueScore100(clamp100(liftValue * 100)) as Score100;
  const recoverabilityScore100: Score100 = toRecoveryScore100(clamp100(liftValue * 100)) as Score100;

  return Object.freeze({
    rescuePlan: builtRescuePlan,
    rescueWindow,
    rescueOffer,
    rescueActions,
    helperActor,
    recoveryBundle,
    recoveryEntryPoint,
    recoveryVisibility,
    predictedBand,
    tiltScore100,
    recoverabilityScore100,
  });
}

/**
 * Derive a ChatRescueStateSnapshot from a live rescue plan and affect snapshot.
 * Calls deriveRescueStateSnapshot from the shared rescue contract.
 */
export function derivePlannerRescueState(
  rescuePlan: ChatRescuePlan,
  affect: ChatAffectSnapshot,
  now: UnixMs,
): ChatRescueStateSnapshot {
  return deriveRescueStateSnapshot(rescuePlan, affect, now, null) as ChatRescueStateSnapshot;
}
