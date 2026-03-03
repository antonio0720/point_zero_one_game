// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — pzo-web/src/game/cards/cardValuation.ts
// Sprint 3: Engine-Deep Card Valuation
// Density6 LLC · Confidential · All Rights Reserved
// ═══════════════════════════════════════════════════════════════════════════
// Every mode values cards differently. Same card, radically different weights.
// Now integrates:
//   - RunStateSnapshot: pressure tier, tick tier, shield layers, cascades
//   - Bot FSM states: threat proximity amplifies defensive card premiums
//   - Cascade chain severity: active chains modify risk/reward calculus
//   - Season momentum: positive cascades modify upside valuations
//   - Concurrency-safe: pure function, no mutations
// ═══════════════════════════════════════════════════════════════════════════

import type { GameCard, CardValuationContext } from '../types/cards';
import type { RunStateSnapshot, BotRuntimeState, BotState } from '../../engines/core/types';
import { ShieldLayerId }                        from '../../engines/shield/types';
import { CascadeSeverity, CascadeDirection }    from '../../engines/cascade/types';

// ── Valuation Output ──────────────────────────────────────────────────────────

export interface CardValue {
  total:          number;    // composite score — used for AI recommendations
  economyGain:    number;    // direct income / net worth improvement
  tempoValue:     number;    // how much it accelerates / denies timing windows
  denyValue:      number;    // Predator: value of blocking opponent access
  bbGeneration:   number;    // Predator: battle budget generated
  cordDelta:      number;    // Phantom: CORD basis points vs legend
  trustImpact:    number;    // Syndicate: trust score delta
  shieldValue:    number;    // bonus value from shield-synergy in exposed state
  cascadeModifier: number;   // cascade pressure multiplier applied
  pressureBonus:  number;    // pressure-tier urgency premium
  botThreatBonus: number;    // defensive premium from active bot attacks
  labelHints:     string[];  // human-readable scoring breakdown for UI
}

const ZERO_VALUE: CardValue = {
  total: 0, economyGain: 0, tempoValue: 0, denyValue: 0,
  bbGeneration: 0, cordDelta: 0, trustImpact: 0,
  shieldValue: 0, cascadeModifier: 1, pressureBonus: 0, botThreatBonus: 0,
  labelHints: [],
};

// ── Extended Valuation Context ─────────────────────────────────────────────────

export interface ExtendedValuationContext extends CardValuationContext {
  engineSnapshot?:  RunStateSnapshot;
  seasonMomentum?:  number;   // 0–100, from PositiveCascadeTracker
  haterHeat?:       number;   // 0–100
  activeBotCount?:  number;
  highestBotThreat?: BotState;
}

// ── Entry Point ────────────────────────────────────────────────────────────────

export function scoreCard(card: GameCard, ctx: ExtendedValuationContext): CardValue {
  const base            = computeBaseValue(card, ctx);
  const shieldValue     = computeShieldBonus(card, ctx);
  const cascadeModifier = computeCascadeModifier(ctx);
  const pressureBonus   = computePressureBonus(card, ctx);
  const botThreatBonus  = computeBotThreatBonus(card, ctx);

  let modeValue: CardValue;
  switch (ctx.mode) {
    case 'EMPIRE':    modeValue = scoreEmpire(card, ctx, base);    break;
    case 'PREDATOR':  modeValue = scorePredator(card, ctx, base);  break;
    case 'SYNDICATE': modeValue = scoreSyndicate(card, ctx, base); break;
    case 'PHANTOM':   modeValue = scorePhantom(card, ctx, base);   break;
    default:          modeValue = { ...ZERO_VALUE, economyGain: base };
  }

  // Combine cross-engine signals into final total
  const engineBonus = shieldValue + pressureBonus + botThreatBonus;
  const total = (modeValue.total + engineBonus) * cascadeModifier;

  return {
    ...modeValue,
    total,
    shieldValue,
    cascadeModifier,
    pressureBonus,
    botThreatBonus,
  };
}

// ── Base Value (mode-agnostic foundation) ─────────────────────────────────────

