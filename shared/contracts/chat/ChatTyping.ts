/**
 * ============================================================================
 * POINT ZERO ONE — SHARED CHAT TYPING CONTRACTS
 * FILE: shared/contracts/chat/ChatTyping.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical shared contract surface for typing theater, typing simulation,
 * read-delay pressure, read receipts, typing roster synchronization, and
 * transport-safe typing envelopes used by:
 *
 *   - /shared/contracts/chat
 *   - /pzo-web/src/engines/chat
 *   - /pzo-web/src/components/chat
 *   - /backend/src/game/engine/chat
 *   - /pzo-server/src/chat
 *
 * Design laws
 * -----------
 * 1. Typing is not cosmetic. It is a first-class psychological timing layer.
 * 2. Client optimism may stage typing quickly, but authority decides visibility,
 *    reveal timing, suppression, and expiry.
 * 3. NPC typing theater must remain representable without requiring runtime AI
 *    code to leak into the shared lane.
 * 4. Read delays and read receipts are part of social pressure and negotiation,
 *    not afterthought metadata.
 * 5. Shared typing contracts must support visible channels and shadow channels
 *    without making the frontend the final source of truth.
 * 6. This file must bridge the current donor vocabulary already present inside
 *    the frontend chat engine while becoming the long-term authority for the
 *    dedicated /shared/contracts/chat lane.
 * ============================================================================
 */

import {
  type Brand,
  type ChatChannelDescriptor,
  type ChatChannelFamily,
  type ChatChannelId,
  type ChatModeScope,
  type ChatMountPreset,
  type ChatMountTarget,
  type ChatRoomId,
  type ChatShadowChannel,
  type ChatVisibleChannel,
  type JsonObject,
  type Optional,
  type Score01,
  type UnixMs,
  CHAT_CHANNEL_DESCRIPTORS,
  CHAT_CONTRACT_AUTHORITIES,
  CHAT_CONTRACT_VERSION,
  CHAT_MOUNT_PRESETS,
  CHAT_MODE_SCOPES,
  isChatChannelId,
  isChatMountTarget,
  isChatModeScope,
} from './ChatChannels';

import {
  type ChatActorKind,
  type ChatAuthority,
  type ChatMessageId,
  type ChatRange,
  type ChatRequestId,
  type ChatSessionId,
  type ChatTypingToken,
  type ChatUserId,
  type ChatTypingState as LegacyChatTypingState,
  type ChatTypingSnapshot as LegacyChatTypingSnapshot,
  type ChatClientTypingRequest as LegacyChatClientTypingRequest,
  type ChatReadReceipt as LegacyChatReadReceipt,
  CHAT_ACTOR_KINDS,
  CHAT_AUTHORITIES,
  CHAT_TYPING_STATES,
} from './ChatEvents';

// ============================================================================
// MARK: Branded identifiers local to typing contracts
// ============================================================================

export type ChatTypingEnvelopeId = Brand<string, 'ChatTypingEnvelopeId'>;
export type ChatTypingRosterId = Brand<string, 'ChatTypingRosterId'>;
export type ChatTypingFrameId = Brand<string, 'ChatTypingFrameId'>;
export type ChatTypingPlanId = Brand<string, 'ChatTypingPlanId'>;
export type ChatTypingCueId = Brand<string, 'ChatTypingCueId'>;
export type ChatTypingStyleId = Brand<string, 'ChatTypingStyleId'>;
export type ChatTypingPolicyId = Brand<string, 'ChatTypingPolicyId'>;
export type ChatTypingWindowId = Brand<string, 'ChatTypingWindowId'>;
export type ChatReadReceiptId = Brand<string, 'ChatReadReceiptId'>;
export type ChatReadHeadId = Brand<string, 'ChatReadHeadId'>;
export type ChatTypingTelemetryId = Brand<string, 'ChatTypingTelemetryId'>;
export type ChatTypingSequenceId = Brand<number, 'ChatTypingSequenceId'>;
export type ChatTypingActorKey = Brand<string, 'ChatTypingActorKey'>;

// ============================================================================
// MARK: Legacy compatibility aliases
// ============================================================================

export type ChatTypingState = LegacyChatTypingState;
export type LegacyCompatibleChatTypingSnapshot = LegacyChatTypingSnapshot;
export type LegacyCompatibleChatClientTypingRequest =
  LegacyChatClientTypingRequest;
export type LegacyCompatibleChatReadReceipt = LegacyChatReadReceipt;

// ============================================================================
// MARK: Core vocabularies
// ============================================================================

export const CHAT_TYPING_VISIBILITY_CLASSES = [
  'VISIBLE',
  'SHADOW',
  'AUTHOR_ONLY',
  'SYSTEM_ONLY',
] as const;

export type ChatTypingVisibilityClass =
  (typeof CHAT_TYPING_VISIBILITY_CLASSES)[number];

export const CHAT_TYPING_SOURCES = [
  'HUMAN_KEYBOARD',
  'HUMAN_TOUCH',
  'NPC_DIRECTOR',
  'NPC_PERSONA',
  'HELPER_POLICY',
  'HATER_POLICY',
  'READ_DELAY_POLICY',
  'NEGOTIATION_POLICY',
  'LIVEOPS_POLICY',
  'SYSTEM_SYNTHESIS',
] as const;

export type ChatTypingSource = (typeof CHAT_TYPING_SOURCES)[number];

export const CHAT_TYPING_STYLE_KINDS = [
  'HUMAN',
  'FAST_HUMAN',
  'CAUTIOUS_HUMAN',
  'NPC_AMBIENT',
  'NPC_LURK',
  'HELPER_PATIENT',
  'HELPER_URGENT',
  'HATER_BAIT',
  'HATER_STALK',
  'NEGOTIATION_SILENT',
  'NEGOTIATION_PRESSURE',
  'LIVEOPS_PULSE',
  'SYSTEM_CEREMONIAL',
] as const;

export type ChatTypingStyleKind = (typeof CHAT_TYPING_STYLE_KINDS)[number];

export const CHAT_TYPING_TRIGGER_KINDS = [
  'COMPOSER_INPUT',
  'COMPOSER_FOCUS',
  'MESSAGE_RECEIVED',
  'SCENE_REVEAL',
  'INTERRUPTION_WINDOW',
  'COUNTERPLAY_WINDOW',
  'NEGOTIATION_STALL',
  'RESCUE_PENDING',
  'HATER_ESCALATION',
  'HELPER_INTERVENTION',
  'LIVEOPS_BANNER',
  'WORLD_EVENT_SURGE',
] as const;

export type ChatTypingTriggerKind =
  (typeof CHAT_TYPING_TRIGGER_KINDS)[number];

export const CHAT_TYPING_TIMEOUT_CLASSES = [
  'ULTRA_SHORT',
  'SHORT',
  'STANDARD',
  'LONG',
  'EXTENDED',
] as const;

export type ChatTypingTimeoutClass =
  (typeof CHAT_TYPING_TIMEOUT_CLASSES)[number];

