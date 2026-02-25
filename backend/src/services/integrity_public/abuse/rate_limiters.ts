/**
 * Rate limiter service for handling abuse prevention in /appeals and /runs/:id/verification endpoints.
 */
export interface RateLimiterOptions {
  /**
   * Burst limit for requests within a short time window (e.g., seconds).
   */
  burstLimit: number;

  /**
   * Maximum number of requests allowed per day.
   */
  dailyLimit: number;

  /**
   * Timeout in milliseconds before considering a request as expired.
   */
  timeout: number;
}

export interface RateLimiter {
  /**
   * Initialize rate limiter for the given key and options.
   * @param key - Unique identifier for the rate limiter (e.g., IP address or device ID).
   * @param options - Configuration options for the rate limiter.
   */
  initialize(key: string, options: RateLimiterOptions): Promise<void>;

  /**
   * Increment the counter for the given key and return a boolean indicating whether the request was allowed.
   * @param key - Unique identifier for the rate limiter (e.g., IP address or device ID).
   */
  increment(key: string): Promise<boolean>;

  /**
   * Reset the counter for the given key.
   * @param key - Unique identifier for the rate limiter (e.g., IP address or device ID).
   */
  reset(key: string): Promise<void>;
}
