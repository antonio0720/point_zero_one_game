// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/empire/isolationTax.ts
// Sprint 5 — Empire Isolation Tax System
//
// Solo play incurs a friction cost on every card purchase.
// Represents the economic penalty of operating without a network.
// Tax is reduced by shields (each shield = -1% rate, min 0%)
//
// SPRINT 5 ADDITIONS:
//   - CARD_TYPE_TAX_MODIFIERS       — per-card-type modifier registry
//   - getTaxModifierForCard()       — lookup by card type + optional subtype
//   - computeIsolationTaxProjection() — preview before committing to card
//   - freezeBonus applied when isolationTaxFreezeBonus > 0 and freezeTicks > 0
//   - isolationTaxHistorySummary() updated with per-phase breakdown support
//
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════

import { EMPIRE_CONFIG } from './empireConfig';
import { C } from '../shared/designTokens';

export interface IsolationTaxResult {
  /** Gross spend before tax */
  grossSpend:    number;
  /** Tax amount charged (always >= 0) */
  taxAmount:     number;
  /** Net spend including tax */
  netSpend:      number;
  /** Effective rate applied */
  effectiveRate: number;
  /** Human-readable reason for UI tooltip */
  label:         string;
  /** Whether freeze bonus was applied */
  freezeBonusApplied: boolean;
}

// ── Card-type tax modifier registry ──────────────────────────────────────────

/**
 * Per-card-type isolation tax modifier.
 * 1.0 = standard rate. < 1.0 = reduced. > 1.0 = elevated.
 *
 * Logic:
 *   OPPORTUNITY — standard solo card purchase (1.0)
 *   IPA         — Income-Producing Asset — standard (1.0)
 *   FUBAR       — force-injected: no tax (0.0)
 *   MISSED      — opportunity cost card: no tax (0.0)
 *   SO          — significant other: reduced friction (0.5)
 *   PRIVILEGED  — elevated risk plays (1.5)
 *   SHIELD      — shield purchase: no tax, shields reduce tax (0.0)
 *   RECOVERY    — bleed recovery card: reduced friction (0.75)
 */
export const CARD_TYPE_TAX_MODIFIERS: Readonly<Record<string, number>> = Object.freeze({
  OPPORTUNITY: 1.0,
  IPA:         1.0,
  FUBAR:       0.0,   // injected by bots — no tax
  MISSED:      0.0,   // opportunity cost — no tax
  SO:          0.5,   // significant other — half friction
  PRIVILEGED:  1.5,   // elevated risk profile
  SHIELD:      0.0,   // shield purchase — exempt
  RECOVERY:    0.75,  // bleed recovery — reduced friction
  LEVERAGE:    1.25,  // leverage plays — elevated friction
  INVEST:      1.0,   // standard investment card
});

/**
 * Returns the tax modifier for a given card type.
 * Falls back to 1.0 (standard) for unknown types.
 *
 * @param cardType   - primary card type string
 * @param subtype    - optional subtype override (future use)
 */
export function getTaxModifierForCard(cardType: string, subtype?: string): number {
  const key = subtype ?? cardType;
  return CARD_TYPE_TAX_MODIFIERS[key.toUpperCase()] ?? 1.0;
}

// ── Core tax computation ──────────────────────────────────────────────────────

/**
 * Compute isolation tax for a card purchase in EMPIRE mode.
 *
 * @param grossSpend    - Base card cost before tax
 * @param shields       - Current shield count (each reduces rate by 1%)
 * @param taxModifier   - Card-level modifier (1.0=standard; use getTaxModifierForCard())
 * @param freezeTicks   - Ticks player is frozen (reduces tax if > 0)
 */
export function computeIsolationTax(
  grossSpend:   number,
  shields:      number,
  taxModifier:  number = 1.0,
  freezeTicks:  number = 0,
): IsolationTaxResult {
  const shieldDiscount = Math.min(
    shields * EMPIRE_CONFIG.isolationTaxShieldReduction,
    EMPIRE_CONFIG.isolationTaxBase,
  );
  const baseRate = Math.max(0, EMPIRE_CONFIG.isolationTaxBase - shieldDiscount);

  // Sprint 5: reduce tax further when player is frozen (already penalized)
  const freezeBonus       = freezeTicks > 0 ? EMPIRE_CONFIG.isolationTaxFreezeBonus : 1.0;
  const freezeBonusApplied = freezeTicks > 0 && EMPIRE_CONFIG.isolationTaxFreezeBonus < 1.0;

  const effectiveRate = baseRate * taxModifier * freezeBonus;
  const taxAmount     = Math.round(grossSpend * effectiveRate);
  const netSpend      = grossSpend + taxAmount;

  let label: string;
  if (effectiveRate === 0) {
    label = 'Isolation tax waived (shields)';
  } else if (freezeBonusApplied) {
    label = `Isolation tax +${(effectiveRate * 100).toFixed(1)}% (frozen — reduced)`;
  } else if (taxModifier > 1.0) {
    label = `Isolation tax +${(effectiveRate * 100).toFixed(1)}% (elevated risk)`;
  } else {
    label = `Isolation tax +${(effectiveRate * 100).toFixed(1)}% (solo friction)`;
  }

  return { grossSpend, taxAmount, netSpend, effectiveRate, label, freezeBonusApplied };
}

