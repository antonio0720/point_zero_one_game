/**
 * Moments routes for the Point Zero One Digital backend.
 * backend/host-os/routes/moments.ts
 */

import { Router, type Request, type Response } from 'express';
import joi from 'joi';
import { createHostMoment, listHostMomentsBySessionId } from '../db/host-moments';
import { sendGhlHostEvent } from '../services/ghl-host-webhook';

const router = Router();

const createMomentSchema = joi.object({
  sessionId: joi.string().trim().max(128).required(),
  hostEmail: joi.string().email({ tlds: { allow: false } }).required(),
  momentCode: joi.string().trim().max(128).required(),
  gameSeed: joi.string().trim().max(128).required(),
  tick: joi.number().integer().min(0).required(),
  metadataJson: joi.object().unknown(true).default({}),
});

const listParamsSchema = joi.object({
  sessionId: joi.string().trim().max(128).required(),
});

const listQuerySchema = joi.object({
  limit: joi.number().integer().min(1).max(1000).default(250),
});

router.post('/', async (req: Request, res: Response) => {
  const { error, value } = createMomentSchema.validate(req.body ?? {}, {
    abortEarly: false,
    stripUnknown: true,
    convert: true,
  });

  if (error) {
    return res.status(400).json({
      ok: false,
      error: error.message,
    });
  }

  try {
    const moment = await createHostMoment(value);

    void sendGhlHostEvent('host_moment_logged', {
      momentId: moment.id,
      sessionId: moment.sessionId,
      hostEmail: moment.hostEmail,
      momentCode: moment.momentCode,
      tick: moment.tick,
      createdAt: moment.createdAt,
    });

    return res.status(201).json({
      ok: true,
      moment,
    });
  } catch (routeError) {
    console.error('[host-os][moments] failed to create moment', routeError);

    return res.status(500).json({
      ok: false,
      error: 'Internal server error',
    });
  }
});

router.get('/:sessionId', async (req: Request, res: Response) => {
  const paramsValidation = listParamsSchema.validate(req.params, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (paramsValidation.error) {
    return res.status(400).json({
      ok: false,
      error: paramsValidation.error.message,
    });
  }

  const queryValidation = listQuerySchema.validate(req.query, {
    abortEarly: false,
    stripUnknown: true,
    convert: true,
  });

  if (queryValidation.error) {
    return res.status(400).json({
      ok: false,
      error: queryValidation.error.message,
    });
  }

  try {
    const moments = await listHostMomentsBySessionId(
      paramsValidation.value.sessionId,
      queryValidation.value.limit,
    );

    return res.status(200).json({
      ok: true,
      count: moments.length,
      moments,
    });
  } catch (routeError) {
    console.error('[host-os][moments] failed to list moments', routeError);

    return res.status(500).json({
      ok: false,
      error: 'Internal server error',
    });
  }
});

export default router;