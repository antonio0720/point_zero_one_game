/**
 * WarRoomPanel.tsx — DEAL ROOM PANEL
 * ─────────────────────────────────────────────────────────────────────────────
 * T208: Phase-aware Rivalry Deal Room with Market Phase Bulletin styling.
 *
 * What the Deal Room is:
 *   Not just another chat channel. It's a pressure chamber where Syndicate
 *   partners coordinate under a live Market Clock. Phase Bulletins land as
 *   system truth. Transcript integrity is enforced — the log is part of the
 *   official rivalry record.
 *
 * Phase bulletin styling per phase:
 *   NOTICE_FILED   → Blue — formal, procedural
 *   DUE_DILIGENCE  → Amber — preparation pressure
 *   CAPITAL_BATTLE → Red gradient + pulse — maximum urgency
 *   LEDGER_CLOSE   → Purple — settlement ceremony in progress
 *   CLOSED         → Dark + gold border — permanent record published
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RivalryPhase =
  | 'NOTICE_FILED'
  | 'DUE_DILIGENCE'
  | 'CAPITAL_BATTLE'
  | 'LEDGER_CLOSE'
  | 'CLOSED';

export interface DealRoomMessage {
  messageId:   string;
  senderId:    string | 'SYSTEM';
  senderName?: string;
  body:        string;
  createdAt:   string;
  immutable:   boolean;
  bulletinType?: 'MARKET_PHASE_BULLETIN' | 'SETTLEMENT_HASH_CARD';
  phase?:      RivalryPhase;
}

export interface WarRoomPanelProps {
  rivalryId:       string;
  phase:           RivalryPhase;
  phaseEndsAt:     string;
  challengerName:  string;
  defenderName:    string;
  challengerScore: number;
  defenderScore:   number;
  myScore:         number;
  messages:        DealRoomMessage[];
  onSend:          (body: string) => void;
  isLive:          boolean;   // false = degraded mode, history-only
  proofHash?:      string;
}

// ─── T208: Phase config — financial voice ─────────────────────────────────────

const PHASE_CONFIG: Record<RivalryPhase, {
  label:          string;
  sublabel:       string;
  headerBg:       string;
  headerColor:    string;
  bulletinBg:     string;
  bulletinBorder: string;
  bulletinColor:  string;
  pulse:          boolean;
  icon:           string;
}> = {
  NOTICE_FILED: {
    label:          'NOTICE FILED',
    sublabel:       'Due Diligence opens shortly',
    headerBg:       'linear-gradient(135deg, #1E3A5F, #2563EB)',
    headerColor:    '#BFDBFE',
    bulletinBg:     '#EFF6FF',
    bulletinBorder: '#3B82F6',
    bulletinColor:  '#1D4ED8',
    pulse:          false,
    icon:           '📋',
  },
  DUE_DILIGENCE: {
    label:          'DUE DILIGENCE',
    sublabel:       'Prepare your Market Plays',
    headerBg:       'linear-gradient(135deg, #78350F, #D97706)',
    headerColor:    '#FEF3C7',
    bulletinBg:     '#FFFBEB',
    bulletinBorder: '#F59E0B',
    bulletinColor:  '#92400E',
    pulse:          false,
    icon:           '🔍',
  },
  CAPITAL_BATTLE: {
    label:          'CAPITAL BATTLE — OPEN',
    sublabel:       'Qualifying runs are scoring now',
    headerBg:       'linear-gradient(135deg, #7F1D1D, #DC2626)',
    headerColor:    '#FEE2E2',
    bulletinBg:     'linear-gradient(135deg, #7F1D1D, #991B1B)',
    bulletinBorder: '#EF4444',
    bulletinColor:  '#FEE2E2',
    pulse:          true,
    icon:           '⚡',
  },
  LEDGER_CLOSE: {
    label:          'LEDGER CLOSE',
    sublabel:       'Settlement Ceremony in progress',
    headerBg:       'linear-gradient(135deg, #4C1D95, #7C3AED)',
    headerColor:    '#EDE9FE',
    bulletinBg:     '#F5F3FF',
    bulletinBorder: '#8B5CF6',
    bulletinColor:  '#4C1D95',
    pulse:          false,
    icon:           '⚖️',
  },
  CLOSED: {
    label:          'RIVALRY CLOSED',
    sublabel:       'Receipts locked. Settlement Hash published.',
    headerBg:       'linear-gradient(135deg, #0F172A, #1E293B)',
    headerColor:    '#F8FAFC',
    bulletinBg:     '#0F172A',
    bulletinBorder: '#F59E0B',
    bulletinColor:  '#F8FAFC',
    pulse:          false,
    icon:           '🏁',
  },
};

// ─── Countdown ────────────────────────────────────────────────────────────────

function useCountdown(isoDate: string): string {
  const calc = useCallback(() => {
    const ms = new Date(isoDate).getTime() - Date.now();
    if (ms <= 0) return '00:00:00';
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

// ─── T208: Market Phase Bulletin renderer ─────────────────────────────────────

const MarketPhaseBulletin: React.FC<{ msg: DealRoomMessage; phase: RivalryPhase }> = ({ msg, phase }) => {
  const conf = PHASE_CONFIG[phase];
  return (
    <div style={{
      background:   conf.bulletinBg,
      border:       `2px solid ${conf.bulletinBorder}`,
      borderRadius: 12,
      padding:      '12px 16px',
      margin:       '12px 0',
      animation:    conf.pulse ? 'battlePulse 3s ease-in-out infinite' : 'none',
    }}>
      <div style={{
        color:        conf.bulletinColor,
        fontSize:     12,
        fontWeight:   800,
        letterSpacing: 1.5,
        textTransform: 'uppercase',
        marginBottom: 6,
      }}>
        {conf.icon} MARKET PHASE BULLETIN — {conf.label}
      </div>
      <div style={{
        color:      conf.bulletinColor,
        fontSize:   13,
        lineHeight: 1.5,
        opacity:    0.9,
      }}>
        {msg.body}
      </div>
      <div style={{
        color:    conf.bulletinColor,
        fontSize: 10,
        marginTop: 8,
        opacity:  0.6,
        display:  'flex',
        alignItems: 'center',
        gap:      6,
      }}>
        🔒 TRANSCRIPT INTEGRITY ENFORCED — This bulletin is part of the official rivalry record
      </div>
    </div>
  );
};

// ─── Settlement Hash card ──────────────────────────────────────────────────────

const SettlementHashCard: React.FC<{ msg: DealRoomMessage; proofHash?: string }> = ({ msg, proofHash }) => (
  <div style={{
    background:   'linear-gradient(135deg, #0F172A, #1E293B)',
    border:       '2px solid #F59E0B',
    borderRadius: 12,
    padding:      '14px 16px',
    margin:       '12px 0',
  }}>
    <div style={{ color: '#F59E0B', fontSize: 11, fontWeight: 800, letterSpacing: 1.5, marginBottom: 8 }}>
      🏁 SETTLEMENT HASH PUBLISHED — RIVALRY CLOSED
    </div>
    <div style={{ color: '#94A3B8', fontSize: 13, marginBottom: 10, lineHeight: 1.5 }}>
      {msg.body}
    </div>
    {proofHash && (
      <div style={{
        background:   'rgba(245,158,11,0.1)',
        border:       '1px solid rgba(245,158,11,0.3)',
        borderRadius: 8,
        padding:      '8px 12px',
        fontFamily:   'monospace',
        fontSize:     11,
        color:        '#F59E0B',
        wordBreak:    'break-all',
      }}>
        HASH: {proofHash}
      </div>
    )}
    <div style={{ color: '#475569', fontSize: 10, marginTop: 10 }}>
      🔒 RECEIPTS LOCKED — Rivalries end in a record, not an argument.
    </div>
  </div>
);

// ─── WarRoomPanel ─────────────────────────────────────────────────────────────

export const WarRoomPanel: React.FC<WarRoomPanelProps> = ({
  rivalryId,
  phase,
  phaseEndsAt,
  challengerName,
  defenderName,
  challengerScore,
  defenderScore,
  myScore,
  messages,
  onSend,
  isLive,
  proofHash,
}) => {
  const [draft, setDraft] = useState('');
  const conf             = PHASE_CONFIG[phase];
  const countdown        = useCountdown(phaseEndsAt);
  const bottomRef        = useRef<HTMLDivElement>(null);
  const isClosed         = phase === 'CLOSED';
  const isBattle        = phase === 'CAPITAL_BATTLE';

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const trimmed = draft.trim();
    if (!trimmed || isClosed) return;
    onSend(trimmed);
    setDraft('');
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
      <style>{`
        @keyframes battlePulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(220,38,38,0.1); }
          50%       { box-shadow: 0 0 20px 6px rgba(220,38,38,0.25); }
        }
      `}</style>

      {/* Phase header */}
      <div style={{
        background:  conf.headerBg,
        padding:     '14px 16px',
        animation:   conf.pulse ? 'battlePulse 3s ease-in-out infinite' : 'none',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 13, letterSpacing: 1.2, color: conf.headerColor }}>
              {conf.icon} DEAL ROOM — {conf.label}
            </div>
            <div style={{ fontSize: 11, color: conf.headerColor, opacity: 0.75, marginTop: 2 }}>
              {conf.sublabel}
            </div>
          </div>
          {!isClosed && (
            <div style={{
              background:          'rgba(0,0,0,0.35)',
              color:               conf.headerColor,
              borderRadius:        8,
              padding:             '4px 10px',
              fontWeight:          800,
              fontSize:            13,
              fontVariantNumeric:  'tabular-nums',
            }}>
              {countdown}
            </div>
          )}
        </div>

        {/* Capital Score — live during CAPITAL_BATTLE */}
        {isBattle && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: 10, color: conf.headerColor, opacity: 0.7, fontWeight: 700 }}>
                {challengerName}
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: conf.headerColor }}>
                {challengerScore}
              </div>
            </div>
            <div style={{ color: conf.headerColor, opacity: 0.5, fontWeight: 700, alignSelf: 'center' }}>
              vs
            </div>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: 10, color: conf.headerColor, opacity: 0.7, fontWeight: 700 }}>
                {defenderName}
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: conf.headerColor }}>
                {defenderScore}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Degraded banner */}
      {!isLive && (
        <div style={{
          background: '#1E293B',
          borderBottom: '1px solid #F59E0B',
          padding:    '6px 16px',
          fontSize:   11,
          color:      '#F59E0B',
          fontWeight: 700,
          letterSpacing: 0.5,
        }}>
          ⚠️ LIVE DEAL ROOM UPDATES PAUSED — History preserved. Transcript integrity maintained.
        </div>
      )}

      {/* Immutable notice */}
      <div style={{
        background: 'rgba(100,116,139,0.1)',
        borderBottom: '1px solid rgba(100,116,139,0.2)',
        padding:    '4px 16px',
        fontSize:   10,
        color:      '#64748B',
        letterSpacing: 0.3,
      }}>
        🔒 TRANSCRIPT INTEGRITY ENFORCED — Deal Room logs are part of the official rivalry record. Unsend is disabled.
      </div>

      {/* Message thread */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {messages.map((msg) => {
          if (msg.bulletinType === 'MARKET_PHASE_BULLETIN') {
            return <MarketPhaseBulletin key={msg.messageId} msg={msg} phase={msg.phase ?? phase} />;
          }
          if (msg.bulletinType === 'SETTLEMENT_HASH_CARD') {
            return <SettlementHashCard key={msg.messageId} msg={msg} proofHash={proofHash} />;
          }
          const isSystem = msg.senderId === 'SYSTEM';
          return (
            <div key={msg.messageId} style={{
              marginBottom: 10,
              opacity:      isSystem ? 0.7 : 1,
            }}>
              {!isSystem && (
                <div style={{ fontSize: 11, color: '#64748B', marginBottom: 2, fontWeight: 600 }}>
                  {msg.senderName}
                  {msg.immutable && (
                    <span style={{ marginLeft: 6, color: '#475569' }}>🔒</span>
                  )}
                </div>
              )}
              <div style={{
                background:   isSystem ? 'rgba(100,116,139,0.1)' : 'rgba(255,255,255,0.05)',
                borderRadius: 10,
                padding:      '8px 12px',
                fontSize:     13,
                color:        isSystem ? '#94A3B8' : '#F1F5F9',
                fontStyle:    isSystem ? 'italic' : 'normal',
              }}>
                {msg.body}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input — disabled when CLOSED */}
      <div style={{
        borderTop:  '1px solid rgba(100,116,139,0.2)',
        padding:    '12px 16px',
        background: '#0F172A',
      }}>
        {isClosed ? (
          <div style={{
            textAlign:  'center',
            color:      '#475569',
            fontSize:   12,
            padding:    '8px',
            fontWeight: 600,
            letterSpacing: 0.3,
          }}>
            🏁 RIVALRY CLOSED — RECEIPTS LOCKED
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Deal Room — transcript is recorded..."
              style={{
                flex:         1,
                background:   'rgba(255,255,255,0.05)',
                border:       '1px solid rgba(100,116,139,0.3)',
                borderRadius: 10,
                padding:      '10px 14px',
                color:        '#F1F5F9',
                fontSize:     13,
                outline:      'none',
              }}
            />
            <button
              onClick={handleSend}
              style={{
                background:   conf.headerBg,
                color:        '#fff',
                border:       'none',
                borderRadius: 10,
                padding:      '10px 18px',
                fontWeight:   700,
                cursor:       'pointer',
                fontSize:     13,
              }}
            >
              Send
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WarRoomPanel;
