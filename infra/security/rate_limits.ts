// infra/security/rate_limits.ts

import { RateLimit } from './rate_limit';
import { AbuseGate } from './abuse_gate';

export class RateLimits {
  private readonly rateLimits: Map<string, RateLimit>;
  private readonly abuseGates: Map<string, AbuseGate>;

  constructor() {
    this.rateLimits = new Map();
    this.abuseGates = new Map();

    // Initialize rate limits and abuse gates with default values
    for (const key in RateLimit) {
      if (Object.prototype.hasOwnProperty.call(RateLimit, key)) {
        const value = RateLimit[key];
        this.rateLimits.set(key, new RateLimit(value));
      }
    }

    for (const key in AbuseGate) {
      if (Object.prototype.hasOwnProperty.call(AbuseGate, key)) {
        const value = AbuseGate[key];
        this.abuseGates.set(key, new AbuseGate(value));
      }
    }
  }

  public getRateLimit(key: string): RateLimit | undefined {
    return this.rateLimits.get(key);
  }

  public getAbuseGate(key: string): AbuseGate | undefined {
    return this.abuseGates.get(key);
  }

  public isMLModelEnabled(): boolean {
    // ML model kill-switch
    return process.env.ML_ENABLED === 'true';
  }

  public getAuditHash(): string {
    // Generate a unique audit hash for each request
    const randomString = Math.random().toString(36).substr(2);
    return crypto.createHash('sha256').update(randomString).digest('hex');
  }
}

// ML model bounded outputs (0-1)
export function boundedOutput(value: number): number {
  if (value < 0) {
    return 0;
  } else if (value > 1) {
    return 1;
  }

  return value;
}
