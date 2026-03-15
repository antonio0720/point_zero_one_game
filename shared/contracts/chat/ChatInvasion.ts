/**
 * ============================================================================
 * POINT ZERO ONE — SHARED CHAT INVASION CONTRACTS
 * FILE: shared/contracts/chat/ChatInvasion.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical shared contract surface for chat invasion doctrine.
 *
 * "Invasion" is the unified shared term for the staged, authoritative,
 * multi-beat chat pressure event that may be triggered by gameplay reality,
 * rivalry heat, liveops pressure, negotiation state, rescue windows, or
 * scripted dramaturgy. The invasion surface must remain import-safe for:
 *
 *   - /shared/contracts/chat
 *   - /pzo-web/src/engines/chat
 *   - /pzo-web/src/components/chat
 *   - /backend/src/game/engine/chat
 *   - /pzo-server/src/chat
 *
 * Design laws
 * -----------
 * 1. An invasion is not “just another message.” It is a scene-level contract
 *    that can emit multiple messages, shadow writes, proof edges, and replay
 *    anchors over time.
 * 2. Frontend may preview banners and stage optimistic pacing, but backend owns
 *    invasion admission, suppression, target selection, escalation, and final
 *    transcript truth.
 * 3. Invasions must preserve the visible/shadow split already active in the
 *    donor chat lane.
 * 4. Invasion contracts must be rich enough to support helper interception,
 *    rivalry pressure, negotiation leakage, audience heat, legend moments,
 *    post-run ritual callbacks, and ML/DL recommendation hints without adding
 *    side-band runtime-only truth.
 * 5. The shared contract must preserve repo-specific engine reality: battle,
 *    pressure, shield, cascade, zero/tick, run, syndicate, and liveops all
 *    need a legal path into invasion planning.
 * ============================================================================
 */

import {
  type Brand,
  type ChatChannelDescriptor,
  type ChatChannelFamily,
  type ChatChannelId,
  type ChatDeliveryPriority,
  type ChatModeScope,
  type ChatRoomId,
  type JsonObject,
  type JsonValue,
  type Nullable,
  type Optional,
  type Score01,
  type Score100,
  type TickNumber,
  type UnixMs,
  CHAT_CHANNEL_DESCRIPTORS,
  CHAT_CONTRACT_AUTHORITIES,
  CHAT_CONTRACT_VERSION,
} from './ChatChannels';

import {
  type ChatActorKind,
  type ChatAffectSnapshot,
  type ChatAuthority,
  type ChatFeatureSnapshot,
  type ChatInferenceSnapshot,
  type ChatMessageId,
  type ChatMomentId,
  type ChatNotificationKind,
  type ChatNpcId,
  type ChatPressureTier,
  type ChatProofHash,
  type ChatRange,
  type ChatReplayId,
  type ChatRequestId,
  type ChatSequenceNumber,
  type ChatSessionId,
  type ChatTickTier,
  type ChatUpstreamSignal,
  type ChatUpstreamSignalType,
  type ChatUserId,
  type ChatWorldEventDescriptor,
  type ChatWorldEventId,
  CHAT_ACTOR_KINDS,
  CHAT_AUTHORITIES,
  CHAT_NOTIFICATION_KINDS,
  CHAT_UPSTREAM_SIGNAL_TYPES,
} from './ChatEvents';

import {
  type ChatAttachment,
  type ChatCanonicalMessage,
  type ChatEmbed,
  type ChatMessageOriginSurface,
  type ChatMessageToneBand,
  CHAT_MESSAGE_ORIGIN_SURFACES,
  CHAT_MESSAGE_TONE_BANDS,
} from './ChatMessage';

import {
  type ChatPresenceEntry,
  type ChatPresenceRole,
  CHAT_PRESENCE_ROLES,
} from './ChatPresence';

import {
  type ChatTranscriptAuditEnvelope,
  type ChatTranscriptExcerpt,
  type ChatTranscriptLegendAnchor,
  type ChatTranscriptProofEdge,
} from './ChatTranscript';

import {
  type ChatAnyNpcDescriptor,
  type ChatNpcCadenceBand,
  type ChatNpcDescriptor,
  type ChatNpcEntryStyle,
  type ChatNpcExitStyle,
  type ChatNpcLineCandidate,
  type ChatNpcReactionIntent,
  CHAT_NPC_ENTRY_STYLES,
  CHAT_NPC_EXIT_STYLES,
  CHAT_NPC_REACTION_INTENTS,
} from './ChatNpc';

// ============================================================================
// MARK: Branded identifiers
// ============================================================================

export type ChatInvasionId = Brand<string, 'ChatInvasionId'>;
export type ChatInvasionTemplateId = Brand<string, 'ChatInvasionTemplateId'>;
export type ChatInvasionRuleId = Brand<string, 'ChatInvasionRuleId'>;
export type ChatInvasionBeatId = Brand<string, 'ChatInvasionBeatId'>;
export type ChatInvasionSceneId = Brand<string, 'ChatInvasionSceneId'>;
export type ChatInvasionCueId = Brand<string, 'ChatInvasionCueId'>;
export type ChatInvasionPlanId = Brand<string, 'ChatInvasionPlanId'>;
export type ChatInvasionQueueId = Brand<string, 'ChatInvasionQueueId'>;
export type ChatInvasionQueueEntryId = Brand<string, 'ChatInvasionQueueEntryId'>;
export type ChatInvasionTargetId = Brand<string, 'ChatInvasionTargetId'>;
export type ChatInvasionTriggerId = Brand<string, 'ChatInvasionTriggerId'>;
export type ChatInvasionProofEdgeId = Brand<string, 'ChatInvasionProofEdgeId'>;
export type ChatInvasionReplayAnchorId = Brand<string, 'ChatInvasionReplayAnchorId'>;
export type ChatInvasionTelemetryHintId = Brand<string, 'ChatInvasionTelemetryHintId'>;
export type ChatInvasionBannerId = Brand<string, 'ChatInvasionBannerId'>;
export type ChatInvasionSuppressionId = Brand<string, 'ChatInvasionSuppressionId'>;
export type ChatInvasionCooldownId = Brand<string, 'ChatInvasionCooldownId'>;
export type ChatInvasionDecisionId = Brand<string, 'ChatInvasionDecisionId'>;
export type ChatInvasionOutcomeId = Brand<string, 'ChatInvasionOutcomeId'>;
export type ChatInvasionEscalationId = Brand<string, 'ChatInvasionEscalationId'>;
export type ChatInvasionResolutionId = Brand<string, 'ChatInvasionResolutionId'>;
export type ChatInvasionTransitionId = Brand<string, 'ChatInvasionTransitionId'>;
export type ChatInvasionShadowWriteId = Brand<string, 'ChatInvasionShadowWriteId'>;
export type ChatInvasionCounterplayId = Brand<string, 'ChatInvasionCounterplayId'>;
export type ChatInvasionWindowId = Brand<string, 'ChatInvasionWindowId'>;
export type ChatInvasionEffectId = Brand<string, 'ChatInvasionEffectId'>;
export type ChatInvasionLedgerId = Brand<string, 'ChatInvasionLedgerId'>;
export type ChatInvasionDescriptorKey = Brand<string, 'ChatInvasionDescriptorKey'>;

// ============================================================================
// MARK: Vocabularies
// ============================================================================

export const CHAT_INVASION_KINDS = [
  'HATER_SWARM',
  'HELPER_OVERRIDE',
  'AUDIENCE_RUSH',
  'NEGOTIATION_AMBUSH',
  'WORLD_EVENT_INTRUSION',
  'RIVALRY_CALLBACK',
  'RESCUE_INTERCEPT',
  'BOSS_TELEGRAPH',
  'POST_RUN_JUDGMENT',
  'SHADOW_REVEAL',
] as const;

export type ChatInvasionKind = (typeof CHAT_INVASION_KINDS)[number];

export const CHAT_INVASION_CLASSES = [
  'HOSTILE',
  'HELPFUL',
  'PREDATORY',
  'CEREMONIAL',
  'MIXED',
  'SHADOW',
] as const;

export type ChatInvasionClass = (typeof CHAT_INVASION_CLASSES)[number];

export const CHAT_INVASION_STAGES = [
  'QUEUED',
  'PRECHECK',
  'ADMITTED',
  'SHADOW_OPEN',
  'VISIBLE_OPEN',
  'ESCALATING',
  'HELPER_INTERCEPTED',
  'COUNTERPLAY_WINDOW',
  'RESOLVED',
  'SUPPRESSED',
  'FAILED',
  'ARCHIVED',
] as const;

export type ChatInvasionStage = (typeof CHAT_INVASION_STAGES)[number];

export const CHAT_INVASION_TRIGGER_KINDS = [
  'UPSTREAM_SIGNAL',
  'HATER_HEAT',
  'HELPER_RESCUE',
  'NEGOTIATION_PRESSURE',
  'AUDIENCE_HEAT',
  'WORLD_EVENT',
  'LEGEND_CALLBACK',
  'POST_RUN_TURNING_POINT',
  'SHADOW_REVEAL',
  'SCRIPTED_RUNTIME',
] as const;

export type ChatInvasionTriggerKind =
  (typeof CHAT_INVASION_TRIGGER_KINDS)[number];

export const CHAT_INVASION_VISIBILITY_MODES = [
  'SHADOW_FIRST',
  'VISIBLE_IMMEDIATE',
  'HELPER_PRIVATE_FIRST',
  'ROOM_VISIBLE_ONLY',
  'NEGOTIATION_PRIVATE_ONLY',
  'GLOBAL_BROADCAST',
] as const;

