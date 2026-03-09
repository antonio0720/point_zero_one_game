-- Point Zero One — Tier 3 Postgres Schema Migration
-- Post-launch services: B2B, card_forge, creator, partners, licensing,
-- moderation, monetization, referrals, share_engine, UGC, etc.
--
-- Run AFTER 001 + 002:
--   psql $DATABASE_URL -f migrations/003_tier3_tables.sql

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════
-- B2B
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS b2b_tenants (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             VARCHAR(255) NOT NULL,
  sso_idp_url      VARCHAR(512) NULL,
  sso_client_id    VARCHAR(255) NULL,
  sso_client_secret VARCHAR(512) NULL,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS b2b_seats (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID         NOT NULL REFERENCES b2b_tenants(id),
  user_email VARCHAR(255) NULL,
  assigned   BOOLEAN      NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_b2b_seats_tenant ON b2b_seats (tenant_id);

CREATE TABLE IF NOT EXISTS wellness_analytics (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      VARCHAR(64)  NOT NULL,
  survival_rate        DOUBLE PRECISION NOT NULL DEFAULT 0,
  failure_mode         VARCHAR(64)  NOT NULL DEFAULT 'Financial',
  risk_literacy_score  DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wellness_org ON wellness_analytics (organization_id);

-- ═══════════════════════════════════════════════════════════════════════
-- BIOMETRIC
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS biometric_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id      VARCHAR(64)      NOT NULL,
  stress_delta DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_biometric_card ON biometric_events (card_id);

-- ═══════════════════════════════════════════════════════════════════════
-- CARD FORGE
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS community_cards (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id   VARCHAR(64) NOT NULL,
  name         VARCHAR(255) NOT NULL,
  price        INTEGER      NOT NULL DEFAULT 0,
  games_played INTEGER      NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_community_cards_creator ON community_cards (creator_id);

CREATE TABLE IF NOT EXISTS death_screen_triggers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      VARCHAR(64)  NOT NULL,
  deaths_count    INTEGER      NOT NULL DEFAULT 0,
  account_age_sec INTEGER      NOT NULL DEFAULT 0,
  is_rate_limited BOOLEAN      NOT NULL DEFAULT false,
  last_death_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (account_id)
);

CREATE TABLE IF NOT EXISTS gauntlet_votes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id VARCHAR(64) NOT NULL,
  voter_id      VARCHAR(64) NOT NULL,
  vote_type     VARCHAR(32) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gauntlet_votes_sub ON gauntlet_votes (submission_id);

-- ═══════════════════════════════════════════════════════════════════════
-- COMMERCE / ENTITLEMENTS
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS entitlement_compat (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  taxonomy_id    VARCHAR(64) NOT NULL,
  entitlement_id VARCHAR(64) NOT NULL,
  rank           INTEGER     NOT NULL DEFAULT 0,
  compatible_with JSONB      NOT NULL DEFAULT '[]'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_entitlement_compat_tax ON entitlement_compat (taxonomy_id);

-- ═══════════════════════════════════════════════════════════════════════
-- COMPANION
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS card_scans (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id                  VARCHAR(64) NOT NULL UNIQUE,
  consequence_explanation  TEXT        NOT NULL DEFAULT '',
  real_life_principle      TEXT        NOT NULL DEFAULT '',
  scenario_variants        JSONB       NOT NULL DEFAULT '[]'::jsonb,
  post_game_metrics_prompt JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════
-- CREATOR PROFILES
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS creator_permissions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level        VARCHAR(64)  NOT NULL,
  publish_type VARCHAR(64)  NOT NULL,
  can_publish  BOOLEAN      NOT NULL DEFAULT false,
  UNIQUE (level, publish_type)
);

-- ═══════════════════════════════════════════════════════════════════════
-- CURRICULUM
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS curriculum_orgs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(255) NOT NULL,
  slug       VARCHAR(128) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS curriculum_cohorts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID         NOT NULL REFERENCES curriculum_orgs(id),
  name       VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sso_hooks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  VARCHAR(64)  NOT NULL,
  sso_provider    VARCHAR(64)  NOT NULL,
  sso_client_id   VARCHAR(255) NOT NULL,
  sso_callback_url VARCHAR(512) NOT NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════
-- EPISODES
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS episode_version_pins (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id   VARCHAR(64) NOT NULL,
  version      INTEGER     NOT NULL DEFAULT 1,
  content_hash VARCHAR(128) NOT NULL DEFAULT '',
  pinned_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (episode_id, version)
);

-- ═══════════════════════════════════════════════════════════════════════
-- EVENTS (Founder Night)
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS founder_night_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name   VARCHAR(255) NOT NULL,
  season       INTEGER      NOT NULL DEFAULT 0,
  event_data   JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════
-- EXPERIMENTS
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS experiments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255) NOT NULL,
  description TEXT         NOT NULL DEFAULT '',
  status      VARCHAR(32)  NOT NULL DEFAULT 'active',
  start_date  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  end_date    TIMESTAMPTZ  NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════
-- GENERATIONAL (Bloodlines)
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS bloodlines (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id     VARCHAR(64) NOT NULL,
  generation    INTEGER     NOT NULL DEFAULT 1,
  run_id        VARCHAR(64) NULL,
  outcome       INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bloodlines_player ON bloodlines (player_id);

-- ═══════════════════════════════════════════════════════════════════════
-- INTEGRITY / MODERATION / GOVERNANCE
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS transparency_rollups (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start    DATE        NOT NULL,
  period_end      DATE        NOT NULL,
  rollup_data     JSONB       NOT NULL DEFAULT '{}'::jsonb,
  redaction_rules JSONB       NOT NULL DEFAULT '[]'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS appeals (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    VARCHAR(64)  NOT NULL,
  reason     TEXT         NOT NULL DEFAULT '',
  status     VARCHAR(32)  NOT NULL DEFAULT 'pending',
  outcome    TEXT         NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_appeals_user ON appeals (user_id, status);

CREATE TABLE IF NOT EXISTS moderation_actions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id   VARCHAR(64) NOT NULL,
  action_type VARCHAR(64) NOT NULL,
  reason      TEXT        NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sku_tags (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag  VARCHAR(128) NOT NULL UNIQUE
);

-- ═══════════════════════════════════════════════════════════════════════
-- PARTNERS
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS partner_enrollments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id   VARCHAR(64) NOT NULL,
  cohort_id    VARCHAR(64) NULL,
  status       VARCHAR(32) NOT NULL DEFAULT 'pending',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS partner_rollups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id  VARCHAR(64) NOT NULL,
  period      VARCHAR(32) NOT NULL,
  rollup_data JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════
-- LICENSING CONTROL PLANE
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS lcp_cohorts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(255) NOT NULL,
  schedule_window JSONB        NOT NULL DEFAULT '{}'::jsonb,
  ladder_policy   JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lcp_export_jobs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type    VARCHAR(32)  NOT NULL DEFAULT 'pdf',
  status      VARCHAR(32)  NOT NULL DEFAULT 'pending',
  signed_url  VARCHAR(512) NULL,
  expires_at  TIMESTAMPTZ  NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lcp_packs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id VARCHAR(64)  NOT NULL,
  name           VARCHAR(255) NOT NULL,
  is_published   BOOLEAN      NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════
-- REFERRALS
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS referral_codes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code       VARCHAR(64)  NOT NULL UNIQUE,
  owner_id   VARCHAR(64)  NOT NULL,
  used       BOOLEAN      NOT NULL DEFAULT false,
  used_by    VARCHAR(64)  NULL,
  runs_count INTEGER      NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_referral_codes_owner ON referral_codes (owner_id);

CREATE TABLE IF NOT EXISTS referral_reward_unlocks (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id         UUID        NOT NULL REFERENCES referral_codes(id),
  cosmetic_variant_id VARCHAR(64) NULL,
  stamp_variant_id    VARCHAR(64) NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS referral_receipts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id UUID        NOT NULL REFERENCES referral_codes(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════
-- SHARE ENGINE
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS clip_metadata (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id      VARCHAR(64) NOT NULL,
  moment_type VARCHAR(64) NOT NULL,
  turn_start  INTEGER     NOT NULL,
  turn_end    INTEGER     NOT NULL,
  status      VARCHAR(32) NOT NULL DEFAULT 'pending',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_clip_metadata_run ON clip_metadata (run_id);
CREATE INDEX IF NOT EXISTS idx_clip_metadata_status ON clip_metadata (status);

CREATE TABLE IF NOT EXISTS share_artifacts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_session_id VARCHAR(64) NOT NULL,
  og_meta         JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════
-- UGC
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS ugc_artifacts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id  VARCHAR(64) NOT NULL,
  data        JSONB       NOT NULL DEFAULT '{}'::jsonb,
  status      VARCHAR(32) NOT NULL DEFAULT 'pending',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ugc_submissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id UUID        NOT NULL REFERENCES ugc_artifacts(id),
  status      VARCHAR(32) NOT NULL DEFAULT 'pending',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ugc_sim_checks (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  replay_id              VARCHAR(64)  NOT NULL,
  original_replay_hash   VARCHAR(128) NOT NULL,
  simulated_replay_hash  VARCHAR(128) NOT NULL,
  differences            JSONB        NOT NULL DEFAULT '[]'::jsonb,
  created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════
-- MISCELLANEOUS (remaining services)
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS ranked_compat (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id   VARCHAR(64) NOT NULL,
  run_id      VARCHAR(64) NOT NULL,
  eligible    BOOLEAN     NOT NULL DEFAULT false,
  entitlement VARCHAR(64) NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS policy_scans (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       VARCHAR(255) NOT NULL,
  description TEXT         NULL,
  tags        JSONB        NOT NULL DEFAULT '[]'::jsonb,
  assets      JSONB        NOT NULL DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS run_visibility (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id     VARCHAR(64) NOT NULL UNIQUE,
  user_id    VARCHAR(64) NOT NULL,
  visibility VARCHAR(32) NOT NULL DEFAULT 'public',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS revshare_ledger (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id       VARCHAR(64) NOT NULL,
  engagement_id VARCHAR(64) NOT NULL,
  period        INTEGER     NOT NULL,
  amount        DOUBLE PRECISION NOT NULL DEFAULT 0,
  receipt_hash  VARCHAR(128) NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_revshare_ledger_game ON revshare_ledger (game_id);

CREATE TABLE IF NOT EXISTS sandbox_lanes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  private_id VARCHAR(64) NOT NULL,
  cohort_id  VARCHAR(64) NULL,
  event_id   VARCHAR(64) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sentiment_state (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id       VARCHAR(64)  NOT NULL,
  sentiment_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  empathy_mode    BOOLEAN      NOT NULL DEFAULT false,
  history_window  JSONB        NOT NULL DEFAULT '[]'::jsonb,
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sentiment_player ON sentiment_state (player_id);

CREATE TABLE IF NOT EXISTS toxicity_scans (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id  VARCHAR(64) NOT NULL,
  scan_type   VARCHAR(32) NOT NULL DEFAULT 'text',
  result      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  flagged     BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;
