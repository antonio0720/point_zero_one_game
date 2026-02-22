-- Point Zero One Digital - Backend Migrations - 2026_02_20_add_death_autopsy_snippets.sql

CREATE TABLE IF NOT EXISTS autopsy_snippets (
    id INT PRIMARY KEY AUTO_INCREMENT,
    game_id INT NOT NULL,
    death_time TIMESTAMP NOT NULL,
    snippet_type ENUM('script', 'art', 'sound') NOT NULL,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS snippet_segments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    autopsy_snippet_id INT NOT NULL,
    segment_index INT NOT NULL,
    segment_data LONGTEXT NOT NULL,
    FOREIGN KEY (autopsy_snippet_id) REFERENCES autopsy_snippets(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS snippet_assets (
    id INT PRIMARY KEY AUTO_INCREMENT,
    snippet_segment_id INT NOT NULL,
    asset_type ENUM('script', 'art', 'sound') NOT NULL,
    asset_data LONGTEXT NOT NULL,
    FOREIGN KEY (snippet_segment_id) REFERENCES snippet_segments(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS snippet_jobs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    autopsy_snippet_id INT NOT NULL,
    job_status ENUM('pending', 'processing', 'completed', 'failed') NOT NULL,
    job_start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (autopsy_snippet_id) REFERENCES autopsy_snippets(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS snippet_failures (
    id INT PRIMARY KEY AUTO_INCREMENT,
    snippet_job_id INT NOT NULL,
    failure_reason TEXT NOT NULL,
    FOREIGN KEY (snippet_job_id) REFERENCES snippet_jobs(id) ON DELETE CASCADE
);

-- Indexes for faster querying
CREATE INDEX IF NOT EXISTS idx_autopsy_snippets_game_id ON autopsy_snippets (game_id);
CREATE INDEX IF NOT EXISTS idx_snippet_segments_autopsy_snippet_id ON snippet_segments (autopsy_snippet_id);
CREATE INDEX IF NOT EXISTS idx_snippet_assets_snippet_segment_id ON snippet_assets (snippet_segment_id);
CREATE INDEX IF NOT EXISTS idx_snippet_jobs_autopsy_snippet_id ON snippet_jobs (autopsy_snippet_id);
