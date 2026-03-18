/**
 * ============================================================================
 * @pzo/engine/components/chat — WarRoomPanel
 * FILE: frontend/packages/engine/src/components/chat/WarRoomPanel.tsx
 * ============================================================================
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DealRoomMessageViewModel, RivalryPhase } from '../../chat';
import { safeIsoDate } from '../../chat';

export interface WarRoomPanelProps {
  readonly rivalryId: string;
  readonly phase: RivalryPhase;
  readonly phaseEndsAt: string;
  readonly challengerName: string;
  readonly defenderName: string;
  readonly challengerScore: number;
  readonly defenderScore: number;
  readonly myScore: number;
  readonly messages: readonly DealRoomMessageViewModel[];
  readonly onSend: (body: string) => void;
  readonly isLive: boolean;
  readonly proofHash?: string;
}

const PHASE_CONFIG: Record<RivalryPhase, {
  readonly label: string;
  readonly sublabel: string;
  readonly headerBg: string;
  readonly headerColor: string;
  readonly bulletinBg: string;
  readonly bulletinBorder: string;
  readonly bulletinColor: string;
  readonly pulse: boolean;
  readonly icon: string;
}> = {
  NOTICE_FILED: {
    label: 'NOTICE FILED',
    sublabel: 'Due Diligence opens shortly',
    headerBg: 'linear-gradient(135deg, #1E3A5F, #2563EB)',
    headerColor: '#BFDBFE',
    bulletinBg: '#EFF6FF',
    bulletinBorder: '#3B82F6',
    bulletinColor: '#1D4ED8',
    pulse: false,
    icon: '📋',
  },
  DUE_DILIGENCE: {
    label: 'DUE DILIGENCE',
    sublabel: 'Prepare your Market Plays',
    headerBg: 'linear-gradient(135deg, #78350F, #D97706)',
    headerColor: '#FEF3C7',
    bulletinBg: '#FFFBEB',
    bulletinBorder: '#F59E0B',
    bulletinColor: '#92400E',
    pulse: false,
    icon: '🔍',
  },
  CAPITAL_BATTLE: {
    label: 'CAPITAL BATTLE — OPEN',
    sublabel: 'Qualifying runs are scoring now',
    headerBg: 'linear-gradient(135deg, #7F1D1D, #DC2626)',
    headerColor: '#FEE2E2',
    bulletinBg: 'linear-gradient(135deg, #7F1D1D, #991B1B)',
    bulletinBorder: '#EF4444',
    bulletinColor: '#FEE2E2',
    pulse: true,
    icon: '⚡',
  },
  LEDGER_CLOSE: {
    label: 'LEDGER CLOSE',
    sublabel: 'Settlement Ceremony in progress',
    headerBg: 'linear-gradient(135deg, #4C1D95, #7C3AED)',
    headerColor: '#EDE9FE',
    bulletinBg: '#F5F3FF',
    bulletinBorder: '#8B5CF6',
    bulletinColor: '#4C1D95',
    pulse: false,
    icon: '⚖️',
  },
  CLOSED: {
    label: 'RIVALRY CLOSED',
    sublabel: 'Receipts locked. Settlement Hash published.',
    headerBg: 'linear-gradient(135deg, #0F172A, #1E293B)',
    headerColor: '#F8FAFC',
    bulletinBg: '#0F172A',
    bulletinBorder: '#F59E0B',
    bulletinColor: '#F8FAFC',
    pulse: false,
    icon: '🏁',
  },
};

function useCountdown(isoDate: string): string {
  const target = useMemo(() => safeIsoDate(isoDate), [isoDate]);
  const calc = useCallback(() => {
    const ms = new Date(target).getTime() - Date.now();
    if (ms <= 0) return '00:00:00';
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    const s = Math.floor((ms % 60_000) / 1_000);
    return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
  }, [target]);

  const [display, setDisplay] = useState(calc);
  useEffect(() => {
    const timer = window.setInterval(() => setDisplay(calc()), 1_000);
    return () => window.clearInterval(timer);
  }, [calc]);
  return display;
}

const MarketPhaseBulletin: React.FC<{ readonly message: DealRoomMessageViewModel; readonly phase: RivalryPhase }> = ({ message, phase }) => {
  const config = PHASE_CONFIG[phase];
  return (
    <div style={{ background: config.bulletinBg, border: `2px solid ${config.bulletinBorder}`, borderRadius: 12, padding: '12px 16px', margin: '12px 0', animation: config.pulse ? 'battlePulse 3s ease-in-out infinite' : 'none' }}>
      <div style={{ color: config.bulletinColor, fontSize: 12, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>
        {config.icon} MARKET PHASE BULLETIN — {config.label}
      </div>
      <div style={{ color: config.bulletinColor, fontSize: 13, lineHeight: 1.5, opacity: 0.9 }}>{message.body}</div>
      <div style={{ color: config.bulletinColor, fontSize: 10, marginTop: 8, opacity: 0.6, display: 'flex', alignItems: 'center', gap: 6 }}>
        🔒 TRANSCRIPT INTEGRITY ENFORCED — This bulletin is part of the official rivalry record
      </div>
    </div>
  );
};

const SettlementHashCard: React.FC<{ readonly message: DealRoomMessageViewModel; readonly proofHash?: string }> = ({ message, proofHash }) => (
  <div style={{ background: 'linear-gradient(135deg, #0F172A, #1E293B)', border: '2px solid #F59E0B', borderRadius: 12, padding: '14px 16px', margin: '12px 0' }}>
    <div style={{ color: '#F59E0B', fontSize: 11, fontWeight: 800, letterSpacing: 1.5, marginBottom: 8 }}>🏁 SETTLEMENT HASH PUBLISHED — RIVALRY CLOSED</div>
    <div style={{ color: '#94A3B8', fontSize: 13, marginBottom: 10, lineHeight: 1.5 }}>{message.body}</div>
    {proofHash ? (
      <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: '8px 12px', fontFamily: 'monospace', fontSize: 11, color: '#F59E0B', wordBreak: 'break-all' }}>
        HASH: {proofHash}
      </div>
    ) : null}
    <div style={{ color: '#475569', fontSize: 10, marginTop: 10 }}>🔒 RECEIPTS LOCKED — Rivalries end in a record, not an argument.</div>
  </div>
);

export const WarRoomPanel: React.FC<WarRoomPanelProps> = ({
  phase,
  phaseEndsAt,
  challengerName,
  defenderName,
  challengerScore,
  defenderScore,
  messages,
  onSend,
  isLive,
  proofHash,
}) => {
  const [draft, setDraft] = useState('');
  const config = PHASE_CONFIG[phase];
  const countdown = useCountdown(phaseEndsAt);
  const bottomRef = useRef<HTMLDivElement>(null);
  const closed = phase === 'CLOSED';
  const battle = phase === 'CAPITAL_BATTLE';

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const trimmed = draft.trim();
    if (!trimmed || closed) return;
    onSend(trimmed);
    setDraft('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0F172A', color: '#F8FAFC', fontFamily: 'system-ui, sans-serif' }}>
      <style>{`
        @keyframes battlePulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(220,38,38,0.1); }
          50% { box-shadow: 0 0 20px 6px rgba(220,38,38,0.25); }
        }
      `}</style>

      <div style={{ background: config.headerBg, padding: '14px 16px', animation: config.pulse ? 'battlePulse 3s ease-in-out infinite' : 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 13, letterSpacing: 1.2, color: config.headerColor }}>
              {config.icon} DEAL ROOM — {config.label}
            </div>
            <div style={{ fontSize: 11, color: config.headerColor, opacity: 0.75, marginTop: 2 }}>{config.sublabel}</div>
          </div>
          {!closed ? (
            <div style={{ background: 'rgba(0,0,0,0.35)', color: config.headerColor, borderRadius: 8, padding: '4px 10px', fontWeight: 800, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>{countdown}</div>
          ) : null}
        </div>

        {battle ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: 10, color: config.headerColor, opacity: 0.7, fontWeight: 700 }}>{challengerName}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: config.headerColor }}>{challengerScore}</div>
            </div>
            <div style={{ color: config.headerColor, opacity: 0.5, fontWeight: 700, alignSelf: 'center' }}>vs</div>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: 10, color: config.headerColor, opacity: 0.7, fontWeight: 700 }}>{defenderName}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: config.headerColor }}>{defenderScore}</div>
            </div>
          </div>
        ) : null}
      </div>

      {!isLive ? (
        <div style={{ background: '#1E293B', borderBottom: '1px solid #F59E0B', padding: '6px 16px', fontSize: 11, color: '#F59E0B', fontWeight: 700, letterSpacing: 0.5 }}>
          ⚠️ LIVE DEAL ROOM UPDATES PAUSED — History preserved. Transcript integrity maintained.
        </div>
      ) : null}

      <div style={{ background: 'rgba(100,116,139,0.1)', borderBottom: '1px solid rgba(100,116,139,0.2)', padding: '4px 16px', fontSize: 10, color: '#64748B', letterSpacing: 0.3 }}>
        🔒 TRANSCRIPT INTEGRITY ENFORCED — Deal Room logs are part of the official rivalry record. Unsend is disabled.
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {messages.map((message) => {
          if (message.bulletinType === 'MARKET_PHASE_BULLETIN') {
            return <MarketPhaseBulletin key={message.messageId} message={message} phase={message.phase ?? phase} />;
          }
          if (message.bulletinType === 'SETTLEMENT_HASH_CARD') {
            return <SettlementHashCard key={message.messageId} message={message} proofHash={proofHash} />;
          }
          const isSystem = message.senderId === 'SYSTEM';
          return (
            <div key={message.messageId} style={{ marginBottom: 10, opacity: isSystem ? 0.7 : 1 }}>
              {!isSystem ? (
                <div style={{ fontSize: 11, color: '#64748B', marginBottom: 2, fontWeight: 600 }}>
                  {message.senderName}
                  {message.immutable ? <span style={{ marginLeft: 6, color: '#475569' }}>🔒</span> : null}
                </div>
              ) : null}
              <div style={{ background: isSystem ? 'rgba(100,116,139,0.1)' : 'rgba(255,255,255,0.05)', borderRadius: 10, padding: '8px 12px', fontSize: 13, color: isSystem ? '#94A3B8' : '#F1F5F9', fontStyle: isSystem ? 'italic' : 'normal' }}>
                {message.body}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div style={{ borderTop: '1px solid rgba(100,116,139,0.2)', padding: '12px 16px', background: '#0F172A' }}>
        {closed ? (
          <div style={{ textAlign: 'center', color: '#475569', fontSize: 12, padding: '8px', fontWeight: 600, letterSpacing: 0.3 }}>
            🏁 RIVALRY CLOSED — RECEIPTS LOCKED
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && !event.shiftKey && handleSend()}
              placeholder='Deal Room — transcript is recorded...'
              style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(100,116,139,0.3)', borderRadius: 10, padding: '10px 14px', color: '#F1F5F9', fontSize: 13, outline: 'none' }}
            />
            <button onClick={handleSend} style={{ background: config.headerBg, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 18px', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
              Send
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WarRoomPanel;
