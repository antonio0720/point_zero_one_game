-- File: backend/migrations/2026_02_20_add_alerting.sql

CREATE TABLE IF NOT EXISTS alert_rules (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    rule JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS alert_rules_name_idx ON alert_rules (name);

CREATE TABLE IF NOT EXISTS alert_firings (
    id SERIAL PRIMARY KEY,
    rule_id INTEGER REFERENCES alert_rules(id) NOT NULL,
    event_id INTEGER REFERENCES events(id) NOT NULL,
    state VARCHAR(255) NOT NULL CHECK (state IN ('open', 'acknowledged', 'suppressed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS alert_firings_rule_id_idx ON alert_firings (rule_id);
CREATE INDEX IF NOT EXISTS alert_firings_event_id_idx ON alert_firings (event_id);

CREATE TABLE IF NOT EXISTS alert_suppressions (
    id SERIAL PRIMARY KEY,
    firing_id INTEGER REFERENCES alert_firings(id) NOT NULL,
    suppression_reason TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS alert_suppressions_firing_id_idx ON alert_suppressions (firing_id);

CREATE TABLE IF NOT EXISTS runbook_links (
    id SERIAL PRIMARY KEY,
    firing_id INTEGER REFERENCES alert_firings(id) NOT NULL,
    runbook_id INTEGER REFERENCES runbooks(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS runbook_links_firing_id_idx ON runbook_links (firing_id);

CREATE TABLE IF NOT EXISTS alert_acknowledgements (
    id SERIAL PRIMARY KEY,
    firing_id INTEGER REFERENCES alert_firings(id) NOT NULL,
    acknowledger VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS alert_acknowledgements_firing_id_idx ON alert_acknowledgements (firing_id);
