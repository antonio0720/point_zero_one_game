/**
 * SovereignChat.tsx
 * T208: War phase transition SYSTEM message styling within main chat view.
 * Renders high-signal banners for WAR_STARTED, ONE_HOUR_WARNING,
 * SETTLEMENT_STARTED, WAR_OUTCOME inline in the chat feed.
 */

import React, { useState, useRef, useEffect } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ChannelType = 'GLOBAL' | 'SERVER' | 'ALLIANCE' | 'OFFICER' | 'ROOM' | 'DM' | 'WAR_ROOM';
export type MessageType = 'TEXT' | 'STICKER' | 'SYSTEM' | 'WAR_ALERT' | 'DEAL_INVITE' | 'PROOF_SHARE';
export type WarSystemSubtype = 'WAR_STARTED' | 'ONE_HOUR_WARNING' | 'SETTLEMENT_STARTED' | 'WAR_OUTCOME';

export interface WarAlertPayload {
  warId:              string;
  attackerName:       string;
  defenderName:       string;
  attackerBanner:     string;
  defenderBanner:     string;
  currentPhase:       string;
  phaseEndsAt:        string;
  countdownMs:        number;
  attackerPoints:     number;
  defenderPoints:     number;
  deepLinkUrl:        string;
}

export interface ChatMessage {
  messageId:   string;
  senderId:    string;
  senderName?: string;
  type:        MessageType;
  channelType: ChannelType;
  text?:       string;
  subtype?:    WarSystemSubtype;
  warAlert?:   WarAlertPayload;
  status:      'ACTIVE' | 'UNSENT' | 'REMOVED';
  immutable:   boolean;
  createdAt:   string;
}

export interface SovereignChatProps {
  channelType:   ChannelType;
  channelName:   string;
  messages:      ChatMessage[];
  currentUserId: string;
  onSend:        (text: string) => void;
  onUnsend?:     (messageId: string) => void;
  onWarAlertClick?: (warId: string, url: string) => void;
  degraded?:     boolean;
}

// ─── T208: War phase SYSTEM message styles ────────────────────────────────────

const WAR_SYSTEM_CONFIG: Record<WarSystemSubtype, {
  icon:       string;
  label:      string;
  bg:         string;
  border:     string;
  textColor:  string;
  pulse:      boolean;
}> = {
  WAR_STARTED: {
    icon:      '🔥',
    label:     'WAR HAS BEGUN',
    bg:        'linear-gradient(135deg, #EF4444, #B91C1C)',
    border:    '#EF4444',
    textColor: '#FFFFFF',
    pulse:     true,
  },
  ONE_HOUR_WARNING: {
    icon:      '⏳',
    label:     '1 HOUR REMAINING',
    bg:        'linear-gradient(135deg, #F59E0B, #D97706)',
    border:    '#F59E0B',
    textColor: '#FFFFFF',
    pulse:     true,
  },
  SETTLEMENT_STARTED: {
    icon:      '⚖️',
    label:     'SETTLEMENT IN PROGRESS',
    bg:        'linear-gradient(135deg, #8B5CF6, #6D28D9)',
    border:    '#8B5CF6',
    textColor: '#FFFFFF',
    pulse:     false,
  },
  WAR_OUTCOME: {
    icon:      '🏆',
    label:     'WAR RESULT',
    bg:        'linear-gradient(135deg, #1E293B, #0F172A)',
    border:    '#F59E0B',
    textColor: '#F9FAFB',
    pulse:     false,
  },
};

// ─── War SYSTEM message component ────────────────────────────────────────────

