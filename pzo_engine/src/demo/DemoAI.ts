// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — DEMO AI
// pzo_engine/src/demo/DemoAI.ts
//
// Mode-aware AI decision engine for the guided demo runner.
// Each mode has a distinct strategy that demonstrates the correct play pattern
// a new player should learn. The AI deliberately triggers teaching moments.
//
// AI is NOT optimal-win AI — it is optimal-TEACHING AI.
// It plays naturally, makes realistic decisions, and demonstrates core loops.
// Density6 LLC · Point Zero One · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import type { GameMode }    from '../../../pzo-web/src/game/types/modes';
import type { CardInHand }  from '../../../pzo-web/src/game/types/cards';
import type { RunState }    from '../../../pzo-web/src/game/types/runState';
import type { ModeAIConfig } from './demo-config';
import { MODE_AI_CONFIGS }   from './demo-config';

// ─── AI Decision Contract ──────────────────────────────────────────────────────
export type AIActionType = 'PLAY_CARD' | 'DRAW_CARD' | 'TRIGGER_COUNTERPLAY' | 'PASS';

export interface AIDecision {
  action:       AIActionType;
  cardId?:      string;
  cardName?:    string;
  symbol?:      string;
  reasoning:    string;    // display string — teaches the player why this choice was made
  urgent:       boolean;   // if true, narrator highlights this decision
}

// ─── DEMO AI CLASS ────────────────────────────────────────────────────────────
export class DemoAI {

  private readonly mode:   GameMode;
  private readonly config: ModeAIConfig;
  private readonly rng:    () => number;

  // Internal teaching state
  private forcedCrisisTriggered: boolean = false;

  constructor(mode: GameMode, rng: () => number) {
    this.mode   = mode;
    this.config = MODE_AI_CONFIGS[mode];
    this.rng    = rng;
  }

  /**
   * decide() — core AI tick.
   * Given current run state, returns the next action with teaching rationale.
   */
  decide(state: RunState, tick: number, energy: number, hand: CardInHand[]): AIDecision {
    // ── 1. Check if we should trigger a forced crisis for teaching ─────────────
    if (
      this.config.teachCrisis &&
      this.config.forcedCrisisTick !== null &&
      tick === this.config.forcedCrisisTick &&
      !this.forcedCrisisTriggered
    ) {
      this.forcedCrisisTriggered = true;
      return {
        action:    'PASS',
        reasoning: '[DEMO] Deliberately entering distress to teach crisis mechanics.',
        urgent:    true,
      };
    }

    // ── 2. Emergency: near bankrupt — play best survival card ─────────────────
    if (state.cash < 5_000 && hand.length > 0) {
      const survivalCard = this.findCardByType(hand, ['HEDGE', 'RECOVERY', 'MACRO']);
      if (survivalCard) {
        return {
          action:    'PLAY_CARD',
          cardId:    survivalCard.id,
          cardName:  survivalCard.name,
          reasoning: 'CRITICAL: Cash near zero. Playing survival card immediately.',
          urgent:    true,
        };
      }
    }

    // ── 3. Pre-settlement: income card window (T-1 before MONTH_TICKS) ────────
    const ticksToSettlement = 12 - (tick % 12);
    if (ticksToSettlement <= 2 && hand.length > 0) {
      const incomeCard = this.findCardByType(hand, ['LONG', 'MACRO']);
      if (incomeCard && incomeCard.cost <= energy) {
        return {
          action:    'PLAY_CARD',
          cardId:    incomeCard.id,
          cardName:  incomeCard.name,
          reasoning: `Settlement in ${ticksToSettlement} ticks. Playing income card now.`,
          urgent:    false,
        };
      }
    }

    // ── 4. Mode-specific strategy ─────────────────────────────────────────────
    switch (this.mode) {
      case 'EMPIRE':    return this.decideEmpire(state, tick, energy, hand);
      case 'PREDATOR':  return this.decidePredator(state, tick, energy, hand);
      case 'SYNDICATE': return this.decideSyndicate(state, tick, energy, hand);
      case 'PHANTOM':   return this.decidePhantom(state, tick, energy, hand);
    }
  }