export type ChatInvasionVisibilityMode =
  (typeof CHAT_INVASION_VISIBILITY_MODES)[number];

export const CHAT_INVASION_TARGET_STRATEGIES = [
  'CURRENT_ROOM_OWNER',
  'PRIMARY_PLAYER',
  'LOWEST_SHIELD',
  'HIGHEST_HEAT',
  'MOST_VULNERABLE',
  'NEGOTIATION_COUNTERPARTY',
  'ROOM_WIDE',
  'SYNDICATE_WIDE',
  'WORLD_EVENT_MATCHED',
] as const;

export type ChatInvasionTargetStrategy =
  (typeof CHAT_INVASION_TARGET_STRATEGIES)[number];

export const CHAT_INVASION_ESCALATION_BANDS = [
  'NONE',
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
] as const;

export type ChatInvasionEscalationBand =
  (typeof CHAT_INVASION_ESCALATION_BANDS)[number];

export const CHAT_INVASION_ENTRY_STYLES = [
  'INSTANT_BANNER',
  'SHADOW_LURK',
  'NPC_TYPING_FAKEOUT',
  'SILENT_DROP',
  'SYSTEM_FLASH',
  'QUOTE_CALLBACK',
  'WORLD_EVENT_SIREN',
  'HELPER_WHISPER',
] as const;

export type ChatInvasionEntryStyle =
  (typeof CHAT_INVASION_ENTRY_STYLES)[number];

export const CHAT_INVASION_EXIT_STYLES = [
  'FADE',
  'CUT_TO_SILENCE',
  'HELPER_CLOSE',
  'HATER_LAST_WORD',
  'SYSTEM_CONFIRM',
  'LEGEND_ARCHIVE',
  'REPLAY_PIN',
] as const;

export type ChatInvasionExitStyle =
  (typeof CHAT_INVASION_EXIT_STYLES)[number];

export const CHAT_INVASION_AUDIENCE_EFFECTS = [
  'NONE',
  'HEAT_UP',
  'HEAT_DOWN',
  'SWARM',
  'RIDICULE',
  'AWE',
  'SILENCE',
  'CONSPIRATORIAL_SHIFT',
] as const;

export type ChatInvasionAudienceEffect =
  (typeof CHAT_INVASION_AUDIENCE_EFFECTS)[number];

export const CHAT_INVASION_RESOLUTION_KINDS = [
  'PLAYER_COUNTERED',
  'HELPER_DEFUSED',
  'HATER_WON',
  'SUPPRESSED_BY_POLICY',
  'LIVEOPS_CANCELLED',
  'TIMEOUT_EXPIRED',
  'NEGOTIATION_SETTLED',
  'POST_RUN_LOCKED',
] as const;

export type ChatInvasionResolutionKind =
  (typeof CHAT_INVASION_RESOLUTION_KINDS)[number];

export const CHAT_INVASION_FAILURE_REASONS = [
  'NO_ELIGIBLE_TARGET',
  'CHANNEL_LOCKED',
  'MODE_SCOPE_BLOCKED',
  'NPC_SUPPRESSED',
  'HELPER_LOCK_ACTIVE',
  'LIVEOPS_MUTE',
  'RATE_LIMIT_BLOCK',
  'ALREADY_RUNNING',
  'COOLDOWN_ACTIVE',
] as const;

export type ChatInvasionFailureReason =
  (typeof CHAT_INVASION_FAILURE_REASONS)[number];

export const CHAT_INVASION_COUNTERPLAY_KINDS = [
  'NONE',
  'FAST_REPLY',
  'COMMAND_ROUTE',
  'CHANNEL_SHIFT',
  'DEALROOM_COUNTER',
  'PROOF_CARD_RESPONSE',
  'HELPER_ACCEPT',
  'SILENCE_HOLD',
] as const;

export type ChatInvasionCounterplayKind =
  (typeof CHAT_INVASION_COUNTERPLAY_KINDS)[number];

export const CHAT_INVASION_SUPPRESSION_REASONS = [
  'PLAYER_MUTED',
  'SESSION_INVALID',
  'CHANNEL_UNAVAILABLE',
  'RESCUE_PROTECTION_WINDOW',
  'LIVEOPS_OVERRIDE',
  'POST_RUN_LOCK',
  'ROOM_EMPTY',
  'NEGOTIATION_PRIVACY',
  'SHADOW_ONLY_RUNTIME',
] as const;

export type ChatInvasionSuppressionReason =
  (typeof CHAT_INVASION_SUPPRESSION_REASONS)[number];

export const CHAT_INVASION_BEAT_ROLES = [
  'SYSTEM',
  'HATER',
  'HELPER',
  'AMBIENT',
  'AUDIENCE',
  'WORLD_EVENT',
  'NEGOTIATION_COUNTERPARTY',
] as const;

export type ChatInvasionBeatRole =
  (typeof CHAT_INVASION_BEAT_ROLES)[number];

export const CHAT_INVASION_THEATER_MODES = [
  'VISIBLE',
  'SHADOW',
  'MIXED',
  'WHISPER_TO_PLAYER',
  'ROOM_PUBLIC',
  'ROOM_PLUS_SHADOW',
] as const;

export type ChatInvasionTheaterMode =
  (typeof CHAT_INVASION_THEATER_MODES)[number];

export const CHAT_INVASION_IMPORTANCE_BANDS = [
  'BACKGROUND',
  'NOTICEABLE',
  'MAJOR',
  'CRITICAL',
  'LEGENDARY',
] as const;

export type ChatInvasionImportanceBand =
  (typeof CHAT_INVASION_IMPORTANCE_BANDS)[number];

export const CHAT_INVASION_QUEUE_POLICIES = [
  'FIFO',
  'PRIORITY',
  'REPLACE_LOWER_PRIORITY',
  'MERGE_SAME_TARGET',
  'MERGE_SAME_TEMPLATE',
] as const;

export type ChatInvasionQueuePolicy =
  (typeof CHAT_INVASION_QUEUE_POLICIES)[number];

// ============================================================================
// MARK: Core contract shapes
// ============================================================================

export interface ChatInvasionSignalGate {
  readonly signalType: ChatUpstreamSignalType;
  readonly allowedPressureTiers?: readonly ChatPressureTier[];
  readonly allowedTickTiers?: readonly ChatTickTier[];
  readonly minimumIntensity?: Score100;
  readonly requiredChannelFamilies?: readonly ChatChannelFamily[];
  readonly allowReplayTriggered?: boolean;
}

export interface ChatInvasionHeatGate {
  readonly minimumHaterHeat?: number;
  readonly minimumAudienceHeat?: number;
  readonly minimumTrustDeficit?: Score100;
  readonly minimumEmbarrassment?: Score100;
  readonly maximumHelperTrust?: Score100;
}

export interface ChatInvasionSuppressionWindow {
  readonly suppressionId: ChatInvasionSuppressionId;
  readonly reason: ChatInvasionSuppressionReason;
  readonly startsAt: UnixMs;
  readonly endsAt?: UnixMs;
  readonly affectsChannels: readonly ChatChannelId[];
  readonly affectsKinds?: readonly ChatInvasionKind[];
  readonly targetSessionId?: ChatSessionId;
  readonly targetUserId?: ChatUserId;
}

export interface ChatInvasionCooldownPolicy {
  readonly cooldownId: ChatInvasionCooldownId;
  readonly templateId: ChatInvasionTemplateId;
  readonly scope: 'PLAYER' | 'ROOM' | 'CHANNEL' | 'WORLD';
  readonly durationMs: number;
  readonly extendsOnEscalation: boolean;
  readonly extendsOnFailure: boolean;
  readonly suppressesLowerPriorityTemplates: boolean;
}

export interface ChatInvasionAdmissionPolicy {
  readonly allowedModeScopes: readonly ChatModeScope[];
  readonly allowedChannels: readonly ChatChannelId[];
  readonly visibleChannels: readonly ChatChannelId[];
  readonly shadowChannels: readonly ChatChannelId[];
  readonly requiresBackendAuthority: boolean;
  readonly queuePolicy: ChatInvasionQueuePolicy;
  readonly maximumConcurrentPerRoom: number;
  readonly maximumConcurrentPerTarget: number;
  readonly minimumSilenceWindowMs?: number;
  readonly disallowWhileLegendMomentVisible?: boolean;
  readonly disallowDuringHelperBlackout?: boolean;
}

export interface ChatInvasionTriggerDescriptor {
  readonly triggerId: ChatInvasionTriggerId;
  readonly kind: ChatInvasionTriggerKind;
  readonly description: string;
  readonly signalGates?: readonly ChatInvasionSignalGate[];
  readonly heatGate?: ChatInvasionHeatGate;
  readonly requiresWorldEventCode?: string;
  readonly requiresNegotiationContext?: boolean;
  readonly requiresRelationshipAnchor?: boolean;
  readonly requiresQuoteRecall?: boolean;
  readonly minimumFeatureSnapshot?: Pick<
    ChatFeatureSnapshot,
    'panelOpen' | 'visibleMessageCount' | 'composerLength' | 'silenceWindowMs'
  >;
}

export interface ChatInvasionRuntimeTarget {
  readonly targetId: ChatInvasionTargetId;
  readonly strategy: ChatInvasionTargetStrategy;
  readonly sessionId?: ChatSessionId;
  readonly userId?: ChatUserId;
  readonly roomId?: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly role: ChatPresenceRole;
  readonly vulnerabilityScore: Score100;
  readonly reputationPressure: Score100;
  readonly helperCoverageScore: Score100;
  readonly haterFocusScore: Score100;
}

