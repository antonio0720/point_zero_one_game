-- /backend/migrations/0060_b2b.sql
-- Point Zero One Digital
-- B2B / institutional tenancy layer
-- PostgreSQL-only rewrite of the original file.
-- Removes MySQL AUTO_INCREMENT / ON UPDATE syntax and unknown external FKs.

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
    WHERE typname = 'b2b_risk_level'
  ) THEN
    CREATE TYPE b2b_risk_level AS ENUM (
      'low',
      'medium',
      'high'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'b2b_tenant_status'
  ) THEN
    CREATE TYPE b2b_tenant_status AS ENUM (
      'trial',
      'active',
      'suspended',
      'archived'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'tenant_seat_status'
  ) THEN
    CREATE TYPE tenant_seat_status AS ENUM (
      'invited',
      'active',
      'disabled',
      'revoked'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS b2b_industries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_b2b_industries_code UNIQUE (code),
  CONSTRAINT uq_b2b_industries_name UNIQUE (name),
  CONSTRAINT b2b_industries_metadata_json_is_object
    CHECK (jsonb_typeof(metadata_json) = 'object')
);

COMMENT ON TABLE b2b_industries IS
  'Institutional industry taxonomy owned by the backend.';
COMMENT ON COLUMN b2b_industries.code IS
  'Stable application-facing industry code, e.g. fintech, higher_ed, enterprise_hr.';

CREATE INDEX IF NOT EXISTS idx_b2b_industries_code
  ON b2b_industries (code);

CREATE INDEX IF NOT EXISTS idx_b2b_industries_metadata_json_gin
  ON b2b_industries
  USING GIN (metadata_json);

CREATE TABLE IF NOT EXISTS industry_risk_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  industry_id UUID,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  risk_level b2b_risk_level NOT NULL,
  pack_version TEXT NOT NULL DEFAULT '1.0.0',
  rules_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_industry_risk_packs_industry_id
    FOREIGN KEY (industry_id)
    REFERENCES b2b_industries (id)
    ON DELETE SET NULL,
  CONSTRAINT uq_industry_risk_packs_scope
    UNIQUE (industry_id, name, pack_version),
  CONSTRAINT industry_risk_packs_rules_json_is_object
    CHECK (jsonb_typeof(rules_json) = 'object')
);

COMMENT ON TABLE industry_risk_packs IS
  'Reusable institutional risk packs assignable to tenants.';
COMMENT ON COLUMN industry_risk_packs.rules_json IS
  'Structured rules/thresholds consumed by server-side policy and analytics services.';

CREATE INDEX IF NOT EXISTS idx_industry_risk_packs_industry_id
  ON industry_risk_packs (industry_id);

CREATE INDEX IF NOT EXISTS idx_industry_risk_packs_risk_level
  ON industry_risk_packs (risk_level);

CREATE INDEX IF NOT EXISTS idx_industry_risk_packs_is_active
  ON industry_risk_packs (is_active);

CREATE INDEX IF NOT EXISTS idx_industry_risk_packs_rules_json_gin
  ON industry_risk_packs
  USING GIN (rules_json);

CREATE TABLE IF NOT EXISTS b2b_tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_key TEXT NOT NULL,
  slug TEXT NOT NULL,
  name VARCHAR(255) NOT NULL,
  industry_id UUID,
  risk_pack_id UUID,
  status b2b_tenant_status NOT NULL DEFAULT 'trial',
  billing_email TEXT,
  settings_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMPTZ,
  CONSTRAINT uq_b2b_tenants_tenant_key UNIQUE (tenant_key),
  CONSTRAINT uq_b2b_tenants_slug UNIQUE (slug),
  CONSTRAINT fk_b2b_tenants_industry_id
    FOREIGN KEY (industry_id)
    REFERENCES b2b_industries (id)
    ON DELETE SET NULL,
  CONSTRAINT fk_b2b_tenants_risk_pack_id
    FOREIGN KEY (risk_pack_id)
    REFERENCES industry_risk_packs (id)
    ON DELETE SET NULL,
  CONSTRAINT b2b_tenants_settings_json_is_object
    CHECK (jsonb_typeof(settings_json) = 'object'),
  CONSTRAINT b2b_tenants_deleted_after_create
    CHECK (deleted_at IS NULL OR deleted_at >= created_at)
);

COMMENT ON TABLE b2b_tenants IS
  'Top-level institutional tenants for B2B, enterprise, and district/cohort deployments.';
COMMENT ON COLUMN b2b_tenants.tenant_key IS
  'Stable machine key for service-to-service routing.';
COMMENT ON COLUMN b2b_tenants.slug IS
  'Human-friendly routing slug; store lowercase in application code for deterministic uniqueness.';
