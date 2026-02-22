-- Point Zero One Digital - ugc_pipeline_state, ugc_stage_timers, ugc_retry_schedule, ugc_default_outcomes
-- Strict TypeScript, no 'any', export all public symbols, JSDoc comments
-- SQL: includes indexes, foreign keys, comments; idempotent (CREATE IF NOT EXISTS)
-- Bash: set -euo pipefail, log all actions

CREATE TABLE IF NOT EXISTS ugc_pipeline_state (
  id INT PRIMARY KEY AUTO_INCREMENT,
  game_id INT NOT NULL,
  pipeline_id INT NOT NULL,
  stage_id INT NOT NULL,
  state VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (game_id) REFERENCES games(id),
  FOREIGN KEY (pipeline_id) REFERENCES ugc_pipelines(id),
  FOREIGN KEY (stage_id) REFERENCES ugc_stages(id)
);

CREATE INDEX IF NOT EXISTS idx_ugc_pipeline_state_game_id ON ugc_pipeline_state (game_id);
CREATE INDEX IF NOT EXISTS idx_ugc_pipeline_state_pipeline_id ON ugc_pipeline_state (pipeline_id);
CREATE INDEX IF NOT EXISTS idx_ugc_pipeline_state_stage_id ON ugc_pipeline_state (stage_id);

CREATE TABLE IF NOT EXISTS ugc_stage_timers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  pipeline_state_id INT NOT NULL,
  stage_id INT NOT NULL,
  timer_name VARCHAR(255) NOT NULL,
  value FLOAT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (pipeline_state_id) REFERENCES ugc_pipeline_state(id),
  FOREIGN KEY (stage_id) REFERENCES ugc_stages(id)
);

CREATE INDEX IF NOT EXISTS idx_ugc_stage_timers_pipeline_state_id ON ugc_stage_timers (pipeline_state_id);
CREATE INDEX IF NOT EXISTS idx_ugc_stage_timers_stage_id ON ugc_stage_timers (stage_id);

CREATE TABLE IF NOT EXISTS ugc_retry_schedule (
  id INT PRIMARY KEY AUTO_INCREMENT,
  pipeline_state_id INT NOT NULL,
  retry_attempt INT NOT NULL,
  retry_delay FLOAT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (pipeline_state_id) REFERENCES ugc_pipeline_state(id)
);

CREATE INDEX IF NOT EXISTS idx_ugc_retry_schedule_pipeline_state_id ON ugc_retry_schedule (pipeline_state_id);

CREATE TABLE IF NOT EXISTS ugc_default_outcomes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  stage_id INT NOT NULL,
  outcome VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (stage_id) REFERENCES ugc_stages(id)
);

CREATE INDEX IF NOT EXISTS idx_ugc_default_outcomes_stage_id ON ugc_default_outcomes (stage_id);
