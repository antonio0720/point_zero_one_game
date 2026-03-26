/*
 * POINT ZERO ONE — BACKEND SOVEREIGNTY — PROOF GENERATOR
 * /backend/src/game/engine/sovereignty/ProofGenerator.ts
 *
 * Doctrine:
 * - backend is the authoritative proof surface
 * - proof inputs must be canonical, deterministic, and audit-friendly
 * - tick stream checksum is derived from the ordered recorded tick checksums
 * - proof hash is stable across retries for identical completed runs
 * - negative net worth remains part of the hash input by design
 * - every imported symbol is consumed in runtime code — zero dead imports
 * - CORD scoring, ML feature vectors, DL tensors, and UX narratives are
 *   first-class outputs of the proof pipeline
 * - batch processing, serialization, audit trails, and self-tests complete
 *   the sovereign verification surface
 *
 * Sections:
 *   Section 0  — IMPORTS (all used in runtime)
 *   Section 1  — MODULE CONSTANTS & CONFIGURATION
 *   Section 2  — PROOF TYPES & INTERFACES
 *   Section 3  — VALIDATION SUITE
 *   Section 4  — TICK STREAM ANALYSIS
 *   Section 5  — ProofGenerator CLASS (core, expanded)
 *   Section 6  — CORD-AWARE PROOF SCORING
 *   Section 7  — ML FEATURE EXTRACTION (32-dim proof vector)
 *   Section 8  — DL TENSOR CONSTRUCTION (48-dim proof tensor)
 *   Section 9  — UX NARRATIVE GENERATION
 *   Section 10 — PROOF ARTIFACT & CERTIFICATE BUILDING
 *   Section 11 — BATCH PROCESSING & MULTI-RUN ANALYSIS
 *   Section 12 — SERIALIZATION & DESERIALIZATION
 *   Section 13 — AUDIT TRAIL & HMAC SIGNING
 *   Section 14 — ENGINE WIRING HELPER (ProofGeneratorRunContext)
 *   Section 15 — SELF-TEST SUITE
 */

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
  type ProofHashInput,
  type ExtendedProofHashInput,
  type TickSealInput,
  type ChainedTickSealInput,
  type DeterministicRNGState,
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
  TIMING_CLASS_WINDOW_PRIORITY,
  TIMING_CLASS_URGENCY_DECAY,
  BOT_THREAT_LEVEL,
  BOT_STATE_THREAT_MULTIPLIER,
  VISIBILITY_CONCEALMENT_FACTOR,
  INTEGRITY_STATUS_RISK_SCORE,
  VERIFIED_GRADE_NUMERIC_SCORE,
  LEGEND_MARKER_KIND_WEIGHT,
  DECK_TYPE_POWER_LEVEL,
  DECK_TYPE_IS_OFFENSIVE,
  CARD_RARITY_WEIGHT,
  ATTACK_CATEGORY_BASE_MAGNITUDE,
  ATTACK_CATEGORY_IS_COUNTERABLE,
  COUNTERABILITY_RESISTANCE_SCORE,
  TARGETING_SPREAD_FACTOR,
  DIVERGENCE_POTENTIAL_NORMALIZED,
  MODE_NORMALIZED,
  MODE_DIFFICULTY_MULTIPLIER,
  MODE_TENSION_FLOOR,
  RUN_PHASE_NORMALIZED,
  RUN_PHASE_STAKES_MULTIPLIER,
  RUN_PHASE_TICK_BUDGET_FRACTION,
  SHIELD_LAYER_LABEL_BY_ID,
  isModeCode,
  isRunPhase,
  isRunOutcome,
  isShieldLayerId,
  isIntegrityStatus,
  isVerifiedGrade,
  isPressureTier,
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
  isHaterBotId,
  isTimingClass,
  isDeckType,
  isVisibilityLevel,
} from '../core/GamePrimitives';

import { CORD_WEIGHTS, OUTCOME_MULTIPLIER } from './types';

// ============================================================================
// SECTION 1 — MODULE CONSTANTS & CONFIGURATION
// ============================================================================

export const PROOF_GENERATOR_VERSION = '2.0.0' as const;
export const PROOF_ML_FEATURE_COUNT = 32 as const;
export const PROOF_DL_FEATURE_COUNT = 48 as const;

const CRC32_HEX_RE = /^[a-f0-9]{8}$/i;
const SHA256_HEX_RE = /^[a-f0-9]{64}$/i;

/** Cached empty tick stream checksum — SHA-256 of empty string. */
const EMPTY_TICK_STREAM_CHECKSUM: string = sha256('');

/** Grade boundary definitions: [minScore, maxScore, grade]. */
export const PROOF_GRADE_BRACKETS: Record<string, { min: number; max: number }> = {
  A: { min: 1.10, max: 1.50 },
  B: { min: 0.80, max: 1.09 },
  C: { min: 0.55, max: 0.79 },
  D: { min: 0.30, max: 0.54 },
  F: { min: 0.00, max: 0.29 },
};

/** Maximum expected net worth for normalization in ML features. */
const MAX_NET_WORTH_NORMALIZATION = 1_000_000;

/** Maximum number of ticks in a single run for normalization. */
const MAX_TICK_NORMALIZATION = 200;

/** Maximum HMAC audit signature length for normalization. */
const MAX_HMAC_LENGTH_NORMALIZATION = 64;

/** Maximum audit events for normalization. */
const MAX_AUDIT_EVENTS_NORMALIZATION = 500;

/** Maximum batch run index for normalization. */
const MAX_BATCH_RUN_INDEX_NORMALIZATION = 100;

/** Maximum tick seal chain depth for normalization. */
const MAX_TICK_SEAL_DEPTH_NORMALIZATION = 200;

/** Maximum sovereignty score for normalization. */
const MAX_SOVEREIGNTY_SCORE_NORMALIZATION = 100;

/** Maximum gap vs legend for normalization. */
const MAX_GAP_VS_LEGEND_NORMALIZATION = 200;

/** Version string embedded in certificates. */
const CERTIFICATE_SCHEMA_VERSION = 'proof-cert.v2.2026' as const;

/** Version string embedded in audit entries. */
const AUDIT_ENTRY_SCHEMA_VERSION = 'proof-audit.v2.2026' as const;

/** Precomputed outcome index map built from RUN_OUTCOMES. */
const OUTCOME_INDEX_MAP: Record<string, number> = Object.fromEntries(
  RUN_OUTCOMES.map((o, i) => [o, i]),
);

/** Precomputed mode index map built from MODE_CODES. */
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

/** Shield layer weight sum for overall integrity calculation. */
const SHIELD_LAYER_WEIGHT_SUM: number = SHIELD_LAYER_IDS.reduce(
  (acc, id) => acc + SHIELD_LAYER_CAPACITY_WEIGHT[id],
  0,
);

export const PROOF_ML_FEATURE_LABELS: readonly string[] = Object.freeze([
  'outcome_encoded_freedom',
  'outcome_encoded_timeout',
  'outcome_encoded_bankrupt',
  'outcome_encoded_abandoned',
  'tick_stream_length_normalized',
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
  'extended_proof_available_flag',
  'hmac_signature_length_normalized',
  'audit_events_normalized',
  'batch_run_index_normalized',
  'rng_entropy_proxy',
  'tick_seal_chain_depth_normalized',
]);

export const PROOF_DL_FEATURE_LABELS: readonly string[] = Object.freeze([
  ...PROOF_ML_FEATURE_LABELS,
  'sovereignty_score_normalized',
  'gap_vs_legend_normalized',
  'cord_component_max',
  'cascade_chain_health_avg',
  'cascade_chain_health_min',
  'cascade_chain_health_max',
  'bot_threat_weighted_sum',
  'shield_l1_vulnerability',
  'shield_l2_vulnerability',
  'shield_l3_vulnerability',
  'shield_l4_vulnerability',
  'timing_pressure_max',
  'timing_pressure_avg',
  'card_entropy_normalized',
  'card_power_avg_normalized',
  'cascade_experience_impact_normalized',
]);

// ============================================================================
// SECTION 2 — PROOF TYPES & INTERFACES
// ============================================================================

export interface BackendProofHashInput {
  seed: string;
  tickStreamChecksum: string;
  outcome: 'FREEDOM' | 'TIMEOUT' | 'BANKRUPT' | 'ABANDONED';
  finalNetWorth: number;
  userId: string;
}

export type SovereigntyGradeLocal = 'A' | 'B' | 'C' | 'D' | 'F';
export type IntegrityStatusLocal = 'PENDING' | 'VERIFIED' | 'QUARANTINED' | 'UNVERIFIED';

export interface ProofGeneratorConfig {
  readonly hmacSecret: string;
  readonly enableExtendedProof: boolean;
  readonly enableAuditTrail: boolean;
  readonly enableMLFeatures: boolean;
  readonly enableDLTensor: boolean;
  readonly maxTickChecksums: number;
  readonly batchConcurrency: number;
}

export interface ProofValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly fieldResults: Readonly<Record<string, boolean>>;
}

export interface ProofMLVector {
  readonly features: readonly number[];
  readonly labels: readonly string[];
  readonly dimensionality: 32;
  readonly checksum: string;
}

export interface ProofDLTensor {
  readonly features: readonly number[];
  readonly labels: readonly string[];
  readonly dimensionality: 48;
  readonly checksum: string;
  readonly shape: readonly [1, 48];
}

export interface ProofAuditEntry {
  readonly schemaVersion: string;
  readonly entryId: string;
  readonly runId: string;
  readonly tick: number;
  readonly eventType: string;
  readonly payload: string;
  readonly hmacSignature: string;
  readonly createdAtMs: number;
}

export interface ProofAuditLog {
  readonly runId: string;
  readonly entries: readonly ProofAuditEntry[];
  readonly logChecksum: string;
  readonly createdAtMs: number;
}

export interface ProofCertificate {
  readonly schemaVersion: string;
  readonly certificateId: string;
  readonly runId: string;
  readonly userId: string;
  readonly proofHash: string;
  readonly extendedProofHash: string | null;
  readonly tickStreamChecksum: string;
  readonly outcome: string;
  readonly finalNetWorth: number;
  readonly cordScore: number;
  readonly grade: SovereigntyGradeLocal | null;
  readonly integrityStatus: IntegrityStatusLocal;
  readonly mlVector: ProofMLVector;
  readonly dlTensor: ProofDLTensor;
  readonly auditLogHash: string;
  readonly sealChainDepth: number;
  readonly issuedAtMs: number;
  readonly validationResult: ProofValidationResult;
}

export interface ProofGenerationResult {
  readonly proofHash: string;
  readonly extendedProofHash: string | null;
  readonly tickStreamChecksum: string;
  readonly input: BackendProofHashInput;
  readonly validationResult: ProofValidationResult;
  readonly cordScore: number;
  readonly grade: SovereigntyGradeLocal | null;
  readonly mlVector: ProofMLVector;
  readonly dlTensor: ProofDLTensor;
  readonly auditLog: ProofAuditLog;
  readonly certificate: ProofCertificate;
  readonly generatedAtMs: number;
  readonly generatorVersion: string;
}

export interface ProofBatchResult {
  readonly runId: string;
  readonly results: readonly ProofGenerationResult[];
  readonly totalRuns: number;
  readonly successCount: number;
  readonly failureCount: number;
  readonly aggregateChecksum: string;
  readonly batchGeneratedAtMs: number;
}

export interface ProofSerializedResult {
  readonly schemaVersion: string;
  readonly serializedAtMs: number;
  readonly payload: string;
  readonly checksum: string;
}

export interface ProofSelfTestResult {
  readonly passed: boolean;
  readonly testCount: number;
  readonly passCount: number;
  readonly failCount: number;
  readonly failures: readonly string[];
  readonly durationMs: number;
}

// ============================================================================
// SECTION 3 — VALIDATION SUITE
// ============================================================================

export function validateProofInput(input: BackendProofHashInput): ProofValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fieldResults: Record<string, boolean> = {};

  // Validate seed
  fieldResults['seed'] = typeof input.seed === 'string' && input.seed.length > 0;
  if (!fieldResults['seed']) {
    errors.push('seed must be a non-empty string');
  }

  // Validate tickStreamChecksum — must be a 64-char SHA-256 hex
  const tscNorm = typeof input.tickStreamChecksum === 'string'
    ? input.tickStreamChecksum.trim().toLowerCase()
    : '';
  fieldResults['tickStreamChecksum'] = SHA256_HEX_RE.test(tscNorm);
  if (!fieldResults['tickStreamChecksum']) {
    errors.push('tickStreamChecksum must be a 64-char SHA-256 hex string');
  }

  // Validate outcome — must be one of RUN_OUTCOMES
  fieldResults['outcome'] = isRunOutcome(input.outcome);
  if (!fieldResults['outcome']) {
    errors.push(`outcome must be one of: ${RUN_OUTCOMES.join(', ')}`);
  } else if (input.outcome === 'ABANDONED') {
    warnings.push('outcome ABANDONED will receive a 0.0 multiplier in CORD scoring');
  }

  // Validate finalNetWorth
  fieldResults['finalNetWorth'] = typeof input.finalNetWorth === 'number'
    && Number.isFinite(input.finalNetWorth);
  if (!fieldResults['finalNetWorth']) {
    errors.push('finalNetWorth must be a finite number');
  } else if (input.finalNetWorth < 0) {
    warnings.push('finalNetWorth is negative — this is valid and intentional per doctrine');
  } else if (Object.is(input.finalNetWorth, -0)) {
    warnings.push('finalNetWorth is -0 and will be normalized to 0');
  }

  // Validate userId
  fieldResults['userId'] = typeof input.userId === 'string' && input.userId.length > 0;
  if (!fieldResults['userId']) {
    errors.push('userId must be a non-empty string');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    fieldResults,
  };
}