COMMENT ON COLUMN b2b_tenants.created_by_user_id IS
  'Opaque upstream user/account identifier of the actor who created the tenant.';

CREATE INDEX IF NOT EXISTS idx_b2b_tenants_industry_id
  ON b2b_tenants (industry_id);

CREATE INDEX IF NOT EXISTS idx_b2b_tenants_risk_pack_id
  ON b2b_tenants (risk_pack_id);

CREATE INDEX IF NOT EXISTS idx_b2b_tenants_status
  ON b2b_tenants (status);

CREATE INDEX IF NOT EXISTS idx_b2b_tenants_deleted_at
  ON b2b_tenants (deleted_at);

CREATE INDEX IF NOT EXISTS idx_b2b_tenants_settings_json_gin
  ON b2b_tenants
  USING GIN (settings_json);

CREATE TABLE IF NOT EXISTS tenant_seats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  b2b_tenant_id UUID NOT NULL,
  seat_key TEXT NOT NULL,
  assigned_user_id TEXT,
  seat_role TEXT NOT NULL DEFAULT 'member',
  seat_status tenant_seat_status NOT NULL DEFAULT 'invited',
  entitlements_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tenant_seats_b2b_tenant_id
    FOREIGN KEY (b2b_tenant_id)
    REFERENCES b2b_tenants (id)
    ON DELETE CASCADE,
  CONSTRAINT uq_tenant_seats_scope
    UNIQUE (b2b_tenant_id, seat_key),
  CONSTRAINT tenant_seats_entitlements_json_is_object
    CHECK (jsonb_typeof(entitlements_json) = 'object')
);

COMMENT ON TABLE tenant_seats IS
  'Institutional seat assignments owned by a tenant.';
COMMENT ON COLUMN tenant_seats.seat_key IS
  'Stable tenant-local seat identifier replacing the broken FK to an unverified seats table.';
COMMENT ON COLUMN tenant_seats.assigned_user_id IS
  'Opaque upstream user/account identifier assigned to the seat.';

CREATE INDEX IF NOT EXISTS idx_tenant_seats_b2b_tenant_id
  ON tenant_seats (b2b_tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_seats_assigned_user_id
  ON tenant_seats (assigned_user_id);

CREATE INDEX IF NOT EXISTS idx_tenant_seats_status
  ON tenant_seats (seat_status);

CREATE INDEX IF NOT EXISTS idx_tenant_seats_entitlements_json_gin
  ON tenant_seats
  USING GIN (entitlements_json);

CREATE TABLE IF NOT EXISTS tenant_analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_seat_id UUID NOT NULL,
  snapshot_at TIMESTAMPTZ NOT NULL,
  metric_namespace TEXT NOT NULL DEFAULT 'default',
  data JSONB NOT NULL,
  checksum TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tenant_analytics_snapshots_tenant_seat_id
    FOREIGN KEY (tenant_seat_id)
    REFERENCES tenant_seats (id)
    ON DELETE CASCADE,
  CONSTRAINT uq_tenant_analytics_snapshots_scope
    UNIQUE (tenant_seat_id, snapshot_at, metric_namespace),
  CONSTRAINT tenant_analytics_snapshots_data_is_container
    CHECK (jsonb_typeof(data) IN ('object', 'array'))
);

COMMENT ON TABLE tenant_analytics_snapshots IS
  'Time-series analytics snapshots scoped to a tenant seat.';
COMMENT ON COLUMN tenant_analytics_snapshots.metric_namespace IS
  'Logical namespace for snapshot families, e.g. retention, completion, risk, engagement.';

CREATE INDEX IF NOT EXISTS idx_tenant_analytics_snapshots_tenant_seat_id
  ON tenant_analytics_snapshots (tenant_seat_id);

CREATE INDEX IF NOT EXISTS idx_tenant_analytics_snapshots_snapshot_at
  ON tenant_analytics_snapshots (snapshot_at DESC);

CREATE INDEX IF NOT EXISTS idx_tenant_analytics_snapshots_namespace
  ON tenant_analytics_snapshots (metric_namespace);

CREATE INDEX IF NOT EXISTS idx_tenant_analytics_snapshots_data_gin
  ON tenant_analytics_snapshots
  USING GIN (data);

CREATE TABLE IF NOT EXISTS tenant_custom_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  b2b_tenant_id UUID NOT NULL,
  scenario_key TEXT NOT NULL,
  name VARCHAR(255) NOT NULL,
  data JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tenant_custom_scenarios_b2b_tenant_id
    FOREIGN KEY (b2b_tenant_id)
    REFERENCES b2b_tenants (id)
    ON DELETE CASCADE,
  CONSTRAINT uq_tenant_custom_scenarios_scope
    UNIQUE (b2b_tenant_id, scenario_key),
  CONSTRAINT tenant_custom_scenarios_data_is_container
    CHECK (jsonb_typeof(data) IN ('object', 'array'))
);

