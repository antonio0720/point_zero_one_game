-- File: backend/migrations/2026_02_20_add_onboarding_metrics.sql

CREATE TABLE IF NOT EXISTS conversion_events (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    game_session_id BIGINT NOT NULL,
    event_type VARCHAR(255) NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    FOREIGN KEY (game_session_id) REFERENCES game_sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS share_events (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    game_session_id BIGINT NOT NULL,
    shared_with VARCHAR(255) NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    FOREIGN KEY (game_session_id) REFERENCES game_sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS proof_events (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    game_session_id BIGINT NOT NULL,
    proof_type VARCHAR(255) NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    FOREIGN KEY (game_session_id) REFERENCES game_sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS onboarding_metric_rollups (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    day DATE NOT NULL,
    conversion_count BIGINT DEFAULT 0,
    share_count BIGINT DEFAULT 0,
    proof_count BIGINT DEFAULT 0,
    UNIQUE (day),
    INDEX (game_session_id),
    FOREIGN KEY (game_session_id) REFERENCES game_sessions(id) ON DELETE CASCADE
);
