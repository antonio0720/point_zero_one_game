-- Point Zero One — Tier 1 Postgres Schema Migration
-- Replaces mongoose models for: guest_sessions, cosmetic_store_items,
-- tutorial_variants, daily_challenges, casual_controls, verified_controls,
-- pending_placements
--
-- Run: psql $DATABASE_URL -f migrations/001_tier1_tables.sql
-- Rollback: DROP TABLE statements at bottom
--
-- Compatible with: TypeORM entities in backend/src/entities/

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════
-- 1. guest_sessions
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS guest_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_ua       VARCHAR(512) NOT NULL DEFAULT '',
  device_ip       VARCHAR(45)  NOT NULL DEFAULT '',
  run_history     JSONB        NOT NULL DEFAULT '[]'::jsonb,
  upgraded_to_id  UUID         NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guest_sessions_device
  ON guest_sessions (device_ua, device_ip);
CREATE INDEX IF NOT EXISTS idx_guest_sessions_created
  ON guest_sessions (created_at);

-- ═══════════════════════════════════════════════════════════════════════
-- 2. cosmetic_store_items
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS cosmetic_store_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255) NOT NULL,
  description TEXT         NOT NULL DEFAULT '',
  price       INTEGER      NOT NULL DEFAULT 0,
  image_url   VARCHAR(512) NOT NULL DEFAULT '',
  is_active   BOOLEAN      NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cosmetic_store_active
  ON cosmetic_store_items (is_active) WHERE is_active = true;

-- ═══════════════════════════════════════════════════════════════════════
-- 3. tutorial_variants
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS tutorial_variants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_name  VARCHAR(128)  NOT NULL UNIQUE,
  seed          INTEGER       NOT NULL,
  guaranteed_survival_turns INTEGER NOT NULL DEFAULT 3,
  is_active     BOOLEAN       NOT NULL DEFAULT true,
  weight        INTEGER       NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════
-- 4. daily_challenges
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS daily_challenges (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seed            INTEGER      NOT NULL,
  scenario        VARCHAR(255) NOT NULL DEFAULT '',
  challenge_date  DATE         NOT NULL UNIQUE DEFAULT CURRENT_DATE,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_challenge_entries (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id     UUID         NOT NULL REFERENCES daily_challenges(id),
  player_id        VARCHAR(64)  NOT NULL,
  completed        BOOLEAN      NOT NULL DEFAULT false,
  score            INTEGER      NOT NULL DEFAULT 0,
  completed_at     TIMESTAMPTZ  NULL,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (challenge_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_daily_challenge_entries_player
  ON daily_challenge_entries (player_id);
CREATE INDEX IF NOT EXISTS idx_daily_challenge_entries_completed
  ON daily_challenge_entries (challenge_id, completed);

-- ═══════════════════════════════════════════════════════════════════════
-- 5. casual_controls (dedup, rate-limit, plausibility for casual ladder)
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS casual_controls (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id      VARCHAR(64)  NOT NULL,
  action         VARCHAR(128) NOT NULL,
  last_executed  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (player_id, action)
);

CREATE INDEX IF NOT EXISTS idx_casual_controls_player
  ON casual_controls (player_id);

-- ═══════════════════════════════════════════════════════════════════════
-- 6. verified_controls (verified ladder placement tracking)
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS verified_controls (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id       VARCHAR(64)  NOT NULL,
  control_id    VARCHAR(64)  NOT NULL UNIQUE,
  placement_id  VARCHAR(64)  NOT NULL,
  verifier_id   VARCHAR(64)  NOT NULL,
  verified_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verified_controls_game
  ON verified_controls (game_id);

-- ═══════════════════════════════════════════════════════════════════════
-- 7. pending_placements (verified ladder queue)
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS pending_placements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    VARCHAR(64)  NOT NULL,
  ladder_id   VARCHAR(64)  NOT NULL,
  position    INTEGER      NOT NULL,
  is_visible  BOOLEAN      NOT NULL DEFAULT false,
  finalized   BOOLEAN      NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pending_placements_owner
  ON pending_placements (owner_id);
CREATE INDEX IF NOT EXISTS idx_pending_placements_ladder
  ON pending_placements (ladder_id, finalized);

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════
-- ROLLBACK (uncomment to revert)
-- ═══════════════════════════════════════════════════════════════════════
-- DROP TABLE IF EXISTS pending_placements CASCADE;
-- DROP TABLE IF EXISTS verified_controls CASCADE;
-- DROP TABLE IF EXISTS casual_controls CASCADE;
-- DROP TABLE IF EXISTS daily_challenge_entries CASCADE;
-- DROP TABLE IF EXISTS daily_challenges CASCADE;
-- DROP TABLE IF EXISTS tutorial_variants CASCADE;
-- DROP TABLE IF EXISTS cosmetic_store_items CASCADE;
-- DROP TABLE IF EXISTS guest_sessions CASCADE;
