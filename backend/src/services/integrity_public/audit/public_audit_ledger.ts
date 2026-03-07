/**
 * Public Audit Ledger
 * backend/src/services/integrity_public/audit/public_audit_ledger.ts
 *
 * Spec: PZO_IP_T032 + PZO_INTEGRITY_T031
 * Append-only audit ledger for public-safe integrity transparency data.
 *
 * This ledger powers the /integrity page on pointzeroonegame.com.
 * Every entry is:
 *   - Public-safe (no PII, no exploit details, no attacker hints)
 *   - Hash-chained (each entry references the previous entry's hash)
 *   - Immutable (append-only — no updates, no deletes)
 *   - Categorized by safe reason categories (not raw forensics)
 *
 * Internal forensics data is stored separately and linked via an opaque
 * pointer (forensics_ref_id) that is NOT exposed publicly.
 *
 * Density6 LLC · Point Zero One · Confidential
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type VerificationStatus = 'VERIFIED' | 'QUARANTINED' | 'PENDING' | 'APPEALED' | 'REVERSED';

/** Safe reason categories — never reveal exploit details */
export type SafeReasonCategory =
  | 'DETERMINISM_PASS'
  | 'DETERMINISM_FAIL'
  | 'CONTENT_PIN_MISMATCH'
  | 'DEVICE_TRUST_BELOW_THRESHOLD'
  | 'REPLAY_INCONSISTENCY'
  | 'APPEAL_SUBMITTED'
  | 'APPEAL_UPHELD'
  | 'APPEAL_REVERSED'
  | 'MANUAL_REVIEW_REQUESTED'
  | 'SYSTEM_AUTO_VERIFIED';

export interface PublicAuditEntry {
  entryId: string;
  /** Sequence number — monotonically increasing */
  sequenceNumber: number;
  /** Hash of the previous entry (genesis entry uses '0000000000000000') */
  previousHash: string;
  /** Hash of this entry (computed from all fields except this one) */
  entryHash: string;
  /** What happened */
  status: VerificationStatus;
  /** Why — using safe categories only */
  reasonCategory: SafeReasonCategory;
  /** Public-safe description (no PII, no exploit details) */
  publicDescription: string;
  /** Opaque pointer to internal forensics (NEVER exposed to public API) */
  forensicsRefId: string | null;
  /** Aggregate counters for transparency reporting */
  counters: TransparencyCounters;
  /** ISO timestamp */
  createdAt: string;
}

export interface TransparencyCounters {
  /** Running total: verified runs this period */
  verifiedRunsTotal: number;
  /** Running total: quarantined runs this period */
  quarantinedRunsTotal: number;
  /** Running total: appeals submitted this period */
  appealsSubmittedTotal: number;
  /** Running total: appeals upheld this period */
  appealsUpheldTotal: number;
  /** Running total: appeals reversed this period */
  appealsReversedTotal: number;
  /** Average verification latency in ms (rolling window) */
  avgVerificationLatencyMs: number;
}

