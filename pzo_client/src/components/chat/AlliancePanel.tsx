/**
 * AlliancePanel.tsx — SYNDICATE PANEL
 * ─────────────────────────────────────────────────────────────────────────────
 * T208: Syndicate overview panel with active Rivalry status, treasury,
 *       Liquidity Shield, and phase-aware Market Clock display.
 *
 * Financial voice throughout:
 * Financial vocabulary throughout:
 *   Syndicate | FILE RIVALRY NOTICE | ENTER DEAL ROOM
 *   Liquidity Shield | Yield Capture | Capital Score
 *   Phase labels: NOTICE_FILED → DUE_DILIGENCE → CAPITAL_BATTLE → LEDGER_CLOSE → CLOSED
 */

import React, { useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RivalryPhase =
  | 'NOTICE_FILED'
  | 'DUE_DILIGENCE'
  | 'CAPITAL_BATTLE'
  | 'LEDGER_CLOSE'
  | 'CLOSED';

export interface ActiveRivalry {
  rivalryId:           string;
  phase:               RivalryPhase;
  phaseEndsAt:         string;
  challengerSyndicateId: string;
  defenderSyndicateId:   string;
  challengerName:      string;
  defenderName:        string;
  challengerBanner:    string;
  defenderBanner:      string;
  challengerScore:     number;
  defenderScore:       number;
  mySyndicateId:       string;
}

export interface SyndicatePanelProps {
  syndicateName:    string;
  syndicateBanner:  string;
  partnerRank:      'ASSOCIATE' | 'JUNIOR_PARTNER' | 'PARTNER' | 'SENIOR_PARTNER' | 'MANAGING_PARTNER';
  memberCount:      number;
  treasuryBalance:  number;
  liquidityShieldExpiresAt?: string | null;
  activeRivalry?:   ActiveRivalry | null;
  canFileNotice:    boolean;   // Senior Partner+ only
  onFileNotice:     () => void;
  onEnterDealRoom:  (rivalryId: string) => void;
}

// ─── T208: Phase config — financial voice ─────────────────────────────────────

const PHASE_CONFIG: Record<RivalryPhase, {
  label:    string;
  color:    string;
  bg:       string;
  icon:     string;
  urgent:   boolean;
}> = {
  NOTICE_FILED:   { label: 'Notice Filed',        color: '#3B82F6', bg: '#EFF6FF', icon: '📋', urgent: false },
  DUE_DILIGENCE:  { label: 'Due Diligence',       color: '#F59E0B', bg: '#FFFBEB', icon: '🔍', urgent: false },
  CAPITAL_BATTLE: { label: 'Capital Battle',      color: '#EF4444', bg: '#FFF0F0', icon: '⚡', urgent: true  },
  LEDGER_CLOSE:   { label: 'Ledger Close',        color: '#8B5CF6', bg: '#F5F3FF', icon: '⚖️', urgent: false },
  CLOSED:         { label: 'Closed',              color: '#6B7280', bg: '#F9FAFB', icon: '🏁', urgent: false },
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

// ─── T208: Active Rivalry Market Clock ────────────────────────────────────────

const ActiveRivalryMarketClock: React.FC<{
  rivalry:         ActiveRivalry;
  onEnterDealRoom: (id: string) => void;
}> = ({ rivalry, onEnterDealRoom }) => {
  const conf            = PHASE_CONFIG[rivalry.phase];
  const countdown       = useCountdown(rivalry.phaseEndsAt);
  const isChallenger    = rivalry.mySyndicateId === rivalry.challengerSyndicateId;
  const myName          = isChallenger ? rivalry.challengerName : rivalry.defenderName;
  const oppName         = isChallenger ? rivalry.defenderName   : rivalry.challengerName;
  const myScore         = isChallenger ? rivalry.challengerScore : rivalry.defenderScore;
  const oppScore        = isChallenger ? rivalry.defenderScore   : rivalry.challengerScore;
  const winning         = myScore >= oppScore;
  const isClosed        = rivalry.phase === 'CLOSED';

  return (
    <div style={{
      background:   conf.bg,
      border:       `2px solid ${conf.color}`,
      borderRadius: 14,
      padding:      '14px 16px',
      marginBottom: 12,
      animation:    conf.urgent ? 'capitalPulse 3s ease-in-out infinite' : 'none',
    }}>
      {/* Phase + Market Clock row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontWeight: 800, color: conf.color, fontSize: 12, letterSpacing: 0.8 }}>
          {conf.icon} SYNDICATE RIVALRY — {conf.label.toUpperCase()}
        </div>
        {!isClosed && (
          <div style={{
            background:          conf.color,
            color:               '#fff',
            borderRadius:        8,
            padding:             '3px 10px',
            fontSize:            12,
            fontWeight:          700,
            fontVariantNumeric:  'tabular-nums',
          }}>
            {countdown}
          </div>
        )}
      </div>

      {/* Capital Score row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ fontSize: 10, color: '#6B7280', fontWeight: 700 }}>YOU ({myName})</div>
          <div style={{
            fontSize:   22,
            fontWeight: 900,
            color:      winning ? '#10B981' : conf.color,
          }}>
            {myScore}
          </div>
          <div style={{ fontSize: 9, color: '#9CA3AF', fontWeight: 600 }}>CAPITAL SCORE</div>
        </div>
        <div style={{ color: '#9CA3AF', fontWeight: 700, fontSize: 13 }}>vs</div>
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ fontSize: 10, color: '#6B7280', fontWeight: 700 }}>{oppName}</div>
          <div style={{
            fontSize:   22,
            fontWeight: 900,
            color:      !winning ? '#10B981' : conf.color,
          }}>
            {oppScore}
          </div>
          <div style={{ fontSize: 9, color: '#9CA3AF', fontWeight: 600 }}>CAPITAL SCORE</div>
        </div>
      </div>

      {/* Enter Deal Room CTA */}
      <button
        onClick={() => onEnterDealRoom(rivalry.rivalryId)}
        style={{
          width:        '100%',
          background:   conf.color,
          color:        '#fff',
          border:       'none',
          borderRadius: 10,
          padding:      '9px',
          fontWeight:   800,
          fontSize:     12,
          cursor:       'pointer',
          letterSpacing: 0.8,
        }}
      >
        {isClosed ? '🏁 VIEW DEAL RECAP' : '⚡ ENTER DEAL ROOM'}
      </button>
    </div>
  );
};

// ─── Liquidity Shield badge ───────────────────────────────────────────────────

const LiquidityShieldBadge: React.FC<{ expiresAt: string }> = ({ expiresAt }) => {
  const countdown = useCountdown(expiresAt);
  return (
    <div style={{
      background:   '#D1FAE5',
      border:       '1px solid #10B981',
      borderRadius: 10,
      padding:      '8px 12px',
      fontSize:     12,
      color:        '#065F46',
      fontWeight:   600,
      display:      'flex',
      alignItems:   'center',
      gap:          6,
      marginBottom: 12,
    }}>
      🛡️ Liquidity Shield Active — Recovery window
      <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums', fontWeight: 800 }}>
        {countdown}
      </span>
    </div>
  );
};

// ─── SyndicatePanel (internal: AlliancePanel) ─────────────────────────────────

export const AlliancePanel: React.FC<SyndicatePanelProps> = ({
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
  const shieldActive = liquidityShieldExpiresAt && new Date(liquidityShieldExpiresAt) > new Date();
  const isSenior     = partnerRank === 'SENIOR_PARTNER' || partnerRank === 'MANAGING_PARTNER';

  return (
    <div style={{
      background:  '#0F172A',
      color:       '#F8FAFC',
      fontFamily:  'system-ui, sans-serif',
      padding:     '16px',
      height:      '100%',
      overflowY:   'auto',
    }}>
      <style>{`
        @keyframes capitalPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.1); }
          50%       { box-shadow: 0 0 18px 5px rgba(239,68,68,0.22); }
        }
      `}</style>

      {/* Syndicate header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <img
          src={syndicateBanner}
          alt={syndicateName}
          style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover', border: '2px solid rgba(255,255,255,0.08)' }}
        />
        <div>
          <div style={{ fontWeight: 800, fontSize: 15 }}>{syndicateName}</div>
          <div style={{ color: '#64748B', fontSize: 11, marginTop: 2 }}>
            {memberCount} partners · {partnerRank.replace('_', ' ')}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: '#64748B', fontWeight: 700 }}>TREASURY</div>
          <div style={{ fontWeight: 800, fontSize: 15, color: '#F59E0B' }}>
            ${treasuryBalance.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Liquidity Shield */}
      {shieldActive && liquidityShieldExpiresAt && (
        <LiquidityShieldBadge expiresAt={liquidityShieldExpiresAt} />
      )}

      {/* Active rivalry Market Clock */}
      {activeRivalry && (
        <ActiveRivalryMarketClock rivalry={activeRivalry} onEnterDealRoom={onEnterDealRoom} />
      )}

      {/* File Rivalry Notice — Senior Partner / Managing Partner only */}
      {canFileNotice && !activeRivalry && isSenior && (
        <button
          onClick={onFileNotice}
          style={{
            width:        '100%',
            background:   'linear-gradient(135deg, #1E3A5F, #2563EB)',
            color:        '#fff',
            border:       'none',
            borderRadius: 12,
            padding:      '13px',
            fontWeight:   800,
            fontSize:     13,
            cursor:       'pointer',
            letterSpacing: 0.8,
            boxShadow:    '0 4px 14px rgba(37,99,235,0.35)',
          }}
        >
          📋 FILE RIVALRY NOTICE
        </button>
      )}

      {/* Not eligible */}
      {!canFileNotice && !activeRivalry && !shieldActive && (
        <div style={{
          textAlign:  'center',
          color:      '#475569',
          fontSize:   12,
          padding:    '20px 0',
          fontWeight: 600,
        }}>
          {!isSenior
            ? 'Senior Partner authority required to file a Rivalry Notice.'
            : 'Rivalry notices unavailable.'}
        </div>
      )}

      {/* Shield blocks notice */}
      {shieldActive && !activeRivalry && (
        <div style={{
          textAlign:  'center',
          color:      '#10B981',
          fontSize:   12,
          padding:    '12px 0',
          fontWeight: 600,
        }}>
          Liquidity Shield active — rivalry notice filing resumes after recovery window.
        </div>
      )}
    </div>
  );
};

export default AlliancePanel;
