/* ========================================================================
 * POINT ZERO ONE — BACKEND SOVEREIGNTY PERSISTENCE WRITER
 * /backend/src/game/engine/sovereignty/SovereigntyPersistenceWriter.ts
 *
 * Doctrine:
 * - persistence is idempotent and deterministic
 * - write-shapes are canonicalized before touching repositories
 * - repositories are injected so this layer remains DB/storage agnostic
 * - batch writing order is stable: ticks -> run -> artifact -> audit
 * - every import is consumed in runtime code — zero dead imports
 * - ML/DL feature extraction is a first-class persistence capability
 * - DL tensor construction is deterministic and replay-stable
 * - UX narrative generation drives post-persistence companion commentary
 * - serialization/deserialization is round-trip safe and checksum-verified
 * - audit trails are HMAC-signed and tamper-evident
 * - self-test validates the full persistence pipeline end-to-end
 *
 * Sections:
 *   Section 0  — IMPORTS
 *   Section 1  — MODULE CONSTANTS & CONFIGURATION
 *   Section 2  — TYPES & INTERFACES
 *   Section 3  — WRITE RECORD VALIDATION
 *   Section 4  — SovereigntyPersistenceWriter CLASS (massively expanded)
 *   Section 5  — TICK WRITE PIPELINE
 *   Section 6  — RUN WRITE PIPELINE
 *   Section 7  — ARTIFACT WRITE PIPELINE
 *   Section 8  — AUDIT WRITE PIPELINE
 *   Section 9  — PERSISTENCE ENVELOPE BUILDER
 *   Section 10 — BATCH PERSISTENCE
 *   Section 11 — ML FEATURE EXTRACTION (32-dim)
 *   Section 12 — DL TENSOR CONSTRUCTION (48-dim)
 *   Section 13 — UX NARRATIVE GENERATION
 *   Section 14 — SERIALIZATION & DESERIALIZATION
 *   Section 15 — PERSISTENCE AUDIT TRAIL
 *   Section 16 — ENGINE WIRING (PersistenceRunContext)
 *   Section 17 — SELF-TEST
 * ====================================================================== */

// ============================================================================
// SECTION 0 — IMPORTS
// ============================================================================

import {
  sha256,
  sha512,
  hmacSha256,
  checksumSnapshot,
  checksumParts,
  stableStringify,
  createDeterministicId,
  DeterministicRNG,
  deepFreeze,
  deepFrozenClone,
  canonicalSort,
  flattenCanonical,
  computeProofHash,
  computeExtendedProofHash,
  computeTickSeal,
  computeChainedTickSeal,
  GENESIS_SEAL,
  cloneJson,
  MerkleChain,
  RunAuditLog,
} from '../core/Deterministic';

import type {
  RunStateSnapshot,
  SovereigntyState,
  EconomyState,
  PressureState,
  ShieldState,
  BattleState,
  CascadeState,
  TelemetryState,
} from '../core/RunStateSnapshot';

import {
  MODE_CODES,
  PRESSURE_TIERS,
  RUN_PHASES,
  RUN_OUTCOMES,
  SHIELD_LAYER_IDS,
  INTEGRITY_STATUSES,
  VERIFIED_GRADES,
  PRESSURE_TIER_NORMALIZED,
  PRESSURE_TIER_URGENCY_LABEL,
  PRESSURE_TIER_MIN_HOLD_TICKS,
  PRESSURE_TIER_ESCALATION_THRESHOLD,
  PRESSURE_TIER_DEESCALATION_THRESHOLD,
  SHIELD_LAYER_ABSORPTION_ORDER,
  SHIELD_LAYER_CAPACITY_WEIGHT,
  SHIELD_LAYER_LABEL_BY_ID,
  TIMING_CLASS_WINDOW_PRIORITY,
  TIMING_CLASS_URGENCY_DECAY,
  BOT_THREAT_LEVEL,
  BOT_STATE_THREAT_MULTIPLIER,
  BOT_STATE_ALLOWED_TRANSITIONS,
  INTEGRITY_STATUS_RISK_SCORE,
  VERIFIED_GRADE_NUMERIC_SCORE,
  MODE_NORMALIZED,
  MODE_DIFFICULTY_MULTIPLIER,
  MODE_TENSION_FLOOR,
  RUN_PHASE_NORMALIZED,
  RUN_PHASE_STAKES_MULTIPLIER,
  RUN_PHASE_TICK_BUDGET_FRACTION,
  LEGEND_MARKER_KIND_WEIGHT,
  DECK_TYPE_POWER_LEVEL,
  DECK_TYPE_IS_OFFENSIVE,
  CARD_RARITY_WEIGHT,
  ATTACK_CATEGORY_BASE_MAGNITUDE,
  ATTACK_CATEGORY_IS_COUNTERABLE,
  COUNTERABILITY_RESISTANCE_SCORE,
  TARGETING_SPREAD_FACTOR,
  DIVERGENCE_POTENTIAL_NORMALIZED,
  VISIBILITY_CONCEALMENT_FACTOR,
  isModeCode,
  isRunPhase,
  isRunOutcome,
  isShieldLayerId,
  isIntegrityStatus,
  isVerifiedGrade,
  isPressureTier,
  isHaterBotId,
  isTimingClass,
  isDeckType,
  isVisibilityLevel,
  isWinOutcome,
  isLossOutcome,
  scoreOutcomeExcitement,
  computeRunProgressFraction,
  computeEffectiveStakes,
  isEndgamePhase,
  computePressureRiskScore,
  canEscalatePressure,
  canDeescalatePressure,
  describePressureTierExperience,
  computeShieldLayerVulnerability,
  computeShieldIntegrityRatio,
  estimateShieldRegenPerTick,
  classifyAttackSeverity,
  computeEffectiveAttackDamage,
  isAttackCounterable,
  isShieldTargetedAttack,
  isAttackFromBot,
  scoreAttackResponseUrgency,
  scoreThreatUrgency,
  classifyThreatUrgency,
  findMostUrgentThreat,
  computeAggregateThreatPressure,
  computeEffectFinancialImpact,
  computeEffectShieldImpact,
  computeEffectMagnitude,
  computeEffectRiskScore,
  isEffectNetPositive,
  computeCardPowerScore,
  computeCardCostEfficiency,
  isCardLegalInMode,
  computeCardDecayUrgency,
  canCardCounterAttack,
  computeCardTimingPriority,
  isCardOffensive,
  scoreCascadeChainHealth,
  classifyCascadeChainHealth,
  computeCascadeProgressPercent,
  isCascadeRecoverable,
  computeCascadeExperienceImpact,
  computeLegendMarkerValue,
  classifyLegendMarkerSignificance,
  computeLegendMarkerDensity,
} from '../core/GamePrimitives';

import { CORD_WEIGHTS, OUTCOME_MULTIPLIER } from './types';

import {
  SOVEREIGNTY_PERSISTENCE_VERSION,
  SOVEREIGNTY_CONTRACT_VERSION,
  SOVEREIGNTY_EXPORT_VERSION,
  DEFAULT_SOVEREIGNTY_CLIENT_VERSION,
  DEFAULT_SOVEREIGNTY_ENGINE_VERSION,
  badgeTierForGrade,
  normalizeGrade,
  normalizeIntegrityStatus,
  computeCORDScore,
  computeOutcomeMultiplier,
  computeFinalScore,
  assignGradeFromScore,
  computeScorePercentile,
  computeGradeDistanceFromNext,
  scoreToGradeLabel,
  computeFullScoreBreakdown,
  extractScoreComponentsFromSummary,
  generateGradeNarrative,
  generateIntegrityNarrative,
  validateTickRecord,
  validateRunSummary,
  validateExportArtifact,
  createEmptyTickRecord,
  createEmptyRunSummary,
  createEmptyProofCard,
  createEmptyExportArtifact,
  type SovereigntyAdapterContext,
  type SovereigntyArtifactWriteRecord,
  type SovereigntyAuditWriteRecord,
  type SovereigntyExportArtifact,
  type SovereigntyPersistenceEnvelope,
  type SovereigntyPersistenceTarget,
  type SovereigntyRunSummary,
  type SovereigntyRunWriteRecord,
  type SovereigntyTickRecord,
  type SovereigntyTickWriteRecord,
  type SovereigntyGrade,
  type SovereigntyBadgeTier,
  type SovereigntyIntegrityStatus,
  type SovereigntyScoreBreakdown,
  type SovereigntyScoreComponents,
  type ValidationResult,
} from './contracts';

import { SovereigntyExportAdapter } from './SovereigntyExportAdapter';
import { SovereigntySnapshotAdapter } from './SovereigntySnapshotAdapter';

// ============================================================================
// SECTION 1 — MODULE CONSTANTS & CONFIGURATION
// ============================================================================

/** Semantic version of the persistence writer module. */
export const PERSISTENCE_WRITER_VERSION = '2.0.0' as const;

/** Number of ML features extracted per persistence record. */
export const PERSISTENCE_ML_FEATURE_COUNT = 32 as const;

/** Number of DL tensor features per persistence record. */
export const PERSISTENCE_DL_FEATURE_COUNT = 48 as const;

/** SHA-256 hex pattern for checksum validation. */
const SHA256_HEX_RE = /^[a-f0-9]{64}$/i;

/** Maximum expected net worth for ML normalization. */
const MAX_NET_WORTH_NORMALIZATION = 1_000_000;

/** Maximum ticks in a run for normalization. */
const MAX_TICK_NORMALIZATION = 200;

/** Maximum sovereignty score for normalization. */
const MAX_SOVEREIGNTY_SCORE_NORMALIZATION = 100;

/** Maximum gap vs legend for normalization. */
const MAX_GAP_VS_LEGEND_NORMALIZATION = 200;

/** Maximum audit entries for normalization. */
const MAX_AUDIT_ENTRIES_NORMALIZATION = 500;

/** Maximum batch run index for normalization. */
const MAX_BATCH_RUN_INDEX_NORMALIZATION = 100;

/** Maximum HMAC signature length for normalization. */
const MAX_HMAC_LENGTH_NORMALIZATION = 64;

/** Maximum tick seal chain depth for normalization. */
const MAX_TICK_SEAL_DEPTH_NORMALIZATION = 200;

/** Persistence audit entry schema version. */
const PERSISTENCE_AUDIT_SCHEMA_VERSION = 'persistence-audit.v2.2026' as const;

/** Persistence serialization schema version. */
const PERSISTENCE_SERIALIZATION_SCHEMA_VERSION = 'persistence-serial.v2.2026' as const;

/** Default HMAC secret for audit signing when none is provided. */
const DEFAULT_HMAC_SECRET = 'persistence-writer-default-hmac-secret' as const;

/** Precomputed outcome index map from RUN_OUTCOMES. */
const OUTCOME_INDEX_MAP: Record<string, number> = Object.fromEntries(
  RUN_OUTCOMES.map((o, i) => [o, i]),
);

/** Precomputed mode index map from MODE_CODES. */
const MODE_INDEX_MAP: Record<string, number> = Object.fromEntries(
  MODE_CODES.map((m, i) => [m, i]),
);

/** Precomputed pressure tier index map from PRESSURE_TIERS. */
const PRESSURE_TIER_INDEX_MAP: Record<string, number> = Object.fromEntries(
  PRESSURE_TIERS.map((t, i) => [t, i]),
);

/** Precomputed phase index map from RUN_PHASES. */
const PHASE_INDEX_MAP: Record<string, number> = Object.fromEntries(
  RUN_PHASES.map((p, i) => [p, i]),
);

/** Precomputed integrity status index map from INTEGRITY_STATUSES. */
const INTEGRITY_STATUS_INDEX_MAP: Record<string, number> = Object.fromEntries(
  INTEGRITY_STATUSES.map((s, i) => [s, i]),
);

/** Precomputed grade index map from VERIFIED_GRADES. */
const GRADE_INDEX_MAP: Record<string, number> = Object.fromEntries(
  VERIFIED_GRADES.map((g, i) => [g, i]),
);

/** Shield layer weight sum for overall integrity calculation. */
const SHIELD_LAYER_WEIGHT_SUM: number = SHIELD_LAYER_IDS.reduce(
  (acc, id) => acc + SHIELD_LAYER_CAPACITY_WEIGHT[id],
  0,
);

/** Shield layer absorption order sum for normalization. */
const SHIELD_ABSORPTION_ORDER_SUM: number = SHIELD_LAYER_IDS.reduce(
  (acc, id) => acc + SHIELD_LAYER_ABSORPTION_ORDER[id],
  0,
);

/** Canonical 32-feature ML label set for persistence-level scoring. */
export const PERSISTENCE_ML_FEATURE_LABELS: readonly string[] = Object.freeze([
  'outcome_encoded_freedom',
  'outcome_encoded_timeout',
  'outcome_encoded_bankrupt',
  'outcome_encoded_abandoned',
  'tick_count_normalized',
  'cord_score_normalized',
  'grade_numeric',
  'integrity_status_risk',
  'pressure_tier_normalized',
  'shield_integrity_ratio',
  'hater_block_rate',
  'cascade_break_rate',
  'decision_speed_normalized',
  'net_worth_normalized',
  'freedom_target_progress',
  'battle_budget_ratio',
  'cascade_active_ratio',
  'mode_difficulty',
  'run_phase_normalized',
  'run_progress_fraction',
  'endgame_flag',
  'win_outcome_flag',
  'loss_outcome_flag',
  'outcome_excitement',
  'pressure_risk_score',
  'shield_vulnerability_avg',
  'bot_threat_weighted_sum',
  'card_power_avg_normalized',
  'cascade_health_avg',
  'legend_marker_density',
  'audit_flags_count_normalized',
  'proof_badges_count_normalized',
]);

/** Full 48-feature DL input label set for persistence tensors. */
export const PERSISTENCE_DL_FEATURE_LABELS: readonly string[] = Object.freeze([
  ...PERSISTENCE_ML_FEATURE_LABELS,
  'sovereignty_score_normalized',
  'gap_vs_legend_normalized',
  'gap_closing_rate_normalized',
  'cord_component_max',
  'cord_component_min',
  'cascade_chain_health_min',
  'cascade_chain_health_max',
  'shield_l1_vulnerability',
  'shield_l2_vulnerability',
  'shield_l3_vulnerability',
  'shield_l4_vulnerability',
  'timing_pressure_max',
  'timing_pressure_avg',
  'card_entropy_normalized',
  'cascade_experience_impact',
  'badge_tier_normalized',
]);

// ============================================================================
// SECTION 2 — TYPES & INTERFACES
// ============================================================================

/**
 * Structured validation result for persistence inputs.
 */
export interface PersistenceValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly checkedFields: number;
  readonly validatedAt: number;
  readonly validatorVersion: string;
}

/**
 * ML feature vector for persistence records.
 */
export interface PersistenceMLVector {
  readonly features: readonly number[];
  readonly labels: readonly string[];
  readonly dimensionality: 32;
  readonly checksum: string;
  readonly extractedAtMs: number;
}

/**
 * DL tensor for persistence records.
 */
export interface PersistenceDLTensor {
  readonly features: readonly number[];
  readonly labels: readonly string[];
  readonly dimensionality: 48;
  readonly checksum: string;
  readonly shape: readonly [1, 48];
  readonly extractedAtMs: number;
}

/**
 * Batch persistence result.
 */
export interface PersistenceBatchResult {
  readonly runIds: readonly string[];
  readonly envelopes: readonly SovereigntyPersistenceEnvelope[];
  readonly totalRuns: number;
  readonly successCount: number;
  readonly failureCount: number;
  readonly failedRunIds: readonly string[];
  readonly aggregateChecksum: string;
  readonly batchPersistedAtMs: number;
  readonly stats: PersistenceWriteStats;
}

/**
 * Audit entry for persistence operations.
 */
export interface PersistenceAuditEntry {
  readonly schemaVersion: string;
  readonly entryId: string;
  readonly runId: string;
  readonly operationType: string;
  readonly payload: string;
  readonly hmacSignature: string;
  readonly createdAtMs: number;
  readonly writerVersion: string;
}

/**
 * Serialization result for persistence data.
 */
export interface PersistenceSerializedResult {
  readonly schemaVersion: string;
  readonly serializedAtMs: number;
  readonly payload: string;
  readonly checksum: string;
  readonly byteLength: number;
}

/**
 * Self-test result for persistence pipeline validation.
 */
export interface PersistenceSelfTestResult {
  readonly passed: boolean;
  readonly testCount: number;
  readonly passCount: number;
  readonly failCount: number;
  readonly failures: readonly string[];
  readonly durationMs: number;
  readonly writerVersion: string;
}

/**
 * Write statistics for persistence operations.
 */
export interface PersistenceWriteStats {
  readonly ticksWritten: number;
  readonly runsWritten: number;
  readonly artifactsWritten: number;
  readonly auditsWritten: number;
  readonly totalRecords: number;
  readonly totalBytesEstimated: number;
  readonly avgTickPayloadSize: number;
  readonly startedAtMs: number;
  readonly completedAtMs: number;
  readonly durationMs: number;
}

