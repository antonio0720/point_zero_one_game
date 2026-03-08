// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/host-os/routes/email-dispatch.ts

import { Router, type Request, type Response } from 'express';
import { processDueHostEmails } from '../services/host-email-sequence';

const router = Router();

function isAuthorized(req: Request): boolean {
  const expected = process.env.HOST_OS_ADMIN_API_KEY;
  if (!expected) {
    return false;
  }

  const provided =
    req.get('x-admin-api-key') ||
    req.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    '';

  return provided === expected;
}

router.post('/process-due', async (req: Request, res: Response) => {
  if (!isAuthorized(req)) {
    return res.status(401).json({
      ok: false,
      error: 'Unauthorized',
    });
  }

  const limitRaw = Number(req.body?.limit ?? 50);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(limitRaw, 250)) : 50;

  const result = await processDueHostEmails(limit);

  return res.status(200).json({
    ok: true,
    ...result,
    processedAt: new Date().toISOString(),
  });
});

export default router;