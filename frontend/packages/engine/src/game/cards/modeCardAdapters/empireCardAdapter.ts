// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — pzo-web/src/game/cards/modeCardAdapters/empireCardAdapter.ts
// Sprint 3: EMPIRE Mode Card Adapter — Full Engine Integration
// Density6 LLC · Confidential · All Rights Reserved
// ═══════════════════════════════════════════════════════════════════════════
// EMPIRE identity: authored survival, compounding, pressure management.
// Cards reward sequencing, shield timing, survivability, comeback arcs.
//
// ENGINE INTEGRATIONS (Sprint 3):
//   - ShieldState: bleed amplifier scales with shield degradation
//   - PressureTier: adaptive income multipliers per tier
//   - TickTier: fast-resolving card bonuses during T3/T4
//   - CascadeChains: active negative cascades trigger recovery bonus
//   - BotFSM: shield synergy cards get urgency boost near attacking bots
//   - Wave system: difficulty wave amplifies isolation tax scaling
// ═══════════════════════════════════════════════════════════════════════════

import type { GameCard }            from '../../types/cards';
import type { RunState }            from '../../types/runState';
import type { RunEvent }            from '../../types/events';
import type { RunStateSnapshot }    from '../../../core/types';
import type { CardAdapterResult }   from '../cardResolver';

export function empireCardAdapter(
  card:  GameCard,
  state: RunState,
  snap?: RunStateSnapshot,
): CardAdapterResult {
  const sideEffects: RunEvent[] = [];

  // ── Opportunity / IPA — long-game compounding ──────────────────────────
  if (card.type === 'OPPORTUNITY' || card.type === 'IPA') {
    const spend = card.energyCost ?? 0;

    // Isolation tax: solo play friction (0–8% of purchase)
    const isoModifier   = card.modeMetadata?.isolationTaxModifier ?? 1.0;
    const isolationTax  = spend * Math.max(0, isoModifier - 1);
    const cashDelta     = -(spend + isolationTax);

    // Base income / net worth
    let   incomeDelta   = card.cashflowMonthly ?? 0;
    const netWorthDelta = card.value ?? 0;

    // Pressure tier income modifier
    if (snap) {
      switch (snap.pressureTier) {
        case 'CALM':     incomeDelta *= 1.0; break;
        case 'BUILDING': incomeDelta *= 1.0; break;
        case 'ELEVATED': incomeDelta *= 0.92; break; // uncertainty friction
        case 'HIGH':     incomeDelta *= 0.85; break;
        case 'CRITICAL': incomeDelta *= 0.75; break; // crisis haircut
      }
    }

    // Bleed mode amplifier: bonus income when cash below 2× monthly income
    const inBleed   = state.cash < state.income * 2;
    const bleedBonus = (inBleed && card.modeMetadata?.bleedAmplifier)
      ? incomeDelta * 0.25
      : 0;

    // Shield degradation bonus: income cards have higher impact when shields low
    let shieldBonus = 0;
    if (snap) {
      const shieldPct = snap.shields.overallIntegrityPct;
      if (shieldPct < 0.5 && card.synergies?.includes('INCOME')) {
        shieldBonus = incomeDelta * 0.15 * (1 - shieldPct);
      }
    }

    // Active negative cascade recovery boost
    let cascadeRecoveryBonus = 0;
    if (snap) {
      const activeNegative = snap.activeCascades.filter(
        (c) => c.state === 'ACTIVE' &&
               !c.chainId.startsWith('CHAIN_08') &&
               !c.chainId.includes('PCHAIN')
      );
      if (activeNegative.length > 0 && card.synergies?.includes('RECOVERY')) {
        cascadeRecoveryBonus = incomeDelta * 0.2 * activeNegative.length;
        sideEffects.push({
          type:    'TELEMETRY_EMIT',
          telemetryType: 'empire.recovery_during_cascade',
          payload: {
            cardId:         card.id,
            cascadeCount:   activeNegative.length,
            recoveryBonus:  cascadeRecoveryBonus,
          },
        });
      }
    }

    // Comeback surge: bonus XP for plays in negative cashflow
    const cashflow = state.income - state.expenses;
    if (cashflow < 0 && incomeDelta > 0) {
      sideEffects.push({ type: 'SEASON_PULSE', xpGained: 15, dominionDelta: 1 });
    }

    // Decision quality tag
    const decisionTag = determineDecisionTag(card, state, snap);

    sideEffects.push({
      type: 'TELEMETRY_EMIT',
      telemetryType: 'empire.card_play',
      payload: {
        cardId: card.id, mode: 'EMPIRE',
        isolationTax:  +isolationTax.toFixed(2),
        inBleed,
        bleedBonus:    +bleedBonus.toFixed(2),
        shieldBonus:   +shieldBonus.toFixed(2),
        cascadeRecoveryBonus: +cascadeRecoveryBonus.toFixed(2),
        pressureTier:  snap?.pressureTier ?? 'UNKNOWN',
        tickTier:      snap?.tickTier ?? 'UNKNOWN',
        decisionTag,
      },
    });

    sideEffects.push({ type: 'SEASON_PULSE', xpGained: 5, dominionDelta: 0 });

    // T3/T4 tick tier: instant-class cards earn extra XP
    if ((snap?.tickTier === 'T3' || snap?.tickTier === 'T4') && card.synergies?.includes('INSTANT')) {
      sideEffects.push({ type: 'SEASON_PULSE', xpGained: 8, dominionDelta: 1 });
    }

    return {
      cashDelta,
      incomeDelta: incomeDelta + bleedBonus + shieldBonus + cascadeRecoveryBonus,
      netWorthDelta,
      sideEffects,
    };
  }

  // ── PRIVILEGED — net worth spike ──────────────────────────────────────
  if (card.type === 'PRIVILEGED') {
    const v = card.value ?? 0;
    // Privileged cards near L4 breach trigger maximum XP payout
    const nearL4Breach = snap?.shields.layers['L4_NETWORK_CORE']?.breached ?? false;
    const xpBonus = nearL4Breach ? 25 : 0;

    sideEffects.push({
      type: 'SEASON_PULSE',
      xpGained:    10 + xpBonus,
      dominionDelta: nearL4Breach ? 5 : 3,
    });
    sideEffects.push({
      type: 'TELEMETRY_EMIT',
      telemetryType: 'empire.privileged_play',
      payload: { cardId: card.id, value: v, nearL4Breach, xpBonus },
    });
    return { cashDelta: 0, incomeDelta: 0, netWorthDelta: v, sideEffects };
  }

  return { cashDelta: 0, incomeDelta: 0, netWorthDelta: 0, sideEffects };
}

// ── Decision Quality Tagger ────────────────────────────────────────────────────

function determineDecisionTag(
  card:  GameCard,
  state: RunState,
  snap?: RunStateSnapshot,
): 'FAST' | 'LATE' | 'OPTIMAL' | 'RISKY' | 'SURVIVAL' {
  const spend    = card.energyCost ?? 0;
  const cashflow = state.income - state.expenses;

  if (snap?.tickTier === 'T4')              return 'SURVIVAL';
  if (spend > state.cash * 0.7)             return 'RISKY';
  if (cashflow > 0 && spend < state.cash * 0.3) return 'OPTIMAL';
  if (state.freezeTicks > 0)                return 'LATE';
  return 'FAST';
}
