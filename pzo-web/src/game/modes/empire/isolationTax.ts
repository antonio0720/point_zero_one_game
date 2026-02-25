// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/empire/isolationTax.ts
// Sprint 3 — Empire Isolation Tax System
//
// Solo play incurs a friction cost on every card purchase.
// Represents the economic penalty of operating without a network.
// Tax is reduced by shields (each shield = -1% rate, min 0%)
// ═══════════════════════════════════════════════════════════════════════════

import { EMPIRE_CONFIG } from './empireConfig';

export interface IsolationTaxResult {
  /** Gross spend before tax */
  grossSpend: number;
  /** Tax amount charged (always >= 0) */
  taxAmount: number;
  /** Net spend including tax */
  netSpend: number;
  /** Effective rate applied */
  effectiveRate: number;
  /** Human-readable reason for UI tooltip */
  label: string;
}

/**
 * Compute isolation tax for a card purchase in EMPIRE mode.
 *
 * @param grossSpend    - Base card cost before tax
 * @param shields       - Current shield count (each reduces rate by 1%)
 * @param taxModifier   - Card-level modifier from ModeCardMetadata.isolationTaxModifier
 *                        (1.0 = standard, 0.5 = reduced, 1.5 = elevated)
 */
export function computeIsolationTax(
  grossSpend: number,
  shields: number,
  taxModifier: number = 1.0,
): IsolationTaxResult {
  const shieldDiscount = Math.min(
    shields * EMPIRE_CONFIG.isolationTaxShieldReduction,
    EMPIRE_CONFIG.isolationTaxBase,
  );
  const baseRate = Math.max(0, EMPIRE_CONFIG.isolationTaxBase - shieldDiscount);
  const effectiveRate = baseRate * taxModifier;
  const taxAmount = Math.round(grossSpend * effectiveRate);
  const netSpend = grossSpend + taxAmount;

  let label: string;
  if (effectiveRate === 0) {
    label = 'Isolation tax waived (shields)';
  } else if (taxModifier > 1.0) {
    label = `Isolation tax +${Math.round(effectiveRate * 100)}% (elevated risk)`;
  } else {
    label = `Isolation tax +${Math.round(effectiveRate * 100)}% (solo friction)`;
  }

  return { grossSpend, taxAmount, netSpend, effectiveRate, label };
}

/**
 * Eligibility: isolation tax only applies to direct spend cards (OPPORTUNITY / IPA).
 * FUBAR, MISSED, SO, PRIVILEGED are force-injected — no tax.
 */
export function isolationTaxApplies(cardType: string): boolean {
  return cardType === 'OPPORTUNITY' || cardType === 'IPA';
}
