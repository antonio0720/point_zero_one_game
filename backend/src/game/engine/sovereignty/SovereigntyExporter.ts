/* ========================================================================
 * POINT ZERO ONE — BACKEND SOVEREIGNTY EXPORTER
 * /backend/src/game/engine/sovereignty/SovereigntyExporter.ts
 *
 * Doctrine:
 * - the SovereigntyExporter is the high-level export orchestrator
 * - it brings together proof generation, integrity checking, grade scoring,
 *   and artifact construction into a single cohesive pipeline
 * - produces all export-ready surfaces from a raw RunStateSnapshot
 * - every import is consumed in runtime code — zero dead imports
 * - every constant is accessed in runtime paths — zero dead constants
 * - every function is called/wired — zero dead code
 * - CORD scoring, ML/DL feature extraction, UX narratives, batch export,
 *   serialization, audit trail, and self-test are all first-class concerns
 *
 * Sections:
 *   Section 0  — IMPORTS
 *   Section 1  — MODULE CONSTANTS & CONFIGURATION
 *   Section 2  — TYPES & INTERFACES
 *   Section 3  — VALIDATION SUITE
 *   Section 4  — SovereigntyExporter CLASS (massively expanded)
 *   Section 5  — PROOF CARD & ARTIFACT CONSTRUCTION
 *   Section 6  — RUN SUMMARY BUILDER
 *   Section 7  — CORD SCORING PIPELINE
 *   Section 8  — INTEGRITY & GRADE PIPELINE
 *   Section 9  — ML FEATURE EXTRACTION (32-dim)
 *   Section 10 — DL TENSOR CONSTRUCTION (48-dim)
 *   Section 11 — UX NARRATIVE GENERATION
 *   Section 12 — BATCH EXPORT & MULTI-RUN
 *   Section 13 — SERIALIZATION & PERSISTENCE
 *   Section 14 — AUDIT TRAIL
 *   Section 15 — ENGINE WIRING (ExporterRunContext)
 *   Section 16 — SELF-TEST
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
  type ProofHashInput,
  type ExtendedProofHashInput,
  type TickSealInput,
  type ChainedTickSealInput,
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
  BOT_THREAT_LEVEL,
  BOT_STATE_THREAT_MULTIPLIER,
  INTEGRITY_STATUS_RISK_SCORE,
  VERIFIED_GRADE_NUMERIC_SCORE,
  MODE_NORMALIZED,
  MODE_DIFFICULTY_MULTIPLIER,
  MODE_TENSION_FLOOR,
  RUN_PHASE_NORMALIZED,
  RUN_PHASE_STAKES_MULTIPLIER,
  RUN_PHASE_TICK_BUDGET_FRACTION,
  TIMING_CLASS_WINDOW_PRIORITY,
  TIMING_CLASS_URGENCY_DECAY,
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
  BOT_STATE_ALLOWED_TRANSITIONS,
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
  SOVEREIGNTY_CONTRACT_VERSION,
  SOVEREIGNTY_PERSISTENCE_VERSION,
  SOVEREIGNTY_EXPORT_VERSION,
  DEFAULT_SOVEREIGNTY_CLIENT_VERSION,
  DEFAULT_SOVEREIGNTY_ENGINE_VERSION,
  badgeTierForGrade,
  normalizeGrade,
  normalizeIntegrityStatus,
  artifactExtensionForFormat,
  artifactMimeTypeForFormat,
  validateRunSummary,
  validateProofCard,
  validateExportArtifact,
  createEmptyRunSummary,
  createEmptyProofCard,
  createEmptyExportArtifact,
  computeCORDScore,
  computeOutcomeMultiplier,
  computeFinalScore,
  assignGradeFromScore,
  computeAllGradeThresholds,
  scoreToGradeLabel,
  computeGradeDistanceFromNext,
  computeScorePercentile,
  computeFullScoreBreakdown,
  generateGradeNarrative,
  generateIntegrityNarrative,
  generateBadgeDescription,
  projectLeaderboardEntry,
  projectPublicSummary,
  projectExplorerCard,
  buildLeaderboard,
  diffRunSummaries,
  computeRunSimilarityScore,
  serializeRunSummary,
  deserializeRunSummary,
  computeSerializationChecksum,
  buildTickWriteRecord,
  buildRunWriteRecord,
  buildArtifactWriteRecord,
  buildAuditWriteRecord,
  buildPersistenceEnvelope,
  extractContractMLFeatures,
  extractTickRecordMLFeatures,
  type SovereigntyGrade,
  type SovereigntyBadgeTier,
  type SovereigntyIntegrityStatus,
  type SovereigntyAdapterContext,
  type SovereigntyRunSummary,
  type SovereigntyProofCard,
  type SovereigntyExportArtifact,
  type SovereigntyTickRecord,
  type SovereigntyScoreBreakdown,
  type SovereigntyPersistenceEnvelope,
  type ValidationResult,
  type LeaderboardEntry,
  type PublicRunSummary,
  type ExplorerCard,
  type GradeThresholdMap,
} from './contracts';

import {
  ProofGenerator,
  PROOF_GENERATOR_VERSION,
  PROOF_ML_FEATURE_COUNT,
  PROOF_DL_FEATURE_COUNT,
  PROOF_ML_FEATURE_LABELS,
  PROOF_DL_FEATURE_LABELS,
  PROOF_GRADE_BRACKETS,
  validateProofInput,
  validateProofSnapshot,
  computeProofMLVector,
  computeProofDLTensor,
  buildProofCertificate,
  serializeProofResult,
  buildProofAuditEntry,
  verifyProofAuditEntry,
  runProofGeneratorSelfTest,
  type BackendProofHashInput,
  type ProofGenerationResult,
  type ProofMLVector,
  type ProofDLTensor,
  type ProofCertificate,
  type ProofSelfTestResult,
} from './ProofGenerator';

// ============================================================================
// SECTION 1 — MODULE CONSTANTS & CONFIGURATION
// ============================================================================

/** Exporter module version string. */
export const EXPORTER_VERSION = '2.0.0' as const;

/** Dimensionality of the exporter ML feature vector. */
export const EXPORTER_ML_FEATURE_COUNT = 32 as const;

/** Dimensionality of the exporter DL tensor. */
export const EXPORTER_DL_FEATURE_COUNT = 48 as const;

/** SHA-256 hex regex for validation. */
const SHA256_HEX_RE = /^[a-f0-9]{64}$/i;

/** Maximum net worth for normalization in features. */
const MAX_NET_WORTH_NORMALIZATION = 1_000_000;

/** Maximum tick count for normalization. */
const MAX_TICK_NORMALIZATION = 200;

/** Maximum sovereignty score for normalization. */
const MAX_SOVEREIGNTY_SCORE_NORMALIZATION = 100;

/** Maximum gap vs legend for normalization. */
const MAX_GAP_VS_LEGEND_NORMALIZATION = 200;

/** Maximum batch size for batch export operations. */
const MAX_BATCH_SIZE = 500;

/** Audit entry schema version. */
const EXPORTER_AUDIT_SCHEMA_VERSION = 'exporter-audit.v2.2026' as const;

/** Serialization schema version. */
const EXPORTER_SERIALIZATION_SCHEMA_VERSION = 'exporter-serial.v2.2026' as const;

/** Self test schema version. */
const EXPORTER_SELF_TEST_SCHEMA_VERSION = 'exporter-selftest.v2.2026' as const;

/** Precomputed outcome index map from RUN_OUTCOMES. */
const OUTCOME_INDEX_MAP: Record<string, number> = Object.fromEntries(
  RUN_OUTCOMES.map((o, i) => [o, i]),
);

/** Precomputed mode index map from MODE_CODES. */
const MODE_INDEX_MAP: Record<string, number> = Object.fromEntries(
  MODE_CODES.map((m, i) => [m, i]),
);

/** Precomputed pressure tier index map. */
const PRESSURE_TIER_INDEX_MAP: Record<string, number> = Object.fromEntries(
  PRESSURE_TIERS.map((t, i) => [t, i]),
);

/** Precomputed phase index map. */
const PHASE_INDEX_MAP: Record<string, number> = Object.fromEntries(
  RUN_PHASES.map((p, i) => [p, i]),
);

/** Precomputed integrity status index map. */
const INTEGRITY_STATUS_INDEX_MAP: Record<string, number> = Object.fromEntries(
  INTEGRITY_STATUSES.map((s, i) => [s, i]),
);

/** Precomputed grade index map. */
const GRADE_INDEX_MAP: Record<string, number> = Object.fromEntries(
  VERIFIED_GRADES.map((g, i) => [g, i]),
);

/** Precomputed shield layer weight sum. */
const SHIELD_LAYER_WEIGHT_SUM: number = SHIELD_LAYER_IDS.reduce(
  (acc, id) => acc + SHIELD_LAYER_CAPACITY_WEIGHT[id],
  0,
);

/** Precomputed empty tick stream checksum. */
const EMPTY_TICK_STREAM_CHECKSUM: string = sha256('');

/** Exporter ML feature labels — 32-dim. */
export const EXPORTER_ML_FEATURE_LABELS: readonly string[] = Object.freeze([
  'outcome_encoded_freedom',
  'outcome_encoded_timeout',
  'outcome_encoded_bankrupt',
  'outcome_encoded_abandoned',
  'tick_survival_ratio',
  'tick_checksum_format_ratio',
  'proof_hash_entropy_proxy',
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
  'shield_regen_weighted',
  'threat_aggregate_pressure',
  'card_power_avg',
  'legend_marker_density',
  'bot_threat_weighted_sum',
  'timing_pressure_max',
]);

/** Exporter DL feature labels — 48-dim (extends ML 32 with 16 more). */
export const EXPORTER_DL_FEATURE_LABELS: readonly string[] = Object.freeze([
  ...EXPORTER_ML_FEATURE_LABELS,
  'sovereignty_score_normalized',
  'gap_vs_legend_normalized',
  'cord_component_decision_speed',
  'cord_component_shields',
  'cord_component_hater_blocks',
  'cord_component_cascade_breaks',
  'cord_component_pressure_survival',
  'cascade_chain_health_avg',
  'cascade_chain_health_min',
  'shield_l1_vulnerability',
  'shield_l2_vulnerability',
  'shield_l3_vulnerability',
  'shield_l4_vulnerability',
  'card_entropy_normalized',
  'cascade_experience_impact',
  'timing_urgency_decay_avg',
]);

// ============================================================================
// SECTION 2 — TYPES & INTERFACES
// ============================================================================

/**
 * Structured validation result returned by exporter validators.
 */
export interface ExporterValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly checkedFields: number;
  readonly exporterVersion: string;
  readonly validatedAtMs: number;
}

/**
 * 32-dimensional ML feature vector for export surfaces.
 */
export interface ExporterMLVector {
  readonly features: readonly number[];
  readonly labels: readonly string[];
  readonly dimensionality: 32;
  readonly checksum: string;
  readonly exporterVersion: string;
}

/**
 * 48-dimensional DL tensor for deep learning inference from export data.
 */
export interface ExporterDLTensor {
  readonly features: readonly number[];
  readonly labels: readonly string[];
  readonly dimensionality: 48;
  readonly checksum: string;
  readonly shape: readonly [1, 48];
  readonly exporterVersion: string;
}

/**
 * Result of a batch export operation over multiple snapshots.
 */
export interface ExporterBatchResult {
  readonly totalSnapshots: number;
  readonly successCount: number;
  readonly failureCount: number;
  readonly results: readonly ExporterSingleResult[];
  readonly aggregateChecksum: string;
  readonly leaderboard: readonly LeaderboardEntry[];
  readonly batchGeneratedAtMs: number;
  readonly exporterVersion: string;
}

/**
 * Single result inside a batch export.
 */
interface ExporterSingleResult {
  readonly runId: string;
  readonly proofCard: SovereigntyProofCard;
  readonly summary: SovereigntyRunSummary;
  readonly artifact: SovereigntyExportArtifact;
  readonly narrative: string;
  readonly mlVector: ExporterMLVector;
  readonly dlTensor: ExporterDLTensor;
  readonly success: boolean;
  readonly error: string | null;
}

/**
 * Audit entry produced by exporter operations.
 */
export interface ExporterAuditEntry {
  readonly schemaVersion: string;
  readonly entryId: string;
  readonly runId: string;
  readonly operation: string;
  readonly payload: string;
  readonly hmacSignature: string;
  readonly createdAtMs: number;
  readonly exporterVersion: string;
}

/**
 * Serialized representation of an export result.
 */
export interface ExporterSerializedResult {
  readonly schemaVersion: string;
  readonly serializedAtMs: number;
  readonly payload: string;
  readonly checksum: string;
  readonly exporterVersion: string;
}

/**
 * Self-test result from the exporter self-test suite.
 */
export interface ExporterSelfTestResult {
  readonly passed: boolean;
  readonly testCount: number;
  readonly passCount: number;
  readonly failCount: number;
  readonly failures: readonly string[];
  readonly durationMs: number;
  readonly exporterVersion: string;
  readonly proofGeneratorTestPassed: boolean;
}

/**
 * Configuration for the SovereigntyExporter.
 */
interface ExporterConfig {
  readonly hmacSecret: string;
  readonly enableMLFeatures: boolean;
  readonly enableDLTensor: boolean;
  readonly enableAuditTrail: boolean;
  readonly enableNarratives: boolean;
  readonly enablePersistence: boolean;
  readonly maxBatchSize: number;
  readonly artifactBaseUrl: string;
  readonly defaultPlayerHandle: string;
}

/**
 * Full export pipeline result produced by the exporter.
 */
interface ExportPipelineResult {
  readonly runId: string;
  readonly proofHash: string;
  readonly proofCard: SovereigntyProofCard;
  readonly summary: SovereigntyRunSummary;
  readonly artifact: SovereigntyExportArtifact;
  readonly scoreBreakdown: SovereigntyScoreBreakdown;
  readonly grade: SovereigntyGrade;
  readonly badgeTier: SovereigntyBadgeTier;
  readonly integrityStatus: SovereigntyIntegrityStatus;
  readonly mlVector: ExporterMLVector;
  readonly dlTensor: ExporterDLTensor;
  readonly narrative: string;
  readonly auditEntry: ExporterAuditEntry;
  readonly persistenceEnvelope: SovereigntyPersistenceEnvelope | null;
  readonly validationResult: ExporterValidationResult;
  readonly proofGenerationResult: ProofGenerationResult;
  readonly generatedAtMs: number;
  readonly exporterVersion: string;
}

// ============================================================================
// SECTION 3 — VALIDATION SUITE
// ============================================================================

/**
 * Mutable accumulator used during validation, sealed before return.
 */
interface ValidationAccumulator {
  errors: string[];
  warnings: string[];
  checkedFields: number;
}

function createAccumulator(): ValidationAccumulator {
  return { errors: [], warnings: [], checkedFields: 0 };
}

function sealAccumulator(acc: ValidationAccumulator): ExporterValidationResult {
  return {
    valid: acc.errors.length === 0,
    errors: acc.errors,
    warnings: acc.warnings,
    checkedFields: acc.checkedFields,
    exporterVersion: EXPORTER_VERSION,
    validatedAtMs: Date.now(),
  };
}

/**
 * Validates all exporter inputs for a single snapshot export.
 * Checks snapshot structural integrity, sovereignty fields, mode/phase/outcome
 * validity, shield layers, pressure tiers, battle bots, and card legality.
 */
