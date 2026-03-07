/**
 * PredatorGameScreen.tsx — ASYMMETRIC PvP / PREDATOR mode game screen
 * WIRED: useEngineStore + useRunStore. All engine metrics sourced from store.
 * Added: Battle budget HUD, extraction action controls, counter window UI.
 *
 * FILE LOCATION: pzo-web/src/components/PredatorGameScreen.tsx
 * Density6 LLC · Confidential
 */

import React, { useCallback, useMemo, memo } from 'react';
import GameBoard from '../components/GameBoard';
import type { MarketRegime, IntelligenceState } from '../components/GameBoard';
import { BattleHUD } from '../components/BattleHUD';
import type { BattlePhase, BattleParticipant } from '../components/BattleHUD';
import { CounterplayModal } from '../components/CounterplayModal';
import type { CounterplayAction } from '../components/CounterplayModal';
import { SabotageImpactPanel } from '../components/SabotageImpactPanel';
import type { ActiveSabotage } from '../components/SabotageImpactPanel';
import MomentFlash from '../components/MomentFlash';

// ── Store hooks ───────────────────────────────────────────────────────────────
import { useEngineStore } from '../store/engineStore';
import { useRunStore } from '../store/runStore';
import { useGameLoop } from '../hooks/useGameLoop';

// ─── Design tokens ────────────────────────────────────────────────────────────

const T = {
  void:    '#030005',
  surface: '#0A0008',
  card:    '#100008',
  red:     '#FF4D4D',
  redDim:  '#CC1111',
  orange:  '#FF8C00',
  yellow:  '#FFD700',
  green:   '#22DD88',
  blue:    '#4488FF',
  text:    '#F2F2FF',
  textSub: '#AA8888',
  textMut: '#4A2828',
  mono:    "'IBM Plex Mono', monospace",
  display: "'Syne', 'Outfit', system-ui, sans-serif",
};

// ─── Sabotage catalog ─────────────────────────────────────────────────────────

const SABOTAGE_CATALOG = [
  { id:'FREEZE_INCOME',    icon:'🧊', label:'FREEZE INCOME',    desc:'Stops income 3 ticks',    threat:'HIGH' },
  { id:'PHANTOM_EXPENSE',  icon:'👻', label:'PHANTOM EXPENSE',  desc:'Injects surprise cost',   threat:'MED'  },
  { id:'CREDIT_LOCK',      icon:'🔒', label:'CREDIT LOCK',      desc:'Destroys L2 shield',      threat:'HIGH' },
  { id:'MARKET_RUMOR',     icon:'📡', label:'MARKET RUMOR',     desc:'Raises hater heat +20',   threat:'MED'  },
  { id:'AUDIT_TRIGGER',    icon:'📋', label:'AUDIT TRIGGER',    desc:'Drains cash $5K',         threat:'CRIT' },
  { id:'SHIELD_CORRODE',   icon:'🔥', label:'SHIELD CORRODE',   desc:'Erodes shields 8/tick',   threat:'CRIT' },
  { id:'OPPORTUNITY_SNIPE',icon:'🎯', label:'OPP SNIPE',        desc:'Steals income boost',     threat:'MED'  },
  { id:'DEBT_INJECTION',   icon:'💉', label:'DEBT INJECTION',   desc:'Forces negative cashflow',threat:'CRIT' },
] as const;

const THREAT_COLORS: Record<string, string> = { CRIT: '#FF2222', HIGH: '#FF8800', MED: '#FFD700' };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  const s = n < 0 ? '-' : '', v = Math.abs(n);
  if (v >= 1_000_000) return `${s}$${(v/1e6).toFixed(2)}M`;
  if (v >= 1_000)     return `${s}$${(v/1e3).toFixed(1)}K`;
  return `${s}$${Math.round(v).toLocaleString()}`;
}

function clamp01(n: number): number { return Math.max(0, Math.min(1, n)); }

// ─── Panel wrapper ────────────────────────────────────────────────────────────

