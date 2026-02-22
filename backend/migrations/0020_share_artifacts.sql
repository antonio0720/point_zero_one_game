-- File: backend/migrations/0020_share_artifacts.sql

CREATE TABLE IF NOT EXISTS share_artifacts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    run_id INT NOT NULL,
    artifact_type ENUM('share', 'card_rendered') NOT NULL,
    status ENUM('pending', 'success', 'error') NOT NULL,
    cdn_url VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (run_id) REFERENCES runs(id)
);

CREATE TABLE IF NOT EXISTS clip_jobs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    run_id INT NOT NULL,
    status ENUM('pending', 'success', 'error') NOT NULL,
    cdn_url VARCHAR(255) NOT NULL,
    moment_type ENUM('share', 'card_rendered') NOT NULL,
    FOREIGN KEY (run_id) REFERENCES runs(id),
    INDEX (status),
    INDEX (moment_type)
);

CREATE TABLE IF NOT EXISTS og_cache (
    id INT PRIMARY KEY AUTO_INCREMENT,
    run_id INT NOT NULL,
    rendered_at TIMESTAMP NOT NULL,
    image_url VARCHAR(255) NOT NULL,
    FOREIGN KEY (run_id) REFERENCES runs(id),
    INDEX (rendered_at),
    UNIQUE (image_url)
);
