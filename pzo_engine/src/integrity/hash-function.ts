/**
 * hash-function.ts
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo_engine/src/integrity/hash-function.ts
 *
 * POINT ZERO ONE — HMAC-SHA256 SIGNING PRIMITIVE
 * Density6 LLC · Confidential · Do not distribute
 *
 * Provides HMAC-SHA256 signing and constant-time verification.
 *
 * Uses Node's built-in `node:crypto` — no external deps.
 * Constant-time comparison via `timingSafeEqual` prevents
 * timing-based side-channel attacks on signature verification.
 *
 * Fix applied:
 *   ✦ sha256() previously used require('crypto') inline → now uses
 *     top-level createHash import, consistent with the rest of the module.
 *     The inline require() created a different module reference per call
 *     and broke tree-shaking in bundled environments.
 */

import { createHmac, createHash, timingSafeEqual } from 'node:crypto';

export class HashFunction {
  /**
   * Computes HMAC-SHA256 of `data` with `key`.
   * Returns a lowercase hex string (64 chars).
   */
  public hmacSha256(data: string, key: string): string {
    return createHmac('sha256', key)
      .update(data, 'utf8')
      .digest('hex');
  }

  /**
   * Constant-time HMAC-SHA256 verification.
   *
   * Recomputes the expected HMAC and compares with `signature`
   * using `timingSafeEqual` — both buffers padded to the same length
   * so an attacker cannot infer validity from response timing.
   *
   * @returns true if `signature` matches the HMAC of `data` under `key`
   */
  public verifyHmacSha256(data: string, signature: string, key: string): boolean {
    const expected = this.hmacSha256(data, key);

    if (expected.length !== signature.length) return false;

    try {
      const expectedBuf  = Buffer.from(expected,  'hex');
      const signatureBuf = Buffer.from(signature, 'hex');

      if (expectedBuf.length !== signatureBuf.length) return false;

      return timingSafeEqual(expectedBuf, signatureBuf);
    } catch {
      return false;
    }
  }

  /**
   * Returns a SHA-256 hex digest of `data`.
   * Convenience wrapper used for audit hash generation and signed-actions.ts.
   *
   * Fix: was `const { createHash } = require('crypto')` inside the method body.
   * Now uses top-level `createHash` import — identical behavior, no inline require.
   */
  public sha256(data: string): string {
    return createHash('sha256').update(data, 'utf8').digest('hex');
  }
}