export const CHAT_TYPING_LATENCY_CLASSES = [
  'INSTANT',
  'RESPONSIVE',
  'DELIBERATE',
  'THEATRICAL',
  'PREDATORY',
] as const;

export type ChatTypingLatencyClass =
  (typeof CHAT_TYPING_LATENCY_CLASSES)[number];

export const CHAT_TYPING_SUPPRESSION_REASONS = [
  'CHANNEL_DISABLED',
  'CHANNEL_HIDDEN',
  'ROOM_UNAVAILABLE',
  'SESSION_MUTED',
  'SHADOW_ONLY_POLICY',
  'NEGOTIATION_NOISE_REDUCTION',
  'RESCUE_COOLDOWN',
  'NPC_SUPPRESSION_POLICY',
  'RATE_LIMIT',
  'AUTHORITY_REJECTED',
] as const;

export type ChatTypingSuppressionReason =
  (typeof CHAT_TYPING_SUPPRESSION_REASONS)[number];

export const CHAT_TYPING_MERGE_POLICIES = [
  'LAST_WRITE_WINS',
  'AUTHORITATIVE_OVERRIDES',
  'VISIBLE_OVERRIDES_SHADOW',
  'LONGER_TTL_WINS',
  'SERVER_CLOCK_WINS',
] as const;

export type ChatTypingMergePolicy =
  (typeof CHAT_TYPING_MERGE_POLICIES)[number];

export const CHAT_TYPING_ENVELOPE_KINDS = [
  'TYPING_UPDATE',
  'TYPING_ROSTER',
  'TYPING_DIFF',
  'READ_RECEIPT',
  'READ_HEAD',
  'READ_DELAY_PLAN',
  'TYPING_POLICY_DECISION',
  'TYPING_REJECTION',
  'TYPING_ACK',
] as const;

export type ChatTypingEnvelopeKind =
  (typeof CHAT_TYPING_ENVELOPE_KINDS)[number];

export const CHAT_READ_DELAY_REASONS = [
  'PRESENCE_THEATER',
  'NEGOTIATION_PRESSURE',
  'NPC_LATENCY',
  'HATER_BAIT',
  'HELPER_OBSERVATION',
  'LIVEOPS_DRAMA',
  'PRIVACY_REDACTION',
] as const;

export type ChatReadDelayReason = (typeof CHAT_READ_DELAY_REASONS)[number];

export const CHAT_READ_POLICY_MODES = [
  'IMMEDIATE',
  'DELAYED',
  'HIDDEN',
  'AUTHOR_ONLY',
  'BATCHED',
] as const;

export type ChatReadPolicyMode = (typeof CHAT_READ_POLICY_MODES)[number];

export const CHAT_TYPING_TELEMETRY_EVENT_NAMES = [
  'typing_started',
  'typing_paused',
  'typing_stopped',
  'typing_simulated',
  'typing_suppressed',
  'typing_expired',
  'read_receipt_emitted',
  'read_receipt_delayed',
  'read_head_updated',
  'typing_rejected',
] as const;

export type ChatTypingTelemetryEventName =
  (typeof CHAT_TYPING_TELEMETRY_EVENT_NAMES)[number];

export const CHAT_TYPING_CONTROL_OPS = [
  'UPSERT_TYPING',
  'REMOVE_TYPING',
  'CLEAR_CHANNEL',
  'CLEAR_ROOM',
  'ACK_REQUEST',
  'REJECT_REQUEST',
  'UPSERT_READ_RECEIPT',
  'UPSERT_READ_HEAD',
] as const;

export type ChatTypingControlOp = (typeof CHAT_TYPING_CONTROL_OPS)[number];

// ============================================================================
// MARK: Fine-grained typing style contracts
// ============================================================================

export interface ChatTypingLatencyBudget {
  readonly startupDelayMs: number;
  readonly firstBurstMs: number;
  readonly pauseFloorMs: number;
  readonly pauseCeilingMs: number;
  readonly stopAfterIdleMs: number;
  readonly expiryAfterMs: number;
}

export interface ChatTypingCadenceProfile {
  readonly averageBurstChars: number;
  readonly maxBurstChars: number;
  readonly pauseChance: Score01;
  readonly interruptionChance: Score01;
  readonly fakeStartChance: Score01;
  readonly fakeStopChance: Score01;
  readonly readBeforeReplyChance: Score01;
}

export interface ChatTypingRevealPolicy {
  readonly visibilityClass: ChatTypingVisibilityClass;
  readonly revealToPlayer: boolean;
  readonly revealToObservers: boolean;
  readonly allowShadowMirror: boolean;
  readonly allowDelayedReveal: boolean;
  readonly mirrorIntoReadDelay: boolean;
}

export interface ChatTypingPersonaHints {
  readonly signatureLengthBand: 'SHORT' | 'MEDIUM' | 'LONG';
  readonly punctuationDiscipline: 'SPARSE' | 'BALANCED' | 'HEAVY';
  readonly reactsInstantlyToThreat: boolean;
  readonly usesWeaponizedSilence: boolean;
  readonly tendsToHoverBeforeReply: boolean;
  readonly supportsTypingAbortTheater: boolean;
}

export interface ChatTypingStyleProfile {
  readonly styleId: ChatTypingStyleId;
  readonly styleKind: ChatTypingStyleKind;
  readonly source: ChatTypingSource;
  readonly latencyClass: ChatTypingLatencyClass;
  readonly timeoutClass: ChatTypingTimeoutClass;
  readonly cadence: ChatTypingCadenceProfile;
  readonly latency: ChatTypingLatencyBudget;
  readonly reveal: ChatTypingRevealPolicy;
  readonly persona: ChatTypingPersonaHints;
  readonly description: string;
}

export interface ChatTypingStyleAssignment {
  readonly actorKind: ChatActorKind;
  readonly channelFamily: ChatChannelFamily;
  readonly mountTarget?: ChatMountTarget;
  readonly modeScope?: ChatModeScope;
  readonly styleId: ChatTypingStyleId;
  readonly reason: string;
}

// ============================================================================
// MARK: Typing timing and theater plans
// ============================================================================

export interface ChatTypingWindow {
  readonly windowId: ChatTypingWindowId;
  readonly trigger: ChatTypingTriggerKind;
  readonly opensAt: UnixMs;
  readonly closesAt: UnixMs;
  readonly startupDelayMs: number;
  readonly maxVisibleDurationMs: number;
  readonly allowPause: boolean;
  readonly allowAbort: boolean;
  readonly priority: number;
}

export interface ChatTypingPauseSegment {
  readonly offsetMs: number;
  readonly durationMs: number;
  readonly reason:
    | 'THINKING'
    | 'BAIT'
    | 'NEGOTIATION'
    | 'READING'
    | 'INTERVENTION_WAIT'
    | 'INTERRUPTION';
}

export interface ChatTypingBurstSegment {
  readonly offsetMs: number;
  readonly durationMs: number;
  readonly estimatedChars: number;
  readonly burstIntent:
    | 'OPENER'
    | 'BODY'
    | 'COUNTER'
    | 'STALL'
    | 'FAKEOUT'
    | 'RECOVERY';
}

