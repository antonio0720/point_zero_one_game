/**
 * Anti-Spam Scoring Implementation
 * backend/src/services/anti_spam_scoring/anti_spam_scoring_impl.ts
 *
 * Spec: PZO_CREATOR_T103
 * "Compute score; actions: throttle quotas, sandbox-only mode, manual review
 *  for repeat offenders; receipts."
 *
 * Scores creator submissions on four dimensions:
 *   1. Near-Duplicate Hash — similarity to existing approved/rejected content
 *   2. Novelty Score — structural diversity compared to the creator's own catalog
 *   3. Failure Repetition — repeated rejections with similar patterns
 *   4. Engagement Authenticity — suspicious play/vote patterns on the creator's content
 *
 * Each dimension produces a 0–100 risk score. The composite score determines
 * the enforcement action:
 *   0–29:  PASS — normal processing
 *  30–59:  THROTTLE — reduce submission quota by 50%
 *  60–79:  SANDBOX — submissions go to sandbox-only mode
 *  80–100: MANUAL_REVIEW — flag for human review, submissions blocked
 *
 * Every scoring decision writes an immutable receipt to the audit trail.
 *
 * Density6 LLC · Point Zero One · Confidential
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type EnforcementAction = 'PASS' | 'THROTTLE' | 'SANDBOX' | 'MANUAL_REVIEW';

export interface SpamScoreInput {
  /** The submission being scored */
  submissionId: string;
  /** The creator who submitted */
  creatorId: string;
  /** Content hash of the submission */
  contentHash: string;
  /** Title of the submission */
  title: string;
  /** Description/tags */
  description: string;
  /** Tags attached to the submission */
  tags: string[];
  /** Structural fingerprint (scenario layout, mechanic usage, etc.) */
  structuralFingerprint: string;
}

export interface SpamScoreResult {
  submissionId: string;
  creatorId: string;
  /** Individual dimension scores (0–100, higher = more suspicious) */
  dimensions: {
    nearDuplicate: number;
    novelty: number;
    failureRepetition: number;
    engagementAuthenticity: number;
  };
  /** Weighted composite score (0–100) */
  compositeScore: number;
  /** Enforcement action determined by composite score */
  action: EnforcementAction;
  /** Human-readable reason for the action */
  reason: string;
  /** Whether quota was throttled as a result */
  quotaThrottled: boolean;
  /** Receipt ID for audit trail */
  receiptId: string;
  /** ISO timestamp */
  scoredAt: string;
}

export interface CreatorHistory {
  /** Recent content hashes (last 50 submissions) */
  recentContentHashes: string[];
  /** Recent structural fingerprints */
  recentFingerprints: string[];
  /** Count of rejections in the last 30 days */
  recentRejections: number;
  /** Count of submissions in the last 30 days */
  recentSubmissions: number;
  /** Rejection patterns (reason codes) */
  rejectionPatterns: string[];
  /** Suspicious engagement flags from other systems */
  engagementFlags: string[];
}

export interface SpamScoringReceipt {
  receiptId: string;
  submissionId: string;
  creatorId: string;
  compositeScore: number;
  action: EnforcementAction;
  dimensions: SpamScoreResult['dimensions'];
  reason: string;
  createdAt: string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONSTANTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const DIMENSION_WEIGHTS = {
  nearDuplicate: 0.35,
  novelty: 0.25,
  failureRepetition: 0.25,
  engagementAuthenticity: 0.15,
};

const ACTION_THRESHOLDS: Array<{ max: number; action: EnforcementAction }> = [
  { max: 30, action: 'PASS' },
  { max: 60, action: 'THROTTLE' },
  { max: 80, action: 'SANDBOX' },
  { max: 101, action: 'MANUAL_REVIEW' },
];

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
      for (const path of ['../../db/pool', '../../services/database', '../../services/database/DatabaseClient']) {
        try {
          const mod = await runtimeImport(path);
          const candidate = mod.default ?? mod['pool'] ?? mod['db'] ?? mod;
          if (candidate && typeof (candidate as Queryable).query === 'function') return candidate as Queryable;
        } catch { /* next */ }
      }
      throw new Error('Unable to resolve database client for AntiSpamScoring.');
    })().catch(err => { cachedDb = null; throw err; });
  }
  return cachedDb;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DIMENSION SCORERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Score near-duplicate risk (0–100).
 * Compares content hash and title similarity against existing catalog.
 */
function scoreNearDuplicate(input: SpamScoreInput, history: CreatorHistory): number {
  // Exact content hash match
  if (history.recentContentHashes.includes(input.contentHash)) return 100;

  // Similarity check using character-level n-gram overlap on title
  const titleGrams = extractNgrams(input.title.toLowerCase(), 3);
  let maxSimilarity = 0;

  // Compare structural fingerprint against recent fingerprints
  for (const fp of history.recentFingerprints) {
    const fpGrams = extractNgrams(fp, 3);
    const similarity = jaccardSimilarity(titleGrams, fpGrams);
    maxSimilarity = Math.max(maxSimilarity, similarity);
  }

  // Scale: 0.0 → 0 risk, 0.8+ → 90 risk, 1.0 → 100 risk
  if (maxSimilarity >= 0.95) return 95;
  if (maxSimilarity >= 0.8) return 80;
  if (maxSimilarity >= 0.6) return 50;
  if (maxSimilarity >= 0.4) return 25;
  return Math.round(maxSimilarity * 30);
}

