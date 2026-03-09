-- backend/migrations/2026_02_20_add_death_artifacts.sql

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS death_artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id TEXT NOT NULL,
    account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    artifact_kind VARCHAR(64) NOT NULL,
    artifact_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT death_artifacts_run_id_not_blank
        CHECK (char_length(btrim(run_id)) > 0),
    CONSTRAINT death_artifacts_kind_not_blank
        CHECK (char_length(btrim(artifact_kind)) > 0),
    CONSTRAINT death_artifacts_payload_is_object
        CHECK (jsonb_typeof(artifact_payload) = 'object')
);

CREATE TABLE IF NOT EXISTS death_delta_strips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id TEXT NOT NULL,
    account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    delta_strips_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT death_delta_strips_run_id_not_blank
        CHECK (char_length(btrim(run_id)) > 0),
    CONSTRAINT death_delta_strips_payload_is_array
        CHECK (jsonb_typeof(delta_strips_json) = 'array')
);

CREATE TABLE IF NOT EXISTS survival_hints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id TEXT NOT NULL,
    account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    hint TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT survival_hints_run_id_not_blank
        CHECK (char_length(btrim(run_id)) > 0),
    CONSTRAINT survival_hints_hint_not_blank
        CHECK (char_length(btrim(hint)) > 0)
);

CREATE TABLE IF NOT EXISTS death_artifact_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    death_artifact_id UUID NOT NULL REFERENCES death_artifacts(id) ON DELETE CASCADE,
    share_artifact_id UUID REFERENCES share_artifacts(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT death_artifact_receipts_unique
        UNIQUE (death_artifact_id, share_artifact_id)
);

CREATE INDEX IF NOT EXISTS idx_death_artifacts_run_id
    ON death_artifacts (run_id);

CREATE INDEX IF NOT EXISTS idx_death_artifacts_account_id
    ON death_artifacts (account_id);

CREATE INDEX IF NOT EXISTS idx_death_artifacts_kind
    ON death_artifacts (artifact_kind);

CREATE INDEX IF NOT EXISTS idx_death_artifacts_created_at
    ON death_artifacts (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_death_delta_strips_run_id
    ON death_delta_strips (run_id);

CREATE INDEX IF NOT EXISTS idx_death_delta_strips_account_id
    ON death_delta_strips (account_id);

CREATE INDEX IF NOT EXISTS idx_death_delta_strips_created_at
    ON death_delta_strips (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_survival_hints_run_id
    ON survival_hints (run_id);

CREATE INDEX IF NOT EXISTS idx_survival_hints_account_id
    ON survival_hints (account_id);

CREATE INDEX IF NOT EXISTS idx_survival_hints_created_at
    ON survival_hints (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_death_artifact_receipts_death_artifact_id
    ON death_artifact_receipts (death_artifact_id);

CREATE INDEX IF NOT EXISTS idx_death_artifact_receipts_share_artifact_id
    ON death_artifact_receipts (share_artifact_id);

COMMIT;