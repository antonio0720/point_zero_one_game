/**
 * ============================================================================
 * FILE: pzo_server/src/services/alliance/AllianceRouter.ts
 * Point Zero One — Alliance REST API
 * 
 * Routes:
 *   POST   /alliances                          → create alliance
 *   GET    /alliances/search                   → search alliances
 *   GET    /alliances/leaderboard              → top alliances
 *   GET    /alliances/:allianceId              → get alliance info
 *   GET    /alliances/:allianceId/roster       → member roster
 *   GET    /alliances/:allianceId/applications → pending apps (R4+)
 *   POST   /alliances/:allianceId/join         → direct join (open)
 *   POST   /alliances/:allianceId/apply        → submit application (closed)
 *   POST   /alliances/applications/:appId/accept  → accept application (R4+)
 *   POST   /alliances/applications/:appId/reject  → reject application (R4+)
 *   DELETE /alliances/:allianceId/leave        → leave alliance
 *   DELETE /alliances/:allianceId/members/:targetId/kick → kick member
 *   PATCH  /alliances/:allianceId/members/:targetId/promote → promote
 *   PATCH  /alliances/:allianceId/members/:targetId/demote  → demote
 *   POST   /alliances/:allianceId/transfer/:newR5Id         → transfer R5
 *   PATCH  /alliances/:allianceId/settings     → update settings (R5)
 *   POST   /alliances/:allianceId/vault/contribute → contribute to vault
 *   POST   /alliances/:allianceId/aid          → request aid
 *   GET    /alliances/:allianceId/aid          → list open aid requests
 *   DELETE /alliances/:allianceId/disband      → disband (R5)
 *   POST   /alliances/:allianceId/war/declare/:targetAllianceId → declare war (R5)
 * 
 * Deploy to: pzo_server/src/services/alliance/AllianceRouter.ts
 * ============================================================================
 */

import { Router, Request, Response } from 'express';
import { Pool }            from 'pg';
import { Redis }           from 'ioredis';
import { AllianceService } from './AllianceService';
import { AllianceWarService } from './AllianceWarService';
import {
  createChatMiddleware,
  AuthenticatedRequest,
} from '../chat/ChatMiddleware';
import { apiOk, apiError } from '../../../shared/contracts/multiplayer';

