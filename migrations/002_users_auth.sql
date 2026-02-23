-- =============================================================================
-- FILE: migrations/002_users_auth.sql
-- Point Zero One — Production Auth Schema
-- Run: psql -d pzo -f migrations/002_users_auth.sql
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── USERS ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  username          VARCHAR(32) NOT NULL UNIQUE,
  email             VARCHAR(255) NOT NULL UNIQUE,
  password_hash     TEXT        NOT NULL,
  display_name      VARCHAR(50) NOT NULL,
  avatar_emoji      VARCHAR(8)  NOT NULL DEFAULT '💰',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login        TIMESTAMPTZ,
  is_active         BOOLEAN     NOT NULL DEFAULT true,
  is_banned         BOOLEAN     NOT NULL DEFAULT false,
  ban_reason        TEXT,

  -- Game stats
  total_runs        INT         NOT NULL DEFAULT 0,
  best_net_worth    BIGINT      NOT NULL DEFAULT 0,
  total_freedom_runs INT        NOT NULL DEFAULT 0,
  current_streak    INT         NOT NULL DEFAULT 0,
  best_streak       INT         NOT NULL DEFAULT 0,

  -- Hater tracking (how much the system has hit this player)
  hater_heat        INT         NOT NULL DEFAULT 0,  -- increases when player is doing well
  times_sabotaged   INT         NOT NULL DEFAULT 0,

  CONSTRAINT username_format CHECK (username ~ '^[a-zA-Z0-9_]{3,32}$'),
  CONSTRAINT email_format     CHECK (email ~ '^[^@]+@[^@]+\.[^@]+$')
);

CREATE INDEX IF NOT EXISTS idx_users_email    ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);
CREATE INDEX IF NOT EXISTS idx_users_active   ON users (is_active, is_banned);

-- ─── REFRESH TOKENS ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT        NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user    ON refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens (expires_at);

-- ─── RUN HISTORY ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS run_history (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seed           BIGINT      NOT NULL,
  ticks_survived INT         NOT NULL,
  final_cash     BIGINT      NOT NULL,
  final_net_worth BIGINT     NOT NULL,
  final_income   INT         NOT NULL,
  final_expenses INT         NOT NULL,
  outcome        VARCHAR(20) NOT NULL CHECK (outcome IN ('FREEDOM','BANKRUPT','TIMEOUT','ABANDONED')),
  proof_hash     TEXT        NOT NULL,
  hater_sabotages INT        NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_run_history_user    ON run_history (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_run_history_outcome ON run_history (outcome, final_net_worth DESC);

-- ─── LEADERBOARD VIEW ────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW leaderboard AS
SELECT
  u.id,
  u.display_name,
  u.avatar_emoji,
  u.total_freedom_runs,
  u.best_net_worth,
  u.best_streak,
  u.current_streak,
  u.times_sabotaged,
  RANK() OVER (ORDER BY u.best_net_worth DESC) AS rank
FROM users u
WHERE u.is_active = true AND u.is_banned = false
ORDER BY u.best_net_worth DESC;

-- ─── HATER EVENT LOG ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hater_events (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  hater_id    VARCHAR(20) NOT NULL,   -- 'SLUMLORD_7', 'DEBT_DAEMON', etc.
  target_user UUID        REFERENCES users(id) ON DELETE SET NULL,
  event_type  VARCHAR(30) NOT NULL,   -- 'TAUNT', 'SABOTAGE', 'INJECT_CARD'
  payload     JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hater_events_hater  ON hater_events (hater_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hater_events_target ON hater_events (target_user, created_at DESC);
