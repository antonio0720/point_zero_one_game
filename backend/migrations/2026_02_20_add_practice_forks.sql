-- Point Zero One Digital - Practice Forks Table Structure

CREATE TABLE IF NOT EXISTS practice_forks (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL REFERENCES games(id),
    creator_user_id INTEGER NOT NULL REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_practice_forks_game_id ON practice_forks (game_id);
CREATE INDEX IF NOT EXISTS idx_practice_forks_creator_user_id ON practice_forks (creator_user_id);

CREATE TABLE IF NOT EXISTS fork_snapshots (
    id SERIAL PRIMARY KEY,
    practice_fork_id INTEGER NOT NULL REFERENCES practice_forks(id),
    snapshot_number INTEGER NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONEDEFault CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fork_snapshots_practice_fork_id ON fork_snapshots (practice_fork_id);
CREATE INDEX IF NOT EXISTS idx_fork_snapshots_snapshot_number ON fork_snapshots (snapshot_number);

CREATE TABLE IF NOT EXISTS fork_constraints (
    id SERIAL PRIMARY KEY,
    practice_fork_id INTEGER NOT NULL REFERENCES practice_forks(id),
    constraint_name VARCHAR(255) NOT NULL UNIQUE,
    constraint_value JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fork_constraints_practice_fork_id ON fork_constraints (practice_fork_id);
CREATE INDEX IF NOT EXISTS idx_fork_constraints_constraint_name ON fork_constraints (constraint_name);

CREATE TABLE IF NOT EXISTS fork_audit_log (
    id SERIAL PRIMARY KEY,
    practice_fork_id INTEGER NOT NULL REFERENCES practice_forks(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    action VARCHAR(255) NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fork_audit_log_practice_fork_id ON fork_audit_log (practice_fork_id);
CREATE INDEX IF NOT EXISTS idx_fork_audit_log_user_id ON fork_audit_log (user_id);
