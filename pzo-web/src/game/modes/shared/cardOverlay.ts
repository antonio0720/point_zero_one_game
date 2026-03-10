import type {
  BaseCardLike,
  EffectPayload,
  FrontendRunMode,
  RuntimeModeCard,
  Targeting,
  TimingClass,
} from '../contracts';
import { MODE_LEGAL_DECKS, TAG_WEIGHTS } from './constants';
import { modeCodeFor } from './helpers';

export interface CardOverlayContext {
  mode: FrontendRunMode;
  pressureTierMultiplier?: number;
  trustScore?: number;
  momentumScore?: number;
  nearLegendMarker?: boolean;
}

export function applyModeOverlay(card: BaseCardLike, context: CardOverlayContext): RuntimeModeCard {
  const modeCode = modeCodeFor(context.mode);
  const legalDeck = MODE_LEGAL_DECKS[context.mode].includes(card.deck_type);
  const overlay = card.mode_overlay?.[context.mode] ?? {};
  const costModifier = overlay.cost_modifier ?? inferCostModifier(card, context);
  const effectModifier = overlay.effect_modifier ?? inferEffectModifier(card, context);
  const timingLock = overlay.timing_lock ?? inferTimingLocks(card, context);
  const targeting = overlay.targeting_override ?? inferTargeting(card, context.mode);
  const tagWeights = { ...TAG_WEIGHTS[modeCode], ...(overlay.tag_weights ?? {}) };
  const runtimeEffect = multiplyEffect(card.base_effect, effectModifier);
  const runtimeCost = Math.max(0, Math.round(card.base_cost * costModifier));

  return {
    ...card,
    runtime_cost: runtimeCost,
    runtime_effect: runtimeEffect,
    runtime_timing: uniqueTiming([card.timing_class, ...timingLock]),
    runtime_targeting: targeting,
    runtime_tag_weights: tagWeights,
    legal_in_mode: (overlay.legal ?? true) && legalDeck && isCardLegal(card, context.mode),
  };
}

export function applyModeOverlays(cards: BaseCardLike[], context: CardOverlayContext): RuntimeModeCard[] {
  return cards.map(card => applyModeOverlay(card, context));
}

function inferCostModifier(card: BaseCardLike, context: CardOverlayContext): number {
  if (context.mode === 'asymmetric-pvp' && card.deck_type === 'COUNTER') return 0.75;
  if (context.mode === 'co-op' && ['AID', 'RESCUE', 'TRUST'].includes(card.deck_type)) {
    const trustFactor = context.trustScore ? Math.max(0.75, 1 - context.trustScore / 500) : 1;
    return trustFactor;
  }
  if (context.mode === 'ghost' && context.nearLegendMarker && card.divergence_potential === 'HIGH') return 0.9;
  if (context.mode === 'solo' && card.deck_type === 'PRIVILEGED') return 1.0;
  return 1.0;
}

function inferEffectModifier(card: BaseCardLike, context: CardOverlayContext): number {
  const pressureMultiplier = context.pressureTierMultiplier ?? 1;
  if (context.mode === 'solo' && context.momentumScore && context.momentumScore > 0.7 && ['OPPORTUNITY', 'IPA'].includes(card.deck_type)) {
    return 1.12 * pressureMultiplier;
  }
  if (context.mode === 'asymmetric-pvp' && ['SABOTAGE', 'COUNTER', 'BLUFF'].includes(card.deck_type)) {
    return 1.15 * pressureMultiplier;
  }
  if (context.mode === 'co-op' && ['AID', 'RESCUE', 'TRUST'].includes(card.deck_type)) {
    const trustBonus = context.trustScore ? 1 + Math.min(0.25, context.trustScore / 400) : 1;
    return trustBonus * pressureMultiplier;
  }
  if (context.mode === 'ghost' && context.nearLegendMarker) {
    return (card.divergence_potential === 'HIGH' ? 1.2 : 1.08) * pressureMultiplier;
  }
  return pressureMultiplier;
}

function inferTimingLocks(card: BaseCardLike, context: CardOverlayContext): TimingClass[] {
  if (context.mode === 'asymmetric-pvp' && card.deck_type === 'COUNTER') return ['CTR'];
  if (context.mode === 'co-op' && card.deck_type === 'RESCUE') return ['RES'];
  if (context.mode === 'co-op' && card.deck_type === 'AID') return ['AID'];
  if (context.mode === 'ghost' && card.deck_type === 'GHOST') return ['GBM'];
  if (context.mode === 'solo' && card.deck_type === 'OPPORTUNITY' && card.tags.includes('momentum')) return ['PRE'];
  return [];
}

function inferTargeting(card: BaseCardLike, mode: FrontendRunMode): Targeting {
  if (mode === 'solo') return 'SELF';
  if (mode === 'asymmetric-pvp' && ['SABOTAGE', 'BLUFF'].includes(card.deck_type)) return 'OPPONENT';
  if (mode === 'co-op' && ['AID', 'RESCUE'].includes(card.deck_type)) return 'TEAMMATE';
  if (mode === 'co-op' && card.deck_type === 'TRUST') return 'TEAM';
  if (mode === 'ghost' && card.deck_type === 'GHOST') return 'GLOBAL';
  return card.targeting ?? 'SELF';
}

function multiplyEffect(effect: EffectPayload, modifier: number): EffectPayload {
  const out: EffectPayload = {};
  for (const [key, value] of Object.entries(effect)) {
    (out as Record<string, unknown>)[key] = typeof value === 'number' ? roundHalfUp(value * modifier) : value;
  }
  return out;
}

function roundHalfUp(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function isCardLegal(card: BaseCardLike, mode: FrontendRunMode): boolean {
  if (!card.mode_legal || card.mode_legal.length === 0) return true;
  return card.mode_legal.includes(mode);
}

function uniqueTiming(values: TimingClass[]): TimingClass[] {
  return Array.from(new Set(values));
}
