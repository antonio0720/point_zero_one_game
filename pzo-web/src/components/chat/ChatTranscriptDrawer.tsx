
/**
 * ============================================================================
 * POINT ZERO ONE — CHAT TRANSCRIPT DRAWER
 * FILE: pzo-web/src/components/chat/ChatTranscriptDrawer.tsx
 * ============================================================================
 *
 * Purpose
 * -------
 * Render-only transcript drawer for the unified chat shell.
 *
 * This file intentionally stays out of authority lanes:
 * - it does not own sockets
 * - it does not own transcript truth
 * - it does not mutate learning state
 * - it does not mount battle logic
 *
 * It renders the transcript window the engine gives it and adds dense UX for:
 * - search
 * - channel scoping
 * - message-kind filtering
 * - proof / lock filtering
 * - transcript summary metrics
 * - rich engine metadata rendering
 * - message jump callbacks back into the parent shell
 *
 * Performance posture
 * -------------------
 * Even though the current live hook keeps a 500-message client window, the drawer
 * is written with a lightweight virtualized viewport so it remains cheap during:
 * - aggressive event flushes
 * - high presence churn
 * - rapid hater bot intrusions
 * - transcript search / sort toggling
 *
 * Design doctrine
 * ---------------
 * - inline style system matching ChatPanel.tsx
 * - no Tailwind
 * - mobile-first and drawer-safe
 * - strong metadata legibility for proof, pressure, tick, shield, cascade, bot
 * - future-safe for extraction into the pzo-web/src/components/chat shell
 * ============================================================================
 */

import React, {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { CSSProperties } from 'react';
import type { ChatChannel, ChatMessage, GameChatContext } from './chatTypes';
import {
  ChatRoomHeader,
  type ChatRoomConnectionState,
} from './ChatRoomHeader';

type ChannelScope = 'ALL' | ChatChannel;
type KindScope = 'ALL' | ChatMessage['kind'];

export interface ChatTranscriptDrawerProps {
  open: boolean;
  messages: readonly ChatMessage[];
  activeChannel?: ChatChannel;
  roomTitle?: string;
  roomSubtitle?: string;
  modeName?: string;
  context?: Partial<GameChatContext>;
  connected?: boolean;
  connectionState?: ChatRoomConnectionState;
  onlineCount?: number;
  activeMembers?: number;
  typingCount?: number;
  totalUnread?: number;
  selectedMessageId?: string | null;
  transcriptLocked?: boolean;
  initialSearchQuery?: string;
  searchQuery?: string;
  onSearchQueryChange?: (value: string) => void;
  onClose: () => void;
  onJumpToMessage?: (messageId: string) => void;
  onRequestExport?: () => void;
}

type IndexedTranscriptMessage = {
  message: ChatMessage;
  searchBlob: string;
  derivedLabel: string;
  channelOrdinal: number;
};

type TranscriptMetrics = {
  total: number;
  proofBearing: number;
  immutable: number;
  botBacked: number;
  playerMessages: number;
  systemMessages: number;
};

const T = {
  void: '#030308',
  card: '#0C0C1E',
  cardHi: '#131328',
  cardEl: '#191934',
  border: 'rgba(255,255,255,0.08)',
  borderM: 'rgba(255,255,255,0.16)',
  text: '#F2F2FF',
  textSub: '#9090B4',
  textMut: '#505074',
  green: '#22DD88',
  red: '#FF4D4D',
  orange: '#FF8C00',
  yellow: '#FFD700',
  indigo: '#818CF8',
  teal: '#22D3EE',
  purple: '#A855F7',
  mono: "'IBM Plex Mono', 'JetBrains Mono', monospace",
  display: "'Syne', 'Outfit', system-ui, sans-serif",
};

const ITEM_ESTIMATE = 112;
const OVERSCAN_ROWS = 8;

const CHANNEL_META: Record<
  ChannelScope,
  { label: string; emoji: string; accent: string }
> = {
  ALL: { label: 'ALL CHANNELS', emoji: '🧾', accent: T.textSub },
  GLOBAL: { label: 'GLOBAL', emoji: '🌐', accent: T.indigo },
  SYNDICATE: { label: 'SYNDICATE', emoji: '🏛️', accent: T.teal },
  DEAL_ROOM: { label: 'DEAL ROOM', emoji: '⚡', accent: T.yellow },
};

const KIND_META: Record<
  KindScope,
  { label: string; accent: string; emoji: string }
> = {
  ALL: { label: 'ALL KINDS', accent: T.textSub, emoji: '🧠' },
  PLAYER: { label: 'PLAYER', accent: T.green, emoji: '💬' },
  SYSTEM: { label: 'SYSTEM', accent: T.indigo, emoji: '🛰️' },
  MARKET_ALERT: { label: 'MARKET', accent: T.orange, emoji: '📉' },
  ACHIEVEMENT: { label: 'ACHIEVE', accent: T.green, emoji: '🏆' },
  BOT_TAUNT: { label: 'TAUNT', accent: T.red, emoji: '😈' },
  BOT_ATTACK: { label: 'ATTACK', accent: T.red, emoji: '🧨' },
  SHIELD_EVENT: { label: 'SHIELD', accent: T.teal, emoji: '🛡️' },
  CASCADE_ALERT: { label: 'CASCADE', accent: T.purple, emoji: '🌀' },
  DEAL_RECAP: { label: 'RECAP', accent: T.yellow, emoji: '📜' },
};

const CHANNEL_ORDER: Record<ChatChannel, number> = {
  GLOBAL: 0,
  SYNDICATE: 1,
  DEAL_ROOM: 2,
};

const RANK_COLOR: Record<string, string> = {
  'Managing Partner': T.yellow,
  'Senior Partner': '#F6A623',
  'Partner': T.indigo,
  'Junior Partner': T.textSub,
  'Associate': T.textMut,
  You: T.green,
};

function normalizeText(value: string | undefined | null): string {
  return (value ?? '').trim().toLowerCase();
}

function fmtCompactCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return `${value}`;
}

