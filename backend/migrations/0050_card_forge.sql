-- Point Zero One Digital - Backend Migration: 0050_card_forge.sql
-- Strict TypeScript, no 'any', export all public symbols, JSDoc comments
-- SQL: includes indexes, foreign keys, comments; idempotent (CREATE IF NOT EXISTS)
-- Bash: set -euo pipefail, log all actions

CREATE TABLE IF NOT EXISTS forged_cards (
    id SERIAL PRIMARY KEY,
    card_id INTEGER NOT NULL UNIQUE,
    player_id INTEGER NOT NULL REFERENCES players(id),
    forge_time TIMESTAMP WITH TIME ZONE NOT NULL,
    forged_by_id INTEGER NOT NULL REFERENCES players(id),
    UNIQUE (card_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_forged_cards_player_id ON forged_cards (player_id);
CREATE INDEX IF NOT EXISTS idx_forged_cards_forge_time ON forged_cards (forge_time);

CREATE TABLE IF NOT EXISTS gauntlet_submissions (
    id SERIAL PRIMARY KEY,
    player_id INTEGER NOT NULL REFERENCES players(id),
    gauntlet_round INTEGER NOT NULL,
    card_id INTEGER NOT NULL,
    submission_time TIMESTAMP WITH TIME ZONE NOT NULL,
    UNIQUE (player_id, gauntlet_round, card_id)
);

CREATE INDEX IF NOT EXISTS idx_gauntlet_submissions_player_id ON gauntlet_submissions (player_id);
CREATE INDEX IF NOT EXISTS idx_gauntlet_submissions_gauntlet_round ON gauntlet_submissions (gauntlet_round);
CREATE INDEX IF NOT EXISTS idx_gauntlet_submissions_card_id ON gauntlet_submissions (card_id);

CREATE TABLE IF NOT EXISTS gauntlet_votes (
    id SERIAL PRIMARY KEY,
    voter_id INTEGER NOT NULL REFERENCES players(id),
    voted_for_player_id INTEGER NOT NULL REFERENCES players(id),
    gauntlet_round INTEGER NOT NULL,
    vote_time TIMESTAMP WITH TIME ZONE NOT NULL,
    UNIQUE (voter_id, voted_for_player_id, gauntlet_round)
);

CREATE INDEX IF NOT EXISTS idx_gauntlet_votes_voter_id ON gauntlet_votes (voter_id);
CREATE INDEX IF NOT EXISTS idx_gauntlet_votes_voted_for_player_id ON gauntlet_votes (voted_for_player_id);
CREATE INDEX IF NOT EXISTS idx_gauntlet_votes_gauntlet_round ON gauntlet_votes (gauntlet_round);

CREATE TABLE IF NOT EXISTS minted_community_cards (
    id SERIAL PRIMARY KEY,
    card_id INTEGER NOT NULL UNIQUE,
    minting_time TIMESTAMP WITH TIME ZONE NOT NULL,
    creator_royalty_percentage DECIMAL(5,2) NOT NULL CHECK (creator_royalty_percentage >= 0 AND creator_royalty_percentage <= 100),
    UNIQUE (card_id)
);

CREATE INDEX IF NOT EXISTS idx_minted_community_cards_card_id ON minted_community_cards (card_id);

CREATE TABLE IF NOT EXISTS creator_royalty_accrual (
    id SERIAL PRIMARY KEY,
    player_id INTEGER NOT NULL REFERENCES players(id),
    card_id INTEGER NOT NULL REFERENCES cards(id),
    royalty_earned DECIMAL(18,8) NOT NULL DEFAULT 0,
    accrual_time TIMESTAMP WITH TIME ZONE NOT NULL,
    UNIQUE (player_id, card_id)
);

CREATE INDEX IF NOT EXISTS idx_creator_royalty_accrual_player_id ON creator_royalty_accrual (player_id);
CREATE INDEX IF NOT EXISTS idx_creator_royalty_accrual_card_id ON creator_royalty_accrual (card_id);
