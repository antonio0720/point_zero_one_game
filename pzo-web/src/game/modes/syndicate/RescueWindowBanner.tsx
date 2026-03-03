// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/syndicate/RescueWindowBanner.tsx
// Sprint 5 — Rescue Window Banner (UPDATED)
//
// Changes from prior version:
//   • Rescue effectiveness decay bar (1.0× → 0.4× over window duration)
//   • Treasury auto-fund button ("USE TREASURY")
//   • SHIELD_ARCHITECT role indicator if GUARDIAN role player is present
//   • Mobile: full-width overlay on small screens
//   • Animation: pulsing red border during last 5 ticks
// ═══════════════════════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useState } from 'react';

import type { RescueWindow } from './rescueWindowEngine';
import type { SharedTreasuryState } from './sharedTreasuryEngine';

// ─── Design Tokens ────────────────────────────────────────────────────────────

const C = {
  bg:          '#0A1F1C',
  bgPanel:     '#0F2A26',
  bgSurface:   '#152F2B',
  bgInput:     '#1A3530',
  border:      '#1E4038',
  borderFocus: '#2E8B7A',
  textPrimary: '#E8F5F2',
  textSub:     '#9DD4CC',
  textMuted:   '#3D6B62',
  tealBright:  '#2EC4B6',
  tealDim:     '#1A7A70',
  green:       '#22D17A',
  red:         '#FF4D4D',
  redDim:      '#8B1A1A',
  orange:      '#FF8C00',
  btnText:     '#FFFFFF',
} as const;

const F = {
  mono:    "'JetBrains Mono', 'Fira Code', monospace",
  display: "'Barlow Condensed', 'Arial Narrow', sans-serif",
} as const;

const FS = {
  xs: 'clamp(9px, 1.2vw, 11px)',
  sm: 'clamp(10px, 1.4vw, 12px)',
  md: 'clamp(11px, 1.6vw, 14px)',
  lg: 'clamp(13px, 1.9vw, 17px)',
  xl: 'clamp(16px, 2.4vw, 22px)',
} as const;

const DECAY_KEYFRAMES = `
  @keyframes rescuePulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(255,77,77,0); border-color: #FF4D4D; }
    50%       { box-shadow: 0 0 16px 4px rgba(255,77,77,0.45); border-color: #FF8080; }
  }
  @keyframes progressShrink {
    from { width: 100%; }
    to   { width: 0%; }
  }
`;

// ─── Effectiveness Decay ──────────────────────────────────────────────────────

/**
 * Rescue effectiveness decays linearly from 1.0× at open to 0.4× at expiry.
 * ticksRemaining / windowDuration → [0, 1] → lerp(0.4, 1.0)
 */
function computeEffectiveness(ticksRemaining: number, windowDuration: number): number {
  const safeDuration = Math.max(1, windowDuration);
  const ratio = Math.max(0, Math.min(1, ticksRemaining / safeDuration));
  return parseFloat((0.4 + ratio * 0.6).toFixed(2));
}