function timeStampLabel(ts: number): string {
  return new Intl.DateTimeFormat([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    month: 'short',
    day: '2-digit',
  }).format(new Date(ts));
}

function relativeTime(ts: number): string {
  const delta = Date.now() - ts;
  const abs = Math.abs(delta);
  if (abs < 60_000) return `${Math.round(delta / 1_000)}s`;
  if (abs < 3_600_000) return `${Math.round(delta / 60_000)}m`;
  if (abs < 86_400_000) return `${Math.round(delta / 3_600_000)}h`;
  return `${Math.round(delta / 86_400_000)}d`;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function kindAccent(kind: ChatMessage['kind']): string {
  return KIND_META[kind].accent;
}

function channelAccent(channel: ChatChannel): string {
  return CHANNEL_META[channel].accent;
}

function searchBlobForMessage(msg: ChatMessage): string {
  const botBlob = msg.botSource
    ? [
        msg.botSource.botId,
        msg.botSource.botName,
        msg.botSource.botState,
        msg.botSource.attackType,
        msg.botSource.targetLayer,
        msg.botSource.dialogue,
      ].join(' ')
    : '';

  const shieldBlob = msg.shieldMeta
    ? [
        msg.shieldMeta.layerId,
        `${msg.shieldMeta.integrity}`,
        `${msg.shieldMeta.maxIntegrity}`,
        `${msg.shieldMeta.isBreached}`,
        msg.shieldMeta.attackId,
      ].join(' ')
    : '';

  const cascadeBlob = msg.cascadeMeta
    ? [
        msg.cascadeMeta.chainId,
        msg.cascadeMeta.severity,
        msg.cascadeMeta.direction,
      ].join(' ')
    : '';

  return normalizeText(
    [
      msg.id,
      msg.channel,
      msg.kind,
      msg.senderId,
      msg.senderName,
      msg.senderRank,
      msg.body,
      msg.emoji,
      msg.proofHash,
      msg.pressureTier,
      msg.tickTier,
      msg.runOutcome,
      botBlob,
      shieldBlob,
      cascadeBlob,
    ]
      .filter(Boolean)
      .join(' '),
  );
}

function derivedLabel(msg: ChatMessage): string {
  if (msg.kind === 'DEAL_RECAP') return 'Settlement proof';
  if (msg.kind === 'BOT_ATTACK') return 'Attack event';
  if (msg.kind === 'BOT_TAUNT') return 'Bot taunt';
  if (msg.kind === 'SHIELD_EVENT') return 'Shield movement';
  if (msg.kind === 'CASCADE_ALERT') return 'Cascade warning';
  if (msg.kind === 'MARKET_ALERT') return 'Market alert';
  if (msg.kind === 'ACHIEVEMENT') return 'Achievement';
  if (msg.kind === 'SYSTEM') return 'System notice';
  return 'Player message';
}

function metricChipStyle(accent: string): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    minHeight: 28,
    padding: '0 10px',
    borderRadius: 999,
    border: `1px solid ${accent}28`,
    background: `${accent}10`,
    whiteSpace: 'nowrap',
  };
}

