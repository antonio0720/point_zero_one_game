// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/components/chat/ChatMessageFeed.tsx

/**
 * ============================================================================
 * POINT ZERO ONE — UNIFIED CHAT MESSAGE FEED
 * FILE: pzo-web/src/components/chat/ChatMessageFeed.tsx
 * ============================================================================
 *
 * Render-only transcript/feed primitive for the unified chat shell.
 *
 * This file stays in the presentation lane.
 * It does not:
 * - own sockets,
 * - decide NPC cadence,
 * - mutate the learning profile,
 * - enforce moderation,
 * - select helper timing,
 * - rank hater responses,
 * - or become transcript authority.
 *
 * It does:
 * - render messages with premium hierarchy,
 * - expose proof/tick/pressure metadata,
 * - keep unread state visible,
 * - support windowed rendering,
 * - group by time/day,
 * - preserve deal-room integrity signaling,
 * - and provide a clean surface for engine-fed transcript state.
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ============================================================================
 */

import React, {
  memo,
  useMemo,
  useRef,
  useEffect,
  useState,
  useCallback,
  type CSSProperties,
  type UIEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';

import type { ChatChannel, ChatMessage } from './chatTypes';

export type FeedDensity = 'compact' | 'comfortable' | 'cinematic';
export type FeedFollowMode = 'AUTO' | 'LOCKED' | 'MANUAL';
export type FeedThreatBand = 'QUIET' | 'LOW' | 'ELEVATED' | 'HIGH' | 'SEVERE';

export interface FeedPresenceSummary {
  online: number;
  typing: number;
  watchers?: number;
}

export interface FeedEmptyState {
  title: string;
  body: string;
  emoji?: string;
}

export interface FeedActionDescriptor {
  id: string;
  label: string;
  danger?: boolean;
}

export interface FeedMetaLine {
  id: string;
  label: string;
  value: string;
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
}

export interface ChatMessageFeedProps {
  channel: ChatChannel;
  messages: ChatMessage[];
  currentUserId?: string;
  connected?: boolean;
  unreadCount?: number;
  newestFirst?: boolean;
  density?: FeedDensity;
  followMode?: FeedFollowMode;
  maxWindow?: number;
  transcriptImmutable?: boolean;
  threatBand?: FeedThreatBand;
  presenceSummary?: FeedPresenceSummary | null;
  emptyState?: FeedEmptyState | null;
  diagnosticLines?: FeedMetaLine[];
  showDiagnostics?: boolean;
  showJumpToLatest?: boolean;
  showPresenceHeader?: boolean;
  showChannelHeader?: boolean;
  showLoadOlder?: boolean;
  showProofHashes?: boolean;
  showKindBadges?: boolean;
  showTickPressureBadges?: boolean;
  showMetaRail?: boolean;
  forceCompact?: boolean;
  className?: string;
  style?: CSSProperties;
  onLoadOlder?: () => void;
  onJumpToLatest?: () => void;
  onSelectMessage?: (message: ChatMessage) => void;
  onSelectSender?: (senderId: string, message: ChatMessage) => void;
  onRequestTranscript?: () => void;
  onVisibleRangeChange?: (range: { startIndex: number; endIndex: number; total: number }) => void;
  onMessageAction?: (actionId: string, message: ChatMessage) => void;
  messageActions?: FeedActionDescriptor[];
}

type NormalizedMessageKind =
  | 'PLAYER'
  | 'SYSTEM'
  | 'MARKET_ALERT'
  | 'ACHIEVEMENT'
  | 'BOT_TAUNT'
  | 'BOT_ATTACK'
  | 'SHIELD_EVENT'
  | 'CASCADE_ALERT'
  | 'DEAL_RECAP'
  | 'UNKNOWN';

type NormalizedMessage = ChatMessage & {
  safeId: string;
  safeChannel: ChatChannel;
  safeKind: NormalizedMessageKind;
  safeSenderId: string;
  safeSenderName: string;
  safeBody: string;
  safeTs: number;
  safeImmutable: boolean;
  isMine: boolean;
  isSystem: boolean;
  isRecorded: boolean;
};

type TranscriptRow =
  | { type: 'day'; key: string; label: string }
  | { type: 'time'; key: string; label: string }
  | { type: 'unread'; key: string; count: number }
  | { type: 'message'; key: string; message: NormalizedMessage; compactJoinAbove: boolean; compactJoinBelow: boolean };

type KindPalette = {
  bar: string;
  bg: string;
  border: string;
  text: string;
  accent: string;
};

const T = {
  void: '#04040A',
  panel: '#0B0B18',
  card: '#101024',
  cardHi: '#17172E',
  border: 'rgba(255,255,255,0.09)',
  borderHi: 'rgba(255,255,255,0.18)',
  text: '#F4F4FF',
  textSub: '#A7A7C8',
  textMute: '#68688C',
  success: '#27DE8B',
  successSoft: 'rgba(39,222,139,0.16)',
  warning: '#FFBA52',
  warningSoft: 'rgba(255,186,82,0.16)',
  danger: '#FF5F6D',
  dangerSoft: 'rgba(255,95,109,0.18)',
  info: '#67C9FF',
  infoSoft: 'rgba(103,201,255,0.16)',
  indigo: '#8A8EFF',
  indigoSoft: 'rgba(138,142,255,0.16)',
  teal: '#25D3EE',
  tealSoft: 'rgba(37,211,238,0.16)',
  purple: '#A855F7',
  purpleSoft: 'rgba(168,85,247,0.16)',
  yellow: '#FACC15',
  orange: '#FB923C',
  green: '#34D399',
  mono: "'IBM Plex Mono', 'JetBrains Mono', monospace",
  display: "'Syne', 'Outfit', system-ui, sans-serif",
  shadow: '0 12px 36px rgba(0,0,0,0.34)',
};

const KIND_PALETTE: Record<NormalizedMessageKind, KindPalette> = {
  PLAYER: {
    bar: 'transparent',
    bg: 'transparent',
    border: 'transparent',
    text: T.textSub,
    accent: T.textSub,
  },
  SYSTEM: {
    bar: T.indigo,
    bg: T.indigoSoft,
    border: 'rgba(138,142,255,0.22)',
    text: T.indigo,
    accent: T.indigo,
  },
  MARKET_ALERT: {
    bar: T.orange,
    bg: T.warningSoft,
    border: 'rgba(251,146,60,0.22)',
    text: T.orange,
    accent: T.orange,
  },
  ACHIEVEMENT: {
    bar: T.success,
    bg: T.successSoft,
    border: 'rgba(39,222,139,0.22)',
    text: T.success,
    accent: T.success,
  },
  BOT_TAUNT: {
    bar: T.danger,
    bg: T.dangerSoft,
    border: 'rgba(255,95,109,0.22)',
    text: T.danger,
    accent: T.danger,
  },
  BOT_ATTACK: {
    bar: T.danger,
    bg: 'rgba(255,95,109,0.22)',
    border: 'rgba(255,95,109,0.34)',
    text: T.danger,
    accent: T.danger,
  },
  SHIELD_EVENT: {
    bar: T.teal,
    bg: T.tealSoft,
    border: 'rgba(37,211,238,0.22)',
    text: T.teal,
    accent: T.teal,
  },
  CASCADE_ALERT: {
    bar: T.purple,
    bg: T.purpleSoft,
    border: 'rgba(168,85,247,0.22)',
    text: T.purple,
    accent: T.purple,
  },
  DEAL_RECAP: {
    bar: T.yellow,
    bg: 'rgba(250,204,21,0.14)',
    border: 'rgba(250,204,21,0.22)',
    text: T.yellow,
    accent: T.yellow,
  },
  UNKNOWN: {
    bar: T.textMute,
    bg: 'rgba(255,255,255,0.03)',
    border: T.border,
    text: T.textSub,
    accent: T.textSub,
  },
};

const CHANNEL_COPY: Record<ChatChannel, { title: string; sub: string; }> = {
  GLOBAL: {
    title: 'GLOBAL CHANNEL',
    sub: 'Fast, visible, theatrical. Crowd reactions move first here.',
  },
  SYNDICATE: {
    title: 'SYNDICATE CHANNEL',
    sub: 'Tactical, intimate, alliance-sensitive. Signal quality matters.',
  },
  DEAL_ROOM: {
    title: 'DEAL ROOM',
    sub: 'Predatory, recorded, and reputationally expensive. Every line can become a receipt.',
  },
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function safeString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function normalizedKind(kind: unknown): NormalizedMessageKind {
  switch (kind) {
    case 'PLAYER':
    case 'SYSTEM':
    case 'MARKET_ALERT':
    case 'ACHIEVEMENT':
    case 'BOT_TAUNT':
    case 'BOT_ATTACK':
    case 'SHIELD_EVENT':
    case 'CASCADE_ALERT':
    case 'DEAL_RECAP':
      return kind;
    default:
      return 'UNKNOWN';
  }
}

function normalizeMessage(message: ChatMessage, channel: ChatChannel, currentUserId?: string): NormalizedMessage {
  const safeId = safeString((message as ChatMessage).id, `msg-${Math.random().toString(36).slice(2)}`);
  const safeChannel = (message.channel || channel) as ChatChannel;
  const safeKind = normalizedKind(message.kind);
  const safeSenderId = safeString(message.senderId, 'unknown-sender');
  const safeSenderName = safeString(message.senderName, 'Unknown');
  const safeBody = safeString(message.body, '');
  const safeTs = typeof message.ts === 'number' && Number.isFinite(message.ts) ? message.ts : Date.now();
  const safeImmutable = !!message.immutable;
  const isSystem = safeKind !== 'PLAYER';
  const isRecorded = safeKind === 'DEAL_RECAP' || safeImmutable || safeChannel === 'DEAL_ROOM';
  return {
    ...message,
    safeId,
    safeChannel,
    safeKind,
    safeSenderId,
    safeSenderName,
    safeBody,
    safeTs,
    safeImmutable,
    isMine: !!currentUserId && safeSenderId === currentUserId,
    isSystem,
    isRecorded,
  };
}

function sortMessages(messages: NormalizedMessage[], newestFirst: boolean): NormalizedMessage[] {
  const next = [...messages].sort((a, b) => a.safeTs - b.safeTs);
  return newestFirst ? next.reverse() : next;
}

function timeLabel(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function dayLabel(ts: number): string {
  const now = new Date();
  const day = new Date(ts);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const target = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  const diffDays = Math.round((today - target) / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return 'TODAY';
  if (diffDays === 1) return 'YESTERDAY';
  return day.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
}

function minuteBucket(ts: number): number {
  const d = new Date(ts);
  d.setSeconds(0, 0);
  return d.getTime();
}

function senderInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '??';
  const parts = trimmed.split(/\s+/g).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

function rankColor(rank?: string): string {
  if (!rank) return T.textSub;
  const safe = rank.toLowerCase();
  if (safe.includes('managing')) return T.yellow;
  if (safe.includes('senior')) return T.orange;
  if (safe.includes('partner')) return T.indigo;
  if (safe.includes('junior')) return T.info;
  if (safe.includes('associate')) return T.textSub;
  if (safe.includes('you')) return T.success;
  return T.textSub;
}

function densityPadding(density: FeedDensity, compact: boolean): { bubble: string; system: string; rowGap: number; } {
  if (compact || density === 'compact') {
    return { bubble: '10px 12px', system: '10px 12px', rowGap: 6 };
  }
  if (density === 'cinematic') {
    return { bubble: '15px 18px', system: '14px 16px', rowGap: 12 };
  }
  return { bubble: '12px 14px', system: '12px 14px', rowGap: 9 };
}

function toneColor(tone: FeedMetaLine['tone']): string {
  switch (tone) {
    case 'success':
      return T.success;
    case 'warning':
      return T.warning;
    case 'danger':
      return T.danger;
    case 'info':
      return T.info;
    default:
      return T.textSub;
  }
}

function buildRows(
  messages: NormalizedMessage[],
  newestFirst: boolean,
  unreadCount: number,
): TranscriptRow[] {
  const rows: TranscriptRow[] = [];
  const insertionIndex = unreadCount > 0
    ? clamp(messages.length - unreadCount, 0, messages.length)
    : -1;

  for (let i = 0; i < messages.length; i += 1) {
    const current = messages[i]!;
    const prev = messages[i - 1];
    const next = messages[i + 1];

    if (i === insertionIndex && unreadCount > 0 && !newestFirst) {
      rows.push({ type: 'unread', key: `unread-${current.safeId}`, count: unreadCount });
    }

    if (!prev || dayLabel(prev.safeTs) !== dayLabel(current.safeTs)) {
      rows.push({ type: 'day', key: `day-${current.safeId}`, label: dayLabel(current.safeTs) });
    }

    if (!prev || minuteBucket(prev.safeTs) !== minuteBucket(current.safeTs)) {
      rows.push({ type: 'time', key: `time-${current.safeId}`, label: timeLabel(current.safeTs) });
    }

    const compactJoinAbove = !!prev
      && !current.isSystem
      && !prev.isSystem
      && prev.safeSenderId === current.safeSenderId
      && Math.abs(current.safeTs - prev.safeTs) < 120000;

    const compactJoinBelow = !!next
      && !current.isSystem
      && !next.isSystem
      && next.safeSenderId === current.safeSenderId
      && Math.abs(next.safeTs - current.safeTs) < 120000;

    rows.push({
      type: 'message',
      key: current.safeId,
      message: current,
      compactJoinAbove,
      compactJoinBelow,
    });

    if (i === insertionIndex && unreadCount > 0 && newestFirst) {
      rows.push({ type: 'unread', key: `unread-${current.safeId}`, count: unreadCount });
    }
  }

  return rows;
}

function actionButtonStyle(danger?: boolean): CSSProperties {
  return {
    appearance: 'none',
    border: `1px solid ${danger ? `${T.danger}33` : T.border}`,
    background: danger ? T.dangerSoft : 'rgba(255,255,255,0.03)',
    color: danger ? T.danger : T.textSub,
    borderRadius: 10,
    height: 28,
    padding: '0 10px',
    cursor: 'pointer',
    fontFamily: T.mono,
    fontSize: 10,
    letterSpacing: '0.08em',
  };
}

const ChannelHeader = memo(function ChannelHeader({ channel, transcriptImmutable, threatBand, presenceSummary }: { channel: ChatChannel; transcriptImmutable: boolean; threatBand: FeedThreatBand; presenceSummary: FeedPresenceSummary | null; }) {
  const copy = CHANNEL_COPY[channel];
  const threatColor = threatBand === 'SEVERE' ? T.danger : threatBand === 'HIGH' ? T.orange : threatBand === 'ELEVATED' ? T.warning : threatBand === 'LOW' ? T.info : T.textSub;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: T.display, fontWeight: 800, fontSize: 12, letterSpacing: '0.14em', color: channel === 'DEAL_ROOM' ? T.yellow : channel === 'SYNDICATE' ? T.green : T.indigo }}>
            {copy.title}
          </span>
          <span style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: '0.10em', color: threatColor }}>
            {threatBand}
          </span>
          {transcriptImmutable && <span style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: '0.10em', color: T.yellow }}>IMMUTABLE</span>}
        </div>
        <div style={{ fontFamily: T.mono, fontSize: 10, color: T.textMute, marginTop: 4 }}>{copy.sub}</div>
      </div>
      {presenceSummary && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: '0.10em', color: T.success }}>ONLINE {presenceSummary.online}</div>
          <div style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: '0.10em', color: T.info }}>TYPING {presenceSummary.typing}</div>
          {typeof presenceSummary.watchers === 'number' && <div style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: '0.10em', color: T.warning }}>WATCHERS {presenceSummary.watchers}</div>}
        </div>
      )}
    </div>
  );
});

