-- Point Zero One Digital - Telemetry Raw Table
-- CREATE IF NOT EXISTS for idempotency

CREATE TABLE telemetry_raw (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    game_session_id BIGINT NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    event_type VARCHAR(255) NOT NULL,
    event_data JSON NOT NULL,
    FOREIGN KEY (game_session_id) REFERENCES game_sessions(id) ON DELETE CASCADE
);

CREATE INDEX telemetry_raw_game_session_id_idx ON telemetry_raw (game_session_id);

-- Point Zero One Digital - Telemetry Batches Table
-- CREATE IF NOT EXISTS for idempotency

CREATE TABLE telemetry_batches (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    game_session_id BIGINT NOT NULL,
    batch_number INT NOT NULL,
    created_at TIMESTAMP NOT NULL,
    processed_at TIMESTAMP,
    status ENUM('pending', 'processing', 'success', 'error') NOT NULL DEFAULT 'pending',
    FOREIGN KEY (game_session_id) REFERENCES game_sessions(id) ON DELETE CASCADE
);

CREATE INDEX telemetry_batches_game_session_id_idx ON telemetry_batches (game_session_id);

-- Point Zero One Digital - Telemetry Ingest Errors Table
-- CREATE IF NOT EXISTS for idempotency

CREATE TABLE telemetry_ingest_errors (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    telemetry_raw_id BIGINT NOT NULL,
    error_message TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL,
    FOREIGN KEY (telemetry_raw_id) REFERENCES telemetry_raw(id) ON DELETE CASCADE
);

CREATE INDEX telemetry_ingest_errors_telemetry_raw_id_idx ON telemetry_ingest_errors (telemetry_raw_id);

-- Point Zero One Digital - Telemetry Schema Registry Table
-- CREATE IF NOT EXISTS for idempotency

CREATE TABLE telemetry_schema_registry (
    version INT PRIMARY KEY,
    schema JSON NOT NULL
);