function filterButtonStyle(active: boolean, accent: string): CSSProperties {
  return {
    minHeight: 32,
    padding: '0 10px',
    borderRadius: 10,
    border: `1px solid ${active ? `${accent}35` : 'rgba(255,255,255,0.08)'}`,
    background: active ? `${accent}14` : 'rgba(255,255,255,0.02)',
    color: active ? accent : T.textSub,
    cursor: 'pointer',
    fontFamily: T.mono,
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    transition:
      'transform 120ms ease, background 120ms ease, border-color 120ms ease, color 120ms ease',
    whiteSpace: 'nowrap',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  };
}

const TranscriptSystemCard = memo(function TranscriptSystemCard({
  message,
  selected,
  onJump,
}: {
  message: ChatMessage;
  selected: boolean;
  onJump?: (messageId: string) => void;
}) {
  const accent = kindAccent(message.kind);

  return (
    <button
      type="button"
      onClick={() => onJump?.(message.id)}
      style={{
        width: '100%',
        textAlign: 'left',
        display: 'flex',
        gap: 12,
        padding: '12px 12px 12px 10px',
        borderRadius: 12,
        border: `1px solid ${selected ? `${accent}50` : `${accent}22`}`,
        background: selected
          ? `${accent}18`
          : 'linear-gradient(180deg, rgba(25,25,52,0.96) 0%, rgba(12,12,30,0.96) 100%)',
        borderLeft: `3px solid ${accent}`,
        cursor: onJump ? 'pointer' : 'default',
        transition:
          'transform 120ms ease, border-color 120ms ease, background 120ms ease, box-shadow 120ms ease',
        boxShadow: selected ? `0 0 0 1px ${accent}18, 0 12px 26px rgba(0,0,0,0.30)` : 'none',
      }}
    >
      <div
        style={{
          width: 24,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          fontSize: 15,
          lineHeight: 1.4,
          paddingTop: 1,
        }}
      >
        {message.emoji ?? KIND_META[message.kind].emoji}
      </div>

      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
            marginBottom: 6,
          }}
        >
          <span
            style={{
              fontFamily: T.mono,
              fontSize: 8,
              letterSpacing: '0.10em',
              color: accent,
              textTransform: 'uppercase',
              fontWeight: 800,
            }}
          >
            {message.channel}
          </span>

          <span
            style={{
              fontFamily: T.mono,
              fontSize: 8,
              letterSpacing: '0.10em',
              color: T.textMut,
              textTransform: 'uppercase',
              fontWeight: 700,
            }}
          >
            {derivedLabel(message)}
          </span>

          <span
            style={{
              fontFamily: T.mono,
              fontSize: 8,
              color: T.textMut,
            }}
          >
            {timeStampLabel(message.ts)} • {relativeTime(message.ts)}
          </span>
        </div>

        <div
          style={{
            fontFamily: T.display,
            fontSize: 12,
            fontWeight: 700,
            lineHeight: 1.55,
            color: T.text,
            marginBottom: 8,
            wordBreak: 'break-word',
          }}
        >
          {message.body}
        </div>

        <div
          style={{
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontFamily: T.mono,
              fontSize: 8,
              letterSpacing: '0.08em',
              color: accent,
              textTransform: 'uppercase',
              background: `${accent}14`,
              border: `1px solid ${accent}24`,
              borderRadius: 999,
              padding: '3px 7px',
            }}
          >
            {message.kind}
          </span>

          {message.pressureTier ? (
            <span
              style={{
                fontFamily: T.mono,
                fontSize: 8,
                letterSpacing: '0.08em',
                color: T.orange,
                textTransform: 'uppercase',
                background: 'rgba(255,140,0,0.12)',
                border: '1px solid rgba(255,140,0,0.22)',
                borderRadius: 999,
                padding: '3px 7px',
              }}
            >
              {message.pressureTier}
            </span>
          ) : null}

          {message.tickTier ? (
            <span
              style={{
                fontFamily: T.mono,
                fontSize: 8,
                letterSpacing: '0.08em',
                color: T.indigo,
                textTransform: 'uppercase',
                background: 'rgba(129,140,248,0.12)',
                border: '1px solid rgba(129,140,248,0.22)',
                borderRadius: 999,
                padding: '3px 7px',
              }}
            >
              {message.tickTier}
            </span>
          ) : null}

          {message.immutable ? (
            <span
              style={{
                fontFamily: T.mono,
                fontSize: 8,
                letterSpacing: '0.08em',
                color: T.yellow,
                textTransform: 'uppercase',
                background: 'rgba(255,215,0,0.10)',
                border: '1px solid rgba(255,215,0,0.20)',
                borderRadius: 999,
                padding: '3px 7px',
              }}
            >
              🔒 Locked
            </span>
          ) : null}

          {message.proofHash ? (
            <span
              style={{
                fontFamily: T.mono,
                fontSize: 8,
                color: T.yellow,
                background: 'rgba(255,215,0,0.10)',
                border: '1px solid rgba(255,215,0,0.20)',
                borderRadius: 999,
                padding: '3px 7px',
              }}
            >
              HASH {message.proofHash.slice(0, 12)}…
            </span>
          ) : null}
        </div>

        {message.botSource || message.shieldMeta || message.cascadeMeta ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
              gap: 6,
              marginTop: 8,
            }}
          >
            {message.botSource ? (
              <div
                style={{
                  borderRadius: 10,
                  border: `1px solid ${T.border}`,
                  background: 'rgba(255,255,255,0.03)',
                  padding: '8px 9px',
                }}
              >
                <div
                  style={{
                    fontFamily: T.mono,
                    fontSize: 8,
                    letterSpacing: '0.10em',
                    color: T.red,
                    textTransform: 'uppercase',
                    fontWeight: 800,
                    marginBottom: 5,
                  }}
                >
                  Bot Source
                </div>
                <div style={{ fontFamily: T.display, fontSize: 11, color: T.text }}>
                  {message.botSource.botName}
                </div>
                <div style={{ fontFamily: T.mono, fontSize: 8, color: T.textMut, marginTop: 3 }}>
                  {message.botSource.botState} • {message.botSource.attackType}
                </div>
              </div>
            ) : null}

            {message.shieldMeta ? (
              <div
                style={{
                  borderRadius: 10,
                  border: `1px solid ${T.border}`,
                  background: 'rgba(255,255,255,0.03)',
                  padding: '8px 9px',
                }}
              >
                <div
                  style={{
                    fontFamily: T.mono,
                    fontSize: 8,
                    letterSpacing: '0.10em',
                    color: T.teal,
                    textTransform: 'uppercase',
                    fontWeight: 800,
                    marginBottom: 5,
                  }}
                >
                  Shield Meta
                </div>
                <div style={{ fontFamily: T.display, fontSize: 11, color: T.text }}>
                  {message.shieldMeta.layerId}
                </div>
                <div style={{ fontFamily: T.mono, fontSize: 8, color: T.textMut, marginTop: 3 }}>
                  {message.shieldMeta.integrity}/{message.shieldMeta.maxIntegrity}
                  {message.shieldMeta.isBreached ? ' • BREACHED' : ' • STABLE'}
                </div>
              </div>
            ) : null}

            {message.cascadeMeta ? (
              <div
                style={{
                  borderRadius: 10,
                  border: `1px solid ${T.border}`,
                  background: 'rgba(255,255,255,0.03)',
                  padding: '8px 9px',
                }}
              >
                <div
                  style={{
                    fontFamily: T.mono,
                    fontSize: 8,
                    letterSpacing: '0.10em',
                    color: T.purple,
                    textTransform: 'uppercase',
                    fontWeight: 800,
                    marginBottom: 5,
                  }}
                >
                  Cascade Meta
                </div>
                <div style={{ fontFamily: T.display, fontSize: 11, color: T.text }}>
                  {message.cascadeMeta.chainId}
                </div>
                <div style={{ fontFamily: T.mono, fontSize: 8, color: T.textMut, marginTop: 3 }}>
                  {message.cascadeMeta.severity} • {message.cascadeMeta.direction}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </button>
  );
});

