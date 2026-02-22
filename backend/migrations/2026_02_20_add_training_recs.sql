-- Point Zero One Digital - Training Recommendations Table
-- Created at 2026-02-20T10:30:00Z

CREATE TABLE IF NOT EXISTS training_recommendations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    weakness_model_id INT NOT NULL,
    scenario_id INT NOT NULL,
    session_id INT,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (weakness_model_id) REFERENCES weakness_models(id),
    FOREIGN KEY (scenario_id) REFERENCES scenario_catalog(id),
    FOREIGN KEY (session_id) REFERENCES training_sessions(id)
);

-- Indexes for faster query performance
CREATE INDEX idx_training_recommendations_user_id ON training_recommendations (user_id);
CREATE INDEX idx_training_recommendations_weakness_model_id ON training_recommendations (weakness_model_id);
CREATE INDEX idx_training_recommendations_scenario_id ON training_recommendations (scenario_id);
CREATE INDEX idx_training_recommendations_session_id ON training_recommendations (session_id);
