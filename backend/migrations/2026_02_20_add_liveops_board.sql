-- Point Zero One Digital - Backend Migrations - 2026_02_20_add_liveops_board.sql

CREATE TABLE IF NOT EXISTS ops_board_snapshots_daily (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    UNIQUE (game_id, timestamp)
);

CREATE TABLE IF NOT EXISTS ops_board_snapshot_items (
    id SERIAL PRIMARY KEY,
    snapshot_id INTEGER REFERENCES ops_board_snapshots_daily(id),
    item_type VARCHAR(255) NOT NULL,
    item_data JSONB NOT NULL,
    UNIQUE (snapshot_id, item_type)
);

CREATE TABLE IF NOT EXISTS ops_board_notes (
    id SERIAL PRIMARY KEY,
    snapshot_id INTEGER REFERENCES ops_board_snapshots_daily(id),
    note TEXT NOT NULL,
    author VARCHAR(255) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS ops_actions (
    id SERIAL PRIMARY KEY,
    snapshot_id INTEGER REFERENCES ops_board_snapshots_daily(id),
    action_type VARCHAR(255) NOT NULL,
    action_data JSONB NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Indexes for foreign key constraints
CREATE INDEX IF NOT EXISTS ops_board_snapshots_daily_game_id_idx ON ops_board_snapshots_daily (game_id);