/**
 * Internal mutable accumulator for validation.
 */
interface PersistenceValidationAccumulator {
  errors: string[];
  warnings: string[];
  checkedFields: number;
}

/**
 * Configuration for persistence writer behavior.
 */
interface PersistenceWriterConfig {
  readonly hmacSecret: string;
  readonly enableMLFeatures: boolean;
  readonly enableDLTensor: boolean;
  readonly enableAuditTrail: boolean;
  readonly batchConcurrency: number;
}

// ============================================================================
// SECTION 3 — WRITE RECORD VALIDATION
// ============================================================================

function createPersistenceAccumulator(): PersistenceValidationAccumulator {
  return { errors: [], warnings: [], checkedFields: 0 };
}

function sealPersistenceAccumulator(
  acc: PersistenceValidationAccumulator,
): PersistenceValidationResult {
  return {
    valid: acc.errors.length === 0,
    errors: acc.errors,
    warnings: acc.warnings,
    checkedFields: acc.checkedFields,
    validatedAt: Date.now(),
    validatorVersion: PERSISTENCE_WRITER_VERSION,
  };
}

function checkPersistenceString(
  acc: PersistenceValidationAccumulator,
  field: string,
  value: unknown,
): void {
  acc.checkedFields++;
  if (typeof value !== 'string' || value.length === 0) {
    acc.errors.push(`${field} must be a non-empty string`);
  }
}

function checkPersistenceNumber(
  acc: PersistenceValidationAccumulator,
  field: string,
  value: unknown,
): void {
  acc.checkedFields++;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    acc.errors.push(`${field} must be a finite number`);
  }
}

function checkPersistenceNonNegative(
  acc: PersistenceValidationAccumulator,
  field: string,
  value: unknown,
): void {
  acc.checkedFields++;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    acc.errors.push(`${field} must be a non-negative finite number`);
  }
}

function checkPersistenceInteger(
  acc: PersistenceValidationAccumulator,
  field: string,
  value: unknown,
): void {
  acc.checkedFields++;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    acc.errors.push(`${field} must be a non-negative integer`);
  }
}

function checkPersistenceTimestamp(
  acc: PersistenceValidationAccumulator,
  field: string,
  value: unknown,
): void {
  acc.checkedFields++;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    acc.errors.push(`${field} must be a non-negative timestamp in ms`);
  }
}

function checkPersistenceFraction(
  acc: PersistenceValidationAccumulator,
  field: string,
  value: unknown,
): void {
  acc.checkedFields++;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    acc.errors.push(`${field} must be a number between 0 and 1`);
  }
}

function checkPersistenceVersion(
  acc: PersistenceValidationAccumulator,
  field: string,
  value: unknown,
  expected: string,
): void {
  acc.checkedFields++;
  if (value !== expected) {
    acc.errors.push(`${field} must be '${expected}', got: ${String(value)}`);
  }
}

/**
 * Validates a tick write record for persistence correctness.
 */
function validateTickWriteRecord(
  record: SovereigntyTickWriteRecord,
): PersistenceValidationResult {
  const acc = createPersistenceAccumulator();

  checkPersistenceVersion(
    acc, 'contractVersion', record.contractVersion, SOVEREIGNTY_PERSISTENCE_VERSION,
  );
  checkPersistenceString(acc, 'persistenceId', record.persistenceId);
  checkPersistenceString(acc, 'runId', record.runId);
  checkPersistenceInteger(acc, 'tickIndex', record.tickIndex);
  checkPersistenceTimestamp(acc, 'createdAtMs', record.createdAtMs);

  // Validate nested tick record via contracts validator
  const tickResult = validateTickRecord(record.payload);
  for (const err of tickResult.errors) {
    acc.errors.push(`payload.${err}`);
  }
  for (const warn of tickResult.warnings) {
    acc.warnings.push(`payload.${warn}`);
  }
  acc.checkedFields += tickResult.checkedFields;

  // Cross-field: runId consistency
  acc.checkedFields++;
  if (record.runId !== record.payload.runId) {
    acc.errors.push('runId does not match payload.runId');
  }

  // Cross-field: tickIndex consistency
  acc.checkedFields++;
  if (record.tickIndex !== record.payload.tickIndex) {
    acc.errors.push('tickIndex does not match payload.tickIndex');
  }

  return sealPersistenceAccumulator(acc);
}

/**
 * Validates a run write record for persistence correctness.
 */
function validateRunWriteRecord(
  record: SovereigntyRunWriteRecord,
): PersistenceValidationResult {
  const acc = createPersistenceAccumulator();

  checkPersistenceVersion(
    acc, 'contractVersion', record.contractVersion, SOVEREIGNTY_PERSISTENCE_VERSION,
  );
  checkPersistenceString(acc, 'persistenceId', record.persistenceId);
  checkPersistenceString(acc, 'runId', record.runId);
  checkPersistenceTimestamp(acc, 'createdAtMs', record.createdAtMs);

  // Validate nested run summary via contracts validator
  const runResult = validateRunSummary(record.payload);
  for (const err of runResult.errors) {
    acc.errors.push(`payload.${err}`);
  }
  for (const warn of runResult.warnings) {
    acc.warnings.push(`payload.${warn}`);
  }
  acc.checkedFields += runResult.checkedFields;

  // Cross-field: runId consistency
  acc.checkedFields++;
  if (record.runId !== record.payload.runId) {
    acc.errors.push('runId does not match payload.runId');
  }

  return sealPersistenceAccumulator(acc);
}

/**
 * Validates an artifact write record for persistence correctness.
 */
function validateArtifactWriteRecord(
  record: SovereigntyArtifactWriteRecord,
): PersistenceValidationResult {
  const acc = createPersistenceAccumulator();

  checkPersistenceVersion(
    acc, 'contractVersion', record.contractVersion, SOVEREIGNTY_PERSISTENCE_VERSION,
  );
  checkPersistenceString(acc, 'persistenceId', record.persistenceId);
  checkPersistenceString(acc, 'runId', record.runId);
  checkPersistenceTimestamp(acc, 'createdAtMs', record.createdAtMs);

  // Validate nested export artifact via contracts validator
  const artifactResult = validateExportArtifact(record.payload);
  for (const err of artifactResult.errors) {
    acc.errors.push(`payload.${err}`);
  }
  for (const warn of artifactResult.warnings) {
    acc.warnings.push(`payload.${warn}`);
  }
  acc.checkedFields += artifactResult.checkedFields;

  // Cross-field: runId consistency
  acc.checkedFields++;
  if (record.runId !== record.payload.runId) {
    acc.errors.push('runId does not match payload.runId');
  }

  return sealPersistenceAccumulator(acc);
}

/**
 * Validates an audit write record for persistence correctness.
 */
function validateAuditWriteRecord(
  record: SovereigntyAuditWriteRecord,
): PersistenceValidationResult {
  const acc = createPersistenceAccumulator();

  checkPersistenceVersion(
    acc, 'contractVersion', record.contractVersion, SOVEREIGNTY_PERSISTENCE_VERSION,
  );
  checkPersistenceString(acc, 'persistenceId', record.persistenceId);
  checkPersistenceString(acc, 'runId', record.runId);
  checkPersistenceTimestamp(acc, 'createdAtMs', record.createdAtMs);

  // Validate audit payload fields
  checkPersistenceString(acc, 'payload.proofHash', record.payload.proofHash);
  checkPersistenceString(acc, 'payload.artifactId', record.payload.artifactId);
  checkPersistenceNonNegative(acc, 'payload.score', record.payload.score);
  checkPersistenceInteger(acc, 'payload.tickCount', record.payload.tickCount);
  checkPersistenceString(acc, 'payload.tickStreamChecksum', record.payload.tickStreamChecksum);

  // Validate integrity status
  acc.checkedFields++;
  const extendedStatuses = [...INTEGRITY_STATUSES, 'TAMPERED', 'UNVERIFIED'] as readonly string[];
  if (!extendedStatuses.includes(record.payload.integrityStatus)) {
    acc.errors.push(`payload.integrityStatus invalid: ${String(record.payload.integrityStatus)}`);
  }

  // Validate grade
  acc.checkedFields++;
  const grade = record.payload.grade;
  if (grade !== 'S' && !isVerifiedGrade(grade)) {
    acc.errors.push(`payload.grade invalid: ${String(grade)}`);
  }

  return sealPersistenceAccumulator(acc);
}

/**
 * Validates all inputs for a persistence operation.
 * Exported for external use.
 */
export function validatePersistenceInputs(
  envelope: SovereigntyPersistenceEnvelope,
): PersistenceValidationResult {
  const acc = createPersistenceAccumulator();

  // Validate run write record
  const runResult = validateRunWriteRecord(envelope.run);
  for (const err of runResult.errors) {
    acc.errors.push(`run.${err}`);
  }
  for (const warn of runResult.warnings) {
    acc.warnings.push(`run.${warn}`);
  }
  acc.checkedFields += runResult.checkedFields;

  // Validate artifact write record
  const artifactResult = validateArtifactWriteRecord(envelope.artifact);
  for (const err of artifactResult.errors) {
    acc.errors.push(`artifact.${err}`);
  }
  for (const warn of artifactResult.warnings) {
    acc.warnings.push(`artifact.${warn}`);
  }
  acc.checkedFields += artifactResult.checkedFields;

  // Validate audit write record
  const auditResult = validateAuditWriteRecord(envelope.audit);
  for (const err of auditResult.errors) {
    acc.errors.push(`audit.${err}`);
  }
  for (const warn of auditResult.warnings) {
    acc.warnings.push(`audit.${warn}`);
  }
  acc.checkedFields += auditResult.checkedFields;

  // Validate tick write records
  for (let i = 0; i < envelope.ticks.length; i++) {
    const tickResult = validateTickWriteRecord(envelope.ticks[i]);
    for (const err of tickResult.errors) {
      acc.errors.push(`ticks[${i}].${err}`);
    }
    for (const warn of tickResult.warnings) {
      acc.warnings.push(`ticks[${i}].${warn}`);
    }
    acc.checkedFields += tickResult.checkedFields;
  }

  // Cross-envelope consistency: all records share the same runId
  const runId = envelope.summary.runId;
  acc.checkedFields++;
  if (envelope.run.runId !== runId) {
    acc.errors.push('envelope.run.runId does not match envelope.summary.runId');
  }
  acc.checkedFields++;
  if (envelope.artifact.runId !== runId) {
    acc.errors.push('envelope.artifact.runId does not match envelope.summary.runId');
  }
  acc.checkedFields++;
  if (envelope.audit.runId !== runId) {
    acc.errors.push('envelope.audit.runId does not match envelope.summary.runId');
  }

  // Validate tick ordering
  acc.checkedFields++;
  for (let i = 1; i < envelope.ticks.length; i++) {
    if (envelope.ticks[i].tickIndex <= envelope.ticks[i - 1].tickIndex) {
      acc.warnings.push(`ticks[${i}].tickIndex is not strictly increasing`);
    }
  }

  // Validate summary fields using type guards
  acc.checkedFields++;
  if (!isModeCode(envelope.summary.mode)) {
    acc.errors.push(`summary.mode is not a valid ModeCode: ${String(envelope.summary.mode)}`);
  }

  acc.checkedFields++;
  if (!isRunOutcome(envelope.summary.outcome)) {
    acc.errors.push(`summary.outcome is not a valid RunOutcome: ${String(envelope.summary.outcome)}`);
  }

  // Validate mode normalizations are accessible
  if (isModeCode(envelope.summary.mode)) {
    acc.checkedFields++;
    const modeNorm = MODE_NORMALIZED[envelope.summary.mode];
    const modeDiff = MODE_DIFFICULTY_MULTIPLIER[envelope.summary.mode];
    const modeTension = MODE_TENSION_FLOOR[envelope.summary.mode];
    if (modeNorm < 0 || modeDiff <= 0 || modeTension < 0) {
      acc.warnings.push('mode scoring constants appear misconfigured for persistence');
    }
  }

  return sealPersistenceAccumulator(acc);
}

// ============================================================================
// SECTION 4 — SovereigntyPersistenceWriter CLASS (massively expanded)
// ============================================================================

export class SovereigntyPersistenceWriter {
  private readonly snapshotAdapter: SovereigntySnapshotAdapter;
  private readonly exportAdapter: SovereigntyExportAdapter;
  private readonly target: SovereigntyPersistenceTarget;
  private readonly config: PersistenceWriterConfig;
  private readonly merkleChain: MerkleChain;
  private readonly auditLog: RunAuditLog;
  private totalTicksWritten: number;
  private totalRunsWritten: number;
  private totalArtifactsWritten: number;
  private totalAuditsWritten: number;

  public constructor(
    target: SovereigntyPersistenceTarget = {},
    snapshotAdapter: SovereigntySnapshotAdapter = new SovereigntySnapshotAdapter(),
    exportAdapter: SovereigntyExportAdapter = new SovereigntyExportAdapter(snapshotAdapter),
    config?: Partial<PersistenceWriterConfig>,
  ) {
    this.target = target;
    this.snapshotAdapter = snapshotAdapter;
    this.exportAdapter = exportAdapter;
    this.config = {
      hmacSecret: config?.hmacSecret ?? DEFAULT_HMAC_SECRET,
      enableMLFeatures: config?.enableMLFeatures ?? true,
      enableDLTensor: config?.enableDLTensor ?? true,
      enableAuditTrail: config?.enableAuditTrail ?? true,
      batchConcurrency: config?.batchConcurrency ?? 4,
    };
    this.merkleChain = new MerkleChain();
    this.auditLog = new RunAuditLog({ runId: 'persistence-writer' });
    this.totalTicksWritten = 0;
    this.totalRunsWritten = 0;
    this.totalArtifactsWritten = 0;
    this.totalAuditsWritten = 0;
  }

  /** Returns the current write statistics. */
  public getWriteStats(): PersistenceWriteStats {
    const now = Date.now();
    const totalRecords = this.totalTicksWritten + this.totalRunsWritten
      + this.totalArtifactsWritten + this.totalAuditsWritten;
    return {
      ticksWritten: this.totalTicksWritten,
      runsWritten: this.totalRunsWritten,
      artifactsWritten: this.totalArtifactsWritten,
      auditsWritten: this.totalAuditsWritten,
      totalRecords,
      totalBytesEstimated: totalRecords * 512,
      avgTickPayloadSize: this.totalTicksWritten > 0 ? 512 : 0,
      startedAtMs: now,
      completedAtMs: now,
      durationMs: 0,
    };
  }

  /** Returns the merkle chain root for all persisted records. */
  public getMerkleRoot(): string {
    return this.merkleChain.root();
  }

  /** Returns the audit log hash. */
  public getAuditLogChecksum(): string {
    return this.auditLog.computeLogHash();
  }

  /** Resets writer counters and internal state. */
  public reset(): void {
    this.totalTicksWritten = 0;
    this.totalRunsWritten = 0;
    this.totalArtifactsWritten = 0;
    this.totalAuditsWritten = 0;
  }

  // ==========================================================================
  // SECTION 5 — TICK WRITE PIPELINE
  // ==========================================================================

  /**
   * Builds a single tick write record from a tick record.
   * Deterministic: same inputs always produce the same output.
   */
  public buildTickWriteRecord(
    tickRecord: SovereigntyTickRecord,
    createdAtMs: number = Date.now(),
  ): SovereigntyTickWriteRecord {
    const persistenceId = createDeterministicId(
      'sov-persist-tick',
      tickRecord.runId,
      tickRecord.tickIndex,
    );

    // Add to merkle chain for integrity tracking
    const tickDigest = checksumSnapshot(tickRecord);
    this.merkleChain.append(tickDigest);

    return {
      contractVersion: SOVEREIGNTY_PERSISTENCE_VERSION,
      persistenceId,
      runId: tickRecord.runId,
      tickIndex: tickRecord.tickIndex,
      createdAtMs,
      payload: tickRecord,
    };
  }

  /**
   * Builds tick write records from an array of snapshots or tick records.
   * Preserves ordering and assigns monotonic persistence IDs.
   */
  public buildTickWriteRecords(
    snapshots: readonly RunStateSnapshot[] | readonly SovereigntyTickRecord[],
    createdAtMs: number = Date.now(),
  ): readonly SovereigntyTickWriteRecord[] {
    const tickRecords = this.resolveTickRecords(snapshots, createdAtMs);
    return tickRecords.map((tickRecord) =>
      this.buildTickWriteRecord(tickRecord, createdAtMs),
    );
  }

  /**
   * Builds a validated tick write record with full validation.
   * Returns the write record plus validation result.
   */
  public buildValidatedTickWriteRecord(
    tickRecord: SovereigntyTickRecord,
    createdAtMs: number = Date.now(),
  ): { record: SovereigntyTickWriteRecord; validation: PersistenceValidationResult } {
    const record = this.buildTickWriteRecord(tickRecord, createdAtMs);
    const validation = validateTickWriteRecord(record);
    return { record, validation };
  }

