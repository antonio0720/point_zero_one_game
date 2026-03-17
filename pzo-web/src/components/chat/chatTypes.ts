/**
 * ============================================================================
 * POINT ZERO ONE — COMPONENT CHAT TYPES COMPATIBILITY SHIM
 * FILE: pzo-web/src/components/chat/chatTypes.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Migration-safe compatibility surface for legacy component-lane chat imports.
 *
 * This file exists because the repo historically allowed the component lane to
 * own chat-facing contracts, while the newer architecture moves canonical truth
 * into:
 * - shared/contracts/chat
 * - shared/contracts/chat/learning
 * - pzo-web/src/engines/chat
 *
 * That means this file must now do a different job:
 * - preserve old import paths
 * - preserve old type names that runtime mounts still expect
 * - re-anchor those shapes on shared contracts wherever possible
 * - add explicit adapters for legacy-only view models
 * - stop the component lane from redefining engine truth
 *
 * What this file must not do
 * --------------------------
 * - it must not become the canonical contract source
 * - it must not import battle, pressure, shield, cascade, zero, or run engine
 *   types directly
 * - it must not redefine transport truth already present in shared/contracts
 * - it must not own policy, replay, moderation, or learning law
 *
 * What this file must do well
 * ---------------------------
 * - keep compile compatibility for current component callers
 * - preserve legacy names like ChatMessage, GameChatContext, and
 *   SabotageEvent
 * - expose strong adapters so old callers can consume new shared truth
 * - give future files a stable place to read migration-safe aliases until all
 *   imports are moved to shared/contracts/chat and uiTypes.ts
 * ============================================================================
 */

import * as SharedChat from '../../../../shared/contracts/chat';
import * as SharedLearning from '../../../../shared/contracts/chat/learning';
import * as ChatEnginePublic from '../../engines/chat';
import * as UiTypes from './uiTypes';

// ============================================================================
// MARK: Stable namespace re-exports
// ============================================================================

export { SharedChat, SharedLearning, ChatEnginePublic, UiTypes };

// ============================================================================
// MARK: Foundational compatibility constants
// ============================================================================

export const CHAT_TYPES_FILE_PATH =
  'pzo-web/src/components/chat/chatTypes.ts' as const;

export const CHAT_TYPES_NAMESPACE =
  'pzo-web/src/components/chat/chatTypes' as const;

export const CHAT_TYPES_VERSION = '2026.03.17' as const;

export const CHAT_TYPES_REVISION =
  'pzo.components.chat.types.compat.v2' as const;

export const LEGACY_CHAT_CHANNELS = [
  'GLOBAL',
  'SYNDICATE',
  'DEAL_ROOM',
] as const satisfies readonly SharedChat.ChatChannels.ChatVisibleChannel[];

export const UNIFIED_VISIBLE_CHAT_CHANNELS =
  SharedChat.ChatChannels.CHAT_VISIBLE_CHANNELS;

export const ALL_KNOWN_CHAT_CHANNELS =
  SharedChat.ChatChannels.CHAT_ALL_CHANNELS;

export const CHAT_CHANNEL_LABELS = Object.freeze({
  GLOBAL: 'Global',
  SYNDICATE: 'Syndicate',
  DEAL_ROOM: 'Deal Room',
  LOBBY: 'Lobby',
  SYSTEM_SHADOW: 'System Shadow',
  NPC_SHADOW: 'NPC Shadow',
  RIVALRY_SHADOW: 'Rivalry Shadow',
  RESCUE_SHADOW: 'Rescue Shadow',
  LIVEOPS_SHADOW: 'LiveOps Shadow',
} as const satisfies Record<SharedChat.ChatChannels.ChatChannelId, string>);

export const CHAT_CHANNEL_DESCRIPTIONS = Object.freeze({
  GLOBAL:
    'Public theatrical lane where crowd heat, hype, ridicule, and visible system moments surface first.',
  SYNDICATE:
    'Trust-weighted tactical lane for partners, alliance pressure, helper intervention, and conspiratorial coordination.',
  DEAL_ROOM:
    'Predatory negotiation lane for deals, offers, bluffing, pressure moves, and controlled information asymmetry.',
  LOBBY:
    'Pre-run social lane for staging, onboarding, ambient chatter, and low-commitment opening conversation.',
  SYSTEM_SHADOW:
    'Invisible system-only shadow lane for staging, reveal scheduling, fanout control, and hidden authorial bookkeeping.',
  NPC_SHADOW:
    'Invisible NPC staging lane for ambient setup, helper queues, hater timing, and delayed reveal preparation.',
  RIVALRY_SHADOW:
    'Invisible rivalry memory lane for taunt callbacks, escalation anchors, and pressure carryover.',
  RESCUE_SHADOW:
    'Invisible rescue lane for churn interception, helper readiness, and soft-response planning.',
  LIVEOPS_SHADOW:
    'Invisible world-event lane for scheduled pressure, seasonal overlays, and global reveal choreography.',
} as const satisfies Record<SharedChat.ChatChannels.ChatChannelId, string>);

export const LEGACY_MESSAGE_KINDS = [
  'PLAYER',
  'SYSTEM',
  'MARKET_ALERT',
  'ACHIEVEMENT',
  'BOT_TAUNT',
  'BOT_ATTACK',
  'SHIELD_EVENT',
  'CASCADE_ALERT',
  'DEAL_RECAP',
] as const;

export const EXTENDED_MESSAGE_KINDS = [
  ...LEGACY_MESSAGE_KINDS,
  'HELPER_PROMPT',
  'INVASION_BANNER',
  'LEGEND_MOMENT',
  'NEGOTIATION_SIGNAL',
  'RESCUE_SIGNAL',
  'WORLD_EVENT',
] as const;

export const LEGACY_SABOTAGE_CARD_TYPES = [
  'EMERGENCY_EXPENSE',
  'INCOME_SEIZURE',
  'DEBT_SPIRAL',
  'INSPECTION_NOTICE',
  'MARKET_CORRECTION',
  'TAX_AUDIT',
  'LAYOFF_EVENT',
  'RENT_HIKE',
  'CREDIT_DOWNGRADE',
  'SYSTEM_GLITCH',
] as const;

export const CHAT_HELPER_PROMPT_TONES = [
  'calm',
  'blunt',
  'urgent',
  'strategic',
] as const;

export const CHAT_THREAT_BANDS = [
  'QUIET',
  'LOW',
  'ELEVATED',
  'HIGH',
  'SEVERE',
] as const;

export const CHAT_CONNECTION_STATES = [
  'DISCONNECTED',
  'CONNECTING',
  'CONNECTED',
  'DEGRADED',
  'RESUMING',
] as const;

export const CHAT_COMPATIBILITY_LEVELS = [
  'LEGACY_ONLY',
  'SHARED_BACKED',
  'ENGINE_BACKED',
  'UI_ONLY',
] as const;

// ============================================================================
// MARK: Foundational aliases
// ============================================================================

export type ChatChannel = (typeof LEGACY_CHAT_CHANNELS)[number];

export type UnifiedVisibleChatChannel = SharedChat.ChatChannels.ChatVisibleChannel;

export type AnyChatChannelId = SharedChat.ChatChannels.ChatChannelId;

export type ChatShadowChannel = SharedChat.ChatChannels.ChatShadowChannel;

export type MessageKind = (typeof LEGACY_MESSAGE_KINDS)[number];

export type ExtendedMessageKind = (typeof EXTENDED_MESSAGE_KINDS)[number];

export type SabotageCardType = (typeof LEGACY_SABOTAGE_CARD_TYPES)[number];

export type ChatHelperPromptTone = (typeof CHAT_HELPER_PROMPT_TONES)[number];

export type ChatThreatBand = (typeof CHAT_THREAT_BANDS)[number];

export type ChatConnectionState = (typeof CHAT_CONNECTION_STATES)[number];

export type ChatCompatibilityLevel =
  (typeof CHAT_COMPATIBILITY_LEVELS)[number];

export type PressureTier = SharedChat.ChatEvents.ChatPressureTier;

export type TickTier = SharedChat.ChatEvents.ChatTickTier;

export type RunOutcome = SharedChat.ChatEvents.ChatRunOutcome;

export type AttackType = SharedChat.ChatEvents.ChatAttackType;

export type CascadeSeverity = SharedChat.ChatEvents.ChatCascadeSeverity;

export type ShieldLayerId = SharedChat.ChatEvents.ChatShieldLayerId;

export type BotTauntSource = SharedChat.ChatEvents.BotTauntSource;

export type ShieldEventMeta = SharedChat.ChatEvents.ShieldEventMeta;

export type CascadeAlertMeta = SharedChat.ChatEvents.CascadeAlertMeta;

export type ChatSenderWire = SharedChat.ChatEvents.ChatSenderWire;

export type ChatSenderIdentity = SharedChat.ChatEvents.ChatSenderIdentity;

