// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/components/chat/ChatChannelTabs.tsx

/**
 * ============================================================================
 * POINT ZERO ONE — UNIFIED CHAT CHANNEL TABS
 * FILE: pzo-web/src/components/chat/ChatChannelTabs.tsx
 * ============================================================================
 *
 * Render-only channel switcher for the unified chat shell.
 *
 * This component belongs in /pzo-web/src/components/chat, not the engine lane.
 * It accepts current chat state through props and renders a premium, tactical
 * channel-navigation surface without re-owning any logic that belongs to the
 * engine, backend authority, or socket transport layers.
 *
 * It does NOT:
 * - decide channel permissions,
 * - create unread counts,
 * - mutate helper timing,
 * - own presence state,
 * - own socket auth,
 * - rank messages,
 * - or become social-pressure authority.
 *
 * It DOES:
 * - render the three canonical channels distinctly,
 * - expose unread, heat, presence, and integrity cues,
 * - support compact and cinematic shells,
 * - keep keyboard hints visible,
 * - preserve deal-room seriousness,
 * - and make channel switching feel like part of the run’s emotional theater.
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ============================================================================
 */

import React, {
  memo,
  useMemo,
  useCallback,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from 'react';

import type { ChatChannel } from './chatTypes';

export type ChannelTabsDensity = 'compact' | 'comfortable' | 'cinematic';
export type ChannelTabsLayout = 'inline' | 'stacked';
export type ChannelTabsConnectionState = 'ONLINE' | 'CONNECTING' | 'DEGRADED' | 'OFFLINE';
export type ChannelTabsPermissionState = 'OPEN' | 'LIMITED' | 'LOCKED';
export type ChannelTabsHeatBand = 'QUIET' | 'LOW' | 'ELEVATED' | 'HIGH' | 'SEVERE';
export type ChannelTabsMetaTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

type CanonicalChannel = 'GLOBAL' | 'SYNDICATE' | 'DEAL_ROOM';

export interface ChatChannelPresenceSummary {
  online: number;
  typing?: number;
  watching?: number;
  helperVisible?: boolean;
  haterVisible?: boolean;
}

export interface ChatChannelHeatSummary {
  score01?: number;
  band?: ChannelTabsHeatBand;
  label?: string;
}

export interface ChatChannelPermissionSummary {
  state: ChannelTabsPermissionState;
  reason?: string;
}

export interface ChatChannelMetaLine {
  id: string;
  label: string;
  value: string;
  tone?: ChannelTabsMetaTone;
  visible?: boolean;
}

export interface ChatChannelTabRecord {
  id: CanonicalChannel;
  label: string;
  shortLabel: string;
  icon: string;
  description: string;
  unread: number;
  active?: boolean;
  disabled?: boolean;
  muted?: boolean;
  integrityLocked?: boolean;
  hotkey?: string;
  subBadge?: string;
  helperTag?: string;
  haterTag?: string;
  heat?: ChatChannelHeatSummary;
  presence?: ChatChannelPresenceSummary | null;
  permission?: ChatChannelPermissionSummary | null;
  metaLines?: ChatChannelMetaLine[];
}

export interface ChatChannelTabsProps {
  activeChannel: ChatChannel;
  onChange: (channel: ChatChannel) => void;
  density?: ChannelTabsDensity;
  layout?: ChannelTabsLayout;
  connectionState?: ChannelTabsConnectionState;
  totalUnread?: number;
  collapsed?: boolean;
  locked?: boolean;
  showConnectionPill?: boolean;
  showMetaRail?: boolean;
  showHeatMeters?: boolean;
  showPresence?: boolean;
  showHelperSignals?: boolean;
  showHotkeys?: boolean;
  showCounts?: boolean;
  showDescriptions?: boolean;
  showExpandedOverview?: boolean;
  showUnreadTotalSeal?: boolean;
  className?: string;
  style?: CSSProperties;
  channels?: Partial<Record<CanonicalChannel, Partial<ChatChannelTabRecord>>>;
  onOpenHelperPanel?: (channel: ChatChannel) => void;
  onOpenPresencePanel?: (channel: ChatChannel) => void;
  onOpenIntegrityPanel?: (channel: ChatChannel) => void;
}

const TOKENS = Object.freeze({
  void: '#05060B',
  panel: '#0A1020',
  panelRaised: '#10172C',
  panelGlass: 'rgba(12, 18, 36, 0.86)',
  surfaceAlt: '#141B34',
  surfaceSubtle: '#0D1427',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.16)',
  borderHot: 'rgba(129,140,248,0.36)',
  text: '#F5F7FF',
  textSub: '#A9B0D0',
  textMuted: '#70789C',
  textFaint: '#535A77',
  green: '#22DD88',
  red: '#FF4D4D',
  orange: '#FF9E44',
  yellow: '#FFD84D',
  indigo: '#818CF8',
  teal: '#2DD4BF',
  cyan: '#22D3EE',
  purple: '#A855F7',
  shadow: '0 18px 60px rgba(0,0,0,0.35)',
  shadowHot: '0 14px 44px rgba(99,102,241,0.24)',
  mono: "'IBM Plex Mono', 'JetBrains Mono', monospace",
  display: "'Syne', 'Outfit', system-ui, sans-serif",
  radius: 16,
});