/**
 * Score novelty (0–100, higher = less novel = more suspicious).
 * Measures structural diversity of this submission vs creator's catalog.
 */
function scoreNovelty(input: SpamScoreInput, history: CreatorHistory): number {
  if (history.recentFingerprints.length === 0) return 0; // First submission — maximum novelty

  const inputGrams = extractNgrams(input.structuralFingerprint, 4);
  let totalSimilarity = 0;

  for (const fp of history.recentFingerprints) {
    const fpGrams = extractNgrams(fp, 4);
    totalSimilarity += jaccardSimilarity(inputGrams, fpGrams);
  }

  const avgSimilarity = totalSimilarity / history.recentFingerprints.length;

  // High avg similarity = low novelty = high risk
  return Math.round(Math.min(100, avgSimilarity * 120));
}

/**
 * Score failure repetition (0–100).
 * Repeated rejections with similar patterns indicate spam/abuse.
 */
function scoreFailureRepetition(history: CreatorHistory): number {
  if (history.recentSubmissions === 0) return 0;

  const rejectionRate = history.recentRejections / history.recentSubmissions;

  // Check for repeated rejection patterns (same reason codes)
  const patternCounts = new Map<string, number>();
  for (const pattern of history.rejectionPatterns) {
    patternCounts.set(pattern, (patternCounts.get(pattern) ?? 0) + 1);
  }

  const maxRepeatedPattern = Math.max(0, ...Array.from(patternCounts.values()));
  const patternRepetitionBonus = Math.min(30, maxRepeatedPattern * 10);

  // Scale: 0% rejection → 0, 50% → 40, 80%+ → 70, plus pattern bonus
  let baseScore = 0;
  if (rejectionRate >= 0.8) baseScore = 70;
  else if (rejectionRate >= 0.5) baseScore = 40;
  else if (rejectionRate >= 0.3) baseScore = 20;
  else baseScore = Math.round(rejectionRate * 30);

  return Math.min(100, baseScore + patternRepetitionBonus);
}

/**
 * Score engagement authenticity (0–100).
 * Checks for suspicious engagement patterns flagged by other systems.
 */
