// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/components/chat/ChatMessageCard.tsx

/**
 * ============================================================================
 * POINT ZERO ONE — UNIFIED CHAT MESSAGE CARD
 * FILE: pzo-web/src/components/chat/ChatMessageCard.tsx
 * ============================================================================
 *
 * Render-only message primitive for the unified chat shell.
 *
 * This component belongs in /pzo-web/src/components/chat, not in the engine
 * lane. It consumes engine output and transcript records through props and
 * turns them into a premium, information-rich card surface.
 *
 * It does NOT:
 * - own sockets,
 * - decide hater behavior,
 * - mutate learning profiles,
 * - enforce moderation,
 * - rank responses,
 * - or become transcript authority.
 *
 * It DOES:
 * - render every supported message kind with high visual distinction,
 * - surface proof/tick/pressure metadata without claiming ownership,
 * - expose hater/bot metadata clearly,
 * - make system and player rows feel different without branching engine logic,
 * - support mobile and high-density shells,
 * - remain prop-driven for every expensive behavior,
 * - and preserve Point Zero One’s “chat as pressure theater” UX law.
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ============================================================================
 */

import React, {
  memo,
  useMemo,
  useState,
  useCallback,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from 'react';

import type {
  ChatChannel,
  ChatMessage,
  MessageKind,
  BotTauntSource,
  ShieldEventMeta,
  CascadeAlertMeta,
} from './chatTypes';

export type MessageCardDensity = 'compact' | 'comfortable' | 'cinematic';
export type MessageCardTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';
export type MessageCardThreatBand = 'QUIET' | 'LOW' | 'ELEVATED' | 'HIGH' | 'SEVERE';
export type MessageCardSurfaceMode = 'flat' | 'raised' | 'glass';

export interface ChatMessageActionDescriptor {
  id: string;
  label: string;
  icon?: string;
  danger?: boolean;
  disabled?: boolean;
  reason?: string;
  visibleWhen?: Array<'always' | 'mine' | 'theirs' | 'system' | 'dealroom' | 'recorded'>;
}

export interface ChatMessageDiagnosticLine {
  id: string;
  label: string;
  value: string;
  tone?: MessageCardTone;
  visible?: boolean;
}

export interface ChatMessageHighlightRange {
  id: string;
  start: number;
  end: number;
  tone?: MessageCardTone;
}

export interface ChatMessageReplyPreview {
  id: string;
  senderName: string;
  body: string;
  channel?: ChatChannel;
}

export interface ChatMessageSenderPresence {
  online?: boolean;
  typing?: boolean;
  lurking?: boolean;
  reputationLabel?: string;
}

export interface ChatMessageCardProps {
  message: ChatMessage;
  currentUserId?: string;
  density?: MessageCardDensity;
  surfaceMode?: MessageCardSurfaceMode;
  threatBand?: MessageCardThreatBand;
  selected?: boolean;
  emphasized?: boolean;
  compactMeta?: boolean;
  showAvatar?: boolean;
  showChannelBadge?: boolean;
  showKindBadge?: boolean;
  showProofHash?: boolean;
  showTimestamp?: boolean;
  showRelativeTime?: boolean;
  showSenderRank?: boolean;
  showSenderPresence?: boolean;
  showPressureTickBadges?: boolean;
  showBotDiagnostics?: boolean;
  showSystemMetaRail?: boolean;
  showDiagnosticsDrawer?: boolean;
  showMessageActions?: boolean;
  allowBodyClamp?: boolean;
  maxBodyLines?: number;
  className?: string;
  style?: CSSProperties;
  senderPresence?: ChatMessageSenderPresence | null;
  replyPreview?: ChatMessageReplyPreview | null;
  highlightRanges?: ChatMessageHighlightRange[];
  diagnosticLines?: ChatMessageDiagnosticLine[];
  messageActions?: ChatMessageActionDescriptor[];
  onSelect?: (message: ChatMessage) => void;
  onAction?: (actionId: string, message: ChatMessage) => void;
  onSenderSelect?: (senderId: string, message: ChatMessage) => void;
  onProofHashSelect?: (proofHash: string, message: ChatMessage) => void;
  onReplySelect?: (replyPreview: ChatMessageReplyPreview, message: ChatMessage) => void;
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
  safeEmoji?: string;
  safeProofHash?: string;
  safeSenderRank?: string;
  isMine: boolean;
  isSystem: boolean;
  isRecorded: boolean;
};

interface KindVisualConfig {
  bar: string;
  border: string;
  tint: string;
  softTint: string;
  badgeBg: string;
  badgeText: string;
  titleColor: string;
  bodyAccent: string;
  icon: string;
  renderMode: 'bubble' | 'card' | 'broadcast';
}

interface ChannelVisualConfig {
  bg: string;
  border: string;
  text: string;
  glow: string;
}

const TOKENS = Object.freeze({
  void: '#05060B',
  panel: '#0B1020',
  panelRaised: '#11162B',
  panelGlass: 'rgba(12, 18, 36, 0.84)',
  surfaceAlt: '#141B34',
  surfaceSubtle: '#0E1427',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.16)',
  borderHot: 'rgba(129,140,248,0.36)',
  text: '#F5F7FF',
  textSub: '#A9B0D0',
  textMuted: '#70789C',
  textFaint: '#515872',
  green: '#22DD88',
  red: '#FF4D4D',
  orange: '#FF9E44',
  yellow: '#FFD84D',
  indigo: '#818CF8',
  teal: '#2DD4BF',
  cyan: '#22D3EE',
  purple: '#A855F7',
  magenta: '#F472B6',
  white05: 'rgba(255,255,255,0.05)',
  white08: 'rgba(255,255,255,0.08)',
  white10: 'rgba(255,255,255,0.10)',
  white14: 'rgba(255,255,255,0.14)',
  white18: 'rgba(255,255,255,0.18)',
  black35: 'rgba(0,0,0,0.35)',
  black55: 'rgba(0,0,0,0.55)',
  shadow: '0 18px 60px rgba(0,0,0,0.35)',
  shadowHot: '0 14px 44px rgba(99,102,241,0.24)',
  radius: 16,
  mono: "'IBM Plex Mono', 'JetBrains Mono', monospace",
  display: "'Syne', 'Outfit', system-ui, sans-serif",
});