interface ChannelTheme {
  bg: string;
  bgActive: string;
  border: string;
  text: string;
  chipBg: string;
  chipText: string;
  glow: string;
  helper: string;
  hater: string;
}

const CHANNEL_THEMES: Record<CanonicalChannel, ChannelTheme> = {
  GLOBAL: {
    bg: 'rgba(129,140,248,0.08)',
    bgActive: 'linear-gradient(180deg, rgba(129,140,248,0.18), rgba(129,140,248,0.08))',
    border: 'rgba(129,140,248,0.24)',
    text: TOKENS.indigo,
    chipBg: 'rgba(129,140,248,0.16)',
    chipText: TOKENS.indigo,
    glow: 'rgba(129,140,248,0.24)',
    helper: TOKENS.cyan,
    hater: TOKENS.red,
  },
  SYNDICATE: {
    bg: 'rgba(45,212,191,0.08)',
    bgActive: 'linear-gradient(180deg, rgba(45,212,191,0.18), rgba(45,212,191,0.08))',
    border: 'rgba(45,212,191,0.24)',
    text: TOKENS.teal,
    chipBg: 'rgba(45,212,191,0.16)',
    chipText: TOKENS.teal,
    glow: 'rgba(45,212,191,0.22)',
    helper: TOKENS.green,
    hater: TOKENS.orange,
  },
  DEAL_ROOM: {
    bg: 'rgba(255,216,77,0.08)',
    bgActive: 'linear-gradient(180deg, rgba(255,216,77,0.18), rgba(255,216,77,0.08))',
    border: 'rgba(255,216,77,0.24)',
    text: TOKENS.yellow,
    chipBg: 'rgba(255,216,77,0.16)',
    chipText: TOKENS.yellow,
    glow: 'rgba(255,216,77,0.22)',
    helper: TOKENS.teal,
    hater: TOKENS.red,
  },
};

const CONNECTION_TONES: Record<ChannelTabsConnectionState, { label: string; color: string; bg: string; border: string }> = {
  ONLINE: {
    label: 'ONLINE',
    color: TOKENS.green,
    bg: 'rgba(34,221,136,0.10)',
    border: 'rgba(34,221,136,0.24)',
  },
  CONNECTING: {
    label: 'CONNECTING',
    color: TOKENS.cyan,
    bg: 'rgba(34,211,238,0.10)',
    border: 'rgba(34,211,238,0.24)',
  },
  DEGRADED: {
    label: 'DEGRADED',
    color: TOKENS.orange,
    bg: 'rgba(255,158,68,0.10)',
    border: 'rgba(255,158,68,0.24)',
  },
  OFFLINE: {
    label: 'OFFLINE',
    color: TOKENS.red,
    bg: 'rgba(255,77,77,0.10)',
    border: 'rgba(255,77,77,0.24)',
  },
};

