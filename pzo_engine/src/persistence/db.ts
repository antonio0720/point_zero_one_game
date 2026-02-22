import * as sqlite3 from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

// SQLite setup constants
const DB_NAME = 'pzo.db';
const RUNS_TABLE = 'runs';
const EVENTS_TABLE = 'events';
const LEADERBOARD_TABLE = 'leaderboard';
const MIGRATIONS_TABLE = 'migrations';

// Singleton connection instance
let dbConnection: sqlite3.Database | null = null;

// SQLite setup function
function initDb(): void {
  if (dbConnection) return;
  const dbPath = `${DB_NAME}`;
  dbConnection = sqlite3(dbPath, { 
    // Enable WAL mode for concurrent writes
    foreignKeys: true,
    // Preserve determinism by disabling journaling
    journalMode: 'MEMORY',
  });

  // Create runs table
  dbConnection.exec(`
    CREATE TABLE IF NOT EXISTS ${RUNS_TABLE} (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
      finished_at INTEGER,
      seed TEXT,
      ml_enabled INTEGER NOT NULL DEFAULT 0,
      audit_hash TEXT,
      FOREIGN KEY (seed) REFERENCES seeds(id)
    );
  `);

  // Create events table
  dbConnection.exec(`
    CREATE TABLE IF NOT EXISTS ${EVENTS_TABLE} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (run_id) REFERENCES ${RUNS_TABLE}(id)
    );
  `);

  // Create leaderboard table
  dbConnection.exec(`
    CREATE TABLE IF NOT EXISTS ${LEADERBOARD_TABLE} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      score REAL NOT NULL DEFAULT 0.0,
      created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (run_id) REFERENCES ${RUNS_TABLE}(id)
    );
  `);

  // Create migrations table
  dbConnection.exec(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id TEXT PRIMARY KEY,
      migration_name TEXT NOT NULL,
      applied_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

// Get singleton connection instance
function getDb(): sqlite3.Database {
  if (!dbConnection) initDb();
  return dbConnection;
}

export { getDb };
