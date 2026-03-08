//backend/host-os/routes/analytics.ts

import { Router, type Request, type Response } from 'express';
import joi from 'joi';
import { requireAdminApiKey } from '../auth/admin';
import { getHostAnalyticsByEmail } from '../db/host-analytics';

const router = Router();

const paramsSchema = joi.object({
  email: joi.string().email({ tlds: { allow: false } }).required(),
});

router.get('/:email', requireAdminApiKey, async (req: Request, res: Response) => {
  const { error, value } = paramsSchema.validate(req.params, {
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
    const analytics = await getHostAnalyticsByEmail(value.email);

    if (!analytics) {
      return res.status(404).json({
        ok: false,
        error: 'Host analytics not found',
      });
    }

    return res.status(200).json({
      ok: true,
      analytics,
      generatedAt: new Date().toISOString(),
    });
  } catch (routeError) {
    console.error('[host-os][analytics] failed to load host analytics', routeError);

    return res.status(500).json({
      ok: false,
      error: 'Internal server error',
    });
  }
});

export default router;