function normalizeChannel(channel: ChatChannel): CanonicalChannel {
  return channel === 'SYNDICATE' || channel === 'DEAL_ROOM' ? channel : 'GLOBAL';
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function safeUnread(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.max(0, Math.floor(n));
}

function formatUnread(value: number): string {
  if (value <= 0) return '0';
  if (value > 99) return '99+';
  return String(value);
}

function densityPadding(density: ChannelTabsDensity): string {
  switch (density) {
    case 'compact':
      return '10px 12px';
    case 'cinematic':
      return '16px 16px';
    default:
      return '13px 14px';
  }
}

function tabGap(density: ChannelTabsDensity): number {
  switch (density) {
    case 'compact':
      return 8;
    case 'cinematic':
      return 12;
    default:
      return 10;
  }
}

function labelSize(density: ChannelTabsDensity): number {
  switch (density) {
    case 'compact':
      return 12;
    case 'cinematic':
      return 13;
    default:
      return 12.5;
  }
}

function metaSize(density: ChannelTabsDensity): number {
  switch (density) {
    case 'compact':
      return 10;
    case 'cinematic':
      return 11;
    default:
      return 10.5;
  }
}

function permissionTone(permission: ChatChannelPermissionSummary | null | undefined): ChannelTabsMetaTone {
  if (!permission) return 'neutral';
  switch (permission.state) {
    case 'OPEN':
      return 'success';
    case 'LIMITED':
      return 'warning';
    case 'LOCKED':
      return 'danger';
    default:
      return 'neutral';
  }
}

function heatBandColor(band: ChannelTabsHeatBand | undefined): string {
  switch (band) {
    case 'SEVERE':
      return '#FF2F5B';
    case 'HIGH':
      return TOKENS.red;
    case 'ELEVATED':
      return TOKENS.orange;
    case 'LOW':
      return TOKENS.indigo;
    default:
      return TOKENS.textFaint;
  }
}

function toneColor(tone: ChannelTabsMetaTone): string {
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

function defaultChannelRecord(id: CanonicalChannel): ChatChannelTabRecord {
  switch (id) {
    case 'GLOBAL':
      return {
        id,
        label: 'Global',
        shortLabel: 'Global',
        icon: '◎',
        description: 'Stage-wide chatter, heat, swarm reactions, and market theater.',
        unread: 0,
        hotkey: '1',
        helperTag: 'crowd',
        haterTag: 'swarm',
        heat: { score01: 0.18, band: 'LOW', label: 'Stage heat' },
        presence: { online: 12400, typing: 14, watching: 210 },
        permission: { state: 'OPEN' },
      };
    case 'SYNDICATE':
      return {
        id,
        label: 'Syndicate',
        shortLabel: 'Synd',
        icon: '◬',
        description: 'Tactical chatter, alliance reads, helper pressure, and trusted signals.',
        unread: 0,
        hotkey: '2',
        helperTag: 'ally',
        haterTag: 'mole',
        heat: { score01: 0.24, band: 'LOW', label: 'Alliance heat' },
        presence: { online: 76, typing: 3, watching: 22, helperVisible: true },
        permission: { state: 'OPEN' },
      };
    case 'DEAL_ROOM':
      return {
        id,
        label: 'Deal Room',
        shortLabel: 'Deal',
        icon: '▣',
        description: 'Recorded negotiations, transcript integrity, and predatory quiet.',
        unread: 0,
        hotkey: '3',
        helperTag: 'counsel',
        haterTag: 'predator',
        heat: { score01: 0.32, band: 'ELEVATED', label: 'Negotiation heat' },
        presence: { online: 19, typing: 1, watching: 7 },
        permission: { state: 'LIMITED', reason: 'records enforced' },
        integrityLocked: true,
      };
    default:
      return {
        id: 'GLOBAL',
        label: 'Global',
        shortLabel: 'Global',
        icon: '◎',
        description: '',
        unread: 0,
      };
  }
}

function mergeChannelRecord(
  base: ChatChannelTabRecord,
  patch?: Partial<ChatChannelTabRecord>,
  active?: boolean,
): ChatChannelTabRecord {
  const mergedPresence = patch?.presence === undefined
    ? base.presence
    : patch.presence === null
      ? null
      : { ...(base.presence ?? { online: 0 }), ...patch.presence };

  const mergedHeat = patch?.heat === undefined
    ? base.heat
    : { ...(base.heat ?? {}), ...patch.heat };

  const mergedPermission = patch?.permission === undefined
    ? base.permission
    : patch.permission === null
      ? null
      : { ...(base.permission ?? { state: 'OPEN' as const }), ...patch.permission };

  return {
    ...base,
    ...patch,
    presence: mergedPresence,
    heat: mergedHeat,
    permission: mergedPermission,
    unread: safeUnread(patch?.unread ?? base.unread),
    active,
  };
}

const TinyMetaPill = memo(function TinyMetaPill({
  label,
  value,
  tone = 'neutral',
  density = 'comfortable',
}: {
  label?: string;
  value: string;
  tone?: ChannelTabsMetaTone;
  density?: ChannelTabsDensity;
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
        background: 'rgba(255,255,255,0.04)',
        color: toneColor(tone),
        fontSize: metaSize(density),
        fontFamily: TOKENS.mono,
        lineHeight: 1,
        whiteSpace: 'nowrap',
        letterSpacing: '0.04em',
      }}
    >
      {label && <span style={{ color: TOKENS.textFaint }}>{label}</span>}
      <span>{value}</span>
    </span>
  );
});

