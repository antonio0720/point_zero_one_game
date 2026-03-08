/**
 * Routes for handling host invites
 */

import { Router, type Request, type Response } from 'express';
import joi from 'joi';
import {
  getHostInviteByToken,
  isHostInviteExpired,
  markHostInviteOpened,
  markHostInviteRsvp,
} from '../db/host-invites';
import { getHostOsPublicBaseUrl } from '../services/host-email-links';
import { sendGhlHostEvent } from '../services/ghl-host-webhook';

const router = Router();

const paramsSchema = joi.object({
  token: joi.string().pattern(/^[A-Za-z0-9_-]{16,128}$/).required(),
});

router.get('/:token', async (req: Request, res: Response) => {
  const { error, value } = paramsSchema.validate(req.params, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    return res.status(400).json({
      ok: false,
      error: error.message,
    });
  }

  try {
    const invite = await getHostInviteByToken(value.token);

    if (!invite) {
      return res.status(404).json({
        ok: false,
        error: 'Invite not found.',
      });
    }

    if (isHostInviteExpired(invite)) {
      return res.status(410).json({
        ok: false,
        error: 'Invite expired.',
      });
    }

    const openedInvite = (await markHostInviteOpened(value.token)) ?? invite;

    void sendGhlHostEvent('host_invite_opened', {
      inviteId: openedInvite.id,
      token: openedInvite.token,
      sessionId: openedInvite.sessionId,
      hostEmail: openedInvite.hostEmail,
      hostName: openedInvite.hostName,
      openedAt: openedInvite.openedAt,
    });

    return res.status(200).json({
      ok: true,
      invite: {
        token: openedInvite.token,
        sessionId: openedInvite.sessionId,
        hostEmail: openedInvite.hostEmail,
        hostName: openedInvite.hostName,
        sessionAt: openedInvite.sessionAt,
        sessionFormat: openedInvite.sessionFormat,
        expiresAt: openedInvite.expiresAt,
      },
      rsvpUrl: `${getHostOsPublicBaseUrl()}/host/invite/${encodeURIComponent(
        openedInvite.token,
      )}/rsvp`,
    });
  } catch (routeError) {
    console.error('[host-os][invites] failed to load invite', routeError);

    return res.status(500).json({
      ok: false,
      error: 'Internal server error',
    });
  }
});

router.post('/:token/rsvp', async (req: Request, res: Response) => {
  const { error, value } = paramsSchema.validate(req.params, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    return res.status(400).json({
      ok: false,
      error: error.message,
    });
  }

  try {
    const invite = await getHostInviteByToken(value.token);

    if (!invite) {
      return res.status(404).json({
        ok: false,
        error: 'Invite not found.',
      });
    }

    if (isHostInviteExpired(invite)) {
      return res.status(410).json({
        ok: false,
        error: 'Invite expired.',
      });
    }

    const rsvpedInvite = (await markHostInviteRsvp(value.token)) ?? invite;

    void sendGhlHostEvent('host_invite_rsvp', {
      inviteId: rsvpedInvite.id,
      token: rsvpedInvite.token,
      sessionId: rsvpedInvite.sessionId,
      hostEmail: rsvpedInvite.hostEmail,
      hostName: rsvpedInvite.hostName,
      rsvpAt: rsvpedInvite.rsvpAt,
    });

    return res.status(200).json({
      ok: true,
      invite: {
        token: rsvpedInvite.token,
        sessionId: rsvpedInvite.sessionId,
        hostEmail: rsvpedInvite.hostEmail,
        hostName: rsvpedInvite.hostName,
        sessionAt: rsvpedInvite.sessionAt,
        sessionFormat: rsvpedInvite.sessionFormat,
        rsvpAt: rsvpedInvite.rsvpAt,
      },
      message: 'RSVP recorded.',
    });
  } catch (routeError) {
    console.error('[host-os][invites] failed to RSVP invite', routeError);

    return res.status(500).json({
      ok: false,
      error: 'Internal server error',
    });
  }
});

export default router;