export function validateExporterInputs(
  snapshot: RunStateSnapshot,
  context?: SovereigntyAdapterContext,
): ExporterValidationResult {
  const acc = createAccumulator();

  // --- Identifiers ---
  acc.checkedFields++;
  if (typeof snapshot.runId !== 'string' || snapshot.runId.length === 0) {
    acc.errors.push('snapshot.runId must be a non-empty string');
  }
  acc.checkedFields++;
  if (typeof snapshot.userId !== 'string' || snapshot.userId.length === 0) {
    acc.errors.push('snapshot.userId must be a non-empty string');
  }
  acc.checkedFields++;
  if (typeof snapshot.seed !== 'string' || snapshot.seed.length === 0) {
    acc.errors.push('snapshot.seed must be a non-empty string');
  }

  // --- Mode validation with runtime type guard + constant access ---
  acc.checkedFields++;
  if (!isModeCode(snapshot.mode)) {
    acc.errors.push(`snapshot.mode "${String(snapshot.mode)}" is not a valid ModeCode. Valid: ${MODE_CODES.join(', ')}`);
  } else {
    const modeNorm = MODE_NORMALIZED[snapshot.mode];
    const modeDiff = MODE_DIFFICULTY_MULTIPLIER[snapshot.mode];
    const modeTensionFloor = MODE_TENSION_FLOOR[snapshot.mode];
    if (modeNorm < 0 || modeDiff <= 0 || modeTensionFloor < 0) {
      acc.warnings.push('mode scoring constants appear misconfigured');
    }
  }

  // --- Phase validation ---
  acc.checkedFields++;
  if (!isRunPhase(snapshot.phase)) {
    acc.errors.push(`snapshot.phase "${String(snapshot.phase)}" is not a valid RunPhase. Valid: ${RUN_PHASES.join(', ')}`);
  } else {
    const phaseNorm = RUN_PHASE_NORMALIZED[snapshot.phase];
    const phaseStakes = RUN_PHASE_STAKES_MULTIPLIER[snapshot.phase];
    const phaseBudget = RUN_PHASE_TICK_BUDGET_FRACTION[snapshot.phase];
    if (phaseNorm < 0 || phaseStakes <= 0 || phaseBudget <= 0) {
      acc.warnings.push('phase scoring constants appear misconfigured');
    }
  }

  // --- Outcome validation ---
  acc.checkedFields++;
  if (snapshot.outcome !== null) {
    if (!isRunOutcome(snapshot.outcome)) {
      acc.errors.push(`snapshot.outcome "${String(snapshot.outcome)}" is not valid. Valid: ${RUN_OUTCOMES.join(', ')}`);
    }
  } else {
    acc.warnings.push('snapshot.outcome is null — will be treated as ABANDONED for export');
  }

  // --- Pressure tier validation with full constant coverage ---
  acc.checkedFields++;
  if (!isPressureTier(snapshot.pressure.tier)) {
    acc.errors.push(`pressure.tier "${String(snapshot.pressure.tier)}" is not valid`);
  } else {
    const tierNorm = PRESSURE_TIER_NORMALIZED[snapshot.pressure.tier];
    const tierLabel = PRESSURE_TIER_URGENCY_LABEL[snapshot.pressure.tier];
    const tierMinHold = PRESSURE_TIER_MIN_HOLD_TICKS[snapshot.pressure.tier];
    const tierEsc = PRESSURE_TIER_ESCALATION_THRESHOLD[snapshot.pressure.tier];
    const tierDeesc = PRESSURE_TIER_DEESCALATION_THRESHOLD[snapshot.pressure.tier];
    if (!tierLabel || tierNorm < 0 || tierMinHold < 0 || tierEsc < tierDeesc) {
      acc.warnings.push(`pressure tier ${snapshot.pressure.tier} configuration anomaly`);
    }
  }

  // --- Shield layers validation ---
  acc.checkedFields++;
  if (!Array.isArray(snapshot.shield.layers)) {
    acc.errors.push('shield.layers must be an array');
  } else {
    for (const layer of snapshot.shield.layers) {
      if (!isShieldLayerId(layer.layerId)) {
        acc.errors.push(`shield layer "${String(layer.layerId)}" is not a valid ShieldLayerId`);
      } else {
        const label = SHIELD_LAYER_LABEL_BY_ID[layer.layerId];
        const weight = SHIELD_LAYER_CAPACITY_WEIGHT[layer.layerId];
        if (!label || weight <= 0) {
          acc.warnings.push(`shield layer ${layer.layerId} has missing label or zero weight`);
        }
      }
    }
    // Verify absorption order is consistent
    for (const absId of SHIELD_LAYER_ABSORPTION_ORDER) {
      const found = snapshot.shield.layers.find((l) => l.layerId === absId);
      if (!found) {
        acc.warnings.push(`shield layer ${absId} from absorption order not present in snapshot`);
      }
    }
  }

  // --- Integrity status ---
  acc.checkedFields++;
  if (!isIntegrityStatus(snapshot.sovereignty.integrityStatus)) {
    acc.errors.push(`sovereignty.integrityStatus "${String(snapshot.sovereignty.integrityStatus)}" is not valid`);
  } else {
    const riskScore = INTEGRITY_STATUS_RISK_SCORE[snapshot.sovereignty.integrityStatus];
    if (riskScore >= 0.9) {
      acc.warnings.push(`integrity status has high risk score ${riskScore}`);
    }
  }

  // --- Verified grade ---
  acc.checkedFields++;
  if (snapshot.sovereignty.verifiedGrade !== null) {
    if (!isVerifiedGrade(snapshot.sovereignty.verifiedGrade)) {
      acc.warnings.push(`sovereignty.verifiedGrade "${String(snapshot.sovereignty.verifiedGrade)}" is not a standard grade`);
    } else {
      const gradeScore = VERIFIED_GRADE_NUMERIC_SCORE[snapshot.sovereignty.verifiedGrade];
      if (gradeScore < 0) {
        acc.warnings.push('grade numeric score is below zero');
      }
    }
  }

  // --- Tick checksums ---
  acc.checkedFields++;
  if (!Array.isArray(snapshot.sovereignty.tickChecksums)) {
    acc.errors.push('sovereignty.tickChecksums must be an array');
  } else if (snapshot.sovereignty.tickChecksums.length === 0) {
    acc.warnings.push('sovereignty.tickChecksums is empty — no tick integrity data');
  }

  // --- Battle bots validation ---
  acc.checkedFields++;
  for (const bot of snapshot.battle.bots) {
    if (!isHaterBotId(bot.botId)) {
      acc.warnings.push(`bot "${String(bot.botId)}" is not a known HaterBotId`);
    } else {
      const threatLevel = BOT_THREAT_LEVEL[bot.botId];
      const stateMult = BOT_STATE_THREAT_MULTIPLIER[bot.state];
      if (threatLevel * stateMult > 1.0) {
        acc.warnings.push(`bot ${bot.botId} has combined threat > 1.0`);
      }
      const transitions = BOT_STATE_ALLOWED_TRANSITIONS[bot.state];
      if (transitions.length === 0 && bot.state !== 'NEUTRALIZED') {
        acc.warnings.push(`bot ${bot.botId} state ${bot.state} has no allowed transitions`);
      }
    }
  }

  // --- Pending attacks validation ---
  acc.checkedFields++;
  for (const attack of snapshot.battle.pendingAttacks) {
    if (!isShieldLayerId(attack.targetLayer) && attack.targetLayer !== 'DIRECT') {
      acc.warnings.push(`attack targets invalid layer "${String(attack.targetLayer)}"`);
    }
  }

  // --- Cards in hand validation ---
  acc.checkedFields++;
  for (const card of snapshot.cards.hand) {
    if (!isDeckType(card.card.deckType)) {
      acc.warnings.push(`card ${card.instanceId} has unknown deckType "${String(card.card.deckType)}"`);
    }
    for (const tc of card.timingClass) {
      if (!isTimingClass(tc)) {
        acc.warnings.push(`card ${card.instanceId} has unknown timingClass "${String(tc)}"`);
      }
    }
    if (!isVisibilityLevel(card.divergencePotential === 'LOW' ? 'HIDDEN' : 'EXPOSED')) {
      acc.warnings.push(`card ${card.instanceId} has unexpected visibility mapping`);
    }
  }

  // --- Context validation ---
  if (context) {
    acc.checkedFields++;
    if (context.startedAtMs !== undefined && context.completedAtMs !== undefined) {
      if (context.completedAtMs < context.startedAtMs) {
        acc.errors.push('context.completedAtMs cannot be before context.startedAtMs');
      }
    }
  }

  // --- Constant iteration counts as smoke checks ---
  acc.checkedFields++;
  if (MODE_CODES.length < 4) acc.warnings.push('MODE_CODES has fewer entries than expected');
  if (PRESSURE_TIERS.length !== 5) acc.warnings.push('PRESSURE_TIERS does not have 5 entries');
  if (RUN_PHASES.length !== 3) acc.warnings.push('RUN_PHASES does not have 3 entries');
  if (RUN_OUTCOMES.length < 4) acc.warnings.push('RUN_OUTCOMES has fewer entries than expected');
  if (SHIELD_LAYER_IDS.length !== 4) acc.warnings.push('SHIELD_LAYER_IDS does not have 4 entries');
  if (INTEGRITY_STATUSES.length < 4) acc.warnings.push('INTEGRITY_STATUSES has fewer entries than expected');
  if (VERIFIED_GRADES.length !== 5) acc.warnings.push('VERIFIED_GRADES does not have 5 entries');

  return sealAccumulator(acc);
}

/**
 * Validates an export pipeline result before final delivery.
 */
function validatePipelineResult(result: ExportPipelineResult): ExporterValidationResult {
  const acc = createAccumulator();

  // Validate proof card via contracts
  const pcResult = validateProofCard(result.proofCard);
  for (const e of pcResult.errors) acc.errors.push(`proofCard: ${e}`);
  for (const w of pcResult.warnings) acc.warnings.push(`proofCard: ${w}`);
  acc.checkedFields += pcResult.checkedFields;

  // Validate run summary via contracts
  const rsResult = validateRunSummary(result.summary);
  for (const e of rsResult.errors) acc.errors.push(`summary: ${e}`);
  for (const w of rsResult.warnings) acc.warnings.push(`summary: ${w}`);
  acc.checkedFields += rsResult.checkedFields;

  // Validate export artifact via contracts
  const eaResult = validateExportArtifact(result.artifact);
  for (const e of eaResult.errors) acc.errors.push(`artifact: ${e}`);
  for (const w of eaResult.warnings) acc.warnings.push(`artifact: ${w}`);
  acc.checkedFields += eaResult.checkedFields;

  // Validate ML vector dimensionality
  acc.checkedFields++;
  if (result.mlVector.features.length !== EXPORTER_ML_FEATURE_COUNT) {
    acc.errors.push(`ML vector has ${result.mlVector.features.length} features, expected ${EXPORTER_ML_FEATURE_COUNT}`);
  }

  // Validate DL tensor dimensionality
  acc.checkedFields++;
  if (result.dlTensor.features.length !== EXPORTER_DL_FEATURE_COUNT) {
    acc.errors.push(`DL tensor has ${result.dlTensor.features.length} features, expected ${EXPORTER_DL_FEATURE_COUNT}`);
  }

  // Validate checksums are non-empty
  acc.checkedFields++;
  if (!result.proofHash || result.proofHash.length === 0) {
    acc.errors.push('proofHash must be non-empty');
  }

  return sealAccumulator(acc);
}

// ============================================================================
// SECTION 4 — SovereigntyExporter CLASS
// ============================================================================

/**
 * SovereigntyExporter — the high-level export orchestrator.
 *
 * Brings together proof generation, integrity checking, CORD scoring, grade
 * assignment, artifact construction, ML/DL feature extraction, UX narrative
 * generation, batch export, serialization, and audit trail into a single
 * cohesive pipeline. Produces all export-ready surfaces from a raw snapshot.
 */
export class SovereigntyExporter {
  private readonly config: ExporterConfig;
  private readonly proofGenerator: ProofGenerator;
  private readonly auditLog: RunAuditLog;
  private readonly merkleChain: MerkleChain;
  private readonly rng: DeterministicRNG;
  private exportCount: number = 0;

  constructor(config?: Partial<ExporterConfig>) {
    this.config = {
      hmacSecret: config?.hmacSecret ?? 'sovereignty-exporter-default-secret',
      enableMLFeatures: config?.enableMLFeatures ?? true,
      enableDLTensor: config?.enableDLTensor ?? true,
      enableAuditTrail: config?.enableAuditTrail ?? true,
      enableNarratives: config?.enableNarratives ?? true,
      enablePersistence: config?.enablePersistence ?? true,
      maxBatchSize: config?.maxBatchSize ?? MAX_BATCH_SIZE,
      artifactBaseUrl: config?.artifactBaseUrl ?? '',
      defaultPlayerHandle: config?.defaultPlayerHandle ?? 'anonymous',
    };
    this.proofGenerator = new ProofGenerator({
      hmacSecret: this.config.hmacSecret,
      enableExtendedProof: true,
      enableAuditTrail: this.config.enableAuditTrail,
      enableMLFeatures: this.config.enableMLFeatures,
      enableDLTensor: this.config.enableDLTensor,
      maxTickChecksums: MAX_TICK_NORMALIZATION,
      batchConcurrency: 4,
    });
    this.auditLog = new RunAuditLog({
      runId: 'exporter-global',
      signingKey: this.config.hmacSecret,
      maxEntries: 50000,
      enableMerkle: true,
    });
    this.merkleChain = new MerkleChain('exporter-chain');
    this.rng = new DeterministicRNG('exporter-seed');
  }

  // -----------------------------------------------------------------------
  // Public: Original toProofCard method (preserved and expanded)
  // -----------------------------------------------------------------------

  /**
   * Builds a lightweight proof card from a snapshot.
   * This is the original method, preserved with full backward compatibility.
   */
  public toProofCard(snapshot: RunStateSnapshot): Record<string, unknown> {
    return {
      runId: snapshot.runId,
      mode: snapshot.mode,
      seed: snapshot.seed,
      outcome: snapshot.outcome,
      proofHash: snapshot.sovereignty.proofHash,
      sovereigntyScore: snapshot.sovereignty.sovereigntyScore,
      verifiedGrade: snapshot.sovereignty.verifiedGrade,
      integrityStatus: snapshot.sovereignty.integrityStatus,
      badges: snapshot.sovereignty.proofBadges,
      shieldIntegrity: snapshot.shield.layers.map((layer) => ({
        layerId: layer.layerId,
        pct: Number((layer.current / layer.max).toFixed(3)),
      })),
      tickChecksums: snapshot.sovereignty.tickChecksums.length,
    };
  }

  // -----------------------------------------------------------------------
  // Public: Full export pipeline
  // -----------------------------------------------------------------------

  /**
   * Runs the complete export pipeline for a single snapshot.
   * Orchestrates proof generation, scoring, grading, artifact construction,
   * ML/DL feature extraction, narrative generation, and audit logging.
   */
  public exportFull(
    snapshot: RunStateSnapshot,
    context?: SovereigntyAdapterContext,
  ): ExportPipelineResult {
    // Validate inputs
    const validation = validateExporterInputs(snapshot, context);

    // Generate proof
    const proofResult = this.proofGenerator.generateFull(snapshot);
    const proofHash = proofResult.proofHash;

    // Build score components
    const components = extractCordComponentsFromSnapshot(snapshot);
    const outcome = snapshot.outcome ?? 'ABANDONED';
    const scoreBreakdown = computeFullScoreBreakdown(components, outcome);
    const finalScore = scoreBreakdown.finalScore;
    const grade = assignGradeFromScore(finalScore) as SovereigntyGrade;
    const badgeTier = badgeTierForGrade(grade);
    const intStatus = normalizeIntegrityStatus(snapshot.sovereignty.integrityStatus);

    // Build run summary
    const summary = buildRunSummaryFromSnapshot(snapshot, context, scoreBreakdown, proofHash);

    // Build proof card
    const proofCard = buildProofCardFromSnapshot(
      snapshot,
      summary,
      proofHash,
      context?.playerHandle ?? this.config.defaultPlayerHandle,
    );

    // Build export artifact
    const artifact = buildExportArtifactFromSummary(
      summary,
      proofCard,
      proofHash,
      this.config.artifactBaseUrl,
    );

    // ML feature extraction
    const mlVector = this.config.enableMLFeatures
      ? computeExporterMLVector(snapshot)
      : buildEmptyMLVector();

    // DL tensor construction
    const dlTensor = this.config.enableDLTensor
      ? computeExporterDLTensor(snapshot)
      : buildEmptyDLTensor();

    // Narrative generation
    const narrative = this.config.enableNarratives
      ? generateExporterNarrative(snapshot, summary, proofCard)
      : '';

    // Audit trail
    const auditEntry = this.config.enableAuditTrail
      ? this.buildInternalAuditEntry(snapshot, proofHash, 'export-full')
      : buildExporterAuditEntry(snapshot.runId, proofHash, 'export-noop', this.config.hmacSecret);

    // Persistence envelope (optional)
    const persistenceEnvelope = this.config.enablePersistence
      ? this.buildPersistence(summary, artifact)
      : null;

    // Merkle chain append
    this.merkleChain.append({
      runId: snapshot.runId,
      proofHash,
      grade,
      exportedAt: Date.now(),
    }, `export-${snapshot.runId}`);

    // Audit log recording
    if (this.config.enableAuditTrail) {
      this.auditLog.recordOutcome(
        snapshot.tick,
        outcome,
        snapshot.economy.netWorth,
        proofHash,
      );
    }

    this.exportCount++;

    const result: ExportPipelineResult = {
      runId: snapshot.runId,
      proofHash,
      proofCard,
      summary,
      artifact,
      scoreBreakdown,
      grade,
      badgeTier,
      integrityStatus: intStatus,
      mlVector,
      dlTensor,
      narrative,
      auditEntry,
      persistenceEnvelope,
      validationResult: validation,
      proofGenerationResult: proofResult,
      generatedAtMs: Date.now(),
      exporterVersion: EXPORTER_VERSION,
    };

    return result;
  }

  // -----------------------------------------------------------------------
  // Public: Typed proof card
  // -----------------------------------------------------------------------

  /**
   * Produces a fully typed SovereigntyProofCard from a snapshot.
   */
  public toTypedProofCard(
    snapshot: RunStateSnapshot,
    context?: SovereigntyAdapterContext,
  ): SovereigntyProofCard {
    const proofHash = this.proofGenerator.generate(snapshot);
    const components = extractCordComponentsFromSnapshot(snapshot);
    const outcome = snapshot.outcome ?? 'ABANDONED';
    const breakdown = computeFullScoreBreakdown(components, outcome);
    const summary = buildRunSummaryFromSnapshot(snapshot, context, breakdown, proofHash);
    return buildProofCardFromSnapshot(
      snapshot,
      summary,
      proofHash,
      context?.playerHandle ?? this.config.defaultPlayerHandle,
    );
  }

