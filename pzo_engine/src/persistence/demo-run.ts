// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — ENGINE PERSISTENCE LAYER
// pzo_engine/src/persistence/demo-run.ts
//
// NEW FILE — Demo run persistence adapter.
//
// WHAT IS A DEMO RUN?
//   A demo run is a curated or AI-simulated run used to teach new players
//   how to play. It flows through the same engine stack as a live run but:
//     ✦ isDemoRun = true in RunAccumulatorStats
//     ✦ Proof hash prefixed 'DEMO:' — permanently excluded from live proofs
//     ✦ Excluded from sovereignty/CORD leaderboards by default
//     ✦ Included in TUTORIAL leaderboard (for "best demo run" displays)
//     ✦ Tick stream is still saved and fully replayable
//     ✦ Used by DemoOrchestrator.ts in src/demo/ for tutorial playback
//
// DEMO RUN SOURCES:
//   1. DemoAI — AI-controlled player demonstrating optimal/suboptimal play
//   2. Curated seeds — hand-crafted runs that demonstrate specific mechanics
//   3. New player runs — first 3 runs of any new account (optional config)
//
// TUTORIAL REPLAY:
//   DemoReplayReader provides the tick stream for DemoOrchestrator's
//   frame-by-frame tutorial playback. Returns ticks in order with metadata.
//
// Density6 LLC · Point Zero One · Persistence Layer · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import { getDb }        from './db';
import { getRunStore }  from './run-store';
import type {
  RunAccumulatorStats,
  RunIdentity,
  GameMode,
} from './types';
import type { Run }     from './run';

// =============================================================================
// DEMO ACCUMULATOR FACTORY
// =============================================================================

/**
 * Build a RunAccumulatorStats with isDemoRun=true preset.
 * Used by DemoOrchestrator to construct the accumulator before passing to
 * SovereigntyEngine.initRun().
 */
export function createDemoAccumulator(params: {
  runId:            string;
  userId:           string;           // 'DEMO_AI' or actual new user ID
  seed:             string;
  mode:             GameMode;
  rulesetVersion:   string;
  seasonTickBudget: number;
  clientVersion:    string;
  engineVersion:    string;
}): Partial<RunAccumulatorStats> {
  return {
    runId:            params.runId,
    userId:           params.userId,
    seed:             params.seed,
    rulesetVersion:   params.rulesetVersion,
    mode:             params.mode,
    isDemoRun:        true,  // ← THE KEY FLAG
    startedAt:        Date.now(),
    completedAt:      0,
    outcome:          'ABANDONED',   // overwritten at completeRun()
    finalNetWorth:    0,
    seasonTickBudget: params.seasonTickBudget,
    ticksSurvived:    0,
    clientVersion:    params.clientVersion,
    engineVersion:    params.engineVersion,
    shieldIntegralSum:     0,
    shieldSampleCount:     0,
    finalShieldLayers:     [],
    totalHaterAttempts:    0,
    haterSabotagesBlocked: 0,
    haterSabotagesCount:   0,
    maxHaterHeat:          0,
    totalCascadeChains:    0,
    cascadeChainsBreak:    0,
    cordScore:             null,
    finalMarketRegime:     'Stable',
    seasonSnapshot: {
      xp: 0, passTier: 1, dominionControl: 0, winStreak: 0,
      battlePassLevel: 1, cordAccumulator: 0, legendBeatCount: 0,
      bleedRunCount: 0, totalRunsCompleted: 0,
    },
    intelligenceSnapshot: {
      alpha: 0.45, risk: 0.35, volatility: 0.30, momentum: 0.33,
      biasScore: 0.15, convergenceSignal: 0.50, sessionMomentum: 0.40, churnRisk: 0.28,
    },
    viralMoments:   [],
    modeStats:      {},
    decisionRecords: [],
    tickSnapshots:   [],
  };
}

// =============================================================================
// DEMO RUN PERSISTENCE ADAPTER
// Wraps RunStore.save() with demo-specific logging and tutorial indexing.
// =============================================================================

export class DemoRunAdapter {
  private readonly runStore = getRunStore();

  /**
   * Save a completed demo run.
   * Delegates to RunStore.save() — demo flag is on the accumulator.
   * Adds tutorial index entry after save for DemoOrchestrator lookup.
   */
  public async saveDemoRun(params: {
    accumulator: RunAccumulatorStats;
    identity:    RunIdentity;
    /** Optional label for this demo (e.g., 'EMPIRE_OPTIMAL', 'BEGINNER_BANKRUPT') */
    demoLabel?:  string;
    /** Whether this demo should be shown to new players automatically */
    isFeatured?: boolean;
  }): Promise<Run> {
    if (!params.accumulator.isDemoRun) {
      throw new Error('[DemoRunAdapter] saveDemoRun called with isDemoRun=false. Set isDemoRun=true on accumulator.');
    }

    const run = await this.runStore.save({
      accumulator: params.accumulator,
      identity:    params.identity,
    });

    // Write tutorial index entry
    this.writeTutorialIndex({
      runId:      run.id,
      mode:       run.mode,
      outcome:    run.outcome,
      demoLabel:  params.demoLabel ?? 'UNLABELED',
      isFeatured: params.isFeatured ?? false,
      savedAt:    run.savedAt,
    });

    return run;
  }

