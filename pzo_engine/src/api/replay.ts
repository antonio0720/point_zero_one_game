// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — API ROUTES — REPLAY
// pzo_engine/src/api/routes/replay.ts
//
// Routes:
//   GET /runs/:id/replay   → Replay integrity verification (public)
//   GET /runs/:id/proof    → Proof artifact retrieval (public)
//
// Replay verification is intentionally public — anyone should be able to
// independently verify that a run's tick stream was not tampered with.
// This is a core trust feature of Sovereign Simulation Games™.
//
// Density6 LLC · Point Zero One · API Layer · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import { Router, Request, Response } from 'express';
import { getRunStore }                from '../persistence/run-store';
import type {
  ReplayVerificationResponse,
  ProofArtifactResponse,
} from './types';

export const replayRouter = Router({ mergeParams: true });

// =============================================================================
// GET /runs/:id/replay — Deterministic replay integrity check
// =============================================================================

replayRouter.get(
  '/replay',
  (req: Request, res: Response): void => {
    const store = getRunStore();
    const id    = req.params['id'];

    if (!id) {
      res.status(400).json({ ok: false, error: 'Run ID is required.', code: 'BAD_REQUEST', ts: Date.now() });
      return;
    }

    const run = store.getById(id);
    if (!run) {
      res.status(404).json({
        ok:    false,
        error: `Run ${id} not found in memory. Run may need to be submitted first.`,
        code:  'NOT_FOUND',
        ts:    Date.now(),
      });
      return;
    }

    // Reject replay of TAMPERED runs — they're already flagged
    if (run.integrityStatus === 'TAMPERED') {
      res.status(409).json({
        ok:    false,
        error: `Run ${id} is already flagged as TAMPERED. Replay would be meaningless.`,
        code:  'INTEGRITY_VIOLATION',
        ts:    Date.now(),
      });
      return;
    }

    const result = store.replayFromSeed(id);

    if (!result) {
      res.status(500).json({
        ok:    false,
        error: 'Replay verification failed unexpectedly. Run may be corrupted.',
        code:  'INTERNAL_ERROR',
        ts:    Date.now(),
      });
      return;
    }

    const response: ReplayVerificationResponse = {
      runId:             result.runId,
      seed:              result.seed,
      tickCount:         result.tickCount,
      integrityMatch:    result.integrityMatch,
      firstDivergenceAt: result.firstDivergenceAt,
      replayedProofHash: result.replayedProofHash,
      storedProofHash:   result.storedProofHash,
      proofHashMatch:    result.proofHashMatch,
      verifiedAt:        Date.now(),
    };

    res.json({ ok: true, data: response, ts: Date.now() });
  }
);

// =============================================================================
// GET /runs/:id/proof — Proof artifact retrieval
// =============================================================================

replayRouter.get(
  '/proof',
  (req: Request, res: Response): void => {
    const store = getRunStore();
    const id    = req.params['id'];

    if (!id) {
      res.status(400).json({ ok: false, error: 'Run ID is required.', code: 'BAD_REQUEST', ts: Date.now() });
      return;
    }

    const run = store.getById(id);
    if (!run) {
      res.status(404).json({ ok: false, error: `Run ${id} not found.`, code: 'NOT_FOUND', ts: Date.now() });
      return;
    }

    // Block proof export for tampered runs
    if (run.integrityStatus === 'TAMPERED') {
      res.status(403).json({
        ok:    false,
        error: 'Proof artifacts cannot be exported for TAMPERED runs.',
        code:  'INTEGRITY_VIOLATION',
        ts:    Date.now(),
      });
      return;
    }

    // Derive badge tier from grade
    const GRADE_TO_BADGE: Record<string, string> = {
      A: 'PLATINUM',
      B: 'GOLD',
      C: 'SILVER',
      D: 'BRONZE',
      F: 'IRON',
    };

    const response: ProofArtifactResponse = {
      runId:            run.id,
      proofHash:        run.proofHash,
      grade:            run.grade as 'A' | 'B' | 'C' | 'D' | 'F',
      sovereigntyScore: run.score,
      badgeTier:        GRADE_TO_BADGE[run.grade] ?? 'IRON',
      playerHandle:     run.userId,
      outcome:          run.outcome as 'FREEDOM' | 'TIMEOUT' | 'BANKRUPT' | 'ABANDONED',
      ticksSurvived:    run.ticksSurvived,
      finalNetWorth:    run.finalNetWorth,
      generatedAt:      Date.now(),
      format:           'PDF',
      exportUrl:        undefined,  // Populated when SovereigntyExporter generates artifact
    };

    res.json({ ok: true, data: response, ts: Date.now() });
  }
);