function computeBaseValue(card: GameCard, ctx: ExtendedValuationContext): number {
  if (card.type === 'OPPORTUNITY' || card.type === 'IPA') {
    const monthlyYield  = card.cashflowMonthly ?? 0;
    const netWorthGain  = card.value ?? 0;
    const roiScore      = card.energyCost
      ? (monthlyYield * 12) / card.energyCost
      : 0;
    // Season momentum amplifies growth plays
    const momentumMult  = 1 + ((ctx.seasonMomentum ?? 0) / 1000);
    return (monthlyYield * 12 + netWorthGain * 0.05 + roiScore * 1000) * momentumMult;
  }
  if (card.type === 'PRIVILEGED') return (card.value ?? 0) * 0.8;
  return 0;
}

// ── Shield Value (cross-mode: exposed positions amplify shield-synergy cards) ──

function computeShieldBonus(card: GameCard, ctx: ExtendedValuationContext): number {
  const snap = ctx.engineSnapshot;
  if (!snap) return 0;

  const hasShieldSynergy = card.synergies?.some((s) => ['SHIELD', 'RECOVERY', 'DEFENSE'].includes(s));
  if (!hasShieldSynergy) return 0;

  // L4 breach = maximum shield premium
  if (snap.shields.layers['L4_NETWORK_CORE']?.breached)   return 8000;
  if (snap.shields.layers['L3_ASSET_FLOOR']?.breached)    return 5000;
  if (snap.shields.layers['L2_CREDIT_LINE']?.breached)    return 3000;
  if (snap.shields.layers['L1_LIQUIDITY_BUFFER']?.breached) return 1500;

  // Shield integrity degradation premium
  const overallPct = snap.shields.overallIntegrityPct;
  if (overallPct < 0.4) return 2000 * (1 - overallPct);

  return 0;
}

// ── Cascade Modifier (negative cascades suppress growth; positive amplify it) ──

function computeCascadeModifier(ctx: ExtendedValuationContext): number {
  const snap = ctx.engineSnapshot;
  if (!snap || snap.activeCascades.length === 0) return 1.0;

  let modifier = 1.0;
  for (const cascade of snap.activeCascades) {
    if (cascade.state !== 'ACTIVE') continue;
    // Determine direction from chained effects (check if it's a positive chain ID)
    const isPositive = cascade.chainId.startsWith('CHAIN_08') ||
                       cascade.chainId.includes('POSITIVE') ||
                       cascade.chainId.includes('PCHAIN');
    switch (cascade.severity) {
      case 'CATASTROPHIC': modifier *= isPositive ? 1.4 : 0.6; break;
      case 'HIGH':         modifier *= isPositive ? 1.25 : 0.75; break;
      case 'MEDIUM':       modifier *= isPositive ? 1.12 : 0.88; break;
      case 'LOW':          modifier *= isPositive ? 1.05 : 0.95; break;
    }
  }
  return Math.max(0.4, Math.min(2.0, modifier));
}

// ── Pressure Bonus (higher pressure tier → defensive / income cards worth more) ─

function computePressureBonus(card: GameCard, ctx: ExtendedValuationContext): number {
  const snap = ctx.engineSnapshot;
  if (!snap) return 0;

  const isIncomeSynergy = card.synergies?.some((s) =>
    ['INCOME', 'SHIELD', 'RECOVERY', 'LIQUIDITY'].includes(s)
  );

  switch (snap.pressureTier) {
    case 'CRITICAL':  return isIncomeSynergy ? 6000 : -2000;
    case 'HIGH':      return isIncomeSynergy ? 3000 : -500;
    case 'ELEVATED':  return isIncomeSynergy ? 1000 : 0;
    default:          return 0;
  }
}

// ── Bot Threat Bonus (attacking bot → counter-synergy cards get massive premium) ─