export interface ChatInvasionAudiencePlan {
  readonly effect: ChatInvasionAudienceEffect;
  readonly intensity: Score100;
  readonly affectedChannels: readonly ChatChannelId[];
  readonly crowdLineBudget: number;
  readonly allowSwarmResponses: boolean;
  readonly allowSilenceDrop: boolean;
}

export interface ChatInvasionAffectDelta {
  readonly intimidationDelta: number;
  readonly confidenceDelta: number;
  readonly frustrationDelta: number;
  readonly curiosityDelta: number;
  readonly attachmentDelta: number;
  readonly embarrassmentDelta: number;
  readonly reliefDelta: number;
  readonly dominanceDelta: number;
  readonly desperationDelta: number;
  readonly trustDelta: number;
}

export interface ChatInvasionRelationshipDelta {
  readonly npcId?: ChatNpcId;
  readonly respectDelta?: number;
  readonly fearDelta?: number;
  readonly contemptDelta?: number;
  readonly fascinationDelta?: number;
  readonly trustDelta?: number;
  readonly rivalryDelta?: number;
  readonly rescueDebtDelta?: number;
}

export interface ChatInvasionCounterplayWindow {
  readonly counterplayId: ChatInvasionCounterplayId;
  readonly kind: ChatInvasionCounterplayKind;
  readonly opensAtBeatId: ChatInvasionBeatId;
  readonly closesAtBeatId?: ChatInvasionBeatId;
  readonly expiresAt?: UnixMs;
  readonly acceptsCommands?: readonly string[];
  readonly acceptsChannels?: readonly ChatChannelId[];
  readonly grantsHelperInterception?: boolean;
  readonly grantsReplayAnchor?: boolean;
}

export interface ChatInvasionProofPlan {
  readonly proofHash?: ChatProofHash;
  readonly createProofEdge: boolean;
  readonly createTranscriptLegendAnchor: boolean;
  readonly auditTags: readonly string[];
  readonly replayTags: readonly string[];
}

export interface ChatInvasionShadowWrite {
  readonly shadowWriteId: ChatInvasionShadowWriteId;
  readonly channelId: ChatChannelId;
  readonly body: string;
  readonly reason: string;
  readonly visibleToPlayer: boolean;
  readonly expiresAt?: UnixMs;
}

export interface ChatInvasionBeatLine {
  readonly role: ChatInvasionBeatRole;
  readonly npcId?: ChatNpcId;
  readonly actorKind: ChatActorKind;
  readonly channelId: ChatChannelId;
  readonly body: string;
  readonly toneBand: ChatMessageToneBand;
  readonly originSurface: ChatMessageOriginSurface;
  readonly entryStyle?: ChatInvasionEntryStyle;
  readonly delayMs?: number;
  readonly messageAttachments?: readonly ChatAttachment[];
  readonly messageEmbeds?: readonly ChatEmbed[];
  readonly notificationKind?: ChatNotificationKind;
}

export interface ChatInvasionBeat {
  readonly beatId: ChatInvasionBeatId;
  readonly ordinal: number;
  readonly stage: ChatInvasionStage;
  readonly theaterMode: ChatInvasionTheaterMode;
  readonly importance: ChatInvasionImportanceBand;
  readonly lines: readonly ChatInvasionBeatLine[];
  readonly shadowWrites?: readonly ChatInvasionShadowWrite[];
  readonly counterplayWindow?: ChatInvasionCounterplayWindow;
  readonly affectDelta?: ChatInvasionAffectDelta;
  readonly relationshipDeltas?: readonly ChatInvasionRelationshipDelta[];
  readonly proofPlan?: ChatInvasionProofPlan;
  readonly startsTypingBeforeVisibleMs?: number;
  readonly silenceBeforeBeatMs?: number;
  readonly silenceAfterBeatMs?: number;
}

export interface ChatInvasionScenePlan {
  readonly sceneId: ChatInvasionSceneId;
  readonly title: string;
  readonly subtitle?: string;
  readonly entryStyle: ChatInvasionEntryStyle;
  readonly exitStyle: ChatInvasionExitStyle;
  readonly class: ChatInvasionClass;
  readonly theaterMode: ChatInvasionTheaterMode;
  readonly beats: readonly ChatInvasionBeat[];
  readonly helperCanHijack: boolean;
  readonly haterCanEscalateMidScene: boolean;
  readonly canResolveIntoLegendMoment: boolean;
}

export interface ChatInvasionFailurePolicy {
  readonly allowShadowRecordOnFailure: boolean;
  readonly shadowRecordReason: string;
  readonly emitSystemNoticeOnFailure: boolean;
  readonly retryAfterMs?: number;
  readonly failReason: ChatInvasionFailureReason;
}

export interface ChatInvasionResolutionPolicy {
  readonly resolutionKinds: readonly ChatInvasionResolutionKind[];
  readonly canAwardLegendAnchor: boolean;
  readonly canGrantReplayPin: boolean;
  readonly canTriggerPostRunCallback: boolean;
  readonly createWorldEventCallbackIfWorldEventBound: boolean;
  readonly winnerActorKind?: ChatActorKind;
  readonly loserActorKind?: ChatActorKind;
}

export interface ChatInvasionTemplate {
  readonly templateId: ChatInvasionTemplateId;
  readonly code: string;
  readonly displayName: string;
  readonly summary: string;
  readonly kind: ChatInvasionKind;
  readonly class: ChatInvasionClass;
  readonly admission: ChatInvasionAdmissionPolicy;
  readonly trigger: ChatInvasionTriggerDescriptor;
  readonly targetStrategy: ChatInvasionTargetStrategy;
  readonly entryStyle: ChatInvasionEntryStyle;
  readonly exitStyle: ChatInvasionExitStyle;
  readonly escalationBand: ChatInvasionEscalationBand;
  readonly basePriority: ChatDeliveryPriority;
  readonly importance: ChatInvasionImportanceBand;
  readonly audiencePlan: ChatInvasionAudiencePlan;
  readonly cooldown: ChatInvasionCooldownPolicy;
  readonly scenePlan: ChatInvasionScenePlan;
  readonly failurePolicy: ChatInvasionFailurePolicy;
  readonly resolutionPolicy: ChatInvasionResolutionPolicy;
  readonly defaultCounterplayKinds: readonly ChatInvasionCounterplayKind[];
  readonly defaultSuppressionReasons?: readonly ChatInvasionSuppressionReason[];
  readonly worldEventHook?: string;
  readonly negotiationLeakAllowed?: boolean;
  readonly helperBias: Score01;
  readonly haterBias: Score01;
}

export interface ChatInvasionCandidate {
  readonly decisionId: ChatInvasionDecisionId;
  readonly template: ChatInvasionTemplate;
  readonly target: ChatInvasionRuntimeTarget;
  readonly roomId: ChatRoomId;
  readonly activeChannelId: ChatChannelId;
  readonly score: Score100;
  readonly reason: string;
  readonly inferenceSnapshot?: ChatInferenceSnapshot;
  readonly featureSnapshot?: ChatFeatureSnapshot;
  readonly upstreamSignal?: ChatUpstreamSignal;
  readonly worldEvent?: ChatWorldEventDescriptor;
  readonly affectSnapshot?: ChatAffectSnapshot;
}

export interface ChatInvasionPlan {
  readonly planId: ChatInvasionPlanId;
  readonly invasionId: ChatInvasionId;
  readonly templateId: ChatInvasionTemplateId;
  readonly roomId: ChatRoomId;
  readonly target: ChatInvasionRuntimeTarget;
  readonly scene: ChatInvasionScenePlan;
  readonly stage: ChatInvasionStage;
  readonly admittedAt: UnixMs;
  readonly scheduledStartAt?: UnixMs;
  readonly stageExpiresAt?: UnixMs;
  readonly activeWorldEventId?: ChatWorldEventId;
  readonly createdFromSignalType?: ChatUpstreamSignalType;
  readonly proofHash?: ChatProofHash;
  readonly recommendationScore?: Score100;
}

export interface ChatInvasionQueueEntry {
  readonly queueEntryId: ChatInvasionQueueEntryId;
  readonly invasionId: ChatInvasionId;
  readonly templateId: ChatInvasionTemplateId;
  readonly roomId: ChatRoomId;
  readonly targetId: ChatInvasionTargetId;
  readonly queuedAt: UnixMs;
  readonly priority: ChatDeliveryPriority;
  readonly score: Score100;
  readonly policy: ChatInvasionQueuePolicy;
}

export interface ChatInvasionQueueState {
  readonly queueId: ChatInvasionQueueId;
  readonly roomId: ChatRoomId;
  readonly policy: ChatInvasionQueuePolicy;
  readonly entries: readonly ChatInvasionQueueEntry[];
  readonly activeInvasionIds: readonly ChatInvasionId[];
}

export interface ChatInvasionOutcome {
  readonly outcomeId: ChatInvasionOutcomeId;
  readonly invasionId: ChatInvasionId;
  readonly stage: Extract<
    ChatInvasionStage,
    'RESOLVED' | 'SUPPRESSED' | 'FAILED' | 'ARCHIVED'
  >;
  readonly resolutionKind?: ChatInvasionResolutionKind;
  readonly failureReason?: ChatInvasionFailureReason;
  readonly suppressedReason?: ChatInvasionSuppressionReason;
  readonly occurredAt: UnixMs;
  readonly winningActorKind?: ChatActorKind;
  readonly proofHash?: ChatProofHash;
  readonly replayAnchorId?: ChatInvasionReplayAnchorId;
  readonly legendAnchor?: ChatTranscriptLegendAnchor;
}

