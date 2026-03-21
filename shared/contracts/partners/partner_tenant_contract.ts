/**
 * PartnerTenant Contract
 */

export interface PartnerTenant {
  id: number;
  partnerId: number;
  tenantId: number;
  skuId?: number;
  featureFlags?: string[];
  billingPlanId?: number;
}

export interface PartnerSKU {
  id: number;
  name: string;
  description?: string;
  price: number;
}

/**
 * Data boundaries for PartnerTenant and PartnerSKU
 */

const partnerTenantTable = 'partner_tenants';
const partnerSkuTable = 'partner_skus';

export const createPartnerTenant = (partnerTenant: PartnerTenant) => {
  // Insert a new row into the partner_tenants table
};

export const updatePartnerTenant = (id: number, updates: Partial<PartnerTenant>) => {
  // Update an existing row in the partner_tenants table with the provided updates
};

export const deletePartnerTenant = (id: number) => {
  // Delete a row from the partner_tenants table with the provided id
};

export const getPartnerTenantById = (id: number) => {
  // Return a single PartnerTenant object matching the provided id from the partner_tenants table
};

export const listPartnerTenants = () => {
  // Return all rows from the partner_tenants table as an array of PartnerTenant objects
};

export const createPartnerSku = (partnerSku: PartnerSKU) => {
  // Insert a new row into the partner_skus table
};

export const updatePartnerSku = (id: number, updates: Partial<PartnerSKU>) => {
  // Update an existing row in the partner_skus table with the provided updates
};

export const deletePartnerSku = (id: number) => {
  // Delete a row from the partner_skus table with the provided id
};

export const getPartnerSkuById = (id: number) => {
  // Return a single PartnerSKU object matching the provided id from the partner_skus table
};

export const listPartnerSkus = () => {
  // Return all rows from the partner_skus table as an array of PartnerSKU objects
};