export interface ChatTypingSimulationPlan {
  readonly planId: ChatTypingPlanId;
  readonly actorId: string;
  readonly actorKind: ChatActorKind;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly styleId: ChatTypingStyleId;
  readonly authority: ChatAuthority;
  readonly source: ChatTypingSource;
  readonly visibilityClass: ChatTypingVisibilityClass;
  readonly generatedAt: UnixMs;
  readonly startedAt?: UnixMs;
  readonly expiresAt?: UnixMs;
  readonly window: ChatTypingWindow;
  readonly bursts: readonly ChatTypingBurstSegment[];
  readonly pauses: readonly ChatTypingPauseSegment[];
  readonly mayEmitReadDelay: boolean;
  readonly mayAbortWithoutMessage: boolean;
  readonly shadowCompanionChannel?: ChatShadowChannel;
}

export interface ChatTypingTheaterCue {
  readonly cueId: ChatTypingCueId;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly actorId: string;
  readonly actorKind: ChatActorKind;
  readonly styleId: ChatTypingStyleId;
  readonly trigger: ChatTypingTriggerKind;
  readonly source: ChatTypingSource;
  readonly queuedAt: UnixMs;
  readonly revealAt?: UnixMs;
  readonly cancelIfSuppressed: boolean;
  readonly cancelIfMessageAlreadyArrived: boolean;
  readonly companionMessageId?: ChatMessageId;
  readonly negotiationPressureScore?: Score01;
}

export interface ChatTypingSuppressionWindow {
  readonly reason: ChatTypingSuppressionReason;
  readonly startsAt: UnixMs;
  readonly endsAt?: UnixMs;
  readonly actorId?: string;
  readonly roomId?: ChatRoomId;
  readonly channelId?: ChatChannelId;
}

// ============================================================================
// MARK: Read receipt and read-head contracts
// ============================================================================

export interface ChatReadDelayPlan {
  readonly policyId: ChatTypingPolicyId;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly actorId: string;
  readonly actorKind: ChatActorKind;
  readonly mode: ChatReadPolicyMode;
  readonly delayedByPolicy: boolean;
  readonly delayReason?: ChatReadDelayReason;
  readonly delayMs?: number;
  readonly visibleToPlayer: boolean;
  readonly createdAt: UnixMs;
  readonly expiresAt?: UnixMs;
}

export interface ChatReadReceiptRecord {
  readonly receiptId: ChatReadReceiptId;
  readonly actorId: string;
  readonly actorKind: ChatActorKind;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly messageId: ChatMessageId;
  readonly readAt: UnixMs;
  readonly delayedByPolicy: boolean;
  readonly delayReason?: ChatReadDelayReason;
  readonly visibilityClass: ChatTypingVisibilityClass;
  readonly authority: ChatAuthority;
}

export interface ChatReadHeadSnapshot {
  readonly readHeadId: ChatReadHeadId;
  readonly actorId: string;
  readonly actorKind: ChatActorKind;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly lastReadMessageId?: ChatMessageId;
  readonly lastReadAt?: UnixMs;
  readonly unreadCount?: number;
  readonly visibleToPlayer: boolean;
  readonly authority: ChatAuthority;
  readonly updatedAt: UnixMs;
}

// ============================================================================
// MARK: Canonical typing snapshots
// ============================================================================

export interface ChatTypingSnapshot
  extends LegacyCompatibleChatTypingSnapshot {
  readonly roomId: ChatRoomId;
  readonly authority: ChatAuthority;
  readonly visibilityClass: ChatTypingVisibilityClass;
  readonly source: ChatTypingSource;
  readonly styleId?: ChatTypingStyleId;
  readonly trigger?: ChatTypingTriggerKind;
  readonly requestId?: ChatRequestId;
  readonly channelFamily?: ChatChannelFamily;
  readonly mountTarget?: ChatMountTarget;
  readonly modeScope?: ChatModeScope;
  readonly queuedAt?: UnixMs;
  readonly revealedAt?: UnixMs;
  readonly suppressionReason?: ChatTypingSuppressionReason;
  readonly shadowCompanionChannel?: ChatShadowChannel;
  readonly expiresVisibleAt?: UnixMs;
  readonly latencyClass?: ChatTypingLatencyClass;
  readonly timeoutClass?: ChatTypingTimeoutClass;
  readonly canAbortWithoutMessage?: boolean;
  readonly visibleToPlayer?: boolean;
}

export interface ChatTypingActorState {
  readonly actorId: string;
  readonly actorKind: ChatActorKind;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly latest?: ChatTypingSnapshot;
  readonly queuedCue?: ChatTypingTheaterCue;
  readonly activePlan?: ChatTypingSimulationPlan;
  readonly suppressionWindows: readonly ChatTypingSuppressionWindow[];
  readonly readHead?: ChatReadHeadSnapshot;
  readonly readReceipts: readonly ChatReadReceiptRecord[];
}

export interface ChatTypingChannelState {
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly family: ChatChannelFamily;
  readonly descriptor: ChatChannelDescriptor;
  readonly actors: Readonly<Record<string, ChatTypingActorState>>;
  readonly visibleTyping: readonly ChatTypingSnapshot[];
  readonly shadowTyping: readonly ChatTypingSnapshot[];
  readonly readHeads: readonly ChatReadHeadSnapshot[];
  readonly receipts: readonly ChatReadReceiptRecord[];
  readonly updatedAt: UnixMs;
}

export interface ChatTypingRoomState {
  readonly roomId: ChatRoomId;
  readonly channels: Readonly<Record<ChatChannelId, ChatTypingChannelState>>;
  readonly frameId?: ChatTypingFrameId;
  readonly rosterId?: ChatTypingRosterId;
  readonly authority: ChatAuthority;
  readonly updatedAt: UnixMs;
}

export interface ChatTypingRosterSnapshot {
  readonly rosterId: ChatTypingRosterId;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly authority: ChatAuthority;
  readonly snapshots: readonly ChatTypingSnapshot[];
  readonly readHeads: readonly ChatReadHeadSnapshot[];
  readonly receipts: readonly ChatReadReceiptRecord[];
  readonly syncedAt: UnixMs;
}

// ============================================================================
// MARK: Diffs, merges, and authoritative frames
// ============================================================================

export interface ChatTypingDiffOp {
  readonly op: ChatTypingControlOp;
  readonly actorId?: string;
  readonly channelId?: ChatChannelId;
  readonly roomId?: ChatRoomId;
  readonly snapshot?: ChatTypingSnapshot;
  readonly receipt?: ChatReadReceiptRecord;
  readonly readHead?: ChatReadHeadSnapshot;
  readonly reason?: string;
}

export interface ChatTypingMergeDecision {
  readonly accepted: boolean;
  readonly mergePolicy: ChatTypingMergePolicy;
  readonly replacesExisting: boolean;
  readonly visibilityResolvedTo: ChatTypingVisibilityClass;
  readonly reason?: string;
}