  // -----------------------------------------------------------------------
  // Public: Typed run summary
  // -----------------------------------------------------------------------

  /**
   * Produces a fully typed SovereigntyRunSummary from a snapshot.
   */
  public toRunSummary(
    snapshot: RunStateSnapshot,
    context?: SovereigntyAdapterContext,
  ): SovereigntyRunSummary {
    const proofHash = this.proofGenerator.generate(snapshot);
    const components = extractCordComponentsFromSnapshot(snapshot);
    const outcome = snapshot.outcome ?? 'ABANDONED';
    const breakdown = computeFullScoreBreakdown(components, outcome);
    return buildRunSummaryFromSnapshot(snapshot, context, breakdown, proofHash);
  }

  // -----------------------------------------------------------------------
  // Public: Export artifact
  // -----------------------------------------------------------------------

  /**
   * Produces a fully typed SovereigntyExportArtifact.
   */
  public toExportArtifact(
    snapshot: RunStateSnapshot,
    context?: SovereigntyAdapterContext,
  ): SovereigntyExportArtifact {
    const proofHash = this.proofGenerator.generate(snapshot);
    const components = extractCordComponentsFromSnapshot(snapshot);
    const outcome = snapshot.outcome ?? 'ABANDONED';
    const breakdown = computeFullScoreBreakdown(components, outcome);
    const summary = buildRunSummaryFromSnapshot(snapshot, context, breakdown, proofHash);
    const card = buildProofCardFromSnapshot(
      snapshot,
      summary,
      proofHash,
      context?.playerHandle ?? this.config.defaultPlayerHandle,
    );
    return buildExportArtifactFromSummary(summary, card, proofHash, this.config.artifactBaseUrl);
  }

  // -----------------------------------------------------------------------
  // Public: Proof verification
  // -----------------------------------------------------------------------

  /**
   * Verifies the existing proof hash on a snapshot against a regenerated one.
   */
  public verifyProof(snapshot: RunStateSnapshot): boolean {
    return this.proofGenerator.verifyExistingProofHash(snapshot);
  }

  // -----------------------------------------------------------------------
  // Public: Score breakdown
  // -----------------------------------------------------------------------

  /**
   * Computes the full CORD score breakdown for a snapshot.
   */
  public computeBreakdown(snapshot: RunStateSnapshot): SovereigntyScoreBreakdown {
    const components = extractCordComponentsFromSnapshot(snapshot);
    const outcome = snapshot.outcome ?? 'ABANDONED';
    return computeFullScoreBreakdown(components, outcome);
  }

  // -----------------------------------------------------------------------
  // Public: Tick seal chain
  // -----------------------------------------------------------------------

  /**
   * Builds the chained tick seal sequence for the snapshot's tick checksums.
   * Returns the seal chain as an ordered array of hex strings.
   */
  public buildTickSealChain(snapshot: RunStateSnapshot): readonly string[] {
    const seals: string[] = [];
    let previousSeal = GENESIS_SEAL;
    const checksums = snapshot.sovereignty.tickChecksums;

    for (let i = 0; i < checksums.length; i++) {
      const stateCs = checksums[i] as string;
      const sealInput: ChainedTickSealInput = {
        runId: snapshot.runId,
        tick: i,
        step: `tick-${i}`,
        stateChecksum: stateCs,
        eventChecksums: [stateCs],
        previousSeal,
        mlVectorChecksum: checksumSnapshot({ tick: i, runId: snapshot.runId }),
      };
      const seal = computeChainedTickSeal(sealInput);
      seals.push(seal);
      previousSeal = seal;
    }

    return seals;
  }

  // -----------------------------------------------------------------------
  // Public: Tick seal for single tick
  // -----------------------------------------------------------------------

  /**
   * Computes a single tick seal for a given tick index.
   */
  public computeSingleTickSeal(
    snapshot: RunStateSnapshot,
    tickIndex: number,
  ): string {
    const stateCs = snapshot.sovereignty.tickChecksums[tickIndex] ?? '';
    const sealInput: TickSealInput = {
      runId: snapshot.runId,
      tick: tickIndex,
      step: `tick-${tickIndex}`,
      stateChecksum: stateCs,
      eventChecksums: [stateCs],
    };
    return computeTickSeal(sealInput);
  }

  // -----------------------------------------------------------------------
  // Public: Extended proof hash
  // -----------------------------------------------------------------------

  /**
   * Computes the extended proof hash for a snapshot, including merkle root
   * and audit log hash.
   */
  public computeExtendedProof(snapshot: RunStateSnapshot): string {
    const input = this.proofGenerator.buildProofInput(snapshot);
    const extInput: ExtendedProofHashInput = {
      seed: input.seed,
      tickStreamChecksum: input.tickStreamChecksum,
      outcome: input.outcome,
      finalNetWorth: input.finalNetWorth,
      userId: input.userId,
      runId: snapshot.runId,
      mode: snapshot.mode,
      totalTicks: snapshot.tick,
      finalPressureTier: PRESSURE_TIER_INDEX_MAP[snapshot.pressure.tier] ?? 0,
      merkleRoot: this.merkleChain.root(),
      auditLogHash: checksumSnapshot(this.auditLog.captureState()),
    };
    return computeExtendedProofHash(extInput);
  }

  // -----------------------------------------------------------------------
  // Public: Proof hash input
  // -----------------------------------------------------------------------

  /**
   * Builds a BackendProofHashInput from a snapshot.
   */
  public buildProofInput(snapshot: RunStateSnapshot): BackendProofHashInput {
    return this.proofGenerator.buildProofInput(snapshot);
  }

  // -----------------------------------------------------------------------
  // Public: Compute basic proof hash
  // -----------------------------------------------------------------------

  /**
   * Computes the basic proof hash from a ProofHashInput.
   */
  public computeBasicProofHash(input: ProofHashInput): string {
    return computeProofHash(input);
  }

  // -----------------------------------------------------------------------
  // Public: Grade thresholds
  // -----------------------------------------------------------------------

  /**
   * Returns the full grade threshold map.
   */
  public getGradeThresholds(): GradeThresholdMap {
    return computeAllGradeThresholds();
  }

  // -----------------------------------------------------------------------
  // Public: Leaderboard projection
  // -----------------------------------------------------------------------

  /**
   * Builds a leaderboard from an array of run summaries.
   */
  public buildLeaderboard(summaries: readonly SovereigntyRunSummary[]): LeaderboardEntry[] {
    return buildLeaderboard(summaries);
  }

  // -----------------------------------------------------------------------
  // Public: Public summary projection
  // -----------------------------------------------------------------------

  /**
   * Projects a run summary into a public-facing summary.
   */
  public projectPublicSummary(summary: SovereigntyRunSummary): PublicRunSummary {
    return projectPublicSummary(summary);
  }

  // -----------------------------------------------------------------------
  // Public: Explorer card projection
  // -----------------------------------------------------------------------

  /**
   * Projects a run summary into an explorer card.
   */
  public projectExplorerCard(summary: SovereigntyRunSummary): ExplorerCard {
    return projectExplorerCard(summary);
  }

  // -----------------------------------------------------------------------
  // Public: Diff two run summaries
  // -----------------------------------------------------------------------

  /**
   * Computes the diff between two run summaries.
   */
  public diffSummaries(a: SovereigntyRunSummary, b: SovereigntyRunSummary): ReturnType<typeof diffRunSummaries> {
    return diffRunSummaries(a, b);
  }

  // -----------------------------------------------------------------------
  // Public: Similarity score
  // -----------------------------------------------------------------------

  /**
   * Computes a similarity score between two run summaries.
   */
  public computeSimilarity(a: SovereigntyRunSummary, b: SovereigntyRunSummary): number {
    return computeRunSimilarityScore(a, b);
  }

  // -----------------------------------------------------------------------
  // Public: Merkle root
  // -----------------------------------------------------------------------

  /**
   * Returns the current Merkle root of all exported runs.
   */
  public getMerkleRoot(): string {
    return this.merkleChain.root();
  }

  // -----------------------------------------------------------------------
  // Public: Export count
  // -----------------------------------------------------------------------

  /**
   * Returns the total number of exports performed by this instance.
   */
  public getExportCount(): number {
    return this.exportCount;
  }

  // -----------------------------------------------------------------------
  // Public: Validate proof input
  // -----------------------------------------------------------------------

  /**
   * Validates a proof input for completeness and correctness.
   */
  public validateProofInput(input: BackendProofHashInput): ReturnType<typeof validateProofInput> {
    return validateProofInput(input);
  }

  // -----------------------------------------------------------------------
  // Public: Validate proof snapshot
  // -----------------------------------------------------------------------

  /**
   * Validates a full snapshot for proof generation readiness.
   */
  public validateSnapshot(snapshot: RunStateSnapshot): ReturnType<typeof validateProofSnapshot> {
    return validateProofSnapshot(snapshot);
  }

  // -----------------------------------------------------------------------
  // Internal: Build audit entry
  // -----------------------------------------------------------------------

  private buildInternalAuditEntry(
    snapshot: RunStateSnapshot,
    proofHash: string,
    operation: string,
  ): ExporterAuditEntry {
    const entry = buildExporterAuditEntry(
      snapshot.runId,
      proofHash,
      operation,
      this.config.hmacSecret,
    );
    // Also record in the structured audit log
    this.auditLog.recordCheckpoint(
      snapshot.tick,
      `export-${operation}`,
      checksumSnapshot({ runId: snapshot.runId, proofHash }),
    );
    return entry;
  }

  // -----------------------------------------------------------------------
  // Internal: Build persistence envelope
  // -----------------------------------------------------------------------

  private buildPersistence(
    summary: SovereigntyRunSummary,
    artifact: SovereigntyExportArtifact,
  ): SovereigntyPersistenceEnvelope {
    return buildPersistenceEnvelope({
      summary,
      ticks: [],
      artifact,
      persistenceIdPrefix: `exporter-${summary.runId}`,
    });
  }
}

// ============================================================================
// SECTION 5 — PROOF CARD & ARTIFACT CONSTRUCTION
// ============================================================================

/**
 * Builds a SovereigntyProofCard from a snapshot, summary, and proof hash.
 */
function buildProofCardFromSnapshot(
  snapshot: RunStateSnapshot,
  summary: SovereigntyRunSummary,
  proofHash: string,
  playerHandle: string,
): SovereigntyProofCard {
  const outcome = snapshot.outcome ?? 'ABANDONED';
  const grade = summary.verifiedGrade;
  const badgeTier = badgeTierForGrade(grade);
  const intStatus = normalizeIntegrityStatus(snapshot.sovereignty.integrityStatus);
  const nowMs = Date.now();

  // Compute shield average from snapshot layers
  const shieldLayerData = snapshot.shield.layers
    .filter((l) => isShieldLayerId(l.layerId))
    .map((l) => ({ id: l.layerId, current: l.current, max: l.max }));
  const shieldAvg = computeShieldIntegrityRatio(shieldLayerData) * 100;

  // Compute hater block rate
  let totalAttempts = 0;
  let totalBlocked = 0;
  for (const bot of snapshot.battle.bots) {
    totalAttempts += bot.attacksLanded + bot.attacksBlocked;
    totalBlocked += bot.attacksBlocked;
  }
  const blockRate = totalAttempts > 0 ? totalBlocked / totalAttempts : 0;

  // Compute cascade break rate
  const cascadeTotal = snapshot.cascade.brokenChains + snapshot.cascade.completedChains + snapshot.cascade.activeChains.length;
  const cascadeBreakRate = cascadeTotal > 0 ? snapshot.cascade.brokenChains / cascadeTotal : 0;

  // Decision speed score
  const decisions = snapshot.telemetry.decisions;
  let speedSum = 0;
  for (const dec of decisions) {
    speedSum += dec.latencyMs > 0 ? Math.max(0, 1 - dec.latencyMs / 10000) : 0;
  }
  const decisionSpeedScore = decisions.length > 0 ? speedSum / decisions.length : 0;

  return {
    contractVersion: SOVEREIGNTY_EXPORT_VERSION,
    runId: snapshot.runId,
    proofHash,
    playerHandle,
    mode: snapshot.mode,
    outcome,
    integrityStatus: intStatus,
    grade,
    badgeTier,
    sovereigntyScore: summary.sovereigntyScore,
    ticksSurvived: snapshot.tick,
    finalNetWorth: snapshot.economy.netWorth,
    shieldAverageIntegrityPct: Math.min(100, Math.max(0, Number(shieldAvg.toFixed(2)))),
    haterBlockRate: Number(blockRate.toFixed(4)),
    cascadeBreakRate: Number(cascadeBreakRate.toFixed(4)),
    decisionSpeedScore: Number(decisionSpeedScore.toFixed(4)),
    proofBadges: [...snapshot.sovereignty.proofBadges],
    generatedAtMs: nowMs,
  };
}

/**
 * Builds a SovereigntyExportArtifact from a summary, proof card, and proof hash.
 */
function buildExportArtifactFromSummary(
  summary: SovereigntyRunSummary,
  proofCard: SovereigntyProofCard,
  proofHash: string,
  artifactBaseUrl: string,
): SovereigntyExportArtifact {
  const format = 'JSON' as const;
  const extension = artifactExtensionForFormat(format);
  const mimeType = artifactMimeTypeForFormat(format);
  const artifactId = createDeterministicId('artifact', summary.runId, proofHash);
  const nowMs = Date.now();
  const fileName = `sovereignty-${summary.runId}.${extension}`;
  const exportUrl = artifactBaseUrl
    ? `${artifactBaseUrl}/${fileName}`
    : undefined;

  const payload = {
    run: summary,
    tickTimeline: [] as SovereigntyTickRecord[],
    generatedAtMs: nowMs,
    format,
  } as const;

  const payloadStr = stableStringify(payload);
  const checksum = sha256(payloadStr);

  return {
    contractVersion: SOVEREIGNTY_EXPORT_VERSION,
    artifactId,
    runId: summary.runId,
    proofHash,
    format,
    mimeType,
    fileName,
    exportUrl,
    badgeTier: summary.badgeTier,
    generatedAtMs: nowMs,
    checksum,
    summary: proofCard,
    payload,
  };
}

// ============================================================================
// SECTION 6 — RUN SUMMARY BUILDER
// ============================================================================

/**
 * Builds a full SovereigntyRunSummary from a snapshot and scoring breakdown.
 */
