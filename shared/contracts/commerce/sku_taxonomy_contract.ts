/**
 * SKU Taxonomy Contract
 */

export enum SKUType {
  COSMETIC = 'COSMETIC',
  CONTENT_ACCESS = 'CONTENT_ACCESS',
  CONVENIENCE = 'CONVENIENCE',
  FORBIDDEN = 'FORBIDDEN'
}

export interface SKU {
  id: number;
  type: SKUType;
  tags?: string[];
}

export function validateSKU(sku: SKU): void {
  if (!Number.isInteger(sku.id)) {
    throw new Error('ID must be an integer');
  }

  if (!Object.values(SKUType).includes(sku.type)) {
    throw new Error('Invalid SKU type');
  }

  if (Array.isArray(sku.tags) && sku.tags.some((tag) => typeof tag !== 'string')) {
    throw new Error('Tags must be an array of strings');
  }
}
