// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — pzo-web/src/game/cards/cardPolicyEngine.ts
// Sprint 3: Full Engine-Aware Card Playability Policy
// Density6 LLC · Confidential · All Rights Reserved
// ═══════════════════════════════════════════════════════════════════════════
// Single source of truth for "can this card be played right now?"
// Now reads shield layers, pressure tiers, cascade state, bot FSM,
// tick tier, and mode-specific restrictions.
// CardHand calls this before rendering play buttons.
// cardResolver calls this before resolving.
//
// ARCHITECTURE: Zero side effects. Pure function. Deterministic.
// Input: (card, state snapshot) → Output: PolicyResult
// ═══════════════════════════════════════════════════════════════════════════

import type { GameCard, CardArchetype } from '../types/cards';
import { CARD_MANUALLY_PLAYABLE }       from '../types/cards';
import type { RunState }                from '../types/runState';
import type { RunStateSnapshot }        from '../../core/types';
import { ShieldLayerId }                from '../../shield/types';

// ── Policy Denial Reason Codes ─────────────────────────────────────────────

export type PolicyDenialReason =
  | 'INSUFFICIENT_CASH'
  | 'NOT_MANUALLY_PLAYABLE'
  | 'HAND_FROZEN'
  | 'POLICY_DENIED'
  | 'CASCADE_LOCKOUT'          // active catastrophic cascade suppresses plays
  | 'SHIELD_LOCKOUT'           // L4 breach → restricted play window
  | 'PRESSURE_LOCKOUT'         // CRITICAL pressure tier → only shield-synergy cards
  | 'BOT_SUPPRESSION'          // attacking bot applied opportunity-kill
  | 'TICK_TIER_LOCKOUT'        // T4 collapse speed → no slow-resolution cards
  | 'MODE_RESTRICTION'         // mode-specific disqualification
  | 'COOLDOWN_ACTIVE'          // card has cooldown from recent play
  | 'ZONE_INCOMPATIBLE'        // card cannot go to any open zone
  | 'DEFECTION_SEQUENCE_LOCK'; // Syndicate: mid-defection arc blocks non-arc plays

// ── Policy Result ─────────────────────────────────────────────────────────────

export interface PolicyResult {
  canPlay:    boolean;
  reason?:    PolicyDenialReason;
  hint?:      string;       // shown in UI tooltip
  warningHint?: string;     // shown even when canPlay=true (risky plays)
  urgencyTag?:  'FIRE_NOW' | 'OPTIMAL' | 'HOLD' | 'RISKY'; // AI / UI guidance
}

export const POLICY_ALLOWED: PolicyResult = { canPlay: true };

// ── Extended run state shape for engine-aware checks ─────────────────────────

interface EngineAwareState extends RunState {
  engineSnapshot?:     RunStateSnapshot;
  cooldownMap?:        Record<string, number>; // cardId → ticksRemaining
  defectionArcStep?:   number | null;          // Syndicate: 0–3
  opportunityKillActive?: boolean;             // Predator bot suppression
  l4BreachTicksAgo?:   number | null;          // ticks since last L4 breach
}

// ── Main Policy Check ──────────────────────────────────────────────────────────

