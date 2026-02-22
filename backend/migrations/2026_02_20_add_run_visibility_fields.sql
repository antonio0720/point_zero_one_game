-- File: backend/migrations/2026_02_20_add_run_visibility_fields.sql

-- Add per-run visibility + indexing flags to run_snapshots (or dedicated table)
-- to support Public/Unlisted/Private explorer access

CREATE TABLE IF NOT EXISTS run_snapshots (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    run_id BIGINT NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    visibility ENUM('public', 'unlisted', 'private') NOT NULL DEFAULT 'private',
    index (run_id),
    INDEX idx_visibility (visibility)
);

CREATE TABLE IF NOT EXISTS run_visibilities (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    run_id BIGINT NOT NULL,
    visibility ENUM('public', 'unlisted', 'private') NOT NULL DEFAULT 'private',
    UNIQUE INDEX idx_run_visibility (run_id, visibility)
);

ALTER TABLE run_snapshots ADD FOREIGN KEY (run_id) REFERENCES run_visibilities(run_id);
