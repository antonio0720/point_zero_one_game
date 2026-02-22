-- File: backend/migrations/2026_02_20_add_enrollment_sources.sql

CREATE TABLE IF NOT EXISTS roster_upload_jobs (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    status VARCHAR(255) NOT NULL,
    error_message TEXT,
    sso_identity_id INTEGER REFERENCES sso_identities(id),
    FOREIGN KEY (sso_identity_id) REFERENCES sso_identities(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_roster_upload_jobs_status ON roster_upload_jobs (status);

CREATE TABLE IF NOT EXISTS roster_rows (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    roster_upload_job_id INTEGER REFERENCES roster_upload_jobs(id),
    row_number INTEGER NOT NULL,
    student_name TEXT NOT NULL,
    student_id TEXT NOT NULL UNIQUE,
    eligibility_state_id INTEGER REFERENCES eligibility_states(id),
    enrollment_receipt_id INTEGER REFERENCES enrollment_receipts(id),
    FOREIGN KEY (roster_upload_job_id) REFERENCES roster_upload_jobs(id) ON DELETE CASCADE,
    FOREIGN KEY (eligibility_state_id) REFERENCES eligibility_states(id) ON DELETE CASCADE,
    FOREIGN KEY (enrollment_receipt_id) REFERENCES enrollment_receipts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_roster_rows_student_id ON roster_rows (student_id);
CREATE INDEX IF NOT EXISTS idx_roster_rows_eligibility_state_id ON roster_rows (eligibility_state_id);
CREATE INDEX IF NOT EXISTS idx_roster_rows_enrollment_receipt_id ON roster_rows (enrollment_receipt_id);

CREATE TABLE IF NOT EXISTS sso_identities (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    FOREIGN KEY (username) REFERENCES sso_identities(username) ON CONFLICT DO UPDATE SET updated_at = CURRENT_TIMESTAMP WHERE id != EXCLUDED.id
);

CREATE INDEX IF NOT EXISTS idx_sso_identities_username ON sso_identities (username);

CREATE TABLE IF NOT EXISTS eligibility_states (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    FOREIGN KEY (name) REFERENCES eligibility_states(name) ON CONFLICT DO UPDATE SET updated_at = CURRENT_TIMESTAMP WHERE id != EXCLUDED.id
);

CREATE INDEX IF NOT EXISTS idx_eligibility_states_name ON eligibility_states (name);

CREATE TABLE IF NOT EXISTS enrollment_receipts (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    student_id TEXT NOT NULL UNIQUE,
    enrollment_date DATE NOT NULL,
    enrollment_source VARCHAR(255) NOT NULL,
    FOREIGN KEY (student_id) REFERENCES sso_identities(student_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_enrollment_receipts_student_id ON enrollment_receipts (student_id);
