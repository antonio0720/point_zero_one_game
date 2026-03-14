import React, { memo, useId, useMemo } from 'react';
import type {
  ChatChannelId,
  ChatInterruptPriority,
  ChatMountTarget,
  ChatPresenceSnapshot,
  ChatTypingSnapshot,
  ChatVisibleChannel,
} from './types';
import { CHAT_ENGINE_AUTHORITIES, CHAT_MOUNT_PRESETS } from './types';

/**
 * ============================================================================
 * POINT ZERO ONE — UNIFIED CHAT ENGINE
 * FILE: pzo-web/src/engines/chat/ChatCollapsedPill.tsx
 * ============================================================================
 *
 * Purpose
 * -------
 * Presentation-only collapsed launcher / status pill for the unified chat lane.
 *
 * This component is for the "chat is alive even when the dock is minimized"
 * state. It is not a store owner, not a room owner, and not an inference lane.
 * It renders surfaced authority that the engine already computed:
 * - unread pressure
 * - active typing theater
 * - visible presence count
 * - invasion status
 * - threat pressure
 * - helper pending urgency
 * - mount-aware mood + density summary
 *
 * Design laws
 * -----------
 * - Collapsed state must still feel authoritative, not decorative.
 * - The first glance should answer: is the room safe, loud, urgent, or calling?
 * - The pill must remain compact enough for BattleHUD / Empire / League mounts.
 * - The pill must not invent transcript truth or notification policy.
 * - It may summarize, but it must not reinterpret backend truth into fiction.
 * - It must preserve accessibility and click targets under high-pressure play.
 *
 * Repo grounding
 * --------------
 * - Legacy collapsed bubble exists inside pzo-web/src/components/chat/ChatPanel.tsx.
 * - Current active frontend canonical lane already includes UnifiedChatDock.tsx
 *   under pzo-web/src/engines/chat, so this file matches the live repo lane.
 * - Mount presets and channel doctrine are already defined in ./types.
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ============================================================================
 */

// ============================================================================
// MARK: Design tokens
// ============================================================================

const TOKENS = {
  void: '#030308',
  card: '#0C0C1E',
  cardHi: '#131328',
  cardEl: '#191934',
  border: 'rgba(255,255,255,0.08)',
  borderM: 'rgba(255,255,255,0.16)',
  borderH: 'rgba(255,255,255,0.24)',
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
  cyan: '#7DD3FC',
  white: '#FFFFFF',
  mono: "'IBM Plex Mono', 'JetBrains Mono', monospace",
  display: "'Syne', 'Outfit', system-ui, sans-serif",
} as const;

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');`;

// ============================================================================
// MARK: Public props
// ============================================================================

export type ChatCollapsedPillThreatBand = 'CALM' | 'ELEVATED' | 'HOSTILE' | 'CRITICAL';
export type ChatCollapsedPillPresenceMood = 'QUIET' | 'WATCHED' | 'ACTIVE' | 'SWARMING';

export interface ChatCollapsedChannelSummary {
  readonly channel: ChatVisibleChannel;
  readonly unreadCount: number;
  readonly mentionCount?: number;
  readonly helperPending?: boolean;
  readonly haterPending?: boolean;
  readonly typingCount?: number;
}

export interface ChatCollapsedInvasionSummary {
  readonly active: boolean;
  readonly invasionId?: string;
  readonly label?: string;
  readonly aggressorName?: string;
  readonly stage?: 'STAGING' | 'LIVE' | 'PUNISH_WINDOW' | 'FADING';
  readonly interruptPriority?: ChatInterruptPriority;
}

export interface ChatCollapsedThreatSummary {
  readonly score01: number;
  readonly band: ChatCollapsedPillThreatBand;
  readonly helperPressure?: number;
  readonly haterPressure?: number;
  readonly crowdHeat?: number;
}

export interface ChatCollapsedHelperSummary {
  readonly promptPending: boolean;
  readonly helperName?: string;
  readonly promptLabel?: string;
  readonly urgencyScore?: number;
  readonly trustWindow?: number;
}

