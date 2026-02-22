-- backend/migrations/2026_02_20_add_monetization_trust_signals.sql

CREATE TABLE IF NOT EXISTS refund_events (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    game_id BIGINT NOT NULL,
    event_time TIMESTAMP NOT NULL,
    amount DECIMAL(18, 2) NOT NULL,
    reason VARCHAR(255) NOT NULL,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chargeback_events (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    game_id BIGINT NOT NULL,
    event_time TIMESTAMP NOT NULL,
    amount DECIMAL(18, 2) NOT NULL,
    reason VARCHAR(255) NOT NULL,
    refund_event_id BIGINT,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
    FOREIGN KEY (refund_event_id) REFERENCES refund_events(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS sentiment_flags (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    game_id BIGINT NOT NULL,
    event_time TIMESTAMP NOT NULL,
    sentiment ENUM('positive', 'neutral', 'negative') NOT NULL,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ladder_participation_snapshots (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    game_id BIGINT NOT NULL,
    snapshot_time TIMESTAMP NOT NULL,
    player_id BIGINT NOT NULL,
    rank INT NOT NULL,
    score DECIMAL(18, 2) NOT NULL,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

-- Indexes for faster query performance
CREATE INDEX IF NOT EXISTS idx_refund_events_game_id ON refund_events (game_id);
CREATE INDEX IF NOT EXISTS idx_chargeback_events_refund_event_id ON chargeback_events (refund_event_id);
CREATE INDEX IF NOT EXISTS idx_ladder_participation_snapshots_game_id ON ladder_participation_snapshots (game_id);
