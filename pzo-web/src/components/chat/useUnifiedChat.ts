import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CHAT_TYPES_RUNTIME_BUNDLE,
  buildChannelSummaries,
  buildTranscriptSearchResult,
  createEmptyGameChatContext,
  extractThreatSnapshot,
  normalizeGameChatContext,
  sortMessagesForRender,
  type ChatChannel,
  type ChatMessage,
  type ChatThreatSnapshot,
  type ChatTranscriptSearchResult,
  type GameChatContext,
  type SabotageEvent,
} from './chatTypes';
import { useChatEngine } from './useChatEngine';
import { buildTranscriptDrawerSurfaceModel, createTranscriptDrawerCallbacks } from './transcriptDrawerAdapter';
import { buildMessageFeedSurfaceModel } from './messageFeedSurfaceBuilder';
import { buildChannelTabViewModels } from './channelTabsSurfaceBuilder';
import { buildPresenceStripViewModel, buildTypingClusterViewModel } from './presenceTypingSurfaceBuilder';
import type {
  ChannelTabsViewModel,
  ChatUiTranscriptDrawerCallbacks,
  ChatUiTranscriptDrawerSurfaceModel,
  MessageCardActionViewModel,
  MessageFeedViewModel,
  PresenceStripViewModel,
  TypingClusterViewModel,
} from './uiTypes';

/**
 * ============================================================================
 * POINT ZERO ONE — UNIFIED CHAT UI HOOK
 * FILE: pzo-web/src/components/chat/useUnifiedChat.ts
 * ============================================================================
 */

export const USE_UNIFIED_CHAT_FILE_PATH = 'pzo-web/src/components/chat/useUnifiedChat.ts' as const;
export const USE_UNIFIED_CHAT_VERSION = '2026.03.15' as const;
export const USE_UNIFIED_CHAT_REVISION = 'pzo.components.chat.useUnifiedChat.v2' as const;
export const USE_UNIFIED_CHAT_RUNTIME_LAWS = Object.freeze([
  'This hook owns UI-shell state only; chat truth remains outside the component lane.',
  'This hook may compose the legacy compatibility hook during migration, but it must never become a second engine.',
  'Drafts, transcript drawer state, search, selection, pinning, and shell-open posture are legitimate UI concerns here.',
  'Threat, helper, presence, and channel summaries returned here are render-safe mirrors rather than durable truth claims.',
  'Shared contract law comes from shared/contracts/chat and is exposed through chatTypes.ts.',
  'The hook must stay backward-compatible with the current mounted chat surfaces while progressively shrinking legacy dependencies.',
] as const);
export const USE_UNIFIED_CHAT_RUNTIME_BUNDLE = Object.freeze({
  filePath: USE_UNIFIED_CHAT_FILE_PATH,
  version: USE_UNIFIED_CHAT_VERSION,
  revision: USE_UNIFIED_CHAT_REVISION,
  laws: USE_UNIFIED_CHAT_RUNTIME_LAWS,
  inheritedChatTypesBundle: CHAT_TYPES_RUNTIME_BUNDLE,
});

export interface UnifiedChatDiagnostics {
  readonly normalizedContext: GameChatContext;
  readonly sortedMessageCount: number;
  readonly searchMatchCount: number;
  readonly threatSnapshot: ChatThreatSnapshot;
  readonly transcriptSearchResult: ChatTranscriptSearchResult;
}

export interface UnifiedChatMountState {
  readonly mountTarget: string;
  readonly modeScope: string;
  readonly storageNamespace: string;
}

const STORAGE_PREFIX = 'pzo_unified_chat';
const MAX_HELPER_SCAN = 32;
const MAX_THREAT_SCAN = 48;
const MAX_RECENT_PEERS = 24;
const MAX_DRAFT_CHARS = 1200;

export type UnifiedChatConnectionState = 'CONNECTED' | 'CONNECTING' | 'DEGRADED' | 'DISCONNECTED';
export type UnifiedChatShellMode = 'DOCK' | 'DRAWER';

export interface UnifiedChatChannelSummary {
  channel: ChatChannel;
  label: string;
  emoji: string;
  unread: number;
  totalMessages: number;
  visibleMessages: number;
  latestTs: number | null;
  latestPreview: string;
  latestSenderName: string | null;
  hasPlayerActivity: boolean;
  hasProofBearingMessage: boolean;
  hasThreatActivity: boolean;
  canCompose: boolean;
}

export interface UnifiedChatThreatSummary {
  score: number;
  tier: 'CALM' | 'WATCH' | 'HIGH' | 'CRITICAL';
  label: string;
  reasons: string[];
  latestThreatMessageId: string | null;
}

export interface UnifiedChatHelperPrompt {
  id: string;
  title: string;
  body: string;
  severity: 'INFO' | 'GUIDE' | 'WARNING' | 'CRITICAL';
  sourceMessageId?: string;
  ctaLabel?: string;
  suggestedReply?: string;
}

export interface UnifiedChatPresencePreview {
  onlineCount: number;
  activeMembers: number;
  typingCount: number;
  recentPeerNames: string[];
  recentRanks: string[];
}

export interface UnifiedChatTranscriptState {
  open: boolean;
  searchQuery: string;
  selectedMessageId: string | null;
  newestFirst: boolean;
}

export interface UnifiedChatComposerState {
  activeDraft: string;
  charCount: number;
  maxChars: number;
  canSend: boolean;
  isNearLimit: boolean;
  placeholder: string;
}

export interface UseUnifiedChatOptions {
  ctx: GameChatContext;
  accessToken?: string | null;
  shellMode?: UnifiedChatShellMode;
  initialChannel?: ChatChannel;
  initialOpen?: boolean;
  initialCollapsed?: boolean;
  initialTranscriptOpen?: boolean;
  initialTranscriptSearch?: string;
  persistUiState?: boolean;
  persistDrafts?: boolean;
  storageNamespace?: string;
  onSabotage?: (event: SabotageEvent) => void;
}

