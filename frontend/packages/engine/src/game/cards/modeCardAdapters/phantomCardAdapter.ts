// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — pzo-web/src/game/cards/modeCardAdapters/phantomCardAdapter.ts
// Sprint 3: PHANTOM Mode Card Adapter — Full Engine Integration
// Density6 LLC · Confidential · All Rights Reserved
// ═══════════════════════════════════════════════════════════════════════════
// PHANTOM identity: precision, gap-closing, anti-ghost adaptation, nerve.
// Card value is relative to delta vs legend path — not just immediate economy.
//
// ENGINE INTEGRATIONS (Sprint 3):
//   - Ghost delta: positive/negative delta changes risk appetite
//   - CORD basis point estimation from income velocity vs legend baseline
//   - TickTier: high-pressure ticks amplify gap-closing card urgency
//   - Legend pressure response: nerve cards stabilize decision speed
//   - Cascade: GHOST_BEHIND cascade triggers aggressive play amplification
//   - Proof badge condition: dynasty-tier plays checked against legend milestone
// ═══════════════════════════════════════════════════════════════════════════

import type { GameCard }            from '../../types/cards';
import type { RunState }            from '../../types/runState';
import type { RunEvent }            from '../../types/events';
import type { RunStateSnapshot }    from '../../../core/types';
import type { CardAdapterResult }   from '../cardResolver';

// Extended state for Phantom-specific fields
interface PhantomRunState extends RunState {
  modeState?: {
    ghostDelta?:       number;   // local - ghost (positive = ahead)
    ghostIsAlive?:     boolean;
    proofBadgeEarned?: boolean;
    ghostWonAt?:       number | null;
    cordGap?:          number;   // negative = behind legend
  };
}

export function phantomCardAdapter(
  card:  GameCard,
  state: RunState,
  snap?: RunStateSnapshot,
): CardAdapterResult {
  const s         = state as PhantomRunState;
  const modeState = s.modeState ?? {};
  const sideEffects: RunEvent[] = [];

  if (card.type === 'OPPORTUNITY' || card.type === 'IPA') {
    const spend         = card.energyCost ?? 0;
    const baseIncome    = card.cashflowMonthly ?? 0;
    const netWorthDelta = card.value ?? 0;

    // CORD delta — core valuation signal
    const cordDelta     = card.modeMetadata?.cordDelta
      ?? estimateCordDelta(card, state, modeState.cordGap ?? 0);

    // Legend pressure response (nerve cards stabilize under ghost pressure)
    const nerveMult     = card.modeMetadata?.legendPressureResponse ? 1.1 : 1.0;

    // Ghost position adaptive multiplier
    const ghostDelta    = modeState.ghostDelta ?? 0;
    const adaptiveMult  = computeAdaptiveMult(ghostDelta, snap);

    // Proof badge check: dynasty cards check milestone condition
    const isDynastyCard = card.type === 'PRIVILEGED' || card.modeMetadata?.dynastyTier;
    const milestoneClose = ghostDelta > 5000;
    if (isDynastyCard && milestoneClose && !modeState.proofBadgeEarned) {
      sideEffects.push({
        type: 'PROOF_BADGE_CONDITION_MET',
        source:  `card:${card.id}`,
        tick:    snap?.tick ?? 0,
      } as RunEvent);
    }

    // Ghost behind cascade: aggressive play response
    const ghostBehindCascade = snap?.activeCascades.find(
      (c) => c.chainId.includes('GHOST_BEHIND') && c.state === 'ACTIVE'
    );
    const cascadeAggressionMult = ghostBehindCascade ? 1.2 : 1.0;

    sideEffects.push({
      type: 'TELEMETRY_EMIT',
      telemetryType: 'phantom.card_play',
      payload: {
        cardId:       card.id,
        cordDelta:    +cordDelta.toFixed(4),
        nerveMult,
        adaptiveMult: +adaptiveMult.toFixed(3),
        ghostDelta:   +ghostDelta.toFixed(2),
        cascadeAggressionMult,
        legendPressureResponse: card.modeMetadata?.legendPressureResponse ?? false,
        tickTier:     snap?.tickTier ?? 'T1',
        mode:         'PHANTOM',
      },
    });

    sideEffects.push({ type: 'SEASON_PULSE', xpGained: 7, dominionDelta: 1 });

    // Extra XP when closing gap in T3/T4
    if ((snap?.tickTier === 'T3' || snap?.tickTier === 'T4') && cordDelta > 0) {
      sideEffects.push({ type: 'SEASON_PULSE', xpGained: 10, dominionDelta: 2 });
    }

    return {
      cashDelta:     -spend,
      incomeDelta:   baseIncome * nerveMult * adaptiveMult * cascadeAggressionMult,
      netWorthDelta,
      sideEffects,
    };
  }

  if (card.type === 'PRIVILEGED') {
    const v = card.value ?? 0;
    // Dynasty cards: CORD boost + proof badge progress
    sideEffects.push({ type: 'SEASON_PULSE', xpGained: 15, dominionDelta: 3 });
    sideEffects.push({
      type: 'TELEMETRY_EMIT',
      telemetryType: 'phantom.dynasty_play',
      payload: { cardId: card.id, value: v, cordDelta: 0.05, ghostDelta: modeState.ghostDelta ?? 0 },
    });
    return { cashDelta: 0, incomeDelta: 0, netWorthDelta: v, sideEffects };
  }

  return { cashDelta: 0, incomeDelta: 0, netWorthDelta: 0, sideEffects };
}

// ── Adaptive Multiplier (ghost position changes risk appetite) ────────────────

function computeAdaptiveMult(ghostDelta: number, snap?: RunStateSnapshot): number {
  // Ahead of ghost: conservative compounding
  if (ghostDelta > 10_000) return 0.95;
  // Just ahead: stay the course
  if (ghostDelta > 0)      return 1.0;
  // Slightly behind: moderate aggression
  if (ghostDelta > -5_000) return 1.05;
  // Significantly behind: high aggression
  if (ghostDelta > -15_000) return 1.15;
  // Critical deficit: maximum aggression multiplier
  return 1.25;
}

// ── CORD Delta Estimator ───────────────────────────────────────────────────────

function estimateCordDelta(
  card:    GameCard,
  state:   RunState,
  cordGap: number,
): number {
  const monthlyYield  = card.cashflowMonthly ?? 0;
  const baselinePace  = state.income * 0.02;  // 2% monthly income improvement = legend pace
  if (monthlyYield <= 0) return 0;

  const rawDelta = (monthlyYield / (baselinePace + 1)) * 0.01;
  // Gap-amplified: if behind, each increment is worth more
  const gapAmplifier = cordGap < 0 ? 1 + Math.min(Math.abs(cordGap) / 10_000, 0.5) : 1;
  return rawDelta * gapAmplifier;
}
