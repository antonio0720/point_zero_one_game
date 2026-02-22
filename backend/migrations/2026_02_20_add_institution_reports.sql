-- Point Zero One Digital - Institution Reports Schema
-- Strict TypeScript, no 'any', export all public symbols
-- SQL: includes indexes, foreign keys, comments; idempotent (CREATE IF NOT EXISTS)
-- Bash: set -euo pipefail, log all actions

CREATE TABLE IF NOT EXISTS institution_reports (
    id SERIAL PRIMARY KEY,
    institution_id INTEGER NOT NULL REFERENCES institutions(id),
    report_name VARCHAR(255) NOT NULL,
    report_description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS institution_reports_institution_id_idx ON institution_reports (institution_id);

CREATE TABLE IF NOT EXISTS report_sections (
    id SERIAL PRIMARY KEY,
    report_id INTEGER NOT NULL REFERENCES institution_reports(id),
    section_name VARCHAR(255) NOT NULL,
    section_description TEXT,
    order_index INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS report_sections_report_id_idx ON report_sections (report_id);
CREATE INDEX IF NOT EXISTS report_sections_order_index_idx ON report_sections (order_index);

CREATE TABLE IF NOT EXISTS report_metrics (
    id SERIAL PRIMARY KEY,
    section_id INTEGER NOT NULL REFERENCES report_sections(id),
    metric_name VARCHAR(255) NOT NULL,
    metric_description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS report_metrics_section_id_idx ON report_metrics (section_id);

CREATE TABLE IF NOT EXISTS report_generation_jobs (
    id SERIAL PRIMARY KEY,
    institution_report_id INTEGER NOT NULL REFERENCES institution_reports(id),
    status VARCHAR(255) NOT NULL DEFAULT 'pending',
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS report_generation_jobs_institution_report_id_idx ON report_generation_jobs (institution_report_id);
