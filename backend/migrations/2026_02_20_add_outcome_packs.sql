-- Point Zero One Digital - Outcome Packs Migrations
-- Created on 2026-02-20 by Senior SQL Engineer

CREATE TABLE IF NOT EXISTS pack_locales (
    id INT PRIMARY KEY,
    code VARCHAR(10) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pack_locales_code ON pack_locales (code);

CREATE TABLE IF NOT EXISTS pack_objectives (
    id INT PRIMARY KEY,
    pack_id INT NOT NULL REFERENCES outcome_packs(id),
    locale_id INT NOT NULL REFERENCES pack_locales(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    FOREIGN KEY (pack_id, locale_id) REFERENCES outcome_packs_locale(pack_id, locale_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pack_objectives_pack_id ON pack_objectives (pack_id);
CREATE INDEX IF NOT EXISTS idx_pack_objectives_locale_id ON pack_objectives (locale_id);

CREATE TABLE IF NOT EXISTS pack_scenarios (
    id INT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    FOREIGN KEY (id) REFERENCES outcome_packs_versions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pack_scenarios_name ON pack_scenarios (name);

CREATE TABLE IF NOT EXISTS outcome_packs (
    id INT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    version INT DEFAULT 1,
    FOREIGN KEY (id) REFERENCES outcome_pack_versions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_outcome_packs_name ON outcome_packs (name);

CREATE TABLE IF NOT EXISTS outcome_pack_versions (
    id INT PRIMARY KEY,
    pack_id INT NOT NULL REFERENCES outcome_packs(id),
    version INT NOT NULL UNIQUE,
    data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (pack_id) REFERENCES outcome_packs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_outcome_pack_versions_version ON outcome_pack_versions (version);
