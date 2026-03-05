// pzo_engine/src/ml/runtime/feature-schema.ts
// Density6 LLC · Point Zero One · Confidential
//
// Feature schema hashing + validation. Hash uses canonicalJson, then sha256 is supplied by caller.

import { canonicalJson } from './canonical-json';

export type FeatureSchema = {
  name: string;
  version: string; // bump when features change semantics/order
  features: readonly string[];
};

export function buildFeatureSchemaHashPayload(schema: FeatureSchema): string {
  return canonicalJson({
    name: schema.name,
    version: schema.version,
    features: schema.features,
  });
}

export function ensureFeatureVectorLength(
  x: readonly number[],
  expected: number,
): number[] {
  if (x.length === expected) return [...x];
  if (x.length > expected) return x.slice(0, expected);
  const out = new Array<number>(expected).fill(0);
  for (let i = 0; i < x.length; i++) out[i] = x[i];
  return out;
}