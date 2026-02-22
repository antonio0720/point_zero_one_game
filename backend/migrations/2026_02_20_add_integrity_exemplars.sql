-- Point Zero One Digital - Integrity Exemplars Table
-- Strict TypeScript, no 'any', export all public symbols, include JSDoc

CREATE TABLE IF NOT EXISTS integrity_exemplars (
  id SERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES games(id),
  version_id INTEGER NOT NULL REFERENCES exemplar_versions(id),
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  checksum VARCHAR(255) NOT NULL UNIQUE,
  data JSONB NOT NULL,
  UNIQUE (game_id, version_id, checksum)
);

CREATE INDEX IF NOT EXISTS idx_integrity_exemplars_game_id ON integrity_exemplars (game_id);
CREATE INDEX IF NOT EXISTS idx_integrity_exemplars_version_id ON integrity_exemplars (version_id);
CREATE INDEX IF NOT EXISTS idx_integrity_exemplars_checksum ON integrity_exemplars (checksum);

-- Point Zero One Digital - Exemplar Versions Table
-- Strict TypeScript, no 'any', export all public symbols, include JSDoc

CREATE TABLE IF NOT EXISTS exemplar_versions (
  id SERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES games(id),
  version VARCHAR(255) NOT NULL UNIQUE,
  data JSONB NOT NULL,
  UNIQUE (game_id, version)
);

CREATE INDEX IF NOT EXISTS idx_exemplar_versions_game_id ON exemplar_versions (game_id);
CREATE INDEX IF NOT EXISTS idx_exemplar_versions_version ON exemplar_versions (version);

-- Point Zero One Digital - Exemplar Audit Log Table
-- Strict TypeScript, no 'any', export all public symbols, include JSDoc

CREATE TABLE IF NOT EXISTS exemplar_audit_log (
  id SERIAL PRIMARY KEY,
  integrity_exemplar_id INTEGER NOT NULL REFERENCES integrity_exemplars(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  action VARCHAR(255) NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  data JSONB,
  UNIQUE (integrity_exemplar_id, user_id, action, timestamp)
);

CREATE INDEX IF NOT EXISTS idx_exemplar_audit_log_integrity_exemplar_id ON exemplar_audit_log (integrity_exemplar_id);
CREATE INDEX IF NOT EXISTS idx_exemplar_audit_log_user_id ON exemplar_audit_log (user_id);
