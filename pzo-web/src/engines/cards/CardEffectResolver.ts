//Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/cards/CardEffectResolver.ts

// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — CARD EFFECT RESOLVER
// pzo-web/src/engines/cards/CardEffectResolver.ts
//
// Executes the mechanical effects of a played card.
// Routes each effect to the correct engine by emitting EventBus events.
// Produces a CardEffectResult consumed by CardScorer and CardUXBridge.
//
// EFFECT ROUTING:
//   INCOME_BOOST / INCOME_REDUCTION / EXPENSE_*  → runStore (financial state)
//   SHIELD_REPAIR / SHIELD_FORTIFY               → SHIELD engine via EventBus
//   HATER_HEAT_*                                 → BATTLE engine via EventBus
//   BOT_NEUTRALIZE                               → BATTLE engine via EventBus
//   CASCADE_INTERRUPT / CASCADE_ACCELERATE       → CASCADE engine via EventBus
//   BATTLE_BUDGET_*                              → BATTLE engine via EventBus
//   TRUST_SCORE_*                                → Syndicate mode handler
//   TREASURY_INJECT / TREASURY_DRAIN             → runStore (TEAM_UP shared treasury)
//   DIVERGENCE_REDUCE / VARIANCE_LOCK            → Phantom mode handler
//   EXTRACTION_FIRE                              → BATTLE engine (Predator attack)
//   EXTRACTION_BLOCK                             → BATTLE engine (Predator counter)
//   BLUFF_DISPLAY                                → CardUXBridge (UI only — no engine effect)
//   PROOF_BADGE_UNLOCK                           → SovereigntyEngine via EventBus
//   CORD_BONUS_FLAT                              → SovereigntyEngine accumulator
//   HOLD_STAGE                                   → HandManager (Empire hold system)
//
// RULES:
//   ✦ CardEffectResolver never calls engine methods directly.
//   ✦ All engine communication is via EventBus.emit().
//   ✦ Secondary effects are resolved immediately after primary.
//   ✦ effect_modifier from overlay is applied to ALL magnitudes.
//   ✦ Negative magnitude effects (drain, reduction) are applied as absolute values.
//
// Density6 LLC · Point Zero One · Cards Engine · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import {
  CardEffectType,
  type CardInHand,
  type CardPlayRequest,
  type CardEffectResult,
  type AppliedEffect,
  type CardBaseEffect,
} from './types';
import type { EventBus } from '../zero/EventBus';
import { v4 as uuidv4 } from 'uuid';

// ── CARD EFFECT RESOLVER ───────────────────────────────────────────────────────

