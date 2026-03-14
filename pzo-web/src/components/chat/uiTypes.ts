/**
 * ============================================================================
 * POINT ZERO ONE — UNIFIED CHAT UI CONTRACTS
 * FILE: pzo-web/src/components/chat/uiTypes.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical UI-facing contract surface for the thin chat render shell.
 *
 * This file is intentionally the presentation-only counterpart to:
 * - pzo-web/src/engines/chat/types.ts
 * - shared/contracts/chat/*
 * - shared/contracts/chat/learning/*
 *
 * Design laws
 * -----------
 * - UI contracts live in the render shell, not inside the engine brain.
 * - Engine truth flows inward; presentation state flows outward.
 * - This file may adapt engine contracts for rendering, but it must never
 *   redefine simulation truth or create competing source-of-truth types.
 * - Every UI component in the canonical chat shell should be able to type
 *   itself from this file without reaching into battle, pressure, shield,
 *   or run stores directly.
 * - Migration compatibility with the legacy pzo-web/src/components/chat lane
 *   is explicit so existing mounts can move without breaking imports.
 *
 * Why this file exists
 * --------------------
 * The repo currently shows two realities at once:
 * 1. the old UI lane in pzo-web/src/components/chat containing ChatPanel.tsx,
 *    chatTypes.ts, and useChatEngine.ts,
 * 2. the new engine lane in pzo-web/src/engines/chat containing the runtime
 *    brain plus an already-present UnifiedChatDock.tsx.
 *
 * The long-term architecture says UI should remain thin and live under
 * pzo-web/src/components/chat, while runtime logic belongs in
 * pzo-web/src/engines/chat. This file codifies that split by making the UI
 * layer depend on engine types without moving UI ownership into the engine.
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ============================================================================
 */

import type {
  CSSProperties,
  Dispatch,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  MutableRefObject,
  ReactElement,
  ReactNode,
  RefObject,
  SetStateAction,
  TouchEvent as ReactTouchEvent,
} from 'react';

import type {
  ChatChannel,
  ChatChannelId,
  ChatMessageId,
  ChatMessageKind,
  ChatMomentId,
  ChatMountPreset,
  ChatMountTarget,
  ChatProofHash,
  ChatRange,
  ChatRecord,
  ChatRoomId,
  ChatSceneId,
  ChatSenderIdentity,
  ChatSessionId,
  ChatUserId,
  ChatVisibleChannel,
  Percentage,
  Score01,
  Score100,
  UnixMs,
} from '../../engines/chat/types';

import type {
  ChatChannel as LegacyChatChannel,
  ChatMessage as LegacyChatMessage,
  MessageKind as LegacyMessageKind,
  SabotageEvent as LegacySabotageEvent,
} from './chatTypes';

/**
 * ============================================================================
 * MARK: Shared utility primitives
 * ============================================================================
 */

export type UiBrand<TValue, TBrand extends string> = TValue & {
  readonly __ui_brand: TBrand;
};

export type CssPixel = UiBrand<number, 'CssPixel'>;
export type ChatSurfaceId = UiBrand<string, 'ChatSurfaceId'>;
export type ChatListItemId = UiBrand<string, 'ChatListItemId'>;
export type ChatVirtualKey = UiBrand<string, 'ChatVirtualKey'>;
export type ChatMessageGroupId = UiBrand<string, 'ChatMessageGroupId'>;
export type ChatViewToken = UiBrand<string, 'ChatViewToken'>;
export type ChatAnimationToken = UiBrand<string, 'ChatAnimationToken'>;
export type ChatTelemetryUiId = UiBrand<string, 'ChatTelemetryUiId'>;
export type ChatComposerDraftId = UiBrand<string, 'ChatComposerDraftId'>;
export type ChatAttachmentId = UiBrand<string, 'ChatAttachmentId'>;
export type ChatPromptId = UiBrand<string, 'ChatPromptId'>;
export type ChatIndicatorId = UiBrand<string, 'ChatIndicatorId'>;
export type ChatAccessibilityId = UiBrand<string, 'ChatAccessibilityId'>;
export type ChatReplayCursorId = UiBrand<string, 'ChatReplayCursorId'>;
export type ChatTranscriptCursorId = UiBrand<string, 'ChatTranscriptCursorId'>;
export type ChatUiZoneId =
  | 'ROOT'
  | 'HEADER'
  | 'CHANNELS'
  | 'PRESENCE'
  | 'FEED'
  | 'COMPOSER'
  | 'DRAWER'
  | 'COLLAPSED_PILL'
  | 'BANNER'
  | 'THREAT_METER'
  | 'HELPER_PROMPT'
  | 'EMPTY_STATE';

export type ChatRenderDensity = 'MICRO' | 'COMPACT' | 'STANDARD' | 'EXPANDED';
export type ChatRenderScale = 'XS' | 'SM' | 'MD' | 'LG' | 'XL';
export type ChatColorIntent =
  | 'DEFAULT'
  | 'MUTED'
  | 'SYSTEM'
  | 'SUCCESS'
  | 'WARNING'
  | 'DANGER'
  | 'HELPER'
  | 'HATER'
  | 'NEGOTIATION'
  | 'PROOF'
  | 'LEGEND';
export type ChatSurfaceTone =
  | 'GLASS'
  | 'SOLID'
  | 'SHADOW'
  | 'DANGER'
  | 'SUCCESS'
  | 'PREDATORY'
  | 'CEREMONIAL';
export type ChatElevation = 0 | 1 | 2 | 3 | 4 | 5;
export type ChatBorderStyle = 'NONE' | 'SOFT' | 'HARD' | 'ACCENT' | 'DASHED';
export type ChatMotionIntent =
  | 'NONE'
  | 'FADE'
  | 'SLIDE_UP'
  | 'SLIDE_LEFT'
  | 'PULSE'
  | 'BLINK'
  | 'SHAKE'
  | 'COUNTDOWN'
  | 'THEATER_TYPING';
export type ChatCursorMode = 'AUTO' | 'LOCKED_TO_BOTTOM' | 'MANUAL' | 'REPLAY';
export type ChatFeedLayout = 'STACK' | 'GROUPED' | 'THREAD_STRIP' | 'REPLAY_TAPE';
export type ChatTranscriptMode = 'LIVE' | 'ARCHIVE' | 'REPLAY' | 'EXPORT';
export type ChatComposerMode = 'OPEN' | 'COMPACT' | 'DISABLED' | 'SHADOW_LOCKED';
export type ChatThreatDirection = 'FALLING' | 'STABLE' | 'RISING' | 'SPIKING';
export type ChatPromptSeverity = 'INFO' | 'NUDGE' | 'WARNING' | 'CRITICAL';
export type ChatCollapseReason =
  | 'USER_TOGGLED'
  | 'MODE_POLICY'
  | 'SCREEN_CONSTRAINT'
  | 'CINEMATIC_EVENT'
  | 'PERFORMANCE_GUARD';
