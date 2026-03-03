// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — ENGINE PERSISTENCE LAYER
// pzo_engine/src/persistence/db.ts
//
// Singleton SQLite connection with WAL mode + full schema migration.
//
// REPLACES: skeletal db.ts (partial schema, no WAL, no migrations)
//
// WAL MODE: Enabled on every connection. Allows concurrent reads while
//           a write is in progress — critical for tick loop performance.
//
// FOREIGN KEYS: Enabled. All child records cascade-delete when parent run
//               is purged. Never disable FK enforcement.
//
// TEMP STORE: MEMORY — temp tables never hit disk.
//
// MMAP: 256MB — entire DB mapped to process memory for read-path speed.
//
// Density6 LLC · Point Zero One · Persistence Layer · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import Database from 'better-sqlite3';
import { applyMigrations, getSchemaVersion } from './schema';
import * as path from 'node:path';
import * as fs   from 'node:fs';

// =============================================================================
// CONFIG
// =============================================================================

const DEFAULT_DB_PATH = process.env['PZO_DB_PATH'] ?? path.resolve(process.cwd(), 'pzo.db');

// PRAGMA values — tuned for high-throughput tick-loop workload
const PRAGMAS = [
  'PRAGMA journal_mode = WAL',           // WAL for concurrent read/write
  'PRAGMA synchronous = NORMAL',         // Fsync on WAL checkpoint only
  'PRAGMA foreign_keys = ON',            // Enforce referential integrity
  'PRAGMA temp_store = MEMORY',          // Temp tables never touch disk
  'PRAGMA mmap_size = 268435456',        // 256MB mmap
  'PRAGMA cache_size = -32000',          // 32MB page cache
  'PRAGMA wal_autocheckpoint = 1000',    // Checkpoint every 1000 pages
] as const;

// =============================================================================
// SINGLETON STATE
// =============================================================================

let _db: Database.Database | null = null;
let _dbPath: string = DEFAULT_DB_PATH;

// =============================================================================
// PUBLIC: getDb()
// =============================================================================

/**
 * Get the singleton better-sqlite3 Database instance.
 *
 * On first call:
 *   1. Opens the DB at PZO_DB_PATH (or default path)
 *   2. Applies all PRAGMA settings
 *   3. Runs pending schema migrations
 *   4. Logs schema version
 *
 * On subsequent calls: returns existing instance.
 *
 * Thread-safety: better-sqlite3 is synchronous. Each Node.js process
 * has exactly one DB connection. Multi-process deployments must use
 * WAL mode (already configured) + application-level coordination.
 */
export function getDb(): Database.Database {
  if (_db) return _db;

  // Ensure parent directory exists
  const dir = path.dirname(_dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  _db = new Database(_dbPath, {
    // verbose: process.env['PZO_DB_VERBOSE'] === 'true' ? console.log : undefined,
  });

  // Apply all PRAGMA settings in a single transaction
  for (const pragma of PRAGMAS) {
    _db.exec(pragma);
  }

  // Run migrations
  applyMigrations(_db);

  const version = getSchemaVersion(_db);
  console.info(`[PZO DB] Connected. Schema: ${version} | Path: ${_dbPath}`);

  return _db;
}

// =============================================================================
// PUBLIC: closeDb()
// Used in tests and on graceful process shutdown.
// =============================================================================

export function closeDb(): void {
  if (!_db) return;
  try {
    // Ensure final WAL checkpoint before close
    _db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    _db.close();
  } catch (err) {
    console.error('[PZO DB] Error closing database:', err);
  } finally {
    _db = null;
  }
}

// =============================================================================
// PUBLIC: setDbPath()
// Must be called BEFORE getDb(). Used in tests to point at :memory: or tmp file.
// =============================================================================

export function setDbPath(dbPath: string): void {
  if (_db) {
    throw new Error(
      '[PZO DB] Cannot set DB path after connection is open. ' +
      'Call setDbPath() before the first getDb() call.'
    );
  }
  _dbPath = dbPath;
}

// =============================================================================
// PUBLIC: getDbPath()
// =============================================================================

export function getDbPath(): string {
  return _dbPath;
}

// =============================================================================
// PUBLIC: resetDbForTesting()
// Closes current connection, deletes the file, resets path.
// NEVER call in production code.
// =============================================================================

export function resetDbForTesting(): void {
  if (process.env['NODE_ENV'] === 'production') {
    throw new Error('[PZO DB] resetDbForTesting() is forbidden in production.');
  }
  closeDb();
  _dbPath = DEFAULT_DB_PATH;
}

// =============================================================================
// GRACEFUL SHUTDOWN HOOKS
// =============================================================================

// Checkpoint WAL on SIGTERM/SIGINT so we don't leave a dirty WAL file
if (process.env['NODE_ENV'] !== 'test') {
  const shutdown = (signal: string) => {
    console.info(`[PZO DB] ${signal} received — checkpointing WAL...`);
    closeDb();
    process.exit(0);
  };

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT',  () => shutdown('SIGINT'));
}