  /**
   * Get all featured demo runs for a given mode.
   * Used by DemoOrchestrator to select which run to replay for a new player.
   */
  public getFeaturedDemos(mode?: GameMode): DemoIndexEntry[] {
    const db = getDb();

    const conditions = ['is_featured = 1'];
    const bindings: unknown[] = [];
    if (mode) { conditions.push('mode = ?'); bindings.push(mode); }

    return (db.prepare(`
      SELECT run_id, mode, outcome, demo_label, is_featured, saved_at
      FROM demo_tutorial_index
      WHERE ${conditions.join(' AND ')}
      ORDER BY saved_at DESC
    `).all(...bindings) as Record<string, unknown>[]).map(r => ({
      runId:      r['run_id'] as string,
      mode:       r['mode'] as GameMode,
      outcome:    r['outcome'] as string,
      demoLabel:  r['demo_label'] as string,
      isFeatured: Boolean(r['is_featured']),
      savedAt:    r['saved_at'] as number,
    }));
  }

  private writeTutorialIndex(entry: {
    runId: string; mode: GameMode; outcome: string;
    demoLabel: string; isFeatured: boolean; savedAt: number;
  }): void {
    const db = getDb();

    // Create table if first use (lazy migration — not in main schema to avoid coupling)
    db.exec(`
      CREATE TABLE IF NOT EXISTS demo_tutorial_index (
        run_id      TEXT    PRIMARY KEY,
        mode        TEXT    NOT NULL,
        outcome     TEXT    NOT NULL,
        demo_label  TEXT    NOT NULL DEFAULT '',
        is_featured INTEGER NOT NULL DEFAULT 0,
        saved_at    INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_demo_mode     ON demo_tutorial_index(mode);
      CREATE INDEX IF NOT EXISTS idx_demo_featured ON demo_tutorial_index(is_featured);
    `);

    db.prepare(`
      INSERT OR REPLACE INTO demo_tutorial_index (run_id, mode, outcome, demo_label, is_featured, saved_at)
      VALUES (?,?,?,?,?,?)
    `).run(entry.runId, entry.mode, entry.outcome, entry.demoLabel, entry.isFeatured ? 1 : 0, entry.savedAt);
  }
}

// =============================================================================
// DEMO REPLAY READER
// Feeds DemoOrchestrator.ts the tick stream for frame-by-frame playback.
// =============================================================================

export interface DemoIndexEntry {
  runId:      string;
  mode:       GameMode;
  outcome:    string;
  demoLabel:  string;
  isFeatured: boolean;
  savedAt:    number;
}

export interface DemoTickFrame {
  tickIndex:           number;
  tickHash:            string;
  pressureScore:       number;
  shieldAvgIntegrity:  number;
  netWorth:            number;
  haterHeat:           number;
  cascadeChainsActive: number;
  tensionScore:        number;
  tickTier:            string;
}

export class DemoReplayReader {
  /**
   * Load the full ordered tick stream for a demo run.
   * Used by DemoOrchestrator to drive frame-by-frame tutorial playback.
   */
  public loadTickStream(runId: string): DemoTickFrame[] {
    const rows = getDb().prepare(`
      SELECT
        tick_index, tick_hash, pressure_score, shield_avg_integrity,
        net_worth, hater_heat, cascade_chains_active, tension_score, tick_tier
      FROM run_tick_stream
      WHERE run_id = ?
      ORDER BY tick_index ASC
    `).all(runId) as Record<string, unknown>[];

    return rows.map(r => ({
      tickIndex:           r['tick_index'] as number,
      tickHash:            r['tick_hash'] as string,
      pressureScore:       r['pressure_score'] as number,
      shieldAvgIntegrity:  r['shield_avg_integrity'] as number,
      netWorth:            r['net_worth'] as number,
      haterHeat:           r['hater_heat'] as number,
      cascadeChainsActive: r['cascade_chains_active'] as number,
      tensionScore:        r['tension_score'] as number,
      tickTier:            r['tick_tier'] as string,
    }));
  }

  /**
   * Count total frames in a demo run's tick stream.
   * Used to build the DemoOrchestrator progress bar.
   */
  public getFrameCount(runId: string): number {
    const row = getDb()
      .prepare('SELECT COUNT(*) as cnt FROM run_tick_stream WHERE run_id = ?')
      .get(runId) as { cnt: number } | undefined;
    return row?.cnt ?? 0;
  }
}

// =============================================================================
// SINGLETONS
// =============================================================================

let _demoAdapter: DemoRunAdapter | null = null;
let _demoReader:  DemoReplayReader | null = null;

export function getDemoRunAdapter(): DemoRunAdapter {
  if (!_demoAdapter) _demoAdapter = new DemoRunAdapter();
  return _demoAdapter;
}

export function getDemoReplayReader(): DemoReplayReader {
  if (!_demoReader) _demoReader = new DemoReplayReader();
  return _demoReader;
}