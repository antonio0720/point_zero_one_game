/**
 * ============================================================================
 * @pzo/engine/components/chat — OmnipresentChatDock
 * FILE: frontend/packages/engine/src/components/chat/OmnipresentChatDock.tsx
 * ============================================================================
 *
 * Package-level chat workspace.
 * - No transport ownership
 * - No reducer ownership
 * - No store ownership
 * - Consumes a prepared OmnipresentChatModel plus action callbacks
 * ============================================================================
 */

import React, { useMemo, useState } from 'react';
import type { ChatChannel, OmnipresentChatActions, OmnipresentChatModel } from '../../chat';
import AlliancePanel from './AlliancePanel';
import RoomManager from './RoomManager';
import SovereignChat from './SovereignChat';
import WarRoomPanel from './WarRoomPanel';

export interface OmnipresentChatDockProps {
  readonly model: OmnipresentChatModel;
  readonly actions?: OmnipresentChatActions;
  readonly startCollapsed?: boolean;
  readonly style?: React.CSSProperties;
}

function resolveInitialTab(model: OmnipresentChatModel): ChatChannel | 'ROOMS' {
  if (model.activeChannel) return model.activeChannel;
  if (model.dealRoom) return 'DEAL_ROOM';
  return 'GLOBAL';
}

export const OmnipresentChatDock: React.FC<OmnipresentChatDockProps> = ({
  model,
  actions,
  startCollapsed = false,
  style,
}) => {
  const [collapsed, setCollapsed] = useState(startCollapsed);
  const [activeTab, setActiveTab] = useState<ChatChannel | 'ROOMS'>(() => resolveInitialTab(model));

  const sendHandler = (channel: ChatChannel) => (body: string) => {
    actions?.onSendMessage?.(channel, body);
  };

  const title = useMemo(() => model.title ?? 'COMMAND COMMS', [model.title]);
  const subtitle = useMemo(() => model.subtitle ?? 'OMNIPRESENT CHAT', [model.subtitle]);

  const handleTabChange = (tab: ChatChannel | 'ROOMS') => {
    setActiveTab(tab);
    actions?.onChannelChange?.(tab);
  };

  return (
    <section
      style={{
        width: collapsed ? 84 : 420,
        minWidth: collapsed ? 84 : 360,
        maxWidth: collapsed ? 84 : 460,
        height: '100%',
        minHeight: 420,
        borderRadius: 18,
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'linear-gradient(180deg, rgba(7,9,16,0.96), rgba(2,6,23,0.98))',
        boxShadow: '0 18px 40px rgba(0,0,0,0.40)',
        display: 'grid',
        gridTemplateRows: 'auto auto 1fr',
        overflow: 'hidden',
        color: '#F8FAFC',
        fontFamily: 'Inter, system-ui, sans-serif',
        transition: 'width 0.18s ease, min-width 0.18s ease, max-width 0.18s ease',
        ...style,
      }}
    >
      <header style={{ display: 'grid', gridTemplateColumns: collapsed ? '1fr' : '1fr auto', gap: 10, padding: '14px 14px 10px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        {collapsed ? (
          <button
            type='button'
            onClick={() => setCollapsed(false)}
            style={{ border: 'none', background: 'transparent', color: '#C9A84C', fontWeight: 900, cursor: 'pointer' }}
          >
            CHAT
          </button>
        ) : (
          <>
            <div>
              <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: 0.6 }}>{title}</div>
              <div style={{ color: '#94A3B8', fontSize: 11, fontWeight: 700 }}>{subtitle}</div>
            </div>
            <button
              type='button'
              onClick={() => setCollapsed(true)}
              style={{ border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, background: 'rgba(255,255,255,0.04)', color: '#94A3B8', cursor: 'pointer', padding: '6px 10px', fontWeight: 800 }}
            >
              ←
            </button>
          </>
        )}
      </header>

      {!collapsed ? (
        <div style={{ display: 'flex', gap: 8, padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', overflowX: 'auto' }}>
          {model.tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type='button'
                onClick={() => handleTabChange(tab.id)}
                style={{
                  border: `1px solid ${active ? tab.accent : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 999,
                  background: active ? `${tab.accent}18` : 'rgba(255,255,255,0.03)',
                  color: active ? tab.accent : '#94A3B8',
                  padding: '7px 12px',
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 900,
                  letterSpacing: 0.8,
                  whiteSpace: 'nowrap',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      ) : null}

      {!collapsed ? (
        <div style={{ minHeight: 0, padding: 12, display: 'grid' }}>
          {activeTab === 'ROOMS' ? (
            <RoomManager
              myId={model.currentUserId}
              myRooms={model.rooms}
              onCreateRoom={actions?.onCreateRoom ?? (async () => 'room-id')}
              onJoinRoom={actions?.onJoinRoom ?? (async () => undefined)}
              onLeaveRoom={actions?.onLeaveRoom ?? (async () => undefined)}
              onSelectRoom={actions?.onSelectRoom ?? (() => undefined)}
              onClose={() => handleTabChange('GLOBAL')}
            />
          ) : activeTab === 'SYNDICATE' ? (
            <div style={{ display: 'grid', gap: 12, minHeight: 0 }}>
              <AlliancePanel
                {...model.alliance}
                onFileNotice={actions?.onFileNotice ?? (() => undefined)}
                onEnterDealRoom={(rivalryId) => {
                  actions?.onEnterDealRoom?.(rivalryId);
                  handleTabChange('DEAL_ROOM');
                }}
              />
              <div style={{ minHeight: 260 }}>
                <SovereignChat
                  channelId='syndicate'
                  channelType='SYNDICATE'
                  messages={model.visibleMessages}
                  currentUserId={model.currentUserId}
                  onSend={sendHandler('SYNDICATE')}
                  onAlertClick={actions?.onAlertClick}
                />
              </div>
            </div>
          ) : activeTab === 'DEAL_ROOM' && model.dealRoom ? (
            <WarRoomPanel
              {...model.dealRoom}
              onSend={sendHandler('DEAL_ROOM')}
            />
          ) : (
            <SovereignChat
              channelId={activeTab === 'DIRECT' ? 'direct' : 'global'}
              channelType={activeTab === 'ROOMS' ? 'GLOBAL' : (activeTab as ChatChannel)}
              messages={model.visibleMessages}
              currentUserId={model.currentUserId}
              onSend={sendHandler(activeTab === 'ROOMS' ? 'GLOBAL' : (activeTab as ChatChannel))}
              onAlertClick={actions?.onAlertClick}
            />
          )}
        </div>
      ) : null}
    </section>
  );
};

export default OmnipresentChatDock;
