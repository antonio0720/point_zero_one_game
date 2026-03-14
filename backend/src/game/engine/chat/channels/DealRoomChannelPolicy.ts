/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT ENGINE
 * FILE: backend/src/game/engine/chat/channels/DealRoomChannelPolicy.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Authoritative backend policy for DEAL_ROOM.
 * This file owns negotiation-room law, not transport, UI, or transcript mutation.
 *
 * Doctrine
 * --------
 * - DEAL_ROOM is immutable-ish, proof-bearing, and private by default.
 * - Frontend routing may suggest placement, but backend decides whether a message may exist.
 * - Helper, hater, and ambient NPC injection are suppressed here unless explicit system law says otherwise.
 * - Settlement, counter, dispute, and archive states alter what can be emitted and who may see it.
 */

export type DealRoomChannelId = 'DEAL_ROOM';

export type DealRoomModeId =
  | 'solo'
  | 'co-op'
  | 'asymmetric-pvp'
  | 'ghost'
  | 'syndicate'
  | 'tournament'
  | 'sandbox'
  | 'unknown';

export type DealRoomActorKind =
  | 'player'
  | 'system'
  | 'moderator'
  | 'admin'
  | 'service'
  | 'helper'
  | 'hater'
  | 'ambient_npc'
  | 'spectator';

export type DealRoomMembershipRole =
  | 'owner'
  | 'counterparty'
  | 'observer'
  | 'arbiter'
  | 'recorder'
  | 'spectator'
  | 'none';

export type DealRoomLifecycleState =
  | 'cold_open'
  | 'open'
  | 'active_negotiation'
  | 'counter_pending'
  | 'acceptance_pending'
  | 'settlement_locked'
  | 'settled'
  | 'cancelled'
  | 'disputed'
  | 'archived';

export type DealRoomTranscriptMode =
  | 'durable'
  | 'durable_with_proof'
  | 'sealed_after_settlement'
  | 'read_only_after_dispute'
  | 'archived';

export type DealRoomVisibilityClass =
  | 'private_participants'
  | 'private_participants_plus_arbiter'
  | 'private_internal'
  | 'shadow_only'
  | 'no_emit';

export type DealRoomMessageKind =
  | 'PLAYER'
  | 'PLAYER_RESPONSE'
  | 'SYSTEM'
  | 'DEAL_OPEN'
  | 'DEAL_PROPOSAL'
  | 'DEAL_COUNTER'
  | 'DEAL_ACCEPT'
  | 'DEAL_REJECT'
  | 'DEAL_CANCEL'
  | 'DEAL_RECAP'
  | 'DEAL_PROOF'
  | 'DEAL_DISPUTE'
  | 'DEAL_ESCALATION'
  | 'MARKET_ALERT'
  | 'ADMIN_NOTICE'
  | 'HELPER_TIP'
  | 'BOT_TAUNT'
  | 'BOT_ATTACK'
  | 'NPC_AMBIENT'
  | 'CURSOR'
  | 'TYPING'
  | 'PRESENCE'
  | 'COMMAND';

export type DealRoomCommand =
  | '/offer'
  | '/counter'
  | '/accept'
  | '/reject'
  | '/cancel'
  | '/ready'
  | '/dispute'
  | '/seal'
  | '/reopen'
  | '/mute'
  | '/unmute'
  | '/note';

export type DealRoomIngressStatus =
  | 'allow'
  | 'allow_with_proof'
  | 'allow_shadow'
  | 'suppress'
  | 'reject'
  | 'defer';

export type DealRoomProofRequirement =
  | 'none'
  | 'hash'
  | 'hash_and_sequence'
  | 'hash_sequence_and_parent'
  | 'sealed_hash';

export type DealRoomRejectionCode =
  | 'MODE_NOT_ALLOWED'
  | 'ROLE_NOT_ALLOWED'
  | 'ROOM_NOT_JOINED'
  | 'ROOM_LOCKED'
  | 'ROOM_ARCHIVED'
  | 'ROOM_SETTLED'
  | 'ROOM_CANCELLED'
  | 'ROOM_DISPUTED'
  | 'KIND_NOT_ALLOWED'
  | 'ACTOR_KIND_NOT_ALLOWED'
  | 'SPECTATOR_READ_ONLY'
  | 'PROOF_REQUIRED'
  | 'EDIT_FORBIDDEN'
  | 'DELETE_FORBIDDEN'
  | 'BURST_LIMIT'
  | 'SETTLEMENT_PENDING'
  | 'COMMAND_NOT_ALLOWED'
  | 'LEAK_SUPPRESSED'
  | 'COUNTERPARTY_REQUIRED'
  | 'EMPTY_BODY'
  | 'MAX_LENGTH'
  | 'DUPLICATE_PROPOSAL'
  | 'SYSTEM_ONLY'
  | 'HELPER_NOT_ALLOWED'
  | 'HATER_NOT_ALLOWED'
  | 'AMBIENT_NOT_ALLOWED'
  | 'UNKNOWN';

export interface DealRoomActorProfile {
  actorId: string;
  actorKind: DealRoomActorKind;
  teamId?: string;
  trustScore?: number;
  negotiationScore?: number;
  reputationTier?: string;
  sanctions?: readonly string[];
  muted?: boolean;
  shadowMuted?: boolean;
  isVerified?: boolean;
  isReconnect?: boolean;
}

export interface DealRoomMembership {
  actorId: string;
  role: DealRoomMembershipRole;
  joinedAtMs: number;
  lastReadSequence?: number;
  isReady?: boolean;
  isMuted?: boolean;
  isSpectating?: boolean;
  canSeeShadow?: boolean;
}

export interface DealRoomProofState {
  transcriptMode: DealRoomTranscriptMode;
  requiresProof: boolean;
  lastProofSequence: number;
  lastProofHash?: string;
  sealedAtMs?: number;
}

export interface DealRoomNegotiationState {
  lifecycle: DealRoomLifecycleState;
  openedAtMs: number;
  lastOfferAtMs?: number;
  lastCounterAtMs?: number;
  acceptedAtMs?: number;
  cancelledAtMs?: number;
  disputedAtMs?: number;
  lastActorId?: string;
  activeOfferRevision: number;
  counterpartyActorIds: readonly string[];
  summaryLocked: boolean;
  allowReopenAfterCancel: boolean;
}