export interface ChatTypingGatingDecision {
  readonly allowed: boolean;
  readonly authority: ChatAuthority;
  readonly suppressVisibleBroadcast: boolean;
  readonly suppressionReason?: ChatTypingSuppressionReason;
  readonly normalizedState: ChatTypingState;
  readonly ttlMs?: number;
  readonly reason?: string;
}

export interface ChatReadReceiptDecision {
  readonly emitReceipt: boolean;
  readonly mode: ChatReadPolicyMode;
  readonly delayedByPolicy: boolean;
  readonly delayReason?: ChatReadDelayReason;
  readonly delayMs?: number;
  readonly visibleToPlayer: boolean;
  readonly reason?: string;
}

export interface ChatTypingAuthorityFrame {
  readonly frameId: ChatTypingFrameId;
  readonly roomId: ChatRoomId;
  readonly authority: ChatAuthority;
  readonly kind: ChatTypingEnvelopeKind;
  readonly roster?: ChatTypingRosterSnapshot;
  readonly diff?: readonly ChatTypingDiffOp[];
  readonly gating?: ChatTypingGatingDecision;
  readonly readDecision?: ChatReadReceiptDecision;
  readonly syncedAt: UnixMs;
}

// ============================================================================
// MARK: Client requests and transport envelopes
// ============================================================================

export interface ChatClientTypingRequest
  extends LegacyCompatibleChatClientTypingRequest {
  readonly requestId?: ChatRequestId;
  readonly sessionId?: ChatSessionId;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatVisibleChannel;
  readonly typingState: ChatTypingState;
  readonly token?: ChatTypingToken;
  readonly sentAt: UnixMs;
  readonly composerLength?: number;
  readonly caretIndex?: number;
  readonly selection?: ChatRange;
  readonly draftPreview?: string;
  readonly sourceHint?: ChatTypingSource;
  readonly mountTarget?: ChatMountTarget;
  readonly modeScope?: ChatModeScope;
}

export interface ChatClientReadRequest {
  readonly requestId?: ChatRequestId;
  readonly sessionId?: ChatSessionId;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatVisibleChannel;
  readonly lastReadMessageId?: ChatMessageId;
  readonly messageIds?: readonly ChatMessageId[];
  readonly readAt: UnixMs;
  readonly visibleToPlayer?: boolean;
}

export interface ChatClientTypingHeartbeat {
  readonly sessionId: ChatSessionId;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatVisibleChannel;
  readonly token: ChatTypingToken;
  readonly sentAt: UnixMs;
}

export interface ChatTypingAck {
  readonly envelopeId: ChatTypingEnvelopeId;
  readonly requestId?: ChatRequestId;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly authority: ChatAuthority;
  readonly accepted: boolean;
  readonly token?: ChatTypingToken;
  readonly expiresAt?: UnixMs;
  readonly receivedAt: UnixMs;
}

export interface ChatTypingReject {
  readonly envelopeId: ChatTypingEnvelopeId;
  readonly requestId?: ChatRequestId;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly accepted: false;
  readonly rejectionReason:
    | 'INVALID_CHANNEL'
    | 'INVALID_ROOM'
    | 'SESSION_MUTED'
    | 'RATE_LIMIT'
    | 'UNSUPPORTED_STATE'
    | 'AUTHORITY_REJECTED';
  readonly receivedAt: UnixMs;
}

export interface ChatTypingEnvelope {
  readonly envelopeId: ChatTypingEnvelopeId;
  readonly kind: ChatTypingEnvelopeKind;
  readonly authority: ChatAuthority;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly requestId?: ChatRequestId;
  readonly ack?: ChatTypingAck;
  readonly reject?: ChatTypingReject;
  readonly roster?: ChatTypingRosterSnapshot;
  readonly diff?: readonly ChatTypingDiffOp[];
  readonly snapshot?: ChatTypingSnapshot;
  readonly receipt?: ChatReadReceiptRecord;
  readonly readHead?: ChatReadHeadSnapshot;
  readonly frame?: ChatTypingAuthorityFrame;
  readonly sentAt: UnixMs;
}

// ============================================================================
// MARK: Subscription and query contracts
// ============================================================================

export interface ChatTypingSubscription {
  readonly subscriptionId: ChatTypingRosterId;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly includeShadow: boolean;
  readonly includeReadHeads: boolean;
  readonly includeReceipts: boolean;
  readonly authorityFloor: ChatAuthority;
  readonly mountTarget?: ChatMountTarget;
  readonly modeScope?: ChatModeScope;
}

export interface ChatTypingRosterQuery {
  readonly roomId: ChatRoomId;
  readonly channelId?: ChatChannelId;
  readonly actorId?: string;
  readonly actorKind?: ChatActorKind;
  readonly includeShadow: boolean;
  readonly includeExpired: boolean;
}

export interface ChatTypingWindowQuery {
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly actorId: string;
  readonly at: UnixMs;
}

// ============================================================================
// MARK: Telemetry contracts
// ============================================================================

export interface ChatTypingTelemetryEvent {
  readonly telemetryId: ChatTypingTelemetryId;
  readonly eventName: ChatTypingTelemetryEventName;
  readonly authority: ChatAuthority;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly actorId: string;
  readonly actorKind: ChatActorKind;
  readonly token?: ChatTypingToken;
  readonly requestId?: ChatRequestId;
  readonly occurredAt: UnixMs;
  readonly attributes?: JsonObject;
}

// ============================================================================
// MARK: Canonical descriptors and defaults
// ============================================================================

export const CHAT_TYPING_STYLE_PROFILES: Readonly<
  Record<ChatTypingStyleKind, ChatTypingStyleProfile>
