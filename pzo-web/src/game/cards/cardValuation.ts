// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — pzo-web/src/game/cards/cardValuation.ts
// Sprint 2: Mode-Aware Card Valuation
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════
// Every mode values cards differently. This is the core of the Bible's
// "mode-exclusive identity" — same card, different weights.

import type { GameCard, CardValuationContext } from '../types/cards';

export interface CardValue {
  total: number;             // Overall score (used for AI recommendations)
  economyGain: number;       // Direct economy improvement
  tempoValue: number;        // How much it accelerates / denies timing
  denyValue: number;         // Predator: value of blocking opponent access
  bbGeneration: number;      // Predator: battle budget generated
  cordDelta: number;         // Phantom: CORD basis points vs legend
  trustImpact: number;       // Syndicate: trust score change
  labelHints: string[];      // Human-readable breakdown for UI
}

const ZERO_VALUE: CardValue = {
  total: 0, economyGain: 0, tempoValue: 0, denyValue: 0,
  bbGeneration: 0, cordDelta: 0, trustImpact: 0, labelHints: [],
};

// ── Entry Point ────────────────────────────────────────────────────────────────
export function scoreCard(card: GameCard, ctx: CardValuationContext): CardValue {
  const base = computeBaseValue(card, ctx);
  switch (ctx.mode) {
    case 'EMPIRE':    return scoreEmpire(card, ctx, base);
    case 'PREDATOR':  return scorePredator(card, ctx, base);
    case 'SYNDICATE': return scoreSyndicate(card, ctx, base);
    case 'PHANTOM':   return scorePhantom(card, ctx, base);
  }
}

// ── Base Value (mode-agnostic) ────────────────────────────────────────────────
function computeBaseValue(card: GameCard, ctx: CardValuationContext): number {
  if (card.type === 'OPPORTUNITY' || card.type === 'IPA') {
    const monthlyYield = card.cashflowMonthly ?? 0;
    const netWorthGain = card.value ?? 0;
    // Annualized cashflow / cost ratio — core ROI signal
    const roiScore = card.energyCost ? (monthlyYield * 12) / card.energyCost : 0;
    return monthlyYield * 12 + netWorthGain * 0.05 + roiScore * 1000;
  }
  if (card.type === 'PRIVILEGED') return (card.value ?? 0) * 0.8;
  return 0;
}

// ── EMPIRE Scoring (survival, compounding, pressure management) ───────────────
function scoreEmpire(card: GameCard, ctx: CardValuationContext, base: number): CardValue {
  let economyGain = base;
  const labels: string[] = [];

  // Distress multiplier — recovery cards are more valuable when cash is low
  if (ctx.cash < ctx.income * 3) {
    const distressBoost = 1 + (1 - ctx.cash / (ctx.income * 3)) * 0.5;
    economyGain *= distressBoost;
    if (distressBoost > 1.2) labels.push(`+${Math.round((distressBoost - 1) * 100)}% distress bonus`);
  }

  // Isolation tax consideration — solo play has higher friction
  if (ctx.mode === 'EMPIRE' && card.modeMetadata?.isolationTaxModifier) {
    economyGain *= card.modeMetadata.isolationTaxModifier;
  }

  // Bleed mode amplifier
  if (ctx.inBleedMode && card.modeMetadata?.bleedAmplifier) {
    economyGain *= 1.35;
    labels.push('+35% bleed amplifier');
  }

  // Shield/stability premium — Empire needs shields more than other modes
  if (ctx.shields < 1 && ctx.pressureScore > 0.5) {
    if (card.synergies?.includes('SHIELD')) {
      economyGain *= 1.25;
      labels.push('+25% shield value (exposed)');
    }
  }

  const total = economyGain;
  return { ...ZERO_VALUE, total, economyGain, labelHints: labels };
}

// ── PREDATOR Scoring (tempo, denial, battle budget, extraction windows) ────────
function scorePredator(card: GameCard, ctx: CardValuationContext, base: number): CardValue {
  // Income cards are down-weighted in Predator (no long compounding)
  const economyGain = base * 0.55;
  const labels: string[] = [];

  // Tempo is king — the faster you can fire a sabotage, the better
  const tempoValue = (card.cashflowMonthly ?? 0) * 0.3 + (card.value ?? 0) * 0.2;
  labels.push(`tempo: ${tempoValue.toFixed(0)}`);

  // Deny value: if opponent could use this and you take it, you win twice
  const denyValue = ctx.opponentCash != null
    ? Math.min(base * 0.4, (ctx.opponentCash / 28_000) * base * 0.3)
    : base * 0.2;
  labels.push(`deny: ${denyValue.toFixed(0)}`);

  // Battle budget generation
  const bbGeneration = (card.cashflowMonthly ?? 0) * 0.15 + (card.value ?? 0) * 0.05;

  const total = economyGain + tempoValue + denyValue + bbGeneration * 2;
  // Card value = economy gain + BB gain + deny value + timing window value + opponent state exploit
  return { ...ZERO_VALUE, total, economyGain, tempoValue, denyValue, bbGeneration, labelHints: labels };
}

// ── SYNDICATE Scoring (trust preservation, rescue timing, coordination) ────────
function scoreSyndicate(card: GameCard, ctx: CardValuationContext, base: number): CardValue {
  const economyGain = base;
  const labels: string[] = [];

  // Trust impact — cards that damage trust are worth less in Syndicate
  const trustImpact = card.modeMetadata?.trustImpact ?? 0;
  const trustPenalty = trustImpact < 0 ? Math.abs(trustImpact) * 500 : 0;
  const trustBonus   = trustImpact > 0 ? trustImpact * 300 : 0;

  if (trustPenalty > 0) labels.push(`-${trustPenalty.toFixed(0)} trust penalty`);
  if (trustBonus > 0)   labels.push(`+${trustBonus.toFixed(0)} trust bonus`);

  const total = economyGain + trustBonus - trustPenalty;
  return { ...ZERO_VALUE, total, economyGain, trustImpact, labelHints: labels };
}

// ── PHANTOM Scoring (gap vs legend, precision, nerve) ─────────────────────────
function scorePhantom(card: GameCard, ctx: CardValuationContext, base: number): CardValue {
  const economyGain = base;
  const labels: string[] = [];

  // CORD delta — primary signal in Phantom mode
  // Negative cordGap means you're behind legend; gap-closing cards are premium
  const cordGap = ctx.cordGap ?? 0;
  const cordDelta = card.modeMetadata?.cordDelta ?? 0;

  // If behind, gap-closing cards get a premium
  const gapBonus = cordGap < 0 ? Math.abs(cordGap) * 50 * (cordDelta > 0 ? 1 : 0) : 0;
  if (gapBonus > 0) labels.push(`+${gapBonus.toFixed(0)} gap-close bonus`);

  const total = economyGain + cordDelta * 200 + gapBonus;
  return { ...ZERO_VALUE, total, economyGain, cordDelta, labelHints: labels };
}
