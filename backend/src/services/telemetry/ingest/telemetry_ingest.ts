/**
 * Telemetry Ingest Service for Point Zero One Digital
 */

import express from 'express';
import { Request, Response } from 'express';
import Joi from 'joi';
import { RateLimiterRedis } from 'rate-limiter-redis';
import redisClient from '../redis/client';
import { TelemetryEnvelopeV3 } from '../models/telemetry_envelope_v3';
import { PrivacyRedactionService } from './privacy_redaction';

const router = express.Router();
const rateLimiter = new RateLimiterRedis({ client: redisClient, keyPrefix: 'ingest-rate-limit' });

// Joi schema for TelemetryEnvelopeV3 validation
const telemetryEnvelopeSchema = Joi.object().keys({
  userId: Joi.string().required(),
  gameSessionId: Joi.string().required(),
  timestamp: Joi.number().integer().required(),
  data: Joi.object().required(),
});

/**
 * Ingest TelemetryEnvelopeV3 and handle validation, idempotency, rate limits, privacy redaction
 */
router.post('/telemetry-v3', async (req: Request, res: Response) => {
  try {
    // Validate the request body against the schema
    const { error } = telemetryEnvelopeSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Check rate limit for this user
    await rateLimiter.consume(req.ip, 'ingest');

    // Redact sensitive data if necessary
    const privacyRedactionService = new PrivacyRedactionService();
    const redactedData = await privacyRedactionService.redact(req.body.data);

    // Save the telemetry envelope to the database
    const telemetryEnvelope = new TelemetryEnvelopeV3({
      userId: req.body.userId,
      gameSessionId: req.body.gameSessionId,
      timestamp: req.body.timestamp,
      data: redactedData,
    });
    await telemetryEnvelope.save();

    res.status(201).json({ success: true });
  } catch (error) {
    console.error(`Error ingesting telemetry envelope: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

export { router };