> = Object.freeze({
  HUMAN: {
    styleId: 'typing-style-human' as ChatTypingStyleId,
    styleKind: 'HUMAN',
    source: 'HUMAN_KEYBOARD',
    latencyClass: 'RESPONSIVE',
    timeoutClass: 'STANDARD',
    cadence: {
      averageBurstChars: 11,
      maxBurstChars: 28,
      pauseChance: 0.22 as Score01,
      interruptionChance: 0.08 as Score01,
      fakeStartChance: 0.02 as Score01,
      fakeStopChance: 0.02 as Score01,
      readBeforeReplyChance: 0.55 as Score01,
    },
    latency: {
      startupDelayMs: 120,
      firstBurstMs: 350,
      pauseFloorMs: 180,
      pauseCeilingMs: 820,
      stopAfterIdleMs: 1200,
      expiryAfterMs: 3000,
    },
    reveal: {
      visibilityClass: 'VISIBLE',
      revealToPlayer: true,
      revealToObservers: true,
      allowShadowMirror: true,
      allowDelayedReveal: false,
      mirrorIntoReadDelay: true,
    },
    persona: {
      signatureLengthBand: 'MEDIUM',
      punctuationDiscipline: 'BALANCED',
      reactsInstantlyToThreat: false,
      usesWeaponizedSilence: false,
      tendsToHoverBeforeReply: false,
      supportsTypingAbortTheater: true,
    },
    description: 'Baseline player typing profile.',
  },
  FAST_HUMAN: {
    styleId: 'typing-style-fast-human' as ChatTypingStyleId,
    styleKind: 'FAST_HUMAN',
    source: 'HUMAN_KEYBOARD',
    latencyClass: 'INSTANT',
    timeoutClass: 'SHORT',
    cadence: {
      averageBurstChars: 15,
      maxBurstChars: 36,
      pauseChance: 0.14 as Score01,
      interruptionChance: 0.04 as Score01,
      fakeStartChance: 0.01 as Score01,
      fakeStopChance: 0.01 as Score01,
      readBeforeReplyChance: 0.38 as Score01,
    },
    latency: {
      startupDelayMs: 60,
      firstBurstMs: 250,
      pauseFloorMs: 90,
      pauseCeilingMs: 420,
      stopAfterIdleMs: 850,
      expiryAfterMs: 2200,
    },
    reveal: {
      visibilityClass: 'VISIBLE',
      revealToPlayer: true,
      revealToObservers: true,
      allowShadowMirror: true,
      allowDelayedReveal: false,
      mirrorIntoReadDelay: true,
    },
    persona: {
      signatureLengthBand: 'MEDIUM',
      punctuationDiscipline: 'SPARSE',
      reactsInstantlyToThreat: true,
      usesWeaponizedSilence: false,
      tendsToHoverBeforeReply: false,
      supportsTypingAbortTheater: true,
    },
    description: 'Fast-response player typing profile.',
  },
  CAUTIOUS_HUMAN: {
    styleId: 'typing-style-cautious-human' as ChatTypingStyleId,
    styleKind: 'CAUTIOUS_HUMAN',
    source: 'HUMAN_KEYBOARD',
    latencyClass: 'DELIBERATE',
    timeoutClass: 'LONG',
    cadence: {
      averageBurstChars: 8,
      maxBurstChars: 20,
      pauseChance: 0.38 as Score01,
      interruptionChance: 0.16 as Score01,
      fakeStartChance: 0.04 as Score01,
      fakeStopChance: 0.06 as Score01,
      readBeforeReplyChance: 0.72 as Score01,
    },
    latency: {
      startupDelayMs: 240,
      firstBurstMs: 420,
      pauseFloorMs: 240,
      pauseCeilingMs: 1200,
      stopAfterIdleMs: 1500,
      expiryAfterMs: 3800,
    },
    reveal: {
      visibilityClass: 'VISIBLE',
      revealToPlayer: true,
      revealToObservers: true,
      allowShadowMirror: true,
      allowDelayedReveal: false,
      mirrorIntoReadDelay: true,
    },
    persona: {
      signatureLengthBand: 'SHORT',
      punctuationDiscipline: 'BALANCED',
      reactsInstantlyToThreat: false,
      usesWeaponizedSilence: false,
      tendsToHoverBeforeReply: true,
      supportsTypingAbortTheater: true,
    },
    description: 'Hesitant player typing profile for high-pressure decisions.',
  },
  NPC_AMBIENT: {
    styleId: 'typing-style-npc-ambient' as ChatTypingStyleId,
    styleKind: 'NPC_AMBIENT',
    source: 'NPC_DIRECTOR',
    latencyClass: 'THEATRICAL',
    timeoutClass: 'STANDARD',
    cadence: {
      averageBurstChars: 9,
      maxBurstChars: 18,
      pauseChance: 0.44 as Score01,
      interruptionChance: 0.12 as Score01,
      fakeStartChance: 0.18 as Score01,
      fakeStopChance: 0.10 as Score01,
      readBeforeReplyChance: 0.64 as Score01,
    },
    latency: {
      startupDelayMs: 280,
      firstBurstMs: 420,
      pauseFloorMs: 250,
      pauseCeilingMs: 980,
      stopAfterIdleMs: 1200,
      expiryAfterMs: 3400,
    },
    reveal: {
      visibilityClass: 'VISIBLE',
      revealToPlayer: true,
      revealToObservers: true,
      allowShadowMirror: true,
      allowDelayedReveal: true,
      mirrorIntoReadDelay: true,
    },
    persona: {
      signatureLengthBand: 'SHORT',
      punctuationDiscipline: 'BALANCED',
      reactsInstantlyToThreat: false,
      usesWeaponizedSilence: false,
      tendsToHoverBeforeReply: true,
      supportsTypingAbortTheater: true,
    },
    description: 'Ambient NPC timing used for crowd flavor.',
  },
  NPC_LURK: {
    styleId: 'typing-style-npc-lurk' as ChatTypingStyleId,
    styleKind: 'NPC_LURK',
    source: 'NPC_PERSONA',
    latencyClass: 'PREDATORY',
    timeoutClass: 'LONG',
    cadence: {
      averageBurstChars: 6,
      maxBurstChars: 14,
      pauseChance: 0.62 as Score01,
      interruptionChance: 0.16 as Score01,
      fakeStartChance: 0.32 as Score01,
      fakeStopChance: 0.22 as Score01,
      readBeforeReplyChance: 0.81 as Score01,
    },
    latency: {
      startupDelayMs: 520,
      firstBurstMs: 520,
      pauseFloorMs: 420,
      pauseCeilingMs: 1600,
      stopAfterIdleMs: 1900,
      expiryAfterMs: 4200,
    },
    reveal: {
      visibilityClass: 'VISIBLE',
      revealToPlayer: true,
      revealToObservers: true,
      allowShadowMirror: true,
      allowDelayedReveal: true,
      mirrorIntoReadDelay: true,
    },
    persona: {
      signatureLengthBand: 'SHORT',
      punctuationDiscipline: 'SPARSE',
      reactsInstantlyToThreat: false,
      usesWeaponizedSilence: true,
      tendsToHoverBeforeReply: true,
      supportsTypingAbortTheater: true,
    },
    description: 'Predatory NPC hover timing used for lurking rivals.',
  },
  HELPER_PATIENT: {
    styleId: 'typing-style-helper-patient' as ChatTypingStyleId,
    styleKind: 'HELPER_PATIENT',
    source: 'HELPER_POLICY',
    latencyClass: 'DELIBERATE',
    timeoutClass: 'LONG',
    cadence: {
      averageBurstChars: 10,
      maxBurstChars: 26,
      pauseChance: 0.34 as Score01,
      interruptionChance: 0.06 as Score01,
      fakeStartChance: 0.08 as Score01,
      fakeStopChance: 0.04 as Score01,
      readBeforeReplyChance: 0.74 as Score01,
    },
    latency: {
      startupDelayMs: 220,
      firstBurstMs: 360,
      pauseFloorMs: 220,
      pauseCeilingMs: 1100,
      stopAfterIdleMs: 1450,
      expiryAfterMs: 3600,
    },
    reveal: {
      visibilityClass: 'VISIBLE',
      revealToPlayer: true,
      revealToObservers: false,
      allowShadowMirror: true,
      allowDelayedReveal: true,
      mirrorIntoReadDelay: true,
    },
    persona: {
      signatureLengthBand: 'MEDIUM',
      punctuationDiscipline: 'BALANCED',
      reactsInstantlyToThreat: false,
      usesWeaponizedSilence: false,
      tendsToHoverBeforeReply: true,
      supportsTypingAbortTheater: true,
    },
    description: 'Patient helper timing that avoids panic amplification.',
  },
  HELPER_URGENT: {
    styleId: 'typing-style-helper-urgent' as ChatTypingStyleId,
    styleKind: 'HELPER_URGENT',
    source: 'HELPER_POLICY',
    latencyClass: 'RESPONSIVE',
    timeoutClass: 'SHORT',
    cadence: {
      averageBurstChars: 14,
      maxBurstChars: 30,
      pauseChance: 0.16 as Score01,
      interruptionChance: 0.14 as Score01,
      fakeStartChance: 0.03 as Score01,
      fakeStopChance: 0.03 as Score01,
      readBeforeReplyChance: 0.48 as Score01,
    },
    latency: {
      startupDelayMs: 90,
      firstBurstMs: 260,
      pauseFloorMs: 120,
      pauseCeilingMs: 460,
      stopAfterIdleMs: 920,
      expiryAfterMs: 2500,
    },
    reveal: {
      visibilityClass: 'VISIBLE',
      revealToPlayer: true,
      revealToObservers: false,
      allowShadowMirror: true,
      allowDelayedReveal: false,
      mirrorIntoReadDelay: true,
    },
    persona: {
      signatureLengthBand: 'MEDIUM',
      punctuationDiscipline: 'HEAVY',
      reactsInstantlyToThreat: true,
      usesWeaponizedSilence: false,
      tendsToHoverBeforeReply: false,
      supportsTypingAbortTheater: true,
    },
    description: 'Urgent helper typing for collapse prevention.',
  },
  HATER_BAIT: {
    styleId: 'typing-style-hater-bait' as ChatTypingStyleId,
    styleKind: 'HATER_BAIT',
    source: 'HATER_POLICY',
    latencyClass: 'THEATRICAL',
    timeoutClass: 'LONG',
    cadence: {
      averageBurstChars: 7,
      maxBurstChars: 16,
      pauseChance: 0.58 as Score01,
      interruptionChance: 0.18 as Score01,
      fakeStartChance: 0.26 as Score01,
      fakeStopChance: 0.18 as Score01,
      readBeforeReplyChance: 0.83 as Score01,
    },
    latency: {
      startupDelayMs: 420,
      firstBurstMs: 520,
      pauseFloorMs: 340,
      pauseCeilingMs: 1500,
      stopAfterIdleMs: 1800,
      expiryAfterMs: 4200,
    },
    reveal: {
      visibilityClass: 'VISIBLE',
      revealToPlayer: true,
      revealToObservers: true,
      allowShadowMirror: true,
      allowDelayedReveal: true,
      mirrorIntoReadDelay: true,
    },
    persona: {
      signatureLengthBand: 'SHORT',
      punctuationDiscipline: 'SPARSE',
      reactsInstantlyToThreat: false,
      usesWeaponizedSilence: true,
      tendsToHoverBeforeReply: true,
      supportsTypingAbortTheater: true,
    },
    description: 'Hater bait timing that makes the player wait.',
  },
  HATER_STALK: {
    styleId: 'typing-style-hater-stalk' as ChatTypingStyleId,
    styleKind: 'HATER_STALK',
    source: 'HATER_POLICY',
    latencyClass: 'PREDATORY',
    timeoutClass: 'EXTENDED',
    cadence: {
      averageBurstChars: 5,
      maxBurstChars: 12,
      pauseChance: 0.72 as Score01,
      interruptionChance: 0.24 as Score01,
      fakeStartChance: 0.36 as Score01,
      fakeStopChance: 0.28 as Score01,
      readBeforeReplyChance: 0.90 as Score01,
    },
    latency: {
      startupDelayMs: 680,
      firstBurstMs: 560,
      pauseFloorMs: 480,
      pauseCeilingMs: 1800,
      stopAfterIdleMs: 2200,
      expiryAfterMs: 5200,
    },
    reveal: {
      visibilityClass: 'VISIBLE',
      revealToPlayer: true,
      revealToObservers: true,
      allowShadowMirror: true,
      allowDelayedReveal: true,
      mirrorIntoReadDelay: true,
    },
    persona: {
      signatureLengthBand: 'SHORT',
      punctuationDiscipline: 'SPARSE',
      reactsInstantlyToThreat: false,
      usesWeaponizedSilence: true,
      tendsToHoverBeforeReply: true,
      supportsTypingAbortTheater: true,
    },
    description: 'Predatory hater timing for domination and intimidation.',
  },
  NEGOTIATION_SILENT: {
    styleId: 'typing-style-negotiation-silent' as ChatTypingStyleId,
    styleKind: 'NEGOTIATION_SILENT',
    source: 'NEGOTIATION_POLICY',
    latencyClass: 'PREDATORY',
    timeoutClass: 'EXTENDED',
    cadence: {
      averageBurstChars: 6,
      maxBurstChars: 18,
      pauseChance: 0.68 as Score01,
      interruptionChance: 0.08 as Score01,
      fakeStartChance: 0.30 as Score01,
      fakeStopChance: 0.20 as Score01,
      readBeforeReplyChance: 0.92 as Score01,
    },
    latency: {
      startupDelayMs: 720,
      firstBurstMs: 620,
      pauseFloorMs: 420,
      pauseCeilingMs: 2000,
      stopAfterIdleMs: 2400,
      expiryAfterMs: 5200,
    },
    reveal: {
      visibilityClass: 'VISIBLE',
      revealToPlayer: true,
      revealToObservers: false,
      allowShadowMirror: true,
      allowDelayedReveal: true,
      mirrorIntoReadDelay: true,
    },
    persona: {
      signatureLengthBand: 'SHORT',
      punctuationDiscipline: 'SPARSE',
      reactsInstantlyToThreat: false,
      usesWeaponizedSilence: true,
      tendsToHoverBeforeReply: true,
      supportsTypingAbortTheater: true,
    },
    description: 'Negotiation silence used to pressure counterparties.',
  },
  NEGOTIATION_PRESSURE: {
    styleId: 'typing-style-negotiation-pressure' as ChatTypingStyleId,
    styleKind: 'NEGOTIATION_PRESSURE',
    source: 'NEGOTIATION_POLICY',
    latencyClass: 'THEATRICAL',
    timeoutClass: 'LONG',
    cadence: {
      averageBurstChars: 9,
      maxBurstChars: 22,
      pauseChance: 0.42 as Score01,
      interruptionChance: 0.12 as Score01,
      fakeStartChance: 0.18 as Score01,
      fakeStopChance: 0.10 as Score01,
      readBeforeReplyChance: 0.84 as Score01,
    },
    latency: {
      startupDelayMs: 380,
      firstBurstMs: 480,
      pauseFloorMs: 260,
      pauseCeilingMs: 1200,
      stopAfterIdleMs: 1600,
      expiryAfterMs: 3800,
    },
    reveal: {
      visibilityClass: 'VISIBLE',
      revealToPlayer: true,
      revealToObservers: false,
      allowShadowMirror: true,
      allowDelayedReveal: true,
      mirrorIntoReadDelay: true,
    },
    persona: {
      signatureLengthBand: 'MEDIUM',
      punctuationDiscipline: 'BALANCED',
      reactsInstantlyToThreat: false,
      usesWeaponizedSilence: true,
      tendsToHoverBeforeReply: true,
      supportsTypingAbortTheater: true,
    },
    description: 'Negotiation pressure timing used before counters or stalls.',
  },
  LIVEOPS_PULSE: {
    styleId: 'typing-style-liveops-pulse' as ChatTypingStyleId,
    styleKind: 'LIVEOPS_PULSE',
    source: 'LIVEOPS_POLICY',
    latencyClass: 'THEATRICAL',
    timeoutClass: 'STANDARD',
    cadence: {
      averageBurstChars: 12,
      maxBurstChars: 24,
      pauseChance: 0.12 as Score01,
      interruptionChance: 0.04 as Score01,
      fakeStartChance: 0.00 as Score01,
      fakeStopChance: 0.00 as Score01,
      readBeforeReplyChance: 0.20 as Score01,
    },
    latency: {
      startupDelayMs: 150,
      firstBurstMs: 300,
      pauseFloorMs: 140,
      pauseCeilingMs: 360,
      stopAfterIdleMs: 900,
      expiryAfterMs: 2400,
    },
    reveal: {
      visibilityClass: 'VISIBLE',
      revealToPlayer: true,
      revealToObservers: true,
      allowShadowMirror: true,
      allowDelayedReveal: false,
      mirrorIntoReadDelay: false,
    },
    persona: {
      signatureLengthBand: 'MEDIUM',
      punctuationDiscipline: 'HEAVY',
      reactsInstantlyToThreat: true,
      usesWeaponizedSilence: false,
      tendsToHoverBeforeReply: false,
      supportsTypingAbortTheater: false,
    },
    description: 'LiveOps pulse used for world events and banners.',
  },
  SYSTEM_CEREMONIAL: {
    styleId: 'typing-style-system-ceremonial' as ChatTypingStyleId,
    styleKind: 'SYSTEM_CEREMONIAL',
    source: 'SYSTEM_SYNTHESIS',
    latencyClass: 'DELIBERATE',
    timeoutClass: 'STANDARD',
    cadence: {
      averageBurstChars: 10,
      maxBurstChars: 20,
      pauseChance: 0.16 as Score01,
      interruptionChance: 0.00 as Score01,
      fakeStartChance: 0.00 as Score01,
      fakeStopChance: 0.00 as Score01,
      readBeforeReplyChance: 0.00 as Score01,
    },
    latency: {
      startupDelayMs: 200,
      firstBurstMs: 340,
      pauseFloorMs: 160,
      pauseCeilingMs: 300,
      stopAfterIdleMs: 960,
      expiryAfterMs: 2400,
    },
    reveal: {
      visibilityClass: 'VISIBLE',
      revealToPlayer: true,
      revealToObservers: true,
      allowShadowMirror: false,
      allowDelayedReveal: false,
      mirrorIntoReadDelay: false,
    },
    persona: {
      signatureLengthBand: 'MEDIUM',
      punctuationDiscipline: 'BALANCED',
      reactsInstantlyToThreat: false,
      usesWeaponizedSilence: false,
      tendsToHoverBeforeReply: false,
      supportsTypingAbortTheater: false,
    },
    description: 'Ceremonial system timing for declared moments.',
  },
});

