-- Point Zero One Digital - Backend Migrations - 2026_02_20_add_moderation_evidence.sql

CREATE TABLE IF NOT EXISTS toxicity_scans (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    game_id BIGINT NOT NULL,
    scan_timestamp TIMESTAMP NOT NULL,
    player_id BIGINT NOT NULL,
    score DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (game_id) REFERENCES games (id),
    FOREIGN KEY (player_id) REFERENCES players (id)
);

CREATE TABLE IF NOT EXISTS moderation_actions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    action_timestamp TIMESTAMP NOT NULL,
    action_type ENUM('mute', 'ban', 'warning') NOT NULL,
    reason TEXT NOT NULL,
    moderator_id BIGINT NOT NULL,
    player_id BIGINT NOT NULL,
    game_id BIGINT NOT NULL,
    FOREIGN KEY (moderator_id) REFERENCES users (id),
    FOREIGN KEY (player_id) REFERENCES players (id),
    FOREIGN KEY (game_id) REFERENCES games (id)
);

CREATE TABLE IF NOT EXISTS evidence_chain_refs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    moderation_action_id BIGINT NOT NULL,
    evidence_item_id BIGINT NOT NULL,
    position INT NOT NULL,
    FOREIGN KEY (moderation_action_id) REFERENCES moderation_actions (id),
    FOREIGN KEY (evidence_item_id) REFERENCES evidence_items (id)
);

CREATE TABLE IF NOT EXISTS admin_forensic_bundles (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    bundle_name VARCHAR(255) NOT NULL UNIQUE,
    moderation_action_id BIGINT NOT NULL,
    FOREIGN KEY (moderation_action_id) REFERENCES moderation_actions (id)
);

CREATE TABLE IF NOT EXISTS appeals (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    appeal_timestamp TIMESTAMP NOT NULL,
    appeal_status ENUM('accepted', 'rejected', 'under_review') NOT NULL,
    moderator_id BIGINT NOT NULL,
    player_id BIGINT NOT NULL,
    game_id BIGINT NOT NULL,
    moderation_action_id BIGINT NOT NULL,
    FOREIGN KEY (moderator_id) REFERENCES users (id),
    FOREIGN KEY (player_id) REFERENCES players (id),
    FOREIGN KEY (game_id) REFERENCES games (id),
    FOREIGN KEY (moderation_action_id) REFERENCES moderation_actions (id)
);

CREATE INDEX IF NOT EXISTS idx_moderation_actions_player_id ON moderation_actions (player_id);
CREATE INDEX IF NOT EXISTS idx_moderation_actions_game_id ON moderation_actions (game_id);
CREATE INDEX IF NOT EXISTS idx_evidence_chain_refs_position ON evidence_chain_refs (position);
CREATE INDEX IF NOT EXISTS idx_admin_forensic_bundles_moderation_action_id ON admin_forensic_bundles (moderation_action_id);
CREATE INDEX IF NOT EXISTS idx_appeals_player_id ON appeals (player_id);
CREATE INDEX IF NOT EXISTS idx_appeals_game_id ON appeals (game_id);
CREATE INDEX IF NOT EXISTS idx_appeals_moderation_action_id ON appeals (moderation_action_id);