export interface DealRoomChannelState {
  roomId: string;
  modeId: DealRoomModeId;
  roomRevision: number;
  negotiation: DealRoomNegotiationState;
  proof: DealRoomProofState;
  memberships: readonly DealRoomMembership[];
  lastSequence: number;
  participantCount: number;
  hasArbiter: boolean;
  isPrivateRoom: boolean;
  suppressLeaksToGlobal: boolean;
  maxBodyLength: number;
  maxAttachmentCount: number;
  immutableOffers: boolean;
}

export interface DealRoomModerationSummary {
  isAllowed: boolean;
  isMasked: boolean;
  isShadowOnly: boolean;
  requiresHelperReroute: boolean;
  requiresAdminReview: boolean;
  tags: readonly string[];
}

export interface DealRoomMessageDraft {
  channelId: DealRoomChannelId;
  actorId: string;
  actorKind: DealRoomActorKind;
  role: DealRoomMembershipRole;
  kind: DealRoomMessageKind;
  command?: DealRoomCommand;
  roomId: string;
  body: string;
  ts: number;
  sequenceHint?: number;
  parentSequence?: number;
  attachments?: readonly string[];
  metadata?: Readonly<Record<string, unknown>>;
  isEdit?: boolean;
  isDelete?: boolean;
  isResend?: boolean;
  clientProofHash?: string;
}

export interface DealRoomIngressContext {
  actor: DealRoomActorProfile;
  room: DealRoomChannelState;
  moderation?: DealRoomModerationSummary;
  nowMs: number;
  recentSendTimestampsMs: readonly number[];
  recentKinds: readonly DealRoomMessageKind[];
  recentBodies: readonly string[];
}

export interface DealRoomRateWindow {
  burstLimit: number;
  burstWindowMs: number;
  sustainedLimit: number;
  sustainedWindowMs: number;
  cooldownMs: number;
}

export interface DealRoomProofDirective {
  requirement: DealRoomProofRequirement;
  shouldGenerateServerHash: boolean;
  shouldSealAfterAppend: boolean;
  parentSequenceRequired: boolean;
}

export interface DealRoomTranscriptDirective {
  mode: DealRoomTranscriptMode;
  allowAppend: boolean;
  allowEdit: boolean;
  allowDelete: boolean;
  allowSoftRedaction: boolean;
  retainAuditTrail: boolean;
  visibilityClass: DealRoomVisibilityClass;
}

export interface DealRoomIngressDecision {
  status: DealRoomIngressStatus;
  code?: DealRoomRejectionCode;
  reasons: readonly string[];
  rateWindow: DealRoomRateWindow;
  proof: DealRoomProofDirective;
  transcript: DealRoomTranscriptDirective;
  visibility: DealRoomVisibilityClass;
  shouldFanout: boolean;
  shouldPersist: boolean;
  shouldEmitTelemetry: boolean;
  shouldEmitReplay: boolean;
  shouldSuppressLeak: boolean;
  shouldEscalateDispute: boolean;
  shouldLockSettlement: boolean;
  normalizedBody: string;
  auditLabels: readonly string[];
}

export interface DealRoomAudienceSnapshot {
  roomId: string;
  lifecycle: DealRoomLifecycleState;
  participants: readonly string[];
  spectators: readonly string[];
  arbiters: readonly string[];
  readers: readonly string[];
  shadowReaders: readonly string[];
}

export interface DealRoomAuditRecord {
  roomId: string;
  actorId: string;
  actorKind: DealRoomActorKind;
  role: DealRoomMembershipRole;
  kind: DealRoomMessageKind;
  status: DealRoomIngressStatus;
  code?: DealRoomRejectionCode;
  labels: readonly string[];
  reasons: readonly string[];
  lifecycle: DealRoomLifecycleState;
  ts: number;
}

export interface DealRoomPolicySnapshot {
  channelId: DealRoomChannelId;
  availableInModes: readonly DealRoomModeId[];
  lifecycle: DealRoomLifecycleState;
  transcriptMode: DealRoomTranscriptMode;
  proofRequirement: DealRoomProofRequirement;
  participantCount: number;
  suppressLeaksToGlobal: boolean;
  immutableOffers: boolean;
  roomRevision: number;
  canSpectatorsRead: boolean;
  canHelpersInject: boolean;
  canHatersInject: boolean;
  canAmbientInject: boolean;
}

const DEAL_ROOM_CHANNEL_ID: DealRoomChannelId = 'DEAL_ROOM';

const DEAL_ROOM_ALLOWED_MODES = [
  'co-op',
  'asymmetric-pvp',
  'tournament',
  'sandbox',
] satisfies readonly DealRoomModeId[];

const DEAL_ROOM_READ_ONLY_LIFECYCLES: readonly DealRoomLifecycleState[] = [
  'settlement_locked',
  'settled',
  'cancelled',
  'archived',
];

const DEAL_ROOM_WRITE_ALLOWED_BY_LIFECYCLE: Readonly<Record<DealRoomLifecycleState, readonly DealRoomMessageKind[]>> = {
  cold_open: [
    'DEAL_OPEN',
    'SYSTEM',
    'COMMAND',
    'PRESENCE',
    'TYPING',
  ],
  open: [
    'PLAYER',
    'PLAYER_RESPONSE',
    'DEAL_OPEN',
    'DEAL_PROPOSAL',
    'SYSTEM',
    'COMMAND',
    'PRESENCE',
    'TYPING',
  ],
  active_negotiation: [
    'PLAYER',
    'PLAYER_RESPONSE',
    'DEAL_PROPOSAL',
    'DEAL_COUNTER',
    'DEAL_ACCEPT',
    'DEAL_REJECT',
    'SYSTEM',
    'COMMAND',
    'PRESENCE',
    'TYPING',
  ],
  counter_pending: [
    'PLAYER',
    'PLAYER_RESPONSE',
    'DEAL_COUNTER',
    'DEAL_ACCEPT',
    'DEAL_REJECT',
    'SYSTEM',
    'COMMAND',
    'PRESENCE',
    'TYPING',
  ],
  acceptance_pending: [
    'PLAYER_RESPONSE',
    'DEAL_ACCEPT',
    'DEAL_REJECT',
    'DEAL_CANCEL',
    'SYSTEM',
    'COMMAND',
    'PRESENCE',
    'TYPING',
  ],
  settlement_locked: [
    'SYSTEM',
    'DEAL_RECAP',
    'DEAL_PROOF',
    'PRESENCE',
  ],
  settled: [
    'SYSTEM',
    'DEAL_RECAP',
    'DEAL_PROOF',
    'PRESENCE',
  ],
  cancelled: [
    'SYSTEM',
    'DEAL_RECAP',
    'PRESENCE',
  ],
  disputed: [
    'SYSTEM',
    'DEAL_DISPUTE',
    'DEAL_ESCALATION',
    'DEAL_PROOF',
    'COMMAND',
    'PRESENCE',
  ],
  archived: [
    'SYSTEM',
    'PRESENCE',
  ],
};

