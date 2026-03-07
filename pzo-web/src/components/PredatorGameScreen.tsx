/**
 * PredatorGameScreen.tsx — ASYMMETRIC PvP / PREDATOR mode game screen
 * ADAPTED TO CURRENT REPO STORE CONTRACTS.
 *
 * SOURCE OF TRUTH:
 * - Financials come from runStore:
 *   cashBalance / monthlyIncome / monthlyExpenses / netWorth
 * - Engine metrics come from engineStore:
 *   run / time / battle / shield / cascade
 *
 * IMPORTANT:
 * - The current repo does NOT expose a `predator` store slice.
 * - This screen therefore derives Predator HUD state locally from the
 *   current unified engine store and the legacy callback props.
 *
 * FILE LOCATION: pzo-web/src/components/PredatorGameScreen.tsx
 * Density6 LLC · Point Zero One · Confidential
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  memo,
} from 'react';
import GameBoard from './GameBoard';
import type { MarketRegime, IntelligenceState } from './GameBoard';
import { BattleHUD } from './BattleHUD';
import type { BattlePhase, BattleParticipant } from './BattleHUD';
import { CounterplayModal } from './CounterplayModal';
import type { CounterplayAction } from './CounterplayModal';
import { SabotageImpactPanel } from './SabotageImpactPanel';
import type { ActiveSabotage } from './SabotageImpactPanel';
import MomentFlash from './MomentFlash';

// ── Store hooks ───────────────────────────────────────────────────────────────
import { useEngineStore } from '../store/engineStore';
import { useRunStore } from '../store/runStore';
import { useGameLoop } from '../hooks/useGameLoop';

// ── Engine types ──────────────────────────────────────────────────────────────
import type {
  BattleBudgetState,
  HaterBotRuntimeState,
  InjectedCard,
} from '../engines/battle/types';
import {
  BotState,
  InjectionType,
} from '../engines/battle/types';

// ─── Design tokens ────────────────────────────────────────────────────────────

const T = {
  void: '#030005',
  surface: '#0A0008',
  card: '#100008',
  red: '#FF4D4D',
  redDim: '#CC1111',
  orange: '#FF8C00',
  yellow: '#FFD700',
  green: '#22DD88',
  blue: '#4488FF',
  text: '#F2F2FF',
  textSub: '#AA8888',
  textMut: '#4A2828',
  mono: "'IBM Plex Mono', monospace",
  display: "'Syne', 'Outfit', system-ui, sans-serif",
};

// ─── Sabotage catalog ─────────────────────────────────────────────────────────

const SABOTAGE_CATALOG = [
  { id: 'FREEZE_INCOME', icon: '🧊', label: 'FREEZE INCOME', desc: 'Stops income 3 ticks', threat: 'HIGH' },
  { id: 'PHANTOM_EXPENSE', icon: '👻', label: 'PHANTOM EXPENSE', desc: 'Injects surprise cost', threat: 'MED' },
  { id: 'CREDIT_LOCK', icon: '🔒', label: 'CREDIT LOCK', desc: 'Destroys L2 shield', threat: 'HIGH' },
  { id: 'MARKET_RUMOR', icon: '📡', label: 'MARKET RUMOR', desc: 'Raises hater heat', threat: 'MED' },
  { id: 'AUDIT_TRIGGER', icon: '📋', label: 'AUDIT TRIGGER', desc: 'Drains liquidity', threat: 'CRIT' },
  { id: 'SHIELD_CORRODE', icon: '🔥', label: 'SHIELD CORRODE', desc: 'Erodes shields', threat: 'CRIT' },
  { id: 'OPPORTUNITY_SNIPE', icon: '🎯', label: 'OPP SNIPE', desc: 'Kills upside', threat: 'MED' },
  { id: 'DEBT_INJECTION', icon: '💉', label: 'DEBT INJECTION', desc: 'Forces negative cashflow', threat: 'CRIT' },
] as const;

const THREAT_COLORS: Record<string, string> = {
  CRIT: '#FF2222',
  HIGH: '#FF8800',
  MED: '#FFD700',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  const s = n < 0 ? '-' : '';
  const v = Math.abs(n);
  if (v >= 1_000_000) return `${s}$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1_000) return `${s}$${(v / 1e3).toFixed(1)}K`;
  return `${s}$${Math.round(v).toLocaleString()}`;
}

function fmtPts(n: number): string {
  return `${Math.max(0, Math.round(n))} pts`;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function normalizeHeatPct(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 1 && value >= 0) return value * 100;
  return Math.max(0, value);
}

function deriveMarketRegime(
  heatPct: number,
  shieldIntegrityPct: number,
  cashflow: number,
  netWorth: number,
): MarketRegime {
  if (shieldIntegrityPct <= 25 || heatPct >= 75 || (cashflow < 0 && netWorth <= 0)) {
    return 'Panic';
  }
  if (heatPct >= 50 || shieldIntegrityPct <= 50) {
    return 'Compression';
  }
  if (cashflow >= 0 && heatPct <= 30 && shieldIntegrityPct >= 70) {
    return 'Expansion';
  }
  if (cashflow >= 0 && netWorth > 0 && heatPct <= 15 && shieldIntegrityPct >= 85) {
    return 'Euphoria';
  }
  return 'Stable';
}

function deriveIntelligenceState(
  heatPct: number,
  shieldIntegrityPct: number,
  cashflow: number,
  activeBotsCount: number,
): IntelligenceState {
  const heat = clamp01(heatPct / 100);
  const shield = clamp01(shieldIntegrityPct / 100);
  const positiveCashflow = cashflow >= 0 ? 1 : clamp01(1 - Math.min(1, Math.abs(cashflow) / 25_000));
  const opposition = clamp01(activeBotsCount / 4);

  return {
    alpha: clamp01((shield + positiveCashflow) / 2),
    risk: heat,
    volatility: clamp01((heat + opposition) / 2),
    antiCheat: shield,
    personalization: clamp01(0.45 + positiveCashflow * 0.55),
    rewardFit: clamp01((positiveCashflow + shield) / 2),
    recommendationPower: clamp01(1 - heat * 0.7),
    churnRisk: clamp01(Math.max(heat, opposition)),
    momentum: clamp01((positiveCashflow + (1 - heat)) / 2),
  };
}

function mapBotStateToThreatWeight(state: BotState): number {
  switch (state) {
    case BotState.ATTACKING:
      return 1.0;
    case BotState.TARGETING:
      return 0.75;
    case BotState.WATCHING:
      return 0.4;
    case BotState.RETREATING:
      return 0.25;
    case BotState.NEUTRALIZED:
      return 0.1;
    case BotState.DORMANT:
    default:
      return 0;
  }
}

function deriveBattlePhase(
  runPhase: 'IDLE' | 'RUNNING' | 'PAUSED' | 'ENDED',
  activeBots: HaterBotRuntimeState[],
  injectedCards: InjectedCard[],
): BattlePhase {
  if (runPhase === 'ENDED') return 'ENDED';

  const anyAttacking = activeBots.some((bot) => bot.state === BotState.ATTACKING);
  const anyTargeting = activeBots.some((bot) => bot.state === BotState.TARGETING);

  if (anyAttacking || injectedCards.length > 0) return 'ACTIVE';
  if (runPhase === 'PAUSED' || anyTargeting) return 'RESOLUTION';
  return 'PREP';
}

function deriveComboCount(
  activeBots: HaterBotRuntimeState[],
  injectedCards: InjectedCard[],
): number {
  const attacking = activeBots.filter((bot) => bot.state === BotState.ATTACKING).length;
  const targeting = activeBots.filter((bot) => bot.state === BotState.TARGETING).length;
  const injected = injectedCards.length;

  return Math.max(0, Math.min(4, attacking + Math.floor(targeting / 2) + Math.max(0, injected - 1)));
}

function mapInjectionToSabotage(
  card: InjectedCard,
  sourceBot: HaterBotRuntimeState | undefined,
): ActiveSabotage {
  switch (card.injectionType) {
    case InjectionType.FORCED_SALE:
      return {
        id: card.injectionId,
        kind: 'FORCED_SELL',
        label: card.cardName,
        severity: 'CRITICAL',
        ticksRemaining: card.ticksRemaining,
        sourceDisplayName: sourceBot?.profile.name ?? 'Unknown Bot',
        sourceBotId: sourceBot?.profileId,
        sourceBotState: sourceBot?.state,
        impactValue: 8000,
      };

    case InjectionType.REGULATORY_HOLD:
      return {
        id: card.injectionId,
        kind: 'CARD_BLOCK',
        label: card.cardName,
        severity: 'MAJOR',
        ticksRemaining: card.ticksRemaining,
        sourceDisplayName: sourceBot?.profile.name ?? 'Unknown Bot',
        sourceBotId: sourceBot?.profileId,
        sourceBotState: sourceBot?.state,
        impactValue: 2500,
      };

    case InjectionType.INVERSION_CURSE:
      return {
        id: card.injectionId,
        kind: 'INTEL_BLACKOUT',
        label: card.cardName,
        severity: 'CRITICAL',
        ticksRemaining: card.ticksRemaining,
        sourceDisplayName: sourceBot?.profile.name ?? 'Unknown Bot',
        sourceBotId: sourceBot?.profileId,
        sourceBotState: sourceBot?.state,
        impactValue: 6000,
      };

    case InjectionType.EXPENSE_SPIKE:
      return {
        id: card.injectionId,
        kind: 'INCOME_DRAIN',
        label: card.cardName,
        severity: 'MAJOR',
        ticksRemaining: card.ticksRemaining,
        sourceDisplayName: sourceBot?.profile.name ?? 'Unknown Bot',
        sourceBotId: sourceBot?.profileId,
        sourceBotState: sourceBot?.state,
        impactValue: 3500,
      };

    case InjectionType.DILUTION_NOTICE:
      return {
        id: card.injectionId,
        kind: 'FORCED_SELL',
        label: card.cardName,
        severity: 'CRITICAL',
        ticksRemaining: card.ticksRemaining,
        sourceDisplayName: sourceBot?.profile.name ?? 'Unknown Bot',
        sourceBotId: sourceBot?.profileId,
        sourceBotState: sourceBot?.state,
        impactValue: 9000,
      };

    case InjectionType.HATER_HEAT_SURGE:
    default:
      return {
        id: card.injectionId,
        kind: 'HATER_BOOST',
        label: card.cardName,
        severity: 'MINOR',
        ticksRemaining: card.ticksRemaining,
        sourceDisplayName: sourceBot?.profile.name ?? 'Unknown Bot',
        sourceBotId: sourceBot?.profileId,
        sourceBotState: sourceBot?.state,
        impactValue: 1500,
      };
  }
}

function deriveIncomingAttackLabel(card: InjectedCard | null): string {
  if (!card) return 'INCOMING ATTACK';
  switch (card.injectionType) {
    case InjectionType.FORCED_SALE:
      return 'FORCED SALE';
    case InjectionType.REGULATORY_HOLD:
      return 'REGULATORY HOLD';
    case InjectionType.INVERSION_CURSE:
      return 'INVERSION CURSE';
    case InjectionType.EXPENSE_SPIKE:
      return 'EXPENSE SPIKE';
    case InjectionType.DILUTION_NOTICE:
      return 'DILUTION NOTICE';
    case InjectionType.HATER_HEAT_SURGE:
    default:
      return 'HATER HEAT SURGE';
  }
}

function deriveIncomingAttackEmoji(card: InjectedCard | null): string {
  if (!card) return '⚔️';
  switch (card.injectionType) {
    case InjectionType.FORCED_SALE:
      return '💥';
    case InjectionType.REGULATORY_HOLD:
      return '🔒';
    case InjectionType.INVERSION_CURSE:
      return '🌀';
    case InjectionType.EXPENSE_SPIKE:
      return '💸';
    case InjectionType.DILUTION_NOTICE:
      return '📉';
    case InjectionType.HATER_HEAT_SURGE:
    default:
      return '🔥';
  }
}

function deriveIncomingAttackDamage(card: InjectedCard | null): number {
  if (!card) return 0;
  switch (card.injectionType) {
    case InjectionType.FORCED_SALE:
      return 10_000;
    case InjectionType.REGULATORY_HOLD:
      return 4_500;
    case InjectionType.INVERSION_CURSE:
      return 7_500;
    case InjectionType.EXPENSE_SPIKE:
      return 3_500;
    case InjectionType.DILUTION_NOTICE:
      return 9_000;
    case InjectionType.HATER_HEAT_SURGE:
    default:
      return 2_000;
  }
}

// ─── Panel wrapper ────────────────────────────────────────────────────────────

function Panel({
  children,
  style = {},
  urgent = false,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  urgent?: boolean;
}) {
  return (
    <div
      style={{
        background: T.card,
        borderRadius: 12,
        border: `1px solid ${
          urgent ? 'rgba(255,77,77,0.30)' : 'rgba(255,77,77,0.10)'
        }`,
        padding: 16,
        boxShadow: urgent ? '0 0 24px rgba(255,77,77,0.08) inset' : 'none',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Label({
  children,
  color = T.red,
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <div
      style={{
        fontSize: 10,
        fontFamily: T.mono,
        fontWeight: 700,
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        color,
        marginBottom: 12,
      }}
    >
      {children}
    </div>
  );
}

// ─── Battle Budget HUD ────────────────────────────────────────────────────────

const BattleBudgetHUD = memo(function BattleBudgetHUD({
  budgetState,
}: {
  budgetState: BattleBudgetState | null;
}) {
  const remainingPts = budgetState?.remainingPts ?? 0;
  const totalPts = budgetState?.totalPts ?? 0;
  const spentPts = budgetState?.spentPts ?? 0;
  const pct = totalPts > 0 ? Math.min(100, (remainingPts / totalPts) * 100) : 0;
  const barColor = pct > 60 ? T.green : pct > 30 ? T.yellow : T.red;

  return (
    <Panel urgent={remainingPts <= 1 && totalPts > 0}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 14,
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <Label>Battle Budget</Label>
        <span style={{ fontSize: 11, fontFamily: T.mono, color: T.textSub }}>
          {budgetState ? budgetState.incomeTier : 'UNINITIALIZED'}
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 10,
          marginBottom: 10,
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontSize: 'clamp(1.8rem, 4vw, 2.4rem)',
            fontWeight: 800,
            fontFamily: T.display,
            color: barColor,
            transition: 'color 0.3s ease',
          }}
        >
          {fmtPts(remainingPts)}
        </span>
        <span style={{ fontSize: 12, fontFamily: T.mono, color: T.textMut }}>
          / {fmtPts(totalPts)}
        </span>
      </div>

      <div
        style={{
          height: 8,
          background: '#1A000A',
          borderRadius: 4,
          overflow: 'hidden',
          marginBottom: 14,
        }}
      >
        <div
          style={{
            height: '100%',
            borderRadius: 4,
            width: `${pct.toFixed(1)}%`,
            background: `linear-gradient(90deg, ${T.redDim}, ${barColor})`,
            transition: 'width 0.5s ease',
          }}
        />
      </div>

      <div
        style={{
          display: 'grid',
          gap: 10,
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 9,
              fontFamily: T.mono,
              color: T.textMut,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}
          >
            Remaining
          </div>
          <div style={{ fontSize: 14, fontFamily: T.mono, fontWeight: 700, color: barColor }}>
            {fmtPts(remainingPts)}
          </div>
        </div>

        <div>
          <div
            style={{
              fontSize: 9,
              fontFamily: T.mono,
              color: T.textMut,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}
          >
            Spent
          </div>
          <div style={{ fontSize: 14, fontFamily: T.mono, fontWeight: 700, color: T.orange }}>
            {fmtPts(spentPts)}
          </div>
        </div>

        <div>
          <div
            style={{
              fontSize: 9,
              fontFamily: T.mono,
              color: T.textMut,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}
          >
            Actions This Tick
          </div>
          <div style={{ fontSize: 14, fontFamily: T.mono, fontWeight: 700, color: T.text }}>
            {budgetState?.actionsExecutedThisTick.length ?? 0}
          </div>
        </div>
      </div>
    </Panel>
  );
});

// ─── Counter Window UI ────────────────────────────────────────────────────────

const CounterWindowUI = memo(function CounterWindowUI({
  ticksLeft,
  incomingAttackLabel,
  incomingAttackEmoji,
  attackDamageEstimate,
  onCounter,
  onAbsorb,
}: {
  ticksLeft: number;
  incomingAttackLabel: string;
  incomingAttackEmoji: string;
  attackDamageEstimate: number;
  onCounter: () => void;
  onAbsorb: () => void;
}) {
  const safeTicks = Math.max(0, ticksLeft);
  const urgent = safeTicks <= 2;
  const pct = Math.min(100, (safeTicks / 5) * 100);

  return (
    <div
      style={{
        borderRadius: 12,
        overflow: 'hidden',
        border: `2px solid ${urgent ? '#FF2222' : 'rgba(255,140,0,0.60)'}`,
        background: urgent ? 'rgba(255,22,22,0.08)' : 'rgba(255,140,0,0.06)',
        boxShadow: urgent
          ? '0 0 40px rgba(255,22,22,0.20)'
          : '0 0 24px rgba(255,140,0,0.12)',
      }}
    >
      <div style={{ height: 5, background: 'rgba(255,255,255,0.08)' }}>
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: urgent ? '#FF2222' : T.orange,
            transition: 'width 0.9s linear',
          }}
        />
      </div>

      <div style={{ padding: '14px 18px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 14,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: 28 }}>{incomingAttackEmoji}</span>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontFamily: T.display,
                fontSize: 'clamp(14px, 3vw, 18px)',
                fontWeight: 800,
                color: urgent ? '#FF4D4D' : T.orange,
                lineHeight: 1,
              }}
            >
              {incomingAttackLabel}
            </div>
            <div style={{ fontFamily: T.mono, fontSize: 11, color: T.textSub, marginTop: 4 }}>
              Estimated damage:{' '}
              <span style={{ color: T.red, fontWeight: 700 }}>{fmt(attackDamageEstimate)}</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                fontFamily: T.mono,
                fontSize: 10,
                color: T.textMut,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
              }}
            >
              Respond in
            </div>
            <div
              style={{
                fontFamily: T.display,
                fontSize: 'clamp(28px, 6vw, 40px)',
                fontWeight: 900,
                color: urgent ? '#FF2222' : T.orange,
                lineHeight: 1,
                textShadow: urgent ? '0 0 20px rgba(255,22,22,0.8)' : 'none',
              }}
            >
              {safeTicks}t
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button
            onClick={onCounter}
            style={{
              padding: '13px',
              borderRadius: 10,
              cursor: 'pointer',
              fontFamily: T.display,
              fontWeight: 800,
              fontSize: 14,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              minHeight: 48,
              background: 'rgba(255,140,0,0.18)',
              border: '1px solid rgba(255,140,0,0.45)',
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
              padding: '13px',
              borderRadius: 10,
              cursor: 'pointer',
              fontFamily: T.mono,
              fontWeight: 700,
              fontSize: 12,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              minHeight: 48,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.10)',
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
  extractionPhase: 'IDLE' | 'BUILDING' | 'READY' | 'LOCKED';
  extractionProgress: number;
  extractionTarget: number;
  onBeginExtraction: () => void;
  onAbortExtraction: () => void;
  onLockExtraction: () => void;
}) {
  const pct = Math.min(100, clamp01(extractionProgress) * 100);
  const color =
    extractionPhase === 'READY' || extractionPhase === 'LOCKED'
      ? T.green
      : extractionPhase === 'BUILDING'
        ? T.yellow
        : T.textMut;

  return (
    <Panel>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 14,
        }}
      >
        <Label color={color}>Extraction</Label>
        <span
          style={{
            fontSize: 9,
            fontFamily: T.mono,
            fontWeight: 700,
            padding: '3px 10px',
            borderRadius: 4,
            color,
            background: `${color}14`,
            border: `1px solid ${color}28`,
            letterSpacing: '0.1em',
          }}
        >
          {extractionPhase}
        </span>
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontFamily: T.mono, color: T.textSub }}>Build progress</span>
          <span style={{ fontSize: 12, fontFamily: T.mono, fontWeight: 700, color }}>
            {pct.toFixed(0)}%
          </span>
        </div>
        <div style={{ height: 8, background: '#1A000A', borderRadius: 4, overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              borderRadius: 4,
              width: `${pct}%`,
              background: `linear-gradient(90deg, ${T.redDim}, ${color})`,
              transition: 'width 0.6s ease',
            }}
          />
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <span style={{ fontSize: 11, fontFamily: T.mono, color: T.textSub }}>Target</span>
        <span style={{ fontSize: 14, fontFamily: T.mono, fontWeight: 700, color: T.text }}>
          {fmtPts(extractionTarget)}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        {extractionPhase === 'IDLE' && (
          <button
            onClick={onBeginExtraction}
            style={{
              flex: 1,
              padding: '11px',
              borderRadius: 8,
              cursor: 'pointer',
              fontFamily: T.mono,
              fontWeight: 700,
              fontSize: 12,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              minHeight: 44,
              background: 'rgba(255,140,0,0.12)',
              border: '1px solid rgba(255,140,0,0.30)',
              color: T.orange,
              transition: 'all 0.2s ease',
            }}
          >
            ▶ BEGIN
          </button>
        )}

        {extractionPhase === 'BUILDING' && (
          <button
            onClick={onAbortExtraction}
            style={{
              flex: 1,
              padding: '11px',
              borderRadius: 8,
              cursor: 'pointer',
              fontFamily: T.mono,
              fontWeight: 700,
              fontSize: 11,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              minHeight: 44,
              background: 'rgba(255,77,77,0.10)',
              border: '1px solid rgba(255,77,77,0.28)',
              color: T.red,
              transition: 'all 0.2s ease',
            }}
          >
            ✕ ABORT
          </button>
        )}

        {extractionPhase === 'READY' && (
          <button
            onClick={onLockExtraction}
            style={{
              flex: 1,
              padding: '11px',
              borderRadius: 8,
              cursor: 'pointer',
              fontFamily: T.display,
              fontWeight: 800,
              fontSize: 14,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              minHeight: 44,
              background: 'rgba(34,221,136,0.15)',
              border: '1px solid rgba(34,221,136,0.40)',
              color: T.green,
              boxShadow: '0 0 20px rgba(34,221,136,0.20)',
              transition: 'all 0.2s ease',
            }}
          >
            🔒 LOCK EXTRACTION
          </button>
        )}

        {extractionPhase === 'LOCKED' && (
          <div
            style={{
              flex: 1,
              padding: '11px',
              borderRadius: 8,
              textAlign: 'center',
              fontFamily: T.mono,
              fontWeight: 700,
              fontSize: 12,
              background: 'rgba(34,221,136,0.08)',
              border: '1px solid rgba(34,221,136,0.22)',
              color: T.green,
            }}
          >
            ✓ EXTRACTION LOCKED
          </div>
        )}
      </div>
    </Panel>
  );
});

// ─── Combo meter ──────────────────────────────────────────────────────────────

const ComboMeter = memo(function ComboMeter({ comboCount }: { comboCount: number }) {
  const pct = Math.min(100, comboCount * 25);
  const color =
    comboCount >= 3 ? '#FF2222' : comboCount >= 2 ? '#FF8800' : '#FFD700';
  const label = comboCount === 0 ? 'NO COMBO' : `${comboCount}× COMBO`;

  return (
    <Panel urgent={comboCount >= 2}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <Label>Hater Combo</Label>
        <span
          style={{
            fontSize: 14,
            fontWeight: 800,
            fontFamily: T.display,
            color,
            textShadow: comboCount >= 3 ? `0 0 20px ${color}` : 'none',
            transition: 'all 0.3s ease',
          }}
        >
          {label}
        </span>
      </div>

      <div
        style={{
          height: 10,
          background: '#1A000A',
          borderRadius: 6,
          overflow: 'hidden',
          marginBottom: 8,
        }}
      >
        <div
          style={{
            height: '100%',
            borderRadius: 6,
            width: `${pct}%`,
            background: `linear-gradient(90deg, #882222, ${color})`,
            boxShadow: comboCount > 0 ? `0 0 12px ${color}55` : 'none',
            transition: 'width 0.5s ease',
          }}
        />
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 9,
          fontFamily: T.mono,
          color: T.textMut,
        }}
      >
        <span>+0%</span>
        <span>+25%</span>
        <span>+50%</span>
        <span>+75%</span>
        <span style={{ color: '#FF2222' }}>+100%</span>
      </div>

      {comboCount >= 2 && (
        <div
          style={{
            marginTop: 10,
            fontSize: 11,
            color: '#FF7070',
            textAlign: 'center',
            fontFamily: T.mono,
            fontWeight: 600,
          }}
        >
          ⚠ Each unblocked attack now deals +{comboCount * 25}% pressure
        </div>
      )}
    </Panel>
  );
});

// ─── Shield status ────────────────────────────────────────────────────────────

const ShieldStatus = memo(function ShieldStatus({
  shields,
  shieldConsuming,
}: {
  shields: number;
  shieldConsuming: boolean;
}) {
  const LAYERS = ['L1 LIQUIDITY', 'L2 CREDIT', 'L3 ASSET', 'L4 NETWORK'];
  const pct = (shields / 4) * 100;
  const barColor =
    shields > 2
      ? 'linear-gradient(90deg, #224488, #4488FF)'
      : shields > 1
        ? 'linear-gradient(90deg, #886600, #FFD700)'
        : 'linear-gradient(90deg, #882200, #FF4444)';

  return (
    <Panel urgent={shields === 0}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 14,
        }}
      >
        <Label>Shield Status</Label>
        <span style={{ fontFamily: T.mono, fontSize: 11, color: shieldConsuming ? T.red : T.textSub }}>
          {shieldConsuming ? '🔥 ABSORBING' : `${shields}/4 INTACT`}
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gap: 8,
          marginBottom: 12,
          gridTemplateColumns: 'repeat(4, 1fr)',
        }}
      >
        {LAYERS.map((name, i) => {
          const intact = i < shields;
          return (
            <div
              key={name}
              style={{
                padding: '10px 6px',
                borderRadius: 8,
                textAlign: 'center',
                border: `1px solid ${
                  intact ? 'rgba(68,136,255,0.30)' : 'rgba(255,34,34,0.25)'
                }`,
                background: intact ? 'rgba(0,0,80,0.20)' : 'rgba(30,0,0,0.30)',
              }}
            >
              <div style={{ fontSize: 18, marginBottom: 4 }}>{intact ? '🛡' : '💀'}</div>
              <div
                style={{
                  fontSize: 8,
                  fontFamily: T.mono,
                  fontWeight: 700,
                  color: intact ? '#6699FF' : '#FF5555',
                  letterSpacing: '0.08em',
                }}
              >
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
        <div
          style={{
            height: '100%',
            borderRadius: 4,
            width: `${pct}%`,
            background: barColor,
            transition: 'width 0.7s ease',
          }}
        />
      </div>

      {shields === 0 && (
        <div
          style={{
            marginTop: 10,
            textAlign: 'center',
            fontSize: 12,
            fontFamily: T.mono,
            fontWeight: 700,
            color: '#FF2222',
            letterSpacing: '0.05em',
          }}
        >
          ⚠ ALL SHIELDS BREACHED — ONE HIT = BANKRUPTCY
        </div>
      )}
    </Panel>
  );
});

// ─── Sabotage arsenal ─────────────────────────────────────────────────────────

const SabotageArsenal = memo(function SabotageArsenal({
  counterplayOpen,
  counterplayTicksLeft,
}: {
  counterplayOpen: boolean;
  counterplayTicksLeft: number;
}) {
  return (
    <Panel>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 14,
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <Label>Hater Arsenal</Label>
        {counterplayOpen && (
          <span
            style={{
              fontSize: 11,
              fontFamily: T.mono,
              fontWeight: 700,
              color: T.orange,
              padding: '4px 10px',
              borderRadius: 6,
              background: 'rgba(255,140,0,0.12)',
              border: '1px solid rgba(255,140,0,0.30)',
            }}
          >
            ⚡ COUNTERPLAY — {counterplayTicksLeft} TICKS
          </span>
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gap: 8,
          gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
        }}
      >
        {SABOTAGE_CATALOG.map((card) => {
          const col = THREAT_COLORS[card.threat];
          return (
            <div
              key={card.id}
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                border: `1px solid ${col}33`,
                background: `${col}08`,
              }}
            >
              <div style={{ fontSize: 22, marginBottom: 6, lineHeight: 1 }}>{card.icon}</div>
              <div
                style={{
                  fontSize: 9,
                  fontFamily: T.mono,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: col,
                  marginBottom: 4,
                  lineHeight: 1.3,
                }}
              >
                {card.label}
              </div>
              <div style={{ fontSize: 10, color: T.textSub, lineHeight: 1.4, marginBottom: 6 }}>
                {card.desc}
              </div>
              <div
                style={{
                  display: 'inline-block',
                  fontSize: 8,
                  fontFamily: T.mono,
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: 3,
                  color: `${col}CC`,
                  background: `${col}14`,
                  border: `1px solid ${col}28`,
                }}
              >
                {card.threat}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
});

// ─── Props ────────────────────────────────────────────────────────────────────

export interface PendingCounterplay {
  eventLabel: string;
  eventDescription: string;
  eventEmoji: string;
  ticksToRespond: number;
  actions: CounterplayAction[];
  onChoose: (actionId: string) => void;
  onIgnore: () => void;
}

export interface PredatorGameScreenProps {
  pendingCounterplay: PendingCounterplay | null;
  onForfeit: () => void;
  onCounterplay: (id: string) => void;
  onBeginExtraction: () => void;
  onAbortExtraction: () => void;
  onLockExtraction: () => void;
  onCounterWindowCounter: () => void;
  onCounterWindowAbsorb: () => void;
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
  const { tick, runPhase } = useGameLoop();

  // ── Financial state — current runStore contract ───────────────────────────
  const cash = useRunStore((s) => s.cashBalance ?? 0);
  const income = useRunStore((s) => s.monthlyIncome ?? 0);
  const expenses = useRunStore((s) => s.monthlyExpenses ?? 0);
  const netWorth = useRunStore((s) => s.netWorth ?? 0);

  // ── Time / lifecycle state — current engineStore contract ────────────────
  const totalTicks = useEngineStore((s) => {
    if (s.time.seasonTickBudget > 0) return s.time.seasonTickBudget;
    if (s.run.tickBudget > 0) return s.run.tickBudget;
    return 720;
  });
  const currentTickDurationMs = useEngineStore((s) => s.time.currentTickDurationMs ?? 500);
  const activeDecisionWindows = useEngineStore((s) => s.time.activeDecisionWindows);
  const freezeTicks = 0;

  // ── Battle slice — current engineStore contract ───────────────────────────
  const haterHeatRaw = useEngineStore((s) => s.battle.haterHeat ?? 0);
  const battleBudgetState = useEngineStore((s) => s.battle.budget ?? null) as BattleBudgetState | null;
  const activeBots = useEngineStore((s) => s.battle.activeBots ?? []) as HaterBotRuntimeState[];
  const injectedCards = useEngineStore((s) => s.battle.injectedCards ?? []) as InjectedCard[];
  const lastAttackFired = useEngineStore((s) => s.battle.lastAttackFired);
  const activeBotsCount = useEngineStore((s) => s.battle.activeBotsCount ?? 0);

  // ── Shield slice — current engineStore contract ───────────────────────────
  const shieldIntegrityPct = useEngineStore((s) => s.shield.overallIntegrityPct ?? 0);
  const shieldCascade = useEngineStore((s) => s.shield.isInBreachCascade ?? false);
  const lastDamageResult = useEngineStore((s) => s.shield.lastDamageResult);

  // ── Cascade slice — used for extra threat read ────────────────────────────
  const cascadeCount = useEngineStore((s) => s.cascade.activeNegativeChains.length ?? 0);

  // ── Derived finance + board adapters ──────────────────────────────────────
  const cashflow = income - expenses;
  const heatPct = useMemo(() => normalizeHeatPct(haterHeatRaw), [haterHeatRaw]);

  const regime = useMemo<MarketRegime>(() => {
    return deriveMarketRegime(heatPct, shieldIntegrityPct, cashflow, netWorth);
  }, [heatPct, shieldIntegrityPct, cashflow, netWorth]);

  const intelligence = useMemo<IntelligenceState>(() => {
    return deriveIntelligenceState(heatPct, shieldIntegrityPct, cashflow, activeBotsCount);
  }, [heatPct, shieldIntegrityPct, cashflow, activeBotsCount]);

  const [equityHistory, setEquityHistory] = useState<number[]>([]);
  useEffect(() => {
    setEquityHistory((prev) => {
      const point = Number.isFinite(netWorth) ? netWorth : 0;
      if (prev.length === 0) return [point];
      if (prev[prev.length - 1] === point) return prev;
      const next = [...prev, point];
      const maxPoints = Math.max(24, Math.min(totalTicks, 180));
      return next.length > maxPoints ? next.slice(next.length - maxPoints) : next;
    });
  }, [netWorth, totalTicks]);

  // ── Battle HUD adapters ────────────────────────────────────────────────────
  const battlePhase = useMemo<BattlePhase>(() => {
    return deriveBattlePhase(runPhase, activeBots, injectedCards);
  }, [runPhase, activeBots, injectedCards]);

  const comboCount = useMemo(() => {
    return deriveComboCount(activeBots, injectedCards);
  }, [activeBots, injectedCards]);

  const shields = useMemo(() => {
    return Math.max(0, Math.min(4, Math.ceil(shieldIntegrityPct / 25)));
  }, [shieldIntegrityPct]);

  const shieldConsuming = shieldCascade || Boolean(lastDamageResult);

  const localScore = useMemo(() => {
    const shieldScore = clamp01(shieldIntegrityPct / 100) * 60;
    const cashflowScore = clamp01(cashflow >= 0 ? 1 : 1 - Math.min(1, Math.abs(cashflow) / 20_000)) * 40;
    return Math.max(0, Math.round(shieldScore + cashflowScore));
  }, [shieldIntegrityPct, cashflow]);

  const opponentScore = useMemo(() => {
    const threatWeight = activeBots.reduce((sum, bot) => sum + mapBotStateToThreatWeight(bot.state), 0);
    const cardThreat = injectedCards.length * 15;
    const heatThreat = clamp01(heatPct / 100) * 50;
    return Math.max(0, Math.round(heatThreat + threatWeight * 15 + cardThreat));
  }, [activeBots, injectedCards.length, heatPct]);

  const battleRound = useMemo(() => {
    const totalRounds = 12;
    const pct = totalTicks > 0 ? tick / totalTicks : 0;
    return Math.max(1, Math.min(totalRounds, Math.ceil(Math.max(0.01, pct) * totalRounds)));
  }, [tick, totalTicks]);

  const battleParticipants = useMemo<BattleParticipant[]>(() => {
    const topBot = activeBots[0];
    const opponentName = topBot?.profile.name ?? 'PREDATOR NETWORK';

    return [
      {
        id: 'local-player',
        displayName: 'YOU',
        netWorth,
        haterHeat: Math.round(heatPct),
        isLocal: true,
      },
      {
        id: topBot?.profileId ?? 'predator-network',
        displayName: opponentName,
        netWorth: Math.max(0, activeBotsCount * 5_000 + injectedCards.length * 3_000),
        haterHeat: Math.round(heatPct),
        isLocal: false,
      },
    ];
  }, [activeBots, activeBotsCount, injectedCards.length, netWorth, heatPct]);

  // ── Active sabotage adapter from injectedCards ────────────────────────────
  const activeSabotages = useMemo<ActiveSabotage[]>(() => {
    return injectedCards
      .filter((card) => !card.isExpired)
      .map((card) => {
        const sourceBot = activeBots.find((bot) => bot.profileId === card.sourceBotId);
        return mapInjectionToSabotage(card, sourceBot);
      });
  }, [injectedCards, activeBots]);

  // ── Counter window adapter ────────────────────────────────────────────────
  const primaryDecisionWindow = activeDecisionWindows[0] ?? null;

  const derivedCounterplayTicksLeft = useMemo(() => {
    if (pendingCounterplay) return Math.max(0, pendingCounterplay.ticksToRespond);

    if (!primaryDecisionWindow) return 0;

    const estimatedTicks = Math.max(
      0,
      Math.ceil(primaryDecisionWindow.durationMs / Math.max(1, currentTickDurationMs)),
    );
    const elapsedTicks = Math.max(0, tick - primaryDecisionWindow.openedAtTick);
    return Math.max(0, estimatedTicks - elapsedTicks);
  }, [pendingCounterplay, primaryDecisionWindow, currentTickDurationMs, tick]);

  const primaryInjectedCard = injectedCards[0] ?? null;

  const counterAttackLabel = pendingCounterplay?.eventLabel ?? deriveIncomingAttackLabel(primaryInjectedCard);
  const counterAttackEmoji = pendingCounterplay?.eventEmoji ?? deriveIncomingAttackEmoji(primaryInjectedCard);
  const counterDmgEstimate = deriveIncomingAttackDamage(primaryInjectedCard);

  const counterplayOpen =
    Boolean(pendingCounterplay) ||
    (derivedCounterplayTicksLeft > 0 && injectedCards.length > 0);

  // ── Local extraction adapter — no predator slice exists in repo ───────────
  const [extractionPhase, setExtractionPhase] = useState<'IDLE' | 'BUILDING' | 'READY' | 'LOCKED'>('IDLE');

  const extractionTarget = useMemo(() => {
    return Math.max(3, 4 + activeBotsCount + injectedCards.length + Math.ceil(cascadeCount / 2));
  }, [activeBotsCount, injectedCards.length, cascadeCount]);

  const extractionProgress = useMemo(() => {
    const remainingPts = battleBudgetState?.remainingPts ?? 0;
    return clamp01(remainingPts / Math.max(1, extractionTarget));
  }, [battleBudgetState, extractionTarget]);

  useEffect(() => {
    if (extractionPhase === 'BUILDING' && extractionProgress >= 1) {
      setExtractionPhase('READY');
    }
  }, [extractionPhase, extractionProgress]);

  const handleBeginExtraction = useCallback(() => {
    setExtractionPhase('BUILDING');
    onBeginExtraction();
  }, [onBeginExtraction]);

  const handleAbortExtraction = useCallback(() => {
    setExtractionPhase('IDLE');
    onAbortExtraction();
  }, [onAbortExtraction]);

  const handleLockExtraction = useCallback(() => {
    if (extractionProgress >= 1) {
      setExtractionPhase('LOCKED');
      onLockExtraction();
    }
  }, [extractionProgress, onLockExtraction]);

  // ── Event feed adapter for MomentFlash ─────────────────────────────────────
  const [events, setEvents] = useState<string[]>([]);
  const seenInjectedIdsRef = useRef<Set<string>>(new Set());
  const seenAttackIdRef = useRef<string | null>(null);
  const previousShieldCascadeRef = useRef<boolean>(false);
  const previousRunPhaseRef = useRef<string>('');

  const appendEvent = useCallback((message: string) => {
    setEvents((prev) => {
      const tagged = `[T${tick}] ${message}`;
      const next = [...prev, tagged];
      return next.length > 48 ? next.slice(next.length - 48) : next;
    });
  }, [tick]);

  useEffect(() => {
    for (const card of injectedCards) {
      if (!seenInjectedIdsRef.current.has(card.injectionId)) {
        seenInjectedIdsRef.current.add(card.injectionId);
        appendEvent(`${card.cardName} injected.`);
      }
    }
  }, [injectedCards, appendEvent]);

  useEffect(() => {
    const attackId = lastAttackFired?.attackEvent.attackId ?? null;
    if (attackId && attackId !== seenAttackIdRef.current) {
      seenAttackIdRef.current = attackId;
      appendEvent(`Predator attack fired.`);
    }
  }, [lastAttackFired, appendEvent]);

  useEffect(() => {
    if (shieldCascade && !previousShieldCascadeRef.current) {
      appendEvent('shield absorbed bankruptcy');
    }
    previousShieldCascadeRef.current = shieldCascade;
  }, [shieldCascade, appendEvent]);

  useEffect(() => {
    if (previousRunPhaseRef.current !== '' && previousRunPhaseRef.current !== runPhase) {
      appendEvent(`Run phase changed to ${runPhase}.`);
    }
    previousRunPhaseRef.current = runPhase;
  }, [runPhase, appendEvent]);

  // ── Visual phase label ─────────────────────────────────────────────────────
  const predPhase = useMemo<'early' | 'mid' | 'endgame'>(() => {
    const ratio = totalTicks > 0 ? tick / totalTicks : 0;
    if (ratio >= 0.75) return 'endgame';
    if (ratio >= 0.33) return 'mid';
    return 'early';
  }, [tick, totalTicks]);

  const phaseLabel: Record<'early' | 'mid' | 'endgame', string> = {
    early: 'EARLY GAME',
    mid: 'MID GAME',
    endgame: 'ENDGAME',
  };

  const phaseColor = predPhase === 'endgame' ? T.red : T.orange;

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(160deg, #050002 0%, #0A0005 60%, #060003 100%)',
        fontFamily: T.display,
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
      `}</style>

      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: 'rgba(5,0,2,0.94)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255,77,77,0.14)',
          padding: '10px clamp(12px,4vw,24px)',
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px 20px',
        }}
      >
        <div
          style={{
            padding: '5px 12px',
            borderRadius: 6,
            fontSize: 10,
            fontFamily: T.mono,
            fontWeight: 700,
            letterSpacing: '0.2em',
            background: 'rgba(255,77,77,0.12)',
            border: '1px solid rgba(255,77,77,0.30)',
            color: T.red,
          }}
        >
          ⚔️ PREDATOR
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px 18px',
            fontSize: 12,
            fontFamily: T.mono,
          }}
        >
          <span style={{ color: cashflow >= 0 ? T.green : T.red, fontWeight: 700 }}>
            CF {cashflow >= 0 ? '+' : ''}{fmt(cashflow)}/mo
          </span>
          <span style={{ color: T.text }}>NW {fmt(netWorth)}</span>
          <span style={{ color: comboCount >= 2 ? T.red : T.textSub }}>
            COMBO {comboCount}×
          </span>
          <span style={{ color: T.orange }}>🔥 HEAT {Math.round(heatPct)}</span>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span
            style={{
              fontSize: 11,
              fontFamily: T.mono,
              fontWeight: 700,
              color: phaseColor,
              padding: '3px 8px',
              borderRadius: 4,
              background: `${phaseColor}14`,
              border: `1px solid ${phaseColor}28`,
            }}
          >
            {phaseLabel[predPhase]}
          </span>

          {runPhase === 'PAUSED' && (
            <span
              style={{
                fontSize: 10,
                fontFamily: T.mono,
                color: T.yellow,
                padding: '3px 8px',
                borderRadius: 4,
                background: 'rgba(255,215,0,0.10)',
                border: '1px solid rgba(255,215,0,0.25)',
              }}
            >
              ⏸ PAUSED
            </span>
          )}

          <span style={{ fontSize: 11, fontFamily: T.mono, color: T.textMut }}>
            T{tick}/{totalTicks}
          </span>
        </div>
      </header>

      <div style={{ padding: '14px clamp(12px,3vw,20px) 0' }}>
        <BattleHUD
          phase={battlePhase}
          participants={battleParticipants}
          ticksRemaining={Math.max(0, totalTicks - tick)}
          roundNumber={battleRound}
          totalRounds={12}
          localScore={localScore}
          opponentScore={opponentScore}
          onForfeit={onForfeit}
        />
      </div>

      {counterplayOpen && (
        <div style={{ padding: '14px clamp(12px,3vw,20px) 0' }}>
          <CounterWindowUI
            ticksLeft={derivedCounterplayTicksLeft}
            incomingAttackLabel={counterAttackLabel}
            incomingAttackEmoji={counterAttackEmoji}
            attackDamageEstimate={counterDmgEstimate}
            onCounter={onCounterWindowCounter}
            onAbsorb={onCounterWindowAbsorb}
          />
        </div>
      )}

      <div
        style={{
          flex: 1,
          padding: 'clamp(12px,3vw,20px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div
          style={{
            display: 'grid',
            gap: 14,
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          }}
        >
          <BattleBudgetHUD budgetState={battleBudgetState} />
          <ExtractionControls
            extractionPhase={extractionPhase}
            extractionProgress={extractionProgress}
            extractionTarget={extractionTarget}
            onBeginExtraction={handleBeginExtraction}
            onAbortExtraction={handleAbortExtraction}
            onLockExtraction={handleLockExtraction}
          />
        </div>

        <div
          style={{
            display: 'grid',
            gap: 14,
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          }}
        >
          <ComboMeter comboCount={comboCount} />
          <ShieldStatus shields={shields} shieldConsuming={shieldConsuming} />
        </div>

        <SabotageArsenal
          counterplayOpen={counterplayOpen}
          counterplayTicksLeft={derivedCounterplayTicksLeft}
        />

        {activeSabotages.length > 0 && (
          <Panel>
            <SabotageImpactPanel
              activeSabotages={activeSabotages}
              tick={tick}
              onCounterplay={onCounterplay}
            />
          </Panel>
        )}

        <GameBoard
          equityHistory={equityHistory}
          cash={cash}
          netWorth={netWorth}
          income={income}
          expenses={expenses}
          regime={regime}
          intelligence={intelligence}
          tick={tick}
          totalTicks={totalTicks}
          freezeTicks={freezeTicks}
        />
      </div>

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

      <div
        style={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          width: 320,
          zIndex: 200,
          pointerEvents: 'none',
        }}
      >
        <MomentFlash events={events} tick={tick} maxVisible={3} />
      </div>
    </div>
  );
}