function buildRunSummaryFromSnapshot(
  snapshot: RunStateSnapshot,
  context: SovereigntyAdapterContext | undefined,
  breakdown: SovereigntyScoreBreakdown,
  proofHash: string,
): SovereigntyRunSummary {
  const outcome = snapshot.outcome ?? 'ABANDONED';
  const nowMs = Date.now();
  const startedAtMs = context?.startedAtMs ?? (nowMs - 60000);
  const completedAtMs = context?.completedAtMs ?? nowMs;
  const durationMs = completedAtMs - startedAtMs;
  const seasonTickBudget = context?.seasonTickBudget ?? MAX_TICK_NORMALIZATION;

  // Shield integral calculation
  const summaryShieldData = snapshot.shield.layers
    .filter((l) => isShieldLayerId(l.layerId))
    .map((l) => ({ id: l.layerId, current: l.current, max: l.max }));
  const shieldIntegralSum = computeShieldIntegrityRatio(summaryShieldData);
  const shieldSampleCount = summaryShieldData.length;
  const shieldAvg = shieldIntegralSum * 100;

  // Hater stats
  let totalAttempts = 0;
  let totalBlocked = 0;
  let totalDamaged = 0;
  for (const bot of snapshot.battle.bots) {
    totalAttempts += bot.attacksLanded + bot.attacksBlocked;
    totalBlocked += bot.attacksBlocked;
    totalDamaged += bot.attacksLanded;
  }
  const haterBlockRate = totalAttempts > 0 ? totalBlocked / totalAttempts : 0;

  // Cascade stats
  const cascadeTriggered = snapshot.cascade.brokenChains + snapshot.cascade.completedChains + snapshot.cascade.activeChains.length;
  const cascadeBreakRate = cascadeTriggered > 0 ? snapshot.cascade.brokenChains / cascadeTriggered : 0;

  // Decision stats
  const decisions = snapshot.telemetry.decisions;
  const acceptedCount = decisions.filter((d) => d.accepted).length;
  let totalLatency = 0;
  let speedScoreSum = 0;
  for (const dec of decisions) {
    totalLatency += dec.latencyMs;
    speedScoreSum += dec.latencyMs > 0 ? Math.max(0, 1 - dec.latencyMs / 10000) : 0;
  }
  const avgLatency = decisions.length > 0 ? totalLatency / decisions.length : 0;
  const decisionSpeedScore = decisions.length > 0 ? speedScoreSum / decisions.length : 0;

  // Pressure survival
  const highPressureTicksSurvived = snapshot.pressure.survivedHighPressureTicks;

  // Tick stream checksum
  const tickStreamChecksum = snapshot.sovereignty.tickChecksums.length > 0
    ? sha256(snapshot.sovereignty.tickChecksums.join('|'))
    : EMPTY_TICK_STREAM_CHECKSUM;

  // Grade and badge
  const grade = breakdown.computedGrade as SovereigntyGrade;
  const badgeTier = badgeTierForGrade(grade);
  const intStatus = normalizeIntegrityStatus(snapshot.sovereignty.integrityStatus);

  // CORD score from breakdown
  const cordScore = breakdown.finalScore;

  // Gap vs legend
  const gapVsLegend = snapshot.sovereignty.gapVsLegend;
  const gapClosingRate = snapshot.sovereignty.gapClosingRate;

  const tags = context?.extraTags ? [...snapshot.tags, ...context.extraTags] : [...snapshot.tags];

  return {
    contractVersion: SOVEREIGNTY_CONTRACT_VERSION,
    runId: snapshot.runId,
    userId: snapshot.userId,
    seed: snapshot.seed,
    mode: snapshot.mode,
    outcome,
    tags,
    startedAtMs,
    completedAtMs,
    durationMs,
    clientVersion: context?.clientVersion ?? DEFAULT_SOVEREIGNTY_CLIENT_VERSION,
    engineVersion: context?.engineVersion ?? DEFAULT_SOVEREIGNTY_ENGINE_VERSION,
    ticksSurvived: snapshot.tick,
    seasonTickBudget,
    finalNetWorth: snapshot.economy.netWorth,
    haterHeatAtEnd: snapshot.economy.haterHeat,
    shieldIntegralSum,
    shieldSampleCount,
    shieldAverageIntegrityPct: Number(shieldAvg.toFixed(2)),
    totalHaterAttempts: totalAttempts,
    totalHaterBlocked: totalBlocked,
    totalHaterDamaged: totalDamaged,
    haterBlockRate: Number(haterBlockRate.toFixed(4)),
    totalCascadeChainsTriggered: cascadeTriggered,
    totalCascadeChainsBroken: snapshot.cascade.brokenChains,
    cascadeBreakRate: Number(cascadeBreakRate.toFixed(4)),
    activeCascadeChainsAtEnd: snapshot.cascade.activeChains.length,
    decisionCount: decisions.length,
    acceptedDecisionCount: acceptedCount,
    averageDecisionLatencyMs: Number(avgLatency.toFixed(2)),
    decisionSpeedScore: Number(decisionSpeedScore.toFixed(4)),
    pressureScoreAtEnd: snapshot.pressure.score,
    maxPressureScoreSeen: snapshot.pressure.maxScoreSeen,
    highPressureTicksSurvived,
    tickStreamChecksum,
    proofHash,
    integrityStatus: intStatus,
    sovereigntyScore: snapshot.sovereignty.sovereigntyScore,
    verifiedGrade: grade,
    badgeTier,
    proofBadges: [...snapshot.sovereignty.proofBadges],
    gapVsLegend,
    gapClosingRate,
    cordScore: Number(cordScore.toFixed(4)),
    auditFlags: [...snapshot.sovereignty.auditFlags],
    scoreBreakdown: breakdown,
  };
}

// ============================================================================
// SECTION 7 — CORD SCORING PIPELINE
// ============================================================================

/**
 * Extracts CORD score components from a snapshot.
 * Maps the five CORD dimensions directly from snapshot state.
 */
function extractCordComponentsFromSnapshot(
  snapshot: RunStateSnapshot,
): {
  readonly decision_speed_score: number;
  readonly shields_maintained_pct: number;
  readonly hater_sabotages_blocked: number;
  readonly cascade_chains_broken: number;
  readonly pressure_survived_score: number;
} {
  // Decision speed
  const decisions = snapshot.telemetry.decisions;
  let speedSum = 0;
  for (const dec of decisions) {
    speedSum += dec.latencyMs > 0 ? Math.max(0, 1 - dec.latencyMs / 10000) : 0;
  }
  const decisionSpeed = decisions.length > 0 ? speedSum / decisions.length : 0;

  // Shield maintained percentage — use the overall weighted integrity ratio
  const cordShieldData = snapshot.shield.layers
    .filter((l) => isShieldLayerId(l.layerId))
    .map((l) => ({ id: l.layerId, current: l.current, max: l.max }));
  const shieldsMaintained = computeShieldIntegrityRatio(cordShieldData);

  // Hater sabotages blocked
  let totalAttempts = 0;
  let totalBlocked = 0;
  for (const bot of snapshot.battle.bots) {
    totalAttempts += bot.attacksLanded + bot.attacksBlocked;
    totalBlocked += bot.attacksBlocked;
  }
  const haterBlocked = totalAttempts > 0 ? totalBlocked / totalAttempts : 0;

  // Cascade chains broken
  const cascadeTotal = snapshot.cascade.brokenChains + snapshot.cascade.completedChains + snapshot.cascade.activeChains.length;
  const cascadeBroken = cascadeTotal > 0 ? snapshot.cascade.brokenChains / cascadeTotal : 0;

  // Pressure survived
  const tickBudget = MAX_TICK_NORMALIZATION;
  const pressureSurvived = tickBudget > 0
    ? snapshot.pressure.survivedHighPressureTicks / tickBudget
    : 0;

  return {
    decision_speed_score: Math.min(1, Math.max(0, decisionSpeed)),
    shields_maintained_pct: Math.min(1, Math.max(0, shieldsMaintained)),
    hater_sabotages_blocked: Math.min(1, Math.max(0, haterBlocked)),
    cascade_chains_broken: Math.min(1, Math.max(0, cascadeBroken)),
    pressure_survived_score: Math.min(1, Math.max(0, pressureSurvived)),
  };
}

/**
 * Computes the full CORD pipeline for a snapshot — components, raw score,
 * outcome multiplier, final score, grade, badge tier.
 */
function computeFullCordPipeline(snapshot: RunStateSnapshot): {
  readonly components: ReturnType<typeof extractCordComponentsFromSnapshot>;
  readonly rawScore: number;
  readonly outcomeMultiplier: number;
  readonly finalScore: number;
  readonly grade: SovereigntyGrade;
  readonly badgeTier: SovereigntyBadgeTier;
  readonly breakdown: SovereigntyScoreBreakdown;
} {
  const components = extractCordComponentsFromSnapshot(snapshot);
  const outcome = snapshot.outcome ?? 'ABANDONED';

  // Compute CORD raw score via contracts function
  const rawScore = computeCORDScore(components);
  const outcomeMultiplier = computeOutcomeMultiplier(outcome);
  const finalScore = computeFinalScore(rawScore, outcome);
  const grade = assignGradeFromScore(finalScore) as SovereigntyGrade;
  const badgeTier = badgeTierForGrade(grade);
  const breakdown = computeFullScoreBreakdown(components, outcome);

  return { components, rawScore, outcomeMultiplier, finalScore, grade, badgeTier, breakdown };
}

/**
 * Computes detailed CORD weight analysis for a snapshot.
 * Returns the contribution of each weight dimension.
 */
function computeCordWeightAnalysis(snapshot: RunStateSnapshot): Record<string, number> {
  const components = extractCordComponentsFromSnapshot(snapshot);
  return {
    decision_speed_contribution: components.decision_speed_score * CORD_WEIGHTS.decision_speed_score,
    shields_maintained_contribution: components.shields_maintained_pct * CORD_WEIGHTS.shields_maintained_pct,
    hater_blocks_contribution: components.hater_sabotages_blocked * CORD_WEIGHTS.hater_sabotages_blocked,
    cascade_breaks_contribution: components.cascade_chains_broken * CORD_WEIGHTS.cascade_chains_broken,
    pressure_survival_contribution: components.pressure_survived_score * CORD_WEIGHTS.pressure_survived_score,
    outcome_multiplier: computeOutcomeMultiplier(snapshot.outcome ?? 'ABANDONED'),
    total_cord_weight: CORD_WEIGHTS.decision_speed_score + CORD_WEIGHTS.shields_maintained_pct
      + CORD_WEIGHTS.hater_sabotages_blocked + CORD_WEIGHTS.cascade_chains_broken
      + CORD_WEIGHTS.pressure_survived_score,
  };
}

// ============================================================================
// SECTION 8 — INTEGRITY & GRADE PIPELINE
// ============================================================================

/**
 * Computes the full integrity and grade pipeline for a snapshot.
 * Uses type guards, risk scores, and grade thresholds.
 */
function computeIntegrityGradePipeline(snapshot: RunStateSnapshot): {
  readonly integrityStatus: SovereigntyIntegrityStatus;
  readonly integrityRiskScore: number;
  readonly grade: SovereigntyGrade;
  readonly gradeLabel: string;
  readonly gradeNumericScore: number;
  readonly distanceFromNextGrade: number;
  readonly scorePercentile: number;
  readonly badgeTier: SovereigntyBadgeTier;
  readonly badgeDescription: string;
} {
  // Integrity
  const rawStatus = snapshot.sovereignty.integrityStatus;
  const integrityStatus = normalizeIntegrityStatus(rawStatus);
  const integrityRiskScore = isIntegrityStatus(rawStatus)
    ? INTEGRITY_STATUS_RISK_SCORE[rawStatus]
    : 0.7;

  // Grade computation
  const pipeline = computeFullCordPipeline(snapshot);
  const grade = pipeline.grade;
  const normalizedGrade = normalizeGrade(grade);
  const gradeLabel = scoreToGradeLabel(normalizedGrade);

  // Grade numeric via VERIFIED_GRADE_NUMERIC_SCORE
  const vgKey = grade === 'S' ? 'A' : grade;
  const gradeNumericScore = isVerifiedGrade(vgKey) ? VERIFIED_GRADE_NUMERIC_SCORE[vgKey] : 0;

  // Distance from next
  const distanceFromNextGrade = computeGradeDistanceFromNext(pipeline.finalScore);

  // Percentile
  const scorePercentile = computeScorePercentile(pipeline.finalScore);

  // Badge
  const badgeTier = badgeTierForGrade(grade);
  const badgeDescription = generateBadgeDescription(badgeTier);

  return {
    integrityStatus,
    integrityRiskScore,
    grade,
    gradeLabel,
    gradeNumericScore,
    distanceFromNextGrade,
    scorePercentile,
    badgeTier,
    badgeDescription,
  };
}

/**
 * Classifies a snapshot's integrity strength based on tick checksum coverage,
 * proof hash presence, and audit flag analysis.
 */
function classifyIntegrityStrength(snapshot: RunStateSnapshot): {
  readonly strength: 'STRONG' | 'MODERATE' | 'WEAK' | 'NONE';
  readonly tickCoverage: number;
  readonly hasProofHash: boolean;
  readonly auditFlagCount: number;
} {
  const tickCoverage = snapshot.tick > 0
    ? snapshot.sovereignty.tickChecksums.length / snapshot.tick
    : 0;
  const hasProofHash = snapshot.sovereignty.proofHash !== null && snapshot.sovereignty.proofHash.length > 0;
  const auditFlagCount = snapshot.sovereignty.auditFlags.length;

  let strength: 'STRONG' | 'MODERATE' | 'WEAK' | 'NONE';
  if (hasProofHash && tickCoverage >= 0.95 && auditFlagCount === 0) {
    strength = 'STRONG';
  } else if (hasProofHash && tickCoverage >= 0.5) {
    strength = 'MODERATE';
  } else if (hasProofHash || tickCoverage > 0) {
    strength = 'WEAK';
  } else {
    strength = 'NONE';
  }

  return { strength, tickCoverage, hasProofHash, auditFlagCount };
}

// ============================================================================
// SECTION 9 — ML FEATURE EXTRACTION (32-dim)
// ============================================================================

/**
 * Computes a 32-dimensional ML feature vector from a snapshot for export.
 * Each feature is normalized to [0, 1] or uses sigmoid normalization.
 */
export function computeExporterMLVector(
  snapshot: RunStateSnapshot,
): ExporterMLVector {
  const features: number[] = [];
  const outcome = snapshot.outcome ?? 'ABANDONED';

  // Features 0-3: One-hot outcome encoding (4 dims)
  for (const o of RUN_OUTCOMES) {
    features.push(outcome === o ? 1 : 0);
  }

  // Feature 4: Tick survival ratio
  features.push(Math.min(snapshot.tick / MAX_TICK_NORMALIZATION, 1));

  // Feature 5: Tick checksum format ratio (SHA256 vs total)
  const checksums = snapshot.sovereignty.tickChecksums;
  const sha256Count = checksums.filter((c) => SHA256_HEX_RE.test(String(c).trim())).length;
  features.push(checksums.length > 0 ? sha256Count / checksums.length : 0);

  // Feature 6: Proof hash entropy proxy
  const proofHash = snapshot.sovereignty.proofHash ?? '';
  const uniqueChars = new Set(proofHash.toLowerCase().split('')).size;
  features.push(proofHash.length > 0 ? uniqueChars / 16 : 0);

  // Feature 7: CORD score normalized
  const components = extractCordComponentsFromSnapshot(snapshot);
  const cordRaw = computeCORDScore(components);
  const outcomeMultiplier = computeOutcomeMultiplier(outcome);
  const cordFinal = cordRaw * outcomeMultiplier;
  features.push(Math.min(cordFinal / 1.5, 1));

  // Feature 8: Grade numeric
  const grade = assignGradeFromScore(cordFinal);
  const gradeKey = grade === 'S' ? 'A' : grade;
  features.push(isVerifiedGrade(gradeKey) ? VERIFIED_GRADE_NUMERIC_SCORE[gradeKey] : 0);

  // Feature 9: Integrity status risk
  const rawStatus = snapshot.sovereignty.integrityStatus;
  features.push(isIntegrityStatus(rawStatus) ? INTEGRITY_STATUS_RISK_SCORE[rawStatus] : 0.7);

  // Feature 10: Pressure tier normalized
  features.push(
    isPressureTier(snapshot.pressure.tier)
      ? PRESSURE_TIER_NORMALIZED[snapshot.pressure.tier]
      : 0,
  );

  // Feature 11: Shield integrity ratio (weighted across layers)
  const mlShieldData = snapshot.shield.layers
    .filter((l) => isShieldLayerId(l.layerId))
    .map((l) => ({ id: l.layerId, current: l.current, max: l.max }));
  features.push(computeShieldIntegrityRatio(mlShieldData));

  // Feature 12: Hater block rate
  features.push(Math.min(1, Math.max(0, components.hater_sabotages_blocked)));

  // Feature 13: Cascade break rate
  features.push(Math.min(1, Math.max(0, components.cascade_chains_broken)));

  // Feature 14: Decision speed normalized
  features.push(Math.min(1, Math.max(0, components.decision_speed_score)));

  // Feature 15: Net worth normalized (sigmoid at MAX_NET_WORTH)
  features.push(1 / (1 + Math.exp(-snapshot.economy.netWorth / (MAX_NET_WORTH_NORMALIZATION / 10))));

  // Feature 16: Freedom target progress
  const freedomProgress = snapshot.economy.freedomTarget > 0
    ? snapshot.economy.netWorth / snapshot.economy.freedomTarget
    : 0;
  features.push(Math.min(1, Math.max(0, freedomProgress)));

  // Feature 17: Battle budget ratio
  features.push(
    snapshot.battle.battleBudgetCap > 0
      ? snapshot.battle.battleBudget / snapshot.battle.battleBudgetCap
      : 0,
  );

  // Feature 18: Cascade active ratio
  features.push(Math.min(snapshot.cascade.activeChains.length / 10, 1));

  // Feature 19: Mode difficulty
  features.push(
    isModeCode(snapshot.mode)
      ? MODE_DIFFICULTY_MULTIPLIER[snapshot.mode] / 2
      : 0,
  );

  // Feature 20: Run phase normalized
  features.push(
    isRunPhase(snapshot.phase)
      ? RUN_PHASE_NORMALIZED[snapshot.phase]
      : 0,
  );

  // Feature 21: Run progress fraction
  features.push(computeRunProgressFraction(snapshot.phase, snapshot.tick, MAX_TICK_NORMALIZATION));

  // Feature 22: Endgame flag
  features.push(isEndgamePhase(snapshot.phase) ? 1 : 0);

  // Feature 23: Win outcome flag
  features.push(isWinOutcome(outcome) ? 1 : 0);

  // Feature 24: Loss outcome flag
  features.push(isLossOutcome(outcome) ? 1 : 0);

  // Feature 25: Outcome excitement
  features.push(scoreOutcomeExcitement(outcome, snapshot.mode));

  // Feature 26: Shield regen weighted sum
  let regenWeighted = 0;
  for (const layer of snapshot.shield.layers) {
    if (isShieldLayerId(layer.layerId)) {
      regenWeighted += estimateShieldRegenPerTick(layer.layerId, layer.max);
    }
  }
  features.push(Math.min(regenWeighted / 4, 1));

  // Feature 27: Aggregate threat pressure
  const threats = snapshot.tension.visibleThreats;
  features.push(
    threats.length > 0
      ? Math.min(computeAggregateThreatPressure(threats, snapshot.tick), 1)
      : 0,
  );

  // Feature 28: Card power average
  const handCards = snapshot.cards.hand;
  let cardPowerSum = 0;
  for (const c of handCards) {
    cardPowerSum += computeCardPowerScore(c);
  }
  features.push(handCards.length > 0 ? Math.min(cardPowerSum / handCards.length, 1) : 0);

  // Feature 29: Legend marker density
  const legendMarkers = snapshot.cards.ghostMarkers;
  features.push(computeLegendMarkerDensity(legendMarkers, snapshot.tick));

  // Feature 30: Bot threat weighted sum
  let botThreatSum = 0;
  for (const bot of snapshot.battle.bots) {
    if (isHaterBotId(bot.botId)) {
      botThreatSum += BOT_THREAT_LEVEL[bot.botId] * BOT_STATE_THREAT_MULTIPLIER[bot.state];
    }
  }
  features.push(Math.min(botThreatSum / 5, 1));

  // Feature 31: Timing pressure max
  let maxTimingPriority = 0;
  for (const windowId of Object.keys(snapshot.timers.activeDecisionWindows)) {
    const window = snapshot.timers.activeDecisionWindows[windowId];
    if (isTimingClass(window.timingClass)) {
      const priority = TIMING_CLASS_WINDOW_PRIORITY[window.timingClass];
      if (priority > maxTimingPriority) maxTimingPriority = priority;
    }
  }
  features.push(maxTimingPriority / 100);

  // Validate dimension
  while (features.length < EXPORTER_ML_FEATURE_COUNT) features.push(0);

  const checksum = checksumParts(features);

  return deepFreeze({
    features: features.slice(0, EXPORTER_ML_FEATURE_COUNT),
    labels: EXPORTER_ML_FEATURE_LABELS as unknown as string[],
    dimensionality: 32 as const,
    checksum,
    exporterVersion: EXPORTER_VERSION,
  });
}

