-- Point Zero One Digital - Two Tier Ladders Migration Script (v2026_02_20)
-- Strict TypeScript, no 'any', export all public symbols, JSDoc comments

CREATE TABLE IF NOT EXISTS ladders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (id) REFERENCES ladder_windows(ladder_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ladder_entries (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  ladder_id INT NOT NULL,
  rank INT NOT NULL,
  score DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (ladder_id) REFERENCES ladders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ladder_entry_events (
  id INT PRIMARY KEY AUTO_INCREMENT,
  ladder_entry_id INT NOT NULL,
  event_type ENUM('join', 'leave', 'rank_change') NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ladder_entry_id) REFERENCES ladder_entries(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pending_verified_entries (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  ladder_entry_id INT,
  verification_status ENUM('pending', 'verified', 'rejected') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (ladder_entry_id) REFERENCES ladder_entries(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS eligibility_state (
  user_id INT PRIMARY KEY,
  ladder_id INT,
  eligibility ENUM('eligible', 'ineligible') NOT NULL DEFAULT 'ineligible',
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (ladder_id) REFERENCES ladders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS suppression_flags (
  user_id INT PRIMARY KEY,
  ladder_id INT,
  flag ENUM('suppressed', 'not_suppressed') NOT NULL DEFAULT 'not_suppressed',
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (ladder_id) REFERENCES ladders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ladder_windows (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  ladder_id INT NOT NULL,
  FOREIGN KEY (ladder_id) REFERENCES ladders(id) ON DELETE CASCADE
);

-- Indexes for faster query performance
ALTER TABLE ladders ADD INDEX (name);
ALTER TABLE ladders ADD INDEX (start_date, end_date);
ALTER TABLE ladder_entries ADD INDEX (ladder_id);
ALTER TABLE ladder_entries ADD INDEX (rank);
ALTER TABLE ladder_entry_events ADD INDEX (ladder_entry_id);
ALTER TABLE pending_verified_entries ADD INDEX (user_id, verification_status);
ALTER TABLE eligibility_state ADD INDEX (ladder_id);
ALTER TABLE suppression_flags ADD INDEX (ladder_id);
ALTER TABLE ladder_windows ADD INDEX (name);
