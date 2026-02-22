-- File: backend/migrations/2026_02_20_add_proof_stamp_tables.sql

CREATE TABLE IF NOT EXISTS proof_card_stamps (
    id SERIAL PRIMARY KEY,
    season_id INTEGER NOT NULL,
    tier INTEGER NOT NULL,
    variant TEXT NOT NULL,
    hash_snippet BYTEA NOT NULL,
    signature BYTEA NOT NULL,
    minted_at TIMESTAMP WITH TIME ZONE NOT NULL,

    CONSTRAINT fk_proof_card_stamps_season_id FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE,
    CONSTRAINT unique_proof_card_stamp_hash UNIQUE (hash_snippet)
);

CREATE TABLE IF NOT EXISTS stamp_variants (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,

    CONSTRAINT unique_stamp_variant_name UNIQUE (name)
);
