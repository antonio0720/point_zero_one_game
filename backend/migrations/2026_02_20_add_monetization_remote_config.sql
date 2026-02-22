-- Point Zero One Digital - Backend Migrations - 2026_02_20_add_monetization_remote_config.sql

CREATE TABLE IF NOT EXISTS rc_namespaces (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rc_versions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    namespace_id INT NOT NULL REFERENCES rc_namespaces(id),
    version VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (namespace_id) REFERENCES rc_namespaces(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rc_rollouts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    version_id INT NOT NULL REFERENCES rc_versions(id),
    percentage SMALLINT UNSIGNED NOT NULL CHECK (percentage BETWEEN 0 AND 100),
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP,
    FOREIGN KEY (version_id) REFERENCES rc_versions(id) ON DELETE CASCADE,
    INDEX idx_rollouts_end_time (end_time),
    CONSTRAINT chk_rollouts_end_time CHECK (end_time IS NULL OR end_time >= start_time)
);

CREATE TABLE IF NOT EXISTS rc_audit_log (
    id INT PRIMARY KEY AUTO_INCREMENT,
    rollout_id INT NOT NULL REFERENCES rc_rollouts(id),
    user_id INT NOT NULL,
    action VARCHAR(255) NOT NULL,
    data JSON DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (rollout_id) REFERENCES rc_rollouts(id) ON DELETE CASCADE,
    INDEX idx_audit_log_user_id (user_id),
    CONSTRAINT chk_audit_log_action CHECK (action IN ('create', 'update', 'delete'))
);

CREATE TABLE IF NOT EXISTS rc_guardrail_blocks (
    id INT PRIMARY KEY AUTO_INCREMENT,
    rollout_id INT NOT NULL REFERENCES rc_rollouts(id),
    guardrail VARCHAR(255) NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (rollout_id) REFERENCES rc_rollouts(id) ON DELETE CASCADE,
    INDEX idx_guardrail_blocks_rollout_id (rollout_id),
    UNIQUE (rollout_id, guardrail)
);