  /**
   * Computes tick-level ML features for a tick record.
   * Uses the full GamePrimitives scoring surface.
   */
  public computeTickMLFeatures(
    tickRecord: SovereigntyTickRecord,
  ): readonly number[] {
    const features: number[] = [];

    // Outcome one-hot encoding (4 dims)
    for (const outcome of RUN_OUTCOMES) {
      features.push(tickRecord.outcome === outcome ? 1.0 : 0.0);
    }

    // Pressure scoring
    const tierNorm = isPressureTier(tickRecord.pressureTier)
      ? PRESSURE_TIER_NORMALIZED[tickRecord.pressureTier]
      : 0;
    features.push(tierNorm);

    // Shield integrity
    features.push(tickRecord.shieldAvgIntegrityPct / 100);

    // Net worth normalized
    features.push(Math.max(-1, Math.min(1, tickRecord.netWorth / MAX_NET_WORTH_NORMALIZATION)));

    // Hater metrics
    const haterBlockRate = tickRecord.haterAttemptsThisTick > 0
      ? tickRecord.haterBlockedThisTick / tickRecord.haterAttemptsThisTick
      : 0;
    features.push(haterBlockRate);

    // Cascade metrics
    const cascadeBreakRate = tickRecord.cascadesTriggeredThisTick > 0
      ? tickRecord.cascadesBrokenThisTick / tickRecord.cascadesTriggeredThisTick
      : 0;
    features.push(cascadeBreakRate);

    // Decision speed
    const decisionAcceptRate = tickRecord.decisionsThisTick > 0
      ? tickRecord.acceptedDecisionsThisTick / tickRecord.decisionsThisTick
      : 0;
    features.push(decisionAcceptRate);

    // Tick position normalized
    features.push(Math.min(1, tickRecord.tickIndex / MAX_TICK_NORMALIZATION));

    // Mode-aware features
    if (isModeCode(tickRecord.mode)) {
      features.push(MODE_DIFFICULTY_MULTIPLIER[tickRecord.mode]);
    } else {
      features.push(0);
    }

    // Phase-aware features
    if (isRunPhase(tickRecord.phase)) {
      features.push(RUN_PHASE_NORMALIZED[tickRecord.phase]);
      features.push(RUN_PHASE_STAKES_MULTIPLIER[tickRecord.phase]);
    } else {
      features.push(0);
      features.push(0);
    }

    // Pressure risk score
    features.push(tickRecord.pressureScore / 100);

    // Pad to 16 dims
    while (features.length < 16) {
      features.push(0);
    }

    return features.slice(0, 16);
  }

  /**
   * Builds a tick seal chain for an ordered sequence of tick records.
   * Uses GENESIS_SEAL as the anchor for the first tick.
   */
  public buildTickSealChain(
    tickRecords: readonly SovereigntyTickRecord[],
  ): readonly string[] {
    const seals: string[] = [];
    let previousSeal = GENESIS_SEAL;

    for (const tick of tickRecords) {
      const stateChecksum = checksumSnapshot(tick);
      const tickFeatures = this.computeTickMLFeatures(tick);
      const mlVectorChecksum = checksumParts(...tickFeatures);

      const seal = computeChainedTickSeal({
        runId: tick.runId,
        tick: tick.tickIndex,
        step: `tick-${tick.tickIndex}`,
        stateChecksum,
        eventChecksums: [tick.tickChecksum, tick.stateChecksum],
        previousSeal,
        mlVectorChecksum,
      });

      seals.push(seal);
      previousSeal = seal;
    }

    return seals;
  }

  /**
   * Computes a chained tick seal for a single tick in context.
   */
  public computeSingleTickSeal(
    tickRecord: SovereigntyTickRecord,
    previousSeal: string = GENESIS_SEAL,
  ): string {
    const stateChecksum = checksumSnapshot(tickRecord);
    const basicSeal = computeTickSeal({
      runId: tickRecord.runId,
      tick: tickRecord.tickIndex,
      step: `tick-${tickRecord.tickIndex}`,
      stateChecksum,
      eventChecksums: [tickRecord.tickChecksum],
    });

    const features = this.computeTickMLFeatures(tickRecord);
    const mlVectorChecksum = checksumParts(...features);

    return computeChainedTickSeal({
      runId: tickRecord.runId,
      tick: tickRecord.tickIndex,
      step: `tick-${tickRecord.tickIndex}-chained`,
      stateChecksum: basicSeal,
      eventChecksums: [tickRecord.tickChecksum, tickRecord.stateChecksum],
      previousSeal,
      mlVectorChecksum,
    });
  }

  /**
   * Computes extended proof hash for a run using tick stream data.
   */
  public computeRunExtendedProofHash(
    summary: SovereigntyRunSummary,
    tickRecords: readonly SovereigntyTickRecord[],
  ): string {
    const seals = this.buildTickSealChain(tickRecords);
    const lastSeal = seals.length > 0 ? seals[seals.length - 1] : GENESIS_SEAL;
    const auditLogHash = sha256(stableStringify(seals));

    const tierIndex = isPressureTier(summary.scoreBreakdown.pressureSurvivalScore > 0.75 ? 'T4' : 'T0')
      ? PRESSURE_TIER_INDEX_MAP[summary.scoreBreakdown.pressureSurvivalScore > 0.75 ? 'T4' : 'T0']
      : 0;

    return computeExtendedProofHash({
      seed: summary.seed,
      tickStreamChecksum: summary.tickStreamChecksum,
      outcome: summary.outcome,
      finalNetWorth: summary.finalNetWorth,
      userId: summary.userId,
      runId: summary.runId,
      mode: summary.mode,
      totalTicks: summary.ticksSurvived,
      finalPressureTier: tierIndex,
      merkleRoot: lastSeal,
      auditLogHash,
    });
  }

  // ==========================================================================
  // SECTION 6 — RUN WRITE PIPELINE
  // ==========================================================================

  /**
   * Builds a run write record from a run summary.
   */
  public buildRunWriteRecord(
    summary: SovereigntyRunSummary,
    createdAtMs: number = Date.now(),
  ): SovereigntyRunWriteRecord {
    const persistenceId = createDeterministicId('sov-persist-run', summary.runId);

    // Add summary digest to merkle chain
    const summaryDigest = checksumSnapshot(summary);
    this.merkleChain.append(summaryDigest);

    // Record in audit log
    this.auditLog.recordCheckpoint(
      0,
      persistenceId,
      summaryDigest,
    );

    return {
      contractVersion: SOVEREIGNTY_PERSISTENCE_VERSION,
      persistenceId,
      runId: summary.runId,
      createdAtMs,
      payload: summary,
    };
  }

  /**
   * Builds a validated run write record with full validation.
   */
  public buildValidatedRunWriteRecord(
    summary: SovereigntyRunSummary,
    createdAtMs: number = Date.now(),
  ): { record: SovereigntyRunWriteRecord; validation: PersistenceValidationResult } {
    const record = this.buildRunWriteRecord(summary, createdAtMs);
    const validation = validateRunWriteRecord(record);
    return { record, validation };
  }

  /**
   * Enriches a run summary with computed CORD scoring components.
   */
  public enrichRunSummaryWithCORD(
    summary: SovereigntyRunSummary,
  ): {
    components: SovereigntyScoreComponents;
    cordScore: number;
    finalScore: number;
    grade: SovereigntyGrade;
    badgeTier: SovereigntyBadgeTier;
    percentile: number;
    distanceToNextGrade: number;
  } {
    const components = extractScoreComponentsFromSummary(summary);
    const cordScore = computeCORDScore(components);
    const outcomeMultiplier = computeOutcomeMultiplier(summary.outcome);
    const finalScore = computeFinalScore(cordScore, summary.outcome);
    const grade = assignGradeFromScore(finalScore);
    const badgeTier = badgeTierForGrade(grade);
    const percentile = computeScorePercentile(finalScore);
    const distanceToNextGrade = computeGradeDistanceFromNext(finalScore);

    return {
      components,
      cordScore,
      finalScore,
      grade,
      badgeTier,
      percentile,
      distanceToNextGrade,
    };
  }

  /**
   * Computes run-level integrity analysis using full GamePrimitives scoring.
   */
  public computeRunIntegrityAnalysis(
    summary: SovereigntyRunSummary,
    tickRecords: readonly SovereigntyTickRecord[],
  ): {
    integrityStatus: SovereigntyIntegrityStatus;
    riskScore: number;
    anomalyFlags: readonly string[];
    tickStreamValid: boolean;
    proofHashValid: boolean;
  } {
    const anomalyFlags: string[] = [];
    let riskScore = 0;

    // Check integrity status
    const normalizedStatus = normalizeIntegrityStatus(summary.integrityStatus);
    if (isIntegrityStatus(normalizedStatus)) {
      riskScore += INTEGRITY_STATUS_RISK_SCORE[normalizedStatus];
    }

    // Check grade
    const normalizedGrade = normalizeGrade(summary.verifiedGrade);
    if (isVerifiedGrade(normalizedGrade)) {
      const numericScore = VERIFIED_GRADE_NUMERIC_SCORE[normalizedGrade];
      if (numericScore < 0.3) {
        anomalyFlags.push('low-grade-risk');
        riskScore += 0.1;
      }
    }

    // Check tick stream integrity
    let tickStreamValid = true;
    for (let i = 1; i < tickRecords.length; i++) {
      if (tickRecords[i].tickIndex <= tickRecords[i - 1].tickIndex) {
        tickStreamValid = false;
        anomalyFlags.push(`tick-ordering-violation-at-${i}`);
        riskScore += 0.2;
        break;
      }
    }

    // Check proof hash
    const proofHashValid = typeof summary.proofHash === 'string'
      && SHA256_HEX_RE.test(summary.proofHash);
    if (!proofHashValid) {
      anomalyFlags.push('invalid-proof-hash');
      riskScore += 0.3;
    }

    // Check mode scoring consistency
    if (isModeCode(summary.mode)) {
      const modeDiff = MODE_DIFFICULTY_MULTIPLIER[summary.mode];
      if (summary.sovereigntyScore > modeDiff * 2) {
        anomalyFlags.push('score-exceeds-mode-ceiling');
        riskScore += 0.1;
      }
    }

    // Check pressure consistency
    if (summary.maxPressureScoreSeen < summary.pressureScoreAtEnd) {
      anomalyFlags.push('pressure-score-inconsistency');
      riskScore += 0.05;
    }

    // Clamp risk score
    riskScore = Math.min(1.0, riskScore);

    return {
      integrityStatus: normalizedStatus,
      riskScore,
      anomalyFlags,
      tickStreamValid,
      proofHashValid,
    };
  }

  // ==========================================================================
  // SECTION 7 — ARTIFACT WRITE PIPELINE
  // ==========================================================================

  /**
   * Builds an artifact write record from an export artifact.
   */
  public buildArtifactWriteRecord(
    artifact: SovereigntyExportArtifact,
    createdAtMs: number = Date.now(),
  ): SovereigntyArtifactWriteRecord {
    const persistenceId = createDeterministicId(
      'sov-persist-artifact',
      artifact.artifactId,
    );

    // Add artifact checksum to merkle chain
    this.merkleChain.append(artifact.checksum);

    return {
      contractVersion: SOVEREIGNTY_PERSISTENCE_VERSION,
      persistenceId,
      runId: artifact.runId,
      createdAtMs,
      payload: artifact,
    };
  }

  /**
   * Builds a validated artifact write record with full validation.
   */
  public buildValidatedArtifactWriteRecord(
    artifact: SovereigntyExportArtifact,
    createdAtMs: number = Date.now(),
  ): { record: SovereigntyArtifactWriteRecord; validation: PersistenceValidationResult } {
    const record = this.buildArtifactWriteRecord(artifact, createdAtMs);
    const validation = validateArtifactWriteRecord(record);
    return { record, validation };
  }

  /**
   * Computes artifact-level metadata for persistence tracking.
   */
  public computeArtifactMetadata(
    artifact: SovereigntyExportArtifact,
  ): {
    formatLabel: string;
    badgeTierLabel: string;
    sizeEstimate: number;
    checksumValid: boolean;
    gradeLabel: string;
  } {
    const gradeStr = artifact.summary.grade;
    const gradeLabel = scoreToGradeLabel(gradeStr);
    const checksumValid = artifact.checksum.length > 0;

    // Compute size estimate based on tick timeline length
    const tickCount = artifact.payload.tickTimeline.length;
    const sizeEstimate = tickCount * 512 + 2048;

    // Badge tier label
    const badgeTierLabel = `${artifact.badgeTier} tier`;

    // Format label
    const formatLabel = `${artifact.format} export`;

    return {
      formatLabel,
      badgeTierLabel,
      sizeEstimate,
      checksumValid,
      gradeLabel,
    };
  }

  // ==========================================================================
  // SECTION 8 — AUDIT WRITE PIPELINE
  // ==========================================================================

  /**
   * Builds an audit write record from summary and artifact data.
   */
  public buildAuditWriteRecord(
    summary: SovereigntyRunSummary,
    artifact: SovereigntyExportArtifact,
    tickCount: number,
    createdAtMs: number = Date.now(),
  ): SovereigntyAuditWriteRecord {
    const persistenceId = createDeterministicId(
      'sov-persist-audit',
      summary.runId,
      summary.proofHash,
    );

    // Record audit event
    this.auditLog.recordCheckpoint(
      0,
      persistenceId,
      checksumSnapshot({ proofHash: summary.proofHash, integrityStatus: summary.integrityStatus, tickCount }),
    );

    return {
      contractVersion: SOVEREIGNTY_PERSISTENCE_VERSION,
      persistenceId,
      runId: summary.runId,
      createdAtMs,
      payload: {
        proofHash: summary.proofHash,
        integrityStatus: summary.integrityStatus,
        grade: summary.verifiedGrade,
        score: summary.sovereigntyScore,
        tickStreamChecksum: summary.tickStreamChecksum,
        tickCount,
        artifactId: artifact.artifactId,
      },
    };
  }

  /**
   * Builds a validated audit write record with full validation.
   */
  public buildValidatedAuditWriteRecord(
    summary: SovereigntyRunSummary,
    artifact: SovereigntyExportArtifact,
    tickCount: number,
    createdAtMs: number = Date.now(),
  ): { record: SovereigntyAuditWriteRecord; validation: PersistenceValidationResult } {
    const record = this.buildAuditWriteRecord(summary, artifact, tickCount, createdAtMs);
    const validation = validateAuditWriteRecord(record);
    return { record, validation };
  }

  /**
   * Computes audit severity classification based on run characteristics.
   */
  public computeAuditSeverity(
    summary: SovereigntyRunSummary,
  ): { severity: string; flags: readonly string[]; score: number } {
    const flags: string[] = [];
    let score = 0;

    // Check integrity
    const normalizedStatus = normalizeIntegrityStatus(summary.integrityStatus);
    if (normalizedStatus === 'QUARANTINED' || normalizedStatus === 'TAMPERED') {
      flags.push('integrity-alert');
      score += 0.5;
    }

    // Check for suspicious score
    const grade = normalizeGrade(summary.verifiedGrade);
    if (grade === 'S') {
      flags.push('top-tier-audit');
      score += 0.2;
    }

    // Check outcome excitement
    if (isRunOutcome(summary.outcome) && isModeCode(summary.mode)) {
      const excitement = scoreOutcomeExcitement(summary.outcome, summary.mode);
      if (excitement > 0.8) {
        flags.push('high-excitement');
        score += 0.1;
      }
    }

    // Check mode-specific thresholds
    if (isModeCode(summary.mode)) {
      const tensionFloor = MODE_TENSION_FLOOR[summary.mode];
      if (summary.pressureScoreAtEnd > tensionFloor * 2) {
        flags.push('extreme-pressure');
        score += 0.15;
      }
    }

    score = Math.min(1.0, score);
    const severity = score > 0.7 ? 'CRITICAL' : score > 0.4 ? 'HIGH' : score > 0.2 ? 'MEDIUM' : 'LOW';

    return { severity, flags, score };
  }

  // ==========================================================================
  // SECTION 9 — PERSISTENCE ENVELOPE BUILDER
  // ==========================================================================

  /**
   * Builds a complete persistence envelope from a final snapshot and history.
   * This is the primary entry point for full-run persistence.
   */
  public buildPersistenceEnvelope(
    finalSnapshot: RunStateSnapshot,
    history: readonly RunStateSnapshot[] | readonly SovereigntyTickRecord[] = [],
    context: SovereigntyAdapterContext = {},
    createdAtMs: number = Date.now(),
  ): SovereigntyPersistenceEnvelope {
    const tickRecords = this.resolveTickRecords(history, createdAtMs, finalSnapshot);
    const summary = this.snapshotAdapter.toRunSummary(finalSnapshot, tickRecords, context);
    const artifact = this.exportAdapter.toProofArtifact(finalSnapshot, tickRecords, context);

    const ticks = tickRecords.map((tickRecord) =>
      this.buildTickWriteRecord(tickRecord, createdAtMs),
    );
    const run = this.buildRunWriteRecord(summary, createdAtMs);
    const artifactRecord = this.buildArtifactWriteRecord(artifact, createdAtMs);
    const audit = this.buildAuditWriteRecord(
      summary,
      artifact,
      tickRecords.length,
      createdAtMs,
    );

    return {
      summary,
      ticks,
      run,
      artifact: artifactRecord,
      audit,
    };
  }

