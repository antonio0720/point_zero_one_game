-- Point Zero One Digital - Monetization Policy Versions Table
-- CREATE IF NOT EXISTS for idempotency

CREATE TABLE IF NOT EXISTS monetization_policy_versions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    version VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    description TEXT,
    is_active BOOLEAN DEFAULT FALSE,
    UNIQUE INDEX (version)
);

-- Point Zero One Digital - Policy Rollouts Table
-- CREATE IF NOT EXISTS for idempotency

CREATE TABLE IF NOT EXISTS policy_rollouts (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    monetization_policy_version_id BIGINT NOT NULL,
    game_session_id BIGINT NOT NULL,
    rollout_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (monetization_policy_version_id) REFERENCES monetization_policy_versions(id),
    UNIQUE INDEX (game_session_id, monetization_policy_version_id),
    INDEX (monetization_policy_version_id)
);

-- Point Zero One Digital - Policy Audit Log Table
-- CREATE IF NOT EXISTS for idempotency

CREATE TABLE IF NOT EXISTS policy_audit_log (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    monetization_policy_version_id BIGINT NOT NULL,
    game_session_id BIGINT NOT NULL,
    event_type ENUM('create', 'update', 'delete') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE INDEX (monetization_policy_version_id, game_session_id, event_type),
    FOREIGN KEY (monetization_policy_version_id) REFERENCES monetization_policy_versions(id),
    INDEX (monetization_policy_version_id)
);
