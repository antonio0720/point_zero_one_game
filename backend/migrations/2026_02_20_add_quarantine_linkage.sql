-- File: backend/migrations/2026_02_20_add_quarantine_linkage.sql

-- Link quarantined_runs to ladder entries for verified lane; ensure private evidence pointers (internal only)

CREATE TABLE IF NOT EXISTS quarantine_ladder_links (
    id INT PRIMARY KEY AUTO_INCREMENT,
    run_id INT NOT NULL,
    ladder_entry_id INT NOT NULL,
    verified_lane BOOLEAN NOT NULL DEFAULT false,
    private_evidence_pointer VARCHAR(255) NOT NULL,
    FOREIGN KEY (run_id) REFERENCES quarantined_runs(id),
    FOREIGN KEY (ladder_entry_id) REFERENCES ladder_entries(id),
    INDEX idx_quarantine_ladder_links_run_id (run_id),
    INDEX idx_quarantine_ladder_links_ladder_entry_id (ladder_entry_id)
);