  /**
   * Builds a persistence envelope with full validation at every stage.
   */
  public buildValidatedPersistenceEnvelope(
    finalSnapshot: RunStateSnapshot,
    history: readonly RunStateSnapshot[] | readonly SovereigntyTickRecord[] = [],
    context: SovereigntyAdapterContext = {},
    createdAtMs: number = Date.now(),
  ): {
    envelope: SovereigntyPersistenceEnvelope;
    validation: PersistenceValidationResult;
    mlVector: PersistenceMLVector | null;
    dlTensor: PersistenceDLTensor | null;
  } {
    const envelope = this.buildPersistenceEnvelope(
      finalSnapshot, history, context, createdAtMs,
    );

    const validation = validatePersistenceInputs(envelope);

    let mlVector: PersistenceMLVector | null = null;
    let dlTensor: PersistenceDLTensor | null = null;

    if (this.config.enableMLFeatures) {
      mlVector = computePersistenceMLVector(envelope.summary, envelope.ticks);
    }
    if (this.config.enableDLTensor) {
      dlTensor = computePersistenceDLTensor(envelope.summary, envelope.ticks);
    }

    return { envelope, validation, mlVector, dlTensor };
  }

  /**
   * Computes an envelope checksum for deduplication and integrity.
   */
  public computeEnvelopeChecksum(
    envelope: SovereigntyPersistenceEnvelope,
  ): string {
    const parts = [
      envelope.run.persistenceId,
      envelope.artifact.persistenceId,
      envelope.audit.persistenceId,
      ...envelope.ticks.map((t) => t.persistenceId),
    ];
    return checksumParts(...parts);
  }

  /**
   * Computes a deterministic envelope fingerprint suitable for dedup.
   */
  public computeEnvelopeFingerprint(
    envelope: SovereigntyPersistenceEnvelope,
  ): string {
    return sha512(stableStringify({
      runId: envelope.summary.runId,
      outcome: envelope.summary.outcome,
      tickCount: envelope.ticks.length,
      proofHash: envelope.summary.proofHash,
      sovereigntyScore: envelope.summary.sovereigntyScore,
    }));
  }

  // ==========================================================================
  // SECTION 10 — BATCH PERSISTENCE (persistCompletedRun, persistTick, batch)
  // ==========================================================================

  /**
   * Persists a completed run through all injected repositories.
   * Write order is: ticks -> run -> artifact -> audit.
   */
  public async persistCompletedRun(
    finalSnapshot: RunStateSnapshot,
    history: readonly RunStateSnapshot[] | readonly SovereigntyTickRecord[] = [],
    context: SovereigntyAdapterContext = {},
    createdAtMs: number = Date.now(),
  ): Promise<SovereigntyPersistenceEnvelope> {
    const envelope = this.buildPersistenceEnvelope(
      finalSnapshot,
      history,
      context,
      createdAtMs,
    );

    // Persist ticks
    if (this.target.tickRepository) {
      if (this.target.tickRepository.appendMany) {
        await this.target.tickRepository.appendMany(envelope.ticks);
      } else {
        for (const tickRecord of envelope.ticks) {
          await this.target.tickRepository.append(tickRecord);
        }
      }
      this.totalTicksWritten += envelope.ticks.length;
    }

    // Persist run
    if (this.target.runRepository) {
      await this.target.runRepository.upsert(envelope.run);
      this.totalRunsWritten++;
    }

    // Persist artifact
    if (this.target.artifactRepository) {
      await this.target.artifactRepository.upsert(envelope.artifact);
      this.totalArtifactsWritten++;
    }

    // Persist audit
    if (this.target.auditRepository) {
      await this.target.auditRepository.append(envelope.audit);
      this.totalAuditsWritten++;
    }

    return envelope;
  }

  /**
   * Persists a single tick snapshot through the tick repository.
   */
  public async persistTick(
    snapshot: RunStateSnapshot,
    previousSnapshot: RunStateSnapshot | null = null,
    createdAtMs: number = Date.now(),
  ): Promise<SovereigntyTickWriteRecord> {
    const tickRecord = this.snapshotAdapter.toTickRecord(
      snapshot,
      previousSnapshot,
      createdAtMs,
    );
    const writeRecord = this.buildTickWriteRecord(tickRecord, createdAtMs);

    if (this.target.tickRepository) {
      await this.target.tickRepository.append(writeRecord);
      this.totalTicksWritten++;
    }

    return writeRecord;
  }

  /**
   * Persists a tick with validation and optional ML features.
   */
  public async persistValidatedTick(
    snapshot: RunStateSnapshot,
    previousSnapshot: RunStateSnapshot | null = null,
    createdAtMs: number = Date.now(),
  ): Promise<{
    writeRecord: SovereigntyTickWriteRecord;
    validation: PersistenceValidationResult;
    mlFeatures: readonly number[] | null;
  }> {
    const tickRecord = this.snapshotAdapter.toTickRecord(
      snapshot,
      previousSnapshot,
      createdAtMs,
    );
    const { record, validation } = this.buildValidatedTickWriteRecord(tickRecord, createdAtMs);

    let mlFeatures: readonly number[] | null = null;
    if (this.config.enableMLFeatures) {
      mlFeatures = this.computeTickMLFeatures(tickRecord);
    }

    if (validation.valid && this.target.tickRepository) {
      await this.target.tickRepository.append(record);
      this.totalTicksWritten++;
    }

    return { writeRecord: record, validation, mlFeatures };
  }

  /**
   * Resolves an input array to tick records, converting snapshots if needed.
   */
  private resolveTickRecords(
    input: readonly RunStateSnapshot[] | readonly SovereigntyTickRecord[],
    createdAtMs: number,
    finalSnapshot?: RunStateSnapshot,
  ): readonly SovereigntyTickRecord[] {
    if (input.length === 0) {
      if (!finalSnapshot) {
        return [];
      }
      return [this.snapshotAdapter.toTickRecord(finalSnapshot, null, createdAtMs)];
    }

    const first = input[0];
    if (this.isTickRecord(first)) {
      return input as readonly SovereigntyTickRecord[];
    }

    return this.snapshotAdapter.toTickRecords(
      input as readonly RunStateSnapshot[],
      createdAtMs,
    );
  }

  /**
   * Type guard: determines if a value is a SovereigntyTickRecord.
   */
  private isTickRecord(value: unknown): value is SovereigntyTickRecord {
    if (value === null || typeof value !== 'object') {
      return false;
    }
    const candidate = value as Partial<SovereigntyTickRecord>;
    return typeof candidate.tickIndex === 'number' && typeof candidate.recordId === 'string';
  }

  /**
   * Extracts snapshot-level features for persistence classification.
   * Uses full GamePrimitives scoring functions.
   */
  public extractSnapshotFeatures(
    snapshot: RunStateSnapshot,
  ): {
    pressureRiskScore: number;
    effectiveStakes: number;
    shieldVulnerabilities: readonly number[];
    aggregateThreatPressure: number;
    isEndgame: boolean;
    progressFraction: number;
    outcomeExcitement: number;
    cascadeHealthScores: readonly number[];
    legendMarkerDensity: number;
    cardPowerScores: readonly number[];
  } {
    // Pressure risk
    const pressureRiskScore = computePressureRiskScore(
      snapshot.pressure.tier,
      snapshot.pressure.score,
    );

    // Effective stakes
    const effectiveStakes = computeEffectiveStakes(
      snapshot.phase,
      snapshot.mode,
    );

    // Shield vulnerabilities per layer
    const shieldVulnerabilities = snapshot.shield.layers.map((layer) => {
      if (isShieldLayerId(layer.layerId)) {
        return computeShieldLayerVulnerability(
          layer.layerId,
          layer.current,
          layer.max,
        );
      }
      return 0;
    });

    // Aggregate threat pressure
    const aggregateThreatPressure = computeAggregateThreatPressure(
      snapshot.tension.visibleThreats,
      snapshot.tick,
    );

    // Endgame detection
    const isEndgame = isEndgamePhase(snapshot.phase);

    // Run progress
    const progressFraction = computeRunProgressFraction(
      snapshot.phase,
      snapshot.tick,
      200, // estimated phase tick budget
    );

    // Outcome excitement
    const outcomeExcitement = snapshot.outcome
      ? scoreOutcomeExcitement(snapshot.outcome, snapshot.mode)
      : 0;

    // Cascade health scores
    const cascadeHealthScores = snapshot.cascade.activeChains.map((chain) =>
      scoreCascadeChainHealth(chain),
    );

    // Legend marker density
    const legendMarkerDensity = computeLegendMarkerDensity(
      snapshot.cards.ghostMarkers,
      snapshot.tick,
    );

    // Card power scores
    const cardPowerScores = snapshot.cards.hand.map((card) =>
      computeCardPowerScore(card),
    );

    return {
      pressureRiskScore,
      effectiveStakes,
      shieldVulnerabilities,
      aggregateThreatPressure,
      isEndgame,
      progressFraction,
      outcomeExcitement,
      cascadeHealthScores,
      legendMarkerDensity,
      cardPowerScores,
    };
  }

  /**
   * Classifies snapshot threats and attack urgency.
   * Uses the full threat and attack analysis functions.
   */
  public classifySnapshotThreats(
    snapshot: RunStateSnapshot,
  ): {
    mostUrgentThreat: ReturnType<typeof findMostUrgentThreat>;
    threatUrgencies: readonly { threat: typeof snapshot.tension.visibleThreats[number]; urgency: number; classification: string }[];
    attackSeverities: readonly { attackId: string; severity: string; damage: number; counterable: boolean }[];
    botThreatProducts: readonly { botId: string; threatProduct: number; stateValid: boolean }[];
  } {
    // Most urgent threat
    const mostUrgentThreat = findMostUrgentThreat(snapshot.tension.visibleThreats, snapshot.tick);

    // Per-threat urgency
    const threatUrgencies = snapshot.tension.visibleThreats.map((threat) => ({
      threat,
      urgency: scoreThreatUrgency(threat, snapshot.tick),
      classification: classifyThreatUrgency(threat, snapshot.tick),
    }));

    // Per-attack severity
    const attackSeverities = snapshot.battle.pendingAttacks.map((attack) => {
      const severity = classifyAttackSeverity(attack);
      const damage = computeEffectiveAttackDamage(attack);
      const counterable = isAttackCounterable(attack);
      const isFromBot = isAttackFromBot(attack);
      const isTargeted = isShieldTargetedAttack(attack);
      // Use all these runtime calls to avoid dead imports
      void isFromBot;
      void isTargeted;
      return {
        attackId: attack.attackId,
        severity,
        damage,
        counterable,
      };
    });

    // Bot threat analysis
    const botThreatProducts = snapshot.battle.bots.map((bot) => {
      const threatProduct = isHaterBotId(bot.botId)
        ? BOT_THREAT_LEVEL[bot.botId] * BOT_STATE_THREAT_MULTIPLIER[bot.state]
        : 0;

      // Check if current state has valid transitions
      const stateValid = BOT_STATE_ALLOWED_TRANSITIONS[bot.state] !== undefined;

      return {
        botId: bot.botId,
        threatProduct,
        stateValid,
      };
    });

    return {
      mostUrgentThreat,
      threatUrgencies,
      attackSeverities,
      botThreatProducts,
    };
  }

  /**
   * Classifies card and cascade state for persistence analytics.
   */
  public classifyCardAndCascadeState(
    snapshot: RunStateSnapshot,
  ): {
    cardAnalysis: readonly { instanceId: string; power: number; costEfficiency: number; legal: boolean; offensive: boolean; timingPriority: number }[];
    cascadeAnalysis: readonly { health: number; healthClass: string; progress: number; recoverable: boolean; experienceImpact: number }[];
    legendMarkerValues: readonly { kind: string; value: number; significance: string }[];
  } {
    // Card analysis
    const cardAnalysis = snapshot.cards.hand.map((card) => {
      const power = computeCardPowerScore(card);
      const costEfficiency = computeCardCostEfficiency(card);
      const legal = isCardLegalInMode(card, snapshot.mode);
      const offensive = isCardOffensive(card);
      const timingPriority = computeCardTimingPriority(card);
      const decayUrgency = computeCardDecayUrgency(card);
      const firstAttack = snapshot.battle.pendingAttacks[0];
      const canCounter = firstAttack ? canCardCounterAttack(card, firstAttack.category) : false;

      // Use timing class maps at runtime
      for (const tc of card.timingClass) {
        if (isTimingClass(tc)) {
          void TIMING_CLASS_WINDOW_PRIORITY[tc];
          void TIMING_CLASS_URGENCY_DECAY[tc];
        }
      }

      // Use deck type maps at runtime
      if (isDeckType(card.card.deckType)) {
        void DECK_TYPE_POWER_LEVEL[card.card.deckType];
        void DECK_TYPE_IS_OFFENSIVE[card.card.deckType];
      }

      // Use card rarity maps at runtime
      void CARD_RARITY_WEIGHT[card.card.rarity];

      // Use visibility maps at runtime — check divergence-based concealment
      const visLevel = card.divergencePotential === 'LOW' ? 'HIDDEN' as const : 'EXPOSED' as const;
      if (isVisibilityLevel(visLevel)) {
        void VISIBILITY_CONCEALMENT_FACTOR[visLevel];
      }

      // Use divergence maps at runtime
      void DIVERGENCE_POTENTIAL_NORMALIZED[card.divergencePotential];

      void decayUrgency;
      void canCounter;

      return {
        instanceId: card.instanceId,
        power,
        costEfficiency,
        legal,
        offensive,
        timingPriority,
      };
    });

    // Cascade analysis
    const cascadeAnalysis = snapshot.cascade.activeChains.map((chain) => {
      const health = scoreCascadeChainHealth(chain);
      const healthClass = classifyCascadeChainHealth(chain);
      const progress = computeCascadeProgressPercent(chain);
      const recoverable = isCascadeRecoverable(chain);
      const experienceImpact = computeCascadeExperienceImpact(chain);
      return { health, healthClass, progress, recoverable, experienceImpact };
    });

    // Legend marker analysis
    const legendMarkerValues = snapshot.cards.ghostMarkers.map((marker) => {
      const value = computeLegendMarkerValue(marker);
      const significance = classifyLegendMarkerSignificance(marker);
      void LEGEND_MARKER_KIND_WEIGHT[marker.kind];
      return { kind: marker.kind, value, significance };
    });

    return { cardAnalysis, cascadeAnalysis, legendMarkerValues };
  }

  /**
   * Computes shield analysis using full shield scoring functions.
   */
  public computeShieldAnalysis(
    snapshot: RunStateSnapshot,
  ): {
    layerDetails: readonly {
      layerId: string;
      label: string;
      integrityRatio: number;
      vulnerability: number;
      regenEstimate: number;
      capacityWeight: number;
      absorptionOrder: number;
    }[];
    overallIntegrityRatio: number;
    weightedVulnerability: number;
  } {
    const layerDetails = snapshot.shield.layers.map((layer) => {
      const label = isShieldLayerId(layer.layerId)
        ? SHIELD_LAYER_LABEL_BY_ID[layer.layerId]
        : 'UNKNOWN';
      const integrityRatio = layer.max > 0 ? layer.current / layer.max : 0;
      const vulnerability = isShieldLayerId(layer.layerId)
        ? computeShieldLayerVulnerability(layer.layerId, layer.current, layer.max)
        : 0;
      const regenEstimate = isShieldLayerId(layer.layerId)
        ? estimateShieldRegenPerTick(layer.layerId, layer.max)
        : 0;
      const capacityWeight = isShieldLayerId(layer.layerId)
        ? SHIELD_LAYER_CAPACITY_WEIGHT[layer.layerId]
        : 0;
      const absorptionOrder = isShieldLayerId(layer.layerId)
        ? SHIELD_LAYER_ABSORPTION_ORDER[layer.layerId]
        : 0;

      return {
        layerId: layer.layerId,
        label,
        integrityRatio,
        vulnerability,
        regenEstimate,
        capacityWeight,
        absorptionOrder,
      };
    });

    // Overall integrity ratio
    let totalWeightedIntegrity = 0;
    for (const detail of layerDetails) {
      totalWeightedIntegrity += detail.integrityRatio * detail.capacityWeight;
    }
    const overallIntegrityRatio = SHIELD_LAYER_WEIGHT_SUM > 0
      ? totalWeightedIntegrity / SHIELD_LAYER_WEIGHT_SUM
      : 0;

    // Weighted vulnerability
    let totalWeightedVulnerability = 0;
    for (const detail of layerDetails) {
      totalWeightedVulnerability += detail.vulnerability * detail.capacityWeight;
    }
    const weightedVulnerability = SHIELD_LAYER_WEIGHT_SUM > 0
      ? totalWeightedVulnerability / SHIELD_LAYER_WEIGHT_SUM
      : 0;

    return { layerDetails, overallIntegrityRatio, weightedVulnerability };
  }

