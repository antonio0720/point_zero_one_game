/**
 * Rate Limit Service — in-memory sliding window rate limiter.
 * Production: replace with Redis-backed limiter.
 */
export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: Date;
}

export class RateLimitService {
  private readonly limits = new Map<string, { count: number; resetAt: number }>();
  private readonly maxRequests = 100;
  private readonly windowMs = 60_000;

  async checkRateLimit(identityId: string): Promise<RateLimitResult> {
    const now = Date.now();
    const entry = this.limits.get(identityId);

    if (!entry || now > entry.resetAt) {
      this.limits.set(identityId, { count: 1, resetAt: now + this.windowMs });
      return { success: true, remaining: this.maxRequests - 1, resetAt: new Date(now + this.windowMs) };
    }

    entry.count += 1;
    const success = entry.count <= this.maxRequests;
    return { success, remaining: Math.max(0, this.maxRequests - entry.count), resetAt: new Date(entry.resetAt) };
  }
}
