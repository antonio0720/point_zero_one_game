-- /backend/migrations/0053_generational.sql
-- Point Zero One Digital
-- Generational mode state tables
-- PostgreSQL-only, idempotent, TEXT user/run identifiers to avoid schema drift
-- against the current split engine/backend persistence model.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION set_row_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'bloodline_status'
  ) THEN
    CREATE TYPE bloodline_status AS ENUM (
      'active',
      'dormant',
      'ended'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'generation_event_outcome'
  ) THEN
    CREATE TYPE generation_event_outcome AS ENUM (
      'success',
      'failure',
      'partial',
      'abandoned'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS bloodlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  line_key TEXT NOT NULL,
  current_generation INTEGER NOT NULL DEFAULT 1,
  status bloodline_status NOT NULL DEFAULT 'active',
  source_run_id TEXT,
  lineage_seed TEXT,
  bloodline_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  inherited_state_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_bloodlines_user_id UNIQUE (user_id),
  CONSTRAINT uq_bloodlines_line_key UNIQUE (line_key),
  CONSTRAINT bloodlines_current_generation_positive
    CHECK (current_generation >= 1),
  CONSTRAINT bloodlines_bloodline_json_is_object
    CHECK (jsonb_typeof(bloodline_json) = 'object'),
  CONSTRAINT bloodlines_inherited_state_json_is_object
    CHECK (jsonb_typeof(inherited_state_json) = 'object')
);

COMMENT ON TABLE bloodlines IS
  'Persistent generational mode profile keyed to an upstream user/account identifier.';
COMMENT ON COLUMN bloodlines.line_key IS
  'Stable external bloodline identifier safe for app-layer routing and analytics.';
COMMENT ON COLUMN bloodlines.source_run_id IS
  'Optional run id that most recently mutated the bloodline.';

CREATE INDEX IF NOT EXISTS idx_bloodlines_status
  ON bloodlines (status);

CREATE INDEX IF NOT EXISTS idx_bloodlines_source_run_id
  ON bloodlines (source_run_id);

CREATE INDEX IF NOT EXISTS idx_bloodlines_updated_at
  ON bloodlines (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_bloodlines_bloodline_json_gin
  ON bloodlines
  USING GIN (bloodline_json);

CREATE INDEX IF NOT EXISTS idx_bloodlines_inherited_state_json_gin
  ON bloodlines
  USING GIN (inherited_state_json);

CREATE TABLE IF NOT EXISTS generation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bloodline_id UUID NOT NULL,
  generation INTEGER NOT NULL,
  parent_run_id TEXT,
  event_type TEXT NOT NULL DEFAULT 'run_resolution',
  inherited_state_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  event_payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  outcome generation_event_outcome NOT NULL DEFAULT 'success',
  outcome_reason TEXT,
  net_worth_delta_cents BIGINT NOT NULL DEFAULT 0,
  reputation_delta INTEGER NOT NULL DEFAULT 0,
  debt_delta_cents BIGINT NOT NULL DEFAULT 0,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_generation_events_bloodline_id
    FOREIGN KEY (bloodline_id)
    REFERENCES bloodlines (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_generation_events_parent_run_id
    FOREIGN KEY (parent_run_id)
    REFERENCES decision_trees (run_id)
    ON DELETE SET NULL,
  CONSTRAINT uq_generation_events_bloodline_generation
    UNIQUE (bloodline_id, generation),
  CONSTRAINT generation_events_generation_positive
    CHECK (generation >= 1),
  CONSTRAINT generation_events_inherited_state_json_is_object
    CHECK (jsonb_typeof(inherited_state_json) = 'object'),
  CONSTRAINT generation_events_event_payload_json_is_object
    CHECK (jsonb_typeof(event_payload_json) = 'object')
);

COMMENT ON TABLE generation_events IS
  'Immutable generation-by-generation ledger for bloodline progression.';
COMMENT ON COLUMN generation_events.parent_run_id IS
  'Optional linkage to the forensic decision-tree projection for the originating run.';
COMMENT ON COLUMN generation_events.event_type IS
  'Application-defined event classification, e.g. run_resolution, inheritance, branch_override.';

CREATE INDEX IF NOT EXISTS idx_generation_events_bloodline_id
  ON generation_events (bloodline_id);

CREATE INDEX IF NOT EXISTS idx_generation_events_parent_run_id
  ON generation_events (parent_run_id);

CREATE INDEX IF NOT EXISTS idx_generation_events_outcome
  ON generation_events (outcome);

CREATE INDEX IF NOT EXISTS idx_generation_events_occurred_at
  ON generation_events (occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_generation_events_event_type
  ON generation_events (event_type);

CREATE INDEX IF NOT EXISTS idx_generation_events_payload_json_gin
  ON generation_events
  USING GIN (event_payload_json);

DROP TRIGGER IF EXISTS trg_bloodlines_set_updated_at ON bloodlines;
CREATE TRIGGER trg_bloodlines_set_updated_at
BEFORE UPDATE ON bloodlines
FOR EACH ROW
EXECUTE FUNCTION set_row_updated_at();

DROP TRIGGER IF EXISTS trg_generation_events_set_updated_at ON generation_events;
CREATE TRIGGER trg_generation_events_set_updated_at
BEFORE UPDATE ON generation_events
FOR EACH ROW
EXECUTE FUNCTION set_row_updated_at();