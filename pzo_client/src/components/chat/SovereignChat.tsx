/**
 * SovereignChat.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * T208: Main chat surface with inline Market Move Alert cards and
 *       Market Phase Bulletin rendering for Rivalry phase transitions.
 *
 * Covers:
 *   - Inline MarketMoveAlertCard — banner, Capital Score, countdown, deep link
 *   - Inline MarketPhaseBulletinBanner — phase-specific high-signal styling
 *   - DEAL_ROOM channel policy: unsend disabled, immutable transcript cues
 *   - All UI copy in financial voice (no military language)
 */

import React, { useState, useCallback, useEffect } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RivalryPhase =
  | 'NOTICE_FILED'
  | 'DUE_DILIGENCE'
  | 'CAPITAL_BATTLE'
  | 'LEDGER_CLOSE'
  | 'CLOSED';

export type ChannelType = 'GLOBAL' | 'SERVER' | 'SYNDICATE' | 'DEAL_ROOM' | 'DIRECT';

export interface MarketMoveAlertPayload {
  rivalryId:           string;
  phase:               RivalryPhase;
  challenger:          { syndicateId: string; name: string; banner: string; capitalScore: number };
  defender:            { syndicateId: string; name: string; banner: string; capitalScore: number };
  phaseEndsAt:         string;
  deepLink:            string;
  proofHash?:          string;
  yieldCaptureAmount?: number;
}

export interface ChatMessage {
  messageId:    string;
  channelId:    string;
  channelType:  ChannelType;
  senderId:     string | 'SYSTEM';
  senderName?:  string;
  body:         string;
  createdAt:    string;
  immutable:    boolean;
  marketMoveAlert?: MarketMoveAlertPayload;
  bulletinType?:   'MARKET_PHASE_BULLETIN';
  bulletinPhase?:  RivalryPhase;
}

export interface SovereignChatProps {
  channelId:      string;
  channelType:    ChannelType;
  messages:       ChatMessage[];
  onSend:         (body: string) => void;
  onAlertClick:   (rivalryId: string) => void;
  currentUserId:  string;
}

// ─── Countdown ────────────────────────────────────────────────────────────────

function useCountdown(isoDate: string): string {
  const calc = useCallback(() => {
    const ms = new Date(isoDate).getTime() - Date.now();
    if (ms <= 0) return 'CLOSED';
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    const s = Math.floor((ms % 60_000) / 1_000);
    return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
  }, [isoDate]);

  const [display, setDisplay] = useState(calc);
  useEffect(() => {
    const t = setInterval(() => setDisplay(calc()), 1_000);
    return () => clearInterval(t);
  }, [calc]);
  return display;
}

// ─── Phase accent colors ──────────────────────────────────────────────────────

const PHASE_ACCENT: Record<RivalryPhase, { color: string; label: string; icon: string }> = {
  NOTICE_FILED:   { color: '#3B82F6', label: 'NOTICE FILED',    icon: '📋' },
  DUE_DILIGENCE:  { color: '#F59E0B', label: 'DUE DILIGENCE',   icon: '🔍' },
  CAPITAL_BATTLE: { color: '#EF4444', label: 'CAPITAL BATTLE',  icon: '⚡' },
  LEDGER_CLOSE:   { color: '#8B5CF6', label: 'LEDGER CLOSE',    icon: '⚖️' },
  CLOSED:         { color: '#64748B', label: 'CLOSED',           icon: '🏁' },
};

// ─── T208: Market Move Alert card ─────────────────────────────────────────────