export interface RollupPeriod {
  periodId: string;
  /** Period type */
  periodType: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  /** Period start ISO */
  startsAt: string;
  /** Period end ISO */
  endsAt: string;
  /** Aggregate counters for the period */
  counters: TransparencyCounters;
  /** Top reason categories with counts (public-safe) */
  topReasonCategories: Array<{ category: SafeReasonCategory; count: number }>;
  /** Enforcement action counts (redacted — no individual details) */
  enforcementCounts: {
    gatesTriggered: number;
    autoQuarantined: number;
    manualReviewed: number;
  };
  /** Hash of the rollup data for tamper detection */
  rollupHash: string;
  createdAt: string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DATABASE ABSTRACTION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type QueryRow = Record<string, unknown>;
type Queryable = { query: (sql: string, params?: readonly unknown[]) => Promise<{ rows: QueryRow[] }> };

const runtimeImport = new Function('specifier', 'return import(specifier)') as
  (specifier: string) => Promise<Record<string, unknown>>;

let cachedDb: Promise<Queryable> | null = null;

async function getDb(): Promise<Queryable> {
  if (!cachedDb) {
    cachedDb = (async () => {
      for (const path of ['../../../db/pool', '../../../services/database', '../../../services/database/DatabaseClient']) {
        try {
          const mod = await runtimeImport(path);
          const candidate = mod.default ?? mod['pool'] ?? mod['db'] ?? mod;
          if (candidate && typeof (candidate as Queryable).query === 'function') return candidate as Queryable;
        } catch { /* next */ }
      }
      throw new Error('Unable to resolve database client for PublicAuditLedger.');
    })().catch(err => { cachedDb = null; throw err; });
  }
  return cachedDb;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HASHING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const GENESIS_HASH = '0000000000000000';

/**
 * Compute FNV-1a hash of the entry fields (excluding entryHash itself).
 * For production, swap to SHA-256 via crypto.subtle.
 */
function computeEntryHash(
  sequenceNumber: number,
  previousHash: string,
  status: VerificationStatus,
  reasonCategory: SafeReasonCategory,
  publicDescription: string,
  createdAt: string,
): string {
  const input = `${sequenceNumber}:${previousHash}:${status}:${reasonCategory}:${publicDescription}:${createdAt}`;
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function computeRollupHash(period: Omit<RollupPeriod, 'rollupHash' | 'createdAt'>): string {
  const input = JSON.stringify(period);
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// REDACTION — ensure nothing unsafe leaks
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const UNSAFE_PATTERNS = [
  /\b\d{3}-\d{2}-\d{4}\b/g,           // SSN
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // email
  /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,              // IP
  /exploit|vulnerability|bypass|injection|overflow/gi,       // exploit hints
  /CVE-\d{4}-\d+/gi,                  // CVE references
];

function redact(text: string): string {
  let safe = text;
  for (const pattern of UNSAFE_PATTERNS) {
    safe = safe.replace(pattern, '[REDACTED]');
  }
  return safe.slice(0, 500); // hard cap on description length
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LEDGER OPERATIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Append a new entry to the public audit ledger.
 * Hash-chained to the previous entry. Immutable.
 */
export async function appendEntry(
  status: VerificationStatus,
  reasonCategory: SafeReasonCategory,
  publicDescription: string,
  forensicsRefId: string | null = null,
  counterUpdates?: Partial<TransparencyCounters>,
): Promise<PublicAuditEntry> {
  const db = await getDb();
  const now = new Date().toISOString();

  // Get the latest entry for hash chaining
  const lastResult = await db.query(
    `SELECT sequence_number, entry_hash FROM integrity_public_audit_log ORDER BY sequence_number DESC LIMIT 1`,
  );

  const lastSeq = lastResult.rows[0] ? Number(lastResult.rows[0]['sequence_number']) : 0;
  const lastHash = lastResult.rows[0] ? String(lastResult.rows[0]['entry_hash']) : GENESIS_HASH;

  const sequenceNumber = lastSeq + 1;
  const safeDescription = redact(publicDescription);

  const entryHash = computeEntryHash(
    sequenceNumber, lastHash, status, reasonCategory, safeDescription, now,
  );

  // Compute running counters
  const lastCounters = lastResult.rows[0]
    ? JSON.parse(String(lastResult.rows[0]['counters'] ?? '{}'))
    : { verifiedRunsTotal: 0, quarantinedRunsTotal: 0, appealsSubmittedTotal: 0, appealsUpheldTotal: 0, appealsReversedTotal: 0, avgVerificationLatencyMs: 0 };

  const counters: TransparencyCounters = {
    verifiedRunsTotal: (lastCounters.verifiedRunsTotal ?? 0) + (counterUpdates?.verifiedRunsTotal ?? (status === 'VERIFIED' ? 1 : 0)),
    quarantinedRunsTotal: (lastCounters.quarantinedRunsTotal ?? 0) + (counterUpdates?.quarantinedRunsTotal ?? (status === 'QUARANTINED' ? 1 : 0)),
    appealsSubmittedTotal: (lastCounters.appealsSubmittedTotal ?? 0) + (counterUpdates?.appealsSubmittedTotal ?? (status === 'APPEALED' ? 1 : 0)),
    appealsUpheldTotal: (lastCounters.appealsUpheldTotal ?? 0) + (counterUpdates?.appealsUpheldTotal ?? 0),
    appealsReversedTotal: (lastCounters.appealsReversedTotal ?? 0) + (counterUpdates?.appealsReversedTotal ?? (status === 'REVERSED' ? 1 : 0)),
    avgVerificationLatencyMs: counterUpdates?.avgVerificationLatencyMs ?? lastCounters.avgVerificationLatencyMs ?? 0,
  };

  const entryId = crypto.randomUUID();

  await db.query(
    `INSERT INTO integrity_public_audit_log
       (id, sequence_number, previous_hash, entry_hash, status, reason_category,
        public_description, forensics_ref_id, counters, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [entryId, sequenceNumber, lastHash, entryHash, status, reasonCategory,
     safeDescription, forensicsRefId, JSON.stringify(counters), now],
  );

  return {
    entryId, sequenceNumber, previousHash: lastHash, entryHash,
    status, reasonCategory, publicDescription: safeDescription,
    forensicsRefId, counters, createdAt: now,
  };
}

/**
 * Read the latest N entries from the ledger (public-safe — no forensicsRefId).
 */
export async function getRecentEntries(limit: number = 50): Promise<Omit<PublicAuditEntry, 'forensicsRefId'>[]> {
  const db = await getDb();
  const result = await db.query(
    `SELECT id, sequence_number, previous_hash, entry_hash, status, reason_category,
            public_description, counters, created_at
     FROM integrity_public_audit_log
     ORDER BY sequence_number DESC
     LIMIT $1`,
    [Math.min(limit, 200)],
  );

  return result.rows.map(mapPublicEntry);
}

/**
 * Verify the hash chain integrity of the ledger.
 * Returns the first broken link, or null if the chain is intact.
 */
export async function verifyChain(limit: number = 1000): Promise<{ intact: boolean; brokenAt?: number; expected?: string; found?: string }> {
  const db = await getDb();
  const result = await db.query(
    `SELECT sequence_number, previous_hash, entry_hash
     FROM integrity_public_audit_log
     ORDER BY sequence_number ASC
     LIMIT $1`,
    [limit],
  );

  let expectedPrevHash = GENESIS_HASH;
  for (const row of result.rows) {
    const prevHash = String(row['previous_hash']);
    const seq = Number(row['sequence_number']);

    if (prevHash !== expectedPrevHash) {
      return { intact: false, brokenAt: seq, expected: expectedPrevHash, found: prevHash };
    }
    expectedPrevHash = String(row['entry_hash']);
  }

  return { intact: true };
}

/**
 * Generate a transparency rollup for a period.
 */
export async function generateRollup(
  periodType: RollupPeriod['periodType'],
  startsAt: string,
  endsAt: string,
): Promise<RollupPeriod> {
  const db = await getDb();

  // Aggregate counters for the period
  const statsResult = await db.query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'VERIFIED') AS verified_count,
       COUNT(*) FILTER (WHERE status = 'QUARANTINED') AS quarantined_count,
       COUNT(*) FILTER (WHERE status = 'APPEALED') AS appeals_submitted,
       COUNT(*) FILTER (WHERE reason_category = 'APPEAL_UPHELD') AS appeals_upheld,
       COUNT(*) FILTER (WHERE reason_category = 'APPEAL_REVERSED') AS appeals_reversed
     FROM integrity_public_audit_log
     WHERE created_at >= $1 AND created_at < $2`,
    [startsAt, endsAt],
  );

  const stats = statsResult.rows[0] ?? {};

  // Top reason categories
  const reasonResult = await db.query(
    `SELECT reason_category, COUNT(*) AS cnt
     FROM integrity_public_audit_log
     WHERE created_at >= $1 AND created_at < $2
     GROUP BY reason_category
     ORDER BY cnt DESC
     LIMIT 10`,
    [startsAt, endsAt],
  );

  const counters: TransparencyCounters = {
    verifiedRunsTotal: Number(stats['verified_count'] ?? 0),
    quarantinedRunsTotal: Number(stats['quarantined_count'] ?? 0),
    appealsSubmittedTotal: Number(stats['appeals_submitted'] ?? 0),
    appealsUpheldTotal: Number(stats['appeals_upheld'] ?? 0),
    appealsReversedTotal: Number(stats['appeals_reversed'] ?? 0),
    avgVerificationLatencyMs: 0,
  };

  const topReasonCategories = reasonResult.rows.map(r => ({
    category: String(r['reason_category']) as SafeReasonCategory,
    count: Number(r['cnt']),
  }));

  const rollupData = {
    periodId: crypto.randomUUID(),
    periodType,
    startsAt,
    endsAt,
    counters,
    topReasonCategories,
    enforcementCounts: {
      gatesTriggered: counters.quarantinedRunsTotal,
      autoQuarantined: counters.quarantinedRunsTotal,
      manualReviewed: counters.appealsSubmittedTotal,
    },
  };

  const rollupHash = computeRollupHash(rollupData);
  const now = new Date().toISOString();

  return { ...rollupData, rollupHash, createdAt: now };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAPPERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function mapPublicEntry(row: QueryRow): Omit<PublicAuditEntry, 'forensicsRefId'> {
  return {
    entryId: String(row['id'] ?? ''),
    sequenceNumber: Number(row['sequence_number'] ?? 0),
    previousHash: String(row['previous_hash'] ?? GENESIS_HASH),
    entryHash: String(row['entry_hash'] ?? ''),
    status: String(row['status'] ?? 'PENDING') as VerificationStatus,
    reasonCategory: String(row['reason_category'] ?? 'SYSTEM_AUTO_VERIFIED') as SafeReasonCategory,
    publicDescription: String(row['public_description'] ?? ''),
    counters: JSON.parse(String(row['counters'] ?? '{}')),
    createdAt: String(row['created_at'] ?? ''),
  };
}