import React, { memo, useMemo } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { ChatChannel, GameChatContext } from './chatTypes';

/**
 * ============================================================================
 * POINT ZERO ONE — CHAT EMPTY STATE
 * FILE: pzo-web/src/components/chat/ChatEmptyState.tsx
 * ============================================================================
 *
 * Purpose
 * -------
 * Render-only empty-state surface for the unified chat shell.
 *
 * This file lives in the presentation lane on purpose:
 * - no socket ownership
 * - no EventBus subscriptions
 * - no learning writes
 * - no battle imports
 * - no runtime policy mutation
 *
 * It accepts already-derived state from the current hook / engine bridge and
 * turns that state into a high-context panel that can represent several real
 * empty states instead of a single generic “no messages” placeholder.
 *
 * Supported UI scenarios
 * ----------------------
 * 1. Cold open / no transcript yet
 * 2. Disconnected transport lane
 * 3. Active channel has no visible messages yet
 * 4. Search / transcript filters produced zero results
 * 5. Deal room is waiting for the first proof-bearing recap
 * 6. Pressure / threat-aware encouragement state
 * 7. Compact collapsed-shell placeholder
 *
 * Design laws
 * -----------
 * - The UI should feel intentional even when nothing is visible.
 * - Channel identity must still be legible in empty state.
 * - Threat / pressure / sovereignty posture should still be surfaced.
 * - Empty does not mean dead; it means the lane is waiting for the next event.
 * - The component must stay cheap enough to render across many mount targets.
 * ============================================================================
 */

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

type EmptyStateMode =
  | 'IDLE'
  | 'DISCONNECTED'
  | 'FILTERED'
  | 'DEAL_WAITING'
  | 'THREAT'
  | 'COLLAPSED';

export interface ChatEmptyStateProps {
  channel: ChatChannel;
  mode?: EmptyStateMode;
  compact?: boolean;
  connected?: boolean;
  hasSearchQuery?: boolean;
  transcriptView?: boolean;
  title?: string;
  subtitle?: string;
  helperText?: string;
  context?: Partial<GameChatContext>;
  primaryLabel?: string;
  secondaryLabel?: string;
  tertiaryLabel?: string;
  onPrimaryAction?: () => void;
  onSecondaryAction?: () => void;
  onTertiaryAction?: () => void;
  footerSlot?: ReactNode;
}

type ChannelMeta = {
  label: string;
  emoji: string;
  accent: string;
  accentSoft: string;
  accentBorder: string;
  defaultTitle: string;
  defaultSubtitle: string;
  idlePrompt: string;
  emptyTip: string;
};

const CHANNEL_META: Record<ChatChannel, ChannelMeta> = {
  GLOBAL: {
    label: 'GLOBAL',
    emoji: '🌐',
    accent: T.indigo,
    accentSoft: 'rgba(129,140,248,0.14)',
    accentBorder: 'rgba(129,140,248,0.28)',
    defaultTitle: 'Global channel is live but quiet',
    defaultSubtitle:
      'This lane is public theater. The next market alert, player burst, or bot intrusion will surface here first.',
    idlePrompt: 'Public witness lane waiting for its next event.',
    emptyTip:
      'Global should feel watched even when no one is speaking. Let the silence imply a world still in motion.',
  },
  SYNDICATE: {
    label: 'SYNDICATE',
    emoji: '🏛️',
    accent: T.teal,
    accentSoft: 'rgba(34,211,238,0.14)',
    accentBorder: 'rgba(34,211,238,0.28)',
    defaultTitle: 'Syndicate channel is awaiting coordination',
    defaultSubtitle:
      'Alliance traffic has not surfaced in the current window yet. Tactical calls, warnings, and trust signals will land here.',
    idlePrompt: 'Private trust lane awaiting coordination.',
    emptyTip:
      'This lane should read intimate and tactical. Silence here feels deliberate, not dead.',
  },
  DEAL_ROOM: {
    label: 'DEAL ROOM',
    emoji: '⚡',
    accent: T.yellow,
    accentSoft: 'rgba(255,215,0,0.14)',
    accentBorder: 'rgba(255,215,0,0.28)',
    defaultTitle: 'Deal room is waiting on the first move',
    defaultSubtitle:
      'This lane is proof-bearing and transcript-sensitive. Offers, counters, and recap hashes surface once negotiation begins.',
    idlePrompt: 'Predatory negotiation lane awaiting leverage.',
    emptyTip:
      'Deal room silence should feel expensive. It is a negotiation chamber, not a social room.',
  },
};