const MarketMoveAlertCard: React.FC<{
  alert:      MarketMoveAlertPayload;
  onClick:    (rivalryId: string) => void;
}> = ({ alert, onClick }) => {
  const countdown = useCountdown(alert.phaseEndsAt);
  const accent    = PHASE_ACCENT[alert.phase];
  const isClosed  = alert.phase === 'CLOSED';

  return (
    <div
      onClick={() => onClick(alert.rivalryId)}
      style={{
        background:   '#0F172A',
        border:       `2px solid ${accent.color}`,
        borderRadius: 14,
        padding:      '14px 16px',
        margin:       '10px 0',
        cursor:       'pointer',
        transition:   'opacity 0.15s',
      }}
    >
      {/* Phase badge */}
      <div style={{
        display:      'flex',
        alignItems:   'center',
        gap:          8,
        marginBottom: 12,
      }}>
        <span style={{
          background:   accent.color,
          color:        '#fff',
          borderRadius: 6,
          padding:      '2px 10px',
          fontSize:     11,
          fontWeight:   800,
          letterSpacing: 1,
        }}>
          {accent.icon} {accent.label}
        </span>
        {!isClosed && (
          <span style={{
            marginLeft:        'auto',
            fontVariantNumeric: 'tabular-nums',
            fontSize:          12,
            color:             accent.color,
            fontWeight:        700,
          }}>
            {countdown}
          </span>
        )}
      </div>

      {/* Syndicate banners + Capital Score */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ textAlign: 'center', flex: 1 }}>
          <img
            src={alert.challenger.banner}
            alt={alert.challenger.name}
            style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover' }}
          />
          <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 4, fontWeight: 600 }}>
            {alert.challenger.name}
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#F1F5F9' }}>
            {alert.challenger.capitalScore}
          </div>
        </div>

        <div style={{ color: '#475569', fontWeight: 800, fontSize: 14 }}>vs</div>

        <div style={{ textAlign: 'center', flex: 1 }}>
          <img
            src={alert.defender.banner}
            alt={alert.defender.name}
            style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover' }}
          />
          <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 4, fontWeight: 600 }}>
            {alert.defender.name}
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#F1F5F9' }}>
            {alert.defender.capitalScore}
          </div>
        </div>
      </div>

      {/* Yield Capture — shown on CLOSED */}
      {isClosed && alert.yieldCaptureAmount !== undefined && (
        <div style={{
          marginTop:    10,
          background:   'rgba(245,158,11,0.1)',
          border:       '1px solid rgba(245,158,11,0.3)',
          borderRadius: 8,
          padding:      '6px 12px',
          fontSize:     12,
          color:        '#F59E0B',
          fontWeight:   700,
          textAlign:    'center',
        }}>
          💰 Yield Capture: {alert.yieldCaptureAmount.toLocaleString()} transferred
        </div>
      )}

      {/* Settlement Hash */}
      {isClosed && alert.proofHash && (
        <div style={{
          marginTop:  8,
          fontSize:   10,
          color:      '#475569',
          fontFamily: 'monospace',
          wordBreak:  'break-all',
        }}>
          HASH: {alert.proofHash}
        </div>
      )}

      {/* CTA */}
      <div style={{
        marginTop:   12,
        color:       accent.color,
        fontSize:    12,
        fontWeight:  700,
        textAlign:   'right',
        letterSpacing: 0.3,
      }}>
        {isClosed ? 'VIEW DEAL RECAP →' : 'ENTER DEAL ROOM →'}
      </div>
    </div>
  );
};

// ─── T208: Inline Market Phase Bulletin banner ─────────────────────────────────

const MarketPhaseBulletinBanner: React.FC<{
  msg:   ChatMessage;
  phase: RivalryPhase;
}> = ({ msg, phase }) => {
  const accent = PHASE_ACCENT[phase];
  const isHot  = phase === 'CAPITAL_BATTLE';

  return (
    <div style={{
      background:   isHot ? 'rgba(220,38,38,0.08)' : `rgba(${hexToRgb(accent.color)},0.07)`,
      borderLeft:   `4px solid ${accent.color}`,
      borderRadius: '0 10px 10px 0',
      padding:      '10px 14px',
      margin:       '8px 0',
      animation:    isHot ? 'battlePulse 3s ease-in-out infinite' : 'none',
    }}>
      <div style={{
        fontSize:     10,
        fontWeight:   800,
        color:        accent.color,
        letterSpacing: 1.2,
        marginBottom: 4,
      }}>
        {accent.icon} MARKET PHASE BULLETIN — {accent.label}
      </div>
      <div style={{ fontSize: 12, color: '#94A3B8', lineHeight: 1.5 }}>
        {msg.body}
      </div>
      <div style={{ fontSize: 10, color: '#475569', marginTop: 6 }}>
        🔒 Transcript integrity enforced
      </div>
    </div>
  );
};

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

