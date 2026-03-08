// backend/src/security/explorer_lookup_hardening.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { DeviceTrustTier } from './device.entity';
import {
  buildExplorerEnumerationSurface,
  buildExplorerLookupCacheKey,
  consumeExplorerProbe,
  hardenExplorerLookup,
  redactExplorerLookupReceipt,
  sanitizeExplorerErrorCopy,
  verifyExplorerLookupReceipt,
} from './explorer_lookup_hardening';

/**
 * Explorer hardening contract tests.
 *
 * These now validate the real sibling module instead of a local harness.
 * Coverage:
 * - enumeration resistance with stable public semantics and rotating opaque ids
 * - sliding-window rate limiting
 * - sanitized error copy that strips sensitive material
 * - signed receipt round-trip verification
 * - safe redaction for logs
 */

describe('Explorer Hardening', () => {
  let rateLimitState: Map<string, number[]>;
  const secret = 'explorer-test-secret';

  beforeEach(() => {
    rateLimitState = new Map<string, number[]>();
  });

  describe('Enumeration Resistance', () => {
    it('keeps the public error surface stable while rotating opaque request ids', () => {
      const response1 = buildExplorerEnumerationSurface('receipt_123', {
        nowMs: 1_700_000_000_000,
        salt: 'a',
      });

      const response2 = buildExplorerEnumerationSurface('receipt_123', {
        nowMs: 1_700_000_000_025,
        salt: 'b',
      });

      expect(response1.status).toBe(404);
      expect(response2.status).toBe(404);
      expect(response1.publicCode).toBe('EXPLORER_NOT_FOUND');
      expect(response2.publicCode).toBe('EXPLORER_NOT_FOUND');
      expect(response1.body.message).toBe(response2.body.message);
      expect(response1.body.safeHints).toEqual(response2.body.safeHints);
      expect(response1.opaqueRequestId).not.toEqual(response2.opaqueRequestId);
    });

    it('supports 410 semantics without leaking source object details', () => {
      const response = buildExplorerEnumerationSurface('receipt_legacy', {
        gone: true,
        nowMs: 1_700_000_000_000,
        salt: 'legacy',
      });

      expect(response.status).toBe(410);
      expect(response.publicCode).toBe('EXPLORER_GONE');
      expect(response.body.message.toLowerCase()).toContain(
        'no longer available',
      );
      expect(JSON.stringify(response)).not.toContain('receipt_legacy');
    });
  });

  describe('Rate Limiting', () => {
    it('limits repeated probes within the configured window', () => {
      expect(
        consumeExplorerProbe(
          rateLimitState,
          'ip:1.2.3.4',
          3,
          60_000,
          1_700_000_000_000,
        ),
      ).toMatchObject({
        allowed: true,
        retryAfterMs: 0,
        remaining: 2,
      });

      expect(
        consumeExplorerProbe(
          rateLimitState,
          'ip:1.2.3.4',
          3,
          60_000,
          1_700_000_000_001,
        ),
      ).toMatchObject({
        allowed: true,
        retryAfterMs: 0,
        remaining: 1,
      });

      expect(
        consumeExplorerProbe(
          rateLimitState,
          'ip:1.2.3.4',
          3,
          60_000,
          1_700_000_000_002,
        ),
      ).toMatchObject({
        allowed: true,
        retryAfterMs: 0,
        remaining: 0,
      });

      const fourth = consumeExplorerProbe(
        rateLimitState,
        'ip:1.2.3.4',
        3,
        60_000,
        1_700_000_000_003,
      );

      expect(fourth.allowed).toBe(false);
      expect(fourth.retryAfterMs).toBeGreaterThan(0);
      expect(fourth.remaining).toBe(0);
    });

    it('reopens the window after sufficient time has passed', () => {
      consumeExplorerProbe(
        rateLimitState,
        'ip:9.9.9.9',
        1,
        10_000,
        1_700_000_000_000,
      );

      const denied = consumeExplorerProbe(
        rateLimitState,
        'ip:9.9.9.9',
        1,
        10_000,
        1_700_000_000_001,
      );

      expect(denied.allowed).toBe(false);

      const allowed = consumeExplorerProbe(
        rateLimitState,
        'ip:9.9.9.9',
        1,
        10_000,
        1_700_000_010_001,
      );

      expect(allowed).toMatchObject({
        allowed: true,
        retryAfterMs: 0,
        remaining: 0,
      });
    });
  });

  describe('Sanitized Error Copy', () => {
    it('strips secrets, tokens, and connection strings from operator errors', () => {
      const originalError = new Error(
        'Sensitive information exposed postgres://admin:pw@db.internal/app password=hunter2 token=abc123 secret=xyz api_key=qwerty Bearer eyJhbGciOiJIUzI1NiJ9',
      );

      const sanitizedError = sanitizeExplorerErrorCopy(originalError);

      expect(sanitizedError.message).not.toContain(
        'Sensitive information exposed',
      );
      expect(sanitizedError.message).not.toContain(
        'postgres://admin:pw@db.internal/app',
      );
      expect(sanitizedError.message).not.toContain('hunter2');
      expect(sanitizedError.message).not.toContain('abc123');
      expect(sanitizedError.message).not.toContain('xyz');
      expect(sanitizedError.message).not.toContain('qwerty');
      expect(sanitizedError.message).toContain(
        '[redacted-connection-string]',
      );
      expect(sanitizedError.message).toContain('password=[redacted]');
      expect(sanitizedError.message).toContain('token=[redacted]');
      expect(sanitizedError.message).toContain('secret=[redacted]');
      expect(sanitizedError.message).toContain('api_key=[redacted]');
      expect(sanitizedError.message).toContain('Bearer [redacted]');
    });
  });

  describe('Receipt Integrity', () => {
    it('hardens and verifies a valid receipt', () => {
      const receipt = hardenExplorerLookup(
        {
          kind: 'proof',
          rawKey: 'Receipt|123',
          page: 1,
          limit: 20,
          seasonId: 'Season_0',
          search: 'alpha beta',
          clientIp: '1.2.3.4',
          userAgent: 'Vitest',
          deviceId: 'device_01',
          trustTier: DeviceTrustTier.VERIFIED,
          nonce: 'nonce_01',
          nowMs: 1_700_000_000_000,
          receiptTtlMs: 60_000,
        },
        secret,
      );

      expect(receipt.normalization.normalizedKey).toBe('receipt:123');
      expect(receipt.normalization.trustTier).toBe(DeviceTrustTier.VERIFIED);
      expect(receipt.normalization.riskScore).toBeGreaterThanOrEqual(0);

      const verification = verifyExplorerLookupReceipt(
        receipt,
        secret,
        1_700_000_000_500,
      );

      expect(verification).toEqual({
        valid: true,
        reason: null,
      });
    });

    it('rejects tampered signatures', () => {
      const receipt = hardenExplorerLookup(
        {
          kind: 'run',
          rawKey: 'run_123',
          trustTier: DeviceTrustTier.TRUSTED,
          nowMs: 1_700_000_000_000,
        },
        secret,
      );

      const tampered = {
        ...receipt,
        signature: receipt.signature.replace(/.$/u, (char) =>
          char === 'a' ? 'b' : 'a',
        ),
      };

      const verification = verifyExplorerLookupReceipt(
        tampered,
        secret,
        1_700_000_000_001,
      );

      expect(verification.valid).toBe(false);
      expect(verification.reason).toBe('INVALID_SIGNATURE');
    });

    it('rejects expired receipts', () => {
      const receipt = hardenExplorerLookup(
        {
          kind: 'badge',
          rawKey: 'badge_001',
          trustTier: DeviceTrustTier.UNVERIFIED,
          nowMs: 1_700_000_000_000,
          receiptTtlMs: 1_000,
        },
        secret,
      );

      const verification = verifyExplorerLookupReceipt(
        receipt,
        secret,
        1_700_000_001_500,
      );

      expect(verification.valid).toBe(false);
      expect(verification.reason).toBe('EXPIRED_RECEIPT');
    });
  });

  describe('Cache Keys and Redaction', () => {
    it('builds stable cache keys and safe log receipts', () => {
      const receipt = hardenExplorerLookup(
        {
          kind: 'leaderboard',
          rawKey: 'global_s0',
          page: 2,
          limit: 50,
          seasonId: 's0',
          search: 'top players',
          clientIp: '5.5.5.5',
          userAgent: 'Vitest',
          deviceId: 'device_02',
          trustTier: DeviceTrustTier.HARDENED,
          nowMs: 1_700_000_000_000,
        },
        secret,
      );

      const cacheKey = buildExplorerLookupCacheKey(receipt);
      const redacted = redactExplorerLookupReceipt(receipt);

      expect(cacheKey).toContain('explorer:v2:leaderboard:global_s0:p2:l50');
      expect(cacheKey).toContain('tier:hardened');
      expect(redacted.signature.endsWith('…')).toBe(true);
      expect(redacted.normalization.fingerprint.endsWith('…')).toBe(true);
      expect(redacted.normalization.canonicalRequestHash.endsWith('…')).toBe(
        true,
      );
      expect(redacted.normalization.fingerprint).not.toBe(
        receipt.normalization.fingerprint,
      );
    });
  });
});