export const CHAT_TYPING_STYLE_ASSIGNMENTS: readonly ChatTypingStyleAssignment[] =
  Object.freeze([
    {
      actorKind: 'PLAYER',
      channelFamily: 'PUBLIC',
      styleId: CHAT_TYPING_STYLE_PROFILES.HUMAN.styleId,
      reason: 'Baseline player typing in public rooms.',
    },
    {
      actorKind: 'PLAYER',
      channelFamily: 'NEGOTIATION',
      styleId: CHAT_TYPING_STYLE_PROFILES.CAUTIOUS_HUMAN.styleId,
      reason: 'Players slow down in deal rooms.',
    },
    {
      actorKind: 'HELPER',
      channelFamily: 'PRIVATE',
      styleId: CHAT_TYPING_STYLE_PROFILES.HELPER_PATIENT.styleId,
      reason: 'Helper lanes prioritize calm timing.',
    },
    {
      actorKind: 'HELPER',
      channelFamily: 'PUBLIC',
      styleId: CHAT_TYPING_STYLE_PROFILES.HELPER_URGENT.styleId,
      reason: 'Public rescues should land quickly.',
    },
    {
      actorKind: 'HATER',
      channelFamily: 'PUBLIC',
      styleId: CHAT_TYPING_STYLE_PROFILES.HATER_BAIT.styleId,
      reason: 'Haters weaponize anticipation in public lanes.',
    },
    {
      actorKind: 'HATER',
      channelFamily: 'NEGOTIATION',
      styleId: CHAT_TYPING_STYLE_PROFILES.NEGOTIATION_PRESSURE.styleId,
      reason: 'Predatory negotiation timing.',
    },
    {
      actorKind: 'NPC',
      channelFamily: 'PUBLIC',
      styleId: CHAT_TYPING_STYLE_PROFILES.NPC_AMBIENT.styleId,
      reason: 'Ambient crowd theater.',
    },
    {
      actorKind: 'NPC',
      channelFamily: 'SHADOW',
      styleId: CHAT_TYPING_STYLE_PROFILES.NPC_LURK.styleId,
      reason: 'Shadow lurk timing for deferred reveals.',
    },
    {
      actorKind: 'LIVEOPS',
      channelFamily: 'PUBLIC',
      styleId: CHAT_TYPING_STYLE_PROFILES.LIVEOPS_PULSE.styleId,
      reason: 'World events should feel immediate but staged.',
    },
    {
      actorKind: 'SYSTEM',
      channelFamily: 'PUBLIC',
      styleId: CHAT_TYPING_STYLE_PROFILES.SYSTEM_CEREMONIAL.styleId,
      reason: 'Ceremonial notices use measured timing.',
    },
  ]);

