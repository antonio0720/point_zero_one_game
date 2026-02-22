-- Point Zero One Digital - Backend Migrations - 2026_02_20_add_quotas_budgets.sql

CREATE TABLE IF NOT EXISTS creator_quotas (
    id SERIAL PRIMARY KEY,
    creator_id INTEGER NOT NULL REFERENCES creators(id),
    quota_type VARCHAR(50) NOT NULL,
    quota_amount DECIMAL(18, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE (creator_id, quota_type)
);

CREATE TABLE IF NOT EXISTS quota_events (
    id SERIAL PRIMARY KEY,
    creator_quota_id INTEGER REFERENCES creator_quotas(id),
    event_type VARCHAR(50) NOT NULL,
    amount DECIMAL(18, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (creator_quota_id, event_type)
);

CREATE TABLE IF NOT EXISTS budget_envelopes (
    id SERIAL PRIMARY KEY,
    creator_id INTEGER NOT NULL REFERENCES creators(id),
    budget_name VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (creator_id, budget_name),
    CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS budget_consumption (
    id SERIAL PRIMARY KEY,
    budget_envelope_id INTEGER REFERENCES budget_envelopes(id),
    event_id INTEGER REFERENCES quota_events(id),
    consumed_amount DECIMAL(18, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (budget_envelope_id, event_id),
    CHECK (consumed_amount > 0)
);

CREATE TABLE IF NOT EXISTS anti_spam_scores (
    id SERIAL PRIMARY KEY,
    creator_id INTEGER NOT NULL REFERENCES creators(id),
    score DECIMAL(18, 2) NOT NULL DEFAULT 0,
    last_update TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE (creator_id)
);

-- Indexes for foreign key constraints
CREATE INDEX IF NOT EXISTS fk_creator_quotas_creators_id ON creator_quotas (creator_id);
CREATE INDEX IF NOT EXISTS fk_quota_events_creator_quotas_id ON quota_events (creator_quota_id);
CREATE INDEX IF NOT EXISTS fk_budget_consumption_budget_envelopes_id ON budget_consumption (budget_envelope_id);
