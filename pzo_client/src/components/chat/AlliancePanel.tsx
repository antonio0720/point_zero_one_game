/**
 * AlliancePanel.tsx
 * T208: War phase transition SYSTEM message styling in Alliance Panel.
 * Shows active war status, phase banners, and deep link to War Room.
 */

import React, { useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type WarPhase = 'DECLARED' | 'PREPARATION' | 'ACTIVE' | 'SETTLEMENT' | 'ENDED';

export interface ActiveWar {
  warId:              string;
  phase:              WarPhase;
  phaseEndsAt:        string;  // ISO
  attackerAllianceId: string;
  defenderAllianceId: string;
  attackerName:       string;
  defenderName:       string;
  attackerBanner:     string;
  defenderBanner:     string;
  attackerPoints:     number;
  defenderPoints:     number;
  myAllianceId:       string;
}

export interface AlliancePanelProps {
  allianceName:   string;
  allianceBanner: string;
  memberCount:    number;
  vaultBalance:   number;
  shieldExpiresAt?: string | null;
  activeWar?:     ActiveWar | null;
  canDeclareWar:  boolean;
  onDeclareWar:   () => void;
  onOpenWarRoom:  (warId: string) => void;
}

// ─── Phase config ─────────────────────────────────────────────────────────────

const PHASE_CONFIG: Record<WarPhase, {
  label:     string;
  color:     string;
  bg:        string;
  icon:      string;
  urgent:    boolean;
}> = {
  DECLARED:    { label: 'Declared',         color: '#F59E0B', bg: '#FEF3C7', icon: '📣', urgent: false },
  PREPARATION: { label: 'Preparation',      color: '#3B82F6', bg: '#EFF6FF', icon: '🛡️', urgent: false },
  ACTIVE:      { label: 'ACTIVE',           color: '#EF4444', bg: '#FFF0F0', icon: '🔥', urgent: true  },
  SETTLEMENT:  { label: 'Settlement',       color: '#8B5CF6', bg: '#F5F3FF', icon: '⚖️', urgent: false },
  ENDED:       { label: 'Ended',            color: '#6B7280', bg: '#F9FAFB', icon: '🏁', urgent: false },
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

// ─── T208: Active War Banner ──────────────────────────────────────────────────

const ActiveWarBanner: React.FC<{
  war:          ActiveWar;
  onOpenRoom:   (warId: string) => void;
}> = ({ war, onOpenRoom }) => {
  const conf      = PHASE_CONFIG[war.phase];
  const countdown = useCountdown(war.phaseEndsAt);
  const isMyAttacker = war.myAllianceId === war.attackerAllianceId;
  const myName    = isMyAttacker ? war.attackerName : war.defenderName;
  const oppName   = isMyAttacker ? war.defenderName : war.attackerName;
  const myPts     = isMyAttacker ? war.attackerPoints : war.defenderPoints;
  const oppPts    = isMyAttacker ? war.defenderPoints : war.attackerPoints;
  const winning   = myPts >= oppPts;

  return (
    <div style={{
      background:   conf.bg,
      border:       `2px solid ${conf.color}`,
      borderRadius: 14,
      padding:      '14px 16px',
      marginBottom: 12,
      animation:    conf.urgent ? 'warGlow 3s ease-in-out infinite' : 'none',
    }}>
      {/* Phase row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontWeight: 800, color: conf.color, fontSize: 13, letterSpacing: 0.5 }}>
          {conf.icon} {conf.label}
        </div>
        {war.phase !== 'ENDED' && (
          <div style={{
            background:           conf.color,
            color:                '#fff',
            borderRadius:         8,
            padding:              '3px 10px',
            fontSize:             12,
            fontWeight:           700,
            fontVariantNumeric:   'tabular-nums',
          }}>
            {countdown}
          </div>
        )}
      </div>

      {/* Score row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>YOU ({myName})</div>
          <div style={{
            fontSize:   22,
            fontWeight: 800,
            color:      winning ? '#10B981' : conf.color,
          }}>{myPts}</div>
        </div>
        <div style={{ color: '#9CA3AF', fontWeight: 700 }}>vs</div>
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>{oppName}</div>
          <div style={{
            fontSize:   22,
            fontWeight: 800,
            color:      !winning ? '#10B981' : conf.color,
          }}>{oppPts}</div>
        </div>
      </div>

      {/* War Room CTA */}
      <button
        onClick={() => onOpenRoom(war.warId)}
        style={{
          width:        '100%',
          background:   conf.color,
          color:        '#fff',
          border:       'none',
          borderRadius: 10,
          padding:      '9px',
          fontWeight:   700,
          fontSize:     13,
          cursor:       'pointer',
          letterSpacing: 0.3,
        }}
      >
        ⚔️ Open War Room
      </button>
    </div>
  );
};

// ─── Shield status ────────────────────────────────────────────────────────────

const ShieldBadge: React.FC<{ expiresAt: string }> = ({ expiresAt }) => {
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
      🛡️ Alliance Shielded
      <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>{countdown}</span>
    </div>
  );
};

// ─── AlliancePanel ────────────────────────────────────────────────────────────

export const AlliancePanel: React.FC<AlliancePanelProps> = ({
  allianceName,
  allianceBanner,
  memberCount,
  vaultBalance,
  shieldExpiresAt,
  activeWar,
  canDeclareWar,
  onDeclareWar,
  onOpenWarRoom,
}) => {
  const shieldActive = shieldExpiresAt && new Date(shieldExpiresAt) > new Date();

  return (
    <div style={{
      background:   '#0F172A',
      color:        '#F8FAFC',
      fontFamily:   'system-ui, sans-serif',
      padding:      '16px',
      height:       '100%',
      overflowY:    'auto',
    }}>
      <style>{`
        @keyframes warGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.1); }
          50%       { box-shadow: 0 0 16px 4px rgba(239,68,68,0.25); }
        }
      `}</style>

      {/* Alliance header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <img
          src={allianceBanner}
          alt={allianceName}
          style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover', border: '2px solid rgba(255,255,255,0.1)' }}
        />
        <div>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{allianceName}</div>
          <div style={{ color: '#6B7280', fontSize: 12 }}>{memberCount} members</div>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: '#6B7280' }}>Vault</div>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#F59E0B' }}>
            {vaultBalance.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Shield */}
      {shieldActive && shieldExpiresAt && <ShieldBadge expiresAt={shieldExpiresAt} />}

      {/* Active war banner — T208 high-signal phase transitions */}
      {activeWar && (
        <ActiveWarBanner war={activeWar} onOpenRoom={onOpenWarRoom} />
      )}

      {/* Declare war button */}
      {canDeclareWar && !activeWar && (
        <button
          onClick={onDeclareWar}
          style={{
            width:        '100%',
            background:   'linear-gradient(135deg, #EF4444, #B91C1C)',
            color:        '#fff',
            border:       'none',
            borderRadius: 12,
            padding:      '12px',
            fontWeight:   700,
            fontSize:     14,
            cursor:       'pointer',
            letterSpacing: 0.3,
            boxShadow:    '0 4px 12px rgba(239,68,68,0.3)',
          }}
        >
          ⚔️ Declare War
        </button>
      )}

      {!canDeclareWar && !activeWar && !shieldActive && (
        <div style={{
          textAlign:  'center',
          color:      '#6B7280',
          fontSize:   13,
          padding:    '20px 0',
        }}>
          War declarations unavailable
        </div>
      )}
    </div>
  );
};

export default AlliancePanel;