const TranscriptPlayerCard = memo(function TranscriptPlayerCard({
  message,
  selected,
  onJump,
}: {
  message: ChatMessage;
  selected: boolean;
  onJump?: (messageId: string) => void;
}) {
  const isLocal = message.senderId === 'player-local';
  const rankColor = message.senderRank
    ? RANK_COLOR[message.senderRank] ?? T.textSub
    : T.textSub;
  const accent = isLocal ? T.indigo : channelAccent(message.channel);

  return (
    <button
      type="button"
      onClick={() => onJump?.(message.id)}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '11px 10px',
        borderRadius: 12,
        textAlign: 'left',
        border: `1px solid ${selected ? `${accent}40` : T.border}`,
        background: selected
          ? `${accent}14`
          : 'linear-gradient(180deg, rgba(12,12,30,0.96) 0%, rgba(25,25,52,0.96) 100%)',
        cursor: onJump ? 'pointer' : 'default',
        boxShadow: selected ? `0 0 0 1px ${accent}14, 0 12px 26px rgba(0,0,0,0.28)` : 'none',
        transition:
          'transform 120ms ease, border-color 120ms ease, background 120ms ease, box-shadow 120ms ease',
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: isLocal ? 'rgba(129,140,248,0.18)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${isLocal ? 'rgba(129,140,248,0.30)' : T.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: T.mono,
          fontSize: 9,
          fontWeight: 800,
          color: isLocal ? T.indigo : T.textSub,
          flexShrink: 0,
          marginTop: 2,
        }}
      >
        {initials(message.senderName)}
      </div>

      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexWrap: 'wrap',
            marginBottom: 5,
          }}
        >
          <span
            style={{
              fontFamily: T.mono,
              fontSize: 10,
              fontWeight: 800,
              color: isLocal ? T.green : T.text,
            }}
          >
            {message.senderName}
          </span>

          {message.senderRank ? (
            <span
              style={{
                fontFamily: T.mono,
                fontSize: 8,
                color: rankColor,
                fontWeight: 700,
              }}
            >
              {message.senderRank}
            </span>
          ) : null}

          <span
            style={{
              fontFamily: T.mono,
              fontSize: 8,
              color: T.textMut,
            }}
          >
            {message.channel}
          </span>

          <span
            style={{
              fontFamily: T.mono,
              fontSize: 8,
              color: T.textMut,
            }}
          >
            {timeStampLabel(message.ts)} • {relativeTime(message.ts)}
          </span>
        </div>

        <div
          style={{
            fontFamily: T.display,
            fontSize: 12,
            lineHeight: 1.55,
            color: T.text,
            wordBreak: 'break-word',
            marginBottom: 8,
          }}
        >
          {message.body}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              fontFamily: T.mono,
              fontSize: 8,
              letterSpacing: '0.08em',
              color: isLocal ? T.green : accent,
              textTransform: 'uppercase',
              background: `${isLocal ? T.green : accent}10`,
              border: `1px solid ${(isLocal ? T.green : accent)}24`,
              borderRadius: 999,
              padding: '3px 7px',
            }}
          >
            {isLocal ? 'LOCAL' : 'REMOTE'}
          </span>

          {message.immutable ? (
            <span
              style={{
                fontFamily: T.mono,
                fontSize: 8,
                letterSpacing: '0.08em',
                color: T.yellow,
                textTransform: 'uppercase',
                background: 'rgba(255,215,0,0.10)',
                border: '1px solid rgba(255,215,0,0.20)',
                borderRadius: 999,
                padding: '3px 7px',
              }}
            >
              🔒 Locked
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
});