const DividerRow = memo(function DividerRow({ label }: { label: string; }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 10, alignItems: 'center', padding: '6px 0' }}>
      <div style={{ height: 1, background: 'rgba(255,255,255,0.08)' }} />
      <div style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: '0.14em', color: T.textMute }}>{label}</div>
      <div style={{ height: 1, background: 'rgba(255,255,255,0.08)' }} />
    </div>
  );
});

const UnreadDivider = memo(function UnreadDivider({ count }: { count: number; }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 10, alignItems: 'center', padding: '8px 0' }}>
      <div style={{ height: 1, background: `${T.indigo}55` }} />
      <div style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: '0.14em', color: T.indigo }}>
        {count} UNREAD
      </div>
      <div style={{ height: 1, background: `${T.indigo}55` }} />
    </div>
  );
});

const EmptyStateCard = memo(function EmptyStateCard({ state }: { state: FeedEmptyState; }) {
  return (
    <div style={{ borderRadius: 18, border: `1px dashed ${T.borderHi}`, background: 'rgba(255,255,255,0.03)', minHeight: 220, display: 'grid', placeItems: 'center', padding: 20 }}>
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        <div style={{ fontSize: 30, marginBottom: 12 }}>{state.emoji ?? '∅'}</div>
        <div style={{ fontFamily: T.display, fontWeight: 800, fontSize: 18, color: T.text, marginBottom: 8 }}>{state.title}</div>
        <div style={{ fontFamily: T.display, fontSize: 13, lineHeight: 1.65, color: T.textSub }}>{state.body}</div>
      </div>
    </div>
  );
});

