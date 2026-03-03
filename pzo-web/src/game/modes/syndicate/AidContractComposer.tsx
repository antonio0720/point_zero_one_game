// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/syndicate/AidContractComposer.tsx
// Sprint 5 — AID Contract Composer (UPDATED)
//
// Changes from prior version:
//   • New AID types: INCOME_SHARE, SHIELD_LEND, EMERGENCY_CAPITAL
//   • Trust leakage preview before submit
//   • Disable submit if trust < 0.3 (bible rule)
//   • Mobile: full-screen modal on < 480px
//   • Contrast fix: zinc-500 labels → zinc-300 equivalent (#9DD4CC)
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useMemo } from 'react';

import type { AidType }       from './aidContractEngine';
import { createAidContract }  from './aidContractEngine';
import { computeLeakageRate } from './trustScoreEngine';

// ─── Design Tokens (shared with SyndicateGameScreen) ──────────────────────────

const C = {
  bg:          '#0A1F1C',
  bgPanel:     '#0F2A26',
  bgSurface:   '#152F2B',
  bgInput:     '#1A3530',
  border:      '#1E4038',
  borderFocus: '#2E8B7A',
  textPrimary: '#E8F5F2',
  textSub:     '#9DD4CC',   // contrast-fixed (was zinc-500 equiv)
  textMuted:   '#3D6B62',   // contrast-fixed
  textLabel:   '#7EC8BF',
  tealBright:  '#2EC4B6',
  tealDim:     '#1A7A70',
  green:       '#22D17A',
  red:         '#FF4D4D',
  orange:      '#FF8C00',
  btnText:     '#FFFFFF',
} as const;

const F = {
  mono:    "'JetBrains Mono', 'Fira Code', monospace",
  display: "'Barlow Condensed', 'Arial Narrow', sans-serif",
};

const FS = {
  xs: 'clamp(9px, 1.2vw, 11px)',
  sm: 'clamp(10px, 1.4vw, 12px)',
  md: 'clamp(11px, 1.6vw, 14px)',
  lg: 'clamp(13px, 1.9vw, 17px)',
};

// ─── AID Type Config ──────────────────────────────────────────────────────────

export const AID_TYPE_CONFIGS: Record<AidType, {
  label: string;
  description: string;
  icon: string;
  defaultNominal: number;
  defaultRepaymentRatio: number;
  trustImpact: number;
}> = {
  CASH_TRANSFER: {
    label: 'Cash Transfer', icon: '💵',
    description: 'Direct cash sent to recipient. Immediate leakage applies.',
    defaultNominal: 10_000, defaultRepaymentRatio: 1.1, trustImpact: 0.5,
  },
  INCOME_BOOST: {
    label: 'Income Boost', icon: '📈',
    description: 'Funds recipient\'s income card for 3 ticks. Multiplied by role amplifier.',
    defaultNominal: 7_500, defaultRepaymentRatio: 1.08, trustImpact: 0.6,
  },
  SHIELD_GRANT: {
    label: 'Shield Grant', icon: '🛡',
    description: 'Covers recipient\'s next expense card. No repayment required.',
    defaultNominal: 5_000, defaultRepaymentRatio: 1.0, trustImpact: 0.7,
  },
  EXPENSE_COVER: {
    label: 'Expense Cover', icon: '📋',
    description: 'Covers a specific expense entry. Repayment within 60 ticks.',
    defaultNominal: 6_000, defaultRepaymentRatio: 1.05, trustImpact: 0.5,
  },
  // ── NEW TYPES ──
  INCOME_SHARE: {
    label: 'Income Share', icon: '🤝',
    description: 'Shares % of your income stream with recipient for N ticks. Deepens alliance bond.',
    defaultNominal: 8_000, defaultRepaymentRatio: 1.12, trustImpact: 0.8,
  },
  SHIELD_LEND: {
    label: 'Shield Lend', icon: '🔒',
    description: 'Lends a shield slot to recipient. They absorb your next expense threat.',
    defaultNominal: 4_000, defaultRepaymentRatio: 1.0, trustImpact: 0.65,
  },
  EMERGENCY_CAPITAL: {
    label: 'Emergency Capital', icon: '🚨',
    description: 'Maximum-priority transfer during rescue window. +20% effective amount.',
    defaultNominal: 15_000, defaultRepaymentRatio: 1.15, trustImpact: 0.9,
  },
};

