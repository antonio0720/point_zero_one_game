// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — ENGINE PERSISTENCE LAYER
// pzo_engine/src/persistence/cord-store.ts
//
// NEW FILE — CORD score persistence and cross-mode leaderboard.
//
// CORD = Compounded Outcome Rank Differential
//   The prestige/legacy metric. Accumulates across runs.
//   Unlike sovereignty score (per-run), CORD compounds season-over-season.
//
// RESPONSIBILITIES:
//   · Provide per-user CORD leaderboard (top CORD scores)
//   · Provide per-mode CORD leaderboard (top CORD for each GameMode)
//   · Provide user CORD history (all runs sorted by final_cord DESC)
//   · Provide all-time CORD rankings with mode breakdowns
//   · Exclude demo runs from all real leaderboards
//
// NOTE: CORD scores are written by RunStore.save() into run_cord_scores.
//       CordStore only provides READ access — it never writes.
//
// Density6 LLC · Point Zero One · Persistence Layer · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import { getDb }       from './db';
import type { GameMode } from './types';

// =============================================================================
// INTERFACES
// =============================================================================

export interface CORDLeaderboardEntry {
  rank:            number;
  runId:           string;
  userId:          string;
  mode:            GameMode;
  finalCORD:       number;
  rawCORD:         number;
  modeMultiplier:  number;
  cordGrade:       string;
  viralBonusTotal: number;
  computedAt:      number;
}

export interface UserCORDSummary {
  userId:        string;
  bestCORD:      number;
  bestCORDRunId: string;
  totalRunsWithCORD: number;
  avgCORD:       number;
  cordByMode:    Record<GameMode, number | null>;
}

export interface CORDLeaderboardOptions {
  limit?:       number;
  mode?:        GameMode;
  userId?:      string;
  includeDemos?: boolean;
}

// =============================================================================
// CORD STORE
// =============================================================================

export class CordStore {

  // ── Global CORD leaderboard ───────────────────────────────────────────────

  /**
   * Top CORD scores globally (or filtered by mode/userId).
   * Excludes demo runs by default.
   * Sorted by final_cord DESC, with ties broken by computed_at ASC.
   */
  public getLeaderboard(options: CORDLeaderboardOptions = {}): CORDLeaderboardEntry[] {
    const { limit = 20, mode, userId, includeDemos = false } = options;

    const conditions: string[] = ['final_cord > 0'];
    const bindings:   unknown[] = [];

    if (!includeDemos)  { conditions.push('is_demo_run = 0'); }
    if (mode)           { conditions.push('mode = ?');    bindings.push(mode); }
    if (userId)         { conditions.push('user_id = ?'); bindings.push(userId); }

    bindings.push(limit);

    const rows = getDb().prepare(`
      SELECT
        ROW_NUMBER() OVER (ORDER BY final_cord DESC, computed_at ASC) as rank,
        run_id, user_id, mode,
        final_cord, raw_cord, mode_multiplier, cord_grade, viral_bonus_total, computed_at
      FROM run_cord_scores
      WHERE ${conditions.join(' AND ')}
      ORDER BY final_cord DESC, computed_at ASC
      LIMIT ?
    `).all(...bindings) as Record<string, unknown>[];

    return rows.map((r, i) => ({
      rank:            (r['rank'] as number) ?? (i + 1),
      runId:           r['run_id'] as string,
      userId:          r['user_id'] as string,
      mode:            r['mode'] as GameMode,
      finalCORD:       r['final_cord'] as number,
      rawCORD:         r['raw_cord'] as number,
      modeMultiplier:  r['mode_multiplier'] as number,
      cordGrade:       r['cord_grade'] as string,
      viralBonusTotal: r['viral_bonus_total'] as number,
      computedAt:      r['computed_at'] as number,
    }));
  }

  // ── Per-mode leaderboard ──────────────────────────────────────────────────

  /** Top CORD scores for each mode — returns map of mode → entries. */
  public getLeaderboardByMode(limit = 10): Record<GameMode, CORDLeaderboardEntry[]> {
    const modes: GameMode[] = ['GO_ALONE', 'HEAD_TO_HEAD', 'TEAM_UP', 'CHASE_A_LEGEND'];
    const result = {} as Record<GameMode, CORDLeaderboardEntry[]>;

    for (const mode of modes) {
      result[mode] = this.getLeaderboard({ mode, limit });
    }

    return result;
  }

  // ── User CORD summary ─────────────────────────────────────────────────────

  /**
   * Full CORD summary for a specific user.
   * Includes best CORD, average, and best by mode.
   */
  public getUserSummary(userId: string): UserCORDSummary | null {
    const db = getDb();

    const summaryRow = db.prepare(`
      SELECT
        COUNT(*) as run_count,
        MAX(final_cord) as best_cord,
        AVG(final_cord) as avg_cord
      FROM run_cord_scores
      WHERE user_id = ? AND is_demo_run = 0 AND final_cord > 0
    `).get(userId) as { run_count: number; best_cord: number; avg_cord: number } | undefined;

    if (!summaryRow || summaryRow.run_count === 0) return null;

    const bestRun = db.prepare(`
      SELECT run_id FROM run_cord_scores
      WHERE user_id = ? AND is_demo_run = 0
      ORDER BY final_cord DESC LIMIT 1
    `).get(userId) as { run_id: string } | undefined;

    // Best CORD per mode
    const modes: GameMode[] = ['GO_ALONE', 'HEAD_TO_HEAD', 'TEAM_UP', 'CHASE_A_LEGEND'];
    const cordByMode = {} as Record<GameMode, number | null>;

    for (const mode of modes) {
      const row = db.prepare(`
        SELECT MAX(final_cord) as best
        FROM run_cord_scores
        WHERE user_id = ? AND mode = ? AND is_demo_run = 0
      `).get(userId, mode) as { best: number | null } | undefined;
      cordByMode[mode] = row?.best ?? null;
    }

    return {
      userId,
      bestCORD:          summaryRow.best_cord,
      bestCORDRunId:     bestRun?.run_id ?? '',
      totalRunsWithCORD: summaryRow.run_count,
      avgCORD:           summaryRow.avg_cord,
      cordByMode,
    };
  }

  // ── User CORD history ─────────────────────────────────────────────────────

  /**
   * All CORD scores for a user, sorted by final_cord DESC.
   * Useful for showing improvement over time.
   */
  public getUserHistory(userId: string, limit = 50): CORDLeaderboardEntry[] {
    const rows = getDb().prepare(`
      SELECT
        ROW_NUMBER() OVER (ORDER BY final_cord DESC) as rank,
        run_id, user_id, mode,
        final_cord, raw_cord, mode_multiplier, cord_grade, viral_bonus_total, computed_at
      FROM run_cord_scores
      WHERE user_id = ? AND is_demo_run = 0
      ORDER BY computed_at DESC
      LIMIT ?
    `).all(userId, limit) as Record<string, unknown>[];

    return rows.map((r, i) => ({
      rank:            (r['rank'] as number) ?? (i + 1),
      runId:           r['run_id'] as string,
      userId:          r['user_id'] as string,
      mode:            r['mode'] as GameMode,
      finalCORD:       r['final_cord'] as number,
      rawCORD:         r['raw_cord'] as number,
      modeMultiplier:  r['mode_multiplier'] as number,
      cordGrade:       r['cord_grade'] as string,
      viralBonusTotal: r['viral_bonus_total'] as number,
      computedAt:      r['computed_at'] as number,
    }));
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let _cordStore: CordStore | null = null;

export function getCordStore(): CordStore {
  if (!_cordStore) _cordStore = new CordStore();
  return _cordStore;
}