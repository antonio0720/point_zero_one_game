-- backend/migrations/0010_runs.sql

CREATE TYPE IF NOT EXISTS run_event AS (
    id SERIAL PRIMARY KEY,
    run_id INTEGRITY CHECK (run_id REFERENCES runs(id)),
    event_type VARCHAR(255) NOT NULL,
    data JSONB
);

CREATE TYPE IF NOT EXISTS run_outcome AS (
    id SERIAL PRIMARY KEY,
    run_id INTEGRITY CHECK (run_id REFERENCES runs(id)),
    outcome VARCHAR(255) NOT NULL,
    data JSONB
);

CREATE TYPE IF NOT EXISTS run_goal AS (
    id SERIAL PRIMARY KEY,
    run_id INTEGRITY CHECK (run_id REFERENCES runs(id)),
    goal VARCHAR(255) NOT NULL,
    status BOOLEAN DEFAULT false
);

CREATE TYPE IF NOT EXISTS run_profile AS (
    id SERIAL PRIMARY KEY,
    user_id INTEGRITY CHECK (user_id REFERENCES users(id)),
    session_id INTEGRITY CHECK (session_id REFERENCES sessions(id)),
    run_id INTEGRITY CHECK (run_id REFERENCES runs(id)),
    profile JSONB
);

CREATE TABLE IF NOT EXISTS runs (
    id SERIAL PRIMARY KEY,
    user_id INTEGRITY CHECK (user_id REFERENCES users(id)),
    session_id INTEGRITY CHECK (session_id REFERENCES sessions(id)),
    seed_commit VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE (user_id, session_id)
);

CREATE TABLE IF NOT EXISTS run_turns (
    id SERIAL PRIMARY KEY,
    run_id INTEGRITY CHECK (run_id REFERENCES runs(id)),
    turn INTEGER NOT NULL,
    UNIQUE (run_id, turn)
);

CREATE INDEX IF NOT EXISTS idx_runs_user_id ON runs (user_id);
CREATE INDEX IF NOT EXISTS idx_runs_session_id ON runs (session_id);
