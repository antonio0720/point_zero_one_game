/**
 * Analytics routes for the Point Zero One Host OS service.
 * backend/host-os/routes/analytics.ts
 */

import { Router, type Request, type Response } from 'express';
import joi from 'joi';
import { requireAdminApiKey } from '../auth/admin';
import { getHostAnalyticsByEmail } from '../db/host-analytics';

const router = Router();

const paramsSchema = joi.object({
  email: joi
    .string()
    .trim()
    .lowercase()
    .max(320)
    .email({ tlds: { allow: false } })
    .required(),
});

function formatValidationError(error: joi.ValidationError): string {
  return error.details.map((detail) => detail.message).join('; ');
}

function validateParams(
  params: Request['params'],
): { ok: true; value: { email: string } } | { ok: false; error: string } {
  const { error, value } = paramsSchema.validate(params, {
    abortEarly: false,
    stripUnknown: true,
    convert: true,
  });

  if (error) {
    return {
      ok: false,
      error: formatValidationError(error),
    };
  }

  return {
    ok: true,
    value: {
      email: value.email,
    },
  };
}

function isInputError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();

  return (
    message.includes('email must not be empty') ||
    message.includes('email must be a valid email-like value')
  );
}

router.get(
  '/:email',
  requireAdminApiKey,
  async (req: Request, res: Response) => {
    const paramsValidation = validateParams(req.params);

    if (!paramsValidation.ok) {
      return res.status(400).json({
        ok: false,
        error: paramsValidation.error,
      });
    }

    res.setHeader('Cache-Control', 'no-store');

    try {
      const analytics = await getHostAnalyticsByEmail(
        paramsValidation.value.email,
      );

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
      if (isInputError(routeError)) {
        return res.status(400).json({
          ok: false,
          error:
            routeError instanceof Error
              ? routeError.message
              : 'Invalid request',
        });
      }

      console.error(
        '[host-os][analytics] failed to load host analytics',
        routeError,
      );

      return res.status(500).json({
        ok: false,
        error: 'Internal server error',
      });
    }
  },
);

export default router;