function Panel({ children, style = {}, urgent = false }: {
  children: React.ReactNode; style?: React.CSSProperties; urgent?: boolean;
}) {
  return (
    <div style={{
      background: T.card, borderRadius: 12,
      border: `1px solid ${urgent ? 'rgba(255,77,77,0.30)' : 'rgba(255,77,77,0.10)'}`,
      padding: 16,
      boxShadow: urgent ? '0 0 24px rgba(255,77,77,0.08) inset' : 'none',
      ...style,
    }}>
      {children}
    </div>
  );
}

function Label({ children, color = T.red }: { children: React.ReactNode; color?: string }) {
  return (
    <div style={{
      fontSize: 10, fontFamily: T.mono, fontWeight: 700,
      letterSpacing: '0.2em', textTransform: 'uppercase',
      color, marginBottom: 12,
    }}>
      {children}
    </div>
  );
}

// ─── Battle Budget HUD ────────────────────────────────────────────────────────
// Shows remaining budget for offensive/defensive ops, budget recharge rate,
// and extraction cost vs. current balance.

const BattleBudgetHUD = memo(function BattleBudgetHUD({
  budget,
  maxBudget,
  rechargePerTick,
  extractionCost,
  canExtract,
  onExtract,
}: {
  budget:          number;
  maxBudget:       number;
  rechargePerTick: number;
  extractionCost:  number;
  canExtract:      boolean;
  onExtract:       () => void;
}) {
  const pct       = Math.min(100, (budget / Math.max(1, maxBudget)) * 100);
  const barColor  = pct > 60 ? T.green : pct > 30 ? T.yellow : T.red;
  const canAfford = budget >= extractionCost;

  return (
    <Panel urgent={budget < extractionCost * 0.5}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <Label>Battle Budget</Label>
        <span style={{ fontSize: 11, fontFamily: T.mono, color: T.textSub }}>
          +{fmt(rechargePerTick)}/tick
        </span>
      </div>

      {/* Budget bar */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
        <span style={{
          fontSize: 'clamp(1.8rem, 4vw, 2.4rem)', fontWeight: 800,
          fontFamily: T.display, color: barColor,
          transition: 'color 0.3s ease',
        }}>
          {fmt(budget)}
        </span>
        <span style={{ fontSize: 12, fontFamily: T.mono, color: T.textMut }}>/ {fmt(maxBudget)}</span>
      </div>

      <div style={{ height: 8, background: '#1A000A', borderRadius: 4, overflow: 'hidden', marginBottom: 14 }}>
        <div style={{
          height: '100%', borderRadius: 4,
          width: `${pct.toFixed(1)}%`,
          background: `linear-gradient(90deg, ${T.redDim}, ${barColor})`,
          transition: 'width 0.5s ease',
        }} />
      </div>

      {/* Extraction action */}
      {canExtract && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontSize: 9, fontFamily: T.mono, color: T.textMut, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Extraction cost
            </div>
            <div style={{ fontSize: 14, fontFamily: T.mono, fontWeight: 700, color: canAfford ? T.orange : T.red }}>
              {fmt(extractionCost)}
            </div>
          </div>
          <button
            onClick={onExtract}
            disabled={!canAfford}
            style={{
              padding: '10px 20px', borderRadius: 8, cursor: canAfford ? 'pointer' : 'not-allowed',
              fontFamily: T.mono, fontWeight: 700, fontSize: 12, letterSpacing: '0.1em',
              textTransform: 'uppercase', minHeight: 44,
              background: canAfford ? 'rgba(255,140,0,0.15)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${canAfford ? 'rgba(255,140,0,0.40)' : 'rgba(255,255,255,0.06)'}`,
              color: canAfford ? T.orange : T.textMut,
              transition: 'all 0.2s ease',
            }}
          >
            ⚡ EXTRACT
          </button>
        </div>
      )}

      {!canAfford && canExtract && (
        <p style={{ fontSize: 10, fontFamily: T.mono, color: T.red, marginTop: 8 }}>
          ⚠ Insufficient budget for extraction — build pressure first
        </p>
      )}
    </Panel>
  );
});

// ─── Counter Window UI ────────────────────────────────────────────────────────
// Prominent countdown + action buttons during the 5-tick counter window.