const OverviewRow = memo(function OverviewRow({
  line,
  density,
}: {
  line: ChatChannelMetaLine;
  density: ChannelTabsDensity;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gap: 5,
        padding: density === 'compact' ? '8px 9px' : '9px 10px',
        borderRadius: 11,
        border: `1px solid ${TOKENS.border}`,
        background: 'rgba(255,255,255,0.03)',
      }}
    >
      <div
        style={{
          color: TOKENS.textFaint,
          fontSize: 10,
          fontFamily: TOKENS.mono,
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
        }}
      >
        {line.label}
      </div>
      <div
        style={{
          color: toneColor(line.tone ?? 'neutral'),
          fontSize: 12,
          fontFamily: TOKENS.display,
          wordBreak: 'break-word',
        }}
      >
        {line.value}
      </div>
    </div>
  );
});

const ConnectionPill = memo(function ConnectionPill({
  state,
}: {
  state: ChannelTabsConnectionState;
}) {
  const tone = CONNECTION_TONES[state];
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        padding: '6px 9px',
        borderRadius: 999,
        border: `1px solid ${tone.border}`,
        background: tone.bg,
        color: tone.color,
        fontFamily: TOKENS.mono,
        fontSize: 10.5,
        letterSpacing: '0.06em',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: tone.color,
          boxShadow: `0 0 16px ${tone.color}`,
        }}
      />
      <span>{tone.label}</span>
    </div>
  );
});

const HeatMeter = memo(function HeatMeter({
  heat,
}: {
  heat: ChatChannelHeatSummary | undefined;
}) {
  const ratio = clamp01(heat?.score01 ?? 0);
  const band = heat?.band;
  const color = heatBandColor(band);
  return (
    <div
      style={{
        display: 'grid',
        gap: 6,
      }}
    >
      <div
        style={{
          height: 6,
          borderRadius: 999,
          overflow: 'hidden',
          background: 'rgba(255,255,255,0.05)',
          border: `1px solid ${TOKENS.border}`,
        }}
      >
        <div
          style={{
            width: `${Math.round(ratio * 100)}%`,
            height: '100%',
            borderRadius: 999,
            background: `linear-gradient(90deg, ${color}, ${color}CC)`,
          }}
        />
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          color: TOKENS.textMuted,
          fontSize: 10,
          fontFamily: TOKENS.mono,
        }}
      >
        <span>{heat?.label ?? 'heat'}</span>
        <span style={{ color }}>{band ?? 'QUIET'}</span>
      </div>
    </div>
  );
});