COMMENT ON TABLE tenant_custom_scenarios IS
  'Tenant-owned scenario definitions for custom institutional gameplay, training, or analytics.';
COMMENT ON COLUMN tenant_custom_scenarios.scenario_key IS
  'Stable tenant-local scenario key.';

CREATE INDEX IF NOT EXISTS idx_tenant_custom_scenarios_b2b_tenant_id
  ON tenant_custom_scenarios (b2b_tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_custom_scenarios_name
  ON tenant_custom_scenarios (name);

CREATE INDEX IF NOT EXISTS idx_tenant_custom_scenarios_is_active
  ON tenant_custom_scenarios (is_active);

CREATE INDEX IF NOT EXISTS idx_tenant_custom_scenarios_data_gin
  ON tenant_custom_scenarios
  USING GIN (data);

CREATE TABLE IF NOT EXISTS tenant_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  b2b_tenant_id UUID NOT NULL,
  actor_user_id TEXT,
  event VARCHAR(255) NOT NULL,
  event_source TEXT NOT NULL DEFAULT 'system',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  event_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tenant_audit_log_b2b_tenant_id
    FOREIGN KEY (b2b_tenant_id)
    REFERENCES b2b_tenants (id)
    ON DELETE CASCADE,
  CONSTRAINT tenant_audit_log_data_is_object
    CHECK (jsonb_typeof(data) = 'object')
);

COMMENT ON TABLE tenant_audit_log IS
  'Immutable-style tenant audit ledger for actor/event history.';
COMMENT ON COLUMN tenant_audit_log.actor_user_id IS
  'Opaque upstream user/account identifier for the acting principal.';
COMMENT ON COLUMN tenant_audit_log.event_source IS
  'Origin of the event, e.g. api, worker, system, sync, admin_console.';

CREATE INDEX IF NOT EXISTS idx_tenant_audit_log_b2b_tenant_id
  ON tenant_audit_log (b2b_tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_audit_log_event
  ON tenant_audit_log (event);

CREATE INDEX IF NOT EXISTS idx_tenant_audit_log_event_source
  ON tenant_audit_log (event_source);

CREATE INDEX IF NOT EXISTS idx_tenant_audit_log_event_at
  ON tenant_audit_log (event_at DESC);

CREATE INDEX IF NOT EXISTS idx_tenant_audit_log_data_gin
  ON tenant_audit_log
  USING GIN (data);

DROP TRIGGER IF EXISTS trg_b2b_industries_set_updated_at ON b2b_industries;
CREATE TRIGGER trg_b2b_industries_set_updated_at
BEFORE UPDATE ON b2b_industries
FOR EACH ROW
EXECUTE FUNCTION set_row_updated_at();

DROP TRIGGER IF EXISTS trg_industry_risk_packs_set_updated_at ON industry_risk_packs;
CREATE TRIGGER trg_industry_risk_packs_set_updated_at
BEFORE UPDATE ON industry_risk_packs
FOR EACH ROW
EXECUTE FUNCTION set_row_updated_at();

DROP TRIGGER IF EXISTS trg_b2b_tenants_set_updated_at ON b2b_tenants;
CREATE TRIGGER trg_b2b_tenants_set_updated_at
BEFORE UPDATE ON b2b_tenants
FOR EACH ROW
EXECUTE FUNCTION set_row_updated_at();

DROP TRIGGER IF EXISTS trg_tenant_seats_set_updated_at ON tenant_seats;
CREATE TRIGGER trg_tenant_seats_set_updated_at
BEFORE UPDATE ON tenant_seats
FOR EACH ROW
EXECUTE FUNCTION set_row_updated_at();

DROP TRIGGER IF EXISTS trg_tenant_analytics_snapshots_set_updated_at ON tenant_analytics_snapshots;
CREATE TRIGGER trg_tenant_analytics_snapshots_set_updated_at
BEFORE UPDATE ON tenant_analytics_snapshots
FOR EACH ROW
EXECUTE FUNCTION set_row_updated_at();

DROP TRIGGER IF EXISTS trg_tenant_custom_scenarios_set_updated_at ON tenant_custom_scenarios;
CREATE TRIGGER trg_tenant_custom_scenarios_set_updated_at
BEFORE UPDATE ON tenant_custom_scenarios
FOR EACH ROW
EXECUTE FUNCTION set_row_updated_at();

DROP TRIGGER IF EXISTS trg_tenant_audit_log_set_updated_at ON tenant_audit_log;
CREATE TRIGGER trg_tenant_audit_log_set_updated_at
BEFORE UPDATE ON tenant_audit_log
FOR EACH ROW
EXECUTE FUNCTION set_row_updated_at();