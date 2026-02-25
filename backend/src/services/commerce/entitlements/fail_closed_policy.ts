/**
 * Fail Closed Policy for Entitlements Service
 */

import { Entitlement, Taxonomy } from "../models";

/**
 * Check if the taxonomy is known and the usage is allowed.
 * If not, deny the request with an explainable reason code.
 *
 * @param taxonomy - The taxonomy to check.
 * @param usage - The usage to check.
 * @returns Entitlement object or null if denied.
 */
export function checkEntitlement(taxonomy: Taxonomy, usage: string): Entitlement | null {
  // Check if the taxonomy is known and the usage is allowed.
  const knownTaxonomy = Object.values(Taxonomy).includes(taxonomy);
  const allowedUsage = rankedUsages[taxonomy]?.includes(usage) || false;

  if (!knownTaxonomy || !allowedUsage) {
    return null;
  }

  // If the taxonomy and usage are known and allowed, create an Entitlement object.
  const entitlement: Entitlement = {
    taxonomy,
    usage,
    granted: true,
    reasonCode: "Known_and_Allowed",
  };

  return entitlement;
}

/**
 * Ranked usages for each taxonomy.
 */
const rankedUsages: Record<Taxonomy, string[]> = {
  [Taxonomy.GOLD]: ["purchase", "upgrade"],
  [Taxonomy.SILVER]: ["subscription", "trial"],
};