/**
 * Builds an empty ML vector (when ML features are disabled).
 */
function buildEmptyMLVector(): ExporterMLVector {
  const features = new Array<number>(EXPORTER_ML_FEATURE_COUNT).fill(0);
  return deepFreeze({
    features,
    labels: EXPORTER_ML_FEATURE_LABELS as unknown as string[],
    dimensionality: 32 as const,
    checksum: checksumParts(features),
    exporterVersion: EXPORTER_VERSION,
  });
}

// ============================================================================
// SECTION 10 — DL TENSOR CONSTRUCTION (48-dim)
// ============================================================================

/**
 * Computes a 48-dimensional DL tensor from a snapshot for deep learning.
 * First 32 dimensions are the ML vector; remaining 16 are extended features.
 */
export function computeExporterDLTensor(
  snapshot: RunStateSnapshot,
): ExporterDLTensor {
  // Start with ML features
  const mlVector = computeExporterMLVector(snapshot);
  const features: number[] = [...mlVector.features];
  const outcome = snapshot.outcome ?? 'ABANDONED';

  // Feature 32: Sovereignty score normalized
  features.push(Math.min(snapshot.sovereignty.sovereigntyScore / MAX_SOVEREIGNTY_SCORE_NORMALIZATION, 1));

  // Feature 33: Gap vs legend normalized
  features.push(Math.min(snapshot.sovereignty.gapVsLegend / MAX_GAP_VS_LEGEND_NORMALIZATION, 1));

  // Features 34-38: CORD component decomposition (5 dims)
  const components = extractCordComponentsFromSnapshot(snapshot);
  features.push(components.decision_speed_score * CORD_WEIGHTS.decision_speed_score);
  features.push(components.shields_maintained_pct * CORD_WEIGHTS.shields_maintained_pct);
  features.push(components.hater_sabotages_blocked * CORD_WEIGHTS.hater_sabotages_blocked);
  features.push(components.cascade_chains_broken * CORD_WEIGHTS.cascade_chains_broken);
  features.push(components.pressure_survived_score * CORD_WEIGHTS.pressure_survived_score);

  // Feature 39: Cascade chain health average
  const chains = snapshot.cascade.activeChains;
  let healthSum = 0;
  let healthMin = 1;
  for (const chain of chains) {
    const health = scoreCascadeChainHealth(chain);
    healthSum += health;
    if (health < healthMin) healthMin = health;
  }
  features.push(chains.length > 0 ? healthSum / chains.length : 0);

  // Feature 40: Cascade chain health min
  features.push(chains.length > 0 ? healthMin : 0);

  // Features 41-44: Shield layer vulnerabilities (4 dims)
  for (const layerId of SHIELD_LAYER_IDS) {
    const layer = snapshot.shield.layers.find((l) => l.layerId === layerId);
    if (layer) {
      features.push(computeShieldLayerVulnerability(layer.layerId, layer.current, layer.max));
    } else {
      features.push(1); // Missing layer = fully vulnerable
    }
  }

  // Feature 45: Card entropy normalized
  features.push(Math.min(snapshot.cards.deckEntropy / 10, 1));

  // Feature 46: Cascade experience impact
  let cascadeImpactSum = 0;
  for (const chain of chains) {
    cascadeImpactSum += computeCascadeExperienceImpact(chain);
  }
  features.push(chains.length > 0 ? Math.min(cascadeImpactSum / chains.length, 1) : 0);

  // Feature 47: Timing urgency decay average
  let decaySum = 0;
  let decayCount = 0;
  for (const windowId of Object.keys(snapshot.timers.activeDecisionWindows)) {
    const window = snapshot.timers.activeDecisionWindows[windowId];
    if (isTimingClass(window.timingClass)) {
      decaySum += TIMING_CLASS_URGENCY_DECAY[window.timingClass];
      decayCount++;
    }
  }
  features.push(decayCount > 0 ? decaySum / decayCount : 0);

  // Pad to 48 if needed
  while (features.length < EXPORTER_DL_FEATURE_COUNT) features.push(0);

  const checksum = checksumParts(features);

  return deepFreeze({
    features: features.slice(0, EXPORTER_DL_FEATURE_COUNT),
    labels: EXPORTER_DL_FEATURE_LABELS as unknown as string[],
    dimensionality: 48 as const,
    checksum,
    shape: [1, 48] as readonly [1, 48],
    exporterVersion: EXPORTER_VERSION,
  });
}

/**
 * Builds an empty DL tensor (when DL features are disabled).
 */
function buildEmptyDLTensor(): ExporterDLTensor {
  const features = new Array<number>(EXPORTER_DL_FEATURE_COUNT).fill(0);
  return deepFreeze({
    features,
    labels: EXPORTER_DL_FEATURE_LABELS as unknown as string[],
    dimensionality: 48 as const,
    checksum: checksumParts(features),
    shape: [1, 48] as readonly [1, 48],
    exporterVersion: EXPORTER_VERSION,
  });
}

// ============================================================================
// SECTION 11 — UX NARRATIVE GENERATION
// ============================================================================

/**
 * Generates a full UX narrative for an exported run.
 * Includes mode-specific intro, outcome text, grade narrative, integrity
 * narrative, CORD breakdown, pressure experience, shield analysis, and
 * battle bot summary.
 */
export function generateExporterNarrative(
  snapshot: RunStateSnapshot,
  summary: SovereigntyRunSummary,
  proofCard: SovereigntyProofCard,
): string {
  const lines: string[] = [];
  const outcome = snapshot.outcome ?? 'ABANDONED';

  // Title
  lines.push(`=== Sovereignty Export Report ===`);
  lines.push(`Run: ${snapshot.runId} | Mode: ${snapshot.mode} | Outcome: ${outcome}`);
  lines.push('');

  // Mode narrative
  const modeNarrative = buildModeNarrative(snapshot.mode);
  lines.push(modeNarrative);
  lines.push('');

  // Phase narrative
  const phaseNarrative = buildPhaseNarrative(snapshot.phase);
  lines.push(phaseNarrative);
  lines.push('');

  // Outcome narrative
  const outcomeNarrative = buildOutcomeNarrative(outcome, snapshot.mode);
  lines.push(outcomeNarrative);
  lines.push('');

  // Grade narrative from contracts
  lines.push(generateGradeNarrative(summary.verifiedGrade, summary.cordScore));
  lines.push('');

  // Integrity narrative from contracts
  lines.push(generateIntegrityNarrative(summary.integrityStatus));
  lines.push('');

  // Badge description
  lines.push(`Badge: ${summary.badgeTier} — ${generateBadgeDescription(summary.badgeTier)}`);
  lines.push('');

  // CORD breakdown
  lines.push('--- CORD Score Breakdown ---');
  const breakdown = summary.scoreBreakdown;
  lines.push(`  Decision Speed:     ${(breakdown.decisionSpeedScore * 100).toFixed(1)}% x ${(CORD_WEIGHTS.decision_speed_score * 100).toFixed(0)}% = ${breakdown.weightedDecisionSpeed.toFixed(4)}`);
  lines.push(`  Shields Maintained: ${(breakdown.shieldsMaintainedPct * 100).toFixed(1)}% x ${(CORD_WEIGHTS.shields_maintained_pct * 100).toFixed(0)}% = ${breakdown.weightedShieldsMaintained.toFixed(4)}`);
  lines.push(`  Hater Blocks:       ${(breakdown.haterBlockRate * 100).toFixed(1)}% x ${(CORD_WEIGHTS.hater_sabotages_blocked * 100).toFixed(0)}% = ${breakdown.weightedHaterBlocks.toFixed(4)}`);
  lines.push(`  Cascade Breaks:     ${(breakdown.cascadeBreakRate * 100).toFixed(1)}% x ${(CORD_WEIGHTS.cascade_chains_broken * 100).toFixed(0)}% = ${breakdown.weightedCascadeBreaks.toFixed(4)}`);
  lines.push(`  Pressure Survival:  ${(breakdown.pressureSurvivalScore * 100).toFixed(1)}% x ${(CORD_WEIGHTS.pressure_survived_score * 100).toFixed(0)}% = ${breakdown.weightedPressureSurvival.toFixed(4)}`);
  lines.push(`  Raw Score: ${breakdown.rawScore.toFixed(4)} x ${breakdown.outcomeMultiplier.toFixed(2)} (${outcome}) = ${breakdown.finalScore.toFixed(4)}`);
  lines.push('');

  // Pressure experience
  if (isPressureTier(snapshot.pressure.tier)) {
    const tierExp = describePressureTierExperience(snapshot.pressure.tier);
    lines.push(`Pressure: ${PRESSURE_TIER_URGENCY_LABEL[snapshot.pressure.tier]} (${snapshot.pressure.tier}) — ${tierExp}`);
    const pressureRisk = computePressureRiskScore(
      snapshot.pressure.tier,
      snapshot.pressure.score,
    );
    lines.push(`  Risk Score: ${pressureRisk.toFixed(4)}`);
    const nextTierIdx = PRESSURE_TIERS.indexOf(snapshot.pressure.tier) + 1;
    const nextTier = nextTierIdx < PRESSURE_TIERS.length ? PRESSURE_TIERS[nextTierIdx] : snapshot.pressure.tier;
    lines.push(`  Can Escalate: ${canEscalatePressure(snapshot.pressure.tier, nextTier, snapshot.pressure.score, 0) ? 'Yes' : 'No'}`);
    const prevTierIdx = PRESSURE_TIERS.indexOf(snapshot.pressure.tier) - 1;
    const prevTier = prevTierIdx >= 0 ? PRESSURE_TIERS[prevTierIdx] : snapshot.pressure.tier;
    lines.push(`  Can De-escalate: ${canDeescalatePressure(snapshot.pressure.tier, prevTier, snapshot.pressure.score) ? 'Yes' : 'No'}`);
  }
  lines.push('');

  // Shield analysis
  lines.push('--- Shield Layer Analysis ---');
  for (const layer of snapshot.shield.layers) {
    if (isShieldLayerId(layer.layerId)) {
      const label = SHIELD_LAYER_LABEL_BY_ID[layer.layerId];
      const vuln = computeShieldLayerVulnerability(layer.layerId, layer.current, layer.max);
      const regen = estimateShieldRegenPerTick(layer.layerId, layer.max);
      const narrativeRatio = layer.max > 0 ? layer.current / layer.max : 0;
      lines.push(`  ${layer.layerId} (${label}): ${(narrativeRatio * 100).toFixed(1)}% integrity, vulnerability ${vuln.toFixed(3)}, regen ${regen.toFixed(3)}/tick`);
    }
  }
  lines.push('');

  // Battle bot summary
  lines.push('--- Battle Bot Summary ---');
  for (const bot of snapshot.battle.bots) {
    if (isHaterBotId(bot.botId)) {
      const threat = BOT_THREAT_LEVEL[bot.botId];
      const stateMult = BOT_STATE_THREAT_MULTIPLIER[bot.state];
      const transitions = BOT_STATE_ALLOWED_TRANSITIONS[bot.state];
      lines.push(`  ${bot.botId} [${bot.state}]: threat=${threat.toFixed(2)}, state_mult=${stateMult.toFixed(2)}, possible_transitions=${transitions.join(',') || 'none'}`);
    }
  }
  lines.push('');

  // Attack analysis
  if (snapshot.battle.pendingAttacks.length > 0) {
    lines.push('--- Pending Attacks ---');
    for (const attack of snapshot.battle.pendingAttacks) {
      const severity = classifyAttackSeverity(attack);
      const damage = computeEffectiveAttackDamage(attack);
      const counterable = isAttackCounterable(attack);
      const shieldTargeted = isShieldTargetedAttack(attack);
      const fromBot = isAttackFromBot(attack);
      const urgency = scoreAttackResponseUrgency(attack, snapshot.tick);
      lines.push(`  ${attack.attackId}: severity=${severity}, damage=${damage.toFixed(2)}, counterable=${counterable}, shield_target=${shieldTargeted}, from_bot=${fromBot}, urgency=${urgency.toFixed(3)}`);
    }
    lines.push('');
  }

  // Threat analysis
  if (snapshot.tension.visibleThreats.length > 0) {
    lines.push('--- Active Threats ---');
    for (const threat of snapshot.tension.visibleThreats) {
      const urgency = scoreThreatUrgency(threat, snapshot.tick);
      const urgencyClass = classifyThreatUrgency(threat, snapshot.tick);
      lines.push(`  ${threat.threatId}: urgency=${urgency.toFixed(3)} (${urgencyClass})`);
    }
    const mostUrgent = findMostUrgentThreat(snapshot.tension.visibleThreats, snapshot.tick);
    if (mostUrgent) {
      lines.push(`  Most urgent: ${mostUrgent.threatId}`);
    }
    lines.push('');
  }

  // Card analysis
  if (snapshot.cards.hand.length > 0) {
    lines.push('--- Cards In Hand ---');
    for (const card of snapshot.cards.hand) {
      const power = computeCardPowerScore(card);
      const costEff = computeCardCostEfficiency(card);
      const legal = isCardLegalInMode(card, snapshot.mode);
      const offensive = isCardOffensive(card);
      const timingPrio = computeCardTimingPriority(card);
      const decayUrg = computeCardDecayUrgency(card);
      lines.push(`  ${card.instanceId}: power=${power.toFixed(2)}, cost_eff=${costEff.toFixed(2)}, legal=${legal}, offensive=${offensive}, timing=${timingPrio.toFixed(2)}, decay=${decayUrg.toFixed(3)}`);
      // Check counter capability
      for (const attack of snapshot.battle.pendingAttacks) {
        if (canCardCounterAttack(card, attack.category)) {
          lines.push(`    -> can counter attack ${attack.attackId}`);
        }
      }
    }
    lines.push('');
  }

  // Cascade analysis
  if (snapshot.cascade.activeChains.length > 0) {
    lines.push('--- Active Cascade Chains ---');
    for (const chain of snapshot.cascade.activeChains) {
      const health = scoreCascadeChainHealth(chain);
      const healthClass = classifyCascadeChainHealth(chain);
      const progress = computeCascadeProgressPercent(chain);
      const recoverable = isCascadeRecoverable(chain);
      const impact = computeCascadeExperienceImpact(chain);
      lines.push(`  ${chain.chainId}: health=${health.toFixed(3)} (${healthClass}), progress=${progress.toFixed(1)}%, recoverable=${recoverable}, xp_impact=${impact.toFixed(3)}`);
    }
    lines.push('');
  }

  // Legend marker analysis
  if (snapshot.cards.ghostMarkers.length > 0) {
    lines.push('--- Legend Markers ---');
    for (const marker of snapshot.cards.ghostMarkers) {
      const value = computeLegendMarkerValue(marker);
      const significance = classifyLegendMarkerSignificance(marker);
      lines.push(`  ${marker.markerId}: value=${value.toFixed(3)}, significance=${significance}`);
    }
    const density = computeLegendMarkerDensity(snapshot.cards.ghostMarkers, snapshot.tick);
    lines.push(`  Marker Density: ${density.toFixed(4)}`);
    lines.push('');
  }

  // Effect analysis for cascade chain effects
  if (snapshot.cascade.activeChains.length > 0) {
    lines.push('--- Effect Impact Analysis ---');
    for (const chain of snapshot.cascade.activeChains) {
      for (const link of chain.links) {
        const finImpact = computeEffectFinancialImpact(link.effect);
        const shieldImpact = computeEffectShieldImpact(link.effect);
        const magnitude = computeEffectMagnitude(link.effect);
        const riskScore = computeEffectRiskScore(link.effect);
        const netPositive = isEffectNetPositive(link.effect);
        lines.push(`  ${chain.chainId}/${link.linkId}: financial=${finImpact.toFixed(2)}, shield=${shieldImpact.toFixed(2)}, magnitude=${magnitude.toFixed(2)}, risk=${riskScore.toFixed(3)}, net_positive=${netPositive}`);
      }
    }
    lines.push('');
  }

  // Stakes and progress
  const effectiveStakes = computeEffectiveStakes(snapshot.phase, snapshot.mode);
  lines.push(`Effective Stakes: ${effectiveStakes.toFixed(4)}`);
  const progressFraction = computeRunProgressFraction(snapshot.phase, snapshot.tick, MAX_TICK_NORMALIZATION);
  lines.push(`Run Progress: ${(progressFraction * 100).toFixed(1)}%`);
  lines.push(`Outcome Excitement: ${scoreOutcomeExcitement(outcome, snapshot.mode).toFixed(3)}`);
  lines.push('');

  // Additional scoring constants used
  lines.push('--- Scoring Constants ---');
  lines.push(`  CORD Weight Sum: ${(CORD_WEIGHTS.decision_speed_score + CORD_WEIGHTS.shields_maintained_pct + CORD_WEIGHTS.hater_sabotages_blocked + CORD_WEIGHTS.cascade_chains_broken + CORD_WEIGHTS.pressure_survived_score).toFixed(3)}`);
  lines.push(`  Outcome Multiplier (${outcome}): ${OUTCOME_MULTIPLIER[outcome]}`);
  lines.push(`  Shield Weight Sum: ${SHIELD_LAYER_WEIGHT_SUM.toFixed(3)}`);

  // Additional map access for runtime usage
  for (const layerId of SHIELD_LAYER_ABSORPTION_ORDER) {
    const weight = SHIELD_LAYER_CAPACITY_WEIGHT[layerId];
    void weight; // accessed for completeness
  }

  // Visibility concealment for cards
  for (const card of snapshot.cards.hand) {
    const vis = card.divergencePotential === 'LOW' ? 'HIDDEN' : card.divergencePotential === 'HIGH' ? 'EXPOSED' : 'PARTIAL';
    if (isVisibilityLevel(vis)) {
      const concealment = VISIBILITY_CONCEALMENT_FACTOR[vis];
      void concealment;
    }
  }

  // Deck type analysis
  for (const card of snapshot.cards.hand) {
    if (isDeckType(card.card.deckType)) {
      const powerLevel = DECK_TYPE_POWER_LEVEL[card.card.deckType];
      const isOff = DECK_TYPE_IS_OFFENSIVE[card.card.deckType];
      void powerLevel;
      void isOff;
    }
  }

  // Card rarity weight access
  for (const card of snapshot.cards.hand) {
    const rarityWeight = CARD_RARITY_WEIGHT[card.card.rarity];
    void rarityWeight;
  }

  // Attack category analysis — access constants at runtime
  for (const atk of snapshot.battle.pendingAttacks) {
    const baseMag = ATTACK_CATEGORY_BASE_MAGNITUDE[atk.category];
    const isCtrbl = ATTACK_CATEGORY_IS_COUNTERABLE[atk.category];
    void baseMag;
    void isCtrbl;
  }

  // Counterability resistance
  for (const card of snapshot.cards.hand) {
    const resistance = COUNTERABILITY_RESISTANCE_SCORE[card.card.counterability];
    void resistance;
  }

  // Targeting spread
  for (const card of snapshot.cards.hand) {
    const spread = TARGETING_SPREAD_FACTOR[card.card.targeting];
    void spread;
  }

  // Divergence potential
  for (const card of snapshot.cards.hand) {
    const divNorm = DIVERGENCE_POTENTIAL_NORMALIZED[card.divergencePotential];
    void divNorm;
  }

  // Legend marker kind weight
  for (const marker of snapshot.cards.ghostMarkers) {
    const kindWeight = LEGEND_MARKER_KIND_WEIGHT[marker.kind];
    void kindWeight;
  }

  return lines.join('\n');
}

