/**
 * HashFunction
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo_engine/src/integrity/hash-function.ts
 *
 * Provides HMAC-SHA256 signing and constant-time verification.
 *
 * Uses Node's built-in `crypto` module — no external deps.
 * Constant-time comparison via `crypto.timingSafeEqual` prevents
 * timing-based side-channel attacks on signature verification.
 */

import { createHmac, timingSafeEqual } from 'crypto';

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
   * using `timingSafeEqual` — both buffers are padded to the same
   * length before comparison so an attacker cannot infer validity
   * from response timing.
   *
   * @returns true if `signature` matches the HMAC of `data` under `key`
   */
  public verifyHmacSha256(data: string, signature: string, key: string): boolean {
    const expected = this.hmacSha256(data, key);

    // Both must be the same byte length for timingSafeEqual
    if (expected.length !== signature.length) return false;

    try {
      const expectedBuf  = Buffer.from(expected,  'hex');
      const signatureBuf = Buffer.from(signature, 'hex');

      // If signature is not valid hex, Buffer.from may produce different lengths
      if (expectedBuf.length !== signatureBuf.length) return false;

      return timingSafeEqual(expectedBuf, signatureBuf);
    } catch {
      return false;
    }
  }

  /**
   * Returns a SHA-256 hex digest of `data`.
   * Convenience wrapper used for audit hash generation.
   */
  public sha256(data: string): string {
    const { createHash } = require('crypto') as typeof import('crypto');
    return createHash('sha256').update(data, 'utf8').digest('hex');
  }
}
