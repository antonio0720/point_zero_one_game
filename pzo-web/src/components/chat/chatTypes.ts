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

export const CHAT_TYPES_VERSION = '2026.03.15' as const;

export const CHAT_TYPES_REVISION =
  'pzo.components.chat.types.compat.v1' as const;

export const LEGACY_CHAT_CHANNELS = [
  'GLOBAL',
  'SYNDICATE',
  'DEAL_ROOM',
] as const satisfies readonly SharedChat.ChatChannelsModule.ChatVisibleChannel[];

export const UNIFIED_VISIBLE_CHAT_CHANNELS =
  SharedChat.ChatChannelsModule.CHAT_VISIBLE_CHANNELS;

export const ALL_KNOWN_CHAT_CHANNELS =
  SharedChat.ChatChannelsModule.CHAT_ALL_CHANNELS;

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
} as const satisfies Record<SharedChat.ChatChannelsModule.ChatChannelId, string>);

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
} as const satisfies Record<SharedChat.ChatChannelsModule.ChatChannelId, string>);

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

export type UnifiedVisibleChatChannel = SharedChat.ChatChannelsModule.ChatVisibleChannel;

export type AnyChatChannelId = SharedChat.ChatChannelsModule.ChatChannelId;

export type ChatShadowChannel = SharedChat.ChatChannelsModule.ChatShadowChannel;

export type MessageKind = (typeof LEGACY_MESSAGE_KINDS)[number];

export type ExtendedMessageKind = (typeof EXTENDED_MESSAGE_KINDS)[number];

export type SabotageCardType = (typeof LEGACY_SABOTAGE_CARD_TYPES)[number];

export type ChatHelperPromptTone = (typeof CHAT_HELPER_PROMPT_TONES)[number];

export type ChatThreatBand = (typeof CHAT_THREAT_BANDS)[number];

export type ChatConnectionState = (typeof CHAT_CONNECTION_STATES)[number];

export type ChatCompatibilityLevel =
  (typeof CHAT_COMPATIBILITY_LEVELS)[number];

export type PressureTier = SharedChat.ChatEventsModule.ChatPressureTier;

export type TickTier = SharedChat.ChatEventsModule.ChatTickTier;

export type RunOutcome = SharedChat.ChatEventsModule.ChatRunOutcome;

export type AttackType = SharedChat.ChatEventsModule.ChatAttackType;

export type CascadeSeverity = SharedChat.ChatEventsModule.ChatCascadeSeverity;

export type ShieldLayerId = SharedChat.ChatEventsModule.ChatShieldLayerId;

export type BotTauntSource = SharedChat.ChatEventsModule.BotTauntSource;

export type ShieldEventMeta = SharedChat.ChatEventsModule.ShieldEventMeta;

export type CascadeAlertMeta = SharedChat.ChatEventsModule.CascadeAlertMeta;

export type ChatSenderWire = SharedChat.ChatEventsModule.ChatSenderWire;

export type ChatSenderIdentity = SharedChat.ChatEventsModule.ChatSenderIdentity;

export type ChatSenderRole = SharedChat.ChatEventsModule.ChatSenderRole;

export type ChatMessageMeta = SharedChat.ChatEventsModule.ChatMessageMeta;

export type ChatProofMeta = SharedChat.ChatEventsModule.ChatProofMeta;

export type ChatLegendMeta = SharedChat.ChatEventsModule.ChatLegendMeta;

export type ChatReplayMeta = SharedChat.ChatEventsModule.ChatReplayMeta;

export type ChatAuditMeta = SharedChat.ChatEventsModule.ChatAuditMeta;

export type ChatModerationDecision =
  SharedChat.ChatEventsModule.ChatModerationDecision;

export type ChatDeliveryState = SharedChat.ChatEventsModule.ChatDeliveryState;

export type ChatModerationState = SharedChat.ChatEventsModule.ChatModerationState;

export type ChatPresenceState = SharedChat.ChatEventsModule.ChatPresenceState;

export type ChatTypingState = SharedChat.ChatEventsModule.ChatTypingState;

export type ChatPresenceSnapshot = SharedChat.ChatEventsModule.ChatPresenceSnapshot;

export type ChatTypingSnapshot = SharedChat.ChatEventsModule.ChatTypingSnapshot;

