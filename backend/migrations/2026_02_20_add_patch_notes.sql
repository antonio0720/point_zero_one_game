-- Point Zero One Digital - Backend Migrations - 2026-02-20 - Add Patch Note Cards, Versions, Rollouts, and Views

CREATE TABLE IF NOT EXISTS patch_note_cards (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    image_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS patch_note_versions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    version VARCHAR(10) NOT NULL UNIQUE,
    release_date DATE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (id) REFERENCES patch_note_cards(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS patch_note_rollouts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    version_id INT NOT NULL,
    percentage_affected FLOAT NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    FOREIGN KEY (version_id) REFERENCES patch_note_versions(id) ON DELETE CASCADE,
    INDEX idx_start_end_time (start_time, end_time),
    CONSTRAINT chk_rollout_duration CHECK (end_time >= start_time)
);

CREATE TABLE IF NOT EXISTS patch_note_views (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    version_id INT NOT NULL,
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (version_id) REFERENCES patch_note_versions(id) ON DELETE CASCADE,
    INDEX idx_user_version (user_id, version_id),
    CONSTRAINT chk_viewed_once PERIOD FOR EACH ROW CHECK (NOT EXISTS (SELECT 1 FROM patch_note_views WHERE user_id = old.user_id AND version_id = old.version_id))
);
