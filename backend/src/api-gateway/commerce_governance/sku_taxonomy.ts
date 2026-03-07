/**
 * Commerce Governance — SKU Taxonomy Engine
 * backend/src/api-gateway/commerce_governance/sku_taxonomy.ts
 *
 * Runtime enforcement: if a SKU touches outcomes, it's POWER — even if indirect.
 * No SKU ships without an immutable tag. Forbidden classes are blocked, not warned.
 *
 * Density6 LLC · Point Zero One · Confidential
 */

import {
  AllowedSkuClass, ForbiddenSkuClass, SkuClass,
  SkuDefinition, SkuValidationResult, SkuViolation,
  ALLOWED_SKU_CLASSES, FORBIDDEN_SKU_CLASSES,
  PolicyRules,
} from './types';

const ALLOWED_SET = new Set<string>(ALLOWED_SKU_CLASSES);
const FORBIDDEN_SET = new Set<string>(FORBIDDEN_SKU_CLASSES);

/** Maximum price cap in USD cents ($999.99) */
const MAX_PRICE_CENTS = 99999;

/** Minimum price in USD cents ($0.49) */
const MIN_PRICE_CENTS = 49;

/**
 * Validate a SKU definition against governance rules.
 * Returns blocking violations for forbidden classes or outcome-affecting SKUs.
 * Returns warnings for borderline cases (high price, missing tags).
 */
export function validateSku(sku: Partial<SkuDefinition>, rules: PolicyRules): SkuValidationResult {
  const violations: SkuViolation[] = [];
  const skuClass = (sku.skuClass ?? 'UNKNOWN') as SkuClass;
  const skuId = sku.skuId ?? 'UNKNOWN';

  // ── HARD BLOCK: Forbidden SKU class ──────────────────────────────────────
  if (FORBIDDEN_SET.has(skuClass)) {
    violations.push({
      code: 'FORBIDDEN_SKU_CLASS',
      message: `SKU class '${skuClass}' is permanently forbidden. Items that affect outcomes cannot be sold.`,
      severity: 'BLOCK',
    });
  }

  // ── HARD BLOCK: Unknown SKU class ────────────────────────────────────────
  if (!ALLOWED_SET.has(skuClass) && !FORBIDDEN_SET.has(skuClass)) {
    violations.push({
      code: 'UNKNOWN_SKU_CLASS',
      message: `SKU class '${skuClass}' is not in the taxonomy. Every SKU must have a valid class.`,
      severity: 'BLOCK',
    });
  }

  // ── HARD BLOCK: affectsOutcomes must be false ────────────────────────────
  if (sku.affectsOutcomes !== false) {
    violations.push({
      code: 'AFFECTS_OUTCOMES',
      message: 'SKU is marked as affecting outcomes. No purchasable item may alter run results.',
      severity: 'BLOCK',
    });
  }

  // ── HARD BLOCK: Missing required fields ──────────────────────────────────
  if (!sku.name || sku.name.trim().length === 0) {
    violations.push({ code: 'MISSING_NAME', message: 'SKU name is required.', severity: 'BLOCK' });
  }

  if (!sku.stripePriceId || sku.stripePriceId.trim().length === 0) {
    violations.push({ code: 'MISSING_STRIPE_PRICE', message: 'Stripe price ID is required.', severity: 'BLOCK' });
  }

  if (!sku.stripeProductId || sku.stripeProductId.trim().length === 0) {
    violations.push({ code: 'MISSING_STRIPE_PRODUCT', message: 'Stripe product ID is required.', severity: 'BLOCK' });
  }

  // ── HARD BLOCK: Price bounds ─────────────────────────────────────────────
  const price = sku.priceUsdCents ?? 0;
  if (price < MIN_PRICE_CENTS) {
    violations.push({
      code: 'PRICE_TOO_LOW',
      message: `Price ${price} cents is below minimum ${MIN_PRICE_CENTS} cents.`,
      severity: 'BLOCK',
    });
  }
  if (price > MAX_PRICE_CENTS) {
    violations.push({
      code: 'PRICE_TOO_HIGH',
      message: `Price ${price} cents exceeds maximum ${MAX_PRICE_CENTS} cents ($999.99).`,
      severity: 'BLOCK',
    });
  }

  // ── WARN: Competitive safety for CONVENIENCE_NONCOMPETITIVE ──────────────
  if (skuClass === 'CONVENIENCE_NONCOMPETITIVE' && sku.competitiveSafe !== true) {
    violations.push({
      code: 'CONVENIENCE_NOT_COMPETITIVE_SAFE',
      message: 'CONVENIENCE_NONCOMPETITIVE SKU must be marked competitiveSafe=true or it cannot appear in verified ladders.',
      severity: 'WARN',
    });
  }

  // ── WARN: Missing tags ──────────────────────────────────────────────────
  if (!sku.tags || sku.tags.length === 0) {
    violations.push({
      code: 'MISSING_TAGS',
      message: 'SKU has no tags. Tags are required for offer targeting and analytics.',
      severity: 'WARN',
    });
  }

  return {
    valid: violations.filter(v => v.severity === 'BLOCK').length === 0,
    skuId,
    skuClass,
    violations,
  };
}

/**
 * Check if a SKU class is allowed.
 * Used as a fast-path gate before full validation.
 */
export function isAllowedSkuClass(cls: string): cls is AllowedSkuClass {
  return ALLOWED_SET.has(cls);
}

/**
 * Check if a SKU class is forbidden.
 * Used by killswitch and purchase flow to hard-reject.
 */
export function isForbiddenSkuClass(cls: string): cls is ForbiddenSkuClass {
  return FORBIDDEN_SET.has(cls);
}