export type ChatCursorSnapshot = SharedChat.ChatEventsModule.ChatCursorSnapshot;

export type ChatReadReceipt = SharedChat.ChatEventsModule.ChatReadReceipt;

export type ChatRelationshipState =
  SharedChat.ChatEventsModule.ChatRelationshipState;

export type ChatMemoryAnchor = SharedChat.ChatEventsModule.ChatMemoryAnchor;

export type ChatOfferState = SharedChat.ChatEventsModule.ChatOfferState;

export type ChatNegotiationState =
  SharedChat.ChatEventsModule.ChatNegotiationState;

export type ChatContinuityState =
  SharedChat.ChatEventsModule.ChatContinuityState;

export type ChatAudienceHeat = SharedChat.ChatEventsModule.ChatAudienceHeat;

export type ChatChannelMood = SharedChat.ChatEventsModule.ChatChannelMood;

export type ChatReputationState = SharedChat.ChatEventsModule.ChatReputationState;

export type ChatAffectSnapshot = SharedChat.ChatEventsModule.ChatAffectSnapshot;

export type ChatLearningProfile = SharedChat.ChatEventsModule.ChatLearningProfile;

export type ChatFeatureSnapshot = SharedChat.ChatEventsModule.ChatFeatureSnapshot;

export type ChatRescueDecision = SharedChat.ChatEventsModule.ChatRescueDecision;

export type ChatLiveOpsState = SharedChat.ChatEventsModule.ChatLiveOpsState;

export type ChatMomentType = SharedChat.ChatEventsModule.ChatMomentType;

export type ChatScenePlan = SharedChat.ChatEventsModule.ChatScenePlan;

export type ChatRevealSchedule = SharedChat.ChatEventsModule.ChatRevealSchedule;

export type ChatSilenceDecision =
  SharedChat.ChatEventsModule.ChatSilenceDecision;

export type ChatAuthoritativeFrame =
  SharedChat.ChatEventsModule.ChatAuthoritativeFrame;

export type ChatReplayWindowSnapshot =
  SharedChat.ChatEventsModule.ChatReplayWindowSnapshot;

export type ChatReplayExcerptWire =
  SharedChat.ChatEventsModule.ChatReplayExcerptWire;

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
  readonly modeScope?: SharedChat.ChatChannelsModule.ChatModeScope;
  readonly mountTarget?: SharedChat.ChatChannelsModule.ChatMountTarget;
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
  readonly modeScope?: SharedChat.ChatChannelsModule.ChatModeScope;
  readonly mountTarget?: SharedChat.ChatChannelsModule.ChatMountTarget;
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

export interface UseChatEngineResult {
  readonly messages: readonly ChatMessage[];
  readonly activeTab: ChatChannel;
  readonly chatOpen: boolean;
  readonly connected: boolean;
  readonly unread: Partial<Record<UnifiedVisibleChatChannel | Lowercase<UnifiedVisibleChatChannel>, number>>;
  readonly totalUnread: number;
  readonly switchTab: (tab: ChatChannel) => void;
  readonly toggleChat: () => void;
  readonly sendMessage: (body: string) => void;
  readonly clearUnread?: (channel?: ChatChannel) => void;
  readonly summaries?: readonly ChatChannelSummary[];
  readonly threat?: ChatThreatSnapshot;
  readonly helperPrompt?: ChatHelperPromptSnapshot;
  readonly connectionState?: ChatConnectionState;
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
  sharedContractsRoot: SharedChat.ChatChannelsModule.CHAT_CHANNEL_CONTRACT?.authorities?.sharedContractsRoot
    ?? '/shared/contracts/chat',
  frontendEngineRoot: SharedChat.ChatChannelsModule.CHAT_CHANNEL_CONTRACT?.authorities?.frontendEngineRoot
    ?? '/pzo-web/src/engines/chat',
  frontendUiRoot: '/pzo-web/src/components/chat',
  sharedLearningRoot: SharedChat.ChatChannelsModule.CHAT_CHANNEL_CONTRACT?.authorities?.sharedLearningRoot
    ?? '/shared/contracts/chat/learning',
});

