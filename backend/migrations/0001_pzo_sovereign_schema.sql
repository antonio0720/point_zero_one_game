-- ============================================================================
-- POINT ZERO ONE — SOVEREIGN SCHEMA v1.0
-- ============================================================================
-- Single migration to rule them all.
-- Density6 LLC · Sovereign Infrastructure · RA-OMEGA Intelligence
--
-- Architecture:
--   PostgreSQL 16+ · PgBouncer-safe · Streaming-replication-ready
--   Designed for 20M concurrent users on 2× OVH Advance-1 bare metal
--
-- Schemas:
--   public  — core accounts, sessions, auth, feature flags
--   game    — runs, turns, events, cards, engines, game-mode mechanics
--   economy — billing, purchases, entitlements, SKUs, monetization
--   social  — multiplayer, rivalries, spectators, syndicates, trust
--   b2b     — institutional tenancy, cohorts, curriculum
--   analytics — scorecards, telemetry, leaderboards, reporting
--
-- Conventions:
--   BIGINT IDs for high-throughput tables (events, turns, telemetry)
--   INTEGER IDs for entity tables (accounts, runs, cards)
--   *_cents BIGINT for all money (no floats, no decimals)
--   *_json JSONB with typeof constraints
--   *_at TIMESTAMPTZ for all timestamps
--   SHA-256 hashes stored as VARCHAR(64)
--   All enums use DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$
--   All tables use IF NOT EXISTS for idempotency
--   updated_at triggers on every mutable table
--   BRIN indexes on time-series columns
--   GIN indexes on JSONB columns
--   Partial indexes where appropriate
--   No session-level advisory locks (PgBouncer transaction mode safe)
-- ============================================================================

BEGIN;

-- ============================================================================
-- 0. EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- 1. SCHEMAS
-- ============================================================================
CREATE SCHEMA IF NOT EXISTS game;
CREATE SCHEMA IF NOT EXISTS economy;
CREATE SCHEMA IF NOT EXISTS social;
CREATE SCHEMA IF NOT EXISTS b2b;
CREATE SCHEMA IF NOT EXISTS analytics;

-- ============================================================================
-- 2. UTILITY FUNCTIONS
-- ============================================================================
CREATE OR REPLACE FUNCTION set_row_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

-- Idempotent trigger creator — call once per table
CREATE OR REPLACE FUNCTION create_updated_at_trigger(schema_name TEXT, table_name TEXT)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    EXECUTE format(
        'DROP TRIGGER IF EXISTS %I_set_updated_at ON %I.%I',
        table_name, schema_name, table_name
    );
    EXECUTE format(
        'CREATE TRIGGER %I_set_updated_at BEFORE UPDATE ON %I.%I '
        'FOR EACH ROW EXECUTE FUNCTION set_row_updated_at()',
        table_name, schema_name, table_name
    );
END;
$$;

-- ============================================================================
-- 3. ENUMS — ALL GAME ENUMS IN ONE BLOCK
-- ============================================================================