export interface ChatInvasionReplayAnchor {
  readonly replayAnchorId: ChatInvasionReplayAnchorId;
  readonly invasionId: ChatInvasionId;
  readonly replayId?: ChatReplayId;
  readonly range?: ChatRange;
  readonly pinnedMessageIds: readonly ChatMessageId[];
  readonly createdAt: UnixMs;
}

export interface ChatInvasionProofEdge {
  readonly proofEdgeId: ChatInvasionProofEdgeId;
  readonly invasionId: ChatInvasionId;
  readonly sourceMessageId?: ChatMessageId;
  readonly targetMessageId?: ChatMessageId;
  readonly proofHash?: ChatProofHash;
  readonly reason: string;
  readonly createdAt: UnixMs;
}

export interface ChatInvasionLedgerEntry {
  readonly ledgerId: ChatInvasionLedgerId;
  readonly invasionId: ChatInvasionId;
  readonly templateId: ChatInvasionTemplateId;
  readonly roomId: ChatRoomId;
  readonly startedAt?: UnixMs;
  readonly endedAt?: UnixMs;
  readonly stage: ChatInvasionStage;
  readonly target: ChatInvasionRuntimeTarget;
  readonly emittedMessageIds: readonly ChatMessageId[];
  readonly proofEdges: readonly ChatInvasionProofEdge[];
  readonly replayAnchor?: ChatInvasionReplayAnchor;
  readonly outcome?: ChatInvasionOutcome;
}

export interface ChatInvasionRuntimeState {
  readonly invasionId: ChatInvasionId;
  readonly templateId: ChatInvasionTemplateId;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly target: ChatInvasionRuntimeTarget;
  readonly class: ChatInvasionClass;
  readonly kind: ChatInvasionKind;
  readonly stage: ChatInvasionStage;
  readonly currentBeatId?: ChatInvasionBeatId;
  readonly currentBeatOrdinal?: number;
  readonly helperIntercepted: boolean;
  readonly escalationBand: ChatInvasionEscalationBand;
  readonly visibleBannerId?: ChatInvasionBannerId;
  readonly proofHash?: ChatProofHash;
  readonly startedAt?: UnixMs;
  readonly updatedAt: UnixMs;
}

export interface ChatInvasionBannerSnapshot {
  readonly bannerId: ChatInvasionBannerId;
  readonly invasionId: ChatInvasionId;
  readonly title: string;
  readonly subtitle?: string;
  readonly class: ChatInvasionClass;
  readonly stage: ChatInvasionStage;
  readonly importance: ChatInvasionImportanceBand;
  readonly channelId: ChatChannelId;
  readonly visible: boolean;
  readonly canCollapse: boolean;
  readonly showThreatMeter: boolean;
}

export interface LegacyCompatibleChatInvasionBanner {
  readonly title: string;
  readonly subtitle?: string;
  readonly visible: boolean;
  readonly threatLevel: number;
  readonly channel: ChatChannelId;
}

// ============================================================================
// MARK: Descriptor registry
// ============================================================================

const HOSTILE_CHANNELS = ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM'] as const;
const WORLD_EVENT_CHANNELS = ['GLOBAL', 'LIVEOPS_SHADOW'] as const;
const RESCUE_CHANNELS = ['GLOBAL', 'RESCUE_SHADOW'] as const;
const NEGOTIATION_CHANNELS = ['DEAL_ROOM', 'NPC_SHADOW'] as const;

