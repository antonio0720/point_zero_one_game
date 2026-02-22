-- Point Zero One Digital - Backend Migration Script - 2026-02-20 - Add Visibility Columns

CREATE TABLE IF NOT EXISTS membership_artifacts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    membership_visibility ENUM('public', 'unlisted', 'private') NOT NULL DEFAULT 'public',
    run_visibility ENUM('public', 'unlisted', 'private') NOT NULL DEFAULT 'public'
);

CREATE INDEX IF NOT EXISTS idx_membership_artifacts_name ON membership_artifacts (name);

-- Add visibility columns to existing memberships
UPDATE membership_artifacts SET
    membership_visibility = CASE WHEN name LIKE '%public%' THEN 'public' ELSE 'unlisted' END,
    run_visibility = CASE WHEN name LIKE '%public%' THEN 'public' ELSE 'unlisted' END;
