-- Point Zero One Digital - Experiment Registry (2026-02-20)
-- Strict TypeScript, no 'any', export all public symbols
-- SQL includes indexes, foreign keys, comments; idempotent (CREATE IF NOT EXISTS)
-- Bash: set -euo pipefail, log all actions

CREATE TABLE experiments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX experiments_name_idx ON experiments (name);

CREATE TABLE variants (
    id SERIAL PRIMARY KEY,
    experiment_id INTEGER REFERENCES experiments(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX variants_experiment_id_idx ON variants (experiment_id);
CREATE INDEX variants_name_idx ON variants (name);

CREATE TABLE allocations (
    id SERIAL PRIMARY KEY,
    experiment_id INTEGER REFERENCES experiments(id),
    variant_id INTEGER REFERENCES variants(id),
    user_id INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX allocations_experiment_id_idx ON allocations (experiment_id);
CREATE INDEX allocations_variant_id_idx ON allocations (variant_id);
CREATE INDEX allocations_user_id_idx ON allocations (user_id);

CREATE TABLE guardrails (
    id SERIAL PRIMARY KEY,
    experiment_id INTEGER REFERENCES experiments(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    value DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX guardrails_experiment_id_idx ON guardrails (experiment_id);
CREATE INDEX guardrails_name_idx ON guardrails (name);

CREATE TABLE experiment_audit_events (
    id SERIAL PRIMARY KEY,
    experiment_id INTEGER REFERENCES experiments(id),
    user_id INTEGER NOT NULL,
    event_type VARCHAR(255) NOT NULL,
    data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX experiment_audit_events_experiment_id_idx ON experiment_audit_events (experiment_id);
CREATE INDEX experiment_audit_events_user_id_idx ON experiment_audit_events (user_id);