export interface UseUnifiedChatResult {
  shellMode: UnifiedChatShellMode;
  connected: boolean;
  connectionState: UnifiedChatConnectionState;
  chatOpen: boolean;
  collapsed: boolean;
  isPinned: boolean;
  activeChannel: ChatChannel;
  activeSummary: UnifiedChatChannelSummary;
  channels: UnifiedChatChannelSummary[];
  allMessages: ChatMessage[];
  visibleMessages: ChatMessage[];
  recentMessages: ChatMessage[];
  unread: Record<ChatChannel, number>;
  totalUnread: number;
  threat: UnifiedChatThreatSummary;
  helperPrompt: UnifiedChatHelperPrompt | null;
  presence: UnifiedChatPresencePreview;
  transcript: UnifiedChatTranscriptState;
  transcriptDrawerModel: ChatUiTranscriptDrawerSurfaceModel;
  transcriptDrawerCallbacks: ChatUiTranscriptDrawerCallbacks;
  presenceStripModel: PresenceStripViewModel;
  typingIndicatorModel: TypingClusterViewModel;
  channelTabs: ChannelTabsViewModel;
  messageFeedModel: MessageFeedViewModel;
  messageFeedActionsByMessageId: Record<string, readonly MessageCardActionViewModel[]>;
  composer: UnifiedChatComposerState;
  latestMessage: ChatMessage | null;
  latestPlayerMessage: ChatMessage | null;
  latestSystemMessage: ChatMessage | null;
  latestThreatMessage: ChatMessage | null;
  transcriptLocked: boolean;
  emptyStateMode: 'IDLE' | 'DISCONNECTED' | 'FILTERED' | 'DEAL_WAITING' | 'THREAT' | 'COLLAPSED';
  sendDraft: () => void;
  setActiveChannel: (channel: ChatChannel) => void;
  setDraft: (next: string) => void;
  appendDraft: (suffix: string) => void;
  clearDraft: () => void;
  openChat: () => void;
  closeChat: () => void;
  toggleChat: () => void;
  collapse: () => void;
  expand: () => void;
  toggleCollapsed: () => void;
  pin: () => void;
  unpin: () => void;
  togglePinned: () => void;
  openTranscript: () => void;
  closeTranscript: () => void;
  toggleTranscript: () => void;
  setTranscriptSearchQuery: (query: string) => void;
  selectTranscriptMessage: (messageId: string | null) => void;
  jumpToLatest: () => void;
  quickReply: (reply: string) => void;
  dismissHelperPrompt: () => void;
  reopenHelperPrompt: () => void;
  resetUi: () => void;
  diagnostics: UnifiedChatDiagnostics;
  mountState: UnifiedChatMountState;
  runtimeBundle: typeof USE_UNIFIED_CHAT_RUNTIME_BUNDLE;
}

type PersistedUiSnapshot = {
  collapsed: boolean;
  pinned: boolean;
  transcriptOpen: boolean;
  transcriptSearch: string;
  activeChannel: ChatChannel;
};

type PersistedDraftSnapshot = Record<ChatChannel, string>;

const CHANNEL_META: Record<ChatChannel, { label: string; emoji: string; canCompose: boolean; placeholder: string }> = {
  GLOBAL: { label: 'Global', emoji: '🌐', canCompose: true, placeholder: 'Broadcast into the public lane…' },
  SYNDICATE: { label: 'Syndicate', emoji: '🏛️', canCompose: true, placeholder: 'Coordinate with your alliance…' },
  DEAL_ROOM: { label: 'Deal Room', emoji: '⚡', canCompose: true, placeholder: 'State your offer, counter, or recap…' },
};

function safeWindow(): Window | null {
  return typeof window === 'undefined' ? null : window;
}

