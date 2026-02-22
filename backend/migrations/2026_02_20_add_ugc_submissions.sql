-- Point Zero One Digital - ugc_submissions table creation
-- Strict TypeScript, no 'any', export all public symbols, JSDoc comments

/**
 * UGC Submission Entity
 */
CREATE TABLE IF NOT EXISTS ugc_submissions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  game_id BIGINT NOT NULL,
  creator_user_id BIGINT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (game_id) REFERENCES games(id),
  FOREIGN KEY (creator_user_id) REFERENCES users(id)
);

/**
 * UGC Submission Version Entity
 */
CREATE TABLE IF NOT EXISTS ugc_submission_versions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  submission_id BIGINT NOT NULL,
  version_number INT NOT NULL,
  content_hash VARCHAR(64) NOT NULL,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (submission_id) REFERENCES ugc_submissions(id),
  UNIQUE (submission_id, version_number)
);

/**
 * UGC Submission Event Entity (append-only)
 */
CREATE TABLE IF NOT EXISTS ugc_submission_events (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  submission_id BIGINT NOT NULL,
  event_type VARCHAR(32) NOT NULL,
  data JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (submission_id) REFERENCES ugc_submissions(id),
  UNIQUE (submission_id, event_type)
);

/**
 * UGC Content Hash Index
 */
CREATE INDEX IF NOT EXISTS ugc_content_hash_index ON ugc_submission_versions (content_hash);
