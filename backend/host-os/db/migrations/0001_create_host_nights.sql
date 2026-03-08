-- ============================================================================
-- POINT ZERO ONE — HOST OS — MIGRATION 0001
-- backend/host-os/db/migrations/0001_create_host_nights.sql
--
-- Purpose:
--   Create the host_nights ledger as a night-level roll-up table for Host OS.
--
-- Why this shape:
--   - host_nights is an aggregate ledger for one hosted night
--   - moment-by-moment/session logging should live in dedicated tables/routes
--   - this table captures operational summaries useful for follow-up, reporting,
--     and host pipeline workflows
--
-- Notes:
--   - intentionally PostgreSQL-first
--   - intentionally compatible with a sovereign primary + PgBouncer + standby
--     topology
--   - intentionally idempotent where possible
--
-- Density6 LLC · Point Zero One · Host OS · Confidential
-- ============================================================================

CREATE TABLE IF NOT EXISTS host_nights (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  -- Canonical host identifier for the night.
  -- Stored as normalized lower-case email in application code.
  host_email VARCHAR(320) NOT NULL,

  -- When the hosted night actually occurred.
  night_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Freeform format label: e.g. physical, digital, hybrid, campus, church, etc.
  format VARCHAR(64) NOT NULL,

  -- Number of high-value moments captured during the night.
  moments_captured INTEGER NOT NULL DEFAULT 0,

  -- Number of social clips actually posted after capture/review.
  clips_posted INTEGER NOT NULL DEFAULT 0,

  -- Optional follow-up booking timestamp for the next host night.
  next_date_booked TIMESTAMPTZ NULL,

  -- Number of players who participated in the session.
  player_count INTEGER NOT NULL DEFAULT 0,

  -- Operator notes / recap / follow-up context.
  notes TEXT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_host_nights_format_nonempty
    CHECK (btrim(format) <> ''),

  CONSTRAINT chk_host_nights_moments_captured_nonnegative
    CHECK (moments_captured >= 0),

  CONSTRAINT chk_host_nights_clips_posted_nonnegative
    CHECK (clips_posted >= 0),

  CONSTRAINT chk_host_nights_player_count_nonnegative
    CHECK (player_count >= 0)
);

COMMENT ON TABLE host_nights IS
  'Night-level Host OS ledger for hosted Point Zero One sessions. Stores nightly roll-ups, not per-moment event logs.';

COMMENT ON COLUMN host_nights.host_email IS
  'Normalized host email used as the human-stable linkage key for host operations.';

COMMENT ON COLUMN host_nights.night_at IS
  'Timestamp when the hosted night occurred.';

COMMENT ON COLUMN host_nights.format IS
  'Hosted night format label (physical, digital, hybrid, etc.).';

COMMENT ON COLUMN host_nights.moments_captured IS
  'Count of notable moments captured during the hosted night.';

COMMENT ON COLUMN host_nights.clips_posted IS
  'Count of clips actually posted/published from the hosted night.';

COMMENT ON COLUMN host_nights.next_date_booked IS
  'Optional timestamp for the next booked host night.';

COMMENT ON COLUMN host_nights.player_count IS
  'Total player count observed during the hosted night.';

COMMENT ON COLUMN host_nights.notes IS
  'Operator notes, follow-up context, or qualitative summary of the session.';

COMMENT ON COLUMN host_nights.created_at IS
  'Row creation timestamp in UTC.';

COMMENT ON COLUMN host_nights.updated_at IS
  'Row last-update timestamp in UTC.';

-- Core lookup path: host history, newest first.
CREATE INDEX IF NOT EXISTS idx_host_nights_host_email_night_at_desc
  ON host_nights (host_email, night_at DESC, id DESC);

-- Global newest-first operational browsing / reporting.
CREATE INDEX IF NOT EXISTS idx_host_nights_night_at_desc
  ON host_nights (night_at DESC, id DESC);

-- Follow-up / rebooking queue.
CREATE INDEX IF NOT EXISTS idx_host_nights_next_date_booked
  ON host_nights (next_date_booked ASC, id ASC)
  WHERE next_date_booked IS NOT NULL;

-- Format-specific reporting and filtering.
CREATE INDEX IF NOT EXISTS idx_host_nights_format_night_at_desc
  ON host_nights (format, night_at DESC, id DESC);

-- Generic updated_at trigger function shared safely across Host OS tables.
CREATE OR REPLACE FUNCTION host_os_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_host_nights_touch_updated_at'
  ) THEN
    CREATE TRIGGER trg_host_nights_touch_updated_at
    BEFORE UPDATE ON host_nights
    FOR EACH ROW
    EXECUTE FUNCTION host_os_touch_updated_at();
  END IF;
END
$$;

-- Optional relational linkage to host_registrations(email).
-- This is added only when the table already exists so the migration can still
-- succeed cleanly in partially-migrated environments.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_name = 'host_registrations'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'fk_host_nights_host_email__host_registrations_email'
    ) THEN
      ALTER TABLE host_nights
      ADD CONSTRAINT fk_host_nights_host_email__host_registrations_email
      FOREIGN KEY (host_email)
      REFERENCES host_registrations(email)
      ON UPDATE CASCADE
      ON DELETE RESTRICT;
    END IF;
  END IF;
END
$$;