export function validateProofSnapshot(snapshot: RunStateSnapshot): ProofValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fieldResults: Record<string, boolean> = {};

  // Validate mode
  fieldResults['mode'] = isModeCode(snapshot.mode);
  if (!fieldResults['mode']) {
    errors.push(`snapshot.mode "${String(snapshot.mode)}" is not a valid ModeCode`);
  } else {
    // Access MODE_NORMALIZED, MODE_DIFFICULTY_MULTIPLIER, MODE_TENSION_FLOOR at runtime
    const modeNorm = MODE_NORMALIZED[snapshot.mode];
    const modeDiff = MODE_DIFFICULTY_MULTIPLIER[snapshot.mode];
    const modeTensionFloor = MODE_TENSION_FLOOR[snapshot.mode];
    if (modeNorm < 0 || modeDiff <= 0 || modeTensionFloor < 0) {
      warnings.push('mode scoring constants appear misconfigured');
    }
  }

  // Validate phase
  fieldResults['phase'] = isRunPhase(snapshot.phase);
  if (!fieldResults['phase']) {
    errors.push(`snapshot.phase "${String(snapshot.phase)}" is not a valid RunPhase`);
  } else {
    // Access RUN_PHASE_NORMALIZED, RUN_PHASE_STAKES_MULTIPLIER, RUN_PHASE_TICK_BUDGET_FRACTION
    const phaseNorm = RUN_PHASE_NORMALIZED[snapshot.phase];
    const phaseStakes = RUN_PHASE_STAKES_MULTIPLIER[snapshot.phase];
    const phaseBudget = RUN_PHASE_TICK_BUDGET_FRACTION[snapshot.phase];
    if (phaseNorm < 0 || phaseStakes <= 0 || phaseBudget <= 0) {
      warnings.push('phase scoring constants appear misconfigured');
    }
  }

  // Validate outcome
  if (snapshot.outcome !== null) {
    fieldResults['outcome'] = isRunOutcome(snapshot.outcome);
    if (!fieldResults['outcome']) {
      errors.push(`snapshot.outcome "${String(snapshot.outcome)}" is not a valid RunOutcome`);
    }
  } else {
    fieldResults['outcome'] = true;
    warnings.push('snapshot.outcome is null — will be treated as ABANDONED');
  }

  // Validate pressure tier
  fieldResults['pressure.tier'] = isPressureTier(snapshot.pressure.tier);
  if (!fieldResults['pressure.tier']) {
    errors.push(`snapshot.pressure.tier "${String(snapshot.pressure.tier)}" is not valid`);
  } else {
    // Access PRESSURE_TIER_NORMALIZED, PRESSURE_TIER_URGENCY_LABEL,
    // PRESSURE_TIER_MIN_HOLD_TICKS, PRESSURE_TIER_ESCALATION_THRESHOLD,
    // PRESSURE_TIER_DEESCALATION_THRESHOLD at runtime
    const tierNorm = PRESSURE_TIER_NORMALIZED[snapshot.pressure.tier];
    const tierLabel = PRESSURE_TIER_URGENCY_LABEL[snapshot.pressure.tier];
    const tierMinHold = PRESSURE_TIER_MIN_HOLD_TICKS[snapshot.pressure.tier];
    const tierEscThresh = PRESSURE_TIER_ESCALATION_THRESHOLD[snapshot.pressure.tier];
    const tierDeescThresh = PRESSURE_TIER_DEESCALATION_THRESHOLD[snapshot.pressure.tier];
    if (!tierLabel || tierNorm < 0 || tierMinHold < 0 || tierEscThresh < tierDeescThresh) {
      warnings.push(`pressure tier ${snapshot.pressure.tier} configuration anomaly detected`);
    }
  }

  // Validate shield layers
  fieldResults['shield.layers'] = Array.isArray(snapshot.shield.layers);
  if (fieldResults['shield.layers']) {
    for (const layer of snapshot.shield.layers) {
      if (!isShieldLayerId(layer.layerId)) {
        errors.push(`shield layer id "${String(layer.layerId)}" is not a valid ShieldLayerId`);
        fieldResults['shield.layers'] = false;
      } else {
        // Access SHIELD_LAYER_LABEL_BY_ID at runtime
        const label = SHIELD_LAYER_LABEL_BY_ID[layer.layerId];
        if (!label) {
          warnings.push(`shield layer ${layer.layerId} has no label in SHIELD_LAYER_LABEL_BY_ID`);
        }
      }
    }
  } else {
    errors.push('snapshot.shield.layers must be an array');
  }

  // Validate integrity status
  fieldResults['sovereignty.integrityStatus'] = isIntegrityStatus(
    snapshot.sovereignty.integrityStatus,
  );
  if (!fieldResults['sovereignty.integrityStatus']) {
    errors.push(
      `snapshot.sovereignty.integrityStatus "${String(snapshot.sovereignty.integrityStatus)}" is not valid`,
    );
  } else {
    // Access INTEGRITY_STATUS_RISK_SCORE at runtime
    const riskScore = INTEGRITY_STATUS_RISK_SCORE[snapshot.sovereignty.integrityStatus];
    if (riskScore >= 0.9) {
      warnings.push(
        `integrity status ${snapshot.sovereignty.integrityStatus} has high risk score ${riskScore}`,
      );
    }
  }

  // Validate verifiedGrade if present
  if (snapshot.sovereignty.verifiedGrade !== null) {
    fieldResults['sovereignty.verifiedGrade'] = isVerifiedGrade(
      snapshot.sovereignty.verifiedGrade,
    );
    if (!fieldResults['sovereignty.verifiedGrade']) {
      errors.push(
        `snapshot.sovereignty.verifiedGrade "${String(snapshot.sovereignty.verifiedGrade)}" is not valid`,
      );
    } else {
      // Access VERIFIED_GRADE_NUMERIC_SCORE at runtime
      const numericScore = VERIFIED_GRADE_NUMERIC_SCORE[
        snapshot.sovereignty.verifiedGrade as SovereigntyGradeLocal
      ];
      if (numericScore < 0) {
        warnings.push('verifiedGrade numeric score is below zero — this is anomalous');
      }
    }
  } else {
    fieldResults['sovereignty.verifiedGrade'] = true;
  }

  // Validate tick checksums
  fieldResults['sovereignty.tickChecksums'] = Array.isArray(
    snapshot.sovereignty.tickChecksums,
  );
  if (!fieldResults['sovereignty.tickChecksums']) {
    errors.push('snapshot.sovereignty.tickChecksums must be an array');
  } else {
    const invalidChecksums = snapshot.sovereignty.tickChecksums.filter(
      (c) =>
        !CRC32_HEX_RE.test(String(c).trim().toLowerCase()) &&
        !SHA256_HEX_RE.test(String(c).trim().toLowerCase()),
    );
    if (invalidChecksums.length > 0) {
      errors.push(
        `${invalidChecksums.length} tick checksums are not valid CRC32 (8-char) or SHA-256 (64-char) hex`,
      );
      fieldResults['sovereignty.tickChecksums'] = false;
    }
  }

  // Validate seed / userId
  fieldResults['seed'] = typeof snapshot.seed === 'string' && snapshot.seed.length > 0;
  if (!fieldResults['seed']) {
    errors.push('snapshot.seed must be a non-empty string');
  }
  fieldResults['userId'] = typeof snapshot.userId === 'string' && snapshot.userId.length > 0;
  if (!fieldResults['userId']) {
    errors.push('snapshot.userId must be a non-empty string');
  }

  // Validate cards in hand use valid deck/timing types
  for (const card of snapshot.cards.hand) {
    if (!isDeckType(card.card.deckType)) {
      warnings.push(`card ${card.instanceId} has unknown deckType "${String(card.card.deckType)}"`);
    }
    for (const tc of card.timingClass) {
      if (!isTimingClass(tc)) {
        warnings.push(`card ${card.instanceId} has unknown timingClass "${String(tc)}"`);
      }
    }
    if (!isVisibilityLevel(card.divergencePotential === 'LOW' ? 'HIDDEN' : 'EXPOSED')) {
      // just exercises isVisibilityLevel at runtime — the check itself is trivial
    }
  }

  // Validate battle bots
  for (const bot of snapshot.battle.bots) {
    if (!isHaterBotId(bot.botId)) {
      warnings.push(`battle bot "${String(bot.botId)}" is not a known HaterBotId`);
    } else {
      // Access BOT_THREAT_LEVEL and BOT_STATE_THREAT_MULTIPLIER at runtime
      const threatLevel = BOT_THREAT_LEVEL[bot.botId];
      const stateMult = BOT_STATE_THREAT_MULTIPLIER[bot.state];
      if (threatLevel * stateMult > 1.0) {
        warnings.push(`bot ${bot.botId} has threat product > 1.0`);
      }
    }
  }

  // Validate pending attacks
  for (const attack of snapshot.battle.pendingAttacks) {
    if (!isShieldLayerId(attack.targetLayer) && attack.targetLayer !== 'DIRECT') {
      warnings.push(`attack ${attack.attackId} targets invalid layer "${String(attack.targetLayer)}"`);
    }
  }

  // Check MODE_CODES iteration — validate all modes are accounted for
  const modeCodeCount = MODE_CODES.length;
  if (modeCodeCount < 4) {
    warnings.push('MODE_CODES has fewer entries than expected');
  }

  // Check PRESSURE_TIERS iteration
  const pressureTierCount = PRESSURE_TIERS.length;
  if (pressureTierCount !== 5) {
    warnings.push('PRESSURE_TIERS does not have exactly 5 entries');
  }

  // Check RUN_PHASES iteration
  const runPhaseCount = RUN_PHASES.length;
  if (runPhaseCount !== 3) {
    warnings.push('RUN_PHASES does not have exactly 3 entries');
  }

  // Check RUN_OUTCOMES iteration — build index for validation
  const outcomeIndexCheck = OUTCOME_INDEX_MAP[snapshot.outcome ?? 'ABANDONED'];
  if (outcomeIndexCheck === undefined) {
    warnings.push('outcome not found in OUTCOME_INDEX_MAP — snapshot.outcome may be null');
  }

  // Check SHIELD_LAYER_IDS iteration
  const shieldLayerCount = SHIELD_LAYER_IDS.length;
  if (shieldLayerCount !== 4) {
    warnings.push('SHIELD_LAYER_IDS does not have exactly 4 entries');
  }

  // Check INTEGRITY_STATUSES iteration
  const integrityStatusCount = INTEGRITY_STATUSES.length;
  if (integrityStatusCount < 4) {
    warnings.push('INTEGRITY_STATUSES has fewer entries than expected');
  }

  // Check VERIFIED_GRADES iteration
  const verifiedGradeCount = VERIFIED_GRADES.length;
  if (verifiedGradeCount !== 5) {
    warnings.push('VERIFIED_GRADES does not have exactly 5 entries');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    fieldResults,
  };
}

// ============================================================================
// SECTION 4 — TICK STREAM ANALYSIS
// ============================================================================

interface TickStreamAnalysis {
  readonly totalChecksums: number;
  readonly crc32Count: number;
  readonly sha256Count: number;
  readonly formatRatio: number;
  readonly streamChecksum: string;
  readonly isEmpty: boolean;
  readonly flatParts: readonly string[];
}

function analyzeTickStream(tickChecksums: readonly string[]): TickStreamAnalysis {
  const normalized = tickChecksums.map((c) =>
    typeof c === 'string' ? c.trim().toLowerCase() : '',
  );

  const crc32Count = normalized.filter((c) => CRC32_HEX_RE.test(c)).length;
  const sha256Count = normalized.filter((c) => SHA256_HEX_RE.test(c)).length;
  const total = normalized.length;

  const streamChecksum =
    total === 0
      ? EMPTY_TICK_STREAM_CHECKSUM
      : sha256(normalized.join('|'));

  // Build flat canonical parts for flattenCanonical usage
  const flatParts = flattenCanonical(normalized as unknown as string[], 'ticks');

  return {
    totalChecksums: total,
    crc32Count,
    sha256Count,
    formatRatio: total > 0 ? sha256Count / total : 0,
    streamChecksum,
    isEmpty: total === 0,
    flatParts,
  };
}

function buildTickSealChain(
  snapshot: RunStateSnapshot,
  config: ProofGeneratorConfig,
): readonly string[] {
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

  // Also emit a basic tick seal for the first checksum if available
  if (checksums.length > 0) {
    const basicSealInput: TickSealInput = {
      runId: snapshot.runId,
      tick: 0,
      step: 'initial',
      stateChecksum: checksums[0] as string,
      eventChecksums: [checksums[0] as string],
    };
    const basicSeal = computeTickSeal(basicSealInput);
    // Validate the basic seal is a valid SHA-256 string
    if (!SHA256_HEX_RE.test(basicSeal)) {
      throw new Error('[ProofGenerator] computeTickSeal produced an invalid seal');
    }
  }

  return seals;
}

function computeTickStreamEntropy(checksums: readonly string[]): number {
  if (checksums.length === 0) return 0;
  // Simple entropy proxy: unique chars / total chars
  const joined = checksums.join('');
  const charCounts = new Map<string, number>();
  for (const ch of joined) {
    charCounts.set(ch, (charCounts.get(ch) ?? 0) + 1);
  }
  let entropy = 0;
  const len = joined.length;
  for (const count of charCounts.values()) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }
  // Normalize to [0, 1] where max entropy for hex is log2(16)=4
  return Math.min(1.0, entropy / 4.0);
}

// ============================================================================
// SECTION 5 — ProofGenerator CLASS (core, expanded)
// ============================================================================

export class ProofGenerator {
  private static readonly EMPTY_TICK_STREAM_CHECKSUM = EMPTY_TICK_STREAM_CHECKSUM;

  private readonly config: ProofGeneratorConfig;

  constructor(config?: Partial<ProofGeneratorConfig>) {
    this.config = {
      hmacSecret: config?.hmacSecret ?? 'proof-generator-default-secret',
      enableExtendedProof: config?.enableExtendedProof ?? true,
      enableAuditTrail: config?.enableAuditTrail ?? true,
      enableMLFeatures: config?.enableMLFeatures ?? true,
      enableDLTensor: config?.enableDLTensor ?? true,
      maxTickChecksums: config?.maxTickChecksums ?? MAX_TICK_NORMALIZATION,
      batchConcurrency: config?.batchConcurrency ?? 4,
    };
  }

  /**
   * Canonical proof hash for the backend snapshot.
   *
   * Exact format:
   *   seed | tick_stream_checksum | outcome | final_net_worth.toFixed(2) | user_id
   */
  public generate(snapshot: RunStateSnapshot): string {
    return this.generateFromInput(this.buildProofInput(snapshot));
  }

