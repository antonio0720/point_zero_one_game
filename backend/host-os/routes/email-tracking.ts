// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/host-os/routes/email-tracking.ts

import { Router, type Request, type Response } from 'express';
import {
  getHostEmailMessageById,
  recordHostEmailEvent,
} from '../db/host-email-events';
import {
  markHostRegistrationUnsubscribed,
} from '../db/host-registrations';
import {
  parseTrackedClickPayload,
  verifyTrackedOpenPixelToken,
  verifyUnsubscribeToken,
} from '../services/host-email-links';

const router = Router();

const ONE_BY_ONE_GIF = Buffer.from(
  'R0lGODlhAQABAPAAAAAAAAAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==',
  'base64',
);

function getClientIp(req: Request): string | null {
  const forwarded = req.headers['x-forwarded-for'];
  const candidate = Array.isArray(forwarded)
    ? forwarded[0]
    : typeof forwarded === 'string'
      ? forwarded.split(',')[0]
      : req.ip;

  return candidate ? String(candidate).trim() : null;
}

router.get('/o/:messageId.gif', async (req: Request, res: Response) => {
  const messageId = req.params.messageId;
  const token = String(req.query.token || '');

  res.setHeader('content-type', 'image/gif');
  res.setHeader('cache-control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('pragma', 'no-cache');
  res.setHeader('expires', '0');

  if (!messageId || !token || !verifyTrackedOpenPixelToken(messageId, token)) {
    return res.status(200).send(ONE_BY_ONE_GIF);
  }

  const message = await getHostEmailMessageById(messageId);
  if (!message) {
    return res.status(200).send(ONE_BY_ONE_GIF);
  }

  await recordHostEmailEvent({
    messageId,
    registrationId: message.registration_id,
    eventType: 'open',
    ipAddress: getClientIp(req),
    userAgent: req.get('user-agent') ?? null,
    referer: req.get('referer') ?? null,
  });

  return res.status(200).send(ONE_BY_ONE_GIF);
});

router.get('/c/:messageId/:linkKey', async (req: Request, res: Response) => {
  const messageId = req.params.messageId;
  const linkKey = req.params.linkKey;
  const encodedUrl = String(req.query.u || '');
  const token = String(req.query.token || '');

  const resolvedUrl = parseTrackedClickPayload(
    messageId,
    linkKey,
    encodedUrl,
    token,
  );

  if (!resolvedUrl) {
    return res.status(400).send('Invalid click tracking link.');
  }

  const message = await getHostEmailMessageById(messageId);
  if (!message) {
    return res.redirect(302, resolvedUrl);
  }

  await recordHostEmailEvent({
    messageId,
    registrationId: message.registration_id,
    eventType: 'click',
    linkKey,
    targetUrl: resolvedUrl,
    ipAddress: getClientIp(req),
    userAgent: req.get('user-agent') ?? null,
    referer: req.get('referer') ?? null,
  });

  return res.redirect(302, resolvedUrl);
});

router.get('/unsubscribe/:registrationId', async (req: Request, res: Response) => {
  const registrationId = Number(req.params.registrationId);
  const token = String(req.query.token || '');

  if (
    !Number.isFinite(registrationId) ||
    !token ||
    !verifyUnsubscribeToken(registrationId, token)
  ) {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html lang="en">
        <head><meta charset="UTF-8" /><title>Invalid unsubscribe link</title></head>
        <body style="font-family: Arial, sans-serif; padding: 2rem;">
          <h1>Invalid unsubscribe link</h1>
          <p>This unsubscribe link is invalid or expired.</p>
        </body>
      </html>
    `);
  }

  await markHostRegistrationUnsubscribed(registrationId);

  return res.status(200).send(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Unsubscribed</title>
      </head>
      <body style="margin:0;padding:0;background:#0b1020;font-family:Arial,Helvetica,sans-serif;color:#e8efff;">
        <div style="max-width:640px;margin:48px auto;padding:32px;background:#11182d;border:1px solid #223055;border-radius:18px;">
          <p style="margin:0 0 12px 0;color:#6ee7b7;font-size:12px;letter-spacing:1.2px;text-transform:uppercase;font-weight:700;">Point Zero One Host OS</p>
          <h1 style="margin:0 0 16px 0;font-size:30px;line-height:38px;">You’re unsubscribed.</h1>
          <p style="margin:0 0 14px 0;font-size:16px;line-height:28px;color:#d7e0f4;">
            You will no longer receive Host OS nurture emails for this registration.
          </p>
          <p style="margin:0 0 20px 0;font-size:16px;line-height:28px;color:#d7e0f4;">
            If you download the kit again later, you can re-enter the sequence with a fresh request.
          </p>
          <a href="https://pointzeroonegame.com/host" style="display:inline-block;padding:14px 22px;background:#6ee7b7;color:#0b1020;text-decoration:none;border-radius:999px;font-weight:700;">
            Back to Host OS
          </a>
        </div>
      </body>
    </html>
  `);
});

export default router;