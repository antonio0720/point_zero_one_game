// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — API MIDDLEWARE — VALIDATE
// pzo_engine/src/api/middleware/validate.ts
//
// Request body validation for POST /runs.
//
// Validates shape only — not deep game logic.
// Deep integrity verification is handled by RunStore.replayFromSeed().
//
// Density6 LLC · Point Zero One · API Layer · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import type { Request, Response, NextFunction } from 'express';
import type { SubmitRunRequest }                 from './types';

const VALID_OUTCOMES = new Set(['FREEDOM', 'TIMEOUT', 'BANKRUPT', 'ABANDONED']);
const VALID_GRADES   = new Set(['A', 'B', 'C', 'D', 'F']);
const VALID_STATUS   = new Set(['VERIFIED', 'TAMPERED', 'UNVERIFIED']);

/**
 * validateRunSubmission — guards POST /runs body.
 *
 * Checks:
 *   · accumulator is present with required fields
 *   · identity is present with required fields
 *   · outcome is a known enum value
 *   · grade is a known enum value
 *   · integrityStatus is a known enum value
 *   · numeric fields are actually numbers
 *   · tickSnapshots is an array
 *
 * Does NOT check:
 *   · Proof hash validity (done by ProofHash in RunStore)
 *   · Tick hash stream integrity (done by replayFromSeed)
 *   · Score computation correctness (done by SovereigntyEngine)
 */
export function validateRunSubmission(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const body = req.body as Partial<SubmitRunRequest>;

  const errors: string[] = [];

  // ── accumulator ──────────────────────────────────────────────────────────
  if (!body.accumulator || typeof body.accumulator !== 'object') {
    errors.push('accumulator is required and must be an object.');
  } else {
    const acc = body.accumulator;
    if (!acc.runId   || typeof acc.runId   !== 'string')  errors.push('accumulator.runId must be a non-empty string.');
    if (!acc.userId  || typeof acc.userId  !== 'string')  errors.push('accumulator.userId must be a non-empty string.');
    if (!acc.seed    || typeof acc.seed    !== 'string')  errors.push('accumulator.seed must be a non-empty string.');
    if (typeof acc.finalNetWorth  !== 'number')           errors.push('accumulator.finalNetWorth must be a number.');
    if (typeof acc.ticksSurvived  !== 'number')           errors.push('accumulator.ticksSurvived must be a number.');
    if (typeof acc.completedAt    !== 'number')           errors.push('accumulator.completedAt must be a number.');
    if (!VALID_OUTCOMES.has(acc.outcome as string))       errors.push(`accumulator.outcome must be one of: ${[...VALID_OUTCOMES].join(', ')}.`);
    if (!Array.isArray(acc.tickSnapshots))                errors.push('accumulator.tickSnapshots must be an array.');
    if (!Array.isArray(acc.decisionRecords))              errors.push('accumulator.decisionRecords must be an array.');
  }

  // ── identity ─────────────────────────────────────────────────────────────
  if (!body.identity || typeof body.identity !== 'object') {
    errors.push('identity is required and must be an object.');
  } else {
    const id = body.identity;
    if (!id.signature || typeof id.signature !== 'object') {
      errors.push('identity.signature is required.');
    } else {
      if (!VALID_STATUS.has(id.integrityStatus as string)) {
        errors.push(`identity.integrityStatus must be one of: ${[...VALID_STATUS].join(', ')}.`);
      }
    }
    if (!id.score || typeof id.score !== 'object') {
      errors.push('identity.score is required.');
    } else {
      if (!VALID_GRADES.has(id.score.grade as string)) {
        errors.push(`identity.score.grade must be one of: ${[...VALID_GRADES].join(', ')}.`);
      }
      if (typeof id.score.finalScore !== 'number') {
        errors.push('identity.score.finalScore must be a number.');
      }
    }
  }

  if (errors.length > 0) {
    res.status(400).json({
      ok:    false,
      error: errors.join(' '),
      code:  'BAD_REQUEST',
      ts:    Date.now(),
    });
    return;
  }

  next();
}

/**
 * validateLeaderboardQuery — guards GET /leaderboard query params.
 * Sanitizes and normalizes query string values.
 */
export function validateLeaderboardQuery(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const errors: string[] = [];
  const { limit, outcome, minGrade } = req.query as Record<string, string | undefined>;

  if (limit !== undefined) {
    const n = parseInt(limit, 10);
    if (isNaN(n) || n < 1 || n > 100) {
      errors.push('limit must be a number between 1 and 100.');
    }
  }
  if (outcome !== undefined && !VALID_OUTCOMES.has(outcome)) {
    errors.push(`outcome must be one of: ${[...VALID_OUTCOMES].join(', ')}.`);
  }
  if (minGrade !== undefined && !VALID_GRADES.has(minGrade)) {
    errors.push(`minGrade must be one of: ${[...VALID_GRADES].join(', ')}.`);
  }

  if (errors.length > 0) {
    res.status(400).json({
      ok:    false,
      error: errors.join(' '),
      code:  'BAD_REQUEST',
      ts:    Date.now(),
    });
    return;
  }

  next();
}