function effectivenessColor(value: number): string {
  if (value >= 0.8) return C.green;
  if (value >= 0.6) return C.tealBright;
  if (value >= 0.4) return C.orange;
  return C.red;
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface RescueWindowBannerProps {
  window: RescueWindow;
  currentTick: number;
  playerCash: number;
  treasury: SharedTreasuryState;
  /** True if current player has the GUARDIAN (SHIELD_ARCHITECT) role */
  isGuardian: boolean;
  allianceMemberNames: Record<string, string>;
  onContribute: (windowId: string, amount: number, fromTreasury: boolean) => void;
  onDismiss?: (windowId: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RescueWindowBanner({
  window: rescueWindow,
  currentTick,
  playerCash,
  treasury,
  isGuardian,
  allianceMemberNames,
  onContribute,
  onDismiss,
}: RescueWindowBannerProps) {
  // If rescueWindowEngine hasn't been updated yet, allow optional guardianAmplified without breaking TS.
  const guardianAmplified = Boolean((rescueWindow as RescueWindow & { guardianAmplified?: boolean }).guardianAmplified);

  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 480;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => setIsMobile(window.innerWidth < 480);
    window.addEventListener('resize', onResize, { passive: true });
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const remaining = rescueWindow.contributionRequired - rescueWindow.totalContributed;

  const [customAmount, setCustomAmount] = useState<number>(() => {
    const maxAffordable = Math.min(playerCash, Math.max(0, remaining));
    return Math.max(0, maxAffordable);
  });

  useEffect(() => {
    const maxAffordable = Math.min(playerCash, Math.max(0, remaining));
    setCustomAmount(prev => Math.min(Math.max(0, prev), maxAffordable));
  }, [playerCash, remaining]);

  const ticksRemaining = Math.max(0, rescueWindow.expiresAtTick - currentTick);
  const windowDuration = rescueWindow.expiresAtTick - rescueWindow.openedAtTick;

  const effectiveness = useMemo(
    () => computeEffectiveness(ticksRemaining, windowDuration),
    [ticksRemaining, windowDuration],
  );

  const progressPct = useMemo(() => {
    const safeDuration = Math.max(1, windowDuration);
    return Math.max(0, (ticksRemaining / safeDuration) * 100);
  }, [ticksRemaining, windowDuration]);

  const isLastFiveTicks = ticksRemaining <= 5 && ticksRemaining > 0;
  const isExpired =
    ticksRemaining === 0 || rescueWindow.status === 'EXPIRED' || rescueWindow.status === 'FAILED';
  const isFunded = rescueWindow.status === 'FUNDED';
  const isDismissed = rescueWindow.status === 'DISMISSED';

  const fundedPct =
    rescueWindow.totalContributed / Math.max(1, rescueWindow.contributionRequired);

  const recipientName =
    allianceMemberNames[rescueWindow.recipientId] ?? rescueWindow.recipientId;

  const canTreasuryFund = treasury.balance >= remaining;

  if (isDismissed || (isExpired && !isFunded)) return null;

  const containerStyle: React.CSSProperties = {
    background: isFunded ? 'rgba(34,209,122,0.08)' : C.bgPanel,
    border: `2px solid ${isFunded ? C.green : isLastFiveTicks ? C.red : C.border}`,
    borderRadius: isMobile ? 0 : 10,
    padding: isMobile ? '14px 12px calc(14px + env(safe-area-inset-bottom))' : '14px 16px',
    width: '100%',
    animation: isLastFiveTicks && !isFunded ? 'rescuePulse 1s ease-in-out infinite' : 'none',
    position: isMobile ? 'fixed' : 'relative',
    bottom: isMobile ? 0 : 'auto',
    left: isMobile ? 0 : 'auto',
    right: isMobile ? 0 : 'auto',
    zIndex: isMobile ? 200 : 'auto',
  };

  const maxInput = Math.min(playerCash, Math.max(0, remaining));

  return (
    <>
      <style>{DECAY_KEYFRAMES}</style>
      <div style={containerStyle}>
        {/* Header row */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>
              {isFunded ? '✅' : isLastFiveTicks ? '🚨' : '🆘'}
            </span>
            <div>
              <div
                style={{
                  fontSize: FS.lg,
                  color: isFunded ? C.green : C.textPrimary,
                  fontFamily: F.display,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                }}
              >
                {isFunded ? 'RESCUE FUNDED' : 'RESCUE WINDOW OPEN'}
              </div>
              <div style={{ fontSize: FS.xs, color: C.textSub, fontFamily: F.mono }}>
                {recipientName} needs help · ID {rescueWindow.id.slice(-8)}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* GUARDIAN indicator */}
            {isGuardian && (
              <span
                style={{
                  fontSize: FS.xs,
                  color: C.tealBright,
                  fontFamily: F.mono,
                  background: C.bgInput,
                  padding: '2px 8px',
                  borderRadius: 4,
                  border: `1px solid ${C.tealDim}`,
                  whiteSpace: 'nowrap',
                }}
              >
                🛡 SHIELD_ARCHITECT
              </span>
            )}

            {/* Optional guardian amplification badge (engine may or may not expose this yet) */}
            {guardianAmplified && (
              <span
                style={{
                  fontSize: FS.xs,
                  color: C.green,
                  fontFamily: F.mono,
                  background: 'rgba(34,209,122,0.12)',
                  padding: '2px 8px',
                  borderRadius: 4,
                }}
              >
                +20% GUARDIAN
              </span>
            )}

            {/* Dismiss */}
            {!isFunded && onDismiss && (
              <button
                onClick={() => onDismiss(rescueWindow.id)}
                style={{
                  background: 'none',
                  border: `1px solid ${C.border}`,
                  color: C.textMuted,
                  borderRadius: 4,
                  padding: '2px 8px',
                  cursor: 'pointer',
                  fontSize: FS.xs,
                  fontFamily: F.mono,
                  minHeight: 30,
                }}
              >
                dismiss
              </button>
            )}
          </div>
        </div>

        {/* Effectiveness decay bar */}
        {!isFunded && (
          <div style={{ marginBottom: 10 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 4,
              }}
            >
              <span style={{ fontSize: FS.xs, color: C.textMuted, fontFamily: F.mono }}>
                RESCUE EFFECTIVENESS
              </span>
              <span
                style={{
                  fontSize: FS.xs,
                  color: effectivenessColor(effectiveness),
                  fontFamily: F.mono,
                  fontWeight: 700,
                }}
              >
                {effectiveness.toFixed(2)}×
                <span style={{ color: C.textMuted, fontWeight: 400, marginLeft: 6 }}>
                  ({ticksRemaining} ticks left)
                </span>
              </span>
            </div>

            <div style={{ height: 6, background: C.bgInput, borderRadius: 3, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${progressPct}%`,
                  background: effectivenessColor(effectiveness),
                  borderRadius: 3,
                  transition: 'width 1s linear, background 0.4s ease',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
              <span style={{ fontSize: FS.xs, color: C.textMuted, fontFamily: F.mono }}>
                1.0×
              </span>
              <span style={{ fontSize: FS.xs, color: C.textMuted, fontFamily: F.mono }}>
                0.4×
              </span>
            </div>
          </div>
        )}

        {/* Funding progress */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: FS.xs, color: C.textMuted, fontFamily: F.mono }}>
              FUNDING PROGRESS
            </span>
            <span style={{ fontSize: FS.xs, color: C.textPrimary, fontFamily: F.mono }}>
              ${rescueWindow.totalContributed.toLocaleString()} / $
              {rescueWindow.contributionRequired.toLocaleString()}
            </span>
          </div>
          <div style={{ height: 8, background: C.bgInput, borderRadius: 4, overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${fundedPct * 100}%`,
                background: fundedPct >= 1 ? C.green : C.tealBright,
                borderRadius: 4,
                transition: 'width 0.5s ease',
              }}
            />
          </div>
          {remaining > 0 && !isFunded && (
            <div style={{ fontSize: FS.xs, color: C.orange, fontFamily: F.mono, marginTop: 4 }}>
              Still needed: ${remaining.toLocaleString()}
            </div>
          )}
        </div>

        {/* Action row */}
        {!isFunded && !isExpired && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              type="number"
              min={0}
              max={maxInput}
              step={500}
              value={customAmount}
              onChange={e => setCustomAmount(Math.max(0, parseInt(e.target.value) || 0))}
              style={{
                flex: 1,
                minWidth: 100,
                background: C.bgInput,
                color: C.textPrimary,
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                padding: '8px 10px',
                fontFamily: F.mono,
                fontSize: FS.sm,
                minHeight: 44,
              }}
            />

            <button
              disabled={customAmount <= 0 || customAmount > playerCash}
              onClick={() => onContribute(rescueWindow.id, customAmount, false)}
              style={{
                flex: 2,
                minHeight: 44,
                padding: '0 12px',
                background:
                  customAmount > 0 && customAmount <= playerCash ? C.tealDim : C.bgSurface,
                color: C.btnText,
                border: `1px solid ${
                  customAmount > 0 && customAmount <= playerCash ? C.borderFocus : C.border
                }`,
                borderRadius: 6,
                cursor:
                  customAmount > 0 && customAmount <= playerCash ? 'pointer' : 'not-allowed',
                fontSize: FS.sm,
                fontFamily: F.display,
                fontWeight: 700,
                letterSpacing: '0.05em',
              }}
            >
              CONTRIBUTE ${customAmount.toLocaleString()}
            </button>

            <button
              disabled={!canTreasuryFund}
              onClick={() => onContribute(rescueWindow.id, remaining, true)}
              title={
                canTreasuryFund
                  ? `Fund $${remaining.toLocaleString()} from shared treasury`
                  : `Treasury has insufficient funds ($${treasury.balance.toLocaleString()})`
              }
              style={{
                minHeight: 44,
                padding: '0 12px',
                background: canTreasuryFund ? 'rgba(34,209,122,0.15)' : C.bgSurface,
                color: canTreasuryFund ? C.green : C.textMuted,
                border: `1px solid ${canTreasuryFund ? C.green : C.border}`,
                borderRadius: 6,
                cursor: canTreasuryFund ? 'pointer' : 'not-allowed',
                fontSize: FS.sm,
                fontFamily: F.display,
                fontWeight: 700,
                letterSpacing: '0.05em',
                whiteSpace: 'nowrap',
              }}
            >
              💰 USE TREASURY
            </button>
          </div>
        )}

        {/* Contributions list */}
        {rescueWindow.contributions.length > 0 && (
          <div style={{ marginTop: 10, borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
            <div
              style={{
                fontSize: FS.xs,
                color: C.textMuted,
                fontFamily: F.mono,
                letterSpacing: '0.1em',
                marginBottom: 6,
              }}
            >
              CONTRIBUTIONS
            </div>
            {rescueWindow.contributions.map((c, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: FS.xs,
                  color: C.textSub,
                  fontFamily: F.mono,
                  padding: '2px 0',
                }}
              >
                <span>
                  {allianceMemberNames[c.playerId] ?? c.playerId.slice(0, 8)}
                  {c.fromTreasury && <span style={{ color: C.tealBright, marginLeft: 4 }}>🏦 TREASURY</span>}
                </span>
                <span style={{ color: C.green }}>${c.amount.toLocaleString()} · T{c.tick}</span>
              </div>
            ))}
          </div>
        )}

        {/* Last-5-ticks urgency label */}
        {isLastFiveTicks && !isFunded && (
          <div
            style={{
              marginTop: 10,
              textAlign: 'center',
              fontSize: FS.md,
              color: C.red,
              fontFamily: F.mono,
              fontWeight: 700,
              letterSpacing: '0.08em',
            }}
          >
            ⚠ WINDOW EXPIRES IN {ticksRemaining} TICK{ticksRemaining !== 1 ? 'S' : ''}
          </div>
        )}

        {/* Funded confirmation */}
        {isFunded && (
          <div
            style={{
              marginTop: 8,
              textAlign: 'center',
              fontSize: FS.md,
              color: C.green,
              fontFamily: F.display,
              fontWeight: 700,
              letterSpacing: '0.1em',
            }}
          >
            RESCUE SUCCESSFUL — {recipientName} STABILIZED
          </div>
        )}
      </div>
    </>
  );
}