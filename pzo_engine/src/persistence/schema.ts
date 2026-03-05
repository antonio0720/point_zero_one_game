// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — ENGINE PERSISTENCE LAYER
// pzo_engine/src/persistence/schema.ts
//
// Canonical SQLite schema definition + migration runner.
//
// SCHEMA OVERVIEW:
//   runs              — completed run records (one row per run)
//   run_tick_stream   — tick snapshots (one row per tick per run)
//   run_decisions     — forced card decisions (one row per decision per run)
//   run_viral_moments — viral moments fired per run
//   run_cord_scores   — CORD score records per run
//   run_mode_stats    — JSON blob of mode-specific stats per run
//   season_snapshots  — season state snapshot at each run end per user
//   leaderboard_cache — pre-computed leaderboard rows (refreshed on each save)
//   run_events        — generic run event ledger (used by RunEvents)
//   ml_models         — ML model weights by (ml_id, tier, ruleset_version)
//   ml_observations   — stored feature vectors + outputs (for audit + learning)
//   ml_feedback       — queued/applied labels for online learning
//   migrations        — applied migration tracking
//
// WAL MODE: Enabled at connection time. Never change to DELETE mode —
//           concurrent reads during write would block the tick loop.
//
// Density6 LLC · Point Zero One · Persistence Layer · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import type { Database } from 'better-sqlite3';

// =============================================================================
// MIGRATION REGISTRY
// Each migration: { id: string, sql: string }
// Applied once, tracked in `migrations` table.
// Order is fixed — never re-order or remove applied migrations.
// =============================================================================

