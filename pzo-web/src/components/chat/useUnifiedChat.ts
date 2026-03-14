import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChatChannel, ChatMessage, GameChatContext, SabotageEvent } from './chatTypes';
import { useChatEngine } from './useChatEngine';

/**
 * ============================================================================
 * POINT ZERO ONE — UNIFIED CHAT UI HOOK
 * FILE: pzo-web/src/components/chat/useUnifiedChat.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Thin presentation-lane composition hook for the unified chat shell.
 *
 * This hook intentionally does NOT become a second engine.
 * It composes the current live hook (`useChatEngine`) and adds only UI-shell
 * responsibilities that belong in the component lane:
 *
 * - shell open / close / collapsed state
 * - draft state per channel
 * - transcript drawer state
 * - search state
 * - selection state
 * - UI-facing derived stats / labels / quick actions
 * - presentation-safe helper prompt derivation
 * - cheap channel summaries and threat posture
 *
 * It does NOT own:
 * - transport / sockets
 * - transcript truth
 * - bot cadence
 * - learning updates
 * - policy enforcement
 * - battle authority
 *
 * Architectural role
 * ------------------
 * Current repo reality still has `pzo-web/src/components/chat/useChatEngine.ts`
 * as the mounted live chat hook. This file is a controlled shell adapter that
 * makes the presentation split viable now without flattening the current logic.
 *
 * In the later canonical split:
 * - engines/chat remains the frontend authority lane
 * - components/chat remains the render lane
 * - this hook either becomes a presentation-only wrapper over engines/chat or
 *   shrinks into a minimal view-model adapter
 *
 * Design laws
 * -----------
 * - UI state only; never smuggle authority back into the component lane.
 * - Everything returned should be directly renderable or interaction-ready.
 * - Derive aggressively, mutate sparingly.
 * - Preserve the current chatTypes surface.
 * - Keep compile-safe against the repo’s current hook signature.
 * ============================================================================
 */

const STORAGE_PREFIX = 'pzo_unified_chat';
const MAX_HELPER_SCAN = 32;
const MAX_THREAT_SCAN = 48;
const MAX_RECENT_PEERS = 24;
const MAX_DRAFT_CHARS = 1200;

export type UnifiedChatConnectionState =
  | 'CONNECTED'
  | 'CONNECTING'
  | 'DEGRADED'
  | 'DISCONNECTED';

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
}

type PersistedUiSnapshot = {
  collapsed: boolean;
  pinned: boolean;
  transcriptOpen: boolean;
  transcriptSearch: string;
  activeChannel: ChatChannel;
};

type PersistedDraftSnapshot = Record<ChatChannel, string>;

const CHANNEL_META: Record<
  ChatChannel,
  {
    label: string;
    emoji: string;
    canCompose: boolean;
    placeholder: string;
  }
> = {
  GLOBAL: {
    label: 'Global',
    emoji: '🌐',
    canCompose: true,
    placeholder: 'Broadcast into the public lane…',
  },
  SYNDICATE: {
    label: 'Syndicate',
    emoji: '🏛️',
    canCompose: true,
    placeholder: 'Coordinate with your alliance…',
  },
  DEAL_ROOM: {
    label: 'Deal Room',
    emoji: '⚡',
    canCompose: true,
    placeholder: 'State your offer, counter, or recap…',
  },
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
    // storage is optional; fail closed with no UI crash
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
    if (msg.kind === 'SHIELD_EVENT' && msg.shieldMeta?.isBreached) score += 12;
    if (msg.kind === 'MARKET_ALERT' && msg.pressureTier === 'CRITICAL') score += 12;
  }

  score = clamp(score, 0, 100);

  if (score >= 85) {
    return {
      score,
      tier: 'CRITICAL',
      label: 'Critical threat posture',
      reasons,
      latestThreatMessageId,
    };
  }

  if (score >= 60) {
    return {
      score,
      tier: 'HIGH',
      label: 'High threat posture',
      reasons,
      latestThreatMessageId,
    };
  }

  if (score >= 35) {
    return {
      score,
      tier: 'WATCH',
      label: 'Watch posture',
      reasons,
      latestThreatMessageId,
    };
  }

  return {
    score,
    tier: 'CALM',
    label: 'Stable posture',
    reasons,
    latestThreatMessageId,
  };
}