  // ── EMPIRE STRATEGY ──────────────────────────────────────────────────────────
  // Teaches: bleed avoidance, income stacking, isolation tax management
  private decideEmpire(state: RunState, tick: number, energy: number, hand: CardInHand[]): AIDecision {
    const bleedActive = state.modeExt?.empire?.bleedActive ?? false;

    // In bleed: play COMEBACK_SURGE or RECOVERY — nothing else matters
    if (bleedActive) {
      const comback = this.findCardByType(hand, ['COMEBACK', 'RECOVERY', 'HEDGE']);
      if (comback && comback.cost <= energy) {
        return {
          action:    'PLAY_CARD',
          cardId:    comback.id,
          cardName:  comback.name,
          reasoning: 'In BLEED — playing recovery card. Income growth is the only exit.',
          urgent:    true,
        };
      }
      // No recovery card — draw aggressively
      if (hand.length < 4) {
        return { action: 'DRAW_CARD', reasoning: 'In BLEED — drawing for recovery options.', urgent: true };
      }
    }

    // Normal: stack income-generating cards, avoid short plays while cash is thin
    if (state.cash > 15_000) {
      const incomeCard = this.findPreferredCard(hand, this.config.priorityTypes, energy);
      if (incomeCard) {
        return {
          action:    'PLAY_CARD',
          cardId:    incomeCard.id,
          cardName:  incomeCard.name,
          reasoning: `Playing ${incomeCard.cardType} to stack monthly income.`,
          urgent:    false,
        };
      }
    }

    return this.genericFallback(hand, energy, tick);
  }

  // ── PREDATOR STRATEGY ─────────────────────────────────────────────────────────
  // Teaches: counterplay windows, psyche management, BB conservation
  private decidePredator(state: RunState, tick: number, energy: number, hand: CardInHand[]): AIDecision {
    const psychePct = (state.modeExt?.predator?.psycheScore ?? 100) / 100;

    // Under TILT: play cheap cards only, preserve energy for counterplay
    if (psychePct < 0.2) {
      const cheapCard = hand.find(c => c.cost <= 1 && c.cost <= energy);
      if (cheapCard) {
        return {
          action:    'PLAY_CARD',
          cardId:    cheapCard.id,
          cardName:  cheapCard.name,
          reasoning: 'Under TILT — playing low-cost card. Conserving energy for counterplay.',
          urgent:    true,
        };
      }
      return { action: 'PASS', reasoning: 'Under TILT — conserving energy. Waiting for psyche recovery.', urgent: false };
    }

    // Counterplay first if hater bot is active
    const haterActive = (state.battleState?.activeAttacks?.length ?? 0) > 0;
    if (haterActive && energy >= 2) {
      const counterCard = this.findCardByType(hand, ['COUNTER', 'SHIELD', 'HEDGE']);
      if (counterCard && counterCard.cost <= energy) {
        return {
          action:            'PLAY_CARD',
          cardId:            counterCard.id,
          cardName:          counterCard.name,
          reasoning:         'Hater bot active — countering attack before it lands.',
          urgent:            true,
        };
      }
    }

    // Aggression mode: attack-oriented play
    if (this.rng() < this.config.aggression && energy >= 2) {
      const aggCard = this.findPreferredCard(hand, this.config.priorityTypes, energy);
      if (aggCard) {
        return {
          action:    'PLAY_CARD',
          cardId:    aggCard.id,
          cardName:  aggCard.name,
          reasoning: `Aggressive play — ${aggCard.cardType} to pressure opponent.`,
          urgent:    false,
        };
      }
    }

    return this.genericFallback(hand, energy, tick);
  }