const MetaBadge = memo(function MetaBadge({ label, color, bg }: { label: string; color: string; bg: string; }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', height: 24, padding: '0 8px', borderRadius: 999, border: `1px solid ${color}33`, background: bg, fontFamily: T.mono, fontSize: 10, letterSpacing: '0.08em', color }}>
      {label}
    </div>
  );
});

const ProofHash = memo(function ProofHash({ hash }: { hash?: string; }) {
  if (!hash) return null;
  return <MetaBadge label={`HASH ${hash}`} color={T.yellow} bg={'rgba(250,204,21,0.14)'} />;
});

const MessageActions = memo(function MessageActions({ actions, message, onAction }: { actions: FeedActionDescriptor[]; message: NormalizedMessage; onAction?: (actionId: string, message: ChatMessage) => void; }) {
  if (actions.length === 0 || !onAction) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {actions.map((action) => (
        <button key={action.id} type="button" onClick={() => onAction(action.id, message)} style={actionButtonStyle(action.danger)}>
          {action.label}
        </button>
      ))}
    </div>
  );
});

const SystemCard = memo(function SystemCard({
  message,
  density,
  compact,
  showProofHashes,
  showTickPressureBadges,
  showKindBadges,
  showMetaRail,
  actions,
  onAction,
  onSelectMessage,
}: {
  message: NormalizedMessage;
  density: FeedDensity;
  compact: boolean;
  showProofHashes: boolean;
  showTickPressureBadges: boolean;
  showKindBadges: boolean;
  showMetaRail: boolean;
  actions: FeedActionDescriptor[];
  onAction?: (actionId: string, message: ChatMessage) => void;
  onSelectMessage?: (message: ChatMessage) => void;
}) {
  const palette = KIND_PALETTE[message.safeKind];
  const padding = densityPadding(density, compact);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelectMessage?.(message)}
      style={{
        display: 'grid',
        gridTemplateColumns: '4px minmax(0, 1fr)',
        gap: 0,
        borderRadius: 16,
        overflow: 'hidden',
        border: `1px solid ${palette.border}`,
        background: palette.bg,
        cursor: onSelectMessage ? 'pointer' : 'default',
      }}
    >
      <div style={{ background: palette.bar }} />
      <div style={{ padding: padding.system, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {message.emoji && <span style={{ fontSize: 16 }}>{message.emoji}</span>}
            <span style={{ fontFamily: T.display, fontWeight: 800, fontSize: 12, letterSpacing: '0.08em', color: palette.text }}>
              {message.safeKind.replace(/_/g, ' ')}
            </span>
            <span style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: '0.10em', color: T.textMute }}>
              {timeLabel(message.safeTs)}
            </span>
          </div>
          {showKindBadges && <MetaBadge label={message.safeKind} color={palette.text} bg={palette.bg} />}
        </div>

        <div style={{ fontFamily: T.display, fontSize: 13, lineHeight: 1.65, color: T.text }}>
          {message.safeBody}
        </div>

        {(showMetaRail || showProofHashes || showTickPressureBadges) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {showProofHashes && <ProofHash hash={message.proofHash} />}
            {showTickPressureBadges && message.pressureTier && <MetaBadge label={String(message.pressureTier)} color={T.orange} bg={T.warningSoft} />}
            {showTickPressureBadges && message.tickTier && <MetaBadge label={String(message.tickTier)} color={T.info} bg={T.infoSoft} />}
            {message.botSource?.botState && <MetaBadge label={String(message.botSource.botState)} color={T.danger} bg={T.dangerSoft} />}
            {message.botSource?.attackType && <MetaBadge label={String(message.botSource.attackType).replace(/_/g, ' ')} color={T.danger} bg={T.dangerSoft} />}
          </div>
        )}

        <MessageActions actions={actions} message={message} onAction={onAction} />
      </div>
    </div>
  );
});