export type ChatSenderRole = SharedChat.ChatEvents.ChatSenderRole;

export type ChatMessageMeta = SharedChat.ChatEvents.ChatMessageMeta;

export type ChatProofMeta = SharedChat.ChatEvents.ChatProofMeta;

export type ChatLegendMeta = SharedChat.ChatEvents.ChatLegendMeta;

export type ChatReplayMeta = SharedChat.ChatEvents.ChatReplayMeta;

export type ChatAuditMeta = SharedChat.ChatEvents.ChatAuditMeta;

export type ChatModerationDecision =
  SharedChat.ChatEvents.ChatModerationDecision;

export type ChatDeliveryState = SharedChat.ChatEvents.ChatDeliveryState;

export type ChatModerationState = SharedChat.ChatEvents.ChatModerationState;

export type ChatPresenceState = SharedChat.ChatEvents.ChatPresenceState;

export type ChatTypingState = SharedChat.ChatEvents.ChatTypingState;

export type ChatPresenceSnapshot = SharedChat.ChatEvents.ChatPresenceSnapshot;

export type ChatTypingSnapshot = SharedChat.ChatEvents.ChatTypingSnapshot;

export type ChatCursorSnapshot = SharedChat.ChatEvents.ChatCursorSnapshot;

export type ChatReadReceipt = SharedChat.ChatEvents.ChatReadReceipt;

export type ChatRelationshipState =
  SharedChat.ChatEvents.ChatRelationshipState;

export type ChatMemoryAnchor = SharedChat.ChatEvents.ChatMemoryAnchor;

export type ChatOfferState = SharedChat.ChatEvents.ChatOfferState;

export type ChatNegotiationState =
  SharedChat.ChatEvents.ChatNegotiationState;

export type ChatContinuityState =
  SharedChat.ChatEvents.ChatContinuityState;

export type ChatAudienceHeat = SharedChat.ChatEvents.ChatAudienceHeat;

export type ChatChannelMood = SharedChat.ChatEvents.ChatChannelMood;

export type ChatReputationState = SharedChat.ChatEvents.ChatReputationState;

export type ChatAffectSnapshot = SharedChat.ChatEvents.ChatAffectSnapshot;

export type ChatLearningProfile = SharedChat.ChatEvents.ChatLearningProfile;

export type ChatFeatureSnapshot = SharedChat.ChatEvents.ChatFeatureSnapshot;

export type ChatRescueDecision = SharedChat.ChatEvents.ChatRescueDecision;

export type ChatLiveOpsState = SharedChat.ChatEvents.ChatLiveOpsState;

export type ChatMomentType = SharedChat.ChatEvents.ChatMomentType;

export type ChatScenePlan = SharedChat.ChatEvents.ChatScenePlan;

export type ChatRevealSchedule = SharedChat.ChatEvents.ChatRevealSchedule;

export type ChatSilenceDecision =
  SharedChat.ChatEvents.ChatSilenceDecision;

export type ChatAuthoritativeFrame =
  SharedChat.ChatEvents.ChatAuthoritativeFrame;

export type ChatReplayWindowSnapshot =
  SharedChat.ChatEvents.ChatReplayWindowSnapshot;

export type ChatReplayExcerptWire =
  SharedChat.ChatEvents.ChatReplayExcerptWire;

// ============================================================================
// MARK: Legacy-compatible component message surface
// ============================================================================

export interface ChatMessageRenderMeta {
  readonly compactPreview?: string;
  readonly previewLineCount?: number;
  readonly groupKey?: string;
  readonly bucketKey?: string;
  readonly pinned?: boolean;
  readonly hidden?: boolean;
  readonly highlighted?: boolean;
  readonly queryMatched?: boolean;
  readonly searchScore?: number;
  readonly renderAccent?: string;
  readonly surfaceClass?: 'default' | 'system' | 'threat' | 'helper' | 'deal';
  readonly badgeText?: readonly string[];
}

export interface ChatMessageAnalyticsMeta {
  readonly localOrdinal?: number;
  readonly unreadAtArrival?: boolean;
  readonly viewCount?: number;
  readonly hoverCount?: number;
  readonly pinnedAt?: number;
  readonly firstRenderedAt?: number;
  readonly lastRenderedAt?: number;
}

export interface ChatMessageCompatibilityEnvelope {
  readonly compatibilityLevel: ChatCompatibilityLevel;
  readonly derivesFromSharedContracts: boolean;
  readonly derivesFromEnginePublicLane: boolean;
  readonly derivedFromFrameKind?: string;
  readonly authoritative?: boolean;
}

export interface ChatMessage {
  readonly id: string;
  readonly channel: ChatChannel;
  readonly kind: ExtendedMessageKind;
  readonly senderId: string;
  readonly senderName: string;
  readonly senderRank?: string;
  readonly senderRole?: ChatSenderRole | string;
  readonly senderIdentity?: ChatSenderIdentity;
  readonly body: string;
  readonly emoji?: string;
  readonly ts: number;
  readonly immutable?: boolean;
  readonly proofHash?: string;
  readonly deliveryState?: ChatDeliveryState;
  readonly moderationState?: ChatModerationState;
  readonly moderationDecision?: ChatModerationDecision;
  readonly proofMeta?: ChatProofMeta;
  readonly legendMeta?: ChatLegendMeta;
  readonly replayMeta?: ChatReplayMeta;
  readonly auditMeta?: ChatAuditMeta;
  readonly senderWire?: ChatSenderWire;
  readonly meta?: ChatMessageMeta;
  readonly metadata?: Record<string, unknown>;
  readonly botSource?: BotTauntSource;
  readonly shieldMeta?: ShieldEventMeta;
  readonly cascadeMeta?: CascadeAlertMeta;
  readonly pressureTier?: PressureTier;
  readonly tickTier?: TickTier;
  readonly runOutcome?: RunOutcome;
  readonly relationshipState?: ChatRelationshipState;
  readonly audienceHeat?: ChatAudienceHeat;
  readonly channelMood?: ChatChannelMood;
  readonly reputationState?: ChatReputationState;
  readonly affect?: ChatAffectSnapshot;
  readonly learningProfile?: ChatLearningProfile;
  readonly rescueDecision?: ChatRescueDecision;
  readonly negotiationState?: ChatNegotiationState;
  readonly liveOpsState?: ChatLiveOpsState;
  readonly momentType?: ChatMomentType;
  readonly scenePlan?: ChatScenePlan;
  readonly revealSchedule?: ChatRevealSchedule;
  readonly silenceDecision?: ChatSilenceDecision;
  readonly memoryAnchors?: readonly ChatMemoryAnchor[];
  readonly featureSnapshot?: ChatFeatureSnapshot;
  readonly render?: ChatMessageRenderMeta;
  readonly analytics?: ChatMessageAnalyticsMeta;
  readonly compatibility?: ChatMessageCompatibilityEnvelope;
}

export interface GameChatContextScoreSnapshot {
  readonly capitalScore?: number;
  readonly sovereignScore?: number;
  readonly pressureScore?: number;
  readonly threatScore?: number;
  readonly heatScore?: number;
}

export interface GameChatContextEconomySnapshot {
  readonly cash: number;
  readonly netWorth: number;
  readonly income: number;
  readonly expenses: number;
  readonly availableLiquidity?: number;
  readonly debtLoad?: number;
  readonly runwayMonths?: number;
}

export interface GameChatContextRunSnapshot {
  readonly tick: number;
  readonly tickTier?: TickTier;
  readonly pressureTier?: PressureTier;
  readonly runOutcome?: RunOutcome;
  readonly regime?: string;
  readonly haterHeat?: number;
  readonly shieldIntegrity01?: number;
  readonly currentMode?: string;
  readonly modeScope?: SharedChat.ChatChannels.ChatModeScope;
  readonly mountTarget?: SharedChat.ChatChannels.ChatMountTarget;
}

export interface GameChatContextEventsSnapshot {
  readonly events: string[];
  readonly recentSignals?: readonly string[];
  readonly recentSystemMessages?: readonly string[];
  readonly recentProofHashes?: readonly string[];
}

export interface GameChatContext {
  readonly tick: number;
  readonly cash: number;
  readonly regime: string;
  readonly events: string[];
  readonly netWorth: number;
  readonly income: number;
  readonly expenses: number;
  readonly pressureTier?: PressureTier;
  readonly tickTier?: TickTier;
  readonly haterHeat?: number;
  readonly runOutcome?: RunOutcome;
  readonly roomId?: string;
  readonly sessionId?: string;
  readonly playerId?: string;
  readonly playerName?: string;
  readonly modeScope?: SharedChat.ChatChannels.ChatModeScope;
  readonly mountTarget?: SharedChat.ChatChannels.ChatMountTarget;
  readonly activeChannel?: UnifiedVisibleChatChannel;
  readonly score?: GameChatContextScoreSnapshot;
  readonly economy?: GameChatContextEconomySnapshot;
  readonly run?: GameChatContextRunSnapshot;
  readonly eventSnapshot?: GameChatContextEventsSnapshot;
  readonly learningProfile?: ChatLearningProfile;
  readonly affect?: ChatAffectSnapshot;
  readonly continuity?: ChatContinuityState;
  readonly reputation?: ChatReputationState;
  readonly audienceHeat?: ChatAudienceHeat;
  readonly liveOpsState?: ChatLiveOpsState;
  readonly featureSnapshot?: ChatFeatureSnapshot;
  readonly connectionState?: ChatConnectionState;
}

