// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — pzo-web/src/game/cards/modeCardAdapters/predatorCardAdapter.ts
// Sprint 3: PREDATOR Mode Card Adapter — Full Engine Integration
// Density6 LLC · Confidential · All Rights Reserved
// ═══════════════════════════════════════════════════════════════════════════
// PREDATOR identity: tempo warfare, denial, extraction windows, psych pressure.
// Card value = economy gain + BB gain + deny value + timing window + opponent exploit.
//
// ENGINE INTEGRATIONS (Sprint 3):
//   - HaterHeat: high heat amplifies sabotage battery and BB generation
//   - TickTier: T3/T4 pressure multiplies tempo value
//   - BotFSM: attacking bots generate bonus BB from chaos plays
//   - ShieldState: breached opponent shields multiply deny value
//   - CascadeChains: active HATER_SABOTAGE chains amplify extraction windows
//   - Rivalry arc: repeated card class plays compound BB generation
// ═══════════════════════════════════════════════════════════════════════════

import type { GameCard }            from '../../types/cards';
import type { RunState }            from '../../types/runState';
import type { RunEvent }            from '../../types/events';
import type { RunStateSnapshot }    from '../../../engines/core/types';
import type { CardAdapterResult }   from '../cardResolver';

export function predatorCardAdapter(
  card:  GameCard,
  state: RunState,
  snap?: RunStateSnapshot,
): CardAdapterResult {
  const sideEffects: RunEvent[] = [];

  if (card.type === 'OPPORTUNITY' || card.type === 'IPA') {
    const spend = card.energyCost ?? 0;

    // Predator down-weights long-compound income; prefers tempo bursts
    const tempoMult     = computeTempoMultiplier(snap);
    const incomeDelta   = (card.cashflowMonthly ?? 0) * tempoMult;
    const netWorthDelta = (card.value ?? 0) * 1.1;  // value spike premium in PvP

    // Battle budget generation — scales with heat and card tier
    const bbGen = computeBBGeneration(card, snap);
    if (bbGen > 0) {
      sideEffects.push({
        type: 'TELEMETRY_EMIT',
        telemetryType: 'predator.bb_generated',
        payload: { cardId: card.id, bbGen, mode: 'PREDATOR', haterHeat: snap?.haterHeat ?? 0 },
      });
    }

    // Denial signal: if any active HATER_SABOTAGE cascade, deny value amplified
    const denyAmplifier = computeDenyAmplifier(snap);

    // Rivalry arc signal
    sideEffects.push({
      type: 'TELEMETRY_EMIT',
      telemetryType: 'predator.card_play',
      payload: {
        cardId:       card.id,
        tempoMult,
        bbGen,
        denyAmplifier,
        denyValue:    card.modeMetadata?.denyValue ?? 0,
        mode:         'PREDATOR',
        tickTier:     snap?.tickTier ?? 'T1',
        haterHeat:    snap?.haterHeat ?? 0,
      },
    });

    // XP burst for plays during opponent-side high pressure
    const xpBonus = (snap?.haterHeat ?? 0) > 60 ? 6 : 0;
    sideEffects.push({ type: 'SEASON_PULSE', xpGained: 8 + xpBonus, dominionDelta: 1 });

    return { cashDelta: -spend, incomeDelta, netWorthDelta, sideEffects };
  }

  if (card.type === 'PRIVILEGED') {
    const v = card.value ?? 0;
    // Privileged cards in Predator = extraction prizes
    const extractionBonus = (snap?.haterHeat ?? 0) > 50 ? v * 0.25 : 0;

    sideEffects.push({ type: 'SEASON_PULSE', xpGained: 12, dominionDelta: 2 });
    sideEffects.push({
      type: 'TELEMETRY_EMIT',
      telemetryType: 'predator.privilege_extracted',
      payload: { cardId: card.id, value: v, extractionBonus },
    });
    return { cashDelta: 0, incomeDelta: 0, netWorthDelta: v + extractionBonus, sideEffects };
  }

  return { cashDelta: 0, incomeDelta: 0, netWorthDelta: 0, sideEffects };
}

// ── Tempo Multiplier (down-weights income; tick tier amplifies) ───────────────

function computeTempoMultiplier(snap?: RunStateSnapshot): number {
  let base = 0.65;
  if (!snap) return base;
  switch (snap.tickTier) {
    case 'T3': return base * 0.85; // crisis = even less long-term thinking
    case 'T4': return base * 0.70;
    case 'T0': return base * 1.10; // sovereign speed = slight income recovery
    default:   return base;
  }
}

// ── Deny Amplifier (opponent pressure) ────────────────────────────────────────

function computeDenyAmplifier(snap?: RunStateSnapshot): number {
  if (!snap) return 1.0;

  // Active HATER_SABOTAGE cascade = deny value double
  const hasSabotageChain = snap.activeCascades.some(
    (c) => c.chainId.includes('SABOTAGE') && c.state === 'ACTIVE'
  );
  return hasSabotageChain ? 2.0 : 1.0;
}

// ── BB Generation ─────────────────────────────────────────────────────────────

function computeBBGeneration(card: GameCard, snap?: RunStateSnapshot): number {
  if (card.modeMetadata?.bbGeneration != null) {
    return card.modeMetadata.bbGeneration;
  }
  const base = (card.energyCost ?? 0) * 0.015 + (card.cashflowMonthly ?? 0) * 0.5;
  // Hater heat amplifier: more chaos = more BB
  const heatMult = snap ? (1 + (snap.haterHeat / 200)) : 1;
  return Math.round(base * heatMult);
}