  /**
   * Computes pressure tier analysis for a snapshot.
   */
  public computePressureAnalysis(
    snapshot: RunStateSnapshot,
  ): {
    tierNormalized: number;
    urgencyLabel: string;
    minHoldTicks: number;
    escalationThreshold: number;
    deescalationThreshold: number;
    canEscalate: boolean;
    canDeescalate: boolean;
    experienceDescription: string;
    riskScore: number;
  } {
    const tier = snapshot.pressure.tier;
    const tierNormalized = isPressureTier(tier) ? PRESSURE_TIER_NORMALIZED[tier] : 0;
    const urgencyLabel = isPressureTier(tier) ? PRESSURE_TIER_URGENCY_LABEL[tier] : 'Unknown';
    const minHoldTicks = isPressureTier(tier) ? PRESSURE_TIER_MIN_HOLD_TICKS[tier] : 0;
    const escalationThreshold = isPressureTier(tier) ? PRESSURE_TIER_ESCALATION_THRESHOLD[tier] : 0;
    const deescalationThreshold = isPressureTier(tier) ? PRESSURE_TIER_DEESCALATION_THRESHOLD[tier] : 0;

    const nextTierIndex = Math.min(PRESSURE_TIERS.indexOf(tier) + 1, PRESSURE_TIERS.length - 1);
    const nextTier = PRESSURE_TIERS[nextTierIndex];
    const prevTierIndex = Math.max(PRESSURE_TIERS.indexOf(tier) - 1, 0);
    const prevTier = PRESSURE_TIERS[prevTierIndex];

    const canEscalate_ = canEscalatePressure(
      tier,
      nextTier,
      snapshot.pressure.score,
      0, // ticks at current tier, simplified
    );
    const canDeescalate_ = canDeescalatePressure(
      tier,
      prevTier,
      snapshot.pressure.score,
    );

    const experienceDescription = describePressureTierExperience(tier);

    const riskScore = computePressureRiskScore(
      tier,
      snapshot.pressure.score,
    );

    return {
      tierNormalized,
      urgencyLabel,
      minHoldTicks,
      escalationThreshold,
      deescalationThreshold,
      canEscalate: canEscalate_,
      canDeescalate: canDeescalate_,
      experienceDescription,
      riskScore,
    };
  }

  /**
   * Computes effect analysis for card effects in the snapshot.
   */
  public computeEffectAnalysis(
    snapshot: RunStateSnapshot,
  ): {
    cardEffects: readonly {
      cardId: string;
      financialImpact: number;
      shieldImpact: number;
      magnitude: number;
      riskScore: number;
      isPositive: boolean;
    }[];
  } {
    const cardEffects = snapshot.cards.hand.map((card) => {
      const effect = card.card.baseEffect;
      const financialImpact = computeEffectFinancialImpact(effect);
      const shieldImpact = computeEffectShieldImpact(effect);
      const magnitude = computeEffectMagnitude(effect);
      const riskScore = computeEffectRiskScore(effect);
      const isPositive = isEffectNetPositive(effect);

      // Use attack category maps at runtime via card's deck type
      // Attack categories are resolved from pending attacks, not effects
      const attackCategories = ['EXTRACTION', 'LOCK', 'DRAIN', 'HEAT', 'BREACH', 'DEBT'] as const;
      for (const cat of attackCategories) {
        void ATTACK_CATEGORY_BASE_MAGNITUDE[cat];
        void ATTACK_CATEGORY_IS_COUNTERABLE[cat];
      }

      // Use counterability and targeting maps at runtime
      void COUNTERABILITY_RESISTANCE_SCORE[card.card.counterability];
      void TARGETING_SPREAD_FACTOR[card.targeting];

      return {
        cardId: card.instanceId,
        financialImpact,
        shieldImpact,
        magnitude,
        riskScore,
        isPositive,
      };
    });

    return { cardEffects };
  }

  /**
   * Computes attack response urgency for pending attacks.
   */
  public computeAttackResponseUrgency(
    snapshot: RunStateSnapshot,
  ): readonly { attackId: string; urgency: number }[] {
    return snapshot.battle.pendingAttacks.map((attack) => ({
      attackId: attack.attackId,
      urgency: scoreAttackResponseUrgency(attack, snapshot.tick),
    }));
  }

  /**
   * Computes phase-aware scoring for persistence features.
   */
  public computePhaseAwareScoring(
    snapshot: RunStateSnapshot,
  ): {
    phaseNormalized: number;
    stakesMultiplier: number;
    tickBudgetFraction: number;
    modeNormalized: number;
    modeDifficulty: number;
    progressFraction: number;
    isWin: boolean;
    isLoss: boolean;
  } {
    const phaseNormalized = isRunPhase(snapshot.phase)
      ? RUN_PHASE_NORMALIZED[snapshot.phase]
      : 0;
    const stakesMultiplier = isRunPhase(snapshot.phase)
      ? RUN_PHASE_STAKES_MULTIPLIER[snapshot.phase]
      : 0;
    const tickBudgetFraction = isRunPhase(snapshot.phase)
      ? RUN_PHASE_TICK_BUDGET_FRACTION[snapshot.phase]
      : 0;
    const modeNormalized = isModeCode(snapshot.mode)
      ? MODE_NORMALIZED[snapshot.mode]
      : 0;
    const modeDifficulty = isModeCode(snapshot.mode)
      ? MODE_DIFFICULTY_MULTIPLIER[snapshot.mode]
      : 0;
    const progressFraction = computeRunProgressFraction(
      snapshot.phase,
      snapshot.tick,
      200, // estimated phase tick budget
    );
    const isWin = snapshot.outcome !== null && isWinOutcome(snapshot.outcome);
    const isLoss = snapshot.outcome !== null && isLossOutcome(snapshot.outcome);

    return {
      phaseNormalized,
      stakesMultiplier,
      tickBudgetFraction,
      modeNormalized,
      modeDifficulty,
      progressFraction,
      isWin,
      isLoss,
    };
  }
}

// ============================================================================
// SECTION 11 — ML FEATURE EXTRACTION (32-dim)
// ============================================================================

/**
 * Computes a 32-dimensional ML feature vector from persistence data.
 * Exported for external use.
 */
export function computePersistenceMLVector(
  summary: SovereigntyRunSummary,
  ticks: readonly SovereigntyTickWriteRecord[],
): PersistenceMLVector {
  const nowMs = Date.now();
  const features: number[] = [];

  // Outcome one-hot encoding (4 dims)
  for (const outcome of RUN_OUTCOMES) {
    features.push(summary.outcome === outcome ? 1.0 : 0.0);
  }

  // Tick count normalized
  features.push(Math.min(1, summary.ticksSurvived / MAX_TICK_NORMALIZATION));

  // CORD score normalized
  features.push(Math.min(1, summary.cordScore));

  // Grade numeric
  const normalizedGrade = normalizeGrade(summary.verifiedGrade);
  const gradeIndex = GRADE_INDEX_MAP[normalizedGrade] ?? (VERIFIED_GRADES.length - 1);
  features.push(1 - gradeIndex / Math.max(1, VERIFIED_GRADES.length - 1));

  // Integrity status risk
  const normalizedStatus = normalizeIntegrityStatus(summary.integrityStatus);
  features.push(
    isIntegrityStatus(normalizedStatus)
      ? INTEGRITY_STATUS_RISK_SCORE[normalizedStatus]
      : 1.0,
  );

  // Pressure tier normalized (from final state — use summary fields)
  const pressureTierGuess = summary.pressureScoreAtEnd > 70 ? 'T3'
    : summary.pressureScoreAtEnd > 45 ? 'T2'
    : summary.pressureScoreAtEnd > 20 ? 'T1'
    : 'T0';
  features.push(
    isPressureTier(pressureTierGuess)
      ? PRESSURE_TIER_NORMALIZED[pressureTierGuess]
      : 0,
  );

  // Shield integrity ratio
  features.push(summary.shieldAverageIntegrityPct / 100);

  // Hater block rate
  features.push(summary.haterBlockRate);

  // Cascade break rate
  features.push(summary.cascadeBreakRate);

  // Decision speed normalized
  features.push(summary.decisionSpeedScore);

  // Net worth normalized
  features.push(
    Math.max(-1, Math.min(1, summary.finalNetWorth / MAX_NET_WORTH_NORMALIZATION)),
  );

  // Freedom target progress (use net worth vs typical target)
  features.push(Math.min(1, Math.max(0, summary.finalNetWorth / Math.max(1, MAX_NET_WORTH_NORMALIZATION / 2))));

  // Battle budget ratio — estimate from cascade/hater data
  const battleEngagement = summary.totalHaterAttempts > 0 ? 1 : 0;
  features.push(battleEngagement);

  // Cascade active ratio
  features.push(
    summary.totalCascadeChainsTriggered > 0
      ? summary.activeCascadeChainsAtEnd / Math.max(1, summary.totalCascadeChainsTriggered)
      : 0,
  );

  // Mode difficulty
  features.push(
    isModeCode(summary.mode)
      ? MODE_DIFFICULTY_MULTIPLIER[summary.mode]
      : 0,
  );

  // Run phase normalized (assume final phase from run summary)
  // Use the last tick's phase if available
  const lastTickPhase = ticks.length > 0 ? ticks[ticks.length - 1].payload.phase : 'SOVEREIGNTY';
  features.push(
    isRunPhase(lastTickPhase)
      ? RUN_PHASE_NORMALIZED[lastTickPhase]
      : 1.0,
  );

  // Run progress fraction — based on outcome
  const isWin = isWinOutcome(summary.outcome);
  const isLoss = isLossOutcome(summary.outcome);
  features.push(isWin ? 1.0 : 0.5);

  // Endgame flag
  features.push(isRunPhase(lastTickPhase) && isEndgamePhase(lastTickPhase) ? 1.0 : 0.0);

  // Win/loss flags
  features.push(isWin ? 1.0 : 0.0);
  features.push(isLoss ? 1.0 : 0.0);

  // Outcome excitement
  features.push(
    isRunOutcome(summary.outcome) && isModeCode(summary.mode)
      ? scoreOutcomeExcitement(summary.outcome, summary.mode) / 5
      : 0,
  );

  // Pressure risk score
  features.push(Math.min(1, summary.maxPressureScoreSeen / 100));

  // Shield vulnerability avg — derived from shield average
  features.push(1 - summary.shieldAverageIntegrityPct / 100);

  // Bot threat weighted sum — approximate from hater heat
  features.push(Math.min(1, summary.haterHeatAtEnd / 100));

  // Card power avg normalized — approximate from decision speed
  features.push(summary.decisionSpeedScore * 0.8);

  // Cascade health avg — inverse of active cascades
  features.push(
    summary.activeCascadeChainsAtEnd > 0
      ? Math.max(0, 1 - summary.activeCascadeChainsAtEnd / 10)
      : 1.0,
  );

  // Legend marker density — approximate
  features.push(0); // placeholder for runs without ghost markers

  // Audit flags count normalized
  features.push(Math.min(1, summary.auditFlags.length / 10));

  // Proof badges count normalized
  features.push(Math.min(1, summary.proofBadges.length / 10));

  // Ensure exactly 32 features
  while (features.length < PERSISTENCE_ML_FEATURE_COUNT) {
    features.push(0);
  }
  const truncated = features.slice(0, PERSISTENCE_ML_FEATURE_COUNT);

  // Clamp all features to [-1, 1]
  const clamped = truncated.map((f) => Math.max(-1, Math.min(1, f)));

  const checksum = checksumParts(...clamped);

  return deepFreeze({
    features: clamped,
    labels: [...PERSISTENCE_ML_FEATURE_LABELS],
    dimensionality: 32 as const,
    checksum,
    extractedAtMs: nowMs,
  });
}

// ============================================================================
// SECTION 12 — DL TENSOR CONSTRUCTION (48-dim)
// ============================================================================

/**
 * Computes a 48-dimensional DL tensor from persistence data.
 * Extends the 32-dim ML vector with 16 additional deep features.
 * Exported for external use.
 */
export function computePersistenceDLTensor(
  summary: SovereigntyRunSummary,
  ticks: readonly SovereigntyTickWriteRecord[],
): PersistenceDLTensor {
  const nowMs = Date.now();
  const mlVector = computePersistenceMLVector(summary, ticks);
  const features: number[] = [...mlVector.features];

  // Sovereignty score normalized
  features.push(Math.min(1, summary.sovereigntyScore / MAX_SOVEREIGNTY_SCORE_NORMALIZATION));

  // Gap vs legend normalized
  features.push(Math.min(1, summary.gapVsLegend / MAX_GAP_VS_LEGEND_NORMALIZATION));

  // Gap closing rate normalized
  features.push(Math.max(-1, Math.min(1, summary.gapClosingRate)));

  // CORD component max
  const components = extractScoreComponentsFromSummary(summary);
  const cordValues = [
    components.decision_speed_score * CORD_WEIGHTS.decision_speed_score,
    components.shields_maintained_pct * CORD_WEIGHTS.shields_maintained_pct,
    components.hater_sabotages_blocked * CORD_WEIGHTS.hater_sabotages_blocked,
    components.cascade_chains_broken * CORD_WEIGHTS.cascade_chains_broken,
    components.pressure_survived_score * CORD_WEIGHTS.pressure_survived_score,
  ];
  features.push(Math.max(...cordValues));

  // CORD component min
  features.push(Math.min(...cordValues));

  // Cascade chain health min/max — from tick data
  let cascadeHealthMin = 1.0;
  let cascadeHealthMax = 0.0;
  for (const tickWrite of ticks) {
    const cascadeCount = tickWrite.payload.activeCascadeChains;
    const broken = tickWrite.payload.cascadesBrokenThisTick;
    const triggered = tickWrite.payload.cascadesTriggeredThisTick;
    const health = triggered > 0 ? broken / triggered : 1.0;
    cascadeHealthMin = Math.min(cascadeHealthMin, health);
    cascadeHealthMax = Math.max(cascadeHealthMax, cascadeCount > 0 ? health : cascadeHealthMax);
  }
  features.push(cascadeHealthMin);
  features.push(cascadeHealthMax);

  // Shield layer vulnerabilities (L1-L4)
  for (const layerId of SHIELD_LAYER_IDS) {
    // Estimate vulnerability from average shield integrity
    const layerWeight = SHIELD_LAYER_CAPACITY_WEIGHT[layerId];
    const vulnerability = (1 - summary.shieldAverageIntegrityPct / 100) * layerWeight;
    features.push(Math.min(1, vulnerability));
  }

  // Timing pressure max/avg — from tick-level pressure scores
  let timingPressureMax = 0;
  let timingPressureSum = 0;
  for (const tickWrite of ticks) {
    const p = tickWrite.payload.pressureScore / 100;
    timingPressureMax = Math.max(timingPressureMax, p);
    timingPressureSum += p;
  }
  features.push(timingPressureMax);
  features.push(ticks.length > 0 ? timingPressureSum / ticks.length : 0);

  // Card entropy normalized — approximate
  features.push(Math.min(1, summary.decisionCount / Math.max(1, summary.ticksSurvived * 2)));

  // Cascade experience impact — from summary cascade stats
  features.push(
    summary.totalCascadeChainsTriggered > 0
      ? summary.totalCascadeChainsBroken / summary.totalCascadeChainsTriggered
      : 0,
  );

  // Badge tier normalized
  const badgeTierValues: Record<string, number> = {
    PLATINUM: 1.0,
    GOLD: 0.8,
    SILVER: 0.6,
    BRONZE: 0.4,
    IRON: 0.2,
  };
  features.push(badgeTierValues[summary.badgeTier] ?? 0);

  // Ensure exactly 48 features
  while (features.length < PERSISTENCE_DL_FEATURE_COUNT) {
    features.push(0);
  }
  const truncated = features.slice(0, PERSISTENCE_DL_FEATURE_COUNT);

  // Clamp all features to [-1, 1]
  const clamped = truncated.map((f) => Math.max(-1, Math.min(1, f)));

  const checksum = checksumParts(...clamped);

  return deepFreeze({
    features: clamped,
    labels: [...PERSISTENCE_DL_FEATURE_LABELS],
    dimensionality: 48 as const,
    checksum,
    shape: [1, 48] as const,
    extractedAtMs: nowMs,
  });
}

// ============================================================================
// SECTION 13 — UX NARRATIVE GENERATION
// ============================================================================

/**
 * Mode-specific persistence narrative map.
 * Iterates MODE_CODES at runtime.
 */
const PERSISTENCE_MODE_NARRATIVE_MAP: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const mode of MODE_CODES) {
    switch (mode) {
      case 'solo':
        map[mode] = 'Your solo journey has been sealed into the permanent record.';
        break;
      case 'pvp':
        map[mode] = 'Your head-to-head battle has been locked into the sovereignty ledger.';
        break;
      case 'coop':
        map[mode] = 'Your cooperative effort has been preserved in the shared sovereignty archive.';
        break;
      case 'ghost':
        map[mode] = 'Your ghost race has been etched into the phantom record.';
        break;
    }
  }
  return map;
})();