export interface SabotageEvent {
  readonly haterId: string;
  readonly cardType: SabotageCardType;
  readonly intensity: number;
  readonly haterName: string;
  readonly botId?: string;
  readonly attackType?: AttackType;
  readonly targetLayer?: ShieldLayerId;
  readonly pressureTier?: PressureTier;
  readonly tickTier?: TickTier;
  readonly proofHash?: string;
  readonly ts?: number;
  readonly sourceChannel?: AnyChatChannelId;
  readonly sourceMessageId?: string;
  readonly recoveryHint?: string;
  readonly relationshipState?: ChatRelationshipState;
  readonly affect?: ChatAffectSnapshot;
}

export interface ChatUnreadByChannel {
  readonly GLOBAL: number;
  readonly SYNDICATE: number;
  readonly DEAL_ROOM: number;
  readonly LOBBY?: number;
}

export interface ChatChannelSummary {
  readonly channel: UnifiedVisibleChatChannel;
  readonly label: string;
  readonly description: string;
  readonly unread: number;
  readonly totalMessages: number;
  readonly lastMessageAt?: number;
  readonly lastSenderName?: string;
  readonly latestKind?: ExtendedMessageKind;
  readonly threatBand: ChatThreatBand;
  readonly helperNeeded: boolean;
}

export interface ChatThreatSnapshot {
  readonly score01: number;
  readonly score100: number;
  readonly band: ChatThreatBand;
  readonly attackCount: number;
  readonly tauntCount: number;
  readonly rescueNeeded: boolean;
  readonly activePressureTier?: PressureTier;
  readonly activeTickTier?: TickTier;
}

export interface ChatHelperPromptSnapshot {
  readonly visible: boolean;
  readonly tone: ChatHelperPromptTone;
  readonly title: string;
  readonly body: string;
  readonly ctaLabel: string;
}

export interface ChatTranscriptSearchResult {
  readonly query: string;
  readonly totalMatches: number;
  readonly channel: UnifiedVisibleChatChannel;
  readonly messageIds: readonly string[];
  readonly messages: readonly ChatMessage[];
}

export interface ChatTranscriptStateCompat {
  readonly open: boolean;
  readonly searchQuery: string;
  readonly selectedMessageId: string | null;
  readonly newestFirst: boolean;
}

export interface ChatComposerStateCompat {
  readonly activeDraft: string;
  readonly charCount: number;
  readonly maxChars: number;
  readonly canSend: boolean;
  readonly isNearLimit: boolean;
  readonly placeholder: string;
}

export interface ChatPresencePreviewCompat {
  readonly onlineCount: number;
  readonly activeMembers: number;
  readonly typingCount: number;
  readonly recentPeerNames: string[];
  readonly recentRanks: string[];
}

export interface ChatThreatSummaryCompat {
  readonly score: number;
  readonly tier: 'CALM' | 'WATCH' | 'HIGH' | 'CRITICAL';
  readonly label: string;
  readonly reasons: string[];
  readonly latestThreatMessageId: string | null;
}

export interface ChatHelperPromptCompat {
  readonly id?: string;
  readonly title: string;
  readonly body: string;
  readonly severity: 'INFO' | 'GUIDE' | 'WARNING' | 'CRITICAL';
  readonly sourceMessageId?: string;
  readonly ctaLabel?: string;
  readonly suggestedReply?: string;
}

export interface ChatMountStateCompat {
  readonly mountTarget: string;
  readonly modeScope: string;
  readonly storageNamespace?: string;
}

export interface UseChatEngineResult {
  readonly messages: readonly ChatMessage[];
  readonly allMessages?: readonly ChatMessage[];
  readonly visibleMessages?: readonly ChatMessage[];
  readonly recentMessages?: readonly ChatMessage[];
  readonly activeTab: ChatChannel;
  readonly activeChannel?: ChatChannel;
  readonly activeSummary?: ChatChannelSummary;
  readonly chatOpen: boolean;
  readonly collapsed?: boolean;
  readonly isPinned?: boolean;
  readonly connected: boolean;
  readonly connectionState?: ChatConnectionState;
  readonly unread: Partial<Record<UnifiedVisibleChatChannel | Lowercase<UnifiedVisibleChatChannel>, number>>;
  readonly totalUnread: number;
  readonly switchTab: (tab: ChatChannel) => void;
  readonly setActiveChannel?: (channel: ChatChannel) => void;
  readonly toggleChat: () => void;
  readonly openChat?: () => void;
  readonly closeChat?: () => void;
  readonly collapse?: () => void;
  readonly expand?: () => void;
  readonly sendMessage: (body: string) => void;
  readonly sendText?: (body: string) => void;
  readonly sendDraft?: () => void;
  readonly setDraft?: (body: string) => void;
  readonly appendDraft?: (suffix: string) => void;
  readonly clearDraft?: () => void;
  readonly quickReply?: (reply: string) => void;
  readonly clearUnread?: (channel?: ChatChannel) => void;
  readonly summaries?: readonly ChatChannelSummary[];
  readonly channels?: readonly ChatChannelSummary[];
  readonly threat?: ChatThreatSnapshot;
  readonly threatModel?: ChatThreatSnapshot;
  readonly threatSummary?: ChatThreatSummaryCompat;
  readonly helperPrompt?: ChatHelperPromptSnapshot | ChatHelperPromptCompat;
  readonly presence?: ChatPresencePreviewCompat;
  readonly transcript?: ChatTranscriptStateCompat;
  readonly composer?: ChatComposerStateCompat;
  readonly transcriptDrawerModel?: UiTypes.ChatUiTranscriptDrawerSurfaceModel;
  readonly transcriptDrawerCallbacks?: UiTypes.ChatUiTranscriptDrawerCallbacks;
  readonly presenceStripModel?: UiTypes.PresenceStripViewModel;
  readonly typingIndicatorModel?: UiTypes.TypingClusterViewModel;
  readonly channelTabs?: UiTypes.ChannelTabsViewModel;
  readonly messageFeedModel?: UiTypes.MessageFeedViewModel;
  readonly messageFeedActionsByMessageId?: Record<string, readonly UiTypes.MessageCardActionViewModel[]>;
  readonly shellMode?: 'DOCK' | 'DRAWER' | string;
  readonly transcriptLocked?: boolean;
  readonly emptyStateMode?:
    | 'IDLE'
    | 'DISCONNECTED'
    | 'FILTERED'
    | 'DEAL_WAITING'
    | 'THREAT'
    | 'COLLAPSED'
    | string;
  readonly latestMessage?: ChatMessage | null;
  readonly latestPlayerMessage?: ChatMessage | null;
  readonly latestSystemMessage?: ChatMessage | null;
  readonly latestThreatMessage?: ChatMessage | null;
  readonly diagnostics?: unknown;
  readonly mountState?: ChatMountStateCompat;
  readonly runtimeBundle?: unknown;
  readonly toggleTranscript?: () => void;
  readonly openTranscript?: () => void;
  readonly closeTranscript?: () => void;
  readonly setTranscriptSearchQuery?: (query: string) => void;
  readonly selectTranscriptMessage?: (messageId: string | null) => void;
  readonly jumpToLatest?: () => void;
}

export interface ChatPanelProps {
  readonly gameCtx: GameChatContext;
  readonly onSabotage?: (event: SabotageEvent) => void;
  readonly accessToken?: string | null;
}

// ============================================================================
// MARK: Module-aware compatibility constants
// ============================================================================

function readNamedExport(
  namespace: Record<string, unknown>,
  key: string,
): unknown {
  return Object.prototype.hasOwnProperty.call(namespace, key)
    ? namespace[key]
    : undefined;
}

const maybeEngineManifest = readNamedExport(
  ChatEnginePublic as unknown as Record<string, unknown>,
  'CHAT_ENGINE_PUBLIC_MANIFEST',
);

const maybeEngineRuntimeLaws = readNamedExport(
  ChatEnginePublic as unknown as Record<string, unknown>,
  'CHAT_ENGINE_RUNTIME_LAWS',
);

