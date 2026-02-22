-- Point Zero One Digital - Backend Migrations - 2026_02_20_add_season0_tables.sql

CREATE TABLE IF NOT EXISTS seasons (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT FALSE,
    UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS season_memberships (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    season_id INT NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE (user_id, season_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (season_id) REFERENCES seasons(id)
);

CREATE TABLE IF NOT EXISTS founder_artifact_bundles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    season_id INT NOT NULL,
    artifact_id INT NOT NULL,
    quantity INT NOT NULL,
    UNIQUE (season_id, artifact_id),
    FOREIGN KEY (season_id) REFERENCES seasons(id),
    FOREIGN KEY (artifact_id) REFERENCES artifacts(id)
);

CREATE TABLE IF NOT EXISTS cosmetic_unlocks (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    cosmetic_id INT NOT NULL,
    unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE (user_id, cosmetic_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (cosmetic_id) REFERENCES cosmetics(id)
);

CREATE TABLE IF NOT EXISTS streak_state (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    current_streak INT DEFAULT 0,
    longest_streak INT DEFAULT 0,
    UNIQUE (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS receipts_ledger (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    transaction_type ENUM('purchase', 'refund') NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE (user_id, transaction_type),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_season_memberships_user_id ON season_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_season_memberships_season_id ON season_memberships(season_id);
CREATE INDEX IF NOT EXISTS idx_founder_artifact_bundles_season_id ON founder_artifact_bundles(season_id);
CREATE INDEX IF NOT EXISTS idx_founder_artifact_bundles_artifact_id ON founder_artifact_bundles(artifact_id);
CREATE INDEX IF NOT EXISTS idx_cosmetic_unlocks_user_id ON cosmetic_unlocks(user_id);
CREATE INDEX IF NOT EXISTS idx_cosmetic_unlocks_cosmetic_id ON cosmetic_unlocks(cosmetic_id);
CREATE INDEX IF NOT EXISTS idx_streak_state_user_id ON streak_state(user_id);
CREATE INDEX IF NOT EXISTS idx_receipts_ledger_user_id ON receipts_ledger(user_id);
