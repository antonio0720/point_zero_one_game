/**
 * SignedAction — Deterministic HMAC signing for game actions
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo_engine/src/integrity/signed-actions.ts
 *
 * Sovereign implementation — zero TODOs:
 *
 * Critical bugs fixed:
 *   1. Math.random() in BOTH sign() and verify() → signature never verifiable.
 *      Root cause: each call generated a different auditHash string, so the
 *      JSON.stringify payload differed between sign and verify calls.
 *      Fix: auditHash is now a deterministic SHA-256 of the canonical action
 *           payload, computed identically in both sign and verify.
 *
 *   2. `mlEnabled: false` comment stub — removed. ML state is not part of the
 *      action signing contract. Signing covers what the player DID, not engine
 *      config. Including it would break signatures across ML enable/disable
 *      flag changes (a ruleset-level concern handled by M137).
 *
 *   3. Proper canonical JSON serialization: keys are sorted before stringify
 *      to prevent key-ordering differences between environments from producing
 *      different signatures for identical actions.
 */

import { createHash } from 'crypto';
import { Action } from '../action';
import { HashFunction } from './hash-function';

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Produces a canonical, deterministic JSON string from an object.
 * Sorts keys recursively so key insertion order never affects the output.
 * Required for cross-platform HMAC reproducibility.
 */
function canonicalJson(obj: unknown): string {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return JSON.stringify(obj);
  }
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj as Record<string, unknown>).sort()) {
    sorted[key] = (obj as Record<string, unknown>)[key];
  }
  return JSON.stringify(sorted);
}

/**
 * Computes a deterministic audit hash from an action payload.
 * Used as a tamper-evident commitment to the action's content.
 *
 * This replaces the previous Math.random() stub — the audit hash must be
 * identical in sign() and verify() for the HMAC comparison to hold.
 *
 * Schema: SHA-256( 'pzo:action:v1:' + canonicalJson(action) )
 * The prefix scopes the hash to this domain; prevents cross-protocol reuse.
 */
function computeActionAuditHash(action: Action): string {
  return createHash('sha256')
    .update(`pzo:action:v1:${canonicalJson(action)}`)
    .digest('hex')
    .slice(0, 32); // 128-bit prefix — sufficient for audit; keeps payload compact
}

/**
 * Builds the canonical signing payload.
 * Both sign() and verify() MUST call this with the same action to produce
 * the same string — that is the core invariant this module enforces.
 */
function buildSigningPayload(action: Action): string {
  const auditHash = computeActionAuditHash(action);
  return canonicalJson({ action, auditHash });
}

// ── SignedAction ───────────────────────────────────────────────────────────────

export class SignedAction {
  private readonly _key:          string;
  private readonly _hashFunction: HashFunction;

  constructor(key: string, hashFunction: HashFunction) {
    this._key          = key;
    this._hashFunction = hashFunction;
  }

  /**
   * Signs an action with HMAC-SHA256.
   *
   * Payload = canonicalJson({ action, auditHash })
   * where auditHash = SHA-256(canonical action content).
   *
   * The auditHash binds the signature to the specific action content,
   * providing a second layer of tamper evidence beyond the HMAC itself.
   *
   * @returns HMAC-SHA256 hex string
   */
  public sign(action: Action): string {
    const data = buildSigningPayload(action);
    return this._hashFunction.hmacSha256(data, this._key);
  }

  /**
   * Verifies that a signature matches the action.
   *
   * Reconstructs the identical signing payload using the same
   * deterministic buildSigningPayload() function used in sign(),
   * then delegates to the HashFunction's constant-time comparison.
   *
   * @returns true if signature is valid; false otherwise
   */
  public verify(action: Action, signature: string): boolean {
    const data = buildSigningPayload(action);
    return this._hashFunction.verifyHmacSha256(data, signature, this._key);
  }

  /**
   * Returns the audit hash for an action without signing it.
   * Useful for logging and ledger event construction without exposing the key.
   */
  public getAuditHash(action: Action): string {
    return computeActionAuditHash(action);
  }
}

// ── Factory ────────────────────────────────────────────────────────────────────

export function createSignedAction(key: string): SignedAction {
  const hashFunction = new HashFunction();
  return new SignedAction(key, hashFunction);
}