const DEAL_ROOM_ROLE_KIND_MATRIX: Readonly<Record<DealRoomMembershipRole, readonly DealRoomMessageKind[]>> = {
  owner: [
    'PLAYER',
    'PLAYER_RESPONSE',
    'DEAL_OPEN',
    'DEAL_PROPOSAL',
    'DEAL_COUNTER',
    'DEAL_ACCEPT',
    'DEAL_REJECT',
    'DEAL_CANCEL',
    'DEAL_DISPUTE',
    'COMMAND',
    'PRESENCE',
    'TYPING',
    'CURSOR',
  ],
  counterparty: [
    'PLAYER',
    'PLAYER_RESPONSE',
    'DEAL_PROPOSAL',
    'DEAL_COUNTER',
    'DEAL_ACCEPT',
    'DEAL_REJECT',
    'DEAL_CANCEL',
    'DEAL_DISPUTE',
    'COMMAND',
    'PRESENCE',
    'TYPING',
    'CURSOR',
  ],
  observer: [
    'PLAYER_RESPONSE',
    'COMMAND',
    'PRESENCE',
    'TYPING',
  ],
  arbiter: [
    'SYSTEM',
    'DEAL_DISPUTE',
    'DEAL_ESCALATION',
    'DEAL_PROOF',
    'ADMIN_NOTICE',
    'COMMAND',
    'PRESENCE',
  ],
  recorder: [
    'SYSTEM',
    'DEAL_RECAP',
    'DEAL_PROOF',
    'PRESENCE',
  ],
  spectator: [
    'PRESENCE',
  ],
  none: [
  ],
};

const DEAL_ROOM_ACTOR_KIND_MATRIX: Readonly<Record<DealRoomActorKind, readonly DealRoomMessageKind[]>> = {
  player: [
    'PLAYER',
    'PLAYER_RESPONSE',
    'DEAL_OPEN',
    'DEAL_PROPOSAL',
    'DEAL_COUNTER',
    'DEAL_ACCEPT',
    'DEAL_REJECT',
    'DEAL_CANCEL',
    'DEAL_DISPUTE',
    'COMMAND',
    'PRESENCE',
    'TYPING',
    'CURSOR',
  ],
  helper: [
    'SYSTEM',
    'PRESENCE',
  ],
  hater: [
    'SYSTEM',
    'PRESENCE',
  ],
  ambient_npc: [
    'SYSTEM',
    'PRESENCE',
  ],
  system: [
    'SYSTEM',
    'DEAL_RECAP',
    'DEAL_PROOF',
    'MARKET_ALERT',
    'ADMIN_NOTICE',
    'PRESENCE',
  ],
  moderator: [
    'SYSTEM',
    'DEAL_DISPUTE',
    'DEAL_ESCALATION',
    'DEAL_PROOF',
    'ADMIN_NOTICE',
    'PRESENCE',
  ],
  spectator: [
    'PRESENCE',
  ],
  admin: [
    'SYSTEM',
    'DEAL_DISPUTE',
    'DEAL_ESCALATION',
    'DEAL_PROOF',
    'ADMIN_NOTICE',
    'PRESENCE',
  ],
  service: [
    'SYSTEM',
    'DEAL_RECAP',
    'DEAL_PROOF',
    'PRESENCE',
  ],
};

const DEAL_ROOM_DEFAULT_RATE_WINDOWS: Readonly<Record<DealRoomActorKind, DealRoomRateWindow>> = {
  player: { burstLimit: 4, burstWindowMs: 8000, sustainedLimit: 12, sustainedWindowMs: 60000, cooldownMs: 1500 },
  helper: { burstLimit: 0, burstWindowMs: 15000, sustainedLimit: 0, sustainedWindowMs: 120000, cooldownMs: 120000 },
  hater: { burstLimit: 0, burstWindowMs: 15000, sustainedLimit: 0, sustainedWindowMs: 120000, cooldownMs: 120000 },
  ambient_npc: { burstLimit: 0, burstWindowMs: 15000, sustainedLimit: 0, sustainedWindowMs: 120000, cooldownMs: 120000 },
  system: { burstLimit: 8, burstWindowMs: 3000, sustainedLimit: 50, sustainedWindowMs: 60000, cooldownMs: 0 },
  moderator: { burstLimit: 8, burstWindowMs: 3000, sustainedLimit: 50, sustainedWindowMs: 60000, cooldownMs: 0 },
  spectator: { burstLimit: 0, burstWindowMs: 10000, sustainedLimit: 0, sustainedWindowMs: 60000, cooldownMs: 0 },
  admin: { burstLimit: 8, burstWindowMs: 3000, sustainedLimit: 50, sustainedWindowMs: 60000, cooldownMs: 0 },
  service: { burstLimit: 8, burstWindowMs: 3000, sustainedLimit: 50, sustainedWindowMs: 60000, cooldownMs: 0 },
};