export type ChatEmptyStateKind =
  | 'NO_MESSAGES'
  | 'CHANNEL_LOCKED'
  | 'LOADING'
  | 'OFFLINE'
  | 'NO_PERMISSION'
  | 'POST_RUN_ARCHIVE';
export type ChatDrawerTab = 'TRANSCRIPT' | 'PROOF' | 'EVENTS' | 'REPLAY';
export type ChatHeaderStatusTone =
  | 'QUIET'
  | 'ACTIVE'
  | 'TENSE'
  | 'HOSTILE'
  | 'NEGOTIATION'
  | 'RECOVERY';
export type ChatBadgeShape = 'PILL' | 'RECT' | 'DOT' | 'SQUARE';
export type ChatAvatarShape = 'ROUND' | 'SQUIRCLE' | 'SHIELD' | 'GLYPH';
export type ChatKeyboardCommandId =
  | 'TOGGLE_DOCK'
  | 'FOCUS_COMPOSER'
  | 'NEXT_CHANNEL'
  | 'PREV_CHANNEL'
  | 'OPEN_TRANSCRIPT'
  | 'SCROLL_TO_LATEST'
  | 'SEND_MESSAGE'
  | 'CANCEL_DRAFT'
  | 'TOGGLE_MUTE';

export type ChatNullable<T> = T | null;
export type ChatOptional<T> = T | undefined;
export type ChatReadonlyRecord<T> = Readonly<Record<string, T>>;
export type ChatDictionary<T> = Record<string, T>;

export interface ChatUiSpacingScale {
  readonly xxs: CssPixel;
  readonly xs: CssPixel;
  readonly sm: CssPixel;
  readonly md: CssPixel;
  readonly lg: CssPixel;
  readonly xl: CssPixel;
  readonly xxl: CssPixel;
}

export interface ChatUiRadiusScale {
  readonly xs: CssPixel;
  readonly sm: CssPixel;
  readonly md: CssPixel;
  readonly lg: CssPixel;
  readonly xl: CssPixel;
  readonly pill: CssPixel;
}

export interface ChatUiTypographyScale {
  readonly micro: CssPixel;
  readonly caption: CssPixel;
  readonly body: CssPixel;
  readonly bodyStrong: CssPixel;
  readonly subhead: CssPixel;
  readonly title: CssPixel;
  readonly hero: CssPixel;
}

export interface ChatUiMotionScale {
  readonly instantMs: number;
  readonly fastMs: number;
  readonly standardMs: number;
  readonly deliberateMs: number;
  readonly dramaticMs: number;
}

export interface ChatUiPalette {
  readonly bg: string;
  readonly bgMuted: string;
  readonly border: string;
  readonly borderStrong: string;
  readonly text: string;
  readonly textMuted: string;
  readonly textSubtle: string;
  readonly accent: string;
  readonly accentSoft: string;
  readonly success: string;
  readonly warning: string;
  readonly danger: string;
  readonly helper: string;
  readonly hater: string;
  readonly negotiation: string;
  readonly proof: string;
  readonly legend: string;
}

export interface ChatUiThemeTokens {
  readonly spacing: ChatUiSpacingScale;
  readonly radius: ChatUiRadiusScale;
  readonly typography: ChatUiTypographyScale;
  readonly motion: ChatUiMotionScale;
  readonly palette: ChatUiPalette;
  readonly shadowLow: string;
  readonly shadowMid: string;
  readonly shadowHigh: string;
}

export const CHAT_UI_THEME_DEFAULT: Readonly<ChatUiThemeTokens> = Object.freeze({
  spacing: {
    xxs: 2 as CssPixel,
    xs: 4 as CssPixel,
    sm: 8 as CssPixel,
    md: 12 as CssPixel,
    lg: 16 as CssPixel,
    xl: 24 as CssPixel,
    xxl: 32 as CssPixel,
  },
  radius: {
    xs: 4 as CssPixel,
    sm: 8 as CssPixel,
    md: 12 as CssPixel,
    lg: 16 as CssPixel,
    xl: 24 as CssPixel,
    pill: 999 as CssPixel,
  },
  typography: {
    micro: 10 as CssPixel,
    caption: 12 as CssPixel,
    body: 14 as CssPixel,
    bodyStrong: 15 as CssPixel,
    subhead: 16 as CssPixel,
    title: 18 as CssPixel,
    hero: 24 as CssPixel,
  },
  motion: {
    instantMs: 80,
    fastMs: 140,
    standardMs: 220,
    deliberateMs: 360,
    dramaticMs: 640,
  },
  palette: {
    bg: 'var(--chat-bg, rgba(8, 12, 20, 0.94))',
    bgMuted: 'var(--chat-bg-muted, rgba(13, 18, 28, 0.84))',
    border: 'var(--chat-border, rgba(255,255,255,0.09))',
    borderStrong: 'var(--chat-border-strong, rgba(255,255,255,0.18))',
    text: 'var(--chat-text, rgba(255,255,255,0.96))',
    textMuted: 'var(--chat-text-muted, rgba(255,255,255,0.72))',
    textSubtle: 'var(--chat-text-subtle, rgba(255,255,255,0.52))',
    accent: 'var(--chat-accent, #69c7ff)',
    accentSoft: 'var(--chat-accent-soft, rgba(105, 199, 255, 0.18))',
    success: 'var(--chat-success, #61d095)',
    warning: 'var(--chat-warning, #ffbe5c)',
    danger: 'var(--chat-danger, #ff5f73)',
    helper: 'var(--chat-helper, #9d8cff)',
    hater: 'var(--chat-hater, #ff6b6b)',
    negotiation: 'var(--chat-negotiation, #ff9d4d)',
    proof: 'var(--chat-proof, #6fe7ff)',
    legend: 'var(--chat-legend, #ffd86f)',
  },
  shadowLow: '0 6px 24px rgba(0,0,0,0.18)',
  shadowMid: '0 14px 38px rgba(0,0,0,0.24)',
  shadowHigh: '0 24px 80px rgba(0,0,0,0.42)',
});

/**
 * ============================================================================
 * MARK: Legacy compatibility bridge
 * ============================================================================
 */

export type LegacyCompatibleChatChannel = LegacyChatChannel | ChatVisibleChannel;
export type LegacyCompatibleMessageKind = LegacyMessageKind | ChatMessageKind;
export type LegacyCompatibleMessage = LegacyChatMessage & {
  readonly uiGroupId?: ChatMessageGroupId;
  readonly uiRenderableAtMs?: UnixMs;
  readonly uiSuppressed?: boolean;
};