// ─── Props ────────────────────────────────────────────────────────────────────

export interface AidContractComposerProps {
  senderId: string;
  senderTrustValue: number;
  senderCash: number;
  currentTick: number;
  allianceMembers: Array<{ id: string; name: string }>;
  onSubmit: (contractInput: Parameters<typeof createAidContract>[0]) => void;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AidContractComposer({
  senderId, senderTrustValue, senderCash, currentTick, allianceMembers, onSubmit, onClose,
}: AidContractComposerProps) {
  const [selectedType, setSelectedType] = useState<AidType>('CASH_TRANSFER');
  const [recipientId, setRecipientId]   = useState(allianceMembers[0]?.id ?? '');
  const [nominalAmount, setNominalAmount] = useState(AID_TYPE_CONFIGS.CASH_TRANSFER.defaultNominal);
  const [repaymentTicks, setRepaymentTicks] = useState(60);

  const cfg = AID_TYPE_CONFIGS[selectedType];
  const leakageRate = computeLeakageRate(senderTrustValue);
  const effectiveAmount = Math.round(nominalAmount * (1 - leakageRate));
  const leakageAmount   = nominalAmount - effectiveAmount;
  const repaymentAmount = Math.round(nominalAmount * cfg.defaultRepaymentRatio);

  const trustGate = senderTrustValue < 0.3;
  const insufficientFunds = nominalAmount > senderCash;

  const canSubmit = !trustGate && !insufficientFunds && recipientId && nominalAmount > 0;

  // Leakage preview label
  const leakageLabel = useMemo(() => {
    const pct = (leakageRate * 100).toFixed(1);
    return `${pct}% leakage at your current trust (${(senderTrustValue * 100).toFixed(0)} trust score)`;
  }, [leakageRate, senderTrustValue]);

  function handleTypeChange(type: AidType) {
    setSelectedType(type);
    setNominalAmount(AID_TYPE_CONFIGS[type].defaultNominal);
  }

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit({
      aidType: selectedType,
      senderId,
      recipientId,
      nominalAmount,
      repaymentAmount,
      repaymentDueTick: currentTick + repaymentTicks,
      currentTick,
      senderTrustValue,
    });
    onClose();
  }

  // ── Mobile detection via CSS media (use window.innerWidth as proxy) ──
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 480;

