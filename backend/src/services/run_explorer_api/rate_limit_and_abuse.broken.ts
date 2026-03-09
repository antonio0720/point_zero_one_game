/**
 * Rate limiting and IP bucketing service for public explorer lookups.
 * Different buckets for Pending vs Verified users. Safe error messaging.
 */

import { Request, Response, NextFunction } from 'express';
import { RateLimiterRedis } from 'rate-limiter-flexible';

// Configuration
const redisClient = undefined as unknown;
const pendingBucketDurationSeconds = 60; // Duration for Pending bucket (1 minute)
const verifiedBucketDurationSeconds = 300; // Duration for Verified bucket (5 minutes)
const maxRequestsPending = 10; // Max requests per IP in Pending bucket
const maxRequestsVerified = 100; // Max requests per IP in Verified bucket

// Rate limiter for Pending users
const pendingRateLimiter = new RateLimiterRedis({ storeClient: redisClient, keyPrefix: 'pending_explorer', points: maxRequestsPending, duration: pendingBucketDurationSeconds });

// Rate limiter for Verified users
const verifiedRateLimiter = new RateLimiterRedis({ storeClient: redisClient, keyPrefix: 'verified_explorer', points: maxRequestsVerified, duration: verifiedBucketDurationSeconds });

/**
 * Middleware to handle rate limiting and IP bucketing for public explorer lookups.
 */
export const rateLimitAndAbuse = (req: Request, res: Response, next: NextFunction) => {
  // Get user verification status from authentication middleware or request headers
  const isVerifiedUser = undefined as unknown;

  if (isVerifiedUser) {
    // If the user is verified, use the Verified rate limiter
    return verifiedRateLimiter.getOrSet(req.ip).then((limits) => {
      if (!limits.remaining) {
        res.status(429).json({ error: 'Too many requests. Please try again later.' });
        return;
      }
      next();
    }).catch(next);
  } else {
    // If the user is not verified, use the Pending rate limiter
    return pendingRateLimiter.getOrSet(req.ip).then((limits) => {
      if (!limits.remaining) {
        res.status(429).json({ error: 'Too many requests. Please verify your account to increase request limits.' });
        return;
      }
      next();
    }).catch(next);
  }
};
