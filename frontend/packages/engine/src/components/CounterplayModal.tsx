/**
 * CounterplayModal.tsx — Engine-Integrated Forced Event Counterplay
 * Engine: battle/types · BattleActionType · BATTLE_ACTION_COSTS
 * Scale: 20M concurrent · Mobile-first · Syne + IBM Plex Mono
 * Density6 LLC · Point Zero One · Confidential
 */

import React, { useState, useCallback, memo } from 'react';
import { BattleActionType, BATTLE_ACTION_COSTS } from '../battle/types';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const T = {
  void:    '#030308',
  card:    '#0C0C1E',
  cardHi:  '#131328',
  border:  'rgba(255,255,255,0.08)',
  borderM: 'rgba(255,255,255,0.18)',
  text:    '#F2F2FF',
  textSub: '#9090B4',
  textMut: '#44445A',
  green:   '#22DD88',
  greenD:  'rgba(34,221,136,0.12)',
  red:     '#FF4D4D',
  redD:    'rgba(255,77,77,0.12)',
  orange:  '#FF8C00',
  yellow:  '#FFD700',
  indigo:  '#818CF8',
  indigoD: 'rgba(129,140,248,0.14)',
  mono:    "'IBM Plex Mono', 'JetBrains Mono', monospace",
  display: "'Syne', 'Outfit', system-ui, sans-serif",
};

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');`;

// ─── Action type (engine-extended) ───────────────────────────────────────────
export type CounterplayAction = {
  id:             string;
  label:          string;
  description:    string;
  cost:           number;
  successChance:  number;  // 0–1
  emoji:          string;
  available:      boolean;
  battleAction?:  BattleActionType;  // engine link
};