export interface LegacyChatMigrationFlags {
  readonly preserveOldSenderShape: boolean;
  readonly preserveOldProofPlacement: boolean;
  readonly preserveChatPanelMessageOrder: boolean;
  readonly promoteLegacyDealRecapsToProofCards: boolean;
  readonly deriveThreatFromLegacySabotage: boolean;
  readonly allowLegacyGlobalOnlyMounts: boolean;
}

export const DEFAULT_LEGACY_CHAT_MIGRATION_FLAGS: Readonly<LegacyChatMigrationFlags> =
  Object.freeze({
    preserveOldSenderShape: true,
    preserveOldProofPlacement: true,
    preserveChatPanelMessageOrder: true,
    promoteLegacyDealRecapsToProofCards: true,
    deriveThreatFromLegacySabotage: true,
    allowLegacyGlobalOnlyMounts: true,
  });

/**
 * ============================================================================
 * MARK: Display atoms and visual badges
 * ============================================================================
 */

export interface ChatUiBadge {
  readonly id: string;
  readonly label: string;
  readonly icon?: string;
  readonly colorIntent: ChatColorIntent;
  readonly shape: ChatBadgeShape;
  readonly emphasis: 'LOW' | 'MID' | 'HIGH';
  readonly tooltip?: string;
  readonly hidden?: boolean;
  readonly sortableWeight?: number;
}

export interface ChatUiChip {
  readonly id: string;
  readonly text: string;
  readonly tone: ChatColorIntent;
  readonly isInteractive: boolean;
  readonly ariaLabel?: string;
}

export interface ChatUiCounter {
  readonly label: string;
  readonly value: string;
  readonly tone: ChatColorIntent;
  readonly deltaLabel?: string;
  readonly deltaTone?: ChatColorIntent;
}

export interface ChatUiIconSlot {
  readonly glyph: string;
  readonly title?: string;
  readonly tone: ChatColorIntent;
}

export interface ChatUiProgressBar {
  readonly current: number;
  readonly min: number;
  readonly max: number;
  readonly percentageLabel: string;
  readonly tone: ChatColorIntent;
  readonly direction?: ChatThreatDirection;
}

export interface ChatUiProofPill {
  readonly proofHash: ChatProofHash | string;
  readonly shortenedHash: string;
  readonly immutable: boolean;
  readonly isVerified: boolean;
  readonly explorerLabel?: string;
  readonly copyLabel?: string;
}

export interface ChatUiRichTextToken {
  readonly kind:
    | 'TEXT'
    | 'EMOJI'
    | 'MENTION'
    | 'COMMAND'
    | 'PROOF_HASH'
    | 'PRICE'
    | 'PERCENT'
    | 'BOT_NAME'
    | 'CHANNEL_LINK'
    | 'QUOTE';
  readonly raw: string;
  readonly rendered: string;
  readonly tone?: ChatColorIntent;
  readonly href?: string;
}

export interface ChatUiTextBlock {
  readonly raw: string;
  readonly plainText: string;
  readonly tokens: readonly ChatUiRichTextToken[];
  readonly lineClamp?: number;
  readonly preserveWhitespace?: boolean;
}

/**
 * ============================================================================
 * MARK: Presence and typing UI contracts
 * ============================================================================
 */

export type ChatPresenceStateTone = 'ONLINE' | 'AWAY' | 'READING' | 'LURKING' | 'OFFLINE';
export type ChatTypingStateTone =
  | 'IDLE'
  | 'STARTING'
  | 'TYPING'
  | 'PAUSED'
  | 'INTIMIDATING'
  | 'HELPER_WAIT';

export interface ChatPresenceAvatar {
  readonly userId?: ChatUserId | string;
  readonly senderId?: string;
  readonly label: string;
  readonly shortLabel: string;
  readonly avatarShape: ChatAvatarShape;
  readonly accentColor?: string;
  readonly imageUrl?: string;
  readonly isNpc: boolean;
  readonly isSelf: boolean;
  readonly statusTone: ChatPresenceStateTone;
}

export interface ChatPresenceEntryViewModel {
  readonly id: string;
  readonly avatar: ChatPresenceAvatar;
  readonly sender: Pick<
    ChatSenderIdentity,
    | 'actorKind'
    | 'senderRole'
    | 'senderName'
    | 'senderHandle'
    | 'senderRank'
    | 'isHuman'
    | 'isNpc'
    | 'isVerifiedSystemVoice'
  >;
  readonly presenceTone: ChatPresenceStateTone;
  readonly label: string;
  readonly sublabel?: string;
  readonly channel: ChatChannelId;
  readonly enteredAtMs?: UnixMs;
  readonly lastSeenAtMs?: UnixMs;
  readonly isMuted?: boolean;
  readonly isPinned?: boolean;
  readonly crowdWeight?: number;
  readonly tooltip?: string;
}

export interface ChatTypingIndicatorParticipant {
  readonly id: string;
  readonly senderName: string;
  readonly actorKind: ChatSenderIdentity['actorKind'];
  readonly tone: ChatTypingStateTone;
  readonly token?: string;
  readonly expiresAtMs?: UnixMs;
  readonly messageHint?: string;
}

export interface ChatTypingIndicatorViewModel {
  readonly participants: readonly ChatTypingIndicatorParticipant[];
  readonly compactLabel: string;
  readonly expandedLabel: string;
  readonly pulseIntensity: Score01 | number;
  readonly showDotWave: boolean;
  readonly showTheaterDelay: boolean;
  readonly zoneId: ChatUiZoneId;
}

export interface ChatPresenceStripProps {
  readonly entries: readonly ChatPresenceEntryViewModel[];
  readonly density: ChatRenderDensity;
  readonly isLoading?: boolean;
  readonly onEntryPressed?: (entry: ChatPresenceEntryViewModel) => void;
  readonly onOverflowPressed?: () => void;
  readonly maxVisible?: number;
  readonly emptyLabel?: string;
  readonly ariaLabel?: string;
  readonly className?: string;
  readonly style?: CSSProperties;
}

export interface ChatTypingIndicatorProps {
  readonly viewModel: ChatTypingIndicatorViewModel;
  readonly density: ChatRenderDensity;
  readonly align?: 'LEFT' | 'RIGHT' | 'CENTER';
  readonly className?: string;
  readonly style?: CSSProperties;
}

/**
 * ============================================================================
 * MARK: Channel tabs and room header contracts
 * ============================================================================
 */

export type ChatChannelLockReason =
  | 'MODE_RESTRICTED'
  | 'NEGOTIATION_ONLY'
  | 'NO_PERMISSION'
  | 'NOT_MOUNTED'
  | 'SHADOW_ONLY';