const WarSystemBanner: React.FC<{ message: ChatMessage }> = ({ message }) => {
  if (!message.subtype) return null;
  const conf = WAR_SYSTEM_CONFIG[message.subtype];

  return (
    <div style={{
      background:   conf.bg,
      border:       `2px solid ${conf.border}`,
      borderRadius: 12,
      padding:      '14px 18px',
      margin:       '10px 4px',
      color:        conf.textColor,
      textAlign:    'center',
      position:     'relative',
      overflow:     'hidden',
      boxShadow:    `0 4px 20px ${conf.border}44`,
      animation:    conf.pulse ? 'warPulse 2s ease-in-out 2' : 'none',
    }}>
      <div style={{ fontSize: 22, marginBottom: 4 }}>{conf.icon}</div>
      <div style={{ fontWeight: 800, fontSize: 13, letterSpacing: 1.5, opacity: 0.85 }}>
        {conf.label}
      </div>
      <div style={{ fontWeight: 500, fontSize: 14, marginTop: 6, lineHeight: 1.5 }}>
        {message.text}
      </div>
      <div style={{ marginTop: 6, fontSize: 11, opacity: 0.6 }}>
        {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  );
};

// ─── WAR_ALERT card component ─────────────────────────────────────────────────

const WarAlertCard: React.FC<{
  payload:  WarAlertPayload;
  onClick?: (warId: string, url: string) => void;
}> = ({ payload, onClick }) => (
  <div
    onClick={() => onClick?.(payload.warId, payload.deepLinkUrl)}
    style={{
      background:   '#1E293B',
      border:       '2px solid #EF4444',
      borderRadius: 14,
      padding:      '14px 16px',
      margin:       '8px 4px',
      cursor:       onClick ? 'pointer' : 'default',
      boxShadow:    '0 4px 16px rgba(239,68,68,0.2)',
      transition:   'transform 0.15s',
    }}
    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.01)'; }}
    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
      <span style={{ color: '#EF4444', fontWeight: 800, fontSize: 12, letterSpacing: 1 }}>⚔️ WAR DECLARED</span>
      <span style={{ color: '#9CA3AF', fontSize: 11 }}>{payload.currentPhase}</span>
    </div>

    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ textAlign: 'center', flex: 1 }}>
        <img src={payload.attackerBanner} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />
        <div style={{ color: '#F8FAFC', fontWeight: 700, fontSize: 12, marginTop: 4 }}>{payload.attackerName}</div>
        <div style={{ color: '#EF4444', fontWeight: 800, fontSize: 18 }}>{payload.attackerPoints}</div>
      </div>
      <div style={{ color: '#6B7280', fontWeight: 700, fontSize: 16 }}>VS</div>
      <div style={{ textAlign: 'center', flex: 1 }}>
        <img src={payload.defenderBanner} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />
        <div style={{ color: '#F8FAFC', fontWeight: 700, fontSize: 12, marginTop: 4 }}>{payload.defenderName}</div>
        <div style={{ color: '#EF4444', fontWeight: 800, fontSize: 18 }}>{payload.defenderPoints}</div>
      </div>
    </div>

    {onClick && (
      <div style={{
        marginTop:    10,
        textAlign:    'center',
        color:        '#EF4444',
        fontSize:     12,
        fontWeight:   600,
      }}>
        View War Room →
      </div>
    )}
  </div>
);

// ─── Regular bubble ───────────────────────────────────────────────────────────

const ChatBubble: React.FC<{
  message:  ChatMessage;
  isOwn:    boolean;
  onUnsend?: (id: string) => void;
}> = ({ message, isOwn, onUnsend }) => {
  const [hovered, setHovered] = useState(false);
  const canUnsend = isOwn && !message.immutable && message.status === 'ACTIVE';
  if (message.status === 'UNSENT') {
    return (
      <div style={{ textAlign: isOwn ? 'right' : 'left', color: '#9CA3AF', fontSize: 12, fontStyle: 'italic', margin: '2px 4px' }}>
        Message unsent
      </div>
    );
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start', margin: '3px 4px' }}
    >
      {!isOwn && message.senderName && (
        <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 2, marginLeft: 4 }}>{message.senderName}</div>
      )}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6, flexDirection: isOwn ? 'row-reverse' : 'row' }}>
        <div style={{
          maxWidth:     '70%',
          background:   isOwn ? '#3B82F6' : '#1E293B',
          color:        '#F8FAFC',
          borderRadius: isOwn ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          padding:      '10px 14px',
          fontSize:     14,
          lineHeight:   1.5,
        }}>
          {message.text}
        </div>
        {canUnsend && hovered && (
          <button
            onClick={() => onUnsend?.(message.messageId)}
            style={{
              background:   'transparent',
              border:       'none',
              color:        '#9CA3AF',
              fontSize:     11,
              cursor:       'pointer',
              padding:      '2px 4px',
            }}
          >
            Unsend
          </button>
        )}
        {message.immutable && (
          <span title="Immutable" style={{ fontSize: 10, color: '#6B7280' }}>🔒</span>
        )}
      </div>
      <span style={{ fontSize: 10, color: '#6B7280', marginTop: 2 }}>
        {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
    </div>
  );
};