export const CHAT_TYPES_AUTHORITIES = Object.freeze({
  filePath: CHAT_TYPES_FILE_PATH,
  sharedContractsRoot: SharedChat.ChatChannels.CHAT_CHANNEL_CONTRACT?.authorities?.sharedContractsRoot
    ?? '/shared/contracts/chat',
  frontendEngineRoot: SharedChat.ChatChannels.CHAT_CHANNEL_CONTRACT?.authorities?.frontendEngineRoot
    ?? '/pzo-web/src/engines/chat',
  frontendUiRoot: '/pzo-web/src/components/chat',
  sharedLearningRoot: SharedChat.ChatChannels.CHAT_CHANNEL_CONTRACT?.authorities?.sharedLearningRoot
    ?? '/shared/contracts/chat/learning',
});

export const CHAT_TYPES_RUNTIME_LAWS = Object.freeze([
  'chatTypes.ts is a compatibility shim, not the canonical source of truth.',
  'Canonical channel and event law comes from shared/contracts/chat.',
  'Canonical frontend runtime law comes from pzo-web/src/engines/chat.',
  'Legacy names remain stable while authority moves out of the component lane.',
  'No battle, zero, pressure, shield, or cascade engine imports are allowed here.',
  'Compatibility aliases may mirror richer UI shell return shapes so existing docks keep compiling during migration.',
] as const);

export const CHAT_TYPES_MIGRATION_FLAGS = Object.freeze({
  isCanonicalTruthSource: false,
  isCompatibilityBridge: true,
  preservesLegacyImports: true,
  sharedContractsBacked: true,
  enginePublicAware: true,
  uiOnlyExtensionsAllowed: true,
  directEngineImportsAllowed: false,
  unifiedChatReturnAliasesPresent: true,
});

export const CHAT_TYPES_RUNTIME_BUNDLE = Object.freeze({
  version: CHAT_TYPES_VERSION,
  revision: CHAT_TYPES_REVISION,
  authorities: CHAT_TYPES_AUTHORITIES,
  laws: CHAT_TYPES_RUNTIME_LAWS,
  migration: CHAT_TYPES_MIGRATION_FLAGS,
  sharedSurface: readNamedExport(
    SharedChat as unknown as Record<string, unknown>,
    'CHAT_SHARED_CONTRACT_SURFACE',
  ),
  engineManifest: maybeEngineManifest,
  engineRuntimeLaws: maybeEngineRuntimeLaws,
  learningRuntimeBundle: readNamedExport(
    SharedLearning as unknown as Record<string, unknown>,
    'LEARNING_CONTRACT_RUNTIME_BUNDLE',
  ),
});

// ============================================================================
// MARK: Guards
// ============================================================================

export function isLegacyChatChannel(value: string): value is ChatChannel {
  return (LEGACY_CHAT_CHANNELS as readonly string[]).includes(value);
}

export function isUnifiedVisibleChatChannel(
  value: string,
): value is UnifiedVisibleChatChannel {
  return SharedChat.ChatChannels.isChatVisibleChannel(value);
}

export function isAnyChatChannelId(value: string): value is AnyChatChannelId {
  return SharedChat.ChatChannels.isChatChannelId(value);
}

export function isLegacyMessageKind(value: string): value is MessageKind {
  return (LEGACY_MESSAGE_KINDS as readonly string[]).includes(value);
}

export function isExtendedMessageKind(
  value: string,
): value is ExtendedMessageKind {
  return (EXTENDED_MESSAGE_KINDS as readonly string[]).includes(value);
}

export function isSabotageCardType(value: string): value is SabotageCardType {
  return (LEGACY_SABOTAGE_CARD_TYPES as readonly string[]).includes(value);
}

export function isChatConnectionState(
  value: string,
): value is ChatConnectionState {
  return (CHAT_CONNECTION_STATES as readonly string[]).includes(value);
}

// ============================================================================
// MARK: Core coercion helpers
// ============================================================================

export function normalizeChatChannel(
  value: string | ChatChannel | UnifiedVisibleChatChannel | AnyChatChannelId | null | undefined,
  fallback: ChatChannel = 'GLOBAL',
): ChatChannel {
  if (!value) return fallback;

  const normalized = String(value).trim().toUpperCase().replace(/[-\s]+/g, '_');

  if (isLegacyChatChannel(normalized)) {
    return normalized;
  }

  const legacyAlias = SharedChat.ChatChannels.normalizeLegacyChatChannel(normalized);
  if (legacyAlias && isLegacyChatChannel(legacyAlias)) {
    return legacyAlias;
  }

  if (normalized === 'LOBBY') {
    return fallback;
  }

  return fallback;
}

export function toUnifiedVisibleChatChannel(
  value: string | ChatChannel | UnifiedVisibleChatChannel | null | undefined,
  fallback: UnifiedVisibleChatChannel = 'GLOBAL',
): UnifiedVisibleChatChannel {
  if (!value) return fallback;

  const normalized = String(value).trim().toUpperCase().replace(/[-\s]+/g, '_');

  if (SharedChat.ChatChannels.isChatVisibleChannel(normalized)) {
    return normalized;
  }

  const legacyAlias = SharedChat.ChatChannels.normalizeLegacyChatChannel(normalized);
  if (legacyAlias && SharedChat.ChatChannels.isChatVisibleChannel(legacyAlias)) {
    return legacyAlias;
  }

  return fallback;
}

export function toPrimaryShadowChannel(
  value: string | ChatChannel | UnifiedVisibleChatChannel,
): ChatShadowChannel {
  return SharedChat.ChatChannels.visibleChannelToPrimaryShadow(
    toUnifiedVisibleChatChannel(value),
  );
}

export function getChatChannelLabel(
  channel: string | AnyChatChannelId,
): string {
  const normalized = SharedChat.ChatChannels.isChatChannelId(channel)
    ? channel
    : SharedChat.ChatChannels.normalizeLegacyChatChannel(String(channel).toUpperCase())
      ?? toUnifiedVisibleChatChannel(String(channel));

  return CHAT_CHANNEL_LABELS[normalized];
}

export function getChatChannelDescription(
  channel: string | AnyChatChannelId,
): string {
  const normalized = SharedChat.ChatChannels.isChatChannelId(channel)
    ? channel
    : SharedChat.ChatChannels.normalizeLegacyChatChannel(String(channel).toUpperCase())
      ?? toUnifiedVisibleChatChannel(String(channel));

  return CHAT_CHANNEL_DESCRIPTIONS[normalized];
}

export function coerceMessageKind(
  value: string | null | undefined,
  fallback: ExtendedMessageKind = 'PLAYER',
): ExtendedMessageKind {
  if (!value) return fallback;

  const normalized = String(value).trim().toUpperCase().replace(/[-\s]+/g, '_');

  if (isExtendedMessageKind(normalized)) {
    return normalized;
  }

  switch (normalized) {
    case 'TEXT':
    case 'CHAT_MESSAGE':
      return 'PLAYER';
    case 'SYSTEM_NOTICE':
      return 'SYSTEM';
    case 'HELPER':
    case 'HELPER_RESPONSE':
      return 'HELPER_PROMPT';
    case 'HATER':
    case 'TAUNT':
      return 'BOT_TAUNT';
    case 'ATTACK':
      return 'BOT_ATTACK';
    case 'LEGEND_NOTICE':
      return 'LEGEND_MOMENT';
    case 'LIVEOPS_NOTICE':
      return 'WORLD_EVENT';
    default:
      return fallback;
  }
}

export function ensureMessageId(
  value: string | null | undefined,
  fallbackSeed: number,
): string {
  const trimmed = value?.trim();
  if (trimmed) return trimmed;
  return `chat-msg-${fallbackSeed}`;
}

export function coerceMessageTimestamp(
  value: number | string | null | undefined,
  fallback: number,
): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

// ============================================================================
// MARK: Compatibility object builders
// ============================================================================

export function buildLegacyBotTauntSource(
  partial: Partial<BotTauntSource> | null | undefined,
): BotTauntSource | undefined {
  if (!partial?.botId || !partial.attackType) {
    return undefined;
  }

  return {
    botId: partial.botId,
    attackType: partial.attackType,
    personaId: partial.personaId,
    escalationTier: partial.escalationTier,
  };
}

export function buildShieldEventMeta(
  partial: Partial<ShieldEventMeta> | null | undefined,
): ShieldEventMeta | undefined {
  if (!partial?.layerId) {
    return undefined;
  }

  return {
    layerId: partial.layerId,
    integrityAfter: partial.integrityAfter,
    shieldDelta: partial.shieldDelta,
    shieldLabel: partial.shieldLabel,
  };
}

export function buildCascadeAlertMeta(
  partial: Partial<CascadeAlertMeta> | null | undefined,
): CascadeAlertMeta | undefined {
  if (!partial?.chainId || !partial?.severity) {
    return undefined;
  }

  return {
    chainId: partial.chainId,
    severity: partial.severity,
    recovered: partial.recovered,
  };
}