function clampPercent(value: number | undefined): number | undefined {
  if (typeof value !== 'number' || Number.isNaN(value)) return undefined;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function resolveMode(
  explicitMode: EmptyStateMode | undefined,
  connected: boolean | undefined,
  channel: ChatChannel,
  hasSearchQuery: boolean | undefined,
  compact: boolean | undefined,
  context: Partial<GameChatContext> | undefined,
): EmptyStateMode {
  if (explicitMode) return explicitMode;
  if (compact) return 'COLLAPSED';
  if (connected === false) return 'DISCONNECTED';
  if (hasSearchQuery) return 'FILTERED';
  if (channel === 'DEAL_ROOM') return 'DEAL_WAITING';

  const heat = clampPercent(context?.haterHeat);
  if (
    (typeof heat === 'number' && heat >= 70) ||
    context?.pressureTier === 'CRITICAL' ||
    context?.tickTier === 'COLLAPSE_IMMINENT'
  ) {
    return 'THREAT';
  }

  return 'IDLE';
}

function threatLevel(context: Partial<GameChatContext> | undefined): {
  label: string;
  color: string;
  meter: number;
} {
  const heat = clampPercent(context?.haterHeat) ?? 0;

  if (context?.pressureTier === 'CRITICAL' || context?.tickTier === 'COLLAPSE_IMMINENT' || heat >= 85) {
    return { label: 'Critical', color: T.red, meter: Math.max(heat, 90) };
  }

  if (context?.pressureTier === 'HIGH' || context?.tickTier === 'CRISIS' || heat >= 60) {
    return { label: 'High', color: T.orange, meter: Math.max(heat, 68) };
  }

  if (context?.pressureTier === 'ELEVATED' || context?.tickTier === 'COMPRESSED' || heat >= 35) {
    return { label: 'Rising', color: T.yellow, meter: Math.max(heat, 42) };
  }

  return { label: 'Stable', color: T.teal, meter: Math.max(heat, 18) };
}

function actionStyle(disabled: boolean, accent: string, filled = false): CSSProperties {
  return {
    minHeight: 38,
    padding: '0 12px',
    borderRadius: 11,
    border: `1px solid ${filled ? `${accent}50` : `${accent}24`}`,
    background: filled ? `${accent}1A` : 'rgba(255,255,255,0.03)',
    color: filled ? accent : T.textSub,
    fontFamily: T.mono,
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    transition: 'transform 120ms ease, border-color 120ms ease, background 120ms ease',
    whiteSpace: 'nowrap',
  };
}

const InfoChip = memo(function InfoChip({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
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
        border: `1px solid ${accent}24`,
        background: `${accent}10`,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          fontFamily: T.mono,
          fontSize: 8,
          fontWeight: 800,
          letterSpacing: '0.10em',
          textTransform: 'uppercase',
          color: accent,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: T.mono,
          fontSize: 10,
          fontWeight: 700,
          color: T.text,
        }}
      >
        {value}
      </span>
    </div>
  );
});

