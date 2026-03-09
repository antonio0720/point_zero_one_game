/**
 * Public Integrity Routes for Point Zero One Digital's Financial Roguelike Game API Gateway
 */

import express from 'express';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import redisClient from '../redis/client';
import IntegrityService from './integrity.service';

const router = express.Router();
const rateLimiter = new RateLimiterRedis({ storeClient: redisClient, keyPrefix: 'exploit_reports' });

/**
 * Get all exploit reports with caching and rate limiting
 */
router.get('/exploit-reports', async (req, res) => {
  try {
    await rateLimiter.consume(req.ip);
    const integrityService = new IntegrityService();
    const reports = await integrityService.getAllReports();
    res.json(reports);
  } catch (error) {
    res.status(429).send('Too many requests');
  }
});

export { router };

