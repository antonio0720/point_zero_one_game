/**
 * Rate limit joins per device/IP. Progressive bind, suspicious device downgrade logic (Seed only until proven).
 */

import { RateLimiterRedis } from "rate-limiter-flexible";
import { Client as RedisClient } from "redis";

export class Season0JoinRateLimits {
  private readonly redis: RedisClient;
  private readonly limiter = new RateLimiterRedis({ points: 1, duration: 60 }); // Limit 1 join per minute per device/IP

  constructor(redis: RedisClient) {
    this.redis = redis;
  }

  public async checkAndIncrement(deviceId: string): Promise<void> {
    await this.limiter.consume(deviceId);
    await this.redis.incrby(`join_attempts:${deviceId}`);
  }

  public async isSuspicious(deviceId: string): Promise<boolean> {
    const attempts = await this.redis.get(`join_attempts:${deviceId}`);
    return attempts && parseInt(attempts, 10) > 5; // If more than 5 join attempts in a short period, consider the device suspicious
  }

  public async downgradeSuspiciousDevice(deviceId: string): Promise<void> {
    const isSuspicious = await this.isSuspicious(deviceId);
    if (isSuspicious) {
      await this.redis.set(`device_status:${deviceId}`, "suspicious", { EX: 60 * 60 }); // Mark the device as suspicious for an hour
    }
  }
}