  // ── SYNDICATE STRATEGY ────────────────────────────────────────────────────────
  // Teaches: trust management, AID contracts, treasury balance
  private decideSyndicate(state: RunState, tick: number, energy: number, hand: CardInHand[]): AIDecision {
    const trustScore = state.modeExt?.syndicate?.trustScore ?? 100;

    // Low trust: play AID cards to restore trust before it hits defection threshold
    if (trustScore < 50) {
      const aidCard = this.findCardByType(hand, ['AID', 'MACRO', 'LONG']);
      if (aidCard && aidCard.cost <= energy) {
        return {
          action:    'PLAY_CARD',
          cardId:    aidCard.id,
          cardName:  aidCard.name,
          reasoning: `Trust at ${trustScore.toFixed(0)} — playing income card to prevent defection.`,
          urgent:    trustScore < 35,
        };
      }
    }

    // Rescue window open: draw immediately for rescue options
    if (state.rescueWindow?.isOpen) {
      if (hand.length < 3) {
        return { action: 'DRAW_CARD', reasoning: 'Rescue window OPEN — drawing for rescue options.', urgent: true };
      }
    }

    // Conservative: protect treasury, play low-cost cards
    if (this.rng() < this.config.aggression && energy >= 1) {
      const safeCard = this.findPreferredCard(hand, this.config.priorityTypes, energy);
      if (safeCard) {
        return {
          action:    'PLAY_CARD',
          cardId:    safeCard.id,
          cardName:  safeCard.name,
          reasoning: `Playing ${safeCard.cardType} — trust-safe income growth.`,
          urgent:    false,
        };
      }
    }

    return this.genericFallback(hand, energy, tick);
  }

  // ── PHANTOM STRATEGY ──────────────────────────────────────────────────────────
  // Teaches: ghost delta management, legend maintenance, dynasty stacking
  private decidePhantom(state: RunState, tick: number, energy: number, hand: CardInHand[]): AIDecision {
    const ghostDelta   = state.modeExt?.phantom?.ghostDelta  ?? 0;
    const legendScore  = state.modeExt?.phantom?.legendScore ?? 100;

    // Behind ghost: aggressive play to close gap
    if (ghostDelta < -10_000) {
      const aggCard = this.findPreferredCard(hand, this.config.priorityTypes, energy);
      if (aggCard && aggCard.cost <= energy) {
        return {
          action:    'PLAY_CARD',
          cardId:    aggCard.id,
          cardName:  aggCard.name,
          reasoning: `Behind ghost by $${Math.abs(ghostDelta).toLocaleString()} — closing gap.`,
          urgent:    true,
        };
      }
    }

    // Ahead of ghost + high legend: play conservatively to protect lead
    if (ghostDelta > 0 && legendScore > 70) {
      const hedgeCard = this.findCardByType(hand, ['HEDGE', 'LONG']);
      if (hedgeCard && hedgeCard.cost <= energy) {
        return {
          action:    'PLAY_CARD',
          cardId:    hedgeCard.id,
          cardName:  hedgeCard.name,
          reasoning: `Ahead of ghost — playing HEDGE to protect lead. Legend: ${legendScore.toFixed(0)}.`,
          urgent:    false,
        };
      }
    }

    return this.genericFallback(hand, energy, tick);
  }

  // ─── Internal helpers ──────────────────────────────────────────────────────

  private findCardByType(hand: CardInHand[], types: string[]): CardInHand | undefined {
    for (const t of types) {
      const found = hand.find(c => (c.cardType as string).includes(t));
      if (found) return found;
    }
    return undefined;
  }

  private findPreferredCard(hand: CardInHand[], preferredTypes: string[], maxEnergy: number): CardInHand | undefined {
    const affordable = hand.filter(c => c.cost <= maxEnergy);
    if (affordable.length === 0) return undefined;

    for (const t of preferredTypes) {
      const found = affordable.find(c => (c.cardType as string).includes(t));
      if (found) return found;
    }
    // Fall back to highest-value affordable card
    return affordable.sort((a, b) => (b.leverage ?? 0) - (a.leverage ?? 0))[0];
  }

  private genericFallback(hand: CardInHand[], energy: number, tick: number): AIDecision {
    // Draw if hand is low
    if (hand.length < 3) {
      return { action: 'DRAW_CARD', reasoning: 'Hand low — drawing cards.', urgent: false };
    }

    // Play if we have the energy and aggression roll passes
    if (this.rng() < this.config.aggression) {
      const playable = hand.filter(c => c.cost <= energy);
      if (playable.length > 0) {
        const card = playable[0];
        return {
          action:    'PLAY_CARD',
          cardId:    card.id,
          cardName:  card.name,
          reasoning: `Playing ${card.cardType ?? 'card'} for steady income growth.`,
          urgent:    false,
        };
      }
    }

    return {
      action:    'PASS',
      reasoning: tick % 6 === 0 ? 'Holding energy — waiting for better timing window.' : '',
      urgent:    false,
    };
  }
}