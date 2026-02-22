-- Point Zero One Digital - Backend Migration Script - 2026-02-20 - Add Feature Flags Seed

CREATE TABLE IF NOT EXISTS feature_flags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    enabled BOOLEAN DEFAULT false,
    cohorts JSONB[] DEFAULT '{}',
    rollout_percent FLOAT8 DEFAULT 0.0
);

-- Season0 Feature Flags Seed Data
INSERT INTO feature_flags (name, enabled, cohorts, rollout_percent) VALUES
    ('season0_flag1', true, ARRAY['cohort1', 'cohort2'], 50.0),
    ('season0_flag2', false, ARRAY[], 0.0);