export const ChatEmptyState = memo(function ChatEmptyState({
  channel,
  mode,
  compact = false,
  connected = true,
  hasSearchQuery = false,
  transcriptView = false,
  title,
  subtitle,
  helperText,
  context,
  primaryLabel,
  secondaryLabel,
  tertiaryLabel,
  onPrimaryAction,
  onSecondaryAction,
  onTertiaryAction,
  footerSlot,
}: ChatEmptyStateProps) {
  const meta = CHANNEL_META[channel];
  const resolvedMode = resolveMode(mode, connected, channel, hasSearchQuery, compact, context);
  const threat = threatLevel(context);
  const heat = clampPercent(context?.haterHeat);

  const resolvedContent = useMemo(() => {
    const fallbackTitle = title ?? meta.defaultTitle;
    const fallbackSubtitle = subtitle ?? meta.defaultSubtitle;

    switch (resolvedMode) {
      case 'COLLAPSED':
        return {
          icon: '◢',
          title: title ?? `${meta.label} ready`,
          subtitle: subtitle ?? meta.idlePrompt,
          tone: 'compact',
        } as const;
      case 'DISCONNECTED':
        return {
          icon: '⟂',
          title: title ?? 'Chat transport is currently offline',
          subtitle:
            subtitle ??
            'The UI shell is still mounted, but live room traffic is not attached. Local composition can be preserved while transport reconnects.',
          tone: 'warning',
        } as const;
      case 'FILTERED':
        return {
          icon: '⌕',
          title: title ?? 'No transcript entries match the active filters',
          subtitle:
            subtitle ??
            'The current filter stack removed every visible message in this lane. Widen search or relax proof / lock gating to rehydrate the window.',
          tone: 'search',
        } as const;
      case 'DEAL_WAITING':
        return {
          icon: '⚖',
          title: title ?? 'Deal room has no visible negotiation traffic yet',
          subtitle:
            subtitle ??
            'No offers, counters, or recap hashes are visible in the current window. When the first negotiation thread opens, transcript-bearing events will anchor here.',
          tone: 'deal',
        } as const;
      case 'THREAT':
        return {
          icon: '⚠',
          title: title ?? 'The lane is quiet, but the run is not safe',
          subtitle:
            subtitle ??
            'Silence under pressure should feel ominous. The next intrusion, breach, or market shove is likely to arrive with weight.',
          tone: 'threat',
        } as const;
      case 'IDLE':
      default:
        return {
          icon: meta.emoji,
          title: fallbackTitle,
          subtitle: fallbackSubtitle,
          tone: 'idle',
        } as const;
    }
  }, [meta, resolvedMode, title, subtitle]);

  if (compact) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          minHeight: 60,
          padding: '10px 12px',
          borderRadius: 14,
          border: `1px solid ${meta.accentBorder}`,
          background: `linear-gradient(180deg, ${meta.accentSoft} 0%, rgba(12,12,30,0.92) 100%)`,
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              border: `1px solid ${meta.accentBorder}`,
              background: meta.accentSoft,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              flexShrink: 0,
            }}
          >
            {resolvedContent.icon}
          </div>

          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontFamily: T.mono,
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: '0.10em',
                textTransform: 'uppercase',
                color: meta.accent,
                marginBottom: 3,
              }}
            >
              {meta.label}
            </div>
            <div
              style={{
                fontFamily: T.display,
                fontSize: 11,
                lineHeight: 1.4,
                color: T.textSub,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '100%',
              }}
            >
              {resolvedContent.subtitle}
            </div>
          </div>
        </div>

        {onPrimaryAction ? (
          <button type="button" onClick={onPrimaryAction} style={actionStyle(false, meta.accent, true)}>
            {primaryLabel ?? 'Open'}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        alignItems: 'stretch',
        justifyContent: 'center',
        minHeight: transcriptView ? 300 : 240,
        padding: transcriptView ? '20px 16px' : '26px 16px',
        borderRadius: 16,
        border: `1px solid ${meta.accentBorder}`,
        background: `linear-gradient(180deg, rgba(12,12,30,0.96) 0%, rgba(3,3,8,0.96) 100%)`,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: '0 auto 0 0',
          width: 3,
          background: `linear-gradient(180deg, ${meta.accent} 0%, rgba(0,0,0,0) 100%)`,
        }}
      />

      <div
        style={{
          position: 'absolute',
          right: -40,
          top: -44,
          width: 140,
          height: 140,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${meta.accentSoft} 0%, rgba(0,0,0,0) 68%)`,
          pointerEvents: 'none',
        }}
      />

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div
          style={{
            width: transcriptView ? 52 : 46,
            height: transcriptView ? 52 : 46,
            borderRadius: 14,
            border: `1px solid ${meta.accentBorder}`,
            background: meta.accentSoft,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: transcriptView ? 24 : 21,
            flexShrink: 0,
            boxShadow: `0 10px 24px ${meta.accentSoft}`,
          }}
        >
          {resolvedContent.icon}
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
              marginBottom: 7,
            }}
          >
            <span
              style={{
                fontFamily: T.mono,
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: '0.10em',
                color: meta.accent,
                textTransform: 'uppercase',
              }}
            >
              {meta.label}
            </span>

            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                minHeight: 22,
                padding: '0 8px',
                borderRadius: 999,
                border: `1px solid ${connected ? 'rgba(34,221,136,0.24)' : 'rgba(255,77,77,0.24)'}`,
                background: connected ? 'rgba(34,221,136,0.08)' : 'rgba(255,77,77,0.08)',
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: connected ? T.green : T.red,
                  boxShadow: `0 0 10px ${connected ? T.green : T.red}88`,
                }}
              />
              <span
                style={{
                  fontFamily: T.mono,
                  fontSize: 8,
                  fontWeight: 800,
                  letterSpacing: '0.10em',
                  textTransform: 'uppercase',
                  color: connected ? T.green : T.red,
                }}
              >
                {connected ? 'Attached' : 'Offline'}
              </span>
            </span>

            {transcriptView ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  minHeight: 22,
                  padding: '0 8px',
                  borderRadius: 999,
                  border: `1px solid rgba(255,255,255,0.08)`,
                  background: 'rgba(255,255,255,0.03)',
                }}
              >
                <span style={{ fontSize: 10 }}>📜</span>
                <span
                  style={{
                    fontFamily: T.mono,
                    fontSize: 8,
                    fontWeight: 800,
                    letterSpacing: '0.10em',
                    textTransform: 'uppercase',
                    color: T.textSub,
                  }}
                >
                  Transcript View
                </span>
              </span>
            ) : null}
          </div>

          <div
            style={{
              fontFamily: T.display,
              fontSize: transcriptView ? 17 : 15,
              lineHeight: 1.25,
              fontWeight: 800,
              color: T.text,
              marginBottom: 8,
            }}
          >
            {resolvedContent.title}
          </div>

          <div
            style={{
              fontFamily: T.display,
              fontSize: 12,
              lineHeight: 1.65,
              color: T.textSub,
              maxWidth: 680,
            }}
          >
            {resolvedContent.subtitle}
          </div>
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
        <InfoChip label="Threat" value={threat.label} accent={threat.color} />

        {typeof heat === 'number' ? (
          <InfoChip label="Heat" value={`${heat}%`} accent={threat.color} />
        ) : null}

        {context?.pressureTier ? (
          <InfoChip label="Pressure" value={String(context.pressureTier)} accent={T.orange} />
        ) : null}

        {context?.tickTier ? (
          <InfoChip label="Tick" value={String(context.tickTier)} accent={T.indigo} />
        ) : null}

        <InfoChip
          label="Channel"
          value={channel === 'DEAL_ROOM' ? 'Proof-bearing' : channel === 'SYNDICATE' ? 'Private' : 'Public'}
          accent={meta.accent}
        />
      </div>

      <div
        style={{
          borderRadius: 12,
          border: `1px solid ${T.border}`,
          background: 'rgba(255,255,255,0.025)',
          padding: '12px 12px 10px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 8,
          }}
        >
          <div
            style={{
              fontFamily: T.mono,
              fontSize: 8,
              fontWeight: 800,
              letterSpacing: '0.10em',
              textTransform: 'uppercase',
              color: threat.color,
            }}
          >
            Lane posture
          </div>
          <div
            style={{
              fontFamily: T.mono,
              fontSize: 8,
              color: T.textMut,
            }}
          >
            {meta.idlePrompt}
          </div>
        </div>

        <div
          style={{
            width: '100%',
            height: 8,
            borderRadius: 999,
            background: 'rgba(255,255,255,0.05)',
            overflow: 'hidden',
            marginBottom: 10,
          }}
        >
          <div
            style={{
              width: `${Math.max(8, threat.meter)}%`,
              height: '100%',
              borderRadius: 999,
              background: `linear-gradient(90deg, ${threat.color} 0%, ${meta.accent} 100%)`,
              boxShadow: `0 0 16px ${threat.color}55`,
            }}
          />
        </div>

        <div
          style={{
            fontFamily: T.display,
            fontSize: 11,
            lineHeight: 1.6,
            color: T.textSub,
          }}
        >
          {helperText ?? meta.emptyTip}
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
        {(onPrimaryAction || primaryLabel) && (
          <button
            type="button"
            onClick={onPrimaryAction}
            disabled={!onPrimaryAction}
            style={actionStyle(!onPrimaryAction, meta.accent, true)}
          >
            {primaryLabel ?? (transcriptView ? 'Clear filters' : 'Open lane')}
          </button>
        )}

        {(onSecondaryAction || secondaryLabel) && (
          <button
            type="button"
            onClick={onSecondaryAction}
            disabled={!onSecondaryAction}
            style={actionStyle(!onSecondaryAction, meta.accent)}
          >
            {secondaryLabel ?? (transcriptView ? 'Jump latest' : 'Switch channel')}
          </button>
        )}

        {(onTertiaryAction || tertiaryLabel) && (
          <button
            type="button"
            onClick={onTertiaryAction}
            disabled={!onTertiaryAction}
            style={actionStyle(!onTertiaryAction, T.textSub)}
          >
            {tertiaryLabel}
          </button>
        )}
      </div>

      {footerSlot ? <div>{footerSlot}</div> : null}
    </div>
  );
});

export default ChatEmptyState;
