-- File: backend/migrations/2026_02_20_add_reporting_warehouse.sql

CREATE TABLE IF NOT EXISTS partner_reporting_rollups (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    partner_id BIGINT NOT NULL,
    report_type ENUM('daily', 'weekly') NOT NULL,
    report_date DATE NOT NULL,
    revenue DECIMAL(20, 4) NOT NULL,
    users_count BIGINT NOT NULL,
    clicks_count BIGINT NOT NULL,
    impressions_count BIGINT NOT NULL,
    FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS partner_reporting_rollups_partner_id_idx ON partner_reporting_rollups (partner_id);
CREATE INDEX IF NOT EXISTS partner_reporting_rollups_report_date_idx ON partner_reporting_rollups (report_date);

CREATE TABLE IF NOT EXISTS cohort_rollups (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    cohort_id BIGINT NOT NULL,
    report_type ENUM('daily', 'weekly') NOT NULL,
    report_date DATE NOT NULL,
    revenue DECIMAL(20, 4) NOT NULL,
    users_count BIGINT NOT NULL,
    active_users_count BIGINT NOT NULL,
    churned_users_count BIGINT NOT NULL,
    FOREIGN KEY (cohort_id) REFERENCES cohorts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS cohort_rollups_cohort_id_idx ON cohort_rollups (cohort_id);
CREATE INDEX IF NOT EXISTS cohort_rollups_report_date_idx ON cohort_rollups (report_date);

CREATE TABLE IF NOT EXISTS ladder_rollups (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    game_ladder_id BIGINT NOT NULL,
    report_type ENUM('daily', 'weekly') NOT NULL,
    report_date DATE NOT NULL,
    players_count BIGINT NOT NULL,
    active_players_count BIGINT NOT NULL,
    top_player_rank INT NOT NULL,
    FOREIGN KEY (game_ladder_id) REFERENCES game_ladders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ladder_rollups_game_ladder_id_idx ON ladder_rollups (game_ladder_id);
CREATE INDEX IF NOT EXISTS ladder_rollups_report_date_idx ON ladder_rollups (report_date);

CREATE TABLE IF NOT EXISTS proof_share_rollups (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    proof_id BIGINT NOT NULL,
    report_type ENUM('daily', 'weekly') NOT NULL,
    report_date DATE NOT NULL,
    shares_count BIGINT NOT NULL,
    FOREIGN KEY (proof_id) REFERENCES proofs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS proof_share_rollups_proof_id_idx ON proof_share_rollups (proof_id);
CREATE INDEX IF NOT EXISTS proof_share_rollups_report_date_idx ON proof_share_rollups (report_date);