export const CHAT_TYPES_RUNTIME_LAWS = Object.freeze([
  'chatTypes.ts is a compatibility shim, not the canonical source of truth.',
  'Canonical channel and event law comes from shared/contracts/chat.',
  'Canonical frontend runtime law comes from pzo-web/src/engines/chat.',
  'Legacy names remain stable while authority moves out of the component lane.',
  'No battle, zero, pressure, shield, or cascade engine imports are allowed here.',
] as const);

export const CHAT_TYPES_MIGRATION_FLAGS = Object.freeze({
  isCanonicalTruthSource: false,
  isCompatibilityBridge: true,
  preservesLegacyImports: true,
  sharedContractsBacked: true,
  enginePublicAware: true,
  uiOnlyExtensionsAllowed: true,
  directEngineImportsAllowed: false,
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
  return SharedChat.ChatChannelsModule.isChatVisibleChannel(value);
}

export function isAnyChatChannelId(value: string): value is AnyChatChannelId {
  return SharedChat.ChatChannelsModule.isChatChannelId(value);
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

  const legacyAlias = SharedChat.ChatChannelsModule.normalizeLegacyChatChannel(normalized);
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

  if (SharedChat.ChatChannelsModule.isChatVisibleChannel(normalized)) {
    return normalized;
  }

  const legacyAlias = SharedChat.ChatChannelsModule.normalizeLegacyChatChannel(normalized);
  if (legacyAlias && SharedChat.ChatChannelsModule.isChatVisibleChannel(legacyAlias)) {
    return legacyAlias;
  }

  return fallback;
}

export function toPrimaryShadowChannel(
  value: string | ChatChannel | UnifiedVisibleChatChannel,
): ChatShadowChannel {
  return SharedChat.ChatChannelsModule.visibleChannelToPrimaryShadow(
    toUnifiedVisibleChatChannel(value),
  );
}

export function getChatChannelLabel(
  channel: string | AnyChatChannelId,
): string {
  const normalized = SharedChat.ChatChannelsModule.isChatChannelId(channel)
    ? channel
    : SharedChat.ChatChannelsModule.normalizeLegacyChatChannel(String(channel).toUpperCase())
      ?? toUnifiedVisibleChatChannel(String(channel));

  return CHAT_CHANNEL_LABELS[normalized];
}

export function getChatChannelDescription(
  channel: string | AnyChatChannelId,
): string {
  const normalized = SharedChat.ChatChannelsModule.isChatChannelId(channel)
    ? channel
    : SharedChat.ChatChannelsModule.normalizeLegacyChatChannel(String(channel).toUpperCase())
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
  if (!partial?.botId || !partial.botName || !partial.botState || !partial.attackType || !partial.dialogue) {
    return undefined;
  }

  return {
    botId: partial.botId,
    botName: partial.botName,
    botState: partial.botState,
    attackType: partial.attackType,
    targetLayer: partial.targetLayer,
    dialogue: partial.dialogue,
    isRetreat: Boolean(partial.isRetreat),
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
    integrity:
      typeof partial.integrity === 'number' ? partial.integrity : 0,
    maxIntegrity:
      typeof partial.maxIntegrity === 'number' ? partial.maxIntegrity : 0,
    isBreached: Boolean(partial.isBreached),
    attackId: partial.attackId,
  };
}

export function buildCascadeAlertMeta(
  partial: Partial<CascadeAlertMeta> | null | undefined,
): CascadeAlertMeta | undefined {
  if (!partial?.chainId || !partial?.severity || !partial?.direction) {
    return undefined;
  }

  return {
    chainId: partial.chainId,
    severity: partial.severity,
    direction: partial.direction,
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
): SharedChat.ChatChannelsModule.ChatVisibleChannel {
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

    if (message.proofMeta?.messageHash) {
      proofs.add(message.proofMeta.messageHash);
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
    } else if (message.pressureTier === 'HIGH' && !pressureCritical) {
      pressureHigh = true;
      activePressureTier = 'HIGH';
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
    const latest = sorted.at(-1);
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
          message.botSource?.botName,
          message.meta?.statusText,
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
  return coerceChatMessage({
    id: wire.id,
    channel: normalizeChatChannel(wire.channel),
    kind: coerceMessageKind(wire.kind),
    senderId: wire.sender.id,
    senderName: wire.sender.name,
    senderRank: wire.sender.title,
    senderRole: wire.sender.role,
    senderWire: wire.sender,
    body: wire.body,
    emoji: wire.emoji,
    ts: wire.ts,
    immutable: wire.immutable,
    proofHash: wire.proof?.messageHash,
    deliveryState: wire.deliveryState,
    moderationState: wire.moderation?.state,
    meta: wire.meta,
    proofMeta: wire.proof,
    legendMeta: wire.legend,
    replayMeta: wire.replay,
    auditMeta: wire.audit,
    pressureTier: wire.meta?.pressureTier,
    tickTier: wire.meta?.tickTier,
    runOutcome: wire.meta?.runOutcome,
    botSource: wire.meta?.botSource,
    shieldMeta: wire.meta?.shieldMeta,
    cascadeMeta: wire.meta?.cascadeMeta,
    relationshipState: wire.relationshipState,
    memoryAnchors: wire.memoryAnchors,
    negotiationState: wire.negotiationState,
    affect: wire.affect,
    learningProfile: wire.learningProfile,
    featureSnapshot: wire.featureSnapshot,
    rescueDecision: wire.rescueDecision,
    liveOpsState: wire.liveOpsState,
    audienceHeat: wire.audienceHeat,
    channelMood: wire.channelMood,
    reputationState: wire.reputationState,
    momentType: wire.momentType,
    scenePlan: wire.scenePlan,
    revealSchedule: wire.revealSchedule,
    silenceDecision: wire.silenceDecision,
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
  return snapshot.messages.map((excerpt, index) =>
    coerceChatMessage(
      {
        id: excerpt.message.id,
        channel: normalizeChatChannel(excerpt.message.channel),
        kind: coerceMessageKind(excerpt.message.kind),
        senderId: excerpt.message.sender.id,
        senderName: excerpt.message.sender.name,
        senderRank: excerpt.message.sender.title,
        senderRole: excerpt.message.sender.role,
        body: excerpt.message.body,
        emoji: excerpt.message.emoji,
        ts: excerpt.message.ts,
        immutable: excerpt.message.immutable,
        proofHash: excerpt.message.proof?.messageHash,
        senderWire: excerpt.message.sender,
        meta: excerpt.message.meta,
        proofMeta: excerpt.message.proof,
        legendMeta: excerpt.message.legend,
        replayMeta: excerpt.message.replay,
        auditMeta: excerpt.message.audit,
        render: {
          groupKey: excerpt.groupKey,
          compactPreview: excerpt.preview,
          queryMatched: false,
        },
        compatibility: {
          compatibilityLevel: 'SHARED_BACKED',
          derivesFromSharedContracts: true,
          derivesFromEnginePublicLane: false,
          derivedFromFrameKind: 'ChatReplayWindowSnapshot',
          authoritative: true,
        },
      },
      index,
    ),
  );
}

export function createDefaultUseChatEngineResult(
  overrides: Partial<UseChatEngineResult> = {},
): UseChatEngineResult {
  const messages = coerceChatMessages(overrides.messages ?? []);
  const activeTab = normalizeChatChannel(overrides.activeTab ?? 'GLOBAL');
  const threat = overrides.threat ?? extractThreatSnapshot(messages);
  const summaries = overrides.summaries ?? buildChannelSummaries(messages, activeTab);

  return {
    messages,
    activeTab,
    chatOpen: overrides.chatOpen ?? true,
    connected: overrides.connected ?? false,
    unread: overrides.unread ?? deriveUnreadCounts(messages, activeTab),
    totalUnread:
      overrides.totalUnread
      ?? Object.values(deriveUnreadCounts(messages, activeTab)).reduce(
        (sum, value) => sum + value,
        0,
      ),
    switchTab: overrides.switchTab ?? (() => undefined),
    toggleChat: overrides.toggleChat ?? (() => undefined),
    sendMessage: overrides.sendMessage ?? (() => undefined),
    clearUnread: overrides.clearUnread,
    summaries,
    threat,
    helperPrompt:
      overrides.helperPrompt
      ?? {
        visible: threat.rescueNeeded,
        tone: threat.band === 'SEVERE' ? 'urgent' : threat.band === 'HIGH' ? 'strategic' : 'calm',
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
    connectionState: overrides.connectionState ?? (overrides.connected ? 'CONNECTED' : 'DISCONNECTED'),
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
      'Compatibility return shape for the legacy hook while migration moves callers to useUnifiedChat and engine public selectors.',
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
