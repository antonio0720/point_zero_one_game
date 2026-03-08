//backend/host-os/routes/stats.ts

import { Router, type Request, type Response } from 'express';
import { requireAdminApiKey } from '../auth/admin';
import { getHostDashboardStats } from '../db/host-stats';

const router = Router();

router.get('/', requireAdminApiKey, async (_req: Request, res: Response) => {
  try {
    const stats = await getHostDashboardStats();

    return res.status(200).json({
      ok: true,
      stats,
      generatedAt: new Date().toISOString(),
    });
  } catch (routeError) {
    console.error('[host-os][stats] failed to load stats', routeError);

    return res.status(500).json({
      ok: false,
      error: 'Internal server error',
    });
  }
});

export default router;