function buildHelperPrompt(
  messages: readonly ChatMessage[],
  ctx: GameChatContext,
  threat: UnifiedChatThreatSummary,
): UnifiedChatHelperPrompt | null {
  const recent = messages.slice(-MAX_HELPER_SCAN);
  const latestBotAttack = latestBy(recent, msg => msg.kind === 'BOT_ATTACK');
  const latestShieldBreach = latestBy(recent, msg => msg.kind === 'SHIELD_EVENT' && Boolean(msg.shieldMeta?.isBreached));
  const latestCascade = latestBy(recent, msg => msg.kind === 'CASCADE_ALERT');
  const latestPressure = latestBy(recent, msg => msg.kind === 'MARKET_ALERT' && Boolean(msg.pressureTier));

  if (latestShieldBreach) {
    return {
      id: `helper-shield-${latestShieldBreach.id}`,
      title: 'Shield integrity broke in the active window',
      body:
        'The last visible shield event shows a breach. The safest next move is to stabilize income and prevent a second chained hit before broadening risk.',
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
      body:
        'A cascade lane was just triggered or acknowledged. Treat this as a compounding system event rather than a single isolated message.',
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
      body:
        'The latest hostile event in the active transcript is a bot-backed attack. The next best UI move is usually either a defensive reply or a channel shift to coordination.',
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
      body:
        'Pressure has moved into a visible risk band. The shell should bias toward clarity, quick composition, and reduced navigation friction until the posture improves.',
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
      body:
        'Nothing catastrophic is visible yet, but the signal stack is shifting. This is the window to tighten decision quality before the lane gets noisy.',
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
    if (msg.senderId === 'SYSTEM') continue;

    activeMembers += 1;
    if (msg.senderId !== 'player-local') {
      const nextName = msg.senderName.trim();
      if (nextName) {
        const dedupedNames = uniquePush(recentPeerNames, nextName, 6);
        recentPeerNames.length = 0;
        recentPeerNames.push(...dedupedNames);
      }
    }

    if (msg.senderRank) {
      const dedupedRanks = uniquePush(recentRanks, msg.senderRank, 6);
      recentRanks.length = 0;
      recentRanks.push(...dedupedRanks);
    }

    if (Date.now() - msg.ts < 18_000 && msg.channel === activeChannel) {
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
  const scoped = messages.filter(msg => msg.channel === channel);
  const latest = scoped.length > 0 ? scoped[scoped.length - 1] : null;
  const hasThreatActivity = scoped.some(msg =>
    msg.kind === 'BOT_ATTACK' ||
    msg.kind === 'BOT_TAUNT' ||
    msg.kind === 'CASCADE_ALERT' ||
    (msg.kind === 'SHIELD_EVENT' && Boolean(msg.shieldMeta?.isBreached)),
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
    hasPlayerActivity: scoped.some(msg => msg.kind === 'PLAYER'),
    hasProofBearingMessage: scoped.some(msg => Boolean(msg.proofHash)),
    hasThreatActivity,
    canCompose: CHANNEL_META[channel].canCompose,
  };
}

function transcriptLockedForChannel(channel: ChatChannel, messages: readonly ChatMessage[]): boolean {
  if (channel !== 'DEAL_ROOM') return false;
  return messages.some(msg => msg.channel === 'DEAL_ROOM' && Boolean(msg.immutable || msg.proofHash));
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

  const engine = useChatEngine(ctx, accessToken, onSabotage);

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

  // Align current live hook tab with persisted / requested initial tab once.
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
  const allMessages = messages;
  const visibleMessages = useMemo(() => messages.filter(msg => msg.channel === activeTab), [messages, activeTab]);
  const recentMessages = useMemo(() => visibleMessages.slice(-24), [visibleMessages]);

  const latestMessage = useMemo(() => latestBy(messages), [messages]);
  const latestPlayerMessage = useMemo(() => latestBy(messages, msg => msg.kind === 'PLAYER'), [messages]);
  const latestSystemMessage = useMemo(() => latestBy(messages, msg => msg.kind !== 'PLAYER'), [messages]);
  const latestThreatMessage = useMemo(
    () => latestBy(messages, msg => msg.kind === 'BOT_ATTACK' || msg.kind === 'BOT_TAUNT' || msg.kind === 'CASCADE_ALERT'),
    [messages],
  );

  const connectionState = useMemo(
    () => connectionStateFromFlags(connected, messages, ctx),
    [connected, messages, ctx],
  );

  const threat = useMemo(() => scoreThreat(messages, ctx), [messages, ctx]);
  const rawHelperPrompt = useMemo(() => buildHelperPrompt(messages, ctx, threat), [messages, ctx, threat]);
  const helperPrompt = helperDismissed ? null : rawHelperPrompt;

  useEffect(() => {
    if (rawHelperPrompt) {
      setHelperDismissed(false);
    }
  }, [rawHelperPrompt?.id]);

  const presence = useMemo(() => buildPresencePreview(messages, activeTab), [messages, activeTab]);

  const channels = useMemo<UnifiedChatChannelSummary[]>(() => {
    return (['GLOBAL', 'SYNDICATE', 'DEAL_ROOM'] as ChatChannel[]).map(channel =>
      summaryForChannel(channel, messages, unread),
    );
  }, [messages, unread]);

  const activeSummary = useMemo(
    () => channels.find(summary => summary.channel === activeTab) ?? summaryForChannel(activeTab, messages, unread),
    [channels, activeTab, messages, unread],
  );

  const transcriptLocked = useMemo(
    () => transcriptLockedForChannel(activeTab, messages),
    [activeTab, messages],
  );

  const emptyStateMode = useMemo(
    () =>
      emptyStateModeFromState({
        collapsed,
        connected,
        activeChannel: activeTab,
        visibleMessages,
        transcriptOpen,
        transcriptSearch,
        threat,
      }),
    [collapsed, connected, activeTab, visibleMessages, transcriptOpen, transcriptSearch, threat],
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
      setDrafts(prev => {
        if (prev[activeTab] === clipped) return prev;
        return {
          ...prev,
          [activeTab]: clipped,
        };
      });
    },
    [activeTab],
  );

  const appendDraft = useCallback(
    (suffix: string) => {
      setDrafts(prev => {
        const current = prev[activeTab] ?? '';
        const base = current.trim().length > 0 ? `${current.trimEnd()} ${suffix.trim()}` : suffix.trim();
        return {
          ...prev,
          [activeTab]: base.slice(0, MAX_DRAFT_CHARS),
        };
      });
    },
    [activeTab],
  );

  const clearDraft = useCallback(() => {
    setDrafts(prev => ({
      ...prev,
      [activeTab]: '',
    }));
  }, [activeTab]);

  const openChat = useCallback(() => {
    if (!chatOpen) {
      toggleChat();
    }
    setExplicitOpen(true);
    setCollapsed(false);
  }, [chatOpen, toggleChat]);

  const closeChat = useCallback(() => {
    if (chatOpen) {
      toggleChat();
    }
    setExplicitOpen(false);
  }, [chatOpen, toggleChat]);

  const stableToggleChat = useCallback(() => {
    toggleChat();
    setExplicitOpen(prev => !prev);
  }, [toggleChat]);

  const collapse = useCallback(() => setCollapsed(true), []);
  const expand = useCallback(() => setCollapsed(false), []);
  const toggleCollapsed = useCallback(() => setCollapsed(prev => !prev), []);

  const pin = useCallback(() => setIsPinned(true), []);
  const unpin = useCallback(() => setIsPinned(false), []);
  const togglePinned = useCallback(() => setIsPinned(prev => !prev), []);

  const openTranscript = useCallback(() => {
    setTranscriptOpen(true);
    setCollapsed(false);
  }, []);

  const closeTranscript = useCallback(() => setTranscriptOpen(false), []);
  const toggleTranscript = useCallback(() => setTranscriptOpen(prev => !prev), []);
  const setTranscriptSearchQuery = useCallback((query: string) => setTranscriptSearch(query), []);

  const selectTranscriptMessage = useCallback((messageId: string | null) => {
    setSelectedMessageId(messageId);
    lastJumpTargetRef.current = messageId;
  }, []);

  const jumpToLatest = useCallback(() => {
    const target = latestBy(messages.filter(msg => msg.channel === activeTab));
    if (!target) return;
    setSelectedMessageId(target.id);
    lastJumpTargetRef.current = target.id;
  }, [messages, activeTab]);

  const sendDraft = useCallback(() => {
    const trimmed = activeDraft.trim();
    if (!trimmed) return;
    sendMessage(trimmed);
    setDrafts(prev => ({
      ...prev,
      [activeTab]: '',
    }));
    setHelperDismissed(false);
    setSelectedMessageId(null);
  }, [activeDraft, sendMessage, activeTab]);

  const quickReply = useCallback(
    (reply: string) => {
      const trimmed = reply.trim();
      if (!trimmed) return;
      sendMessage(trimmed);
      setDrafts(prev => ({
        ...prev,
        [activeTab]: '',
      }));
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
    if (activeTab !== initialChannel) {
      switchTab(initialChannel);
    }
  }, [
    initialCollapsed,
    initialTranscriptOpen,
    initialTranscriptSearch,
    initialChannel,
    activeTab,
    switchTab,
  ]);

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

  return {
    shellMode,
    connected,
    connectionState,
    chatOpen,
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
  };
}

export default useUnifiedChat;