export interface ChatChannelMetricViewModel {
  readonly unreadCount: number;
  readonly mentionCount: number;
  readonly heat?: Score100 | number;
  readonly activePresenceCount?: number;
  readonly lastMessageAtMs?: UnixMs;
}

export interface ChatChannelTabViewModel {
  readonly channel: ChatVisibleChannel;
  readonly label: string;
  readonly shortLabel: string;
  readonly description?: string;
  readonly isActive: boolean;
  readonly isLocked: boolean;
  readonly lockReason?: ChatChannelLockReason;
  readonly metrics: ChatChannelMetricViewModel;
  readonly badges: readonly ChatUiBadge[];
  readonly tone: ChatHeaderStatusTone;
  readonly ariaLabel: string;
  readonly testId?: string;
}

export interface ChatChannelTabsProps {
  readonly tabs: readonly ChatChannelTabViewModel[];
  readonly density: ChatRenderDensity;
  readonly onSelect: (channel: ChatVisibleChannel) => void;
  readonly className?: string;
  readonly style?: CSSProperties;
}

export interface ChatRoomHeaderCounterGroup {
  readonly id: string;
  readonly counters: readonly ChatUiCounter[];
}

export interface ChatRoomHeaderTitleBlock {
  readonly title: string;
  readonly subtitle?: string;
  readonly kicker?: string;
  readonly tone: ChatHeaderStatusTone;
}

export interface ChatRoomHeaderViewModel {
  readonly roomId?: ChatRoomId | string;
  readonly channel: ChatVisibleChannel;
  readonly titleBlock: ChatRoomHeaderTitleBlock;
  readonly leftBadges: readonly ChatUiBadge[];
  readonly rightBadges: readonly ChatUiBadge[];
  readonly proofPill?: ChatUiProofPill;
  readonly counterGroups: readonly ChatRoomHeaderCounterGroup[];
  readonly showBackButton?: boolean;
  readonly showTranscriptButton?: boolean;
  readonly showMuteButton?: boolean;
  readonly statusLine?: string;
  readonly threatSnapshot?: string;
}

export interface ChatRoomHeaderProps {
  readonly viewModel: ChatRoomHeaderViewModel;
  readonly density: ChatRenderDensity;
  readonly onBack?: () => void;
  readonly onOpenTranscript?: () => void;
  readonly onToggleMute?: () => void;
  readonly className?: string;
  readonly style?: CSSProperties;
}

/**
 * ============================================================================
 * MARK: Message feed and grouping contracts
 * ============================================================================
 */

export type ChatMessageCardVariant =
  | 'PLAYER_SELF'
  | 'PLAYER_OTHER'
  | 'SYSTEM_NOTICE'
  | 'HATER_TAUNT'
  | 'HATER_ATTACK'
  | 'HELPER_PROMPT'
  | 'HELPER_RESCUE'
  | 'NEGOTIATION'
  | 'PROOF'
  | 'LEGEND'
  | 'CROWD'
  | 'POST_RUN'
  | 'AMBIENT';

export type ChatMessageCardEmphasis = 'LOW' | 'MID' | 'HIGH' | 'CINEMATIC';
export type ChatMessageReactivityTone = 'QUIET' | 'RESPONSIVE' | 'HOSTILE' | 'RECOVERY';

export interface ChatMessageMetaRow {
  readonly id: string;
  readonly leftLabel?: string;
  readonly rightLabel?: string;
  readonly tone: ChatColorIntent;
  readonly icon?: string;
}

export interface ChatMessageReactionPill {
  readonly id: string;
  readonly label: string;
  readonly tone: ChatColorIntent;
  readonly count?: number;
  readonly isActive?: boolean;
}

export interface ChatMessageAttachmentViewModel {
  readonly id: ChatAttachmentId | string;
  readonly kind: 'PROOF' | 'REPLAY' | 'QUOTE' | 'ALERT' | 'NEGOTIATION_OFFER';
  readonly label: string;
  readonly sublabel?: string;
  readonly tone: ChatColorIntent;
  readonly href?: string;
  readonly isImmutable?: boolean;
}

export interface ChatMessageThreatSnapshot {
  readonly level: Score100 | number;
  readonly label: string;
  readonly direction: ChatThreatDirection;
  readonly tone: ChatColorIntent;
}

export interface ChatMessageCardViewModel {
  readonly messageId: ChatMessageId | string;
  readonly listItemId: ChatListItemId | string;
  readonly variant: ChatMessageCardVariant;
  readonly kind: ChatMessageKind | LegacyMessageKind;
  readonly channel: ChatChannelId | LegacyChatChannel;
  readonly sender: ChatSenderIdentity;
  readonly actorLabel: string;
  readonly actorSubLabel?: string;
  readonly body: ChatUiTextBlock;
  readonly metaRows: readonly ChatMessageMetaRow[];
  readonly badges: readonly ChatUiBadge[];
  readonly reactions: readonly ChatMessageReactionPill[];
  readonly attachments: readonly ChatMessageAttachmentViewModel[];
  readonly proofPill?: ChatUiProofPill;
  readonly threatSnapshot?: ChatMessageThreatSnapshot;
  readonly emphasis: ChatMessageCardEmphasis;
  readonly reactivityTone: ChatMessageReactivityTone;
  readonly isOwnMessage: boolean;
  readonly isShadowDerived: boolean;
  readonly isMuted: boolean;
  readonly isHighlighted: boolean;
  readonly isInteractive: boolean;
  readonly tsLabel: string;
  readonly tsMs: UnixMs | number;
  readonly ariaLabel: string;
  readonly scrollAnchorKey: ChatVirtualKey | string;
  readonly animation?: ChatMotionIntent;
}

export interface ChatMessageGroupViewModel {
  readonly groupId: ChatMessageGroupId | string;
  readonly senderKey: string;
  readonly channel: ChatVisibleChannel | LegacyChatChannel;
  readonly messages: readonly ChatMessageCardViewModel[];
  readonly startsSequence: boolean;
  readonly endsSequence: boolean;
  readonly isCollapsedBySystem: boolean;
  readonly dayDividerLabel?: string;
  readonly showAvatar: boolean;
  readonly showSenderName: boolean;
  readonly showTimestampOnLastOnly: boolean;
}

export interface ChatFeedRangeState {
  readonly totalItems: number;
  readonly visibleRange: ChatRange;
  readonly overscanStart: number;
  readonly overscanEnd: number;
  readonly isAtBottom: boolean;
  readonly isNearBottom: boolean;
  readonly hasUnreadBelow: boolean;
}

export interface ChatScrollJumpState {
  readonly showJumpToLatest: boolean;
  readonly unreadBelowCount: number;
  readonly lastBottomAnchorTsMs?: UnixMs;
}

