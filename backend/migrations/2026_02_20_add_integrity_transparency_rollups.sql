-- Point Zero One Digital - Integrity Rollups Tables
-- Strict TypeScript, no 'any', export all public symbols, include JSDoc

CREATE TABLE IF NOT EXISTS integrity_monthly_rollups (
  id SERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL,
  month TEXT NOT NULL,
  revenue DECIMAL(18, 2) NOT NULL,
  expenses DECIMAL(18, 2) NOT NULL,
  profit DECIMAL(18, 2) NOT NULL,
  UNIQUE (game_id, month)
);

CREATE INDEX IF NOT EXISTS idx_integrity_monthly_rollups_game_id ON integrity_monthly_rollups (game_id);

CREATE TABLE IF NOT EXISTS integrity_reason_category_rollups (
  id SERIAL PRIMARY KEY,
  reason_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  count INTEGER NOT NULL,
  UNIQUE (reason_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_integrity_reason_category_rollups_reason_id ON integrity_reason_category_rollups (reason_id);
CREATE INDEX IF NOT EXISTS idx_integrity_reason_category_rollups_category_id ON integrity_reason_category_rollups (category_id);

CREATE TABLE IF NOT EXISTS integrity_enforcement_rollups (
  id SERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL,
  enforcement_type TEXT NOT NULL,
  count INTEGER NOT NULL,
  UNIQUE (game_id, enforcement_type)
);

CREATE INDEX IF NOT EXISTS idx_integrity_enforcement_rollups_game_id ON integrity_enforcement_rollups (game_id);
