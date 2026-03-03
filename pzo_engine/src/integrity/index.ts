/**
 * index.ts
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo_engine/src/integrity/index.ts
 *
 * POINT ZERO ONE — INTEGRITY LAYER BARREL EXPORT
 * Density6 LLC · Confidential · Do not distribute
 *
 * Import boundary rules:
 *   ✦ Consumers outside the integrity layer MUST import from here —
 *     never from individual files. This enforces the API surface.
 *   ✦ The sovereignty engine (pzo-web) imports types from integrity-types
 *     via its own copy in engines/sovereignty/types.ts.
 *   ✦ The persistence layer (pzo_engine/src/persistence/) imports
 *     ProofHashInput and ProofHashResult from here.
 *
 * Files NOT exported (internal implementation only):
 *   ✦ None — all public API is surfaced through this barrel.
 *
 * Files DELETED (broken — not replaced):
 *   ✦ seed-commit-reveal.ts — imported non-existent './hash' and '../ml/model'.
 *     Commit/reveal logic was placeholder-only. Seed commitment is handled
 *     at the run-init level in DemoOrchestrator and the engine orchestrator.
 *     If server-side seed commitment is needed in future, implement as a
 *     standalone module with real cryptographic nonce logic.
 */

// ── Types (zero-runtime, import freely) ──────────────────────────────────────
export type {
  // Game context
  GameMode,
  GameModeAlias,
  RunOutcome,
  IntegrityStatus,
  ArtifactFormat,

  // Grade + badge
  RunGrade,
  ExtendedGrade,
  BadgeTier,

  // CORD tier
  CordTier,

  // Hash contract
  ProofHashInput,
  ProofHashResult,
  ProofHashVersion,

  // Pipeline types
  DecisionRecord,
  TickSnapshot,
  RunAccumulatorStats,
  SovereigntyScoreComponents,
  SovereigntyScore,
  RunSignature,
  GradeReward,
  RunIdentity,
  ProofArtifact,
  IntegrityCheckResult,

  // Event payloads
  RunCompletedPayload,
  ProofVerificationFailedPayload,
  ProofArtifactReadyPayload,
  RunRewardDispatchedPayload,
} from './integrity-types';

// ── Constants ─────────────────────────────────────────────────────────────────
export {
  GAME_MODE_ALIASES,
  GRADE_TO_BADGE_TIER,
  GRADE_LABELS,
  GRADE_COLORS,
  CORD_TIER_THRESHOLDS,
  CORD_TIER_COLORS,
  SOVEREIGNTY_WEIGHTS,
  OUTCOME_MULTIPLIERS,
  GRADE_THRESHOLDS,
  BLEED_MODE_GRADE_THRESHOLDS,
  PROOF_HASH_VERSION,
} from './integrity-types';

// ── Hash primitives ───────────────────────────────────────────────────────────
export { HashFunction } from './hash-function';

// ── Proof hash (Step 2 of sovereignty pipeline) ───────────────────────────────
export {
  generateProofHash,
  verifyProofHash,
  computeTickStreamChecksum,
  buildTickHashInput,
  crc32hex,
  computeRunFingerprint,
  ProofHashError,
  DEMO_HASH_PREFIX,
} from './proof-hash';

// ── Replay integrity (Step 1 of sovereignty pipeline) ────────────────────────
export {
  ReplayIntegrityChecker,
  verifyRunIntegrity,
} from './replay-validator';

// ── Ruleset version ───────────────────────────────────────────────────────────
export {
  RULESET_VERSION,
  RULESET_CHANGELOG,
  currentRulesetVersion,
  isVersionCompatible,
  isProofHashCompatible,
  isCurrentHashVersion,
  isLegacyHashVersion,
  assertRulesetVersionBound,
  MODE_VERSION_GATES,
  isModeEligibleForVersion,
} from './ruleset-version';
export type { RulesetVersion } from './ruleset-version';

// ── Signed actions ────────────────────────────────────────────────────────────
export { SignedAction, createSignedAction } from './signed-actions';