const PresenceStrip = memo(function PresenceStrip({
  presence,
  density,
}: {
  presence: ChatChannelPresenceSummary | null | undefined;
  density: ChannelTabsDensity;
}) {
  if (!presence) return null;

  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap',
        alignItems: 'center',
      }}
    >
      <TinyMetaPill label="online" value={String(presence.online)} density={density} />
      {typeof presence.typing === 'number' && <TinyMetaPill label="typing" value={String(presence.typing)} tone="info" density={density} />}
      {typeof presence.watching === 'number' && <TinyMetaPill label="watching" value={String(presence.watching)} tone="warning" density={density} />}
      {presence.helperVisible && <TinyMetaPill value="helper visible" tone="success" density={density} />}
      {presence.haterVisible && <TinyMetaPill value="hater present" tone="danger" density={density} />}
    </div>
  );
});

const PermissionSeal = memo(function PermissionSeal({
  permission,
  density,
  onOpen,
}: {
  permission: ChatChannelPermissionSummary | null | undefined;
  density: ChannelTabsDensity;
  onOpen?: () => void;
}) {
  if (!permission) return null;
  const tone = permissionTone(permission);
  return (
    <button
      type="button"
      onClick={onOpen}
      title={permission.reason}
      style={{
        appearance: 'none',
        border: `1px solid ${TOKENS.border}`,
        background: 'rgba(255,255,255,0.04)',
        color: toneColor(tone),
        borderRadius: 999,
        padding: density === 'compact' ? '4px 7px' : '5px 8px',
        fontSize: metaSize(density),
        fontFamily: TOKENS.mono,
        cursor: onOpen ? 'pointer' : 'default',
        whiteSpace: 'nowrap',
      }}
    >
      {permission.state}
    </button>
  );
});