function computeBotThreatBonus(card: GameCard, ctx: ExtendedValuationContext): number {
  const snap = ctx.engineSnapshot;
  if (!snap) return 0;

  let bonus = 0;
  for (const [botId, botState] of Object.entries(snap.botStates)) {
    if (botState.state === 'ATTACKING' || botState.state === 'TARGETING') {
      // Defense cards get urgency premium per active bot
      if (card.synergies?.includes('SHIELD') || card.synergies?.includes('DEFENSE')) {
        bonus += botState.state === 'ATTACKING' ? 3000 : 1500;
      }
      // Income cards near a LIQUIDATOR attack get penalty (wrong priority)
      if (botId === 'BOT_01_LIQUIDATOR' && card.type === 'IPA') {
        bonus -= 500;
      }
    }
  }
  return bonus;
}

// ── EMPIRE Scoring (survival, compounding, pressure management) ───────────────

function scoreEmpire(card: GameCard, ctx: ExtendedValuationContext, base: number): CardValue {
  let economyGain = base;
  const labels: string[] = [];
  const snap = ctx.engineSnapshot;

  // Distress multiplier — recovery cards premium in cash-scarce state
  const cashRunway = ctx.cash / Math.max(ctx.income, 1);
  if (cashRunway < 3) {
    const distressBoost = 1 + (1 - cashRunway / 3) * 0.5;
    economyGain *= distressBoost;
    if (distressBoost > 1.2) labels.push(`+${Math.round((distressBoost - 1) * 100)}% distress boost`);
  }

  // Isolation tax modifier
  if (card.modeMetadata?.isolationTaxModifier) {
    economyGain *= card.modeMetadata.isolationTaxModifier;
    labels.push(`isolation tax ×${card.modeMetadata.isolationTaxModifier.toFixed(2)}`);
  }

  // Bleed mode amplifier
  const inBleed = ctx.cash < ctx.income * 2;
  if (inBleed && card.modeMetadata?.bleedAmplifier) {
    economyGain *= 1.35;
    labels.push('+35% bleed amplifier');
  }

  // Wave-aware scaling (higher difficulty wave = slower but safer cards preferred)
  if (snap) {
    const waveMultiplier = snap.haterHeat > 60 ? 1.15 : 1.0;
    economyGain *= waveMultiplier;
    if (waveMultiplier > 1) labels.push(`+${Math.round((waveMultiplier - 1) * 100)}% heat pressure`);
  }

  // Tick tier: T3–T4 = fast-resolving cards worth more
  if (snap?.tickTier === 'T3' || snap?.tickTier === 'T4') {
    if (card.synergies?.includes('INSTANT')) {
      economyGain *= 1.2;
      labels.push('+20% T3/T4 instant bonus');
    }
  }

  const total = economyGain;
  return { ...ZERO_VALUE, total, economyGain, labelHints: labels };
}

// ── PREDATOR Scoring (tempo, denial, battle budget, extraction windows) ────────

function scorePredator(card: GameCard, ctx: ExtendedValuationContext, base: number): CardValue {
  const economyGain = base * 0.55;
  const labels: string[] = [];
  const snap = ctx.engineSnapshot;

  // Tempo is king — immediate positioning
  const tempoValue = (card.cashflowMonthly ?? 0) * 0.3 + (card.value ?? 0) * 0.2;
  labels.push(`tempo: $${tempoValue.toFixed(0)}`);

  // Deny value: blocking opponent's access
  const opponentCash = ctx.opponentCash ?? 0;
  const denyValue    = Math.min(base * 0.4, (opponentCash / 28_000) * base * 0.3);
  labels.push(`deny: $${denyValue.toFixed(0)}`);

  // Battle budget generation
  const bbGeneration = (card.cashflowMonthly ?? 0) * 0.15 + (card.value ?? 0) * 0.05;

  // Heat-aware tempo multiplier
  const heatMult = snap ? (1 + (snap.haterHeat / 200)) : 1;
  const adjustedTempo = tempoValue * heatMult;

  // Countdown pressure: T3/T4 tick tier makes tempo more valuable
  let tickBonus = 0;
  if (snap?.tickTier === 'T3') { tickBonus = adjustedTempo * 0.25; labels.push('+25% T3 tempo'); }
  if (snap?.tickTier === 'T4') { tickBonus = adjustedTempo * 0.50; labels.push('+50% T4 tempo'); }

  const total = economyGain + adjustedTempo + tickBonus + denyValue + bbGeneration * 2;
  return { ...ZERO_VALUE, total, economyGain, tempoValue: adjustedTempo, denyValue, bbGeneration, labelHints: labels };
}