const DEAL_ROOM_PROOF_REQUIREMENT_BY_KIND: Readonly<Record<DealRoomMessageKind, DealRoomProofRequirement>> = {
  PLAYER: 'hash',
  PLAYER_RESPONSE: 'hash',
  SYSTEM: 'none',
  DEAL_OPEN: 'hash_and_sequence',
  DEAL_PROPOSAL: 'hash_sequence_and_parent',
  DEAL_COUNTER: 'hash_sequence_and_parent',
  DEAL_ACCEPT: 'sealed_hash',
  DEAL_REJECT: 'hash_and_sequence',
  DEAL_CANCEL: 'hash_and_sequence',
  DEAL_RECAP: 'sealed_hash',
  DEAL_PROOF: 'sealed_hash',
  DEAL_DISPUTE: 'hash_sequence_and_parent',
  DEAL_ESCALATION: 'sealed_hash',
  MARKET_ALERT: 'none',
  ADMIN_NOTICE: 'none',
  HELPER_TIP: 'none',
  BOT_TAUNT: 'none',
  BOT_ATTACK: 'none',
  NPC_AMBIENT: 'none',
  CURSOR: 'none',
  TYPING: 'none',
  PRESENCE: 'none',
  COMMAND: 'hash',
};

const DEAL_ROOM_KIND_LABELS: Readonly<Record<DealRoomMessageKind, readonly string[]>> = {
  PLAYER: ['player', 'freeform'],
  PLAYER_RESPONSE: ['player', 'response'],
  SYSTEM: ['system'],
  DEAL_OPEN: ['deal', 'open'],
  DEAL_PROPOSAL: ['deal', 'proposal'],
  DEAL_COUNTER: ['deal', 'counter'],
  DEAL_ACCEPT: ['deal', 'accept'],
  DEAL_REJECT: ['deal', 'reject'],
  DEAL_CANCEL: ['deal', 'cancel'],
  DEAL_RECAP: ['deal', 'recap'],
  DEAL_PROOF: ['deal', 'proof'],
  DEAL_DISPUTE: ['deal', 'dispute'],
  DEAL_ESCALATION: ['deal', 'escalation'],
  MARKET_ALERT: ['system', 'market'],
  ADMIN_NOTICE: ['system', 'admin'],
  HELPER_TIP: ['helper'],
  BOT_TAUNT: ['hater'],
  BOT_ATTACK: ['hater'],
  NPC_AMBIENT: ['ambient'],
  CURSOR: ['ephemeral'],
  TYPING: ['ephemeral'],
  PRESENCE: ['ephemeral'],
  COMMAND: ['command'],
};

const DEAL_ROOM_BODY_LIMIT_BY_KIND: Readonly<Record<DealRoomMessageKind, number>> = {
  PLAYER: 600,
  PLAYER_RESPONSE: 600,
  SYSTEM: 280,
  DEAL_OPEN: 420,
  DEAL_PROPOSAL: 1200,
  DEAL_COUNTER: 1200,
  DEAL_ACCEPT: 180,
  DEAL_REJECT: 180,
  DEAL_CANCEL: 180,
  DEAL_RECAP: 1200,
  DEAL_PROOF: 180,
  DEAL_DISPUTE: 1600,
  DEAL_ESCALATION: 600,
  MARKET_ALERT: 280,
  ADMIN_NOTICE: 600,
  HELPER_TIP: 0,
  BOT_TAUNT: 0,
  BOT_ATTACK: 0,
  NPC_AMBIENT: 0,
  CURSOR: 0,
  TYPING: 0,
  PRESENCE: 0,
  COMMAND: 280,
};

const DEAL_ROOM_LIFECYCLE_TRANSCRIPT_MODE: Readonly<Record<DealRoomLifecycleState, DealRoomTranscriptMode>> = {
  cold_open: 'durable_with_proof',
  open: 'durable_with_proof',
  active_negotiation: 'durable_with_proof',
  counter_pending: 'durable_with_proof',
  acceptance_pending: 'durable_with_proof',
  settlement_locked: 'sealed_after_settlement',
  settled: 'sealed_after_settlement',
  cancelled: 'durable_with_proof',
  disputed: 'read_only_after_dispute',
  archived: 'archived',
};

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function unique<T>(items: readonly T[]): T[] {
  return Array.from(new Set(items));
}

function countRecent(windowMs: number, nowMs: number, timestamps: readonly number[]): number {
  const floor = nowMs - windowMs;
  return timestamps.filter((value) => value >= floor).length;
}

function hasMembership(room: DealRoomChannelState, actorId: string): boolean {
  return room.memberships.some((membership) => membership.actorId === actorId);
}

function getMembership(room: DealRoomChannelState, actorId: string): DealRoomMembership | undefined {
  return room.memberships.find((membership) => membership.actorId === actorId);
}

function kindAllowedForLifecycle(
  lifecycle: DealRoomLifecycleState,
  kind: DealRoomMessageKind,
): boolean {
  return DEAL_ROOM_WRITE_ALLOWED_BY_LIFECYCLE[lifecycle].includes(kind);
}

function kindAllowedForRole(
  role: DealRoomMembershipRole,
  kind: DealRoomMessageKind,
): boolean {
  return DEAL_ROOM_ROLE_KIND_MATRIX[role].includes(kind);
}

function kindAllowedForActor(
  actorKind: DealRoomActorKind,
  kind: DealRoomMessageKind,
): boolean {
  return DEAL_ROOM_ACTOR_KIND_MATRIX[actorKind].includes(kind);
}

function bodyLimitForKind(kind: DealRoomMessageKind, room: DealRoomChannelState): number {
  return Math.min(room.maxBodyLength, DEAL_ROOM_BODY_LIMIT_BY_KIND[kind]);
}

function requiresCounterparty(room: DealRoomChannelState): boolean {
  return room.negotiation.counterpartyActorIds.length > 0;
}

