-- Point Zero One Digital - Integrity Public Audit Log and Internal Forensics Reference Table
-- Strict TypeScript, no 'any', export all public symbols, JSDoc comments

/**
 * IntegrityPublicAuditLog
 *
 * Represents a log of integrity checks performed on the game state.
 */
CREATE TABLE IF NOT EXISTS integrity_public_audit_log (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  game_id BIGINT NOT NULL,
  check_type ENUM('integrity', 'security') NOT NULL,
  check_result ENUM('passed', 'failed') NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (game_id) REFERENCES game(id) ON DELETE CASCADE
);

/**
 * IntegrityInternalForensicsRef
 *
 * Internal reference table for forensic analysis of failed integrity checks.
 */
CREATE TABLE IF NOT EXISTS integrity_internal_forensics_ref (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  audit_log_id BIGINT NOT NULL,
  forensic_data LONGBLOB NOT NULL,
  FOREIGN KEY (audit_log_id) REFERENCES integrity_public_audit_log(id) ON DELETE CASCADE
);

-- Indexes for faster query performance
ALTER TABLE integrity_public_audit_log ADD INDEX idx_game_id (game_id);
ALTER TABLE integrity_internal_forensics_ref ADD INDEX idx_audit_log_id (audit_log_id);