const KIND_VISUALS: Record<NormalizedMessageKind, KindVisualConfig> = {
  PLAYER: {
    bar: 'rgba(255,255,255,0.04)',
    border: 'rgba(255,255,255,0.06)',
    tint: 'rgba(255,255,255,0.02)',
    softTint: 'rgba(255,255,255,0.03)',
    badgeBg: 'rgba(255,255,255,0.05)',
    badgeText: TOKENS.textSub,
    titleColor: TOKENS.text,
    bodyAccent: TOKENS.text,
    icon: '💬',
    renderMode: 'bubble',
  },
  SYSTEM: {
    bar: TOKENS.indigo,
    border: 'rgba(129,140,248,0.26)',
    tint: 'rgba(129,140,248,0.09)',
    softTint: 'rgba(129,140,248,0.05)',
    badgeBg: 'rgba(129,140,248,0.16)',
    badgeText: TOKENS.indigo,
    titleColor: TOKENS.indigo,
    bodyAccent: TOKENS.text,
    icon: '◈',
    renderMode: 'broadcast',
  },
  MARKET_ALERT: {
    bar: TOKENS.orange,
    border: 'rgba(255,158,68,0.26)',
    tint: 'rgba(255,158,68,0.10)',
    softTint: 'rgba(255,158,68,0.06)',
    badgeBg: 'rgba(255,158,68,0.16)',
    badgeText: TOKENS.orange,
    titleColor: TOKENS.orange,
    bodyAccent: TOKENS.text,
    icon: '⚡',
    renderMode: 'broadcast',
  },
  ACHIEVEMENT: {
    bar: TOKENS.green,
    border: 'rgba(34,221,136,0.24)',
    tint: 'rgba(34,221,136,0.10)',
    softTint: 'rgba(34,221,136,0.06)',
    badgeBg: 'rgba(34,221,136,0.16)',
    badgeText: TOKENS.green,
    titleColor: TOKENS.green,
    bodyAccent: TOKENS.text,
    icon: '✦',
    renderMode: 'card',
  },
  BOT_TAUNT: {
    bar: TOKENS.red,
    border: 'rgba(255,77,77,0.26)',
    tint: 'rgba(255,77,77,0.10)',
    softTint: 'rgba(255,77,77,0.06)',
    badgeBg: 'rgba(255,77,77,0.16)',
    badgeText: TOKENS.red,
    titleColor: TOKENS.red,
    bodyAccent: TOKENS.text,
    icon: '☠',
    renderMode: 'card',
  },
  BOT_ATTACK: {
    bar: '#FF2F5B',
    border: 'rgba(255,47,91,0.30)',
    tint: 'rgba(255,47,91,0.12)',
    softTint: 'rgba(255,47,91,0.07)',
    badgeBg: 'rgba(255,47,91,0.18)',
    badgeText: '#FF688A',
    titleColor: '#FF688A',
    bodyAccent: TOKENS.text,
    icon: '⚠',
    renderMode: 'card',
  },
  SHIELD_EVENT: {
    bar: TOKENS.teal,
    border: 'rgba(45,212,191,0.24)',
    tint: 'rgba(45,212,191,0.10)',
    softTint: 'rgba(45,212,191,0.06)',
    badgeBg: 'rgba(45,212,191,0.16)',
    badgeText: TOKENS.teal,
    titleColor: TOKENS.teal,
    bodyAccent: TOKENS.text,
    icon: '🛡',
    renderMode: 'card',
  },
  CASCADE_ALERT: {
    bar: TOKENS.purple,
    border: 'rgba(168,85,247,0.24)',
    tint: 'rgba(168,85,247,0.10)',
    softTint: 'rgba(168,85,247,0.06)',
    badgeBg: 'rgba(168,85,247,0.16)',
    badgeText: TOKENS.purple,
    titleColor: TOKENS.purple,
    bodyAccent: TOKENS.text,
    icon: '⟡',
    renderMode: 'card',
  },
  DEAL_RECAP: {
    bar: TOKENS.yellow,
    border: 'rgba(255,216,77,0.24)',
    tint: 'rgba(255,216,77,0.10)',
    softTint: 'rgba(255,216,77,0.06)',
    badgeBg: 'rgba(255,216,77,0.16)',
    badgeText: TOKENS.yellow,
    titleColor: TOKENS.yellow,
    bodyAccent: TOKENS.text,
    icon: '▣',
    renderMode: 'card',
  },
  UNKNOWN: {
    bar: TOKENS.textMuted,
    border: 'rgba(112,120,156,0.24)',
    tint: 'rgba(112,120,156,0.09)',
    softTint: 'rgba(112,120,156,0.05)',
    badgeBg: 'rgba(112,120,156,0.16)',
    badgeText: TOKENS.textSub,
    titleColor: TOKENS.textSub,
    bodyAccent: TOKENS.text,
    icon: '•',
    renderMode: 'card',
  },
};

const CHANNEL_VISUALS: Record<ChatChannel, ChannelVisualConfig> = {
  GLOBAL: {
    bg: 'rgba(129,140,248,0.10)',
    border: 'rgba(129,140,248,0.22)',
    text: TOKENS.indigo,
    glow: 'rgba(129,140,248,0.20)',
  },
  SYNDICATE: {
    bg: 'rgba(45,212,191,0.10)',
    border: 'rgba(45,212,191,0.22)',
    text: TOKENS.teal,
    glow: 'rgba(45,212,191,0.20)',
  },
  DEAL_ROOM: {
    bg: 'rgba(255,216,77,0.10)',
    border: 'rgba(255,216,77,0.22)',
    text: TOKENS.yellow,
    glow: 'rgba(255,216,77,0.20)',
  },
};

const RANK_TONES: Record<string, string> = Object.freeze({
  'Managing Partner': TOKENS.yellow,
  'Senior Partner': '#F6A623',
  Partner: TOKENS.indigo,
  'Junior Partner': TOKENS.textSub,
  Associate: TOKENS.textMuted,
  You: TOKENS.green,
});