const CounterWindowUI = memo(function CounterWindowUI({
  ticksLeft,
  incomingAttackLabel,
  incomingAttackEmoji,
  attackDamageEstimate,
  onCounter,
  onAbsorb,
}: {
  ticksLeft:            number;
  incomingAttackLabel:  string;
  incomingAttackEmoji:  string;
  attackDamageEstimate: number;
  onCounter:            () => void;
  onAbsorb:             () => void;
}) {
  const urgent = ticksLeft <= 2;
  const pct    = Math.min(100, (ticksLeft / 5) * 100);

  return (
    <div style={{
      borderRadius: 12, overflow: 'hidden',
      border: `2px solid ${urgent ? '#FF2222' : 'rgba(255,140,0,0.60)'}`,
      background: urgent ? 'rgba(255,22,22,0.08)' : 'rgba(255,140,0,0.06)',
      boxShadow: urgent ? '0 0 40px rgba(255,22,22,0.20)' : '0 0 24px rgba(255,140,0,0.12)',
      animation: urgent ? 'none' : 'none',
    }}>
      {/* Countdown bar */}
      <div style={{ height: 5, background: 'rgba(255,255,255,0.08)' }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: urgent ? '#FF2222' : T.orange,
          transition: 'width 0.9s linear',
        }} />
      </div>

      <div style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 28 }}>{incomingAttackEmoji}</span>
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: T.display, fontSize: 'clamp(14px, 3vw, 18px)', fontWeight: 800,
              color: urgent ? '#FF4D4D' : T.orange, lineHeight: 1,
            }}>
              {incomingAttackLabel}
            </div>
            <div style={{ fontFamily: T.mono, fontSize: 11, color: T.textSub, marginTop: 4 }}>
              Estimated damage: <span style={{ color: T.red, fontWeight: 700 }}>{fmt(attackDamageEstimate)}</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: T.mono, fontSize: 10, color: T.textMut, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Respond in
            </div>
            <div style={{
              fontFamily: T.display, fontSize: 'clamp(28px, 6vw, 40px)', fontWeight: 900,
              color: urgent ? '#FF2222' : T.orange, lineHeight: 1,
              textShadow: urgent ? '0 0 20px rgba(255,22,22,0.8)' : 'none',
            }}>
              {ticksLeft}t
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button
            onClick={onCounter}
            style={{
              padding: '13px', borderRadius: 10, cursor: 'pointer',
              fontFamily: T.display, fontWeight: 800, fontSize: 14,
              letterSpacing: '0.1em', textTransform: 'uppercase', minHeight: 48,
              background: 'rgba(255,140,0,0.18)', border: '1px solid rgba(255,140,0,0.45)',
              color: T.orange,
              boxShadow: '0 0 16px rgba(255,140,0,0.20)',
              transition: 'all 0.15s ease',
            }}
          >
            ⚡ COUNTER
          </button>
          <button
            onClick={onAbsorb}
            style={{
              padding: '13px', borderRadius: 10, cursor: 'pointer',
              fontFamily: T.mono, fontWeight: 700, fontSize: 12,
              letterSpacing: '0.08em', textTransform: 'uppercase', minHeight: 48,
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)',
              color: T.textSub,
              transition: 'all 0.15s ease',
            }}
          >
            🛡 ABSORB
          </button>
        </div>
      </div>
    </div>
  );
});

// ─── Extraction action controls ───────────────────────────────────────────────