export interface ChatMessageFeedViewModel {
  readonly channel: ChatVisibleChannel;
  readonly transcriptMode: ChatTranscriptMode;
  readonly layout: ChatFeedLayout;
  readonly groups: readonly ChatMessageGroupViewModel[];
  readonly rangeState: ChatFeedRangeState;
  readonly jumpState: ChatScrollJumpState;
  readonly stickyDividerLabel?: string;
  readonly emptyState?: ChatEmptyStateViewModel;
}

export interface ChatMessageFeedProps {
  readonly viewModel: ChatMessageFeedViewModel;
  readonly density: ChatRenderDensity;
  readonly onMessagePressed?: (message: ChatMessageCardViewModel) => void;
  readonly onJumpToLatest?: () => void;
  readonly onLoadOlder?: () => void;
  readonly className?: string;
  readonly style?: CSSProperties;
}

export interface ChatMessageCardProps {
  readonly message: ChatMessageCardViewModel;
  readonly density: ChatRenderDensity;
  readonly onPress?: (message: ChatMessageCardViewModel) => void;
  readonly onAttachmentPress?: (attachment: ChatMessageAttachmentViewModel) => void;
  readonly onReactionPress?: (reaction: ChatMessageReactionPill) => void;
  readonly className?: string;
  readonly style?: CSSProperties;
}

/**
 * ============================================================================
 * MARK: Composer contracts
 * ============================================================================
 */

export type ChatComposerSendIntent =
  | 'MESSAGE'
  | 'NEGOTIATION_COUNTER'
  | 'HELP_ACK'
  | 'EMOTE'
  | 'COMMAND';

export type ChatComposerValidationState =
  | 'IDLE'
  | 'VALID'
  | 'EMPTY'
  | 'TOO_LONG'
  | 'CHANNEL_LOCKED'
  | 'RATE_LIMITED'
  | 'POLICY_BLOCKED';

export interface ChatComposerDraftViewModel {
  readonly draftId: ChatComposerDraftId | string;
  readonly channel: ChatVisibleChannel;
  readonly value: string;
  readonly charCount: number;
  readonly maxChars: number;
  readonly remainingChars: number;
  readonly placeholder: string;
  readonly validationState: ChatComposerValidationState;
  readonly validationMessage?: string;
  readonly sendIntent: ChatComposerSendIntent;
  readonly isSending: boolean;
  readonly isDisabled: boolean;
  readonly canSend: boolean;
  readonly showCharCounter: boolean;
  readonly showCommandHint: boolean;
}

export interface ChatComposerQuickAction {
  readonly id: string;
  readonly label: string;
  readonly icon?: string;
  readonly tone: ChatColorIntent;
  readonly insertsText?: string;
  readonly ariaLabel?: string;
}

export interface ChatComposerProps {
  readonly draft: ChatComposerDraftViewModel;
  readonly density: ChatRenderDensity;
  readonly quickActions?: readonly ChatComposerQuickAction[];
  readonly onChange: (nextValue: string) => void;
  readonly onSend: () => void;
  readonly onCancel?: () => void;
  readonly onQuickActionPress?: (action: ChatComposerQuickAction) => void;
  readonly inputRef?: RefObject<HTMLTextAreaElement>;
  readonly className?: string;
  readonly style?: CSSProperties;
}

/**
 * ============================================================================
 * MARK: Invasion, threat, rescue, and helper prompt contracts
 * ============================================================================
 */

export type ChatInvasionTone = 'WARNING' | 'CRITICAL' | 'PREDATORY' | 'CEREMONIAL';

export interface ChatInvasionBannerViewModel {
  readonly momentId?: ChatMomentId | string;
  readonly sceneId?: ChatSceneId | string;
  readonly title: string;
  readonly body: string;
  readonly tone: ChatInvasionTone;
  readonly icon?: string;
  readonly countdownLabel?: string;
  readonly countdownEndsAtMs?: UnixMs;
  readonly actorLabel?: string;
  readonly badges: readonly ChatUiBadge[];
  readonly showDismiss: boolean;
}

export interface ChatThreatMeterViewModel {
  readonly current: Score100 | number;
  readonly previous?: Score100 | number;
  readonly direction: ChatThreatDirection;
  readonly label: string;
  readonly subtitle?: string;
  readonly tone: ChatColorIntent;
  readonly segments?: readonly ChatUiBadge[];
  readonly progress: ChatUiProgressBar;
}

export interface ChatHelperPromptAction {
  readonly id: string;
  readonly label: string;
  readonly tone: ChatColorIntent;
  readonly icon?: string;
  readonly kind: 'ACCEPT' | 'DISMISS' | 'DEFER' | 'OPEN_RESCUE' | 'REQUEST_MORE';
}

export interface ChatHelperPromptViewModel {
  readonly promptId: ChatPromptId | string;
  readonly severity: ChatPromptSeverity;
  readonly helperName: string;
  readonly title: string;
  readonly body: string;
  readonly contextLabel?: string;
  readonly suggestedMove?: string;
  readonly actions: readonly ChatHelperPromptAction[];
  readonly expiresAtMs?: UnixMs;
  readonly isPinned: boolean;
  readonly isUrgent: boolean;
  readonly tone: ChatColorIntent;
}

export interface ChatCollapsedPillViewModel {
  readonly unreadCount: number;
  readonly mentionCount: number;
  readonly activeChannel: ChatVisibleChannel;
  readonly label: string;
  readonly statusLine?: string;
  readonly dangerPulse: boolean;
  readonly helperWaiting: boolean;
  readonly threatLabel?: string;
}

export interface ChatInvasionBannerProps {
  readonly viewModel: ChatInvasionBannerViewModel;
  readonly density: ChatRenderDensity;
  readonly onDismiss?: () => void;
  readonly className?: string;
  readonly style?: CSSProperties;
}

export interface ChatThreatMeterProps {
  readonly viewModel: ChatThreatMeterViewModel;
  readonly density: ChatRenderDensity;
  readonly className?: string;
  readonly style?: CSSProperties;
}

export interface ChatHelperPromptProps {
  readonly viewModel: ChatHelperPromptViewModel;
  readonly density: ChatRenderDensity;
  readonly onAction: (action: ChatHelperPromptAction) => void;
  readonly className?: string;
  readonly style?: CSSProperties;
}

export interface ChatCollapsedPillProps {
  readonly viewModel: ChatCollapsedPillViewModel;
  readonly density: ChatRenderDensity;
  readonly onExpand: () => void;
  readonly className?: string;
  readonly style?: CSSProperties;
}

/**
 * ============================================================================
 * MARK: Transcript drawer and replay contracts
 * ============================================================================
 */