function safeString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function normalizeKind(kind: unknown): NormalizedMessageKind {
  const text = safeString(kind).trim();
  switch (text) {
    case 'PLAYER':
    case 'SYSTEM':
    case 'MARKET_ALERT':
    case 'ACHIEVEMENT':
    case 'BOT_TAUNT':
    case 'BOT_ATTACK':
    case 'SHIELD_EVENT':
    case 'CASCADE_ALERT':
    case 'DEAL_RECAP':
      return text;
    default:
      return 'UNKNOWN';
  }
}

function normalizeChannel(channel: unknown): ChatChannel {
  const text = safeString(channel).trim();
  if (text === 'GLOBAL' || text === 'SYNDICATE' || text === 'DEAL_ROOM') return text;
  return 'GLOBAL';
}

function normalizeMessage(message: ChatMessage, currentUserId?: string): NormalizedMessage {
  const safeId = safeString(message.id, `msg-${Math.random().toString(36).slice(2, 10)}`);
  const safeKind = normalizeKind(message.kind);
  const safeChannel = normalizeChannel(message.channel);
  const safeSenderId = safeString(message.senderId, 'unknown-sender');
  const safeSenderName = safeString(message.senderName, 'Unknown');
  const safeBody = safeString(message.body, '');
  const safeTs = Number.isFinite(message.ts) ? message.ts : Date.now();
  const safeImmutable = Boolean(message.immutable);
  const safeEmoji = safeString(message.emoji) || undefined;
  const safeProofHash = safeString(message.proofHash) || undefined;
  const safeSenderRank = safeString(message.senderRank) || undefined;
  const isMine = Boolean(currentUserId) ? safeSenderId === currentUserId : safeSenderId === 'player-local';
  const isSystem = safeKind !== 'PLAYER';
  const isRecorded = safeChannel === 'DEAL_ROOM' || safeImmutable || Boolean(safeProofHash);

  return {
    ...message,
    safeId,
    safeKind,
    safeChannel,
    safeSenderId,
    safeSenderName,
    safeBody,
    safeTs,
    safeImmutable,
    safeEmoji,
    safeProofHash,
    safeSenderRank,
    isMine,
    isSystem,
    isRecorded,
  };
}

function formatClockTime(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '--:--';
  }
}

function formatRelativeTime(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const sec = Math.floor(diff / 1000);
  if (sec < 5) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

function initials(name: string): string {
  const parts = name
    .split(/\s+/)
    .map(part => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

function countWords(text: string): number {
  const matches = text.trim().match(/\S+/g);
  return matches ? matches.length : 0;
}

function countLines(text: string): number {
  if (!text) return 0;
  return text.split(/\n/).length;
}

function detectThreatBand(message: NormalizedMessage): MessageCardThreatBand {
  if (message.safeKind === 'BOT_ATTACK') return 'SEVERE';
  if (message.safeKind === 'BOT_TAUNT') return 'HIGH';
  if (message.safeKind === 'SHIELD_EVENT') return 'ELEVATED';
  if (message.safeKind === 'CASCADE_ALERT') return 'HIGH';
  if (message.safeKind === 'MARKET_ALERT') return 'ELEVATED';
  if (message.safeKind === 'DEAL_RECAP') return 'LOW';
  return 'QUIET';
}

function bandGlow(band: MessageCardThreatBand): string {
  switch (band) {
    case 'SEVERE':
      return '0 0 0 1px rgba(255,47,91,0.28), 0 18px 46px rgba(255,47,91,0.15)';
    case 'HIGH':
      return '0 0 0 1px rgba(255,77,77,0.22), 0 18px 42px rgba(255,77,77,0.12)';
    case 'ELEVATED':
      return '0 0 0 1px rgba(255,158,68,0.18), 0 16px 38px rgba(255,158,68,0.10)';
    case 'LOW':
      return '0 0 0 1px rgba(129,140,248,0.14), 0 14px 32px rgba(129,140,248,0.08)';
    default:
      return TOKENS.shadow;
  }
}

function bodyClampStyle(lines: number | undefined): CSSProperties | undefined {
  if (!lines || lines <= 0) return undefined;
  return {
    display: '-webkit-box',
    WebkitLineClamp: String(lines),
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  };
}

function emphasizeText(text: string, ranges?: ChatMessageHighlightRange[]): React.ReactNode {
  if (!ranges || ranges.length === 0) return text;
  const normalized = [...ranges]
    .map(range => ({
      ...range,
      start: Math.max(0, Math.min(text.length, range.start)),
      end: Math.max(0, Math.min(text.length, range.end)),
    }))
    .filter(range => range.end > range.start)
    .sort((a, b) => a.start - b.start);

  if (normalized.length === 0) return text;

  const nodes: React.ReactNode[] = [];
  let cursor = 0;

  normalized.forEach(range => {
    if (range.start > cursor) {
      nodes.push(
        <React.Fragment key={`${range.id}-plain-${cursor}`}>
          {text.slice(cursor, range.start)}
        </React.Fragment>,
      );
    }

    const tone = range.tone ?? 'info';
    const colors: Record<MessageCardTone, CSSProperties> = {
      neutral: { background: 'rgba(255,255,255,0.08)', color: TOKENS.text },
      info: { background: 'rgba(129,140,248,0.18)', color: '#D8DDFF' },
      success: { background: 'rgba(34,221,136,0.18)', color: '#D7FFE8' },
      warning: { background: 'rgba(255,158,68,0.18)', color: '#FFE8C7' },
      danger: { background: 'rgba(255,77,77,0.20)', color: '#FFD7D7' },
    };

    nodes.push(
      <span
        key={`${range.id}-mark-${range.start}`}
        style={{
          ...colors[tone],
          borderRadius: 6,
          padding: '0 4px',
          boxDecorationBreak: 'clone',
          WebkitBoxDecorationBreak: 'clone',
        }}
      >
        {text.slice(range.start, range.end)}
      </span>,
    );

    cursor = range.end;
  });

  if (cursor < text.length) {
    nodes.push(
      <React.Fragment key={`plain-tail-${cursor}`}>
        {text.slice(cursor)}
      </React.Fragment>,
    );
  }

  return nodes;
}

function channelLabel(channel: ChatChannel): string {
  switch (channel) {
    case 'GLOBAL':
      return 'GLOBAL';
    case 'SYNDICATE':
      return 'SYNDICATE';
    case 'DEAL_ROOM':
      return 'DEAL ROOM';
    default:
      return 'CHANNEL';
  }
}

function kindLabel(kind: NormalizedMessageKind): string {
  switch (kind) {
    case 'PLAYER':
      return 'PLAYER';
    case 'SYSTEM':
      return 'SYSTEM';
    case 'MARKET_ALERT':
      return 'MARKET';
    case 'ACHIEVEMENT':
      return 'ACHIEVEMENT';
    case 'BOT_TAUNT':
      return 'TAUNT';
    case 'BOT_ATTACK':
      return 'ATTACK';
    case 'SHIELD_EVENT':
      return 'SHIELD';
    case 'CASCADE_ALERT':
      return 'CASCADE';
    case 'DEAL_RECAP':
      return 'DEAL';
    default:
      return 'EVENT';
  }
}

function densityPadding(density: MessageCardDensity): string {
  switch (density) {
    case 'compact':
      return '10px 12px';
    case 'cinematic':
      return '18px 18px';
    default:
      return '14px 15px';
  }
}

function bodyFontSize(density: MessageCardDensity): number {
  switch (density) {
    case 'compact':
      return 12;
    case 'cinematic':
      return 14;
    default:
      return 13;
  }
}

function metaFontSize(density: MessageCardDensity): number {
  switch (density) {
    case 'compact':
      return 10;
    case 'cinematic':
      return 11;
    default:
      return 10.5;
  }
}

function renderToneColor(tone: MessageCardTone): string {
  switch (tone) {
    case 'info':
      return TOKENS.indigo;
    case 'success':
      return TOKENS.green;
    case 'warning':
      return TOKENS.orange;
    case 'danger':
      return TOKENS.red;
    default:
      return TOKENS.textSub;
  }
}

function normalizeBotSource(source: BotTauntSource | undefined): BotTauntSource | null {
  if (!source) return null;
  return source;
}

function normalizeShieldMeta(meta: ShieldEventMeta | undefined): ShieldEventMeta | null {
  if (!meta) return null;
  return meta;
}

function normalizeCascadeMeta(meta: CascadeAlertMeta | undefined): CascadeAlertMeta | null {
  if (!meta) return null;
  return meta;
}

const MetaChip = memo(function MetaChip({
  label,
  value,
  tone = 'neutral',
  density = 'comfortable',
}: {
  label?: string;
  value: string;
  tone?: MessageCardTone;
  density?: MessageCardDensity;
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: density === 'compact' ? '4px 7px' : '5px 8px',
        borderRadius: 999,
        border: `1px solid ${TOKENS.border}`,
        background: TOKENS.white05,
        color: renderToneColor(tone),
        fontSize: metaFontSize(density),
        lineHeight: 1,
        fontFamily: TOKENS.mono,
        letterSpacing: '0.04em',
        whiteSpace: 'nowrap',
      }}
    >
      {label && <span style={{ color: TOKENS.textFaint }}>{label}</span>}
      <span>{value}</span>
    </span>
  );
});

const SectionLabel = memo(function SectionLabel({ label }: { label: string }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontFamily: TOKENS.mono,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: TOKENS.textFaint,
      }}
    >
      {label}
    </div>
  );
});

