
/**
 * ============================================================================
 * POINT ZERO ONE — CHAT ROOM HEADER
 * FILE: pzo-web/src/components/chat/ChatRoomHeader.tsx
 * ============================================================================
 *
 * Purpose
 * -------
 * Render-only room header for the unified chat surface.
 *
 * This component is intentionally presentation-first:
 * - no socket ownership
 * - no store mutation
 * - no engine authority
 * - no learning policy
 *
 * It accepts already-derived state from the chat engine lane and translates that
 * state into a dense, highly legible command/header surface that works across:
 * - GLOBAL
 * - SYNDICATE
 * - DEAL_ROOM
 * - transcript drawer overlays
 * - collapsed / pinned / expanded chat shells
 *
 * Design doctrine
 * ---------------
 * - inline styles only, matching the current chat lane and LeagueUI-adjacent
 *   token style already present in ChatPanel.tsx
 * - mobile-first
 * - hater-heat / tick / pressure aware
 * - transcript integrity aware for Deal Room
 * - future-safe for the split between components/chat and engines/chat
 *
 * Scale posture
 * -------------
 * This file is designed to remain render-cheap even under aggressive polling,
 * telemetry updates, presence churn, and high message cadence. Expensive derived
 * display work is memoized and the component is side-effect free except for
 * optional click callbacks provided by the parent shell.
 * ============================================================================
 */

import React, { memo, useMemo } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { ChatChannel, GameChatContext } from './chatTypes';

export type ChatRoomConnectionState =
  | 'CONNECTED'
  | 'CONNECTING'
  | 'DEGRADED'
  | 'DISCONNECTED';

export interface ChatRoomHeaderProps {
  channel: ChatChannel;
  variant?: 'dock' | 'drawer';
  connected?: boolean;
  connectionState?: ChatRoomConnectionState;
  roomTitle?: string;
  roomSubtitle?: string;
  roomCode?: string;
  modeName?: string;
  accentEmoji?: string;
  transcriptLocked?: boolean;
  isPinned?: boolean;
  context?: Partial<GameChatContext>;
  onlineCount?: number;
  activeMembers?: number;
  typingCount?: number;
  totalUnread?: number;
  showTranscriptAction?: boolean;
  showJumpLatestAction?: boolean;
  showPinAction?: boolean;
  showMinimizeAction?: boolean;
  onOpenTranscript?: () => void;
  onJumpLatest?: () => void;
  onTogglePinned?: () => void;
  onMinimize?: () => void;
  rightSlot?: ReactNode;
}

