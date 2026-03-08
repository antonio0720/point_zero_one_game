//backend/host-os/routes/printables.ts

import { Router, type Request, type Response } from 'express';
import Joi from 'joi';
import Redis from 'ioredis';
import {
  getHostPrintableByType,
  normalizePrintableType,
  type HostPrintable,
} from '../db/host-printables';
import { sendGhlHostEvent } from '../services/ghl-host-webhook';

const router = Router();

const redisUrl = process.env.HOST_OS_REDIS_URL?.trim();
const redis = redisUrl
  ? new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      lazyConnect: true,
    })
  : null;

const inMemoryCache = new Map<
  string,
  { printable: HostPrintable; expiresAtMs: number }
>();

const paramsSchema = Joi.object({
  type: Joi.string().trim().max(64).required(),
});

const querySchema = Joi.object({
  meta: Joi.boolean().truthy('1').truthy('true').falsy('0').falsy('false').default(false),
});

router.get('/:type', async (req: Request, res: Response) => {
  const paramsValidation = paramsSchema.validate(req.params, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (paramsValidation.error) {
    return res.status(400).json({
      ok: false,
      error: paramsValidation.error.message,
    });
  }

  const queryValidation = querySchema.validate(req.query, {
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
    const printableType = normalizePrintableType(paramsValidation.value.type);
    const printable = await getCachedPrintable(printableType);

    if (!printable || !printable.enabled) {
      return res.status(404).json({
        ok: false,
        error: 'Printable not found.',
      });
    }

    void sendGhlHostEvent('host_printable_opened', {
      printableId: printable.id,
      printableType: printable.type,
      assetUrl: printable.assetUrl,
    });

    if (queryValidation.value.meta) {
      return res.status(200).json({
        ok: true,
        printable: {
          id: printable.id,
          type: printable.type,
          title: printable.title,
          description: printable.description,
          assetUrl: printable.assetUrl,
          cacheTtlSeconds: printable.cacheTtlSeconds,
        },
      });
    }

    return res.redirect(302, printable.assetUrl);
  } catch (routeError) {
    console.error('[host-os][printables] failed to resolve printable', routeError);

    return res.status(500).json({
      ok: false,
      error: 'Internal server error',
    });
  }
});

async function getCachedPrintable(type: string): Promise<HostPrintable | null> {
  const localEntry = inMemoryCache.get(type);
  if (localEntry && localEntry.expiresAtMs > Date.now()) {
    return localEntry.printable;
  }

  const redisKey = `host-os:printables:${type}`;

  if (redis) {
    try {
      const cached = await redis.get(redisKey);
      if (cached) {
        const printable = JSON.parse(cached) as HostPrintable;
        inMemoryCache.set(type, {
          printable,
          expiresAtMs: Date.now() + printable.cacheTtlSeconds * 1000,
        });
        return printable;
      }
    } catch (redisError) {
      console.error('[host-os][printables] redis read failed', redisError);
    }
  }

  const printable = await getHostPrintableByType(type);
  if (!printable) {
    return null;
  }

  inMemoryCache.set(type, {
    printable,
    expiresAtMs: Date.now() + printable.cacheTtlSeconds * 1000,
  });

  if (redis) {
    try {
      await redis.set(
        redisKey,
        JSON.stringify(printable),
        'EX',
        printable.cacheTtlSeconds,
      );
    } catch (redisError) {
      console.error('[host-os][printables] redis write failed', redisError);
    }
  }

  return printable;
}

export default router;