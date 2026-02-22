-- File: backend/migrations/0053_generational.sql

CREATE TYPE IF NOT EXISTS bloodline_json AS JSON;
CREATE TYPE IF NOT EXISTS generation_event_outcome AS ENUM ('success', 'failure');

CREATE TABLE IF NOT EXISTS bloodlines (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    current_generation INTEGER NOT NULL,
    bloodline_json bloodline_json,
    UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS generation_events (
    id SERIAL PRIMARY KEY,
    bloodline_id INTEGER REFERENCES bloodlines(id),
    generation INTEGER NOT NULL,
    parent_run_id INTEGER, -- Optional, nullable for standalone events
    inherited_state_json json,
    outcome generation_event_outcome,
    UNIQUE (bloodline_id, generation)
);

CREATE INDEX IF NOT EXISTS idx_bloodlines_user_id ON bloodlines(user_id);
CREATE INDEX IF NOT EXISTS idx_generation_events_parent_run_id ON generation_events(parent_run_id);