type HeaderPalette = {
  accent: string;
  accentSoft: string;
  accentBorder: string;
  badgeBg: string;
  badgeBorder: string;
  policyBg: string;
  policyBorder: string;
  glow: string;
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

const CHANNEL_LABELS: Record<
  ChatChannel,
  {
    title: string;
    subtitle: string;
    emoji: string;
    policyLabel: string;
    palette: HeaderPalette;
  }
> = {
  GLOBAL: {
    title: 'GLOBAL FEED',
    subtitle: 'Theatrical, public, crowd-reactive, wide-spectrum signaling',
    emoji: '🌐',
    policyLabel: 'PUBLIC VISIBILITY',
    palette: {
      accent: T.indigo,
      accentSoft: 'rgba(129,140,248,0.14)',
      accentBorder: 'rgba(129,140,248,0.28)',
      badgeBg: 'rgba(129,140,248,0.08)',
      badgeBorder: 'rgba(129,140,248,0.18)',
      policyBg: 'rgba(129,140,248,0.08)',
      policyBorder: 'rgba(129,140,248,0.22)',
      glow: 'rgba(129,140,248,0.28)',
    },
  },
  SYNDICATE: {
    title: 'SYNDICATE CHANNEL',
    subtitle: 'Tactical, private, reputation-sensitive alliance traffic',
    emoji: '🏛️',
    policyLabel: 'TRUST-CIRCUIT ROUTING',
    palette: {
      accent: T.teal,
      accentSoft: 'rgba(34,211,238,0.14)',
      accentBorder: 'rgba(34,211,238,0.28)',
      badgeBg: 'rgba(34,211,238,0.08)',
      badgeBorder: 'rgba(34,211,238,0.18)',
      policyBg: 'rgba(34,211,238,0.08)',
      policyBorder: 'rgba(34,211,238,0.22)',
      glow: 'rgba(34,211,238,0.28)',
    },
  },
  DEAL_ROOM: {
    title: 'DEAL ROOM',
    subtitle: 'Transcript-bound, predatory, proof-bearing negotiation lane',
    emoji: '⚡',
    policyLabel: 'TRANSCRIPT INTEGRITY ENFORCED',
    palette: {
      accent: T.yellow,
      accentSoft: 'rgba(255,215,0,0.14)',
      accentBorder: 'rgba(255,215,0,0.28)',
      badgeBg: 'rgba(255,215,0,0.08)',
      badgeBorder: 'rgba(255,215,0,0.18)',
      policyBg: 'rgba(255,215,0,0.08)',
      policyBorder: 'rgba(255,215,0,0.22)',
      glow: 'rgba(255,215,0,0.24)',
    },
  },
};

function clampPercent(value: number | undefined): number | undefined {
  if (typeof value !== 'number' || Number.isNaN(value)) return undefined;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function deriveConnectionState(
  explicit: ChatRoomConnectionState | undefined,
  connected: boolean | undefined,
): ChatRoomConnectionState {
  if (explicit) return explicit;
  return connected ? 'CONNECTED' : 'DISCONNECTED';
}

function connectionColor(state: ChatRoomConnectionState): string {
  switch (state) {
    case 'CONNECTED':
      return T.green;
    case 'CONNECTING':
      return T.indigo;
    case 'DEGRADED':
      return T.orange;
    case 'DISCONNECTED':
    default:
      return T.red;
  }
}

function connectionLabel(state: ChatRoomConnectionState): string {
  switch (state) {
    case 'CONNECTED':
      return 'LIVE';
    case 'CONNECTING':
      return 'NEGOTIATING';
    case 'DEGRADED':
      return 'DEGRADED';
    case 'DISCONNECTED':
    default:
      return 'OFFLINE';
  }
}

function fmtCompactCount(value: number | undefined): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return `${Math.max(0, Math.floor(value))}`;
}

function fallbackRoomTitle(channel: ChatChannel): string {
  return CHANNEL_LABELS[channel].title;
}

function fallbackRoomSubtitle(channel: ChatChannel): string {
  return CHANNEL_LABELS[channel].subtitle;
}

function metricValue(value: string | undefined, fallback = '—'): string {
  return value && value.trim().length > 0 ? value : fallback;
}

function actionButtonStyle(
  disabled: boolean,
  accent: string,
  variant: 'ghost' | 'accent' = 'ghost',
): CSSProperties {
  const accentSoft =
    variant === 'accent' ? `${accent}20` : 'rgba(255,255,255,0.03)';
  const accentBorder =
    variant === 'accent' ? `${accent}40` : 'rgba(255,255,255,0.08)';
  const accentColor = variant === 'accent' ? accent : T.textSub;

  return {
    minHeight: 34,
    minWidth: 34,
    padding: '0 11px',
    borderRadius: 10,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    border: `1px solid ${accentBorder}`,
    background: accentSoft,
    color: accentColor,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: T.mono,
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    opacity: disabled ? 0.45 : 1,
    transition:
      'transform 120ms ease, border-color 120ms ease, background 120ms ease, color 120ms ease',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  };
}

const StatPill = memo(function StatPill({
  label,
  value,
  accent,
  subtle,
}: {
  label: string;
  value: string;
  accent: string;
  subtle?: boolean;
}) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        minHeight: 28,
        padding: '0 10px',
        borderRadius: 999,
        border: `1px solid ${subtle ? 'rgba(255,255,255,0.08)' : `${accent}28`}`,
        background: subtle ? 'rgba(255,255,255,0.025)' : `${accent}10`,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          fontFamily: T.mono,
          fontSize: 8,
          letterSpacing: '0.10em',
          color: subtle ? T.textMut : accent,
          fontWeight: 800,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: T.mono,
          fontSize: 10,
          letterSpacing: '0.04em',
          color: T.text,
          fontWeight: 700,
        }}
      >
        {value}
      </span>
    </div>
  );
});