const ChannelButton = memo(function ChannelButton({
  channel,
  density,
  layout,
  locked,
  showHeatMeters,
  showPresence,
  showHelperSignals,
  showHotkeys,
  showCounts,
  showDescriptions,
  onChange,
  onOpenHelperPanel,
  onOpenPresencePanel,
  onOpenIntegrityPanel,
}: {
  channel: ChatChannelTabRecord;
  density: ChannelTabsDensity;
  layout: ChannelTabsLayout;
  locked: boolean;
  showHeatMeters: boolean;
  showPresence: boolean;
  showHelperSignals: boolean;
  showHotkeys: boolean;
  showCounts: boolean;
  showDescriptions: boolean;
  onChange: (channel: ChatChannel) => void;
  onOpenHelperPanel?: (channel: ChatChannel) => void;
  onOpenPresencePanel?: (channel: ChatChannel) => void;
  onOpenIntegrityPanel?: (channel: ChatChannel) => void;
}) {
  const theme = CHANNEL_THEMES[channel.id];
  const active = Boolean(channel.active);
  const disabled = locked || Boolean(channel.disabled) || channel.permission?.state === 'LOCKED';
  const unread = safeUnread(channel.unread);
  const activeShadow = active ? `0 0 0 1px ${theme.border}, 0 14px 34px ${theme.glow}` : 'none';
  const mutedOpacity = channel.muted ? 0.72 : 1;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(channel.id)}
      style={{
        appearance: 'none',
        width: '100%',
        border: `1px solid ${active ? theme.border : TOKENS.border}`,
        background: active ? theme.bgActive : TOKENS.panelRaised,
        color: TOKENS.text,
        borderRadius: 15,
        padding: densityPadding(density),
        display: 'grid',
        gap: density === 'compact' ? 8 : 10,
        textAlign: 'left',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : mutedOpacity,
        boxShadow: active ? activeShadow : 'none',
        transition: 'transform 120ms ease, border-color 120ms ease, box-shadow 120ms ease',
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
        <div
          style={{
            display: 'flex',
            alignItems: layout === 'stacked' ? 'flex-start' : 'center',
            gap: density === 'compact' ? 8 : 10,
            minWidth: 0,
            flex: 1,
          }}
        >
          <div
            style={{
              width: density === 'compact' ? 32 : density === 'cinematic' ? 40 : 36,
              height: density === 'compact' ? 32 : density === 'cinematic' ? 40 : 36,
              borderRadius: 12,
              display: 'grid',
              placeItems: 'center',
              background: theme.bg,
              color: theme.text,
              border: `1px solid ${theme.border}`,
              boxShadow: active ? `0 0 22px ${theme.glow}` : 'none',
              fontSize: density === 'compact' ? 13 : 15,
              flexShrink: 0,
            }}
          >
            {channel.icon}
          </div>

          <div
            style={{
              display: 'grid',
              gap: showDescriptions ? 5 : 3,
              minWidth: 0,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
                minWidth: 0,
              }}
            >
              <span
                style={{
                  color: active ? theme.text : TOKENS.text,
                  fontFamily: TOKENS.display,
                  fontWeight: 800,
                  fontSize: labelSize(density),
                  letterSpacing: '0.01em',
                  textTransform: 'uppercase',
                }}
              >
                {layout === 'stacked' ? channel.label : channel.shortLabel}
              </span>

              {showHotkeys && channel.hotkey && (
                <TinyMetaPill value={channel.hotkey} tone="neutral" density={density} />
              )}
              {channel.subBadge && <TinyMetaPill value={channel.subBadge} tone="info" density={density} />}
              {channel.integrityLocked && <TinyMetaPill value="recorded" tone="warning" density={density} />}
            </div>

            {showDescriptions && (
              <div
                style={{
                  color: TOKENS.textSub,
                  fontSize: density === 'compact' ? 11 : 12,
                  lineHeight: 1.45,
                }}
              >
                {channel.description}
              </div>
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
          {showCounts && unread > 0 && (
            <span
              style={{
                display: 'inline-flex',
                minWidth: density === 'compact' ? 24 : 26,
                height: density === 'compact' ? 24 : 26,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 999,
                padding: '0 8px',
                border: `1px solid ${theme.border}`,
                background: theme.chipBg,
                color: theme.chipText,
                fontSize: metaSize(density),
                fontFamily: TOKENS.mono,
                boxShadow: `0 0 18px ${theme.glow}`,
              }}
            >
              {formatUnread(unread)}
            </span>
          )}

          <PermissionSeal
            permission={channel.permission}
            density={density}
            onOpen={channel.integrityLocked ? () => onOpenIntegrityPanel?.(channel.id) : undefined}
          />
        </div>
      </div>

      {(showPresence || showHelperSignals) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          {showPresence && <PresenceStrip presence={channel.presence} density={density} />}

          {showHelperSignals && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {channel.helperTag && (
                <button
                  type="button"
                  onClick={(event: ReactMouseEvent) => {
                    event.stopPropagation();
                    onOpenHelperPanel?.(channel.id);
                  }}
                  style={{
                    appearance: 'none',
                    border: `1px solid ${TOKENS.border}`,
                    background: 'rgba(255,255,255,0.03)',
                    color: theme.helper,
                    borderRadius: 999,
                    padding: density === 'compact' ? '4px 7px' : '5px 8px',
                    fontSize: metaSize(density),
                    fontFamily: TOKENS.mono,
                    cursor: onOpenHelperPanel ? 'pointer' : 'default',
                  }}
                >
                  helper · {channel.helperTag}
                </button>
              )}
              {channel.haterTag && (
                <button
                  type="button"
                  onClick={(event: ReactMouseEvent) => {
                    event.stopPropagation();
                    onOpenPresencePanel?.(channel.id);
                  }}
                  style={{
                    appearance: 'none',
                    border: `1px solid ${TOKENS.border}`,
                    background: 'rgba(255,255,255,0.03)',
                    color: theme.hater,
                    borderRadius: 999,
                    padding: density === 'compact' ? '4px 7px' : '5px 8px',
                    fontSize: metaSize(density),
                    fontFamily: TOKENS.mono,
                    cursor: onOpenPresencePanel ? 'pointer' : 'default',
                  }}
                >
                  threat · {channel.haterTag}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {showHeatMeters && <HeatMeter heat={channel.heat} />}
    </button>
  );
});

function buildChannels(
  activeChannel: ChatChannel,
  channels?: Partial<Record<CanonicalChannel, Partial<ChatChannelTabRecord>>>,
): ChatChannelTabRecord[] {
  const active = normalizeChannel(activeChannel);
  return (['GLOBAL', 'SYNDICATE', 'DEAL_ROOM'] as const).map(id =>
    mergeChannelRecord(defaultChannelRecord(id), channels?.[id], id === active),
  );
}

function aggregateUnread(records: ChatChannelTabRecord[], explicitTotal?: number): number {
  const computed = records.reduce((sum, record) => sum + safeUnread(record.unread), 0);
  const explicit = safeUnread(explicitTotal);
  return explicit > 0 ? explicit : computed;
}

function buildOverviewLines(record: ChatChannelTabRecord): ChatChannelMetaLine[] {
  const base: ChatChannelMetaLine[] = [
    {
      id: `${record.id}-desc`,
      label: 'channel',
      value: record.description,
      tone: 'neutral',
      visible: Boolean(record.description),
    },
    {
      id: `${record.id}-permission`,
      label: 'permission',
      value: record.permission?.state ?? 'OPEN',
      tone: permissionTone(record.permission),
      visible: true,
    },
    {
      id: `${record.id}-unread`,
      label: 'unread',
      value: String(safeUnread(record.unread)),
      tone: safeUnread(record.unread) > 0 ? 'info' : 'neutral',
      visible: true,
    },
    {
      id: `${record.id}-heat`,
      label: 'heat',
      value: record.heat?.band ?? 'QUIET',
      tone: record.heat?.band === 'SEVERE'
        ? 'danger'
        : record.heat?.band === 'HIGH'
          ? 'danger'
          : record.heat?.band === 'ELEVATED'
            ? 'warning'
            : record.heat?.band === 'LOW'
              ? 'info'
              : 'neutral',
      visible: true,
    },
  ];

  if (record.presence) {
    base.push(
      {
        id: `${record.id}-online`,
        label: 'online',
        value: String(record.presence.online),
        tone: 'success',
        visible: true,
      },
      {
        id: `${record.id}-typing`,
        label: 'typing',
        value: String(record.presence.typing ?? 0),
        tone: 'info',
        visible: typeof record.presence.typing === 'number',
      },
      {
        id: `${record.id}-watching`,
        label: 'watching',
        value: String(record.presence.watching ?? 0),
        tone: 'warning',
        visible: typeof record.presence.watching === 'number',
      },
    );
  }

  if (record.helperTag) {
    base.push({
      id: `${record.id}-helper`,
      label: 'helper lens',
      value: record.helperTag,
      tone: 'success',
      visible: true,
    });
  }

  if (record.haterTag) {
    base.push({
      id: `${record.id}-threat`,
      label: 'threat lens',
      value: record.haterTag,
      tone: 'danger',
      visible: true,
    });
  }

  return [...base, ...(record.metaLines ?? [])].filter(line => line.visible !== false);
}

export const ChatChannelTabs = memo(function ChatChannelTabs({
  activeChannel,
  onChange,
  density = 'comfortable',
  layout = 'inline',
  connectionState = 'ONLINE',
  totalUnread,
  collapsed = false,
  locked = false,
  showConnectionPill = true,
  showMetaRail = true,
  showHeatMeters = true,
  showPresence = true,
  showHelperSignals = true,
  showHotkeys = true,
  showCounts = true,
  showDescriptions = true,
  showExpandedOverview = true,
  showUnreadTotalSeal = true,
  className,
  style,
  channels,
  onOpenHelperPanel,
  onOpenPresencePanel,
  onOpenIntegrityPanel,
}: ChatChannelTabsProps) {
  const records = useMemo(() => buildChannels(activeChannel, channels), [activeChannel, channels]);
  const activeRecord = useMemo(
    () => records.find(record => record.active) ?? records[0],
    [records],
  );
  const unreadTotal = useMemo(() => aggregateUnread(records, totalUnread), [records, totalUnread]);
  const [showOverview, setShowOverview] = useState(false);

  const rootStyle: CSSProperties = {
    display: 'grid',
    gap: density === 'compact' ? 10 : 12,
    padding: densityPadding(density),
    borderRadius: TOKENS.radius,
    background: TOKENS.panelGlass,
    border: `1px solid ${TOKENS.border}`,
    boxShadow: TOKENS.shadow,
  };

  const handleChange = useCallback(
    (channel: ChatChannel) => {
      if (locked) return;
      onChange(channel);
    },
    [locked, onChange],
  );

  const overviewLines = useMemo(() => buildOverviewLines(activeRecord), [activeRecord]);

  return (
    <section className={className} style={{ ...rootStyle, ...style }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'grid', gap: 6 }}>
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
                color: TOKENS.text,
                fontFamily: TOKENS.display,
                fontSize: density === 'compact' ? 14 : 15,
                fontWeight: 800,
                letterSpacing: '0.02em',
                textTransform: 'uppercase',
              }}
            >
              Channel routing
            </div>
            {locked && <TinyMetaPill value="locked" tone="warning" density={density} />}
            {showUnreadTotalSeal && unreadTotal > 0 && (
              <TinyMetaPill label="unread" value={formatUnread(unreadTotal)} tone="info" density={density} />
            )}
          </div>
          <div
            style={{
              color: TOKENS.textSub,
              fontSize: density === 'compact' ? 11 : 12,
              lineHeight: 1.45,
            }}
          >
            One dock. Three channels. Distinct social atmospheres without per-screen chat brains.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          {showConnectionPill && <ConnectionPill state={connectionState} />}
          {showExpandedOverview && (
            <button
              type="button"
              onClick={() => setShowOverview(prev => !prev)}
              style={{
                appearance: 'none',
                border: `1px solid ${TOKENS.border}`,
                background: 'rgba(255,255,255,0.04)',
                color: TOKENS.textSub,
                borderRadius: 999,
                padding: density === 'compact' ? '6px 8px' : '7px 9px',
                fontFamily: TOKENS.mono,
                fontSize: 10.5,
                letterSpacing: '0.06em',
                cursor: 'pointer',
              }}
            >
              {showOverview ? 'HIDE OVERVIEW' : 'SHOW OVERVIEW'}
            </button>
          )}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gap: tabGap(density),
          gridTemplateColumns: collapsed ? '1fr' : layout === 'stacked' ? '1fr' : 'repeat(3, minmax(0, 1fr))',
        }}
      >
        {records.map(record => (
          <ChannelButton
            key={record.id}
            channel={record}
            density={density}
            layout={layout}
            locked={locked}
            showHeatMeters={showHeatMeters}
            showPresence={showPresence}
            showHelperSignals={showHelperSignals}
            showHotkeys={showHotkeys}
            showCounts={showCounts}
            showDescriptions={showDescriptions && !collapsed}
            onChange={handleChange}
            onOpenHelperPanel={onOpenHelperPanel}
            onOpenPresencePanel={onOpenPresencePanel}
            onOpenIntegrityPanel={onOpenIntegrityPanel}
          />
        ))}
      </div>

      {showMetaRail && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <TinyMetaPill value={`active · ${activeRecord.label.toUpperCase()}`} tone="info" density={density} />
          {activeRecord.permission && (
            <TinyMetaPill
              value={`permission · ${activeRecord.permission.state}`}
              tone={permissionTone(activeRecord.permission)}
              density={density}
            />
          )}
          {activeRecord.heat?.band && (
            <TinyMetaPill value={`heat · ${activeRecord.heat.band}`} tone="warning" density={density} />
          )}
          {showHotkeys && <TinyMetaPill value="hotkeys · 1 / 2 / 3" tone="neutral" density={density} />}
          {activeRecord.integrityLocked && <TinyMetaPill value="deal transcript enforced" tone="warning" density={density} />}
        </div>
      )}

      {showExpandedOverview && showOverview && (
        <div
          style={{
            display: 'grid',
            gap: 10,
            paddingTop: 2,
          }}
        >
          <div
            style={{
              color: TOKENS.text,
              fontFamily: TOKENS.display,
              fontSize: density === 'compact' ? 13 : 14,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.02em',
            }}
          >
            {activeRecord.label} overview
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: 8,
            }}
          >
            {overviewLines.map(line => (
              <OverviewRow key={line.id} line={line} density={density} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
});

export default ChatChannelTabs;
