/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND DEAL ROOM CHANNEL POLICY
 * FILE: backend/src/game/engine/chat/channels/DealRoomChannelPolicy.ts
 * VERSION: 2026.03.20
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical backend policy authority for the DEAL_ROOM chat lane.
 *
 * Backend-truth question
 * ----------------------
 *   "Given a candidate DEAL_ROOM-channel chat action, what is the
 *    authoritative backend decision about negotiation legality, proof-chain
 *    requirements, participant visibility, settlement locking, dispute
 *    escalation, replay value, spectator exposure, shadow routing, and
 *    transcript truth?"
 *
 * DEAL_ROOM is not a generic private room. It is the pressure chamber where:
 * - negotiation becomes social law,
 * - offers become proof-bearing artifacts,
 * - sequence and parentage matter,
 * - silence can be more meaningful than chatter,
 * - disputes alter who may speak and what may be seen,
 * - settlement narrows legality into seal-ready truth,
 * - and backend authority decides which emissions become durable record.
 *
 * Repo-grounded doctrine preserved here
 * -------------------------------------
 * - /shared/contracts/chat defines DEAL_ROOM as a first-class visible channel.
 * - /backend/src/game/engine/chat/channels already contains specialist policy
 *   files for GLOBAL, SYNDICATE, DEAL_ROOM, and LOBBY.
 * - /pzo-web/src/engines/chat and /pzo-web/src/components/chat establish that
 *   chat is mount-aware and omnipresent, not a disconnected widget.
 * - The uploaded doctrine explicitly positions DEAL_ROOM as proof-bearing,
 *   immutable-ish, private by default, and materially different from GLOBAL.
 *
 * Design laws
 * -----------
 * - DEAL_ROOM remains proof-heavier than LOBBY and more private than GLOBAL.
 * - Frontend placement may suggest a lane, but backend decides if a message may
 *   exist, who may see it, and whether it becomes transcript truth.
 * - Offer, counter, acceptance, dispute, and seal events must remain legible to
 *   replay, moderation, and future proof-chain inspection.
 * - Helper, hater, and ambient injection remain suppressed by default; DEAL_ROOM
 *   is for negotiation law, not crowd theater, unless explicit backend law says
 *   otherwise.
 * - Settlement and dispute states compress legality rather than merely changing
 *   colors in the UI.
 * - The policy must stay introspectable enough for telemetry, replay, liveops,
 *   moderation, and later extraction into shared backend contracts.
 * ============================================================================
 */

// ============================================================================
// MARK: Narrow scalar aliases
// ============================================================================

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

export type DealRoomMountSurface =
  | 'DEAL_ROOM_SCREEN'
  | 'GAME_BOARD'
  | 'BATTLE_HUD'
  | 'PREDATOR_SCREEN'
  | 'SYNDICATE_SCREEN'
  | 'LOBBY_SCREEN'
  | 'CHAT_DRAWER'
  | 'POST_RUN_SUMMARY'
  | 'UNKNOWN';

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

export type DealRoomNotificationHint =
  | 'none'
  | 'badge'
  | 'inline'
  | 'banner'
  | 'proof_banner'
  | 'settlement_banner'
  | 'dispute_banner'
  | 'moderation_alert';

export type DealRoomTranscriptDisposition =
  | 'append'
  | 'append_proof'
  | 'append_shadow_only'
  | 'sealed_append'
  | 'ephemeral_only'
  | 'drop';

export type DealRoomStageMood =
  | 'quiet'
  | 'watchful'
  | 'predatory'
  | 'compressed'
  | 'settlement_locked'
  | 'disputed'
  | 'archived';

export type DealRoomAudienceBand =
  | 'private_low'
  | 'private_live'
  | 'private_heated'
  | 'arbiter_heavy';

export type DealRoomCounterWindowState =
  | 'none'
  | 'open'
  | 'expiring'
  | 'expired'
  | 'sealed';

export type DealRoomSettlementPressureBand =
  | 'none'
  | 'watchful'
  | 'negotiating'
  | 'compressed'
  | 'terminal';

export type DealRoomLeakageRisk =
  | 'none'
  | 'guarded'
  | 'high';

export type DealRoomFanoutClass =
  | 'none'
  | 'participants_only'
  | 'participants_plus_arbiter'
  | 'internal_only'
  | 'shadow_only';

export type DealRoomShadowLane =
  | 'NEGOTIATION_SHADOW'
  | 'DISPUTE_SHADOW'
  | 'MODERATION_SHADOW'
  | 'SETTLEMENT_SHADOW';

export type DealRoomStageDirectiveKind =
  | 'quiet_append'
  | 'proof_hold'
  | 'counter_window_highlight'
  | 'acceptance_focus'
  | 'dispute_lock'
  | 'archive_lock'
  | 'settlement_seal';

export type DealRoomCounterplayDisposition =
  | 'none'
  | 'informational'
  | 'counter_offer'
  | 'dispute_vector'
  | 'seal_ready';

export type DealRoomReplayPriority =
  | 'none'
  | 'low'
  | 'standard'
  | 'high'
  | 'critical';

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
  | 'PROOF_CHAIN_BROKEN'
  | 'PARENT_SEQUENCE_MISMATCH'
  | 'EDIT_FORBIDDEN'
  | 'DELETE_FORBIDDEN'
  | 'BURST_LIMIT'
  | 'COOLDOWN_ACTIVE'
  | 'SETTLEMENT_PENDING'
  | 'COMMAND_NOT_ALLOWED'
  | 'LEAK_SUPPRESSED'
  | 'COUNTERPARTY_REQUIRED'
  | 'ARBITER_REQUIRED'
  | 'DISPUTE_LOCK_REQUIRED'
  | 'ATTACHMENT_LIMIT'
  | 'RESEND_NOT_ALLOWED'
  | 'EMPTY_BODY'
  | 'MAX_LENGTH'
  | 'DUPLICATE_PROPOSAL'
  | 'DUPLICATE_SPAM'
  | 'SYSTEM_ONLY'
  | 'HELPER_NOT_ALLOWED'
  | 'HATER_NOT_ALLOWED'
  | 'AMBIENT_NOT_ALLOWED'
  | 'MOUNT_RESTRICTED'
  | 'UNKNOWN';

// ============================================================================
// MARK: Core state interfaces
// ============================================================================

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
  canBypassProof?: boolean;
  canBypassRateLimit?: boolean;
  canShadowInspect?: boolean;
  isPrivilegedEscalationActor?: boolean;
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
  canPropose?: boolean;
  canCounter?: boolean;
  canSettle?: boolean;
  canDispute?: boolean;
  canSeal?: boolean;
}

export interface DealRoomProofState {
  transcriptMode: DealRoomTranscriptMode;
  requiresProof: boolean;
  lastProofSequence: number;
  lastProofHash?: string;
  sealedAtMs?: number;
  chainVersion?: string;
  lastParentSequence?: number;
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
  pendingOfferActorId?: string;
  pendingTargetActorId?: string;
  liveOfferSequence?: number;
  lastMeaningfulSequence?: number;
  lastMeaningfulActorId?: string;
  counterWindowExpiresAtMs?: number;
  acceptanceWindowExpiresAtMs?: number;
  settlementLockExpiresAtMs?: number;
  requiresArbiterForReopen?: boolean;
  disputeRevision?: number;
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
  mountSurface?: DealRoomMountSurface;
  audienceHeatScore?: number;
  negotiationPressureScore?: number;
  spectatorCount?: number;
  arbiterCount?: number;
  revealDelaysEnabled?: boolean;
  replayEnabled?: boolean;
  moderationHold?: boolean;
  canSpectatorsReadDuringNegotiation?: boolean;
  canSpectatorsReadAfterSettlement?: boolean;
  preferredNotificationHint?: DealRoomNotificationHint;
}

export interface DealRoomModerationSummary {
  isAllowed: boolean;
  isMasked: boolean;
  isShadowOnly: boolean;
  requiresHelperReroute: boolean;
  requiresAdminReview: boolean;
  tags: readonly string[];
  shouldShadowInsteadOfReject?: boolean;
  suppressSpectatorRead?: boolean;
  forceInternalVisibility?: boolean;
  suppressReplay?: boolean;
  elevatedLeakRisk?: boolean;
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
  requestedVisibility?: DealRoomVisibilityClass;
  requestedMountSurface?: DealRoomMountSurface;
  requestedShadowLane?: DealRoomShadowLane | null;
  offeredValueCents?: number;
  leverageScore?: number;
  bluffRisk?: number;
}

