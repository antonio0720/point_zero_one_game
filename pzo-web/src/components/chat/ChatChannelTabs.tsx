import React, { memo, useMemo, type CSSProperties } from 'react';
import type { ChannelTabsViewModel, ChannelTabViewModel } from './uiTypes';

export interface ChatChannelTabsProps extends ChannelTabsViewModel {
  className?: string;
  style?: CSSProperties;
}

const TOKENS = Object.freeze({
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.18)',
  bg: 'rgba(255,255,255,0.03)',
  bgActive: 'rgba(129,140,248,0.14)',
  text: '#F5F7FF',
  textSubtle: '#A7B2D4',
  textMute: '#7180A8',
  indigo: '#8B93FF',
  teal: '#3EE6CC',
  amber: '#FFD75E',
  red: '#FF5353',
  slate: '#94A3B8',
  mono: "'IBM Plex Mono', 'JetBrains Mono', monospace",
  display: "'Syne', 'Outfit', system-ui, sans-serif",
});

function channelAccent(tab: ChannelTabViewModel) {
  if (tab.channelId === 'GLOBAL') return TOKENS.indigo;
  if (tab.channelId === 'SYNDICATE') return TOKENS.teal;
  if (tab.channelId === 'DEAL_ROOM') return TOKENS.amber;
  return TOKENS.slate;
}

function heatColor(tab: ChannelTabViewModel) {
  switch (tab.heat?.band) {
    case 'SEVERE':
      return TOKENS.red;
    case 'HIGH':
      return TOKENS.amber;
    case 'ELEVATED':
      return TOKENS.amber;
    case 'LOW':
      return TOKENS.teal;
    default:
      return TOKENS.slate;
  }
}

const ChannelTabButton = memo(function ChannelTabButton({
  tab,
  collapsed,
  showDescriptions,
  showMetaRail,
  showHeatMeters,
  showPresence,
  showHotkeys,
  onSelectChannel,
  onOpenPresencePanel,
  onOpenIntegrityPanel,
}: {
  tab: ChannelTabViewModel;
  collapsed?: boolean;
  showDescriptions?: boolean;
  showMetaRail?: boolean;
  showHeatMeters?: boolean;
  showPresence?: boolean;
  showHotkeys?: boolean;
  onSelectChannel: (channel: string) => void;
  onOpenPresencePanel?: (channel: string) => void;
  onOpenIntegrityPanel?: (channel: string) => void;
}) {
  const accent = channelAccent(tab);
  const heat = heatColor(tab);
  const unread = tab.unread ?? 0;
  return (
    <button
      type="button"
      disabled={tab.disabled}
      onClick={() => onSelectChannel(tab.channelId)}
      style={{
        appearance: 'none',
        minWidth: collapsed ? 110 : 160,
        borderRadius: 14,
        border: `1px solid ${tab.active ? accent : TOKENS.border}`,
        background: tab.active ? TOKENS.bgActive : TOKENS.bg,
        color: TOKENS.text,
        padding: collapsed ? '10px 10px' : '12px 12px',
        display: 'grid',
        gap: 8,
        textAlign: 'left',
        cursor: tab.disabled ? 'not-allowed' : 'pointer',
        opacity: tab.disabled ? 0.5 : 1,
      }}
      aria-pressed={tab.active}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: accent, fontSize: 16 }}>{tab.icon}</span>
        <span style={{ fontFamily: TOKENS.display, fontWeight: 700 }}>{collapsed ? (tab.shortLabel ?? tab.label) : tab.label}</span>
        {unread > 0 ? (
          <span style={{ marginLeft: 'auto', minWidth: 20, height: 20, borderRadius: 999, background: accent, color: '#090B12', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: TOKENS.mono, fontSize: 10, fontWeight: 700, padding: '0 6px' }}>
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </div>

      {!collapsed && showDescriptions && tab.description ? (
        <div style={{ color: TOKENS.textSubtle, fontSize: 12, lineHeight: 1.5 }}>{tab.description}</div>
      ) : null}

      {showHeatMeters ? (
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', border: `1px solid ${TOKENS.border}` }}>
            <div style={{ width: `${Math.max(4, Math.round((tab.heat?.score01 ?? 0) * 100))}%`, height: '100%', background: heat, borderRadius: 999 }} />
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ color: heat, fontFamily: TOKENS.mono, fontSize: 10, textTransform: 'uppercase' }}>{tab.heat?.label ?? tab.heat?.band ?? 'quiet'}</span>
            {tab.recommended ? <span style={{ color: TOKENS.teal, fontFamily: TOKENS.mono, fontSize: 10, textTransform: 'uppercase' }}>{tab.recommendationLabel ?? 'recommended'}</span> : null}
          </div>
        </div>
      ) : null}

      {showPresence && tab.presence ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {typeof tab.presence.online === 'number' ? <span style={{ color: TOKENS.textMute, fontFamily: TOKENS.mono, fontSize: 10, textTransform: 'uppercase' }}>online {tab.presence.online}</span> : null}
          {typeof tab.presence.typing === 'number' ? <span style={{ color: TOKENS.textMute, fontFamily: TOKENS.mono, fontSize: 10, textTransform: 'uppercase' }}>typing {tab.presence.typing}</span> : null}
          {tab.presence.helperVisible ? <span style={{ color: TOKENS.teal, fontFamily: TOKENS.mono, fontSize: 10, textTransform: 'uppercase' }}>helper</span> : null}
          {tab.presence.haterVisible ? <span style={{ color: TOKENS.red, fontFamily: TOKENS.mono, fontSize: 10, textTransform: 'uppercase' }}>hater</span> : null}
        </div>
      ) : null}

      {!collapsed && showMetaRail && tab.metaLines?.length ? (
        <div style={{ display: 'grid', gap: 4 }}>
          {tab.metaLines.filter((line) => line.visible !== false).map((line) => (
            <div key={line.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, color: TOKENS.textMute, fontFamily: TOKENS.mono, fontSize: 10, textTransform: 'uppercase' }}>
              <span>{line.label}</span>
              <span>{line.value}</span>
            </div>
          ))}
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
        {showHotkeys && tab.hotkeyHint ? <span style={{ color: TOKENS.textMute, fontFamily: TOKENS.mono, fontSize: 10, textTransform: 'uppercase' }}>{tab.hotkeyHint}</span> : <span />}
        <div style={{ display: 'flex', gap: 6 }}>
          {tab.presence ? <button type="button" onClick={(event) => { event.stopPropagation(); onOpenPresencePanel?.(tab.channelId); }} style={{ appearance: 'none', border: `1px solid ${TOKENS.border}`, background: 'transparent', color: TOKENS.textSubtle, borderRadius: 999, padding: '5px 8px', cursor: 'pointer', fontFamily: TOKENS.mono, fontSize: 10, textTransform: 'uppercase' }}>Presence</button> : null}
          {tab.integrity ? <button type="button" onClick={(event) => { event.stopPropagation(); onOpenIntegrityPanel?.(tab.channelId); }} style={{ appearance: 'none', border: `1px solid ${TOKENS.border}`, background: 'transparent', color: TOKENS.textSubtle, borderRadius: 999, padding: '5px 8px', cursor: 'pointer', fontFamily: TOKENS.mono, fontSize: 10, textTransform: 'uppercase' }}>{tab.integrity.label ?? 'Integrity'}</button> : null}
        </div>
      </div>
    </button>
  );
});