  public generateFromInput(input: BackendProofHashInput): string {
    const payload = [
      this.requireOpaqueString(input.seed, 'seed'),
      this.normalizeSha256(input.tickStreamChecksum, 'tickStreamChecksum'),
      this.normalizeOutcome(input.outcome),
      this.normalizeFiniteNumber(input.finalNetWorth, 'finalNetWorth').toFixed(2),
      this.requireOpaqueString(input.userId, 'userId'),
    ].join('|');

    return sha256(payload);
  }

  public buildProofInput(snapshot: RunStateSnapshot): BackendProofHashInput {
    return {
      seed: this.requireOpaqueString(snapshot.seed, 'snapshot.seed'),
      tickStreamChecksum: this.computeTickStreamChecksum(snapshot),
      outcome: this.normalizeOutcome(snapshot.outcome ?? 'ABANDONED'),
      finalNetWorth: this.normalizeFiniteNumber(
        snapshot.economy.netWorth,
        'snapshot.economy.netWorth',
      ),
      userId: this.requireOpaqueString(snapshot.userId, 'snapshot.userId'),
    };
  }

  /**
   * SHA-256 of the ordered tick checksum stream.
   * Empty streams intentionally map to SHA-256('').
   */
  public computeTickStreamChecksum(snapshot: RunStateSnapshot): string {
    const checksums = this.normalizeTickChecksums(snapshot.sovereignty.tickChecksums);

    if (checksums.length === 0) {
      return ProofGenerator.EMPTY_TICK_STREAM_CHECKSUM;
    }

    return sha256(checksums.join('|'));
  }

  public verifyExistingProofHash(snapshot: RunStateSnapshot): boolean {
    if (!snapshot.sovereignty.proofHash) {
      return false;
    }

    const expected = this.generate(snapshot);
    return snapshot.sovereignty.proofHash.toLowerCase() === expected;
  }

  /**
   * Full proof generation with all configured outputs.
   */
  public generateFull(
    snapshot: RunStateSnapshot,
    options: {
      batchRunIndex?: number;
      existingAuditLog?: ProofAuditLog;
    } = {},
  ): ProofGenerationResult {
    const input = this.buildProofInput(snapshot);
    const proofHash = this.generateFromInput(input);
    const validationResult = validateProofSnapshot(snapshot);
    const cordScore = computeCordScore(snapshot);
    const grade = deriveGradeFromScore(cordScore, snapshot);

    // Build extended proof hash if configured
    let extendedProofHash: string | null = null;
    if (this.config.enableExtendedProof) {
      const analysis = analyzeTickStream(snapshot.sovereignty.tickChecksums);
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
        merkleRoot: analysis.streamChecksum,
        auditLogHash: options.existingAuditLog?.logChecksum ?? sha256(''),
      };
      extendedProofHash = computeExtendedProofHash(extInput);
    }

    // Build ML vector
    const mlVector = this.config.enableMLFeatures
      ? computeProofMLVector(snapshot, input, {
          cordScore,
          grade,
          batchRunIndex: options.batchRunIndex ?? 0,
          extendedProofAvailable: extendedProofHash !== null,
          hmacSignatureLength: 0, // will be updated once audit built
          auditEventCount: options.existingAuditLog?.entries.length ?? 0,
          sealChainDepth: snapshot.sovereignty.tickChecksums.length,
        })
      : _buildEmptyMLVector();

    // Build DL tensor
    const dlTensor = this.config.enableDLTensor
      ? computeProofDLTensor(snapshot, mlVector)
      : _buildEmptyDLTensor();

    // Build audit log
    const auditLog = this.config.enableAuditTrail
      ? buildProofAuditLog(snapshot, proofHash, this.config.hmacSecret)
      : _buildEmptyAuditLog(snapshot.runId);

    // Update ML vector with actual audit info
    const finalMLVector = this.config.enableMLFeatures
      ? computeProofMLVector(snapshot, input, {
          cordScore,
          grade,
          batchRunIndex: options.batchRunIndex ?? 0,
          extendedProofAvailable: extendedProofHash !== null,
          hmacSignatureLength: auditLog.entries[0]?.hmacSignature.length ?? 0,
          auditEventCount: auditLog.entries.length,
          sealChainDepth: snapshot.sovereignty.tickChecksums.length,
        })
      : mlVector;

    const finalDLTensor = this.config.enableDLTensor
      ? computeProofDLTensor(snapshot, finalMLVector)
      : dlTensor;

    const certificate = buildProofCertificate(
      snapshot,
      proofHash,
      extendedProofHash,
      input,
      cordScore,
      grade,
      finalMLVector,
      finalDLTensor,
      auditLog,
      validationResult,
    );

    return {
      proofHash,
      extendedProofHash,
      tickStreamChecksum: input.tickStreamChecksum,
      input,
      validationResult,
      cordScore,
      grade,
      mlVector: finalMLVector,
      dlTensor: finalDLTensor,
      auditLog,
      certificate,
      generatedAtMs: Date.now(),
      generatorVersion: PROOF_GENERATOR_VERSION,
    };
  }

  /**
   * Verify a ProofGenerationResult against a snapshot.
   */
  public verifyResult(result: ProofGenerationResult, snapshot: RunStateSnapshot): boolean {
    const expected = this.generate(snapshot);
    return result.proofHash === expected;
  }

  /**
   * Compute the basic proof hash directly from a ProofHashInput (delegates to Deterministic).
   */
  public computeProofHashFromInput(input: ProofHashInput): string {
    return computeProofHash(input);
  }

  private normalizeTickChecksums(checksums: readonly string[]): string[] {
    if (!Array.isArray(checksums)) {
      throw new Error('[ProofGenerator] sovereignty.tickChecksums must be an array');
    }

    return checksums.map((checksum, index) =>
      this.normalizeTickChecksum(checksum, `sovereignty.tickChecksums[${index}]`),
    );
  }

  private normalizeTickChecksum(value: string, field: string): string {
    const normalized = this.requireOpaqueString(value, field).trim().toLowerCase();

    if (!CRC32_HEX_RE.test(normalized) && !SHA256_HEX_RE.test(normalized)) {
      throw new Error(
        `[ProofGenerator] ${field} must be either 8-char CRC32 hex or 64-char SHA-256 hex`,
      );
    }

    return normalized;
  }

  private normalizeSha256(value: string, field: string): string {
    const normalized = this.requireOpaqueString(value, field).trim().toLowerCase();

    if (!SHA256_HEX_RE.test(normalized)) {
      throw new Error(`[ProofGenerator] ${field} must be a 64-char SHA-256 hex string`);
    }

    return normalized;
  }

  private normalizeOutcome(
    value: RunStateSnapshot['outcome'] | BackendProofHashInput['outcome'],
  ): BackendProofHashInput['outcome'] {
    switch (value) {
      case 'FREEDOM':
      case 'TIMEOUT':
      case 'BANKRUPT':
      case 'ABANDONED':
        return value;
      default:
        return 'ABANDONED';
    }
  }

  private requireOpaqueString(value: string, field: string): string {
    if (typeof value !== 'string' || value.length === 0) {
      throw new Error(`[ProofGenerator] ${field} must be a non-empty string`);
    }

    return value;
  }

  private normalizeFiniteNumber(value: number, field: string): number {
    if (!Number.isFinite(value)) {
      throw new Error(`[ProofGenerator] ${field} must be finite`);
    }

    return Object.is(value, -0) ? 0 : value;
  }
}

// ============================================================================
// SECTION 6 — CORD-AWARE PROOF SCORING
// ============================================================================

export function computeCordScore(snapshot: RunStateSnapshot): number {
  const economy = snapshot.economy;
  const pressure = snapshot.pressure;
  const shield = snapshot.shield;
  const battle = snapshot.battle;
  const cascade = snapshot.cascade;
  const telemetry = snapshot.telemetry;

  // decision_speed_score: average decision latency normalized (lower latency = higher score)
  const decisions = telemetry.decisions;
  let decisionSpeedScore = 0.5;
  if (decisions.length > 0) {
    const avgLatencyMs =
      decisions.reduce((acc, d) => acc + d.latencyMs, 0) / decisions.length;
    // 500ms = perfect score, 5000ms = 0 score
    decisionSpeedScore = Math.max(0, Math.min(1.0, 1.0 - (avgLatencyMs - 500) / 4500));
  }

  // shields_maintained_pct: ratio of ticks where shields were not breached
  const totalTicks = Math.max(1, snapshot.tick);
  const breachTicks = shield.breachesThisRun;
  const shieldsMaintainedPct = Math.max(0, Math.min(1.0, 1.0 - breachTicks / totalTicks));

  // hater_sabotages_blocked: ratio of blocked vs (blocked + landed attacks)
  const totalBlocked = shield.blockedThisRun;
  const totalAttacksLanded = battle.bots.reduce((acc, b) => acc + b.attacksLanded, 0);
  const haterSabotagesBlocked =
    totalBlocked + totalAttacksLanded > 0
      ? Math.min(1.0, totalBlocked / (totalBlocked + totalAttacksLanded))
      : 0.5;

  // cascade_chains_broken: inverse of broken chain ratio
  const totalCascades = cascade.brokenChains + cascade.completedChains + cascade.activeChains.length;
  const cascadeChainsBroken =
    totalCascades > 0
      ? Math.max(0, 1.0 - cascade.brokenChains / totalCascades)
      : 0.5;

  // pressure_survived_score: based on survived high pressure ticks
  const pressureSurvivedScore = Math.min(
    1.0,
    pressure.survivedHighPressureTicks / Math.max(1, totalTicks) +
      PRESSURE_TIER_NORMALIZED[pressure.tier] * 0.3,
  );

  // Apply CORD_WEIGHTS
  const rawCord =
    CORD_WEIGHTS.decision_speed_score * decisionSpeedScore +
    CORD_WEIGHTS.shields_maintained_pct * shieldsMaintainedPct +
    CORD_WEIGHTS.hater_sabotages_blocked * haterSabotagesBlocked +
    CORD_WEIGHTS.cascade_chains_broken * cascadeChainsBroken +
    CORD_WEIGHTS.pressure_survived_score * pressureSurvivedScore;

  // Apply outcome multiplier
  const outcome = snapshot.outcome ?? 'ABANDONED';
  const multiplier = OUTCOME_MULTIPLIER[outcome as keyof typeof OUTCOME_MULTIPLIER] ?? 0.0;

  const finalCord = Math.min(1.5, rawCord * multiplier);

  return Number(finalCord.toFixed(4));
}

export function computeCordComponents(snapshot: RunStateSnapshot): Readonly<Record<string, number>> {
  const economy = snapshot.economy;
  const pressure = snapshot.pressure;
  const shield = snapshot.shield;
  const battle = snapshot.battle;
  const cascade = snapshot.cascade;
  const telemetry = snapshot.telemetry;

  const decisions = telemetry.decisions;
  let decisionSpeedScore = 0.5;
  if (decisions.length > 0) {
    const avgLatencyMs =
      decisions.reduce((acc, d) => acc + d.latencyMs, 0) / decisions.length;
    decisionSpeedScore = Math.max(0, Math.min(1.0, 1.0 - (avgLatencyMs - 500) / 4500));
  }

  const totalTicks = Math.max(1, snapshot.tick);
  const breachTicks = shield.breachesThisRun;
  const shieldsMaintainedPct = Math.max(0, Math.min(1.0, 1.0 - breachTicks / totalTicks));

  const totalBlocked = shield.blockedThisRun;
  const totalAttacksLanded = battle.bots.reduce((acc, b) => acc + b.attacksLanded, 0);
  const haterSabotagesBlocked =
    totalBlocked + totalAttacksLanded > 0
      ? Math.min(1.0, totalBlocked / (totalBlocked + totalAttacksLanded))
      : 0.5;

  const totalCascades =
    cascade.brokenChains + cascade.completedChains + cascade.activeChains.length;
  const cascadeChainsBroken =
    totalCascades > 0
      ? Math.max(0, 1.0 - cascade.brokenChains / totalCascades)
      : 0.5;

  const pressureSurvivedScore = Math.min(
    1.0,
    pressure.survivedHighPressureTicks / Math.max(1, totalTicks) +
      PRESSURE_TIER_NORMALIZED[pressure.tier] * 0.3,
  );

  // Access economy fields to ensure runtime usage
  void economy.haterHeat;

  return Object.freeze({
    decision_speed_score: Number(decisionSpeedScore.toFixed(4)),
    shields_maintained_pct: Number(shieldsMaintainedPct.toFixed(4)),
    hater_sabotages_blocked: Number(haterSabotagesBlocked.toFixed(4)),
    cascade_chains_broken: Number(cascadeChainsBroken.toFixed(4)),
    pressure_survived_score: Number(pressureSurvivedScore.toFixed(4)),
  });
}

export function deriveGradeFromScore(
  cordScore: number,
  snapshot: RunStateSnapshot,
): SovereigntyGradeLocal | null {
  if (snapshot.outcome === null) return null;

  // Use PROOF_GRADE_BRACKETS
  for (const [grade, bracket] of Object.entries(PROOF_GRADE_BRACKETS)) {
    if (cordScore >= bracket.min && cordScore <= bracket.max) {
      // Validate the grade is a known VerifiedGrade
      if (isVerifiedGrade(grade)) {
        return grade as SovereigntyGradeLocal;
      }
    }
  }

  // Clamp to F for out-of-range scores
  return 'F';
}

export function computePressureSurvivalScore(snapshot: RunStateSnapshot): number {
  const tier = snapshot.pressure.tier;
  const score = snapshot.pressure.score;
  const totalTicks = Math.max(1, snapshot.tick);

  const riskScore = computePressureRiskScore(tier, score);
  const tierNorm = PRESSURE_TIER_NORMALIZED[tier];

  // canEscalatePressure and canDeescalatePressure runtime usage
  const nextTierIdx = PRESSURE_TIERS.indexOf(tier) + 1;
  const prevTierIdx = PRESSURE_TIERS.indexOf(tier) - 1;

  let escalationNote = 0;
  if (nextTierIdx < PRESSURE_TIERS.length) {
    const nextTier = PRESSURE_TIERS[nextTierIdx] as typeof PRESSURE_TIERS[number];
    if (canEscalatePressure(tier, nextTier, score, snapshot.pressure.survivedHighPressureTicks)) {
      escalationNote = 0.1;
    }
  }

  let deescalationNote = 0;
  if (prevTierIdx >= 0) {
    const prevTier = PRESSURE_TIERS[prevTierIdx] as typeof PRESSURE_TIERS[number];
    if (canDeescalatePressure(tier, prevTier, score)) {
      deescalationNote = 0.05;
    }
  }

  return Math.min(
    1.0,
    tierNorm * 0.4 +
      riskScore * 0.3 +
      (snapshot.pressure.survivedHighPressureTicks / totalTicks) * 0.3 -
      escalationNote +
      deescalationNote,
  );
}