// ─── SovereignChat ────────────────────────────────────────────────────────────

export const SovereignChat: React.FC<SovereignChatProps> = ({
  channelType,
  channelName,
  messages,
  currentUserId,
  onSend,
  onUnsend,
  onWarAlertClick,
  degraded = false,
}) => {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const isWarRoom = channelType === 'WAR_ROOM';

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || degraded) return;
    onSend(text);
    setInput('');
  };

  return (
    <div style={{
      display:       'flex',
      flexDirection: 'column',
      height:        '100%',
      background:    '#0F172A',
      color:         '#F8FAFC',
      fontFamily:    'system-ui, sans-serif',
    }}>
      {/* pulse keyframe */}
      <style>{`
        @keyframes warPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.9; transform: scale(1.01); }
        }
      `}</style>

      {/* Header */}
      <div style={{
        padding:       '12px 16px',
        borderBottom:  '1px solid rgba(255,255,255,0.08)',
        background:    '#1E293B',
        display:       'flex',
        alignItems:    'center',
        gap:           8,
      }}>
        {isWarRoom && <span>⚔️</span>}
        <span style={{ fontWeight: 700, fontSize: 15 }}>{channelName}</span>
        {isWarRoom && (
          <span style={{ fontSize: 11, color: '#EF4444', marginLeft: 'auto', fontWeight: 600 }}>
            🔒 Immutable
          </span>
        )}
        {degraded && (
          <span style={{ fontSize: 11, color: '#F59E0B', marginLeft: 'auto' }}>
            ⚠️ History only
          </span>
        )}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 4px' }}>
        {messages.map((msg) => {
          if (msg.type === 'SYSTEM' && msg.subtype) {
            return <WarSystemBanner key={msg.messageId} message={msg} />;
          }
          if (msg.type === 'WAR_ALERT' && msg.warAlert) {
            return (
              <WarAlertCard
                key={msg.messageId}
                payload={msg.warAlert}
                onClick={onWarAlertClick}
              />
            );
          }
          return (
            <ChatBubble
              key={msg.messageId}
              message={msg}
              isOwn={msg.senderId === currentUserId}
              onUnsend={onUnsend}
            />
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {!degraded ? (
        <div style={{
          display:     'flex',
          gap:         8,
          padding:     '10px 12px',
          borderTop:   '1px solid rgba(255,255,255,0.08)',
          background:  '#1E293B',
        }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={isWarRoom ? 'War room message…' : 'Send a message…'}
            maxLength={500}
            style={{
              flex:         1,
              background:   '#0F172A',
              border:       '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10,
              color:        '#F8FAFC',
              padding:      '9px 14px',
              fontSize:     14,
              outline:      'none',
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            style={{
              background:   input.trim() ? (isWarRoom ? '#EF4444' : '#3B82F6') : '#374151',
              color:        '#fff',
              border:       'none',
              borderRadius: 10,
              padding:      '9px 16px',
              fontWeight:   700,
              cursor:       input.trim() ? 'pointer' : 'not-allowed',
              fontSize:     14,
            }}
          >
            →
          </button>
        </div>
      ) : (
        <div style={{
          padding:    '10px',
          textAlign:  'center',
          color:      '#6B7280',
          fontSize:   12,
          borderTop:  '1px solid rgba(255,255,255,0.06)',
          background: '#1E293B',
        }}>
          ⚠️ Chat unavailable — showing history
        </div>
      )}
    </div>
  );
};

export default SovereignChat;