export const ChatChannelTabs = memo(function ChatChannelTabs(props: ChatChannelTabsProps) {
  const {
    className,
    style,
    tabs,
    activeChannel,
    onSelectChannel,
    collapsed,
    showDescriptions,
    showMetaRail,
    showHeatMeters,
    showPresence,
    showHotkeys,
    showUnreadTotalSeal,
    showConnectionPill,
    connectionState,
    totalUnread,
    keyboardLegendLabel,
    onOpenPresencePanel,
    onOpenIntegrityPanel,
  } = props;

  const orderedTabs = useMemo(
    () => [...tabs].sort((a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999)),
    [tabs],
  );

  return (
    <div className={className} style={{ display: 'grid', gap: 10, ...style }}>
      {(showConnectionPill || showUnreadTotalSeal) ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {showConnectionPill ? <span style={{ borderRadius: 999, padding: '6px 10px', border: `1px solid ${TOKENS.border}`, background: TOKENS.bg, color: TOKENS.textSubtle, fontFamily: TOKENS.mono, fontSize: 10, textTransform: 'uppercase' }}>{connectionState ?? 'ONLINE'}</span> : null}
          {showUnreadTotalSeal ? <span style={{ borderRadius: 999, padding: '6px 10px', border: `1px solid ${TOKENS.borderStrong}`, background: TOKENS.bg, color: TOKENS.text, fontFamily: TOKENS.mono, fontSize: 10, textTransform: 'uppercase' }}>unread {totalUnread ?? 0}</span> : null}
          {keyboardLegendLabel ? <span style={{ color: TOKENS.textMute, fontFamily: TOKENS.mono, fontSize: 10, textTransform: 'uppercase' }}>{keyboardLegendLabel}</span> : null}
          <span style={{ color: TOKENS.textMute, fontFamily: TOKENS.mono, fontSize: 10, textTransform: 'uppercase' }}>active {activeChannel}</span>
        </div>
      ) : null}
      <div style={{ display: 'grid', gridTemplateColumns: collapsed ? 'repeat(3, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
        {orderedTabs.map((tab) => (
          <ChannelTabButton
            key={tab.channelId}
            tab={tab}
            collapsed={collapsed}
            showDescriptions={showDescriptions}
            showMetaRail={showMetaRail}
            showHeatMeters={showHeatMeters}
            showPresence={showPresence}
            showHotkeys={showHotkeys}
            onSelectChannel={onSelectChannel}
            onOpenPresencePanel={onOpenPresencePanel}
            onOpenIntegrityPanel={onOpenIntegrityPanel}
          />
        ))}
      </div>
    </div>
  );
});

export default ChatChannelTabs;
