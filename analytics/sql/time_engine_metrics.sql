
BEGIN;

CREATE SCHEMA IF NOT EXISTS analytics;

CREATE TABLE IF NOT EXISTS analytics.time_engine_run_summaries (
  run_id TEXT PRIMARY KEY,
  ruleset_version TEXT,
  season_budget INTEGER NOT NULL DEFAULT 720,
  ticks_elapsed INTEGER NOT NULL DEFAULT 0,
  ticks_remaining INTEGER NOT NULL DEFAULT 0,
  avg_tick_duration_ms NUMERIC(12, 2) NOT NULL DEFAULT 0,
  final_tier TEXT NOT NULL DEFAULT 'UNKNOWN',

  tier_dwell_t0 INTEGER NOT NULL DEFAULT 0,
  tier_dwell_t1 INTEGER NOT NULL DEFAULT 0,
  tier_dwell_t2 INTEGER NOT NULL DEFAULT 0,
  tier_dwell_t3 INTEGER NOT NULL DEFAULT 0,
  tier_dwell_t4 INTEGER NOT NULL DEFAULT 0,

  tier_transition_count INTEGER NOT NULL DEFAULT 0,

  decisions_opened_total INTEGER NOT NULL DEFAULT 0,
  decisions_resolved_total INTEGER NOT NULL DEFAULT 0,
  decisions_expired_total INTEGER NOT NULL DEFAULT 0,
  decisions_auto_resolved_total INTEGER NOT NULL DEFAULT 0,
  holds_used_total INTEGER NOT NULL DEFAULT 0,

  avg_open_to_resolve_latency_ms NUMERIC(12, 2) NOT NULL DEFAULT 0,
  max_open_to_resolve_latency_ms NUMERIC(12, 2) NOT NULL DEFAULT 0,

  timeout_imminent BOOLEAN NOT NULL DEFAULT FALSE,
  timeout_occurred BOOLEAN NOT NULL DEFAULT FALSE,
  completion_reason TEXT,
  run_started_at TIMESTAMPTZ,
  run_completed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_time_engine_run_summaries_completed_at
  ON analytics.time_engine_run_summaries (run_completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_time_engine_run_summaries_final_tier
  ON analytics.time_engine_run_summaries (final_tier);

CREATE TABLE IF NOT EXISTS analytics.time_engine_tick_metrics (
  run_id TEXT NOT NULL REFERENCES analytics.time_engine_run_summaries(run_id) ON DELETE CASCADE,
  tick_index INTEGER NOT NULL,
  tick_tier TEXT NOT NULL,
  tick_duration_ms INTEGER NOT NULL,
  ticks_remaining INTEGER NOT NULL,
  season_budget INTEGER NOT NULL,
  pressure_score NUMERIC(8, 4),
  timeout_imminent BOOLEAN NOT NULL DEFAULT FALSE,

  tier_changed BOOLEAN NOT NULL DEFAULT FALSE,
  previous_tier TEXT,
  new_tier TEXT,

  emitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (run_id, tick_index)
);

CREATE INDEX IF NOT EXISTS idx_time_engine_tick_metrics_run_id_emitted_at
  ON analytics.time_engine_tick_metrics (run_id, emitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_time_engine_tick_metrics_tick_tier
  ON analytics.time_engine_tick_metrics (tick_tier);

CREATE OR REPLACE VIEW analytics.time_engine_latest_run_summary AS
SELECT
  s.run_id,
  s.ruleset_version,
  s.season_budget,
  s.ticks_elapsed,
  s.ticks_remaining,
  s.avg_tick_duration_ms,
  s.final_tier,
  s.tier_dwell_t0,
  s.tier_dwell_t1,
  s.tier_dwell_t2,
  s.tier_dwell_t3,
  s.tier_dwell_t4,
  s.tier_transition_count,
  s.decisions_opened_total,
  s.decisions_resolved_total,
  s.decisions_expired_total,
  s.decisions_auto_resolved_total,
  s.holds_used_total,
  s.avg_open_to_resolve_latency_ms,
  s.max_open_to_resolve_latency_ms,
  s.timeout_imminent,
  s.timeout_occurred,
  s.completion_reason,
  s.run_started_at,
  s.run_completed_at,
  s.created_at,
  s.updated_at
FROM analytics.time_engine_run_summaries s
ORDER BY s.run_completed_at DESC NULLS LAST, s.created_at DESC;

CREATE OR REPLACE VIEW analytics.time_engine_tier_distribution AS
SELECT
  run_id,
  season_budget,
  ticks_elapsed,
  final_tier,
  tier_dwell_t0,
  tier_dwell_t1,
  tier_dwell_t2,
  tier_dwell_t3,
  tier_dwell_t4,
  CASE WHEN ticks_elapsed > 0 THEN ROUND((tier_dwell_t0::NUMERIC / ticks_elapsed::NUMERIC) * 100, 2) ELSE 0 END AS pct_t0,
  CASE WHEN ticks_elapsed > 0 THEN ROUND((tier_dwell_t1::NUMERIC / ticks_elapsed::NUMERIC) * 100, 2) ELSE 0 END AS pct_t1,
  CASE WHEN ticks_elapsed > 0 THEN ROUND((tier_dwell_t2::NUMERIC / ticks_elapsed::NUMERIC) * 100, 2) ELSE 0 END AS pct_t2,
  CASE WHEN ticks_elapsed > 0 THEN ROUND((tier_dwell_t3::NUMERIC / ticks_elapsed::NUMERIC) * 100, 2) ELSE 0 END AS pct_t3,
  CASE WHEN ticks_elapsed > 0 THEN ROUND((tier_dwell_t4::NUMERIC / ticks_elapsed::NUMERIC) * 100, 2) ELSE 0 END AS pct_t4
FROM analytics.time_engine_run_summaries;

COMMIT;