/**
 * ============================================================================
 * @pzo/engine/components/chat — AlliancePanel
 * FILE: frontend/packages/engine/src/components/chat/AlliancePanel.tsx
 * ============================================================================
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { AlliancePanelState, ChatChannel } from '../../chat';
import { formatMoney, safeIsoDate } from '../../chat';

export type { ActiveRivalry } from '../../chat';
export type AlliancePanelProps = AlliancePanelState & {
  readonly channel?: ChatChannel;
  readonly onFileNotice: () => void;
  readonly onEnterDealRoom: (rivalryId: string) => void;
};

const PHASE_CONFIG = {
  NOTICE_FILED: { label: 'Notice Filed', color: '#3B82F6', bg: '#0F2240', icon: '📋', urgent: false },
  DUE_DILIGENCE: { label: 'Due Diligence', color: '#F59E0B', bg: '#37260E', icon: '🔍', urgent: false },
  CAPITAL_BATTLE: { label: 'Capital Battle', color: '#EF4444', bg: '#381314', icon: '⚡', urgent: true },
  LEDGER_CLOSE: { label: 'Ledger Close', color: '#8B5CF6', bg: '#25143C', icon: '⚖️', urgent: false },
  CLOSED: { label: 'Closed', color: '#94A3B8', bg: '#111827', icon: '🏁', urgent: false },
} as const;

function useCountdown(isoDate: string | null | undefined): string {
  const target = useMemo(() => safeIsoDate(isoDate), [isoDate]);
  const calculate = useCallback(() => {
    const diff = new Date(target).getTime() - Date.now();
    if (diff <= 0) return '00:00:00';
    const hours = Math.floor(diff / 3_600_000);
    const minutes = Math.floor((diff % 3_600_000) / 60_000);
    const seconds = Math.floor((diff % 60_000) / 1_000);
    return [hours, minutes, seconds].map((n) => String(n).padStart(2, '0')).join(':');
  }, [target]);
  const [value, setValue] = useState<string>(calculate);
  useEffect(() => {
    const timer = window.setInterval(() => setValue(calculate()), 1_000);
    return () => window.clearInterval(timer);
  }, [calculate]);
  return value;
}

const ActiveRivalryCard: React.FC<{
  readonly rivalry: NonNullable<AlliancePanelProps['activeRivalry']>;
  readonly onEnterDealRoom: (rivalryId: string) => void;
}> = ({ rivalry, onEnterDealRoom }) => {
  const phase = PHASE_CONFIG[rivalry.phase];
  const countdown = useCountdown(rivalry.phaseEndsAt);
  const isChallenger = rivalry.mySyndicateId === rivalry.challengerSyndicateId;
  const myName = isChallenger ? rivalry.challengerName : rivalry.defenderName;
  const opponentName = isChallenger ? rivalry.defenderName : rivalry.challengerName;
  const myScore = isChallenger ? rivalry.challengerScore : rivalry.defenderScore;
  const opponentScore = isChallenger ? rivalry.defenderScore : rivalry.challengerScore;
  const closed = rivalry.phase === 'CLOSED';
  const winning = myScore >= opponentScore;

  return (
    <section
      style={{
        background: phase.bg,
        border: `1px solid ${phase.color}`,
        borderRadius: 16,
        padding: 16,
        boxShadow: phase.urgent ? `0 0 0 1px ${phase.color}, 0 0 24px rgba(239,68,68,0.16)` : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <div style={{ color: phase.color, fontWeight: 900, fontSize: 12, letterSpacing: 1.1, textTransform: 'uppercase' }}>
          {phase.icon} Syndicate Rivalry · {phase.label}
        </div>
        {!closed ? (
          <div style={{ background: phase.color, color: '#020617', borderRadius: 999, padding: '4px 10px', fontSize: 11, fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>
            {countdown}
          </div>
        ) : null}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12, alignItems: 'center', marginBottom: 14 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#94A3B8', fontSize: 10, fontWeight: 700 }}>YOU · {myName}</div>
          <div style={{ color: winning ? '#22C55E' : '#F8FAFC', fontSize: 28, fontWeight: 900 }}>{myScore}</div>
          <div style={{ color: '#64748B', fontSize: 10, fontWeight: 700 }}>CAPITAL SCORE</div>
        </div>
        <div style={{ color: '#64748B', fontSize: 12, fontWeight: 900 }}>vs</div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#94A3B8', fontSize: 10, fontWeight: 700 }}>{opponentName}</div>
          <div style={{ color: !winning ? '#22C55E' : '#F8FAFC', fontSize: 28, fontWeight: 900 }}>{opponentScore}</div>
          <div style={{ color: '#64748B', fontSize: 10, fontWeight: 700 }}>CAPITAL SCORE</div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onEnterDealRoom(rivalry.rivalryId)}
        style={{
          width: '100%',
          border: 'none',
          borderRadius: 12,
          padding: '10px 14px',
          background: phase.color,
          color: '#020617',
          fontWeight: 900,
          letterSpacing: 0.6,
          cursor: 'pointer',
        }}
      >
        {closed ? 'VIEW DEAL RECAP' : 'ENTER DEAL ROOM'}
      </button>
    </section>
  );
};

const LiquidityShieldBadge: React.FC<{ readonly expiresAt: string }> = ({ expiresAt }) => {
  const countdown = useCountdown(expiresAt);
  return (
    <div
      style={{
        background: 'rgba(34,197,94,0.12)',
        border: '1px solid rgba(34,197,94,0.35)',
        borderRadius: 12,
        padding: '10px 12px',
        color: '#86EFAC',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        fontSize: 12,
        fontWeight: 800,
      }}
    >
      <span>🛡️ Liquidity Shield Active</span>
      <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>{countdown}</span>
    </div>
  );
};

export const AlliancePanel: React.FC<AlliancePanelProps> = ({
  syndicateName,
  syndicateBanner,
  partnerRank,
  memberCount,
  treasuryBalance,
  liquidityShieldExpiresAt,
  activeRivalry,
  canFileNotice,
  onFileNotice,
  onEnterDealRoom,
}) => {
  const shieldActive = Boolean(liquidityShieldExpiresAt) && new Date(liquidityShieldExpiresAt as string).getTime() > Date.now();
  const hasNoticeAuthority = partnerRank === 'SENIOR_PARTNER' || partnerRank === 'MANAGING_PARTNER';

  return (
    <aside
      style={{
        background: 'linear-gradient(180deg, rgba(15,23,42,0.98), rgba(2,6,23,0.98))',
        color: '#F8FAFC',
        borderRadius: 18,
        border: '1px solid rgba(255,255,255,0.08)',
        padding: 16,
        display: 'grid',
        gap: 14,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <header style={{ display: 'grid', gridTemplateColumns: '56px 1fr auto', gap: 12, alignItems: 'center' }}>
        <img
          src={syndicateBanner}
          alt={syndicateName}
          style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'cover', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)' }}
        />
        <div>
          <div style={{ fontSize: 16, fontWeight: 900 }}>{syndicateName}</div>
          <div style={{ color: '#94A3B8', fontSize: 11, fontWeight: 700 }}>
            {memberCount} partners · {partnerRank.replaceAll('_', ' ')}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: '#64748B', fontSize: 10, fontWeight: 800, letterSpacing: 1 }}>TREASURY</div>
          <div style={{ color: '#FBBF24', fontSize: 16, fontWeight: 900 }}>{formatMoney(treasuryBalance)}</div>
        </div>
      </header>

      {shieldActive && liquidityShieldExpiresAt ? <LiquidityShieldBadge expiresAt={liquidityShieldExpiresAt} /> : null}

      {activeRivalry ? (
        <ActiveRivalryCard rivalry={activeRivalry} onEnterDealRoom={onEnterDealRoom} />
      ) : canFileNotice && hasNoticeAuthority && !shieldActive ? (
        <button
          type="button"
          onClick={onFileNotice}
          style={{
            width: '100%',
            border: 'none',
            borderRadius: 14,
            padding: '12px 14px',
            background: 'linear-gradient(135deg, #1D4ED8, #2563EB)',
            color: '#EFF6FF',
            fontWeight: 900,
            letterSpacing: 0.7,
            cursor: 'pointer',
          }}
        >
          📋 FILE RIVALRY NOTICE
        </button>
      ) : (
        <div
          style={{
            borderRadius: 14,
            border: '1px dashed rgba(255,255,255,0.12)',
            padding: 14,
            color: shieldActive ? '#86EFAC' : '#94A3B8',
            fontSize: 12,
            lineHeight: 1.6,
          }}
        >
          {shieldActive
            ? 'Liquidity Shield is active. Rivalry filing resumes when the recovery window closes.'
            : hasNoticeAuthority
              ? 'Rivalry notices are currently unavailable.'
              : 'Senior Partner or Managing Partner authority is required to file a Rivalry Notice.'}
        </div>
      )}
    </aside>
  );
};

export default AlliancePanel;