const InfoRail = memo(function InfoRail({
  title,
  tone,
  children,
}: {
  title: string;
  tone: MessageCardTone;
  children: React.ReactNode;
}) {
  const color = renderToneColor(tone);
  return (
    <div
      style={{
        display: 'grid',
        gap: 8,
        padding: '10px 11px',
        borderRadius: 12,
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${TOKENS.border}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <SectionLabel label={title} />
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: color,
            boxShadow: `0 0 18px ${color}`,
          }}
        />
      </div>
      {children}
    </div>
  );
});

const ProofHashButton = memo(function ProofHashButton({
  proofHash,
  onClick,
}: {
  proofHash: string;
  onClick?: () => void;
}) {
  const preview = proofHash.length > 14 ? `${proofHash.slice(0, 8)}…${proofHash.slice(-4)}` : proofHash;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        appearance: 'none',
        border: `1px solid rgba(255,216,77,0.24)`,
        background: 'rgba(255,216,77,0.08)',
        color: TOKENS.yellow,
        borderRadius: 10,
        padding: '7px 9px',
        fontFamily: TOKENS.mono,
        fontSize: 10,
        letterSpacing: '0.05em',
        cursor: onClick ? 'pointer' : 'default',
        textAlign: 'left',
      }}
      title={proofHash}
    >
      HASH {preview}
    </button>
  );
});

const ActionButton = memo(function ActionButton({
  action,
  onClick,
}: {
  action: ChatMessageActionDescriptor;
  onClick: () => void;
}) {
  const color = action.danger ? TOKENS.red : TOKENS.textSub;
  return (
    <button
      type="button"
      disabled={action.disabled}
      onClick={onClick}
      title={action.reason}
      style={{
        appearance: 'none',
        border: `1px solid ${action.danger ? 'rgba(255,77,77,0.20)' : TOKENS.border}`,
        background: action.disabled ? TOKENS.white05 : 'rgba(255,255,255,0.03)',
        color: action.disabled ? TOKENS.textFaint : color,
        borderRadius: 10,
        padding: '7px 9px',
        fontFamily: TOKENS.display,
        fontSize: 11,
        cursor: action.disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        opacity: action.disabled ? 0.65 : 1,
      }}
    >
      {action.icon && <span aria-hidden="true">{action.icon}</span>}
      <span>{action.label}</span>
    </button>
  );
});

