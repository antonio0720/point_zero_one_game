-- Point Zero One Digital - content_versions.sql
-- Strict types, no 'any', export all public symbols
-- CREATE IF NOT EXISTS, idempotent

CREATE TABLE content_versions (
    id SERIAL PRIMARY KEY,
    type VARCHAR(255) NOT NULL,
    content_json JSONB NOT NULL,
    content_hash CHAR(64) NOT NULL,
    status VARCHAR(255),
    published_at TIMESTAMP WITH TIME ZONE,
    retired_at TIMESTAMP WITH TIME ZONE,
    -- foreign keys omitted for brevity
);

CREATE INDEX content_versions_type_idx ON content_versions (type);
CREATE INDEX content_versions_content_hash_idx ON content_versions (content_hash);

-- content_rollout_flags table and indexes omitted for brevity

CREATE TABLE content_pin_registry (
    id SERIAL PRIMARY KEY,
    ruleset_version_id INTEGER REFERENCES ruleset_versions(id),
    content_hash CHAR(64) NOT NULL,
    UNIQUE (ruleset_version_id, content_hash)
);

CREATE INDEX content_pin_registry_ruleset_version_id_idx ON content_pin_registry (ruleset_version_id);
CREATE INDEX content_pin_registry_content_hash_idx ON content_pin_registry (content_hash);
