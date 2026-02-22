import { NextFunction, Request, Response } from 'express';
import { GHL_WEBHOOK_SECRET } from '../config/secrets';
import { getAuditHash } from '../utils/audit-hash';
import { mlEnabled } from '../utils/ml-enabled';

export const paywall = async (req: Request, res: Response, next: NextFunction) => {
  if (!mlEnabled()) return next();

  const ghlWebhookSecret = req.header('X-Google-Webhook-Secret');
  if (ghlWebhookSecret !== GHL_WEBHOOK_SECRET) {
    return res.status(401).send({ error: 'Unauthorized' });
  }

  const auditHash = getAuditHash();
  const dailySeedLimit = await getDailySeedLimit(auditHash);

  if (dailySeedLimit <= 0) {
    return res.status(402).json({
      error: 'Daily seed limit exceeded',
      upgrade_url: '/upgrade',
    });
  }

  next();
};

async function getDailySeedLimit(auditHash: string): Promise<number> {
  const ip = req.ip;
  const player = req.player;

  // Simulate database query for demonstration purposes
  const dailySeedLimit = await db.query(
    `SELECT COUNT(*) FROM seeds WHERE ip = $1 AND player = $2 AND audit_hash = $3`,
    [ip, player, auditHash]
  );

  return dailySeedLimit[0].count;
}