  const overlayStyle: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 1000,
    background: 'rgba(5, 15, 12, 0.88)',
    display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center',
    padding: isMobile ? 0 : 16,
  };

  const modalStyle: React.CSSProperties = {
    background: C.bgPanel,
    border: `1px solid ${C.border}`,
    borderRadius: isMobile ? '16px 16px 0 0' : 12,
    padding: isMobile ? '20px 16px calc(20px + env(safe-area-inset-bottom))' : '20px 24px',
    width: isMobile ? '100%' : 480,
    maxHeight: isMobile ? '92dvh' : '90vh',
    overflowY: 'auto',
  };

  return (
    <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={modalStyle}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: FS.lg, color: C.tealBright, fontFamily: F.display,
            fontWeight: 700, letterSpacing: '0.1em' }}>
            AID CONTRACT
          </span>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: C.textSub, cursor: 'pointer',
            fontSize: 20, padding: 4, minWidth: 44, minHeight: 44,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>

        {/* Trust gate warning */}
        {trustGate && (
          <div style={{
            background: 'rgba(255,77,77,0.12)', border: `1px solid ${C.red}`,
            borderRadius: 8, padding: '10px 12px', marginBottom: 14,
          }}>
            <div style={{ fontSize: FS.md, color: C.red, fontFamily: F.mono, fontWeight: 700 }}>
              🚫 AID BLOCKED — TRUST TOO LOW
            </div>
            <div style={{ fontSize: FS.sm, color: C.textSub, fontFamily: F.mono, marginTop: 4 }}>
              Trust must be ≥ 0.30 to offer AID contracts. Current: {senderTrustValue.toFixed(2)}.
              Build trust by fulfilling contracts and participating in rescues.
            </div>
          </div>
        )}

        {/* AID Type selector */}
        <label style={{ fontSize: FS.xs, color: C.textLabel, fontFamily: F.mono,
          letterSpacing: '0.1em', display: 'block', marginBottom: 6 }}>
          AID TYPE
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 14 }}>
          {(Object.entries(AID_TYPE_CONFIGS) as Array<[AidType, typeof AID_TYPE_CONFIGS[AidType]]>).map(([type, tc]) => (
            <button key={type} onClick={() => handleTypeChange(type)}
              disabled={trustGate}
              style={{
                background: selectedType === type ? C.bgInput : C.bgSurface,
                border: `1px solid ${selectedType === type ? C.tealBright : C.border}`,
                borderRadius: 6, padding: '8px 10px', cursor: trustGate ? 'not-allowed' : 'pointer',
                textAlign: 'left', opacity: trustGate ? 0.5 : 1,
                minHeight: 44,
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 14 }}>{tc.icon}</span>
                <div>
                  <div style={{ fontSize: FS.sm, color: selectedType === type ? C.tealBright : C.textSub,
                    fontFamily: F.display, fontWeight: 700 }}>{tc.label}</div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Selected type description */}
        <div style={{
          background: C.bgSurface, border: `1px solid ${C.border}`,
          borderRadius: 6, padding: '8px 10px', marginBottom: 14,
        }}>
          <span style={{ fontSize: FS.xs, color: C.textSub, fontFamily: F.mono }}>
            {cfg.description}
          </span>
        </div>

        {/* Recipient */}
        <label style={{ fontSize: FS.xs, color: C.textLabel, fontFamily: F.mono,
          letterSpacing: '0.1em', display: 'block', marginBottom: 6 }}>
          RECIPIENT
        </label>
        <select value={recipientId} onChange={e => setRecipientId(e.target.value)}
          disabled={trustGate}
          style={{
            width: '100%', background: C.bgInput, color: C.textPrimary,
            border: `1px solid ${C.border}`, borderRadius: 6, padding: '9px 12px',
            fontFamily: F.mono, fontSize: FS.sm, marginBottom: 14, minHeight: 44,
            cursor: trustGate ? 'not-allowed' : 'pointer',
          }}>
          {allianceMembers.filter(m => m.id !== senderId).map(m => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>

        {/* Nominal amount */}
        <label style={{ fontSize: FS.xs, color: C.textLabel, fontFamily: F.mono,
          letterSpacing: '0.1em', display: 'block', marginBottom: 6 }}>
          NOMINAL AMOUNT
        </label>
        <input
          type="number"
          value={nominalAmount}
          min={0}
          max={senderCash}
          step={500}
          onChange={e => setNominalAmount(Math.max(0, parseInt(e.target.value) || 0))}
          disabled={trustGate}
          style={{
            width: '100%', background: C.bgInput, color: C.textPrimary,
            border: `1px solid ${insufficientFunds ? C.red : C.border}`,
            borderRadius: 6, padding: '9px 12px', fontFamily: F.mono, fontSize: FS.md,
            marginBottom: 4, minHeight: 44,
          }}
        />
        {insufficientFunds && (
          <div style={{ fontSize: FS.xs, color: C.red, fontFamily: F.mono, marginBottom: 8 }}>
            Insufficient cash. Available: ${senderCash.toLocaleString()}
          </div>
        )}

        {/* Trust leakage preview */}
        {!trustGate && nominalAmount > 0 && (
          <div style={{
            background: C.bgSurface, border: `1px solid ${C.border}`,
            borderRadius: 6, padding: '8px 12px', marginBottom: 14,
          }}>
            <div style={{ fontSize: FS.xs, color: C.textLabel, fontFamily: F.mono,
              letterSpacing: '0.08em', marginBottom: 6 }}>LEAKAGE PREVIEW</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: FS.sm, color: C.textSub, fontFamily: F.mono }}>Nominal</span>
              <span style={{ fontSize: FS.sm, color: C.textPrimary, fontFamily: F.mono }}>
                ${nominalAmount.toLocaleString()}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: FS.sm, color: C.orange, fontFamily: F.mono }}>Leakage</span>
              <span style={{ fontSize: FS.sm, color: C.orange, fontFamily: F.mono }}>
                −${leakageAmount.toLocaleString()}
              </span>
            </div>
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 4, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: FS.sm, color: C.green, fontFamily: F.mono, fontWeight: 700 }}>Effective</span>
              <span style={{ fontSize: FS.sm, color: C.green, fontFamily: F.mono, fontWeight: 700 }}>
                ${effectiveAmount.toLocaleString()}
              </span>
            </div>
            <div style={{ fontSize: FS.xs, color: C.textMuted, fontFamily: F.mono, marginTop: 6 }}>
              {leakageLabel}
            </div>
          </div>
        )}

        {/* Repayment ticks */}
        <label style={{ fontSize: FS.xs, color: C.textLabel, fontFamily: F.mono,
          letterSpacing: '0.1em', display: 'block', marginBottom: 6 }}>
          REPAYMENT DUE (TICKS)
          <span style={{ color: C.textMuted, marginLeft: 8 }}>
            due at T{currentTick + repaymentTicks}
          </span>
        </label>
        <input
          type="range" min={30} max={180} step={10}
          value={repaymentTicks}
          onChange={e => setRepaymentTicks(parseInt(e.target.value))}
          disabled={trustGate}
          style={{ width: '100%', marginBottom: 4, accentColor: C.tealBright }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
          <span style={{ fontSize: FS.xs, color: C.textMuted, fontFamily: F.mono }}>30 ticks</span>
          <span style={{ fontSize: FS.xs, color: C.textSub, fontFamily: F.mono, fontWeight: 700 }}>
            {repaymentTicks} ticks · repay ${repaymentAmount.toLocaleString()}
          </span>
          <span style={{ fontSize: FS.xs, color: C.textMuted, fontFamily: F.mono }}>180 ticks</span>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          style={{
            width: '100%', padding: '12px 0', minHeight: 44,
            background: canSubmit ? C.tealDim : C.bgSurface,
            color: canSubmit ? C.btnText : C.textMuted,
            border: `1px solid ${canSubmit ? C.borderFocus : C.border}`,
            borderRadius: 8, cursor: canSubmit ? 'pointer' : 'not-allowed',
            fontSize: FS.lg, fontFamily: F.display, fontWeight: 700,
            letterSpacing: '0.08em', transition: 'background 0.2s',
          }}>
          {trustGate
            ? 'BLOCKED — RAISE TRUST FIRST'
            : insufficientFunds
              ? 'INSUFFICIENT FUNDS'
              : `SEND ${cfg.icon} ${cfg.label.toUpperCase()}`}
        </button>

        {canSubmit && (
          <div style={{ fontSize: FS.xs, color: C.textMuted, fontFamily: F.mono,
            textAlign: 'center', marginTop: 8 }}>
            Trust delta on send: +{(cfg.trustImpact * 5).toFixed(0)}% trust score
          </div>
        )}
      </div>
    </div>
  );
}