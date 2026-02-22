-- Point Zero One Digital - Backend Migrations - 2026-02-20 - Add Cohorts, Rosters, Import Jobs, Assignments, Schedules

CREATE TABLE IF NOT EXISTS cohorts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cohorts_name ON cohorts (name);

CREATE TABLE IF NOT EXISTS cohort_members (
    id SERIAL PRIMARY KEY,
    cohort_id INTEGER REFERENCES cohorts(id) NOT NULL,
    user_id INTEGER NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP WITH TIME ZONE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cohort_members_cohort_id ON cohort_members (cohort_id);
CREATE INDEX IF NOT EXISTS idx_cohort_members_user_id ON cohort_members (user_id);

CREATE TABLE IF NOT EXISTS roster_import_jobs (
    id SERIAL PRIMARY KEY,
    cohort_id INTEGER REFERENCES cohorts(id) NOT NULL,
    file_path TEXT NOT NULL,
    status ENUM('pending', 'processing', 'success', 'error') NOT NULL DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_roster_import_jobs_cohort_id ON roster_import_jobs (cohort_id);

CREATE TABLE IF NOT EXISTS cohort_assignments (
    id SERIAL PRIMARY KEY,
    cohort_id INTEGER REFERENCES cohorts(id) NOT NULL,
    pack_id INTEGER REFERENCES packs(id) NOT NULL,
    benchmark_id INTEGER REFERENCES benchmarks(id) NOT NULL,
    order_index INTEGER NOT NULL,
    FOREIGN KEY (cohort_id, pack_id) REFERENCES cohorts_packs(cohort_id, pack_id) ON DELETE CASCADE,
    FOREIGN KEY (cohort_id, benchmark_id) REFERENCES cohorts_benchmarks(cohort_id, benchmark_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cohort_assignments_cohort_id ON cohort_assignments (cohort_id);
CREATE INDEX IF NOT EXISTS idx_cohort_assignments_pack_id ON cohort_assignments (pack_id);
CREATE INDEX IF NOT EXISTS idx_cohort_assignments_benchmark_id ON cohort_assignments (benchmark_id);

CREATE TABLE IF NOT EXISTS schedule_windows (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    start_time TIME WITH TIME ZONE NOT NULL,
    end_time TIME WITH TIME ZONE NOT NULL,
    cohort_id INTEGER REFERENCES cohorts(id),
    FOREIGN KEY (cohort_id) REFERENCES cohorts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_schedule_windows_name ON schedule_windows (name);
CREATE INDEX IF NOT EXISTS idx_schedule_windows_start_time ON schedule_windows (start_time);
CREATE INDEX IF NOT EXISTS idx_schedule_windows_end_time ON schedule_windows (end_time);