export interface ChatTranscriptEntryViewModel {
  readonly entryId: string;
  readonly messageId?: ChatMessageId | string;
  readonly title: string;
  readonly subtitle?: string;
  readonly bodyPreview?: string;
  readonly tsLabel: string;
  readonly tone: ChatColorIntent;
  readonly proofPill?: ChatUiProofPill;
  readonly tags: readonly ChatUiChip[];
}

export interface ChatTranscriptSummaryViewModel {
  readonly totalMessages: number;
  readonly totalParticipants: number;
  readonly proofCount: number;
  readonly legendCount: number;
  readonly firstTsLabel?: string;
  readonly latestTsLabel?: string;
}

export interface ChatReplayStateViewModel {
  readonly isReplayMode: boolean;
  readonly currentIndex: number;
  readonly totalFrames: number;
  readonly cursorId?: ChatReplayCursorId | string;
  readonly statusLabel: string;
}

export interface ChatTranscriptDrawerViewModel {
  readonly mode: ChatTranscriptMode;
  readonly activeTab: ChatDrawerTab;
  readonly tabs: readonly ChatUiChip[];
  readonly entries: readonly ChatTranscriptEntryViewModel[];
  readonly summary: ChatTranscriptSummaryViewModel;
  readonly replay: ChatReplayStateViewModel;
  readonly searchQuery?: string;
  readonly isOpen: boolean;
}

export interface ChatTranscriptDrawerProps {
  readonly viewModel: ChatTranscriptDrawerViewModel;
  readonly density: ChatRenderDensity;
  readonly onClose: () => void;
  readonly onSelectTab?: (tab: ChatDrawerTab) => void;
  readonly onSearchChange?: (value: string) => void;
  readonly onEntryPress?: (entry: ChatTranscriptEntryViewModel) => void;
  readonly className?: string;
  readonly style?: CSSProperties;
}

/**
 * ============================================================================
 * MARK: Empty state and no-content contracts
 * ============================================================================
 */

export interface ChatEmptyStateAction {
  readonly id: string;
  readonly label: string;
  readonly tone: ChatColorIntent;
  readonly icon?: string;
  readonly kind: 'PRIMARY' | 'SECONDARY' | 'DISMISS';
}

export interface ChatEmptyStateViewModel {
  readonly kind: ChatEmptyStateKind;
  readonly title: string;
  readonly body: string;
  readonly illustration?: string;
  readonly tone: ChatColorIntent;
  readonly actions: readonly ChatEmptyStateAction[];
}

export interface ChatEmptyStateProps {
  readonly viewModel: ChatEmptyStateViewModel;
  readonly density: ChatRenderDensity;
  readonly onAction?: (action: ChatEmptyStateAction) => void;
  readonly className?: string;
  readonly style?: CSSProperties;
}

/**
 * ============================================================================
 * MARK: Unified dock composition contracts
 * ============================================================================
 */

export interface UnifiedChatDockSections {
  readonly header: ChatRoomHeaderViewModel;
  readonly channels: readonly ChatChannelTabViewModel[];
  readonly presence?: readonly ChatPresenceEntryViewModel[];
  readonly typing?: ChatTypingIndicatorViewModel;
  readonly invasionBanner?: ChatInvasionBannerViewModel;
  readonly threatMeter?: ChatThreatMeterViewModel;
  readonly helperPrompt?: ChatHelperPromptViewModel;
  readonly feed: ChatMessageFeedViewModel;
  readonly composer?: ChatComposerDraftViewModel;
  readonly collapsedPill?: ChatCollapsedPillViewModel;
  readonly transcriptDrawer?: ChatTranscriptDrawerViewModel;
}

export interface UnifiedChatDockViewModel {
  readonly mountTarget: ChatMountTarget;
  readonly preset: ChatMountPreset;
  readonly surfaceId: ChatSurfaceId | string;
  readonly roomId?: ChatRoomId | string;
  readonly sessionId?: ChatSessionId | string;
  readonly density: ChatRenderDensity;
  readonly mode: ChatTranscriptMode;
  readonly isCollapsed: boolean;
  readonly canCollapse: boolean;
  readonly isTranscriptOpen: boolean;
  readonly isOffline: boolean;
  readonly sections: UnifiedChatDockSections;
}

export interface UnifiedChatDockActions {
  readonly selectChannel: (channel: ChatVisibleChannel) => void;
  readonly changeDraft: (value: string) => void;
  readonly sendDraft: () => void;
  readonly cancelDraft?: () => void;
  readonly toggleCollapsed: () => void;
  readonly openTranscript: () => void;
  readonly closeTranscript: () => void;
  readonly jumpToLatest: () => void;
  readonly acknowledgeHelperPrompt?: (actionId: string) => void;
  readonly dismissInvasionBanner?: () => void;
}

export interface UnifiedChatDockProps {
  readonly viewModel: UnifiedChatDockViewModel;
  readonly actions: UnifiedChatDockActions;
  readonly className?: string;
  readonly style?: CSSProperties;
}

/**
 * ============================================================================
 * MARK: useUnifiedChat hook contracts
 * ============================================================================
 */

export interface UseUnifiedChatInput {
  readonly mountTarget: ChatMountTarget;
  readonly preferredChannel?: ChatVisibleChannel;
  readonly autoFocusComposer?: boolean;
  readonly legacyMigrationFlags?: Partial<LegacyChatMigrationFlags>;
}

export interface UseUnifiedChatDiagnostics {
  readonly loadedAtMs: UnixMs | number;
  readonly renderDensity: ChatRenderDensity;
  readonly currentCursorMode: ChatCursorMode;
  readonly transcriptMode: ChatTranscriptMode;
  readonly usingLegacyCompatibility: boolean;
  readonly messageCount: number;
  readonly activeChannel: ChatVisibleChannel;
  readonly surfaceId: ChatSurfaceId | string;
}

export interface UseUnifiedChatResult {
  readonly viewModel: UnifiedChatDockViewModel;
  readonly actions: UnifiedChatDockActions;
  readonly diagnostics: UseUnifiedChatDiagnostics;
  readonly refs: {
    readonly rootRef: MutableRefObject<HTMLDivElement | null>;
    readonly composerRef: MutableRefObject<HTMLTextAreaElement | null>;
    readonly scrollRef: MutableRefObject<HTMLDivElement | null>;
  };
}

/**
 * ============================================================================
 * MARK: Accessibility, focus, and keyboard contracts
 * ============================================================================
 */

export interface ChatAccessibilityLabels {
  readonly root: string;
  readonly header: string;
  readonly channels: string;
  readonly feed: string;
  readonly composer: string;
  readonly presence: string;
  readonly transcriptDrawer: string;
  readonly collapsedPill: string;
}

export interface ChatFocusTarget {
  readonly id: ChatAccessibilityId | string;
  readonly zone: ChatUiZoneId;
  readonly order: number;
  readonly isInteractive: boolean;
}

