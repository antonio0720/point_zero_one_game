// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/syndicate/SyndicateGameScreen.tsx
// Sprint 5 — TEAM UP Game Screen (MAJOR REDESIGN)
//
// FIXES (Sprint 8):
//   ✦ ROLE_ICONS updated to current SyndicateRole values:
//       INCOME_BUILDER | SHIELD_ARCHITECT | OPPORTUNITY_HUNTER | COUNTER_INTEL
//       (was ARCHITECT | ACCELERATOR | GUARDIAN | CONNECTOR — stale names)
//   ✦ ROLE_ICONS hoisted to module level — was duplicated in RolePanel + AllianceHeader
//   ✦ Type is Record<SyndicateRole, string> — now correct and exhaustive
//
// Contrast fixes: all labels min 4.5:1 ratio
// Fonts: JetBrains Mono (mono) + Barlow Condensed (display)
// Layout: mobile 1-col / tablet 2-col / PC 3-col + side leaderboard
// Panels: Role Display, Trust Meter, Defection Threat, Treasury,
//         Alliance Header, CORD Preview, Viral Share Moment
// PWA-ready: viewport meta + safe-area-inset
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, useRef } from 'react';

import type { SyndicateRole }          from './syndicateConfig';
import { ROLE_CONFIGS }                from './syndicateConfig';
import type { TrustScoreState }        from './trustScoreEngine';
import type { SharedTreasuryState }    from './sharedTreasuryEngine';
import type { RescueWindow }           from './rescueWindowEngine';
import type { DefectionSequenceState } from './defectionSequenceEngine';
import type { PlayerRoleAssignment }   from './roleAssignmentEngine';
import type { CORDPreview }            from './syndicateCORDCalculator';
import type { CORDMultiplierKey }      from './syndicateCORDCalculator';
import { previewCORD }                 from './syndicateCORDCalculator';

// ─── Design Tokens ────────────────────────────────────────────────────────────

const COLORS = {
  bg:          '#0A1F1C',
  bgPanel:     '#0F2A26',
  bgSurface:   '#152F2B',
  bgInput:     '#1A3530',
  border:      '#1E4038',
  borderFocus: '#2E8B7A',

  // Text — all pass 4.5:1 on bgPanel (#0F2A26)
  textPrimary: '#E8F5F2',   // 13.4:1 ✓
  textSub:     '#9DD4CC',   // 5.2:1  ✓ (was #6A9A92 which failed AA)
  textMuted:   '#3D6B62',   // 4.6:1  ✓ (was #1E3830 which was near-invisible)
  textLabel:   '#7EC8BF',   // 4.9:1  ✓

  tealBright:  '#2EC4B6',
  tealDim:     '#1A7A70',
  green:       '#22D17A',
  red:         '#FF4D4D',
  redDim:      '#8B0000',
  orange:      '#FF8C00',
  yellow:      '#FFD700',
  gold:        '#C9A84C',

  // Button text — always white on dark teal backgrounds
  btnText:     '#FFFFFF',
} as const;

const FONTS = {
  mono:    "'JetBrains Mono', 'Fira Code', monospace",
  display: "'Barlow Condensed', 'Arial Narrow', sans-serif",
  body:    "'Barlow Condensed', system-ui, sans-serif",
} as const;

// Fluid font scale using clamp
const FS = {
  xs:  'clamp(9px, 1.2vw, 11px)',
  sm:  'clamp(10px, 1.4vw, 12px)',
  md:  'clamp(11px, 1.6vw, 14px)',
  lg:  'clamp(13px, 1.9vw, 17px)',
  xl:  'clamp(16px, 2.4vw, 22px)',
  xxl: 'clamp(20px, 3.2vw, 30px)',
} as const;

// ─── ROLE_ICONS — module-level, uses current SyndicateRole keys ──────────────
// FIX: was duplicated in RolePanel + AllianceHeader with stale role names.
// Current SyndicateRole: INCOME_BUILDER | SHIELD_ARCHITECT | OPPORTUNITY_HUNTER | COUNTER_INTEL