function transcriptDirectiveForLifecycle(
  lifecycle: DealRoomLifecycleState,
  visibility: DealRoomVisibilityClass,
): DealRoomTranscriptDirective {
  const mode = DEAL_ROOM_LIFECYCLE_TRANSCRIPT_MODE[lifecycle];
  switch (lifecycle) {
    case 'settlement_locked':
    case 'settled':
      return {
        mode,
        allowAppend: true,
        allowEdit: false,
        allowDelete: false,
        allowSoftRedaction: false,
        retainAuditTrail: true,
        visibilityClass: visibility,
      };
    case 'disputed':
      return {
        mode,
        allowAppend: true,
        allowEdit: false,
        allowDelete: false,
        allowSoftRedaction: true,
        retainAuditTrail: true,
        visibilityClass: visibility,
      };
    case 'archived':
      return {
        mode,
        allowAppend: false,
        allowEdit: false,
        allowDelete: false,
        allowSoftRedaction: false,
        retainAuditTrail: true,
        visibilityClass: visibility,
      };
    default:
      return {
        mode,
        allowAppend: true,
        allowEdit: false,
        allowDelete: false,
        allowSoftRedaction: true,
        retainAuditTrail: true,
        visibilityClass: visibility,
      };
  }
}

export class DealRoomChannelPolicy {
  public readonly channelId: DealRoomChannelId = DEAL_ROOM_CHANNEL_ID;

  public getAvailableModes(): readonly DealRoomModeId[] {
    return DEAL_ROOM_ALLOWED_MODES;
  }

  public isModeSupported(modeId: DealRoomModeId): boolean {
    return DEAL_ROOM_ALLOWED_MODES.includes(modeId);
  }

  public isReadOnlyLifecycle(lifecycle: DealRoomLifecycleState): boolean {
    return DEAL_ROOM_READ_ONLY_LIFECYCLES.includes(lifecycle);
  }

  public buildSnapshot(room: DealRoomChannelState): DealRoomPolicySnapshot {
    return {
      channelId: this.channelId,
      availableInModes: DEAL_ROOM_ALLOWED_MODES,
      lifecycle: room.negotiation.lifecycle,
      transcriptMode: DEAL_ROOM_LIFECYCLE_TRANSCRIPT_MODE[room.negotiation.lifecycle],
      proofRequirement: room.proof.requiresProof ? 'hash_sequence_and_parent' : 'none',
      participantCount: room.participantCount,
      suppressLeaksToGlobal: room.suppressLeaksToGlobal,
      immutableOffers: room.immutableOffers,
      roomRevision: room.roomRevision,
      canSpectatorsRead: room.memberships.some((membership) => membership.role === 'spectator'),
      canHelpersInject: false,
      canHatersInject: false,
      canAmbientInject: false,
    };
  }

  public buildAudienceSnapshot(room: DealRoomChannelState): DealRoomAudienceSnapshot {
    const participants = room.memberships
      .filter((membership) => membership.role === 'owner' || membership.role === 'counterparty')
      .map((membership) => membership.actorId);
    const spectators = room.memberships
      .filter((membership) => membership.role === 'spectator')
      .map((membership) => membership.actorId);
    const arbiters = room.memberships
      .filter((membership) => membership.role === 'arbiter')
      .map((membership) => membership.actorId);
    const recorders = room.memberships
      .filter((membership) => membership.role === 'recorder')
      .map((membership) => membership.actorId);
    return {
      roomId: room.roomId,
      lifecycle: room.negotiation.lifecycle,
      participants: unique(participants),
      spectators: unique(spectators),
      arbiters: unique(arbiters),
      readers: unique([...participants, ...spectators, ...arbiters, ...recorders]),
      shadowReaders: unique(arbiters),
    };
  }

  public canJoin(room: DealRoomChannelState, actor: DealRoomActorProfile): boolean {
    if (!this.isModeSupported(room.modeId)) {
      return false;
    }
    if (actor.actorKind === 'hater' || actor.actorKind === 'ambient_npc' || actor.actorKind === 'helper') {
      return false;
    }
    return true;
  }

  public canRead(room: DealRoomChannelState, actor: DealRoomActorProfile): boolean {
    const membership = getMembership(room, actor.actorId);
    if (actor.actorKind === 'admin' || actor.actorKind === 'moderator' || actor.actorKind === 'service') {
      return true;
    }
    if (!membership) {
      return false;
    }
    if (membership.role === 'spectator' && room.negotiation.lifecycle === 'active_negotiation') {
      return false;
    }
    return true;
  }

  public canWrite(room: DealRoomChannelState, actor: DealRoomActorProfile, kind: DealRoomMessageKind): boolean {
    const membership = getMembership(room, actor.actorId);
    if (!membership) {
      return false;
    }
    return kindAllowedForLifecycle(room.negotiation.lifecycle, kind)
      && kindAllowedForRole(membership.role, kind)
      && kindAllowedForActor(actor.actorKind, kind);
  }

  public getProofDirective(room: DealRoomChannelState, kind: DealRoomMessageKind): DealRoomProofDirective {
    const requirement = room.proof.requiresProof
      ? DEAL_ROOM_PROOF_REQUIREMENT_BY_KIND[kind]
      : 'none';
    return {
      requirement,
      shouldGenerateServerHash: requirement !== 'none',
      shouldSealAfterAppend: requirement === 'sealed_hash',
      parentSequenceRequired: requirement === 'hash_sequence_and_parent' || requirement === 'sealed_hash',
    };
  }

  public getVisibilityClass(room: DealRoomChannelState, actor: DealRoomActorProfile): DealRoomVisibilityClass {
    if (actor.shadowMuted) {
      return 'shadow_only';
    }
    if (actor.actorKind === 'admin' || actor.actorKind === 'moderator') {
      return 'private_participants_plus_arbiter';
    }
    return room.hasArbiter
      ? 'private_participants_plus_arbiter'
      : 'private_participants';
  }