export function checkCardPlayable(card: GameCard, state: RunState): PolicyResult {
  const s = state as EngineAwareState;
  const snap = s.engineSnapshot;

  // ── Rule 1: Archetype gating — adversity cards NEVER manually playable ────
  if (!CARD_MANUALLY_PLAYABLE[card.type]) {
    return {
      canPlay: false,
      reason:  'NOT_MANUALLY_PLAYABLE',
      hint:    `${card.type} cards arrive through the threat pipeline — they cannot be manually played.`,
    };
  }

  // ── Rule 2: Hand is frozen ────────────────────────────────────────────────
  if (state.freezeTicks > 0) {
    return {
      canPlay: false,
      reason:  'HAND_FROZEN',
      hint:    `Hand frozen — ${state.freezeTicks} tick${state.freezeTicks !== 1 ? 's' : ''} remaining.`,
    };
  }

  // ── Rule 3: Cooldown map (card-specific replay restriction) ───────────────
  if (s.cooldownMap && s.cooldownMap[card.id] > 0) {
    return {
      canPlay: false,
      reason:  'COOLDOWN_ACTIVE',
      hint:    `This card is on cooldown for ${s.cooldownMap[card.id]} more tick(s).`,
    };
  }

  // ── Engine-snapshot checks (only when orchestrator has wired snapshot) ───
  if (snap) {
    // Rule 4: Catastrophic cascade lockout
    const catastrophicCascade = snap.activeCascades.find(
      (c) => c.severity === 'CATASTROPHIC' && c.state === 'ACTIVE',
    );
    if (catastrophicCascade) {
      const isDefenseCard = card.synergies?.some(
        (s) => ['SHIELD', 'RECOVERY', 'DEFENSE'].includes(s),
      );
      if (!isDefenseCard) {
        return {
          canPlay: false,
          reason:  'CASCADE_LOCKOUT',
          hint:    'Catastrophic cascade in progress — only defense cards can be played.',
        };
      }
    }

    // Rule 5: L4 breach suppression (3-tick lock window after L4 breach)
    const l4Layer = snap.shields.layers['L4_NETWORK_CORE'];
    if (l4Layer?.breached && s.l4BreachTicksAgo != null && s.l4BreachTicksAgo < 3) {
      const isEmergencyCard = card.synergies?.includes('EMERGENCY') || card.type === 'PRIVILEGED';
      if (!isEmergencyCard) {
        return {
          canPlay: false,
          reason:  'SHIELD_LOCKOUT',
          hint:    `Network Core breach — system lockout for ${3 - (s.l4BreachTicksAgo ?? 0)} more tick(s).`,
        };
      }
    }

    // Rule 6: CRITICAL pressure tier → only shield-synergy or recovery cards
    if (snap.pressureTier === 'CRITICAL') {
      const isRelevant = card.synergies?.some(
        (s) => ['SHIELD', 'RECOVERY', 'INCOME', 'LIQUIDITY'].includes(s),
      );
      if (!isRelevant && card.type === 'PRIVILEGED') {
        return {
          canPlay: false,
          reason:  'PRESSURE_LOCKOUT',
          hint:    'Critical pressure — only income, shield, or recovery cards are allowed.',
        };
      }
    }

    // Rule 7: T4 collapse tick — large-cost slow cards are restricted
    if (snap.tickTier === 'T4') {
      const isSlowCard = (card.energyCost ?? 0) > 5_000 && !(card.synergies?.includes('INSTANT'));
      if (isSlowCard) {
        return {
          canPlay: false,
          reason:  'TICK_TIER_LOCKOUT',
          hint:    'Collapse speed — high-cost investment cards are frozen during T4.',
        };
      }
    }

    // Rule 8: Bot opportunity-kill suppression
    if (s.opportunityKillActive) {
      if (card.type === 'OPPORTUNITY' || card.type === 'IPA') {
        return {
          canPlay: false,
          reason:  'BOT_SUPPRESSION',
          hint:    'Opportunity Kill active — income cards cannot be played this window.',
        };
      }
    }
  }

  // ── Rule 9: Syndicate defection arc lock ──────────────────────────────────
  if (state.mode === 'SYNDICATE' && s.defectionArcStep != null && s.defectionArcStep > 0) {
    const isDefectionCard = card.modeMetadata?.defectionSignature === true;
    if (!isDefectionCard) {
      return {
        canPlay: false,
        reason:  'DEFECTION_SEQUENCE_LOCK',
        hint:    `Defection arc in progress (step ${s.defectionArcStep}/3) — only defection cards can resolve this arc.`,
      };
    }
  }

  // ── Rule 10: Insufficient cash ────────────────────────────────────────────
  if ((card.type === 'OPPORTUNITY' || card.type === 'IPA') && state.cash < (card.energyCost ?? 0)) {
    const shortfall = (card.energyCost ?? 0) - state.cash;
    return {
      canPlay: false,
      reason:  'INSUFFICIENT_CASH',
      hint:    `Need $${shortfall.toLocaleString()} more to play.`,
    };
  }

  // ── Warning passes (card can play, but has risk signal) ──────────────────
  const warning = computeWarningHint(card, state as EngineAwareState);
  const urgency = computeUrgencyTag(card, state as EngineAwareState);

  return { canPlay: true, warningHint: warning ?? undefined, urgencyTag: urgency };
}

// ── Urgency Classification ─────────────────────────────────────────────────────

function computeUrgencyTag(
  card: GameCard,
  state: EngineAwareState,
): PolicyResult['urgencyTag'] {
  const snap  = state.engineSnapshot;
  const spend = card.energyCost ?? 0;

  if (spend > state.cash * 0.8) return 'RISKY';
  if (snap?.pressureTier === 'HIGH' || snap?.pressureTier === 'CRITICAL') {
    if (card.synergies?.includes('SHIELD')) return 'FIRE_NOW';
  }
  if (snap?.tickTier === 'T0' && spend < state.cash * 0.3) return 'OPTIMAL';
  return 'HOLD';
}

// ── Warning Hint (risky-but-legal plays) ─────────────────────────────────────

function computeWarningHint(card: GameCard, state: EngineAwareState): string | null {
  const snap  = state.engineSnapshot;
  const spend = card.energyCost ?? 0;

  if (spend > state.cash * 0.7) {
    return `⚠ This card costs ${((spend / state.cash) * 100).toFixed(0)}% of your available cash.`;
  }
  if (snap?.haterHeat > 70 && card.type === 'OPPORTUNITY') {
    return '⚠ High hater heat — bots may attack this card immediately.';
  }
  if (snap?.pressureTier === 'HIGH' && !card.synergies?.includes('SHIELD')) {
    return '⚠ Elevated pressure — consider shields before investing.';
  }
  return null;
}

// ── Batch Policy Check (for CardHand rendering) ───────────────────────────────

export interface HandPolicy {
  card:   GameCard;
  policy: PolicyResult;
}

export function getPlayableHand(hand: GameCard[], state: RunState): HandPolicy[] {
  return hand.map((card) => ({ card, policy: checkCardPlayable(card, state) }));
}

/** Returns only playable cards — used by AI recommendation system. */
export function getPlayableOnly(hand: GameCard[], state: RunState): GameCard[] {
  return hand.filter((card) => checkCardPlayable(card, state).canPlay);
}

/** Counts cards blocked by each denial reason — used for analytics. */
export function getDenialBreakdown(
  hand: GameCard[],
  state: RunState,
): Record<PolicyDenialReason, number> {
  const counts = {} as Record<PolicyDenialReason, number>;
  for (const card of hand) {
    const result = checkCardPlayable(card, state);
    if (!result.canPlay && result.reason) {
      counts[result.reason] = (counts[result.reason] ?? 0) + 1;
    }
  }
  return counts;
}
