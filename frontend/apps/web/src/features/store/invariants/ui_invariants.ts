/**
 * UI Invariants for the financial roguelike game.
 */

export interface TaxonomyBadge {
  taxonomyId: number;
  name: string;
}

export interface Sku {
  id: number;
  eligibleForOutcomeImpact: boolean;
  doesNotAffectOutcomes: boolean;
}

/**
 * Ensures the taxonomy badge is always displayed.
 */
export function ensureTaxonomyBadgeVisible(state: any) {
  const taxonomyBadges = state.taxonomyBadges || [];
  return { ...state, taxonomyBadges };
}

/**
 * Ensures 'does not affect outcomes' is never hidden for eligible SKUs.
 */
export function ensureDoesNotAffectOutcomesVisible(state: any) {
  const skus = state.skus || [];
  return skus.map((sku: Sku) =>
    sku.eligibleForOutcomeImpact ? { ...sku, doesNotAffectOutcomes: true } : sku
  );
}

export const uiInvariants = {
  ensureTaxonomyBadgeVisible,
  ensureDoesNotAffectOutcomesVisible,
};
