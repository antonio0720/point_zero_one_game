-- Point Zero One Digital - Backend Migration Script - Add Shadow Suppression Table for Casual Ladder
-- Created on 2026-02-20

CREATE TABLE IF NOT EXISTS shadow_suppression (
    id BIGINT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    game_id BIGINT NOT NULL,
    shadow_hash VARCHAR(255) NOT NULL,
    plausibility_score DECIMAL(10, 2) NOT NULL CHECK (plausibility_score >= 0.00 AND plausibility_score <= 100.00),
    suppressed_until TIMESTAMP WITH TIME ZONE,
    UNIQUE (user_id, game_id, shadow_hash)
);

CREATE INDEX IF NOT EXISTS idx_shadow_suppression_user_id ON shadow_suppression (user_id);
CREATE INDEX IF NOT EXISTS idx_shadow_suppression_game_id ON shadow_suppression (game_id);
CREATE INDEX IF NOT EXISTS idx_shadow_suppression_shadow_hash ON shadow_suppression (shadow_hash);
