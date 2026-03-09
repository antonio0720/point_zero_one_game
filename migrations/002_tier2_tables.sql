-- Point Zero One — Tier 2 Postgres Schema Migration
-- Covers: loss_is_content, liveops, pivotal_turns, notifications,
-- after_action/autopsy, proof_stamps (variants), host_os, telemetry, run_explorer
--
-- Run AFTER 001_tier1_tables.sql:
--   psql $DATABASE_URL -f migrations/002_tier2_tables.sql

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════
-- LOSS IS CONTENT
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS autopsy_snippets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id      VARCHAR(64)  NOT NULL,
  snippet     TEXT         NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_autopsy_snippets_run ON autopsy_snippets (run_id);

CREATE TABLE IF NOT EXISTS causes_of_death (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255) NOT NULL UNIQUE,
  description TEXT         NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS eligibility_locks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id       VARCHAR(64)  NOT NULL,
  user_id       VARCHAR(64)  NOT NULL,
  practice_mode BOOLEAN      NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (game_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_eligibility_locks_user ON eligibility_locks (user_id);

CREATE TABLE IF NOT EXISTS training_scenarios (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             VARCHAR(255) NOT NULL,
  stage            VARCHAR(64)  NOT NULL,
  short_launchable BOOLEAN      NOT NULL DEFAULT true,
  description      TEXT         NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_training_scenarios_stage ON training_scenarios (stage, short_launchable);

-- ═══════════════════════════════════════════════════════════════════════
-- LIVEOPS
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS liveops_alerts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id       VARCHAR(64)  NOT NULL,
  severity      SMALLINT     NOT NULL DEFAULT 1,
  alert_type    VARCHAR(64)  NOT NULL DEFAULT 'health',
  message       TEXT         NOT NULL DEFAULT '',
  data          JSONB        NOT NULL DEFAULT '{}'::jsonb,
  runbook_link  VARCHAR(512) NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_liveops_alerts_game ON liveops_alerts (game_id, severity, created_at DESC);

CREATE TABLE IF NOT EXISTS notification_sinks (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sink_type      VARCHAR(64)  NOT NULL,
  url            VARCHAR(512) NULL,
  api_key        VARCHAR(512) NULL,
  rate_limit     INTEGER      NOT NULL DEFAULT 60,
  last_sent_at   TIMESTAMPTZ  NULL,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS opportunities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255) NOT NULL,
  score       DOUBLE PRECISION NOT NULL DEFAULT 0,
  published   BOOLEAN      NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS anomalies (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id       VARCHAR(64)  NOT NULL,
  anomaly_type  VARCHAR(64)  NOT NULL,
  value         DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_anomalies_game_type ON anomalies (game_id, anomaly_type);

CREATE TABLE IF NOT EXISTS daily_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date   DATE         NOT NULL UNIQUE DEFAULT CURRENT_DATE,
  notes           TEXT         NULL,
  drilldown_links JSONB        NOT NULL DEFAULT '[]'::jsonb,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS patch_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id     VARCHAR(64)  NOT NULL,
  version     INTEGER      NOT NULL DEFAULT 1,
  rollout     BOOLEAN      NOT NULL DEFAULT false,
  content     TEXT         NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_patch_notes_card ON patch_notes (card_id);

CREATE TABLE IF NOT EXISTS patch_note_views (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       VARCHAR(64)  NOT NULL,
  patch_note_id UUID         NOT NULL REFERENCES patch_notes(id),
  viewed_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, patch_note_id)
);

CREATE TABLE IF NOT EXISTS proof_of_week (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_run_id  VARCHAR(64)      NOT NULL,
  impact_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  verified     BOOLEAN          NOT NULL DEFAULT false,
  share_rate   DOUBLE PRECISION NOT NULL DEFAULT 0,
  week_start   DATE             NOT NULL,
  created_at   TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_proof_of_week_week ON proof_of_week (week_start);

CREATE TABLE IF NOT EXISTS weekly_challenges (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario     VARCHAR(255) NOT NULL,
  constraint_  VARCHAR(255) NULL,
  week_start   DATE         NOT NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS weekly_challenge_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id  UUID         NOT NULL REFERENCES weekly_challenges(id),
  player_id     VARCHAR(64)  NOT NULL,
  score         INTEGER      NOT NULL DEFAULT 0,
  completed     BOOLEAN      NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (challenge_id, player_id)
);
CREATE INDEX IF NOT EXISTS idx_wce_player ON weekly_challenge_entries (player_id);

-- ═══════════════════════════════════════════════════════════════════════
-- PIVOTAL TURNS
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS pivotal_turns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          VARCHAR(64)      NOT NULL,
  turn_number     INTEGER          NOT NULL,
  delta_snapshot  JSONB            NOT NULL DEFAULT '{}'::jsonb,
  ml_score        DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pivotal_turns_run ON pivotal_turns (run_id);

CREATE TABLE IF NOT EXISTS pivot_rulesets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hash        VARCHAR(128) NOT NULL UNIQUE,
  rules       JSONB        NOT NULL DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════
-- AFTER-ACTION / AUTOPSY
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS replay_suggestions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id      VARCHAR(64)      NOT NULL,
  failure_mode   VARCHAR(128)     NOT NULL,
  scenario_id    UUID             NULL REFERENCES training_scenarios(id),
  novelty_score  DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_replay_suggestions_player ON replay_suggestions (player_id);

CREATE TABLE IF NOT EXISTS after_autopsy_reports (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id            VARCHAR(64) NOT NULL,
  cause_of_death_id UUID        NULL REFERENCES causes_of_death(id),
  barely_lived      BOOLEAN     NOT NULL DEFAULT false,
  insight           TEXT        NOT NULL DEFAULT '',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_after_autopsy_run ON after_autopsy_reports (run_id);

CREATE TABLE IF NOT EXISTS counterfactual_sims (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id             VARCHAR(64)  NOT NULL,
  fork_turn          INTEGER      NOT NULL,
  alternate_outcome  VARCHAR(64)  NOT NULL DEFAULT '',
  outcome_delta      JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_counterfactual_run ON counterfactual_sims (run_id);

CREATE TABLE IF NOT EXISTS fork_turns (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id            VARCHAR(64)  NOT NULL,
  turn_number       INTEGER      NOT NULL,
  original_choice   VARCHAR(128) NOT NULL DEFAULT '',
  alternate_choice  VARCHAR(128) NOT NULL DEFAULT '',
  outcome_delta     JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fork_turns_run ON fork_turns (run_id);

-- ═══════════════════════════════════════════════════════════════════════
-- PROOF STAMP VARIANTS (proof_stamp entity already exists)
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS stamp_variants (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stamp_id       UUID         NOT NULL,
  visual_tier    INTEGER      NOT NULL DEFAULT 1,
  streak_count   INTEGER      NOT NULL DEFAULT 0,
  referral_count INTEGER      NOT NULL DEFAULT 0,
  evolved_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_stamp_variants_stamp ON stamp_variants (stamp_id);

-- ═══════════════════════════════════════════════════════════════════════
-- HOST OS
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS host_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id         VARCHAR(64)  NOT NULL,
  game_session_id VARCHAR(64)  NOT NULL,
  moment_captures JSONB        NOT NULL DEFAULT '[]'::jsonb,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_host_sessions_host ON host_sessions (host_id);

-- ═══════════════════════════════════════════════════════════════════════
-- TELEMETRY (schema registry — supplements existing DatabaseClient)
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS telemetry_schemas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(128) NOT NULL,
  version     INTEGER      NOT NULL DEFAULT 1,
  definition  JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (name, version)
);

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════
-- ROLLBACK (uncomment to revert)
-- ═══════════════════════════════════════════════════════════════════════
-- DROP TABLE IF EXISTS telemetry_schemas CASCADE;
-- DROP TABLE IF EXISTS host_sessions CASCADE;
-- DROP TABLE IF EXISTS stamp_variants CASCADE;
-- DROP TABLE IF EXISTS fork_turns CASCADE;
-- DROP TABLE IF EXISTS counterfactual_sims CASCADE;
-- DROP TABLE IF EXISTS after_autopsy_reports CASCADE;
-- DROP TABLE IF EXISTS replay_suggestions CASCADE;
-- DROP TABLE IF EXISTS pivot_rulesets CASCADE;
-- DROP TABLE IF EXISTS pivotal_turns CASCADE;
-- DROP TABLE IF EXISTS weekly_challenge_entries CASCADE;
-- DROP TABLE IF EXISTS weekly_challenges CASCADE;
-- DROP TABLE IF EXISTS proof_of_week CASCADE;
-- DROP TABLE IF EXISTS patch_note_views CASCADE;
-- DROP TABLE IF EXISTS patch_notes CASCADE;
-- DROP TABLE IF EXISTS daily_snapshots CASCADE;
-- DROP TABLE IF EXISTS anomalies CASCADE;
-- DROP TABLE IF EXISTS opportunities CASCADE;
-- DROP TABLE IF EXISTS notification_sinks CASCADE;
-- DROP TABLE IF EXISTS liveops_alerts CASCADE;
-- DROP TABLE IF EXISTS training_scenarios CASCADE;
-- DROP TABLE IF EXISTS eligibility_locks CASCADE;
-- DROP TABLE IF EXISTS causes_of_death CASCADE;
-- DROP TABLE IF EXISTS autopsy_snippets CASCADE;