export function createEmptyGameChatContext(
  overrides: Partial<GameChatContext> = {},
): GameChatContext {
  const tick = overrides.tick ?? 0;
  const cash = overrides.cash ?? 0;
  const netWorth = overrides.netWorth ?? cash;
  const income = overrides.income ?? 0;
  const expenses = overrides.expenses ?? 0;
  const regime = overrides.regime ?? 'UNKNOWN';
  const events = [...(overrides.events ?? [])];

  return {
    tick,
    cash,
    regime,
    events,
    netWorth,
    income,
    expenses,
    pressureTier: overrides.pressureTier,
    tickTier: overrides.tickTier,
    haterHeat: overrides.haterHeat,
    runOutcome: overrides.runOutcome,
    roomId: overrides.roomId,
    sessionId: overrides.sessionId,
    playerId: overrides.playerId,
    playerName: overrides.playerName,
    modeScope: overrides.modeScope,
    mountTarget: overrides.mountTarget,
    activeChannel: overrides.activeChannel,
    score: overrides.score,
    economy: overrides.economy ?? {
      cash,
      netWorth,
      income,
      expenses,
    },
    run: overrides.run ?? {
      tick,
      tickTier: overrides.tickTier,
      pressureTier: overrides.pressureTier,
      runOutcome: overrides.runOutcome,
      regime,
      haterHeat: overrides.haterHeat,
      currentMode: undefined,
      modeScope: overrides.modeScope,
      mountTarget: overrides.mountTarget,
    },
    eventSnapshot: overrides.eventSnapshot ?? {
      events,
    },
    learningProfile: overrides.learningProfile,
    affect: overrides.affect,
    continuity: overrides.continuity,
    reputation: overrides.reputation,
    audienceHeat: overrides.audienceHeat,
    liveOpsState: overrides.liveOpsState,
    featureSnapshot: overrides.featureSnapshot,
    connectionState: overrides.connectionState ?? 'DISCONNECTED',
  };
}

export function normalizeGameChatContext(
  value: Partial<GameChatContext> | null | undefined,
): GameChatContext {
  return createEmptyGameChatContext(value ?? {});
}

export function createSabotageEvent(
  overrides: Partial<SabotageEvent> & {
    haterId: string;
    cardType: SabotageCardType;
    intensity: number;
    haterName: string;
  },
): SabotageEvent {
  return {
    haterId: overrides.haterId,
    cardType: overrides.cardType,
    intensity: overrides.intensity,
    haterName: overrides.haterName,
    botId: overrides.botId,
    attackType: overrides.attackType,
    targetLayer: overrides.targetLayer,
    pressureTier: overrides.pressureTier,
    tickTier: overrides.tickTier,
    proofHash: overrides.proofHash,
    ts: overrides.ts ?? Date.now(),
    sourceChannel: overrides.sourceChannel,
    sourceMessageId: overrides.sourceMessageId,
    recoveryHint: overrides.recoveryHint,
    relationshipState: overrides.relationshipState,
    affect: overrides.affect,
  };
}

export function normalizeSabotageEvent(
  value: Partial<SabotageEvent> | null | undefined,
): SabotageEvent | null {
  if (!value?.haterId || !value.haterName || !value.cardType) {
    return null;
  }

  return createSabotageEvent({
    haterId: value.haterId,
    haterName: value.haterName,
    cardType: isSabotageCardType(value.cardType)
      ? value.cardType
      : 'SYSTEM_GLITCH',
    intensity: typeof value.intensity === 'number' ? value.intensity : 0,
    botId: value.botId,
    attackType: value.attackType,
    targetLayer: value.targetLayer,
    pressureTier: value.pressureTier,
    tickTier: value.tickTier,
    proofHash: value.proofHash,
    ts: value.ts,
    sourceChannel: value.sourceChannel,
    sourceMessageId: value.sourceMessageId,
    recoveryHint: value.recoveryHint,
    relationshipState: value.relationshipState,
    affect: value.affect,
  });
}

export function coerceChatMessage(
  value: Partial<ChatMessage> & Record<string, unknown>,
  fallbackSeed = 0,
): ChatMessage {
  const ts = coerceMessageTimestamp(value.ts as number | string | undefined, Date.now());
  const channel = normalizeChatChannel(value.channel as string | undefined);
  const senderId = typeof value.senderId === 'string' && value.senderId.trim()
    ? value.senderId
    : 'system';
  const senderName = typeof value.senderName === 'string' && value.senderName.trim()
    ? value.senderName
    : 'System';
  const body = typeof value.body === 'string' ? value.body : '';

  return {
    id: ensureMessageId(value.id as string | undefined, fallbackSeed),
    channel,
    kind: coerceMessageKind(value.kind as string | undefined),
    senderId,
    senderName,
    senderRank: typeof value.senderRank === 'string' ? value.senderRank : undefined,
    senderRole: value.senderRole as ChatSenderRole | string | undefined,
    senderIdentity: value.senderIdentity as ChatSenderIdentity | undefined,
    body,
    emoji: typeof value.emoji === 'string' ? value.emoji : undefined,
    ts,
    immutable: Boolean(value.immutable),
    proofHash: typeof value.proofHash === 'string' ? value.proofHash : undefined,
    deliveryState: value.deliveryState as ChatDeliveryState | undefined,
    moderationState: value.moderationState as ChatModerationState | undefined,
    moderationDecision:
      value.moderationDecision as ChatModerationDecision | undefined,
    proofMeta: value.proofMeta as ChatProofMeta | undefined,
    legendMeta: value.legendMeta as ChatLegendMeta | undefined,
    replayMeta: value.replayMeta as ChatReplayMeta | undefined,
    auditMeta: value.auditMeta as ChatAuditMeta | undefined,
    senderWire: value.senderWire as ChatSenderWire | undefined,
    meta: value.meta as ChatMessageMeta | undefined,
    metadata: (value.metadata ?? value.meta) as Record<string, unknown> | undefined,
    botSource: buildLegacyBotTauntSource(
      value.botSource as Partial<BotTauntSource> | undefined,
    ),
    shieldMeta: buildShieldEventMeta(
      value.shieldMeta as Partial<ShieldEventMeta> | undefined,
    ),
    cascadeMeta: buildCascadeAlertMeta(
      value.cascadeMeta as Partial<CascadeAlertMeta> | undefined,
    ),
    pressureTier: value.pressureTier as PressureTier | undefined,
    tickTier: value.tickTier as TickTier | undefined,
    runOutcome: value.runOutcome as RunOutcome | undefined,
    relationshipState:
      value.relationshipState as ChatRelationshipState | undefined,
    audienceHeat: value.audienceHeat as ChatAudienceHeat | undefined,
    channelMood: value.channelMood as ChatChannelMood | undefined,
    reputationState: value.reputationState as ChatReputationState | undefined,
    affect: value.affect as ChatAffectSnapshot | undefined,
    learningProfile: value.learningProfile as ChatLearningProfile | undefined,
    rescueDecision: value.rescueDecision as ChatRescueDecision | undefined,
    negotiationState:
      value.negotiationState as ChatNegotiationState | undefined,
    liveOpsState: value.liveOpsState as ChatLiveOpsState | undefined,
    momentType: value.momentType as ChatMomentType | undefined,
    scenePlan: value.scenePlan as ChatScenePlan | undefined,
    revealSchedule: value.revealSchedule as ChatRevealSchedule | undefined,
    silenceDecision:
      value.silenceDecision as ChatSilenceDecision | undefined,
    memoryAnchors: value.memoryAnchors as readonly ChatMemoryAnchor[] | undefined,
    featureSnapshot: value.featureSnapshot as ChatFeatureSnapshot | undefined,
    render: value.render as ChatMessageRenderMeta | undefined,
    analytics: value.analytics as ChatMessageAnalyticsMeta | undefined,
    compatibility:
      value.compatibility as ChatMessageCompatibilityEnvelope | undefined
      ?? {
        compatibilityLevel: 'SHARED_BACKED',
        derivesFromSharedContracts: true,
        derivesFromEnginePublicLane: true,
        authoritative: Boolean(value.proofMeta || value.meta),
      },
  };
}

export function coerceChatMessages(
  values: readonly (Partial<ChatMessage> & Record<string, unknown>)[],
): ChatMessage[] {
  return values.map((value, index) => coerceChatMessage(value, index));
}

// ============================================================================
// MARK: Transform helpers
// ============================================================================

export function toSharedVisibleChannel(
  value: ChatChannel | UnifiedVisibleChatChannel,
): SharedChat.ChatChannels.ChatVisibleChannel {
  return toUnifiedVisibleChatChannel(value);
}

export function groupMessagesByChannel(
  messages: readonly ChatMessage[],
): Record<ChatChannel, ChatMessage[]> {
  const grouped: Record<ChatChannel, ChatMessage[]> = {
    GLOBAL: [],
    SYNDICATE: [],
    DEAL_ROOM: [],
  };

  for (const message of messages) {
    const channel = normalizeChatChannel(message.channel);
    grouped[channel].push(message);
  }

  return grouped;
}

export function sortMessagesForRender(
  messages: readonly ChatMessage[],
): ChatMessage[] {
  return [...messages].sort((a, b) => {
    if (a.ts !== b.ts) {
      return a.ts - b.ts;
    }

    return a.id.localeCompare(b.id);
  });
}