export const CHAT_TYPING_DEFAULT_TIMEOUTS: Readonly<
  Record<ChatTypingTimeoutClass, number>
> = Object.freeze({
  ULTRA_SHORT: 1_200,
  SHORT: 2_200,
  STANDARD: 3_000,
  LONG: 4_200,
  EXTENDED: 5_200,
});

export const CHAT_TYPING_DEFAULTS_BY_MOUNT: Readonly<
  Record<ChatMountTarget, { readonly maxVisibleIndicators: number; readonly allowReadHeads: boolean; readonly allowReceipts: boolean; }>
> = Object.freeze({
  BATTLE_HUD: { maxVisibleIndicators: 4, allowReadHeads: true, allowReceipts: true },
  CLUB_UI: { maxVisibleIndicators: 3, allowReadHeads: true, allowReceipts: false },
  EMPIRE_GAME_SCREEN: { maxVisibleIndicators: 4, allowReadHeads: true, allowReceipts: true },
  GAME_BOARD: { maxVisibleIndicators: 4, allowReadHeads: true, allowReceipts: true },
  LEAGUE_UI: { maxVisibleIndicators: 3, allowReadHeads: true, allowReceipts: false },
  LOBBY_SCREEN: { maxVisibleIndicators: 5, allowReadHeads: true, allowReceipts: false },
  PHANTOM_GAME_SCREEN: { maxVisibleIndicators: 4, allowReadHeads: true, allowReceipts: true },
  PREDATOR_GAME_SCREEN: { maxVisibleIndicators: 4, allowReadHeads: true, allowReceipts: true },
  SYNDICATE_GAME_SCREEN: { maxVisibleIndicators: 5, allowReadHeads: true, allowReceipts: true },
  POST_RUN_SUMMARY: { maxVisibleIndicators: 2, allowReadHeads: false, allowReceipts: false },
});

