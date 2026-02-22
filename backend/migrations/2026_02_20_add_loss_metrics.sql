-- File: backend/migrations/2026_02_20_add_loss_metrics.sql

CREATE TABLE IF NOT EXISTS loss_metrics (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    game_id BIGINT NOT NULL,
    session_id BIGINT NOT NULL,
    metric_type ENUM('daily', 'fork', 'training', 'share') NOT NULL,
    value DECIMAL(20, 8) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS loss_metrics_game_id_session_id_idx ON loss_metrics (game_id, session_id);
CREATE INDEX IF NOT EXISTS loss_metrics_metric_type_idx ON loss_metrics (metric_type);

-- Fork Metrics Table
CREATE TABLE IF NOT EXISTS fork_metrics (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    game_id BIGINT NOT NULL,
    parent_fork_id BIGINT DEFAULT NULL,
    metric_type ENUM('daily', 'fork', 'training', 'share') NOT NULL,
    value DECIMAL(20, 8) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_fork_id) REFERENCES fork_metrics(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS fork_metrics_game_id_idx ON fork_metrics (game_id);
CREATE INDEX IF NOT EXISTS fork_metrics_parent_fork_id_idx ON fork_metrics (parent_fork_id);
CREATE INDEX IF NOT EXISTS fork_metrics_metric_type_idx ON fork_metrics (metric_type);

-- Training Metrics Table
CREATE TABLE IF NOT EXISTS training_metrics (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    game_id BIGINT NOT NULL,
    session_id BIGINT NOT NULL,
    metric_type ENUM('daily', 'fork', 'training', 'share') NOT NULL,
    value DECIMAL(20, 8) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS training_metrics_game_id_session_id_idx ON training_metrics (game_id, session_id);
CREATE INDEX IF NOT EXISTS training_metrics_metric_type_idx ON training_metrics (metric_type);

-- Share Metrics Table
CREATE TABLE IF NOT EXISTS share_metrics (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    game_id BIGINT NOT NULL,
    session_id BIGINT NOT NULL,
    metric_type ENUM('daily', 'fork', 'training', 'share') NOT NULL,
    value DECIMAL(20, 8) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS share_metrics_game_id_session_id_idx ON share_metrics (game_id, session_id);
CREATE INDEX IF NOT EXISTS share_metrics_metric_type_idx ON share_metrics (metric_type);