export interface ChatKeyboardCommand {
  readonly id: ChatKeyboardCommandId;
  readonly label: string;
  readonly key: string;
  readonly shiftKey?: boolean;
  readonly metaKey?: boolean;
  readonly ctrlKey?: boolean;
  readonly altKey?: boolean;
  readonly preventDefault: boolean;
}

export interface ChatKeyboardMap {
  readonly commands: readonly ChatKeyboardCommand[];
  readonly byId: Readonly<Record<ChatKeyboardCommandId, ChatKeyboardCommand>>;
}

export const CHAT_KEYBOARD_MAP: Readonly<ChatKeyboardMap> = Object.freeze({
  commands: [
    { id: 'TOGGLE_DOCK', label: 'Toggle chat dock', key: 'k', metaKey: true, preventDefault: true },
    { id: 'FOCUS_COMPOSER', label: 'Focus composer', key: '/', preventDefault: true },
    { id: 'NEXT_CHANNEL', label: 'Next channel', key: 'ArrowRight', altKey: true, preventDefault: true },
    { id: 'PREV_CHANNEL', label: 'Previous channel', key: 'ArrowLeft', altKey: true, preventDefault: true },
    { id: 'OPEN_TRANSCRIPT', label: 'Open transcript drawer', key: 't', altKey: true, preventDefault: true },
    { id: 'SCROLL_TO_LATEST', label: 'Scroll to latest', key: 'End', preventDefault: false },
    { id: 'SEND_MESSAGE', label: 'Send draft', key: 'Enter', metaKey: true, preventDefault: true },
    { id: 'CANCEL_DRAFT', label: 'Cancel draft', key: 'Escape', preventDefault: false },
    { id: 'TOGGLE_MUTE', label: 'Toggle mute', key: 'm', altKey: true, preventDefault: true },
  ],
  byId: {
    TOGGLE_DOCK: { id: 'TOGGLE_DOCK', label: 'Toggle chat dock', key: 'k', metaKey: true, preventDefault: true },
    FOCUS_COMPOSER: { id: 'FOCUS_COMPOSER', label: 'Focus composer', key: '/', preventDefault: true },
    NEXT_CHANNEL: { id: 'NEXT_CHANNEL', label: 'Next channel', key: 'ArrowRight', altKey: true, preventDefault: true },
    PREV_CHANNEL: { id: 'PREV_CHANNEL', label: 'Previous channel', key: 'ArrowLeft', altKey: true, preventDefault: true },
    OPEN_TRANSCRIPT: { id: 'OPEN_TRANSCRIPT', label: 'Open transcript drawer', key: 't', altKey: true, preventDefault: true },
    SCROLL_TO_LATEST: { id: 'SCROLL_TO_LATEST', label: 'Scroll to latest', key: 'End', preventDefault: false },
    SEND_MESSAGE: { id: 'SEND_MESSAGE', label: 'Send draft', key: 'Enter', metaKey: true, preventDefault: true },
    CANCEL_DRAFT: { id: 'CANCEL_DRAFT', label: 'Cancel draft', key: 'Escape', preventDefault: false },
    TOGGLE_MUTE: { id: 'TOGGLE_MUTE', label: 'Toggle mute', key: 'm', altKey: true, preventDefault: true },
  },
});

/**
 * ============================================================================
 * MARK: Virtualization and performance contracts
 * ============================================================================
 */

export interface ChatVirtualizationEstimate {
  readonly averageRowHeight: CssPixel;
  readonly overscanRows: number;
  readonly windowRows: number;
  readonly stickyHeaderHeight: CssPixel;
  readonly bottomComposerHeight: CssPixel;
}

export interface ChatVirtualRowDescriptor {
  readonly key: ChatVirtualKey | string;
  readonly index: number;
  readonly offsetTop: CssPixel | number;
  readonly estimatedHeight: CssPixel | number;
  readonly actualHeight?: CssPixel | number;
  readonly kind: 'MESSAGE_GROUP' | 'DAY_DIVIDER' | 'EMPTY_STATE';
}

export interface ChatFeedPerformanceBudget {
  readonly maxRenderedGroups: number;
  readonly maxBadgesPerMessage: number;
  readonly maxTokensPerMessage: number;
  readonly preferReducedMotion: boolean;
  readonly disableHeavyGlowEffects: boolean;
}

export const CHAT_UI_PERFORMANCE_BUDGET_DEFAULT: Readonly<ChatFeedPerformanceBudget> =
  Object.freeze({
    maxRenderedGroups: 120,
    maxBadgesPerMessage: 8,
    maxTokensPerMessage: 256,
    preferReducedMotion: false,
    disableHeavyGlowEffects: false,
  });

/**
 * ============================================================================
 * MARK: Telemetry and UI instrumentation contracts
 * ============================================================================
 */

export type ChatUiTelemetryEventName =
  | 'chat_ui_rendered'
  | 'chat_channel_switched'
  | 'chat_message_clicked'
  | 'chat_composer_sent'
  | 'chat_transcript_opened'
  | 'chat_transcript_closed'
  | 'chat_collapsed'
  | 'chat_expanded'
  | 'chat_helper_action_taken'
  | 'chat_jump_to_latest';

export interface ChatUiTelemetryPayload {
  readonly eventId: ChatTelemetryUiId | string;
  readonly name: ChatUiTelemetryEventName;
  readonly surfaceId: ChatSurfaceId | string;
  readonly mountTarget: ChatMountTarget;
  readonly channel?: ChatVisibleChannel;
  readonly messageId?: ChatMessageId | string;
  readonly tsMs: UnixMs | number;
  readonly extra?: ChatRecord<unknown>;
}

/**
 * ============================================================================
 * MARK: Formatting helpers
 * ============================================================================
 */

export interface ChatFormattingHelpers {
  readonly formatThreatScore: (score: number) => string;
  readonly formatRelativeTime: (tsMs: number) => string;
  readonly formatCompactCount: (count: number) => string;
  readonly formatProofHash: (hash: string) => string;
  readonly buildActorLabel: (sender: Pick<ChatSenderIdentity, 'senderName' | 'senderHandle'>) => string;
}

