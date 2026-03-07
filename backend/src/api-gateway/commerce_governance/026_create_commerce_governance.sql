-- Migration 026: Commerce Governance Tables
-- Date: 2026-03-07
-- Tables: skus, offer_policies, experiments, killswitch_events, policy_versions, governance_audit_log

BEGIN;

CREATE TABLE IF NOT EXISTS skus (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                        VARCHAR(255) NOT NULL,
    description                 TEXT NOT NULL DEFAULT '',
    sku_class                   VARCHAR(50) NOT NULL,
    price_usd_cents             INTEGER NOT NULL CHECK (price_usd_cents >= 49 AND price_usd_cents <= 99999),
    stripe_price_id             VARCHAR(255) NOT NULL,
    stripe_product_id           VARCHAR(255) NOT NULL,
    tags                        JSONB NOT NULL DEFAULT '[]',
    competitive_safe            BOOLEAN NOT NULL DEFAULT TRUE,
    affects_outcomes            BOOLEAN NOT NULL DEFAULT FALSE CHECK (affects_outcomes = FALSE),
    max_per_user                INTEGER NOT NULL DEFAULT 0,
    active                      BOOLEAN NOT NULL DEFAULT TRUE,
    approved_by_policy_version  VARCHAR(255) NOT NULL,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_skus_sku_class ON skus(sku_class);
CREATE INDEX IF NOT EXISTS idx_skus_active ON skus(active);
CREATE INDEX IF NOT EXISTS idx_skus_created_at ON skus(created_at);

CREATE TABLE IF NOT EXISTS offer_policies (
    id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                            VARCHAR(255) NOT NULL,
    sku_ids                         JSONB NOT NULL DEFAULT '[]',
    trigger_type                    VARCHAR(50) NOT NULL,
    max_impressions_per_user_per_day INTEGER NOT NULL DEFAULT 3,
    max_impressions_per_user_total  INTEGER NOT NULL DEFAULT 0,
    cooldown_seconds                INTEGER NOT NULL DEFAULT 300,
    suppress_after_loss             BOOLEAN NOT NULL DEFAULT TRUE,
    min_ticks_played_to_show        INTEGER NOT NULL DEFAULT 100,
    show_during_run                 BOOLEAN NOT NULL DEFAULT FALSE CHECK (show_during_run = FALSE),
    discount_pct                    INTEGER NOT NULL DEFAULT 0 CHECK (discount_pct >= 0 AND discount_pct <= 50),
    starts_at                       TIMESTAMPTZ,
    ends_at                         TIMESTAMPTZ,
    status                          VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    policy_version_id               VARCHAR(255) NOT NULL,
    created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_offer_policies_status ON offer_policies(status);
CREATE INDEX IF NOT EXISTS idx_offer_policies_trigger ON offer_policies(trigger_type);
CREATE INDEX IF NOT EXISTS idx_offer_policies_created_at ON offer_policies(created_at);

CREATE TABLE IF NOT EXISTS experiments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(255) NOT NULL,
    description         TEXT NOT NULL DEFAULT '',
    variable            VARCHAR(50) NOT NULL,
    control_pct         NUMERIC(5,2) NOT NULL,
    treatment_pct       NUMERIC(5,2) NOT NULL,
    holdout_pct         NUMERIC(5,2) NOT NULL,
    target_sku_ids      JSONB NOT NULL DEFAULT '[]',
    segment_filter      JSONB NOT NULL DEFAULT '{}',
    max_enrollment      INTEGER NOT NULL DEFAULT 100000,
    primary_metric      VARCHAR(100) NOT NULL,
    guardrail_metrics   JSONB NOT NULL DEFAULT '[]',
    status              VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    started_at          TIMESTAMPTZ,
    concluded_at        TIMESTAMPTZ,
    policy_version_id   VARCHAR(255) NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_experiments_status ON experiments(status);
CREATE INDEX IF NOT EXISTS idx_experiments_variable ON experiments(variable);
CREATE INDEX IF NOT EXISTS idx_experiments_created_at ON experiments(created_at);

CREATE TABLE IF NOT EXISTS killswitch_events (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target              VARCHAR(50) NOT NULL,
    target_id           VARCHAR(255),
    reason              TEXT NOT NULL,
    triggered_by        VARCHAR(255) NOT NULL,
    triggered_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at         TIMESTAMPTZ,
    resolved_by         VARCHAR(255),
    auto_triggered      BOOLEAN NOT NULL DEFAULT FALSE,
    guardrail_source    VARCHAR(255),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_killswitch_target ON killswitch_events(target);
CREATE INDEX IF NOT EXISTS idx_killswitch_resolved ON killswitch_events(resolved_at);
CREATE INDEX IF NOT EXISTS idx_killswitch_created_at ON killswitch_events(created_at);

CREATE TABLE IF NOT EXISTS policy_versions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_number      INTEGER NOT NULL UNIQUE,
    content_hash        VARCHAR(64) NOT NULL,
    rules               JSONB NOT NULL,
    published_by        VARCHAR(255) NOT NULL,
    published_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active           BOOLEAN NOT NULL DEFAULT FALSE,
    previous_version_id UUID,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_policy_versions_active ON policy_versions(is_active);
CREATE INDEX IF NOT EXISTS idx_policy_versions_number ON policy_versions(version_number);

CREATE TABLE IF NOT EXISTS governance_audit_log (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action              VARCHAR(100) NOT NULL,
    actor_id            VARCHAR(255) NOT NULL,
    actor_type          VARCHAR(50) NOT NULL,
    target_type         VARCHAR(100) NOT NULL,
    target_id           VARCHAR(255),
    reason              TEXT NOT NULL DEFAULT '',
    policy_version_id   VARCHAR(255) NOT NULL,
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_governance_audit_action ON governance_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_governance_audit_target ON governance_audit_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_governance_audit_actor ON governance_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_governance_audit_created_at ON governance_audit_log(created_at);

INSERT INTO policy_versions (id, version_number, content_hash, rules, published_by, is_active)
VALUES (
    '00000000-0000-0000-0000-000000000001', 1, 'default',
    '{"maxDiscountPct":50,"globalMaxImpressionsPerDay":5,"globalSuppressAfterLoss":true,"globalMinTicksBeforeMonetization":100,"storeDuringRunEnabled":false,"maxConcurrentExperiments":3,"minControlGroupPct":10,"minHoldoutGroupPct":5,"forbiddenSkuClasses":["POWER","BOOST","TIME_SKIP","RNG_REROLL","INSURANCE","ADVANTAGE_INFERENCE"],"forbiddenExperimentVariables":["WIN_PROBABILITY","CARD_DRAW_ODDS","DAMAGE_MULTIPLIER","SHIELD_STRENGTH","PRESSURE_SCORING","CORD_FORMULA","SEED_SELECTION","MATCHMAKING_BIAS"]}',
    'system', true
) ON CONFLICT (version_number) DO NOTHING;

COMMIT;

-- ROLLBACK:
-- DROP TABLE IF EXISTS governance_audit_log CASCADE;
-- DROP TABLE IF EXISTS policy_versions CASCADE;
-- DROP TABLE IF EXISTS killswitch_events CASCADE;
-- DROP TABLE IF EXISTS experiments CASCADE;
-- DROP TABLE IF EXISTS offer_policies CASCADE;
-- DROP TABLE IF EXISTS skus CASCADE;