  public evaluateIngress(
    draft: DealRoomMessageDraft,
    context: DealRoomIngressContext,
  ): DealRoomIngressDecision {
    const labels: string[] = [...(DEAL_ROOM_KIND_LABELS[draft.kind] ?? [])];
    const visibility = this.getVisibilityClass(context.room, context.actor);
    const rateWindow = DEAL_ROOM_DEFAULT_RATE_WINDOWS[draft.actorKind];
    const proof = this.getProofDirective(context.room, draft.kind);
    const transcript = transcriptDirectiveForLifecycle(context.room.negotiation.lifecycle, visibility);
    const normalizedBody = normalizeWhitespace(draft.body ?? '');

    if (draft.channelId !== DEAL_ROOM_CHANNEL_ID) {
      return this.reject(draft, context, 'KIND_NOT_ALLOWED', ['wrong channel specialist received draft'], rateWindow, proof, transcript, visibility, normalizedBody, labels);
    }

    if (!this.isModeSupported(context.room.modeId)) {
      return this.reject(draft, context, 'MODE_NOT_ALLOWED', [`mode ${context.room.modeId} does not expose DEAL_ROOM`], rateWindow, proof, transcript, visibility, normalizedBody, labels);
    }

    if (!hasMembership(context.room, draft.actorId) && draft.actorKind !== 'admin' && draft.actorKind !== 'moderator' && draft.actorKind !== 'service') {
      return this.reject(draft, context, 'ROOM_NOT_JOINED', ['actor is not a member of this deal room'], rateWindow, proof, transcript, visibility, normalizedBody, labels);
    }

    if (!kindAllowedForActor(draft.actorKind, draft.kind)) {
      const code: DealRoomRejectionCode = draft.actorKind === 'helper'
        ? 'HELPER_NOT_ALLOWED'
        : draft.actorKind === 'hater'
          ? 'HATER_NOT_ALLOWED'
          : draft.actorKind === 'ambient_npc'
            ? 'AMBIENT_NOT_ALLOWED'
            : 'ACTOR_KIND_NOT_ALLOWED';
      return this.reject(draft, context, code, [`actor kind ${draft.actorKind} cannot emit ${draft.kind} in DEAL_ROOM`], rateWindow, proof, transcript, visibility, normalizedBody, labels);
    }

    if (!kindAllowedForLifecycle(context.room.negotiation.lifecycle, draft.kind)) {
      const code: DealRoomRejectionCode = context.room.negotiation.lifecycle === 'settled'
        ? 'ROOM_SETTLED'
        : context.room.negotiation.lifecycle === 'cancelled'
          ? 'ROOM_CANCELLED'
          : context.room.negotiation.lifecycle === 'archived'
            ? 'ROOM_ARCHIVED'
            : context.room.negotiation.lifecycle === 'disputed'
              ? 'ROOM_DISPUTED'
              : 'ROOM_LOCKED';
      return this.reject(draft, context, code, [`kind ${draft.kind} is not available during lifecycle ${context.room.negotiation.lifecycle}`], rateWindow, proof, transcript, visibility, normalizedBody, labels);
    }

    if (!kindAllowedForRole(draft.role, draft.kind)) {
      return this.reject(draft, context, draft.role === 'spectator' ? 'SPECTATOR_READ_ONLY' : 'ROLE_NOT_ALLOWED', [`role ${draft.role} may not emit ${draft.kind}`], rateWindow, proof, transcript, visibility, normalizedBody, labels);
    }

    if (draft.isEdit) {
      return this.reject(draft, context, 'EDIT_FORBIDDEN', ['deal room is append-only once a message exists'], rateWindow, proof, transcript, visibility, normalizedBody, labels);
    }

    if (draft.isDelete) {
      return this.reject(draft, context, 'DELETE_FORBIDDEN', ['deal room messages are not deletable through channel law'], rateWindow, proof, transcript, visibility, normalizedBody, labels);
    }

    if (context.actor.muted || context.actor.shadowMuted) {
      labels.push('muted');
      return {
        status: 'allow_shadow',
        reasons: ['actor is muted or shadow-muted; message may only enter shadow lane'],
        rateWindow,
        proof,
        transcript: { ...transcript, visibilityClass: 'shadow_only' },
        visibility: 'shadow_only',
        shouldFanout: false,
        shouldPersist: true,
        shouldEmitTelemetry: true,
        shouldEmitReplay: false,
        shouldSuppressLeak: true,
        shouldEscalateDispute: false,
        shouldLockSettlement: false,
        normalizedBody,
        auditLabels: unique(labels),
      };
    }

    const bodyLimit = bodyLimitForKind(draft.kind, context.room);
    if (bodyLimit > 0 && normalizedBody.length === 0) {
      return this.reject(draft, context, 'EMPTY_BODY', ['body is empty after normalization'], rateWindow, proof, transcript, visibility, normalizedBody, labels);
    }

    if (bodyLimit > 0 && normalizedBody.length > bodyLimit) {
      return this.reject(draft, context, 'MAX_LENGTH', [`body length ${normalizedBody.length} exceeds limit ${bodyLimit}`], rateWindow, proof, transcript, visibility, normalizedBody, labels);
    }

    if (!requiresCounterparty(context.room) && !['DEAL_OPEN', 'SYSTEM', 'PRESENCE', 'TYPING', 'COMMAND'].includes(draft.kind)) {
      return this.reject(draft, context, 'COUNTERPARTY_REQUIRED', ['counterparty must exist before this kind of message can enter transcript'], rateWindow, proof, transcript, visibility, normalizedBody, labels);
    }

    if (draft.kind === 'DEAL_PROPOSAL' && context.room.negotiation.summaryLocked) {
      return this.reject(draft, context, 'ROOM_LOCKED', ['proposal flow is locked by summary state'], rateWindow, proof, transcript, visibility, normalizedBody, labels);
    }

    if ((draft.kind === 'DEAL_PROPOSAL' || draft.kind === 'DEAL_COUNTER') && proof.parentSequenceRequired && typeof draft.parentSequence !== 'number') {
      return this.reject(draft, context, 'PROOF_REQUIRED', ['proposal and counter events require a parent sequence'], rateWindow, proof, transcript, visibility, normalizedBody, labels);
    }

    if (proof.requirement !== 'none' && draft.clientProofHash && draft.clientProofHash.length < 8) {
      return this.reject(draft, context, 'PROOF_REQUIRED', ['client proof hash is malformed or too short'], rateWindow, proof, transcript, visibility, normalizedBody, labels);
    }

    const recentBurst = countRecent(rateWindow.burstWindowMs, context.nowMs, context.recentSendTimestampsMs);
    const recentSustained = countRecent(rateWindow.sustainedWindowMs, context.nowMs, context.recentSendTimestampsMs);
    if (recentBurst >= rateWindow.burstLimit && rateWindow.burstLimit > 0) {
      return this.reject(draft, context, 'BURST_LIMIT', [`burst limit ${rateWindow.burstLimit} exceeded within ${rateWindow.burstWindowMs}ms`], rateWindow, proof, transcript, visibility, normalizedBody, labels);
    }
    if (recentSustained >= rateWindow.sustainedLimit && rateWindow.sustainedLimit > 0) {
      return this.reject(draft, context, 'BURST_LIMIT', [`sustained limit ${rateWindow.sustainedLimit} exceeded within ${rateWindow.sustainedWindowMs}ms`], rateWindow, proof, transcript, visibility, normalizedBody, labels);
    }

    if (draft.kind === 'DEAL_PROPOSAL' && context.recentBodies.some((body) => normalizeWhitespace(body) === normalizedBody)) {
      labels.push('duplicate_candidate');
      return this.reject(draft, context, 'DUPLICATE_PROPOSAL', ['proposal body duplicates a recent proposal body'], rateWindow, proof, transcript, visibility, normalizedBody, labels);
    }

    if (draft.kind === 'DEAL_ACCEPT' && context.room.negotiation.lifecycle !== 'acceptance_pending' && context.room.negotiation.lifecycle !== 'counter_pending' && context.room.negotiation.lifecycle !== 'active_negotiation') {
      return this.reject(draft, context, 'SETTLEMENT_PENDING', ['accept may only occur while a live offer exists'], rateWindow, proof, transcript, visibility, normalizedBody, labels);
    }

    if (draft.kind === 'COMMAND' && !this.isCommandAllowed(draft.command, draft.role, context.room.negotiation.lifecycle)) {
      return this.reject(draft, context, 'COMMAND_NOT_ALLOWED', [`command ${draft.command ?? '(none)'} is not allowed for role ${draft.role} in lifecycle ${context.room.negotiation.lifecycle}`], rateWindow, proof, transcript, visibility, normalizedBody, labels);
    }

    if (context.room.suppressLeaksToGlobal) {
      labels.push('leak_suppressed');
    }
    if (draft.kind === 'DEAL_ACCEPT' || draft.kind === 'DEAL_RECAP' || draft.kind === 'DEAL_PROOF') {
      labels.push('settlement_artifact');
    }
    if (draft.kind === 'DEAL_DISPUTE' || draft.kind === 'DEAL_ESCALATION') {
      labels.push('dispute_artifact');
    }

    return {
      status: proof.requirement === 'none' ? 'allow' : 'allow_with_proof',
      reasons: ['message satisfies role, lifecycle, proof, and rate law for DEAL_ROOM'],
      rateWindow,
      proof,
      transcript,
      visibility,
      shouldFanout: visibility !== 'shadow_only' && draft.kind !== 'CURSOR' && draft.kind !== 'TYPING',
      shouldPersist: draft.kind !== 'CURSOR' && draft.kind !== 'TYPING' && draft.kind !== 'PRESENCE',
      shouldEmitTelemetry: true,
      shouldEmitReplay: draft.kind !== 'CURSOR' && draft.kind !== 'TYPING' && draft.kind !== 'PRESENCE',
      shouldSuppressLeak: context.room.suppressLeaksToGlobal,
      shouldEscalateDispute: draft.kind === 'DEAL_DISPUTE' || draft.kind === 'DEAL_ESCALATION',
      shouldLockSettlement: draft.kind === 'DEAL_ACCEPT',
      normalizedBody,
      auditLabels: unique(labels),
    };
  }