// ============================================================================
// MARK: Validation and helper guards
// ============================================================================

export function isChatTypingState(value: string): value is ChatTypingState {
  return (CHAT_TYPING_STATES as readonly string[]).includes(value);
}

export function isChatTypingSource(value: string): value is ChatTypingSource {
  return (CHAT_TYPING_SOURCES as readonly string[]).includes(value);
}

export function isChatTypingStyleKind(
  value: string,
): value is ChatTypingStyleKind {
  return (CHAT_TYPING_STYLE_KINDS as readonly string[]).includes(value);
}

export function isChatTypingTriggerKind(
  value: string,
): value is ChatTypingTriggerKind {
  return (CHAT_TYPING_TRIGGER_KINDS as readonly string[]).includes(value);
}

export function isChatTypingVisibilityClass(
  value: string,
): value is ChatTypingVisibilityClass {
  return (CHAT_TYPING_VISIBILITY_CLASSES as readonly string[]).includes(value);
}

export function isChatReadDelayReason(
  value: string,
): value is ChatReadDelayReason {
  return (CHAT_READ_DELAY_REASONS as readonly string[]).includes(value);
}

export function isChatReadPolicyMode(value: string): value is ChatReadPolicyMode {
  return (CHAT_READ_POLICY_MODES as readonly string[]).includes(value);
}

export function isChatTypingTelemetryEventName(
  value: string,
): value is ChatTypingTelemetryEventName {
  return (CHAT_TYPING_TELEMETRY_EVENT_NAMES as readonly string[]).includes(value);
}

export function createTypingActorKey(
  roomId: ChatRoomId,
  channelId: ChatChannelId,
  actorId: string,
): ChatTypingActorKey {
  return `${roomId}:${channelId}:${actorId}` as ChatTypingActorKey;
}

export function getTypingStyleProfile(
  styleKind: ChatTypingStyleKind,
): ChatTypingStyleProfile {
  return CHAT_TYPING_STYLE_PROFILES[styleKind];
}

export function getDefaultTypingTimeoutMs(
  timeoutClass: ChatTypingTimeoutClass,
): number {
  return CHAT_TYPING_DEFAULT_TIMEOUTS[timeoutClass];
}

export function resolveTypingStyleForActor(
  actorKind: ChatActorKind,
  channelFamily: ChatChannelFamily,
): ChatTypingStyleProfile {
  const assignment = CHAT_TYPING_STYLE_ASSIGNMENTS.find(
    (item) =>
      item.actorKind === actorKind && item.channelFamily === channelFamily,
  );

  if (!assignment) {
    return CHAT_TYPING_STYLE_PROFILES.HUMAN;
  }

  return Object.values(CHAT_TYPING_STYLE_PROFILES).find(
    (profile) => profile.styleId === assignment.styleId,
  ) ?? CHAT_TYPING_STYLE_PROFILES.HUMAN;
}

export function normalizeTypingRequest(
  request: ChatClientTypingRequest,
): ChatClientTypingRequest {
  return {
    ...request,
    typingState: isChatTypingState(request.typingState)
      ? request.typingState
      : 'NOT_TYPING',
  };
}

export function toLegacyTypingSnapshot(
  snapshot: ChatTypingSnapshot,
): LegacyCompatibleChatTypingSnapshot {
  return {
    actorId: snapshot.actorId,
    actorKind: snapshot.actorKind,
    channelId: snapshot.channelId,
    typingState: snapshot.typingState,
    startedAt: snapshot.startedAt,
    expiresAt: snapshot.expiresAt,
    token: snapshot.token,
    simulatedByPersona: snapshot.simulatedByPersona,
  };
}

export function toLegacyReadReceipt(
  receipt: ChatReadReceiptRecord,
): LegacyCompatibleChatReadReceipt {
  const legacyDelayReason =
    receipt.delayReason === 'PRESENCE_THEATER' ||
    receipt.delayReason === 'NEGOTIATION_PRESSURE' ||
    receipt.delayReason === 'NPC_LATENCY'
      ? receipt.delayReason
      : undefined;

  return {
    actorId: receipt.actorId,
    actorKind: receipt.actorKind,
    messageId: receipt.messageId,
    readAt: receipt.readAt,
    delayedByPolicy: receipt.delayedByPolicy,
    delayReason: legacyDelayReason,
  };
}

export function buildTypingFrame(
  roomId: ChatRoomId,
  authority: ChatAuthority,
  roster: ChatTypingRosterSnapshot,
): ChatTypingAuthorityFrame {
  return {
    frameId: `typing-frame:${roomId}:${roster.syncedAt}` as ChatTypingFrameId,
    roomId,
    authority,
    kind: 'TYPING_ROSTER',
    roster,
    syncedAt: roster.syncedAt,
  };
}

// ============================================================================
// MARK: Descriptor snapshot for introspection
// ============================================================================

export const CHAT_TYPING_CONTRACT_DESCRIPTOR = Object.freeze({
  file: 'shared/contracts/chat/ChatTyping.ts',
  version: CHAT_CONTRACT_VERSION,
  authorities: CHAT_CONTRACT_AUTHORITIES,
  channelFamilies: Array.from(
    new Set(
      Object.values(CHAT_CHANNEL_DESCRIPTORS).map((descriptor) => descriptor.family),
    ),
  ),
  modeScopes: CHAT_MODE_SCOPES,
  mountTargets: Object.keys(CHAT_MOUNT_PRESETS) as readonly ChatMountTarget[],
  actorKinds: CHAT_ACTOR_KINDS,
  authorityLevels: CHAT_AUTHORITIES,
  typingStates: CHAT_TYPING_STATES,
  typingSources: CHAT_TYPING_SOURCES,
  typingStyles: CHAT_TYPING_STYLE_KINDS,
  typingTriggers: CHAT_TYPING_TRIGGER_KINDS,
  readDelayReasons: CHAT_READ_DELAY_REASONS,
  telemetryEvents: CHAT_TYPING_TELEMETRY_EVENT_NAMES,
} as const);

export type ChatTypingContractDescriptor =
  typeof CHAT_TYPING_CONTRACT_DESCRIPTOR;
