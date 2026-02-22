-- Point Zero One Digital - Verification Reports Table
-- Strict TypeScript, no 'any', export all public symbols, include JSDoc

CREATE TABLE IF NOT EXISTS verification_reports (
  id SERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES games(id),
  report_date DATE NOT NULL,
  report_time TIME NOT NULL,
  player_id INTEGER NOT NULL REFERENCES players(id),
  score FLOAT NOT NULL,
  win BOOLEAN NOT NULL DEFAULT false,
  deterministic_sim_check_id INTEGER REFERENCES deterministic_sim_checks(id),
  balance_budget_check_id INTEGER REFERENCES balance_budget_checks(id),
  fixlist_id INTEGER REFERENCES fixlists(id),
  proof_receipt_id INTEGER REFERENCES proof_receipts(id),
  UNIQUE (game_id, report_date, report_time, player_id)
);

-- Point Zero One Digital - Deterministic Simulation Checks Table
CREATE TABLE IF NOT EXISTS deterministic_sim_checks (
  id SERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES games(id),
  check_name VARCHAR(255) NOT NULL,
  check_result BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (game_id, check_name)
);

-- Point Zero One Digital - Balance Budget Checks Table
CREATE TABLE IF NOT EXISTS balance_budget_checks (
  id SERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES games(id),
  initial_balance FLOAT NOT NULL,
  final_balance FLOAT NOT NULL,
  UNIQUE (game_id)
);

-- Point Zero One Digital - Fixlists Table
CREATE TABLE IF NOT EXISTS fixlists (
  id SERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES games(id),
  fixlist_name VARCHAR(255) NOT NULL,
  UNIQUE (game_id, fixlist_name)
);

-- Point Zero One Digital - Proof Receipts Table
CREATE TABLE IF NOT EXISTS proof_receipts (
  id SERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES games(id),
  proof_type VARCHAR(255) NOT NULL,
  proof_data JSONB NOT NULL,
  UNIQUE (game_id, proof_type)
);