const MIGRATIONS: Array<{ id: string; sql: string }> = [

  // ── M001: Foundation schema ──────────────────────────────────────────────
  {
    id: 'M001_foundation',
    sql: `
      CREATE TABLE IF NOT EXISTS migrations (
        id          TEXT PRIMARY KEY,
        applied_at  INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
      );

      CREATE TABLE IF NOT EXISTS runs (
        id                      TEXT    PRIMARY KEY,
        user_id                 TEXT    NOT NULL,
        mode                    TEXT    NOT NULL,
        seed                    TEXT    NOT NULL,
        ruleset_version         TEXT    NOT NULL DEFAULT '2024.12.1',
        is_demo_run             INTEGER NOT NULL DEFAULT 0,
        outcome                 TEXT    NOT NULL,
        grade                   TEXT    NOT NULL,
        integrity_status        TEXT    NOT NULL DEFAULT 'UNVERIFIED',
        proof_hash              TEXT    NOT NULL,
        audit_hash              TEXT    NOT NULL DEFAULT 'SKIPPED',
        score                   REAL    NOT NULL DEFAULT 0.0,
        raw_score               REAL    NOT NULL DEFAULT 0.0,
        outcome_multiplier      REAL    NOT NULL DEFAULT 0.0,
        final_net_worth         REAL    NOT NULL DEFAULT 0.0,
        ticks_survived          INTEGER NOT NULL DEFAULT 0,
        season_tick_budget      INTEGER NOT NULL DEFAULT 720,
        total_hater_attempts    INTEGER NOT NULL DEFAULT 0,
        hater_sabotages_blocked INTEGER NOT NULL DEFAULT 0,
        hater_sabotages_count   INTEGER NOT NULL DEFAULT 0,
        max_hater_heat          INTEGER NOT NULL DEFAULT 0,
        total_cascade_chains    INTEGER NOT NULL DEFAULT 0,
        cascade_chains_break    INTEGER NOT NULL DEFAULT 0,
        final_market_regime     TEXT    NOT NULL DEFAULT 'Stable',
        client_version          TEXT    NOT NULL DEFAULT '',
        engine_version          TEXT    NOT NULL DEFAULT '',
        xp_awarded              INTEGER NOT NULL DEFAULT 0,
        badge_tier_earned       TEXT    NOT NULL DEFAULT 'IRON',
        can_export_proof        INTEGER NOT NULL DEFAULT 0,
        started_at              INTEGER NOT NULL,
        completed_at            INTEGER NOT NULL,
        duration_ms             INTEGER NOT NULL DEFAULT 0,
        saved_at                INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
        -- JSON blobs for complex sub-objects
        score_components_json    TEXT   NOT NULL DEFAULT '{}',
        reward_json              TEXT   NOT NULL DEFAULT '{}',
        cosmetics_unlocked_json  TEXT   NOT NULL DEFAULT '[]',
        season_snapshot_json     TEXT   NOT NULL DEFAULT '{}',
        intelligence_json        TEXT   NOT NULL DEFAULT '{}',
        final_shield_layers_json TEXT   NOT NULL DEFAULT '[]'
      );

      CREATE INDEX IF NOT EXISTS idx_runs_user_id     ON runs(user_id);
      CREATE INDEX IF NOT EXISTS idx_runs_mode        ON runs(mode);
      CREATE INDEX IF NOT EXISTS idx_runs_outcome     ON runs(outcome);
      CREATE INDEX IF NOT EXISTS idx_runs_grade       ON runs(grade);
      CREATE INDEX IF NOT EXISTS idx_runs_score       ON runs(score DESC);
      CREATE INDEX IF NOT EXISTS idx_runs_completed   ON runs(completed_at DESC);
      CREATE INDEX IF NOT EXISTS idx_runs_demo        ON runs(is_demo_run);
      CREATE INDEX IF NOT EXISTS idx_runs_integrity   ON runs(integrity_status);
    `,
  },

  // ── M002: Tick stream table ──────────────────────────────────────────────
  {
    id: 'M002_tick_stream',
    sql: `
      CREATE TABLE IF NOT EXISTS run_tick_stream (
        run_id                TEXT    NOT NULL,
        tick_index            INTEGER NOT NULL,
        tick_hash             TEXT    NOT NULL,
        pressure_score        REAL    NOT NULL DEFAULT 0.0,
        shield_avg_integrity  REAL    NOT NULL DEFAULT 100.0,
        net_worth             REAL    NOT NULL DEFAULT 0.0,
        hater_heat            REAL    NOT NULL DEFAULT 0.0,
        cascade_chains_active INTEGER NOT NULL DEFAULT 0,
        tension_score         REAL    NOT NULL DEFAULT 0.0,
        tick_tier             TEXT    NOT NULL DEFAULT 'T1',
        PRIMARY KEY (run_id, tick_index),
        FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_ticks_run_id ON run_tick_stream(run_id);
    `,
  },

  // ── M003: Decision records ────────────────────────────────────────────────
  {
    id: 'M003_decisions',
    sql: `
      CREATE TABLE IF NOT EXISTS run_decisions (
        id                 INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id             TEXT    NOT NULL,
        tick_index         INTEGER NOT NULL DEFAULT 0,
        card_id            TEXT    NOT NULL,
        decision_window_ms INTEGER NOT NULL,
        resolved_in_ms     INTEGER NOT NULL,
        was_auto_resolved  INTEGER NOT NULL DEFAULT 0,
        was_optimal_choice INTEGER NOT NULL DEFAULT 0,
        speed_score        REAL    NOT NULL DEFAULT 0.0,
        FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_decisions_run_id ON run_decisions(run_id);
    `,
  },

  // ── M004: Viral moments ──────────────────────────────────────────────────
  {
    id: 'M004_viral_moments',
    sql: `
      CREATE TABLE IF NOT EXISTS run_viral_moments (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id      TEXT    NOT NULL,
        moment_type TEXT    NOT NULL,
        tick        INTEGER NOT NULL,
        headline    TEXT    NOT NULL DEFAULT '',
        cord_bonus  REAL    NOT NULL DEFAULT 0.0,
        FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_moments_run_id ON run_viral_moments(run_id);
    `,
  },

  // ── M005: CORD scores ────────────────────────────────────────────────────
  {
    id: 'M005_cord_scores',
    sql: `
      CREATE TABLE IF NOT EXISTS run_cord_scores (
        run_id            TEXT PRIMARY KEY,
        user_id           TEXT    NOT NULL,
        mode              TEXT    NOT NULL,
        is_demo_run       INTEGER NOT NULL DEFAULT 0,
        raw_cord          REAL    NOT NULL DEFAULT 0.0,
        mode_multiplier   REAL    NOT NULL DEFAULT 1.0,
        final_cord        REAL    NOT NULL DEFAULT 0.0,
        cord_grade        TEXT    NOT NULL DEFAULT 'F',
        viral_bonus_total REAL    NOT NULL DEFAULT 0.0,
        computed_at       INTEGER NOT NULL,
        FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_cord_user_id ON run_cord_scores(user_id);
      CREATE INDEX IF NOT EXISTS idx_cord_final   ON run_cord_scores(final_cord DESC);
      CREATE INDEX IF NOT EXISTS idx_cord_mode    ON run_cord_scores(mode);
      CREATE INDEX IF NOT EXISTS idx_cord_demo    ON run_cord_scores(is_demo_run);
    `,
  },

  // ── M006: Mode-specific stats ────────────────────────────────────────────
  {
    id: 'M006_mode_stats',
    sql: `
      CREATE TABLE IF NOT EXISTS run_mode_stats (
        run_id     TEXT PRIMARY KEY,
        mode       TEXT NOT NULL,
        stats_json TEXT NOT NULL DEFAULT '{}',
        FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
      );
    `,
  },

  // ── M007: Season snapshots ───────────────────────────────────────────────
  {
    id: 'M007_season_snapshots',
    sql: `
      CREATE TABLE IF NOT EXISTS season_snapshots (
        id                   INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id               TEXT    NOT NULL,
        user_id              TEXT    NOT NULL,
        xp                   INTEGER NOT NULL DEFAULT 0,
        pass_tier            INTEGER NOT NULL DEFAULT 1,
        dominion_control     REAL    NOT NULL DEFAULT 0,
        win_streak           INTEGER NOT NULL DEFAULT 0,
        battle_pass_level    INTEGER NOT NULL DEFAULT 1,
        cord_accumulator     REAL    NOT NULL DEFAULT 0.0,
        legend_beat_count    INTEGER NOT NULL DEFAULT 0,
        bleed_run_count      INTEGER NOT NULL DEFAULT 0,
        total_runs_completed INTEGER NOT NULL DEFAULT 0,
        snapshot_at          INTEGER NOT NULL,
        FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_season_user_id ON season_snapshots(user_id);
      CREATE INDEX IF NOT EXISTS idx_season_run_id  ON season_snapshots(run_id);
    `,
  },

  // ── M008: Generic event ledger (RunEvents) ───────────────────────────────
  {
    id: 'M008_events',
    sql: `
      CREATE TABLE IF NOT EXISTS run_events (
        event_id        TEXT    PRIMARY KEY,
        event_type      TEXT    NOT NULL,
        run_id          TEXT    NOT NULL,
        run_seed        TEXT    NOT NULL DEFAULT '',
        ruleset_version TEXT    NOT NULL DEFAULT '',
        player_id       TEXT    NOT NULL DEFAULT '',
        turn_number     INTEGER NOT NULL DEFAULT 0,
        tick_index      INTEGER NOT NULL DEFAULT 0,
        output          REAL    NOT NULL DEFAULT 0.0,
        payload_json    TEXT    NOT NULL DEFAULT '{}',
        audit_hash      TEXT    NOT NULL DEFAULT '',
        created_at      INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
      );

      CREATE INDEX IF NOT EXISTS idx_events_run_id ON run_events(run_id);
      CREATE INDEX IF NOT EXISTS idx_events_player ON run_events(player_id);
      CREATE INDEX IF NOT EXISTS idx_events_type   ON run_events(event_type);
    `,
  },

  // ── M009: Leaderboard cache ──────────────────────────────────────────────
  {
    id: 'M009_leaderboard_cache',
    sql: `
      CREATE TABLE IF NOT EXISTS leaderboard_cache (
        run_id          TEXT    PRIMARY KEY,
        user_id         TEXT    NOT NULL,
        mode            TEXT    NOT NULL,
        outcome         TEXT    NOT NULL,
        grade           TEXT    NOT NULL,
        score           REAL    NOT NULL,
        cord_final      REAL    NOT NULL DEFAULT 0.0,
        ticks_survived  INTEGER NOT NULL,
        final_net_worth REAL    NOT NULL,
        completed_at    INTEGER NOT NULL,
        is_demo_run     INTEGER NOT NULL DEFAULT 0,
        integrity_ok    INTEGER NOT NULL DEFAULT 1
      );

      CREATE INDEX IF NOT EXISTS idx_lb_score   ON leaderboard_cache(score DESC);
      CREATE INDEX IF NOT EXISTS idx_lb_cord    ON leaderboard_cache(cord_final DESC);
      CREATE INDEX IF NOT EXISTS idx_lb_user_id ON leaderboard_cache(user_id);
      CREATE INDEX IF NOT EXISTS idx_lb_mode    ON leaderboard_cache(mode);
      CREATE INDEX IF NOT EXISTS idx_lb_demo    ON leaderboard_cache(is_demo_run);
    `,
  },

  // ── M010: ML storage (models + observations + feedback) ──────────────────
  {
    id: 'M010_ml_storage',
    sql: `
      CREATE TABLE IF NOT EXISTS ml_models (
        ml_id              TEXT    NOT NULL,
        tier               TEXT    NOT NULL,
        ruleset_version    TEXT    NOT NULL,
        model_version      TEXT    NOT NULL,
        feature_schema_hash TEXT   NOT NULL,
        weights_json       TEXT    NOT NULL DEFAULT '{}',
        step               INTEGER NOT NULL DEFAULT 0,
        created_at         INTEGER NOT NULL,
        updated_at         INTEGER NOT NULL,
        PRIMARY KEY (ml_id, tier, ruleset_version)
      );

      CREATE TABLE IF NOT EXISTS ml_observations (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        ml_id         TEXT    NOT NULL,
        tier          TEXT    NOT NULL,
        run_id        TEXT    NOT NULL,
        tick_index    INTEGER NOT NULL,
        features_json TEXT    NOT NULL DEFAULT '{}',
        output_json   TEXT    NOT NULL DEFAULT '{}',
        audit_hash    TEXT    NOT NULL DEFAULT '',
        created_at    INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_ml_obs_ml  ON ml_observations(ml_id, tier);
      CREATE INDEX IF NOT EXISTS idx_ml_obs_run ON ml_observations(run_id, tick_index);

      CREATE TABLE IF NOT EXISTS ml_feedback (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        ml_id       TEXT    NOT NULL,
        tier        TEXT    NOT NULL,
        run_id      TEXT    NOT NULL,
        tick_index  INTEGER NOT NULL,
        label       INTEGER NOT NULL CHECK (label IN (0,1)),
        source      TEXT    NOT NULL DEFAULT 'system',
        applied     INTEGER NOT NULL DEFAULT 0 CHECK (applied IN (0,1)),
        created_at  INTEGER NOT NULL,
        applied_at  INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_ml_fb_pending ON ml_feedback(ml_id, tier, applied, id);
    `,
  },
];

// =============================================================================
// MIGRATION RUNNER
// =============================================================================

export function applyMigrations(db: Database): void {
  // Ensure migrations table exists first (bootstrapping)
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id         TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
    );
  `);

  const applied = new Set<string>(
    (db.prepare('SELECT id FROM migrations').all() as { id: string }[]).map(r => r.id)
  );

  const insertMigration = db.prepare(
    'INSERT INTO migrations (id, applied_at) VALUES (?, ?)'
  );

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.id)) continue;

    db.transaction(() => {
      db.exec(migration.sql);
      insertMigration.run(migration.id, Date.now());
    })();

    console.info(`[PZO Schema] Applied migration: ${migration.id}`);
  }
}

// =============================================================================
// SCHEMA VERSION
// =============================================================================

export function getSchemaVersion(db: Database): string {
  try {
    const rows = db
      .prepare('SELECT id FROM migrations ORDER BY applied_at DESC LIMIT 1')
      .all() as { id: string }[];
    return rows[0]?.id ?? 'NONE';
  } catch {
    return 'NONE';
  }
}