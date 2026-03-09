/**
 * Telemetry Routes for API Gateway
 */

import express from 'express';
import jwt from 'express-jwt';
import { RateLimiterRedis } from 'rate-limiter-redis';
import { SamplingStrategy } from './sampling_strategy';

const router = express.Router();
const telemetryDb = require('../db/telemetry'); // Assuming you have a Telemetry database connection here
const rateLimiter = new RateLimiterRedis({ db: 'redis', workFactor: 10, max: 60 });

// JWT authentication middleware
const auth = jwt({
  secret: process.env.JWT_SECRET,
  userProperty: 'currentUser',
});

router.post('/telemetry', auth, async (req, res) => {
  const { currentUser } = req;

  // Rate limiting middleware
  await rateLimiter.wrap(async () => {
    try {
      const telemetryData = req.body;

      // Sampling strategy based on user role or other factors (implemented in SamplingStrategy)
      const shouldSample = SamplingStrategy.shouldSample(currentUser);

      if (!shouldSample) {
        return res.status(204).send(); // No Content response for non-sampled telemetry data
      }

      await telemetryDb.insertTelemetryData(telemetryData, currentUser.id);
      res.status(201).send(); // Created response for successfully sampled and stored telemetry data
    } catch (error) {
      console.error(`Error processing telemetry data: ${error}`);
      res.status(500).send({ error: 'An error occurred while processing the telemetry data.' });
    }
  });
});

export default router;
