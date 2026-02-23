/**
 * WarRoomPanel.tsx
 * T208: Special styling for war phase transition SYSTEM messages.
 * High-signal formatting for: ACTIVE start, 1h warning, settlement, outcome.
 * WAR_ROOM policy: no unsend, immutable transcript, server-authoritative phase.
 */

import React, { useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type WarPhase = 'DECLARED' | 'PREPARATION' | 'ACTIVE' | 'SETTLEMENT' | 'ENDED';

export type WarSystemSubtype =
  | 'WAR_STARTED'
  | 'ONE_HOUR_WARNING'
  | 'SETTLEMENT_STARTED'
  | 'WAR_OUTCOME';

export interface WarMessage {
  messageId:   string;
  senderId:    string;
  type:        'TEXT' | 'SYSTEM' | 'WAR_ALERT';
  text?:       string;
  subtype?:    WarSystemSubtype;
  immutable:   boolean;
  createdAt:   string;
  warMeta?: {
    phase:          WarPhase;
    phaseEndsAt:    string;
    attackerPoints: number;
    defenderPoints: number;
    winnerId?:      string;
    attackerName:   string;
    defenderName:   string;
  };
}

export interface WarRoomPanelProps {
  warId:              string;
  currentPhase:       WarPhase;
  phaseEndsAt:        Date;
  attackerName:       string;
  defenderName:       string;
  attackerPoints:     number;
  defenderPoints:     number;
  myAllianceId:       string;
  attackerAllianceId: string;
  messages:           WarMessage[];
  onSend:             (text: string) => void;
  degraded?:          boolean;  // fallback: history-only if live endpoints down
}

// ─── Phase config ─────────────────────────────────────────────────────────────

const PHASE_CONFIG: Record<WarPhase, { label: string; color: string; bg: string; icon: string }> = {
  DECLARED:    { label: 'War Declared',    color: '#F59E0B', bg: '#FEF3C7', icon: '⚔️' },
  PREPARATION: { label: 'Preparation',     color: '#3B82F6', bg: '#EFF6FF', icon: '🛡️' },
  ACTIVE:      { label: 'WAR ACTIVE',      color: '#EF4444', bg: '#FEF2F2', icon: '🔥' },
  SETTLEMENT:  { label: 'Settlement',      color: '#8B5CF6', bg: '#F5F3FF', icon: '⚖️' },
  ENDED:       { label: 'War Ended',       color: '#6B7280', bg: '#F9FAFB', icon: '🏁' },
};

// ─── Countdown hook ───────────────────────────────────────────────────────────

function useCountdown(endsAt: Date): string {
  const calc = useCallback(() => {
    const ms = endsAt.getTime() - Date.now();
    if (ms <= 0) return '00:00:00';
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    const s = Math.floor((ms % 60_000) / 1_000);
    return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
  }, [endsAt]);

  const [display, setDisplay] = useState(calc);
  useEffect(() => {
    const t = setInterval(() => setDisplay(calc()), 1_000);
    return () => clearInterval(t);
  }, [calc]);

  return display;
}

// ─── T208: War phase SYSTEM message renderer ──────────────────────────────────

const WAR_SYSTEM_STYLES: Record<WarSystemSubtype, React.CSSProperties> = {
  WAR_STARTED: {
    background:   'linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)',
    color:        '#fff',
    borderRadius: 12,
    padding:      '16px 20px',
    margin:       '12px 0',
    fontWeight:   700,
    fontSize:     16,
    textAlign:    'center',
    boxShadow:    '0 4px 16px rgba(239,68,68,0.35)',
    letterSpacing: 0.5,
  },
  ONE_HOUR_WARNING: {
    background:   'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
    color:        '#fff',
    borderRadius: 12,
    padding:      '14px 18px',
    margin:       '10px 0',
    fontWeight:   700,
    fontSize:     15,
    textAlign:    'center',
    boxShadow:    '0 3px 12px rgba(245,158,11,0.35)',
  },
  SETTLEMENT_STARTED: {
    background:   'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
    color:        '#fff',
    borderRadius: 12,
    padding:      '14px 18px',
    margin:       '10px 0',
    fontWeight:   600,
    fontSize:     14,
    textAlign:    'center',
    boxShadow:    '0 3px 12px rgba(139,92,246,0.3)',
  },
  WAR_OUTCOME: {
    background:   'linear-gradient(135deg, #1F2937 0%, #111827 100%)',
    color:        '#F9FAFB',
    borderRadius: 14,
    padding:      '18px 22px',
    margin:       '14px 0',
    fontWeight:   700,
    fontSize:     17,
    textAlign:    'center',
    boxShadow:    '0 6px 24px rgba(0,0,0,0.4)',
    border:       '1px solid rgba(255,255,255,0.1)',
  },
};

const SUBTYPE_ICON: Record<WarSystemSubtype, string> = {
  WAR_STARTED:        '🔥',
  ONE_HOUR_WARNING:   '⏳',
  SETTLEMENT_STARTED: '⚖️',
  WAR_OUTCOME:        '🏆',
};

interface WarSystemMessageProps {
  message: WarMessage;
}

const WarSystemMessage: React.FC<WarSystemMessageProps> = ({ message }) => {
  if (!message.subtype) return null;
  const style = WAR_SYSTEM_STYLES[message.subtype];
  const icon  = SUBTYPE_ICON[message.subtype];

  return (
    <div style={style}>
      <span style={{ marginRight: 8, fontSize: 18 }}>{icon}</span>
      {message.text}
    </div>
  );
};

// ─── Regular chat bubble ──────────────────────────────────────────────────────

interface ChatBubbleProps {
  message:  WarMessage;
  isOwn:    boolean;
}

const ChatBubble: React.FC<ChatBubbleProps> = ({ message, isOwn }) => {
  // WAR_ROOM: no unsend UI shown (immutable policy)
  return (
    <div style={{
      display:       'flex',
      flexDirection: 'column',
      alignItems:    isOwn ? 'flex-end' : 'flex-start',
      margin:        '4px 0',
    }}>
      <div style={{
        maxWidth:     '72%',
        background:   isOwn ? '#3B82F6' : '#F3F4F6',
        color:        isOwn ? '#fff' : '#111827',
        borderRadius: isOwn ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
        padding:      '10px 14px',
        fontSize:     14,
        lineHeight:   1.5,
        boxShadow:    '0 1px 3px rgba(0,0,0,0.08)',
      }}>
        {message.text}
      </div>
      <span style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>
        {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        {message.immutable && (
          <span style={{ marginLeft: 4, color: '#D1FAE5' }} title="Immutable — cannot be unsent">
            🔒
          </span>
        )}
      </span>
    </div>
  );
};

// ─── WarRoomPanel ─────────────────────────────────────────────────────────────

export const WarRoomPanel: React.FC<WarRoomPanelProps> = ({
  warId,
  currentPhase,
  phaseEndsAt,
  attackerName,
  defenderName,
  attackerPoints,
  defenderPoints,
  myAllianceId,
  attackerAllianceId,
  messages,
  onSend,
  degraded = false,
}) => {
  const [input, setInput] = useState('');
  const countdown  = useCountdown(phaseEndsAt);
  const phaseConf  = PHASE_CONFIG[currentPhase];
  const isActive   = currentPhase === 'ACTIVE';
  const isEnded    = currentPhase === 'ENDED';
  const canSend    = !degraded && !isEnded;

  const handleSend = () => {
    const text = input.trim();
    if (!text || !canSend) return;
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
      {/* ── Phase header ── */}
      <div style={{
        background: phaseConf.bg,
        borderBottom: `3px solid ${phaseConf.color}`,
        padding:    '12px 16px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 700, color: phaseConf.color, fontSize: 15 }}>
            {phaseConf.icon} {phaseConf.label}
          </div>
          {!isEnded && (
            <div style={{
              background:   phaseConf.color,
              color:        '#fff',
              borderRadius: 8,
              padding:      '4px 10px',
              fontSize:     13,
              fontVariantNumeric: 'tabular-nums',
              fontWeight:   700,
            }}>
              {countdown}
            </div>
          )}
        </div>

        {/* Scoreboard */}
        <div style={{
          display:        'flex',
          justifyContent: 'space-between',
          marginTop:      8,
          background:     'rgba(0,0,0,0.06)',
          borderRadius:   8,
          padding:        '6px 12px',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>{attackerName}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: phaseConf.color }}>{attackerPoints}</div>
          </div>
          <div style={{ fontSize: 13, color: '#9CA3AF', alignSelf: 'center' }}>vs</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>{defenderName}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: phaseConf.color }}>{defenderPoints}</div>
          </div>
        </div>

        {/* Immutable policy notice */}
        <div style={{ marginTop: 6, fontSize: 11, color: '#6B7280', textAlign: 'center' }}>
          🔒 War Room transcript is permanent — messages cannot be unsent
        </div>

        {/* Degraded mode banner */}
        {degraded && (
          <div style={{
            marginTop:    6,
            background:   '#FEF3C7',
            color:        '#92400E',
            borderRadius: 6,
            padding:      '4px 10px',
            fontSize:     11,
            textAlign:    'center',
          }}>
            ⚠️ Live updates paused — showing history only
          </div>
        )}
      </div>

      {/* ── Message list ── */}
      <div style={{
        flex:       1,
        overflowY:  'auto',
        padding:    '12px 14px',
        display:    'flex',
        flexDirection: 'column',
        gap:        2,
      }}>
        {messages.map((msg) => {
          if (msg.type === 'SYSTEM' && msg.subtype) {
            return <WarSystemMessage key={msg.messageId} message={msg} />;
          }
          const isOwn = msg.senderId === myAllianceId;
          return <ChatBubble key={msg.messageId} message={msg} isOwn={isOwn} />;
        })}
      </div>

      {/* ── Input ── */}
      {canSend ? (
        <div style={{
          display:      'flex',
          gap:          8,
          padding:      '10px 14px',
          borderTop:    '1px solid rgba(255,255,255,0.08)',
          background:   '#1E293B',
        }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Message war room…"
            maxLength={500}
            style={{
              flex:         1,
              background:   '#0F172A',
              border:       '1px solid rgba(255,255,255,0.12)',
              borderRadius: 10,
              color:        '#F8FAFC',
              padding:      '10px 14px',
              fontSize:     14,
              outline:      'none',
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            style={{
              background:   input.trim() ? '#EF4444' : '#374151',
              color:        '#fff',
              border:       'none',
              borderRadius: 10,
              padding:      '10px 18px',
              fontWeight:   700,
              cursor:       input.trim() ? 'pointer' : 'not-allowed',
              fontSize:     14,
              transition:   'background 0.2s',
            }}
          >
            Send
          </button>
        </div>
      ) : (
        <div style={{
          padding:    '12px',
          textAlign:  'center',
          color:      '#6B7280',
          fontSize:   13,
          borderTop:  '1px solid rgba(255,255,255,0.08)',
          background: '#1E293B',
        }}>
          {isEnded ? '⚔️ War ended — transcript preserved' : '⚠️ Read-only mode'}
        </div>
      )}
    </div>
  );
};

export default WarRoomPanel;