export const CHAT_INVASION_TEMPLATES: readonly ChatInvasionTemplate[] = [
  {
    templateId: 'inv_tpl_hater_swarm_public' as ChatInvasionTemplateId,
    code: 'HATER_SWARM_PUBLIC_BREAK',
    displayName: 'Public Break Swarm',
    summary:
      'Public hostile sequence that lands after a shield breach or steep pressure jump and forces the room to witness the moment.',
    kind: 'HATER_SWARM',
    class: 'HOSTILE',
    admission: {
      allowedModeScopes: ['BATTLE', 'RUN', 'PREDATOR', 'PHANTOM'],
      allowedChannels: HOSTILE_CHANNELS,
      visibleChannels: ['GLOBAL', 'SYNDICATE'],
      shadowChannels: ['RIVALRY_SHADOW', 'NPC_SHADOW'],
      requiresBackendAuthority: true,
      queuePolicy: 'REPLACE_LOWER_PRIORITY',
      maximumConcurrentPerRoom: 1,
      maximumConcurrentPerTarget: 1,
      minimumSilenceWindowMs: 1200,
      disallowWhileLegendMomentVisible: true,
      disallowDuringHelperBlackout: false,
    },
    trigger: {
      triggerId: 'inv_trg_hater_swarm_public' as ChatInvasionTriggerId,
      kind: 'UPSTREAM_SIGNAL',
      description:
        'Breach, hostile attack, or severe pressure movement authorizes a public hater swarm scene.',
      signalGates: [
        {
          signalType: 'SHIELD_LAYER_BREACHED',
          allowedPressureTiers: ['PRESSURED', 'CRITICAL', 'BREAKPOINT'],
          minimumIntensity: 60 as Score100,
          requiredChannelFamilies: ['PUBLIC', 'PRIVATE'],
          allowReplayTriggered: false,
        },
        {
          signalType: 'BOT_ATTACK_FIRED',
          allowedPressureTiers: ['WATCHFUL', 'PRESSURED', 'CRITICAL'],
          minimumIntensity: 55 as Score100,
          requiredChannelFamilies: ['PUBLIC'],
          allowReplayTriggered: false,
        },
      ],
      heatGate: {
        minimumHaterHeat: 55,
        minimumAudienceHeat: 42,
        minimumEmbarrassment: 35 as Score100,
      },
      requiresNegotiationContext: false,
      requiresRelationshipAnchor: true,
      requiresQuoteRecall: true,
    },
    targetStrategy: 'MOST_VULNERABLE',
    entryStyle: 'SYSTEM_FLASH',
    exitStyle: 'HATER_LAST_WORD',
    escalationBand: 'HIGH',
    basePriority: 'HIGH',
    importance: 'CRITICAL',
    audiencePlan: {
      effect: 'SWARM',
      intensity: 82 as Score100,
      affectedChannels: ['GLOBAL', 'RIVALRY_SHADOW'],
      crowdLineBudget: 3,
      allowSwarmResponses: true,
      allowSilenceDrop: false,
    },
    cooldown: {
      cooldownId: 'inv_cd_hater_swarm_public' as ChatInvasionCooldownId,
      templateId: 'inv_tpl_hater_swarm_public' as ChatInvasionTemplateId,
      scope: 'PLAYER',
      durationMs: 65000,
      extendsOnEscalation: true,
      extendsOnFailure: false,
      suppressesLowerPriorityTemplates: true,
    },
    scenePlan: {
      sceneId: 'inv_scene_hater_swarm_public' as ChatInvasionSceneId,
      title: 'The Room Turns',
      subtitle: 'A break becomes public memory.',
      entryStyle: 'SYSTEM_FLASH',
      exitStyle: 'HATER_LAST_WORD',
      class: 'HOSTILE',
      theaterMode: 'ROOM_PLUS_SHADOW',
      helperCanHijack: true,
      haterCanEscalateMidScene: true,
      canResolveIntoLegendMoment: true,
      beats: [
        {
          beatId: 'inv_beat_hsp_01' as ChatInvasionBeatId,
          ordinal: 1,
          stage: 'VISIBLE_OPEN',
          theaterMode: 'ROOM_PUBLIC',
          importance: 'MAJOR',
          startsTypingBeforeVisibleMs: 900,
          lines: [
            {
              role: 'SYSTEM',
              actorKind: 'SYSTEM',
              channelId: 'GLOBAL',
              body: 'The room noticed the break before you could explain it.',
              toneBand: 'ALERTING',
              originSurface: 'INVASION_DIRECTOR',
              notificationKind: 'HATER_ATTACK',
            },
            {
              role: 'HATER',
              npcId: 'npc_hater_vanta' as ChatNpcId,
              actorKind: 'NPC',
              channelId: 'GLOBAL',
              body: 'You felt that hit. So did everyone else.',
              toneBand: 'HOSTILE',
              originSurface: 'INVASION_DIRECTOR',
            },
          ],
          shadowWrites: [
            {
              shadowWriteId: 'inv_sw_hsp_01' as ChatInvasionShadowWriteId,
              channelId: 'RIVALRY_SHADOW',
              body: 'Rivalry heat climbs after visible breach.',
              reason: 'Track escalation before crowd pile-on.',
              visibleToPlayer: false,
            },
          ],
          affectDelta: {
            intimidationDelta: 10,
            confidenceDelta: -8,
            frustrationDelta: 6,
            curiosityDelta: 0,
            attachmentDelta: 0,
            embarrassmentDelta: 12,
            reliefDelta: 0,
            dominanceDelta: -6,
            desperationDelta: 7,
            trustDelta: -2,
          },
        },
        {
          beatId: 'inv_beat_hsp_02' as ChatInvasionBeatId,
          ordinal: 2,
          stage: 'ESCALATING',
          theaterMode: 'ROOM_PLUS_SHADOW',
          importance: 'CRITICAL',
          silenceBeforeBeatMs: 600,
          lines: [
            {
              role: 'AUDIENCE',
              actorKind: 'SYSTEM',
              channelId: 'GLOBAL',
              body: 'Crowd heat surges. The room starts quoting your earlier confidence back at you.',
              toneBand: 'HOSTILE',
              originSurface: 'INVASION_DIRECTOR',
            },
            {
              role: 'HATER',
              npcId: 'npc_hater_vanta' as ChatNpcId,
              actorKind: 'NPC',
              channelId: 'GLOBAL',
              body: 'Three minutes ago you said this was easy.',
              toneBand: 'HOSTILE',
              originSurface: 'INVASION_DIRECTOR',
            },
          ],
          counterplayWindow: {
            counterplayId: 'inv_cp_hsp_02' as ChatInvasionCounterplayId,
            kind: 'FAST_REPLY',
            opensAtBeatId: 'inv_beat_hsp_02' as ChatInvasionBeatId,
            acceptsChannels: ['GLOBAL', 'SYNDICATE'],
            grantsHelperInterception: true,
            grantsReplayAnchor: true,
          },
          relationshipDeltas: [
            {
              npcId: 'npc_hater_vanta' as ChatNpcId,
              fearDelta: 4,
              contemptDelta: 7,
              rivalryDelta: 9,
            },
          ],
        },
        {
          beatId: 'inv_beat_hsp_03' as ChatInvasionBeatId,
          ordinal: 3,
          stage: 'COUNTERPLAY_WINDOW',
          theaterMode: 'WHISPER_TO_PLAYER',
          importance: 'MAJOR',
          lines: [
            {
              role: 'HELPER',
              npcId: 'npc_helper_kade' as ChatNpcId,
              actorKind: 'NPC',
              channelId: 'SYNDICATE',
              body: 'Take the room back or leave it. Do not drift in the middle.',
              toneBand: 'HELPFUL',
              originSurface: 'INVASION_DIRECTOR',
            },
          ],
        },
      ],
    },
    failurePolicy: {
      allowShadowRecordOnFailure: true,
      shadowRecordReason: 'Preserve failed hostile entry for future callbacks.',
      emitSystemNoticeOnFailure: false,
      failReason: 'CHANNEL_LOCKED',
    },
    resolutionPolicy: {
      resolutionKinds: ['PLAYER_COUNTERED', 'HELPER_DEFUSED', 'HATER_WON'],
      canAwardLegendAnchor: true,
      canGrantReplayPin: true,
      canTriggerPostRunCallback: true,
      createWorldEventCallbackIfWorldEventBound: false,
      winnerActorKind: 'PLAYER',
      loserActorKind: 'NPC',
    },
    defaultCounterplayKinds: ['FAST_REPLY', 'CHANNEL_SHIFT', 'HELPER_ACCEPT'],
    helperBias: 0.64 as Score01,
    haterBias: 0.92 as Score01,
  },
  {
    templateId: 'inv_tpl_rescue_intercept' as ChatInvasionTemplateId,
    code: 'HELPER_RESCUE_INTERCEPT',
    displayName: 'Rescue Intercept',
    summary:
      'Private helper-first invasion that lands before a rage-quit spiral becomes irreversible.',
    kind: 'RESCUE_INTERCEPT',
    class: 'HELPFUL',
    admission: {
      allowedModeScopes: ['BATTLE', 'RUN', 'EMPIRE', 'SYNDICATE'],
      allowedChannels: RESCUE_CHANNELS,
      visibleChannels: ['GLOBAL'],
      shadowChannels: ['RESCUE_SHADOW'],
      requiresBackendAuthority: true,
      queuePolicy: 'MERGE_SAME_TARGET',
      maximumConcurrentPerRoom: 1,
      maximumConcurrentPerTarget: 1,
      minimumSilenceWindowMs: 2200,
      disallowWhileLegendMomentVisible: false,
      disallowDuringHelperBlackout: true,
    },
    trigger: {
      triggerId: 'inv_trg_rescue_intercept' as ChatInvasionTriggerId,
      kind: 'HELPER_RESCUE',
      description:
        'Long silence, repeated failure, or aggressive channel hopping opens a helper rescue intercept.',
      heatGate: {
        minimumEmbarrassment: 20 as Score100,
        maximumHelperTrust: 90 as Score100,
      },
      requiresNegotiationContext: false,
      requiresRelationshipAnchor: true,
      requiresQuoteRecall: false,
      minimumFeatureSnapshot: {
        panelOpen: true,
        visibleMessageCount: 0,
        composerLength: 0,
        silenceWindowMs: 8000,
      },
    },
    targetStrategy: 'PRIMARY_PLAYER',
    entryStyle: 'HELPER_WHISPER',
    exitStyle: 'HELPER_CLOSE',
    escalationBand: 'LOW',
    basePriority: 'HIGH',
    importance: 'MAJOR',
    audiencePlan: {
      effect: 'SILENCE',
      intensity: 35 as Score100,
      affectedChannels: ['GLOBAL', 'RESCUE_SHADOW'],
      crowdLineBudget: 0,
      allowSwarmResponses: false,
      allowSilenceDrop: true,
    },
    cooldown: {
      cooldownId: 'inv_cd_rescue_intercept' as ChatInvasionCooldownId,
      templateId: 'inv_tpl_rescue_intercept' as ChatInvasionTemplateId,
      scope: 'PLAYER',
      durationMs: 45000,
      extendsOnEscalation: false,
      extendsOnFailure: true,
      suppressesLowerPriorityTemplates: true,
    },
    scenePlan: {
      sceneId: 'inv_scene_rescue_intercept' as ChatInvasionSceneId,
      title: 'Before You Drop',
      subtitle: 'A helper gets one clean window.',
      entryStyle: 'HELPER_WHISPER',
      exitStyle: 'HELPER_CLOSE',
      class: 'HELPFUL',
      theaterMode: 'WHISPER_TO_PLAYER',
      helperCanHijack: true,
      haterCanEscalateMidScene: false,
      canResolveIntoLegendMoment: false,
      beats: [
        {
          beatId: 'inv_beat_ri_01' as ChatInvasionBeatId,
          ordinal: 1,
          stage: 'SHADOW_OPEN',
          theaterMode: 'SHADOW',
          importance: 'NOTICEABLE',
          lines: [
            {
              role: 'HELPER',
              npcId: 'npc_helper_kade' as ChatNpcId,
              actorKind: 'NPC',
              channelId: 'GLOBAL',
              body: 'You are close to throwing the run away for emotional reasons, not strategic ones.',
              toneBand: 'HELPFUL',
              originSurface: 'INVASION_DIRECTOR',
            },
          ],
          shadowWrites: [
            {
              shadowWriteId: 'inv_sw_ri_01' as ChatInvasionShadowWriteId,
              channelId: 'RESCUE_SHADOW',
              body: 'Rescue intercept opened due to silence and failure clustering.',
              reason: 'Store helper intervention cause chain.',
              visibleToPlayer: false,
            },
          ],
        },
        {
          beatId: 'inv_beat_ri_02' as ChatInvasionBeatId,
          ordinal: 2,
          stage: 'COUNTERPLAY_WINDOW',
          theaterMode: 'WHISPER_TO_PLAYER',
          importance: 'MAJOR',
          lines: [
            {
              role: 'HELPER',
              npcId: 'npc_helper_kade' as ChatNpcId,
              actorKind: 'NPC',
              channelId: 'GLOBAL',
              body: 'Type one clean response, shift channel, or take the recovery route. Those are the moves.',
              toneBand: 'HELPFUL',
              originSurface: 'INVASION_DIRECTOR',
            },
          ],
          counterplayWindow: {
            counterplayId: 'inv_cp_ri_02' as ChatInvasionCounterplayId,
            kind: 'HELPER_ACCEPT',
            opensAtBeatId: 'inv_beat_ri_02' as ChatInvasionBeatId,
            acceptsCommands: ['/recover', '/focus', '/mute-global'],
            acceptsChannels: ['GLOBAL', 'SYNDICATE'],
            grantsHelperInterception: true,
            grantsReplayAnchor: false,
          },
        },
      ],
    },
    failurePolicy: {
      allowShadowRecordOnFailure: true,
      shadowRecordReason: 'Track failed rescue for later helper trust adaptation.',
      emitSystemNoticeOnFailure: false,
      retryAfterMs: 12000,
      failReason: 'HELPER_LOCK_ACTIVE',
    },
    resolutionPolicy: {
      resolutionKinds: ['HELPER_DEFUSED', 'TIMEOUT_EXPIRED'],
      canAwardLegendAnchor: false,
      canGrantReplayPin: false,
      canTriggerPostRunCallback: true,
      createWorldEventCallbackIfWorldEventBound: false,
      winnerActorKind: 'NPC',
    },
    defaultCounterplayKinds: ['HELPER_ACCEPT', 'CHANNEL_SHIFT', 'COMMAND_ROUTE'],
    helperBias: 0.98 as Score01,
    haterBias: 0.18 as Score01,
  },
  {
    templateId: 'inv_tpl_negotiation_ambush' as ChatInvasionTemplateId,
    code: 'DEALROOM_AMBUSH_LEAK',
    displayName: 'Deal Room Ambush',
    summary:
      'Predatory private invasion that escalates bluff pressure and may leak a social read into adjacent channels.',
    kind: 'NEGOTIATION_AMBUSH',
    class: 'PREDATORY',
    admission: {
      allowedModeScopes: ['RUN', 'PREDATOR', 'SYNDICATE', 'EMPIRE'],
      allowedChannels: NEGOTIATION_CHANNELS,
      visibleChannels: ['DEAL_ROOM'],
      shadowChannels: ['NPC_SHADOW', 'RIVALRY_SHADOW'],
      requiresBackendAuthority: true,
      queuePolicy: 'MERGE_SAME_TEMPLATE',
      maximumConcurrentPerRoom: 1,
      maximumConcurrentPerTarget: 1,
      minimumSilenceWindowMs: 700,
      disallowWhileLegendMomentVisible: false,
      disallowDuringHelperBlackout: false,
    },
    trigger: {
      triggerId: 'inv_trg_negotiation_ambush' as ChatInvasionTriggerId,
      kind: 'NEGOTIATION_PRESSURE',
      description: 'Offer pressure, hesitation, or bluff instability opens a deal room ambush.',
      requiresNegotiationContext: true,
      requiresRelationshipAnchor: true,
      requiresQuoteRecall: true,
    },
    targetStrategy: 'NEGOTIATION_COUNTERPARTY',
    entryStyle: 'NPC_TYPING_FAKEOUT',
    exitStyle: 'FADE',
    escalationBand: 'MEDIUM',
    basePriority: 'HIGH',
    importance: 'MAJOR',
    audiencePlan: {
      effect: 'CONSPIRATORIAL_SHIFT',
      intensity: 48 as Score100,
      affectedChannels: ['DEAL_ROOM', 'NPC_SHADOW'],
      crowdLineBudget: 1,
      allowSwarmResponses: false,
      allowSilenceDrop: false,
    },
    cooldown: {
      cooldownId: 'inv_cd_negotiation_ambush' as ChatInvasionCooldownId,
      templateId: 'inv_tpl_negotiation_ambush' as ChatInvasionTemplateId,
      scope: 'ROOM',
      durationMs: 30000,
      extendsOnEscalation: true,
      extendsOnFailure: false,
      suppressesLowerPriorityTemplates: false,
    },
    scenePlan: {
      sceneId: 'inv_scene_negotiation_ambush' as ChatInvasionSceneId,
      title: 'Read in the Chamber',
      subtitle: 'The counterparty sees the bluff shift.',
      entryStyle: 'NPC_TYPING_FAKEOUT',
      exitStyle: 'FADE',
      class: 'PREDATORY',
      theaterMode: 'MIXED',
      helperCanHijack: true,
      haterCanEscalateMidScene: true,
      canResolveIntoLegendMoment: false,
      beats: [
        {
          beatId: 'inv_beat_na_01' as ChatInvasionBeatId,
          ordinal: 1,
          stage: 'VISIBLE_OPEN',
          theaterMode: 'VISIBLE',
          importance: 'NOTICEABLE',
          lines: [
            {
              role: 'NEGOTIATION_COUNTERPARTY',
              npcId: 'npc_hater_morrow' as ChatNpcId,
              actorKind: 'NPC',
              channelId: 'DEAL_ROOM',
              body: 'You became careful exactly where confident players stay smooth.',
              toneBand: 'PREDATORY',
              originSurface: 'NEGOTIATION_ENGINE',
            },
          ],
        },
        {
          beatId: 'inv_beat_na_02' as ChatInvasionBeatId,
          ordinal: 2,
          stage: 'ESCALATING',
          theaterMode: 'ROOM_PLUS_SHADOW',
          importance: 'MAJOR',
          lines: [
            {
              role: 'SYSTEM',
              actorKind: 'SYSTEM',
              channelId: 'DEAL_ROOM',
              body: 'Offer pressure rises. Delay now reads as weakness.',
              toneBand: 'ALERTING',
              originSurface: 'NEGOTIATION_ENGINE',
            },
          ],
          counterplayWindow: {
            counterplayId: 'inv_cp_na_02' as ChatInvasionCounterplayId,
            kind: 'DEALROOM_COUNTER',
            opensAtBeatId: 'inv_beat_na_02' as ChatInvasionBeatId,
            acceptsCommands: ['/counter', '/anchor', '/walk'],
            acceptsChannels: ['DEAL_ROOM'],
            grantsHelperInterception: true,
            grantsReplayAnchor: true,
          },
        },
      ],
    },
    failurePolicy: {
      allowShadowRecordOnFailure: true,
      shadowRecordReason: 'Save negotiation instability for future callback lines.',
      emitSystemNoticeOnFailure: false,
      failReason: 'NEGOTIATION_PRIVACY' as ChatInvasionFailureReason,
    },
    resolutionPolicy: {
      resolutionKinds: ['NEGOTIATION_SETTLED', 'PLAYER_COUNTERED', 'HATER_WON'],
      canAwardLegendAnchor: false,
      canGrantReplayPin: true,
      canTriggerPostRunCallback: true,
      createWorldEventCallbackIfWorldEventBound: false,
    },
    defaultCounterplayKinds: ['DEALROOM_COUNTER', 'COMMAND_ROUTE', 'SILENCE_HOLD'],
    negotiationLeakAllowed: true,
    helperBias: 0.42 as Score01,
    haterBias: 0.88 as Score01,
  },
  {
    templateId: 'inv_tpl_world_event_intrusion' as ChatInvasionTemplateId,
    code: 'WORLD_EVENT_INTRUSION_SIREN',
    displayName: 'World Event Intrusion',
    summary:
      'Global, event-bound invasion that changes room mood and injects coordinated system pressure.',
    kind: 'WORLD_EVENT_INTRUSION',
    class: 'CEREMONIAL',
    admission: {
      allowedModeScopes: ['RUN', 'BATTLE', 'SYNDICATE', 'EMPIRE', 'POST_RUN'],
      allowedChannels: WORLD_EVENT_CHANNELS,
      visibleChannels: ['GLOBAL'],
      shadowChannels: ['LIVEOPS_SHADOW'],
      requiresBackendAuthority: true,
      queuePolicy: 'PRIORITY',
      maximumConcurrentPerRoom: 1,
      maximumConcurrentPerTarget: 1,
      disallowWhileLegendMomentVisible: false,
      disallowDuringHelperBlackout: false,
    },
    trigger: {
      triggerId: 'inv_trg_world_event_intrusion' as ChatInvasionTriggerId,
      kind: 'WORLD_EVENT',
      description: 'Triggered directly by a liveops or world event directive.',
      requiresWorldEventCode: 'WORLD_EVENT_INTRUSION',
    },
    targetStrategy: 'ROOM_WIDE',
    entryStyle: 'WORLD_EVENT_SIREN',
    exitStyle: 'SYSTEM_CONFIRM',
    escalationBand: 'MEDIUM',
    basePriority: 'IMMEDIATE',
    importance: 'LEGENDARY',
    audiencePlan: {
      effect: 'HEAT_UP',
      intensity: 74 as Score100,
      affectedChannels: ['GLOBAL', 'LIVEOPS_SHADOW'],
      crowdLineBudget: 2,
      allowSwarmResponses: true,
      allowSilenceDrop: false,
    },
    cooldown: {
      cooldownId: 'inv_cd_world_event_intrusion' as ChatInvasionCooldownId,
      templateId: 'inv_tpl_world_event_intrusion' as ChatInvasionTemplateId,
      scope: 'WORLD',
      durationMs: 10000,
      extendsOnEscalation: false,
      extendsOnFailure: false,
      suppressesLowerPriorityTemplates: true,
    },
    scenePlan: {
      sceneId: 'inv_scene_world_event_intrusion' as ChatInvasionSceneId,
      title: 'The World Cuts In',
      subtitle: 'A global directive changes the room.',
      entryStyle: 'WORLD_EVENT_SIREN',
      exitStyle: 'SYSTEM_CONFIRM',
      class: 'CEREMONIAL',
      theaterMode: 'ROOM_PUBLIC',
      helperCanHijack: false,
      haterCanEscalateMidScene: false,
      canResolveIntoLegendMoment: true,
      beats: [
        {
          beatId: 'inv_beat_wei_01' as ChatInvasionBeatId,
          ordinal: 1,
          stage: 'VISIBLE_OPEN',
          theaterMode: 'ROOM_PUBLIC',
          importance: 'LEGENDARY',
          lines: [
            {
              role: 'WORLD_EVENT',
              actorKind: 'SYSTEM',
              channelId: 'GLOBAL',
              body: 'World event active. All rooms now inherit a higher threat floor.',
              toneBand: 'CEREMONIAL',
              originSurface: 'LIVEOPS_DIRECTOR',
              notificationKind: 'WORLD_EVENT',
            },
          ],
        },
      ],
    },
    failurePolicy: {
      allowShadowRecordOnFailure: true,
      shadowRecordReason: 'Retain world event state in shadow even if room render is blocked.',
      emitSystemNoticeOnFailure: false,
      failReason: 'NO_ELIGIBLE_TARGET',
    },
    resolutionPolicy: {
      resolutionKinds: ['TIMEOUT_EXPIRED', 'LIVEOPS_CANCELLED'],
      canAwardLegendAnchor: true,
      canGrantReplayPin: true,
      canTriggerPostRunCallback: false,
      createWorldEventCallbackIfWorldEventBound: true,
    },
    defaultCounterplayKinds: ['NONE'],
    worldEventHook: 'WORLD_EVENT_INTRUSION',
    helperBias: 0.0 as Score01,
    haterBias: 0.35 as Score01,
  },
  {
    templateId: 'inv_tpl_rivalry_callback' as ChatInvasionTemplateId,
    code: 'RIVALRY_CALLBACK_QUOTE',
    displayName: 'Rivalry Callback',
    summary:
      'Memory-backed invasion that quotes the player or recalls a prior turning point.',
    kind: 'RIVALRY_CALLBACK',
    class: 'MIXED',
    admission: {
      allowedModeScopes: ['RUN', 'BATTLE', 'SYNDICATE', 'POST_RUN'],
      allowedChannels: ['GLOBAL', 'SYNDICATE', 'RIVALRY_SHADOW'],
      visibleChannels: ['GLOBAL', 'SYNDICATE'],
      shadowChannels: ['RIVALRY_SHADOW'],
      requiresBackendAuthority: true,
      queuePolicy: 'MERGE_SAME_TARGET',
      maximumConcurrentPerRoom: 1,
      maximumConcurrentPerTarget: 1,
      minimumSilenceWindowMs: 900,
      disallowWhileLegendMomentVisible: false,
      disallowDuringHelperBlackout: false,
    },
    trigger: {
      triggerId: 'inv_trg_rivalry_callback' as ChatInvasionTriggerId,
      kind: 'LEGEND_CALLBACK',
      description:
        'Memory anchor or quote recall triggers a rivalry callback scene.',
      requiresRelationshipAnchor: true,
      requiresQuoteRecall: true,
    },
    targetStrategy: 'PRIMARY_PLAYER',
    entryStyle: 'QUOTE_CALLBACK',
    exitStyle: 'FADE',
    escalationBand: 'MEDIUM',
    basePriority: 'NORMAL',
    importance: 'MAJOR',
    audiencePlan: {
      effect: 'AWE',
      intensity: 46 as Score100,
      affectedChannels: ['GLOBAL', 'RIVALRY_SHADOW'],
      crowdLineBudget: 1,
      allowSwarmResponses: false,
      allowSilenceDrop: true,
    },
    cooldown: {
      cooldownId: 'inv_cd_rivalry_callback' as ChatInvasionCooldownId,
      templateId: 'inv_tpl_rivalry_callback' as ChatInvasionTemplateId,
      scope: 'PLAYER',
      durationMs: 120000,
      extendsOnEscalation: false,
      extendsOnFailure: false,
      suppressesLowerPriorityTemplates: false,
    },
    scenePlan: {
      sceneId: 'inv_scene_rivalry_callback' as ChatInvasionSceneId,
      title: 'Memory Comes Back Armed',
      entryStyle: 'QUOTE_CALLBACK',
      exitStyle: 'FADE',
      class: 'MIXED',
      theaterMode: 'MIXED',
      helperCanHijack: false,
      haterCanEscalateMidScene: true,
      canResolveIntoLegendMoment: true,
      beats: [
        {
          beatId: 'inv_beat_rc_01' as ChatInvasionBeatId,
          ordinal: 1,
          stage: 'VISIBLE_OPEN',
          theaterMode: 'MIXED',
          importance: 'MAJOR',
          lines: [
            {
              role: 'HATER',
              npcId: 'npc_hater_morrow' as ChatNpcId,
              actorKind: 'NPC',
              channelId: 'GLOBAL',
              body: 'Last time you reached this point, you hesitated and the floor vanished under you.',
              toneBand: 'HOSTILE',
              originSurface: 'INVASION_DIRECTOR',
            },
          ],
        },
      ],
    },
    failurePolicy: {
      allowShadowRecordOnFailure: true,
      shadowRecordReason: 'Keep rivalry callback seed for future retrieval.',
      emitSystemNoticeOnFailure: false,
      failReason: 'NO_ELIGIBLE_TARGET',
    },
    resolutionPolicy: {
      resolutionKinds: ['PLAYER_COUNTERED', 'HATER_WON', 'TIMEOUT_EXPIRED'],
      canAwardLegendAnchor: true,
      canGrantReplayPin: true,
      canTriggerPostRunCallback: true,
      createWorldEventCallbackIfWorldEventBound: false,
    },
    defaultCounterplayKinds: ['FAST_REPLY', 'SILENCE_HOLD'],
    helperBias: 0.25 as Score01,
    haterBias: 0.74 as Score01,
  },
] as const;