export class CardEffectResolver {
  private readonly eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Resolve all effects of a played card.
   * Primary effect first, then secondary if present.
   * effect_modifier from the mode overlay is applied to all magnitudes.
   *
   * @param card       - The card being played
   * @param request    - The play request (choice, target, timestamp)
   * @param tickIndex  - Current tick
   * @param isOptimal  - Whether this was the highest-CORD choice available
   */
  public resolve(
    card:      CardInHand,
    request:   CardPlayRequest,
    tickIndex: number,
    isOptimal: boolean,
  ): CardEffectResult {
    const playId       = uuidv4();
    const appliedEffects: AppliedEffect[] = [];
    const effectMod    = card.overlay.effect_modifier;

    // ── Primary effect ────────────────────────────────────────────────────────
    const primary = this.resolveEffect(
      card.definition.base_effect,
      effectMod,
      request,
      tickIndex,
      card,
    );
    if (primary) appliedEffects.push(primary);

    // ── Secondary effect (if present) ─────────────────────────────────────────
    const secondary = card.definition.base_effect.secondary;
    if (secondary) {
      const secondaryApplied = this.resolveEffect(
        secondary,
        effectMod,
        request,
        tickIndex,
        card,
      );
      if (secondaryApplied) appliedEffects.push(secondaryApplied);
    }

    // ── Compute total CORD delta from applied effects ─────────────────────────
    const totalCordDelta = this.computeCordDelta(card, appliedEffects);

    return {
      playId,
      cardInstanceId: card.instanceId,
      cardId:         card.definition.cardId,
      choiceId:       request.choiceId,
      appliedAt:      tickIndex,
      effects:        appliedEffects,
      totalCordDelta,
      isOptimalChoice: isOptimal,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE: EFFECT ROUTING
  // ═══════════════════════════════════════════════════════════════════════════

  private resolveEffect(
    effect:     CardBaseEffect,
    mod:        number,
    request:    CardPlayRequest,
    tickIndex:  number,
    card:       CardInHand,
  ): AppliedEffect | null {
    const scaled = effect.magnitude * mod;

    switch (effect.effectType) {

      // ── Financial state mutations → runStore via event ─────────────────────
      case CardEffectType.INCOME_BOOST:
        this.eventBus.emit('CARD_INCOME_BOOST' as any, {
          amount: scaled, durationTicks: effect.duration ?? 0, tickIndex, cardId: card.definition.cardId,
        });
        return this.applied(effect.effectType, scaled, 'runStore', 'CARD_INCOME_BOOST');

      case CardEffectType.INCOME_REDUCTION:
        this.eventBus.emit('CARD_INCOME_REDUCTION' as any, {
          amount: scaled, durationTicks: effect.duration ?? 0, tickIndex, cardId: card.definition.cardId,
        });
        return this.applied(effect.effectType, scaled, 'runStore', 'CARD_INCOME_REDUCTION');

      case CardEffectType.EXPENSE_REDUCTION:
        this.eventBus.emit('CARD_EXPENSE_REDUCTION' as any, {
          amount: scaled, durationTicks: effect.duration ?? 0, tickIndex, cardId: card.definition.cardId,
        });
        return this.applied(effect.effectType, scaled, 'runStore', 'CARD_EXPENSE_REDUCTION');

      case CardEffectType.EXPENSE_SPIKE:
        this.eventBus.emit('CARD_EXPENSE_SPIKE' as any, {
          amount: scaled, durationTicks: effect.duration ?? 0, tickIndex, cardId: card.definition.cardId,
        });
        return this.applied(effect.effectType, scaled, 'runStore', 'CARD_EXPENSE_SPIKE');

      // ── Shield Engine ──────────────────────────────────────────────────────
      case CardEffectType.SHIELD_REPAIR:
        this.eventBus.emit('SHIELD_REPAIRED' as any, {
          amount: Math.round(scaled), newIntegrity: -1, // ShieldEngine computes actual value
          layer: null, tickIndex, cardId: card.definition.cardId,
        });
        return this.applied(effect.effectType, scaled, 'ShieldEngine', 'SHIELD_REPAIRED');

      case CardEffectType.SHIELD_FORTIFY:
        this.eventBus.emit('SHIELD_PASSIVE_REGEN' as any, {
          amount: Math.round(scaled), layer: null, newIntegrity: -1, tickIndex,
        });
        return this.applied(effect.effectType, scaled, 'ShieldEngine', 'SHIELD_PASSIVE_REGEN');

      // ── Battle Engine — Heat ───────────────────────────────────────────────
      case CardEffectType.HATER_HEAT_REDUCE:
        this.eventBus.emit('CARD_HEAT_REDUCE' as any, {
          amount: Math.round(scaled), tickIndex, cardId: card.definition.cardId,
        });
        return this.applied(effect.effectType, scaled, 'BattleEngine', 'CARD_HEAT_REDUCE');

      case CardEffectType.HATER_HEAT_SPIKE:
        this.eventBus.emit('CARD_HEAT_SPIKE' as any, {
          amount: Math.round(scaled), tickIndex, cardId: card.definition.cardId,
        });
        return this.applied(effect.effectType, scaled, 'BattleEngine', 'CARD_HEAT_SPIKE');

      // ── Battle Engine — Bots ───────────────────────────────────────────────
      case CardEffectType.BOT_NEUTRALIZE:
        this.eventBus.emit('BOT_NEUTRALIZED' as any, {
          botId: request.targetId ?? null,
          immunityTicks: Math.round(effect.duration ?? scaled),
          tickIndex,
        });
        return this.applied(effect.effectType, scaled, 'BattleEngine', 'BOT_NEUTRALIZED');

      // ── Battle Engine — Extraction (Predator) ──────────────────────────────
      case CardEffectType.EXTRACTION_FIRE:
        this.eventBus.emit('CARD_EXTRACTION_FIRED' as any, {
          targetId: request.targetId,
          magnitude: scaled,
          cardId: card.definition.cardId,
          tickIndex,
        });
        return this.applied(effect.effectType, scaled, 'BattleEngine', 'CARD_EXTRACTION_FIRED');

      case CardEffectType.EXTRACTION_BLOCK:
        this.eventBus.emit('CARD_EXTRACTION_BLOCKED' as any, {
          blockPercent: scaled, // 0.5 = 50%, 1.0 = full block
          cardId: card.definition.cardId,
          tickIndex,
        });
        return this.applied(effect.effectType, scaled, 'BattleEngine', 'CARD_EXTRACTION_BLOCKED');

      case CardEffectType.BATTLE_BUDGET_GRANT:
        this.eventBus.emit('CARD_BUDGET_GRANT' as any, {
          amount: Math.round(scaled), tickIndex, cardId: card.definition.cardId,
        });
        return this.applied(effect.effectType, scaled, 'BattleEngine', 'CARD_BUDGET_GRANT');

      case CardEffectType.BATTLE_BUDGET_DRAIN:
        this.eventBus.emit('CARD_BUDGET_DRAIN' as any, {
          amount: Math.round(scaled), tickIndex, cardId: card.definition.cardId,
        });
        return this.applied(effect.effectType, scaled, 'BattleEngine', 'CARD_BUDGET_DRAIN');

      // ── Cascade Engine ─────────────────────────────────────────────────────
      case CardEffectType.CASCADE_INTERRUPT:
        this.eventBus.emit('CASCADE_CHAIN_BROKEN' as any, {
          chainId: request.targetId ?? 'unknown',
          instanceId: request.targetId ?? 'unknown',
          recoveryCard: card.definition.cardId,
          linksSkipped: Math.round(scaled),
          tickIndex,
        });
        return this.applied(effect.effectType, scaled, 'CascadeEngine', 'CASCADE_CHAIN_BROKEN');

      case CardEffectType.CASCADE_ACCELERATE:
        this.eventBus.emit('CARD_CASCADE_ACCELERATE' as any, {
          magnitude: scaled, tickIndex, cardId: card.definition.cardId,
        });
        return this.applied(effect.effectType, scaled, 'CascadeEngine', 'CARD_CASCADE_ACCELERATE');

      // ── Trust Score (Syndicate) ────────────────────────────────────────────
      case CardEffectType.TRUST_SCORE_BOOST:
        this.eventBus.emit('CARD_TRUST_BOOST' as any, {
          amount: Math.round(scaled), targetId: request.targetId, tickIndex,
        });
        return this.applied(effect.effectType, scaled, 'SyndicateMode', 'CARD_TRUST_BOOST');

      case CardEffectType.TRUST_SCORE_DRAIN:
        this.eventBus.emit('CARD_TRUST_DRAIN' as any, {
          amount: Math.round(scaled), targetId: request.targetId, tickIndex,
        });
        return this.applied(effect.effectType, scaled, 'SyndicateMode', 'CARD_TRUST_DRAIN');

      // ── Treasury (TEAM_UP) ─────────────────────────────────────────────────
      case CardEffectType.TREASURY_INJECT:
        this.eventBus.emit('CARD_TREASURY_INJECT' as any, {
          amount: scaled, targetId: request.targetId, tickIndex, cardId: card.definition.cardId,
        });
        return this.applied(effect.effectType, scaled, 'runStore', 'CARD_TREASURY_INJECT');

      case CardEffectType.TREASURY_DRAIN:
        this.eventBus.emit('CARD_TREASURY_DRAIN' as any, {
          fraction: scaled, tickIndex, cardId: card.definition.cardId,
        });
        return this.applied(effect.effectType, scaled, 'runStore', 'CARD_TREASURY_DRAIN');

      // ── Divergence / Variance (Phantom) ───────────────────────────────────
      case CardEffectType.DIVERGENCE_REDUCE:
        this.eventBus.emit('CARD_DIVERGENCE_REDUCE' as any, {
          amount: scaled, tickIndex, cardId: card.definition.cardId,
        });
        return this.applied(effect.effectType, scaled, 'PhantomMode', 'CARD_DIVERGENCE_REDUCE');

      case CardEffectType.VARIANCE_LOCK:
        this.eventBus.emit('CARD_VARIANCE_LOCK' as any, {
          durationTicks: Math.round(effect.duration ?? scaled), tickIndex, cardId: card.definition.cardId,
        });
        return this.applied(effect.effectType, scaled, 'PhantomMode', 'CARD_VARIANCE_LOCK');

      // ── Bluff (Predator) — display-only, secondary carries real effect ─────
      case CardEffectType.BLUFF_DISPLAY:
        // No engine effect — CardUXBridge handles the opponent-facing display
        return this.applied(effect.effectType, 0, 'CardUXBridge', 'BLUFF_CARD_DISPLAYED');

      // ── Proof Badge (Phantom) ──────────────────────────────────────────────
      case CardEffectType.PROOF_BADGE_UNLOCK:
        this.eventBus.emit('PROOF_BADGE_CONDITION_MET' as any, {
          badgeId: request.choiceId,
          cardId: card.definition.cardId,
          tickIndex,
        });
        return this.applied(effect.effectType, 1, 'SovereigntyEngine', 'PROOF_BADGE_CONDITION_MET');

      // ── CORD bonus — direct accumulator write via event ───────────────────
      case CardEffectType.CORD_BONUS_FLAT:
        this.eventBus.emit('CARD_CORD_BONUS' as any, {
          delta: scaled * card.overlay.cord_weight,
          tickIndex,
          cardId: card.definition.cardId,
        });
        return this.applied(effect.effectType, scaled, 'SovereigntyEngine', 'CARD_CORD_BONUS');

      // ── Hold Stage — HandManager call handled by CardEngine directly ───────
      case CardEffectType.HOLD_STAGE:
        // CardEngine handles hold staging — no EventBus event needed here
        return this.applied(effect.effectType, 0, 'HandManager', 'HOLD_STAGE');

      // ── No-op ──────────────────────────────────────────────────────────────
      case CardEffectType.NO_OP:
        return null;

      default: {
        const _exhaustive: never = effect.effectType;
        console.warn(`[CardEffectResolver] Unhandled effect type: ${_exhaustive}`);
        return null;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private applied(
    effectType:   CardEffectType,
    magnitude:    number,
    targetEngine: string,
    eventEmitted: string,
  ): AppliedEffect {
    return { effectType, magnitude, targetEngine, eventEmitted };
  }

  /**
   * Compute the net CORD delta contribution from all applied effects.
   * CORD_BONUS_FLAT effects contribute directly.
   * Income effects contribute proportionally.
   * Combat/extraction effects contribute via tag weights.
   */
  private computeCordDelta(card: CardInHand, effects: AppliedEffect[]): number {
    let delta = 0;

    for (const effect of effects) {
      switch (effect.effectType) {
        case CardEffectType.CORD_BONUS_FLAT:
          delta += effect.magnitude * card.overlay.cord_weight;
          break;
        case CardEffectType.INCOME_BOOST:
          // $1 income ≈ 0.000005 CORD — rough linear mapping
          delta += effect.magnitude * 0.000_005 * card.overlay.cord_weight;
          break;
        case CardEffectType.EXPENSE_REDUCTION:
          delta += effect.magnitude * 0.000_003 * card.overlay.cord_weight;
          break;
        case CardEffectType.SHIELD_REPAIR:
        case CardEffectType.BOT_NEUTRALIZE:
          // Defensive plays contribute to resilience tag weight CORD
          delta += effect.magnitude * 0.0002 * card.overlay.cord_weight;
          break;
        case CardEffectType.EXPENSE_SPIKE:
        case CardEffectType.HATER_HEAT_SPIKE:
        case CardEffectType.TRUST_SCORE_DRAIN:
          // Negative effects reduce CORD
          delta -= effect.magnitude * 0.0001;
          break;
        default:
          break;
      }
    }

    return parseFloat(delta.toFixed(5));
  }
}