function safeReadStorage<T>(key: string, fallback: T): T {
  try {
    const win = safeWindow();
    if (!win) return fallback;
    const raw = win.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWriteStorage<T>(key: string, value: T): void {
  try {
    const win = safeWindow();
    if (!win) return;
    win.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // optional persistence only
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function compactPreview(body: string, max = 96): string {
  const trimmed = body.replace(/\s+/g, ' ').trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

function latestBy<T extends ChatMessage>(messages: readonly T[], predicate?: (msg: T) => boolean): T | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const candidate = messages[i];
    if (!predicate || predicate(candidate)) return candidate;
  }
  return null;
}

function uniquePush(list: string[], next: string, limit: number): string[] {
  if (!next.trim()) return list;
  if (list.includes(next)) return list;
  const combined = [...list, next];
  return combined.slice(-limit);
}

function connectionStateFromFlags(
  connected: boolean,
  messages: readonly ChatMessage[],
  ctx: GameChatContext,
): UnifiedChatConnectionState {
  if (connected) return 'CONNECTED';
  if (ctx.tick <= 3 && messages.length === 0) return 'CONNECTING';
  if (messages.length > 0) return 'DEGRADED';
  return 'DISCONNECTED';
}


function toChannelTabsConnectionState(
  state: UnifiedChatConnectionState,
): 'ONLINE' | 'CONNECTING' | 'DEGRADED' | 'OFFLINE' {
  switch (state) {
    case 'CONNECTED':
      return 'ONLINE';
    case 'CONNECTING':
      return 'CONNECTING';
    case 'DEGRADED':
      return 'DEGRADED';
    case 'DISCONNECTED':
    default:
      return 'OFFLINE';
  }
}

function scoreThreat(messages: readonly ChatMessage[], ctx: GameChatContext): UnifiedChatThreatSummary {
  let score = clamp(ctx.haterHeat ?? 0, 0, 100);
  const reasons: string[] = [];
  let latestThreatMessageId: string | null = null;

  if (ctx.pressureTier === 'CRITICAL') {
    score += 28;
    reasons.push('Pressure tier is CRITICAL');
  } else if (ctx.pressureTier === 'HIGH') {
    score += 18;
    reasons.push('Pressure tier is HIGH');
  } else if (ctx.pressureTier === 'ELEVATED') {
    score += 8;
    reasons.push('Pressure tier is ELEVATED');
  }

  if (ctx.tickTier === 'COLLAPSE_IMMINENT') {
    score += 24;
    reasons.push('Tick tier is COLLAPSE_IMMINENT');
  } else if (ctx.tickTier === 'CRISIS') {
    score += 16;
    reasons.push('Tick tier is CRISIS');
  } else if (ctx.tickTier === 'COMPRESSED') {
    score += 8;
    reasons.push('Tick tier is COMPRESSED');
  }

  const scan = messages.slice(-MAX_THREAT_SCAN);
  for (let i = scan.length - 1; i >= 0; i -= 1) {
    const msg = scan[i];

    if (!latestThreatMessageId && (msg.kind === 'BOT_ATTACK' || msg.kind === 'BOT_TAUNT' || msg.kind === 'CASCADE_ALERT')) {
      latestThreatMessageId = msg.id;
    }

    if (msg.kind === 'BOT_ATTACK') score += 16;
    if (msg.kind === 'BOT_TAUNT') score += 8;
    if (msg.kind === 'CASCADE_ALERT') score += 10;
    if (msg.kind === 'SHIELD_EVENT' && (msg as unknown as { shieldMeta?: { isBreached?: boolean } }).shieldMeta?.isBreached) score += 12;
    if (msg.kind === 'MARKET_ALERT' && (msg as unknown as { pressureTier?: string }).pressureTier === 'CRITICAL') score += 12;
  }

  score = clamp(score, 0, 100);

  if (score >= 85) return { score, tier: 'CRITICAL', label: 'Critical threat posture', reasons, latestThreatMessageId };
  if (score >= 60) return { score, tier: 'HIGH', label: 'High threat posture', reasons, latestThreatMessageId };
  if (score >= 35) return { score, tier: 'WATCH', label: 'Watch posture', reasons, latestThreatMessageId };
  return { score, tier: 'CALM', label: 'Stable posture', reasons, latestThreatMessageId };
}

function buildHelperPrompt(
  messages: readonly ChatMessage[],
  ctx: GameChatContext,
  threat: UnifiedChatThreatSummary,
): UnifiedChatHelperPrompt | null {
  const recent = messages.slice(-MAX_HELPER_SCAN);
  const latestBotAttack = latestBy(recent, (msg) => msg.kind === 'BOT_ATTACK');
  const latestShieldBreach = latestBy(
    recent,
    (msg) => msg.kind === 'SHIELD_EVENT' && (msg as unknown as { shieldMeta?: { isBreached?: boolean } }).shieldMeta?.isBreached === true,
  );
  const latestCascade = latestBy(recent, (msg) => msg.kind === 'CASCADE_ALERT');
  const latestPressure = latestBy(
    recent,
    (msg) => msg.kind === 'MARKET_ALERT' && Boolean((msg as unknown as { pressureTier?: string }).pressureTier),
  );

  if (latestShieldBreach) {
    return {
      id: `helper-shield-${latestShieldBreach.id}`,
      title: 'Shield integrity broke in the active window',
      body: 'The last visible shield event shows a breach. Stabilize income and prevent a second chained hit before broadening risk.',
      severity: 'CRITICAL',
      sourceMessageId: latestShieldBreach.id,
      ctaLabel: 'Jump to breach',
      suggestedReply: 'Need the cleanest recovery route after that breach.',
    };
  }

  if (latestCascade) {
    return {
      id: `helper-cascade-${latestCascade.id}`,
      title: 'Cascade pressure is visible in transcript',
      body: 'A cascade lane was just triggered or acknowledged. Treat this as a compounding system event rather than a single isolated message.',
      severity: threat.tier === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
      sourceMessageId: latestCascade.id,
      ctaLabel: 'Inspect cascade',
      suggestedReply: 'What is the fastest way to break this chain?',
    };
  }

  if (latestBotAttack) {
    return {
      id: `helper-bot-${latestBotAttack.id}`,
      title: 'A hater attack is now the dominant visible signal',
      body: 'The latest hostile event in the active transcript is a bot-backed attack. The next best UI move is usually either a defensive reply or a channel shift to coordination.',
      severity: threat.tier === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
      sourceMessageId: latestBotAttack.id,
      ctaLabel: 'Inspect attack',
      suggestedReply: 'What exactly did that attack target?',
    };
  }

  if (latestPressure && (ctx.pressureTier === 'HIGH' || ctx.pressureTier === 'CRITICAL')) {
    return {
      id: `helper-pressure-${latestPressure.id}`,
      title: 'Pressure tier is escalating',
      body: 'Pressure has moved into a visible risk band. The shell should bias toward clarity, quick composition, and reduced navigation friction until the posture improves.',
      severity: ctx.pressureTier === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
      sourceMessageId: latestPressure.id,
      ctaLabel: 'Open latest alert',
      suggestedReply: 'Give me the safest next move under this pressure tier.',
    };
  }

  if (threat.tier === 'WATCH') {
    return {
      id: 'helper-watch-posture',
      title: 'Threat posture is rising',
      body: 'Nothing catastrophic is visible yet, but the signal stack is shifting. This is the window to tighten decision quality before the lane gets noisy.',
      severity: 'GUIDE',
      ctaLabel: 'Stay focused',
      suggestedReply: 'What should I guard against next?',
    };
  }

  return null;
}

function buildPresencePreview(messages: readonly ChatMessage[], activeChannel: ChatChannel): UnifiedChatPresencePreview {
  const recentPeerNames: string[] = [];
  const recentRanks: string[] = [];
  let activeMembers = 0;
  let typingCount = 0;

  const recent = messages.slice(-MAX_RECENT_PEERS);
  for (const msg of recent) {
    if (msg.channel !== activeChannel) continue;
    if ((msg as unknown as { senderId?: string }).senderId === 'SYSTEM') continue;

    activeMembers += 1;
    if ((msg as unknown as { senderId?: string }).senderId !== 'player-local') {
      const nextName = ((msg as unknown as { senderName?: string }).senderName ?? '').trim();
      if (nextName) {
        const dedupedNames = uniquePush(recentPeerNames, nextName, 6);
        recentPeerNames.length = 0;
        recentPeerNames.push(...dedupedNames);
      }
    }

    const senderRank = (msg as unknown as { senderRank?: string }).senderRank;
    if (senderRank) {
      const dedupedRanks = uniquePush(recentRanks, senderRank, 6);
      recentRanks.length = 0;
      recentRanks.push(...dedupedRanks);
    }

    if (Date.now() - ((msg as unknown as { ts?: number }).ts ?? 0) < 18_000 && msg.channel === activeChannel) {
      typingCount += msg.kind === 'PLAYER' ? 1 : 0;
    }
  }

  const onlineBase = Math.max(1, recentPeerNames.length + 1);
  const onlineCount = activeChannel === 'GLOBAL'
    ? Math.max(onlineBase, 12 + recentPeerNames.length * 3)
    : activeChannel === 'SYNDICATE'
      ? Math.max(onlineBase, 4 + recentPeerNames.length)
      : Math.max(onlineBase, 2 + recentPeerNames.length);

  return {
    onlineCount,
    activeMembers: Math.max(activeMembers, recentPeerNames.length + 1),
    typingCount: clamp(typingCount, 0, 6),
    recentPeerNames,
    recentRanks,
  };
}

function summaryForChannel(
  channel: ChatChannel,
  messages: readonly ChatMessage[],
  unread: Record<ChatChannel, number>,
): UnifiedChatChannelSummary {
  const scoped = messages.filter((msg) => msg.channel === channel);
  const latest = scoped.length > 0 ? scoped[scoped.length - 1] : null;
  const hasThreatActivity = scoped.some((msg) =>
    msg.kind === 'BOT_ATTACK' ||
    msg.kind === 'BOT_TAUNT' ||
    msg.kind === 'CASCADE_ALERT' ||
    (msg.kind === 'SHIELD_EVENT' && (msg as unknown as { shieldMeta?: { isBreached?: boolean } }).shieldMeta?.isBreached),
  );

  return {
    channel,
    label: CHANNEL_META[channel].label,
    emoji: CHANNEL_META[channel].emoji,
    unread: unread[channel],
    totalMessages: scoped.length,
    visibleMessages: scoped.length,
    latestTs: latest?.ts ?? null,
    latestPreview: latest ? compactPreview(latest.body, 74) : 'No visible messages yet.',
    latestSenderName: latest?.senderName ?? null,
    hasPlayerActivity: scoped.some((msg) => msg.kind === 'PLAYER'),
    hasProofBearingMessage: scoped.some((msg) => Boolean((msg as unknown as { proofHash?: string }).proofHash)),
    hasThreatActivity,
    canCompose: CHANNEL_META[channel].canCompose,
  };
}

function transcriptLockedForChannel(channel: ChatChannel, messages: readonly ChatMessage[]): boolean {
  if (channel !== 'DEAL_ROOM') return false;
  return messages.some((msg) => msg.channel === 'DEAL_ROOM' && Boolean((msg as unknown as { immutable?: boolean; proofHash?: string }).immutable || (msg as unknown as { proofHash?: string }).proofHash));
}

function emptyStateModeFromState(args: {
  collapsed: boolean;
  connected: boolean;
  activeChannel: ChatChannel;
  visibleMessages: readonly ChatMessage[];
  transcriptOpen: boolean;
  transcriptSearch: string;
  threat: UnifiedChatThreatSummary;
}): UseUnifiedChatResult['emptyStateMode'] {
  if (args.collapsed) return 'COLLAPSED';
  if (!args.connected && args.visibleMessages.length === 0) return 'DISCONNECTED';
  if (args.transcriptOpen && args.transcriptSearch.trim().length > 0 && args.visibleMessages.length === 0) return 'FILTERED';
  if (args.visibleMessages.length === 0 && args.activeChannel === 'DEAL_ROOM') return 'DEAL_WAITING';
  if (args.visibleMessages.length === 0 && (args.threat.tier === 'HIGH' || args.threat.tier === 'CRITICAL')) return 'THREAT';
  return 'IDLE';
}

export function useUnifiedChat({
  ctx,
  accessToken,
  shellMode = 'DOCK',
  initialChannel = 'GLOBAL',
  initialOpen = false,
  initialCollapsed = false,
  initialTranscriptOpen = false,
  initialTranscriptSearch = '',
  persistUiState = true,
  persistDrafts = true,
  storageNamespace = STORAGE_PREFIX,
  onSabotage,
}: UseUnifiedChatOptions): UseUnifiedChatResult {
  const uiStorageKey = `${storageNamespace}:ui`;
  const draftsStorageKey = `${storageNamespace}:drafts`;

  const persistedUi = persistUiState
    ? safeReadStorage<PersistedUiSnapshot>(uiStorageKey, {
        collapsed: initialCollapsed,
        pinned: false,
        transcriptOpen: initialTranscriptOpen,
        transcriptSearch: initialTranscriptSearch,
        activeChannel: initialChannel,
      })
    : {
        collapsed: initialCollapsed,
        pinned: false,
        transcriptOpen: initialTranscriptOpen,
        transcriptSearch: initialTranscriptSearch,
        activeChannel: initialChannel,
      };

  const persistedDrafts = persistDrafts
    ? safeReadStorage<PersistedDraftSnapshot>(draftsStorageKey, {
        GLOBAL: '',
        SYNDICATE: '',
        DEAL_ROOM: '',
      })
    : {
        GLOBAL: '',
        SYNDICATE: '',
        DEAL_ROOM: '',
      };

  const normalizedCtx = useMemo(
    () => normalizeGameChatContext(ctx ?? createEmptyGameChatContext()),
    [ctx],
  );

  const engine = useChatEngine(normalizedCtx, accessToken, onSabotage);

  const [collapsed, setCollapsed] = useState<boolean>(persistedUi.collapsed);
  const [isPinned, setIsPinned] = useState<boolean>(persistedUi.pinned);
  const [transcriptOpen, setTranscriptOpen] = useState<boolean>(persistedUi.transcriptOpen);
  const [transcriptSearch, setTranscriptSearch] = useState<string>(persistedUi.transcriptSearch);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<PersistedDraftSnapshot>(persistedDrafts);
  const [helperDismissed, setHelperDismissed] = useState<boolean>(false);
  const [explicitOpen, setExplicitOpen] = useState<boolean>(initialOpen);

  const hasMountedRef = useRef(false);
  const lastJumpTargetRef = useRef<string | null>(null);

  const { messages, activeTab, switchTab, chatOpen, toggleChat, sendMessage, unread, totalUnread, connected } = engine;
  const sortedMessages = useMemo(() => sortMessagesForRender(messages), [messages]);

  useEffect(() => {
    if (hasMountedRef.current) return;
    hasMountedRef.current = true;

    if (persistedUi.activeChannel !== activeTab) {
      switchTab(persistedUi.activeChannel);
    }

    if (initialOpen && !chatOpen) {
      toggleChat();
      setExplicitOpen(true);
    }
  }, [persistedUi.activeChannel, activeTab, switchTab, initialOpen, chatOpen, toggleChat]);

  useEffect(() => {
    if (!persistUiState) return;
    safeWriteStorage<PersistedUiSnapshot>(uiStorageKey, {
      collapsed,
      pinned: isPinned,
      transcriptOpen,
      transcriptSearch,
      activeChannel: activeTab,
    });
  }, [persistUiState, uiStorageKey, collapsed, isPinned, transcriptOpen, transcriptSearch, activeTab]);

  useEffect(() => {
    if (!persistDrafts) return;
    safeWriteStorage<PersistedDraftSnapshot>(draftsStorageKey, drafts);
  }, [persistDrafts, draftsStorageKey, drafts]);

  const activeDraft = drafts[activeTab];
  const allMessages = sortedMessages;
  const latestMessage = useMemo(() => latestBy(messages), [messages]);
  const latestPlayerMessage = useMemo(() => latestBy(messages, (msg) => msg.kind === 'PLAYER'), [messages]);
  const latestSystemMessage = useMemo(() => latestBy(messages, (msg) => msg.kind !== 'PLAYER'), [messages]);
  const latestThreatMessage = useMemo(
    () => latestBy(messages, (msg) => msg.kind === 'BOT_ATTACK' || msg.kind === 'BOT_TAUNT' || msg.kind === 'CASCADE_ALERT'),
    [messages],
  );

  const connectionState = useMemo(
    () => connectionStateFromFlags(connected, messages, normalizedCtx),
    [connected, messages, normalizedCtx],
  );

  const canonicalThreat = useMemo(() => extractThreatSnapshot(allMessages), [allMessages]);

  const threat = useMemo(() => {
    const localThreat = scoreThreat(allMessages, normalizedCtx);
    return {
      score: Math.max(localThreat.score, canonicalThreat.score100),
      tier:
        canonicalThreat.band === 'SEVERE'
          ? 'CRITICAL'
          : canonicalThreat.band === 'HIGH'
            ? 'HIGH'
            : canonicalThreat.band === 'ELEVATED' || canonicalThreat.band === 'LOW'
              ? 'WATCH'
              : localThreat.tier,
      label: localThreat.label,
      reasons: Array.from(
        new Set(
          [
            ...localThreat.reasons,
            canonicalThreat.activePressureTier ? `Shared pressure tier ${canonicalThreat.activePressureTier}` : '',
            canonicalThreat.activeTickTier ? `Shared tick tier ${canonicalThreat.activeTickTier}` : '',
          ].filter(Boolean),
        ),
      ),
      latestThreatMessageId: localThreat.latestThreatMessageId,
    } satisfies UnifiedChatThreatSummary;
  }, [allMessages, normalizedCtx, canonicalThreat]);

  const rawHelperPrompt = useMemo(
    () => buildHelperPrompt(allMessages, normalizedCtx, threat),
    [allMessages, normalizedCtx, threat],
  );
  const helperPrompt = helperDismissed ? null : rawHelperPrompt;

  useEffect(() => {
    if (rawHelperPrompt) {
      setHelperDismissed(false);
    }
  }, [rawHelperPrompt?.id]);

  const presence = useMemo(() => buildPresencePreview(allMessages, activeTab), [allMessages, activeTab]);
  const currentPlayerName = String((normalizedCtx as unknown as { playerName?: string }).playerName ?? 'You');
  const currentPlayerId = String((normalizedCtx as unknown as { playerId?: string }).playerId ?? 'player-local');

  const presenceStripModel = useMemo(
    () =>
      buildPresenceStripViewModel({
        messages: allMessages,
        activeChannel: activeTab,
        playerName: currentPlayerName,
        playerId: currentPlayerId,
        onlineCount: presence.onlineCount,
        activeMembers: presence.activeMembers,
        typingCount: presence.typingCount,
        recentPeerNames: presence.recentPeerNames,
      }),
    [
      allMessages,
      activeTab,
      currentPlayerId,
      currentPlayerName,
      presence.activeMembers,
      presence.onlineCount,
      presence.recentPeerNames,
      presence.typingCount,
    ],
  );

  const typingIndicatorModel = useMemo(
    () =>
      buildTypingClusterViewModel({
        messages: visibleMessages,
        activeChannel: activeTab,
        playerName: currentPlayerName,
        playerId: currentPlayerId,
        typingCount: presence.typingCount,
      }),
    [activeTab, currentPlayerId, currentPlayerName, presence.typingCount, visibleMessages],
  );

  const canonicalChannelSummaries = useMemo(
    () => buildChannelSummaries(allMessages, activeTab),
    [allMessages, activeTab],
  );

  const channels = useMemo<UnifiedChatChannelSummary[]>(() => {
    return canonicalChannelSummaries.map((summary) => ({
      channel: summary.channel,
      label: summary.label,
      emoji: CHANNEL_META[summary.channel].emoji,
      unread: unread[summary.channel] ?? summary.unread,
      totalMessages: summary.totalMessages,
      visibleMessages: allMessages.filter((message) => message.channel === summary.channel).length,
      latestTs: summary.lastMessageAt ?? null,
      latestPreview: compactPreview(
        allMessages.filter((message) => message.channel === summary.channel).at(-1)?.body ?? '',
      ),
      latestSenderName: summary.lastSenderName ?? null,
      hasPlayerActivity: allMessages.some((message) => message.channel === summary.channel && message.kind === 'PLAYER'),
      hasProofBearingMessage: allMessages.some((message) => message.channel === summary.channel && Boolean((message as unknown as { proofHash?: string }).proofHash)),
      hasThreatActivity: summary.threatBand === 'HIGH' || summary.threatBand === 'SEVERE' || summary.helperNeeded,
      canCompose: CHANNEL_META[summary.channel].canCompose,
    }));
  }, [canonicalChannelSummaries, unread, allMessages]);

  const activeSummary = useMemo(
    () => channels.find((summary) => summary.channel === activeTab) ?? summaryForChannel(activeTab, messages, unread),
    [channels, activeTab, messages, unread],
  );

  const transcriptLocked = useMemo(
    () => transcriptLockedForChannel(activeTab, messages),
    [activeTab, messages],
  );

  const transcriptSearchResult = useMemo(
    () => buildTranscriptSearchResult(allMessages, transcriptSearch, activeTab),
    [allMessages, transcriptSearch, activeTab],
  );

  const visibleMessages = useMemo(
    () => sortedMessages.filter((msg) => msg.channel === activeTab),
    [sortedMessages, activeTab],
  );
  const transcriptFilteredMessages = useMemo(
    () => transcriptSearchResult.messages,
    [transcriptSearchResult.messages],
  );
  const recentMessages = useMemo(() => visibleMessages.slice(-24), [visibleMessages]);

  const {
    feed: messageFeedModel,
    actionsByMessageId: messageFeedActionsByMessageId,
  } = useMemo(
    () =>
      buildMessageFeedSurfaceModel({
        activeChannel: activeTab,
        messages: visibleMessages,
        unreadCount: unread[activeTab] ?? 0,
        currentUserId: currentPlayerId,
        newestFirst: false,
        density: shellMode === 'DRAWER' ? 'expanded' : 'comfortable',
        transcriptLocked,
        hasOlder: allMessages.length > visibleMessages.length,
        hasNewer: false,
        ctx: normalizedCtx,
        threatSnapshot: canonicalThreat,
      }),
    [
      activeTab,
      allMessages.length,
      canonicalThreat,
      normalizedCtx,
      shellMode,
      transcriptLocked,
      unread,
      visibleMessages,
    ],
  );

  const recommendationChannel = useMemo<ChatChannel>(() => {
    const dealUnread = unread.DEAL_ROOM ?? 0;
    const syndicateUnread = unread.SYNDICATE ?? 0;
    const globalUnread = unread.GLOBAL ?? 0;
    if (transcriptLocked || dealUnread >= Math.max(globalUnread, syndicateUnread)) return 'DEAL_ROOM';
    if (threat.tier === 'HIGH' || threat.tier === 'CRITICAL') return 'SYNDICATE';
    if (globalUnread >= Math.max(syndicateUnread, dealUnread)) return 'GLOBAL';
    return activeTab;
  }, [activeTab, threat.tier, transcriptLocked, unread.DEAL_ROOM, unread.GLOBAL, unread.SYNDICATE]);

  const channelTabs = useMemo<ChannelTabsViewModel>(() => {
    const scopedMessages = (channel: ChatChannel) => allMessages.filter((message) => message.channel === channel);
    const unreadByChannel = unread;
    const makePresence = (channel: ChatChannel) => {
      const scoped = scopedMessages(channel).slice(-18);
      return {
        online: new Set(
          scoped
            .map((message) => (message as unknown as { senderId?: string }).senderId ?? '')
            .filter(Boolean),
        ).size,
        typing: scoped.filter((message) => message.kind === 'PLAYER' && Date.now() - ((message as unknown as { ts?: number }).ts ?? 0) < 18_000).length,
        watching: Math.max(0, scoped.length - 1),
        helperVisible: channel === 'SYNDICATE' && helperPrompt !== null,
        haterVisible: scoped.some((message) => message.kind === 'BOT_ATTACK' || message.kind === 'BOT_TAUNT'),
      };
    };
    const makeHeat = (channel: ChatChannel) => {
      const scoped = scopedMessages(channel);
      const attackCount = scoped.filter((message) => message.kind === 'BOT_ATTACK').length;
      const tauntCount = scoped.filter((message) => message.kind === 'BOT_TAUNT').length;
      const cascadeCount = scoped.filter((message) => message.kind === 'CASCADE_ALERT').length;
      const score01 = Math.max(0, Math.min(1, (attackCount * 0.32) + (tauntCount * 0.18) + (cascadeCount * 0.24) + ((unreadByChannel[channel] ?? 0) / 16)));
      const band = score01 >= 0.8 ? 'SEVERE' : score01 >= 0.6 ? 'HIGH' : score01 >= 0.35 ? 'ELEVATED' : score01 >= 0.1 ? 'LOW' : 'QUIET';
      return { score01, band, label: band.toLowerCase() } as const;
    };
    const makeIntegrity = (channel: ChatChannel) => ({
      locked: channel === 'DEAL_ROOM' ? transcriptLocked : false,
      label: channel === 'DEAL_ROOM' && transcriptLocked ? 'sealed' : 'open',
      proofState: channel === 'DEAL_ROOM' && transcriptLocked ? 'sealed' : 'clean',
    } as const);
    const makeMetaLines = (channel: ChatChannel) => {
      const scoped = scopedMessages(channel);
      const latest = scoped[scoped.length - 1];
      return [
        {
          id: `${channel}:messages`,
          label: 'msgs',
          value: String(scoped.length),
          visible: true,
        },
        {
          id: `${channel}:latest`,
          label: 'latest',
          value: latest ? new Date(((latest as unknown as { ts?: number }).ts ?? 0)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--',
          visible: true,
        },
      ];
    };

    return {
      activeChannel: activeTab,
      onSelectChannel: (channel) => {
        const nextChannel = channel as ChatChannel;
        if (nextChannel === activeTab) return;
        switchTab(nextChannel);
        setHelperDismissed(false);
      },
      density: collapsed ? 'compact' : 'comfortable',
      layout: 'inline',
      collapsed,
      connectionState: toChannelTabsConnectionState(connectionState),
      totalUnread,
      showDescriptions: !collapsed,
      showMetaRail: !collapsed,
      showHeatMeters: !collapsed,
      showPresence: !collapsed,
      showHotkeys: true,
      showUnreadTotalSeal: true,
      showConnectionPill: true,
      showKeyboardHintsInLegend: true,
      keyboardLegendLabel: 'switch',
      onOpenPresencePanel: undefined,
      onOpenIntegrityPanel: undefined,
      tabs: buildChannelTabViewModels({
        activeChannel: activeTab,
        records: {
          GLOBAL: {
            unread: unreadByChannel.GLOBAL ?? 0,
            heat: makeHeat('GLOBAL'),
            presence: makePresence('GLOBAL'),
            integrity: makeIntegrity('GLOBAL'),
            metaLines: makeMetaLines('GLOBAL'),
            recommended: recommendationChannel === 'GLOBAL',
            recommendationLabel: recommendationChannel === 'GLOBAL' ? 'best next lane' : undefined,
          },
          SYNDICATE: {
            unread: unreadByChannel.SYNDICATE ?? 0,
            heat: makeHeat('SYNDICATE'),
            presence: makePresence('SYNDICATE'),
            integrity: makeIntegrity('SYNDICATE'),
            metaLines: makeMetaLines('SYNDICATE'),
            recommended: recommendationChannel === 'SYNDICATE',
            recommendationLabel: recommendationChannel === 'SYNDICATE' ? 'best next lane' : undefined,
          },
          DEAL_ROOM: {
            unread: unreadByChannel.DEAL_ROOM ?? 0,
            heat: makeHeat('DEAL_ROOM'),
            presence: makePresence('DEAL_ROOM'),
            integrity: makeIntegrity('DEAL_ROOM'),
            metaLines: makeMetaLines('DEAL_ROOM'),
            seriousness: transcriptLocked ? 'high' : 'elevated',
            recommended: recommendationChannel === 'DEAL_ROOM',
            recommendationLabel: recommendationChannel === 'DEAL_ROOM' ? 'best next lane' : undefined,
          },
        },
      }),
    };
  }, [
    activeTab,
    allMessages,
    collapsed,
    connectionState,
    helperPrompt,
    recommendationChannel,
    switchTab,
    totalUnread,
    transcriptLocked,
    unread,
  ]);

  const emptyStateMode = useMemo(
    () =>
      emptyStateModeFromState({
        collapsed,
        connected,
        activeChannel: activeTab,
        visibleMessages: transcriptOpen && transcriptSearch.trim().length > 0 ? transcriptFilteredMessages : visibleMessages,
        transcriptOpen,
        transcriptSearch,
        threat,
      }),
    [collapsed, connected, activeTab, visibleMessages, transcriptFilteredMessages, transcriptOpen, transcriptSearch, threat],
  );

  const setActiveChannel = useCallback(
    (channel: ChatChannel) => {
      if (channel === activeTab) return;
      switchTab(channel);
      setHelperDismissed(false);
    },
    [activeTab, switchTab],
  );

  const setDraft = useCallback(
    (next: string) => {
      const clipped = next.slice(0, MAX_DRAFT_CHARS);
      setDrafts((prev) => {
        if (prev[activeTab] === clipped) return prev;
        return { ...prev, [activeTab]: clipped };
      });
    },
    [activeTab],
  );

  const appendDraft = useCallback(
    (suffix: string) => {
      setDrafts((prev) => {
        const current = prev[activeTab] ?? '';
        const base = current.trim().length > 0 ? `${current.trimEnd()} ${suffix.trim()}` : suffix.trim();
        return { ...prev, [activeTab]: base.slice(0, MAX_DRAFT_CHARS) };
      });
    },
    [activeTab],
  );

  const clearDraft = useCallback(() => {
    setDrafts((prev) => ({ ...prev, [activeTab]: '' }));
  }, [activeTab]);

  const openChat = useCallback(() => {
    if (!chatOpen) toggleChat();
    setExplicitOpen(true);
    setCollapsed(false);
  }, [chatOpen, toggleChat]);

  const closeChat = useCallback(() => {
    if (chatOpen) toggleChat();
    setExplicitOpen(false);
  }, [chatOpen, toggleChat]);

  const stableToggleChat = useCallback(() => {
    toggleChat();
    setExplicitOpen((prev) => !prev);
  }, [toggleChat]);

  const collapse = useCallback(() => setCollapsed(true), []);
  const expand = useCallback(() => setCollapsed(false), []);
  const toggleCollapsed = useCallback(() => setCollapsed((prev) => !prev), []);
  const pin = useCallback(() => setIsPinned(true), []);
  const unpin = useCallback(() => setIsPinned(false), []);
  const togglePinned = useCallback(() => setIsPinned((prev) => !prev), []);
  const openTranscript = useCallback(() => { setTranscriptOpen(true); setCollapsed(false); }, []);
  const closeTranscript = useCallback(() => setTranscriptOpen(false), []);
  const toggleTranscript = useCallback(() => setTranscriptOpen((prev) => !prev), []);
  const setTranscriptSearchQuery = useCallback((query: string) => setTranscriptSearch(query), []);
  const selectTranscriptMessage = useCallback((messageId: string | null) => { setSelectedMessageId(messageId); lastJumpTargetRef.current = messageId; }, []);

  const jumpToLatest = useCallback(() => {
    const target = latestBy(messages.filter((msg) => msg.channel === activeTab));
    if (!target) return;
    setSelectedMessageId(target.id);
    lastJumpTargetRef.current = target.id;
  }, [messages, activeTab]);

  const sendDraft = useCallback(() => {
    const trimmed = activeDraft.trim();
    if (!trimmed) return;
    sendMessage(trimmed);
    setDrafts((prev) => ({ ...prev, [activeTab]: '' }));
    setHelperDismissed(false);
    setSelectedMessageId(null);
  }, [activeDraft, sendMessage, activeTab]);

  const quickReply = useCallback(
    (reply: string) => {
      const trimmed = reply.trim();
      if (!trimmed) return;
      sendMessage(trimmed);
      setDrafts((prev) => ({ ...prev, [activeTab]: '' }));
      setHelperDismissed(true);
    },
    [sendMessage, activeTab],
  );

  const dismissHelperPrompt = useCallback(() => setHelperDismissed(true), []);
  const reopenHelperPrompt = useCallback(() => setHelperDismissed(false), []);

  const resetUi = useCallback(() => {
    setCollapsed(initialCollapsed);
    setIsPinned(false);
    setTranscriptOpen(initialTranscriptOpen);
    setTranscriptSearch(initialTranscriptSearch);
    setSelectedMessageId(null);
    setHelperDismissed(false);
    setDrafts({ GLOBAL: '', SYNDICATE: '', DEAL_ROOM: '' });
    if (activeTab !== initialChannel) switchTab(initialChannel);
  }, [initialCollapsed, initialTranscriptOpen, initialTranscriptSearch, initialChannel, activeTab, switchTab]);

  const composer = useMemo<UnifiedChatComposerState>(() => {
    const trimmed = activeDraft.trim();
    const nearLimit = activeDraft.length >= Math.floor(MAX_DRAFT_CHARS * 0.85);
    return {
      activeDraft,
      charCount: activeDraft.length,
      maxChars: MAX_DRAFT_CHARS,
      canSend: trimmed.length > 0 && CHANNEL_META[activeTab].canCompose,
      isNearLimit: nearLimit,
      placeholder: CHANNEL_META[activeTab].placeholder,
    };
  }, [activeDraft, activeTab]);

  const transcriptDrawerModel = useMemo(
    () => buildTranscriptDrawerSurfaceModel({
      open: transcriptOpen,
      messages: allMessages,
      activeChannel: activeTab,
      roomTitle: activeSummary.label,
      roomSubtitle: activeSummary.latestPreview || activeSummary.label,
      modeName: shellMode,
      context: normalizedCtx,
      connected,
      connectionState,
      onlineCount: presence.onlineCount,
      activeMembers: presence.activeMembers,
      typingCount: presence.typingCount,
      totalUnread,
      selectedMessageId,
      transcriptLocked,
      searchQuery: transcriptSearch,
      newestFirst: false,
      proofOnly: false,
      lockedOnly: false,
      channelScope: activeTab,
      kindScope: 'ALL',
    }),
    [
      transcriptOpen,
      allMessages,
      activeTab,
      activeSummary.label,
      activeSummary.latestPreview,
      shellMode,
      normalizedCtx,
      connected,
      connectionState,
      presence.onlineCount,
      presence.activeMembers,
      presence.typingCount,
      totalUnread,
      selectedMessageId,
      transcriptLocked,
      transcriptSearch,
    ],
  );

  const transcriptDrawerCallbacks = useMemo(
    () => createTranscriptDrawerCallbacks({
      onClose: closeTranscript,
      onSearchQueryChange: setTranscriptSearchQuery,
      onSelectChannelScope: (scopeId) => {
        if (scopeId === 'GLOBAL' || scopeId === 'SYNDICATE' || scopeId === 'DEAL_ROOM') {
          setActiveChannel(scopeId);
        }
      },
      onJumpToMessage: selectTranscriptMessage,
      onRequestExport: undefined,
      onJumpLatest: jumpToLatest,
    }),
    [closeTranscript, setTranscriptSearchQuery, setActiveChannel, selectTranscriptMessage, jumpToLatest],
  );

  return {
    shellMode,
    connected,
    connectionState,
    chatOpen: explicitOpen || chatOpen,
    collapsed,
    isPinned,
    activeChannel: activeTab,
    activeSummary,
    channels,
    allMessages,
    visibleMessages,
    recentMessages,
    unread,
    totalUnread,
    threat,
    helperPrompt,
    presence,
    transcript: {
      open: transcriptOpen,
      searchQuery: transcriptSearch,
      selectedMessageId,
      newestFirst: false,
    },
    transcriptDrawerModel,
    transcriptDrawerCallbacks,
    presenceStripModel,
    typingIndicatorModel,
    channelTabs,
    messageFeedModel,
    messageFeedActionsByMessageId,
    composer,
    latestMessage,
    latestPlayerMessage,
    latestSystemMessage,
    latestThreatMessage,
    transcriptLocked,
    emptyStateMode,
    sendDraft,
    setActiveChannel,
    setDraft,
    appendDraft,
    clearDraft,
    openChat,
    closeChat,
    toggleChat: stableToggleChat,
    collapse,
    expand,
    toggleCollapsed,
    pin,
    unpin,
    togglePinned,
    openTranscript,
    closeTranscript,
    toggleTranscript,
    setTranscriptSearchQuery,
    selectTranscriptMessage,
    jumpToLatest,
    quickReply,
    dismissHelperPrompt,
    reopenHelperPrompt,
    resetUi,
    diagnostics: {
      normalizedContext: normalizedCtx,
      sortedMessageCount: allMessages.length,
      searchMatchCount: transcriptSearchResult.totalMatches,
      threatSnapshot: canonicalThreat,
      transcriptSearchResult,
    },
    mountState: {
      mountTarget: String((normalizedCtx as unknown as { mountTarget?: string; run?: { mountTarget?: string } }).mountTarget ?? (normalizedCtx as unknown as { run?: { mountTarget?: string } }).run?.mountTarget ?? 'UNKNOWN'),
      modeScope: String((normalizedCtx as unknown as { modeScope?: string; run?: { modeScope?: string } }).modeScope ?? (normalizedCtx as unknown as { run?: { modeScope?: string } }).run?.modeScope ?? 'UNKNOWN'),
      storageNamespace,
    },
    runtimeBundle: USE_UNIFIED_CHAT_RUNTIME_BUNDLE,
  };
}

export default useUnifiedChat;