export interface ChatCollapsedPillProps {
  readonly mountTarget: ChatMountTarget;
  readonly activeChannel: ChatVisibleChannel;
  readonly defaultChannel?: ChatVisibleChannel;
  readonly unreadTotal: number;
  readonly mentionTotal?: number;
  readonly visiblePresence?: readonly ChatPresenceSnapshot[];
  readonly visibleTyping?: readonly ChatTypingSnapshot[];
  readonly channelSummaries?: readonly ChatCollapsedChannelSummary[];
  readonly invasion?: ChatCollapsedInvasionSummary | null;
  readonly threat?: ChatCollapsedThreatSummary | null;
  readonly helper?: ChatCollapsedHelperSummary | null;
  readonly roomLabel?: string;
  readonly worldEventLabel?: string;
  readonly isAttentionFlashing?: boolean;
  readonly isMuted?: boolean;
  readonly isDisabled?: boolean;
  readonly fixedPosition?: boolean;
  readonly anchor?: 'BOTTOM_RIGHT' | 'BOTTOM_LEFT' | 'INLINE';
  readonly style?: React.CSSProperties;
  readonly className?: string;
  readonly onOpen?: () => void;
  readonly onCycleChannel?: (channel: ChatVisibleChannel) => void;
}

// ============================================================================
// MARK: Local helpers
// ============================================================================

function clamp01(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0;
  if ((value as number) <= 0) return 0;
  if ((value as number) >= 1) return 1;
  return value as number;
}

function channelVisual(channel: ChatVisibleChannel): {
  label: string;
  accent: string;
  bg: string;
  border: string;
  glyph: string;
} {
  switch (channel) {
    case 'SYNDICATE':
      return {
        label: 'Syndicate',
        accent: TOKENS.teal,
        bg: 'rgba(34,211,238,0.08)',
        border: 'rgba(34,211,238,0.22)',
        glyph: '◎',
      };
    case 'DEAL_ROOM':
      return {
        label: 'Deal Room',
        accent: TOKENS.orange,
        bg: 'rgba(255,140,0,0.08)',
        border: 'rgba(255,140,0,0.24)',
        glyph: '¤',
      };
    case 'LOBBY':
      return {
        label: 'Lobby',
        accent: TOKENS.purple,
        bg: 'rgba(168,85,247,0.08)',
        border: 'rgba(168,85,247,0.22)',
        glyph: '◌',
      };
    case 'GLOBAL':
    default:
      return {
        label: 'Global',
        accent: TOKENS.indigo,
        bg: 'rgba(129,140,248,0.08)',
        border: 'rgba(129,140,248,0.24)',
        glyph: '◉',
      };
  }
}

function threatTone(
  band: ChatCollapsedPillThreatBand | undefined,
): {
  accent: string;
  bg: string;
  border: string;
  label: string;
} {
  switch (band) {
    case 'CRITICAL':
      return {
        accent: TOKENS.red,
        bg: 'rgba(255,77,77,0.12)',
        border: 'rgba(255,77,77,0.26)',
        label: 'Critical threat',
      };
    case 'HOSTILE':
      return {
        accent: TOKENS.orange,
        bg: 'rgba(255,140,0,0.12)',
        border: 'rgba(255,140,0,0.24)',
        label: 'Hostile room',
      };
    case 'ELEVATED':
      return {
        accent: TOKENS.yellow,
        bg: 'rgba(255,215,0,0.10)',
        border: 'rgba(255,215,0,0.22)',
        label: 'Elevated pressure',
      };
    case 'CALM':
    default:
      return {
        accent: TOKENS.green,
        bg: 'rgba(34,221,136,0.10)',
        border: 'rgba(34,221,136,0.22)',
        label: 'Calm room',
      };
  }
}

function typingLabel(typing: readonly ChatTypingSnapshot[] | undefined): string | null {
  if (!typing || typing.length === 0) return null;
  if (typing.length === 1) return '1 typing';
  return `${typing.length} typing`;
}

function presenceMood(
  visiblePresence: readonly ChatPresenceSnapshot[] | undefined,
  visibleTyping: readonly ChatTypingSnapshot[] | undefined,
): ChatCollapsedPillPresenceMood {
  const presenceCount = visiblePresence?.length ?? 0;
  const typingCount = visibleTyping?.length ?? 0;

  if (presenceCount >= 8 || typingCount >= 3) return 'SWARMING';
  if (presenceCount >= 4 || typingCount >= 2) return 'ACTIVE';
  if (presenceCount >= 1 || typingCount >= 1) return 'WATCHED';
  return 'QUIET';
}

