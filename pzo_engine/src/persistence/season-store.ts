// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — ENGINE PERSISTENCE LAYER
// pzo_engine/src/persistence/season-store.ts
//
// NEW FILE — Season state persistence and progression tracking.
//
// RESPONSIBILITIES:
//   · Read season progression for a user across all stored snapshots
//   · Track XP growth, tier advancement, win streak progression
//   · Provide current season state (latest snapshot)
//   · Aggregate CORD accumulator over time
//
// Season snapshots are written by RunStore.save() → season_snapshots table.
// SeasonStore only provides READ access.
//
// Density6 LLC · Point Zero One · Persistence Layer · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import { getDb }       from './db';
import type { SeasonStateSnapshot } from './types';

// =============================================================================
// INTERFACES
// =============================================================================

export interface SeasonProgressEntry {
  runId:         string;
  snapshotAt:    number;
  xp:            number;
  passTier:      number;
  winStreak:     number;
  cordAccumulator: number;
  totalRunsCompleted: number;
}

export interface UserSeasonSummary {
  userId:           string;
  currentXP:        number;
  currentPassTier:  number;
  currentWinStreak: number;
  maxWinStreak:     number;
  totalRunsCompleted: number;
  cordAccumulator:  number;
  legendBeatCount:  number;
  bleedRunCount:    number;
  xpHistory:        SeasonProgressEntry[];
}

// =============================================================================
// SEASON STORE
// =============================================================================

export class SeasonStore {

  /**
   * Get the latest season snapshot for a user — their current progression state.
   */
  public getCurrentSnapshot(userId: string): SeasonStateSnapshot | null {
    const row = getDb().prepare(`
      SELECT * FROM season_snapshots
      WHERE user_id = ?
      ORDER BY snapshot_at DESC
      LIMIT 1
    `).get(userId) as Record<string, unknown> | undefined;

    if (!row) return null;
    return this.rowToSnapshot(row);
  }

  /**
   * Full season progression history for a user.
   * Returns entries from every run snapshot, sorted chronologically.
   */
  public getProgressHistory(userId: string, limit = 100): SeasonProgressEntry[] {
    const rows = getDb().prepare(`
      SELECT run_id, snapshot_at, xp, pass_tier, win_streak, cord_accumulator, total_runs_completed
      FROM season_snapshots
      WHERE user_id = ?
      ORDER BY snapshot_at ASC
      LIMIT ?
    `).all(userId, limit) as Record<string, unknown>[];

    return rows.map(r => ({
      runId:              r['run_id'] as string,
      snapshotAt:         r['snapshot_at'] as number,
      xp:                 r['xp'] as number,
      passTier:           r['pass_tier'] as number,
      winStreak:          r['win_streak'] as number,
      cordAccumulator:    r['cord_accumulator'] as number,
      totalRunsCompleted: r['total_runs_completed'] as number,
    }));
  }

  /**
   * Aggregate season summary for a user.
   * Derives current state from latest snapshot and max values from history.
   */
  public getUserSummary(userId: string): UserSeasonSummary | null {
    const db = getDb();

    const latest = this.getCurrentSnapshot(userId);
    if (!latest) return null;

    const maxStreak = db.prepare(`
      SELECT MAX(win_streak) as max_streak FROM season_snapshots WHERE user_id = ?
    `).get(userId) as { max_streak: number } | undefined;

    const history = this.getProgressHistory(userId, 200);

    return {
      userId,
      currentXP:           latest.xp,
      currentPassTier:     latest.passTier,
      currentWinStreak:    latest.winStreak,
      maxWinStreak:        maxStreak?.max_streak ?? latest.winStreak,
      totalRunsCompleted:  latest.totalRunsCompleted,
      cordAccumulator:     latest.cordAccumulator,
      legendBeatCount:     latest.legendBeatCount,
      bleedRunCount:       latest.bleedRunCount,
      xpHistory:           history,
    };
  }

  /**
   * Get the top users by total XP earned — season leaderboard.
   */
  public getXPLeaderboard(limit = 20): Array<{ userId: string; xp: number; passTier: number }> {
    const rows = getDb().prepare(`
      SELECT user_id, xp, pass_tier
      FROM season_snapshots
      WHERE snapshot_at = (
        SELECT MAX(snapshot_at) FROM season_snapshots s2 WHERE s2.user_id = season_snapshots.user_id
      )
      ORDER BY xp DESC
      LIMIT ?
    `).all(limit) as { user_id: string; xp: number; pass_tier: number }[];

    return rows.map(r => ({
      userId:   r['user_id'],
      xp:       r['xp'],
      passTier: r['pass_tier'],
    }));
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private rowToSnapshot(row: Record<string, unknown>): SeasonStateSnapshot {
    return {
      xp:                 row['xp'] as number,
      passTier:           row['pass_tier'] as number,
      dominionControl:    row['dominion_control'] as number,
      winStreak:          row['win_streak'] as number,
      battlePassLevel:    row['battle_pass_level'] as number,
      cordAccumulator:    row['cord_accumulator'] as number,
      legendBeatCount:    row['legend_beat_count'] as number,
      bleedRunCount:      row['bleed_run_count'] as number,
      totalRunsCompleted: row['total_runs_completed'] as number,
    };
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let _seasonStore: SeasonStore | null = null;

export function getSeasonStore(): SeasonStore {
  if (!_seasonStore) _seasonStore = new SeasonStore();
  return _seasonStore;
}