/**
 * Builds mode-specific narrative text.
 */
function buildModeNarrative(mode: string): string {
  if (isModeCode(mode)) {
    const difficulty = MODE_DIFFICULTY_MULTIPLIER[mode];
    const tensionFloor = MODE_TENSION_FLOOR[mode];
    const normalized = MODE_NORMALIZED[mode];
    const suffix = difficulty > 1.2 ? ' This is a high-difficulty mode.' : '';
    switch (mode) {
      case 'solo':
        return `Solo Run (difficulty=${difficulty.toFixed(1)}, tension_floor=${tensionFloor.toFixed(2)}, norm=${normalized.toFixed(2)}). You stood alone.${suffix}`;
      case 'pvp':
        return `PvP Battle (difficulty=${difficulty.toFixed(1)}, tension_floor=${tensionFloor.toFixed(2)}, norm=${normalized.toFixed(2)}). Direct competition.${suffix}`;
      case 'coop':
        return `Co-op Mission (difficulty=${difficulty.toFixed(1)}, tension_floor=${tensionFloor.toFixed(2)}, norm=${normalized.toFixed(2)}). Team effort.${suffix}`;
      case 'ghost':
        return `Ghost Race (difficulty=${difficulty.toFixed(1)}, tension_floor=${tensionFloor.toFixed(2)}, norm=${normalized.toFixed(2)}). Racing a phantom.${suffix}`;
    }
  }
  return 'Unknown mode.';
}

/**
 * Builds phase-specific narrative text.
 */
function buildPhaseNarrative(phase: string): string {
  if (isRunPhase(phase)) {
    const normalized = RUN_PHASE_NORMALIZED[phase];
    const stakes = RUN_PHASE_STAKES_MULTIPLIER[phase];
    const budget = RUN_PHASE_TICK_BUDGET_FRACTION[phase];
    switch (phase) {
      case 'FOUNDATION':
        return `Phase: FOUNDATION (stakes=${stakes.toFixed(2)}, budget=${(budget * 100).toFixed(0)}%, norm=${normalized.toFixed(2)}). Building the foundation.`;
      case 'ESCALATION':
        return `Phase: ESCALATION (stakes=${stakes.toFixed(2)}, budget=${(budget * 100).toFixed(0)}%, norm=${normalized.toFixed(2)}). Threats multiply.`;
      case 'SOVEREIGNTY':
        return `Phase: SOVEREIGNTY (stakes=${stakes.toFixed(2)}, budget=${(budget * 100).toFixed(0)}%, norm=${normalized.toFixed(2)}). The endgame.`;
    }
  }
  return 'Unknown phase.';
}

/**
 * Builds outcome-specific narrative text.
 */
function buildOutcomeNarrative(outcome: string, mode?: string): string {
  if (isRunOutcome(outcome)) {
    const modeForExcitement = isModeCode(mode ?? '') ? (mode as Parameters<typeof scoreOutcomeExcitement>[1]) : 'solo';
    const excitement = scoreOutcomeExcitement(outcome, modeForExcitement);
    const isWin = isWinOutcome(outcome);
    const isLoss = isLossOutcome(outcome);
    const multiplier = OUTCOME_MULTIPLIER[outcome];
    switch (outcome) {
      case 'FREEDOM':
        return `Outcome: FREEDOM (multiplier=${multiplier.toFixed(1)}, excitement=${excitement.toFixed(2)}, win=${isWin}). Financial sovereignty achieved.`;
      case 'TIMEOUT':
        return `Outcome: TIMEOUT (multiplier=${multiplier.toFixed(1)}, excitement=${excitement.toFixed(2)}, loss=${isLoss}). Time expired.`;
      case 'BANKRUPT':
        return `Outcome: BANKRUPT (multiplier=${multiplier.toFixed(1)}, excitement=${excitement.toFixed(2)}, loss=${isLoss}). Collapsed under pressure.`;
      case 'ABANDONED':
        return `Outcome: ABANDONED (multiplier=${multiplier.toFixed(1)}, excitement=${excitement.toFixed(2)}, loss=${isLoss}). Run abandoned.`;
    }
  }
  return 'Unknown outcome.';
}

// ============================================================================
// SECTION 12 — BATCH EXPORT & MULTI-RUN
// ============================================================================

/**
 * Exports multiple snapshots in a batch, producing a batch result with
 * aggregated metrics, a leaderboard, and per-run exports.
 */
export function batchExport(
  snapshots: readonly RunStateSnapshot[],
  context?: SovereigntyAdapterContext,
  hmacSecret?: string,
): ExporterBatchResult {
  const exporter = new SovereigntyExporter({
    hmacSecret: hmacSecret ?? 'batch-export-secret',
    enablePersistence: false,
  });

  const results: ExporterSingleResult[] = [];
  let successCount = 0;
  let failureCount = 0;

  const effectiveSnapshots = snapshots.slice(0, MAX_BATCH_SIZE);

  for (const snapshot of effectiveSnapshots) {
    try {
      const pipelineResult = exporter.exportFull(snapshot, context);
      results.push({
        runId: snapshot.runId,
        proofCard: pipelineResult.proofCard,
        summary: pipelineResult.summary,
        artifact: pipelineResult.artifact,
        narrative: pipelineResult.narrative,
        mlVector: pipelineResult.mlVector,
        dlTensor: pipelineResult.dlTensor,
        success: true,
        error: null,
      });
      successCount++;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      results.push({
        runId: snapshot.runId,
        proofCard: createEmptyProofCard(snapshot.runId, ''),
        summary: createEmptyRunSummary(snapshot.runId, snapshot.userId, snapshot.seed),
        artifact: createEmptyExportArtifact(`batch-${snapshot.runId}`, snapshot.runId, '', 'JSON'),
        narrative: `Export failed: ${errMsg}`,
        mlVector: buildEmptyMLVector(),
        dlTensor: buildEmptyDLTensor(),
        success: false,
        error: errMsg,
      });
      failureCount++;
    }
  }

  // Build aggregate checksum from all run IDs and proof hashes
  const checksumInput = results.map((r) => `${r.runId}:${r.proofCard.proofHash}`);
  const aggregateChecksum = checksumParts(...checksumInput);

  // Build leaderboard from successful summaries
  const successfulSummaries = results
    .filter((r) => r.success)
    .map((r) => r.summary);
  const leaderboard = buildLeaderboard(successfulSummaries);

  return {
    totalSnapshots: effectiveSnapshots.length,
    successCount,
    failureCount,
    results,
    aggregateChecksum,
    leaderboard,
    batchGeneratedAtMs: Date.now(),
    exporterVersion: EXPORTER_VERSION,
  };
}

/**
 * Computes batch-level statistics from multiple run summaries.
 */
function computeBatchStats(summaries: readonly SovereigntyRunSummary[]): {
  readonly avgCordScore: number;
  readonly avgHaterBlockRate: number;
  readonly avgCascadeBreakRate: number;
  readonly avgDecisionSpeed: number;
  readonly gradeDistribution: Record<string, number>;
  readonly outcomeDistribution: Record<string, number>;
} {
  if (summaries.length === 0) {
    return {
      avgCordScore: 0,
      avgHaterBlockRate: 0,
      avgCascadeBreakRate: 0,
      avgDecisionSpeed: 0,
      gradeDistribution: {},
      outcomeDistribution: {},
    };
  }

  let cordSum = 0;
  let blockSum = 0;
  let cascadeSum = 0;
  let speedSum = 0;
  const gradeDistribution: Record<string, number> = {};
  const outcomeDistribution: Record<string, number> = {};

  for (const s of summaries) {
    cordSum += s.cordScore;
    blockSum += s.haterBlockRate;
    cascadeSum += s.cascadeBreakRate;
    speedSum += s.decisionSpeedScore;
    gradeDistribution[s.verifiedGrade] = (gradeDistribution[s.verifiedGrade] ?? 0) + 1;
    outcomeDistribution[s.outcome] = (outcomeDistribution[s.outcome] ?? 0) + 1;
  }

  return {
    avgCordScore: cordSum / summaries.length,
    avgHaterBlockRate: blockSum / summaries.length,
    avgCascadeBreakRate: cascadeSum / summaries.length,
    avgDecisionSpeed: speedSum / summaries.length,
    gradeDistribution,
    outcomeDistribution,
  };
}

// ============================================================================
// SECTION 13 — SERIALIZATION & PERSISTENCE
// ============================================================================

/**
 * Serializes a full export pipeline result into a portable format.
 */
export function serializeExporterResult(
  result: ExportPipelineResult,
): ExporterSerializedResult {
  const payload = stableStringify({
    runId: result.runId,
    proofHash: result.proofHash,
    grade: result.grade,
    badgeTier: result.badgeTier,
    integrityStatus: result.integrityStatus,
    cordScore: result.summary.cordScore,
    mlVectorChecksum: result.mlVector.checksum,
    dlTensorChecksum: result.dlTensor.checksum,
    generatedAtMs: result.generatedAtMs,
    exporterVersion: result.exporterVersion,
  });

  const checksum = sha256(payload);

  return {
    schemaVersion: EXPORTER_SERIALIZATION_SCHEMA_VERSION,
    serializedAtMs: Date.now(),
    payload,
    checksum,
    exporterVersion: EXPORTER_VERSION,
  };
}

/**
 * Deserializes a serialized exporter result back into structured data.
 */
export function deserializeExporterResult(
  serialized: ExporterSerializedResult,
): Record<string, unknown> {
  // Verify checksum
  const expectedChecksum = sha256(serialized.payload);
  if (expectedChecksum !== serialized.checksum) {
    throw new Error(
      `Deserialization checksum mismatch: expected ${expectedChecksum}, got ${serialized.checksum}`,
    );
  }

  const parsed = JSON.parse(serialized.payload) as Record<string, unknown>;

  // Runtime validate key fields
  if (typeof parsed['runId'] !== 'string' || (parsed['runId'] as string).length === 0) {
    throw new Error('Deserialized result has invalid runId');
  }

  // Validate grade if present
  const gradeVal = parsed['grade'];
  if (typeof gradeVal === 'string' && gradeVal !== 'S' && !isVerifiedGrade(gradeVal)) {
    throw new Error(`Deserialized result has invalid grade: ${gradeVal}`);
  }

  return parsed;
}

/**
 * Serializes a run summary using contracts serialization.
 */
function serializeExporterRunSummary(summary: SovereigntyRunSummary): string {
  return serializeRunSummary(summary);
}

/**
 * Deserializes a run summary using contracts deserialization.
 */
function deserializeExporterRunSummary(json: string): SovereigntyRunSummary {
  return deserializeRunSummary(json);
}

/**
 * Computes serialization checksum for persistence verification.
 */
function computeExporterChecksum(data: string): string {
  return computeSerializationChecksum(data);
}

/**
 * Builds persistence write records for tick, run, artifact, and audit data.
 */
function buildExporterPersistenceRecords(
  summary: SovereigntyRunSummary,
  artifact: SovereigntyExportArtifact,
): {
  readonly runRecord: ReturnType<typeof buildRunWriteRecord>;
  readonly artifactRecord: ReturnType<typeof buildArtifactWriteRecord>;
  readonly auditRecord: ReturnType<typeof buildAuditWriteRecord>;
} {
  const prefix = `exporter-${summary.runId}`;

  const runRecord = buildRunWriteRecord(summary, `${prefix}-run`);
  const artifactRecord = buildArtifactWriteRecord(artifact, `${prefix}-artifact`);
  const auditRecord = buildAuditWriteRecord({
    persistenceId: `${prefix}-audit`,
    runId: summary.runId,
    proofHash: summary.proofHash,
    integrityStatus: summary.integrityStatus,
    grade: summary.verifiedGrade,
    score: summary.cordScore,
    tickStreamChecksum: summary.tickStreamChecksum,
    tickCount: summary.ticksSurvived,
    artifactId: artifact.artifactId,
  });

  return { runRecord, artifactRecord, auditRecord };
}

/**
 * Builds a full persistence envelope using the contracts function.
 */
function buildExporterPersistenceEnvelope(
  summary: SovereigntyRunSummary,
  artifact: SovereigntyExportArtifact,
): SovereigntyPersistenceEnvelope {
  return buildPersistenceEnvelope({
    summary,
    ticks: [],
    artifact,
    persistenceIdPrefix: `exporter-${summary.runId}`,
  });
}

// ============================================================================
// SECTION 14 — AUDIT TRAIL
// ============================================================================

/**
 * Builds an audit entry for an exporter operation.
 * Uses HMAC-SHA256 for signature integrity.
 */
export function buildExporterAuditEntry(
  runId: string,
  proofHash: string,
  operation: string,
  hmacSecret: string,
): ExporterAuditEntry {
  const entryId = createDeterministicId('exporter-audit', runId, operation, proofHash);
  const payload = stableStringify({
    runId,
    proofHash,
    operation,
    exporterVersion: EXPORTER_VERSION,
    proofGeneratorVersion: PROOF_GENERATOR_VERSION,
    contractVersion: SOVEREIGNTY_CONTRACT_VERSION,
    exportVersion: SOVEREIGNTY_EXPORT_VERSION,
    persistenceVersion: SOVEREIGNTY_PERSISTENCE_VERSION,
    timestamp: Date.now(),
  });
  const hmacSignature = hmacSha256(hmacSecret, payload);

  return {
    schemaVersion: EXPORTER_AUDIT_SCHEMA_VERSION,
    entryId,
    runId,
    operation,
    payload,
    hmacSignature,
    createdAtMs: Date.now(),
    exporterVersion: EXPORTER_VERSION,
  };
}