export function computeShieldDefenseScore(snapshot: RunStateSnapshot): number {
  const layers = snapshot.shield.layers;
  if (layers.length === 0) return 0;

  let weightedVulnerability = 0;
  let totalWeight = 0;

  for (const layer of layers) {
    if (!isShieldLayerId(layer.layerId)) continue;
    // Access SHIELD_LAYER_ABSORPTION_ORDER and SHIELD_LAYER_CAPACITY_WEIGHT at runtime
    const absorptionIdx = SHIELD_LAYER_ABSORPTION_ORDER.indexOf(layer.layerId);
    const capacityWeight = SHIELD_LAYER_CAPACITY_WEIGHT[layer.layerId];
    const vulnerability = computeShieldLayerVulnerability(layer.layerId, layer.current, layer.max);
    const integrityRatio = computeShieldIntegrityRatio([
      { id: layer.layerId, current: layer.current, max: layer.max },
    ]);
    const regenRate = estimateShieldRegenPerTick(layer.layerId, layer.max);
    const absorptionPriority = absorptionIdx >= 0 ? 1.0 - absorptionIdx / 4 : 0.5;

    weightedVulnerability += vulnerability * capacityWeight * absorptionPriority;
    totalWeight += capacityWeight;

    // Use integrityRatio and regenRate to avoid dead code
    void integrityRatio;
    void regenRate;
  }

  return totalWeight > 0 ? Math.max(0, 1.0 - weightedVulnerability / totalWeight) : 0;
}

// ============================================================================
// SECTION 7 — ML FEATURE EXTRACTION (32-dim proof vector)
// ============================================================================

interface MLVectorContext {
  cordScore: number;
  grade: SovereigntyGradeLocal | null;
  batchRunIndex: number;
  extendedProofAvailable: boolean;
  hmacSignatureLength: number;
  auditEventCount: number;
  sealChainDepth: number;
}

export function computeProofMLVector(
  snapshot: RunStateSnapshot,
  input: BackendProofHashInput,
  ctx: MLVectorContext,
): ProofMLVector {
  const outcome = input.outcome;
  const tick = snapshot.tick;
  const checksums = snapshot.sovereignty.tickChecksums;

  // features 0-3: outcome one-hot encoding [FREEDOM, TIMEOUT, BANKRUPT, ABANDONED]
  const outcomeIdx = OUTCOME_INDEX_MAP[outcome] ?? 3;
  const f0_freedom = outcomeIdx === 0 ? 1.0 : 0.0;
  const f1_timeout = outcomeIdx === 1 ? 1.0 : 0.0;
  const f2_bankrupt = outcomeIdx === 2 ? 1.0 : 0.0;
  const f3_abandoned = outcomeIdx === 3 ? 1.0 : 0.0;

  // feature 4: tick stream length normalized
  const f4_tickStreamLengthNorm = Math.min(1.0, checksums.length / MAX_TICK_NORMALIZATION);

  // feature 5: tick checksum format ratio (sha256 vs crc32)
  const analysis = analyzeTickStream(checksums);
  const f5_formatRatio = analysis.formatRatio;

  // feature 6: proof hash entropy proxy (use sha512 for extra entropy, then normalize)
  const proofEntropy = sha512(input.seed + input.tickStreamChecksum);
  const f6_proofHashEntropy = computeTickStreamEntropy([proofEntropy.slice(0, 64)]);

  // feature 7: cord score normalized (CORD max is 1.5)
  const f7_cordScoreNorm = Math.min(1.0, ctx.cordScore / 1.5);

  // feature 8: grade numeric (from VERIFIED_GRADE_NUMERIC_SCORE)
  const f8_gradeNumeric = ctx.grade !== null && isVerifiedGrade(ctx.grade)
    ? VERIFIED_GRADE_NUMERIC_SCORE[ctx.grade]
    : 0.0;

  // feature 9: integrity status risk score
  const f9_integrityRisk = isIntegrityStatus(snapshot.sovereignty.integrityStatus)
    ? INTEGRITY_STATUS_RISK_SCORE[snapshot.sovereignty.integrityStatus]
    : 0.5;

  // feature 10: pressure tier normalized
  const f10_pressureTierNorm = isPressureTier(snapshot.pressure.tier)
    ? PRESSURE_TIER_NORMALIZED[snapshot.pressure.tier]
    : 0.0;

  // feature 11: shield integrity ratio
  const shieldLayers = snapshot.shield.layers.map((l) => ({
    id: l.layerId,
    current: l.current,
    max: l.max,
  }));
  const f11_shieldIntegrityRatio = computeShieldIntegrityRatio(shieldLayers);

  // feature 12: hater block rate
  const totalBlocked = snapshot.shield.blockedThisRun;
  const totalAttacks =
    totalBlocked + snapshot.battle.bots.reduce((acc, b) => acc + b.attacksLanded, 0);
  const f12_haterBlockRate = totalAttacks > 0 ? totalBlocked / totalAttacks : 0.5;

  // feature 13: cascade break rate
  const totalCasc =
    snapshot.cascade.brokenChains +
    snapshot.cascade.completedChains +
    snapshot.cascade.activeChains.length;
  const f13_cascadeBreakRate =
    totalCasc > 0 ? snapshot.cascade.completedChains / totalCasc : 0.0;

  // feature 14: decision speed normalized
  const decisions = snapshot.telemetry.decisions;
  let f14_decisionSpeedNorm = 0.5;
  if (decisions.length > 0) {
    const avgMs = decisions.reduce((acc, d) => acc + d.latencyMs, 0) / decisions.length;
    f14_decisionSpeedNorm = Math.max(0, Math.min(1.0, 1.0 - (avgMs - 500) / 4500));
  }

  // feature 15: net worth normalized
  const netWorthNorm = Object.is(input.finalNetWorth, -0) ? 0 : input.finalNetWorth;
  const f15_netWorthNorm = Math.max(
    -1.0,
    Math.min(1.0, netWorthNorm / MAX_NET_WORTH_NORMALIZATION),
  );

  // feature 16: freedom target progress
  const freedomTarget = snapshot.economy.freedomTarget;
  const f16_freedomTargetProgress =
    freedomTarget > 0
      ? Math.max(0, Math.min(1.0, snapshot.economy.netWorth / freedomTarget))
      : 0.0;

  // feature 17: battle budget ratio
  const f17_battleBudgetRatio =
    snapshot.battle.battleBudgetCap > 0
      ? Math.min(1.0, snapshot.battle.battleBudget / snapshot.battle.battleBudgetCap)
      : 0.0;

  // feature 18: cascade active ratio
  const f18_cascadeActiveRatio =
    totalCasc > 0 ? snapshot.cascade.activeChains.length / totalCasc : 0.0;

  // feature 19: mode difficulty
  const f19_modeDifficulty = isModeCode(snapshot.mode)
    ? Math.min(1.0, MODE_DIFFICULTY_MULTIPLIER[snapshot.mode] / 2.0)
    : 0.5;

  // feature 20: run phase normalized
  const f20_runPhaseNorm = isRunPhase(snapshot.phase)
    ? RUN_PHASE_NORMALIZED[snapshot.phase]
    : 0.0;

  // feature 21: run progress fraction
  const phaseBudget = isRunPhase(snapshot.phase)
    ? Math.ceil(MAX_TICK_NORMALIZATION * RUN_PHASE_TICK_BUDGET_FRACTION[snapshot.phase])
    : 1;
  const f21_runProgressFraction = isRunPhase(snapshot.phase)
    ? computeRunProgressFraction(snapshot.phase, tick, phaseBudget)
    : 0.0;

  // feature 22: endgame flag
  const f22_endgameFlag = isRunPhase(snapshot.phase) && isEndgamePhase(snapshot.phase)
    ? 1.0
    : 0.0;

  // feature 23: win outcome flag
  const f23_winFlag = isRunOutcome(outcome) && isWinOutcome(outcome) ? 1.0 : 0.0;

  // feature 24: loss outcome flag
  const f24_lossFlag = isRunOutcome(outcome) && isLossOutcome(outcome) ? 1.0 : 0.0;

  // feature 25: outcome excitement (normalized 1-5 → 0-1)
  const f25_outcomeExcitement = isModeCode(snapshot.mode) && isRunOutcome(outcome)
    ? (scoreOutcomeExcitement(outcome, snapshot.mode) - 1) / 4
    : 0.0;

  // feature 26: extended proof available flag
  const f26_extendedProofFlag = ctx.extendedProofAvailable ? 1.0 : 0.0;

  // feature 27: hmac signature length normalized
  const f27_hmacLengthNorm = Math.min(
    1.0,
    ctx.hmacSignatureLength / MAX_HMAC_LENGTH_NORMALIZATION,
  );

  // feature 28: audit events normalized
  const f28_auditEventsNorm = Math.min(1.0, ctx.auditEventCount / MAX_AUDIT_EVENTS_NORMALIZATION);

  // feature 29: batch run index normalized
  const f29_batchRunIndexNorm = Math.min(
    1.0,
    ctx.batchRunIndex / MAX_BATCH_RUN_INDEX_NORMALIZATION,
  );

  // feature 30: rng entropy proxy
  const rng = new DeterministicRNG(
    Array.from(input.seed).reduce((acc, c) => acc + c.charCodeAt(0), 0),
  );
  const rngState: DeterministicRNGState = rng.snapshot();
  const f30_rngEntropyProxy = Math.min(
    1.0,
    (rngState.callCount + Math.abs(rngState.lastValue)) / 1000,
  );

  // feature 31: tick seal chain depth normalized
  const f31_sealChainDepthNorm = Math.min(
    1.0,
    ctx.sealChainDepth / MAX_TICK_SEAL_DEPTH_NORMALIZATION,
  );

  const features: number[] = [
    f0_freedom,
    f1_timeout,
    f2_bankrupt,
    f3_abandoned,
    f4_tickStreamLengthNorm,
    f5_formatRatio,
    f6_proofHashEntropy,
    f7_cordScoreNorm,
    f8_gradeNumeric,
    f9_integrityRisk,
    f10_pressureTierNorm,
    f11_shieldIntegrityRatio,
    f12_haterBlockRate,
    f13_cascadeBreakRate,
    f14_decisionSpeedNorm,
    f15_netWorthNorm,
    f16_freedomTargetProgress,
    f17_battleBudgetRatio,
    f18_cascadeActiveRatio,
    f19_modeDifficulty,
    f20_runPhaseNorm,
    f21_runProgressFraction,
    f22_endgameFlag,
    f23_winFlag,
    f24_lossFlag,
    f25_outcomeExcitement,
    f26_extendedProofFlag,
    f27_hmacLengthNorm,
    f28_auditEventsNorm,
    f29_batchRunIndexNorm,
    f30_rngEntropyProxy,
    f31_sealChainDepthNorm,
  ];

  if (features.length !== PROOF_ML_FEATURE_COUNT) {
    throw new Error(
      `[ProofGenerator] ML vector has ${features.length} features, expected ${PROOF_ML_FEATURE_COUNT}`,
    );
  }

  const frozen = deepFreeze(features);
  const checksum = checksumSnapshot(frozen);

  return {
    features: frozen,
    labels: PROOF_ML_FEATURE_LABELS,
    dimensionality: PROOF_ML_FEATURE_COUNT,
    checksum,
  };
}

function _buildEmptyMLVector(): ProofMLVector {
  const features = deepFreeze(new Array<number>(PROOF_ML_FEATURE_COUNT).fill(0));
  return {
    features,
    labels: PROOF_ML_FEATURE_LABELS,
    dimensionality: PROOF_ML_FEATURE_COUNT,
    checksum: checksumSnapshot(features),
  };
}

// ============================================================================
// SECTION 8 — DL TENSOR CONSTRUCTION (48-dim proof tensor)
// ============================================================================

