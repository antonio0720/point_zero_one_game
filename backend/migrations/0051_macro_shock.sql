-- Point Zero One Digital - Macro Shock Migrations - 0051_macro_shock.sql

CREATE TABLE IF NOT EXISTS macro_events (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL REFERENCES games(id),
    event_type VARCHAR(255) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    data JSONB
);

CREATE INDEX IF NOT EXISTS idx_macro_events_game_id ON macro_events (game_id);

CREATE TABLE IF NOT EXISTS macro_shock_cards (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES macro_events(id),
    card_type VARCHAR(255) NOT NULL,
    data JSONB
);

CREATE INDEX IF NOT EXISTS idx_macro_shock_cards_event_id ON macro_shock_cards (event_id);

CREATE TABLE IF NOT EXISTS shock_broadcasts (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES macro_events(id),
    player_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    data JSONB
);

CREATE INDEX IF NOT EXISTS idx_shock_broadcasts_event_id ON shock_broadcasts (event_id);
CREATE INDEX IF NOT EXISTS idx_shock_broadcasts_player_id ON shock_broadcasts (player_id);

CREATE TABLE IF NOT EXISTS shock_insertions_per_run (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES macro_events(id),
    player_id INTEGER NOT NULL,
    insertion_count INTEGER NOT NULL,
    data JSONB
);

CREATE INDEX IF NOT EXISTS idx_shock_insertions_per_run_event_id ON shock_insertions_per_run (event_id);
CREATE INDEX IF NOT EXISTS idx_shock_insertions_per_run_player_id ON shock_insertions_per_run (player_id);

CREATE TABLE IF NOT EXISTS macro_insurance_subscribers (
    id SERIAL PRIMARY KEY,
    player_id INTEGER NOT NULL,
    insurance_level INTEGER NOT NULL CHECK (insurance_level >= 0 AND insurance_level <= 10),
    data JSONB
);

CREATE INDEX IF NOT EXISTS idx_macro_insurance_subscribers_player_id ON macro_insurance_subscribers (player_id);
