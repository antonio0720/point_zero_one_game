-- Point Zero One Digital - Backend Migrations - 2026_02_20_add_curriculum_measurements.sql

CREATE TABLE IF NOT EXISTS scenario_attempt_aggregates (
    id SERIAL PRIMARY KEY,
    scenario_id INTEGER NOT NULL REFERENCES scenarios(id),
    attempt_number INTEGER NOT NULL,
    score DECIMAL(10, 2) NOT NULL,
    completion_time TIMESTAMP WITH TIME ZONE NOT NULL,
    UNIQUE (scenario_id, attempt_number)
);

CREATE TABLE IF NOT EXISTS failure_mode_aggregates (
    id SERIAL PRIMARY KEY,
    scenario_id INTEGER NOT NULL REFERENCES scenarios(id),
    failure_mode_id INTEGER NOT NULL REFERENCES failure_modes(id),
    count INTEGER NOT NULL,
    UNIQUE (scenario_id, failure_mode_id)
);

CREATE TABLE IF NOT EXISTS improvement_deltas (
    id SERIAL PRIMARY KEY,
    scenario_attempt_aggregate_id INTEGER NOT NULL REFERENCES scenario_attempt_aggregates(id),
    previous_score DECIMAL(10, 2) NOT NULL,
    current_score DECIMAL(10, 2) NOT NULL,
    improvement_percentage DECIMAL(5, 3) NOT NULL,
    UNIQUE (scenario_attempt_aggregate_id, previous_score, current_score)
);

CREATE TABLE IF NOT EXISTS risk_literacy_scores (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    score DECIMAL(10, 2) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    UNIQUE (user_id, timestamp)
);

CREATE TABLE IF NOT EXISTS dashboard_snapshots (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    snapshot_data JSONB NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    UNIQUE (user_id, timestamp)
);
