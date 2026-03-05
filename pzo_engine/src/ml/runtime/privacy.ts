// pzo_engine/src/ml/runtime/privacy.ts
// Density6 LLC · Point Zero One · Confidential
//
// Deterministic privacy filter: redacts likely-PII keys.
// IMPORTANT: M01A features should avoid raw values entirely; this is defense-in-depth.

import { canonicalJson } from './canonical-json';

const PII_KEY_FRAGMENTS = [
  'email', 'e-mail', 'phone', 'mobile', 'name', 'first_name', 'last_name',
  'address', 'street', 'ssn', 'social', 'dob', 'birth', 'passport',
  'license', 'ip', 'ipv4', 'ipv6', 'mac', 'device_id', 'imei', 'gaid', 'idfa',
] as const;

export function redactLikelyPII<T>(input: T): T {
  return deepRedact(input) as T;
}

export function hashRedactedPayload(input: unknown): string {
  // stable hash input for audit anchoring (no crypto here — call-site provides sha256)
  return canonicalJson(redactLikelyPII(input));
}

function deepRedact(value: unknown, depth = 0): unknown {
  if (value === null) return null;
  if (depth > 12) return '[REDACTED:DEPTH]' as const;

  if (Array.isArray(value)) return value.map(v => deepRedact(v, depth + 1));

  const t = typeof value;
  if (t !== 'object') return value;

  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj)) {
    const lk = k.toLowerCase();
    const isPII = PII_KEY_FRAGMENTS.some(f => lk.includes(f));
    out[k] = isPII ? '[REDACTED:PII]' : deepRedact(obj[k], depth + 1);
  }
  return out;
}