const TranscriptRow = memo(function TranscriptRow({
  message,
  selected,
  onJump,
}: {
  message: ChatMessage;
  selected: boolean;
  onJump?: (messageId: string) => void;
}) {
  if (message.kind === 'PLAYER') {
    return <TranscriptPlayerCard message={message} selected={selected} onJump={onJump} />;
  }

  return <TranscriptSystemCard message={message} selected={selected} onJump={onJump} />;
});

export const ChatTranscriptDrawer = memo(function ChatTranscriptDrawer({
  open,
  messages,
  activeChannel = 'GLOBAL',
  roomTitle,
  roomSubtitle,
  modeName,
  context,
  connected,
  connectionState,
  onlineCount,
  activeMembers,
  typingCount,
  totalUnread,
  selectedMessageId,
  transcriptLocked,
  initialSearchQuery = '',
  searchQuery,
  onSearchQueryChange,
  onClose,
  onJumpToMessage,
  onRequestExport,
}: ChatTranscriptDrawerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const [internalSearch, setInternalSearch] = useState(initialSearchQuery);
  const [channelScope, setChannelScope] = useState<ChannelScope>(activeChannel);
  const [kindScope, setKindScope] = useState<KindScope>('ALL');
  const [proofOnly, setProofOnly] = useState(false);
  const [lockedOnly, setLockedOnly] = useState(false);
  const [newestFirst, setNewestFirst] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(640);

  const effectiveSearch = searchQuery ?? internalSearch;

  const setSearch = useCallback(
    (value: string) => {
      if (searchQuery === undefined) {
        setInternalSearch(value);
      }
      onSearchQueryChange?.(value);
    },
    [searchQuery, onSearchQueryChange],
  );

  useEffect(() => {
    setChannelScope(activeChannel);
  }, [activeChannel]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }

      if (event.key === 'End') {
        event.preventDefault();
        const node = containerRef.current;
        if (node) node.scrollTop = node.scrollHeight;
        return;
      }

      if (event.key === 'Home') {
        event.preventDefault();
        const node = containerRef.current;
        if (node) node.scrollTop = 0;
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  useLayoutEffect(() => {
    if (!open) return;
    const node = containerRef.current;
    if (!node) return;

    const syncViewport = () => {
      setViewportHeight(node.clientHeight);
      setScrollTop(node.scrollTop);
    };

    syncViewport();

    const onScroll = () => setScrollTop(node.scrollTop);
    node.addEventListener('scroll', onScroll, { passive: true });

    const observer = new ResizeObserver(syncViewport);
    observer.observe(node);

    return () => {
      node.removeEventListener('scroll', onScroll);
      observer.disconnect();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      searchRef.current?.focus();
      searchRef.current?.select();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  const indexedMessages = useMemo<IndexedTranscriptMessage[]>(() => {
    return [...messages]
      .sort((a, b) => a.ts - b.ts)
      .map((message) => ({
        message,
        searchBlob: searchBlobForMessage(message),
        derivedLabel: derivedLabel(message),
        channelOrdinal: CHANNEL_ORDER[message.channel],
      }));
  }, [messages]);

  const metrics = useMemo<TranscriptMetrics>(() => {
    let proofBearing = 0;
    let immutable = 0;
    let botBacked = 0;
    let playerMessages = 0;
    let systemMessages = 0;

    for (const { message } of indexedMessages) {
      if (message.proofHash) proofBearing += 1;
      if (message.immutable) immutable += 1;
      if (message.botSource) botBacked += 1;
      if (message.kind === 'PLAYER') playerMessages += 1;
      else systemMessages += 1;
    }

    return {
      total: indexedMessages.length,
      proofBearing,
      immutable,
      botBacked,
      playerMessages,
      systemMessages,
    };
  }, [indexedMessages]);

  const filteredMessages = useMemo(() => {
    const search = normalizeText(effectiveSearch);

    const next = indexedMessages.filter(({ message, searchBlob }) => {
      if (channelScope !== 'ALL' && message.channel !== channelScope) return false;
      if (kindScope !== 'ALL' && message.kind !== kindScope) return false;
      if (proofOnly && !message.proofHash) return false;
      if (lockedOnly && !message.immutable) return false;
      if (search && !searchBlob.includes(search)) return false;
      return true;
    });

    next.sort((a, b) => {
      if (newestFirst) return b.message.ts - a.message.ts;
      return a.message.ts - b.message.ts;
    });

    return next;
  }, [indexedMessages, effectiveSearch, channelScope, kindScope, proofOnly, lockedOnly, newestFirst]);

  const selectedIndex = useMemo(() => {
    if (!selectedMessageId) return -1;
    return filteredMessages.findIndex((entry) => entry.message.id === selectedMessageId);
  }, [filteredMessages, selectedMessageId]);

  useEffect(() => {
    if (!open) return;
    if (selectedIndex < 0) return;
    const node = containerRef.current;
    if (!node) return;

    const desired = Math.max(0, selectedIndex * ITEM_ESTIMATE - node.clientHeight * 0.35);
    node.scrollTo({ top: desired, behavior: 'smooth' });
  }, [open, selectedIndex]);

  const totalRows = filteredMessages.length;
  const visibleStart = Math.max(0, Math.floor(scrollTop / ITEM_ESTIMATE) - OVERSCAN_ROWS);
  const visibleCount = Math.ceil(viewportHeight / ITEM_ESTIMATE) + OVERSCAN_ROWS * 2;
  const visibleEnd = Math.min(totalRows, visibleStart + visibleCount);

  const topSpacer = visibleStart * ITEM_ESTIMATE;
  const bottomSpacer = Math.max(0, (totalRows - visibleEnd) * ITEM_ESTIMATE);
  const visibleSlice = filteredMessages.slice(visibleStart, visibleEnd);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Chat transcript drawer"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 75,
        display: 'flex',
        justifyContent: 'flex-end',
        background: 'rgba(0,0,0,0.58)',
        backdropFilter: 'blur(8px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          position: 'relative',
          width: 'min(100vw, 560px)',
          height: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          background: `linear-gradient(180deg, rgba(3,3,8,0.995) 0%, rgba(12,12,30,0.99) 100%)`,
          borderLeft: `1px solid ${T.borderM}`,
          boxShadow: '-20px 0 60px rgba(0,0,0,0.62)',
          overflow: 'hidden',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <ChatRoomHeader
          channel={channelScope === 'ALL' ? activeChannel : channelScope}
          variant="drawer"
          connected={connected}
          connectionState={connectionState}
          roomTitle={roomTitle ?? 'TRANSCRIPT DRAWER'}
          roomSubtitle={
            roomSubtitle ??
            'Searchable, proof-aware, filterable replay lane for the current frontend transcript window.'
          }
          modeName={modeName}
          context={context}
          onlineCount={onlineCount}
          activeMembers={activeMembers}
          typingCount={typingCount}
          totalUnread={totalUnread}
          transcriptLocked={transcriptLocked || channelScope === 'DEAL_ROOM'}
          showTranscriptAction={false}
          showPinAction={false}
          showJumpLatestAction={true}
          showMinimizeAction={true}
          onJumpLatest={() => {
            const node = containerRef.current;
            if (!node) return;
            node.scrollTo({ top: newestFirst ? 0 : node.scrollHeight, behavior: 'smooth' });
          }}
          onMinimize={onClose}
          rightSlot={
            onRequestExport ? (
              <button
                type="button"
                onClick={onRequestExport}
                style={{
                  minHeight: 34,
                  padding: '0 11px',
                  borderRadius: 10,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  border: `1px solid rgba(255,255,255,0.08)`,
                  background: 'rgba(255,255,255,0.03)',
                  color: T.textSub,
                  cursor: 'pointer',
                  fontFamily: T.mono,
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
                title="Request transcript export"
              >
                ⤴︎ Export
              </button>
            ) : null
          }
        />

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            padding: '12px 14px',
            borderBottom: `1px solid ${T.border}`,
            background: 'rgba(19,19,40,0.55)',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) auto',
              gap: 10,
              alignItems: 'center',
            }}
          >
            <div
              style={{
                position: 'relative',
                minWidth: 0,
              }}
            >
              <input
                ref={searchRef}
                value={effectiveSearch}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search body, sender, proof hash, bot state, shield layer, cascade id..."
                spellCheck={false}
                style={{
                  width: '100%',
                  minHeight: 42,
                  padding: '0 42px 0 14px',
                  borderRadius: 12,
                  border: `1px solid ${T.borderM}`,
                  background: 'rgba(12,12,30,0.94)',
                  color: T.text,
                  outline: 'none',
                  fontFamily: T.display,
                  fontSize: 12,
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: T.textMut,
                  fontSize: 14,
                }}
              >
                ⌕
              </span>
            </div>

            <button
              type="button"
              onClick={() => setNewestFirst((current) => !current)}
              style={filterButtonStyle(newestFirst, T.indigo)}
              title="Toggle newest-first ordering"
            >
              {newestFirst ? '↓' : '↑'} {newestFirst ? 'Newest' : 'Chrono'}
            </button>
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              alignItems: 'center',
            }}
          >
            {(['ALL', 'GLOBAL', 'SYNDICATE', 'DEAL_ROOM'] as ChannelScope[]).map((scope) => (
              <button
                key={scope}
                type="button"
                onClick={() => setChannelScope(scope)}
                style={filterButtonStyle(channelScope === scope, CHANNEL_META[scope].accent)}
              >
                <span>{CHANNEL_META[scope].emoji}</span>
                <span>{CHANNEL_META[scope].label}</span>
              </button>
            ))}
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              alignItems: 'center',
            }}
          >
            {(['ALL', 'PLAYER', 'SYSTEM', 'MARKET_ALERT', 'ACHIEVEMENT', 'BOT_TAUNT', 'BOT_ATTACK', 'SHIELD_EVENT', 'CASCADE_ALERT', 'DEAL_RECAP'] as KindScope[]).map(
              (scope) => (
                <button
                  key={scope}
                  type="button"
                  onClick={() => setKindScope(scope)}
                  style={filterButtonStyle(kindScope === scope, KIND_META[scope].accent)}
                >
                  <span>{KIND_META[scope].emoji}</span>
                  <span>{KIND_META[scope].label}</span>
                </button>
              ),
            )}

            <button
              type="button"
              onClick={() => setProofOnly((current) => !current)}
              style={filterButtonStyle(proofOnly, T.yellow)}
            >
              🔒 Proof only
            </button>

            <button
              type="button"
              onClick={() => setLockedOnly((current) => !current)}
              style={filterButtonStyle(lockedOnly, T.yellow)}
            >
              📜 Locked only
            </button>
          </div>

          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <div style={metricChipStyle(T.indigo)}>
              <span
                style={{
                  fontFamily: T.mono,
                  fontSize: 8,
                  letterSpacing: '0.10em',
                  color: T.indigo,
                  textTransform: 'uppercase',
                  fontWeight: 800,
                }}
              >
                Visible
              </span>
              <span
                style={{
                  fontFamily: T.mono,
                  fontSize: 10,
                  color: T.text,
                  fontWeight: 700,
                }}
              >
                {fmtCompactCount(filteredMessages.length)}
              </span>
            </div>

            <div style={metricChipStyle(T.yellow)}>
              <span
                style={{
                  fontFamily: T.mono,
                  fontSize: 8,
                  letterSpacing: '0.10em',
                  color: T.yellow,
                  textTransform: 'uppercase',
                  fontWeight: 800,
                }}
              >
                Proof
              </span>
              <span
                style={{
                  fontFamily: T.mono,
                  fontSize: 10,
                  color: T.text,
                  fontWeight: 700,
                }}
              >
                {fmtCompactCount(metrics.proofBearing)}
              </span>
            </div>

            <div style={metricChipStyle(T.teal)}>
              <span
                style={{
                  fontFamily: T.mono,
                  fontSize: 8,
                  letterSpacing: '0.10em',
                  color: T.teal,
                  textTransform: 'uppercase',
                  fontWeight: 800,
                }}
              >
                Player
              </span>
              <span
                style={{
                  fontFamily: T.mono,
                  fontSize: 10,
                  color: T.text,
                  fontWeight: 700,
                }}
              >
                {fmtCompactCount(metrics.playerMessages)}
              </span>
            </div>

            <div style={metricChipStyle(T.red)}>
              <span
                style={{
                  fontFamily: T.mono,
                  fontSize: 8,
                  letterSpacing: '0.10em',
                  color: T.red,
                  textTransform: 'uppercase',
                  fontWeight: 800,
                }}
              >
                Bot-backed
              </span>
              <span
                style={{
                  fontFamily: T.mono,
                  fontSize: 10,
                  color: T.text,
                  fontWeight: 700,
                }}
              >
                {fmtCompactCount(metrics.botBacked)}
              </span>
            </div>

            <div style={metricChipStyle(T.textSub)}>
              <span
                style={{
                  fontFamily: T.mono,
                  fontSize: 8,
                  letterSpacing: '0.10em',
                  color: T.textSub,
                  textTransform: 'uppercase',
                  fontWeight: 800,
                }}
              >
                Total buffer
              </span>
              <span
                style={{
                  fontFamily: T.mono,
                  fontSize: 10,
                  color: T.text,
                  fontWeight: 700,
                }}
              >
                {fmtCompactCount(metrics.total)}
              </span>
            </div>
          </div>
        </div>

        <div
          ref={containerRef}
          className="pzo-chat-transcript-scroll"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px 14px 20px',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(255,255,255,0.10) transparent',
          }}
        >
          {filteredMessages.length === 0 ? (
            <div
              style={{
                minHeight: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: 12,
                color: T.textMut,
                textAlign: 'center',
                padding: '20px',
              }}
            >
              <span style={{ fontSize: 28 }}>∅</span>
              <div
                style={{
                  fontFamily: T.mono,
                  fontSize: 10,
                  letterSpacing: '0.10em',
                  textTransform: 'uppercase',
                }}
              >
                No transcript entries match this filter stack
              </div>
              <div
                style={{
                  fontFamily: T.display,
                  fontSize: 12,
                  lineHeight: 1.5,
                  maxWidth: 320,
                  color: T.textSub,
                }}
              >
                Clear search terms, widen the channel scope, or remove proof / lock gating to bring
                transcript entries back into view.
              </div>
            </div>
          ) : (
            <div style={{ minHeight: '100%', position: 'relative' }}>
              {topSpacer > 0 ? <div style={{ height: topSpacer }} /> : null}

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                {visibleSlice.map(({ message }, localIndex) => {
                  const absoluteIndex = visibleStart + localIndex;
                  return (
                    <TranscriptRow
                      key={message.id}
                      message={message}
                      selected={absoluteIndex === selectedIndex}
                      onJump={onJumpToMessage}
                    />
                  );
                })}
              </div>

              {bottomSpacer > 0 ? <div style={{ height: bottomSpacer }} /> : null}
            </div>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            padding: '10px 14px',
            borderTop: `1px solid ${T.border}`,
            background: 'rgba(12,12,30,0.92)',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontFamily: T.display,
              fontSize: 11,
              lineHeight: 1.45,
              color: T.textSub,
              minWidth: 0,
            }}
          >
            Transcript drawer stays render-only. Message truth, replay permanence, moderation, and
            learning updates remain outside this file.
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              minHeight: 36,
              padding: '0 12px',
              borderRadius: 10,
              border: `1px solid ${T.borderM}`,
              background: 'rgba(255,255,255,0.03)',
              color: T.textSub,
              cursor: 'pointer',
              fontFamily: T.mono,
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
});

export default ChatTranscriptDrawer;
