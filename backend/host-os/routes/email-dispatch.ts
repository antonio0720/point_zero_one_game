import { Router, type Request, type Response } from 'express';
import joi from 'joi';
import { requireAdminApiKey } from '../auth/admin';
import { processDueHostEmails } from '../services/host-email-sequence';

const router = Router();

const processDueSchema = joi.object({
  limit: joi.number().integer().min(1).max(250).default(50),
});

router.post(
  '/process-due',
  requireAdminApiKey,
  async (req: Request, res: Response) => {
    const { error, value } = processDueSchema.validate(req.body ?? {}, {
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

    const startedAt = Date.now();

    try {
      const result = await processDueHostEmails(value.limit);

      return res.status(200).json({
        ok: true,
        scanned: result.scanned,
        attempted: result.attempted,
        limit: value.limit,
        processedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
      });
    } catch (routeError) {
      console.error('[host-os][email-dispatch] process-due failed', routeError);

      return res.status(500).json({
        ok: false,
        error: 'Internal server error',
      });
    }
  },
);

export default router;