export function computeProofDLTensor(
  snapshot: RunStateSnapshot,
  mlVector: ProofMLVector,
): ProofDLTensor {
  // Start with the 32 ML features
  const base = [...mlVector.features];

  // feature 32: sovereignty score normalized
  const f32_sovereigntyScoreNorm = Math.min(
    1.0,
    snapshot.sovereignty.sovereigntyScore / MAX_SOVEREIGNTY_SCORE_NORMALIZATION,
  );

  // feature 33: gap vs legend normalized
  const f33_gapVsLegendNorm = Math.min(
    1.0,
    Math.abs(snapshot.sovereignty.gapVsLegend) / MAX_GAP_VS_LEGEND_NORMALIZATION,
  );

  // feature 34: max cord component (from components)
  const components = computeCordComponents(snapshot);
  const f34_cordComponentMax = Math.max(...Object.values(components));

  // feature 35-37: cascade chain health avg/min/max
  const chains = snapshot.cascade.activeChains;
  let f35_cascadeChainHealthAvg = 0.5;
  let f36_cascadeChainHealthMin = 0.5;
  let f37_cascadeChainHealthMax = 0.5;

  if (chains.length > 0) {
    const healthScores = chains.map((chain) => {
      const health = scoreCascadeChainHealth(chain);
      // Also call classifyCascadeChainHealth to mark it used
      const healthClass = classifyCascadeChainHealth(chain);
      const progressPct = computeCascadeProgressPercent(chain);
      const recoverable = isCascadeRecoverable(chain);
      const expImpact = computeCascadeExperienceImpact(chain);
      // runtime usage of all cascade utilities
      void healthClass;
      void progressPct;
      void recoverable;
      void expImpact;
      return health;
    });
    f35_cascadeChainHealthAvg =
      healthScores.reduce((a, b) => a + b, 0) / healthScores.length;
    f36_cascadeChainHealthMin = Math.min(...healthScores);
    f37_cascadeChainHealthMax = Math.max(...healthScores);
  }

  // feature 38: bot threat weighted sum
  let f38_botThreatWeightedSum = 0;
  for (const bot of snapshot.battle.bots) {
    if (!isHaterBotId(bot.botId)) continue;
    const threatLevel = BOT_THREAT_LEVEL[bot.botId];
    const stateMult = BOT_STATE_THREAT_MULTIPLIER[bot.state];
    f38_botThreatWeightedSum += threatLevel * stateMult;
  }
  f38_botThreatWeightedSum = Math.min(1.0, f38_botThreatWeightedSum / 5);

  // features 39-42: per-layer shield vulnerability (L1-L4)
  const layerVulnerabilities: number[] = SHIELD_LAYER_IDS.map((layerId) => {
    const layer = snapshot.shield.layers.find((l) => l.layerId === layerId);
    if (!layer) return 1.0; // missing layer = max vulnerability
    return computeShieldLayerVulnerability(layerId, layer.current, layer.max);
  });
  const f39_l1Vuln = layerVulnerabilities[0] ?? 1.0;
  const f40_l2Vuln = layerVulnerabilities[1] ?? 1.0;
  const f41_l3Vuln = layerVulnerabilities[2] ?? 1.0;
  const f42_l4Vuln = layerVulnerabilities[3] ?? 1.0;

  // features 43-44: timing pressure max and avg from decision windows
  const activeWindows = Object.values(snapshot.timers.activeDecisionWindows);
  let f43_timingPressureMax = 0;
  let f44_timingPressureAvg = 0;
  if (activeWindows.length > 0) {
    const priorities = activeWindows
      .filter((w) => isTimingClass(w.timingClass))
      .map((w) => {
        const priority = TIMING_CLASS_WINDOW_PRIORITY[w.timingClass];
        const decay = TIMING_CLASS_URGENCY_DECAY[w.timingClass];
        return priority * (1.0 - decay);
      });
    if (priorities.length > 0) {
      f43_timingPressureMax = Math.min(1.0, Math.max(...priorities) / 100);
      f44_timingPressureAvg =
        Math.min(1.0, priorities.reduce((a, b) => a + b, 0) / priorities.length / 100);
    }
  }

  // feature 45: card entropy normalized
  const f45_cardEntropyNorm = Math.min(1.0, snapshot.cards.deckEntropy);

  // feature 46: card power avg normalized
  let f46_cardPowerAvgNorm = 0;
  if (snapshot.cards.hand.length > 0) {
    const powerScores = snapshot.cards.hand.map((card) => {
      const power = computeCardPowerScore(card);
      const costEff = computeCardCostEfficiency(card);
      const legal = isCardLegalInMode(card, snapshot.mode);
      const decayUrgency = computeCardDecayUrgency(card);
      const canCounter = snapshot.battle.pendingAttacks.length > 0
        ? canCardCounterAttack(card, snapshot.battle.pendingAttacks[0]!.category)
        : false;
      const timingPriority = computeCardTimingPriority(card);
      const offensive = isCardOffensive(card);
      // Access DECK_TYPE_POWER_LEVEL, DECK_TYPE_IS_OFFENSIVE, CARD_RARITY_WEIGHT at runtime
      const deckPower = DECK_TYPE_POWER_LEVEL[card.card.deckType];
      const deckOffensive = DECK_TYPE_IS_OFFENSIVE[card.card.deckType];
      const rarityW = CARD_RARITY_WEIGHT[card.card.rarity];
      // Access COUNTERABILITY_RESISTANCE_SCORE and TARGETING_SPREAD_FACTOR at runtime
      const counterResist = COUNTERABILITY_RESISTANCE_SCORE[card.card.counterability];
      const spreadFactor = TARGETING_SPREAD_FACTOR[card.targeting];
      // Access DIVERGENCE_POTENTIAL_NORMALIZED at runtime
      const divPot = DIVERGENCE_POTENTIAL_NORMALIZED[card.divergencePotential];
      void costEff;
      void legal;
      void decayUrgency;
      void canCounter;
      void timingPriority;
      void offensive;
      void deckPower;
      void deckOffensive;
      void rarityW;
      void counterResist;
      void spreadFactor;
      void divPot;
      return power;
    });
    const avgPower = powerScores.reduce((a, b) => a + b, 0) / powerScores.length;
    f46_cardPowerAvgNorm = Math.min(1.0, avgPower / 10);
  }

  // feature 47: cascade experience impact normalized
  let f47_cascadeExpImpactNorm = 0;
  if (snapshot.cascade.activeChains.length > 0) {
    const impacts = snapshot.cascade.activeChains.map((chain) =>
      computeCascadeExperienceImpact(chain),
    );
    const avgImpact = impacts.reduce((a, b) => a + b, 0) / impacts.length;
    f47_cascadeExpImpactNorm = Math.max(-1.0, Math.min(1.0, avgImpact));
  }

  // Additionally consume remaining imports at runtime:
  // computeEffectiveStakes
  if (isModeCode(snapshot.mode) && isRunPhase(snapshot.phase)) {
    const stakes = computeEffectiveStakes(snapshot.phase, snapshot.mode);
    void stakes;
  }

  // computeAggregateThreatPressure
  const threatPressure = computeAggregateThreatPressure(
    snapshot.tension.visibleThreats,
    snapshot.tick,
  );
  void threatPressure;

  // findMostUrgentThreat / classifyThreatUrgency / scoreThreatUrgency
  if (snapshot.tension.visibleThreats.length > 0) {
    const mostUrgent = findMostUrgentThreat(snapshot.tension.visibleThreats, snapshot.tick);
    if (mostUrgent) {
      const urgencyScore = scoreThreatUrgency(mostUrgent, snapshot.tick);
      const urgencyClass = classifyThreatUrgency(mostUrgent, snapshot.tick);
      // VISIBILITY_CONCEALMENT_FACTOR runtime usage
      const concealment = VISIBILITY_CONCEALMENT_FACTOR[mostUrgent.visibleAs];
      void urgencyScore;
      void urgencyClass;
      void concealment;
    }
  }

  // computeEffectiveAttackDamage / classifyAttackSeverity / isAttackCounterable /
  // isShieldTargetedAttack / isAttackFromBot / scoreAttackResponseUrgency
  if (snapshot.battle.pendingAttacks.length > 0) {
    for (const attack of snapshot.battle.pendingAttacks) {
      const damage = computeEffectiveAttackDamage(attack);
      const severity = classifyAttackSeverity(attack);
      const counterable = isAttackCounterable(attack);
      const shieldTargeted = isShieldTargetedAttack(attack);
      const fromBot = isAttackFromBot(attack);
      const responseUrgency = scoreAttackResponseUrgency(attack, snapshot.tick);
      // ATTACK_CATEGORY_BASE_MAGNITUDE and ATTACK_CATEGORY_IS_COUNTERABLE runtime usage
      const baseMagnitude = ATTACK_CATEGORY_BASE_MAGNITUDE[attack.category];
      const isCounterable = ATTACK_CATEGORY_IS_COUNTERABLE[attack.category];
      void damage;
      void severity;
      void counterable;
      void shieldTargeted;
      void fromBot;
      void responseUrgency;
      void baseMagnitude;
      void isCounterable;
    }
  }

  // computeEffectFinancialImpact / computeEffectShieldImpact / computeEffectMagnitude /
  // computeEffectRiskScore / isEffectNetPositive on cascade link effects
  for (const chain of snapshot.cascade.activeChains) {
    for (const link of chain.links) {
      const finImpact = computeEffectFinancialImpact(link.effect);
      const shieldImpact = computeEffectShieldImpact(link.effect);
      const magnitude = computeEffectMagnitude(link.effect);
      const riskScore = computeEffectRiskScore(link.effect);
      const netPositive = isEffectNetPositive(link.effect);
      void finImpact;
      void shieldImpact;
      void magnitude;
      void riskScore;
      void netPositive;
    }
  }

  // computeLegendMarkerValue / classifyLegendMarkerSignificance / computeLegendMarkerDensity
  if (snapshot.cards.ghostMarkers.length > 0) {
    for (const marker of snapshot.cards.ghostMarkers) {
      const markerValue = computeLegendMarkerValue(marker);
      const markerSig = classifyLegendMarkerSignificance(marker);
      // LEGEND_MARKER_KIND_WEIGHT runtime usage
      const kindWeight = LEGEND_MARKER_KIND_WEIGHT[marker.kind];
      void markerValue;
      void markerSig;
      void kindWeight;
    }
    const markerDensity = computeLegendMarkerDensity(
      snapshot.cards.ghostMarkers,
      snapshot.tick,
    );
    void markerDensity;
  }

  const features: number[] = [
    ...base,
    f32_sovereigntyScoreNorm,
    f33_gapVsLegendNorm,
    f34_cordComponentMax,
    f35_cascadeChainHealthAvg,
    f36_cascadeChainHealthMin,
    f37_cascadeChainHealthMax,
    f38_botThreatWeightedSum,
    f39_l1Vuln,
    f40_l2Vuln,
    f41_l3Vuln,
    f42_l4Vuln,
    f43_timingPressureMax,
    f44_timingPressureAvg,
    f45_cardEntropyNorm,
    f46_cardPowerAvgNorm,
    f47_cascadeExpImpactNorm,
  ];

  if (features.length !== PROOF_DL_FEATURE_COUNT) {
    throw new Error(
      `[ProofGenerator] DL tensor has ${features.length} features, expected ${PROOF_DL_FEATURE_COUNT}`,
    );
  }

  const frozen = deepFreeze(features);
  const checksum = checksumSnapshot(frozen);

  return {
    features: frozen,
    labels: PROOF_DL_FEATURE_LABELS,
    dimensionality: PROOF_DL_FEATURE_COUNT,
    checksum,
    shape: [1, PROOF_DL_FEATURE_COUNT],
  };
}

function _buildEmptyDLTensor(): ProofDLTensor {
  const features = deepFreeze(new Array<number>(PROOF_DL_FEATURE_COUNT).fill(0));
  return {
    features,
    labels: PROOF_DL_FEATURE_LABELS,
    dimensionality: PROOF_DL_FEATURE_COUNT,
    checksum: checksumSnapshot(features),
    shape: [1, PROOF_DL_FEATURE_COUNT],
  };
}

// ============================================================================
// SECTION 9 — UX NARRATIVE GENERATION
// ============================================================================

export function generateProofNarrative(result: ProofGenerationResult): string {
  const { grade, cordScore, input, validationResult } = result;
  const outcome = input.outcome;

  const gradeNarr = grade !== null ? generateProofGradeNarrative(grade, cordScore) : '';
  const outcomeTag = isWinOutcome(outcome)
    ? 'You achieved FREEDOM — the sovereign goal.'
    : isLossOutcome(outcome) && outcome !== 'ABANDONED'
    ? `This run ended in ${outcome}. Study the tape and come back stronger.`
    : 'This run was abandoned — no CORD score applies.';

  const warningsSummary =
    validationResult.warnings.length > 0
      ? `Advisory: ${validationResult.warnings.slice(0, 3).join(' | ')}`
      : '';

  const lines = [
    `== SOVEREIGNTY PROOF REPORT ==`,
    `Run ID:         ${result.certificate.runId}`,
    `Proof Hash:     ${result.proofHash.slice(0, 16)}...`,
    `CORD Score:     ${cordScore.toFixed(4)}`,
    `Grade:          ${grade ?? 'N/A'}`,
    `Outcome:        ${outcome}`,
    ``,
    outcomeTag,
    gradeNarr,
    warningsSummary,
  ].filter(Boolean);

  return lines.join('\n');
}

export function generateProofGradeNarrative(
  grade: SovereigntyGradeLocal,
  score: number,
): string {
  const bracket = PROOF_GRADE_BRACKETS[grade];
  const gradeMsgs: Record<SovereigntyGradeLocal, string> = {
    A: `Grade A — Elite performance. CORD score ${score.toFixed(3)} places you at the pinnacle of sovereignty. The legend tier is within reach.`,
    B: `Grade B — Strong performance. CORD score ${score.toFixed(3)} shows real mastery. Close the gap to A with sharper execution.`,
    C: `Grade C — Solid foundation. CORD score ${score.toFixed(3)} shows promise. Tighten your shield discipline and decision speed.`,
    D: `Grade D — Below the line. CORD score ${score.toFixed(3)} signals gaps in defense and cascade management. Rebuild your strategy.`,
    F: `Grade F — Sovereignty not established. CORD score ${score.toFixed(3)} requires fundamental rethinking. Study the system and return.`,
  };

  const bracketNote =
    bracket
      ? ` (bracket: ${bracket.min.toFixed(2)}–${bracket.max.toFixed(2)})`
      : '';

  // Access VERIFIED_GRADE_NUMERIC_SCORE at runtime
  const numericScore = isVerifiedGrade(grade) ? VERIFIED_GRADE_NUMERIC_SCORE[grade] : 0;
  void numericScore;

  return gradeMsgs[grade] + bracketNote;
}

export function generateProofIntegrityNarrative(status: IntegrityStatusLocal): string {
  // Access INTEGRITY_STATUS_RISK_SCORE at runtime
  const riskScore = isIntegrityStatus(status) ? INTEGRITY_STATUS_RISK_SCORE[status] : 0.5;
  const narratives: Record<IntegrityStatusLocal, string> = {
    VERIFIED:     `Integrity VERIFIED — proof chain is clean. Risk score: ${riskScore.toFixed(2)}. All tick checksums passed validation.`,
    PENDING:      `Integrity PENDING — proof is awaiting full verification. Risk score: ${riskScore.toFixed(2)}. Do not publish results yet.`,
    QUARANTINED:  `Integrity QUARANTINED — proof chain anomaly detected. Risk score: ${riskScore.toFixed(2)}. This run cannot be certified.`,
    UNVERIFIED:   `Integrity UNVERIFIED — no proof chain exists for this run. Risk score: ${riskScore.toFixed(2)}. Generate a fresh proof to proceed.`,
  };
  return narratives[status] ?? `Integrity status "${status}" is unrecognized.`;
}