export const CHAT_UI_FORMATTERS: Readonly<ChatFormattingHelpers> = Object.freeze({
  formatThreatScore(score: number): string {
    if (!Number.isFinite(score)) return '0';
    const clamped = Math.max(0, Math.min(100, Math.round(score)));
    return `${clamped}`;
  },
  formatRelativeTime(tsMs: number): string {
    if (!Number.isFinite(tsMs)) return 'unknown';
    const delta = Math.max(0, Date.now() - tsMs);
    if (delta < 5_000) return 'now';
    if (delta < 60_000) return `${Math.floor(delta / 1000)}s`;
    if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m`;
    if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h`;
    return `${Math.floor(delta / 86_400_000)}d`;
  },
  formatCompactCount(count: number): string {
    if (!Number.isFinite(count) || count <= 0) return '0';
    if (count < 1_000) return `${count}`;
    if (count < 1_000_000) return `${(count / 1_000).toFixed(count >= 10_000 ? 0 : 1)}k`;
    return `${(count / 1_000_000).toFixed(count >= 10_000_000 ? 0 : 1)}m`;
  },
  formatProofHash(hash: string): string {
    if (!hash) return '—';
    if (hash.length <= 14) return hash;
    return `${hash.slice(0, 8)}…${hash.slice(-4)}`;
  },
  buildActorLabel(sender): string {
    return sender.senderHandle ? `${sender.senderName} @${sender.senderHandle}` : sender.senderName;
  },
});

/**
 * ============================================================================
 * MARK: Presentation style presets by mount target
 * ============================================================================
 */

export interface ChatMountVisualPreset {
  readonly mountTarget: ChatMountTarget;
  readonly density: ChatRenderDensity;
  readonly headerTone: ChatHeaderStatusTone;
  readonly feedLayout: ChatFeedLayout;
  readonly allowGlass: boolean;
  readonly showGlow: boolean;
  readonly accentIntent: ChatColorIntent;
}

export const CHAT_MOUNT_VISUAL_PRESETS: Readonly<Record<ChatMountTarget, ChatMountVisualPreset>> =
  Object.freeze({
    BATTLE_HUD: {
      mountTarget: 'BATTLE_HUD',
      density: 'STANDARD',
      headerTone: 'HOSTILE',
      feedLayout: 'STACK',
      allowGlass: true,
      showGlow: true,
      accentIntent: 'DANGER',
    },
    CLUB_UI: {
      mountTarget: 'CLUB_UI',
      density: 'COMPACT',
      headerTone: 'ACTIVE',
      feedLayout: 'GROUPED',
      allowGlass: true,
      showGlow: false,
      accentIntent: 'DEFAULT',
    },
    EMPIRE_GAME_SCREEN: {
      mountTarget: 'EMPIRE_GAME_SCREEN',
      density: 'STANDARD',
      headerTone: 'TENSE',
      feedLayout: 'GROUPED',
      allowGlass: true,
      showGlow: true,
      accentIntent: 'NEGOTIATION',
    },
    GAME_BOARD: {
      mountTarget: 'GAME_BOARD',
      density: 'STANDARD',
      headerTone: 'TENSE',
      feedLayout: 'STACK',
      allowGlass: true,
      showGlow: true,
      accentIntent: 'DEFAULT',
    },
    LEAGUE_UI: {
      mountTarget: 'LEAGUE_UI',
      density: 'COMPACT',
      headerTone: 'ACTIVE',
      feedLayout: 'GROUPED',
      allowGlass: true,
      showGlow: false,
      accentIntent: 'PROOF',
    },
    LOBBY_SCREEN: {
      mountTarget: 'LOBBY_SCREEN',
      density: 'STANDARD',
      headerTone: 'QUIET',
      feedLayout: 'STACK',
      allowGlass: true,
      showGlow: false,
      accentIntent: 'DEFAULT',
    },
    PHANTOM_GAME_SCREEN: {
      mountTarget: 'PHANTOM_GAME_SCREEN',
      density: 'STANDARD',
      headerTone: 'HOSTILE',
      feedLayout: 'STACK',
      allowGlass: true,
      showGlow: true,
      accentIntent: 'HATER',
    },
    PREDATOR_GAME_SCREEN: {
      mountTarget: 'PREDATOR_GAME_SCREEN',
      density: 'STANDARD',
      headerTone: 'NEGOTIATION',
      feedLayout: 'GROUPED',
      allowGlass: true,
      showGlow: true,
      accentIntent: 'NEGOTIATION',
    },
    SYNDICATE_GAME_SCREEN: {
      mountTarget: 'SYNDICATE_GAME_SCREEN',
      density: 'EXPANDED',
      headerTone: 'ACTIVE',
      feedLayout: 'GROUPED',
      allowGlass: true,
      showGlow: true,
      accentIntent: 'HELPER',
    },
    POST_RUN_SUMMARY: {
      mountTarget: 'POST_RUN_SUMMARY',
      density: 'EXPANDED',
      headerTone: 'RECOVERY',
      feedLayout: 'REPLAY_TAPE',
      allowGlass: false,
      showGlow: true,
      accentIntent: 'LEGEND',
    },
  });

/**
 * ============================================================================
 * MARK: Sabotage, threat, and legacy derivation helpers
 * ============================================================================
 */

export interface ChatThreatDerivationInput {
  readonly latestSabotage?: LegacySabotageEvent | null;
  readonly latestExplicitThreat?: number | null;
  readonly unreadHaterCount?: number;
  readonly activeHaterMessageCount?: number;
}

export interface ChatThreatDerivationOutput {
  readonly value: number;
  readonly direction: ChatThreatDirection;
  readonly tone: ChatColorIntent;
  readonly label: string;
}

export function deriveThreatSnapshot(
  input: ChatThreatDerivationInput,
): ChatThreatDerivationOutput {
  const sabotageIntensity = input.latestSabotage?.intensity ?? 0;
  const explicitThreat = input.latestExplicitThreat ?? 0;
  const unreadHaters = Math.max(0, input.unreadHaterCount ?? 0) * 4;
  const activeHaters = Math.max(0, input.activeHaterMessageCount ?? 0) * 3;
  const value = Math.max(
    0,
    Math.min(100, Math.round(explicitThreat + sabotageIntensity + unreadHaters + activeHaters)),
  );

  if (value >= 85) {
    return {
      value,
      direction: 'SPIKING',
      tone: 'DANGER',
      label: 'Critical threat',
    };
  }
  if (value >= 60) {
    return {
      value,
      direction: 'RISING',
      tone: 'WARNING',
      label: 'Escalating threat',
    };
  }
  if (value >= 35) {
    return {
      value,
      direction: 'STABLE',
      tone: 'DEFAULT',
      label: 'Measured pressure',
    };
  }
  return {
    value,
    direction: 'FALLING',
    tone: 'SUCCESS',
    label: 'Low threat',
  };
}

/**
 * ============================================================================
 * MARK: Public exports for migration ergonomics
 * ============================================================================
 */

export type ChatUiMessage = ChatMessageCardViewModel;
export type ChatUiMessageGroup = ChatMessageGroupViewModel;
export type ChatUiHeader = ChatRoomHeaderViewModel;
export type ChatUiChannelTab = ChatChannelTabViewModel;
export type ChatUiDock = UnifiedChatDockViewModel;
export type ChatUiHookResult = UseUnifiedChatResult;