export type ChatInvasionTemplateCode =
  (typeof CHAT_INVASION_TEMPLATES)[number]['code'];

// ============================================================================
// MARK: Defaults and derived helpers
// ============================================================================

export const CHAT_INVASION_DESCRIPTOR_NAMESPACE = Object.freeze({
  version: CHAT_CONTRACT_VERSION,
  authorities: CHAT_CONTRACT_AUTHORITIES,
  templateCount: CHAT_INVASION_TEMPLATES.length,
  kinds: CHAT_INVASION_KINDS,
  stages: CHAT_INVASION_STAGES,
  visibilityModes: CHAT_INVASION_VISIBILITY_MODES,
  entryStyles: CHAT_INVASION_ENTRY_STYLES,
  exitStyles: CHAT_INVASION_EXIT_STYLES,
} as const);

export function isChatInvasionKind(value: unknown): value is ChatInvasionKind {
  return typeof value === 'string' &&
    (CHAT_INVASION_KINDS as readonly string[]).includes(value);
}

export function isChatInvasionClass(value: unknown): value is ChatInvasionClass {
  return typeof value === 'string' &&
    (CHAT_INVASION_CLASSES as readonly string[]).includes(value);
}

export function isChatInvasionStage(value: unknown): value is ChatInvasionStage {
  return typeof value === 'string' &&
    (CHAT_INVASION_STAGES as readonly string[]).includes(value);
}

