-- Point Zero One Digital - 0003_cosmetics.sql - /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/migrations/0003_cosmetics.sql
-- Strict TypeScript, no 'any', export all public symbols
-- SQL includes indexes, foreign keys, comments; idempotent (CREATE IF NOT EXISTS)
-- Bash: set -euo pipefail, log all actions

BEGIN;

CREATE TABLE IF NOT EXISTS cosmetic_store_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    price INTEGER NOT NULL DEFAULT 0,
    image_url VARCHAR(512) NOT NULL DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT cosmetic_store_items_name_not_blank
        CHECK (char_length(btrim(name)) > 0),
    CONSTRAINT cosmetic_store_items_price_nonnegative
        CHECK (price >= 0)
);

CREATE INDEX IF NOT EXISTS cosmetic_store_items_name_idx
    ON cosmetic_store_items (name);

CREATE INDEX IF NOT EXISTS cosmetic_store_items_is_active_idx
    ON cosmetic_store_items (is_active);

CREATE INDEX IF NOT EXISTS cosmetic_store_items_created_at_idx
    ON cosmetic_store_items (created_at DESC);

DROP TRIGGER IF EXISTS cosmetic_store_items_set_updated_at ON cosmetic_store_items;
CREATE TRIGGER cosmetic_store_items_set_updated_at
BEFORE UPDATE ON cosmetic_store_items
FOR EACH ROW
EXECUTE FUNCTION set_row_updated_at();

COMMIT;