export function collectProofHashes(
  messages: readonly ChatMessage[],
): string[] {
  const proofs = new Set<string>();

  for (const message of messages) {
    if (message.proofHash) {
      proofs.add(message.proofHash);
    }

    if (message.proofMeta?.proofHash) {
      proofs.add(message.proofMeta.proofHash);
    }
  }

  return [...proofs];
}

export function deriveUnreadCounts(
  messages: readonly ChatMessage[],
  activeTab: ChatChannel,
): ChatUnreadByChannel {
  const grouped = groupMessagesByChannel(messages);

  return {
    GLOBAL: activeTab === 'GLOBAL' ? 0 : grouped.GLOBAL.length,
    SYNDICATE: activeTab === 'SYNDICATE' ? 0 : grouped.SYNDICATE.length,
    DEAL_ROOM: activeTab === 'DEAL_ROOM' ? 0 : grouped.DEAL_ROOM.length,
  };
}

export function extractThreatSnapshot(
  messages: readonly ChatMessage[],
): ChatThreatSnapshot {
  let attackCount = 0;
  let tauntCount = 0;
  let pressureCritical = false;
  let pressureHigh = false;
  let rescueNeeded = false;
  let activeTickTier: TickTier | undefined;
  let activePressureTier: PressureTier | undefined;

  for (const message of messages) {
    if (message.kind === 'BOT_ATTACK') {
      attackCount += 1;
    }

    if (message.kind === 'BOT_TAUNT') {
      tauntCount += 1;
    }

    if (message.rescueDecision) {
      rescueNeeded = true;
    }

    if (message.pressureTier === 'CRITICAL') {
      pressureCritical = true;
      activePressureTier = 'CRITICAL';
    } else if (message.pressureTier === 'PRESSURED' && !pressureCritical) {
      pressureHigh = true;
      activePressureTier = 'PRESSURED';
    }

    if (message.tickTier) {
      activeTickTier = message.tickTier;
    }
  }

  const score01 = Math.max(
    0,
    Math.min(
      1,
      attackCount * 0.12 +
        tauntCount * 0.06 +
        (pressureCritical ? 0.40 : 0) +
        (pressureHigh ? 0.18 : 0) +
        (rescueNeeded ? 0.12 : 0),
    ),
  );

  const score100 = Math.round(score01 * 100);
  const band: ChatThreatBand =
    score01 >= 0.85
      ? 'SEVERE'
      : score01 >= 0.60
        ? 'HIGH'
        : score01 >= 0.35
          ? 'ELEVATED'
          : score01 >= 0.10
            ? 'LOW'
            : 'QUIET';

  return {
    score01,
    score100,
    band,
    attackCount,
    tauntCount,
    rescueNeeded,
    activePressureTier,
    activeTickTier,
  };
}

export function buildChannelSummaries(
  messages: readonly ChatMessage[],
  activeTab: ChatChannel,
): ChatChannelSummary[] {
  const grouped = groupMessagesByChannel(messages);
  const unread = deriveUnreadCounts(messages, activeTab);

  return LEGACY_CHAT_CHANNELS.map((channel) => {
    const sorted = sortMessagesForRender(grouped[channel]);
    const latest = sorted[sorted.length - 1];
    const threat = extractThreatSnapshot(sorted);

    return {
      channel,
      label: getChatChannelLabel(channel),
      description: getChatChannelDescription(channel),
      unread: unread[channel],
      totalMessages: sorted.length,
      lastMessageAt: latest?.ts,
      lastSenderName: latest?.senderName,
      latestKind: latest?.kind,
      threatBand: threat.band,
      helperNeeded: threat.rescueNeeded,
    };
  });
}

export function buildTranscriptSearchResult(
  messages: readonly ChatMessage[],
  query: string,
  channel: ChatChannel,
): ChatTranscriptSearchResult {
  const normalizedQuery = query.trim().toLowerCase();
  const pool = messages.filter(
    (message) => normalizeChatChannel(message.channel) === channel,
  );

  const matched = !normalizedQuery
    ? pool
    : pool.filter((message) => {
        const haystacks = [
          message.body,
          message.senderName,
          message.senderRank,
          message.proofHash,
          message.botSource?.botId,
          message.botSource?.personaId,
        ].filter(Boolean);

        return haystacks.some((value) =>
          String(value).toLowerCase().includes(normalizedQuery),
        );
      });

  return {
    query,
    totalMatches: matched.length,
    channel,
    messageIds: matched.map((message) => message.id),
    messages: matched,
  };
}

export function toLegacyChatMessageFromWire(
  wire: SharedChat.ChatEvents.ChatMessageWire,
): ChatMessage {
  const rawWire = wire as unknown as Record<string, unknown>;
  const rawSender = wire.sender as unknown as Record<string, unknown>;
  const rawMeta = (wire.meta ?? {}) as Record<string, unknown>;
  const rawProof = (wire.proof ?? {}) as Record<string, unknown>;

  const rawProofHash =
    rawProof['messageHash'] ??
    rawProof['message_hash'] ??
    rawProof['proofHash'] ??
    rawProof['hash'];

  const proofHash =
    typeof rawProofHash === 'string'
      ? rawProofHash
      : rawProofHash != null
        ? String(rawProofHash)
        : undefined;

  return coerceChatMessage({
    id: ensureMessageId(rawWire['id'] as string | undefined, 0),
    channel: normalizeChatChannel(wire.channelId),
    kind: coerceMessageKind(wire.kind),
    senderId:
      (rawSender['id'] as string | undefined) ??
      (rawSender['playerId'] as string | undefined) ??
      (rawSender['memberId'] as string | undefined) ??
      String(rawSender['name'] ?? 'system'),
    senderName:
      (rawSender['name'] as string | undefined) ??
      (rawSender['displayName'] as string | undefined) ??
      'System',
    senderRank: rawSender['title'] as string | undefined,
    senderRole: rawSender['role'] as ChatSenderRole | string | undefined,
    senderWire: wire.sender,
    body: wire.body,
    emoji: rawWire['emoji'] as string | undefined,
    ts: coerceMessageTimestamp(
      (rawWire['ts'] as number | string | undefined) ??
        (rawWire['timestamp'] as number | string | undefined),
      Date.now(),
    ),
    immutable: rawWire['immutable'] as boolean | undefined,
    proofHash,
    deliveryState: wire.deliveryState,
    moderationState: wire.moderation?.state,
    meta: wire.meta,
    metadata: rawMeta,
    proofMeta: wire.proof as unknown as ChatProofMeta | undefined,
    legendMeta: wire.legend as unknown as ChatLegendMeta | undefined,
    replayMeta: undefined,
    auditMeta: undefined,
    pressureTier: wire.meta?.pressureTier as PressureTier | undefined,
    tickTier: wire.meta?.tickTier as TickTier | undefined,
    runOutcome: wire.meta?.runOutcome as RunOutcome | undefined,
    botSource:
      (rawMeta['botSource'] as BotTauntSource | undefined) ??
      (rawWire['botSource'] as BotTauntSource | undefined),
    shieldMeta:
      (rawMeta['shieldMeta'] as ShieldEventMeta | undefined) ??
      (rawWire['shieldMeta'] as ShieldEventMeta | undefined),
    cascadeMeta:
      (rawMeta['cascadeMeta'] as CascadeAlertMeta | undefined) ??
      (rawWire['cascadeMeta'] as CascadeAlertMeta | undefined),
    relationshipState:
      (rawWire['relationshipState'] as ChatRelationshipState | undefined) ??
      (rawMeta['relationshipState'] as ChatRelationshipState | undefined),
    memoryAnchors:
      (rawWire['memoryAnchors'] as readonly ChatMemoryAnchor[] | undefined) ??
      (rawMeta['memoryAnchors'] as readonly ChatMemoryAnchor[] | undefined),
    negotiationState:
      (rawWire['negotiationState'] as ChatNegotiationState | undefined) ??
      (rawMeta['negotiationState'] as ChatNegotiationState | undefined),
    affect:
      (rawWire['affect'] as ChatAffectSnapshot | undefined) ??
      (rawMeta['affect'] as ChatAffectSnapshot | undefined),
    learningProfile:
      (rawWire['learningProfile'] as ChatLearningProfile | undefined) ??
      (rawMeta['learningProfile'] as ChatLearningProfile | undefined),
    featureSnapshot:
      (rawWire['featureSnapshot'] as ChatFeatureSnapshot | undefined) ??
      (rawMeta['featureSnapshot'] as ChatFeatureSnapshot | undefined),
    rescueDecision:
      (rawWire['rescueDecision'] as ChatRescueDecision | undefined) ??
      (rawMeta['rescueDecision'] as ChatRescueDecision | undefined),
    liveOpsState:
      (rawWire['liveOpsState'] as ChatLiveOpsState | undefined) ??
      (rawMeta['liveOpsState'] as ChatLiveOpsState | undefined),
    audienceHeat:
      (rawWire['audienceHeat'] as ChatAudienceHeat | undefined) ??
      (rawMeta['audienceHeat'] as ChatAudienceHeat | undefined),
    channelMood:
      (rawWire['channelMood'] as ChatChannelMood | undefined) ??
      (rawMeta['channelMood'] as ChatChannelMood | undefined),
    reputationState:
      (rawWire['reputationState'] as ChatReputationState | undefined) ??
      (rawMeta['reputationState'] as ChatReputationState | undefined),
    momentType:
      (rawWire['momentType'] as ChatMomentType | undefined) ??
      (rawMeta['momentType'] as ChatMomentType | undefined),
    scenePlan:
      (rawWire['scenePlan'] as ChatScenePlan | undefined) ??
      (rawMeta['scenePlan'] as ChatScenePlan | undefined),
    revealSchedule:
      (rawWire['revealSchedule'] as ChatRevealSchedule | undefined) ??
      (rawMeta['revealSchedule'] as ChatRevealSchedule | undefined),
    silenceDecision:
      (rawWire['silenceDecision'] as ChatSilenceDecision | undefined) ??
      (rawMeta['silenceDecision'] as ChatSilenceDecision | undefined),
    compatibility: {
      compatibilityLevel: 'SHARED_BACKED',
      derivesFromSharedContracts: true,
      derivesFromEnginePublicLane: false,
      derivedFromFrameKind: 'ChatMessageWire',
      authoritative: true,
    },
  });
}