export function isChatInvasionTriggerKind(
  value: unknown,
): value is ChatInvasionTriggerKind {
  return typeof value === 'string' &&
    (CHAT_INVASION_TRIGGER_KINDS as readonly string[]).includes(value);
}

export function isChatInvasionVisibilityMode(
  value: unknown,
): value is ChatInvasionVisibilityMode {
  return typeof value === 'string' &&
    (CHAT_INVASION_VISIBILITY_MODES as readonly string[]).includes(value);
}

export function isChatInvasionTargetStrategy(
  value: unknown,
): value is ChatInvasionTargetStrategy {
  return typeof value === 'string' &&
    (CHAT_INVASION_TARGET_STRATEGIES as readonly string[]).includes(value);
}

export function isChatInvasionEscalationBand(
  value: unknown,
): value is ChatInvasionEscalationBand {
  return typeof value === 'string' &&
    (CHAT_INVASION_ESCALATION_BANDS as readonly string[]).includes(value);
}

export function isChatInvasionEntryStyle(
  value: unknown,
): value is ChatInvasionEntryStyle {
  return typeof value === 'string' &&
    (CHAT_INVASION_ENTRY_STYLES as readonly string[]).includes(value);
}

export function isChatInvasionExitStyle(
  value: unknown,
): value is ChatInvasionExitStyle {
  return typeof value === 'string' &&
    (CHAT_INVASION_EXIT_STYLES as readonly string[]).includes(value);
}

export function isChatInvasionResolutionKind(
  value: unknown,
): value is ChatInvasionResolutionKind {
  return typeof value === 'string' &&
    (CHAT_INVASION_RESOLUTION_KINDS as readonly string[]).includes(value);
}

export function isChatInvasionCounterplayKind(
  value: unknown,
): value is ChatInvasionCounterplayKind {
  return typeof value === 'string' &&
    (CHAT_INVASION_COUNTERPLAY_KINDS as readonly string[]).includes(value);
}

export function getChatInvasionTemplate(
  code: ChatInvasionTemplateCode | string,
): Optional<ChatInvasionTemplate> {
  return CHAT_INVASION_TEMPLATES.find((template) => template.code === code);
}

export function getChatInvasionTemplatesForKind(
  kind: ChatInvasionKind,
): readonly ChatInvasionTemplate[] {
  return CHAT_INVASION_TEMPLATES.filter((template) => template.kind === kind);
}

export function getChatInvasionTemplatesForChannel(
  channelId: ChatChannelId,
): readonly ChatInvasionTemplate[] {
  return CHAT_INVASION_TEMPLATES.filter((template) =>
    template.admission.allowedChannels.includes(channelId),
  );
}

export function getChatInvasionTemplatesForModeScope(
  modeScope: ChatModeScope,
): readonly ChatInvasionTemplate[] {
  return CHAT_INVASION_TEMPLATES.filter((template) =>
    template.admission.allowedModeScopes.includes(modeScope),
  );
}

export function deriveChatInvasionBannerSnapshot(
  state: ChatInvasionRuntimeState,
  template: ChatInvasionTemplate,
): ChatInvasionBannerSnapshot {
  return {
    bannerId: (`banner:${state.invasionId}`) as ChatInvasionBannerId,
    invasionId: state.invasionId,
    title: template.scenePlan.title,
    subtitle: template.scenePlan.subtitle,
    class: state.class,
    stage: state.stage,
    importance: template.importance,
    channelId: state.channelId,
    visible: state.stage !== 'SUPPRESSED' && state.stage !== 'FAILED',
    canCollapse: template.importance !== 'LEGENDARY',
    showThreatMeter:
      template.class === 'HOSTILE' || template.class === 'PREDATORY',
  };
}

export function toLegacyChatInvasionBanner(
  snapshot: ChatInvasionBannerSnapshot,
): LegacyCompatibleChatInvasionBanner {
  return {
    title: snapshot.title,
    subtitle: snapshot.subtitle,
    visible: snapshot.visible,
    threatLevel:
      snapshot.importance === 'LEGENDARY'
        ? 100
        : snapshot.importance === 'CRITICAL'
          ? 85
          : snapshot.importance === 'MAJOR'
            ? 65
            : snapshot.importance === 'NOTICEABLE'
              ? 40
              : 15,
    channel: snapshot.channelId,
  };
}

export function collectInvasionChannels(
  template: ChatInvasionTemplate,
): readonly ChatChannelId[] {
  return Array.from(
    new Set([
      ...template.admission.allowedChannels,
      ...template.admission.visibleChannels,
      ...template.admission.shadowChannels,
      ...template.audiencePlan.affectedChannels,
    ]),
  ) as readonly ChatChannelId[];
}

export function canInvasionWriteShadow(
  template: ChatInvasionTemplate,
): boolean {
  return template.admission.shadowChannels.length > 0;
}