function presenceAccent(mood: ChatCollapsedPillPresenceMood): string {
  switch (mood) {
    case 'SWARMING':
      return TOKENS.orange;
    case 'ACTIVE':
      return TOKENS.indigo;
    case 'WATCHED':
      return TOKENS.teal;
    case 'QUIET':
    default:
      return TOKENS.textMut;
  }
}

function formatUnreadLabel(unread: number, mentions: number | undefined): string {
  if (mentions && mentions > 0) {
    return mentions > 99 ? '99+ mentions' : `${mentions} mention${mentions === 1 ? '' : 's'}`;
  }
  if (unread <= 0) return 'No unread';
  if (unread > 99) return '99+ unread';
  return `${unread} unread`;
}

function sortedChannels(
  summaries: readonly ChatCollapsedChannelSummary[] | undefined,
  active: ChatVisibleChannel,
  fallback: ChatVisibleChannel,
): readonly ChatCollapsedChannelSummary[] {
  if (!summaries || summaries.length === 0) {
    return [
      {
        channel: active || fallback,
        unreadCount: 0,
      },
    ];
  }

  return [...summaries].sort((a, b) => {
    if (a.channel === active && b.channel !== active) return -1;
    if (b.channel === active && a.channel !== active) return 1;
    const pressureA = (a.unreadCount ?? 0) + (a.mentionCount ?? 0) * 2 + (a.helperPending ? 3 : 0);
    const pressureB = (b.unreadCount ?? 0) + (b.mentionCount ?? 0) * 2 + (b.helperPending ? 3 : 0);
    return pressureB - pressureA;
  });
}

function mountMoodLabel(mountTarget: ChatMountTarget): string {
  const preset = CHAT_MOUNT_PRESETS[mountTarget];
  return preset?.stageMood ?? 'TENSE';
}

function anchorStyle(
  fixedPosition: boolean | undefined,
  anchor: ChatCollapsedPillProps['anchor'],
): React.CSSProperties {
  if (!fixedPosition) return {};
  switch (anchor) {
    case 'BOTTOM_LEFT':
      return {
        position: 'fixed',
        left: 16,
        bottom: 16,
        zIndex: 60,
      };
    case 'INLINE':
      return {};
    case 'BOTTOM_RIGHT':
    default:
      return {
        position: 'fixed',
        right: 16,
        bottom: 16,
        zIndex: 60,
      };
  }
}

// ============================================================================
// MARK: Component
// ============================================================================