/**
 * Eligibility: isolation tax only applies to direct spend cards.
 * Force-injected and zero-cost cards are exempt.
 * Use getTaxModifierForCard() for the modifier; this function gates tax application entirely.
 */
export function isolationTaxApplies(cardType: string): boolean {
  const modifier = getTaxModifierForCard(cardType);
  return modifier > 0; // 0.0 modifier = fully exempt
}

/**
 * SPRINT 5: Preview tax impact before committing to a card play.
 * Identical to computeIsolationTax() — safe to call from UI without side effects.
 * Named separately to make read-only intent explicit.
 */
export function computeIsolationTaxProjection(
  grossSpend:  number,
  shields:     number,
  cardType:    string,
  freezeTicks: number = 0,
): IsolationTaxResult {
  const taxModifier = getTaxModifierForCard(cardType);
  return computeIsolationTax(grossSpend, shields, taxModifier, freezeTicks);
}

// ── Tax tier system ───────────────────────────────────────────────────────────

export type IsolationTaxTier = 'NONE' | 'LOW' | 'MODERATE' | 'ELEVATED' | 'MAXIMUM';

export function getIsolationTaxTier(effectiveRate: number): IsolationTaxTier {
  if (effectiveRate === 0)    return 'NONE';
  if (effectiveRate <= 0.01)  return 'LOW';
  if (effectiveRate <= 0.025) return 'MODERATE';
  if (effectiveRate <= 0.04)  return 'ELEVATED';
  return 'MAXIMUM';
}

export const ISOLATION_TAX_COLORS: Readonly<Record<IsolationTaxTier, string>> = Object.freeze({
  NONE:     C.green,
  LOW:      C.gold,
  MODERATE: C.orange,
  ELEVATED: C.red,
  MAXIMUM:  C.crimson,
});

export const ISOLATION_TAX_TIER_LABELS: Readonly<Record<IsolationTaxTier, string>> = Object.freeze({
  NONE:     'WAIVED',
  LOW:      'LOW',
  MODERATE: 'MODERATE',
  ELEVATED: 'ELEVATED',
  MAXIMUM:  'MAXIMUM',
});

export interface IsolationTaxDisplay {
  amount:   string;
  label:    string;
  tier:     IsolationTaxTier;
  color:    string;
  rate:     string;
}

/**
 * All-in-one formatted data for UI rendering.
 */
export function formatIsolationTaxDisplay(result: IsolationTaxResult): IsolationTaxDisplay {
  const tier  = getIsolationTaxTier(result.effectiveRate);
  const color = ISOLATION_TAX_COLORS[tier];

  const amount = result.taxAmount > 0
    ? `-$${result.taxAmount.toLocaleString()}`
    : '$0';

  const rate = result.effectiveRate > 0
    ? `${(result.effectiveRate * 100).toFixed(1)}%`
    : '0%';

  return { amount, label: result.label, tier, color, rate };
}

// ── Post-run burden summary ───────────────────────────────────────────────────

export interface IsolationTaxBurdenSummary {
  burden:      string;   // e.g. "4.1% of total spend"
  totalPaid:   string;   // e.g. "$2,340"
  tier:        IsolationTaxTier;
  color:       string;
  description: string;
}

export function isolationTaxHistorySummary(
  totalPaid:  number,
  totalSpend: number,
): IsolationTaxBurdenSummary {
  const rate   = totalSpend > 0 ? totalPaid / totalSpend : 0;
  const tier   = getIsolationTaxTier(rate);
  const color  = ISOLATION_TAX_COLORS[tier];

  const totalPaidStr = `$${totalPaid.toLocaleString()}`;
  const burdenStr    = `${(rate * 100).toFixed(1)}% of total spend`;

  const descriptions: Record<IsolationTaxTier, string> = {
    NONE:     'Shields absorbed all isolation tax — zero friction.',
    LOW:      'Minimal solo friction — shields working.',
    MODERATE: 'Moderate isolation tax burden — consider more shields.',
    ELEVATED: 'Heavy isolation penalty — shields were insufficient.',
    MAXIMUM:  'Maximum isolation tax paid — vulnerability to solo friction is severe.',
  };

  return { burden: burdenStr, totalPaid: totalPaidStr, tier, color, description: descriptions[tier] };
}