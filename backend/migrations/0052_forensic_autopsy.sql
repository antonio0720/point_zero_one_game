-- Point Zero One Digital - Backend Migration: 0052_forensic_autopsy.sql
-- Strict TypeScript, no 'any', export all public symbols
-- SQL: includes indexes, foreign keys, comments; idempotent (CREATE IF NOT EXISTS)
-- Bash: set -euo pipefail, log all actions

CREATE TABLE IF NOT EXISTS decision_trees (
    run_id INT PRIMARY KEY,
    forks_json JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_decision_trees_run_id ON decision_trees (run_id);

CREATE TABLE IF NOT EXISTS counterfactual_results (
    run_id INT,
    fork_turn INT,
    alternate_choice JSONB,
    alternate_outcome_json JSONB,
    PRIMARY KEY (run_id, fork_turn),
    FOREIGN KEY (run_id) REFERENCES decision_trees(run_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_counterfactual_results_run_id ON counterfactual_results (run_id);
CREATE INDEX IF NOT EXISTS idx_counterfactual_results_fork_turn ON counterfactual_results (fork_turn);

CREATE TABLE IF NOT EXISTS fork_explorer_sessions (
    session_id UUID PRIMARY KEY,
    run_id INT,
    user_id INT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_updated_at TIMESTAMP WITH TIME ZONE,
    FOREIGN KEY (run_id) REFERENCES decision_trees(run_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fork_explorer_sessions_session_id ON fork_explorer_sessions (session_id);
CREATE INDEX IF NOT EXISTS idx_fork_explorer_sessions_run_id ON fork_explorer_sessions (run_id);
