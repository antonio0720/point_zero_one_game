-- Point Zero One Digital - Referral Tables Migration (v2026_02_20)
-- Strict TypeScript, no 'any', export all public symbols, JSDoc comments

CREATE TABLE IF NOT EXISTS referral_codes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  used BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (id) REFERENCES throttles(referral_code_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS invites (
  id INT PRIMARY KEY AUTO_INCREMENT,
  referral_code_id INT NOT NULL,
  recipient_id INT NOT NULL,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  used BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (referral_code_id) REFERENCES referral_codes(id),
  FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS invite_events (
  id INT PRIMARY KEY AUTO_INCREMENT,
  invite_id INT NOT NULL,
  event VARCHAR(255) NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invite_id) REFERENCES invites(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS referral_completions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  invite_id INT NOT NULL,
  completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invite_id) REFERENCES invites(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS throttles (
  id INT PRIMARY KEY AUTO_INCREMENT,
  referral_code_id INT NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  UNIQUE INDEX(referral_code_id),
  FOREIGN KEY (referral_code_id) REFERENCES referral_codes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS abuse_flags (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  reason VARCHAR(255),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