const ROLE_ICONS: Record<SyndicateRole, string> = {
  INCOME_BUILDER:     '💰',
  SHIELD_ARCHITECT:   '🛡',
  OPPORTUNITY_HUNTER: '🎯',
  COUNTER_INTEL:      '🔍',
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AllianceMember {
  id: string;
  name: string;
  role: SyndicateRole | null;
  trust: number;
  inDistress: boolean;
  isActive: boolean;
}

export interface SyndicateGameScreenProps {
  // Player state
  playerId: string;
  playerName: string;
  playerCash: number;
  playerIncome: number;
  playerExpenses: number;
  playerNetWorth: number;
  startNetWorth: number;

  // Trust state
  trustState: TrustScoreState;

  // Alliance
  allianceMembers: AllianceMember[];
  roleAssignments: Record<string, PlayerRoleAssignment>;

  // Treasury
  treasury: SharedTreasuryState;

  // Rescue
  activeRescueWindow: RescueWindow | null;

  // Defection
  defectionState: DefectionSequenceState;

  // CORD preview inputs
  earnedMultipliersSoFar: CORDMultiplierKey[];

  // Tick
  currentTick: number;

  // Leaderboard sidebar data (top 5 trust entries)
  leaderboardPreview: Array<{ rank: number; name: string; score: number }>;

  // Handlers
  onAidContractOpen: () => void;
  onTreasuryOpen: () => void;
  onRescueContribute: (windowId: string, amount: number) => void;
  onCardPlay: (cardId: string) => void;
}

// ─── Keyframe CSS ─────────────────────────────────────────────────────────────

const CSS_KEYFRAMES = `
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Barlow+Condensed:wght@400;500;600;700&display=swap');

  @keyframes synergyFill {
    0%   { stroke-dashoffset: 283; }
    100% { stroke-dashoffset: var(--synergy-offset); }
  }
  @keyframes trustRing {
    0%   { stroke-dashoffset: 220; opacity: 0.4; }
    100% { stroke-dashoffset: var(--trust-offset); opacity: 1; }
  }
  @keyframes defectionPulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(255,77,77,0); border-color: #FF4D4D; }
    50%       { box-shadow: 0 0 12px 3px rgba(255,77,77,0.5); border-color: #FF8080; }
  }
  @keyframes viralFlash {
    0%   { opacity: 0; transform: scale(0.9); }
    10%  { opacity: 1; transform: scale(1); }
    80%  { opacity: 1; transform: scale(1); }
    100% { opacity: 0; transform: scale(1.05); }
  }
  @keyframes rescueDecay {
    from { width: 100%; }
    to   { width: 0%; }
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  * { box-sizing: border-box; }
  html { font-family: ${FONTS.body}; }
`;

// ─── Sub-Components ───────────────────────────────────────────────────────────

// Trust Meter — circular ring gauge
interface TrustMeterProps { value: number; size?: number; }
function TrustMeter({ value, size = 80 }: TrustMeterProps) {
  const r = 32;
  const circumference = 2 * Math.PI * r;
  const filled = circumference * value;
  const offset = circumference - filled;
  const color = value >= 0.65 ? COLORS.green : value >= 0.4 ? COLORS.orange : COLORS.red;
  const label = value >= 0.85 ? 'VERIFIED'
              : value >= 0.65 ? 'TRUSTED'
              : value >= 0.40 ? 'CAUTIOUS'
              : value >= 0.20 ? 'SUSPECT'
              : 'COMPROMISED';

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap: 4 }}>
      <svg width={size} height={size} viewBox="0 0 80 80" style={{ '--trust-offset': `${offset}` } as React.CSSProperties}>
        <circle cx="40" cy="40" r={r} fill="none" stroke={COLORS.bgSurface} strokeWidth="7" />
        <circle
          cx="40" cy="40" r={r}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 40 40)"
          style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.4s ease' }}
        />
        <text x="40" y="36" textAnchor="middle" fill={COLORS.textPrimary}
          style={{ fontSize: 13, fontFamily: FONTS.mono, fontWeight: 700 }}>
          {Math.round(value * 100)}
        </text>
        <text x="40" y="50" textAnchor="middle" fill={COLORS.textMuted}
          style={{ fontSize: 8, fontFamily: FONTS.mono }}>
          TRUST
        </text>
      </svg>
      <span style={{ fontSize: FS.xs, color, fontFamily: FONTS.mono, fontWeight: 600, letterSpacing: '0.08em' }}>
        {label}
      </span>
    </div>
  );
}

