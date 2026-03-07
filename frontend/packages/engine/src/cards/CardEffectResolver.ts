// pzo-web/src/engines/cards/CardEffectResolver.ts
// POINT ZERO ONE — CARD EFFECT RESOLVER v2 (Phase 3 Complete)
// All CardEffectType resolutions with full EventBus routing · Density6 LLC · Confidential
//
// EFFECT ROUTING MAP:
//   INCOME_BOOST / INCOME_REDUCTION       → runStore (CARD_INCOME_BOOST / REDUCTION)
//   EXPENSE_REDUCTION / EXPENSE_SPIKE     → runStore
//   CASH_DRAIN                            → runStore (direct cash deduction)
//   SHIELD_REPAIR / SHIELD_FORTIFY        → ShieldEngine
//   HATER_HEAT_REDUCE / HATER_HEAT_SPIKE  → BattleEngine
//   BOT_NEUTRALIZE                        → BattleEngine
//   EXTRACTION_FIRE / EXTRACTION_BLOCK    → BattleEngine (Predator)
//   CASCADE_INTERRUPT / CASCADE_ACCELERATE→ CascadeEngine
//   BATTLE_BUDGET_GRANT / BATTLE_BUDGET_DRAIN → BattleEngine
//   TRUST_SCORE_BOOST / TRUST_SCORE_DRAIN → SyndicateMode
//   DIVERGENCE_DELTA / DIVERGENCE_REDUCE  → PhantomMode
//   TREASURY_INJECT / TREASURY_DRAIN      → runStore (TEAM_UP treasury)
//   VARIANCE_LOCK                         → PhantomMode
//   BLUFF_DISPLAY                         → CardUXBridge (UI only)
//   PROOF_BADGE_UNLOCK                    → SovereigntyEngine
//   CORD_BONUS_FLAT                       → SovereigntyEngine accumulator
//   HOLD_STAGE                            → HandManager (no event)
//   NO_OP                                 → null

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

// ── CORD CONTRIBUTION CONSTANTS ───────────────────────────────────────────────
// $1 income ≈ 0.000005 CORD (rough linear mapping from Card Logic Bible)
const CORD_PER_INCOME_DOLLAR   = 0.000_005;
const CORD_PER_EXPENSE_DOLLAR  = 0.000_003;
const CORD_PER_SHIELD_POINT    = 0.000_200;
const CORD_PER_HEAT_POINT      = 0.000_150;
const CORD_NEGATIVE_MULTIPLIER = 0.000_100;

// ── CARD EFFECT RESOLVER ──────────────────────────────────────────────────────

export class CardEffectResolver {
  private readonly eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  // ── PUBLIC API ─────────────────────────────────────────────────────────────

