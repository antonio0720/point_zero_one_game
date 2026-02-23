/**
 * ChatRouter.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * DEAL ROOM & MARKET MOVE ALERT — HTTP ENDPOINTS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Routes:
 *   POST /api/rivalries/:rivalryId/market-move-alert
 *     Publish Market Move Alert card to all surfaces for a rivalry phase.
 *     Idempotent — safe to retry. Minted once per rivalryId + phase.
 *
 *   POST /api/rivalries/:rivalryId/market-phase-bulletin
 *     Publish Market Phase Bulletin (SYSTEM message) into Deal Room
 *     and Syndicate channels.
 *
 *   POST /api/internal/stress/fanout
 *     War Fanout Stress Protocol — staging-only, feature-flag gated.
 *     Simulates concurrent rivalry fanout at Syndicate scale.
 */

import type { Request, Response, NextFunction } from 'express';
import type { ChatService, RivalryPhase, SyndicateBannerMeta } from './ChatService';

// ─── Middleware helpers ───────────────────────────────────────────────────────

function requireSeniorPartner(req: Request, res: Response, next: NextFunction): void {
  // Inject your auth middleware here.
  // Only Senior Partner (R4) or Managing Partner (R5) may trigger Market Move Alerts.
  const rank = (req as unknown as { user?: { rank?: string } }).user?.rank;
  if (rank !== 'SENIOR_PARTNER' && rank !== 'MANAGING_PARTNER') {
    res.status(403).json({ error: 'Senior Partner or Managing Partner authority required to publish Market Move Alerts.' });
    return;
  }
  next();
}

function requireSystemPublisher(req: Request, res: Response, next: NextFunction): void {
  // System-internal calls only — bypasses per-user rate limits.
  const token = req.headers['x-internal-token'];
  if (!token || token !== process.env.INTERNAL_SYSTEM_TOKEN) {
    res.status(403).json({ error: 'System publisher token required.' });
    return;
  }
  next();
}

function requireStressFlag(req: Request, res: Response, next: NextFunction): void {
  // War Fanout Stress Protocol — staging only.
  if (process.env.RIVALRY_LOAD_TEST_ENABLED !== 'true') {
    res.status(404).json({ error: 'Stress protocol not available in this environment.' });
    return;
  }
  next();
}

// ─── Route handlers ───────────────────────────────────────────────────────────

/**
 * POST /api/rivalries/:rivalryId/market-move-alert
 *
 * T194: Publish a Market Move Alert card for a rivalry phase transition.
 *
 * Behavior:
 *   - Idempotent per rivalryId + phase — safe to retry, never double-mints.
 *   - Requires Senior Partner or Managing Partner authority.
 *   - Returns 200 with payload if already published (idempotent success).
 *   - Returns 429 if Global Broadcast Quota is exceeded — retry after 60s.
 */
export async function handlePublishMarketMoveAlert(
  chatService: ChatService,
  req: Request,
  res: Response,
): Promise<void> {
  const { rivalryId } = req.params;

  const {
    phase,
    challenger,
    defender,
    phaseEndsAt,
    shardId,
    proofHash,
    yieldCaptureAmount,
  } = req.body as {
    phase:               RivalryPhase;
    challenger:          SyndicateBannerMeta;
    defender:            SyndicateBannerMeta;
    phaseEndsAt:         string;
    shardId:             string;
    proofHash?:          string;
    yieldCaptureAmount?: number;
  };

  if (!phase || !challenger || !defender || !phaseEndsAt || !shardId) {
    res.status(400).json({ error: 'phase, challenger, defender, phaseEndsAt, and shardId are required.' });
    return;
  }

  try {
    const result = await chatService.publishMarketMoveAlert(
      rivalryId,
      phase,
      challenger,
      defender,
      new Date(phaseEndsAt),
      shardId,
      proofHash,
      yieldCaptureAmount,
    );

    if (result === null) {
      // Already minted — idempotent success
      res.status(200).json({ status: 'already_published', rivalryId, phase });
      return;
    }

    res.status(201).json({ status: 'published', payload: result });
  } catch (err) {
    if (err instanceof Error && err.message.includes('quota exceeded')) {
      res.status(429).json({ error: err.message, retryAfterMs: 60_000 });
      return;
    }
    throw err;
  }
}

/**
 * POST /api/rivalries/:rivalryId/market-phase-bulletin
 *
 * T194 / T195: Publish Market Phase Bulletin into Deal Room + Syndicate channels.
 *
 * Behavior:
 *   - System-publisher only (bypasses user rate limits — this is server-authoritative).
 *   - Immutable once written. Transcript integrity enforced.
 *   - Part of the official rivalry record.
 */
export async function handlePublishMarketPhaseBulletin(
  chatService: ChatService,
  req: Request,
  res: Response,
): Promise<void> {
  const { rivalryId } = req.params;
  const { phase, challengerName, defenderName } = req.body as {
    phase:          RivalryPhase;
    challengerName: string;
    defenderName:   string;
  };

  if (!phase || !challengerName || !defenderName) {
    res.status(400).json({ error: 'phase, challengerName, and defenderName are required.' });
    return;
  }

  const bulletins = await chatService.publishMarketPhaseBulletin(
    rivalryId,
    phase,
    challengerName,
    defenderName,
  );

  res.status(201).json({ status: 'published', count: bulletins.length, bulletins });
}

/**
 * POST /api/internal/stress/fanout
 *
 * T198: War Fanout Stress Protocol.
 * Staging-only. Gated by RIVALRY_LOAD_TEST_ENABLED env flag.
 *
 * Simulates concurrent rivalry alert fanout at Syndicate scale.
 * Returns p50 / p95 / p99 latency breakdown.
 */
export async function handleWarFanoutStressProtocol(
  chatService: ChatService,
  req: Request,
  res: Response,
): Promise<void> {
  const {
    concurrentRivalries  = 10,
    syndicatesPerRivalry = 2,
    alertsPerRivalry     = 5,
  } = req.body as {
    concurrentRivalries?:  number;
    syndicatesPerRivalry?: number;
    alertsPerRivalry?:     number;
  };

  const result = await chatService.runWarFanoutStressProtocol({
    concurrentRivalries,
    syndicatesPerRivalry,
    alertsPerRivalry,
  });

  res.status(200).json({ status: 'complete', result });
}

// ─── Router factory ───────────────────────────────────────────────────────────

/**
 * Attach all Deal Room + Market Move Alert routes to an Express router.
 * Call this from your main app router.
 */
export function attachChatRivalryRoutes(
  router: {
    post: (
      path: string,
      ...handlers: Array<(req: Request, res: Response, next: NextFunction) => void>
    ) => void;
  },
  chatService: ChatService,
): void {

  // Market Move Alert — Senior Partner / Managing Partner authority required
  router.post(
    '/rivalries/:rivalryId/market-move-alert',
    requireSeniorPartner,
    (req, res) => handlePublishMarketMoveAlert(chatService, req, res),
  );

  // Market Phase Bulletin — system publisher only
  router.post(
    '/rivalries/:rivalryId/market-phase-bulletin',
    requireSystemPublisher,
    (req, res) => handlePublishMarketPhaseBulletin(chatService, req, res),
  );

  // War Fanout Stress Protocol — staging only
  router.post(
    '/internal/stress/fanout',
    requireStressFlag,
    requireSystemPublisher,
    (req, res) => handleWarFanoutStressProtocol(chatService, req, res),
  );
}
