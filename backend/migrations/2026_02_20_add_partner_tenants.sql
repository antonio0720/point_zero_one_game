-- Point Zero One Digital - Partner Tenants, Admin Users, Feature Flags, Domains, Audit Log (2026-02-20)

CREATE TABLE IF NOT EXISTS partner_tenants (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS partner_tenants_domain_idx ON partner_tenants (domain);

CREATE TYPE IF NOT EXISTS partner_admin_user_role AS ENUM ('ADMIN', 'MANAGER', 'USER');

CREATE TABLE IF NOT EXISTS partner_admin_users (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES partner_tenants(id),
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role partner_admin_user_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS partner_admin_users_username_idx ON partner_admin_users (username);

CREATE TABLE IF NOT EXISTS partner_feature_flags (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES partner_tenants(id),
    feature VARCHAR(255) UNIQUE NOT NULL,
    enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS partner_feature_flags_feature_idx ON partner_feature_flags (feature);

CREATE TABLE IF NOT EXISTS partner_domains (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES partner_tenants(id),
    domain VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS partner_domains_domain_idx ON partner_domains (domain);

CREATE TABLE IF NOT EXISTS partner_audit_log (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES partner_tenants(id),
    user_id INTEGER REFERENCES partner_admin_users(id),
    action VARCHAR(255) NOT NULL,
    target_id INTEGERS, -- This is a polymorphic association for actions like 'create', 'update', 'delete'
    target_type VARCHAR(255) NOT NULL, -- The type of the target (e.g., 'partner_tenants', 'partner_admin_users', etc.)
    old_values JSONB,
    new_values JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS partner_audit_log_user_id_idx ON partner_audit_log (user_id);
