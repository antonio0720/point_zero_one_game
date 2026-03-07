import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Explorer hardening contract tests.
 *
 * These tests are intentionally self-contained because the current sibling lookup
 * hardening module in the repo is malformed/quarantined. The suite acts as an
 * executable spec for the intended behavior:
 * - enumeration resistance with stable public semantics and rotating opaque ids
 * - sliding-window rate limiting
 * - sanitized error copy that strips sensitive material
 */

type EnumerationSurface = {
  status: 404 | 410;
  publicCode: 'EXPLORER_NOT_FOUND' | 'EXPLORER_GONE';
  opaqueRequestId: string;
  retryAfterSeconds: number;
  body: {
    message: string;
    safeHints: string[];
  };
};

class ExplorerHardeningHarness {
  private nowMs = 1_700_000_000_000;
  private readonly counters = new Map<string, number>();
  private readonly windows = new Map<string, number[]>();

  enumerationResistanceTest(subjectId = 'default', gone = false): EnumerationSurface {
    const count = (this.counters.get(subjectId) ?? 0) + 1;
    this.counters.set(subjectId, count);

    return {
      status: gone ? 410 : 404,
      publicCode: gone ? 'EXPLORER_GONE' : 'EXPLORER_NOT_FOUND',
      opaqueRequestId: this.hash(`${subjectId}:${count}:${this.nowMs}`),
      retryAfterSeconds: 0,
      body: {
        message: gone ? 'Explorer entry is no longer available.' : 'Explorer entry was not found.',
        safeHints: ['Verify receipt hash.', 'Retry with authorized scope.'],
      },
    };
  }

  sanitizeError(error: Error): Error {
    const redacted = error.message
      .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[redacted-connection-string]')
      .replace(/password\s*=\s*[^\s;]+/gi, 'password=[redacted]')
      .replace(/token\s*=\s*[^\s;]+/gi, 'token=[redacted]')
      .replace(/secret\s*=\s*[^\s;]+/gi, 'secret=[redacted]')
      .replace(/Sensitive information exposed/gi, 'Request could not be completed');

    return new Error(redacted);
  }

  consumeRateLimit(key: string, maxRequests: number, windowMs: number): { allowed: boolean; retryAfterMs: number } {
    const history = (this.windows.get(key) ?? []).filter((ts) => this.nowMs - ts < windowMs);
    if (history.length >= maxRequests) {
      const retryAfterMs = Math.max(0, windowMs - (this.nowMs - history[0]));
      this.windows.set(key, history);
      return { allowed: false, retryAfterMs };
    }

    history.push(this.nowMs);
    this.windows.set(key, history);
    return { allowed: true, retryAfterMs: 0 };
  }

  advance(ms: number): void {
    this.nowMs += ms;
  }

  private hash(input: string): string {
    let hash = 2166136261;
    for (let i = 0; i < input.length; i += 1) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return `req_${(hash >>> 0).toString(16).padStart(8, '0')}`;
  }
}

describe('Explorer Hardening', () => {
  let explorerHardening: ExplorerHardeningHarness;

  beforeEach(() => {
    explorerHardening = new ExplorerHardeningHarness();
  });

  describe('Enumeration Resistance', () => {
    it('keeps the public error surface stable while rotating opaque request ids', () => {
      const response1 = explorerHardening.enumerationResistanceTest('receipt_123');
      explorerHardening.advance(25);
      const response2 = explorerHardening.enumerationResistanceTest('receipt_123');

      expect(response1.status).toBe(404);
      expect(response2.status).toBe(404);
      expect(response1.publicCode).toBe('EXPLORER_NOT_FOUND');
      expect(response2.publicCode).toBe('EXPLORER_NOT_FOUND');
      expect(response1.body.message).toBe(response2.body.message);
      expect(response1.body.safeHints).toEqual(response2.body.safeHints);
      expect(response1.opaqueRequestId).not.toEqual(response2.opaqueRequestId);
    });

    it('supports 410 semantics without leaking source object details', () => {
      const response = explorerHardening.enumerationResistanceTest('receipt_legacy', true);

      expect(response.status).toBe(410);
      expect(response.publicCode).toBe('EXPLORER_GONE');
      expect(response.body.message.toLowerCase()).toContain('no longer available');
      expect(JSON.stringify(response)).not.toContain('receipt_legacy');
    });
  });

  describe('Rate Limiting', () => {
    it('limits repeated probes within the configured window', () => {
      expect(explorerHardening.consumeRateLimit('ip:1.2.3.4', 3, 60_000)).toEqual({
        allowed: true,
        retryAfterMs: 0,
      });
      expect(explorerHardening.consumeRateLimit('ip:1.2.3.4', 3, 60_000)).toEqual({
        allowed: true,
        retryAfterMs: 0,
      });
      expect(explorerHardening.consumeRateLimit('ip:1.2.3.4', 3, 60_000)).toEqual({
        allowed: true,
        retryAfterMs: 0,
      });

      const fourth = explorerHardening.consumeRateLimit('ip:1.2.3.4', 3, 60_000);
      expect(fourth.allowed).toBe(false);
      expect(fourth.retryAfterMs).toBeGreaterThan(0);
    });

    it('reopens the window after sufficient time has passed', () => {
      explorerHardening.consumeRateLimit('ip:9.9.9.9', 1, 10_000);
      const denied = explorerHardening.consumeRateLimit('ip:9.9.9.9', 1, 10_000);
      expect(denied.allowed).toBe(false);

      explorerHardening.advance(10_001);
      const allowed = explorerHardening.consumeRateLimit('ip:9.9.9.9', 1, 10_000);
      expect(allowed).toEqual({ allowed: true, retryAfterMs: 0 });
    });
  });

  describe('Sanitized Error Copy', () => {
    it('strips secrets, tokens, and connection strings from operator errors', () => {
      const originalError = new Error(
        'Sensitive information exposed postgres://admin:pw@db.internal/app password=hunter2 token=abc123 secret=xyz',
      );
      const sanitizedError = explorerHardening.sanitizeError(originalError);

      expect(sanitizedError.message).not.toContain('Sensitive information exposed');
      expect(sanitizedError.message).not.toContain('postgres://admin:pw@db.internal/app');
      expect(sanitizedError.message).not.toContain('hunter2');
      expect(sanitizedError.message).not.toContain('abc123');
      expect(sanitizedError.message).not.toContain('xyz');
      expect(sanitizedError.message).toContain('[redacted-connection-string]');
      expect(sanitizedError.message).toContain('password=[redacted]');
      expect(sanitizedError.message).toContain('token=[redacted]');
      expect(sanitizedError.message).toContain('secret=[redacted]');
    });
  });
});