-- 3.1 Core
DO $$ BEGIN CREATE TYPE account_status AS ENUM ('active','suspended','banned','deleted'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE device_platform AS ENUM ('web','ios','android','desktop','unknown'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE flag_status AS ENUM ('enabled','disabled','rollout'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3.2 Game modes — THE FOUR BATTLEGROUNDS
DO $$ BEGIN CREATE TYPE game_mode AS ENUM ('EMPIRE','PREDATOR','SYNDICATE','PHANTOM'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3.3 Run lifecycle
DO $$ BEGIN CREATE TYPE run_status AS ENUM ('IDLE','LOADING','RUNNING','PAUSED','COMPLETED','FAILED','ABANDONED','QUARANTINED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE run_outcome AS ENUM ('FREEDOM','TIMEOUT','BANKRUPT','ABANDONED','QUARANTINED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE run_phase AS ENUM ('FOUNDATION','ESCALATION','SOVEREIGNTY'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE run_visibility AS ENUM ('VISIBLE','HIDDEN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE verification_status AS ENUM ('PENDING','VERIFIED','REJECTED','INTEGRITY_VIOLATION'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE run_grade AS ENUM ('S','A','B','C','D','F'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE pressure_tier AS ENUM ('T1','T2','T3','T4'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3.4 Card system
DO $$ BEGIN CREATE TYPE deck_type AS ENUM (
    'OPPORTUNITY','IPA','FUBAR','PRIVILEGED','SO','PHASE_BOUNDARY',
    'SABOTAGE','COUNTER','BLUFF','AID','RESCUE','TRUST','DEFECTION',
    'GHOST','DISCIPLINE','GAP_EXPLOIT','DYNASTY'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE card_rarity AS ENUM ('COMMON','UNCOMMON','RARE','EPIC','LEGENDARY'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE timing_class AS ENUM (
    'IMMEDIATE','REACTIVE','STANDARD','HOLD','COUNTER_WINDOW',
    'RESCUE_WINDOW','PHASE_BOUNDARY','FORCED','PASSIVE','CHAIN',
    'BLUFF_WINDOW','EXTRACTION_WINDOW'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE card_targeting AS ENUM (
    'SELF','OPPONENT','TEAM','TREASURY','ALL_PLAYERS','AOE',
    'GHOST','SYNDICATE','NONE'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3.5 Hater bots
DO $$ BEGIN CREATE TYPE bot_identity AS ENUM (
    'LIQUIDATOR','MANIPULATOR','CRASH_PROPHET','LIFESTYLE_CREEP','FOMO_PHANTOM'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE bot_state AS ENUM ('DORMANT','CIRCLING','SEEDING','ACTIVE','ATTACKING','CRASH','COOLDOWN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3.6 Shield system
DO $$ BEGIN CREATE TYPE shield_layer AS ENUM ('INCOME','EXPENSE','LIQUIDITY','CREDIT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3.7 Economy / monetization
DO $$ BEGIN CREATE TYPE entitlement_state AS ENUM ('ACTIVE','EXPIRED','REVOKED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE subscription_state AS ENUM ('TRIALING','ACTIVE','PAST_DUE','CANCELED','EXPIRED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE purchase_status AS ENUM ('PENDING','PAID','FAILED','REFUNDED','VOIDED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE receipt_event_type AS ENUM ('PURCHASE','REFUND','CHARGEBACK','GRANT','REVOKE','ADJUSTMENT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE promo_discount_type AS ENUM ('FLAT_CENTS','PERCENT_BPS','FREE_SKU'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE invoice_status AS ENUM ('draft','issued','paid','void','overdue'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE billing_interval AS ENUM ('monthly','quarterly','yearly','one_time'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3.8 Social / multiplayer
DO $$ BEGIN CREATE TYPE match_status AS ENUM ('MATCHMAKING','LOADING','LIVE','COMPLETED','ABANDONED','DISPUTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE rivalry_tier AS ENUM ('RIVAL','ARCH_RIVAL','NEMESIS'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE team_role AS ENUM ('INCOME_BUILDER','SHIELD_ARCHITECT','OPPORTUNITY_HUNTER','COUNTER_INTEL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE defection_state AS ENUM ('LOYAL','CONSIDERING','DEFECTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE spectator_bet_status AS ENUM ('OPEN','WON','LOST','CANCELED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3.9 Share artifacts
DO $$ BEGIN CREATE TYPE share_artifact_kind AS ENUM (
    'PROOF_CARD','CASE_FILE','SPECTATOR_LINK','TEAM_PROOF_SHARE',
    'RUN_EXPLORER_EXPORT','OG_IMAGE','MATCH_CLIP'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE share_artifact_status AS ENUM ('PENDING','READY','FAILED','REDACTED','EXPIRED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE share_audience AS ENUM ('PRIVATE','TEAM','UNLISTED','PUBLIC'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3.10 Macro shock
DO $$ BEGIN CREATE TYPE macro_event_source AS ENUM ('ENGINE','LIVEOPS','LEGEND_DECAY','COMMUNITY_HEAT','FUBAR','BOT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE macro_event_state AS ENUM ('SCHEDULED','TRIGGERED','RESOLVED','CANCELED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE shock_broadcast_audience AS ENUM ('RUN','PLAYER','TEAM','SPECTATOR','GLOBAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3.11 Card forge / UGC
DO $$ BEGIN CREATE TYPE card_forge_submission_state AS ENUM ('DRAFT','SUBMITTED','IN_REVIEW','APPROVED','REJECTED','MINTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE gauntlet_round_state AS ENUM ('QUEUED','OPEN','CLOSED','ARCHIVED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE gauntlet_vote_verdict AS ENUM ('APPROVE','REJECT','ABSTAIN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3.12 Content lifecycle
DO $$ BEGIN CREATE TYPE content_lifecycle_status AS ENUM ('DRAFT','READY','VALIDATING','PUBLISHED','RETIRED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3.13 Generational / bloodlines
DO $$ BEGIN CREATE TYPE bloodline_status AS ENUM ('active','dormant','ended'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE generation_event_outcome AS ENUM ('success','failure','partial','abandoned'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3.14 Notifications
DO $$ BEGIN CREATE TYPE notification_channel AS ENUM ('push','email','sms'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE notification_delivery_status AS ENUM ('queued','sent','delivered','failed','suppressed','read'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE push_platform AS ENUM ('ios','android','web','unknown'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3.15 B2B
DO $$ BEGIN CREATE TYPE b2b_tenant_status AS ENUM ('trial','active','suspended','archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE tenant_seat_status AS ENUM ('invited','active','disabled','revoked'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3.16 Alert system
DO $$ BEGIN CREATE TYPE alert_severity AS ENUM ('info','warning','critical','fatal'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE alert_firing_state AS ENUM ('pending','firing','resolved','silenced'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- 4. PUBLIC SCHEMA — CORE IDENTITY & AUTH
-- ============================================================================

-- 4.1 Accounts — the root identity table
CREATE TABLE IF NOT EXISTS accounts (
    id          INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    email       VARCHAR(255) NOT NULL,
    username    VARCHAR(64),
    display_name VARCHAR(255),
    avatar_url  VARCHAR(512),
    status      account_status NOT NULL DEFAULT 'active',
    is_founder  BOOLEAN NOT NULL DEFAULT FALSE,
    staking_balance_cents BIGINT NOT NULL DEFAULT 0,
    needs_re_verification BOOLEAN NOT NULL DEFAULT FALSE,
    re_verification_requested_at TIMESTAMPTZ,
    abuse_risk_score INTEGER NOT NULL DEFAULT 0,
    abuse_flags  JSONB NOT NULL DEFAULT '[]'::jsonb,
    abuse_flagged_at TIMESTAMPTZ,
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT accounts_email_not_blank CHECK (char_length(btrim(email)) > 0),
    CONSTRAINT accounts_staking_balance_nonnegative CHECK (staking_balance_cents >= 0),
    CONSTRAINT accounts_abuse_risk_score_nonnegative CHECK (abuse_risk_score >= 0),
    CONSTRAINT accounts_abuse_flags_is_array CHECK (jsonb_typeof(abuse_flags) = 'array'),
    CONSTRAINT accounts_metadata_is_object CHECK (jsonb_typeof(metadata_json) = 'object')
);

CREATE UNIQUE INDEX IF NOT EXISTS accounts_email_normalized_uidx ON accounts ((lower(btrim(email))));
CREATE UNIQUE INDEX IF NOT EXISTS accounts_username_uidx ON accounts ((lower(btrim(username)))) WHERE username IS NOT NULL;
CREATE INDEX IF NOT EXISTS accounts_status_idx ON accounts (status);
CREATE INDEX IF NOT EXISTS accounts_is_founder_idx ON accounts (is_founder) WHERE is_founder = TRUE;
CREATE INDEX IF NOT EXISTS accounts_abuse_risk_score_idx ON accounts (abuse_risk_score) WHERE abuse_risk_score > 0;
CREATE INDEX IF NOT EXISTS accounts_abuse_flags_gin_idx ON accounts USING GIN (abuse_flags);
CREATE INDEX IF NOT EXISTS accounts_created_at_idx ON accounts (created_at DESC);
SELECT create_updated_at_trigger('public', 'accounts');

-- 4.2 Users — game player profile linked to account
CREATE TABLE IF NOT EXISTS users (
    id          INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    account_id  INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    handle      VARCHAR(32) NOT NULL,
    bio         TEXT NOT NULL DEFAULT '',
    level       INTEGER NOT NULL DEFAULT 1,
    xp          BIGINT NOT NULL DEFAULT 0,
    total_runs  INTEGER NOT NULL DEFAULT 0,
    total_cord  NUMERIC(18,6) NOT NULL DEFAULT 0,
    best_cord   NUMERIC(18,6) NOT NULL DEFAULT 0,
    best_grade  run_grade,
    preferred_mode game_mode,
    profile_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    badges_json  JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT users_handle_not_blank CHECK (char_length(btrim(handle)) > 0),
    CONSTRAINT users_level_positive CHECK (level >= 1),
    CONSTRAINT users_xp_nonneg CHECK (xp >= 0),
    CONSTRAINT users_total_runs_nonneg CHECK (total_runs >= 0),
    CONSTRAINT users_total_cord_nonneg CHECK (total_cord >= 0),
    CONSTRAINT users_best_cord_nonneg CHECK (best_cord >= 0),
    CONSTRAINT users_profile_is_object CHECK (jsonb_typeof(profile_json) = 'object'),
    CONSTRAINT users_badges_is_array CHECK (jsonb_typeof(badges_json) = 'array'),
    CONSTRAINT users_account_unique UNIQUE (account_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS users_handle_uidx ON users ((lower(btrim(handle))));
CREATE INDEX IF NOT EXISTS users_account_id_idx ON users (account_id);
CREATE INDEX IF NOT EXISTS users_level_idx ON users (level DESC);
CREATE INDEX IF NOT EXISTS users_total_cord_idx ON users (total_cord DESC);
CREATE INDEX IF NOT EXISTS users_best_cord_idx ON users (best_cord DESC);
SELECT create_updated_at_trigger('public', 'users');

-- 4.3 Sessions — per-device login sessions
CREATE TABLE IF NOT EXISTS sessions (
    id          INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(64) NOT NULL,
    device_ua   VARCHAR(512) NOT NULL DEFAULT '',
    device_ip   VARCHAR(45) NOT NULL DEFAULT '',
    platform    device_platform NOT NULL DEFAULT 'unknown',
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT sessions_token_hash_not_blank CHECK (char_length(btrim(token_hash)) > 0)
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_token_hash_idx ON sessions (token_hash);
CREATE INDEX IF NOT EXISTS sessions_active_idx ON sessions (is_active, last_seen_at DESC) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions (expires_at) WHERE expires_at IS NOT NULL;
SELECT create_updated_at_trigger('public', 'sessions');

-- 4.4 Guest sessions — anonymous pre-signup
CREATE TABLE IF NOT EXISTS guest_sessions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_ua   VARCHAR(512) NOT NULL DEFAULT '',
    device_ip   VARCHAR(45) NOT NULL DEFAULT '',
    run_history JSONB NOT NULL DEFAULT '[]'::jsonb,
    upgraded_to_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT guest_sessions_run_history_is_array CHECK (jsonb_typeof(run_history) = 'array')
);

CREATE INDEX IF NOT EXISTS guest_sessions_device_idx ON guest_sessions (device_ua, device_ip);
CREATE INDEX IF NOT EXISTS guest_sessions_created_at_idx ON guest_sessions (created_at DESC);
CREATE INDEX IF NOT EXISTS guest_sessions_upgraded_idx ON guest_sessions (upgraded_to_user_id) WHERE upgraded_to_user_id IS NOT NULL;
SELECT create_updated_at_trigger('public', 'guest_sessions');

-- 4.5 Feature flags
CREATE TABLE IF NOT EXISTS feature_flags (
    id          INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    flag_key    VARCHAR(128) NOT NULL,
    status      flag_status NOT NULL DEFAULT 'disabled',
    rollout_pct INTEGER NOT NULL DEFAULT 0,
    description TEXT,
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT feature_flags_flag_key_not_blank CHECK (char_length(btrim(flag_key)) > 0),
    CONSTRAINT feature_flags_rollout_pct_range CHECK (rollout_pct BETWEEN 0 AND 100),
    CONSTRAINT feature_flags_metadata_is_object CHECK (jsonb_typeof(metadata_json) = 'object')
);

CREATE UNIQUE INDEX IF NOT EXISTS feature_flags_flag_key_uidx ON feature_flags ((lower(btrim(flag_key))));
SELECT create_updated_at_trigger('public', 'feature_flags');

-- 4.6 Global event store — append-only event sourcing backbone
CREATE TABLE IF NOT EXISTS global_event_store (
    id              BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    aggregate_id    VARCHAR(255) NOT NULL,
    aggregate_kind  VARCHAR(64) NOT NULL,
    event_name      VARCHAR(128) NOT NULL,
    stream_version  INTEGER NOT NULL,
    payload_json    JSONB NOT NULL DEFAULT '{}'::jsonb,
    metadata_json   JSONB NOT NULL DEFAULT '{}'::jsonb,
    correlation_id  VARCHAR(255),
    causation_id    VARCHAR(255),
    idempotency_key VARCHAR(255),
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    recorded_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ges_aggregate_id_not_blank CHECK (char_length(btrim(aggregate_id)) > 0),
    CONSTRAINT ges_aggregate_kind_not_blank CHECK (char_length(btrim(aggregate_kind)) > 0),
    CONSTRAINT ges_event_name_not_blank CHECK (char_length(btrim(event_name)) > 0),
    CONSTRAINT ges_stream_version_positive CHECK (stream_version > 0),
    CONSTRAINT ges_payload_object CHECK (jsonb_typeof(payload_json) = 'object'),
    CONSTRAINT ges_metadata_object CHECK (jsonb_typeof(metadata_json) = 'object')
);

CREATE UNIQUE INDEX IF NOT EXISTS ges_stream_version_uidx ON global_event_store (aggregate_kind, aggregate_id, stream_version);
CREATE UNIQUE INDEX IF NOT EXISTS ges_idempotency_key_uidx ON global_event_store (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS ges_stream_lookup_idx ON global_event_store (aggregate_kind, aggregate_id, occurred_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS ges_event_name_idx ON global_event_store (event_name);
CREATE INDEX IF NOT EXISTS ges_correlation_id_idx ON global_event_store (correlation_id) WHERE correlation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ges_recorded_at_brin_idx ON global_event_store USING BRIN (recorded_at);
CREATE INDEX IF NOT EXISTS ges_occurred_at_brin_idx ON global_event_store USING BRIN (occurred_at);
CREATE INDEX IF NOT EXISTS ges_payload_gin_idx ON global_event_store USING GIN (payload_json);

-- ============================================================================
-- 5. GAME SCHEMA — CARD SYSTEM
-- ============================================================================

-- 5.1 Ruleset versions — versioned game rule definitions
CREATE TABLE IF NOT EXISTS game.ruleset_versions (
    id              INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    version_tag     VARCHAR(64) NOT NULL,
    description     TEXT,
    rules_json      JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active       BOOLEAN NOT NULL DEFAULT FALSE,
    published_at    TIMESTAMPTZ,
    deprecated_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT rv_version_tag_not_blank CHECK (char_length(btrim(version_tag)) > 0),
    CONSTRAINT rv_rules_is_object CHECK (jsonb_typeof(rules_json) = 'object')
);

CREATE UNIQUE INDEX IF NOT EXISTS rv_version_tag_uidx ON game.ruleset_versions ((lower(btrim(version_tag))));
CREATE INDEX IF NOT EXISTS rv_is_active_idx ON game.ruleset_versions (is_active) WHERE is_active = TRUE;
SELECT create_updated_at_trigger('game', 'ruleset_versions');

-- 5.2 Card definitions — canonical card templates
CREATE TABLE IF NOT EXISTS game.card_definitions (
    id              INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    card_key        VARCHAR(128) NOT NULL,
    name            VARCHAR(255) NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    deck_type       deck_type NOT NULL,
    rarity          card_rarity NOT NULL DEFAULT 'COMMON',
    timing          timing_class NOT NULL DEFAULT 'STANDARD',
    targeting       card_targeting NOT NULL DEFAULT 'SELF',
    base_cost_cents BIGINT NOT NULL DEFAULT 0,
    base_bb_cost    INTEGER NOT NULL DEFAULT 0,
    tags            TEXT[] NOT NULL DEFAULT '{}',
    -- Mode overlay flags
    legal_in_empire    BOOLEAN NOT NULL DEFAULT TRUE,
    legal_in_predator  BOOLEAN NOT NULL DEFAULT FALSE,
    legal_in_syndicate BOOLEAN NOT NULL DEFAULT FALSE,
    legal_in_phantom   BOOLEAN NOT NULL DEFAULT FALSE,
    -- Mode-specific scoring weights
    empire_weight      NUMERIC(6,4) NOT NULL DEFAULT 1.0,
    predator_weight    NUMERIC(6,4) NOT NULL DEFAULT 1.0,
    syndicate_weight   NUMERIC(6,4) NOT NULL DEFAULT 1.0,
    phantom_weight     NUMERIC(6,4) NOT NULL DEFAULT 1.0,
    -- Mode-specific overrides (JSONB)
    mode_overrides_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    effects_json       JSONB NOT NULL DEFAULT '{}'::jsonb,
    prerequisites_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    art_asset_url      VARCHAR(512),
    is_active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT cd_card_key_not_blank CHECK (char_length(btrim(card_key)) > 0),
    CONSTRAINT cd_name_not_blank CHECK (char_length(btrim(name)) > 0),
    CONSTRAINT cd_base_cost_nonneg CHECK (base_cost_cents >= 0),
    CONSTRAINT cd_base_bb_cost_nonneg CHECK (base_bb_cost >= 0),
    CONSTRAINT cd_mode_overrides_is_object CHECK (jsonb_typeof(mode_overrides_json) = 'object'),
    CONSTRAINT cd_effects_is_object CHECK (jsonb_typeof(effects_json) = 'object'),
    CONSTRAINT cd_prerequisites_is_array CHECK (jsonb_typeof(prerequisites_json) = 'array')
);

CREATE UNIQUE INDEX IF NOT EXISTS cd_card_key_uidx ON game.card_definitions ((lower(btrim(card_key))));
CREATE INDEX IF NOT EXISTS cd_deck_type_idx ON game.card_definitions (deck_type);
CREATE INDEX IF NOT EXISTS cd_rarity_idx ON game.card_definitions (rarity);
CREATE INDEX IF NOT EXISTS cd_timing_idx ON game.card_definitions (timing);
CREATE INDEX IF NOT EXISTS cd_targeting_idx ON game.card_definitions (targeting);
CREATE INDEX IF NOT EXISTS cd_tags_gin_idx ON game.card_definitions USING GIN (tags);
CREATE INDEX IF NOT EXISTS cd_legal_empire_idx ON game.card_definitions (legal_in_empire) WHERE legal_in_empire = TRUE;
CREATE INDEX IF NOT EXISTS cd_legal_predator_idx ON game.card_definitions (legal_in_predator) WHERE legal_in_predator = TRUE;
CREATE INDEX IF NOT EXISTS cd_legal_syndicate_idx ON game.card_definitions (legal_in_syndicate) WHERE legal_in_syndicate = TRUE;
CREATE INDEX IF NOT EXISTS cd_legal_phantom_idx ON game.card_definitions (legal_in_phantom) WHERE legal_in_phantom = TRUE;
CREATE INDEX IF NOT EXISTS cd_effects_gin_idx ON game.card_definitions USING GIN (effects_json);
SELECT create_updated_at_trigger('game', 'card_definitions');

-- 5.3 Card versions — immutable snapshots of card state per ruleset
CREATE TABLE IF NOT EXISTS game.card_versions (
    id                  INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    card_definition_id  INTEGER NOT NULL REFERENCES game.card_definitions(id) ON DELETE CASCADE,
    ruleset_version_id  INTEGER NOT NULL REFERENCES game.ruleset_versions(id) ON DELETE CASCADE,
    version             INTEGER NOT NULL DEFAULT 1,
    content_hash        VARCHAR(64) NOT NULL,
    diff_json           JSONB NOT NULL DEFAULT '{}'::jsonb,
    snapshot_json       JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    published_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT cv_version_positive CHECK (version > 0),
    CONSTRAINT cv_content_hash_format CHECK (char_length(btrim(content_hash)) = 64),
    CONSTRAINT cv_diff_is_object CHECK (jsonb_typeof(diff_json) = 'object'),
    CONSTRAINT cv_snapshot_is_object CHECK (jsonb_typeof(snapshot_json) = 'object'),
    CONSTRAINT cv_card_ruleset_version_unique UNIQUE (card_definition_id, ruleset_version_id, version)
);

CREATE INDEX IF NOT EXISTS cv_card_def_idx ON game.card_versions (card_definition_id);
CREATE INDEX IF NOT EXISTS cv_ruleset_idx ON game.card_versions (ruleset_version_id);
SELECT create_updated_at_trigger('game', 'card_versions');

-- 5.4 Deck definitions — named deck configurations
CREATE TABLE IF NOT EXISTS game.deck_definitions (
    id              INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    deck_key        VARCHAR(128) NOT NULL,
    name            VARCHAR(255) NOT NULL,
    game_mode       game_mode NOT NULL,
    ruleset_version_id INTEGER REFERENCES game.ruleset_versions(id) ON DELETE SET NULL,
    deck_types_legal deck_type[] NOT NULL DEFAULT ARRAY[]::deck_type[],
    config_json     JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT dd_deck_key_not_blank CHECK (char_length(btrim(deck_key)) > 0),
    CONSTRAINT dd_name_not_blank CHECK (char_length(btrim(name)) > 0),
    CONSTRAINT dd_config_is_object CHECK (jsonb_typeof(config_json) = 'object')
);

CREATE UNIQUE INDEX IF NOT EXISTS dd_deck_key_mode_uidx ON game.deck_definitions ((lower(btrim(deck_key))), game_mode);
CREATE INDEX IF NOT EXISTS dd_game_mode_idx ON game.deck_definitions (game_mode);
CREATE INDEX IF NOT EXISTS dd_deck_types_gin_idx ON game.deck_definitions USING GIN (deck_types_legal);
SELECT create_updated_at_trigger('game', 'deck_definitions');

-- 5.5 Deck compositions — which cards go in which decks
CREATE TABLE IF NOT EXISTS game.deck_compositions (
    id                  INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    deck_definition_id  INTEGER NOT NULL REFERENCES game.deck_definitions(id) ON DELETE CASCADE,
    card_definition_id  INTEGER NOT NULL REFERENCES game.card_definitions(id) ON DELETE CASCADE,
    quantity            INTEGER NOT NULL DEFAULT 1,
    weight              NUMERIC(8,4) NOT NULL DEFAULT 1.0,
    sort_order          INTEGER NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT dc_quantity_positive CHECK (quantity > 0),
    CONSTRAINT dc_weight_positive CHECK (weight > 0),
    CONSTRAINT dc_deck_card_unique UNIQUE (deck_definition_id, card_definition_id)
);

CREATE INDEX IF NOT EXISTS dc_deck_def_idx ON game.deck_compositions (deck_definition_id);
CREATE INDEX IF NOT EXISTS dc_card_def_idx ON game.deck_compositions (card_definition_id);

-- ============================================================================
-- 6. GAME SCHEMA — RUNS & ENGINE STATE
-- ============================================================================

-- 6.1 Runs — the central gameplay session
CREATE TABLE IF NOT EXISTS game.runs (
    id                  INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id          INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    match_id            INTEGER,  -- FK added after matches table
    seed                VARCHAR(255) NOT NULL,
    game_mode           game_mode NOT NULL,
    status              run_status NOT NULL DEFAULT 'IDLE',
    outcome             run_outcome,
    grade               run_grade,
    phase               run_phase NOT NULL DEFAULT 'FOUNDATION',
    visibility          run_visibility NOT NULL DEFAULT 'HIDDEN',
    verification        verification_status NOT NULL DEFAULT 'PENDING',
    pressure_tier       pressure_tier NOT NULL DEFAULT 'T1',
    is_quarantined      BOOLEAN NOT NULL DEFAULT FALSE,
    is_bleed_mode       BOOLEAN NOT NULL DEFAULT FALSE,
    -- Loadout (Empire exclusive)
    advantage_card_id   INTEGER REFERENCES game.card_definitions(id) ON DELETE SET NULL,
    handicap_key        VARCHAR(64),
    disabled_bots       bot_identity[] NOT NULL DEFAULT '{}',
    -- Role (Syndicate exclusive)
    team_role           team_role,
    -- CORD scoring
    cord_raw            NUMERIC(18,6) NOT NULL DEFAULT 0,
    cord_final          NUMERIC(18,6) NOT NULL DEFAULT 0,
    outcome_multiplier  NUMERIC(6,4) NOT NULL DEFAULT 1.0,
    mode_multiplier     NUMERIC(6,4) NOT NULL DEFAULT 1.0,
    proof_hash          VARCHAR(64),
    -- Financial state
    starting_cash_cents BIGINT NOT NULL DEFAULT 0,
    ending_cash_cents   BIGINT NOT NULL DEFAULT 0,
    peak_net_worth_cents BIGINT NOT NULL DEFAULT 0,
    freedom_threshold_cents BIGINT NOT NULL DEFAULT 10000000, -- $100,000 default
    -- Time tracking
    total_ticks         INTEGER NOT NULL DEFAULT 0,
    started_at          TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    quarantined_at      TIMESTAMPTZ,
    -- Aggregated JSON
    summary_json        JSONB NOT NULL DEFAULT '{}'::jsonb,
    score_json          JSONB NOT NULL DEFAULT '{}'::jsonb,
    loadout_json        JSONB NOT NULL DEFAULT '{}'::jsonb,
    engine_state_json   JSONB NOT NULL DEFAULT '{}'::jsonb,
    public_redaction_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT runs_seed_not_blank CHECK (char_length(btrim(seed)) > 0),
    CONSTRAINT runs_cord_raw_nonneg CHECK (cord_raw >= 0),
    CONSTRAINT runs_cord_final_nonneg CHECK (cord_final >= 0),
    CONSTRAINT runs_starting_cash_nonneg CHECK (starting_cash_cents >= 0),
    CONSTRAINT runs_peak_nw_nonneg CHECK (peak_net_worth_cents >= 0),
    CONSTRAINT runs_freedom_threshold_positive CHECK (freedom_threshold_cents > 0),
    CONSTRAINT runs_total_ticks_nonneg CHECK (total_ticks >= 0),
    CONSTRAINT runs_completed_after_started CHECK (completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at),
    CONSTRAINT runs_quarantined_requires_flag CHECK (quarantined_at IS NULL OR is_quarantined = TRUE),
    CONSTRAINT runs_proof_hash_format CHECK (proof_hash IS NULL OR char_length(btrim(proof_hash)) = 64),
    CONSTRAINT runs_summary_is_object CHECK (jsonb_typeof(summary_json) = 'object'),
    CONSTRAINT runs_score_is_object CHECK (jsonb_typeof(score_json) = 'object'),
    CONSTRAINT runs_loadout_is_object CHECK (jsonb_typeof(loadout_json) = 'object'),
    CONSTRAINT runs_engine_state_is_object CHECK (jsonb_typeof(engine_state_json) = 'object'),
    CONSTRAINT runs_redaction_is_object CHECK (jsonb_typeof(public_redaction_json) = 'object')
);

CREATE INDEX IF NOT EXISTS runs_user_id_idx ON game.runs (user_id);
CREATE INDEX IF NOT EXISTS runs_session_id_idx ON game.runs (session_id);
CREATE INDEX IF NOT EXISTS runs_match_id_idx ON game.runs (match_id) WHERE match_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS runs_game_mode_idx ON game.runs (game_mode);
CREATE INDEX IF NOT EXISTS runs_status_idx ON game.runs (status);
CREATE INDEX IF NOT EXISTS runs_outcome_idx ON game.runs (outcome) WHERE outcome IS NOT NULL;
CREATE INDEX IF NOT EXISTS runs_grade_idx ON game.runs (grade) WHERE grade IS NOT NULL;
CREATE INDEX IF NOT EXISTS runs_verification_idx ON game.runs (verification);
CREATE INDEX IF NOT EXISTS runs_is_quarantined_idx ON game.runs (is_quarantined) WHERE is_quarantined = TRUE;
CREATE INDEX IF NOT EXISTS runs_is_bleed_idx ON game.runs (is_bleed_mode) WHERE is_bleed_mode = TRUE;
CREATE INDEX IF NOT EXISTS runs_cord_final_idx ON game.runs (cord_final DESC);
CREATE INDEX IF NOT EXISTS runs_created_at_idx ON game.runs (created_at DESC);
CREATE INDEX IF NOT EXISTS runs_user_mode_idx ON game.runs (user_id, game_mode, created_at DESC);
CREATE INDEX IF NOT EXISTS runs_active_idx ON game.runs (status, game_mode) WHERE status IN ('RUNNING','LOADING','PAUSED');
SELECT create_updated_at_trigger('game', 'runs');

-- 6.2 Run turns — per-tick state snapshots
CREATE TABLE IF NOT EXISTS game.run_turns (
    id          BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    run_id      INTEGER NOT NULL REFERENCES game.runs(id) ON DELETE CASCADE,
    tick        INTEGER NOT NULL,
    phase       run_phase,
    pressure_tier pressure_tier,
    -- Snapshot at this tick
    cash_cents  BIGINT NOT NULL DEFAULT 0,
    net_worth_cents BIGINT NOT NULL DEFAULT 0,
    income_rate_cents BIGINT NOT NULL DEFAULT 0,
    expense_rate_cents BIGINT NOT NULL DEFAULT 0,
    -- Shield state
    shield_income_pct    NUMERIC(6,4) NOT NULL DEFAULT 100.0,
    shield_expense_pct   NUMERIC(6,4) NOT NULL DEFAULT 100.0,
    shield_liquidity_pct NUMERIC(6,4) NOT NULL DEFAULT 100.0,
    shield_credit_pct    NUMERIC(6,4) NOT NULL DEFAULT 100.0,
    -- Engine metrics
    state_json   JSONB NOT NULL DEFAULT '{}'::jsonb,
    metrics_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT rt_tick_nonneg CHECK (tick >= 0),
    CONSTRAINT rt_state_is_object CHECK (jsonb_typeof(state_json) = 'object'),
    CONSTRAINT rt_metrics_is_object CHECK (jsonb_typeof(metrics_json) = 'object'),
    CONSTRAINT rt_run_tick_unique UNIQUE (run_id, tick)
);

CREATE INDEX IF NOT EXISTS rt_run_id_idx ON game.run_turns (run_id);
CREATE INDEX IF NOT EXISTS rt_run_tick_idx ON game.run_turns (run_id, tick);
CREATE INDEX IF NOT EXISTS rt_phase_idx ON game.run_turns (phase) WHERE phase IS NOT NULL;

-- 6.3 Run events — every discrete event during a run
CREATE TABLE IF NOT EXISTS game.run_events (
    id              BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    run_id          INTEGER NOT NULL REFERENCES game.runs(id) ON DELETE CASCADE,
    tick            INTEGER NOT NULL,
    event_seq       INTEGER NOT NULL,
    event_name      VARCHAR(128) NOT NULL,
    source_engine   VARCHAR(64),
    payload_json    JSONB NOT NULL DEFAULT '{}'::jsonb,
    visibility      run_visibility NOT NULL DEFAULT 'HIDDEN',
    redaction_json  JSONB NOT NULL DEFAULT '{}'::jsonb,
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT re_event_seq_positive CHECK (event_seq > 0),
    CONSTRAINT re_event_name_not_blank CHECK (char_length(btrim(event_name)) > 0),
    CONSTRAINT re_payload_is_object CHECK (jsonb_typeof(payload_json) = 'object'),
    CONSTRAINT re_redaction_is_object CHECK (jsonb_typeof(redaction_json) = 'object'),
    CONSTRAINT re_run_event_seq_unique UNIQUE (run_id, event_seq)
);

CREATE INDEX IF NOT EXISTS re_run_id_idx ON game.run_events (run_id);
CREATE INDEX IF NOT EXISTS re_run_tick_idx ON game.run_events (run_id, tick);
CREATE INDEX IF NOT EXISTS re_event_name_idx ON game.run_events (event_name);
CREATE INDEX IF NOT EXISTS re_source_engine_idx ON game.run_events (source_engine) WHERE source_engine IS NOT NULL;
CREATE INDEX IF NOT EXISTS re_occurred_at_brin_idx ON game.run_events USING BRIN (occurred_at);
CREATE INDEX IF NOT EXISTS re_payload_gin_idx ON game.run_events USING GIN (payload_json);

-- 6.4 Run outcomes
CREATE TABLE IF NOT EXISTS game.run_outcomes (
    id          INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    run_id      INTEGER NOT NULL REFERENCES game.runs(id) ON DELETE CASCADE,
    outcome_key VARCHAR(128) NOT NULL,
    outcome_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_final    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ro_outcome_key_not_blank CHECK (char_length(btrim(outcome_key)) > 0),
    CONSTRAINT ro_outcome_is_object CHECK (jsonb_typeof(outcome_json) = 'object')
);

CREATE INDEX IF NOT EXISTS ro_run_id_idx ON game.run_outcomes (run_id);
CREATE INDEX IF NOT EXISTS ro_final_idx ON game.run_outcomes (run_id, is_final) WHERE is_final = TRUE;

-- 6.5 Run goals
CREATE TABLE IF NOT EXISTS game.run_goals (
    id          INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    run_id      INTEGER NOT NULL REFERENCES game.runs(id) ON DELETE CASCADE,
    goal_key    VARCHAR(128) NOT NULL,
    achieved    BOOLEAN NOT NULL DEFAULT FALSE,
    target_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    progress_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT rg_goal_key_not_blank CHECK (char_length(btrim(goal_key)) > 0),
    CONSTRAINT rg_target_is_object CHECK (jsonb_typeof(target_json) = 'object'),
    CONSTRAINT rg_progress_is_object CHECK (jsonb_typeof(progress_json) = 'object'),
    CONSTRAINT rg_run_goal_unique UNIQUE (run_id, goal_key)
);

CREATE INDEX IF NOT EXISTS rg_run_id_idx ON game.run_goals (run_id);
SELECT create_updated_at_trigger('game', 'run_goals');

-- 6.6 Run card plays — every card played during a run
CREATE TABLE IF NOT EXISTS game.run_card_plays (
    id                  BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    run_id              INTEGER NOT NULL REFERENCES game.runs(id) ON DELETE CASCADE,
    card_definition_id  INTEGER NOT NULL REFERENCES game.card_definitions(id) ON DELETE RESTRICT,
    tick                INTEGER NOT NULL,
    timing_used         timing_class NOT NULL,
    targeting_used      card_targeting NOT NULL,
    target_user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    cash_cost_cents     BIGINT NOT NULL DEFAULT 0,
    bb_cost             INTEGER NOT NULL DEFAULT 0,
    was_countered       BOOLEAN NOT NULL DEFAULT FALSE,
    was_bluff           BOOLEAN NOT NULL DEFAULT FALSE,
    result_json         JSONB NOT NULL DEFAULT '{}'::jsonb,
    played_at           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT rcp_tick_nonneg CHECK (tick >= 0),
    CONSTRAINT rcp_cash_cost_nonneg CHECK (cash_cost_cents >= 0),
    CONSTRAINT rcp_bb_cost_nonneg CHECK (bb_cost >= 0),
    CONSTRAINT rcp_result_is_object CHECK (jsonb_typeof(result_json) = 'object')
);

CREATE INDEX IF NOT EXISTS rcp_run_id_idx ON game.run_card_plays (run_id);
CREATE INDEX IF NOT EXISTS rcp_card_def_idx ON game.run_card_plays (card_definition_id);
CREATE INDEX IF NOT EXISTS rcp_run_tick_idx ON game.run_card_plays (run_id, tick);
CREATE INDEX IF NOT EXISTS rcp_timing_idx ON game.run_card_plays (timing_used);

-- 6.7 Hater bot states — per-run bot tracking
CREATE TABLE IF NOT EXISTS game.run_bot_states (
    id          BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    run_id      INTEGER NOT NULL REFERENCES game.runs(id) ON DELETE CASCADE,
    bot         bot_identity NOT NULL,
    tick        INTEGER NOT NULL,
    state       bot_state NOT NULL DEFAULT 'DORMANT',
    heat        INTEGER NOT NULL DEFAULT 0,
    target_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    cooldown_remaining INTEGER NOT NULL DEFAULT 0,
    state_json  JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT rbs_tick_nonneg CHECK (tick >= 0),
    CONSTRAINT rbs_heat_nonneg CHECK (heat >= 0),
    CONSTRAINT rbs_cooldown_nonneg CHECK (cooldown_remaining >= 0),
    CONSTRAINT rbs_state_is_object CHECK (jsonb_typeof(state_json) = 'object')
);

CREATE INDEX IF NOT EXISTS rbs_run_id_idx ON game.run_bot_states (run_id);
CREATE INDEX IF NOT EXISTS rbs_run_bot_tick_idx ON game.run_bot_states (run_id, bot, tick);
CREATE INDEX IF NOT EXISTS rbs_state_idx ON game.run_bot_states (state) WHERE state IN ('ACTIVE','ATTACKING','CRASH');

-- 6.8 Shield breach events
CREATE TABLE IF NOT EXISTS game.shield_breaches (
    id          BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    run_id      INTEGER NOT NULL REFERENCES game.runs(id) ON DELETE CASCADE,
    tick        INTEGER NOT NULL,
    layer       shield_layer NOT NULL,
    severity_pct NUMERIC(6,4) NOT NULL,
    source_bot  bot_identity,
    source_card_id INTEGER REFERENCES game.card_definitions(id) ON DELETE SET NULL,
    recovery_available BOOLEAN NOT NULL DEFAULT FALSE,
    recovered   BOOLEAN NOT NULL DEFAULT FALSE,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT sb_tick_nonneg CHECK (tick >= 0),
    CONSTRAINT sb_severity_range CHECK (severity_pct BETWEEN 0 AND 100)
);

CREATE INDEX IF NOT EXISTS sb_run_id_idx ON game.shield_breaches (run_id);
CREATE INDEX IF NOT EXISTS sb_run_tick_idx ON game.shield_breaches (run_id, tick);
CREATE INDEX IF NOT EXISTS sb_layer_idx ON game.shield_breaches (layer);

-- 6.9 Cascade chains
CREATE TABLE IF NOT EXISTS game.cascade_chains (
    id          BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    run_id      INTEGER NOT NULL REFERENCES game.runs(id) ON DELETE CASCADE,
    start_tick  INTEGER NOT NULL,
    end_tick    INTEGER,
    chain_length INTEGER NOT NULL DEFAULT 1,
    was_broken  BOOLEAN NOT NULL DEFAULT FALSE,
    was_absorbed BOOLEAN NOT NULL DEFAULT FALSE,
    absorbed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    damage_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT cc_start_tick_nonneg CHECK (start_tick >= 0),
    CONSTRAINT cc_chain_length_positive CHECK (chain_length >= 1),
    CONSTRAINT cc_damage_is_object CHECK (jsonb_typeof(damage_json) = 'object')
);

CREATE INDEX IF NOT EXISTS cc_run_id_idx ON game.cascade_chains (run_id);

-- 6.10 Pressure journal entries (Empire exclusive)
CREATE TABLE IF NOT EXISTS game.pressure_journal_entries (
    id          BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    run_id      INTEGER NOT NULL REFERENCES game.runs(id) ON DELETE CASCADE,
    tick        INTEGER NOT NULL,
    narrative   TEXT NOT NULL,
    context_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    ml_model    VARCHAR(64) NOT NULL DEFAULT 'M132',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pje_tick_nonneg CHECK (tick >= 0),
    CONSTRAINT pje_narrative_not_blank CHECK (char_length(btrim(narrative)) > 0),
    CONSTRAINT pje_context_is_object CHECK (jsonb_typeof(context_json) = 'object')
);

CREATE INDEX IF NOT EXISTS pje_run_id_idx ON game.pressure_journal_entries (run_id);
CREATE INDEX IF NOT EXISTS pje_run_tick_idx ON game.pressure_journal_entries (run_id, tick);

-- 6.11 Comeback surges (Empire exclusive)
CREATE TABLE IF NOT EXISTS game.comeback_surges (
    id          BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    run_id      INTEGER NOT NULL REFERENCES game.runs(id) ON DELETE CASCADE,
    trigger_tick INTEGER NOT NULL,
    recovery_tick INTEGER,
    cash_at_trigger_cents BIGINT NOT NULL,
    ticks_below_threshold INTEGER NOT NULL DEFAULT 0,
    cord_bonus  NUMERIC(6,4) NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT cs_trigger_tick_nonneg CHECK (trigger_tick >= 0),
    CONSTRAINT cs_ticks_below_positive CHECK (ticks_below_threshold >= 0)
);

CREATE INDEX IF NOT EXISTS cs_run_id_idx ON game.comeback_surges (run_id);

-- 6.12 Hold queue (Empire exclusive card staging)
CREATE TABLE IF NOT EXISTS game.hold_queue (
    id                  BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    run_id              INTEGER NOT NULL REFERENCES game.runs(id) ON DELETE CASCADE,
    card_definition_id  INTEGER NOT NULL REFERENCES game.card_definitions(id) ON DELETE CASCADE,
    staged_at_tick      INTEGER NOT NULL,
    released_at_tick    INTEGER,
    expired             BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT hq_staged_tick_nonneg CHECK (staged_at_tick >= 0)
);

CREATE INDEX IF NOT EXISTS hq_run_id_idx ON game.hold_queue (run_id);
CREATE INDEX IF NOT EXISTS hq_active_idx ON game.hold_queue (run_id) WHERE released_at_tick IS NULL AND expired = FALSE;

-- ============================================================================
-- 7. SOCIAL SCHEMA — MULTIPLAYER, MATCHES, RIVALRIES
-- ============================================================================

-- 7.1 Matches — multiplayer lobby container (Predator, Syndicate)
CREATE TABLE IF NOT EXISTS social.matches (
    id          INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    game_mode   game_mode NOT NULL,
    seed        VARCHAR(255) NOT NULL,
    status      match_status NOT NULL DEFAULT 'MATCHMAKING',
    max_players INTEGER NOT NULL DEFAULT 2,
    ruleset_version_id INTEGER REFERENCES game.ruleset_versions(id) ON DELETE SET NULL,
    match_config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    winner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    started_at  TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT m_seed_not_blank CHECK (char_length(btrim(seed)) > 0),
    CONSTRAINT m_max_players_range CHECK (max_players BETWEEN 2 AND 8),
    CONSTRAINT m_config_is_object CHECK (jsonb_typeof(match_config_json) = 'object'),
    CONSTRAINT m_game_mode_multiplayer CHECK (game_mode IN ('PREDATOR','SYNDICATE'))
);

CREATE INDEX IF NOT EXISTS m_status_idx ON social.matches (status);
CREATE INDEX IF NOT EXISTS m_game_mode_idx ON social.matches (game_mode);
CREATE INDEX IF NOT EXISTS m_active_idx ON social.matches (status) WHERE status IN ('MATCHMAKING','LOADING','LIVE');
CREATE INDEX IF NOT EXISTS m_created_at_idx ON social.matches (created_at DESC);
SELECT create_updated_at_trigger('social', 'matches');

-- Now add FK from runs to matches
ALTER TABLE game.runs ADD CONSTRAINT runs_match_id_fk FOREIGN KEY (match_id) REFERENCES social.matches(id) ON DELETE SET NULL;

-- 7.2 Match participants
CREATE TABLE IF NOT EXISTS social.match_participants (
    id          INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    match_id    INTEGER NOT NULL REFERENCES social.matches(id) ON DELETE CASCADE,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    run_id      INTEGER REFERENCES game.runs(id) ON DELETE SET NULL,
    slot        INTEGER NOT NULL,
    team_role   team_role,
    is_ready    BOOLEAN NOT NULL DEFAULT FALSE,
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT mp_slot_positive CHECK (slot >= 1),
    CONSTRAINT mp_match_user_unique UNIQUE (match_id, user_id),
    CONSTRAINT mp_match_slot_unique UNIQUE (match_id, slot)
);

CREATE INDEX IF NOT EXISTS mp_match_id_idx ON social.match_participants (match_id);
CREATE INDEX IF NOT EXISTS mp_user_id_idx ON social.match_participants (user_id);

-- 7.3 Battle budget state (Predator exclusive)
CREATE TABLE IF NOT EXISTS social.battle_budgets (
    id          BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    run_id      INTEGER NOT NULL REFERENCES game.runs(id) ON DELETE CASCADE,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tick        INTEGER NOT NULL,
    bb_current  INTEGER NOT NULL DEFAULT 200,
    bb_spent_total INTEGER NOT NULL DEFAULT 0,
    bb_earned_total INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT bb_current_range CHECK (bb_current BETWEEN 0 AND 200),
    CONSTRAINT bb_spent_nonneg CHECK (bb_spent_total >= 0),
    CONSTRAINT bb_earned_nonneg CHECK (bb_earned_total >= 0),
    CONSTRAINT bb_run_user_tick_unique UNIQUE (run_id, user_id, tick)
);

CREATE INDEX IF NOT EXISTS bb_run_id_idx ON social.battle_budgets (run_id);
CREATE INDEX IF NOT EXISTS bb_user_id_idx ON social.battle_budgets (user_id);

-- 7.4 Extraction actions (Predator exclusive)
CREATE TABLE IF NOT EXISTS social.extraction_actions (
    id              BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    match_id        INTEGER NOT NULL REFERENCES social.matches(id) ON DELETE CASCADE,
    attacker_run_id INTEGER NOT NULL REFERENCES game.runs(id) ON DELETE CASCADE,
    defender_run_id INTEGER NOT NULL REFERENCES game.runs(id) ON DELETE CASCADE,
    tick            INTEGER NOT NULL,
    card_definition_id INTEGER REFERENCES game.card_definitions(id) ON DELETE SET NULL,
    bb_cost         INTEGER NOT NULL DEFAULT 0,
    was_countered   BOOLEAN NOT NULL DEFAULT FALSE,
    counter_card_id INTEGER REFERENCES game.card_definitions(id) ON DELETE SET NULL,
    damage_json     JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ea_tick_nonneg CHECK (tick >= 0),
    CONSTRAINT ea_bb_cost_nonneg CHECK (bb_cost >= 0),
    CONSTRAINT ea_damage_is_object CHECK (jsonb_typeof(damage_json) = 'object')
);

CREATE INDEX IF NOT EXISTS ea_match_id_idx ON social.extraction_actions (match_id);
CREATE INDEX IF NOT EXISTS ea_attacker_idx ON social.extraction_actions (attacker_run_id);
CREATE INDEX IF NOT EXISTS ea_defender_idx ON social.extraction_actions (defender_run_id);

-- 7.5 Psyche meter snapshots (Predator exclusive)
CREATE TABLE IF NOT EXISTS social.psyche_meters (
    id          BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    match_id    INTEGER NOT NULL REFERENCES social.matches(id) ON DELETE CASCADE,
    target_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tick        INTEGER NOT NULL,
    shield_pressure    NUMERIC(6,4) NOT NULL DEFAULT 0,
    decision_speed_pct NUMERIC(6,4) NOT NULL DEFAULT 100,
    cascade_count      INTEGER NOT NULL DEFAULT 0,
    composite_score    NUMERIC(6,4) NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pm_tick_nonneg CHECK (tick >= 0)
);

CREATE INDEX IF NOT EXISTS pm_match_id_idx ON social.psyche_meters (match_id);
CREATE INDEX IF NOT EXISTS pm_match_user_tick_idx ON social.psyche_meters (match_id, target_user_id, tick);

-- 7.6 Rivalries (Predator persistent)
CREATE TABLE IF NOT EXISTS social.rivalries (
    id              INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    user_a_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_b_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tier            rivalry_tier NOT NULL DEFAULT 'RIVAL',
    total_matches   INTEGER NOT NULL DEFAULT 0,
    wins_a          INTEGER NOT NULL DEFAULT 0,
    wins_b          INTEGER NOT NULL DEFAULT 0,
    avg_cord_a      NUMERIC(18,6) NOT NULL DEFAULT 0,
    avg_cord_b      NUMERIC(18,6) NOT NULL DEFAULT 0,
    heat_bonus      INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT r_different_users CHECK (user_a_id < user_b_id),
    CONSTRAINT r_total_matches_nonneg CHECK (total_matches >= 0),
    CONSTRAINT r_wins_nonneg CHECK (wins_a >= 0 AND wins_b >= 0),
    CONSTRAINT r_heat_bonus_range CHECK (heat_bonus BETWEEN 0 AND 25),
    CONSTRAINT r_users_unique UNIQUE (user_a_id, user_b_id)
);

CREATE INDEX IF NOT EXISTS r_user_a_idx ON social.rivalries (user_a_id);
CREATE INDEX IF NOT EXISTS r_user_b_idx ON social.rivalries (user_b_id);
CREATE INDEX IF NOT EXISTS r_tier_idx ON social.rivalries (tier);
SELECT create_updated_at_trigger('social', 'rivalries');

-- 7.7 Spectator sessions
CREATE TABLE IF NOT EXISTS social.spectator_sessions (
    id          INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    match_id    INTEGER NOT NULL REFERENCES social.matches(id) ON DELETE CASCADE,
    user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    share_token VARCHAR(64) NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    left_at     TIMESTAMPTZ,
    CONSTRAINT ss_share_token_not_blank CHECK (char_length(btrim(share_token)) > 0)
);

CREATE INDEX IF NOT EXISTS ss_match_id_idx ON social.spectator_sessions (match_id);
CREATE INDEX IF NOT EXISTS ss_share_token_idx ON social.spectator_sessions (share_token);
CREATE INDEX IF NOT EXISTS ss_active_idx ON social.spectator_sessions (match_id, is_active) WHERE is_active = TRUE;

-- 7.8 Spectator prediction bets
CREATE TABLE IF NOT EXISTS social.spectator_bets (
    id              INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    spectator_session_id INTEGER NOT NULL REFERENCES social.spectator_sessions(id) ON DELETE CASCADE,
    predicted_winner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    bet_type        VARCHAR(64) NOT NULL DEFAULT 'winner',
    wager_shards    INTEGER NOT NULL DEFAULT 0,
    status          spectator_bet_status NOT NULL DEFAULT 'OPEN',
    payout_shards   INTEGER NOT NULL DEFAULT 0,
    placed_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at     TIMESTAMPTZ,
    CONSTRAINT sb_wager_nonneg CHECK (wager_shards >= 0),
    CONSTRAINT sb_payout_nonneg CHECK (payout_shards >= 0)
);

CREATE INDEX IF NOT EXISTS sb_session_idx ON social.spectator_bets (spectator_session_id);

-- 7.9 Shared treasury (Syndicate exclusive)
CREATE TABLE IF NOT EXISTS social.shared_treasuries (
    id          INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    match_id    INTEGER NOT NULL REFERENCES social.matches(id) ON DELETE CASCADE,
    balance_cents BIGINT NOT NULL DEFAULT 0,
    total_deposits_cents BIGINT NOT NULL DEFAULT 0,
    total_withdrawals_cents BIGINT NOT NULL DEFAULT 0,
    role_synergy_active BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT st_balance_nonneg CHECK (balance_cents >= 0),
    CONSTRAINT st_match_unique UNIQUE (match_id)
);

CREATE INDEX IF NOT EXISTS st_match_id_idx ON social.shared_treasuries (match_id);
SELECT create_updated_at_trigger('social', 'shared_treasuries');

-- 7.10 Treasury transactions (Syndicate)
CREATE TABLE IF NOT EXISTS social.treasury_transactions (
    id              BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    treasury_id     INTEGER NOT NULL REFERENCES social.shared_treasuries(id) ON DELETE CASCADE,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tick            INTEGER NOT NULL,
    amount_cents    BIGINT NOT NULL,
    direction       VARCHAR(10) NOT NULL,
    reason          VARCHAR(128) NOT NULL,
    balance_after_cents BIGINT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT tt_direction_valid CHECK (direction IN ('deposit','withdrawal')),
    CONSTRAINT tt_reason_not_blank CHECK (char_length(btrim(reason)) > 0)
);

CREATE INDEX IF NOT EXISTS tt_treasury_id_idx ON social.treasury_transactions (treasury_id);
CREATE INDEX IF NOT EXISTS tt_user_id_idx ON social.treasury_transactions (user_id);

-- 7.11 Trust scores (Syndicate exclusive)
CREATE TABLE IF NOT EXISTS social.trust_scores (
    id          INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    match_id    INTEGER NOT NULL REFERENCES social.matches(id) ON DELETE CASCADE,
    score       NUMERIC(8,4) NOT NULL DEFAULT 100.0,
    treasury_contribution_pct NUMERIC(6,4) NOT NULL DEFAULT 0,
    crisis_drain_index NUMERIC(6,4) NOT NULL DEFAULT 0,
    absorption_rate    NUMERIC(6,4) NOT NULL DEFAULT 0,
    decision_speed_impact NUMERIC(6,4) NOT NULL DEFAULT 0,
    defection_risk_pct NUMERIC(6,4) NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ts_user_match_unique UNIQUE (user_id, match_id)
);

CREATE INDEX IF NOT EXISTS ts_user_id_idx ON social.trust_scores (user_id);
CREATE INDEX IF NOT EXISTS ts_match_id_idx ON social.trust_scores (match_id);
SELECT create_updated_at_trigger('social', 'trust_scores');

-- 7.12 Defection events (Syndicate exclusive)
CREATE TABLE IF NOT EXISTS social.defection_events (
    id          BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    match_id    INTEGER NOT NULL REFERENCES social.matches(id) ON DELETE CASCADE,
    defector_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    defector_run_id  INTEGER NOT NULL REFERENCES game.runs(id) ON DELETE CASCADE,
    tick        INTEGER NOT NULL,
    treasury_stolen_cents BIGINT NOT NULL DEFAULT 0,
    cord_bonus_defector NUMERIC(6,4) NOT NULL DEFAULT 0,
    cord_penalty_team   NUMERIC(6,4) NOT NULL DEFAULT 0,
    defection_state_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT de_tick_nonneg CHECK (tick >= 0),
    CONSTRAINT de_stolen_nonneg CHECK (treasury_stolen_cents >= 0),
    CONSTRAINT de_state_is_object CHECK (jsonb_typeof(defection_state_json) = 'object')
);

CREATE INDEX IF NOT EXISTS de_match_id_idx ON social.defection_events (match_id);
CREATE INDEX IF NOT EXISTS de_defector_idx ON social.defection_events (defector_user_id);

-- 7.13 Alliance treasury loans (Syndicate exclusive)
CREATE TABLE IF NOT EXISTS social.treasury_loans (
    id              BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    match_id        INTEGER NOT NULL REFERENCES social.matches(id) ON DELETE CASCADE,
    borrower_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tick_borrowed   INTEGER NOT NULL,
    amount_cents    BIGINT NOT NULL,
    repaid_cents    BIGINT NOT NULL DEFAULT 0,
    interest_rate_bps INTEGER NOT NULL DEFAULT 500,
    is_defaulted    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT tl_amount_positive CHECK (amount_cents > 0),
    CONSTRAINT tl_repaid_nonneg CHECK (repaid_cents >= 0),
    CONSTRAINT tl_interest_nonneg CHECK (interest_rate_bps >= 0)
);

CREATE INDEX IF NOT EXISTS tl_match_id_idx ON social.treasury_loans (match_id);
CREATE INDEX IF NOT EXISTS tl_borrower_idx ON social.treasury_loans (borrower_user_id);

-- 7.14 Syndicates — alliance of teams
CREATE TABLE IF NOT EXISTS social.syndicates (
    id          INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    name        VARCHAR(128) NOT NULL,
    tag         VARCHAR(8) NOT NULL,
    leader_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    member_count INTEGER NOT NULL DEFAULT 1,
    total_cord  NUMERIC(18,6) NOT NULL DEFAULT 0,
    duel_wins   INTEGER NOT NULL DEFAULT 0,
    duel_losses INTEGER NOT NULL DEFAULT 0,
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT syn_name_not_blank CHECK (char_length(btrim(name)) > 0),
    CONSTRAINT syn_tag_not_blank CHECK (char_length(btrim(tag)) > 0),
    CONSTRAINT syn_member_count_positive CHECK (member_count >= 1),
    CONSTRAINT syn_metadata_is_object CHECK (jsonb_typeof(metadata_json) = 'object')
);

CREATE UNIQUE INDEX IF NOT EXISTS syn_name_uidx ON social.syndicates ((lower(btrim(name))));
CREATE UNIQUE INDEX IF NOT EXISTS syn_tag_uidx ON social.syndicates ((lower(btrim(tag))));
SELECT create_updated_at_trigger('social', 'syndicates');

-- 7.15 Syndicate members
CREATE TABLE IF NOT EXISTS social.syndicate_members (
    id              INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    syndicate_id    INTEGER NOT NULL REFERENCES social.syndicates(id) ON DELETE CASCADE,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role            VARCHAR(32) NOT NULL DEFAULT 'member',
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT sm_role_valid CHECK (role IN ('leader','officer','member')),
    CONSTRAINT sm_syndicate_user_unique UNIQUE (syndicate_id, user_id)
);

CREATE INDEX IF NOT EXISTS sm_syndicate_idx ON social.syndicate_members (syndicate_id);
CREATE INDEX IF NOT EXISTS sm_user_idx ON social.syndicate_members (user_id);

-- 7.16 Syndicate duels (every 48 hours)
CREATE TABLE IF NOT EXISTS social.syndicate_duels (
    id                  INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    syndicate_a_id      INTEGER NOT NULL REFERENCES social.syndicates(id) ON DELETE CASCADE,
    syndicate_b_id      INTEGER NOT NULL REFERENCES social.syndicates(id) ON DELETE CASCADE,
    status              match_status NOT NULL DEFAULT 'MATCHMAKING',
    winner_syndicate_id INTEGER REFERENCES social.syndicates(id) ON DELETE SET NULL,
    score_a             NUMERIC(18,6) NOT NULL DEFAULT 0,
    score_b             NUMERIC(18,6) NOT NULL DEFAULT 0,
    scheduled_at        TIMESTAMPTZ NOT NULL,
    started_at          TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    results_json        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT sd_different_syndicates CHECK (syndicate_a_id <> syndicate_b_id),
    CONSTRAINT sd_results_is_object CHECK (jsonb_typeof(results_json) = 'object')
);

CREATE INDEX IF NOT EXISTS sd_syndicate_a_idx ON social.syndicate_duels (syndicate_a_id);
CREATE INDEX IF NOT EXISTS sd_syndicate_b_idx ON social.syndicate_duels (syndicate_b_id);
CREATE INDEX IF NOT EXISTS sd_scheduled_idx ON social.syndicate_duels (scheduled_at);
CREATE INDEX IF NOT EXISTS sd_status_idx ON social.syndicate_duels (status);
SELECT create_updated_at_trigger('social', 'syndicate_duels');

-- 7.17 Ghost runs — Legend records (Phantom exclusive)
CREATE TABLE IF NOT EXISTS social.legend_runs (
    id              INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    source_run_id   INTEGER NOT NULL REFERENCES game.runs(id) ON DELETE RESTRICT,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game_mode       game_mode NOT NULL DEFAULT 'EMPIRE',
    cord_final      NUMERIC(18,6) NOT NULL,
    grade           run_grade NOT NULL,
    proof_hash      VARCHAR(64) NOT NULL,
    tick_stream_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    replay_checksum VARCHAR(64) NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    verified_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT lr_cord_positive CHECK (cord_final > 0),
    CONSTRAINT lr_proof_hash_format CHECK (char_length(btrim(proof_hash)) = 64),
    CONSTRAINT lr_replay_checksum_format CHECK (char_length(btrim(replay_checksum)) = 64),
    CONSTRAINT lr_tick_stream_is_array CHECK (jsonb_typeof(tick_stream_json) = 'array')
);

CREATE INDEX IF NOT EXISTS lr_user_id_idx ON social.legend_runs (user_id);
CREATE INDEX IF NOT EXISTS lr_cord_idx ON social.legend_runs (cord_final DESC);
CREATE INDEX IF NOT EXISTS lr_game_mode_idx ON social.legend_runs (game_mode);
CREATE INDEX IF NOT EXISTS lr_active_idx ON social.legend_runs (is_active) WHERE is_active = TRUE;

-- 7.18 Phantom chase sessions — ghost vs player state
CREATE TABLE IF NOT EXISTS social.phantom_chases (
    id              INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    chaser_run_id   INTEGER NOT NULL REFERENCES game.runs(id) ON DELETE CASCADE,
    legend_run_id   INTEGER NOT NULL REFERENCES social.legend_runs(id) ON DELETE RESTRICT,
    deviation_score NUMERIC(18,6) NOT NULL DEFAULT 0,
    shadow_pressure NUMERIC(6,4) NOT NULL DEFAULT 0,
    ghost_cord_at_current_tick NUMERIC(18,6) NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pc_chaser_unique UNIQUE (chaser_run_id)
);

CREATE INDEX IF NOT EXISTS pc_legend_idx ON social.phantom_chases (legend_run_id);
SELECT create_updated_at_trigger('social', 'phantom_chases');

-- ============================================================================
-- 8. ECONOMY SCHEMA — BILLING, PURCHASES, ENTITLEMENTS
-- ============================================================================

-- 8.1 Billing plans
CREATE TABLE IF NOT EXISTS economy.billing_plans (
    id          INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    code        VARCHAR(64) NOT NULL,
    name        VARCHAR(255) NOT NULL,
    price_cents BIGINT NOT NULL DEFAULT 0,
    currency    CHAR(3) NOT NULL DEFAULT 'USD',
    interval    billing_interval NOT NULL DEFAULT 'monthly',
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT bp_code_not_blank CHECK (char_length(btrim(code)) > 0),
    CONSTRAINT bp_name_not_blank CHECK (char_length(btrim(name)) > 0),
    CONSTRAINT bp_price_nonneg CHECK (price_cents >= 0),
    CONSTRAINT bp_metadata_is_object CHECK (jsonb_typeof(metadata_json) = 'object')
);

CREATE UNIQUE INDEX IF NOT EXISTS bp_code_uidx ON economy.billing_plans ((lower(btrim(code))));
SELECT create_updated_at_trigger('economy', 'billing_plans');

-- 8.2 Invoices
CREATE TABLE IF NOT EXISTS economy.invoices (
    id              INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    account_id      INTEGER NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    billing_plan_id INTEGER REFERENCES economy.billing_plans(id) ON DELETE SET NULL,
    invoice_number  VARCHAR(64) NOT NULL,
    status          invoice_status NOT NULL DEFAULT 'draft',
    currency        CHAR(3) NOT NULL DEFAULT 'USD',
    subtotal_cents  BIGINT NOT NULL DEFAULT 0,
    tax_cents       BIGINT NOT NULL DEFAULT 0,
    discount_cents  BIGINT NOT NULL DEFAULT 0,
    external_ref    VARCHAR(255),
    period_start    TIMESTAMPTZ,
    period_end      TIMESTAMPTZ,
    issued_at       TIMESTAMPTZ,
    due_at          TIMESTAMPTZ,
    paid_at         TIMESTAMPTZ,
    metadata_json   JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT inv_number_not_blank CHECK (char_length(btrim(invoice_number)) > 0),
    CONSTRAINT inv_subtotal_nonneg CHECK (subtotal_cents >= 0),
    CONSTRAINT inv_tax_nonneg CHECK (tax_cents >= 0),
    CONSTRAINT inv_discount_nonneg CHECK (discount_cents >= 0),
    CONSTRAINT inv_metadata_is_object CHECK (jsonb_typeof(metadata_json) = 'object')
);

CREATE UNIQUE INDEX IF NOT EXISTS inv_number_uidx ON economy.invoices ((lower(btrim(invoice_number))));
CREATE INDEX IF NOT EXISTS inv_account_idx ON economy.invoices (account_id);
CREATE INDEX IF NOT EXISTS inv_status_due_idx ON economy.invoices (status, due_at);
SELECT create_updated_at_trigger('economy', 'invoices');

-- 8.3 Invoice line items
CREATE TABLE IF NOT EXISTS economy.invoice_line_items (
    id              INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    invoice_id      INTEGER NOT NULL REFERENCES economy.invoices(id) ON DELETE CASCADE,
    line_number     INTEGER NOT NULL,
    sku             VARCHAR(128) NOT NULL,
    description     TEXT,
    quantity        INTEGER NOT NULL DEFAULT 1,
    unit_price_cents BIGINT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ili_line_positive CHECK (line_number > 0),
    CONSTRAINT ili_sku_not_blank CHECK (char_length(btrim(sku)) > 0),
    CONSTRAINT ili_quantity_positive CHECK (quantity > 0),
    CONSTRAINT ili_unit_price_nonneg CHECK (unit_price_cents >= 0),
    CONSTRAINT ili_invoice_line_unique UNIQUE (invoice_id, line_number)
);

CREATE INDEX IF NOT EXISTS ili_invoice_idx ON economy.invoice_line_items (invoice_id);

-- 8.4 SKUs
CREATE TABLE IF NOT EXISTS economy.skus (
    id          INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    sku_code    VARCHAR(128) NOT NULL,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    price_cents BIGINT NOT NULL DEFAULT 0,
    currency    CHAR(3) NOT NULL DEFAULT 'USD',
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT sku_code_not_blank CHECK (char_length(btrim(sku_code)) > 0),
    CONSTRAINT sku_name_not_blank CHECK (char_length(btrim(name)) > 0),
    CONSTRAINT sku_price_nonneg CHECK (price_cents >= 0),
    CONSTRAINT sku_metadata_is_object CHECK (jsonb_typeof(metadata_json) = 'object')
);

CREATE UNIQUE INDEX IF NOT EXISTS sku_code_uidx ON economy.skus ((lower(btrim(sku_code))));
SELECT create_updated_at_trigger('economy', 'skus');

-- 8.5 Purchases
CREATE TABLE IF NOT EXISTS economy.purchases (
    id              INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    account_id      INTEGER NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    sku_id          INTEGER NOT NULL REFERENCES economy.skus(id) ON DELETE RESTRICT,
    status          purchase_status NOT NULL DEFAULT 'PENDING',
    amount_cents    BIGINT NOT NULL,
    currency        CHAR(3) NOT NULL DEFAULT 'USD',
    provider        VARCHAR(64) NOT NULL DEFAULT 'stripe',
    provider_ref    VARCHAR(255),
    purchased_at    TIMESTAMPTZ,
    refunded_at     TIMESTAMPTZ,
    metadata_json   JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pu_amount_positive CHECK (amount_cents > 0),
    CONSTRAINT pu_metadata_is_object CHECK (jsonb_typeof(metadata_json) = 'object')
);

CREATE INDEX IF NOT EXISTS pu_account_idx ON economy.purchases (account_id);
CREATE INDEX IF NOT EXISTS pu_sku_idx ON economy.purchases (sku_id);
CREATE INDEX IF NOT EXISTS pu_status_idx ON economy.purchases (status);
CREATE INDEX IF NOT EXISTS pu_provider_ref_idx ON economy.purchases (provider_ref) WHERE provider_ref IS NOT NULL;
SELECT create_updated_at_trigger('economy', 'purchases');

-- 8.6 Entitlements
CREATE TABLE IF NOT EXISTS economy.entitlements (
    id              INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    account_id      INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    entitlement_key VARCHAR(128) NOT NULL,
    state           entitlement_state NOT NULL DEFAULT 'ACTIVE',
    source_purchase_id INTEGER REFERENCES economy.purchases(id) ON DELETE SET NULL,
    granted_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at      TIMESTAMPTZ,
    revoked_at      TIMESTAMPTZ,
    metadata_json   JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ent_key_not_blank CHECK (char_length(btrim(entitlement_key)) > 0),
    CONSTRAINT ent_metadata_is_object CHECK (jsonb_typeof(metadata_json) = 'object')
);

CREATE INDEX IF NOT EXISTS ent_account_idx ON economy.entitlements (account_id);
CREATE INDEX IF NOT EXISTS ent_key_idx ON economy.entitlements (entitlement_key);
CREATE INDEX IF NOT EXISTS ent_state_idx ON economy.entitlements (state);
CREATE INDEX IF NOT EXISTS ent_active_idx ON economy.entitlements (account_id, entitlement_key) WHERE state = 'ACTIVE';
SELECT create_updated_at_trigger('economy', 'entitlements');

-- 8.7 Cosmetic store
CREATE TABLE IF NOT EXISTS economy.cosmetic_store_items (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    price_cents INTEGER NOT NULL DEFAULT 0,
    currency    VARCHAR(8) NOT NULL DEFAULT 'CORD_SHARDS',
    image_url   VARCHAR(512) NOT NULL DEFAULT '',
    category    VARCHAR(64) NOT NULL DEFAULT 'badge',
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT csi_name_not_blank CHECK (char_length(btrim(name)) > 0),
    CONSTRAINT csi_price_nonneg CHECK (price_cents >= 0)
);

CREATE INDEX IF NOT EXISTS csi_category_idx ON economy.cosmetic_store_items (category);
CREATE INDEX IF NOT EXISTS csi_active_idx ON economy.cosmetic_store_items (is_active) WHERE is_active = TRUE;
SELECT create_updated_at_trigger('economy', 'cosmetic_store_items');

-- 8.8 Promo codes
CREATE TABLE IF NOT EXISTS economy.promo_codes (
    id              INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    code            VARCHAR(64) NOT NULL,
    discount_type   promo_discount_type NOT NULL,
    discount_value  BIGINT NOT NULL,
    max_uses        INTEGER,
    uses_count      INTEGER NOT NULL DEFAULT 0,
    valid_from      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    valid_until     TIMESTAMPTZ,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pc_code_not_blank CHECK (char_length(btrim(code)) > 0),
    CONSTRAINT pc_discount_positive CHECK (discount_value > 0),
    CONSTRAINT pc_uses_nonneg CHECK (uses_count >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS pc_code_uidx ON economy.promo_codes ((lower(btrim(code))));
SELECT create_updated_at_trigger('economy', 'promo_codes');

-- 8.9 Revenue share partners
CREATE TABLE IF NOT EXISTS economy.revshare_partners (
    id                  INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    account_id          INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    partner_account_id  INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    revenue_split_bps   INTEGER NOT NULL,
    status              VARCHAR(16) NOT NULL DEFAULT 'active',
    starts_at           TIMESTAMPTZ,
    ends_at             TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT rp_different CHECK (account_id <> partner_account_id),
    CONSTRAINT rp_split_range CHECK (revenue_split_bps BETWEEN 1 AND 10000),
    CONSTRAINT rp_status_valid CHECK (status IN ('active','paused','terminated')),
    CONSTRAINT rp_accounts_unique UNIQUE (account_id, partner_account_id)
);

CREATE INDEX IF NOT EXISTS rp_account_idx ON economy.revshare_partners (account_id);
CREATE INDEX IF NOT EXISTS rp_partner_idx ON economy.revshare_partners (partner_account_id);
SELECT create_updated_at_trigger('economy', 'revshare_partners');

-- ============================================================================
-- 9. ANALYTICS SCHEMA — SCORECARDS, LEADERBOARDS, TELEMETRY
-- ============================================================================

-- 9.1 Run scorecards
CREATE TABLE IF NOT EXISTS analytics.run_scorecards (
    run_id                  TEXT PRIMARY KEY,
    owner_id                VARCHAR(64),
    mode_code               game_mode NOT NULL,
    ruleset_version         TEXT,
    outcome                 run_outcome NOT NULL,
    grade                   run_grade NOT NULL,
    integrity_status        verification_status NOT NULL DEFAULT 'PENDING',
    proof_hash              VARCHAR(64),
    cord                    NUMERIC(18,6) NOT NULL DEFAULT 0,
    decision_speed_score    NUMERIC(12,4) NOT NULL DEFAULT 0,
    shields_maintained_pct  NUMERIC(12,4) NOT NULL DEFAULT 0,
    hater_sabotages_blocked INTEGER NOT NULL DEFAULT 0,
    cascade_chains_broken   INTEGER NOT NULL DEFAULT 0,
    pressure_survived_score NUMERIC(12,4) NOT NULL DEFAULT 0,
    flat_bonus_total        NUMERIC(12,4) NOT NULL DEFAULT 0,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT rsc_cord_nonneg CHECK (cord >= 0),
    CONSTRAINT rsc_decision_speed_nonneg CHECK (decision_speed_score >= 0),
    CONSTRAINT rsc_shields_nonneg CHECK (shields_maintained_pct >= 0),
    CONSTRAINT rsc_hater_nonneg CHECK (hater_sabotages_blocked >= 0),
    CONSTRAINT rsc_cascade_nonneg CHECK (cascade_chains_broken >= 0),
    CONSTRAINT rsc_pressure_nonneg CHECK (pressure_survived_score >= 0)
);

CREATE INDEX IF NOT EXISTS rsc_mode_idx ON analytics.run_scorecards (mode_code);
CREATE INDEX IF NOT EXISTS rsc_outcome_idx ON analytics.run_scorecards (outcome);
CREATE INDEX IF NOT EXISTS rsc_grade_idx ON analytics.run_scorecards (grade);
CREATE INDEX IF NOT EXISTS rsc_cord_idx ON analytics.run_scorecards (cord DESC);
CREATE INDEX IF NOT EXISTS rsc_integrity_idx ON analytics.run_scorecards (integrity_status);
SELECT create_updated_at_trigger('analytics', 'run_scorecards');

-- 9.2 Leaderboards (two-tier ladder system)
CREATE TABLE IF NOT EXISTS analytics.ladders (
    id          INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    name        VARCHAR(128) NOT NULL,
    game_mode   game_mode,
    tier        VARCHAR(16) NOT NULL DEFAULT 'global',
    window_start TIMESTAMPTZ NOT NULL,
    window_end   TIMESTAMPTZ NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT lad_name_not_blank CHECK (char_length(btrim(name)) > 0),
    CONSTRAINT lad_tier_valid CHECK (tier IN ('global','mode','syndicate','b2b')),
    CONSTRAINT lad_window_valid CHECK (window_end > window_start),
    CONSTRAINT lad_config_is_object CHECK (jsonb_typeof(config_json) = 'object')
);

CREATE INDEX IF NOT EXISTS lad_active_idx ON analytics.ladders (is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS lad_mode_idx ON analytics.ladders (game_mode) WHERE game_mode IS NOT NULL;
CREATE INDEX IF NOT EXISTS lad_window_idx ON analytics.ladders (window_start, window_end);
SELECT create_updated_at_trigger('analytics', 'ladders');

-- 9.3 Ladder entries
CREATE TABLE IF NOT EXISTS analytics.ladder_entries (
    id          BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    ladder_id   INTEGER NOT NULL REFERENCES analytics.ladders(id) ON DELETE CASCADE,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    run_id      INTEGER REFERENCES game.runs(id) ON DELETE SET NULL,
    rank        INTEGER NOT NULL,
    cord        NUMERIC(18,6) NOT NULL DEFAULT 0,
    grade       run_grade,
    proof_hash  VARCHAR(64),
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    is_suppressed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT le_rank_positive CHECK (rank >= 1),
    CONSTRAINT le_cord_nonneg CHECK (cord >= 0),
    CONSTRAINT le_ladder_user_unique UNIQUE (ladder_id, user_id)
);

CREATE INDEX IF NOT EXISTS le_ladder_idx ON analytics.ladder_entries (ladder_id);
CREATE INDEX IF NOT EXISTS le_user_idx ON analytics.ladder_entries (user_id);
CREATE INDEX IF NOT EXISTS le_rank_idx ON analytics.ladder_entries (ladder_id, rank);
CREATE INDEX IF NOT EXISTS le_cord_idx ON analytics.ladder_entries (ladder_id, cord DESC);
CREATE INDEX IF NOT EXISTS le_verified_idx ON analytics.ladder_entries (is_verified) WHERE is_verified = TRUE;
SELECT create_updated_at_trigger('analytics', 'ladder_entries');

-- 9.4 Telemetry raw
CREATE TABLE IF NOT EXISTS analytics.telemetry_raw (
    id              BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    event_type      VARCHAR(128) NOT NULL,
    user_id         INTEGER,
    session_id      INTEGER,
    run_id          INTEGER,
    payload_json    JSONB NOT NULL DEFAULT '{}'::jsonb,
    client_ts       TIMESTAMPTZ,
    server_ts       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT tr_event_type_not_blank CHECK (char_length(btrim(event_type)) > 0),
    CONSTRAINT tr_payload_is_object CHECK (jsonb_typeof(payload_json) = 'object')
);

CREATE INDEX IF NOT EXISTS tr_event_type_idx ON analytics.telemetry_raw (event_type);
CREATE INDEX IF NOT EXISTS tr_user_id_idx ON analytics.telemetry_raw (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS tr_run_id_idx ON analytics.telemetry_raw (run_id) WHERE run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS tr_server_ts_brin_idx ON analytics.telemetry_raw USING BRIN (server_ts);
CREATE INDEX IF NOT EXISTS tr_payload_gin_idx ON analytics.telemetry_raw USING GIN (payload_json);

-- 9.5 Metric rollups
CREATE TABLE IF NOT EXISTS analytics.metric_rollups (
    id              BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    metric_name     VARCHAR(128) NOT NULL,
    dimension_key   VARCHAR(128) NOT NULL DEFAULT 'global',
    dimension_value VARCHAR(255) NOT NULL DEFAULT '',
    window_start    TIMESTAMPTZ NOT NULL,
    window_end      TIMESTAMPTZ NOT NULL,
    count           BIGINT NOT NULL DEFAULT 0,
    sum_value       NUMERIC(18,6) NOT NULL DEFAULT 0,
    min_value       NUMERIC(18,6),
    max_value       NUMERIC(18,6),
    avg_value       NUMERIC(18,6),
    p50_value       NUMERIC(18,6),
    p95_value       NUMERIC(18,6),
    p99_value       NUMERIC(18,6),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT mr_metric_not_blank CHECK (char_length(btrim(metric_name)) > 0),
    CONSTRAINT mr_window_valid CHECK (window_end > window_start),
    CONSTRAINT mr_count_nonneg CHECK (count >= 0)
);

CREATE INDEX IF NOT EXISTS mr_metric_window_idx ON analytics.metric_rollups (metric_name, window_start, window_end);
CREATE INDEX IF NOT EXISTS mr_dimension_idx ON analytics.metric_rollups (dimension_key, dimension_value);
CREATE INDEX IF NOT EXISTS mr_window_brin_idx ON analytics.metric_rollups USING BRIN (window_start);

-- ============================================================================
-- 10. SHARE ARTIFACTS, CASE FILES, PROOF CARDS
-- ============================================================================

CREATE TABLE IF NOT EXISTS game.share_artifacts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id          INTEGER NOT NULL REFERENCES game.runs(id) ON DELETE CASCADE,
    owner_user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind            share_artifact_kind NOT NULL,
    status          share_artifact_status NOT NULL DEFAULT 'PENDING',
    audience        share_audience NOT NULL DEFAULT 'PRIVATE',
    content_hash    VARCHAR(64),
    asset_url       VARCHAR(512),
    proof_hash      VARCHAR(64),
    metadata_json   JSONB NOT NULL DEFAULT '{}'::jsonb,
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT sa_metadata_is_object CHECK (jsonb_typeof(metadata_json) = 'object')
);

CREATE INDEX IF NOT EXISTS sa_run_idx ON game.share_artifacts (run_id);
CREATE INDEX IF NOT EXISTS sa_owner_idx ON game.share_artifacts (owner_user_id);
CREATE INDEX IF NOT EXISTS sa_kind_idx ON game.share_artifacts (kind);
CREATE INDEX IF NOT EXISTS sa_status_idx ON game.share_artifacts (status);
CREATE INDEX IF NOT EXISTS sa_audience_idx ON game.share_artifacts (audience) WHERE audience IN ('UNLISTED','PUBLIC');
SELECT create_updated_at_trigger('game', 'share_artifacts');

-- Case file (ML-generated autopsy — Empire exclusive)
CREATE TABLE IF NOT EXISTS game.case_files (
    id              INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    run_id          INTEGER NOT NULL REFERENCES game.runs(id) ON DELETE CASCADE,
    root_cause_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    decision_speed_timeline_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    shield_breach_timeline_json  JSONB NOT NULL DEFAULT '[]'::jsonb,
    bot_performance_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    alternate_timelines_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    ml_model        VARCHAR(64) NOT NULL DEFAULT 'M132',
    ml_confidence   NUMERIC(6,4),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT cf_root_cause_is_array CHECK (jsonb_typeof(root_cause_json) = 'array'),
    CONSTRAINT cf_decision_speed_is_array CHECK (jsonb_typeof(decision_speed_timeline_json) = 'array'),
    CONSTRAINT cf_shield_breach_is_array CHECK (jsonb_typeof(shield_breach_timeline_json) = 'array'),
    CONSTRAINT cf_bot_performance_is_object CHECK (jsonb_typeof(bot_performance_json) = 'object'),
    CONSTRAINT cf_alternate_is_array CHECK (jsonb_typeof(alternate_timelines_json) = 'array'),
    CONSTRAINT cf_run_unique UNIQUE (run_id)
);

CREATE INDEX IF NOT EXISTS cf_run_idx ON game.case_files (run_id);

-- ============================================================================
-- 11. MACRO SHOCK SYSTEM
-- ============================================================================

CREATE TABLE IF NOT EXISTS game.macro_events (
    id              BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    event_key       VARCHAR(128) NOT NULL,
    source          macro_event_source NOT NULL,
    state           macro_event_state NOT NULL DEFAULT 'SCHEDULED',
    severity        alert_severity NOT NULL DEFAULT 'warning',
    broadcast_audience shock_broadcast_audience NOT NULL DEFAULT 'GLOBAL',
    target_run_id   INTEGER REFERENCES game.runs(id) ON DELETE SET NULL,
    target_user_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
    payload_json    JSONB NOT NULL DEFAULT '{}'::jsonb,
    scheduled_at    TIMESTAMPTZ,
    triggered_at    TIMESTAMPTZ,
    resolved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT me_event_key_not_blank CHECK (char_length(btrim(event_key)) > 0),
    CONSTRAINT me_payload_is_object CHECK (jsonb_typeof(payload_json) = 'object')
);

CREATE INDEX IF NOT EXISTS me_state_idx ON game.macro_events (state);
CREATE INDEX IF NOT EXISTS me_source_idx ON game.macro_events (source);
CREATE INDEX IF NOT EXISTS me_scheduled_idx ON game.macro_events (scheduled_at) WHERE state = 'SCHEDULED';
CREATE INDEX IF NOT EXISTS me_run_idx ON game.macro_events (target_run_id) WHERE target_run_id IS NOT NULL;
SELECT create_updated_at_trigger('game', 'macro_events');

-- ============================================================================
-- 12. CARD FORGE / UGC
-- ============================================================================

CREATE TABLE IF NOT EXISTS game.card_forge_submissions (
    id                  BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    author_account_id   INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    source_card_def_id  INTEGER REFERENCES game.card_definitions(id) ON DELETE SET NULL,
    ruleset_version_id  INTEGER REFERENCES game.ruleset_versions(id) ON DELETE SET NULL,
    submission_slug     VARCHAR(128) NOT NULL,
    candidate_name      VARCHAR(255) NOT NULL,
    content_hash        VARCHAR(64) NOT NULL,
    submission_json     JSONB NOT NULL DEFAULT '{}'::jsonb,
    state               card_forge_submission_state NOT NULL DEFAULT 'DRAFT',
    submitted_at        TIMESTAMPTZ,
    reviewed_at         TIMESTAMPTZ,
    minted_at           TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT cfs_slug_not_blank CHECK (char_length(btrim(submission_slug)) > 0),
    CONSTRAINT cfs_name_not_blank CHECK (char_length(btrim(candidate_name)) > 0),
    CONSTRAINT cfs_hash_format CHECK (char_length(btrim(content_hash)) = 64),
    CONSTRAINT cfs_json_is_object CHECK (jsonb_typeof(submission_json) = 'object')
);

CREATE INDEX IF NOT EXISTS cfs_author_idx ON game.card_forge_submissions (author_account_id);
CREATE INDEX IF NOT EXISTS cfs_state_idx ON game.card_forge_submissions (state);
CREATE UNIQUE INDEX IF NOT EXISTS cfs_slug_uidx ON game.card_forge_submissions ((lower(btrim(submission_slug))));
SELECT create_updated_at_trigger('game', 'card_forge_submissions');

-- ============================================================================
-- 13. GENERATIONAL / BLOODLINES
-- ============================================================================

CREATE TABLE IF NOT EXISTS game.bloodlines (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    line_key            TEXT NOT NULL,
    current_generation  INTEGER NOT NULL DEFAULT 1,
    status              bloodline_status NOT NULL DEFAULT 'active',
    source_run_id       INTEGER REFERENCES game.runs(id) ON DELETE SET NULL,
    lineage_seed        TEXT,
    bloodline_json      JSONB NOT NULL DEFAULT '{}'::jsonb,
    inherited_state_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT bl_user_unique UNIQUE (user_id),
    CONSTRAINT bl_line_key_unique UNIQUE (line_key),
    CONSTRAINT bl_generation_positive CHECK (current_generation >= 1),
    CONSTRAINT bl_bloodline_is_object CHECK (jsonb_typeof(bloodline_json) = 'object'),
    CONSTRAINT bl_inherited_is_object CHECK (jsonb_typeof(inherited_state_json) = 'object')
);

CREATE INDEX IF NOT EXISTS bl_user_idx ON game.bloodlines (user_id);
CREATE INDEX IF NOT EXISTS bl_status_idx ON game.bloodlines (status);
SELECT create_updated_at_trigger('game', 'bloodlines');

CREATE TABLE IF NOT EXISTS game.generation_events (
    id              BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    bloodline_id    UUID NOT NULL REFERENCES game.bloodlines(id) ON DELETE CASCADE,
    generation      INTEGER NOT NULL,
    run_id          INTEGER REFERENCES game.runs(id) ON DELETE SET NULL,
    outcome         generation_event_outcome NOT NULL,
    inheritance_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ge_generation_positive CHECK (generation >= 1),
    CONSTRAINT ge_inheritance_is_object CHECK (jsonb_typeof(inheritance_json) = 'object')
);

CREATE INDEX IF NOT EXISTS ge_bloodline_idx ON game.generation_events (bloodline_id);

-- ============================================================================
-- 14. FORENSIC AUTOPSY (DECISION TREES & COUNTERFACTUALS)
-- ============================================================================

CREATE TABLE IF NOT EXISTS game.decision_trees (
    run_id      INTEGER PRIMARY KEY REFERENCES game.runs(id) ON DELETE CASCADE,
    forks_json  JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT dt_forks_is_array CHECK (jsonb_typeof(forks_json) = 'array')
);

CREATE TABLE IF NOT EXISTS game.counterfactual_results (
    run_id              INTEGER NOT NULL REFERENCES game.decision_trees(run_id) ON DELETE CASCADE,
    fork_tick           INTEGER NOT NULL,
    alternate_choice_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    alternate_outcome_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    PRIMARY KEY (run_id, fork_tick),
    CONSTRAINT cfr_choice_is_object CHECK (jsonb_typeof(alternate_choice_json) = 'object'),
    CONSTRAINT cfr_outcome_is_object CHECK (jsonb_typeof(alternate_outcome_json) = 'object')
);

-- ============================================================================
-- 15. NOTIFICATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS notification_preferences (
    id              INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    push_enabled    BOOLEAN NOT NULL DEFAULT FALSE,
    email_enabled   BOOLEAN NOT NULL DEFAULT FALSE,
    sms_enabled     BOOLEAN NOT NULL DEFAULT FALSE,
    marketing_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    digest_enabled  BOOLEAN NOT NULL DEFAULT FALSE,
    quiet_hours_tz  VARCHAR(64),
    do_not_disturb_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    channel_overrides_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT np_user_unique UNIQUE (user_id),
    CONSTRAINT np_dnd_is_array CHECK (jsonb_typeof(do_not_disturb_json) = 'array'),
    CONSTRAINT np_overrides_is_object CHECK (jsonb_typeof(channel_overrides_json) = 'object')
);

SELECT create_updated_at_trigger('public', 'notification_preferences');

CREATE TABLE IF NOT EXISTS notification_log (
    id              BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel         notification_channel NOT NULL,
    status          notification_delivery_status NOT NULL DEFAULT 'queued',
    template_key    VARCHAR(128) NOT NULL,
    subject         TEXT,
    body_preview    TEXT,
    provider_ref    VARCHAR(255),
    sent_at         TIMESTAMPTZ,
    delivered_at    TIMESTAMPTZ,
    read_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT nl_template_not_blank CHECK (char_length(btrim(template_key)) > 0)
);

CREATE INDEX IF NOT EXISTS nl_user_idx ON notification_log (user_id);
CREATE INDEX IF NOT EXISTS nl_status_idx ON notification_log (status);
CREATE INDEX IF NOT EXISTS nl_created_at_brin_idx ON notification_log USING BRIN (created_at);

-- ============================================================================
-- 16. B2B / INSTITUTIONAL TENANCY
-- ============================================================================

CREATE TABLE IF NOT EXISTS b2b.tenants (
    id          INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    slug        VARCHAR(128) NOT NULL,
    status      b2b_tenant_status NOT NULL DEFAULT 'trial',
    industry    VARCHAR(128),
    contact_email VARCHAR(255),
    seat_limit  INTEGER NOT NULL DEFAULT 50,
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT t_name_not_blank CHECK (char_length(btrim(name)) > 0),
    CONSTRAINT t_slug_not_blank CHECK (char_length(btrim(slug)) > 0),
    CONSTRAINT t_seat_limit_positive CHECK (seat_limit > 0),
    CONSTRAINT t_metadata_is_object CHECK (jsonb_typeof(metadata_json) = 'object')
);

CREATE UNIQUE INDEX IF NOT EXISTS t_slug_uidx ON b2b.tenants ((lower(btrim(slug))));
SELECT create_updated_at_trigger('b2b', 'tenants');

CREATE TABLE IF NOT EXISTS b2b.tenant_seats (
    id          INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    tenant_id   INTEGER NOT NULL REFERENCES b2b.tenants(id) ON DELETE CASCADE,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        VARCHAR(32) NOT NULL DEFAULT 'learner',
    status      tenant_seat_status NOT NULL DEFAULT 'invited',
    invited_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    activated_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ts_role_valid CHECK (role IN ('admin','facilitator','learner')),
    CONSTRAINT ts_tenant_user_unique UNIQUE (tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS ts_tenant_idx ON b2b.tenant_seats (tenant_id);
CREATE INDEX IF NOT EXISTS ts_user_idx ON b2b.tenant_seats (user_id);
SELECT create_updated_at_trigger('b2b', 'tenant_seats');

CREATE TABLE IF NOT EXISTS b2b.cohorts (
    id          INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    tenant_id   INTEGER NOT NULL REFERENCES b2b.tenants(id) ON DELETE CASCADE,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    starts_at   TIMESTAMPTZ,
    ends_at     TIMESTAMPTZ,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT co_name_not_blank CHECK (char_length(btrim(name)) > 0),
    CONSTRAINT co_config_is_object CHECK (jsonb_typeof(config_json) = 'object')
);

CREATE INDEX IF NOT EXISTS co_tenant_idx ON b2b.cohorts (tenant_id);
CREATE INDEX IF NOT EXISTS co_active_idx ON b2b.cohorts (is_active) WHERE is_active = TRUE;
SELECT create_updated_at_trigger('b2b', 'cohorts');

CREATE TABLE IF NOT EXISTS b2b.cohort_members (
    id          INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    cohort_id   INTEGER NOT NULL REFERENCES b2b.cohorts(id) ON DELETE CASCADE,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT cm_cohort_user_unique UNIQUE (cohort_id, user_id)
);

CREATE INDEX IF NOT EXISTS cm_cohort_idx ON b2b.cohort_members (cohort_id);
CREATE INDEX IF NOT EXISTS cm_user_idx ON b2b.cohort_members (user_id);

-- ============================================================================
-- 17. SEASON 0 / FOUNDING ERA
-- ============================================================================

CREATE TABLE IF NOT EXISTS seasons (
    id          INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    season_key  VARCHAR(32) NOT NULL,
    name        VARCHAR(128) NOT NULL,
    starts_at   TIMESTAMPTZ NOT NULL,
    ends_at     TIMESTAMPTZ NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT FALSE,
    config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT se_key_not_blank CHECK (char_length(btrim(season_key)) > 0),
    CONSTRAINT se_window_valid CHECK (ends_at > starts_at),
    CONSTRAINT se_config_is_object CHECK (jsonb_typeof(config_json) = 'object')
);

CREATE UNIQUE INDEX IF NOT EXISTS se_key_uidx ON seasons ((lower(btrim(season_key))));
SELECT create_updated_at_trigger('public', 'seasons');

CREATE TABLE IF NOT EXISTS season_memberships (
    id              INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    season_id       INTEGER NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tier            VARCHAR(32) NOT NULL DEFAULT 'founding',
    founding_pass_id VARCHAR(64),
    streak_current  INTEGER NOT NULL DEFAULT 0,
    streak_longest  INTEGER NOT NULL DEFAULT 0,
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT sm2_tier_not_blank CHECK (char_length(btrim(tier)) > 0),
    CONSTRAINT sm2_streak_nonneg CHECK (streak_current >= 0 AND streak_longest >= 0),
    CONSTRAINT sm2_season_user_unique UNIQUE (season_id, user_id)
);

CREATE INDEX IF NOT EXISTS sm2_season_idx ON season_memberships (season_id);
CREATE INDEX IF NOT EXISTS sm2_user_idx ON season_memberships (user_id);
SELECT create_updated_at_trigger('public', 'season_memberships');

-- ============================================================================
-- 18. REFERRALS & ABUSE PREVENTION
-- ============================================================================

CREATE TABLE IF NOT EXISTS referral_codes (
    id          INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    owner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code        VARCHAR(64) NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    max_uses    INTEGER,
    uses_count  INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT rc_code_not_blank CHECK (char_length(btrim(code)) > 0),
    CONSTRAINT rc_uses_nonneg CHECK (uses_count >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS rc_code_uidx ON referral_codes ((lower(btrim(code))));
CREATE INDEX IF NOT EXISTS rc_owner_idx ON referral_codes (owner_user_id);
SELECT create_updated_at_trigger('public', 'referral_codes');

CREATE TABLE IF NOT EXISTS referral_completions (
    id                  INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    referral_code_id    INTEGER NOT NULL REFERENCES referral_codes(id) ON DELETE CASCADE,
    referred_user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reward_granted      BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT rco_code_user_unique UNIQUE (referral_code_id, referred_user_id)
);

CREATE INDEX IF NOT EXISTS rco_code_idx ON referral_completions (referral_code_id);
CREATE INDEX IF NOT EXISTS rco_user_idx ON referral_completions (referred_user_id);

-- ============================================================================
-- 19. CONTENT VERSIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS game.content_versions (
    id                  BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    content_type        VARCHAR(64) NOT NULL,
    content_key         VARCHAR(255) NOT NULL,
    version             INTEGER NOT NULL DEFAULT 1,
    ruleset_version_id  INTEGER REFERENCES game.ruleset_versions(id) ON DELETE SET NULL,
    content_json        JSONB NOT NULL DEFAULT '{}'::jsonb,
    content_hash        VARCHAR(64) NOT NULL,
    status              content_lifecycle_status NOT NULL DEFAULT 'DRAFT',
    published_by        VARCHAR(255),
    published_at        TIMESTAMPTZ,
    retired_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT cv2_type_not_blank CHECK (char_length(btrim(content_type)) > 0),
    CONSTRAINT cv2_key_not_blank CHECK (char_length(btrim(content_key)) > 0),
    CONSTRAINT cv2_version_positive CHECK (version > 0),
    CONSTRAINT cv2_hash_format CHECK (char_length(btrim(content_hash)) = 64),
    CONSTRAINT cv2_json_is_object CHECK (jsonb_typeof(content_json) = 'object'),
    CONSTRAINT cv2_type_key_version_unique UNIQUE (content_type, content_key, version)
);

CREATE INDEX IF NOT EXISTS cv2_type_key_idx ON game.content_versions (content_type, content_key);
CREATE INDEX IF NOT EXISTS cv2_status_idx ON game.content_versions (status);
CREATE INDEX IF NOT EXISTS cv2_ruleset_idx ON game.content_versions (ruleset_version_id) WHERE ruleset_version_id IS NOT NULL;
SELECT create_updated_at_trigger('game', 'content_versions');

-- ============================================================================
-- 20. ALERTS & LIVEOPS
-- ============================================================================

CREATE TABLE IF NOT EXISTS game.alerts (
    id              BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    alert_key       VARCHAR(128) NOT NULL,
    severity        alert_severity NOT NULL DEFAULT 'info',
    state           alert_firing_state NOT NULL DEFAULT 'pending',
    title           TEXT NOT NULL,
    description     TEXT,
    source          VARCHAR(64) NOT NULL DEFAULT 'system',
    target_json     JSONB NOT NULL DEFAULT '{}'::jsonb,
    fired_at        TIMESTAMPTZ,
    resolved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT al_key_not_blank CHECK (char_length(btrim(alert_key)) > 0),
    CONSTRAINT al_target_is_object CHECK (jsonb_typeof(target_json) = 'object')
);

CREATE INDEX IF NOT EXISTS al_state_idx ON game.alerts (state);
CREATE INDEX IF NOT EXISTS al_severity_idx ON game.alerts (severity);
CREATE INDEX IF NOT EXISTS al_fired_at_idx ON game.alerts (fired_at) WHERE fired_at IS NOT NULL;
SELECT create_updated_at_trigger('game', 'alerts');

CREATE TABLE IF NOT EXISTS game.liveops_board (
    id              INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    title           VARCHAR(255) NOT NULL,
    body            TEXT,
    category        VARCHAR(64) NOT NULL DEFAULT 'announcement',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    priority        INTEGER NOT NULL DEFAULT 0,
    starts_at       TIMESTAMPTZ,
    ends_at         TIMESTAMPTZ,
    metadata_json   JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT lb_title_not_blank CHECK (char_length(btrim(title)) > 0),
    CONSTRAINT lb_metadata_is_object CHECK (jsonb_typeof(metadata_json) = 'object')
);

CREATE INDEX IF NOT EXISTS lb_active_idx ON game.liveops_board (is_active, priority DESC) WHERE is_active = TRUE;
SELECT create_updated_at_trigger('game', 'liveops_board');

-- ============================================================================
-- 21. RUN APPEALS & VERIFICATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS game.run_appeals (
    id          INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    run_id      INTEGER NOT NULL REFERENCES game.runs(id) ON DELETE CASCADE,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason      TEXT NOT NULL,
    status      VARCHAR(16) NOT NULL DEFAULT 'open',
    reviewer_notes TEXT,
    resolved_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ra_reason_not_blank CHECK (char_length(btrim(reason)) > 0),
    CONSTRAINT ra_status_valid CHECK (status IN ('open','under_review','approved','denied','escalated'))
);

CREATE INDEX IF NOT EXISTS ra_run_idx ON game.run_appeals (run_id);
CREATE INDEX IF NOT EXISTS ra_user_idx ON game.run_appeals (user_id);
CREATE INDEX IF NOT EXISTS ra_status_idx ON game.run_appeals (status) WHERE status IN ('open','under_review');
SELECT create_updated_at_trigger('game', 'run_appeals');

CREATE TABLE IF NOT EXISTS game.verification_reports (
    id              INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    run_id          INTEGER NOT NULL REFERENCES game.runs(id) ON DELETE CASCADE,
    verification    verification_status NOT NULL,
    proof_hash      VARCHAR(64),
    deterministic_check BOOLEAN NOT NULL DEFAULT FALSE,
    balance_check   BOOLEAN NOT NULL DEFAULT FALSE,
    tick_integrity  BOOLEAN NOT NULL DEFAULT FALSE,
    report_json     JSONB NOT NULL DEFAULT '{}'::jsonb,
    verified_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT vr_report_is_object CHECK (jsonb_typeof(report_json) = 'object')
);

CREATE INDEX IF NOT EXISTS vr_run_idx ON game.verification_reports (run_id);
CREATE INDEX IF NOT EXISTS vr_status_idx ON game.verification_reports (verification);

-- ============================================================================
-- 22. EXPERIMENT / A-B TESTING
-- ============================================================================

CREATE TABLE IF NOT EXISTS experiments (
    id              INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    experiment_key  VARCHAR(128) NOT NULL,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT FALSE,
    allocation_pct  INTEGER NOT NULL DEFAULT 0,
    variants_json   JSONB NOT NULL DEFAULT '[]'::jsonb,
    started_at      TIMESTAMPTZ,
    ended_at        TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT exp_key_not_blank CHECK (char_length(btrim(experiment_key)) > 0),
    CONSTRAINT exp_allocation_range CHECK (allocation_pct BETWEEN 0 AND 100),
    CONSTRAINT exp_variants_is_array CHECK (jsonb_typeof(variants_json) = 'array')
);

CREATE UNIQUE INDEX IF NOT EXISTS exp_key_uidx ON experiments ((lower(btrim(experiment_key))));
SELECT create_updated_at_trigger('public', 'experiments');

CREATE TABLE IF NOT EXISTS experiment_assignments (
    id              INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    experiment_id   INTEGER NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    variant_key     VARCHAR(64) NOT NULL,
    assigned_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ea2_variant_not_blank CHECK (char_length(btrim(variant_key)) > 0),
    CONSTRAINT ea2_experiment_user_unique UNIQUE (experiment_id, user_id)
);

CREATE INDEX IF NOT EXISTS ea2_experiment_idx ON experiment_assignments (experiment_id);
CREATE INDEX IF NOT EXISTS ea2_user_idx ON experiment_assignments (user_id);

-- ============================================================================
-- 23. HOST OS (Email/Webhook orchestration)
-- ============================================================================

CREATE TABLE IF NOT EXISTS host_email_events (
    id              BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    recipient_email VARCHAR(255) NOT NULL,
    template_key    VARCHAR(128) NOT NULL,
    provider        VARCHAR(32) NOT NULL DEFAULT 'resend',
    provider_message_id VARCHAR(255),
    status          VARCHAR(32) NOT NULL DEFAULT 'queued',
    scheduled_at    TIMESTAMPTZ,
    sent_at         TIMESTAMPTZ,
    opened_at       TIMESTAMPTZ,
    clicked_at      TIMESTAMPTZ,
    bounced_at      TIMESTAMPTZ,
    metadata_json   JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT hee_email_not_blank CHECK (char_length(btrim(recipient_email)) > 0),
    CONSTRAINT hee_template_not_blank CHECK (char_length(btrim(template_key)) > 0),
    CONSTRAINT hee_status_valid CHECK (status IN ('queued','sent','delivered','opened','clicked','bounced','failed','suppressed')),
    CONSTRAINT hee_metadata_is_object CHECK (jsonb_typeof(metadata_json) = 'object')
);

CREATE INDEX IF NOT EXISTS hee_email_idx ON host_email_events (recipient_email);
CREATE INDEX IF NOT EXISTS hee_status_idx ON host_email_events (status);
CREATE INDEX IF NOT EXISTS hee_provider_msg_idx ON host_email_events (provider_message_id) WHERE provider_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS hee_created_at_brin_idx ON host_email_events USING BRIN (created_at);
SELECT create_updated_at_trigger('public', 'host_email_events');

CREATE TABLE IF NOT EXISTS host_webhook_events (
    id              BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    source          VARCHAR(64) NOT NULL,
    event_type      VARCHAR(128) NOT NULL,
    payload_json    JSONB NOT NULL DEFAULT '{}'::jsonb,
    processed       BOOLEAN NOT NULL DEFAULT FALSE,
    processed_at    TIMESTAMPTZ,
    error_message   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT hwe_source_not_blank CHECK (char_length(btrim(source)) > 0),
    CONSTRAINT hwe_event_type_not_blank CHECK (char_length(btrim(event_type)) > 0),
    CONSTRAINT hwe_payload_is_object CHECK (jsonb_typeof(payload_json) = 'object')
);

CREATE INDEX IF NOT EXISTS hwe_source_idx ON host_webhook_events (source);
CREATE INDEX IF NOT EXISTS hwe_processed_idx ON host_webhook_events (processed) WHERE processed = FALSE;
CREATE INDEX IF NOT EXISTS hwe_created_at_brin_idx ON host_webhook_events USING BRIN (created_at);

-- ============================================================================
-- 24. EXPORT JOBS
-- ============================================================================

CREATE TABLE IF NOT EXISTS export_jobs (
    id              INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    export_type     VARCHAR(64) NOT NULL,
    status          VARCHAR(16) NOT NULL DEFAULT 'queued',
    format          VARCHAR(16) NOT NULL DEFAULT 'json',
    filters_json    JSONB NOT NULL DEFAULT '{}'::jsonb,
    result_url      VARCHAR(512),
    error_message   TEXT,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ej_type_not_blank CHECK (char_length(btrim(export_type)) > 0),
    CONSTRAINT ej_status_valid CHECK (status IN ('queued','processing','completed','failed','expired')),
    CONSTRAINT ej_format_valid CHECK (format IN ('json','csv','xlsx','pdf')),
    CONSTRAINT ej_filters_is_object CHECK (jsonb_typeof(filters_json) = 'object')
);

CREATE INDEX IF NOT EXISTS ej_user_idx ON export_jobs (user_id);
CREATE INDEX IF NOT EXISTS ej_status_idx ON export_jobs (status) WHERE status IN ('queued','processing');
SELECT create_updated_at_trigger('public', 'export_jobs');

-- ============================================================================
-- 25. SEARCH PATH FOR PGBOUNCER TRANSACTION MODE
-- ============================================================================
-- Ensure the default search_path includes all schemas so PgBouncer
-- transaction-mode connections can resolve cross-schema references.

COMMIT;

-- ============================================================================
-- POST-TRANSACTION: COMMENTS ON CRITICAL TABLES
-- ============================================================================
COMMENT ON TABLE accounts IS 'Root identity table — every human in the system';
COMMENT ON TABLE users IS 'Game player profile — one per account';
COMMENT ON TABLE sessions IS 'Per-device authenticated session';
COMMENT ON TABLE global_event_store IS 'Append-only event sourcing backbone for all aggregates';
COMMENT ON TABLE game.runs IS 'Central gameplay session — one run = one 12-minute game';
COMMENT ON TABLE game.run_turns IS 'Per-tick state snapshot during a run';
COMMENT ON TABLE game.run_events IS 'Every discrete event during a run — card plays, bot actions, phase transitions';
COMMENT ON TABLE game.card_definitions IS 'Canonical card templates with mode overlays';
COMMENT ON TABLE social.matches IS 'Multiplayer lobby container for Predator and Syndicate modes';
COMMENT ON TABLE social.rivalries IS 'Permanent Predator head-to-head rivalry records';
COMMENT ON TABLE social.legend_runs IS 'Verified ghost recordings for Phantom mode';
COMMENT ON TABLE economy.entitlements IS 'What the player has purchased / been granted';
COMMENT ON TABLE analytics.run_scorecards IS 'Denormalized run scoring for leaderboards and analytics';
COMMENT ON TABLE analytics.ladders IS 'Two-tier leaderboard windows';