  public isCommandAllowed(
    command: DealRoomCommand | undefined,
    role: DealRoomMembershipRole,
    lifecycle: DealRoomLifecycleState,
  ): boolean {
    if (!command) {
      return false;
    }
    switch (command) {
      case '/offer':
      case '/counter':
        return role === 'owner' || role === 'counterparty';
      case '/accept':
      case '/reject':
      case '/cancel':
        return (role === 'owner' || role === 'counterparty') && lifecycle !== 'settled' && lifecycle !== 'archived';
      case '/dispute':
        return role === 'owner' || role === 'counterparty' || role === 'arbiter';
      case '/seal':
        return role === 'arbiter' || role === 'admin';
      case '/reopen':
        return lifecycle === 'cancelled' && (role === 'owner' || role === 'counterparty' || role === 'arbiter');
      case '/mute':
      case '/unmute':
        return role === 'arbiter' || role === 'admin' || role === 'moderator';
      case '/ready':
      case '/note':
        return role !== 'spectator' && role !== 'none';
      default:
        return false;
    }
  }

  public describeLifecycle(lifecycle: DealRoomLifecycleState): string {
    switch (lifecycle) {
      case 'cold_open':
        return 'room exists but proposal flow has not started';
      case 'open':
        return 'room is open for initial offer flow';
      case 'active_negotiation':
        return 'participants are actively negotiating';
      case 'counter_pending':
        return 'a counteroffer is pending';
      case 'acceptance_pending':
        return 'an offer is awaiting acceptance or rejection';
      case 'settlement_locked':
        return 'settlement path is locked while proof artifacts are assembled';
      case 'settled':
        return 'deal is settled and transcript is sealed after settlement';
      case 'cancelled':
        return 'deal was cancelled and remains durable for audit';
      case 'disputed':
        return 'deal is under dispute and read-only-after-dispute law applies';
      case 'archived':
        return 'room is archived and append is closed';
      default:
        return 'unknown deal-room lifecycle';
    }
  }

  public summarizeRestrictions(room: DealRoomChannelState): readonly string[] {
    const restrictions: string[] = [];
    restrictions.push(`lifecycle=${room.negotiation.lifecycle}`);
    restrictions.push(`transcriptMode=${DEAL_ROOM_LIFECYCLE_TRANSCRIPT_MODE[room.negotiation.lifecycle]}`);
    restrictions.push(`proofRequired=${String(room.proof.requiresProof)}`);
    restrictions.push(`immutableOffers=${String(room.immutableOffers)}`);
    restrictions.push(`suppressLeaksToGlobal=${String(room.suppressLeaksToGlobal)}`);
    restrictions.push(`participantCount=${String(room.participantCount)}`);
    if (room.negotiation.summaryLocked) {
      restrictions.push('summaryLocked=true');
    }
    if (room.hasArbiter) {
      restrictions.push('arbiterPresent=true');
    }
    if (room.negotiation.counterpartyActorIds.length === 0) {
      restrictions.push('counterpartyMissing=true');
    }
    return restrictions;
  }