export interface DealRoomIngressContext {
  actor: DealRoomActorProfile;
  room: DealRoomChannelState;
  moderation?: DealRoomModerationSummary;
  nowMs: number;
  recentSendTimestampsMs: readonly number[];
  recentKinds: readonly DealRoomMessageKind[];
  recentBodies: readonly string[];
  recentCommands?: readonly DealRoomCommand[];
  recentProofHashes?: readonly string[];
  recentParentSequences?: readonly number[];
  mountSurface?: DealRoomMountSurface;
  replayBacklogDepth?: number;
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

export interface DealRoomStageDirective {
  kind: DealRoomStageDirectiveKind;
  stageMood: DealRoomStageMood;
  audienceBand: DealRoomAudienceBand;
  counterWindowState: DealRoomCounterWindowState;
  settlementPressure: DealRoomSettlementPressureBand;
  leakageRisk: DealRoomLeakageRisk;
  shouldHighlightProof: boolean;
  shouldCompressComposer: boolean;
  shouldRevealDelay: boolean;
  shouldPinThread: boolean;
  shouldElevateBanner: boolean;
  reason: string;
}

export interface DealRoomFanoutDirective {
  fanoutClass: DealRoomFanoutClass;
  shadowLane: DealRoomShadowLane | null;
  includeParticipants: boolean;
  includeArbiters: boolean;
  includeRecorders: boolean;
  includeSpectators: boolean;
  includeModeration: boolean;
  suppressClientEcho: boolean;
  reason: string;
}

export interface DealRoomReplayDirective {
  priority: DealRoomReplayPriority;
  shouldReplay: boolean;
  shouldSnapshotAfterAppend: boolean;
  shouldPersistAuditOnly: boolean;
  reason: string;
}

export interface DealRoomCounterplayWindow {
  state: DealRoomCounterWindowState;
  opensAtMs?: number;
  expiresAtMs?: number;
  msRemaining?: number;
  requiresActionByActorId?: string;
}

export interface DealRoomCounterplayLedger {
  lastProposalActorId?: string;
  lastProposalSequence?: number;
  lastCounterActorId?: string;
  lastCounterSequence?: number;
  disputeOpenedByActorId?: string;
  lastSealCandidateSequence?: number;
  outstandingActionCount: number;
}

export interface DealRoomCounterplayPlan {
  disposition: DealRoomCounterplayDisposition;
  shouldOpenCounterWindow: boolean;
  shouldLockForAcceptance: boolean;
  shouldEscalateDispute: boolean;
  shouldPrepareSeal: boolean;
  window: DealRoomCounterplayWindow;
  ledger: DealRoomCounterplayLedger;
  reason: string;
}

export interface DealRoomIngressExplainability {
  modeSupported: boolean;
  membershipFound: boolean;
  lifecycleAllowed: boolean;
  roleAllowed: boolean;
  actorAllowed: boolean;
  commandAllowed: boolean;
  bodyValid: boolean;
  proofSatisfied: boolean;
  rateAllowed: boolean;
  mountAllowed: boolean;
  transcriptDisposition: DealRoomTranscriptDisposition;
  notificationHint: DealRoomNotificationHint;
  summary: readonly string[];
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
  notificationHint?: DealRoomNotificationHint;
  transcriptDisposition?: DealRoomTranscriptDisposition;
  fanoutClass?: DealRoomFanoutClass;
  shadowLane?: DealRoomShadowLane | null;
  stageDirective?: DealRoomStageDirective;
  fanoutDirective?: DealRoomFanoutDirective;
  replayDirective?: DealRoomReplayDirective;
  counterplay?: DealRoomCounterplayPlan;
  explainability?: DealRoomIngressExplainability;
  mountRule?: DealRoomMountRule;
  commandRule?: DealRoomCommandRule | null;
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
  mountSurface?: DealRoomMountSurface;
  stageMood?: DealRoomStageMood;
  audienceBand?: DealRoomAudienceBand;
  counterWindowState?: DealRoomCounterWindowState;
  settlementPressure?: DealRoomSettlementPressureBand;
  leakageRisk?: DealRoomLeakageRisk;
}

export interface DealRoomFeedGuidance {
  roomId: string;
  stageMood: DealRoomStageMood;
  audienceBand: DealRoomAudienceBand;
  counterWindowState: DealRoomCounterWindowState;
  settlementPressure: DealRoomSettlementPressureBand;
  notificationHint: DealRoomNotificationHint;
  transcriptMode: DealRoomTranscriptMode;
  transcriptDisposition: DealRoomTranscriptDisposition;
  replayPriority: DealRoomReplayPriority;
  leakageRisk: DealRoomLeakageRisk;
  primaryDirective: DealRoomStageDirective;
}

export interface DealRoomCommandRule {
  command: DealRoomCommand;
  allowedRoles: readonly DealRoomMembershipRole[];
  blockedLifecycles: readonly DealRoomLifecycleState[];
  requiresCounterparty: boolean;
  requiresArbiter: boolean;
  description: string;
}

export interface DealRoomMountRule {
  surface: DealRoomMountSurface;
  composerEnabled: boolean;
  transcriptDrawerRecommended: boolean;
  proofStripVisible: boolean;
  spectatorReadVisible: boolean;
  allowedKinds: readonly DealRoomMessageKind[];
  preferredDirectiveKind: DealRoomStageDirectiveKind;
  defaultNotificationHint: DealRoomNotificationHint;
}

// ============================================================================
// MARK: Constants — modes, matrices, and defaults
// ============================================================================

const DEAL_ROOM_CHANNEL_ID: DealRoomChannelId = 'DEAL_ROOM';

const DEAL_ROOM_ALLOWED_MODES = [
  'co-op',
  'asymmetric-pvp',
  'tournament',
  'sandbox',
] satisfies readonly DealRoomModeId[];

const DEAL_ROOM_PRIVILEGED_ACTOR_KINDS = [
  'admin',
  'moderator',
  'service',
] satisfies readonly DealRoomActorKind[];

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
  none: [],
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

const DEAL_ROOM_NOTIFICATION_HINT_BY_KIND: Readonly<Record<DealRoomMessageKind, DealRoomNotificationHint>> = {
  PLAYER: 'inline',
  PLAYER_RESPONSE: 'inline',
  SYSTEM: 'inline',
  DEAL_OPEN: 'banner',
  DEAL_PROPOSAL: 'banner',
  DEAL_COUNTER: 'banner',
  DEAL_ACCEPT: 'settlement_banner',
  DEAL_REJECT: 'inline',
  DEAL_CANCEL: 'inline',
  DEAL_RECAP: 'settlement_banner',
  DEAL_PROOF: 'proof_banner',
  DEAL_DISPUTE: 'dispute_banner',
  DEAL_ESCALATION: 'dispute_banner',
  MARKET_ALERT: 'badge',
  ADMIN_NOTICE: 'moderation_alert',
  HELPER_TIP: 'none',
  BOT_TAUNT: 'none',
  BOT_ATTACK: 'none',
  NPC_AMBIENT: 'none',
  CURSOR: 'none',
  TYPING: 'none',
  PRESENCE: 'none',
  COMMAND: 'inline',
};

const DEAL_ROOM_TRANSCRIPT_DISPOSITION_BY_KIND: Readonly<Record<DealRoomMessageKind, DealRoomTranscriptDisposition>> = {
  PLAYER: 'append',
  PLAYER_RESPONSE: 'append',
  SYSTEM: 'append',
  DEAL_OPEN: 'append_proof',
  DEAL_PROPOSAL: 'append_proof',
  DEAL_COUNTER: 'append_proof',
  DEAL_ACCEPT: 'sealed_append',
  DEAL_REJECT: 'append_proof',
  DEAL_CANCEL: 'append_proof',
  DEAL_RECAP: 'sealed_append',
  DEAL_PROOF: 'sealed_append',
  DEAL_DISPUTE: 'append_proof',
  DEAL_ESCALATION: 'sealed_append',
  MARKET_ALERT: 'append',
  ADMIN_NOTICE: 'append',
  HELPER_TIP: 'drop',
  BOT_TAUNT: 'drop',
  BOT_ATTACK: 'drop',
  NPC_AMBIENT: 'drop',
  CURSOR: 'ephemeral_only',
  TYPING: 'ephemeral_only',
  PRESENCE: 'ephemeral_only',
  COMMAND: 'append',
};

const DEAL_ROOM_REPLAY_PRIORITY_BY_KIND: Readonly<Record<DealRoomMessageKind, DealRoomReplayPriority>> = {
  PLAYER: 'standard',
  PLAYER_RESPONSE: 'standard',
  SYSTEM: 'low',
  DEAL_OPEN: 'high',
  DEAL_PROPOSAL: 'high',
  DEAL_COUNTER: 'high',
  DEAL_ACCEPT: 'critical',
  DEAL_REJECT: 'high',
  DEAL_CANCEL: 'high',
  DEAL_RECAP: 'critical',
  DEAL_PROOF: 'critical',
  DEAL_DISPUTE: 'critical',
  DEAL_ESCALATION: 'critical',
  MARKET_ALERT: 'low',
  ADMIN_NOTICE: 'high',
  HELPER_TIP: 'none',
  BOT_TAUNT: 'none',
  BOT_ATTACK: 'none',
  NPC_AMBIENT: 'none',
  CURSOR: 'none',
  TYPING: 'none',
  PRESENCE: 'none',
  COMMAND: 'low',
};

const DEAL_ROOM_SHADOW_LANE_BY_KIND: Readonly<Record<DealRoomMessageKind, DealRoomShadowLane | null>> = {
  PLAYER: 'NEGOTIATION_SHADOW',
  PLAYER_RESPONSE: 'NEGOTIATION_SHADOW',
  SYSTEM: 'NEGOTIATION_SHADOW',
  DEAL_OPEN: 'NEGOTIATION_SHADOW',
  DEAL_PROPOSAL: 'NEGOTIATION_SHADOW',
  DEAL_COUNTER: 'NEGOTIATION_SHADOW',
  DEAL_ACCEPT: 'SETTLEMENT_SHADOW',
  DEAL_REJECT: 'NEGOTIATION_SHADOW',
  DEAL_CANCEL: 'NEGOTIATION_SHADOW',
  DEAL_RECAP: 'SETTLEMENT_SHADOW',
  DEAL_PROOF: 'SETTLEMENT_SHADOW',
  DEAL_DISPUTE: 'DISPUTE_SHADOW',
  DEAL_ESCALATION: 'DISPUTE_SHADOW',
  MARKET_ALERT: 'MODERATION_SHADOW',
  ADMIN_NOTICE: 'MODERATION_SHADOW',
  HELPER_TIP: 'MODERATION_SHADOW',
  BOT_TAUNT: 'MODERATION_SHADOW',
  BOT_ATTACK: 'MODERATION_SHADOW',
  NPC_AMBIENT: 'MODERATION_SHADOW',
  CURSOR: null,
  TYPING: null,
  PRESENCE: null,
  COMMAND: 'NEGOTIATION_SHADOW',
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

const DEAL_ROOM_COMMAND_RULES: Readonly<Record<DealRoomCommand, DealRoomCommandRule>> = {
  '/offer': {
    command: '/offer',
    allowedRoles: ['owner', 'counterparty'],
    blockedLifecycles: ['settlement_locked', 'settled', 'cancelled', 'disputed', 'archived'],
    requiresCounterparty: false,
    requiresArbiter: false,
    description: 'Open a new economic proposal in a live negotiation room.',
  },
  '/counter': {
    command: '/counter',
    allowedRoles: ['owner', 'counterparty'],
    blockedLifecycles: ['settlement_locked', 'settled', 'cancelled', 'archived'],
    requiresCounterparty: true,
    requiresArbiter: false,
    description: 'Issue a counteroffer against a live proposal.',
  },
  '/accept': {
    command: '/accept',
    allowedRoles: ['owner', 'counterparty'],
    blockedLifecycles: ['settlement_locked', 'settled', 'cancelled', 'archived'],
    requiresCounterparty: true,
    requiresArbiter: false,
    description: 'Accept a live proposal and initiate settlement-lock flow.',
  },
  '/reject': {
    command: '/reject',
    allowedRoles: ['owner', 'counterparty'],
    blockedLifecycles: ['settlement_locked', 'settled', 'cancelled', 'archived'],
    requiresCounterparty: true,
    requiresArbiter: false,
    description: 'Reject a live proposal or counteroffer.',
  },
  '/cancel': {
    command: '/cancel',
    allowedRoles: ['owner', 'counterparty'],
    blockedLifecycles: ['settlement_locked', 'settled', 'archived'],
    requiresCounterparty: false,
    requiresArbiter: false,
    description: 'Cancel the current negotiation path while retaining audit durability.',
  },
  '/ready': {
    command: '/ready',
    allowedRoles: ['owner', 'counterparty', 'observer', 'arbiter', 'recorder'],
    blockedLifecycles: ['settled', 'archived'],
    requiresCounterparty: false,
    requiresArbiter: false,
    description: 'Signal readiness for the next negotiation beat or proof step.',
  },
  '/dispute': {
    command: '/dispute',
    allowedRoles: ['owner', 'counterparty', 'arbiter'],
    blockedLifecycles: ['archived'],
    requiresCounterparty: false,
    requiresArbiter: false,
    description: 'Escalate the room into dispute handling with audit visibility.',
  },
  '/seal': {
    command: '/seal',
    allowedRoles: ['arbiter'],
    blockedLifecycles: ['cold_open', 'open', 'active_negotiation', 'counter_pending', 'acceptance_pending', 'cancelled', 'archived'],
    requiresCounterparty: false,
    requiresArbiter: true,
    description: 'Seal proof-bearing settlement artifacts under arbiter authority.',
  },
  '/reopen': {
    command: '/reopen',
    allowedRoles: ['owner', 'counterparty', 'arbiter'],
    blockedLifecycles: ['cold_open', 'open', 'active_negotiation', 'counter_pending', 'acceptance_pending', 'settlement_locked', 'settled', 'archived'],
    requiresCounterparty: false,
    requiresArbiter: false,
    description: 'Reopen a cancelled room if reopen law still permits it.',
  },
  '/mute': {
    command: '/mute',
    allowedRoles: ['arbiter'],
    blockedLifecycles: ['archived'],
    requiresCounterparty: false,
    requiresArbiter: true,
    description: 'Apply arbitration-level mute or shadow discipline inside the room.',
  },
  '/unmute': {
    command: '/unmute',
    allowedRoles: ['arbiter'],
    blockedLifecycles: ['archived'],
    requiresCounterparty: false,
    requiresArbiter: true,
    description: 'Remove arbitration-level mute or shadow discipline inside the room.',
  },
  '/note': {
    command: '/note',
    allowedRoles: ['owner', 'counterparty', 'observer', 'arbiter', 'recorder'],
    blockedLifecycles: ['archived'],
    requiresCounterparty: false,
    requiresArbiter: false,
    description: 'Append a negotiation note or proof annotation.',
  },
};

const DEAL_ROOM_MOUNT_RULES: Readonly<Record<DealRoomMountSurface, DealRoomMountRule>> = {
  DEAL_ROOM_SCREEN: {
    surface: 'DEAL_ROOM_SCREEN',
    composerEnabled: true,
    transcriptDrawerRecommended: true,
    proofStripVisible: true,
    spectatorReadVisible: false,
    allowedKinds: [
      'PLAYER',
      'PLAYER_RESPONSE',
      'SYSTEM',
      'DEAL_OPEN',
      'DEAL_PROPOSAL',
      'DEAL_COUNTER',
      'DEAL_ACCEPT',
      'DEAL_REJECT',
      'DEAL_CANCEL',
      'DEAL_RECAP',
      'DEAL_PROOF',
      'DEAL_DISPUTE',
      'DEAL_ESCALATION',
      'MARKET_ALERT',
      'ADMIN_NOTICE',
      'COMMAND',
      'CURSOR',
      'TYPING',
      'PRESENCE',
    ],
    preferredDirectiveKind: 'proof_hold',
    defaultNotificationHint: 'inline',
  },
  GAME_BOARD: {
    surface: 'GAME_BOARD',
    composerEnabled: true,
    transcriptDrawerRecommended: true,
    proofStripVisible: true,
    spectatorReadVisible: false,
    allowedKinds: [
      'PLAYER_RESPONSE',
      'SYSTEM',
      'DEAL_PROPOSAL',
      'DEAL_COUNTER',
      'DEAL_ACCEPT',
      'DEAL_REJECT',
      'DEAL_RECAP',
      'DEAL_PROOF',
      'DEAL_DISPUTE',
      'DEAL_ESCALATION',
      'COMMAND',
      'TYPING',
      'PRESENCE',
    ],
    preferredDirectiveKind: 'counter_window_highlight',
    defaultNotificationHint: 'banner',
  },
  BATTLE_HUD: {
    surface: 'BATTLE_HUD',
    composerEnabled: false,
    transcriptDrawerRecommended: true,
    proofStripVisible: false,
    spectatorReadVisible: false,
    allowedKinds: [
      'SYSTEM',
      'DEAL_RECAP',
      'DEAL_PROOF',
      'MARKET_ALERT',
      'ADMIN_NOTICE',
      'PRESENCE',
    ],
    preferredDirectiveKind: 'quiet_append',
    defaultNotificationHint: 'badge',
  },
  PREDATOR_SCREEN: {
    surface: 'PREDATOR_SCREEN',
    composerEnabled: true,
    transcriptDrawerRecommended: true,
    proofStripVisible: true,
    spectatorReadVisible: false,
    allowedKinds: [
      'PLAYER',
      'PLAYER_RESPONSE',
      'SYSTEM',
      'DEAL_OPEN',
      'DEAL_PROPOSAL',
      'DEAL_COUNTER',
      'DEAL_ACCEPT',
      'DEAL_REJECT',
      'DEAL_CANCEL',
      'DEAL_RECAP',
      'DEAL_PROOF',
      'DEAL_DISPUTE',
      'DEAL_ESCALATION',
      'MARKET_ALERT',
      'ADMIN_NOTICE',
      'COMMAND',
      'TYPING',
      'PRESENCE',
    ],
    preferredDirectiveKind: 'counter_window_highlight',
    defaultNotificationHint: 'banner',
  },
  SYNDICATE_SCREEN: {
    surface: 'SYNDICATE_SCREEN',
    composerEnabled: true,
    transcriptDrawerRecommended: true,
    proofStripVisible: true,
    spectatorReadVisible: false,
    allowedKinds: [
      'PLAYER_RESPONSE',
      'SYSTEM',
      'DEAL_RECAP',
      'DEAL_PROOF',
      'DEAL_DISPUTE',
      'DEAL_ESCALATION',
      'ADMIN_NOTICE',
      'COMMAND',
      'PRESENCE',
    ],
    preferredDirectiveKind: 'proof_hold',
    defaultNotificationHint: 'inline',
  },
  LOBBY_SCREEN: {
    surface: 'LOBBY_SCREEN',
    composerEnabled: false,
    transcriptDrawerRecommended: true,
    proofStripVisible: false,
    spectatorReadVisible: false,
    allowedKinds: [
      'SYSTEM',
      'DEAL_RECAP',
      'ADMIN_NOTICE',
      'PRESENCE',
    ],
    preferredDirectiveKind: 'quiet_append',
    defaultNotificationHint: 'badge',
  },
  CHAT_DRAWER: {
    surface: 'CHAT_DRAWER',
    composerEnabled: true,
    transcriptDrawerRecommended: true,
    proofStripVisible: true,
    spectatorReadVisible: true,
    allowedKinds: [
      'PLAYER',
      'PLAYER_RESPONSE',
      'SYSTEM',
      'DEAL_OPEN',
      'DEAL_PROPOSAL',
      'DEAL_COUNTER',
      'DEAL_ACCEPT',
      'DEAL_REJECT',
      'DEAL_CANCEL',
      'DEAL_RECAP',
      'DEAL_PROOF',
      'DEAL_DISPUTE',
      'DEAL_ESCALATION',
      'MARKET_ALERT',
      'ADMIN_NOTICE',
      'COMMAND',
      'CURSOR',
      'TYPING',
      'PRESENCE',
    ],
    preferredDirectiveKind: 'proof_hold',
    defaultNotificationHint: 'inline',
  },
  POST_RUN_SUMMARY: {
    surface: 'POST_RUN_SUMMARY',
    composerEnabled: false,
    transcriptDrawerRecommended: true,
    proofStripVisible: true,
    spectatorReadVisible: true,
    allowedKinds: [
      'SYSTEM',
      'DEAL_RECAP',
      'DEAL_PROOF',
      'DEAL_DISPUTE',
      'DEAL_ESCALATION',
      'ADMIN_NOTICE',
      'PRESENCE',
    ],
    preferredDirectiveKind: 'settlement_seal',
    defaultNotificationHint: 'proof_banner',
  },
  UNKNOWN: {
    surface: 'UNKNOWN',
    composerEnabled: true,
    transcriptDrawerRecommended: true,
    proofStripVisible: true,
    spectatorReadVisible: false,
    allowedKinds: [
      'PLAYER',
      'PLAYER_RESPONSE',
      'SYSTEM',
      'DEAL_OPEN',
      'DEAL_PROPOSAL',
      'DEAL_COUNTER',
      'DEAL_ACCEPT',
      'DEAL_REJECT',
      'DEAL_CANCEL',
      'DEAL_RECAP',
      'DEAL_PROOF',
      'DEAL_DISPUTE',
      'DEAL_ESCALATION',
      'MARKET_ALERT',
      'ADMIN_NOTICE',
      'COMMAND',
      'CURSOR',
      'TYPING',
      'PRESENCE',
    ],
    preferredDirectiveKind: 'proof_hold',
    defaultNotificationHint: 'inline',
  },
};

// ============================================================================
// MARK: Pure helpers
// ============================================================================

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

function mostRecentTimestamp(timestamps: readonly number[]): number | undefined {
  return timestamps.length > 0 ? Math.max(...timestamps) : undefined;
}

function hasMembership(room: DealRoomChannelState, actorId: string): boolean {
  return room.memberships.some((membership) => membership.actorId === actorId);
}

function getMembership(room: DealRoomChannelState, actorId: string): DealRoomMembership | undefined {
  return room.memberships.find((membership) => membership.actorId === actorId);
}

function isPrivilegedActor(actorKind: DealRoomActorKind): boolean {
  return (DEAL_ROOM_PRIVILEGED_ACTOR_KINDS as readonly DealRoomActorKind[]).includes(actorKind);
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

function getMountRule(surface: DealRoomMountSurface | undefined): DealRoomMountRule {
  return DEAL_ROOM_MOUNT_RULES[surface ?? 'UNKNOWN'];
}

function getCommandRule(command: DealRoomCommand | undefined): DealRoomCommandRule | null {
  if (!command) {
    return null;
  }
  return DEAL_ROOM_COMMAND_RULES[command] ?? null;
}

function getCounterWindowExpiry(room: DealRoomChannelState): number | undefined {
  if (room.negotiation.lifecycle === 'counter_pending') {
    return room.negotiation.counterWindowExpiresAtMs;
  }
  if (room.negotiation.lifecycle === 'acceptance_pending') {
    return room.negotiation.acceptanceWindowExpiresAtMs;
  }
  if (room.negotiation.lifecycle === 'settlement_locked') {
    return room.negotiation.settlementLockExpiresAtMs;
  }
  return undefined;
}

function getTranscriptDisposition(
  kind: DealRoomMessageKind,
  lifecycle: DealRoomLifecycleState,
  shadowOnly: boolean,
): DealRoomTranscriptDisposition {
  if (shadowOnly) {
    return 'append_shadow_only';
  }
  if (lifecycle === 'archived') {
    return kind === 'PRESENCE' ? 'ephemeral_only' : 'drop';
  }
  if (lifecycle === 'settlement_locked' || lifecycle === 'settled') {
    if (kind === 'DEAL_PROOF' || kind === 'DEAL_RECAP' || kind === 'SYSTEM') {
      return 'sealed_append';
    }
  }
  if (lifecycle === 'disputed') {
    if (kind === 'DEAL_DISPUTE' || kind === 'DEAL_ESCALATION' || kind === 'DEAL_PROOF' || kind === 'SYSTEM') {
      return DEAL_ROOM_TRANSCRIPT_DISPOSITION_BY_KIND[kind];
    }
    return 'drop';
  }
  return DEAL_ROOM_TRANSCRIPT_DISPOSITION_BY_KIND[kind];
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

// ============================================================================
// MARK: Policy authority
// ============================================================================

export class DealRoomChannelPolicy {
  public readonly channelId: DealRoomChannelId = DEAL_ROOM_CHANNEL_ID;

  public getAvailableModes(): readonly DealRoomModeId[] {
    return DEAL_ROOM_ALLOWED_MODES;
  }

  public isModeSupported(modeId: DealRoomModeId): boolean {
    return (DEAL_ROOM_ALLOWED_MODES as readonly DealRoomModeId[]).includes(modeId);
  }

  public isReadOnlyLifecycle(lifecycle: DealRoomLifecycleState): boolean {
    return DEAL_ROOM_READ_ONLY_LIFECYCLES.includes(lifecycle);
  }

  public inferStageMood(room: DealRoomChannelState, nowMs: number): DealRoomStageMood {
    const counterState = this.inferCounterWindowState(room, nowMs);
    switch (room.negotiation.lifecycle) {
      case 'settlement_locked':
      case 'settled':
        return 'settlement_locked';
      case 'disputed':
        return 'disputed';
      case 'archived':
        return 'archived';
      case 'counter_pending':
      case 'acceptance_pending':
        return counterState === 'expiring' ? 'compressed' : 'predatory';
      case 'active_negotiation':
        return 'predatory';
      case 'cold_open':
      case 'open':
        return 'watchful';
      case 'cancelled':
        return 'quiet';
      default:
        return 'quiet';
    }
  }

  public inferAudienceBand(room: DealRoomChannelState): DealRoomAudienceBand {
    const arbiterCount = room.arbiterCount ?? room.memberships.filter((membership) => membership.role === 'arbiter').length;
    const spectatorCount = room.spectatorCount ?? room.memberships.filter((membership) => membership.role === 'spectator').length;
    if (arbiterCount > 0 || room.hasArbiter) {
      return 'arbiter_heavy';
    }
    if ((room.participantCount + spectatorCount) >= 4 || (room.audienceHeatScore ?? 0) >= 75) {
      return 'private_heated';
    }
    if ((room.participantCount + spectatorCount) >= 2 || (room.audienceHeatScore ?? 0) >= 35) {
      return 'private_live';
    }
    return 'private_low';
  }

  public inferCounterWindowState(room: DealRoomChannelState, nowMs: number): DealRoomCounterWindowState {
    if (room.negotiation.lifecycle === 'settlement_locked' || room.negotiation.lifecycle === 'settled') {
      return 'sealed';
    }
    if (room.negotiation.lifecycle !== 'counter_pending' && room.negotiation.lifecycle !== 'acceptance_pending') {
      return 'none';
    }
    const expiry = getCounterWindowExpiry(room);
    if (typeof expiry !== 'number') {
      return 'open';
    }
    const remaining = expiry - nowMs;
    if (remaining <= 0) {
      return 'expired';
    }
    if (remaining <= 15000) {
      return 'expiring';
    }
    return 'open';
  }

  public inferSettlementPressure(room: DealRoomChannelState, nowMs: number): DealRoomSettlementPressureBand {
    const lifecycle = room.negotiation.lifecycle;
    if (lifecycle === 'settled' || lifecycle === 'archived') {
      return 'terminal';
    }
    if (lifecycle === 'settlement_locked') {
      return 'compressed';
    }
    if (lifecycle === 'counter_pending' || lifecycle === 'acceptance_pending') {
      return this.inferCounterWindowState(room, nowMs) === 'expiring' ? 'compressed' : 'negotiating';
    }
    if (lifecycle === 'active_negotiation') {
      return 'negotiating';
    }
    if (lifecycle === 'open' || lifecycle === 'cold_open') {
      return 'watchful';
    }
    return 'none';
  }

  public inferLeakageRisk(room: DealRoomChannelState): DealRoomLeakageRisk {
    if (room.suppressLeaksToGlobal) {
      return 'guarded';
    }
    if (room.isPrivateRoom && room.hasArbiter) {
      return 'guarded';
    }
    return room.isPrivateRoom ? 'none' : 'high';
  }

  public buildSnapshot(room: DealRoomChannelState, nowMs: number = Date.now()): DealRoomPolicySnapshot {
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
      canSpectatorsRead: this.canSpectatorsRead(room),
      canHelpersInject: false,
      canHatersInject: false,
      canAmbientInject: false,
      mountSurface: room.mountSurface,
      stageMood: this.inferStageMood(room, nowMs),
      audienceBand: this.inferAudienceBand(room),
      counterWindowState: this.inferCounterWindowState(room, nowMs),
      settlementPressure: this.inferSettlementPressure(room, nowMs),
      leakageRisk: this.inferLeakageRisk(room),
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
      readers: unique([...participants, ...arbiters, ...recorders, ...(this.canSpectatorsRead(room) ? spectators : [])]),
      shadowReaders: unique([...arbiters, ...room.memberships.filter((membership) => membership.canSeeShadow).map((membership) => membership.actorId)]),
    };
  }

  public buildFeedGuidance(room: DealRoomChannelState, nowMs: number = Date.now()): DealRoomFeedGuidance {
    const stageDirective = this.buildStageDirective(room, nowMs, 'SYSTEM', false);
    const transcriptDisposition = getTranscriptDisposition('SYSTEM', room.negotiation.lifecycle, false);
    return {
      roomId: room.roomId,
      stageMood: stageDirective.stageMood,
      audienceBand: stageDirective.audienceBand,
      counterWindowState: stageDirective.counterWindowState,
      settlementPressure: stageDirective.settlementPressure,
      notificationHint: room.preferredNotificationHint ?? DEAL_ROOM_NOTIFICATION_HINT_BY_KIND.SYSTEM,
      transcriptMode: DEAL_ROOM_LIFECYCLE_TRANSCRIPT_MODE[room.negotiation.lifecycle],
      transcriptDisposition,
      replayPriority: DEAL_ROOM_REPLAY_PRIORITY_BY_KIND.SYSTEM,
      leakageRisk: stageDirective.leakageRisk,
      primaryDirective: stageDirective,
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
    if (isPrivilegedActor(actor.actorKind)) {
      return true;
    }
    if (!membership) {
      return false;
    }
    if (membership.role === 'spectator' && !this.canSpectatorsRead(room)) {
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

  public canSpectatorsRead(room: DealRoomChannelState): boolean {
    if (room.negotiation.lifecycle === 'active_negotiation' || room.negotiation.lifecycle === 'counter_pending' || room.negotiation.lifecycle === 'acceptance_pending') {
      return Boolean(room.canSpectatorsReadDuringNegotiation);
    }
    if (room.negotiation.lifecycle === 'settlement_locked' || room.negotiation.lifecycle === 'settled' || room.negotiation.lifecycle === 'cancelled' || room.negotiation.lifecycle === 'archived') {
      return room.canSpectatorsReadAfterSettlement ?? true;
    }
    return false;
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

  public explainIngress(
    draft: DealRoomMessageDraft,
    context: DealRoomIngressContext,
  ): DealRoomIngressExplainability {
    const decision = this.evaluateIngress(draft, context);
    return decision.explainability ?? {
      modeSupported: this.isModeSupported(context.room.modeId),
      membershipFound: hasMembership(context.room, draft.actorId) || isPrivilegedActor(draft.actorKind),
      lifecycleAllowed: kindAllowedForLifecycle(context.room.negotiation.lifecycle, draft.kind),
      roleAllowed: kindAllowedForRole(draft.role, draft.kind),
      actorAllowed: kindAllowedForActor(draft.actorKind, draft.kind),
      commandAllowed: draft.kind !== 'COMMAND' || this.isCommandAllowed(draft.command, draft.role, context.room.negotiation.lifecycle),
      bodyValid: normalizeWhitespace(draft.body ?? '').length > 0 || DEAL_ROOM_BODY_LIMIT_BY_KIND[draft.kind] === 0,
      proofSatisfied: true,
      rateAllowed: true,
      mountAllowed: true,
      transcriptDisposition: getTranscriptDisposition(draft.kind, context.room.negotiation.lifecycle, decision.visibility === 'shadow_only'),
      notificationHint: decision.notificationHint ?? 'none',
      summary: decision.reasons,
    };
  }

  public evaluateIngress(
    draft: DealRoomMessageDraft,
    context: DealRoomIngressContext,
  ): DealRoomIngressDecision {
    const labels: string[] = [...(DEAL_ROOM_KIND_LABELS[draft.kind] ?? [])];
    const visibility = this.getVisibilityClass(context.room, context.actor);
    const rateWindow = DEAL_ROOM_DEFAULT_RATE_WINDOWS[draft.actorKind];
    const proof = this.getProofDirective(context.room, draft.kind);
    const normalizedBody = normalizeWhitespace(draft.body ?? '');
    const mountRule = getMountRule(draft.requestedMountSurface ?? context.mountSurface ?? context.room.mountSurface);
    const shadowOnly = context.actor.shadowMuted === true || context.actor.muted === true || context.moderation?.isShadowOnly === true;
    const transcriptDisposition = getTranscriptDisposition(draft.kind, context.room.negotiation.lifecycle, shadowOnly);
    const transcript = transcriptDirectiveForLifecycle(context.room.negotiation.lifecycle, shadowOnly ? 'shadow_only' : visibility);
    const notificationHint = this.getNotificationHint(draft, context.room);
    const stageDirective = this.buildStageDirective(context.room, context.nowMs, draft.kind, shadowOnly);
    const fanoutDirective = this.buildFanoutDirective(draft, context.room, context.actor, visibility, shadowOnly);
    const replayDirective = this.buildReplayDirective(draft, context.room, transcriptDisposition);
    const counterplay = this.buildCounterplayPlan(draft, context.room, context.nowMs);
    const commandRule = getCommandRule(draft.command);
    const mountAllowed = mountRule.allowedKinds.includes(draft.kind);
    const membershipFound = hasMembership(context.room, draft.actorId) || isPrivilegedActor(draft.actorKind);

    const buildExplainability = (
      summary: readonly string[],
      overrides?: Partial<DealRoomIngressExplainability>,
    ): DealRoomIngressExplainability => ({
      modeSupported: this.isModeSupported(context.room.modeId),
      membershipFound,
      lifecycleAllowed: kindAllowedForLifecycle(context.room.negotiation.lifecycle, draft.kind),
      roleAllowed: kindAllowedForRole(draft.role, draft.kind),
      actorAllowed: kindAllowedForActor(draft.actorKind, draft.kind),
      commandAllowed: draft.kind !== 'COMMAND' || this.isCommandAllowed(draft.command, draft.role, context.room.negotiation.lifecycle),
      bodyValid: DEAL_ROOM_BODY_LIMIT_BY_KIND[draft.kind] === 0 || normalizedBody.length > 0,
      proofSatisfied: proof.requirement === 'none' || Boolean(draft.clientProofHash) || proof.shouldGenerateServerHash,
      rateAllowed: true,
      mountAllowed,
      transcriptDisposition,
      notificationHint,
      summary,
      ...overrides,
    });

    if (draft.channelId !== DEAL_ROOM_CHANNEL_ID) {
      return this.reject(
        draft,
        context,
        'KIND_NOT_ALLOWED',
        ['wrong channel specialist received draft'],
        rateWindow,
        proof,
        transcript,
        visibility,
        normalizedBody,
        labels,
        {
          notificationHint,
          transcriptDisposition,
          fanoutDirective,
          replayDirective,
          stageDirective,
          counterplay,
          mountRule,
          commandRule,
          explainability: buildExplainability(['wrong channel specialist received draft'], { mountAllowed }),
        },
      );
    }

    if (!this.isModeSupported(context.room.modeId)) {
      return this.reject(
        draft,
        context,
        'MODE_NOT_ALLOWED',
        [`mode ${context.room.modeId} does not expose DEAL_ROOM`],
        rateWindow,
        proof,
        transcript,
        visibility,
        normalizedBody,
        labels,
        {
          notificationHint,
          transcriptDisposition,
          fanoutDirective,
          replayDirective,
          stageDirective,
          counterplay,
          mountRule,
          commandRule,
          explainability: buildExplainability([`mode ${context.room.modeId} does not expose DEAL_ROOM`], { modeSupported: false }),
        },
      );
    }

    if (!mountAllowed) {
      return this.reject(
        draft,
        context,
        'MOUNT_RESTRICTED',
        [`mount surface ${(draft.requestedMountSurface ?? context.mountSurface ?? context.room.mountSurface ?? 'UNKNOWN')} does not permit ${draft.kind}`],
        rateWindow,
        proof,
        transcript,
        visibility,
        normalizedBody,
        [...labels, 'mount_restricted'],
        {
          notificationHint,
          transcriptDisposition,
          fanoutDirective,
          replayDirective,
          stageDirective,
          counterplay,
          mountRule,
          commandRule,
          explainability: buildExplainability([`mount surface ${(draft.requestedMountSurface ?? context.mountSurface ?? context.room.mountSurface ?? 'UNKNOWN')} does not permit ${draft.kind}`], { mountAllowed: false }),
        },
      );
    }

    if (!membershipFound) {
      return this.reject(
        draft,
        context,
        'ROOM_NOT_JOINED',
        ['actor is not a member of this deal room'],
        rateWindow,
        proof,
        transcript,
        visibility,
        normalizedBody,
        labels,
        {
          notificationHint,
          transcriptDisposition,
          fanoutDirective,
          replayDirective,
          stageDirective,
          counterplay,
          mountRule,
          commandRule,
          explainability: buildExplainability(['actor is not a member of this deal room'], { membershipFound: false }),
        },
      );
    }

    if (!kindAllowedForActor(draft.actorKind, draft.kind)) {
      const code: DealRoomRejectionCode = draft.actorKind === 'helper'
        ? 'HELPER_NOT_ALLOWED'
        : draft.actorKind === 'hater'
          ? 'HATER_NOT_ALLOWED'
          : draft.actorKind === 'ambient_npc'
            ? 'AMBIENT_NOT_ALLOWED'
            : 'ACTOR_KIND_NOT_ALLOWED';
      return this.reject(
        draft,
        context,
        code,
        [`actor kind ${draft.actorKind} cannot emit ${draft.kind} in DEAL_ROOM`],
        rateWindow,
        proof,
        transcript,
        visibility,
        normalizedBody,
        labels,
        {
          notificationHint,
          transcriptDisposition,
          fanoutDirective,
          replayDirective,
          stageDirective,
          counterplay,
          mountRule,
          commandRule,
          explainability: buildExplainability([`actor kind ${draft.actorKind} cannot emit ${draft.kind} in DEAL_ROOM`], { actorAllowed: false }),
        },
      );
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
      return this.reject(
        draft,
        context,
        code,
        [`kind ${draft.kind} is not available during lifecycle ${context.room.negotiation.lifecycle}`],
        rateWindow,
        proof,
        transcript,
        visibility,
        normalizedBody,
        labels,
        {
          notificationHint,
          transcriptDisposition,
          fanoutDirective,
          replayDirective,
          stageDirective,
          counterplay,
          mountRule,
          commandRule,
          explainability: buildExplainability([`kind ${draft.kind} is not available during lifecycle ${context.room.negotiation.lifecycle}`], { lifecycleAllowed: false }),
        },
      );
    }

    if (!kindAllowedForRole(draft.role, draft.kind) && !isPrivilegedActor(draft.actorKind)) {
      return this.reject(
        draft,
        context,
        draft.role === 'spectator' ? 'SPECTATOR_READ_ONLY' : 'ROLE_NOT_ALLOWED',
        [`role ${draft.role} may not emit ${draft.kind}`],
        rateWindow,
        proof,
        transcript,
        visibility,
        normalizedBody,
        labels,
        {
          notificationHint,
          transcriptDisposition,
          fanoutDirective,
          replayDirective,
          stageDirective,
          counterplay,
          mountRule,
          commandRule,
          explainability: buildExplainability([`role ${draft.role} may not emit ${draft.kind}`], { roleAllowed: false }),
        },
      );
    }

    if (draft.isEdit) {
      return this.reject(
        draft,
        context,
        'EDIT_FORBIDDEN',
        ['deal room is append-only once a message exists'],
        rateWindow,
        proof,
        transcript,
        visibility,
        normalizedBody,
        labels,
        {
          notificationHint,
          transcriptDisposition,
          fanoutDirective,
          replayDirective,
          stageDirective,
          counterplay,
          mountRule,
          commandRule,
          explainability: buildExplainability(['deal room is append-only once a message exists']),
        },
      );
    }

    if (draft.isDelete) {
      return this.reject(
        draft,
        context,
        'DELETE_FORBIDDEN',
        ['deal room messages are not deletable through channel law'],
        rateWindow,
        proof,
        transcript,
        visibility,
        normalizedBody,
        labels,
        {
          notificationHint,
          transcriptDisposition,
          fanoutDirective,
          replayDirective,
          stageDirective,
          counterplay,
          mountRule,
          commandRule,
          explainability: buildExplainability(['deal room messages are not deletable through channel law']),
        },
      );
    }

    if (Array.isArray(draft.attachments) && draft.attachments.length > context.room.maxAttachmentCount) {
      return this.reject(
        draft,
        context,
        'ATTACHMENT_LIMIT',
        [`attachment count ${draft.attachments.length} exceeds limit ${context.room.maxAttachmentCount}`],
        rateWindow,
        proof,
        transcript,
        visibility,
        normalizedBody,
        [...labels, 'attachment_limit'],
        {
          notificationHint,
          transcriptDisposition,
          fanoutDirective,
          replayDirective,
          stageDirective,
          counterplay,
          mountRule,
          commandRule,
          explainability: buildExplainability([`attachment count ${draft.attachments.length} exceeds limit ${context.room.maxAttachmentCount}`]),
        },
      );
    }

    if (draft.isResend && context.room.immutableOffers && (
      draft.kind === 'DEAL_OPEN'
      || draft.kind === 'DEAL_PROPOSAL'
      || draft.kind === 'DEAL_COUNTER'
      || draft.kind === 'DEAL_ACCEPT'
      || draft.kind === 'DEAL_REJECT'
      || draft.kind === 'DEAL_CANCEL'
    )) {
      return this.reject(
        draft,
        context,
        'RESEND_NOT_ALLOWED',
        ['immutable offer artifacts may not be resent through DEAL_ROOM law'],
        rateWindow,
        proof,
        transcript,
        visibility,
        normalizedBody,
        [...labels, 'immutable_offer'],
        {
          notificationHint,
          transcriptDisposition,
          fanoutDirective,
          replayDirective,
          stageDirective,
          counterplay,
          mountRule,
          commandRule,
          explainability: buildExplainability(['immutable offer artifacts may not be resent through DEAL_ROOM law']),
        },
      );
    }

    if (shadowOnly) {
      labels.push('muted');
      const shadowTranscriptDisposition = getTranscriptDisposition(draft.kind, context.room.negotiation.lifecycle, true);
      const shadowFanoutDirective = this.buildFanoutDirective(draft, context.room, context.actor, 'shadow_only', true);
      const shadowReplayDirective = this.buildReplayDirective(draft, context.room, shadowTranscriptDisposition);
      return {
        status: 'allow_shadow',
        reasons: ['actor is muted, shadow-muted, or moderation-shadowed; message may only enter shadow lane'],
        rateWindow,
        proof,
        transcript: { ...transcript, visibilityClass: 'shadow_only' },
        visibility: 'shadow_only',
        shouldFanout: false,
        shouldPersist: shadowTranscriptDisposition !== 'drop' && shadowTranscriptDisposition !== 'ephemeral_only',
        shouldEmitTelemetry: true,
        shouldEmitReplay: shadowReplayDirective.shouldReplay,
        shouldSuppressLeak: true,
        shouldEscalateDispute: false,
        shouldLockSettlement: false,
        normalizedBody,
        auditLabels: unique(labels),
        notificationHint: 'none',
        transcriptDisposition: shadowTranscriptDisposition,
        fanoutClass: shadowFanoutDirective.fanoutClass,
        shadowLane: shadowFanoutDirective.shadowLane,
        stageDirective,
        fanoutDirective: shadowFanoutDirective,
        replayDirective: shadowReplayDirective,
        counterplay,
        explainability: buildExplainability(['actor is muted, shadow-muted, or moderation-shadowed; message may only enter shadow lane']),
        mountRule,
        commandRule,
      };
    }

    if (context.moderation?.requiresAdminReview && context.room.moderationHold && !isPrivilegedActor(draft.actorKind)) {
      return {
        status: 'defer',
        reasons: ['room is under moderation hold; non-privileged negotiation writes are deferred'],
        rateWindow,
        proof,
        transcript,
        visibility,
        shouldFanout: false,
        shouldPersist: false,
        shouldEmitTelemetry: true,
        shouldEmitReplay: false,
        shouldSuppressLeak: true,
        shouldEscalateDispute: false,
        shouldLockSettlement: false,
        normalizedBody,
        auditLabels: unique([...labels, 'deferred', 'moderation_hold']),
        notificationHint: 'moderation_alert',
        transcriptDisposition: 'drop',
        fanoutClass: 'none',
        shadowLane: 'MODERATION_SHADOW',
        stageDirective,
        fanoutDirective: {
          fanoutClass: 'internal_only',
          shadowLane: 'MODERATION_SHADOW',
          includeParticipants: false,
          includeArbiters: true,
          includeRecorders: true,
          includeSpectators: false,
          includeModeration: true,
          suppressClientEcho: true,
          reason: 'moderation hold captures event without participant fanout',
        },
        replayDirective: {
          priority: 'low',
          shouldReplay: false,
          shouldSnapshotAfterAppend: false,
          shouldPersistAuditOnly: true,
          reason: 'deferred moderation events persist as audit-only material',
        },
        counterplay,
        explainability: buildExplainability(['room is under moderation hold; non-privileged negotiation writes are deferred']),
        mountRule,
        commandRule,
      };
    }

    const bodyLimit = bodyLimitForKind(draft.kind, context.room);
    if (bodyLimit > 0 && normalizedBody.length === 0) {
      return this.reject(
        draft,
        context,
        'EMPTY_BODY',
        ['body is empty after normalization'],
        rateWindow,
        proof,
        transcript,
        visibility,
        normalizedBody,
        labels,
        {
          notificationHint,
          transcriptDisposition,
          fanoutDirective,
          replayDirective,
          stageDirective,
          counterplay,
          mountRule,
          commandRule,
          explainability: buildExplainability(['body is empty after normalization'], { bodyValid: false }),
        },
      );
    }

    if (bodyLimit > 0 && normalizedBody.length > bodyLimit) {
      return this.reject(
        draft,
        context,
        'MAX_LENGTH',
        [`body length ${normalizedBody.length} exceeds limit ${bodyLimit}`],
        rateWindow,
        proof,
        transcript,
        visibility,
        normalizedBody,
        labels,
        {
          notificationHint,
          transcriptDisposition,
          fanoutDirective,
          replayDirective,
          stageDirective,
          counterplay,
          mountRule,
          commandRule,
          explainability: buildExplainability([`body length ${normalizedBody.length} exceeds limit ${bodyLimit}`], { bodyValid: false }),
        },
      );
    }

    if (!requiresCounterparty(context.room) && !['DEAL_OPEN', 'SYSTEM', 'PRESENCE', 'TYPING', 'COMMAND'].includes(draft.kind)) {
      return this.reject(
        draft,
        context,
        'COUNTERPARTY_REQUIRED',
        ['counterparty must exist before this kind of message can enter transcript'],
        rateWindow,
        proof,
        transcript,
        visibility,
        normalizedBody,
        labels,
        {
          notificationHint,
          transcriptDisposition,
          fanoutDirective,
          replayDirective,
          stageDirective,
          counterplay,
          mountRule,
          commandRule,
          explainability: buildExplainability(['counterparty must exist before this kind of message can enter transcript']),
        },
      );
    }

    if (draft.kind === 'DEAL_PROPOSAL' && context.room.negotiation.summaryLocked) {
      return this.reject(
        draft,
        context,
        'ROOM_LOCKED',
        ['proposal flow is locked by summary state'],
        rateWindow,
        proof,
        transcript,
        visibility,
        normalizedBody,
        [...labels, 'summary_locked'],
        {
          notificationHint,
          transcriptDisposition,
          fanoutDirective,
          replayDirective,
          stageDirective,
          counterplay,
          mountRule,
          commandRule,
          explainability: buildExplainability(['proposal flow is locked by summary state']),
        },
      );
    }

    if (
      (draft.kind === 'DEAL_PROPOSAL' || draft.kind === 'DEAL_COUNTER' || draft.kind === 'DEAL_DISPUTE')
      && proof.parentSequenceRequired
      && typeof draft.parentSequence !== 'number'
    ) {
      return this.reject(
        draft,
        context,
        'PROOF_REQUIRED',
        ['proposal, counter, and dispute events require a parent sequence'],
        rateWindow,
        proof,
        transcript,
        visibility,
        normalizedBody,
        [...labels, 'parent_required'],
        {
          notificationHint,
          transcriptDisposition,
          fanoutDirective,
          replayDirective,
          stageDirective,
          counterplay,
          mountRule,
          commandRule,
          explainability: buildExplainability(['proposal, counter, and dispute events require a parent sequence'], { proofSatisfied: false }),
        },
      );
    }

    if (typeof draft.parentSequence === 'number' && draft.parentSequence > context.room.lastSequence) {
      return this.reject(
        draft,
        context,
        'PARENT_SEQUENCE_MISMATCH',
        [`parent sequence ${draft.parentSequence} exceeds room last sequence ${context.room.lastSequence}`],
        rateWindow,
        proof,
        transcript,
        visibility,
        normalizedBody,
        [...labels, 'parent_mismatch'],
        {
          notificationHint,
          transcriptDisposition,
          fanoutDirective,
          replayDirective,
          stageDirective,
          counterplay,
          mountRule,
          commandRule,
          explainability: buildExplainability([`parent sequence ${draft.parentSequence} exceeds room last sequence ${context.room.lastSequence}`], { proofSatisfied: false }),
        },
      );
    }

    if (typeof draft.sequenceHint === 'number' && draft.sequenceHint <= context.room.lastSequence && proof.requirement !== 'none') {
      return this.reject(
        draft,
        context,
        'PROOF_CHAIN_BROKEN',
        [`sequence hint ${draft.sequenceHint} does not advance beyond room last sequence ${context.room.lastSequence}`],
        rateWindow,
        proof,
        transcript,
        visibility,
        normalizedBody,
        [...labels, 'proof_chain_broken'],
        {
          notificationHint,
          transcriptDisposition,
          fanoutDirective,
          replayDirective,
          stageDirective,
          counterplay,
          mountRule,
          commandRule,
          explainability: buildExplainability([`sequence hint ${draft.sequenceHint} does not advance beyond room last sequence ${context.room.lastSequence}`], { proofSatisfied: false }),
        },
      );
    }

    if (proof.requirement !== 'none' && draft.clientProofHash && draft.clientProofHash.length < 8) {
      return this.reject(
        draft,
        context,
        'PROOF_REQUIRED',
        ['client proof hash is malformed or too short'],
        rateWindow,
        proof,
        transcript,
        visibility,
        normalizedBody,
        labels,
        {
          notificationHint,
          transcriptDisposition,
          fanoutDirective,
          replayDirective,
          stageDirective,
          counterplay,
          mountRule,
          commandRule,
          explainability: buildExplainability(['client proof hash is malformed or too short'], { proofSatisfied: false }),
        },
      );
    }

    if (draft.kind === 'DEAL_ACCEPT' && (!context.room.hasArbiter && context.room.negotiation.lifecycle === 'settlement_locked')) {
      return this.reject(
        draft,
        context,
        'ARBITER_REQUIRED',
        ['settlement lock in this room requires arbiter presence before acceptance may finalize'],
        rateWindow,
        proof,
        transcript,
        visibility,
        normalizedBody,
        [...labels, 'arbiter_required'],
        {
          notificationHint,
          transcriptDisposition,
          fanoutDirective,
          replayDirective,
          stageDirective,
          counterplay,
          mountRule,
          commandRule,
          explainability: buildExplainability(['settlement lock in this room requires arbiter presence before acceptance may finalize']),
        },
      );
    }

    const latestTimestamp = mostRecentTimestamp(context.recentSendTimestampsMs);
    if (!context.actor.canBypassRateLimit && typeof latestTimestamp === 'number' && rateWindow.cooldownMs > 0 && (context.nowMs - latestTimestamp) < rateWindow.cooldownMs) {
      return this.reject(
        draft,
        context,
        'COOLDOWN_ACTIVE',
        [`cooldown ${rateWindow.cooldownMs}ms remains active for actor ${draft.actorId}`],
        rateWindow,
        proof,
        transcript,
        visibility,
        normalizedBody,
        [...labels, 'cooldown_active'],
        {
          notificationHint,
          transcriptDisposition,
          fanoutDirective,
          replayDirective,
          stageDirective,
          counterplay,
          mountRule,
          commandRule,
          explainability: buildExplainability([`cooldown ${rateWindow.cooldownMs}ms remains active for actor ${draft.actorId}`], { rateAllowed: false }),
        },
      );
    }

    const recentBurst = countRecent(rateWindow.burstWindowMs, context.nowMs, context.recentSendTimestampsMs);
    const recentSustained = countRecent(rateWindow.sustainedWindowMs, context.nowMs, context.recentSendTimestampsMs);
    if (!context.actor.canBypassRateLimit && recentBurst >= rateWindow.burstLimit && rateWindow.burstLimit > 0) {
      return this.reject(
        draft,
        context,
        'BURST_LIMIT',
        [`burst limit ${rateWindow.burstLimit} exceeded within ${rateWindow.burstWindowMs}ms`],
        rateWindow,
        proof,
        transcript,
        visibility,
        normalizedBody,
        [...labels, 'burst_limit'],
        {
          notificationHint,
          transcriptDisposition,
          fanoutDirective,
          replayDirective,
          stageDirective,
          counterplay,
          mountRule,
          commandRule,
          explainability: buildExplainability([`burst limit ${rateWindow.burstLimit} exceeded within ${rateWindow.burstWindowMs}ms`], { rateAllowed: false }),
        },
      );
    }
    if (!context.actor.canBypassRateLimit && recentSustained >= rateWindow.sustainedLimit && rateWindow.sustainedLimit > 0) {
      return this.reject(
        draft,
        context,
        'BURST_LIMIT',
        [`sustained limit ${rateWindow.sustainedLimit} exceeded within ${rateWindow.sustainedWindowMs}ms`],
        rateWindow,
        proof,
        transcript,
        visibility,
        normalizedBody,
        [...labels, 'sustained_limit'],
        {
          notificationHint,
          transcriptDisposition,
          fanoutDirective,
          replayDirective,
          stageDirective,
          counterplay,
          mountRule,
          commandRule,
          explainability: buildExplainability([`sustained limit ${rateWindow.sustainedLimit} exceeded within ${rateWindow.sustainedWindowMs}ms`], { rateAllowed: false }),
        },
      );
    }

    if (
      draft.kind === 'DEAL_PROPOSAL'
      && context.recentBodies.some((body) => normalizeWhitespace(body) === normalizedBody)
    ) {
      labels.push('duplicate_candidate');
      return this.reject(
        draft,
        context,
        'DUPLICATE_PROPOSAL',
        ['proposal body duplicates a recent proposal body'],
        rateWindow,
        proof,
        transcript,
        visibility,
        normalizedBody,
        labels,
        {
          notificationHint,
          transcriptDisposition,
          fanoutDirective,
          replayDirective,
          stageDirective,
          counterplay,
          mountRule,
          commandRule,
          explainability: buildExplainability(['proposal body duplicates a recent proposal body']),
        },
      );
    }

    if (
      normalizedBody.length > 0
      && context.recentKinds.includes(draft.kind)
      && context.recentBodies.some((body) => normalizeWhitespace(body) === normalizedBody)
      && draft.kind !== 'DEAL_PROPOSAL'
      && draft.kind !== 'DEAL_COUNTER'
      && draft.kind !== 'DEAL_OPEN'
    ) {
      return this.reject(
        draft,
        context,
        'DUPLICATE_SPAM',
        ['message duplicates recent same-kind content and is treated as negotiation spam'],
        rateWindow,
        proof,
        transcript,
        visibility,
        normalizedBody,
        [...labels, 'duplicate_spam'],
        {
          notificationHint,
          transcriptDisposition,
          fanoutDirective,
          replayDirective,
          stageDirective,
          counterplay,
          mountRule,
          commandRule,
          explainability: buildExplainability(['message duplicates recent same-kind content and is treated as negotiation spam']),
        },
      );
    }

    if (
      draft.kind === 'DEAL_ACCEPT'
      && context.room.negotiation.lifecycle !== 'acceptance_pending'
      && context.room.negotiation.lifecycle !== 'counter_pending'
      && context.room.negotiation.lifecycle !== 'active_negotiation'
    ) {
      return this.reject(
        draft,
        context,
        'SETTLEMENT_PENDING',
        ['accept may only occur while a live offer exists'],
        rateWindow,
        proof,
        transcript,
        visibility,
        normalizedBody,
        labels,
        {
          notificationHint,
          transcriptDisposition,
          fanoutDirective,
          replayDirective,
          stageDirective,
          counterplay,
          mountRule,
          commandRule,
          explainability: buildExplainability(['accept may only occur while a live offer exists']),
        },
      );
    }

    if (draft.kind === 'DEAL_ESCALATION' && context.room.negotiation.lifecycle !== 'disputed') {
      return this.reject(
        draft,
        context,
        'DISPUTE_LOCK_REQUIRED',
        ['deal escalation is only legal after dispute state is opened'],
        rateWindow,
        proof,
        transcript,
        visibility,
        normalizedBody,
        [...labels, 'dispute_lock_required'],
        {
          notificationHint,
          transcriptDisposition,
          fanoutDirective,
          replayDirective,
          stageDirective,
          counterplay,
          mountRule,
          commandRule,
          explainability: buildExplainability(['deal escalation is only legal after dispute state is opened']),
        },
      );
    }

    if (draft.kind === 'COMMAND' && !this.isCommandAllowed(draft.command, draft.role, context.room.negotiation.lifecycle, context.room, draft.actorKind)) {
      return this.reject(
        draft,
        context,
        'COMMAND_NOT_ALLOWED',
        [`command ${draft.command ?? '(none)'} is not allowed for role ${draft.role} in lifecycle ${context.room.negotiation.lifecycle}`],
        rateWindow,
        proof,
        transcript,
        visibility,
        normalizedBody,
        labels,
        {
          notificationHint,
          transcriptDisposition,
          fanoutDirective,
          replayDirective,
          stageDirective,
          counterplay,
          mountRule,
          commandRule,
          explainability: buildExplainability([`command ${draft.command ?? '(none)'} is not allowed for role ${draft.role} in lifecycle ${context.room.negotiation.lifecycle}`], { commandAllowed: false }),
        },
      );
    }

    if (commandRule?.requiresArbiter && !context.room.hasArbiter && draft.actorKind !== 'admin' && draft.actorKind !== 'moderator') {
      return this.reject(
        draft,
        context,
        'ARBITER_REQUIRED',
        [`command ${commandRule.command} requires arbiter presence in this room`],
        rateWindow,
        proof,
        transcript,
        visibility,
        normalizedBody,
        [...labels, 'arbiter_required'],
        {
          notificationHint,
          transcriptDisposition,
          fanoutDirective,
          replayDirective,
          stageDirective,
          counterplay,
          mountRule,
          commandRule,
          explainability: buildExplainability([`command ${commandRule.command} requires arbiter presence in this room`]),
        },
      );
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
    if (draft.kind === 'DEAL_PROPOSAL' || draft.kind === 'DEAL_COUNTER') {
      labels.push('negotiation_artifact');
    }
    if (fanoutDirective.shadowLane) {
      labels.push(fanoutDirective.shadowLane.toLowerCase());
    }

    return {
      status: proof.requirement === 'none' ? 'allow' : 'allow_with_proof',
      reasons: ['message satisfies role, lifecycle, proof, rate, and mount law for DEAL_ROOM'],
      rateWindow,
      proof,
      transcript,
      visibility,
      shouldFanout: fanoutDirective.fanoutClass !== 'none' && fanoutDirective.fanoutClass !== 'shadow_only' && draft.kind !== 'CURSOR' && draft.kind !== 'TYPING',
      shouldPersist: transcriptDisposition !== 'drop' && transcriptDisposition !== 'ephemeral_only',
      shouldEmitTelemetry: true,
      shouldEmitReplay: replayDirective.shouldReplay,
      shouldSuppressLeak: context.room.suppressLeaksToGlobal || context.moderation?.forceInternalVisibility === true,
      shouldEscalateDispute: draft.kind === 'DEAL_DISPUTE' || draft.kind === 'DEAL_ESCALATION' || counterplay.shouldEscalateDispute,
      shouldLockSettlement: draft.kind === 'DEAL_ACCEPT' || counterplay.shouldLockForAcceptance,
      normalizedBody,
      auditLabels: unique(labels),
      notificationHint,
      transcriptDisposition,
      fanoutClass: fanoutDirective.fanoutClass,
      shadowLane: fanoutDirective.shadowLane,
      stageDirective,
      fanoutDirective,
      replayDirective,
      counterplay,
      explainability: buildExplainability(['message satisfies role, lifecycle, proof, rate, and mount law for DEAL_ROOM']),
      mountRule,
      commandRule,
    };
  }

  public isCommandAllowed(
    command: DealRoomCommand | undefined,
    role: DealRoomMembershipRole,
    lifecycle: DealRoomLifecycleState,
    room?: DealRoomChannelState,
    actorKind?: DealRoomActorKind,
  ): boolean {
    if (!command) {
      return false;
    }
    const rule = getCommandRule(command);
    if (!rule) {
      return false;
    }
    const roleAllowed = rule.allowedRoles.includes(role)
      || (actorKind === 'admin' || actorKind === 'moderator');
    if (!roleAllowed) {
      return false;
    }
    if (rule.blockedLifecycles.includes(lifecycle)) {
      return false;
    }
    if (rule.requiresCounterparty && room && !requiresCounterparty(room)) {
      return false;
    }
    if (rule.requiresArbiter && room && !room.hasArbiter && actorKind !== 'admin' && actorKind !== 'moderator') {
      return false;
    }
    if (command === '/reopen' && room) {
      if (!room.negotiation.allowReopenAfterCancel) {
        return false;
      }
      if (room.negotiation.requiresArbiterForReopen && !room.hasArbiter && actorKind !== 'admin' && actorKind !== 'moderator') {
        return false;
      }
    }
    return true;
  }

  public getNotificationHint(
    draft: DealRoomMessageDraft,
    room: DealRoomChannelState,
  ): DealRoomNotificationHint {
    if (room.preferredNotificationHint && draft.kind === 'SYSTEM') {
      return room.preferredNotificationHint;
    }
    if (room.negotiation.lifecycle === 'disputed' && (draft.kind === 'SYSTEM' || draft.kind === 'ADMIN_NOTICE')) {
      return 'dispute_banner';
    }
    return DEAL_ROOM_NOTIFICATION_HINT_BY_KIND[draft.kind];
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

  public summarizeRestrictions(room: DealRoomChannelState, nowMs: number = Date.now()): readonly string[] {
    const restrictions: string[] = [];
    restrictions.push(`lifecycle=${room.negotiation.lifecycle}`);
    restrictions.push(`transcriptMode=${DEAL_ROOM_LIFECYCLE_TRANSCRIPT_MODE[room.negotiation.lifecycle]}`);
    restrictions.push(`proofRequired=${String(room.proof.requiresProof)}`);
    restrictions.push(`immutableOffers=${String(room.immutableOffers)}`);
    restrictions.push(`suppressLeaksToGlobal=${String(room.suppressLeaksToGlobal)}`);
    restrictions.push(`participantCount=${String(room.participantCount)}`);
    restrictions.push(`mountSurface=${String(room.mountSurface ?? 'UNKNOWN')}`);
    restrictions.push(`counterWindowState=${this.inferCounterWindowState(room, nowMs)}`);
    restrictions.push(`settlementPressure=${this.inferSettlementPressure(room, nowMs)}`);
    restrictions.push(`leakageRisk=${this.inferLeakageRisk(room)}`);
    if (room.negotiation.summaryLocked) {
      restrictions.push('summaryLocked=true');
    }
    if (room.hasArbiter) {
      restrictions.push('arbiterPresent=true');
    }
    if (room.negotiation.counterpartyActorIds.length === 0) {
      restrictions.push('counterpartyMissing=true');
    }
    if (room.moderationHold) {
      restrictions.push('moderationHold=true');
    }
    if (room.canSpectatorsReadDuringNegotiation) {
      restrictions.push('spectatorReadDuringNegotiation=true');
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

  private buildStageDirective(
    room: DealRoomChannelState,
    nowMs: number,
    kind: DealRoomMessageKind,
    shadowOnly: boolean,
  ): DealRoomStageDirective {
    const stageMood = this.inferStageMood(room, nowMs);
    const counterWindowState = this.inferCounterWindowState(room, nowMs);
    const settlementPressure = this.inferSettlementPressure(room, nowMs);
    const leakageRisk = this.inferLeakageRisk(room);
    const audienceBand = this.inferAudienceBand(room);

    let kindDirective: DealRoomStageDirectiveKind = 'quiet_append';
    let reason = 'default negotiation append';
    if (room.negotiation.lifecycle === 'archived') {
      kindDirective = 'archive_lock';
      reason = 'archived deal room keeps additions extremely narrow';
    } else if (room.negotiation.lifecycle === 'disputed') {
      kindDirective = 'dispute_lock';
      reason = 'dispute state narrows the room into evidence and escalation';
    } else if (room.negotiation.lifecycle === 'settlement_locked' || kind === 'DEAL_ACCEPT' || kind === 'DEAL_PROOF' || kind === 'DEAL_RECAP') {
      kindDirective = 'settlement_seal';
      reason = 'settlement artifacts deserve seal-ready stage treatment';
    } else if (room.negotiation.lifecycle === 'acceptance_pending') {
      kindDirective = 'acceptance_focus';
      reason = 'acceptance window compresses optional speech';
    } else if (room.negotiation.lifecycle === 'counter_pending' || kind === 'DEAL_COUNTER' || kind === 'DEAL_PROPOSAL') {
      kindDirective = 'counter_window_highlight';
      reason = 'counterflow should remain legible as live leverage';
    } else if (proofKindRequiresHighlight(kind)) {
      kindDirective = 'proof_hold';
      reason = 'proof-bearing artifacts deserve highlighted ledger presence';
    }
    return {
      kind: kindDirective,
      stageMood,
      audienceBand,
      counterWindowState,
      settlementPressure,
      leakageRisk,
      shouldHighlightProof: proofKindRequiresHighlight(kind),
      shouldCompressComposer: stageMood === 'compressed' || stageMood === 'settlement_locked' || stageMood === 'disputed',
      shouldRevealDelay: shadowOnly ? false : Boolean(room.revealDelaysEnabled && (kind === 'DEAL_PROOF' || kind === 'DEAL_RECAP' || kind === 'DEAL_ESCALATION')),
      shouldPinThread: kind === 'DEAL_PROPOSAL' || kind === 'DEAL_COUNTER' || kind === 'DEAL_ACCEPT' || kind === 'DEAL_DISPUTE',
      shouldElevateBanner: kind === 'DEAL_ACCEPT' || kind === 'DEAL_DISPUTE' || kind === 'DEAL_PROOF' || kind === 'ADMIN_NOTICE',
      reason,
    };
  }

  private buildFanoutDirective(
    draft: DealRoomMessageDraft,
    room: DealRoomChannelState,
    actor: DealRoomActorProfile,
    visibility: DealRoomVisibilityClass,
    shadowOnly: boolean,
  ): DealRoomFanoutDirective {
    if (shadowOnly || visibility === 'shadow_only') {
      return {
        fanoutClass: 'shadow_only',
        shadowLane: draft.requestedShadowLane ?? DEAL_ROOM_SHADOW_LANE_BY_KIND[draft.kind],
        includeParticipants: false,
        includeArbiters: actor.canShadowInspect === true || room.hasArbiter,
        includeRecorders: false,
        includeSpectators: false,
        includeModeration: true,
        suppressClientEcho: true,
        reason: 'shadow-routed content remains inspectable without visible participant fanout',
      };
    }

    if (visibility === 'private_internal') {
      return {
        fanoutClass: 'internal_only',
        shadowLane: DEAL_ROOM_SHADOW_LANE_BY_KIND[draft.kind],
        includeParticipants: false,
        includeArbiters: true,
        includeRecorders: true,
        includeSpectators: false,
        includeModeration: true,
        suppressClientEcho: false,
        reason: 'internal-only visibility restricts fanout to arbitration and recorder lanes',
      };
    }

    const includeSpectators = this.canSpectatorsRead(room)
      && draft.kind !== 'DEAL_PROPOSAL'
      && draft.kind !== 'DEAL_COUNTER'
      && draft.kind !== 'PLAYER'
      && draft.kind !== 'PLAYER_RESPONSE';

    return {
      fanoutClass: room.hasArbiter ? 'participants_plus_arbiter' : 'participants_only',
      shadowLane: DEAL_ROOM_SHADOW_LANE_BY_KIND[draft.kind],
      includeParticipants: true,
      includeArbiters: room.hasArbiter,
      includeRecorders: draft.kind === 'DEAL_RECAP' || draft.kind === 'DEAL_PROOF' || draft.kind === 'DEAL_ACCEPT' || draft.kind === 'DEAL_DISPUTE' || draft.kind === 'DEAL_ESCALATION',
      includeSpectators,
      includeModeration: actor.actorKind === 'admin' || actor.actorKind === 'moderator' || room.hasArbiter,
      suppressClientEcho: false,
      reason: room.hasArbiter
        ? 'deal room remains participant-private with arbiter witness'
        : 'deal room remains participant-private without arbiter extension',
    };
  }

  private buildReplayDirective(
    draft: DealRoomMessageDraft,
    room: DealRoomChannelState,
    disposition: DealRoomTranscriptDisposition,
  ): DealRoomReplayDirective {
    const priority = DEAL_ROOM_REPLAY_PRIORITY_BY_KIND[draft.kind];
    if (disposition === 'drop' || disposition === 'ephemeral_only') {
      return {
        priority: 'none',
        shouldReplay: false,
        shouldSnapshotAfterAppend: false,
        shouldPersistAuditOnly: draft.kind === 'CURSOR' || draft.kind === 'TYPING' || draft.kind === 'PRESENCE',
        reason: 'ephemeral or dropped messages do not enter replay lane',
      };
    }
    return {
      priority,
      shouldReplay: Boolean(room.replayEnabled ?? true) && priority !== 'none',
      shouldSnapshotAfterAppend: priority === 'critical' || priority === 'high' || draft.kind === 'DEAL_ACCEPT' || draft.kind === 'DEAL_PROOF',
      shouldPersistAuditOnly: disposition === 'append_shadow_only',
      reason: priority === 'critical'
        ? 'critical negotiation artifacts must remain replay-legible'
        : priority === 'high'
          ? 'high-value negotiation steps should remain replayable'
          : 'standard negotiation truth remains available to replay',
    };
  }

  private buildCounterplayPlan(
    draft: DealRoomMessageDraft,
    room: DealRoomChannelState,
    nowMs: number,
  ): DealRoomCounterplayPlan {
    const window = this.buildCounterplayWindow(room, nowMs);
    const ledger: DealRoomCounterplayLedger = {
      lastProposalActorId: room.negotiation.pendingOfferActorId,
      lastProposalSequence: room.negotiation.liveOfferSequence,
      lastCounterActorId: room.negotiation.lastActorId,
      lastCounterSequence: room.negotiation.lastMeaningfulSequence,
      disputeOpenedByActorId: room.negotiation.lifecycle === 'disputed' ? room.negotiation.lastActorId : undefined,
      lastSealCandidateSequence: room.negotiation.lifecycle === 'settlement_locked' || room.negotiation.lifecycle === 'settled'
        ? (room.negotiation.lastMeaningfulSequence ?? room.lastSequence)
        : undefined,
      outstandingActionCount: calculateOutstandingActions(room, window),
    };

    if (draft.kind === 'DEAL_COUNTER') {
      return {
        disposition: 'counter_offer',
        shouldOpenCounterWindow: true,
        shouldLockForAcceptance: false,
        shouldEscalateDispute: false,
        shouldPrepareSeal: false,
        window,
        ledger,
        reason: 'counteroffer should reopen live leverage and counterplay timing',
      };
    }
    if (draft.kind === 'DEAL_DISPUTE' || draft.kind === 'DEAL_ESCALATION') {
      return {
        disposition: 'dispute_vector',
        shouldOpenCounterWindow: false,
        shouldLockForAcceptance: false,
        shouldEscalateDispute: true,
        shouldPrepareSeal: false,
        window,
        ledger,
        reason: 'dispute artifacts shift the room from leverage to evidence',
      };
    }
    if (draft.kind === 'DEAL_ACCEPT' || draft.kind === 'DEAL_PROOF' || draft.kind === 'DEAL_RECAP') {
      return {
        disposition: 'seal_ready',
        shouldOpenCounterWindow: false,
        shouldLockForAcceptance: true,
        shouldEscalateDispute: false,
        shouldPrepareSeal: true,
        window,
        ledger,
        reason: 'settlement artifacts transition the room toward seal-ready truth',
      };
    }
    return {
      disposition: 'informational',
      shouldOpenCounterWindow: false,
      shouldLockForAcceptance: false,
      shouldEscalateDispute: false,
      shouldPrepareSeal: false,
      window,
      ledger,
      reason: 'message is informative to negotiation state without changing counterplay law',
    };
  }

  private buildCounterplayWindow(
    room: DealRoomChannelState,
    nowMs: number,
  ): DealRoomCounterplayWindow {
    const state = this.inferCounterWindowState(room, nowMs);
    const expiresAtMs = getCounterWindowExpiry(room);
    const msRemaining = typeof expiresAtMs === 'number' ? Math.max(0, expiresAtMs - nowMs) : undefined;
    return {
      state,
      opensAtMs: room.negotiation.lastCounterAtMs ?? room.negotiation.lastOfferAtMs ?? room.negotiation.openedAtMs,
      expiresAtMs,
      msRemaining,
      requiresActionByActorId: room.negotiation.pendingTargetActorId,
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
    extras?: {
      notificationHint?: DealRoomNotificationHint;
      transcriptDisposition?: DealRoomTranscriptDisposition;
      fanoutDirective?: DealRoomFanoutDirective;
      replayDirective?: DealRoomReplayDirective;
      stageDirective?: DealRoomStageDirective;
      counterplay?: DealRoomCounterplayPlan;
      explainability?: DealRoomIngressExplainability;
      mountRule?: DealRoomMountRule;
      commandRule?: DealRoomCommandRule | null;
    },
  ): DealRoomIngressDecision {
    const mergedLabels = unique([...labels, 'rejected', code.toLowerCase()]);
    const fanoutDirective = extras?.fanoutDirective ?? {
      fanoutClass: 'none',
      shadowLane: null,
      includeParticipants: false,
      includeArbiters: false,
      includeRecorders: false,
      includeSpectators: false,
      includeModeration: true,
      suppressClientEcho: true,
      reason: 'rejected messages do not fan out to visible participants',
    };
    const replayDirective = extras?.replayDirective ?? {
      priority: 'none',
      shouldReplay: false,
      shouldSnapshotAfterAppend: false,
      shouldPersistAuditOnly: false,
      reason: 'rejected messages do not enter replay lane',
    };
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
      shouldEmitReplay: replayDirective.shouldReplay,
      shouldSuppressLeak: true,
      shouldEscalateDispute: draft.kind === 'DEAL_DISPUTE' || draft.kind === 'DEAL_ESCALATION',
      shouldLockSettlement: false,
      normalizedBody,
      auditLabels: mergedLabels,
      notificationHint: extras?.notificationHint ?? 'none',
      transcriptDisposition: extras?.transcriptDisposition ?? 'drop',
      fanoutClass: fanoutDirective.fanoutClass,
      shadowLane: fanoutDirective.shadowLane,
      stageDirective: extras?.stageDirective,
      fanoutDirective,
      replayDirective,
      counterplay: extras?.counterplay,
      explainability: extras?.explainability,
      mountRule: extras?.mountRule,
      commandRule: extras?.commandRule ?? null,
    };
  }
}

// ============================================================================
// MARK: Additional pure helpers used by class methods
// ============================================================================

function calculateOutstandingActions(
  room: DealRoomChannelState,
  window: DealRoomCounterplayWindow,
): number {
  if (room.negotiation.lifecycle === 'settled' || room.negotiation.lifecycle === 'archived') {
    return 0;
  }
  if (room.negotiation.lifecycle === 'settlement_locked') {
    return room.hasArbiter ? 1 : 2;
  }
  if (room.negotiation.lifecycle === 'disputed') {
    return room.hasArbiter ? 1 : 2;
  }
  if (window.state === 'open' || window.state === 'expiring') {
    return 1;
  }
  if (room.negotiation.lifecycle === 'active_negotiation' || room.negotiation.lifecycle === 'open' || room.negotiation.lifecycle === 'cold_open') {
    return 1;
  }
  return 0;
}

function proofKindRequiresHighlight(kind: DealRoomMessageKind): boolean {
  return kind === 'DEAL_OPEN'
    || kind === 'DEAL_PROPOSAL'
    || kind === 'DEAL_COUNTER'
    || kind === 'DEAL_ACCEPT'
    || kind === 'DEAL_RECAP'
    || kind === 'DEAL_PROOF'
    || kind === 'DEAL_DISPUTE'
    || kind === 'DEAL_ESCALATION';
}

// ============================================================================
// MARK: Singleton export
// ============================================================================

export const dealRoomChannelPolicy = new DealRoomChannelPolicy();

// ============================================================================
// MARK: Matrix / inspection helpers
// ============================================================================

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

export function inspectDealRoomCommandMatrix(): Readonly<Record<DealRoomCommand, DealRoomCommandRule>> {
  return DEAL_ROOM_COMMAND_RULES;
}

export function inspectDealRoomMountMatrix(): Readonly<Record<DealRoomMountSurface, DealRoomMountRule>> {
  return DEAL_ROOM_MOUNT_RULES;
}

export function inspectDealRoomRateWindows(): Readonly<Record<DealRoomActorKind, DealRoomRateWindow>> {
  return DEAL_ROOM_DEFAULT_RATE_WINDOWS;
}

export function inspectDealRoomNotificationHints(): Readonly<Record<DealRoomMessageKind, DealRoomNotificationHint>> {
  return DEAL_ROOM_NOTIFICATION_HINT_BY_KIND;
}

export function inspectDealRoomTranscriptDispositions(): Readonly<Record<DealRoomMessageKind, DealRoomTranscriptDisposition>> {
  return DEAL_ROOM_TRANSCRIPT_DISPOSITION_BY_KIND;
}

export function inspectDealRoomShadowLaneDefaults(): Readonly<Record<DealRoomMessageKind, DealRoomShadowLane | null>> {
  return DEAL_ROOM_SHADOW_LANE_BY_KIND;
}

export function inspectDealRoomReplayPriorities(): Readonly<Record<DealRoomMessageKind, DealRoomReplayPriority>> {
  return DEAL_ROOM_REPLAY_PRIORITY_BY_KIND;
}

// ============================================================================
// MARK: Scenario fixtures
// ============================================================================

export const DEAL_ROOM_SCENARIO_1_OPENING_OFFER = {
  lifecycle: 'open' as DealRoomLifecycleState,
  role: 'owner' as DealRoomMembershipRole,
  kind: 'DEAL_OPEN' as DealRoomMessageKind,
  mountSurface: 'DEAL_ROOM_SCREEN' as DealRoomMountSurface,
  transcriptMode: DEAL_ROOM_LIFECYCLE_TRANSCRIPT_MODE.open,
  proofRequirement: DEAL_ROOM_PROOF_REQUIREMENT_BY_KIND.DEAL_OPEN,
  notificationHint: DEAL_ROOM_NOTIFICATION_HINT_BY_KIND.DEAL_OPEN,
};

export const DEAL_ROOM_SCENARIO_2_COUNTER_WINDOW = {
  lifecycle: 'counter_pending' as DealRoomLifecycleState,
  role: 'counterparty' as DealRoomMembershipRole,
  kind: 'DEAL_COUNTER' as DealRoomMessageKind,
  mountSurface: 'PREDATOR_SCREEN' as DealRoomMountSurface,
  transcriptMode: DEAL_ROOM_LIFECYCLE_TRANSCRIPT_MODE.counter_pending,
  proofRequirement: DEAL_ROOM_PROOF_REQUIREMENT_BY_KIND.DEAL_COUNTER,
  notificationHint: DEAL_ROOM_NOTIFICATION_HINT_BY_KIND.DEAL_COUNTER,
};

export const DEAL_ROOM_SCENARIO_3_ACCEPTANCE_WINDOW = {
  lifecycle: 'acceptance_pending' as DealRoomLifecycleState,
  role: 'owner' as DealRoomMembershipRole,
  kind: 'DEAL_ACCEPT' as DealRoomMessageKind,
  mountSurface: 'DEAL_ROOM_SCREEN' as DealRoomMountSurface,
  transcriptMode: DEAL_ROOM_LIFECYCLE_TRANSCRIPT_MODE.acceptance_pending,
  proofRequirement: DEAL_ROOM_PROOF_REQUIREMENT_BY_KIND.DEAL_ACCEPT,
  notificationHint: DEAL_ROOM_NOTIFICATION_HINT_BY_KIND.DEAL_ACCEPT,
};

export const DEAL_ROOM_SCENARIO_4_SETTLEMENT_LOCK = {
  lifecycle: 'settlement_locked' as DealRoomLifecycleState,
  role: 'recorder' as DealRoomMembershipRole,
  kind: 'DEAL_PROOF' as DealRoomMessageKind,
  mountSurface: 'POST_RUN_SUMMARY' as DealRoomMountSurface,
  transcriptMode: DEAL_ROOM_LIFECYCLE_TRANSCRIPT_MODE.settlement_locked,
  proofRequirement: DEAL_ROOM_PROOF_REQUIREMENT_BY_KIND.DEAL_PROOF,
  notificationHint: DEAL_ROOM_NOTIFICATION_HINT_BY_KIND.DEAL_PROOF,
};

export const DEAL_ROOM_SCENARIO_5_DISPUTE_ESCALATION = {
  lifecycle: 'disputed' as DealRoomLifecycleState,
  role: 'arbiter' as DealRoomMembershipRole,
  kind: 'DEAL_ESCALATION' as DealRoomMessageKind,
  mountSurface: 'DEAL_ROOM_SCREEN' as DealRoomMountSurface,
  transcriptMode: DEAL_ROOM_LIFECYCLE_TRANSCRIPT_MODE.disputed,
  proofRequirement: DEAL_ROOM_PROOF_REQUIREMENT_BY_KIND.DEAL_ESCALATION,
  notificationHint: DEAL_ROOM_NOTIFICATION_HINT_BY_KIND.DEAL_ESCALATION,
};

export const DEAL_ROOM_SCENARIO_6_SPECTATOR_READ_ONLY = {
  lifecycle: 'settled' as DealRoomLifecycleState,
  role: 'spectator' as DealRoomMembershipRole,
  kind: 'PRESENCE' as DealRoomMessageKind,
  mountSurface: 'CHAT_DRAWER' as DealRoomMountSurface,
  transcriptMode: DEAL_ROOM_LIFECYCLE_TRANSCRIPT_MODE.settled,
  proofRequirement: DEAL_ROOM_PROOF_REQUIREMENT_BY_KIND.PRESENCE,
  notificationHint: DEAL_ROOM_NOTIFICATION_HINT_BY_KIND.PRESENCE,
};

export const DEAL_ROOM_SCENARIO_7_ARCHIVE_PROOF = {
  lifecycle: 'archived' as DealRoomLifecycleState,
  role: 'recorder' as DealRoomMembershipRole,
  kind: 'DEAL_PROOF' as DealRoomMessageKind,
  mountSurface: 'POST_RUN_SUMMARY' as DealRoomMountSurface,
  transcriptMode: DEAL_ROOM_LIFECYCLE_TRANSCRIPT_MODE.archived,
  proofRequirement: DEAL_ROOM_PROOF_REQUIREMENT_BY_KIND.DEAL_PROOF,
  notificationHint: DEAL_ROOM_NOTIFICATION_HINT_BY_KIND.DEAL_PROOF,
};

export const DEAL_ROOM_SCENARIO_8_MODERATOR_SEAL = {
  lifecycle: 'settlement_locked' as DealRoomLifecycleState,
  role: 'arbiter' as DealRoomMembershipRole,
  kind: 'COMMAND' as DealRoomMessageKind,
  command: '/seal' as DealRoomCommand,
  mountSurface: 'DEAL_ROOM_SCREEN' as DealRoomMountSurface,
  transcriptMode: DEAL_ROOM_LIFECYCLE_TRANSCRIPT_MODE.settlement_locked,
  proofRequirement: DEAL_ROOM_PROOF_REQUIREMENT_BY_KIND.COMMAND,
  notificationHint: DEAL_ROOM_NOTIFICATION_HINT_BY_KIND.COMMAND,
};
