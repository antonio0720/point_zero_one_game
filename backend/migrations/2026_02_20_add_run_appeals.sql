-- File: backend/migrations/2026_02_20_add_run_appeals.sql

CREATE TABLE IF NOT EXISTS run_appeals (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    run_id BIGINT NOT NULL,
    player_id BIGINT NOT NULL,
    status ENUM('pending', 'approved', 'denied') NOT NULL,
    submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY (run_id, player_id)
);

CREATE TABLE IF NOT EXISTS run_appeal_events (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    run_appeal_id BIGINT NOT NULL,
    event_type ENUM('created', 'updated', 'approved', 'denied') NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY (run_appeal_id, event_type)
);

CREATE TABLE IF NOT EXISTS run_appeal_rate_limits (
    player_id BIGINT PRIMARY KEY,
    run_id BIGINT NOT NULL,
    submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    remaining_attempts INT NOT NULL DEFAULT 3,
    UNIQUE KEY (player_id, run_id),
    FOREIGN KEY (player_id) REFERENCES players(id),
    FOREIGN KEY (run_id) REFERENCES runs(id)
);

-- Indexes on run_appeals table
CREATE INDEX IF NOT EXISTS idx_run_appeals_run_id ON run_appeals (run_id);
CREATE INDEX IF NOT EXISTS idx_run_appeals_status ON run_appeals (status);
CREATE INDEX IF NOT EXISTS idx_run_appeals_submitted_at ON run_appeals (submitted_at);

-- Indexes on run_appeal_events table
CREATE INDEX IF NOT EXISTS idx_run_appeal_events_run_appeal_id ON run_appeal_events (run_appeal_id);
CREATE INDEX IF NOT EXISTS idx_run_appeal_events_event_type ON run_appeal_events (event_type);
