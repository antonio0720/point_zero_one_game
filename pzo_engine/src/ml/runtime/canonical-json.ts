// pzo_engine/src/ml/runtime/canonical-json.ts
// Density6 LLC · Point Zero One · Confidential
//
// Canonical JSON serialization (deterministic across runtimes):
// - Object keys sorted recursively
// - Arrays preserved in-order
// - BigInt supported (stringified)
// - NaN/Infinity normalized to null
//
// Used for audit hashing + HMAC receipts where byte-identical payloads matter.

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  if (value === null) return null;

  const t = typeof value;

  if (t === 'bigint') return typeof value === 'bigint' ? value.toString() : null;
  if (t === 'number') return Number.isFinite(value) ? value : null;
  if (t === 'string' || t === 'boolean') return value;
  if (t === 'undefined' || t === 'function' || t === 'symbol') return null;

  if (Array.isArray(value)) return value.map(v => canonicalize(v));

  if (t === 'object') {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(obj).sort()) out[k] = canonicalize(obj[k]);
    return out;
  }

  return null;
}