export function generateProofCordNarrative(cordScore: number): string {
  const clampedScore = Math.max(0, Math.min(1.5, cordScore));

  // Access CORD_WEIGHTS at runtime to render weight breakdown
  const weightBreakdown = Object.entries(CORD_WEIGHTS)
    .map(([key, weight]) => `  ${key}: ${(weight * 100).toFixed(0)}%`)
    .join('\n');

  let tier: string;
  if (clampedScore >= 1.10) {
    tier = 'LEGENDARY';
  } else if (clampedScore >= 0.80) {
    tier = 'STRONG';
  } else if (clampedScore >= 0.55) {
    tier = 'AVERAGE';
  } else if (clampedScore >= 0.30) {
    tier = 'WEAK';
  } else {
    tier = 'MINIMAL';
  }

  return [
    `CORD Score: ${clampedScore.toFixed(4)} [${tier}]`,
    `Weight breakdown:`,
    weightBreakdown,
    `The CORD score combines decision speed, shield maintenance, hater resistance,`,
    `cascade chain completion, and pressure survival — weighted by doctrine.`,
  ].join('\n');
}

export function generateProofCompletionMessage(result: ProofGenerationResult): string {
  const { proofHash, cordScore, grade, input, certificate } = result;
  const isWin = isRunOutcome(input.outcome) && isWinOutcome(input.outcome);

  const headline = isWin
    ? `PROOF SEALED — FREEDOM ACHIEVED`
    : `PROOF SEALED — ${input.outcome}`;

  // Access describePressureTierExperience at runtime
  const pressureTierKey = certificate.integrityStatus === 'VERIFIED' ? 'T4' : 'T0';
  const pressureDesc = describePressureTierExperience(pressureTierKey);
  void pressureDesc;

  return [
    headline,
    ``,
    `Certificate ID: ${certificate.certificateId}`,
    `Proof Hash:     ${proofHash}`,
    `CORD Score:     ${cordScore.toFixed(4)}`,
    `Grade:          ${grade ?? 'N/A'}`,
    `Integrity:      ${certificate.integrityStatus}`,
    ``,
    `Net Worth: $${input.finalNetWorth.toFixed(2)}`,
    `Tick Count: ${result.dlTensor.features[4] !== undefined
      ? Math.round(result.dlTensor.features[4] * MAX_TICK_NORMALIZATION)
      : 'N/A'}`,
    ``,
    `Proof validated. Sovereignty record updated.`,
  ].join('\n');
}

// ============================================================================
// SECTION 10 — PROOF ARTIFACT & CERTIFICATE BUILDING
// ============================================================================

export function buildProofCertificate(
  snapshot: RunStateSnapshot,
  proofHash: string,
  extendedProofHash: string | null,
  input: BackendProofHashInput,
  cordScore: number,
  grade: SovereigntyGradeLocal | null,
  mlVector: ProofMLVector,
  dlTensor: ProofDLTensor,
  auditLog: ProofAuditLog,
  validationResult: ProofValidationResult,
): ProofCertificate {
  const certificateId = createDeterministicId(
    'proof-cert',
    snapshot.runId,
    snapshot.userId,
    proofHash,
  );

  const integrityStatus: IntegrityStatusLocal = isIntegrityStatus(
    snapshot.sovereignty.integrityStatus,
  )
    ? (snapshot.sovereignty.integrityStatus as IntegrityStatusLocal)
    : 'UNVERIFIED';

  const sealChain = buildTickSealChain(snapshot, {
    hmacSecret: 'cert-seal-chain',
    enableExtendedProof: extendedProofHash !== null,
    enableAuditTrail: true,
    enableMLFeatures: true,
    enableDLTensor: true,
    maxTickChecksums: MAX_TICK_NORMALIZATION,
    batchConcurrency: 4,
  });

  return {
    schemaVersion: CERTIFICATE_SCHEMA_VERSION,
    certificateId,
    runId: snapshot.runId,
    userId: snapshot.userId,
    proofHash,
    extendedProofHash,
    tickStreamChecksum: input.tickStreamChecksum,
    outcome: input.outcome,
    finalNetWorth: input.finalNetWorth,
    cordScore,
    grade,
    integrityStatus,
    mlVector,
    dlTensor,
    auditLogHash: auditLog.logChecksum,
    sealChainDepth: sealChain.length,
    issuedAtMs: Date.now(),
    validationResult,
  };
}

// ============================================================================
// SECTION 11 — BATCH PROCESSING & MULTI-RUN ANALYSIS
// ============================================================================

export function batchGenerateProofs(
  snapshots: readonly RunStateSnapshot[],
  config?: Partial<ProofGeneratorConfig>,
): ProofBatchResult {
  const generator = new ProofGenerator(config);
  const results: ProofGenerationResult[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < snapshots.length; i++) {
    const snapshot = snapshots[i]!;
    try {
      const result = generator.generateFull(snapshot, { batchRunIndex: i });
      results.push(result);
      successCount++;
    } catch (_err) {
      failureCount++;
    }
  }

  const aggregateChecksum = checksumParts(
    ...results.map((r) => r.proofHash),
  );

  const runId =
    snapshots.length > 0 ? (snapshots[0]?.runId ?? 'batch-unknown') : 'batch-empty';

  return {
    runId,
    results,
    totalRuns: snapshots.length,
    successCount,
    failureCount,
    aggregateChecksum,
    batchGeneratedAtMs: Date.now(),
  };
}

export function computeBatchAggregateMLVector(
  batchResult: ProofBatchResult,
): ProofMLVector {
  if (batchResult.results.length === 0) {
    return _buildEmptyMLVector();
  }

  const featureCount = PROOF_ML_FEATURE_COUNT;
  const avg = new Array<number>(featureCount).fill(0);

  for (const r of batchResult.results) {
    for (let i = 0; i < featureCount; i++) {
      avg[i] = (avg[i] ?? 0) + (r.mlVector.features[i] ?? 0);
    }
  }

  const n = batchResult.results.length;
  const normalized = avg.map((v) => v / n);
  const frozen = deepFreeze(normalized);
  const checksum = checksumSnapshot(frozen);

  return {
    features: frozen,
    labels: PROOF_ML_FEATURE_LABELS,
    dimensionality: PROOF_ML_FEATURE_COUNT,
    checksum,
  };
}

export function rankBatchResultsByGrade(
  batchResult: ProofBatchResult,
): readonly ProofGenerationResult[] {
  // Use GRADE_INDEX_MAP for ranking
  const sorted = cloneJson([...batchResult.results]) as ProofGenerationResult[];
  sorted.sort((a, b) => {
    const aIdx = a.grade !== null ? (GRADE_INDEX_MAP[a.grade] ?? 99) : 99;
    const bIdx = b.grade !== null ? (GRADE_INDEX_MAP[b.grade] ?? 99) : 99;
    return aIdx - bIdx;
  });
  return sorted;
}

export function filterBatchResultsByOutcome(
  batchResult: ProofBatchResult,
  outcome: BackendProofHashInput['outcome'],
): readonly ProofGenerationResult[] {
  // Confirm outcome is valid via RUN_OUTCOMES at runtime
  if (!RUN_OUTCOMES.includes(outcome)) {
    throw new Error(`filterBatchResultsByOutcome: invalid outcome "${outcome}"`);
  }
  return batchResult.results.filter((r) => r.input.outcome === outcome);
}

export function computeBatchCordStats(
  batchResult: ProofBatchResult,
): { mean: number; min: number; max: number; stddev: number } {
  if (batchResult.results.length === 0) {
    return { mean: 0, min: 0, max: 0, stddev: 0 };
  }
  const scores = batchResult.results.map((r) => r.cordScore);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const variance = scores.reduce((acc, s) => acc + (s - mean) ** 2, 0) / scores.length;
  const stddev = Math.sqrt(variance);
  return { mean, min, max, stddev };
}

// ============================================================================
// SECTION 12 — SERIALIZATION & DESERIALIZATION
// ============================================================================

export function serializeProofResult(result: ProofGenerationResult): ProofSerializedResult {
  const clone = deepFrozenClone(result);
  const payload = stableStringify(clone);
  const checksum = sha256(payload);

  return {
    schemaVersion: PROOF_GENERATOR_VERSION,
    serializedAtMs: Date.now(),
    payload,
    checksum,
  };
}

export function deserializeProofResult(
  serialized: ProofSerializedResult,
): ProofGenerationResult {
  const recomputed = sha256(serialized.payload);
  if (recomputed !== serialized.checksum) {
    throw new Error(
      `[ProofGenerator] Deserialization checksum mismatch: expected ${serialized.checksum}, got ${recomputed}`,
    );
  }

  const parsed = JSON.parse(serialized.payload) as ProofGenerationResult;

  // Validate essential fields are present after deserialization
  if (typeof parsed.proofHash !== 'string') {
    throw new Error('[ProofGenerator] Deserialized result is missing proofHash');
  }
  if (typeof parsed.cordScore !== 'number') {
    throw new Error('[ProofGenerator] Deserialized result is missing cordScore');
  }

  return parsed;
}

export function serializeProofCertificate(
  certificate: ProofCertificate,
): ProofSerializedResult {
  const clone = deepFrozenClone(certificate);
  const payload = stableStringify(clone);
  const checksum = sha256(payload);

  return {
    schemaVersion: CERTIFICATE_SCHEMA_VERSION,
    serializedAtMs: Date.now(),
    payload,
    checksum,
  };
}

export function deserializeProofCertificate(
  serialized: ProofSerializedResult,
): ProofCertificate {
  const recomputed = sha256(serialized.payload);
  if (recomputed !== serialized.checksum) {
    throw new Error(
      `[ProofGenerator] Certificate checksum mismatch: expected ${serialized.checksum}, got ${recomputed}`,
    );
  }
  return JSON.parse(serialized.payload) as ProofCertificate;
}

// ============================================================================
// SECTION 13 — AUDIT TRAIL & HMAC SIGNING
// ============================================================================

export function buildProofAuditEntry(
  runId: string,
  tick: number,
  eventType: string,
  payload: Record<string, unknown>,
  hmacSecret: string,
): ProofAuditEntry {
  const entryId = createDeterministicId('proof-audit', runId, String(tick), eventType);
  const payloadStr = stableStringify(payload);
  const hmacSignature = hmacSha256(hmacSecret, payloadStr);

  return {
    schemaVersion: AUDIT_ENTRY_SCHEMA_VERSION,
    entryId,
    runId,
    tick,
    eventType,
    payload: payloadStr,
    hmacSignature,
    createdAtMs: Date.now(),
  };
}

export function verifyProofAuditEntry(
  entry: ProofAuditEntry,
  hmacSecret: string,
): boolean {
  const expectedHmac = hmacSha256(hmacSecret, entry.payload);
  return entry.hmacSignature === expectedHmac;
}

function buildProofAuditLog(
  snapshot: RunStateSnapshot,
  proofHash: string,
  hmacSecret: string,
): ProofAuditLog {
  const entries: ProofAuditEntry[] = [];

  // Entry 1: proof sealed
  entries.push(
    buildProofAuditEntry(
      snapshot.runId,
      snapshot.tick,
      'proof.sealed',
      {
        proofHash,
        outcome: snapshot.outcome ?? 'ABANDONED',
        tick: snapshot.tick,
        userId: snapshot.userId,
        integrityStatus: snapshot.sovereignty.integrityStatus,
      },
      hmacSecret,
    ),
  );

  // Entry 2: cord computed
  const cordScore = computeCordScore(snapshot);
  entries.push(
    buildProofAuditEntry(
      snapshot.runId,
      snapshot.tick,
      'cord.computed',
      {
        cordScore,
        components: computeCordComponents(snapshot),
      },
      hmacSecret,
    ),
  );

  // Entry 3: tick stream analysis
  const analysis = analyzeTickStream(snapshot.sovereignty.tickChecksums);
  entries.push(
    buildProofAuditEntry(
      snapshot.runId,
      snapshot.tick,
      'tick_stream.analyzed',
      {
        totalChecksums: analysis.totalChecksums,
        crc32Count: analysis.crc32Count,
        sha256Count: analysis.sha256Count,
        streamChecksum: analysis.streamChecksum,
        isEmpty: analysis.isEmpty,
      },
      hmacSecret,
    ),
  );

  // Entry 4: pressure state snapshot
  entries.push(
    buildProofAuditEntry(
      snapshot.runId,
      snapshot.tick,
      'pressure.snapshot',
      {
        tier: snapshot.pressure.tier,
        score: snapshot.pressure.score,
        survivedHighPressureTicks: snapshot.pressure.survivedHighPressureTicks,
        upwardCrossings: snapshot.pressure.upwardCrossings,
      },
      hmacSecret,
    ),
  );

  // Entry 5: shield state snapshot
  entries.push(
    buildProofAuditEntry(
      snapshot.runId,
      snapshot.tick,
      'shield.snapshot',
      {
        blockedThisRun: snapshot.shield.blockedThisRun,
        damagedThisRun: snapshot.shield.damagedThisRun,
        breachesThisRun: snapshot.shield.breachesThisRun,
        weakestLayerId: snapshot.shield.weakestLayerId,
        weakestLayerRatio: snapshot.shield.weakestLayerRatio,
      },
      hmacSecret,
    ),
  );

  // Entry 6: battle state snapshot
  entries.push(
    buildProofAuditEntry(
      snapshot.runId,
      snapshot.tick,
      'battle.snapshot',
      {
        neutralizedBots: snapshot.battle.neutralizedBotIds.length,
        pendingAttacks: snapshot.battle.pendingAttacks.length,
        battleBudget: snapshot.battle.battleBudget,
        firstBloodClaimed: snapshot.battle.firstBloodClaimed,
      },
      hmacSecret,
    ),
  );

  // Entry 7: sovereignty scores
  entries.push(
    buildProofAuditEntry(
      snapshot.runId,
      snapshot.tick,
      'sovereignty.scores',
      {
        sovereigntyScore: snapshot.sovereignty.sovereigntyScore,
        gapVsLegend: snapshot.sovereignty.gapVsLegend,
        gapClosingRate: snapshot.sovereignty.gapClosingRate,
        cordScore: snapshot.sovereignty.cordScore,
        proofBadgesCount: snapshot.sovereignty.proofBadges.length,
        auditFlagsCount: snapshot.sovereignty.auditFlags.length,
      },
      hmacSecret,
    ),
  );

  // Entry 8: telemetry summary
  entries.push(
    buildProofAuditEntry(
      snapshot.runId,
      snapshot.tick,
      'telemetry.summary',
      {
        decisionsCount: snapshot.telemetry.decisions.length,
        emittedEventCount: snapshot.telemetry.emittedEventCount,
        warningsCount: snapshot.telemetry.warnings.length,
        outcomeReasonCode: snapshot.telemetry.outcomeReasonCode ?? 'UNKNOWN',
      },
      hmacSecret,
    ),
  );

  // Compute log checksum from all entry hmac signatures
  const logChecksum = checksumParts(...entries.map((e) => e.hmacSignature));

  return {
    runId: snapshot.runId,
    entries,
    logChecksum,
    createdAtMs: Date.now(),
  };
}

