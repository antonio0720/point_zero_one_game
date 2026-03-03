/**
 * Countdown Clock — Season 0
 * Point Zero One · Density6 LLC · Confidential
 *
 * Tracks time remaining until the Season 0 end date.
 * Results are cached to avoid hammering Date.now() on every call.
 * Cache TTL: 60 seconds (configurable).
 */

export interface CountdownResult {
  remainingSeconds: number;
  remainingDays:    number;
  remainingHours:   number;
  remainingMinutes: number;
  ended:            boolean;
  endDate:          Date;
  formatted:        string; // "14d 06h 32m 09s"
}

export interface CountdownClockConfig {
  /** Season end timestamp. Defaults to 2026-12-31 23:59:59 UTC. */
  endDate?: Date;
  /** Cache TTL in milliseconds. Default: 60_000 (1 min). */
  cacheTtlMs?: number;
  /** Injected clock function — use for testing. Default: Date.now */
  nowFn?: () => number;
}

const DEFAULT_END_DATE = new Date('2026-12-31T23:59:59.000Z');
const DEFAULT_CACHE_TTL_MS = 60_000;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function buildFormatted(total: number): string {
  if (total <= 0) return '00d 00h 00m 00s';
  const d  = Math.floor(total / 86400);
  const h  = Math.floor((total % 86400) / 3600);
  const m  = Math.floor((total % 3600) / 60);
  const s  = total % 60;
  return `${pad(d)}d ${pad(h)}h ${pad(m)}m ${pad(s)}s`;
}

export class CountdownClockService {
  private readonly endDate:     Date;
  private readonly cacheTtlMs:  number;
  private readonly nowFn:       () => number;

  private cachedResult: CountdownResult | null = null;
  private cacheExpiresAt = 0;

  constructor(config: CountdownClockConfig = {}) {
    this.endDate    = config.endDate    ?? DEFAULT_END_DATE;
    this.cacheTtlMs = config.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
    this.nowFn      = config.nowFn      ?? (() => Date.now());
  }

  // ── Public ────────────────────────────────────────────────────────────────

  getCountdown(): CountdownResult {
    const now = this.nowFn();

    if (this.cachedResult && now < this.cacheExpiresAt) {
      return this.cachedResult;
    }

    const remainingMs      = this.endDate.getTime() - now;
    const remainingSeconds = Math.max(0, Math.floor(remainingMs / 1000));
    const ended            = remainingMs <= 0;

    const result: CountdownResult = {
      remainingSeconds,
      remainingDays:    Math.floor(remainingSeconds / 86400),
      remainingHours:   Math.floor((remainingSeconds % 86400) / 3600),
      remainingMinutes: Math.floor((remainingSeconds % 3600) / 60),
      ended,
      endDate:          this.endDate,
      formatted:        buildFormatted(remainingSeconds),
    };

    this.cachedResult    = result;
    this.cacheExpiresAt  = now + this.cacheTtlMs;

    return result;
  }

  /** Force cache invalidation — call after config changes. */
  invalidateCache(): void {
    this.cachedResult   = null;
    this.cacheExpiresAt = 0;
  }

  isSeasonActive(): boolean {
    return !this.getCountdown().ended;
  }

  assertSeasonActive(): void {
    if (!this.isSeasonActive()) {
      throw new Error('Season has ended');
    }
  }
}