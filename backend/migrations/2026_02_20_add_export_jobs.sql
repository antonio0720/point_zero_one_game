-- File: backend/migrations/2026_02_20_add_export_jobs.sql

CREATE TABLE IF NOT EXISTS export_jobs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    game_id BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    status ENUM('pending', 'in_progress', 'completed', 'failed') NOT NULL,
    ttl_retention INTEGER NOT NULL,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS export_artifacts (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    export_job_id BIGINT NOT NULL,
    artifact_type ENUM('save', 'log') NOT NULL,
    data LONGBLOB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (export_job_id) REFERENCES export_jobs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS export_audit_log (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    export_job_id BIGINT NOT NULL,
    event ENUM('start', 'progress', 'complete', 'fail') NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (export_job_id) REFERENCES export_jobs(id) ON DELETE CASCADE
);

-- Indexes for faster query performance
CREATE INDEX IF NOT EXISTS idx_export_jobs_game_id ON export_jobs (game_id);
CREATE INDEX IF NOT EXISTS idx_export_artifacts_export_job_id ON export_artifacts (export_job_id);
CREATE INDEX IF NOT EXISTS idx_export_audit_log_export_job_id ON export_audit_log (export_job_id);