const ExtractionControls = memo(function ExtractionControls({
  extractionPhase,
  extractionProgress,
  extractionTarget,
  onBeginExtraction,
  onAbortExtraction,
  onLockExtraction,
}: {
  extractionPhase:     'IDLE' | 'BUILDING' | 'READY' | 'LOCKED';
  extractionProgress:  number; // 0–1
  extractionTarget:    number;
  onBeginExtraction:   () => void;
  onAbortExtraction:   () => void;
  onLockExtraction:    () => void;
}) {
  const pct   = Math.min(100, clamp01(extractionProgress) * 100);
  const color = extractionPhase === 'READY' || extractionPhase === 'LOCKED' ? T.green :
                extractionPhase === 'BUILDING' ? T.yellow : T.textMut;

  return (
    <Panel>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <Label color={color}>Extraction</Label>
        <span style={{
          fontSize: 9, fontFamily: T.mono, fontWeight: 700,
          padding: '3px 10px', borderRadius: 4,
          color, background: `${color}14`, border: `1px solid ${color}28`,
          letterSpacing: '0.1em',
        }}>
          {extractionPhase}
        </span>
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontFamily: T.mono, color: T.textSub }}>Build progress</span>
          <span style={{ fontSize: 12, fontFamily: T.mono, fontWeight: 700, color }}>{pct.toFixed(0)}%</span>
        </div>
        <div style={{ height: 8, background: '#1A000A', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 4,
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${T.redDim}, ${color})`,
            transition: 'width 0.6s ease',
          }} />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 11, fontFamily: T.mono, color: T.textSub }}>Target</span>
        <span style={{ fontSize: 14, fontFamily: T.mono, fontWeight: 700, color: T.text }}>{fmt(extractionTarget)}</span>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        {extractionPhase === 'IDLE' && (
          <button onClick={onBeginExtraction} style={{
            flex: 1, padding: '11px', borderRadius: 8, cursor: 'pointer',
            fontFamily: T.mono, fontWeight: 700, fontSize: 12, letterSpacing: '0.08em',
            textTransform: 'uppercase', minHeight: 44,
            background: 'rgba(255,140,0,0.12)', border: '1px solid rgba(255,140,0,0.30)',
            color: T.orange, transition: 'all 0.2s ease',
          }}>
            ▶ BEGIN
          </button>
        )}
        {extractionPhase === 'BUILDING' && (
          <>
            <button onClick={onAbortExtraction} style={{
              flex: 1, padding: '11px', borderRadius: 8, cursor: 'pointer',
              fontFamily: T.mono, fontWeight: 700, fontSize: 11, letterSpacing: '0.08em',
              textTransform: 'uppercase', minHeight: 44,
              background: 'rgba(255,77,77,0.10)', border: '1px solid rgba(255,77,77,0.28)',
              color: T.red, transition: 'all 0.2s ease',
            }}>
              ✕ ABORT
            </button>
          </>
        )}
        {extractionPhase === 'READY' && (
          <button onClick={onLockExtraction} style={{
            flex: 1, padding: '11px', borderRadius: 8, cursor: 'pointer',
            fontFamily: T.display, fontWeight: 800, fontSize: 14,
            letterSpacing: '0.1em', textTransform: 'uppercase', minHeight: 44,
            background: 'rgba(34,221,136,0.15)', border: '1px solid rgba(34,221,136,0.40)',
            color: T.green,
            boxShadow: '0 0 20px rgba(34,221,136,0.20)',
            transition: 'all 0.2s ease',
          }}>
            🔒 LOCK EXTRACTION
          </button>
        )}
        {extractionPhase === 'LOCKED' && (
          <div style={{
            flex: 1, padding: '11px', borderRadius: 8, textAlign: 'center',
            fontFamily: T.mono, fontWeight: 700, fontSize: 12,
            background: 'rgba(34,221,136,0.08)', border: '1px solid rgba(34,221,136,0.22)',
            color: T.green,
          }}>
            ✓ EXTRACTION LOCKED
          </div>
        )}
      </div>
    </Panel>
  );
});

// ─── Combo meter ──────────────────────────────────────────────────────────────

const ComboMeter = memo(function ComboMeter({ comboCount }: { comboCount: number }) {
  const pct   = Math.min(100, comboCount * 25);
  const color = comboCount >= 3 ? '#FF2222' : comboCount >= 2 ? '#FF8800' : '#FFD700';
  const label = comboCount === 0 ? 'NO COMBO' : `${comboCount}× COMBO`;

  return (
    <Panel urgent={comboCount >= 2}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Label>Hater Combo</Label>
        <span style={{
          fontSize: 14, fontWeight: 800, fontFamily: T.display, color,
          textShadow: comboCount >= 3 ? `0 0 20px ${color}` : 'none',
          transition: 'all 0.3s ease',
        }}>
          {label}
        </span>
      </div>

      <div style={{ height: 10, background: '#1A000A', borderRadius: 6, overflow: 'hidden', marginBottom: 8 }}>
        <div style={{
          height: '100%', borderRadius: 6, width: `${pct}%`,
          background: `linear-gradient(90deg, #882222, ${color})`,
          boxShadow: comboCount > 0 ? `0 0 12px ${color}55` : 'none',
          transition: 'width 0.5s ease',
        }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, fontFamily: T.mono, color: T.textMut }}>
        <span>+0%</span><span>+25%</span><span>+50%</span><span>+75%</span>
        <span style={{ color: '#FF2222' }}>+100%</span>
      </div>

      {comboCount >= 2 && (
        <div style={{ marginTop: 10, fontSize: 11, color: '#FF7070', textAlign: 'center', fontFamily: T.mono, fontWeight: 600 }}>
          ⚠ Each unblocked attack now deals +{comboCount * 25}% damage
        </div>
      )}
    </Panel>
  );
});

