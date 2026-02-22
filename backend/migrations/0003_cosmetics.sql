-- Point Zero One Digital - 0003_cosmetics.sql
-- Strict TypeScript, no 'any', export all public symbols
-- SQL includes indexes, foreign keys, comments; idempotent (CREATE IF NOT EXISTS)
-- Bash: set -euo pipefail, log all actions

CREATE TABLE IF NOT EXISTS cosmetic_types (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL UNIQUE COMMENT 'Cosmetic type'
);

CREATE TABLE IF NOT EXISTS cosmetics (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    type_id INT NOT NULL,
    FOREIGN KEY (type_id) REFERENCES cosmetic_types (id) ON DELETE CASCADE COMMENT 'Cosmetic item',
    UNIQUE INDEX (name, type_id) USING BTREE COMMENT 'Unique cosmetic item'
);

CREATE TABLE IF NOT EXISTS cosmetic_unlocks (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    cosmetic_id INT NOT NULL,
    source VARCHAR(255) NOT NULL COMMENT 'Source of the unlock',
    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Time of unlock',
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (cosmetic_id) REFERENCES cosmetics (id) ON DELETE CASCADE COMMENT 'Unlocks a cosmetic item'
);