function visibleActionPredicate(
  action: ChatMessageActionDescriptor,
  message: NormalizedMessage,
): boolean {
  if (!action.visibleWhen || action.visibleWhen.length === 0) return true;
  return action.visibleWhen.some(flag => {
    switch (flag) {
      case 'always':
        return true;
      case 'mine':
        return message.isMine;
      case 'theirs':
        return !message.isMine;
      case 'system':
        return message.isSystem;
      case 'dealroom':
        return message.safeChannel === 'DEAL_ROOM';
      case 'recorded':
        return message.isRecorded;
      default:
        return false;
    }
  });
}

function renderBodyText(message: NormalizedMessage): string {
  return message.safeBody || '—';
}

function buildDefaultDiagnostics(message: NormalizedMessage): ChatMessageDiagnosticLine[] {
  return [
    {
      id: 'msg-kind',
      label: 'kind',
      value: message.safeKind,
      tone: 'info',
      visible: true,
    },
    {
      id: 'msg-channel',
      label: 'channel',
      value: message.safeChannel,
      tone: 'neutral',
      visible: true,
    },
    {
      id: 'msg-words',
      label: 'words',
      value: String(countWords(message.safeBody)),
      tone: 'neutral',
      visible: true,
    },
    {
      id: 'msg-lines',
      label: 'lines',
      value: String(countLines(message.safeBody)),
      tone: 'neutral',
      visible: true,
    },
    {
      id: 'msg-recorded',
      label: 'recorded',
      value: message.isRecorded ? 'yes' : 'no',
      tone: message.isRecorded ? 'warning' : 'neutral',
      visible: true,
    },
    {
      id: 'msg-pressure',
      label: 'pressure',
      value: safeString(message.pressureTier, '—'),
      tone: 'warning',
      visible: Boolean(message.pressureTier),
    },
    {
      id: 'msg-tick',
      label: 'tick',
      value: safeString(message.tickTier, '—'),
      tone: 'info',
      visible: Boolean(message.tickTier),
    },
    {
      id: 'msg-outcome',
      label: 'outcome',
      value: safeString(message.runOutcome, '—'),
      tone: 'success',
      visible: Boolean(message.runOutcome),
    },
  ];
}

function computeMessageTitle(message: NormalizedMessage): string {
  switch (message.safeKind) {
    case 'BOT_TAUNT':
      return 'Hater Transmission';
    case 'BOT_ATTACK':
      return 'Attack Window';
    case 'SHIELD_EVENT':
      return 'Shield Event';
    case 'CASCADE_ALERT':
      return 'Cascade Notice';
    case 'MARKET_ALERT':
      return 'Market Notice';
    case 'ACHIEVEMENT':
      return 'Milestone';
    case 'DEAL_RECAP':
      return 'Deal Room Record';
    case 'SYSTEM':
      return 'System Notice';
    case 'PLAYER':
      return 'Message';
    default:
      return 'Chat Event';
  }
}

function replyPreviewTone(replyPreview: ChatMessageReplyPreview | null | undefined): MessageCardTone {
  if (!replyPreview) return 'neutral';
  if (replyPreview.channel === 'DEAL_ROOM') return 'warning';
  if (replyPreview.channel === 'SYNDICATE') return 'success';
  return 'info';
}

const ReplyPreviewCard = memo(function ReplyPreviewCard({
  replyPreview,
  onClick,
}: {
  replyPreview: ChatMessageReplyPreview;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        appearance: 'none',
        border: `1px solid ${TOKENS.border}`,
        background: 'rgba(255,255,255,0.03)',
        borderRadius: 12,
        padding: '10px 11px',
        display: 'grid',
        gap: 6,
        cursor: onClick ? 'pointer' : 'default',
        textAlign: 'left',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <MetaChip label="reply" value={replyPreview.senderName} tone={replyPreviewTone(replyPreview)} />
        {replyPreview.channel && <MetaChip value={channelLabel(replyPreview.channel)} tone="neutral" />}
      </div>
      <div
        style={{
          color: TOKENS.textSub,
          fontSize: 12,
          lineHeight: 1.45,
        }}
      >
        {replyPreview.body}
      </div>
    </button>
  );
});

const BotSourceRail = memo(function BotSourceRail({
  source,
}: {
  source: BotTauntSource;
}) {
  const state = safeString(source.botState, 'UNKNOWN');
  const attack = safeString(source.attackType, 'UNKNOWN').replace(/_/g, ' ');
  const target = safeString(source.targetLayer, '—');
  return (
    <InfoRail title="Bot telemetry" tone="danger">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: 8,
        }}
      >
        <MetaChip label="bot" value={safeString(source.botName, 'UNKNOWN')} tone="danger" />
        <MetaChip label="state" value={state} tone="danger" />
        <MetaChip label="attack" value={attack} tone="warning" />
        {target && target !== '—' && <MetaChip label="target" value={target} tone="warning" />}
        <MetaChip label="retreat" value={source.isRetreat ? 'yes' : 'no'} tone={source.isRetreat ? 'warning' : 'danger'} />
      </div>
      <div
        style={{
          color: TOKENS.textSub,
          fontSize: 12,
          lineHeight: 1.45,
        }}
      >
        {safeString(source.dialogue, '')}
      </div>
    </InfoRail>
  );
});

