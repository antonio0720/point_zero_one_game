/**
 * ==========================================================================
 * POINT ZERO ONE — CANONICAL CHAT ENGINE UI ADAPTER
 * FILE: pzo-web/src/components/chat/useCanonicalUnifiedChat.ts
 * ==========================================================================
 *
 * Purpose
 * -------
 * Adapt the sovereign frontend ChatEngine runtime to the legacy
 * UseChatEngineResult shape still consumed by UnifiedChatDock.
 *
 * This is the bridge that lets the existing dock stay alive while the runtime
 * authority shifts out of the component lane and into pzo-web/src/engines/chat.
 * ==========================================================================
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import type { ChatEngine } from '../../engines/chat/ChatEngine';

import {
  buildChannelSummaries,
  coerceChatMessages,
  extractThreatSnapshot,
  normalizeChatChannel,
  sortMessagesForRender,
  type ChatChannel,
  type ChatConnectionState,
  type ChatMessage,
  type ChatPresencePreviewCompat,
  type ChatTranscriptStateCompat,
  type GameChatContext,
  type SabotageEvent,
  type UseChatEngineResult,
} from './chatTypes';

export interface UseCanonicalUnifiedChatInput {
  readonly ctx: GameChatContext;
  readonly accessToken?: string | null;
  readonly onSabotage?: (event: SabotageEvent) => void;
  readonly engine?: ChatEngine | null;
}

function toCompatConnectionState(status?: string): ChatConnectionState {
  switch (status) {
    case 'CONNECTED':
      return 'CONNECTED';
    case 'CONNECTING':
      return 'CONNECTING';
    case 'RECONNECTING':
    case 'ERROR':
      return 'DEGRADED';
    case 'IDLE':
    default:
      return 'DISCONNECTED';
  }
}

function flattenMessages(snapshot: ReturnType<ChatEngine['getSnapshot']>): ChatMessage[] {
  return sortMessagesForRender(
    coerceChatMessages(
      Object.values(snapshot.messagesByChannel ?? {}).flat() as Array<
        Partial<ChatMessage> & Record<string, unknown>
      >,
    ),
  );
}

function derivePresencePreview(messages: readonly ChatMessage[], snapshot: ReturnType<ChatEngine['getSnapshot']>): ChatPresencePreviewCompat {
  const recentPeerMessages = [...messages]
    .reverse()
    .filter((message) => message.senderId !== 'player-local' && message.senderId !== 'system:socket' && message.senderId !== 'system')
    .slice(0, 4);

  return {
    onlineCount: Object.values(snapshot.presenceByActorId ?? {}).filter((entry) => entry.presence !== 'OFFLINE').length,
    activeMembers: Object.values(snapshot.presenceByActorId ?? {}).filter((entry) => entry.presence === 'ACTIVE').length,
    typingCount: Object.values(snapshot.typingByActorId ?? {}).filter((entry) => entry.typingState === 'STARTED').length,
    recentPeerNames: recentPeerMessages.map((message) => message.senderName).filter(Boolean),
    recentRanks: recentPeerMessages.map((message) => message.senderRank).filter(Boolean) as string[],
  };
}

export default function useCanonicalUnifiedChat(input: UseCanonicalUnifiedChatInput): UseChatEngineResult {
  const { ctx, engine, onSabotage } = input;

  const [shellOpen, setShellOpen] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [transcript, setTranscript] = useState<ChatTranscriptStateCompat>({
    open: false,
    searchQuery: '',
    selectedMessageId: null,
    newestFirst: false,
  });
  const [engineSnapshot, setEngineSnapshot] = useState(() => engine?.getSnapshot() ?? null);

  useEffect(() => {
    if (!engine) {
      setEngineSnapshot(null);
      return;
    }
    setEngineSnapshot(engine.getSnapshot());
    return engine.subscribe((snapshot) => {
      setEngineSnapshot(snapshot);
    });
  }, [engine]);

  useEffect(() => {
    if (!engine || !onSabotage) return;
    return engine.onEvent((event) => {
      if (event.name !== 'CHAT_MESSAGE_RECEIVED') return;
      const message = (event.payload as { message?: Record<string, unknown> })?.message;
      if (!message) return;
      const kind = String(message.kind ?? '');
      if (kind !== 'BOT_ATTACK' && kind !== 'BOT_TAUNT') return;
      onSabotage({
        botId: typeof message.senderId === 'string' ? message.senderId : undefined,
        botName: typeof message.senderName === 'string' ? message.senderName : undefined,
        attackType: typeof message.botSource === 'object' && message.botSource && 'attackType' in message.botSource
          ? String((message.botSource as Record<string, unknown>).attackType ?? '')
          : undefined,
        dialogue: typeof message.body === 'string' ? message.body : undefined,
        ts: typeof message.ts === 'number' ? message.ts : Date.now(),
        metadata: typeof message.metadata === 'object' && message.metadata ? message.metadata as Record<string, unknown> : undefined,
      });
    });
  }, [engine, onSabotage]);

  const fallbackActiveChannel = normalizeChatChannel(
    (ctx.activeChannel as string | undefined) ?? 'GLOBAL',
  );

  const activeChannel = normalizeChatChannel(
    (engineSnapshot?.activeVisibleChannel as string | undefined) ?? fallbackActiveChannel,
  );

  const allMessages = useMemo(
    () => (engineSnapshot ? flattenMessages(engineSnapshot) : []),
    [engineSnapshot],
  );

  const visibleMessages = useMemo(
    () => allMessages.filter((message) => normalizeChatChannel(message.channel) === activeChannel),
    [activeChannel, allMessages],
  );

  const unread = useMemo(() => {
    const notifications = engineSnapshot?.notifications?.unreadByChannel;
    return {
      GLOBAL: notifications?.GLOBAL ?? 0,
      SYNDICATE: notifications?.SYNDICATE ?? 0,
      DEAL_ROOM: notifications?.DEAL_ROOM ?? 0,
    };
  }, [engineSnapshot]);

  const totalUnread = (unread.GLOBAL ?? 0) + (unread.SYNDICATE ?? 0) + (unread.DEAL_ROOM ?? 0);
  const connectionState = toCompatConnectionState(engineSnapshot?.connection?.status);
  const connected = connectionState === 'CONNECTED' || connectionState === 'DEGRADED';
  const threat = useMemo(() => extractThreatSnapshot(visibleMessages), [visibleMessages]);
  const summaries = useMemo(() => buildChannelSummaries(allMessages, activeChannel), [activeChannel, allMessages]);
  const latestMessage = visibleMessages[visibleMessages.length - 1] ?? null;
  const latestPlayerMessage = [...visibleMessages].reverse().find((message) => message.kind === 'PLAYER') ?? null;
  const latestSystemMessage = [...visibleMessages].reverse().find((message) => message.kind === 'SYSTEM') ?? null;
  const latestThreatMessage = [...visibleMessages].reverse().find((message) => message.kind === 'BOT_ATTACK' || message.kind === 'BOT_TAUNT' || message.kind === 'CASCADE_ALERT') ?? null;

  const draft = engineSnapshot?.composer?.draftByChannel?.[activeChannel] ?? '';
  const maxChars = engineSnapshot?.composer?.maxLength ?? 280;
  const canSend = Boolean(engine) && !engineSnapshot?.composer?.disabled && draft.trim().length > 0;

  const switchTab = useCallback((tab: ChatChannel) => {
    if (!engine) return;
    engine.setVisibleChannel(normalizeChatChannel(tab) as any);
  }, [engine]);

  const sendMessage = useCallback((body: string) => {
    if (!engine) return;
    void engine.sendText(body, activeChannel as any);
  }, [activeChannel, engine]);

  const sendDraft = useCallback(() => {
    if (!engine || !draft.trim()) return;
    void engine.sendText(draft, activeChannel as any);
    engine.setDraft(activeChannel as any, '');
  }, [activeChannel, draft, engine]);

  const setDraft = useCallback((body: string) => {
    if (!engine) return;
    engine.setDraft(activeChannel as any, body);
  }, [activeChannel, engine]);

  const openChat = useCallback(() => {
    setShellOpen(true);
    setCollapsed(false);
    engine?.openPanel();
  }, [engine]);

  const closeChat = useCallback(() => {
    setShellOpen(false);
    engine?.closePanel();
  }, [engine]);

  const collapse = useCallback(() => {
    if (!engine) return;
    setCollapsed(true);
    engine.toggleCollapsed();
  }, [engine]);

  const expand = useCallback(() => {
    if (!engine) return;
    setCollapsed(false);
    engine.toggleCollapsed();
  }, [engine]);

  const clearUnread = useCallback((channel?: ChatChannel) => {
    if (!engine) return;
    if (channel) {
      engine.setVisibleChannel(normalizeChatChannel(channel) as any);
      return;
    }
    engine.setVisibleChannel(activeChannel as any);
  }, [activeChannel, engine]);

  const presence = useMemo(
    () => (engineSnapshot ? derivePresencePreview(allMessages, engineSnapshot) : {
      onlineCount: 0,
      activeMembers: 0,
      typingCount: 0,
      recentPeerNames: [],
      recentRanks: [],
    }),
    [allMessages, engineSnapshot],
  );

  const helperPrompt = threat.rescueNeeded
    ? {
        id: 'canonical-rescue-prompt',
        title: 'Stabilize the line',
        body: latestThreatMessage?.body ?? 'Pressure is rising. Slow down and respond cleanly.',
        severity: threat.band === 'SEVERE' ? 'CRITICAL' : 'WARNING',
        ctaLabel: 'Reply',
        suggestedReply: 'Stabilizing now.',
      }
    : undefined;

  return {
    messages: visibleMessages,
    allMessages,
    visibleMessages,
    recentMessages: visibleMessages.slice(-24),
    activeTab: activeChannel,
    activeChannel,
    activeSummary: summaries.find((summary) => summary.channel === activeChannel),
    chatOpen: shellOpen,
    collapsed,
    connected,
    connectionState,
    unread,
    totalUnread,
    switchTab,
    setActiveChannel: switchTab,
    toggleChat: () => setShellOpen((value) => !value),
    openChat,
    closeChat,
    collapse,
    expand,
    sendMessage,
    sendText: sendMessage,
    sendDraft,
    setDraft,
    appendDraft: (suffix: string) => setDraft(`${draft}${suffix}`),
    clearDraft: () => setDraft(''),
    quickReply: sendMessage,
    clearUnread,
    summaries,
    channels: summaries,
    threat,
    threatModel: threat,
    helperPrompt,
    presence,
    transcript,
    composer: {
      activeDraft: draft,
      charCount: draft.length,
      maxChars,
      canSend,
      isNearLimit: draft.length >= Math.floor(maxChars * 0.85),
      placeholder: `Transmit into ${activeChannel.toLowerCase()}…`,
    },
    latestMessage,
    latestPlayerMessage,
    latestSystemMessage,
    latestThreatMessage,
    mountState: {
      mountTarget: engineSnapshot?.activeMountTarget ?? 'GAME_BOARD',
      modeScope: String(ctx.currentMode ?? 'run'),
      storageNamespace: 'chat-engine-runtime',
    },
    runtimeBundle: {
      source: 'canonical-chat-engine',
      mounted: Boolean(engine),
      connectionStatus: engineSnapshot?.connection?.status ?? 'IDLE',
    },
    toggleTranscript: () => setTranscript((value) => ({ ...value, open: !value.open })),
    openTranscript: () => setTranscript((value) => ({ ...value, open: true })),
    closeTranscript: () => setTranscript((value) => ({ ...value, open: false })),
    setTranscriptSearchQuery: (query: string) => setTranscript((value) => ({ ...value, searchQuery: query })),
    selectTranscriptMessage: (messageId: string | null) => setTranscript((value) => ({ ...value, selectedMessageId: messageId })),
    jumpToLatest: () => setTranscript((value) => ({ ...value, selectedMessageId: latestMessage?.id ?? null })),
  };
}