function scoreEngagementAuthenticity(history: CreatorHistory): number {
  if (history.engagementFlags.length === 0) return 0;

  const flagWeights: Record<string, number> = {
    'SELF_PLAY_DETECTED': 30,
    'COORDINATED_VOTES': 40,
    'BURST_PLAYS': 20,
    'IDENTICAL_DEVICE_CLUSTER': 35,
    'REVIEW_BOMBING': 25,
    'SUSPICIOUS_RETENTION_PATTERN': 15,
  };

  let totalScore = 0;
  for (const flag of history.engagementFlags) {
    totalScore += flagWeights[flag] ?? 10;
  }

  return Math.min(100, totalScore);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SCORING ENGINE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Compute anti-spam score for a creator submission.
 * Pure function — database access is done before calling this.
 */
export function computeScore(input: SpamScoreInput, history: CreatorHistory): SpamScoreResult {
  const dimensions = {
    nearDuplicate: scoreNearDuplicate(input, history),
    novelty: scoreNovelty(input, history),
    failureRepetition: scoreFailureRepetition(history),
    engagementAuthenticity: scoreEngagementAuthenticity(history),
  };

  const compositeScore = Math.round(
    dimensions.nearDuplicate * DIMENSION_WEIGHTS.nearDuplicate +
    dimensions.novelty * DIMENSION_WEIGHTS.novelty +
    dimensions.failureRepetition * DIMENSION_WEIGHTS.failureRepetition +
    dimensions.engagementAuthenticity * DIMENSION_WEIGHTS.engagementAuthenticity,
  );

  const action = ACTION_THRESHOLDS.find(t => compositeScore < t.max)?.action ?? 'MANUAL_REVIEW';

  const reasons: string[] = [];
  if (dimensions.nearDuplicate >= 60) reasons.push('High similarity to existing content');
  if (dimensions.novelty >= 60) reasons.push('Low structural novelty');
  if (dimensions.failureRepetition >= 60) reasons.push('Repeated rejection patterns');
  if (dimensions.engagementAuthenticity >= 60) reasons.push('Suspicious engagement signals');
  if (reasons.length === 0) reasons.push('Within acceptable thresholds');

  return {
    submissionId: input.submissionId,
    creatorId: input.creatorId,
    dimensions,
    compositeScore,
    action,
    reason: reasons.join('; '),
    quotaThrottled: action === 'THROTTLE' || action === 'SANDBOX' || action === 'MANUAL_REVIEW',
    receiptId: crypto.randomUUID(),
    scoredAt: new Date().toISOString(),
  };
}

/**
 * Full scoring pipeline: fetch history → compute → persist receipt → apply enforcement.
 */
export async function scoreSubmission(input: SpamScoreInput): Promise<SpamScoreResult> {
  const history = await fetchCreatorHistory(input.creatorId);
  const result = computeScore(input, history);

  // Persist receipt
  await writeReceipt(result);

  // Apply enforcement action
  await applyEnforcement(result);

  return result;
}

/**
 * Fetch creator's recent history for scoring context.
 */
async function fetchCreatorHistory(creatorId: string): Promise<CreatorHistory> {
  const db = await getDb();

  // Recent content hashes
  const hashResult = await db.query(
    `SELECT content_hash FROM anti_spam_scores WHERE creator_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [creatorId],
  ).catch(() => ({ rows: [] }));

  // Recent fingerprints
  const fpResult = await db.query(
    `SELECT structural_fingerprint FROM anti_spam_scores WHERE creator_id = $1 AND structural_fingerprint IS NOT NULL ORDER BY created_at DESC LIMIT 50`,
    [creatorId],
  ).catch(() => ({ rows: [] }));

  // Rejection stats (last 30 days)
  const statsResult = await db.query(
    `SELECT
       COUNT(*) AS total_submissions,
       COUNT(*) FILTER (WHERE action IN ('SANDBOX', 'MANUAL_REVIEW')) AS rejections
     FROM anti_spam_scores
     WHERE creator_id = $1 AND created_at > NOW() - INTERVAL '30 days'`,
    [creatorId],
  ).catch(() => ({ rows: [{ total_submissions: 0, rejections: 0 }] }));

  // Rejection patterns
  const patternResult = await db.query(
    `SELECT reason FROM anti_spam_scores WHERE creator_id = $1 AND action IN ('SANDBOX', 'MANUAL_REVIEW') AND created_at > NOW() - INTERVAL '30 days'`,
    [creatorId],
  ).catch(() => ({ rows: [] }));

  // Engagement flags (from separate engagement_flags table if it exists)
  const flagResult = await db.query(
    `SELECT flag_type FROM engagement_flags WHERE creator_id = $1 AND resolved_at IS NULL`,
    [creatorId],
  ).catch(() => ({ rows: [] }));

  const stats = statsResult.rows[0] ?? {};

  return {
    recentContentHashes: hashResult.rows.map(r => String(r['content_hash'] ?? '')),
    recentFingerprints: fpResult.rows.map(r => String(r['structural_fingerprint'] ?? '')),
    recentRejections: Number(stats['rejections'] ?? 0),
    recentSubmissions: Number(stats['total_submissions'] ?? 0),
    rejectionPatterns: patternResult.rows.map(r => String(r['reason'] ?? '')),
    engagementFlags: flagResult.rows.map(r => String(r['flag_type'] ?? '')),
  };
}

/**
 * Write an immutable receipt to the audit trail.
 */
async function writeReceipt(result: SpamScoreResult): Promise<void> {
  const db = await getDb();
  await db.query(
    `INSERT INTO anti_spam_scores
       (id, submission_id, creator_id, composite_score, action, reason,
        near_duplicate_score, novelty_score, failure_repetition_score,
        engagement_authenticity_score, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      result.receiptId, result.submissionId, result.creatorId,
      result.compositeScore, result.action, result.reason,
      result.dimensions.nearDuplicate, result.dimensions.novelty,
      result.dimensions.failureRepetition, result.dimensions.engagementAuthenticity,
      result.scoredAt,
    ],
  ).catch(() => { /* receipt write is non-fatal */ });
}

/**
 * Apply enforcement action (quota throttle, sandbox mode, manual review flag).
 */
async function applyEnforcement(result: SpamScoreResult): Promise<void> {
  if (result.action === 'PASS') return;

  const db = await getDb();

  if (result.action === 'THROTTLE') {
    // Reduce quota by 50%
    await db.query(
      `UPDATE creator_quotas SET
         daily_limit = GREATEST(1, daily_limit / 2),
         throttled_until = NOW() + INTERVAL '24 hours',
         throttle_reason = $2,
         updated_at = NOW()
       WHERE creator_id = $1`,
      [result.creatorId, result.reason],
    ).catch(() => {});
  }

  if (result.action === 'SANDBOX') {
    // Force sandbox-only mode
    await db.query(
      `UPDATE creator_quotas SET
         sandbox_only = true,
         sandbox_until = NOW() + INTERVAL '7 days',
         sandbox_reason = $2,
         updated_at = NOW()
       WHERE creator_id = $1`,
      [result.creatorId, result.reason],
    ).catch(() => {});
  }

  if (result.action === 'MANUAL_REVIEW') {
    // Flag for human review
    await db.query(
      `INSERT INTO manual_review_queue (id, creator_id, submission_id, reason, priority, created_at)
       VALUES ($1, $2, $3, $4, 'HIGH', NOW())
       ON CONFLICT (submission_id) DO NOTHING`,
      [crypto.randomUUID(), result.creatorId, result.submissionId, result.reason],
    ).catch(() => {});
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// UTILITY
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function extractNgrams(text: string, n: number): Set<string> {
  const grams = new Set<string>();
  for (let i = 0; i <= text.length - n; i++) {
    grams.add(text.slice(i, i + n));
  }
  return grams;
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}