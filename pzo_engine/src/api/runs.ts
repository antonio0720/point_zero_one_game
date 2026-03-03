// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — API ROUTES — RUNS
// pzo_engine/src/api/routes/runs.ts
//
// Routes:
//   POST /runs                    → Submit a completed run (protected)
//   GET  /runs/:id                → Fetch run by ID (public)
//   GET  /runs/user/:userId       → All runs for a user (protected)
//   GET  /leaderboard             → Ranked leaderboard (public)
//
// Density6 LLC · Point Zero One · API Layer · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import { Router, Request, Response } from 'express';
import { getRunStore }                from '../persistence/run-store';
import { requireApiKey }              from '../middleware/auth';
import { validateRunSubmission, validateLeaderboardQuery } from '../middleware/validate';
import type {
  SubmitRunRequest,
  SubmitRunResponse,
  GetRunResponse,
  LeaderboardResponse,
  LeaderboardEntry,
  LeaderboardQuery,
  UserRunsResponse,
} from './types';
import type { RunGrade, RunOutcome } from '../persistence/types';

export const runsRouter = Router();

// =============================================================================
// POST /runs — Submit a completed run
// =============================================================================

runsRouter.post(
  '/',
  requireApiKey,
  validateRunSubmission,
  async (req: Request, res: Response): Promise<void> => {
    const store = getRunStore();
    const body  = req.body as SubmitRunRequest;

    try {
      const run = await store.save({
        accumulator: body.accumulator,
        identity:    body.identity,
      });

      const response: SubmitRunResponse = {
        runId:            run.id,
        proofHash:        run.proofHash,
        auditHash:        run.auditHash,
        grade:            run.grade as RunGrade,
        sovereigntyScore: run.score,
        integrityStatus:  run.integrityStatus,
        outcome:          run.outcome as RunOutcome,
        finalNetWorth:    run.finalNetWorth,
        completedAt:      run.completedAt,
      };

      res.status(201).json({ ok: true, data: response, ts: Date.now() });

    } catch (err) {
      console.error('[POST /runs] Unexpected error:', err);
      res.status(500).json({
        ok:    false,
        error: 'Failed to save run. Check server logs.',
        code:  'INTERNAL_ERROR',
        ts:    Date.now(),
      });
    }
  }
);

// =============================================================================
// GET /runs/user/:userId — All runs for a specific user
// =============================================================================

runsRouter.get(
  '/user/:userId',
  requireApiKey,
  (req: Request, res: Response): void => {
    const store  = getRunStore();
    const userId = req.params['userId'];

    if (!userId || userId.trim() === '') {
      res.status(400).json({ ok: false, error: 'userId is required.', code: 'BAD_REQUEST', ts: Date.now() });
      return;
    }

    const runs = store.getByUserId(userId);

    const mapped: GetRunResponse[] = runs.map(r => ({
      runId:            r.id,
      userId:           r.userId,
      proofHash:        r.proofHash,
      auditHash:        r.auditHash,
      grade:            r.grade as RunGrade,
      outcome:          r.outcome as RunOutcome,
      sovereigntyScore: r.score,
      integrityStatus:  r.integrityStatus,
      finalNetWorth:    r.finalNetWorth,
      ticksSurvived:    r.ticksSurvived,
      completedAt:      r.completedAt,
      seed:             r.seed,
      mode:             (r as unknown as Record<string, unknown>)['mode'] as string ?? 'GO_ALONE',
      clientVersion:    r.clientVersion,
      engineVersion:    r.engineVersion,
    }));

    const response: UserRunsResponse = {
      userId,
      runs:  mapped,
      total: mapped.length,
    };

    res.json({ ok: true, data: response, ts: Date.now() });
  }
);

// =============================================================================
// GET /runs/:id — Fetch single run (public)
// =============================================================================

runsRouter.get(
  '/:id',
  async (req: Request, res: Response): Promise<void> => {
    const store = getRunStore();
    const id    = req.params['id'];

    if (!id) {
      res.status(400).json({ ok: false, error: 'Run ID is required.', code: 'BAD_REQUEST', ts: Date.now() });
      return;
    }

    // Check memory first; fall back to server for cold hydration
    let run = store.getById(id);
    if (!run) {
      run = await store.getByIdFromServer(id) ?? undefined;
    }

    if (!run) {
      res.status(404).json({ ok: false, error: `Run ${id} not found.`, code: 'NOT_FOUND', ts: Date.now() });
      return;
    }

    const response: GetRunResponse = {
      runId:            run.id,
      userId:           run.userId,
      proofHash:        run.proofHash,
      auditHash:        run.auditHash,
      grade:            run.grade as RunGrade,
      outcome:          run.outcome as RunOutcome,
      sovereigntyScore: run.score,
      integrityStatus:  run.integrityStatus,
      finalNetWorth:    run.finalNetWorth,
      ticksSurvived:    run.ticksSurvived,
      completedAt:      run.completedAt,
      seed:             run.seed,
      mode:             (run as unknown as Record<string, unknown>)['mode'] as string ?? 'GO_ALONE',
      clientVersion:    run.clientVersion,
      engineVersion:    run.engineVersion,
    };

    res.json({ ok: true, data: response, ts: Date.now() });
  }
);

// =============================================================================
// GET /leaderboard — Ranked leaderboard (public)
// =============================================================================

runsRouter.get(
  '/leaderboard',
  validateLeaderboardQuery,
  (req: Request, res: Response): void => {
    const store = getRunStore();
    const query = req.query as LeaderboardQuery;

    const limit    = Math.min(parseInt(query.limit ?? '10', 10), 100);
    const outcome  = query.outcome  as RunOutcome  | undefined;
    const minGrade = query.minGrade as RunGrade    | undefined;
    const userId   = query.userId;

    const runs = store.getLeaderboard({ limit, outcome, minGrade, userId });

    const entries: LeaderboardEntry[] = runs.map((r, i) => ({
      rank:             i + 1,
      runId:            r.id,
      userId:           r.userId,
      grade:            r.grade as RunGrade,
      outcome:          r.outcome as RunOutcome,
      sovereigntyScore: r.score,
      integrityStatus:  r.integrityStatus,
      finalNetWorth:    r.finalNetWorth,
      ticksSurvived:    r.ticksSurvived,
      completedAt:      r.completedAt,
      proofHash:        r.proofHash,
    }));

    const response: LeaderboardResponse = {
      entries,
      total:   entries.length,
      limit,
      filters: { outcome, minGrade, userId, mode: query.mode },
    };

    res.json({ ok: true, data: response, ts: Date.now() });
  }
);