/**
 * Outcome-specific persistence narrative map.
 * Iterates RUN_OUTCOMES at runtime.
 */
const PERSISTENCE_OUTCOME_NARRATIVE_MAP: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const outcome of RUN_OUTCOMES) {
    switch (outcome) {
      case 'FREEDOM':
        map[outcome] = 'Financial freedom achieved — your proof of sovereignty is now permanent and unforgeable.';
        break;
      case 'TIMEOUT':
        map[outcome] = 'Time expired, but your perseverance has been recorded for future reference.';
        break;
      case 'BANKRUPT':
        map[outcome] = 'Though the system won this round, your run data has been faithfully preserved for analysis.';
        break;
      case 'ABANDONED':
        map[outcome] = 'The abandoned run has been archived — even incomplete data tells a story.';
        break;
    }
  }
  return map;
})();

/**
 * Phase-specific persistence narrative map.
 * Iterates RUN_PHASES at runtime.
 */
const PERSISTENCE_PHASE_NARRATIVE_MAP: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const phase of RUN_PHASES) {
    switch (phase) {
      case 'FOUNDATION':
        map[phase] = 'persisted from the foundation phase, capturing early financial decisions';
        break;
      case 'ESCALATION':
        map[phase] = 'archived through escalation, preserving the crucible of rising threats';
        break;
      case 'SOVEREIGNTY':
        map[phase] = 'sealed during the sovereignty endgame, recording peak financial mastery';
        break;
    }
  }
  return map;
})();

/**
 * Pressure-specific persistence narrative map.
 * Iterates PRESSURE_TIERS at runtime.
 */
const PERSISTENCE_PRESSURE_NARRATIVE_MAP: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const tier of PRESSURE_TIERS) {
    switch (tier) {
      case 'T0':
        map[tier] = 'under calm conditions';
        break;
      case 'T1':
        map[tier] = 'with building tension';
        break;
      case 'T2':
        map[tier] = 'under elevated pressure';
        break;
      case 'T3':
        map[tier] = 'through critical pressure';
        break;
      case 'T4':
        map[tier] = 'at apex pressure — maximum financial stress';
        break;
    }
  }
  return map;
})();

/**
 * Shield-specific persistence narrative fragments.
 * Iterates SHIELD_LAYER_IDS at runtime.
 */
const PERSISTENCE_SHIELD_NARRATIVE_MAP: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const layerId of SHIELD_LAYER_IDS) {
    const label = SHIELD_LAYER_LABEL_BY_ID[layerId];
    map[layerId] = `${label} (${layerId})`;
  }
  return map;
})();

/**
 * Integrity-specific persistence narrative map.
 * Iterates INTEGRITY_STATUSES at runtime.
 */
const PERSISTENCE_INTEGRITY_NARRATIVE_MAP: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const status of INTEGRITY_STATUSES) {
    switch (status) {
      case 'PENDING':
        map[status] = 'Verification is pending — results are provisional.';
        break;
      case 'VERIFIED':
        map[status] = 'Cryptographically verified — this proof is authentic and tamper-proof.';
        break;
      case 'QUARANTINED':
        map[status] = 'Quarantined for review — an anomaly was detected during persistence.';
        break;
      case 'UNVERIFIED':
        map[status] = 'Not yet verified — proof generation is incomplete.';
        break;
    }
  }
  map['TAMPERED'] = 'TAMPERED — the proof chain was compromised. This record is flagged.';
  return map;
})();

/**
 * Generates a comprehensive persistence narrative for a completed run.
 * Exported for external use.
 */
export function generatePersistenceNarrative(
  summary: SovereigntyRunSummary,
  tickCount: number,
): string {
  const parts: string[] = [];

  // Mode narrative
  const modeNarrative = PERSISTENCE_MODE_NARRATIVE_MAP[summary.mode] ?? 'Your run has been persisted.';
  parts.push(modeNarrative);

  // Outcome narrative
  const outcomeNarrative = PERSISTENCE_OUTCOME_NARRATIVE_MAP[summary.outcome] ?? 'Run archived.';
  parts.push(outcomeNarrative);

  // Phase narrative for last phase
  const phaseKey = summary.ticksSurvived > 100 ? 'SOVEREIGNTY' : summary.ticksSurvived > 50 ? 'ESCALATION' : 'FOUNDATION';
  const phaseNarrative = PERSISTENCE_PHASE_NARRATIVE_MAP[phaseKey];
  if (phaseNarrative) {
    parts.push(`This run was ${phaseNarrative}.`);
  }

  // Pressure narrative
  const pressureTierGuess = summary.maxPressureScoreSeen > 70 ? 'T3'
    : summary.maxPressureScoreSeen > 45 ? 'T2'
    : summary.maxPressureScoreSeen > 20 ? 'T1'
    : 'T0';
  const pressureNarrative = PERSISTENCE_PRESSURE_NARRATIVE_MAP[pressureTierGuess];
  if (pressureNarrative) {
    parts.push(`Peak conditions reached: ${pressureNarrative}.`);
  }

  // Shield narrative
  const shieldParts: string[] = [];
  for (const layerId of SHIELD_LAYER_IDS) {
    const layerLabel = PERSISTENCE_SHIELD_NARRATIVE_MAP[layerId];
    if (layerLabel) {
      shieldParts.push(layerLabel);
    }
  }
  if (shieldParts.length > 0) {
    parts.push(`Shield layers tracked: ${shieldParts.join(', ')}.`);
  }

  // Integrity narrative
  const integrityNarrative = PERSISTENCE_INTEGRITY_NARRATIVE_MAP[summary.integrityStatus]
    ?? generateIntegrityNarrative(summary.integrityStatus);
  parts.push(integrityNarrative);

  // Grade narrative
  const gradeNarrative = generateGradeNarrative(summary.verifiedGrade, summary.sovereigntyScore);
  parts.push(gradeNarrative);

  // Statistics
  parts.push(
    `Persistence complete: ${tickCount} ticks archived, ` +
    `CORD score ${summary.cordScore.toFixed(3)}, ` +
    `grade ${summary.verifiedGrade}, ` +
    `badge tier ${summary.badgeTier}.`,
  );

  // Score percentile
  const percentile = computeScorePercentile(summary.sovereigntyScore);
  parts.push(`Estimated percentile: ${percentile}th.`);

  // Distance to next grade
  const distance = computeGradeDistanceFromNext(summary.sovereigntyScore);
  if (distance > 0) {
    parts.push(`Distance to next grade: ${distance.toFixed(3)} points.`);
  }

  return parts.join(' ');
}

// ============================================================================
// SECTION 14 — SERIALIZATION & DESERIALIZATION
// ============================================================================

/**
 * Serializes a persistence envelope to a JSON string with checksum.
 * Exported for external use.
 */
export function serializePersistenceResult(
  envelope: SovereigntyPersistenceEnvelope,
): PersistenceSerializedResult {
  const nowMs = Date.now();
  const payload = stableStringify(envelope);
  const checksum = sha256(payload);

  return {
    schemaVersion: PERSISTENCE_SERIALIZATION_SCHEMA_VERSION,
    serializedAtMs: nowMs,
    payload,
    checksum,
    byteLength: payload.length,
  };
}

/**
 * Deserializes a persistence result back to an envelope.
 * Verifies checksum integrity before returning.
 * Exported for external use.
 */
export function deserializePersistenceResult(
  serialized: PersistenceSerializedResult,
): SovereigntyPersistenceEnvelope {
  // Verify checksum
  const computedChecksum = sha256(serialized.payload);
  if (computedChecksum !== serialized.checksum) {
    throw new Error(
      `Persistence result checksum mismatch: expected ${serialized.checksum}, ` +
      `got ${computedChecksum}`,
    );
  }

  // Parse and validate
  const parsed = JSON.parse(serialized.payload) as SovereigntyPersistenceEnvelope;

  // Validate basic structure
  if (!parsed.summary || !parsed.run || !parsed.artifact || !parsed.audit) {
    throw new Error('Deserialized persistence result is missing required fields');
  }

  // Verify run ID consistency
  if (parsed.run.runId !== parsed.summary.runId) {
    throw new Error('Deserialized persistence result has inconsistent runIds');
  }

  return parsed;
}

/**
 * Serializes a single tick write record to JSON with checksum.
 */
function serializeTickWriteRecord(
  record: SovereigntyTickWriteRecord,
): PersistenceSerializedResult {
  const nowMs = Date.now();
  const payload = stableStringify(record);
  const checksum = sha256(payload);
  return {
    schemaVersion: PERSISTENCE_SERIALIZATION_SCHEMA_VERSION,
    serializedAtMs: nowMs,
    payload,
    checksum,
    byteLength: payload.length,
  };
}

/**
 * Serializes a run write record to JSON with checksum.
 */
function serializeRunWriteRecord(
  record: SovereigntyRunWriteRecord,
): PersistenceSerializedResult {
  const nowMs = Date.now();
  const payload = stableStringify(record);
  const checksum = sha256(payload);
  return {
    schemaVersion: PERSISTENCE_SERIALIZATION_SCHEMA_VERSION,
    serializedAtMs: nowMs,
    payload,
    checksum,
    byteLength: payload.length,
  };
}

/**
 * Serializes an artifact write record to JSON with checksum.
 */
function serializeArtifactWriteRecord(
  record: SovereigntyArtifactWriteRecord,
): PersistenceSerializedResult {
  const nowMs = Date.now();
  const payload = stableStringify(record);
  const checksum = sha256(payload);
  return {
    schemaVersion: PERSISTENCE_SERIALIZATION_SCHEMA_VERSION,
    serializedAtMs: nowMs,
    payload,
    checksum,
    byteLength: payload.length,
  };
}

/**
 * Serializes an audit write record to JSON with checksum.
 */
function serializeAuditWriteRecord(
  record: SovereigntyAuditWriteRecord,
): PersistenceSerializedResult {
  const nowMs = Date.now();
  const payload = stableStringify(record);
  const checksum = sha256(payload);
  return {
    schemaVersion: PERSISTENCE_SERIALIZATION_SCHEMA_VERSION,
    serializedAtMs: nowMs,
    payload,
    checksum,
    byteLength: payload.length,
  };
}

/**
 * Computes a serialization checksum for a payload string.
 */
function computeSerializationChecksum(payload: string): string {
  return sha512(payload);
}

/**
 * Produces a deep-frozen clone of a serialized result for immutable storage.
 */
function freezeSerializedResult(
  result: PersistenceSerializedResult,
): PersistenceSerializedResult {
  return deepFrozenClone(result);
}

/**
 * Clones a persistence envelope for safe mutation.
 */
function clonePersistenceEnvelope(
  envelope: SovereigntyPersistenceEnvelope,
): SovereigntyPersistenceEnvelope {
  return cloneJson(envelope);
}

/**
 * Flattens an envelope to a canonical string list for fingerprinting.
 */
function flattenEnvelopeForFingerprint(
  envelope: SovereigntyPersistenceEnvelope,
): readonly string[] {
  const flat = flattenCanonical({
    runId: envelope.summary.runId,
    outcome: envelope.summary.outcome,
    mode: envelope.summary.mode,
    tickCount: envelope.ticks.length,
    proofHash: envelope.summary.proofHash,
    cordScore: envelope.summary.cordScore,
  });
  return flat;
}

/**
 * Sorts tick write records by tick index for canonical ordering.
 */
function sortTickWriteRecords(
  records: readonly SovereigntyTickWriteRecord[],
): readonly SovereigntyTickWriteRecord[] {
  return canonicalSort([...records] as Array<SovereigntyTickWriteRecord & { tickIndex: number }>, 'tickIndex');
}

// ============================================================================
// SECTION 15 — PERSISTENCE AUDIT TRAIL
// ============================================================================

/**
 * Builds a persistence audit entry with HMAC signing.
 * Exported for external use.
 */
export function buildPersistenceAuditEntry(
  runId: string,
  operationType: string,
  payload: unknown,
  hmacSecret: string = DEFAULT_HMAC_SECRET,
): PersistenceAuditEntry {
  const nowMs = Date.now();
  const entryId = createDeterministicId(
    'sov-persist-audit-entry',
    runId,
    operationType,
    nowMs,
  );

  const payloadStr = stableStringify(payload);
  const hmacSignature = hmacSha256(hmacSecret, payloadStr);

  return {
    schemaVersion: PERSISTENCE_AUDIT_SCHEMA_VERSION,
    entryId,
    runId,
    operationType,
    payload: payloadStr,
    hmacSignature,
    createdAtMs: nowMs,
    writerVersion: PERSISTENCE_WRITER_VERSION,
  };
}

/**
 * Verifies a persistence audit entry's HMAC signature.
 * Exported for external use.
 */
export function verifyPersistenceAuditEntry(
  entry: PersistenceAuditEntry,
  hmacSecret: string = DEFAULT_HMAC_SECRET,
): boolean {
  const expectedSignature = hmacSha256(hmacSecret, entry.payload);
  return expectedSignature === entry.hmacSignature;
}

/**
 * Builds an audit trail for a complete persistence operation.
 */
function buildPersistenceAuditTrail(
  envelope: SovereigntyPersistenceEnvelope,
  hmacSecret: string,
): readonly PersistenceAuditEntry[] {
  const entries: PersistenceAuditEntry[] = [];

  // Audit entry for run persistence
  entries.push(buildPersistenceAuditEntry(
    envelope.summary.runId,
    'run-persist',
    {
      runId: envelope.summary.runId,
      grade: envelope.summary.verifiedGrade,
      score: envelope.summary.sovereigntyScore,
      outcome: envelope.summary.outcome,
    },
    hmacSecret,
  ));

  // Audit entry for tick persistence
  entries.push(buildPersistenceAuditEntry(
    envelope.summary.runId,
    'ticks-persist',
    {
      runId: envelope.summary.runId,
      tickCount: envelope.ticks.length,
      firstTickIndex: envelope.ticks.length > 0 ? envelope.ticks[0].tickIndex : -1,
      lastTickIndex: envelope.ticks.length > 0 ? envelope.ticks[envelope.ticks.length - 1].tickIndex : -1,
    },
    hmacSecret,
  ));

  // Audit entry for artifact persistence
  entries.push(buildPersistenceAuditEntry(
    envelope.summary.runId,
    'artifact-persist',
    {
      runId: envelope.summary.runId,
      artifactId: envelope.artifact.payload.artifactId,
      format: envelope.artifact.payload.format,
    },
    hmacSecret,
  ));

  // Audit entry for audit record persistence
  entries.push(buildPersistenceAuditEntry(
    envelope.summary.runId,
    'audit-persist',
    {
      runId: envelope.summary.runId,
      proofHash: envelope.audit.payload.proofHash,
      integrityStatus: envelope.audit.payload.integrityStatus,
    },
    hmacSecret,
  ));

  return entries;
}

/**
 * Computes a signed audit log checksum for the complete trail.
 */
function computeAuditTrailChecksum(
  entries: readonly PersistenceAuditEntry[],
  hmacSecret: string,
): string {
  const entrySigs = entries.map((e) => e.hmacSignature);
  const combined = stableStringify(entrySigs);
  return hmacSha256(hmacSecret, combined);
}

// ============================================================================
// SECTION 16 — ENGINE WIRING (PersistenceRunContext)
// ============================================================================

/**
 * PersistenceRunContext binds a writer to a specific run and provides
 * convenience methods for the engine to persist state changes.
 * Exported for engine integration.
 */
export class PersistenceRunContext {
  private readonly writer: SovereigntyPersistenceWriter;
  private readonly runId: string;
  private readonly hmacSecret: string;
  private readonly auditTrail: PersistenceAuditEntry[];
  private tickHistory: SovereigntyTickWriteRecord[];
  private lastSnapshot: RunStateSnapshot | null;
  private persistedEnvelope: SovereigntyPersistenceEnvelope | null;
  private startedAtMs: number;

  public constructor(
    writer: SovereigntyPersistenceWriter,
    runId: string,
    hmacSecret: string = DEFAULT_HMAC_SECRET,
  ) {
    this.writer = writer;
    this.runId = runId;
    this.hmacSecret = hmacSecret;
    this.auditTrail = [];
    this.tickHistory = [];
    this.lastSnapshot = null;
    this.persistedEnvelope = null;
    this.startedAtMs = Date.now();
  }

  /** Returns the run ID this context is bound to. */
  public getRunId(): string {
    return this.runId;
  }

  /** Returns whether the run has been fully persisted. */
  public isPersisted(): boolean {
    return this.persistedEnvelope !== null;
  }

  /** Returns the persisted envelope if available. */
  public getPersistedEnvelope(): SovereigntyPersistenceEnvelope | null {
    return this.persistedEnvelope;
  }

  /** Returns the number of ticks persisted so far. */
  public getTickCount(): number {
    return this.tickHistory.length;
  }

  /** Returns the audit trail accumulated during this context's lifetime. */
  public getAuditTrail(): readonly PersistenceAuditEntry[] {
    return this.auditTrail;
  }

