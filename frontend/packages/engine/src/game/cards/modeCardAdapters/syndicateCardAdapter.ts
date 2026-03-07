// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — pzo-web/src/game/cards/modeCardAdapters/syndicateCardAdapter.ts
// Sprint 3: SYNDICATE Mode Card Adapter — Full Engine Integration
// Density6 LLC · Confidential · All Rights Reserved
// ═══════════════════════════════════════════════════════════════════════════
// SYNDICATE identity: contracts, trust, rescue, coordination, betrayal arcs.
// Card effects carry trust impact, recipient-specific previews, and defection sigs.
//
// ENGINE INTEGRATIONS (Sprint 3):
//   - Synergy bonus: partner coordination score multiplies effective income
//   - Rescue window state: rescue-synergy cards get massive premium when open
//   - Trust leakage: degraded trust bleeds income efficiency
//   - Defection arc: defection-signature cards accelerate betrayal payoff
//   - Partner shield state: if partner L3/L4 breached, aid cards emit RESCUE
//   - Cascade: PARTNER_DISTRESS cascade triggers co-op chain recovery
// ═══════════════════════════════════════════════════════════════════════════

import type { GameCard }            from '../../types/cards';
import type { RunState }            from '../../types/runState';
import type { RunEvent }            from '../../types/events';
import type { RunStateSnapshot }    from '../../../core/types';
import type { CardAdapterResult }   from '../cardResolver';

// Extended state shape for Syndicate-specific fields
interface SyndicateRunState extends RunState {
  modeState?: {
    trustScore?:         number;   // 0.0–1.0
    synergyBonus?:       number;   // 1.0–2.0
    rescueWindowOpen?:   boolean;
    partnerInDistress?:  boolean;
    combinedNetWorth?:   number;
  };
}

export function syndicateCardAdapter(
  card:  GameCard,
  state: RunState,
  snap?: RunStateSnapshot,
): CardAdapterResult {
  const s           = state as SyndicateRunState;
  const modeState   = s.modeState ?? {};
  const sideEffects: RunEvent[] = [];

  if (card.type === 'OPPORTUNITY' || card.type === 'IPA') {
    const spend = card.energyCost ?? 0;

    // Trust score modulation
    const trustImpact   = card.modeMetadata?.trustImpact ?? 0;
    const trustLeakage  = computeTrustLeakage(modeState.trustScore ?? 0.75, trustImpact);
    const baseIncome    = card.cashflowMonthly ?? 0;

    // Synergy bonus from co-op momentum — capped at 2.0×
    const synergyMult   = Math.min(modeState.synergyBonus ?? 1.0, 2.0);

    // Effective income = base × synergy × (1 - trust leakage)
    const effectiveIncome = baseIncome * synergyMult * (1 - trustLeakage);

    // Rescue window amplifier
    let rescueBonus = 0;
    if (modeState.rescueWindowOpen && card.synergies?.includes('RESCUE')) {
      rescueBonus = effectiveIncome * 0.5;
      sideEffects.push({
        type: 'TELEMETRY_EMIT',
        telemetryType: 'syndicate.rescue_play',
        payload: { cardId: card.id, rescueBonus: +rescueBonus.toFixed(2) },
      });
    }

    // Partner distress: if partner is down, aid-type cards emit rescue event
    if (modeState.partnerInDistress && card.synergies?.includes('AID')) {
      sideEffects.push({
        type:    'RESCUE_WINDOW_OPENED',
        source:  `card:${card.id}`,
        tick:    snap?.tick ?? 0,
      } as RunEvent);
    }

    // Defection arc
    if (card.modeMetadata?.defectionSignature) {
      sideEffects.push({
        type: 'TELEMETRY_EMIT',
        telemetryType: 'syndicate.defection_signal',
        payload: { cardId: card.id, tick: snap?.tick ?? 0 },
      });
    }

    sideEffects.push({
      type: 'TELEMETRY_EMIT',
      telemetryType: 'syndicate.card_play',
      payload: {
        cardId:           card.id,
        trustImpact,
        trustLeakage:     +trustLeakage.toFixed(3),
        effectiveIncome:  +effectiveIncome.toFixed(2),
        rescueBonus:      +rescueBonus.toFixed(2),
        synergyMult:      +synergyMult.toFixed(2),
        defectionSignature: card.modeMetadata?.defectionSignature ?? false,
        mode:             'SYNDICATE',
        pressureTier:     snap?.pressureTier ?? 'UNKNOWN',
      },
    });

    sideEffects.push({ type: 'SEASON_PULSE', xpGained: 6, dominionDelta: 1 });

    return {
      cashDelta:    -spend,
      incomeDelta:  effectiveIncome + rescueBonus,
      netWorthDelta: card.value ?? 0,
      sideEffects,
    };
  }

  if (card.type === 'PRIVILEGED') {
    const v = card.value ?? 0;
    // Syndicate privileged: shared treasury visibility boost
    sideEffects.push({ type: 'SEASON_PULSE', xpGained: 10, dominionDelta: 2 });
    sideEffects.push({
      type: 'TELEMETRY_EMIT',
      telemetryType: 'syndicate.privilege_shared',
      payload: { cardId: card.id, value: v, combinedNetWorth: modeState.combinedNetWorth ?? 0 },
    });
    return { cashDelta: 0, incomeDelta: 0, netWorthDelta: v, sideEffects };
  }

  return { cashDelta: 0, incomeDelta: 0, netWorthDelta: 0, sideEffects };
}

// ── Trust Leakage Rate (0.0 = no leakage → 0.35 = heavy leakage) ─────────────

function computeTrustLeakage(trustScore: number, cardTrustImpact: number): number {
  // Low trust base leakage
  const baseLeakage = Math.max(0, (0.75 - trustScore) * 0.4);
  // Negative trust-impact cards amplify leakage
  const impactLeakage = cardTrustImpact < 0 ? Math.abs(cardTrustImpact) * 0.1 : 0;
  return Math.min(0.35, baseLeakage + impactLeakage);
}