  public buildAuditRecord(
    draft: DealRoomMessageDraft,
    room: DealRoomChannelState,
    decision: DealRoomIngressDecision,
  ): DealRoomAuditRecord {
    return {
      roomId: room.roomId,
      actorId: draft.actorId,
      actorKind: draft.actorKind,
      role: draft.role,
      kind: draft.kind,
      status: decision.status,
      code: decision.code,
      labels: decision.auditLabels,
      reasons: decision.reasons,
      lifecycle: room.negotiation.lifecycle,
      ts: draft.ts,
    };
  }

  private reject(
    draft: DealRoomMessageDraft,
    context: DealRoomIngressContext,
    code: DealRoomRejectionCode,
    reasons: readonly string[],
    rateWindow: DealRoomRateWindow,
    proof: DealRoomProofDirective,
    transcript: DealRoomTranscriptDirective,
    visibility: DealRoomVisibilityClass,
    normalizedBody: string,
    labels: readonly string[],
  ): DealRoomIngressDecision {
    const mergedLabels = unique([...labels, 'rejected', code.toLowerCase()]);
    return {
      status: 'reject',
      code,
      reasons,
      rateWindow,
      proof,
      transcript,
      visibility,
      shouldFanout: false,
      shouldPersist: false,
      shouldEmitTelemetry: true,
      shouldEmitReplay: false,
      shouldSuppressLeak: true,
      shouldEscalateDispute: draft.kind === 'DEAL_DISPUTE' || draft.kind === 'DEAL_ESCALATION',
      shouldLockSettlement: false,
      normalizedBody,
      auditLabels: mergedLabels,
    };
  }
}

export const dealRoomChannelPolicy = new DealRoomChannelPolicy();

export function inspectDealRoomLifecycleMatrix(): Readonly<Record<DealRoomLifecycleState, readonly DealRoomMessageKind[]>> {
  return DEAL_ROOM_WRITE_ALLOWED_BY_LIFECYCLE;
}

export function inspectDealRoomRoleMatrix(): Readonly<Record<DealRoomMembershipRole, readonly DealRoomMessageKind[]>> {
  return DEAL_ROOM_ROLE_KIND_MATRIX;
}

export function inspectDealRoomActorMatrix(): Readonly<Record<DealRoomActorKind, readonly DealRoomMessageKind[]>> {
  return DEAL_ROOM_ACTOR_KIND_MATRIX;
}

export function inspectDealRoomProofMatrix(): Readonly<Record<DealRoomMessageKind, DealRoomProofRequirement>> {
  return DEAL_ROOM_PROOF_REQUIREMENT_BY_KIND;
}

export function inspectDealRoomBodyLimits(): Readonly<Record<DealRoomMessageKind, number>> {
  return DEAL_ROOM_BODY_LIMIT_BY_KIND;
}

export function inspectDealRoomKindLabels(): Readonly<Record<DealRoomMessageKind, readonly string[]>> {
  return DEAL_ROOM_KIND_LABELS;
}

export const DEAL_ROOM_SCENARIO_1_OPENING_OFFER = {
  lifecycle: 'open' as DealRoomLifecycleState,
  role: 'owner' as DealRoomMembershipRole,
  kind: 'DEAL_OPEN' as DealRoomMessageKind,
  transcriptMode: DEAL_ROOM_LIFECYCLE_TRANSCRIPT_MODE['open'],
  proofRequirement: DEAL_ROOM_PROOF_REQUIREMENT_BY_KIND['DEAL_OPEN'],
};

export const DEAL_ROOM_SCENARIO_2_COUNTER_WINDOW = {
  lifecycle: 'counter_pending' as DealRoomLifecycleState,
  role: 'counterparty' as DealRoomMembershipRole,
  kind: 'DEAL_COUNTER' as DealRoomMessageKind,
  transcriptMode: DEAL_ROOM_LIFECYCLE_TRANSCRIPT_MODE['counter_pending'],
  proofRequirement: DEAL_ROOM_PROOF_REQUIREMENT_BY_KIND['DEAL_COUNTER'],
};

export const DEAL_ROOM_SCENARIO_3_ACCEPTANCE_WINDOW = {
  lifecycle: 'acceptance_pending' as DealRoomLifecycleState,
  role: 'owner' as DealRoomMembershipRole,
  kind: 'DEAL_ACCEPT' as DealRoomMessageKind,
  transcriptMode: DEAL_ROOM_LIFECYCLE_TRANSCRIPT_MODE['acceptance_pending'],
  proofRequirement: DEAL_ROOM_PROOF_REQUIREMENT_BY_KIND['DEAL_ACCEPT'],
};

export const DEAL_ROOM_SCENARIO_4_DISPUTE_ESCALATION = {
  lifecycle: 'disputed' as DealRoomLifecycleState,
  role: 'arbiter' as DealRoomMembershipRole,
  kind: 'DEAL_ESCALATION' as DealRoomMessageKind,
  transcriptMode: DEAL_ROOM_LIFECYCLE_TRANSCRIPT_MODE['disputed'],
  proofRequirement: DEAL_ROOM_PROOF_REQUIREMENT_BY_KIND['DEAL_ESCALATION'],
};

export const DEAL_ROOM_SCENARIO_5_ARCHIVE_PROOF = {
  lifecycle: 'archived' as DealRoomLifecycleState,
  role: 'recorder' as DealRoomMembershipRole,
  kind: 'DEAL_PROOF' as DealRoomMessageKind,
  transcriptMode: DEAL_ROOM_LIFECYCLE_TRANSCRIPT_MODE['archived'],
  proofRequirement: DEAL_ROOM_PROOF_REQUIREMENT_BY_KIND['DEAL_PROOF'],
};