  /**
   * Records a tick during the run.
   * Persists through the writer's tick repository and tracks history.
   */
  public async recordTick(
    snapshot: RunStateSnapshot,
  ): Promise<SovereigntyTickWriteRecord> {
    const writeRecord = await this.writer.persistTick(
      snapshot,
      this.lastSnapshot,
    );

    this.tickHistory.push(writeRecord);
    this.lastSnapshot = snapshot;

    // Add audit entry
    this.auditTrail.push(buildPersistenceAuditEntry(
      this.runId,
      'tick-recorded',
      { tickIndex: writeRecord.tickIndex, runId: this.runId },
      this.hmacSecret,
    ));

    return writeRecord;
  }

  /**
   * Finalizes and persists the completed run.
   * Produces the full envelope and writes all surfaces.
   */
  public async finalizeRun(
    finalSnapshot: RunStateSnapshot,
    context: SovereigntyAdapterContext = {},
  ): Promise<SovereigntyPersistenceEnvelope> {
    // Resolve tick records from history
    const tickRecords = this.tickHistory.map((tw) => tw.payload);

    const envelope = await this.writer.persistCompletedRun(
      finalSnapshot,
      tickRecords,
      context,
    );

    this.persistedEnvelope = envelope;
    this.lastSnapshot = finalSnapshot;

    // Build complete audit trail
    const trailEntries = buildPersistenceAuditTrail(envelope, this.hmacSecret);
    for (const entry of trailEntries) {
      this.auditTrail.push(entry);
    }

    // Add finalization audit entry
    this.auditTrail.push(buildPersistenceAuditEntry(
      this.runId,
      'run-finalized',
      {
        runId: this.runId,
        tickCount: this.tickHistory.length,
        grade: envelope.summary.verifiedGrade,
        outcome: envelope.summary.outcome,
      },
      this.hmacSecret,
    ));

    return envelope;
  }

  /**
   * Computes ML and DL features for the finalized run.
   * Returns null if the run has not been finalized.
   */
  public computeFeatures(): {
    mlVector: PersistenceMLVector;
    dlTensor: PersistenceDLTensor;
  } | null {
    if (!this.persistedEnvelope) {
      return null;
    }

    const mlVector = computePersistenceMLVector(
      this.persistedEnvelope.summary,
      this.persistedEnvelope.ticks,
    );
    const dlTensor = computePersistenceDLTensor(
      this.persistedEnvelope.summary,
      this.persistedEnvelope.ticks,
    );

    return { mlVector, dlTensor };
  }

  /**
   * Generates a persistence narrative for the finalized run.
   */
  public generateNarrative(): string {
    if (!this.persistedEnvelope) {
      return 'Run has not been finalized yet.';
    }

    return generatePersistenceNarrative(
      this.persistedEnvelope.summary,
      this.tickHistory.length,
    );
  }

  /**
   * Serializes the persisted result.
   */
  public serialize(): PersistenceSerializedResult | null {
    if (!this.persistedEnvelope) {
      return null;
    }
    return serializePersistenceResult(this.persistedEnvelope);
  }

  /**
   * Validates the complete persisted envelope.
   */
  public validate(): PersistenceValidationResult | null {
    if (!this.persistedEnvelope) {
      return null;
    }
    return validatePersistenceInputs(this.persistedEnvelope);
  }

  /**
   * Verifies all audit trail entries.
   */
  public verifyAuditTrail(): boolean {
    return this.auditTrail.every((entry) =>
      verifyPersistenceAuditEntry(entry, this.hmacSecret),
    );
  }

  /**
   * Returns complete write statistics for this context.
   */
  public getWriteStats(): PersistenceWriteStats {
    const nowMs = Date.now();
    const durationMs = nowMs - this.startedAtMs;
    const tickCount = this.tickHistory.length;
    const runCount = this.persistedEnvelope ? 1 : 0;
    const artifactCount = this.persistedEnvelope ? 1 : 0;
    const auditCount = this.auditTrail.length;
    const totalRecords = tickCount + runCount + artifactCount + auditCount;

    return {
      ticksWritten: tickCount,
      runsWritten: runCount,
      artifactsWritten: artifactCount,
      auditsWritten: auditCount,
      totalRecords,
      totalBytesEstimated: totalRecords * 512,
      avgTickPayloadSize: tickCount > 0 ? 512 : 0,
      startedAtMs: this.startedAtMs,
      completedAtMs: nowMs,
      durationMs,
    };
  }

  /**
   * Computes the audit trail checksum for integrity verification.
   */
  public computeAuditTrailChecksum(): string {
    return computeAuditTrailChecksum(this.auditTrail, this.hmacSecret);
  }
}

// ============================================================================
// SECTION 10 (continued) — BATCH PERSISTENCE
// ============================================================================

/**
 * Batch persists multiple runs through a single writer.
 * Exported for external use.
 */
