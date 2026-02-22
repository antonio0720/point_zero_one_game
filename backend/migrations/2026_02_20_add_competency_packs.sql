-- Point Zero One Digital - Backend Migrations - 2026_02_20_add_competency_packs.sql

CREATE TABLE IF NOT EXISTS competency_packs (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_competency_packs_name ON competency_packs (name);

CREATE TYPE IF NOT EXISTS pack_version AS (
    id SERIAL PRIMARY KEY,
    pack_id INTEGER REFERENCES competency_packs(id),
    version VARCHAR(10) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pack_versions_pack_id ON pack_versions (pack_id);

CREATE TYPE IF NOT EXISTS pack_scenario AS (
    id SERIAL PRIMARY KEY,
    version_id INTEGER REFERENCES pack_versions(id),
    scenario VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pack_scenarios_version_id ON pack_scenarios (version_id);

CREATE TYPE IF NOT EXISTS pack_rubric AS (
    id SERIAL PRIMARY KEY,
    scenario_id INTEGER REFERENCES pack_scenarios(id),
    rubric VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pack_rubrics_scenario_id ON pack_rubric (scenario_id);

CREATE TYPE IF NOT EXISTS pack_debrief_card AS (
    id SERIAL PRIMARY KEY,
    rubric_id INTEGER REFERENCES pack_rubric(id),
    card VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pack_debrief_cards_rubric_id ON pack_debrief_cards (rubric_id);
