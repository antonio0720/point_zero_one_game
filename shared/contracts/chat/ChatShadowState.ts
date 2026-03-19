/**
 * ============================================================================
 * POINT ZERO ONE — SHARED CHAT SHADOW STATE CONTRACT
 * FILE: shared/contracts/chat/ChatShadowState.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical shared contract surface for invisible chat state.
 *
 * Shadow channels exist because not every chat effect should materialize as a
 * literal player-facing message. The visible transcript is only one layer of
 * the chat war. Beneath it, the game needs hidden pressure lanes that can:
 *
 * 1. carry latent hostility before it becomes a public strike,
 * 2. preserve suppressed replies that may reveal later,
 * 3. stage delayed witnesses and reveal queues,
 * 4. hold memory markers and callback anchors,
 * 5. accumulate crowd heat and rescue pressure invisibly,
 * 6. mark rivalry and helper state that affects future scenes,
 * 7. survive transport boundaries without UI-only assumptions,
 * 8. expose deterministic fold/reduce helpers for every runtime lane.
 *
 * Design doctrine
 * ---------------
 * 1. Shadow state is game law, not presentation garnish.
 * 2. Hidden state must remain explainable after the fact.
 * 3. Every latent effect needs provenance.
 * 4. Suppressed messages are still part of authored truth.
 * 5. Reveal queues must be serializable and replay-safe.
 * 6. Shadow pressure should support drama without becoming random opacity.
 * 7. Shadow state must align with rescue, reputation, negotiation, rivalry,
 *    memory, liveops, and boss-fight lanes without hard-coupling runtime logic.
 * 8. All exported helpers in this file are deterministic and side-effect free.
 * ============================================================================
 */

export type ChatShadowStateVersion = 1;
export const CHAT_SHADOW_STATE_VERSION: ChatShadowStateVersion = 1;

/**
 * String-backed IDs remain additive while the rest of the repo evolves.
 */
export type ChatShadowChannelId = string;
export type ChatShadowRoomId = string;
export type ChatShadowRunId = string;
export type ChatShadowSceneId = string;
export type ChatShadowMomentId = string;
export type ChatShadowEventId = string;
export type ChatShadowTurnId = string;
export type ChatShadowParticipantId = string;
export type ChatShadowNpcId = string;
export type ChatShadowMessageId = string;
export type ChatShadowAnchorId = string;
export type ChatShadowRevealId = string;
export type ChatShadowSuppressionId = string;
export type ChatShadowMarkerId = string;
export type ChatShadowQueueId = string;
export type ChatShadowBundleId = string;
export type ChatShadowWitnessId = string;
export type ChatShadowCallbackId = string;
export type ChatShadowProofId = string;
export type ChatShadowLegendId = string;
export type ChatShadowRescueId = string;
export type ChatShadowRivalryId = string;
export type ChatShadowNegotiationId = string;
export type ChatShadowLiveOpsId = string;

/**
 * Hidden channels represent non-visible processing lanes.
 */
export type ChatShadowLane =
  | 'SYSTEM_SHADOW'
  | 'NPC_SHADOW'
  | 'RIVALRY_SHADOW'
  | 'RESCUE_SHADOW'
  | 'LIVEOPS_SHADOW'
  | 'NEGOTIATION_SHADOW'
  | 'CROWD_SHADOW'
  | 'MEMORY_SHADOW'
  | 'WITNESS_SHADOW'
  | 'TRANSPORT_SHADOW';

/**
 * Why the shadow item exists.
 */
export type ChatShadowPurpose =
  | 'LATENT_HOSTILITY'
  | 'SUPPRESSED_REPLY'
  | 'REVEAL_QUEUE'
  | 'MEMORY_MARKER'
  | 'CALLBACK_ANCHOR'
  | 'CROWD_HEAT'
  | 'RESCUE_PRESSURE'
  | 'RIVALRY_ESCALATION'
  | 'NEGOTIATION_TRAP'
  | 'DELAYED_WITNESS'
  | 'LIVEOPS_STAGING'
  | 'TRANSPORT_RETRY'
  | 'SYSTEM_OVERRIDE'
  | 'LEGEND_SEED'
  | 'PROOF_HOLD'
  | 'SCENE_CONTINUITY'
  | 'AUDIT_TRAIL';

/**
 * Which subsystem authored the state.
 */
export type ChatShadowSourceKind =
  | 'SYSTEM'
  | 'PLAYER'
  | 'NPC'
  | 'HATER'
  | 'HELPER'
  | 'CROWD'
  | 'LIVEOPS'
  | 'NEGOTIATION'
  | 'RESCUE'
  | 'RIVALRY'
  | 'MEMORY'
  | 'SCENE'
  | 'TRANSPORT'
  | 'REPUTATION'
  | 'COMBAT'
  | 'UNKNOWN';

/**
 * Visibility intent for downstream consumers.
 */
export type ChatShadowVisibility =
  | 'HIDDEN'
  | 'REVEALABLE'
  | 'DIAGNOSTIC_ONLY'
  | 'AUDIT_ONLY'
  | 'PROMOTED'
  | 'EXPIRED';

/**
 * Reveal status lifecycle.
 */
export type ChatShadowRevealStatus =
  | 'PENDING'
  | 'ARMED'
  | 'READY'
  | 'REVEALED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'SUPPRESSED_FOREVER';

/**
 * Hidden pressure type.
 */
export type ChatShadowPressureKind =
  | 'HOSTILITY'
  | 'INTIMIDATION'
  | 'RIDICULE'
  | 'JUDGMENT'
  | 'PREDATION'
  | 'PANIC'
  | 'RESCUE_PULL'
  | 'CROWD_HEAT'
  | 'CONSPIRACY'
  | 'RIVALRY'
  | 'NEGOTIATION'
  | 'WITNESS'
  | 'LIVEOPS'
  | 'LEGEND';

/**
 * Rank ordering used by reveal queues and runtime folds.
 */