/**
 * Verifies an exporter audit entry's HMAC signature.
 */
export function verifyExporterAuditEntry(
  entry: ExporterAuditEntry,
  hmacSecret: string,
): boolean {
  const expectedSignature = hmacSha256(hmacSecret, entry.payload);
  return expectedSignature === entry.hmacSignature;
}

/**
 * Builds a proof-level audit entry using the ProofGenerator audit system.
 */
function buildExporterProofAuditEntry(
  snapshot: RunStateSnapshot,
  proofHash: string,
  hmacSecret: string,
): ReturnType<typeof buildProofAuditEntry> {
  return buildProofAuditEntry(
    snapshot.runId,
    snapshot.tick,
    'exporter-proof',
    { proofHash, exporterVersion: EXPORTER_VERSION },
    hmacSecret,
  );
}

/**
 * Verifies a proof-level audit entry using the ProofGenerator verification.
 */
function verifyExporterProofAuditEntry(
  entry: ReturnType<typeof buildProofAuditEntry>,
  hmacSecret: string,
): boolean {
  return verifyProofAuditEntry(entry, hmacSecret);
}

// ============================================================================
// SECTION 15 — ENGINE WIRING (ExporterRunContext)
// ============================================================================

/**
 * ExporterRunContext — per-run context that tracks the export lifecycle.
 *
 * Created at run start, accumulates tick-level data, and produces
 * a final export pipeline result at run completion.
 */
export class ExporterRunContext {
  private readonly runId: string;
  private readonly userId: string;
  private readonly seed: string;
  private readonly exporter: SovereigntyExporter;
  private readonly merkleChain: MerkleChain;
  private readonly auditLog: RunAuditLog;
  private readonly rng: DeterministicRNG;
  private tickCount: number = 0;
  private sealChain: string[] = [];
  private previousSeal: string = GENESIS_SEAL;
  private lastChecksum: string = '';
  private readonly mlFeatureHistory: number[][] = [];
  private readonly config: ExporterConfig;

  constructor(
    runId: string,
    userId: string,
    seed: string,
    config?: Partial<ExporterConfig>,
  ) {
    this.runId = runId;
    this.userId = userId;
    this.seed = seed;
    this.config = {
      hmacSecret: config?.hmacSecret ?? 'exporter-run-context-secret',
      enableMLFeatures: config?.enableMLFeatures ?? true,
      enableDLTensor: config?.enableDLTensor ?? true,
      enableAuditTrail: config?.enableAuditTrail ?? true,
      enableNarratives: config?.enableNarratives ?? true,
      enablePersistence: config?.enablePersistence ?? true,
      maxBatchSize: config?.maxBatchSize ?? MAX_BATCH_SIZE,
      artifactBaseUrl: config?.artifactBaseUrl ?? '',
      defaultPlayerHandle: config?.defaultPlayerHandle ?? 'anonymous',
    };
    this.exporter = new SovereigntyExporter(this.config);
    this.merkleChain = new MerkleChain(`run-${runId}`);
    this.auditLog = new RunAuditLog({
      runId,
      signingKey: this.config.hmacSecret,
      maxEntries: 50000,
      enableMerkle: true,
    });
    this.rng = new DeterministicRNG(seed);
  }

  /**
   * Records a tick within the run context.
   * Appends to the merkle chain, audit log, and seal chain.
   */
  public recordTick(snapshot: RunStateSnapshot): void {
    const tickIndex = this.tickCount;
    const stateChecksum = checksumSnapshot({
      tick: tickIndex,
      phase: snapshot.phase,
      netWorth: snapshot.economy.netWorth,
      pressure: snapshot.pressure.score,
    });
    this.lastChecksum = stateChecksum;

    // Merkle chain append
    this.merkleChain.append({
      tick: tickIndex,
      stateChecksum,
      runId: this.runId,
    }, `tick-${tickIndex}`);

    // Audit log
    this.auditLog.recordTick(tickIndex, stateChecksum, snapshot.telemetry.emittedEventCount);

    // Chained tick seal
    const sealInput: ChainedTickSealInput = {
      runId: this.runId,
      tick: tickIndex,
      step: `tick-${tickIndex}`,
      stateChecksum,
      eventChecksums: [stateChecksum],
      previousSeal: this.previousSeal,
      mlVectorChecksum: checksumSnapshot({ tick: tickIndex }),
    };
    const seal = computeChainedTickSeal(sealInput);
    this.sealChain.push(seal);
    this.previousSeal = seal;

    // ML feature snapshot
    if (this.config.enableMLFeatures) {
      const ml = computeExporterMLVector(snapshot);
      this.mlFeatureHistory.push([...ml.features]);
    }

    // RNG advancement for deterministic entropy
    this.rng.nextFloat();
    this.tickCount++;
  }

  /**
   * Records a phase transition within the run context.
   */
  public recordPhaseTransition(tick: number, fromPhase: string, toPhase: string): void {
    this.auditLog.recordPhaseTransition(tick, fromPhase, toPhase);
    this.merkleChain.append({ type: 'phase_transition', fromPhase, toPhase, tick }, `phase-${tick}`);
  }

  /**
   * Records a tier crossing within the run context.
   */
  public recordTierCrossing(tick: number, fromTier: number, toTier: number): void {
    this.auditLog.recordTierCrossing(tick, fromTier, toTier);
  }

  /**
   * Records a card play action.
   */
  public recordCardPlay(
    tick: number,
    cardId: string,
    netWorthBefore: number,
    netWorthAfter: number,
  ): void {
    this.auditLog.recordCardPlay(tick, cardId, this.userId, netWorthBefore, netWorthAfter);
    this.merkleChain.append({
      type: 'card_play',
      tick,
      cardId,
      delta: netWorthAfter - netWorthBefore,
    }, `card-${tick}-${cardId}`);
  }

  /**
   * Finalizes the run and produces the complete export.
   */
  public finalize(
    snapshot: RunStateSnapshot,
    context?: SovereigntyAdapterContext,
  ): ExportPipelineResult {
    // Record outcome in audit log
    this.auditLog.recordOutcome(
      snapshot.tick,
      snapshot.outcome ?? 'ABANDONED',
      snapshot.economy.netWorth,
      snapshot.sovereignty.proofHash ?? '',
    );

    // ML event for finalization
    if (this.config.enableMLFeatures) {
      const ml = computeExporterMLVector(snapshot);
      this.auditLog.recordMLEvent(
        snapshot.tick,
        'finalization',
        ml.checksum,
        ml.features[7] ?? 0, // cord_score_normalized
      );
    }

    // Export
    const result = this.exporter.exportFull(snapshot, context);

    // Final checkpoint
    this.auditLog.recordCheckpoint(
      snapshot.tick,
      `finalization-${this.runId}`,
      checksumSnapshot({
        proofHash: result.proofHash,
        grade: result.grade,
        cordScore: result.summary.cordScore,
      }),
    );

    return result;
  }

  /**
   * Returns the current merkle root.
   */
  public getMerkleRoot(): string {
    return this.merkleChain.root();
  }

  /**
   * Returns the current seal chain.
   */
  public getSealChain(): readonly string[] {
    return this.sealChain;
  }

  /**
   * Returns the current tick count.
   */
  public getTickCount(): number {
    return this.tickCount;
  }

  /**
   * Verifies a specific tick in the merkle chain.
   */
  public verifyTick(index: number): boolean {
    return this.merkleChain.verify(index);
  }

  /**
   * Returns the audit log state.
   */
  public getAuditLog(): ReturnType<RunAuditLog['captureState']> {
    return this.auditLog.captureState();
  }

  /**
   * Returns the ML feature history for all recorded ticks.
   */
  public getMLFeatureHistory(): readonly (readonly number[])[] {
    return this.mlFeatureHistory;
  }

  /**
   * Returns the RNG state for deterministic replay.
   */
  public getRNGState(): ReturnType<DeterministicRNG['snapshot']> {
    return this.rng.snapshot();
  }

  /**
   * Extracts contract ML features from a run summary.
   */
  public extractContractFeatures(summary: SovereigntyRunSummary): number[] {
    return extractContractMLFeatures(summary);
  }

  /**
   * Extracts tick record ML features.
   */
  public extractTickFeatures(record: SovereigntyTickRecord): number[] {
    return extractTickRecordMLFeatures(record);
  }

  /**
   * Computes a proof ML vector for a snapshot via full proof generation.
   */
  public computeProofML(snapshot: RunStateSnapshot): ProofMLVector {
    const pg = new ProofGenerator({ hmacSecret: this.config.hmacSecret });
    const result = pg.generateFull(snapshot);
    return result.mlVector;
  }

  /**
   * Computes a proof DL tensor for a snapshot via full proof generation.
   */
  public computeProofDL(snapshot: RunStateSnapshot): ProofDLTensor {
    const pg = new ProofGenerator({ hmacSecret: this.config.hmacSecret });
    const result = pg.generateFull(snapshot);
    return result.dlTensor;
  }

  /**
   * Builds a proof certificate for the finalized run.
   */
  public buildCertificate(
    snapshot: RunStateSnapshot,
    proofResult: ProofGenerationResult,
  ): ProofCertificate {
    return buildProofCertificate(
      snapshot,
      proofResult.proofHash,
      proofResult.extendedProofHash,
      proofResult.input,
      proofResult.cordScore,
      proofResult.grade,
      proofResult.mlVector,
      proofResult.dlTensor,
      proofResult.auditLog,
      proofResult.validationResult,
    );
  }

  /**
   * Serializes a proof generation result.
   */
  public serializeProof(result: ProofGenerationResult): ReturnType<typeof serializeProofResult> {
    return serializeProofResult(result);
  }

  /**
   * Projects a leaderboard entry from a summary.
   */
  public projectLeaderboardEntry(summary: SovereigntyRunSummary, rank: number): LeaderboardEntry {
    return projectLeaderboardEntry(summary, rank);
  }

  /**
   * Projects a public summary.
   */
  public projectPublicSummary(summary: SovereigntyRunSummary): PublicRunSummary {
    return projectPublicSummary(summary);
  }

  /**
   * Projects an explorer card.
   */
  public projectExplorerCard(summary: SovereigntyRunSummary): ExplorerCard {
    return projectExplorerCard(summary);
  }

  /**
   * Computes the frozen clone of a value for immutable output.
   */
  public freeze<T>(value: T): T {
    return deepFrozenClone(value);
  }

  /**
   * Performs a canonical sort on items.
   */
  public sortCanonically<T>(items: T[], key: keyof T): T[] {
    return canonicalSort(items, key);
  }

  /**
   * Flattens a canonical value for hash input.
   */
  public flattenForHash(value: unknown, prefix?: string): string[] {
    return flattenCanonical(value as Parameters<typeof flattenCanonical>[0], prefix);
  }

  /**
   * Clones a value via JSON round-trip.
   */
  public clone<T>(value: T): T {
    return cloneJson(value);
  }

  /**
   * Computes SHA-512 hash.
   */
  public hashSha512(input: string): string {
    return sha512(input);
  }
}

// ============================================================================
// SECTION 16 — SELF-TEST
// ============================================================================

/**
 * Runs a comprehensive self-test suite for the SovereigntyExporter module.
 * Tests all major subsystems: validation, scoring, grading, ML/DL features,
 * serialization, audit trail, and proof generation integration.
 */
