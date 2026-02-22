-- Point Zero One Digital - Placement Revshare Tables Migration (v2026_02_20)

CREATE TABLE IF NOT EXISTS placement_pool (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    max_slots INTEGER NOT NULL,
    current_slots INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE (game_id, name)
);

CREATE INDEX IF NOT EXISTS idx_placement_pool_game_id ON placement_pool (game_id);

CREATE TABLE IF NOT EXISTS placement_slots (
    id SERIAL PRIMARY KEY,
    pool_id INTEGER NOT NULL REFERENCES placement_pool(id),
    slot_number INTEGER NOT NULL UNIQUE,
    owner_id INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_placement_slots_pool_id ON placement_slots (pool_id);
CREATE INDEX IF NOT EXISTS idx_placement_slots_slot_number ON placement_slots (slot_number);

CREATE TABLE IF NOT EXISTS ranking_snapshots (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL,
    pool_id INTEGER NOT NULL REFERENCES placement_pool(id),
    snapshot_time TIMESTAMP WITH TIME ZONE NOT NULL,
    rankings JSONB NOT NULL,
    UNIQUE (game_id, pool_id, snapshot_time)
);

CREATE INDEX IF NOT EXISTS idx_ranking_snapshots_game_id ON ranking_snapshots (game_id);
CREATE INDEX IF NOT EXISTS idx_ranking_snapshots_pool_id ON ranking_snapshots (pool_id);

CREATE TABLE IF NOT EXISTS revshare_ledger (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL,
    pool_id INTEGER NOT NULL REFERENCES placement_pool(id),
    slot_id INTEGER NOT NULL REFERENCES placement_slots(id),
    revshare_percentage DECIMAL(5,2) NOT NULL,
    revenue DECIMAL(19,8) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (game_id, pool_id, slot_id)
);

CREATE INDEX IF NOT EXISTS idx_revshare_ledger_game_id ON revshare_ledger (game_id);
CREATE INDEX IF NOT EXISTS idx_revshare_ledger_pool_id ON revshare_ledger (pool_id);
CREATE INDEX IF NOT EXISTS idx_revshare_ledger_slot_id ON revshare_ledger (slot_id);

CREATE TABLE IF NOT EXISTS payout_periods (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL,
    pool_id INTEGER NOT NULL REFERENCES placement_pool(id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    payout_method ENUM('manual', 'automatic') NOT NULL DEFAULT 'manual',
    UNIQUE (game_id, pool_id, start_date)
);

CREATE INDEX IF NOT EXISTS idx_payout_periods_game_id ON payout_periods (game_id);
CREATE INDEX IF NOT EXISTS idx_payout_periods_pool_id ON payout_periods (pool_id);

CREATE TABLE IF NOT EXISTS clawbacks (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL,
    pool_id INTEGER NOT NULL REFERENCES placement_pool(id),
    slot_id INTEGER NOT NULL REFERENCES placement_slots(id),
    amount DECIMAL(19,8) NOT NULL,
    reason VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (game_id, pool_id, slot_id)
);

CREATE INDEX IF NOT EXISTS idx_clawbacks_game_id ON clawbacks (game_id);
CREATE INDEX IF NOT EXISTS idx_clawbacks_pool_id ON clawbacks (pool_id);
CREATE INDEX IF NOT EXISTS idx_clawbacks_slot_id ON clawbacks (slot_id);