  /**
   * Resolve all effects of a played card (primary + optional secondary).
   * effect_modifier from mode overlay is applied to all magnitudes.
   *
   * @param card       - The CardInHand being played
   * @param request    - Play request (choice, target, timestamp)
   * @param tickIndex  - Current engine tick
   * @param isOptimal  - Whether this was the highest-CORD choice available
   */
  public resolve(
    card:      CardInHand,
    request:   CardPlayRequest,
    tickIndex: number,
    isOptimal: boolean,
  ): CardEffectResult {
    const playId         = uuidv4();
    const appliedEffects: AppliedEffect[] = [];
    const effectMod      = card.overlay.effect_modifier;

    // ── Primary effect ────────────────────────────────────────────────────────
    const primary = this.resolveEffect(card.definition.base_effect, effectMod, request, tickIndex, card);
    if (primary) appliedEffects.push(primary);

    // ── Secondary effect ──────────────────────────────────────────────────────
    const secondary = card.definition.base_effect.secondary;
    if (secondary) {
      const sec = this.resolveEffect(secondary, effectMod, request, tickIndex, card);
      if (sec) appliedEffects.push(sec);
    }

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

  // ── PRIVATE: EFFECT ROUTING ───────────────────────────────────────────────

  private resolveEffect(
    effect:    CardBaseEffect,
    mod:       number,
    request:   CardPlayRequest,
    tickIndex: number,
    card:      CardInHand,
  ): AppliedEffect | null {
    const scaled   = effect.magnitude * mod;
    const duration = effect.duration ?? 0;
    const cardId   = card.definition.cardId;

    switch (effect.effectType) {

      // ── INCOME ────────────────────────────────────────────────────────────
      case CardEffectType.INCOME_BOOST:
        this.eventBus.emit('CARD_INCOME_BOOST' as any, { amount: scaled, durationTicks: duration, tickIndex, cardId });
        return this.applied(effect.effectType, scaled, 'runStore', 'CARD_INCOME_BOOST');

      case CardEffectType.INCOME_REDUCTION:
        // magnitude is a fraction (e.g. 0.35 = 35% reduction) — emitted as-is
        this.eventBus.emit('CARD_INCOME_REDUCTION' as any, { fraction: scaled, durationTicks: duration, tickIndex, cardId });
        return this.applied(effect.effectType, scaled, 'runStore', 'CARD_INCOME_REDUCTION');

      // ── EXPENSE ───────────────────────────────────────────────────────────
      case CardEffectType.EXPENSE_REDUCTION:
        this.eventBus.emit('CARD_EXPENSE_REDUCTION' as any, { amount: scaled, durationTicks: duration, tickIndex, cardId });
        return this.applied(effect.effectType, scaled, 'runStore', 'CARD_EXPENSE_REDUCTION');

      case CardEffectType.EXPENSE_SPIKE:
        this.eventBus.emit('CARD_EXPENSE_SPIKE' as any, { amount: scaled, durationTicks: duration, tickIndex, cardId });
        return this.applied(effect.effectType, scaled, 'runStore', 'CARD_EXPENSE_SPIKE');

      // ── CASH DRAIN — direct deduction from liquid cash ────────────────────
      case CardEffectType.CASH_DRAIN:
        this.eventBus.emit('CARD_CASH_DRAIN' as any, { amount: Math.abs(scaled), tickIndex, cardId });
        return this.applied(effect.effectType, Math.abs(scaled), 'runStore', 'CARD_CASH_DRAIN');

      // ── SHIELD ENGINE ─────────────────────────────────────────────────────
      case CardEffectType.SHIELD_REPAIR:
        this.eventBus.emit('SHIELD_REPAIRED' as any, {
          amount: Math.round(scaled), newIntegrity: -1, layer: null, tickIndex, cardId,
        });
        return this.applied(effect.effectType, scaled, 'ShieldEngine', 'SHIELD_REPAIRED');

      case CardEffectType.SHIELD_FORTIFY:
        this.eventBus.emit('SHIELD_PASSIVE_REGEN' as any, {
          amount: Math.round(scaled), layer: null, newIntegrity: -1, tickIndex,
        });
        return this.applied(effect.effectType, scaled, 'ShieldEngine', 'SHIELD_PASSIVE_REGEN');

      // ── BATTLE ENGINE — HEAT ──────────────────────────────────────────────
      case CardEffectType.HATER_HEAT_REDUCE:
        this.eventBus.emit('CARD_HEAT_REDUCE' as any, { amount: Math.round(scaled), tickIndex, cardId });
        return this.applied(effect.effectType, scaled, 'BattleEngine', 'CARD_HEAT_REDUCE');

      case CardEffectType.HATER_HEAT_SPIKE:
        this.eventBus.emit('CARD_HEAT_SPIKE' as any, { amount: Math.round(scaled), tickIndex, cardId });
        return this.applied(effect.effectType, scaled, 'BattleEngine', 'CARD_HEAT_SPIKE');

      // ── BATTLE ENGINE — BOTS ──────────────────────────────────────────────
      case CardEffectType.BOT_NEUTRALIZE:
        this.eventBus.emit('BOT_NEUTRALIZED' as any, {
          botId: request.targetId ?? null,
          immunityTicks: Math.round(effect.duration ?? scaled),
          tickIndex,
        });
        return this.applied(effect.effectType, scaled, 'BattleEngine', 'BOT_NEUTRALIZED');

      // ── BATTLE ENGINE — EXTRACTION (Predator) ─────────────────────────────
      case CardEffectType.EXTRACTION_FIRE:
        this.eventBus.emit('CARD_EXTRACTION_FIRED' as any, {
          targetId: request.targetId, magnitude: scaled, cardId, tickIndex,
        });
        return this.applied(effect.effectType, scaled, 'BattleEngine', 'CARD_EXTRACTION_FIRED');

      case CardEffectType.EXTRACTION_BLOCK:
        this.eventBus.emit('CARD_EXTRACTION_BLOCKED' as any, {
          blockPercent: scaled, cardId, tickIndex,
        });
        return this.applied(effect.effectType, scaled, 'BattleEngine', 'CARD_EXTRACTION_BLOCKED');

      case CardEffectType.EXTRACTION_DAMAGE:
        // Resolved damage after block calculation — emitted by BattleEngine,
        // but a card can also force a damage event directly.
        this.eventBus.emit('CARD_EXTRACTION_DAMAGE' as any, {
          targetId: request.targetId, damage: scaled, cardId, tickIndex,
        });
        return this.applied(effect.effectType, scaled, 'BattleEngine', 'CARD_EXTRACTION_DAMAGE');

      // ── BATTLE ENGINE — BUDGET ────────────────────────────────────────────
      case CardEffectType.BATTLE_BUDGET_GRANT:
        this.eventBus.emit('CARD_BUDGET_GRANT' as any, { amount: Math.round(scaled), tickIndex, cardId });
        return this.applied(effect.effectType, scaled, 'BattleEngine', 'CARD_BUDGET_GRANT');

      case CardEffectType.BATTLE_BUDGET_DRAIN:
        this.eventBus.emit('CARD_BUDGET_DRAIN' as any, { amount: Math.round(scaled), tickIndex, cardId });
        return this.applied(effect.effectType, scaled, 'BattleEngine', 'CARD_BUDGET_DRAIN');

      // ── CASCADE ENGINE ────────────────────────────────────────────────────
      case CardEffectType.CASCADE_INTERRUPT:
        this.eventBus.emit('CASCADE_CHAIN_BROKEN' as any, {
          chainId: request.targetId ?? 'unknown',
          instanceId: request.targetId ?? 'unknown',
          recoveryCard: cardId,
          linksSkipped: Math.round(scaled),
          tickIndex,
        });
        return this.applied(effect.effectType, scaled, 'CascadeEngine', 'CASCADE_CHAIN_BROKEN');

      case CardEffectType.CASCADE_ACCELERATE:
        this.eventBus.emit('CARD_CASCADE_ACCELERATE' as any, { magnitude: scaled, tickIndex, cardId });
        return this.applied(effect.effectType, scaled, 'CascadeEngine', 'CARD_CASCADE_ACCELERATE');

      // ── SYNDICATE MODE — TRUST ────────────────────────────────────────────
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

      case CardEffectType.TRUST_DELTA:
        // Generic signed trust delta — positive = boost, negative = drain
        const trustEvent = scaled >= 0 ? 'CARD_TRUST_BOOST' : 'CARD_TRUST_DRAIN';
        this.eventBus.emit(trustEvent as any, {
          amount: Math.round(Math.abs(scaled)), targetId: request.targetId, tickIndex,
        });
        return this.applied(effect.effectType, scaled, 'SyndicateMode', trustEvent);

      // ── TREASURY (TEAM_UP) ────────────────────────────────────────────────
      case CardEffectType.TREASURY_INJECT:
        this.eventBus.emit('CARD_TREASURY_INJECT' as any, {
          amount: scaled, targetId: request.targetId, tickIndex, cardId,
        });
        return this.applied(effect.effectType, scaled, 'runStore', 'CARD_TREASURY_INJECT');

      case CardEffectType.TREASURY_DRAIN:
        // magnitude is a fraction (e.g. 0.4 = 40% of treasury)
        this.eventBus.emit('CARD_TREASURY_DRAIN' as any, { fraction: scaled, tickIndex, cardId });
        return this.applied(effect.effectType, scaled, 'runStore', 'CARD_TREASURY_DRAIN');

      // ── PHANTOM MODE — DIVERGENCE ─────────────────────────────────────────
      case CardEffectType.DIVERGENCE_REDUCE:
        this.eventBus.emit('CARD_DIVERGENCE_REDUCE' as any, { amount: scaled, tickIndex, cardId });
        return this.applied(effect.effectType, scaled, 'PhantomMode', 'CARD_DIVERGENCE_REDUCE');

      case CardEffectType.DIVERGENCE_DELTA:
        // Generic signed divergence delta
        const divEvent = scaled < 0 ? 'CARD_DIVERGENCE_REDUCE' : 'CARD_DIVERGENCE_INCREASE';
        this.eventBus.emit(divEvent as any, { amount: Math.abs(scaled), tickIndex, cardId });
        return this.applied(effect.effectType, scaled, 'PhantomMode', divEvent);

      case CardEffectType.VARIANCE_LOCK:
        this.eventBus.emit('CARD_VARIANCE_LOCK' as any, {
          durationTicks: Math.round(effect.duration ?? scaled), tickIndex, cardId,
        });
        return this.applied(effect.effectType, scaled, 'PhantomMode', 'CARD_VARIANCE_LOCK');

      // ── HEAT DELTA (signed heat mutation) ────────────────────────────────
      case CardEffectType.HEAT_DELTA: {
        const heatEvent = scaled < 0 ? 'CARD_HEAT_REDUCE' : 'CARD_HEAT_SPIKE';
        this.eventBus.emit(heatEvent as any, { amount: Math.abs(Math.round(scaled)), tickIndex, cardId });
        return this.applied(effect.effectType, scaled, 'BattleEngine', heatEvent);
      }

      // ── BLUFF — display only, secondary carries real effect ───────────────
      case CardEffectType.BLUFF_DISPLAY:
        // No engine effect — CardUXBridge handles opponent-facing display
        return this.applied(effect.effectType, 0, 'CardUXBridge', 'BLUFF_CARD_DISPLAYED');

      // ── PROOF BADGE ───────────────────────────────────────────────────────
      case CardEffectType.PROOF_BADGE_UNLOCK:
        this.eventBus.emit('PROOF_BADGE_CONDITION_MET' as any, {
          badgeId: request.choiceId, cardId, tickIndex,
        });
        return this.applied(effect.effectType, 1, 'SovereigntyEngine', 'PROOF_BADGE_CONDITION_MET');

      // ── CORD BONUS ────────────────────────────────────────────────────────
      case CardEffectType.CORD_BONUS_FLAT:
        this.eventBus.emit('CARD_CORD_BONUS' as any, {
          delta: scaled * card.overlay.cord_weight, tickIndex, cardId,
        });
        return this.applied(effect.effectType, scaled, 'SovereigntyEngine', 'CARD_CORD_BONUS');

      // ── HOLD STAGE — HandManager handles; no EventBus event needed ────────
      case CardEffectType.HOLD_STAGE:
        return this.applied(effect.effectType, 0, 'HandManager', 'HOLD_STAGE');

      // ── NO-OP ─────────────────────────────────────────────────────────────
      case CardEffectType.NO_OP:
        return null;

      default: {
        const _exhaustive: never = effect.effectType;
        console.warn(`[CardEffectResolver] Unhandled effect type: ${_exhaustive}`);
        return null;
      }
    }
  }

  // ── PRIVATE HELPERS ───────────────────────────────────────────────────────

  private applied(
    effectType:   CardEffectType,
    magnitude:    number,
    targetEngine: string,
    eventEmitted: string,
  ): AppliedEffect {
    return { effectType, magnitude, targetEngine, eventEmitted };
  }

  /**
   * Compute net CORD delta contribution from all applied effects.
   * Financial effects contribute proportionally per Card Logic Bible rates.
   * Negative effects reduce CORD.
   */
  private computeCordDelta(card: CardInHand, effects: AppliedEffect[]): number {
    let delta = 0;
    const cw  = card.overlay.cord_weight;

    for (const effect of effects) {
      switch (effect.effectType) {

        case CardEffectType.CORD_BONUS_FLAT:
          delta += effect.magnitude * cw;
          break;

        case CardEffectType.INCOME_BOOST:
          delta += effect.magnitude * CORD_PER_INCOME_DOLLAR * cw;
          break;

        case CardEffectType.EXPENSE_REDUCTION:
          delta += effect.magnitude * CORD_PER_EXPENSE_DOLLAR * cw;
          break;

        case CardEffectType.SHIELD_REPAIR:
        case CardEffectType.SHIELD_FORTIFY:
          delta += effect.magnitude * CORD_PER_SHIELD_POINT * cw;
          break;

        case CardEffectType.BOT_NEUTRALIZE:
        case CardEffectType.HATER_HEAT_REDUCE:
          delta += effect.magnitude * CORD_PER_HEAT_POINT * cw;
          break;

        case CardEffectType.EXTRACTION_BLOCK:
          // Defensive blocks contribute fractionally
          delta += effect.magnitude * 0.01 * cw;
          break;

        case CardEffectType.TRUST_SCORE_BOOST:
          delta += effect.magnitude * 0.002 * cw;
          break;

        case CardEffectType.DIVERGENCE_REDUCE:
          delta += effect.magnitude * 0.05 * cw;
          break;

        case CardEffectType.VARIANCE_LOCK:
          delta += effect.magnitude * 0.003 * cw;
          break;

        case CardEffectType.PROOF_BADGE_UNLOCK:
          delta += effect.magnitude * 0.05 * cw;
          break;

        // Negative effects reduce CORD
        case CardEffectType.EXPENSE_SPIKE:
        case CardEffectType.INCOME_REDUCTION:
        case CardEffectType.CASH_DRAIN:
          delta -= Math.abs(effect.magnitude) * CORD_NEGATIVE_MULTIPLIER;
          break;

        case CardEffectType.HATER_HEAT_SPIKE:
          delta -= effect.magnitude * CORD_NEGATIVE_MULTIPLIER;
          break;

        case CardEffectType.TRUST_SCORE_DRAIN:
        case CardEffectType.TREASURY_DRAIN:
          delta -= effect.magnitude * CORD_NEGATIVE_MULTIPLIER;
          break;

        default:
          break;
      }
    }

    return parseFloat(delta.toFixed(5));
  }
}