// ─── Shield status ────────────────────────────────────────────────────────────

const ShieldStatus = memo(function ShieldStatus({ shields, shieldConsuming }: { shields: number; shieldConsuming: boolean }) {
  const LAYERS = ['L1 LIQUIDITY', 'L2 CREDIT', 'L3 ASSET', 'L4 NETWORK'];
  const pct    = (shields / 4) * 100;
  const barColor = shields > 2 ? 'linear-gradient(90deg, #224488, #4488FF)' :
                   shields > 1 ? 'linear-gradient(90deg, #886600, #FFD700)' :
                   'linear-gradient(90deg, #882200, #FF4444)';

  return (
    <Panel urgent={shields === 0}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <Label>Shield Status</Label>
        <span style={{ fontFamily: T.mono, fontSize: 11, color: shieldConsuming ? T.red : T.textSub }}>
          {shieldConsuming ? '🔥 ABSORBING' : `${shields}/4 INTACT`}
        </span>
      </div>

      <div style={{ display: 'grid', gap: 8, marginBottom: 12, gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {LAYERS.map((name, i) => {
          const intact = i < shields;
          return (
            <div key={name} style={{
              padding: '10px 6px', borderRadius: 8, textAlign: 'center',
              border: `1px solid ${intact ? 'rgba(68,136,255,0.30)' : 'rgba(255,34,34,0.25)'}`,
              background: intact ? 'rgba(0,0,80,0.20)' : 'rgba(30,0,0,0.30)',
            }}>
              <div style={{ fontSize: 18, marginBottom: 4 }}>{intact ? '🛡' : '💀'}</div>
              <div style={{
                fontSize: 8, fontFamily: T.mono, fontWeight: 700,
                color: intact ? '#6699FF' : '#FF5555', letterSpacing: '0.08em',
              }}>
                {name.split(' ')[0]}
              </div>
              <div style={{ fontSize: 8, color: intact ? '#4466BB' : '#882222', fontFamily: T.mono }}>
                {intact ? 'INTACT' : 'BREACH'}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ height: 6, background: '#1A0010', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 4, width: `${pct}%`, background: barColor, transition: 'width 0.7s ease' }} />
      </div>

      {shields === 0 && (
        <div style={{
          marginTop: 10, textAlign: 'center', fontSize: 12,
          fontFamily: T.mono, fontWeight: 700, color: '#FF2222', letterSpacing: '0.05em',
        }}>
          ⚠ ALL SHIELDS BREACHED — ONE HIT = BANKRUPTCY
        </div>
      )}
    </Panel>
  );
});

// ─── Sabotage arsenal ─────────────────────────────────────────────────────────

const SabotageArsenal = memo(function SabotageArsenal({
  counterplayOpen, counterplayTicksLeft,
}: { counterplayOpen: boolean; counterplayTicksLeft: number }) {
  return (
    <Panel>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <Label>Hater Arsenal</Label>
        {counterplayOpen && (
          <span style={{
            fontSize: 11, fontFamily: T.mono, fontWeight: 700, color: T.orange,
            padding: '4px 10px', borderRadius: 6,
            background: 'rgba(255,140,0,0.12)', border: '1px solid rgba(255,140,0,0.30)',
          }}>
            ⚡ COUNTERPLAY — {counterplayTicksLeft} TICKS
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}>
        {SABOTAGE_CATALOG.map((card) => {
          const col = THREAT_COLORS[card.threat];
          return (
            <div key={card.id} style={{
              padding: '10px 12px', borderRadius: 8,
              border: `1px solid ${col}33`, background: `${col}08`,
            }}>
              <div style={{ fontSize: 22, marginBottom: 6, lineHeight: 1 }}>{card.icon}</div>
              <div style={{
                fontSize: 9, fontFamily: T.mono, fontWeight: 700,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                color: col, marginBottom: 4, lineHeight: 1.3,
              }}>
                {card.label}
              </div>
              <div style={{ fontSize: 10, color: T.textSub, lineHeight: 1.4, marginBottom: 6 }}>{card.desc}</div>
              <div style={{
                display: 'inline-block', fontSize: 8, fontFamily: T.mono, fontWeight: 700,
                padding: '2px 6px', borderRadius: 3,
                color: `${col}CC`, background: `${col}14`, border: `1px solid ${col}28`,
              }}>
                {card.threat}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
});

// ─── Props (external-only — no game state props) ──────────────────────────────

export interface PendingCounterplay {
  eventLabel:       string;
  eventDescription: string;
  eventEmoji:       string;
  ticksToRespond:   number;
  actions:          CounterplayAction[];
  onChoose:         (actionId: string) => void;
  onIgnore:         () => void;
}

export interface PredatorGameScreenProps {
  /** All game-state props removed — sourced from store. */
  pendingCounterplay: PendingCounterplay | null;
  onForfeit:          () => void;
  onCounterplay:      (id: string) => void;
  /** Extraction lifecycle callbacks */
  onBeginExtraction:  () => void;
  onAbortExtraction:  () => void;
  onLockExtraction:   () => void;
  /** Counter window action callbacks (inline, not modal) */
  onCounterWindowCounter: () => void;
  onCounterWindowAbsorb:  () => void;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function PredatorGameScreen({
  pendingCounterplay,
  onForfeit,
  onCounterplay,
  onBeginExtraction,
  onAbortExtraction,
  onLockExtraction,
  onCounterWindowCounter,
  onCounterWindowAbsorb,
}: PredatorGameScreenProps) {

  // ── Game loop ─────────────────────────────────────────────────────────────
  const { tick, runPhase } = useGameLoop();

  // ── Financial state ───────────────────────────────────────────────────────
  const cash          = useRunStore(s => s.cash          ?? 0);
  const income        = useRunStore(s => s.income        ?? 0);
  const expenses      = useRunStore(s => s.expenses      ?? 0);
  const netWorth      = useRunStore(s => s.netWorth      ?? 0);
  const equityHistory = useRunStore(s => s.equityHistory ?? []);
  const regime        = useRunStore(s => s.regime        ?? 'NEUTRAL') as MarketRegime;
  const intelligence  = useRunStore(s => s.intelligence  ?? { level: 0 }) as IntelligenceState;
  const events        = useRunStore(s => s.events        ?? []) as string[];

  // ── Time engine ───────────────────────────────────────────────────────────
  const totalTicks  = useEngineStore(s => s.time.totalTicks  ?? 720);
  const freezeTicks = useEngineStore(s => s.time.freezeTicks ?? 0);

  // ── Battle engine ─────────────────────────────────────────────────────────
  const haterHeat   = useEngineStore(s => s.battle.haterHeat   ?? 0);
  const battlePhase = useEngineStore(s => s.battle.phase        ?? 'DORMANT') as BattlePhase;
  const comboCount  = useEngineStore(s => s.battle.comboCount   ?? 0);
  const battleScore = useEngineStore(s => s.battle.score        ?? { local: 0, opponent: 0 });
  const battleRound = useEngineStore(s => s.battle.round        ?? 1);
  const battleParticipants = useEngineStore(s => s.battle.participants ?? []) as BattleParticipant[];

  // ── Shield engine ─────────────────────────────────────────────────────────
  const shields          = useEngineStore(s => s.shield.integrity   ?? 4);
  const shieldConsuming  = useEngineStore(s => s.shield.isConsuming ?? false);

  // ── Predator-mode state ───────────────────────────────────────────────────
  const counterplayOpen      = useEngineStore(s => s.predator?.counterplayWindowOpen ?? false);
  const counterplayTicksLeft = useEngineStore(s => s.predator?.counterplayTicksLeft  ?? 0);
  const predPhase            = useEngineStore(s => s.predator?.phase                 ?? 'early') as string;
  const battleBudget         = useEngineStore(s => s.predator?.battleBudget          ?? 0);
  const maxBattleBudget      = useEngineStore(s => s.predator?.maxBattleBudget       ?? 50000);
  const budgetRecharge       = useEngineStore(s => s.predator?.budgetRechargePerTick ?? 500);
  const extractionCost       = useEngineStore(s => s.predator?.extractionCost        ?? 20000);
  const extractionPhase      = useEngineStore(s => s.predator?.extractionPhase       ?? 'IDLE') as 'IDLE' | 'BUILDING' | 'READY' | 'LOCKED';
  const extractionProgress   = useEngineStore(s => s.predator?.extractionProgress    ?? 0);
  const extractionTarget     = useEngineStore(s => s.predator?.extractionTarget       ?? 100000);
  const activeSabotages      = useEngineStore(s => s.predator?.activeSabotages       ?? []) as ActiveSabotage[];

  // ── Counter window data ───────────────────────────────────────────────────
  const counterAttackLabel   = useEngineStore(s => s.predator?.counterAttackLabel   ?? 'INCOMING ATTACK');
  const counterAttackEmoji   = useEngineStore(s => s.predator?.counterAttackEmoji   ?? '⚔️');
  const counterDmgEstimate   = useEngineStore(s => s.predator?.counterDamageEstimate ?? 0);

  // ── Derived ───────────────────────────────────────────────────────────────
  const cashflow   = income - expenses;
  const canExtract = extractionPhase !== 'LOCKED';

  const phaseLabel: Record<string, string> = { early: 'EARLY GAME', mid: 'MID GAME', endgame: 'ENDGAME' };
  const phaseColor = predPhase === 'endgame' ? T.red : T.orange;

  const handleExtract = useCallback(() => {
    if (battleBudget >= extractionCost) onBeginExtraction();
  }, [battleBudget, extractionCost, onBeginExtraction]);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      background: 'linear-gradient(160deg, #050002 0%, #0A0005 60%, #060003 100%)',
      fontFamily: T.display,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
      `}</style>

      {/* ── Sticky Header ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(5,0,2,0.94)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255,77,77,0.14)',
        padding: '10px clamp(12px,4vw,24px)',
        display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px 20px',
      }}>
        <div style={{
          padding: '5px 12px', borderRadius: 6, fontSize: 10,
          fontFamily: T.mono, fontWeight: 700, letterSpacing: '0.2em',
          background: 'rgba(255,77,77,0.12)', border: '1px solid rgba(255,77,77,0.30)',
          color: T.red,
        }}>
          ⚔️ PREDATOR
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 18px', fontSize: 12, fontFamily: T.mono }}>
          <span style={{ color: cashflow >= 0 ? T.green : T.red, fontWeight: 700 }}>
            CF {cashflow >= 0 ? '+' : ''}{fmt(cashflow)}/mo
          </span>
          <span style={{ color: T.text }}>NW {fmt(netWorth)}</span>
          <span style={{ color: comboCount >= 2 ? T.red : T.textSub }}>COMBO {comboCount}×</span>
          <span style={{ color: T.orange }}>🔥 HEAT {Math.round(haterHeat)}</span>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            fontSize: 11, fontFamily: T.mono, fontWeight: 700,
            color: phaseColor, padding: '3px 8px', borderRadius: 4,
            background: `${phaseColor}14`, border: `1px solid ${phaseColor}28`,
          }}>
            {phaseLabel[predPhase] ?? predPhase.toUpperCase()}
          </span>
          {runPhase === 'PAUSED' && (
            <span style={{
              fontSize: 10, fontFamily: T.mono, color: T.yellow,
              padding: '3px 8px', borderRadius: 4,
              background: 'rgba(255,215,0,0.10)', border: '1px solid rgba(255,215,0,0.25)',
            }}>⏸ PAUSED</span>
          )}
          <span style={{ fontSize: 11, fontFamily: T.mono, color: T.textMut }}>T{tick}/{totalTicks}</span>
        </div>
      </header>

      {/* ── Battle HUD ── */}
      <div style={{ padding: '14px clamp(12px,3vw,20px) 0' }}>
        <BattleHUD
          phase={battlePhase}
          participants={battleParticipants}
          ticksRemaining={Math.max(0, totalTicks - tick)}
          roundNumber={battleRound}
          totalRounds={12}
          localScore={battleScore.local}
          opponentScore={battleScore.opponent}
          onForfeit={onForfeit}
        />
      </div>

      {/* ── Counter window (inline — takes priority over all panels) ── */}
      {counterplayOpen && (
        <div style={{ padding: '14px clamp(12px,3vw,20px) 0' }}>
          <CounterWindowUI
            ticksLeft={counterplayTicksLeft}
            incomingAttackLabel={counterAttackLabel}
            incomingAttackEmoji={counterAttackEmoji}
            attackDamageEstimate={counterDmgEstimate}
            onCounter={onCounterWindowCounter}
            onAbsorb={onCounterWindowAbsorb}
          />
        </div>
      )}

      {/* ── Main content ── */}
      <div style={{ flex: 1, padding: 'clamp(12px,3vw,20px)', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Battle budget + extraction controls */}
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          <BattleBudgetHUD
            budget={battleBudget}
            maxBudget={maxBattleBudget}
            rechargePerTick={budgetRecharge}
            extractionCost={extractionCost}
            canExtract={canExtract}
            onExtract={handleExtract}
          />
          <ExtractionControls
            extractionPhase={extractionPhase}
            extractionProgress={extractionProgress}
            extractionTarget={extractionTarget}
            onBeginExtraction={onBeginExtraction}
            onAbortExtraction={onAbortExtraction}
            onLockExtraction={onLockExtraction}
          />
        </div>

        {/* Combo + Shield */}
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          <ComboMeter comboCount={comboCount} />
          <ShieldStatus shields={shields} shieldConsuming={shieldConsuming} />
        </div>

        {/* Sabotage arsenal */}
        <SabotageArsenal counterplayOpen={counterplayOpen} counterplayTicksLeft={counterplayTicksLeft} />

        {/* Active sabotages */}
        {activeSabotages.length > 0 && (
          <Panel>
            <SabotageImpactPanel
              activeSabotages={activeSabotages}
              tick={tick}
              onCounterplay={onCounterplay}
            />
          </Panel>
        )}

        {/* GameBoard */}
        <GameBoard
          equityHistory={equityHistory} cash={cash} netWorth={netWorth}
          income={income} expenses={expenses} regime={regime}
          intelligence={intelligence} tick={tick} totalTicks={totalTicks}
          freezeTicks={freezeTicks}
        />
      </div>

      {/* ── Counterplay Modal (legacy path for event-driven counterplay) ── */}
      {pendingCounterplay && (
        <CounterplayModal
          eventLabel={pendingCounterplay.eventLabel}
          eventDescription={pendingCounterplay.eventDescription}
          eventEmoji={pendingCounterplay.eventEmoji}
          ticksToRespond={pendingCounterplay.ticksToRespond}
          actions={pendingCounterplay.actions}
          cash={cash}
          onChoose={pendingCounterplay.onChoose}
          onIgnore={pendingCounterplay.onIgnore}
        />
      )}

      {/* ── Moment Flash ── */}
      <div style={{ position: 'fixed', bottom: 16, right: 16, width: 320, zIndex: 200, pointerEvents: 'none' }}>
        <MomentFlash events={events} tick={tick} maxVisible={3} />
      </div>
    </div>
  );
}