export type ChatShadowPriorityBand =
  | 'BACKGROUND'
  | 'LOW'
  | 'NORMAL'
  | 'HIGH'
  | 'CRITICAL'
  | 'OVERRIDE';

/**
 * Why a reply or reaction was suppressed.
 */
export type ChatShadowSuppressionReason =
  | 'SILENCE_IS_STRONGER'
  | 'HELPER_HELD_BACK'
  | 'WAIT_FOR_WITNESS'
  | 'WAIT_FOR_PROOF'
  | 'WAIT_FOR_COUNTER'
  | 'WAIT_FOR_RESCUE'
  | 'WAIT_FOR_SCENE'
  | 'WAIT_FOR_BETTER_MOMENT'
  | 'TRANSPORT_BACKPRESSURE'
  | 'RATE_LIMIT'
  | 'CHANNEL_POLICY'
  | 'MODERATION'
  | 'RIVALRY_ESCALATION'
  | 'NEGOTIATION_POSITIONING'
  | 'LIVEOPS_TIMING'
  | 'UNKNOWN';

/**
 * What can trigger a reveal.
 */
export type ChatShadowRevealTrigger =
  | 'TIME'
  | 'EVENT'
  | 'PRESSURE_THRESHOLD'
  | 'COUNTER_WINDOW'
  | 'NEGOTIATION_RESPONSE'
  | 'RESCUE_TRIGGER'
  | 'WITNESS_DENSITY'
  | 'SCENE_PHASE'
  | 'MANUAL_OVERRIDE'
  | 'RUN_END'
  | 'PLAYER_COLLAPSE'
  | 'PLAYER_COMEBACK'
  | 'PROOF_CONFIRMED'
  | 'BLUFF_EXPOSED'
  | 'BOSS_FIGHT_OPEN'
  | 'LIVEOPS_TICK';

/**
 * Shadow marker semantics.
 */
export type ChatShadowMarkerKind =
  | 'CALLBACK'
  | 'QUOTE'
  | 'THREAT'
  | 'RESCUE'
  | 'HUMILIATION'
  | 'COMEBACK'
  | 'LEGEND'
  | 'RIVALRY'
  | 'NEGOTIATION'
  | 'WITNESS'
  | 'PROOF'
  | 'MEMORY'
  | 'SYSTEM';

/**
 * Minimal scalar pressure vector.
 */
export interface ChatShadowPressureVector {
  readonly hostility: number;
  readonly intimidation: number;
  readonly ridicule: number;
  readonly judgment: number;
  readonly predation: number;
  readonly panic: number;
  readonly rescuePull: number;
  readonly crowdHeat: number;
  readonly conspiratorialPressure: number;
  readonly rivalryPressure: number;
  readonly negotiationPressure: number;
  readonly witnessPressure: number;
  readonly liveopsPressure: number;
  readonly legendCharge: number;
}

/**
 * Runtime-safe thresholds for reveal and suppression.
 */
export interface ChatShadowThresholds {
  readonly revealAtHeat: number;
  readonly revealAtHostility: number;
  readonly revealAtWitnessPressure: number;
  readonly revealAtRescuePull: number;
  readonly revealAtNegotiationPressure: number;
  readonly expireAtMs: number;
  readonly shadowRetentionMs: number;
  readonly callbackRetentionMs: number;
  readonly auditRetentionMs: number;
}

/**
 * Common provenance surface.
 */
export interface ChatShadowProvenance {
  readonly sourceKind: ChatShadowSourceKind;
  readonly sourceId?: string;
  readonly roomId?: ChatShadowRoomId;
  readonly channelId?: ChatShadowChannelId;
  readonly runId?: ChatShadowRunId;
  readonly sceneId?: ChatShadowSceneId;
  readonly momentId?: ChatShadowMomentId;
  readonly eventId?: ChatShadowEventId;
  readonly turnId?: ChatShadowTurnId;
  readonly participantId?: ChatShadowParticipantId;
  readonly npcId?: ChatShadowNpcId;
  readonly messageId?: ChatShadowMessageId;
  readonly proofId?: ChatShadowProofId;
  readonly rivalryId?: ChatShadowRivalryId;
  readonly rescueId?: ChatShadowRescueId;
  readonly negotiationId?: ChatShadowNegotiationId;
  readonly liveOpsId?: ChatShadowLiveOpsId;
}

/**
 * Base contract for any hidden state atom.
 */
export interface ChatShadowAtomBase {
  readonly id: string;
  readonly version: ChatShadowStateVersion;
  readonly lane: ChatShadowLane;
  readonly purpose: ChatShadowPurpose;
  readonly visibility: ChatShadowVisibility;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly provenance: ChatShadowProvenance;
  readonly notes?: readonly string[];
}

/**
 * Latent hostility or pressure anchor.
 */
export interface ChatShadowPressureAnchor extends ChatShadowAtomBase {
  readonly purpose:
    | 'LATENT_HOSTILITY'
    | 'CROWD_HEAT'
    | 'RESCUE_PRESSURE'
    | 'RIVALRY_ESCALATION'
    | 'NEGOTIATION_TRAP'
    | 'LIVEOPS_STAGING'
    | 'LEGEND_SEED';
  readonly pressureKind: ChatShadowPressureKind;
  readonly label: string;
  readonly magnitude: number;
  readonly vector: ChatShadowPressureVector;
  readonly hidden: boolean;
  readonly decays: boolean;
  readonly canReveal: boolean;
  readonly revealStatus: ChatShadowRevealStatus;
  readonly revealTrigger?: ChatShadowRevealTrigger;
  readonly revealAt?: string;
  readonly expiresAt?: string;
}

/**
 * Suppressed reaction / message.
 */
export interface ChatShadowSuppressedReply extends ChatShadowAtomBase {
  readonly purpose: 'SUPPRESSED_REPLY';
  readonly suppressionId: ChatShadowSuppressionId;
  readonly suppressionReason: ChatShadowSuppressionReason;
  readonly body: string;
  readonly authorKind: ChatShadowSourceKind;
  readonly authorId?: string;
  readonly originalMessageId?: ChatShadowMessageId;
  readonly relatedMessageIds?: readonly ChatShadowMessageId[];
  readonly priority: ChatShadowPriorityBand;
  readonly revealStatus: ChatShadowRevealStatus;
  readonly revealTrigger?: ChatShadowRevealTrigger;
  readonly revealAt?: string;
  readonly expiresAt?: string;
  readonly diagnosticOnly: boolean;
}