const ShieldRail = memo(function ShieldRail({
  meta,
}: {
  meta: ShieldEventMeta;
}) {
  const integrity = Number.isFinite(meta.integrity) ? meta.integrity : 0;
  const maxIntegrity = Number.isFinite(meta.maxIntegrity) ? meta.maxIntegrity : 0;
  const ratio = maxIntegrity > 0 ? clamp01(integrity / maxIntegrity) : 0;
  return (
    <InfoRail title="Shield state" tone={meta.isBreached ? 'danger' : 'success'}>
      <div
        style={{
          display: 'grid',
          gap: 8,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <MetaChip label="layer" value={safeString(meta.layerId, 'UNKNOWN')} tone="info" />
          <MetaChip label="breached" value={meta.isBreached ? 'yes' : 'no'} tone={meta.isBreached ? 'danger' : 'success'} />
          {meta.attackId && <MetaChip label="attack" value={meta.attackId} tone="warning" />}
        </div>
        <div style={{ display: 'grid', gap: 6 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              fontSize: 11,
              color: TOKENS.textSub,
              fontFamily: TOKENS.mono,
            }}
          >
            <span>integrity</span>
            <span>
              {integrity} / {maxIntegrity}
            </span>
          </div>
          <div
            style={{
              height: 8,
              borderRadius: 999,
              background: 'rgba(255,255,255,0.06)',
              overflow: 'hidden',
              border: `1px solid ${TOKENS.border}`,
            }}
          >
            <div
              style={{
                width: `${Math.round(ratio * 100)}%`,
                height: '100%',
                borderRadius: 999,
                background: meta.isBreached
                  ? 'linear-gradient(90deg, rgba(255,77,77,0.95), rgba(255,120,120,0.9))'
                  : 'linear-gradient(90deg, rgba(34,221,136,0.95), rgba(45,212,191,0.9))',
              }}
            />
          </div>
        </div>
      </div>
    </InfoRail>
  );
});

const CascadeRail = memo(function CascadeRail({
  meta,
}: {
  meta: CascadeAlertMeta;
}) {
  const severity = safeString(meta.severity, 'UNKNOWN');
  const direction = safeString(meta.direction, 'NEGATIVE');
  return (
    <InfoRail title="Cascade chain" tone={direction === 'NEGATIVE' ? 'danger' : 'success'}>
      <div
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <MetaChip label="chain" value={safeString(meta.chainId, 'UNKNOWN')} tone="warning" />
        <MetaChip label="severity" value={severity} tone={direction === 'NEGATIVE' ? 'danger' : 'success'} />
        <MetaChip label="direction" value={direction} tone={direction === 'NEGATIVE' ? 'danger' : 'success'} />
      </div>
    </InfoRail>
  );
});

const DiagnosticsDrawer = memo(function DiagnosticsDrawer({
  diagnostics,
}: {
  diagnostics: ChatMessageDiagnosticLine[];
}) {
  const visible = diagnostics.filter(item => item.visible !== false);
  if (visible.length === 0) return null;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
        gap: 8,
        paddingTop: 2,
      }}
    >
      {visible.map(item => (
        <div
          key={item.id}
          style={{
            display: 'grid',
            gap: 5,
            padding: '9px 10px',
            borderRadius: 11,
            border: `1px solid ${TOKENS.border}`,
            background: 'rgba(255,255,255,0.03)',
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: TOKENS.textFaint,
              fontFamily: TOKENS.mono,
              letterSpacing: '0.10em',
              textTransform: 'uppercase',
            }}
          >
            {item.label}
          </div>
          <div
            style={{
              fontSize: 12,
              color: renderToneColor(item.tone ?? 'neutral'),
              fontFamily: TOKENS.display,
              wordBreak: 'break-word',
            }}
          >
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
});

function messageActionsForRender(
  actions: ChatMessageActionDescriptor[] | undefined,
  message: NormalizedMessage,
): ChatMessageActionDescriptor[] {
  if (!actions || actions.length === 0) return [];
  return actions.filter(action => visibleActionPredicate(action, message));
}

function avatarTone(message: NormalizedMessage): string {
  if (message.isMine) return TOKENS.green;
  if (message.safeKind === 'BOT_TAUNT' || message.safeKind === 'BOT_ATTACK') return TOKENS.red;
  if (message.safeKind === 'SYSTEM') return TOKENS.indigo;
  if (message.safeChannel === 'DEAL_ROOM') return TOKENS.yellow;
  if (message.safeChannel === 'SYNDICATE') return TOKENS.teal;
  return TOKENS.textSub;
}

function avatarBackground(color: string): string {
  return `linear-gradient(180deg, ${color}22, ${color}10)`;
}

function bodyAlignment(message: NormalizedMessage): CSSProperties['alignSelf'] {
  if (message.isMine) return 'flex-end';
  return 'stretch';
}

function contentMaxWidth(density: MessageCardDensity): number {
  switch (density) {
    case 'compact':
      return 720;
    case 'cinematic':
      return 980;
    default:
      return 860;
  }
}

function deriveKindDescription(kind: NormalizedMessageKind): string {
  switch (kind) {
    case 'PLAYER':
      return 'direct player or NPC speech';
    case 'SYSTEM':
      return 'engine bulletin or game notice';
    case 'MARKET_ALERT':
      return 'market regime or pressure shift';
    case 'ACHIEVEMENT':
      return 'milestone or threshold event';
    case 'BOT_TAUNT':
      return 'hater taunt dialogue';
    case 'BOT_ATTACK':
      return 'attack event with consequences';
    case 'SHIELD_EVENT':
      return 'shield health or state notice';
    case 'CASCADE_ALERT':
      return 'cascade chain signal';
    case 'DEAL_RECAP':
      return 'proof-bearing deal record';
    default:
      return 'event';
  }
}

export const ChatMessageCard = memo(function ChatMessageCard({
  message,
  currentUserId,
  density = 'comfortable',
  surfaceMode = 'glass',
  threatBand,
  selected = false,
  emphasized = false,
  compactMeta = false,
  showAvatar = true,
  showChannelBadge = false,
  showKindBadge = true,
  showProofHash = true,
  showTimestamp = true,
  showRelativeTime = false,
  showSenderRank = true,
  showSenderPresence = true,
  showPressureTickBadges = true,
  showBotDiagnostics = true,
  showSystemMetaRail = true,
  showDiagnosticsDrawer = false,
  showMessageActions = true,
  allowBodyClamp = false,
  maxBodyLines,
  className,
  style,
  senderPresence,
  replyPreview,
  highlightRanges,
  diagnosticLines,
  messageActions,
  onSelect,
  onAction,
  onSenderSelect,
  onProofHashSelect,
  onReplySelect,
}: ChatMessageCardProps) {
  const normalized = useMemo(
    () => normalizeMessage(message, currentUserId),
    [message, currentUserId],
  );

  const visual = KIND_VISUALS[normalized.safeKind];
  const channelVisual = CHANNEL_VISUALS[normalized.safeChannel];
  const derivedThreatBand = threatBand ?? detectThreatBand(normalized);
  const resolvedDiagnostics = useMemo(
    () => [...buildDefaultDiagnostics(normalized), ...(diagnosticLines ?? [])],
    [normalized, diagnosticLines],
  );
  const visibleActions = useMemo(
    () => messageActionsForRender(messageActions, normalized),
    [messageActions, normalized],
  );
  const [showFullBody, setShowFullBody] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const botSource = normalizeBotSource(normalized.botSource);
  const shieldMeta = normalizeShieldMeta(normalized.shieldMeta);
  const cascadeMeta = normalizeCascadeMeta(normalized.cascadeMeta);
  const clampLines = allowBodyClamp && !showFullBody ? maxBodyLines : undefined;
  const rankColor = normalized.safeSenderRank
    ? RANK_TONES[normalized.safeSenderRank] ?? TOKENS.textSub
    : TOKENS.textSub;
  const selectedBorder = selected ? TOKENS.borderHot : visual.border;
  const avatarColor = avatarTone(normalized);
  const channelBadgeTone: MessageCardTone = normalized.safeChannel === 'DEAL_ROOM'
    ? 'warning'
    : normalized.safeChannel === 'SYNDICATE'
      ? 'success'
      : 'info';

  const rootBackground =
    surfaceMode === 'flat'
      ? TOKENS.surfaceSubtle
      : surfaceMode === 'raised'
        ? TOKENS.panelRaised
        : TOKENS.panelGlass;

  const rootStyle: CSSProperties = {
    position: 'relative',
    display: 'grid',
    gap: density === 'compact' ? 8 : 10,
    padding: densityPadding(density),
    borderRadius: TOKENS.radius,
    background:
      visual.renderMode === 'bubble'
        ? rootBackground
        : `linear-gradient(180deg, ${visual.tint}, ${rootBackground})`,
    border: `1px solid ${selectedBorder}`,
    boxShadow: emphasized ? TOKENS.shadowHot : bandGlow(derivedThreatBand),
    alignSelf: bodyAlignment(normalized),
    maxWidth: contentMaxWidth(density),
    overflow: 'hidden',
  };

  const handleSelect = useCallback(() => {
    onSelect?.(message);
  }, [message, onSelect]);

  const handleSenderSelect = useCallback(
    (event: ReactMouseEvent) => {
      event.stopPropagation();
      onSenderSelect?.(normalized.safeSenderId, message);
    },
    [message, normalized.safeSenderId, onSenderSelect],
  );

  const handleProofSelect = useCallback(
    (event: ReactMouseEvent) => {
      event.stopPropagation();
      if (normalized.safeProofHash) onProofHashSelect?.(normalized.safeProofHash, message);
    },
    [message, normalized.safeProofHash, onProofHashSelect],
  );

  const handleReplyPreview = useCallback(
    (event: ReactMouseEvent) => {
      event.stopPropagation();
      if (replyPreview) onReplySelect?.(replyPreview, message);
    },
    [message, onReplySelect, replyPreview],
  );

  return (
    <article className={className} style={{ ...rootStyle, ...style }} onClick={handleSelect}>
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            visual.renderMode === 'broadcast'
              ? `linear-gradient(90deg, ${visual.softTint}, transparent 38%)`
              : 'transparent',
        }}
      />

      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          background: visual.bar,
          borderTopLeftRadius: TOKENS.radius,
          borderBottomLeftRadius: TOKENS.radius,
        }}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: showAvatar ? 'auto minmax(0, 1fr)' : 'minmax(0, 1fr)',
          gap: density === 'compact' ? 10 : 12,
          alignItems: 'start',
        }}
      >
        {showAvatar && (
          <div
            style={{
              width: density === 'compact' ? 34 : density === 'cinematic' ? 42 : 38,
              height: density === 'compact' ? 34 : density === 'cinematic' ? 42 : 38,
              borderRadius: 12,
              display: 'grid',
              placeItems: 'center',
              fontFamily: TOKENS.display,
              fontWeight: 800,
              fontSize: density === 'compact' ? 11 : 12,
              color: avatarColor,
              background: avatarBackground(avatarColor),
              border: `1px solid ${avatarColor}33`,
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 20px ${avatarColor}1c`,
              userSelect: 'none',
            }}
            title={normalized.safeSenderName}
          >
            {normalized.safeEmoji || initials(normalized.safeSenderName)}
          </div>
        )}

        <div style={{ display: 'grid', gap: density === 'compact' ? 8 : 10, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'grid', gap: 6, minWidth: 0 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flexWrap: 'wrap',
                  minWidth: 0,
                }}
              >
                <button
                  type="button"
                  onClick={handleSenderSelect}
                  style={{
                    appearance: 'none',
                    background: 'transparent',
                    border: 0,
                    padding: 0,
                    margin: 0,
                    color: normalized.isMine ? TOKENS.green : visual.titleColor,
                    fontFamily: TOKENS.display,
                    fontSize: density === 'compact' ? 12 : 13,
                    fontWeight: 700,
                    cursor: onSenderSelect ? 'pointer' : 'default',
                    minWidth: 0,
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {normalized.safeSenderName}
                </button>

                {showSenderRank && normalized.safeSenderRank && (
                  <span
                    style={{
                      color: rankColor,
                      fontFamily: TOKENS.mono,
                      fontSize: metaFontSize(density),
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {normalized.safeSenderRank}
                  </span>
                )}

                {showSenderPresence && senderPresence && (
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      color: TOKENS.textMuted,
                      fontSize: metaFontSize(density),
                      fontFamily: TOKENS.mono,
                    }}
                  >
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: 999,
                        background: senderPresence.typing
                          ? TOKENS.cyan
                          : senderPresence.online
                            ? TOKENS.green
                            : TOKENS.textFaint,
                        boxShadow: senderPresence.typing
                          ? `0 0 16px ${TOKENS.cyan}`
                          : senderPresence.online
                            ? `0 0 14px ${TOKENS.green}`
                            : 'none',
                      }}
                    />
                    <span>
                      {senderPresence.typing
                        ? 'typing'
                        : senderPresence.lurking
                          ? 'lurking'
                          : senderPresence.online
                            ? 'online'
                            : 'offline'}
                    </span>
                    {senderPresence.reputationLabel && (
                      <span style={{ color: TOKENS.textFaint }}>· {senderPresence.reputationLabel}</span>
                    )}
                  </div>
                )}
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: 7,
                  flexWrap: 'wrap',
                  alignItems: 'center',
                }}
              >
                {showKindBadge && <MetaChip value={kindLabel(normalized.safeKind)} tone="neutral" density={density} />}
                {showChannelBadge && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: density === 'compact' ? '4px 7px' : '5px 8px',
                      borderRadius: 999,
                      border: `1px solid ${channelVisual.border}`,
                      background: channelVisual.bg,
                      color: channelVisual.text,
                      fontFamily: TOKENS.mono,
                      fontSize: metaFontSize(density),
                      letterSpacing: '0.05em',
                      boxShadow: `0 0 20px ${channelVisual.glow}`,
                    }}
                  >
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: 999,
                        background: channelVisual.text,
                      }}
                    />
                    <span>{channelLabel(normalized.safeChannel)}</span>
                  </span>
                )}
                {showPressureTickBadges && normalized.pressureTier && (
                  <MetaChip label="pressure" value={safeString(normalized.pressureTier)} tone="warning" density={density} />
                )}
                {showPressureTickBadges && normalized.tickTier && (
                  <MetaChip label="tick" value={safeString(normalized.tickTier)} tone="info" density={density} />
                )}
                {normalized.runOutcome && (
                  <MetaChip label="run" value={safeString(normalized.runOutcome)} tone="success" density={density} />
                )}
                {normalized.safeImmutable && <MetaChip value="locked" tone="warning" density={density} />}
                {normalized.isMine && <MetaChip value="you" tone="success" density={density} />}
                {!compactMeta && (
                  <MetaChip
                    label="type"
                    value={deriveKindDescription(normalized.safeKind)}
                    tone={channelBadgeTone}
                    density={density}
                  />
                )}
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
                justifyContent: 'flex-end',
              }}
            >
              {showTimestamp && (
                <div
                  style={{
                    color: TOKENS.textMuted,
                    fontFamily: TOKENS.mono,
                    fontSize: metaFontSize(density),
                    whiteSpace: 'nowrap',
                  }}
                >
                  {formatClockTime(normalized.safeTs)}
                  {showRelativeTime && (
                    <span style={{ color: TOKENS.textFaint }}> · {formatRelativeTime(normalized.safeTs)}</span>
                  )}
                </div>
              )}
              <div
                title={computeMessageTitle(normalized)}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 999,
                  display: 'grid',
                  placeItems: 'center',
                  background: visual.badgeBg,
                  border: `1px solid ${visual.border}`,
                  color: visual.badgeText,
                  fontSize: 12,
                }}
              >
                {visual.icon}
              </div>
            </div>
          </div>

          {replyPreview && (
            <ReplyPreviewCard replyPreview={replyPreview} onClick={handleReplyPreview} />
          )}

          <div
            style={{
              display: 'grid',
              gap: 8,
              minWidth: 0,
            }}
          >
            {(normalized.safeKind === 'SYSTEM' || normalized.safeKind === 'BOT_ATTACK' || normalized.safeKind === 'DEAL_RECAP') && (
              <SectionLabel label={computeMessageTitle(normalized)} />
            )}

            <div
              style={{
                fontSize: bodyFontSize(density),
                lineHeight: density === 'compact' ? 1.48 : 1.58,
                color: visual.bodyAccent,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                ...bodyClampStyle(clampLines),
              }}
            >
              {emphasizeText(renderBodyText(normalized), highlightRanges)}
            </div>

            {allowBodyClamp && maxBodyLines && countLines(normalized.safeBody) > maxBodyLines && (
              <div>
                <button
                  type="button"
                  onClick={event => {
                    event.stopPropagation();
                    setShowFullBody(prev => !prev);
                  }}
                  style={{
                    appearance: 'none',
                    border: 0,
                    background: 'transparent',
                    padding: 0,
                    margin: 0,
                    color: TOKENS.indigo,
                    fontFamily: TOKENS.mono,
                    fontSize: 10.5,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                  }}
                >
                  {showFullBody ? 'Collapse' : 'Expand'}
                </button>
              </div>
            )}
          </div>

          {(showSystemMetaRail || showBotDiagnostics) && botSource && <BotSourceRail source={botSource} />}
          {showSystemMetaRail && shieldMeta && <ShieldRail meta={shieldMeta} />}
          {showSystemMetaRail && cascadeMeta && <CascadeRail meta={cascadeMeta} />}

          {(showProofHash && normalized.safeProofHash) || visibleActions.length > 0 ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {showProofHash && normalized.safeProofHash && (
                  <ProofHashButton proofHash={normalized.safeProofHash} onClick={handleProofSelect} />
                )}
                {normalized.isRecorded && !normalized.safeProofHash && (
                  <MetaChip value="transcript recorded" tone="warning" density={density} />
                )}
                {normalized.safeEmoji && normalized.safeKind !== 'PLAYER' && (
                  <MetaChip value={normalized.safeEmoji} tone="neutral" density={density} />
                )}
              </div>

              {showMessageActions && visibleActions.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    flexWrap: 'wrap',
                    alignItems: 'center',
                  }}
                >
                  {visibleActions.map(action => (
                    <ActionButton
                      key={action.id}
                      action={action}
                      onClick={() => onAction?.(action.id, message)}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {showDiagnosticsDrawer && (
            <div style={{ display: 'grid', gap: 8 }}>
              <div>
                <button
                  type="button"
                  onClick={event => {
                    event.stopPropagation();
                    setShowDiagnostics(prev => !prev);
                  }}
                  style={{
                    appearance: 'none',
                    border: 0,
                    background: 'transparent',
                    padding: 0,
                    margin: 0,
                    color: TOKENS.textSub,
                    fontFamily: TOKENS.mono,
                    fontSize: 10.5,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                  }}
                >
                  {showDiagnostics ? 'Hide diagnostics' : 'Show diagnostics'}
                </button>
              </div>
              {showDiagnostics && <DiagnosticsDrawer diagnostics={resolvedDiagnostics} />}
            </div>
          )}
        </div>
      </div>
    </article>
  );
});

export default ChatMessageCard;
