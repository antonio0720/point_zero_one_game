// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/host-os/routes/kit-download.ts

import { Router, type Request, type Response } from 'express';
import Joi from 'joi';
import Redis from 'ioredis';
import {
  HOST_KIT_VERSION,
  getHostRegistrationById,
  setHostRegistrationWebhookSync,
  upsertHostRegistration,
} from '../db/host-registrations';
import {
  buildSignedKitDownloadRedirectUrl,
  getHostOsPublicKitUrl,
  verifySignedKitDownloadRedirectUrl,
} from '../services/host-email-links';
import { sendHostKitDownloadedWebhook } from '../services/ghl-host-webhook';
import {
  queueFullHostSequence,
  sendMessageNow,
} from '../services/host-email-sequence';

const router = Router();

const requestSchema = Joi.object({
  email: Joi.string().email().trim().required(),
  name: Joi.string().trim().max(120).allow('').default(''),
});

const redisUrl = process.env.HOST_OS_REDIS_URL;
const redis = redisUrl
  ? new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      lazyConnect: true,
    })
  : null;

const localRateLimitState = new Map<string, { count: number; expiresAt: number }>();

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  const candidate = Array.isArray(forwarded)
    ? forwarded[0]
    : typeof forwarded === 'string'
      ? forwarded.split(',')[0]
      : req.ip;

  return String(candidate || 'unknown').trim();
}

async function takeDailyRateLimit(ipAddress: string): Promise<boolean> {
  const maxPerWindow = 3;
  const windowSeconds = 60 * 60 * 24;
  const key = `host-os:kit-download:${ipAddress}`;

  if (redis) {
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, windowSeconds);
    }

    return current <= maxPerWindow;
  }

  const now = Date.now();
  const current = localRateLimitState.get(key);

  if (!current || current.expiresAt <= now) {
    localRateLimitState.set(key, {
      count: 1,
      expiresAt: now + windowSeconds * 1000,
    });
    return true;
  }

  if (current.count >= maxPerWindow) {
    return false;
  }

  current.count += 1;
  localRateLimitState.set(key, current);
  return true;
}

router.post('/', async (req: Request, res: Response) => {
  const { value, error } = requestSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    return res.status(400).json({
      ok: false,
      error: error.message,
    });
  }

  const ipAddress = getClientIp(req);
  const allowed = await takeDailyRateLimit(ipAddress);

  if (!allowed) {
    return res.status(429).json({
      ok: false,
      error: 'Download limit reached for this IP. Please try again tomorrow.',
    });
  }

  const registration = await upsertHostRegistration({
    email: value.email,
    name: value.name,
    ipAddress,
    kitVersion: HOST_KIT_VERSION,
  });

  try {
    const webhookResult = await sendHostKitDownloadedWebhook({
      hostId: registration.id,
      email: registration.email,
      name: registration.name,
      kitVersion: registration.kit_version,
      downloadCount: registration.download_count,
    });

    await setHostRegistrationWebhookSync(registration.id, webhookResult.delivered);
  } catch (webhookError) {
    console.error('[host-os] GHL webhook failed', webhookError);
    await setHostRegistrationWebhookSync(registration.id, false);
  }

  const immediateMessage = await queueFullHostSequence(registration);
  await sendMessageNow(immediateMessage);

  return res.status(200).json({
    ok: true,
    message:
      'Host OS Kit unlocked. Check your inbox now. You can also open the kit directly with the link below.',
    host: {
      id: registration.id,
      email: registration.email,
      name: registration.name,
      kitVersion: registration.kit_version,
    },
    downloadUrl: buildSignedKitDownloadRedirectUrl(registration.id),
    dashboardUrl: `${process.env.HOST_OS_PUBLIC_BASE_URL || 'https://pointzeroonegame.com'}/host`,
    waitlistUrl: `${process.env.HOST_OS_PUBLIC_BASE_URL || 'https://pointzeroonegame.com'}/host/waitlist`,
  });
});

router.get('/file', async (req: Request, res: Response) => {
  const registrationId = Number(req.query.registrationId);
  const expires = Number(req.query.expires);
  const token = String(req.query.token || '');

  if (!Number.isFinite(registrationId) || !Number.isFinite(expires) || !token) {
    return res.status(400).json({
      ok: false,
      error: 'Invalid download request.',
    });
  }

  const valid = verifySignedKitDownloadRedirectUrl(registrationId, expires, token);
  if (!valid) {
    return res.status(403).json({
      ok: false,
      error: 'This download link is invalid or expired.',
    });
  }

  const registration = await getHostRegistrationById(registrationId);
  if (!registration) {
    return res.status(404).json({
      ok: false,
      error: 'Registration not found.',
    });
  }

  return res.redirect(302, getHostOsPublicKitUrl());
});

export default router;