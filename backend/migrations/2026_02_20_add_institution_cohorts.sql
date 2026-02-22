-- Point Zero One Digital - Backend Migration Script - 2026-02-20 - Add Institution Cohorts

SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS orgs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cohorts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL UNIQUE,
    org_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (org_id) REFERENCES orgs(id)
);

CREATE TABLE IF NOT EXISTS cohort_members (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    cohort_id INT NOT NULL,
    role ENUM('facilitator', 'admin', 'member') NOT NULL DEFAULT 'member',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (cohort_id) REFERENCES cohorts(id)
);

CREATE TABLE IF NOT EXISTS cohort_assignments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    cohort_id INT NOT NULL,
    game_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (cohort_id) REFERENCES cohorts(id),
    FOREIGN KEY (game_id) REFERENCES games(id)
);

CREATE INDEX IF NOT EXISTS idx_cohort_assignments_cohort_id ON cohort_assignments(cohort_id);
CREATE INDEX IF NOT EXISTS idx_cohort_assignments_game_id ON cohort_assignments(game_id);

SET FOREIGN_KEY_CHECKS = 1;