// ─── SovereignChat ────────────────────────────────────────────────────────────

export const SovereignChat: React.FC<SovereignChatProps> = ({
  channelId,
  channelType,
  messages,
  onSend,
  onAlertClick,
  currentUserId,
}) => {
  const [draft, setDraft]   = useState('');
  const isDealRoom          = channelType === 'DEAL_ROOM';

  const handleSend = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setDraft('');
  };

  return (
    <div style={{
      display:       'flex',
      flexDirection: 'column',
      height:        '100%',
      background:    '#0F172A',
      fontFamily:    'system-ui, sans-serif',
    }}>
      <style>{`
        @keyframes battlePulse {
          0%, 100% { box-shadow: inset 0 0 0 0 rgba(220,38,38,0.05); }
          50%       { box-shadow: inset 0 0 20px 0 rgba(220,38,38,0.12); }
        }
      `}</style>

      {/* Deal Room integrity notice */}
      {isDealRoom && (
        <div style={{
          background:   'rgba(100,116,139,0.1)',
          borderBottom: '1px solid rgba(100,116,139,0.15)',
          padding:      '5px 14px',
          fontSize:     10,
          color:        '#475569',
          fontWeight:   600,
          letterSpacing: 0.4,
        }}>
          🔒 DEAL ROOM — Transcript integrity enforced. Unsend disabled. Logs are part of the official rivalry record.
        </div>
      )}

      {/* Message list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
        {messages.map((msg) => {
          // Market Move Alert card
          if (msg.marketMoveAlert) {
            return (
              <MarketMoveAlertCard
                key={msg.messageId}
                alert={msg.marketMoveAlert}
                onClick={onAlertClick}
              />
            );
          }
          // Market Phase Bulletin
          if (msg.bulletinType === 'MARKET_PHASE_BULLETIN' && msg.bulletinPhase) {
            return (
              <MarketPhaseBulletinBanner
                key={msg.messageId}
                msg={msg}
                phase={msg.bulletinPhase}
              />
            );
          }
          // Standard message
          const isMe     = msg.senderId === currentUserId;
          const isSystem = msg.senderId === 'SYSTEM';
          return (
            <div key={msg.messageId} style={{
              display:       'flex',
              flexDirection: isMe ? 'row-reverse' : 'row',
              marginBottom:  8,
              gap:           8,
            }}>
              <div style={{ maxWidth: '70%' }}>
                {!isMe && !isSystem && (
                  <div style={{
                    fontSize:  10,
                    color:     '#64748B',
                    marginBottom: 3,
                    fontWeight: 600,
                    display:   'flex',
                    gap:       6,
                    alignItems: 'center',
                  }}>
                    {msg.senderName}
                    {msg.immutable && <span title="Transcript integrity enforced">🔒</span>}
                  </div>
                )}
                <div style={{
                  background:   isSystem
                    ? 'rgba(100,116,139,0.1)'
                    : isMe
                      ? 'rgba(59,130,246,0.25)'
                      : 'rgba(255,255,255,0.06)',
                  borderRadius: 10,
                  padding:      '8px 12px',
                  fontSize:     13,
                  color:        isSystem ? '#64748B' : '#F1F5F9',
                  fontStyle:    isSystem ? 'italic' : 'normal',
                }}>
                  {msg.body}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div style={{
        borderTop:  '1px solid rgba(100,116,139,0.15)',
        padding:    '10px 14px',
        display:    'flex',
        gap:        8,
      }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder={isDealRoom ? 'Deal Room — transcript is recorded...' : 'Message...'}
          style={{
            flex:         1,
            background:   'rgba(255,255,255,0.04)',
            border:       '1px solid rgba(100,116,139,0.2)',
            borderRadius: 10,
            padding:      '9px 14px',
            color:        '#F1F5F9',
            fontSize:     13,
            outline:      'none',
          }}
        />
        <button
          onClick={handleSend}
          style={{
            background:   '#2563EB',
            color:        '#fff',
            border:       'none',
            borderRadius: 10,
            padding:      '9px 16px',
            fontWeight:   700,
            cursor:       'pointer',
            fontSize:     13,
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default SovereignChat;