/**
 * Reveal queue item.
 */
export interface ChatShadowRevealQueueItem extends ChatShadowAtomBase {
  readonly purpose: 'REVEAL_QUEUE';
  readonly queueId: ChatShadowQueueId;
  readonly revealId: ChatShadowRevealId;
  readonly targetKind:
    | 'MESSAGE'
    | 'SCENE'
    | 'MOMENT'
    | 'HELPER'
    | 'CROWD_REACTION'
    | 'RIVALRY_SPIKE'
    | 'RESCUE_PROMPT'
    | 'NEGOTIATION_EXPOSURE'
    | 'PROOF_DROP'
    | 'SYSTEM_NOTICE';
  readonly targetId?: string;
  readonly priority: ChatShadowPriorityBand;
  readonly revealTrigger: ChatShadowRevealTrigger;
  readonly revealStatus: ChatShadowRevealStatus;
  readonly readyAt?: string;
  readonly revealAt?: string;
  readonly expiresAt?: string;
  readonly holdReason?: ChatShadowSuppressionReason;
}

/**
 * Memory marker / callback anchor.
 */
export interface ChatShadowMemoryMarker extends ChatShadowAtomBase {
  readonly purpose:
    | 'MEMORY_MARKER'
    | 'CALLBACK_ANCHOR'
    | 'LEGEND_SEED'
    | 'SCENE_CONTINUITY'
    | 'AUDIT_TRAIL';
  readonly markerId: ChatShadowMarkerId;
  readonly markerKind: ChatShadowMarkerKind;
  readonly label: string;
  readonly excerpt?: string;
  readonly salience: number;
  readonly durable: boolean;
  readonly revealEligible: boolean;
  readonly callbackId?: ChatShadowCallbackId;
  readonly legendId?: ChatShadowLegendId;
  readonly bundleId?: ChatShadowBundleId;
}

/**
 * Witness envelope in the shadow lane.
 */
export interface ChatShadowWitness {
  readonly witnessId: ChatShadowWitnessId;
  readonly role:
    | 'RIVAL'
    | 'ALLY'
    | 'HELPER'
    | 'SPECTATOR'
    | 'SYSTEM'
    | 'DEAL_PARTY'
    | 'FACTION'
    | 'UNKNOWN';
  readonly visible: boolean;
  readonly active: boolean;
  readonly weight: number;
  readonly hostileWeight: number;
  readonly supportiveWeight: number;
  readonly enteredAt: string;
  readonly lastSeenAt: string;
}

export interface ChatShadowWitnessEnvelope {
  readonly totalWitnesses: number;
  readonly visibleWitnesses: number;
  readonly latentWitnesses: number;
  readonly hostileWitnessWeight: number;
  readonly supportiveWitnessWeight: number;
  readonly neutralWitnessWeight: number;
  readonly roomFeelsObserved: boolean;
  readonly crowdCanPileOn: boolean;
}

/**
 * Queue summary for runtime and diagnostics.
 */
export interface ChatShadowQueueSummary {
  readonly queueId: ChatShadowQueueId;
  readonly totalItems: number;
  readonly armedItems: number;
  readonly readyItems: number;
  readonly criticalItems: number;
  readonly oldestCreatedAt?: string;
  readonly nextRevealAt?: string;
}

/**
 * Canonical room-level snapshot.
 */
export interface ChatShadowRoomSnapshot {
  readonly version: ChatShadowStateVersion;
  readonly roomId: ChatShadowRoomId;
  readonly channelId?: ChatShadowChannelId;
  readonly runId?: ChatShadowRunId;
  readonly sceneId?: ChatShadowSceneId;
  readonly momentId?: ChatShadowMomentId;
  readonly updatedAt: string;
  readonly thresholds: ChatShadowThresholds;
  readonly pressure: ChatShadowPressureVector;
  readonly witnesses: ChatShadowWitnessEnvelope;
  readonly anchors: readonly ChatShadowPressureAnchor[];
  readonly suppressedReplies: readonly ChatShadowSuppressedReply[];
  readonly revealQueue: readonly ChatShadowRevealQueueItem[];
  readonly memoryMarkers: readonly ChatShadowMemoryMarker[];
  readonly queueSummary: readonly ChatShadowQueueSummary[];
  readonly notes?: readonly string[];
}

/**
 * Delta for fold / reduce.
 */
export interface ChatShadowDelta {
  readonly roomId: ChatShadowRoomId;
  readonly channelId?: ChatShadowChannelId;
  readonly runId?: ChatShadowRunId;
  readonly createdAt: string;
  readonly actorKind?: ChatShadowSourceKind;
  readonly actorId?: string;
  readonly pressureDelta?: Partial<ChatShadowPressureVector>;
  readonly addAnchors?: readonly ChatShadowPressureAnchor[];
  readonly removeAnchorIds?: readonly string[];
  readonly addSuppressedReplies?: readonly ChatShadowSuppressedReply[];
  readonly removeSuppressionIds?: readonly ChatShadowSuppressionId[];
  readonly addRevealQueueItems?: readonly ChatShadowRevealQueueItem[];
  readonly removeRevealIds?: readonly ChatShadowRevealId[];
  readonly addMemoryMarkers?: readonly ChatShadowMemoryMarker[];
  readonly removeMarkerIds?: readonly ChatShadowMarkerId[];
  readonly notes?: readonly string[];
}

export const CHAT_SHADOW_DEFAULT_THRESHOLDS: ChatShadowThresholds = {
  revealAtHeat: 55,
  revealAtHostility: 60,
  revealAtWitnessPressure: 45,
  revealAtRescuePull: 50,
  revealAtNegotiationPressure: 58,
  expireAtMs: 120000,
  shadowRetentionMs: 900000,
  callbackRetentionMs: 1800000,
  auditRetentionMs: 86400000,
};

