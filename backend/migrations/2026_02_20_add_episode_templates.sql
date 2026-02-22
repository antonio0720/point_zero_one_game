-- Point Zero One Digital - Episode Templates Management
-- Strict TypeScript, no 'any', export all public symbols
-- SQL: includes indexes, foreign keys, comments; idempotent (CREATE IF NOT EXISTS)
-- Bash: set -euo pipefail, log all actions

CREATE TABLE IF NOT EXISTS episode_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    difficulty INTEGER CHECK (difficulty BETWEEN 1 AND 10),
    length INTEGER CHECK (length > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_episode_templates_name ON episode_templates (name);

CREATE TABLE IF NOT EXISTS episode_versions (
    id SERIAL PRIMARY KEY,
    episode_template_id INTEGER REFERENCES episode_templates(id),
    version VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_episode_versions_episode_template_id ON episode_versions (episode_template_id);
CREATE INDEX IF NOT EXISTS idx_episode_versions_version ON episode_versions (version);

CREATE TABLE IF NOT EXISTS episode_pins (
    id SERIAL PRIMARY KEY,
    episode_version_id INTEGER REFERENCES episode_versions(id),
    pin VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_episode_pins_episode_version_id ON episode_pins (episode_version_id);
CREATE INDEX IF NOT EXISTS idx_episode_pins_pin ON episode_pins (pin);

CREATE TABLE IF NOT EXISTS episode_macros (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    value TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_episode_macros_name ON episode_macros (name);

CREATE TABLE IF NOT EXISTS episode_constraints (
    id SERIAL PRIMARY KEY,
    episode_template_id INTEGER REFERENCES episode_templates(id),
    macro_id INTEGER REFERENCES episode_macros(id),
    constraint VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_episode_constraints_episode_template_id ON episode_constraints (episode_template_id);
CREATE INDEX IF NOT EXISTS idx_episode_constraints_macro_id ON episode_constraints (macro_id);
CREATE INDEX IF NOT EXISTS idx_episode_constraints_constraint ON episode_constraints (constraint);