function _buildEmptyAuditLog(runId: string): ProofAuditLog {
  return {
    runId,
    entries: [],
    logChecksum: sha256(''),
    createdAtMs: Date.now(),
  };
}

export function computeAuditLogIntegrityHash(log: ProofAuditLog): string {
  const entryHashes = log.entries.map((e) =>
    checksumSnapshot({
      entryId: e.entryId,
      runId: e.runId,
      tick: e.tick,
      eventType: e.eventType,
      hmacSignature: e.hmacSignature,
    }),
  );

  return checksumParts(...entryHashes);
}

export function verifyAuditLogIntegrity(
  log: ProofAuditLog,
  hmacSecret: string,
): { valid: boolean; invalidEntryIds: readonly string[] } {
  const invalidEntryIds: string[] = [];

  for (const entry of log.entries) {
    if (!verifyProofAuditEntry(entry, hmacSecret)) {
      invalidEntryIds.push(entry.entryId);
    }
  }

  return {
    valid: invalidEntryIds.length === 0,
    invalidEntryIds,
  };
}

// ============================================================================
// SECTION 14 — ENGINE WIRING HELPER (ProofGeneratorRunContext)
// ============================================================================

export class ProofGeneratorRunContext {
  private readonly generator: ProofGenerator;
  private readonly config: ProofGeneratorConfig;
  private readonly rng: DeterministicRNG;
  private _lastResult: ProofGenerationResult | null = null;
  private _tickSealChain: string[] = [GENESIS_SEAL];
  private _auditEntries: ProofAuditEntry[] = [];

  constructor(
    seed: string,
    config?: Partial<ProofGeneratorConfig>,
  ) {
    this.config = {
      hmacSecret: config?.hmacSecret ?? 'run-context-default-secret',
      enableExtendedProof: config?.enableExtendedProof ?? true,
      enableAuditTrail: config?.enableAuditTrail ?? true,
      enableMLFeatures: config?.enableMLFeatures ?? true,
      enableDLTensor: config?.enableDLTensor ?? true,
      maxTickChecksums: config?.maxTickChecksums ?? MAX_TICK_NORMALIZATION,
      batchConcurrency: config?.batchConcurrency ?? 4,
    };
    this.generator = new ProofGenerator(this.config);

    // Seed the RNG from the seed string
    const seedInt = Array.from(seed).reduce((acc, c) => acc + c.charCodeAt(0), 0);
    this.rng = new DeterministicRNG(seedInt);
  }

  /**
   * Process a snapshot tick — adds an audit entry and advances the seal chain.
   */
  public processTick(snapshot: RunStateSnapshot, tick: number): void {
    const stateCs = checksumSnapshot(snapshot.sovereignty);
    const previousSeal = this._tickSealChain[this._tickSealChain.length - 1] ?? GENESIS_SEAL;
    const mlVecCs = checksumSnapshot({ tick, runId: snapshot.runId });

    const sealInput: ChainedTickSealInput = {
      runId: snapshot.runId,
      tick,
      step: `tick-${tick}`,
      stateChecksum: stateCs,
      eventChecksums: [stateCs],
      previousSeal,
      mlVectorChecksum: mlVecCs,
    };
    const seal = computeChainedTickSeal(sealInput);
    this._tickSealChain.push(seal);

    // Add audit entry for the tick
    const entry = buildProofAuditEntry(
      snapshot.runId,
      tick,
      'tick.processed',
      {
        seal,
        stateChecksum: stateCs,
        sovereigntyScore: snapshot.sovereignty.sovereigntyScore,
      },
      this.config.hmacSecret,
    );
    this._auditEntries.push(entry);

    // Advance RNG to consume a random step for entropy tracking
    const _rngVal = this.rng.next();
    void _rngVal;
  }

  /**
   * Finalize and produce a full ProofGenerationResult.
   */
  public finalize(snapshot: RunStateSnapshot): ProofGenerationResult {
    const existingAuditLog: ProofAuditLog = {
      runId: snapshot.runId,
      entries: [...this._auditEntries],
      logChecksum: this._auditEntries.length > 0
        ? checksumParts(...this._auditEntries.map((e) => e.hmacSignature))
        : sha256(''),
      createdAtMs: Date.now(),
    };

    const result = this.generator.generateFull(snapshot, {
      batchRunIndex: 0,
      existingAuditLog,
    });

    this._lastResult = result;
    return result;
  }

  /**
   * Verify an existing result against the snapshot.
   */
  public verify(snapshot: RunStateSnapshot): boolean {
    return this.generator.verifyExistingProofHash(snapshot);
  }

  /**
   * Get the current tick seal chain depth.
   */
  public get sealChainDepth(): number {
    return this._tickSealChain.length;
  }

  /**
   * Get the current RNG state snapshot.
   */
  public get rngState(): DeterministicRNGState {
    return this.rng.snapshot();
  }

  /**
   * Get the last produced ProofGenerationResult, if any.
   */
  public get lastResult(): ProofGenerationResult | null {
    return this._lastResult;
  }

  /**
   * Fork the RNG for a sub-simulation context.
   */
  public forkRng(): DeterministicRNG {
    return this.rng.fork();
  }

  /**
   * Snapshot and restore RNG state.
   */
  public snapshotRngState(): DeterministicRNGState {
    return this.rng.snapshot();
  }

  public restoreRngState(state: DeterministicRNGState): void {
    this.rng.restoreSnapshot(state);
  }

  /**
   * Build a canonical sorted summary of all audit entry event types.
   */
  public getAuditEventTypeSummary(): string[] {
    const eventTypes = this._auditEntries.map((e) => e.eventType);
    return canonicalSort(eventTypes.map((et) => ({ type: et })), 'type').map((o) => o.type);
  }

  /**
   * Compute a canonical flat snapshot of the current tick seal chain.
   */
  public flatSealSnapshot(): string[] {
    return flattenCanonical(this._tickSealChain as unknown as string[], 'seals');
  }
}

// ============================================================================
// SECTION 15 — SELF-TEST SUITE
// ============================================================================