const PlayerBubble = memo(function PlayerBubble({
  message,
  density,
  compact,
  compactJoinAbove,
  compactJoinBelow,
  showProofHashes,
  showTickPressureBadges,
  actions,
  onAction,
  onSelectMessage,
  onSelectSender,
}: {
  message: NormalizedMessage;
  density: FeedDensity;
  compact: boolean;
  compactJoinAbove: boolean;
  compactJoinBelow: boolean;
  showProofHashes: boolean;
  showTickPressureBadges: boolean;
  actions: FeedActionDescriptor[];
  onAction?: (actionId: string, message: ChatMessage) => void;
  onSelectMessage?: (message: ChatMessage) => void;
  onSelectSender?: (senderId: string, message: ChatMessage) => void;
}) {
  const padding = densityPadding(density, compact);
  const mine = message.isMine;
  const bubbleBg = mine ? 'rgba(103,201,255,0.14)' : 'rgba(255,255,255,0.04)';
  const bubbleBorder = mine ? 'rgba(103,201,255,0.26)' : T.border;
  const rankTone = rankColor(message.senderRank);
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', paddingTop: compactJoinAbove ? 0 : 2 }}>
      <button
        type="button"
        onClick={() => onSelectSender?.(message.safeSenderId, message)}
        style={{
          width: compact ? 32 : 36,
          height: compact ? 32 : 36,
          borderRadius: 12,
          border: `1px solid ${bubbleBorder}`,
          background: mine ? `${T.info}18` : 'rgba(255,255,255,0.03)',
          color: mine ? T.info : T.textSub,
          display: compactJoinAbove ? 'none' : 'grid',
          placeItems: 'center',
          fontFamily: T.mono,
          fontSize: 10,
          letterSpacing: '0.08em',
          cursor: onSelectSender ? 'pointer' : 'default',
          flexShrink: 0,
        }}
      >
        {senderInitials(message.safeSenderName)}
      </button>

      <div style={{ minWidth: 0, flex: 1 }}>
        {!compactJoinAbove && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
            <button
              type="button"
              onClick={() => onSelectSender?.(message.safeSenderId, message)}
              style={{
                appearance: 'none',
                border: 'none',
                background: 'transparent',
                padding: 0,
                margin: 0,
                cursor: onSelectSender ? 'pointer' : 'default',
                fontFamily: T.display,
                fontWeight: 800,
                fontSize: 12,
                color: mine ? T.info : T.text,
              }}
            >
              {message.safeSenderName}
            </button>
            {message.senderRank && <span style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: '0.08em', color: rankTone }}>{message.senderRank}</span>}
            <span style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: '0.08em', color: T.textMute }}>{timeLabel(message.safeTs)}</span>
          </div>
        )}

        <div
          role="button"
          tabIndex={0}
          onClick={() => onSelectMessage?.(message)}
          style={{
            borderRadius: compactJoinAbove ? 14 : 16,
            border: `1px solid ${bubbleBorder}`,
            background: bubbleBg,
            padding: padding.bubble,
            cursor: onSelectMessage ? 'pointer' : 'default',
          }}
        >
          <div style={{ fontFamily: T.display, fontSize: 13, lineHeight: 1.65, color: T.text }}>{message.safeBody}</div>
          {(showProofHashes || showTickPressureBadges || message.safeImmutable) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
              {message.safeImmutable && <MetaBadge label={'TRANSCRIPT LOCKED'} color={T.yellow} bg={'rgba(250,204,21,0.14)'} />}
              {showProofHashes && <ProofHash hash={message.proofHash} />}
              {showTickPressureBadges && message.pressureTier && <MetaBadge label={String(message.pressureTier)} color={T.orange} bg={T.warningSoft} />}
              {showTickPressureBadges && message.tickTier && <MetaBadge label={String(message.tickTier)} color={T.info} bg={T.infoSoft} />}
            </div>
          )}
        </div>

        {(!compactJoinBelow || actions.length > 0) && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
            <div style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: '0.08em', color: T.textMute }}>
              {message.safeChannel} · {message.isRecorded ? 'RECORDED' : 'LIVE'}
            </div>
            <MessageActions actions={actions} message={message} onAction={onAction} />
          </div>
        )}
      </div>
    </div>
  );
});

