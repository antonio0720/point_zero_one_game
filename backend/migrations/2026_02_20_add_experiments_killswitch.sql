-- Point Zero One Digital - Experiment Management Tables
-- Strict TypeScript, no 'any', export all public symbols
-- SQL: includes indexes, foreign keys, comments; idempotent (CREATE IF NOT EXISTS)
-- Bash: set -euo pipefail, log all actions

CREATE TABLE IF NOT EXISTS experiment_defs (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    start_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP WITH TIME ZONE,
    active BOOLEAN DEFAULT TRUE,
    UNIQUE (name)
);

CREATE INDEX IF NOT EXISTS experiment_defs_active_idx ON experiment_defs (active);

CREATE TABLE IF NOT EXISTS experiment_assignments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    experiment_id INTEGER REFERENCES experiment_defs(id) NOT NULL,
    assignment_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, experiment_id),
    FOREIGN KEY (user_id, experiment_id) REFERENCES user_experiment_assignments(user_id, experiment_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS experiment_assignments_user_idx ON experiment_assignments (user_id);
CREATE INDEX IF NOT EXISTS experiment_assignments_experiment_idx ON experiment_assignments (experiment_id);

CREATE TABLE IF NOT EXISTS experiment_metrics_snapshots (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    experiment_id INTEGER REFERENCES experiment_defs(id) NOT NULL,
    snapshot_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    score DECIMAL(10, 2),
    coins INTEGER,
    lives INTEGER,
    UNIQUE (user_id, experiment_id, snapshot_time)
);

CREATE INDEX IF NOT EXISTS experiment_metrics_snapshots_user_idx ON experiment_metrics_snapshots (user_id);
CREATE INDEX IF NOT EXISTS experiment_metrics_snapshots_experiment_idx ON experiment_metrics_snapshots (experiment_id);
CREATE INDEX IF NOT EXISTS experiment_metrics_snapshots_time_idx ON experiment_metrics_snapshots (snapshot_time);

CREATE TABLE IF NOT EXISTS experiment_killswitch_events (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    experiment_id INTEGER REFERENCES experiment_defs(id) NOT NULL,
    event_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reason VARCHAR(255),
    UNIQUE (user_id, experiment_id, event_time)
);

CREATE INDEX IF NOT EXISTS experiment_killswitch_events_user_idx ON experiment_killswitch_events (user_id);
CREATE INDEX IF NOT EXISTS experiment_killswitch_events_experiment_idx ON experiment_killswitch_events (experiment_id);
CREATE INDEX IF NOT EXISTS experiment_killswitch_events_time_idx ON experiment_killswitch_events (event_time);
