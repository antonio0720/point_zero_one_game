/**
 * ============================================================================
 * @pzo/engine/components/chat — SovereignChat
 * FILE: frontend/packages/engine/src/components/chat/SovereignChat.tsx
 * ============================================================================
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChatChannel, PackageChatMessage } from '../../chat';
import {
  coerceChannelType,
  coerceRivalryPhase,
  extractMarketMoveAlertFromMessage,
  formatTimestamp,
} from '../../chat';

export interface SovereignChatProps {
  readonly channelId: string;
  readonly channelType?: ChatChannel;
  readonly messages: readonly PackageChatMessage[];
  readonly currentUserId: string;
  readonly onSend: (body: string) => void;
  readonly onAlertClick?: (rivalryId: string) => void;
}

function useCountdown(isoDate: string): string {
  const [value, setValue] = useState('00:00:00');

  useEffect(() => {
    const update = () => {
      const diff = new Date(isoDate).getTime() - Date.now();
      if (diff <= 0) {
        setValue('CLOSED');
        return;
      }
      const hours = Math.floor(diff / 3_600_000);
      const minutes = Math.floor((diff % 3_600_000) / 60_000);
      const seconds = Math.floor((diff % 60_000) / 1_000);
      setValue([hours, minutes, seconds].map((n) => String(n).padStart(2, '0')).join(':'));
    };

    update();
    const timer = window.setInterval(update, 1_000);
    return () => window.clearInterval(timer);
  }, [isoDate]);

  return value;
}

const PHASE_ACCENT = {
  NOTICE_FILED: { color: '#3B82F6', label: 'NOTICE FILED', icon: '📋' },
  DUE_DILIGENCE: { color: '#F59E0B', label: 'DUE DILIGENCE', icon: '🔍' },
  CAPITAL_BATTLE: { color: '#EF4444', label: 'CAPITAL BATTLE', icon: '⚡' },
  LEDGER_CLOSE: { color: '#8B5CF6', label: 'LEDGER CLOSE', icon: '⚖️' },
  CLOSED: { color: '#94A3B8', label: 'CLOSED', icon: '🏁' },
} as const;

const MarketMoveAlertCard: React.FC<{
  readonly alert: NonNullable<ReturnType<typeof extractMarketMoveAlertFromMessage>>;
  readonly onClick: (rivalryId: string) => void;
}> = ({ alert, onClick }) => {
  const countdown = useCountdown(alert.phaseEndsAt);
  const accent = PHASE_ACCENT[alert.phase];
  const closed = alert.phase === 'CLOSED';

  return (
    <button
      type="button"
      onClick={() => onClick(alert.rivalryId)}
      style={{
        width: '100%',
        textAlign: 'left',
        border: `1px solid ${accent.color}`,
        borderRadius: 16,
        padding: 14,
        background: 'linear-gradient(180deg, rgba(15,23,42,0.98), rgba(2,6,23,0.98))',
        color: '#F8FAFC',
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ background: accent.color, color: '#020617', borderRadius: 999, padding: '4px 10px', fontSize: 11, fontWeight: 900, letterSpacing: 1 }}>
          {accent.icon} {accent.label}
        </span>
        {!closed ? <span style={{ marginLeft: 'auto', color: accent.color, fontWeight: 900, fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{countdown}</span> : null}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12, alignItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 700 }}>{alert.challenger.name}</div>
          <div style={{ fontSize: 22, fontWeight: 900 }}>{alert.challenger.capitalScore}</div>
        </div>
        <div style={{ color: '#64748B', fontWeight: 900 }}>vs</div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 700 }}>{alert.defender.name}</div>
          <div style={{ fontSize: 22, fontWeight: 900 }}>{alert.defender.capitalScore}</div>
        </div>
      </div>

      {closed && typeof alert.yieldCaptureAmount === 'number' ? (
        <div style={{ marginTop: 12, borderRadius: 10, padding: '8px 10px', background: 'rgba(250,204,21,0.10)', color: '#FBBF24', fontWeight: 800, fontSize: 12 }}>
          Yield Capture: {alert.yieldCaptureAmount.toLocaleString()}
        </div>
      ) : null}

      {alert.proofHash ? (
        <div style={{ marginTop: 10, color: '#64748B', fontSize: 10, fontFamily: 'IBM Plex Mono, monospace', wordBreak: 'break-all' }}>
          HASH · {alert.proofHash}
        </div>
      ) : null}

      <div style={{ marginTop: 12, color: accent.color, fontSize: 12, fontWeight: 900, textAlign: 'right' }}>
        {closed ? 'VIEW DEAL RECAP →' : 'ENTER DEAL ROOM →'}
      </div>
    </button>
  );
};

const MarketPhaseBulletinBanner: React.FC<{ readonly message: PackageChatMessage }> = ({ message }) => {
  const phase = coerceRivalryPhase(message.bulletinPhase ?? message.phase, 'NOTICE_FILED');
  const accent = PHASE_ACCENT[phase];
  const hot = phase === 'CAPITAL_BATTLE';

  return (
    <div
      style={{
        borderLeft: `4px solid ${accent.color}`,
        borderRadius: '0 12px 12px 0',
        background: hot ? 'rgba(239,68,68,0.10)' : 'rgba(148,163,184,0.08)',
        padding: '12px 14px',
        marginBottom: 10,
      }}
    >
      <div style={{ color: accent.color, fontSize: 10, fontWeight: 900, letterSpacing: 1.1, marginBottom: 4 }}>
        {accent.icon} MARKET PHASE BULLETIN · {accent.label}
      </div>
      <div style={{ color: '#CBD5E1', fontSize: 12, lineHeight: 1.55 }}>{message.body}</div>
      <div style={{ color: '#64748B', fontSize: 10, marginTop: 6 }}>🔒 Transcript integrity enforced</div>
    </div>
  );
};

function isBulletinMessage(message: PackageChatMessage): boolean {
  return (
    message.bulletinType === 'MARKET_PHASE_BULLETIN' ||
    String(message.senderName ?? '').toUpperCase().includes('BULLETIN') ||
    String(message.senderRank ?? '').toUpperCase().includes('BULLETIN')
  );
}

function bubbleTone(message: PackageChatMessage, currentUserId: string): 'system' | 'self' | 'other' {
  if (message.senderId === 'SYSTEM' || String(message.senderName ?? '').toUpperCase() === 'SYSTEM') return 'system';
  if (message.senderId === currentUserId) return 'self';
  return 'other';
}

export const SovereignChat: React.FC<SovereignChatProps> = ({
  channelId,
  channelType,
  messages,
  currentUserId,
  onSend,
  onAlertClick,
}) => {
  const [draft, setDraft] = useState('');
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const resolvedType = coerceChannelType(channelType);
  const alertClick = onAlertClick ?? (() => undefined);

  const transcript = useMemo(
    () => messages.filter((message) => message.channel === resolvedType || (resolvedType === 'DIRECT' && message.roomId === channelId)),
    [channelId, messages, resolvedType],
  );

  useEffect(() => {
    if (scrollerRef.current) scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
  }, [transcript]);

  const handleSend = useCallback(() => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setDraft('');
  }, [draft, onSend]);

  return (
    <section style={{ display: 'grid', gridTemplateRows: 'auto 1fr auto', minHeight: 0, height: '100%', borderRadius: 18, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(13,13,13,0.95)', backdropFilter: 'blur(18px)', overflow: 'hidden', color: '#F8FAFC', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {resolvedType === 'DEAL_ROOM' ? (
        <div style={{ padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(148,163,184,0.06)', color: '#94A3B8', fontSize: 10, fontWeight: 700, letterSpacing: 0.5 }}>
          🔒 DEAL ROOM · transcript integrity enforced · unsend disabled
        </div>
      ) : null}

      <div ref={scrollerRef} style={{ overflowY: 'auto', padding: 14, display: 'grid', gap: 8, minHeight: 0 }}>
        {transcript.map((message) => {
          const marketMove = extractMarketMoveAlertFromMessage(message);
          if (marketMove) {
            return <MarketMoveAlertCard key={message.id} alert={marketMove} onClick={alertClick} />;
          }

          if (isBulletinMessage(message)) {
            return <MarketPhaseBulletinBanner key={message.id} message={message} />;
          }

          const tone = bubbleTone(message, currentUserId);
          const align = tone === 'self' ? 'flex-end' : 'flex-start';
          const bubbleBg = tone === 'system' ? 'rgba(148,163,184,0.08)' : tone === 'self' ? 'rgba(59,130,246,0.20)' : 'rgba(255,255,255,0.06)';

          return (
            <div key={message.id} style={{ display: 'flex', justifyContent: align }}>
              <div style={{ maxWidth: '78%' }}>
                {tone === 'other' ? (
                  <div style={{ color: '#64748B', fontSize: 10, fontWeight: 700, marginBottom: 4 }}>
                    {message.senderName ?? 'Unknown'} {message.immutable ? '🔒' : ''}
                  </div>
                ) : null}
                <div style={{ borderRadius: 12, padding: '10px 12px', background: bubbleBg, color: tone === 'system' ? '#94A3B8' : '#F8FAFC', fontSize: 13, lineHeight: 1.5, fontStyle: tone === 'system' ? 'italic' : 'normal' }}>
                  {message.body}
                </div>
                <div style={{ color: '#475569', fontSize: 10, marginTop: 4, fontFamily: 'IBM Plex Mono, monospace' }}>
                  {formatTimestamp(new Date(message.ts).toISOString())}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(2,6,23,0.68)' }}>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              handleSend();
            }
          }}
          placeholder={resolvedType === 'DEAL_ROOM' ? 'Deal Room — transcript is recorded…' : 'Message…'}
          style={{ flex: 1, borderRadius: 12, border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(15,23,42,0.92)', color: '#F8FAFC', padding: '10px 12px', outline: 'none' }}
        />
        <button type='button' onClick={handleSend} style={{ border: 'none', borderRadius: 12, background: '#2563EB', color: '#EFF6FF', fontWeight: 900, padding: '10px 16px', cursor: 'pointer' }}>
          Send
        </button>
      </div>
    </section>
  );
};

export default SovereignChat;