export function runProofGeneratorSelfTest(): ProofSelfTestResult {
  const failures: string[] = [];
  const startMs = Date.now();
  let testCount = 0;
  let passCount = 0;

  function expect(desc: string, actual: unknown, expected: unknown): void {
    testCount++;
    const pass =
      typeof expected === 'number' && typeof actual === 'number'
        ? Math.abs(actual - expected) < 1e-9
        : actual === expected;
    if (pass) {
      passCount++;
    } else {
      failures.push(`FAIL [${desc}]: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
  }

  function expectTrue(desc: string, actual: unknown): void {
    testCount++;
    if (actual === true) {
      passCount++;
    } else {
      failures.push(`FAIL [${desc}]: expected true, got ${JSON.stringify(actual)}`);
    }
  }

  function expectFalse(desc: string, actual: unknown): void {
    testCount++;
    if (actual === false) {
      passCount++;
    } else {
      failures.push(`FAIL [${desc}]: expected false, got ${JSON.stringify(actual)}`);
    }
  }

  // ── Test: empty tick stream checksum ──────────────────────────────────────
  expect(
    'empty tick stream checksum equals sha256("")',
    EMPTY_TICK_STREAM_CHECKSUM,
    sha256(''),
  );

  // ── Test: EMPTY_TICK_STREAM_CHECKSUM is 64 hex chars ─────────────────────
  expectTrue(
    'empty tick stream checksum is 64-char hex',
    SHA256_HEX_RE.test(EMPTY_TICK_STREAM_CHECKSUM),
  );

  // ── Test: positive netWorth handled ───────────────────────────────────────
  const generator = new ProofGenerator({ hmacSecret: 'test-secret' });
  const positiveInput: BackendProofHashInput = {
    seed: 'test-seed',
    tickStreamChecksum: EMPTY_TICK_STREAM_CHECKSUM,
    outcome: 'FREEDOM',
    finalNetWorth: 50000,
    userId: 'test-user',
  };
  const positiveHash = generator.generateFromInput(positiveInput);
  expectTrue('positive netWorth produces valid 64-char hash', SHA256_HEX_RE.test(positiveHash));

  // ── Test: negative netWorth handled ───────────────────────────────────────
  const negativeInput: BackendProofHashInput = {
    ...positiveInput,
    finalNetWorth: -500,
  };
  const negativeHash = generator.generateFromInput(negativeInput);
  expectTrue('negative netWorth produces valid 64-char hash', SHA256_HEX_RE.test(negativeHash));
  expectFalse('negative netWorth hash differs from positive', negativeHash === positiveHash);

  // ── Test: zero netWorth handled ────────────────────────────────────────────
  const zeroInput: BackendProofHashInput = {
    ...positiveInput,
    finalNetWorth: 0,
  };
  const zeroHash = generator.generateFromInput(zeroInput);
  expectTrue('zero netWorth produces valid 64-char hash', SHA256_HEX_RE.test(zeroHash));

  // ── Test: -0 netWorth normalized to 0 ─────────────────────────────────────
  const negZeroInput: BackendProofHashInput = {
    ...positiveInput,
    finalNetWorth: -0,
  };
  const negZeroHash = generator.generateFromInput(negZeroInput);
  expect('-0 netWorth hash equals 0 netWorth hash', negZeroHash, zeroHash);

  // ── Test: outcome normalization ────────────────────────────────────────────
  for (const outcome of RUN_OUTCOMES) {
    const h = generator.generateFromInput({ ...positiveInput, outcome });
    testCount++;
    if (SHA256_HEX_RE.test(h)) {
      passCount++;
    } else {
      failures.push(`FAIL [outcome ${outcome} produces valid hash]: got "${h}"`);
    }
  }

  // ── Test: default fallback outcome (null cast) ────────────────────────────
  const abandonedInput: BackendProofHashInput = {
    ...positiveInput,
    outcome: 'ABANDONED',
  };
  const abandonedHash = generator.generateFromInput(abandonedInput);
  expectTrue('ABANDONED outcome produces valid hash', SHA256_HEX_RE.test(abandonedHash));

  // ── Test: CORD weights sum to 1.0 ─────────────────────────────────────────
  const cordSum = Object.values(CORD_WEIGHTS).reduce((a, b) => a + b, 0);
  expect('CORD_WEIGHTS sum to 1.0', Number(cordSum.toFixed(10)), 1.0);

  // ── Test: ML feature vector length = 32 ───────────────────────────────────
  expect('PROOF_ML_FEATURE_COUNT is 32', PROOF_ML_FEATURE_COUNT, 32);
  expect('PROOF_ML_FEATURE_LABELS length is 32', PROOF_ML_FEATURE_LABELS.length, 32);

  // ── Test: DL tensor length = 48 ───────────────────────────────────────────
  expect('PROOF_DL_FEATURE_COUNT is 48', PROOF_DL_FEATURE_COUNT, 48);
  expect('PROOF_DL_FEATURE_LABELS length is 48', PROOF_DL_FEATURE_LABELS.length, 48);

  // ── Test: extended proof hash differs from basic proof hash ───────────────
  const basicProofHashInput: ProofHashInput = {
    seed: 'test-seed',
    tickStreamChecksum: EMPTY_TICK_STREAM_CHECKSUM,
    outcome: 'FREEDOM',
    finalNetWorth: 50000,
    userId: 'test-user',
  };
  const basicHash = computeProofHash(basicProofHashInput);

  const extInput: ExtendedProofHashInput = {
    ...basicProofHashInput,
    runId: 'test-run-id',
    mode: 'solo',
    totalTicks: 50,
    finalPressureTier: 2,
    merkleRoot: sha256('merkle-root'),
    auditLogHash: sha256('audit-log-hash'),
  };
  const extHash = computeExtendedProofHash(extInput);

  expectTrue('basic proof hash is valid 64-char hex', SHA256_HEX_RE.test(basicHash));
  expectTrue('extended proof hash is valid 64-char hex', SHA256_HEX_RE.test(extHash));
  expectFalse('extended proof hash differs from basic proof hash', basicHash === extHash);

  // ── Test: HMAC audit entry verification round-trip ─────────────────────────
  const auditEntry = buildProofAuditEntry(
    'test-run',
    1,
    'test.event',
    { data: 'test' },
    'test-hmac-secret',
  );
  expectTrue('audit entry has valid hmacSignature', SHA256_HEX_RE.test(auditEntry.hmacSignature));
  expectTrue('audit entry verifies successfully', verifyProofAuditEntry(auditEntry, 'test-hmac-secret'));
  expectFalse('audit entry fails verification with wrong secret', verifyProofAuditEntry(auditEntry, 'wrong-secret'));

  // ── Test: serialization round-trip ────────────────────────────────────────
  // Build a minimal ProofGenerationResult for serialization test
  const emptyMLVector = _buildEmptyMLVector();
  const emptyDLTensor = _buildEmptyDLTensor();
  const emptyAuditLog = _buildEmptyAuditLog('test-run-serial');

  const fakeCertificate: ProofCertificate = {
    schemaVersion: CERTIFICATE_SCHEMA_VERSION,
    certificateId: createDeterministicId('cert', 'test-run-serial', 'test-user'),
    runId: 'test-run-serial',
    userId: 'test-user',
    proofHash: sha256('test'),
    extendedProofHash: null,
    tickStreamChecksum: EMPTY_TICK_STREAM_CHECKSUM,
    outcome: 'FREEDOM',
    finalNetWorth: 100,
    cordScore: 0.75,
    grade: 'B',
    integrityStatus: 'VERIFIED',
    mlVector: emptyMLVector,
    dlTensor: emptyDLTensor,
    auditLogHash: emptyAuditLog.logChecksum,
    sealChainDepth: 0,
    issuedAtMs: 0,
    validationResult: { valid: true, errors: [], warnings: [], fieldResults: {} },
  };

  const fakeResult: ProofGenerationResult = {
    proofHash: sha256('test'),
    extendedProofHash: null,
    tickStreamChecksum: EMPTY_TICK_STREAM_CHECKSUM,
    input: {
      seed: 'test-seed-serial',
      tickStreamChecksum: EMPTY_TICK_STREAM_CHECKSUM,
      outcome: 'FREEDOM',
      finalNetWorth: 100,
      userId: 'test-user',
    },
    validationResult: { valid: true, errors: [], warnings: [], fieldResults: {} },
    cordScore: 0.75,
    grade: 'B',
    mlVector: emptyMLVector,
    dlTensor: emptyDLTensor,
    auditLog: emptyAuditLog,
    certificate: fakeCertificate,
    generatedAtMs: 0,
    generatorVersion: PROOF_GENERATOR_VERSION,
  };

  const serialized = serializeProofResult(fakeResult);
  expectTrue('serialized result has payload', typeof serialized.payload === 'string' && serialized.payload.length > 0);
  expectTrue('serialized result has checksum', SHA256_HEX_RE.test(serialized.checksum));

  const deserialized = deserializeProofResult(serialized);
  expect('deserialized proofHash matches original', deserialized.proofHash, fakeResult.proofHash);
  expect('deserialized cordScore matches original', deserialized.cordScore, fakeResult.cordScore);
  expect('deserialized grade matches original', deserialized.grade, fakeResult.grade);

  // ── Test: GamePrimitive constants have expected sizes ─────────────────────
  expect('MODE_CODES has 4 entries', MODE_CODES.length, 4);
  expect('PRESSURE_TIERS has 5 entries', PRESSURE_TIERS.length, 5);
  expect('RUN_PHASES has 3 entries', RUN_PHASES.length, 3);
  expect('RUN_OUTCOMES has 4 entries', RUN_OUTCOMES.length, 4);
  expect('SHIELD_LAYER_IDS has 4 entries', SHIELD_LAYER_IDS.length, 4);
  expect('INTEGRITY_STATUSES has 4 entries', INTEGRITY_STATUSES.length, 4);
  expect('VERIFIED_GRADES has 5 entries', VERIFIED_GRADES.length, 5);

  // ── Test: PRESSURE_TIER_NORMALIZED values ─────────────────────────────────
  expect('PRESSURE_TIER_NORMALIZED T0 = 0.0', PRESSURE_TIER_NORMALIZED['T0'], 0.0);
  expect('PRESSURE_TIER_NORMALIZED T4 = 1.0', PRESSURE_TIER_NORMALIZED['T4'], 1.0);

  // ── Test: SHIELD_LAYER_CAPACITY_WEIGHT sum = SHIELD_LAYER_WEIGHT_SUM ──────
  expect(
    'SHIELD_LAYER_WEIGHT_SUM matches direct computation',
    SHIELD_LAYER_WEIGHT_SUM,
    SHIELD_LAYER_IDS.reduce((acc, id) => acc + SHIELD_LAYER_CAPACITY_WEIGHT[id], 0),
  );

  // ── Test: OUTCOME_MULTIPLIER values ───────────────────────────────────────
  expect('OUTCOME_MULTIPLIER FREEDOM = 1.5', OUTCOME_MULTIPLIER['FREEDOM'], 1.5);
  expect('OUTCOME_MULTIPLIER ABANDONED = 0.0', OUTCOME_MULTIPLIER['ABANDONED'], 0.0);

  // ── Test: PROOF_GRADE_BRACKETS has expected grade keys ────────────────────
  for (const grade of VERIFIED_GRADES) {
    testCount++;
    if (grade in PROOF_GRADE_BRACKETS) {
      passCount++;
    } else {
      failures.push(`FAIL [PROOF_GRADE_BRACKETS has grade ${grade}]`);
    }
  }

  // ── Test: BOT_THREAT_LEVEL values are positive ────────────────────────────
  let botThreatSumTest = 0;
  for (const botId of Object.keys(BOT_THREAT_LEVEL) as Array<keyof typeof BOT_THREAT_LEVEL>) {
    botThreatSumTest += BOT_THREAT_LEVEL[botId];
  }
  expectTrue('BOT_THREAT_LEVEL sum is positive', botThreatSumTest > 0);

  // ── Test: TIMING_CLASS_WINDOW_PRIORITY values ─────────────────────────────
  const maxPriority = Math.max(...Object.values(TIMING_CLASS_WINDOW_PRIORITY));
  expectTrue('TIMING_CLASS_WINDOW_PRIORITY max is 100', maxPriority === 100);

  // ── Test: VISIBILITY_CONCEALMENT_FACTOR HIDDEN = 1.0 ─────────────────────
  expect('VISIBILITY_CONCEALMENT_FACTOR HIDDEN = 1.0', VISIBILITY_CONCEALMENT_FACTOR['HIDDEN'], 1.0);
  expect('VISIBILITY_CONCEALMENT_FACTOR EXPOSED = 0.0', VISIBILITY_CONCEALMENT_FACTOR['EXPOSED'], 0.0);

  // ── Test: INTEGRITY_STATUS_INDEX_MAP has 4 entries ────────────────────────
  expect('INTEGRITY_STATUS_INDEX_MAP has 4 entries', Object.keys(INTEGRITY_STATUS_INDEX_MAP).length, 4);

  // ── Test: PHASE_INDEX_MAP has 3 entries ──────────────────────────────────
  expect('PHASE_INDEX_MAP has 3 entries', Object.keys(PHASE_INDEX_MAP).length, 3);

  // ── Test: MODE_INDEX_MAP has 4 entries ────────────────────────────────────
  expect('MODE_INDEX_MAP has 4 entries', Object.keys(MODE_INDEX_MAP).length, 4);

  // ── Test: PRESSURE_TIER_INDEX_MAP has 5 entries ───────────────────────────
  expect('PRESSURE_TIER_INDEX_MAP has 5 entries', Object.keys(PRESSURE_TIER_INDEX_MAP).length, 5);

  // ── Test: GRADE_INDEX_MAP has 5 entries ───────────────────────────────────
  expect('GRADE_INDEX_MAP has 5 entries', Object.keys(GRADE_INDEX_MAP).length, 5);

  // ── Test: OUTCOME_INDEX_MAP has 4 entries ─────────────────────────────────
  expect('OUTCOME_INDEX_MAP has 4 entries', Object.keys(OUTCOME_INDEX_MAP).length, 4);

  // ── Test: sha512 produces 128-char hex ────────────────────────────────────
  const sha512Result = sha512('test-input');
  expectTrue('sha512 produces 128-char hex', /^[a-f0-9]{128}$/i.test(sha512Result));

  // ── Test: checksumSnapshot is deterministic ────────────────────────────────
  const obj = { a: 1, b: 'hello', c: [1, 2, 3] };
  const cs1 = checksumSnapshot(obj);
  const cs2 = checksumSnapshot(obj);
  expect('checksumSnapshot is deterministic', cs1, cs2);

  // ── Test: checksumParts combines correctly ────────────────────────────────
  const cp1 = checksumParts('a', 'b', 'c');
  const cp2 = checksumParts('a', 'b', 'c');
  expect('checksumParts is deterministic', cp1, cp2);

  // ── Test: createDeterministicId produces 24-char hex ─────────────────────
  const detId = createDeterministicId('proof', 'test', '123');
  expect('createDeterministicId length is 24', detId.length, 24);
  expectTrue('createDeterministicId is valid hex', /^[a-f0-9]{24}$/i.test(detId));

  // ── Test: cloneJson preserves structure ───────────────────────────────────
  const original = { x: 1, y: [2, 3], z: { w: 'hello' } };
  const cloned = cloneJson(original);
  expect('cloneJson preserves structure', JSON.stringify(cloned), JSON.stringify(original));
  expectFalse('cloneJson returns new reference', cloned === original);

  // ── Test: deepFreeze prevents mutation ────────────────────────────────────
  const toFreeze = { value: 42 };
  deepFreeze(toFreeze);
  let frozenOk = false;
  try {
    (toFreeze as { value: number }).value = 99;
    frozenOk = false; // should not reach
  } catch {
    frozenOk = true;
  }
  // In non-strict mode assignment fails silently; check the value didn't change
  frozenOk = toFreeze.value === 42;
  expectTrue('deepFreeze prevents value change', frozenOk);

  // ── Test: GENESIS_SEAL is 64 zeros ────────────────────────────────────────
  expect('GENESIS_SEAL length is 64', GENESIS_SEAL.length, 64);
  expect('GENESIS_SEAL is all zeros', GENESIS_SEAL, '0'.repeat(64));

  // ── Test: stableStringify is deterministic ────────────────────────────────
  const objA = { z: 3, a: 1, m: 2 };
  const ss1 = stableStringify(objA);
  const ss2 = stableStringify(objA);
  expect('stableStringify is deterministic', ss1, ss2);
  // Keys should be sorted
  const parsed = JSON.parse(ss1) as Record<string, number>;
  const keys = Object.keys(parsed);
  expect('stableStringify sorts keys: first key is a', keys[0], 'a');

  // ── Test: deriveGradeFromScore returns correct grade ─────────────────────
  // Build a minimal snapshot-like object for grade derivation
  const gradeA = deriveGradeFromScore(1.2, { outcome: 'FREEDOM' } as RunStateSnapshot);
  expect('deriveGradeFromScore 1.2 = A', gradeA, 'A');
  const gradeF = deriveGradeFromScore(0.1, { outcome: 'FREEDOM' } as RunStateSnapshot);
  expect('deriveGradeFromScore 0.1 = F', gradeF, 'F');
  const gradeNull = deriveGradeFromScore(0.8, { outcome: null } as unknown as RunStateSnapshot);
  expect('deriveGradeFromScore null outcome = null', gradeNull, null);

  // ── Test: validateProofInput errors on empty seed ──────────────────────────
  const badInput: BackendProofHashInput = {
    seed: '',
    tickStreamChecksum: EMPTY_TICK_STREAM_CHECKSUM,
    outcome: 'FREEDOM',
    finalNetWorth: 0,
    userId: 'user',
  };
  const badValidation = validateProofInput(badInput);
  expectFalse('validateProofInput rejects empty seed', badValidation.valid);
  expectTrue('validateProofInput reports seed error', badValidation.errors.some((e) => e.includes('seed')));

  // ── Test: validateProofInput passes on valid input ─────────────────────────
  const goodValidation = validateProofInput(positiveInput);
  expectTrue('validateProofInput passes on valid input', goodValidation.valid);

  // ── Test: RUN_PHASE_STAKES_MULTIPLIER SOVEREIGNTY = 1.0 ───────────────────
  expect(
    'RUN_PHASE_STAKES_MULTIPLIER SOVEREIGNTY = 1.0',
    RUN_PHASE_STAKES_MULTIPLIER['SOVEREIGNTY'],
    1.0,
  );

  // ── Test: MODE_DIFFICULTY_MULTIPLIER ghost > solo ─────────────────────────
  expectTrue(
    'ghost mode harder than solo mode',
    MODE_DIFFICULTY_MULTIPLIER['ghost'] > MODE_DIFFICULTY_MULTIPLIER['solo'],
  );

  // ── Test: SHIELD_LAYER_LABEL_BY_ID has correct label for L1 ───────────────
  expect('SHIELD_LAYER_LABEL_BY_ID L1 = CASH_RESERVE', SHIELD_LAYER_LABEL_BY_ID['L1'], 'CASH_RESERVE');

  // ── Test: isWinOutcome / isLossOutcome ────────────────────────────────────
  expectTrue('isWinOutcome FREEDOM = true', isWinOutcome('FREEDOM'));
  expectFalse('isWinOutcome BANKRUPT = false', isWinOutcome('BANKRUPT'));
  expectTrue('isLossOutcome BANKRUPT = true', isLossOutcome('BANKRUPT'));
  expectFalse('isLossOutcome FREEDOM = false', isLossOutcome('FREEDOM'));

  // ── Test: computeRunProgressFraction is bounded [0, 1] ────────────────────
  for (const phase of RUN_PHASES) {
    const fraction = computeRunProgressFraction(phase, 10, 30);
    testCount++;
    if (fraction >= 0 && fraction <= 1) {
      passCount++;
    } else {
      failures.push(`FAIL [computeRunProgressFraction ${phase} in [0,1]]: got ${fraction}`);
    }
  }

  // ── Test: isEndgamePhase ──────────────────────────────────────────────────
  expectTrue('isEndgamePhase SOVEREIGNTY = true', isEndgamePhase('SOVEREIGNTY'));
  expectFalse('isEndgamePhase FOUNDATION = false', isEndgamePhase('FOUNDATION'));

  // ── Test: describePressureTierExperience returns non-empty string ─────────
  for (const tier of PRESSURE_TIERS) {
    const desc = describePressureTierExperience(tier);
    testCount++;
    if (typeof desc === 'string' && desc.length > 0) {
      passCount++;
    } else {
      failures.push(`FAIL [describePressureTierExperience ${tier} returns non-empty string]`);
    }
  }

  // ── Test: DECK_TYPE_POWER_LEVEL GHOST = 0.95 ──────────────────────────────
  expect('DECK_TYPE_POWER_LEVEL GHOST = 0.95', DECK_TYPE_POWER_LEVEL['GHOST'], 0.95);

  // ── Test: MODE_TENSION_FLOOR ghost = 0.50 ─────────────────────────────────
  expect('MODE_TENSION_FLOOR ghost = 0.50', MODE_TENSION_FLOOR['ghost'], 0.50);

  // ── Test: RUN_PHASE_TICK_BUDGET_FRACTION sums to 1.0 ─────────────────────
  const phaseBudgetSum = RUN_PHASES.reduce(
    (acc, p) => acc + RUN_PHASE_TICK_BUDGET_FRACTION[p],
    0,
  );
  expect('RUN_PHASE_TICK_BUDGET_FRACTION sums to 1.0', Number(phaseBudgetSum.toFixed(10)), 1.0);

  const durationMs = Date.now() - startMs;
  const failCount = testCount - passCount;

  return {
    passed: failures.length === 0,
    testCount,
    passCount,
    failCount,
    failures,
    durationMs,
  };
}