export function toLegacyChatMessagesFromReplay(
  snapshot: ChatReplayWindowSnapshot,
): ChatMessage[] {
  return snapshot.messages.map((entry, index) => {
    const rawEntry = entry as unknown as Record<string, unknown>;
    const rawMessage =
      ((rawEntry['message'] as Record<string, unknown> | undefined) ?? rawEntry);

    const rawSender =
      (rawMessage['sender'] as Record<string, unknown> | undefined) ?? {};

    const rawProof =
      (rawMessage['proof'] as Record<string, unknown> | undefined) ?? {};

    const rawMeta =
      (rawMessage['meta'] as Record<string, unknown> | undefined) ?? {};

    const rawProofHash =
      rawProof['messageHash'] ??
      rawProof['message_hash'] ??
      rawProof['proofHash'] ??
      rawProof['hash'] ??
      rawMessage['proofHash'];

    const proofHash =
      typeof rawProofHash === 'string'
        ? rawProofHash
        : rawProofHash != null
          ? String(rawProofHash)
          : undefined;

    return coerceChatMessage(
      {
        id: ensureMessageId(
          (rawMessage['id'] as string | undefined) ??
            (rawMessage['messageId'] as string | undefined),
          index,
        ),
        channel: normalizeChatChannel(
          (rawMessage['channel'] as string | undefined) ??
            (rawMessage['channelId'] as string | undefined),
        ),
        kind: coerceMessageKind(rawMessage['kind'] as string | undefined),
        senderId:
          (rawSender['id'] as string | undefined) ??
          (rawSender['playerId'] as string | undefined) ??
          (rawSender['memberId'] as string | undefined) ??
          String(rawSender['name'] ?? 'system'),
        senderName:
          (rawSender['name'] as string | undefined) ??
          (rawSender['displayName'] as string | undefined) ??
          'System',
        senderRank: rawSender['title'] as string | undefined,
        senderRole:
          rawSender['role'] as ChatSenderRole | string | undefined,
        body: (rawMessage['body'] as string | undefined) ?? '',
        emoji: rawMessage['emoji'] as string | undefined,
        ts: coerceMessageTimestamp(
          (rawMessage['ts'] as number | string | undefined) ??
            (rawMessage['timestamp'] as number | string | undefined),
          Date.now(),
        ),
        immutable: rawMessage['immutable'] as boolean | undefined,
        proofHash,
        senderWire: rawMessage['sender'] as ChatSenderWire | undefined,
        meta: rawMessage['meta'] as ChatMessageMeta | undefined,
        metadata: rawMeta,
        proofMeta: rawMessage['proof'] as ChatProofMeta | undefined,
        legendMeta: rawMessage['legend'] as ChatLegendMeta | undefined,
        replayMeta:
          (rawMessage['replay'] as ChatReplayMeta | undefined) ??
          (rawEntry['replay'] as ChatReplayMeta | undefined),
        auditMeta:
          (rawMessage['audit'] as ChatAuditMeta | undefined) ??
          (rawEntry['audit'] as ChatAuditMeta | undefined),
        render: {
          groupKey: rawEntry['groupKey'] as string | undefined,
          compactPreview:
            (rawEntry['preview'] as string | undefined) ??
            (rawMessage['preview'] as string | undefined),
          queryMatched: false,
        },
        compatibility: {
          compatibilityLevel: 'SHARED_BACKED',
          derivesFromSharedContracts: true,
          derivesFromEnginePublicLane: false,
          derivedFromFrameKind: rawEntry['message']
            ? 'ChatReplayWindowSnapshot'
            : 'ChatReplayMessageList',
          authoritative: true,
        },
      },
      index,
    );
  });
}

function getLastItem<T>(items: readonly T[]): T | null {
  return items.length > 0 ? items[items.length - 1] ?? null : null;
}

export function createDefaultUseChatEngineResult(
  overrides: Partial<UseChatEngineResult> = {},
): UseChatEngineResult {
  const messages = coerceChatMessages(
    (overrides.messages ?? []) as readonly (Partial<ChatMessage> & Record<string, unknown>)[],
  );

  const activeTab = normalizeChatChannel(
    overrides.activeChannel ?? overrides.activeTab ?? 'GLOBAL',
  );

  const grouped = groupMessagesByChannel(messages);

  const visibleMessages = overrides.visibleMessages
    ? coerceChatMessages(
        overrides.visibleMessages as readonly (Partial<ChatMessage> & Record<string, unknown>)[],
      )
    : grouped[activeTab];

  const allMessages = overrides.allMessages
    ? coerceChatMessages(
        overrides.allMessages as readonly (Partial<ChatMessage> & Record<string, unknown>)[],
      )
    : messages;

  const threat = overrides.threat ?? extractThreatSnapshot(visibleMessages);

  const summaries =
    overrides.summaries ?? buildChannelSummaries(messages, activeTab);

  const unread: Partial<
    Record<
      UnifiedVisibleChatChannel | Lowercase<UnifiedVisibleChatChannel>,
      number
    >
  > =
    overrides.unread ??
    (deriveUnreadCounts(messages, activeTab) as unknown as Partial<
      Record<
        UnifiedVisibleChatChannel | Lowercase<UnifiedVisibleChatChannel>,
        number
      >
    >);

  const totalUnread =
    overrides.totalUnread ??
    Object.values(unread).reduce((sum, value) => sum + Number(value ?? 0), 0);

  const sendText = overrides.sendText ?? overrides.sendMessage ?? (() => undefined);
  const switchTab = overrides.switchTab ?? (() => undefined);
  const toggleChat = overrides.toggleChat ?? (() => undefined);
  const noop = () => undefined;

  return {
    messages,
    allMessages,
    visibleMessages,
    recentMessages: overrides.recentMessages ?? visibleMessages.slice(-24),
    activeTab,
    activeChannel: overrides.activeChannel ?? activeTab,
    activeSummary:
      overrides.activeSummary ??
      summaries.find(
        (summary) => normalizeChatChannel(summary.channel) === activeTab,
      ),
    chatOpen: overrides.chatOpen ?? true,
    collapsed: overrides.collapsed ?? false,
    isPinned: overrides.isPinned ?? false,
    connected: overrides.connected ?? false,
    connectionState:
      overrides.connectionState ??
      (overrides.connected ? 'CONNECTED' : 'DISCONNECTED'),
    unread,
    totalUnread,
    switchTab,
    setActiveChannel: overrides.setActiveChannel ?? switchTab,
    toggleChat,
    openChat: overrides.openChat ?? noop,
    closeChat: overrides.closeChat ?? noop,
    collapse: overrides.collapse ?? noop,
    expand: overrides.expand ?? noop,
    sendMessage: overrides.sendMessage ?? sendText,
    sendText,
    sendDraft: overrides.sendDraft ?? noop,
    setDraft: overrides.setDraft ?? noop,
    appendDraft: overrides.appendDraft ?? noop,
    clearDraft: overrides.clearDraft ?? noop,
    quickReply: overrides.quickReply ?? noop,
    clearUnread: overrides.clearUnread,
    summaries,
    channels: overrides.channels ?? summaries,
    threat,
    threatModel: overrides.threatModel ?? threat,
    threatSummary: overrides.threatSummary,
    helperPrompt:
      overrides.helperPrompt ??
      {
        visible: threat.rescueNeeded,
        tone:
          threat.band === 'SEVERE'
            ? 'urgent'
            : threat.band === 'HIGH'
              ? 'strategic'
              : 'calm',
        title:
          threat.band === 'SEVERE'
            ? 'Pressure spike detected'
            : threat.band === 'HIGH'
              ? 'Hold the lane'
              : 'Stay composed',
        body:
          threat.band === 'SEVERE'
            ? 'A hater burst or collapse window is active. Send a short stabilizing reply.'
            : threat.band === 'HIGH'
              ? 'Use a tactical response. Do not over-explain.'
              : 'You still have room to respond cleanly.',
        ctaLabel: 'Assist',
      },
    presence: overrides.presence ?? {
      onlineCount: 0,
      activeMembers: 0,
      typingCount: 0,
      recentPeerNames: [],
      recentRanks: [],
    },
    transcript: overrides.transcript ?? {
      open: false,
      searchQuery: '',
      selectedMessageId: null,
      newestFirst: false,
    },
    composer: overrides.composer ?? {
      activeDraft: '',
      charCount: 0,
      maxChars: 1200,
      canSend: false,
      isNearLimit: false,
      placeholder: 'Type a message…',
    },
    transcriptDrawerModel: overrides.transcriptDrawerModel,
    transcriptDrawerCallbacks: overrides.transcriptDrawerCallbacks,
    presenceStripModel: overrides.presenceStripModel,
    typingIndicatorModel: overrides.typingIndicatorModel,
    channelTabs: overrides.channelTabs,
    messageFeedModel: overrides.messageFeedModel,
    messageFeedActionsByMessageId: overrides.messageFeedActionsByMessageId,
    shellMode: overrides.shellMode ?? 'DOCK',
    transcriptLocked: overrides.transcriptLocked ?? false,
    emptyStateMode: overrides.emptyStateMode ?? 'IDLE',
    latestMessage: overrides.latestMessage ?? getLastItem(visibleMessages),
    latestPlayerMessage:
      overrides.latestPlayerMessage ??
      [...visibleMessages]
        .reverse()
        .find((message) => message.kind === 'PLAYER') ??
      null,
    latestSystemMessage:
      overrides.latestSystemMessage ??
      [...visibleMessages]
        .reverse()
        .find((message) => message.kind === 'SYSTEM') ??
      null,
    latestThreatMessage:
      overrides.latestThreatMessage ??
      [...visibleMessages]
        .reverse()
        .find(
          (message) =>
            message.kind === 'BOT_ATTACK' ||
            message.kind === 'BOT_TAUNT' ||
            message.kind === 'CASCADE_ALERT',
        ) ??
      null,
    diagnostics: overrides.diagnostics,
    mountState: overrides.mountState ?? {
      mountTarget: 'GAME_BOARD',
      modeScope: 'GLOBAL',
      storageNamespace: 'pzo_chat',
    },
    runtimeBundle: overrides.runtimeBundle,
    toggleTranscript: overrides.toggleTranscript ?? noop,
    openTranscript: overrides.openTranscript ?? noop,
    closeTranscript: overrides.closeTranscript ?? noop,
    setTranscriptSearchQuery: overrides.setTranscriptSearchQuery ?? noop,
    selectTranscriptMessage: overrides.selectTranscriptMessage ?? noop,
    jumpToLatest: overrides.jumpToLatest ?? noop,
  };
}