export function invasionUsesVisibleOpen(
  template: ChatInvasionTemplate,
): boolean {
  return (
    template.scenePlan.beats.some((beat) => beat.stage === 'VISIBLE_OPEN') ||
    template.entryStyle === 'INSTANT_BANNER' ||
    template.entryStyle === 'SYSTEM_FLASH' ||
    template.entryStyle === 'WORLD_EVENT_SIREN'
  );
}

export function invasionUsesShadowOpening(
  template: ChatInvasionTemplate,
): boolean {
  return (
    template.scenePlan.beats.some((beat) => beat.stage === 'SHADOW_OPEN') ||
    template.entryStyle === 'SHADOW_LURK' ||
    template.entryStyle === 'HELPER_WHISPER' ||
    template.entryStyle === 'NPC_TYPING_FAKEOUT'
  );
}

export function getInvasionAdmissionChannels(
  template: ChatInvasionTemplate,
): readonly ChatChannelDescriptor[] {
  return template.admission.allowedChannels
    .map((channelId) => CHAT_CHANNEL_DESCRIPTORS[channelId])
    .filter(Boolean);
}

export function buildDefaultInvasionRuntimeState(
  template: ChatInvasionTemplate,
  roomId: ChatRoomId,
  channelId: ChatChannelId,
  target: ChatInvasionRuntimeTarget,
  now: UnixMs,
): ChatInvasionRuntimeState {
  return {
    invasionId: (`inv:${template.code}:${String(now)}`) as ChatInvasionId,
    templateId: template.templateId,
    roomId,
    channelId,
    target,
    class: template.class,
    kind: template.kind,
    stage: 'QUEUED',
    helperIntercepted: false,
    escalationBand: template.escalationBand,
    updatedAt: now,
  };
}

export function createInvasionQueueEntry(
  state: ChatInvasionRuntimeState,
  template: ChatInvasionTemplate,
  queuedAt: UnixMs,
  score: Score100,
): ChatInvasionQueueEntry {
  return {
    queueEntryId: (`inv_q:${state.invasionId}`) as ChatInvasionQueueEntryId,
    invasionId: state.invasionId,
    templateId: template.templateId,
    roomId: state.roomId,
    targetId: state.target.targetId,
    queuedAt,
    priority: template.basePriority,
    score,
    policy: template.admission.queuePolicy,
  };
}

export function deriveInvasionEscalationScore(
  template: ChatInvasionTemplate,
  featureSnapshot?: ChatFeatureSnapshot,
  affectSnapshot?: ChatAffectSnapshot,
): Score100 {
  let score =
    template.escalationBand === 'CRITICAL'
      ? 90
      : template.escalationBand === 'HIGH'
        ? 75
        : template.escalationBand === 'MEDIUM'
          ? 55
          : template.escalationBand === 'LOW'
            ? 30
            : 10;

  if (featureSnapshot?.pressureTier === 'CRITICAL') score += 8;
  if (featureSnapshot?.pressureTier === 'BREAKPOINT') score += 12;
  if (featureSnapshot?.silenceWindowMs && featureSnapshot.silenceWindowMs > 8000)
    score += 5;
  if (affectSnapshot?.vector.embarrassment) score += affectSnapshot.vector.embarrassment / 25;
  if (affectSnapshot?.vector.desperation) score += affectSnapshot.vector.desperation / 30;

  return Math.max(0, Math.min(100, Math.round(score))) as Score100;
}

export function deriveInvasionOutcomeStage(
  outcome: ChatInvasionOutcome,
): Extract<ChatInvasionStage, 'RESOLVED' | 'SUPPRESSED' | 'FAILED' | 'ARCHIVED'> {
  return outcome.stage;
}

export function createInvasionProofEdge(
  invasionId: ChatInvasionId,
  reason: string,
  createdAt: UnixMs,
  sourceMessageId?: ChatMessageId,
  targetMessageId?: ChatMessageId,
  proofHash?: ChatProofHash,
): ChatInvasionProofEdge {
  return {
    proofEdgeId: (`inv_pf:${String(createdAt)}:${reason}`) as ChatInvasionProofEdgeId,
    invasionId,
    sourceMessageId,
    targetMessageId,
    proofHash,
    reason,
    createdAt,
  };
}

export function createInvasionReplayAnchor(
  invasionId: ChatInvasionId,
  createdAt: UnixMs,
  pinnedMessageIds: readonly ChatMessageId[],
  replayId?: ChatReplayId,
  range?: ChatRange,
): ChatInvasionReplayAnchor {
  return {
    replayAnchorId: (`inv_rp:${String(createdAt)}`) as ChatInvasionReplayAnchorId,
    invasionId,
    replayId,
    range,
    pinnedMessageIds,
    createdAt,
  };
}

export function invasionSupportsHelperInterception(
  template: ChatInvasionTemplate,
): boolean {
  return template.scenePlan.helperCanHijack || template.defaultCounterplayKinds.includes('HELPER_ACCEPT');
}

export function invasionSupportsLegendResolution(
  template: ChatInvasionTemplate,
): boolean {
  return template.scenePlan.canResolveIntoLegendMoment && template.resolutionPolicy.canAwardLegendAnchor;
}

export interface ChatInvasionValidationIssue {
  readonly code:
    | 'template_code_missing'
    | 'scene_beats_empty'
    | 'channels_empty'
    | 'visible_channels_not_subset'
    | 'cooldown_invalid'
    | 'counterplay_orphaned'
    | 'resolution_empty';
  readonly message: string;
  readonly templateId?: ChatInvasionTemplateId;
}

export interface ChatInvasionValidationResult {
  readonly ok: boolean;
  readonly issues: readonly ChatInvasionValidationIssue[];
}

export function validateInvasionTemplate(
  template: ChatInvasionTemplate,
): ChatInvasionValidationResult {
  const issues: ChatInvasionValidationIssue[] = [];

  if (!template.code.trim()) {
    issues.push({
      code: 'template_code_missing',
      message: 'Invasion template code must not be empty.',
      templateId: template.templateId,
    });
  }

  if (template.scenePlan.beats.length === 0) {
    issues.push({
      code: 'scene_beats_empty',
      message: 'Invasion scene plan must include at least one beat.',
      templateId: template.templateId,
    });
  }

  if (template.admission.allowedChannels.length === 0) {
    issues.push({
      code: 'channels_empty',
      message: 'Invasion admission policy must expose at least one channel.',
      templateId: template.templateId,
    });
  }

  if (
    template.admission.visibleChannels.some(
      (channelId) => !template.admission.allowedChannels.includes(channelId),
    )
  ) {
    issues.push({
      code: 'visible_channels_not_subset',
      message: 'Visible invasion channels must be a subset of allowed channels.',
      templateId: template.templateId,
    });
  }

  if (template.cooldown.durationMs < 0) {
    issues.push({
      code: 'cooldown_invalid',
      message: 'Invasion cooldown duration must be non-negative.',
      templateId: template.templateId,
    });
  }

  for (const beat of template.scenePlan.beats) {
    if (
      beat.counterplayWindow &&
      beat.counterplayWindow.opensAtBeatId !== beat.beatId
    ) {
      issues.push({
        code: 'counterplay_orphaned',
        message: 'Counterplay window must open on its owning beat.',
        templateId: template.templateId,
      });
      break;
    }
  }

  if (template.resolutionPolicy.resolutionKinds.length === 0) {
    issues.push({
      code: 'resolution_empty',
      message: 'Invasion resolution policy must declare at least one outcome.',
      templateId: template.templateId,
    });
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}

export function validateAllInvasionTemplates(): ChatInvasionValidationResult {
  const issues = CHAT_INVASION_TEMPLATES.flatMap((template) =>
    validateInvasionTemplate(template).issues,
  );

  return {
    ok: issues.length === 0,
    issues,
  };
}

export const CHAT_INVASION_CONTRACT_DESCRIPTOR = Object.freeze({
  namespace: 'shared/contracts/chat/ChatInvasion',
  version: CHAT_CONTRACT_VERSION,
  authorities: CHAT_CONTRACT_AUTHORITIES,
  kinds: CHAT_INVASION_KINDS,
  stages: CHAT_INVASION_STAGES,
  classes: CHAT_INVASION_CLASSES,
  triggers: CHAT_INVASION_TRIGGER_KINDS,
  visibilityModes: CHAT_INVASION_VISIBILITY_MODES,
  targetStrategies: CHAT_INVASION_TARGET_STRATEGIES,
  escalationBands: CHAT_INVASION_ESCALATION_BANDS,
  entryStyles: CHAT_INVASION_ENTRY_STYLES,
  exitStyles: CHAT_INVASION_EXIT_STYLES,
  resolutions: CHAT_INVASION_RESOLUTION_KINDS,
  failureReasons: CHAT_INVASION_FAILURE_REASONS,
  counterplayKinds: CHAT_INVASION_COUNTERPLAY_KINDS,
  suppressionReasons: CHAT_INVASION_SUPPRESSION_REASONS,
  beatRoles: CHAT_INVASION_BEAT_ROLES,
  theaterModes: CHAT_INVASION_THEATER_MODES,
  importanceBands: CHAT_INVASION_IMPORTANCE_BANDS,
  queuePolicies: CHAT_INVASION_QUEUE_POLICIES,
  templates: CHAT_INVASION_TEMPLATES.map((template) => ({
    templateId: template.templateId,
    code: template.code,
    kind: template.kind,
    class: template.class,
    channelCount: template.admission.allowedChannels.length,
    beatCount: template.scenePlan.beats.length,
  })),
} as const);