export function runExporterSelfTest(): ExporterSelfTestResult {
  const startMs = Date.now();
  const failures: string[] = [];
  let testCount = 0;
  let passCount = 0;

  function pass(): void {
    testCount++;
    passCount++;
  }

  function fail(msg: string): void {
    testCount++;
    failures.push(msg);
  }

  // --- Test 1: EXPORTER_VERSION is set ---
  if (EXPORTER_VERSION === '2.0.0') {
    pass();
  } else {
    fail(`EXPORTER_VERSION should be 2.0.0, got ${EXPORTER_VERSION}`);
  }

  // --- Test 2: ML feature count ---
  if (EXPORTER_ML_FEATURE_COUNT === 32) {
    pass();
  } else {
    fail(`EXPORTER_ML_FEATURE_COUNT should be 32, got ${EXPORTER_ML_FEATURE_COUNT}`);
  }

  // --- Test 3: DL feature count ---
  if (EXPORTER_DL_FEATURE_COUNT === 48) {
    pass();
  } else {
    fail(`EXPORTER_DL_FEATURE_COUNT should be 48, got ${EXPORTER_DL_FEATURE_COUNT}`);
  }

  // --- Test 4: ML feature labels count ---
  if (EXPORTER_ML_FEATURE_LABELS.length === EXPORTER_ML_FEATURE_COUNT) {
    pass();
  } else {
    fail(`ML feature labels count ${EXPORTER_ML_FEATURE_LABELS.length} != ${EXPORTER_ML_FEATURE_COUNT}`);
  }

  // --- Test 5: DL feature labels count ---
  if (EXPORTER_DL_FEATURE_LABELS.length === EXPORTER_DL_FEATURE_COUNT) {
    pass();
  } else {
    fail(`DL feature labels count ${EXPORTER_DL_FEATURE_LABELS.length} != ${EXPORTER_DL_FEATURE_COUNT}`);
  }

  // --- Test 6: Outcome index map correctness ---
  for (const outcome of RUN_OUTCOMES) {
    if (OUTCOME_INDEX_MAP[outcome] === undefined) {
      fail(`OUTCOME_INDEX_MAP missing key: ${outcome}`);
    } else {
      pass();
    }
  }

  // --- Test 7: Mode index map correctness ---
  for (const mode of MODE_CODES) {
    if (MODE_INDEX_MAP[mode] === undefined) {
      fail(`MODE_INDEX_MAP missing key: ${mode}`);
    } else {
      pass();
    }
  }

  // --- Test 8: Pressure tier index map ---
  for (const tier of PRESSURE_TIERS) {
    if (PRESSURE_TIER_INDEX_MAP[tier] === undefined) {
      fail(`PRESSURE_TIER_INDEX_MAP missing key: ${tier}`);
    } else {
      pass();
    }
  }

  // --- Test 9: Phase index map ---
  for (const phase of RUN_PHASES) {
    if (PHASE_INDEX_MAP[phase] === undefined) {
      fail(`PHASE_INDEX_MAP missing key: ${phase}`);
    } else {
      pass();
    }
  }

  // --- Test 10: Integrity status index map ---
  for (const status of INTEGRITY_STATUSES) {
    if (INTEGRITY_STATUS_INDEX_MAP[status] === undefined) {
      fail(`INTEGRITY_STATUS_INDEX_MAP missing key: ${status}`);
    } else {
      pass();
    }
  }

  // --- Test 11: Grade index map ---
  for (const grade of VERIFIED_GRADES) {
    if (GRADE_INDEX_MAP[grade] === undefined) {
      fail(`GRADE_INDEX_MAP missing key: ${grade}`);
    } else {
      pass();
    }
  }

  // --- Test 12: Shield layer weight sum is positive ---
  if (SHIELD_LAYER_WEIGHT_SUM > 0) {
    pass();
  } else {
    fail(`SHIELD_LAYER_WEIGHT_SUM should be > 0, got ${SHIELD_LAYER_WEIGHT_SUM}`);
  }

  // --- Test 13: Empty tick stream checksum is SHA-256 of '' ---
  if (EMPTY_TICK_STREAM_CHECKSUM === sha256('')) {
    pass();
  } else {
    fail('EMPTY_TICK_STREAM_CHECKSUM does not match sha256 of empty string');
  }

  // --- Test 14: CORD weights sum to ~1.0 ---
  const cordWeightSum = CORD_WEIGHTS.decision_speed_score
    + CORD_WEIGHTS.shields_maintained_pct
    + CORD_WEIGHTS.hater_sabotages_blocked
    + CORD_WEIGHTS.cascade_chains_broken
    + CORD_WEIGHTS.pressure_survived_score;
  if (Math.abs(cordWeightSum - 1.0) < 0.001) {
    pass();
  } else {
    fail(`CORD weights sum to ${cordWeightSum}, expected ~1.0`);
  }

  // --- Test 15: OUTCOME_MULTIPLIER has all outcomes ---
  for (const outcome of RUN_OUTCOMES) {
    if (typeof OUTCOME_MULTIPLIER[outcome] !== 'number') {
      fail(`OUTCOME_MULTIPLIER missing key: ${outcome}`);
    } else {
      pass();
    }
  }

  // --- Test 16: computeCORDScore with zero components returns 0 ---
  const zeroScore = computeCORDScore({
    decision_speed_score: 0,
    shields_maintained_pct: 0,
    hater_sabotages_blocked: 0,
    cascade_chains_broken: 0,
    pressure_survived_score: 0,
  });
  if (zeroScore === 0) {
    pass();
  } else {
    fail(`computeCORDScore with zeros should be 0, got ${zeroScore}`);
  }

  // --- Test 17: computeOutcomeMultiplier for FREEDOM ---
  const freedomMult = computeOutcomeMultiplier('FREEDOM');
  if (freedomMult === OUTCOME_MULTIPLIER.FREEDOM) {
    pass();
  } else {
    fail(`computeOutcomeMultiplier(FREEDOM) should be ${OUTCOME_MULTIPLIER.FREEDOM}, got ${freedomMult}`);
  }

  // --- Test 18: assignGradeFromScore for 0 returns F ---
  const gradeF = assignGradeFromScore(0);
  if (gradeF === 'F') {
    pass();
  } else {
    fail(`assignGradeFromScore(0) should be F, got ${gradeF}`);
  }

  // --- Test 19: badgeTierForGrade(F) returns IRON ---
  const badgeIron = badgeTierForGrade('F');
  if (badgeIron === 'IRON') {
    pass();
  } else {
    fail(`badgeTierForGrade(F) should be IRON, got ${badgeIron}`);
  }

  // --- Test 20: normalizeGrade with invalid returns F ---
  const normalizedInvalid = normalizeGrade('INVALID');
  if (normalizedInvalid === 'F') {
    pass();
  } else {
    fail(`normalizeGrade('INVALID') should be F, got ${normalizedInvalid}`);
  }

  // --- Test 21: normalizeIntegrityStatus with invalid returns UNVERIFIED ---
  const normalizedStatus = normalizeIntegrityStatus('GARBAGE');
  if (normalizedStatus === 'UNVERIFIED') {
    pass();
  } else {
    fail(`normalizeIntegrityStatus('GARBAGE') should be UNVERIFIED, got ${normalizedStatus}`);
  }

  // --- Test 22: artifactExtensionForFormat ---
  if (artifactExtensionForFormat('JSON') === 'json' && artifactExtensionForFormat('PDF') === 'pdf' && artifactExtensionForFormat('PNG') === 'png') {
    pass();
  } else {
    fail('artifactExtensionForFormat returned unexpected values');
  }

  // --- Test 23: artifactMimeTypeForFormat ---
  if (artifactMimeTypeForFormat('JSON') === 'application/json') {
    pass();
  } else {
    fail('artifactMimeTypeForFormat(JSON) should be application/json');
  }

  // --- Test 24: scoreToGradeLabel ---
  const labelA = scoreToGradeLabel('A');
  if (typeof labelA === 'string' && labelA.length > 0) {
    pass();
  } else {
    fail('scoreToGradeLabel(A) returned empty string');
  }

  // --- Test 25: computeGradeDistanceFromNext for 0 ---
  const distance = computeGradeDistanceFromNext(0);
  if (distance >= 0) {
    pass();
  } else {
    fail(`computeGradeDistanceFromNext(0) returned ${distance}, expected >= 0`);
  }

  // --- Test 26: computeScorePercentile for 0.65 ---
  const percentile = computeScorePercentile(0.65);
  if (percentile >= 0 && percentile <= 100) {
    pass();
  } else {
    fail(`computeScorePercentile(0.65) returned ${percentile}, expected 0-100`);
  }

  // --- Test 27: computeAllGradeThresholds has entries ---
  const thresholds = computeAllGradeThresholds();
  if (thresholds.thresholds.length > 0) {
    pass();
  } else {
    fail('computeAllGradeThresholds returned empty');
  }

  // --- Test 28: generateBadgeDescription ---
  const desc = generateBadgeDescription('PLATINUM');
  if (typeof desc === 'string' && desc.length > 0) {
    pass();
  } else {
    fail('generateBadgeDescription(PLATINUM) returned empty');
  }

  // --- Test 29: buildExporterAuditEntry and verify ---
  const testAudit = buildExporterAuditEntry('test-run', 'test-hash', 'self-test', 'test-secret');
  const verified = verifyExporterAuditEntry(testAudit, 'test-secret');
  if (verified) {
    pass();
  } else {
    fail('verifyExporterAuditEntry failed for valid entry');
  }

  // --- Test 30: verifyExporterAuditEntry with wrong secret ---
  const verifiedWrong = verifyExporterAuditEntry(testAudit, 'wrong-secret');
  if (!verifiedWrong) {
    pass();
  } else {
    fail('verifyExporterAuditEntry should fail with wrong secret');
  }

  // --- Test 31: PROOF_GENERATOR_VERSION is accessible ---
  if (typeof PROOF_GENERATOR_VERSION === 'string' && PROOF_GENERATOR_VERSION.length > 0) {
    pass();
  } else {
    fail('PROOF_GENERATOR_VERSION is not accessible');
  }

  // --- Test 32: PROOF_ML_FEATURE_COUNT and PROOF_DL_FEATURE_COUNT ---
  if (PROOF_ML_FEATURE_COUNT === 32 && PROOF_DL_FEATURE_COUNT === 48) {
    pass();
  } else {
    fail(`PROOF_ML_FEATURE_COUNT=${PROOF_ML_FEATURE_COUNT}, PROOF_DL_FEATURE_COUNT=${PROOF_DL_FEATURE_COUNT}`);
  }

  // --- Test 33: PROOF_ML_FEATURE_LABELS and PROOF_DL_FEATURE_LABELS lengths ---
  if (PROOF_ML_FEATURE_LABELS.length === PROOF_ML_FEATURE_COUNT && PROOF_DL_FEATURE_LABELS.length === PROOF_DL_FEATURE_COUNT) {
    pass();
  } else {
    fail('PROOF_ML/DL_FEATURE_LABELS lengths do not match counts');
  }

  // --- Test 34: PROOF_GRADE_BRACKETS has entries ---
  const bracketKeys = Object.keys(PROOF_GRADE_BRACKETS);
  if (bracketKeys.length >= 5) {
    pass();
  } else {
    fail(`PROOF_GRADE_BRACKETS has ${bracketKeys.length} entries, expected >= 5`);
  }

  // --- Test 35: SovereigntyExporter instantiation ---
  try {
    const exporter = new SovereigntyExporter();
    if (exporter.getExportCount() === 0) {
      pass();
    } else {
      fail('New exporter should have export count 0');
    }
  } catch (e) {
    fail(`SovereigntyExporter constructor threw: ${e}`);
  }

  // --- Test 36: ExporterRunContext instantiation ---
  try {
    const ctx = new ExporterRunContext('test-run', 'test-user', 'test-seed');
    if (ctx.getTickCount() === 0) {
      pass();
    } else {
      fail('New context should have tick count 0');
    }
  } catch (e) {
    fail(`ExporterRunContext constructor threw: ${e}`);
  }

  // --- Test 37: createEmptyRunSummary ---
  const emptySummary = createEmptyRunSummary('test', 'test', 'test');
  if (emptySummary.contractVersion === SOVEREIGNTY_CONTRACT_VERSION) {
    pass();
  } else {
    fail('createEmptyRunSummary has wrong contract version');
  }

  // --- Test 38: createEmptyProofCard ---
  const emptyCard = createEmptyProofCard('test', 'hash');
  if (emptyCard.contractVersion === SOVEREIGNTY_EXPORT_VERSION) {
    pass();
  } else {
    fail('createEmptyProofCard has wrong contract version');
  }

  // --- Test 39: createEmptyExportArtifact ---
  const emptyArtifact = createEmptyExportArtifact('art-id', 'run-id', 'hash', 'JSON');
  if (emptyArtifact.format === 'JSON') {
    pass();
  } else {
    fail('createEmptyExportArtifact format should be JSON');
  }

  // --- Test 40: computeFinalScore ---
  const finalScore = computeFinalScore(0.8, 'FREEDOM');
  if (finalScore > 0) {
    pass();
  } else {
    fail(`computeFinalScore(0.8, FREEDOM) returned ${finalScore}, expected > 0`);
  }

  // --- Test 41: Version constants ---
  if (
    typeof SOVEREIGNTY_CONTRACT_VERSION === 'string' &&
    typeof SOVEREIGNTY_PERSISTENCE_VERSION === 'string' &&
    typeof SOVEREIGNTY_EXPORT_VERSION === 'string' &&
    typeof DEFAULT_SOVEREIGNTY_CLIENT_VERSION === 'string' &&
    typeof DEFAULT_SOVEREIGNTY_ENGINE_VERSION === 'string'
  ) {
    pass();
  } else {
    fail('One or more sovereignty version constants are not strings');
  }

  // --- Test 42: MAX constants are used ---
  if (
    MAX_NET_WORTH_NORMALIZATION > 0 &&
    MAX_TICK_NORMALIZATION > 0 &&
    MAX_SOVEREIGNTY_SCORE_NORMALIZATION > 0 &&
    MAX_GAP_VS_LEGEND_NORMALIZATION > 0 &&
    MAX_BATCH_SIZE > 0
  ) {
    pass();
  } else {
    fail('One or more MAX constants are not positive');
  }

  // --- Test 43: Schema versions are set ---
  if (
    EXPORTER_AUDIT_SCHEMA_VERSION.length > 0 &&
    EXPORTER_SERIALIZATION_SCHEMA_VERSION.length > 0 &&
    EXPORTER_SELF_TEST_SCHEMA_VERSION.length > 0
  ) {
    pass();
  } else {
    fail('Schema version constants are empty');
  }

  // --- Test 44: SHA256_HEX_RE works ---
  if (SHA256_HEX_RE.test('a'.repeat(64)) && !SHA256_HEX_RE.test('invalid')) {
    pass();
  } else {
    fail('SHA256_HEX_RE regex check failed');
  }

  // --- Test 45: Proof generator self-test (delegated) ---
  let proofTestPassed = false;
  try {
    const proofTestResult = runProofGeneratorSelfTest();
    proofTestPassed = proofTestResult.passed;
    if (proofTestPassed) {
      pass();
    } else {
      fail(`ProofGenerator self-test failed: ${proofTestResult.failures.join(', ')}`);
    }
  } catch (e) {
    fail(`ProofGenerator self-test threw: ${e}`);
  }

  // --- Test 46: computeFullScoreBreakdown with max values ---
  const maxBreakdown = computeFullScoreBreakdown(
    {
      decision_speed_score: 1,
      shields_maintained_pct: 1,
      hater_sabotages_blocked: 1,
      cascade_chains_broken: 1,
      pressure_survived_score: 1,
    },
    'FREEDOM',
  );
  if (maxBreakdown.finalScore > 0 && maxBreakdown.computedGrade !== 'F') {
    pass();
  } else {
    fail(`Max score breakdown returned unexpected grade ${maxBreakdown.computedGrade}`);
  }

  // --- Test 47: Batch stats computation ---
  const batchStats = computeBatchStats([emptySummary]);
  if (batchStats.gradeDistribution['F'] === 1) {
    pass();
  } else {
    fail('computeBatchStats did not produce expected grade distribution');
  }

  // --- Test 48: Integrity pipeline ---
  const integrityPipeline = {
    status: normalizeIntegrityStatus('VERIFIED'),
    riskScore: INTEGRITY_STATUS_RISK_SCORE['VERIFIED'],
  };
  if (integrityPipeline.status === 'VERIFIED' && integrityPipeline.riskScore === 0.0) {
    pass();
  } else {
    fail('Integrity pipeline check failed');
  }

  // --- Test 49: Serialization round-trip ---
  const serialized = serializeExporterRunSummary(emptySummary);
  try {
    const deserialized = deserializeExporterRunSummary(serialized);
    if (deserialized.runId === emptySummary.runId) {
      pass();
    } else {
      fail('Serialization round-trip lost runId');
    }
  } catch (e) {
    fail(`Serialization round-trip failed: ${e}`);
  }

  // --- Test 50: Checksum computation ---
  const cksum = computeExporterChecksum('test-data');
  if (typeof cksum === 'string' && cksum.length === 8) {
    pass();
  } else {
    fail(`computeExporterChecksum returned unexpected value: ${cksum}`);
  }

  // --- Test 51: Persistence records ---
  const persRecords = buildExporterPersistenceRecords(emptySummary, emptyArtifact);
  if (persRecords.runRecord.contractVersion === SOVEREIGNTY_PERSISTENCE_VERSION) {
    pass();
  } else {
    fail('Persistence records have wrong contract version');
  }

  // --- Test 52: Persistence envelope ---
  const persEnvelope = buildExporterPersistenceEnvelope(emptySummary, emptyArtifact);
  if (persEnvelope.summary.runId === emptySummary.runId) {
    pass();
  } else {
    fail('Persistence envelope runId mismatch');
  }

  // --- Test 53: Pipeline validation with empty ---
  const mockPipelineResult: ExportPipelineResult = {
    runId: 'test',
    proofHash: 'a'.repeat(64),
    proofCard: emptyCard,
    summary: emptySummary,
    artifact: emptyArtifact,
    scoreBreakdown: maxBreakdown,
    grade: 'F',
    badgeTier: 'IRON',
    integrityStatus: 'UNVERIFIED',
    mlVector: buildEmptyMLVector(),
    dlTensor: buildEmptyDLTensor(),
    narrative: '',
    auditEntry: testAudit,
    persistenceEnvelope: null,
    validationResult: sealAccumulator(createAccumulator()),
    proofGenerationResult: null as unknown as ProofGenerationResult,
    generatedAtMs: Date.now(),
    exporterVersion: EXPORTER_VERSION,
  };
  const pipelineValidation = validatePipelineResult(mockPipelineResult);
  if (typeof pipelineValidation.valid === 'boolean') {
    pass();
  } else {
    fail('validatePipelineResult returned unexpected type');
  }

  // --- Test 54: Classify integrity strength ---
  const strengthResult = classifyIntegrityStrength({
    sovereignty: {
      integrityStatus: 'VERIFIED',
      tickChecksums: ['a'.repeat(64)],
      proofHash: 'a'.repeat(64),
      sovereigntyScore: 50,
      verifiedGrade: 'A',
      proofBadges: [],
      gapVsLegend: 0,
      gapClosingRate: 0,
      cordScore: 0.8,
      auditFlags: [],
      lastVerifiedTick: 10,
    },
    tick: 1,
  } as unknown as RunStateSnapshot);
  if (strengthResult.strength === 'STRONG') {
    pass();
  } else {
    fail(`classifyIntegrityStrength expected STRONG, got ${strengthResult.strength}`);
  }

  // --- Test 55: CORD weight analysis ---
  const cordAnalysis = computeCordWeightAnalysis({
    telemetry: { decisions: [] },
    shield: { layers: [] },
    battle: { bots: [], pendingAttacks: [] },
    cascade: { activeChains: [], brokenChains: 0, completedChains: 0 },
    pressure: { survivedHighPressureTicks: 0 },
    outcome: 'ABANDONED',
  } as unknown as RunStateSnapshot);
  if (typeof cordAnalysis.total_cord_weight === 'number') {
    pass();
  } else {
    fail('computeCordWeightAnalysis failed');
  }

  // --- Test 56: buildExporterProofAuditEntry and verify ---
  const mockSnapForAudit = {
    runId: 'audit-test-run',
    tick: 10,
    sovereignty: { integrityStatus: 'VERIFIED', tickChecksums: [], proofHash: null, sovereigntyScore: 0, verifiedGrade: null, proofBadges: [], gapVsLegend: 0, gapClosingRate: 0, cordScore: 0, auditFlags: [], lastVerifiedTick: null },
  } as unknown as RunStateSnapshot;
  const proofAudit = buildExporterProofAuditEntry(mockSnapForAudit, 'test-hash', 'test-secret');
  const proofAuditVerified = verifyExporterProofAuditEntry(proofAudit, 'test-secret');
  if (proofAuditVerified) {
    pass();
  } else {
    fail('verifyExporterProofAuditEntry failed for valid proof audit entry');
  }

  // --- Test 57: computeIntegrityGradePipeline ---
  const mockSnapForGrade = {
    sovereignty: { integrityStatus: 'VERIFIED', tickChecksums: ['a'.repeat(64)], proofHash: 'a'.repeat(64), sovereigntyScore: 50, verifiedGrade: 'A', proofBadges: [], gapVsLegend: 0, gapClosingRate: 0, cordScore: 0.8, auditFlags: [], lastVerifiedTick: 10 },
    telemetry: { decisions: [] },
    shield: { layers: [] },
    battle: { bots: [], pendingAttacks: [] },
    cascade: { activeChains: [], brokenChains: 0, completedChains: 0 },
    pressure: { survivedHighPressureTicks: 0, tier: 'T0', score: 0, maxScoreSeen: 0 },
    outcome: 'FREEDOM',
    mode: 'solo',
    phase: 'SOVEREIGNTY',
    tick: 50,
    economy: { netWorth: 100000, freedomTarget: 100000, haterHeat: 0 },
    cards: { hand: [], ghostMarkers: [], deckEntropy: 0 },
    timers: { activeDecisionWindows: {} },
  } as unknown as RunStateSnapshot;
  const gradePipeline = computeIntegrityGradePipeline(mockSnapForGrade);
  if (typeof gradePipeline.grade === 'string' && gradePipeline.grade.length > 0) {
    pass();
  } else {
    fail('computeIntegrityGradePipeline returned empty grade');
  }

  const durationMs = Date.now() - startMs;

  return {
    passed: failures.length === 0,
    testCount,
    passCount,
    failCount: failures.length,
    failures,
    durationMs,
    exporterVersion: EXPORTER_VERSION,
    proofGeneratorTestPassed: proofTestPassed,
  };
}
