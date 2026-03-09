/**
 * Season Templates Service for Partners and Cohorts
 */

import { Partner, PartnerSKU } from "../partners";
import { Arc, CadencePresets } from "../arcs";

type SeasonTemplate = {
  id: number;
  skuId: PartnerSKU['id'];
  name: string;
  theme: string;
  arcs: Arc[];
  cadencePresetId: CadencePresets['id'] | null;
};

/**
 * Get a season template by ID.
 * @param id - The ID of the season template to retrieve.
 */
export async function getSeasonTemplate(id: number): Promise<SeasonTemplate | null> {
  // Query the database for the season template with the given ID.
}

/**
 * List all season templates for a specific SKU (Employer/Bank/EAP).
 * @param skuId - The ID of the SKU to retrieve season templates for.
 */
export async function listSeasonTemplatesBySku(skuId: PartnerSKU['id']): Promise<SeasonTemplate[]> {
  // Query the database for all season templates associated with the given SKU.
}

/**
 * Create a new season template.
 * @param skuId - The ID of the SKU to associate the season template with.
 * @param name - The name of the season template.
 * @param theme - The theme of the season template.
 * @param arcs - The list of arcs for the season template.
 * @param cadencePresetId - The ID of the cadence preset to associate with the season template, or null if none.
 */
export async function createSeasonTemplate(
  skuId: PartnerSKU['id'],
  name: string,
  theme: string,
  arcs: Arc[],
  cadencePresetId: CadencePresets['id'] | null = null
): Promise<SeasonTemplate> {
  // Insert the new season template into the database and return it.
}