export const ChatRoomHeader = memo(function ChatRoomHeader({
  channel,
  variant = 'dock',
  connected,
  connectionState,
  roomTitle,
  roomSubtitle,
  roomCode,
  modeName,
  accentEmoji,
  transcriptLocked,
  isPinned,
  context,
  onlineCount,
  activeMembers,
  typingCount,
  totalUnread,
  showTranscriptAction = true,
  showJumpLatestAction = true,
  showPinAction = true,
  showMinimizeAction = true,
  onOpenTranscript,
  onJumpLatest,
  onTogglePinned,
  onMinimize,
  rightSlot,
}: ChatRoomHeaderProps) {
  const channelMeta = CHANNEL_LABELS[channel];
  const state = deriveConnectionState(connectionState, connected);
  const pressureTier = context?.pressureTier;
  const tickTier = context?.tickTier;
  const haterHeat = clampPercent(context?.haterHeat);

  const resolvedTitle = roomTitle ?? fallbackRoomTitle(channel);
  const resolvedSubtitle =
    roomSubtitle ??
    fallbackRoomSubtitle(channel) ??
    (modeName ? `${modeName} routing surface` : '');

  const connectionAccent = connectionColor(state);

  const computedRoomCode = useMemo(() => {
    if (roomCode && roomCode.trim().length > 0) return roomCode.trim().toUpperCase();
    const modeSlice = metricValue(modeName, channel).replace(/\s+/g, '-').slice(0, 10);
    return `${channel}-${modeSlice}`.toUpperCase();
  }, [roomCode, modeName, channel]);

  const rootStyle: CSSProperties = {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: variant === 'drawer' ? '14px 14px 12px' : '12px 14px 10px',
    background:
      variant === 'drawer'
        ? `linear-gradient(180deg, rgba(12,12,30,0.98) 0%, rgba(3,3,8,0.98) 100%)`
        : `linear-gradient(180deg, rgba(12,12,30,0.96) 0%, rgba(12,12,30,0.84) 100%)`,
    borderBottom: `1px solid ${T.border}`,
    overflow: 'hidden',
    flexShrink: 0,
  };

  const accentRailStyle: CSSProperties = {
    position: 'absolute',
    inset: '0 auto 0 0',
    width: 3,
    background: `linear-gradient(180deg, ${channelMeta.palette.accent} 0%, transparent 100%)`,
    opacity: 0.9,
  };

  return (
    <div style={rootStyle}>
      <div style={accentRailStyle} />

      <div
        style={{
          position: 'absolute',
          top: -40,
          right: -40,
          width: 140,
          height: 140,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${channelMeta.palette.glow} 0%, rgba(0,0,0,0) 68%)`,
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          minWidth: 0,
        }}
      >
        <div
          style={{
            width: variant === 'drawer' ? 42 : 38,
            height: variant === 'drawer' ? 42 : 38,
            borderRadius: 12,
            border: `1px solid ${channelMeta.palette.accentBorder}`,
            background: channelMeta.palette.accentSoft,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: variant === 'drawer' ? 20 : 18,
            boxShadow: `0 0 0 1px rgba(255,255,255,0.03), 0 8px 26px ${channelMeta.palette.glow}`,
            flexShrink: 0,
          }}
        >
          {accentEmoji ?? channelMeta.emoji}
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
              marginBottom: 4,
            }}
          >
            <span
              style={{
                fontFamily: T.display,
                fontSize: variant === 'drawer' ? 15 : 13,
                fontWeight: 800,
                color: T.text,
                letterSpacing: '0.04em',
                minWidth: 0,
              }}
            >
              {resolvedTitle}
            </span>

            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                minHeight: 24,
                padding: '0 8px',
                borderRadius: 999,
                background: channelMeta.palette.badgeBg,
                border: `1px solid ${channelMeta.palette.badgeBorder}`,
                whiteSpace: 'nowrap',
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: connectionAccent,
                  boxShadow: `0 0 10px ${connectionAccent}90`,
                }}
              />
              <span
                style={{
                  fontFamily: T.mono,
                  fontSize: 8,
                  fontWeight: 800,
                  letterSpacing: '0.10em',
                  color: connectionAccent,
                  textTransform: 'uppercase',
                }}
              >
                {connectionLabel(state)}
              </span>
            </span>

            {totalUnread ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 20,
                  minWidth: 20,
                  padding: '0 6px',
                  borderRadius: 999,
                  background: 'rgba(255,77,77,0.12)',
                  border: '1px solid rgba(255,77,77,0.22)',
                  color: T.red,
                  fontFamily: T.mono,
                  fontSize: 8,
                  fontWeight: 800,
                  letterSpacing: '0.10em',
                  textTransform: 'uppercase',
                }}
              >
                {totalUnread > 99 ? '99+' : totalUnread}
              </span>
            ) : null}

            {transcriptLocked ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  minHeight: 22,
                  padding: '0 8px',
                  borderRadius: 999,
                  background: 'rgba(255,215,0,0.08)',
                  border: '1px solid rgba(255,215,0,0.20)',
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{ fontSize: 10 }}>🔒</span>
                <span
                  style={{
                    fontFamily: T.mono,
                    fontSize: 8,
                    fontWeight: 800,
                    letterSpacing: '0.10em',
                    color: T.yellow,
                    textTransform: 'uppercase',
                  }}
                >
                  Locked
                </span>
              </span>
            ) : null}
          </div>

          <div
            style={{
              fontFamily: T.display,
              fontSize: 11,
              lineHeight: 1.45,
              color: T.textSub,
              maxWidth: '100%',
            }}
          >
            {resolvedSubtitle}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              flexWrap: 'wrap',
              marginTop: 8,
            }}
          >
            <span
              style={{
                fontFamily: T.mono,
                fontSize: 8,
                letterSpacing: '0.10em',
                color: channelMeta.palette.accent,
                textTransform: 'uppercase',
                fontWeight: 800,
              }}
            >
              {channel}
            </span>

            <span
              style={{
                fontFamily: T.mono,
                fontSize: 8,
                letterSpacing: '0.08em',
                color: T.textMut,
                textTransform: 'uppercase',
                fontWeight: 700,
              }}
            >
              {computedRoomCode}
            </span>

            {modeName ? (
              <span
                style={{
                  fontFamily: T.mono,
                  fontSize: 8,
                  letterSpacing: '0.08em',
                  color: T.textMut,
                  textTransform: 'uppercase',
                  fontWeight: 700,
                }}
              >
                MODE {modeName}
              </span>
            ) : null}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            flexShrink: 0,
          }}
        >
          {showTranscriptAction ? (
            <button
              type="button"
              onClick={onOpenTranscript}
              disabled={!onOpenTranscript}
              style={actionButtonStyle(!onOpenTranscript, channelMeta.palette.accent)}
              title="Open transcript drawer"
            >
              📜
              {variant === 'drawer' ? 'Transcript' : ''}
            </button>
          ) : null}

          {showJumpLatestAction ? (
            <button
              type="button"
              onClick={onJumpLatest}
              disabled={!onJumpLatest}
              style={actionButtonStyle(!onJumpLatest, channelMeta.palette.accent)}
              title="Jump to latest message"
            >
              ⤓
              {variant === 'drawer' ? 'Latest' : ''}
            </button>
          ) : null}

          {showPinAction ? (
            <button
              type="button"
              onClick={onTogglePinned}
              disabled={!onTogglePinned}
              style={actionButtonStyle(!onTogglePinned, channelMeta.palette.accent, isPinned ? 'accent' : 'ghost')}
              title={isPinned ? 'Unpin chat shell' : 'Pin chat shell'}
            >
              {isPinned ? '📌' : '📍'}
              {variant === 'drawer' ? (isPinned ? 'Pinned' : 'Pin') : ''}
            </button>
          ) : null}

          {showMinimizeAction ? (
            <button
              type="button"
              onClick={onMinimize}
              disabled={!onMinimize}
              style={actionButtonStyle(!onMinimize, T.textSub)}
              title="Minimize chat"
            >
              ╲╱
            </button>
          ) : null}

          {rightSlot}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          alignItems: 'center',
        }}
      >
        <StatPill
          label="Online"
          value={fmtCompactCount(onlineCount)}
          accent={channelMeta.palette.accent}
        />
        <StatPill
          label="Present"
          value={fmtCompactCount(activeMembers)}
          accent={channelMeta.palette.accent}
          subtle
        />
        <StatPill
          label="Typing"
          value={fmtCompactCount(typingCount)}
          accent={channelMeta.palette.accent}
          subtle
        />

        {pressureTier ? (
          <StatPill
            label="Pressure"
            value={pressureTier}
            accent={T.orange}
          />
        ) : null}

        {tickTier ? (
          <StatPill
            label="Tick"
            value={tickTier}
            accent={T.indigo}
          />
        ) : null}

        {typeof haterHeat === 'number' ? (
          <StatPill
            label="Heat"
            value={`${haterHeat}%`}
            accent={haterHeat >= 70 ? T.red : haterHeat >= 40 ? T.orange : T.teal}
          />
        ) : null}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            minHeight: 28,
            padding: '0 10px',
            borderRadius: 999,
            background: channelMeta.palette.policyBg,
            border: `1px solid ${channelMeta.palette.policyBorder}`,
          }}
        >
          <span style={{ fontSize: 11 }}>{channelMeta.emoji}</span>
          <span
            style={{
              fontFamily: T.mono,
              fontSize: 8,
              fontWeight: 800,
              letterSpacing: '0.10em',
              color: channelMeta.palette.accent,
              textTransform: 'uppercase',
            }}
          >
            {channelMeta.policyLabel}
          </span>
        </div>

        {channel === 'DEAL_ROOM' ? (
          <span
            style={{
              fontFamily: T.display,
              fontSize: 10,
              lineHeight: 1.4,
              color: T.textSub,
            }}
          >
            Proof-bearing recap cards, lock-state receipts, and transcript permanence are surfaced
            here so negotiation pressure remains visible without giving the UI lane authority.
          </span>
        ) : channel === 'SYNDICATE' ? (
          <span
            style={{
              fontFamily: T.display,
              fontSize: 10,
              lineHeight: 1.4,
              color: T.textSub,
            }}
          >
            Alliance trust, coordination cadence, and group reaction windows should feel intimate,
            tactical, and fast without leaking policy into the render shell.
          </span>
        ) : (
          <span
            style={{
              fontFamily: T.display,
              fontSize: 10,
              lineHeight: 1.4,
              color: T.textSub,
            }}
          >
            Global traffic should read as public theater: visible witnesses, social pressure, broad
            reaction velocity, and fast perception shifts.
          </span>
        )}
      </div>
    </div>
  );
});

export default ChatRoomHeader;