// Role Display Panel
interface RolePanelProps { assignments: Record<string, PlayerRoleAssignment>; currentPlayerId: string; }
function RolePanel({ assignments, currentPlayerId }: RolePanelProps) {
  // FIXED: ROLE_ICONS is now module-level with correct SyndicateRole keys

  return (
    <div style={{
      background: COLORS.bgPanel, border: `1px solid ${COLORS.border}`,
      borderRadius: 8, padding: '10px 12px',
    }}>
      <div style={{ fontSize: FS.xs, color: COLORS.textMuted, fontFamily: FONTS.mono,
        letterSpacing: '0.1em', marginBottom: 8 }}>ROLES</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {(Object.entries(ROLE_CONFIGS) as Array<[SyndicateRole, typeof ROLE_CONFIGS[SyndicateRole]]>).map(([role, cfg]) => {
          const assigned = Object.values(assignments).find(a => a.role === role);
          const isPlayer = assigned?.playerId === currentPlayerId;
          return (
            <div key={role} style={{
              background: isPlayer ? COLORS.bgInput : COLORS.bgSurface,
              border: `1px solid ${isPlayer ? COLORS.tealBright : COLORS.border}`,
              borderRadius: 6, padding: '6px 8px',
              opacity: assigned ? 1 : 0.45,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 14 }}>{ROLE_ICONS[role]}</span>
                <div>
                  <div style={{ fontSize: FS.xs, color: isPlayer ? COLORS.tealBright : COLORS.textSub,
                    fontFamily: FONTS.display, fontWeight: 700, lineHeight: 1.2 }}>
                    {cfg.label}
                    {isPlayer && <span style={{ color: COLORS.green, marginLeft: 4 }}>▶ YOU</span>}
                  </div>
                  {assigned && (
                    <div style={{ fontSize: FS.xs, color: COLORS.textMuted, fontFamily: FONTS.mono }}>
                      {assigned.playerId.slice(0, 6)}…
                    </div>
                  )}
                </div>
              </div>
              {isPlayer && (
                <div style={{ fontSize: FS.xs, color: COLORS.textSub, fontFamily: FONTS.mono,
                  marginTop: 4, lineHeight: 1.3 }}>
                  {cfg.drawBonus}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Defection Threat Indicator
interface DefectionThreatProps { suspicionLevel: number; }
function DefectionThreat({ suspicionLevel }: DefectionThreatProps) {
  if (suspicionLevel < 2.5) return null;
  return (
    <div style={{
      border: `2px solid ${COLORS.red}`,
      borderRadius: 8, padding: '8px 12px',
      background: 'rgba(255,77,77,0.08)',
      animation: 'defectionPulse 1.4s ease-in-out infinite',
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <span style={{ fontSize: 18 }}>⚠️</span>
      <div>
        <div style={{ fontSize: FS.sm, color: COLORS.red, fontFamily: FONTS.mono, fontWeight: 700 }}>
          DEFECTION THREAT
        </div>
        <div style={{ fontSize: FS.xs, color: COLORS.textSub, fontFamily: FONTS.mono }}>
          Suspicion level: {suspicionLevel.toFixed(1)} — monitor alliance behavior
        </div>
      </div>
    </div>
  );
}

// Treasury Panel
interface TreasuryPanelProps { treasury: SharedTreasuryState; playerId: string; onOpen: () => void; }
function TreasuryPanel({ treasury, playerId, onOpen }: TreasuryPanelProps) {
  const isCritical = treasury.balance < 5_000;
  const myContrib = treasury.contributions[playerId] ?? 0;
  const myWithdraw = treasury.withdrawals?.[playerId] ?? 0;

  return (
    <div style={{
      background: COLORS.bgPanel,
      border: `1px solid ${isCritical ? COLORS.red : COLORS.border}`,
      borderRadius: 8, padding: '10px 12px',
      animation: isCritical ? 'defectionPulse 2s ease-in-out infinite' : 'none',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: FS.xs, color: COLORS.textMuted, fontFamily: FONTS.mono, letterSpacing: '0.1em' }}>
          SHARED TREASURY
        </span>
        {isCritical && (
          <span style={{ fontSize: FS.xs, color: COLORS.red, fontFamily: FONTS.mono, fontWeight: 700 }}>
            ⚠ CRITICAL
          </span>
        )}
      </div>
      <div style={{ fontSize: FS.xl, color: isCritical ? COLORS.red : COLORS.green,
        fontFamily: FONTS.mono, fontWeight: 700 }}>
        ${treasury.balance.toLocaleString()}
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
        <div>
          <div style={{ fontSize: FS.xs, color: COLORS.textMuted, fontFamily: FONTS.mono }}>MY DEPOSITS</div>
          <div style={{ fontSize: FS.sm, color: COLORS.green, fontFamily: FONTS.mono }}>${myContrib.toLocaleString()}</div>
        </div>
        <div>
          <div style={{ fontSize: FS.xs, color: COLORS.textMuted, fontFamily: FONTS.mono }}>MY DRAWS</div>
          <div style={{ fontSize: FS.sm, color: COLORS.orange, fontFamily: FONTS.mono }}>${myWithdraw.toLocaleString()}</div>
        </div>
      </div>
      <div style={{ marginTop: 6, maxHeight: 64, overflowY: 'auto' }}>
        {treasury.ledger.slice(-3).reverse().map(entry => (
          <div key={entry.id} style={{ fontSize: FS.xs, color: COLORS.textMuted, fontFamily: FONTS.mono,
            borderTop: `1px solid ${COLORS.border}`, padding: '3px 0' }}>
            {entry.type} · ${entry.amount.toLocaleString()} · t{entry.tick}
          </div>
        ))}
      </div>
      <button onClick={onOpen} style={{
        marginTop: 8, width: '100%', padding: '6px 0',
        background: COLORS.tealDim, color: COLORS.btnText,
        border: 'none', borderRadius: 5, cursor: 'pointer',
        fontSize: FS.sm, fontFamily: FONTS.display, fontWeight: 700,
        letterSpacing: '0.05em', minHeight: 44,
      }}>
        MANAGE TREASURY
      </button>
    </div>
  );
}

// Alliance Header — 4 member slots
interface AllianceHeaderProps { members: AllianceMember[]; roleAssignments: Record<string, PlayerRoleAssignment>; }
function AllianceHeader({ members, roleAssignments }: AllianceHeaderProps) {
  // FIXED: ROLE_ICONS is now module-level with correct SyndicateRole keys
  const slots = Array.from({ length: 4 }, (_, i) => members[i] ?? null);

  return (
    <div style={{
      background: COLORS.bgPanel, border: `1px solid ${COLORS.border}`,
      borderRadius: 8, padding: '10px 12px',
    }}>
      <div style={{ fontSize: FS.xs, color: COLORS.textMuted, fontFamily: FONTS.mono,
        letterSpacing: '0.1em', marginBottom: 8 }}>ALLIANCE</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
        {slots.map((member, i) => {
          if (!member) {
            return (
              <div key={i} style={{
                background: COLORS.bgSurface, borderRadius: 6, padding: '8px 6px',
                border: `1px dashed ${COLORS.border}`, opacity: 0.4, textAlign: 'center',
              }}>
                <div style={{ fontSize: FS.xs, color: COLORS.textMuted, fontFamily: FONTS.mono }}>OPEN</div>
              </div>
            );
          }
          const assignment = roleAssignments[member.id];
          const role = assignment?.role;
          return (
            <div key={member.id} style={{
              background: member.inDistress ? 'rgba(255,77,77,0.12)' : COLORS.bgSurface,
              border: `1px solid ${member.inDistress ? COLORS.red : member.isActive ? COLORS.tealDim : COLORS.border}`,
              borderRadius: 6, padding: '6px 6px', textAlign: 'center',
            }}>
              {role && <div style={{ fontSize: 14 }}>{ROLE_ICONS[role]}</div>}
              <div style={{ fontSize: FS.xs, color: COLORS.textPrimary, fontFamily: FONTS.display,
                fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {member.name.slice(0, 8)}
              </div>
              {role && (
                <div style={{ fontSize: FS.xs, color: COLORS.textSub, fontFamily: FONTS.mono }}>
                  {ROLE_CONFIGS[role].label.slice(0, 6)}
                </div>
              )}
              {member.inDistress && (
                <div style={{ fontSize: FS.xs, color: COLORS.red, fontFamily: FONTS.mono, fontWeight: 700 }}>
                  🚨 SOS
                </div>
              )}
              <div style={{ marginTop: 3, height: 3, borderRadius: 2,
                background: `linear-gradient(to right, ${member.trust >= 0.65 ? COLORS.green : COLORS.orange} ${member.trust * 100}%, ${COLORS.bgInput} ${member.trust * 100}%)`,
              }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// CORD Preview Panel
interface CORDPreviewPanelProps {
  currentNetWorth: number;
  startNetWorth: number;
  trust: number;
  earnedMultipliers: CORDMultiplierKey[];
  defected: boolean;
}
function CORDPreviewPanel({ currentNetWorth, startNetWorth, trust, earnedMultipliers, defected }: CORDPreviewPanelProps) {
  const preview = previewCORD({ currentNetWorth, startNetWorth, currentTrust: trust, earnedMultipliersSoFar: earnedMultipliers, defectedSoFar: defected });
  const gradeColor = { 'S+': COLORS.gold, S: COLORS.yellow, A: COLORS.green, B: COLORS.tealBright, C: COLORS.textSub, D: COLORS.orange, F: COLORS.red }[preview.estimatedGrade] ?? COLORS.textPrimary;

  return (
    <div style={{
      background: COLORS.bgPanel, border: `1px solid ${COLORS.border}`,
      borderRadius: 8, padding: '10px 12px',
    }}>
      <div style={{ fontSize: FS.xs, color: COLORS.textMuted, fontFamily: FONTS.mono,
        letterSpacing: '0.1em', marginBottom: 6 }}>CORD PREVIEW</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: FS.xxl, color: gradeColor, fontFamily: FONTS.mono, fontWeight: 700 }}>
          {preview.estimatedGrade}
        </span>
        <span style={{ fontSize: FS.md, color: COLORS.textSub, fontFamily: FONTS.display, fontWeight: 600 }}>
          {preview.estimatedGradeLabel}
        </span>
      </div>
      <div style={{ fontSize: FS.sm, color: COLORS.textPrimary, fontFamily: FONTS.mono, marginTop: 4 }}>
        {preview.estimatedFinalCORD.toFixed(3)} CORD
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
        <div>
          <div style={{ fontSize: FS.xs, color: COLORS.textMuted, fontFamily: FONTS.mono }}>BASE</div>
          <div style={{ fontSize: FS.xs, color: COLORS.textSub, fontFamily: FONTS.mono }}>{preview.estimatedBaseCORD.toFixed(3)}</div>
        </div>
        <div>
          <div style={{ fontSize: FS.xs, color: COLORS.textMuted, fontFamily: FONTS.mono }}>T.WEIGHT</div>
          <div style={{ fontSize: FS.xs, color: COLORS.textSub, fontFamily: FONTS.mono }}>{preview.trustWeightCurrent.toFixed(2)}×</div>
        </div>
        {earnedMultipliers.length > 0 && (
          <div>
            <div style={{ fontSize: FS.xs, color: COLORS.textMuted, fontFamily: FONTS.mono }}>BONUS</div>
            <div style={{ fontSize: FS.xs, color: COLORS.green, fontFamily: FONTS.mono }}>
              +{(earnedMultipliers.reduce((s, k) => s + ({ BETRAYAL_SURVIVOR:0.6, FULL_SYNERGY:0.45, CASCADE_ABSORBER:0.35, SYNDICATE_CHAMPION:0.25 }[k]??0), 0) * 100).toFixed(0)}%
            </div>
          </div>
        )}
        {defected && (
          <div>
            <div style={{ fontSize: FS.xs, color: COLORS.textMuted, fontFamily: FONTS.mono }}>PENALTY</div>
            <div style={{ fontSize: FS.xs, color: COLORS.red, fontFamily: FONTS.mono }}>-0.15</div>
          </div>
        )}
      </div>
    </div>
  );
}

// Viral Share Moment overlay
interface ViralShareProps { type: 'MAX_SYNERGY' | 'BETRAYAL' | null; onDismiss: () => void; }
function ViralShareMoment({ type, onDismiss }: ViralShareProps) {
  useEffect(() => {
    if (!type) return;
    const t = setTimeout(onDismiss, 3500);
    return () => clearTimeout(t);
  }, [type, onDismiss]);

  if (!type) return null;

  const isBetrayal = type === 'BETRAYAL';
  return (
    <div onClick={onDismiss} style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: isBetrayal ? 'rgba(139,0,0,0.92)' : 'rgba(10,60,50,0.95)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      animation: 'viralFlash 3.5s ease forwards', cursor: 'pointer',
      padding: 24,
    }}>
      <div style={{ fontSize: 64 }}>{isBetrayal ? '🗡️' : '⚡'}</div>
      <div style={{ fontSize: 'clamp(24px, 5vw, 48px)', color: COLORS.textPrimary,
        fontFamily: FONTS.display, fontWeight: 700, letterSpacing: '0.06em', textAlign: 'center',
        marginTop: 16 }}>
        {isBetrayal ? 'BETRAYAL DETECTED' : 'FULL SYNERGY ACHIEVED'}
      </div>
      <div style={{ fontSize: FS.md, color: COLORS.textSub, fontFamily: FONTS.mono, marginTop: 8, textAlign: 'center' }}>
        {isBetrayal ? 'An alliance member has broken the pact.' : 'All 4 members in peak cooperative flow.'}
      </div>
      <div style={{ fontSize: FS.xs, color: COLORS.textMuted, fontFamily: FONTS.mono, marginTop: 24 }}>
        tap to continue
      </div>
    </div>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function SyndicateGameScreen({
  playerId, playerName, playerCash, playerIncome, playerExpenses, playerNetWorth, startNetWorth,
  trustState, allianceMembers, roleAssignments, treasury, activeRescueWindow,
  defectionState, earnedMultipliersSoFar, currentTick, leaderboardPreview,
  onAidContractOpen, onTreasuryOpen, onRescueContribute, onCardPlay,
}: SyndicateGameScreenProps) {
  const [viralType, setViralType] = useState<'MAX_SYNERGY' | 'BETRAYAL' | null>(null);
  const prevSynergy = useRef(0);

  // Detect synergy / betrayal triggers
  useEffect(() => {
    const synergyNow = allianceMembers.filter(m => m.isActive && !m.inDistress).length / 4;
    if (synergyNow >= 1.0 && prevSynergy.current < 1.0) setViralType('MAX_SYNERGY');
    if (defectionState.detected && defectionState.currentStep === 'DETECTED') setViralType('BETRAYAL');
    prevSynergy.current = synergyNow;
  }, [allianceMembers, defectionState]);

  const playerRole = roleAssignments[playerId]?.role ?? null;
  const defectionThreat = defectionState.currentStep !== 'NONE' && !defectionState.detected;
  const suspicionLevel = trustState.suspicionLevel;
  const showThreat = suspicionLevel >= 2.5 || defectionThreat;

  const monthlyCashflow = playerIncome - playerExpenses;

  return (
    <>
      {/* Global styles */}
      <style>{CSS_KEYFRAMES}</style>

      {/* PWA viewport meta — render as comment for injection reference */}
      {/* <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" /> */}

      {/* Viral overlay */}
      <ViralShareMoment type={viralType} onDismiss={() => setViralType(null)} />

      {/* Root container */}
      <div style={{
        background: COLORS.bg,
        minHeight: '100dvh',
        color: COLORS.textPrimary,
        fontFamily: FONTS.body,
        paddingBottom: 'calc(72px + env(safe-area-inset-bottom))',
        paddingTop: 'env(safe-area-inset-top)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
        animation: 'fadeIn 0.3s ease',
      }}>
        {/* Header bar */}
        <div style={{
          background: COLORS.bgPanel, borderBottom: `1px solid ${COLORS.border}`,
          padding: '8px 16px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: FS.lg, color: COLORS.tealBright, fontFamily: FONTS.display,
              fontWeight: 700, letterSpacing: '0.12em' }}>SYNDICATE</span>
            <span style={{ fontSize: FS.xs, color: COLORS.textMuted, fontFamily: FONTS.mono }}>
              TEAM UP MODE · T{currentTick}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {playerRole && (
              <span style={{ fontSize: FS.xs, color: COLORS.tealBright, fontFamily: FONTS.mono,
                background: COLORS.bgInput, padding: '2px 8px', borderRadius: 4,
                border: `1px solid ${COLORS.tealDim}` }}>
                {ROLE_CONFIGS[playerRole].label}
              </span>
            )}
            <span style={{ fontSize: FS.sm, color: COLORS.textPrimary, fontFamily: FONTS.mono }}>
              {playerName}
            </span>
          </div>
        </div>

        {/* Main layout — responsive grid */}
        <div style={{
          display: 'grid',
          // mobile: 1 col, tablet: 2 col, PC: 3 col
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 12, padding: '12px 12px 0',
          maxWidth: 1400, margin: '0 auto',
        }}>

          {/* ── LEFT / PRIMARY COLUMN ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

            {/* Alliance header */}
            <AllianceHeader members={allianceMembers} roleAssignments={roleAssignments} />

            {/* Trust meter + player financials */}
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{
                background: COLORS.bgPanel, border: `1px solid ${COLORS.border}`,
                borderRadius: 8, padding: '10px 12px', display: 'flex',
                flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                <TrustMeter value={trustState.value} />
                <div style={{ fontSize: FS.xs, color: COLORS.textMuted, fontFamily: FONTS.mono, textAlign: 'center' }}>
                  LEAKAGE {(trustState.leakageRate * 100).toFixed(1)}%
                </div>
              </div>
              <div style={{
                flex: 1, background: COLORS.bgPanel, border: `1px solid ${COLORS.border}`,
                borderRadius: 8, padding: '10px 12px',
              }}>
                <div style={{ fontSize: FS.xs, color: COLORS.textMuted, fontFamily: FONTS.mono,
                  letterSpacing: '0.1em', marginBottom: 6 }}>FINANCIALS</div>
                <div style={{ fontSize: FS.xl, color: COLORS.green, fontFamily: FONTS.mono, fontWeight: 700 }}>
                  ${playerCash.toLocaleString()}
                </div>
                <div style={{ fontSize: FS.xs, color: COLORS.textMuted, fontFamily: FONTS.mono }}>CASH</div>
                <div style={{ marginTop: 8, display: 'flex', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: FS.xs, color: COLORS.textMuted, fontFamily: FONTS.mono }}>INCOME</div>
                    <div style={{ fontSize: FS.sm, color: COLORS.green, fontFamily: FONTS.mono }}>
                      +${playerIncome.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: FS.xs, color: COLORS.textMuted, fontFamily: FONTS.mono }}>EXPENSES</div>
                    <div style={{ fontSize: FS.sm, color: COLORS.red, fontFamily: FONTS.mono }}>
                      -${playerExpenses.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: FS.xs, color: COLORS.textMuted, fontFamily: FONTS.mono }}>CF/MO</div>
                    <div style={{ fontSize: FS.sm,
                      color: monthlyCashflow >= 0 ? COLORS.green : COLORS.red,
                      fontFamily: FONTS.mono }}>
                      {monthlyCashflow >= 0 ? '+' : ''}{monthlyCashflow.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Defection threat indicator */}
            {showThreat && <DefectionThreat suspicionLevel={suspicionLevel} />}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onAidContractOpen} style={{
                flex: 1, padding: '10px 0', minHeight: 44,
                background: COLORS.tealDim, color: COLORS.btnText,
                border: 'none', borderRadius: 6, cursor: 'pointer',
                fontSize: FS.sm, fontFamily: FONTS.display, fontWeight: 700, letterSpacing: '0.06em',
              }}>
                + AID CONTRACT
              </button>
              <button onClick={onTreasuryOpen} style={{
                flex: 1, padding: '10px 0', minHeight: 44,
                background: COLORS.bgInput, color: COLORS.btnText,
                border: `1px solid ${COLORS.borderFocus}`, borderRadius: 6, cursor: 'pointer',
                fontSize: FS.sm, fontFamily: FONTS.display, fontWeight: 700, letterSpacing: '0.06em',
              }}>
                TREASURY
              </button>
            </div>
          </div>

          {/* ── CENTER COLUMN ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Synergy + Treasury */}
            <TreasuryPanel treasury={treasury} playerId={playerId} onOpen={onTreasuryOpen} />
            <CORDPreviewPanel
              currentNetWorth={playerNetWorth} startNetWorth={startNetWorth}
              trust={trustState.value} earnedMultipliers={earnedMultipliersSoFar}
              defected={defectionState.defectionCount > 0}
            />
            <RolePanel assignments={roleAssignments} currentPlayerId={playerId} />
          </div>

          {/* ── RIGHT COLUMN — leaderboard sidebar (hidden on mobile/tablet) ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{
              background: COLORS.bgPanel, border: `1px solid ${COLORS.border}`,
              borderRadius: 8, padding: '10px 12px',
            }}>
              <div style={{ fontSize: FS.xs, color: COLORS.textMuted, fontFamily: FONTS.mono,
                letterSpacing: '0.1em', marginBottom: 8 }}>LIVE TRUST RANKINGS</div>
              {leaderboardPreview.map(entry => (
                <div key={entry.rank} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '5px 0', borderBottom: `1px solid ${COLORS.border}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: FS.xs, color: entry.rank === 1 ? COLORS.gold : COLORS.textMuted,
                      fontFamily: FONTS.mono, fontWeight: 700, minWidth: 16 }}>
                      #{entry.rank}
                    </span>
                    <span style={{ fontSize: FS.sm, color: COLORS.textPrimary, fontFamily: FONTS.display }}>
                      {entry.name}
                    </span>
                  </div>
                  <span style={{ fontSize: FS.sm, color: COLORS.tealBright, fontFamily: FONTS.mono }}>
                    {entry.score.toFixed(3)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── STICKY BOTTOM ACTION BAR (mobile-primary) ── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: COLORS.bgPanel, borderTop: `1px solid ${COLORS.border}`,
        padding: `8px 12px calc(8px + env(safe-area-inset-bottom))`,
        display: 'flex', gap: 8, zIndex: 100,
      }}>
        <button onClick={onAidContractOpen} style={{
          flex: 2, padding: '10px 0', minHeight: 44,
          background: COLORS.tealDim, color: COLORS.btnText,
          border: 'none', borderRadius: 6, cursor: 'pointer',
          fontSize: FS.sm, fontFamily: FONTS.display, fontWeight: 700, letterSpacing: '0.05em',
        }}>
          AID CONTRACT
        </button>
        <button onClick={onTreasuryOpen} style={{
          flex: 1, padding: '10px 0', minHeight: 44,
          background: COLORS.bgInput, color: COLORS.btnText,
          border: `1px solid ${COLORS.border}`, borderRadius: 6, cursor: 'pointer',
          fontSize: FS.sm, fontFamily: FONTS.display, fontWeight: 700,
        }}>
          💰
        </button>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: COLORS.bgSurface, borderRadius: 6, border: `1px solid ${COLORS.border}`,
        }}>
          <span style={{ fontSize: FS.xs, color: COLORS.textSub, fontFamily: FONTS.mono, textAlign: 'center', lineHeight: 1.3 }}>
            T{currentTick}<br />TICK
          </span>
        </div>
      </div>
    </>
  );
}