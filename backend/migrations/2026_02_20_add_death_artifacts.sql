-- Point Zero One Digital - Backend Migrations - 2026_02_20_add_death_artifacts.sql

SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS death_artifacts (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    game_id BIGINT UNSIGNED NOT NULL,
    player_id BIGINT UNSIGNED NOT NULL,
    artifact_id BIGINT UNSIGNED NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (game_id) REFERENCES games (id),
    FOREIGN KEY (player_id) REFERENCES players (id),
    FOREIGN KEY (artifact_id) REFERENCES artifacts (id),
    INDEX idx_death_artifacts_game_id (game_id),
    INDEX idx_death_artifacts_player_id (player_id),
    INDEX idx_death_artifacts_artifact_id (artifact_id)
);

CREATE TABLE IF NOT EXISTS death_delta_strips (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    game_id BIGINT UNSIGNED NOT NULL,
    player_id BIGINT UNSIGNED NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    delta_strips LONGBLOB NOT NULL,
    FOREIGN KEY (game_id) REFERENCES games (id),
    FOREIGN KEY (player_id) REFERENCES players (id),
    INDEX idx_death_delta_strips_game_id (game_id),
    INDEX idx_death_delta_strips_player_id (player_id)
);

CREATE TABLE IF NOT EXISTS survival_hints (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    game_id BIGINT UNSIGNED NOT NULL,
    player_id BIGINT UNSIGNED NOT NULL,
    hint TEXT NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (game_id) REFERENCES games (id),
    FOREIGN KEY (player_id) REFERENCES players (id),
    INDEX idx_survival_hints_game_id (game_id),
    INDEX idx_survival_hints_player_id (player_id)
);

CREATE TABLE IF NOT EXISTS share_renders (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    game_id BIGINT UNSIGNED NOT NULL,
    player_id BIGINT UNSIGNED NOT NULL,
    render LONGBLOB NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (game_id) REFERENCES games (id),
    FOREIGN KEY (player_id) REFERENCES players (id),
    INDEX idx_share_renders_game_id (game_id),
    INDEX idx_share_renders_player_id (player_id)
);

CREATE TABLE IF NOT EXISTS death_artifact_receipts (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    game_id BIGINT UNSIGNED NOT NULL,
    player_id BIGINT UNSIGNED NOT NULL,
    artifact_id BIGINT UNSIGNED NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (game_id) REFERENCES games (id),
    FOREIGN KEY (player_id) REFERENCES players (id),
    FOREIGN KEY (artifact_id) REFERENCES artifacts (id),
    INDEX idx_death_artifact_receipts_game_id (game_id),
    INDEX idx_death_artifact_receipts_player_id (player_id),
    INDEX idx_death_artifact_receipts_artifact_id (artifact_id)
);

SET FOREIGN_KEY_CHECKS = 1;
