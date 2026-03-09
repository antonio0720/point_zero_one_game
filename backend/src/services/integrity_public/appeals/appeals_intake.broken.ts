/**
 * Appeals Intake Service
 */

import { NextFunction, Request, Response } from 'express';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { v4 as uuidv4 } from 'uuid';
import { Appeal, AppealDocument } from '../models/appeal';
import { Account } from '../models/account';
import { Device } from '../models/device';
import { Event } from '../models/event';
import redisClient from '../redis';

/** Rate limiter for appeals per account/device */
const rateLimiter = new RateLimiterRedis({ storeClient: redisClient, keyPrefix: 'appeals' });

export const validateSchema = (req: Request) => {
  // Validate the appeal schema here
};

export const rateLimit = (req: Request, res: Response, next: NextFunction) => {
  rateLimiter.getOrSet(req.accountId || req.deviceId, {
    points: 1,
    duration: 60 // seconds
  })
    .then(() => next())
    .catch((err) => res.status(429).json({ error: err.message }));
};

export const storeEvent = (appealId: string, accountId: string, deviceId: string) => {
  // Store the event in the database here
};

export const getReceipt = async (): Promise<string> => {
  return uuidv4();
};

/**
 * POST /appeals
 * Validate schema, rate-limit per account/device, store event, return receipt; no sensitive leakage.
 */
export const appealsIntake = (req: Request, res: Response) => {
  if (!validateSchema(req)) {
    return res.status(400).json({ error: 'Invalid appeal schema' });
  }

  rateLimit(req, res, async () => {
    const receipt = await getReceipt();
    storeEvent(receipt, req.accountId || '', req.deviceId || '');

    // Save the appeal in the database here

    res.json({ receipt });
  });
};
