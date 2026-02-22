-- Point Zero One Digital - Creator Profiles Migration (v2026_02_20)

CREATE TABLE IF NOT EXISTS creators (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash CHAR(60) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS creator_level_state (
    creator_id INT NOT NULL,
    level INT NOT NULL,
    experience INT NOT NULL,
    currency_balance DECIMAL(18, 2) NOT NULL,
    PRIMARY KEY (creator_id),
    FOREIGN KEY (creator_id) REFERENCES creators(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS creator_permissions_cache (
    creator_id INT NOT NULL,
    permissions JSON NOT NULL,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (creator_id),
    FOREIGN KEY (creator_id) REFERENCES creators(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS creator_history_receipts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    creator_id INT NOT NULL,
    transaction_type ENUM('income', 'expense') NOT NULL,
    amount DECIMAL(18, 2) NOT NULL,
    description TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (creator_id) REFERENCES creators(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS creator_history_receipts_creator_id_idx ON creator_history_receipts (creator_id);
