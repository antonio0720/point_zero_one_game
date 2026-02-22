-- Point Zero One Digital - Facilitator Guides Database Migration (2026-02-20)

CREATE TABLE IF NOT EXISTS facilitator_guides (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS guide_versions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    guide_id INT NOT NULL,
    version VARCHAR(10) NOT NULL,
    content TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (guide_id) REFERENCES facilitator_guides(id)
);

CREATE TABLE IF NOT EXISTS guide_assets (
    id INT PRIMARY KEY AUTO_INCREMENT,
    guide_version_id INT NOT NULL,
    asset_type ENUM('image', 'video') NOT NULL,
    url VARCHAR(2083) NOT NULL,
    FOREIGN KEY (guide_version_id) REFERENCES guide_versions(id)
);

CREATE TABLE IF NOT EXISTS debrief_prompt_bank (
    id INT PRIMARY KEY AUTO_INCREMENT,
    question VARCHAR(255) NOT NULL,
    answer VARCHAR(255) NOT NULL,
    FOREIGN KEY (id) REFERENCES facilitator_guides(id)
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_facilitator_guides_name ON facilitator_guides(name);
CREATE INDEX IF NOT EXISTS idx_guide_versions_guide_id ON guide_versions(guide_id);
CREATE INDEX IF NOT EXISTS idx_debrief_prompt_bank_question ON debrief_prompt_bank(question);