const DiagnosticsRail = memo(function DiagnosticsRail({ lines }: { lines: FeedMetaLine[]; }) {
  if (lines.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {lines.filter((line) => line.value && line.value.length > 0).map((line) => (
        <MetaBadge key={line.id} label={`${line.label} ${line.value}`} color={toneColor(line.tone)} bg={`${toneColor(line.tone)}18`} />
      ))}
    </div>
  );
});

const JumpToLatestButton = memo(function JumpToLatestButton({ visible, onClick }: { visible: boolean; onClick?: () => void; }) {
  if (!visible || !onClick) return null;
  return (
    <button type="button" onClick={onClick} style={{ position: 'absolute', right: 14, bottom: 14, appearance: 'none', border: `1px solid ${T.indigo}44`, background: T.indigoSoft, color: T.indigo, borderRadius: 999, height: 38, padding: '0 14px', cursor: 'pointer', fontFamily: T.mono, fontSize: 10, letterSpacing: '0.10em', boxShadow: '0 10px 28px rgba(0,0,0,0.28)' }}>
      JUMP TO LATEST
    </button>
  );
});

export const ChatMessageFeed = memo(function ChatMessageFeed({
  channel,
  messages,
  currentUserId,
  connected = true,
  unreadCount = 0,
  newestFirst = false,
  density = 'comfortable',
  followMode = 'AUTO',
  maxWindow = 300,
  transcriptImmutable = false,
  threatBand = 'LOW',
  presenceSummary = null,
  emptyState = null,
  diagnosticLines = [],
  showDiagnostics = false,
  showJumpToLatest = true,
  showPresenceHeader = true,
  showChannelHeader = true,
  showLoadOlder = true,
  showProofHashes = true,
  showKindBadges = true,
  showTickPressureBadges = true,
  showMetaRail = true,
  forceCompact = false,
  className,
  style,
  onLoadOlder,
  onJumpToLatest,
  onSelectMessage,
  onSelectSender,
  onRequestTranscript,
  onVisibleRangeChange,
  onMessageAction,
  messageActions = [],
}: ChatMessageFeedProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [userScrolledAway, setUserScrolledAway] = useState(false);
  const compact = forceCompact;
  const paddings = densityPadding(density, compact);

  const normalized = useMemo(() => messages.map((message) => normalizeMessage(message, channel, currentUserId)), [messages, channel, currentUserId]);
  const sorted = useMemo(() => sortMessages(normalized, newestFirst), [normalized, newestFirst]);
  const visibleMessages = useMemo(() => {
    if (sorted.length <= maxWindow) return sorted;
    return newestFirst ? sorted.slice(0, maxWindow) : sorted.slice(sorted.length - maxWindow);
  }, [sorted, maxWindow, newestFirst]);
  const rows = useMemo(() => buildRows(visibleMessages, newestFirst, Math.min(unreadCount, visibleMessages.length)), [visibleMessages, newestFirst, unreadCount]);

  useEffect(() => {
    onVisibleRangeChange?.({ startIndex: 0, endIndex: Math.max(0, visibleMessages.length - 1), total: sorted.length });
  }, [visibleMessages.length, sorted.length, onVisibleRangeChange]);

  useEffect(() => {
    if (followMode === 'MANUAL') return;
    if (userScrolledAway && followMode !== 'LOCKED') return;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [rows.length, followMode, userScrolledAway]);

  const handleScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    const node = event.currentTarget;
    const gap = node.scrollHeight - node.scrollTop - node.clientHeight;
    setUserScrolledAway(gap > 80);
  }, []);

  const jumpToLatest = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    setUserScrolledAway(false);
    onJumpToLatest?.();
  }, [onJumpToLatest]);

  const resolvedEmptyState = emptyState ?? {
    title: channel === 'DEAL_ROOM' ? 'No record yet' : channel === 'SYNDICATE' ? 'No syndicate traffic yet' : 'No chatter yet',
    body: channel === 'DEAL_ROOM'
      ? 'The deal room is empty. Once negotiation begins, this channel becomes a receipt surface.'
      : channel === 'SYNDICATE'
        ? 'Your syndicate feed is quiet. Signals, warnings, and cover calls will show here.'
        : 'Global is quiet right now. The next event, boast, or collapse can wake the room fast.',
    emoji: channel === 'DEAL_ROOM' ? '⚖️' : channel === 'SYNDICATE' ? '🜁' : '🌐',
  } satisfies FeedEmptyState;

  return (
    <div
      className={className}
      style={{
        width: '100%',
        height: '100%',
        minHeight: 0,
        borderRadius: compact ? 16 : 20,
        border: `1px solid ${T.border}`,
        background: 'linear-gradient(180deg, rgba(16,16,36,0.98) 0%, rgba(9,9,20,0.98) 100%)',
        boxShadow: T.shadow,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
        ...style,
      }}
      data-channel={channel}
      data-connected={connected ? 'true' : 'false'}
      data-threat-band={threatBand}
    >
      {showChannelHeader && (
        <div style={{ padding: compact ? '12px 12px 10px' : '14px 14px 12px', borderBottom: `1px solid ${T.border}` }}>
          <ChannelHeader channel={channel} transcriptImmutable={transcriptImmutable} threatBand={threatBand} presenceSummary={showPresenceHeader ? presenceSummary : null} />
        </div>
      )}

      {showDiagnostics && diagnosticLines.length > 0 && (
        <div style={{ padding: compact ? '10px 12px 0' : '12px 14px 0' }}>
          <DiagnosticsRail lines={diagnosticLines} />
        </div>
      )}

      {showLoadOlder && sorted.length > visibleMessages.length && onLoadOlder && (
        <div style={{ padding: compact ? '10px 12px 0' : '12px 14px 0' }}>
          <button type="button" onClick={onLoadOlder} style={{ appearance: 'none', border: `1px solid ${T.border}`, background: 'rgba(255,255,255,0.03)', color: T.textSub, borderRadius: 12, padding: '10px 12px', cursor: 'pointer', fontFamily: T.mono, fontSize: 10, letterSpacing: '0.10em', width: '100%' }}>
            LOAD OLDER TRANSCRIPT WINDOW
          </button>
        </div>
      )}

      <div ref={scrollerRef} onScroll={handleScroll} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: compact ? '12px' : '14px', display: 'flex', flexDirection: 'column', gap: paddings.rowGap }}>
        {rows.length === 0 ? (
          <EmptyStateCard state={resolvedEmptyState} />
        ) : (
          rows.map((row) => {
            if (row.type === 'day') {
              return <DividerRow key={row.key} label={row.label} />;
            }
            if (row.type === 'time') {
              return <DividerRow key={row.key} label={row.label} />;
            }
            if (row.type === 'unread') {
              return <UnreadDivider key={row.key} count={row.count} />;
            }
            if (row.message.isSystem) {
              return (
                <SystemCard
                  key={row.key}
                  message={row.message}
                  density={density}
                  compact={compact}
                  showProofHashes={showProofHashes}
                  showTickPressureBadges={showTickPressureBadges}
                  showKindBadges={showKindBadges}
                  showMetaRail={showMetaRail}
                  actions={messageActions}
                  onAction={onMessageAction}
                  onSelectMessage={onSelectMessage}
                />
              );
            }
            return (
              <PlayerBubble
                key={row.key}
                message={row.message}
                density={density}
                compact={compact}
                compactJoinAbove={row.compactJoinAbove}
                compactJoinBelow={row.compactJoinBelow}
                showProofHashes={showProofHashes}
                showTickPressureBadges={showTickPressureBadges}
                actions={messageActions}
                onAction={onMessageAction}
                onSelectMessage={onSelectMessage}
                onSelectSender={onSelectSender}
              />
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ padding: compact ? '10px 12px' : '12px 14px', borderTop: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <MetaBadge label={connected ? 'CONNECTED' : 'DISCONNECTED'} color={connected ? T.success : T.danger} bg={connected ? T.successSoft : T.dangerSoft} />
          <MetaBadge label={`VISIBLE ${visibleMessages.length}`} color={T.info} bg={T.infoSoft} />
          <MetaBadge label={`TOTAL ${sorted.length}`} color={T.textSub} bg={'rgba(255,255,255,0.04)'} />
          {channel === 'DEAL_ROOM' && <MetaBadge label={transcriptImmutable ? 'INTEGRITY ENFORCED' : 'TRANSCRIPT WATCH'} color={T.yellow} bg={'rgba(250,204,21,0.14)'} />}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {onRequestTranscript && (
            <button type="button" onClick={onRequestTranscript} style={actionButtonStyle(false)}>
              TRANSCRIPT
            </button>
          )}
          <div style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: '0.08em', color: T.textMute }}>
            {followMode === 'AUTO' ? 'FOLLOW AUTO' : followMode === 'LOCKED' ? 'FOLLOW LOCKED' : 'FOLLOW MANUAL'}
          </div>
        </div>
      </div>

      <JumpToLatestButton visible={showJumpToLatest && userScrolledAway} onClick={jumpToLatest} />
    </div>
  );
});

export default ChatMessageFeed;
