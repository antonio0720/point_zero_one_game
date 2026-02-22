-- File: backend/migrations/2026_02_20_add_run_explorer_read_model.sql

CREATE TABLE IF NOT EXISTS run_explorer_public (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    run_id BIGINT NOT NULL,
    proof_hash CHAR(64) NOT NULL,
    status ENUM('pending', 'success', 'failure') NOT NULL,
    summary_json JSON NOT NULL,
    pivots_json JSON NOT NULL,
    ruleset_hash CHAR(64),
    deck_version VARCHAR(255),
    visibility ENUM('public', 'private') NOT NULL DEFAULT 'public',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMP,

    FOREIGN KEY (run_id) REFERENCES runs(id),
    INDEX run_id (run_id),
    INDEX proof_hash (proof_hash),
    INDEX visibility (visibility)
);