export const CHAT_SHADOW_EMPTY_PRESSURE: ChatShadowPressureVector = {
  hostility: 0,
  intimidation: 0,
  ridicule: 0,
  judgment: 0,
  predation: 0,
  panic: 0,
  rescuePull: 0,
  crowdHeat: 0,
  conspiratorialPressure: 0,
  rivalryPressure: 0,
  negotiationPressure: 0,
  witnessPressure: 0,
  liveopsPressure: 0,
  legendCharge: 0,
};

export const CHAT_SHADOW_EMPTY_WITNESSES: ChatShadowWitnessEnvelope = {
  totalWitnesses: 0,
  visibleWitnesses: 0,
  latentWitnesses: 0,
  hostileWitnessWeight: 0,
  supportiveWitnessWeight: 0,
  neutralWitnessWeight: 0,
  roomFeelsObserved: false,
  crowdCanPileOn: false,
};

export function clampShadowScalar(value: number, min = 0, max = 100): number {
  if (!Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function normalizeShadowPressureVector(
  input?: Partial<ChatShadowPressureVector> | null,
): ChatShadowPressureVector {
  return {
    hostility: clampShadowScalar(input?.hostility ?? 0),
    intimidation: clampShadowScalar(input?.intimidation ?? 0),
    ridicule: clampShadowScalar(input?.ridicule ?? 0),
    judgment: clampShadowScalar(input?.judgment ?? 0),
    predation: clampShadowScalar(input?.predation ?? 0),
    panic: clampShadowScalar(input?.panic ?? 0),
    rescuePull: clampShadowScalar(input?.rescuePull ?? 0),
    crowdHeat: clampShadowScalar(input?.crowdHeat ?? 0),
    conspiratorialPressure: clampShadowScalar(input?.conspiratorialPressure ?? 0),
    rivalryPressure: clampShadowScalar(input?.rivalryPressure ?? 0),
    negotiationPressure: clampShadowScalar(input?.negotiationPressure ?? 0),
    witnessPressure: clampShadowScalar(input?.witnessPressure ?? 0),
    liveopsPressure: clampShadowScalar(input?.liveopsPressure ?? 0),
    legendCharge: clampShadowScalar(input?.legendCharge ?? 0),
  };
}

export function addShadowPressureVectors(
  left: ChatShadowPressureVector,
  right?: Partial<ChatShadowPressureVector> | null,
): ChatShadowPressureVector {
  return normalizeShadowPressureVector({
    hostility: left.hostility + (right?.hostility ?? 0),
    intimidation: left.intimidation + (right?.intimidation ?? 0),
    ridicule: left.ridicule + (right?.ridicule ?? 0),
    judgment: left.judgment + (right?.judgment ?? 0),
    predation: left.predation + (right?.predation ?? 0),
    panic: left.panic + (right?.panic ?? 0),
    rescuePull: left.rescuePull + (right?.rescuePull ?? 0),
    crowdHeat: left.crowdHeat + (right?.crowdHeat ?? 0),
    conspiratorialPressure:
      left.conspiratorialPressure + (right?.conspiratorialPressure ?? 0),
    rivalryPressure: left.rivalryPressure + (right?.rivalryPressure ?? 0),
    negotiationPressure:
      left.negotiationPressure + (right?.negotiationPressure ?? 0),
    witnessPressure: left.witnessPressure + (right?.witnessPressure ?? 0),
    liveopsPressure: left.liveopsPressure + (right?.liveopsPressure ?? 0),
    legendCharge: left.legendCharge + (right?.legendCharge ?? 0),
  });
}

export function createEmptyShadowRoomSnapshot(params: {
  roomId: ChatShadowRoomId;
  channelId?: ChatShadowChannelId;
  runId?: ChatShadowRunId;
  sceneId?: ChatShadowSceneId;
  momentId?: ChatShadowMomentId;
  updatedAt?: string;
  thresholds?: Partial<ChatShadowThresholds>;
  notes?: readonly string[];
}): ChatShadowRoomSnapshot {
  return {
    version: CHAT_SHADOW_STATE_VERSION,
    roomId: params.roomId,
    channelId: params.channelId,
    runId: params.runId,
    sceneId: params.sceneId,
    momentId: params.momentId,
    updatedAt: params.updatedAt ?? new Date(0).toISOString(),
    thresholds: {
      ...CHAT_SHADOW_DEFAULT_THRESHOLDS,
      ...(params.thresholds ?? {}),
    },
    pressure: CHAT_SHADOW_EMPTY_PRESSURE,
    witnesses: CHAT_SHADOW_EMPTY_WITNESSES,
    anchors: [],
    suppressedReplies: [],
    revealQueue: [],
    memoryMarkers: [],
    queueSummary: [],
    notes: params.notes,
  };
}

export function computeShadowWitnessEnvelope(
  witnesses: readonly ChatShadowWitness[],
): ChatShadowWitnessEnvelope {
  let visibleWitnesses = 0;
  let latentWitnesses = 0;
  let hostileWitnessWeight = 0;
  let supportiveWitnessWeight = 0;
  let neutralWitnessWeight = 0;

  for (const witness of witnesses) {
    if (witness.visible) visibleWitnesses += 1;
    else latentWitnesses += 1;

    hostileWitnessWeight += Math.max(0, witness.hostileWeight);
    supportiveWitnessWeight += Math.max(0, witness.supportiveWeight);
    const residual = Math.max(
      0,
      witness.weight - witness.hostileWeight - witness.supportiveWeight,
    );
    neutralWitnessWeight += residual;
  }

  return {
    totalWitnesses: witnesses.length,
    visibleWitnesses,
    latentWitnesses,
    hostileWitnessWeight,
    supportiveWitnessWeight,
    neutralWitnessWeight,
    roomFeelsObserved: witnesses.length > 0,
    crowdCanPileOn: hostileWitnessWeight >= supportiveWitnessWeight,
  };
}

export function summarizeShadowQueue(
  items: readonly ChatShadowRevealQueueItem[],
): readonly ChatShadowQueueSummary[] {
  const buckets = new Map<string, ChatShadowRevealQueueItem[]>();
  for (const item of items) {
    const list = buckets.get(item.queueId) ?? [];
    list.push(item);
    buckets.set(item.queueId, list);
  }

  const summaries: ChatShadowQueueSummary[] = [];
  for (const [queueId, list] of buckets.entries()) {
    const armedItems = list.filter((item) => item.revealStatus === 'ARMED').length;
    const readyItems = list.filter((item) => item.revealStatus === 'READY').length;
    const criticalItems = list.filter(
      (item) => item.priority === 'CRITICAL' || item.priority === 'OVERRIDE',
    ).length;
    const oldestCreatedAt = list
      .map((item) => item.createdAt)
      .sort()[0];
    const nextRevealAt = list
      .map((item) => item.revealAt)
      .filter((value): value is string => Boolean(value))
      .sort()[0];

    summaries.push({
      queueId,
      totalItems: list.length,
      armedItems,
      readyItems,
      criticalItems,
      oldestCreatedAt,
      nextRevealAt,
    });
  }

  return summaries.sort((a, b) => a.queueId.localeCompare(b.queueId));
}

export function computeShadowPressureFromAnchors(
  anchors: readonly ChatShadowPressureAnchor[],
): ChatShadowPressureVector {
  let vector = CHAT_SHADOW_EMPTY_PRESSURE;
  for (const anchor of anchors) {
    vector = addShadowPressureVectors(vector, anchor.vector);
  }
  return vector;
}

export function foldShadowDelta(
  previous: ChatShadowRoomSnapshot,
  delta: ChatShadowDelta,
): ChatShadowRoomSnapshot {
  const anchors = [
    ...previous.anchors.filter(
      (anchor) => !(delta.removeAnchorIds ?? []).includes(anchor.id),
    ),
    ...(delta.addAnchors ?? []),
  ];

  const suppressedReplies = [
    ...previous.suppressedReplies.filter(
      (reply) => !(delta.removeSuppressionIds ?? []).includes(reply.suppressionId),
    ),
    ...(delta.addSuppressedReplies ?? []),
  ];

  const revealQueue = [
    ...previous.revealQueue.filter(
      (item) => !(delta.removeRevealIds ?? []).includes(item.revealId),
    ),
    ...(delta.addRevealQueueItems ?? []),
  ];

  const memoryMarkers = [
    ...previous.memoryMarkers.filter(
      (marker) => !(delta.removeMarkerIds ?? []).includes(marker.markerId),
    ),
    ...(delta.addMemoryMarkers ?? []),
  ];

  const pressure = addShadowPressureVectors(
    computeShadowPressureFromAnchors(anchors),
    delta.pressureDelta,
  );

  return {
    ...previous,
    channelId: delta.channelId ?? previous.channelId,
    runId: delta.runId ?? previous.runId,
    updatedAt: delta.createdAt,
    pressure,
    anchors,
    suppressedReplies,
    revealQueue,
    memoryMarkers,
    queueSummary: summarizeShadowQueue(revealQueue),
    notes: previous.notes || delta.notes ? [...(previous.notes ?? []), ...(delta.notes ?? [])] : undefined,
  };
}

export type ChatShadowAtom =
  | ChatShadowPressureAnchor
  | ChatShadowSuppressedReply
  | ChatShadowRevealQueueItem
  | ChatShadowMemoryMarker;

export function isShadowPressureAnchor(
  value: ChatShadowAtom,
): value is ChatShadowPressureAnchor {
  return (
    value.purpose === 'LATENT_HOSTILITY' ||
    value.purpose === 'CROWD_HEAT' ||
    value.purpose === 'RESCUE_PRESSURE' ||
    value.purpose === 'RIVALRY_ESCALATION' ||
    value.purpose === 'NEGOTIATION_TRAP' ||
    value.purpose === 'LIVEOPS_STAGING' ||
    value.purpose === 'LEGEND_SEED'
  );
}

export function isShadowSuppressedReply(
  value: ChatShadowAtom,
): value is ChatShadowSuppressedReply {
  return value.purpose === 'SUPPRESSED_REPLY';
}

export function isShadowRevealQueueItem(
  value: ChatShadowAtom,
): value is ChatShadowRevealQueueItem {
  return value.purpose === 'REVEAL_QUEUE';
}

export function isShadowMemoryMarker(
  value: ChatShadowAtom,
): value is ChatShadowMemoryMarker {
  return (
    value.purpose === 'MEMORY_MARKER' ||
    value.purpose === 'CALLBACK_ANCHOR' ||
    value.purpose === 'LEGEND_SEED' ||
    value.purpose === 'SCENE_CONTINUITY' ||
    value.purpose === 'AUDIT_TRAIL'
  );
}

/**
 * Preview-ready projection for UI / tooling.
 */
export interface ChatShadowRoomPreview {
  readonly roomId: ChatShadowRoomId;
  readonly channelId?: ChatShadowChannelId;
  readonly visibleHeat: number;
  readonly shadowHeat: number;
  readonly hiddenThreat: number;
  readonly rescuePressure: number;
  readonly revealableItems: number;
  readonly armedItems: number;
  readonly callbackMarkers: number;
  readonly roomFeelsObserved: boolean;
  readonly notes?: readonly string[];
}

export function toShadowRoomPreview(
  snapshot: ChatShadowRoomSnapshot,
): ChatShadowRoomPreview {
  const revealableItems = snapshot.revealQueue.filter(
    (item) => item.visibility === 'REVEALABLE' || item.visibility === 'PROMOTED',
  ).length;
  const armedItems = snapshot.revealQueue.filter(
    (item) => item.revealStatus === 'ARMED' || item.revealStatus === 'READY',
  ).length;
  const callbackMarkers = snapshot.memoryMarkers.filter(
    (marker) => marker.markerKind === 'CALLBACK' || marker.markerKind === 'QUOTE',
  ).length;

  return {
    roomId: snapshot.roomId,
    channelId: snapshot.channelId,
    visibleHeat: clampShadowScalar(snapshot.pressure.crowdHeat),
    shadowHeat: clampShadowScalar(
      snapshot.pressure.hostility +
        snapshot.pressure.intimidation +
        snapshot.pressure.judgment,
      0,
      300,
    ),
    hiddenThreat: clampShadowScalar(
      snapshot.pressure.hostility +
        snapshot.pressure.predation +
        snapshot.pressure.rivalryPressure,
      0,
      300,
    ),
    rescuePressure: clampShadowScalar(snapshot.pressure.rescuePull),
    revealableItems,
    armedItems,
    callbackMarkers,
    roomFeelsObserved: snapshot.witnesses.roomFeelsObserved,
    notes: snapshot.notes,
  };
}

/**
 * Registry / manifest
 */
export interface ChatShadowStateManifestEntry {
  readonly file: 'ChatShadowState.ts';
  readonly moduleId: 'shared/contracts/chat/ChatShadowState';
  readonly version: ChatShadowStateVersion;
  readonly exports: readonly string[];
  readonly purposes: readonly ChatShadowPurpose[];
  readonly lanes: readonly ChatShadowLane[];
}

export const CHAT_SHADOW_STATE_MANIFEST: ChatShadowStateManifestEntry = {
  file: 'ChatShadowState.ts',
  moduleId: 'shared/contracts/chat/ChatShadowState',
  version: CHAT_SHADOW_STATE_VERSION,
  exports: [
    'CHAT_SHADOW_STATE_VERSION',
    'CHAT_SHADOW_DEFAULT_THRESHOLDS',
    'CHAT_SHADOW_EMPTY_PRESSURE',
    'CHAT_SHADOW_EMPTY_WITNESSES',
    'clampShadowScalar',
    'normalizeShadowPressureVector',
    'addShadowPressureVectors',
    'createEmptyShadowRoomSnapshot',
    'computeShadowWitnessEnvelope',
    'summarizeShadowQueue',
    'computeShadowPressureFromAnchors',
    'foldShadowDelta',
    'isShadowPressureAnchor',
    'isShadowSuppressedReply',
    'isShadowRevealQueueItem',
    'isShadowMemoryMarker',
    'toShadowRoomPreview',
  ],
  purposes: [
    'LATENT_HOSTILITY',
    'SUPPRESSED_REPLY',
    'REVEAL_QUEUE',
    'MEMORY_MARKER',
    'CALLBACK_ANCHOR',
    'CROWD_HEAT',
    'RESCUE_PRESSURE',
    'RIVALRY_ESCALATION',
    'NEGOTIATION_TRAP',
    'DELAYED_WITNESS',
    'LIVEOPS_STAGING',
    'TRANSPORT_RETRY',
    'SYSTEM_OVERRIDE',
    'LEGEND_SEED',
    'PROOF_HOLD',
    'SCENE_CONTINUITY',
    'AUDIT_TRAIL',
  ],
  lanes: [
    'SYSTEM_SHADOW',
    'NPC_SHADOW',
    'RIVALRY_SHADOW',
    'RESCUE_SHADOW',
    'LIVEOPS_SHADOW',
    'NEGOTIATION_SHADOW',
    'CROWD_SHADOW',
    'MEMORY_SHADOW',
    'WITNESS_SHADOW',
    'TRANSPORT_SHADOW',
  ],
};

/**
 * Runtime-safe immutable presets
 */
export const CHAT_SHADOW_LANE_DEFAULTS: Readonly<Record<ChatShadowLane, {
  readonly visibility: ChatShadowVisibility;
  readonly defaultPurpose: ChatShadowPurpose;
  readonly defaultPriority: ChatShadowPriorityBand;
  readonly revealable: boolean;
}>> = {
  SYSTEM_SHADOW: {
    visibility: 'DIAGNOSTIC_ONLY',
    defaultPurpose: 'SYSTEM_OVERRIDE',
    defaultPriority: 'OVERRIDE',
    revealable: false,
  },
  NPC_SHADOW: {
    visibility: 'HIDDEN',
    defaultPurpose: 'SUPPRESSED_REPLY',
    defaultPriority: 'NORMAL',
    revealable: true,
  },
  RIVALRY_SHADOW: {
    visibility: 'HIDDEN',
    defaultPurpose: 'RIVALRY_ESCALATION',
    defaultPriority: 'HIGH',
    revealable: true,
  },
  RESCUE_SHADOW: {
    visibility: 'HIDDEN',
    defaultPurpose: 'RESCUE_PRESSURE',
    defaultPriority: 'CRITICAL',
    revealable: true,
  },
  LIVEOPS_SHADOW: {
    visibility: 'HIDDEN',
    defaultPurpose: 'LIVEOPS_STAGING',
    defaultPriority: 'HIGH',
    revealable: true,
  },
  NEGOTIATION_SHADOW: {
    visibility: 'HIDDEN',
    defaultPurpose: 'NEGOTIATION_TRAP',
    defaultPriority: 'HIGH',
    revealable: true,
  },
  CROWD_SHADOW: {
    visibility: 'HIDDEN',
    defaultPurpose: 'CROWD_HEAT',
    defaultPriority: 'NORMAL',
    revealable: true,
  },
  MEMORY_SHADOW: {
    visibility: 'AUDIT_ONLY',
    defaultPurpose: 'MEMORY_MARKER',
    defaultPriority: 'NORMAL',
    revealable: true,
  },
  WITNESS_SHADOW: {
    visibility: 'HIDDEN',
    defaultPurpose: 'DELAYED_WITNESS',
    defaultPriority: 'HIGH',
    revealable: true,
  },
  TRANSPORT_SHADOW: {
    visibility: 'DIAGNOSTIC_ONLY',
    defaultPurpose: 'TRANSPORT_RETRY',
    defaultPriority: 'LOW',
    revealable: false,
  },
};

export function inferShadowPurposeFromLane(
  lane: ChatShadowLane,
): ChatShadowPurpose {
  return CHAT_SHADOW_LANE_DEFAULTS[lane].defaultPurpose;
}

export function inferShadowVisibilityFromLane(
  lane: ChatShadowLane,
): ChatShadowVisibility {
  return CHAT_SHADOW_LANE_DEFAULTS[lane].visibility;
}

export function inferShadowPriorityFromLane(
  lane: ChatShadowLane,
): ChatShadowPriorityBand {
  return CHAT_SHADOW_LANE_DEFAULTS[lane].defaultPriority;
}

export function shadowLaneCanReveal(lane: ChatShadowLane): boolean {
  return CHAT_SHADOW_LANE_DEFAULTS[lane].revealable;
}

/**
 * Factory helpers
 */
export function createShadowPressureAnchor(params: {
  id: string;
  lane: ChatShadowLane;
  purpose?:
    | 'LATENT_HOSTILITY'
    | 'CROWD_HEAT'
    | 'RESCUE_PRESSURE'
    | 'RIVALRY_ESCALATION'
    | 'NEGOTIATION_TRAP'
    | 'LIVEOPS_STAGING'
    | 'LEGEND_SEED';
  visibility?: ChatShadowVisibility;
  createdAt: string;
  updatedAt?: string;
  provenance: ChatShadowProvenance;
  pressureKind: ChatShadowPressureKind;
  label: string;
  magnitude: number;
  vector?: Partial<ChatShadowPressureVector>;
  hidden?: boolean;
  decays?: boolean;
  canReveal?: boolean;
  revealStatus?: ChatShadowRevealStatus;
  revealTrigger?: ChatShadowRevealTrigger;
  revealAt?: string;
  expiresAt?: string;
  notes?: readonly string[];
}): ChatShadowPressureAnchor {
  return {
    id: params.id,
    version: CHAT_SHADOW_STATE_VERSION,
    lane: params.lane,
    purpose: params.purpose ?? inferShadowPurposeFromLane(params.lane) as ChatShadowPressureAnchor['purpose'],
    visibility: params.visibility ?? inferShadowVisibilityFromLane(params.lane),
    createdAt: params.createdAt,
    updatedAt: params.updatedAt ?? params.createdAt,
    provenance: params.provenance,
    notes: params.notes,
    pressureKind: params.pressureKind,
    label: params.label,
    magnitude: clampShadowScalar(params.magnitude),
    vector: normalizeShadowPressureVector(params.vector),
    hidden: params.hidden ?? true,
    decays: params.decays ?? true,
    canReveal: params.canReveal ?? shadowLaneCanReveal(params.lane),
    revealStatus: params.revealStatus ?? 'PENDING',
    revealTrigger: params.revealTrigger,
    revealAt: params.revealAt,
    expiresAt: params.expiresAt,
  };
}

export function createShadowSuppressedReply(params: {
  id: string;
  lane: ChatShadowLane;
  visibility?: ChatShadowVisibility;
  createdAt: string;
  updatedAt?: string;
  provenance: ChatShadowProvenance;
  suppressionId: ChatShadowSuppressionId;
  suppressionReason: ChatShadowSuppressionReason;
  body: string;
  authorKind: ChatShadowSourceKind;
  authorId?: string;
  originalMessageId?: ChatShadowMessageId;
  relatedMessageIds?: readonly ChatShadowMessageId[];
  priority?: ChatShadowPriorityBand;
  revealStatus?: ChatShadowRevealStatus;
  revealTrigger?: ChatShadowRevealTrigger;
  revealAt?: string;
  expiresAt?: string;
  diagnosticOnly?: boolean;
  notes?: readonly string[];
}): ChatShadowSuppressedReply {
  return {
    id: params.id,
    version: CHAT_SHADOW_STATE_VERSION,
    lane: params.lane,
    purpose: 'SUPPRESSED_REPLY',
    visibility: params.visibility ?? inferShadowVisibilityFromLane(params.lane),
    createdAt: params.createdAt,
    updatedAt: params.updatedAt ?? params.createdAt,
    provenance: params.provenance,
    notes: params.notes,
    suppressionId: params.suppressionId,
    suppressionReason: params.suppressionReason,
    body: params.body,
    authorKind: params.authorKind,
    authorId: params.authorId,
    originalMessageId: params.originalMessageId,
    relatedMessageIds: params.relatedMessageIds,
    priority: params.priority ?? inferShadowPriorityFromLane(params.lane),
    revealStatus: params.revealStatus ?? 'PENDING',
    revealTrigger: params.revealTrigger,
    revealAt: params.revealAt,
    expiresAt: params.expiresAt,
    diagnosticOnly: params.diagnosticOnly ?? false,
  };
}

export function createShadowRevealQueueItem(params: {
  id: string;
  lane: ChatShadowLane;
  visibility?: ChatShadowVisibility;
  createdAt: string;
  updatedAt?: string;
  provenance: ChatShadowProvenance;
  queueId: ChatShadowQueueId;
  revealId: ChatShadowRevealId;
  targetKind: ChatShadowRevealQueueItem['targetKind'];
  targetId?: string;
  priority?: ChatShadowPriorityBand;
  revealTrigger: ChatShadowRevealTrigger;
  revealStatus?: ChatShadowRevealStatus;
  readyAt?: string;
  revealAt?: string;
  expiresAt?: string;
  holdReason?: ChatShadowSuppressionReason;
  notes?: readonly string[];
}): ChatShadowRevealQueueItem {
  return {
    id: params.id,
    version: CHAT_SHADOW_STATE_VERSION,
    lane: params.lane,
    purpose: 'REVEAL_QUEUE',
    visibility: params.visibility ?? 'REVEALABLE',
    createdAt: params.createdAt,
    updatedAt: params.updatedAt ?? params.createdAt,
    provenance: params.provenance,
    notes: params.notes,
    queueId: params.queueId,
    revealId: params.revealId,
    targetKind: params.targetKind,
    targetId: params.targetId,
    priority: params.priority ?? inferShadowPriorityFromLane(params.lane),
    revealTrigger: params.revealTrigger,
    revealStatus: params.revealStatus ?? 'PENDING',
    readyAt: params.readyAt,
    revealAt: params.revealAt,
    expiresAt: params.expiresAt,
    holdReason: params.holdReason,
  };
}

export function createShadowMemoryMarker(params: {
  id: string;
  lane: ChatShadowLane;
  purpose?:
    | 'MEMORY_MARKER'
    | 'CALLBACK_ANCHOR'
    | 'LEGEND_SEED'
    | 'SCENE_CONTINUITY'
    | 'AUDIT_TRAIL';
  visibility?: ChatShadowVisibility;
  createdAt: string;
  updatedAt?: string;
  provenance: ChatShadowProvenance;
  markerId: ChatShadowMarkerId;
  markerKind: ChatShadowMarkerKind;
  label: string;
  excerpt?: string;
  salience?: number;
  durable?: boolean;
  revealEligible?: boolean;
  callbackId?: ChatShadowCallbackId;
  legendId?: ChatShadowLegendId;
  bundleId?: ChatShadowBundleId;
  notes?: readonly string[];
}): ChatShadowMemoryMarker {
  return {
    id: params.id,
    version: CHAT_SHADOW_STATE_VERSION,
    lane: params.lane,
    purpose: params.purpose ?? 'MEMORY_MARKER',
    visibility: params.visibility ?? inferShadowVisibilityFromLane(params.lane),
    createdAt: params.createdAt,
    updatedAt: params.updatedAt ?? params.createdAt,
    provenance: params.provenance,
    notes: params.notes,
    markerId: params.markerId,
    markerKind: params.markerKind,
    label: params.label,
    excerpt: params.excerpt,
    salience: clampShadowScalar(params.salience ?? 50),
    durable: params.durable ?? true,
    revealEligible: params.revealEligible ?? true,
    callbackId: params.callbackId,
    legendId: params.legendId,
    bundleId: params.bundleId,
  };
}

/**
 * Shadow analytics helpers
 */
export function countHiddenThreatAnchors(
  anchors: readonly ChatShadowPressureAnchor[],
): number {
  return anchors.filter(
    (anchor) =>
      anchor.pressureKind === 'HOSTILITY' ||
      anchor.pressureKind === 'INTIMIDATION' ||
      anchor.pressureKind === 'PREDATION' ||
      anchor.pressureKind === 'RIVALRY',
  ).length;
}

export function countRevealableSuppressedReplies(
  replies: readonly ChatShadowSuppressedReply[],
): number {
  return replies.filter(
    (reply) =>
      reply.revealStatus === 'ARMED' ||
      reply.revealStatus === 'READY' ||
      reply.visibility === 'REVEALABLE' ||
      reply.visibility === 'PROMOTED',
  ).length;
}

export function countCallbackAnchors(
  markers: readonly ChatShadowMemoryMarker[],
): number {
  return markers.filter(
    (marker) => marker.markerKind === 'CALLBACK' || marker.markerKind === 'QUOTE',
  ).length;
}

export function hasShadowRescuePressure(
  snapshot: ChatShadowRoomSnapshot,
): boolean {
  return (
    snapshot.pressure.rescuePull >= snapshot.thresholds.revealAtRescuePull ||
    snapshot.anchors.some((anchor) => anchor.purpose === 'RESCUE_PRESSURE')
  );
}

export function hasShadowNegotiationTrap(
  snapshot: ChatShadowRoomSnapshot,
): boolean {
  return (
    snapshot.pressure.negotiationPressure >=
      snapshot.thresholds.revealAtNegotiationPressure ||
    snapshot.anchors.some((anchor) => anchor.purpose === 'NEGOTIATION_TRAP')
  );
}

export function hasShadowCrowdBoil(
  snapshot: ChatShadowRoomSnapshot,
): boolean {
  return snapshot.pressure.crowdHeat >= snapshot.thresholds.revealAtHeat;
}

export function shadowSnapshotCanReveal(
  snapshot: ChatShadowRoomSnapshot,
): boolean {
  return (
    hasShadowCrowdBoil(snapshot) ||
    hasShadowRescuePressure(snapshot) ||
    hasShadowNegotiationTrap(snapshot) ||
    snapshot.revealQueue.some(
      (item) =>
        item.revealStatus === 'READY' ||
        item.revealStatus === 'ARMED' ||
        item.visibility === 'PROMOTED',
    )
  );
}

/**
 * Sorted diagnostics for tooling.
 */
export interface ChatShadowDiagnostics {
  readonly roomId: ChatShadowRoomId;
  readonly hiddenThreatAnchors: number;
  readonly revealableSuppressedReplies: number;
  readonly callbackAnchors: number;
  readonly pendingRevealItems: number;
  readonly readyRevealItems: number;
  readonly canRevealNow: boolean;
  readonly rescuePressureActive: boolean;
  readonly negotiationTrapActive: boolean;
  readonly crowdBoilActive: boolean;
}

export function buildShadowDiagnostics(
  snapshot: ChatShadowRoomSnapshot,
): ChatShadowDiagnostics {
  return {
    roomId: snapshot.roomId,
    hiddenThreatAnchors: countHiddenThreatAnchors(snapshot.anchors),
    revealableSuppressedReplies: countRevealableSuppressedReplies(
      snapshot.suppressedReplies,
    ),
    callbackAnchors: countCallbackAnchors(snapshot.memoryMarkers),
    pendingRevealItems: snapshot.revealQueue.filter(
      (item) => item.revealStatus === 'PENDING' || item.revealStatus === 'ARMED',
    ).length,
    readyRevealItems: snapshot.revealQueue.filter(
      (item) => item.revealStatus === 'READY',
    ).length,
    canRevealNow: shadowSnapshotCanReveal(snapshot),
    rescuePressureActive: hasShadowRescuePressure(snapshot),
    negotiationTrapActive: hasShadowNegotiationTrap(snapshot),
    crowdBoilActive: hasShadowCrowdBoil(snapshot),
  };
}