function ChatCollapsedPillComponent({
  mountTarget,
  activeChannel,
  defaultChannel = 'GLOBAL',
  unreadTotal,
  mentionTotal,
  visiblePresence,
  visibleTyping,
  channelSummaries,
  invasion,
  threat,
  helper,
  roomLabel,
  worldEventLabel,
  isAttentionFlashing = false,
  isMuted = false,
  isDisabled = false,
  fixedPosition = false,
  anchor = 'BOTTOM_RIGHT',
  style,
  className,
  onOpen,
  onCycleChannel,
}: ChatCollapsedPillProps): React.JSX.Element {
  const pillId = useId();

  const derived = useMemo(() => {
    const mountPreset = CHAT_MOUNT_PRESETS[mountTarget];
    const mountMood = mountMoodLabel(mountTarget);
    const currentVisual = channelVisual(activeChannel);
    const effectiveThreatTone = threatTone(threat?.band);
    const mood = presenceMood(visiblePresence, visibleTyping);
    const moodAccent = presenceAccent(mood);
    const typingText = typingLabel(visibleTyping);
    const sorted = sortedChannels(channelSummaries, activeChannel, defaultChannel);
    const miniChannels = sorted.slice(0, 3);
    const helperUrgency = clamp01(helper?.urgencyScore);
    const helperTrust = clamp01(helper?.trustWindow);

    return {
      mountPreset,
      mountMood,
      currentVisual,
      effectiveThreatTone,
      mood,
      moodAccent,
      typingText,
      sorted,
      miniChannels,
      helperUrgency,
      helperTrust,
    };
  }, [
    mountTarget,
    activeChannel,
    defaultChannel,
    visiblePresence,
    visibleTyping,
    channelSummaries,
    threat,
    helper,
  ]);

  const rootStyle: React.CSSProperties = {
    display: 'grid',
    gap: 10,
    minWidth: 246,
    maxWidth: 318,
    padding: '10px 10px 10px 12px',
    borderRadius: 18,
    background: `linear-gradient(180deg, ${TOKENS.cardHi}, ${TOKENS.card})`,
    border: `1px solid ${invasion?.active ? 'rgba(255,77,77,0.22)' : TOKENS.borderM}`,
    boxShadow: invasion?.active
      ? '0 18px 38px rgba(255,77,77,0.12), 0 0 0 1px rgba(255,77,77,0.06) inset'
      : '0 18px 38px rgba(0,0,0,0.34), 0 0 0 1px rgba(255,255,255,0.03) inset',
    backdropFilter: 'blur(10px)',
    overflow: 'hidden',
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    opacity: isDisabled ? 0.55 : 1,
    ...anchorStyle(fixedPosition, anchor),
    ...style,
  };

  return (
    <button
      id={pillId}
      type="button"
      className={className}
      disabled={isDisabled}
      onClick={() => {
        if (isDisabled) return;
        onOpen?.();
      }}
      style={rootStyle}
      aria-label={`Open chat. ${formatUnreadLabel(unreadTotal, mentionTotal)}.`}
      data-authority-root={CHAT_ENGINE_AUTHORITIES.frontendEngineRoot}
      data-mount-target={mountTarget}
      data-active-channel={activeChannel}
    >
      <style>{FONT_IMPORT}</style>
      <style>{`
        @keyframes pzo-pill-flash {
          0%, 100% { box-shadow: 0 0 0 0 rgba(129,140,248,0.00); }
          50% { box-shadow: 0 0 0 7px rgba(129,140,248,0.12); }
        }

        @keyframes pzo-pill-online {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.55; transform: scale(0.92); }
        }

        @keyframes pzo-pill-danger {
          0%, 100% { opacity: 0.85; }
          50% { opacity: 1; }
        }
      `}</style>

      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          insetInline: 0,
          top: 0,
          height: 3,
          background: invasion?.active
            ? `linear-gradient(90deg, ${TOKENS.red}, ${TOKENS.orange}, ${TOKENS.yellow})`
            : `linear-gradient(90deg, ${derived.currentVisual.accent}, ${derived.effectiveThreatTone.accent})`,
        }}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto minmax(0, 1fr) auto',
          gap: 10,
          alignItems: 'center',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: 'relative',
            width: 42,
            height: 42,
            borderRadius: 14,
            display: 'grid',
            placeItems: 'center',
            fontFamily: TOKENS.display,
            fontWeight: 800,
            fontSize: 17,
            color: TOKENS.white,
            background: `linear-gradient(135deg, ${derived.currentVisual.accent}, ${invasion?.active ? TOKENS.red : TOKENS.purple})`,
            boxShadow: '0 12px 26px rgba(0,0,0,0.28)',
            animation: isAttentionFlashing ? 'pzo-pill-flash 1.5s ease-in-out infinite' : 'none',
          }}
        >
          {derived.currentVisual.glyph}
          <span
            style={{
              position: 'absolute',
              width: 10,
              height: 10,
              borderRadius: '50%',
              right: -2,
              bottom: -2,
              background: invasion?.active ? TOKENS.red : derived.moodAccent,
              border: `2px solid ${TOKENS.card}`,
              animation:
                invasion?.active || derived.mood !== 'QUIET' ? 'pzo-pill-online 1.4s ease-in-out infinite' : 'none',
            }}
          />
        </div>

        <div style={{ display: 'grid', gap: 4, minWidth: 0, textAlign: 'left' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                color: TOKENS.text,
                fontFamily: TOKENS.display,
                fontSize: 15,
                fontWeight: 800,
                letterSpacing: '-0.02em',
                minWidth: 0,
              }}
            >
              {roomLabel || derived.currentVisual.label}
            </span>
            <span
              style={{
                color: derived.currentVisual.accent,
                background: derived.currentVisual.bg,
                border: `1px solid ${derived.currentVisual.border}`,
                borderRadius: 999,
                padding: '3px 7px',
                fontSize: 10,
                fontWeight: 800,
                fontFamily: TOKENS.mono,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              {derived.currentVisual.label}
            </span>
            {isMuted ? (
              <span
                style={{
                  color: TOKENS.textSub,
                  fontSize: 10,
                  fontWeight: 800,
                  fontFamily: TOKENS.mono,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                Muted
              </span>
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
            <span
              style={{
                color: TOKENS.textSub,
                fontSize: 11,
                fontWeight: 700,
                fontFamily: TOKENS.mono,
              }}
            >
              {formatUnreadLabel(unreadTotal, mentionTotal)}
            </span>
            <span
              style={{
                color: TOKENS.textMut,
                fontSize: 11,
                fontWeight: 700,
                fontFamily: TOKENS.mono,
              }}
            >
              • {derived.mountMood}
            </span>
            <span
              style={{
                color: derived.moodAccent,
                fontSize: 11,
                fontWeight: 700,
                fontFamily: TOKENS.mono,
              }}
            >
              • {derived.mood.toLowerCase()}
            </span>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gap: 6,
            justifyItems: 'end',
            minWidth: 54,
          }}
        >
          <span
            style={{
              minWidth: 28,
              height: 22,
              padding: '0 8px',
              borderRadius: 999,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: unreadTotal > 0 ? 'rgba(255,77,77,0.12)' : 'rgba(255,255,255,0.05)',
              border: unreadTotal > 0 ? '1px solid rgba(255,77,77,0.22)' : `1px solid ${TOKENS.border}`,
              color: unreadTotal > 0 ? TOKENS.red : TOKENS.textSub,
              fontSize: 10,
              fontWeight: 800,
              fontFamily: TOKENS.mono,
              letterSpacing: '0.06em',
              animation: unreadTotal > 0 ? 'pzo-pill-danger 1.6s ease-in-out infinite' : 'none',
            }}
          >
            {unreadTotal > 99 ? '99+' : unreadTotal}
          </span>

          {derived.typingText ? (
            <span
              style={{
                color: TOKENS.teal,
                fontSize: 10,
                fontWeight: 700,
                fontFamily: TOKENS.mono,
              }}
            >
              {derived.typingText}
            </span>
          ) : null}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) auto',
          gap: 10,
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'grid', gap: 8, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <span
              style={{
                color: TOKENS.textMut,
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                fontFamily: TOKENS.mono,
              }}
            >
              Threat pressure
            </span>
            <span
              style={{
                color: derived.effectiveThreatTone.accent,
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                fontFamily: TOKENS.mono,
              }}
            >
              {derived.effectiveThreatTone.label}
            </span>
          </div>

          <div
            style={{
              position: 'relative',
              height: 8,
              borderRadius: 999,
              background: 'rgba(255,255,255,0.05)',
              border: `1px solid ${TOKENS.border}`,
              overflow: 'hidden',
            }}
          >
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: 0,
                width: `${Math.max(4, clamp01(threat?.score01) * 100)}%`,
                borderRadius: 999,
                background: `linear-gradient(90deg, ${derived.effectiveThreatTone.accent}, ${TOKENS.white})`,
                boxShadow: `0 0 18px ${derived.effectiveThreatTone.bg}`,
              }}
            />
          </div>
        </div>

        {helper?.promptPending ? (
          <div
            style={{
              display: 'grid',
              gap: 4,
              padding: '8px 10px',
              minWidth: 88,
              borderRadius: 12,
              background: 'rgba(34,221,136,0.08)',
              border: '1px solid rgba(34,221,136,0.18)',
              textAlign: 'left',
            }}
          >
            <span
              style={{
                color: TOKENS.green,
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                fontFamily: TOKENS.mono,
              }}
            >
              Helper waiting
            </span>
            <span
              style={{
                color: TOKENS.text,
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {helper.helperName || 'Rescue line'}
            </span>
          </div>
        ) : null}
      </div>

      {(invasion?.active || worldEventLabel || helper?.promptPending) && (
        <div
          style={{
            display: 'grid',
            gap: 8,
            padding: '10px 11px',
            borderRadius: 14,
            background: invasion?.active ? 'rgba(255,77,77,0.08)' : 'rgba(255,255,255,0.03)',
            border: invasion?.active ? '1px solid rgba(255,77,77,0.18)' : `1px solid ${TOKENS.border}`,
          }}
        >
          {invasion?.active ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              <span
                style={{
                  color: TOKENS.red,
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  fontFamily: TOKENS.mono,
                }}
              >
                Invasion live
              </span>
              <span
                style={{
                  color: TOKENS.text,
                  fontSize: 11.5,
                  fontWeight: 700,
                }}
              >
                {invasion.label || invasion.aggressorName || 'Pressure spike detected'}
              </span>
              {invasion.stage ? (
                <span
                  style={{
                    color: TOKENS.orange,
                    fontSize: 10,
                    fontWeight: 700,
                    fontFamily: TOKENS.mono,
                  }}
                >
                  {invasion.stage}
                </span>
              ) : null}
            </div>
          ) : null}

          {helper?.promptPending ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              <span
                style={{
                  color: TOKENS.textSub,
                  fontSize: 11.5,
                  fontWeight: 600,
                }}
              >
                {helper.promptLabel || 'Helper prompt is staged and ready.'}
              </span>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  color: TOKENS.green,
                  fontSize: 10,
                  fontWeight: 700,
                  fontFamily: TOKENS.mono,
                }}
              >
                <span>U {Math.round(helperTrust * 100)}%</span>
                <span>•</span>
                <span>R {Math.round(helperUrgency * 100)}%</span>
              </div>
            </div>
          ) : null}

          {worldEventLabel ? (
            <div
              style={{
                color: TOKENS.cyan,
                fontSize: 11.5,
                fontWeight: 700,
              }}
            >
              {worldEventLabel}
            </div>
          ) : null}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        {derived.miniChannels.map((item) => {
          const visual = channelVisual(item.channel);
          const isActive = item.channel === activeChannel;
          const count = Math.max(item.unreadCount ?? 0, item.mentionCount ?? 0);

          return (
            <button
              key={item.channel}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                if (!onCycleChannel || isDisabled) return;
                onCycleChannel(item.channel);
              }}
              disabled={!onCycleChannel || isDisabled}
              style={{
                appearance: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                height: 28,
                padding: '0 10px',
                borderRadius: 999,
                border: `1px solid ${isActive ? visual.border : TOKENS.border}`,
                background: isActive ? visual.bg : 'rgba(255,255,255,0.03)',
                color: isActive ? visual.accent : TOKENS.textSub,
                cursor: !onCycleChannel || isDisabled ? 'default' : 'pointer',
              }}
              title={`Switch to ${visual.label}`}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  fontFamily: TOKENS.mono,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                {visual.label}
              </span>
              {count > 0 ? (
                <span
                  style={{
                    minWidth: 16,
                    height: 16,
                    borderRadius: 99,
                    padding: '0 4px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(255,77,77,0.12)',
                    color: TOKENS.red,
                    fontSize: 9,
                    fontWeight: 800,
                    fontFamily: TOKENS.mono,
                  }}
                >
                  {count > 99 ? '99+' : count}
                </span>
              ) : null}
              {item.helperPending ? (
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: TOKENS.green,
                    boxShadow: '0 0 10px rgba(34,221,136,0.28)',
                  }}
                />
              ) : null}
            </button>
          );
        })}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          flexWrap: 'wrap',
          color: TOKENS.textMut,
          fontSize: 10,
          fontWeight: 700,
          fontFamily: TOKENS.mono,
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
          <span>{CHAT_ENGINE_AUTHORITIES.frontendEngineRoot}</span>
          <span>•</span>
          <span>{derived.mountPreset?.density ?? 'STANDARD'}</span>
          <span>•</span>
          <span>{visiblePresence?.length ?? 0} visible</span>
        </div>
        <span>{mountTarget}</span>
      </div>
    </button>
  );
}

export const ChatCollapsedPill = memo(ChatCollapsedPillComponent);
export default ChatCollapsedPill;