// ── SYNDICATE Scoring (trust, rescue timing, coordination) ────────────────────

function scoreSyndicate(card: GameCard, ctx: ExtendedValuationContext, base: number): CardValue {
  const economyGain = base;
  const labels: string[] = [];
  const snap = ctx.engineSnapshot;

  // Trust impact — cards that damage team trust are penalized
  const trustImpact  = card.modeMetadata?.trustImpact ?? 0;
  const trustPenalty = trustImpact < 0 ? Math.abs(trustImpact) * 500 : 0;
  const trustBonus   = trustImpact > 0 ? trustImpact * 300 : 0;

  if (trustPenalty > 0) labels.push(`-$${trustPenalty.toFixed(0)} trust penalty`);
  if (trustBonus   > 0) labels.push(`+$${trustBonus.toFixed(0)} trust bonus`);

  // Rescue window amplifier — rescue-timing cards get massive premium during partner distress
  const partnerDistress = (ctx as any).partnerInDistress ?? false;
  let rescueBonus = 0;
  if (partnerDistress && card.synergies?.includes('RESCUE')) {
    rescueBonus = 5000;
    labels.push('+$5000 rescue window bonus');
  }

  // Synergy bonus from co-op momentum
  const synergyBonus = (ctx as any).synergyBonus ?? 1.0;
  const adjustedEconomy = economyGain * Math.min(synergyBonus, 2.0);

  const total = adjustedEconomy + trustBonus - trustPenalty + rescueBonus;
  return { ...ZERO_VALUE, total, economyGain: adjustedEconomy, trustImpact, labelHints: labels };
}

// ── PHANTOM Scoring (gap vs legend, precision, nerve) ─────────────────────────

function scorePhantom(card: GameCard, ctx: ExtendedValuationContext, base: number): CardValue {
  const economyGain = base;
  const labels: string[] = [];

  // CORD delta — primary valuation signal in Phantom
  const cordGap   = ctx.cordGap ?? 0;
  const cordDelta = card.modeMetadata?.cordDelta ?? 0;

  // Gap-closing premium when behind legend
  const gapBonus = cordGap < 0 && cordDelta > 0
    ? Math.abs(cordGap) * 50
    : 0;
  if (gapBonus > 0) labels.push(`+$${gapBonus.toFixed(0)} gap-close bonus`);

  // Legend pressure response amplifier
  const nerveMult = card.modeMetadata?.legendPressureResponse ? 1.1 : 1.0;
  if (nerveMult > 1) labels.push('+10% nerve multiplier');

  // Ghost is ahead: aggressive investment preferred
  const ghostAhead = (ctx as any).ghostDelta > 0;
  const aggressiveMult = ghostAhead ? 1.15 : 1.0;
  if (aggressiveMult > 1) labels.push('+15% ghost lead premium');

  const total = (economyGain + cordDelta * 200 + gapBonus) * nerveMult * aggressiveMult;
  return { ...ZERO_VALUE, total, economyGain, cordDelta, labelHints: labels };
}

// ── Batch Scoring (for CardHand sort/recommend) ───────────────────────────────

export function rankHand(
  cards: GameCard[],
  ctx: ExtendedValuationContext,
): Array<{ card: GameCard; value: CardValue }> {
  return cards
    .map((card) => ({ card, value: scoreCard(card, ctx) }))
    .sort((a, b) => b.value.total - a.value.total);
}

/** Top recommendation from hand — AI overlay uses this. */
export function getTopRecommendation(
  cards: GameCard[],
  ctx: ExtendedValuationContext,
): { card: GameCard; value: CardValue } | null {
  const ranked = rankHand(cards, ctx);
  return ranked.length > 0 ? ranked[0] : null;
}