export function createAllianceRouter(
  redis:    Redis,
  pg:       Pool,
  alliance: AllianceService,
  war:      AllianceWarService,
): Router {
  const router = Router();
  const mw     = createChatMiddleware(redis, pg);

  router.use(mw.authenticatePlayer);

  // ─── SEARCH / LEADERBOARD ──────────────────────────────────────────────────

  router.get('/search', async (req: Request, res: Response) => {
    const q     = (req.query.q as string) ?? '';
    const limit = Math.min(parseInt(req.query.limit as string ?? '20'), 50);
    const results = await alliance.search(q, limit);
    res.json(apiOk({ alliances: results }));
  });

  router.get('/leaderboard', async (_req: Request, res: Response) => {
    const board = await alliance.getLeaderboard(50);
    res.json(apiOk({ leaderboard: board }));
  });

  // ─── MY ALLIANCE (convenience) ─────────────────────────────────────────────

  router.get('/mine', async (req: Request, res: Response) => {
    const player = (req as AuthenticatedRequest).player;
    if (!player.allianceId) {
      res.json(apiOk({ alliance: null }));
      return;
    }
    const [info, roster] = await Promise.all([
      allianceById(alliance, player.allianceId, res),
      alliance.getRoster(player.allianceId),
    ]);
    if (!info) return;
    res.json(apiOk({ alliance: info, roster }));
  });

  // ─── CREATE ────────────────────────────────────────────────────────────────

  router.post('/', async (req: Request, res: Response) => {
    const player = (req as AuthenticatedRequest).player;
    const { tag, name, description, isOpen, language, bannerIconId } = req.body;

    if (!tag || !name) {
      res.status(400).json(apiError('MISSING_FIELDS', 'tag and name are required'));
      return;
    }

    try {
      const created = await alliance.create(player.id, {
        tag, name, description: description ?? '',
        isOpen: isOpen !== false, language, bannerIconId,
      });
      res.status(201).json(apiOk(created));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'CREATE_FAILED';
      const status = msg === 'TAG_TAKEN' ? 409 :
                     msg === 'ALREADY_IN_ALLIANCE' ? 409 : 400;
      res.status(status).json(apiError(msg, msg));
    }
  });

  // ─── GET INFO ──────────────────────────────────────────────────────────────

  router.get('/:allianceId', async (req: Request, res: Response) => {
    const info = await allianceById(alliance, req.params.allianceId, res);
    if (!info) return;
    res.json(apiOk(info));
  });

  // ─── ROSTER ────────────────────────────────────────────────────────────────

  router.get('/:allianceId/roster', async (req: Request, res: Response) => {
    const roster = await alliance.getRoster(req.params.allianceId);
    res.json(apiOk({ roster }));
  });

  // ─── JOIN (open alliances) ─────────────────────────────────────────────────

  router.post('/:allianceId/join', async (req: Request, res: Response) => {
    const player = (req as AuthenticatedRequest).player;
    try {
      await alliance.join(player.id, req.params.allianceId);
      res.json(apiOk({ joined: true }));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'JOIN_FAILED';
      res.status(conflictOrBadRequest(msg)).json(apiError(msg, msg));
    }
  });

  // ─── APPLY (invite-only alliances) ────────────────────────────────────────

  router.post('/:allianceId/apply', async (req: Request, res: Response) => {
    const player  = (req as AuthenticatedRequest).player;
    const message = (req.body.message ?? '').slice(0, 200);
    try {
      const app = await alliance.apply(player.id, req.params.allianceId, message);
      res.status(201).json(apiOk(app));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'APPLY_FAILED';
      res.status(conflictOrBadRequest(msg)).json(apiError(msg, msg));
    }
  });

  // ─── APPLICATIONS (R4+) ───────────────────────────────────────────────────

  router.get('/:allianceId/applications',
    mw.requireRank(4),
    async (req: Request, res: Response) => {
      const rows = await pg.query(
        `SELECT aa.*, p.display_name as user_name
         FROM alliance_applications aa
         JOIN players p ON p.id = aa.user_id
         WHERE aa.alliance_id = $1 AND aa.status = 'PENDING'
         ORDER BY aa.applied_at ASC`,
        [req.params.allianceId]
      );
      res.json(apiOk({ applications: rows.rows }));
    }
  );

  router.post('/applications/:appId/accept',
    mw.requireRank(4),
    async (req: Request, res: Response) => {
      const player = (req as AuthenticatedRequest).player;
      try {
        await alliance.acceptApplication(player.id, req.params.appId);
        res.json(apiOk({ accepted: true }));
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'ACCEPT_FAILED';
        res.status(conflictOrBadRequest(msg)).json(apiError(msg, msg));
      }
    }
  );

  router.post('/applications/:appId/reject',
    mw.requireRank(4),
    async (req: Request, res: Response) => {
      await pg.query(
        `UPDATE alliance_applications SET status = 'REJECTED' WHERE id = $1`,
        [req.params.appId]
      );
      res.json(apiOk({ rejected: true }));
    }
  );

  // ─── LEAVE ─────────────────────────────────────────────────────────────────

  router.delete('/:allianceId/leave', async (req: Request, res: Response) => {
    const player = (req as AuthenticatedRequest).player;
    try {
      await alliance.leave(player.id);
      res.json(apiOk({ left: true }));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'LEAVE_FAILED';
      res.status(409).json(apiError(msg, msg));
    }
  });

  // ─── KICK ──────────────────────────────────────────────────────────────────

  router.delete('/:allianceId/members/:targetId/kick',
    mw.requireRank(4),
    async (req: Request, res: Response) => {
      const player = (req as AuthenticatedRequest).player;
      try {
        await alliance.kick(player.id, req.params.targetId, req.params.allianceId, req.body.reason);
        res.json(apiOk({ kicked: true }));
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'KICK_FAILED';
        res.status(403).json(apiError(msg, msg));
      }
    }
  );

  // ─── PROMOTE / DEMOTE ─────────────────────────────────────────────────────

  router.patch('/:allianceId/members/:targetId/promote',
    async (req: Request, res: Response) => {
      const player = (req as AuthenticatedRequest).player;
      try {
        const newRank = await alliance.promote(player.id, req.params.targetId, req.params.allianceId);
        res.json(apiOk({ newRank }));
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'PROMOTE_FAILED';
        res.status(403).json(apiError(msg, msg));
      }
    }
  );

  router.patch('/:allianceId/members/:targetId/demote',
    async (req: Request, res: Response) => {
      const player = (req as AuthenticatedRequest).player;
      try {
        const newRank = await alliance.demote(player.id, req.params.targetId, req.params.allianceId);
        res.json(apiOk({ newRank }));
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'DEMOTE_FAILED';
        res.status(403).json(apiError(msg, msg));
      }
    }
  );

  // ─── TRANSFER LEADERSHIP ──────────────────────────────────────────────────

  router.post('/:allianceId/transfer/:newR5Id',
    mw.requireRank(5),
    async (req: Request, res: Response) => {
      const player = (req as AuthenticatedRequest).player;
      try {
        await alliance.transferLeadership(player.id, req.params.newR5Id, req.params.allianceId);
        res.json(apiOk({ transferred: true }));
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'TRANSFER_FAILED';
        res.status(403).json(apiError(msg, msg));
      }
    }
  );

  // ─── SETTINGS ─────────────────────────────────────────────────────────────

  router.patch('/:allianceId/settings',
    mw.requireRank(5),
    async (req: Request, res: Response) => {
      const player = (req as AuthenticatedRequest).player;
      try {
        await alliance.updateSettings(player.id, req.params.allianceId, req.body);
        res.json(apiOk({ updated: true }));
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'UPDATE_FAILED';
        res.status(400).json(apiError(msg, msg));
      }
    }
  );

  // ─── VAULT ────────────────────────────────────────────────────────────────

  router.post('/:allianceId/vault/contribute',
    async (req: Request, res: Response) => {
      const player = (req as AuthenticatedRequest).player;
      const amount = parseInt(req.body.amount);
      if (!amount || amount <= 0) {
        res.status(400).json(apiError('INVALID_AMOUNT', 'amount must be positive integer'));
        return;
      }
      try {
        await alliance.contributeToVault(player.id, req.params.allianceId, amount);
        res.json(apiOk({ contributed: amount }));
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'CONTRIBUTE_FAILED';
        res.status(400).json(apiError(msg, msg));
      }
    }
  );

  // ─── AID ──────────────────────────────────────────────────────────────────

  router.get('/:allianceId/aid', async (req: Request, res: Response) => {
    const rows = await pg.query(
      `SELECT aar.*, p.display_name as requester_name
       FROM alliance_aid_requests aar
       JOIN players p ON p.id = aar.requester_id
       WHERE aar.alliance_id = $1 AND aar.expires_at > NOW() AND aar.fulfilled < aar.target
       ORDER BY aar.created_at DESC`,
      [req.params.allianceId]
    );
    res.json(apiOk({ requests: rows.rows }));
  });

  router.post('/:allianceId/aid',
    async (req: Request, res: Response) => {
      const player = (req as AuthenticatedRequest).player;
      const { type, amount } = req.body;
      try {
        const request = await alliance.requestAid(player.id, req.params.allianceId, type, parseInt(amount));
        res.status(201).json(apiOk(request));
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'AID_REQUEST_FAILED';
        res.status(400).json(apiError(msg, msg));
      }
    }
  );

  // ─── DISBAND ──────────────────────────────────────────────────────────────

  router.delete('/:allianceId/disband',
    mw.requireRank(5),
    async (req: Request, res: Response) => {
      const player = (req as AuthenticatedRequest).player;
      // Double-confirm with body flag to prevent accidental disband
      if (req.body.confirm !== true) {
        res.status(400).json(apiError('CONFIRM_REQUIRED', 'Pass { confirm: true } to disband'));
        return;
      }
      try {
        await alliance.disband(player.id, req.params.allianceId);
        res.json(apiOk({ disbanded: true }));
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'DISBAND_FAILED';
        res.status(403).json(apiError(msg, msg));
      }
    }
  );

  // ─── WAR DECLARATION ──────────────────────────────────────────────────────

  router.post('/:allianceId/war/declare/:targetId',
    mw.requireRank(5),
    async (req: Request, res: Response) => {
      const player = (req as AuthenticatedRequest).player;
      try {
        const warRecord = await war.declare(player.id, req.params.allianceId, req.params.targetId);
        res.status(201).json(apiOk(warRecord));
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'WAR_DECLARE_FAILED';
        res.status(400).json(apiError(msg, msg));
      }
    }
  );

  router.get('/:allianceId/war/current', async (req: Request, res: Response) => {
    const warRecord = await war.getCurrentWar(req.params.allianceId);
    res.json(apiOk({ war: warRecord }));
  });

  router.get('/:allianceId/war/history', async (req: Request, res: Response) => {
    const history = await war.getWarHistory(req.params.allianceId);
    res.json(apiOk({ history }));
  });

  return router;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

async function allianceById(
  alliance: AllianceService,
  id: string,
  res: Response
): Promise<import('../../../shared/contracts/multiplayer').Alliance | null> {
  try {
    // @ts-expect-error — accessing private method via cast
    return await (alliance as unknown as { _getById: (id: string) => Promise<unknown> })._getById(id);
  } catch {
    res.status(404).json(apiError('ALLIANCE_NOT_FOUND', `Alliance ${id} not found`));
    return null;
  }
}

function conflictOrBadRequest(msg: string): number {
  const conflictCodes = ['ALREADY_IN_ALLIANCE', 'TAG_TAKEN', 'ALLIANCE_FULL', 'JOIN_COOLDOWN_ACTIVE'];
  return conflictCodes.includes(msg) ? 409 : 400;
}
