-- Point Zero One Digital - Backend Migrations - 2026-02-20 - Add Benchmarks

CREATE TABLE IF NOT EXISTS benchmark_runs (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL REFERENCES games(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(255) NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed'))
);

CREATE TABLE IF NOT EXISTS benchmark_attempts (
    id SERIAL PRIMARY KEY,
    run_id INTEGER NOT NULL REFERENCES benchmark_runs(id),
    attempt_number INTEGER NOT NULL CHECK (attempt_number > 0),
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(255) NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed'))
);

CREATE TABLE IF NOT EXISTS benchmark_outputs (
    id SERIAL PRIMARY KEY,
    attempt_id INTEGER NOT NULL REFERENCES benchmark_attempts(id),
    output_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS benchmark_scoring_profiles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    scoring_function TEXT NOT NULL,
    FOREIGN KEY (id) REFERENCES benchmark_runs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_benchmark_runs_game_id ON benchmark_runs (game_id);
CREATE INDEX IF NOT EXISTS idx_benchmark_attempts_run_id ON benchmark_attempts (run_id);