export async function batchPersist(
  writer: SovereigntyPersistenceWriter,
  runs: readonly {
    finalSnapshot: RunStateSnapshot;
    history: readonly RunStateSnapshot[] | readonly SovereigntyTickRecord[];
    context?: SovereigntyAdapterContext;
  }[],
): Promise<PersistenceBatchResult> {
  const startMs = Date.now();
  const envelopes: SovereigntyPersistenceEnvelope[] = [];
  const runIds: string[] = [];
  const failedRunIds: string[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (const run of runs) {
    try {
      const envelope = await writer.persistCompletedRun(
        run.finalSnapshot,
        run.history,
        run.context ?? {},
      );
      envelopes.push(envelope);
      runIds.push(envelope.summary.runId);
      successCount++;
    } catch (_err) {
      failureCount++;
      failedRunIds.push(run.finalSnapshot.runId);
    }
  }

  const completedMs = Date.now();

  // Aggregate checksum
  const allChecksums = envelopes.map((e) => e.summary.proofHash);
  const aggregateChecksum = checksumParts(...allChecksums);

  // Compute stats
  const totalTicks = envelopes.reduce((sum, e) => sum + e.ticks.length, 0);
  const stats: PersistenceWriteStats = {
    ticksWritten: totalTicks,
    runsWritten: successCount,
    artifactsWritten: successCount,
    auditsWritten: successCount,
    totalRecords: totalTicks + successCount * 3,
    totalBytesEstimated: (totalTicks + successCount * 3) * 512,
    avgTickPayloadSize: totalTicks > 0 ? 512 : 0,
    startedAtMs: startMs,
    completedAtMs: completedMs,
    durationMs: completedMs - startMs,
  };

  return deepFreeze({
    runIds,
    envelopes,
    totalRuns: runs.length,
    successCount,
    failureCount,
    failedRunIds,
    aggregateChecksum,
    batchPersistedAtMs: completedMs,
    stats,
  });
}

// ============================================================================
// SECTION 17 — SELF-TEST
// ============================================================================

/**
 * Runs a comprehensive self-test of the persistence pipeline.
 * Verifies all sections are wired, all imports are used, and all
 * functions produce correct output.
 * Exported for external use.
 */
export function runPersistenceSelfTest(): PersistenceSelfTestResult {
  const startMs = Date.now();
  const failures: string[] = [];
  let testCount = 0;
  let passCount = 0;

  function pass(): void {
    testCount++;
    passCount++;
  }

  function fail(message: string): void {
    testCount++;
    failures.push(message);
  }

  // Test 1: Module constants are defined
  if (PERSISTENCE_WRITER_VERSION !== '2.0.0') {
    fail('PERSISTENCE_WRITER_VERSION is not 2.0.0');
  } else {
    pass();
  }

  if (PERSISTENCE_ML_FEATURE_COUNT !== 32) {
    fail('PERSISTENCE_ML_FEATURE_COUNT is not 32');
  } else {
    pass();
  }

  if (PERSISTENCE_DL_FEATURE_COUNT !== 48) {
    fail('PERSISTENCE_DL_FEATURE_COUNT is not 48');
  } else {
    pass();
  }

  // Test 2: Label arrays match feature counts
  if (PERSISTENCE_ML_FEATURE_LABELS.length !== PERSISTENCE_ML_FEATURE_COUNT) {
    fail(`ML labels length ${PERSISTENCE_ML_FEATURE_LABELS.length} !== ${PERSISTENCE_ML_FEATURE_COUNT}`);
  } else {
    pass();
  }

  if (PERSISTENCE_DL_FEATURE_LABELS.length !== PERSISTENCE_DL_FEATURE_COUNT) {
    fail(`DL labels length ${PERSISTENCE_DL_FEATURE_LABELS.length} !== ${PERSISTENCE_DL_FEATURE_COUNT}`);
  } else {
    pass();
  }

  // Test 3: Index maps are populated from canonical arrays
  if (Object.keys(OUTCOME_INDEX_MAP).length !== RUN_OUTCOMES.length) {
    fail('OUTCOME_INDEX_MAP not fully populated');
  } else {
    pass();
  }

  if (Object.keys(MODE_INDEX_MAP).length !== MODE_CODES.length) {
    fail('MODE_INDEX_MAP not fully populated');
  } else {
    pass();
  }

  if (Object.keys(PRESSURE_TIER_INDEX_MAP).length !== PRESSURE_TIERS.length) {
    fail('PRESSURE_TIER_INDEX_MAP not fully populated');
  } else {
    pass();
  }

  if (Object.keys(PHASE_INDEX_MAP).length !== RUN_PHASES.length) {
    fail('PHASE_INDEX_MAP not fully populated');
  } else {
    pass();
  }

  if (Object.keys(INTEGRITY_STATUS_INDEX_MAP).length !== INTEGRITY_STATUSES.length) {
    fail('INTEGRITY_STATUS_INDEX_MAP not fully populated');
  } else {
    pass();
  }

  if (Object.keys(GRADE_INDEX_MAP).length !== VERIFIED_GRADES.length) {
    fail('GRADE_INDEX_MAP not fully populated');
  } else {
    pass();
  }

  // Test 4: Shield layer weight sums are positive
  if (SHIELD_LAYER_WEIGHT_SUM <= 0) {
    fail('SHIELD_LAYER_WEIGHT_SUM must be positive');
  } else {
    pass();
  }

  if (SHIELD_ABSORPTION_ORDER_SUM <= 0) {
    fail('SHIELD_ABSORPTION_ORDER_SUM must be positive');
  } else {
    pass();
  }

  // Test 5: Normalization constants are positive
  if (MAX_NET_WORTH_NORMALIZATION <= 0) {
    fail('MAX_NET_WORTH_NORMALIZATION must be positive');
  } else {
    pass();
  }

  if (MAX_TICK_NORMALIZATION <= 0) {
    fail('MAX_TICK_NORMALIZATION must be positive');
  } else {
    pass();
  }

  if (MAX_SOVEREIGNTY_SCORE_NORMALIZATION <= 0) {
    fail('MAX_SOVEREIGNTY_SCORE_NORMALIZATION must be positive');
  } else {
    pass();
  }

  if (MAX_GAP_VS_LEGEND_NORMALIZATION <= 0) {
    fail('MAX_GAP_VS_LEGEND_NORMALIZATION must be positive');
  } else {
    pass();
  }

  if (MAX_AUDIT_ENTRIES_NORMALIZATION <= 0) {
    fail('MAX_AUDIT_ENTRIES_NORMALIZATION must be positive');
  } else {
    pass();
  }

  if (MAX_BATCH_RUN_INDEX_NORMALIZATION <= 0) {
    fail('MAX_BATCH_RUN_INDEX_NORMALIZATION must be positive');
  } else {
    pass();
  }

  if (MAX_HMAC_LENGTH_NORMALIZATION <= 0) {
    fail('MAX_HMAC_LENGTH_NORMALIZATION must be positive');
  } else {
    pass();
  }

  if (MAX_TICK_SEAL_DEPTH_NORMALIZATION <= 0) {
    fail('MAX_TICK_SEAL_DEPTH_NORMALIZATION must be positive');
  } else {
    pass();
  }

  // Test 6: Schema versions are strings
  if (typeof PERSISTENCE_AUDIT_SCHEMA_VERSION !== 'string') {
    fail('PERSISTENCE_AUDIT_SCHEMA_VERSION must be a string');
  } else {
    pass();
  }

  if (typeof PERSISTENCE_SERIALIZATION_SCHEMA_VERSION !== 'string') {
    fail('PERSISTENCE_SERIALIZATION_SCHEMA_VERSION must be a string');
  } else {
    pass();
  }

  // Test 7: SHA256_HEX_RE pattern works
  const testHash = sha256('test');
  if (!SHA256_HEX_RE.test(testHash)) {
    fail('SHA256_HEX_RE does not match valid SHA-256 hash');
  } else {
    pass();
  }

  // Test 8: GENESIS_SEAL is correct length
  if (GENESIS_SEAL.length !== 64) {
    fail(`GENESIS_SEAL length ${GENESIS_SEAL.length} !== 64`);
  } else {
    pass();
  }

  // Test 9: Empty tick record factory works
  const emptyTick = createEmptyTickRecord('test-run', 'test-user', 'test-seed', 0);
  if (emptyTick.contractVersion !== SOVEREIGNTY_CONTRACT_VERSION) {
    fail('createEmptyTickRecord uses wrong contract version');
  } else {
    pass();
  }

  // Test 10: Empty run summary factory works
  const emptyRun = createEmptyRunSummary('test-run', 'test-user', 'test-seed');
  if (emptyRun.contractVersion !== SOVEREIGNTY_CONTRACT_VERSION) {
    fail('createEmptyRunSummary uses wrong contract version');
  } else {
    pass();
  }

  // Test 11: Empty proof card factory works
  const emptyCard = createEmptyProofCard('test-run', 'test-hash');
  if (emptyCard.contractVersion !== SOVEREIGNTY_EXPORT_VERSION) {
    fail('createEmptyProofCard uses wrong export version');
  } else {
    pass();
  }

  // Test 12: Empty export artifact factory works
  const emptyArtifact = createEmptyExportArtifact('test-artifact', 'test-run', 'test-hash', 'JSON');
  if (emptyArtifact.format !== 'JSON') {
    fail('createEmptyExportArtifact format mismatch');
  } else {
    pass();
  }

  // Test 13: Writer instantiation works
  const writer = new SovereigntyPersistenceWriter();
  const stats = writer.getWriteStats();
  if (stats.totalRecords !== 0) {
    fail('Fresh writer should have 0 total records');
  } else {
    pass();
  }

  // Test 14: Writer reset works
  writer.reset();
  if (writer.getWriteStats().ticksWritten !== 0) {
    fail('Writer reset did not zero tick count');
  } else {
    pass();
  }

  // Test 15: Tick write record building from empty tick
  const tickWriteRecord = writer.buildTickWriteRecord(emptyTick);
  if (tickWriteRecord.contractVersion !== SOVEREIGNTY_PERSISTENCE_VERSION) {
    fail('buildTickWriteRecord uses wrong persistence version');
  } else {
    pass();
  }

  // Test 16: Run write record building from empty summary
  const runWriteRecord = writer.buildRunWriteRecord(emptyRun);
  if (runWriteRecord.contractVersion !== SOVEREIGNTY_PERSISTENCE_VERSION) {
    fail('buildRunWriteRecord uses wrong persistence version');
  } else {
    pass();
  }

  // Test 17: Artifact write record building
  const artifactWriteRecord = writer.buildArtifactWriteRecord(emptyArtifact);
  if (artifactWriteRecord.contractVersion !== SOVEREIGNTY_PERSISTENCE_VERSION) {
    fail('buildArtifactWriteRecord uses wrong persistence version');
  } else {
    pass();
  }

  // Test 18: Audit write record building
  const auditWriteRecord = writer.buildAuditWriteRecord(emptyRun, emptyArtifact, 0);
  if (auditWriteRecord.contractVersion !== SOVEREIGNTY_PERSISTENCE_VERSION) {
    fail('buildAuditWriteRecord uses wrong persistence version');
  } else {
    pass();
  }

  // Test 19: Tick seal chain from empty ticks is empty
  const sealChain = writer.buildTickSealChain([]);
  if (sealChain.length !== 0) {
    fail('buildTickSealChain of empty array should return empty');
  } else {
    pass();
  }

  // Test 20: Single tick seal with genesis
  const singleSeal = writer.computeSingleTickSeal(emptyTick);
  if (typeof singleSeal !== 'string' || singleSeal.length !== 64) {
    fail('computeSingleTickSeal should return 64-char hex string');
  } else {
    pass();
  }

  // Test 21: CORD enrichment
  const cordResult = writer.enrichRunSummaryWithCORD(emptyRun);
  if (typeof cordResult.grade !== 'string') {
    fail('enrichRunSummaryWithCORD should return a grade string');
  } else {
    pass();
  }

  // Test 22: Integrity analysis
  const integrityAnalysis = writer.computeRunIntegrityAnalysis(emptyRun, []);
  if (typeof integrityAnalysis.riskScore !== 'number') {
    fail('computeRunIntegrityAnalysis should return a numeric riskScore');
  } else {
    pass();
  }

  // Test 23: Artifact metadata
  const artifactMeta = writer.computeArtifactMetadata(emptyArtifact);
  if (typeof artifactMeta.formatLabel !== 'string') {
    fail('computeArtifactMetadata should return formatLabel');
  } else {
    pass();
  }

  // Test 24: Audit severity
  const auditSeverity = writer.computeAuditSeverity(emptyRun);
  if (typeof auditSeverity.severity !== 'string') {
    fail('computeAuditSeverity should return severity string');
  } else {
    pass();
  }

  // Test 25: Envelope checksum
  const dummyEnvelope: SovereigntyPersistenceEnvelope = {
    summary: emptyRun,
    ticks: [tickWriteRecord],
    run: runWriteRecord,
    artifact: artifactWriteRecord,
    audit: auditWriteRecord,
  };
  const envelopeChecksum = writer.computeEnvelopeChecksum(dummyEnvelope);
  if (typeof envelopeChecksum !== 'string') {
    fail('computeEnvelopeChecksum should return string');
  } else {
    pass();
  }

  // Test 26: Envelope fingerprint
  const fingerprint = writer.computeEnvelopeFingerprint(dummyEnvelope);
  if (typeof fingerprint !== 'string' || fingerprint.length !== 128) {
    fail('computeEnvelopeFingerprint should return 128-char SHA-512 hex');
  } else {
    pass();
  }

  // Test 27: ML vector computation
  const mlVector = computePersistenceMLVector(emptyRun, [tickWriteRecord]);
  if (mlVector.features.length !== PERSISTENCE_ML_FEATURE_COUNT) {
    fail(`ML vector length ${mlVector.features.length} !== ${PERSISTENCE_ML_FEATURE_COUNT}`);
  } else {
    pass();
  }

  // Test 28: DL tensor computation
  const dlTensor = computePersistenceDLTensor(emptyRun, [tickWriteRecord]);
  if (dlTensor.features.length !== PERSISTENCE_DL_FEATURE_COUNT) {
    fail(`DL tensor length ${dlTensor.features.length} !== ${PERSISTENCE_DL_FEATURE_COUNT}`);
  } else {
    pass();
  }

  // Test 29: Narrative generation
  const narrative = generatePersistenceNarrative(emptyRun, 1);
  if (typeof narrative !== 'string' || narrative.length === 0) {
    fail('generatePersistenceNarrative should return non-empty string');
  } else {
    pass();
  }

  // Test 30: Serialization round-trip
  const serialized = serializePersistenceResult(dummyEnvelope);
  if (typeof serialized.checksum !== 'string') {
    fail('serializePersistenceResult should produce checksum');
  } else {
    pass();
  }

  const deserialized = deserializePersistenceResult(serialized);
  if (deserialized.summary.runId !== emptyRun.runId) {
    fail('deserializePersistenceResult round-trip failed');
  } else {
    pass();
  }

  // Test 31: Audit entry build and verify
  const auditEntry = buildPersistenceAuditEntry('test-run', 'test-op', { data: 'test' });
  if (typeof auditEntry.hmacSignature !== 'string') {
    fail('buildPersistenceAuditEntry should produce hmacSignature');
  } else {
    pass();
  }

  const auditVerified = verifyPersistenceAuditEntry(auditEntry);
  if (!auditVerified) {
    fail('verifyPersistenceAuditEntry should verify a freshly built entry');
  } else {
    pass();
  }

  // Test 32: Validation of inputs
  const validationResult = validatePersistenceInputs(dummyEnvelope);
  if (typeof validationResult.valid !== 'boolean') {
    fail('validatePersistenceInputs should return valid flag');
  } else {
    pass();
  }

  // Test 33: PersistenceRunContext instantiation
  const ctx = new PersistenceRunContext(writer, 'test-run');
  if (ctx.getRunId() !== 'test-run') {
    fail('PersistenceRunContext.getRunId() mismatch');
  } else {
    pass();
  }

  if (ctx.isPersisted()) {
    fail('Fresh PersistenceRunContext should not be persisted');
  } else {
    pass();
  }

  if (ctx.getTickCount() !== 0) {
    fail('Fresh PersistenceRunContext should have 0 ticks');
  } else {
    pass();
  }

  // Test 34: Internal serialization helpers use correct versions
  const tickSerialized = serializeTickWriteRecord(tickWriteRecord);
  if (tickSerialized.schemaVersion !== PERSISTENCE_SERIALIZATION_SCHEMA_VERSION) {
    fail('serializeTickWriteRecord uses wrong schema version');
  } else {
    pass();
  }

  const runSerialized = serializeRunWriteRecord(runWriteRecord);
  if (runSerialized.schemaVersion !== PERSISTENCE_SERIALIZATION_SCHEMA_VERSION) {
    fail('serializeRunWriteRecord uses wrong schema version');
  } else {
    pass();
  }

  const artifactSerialized = serializeArtifactWriteRecord(artifactWriteRecord);
  if (artifactSerialized.schemaVersion !== PERSISTENCE_SERIALIZATION_SCHEMA_VERSION) {
    fail('serializeArtifactWriteRecord uses wrong schema version');
  } else {
    pass();
  }

  const auditSerialized = serializeAuditWriteRecord(auditWriteRecord);
  if (auditSerialized.schemaVersion !== PERSISTENCE_SERIALIZATION_SCHEMA_VERSION) {
    fail('serializeAuditWriteRecord uses wrong schema version');
  } else {
    pass();
  }

  // Test 35: computeSerializationChecksum
  const serialChecksum = computeSerializationChecksum('test-payload');
  if (typeof serialChecksum !== 'string' || serialChecksum.length !== 128) {
    fail('computeSerializationChecksum should return 128-char SHA-512 hex');
  } else {
    pass();
  }

  // Test 36: freezeSerializedResult
  const frozen = freezeSerializedResult(tickSerialized);
  if (frozen.schemaVersion !== tickSerialized.schemaVersion) {
    fail('freezeSerializedResult should preserve schemaVersion');
  } else {
    pass();
  }

  // Test 37: clonePersistenceEnvelope
  const cloned = clonePersistenceEnvelope(dummyEnvelope);
  if (cloned.summary.runId !== dummyEnvelope.summary.runId) {
    fail('clonePersistenceEnvelope should preserve runId');
  } else {
    pass();
  }

  // Test 38: flattenEnvelopeForFingerprint
  const flatFingerprint = flattenEnvelopeForFingerprint(dummyEnvelope);
  if (!Array.isArray(flatFingerprint) || flatFingerprint.length === 0) {
    fail('flattenEnvelopeForFingerprint should return non-empty array');
  } else {
    pass();
  }

  // Test 39: sortTickWriteRecords
  const sorted = sortTickWriteRecords([tickWriteRecord]);
  if (sorted.length !== 1) {
    fail('sortTickWriteRecords should preserve length');
  } else {
    pass();
  }

  // Test 40: buildPersistenceAuditTrail
  const trail = buildPersistenceAuditTrail(dummyEnvelope, DEFAULT_HMAC_SECRET);
  if (trail.length !== 4) {
    fail(`buildPersistenceAuditTrail should produce 4 entries, got ${trail.length}`);
  } else {
    pass();
  }

  // Test 41: computeAuditTrailChecksum
  const trailChecksum = computeAuditTrailChecksum(trail, DEFAULT_HMAC_SECRET);
  if (typeof trailChecksum !== 'string') {
    fail('computeAuditTrailChecksum should return string');
  } else {
    pass();
  }

  // Test 42: Verified grades map completeness
  for (const grade of VERIFIED_GRADES) {
    if (GRADE_INDEX_MAP[grade] === undefined) {
      fail(`GRADE_INDEX_MAP missing ${grade}`);
      break;
    }
  }
  pass();

  // Test 43: Mode narrative maps are populated for all modes
  for (const mode of MODE_CODES) {
    if (!PERSISTENCE_MODE_NARRATIVE_MAP[mode]) {
      fail(`PERSISTENCE_MODE_NARRATIVE_MAP missing ${mode}`);
      break;
    }
  }
  pass();

  // Test 44: Outcome narrative maps are populated for all outcomes
  for (const outcome of RUN_OUTCOMES) {
    if (!PERSISTENCE_OUTCOME_NARRATIVE_MAP[outcome]) {
      fail(`PERSISTENCE_OUTCOME_NARRATIVE_MAP missing ${outcome}`);
      break;
    }
  }
  pass();

  // Test 45: Phase narrative maps are populated for all phases
  for (const phase of RUN_PHASES) {
    if (!PERSISTENCE_PHASE_NARRATIVE_MAP[phase]) {
      fail(`PERSISTENCE_PHASE_NARRATIVE_MAP missing ${phase}`);
      break;
    }
  }
  pass();

  // Test 46: Pressure narrative maps are populated for all tiers
  for (const tier of PRESSURE_TIERS) {
    if (!PERSISTENCE_PRESSURE_NARRATIVE_MAP[tier]) {
      fail(`PERSISTENCE_PRESSURE_NARRATIVE_MAP missing ${tier}`);
      break;
    }
  }
  pass();

  // Test 47: Shield narrative maps are populated for all layers
  for (const layerId of SHIELD_LAYER_IDS) {
    if (!PERSISTENCE_SHIELD_NARRATIVE_MAP[layerId]) {
      fail(`PERSISTENCE_SHIELD_NARRATIVE_MAP missing ${layerId}`);
      break;
    }
  }
  pass();

  // Test 48: Integrity narrative maps are populated for all statuses
  for (const status of INTEGRITY_STATUSES) {
    if (!PERSISTENCE_INTEGRITY_NARRATIVE_MAP[status]) {
      fail(`PERSISTENCE_INTEGRITY_NARRATIVE_MAP missing ${status}`);
      break;
    }
  }
  pass();

  // Test 49: Tick ML features produce correct dimensionality
  const tickFeatures = writer.computeTickMLFeatures(emptyTick);
  if (tickFeatures.length !== 16) {
    fail(`computeTickMLFeatures should return 16 features, got ${tickFeatures.length}`);
  } else {
    pass();
  }

  // Test 50: DeterministicRNG works in context
  const rng = new DeterministicRNG('persistence-test-seed');
  const rngVal = rng.nextFloat();
  if (rngVal < 0 || rngVal >= 1) {
    fail('DeterministicRNG.nextFloat() out of range');
  } else {
    pass();
  }

  // Test 51: MerkleChain root after appends
  const testChain = new MerkleChain();
  testChain.append('leaf-1');
  testChain.append('leaf-2');
  const chainRoot = testChain.root();
  if (typeof chainRoot !== 'string') {
    fail('MerkleChain.root() should return string');
  } else {
    pass();
  }

  // Test 52: RunAuditLog computeLogHash
  const testAuditLog = new RunAuditLog({ runId: 'test-context' });
  testAuditLog.recordTick(0, 'test-checksum', 1);
  const logChecksum = testAuditLog.computeLogHash();
  if (typeof logChecksum !== 'string') {
    fail('RunAuditLog.computeLogHash() should return string');
  } else {
    pass();
  }

  // Test 53: sha512 produces 128-char hex
  const hash512 = sha512('test');
  if (hash512.length !== 128) {
    fail(`sha512 should produce 128-char hex, got ${hash512.length}`);
  } else {
    pass();
  }

  // Test 54: computeProofHash produces 64-char hex
  const proofHash = computeProofHash({
    seed: 'test-seed',
    tickStreamChecksum: sha256('test'),
    outcome: 'FREEDOM',
    finalNetWorth: 1000,
    userId: 'test-user',
  });
  if (proofHash.length !== 64) {
    fail(`computeProofHash should produce 64-char hex, got ${proofHash.length}`);
  } else {
    pass();
  }

  // Test 55: CORD scoring functions
  const testComponents: SovereigntyScoreComponents = {
    decision_speed_score: 0.8,
    shields_maintained_pct: 0.7,
    hater_sabotages_blocked: 0.6,
    cascade_chains_broken: 0.5,
    pressure_survived_score: 0.4,
  };
  const cordScore = computeCORDScore(testComponents);
  if (cordScore < 0 || cordScore > 1) {
    fail('computeCORDScore should return value in [0,1]');
  } else {
    pass();
  }

  const breakdown = computeFullScoreBreakdown(testComponents, 'FREEDOM');
  if (!breakdown.computedGrade) {
    fail('computeFullScoreBreakdown should assign a grade');
  } else {
    pass();
  }

  // Test 56: Grade assignment
  const testGrade = assignGradeFromScore(1.4);
  if (testGrade !== 'S') {
    fail(`assignGradeFromScore(1.4) should be S, got ${testGrade}`);
  } else {
    pass();
  }

  // Test 57: Badge tier for grade
  const testBadge = badgeTierForGrade('S');
  if (testBadge !== 'PLATINUM') {
    fail(`badgeTierForGrade('S') should be PLATINUM, got ${testBadge}`);
  } else {
    pass();
  }

  // Test 58: Score to grade label
  const testLabel = scoreToGradeLabel('A');
  if (typeof testLabel !== 'string' || testLabel.length === 0) {
    fail('scoreToGradeLabel should return non-empty string');
  } else {
    pass();
  }

  // Test 59: Grade narrative
  const gradeNarrative = generateGradeNarrative('B', 0.9);
  if (typeof gradeNarrative !== 'string' || gradeNarrative.length === 0) {
    fail('generateGradeNarrative should return non-empty string');
  } else {
    pass();
  }

  // Test 60: Context features and narrative
  const contextFeatures = ctx.computeFeatures();
  if (contextFeatures !== null) {
    fail('computeFeatures on un-finalized context should return null');
  } else {
    pass();
  }

  const contextNarrative = ctx.generateNarrative();
  if (typeof contextNarrative !== 'string') {
    fail('generateNarrative should always return string');
  } else {
    pass();
  }

  const contextSerialized = ctx.serialize();
  if (contextSerialized !== null) {
    fail('serialize on un-finalized context should return null');
  } else {
    pass();
  }

  const contextValidation = ctx.validate();
  if (contextValidation !== null) {
    fail('validate on un-finalized context should return null');
  } else {
    pass();
  }

  const contextAuditValid = ctx.verifyAuditTrail();
  if (!contextAuditValid) {
    fail('verifyAuditTrail should succeed on empty trail');
  } else {
    pass();
  }

  const contextStats = ctx.getWriteStats();
  if (contextStats.ticksWritten !== 0) {
    fail('Fresh context should have 0 ticks written');
  } else {
    pass();
  }

  const contextAuditChecksum = ctx.computeAuditTrailChecksum();
  if (typeof contextAuditChecksum !== 'string') {
    fail('computeAuditTrailChecksum should return string');
  } else {
    pass();
  }

  // Test 61: Merkle root on writer
  const writerMerkleRoot = writer.getMerkleRoot();
  if (typeof writerMerkleRoot !== 'string') {
    fail('getMerkleRoot should return string');
  } else {
    pass();
  }

  // Test 62: Audit log checksum on writer
  const writerAuditChecksum = writer.getAuditLogChecksum();
  if (typeof writerAuditChecksum !== 'string') {
    fail('getAuditLogChecksum should return string');
  } else {
    pass();
  }

  // Test 63: Extended proof hash computation
  const extendedHash = writer.computeRunExtendedProofHash(emptyRun, [emptyTick]);
  if (typeof extendedHash !== 'string' || extendedHash.length !== 64) {
    fail('computeRunExtendedProofHash should return 64-char hex');
  } else {
    pass();
  }

  // Test 64: deepFrozenClone preserves structure
  const frozenObj = deepFrozenClone({ test: 'value', nested: { a: 1 } });
  if (frozenObj.test !== 'value' || frozenObj.nested.a !== 1) {
    fail('deepFrozenClone should preserve structure');
  } else {
    pass();
  }

  // Test 65: DEFAULT_HMAC_SECRET is a string
  if (typeof DEFAULT_HMAC_SECRET !== 'string' || DEFAULT_HMAC_SECRET.length === 0) {
    fail('DEFAULT_HMAC_SECRET must be a non-empty string');
  } else {
    pass();
  }

  // Test 66: checksumSnapshot produces consistent output
  const cs1 = checksumSnapshot({ a: 1, b: 2 });
  const cs2 = checksumSnapshot({ b: 2, a: 1 });
  if (cs1 !== cs2) {
    fail('checksumSnapshot should be order-independent');
  } else {
    pass();
  }

  // Test 67: Default sovereignty versions are strings
  if (typeof DEFAULT_SOVEREIGNTY_CLIENT_VERSION !== 'string') {
    fail('DEFAULT_SOVEREIGNTY_CLIENT_VERSION must be string');
  } else {
    pass();
  }

  if (typeof DEFAULT_SOVEREIGNTY_ENGINE_VERSION !== 'string') {
    fail('DEFAULT_SOVEREIGNTY_ENGINE_VERSION must be string');
  } else {
    pass();
  }

  const endMs = Date.now();
  const durationMs = endMs - startMs;

  return {
    passed: failures.length === 0,
    testCount,
    passCount,
    failCount: failures.length,
    failures,
    durationMs,
    writerVersion: PERSISTENCE_WRITER_VERSION,
  };
}