export interface CounterplayModalProps {
  eventLabel:       string;
  eventDescription: string;
  eventEmoji:       string;
  ticksToRespond:   number;
  actions:          CounterplayAction[];
  cash:             number;
  onChoose?:        (actionId: string) => void;
  onIgnore?:        () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n}`;
}

function successColor(p: number): string {
  if (p >= 0.75) return T.green;
  if (p >= 0.50) return T.yellow;
  return T.orange;
}

function successLabel(p: number): string {
  if (p >= 0.75) return 'HIGH';
  if (p >= 0.50) return 'MED';
  return 'LOW';
}

// ─── Action Card ──────────────────────────────────────────────────────────────
const ActionCard = memo(function ActionCard({
  action, cash, isSelected, onClick,
}: {
  action: CounterplayAction;
  cash: number;
  isSelected: boolean;
  onClick: () => void;
}) {
  const canAfford  = cash >= action.cost;
  const isDisabled = !action.available || !canAfford;
  const sColor     = successColor(action.successChance);

  // Optionally show engine cost if action maps to a BattleActionType
  const engineCost = action.battleAction
    ? BATTLE_ACTION_COSTS[action.battleAction]
    : null;

  let bg     = T.cardHi;
  let border = T.border;
  let cursor = 'pointer';

  if (isSelected) {
    bg     = T.indigoD;
    border = 'rgba(129,140,248,0.55)';
  } else if (isDisabled) {
    bg     = 'rgba(255,255,255,0.02)';
    border = 'rgba(255,255,255,0.04)';
    cursor = 'not-allowed';
  }

  return (
    <button
      disabled={isDisabled}
      onClick={isDisabled ? undefined : onClick}
      style={{
        width: '100%', textAlign: 'left', padding: '14px 16px',
        background: bg, border: `1px solid ${border}`,
        borderRadius: 12, cursor,
        opacity: isDisabled ? 0.42 : 1,
        transition: 'background 0.15s, border-color 0.15s, transform 0.1s',
        fontFamily: T.display,
        outline: isSelected ? `2px solid rgba(129,140,248,0.55)` : 'none',
        outlineOffset: 1,
        minHeight: 72,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Selected glow */}
      {isSelected && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'linear-gradient(135deg, rgba(129,140,248,0.07) 0%, transparent 60%)',
        }} />
      )}

      {/* Row 1 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span style={{ fontSize: 22, flexShrink: 0, lineHeight: 1 }}>{action.emoji}</span>
          <span style={{ fontFamily: T.display, fontSize: 14, fontWeight: 700, color: T.text }}>
            {action.label}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {/* Success */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '4px 9px', borderRadius: 6,
            background: `${sColor}16`,
            border: `1px solid ${sColor}30`,
          }}>
            <span style={{ fontFamily: T.mono, fontSize: 10, color: sColor, fontWeight: 700 }}>
              {Math.round(action.successChance * 100)}%
            </span>
            <span style={{ fontFamily: T.mono, fontSize: 8, color: `${sColor}99`, textTransform: 'uppercase' }}>
              {successLabel(action.successChance)}
            </span>
          </div>

          {/* Cost */}
          <span style={{
            fontFamily: T.mono, fontSize: 12, fontWeight: 700,
            color: canAfford ? T.yellow : T.red,
          }}>
            {fmt(action.cost)}
          </span>
        </div>
      </div>

      {/* Row 2: description */}
      <div style={{
        fontFamily: T.display, fontSize: 11, color: T.textSub,
        marginTop: 7, lineHeight: 1.5,
      }}>
        {action.description}
      </div>

      {/* Row 3: engine info + error */}
      <div style={{ marginTop: 7, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {action.battleAction && engineCost !== null && (
          <span style={{
            fontFamily: T.mono, fontSize: 8, color: T.indigo,
            background: T.indigoD, padding: '2px 6px', borderRadius: 4,
            border: '1px solid rgba(129,140,248,0.20)',
          }}>
            {action.battleAction} · {engineCost} budget
          </span>
        )}
        {!canAfford && action.available && (
          <span style={{
            fontFamily: T.mono, fontSize: 9, color: T.red, fontWeight: 700,
          }}>
            ✗ Insufficient funds
          </span>
        )}
        {!action.available && (
          <span style={{
            fontFamily: T.mono, fontSize: 9, color: T.orange,
          }}>
            ✗ Unavailable
          </span>
        )}
      </div>
    </button>
  );
});

// ─── Main Component ───────────────────────────────────────────────────────────
export const CounterplayModal = memo(function CounterplayModal({
  eventLabel, eventDescription, eventEmoji,
  ticksToRespond, actions, cash,
  onChoose, onIgnore,
}: CounterplayModalProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const handleChoose = useCallback(() => {
    if (selected && onChoose) onChoose(selected);
  }, [selected, onChoose]);

  // Urgency color
  const urgencyColor = ticksToRespond <= 3
    ? T.red : ticksToRespond <= 8
    ? T.orange : T.yellow;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(3,3,8,0.84)',
      backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px',
    }}>
      <style>{FONT_IMPORT}</style>
      <style>{`
        @keyframes pzo-modal-in {
          from { opacity: 0; transform: scale(0.94) translateY(12px); }
          to   { opacity: 1; transform: scale(1)    translateY(0); }
        }
        @keyframes pzo-tick-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.6; transform: scale(0.92); }
        }
      `}</style>

      <div style={{
        background: T.card, borderRadius: 18,
        border: `1px solid rgba(255,77,77,0.40)`,
        boxShadow: '0 24px 80px rgba(255,77,77,0.15), 0 4px 24px rgba(0,0,0,0.6)',
        width: '100%', maxWidth: 520,
        maxHeight: '90vh', overflowY: 'auto',
        fontFamily: T.display,
        animation: 'pzo-modal-in 0.25s cubic-bezier(0.34,1.56,0.64,1) both',
      }}>

        {/* ── Header ── */}
        <div style={{
          padding: '18px 20px 16px',
          borderBottom: `1px solid rgba(255,77,77,0.20)`,
          background: 'rgba(255,77,77,0.05)',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <span style={{ fontSize: 36, lineHeight: 1, flexShrink: 0 }}>{eventEmoji}</span>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: T.display, fontSize: 16, fontWeight: 800,
                color: T.red, marginBottom: 6, lineHeight: 1.2,
              }}>
                {eventLabel}
              </div>
              <div style={{
                fontFamily: T.display, fontSize: 12, color: T.textSub, lineHeight: 1.5,
              }}>
                {eventDescription}
              </div>
            </div>

            {/* Tick countdown */}
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              flexShrink: 0, padding: '8px 12px', borderRadius: 10,
              background: `${urgencyColor}14`,
              border: `1px solid ${urgencyColor}35`,
              animation: ticksToRespond <= 3 ? 'pzo-tick-pulse 0.9s ease-in-out infinite' : 'none',
            }}>
              <span style={{
                fontFamily: T.mono, fontSize: 20, fontWeight: 800,
                color: urgencyColor, lineHeight: 1,
              }}>
                {ticksToRespond}
              </span>
              <span style={{
                fontFamily: T.mono, fontSize: 8, color: `${urgencyColor}99`,
                textTransform: 'uppercase', letterSpacing: '0.10em', marginTop: 3,
              }}>
                ticks
              </span>
            </div>
          </div>
        </div>

        {/* ── Actions ── */}
        <div style={{ padding: '16px 20px' }}>
          <div style={{
            fontFamily: T.mono, fontSize: 9, color: T.textMut,
            textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 12,
          }}>
            Available Responses — {fmt(cash)} cash
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {actions.map(action => (
              <ActionCard
                key={action.id}
                action={action}
                cash={cash}
                isSelected={selected === action.id}
                onClick={() => setSelected(prev => prev === action.id ? null : action.id)}
              />
            ))}
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{
          padding: '14px 20px 20px',
          borderTop: `1px solid ${T.border}`,
          display: 'flex', gap: 10, flexWrap: 'wrap',
        }}>
          {onIgnore && (
            <button
              onClick={onIgnore}
              style={{
                flex: 1, minWidth: 120, padding: '14px 16px',
                background: 'rgba(255,77,77,0.07)',
                border: '1px solid rgba(255,77,77,0.25)',
                borderRadius: 10, cursor: 'pointer',
                fontFamily: T.mono, fontSize: 10, fontWeight: 700,
                color: '#FF7777', textTransform: 'uppercase', letterSpacing: '0.12em',
                minHeight: 50,
                transition: 'background 0.15s',
              }}
            >
              ☠ Take The Hit
            </button>
          )}

          {onChoose && (
            <button
              onClick={handleChoose}
              disabled={!selected}
              style={{
                flex: 2, minWidth: 160, padding: '14px 16px',
                background: selected
                  ? 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)'
                  : 'rgba(129,140,248,0.08)',
                border: selected
                  ? '1px solid rgba(129,140,248,0.50)'
                  : '1px solid rgba(129,140,248,0.18)',
                borderRadius: 10, cursor: selected ? 'pointer' : 'not-allowed',
                fontFamily: T.mono, fontSize: 11, fontWeight: 800,
                color: selected ? T.text : T.textMut,
                textTransform: 'uppercase', letterSpacing: '0.12em',
                minHeight: 50,
                transition: 'all 0.2s',
                boxShadow: selected ? '0 4px 20px rgba(79,70,229,0.35)' : 'none',
              }}
            >
              {selected ? '⚡ Execute Response' : 'Select Response'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

export default CounterplayModal;