// ============================================================================
// MARK: Registry and lookup surface
// ============================================================================

export const CHAT_TYPES_EXPORT_GROUPS = Object.freeze({
  foundational: [
    'ChatChannel',
    'UnifiedVisibleChatChannel',
    'AnyChatChannelId',
    'MessageKind',
    'ExtendedMessageKind',
    'PressureTier',
    'TickTier',
    'RunOutcome',
    'AttackType',
    'CascadeSeverity',
    'ShieldLayerId',
  ] as const,
  legacySurface: [
    'ChatMessage',
    'GameChatContext',
    'SabotageEvent',
    'UseChatEngineResult',
    'ChatPanelProps',
  ] as const,
  compatibilityHelpers: [
    'normalizeChatChannel',
    'toUnifiedVisibleChatChannel',
    'toPrimaryShadowChannel',
    'coerceMessageKind',
    'coerceChatMessage',
    'coerceChatMessages',
    'normalizeSabotageEvent',
    'normalizeGameChatContext',
    'createDefaultUseChatEngineResult',
  ] as const,
  uiSupport: [
    'ChatChannelSummary',
    'ChatThreatSnapshot',
    'ChatHelperPromptSnapshot',
    'ChatTranscriptSearchResult',
  ] as const,
});

export interface ChatTypesDescriptor {
  readonly key:
    | 'ChatMessage'
    | 'GameChatContext'
    | 'SabotageEvent'
    | 'UseChatEngineResult'
    | 'ChatPanelProps';
  readonly compatibilityLevel: ChatCompatibilityLevel;
  readonly sharedBacked: boolean;
  readonly engineAware: boolean;
  readonly description: string;
}

export const CHAT_TYPES_DESCRIPTORS = Object.freeze({
  ChatMessage: Object.freeze<ChatTypesDescriptor>({
    key: 'ChatMessage',
    compatibilityLevel: 'SHARED_BACKED',
    sharedBacked: true,
    engineAware: true,
    description:
      'Legacy-compatible message surface re-anchored on shared message, proof, replay, affect, and learning contracts.',
  }),
  GameChatContext: Object.freeze<ChatTypesDescriptor>({
    key: 'GameChatContext',
    compatibilityLevel: 'ENGINE_BACKED',
    sharedBacked: true,
    engineAware: true,
    description:
      'Legacy context surface for mounted chat shells, enriched with mode, mount, affect, learning, and continuity metadata.',
  }),
  SabotageEvent: Object.freeze<ChatTypesDescriptor>({
    key: 'SabotageEvent',
    compatibilityLevel: 'SHARED_BACKED',
    sharedBacked: true,
    engineAware: true,
    description:
      'Legacy sabotage event alias for bot attack moments, kept stable for current callbacks and mounts.',
  }),
  UseChatEngineResult: Object.freeze<ChatTypesDescriptor>({
    key: 'UseChatEngineResult',
    compatibilityLevel: 'ENGINE_BACKED',
    sharedBacked: true,
    engineAware: true,
    description:
      'Compatibility return shape for the legacy hook while migration moves callers to useUnifiedChat and engine public selectors, including unified shell aliases such as activeChannel and allMessages.',
  }),
  ChatPanelProps: Object.freeze<ChatTypesDescriptor>({
    key: 'ChatPanelProps',
    compatibilityLevel: 'LEGACY_ONLY',
    sharedBacked: true,
    engineAware: true,
    description:
      'Legacy wrapper prop surface for ChatPanel while it remains a migration-safe shell over UnifiedChatDock.',
  }),
} as const);

export function getChatTypesDescriptor(
  key: keyof typeof CHAT_TYPES_DESCRIPTORS,
): ChatTypesDescriptor {
  return CHAT_TYPES_DESCRIPTORS[key];
}

export const CHAT_TYPES_SURFACE = Object.freeze({
  version: CHAT_TYPES_VERSION,
  revision: CHAT_TYPES_REVISION,
  filePath: CHAT_TYPES_FILE_PATH,
  namespace: CHAT_TYPES_NAMESPACE,
  authorities: CHAT_TYPES_AUTHORITIES,
  runtimeBundle: CHAT_TYPES_RUNTIME_BUNDLE,
  exports: CHAT_TYPES_EXPORT_GROUPS,
  descriptors: CHAT_TYPES_DESCRIPTORS,
  laws: CHAT_TYPES_RUNTIME_LAWS,
  migration: CHAT_TYPES_MIGRATION_FLAGS,
  helpers: Object.freeze({
    isLegacyChatChannel,
    isUnifiedVisibleChatChannel,
    isAnyChatChannelId,
    isLegacyMessageKind,
    isExtendedMessageKind,
    isSabotageCardType,
    isChatConnectionState,
    normalizeChatChannel,
    toUnifiedVisibleChatChannel,
    toPrimaryShadowChannel,
    getChatChannelLabel,
    getChatChannelDescription,
    coerceMessageKind,
    ensureMessageId,
    coerceMessageTimestamp,
    buildLegacyBotTauntSource,
    buildShieldEventMeta,
    buildCascadeAlertMeta,
    createEmptyGameChatContext,
    normalizeGameChatContext,
    createSabotageEvent,
    normalizeSabotageEvent,
    coerceChatMessage,
    coerceChatMessages,
    toSharedVisibleChannel,
    groupMessagesByChannel,
    sortMessagesForRender,
    collectProofHashes,
    deriveUnreadCounts,
    extractThreatSnapshot,
    buildChannelSummaries,
    buildTranscriptSearchResult,
    toLegacyChatMessageFromWire,
    toLegacyChatMessagesFromReplay,
    createDefaultUseChatEngineResult,
    getChatTypesDescriptor,
  }),
});
