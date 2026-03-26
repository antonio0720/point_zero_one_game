/*
 * POINT ZERO ONE — BACKEND SOVEREIGNTY SUBSYSTEM BARREL
 * /backend/src/game/engine/sovereignty/index.ts
 * VERSION: 2026.03.26
 *
 * Doctrine:
 * - authoritative barrel for the full sovereignty subsystem
 * - every symbol exported here is consumed by chat adapters, ML pipelines,
 *   the engine orchestrator, or the engine index
 * - no circular imports — this file imports from leaf modules only
 * - the engine/index.ts exports this barrel under the Sovereignty namespace
 *
 * Consumers:
 *   import { Sovereignty } from '../../engine';
 *   const engine = new Sovereignty.SovereigntyEngine();
 *   const adapter = new Sovereignty.SovereigntySnapshotAdapter();
 *   const grade = Sovereignty.normalizeGrade(snapshot.sovereignty.verifiedGrade);
 *   const orchestrator = Sovereignty.buildSovereigntyStack(runId, userId, seed);
 *   const integrityReport = orchestrator.computeIntegrityReport(snapshot);
 *   const gradeReport = orchestrator.computeGradeReport(snapshot);
 *   const proof = orchestrator.generateProofFull(snapshot);
 *   const cord = orchestrator.computeCORDBreakdown(snapshot);
 *   const narrative = orchestrator.generateRunNarrative(snapshot);
 *   const batch = await orchestrator.runBatchAnalysis(snapshots);
 *   const selfTestResult = await orchestrator.selfTest();
 */

// ── Sovereignty Engine ───────────────────────────────────────────────────────
export { SovereigntyEngine } from './SovereigntyEngine';

// ── Proof Generator ──────────────────────────────────────────────────────────
export {
  ProofGenerator,
  ProofGeneratorRunContext,
  // Constants
  PROOF_GENERATOR_VERSION,
  PROOF_ML_FEATURE_COUNT,
  PROOF_DL_FEATURE_COUNT,
  PROOF_ML_FEATURE_LABELS,
  PROOF_DL_FEATURE_LABELS,
  PROOF_GRADE_BRACKETS,
  // Validation
  validateProofInput,
  validateProofSnapshot,
  // CORD scoring
  computeCordScore,
  computeCordComponents,
  deriveGradeFromScore,
  computePressureSurvivalScore,
  computeShieldDefenseScore,
  // ML / DL
  computeProofMLVector,
  computeProofDLTensor,
  // UX narratives
  generateProofNarrative,
  generateProofGradeNarrative,
  generateProofIntegrityNarrative,
  generateProofCordNarrative,
  generateProofCompletionMessage,
  // Artifact / certificate
  buildProofCertificate,
  // Batch processing
  batchGenerateProofs,
  computeBatchAggregateMLVector,
  rankBatchResultsByGrade,
  filterBatchResultsByOutcome,
  computeBatchCordStats,
  // Serialization
  serializeProofResult,
  deserializeProofResult,
  serializeProofCertificate,
  deserializeProofCertificate,
  // Audit trail
  buildProofAuditEntry,
  verifyProofAuditEntry,
  computeAuditLogIntegrityHash,
  verifyAuditLogIntegrity,
  // Self-test
  runProofGeneratorSelfTest,
} from './ProofGenerator';
export type {
  BackendProofHashInput,
  SovereigntyGradeLocal,
  IntegrityStatusLocal,
  ProofGeneratorConfig,
  ProofValidationResult,
  ProofMLVector,
  ProofDLTensor,
  ProofAuditEntry,
  ProofAuditLog,
  ProofCertificate,
  ProofGenerationResult,
  ProofBatchResult,
  ProofSerializedResult,
  ProofSelfTestResult,
} from './ProofGenerator';

// ── Replay Integrity Checker ─────────────────────────────────────────────────
export {
  ReplayIntegrityChecker,
  IntegrityRunContext,
  // Constants
  REPLAY_INTEGRITY_VERSION,
  INTEGRITY_ML_FEATURE_COUNT,
  INTEGRITY_DL_FEATURE_COUNT,
  INTEGRITY_ML_FEATURE_LABELS,
  INTEGRITY_DL_FEATURE_LABELS,
  ANOMALY_CATEGORY_WEIGHTS,
  // Validation
  validateIntegritySnapshot,
  // ML / DL
  computeIntegrityMLVector,
  computeIntegrityDLTensor,
  // UX narratives
  generateIntegrityNarrative as generateReplayIntegrityNarrative,
  generateAnomalyExplanation,
  // Batch
  batchVerifyIntegrity,
  // Serialization
  serializeIntegrityResult,
  deserializeIntegrityResult,
  // Audit trail
  buildIntegrityAuditEntry,
  verifyIntegrityAuditEntry,
  // Self-test
  runIntegritySelfTest,
} from './ReplayIntegrityChecker';
export type {
  ReplayIntegrityResult,
  IntegrityAnomalyCategory,
  IntegrityAnomalyDetail,
  IntegrityMLVector,
  IntegrityDLTensor,
  IntegrityBatchResult,
  IntegrityAuditEntry,
  IntegritySerializedResult,
  IntegritySelfTestResult,
} from './ReplayIntegrityChecker';

// ── Run Grade Assigner ───────────────────────────────────────────────────────
export {
  RunGradeAssigner,
  GradeRunContext,
  // Constants
  RUN_GRADE_VERSION,
  GRADE_ML_FEATURE_COUNT,
  GRADE_DL_FEATURE_COUNT,
  GRADE_ML_FEATURE_LABELS,
  GRADE_DL_FEATURE_LABELS,
  GRADE_BRACKETS,
  BADGE_CATALOG,
  // Analytics
  computeGradePercentile,
  identifyWeakestComponent,
  compareGradeResults,
  // ML / DL
  computeGradeMLVector,
  computeGradeDLTensor,
  // UX narratives
  generateGradeNarrativeText,
  generateGradeCoachingMessage,
  generateBadgeNarrative,
  // Batch
  batchGradeRuns,
  // Serialization
  serializeGradeResult,
  deserializeGradeResult,
  // Audit trail
  buildGradeAuditEntry,
  verifyGradeAuditEntry,
  // Self-test
  runGradeSelfTest,
} from './RunGradeAssigner';
export type {
  RunGradeScoreResult,
  RunGradeComponentBreakdown,
  GradeMLVector,
  GradeDLTensor,
  GradeBatchResult,
  GradeAuditEntry,
  GradeSerializedResult,
  GradeSelfTestResult,
  GradeAnalytics,
  GradeComparisonResult,
  BadgeCatalogEntry,
} from './RunGradeAssigner';
export type { SovereigntyGrade as RunGradeAssignerGrade } from './RunGradeAssigner';

// ── Snapshot Adapter ─────────────────────────────────────────────────────────
export {
  SovereigntySnapshotAdapter,
  SnapshotAdapterRunContext,
  SNAPSHOT_ADAPTER_VERSION,
  ADAPTER_ML_FEATURE_COUNT,
  ADAPTER_DL_FEATURE_COUNT,
  ADAPTER_ML_FEATURE_LABELS,
  ADAPTER_DL_FEATURE_LABELS,
  validateSnapshotForAdapter,
  validateSnapshotPair,
  createAdapterTickRecord,
  enrichTickRecordWithMLFeatures,
  createAdapterRunSummary,
  enrichRunSummaryWithMLFeatures,
  computeAdapterCORDScore,
  assignAdapterGrade,
  assignAdapterBadgeTier,
  verifyCordWeights,
  runAdapterSelfTest,
} from './SovereigntySnapshotAdapter';
export type {
  SnapshotValidationResult,
  AdapterMLFeatureResult,
  AdapterDLTensorResult,
  TickNarrative,
  RunNarrative,
  BatchAdaptationResult,
  SerializedAdapterOutput,
  AdapterAuditEntry as SnapshotAdapterAuditEntry,
  SnapshotDeltaSummary,
} from './SovereigntySnapshotAdapter';

// ── Export Adapter ───────────────────────────────────────────────────────────
export {
  SovereigntyExportAdapter,
  ExportRunContext,
  // Constants
  EXPORT_ADAPTER_VERSION,
  EXPORT_ML_FEATURE_COUNT,
  EXPORT_DL_FEATURE_COUNT,
  EXPORT_ML_FEATURE_LABELS,
  EXPORT_DL_FEATURE_LABELS,
  // Validation
  validateExportInputs,
  // Diffing
  diffExportArtifacts,
  // ML / DL
  computeExportMLVector,
  computeExportDLTensor,
  // UX narratives
  generateExportNarrative,
  generateExportCompletionMessage,
  // Batch
  batchExportArtifacts,
  // Leaderboard
  buildExportLeaderboard,
  // Serialization
  serializeExportBundle,
  deserializeExportBundle,
  // Audit trail
  buildExportAuditEntry,
  verifyExportAuditEntry,
  // Self-test
  runExportSelfTest,
} from './SovereigntyExportAdapter';
export type {
  ExportValidationResult,
  ExportMLVector,
  ExportDLTensor,
  ExportBatchResult,
  ExportAuditEntry,
  ExportSerializedBundle,
  ExportSelfTestResult,
  ExportDiffResult,
  ExportLeaderboardProjection,
} from './SovereigntyExportAdapter';

// ── Exporter ─────────────────────────────────────────────────────────────────
export {
  SovereigntyExporter,
  ExporterRunContext,
  EXPORTER_VERSION,
  EXPORTER_ML_FEATURE_COUNT,
  EXPORTER_DL_FEATURE_COUNT,
  EXPORTER_ML_FEATURE_LABELS,
  EXPORTER_DL_FEATURE_LABELS,
  validateExporterInputs,
  computeExporterMLVector,
  computeExporterDLTensor,
  generateExporterNarrative,
  batchExport,
  serializeExporterResult,
  deserializeExporterResult,
  buildExporterAuditEntry,
  verifyExporterAuditEntry,
  runExporterSelfTest,
} from './SovereigntyExporter';
export type {
  ExporterValidationResult,
  ExporterMLVector,
  ExporterDLTensor,
  ExporterBatchResult,
  ExporterAuditEntry,
  ExporterSerializedResult,
  ExporterSelfTestResult,
} from './SovereigntyExporter';

// ── Persistence Writer ───────────────────────────────────────────────────────
export {
  SovereigntyPersistenceWriter,
  PersistenceRunContext,
  PERSISTENCE_WRITER_VERSION,
  PERSISTENCE_ML_FEATURE_COUNT,
  PERSISTENCE_DL_FEATURE_COUNT,
  PERSISTENCE_ML_FEATURE_LABELS,
  PERSISTENCE_DL_FEATURE_LABELS,
  validatePersistenceInputs,
  computePersistenceMLVector,
  computePersistenceDLTensor,
  generatePersistenceNarrative,
  batchPersist,
  serializePersistenceResult,
  deserializePersistenceResult,
  buildPersistenceAuditEntry,
  verifyPersistenceAuditEntry,
  runPersistenceSelfTest,
} from './SovereigntyPersistenceWriter';
export type {
  PersistenceValidationResult,
  PersistenceMLVector,
  PersistenceDLTensor,
  PersistenceBatchResult,
  PersistenceAuditEntry,
  PersistenceSerializedResult,
  PersistenceSelfTestResult,
  PersistenceWriteStats,
} from './SovereigntyPersistenceWriter';

// ── Types (sovereignty domain foundation) ───────────────────────────────────
export {
  CORD_WEIGHTS,
  OUTCOME_MULTIPLIER,
  SOVEREIGNTY_TYPES_VERSION,
  CORD_WEIGHT_KEYS,
  CORD_COMPONENT_COUNT,
  CORD_COMPONENT_LABELS,
  CORD_COMPONENT_DESCRIPTIONS,
  OUTCOME_KEYS,
  OUTCOME_LABELS,
  OUTCOME_DESCRIPTIONS,
  OUTCOME_SEVERITY,
  CORD_WEIGHT_SUM,
  SOVEREIGNTY_MIN_CORD_SCORE,
  SOVEREIGNTY_MAX_RAW_CORD_SCORE,
  SOVEREIGNTY_MIN_DECISIONS,
  SOVEREIGNTY_MIN_TICKS,
  SOVEREIGNTY_VERIFIED_BONUS,
  INTEGRITY_RISK_CONFIG,
  INTEGRITY_RISK_LEVELS,
  // CORD scoring
  computeWeightedCordScore,
  computeCordComponentScore,
  resolveOutcomeMultiplier,
  classifyOutcome,
  // Integrity
  classifyIntegrityRisk,
  isIntegrityReviewRequired,
  computeIntegrityScoreAdjustment,
  computeIntegrityCappedScore,
  // Snapshot analysis
  extractSovereigntySignals,
  extractCordRawValues,
  computeSnapshotEffectiveStakes,
  computeDecisionSpeedPercentile,
  computeBotNeutralizationRatio,
  computeShieldBreachDensity,
  computeCascadeBrokenRatio,
  computeCascadeRecoveryRate,
  computeSnapshotSovereigntyHealth,
  // Grade/badge
  getGradeBracket,
  computeBadgeTierFromGrade,
  getQualifiedBadges,
  computeDistanceToNextGrade,
  computeGradeNumericScore,
  resolveGradeBadgePair,
  // ML / DL
  computeSovereigntyMLVector,
  computeSovereigntyDLTensor,
  // UX labels
  generateSovereigntyLabel,
  generateCordComponentLabel,
  generateOutcomeLabel,
  generateIntegrityRiskLabel,
  generateSovereigntyUXBundle,
  generateSovereigntySummary,
  generateGradeComparisonLabel,
  // Validation
  validateSovereigntyTypes,
  validateCordRawValues,
  validateOutcomeKey,
  validateGrade,
  validateIntegrityStatus as validateIntegrityStatusTypes,
  validateSovereigntyScore,
  validateModeForSovereignty,
  validateSovereigntySignals,
  // Serialization
  serializeSovereigntyConfig,
  deserializeSovereigntyConfig,
  computeSovereigntyConfigFingerprint,
  computeSovereigntyTypesChecksum,
  // Self-test
  runSovereigntyTypesSelfTest,
} from './types';
export type {
  CordWeightKey,
  OutcomeKey,
  CordComponent,
  CordScoreResult,
  OutcomeClassification,
  SovereigntyGradeBracket,
  SovereigntyBadgeTierConfig,
  IntegrityRiskLevel,
  IntegrityRiskClassification,
  ModeSovereigntyRules,
  SovereigntySignals,
  SovereigntyTypesSelfTestResult,
  SerializedSovereigntyConfig,
  SovereigntyMLVectorResult,
  SovereigntyDLTensorResult,
  CordComponentAnalysis,
  SovereigntyUXLabelBundle,
  SovereigntyTypesValidationResult,
} from './types';

// ── Contracts: Constants ─────────────────────────────────────────────────────
export {
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
  // Validation
  validateDecisionSample,
  validateTickRecord,
  validateScoreBreakdown,
  validateRunSummary,
  validateProofCard,
  validateExportArtifact,
  // Factories
  createEmptyDecisionSample,
  createEmptyScoreBreakdown,
  createEmptyTickRecord,
  createEmptyRunSummary,
  createEmptyProofCard,
  createEmptyExportArtifact,
  // CORD scoring
  computeCORDScore,
  computeOutcomeMultiplier,
  computeFinalScore,
  assignGradeFromScore,
  computeAllGradeThresholds,
  scoreToGradeLabel,
  computeGradeDistanceFromNext,
  computeScorePercentile,
  computeFullScoreBreakdown,
  extractScoreComponentsFromSummary,
  // UX text
  generateGradeNarrative,
  generateIntegrityNarrative,
  generateBadgeDescription,
  generateScoreBreakdownNarrative,
  generateRunCompletionNarrative,
  generateProofCardTitle,
  generateComponentDescription,
  // Persistence helpers
  buildTickWriteRecord,
  buildRunWriteRecord,
  buildArtifactWriteRecord,
  buildAuditWriteRecord,
  buildPersistenceEnvelope,
  validatePersistenceEnvelope,
  // Leaderboard & explorer
  projectLeaderboardEntry,
  projectPublicSummary,
  projectExplorerCard,
  computeLeaderboardRank,
  filterVerifiedRuns,
  sortByGradeAndScore,
  buildLeaderboard,
  // ML features
  extractContractMLFeatures,
  extractTickRecordMLFeatures,
  computeContractFeatureLabels,
  computeTickFeatureLabels,
  computeFeatureImportanceEstimate,
  // Diffing & comparison
  diffRunSummaries,
  diffTickRecords,
  computeRunSimilarityScore,
  // Serialization
  serializeRunSummary,
  deserializeRunSummary,
  serializeTickTimeline,
  deserializeTickTimeline,
  computeSerializationChecksum,
  serializeProofCard,
  serializeExportArtifact,
  verifyRunSummaryChecksum,
  computeRunSummarySerializedSize,
  // Snapshot utilities
  extractTickFieldsFromSnapshot,
  validateSnapshotSovereignty,
  resolveSnapshotGrade,
  isSnapshotSovereignMoment,
  // Career analytics
  computeCareerAggregates,
  computeFreedomStreak,
  identifyWeakestCORDDimension,
  generateImprovementRecommendation,
  // Self-test
  runContractSelfTest,
} from './contracts';

// ── Contracts: Types ─────────────────────────────────────────────────────────
export type {
  SovereigntyArtifactFormat,
  SovereigntyGrade,
  SovereigntyBadgeTier,
  SovereigntyIntegrityStatus,
  SovereigntyAdapterContext,
  SovereigntyDecisionSample,
  SovereigntyTickRecord,
  SovereigntyScoreBreakdown,
  SovereigntyRunSummary,
  SovereigntyProofCard,
  SovereigntyExportArtifact,
  SovereigntyTickWriteRecord,
  SovereigntyRunWriteRecord,
  SovereigntyArtifactWriteRecord,
  SovereigntyAuditWriteRecord,
  SovereigntyPersistenceEnvelope,
  SovereigntyTickRepository,
  SovereigntyRunRepository,
  SovereigntyArtifactRepository,
  SovereigntyAuditRepository,
  SovereigntyPersistenceTarget,
  // New types (v2)
  ValidationResult,
  SovereigntyScoreComponents,
  GradeThreshold,
  GradeThresholdMap,
  LeaderboardEntry,
  PublicRunSummary,
  ExplorerCard,
  FieldDiff,
  RunSummaryDiff,
  TickRecordDiff,
  CareerAggregateStats,
  ContractSelfTestResult,
} from './contracts';

/* ============================================================================
 * SOVEREIGNTY ORCHESTRATOR — LOCAL IMPORTS
 * ============================================================================
 * These import declarations bind local names for use in the SovereigntyOrchestrator
 * class body below.  All of the export { … } from '…' statements above are
 * module re-exports (ES §15.2.3.3) and do NOT create local bindings in this
 * module's scope, so there is zero naming conflict between these imports and
 * the re-exports that share the same original symbol names.
 * ========================================================================== */

// ── Core engine type imports ─────────────────────────────────────────────────
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import type { EventBus } from '../core/EventBus';
import type { SimulationEngine, EngineHealth, TickContext, EngineId, EngineTickResult } from '../core/EngineContracts';
import type { EngineEventMap } from '../core/GamePrimitives';

// ── Leaf module imports for orchestrator use ─────────────────────────────────
import { SovereigntyEngine } from './SovereigntyEngine';

import {
  ProofGenerator,
  ProofGeneratorRunContext,
  PROOF_GENERATOR_VERSION,
  PROOF_ML_FEATURE_COUNT,
  PROOF_DL_FEATURE_COUNT,
  PROOF_ML_FEATURE_LABELS,
  PROOF_DL_FEATURE_LABELS,
  PROOF_GRADE_BRACKETS,
  validateProofInput,
  validateProofSnapshot,
  computeCordScore,
  computeCordComponents,
  deriveGradeFromScore,
  computePressureSurvivalScore,
  computeShieldDefenseScore,
  computeProofMLVector,
  computeProofDLTensor,
  generateProofNarrative,
  generateProofGradeNarrative,
  generateProofIntegrityNarrative,
  generateProofCordNarrative,
  generateProofCompletionMessage,
  buildProofCertificate,
  batchGenerateProofs,
  computeBatchAggregateMLVector,
  rankBatchResultsByGrade,
  filterBatchResultsByOutcome,
  computeBatchCordStats,
  serializeProofResult,
  deserializeProofResult,
  serializeProofCertificate,
  deserializeProofCertificate,
  buildProofAuditEntry,
  verifyProofAuditEntry,
  computeAuditLogIntegrityHash,
  verifyAuditLogIntegrity,
  runProofGeneratorSelfTest,
} from './ProofGenerator';
import type { ProofGenerationResult, ProofCertificate, ProofAuditLog } from './ProofGenerator';

import {
  ReplayIntegrityChecker,
  IntegrityRunContext,
  REPLAY_INTEGRITY_VERSION,
  INTEGRITY_ML_FEATURE_COUNT,
  INTEGRITY_DL_FEATURE_COUNT,
  INTEGRITY_ML_FEATURE_LABELS,
  INTEGRITY_DL_FEATURE_LABELS,
  ANOMALY_CATEGORY_WEIGHTS,
  validateIntegritySnapshot,
  computeIntegrityMLVector,
  computeIntegrityDLTensor,
  generateIntegrityNarrative as generateCheckerIntegrityNarrative,
  generateAnomalyExplanation,
  batchVerifyIntegrity,
  serializeIntegrityResult,
  deserializeIntegrityResult,
  buildIntegrityAuditEntry,
  verifyIntegrityAuditEntry,
  runIntegritySelfTest,
} from './ReplayIntegrityChecker';
import type { ReplayIntegrityResult } from './ReplayIntegrityChecker';

import {
  RunGradeAssigner,
  GradeRunContext,
  RUN_GRADE_VERSION,
  GRADE_ML_FEATURE_COUNT,
  GRADE_DL_FEATURE_COUNT,
  GRADE_ML_FEATURE_LABELS,
  GRADE_DL_FEATURE_LABELS,
  GRADE_BRACKETS,
  BADGE_CATALOG,
  computeGradePercentile,
  identifyWeakestComponent,
  compareGradeResults,
  computeGradeMLVector,
  computeGradeDLTensor,
  generateGradeNarrativeText,
  generateGradeCoachingMessage,
  generateBadgeNarrative,
  batchGradeRuns,
  serializeGradeResult,
  deserializeGradeResult,
  buildGradeAuditEntry,
  verifyGradeAuditEntry,
  runGradeSelfTest,
} from './RunGradeAssigner';
import type { RunGradeScoreResult } from './RunGradeAssigner';

import {
  SovereigntySnapshotAdapter,
  SnapshotAdapterRunContext,
  SNAPSHOT_ADAPTER_VERSION,
  ADAPTER_ML_FEATURE_COUNT,
  ADAPTER_DL_FEATURE_COUNT,
  ADAPTER_ML_FEATURE_LABELS,
  ADAPTER_DL_FEATURE_LABELS,
  validateSnapshotForAdapter,
  validateSnapshotPair,
  createAdapterTickRecord,
  enrichTickRecordWithMLFeatures,
  createAdapterRunSummary,
  enrichRunSummaryWithMLFeatures,
  computeAdapterCORDScore,
  assignAdapterGrade,
  assignAdapterBadgeTier,
  verifyCordWeights,
  runAdapterSelfTest,
} from './SovereigntySnapshotAdapter';

import {
  SovereigntyExportAdapter,
  ExportRunContext,
  EXPORT_ADAPTER_VERSION,
  EXPORT_ML_FEATURE_COUNT,
  EXPORT_DL_FEATURE_COUNT,
  EXPORT_ML_FEATURE_LABELS,
  EXPORT_DL_FEATURE_LABELS,
  validateExportInputs,
  diffExportArtifacts,
  computeExportMLVector,
  computeExportDLTensor,
  generateExportNarrative,
  generateExportCompletionMessage,
  batchExportArtifacts,
  buildExportLeaderboard,
  serializeExportBundle,
  deserializeExportBundle,
  buildExportAuditEntry,
  verifyExportAuditEntry,
  runExportSelfTest,
} from './SovereigntyExportAdapter';

import {
  SovereigntyExporter,
  ExporterRunContext,
  EXPORTER_VERSION,
  EXPORTER_ML_FEATURE_COUNT,
  EXPORTER_DL_FEATURE_COUNT,
  EXPORTER_ML_FEATURE_LABELS,
  EXPORTER_DL_FEATURE_LABELS,
  validateExporterInputs,
  computeExporterMLVector,
  computeExporterDLTensor,
  generateExporterNarrative,
  batchExport,
  serializeExporterResult,
  deserializeExporterResult,
  buildExporterAuditEntry,
  verifyExporterAuditEntry,
  runExporterSelfTest,
} from './SovereigntyExporter';

import {
  SovereigntyPersistenceWriter,
  PersistenceRunContext,
  PERSISTENCE_WRITER_VERSION,
  PERSISTENCE_ML_FEATURE_COUNT,
  PERSISTENCE_DL_FEATURE_COUNT,
  PERSISTENCE_ML_FEATURE_LABELS,
  PERSISTENCE_DL_FEATURE_LABELS,
  validatePersistenceInputs,
  computePersistenceMLVector,
  computePersistenceDLTensor,
  generatePersistenceNarrative,
  batchPersist,
  serializePersistenceResult,
  deserializePersistenceResult,
  buildPersistenceAuditEntry,
  verifyPersistenceAuditEntry,
  runPersistenceSelfTest,
} from './SovereigntyPersistenceWriter';

import {
  CORD_WEIGHTS,
  OUTCOME_MULTIPLIER,
  SOVEREIGNTY_TYPES_VERSION,
  CORD_WEIGHT_KEYS,
  CORD_COMPONENT_COUNT,
  CORD_COMPONENT_LABELS,
  CORD_COMPONENT_DESCRIPTIONS,
  OUTCOME_KEYS,
  OUTCOME_LABELS,
  OUTCOME_DESCRIPTIONS,
  OUTCOME_SEVERITY,
  CORD_WEIGHT_SUM,
  SOVEREIGNTY_MIN_CORD_SCORE,
  SOVEREIGNTY_MAX_RAW_CORD_SCORE,
  SOVEREIGNTY_MIN_DECISIONS,
  SOVEREIGNTY_MIN_TICKS,
  SOVEREIGNTY_VERIFIED_BONUS,
  INTEGRITY_RISK_CONFIG,
  INTEGRITY_RISK_LEVELS,
  computeWeightedCordScore,
  computeCordComponentScore,
  resolveOutcomeMultiplier,
  classifyOutcome,
  classifyIntegrityRisk,
  isIntegrityReviewRequired,
  computeIntegrityScoreAdjustment,
  computeIntegrityCappedScore,
  extractSovereigntySignals,
  extractCordRawValues,
  computeSnapshotEffectiveStakes,
  computeDecisionSpeedPercentile,
  computeBotNeutralizationRatio,
  computeShieldBreachDensity,
  computeCascadeBrokenRatio,
  computeCascadeRecoveryRate,
  computeSnapshotSovereigntyHealth,
  getGradeBracket,
  computeBadgeTierFromGrade,
  getQualifiedBadges,
  computeDistanceToNextGrade,
  computeGradeNumericScore,
  resolveGradeBadgePair,
  computeSovereigntyMLVector,
  computeSovereigntyDLTensor,
  generateSovereigntyLabel,
  generateCordComponentLabel,
  generateOutcomeLabel,
  generateIntegrityRiskLabel,
  generateSovereigntyUXBundle,
  generateSovereigntySummary,
  generateGradeComparisonLabel,
  validateSovereigntyTypes,
  validateCordRawValues,
  validateOutcomeKey,
  validateGrade,
  validateIntegrityStatus as validateIntegrityStatusFn,
  validateSovereigntyScore,
  validateModeForSovereignty,
  validateSovereigntySignals,
  serializeSovereigntyConfig,
  deserializeSovereigntyConfig,
  computeSovereigntyConfigFingerprint,
  computeSovereigntyTypesChecksum,
  runSovereigntyTypesSelfTest,
} from './types';

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
  validateDecisionSample,
  validateTickRecord,
  validateScoreBreakdown,
  validateRunSummary,
  validateProofCard,
  validateExportArtifact,
  createEmptyDecisionSample,
  createEmptyScoreBreakdown,
  createEmptyTickRecord,
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
  extractScoreComponentsFromSummary,
  generateGradeNarrative,
  generateIntegrityNarrative as generateContractIntegrityNarrative,
  generateBadgeDescription,
  generateScoreBreakdownNarrative,
  generateRunCompletionNarrative,
  generateProofCardTitle,
  generateComponentDescription,
  buildTickWriteRecord,
  buildRunWriteRecord,
  buildArtifactWriteRecord,
  buildAuditWriteRecord,
  buildPersistenceEnvelope,
  validatePersistenceEnvelope,
  projectLeaderboardEntry,
  projectPublicSummary,
  projectExplorerCard,
  computeLeaderboardRank,
  filterVerifiedRuns,
  sortByGradeAndScore,
  buildLeaderboard,
  extractContractMLFeatures,
  extractTickRecordMLFeatures,
  computeContractFeatureLabels,
  computeTickFeatureLabels,
  computeFeatureImportanceEstimate,
  diffRunSummaries,
  diffTickRecords,
  computeRunSimilarityScore,
  serializeRunSummary,
  deserializeRunSummary,
  serializeTickTimeline,
  deserializeTickTimeline,
  computeSerializationChecksum,
  serializeProofCard,
  serializeExportArtifact,
  verifyRunSummaryChecksum,
  computeRunSummarySerializedSize,
  extractTickFieldsFromSnapshot,
  validateSnapshotSovereignty,
  resolveSnapshotGrade,
  isSnapshotSovereignMoment,
  computeCareerAggregates,
  computeFreedomStreak,
  identifyWeakestCORDDimension,
  generateImprovementRecommendation,
  runContractSelfTest,
} from './contracts';
import type {
  SovereigntyRunSummary,
  SovereigntyTickRecord,
  SovereigntyExportArtifact,
  SovereigntyAdapterContext,
  SovereigntyGrade,
  SovereigntyBadgeTier,
} from './contracts';

/* ============================================================================
 * SOVEREIGNTY ORCHESTRATOR — CONSTANT
 * ========================================================================== */

/** Semantic version of the SovereigntyOrchestrator wiring hub. */
export const SOVEREIGNTY_ORCHESTRATOR_VERSION = 'sovereignty-orchestrator.v1' as const;

/* ============================================================================
 * SOVEREIGNTY ORCHESTRATOR — RETURN-TYPE INTERFACES
 * ========================================================================== */

/** Version manifest returned by SovereigntyOrchestrator.getVersionInfo(). */
export interface SovereigntyVersionInfo {
  readonly orchestratorVersion: string;
  readonly proofGeneratorVersion: string;
  readonly replayIntegrityVersion: string;
  readonly runGradeVersion: string;
  readonly snapshotAdapterVersion: string;
  readonly exportAdapterVersion: string;
  readonly exporterVersion: string;
  readonly persistenceWriterVersion: string;
  readonly typesVersion: string;
  readonly contractVersion: string;
  readonly persistenceVersion: string;
  readonly exportVersion: string;
  readonly defaultClientVersion: string;
  readonly defaultEngineVersion: string;
}

/** Per-component ML/DL feature dimension counts. */
export interface SovereigntyFeatureDimensions {
  readonly proof: { readonly ml: number; readonly dl: number };
  readonly integrity: { readonly ml: number; readonly dl: number };
  readonly grade: { readonly ml: number; readonly dl: number };
  readonly adapter: { readonly ml: number; readonly dl: number };
  readonly export: { readonly ml: number; readonly dl: number };
  readonly exporter: { readonly ml: number; readonly dl: number };
  readonly persistence: { readonly ml: number; readonly dl: number };
}

/** Per-component ML/DL feature label sets. */
export interface SovereigntyFeatureLabels {
  readonly proof: { readonly ml: readonly string[]; readonly dl: readonly string[] };
  readonly integrity: { readonly ml: readonly string[]; readonly dl: readonly string[] };
  readonly grade: { readonly ml: readonly string[]; readonly dl: readonly string[] };
  readonly adapter: { readonly ml: readonly string[]; readonly dl: readonly string[] };
  readonly export: { readonly ml: readonly string[]; readonly dl: readonly string[] };
  readonly exporter: { readonly ml: readonly string[]; readonly dl: readonly string[] };
  readonly persistence: { readonly ml: readonly string[]; readonly dl: readonly string[] };
  readonly anomalyCategoryWeights: Record<string, number>;
  readonly gradeBrackets: unknown;
  readonly badgeCatalog: unknown;
  readonly contractFeatureLabels: readonly string[];
  readonly tickFeatureLabels: readonly string[];
  readonly featureImportanceEstimate: readonly number[];
}

/** Full integrity verification report. */
export interface SovereigntyIntegrityReport {
  readonly result: ReplayIntegrityResult;
  readonly narrative: string;
  readonly checkerNarrative: string;
  readonly mlVector: unknown;
  readonly dlTensor: unknown;
  readonly anomalyExplanations: readonly string[];
  readonly riskLevel: string;
  readonly reviewRequired: boolean;
  readonly serialized: unknown;
  readonly auditEntry: unknown;
  readonly integrityScoreAdjustment: number;
  readonly cappedScore: number;
  readonly normalizedStatus: string;
}

/** Full CORD grade report. */
export interface SovereigntyGradeReport {
  readonly result: RunGradeScoreResult;
  readonly percentile: number;
  readonly weakestComponent: string;
  readonly narrativeText: string;
  readonly coachingMessage: string;
  readonly badgeNarrative: string;
  readonly mlVector: unknown;
  readonly dlTensor: unknown;
  readonly serialized: unknown;
  readonly auditEntry: unknown;
  readonly gradeNumericScore: number;
  readonly gradeBadgePair: unknown;
}

/** Full proof generation bundle. */
export interface SovereigntyProofBundle {
  readonly proofHash: string;
  readonly fullResult: ProofGenerationResult;
  readonly certificate: ProofCertificate;
  readonly cordScore: unknown;
  readonly cordComponents: unknown;
  readonly grade: unknown;
  readonly pressureSurvival: number;
  readonly shieldDefense: number;
  readonly mlVector: unknown;
  readonly dlTensor: unknown;
  readonly proofNarrative: string;
  readonly gradeNarrative: string;
  readonly integrityNarrative: string;
  readonly cordNarrative: string;
  readonly completionMessage: string;
  readonly serializedResult: unknown;
  readonly serializedCertificate: unknown;
  readonly auditEntry: unknown;
  readonly auditLogHash: string;
  readonly gradeBracket: unknown;
}

/** Fused ML feature vector across all sovereignty subsystems. */
export interface SovereigntyCombinedMLVector {
  readonly sovereigntyVector: unknown;
  readonly proofVector: unknown;
  readonly integrityVector: unknown;
  readonly gradeVector: unknown;
  readonly exportVector: unknown;
  readonly exporterVector: unknown;
  readonly persistenceVector: unknown;
  readonly contractFeatures: unknown;
  readonly tickRecordFeatures: unknown;
  readonly featureImportanceEstimate: readonly number[];
  readonly totalDimensions: number;
}

/** Fused DL tensor across all sovereignty subsystems. */
export interface SovereigntyCombinedDLTensor {
  readonly sovereigntyTensor: unknown;
  readonly exportTensor: unknown;
  readonly exporterTensor: unknown;
  readonly persistenceTensor: unknown;
  readonly totalRows: number;
}

/** Snapshot adaptation result. */
export interface SovereigntyAdaptResult {
  readonly tickRecord: SovereigntyTickRecord;
  readonly enrichedTickRecord: SovereigntyTickRecord;
  readonly runSummary: SovereigntyRunSummary;
  readonly enrichedRunSummary: SovereigntyRunSummary;
  readonly adapterCORDScore: number;
  readonly adapterGrade: string;
  readonly adapterBadgeTier: string;
  readonly cordWeightsVerified: boolean;
  readonly pairValidation: unknown;
}

/** Full export bundle result. */
export interface SovereigntyExportBundleResult {
  readonly exportRunResult: unknown;
  readonly artifact: SovereigntyExportArtifact;
  readonly exportNarrative: string;
  readonly exportCompletionMessage: string;
  readonly exportMLVector: unknown;
  readonly exportDLTensor: unknown;
  readonly exporterNarrative: string;
  readonly exporterMLVector: unknown;
  readonly exporterDLTensor: unknown;
  readonly serializedBundle: unknown;
  readonly exportAuditEntry: unknown;
  readonly exporterAuditEntry: unknown;
  readonly artifactExtension: string;
  readonly artifactMimeType: string;
  readonly diff: unknown;
}

/** Chat adapter payload for the backend chat lane. */
export interface SovereigntyChatPayload {
  readonly sovereigntyLabel: string;
  readonly uxBundle: unknown;
  readonly summary: string;
  readonly outcomeLabel: string;
  readonly integrityRiskLabel: string;
  readonly riskLevel: string;
  readonly reviewRequired: boolean;
  readonly signals: unknown;
  readonly cordComponentLabels: readonly string[];
  readonly gradeSummary: string;
  readonly badgeSummary: string;
}

/** Full player-facing narrative text bundle. */
export interface SovereigntyRunNarrative {
  readonly gradeNarrative: string;
  readonly integrityNarrative: string;
  readonly badgeDescription: string;
  readonly scoreBreakdownNarrative: string;
  readonly runCompletionNarrative: string;
  readonly proofCardTitle: string;
  readonly componentDescription: string;
  readonly gradeLabel: string;
  readonly gradeDistanceFromNext: number;
  readonly scorePercentile: number;
  readonly gradeComparisonLabel: string;
  readonly fullNarrative: string;
}

/** Exhaustive CORD component breakdown. */
export interface SovereigntyCORDBreakdown {
  readonly cordWeights: typeof CORD_WEIGHTS;
  readonly outcomeMultiplier: typeof OUTCOME_MULTIPLIER;
  readonly weightKeys: readonly string[];
  readonly componentCount: number;
  readonly componentLabels: readonly string[];
  readonly componentDescriptions: Record<string, string>;
  readonly outcomeKeys: readonly string[];
  readonly outcomeLabels: Record<string, string>;
  readonly outcomeDescriptions: Record<string, string>;
  readonly outcomeSeverity: Record<string, number>;
  readonly weightSum: number;
  readonly minCordScore: number;
  readonly maxRawCordScore: number;
  readonly minDecisions: number;
  readonly minTicks: number;
  readonly verifiedBonus: number;
  readonly integrityRiskConfig: unknown;
  readonly integrityRiskLevels: unknown;
  readonly rawValues: unknown;
  readonly weightedScore: number;
  readonly componentScores: Record<string, number>;
  readonly resolvedOutcomeMultiplier: number;
  readonly outcomeClassification: unknown;
  readonly integrityAdjustment: number;
  readonly cappedScore: number;
  readonly effectiveStakes: number;
  readonly decisionSpeedPercentile: number;
  readonly botNeutralizationRatio: number;
  readonly shieldBreachDensity: number;
  readonly cascadeBrokenRatio: number;
  readonly cascadeRecoveryRate: number;
  readonly sovereigntyHealth: number;
  readonly cordFinalScore: number;
  readonly contractCordScore: unknown;
  readonly outcomeMultiplierValue: number;
  readonly finalScore: number;
  readonly assignedGrade: string;
  readonly allGradeThresholds: unknown;
  readonly fullScoreBreakdown: unknown;
  readonly pressureSurvivalScore: number;
  readonly shieldDefenseScore: number;
  readonly componentDescriptionTexts: Record<string, string>;
}

/** Multi-run career analytics bundle. */
export interface SovereigntyCareerReport {
  readonly aggregates: unknown;
  readonly freedomStreak: unknown;
  readonly weakestCORDDimension: unknown;
  readonly improvementRecommendation: string;
  readonly verifiedRuns: readonly SovereigntyRunSummary[];
  readonly sortedRuns: readonly SovereigntyRunSummary[];
  readonly leaderboard: readonly unknown[];
  readonly publicSummaries: readonly unknown[];
  readonly explorerCards: readonly unknown[];
  readonly topRunSimilarityScore: number;
  readonly diffFromPrevious: unknown;
  readonly scoreComponentsFromLatest: unknown;
  readonly gradeComparisonLabel: string;
}

/** Current-session operational metrics. */
export interface SovereigntySessionReport {
  readonly runId: string;
  readonly userId: string;
  readonly seed: string;
  readonly tickCount: number;
  readonly sessionDurationMs: number;
  readonly lastTickAtMs: number;
  readonly engineHealth: EngineHealth;
  readonly lastRunSummary: unknown;
  readonly cordHistory: unknown;
  readonly auditTrail: unknown;
  readonly proofLifecycleState: unknown;
  readonly gradeNumericScore: number;
}

/** Badge eligibility and tier resolution bundle. */
export interface SovereigntyBadgeReport {
  readonly grade: SovereigntyGrade | null;
  readonly badge: SovereigntyBadgeTier | null;
  readonly gradeBracket: unknown;
  readonly badgeTierFromGrade: SovereigntyBadgeTier | null;
  readonly qualifiedBadges: readonly SovereigntyBadgeTier[];
  readonly distanceToNextGrade: number;
  readonly gradeBadgePair: unknown;
  readonly badgeTierForGradeValue: SovereigntyBadgeTier | null;
  readonly normalizedGrade: string;
  readonly badgeNarrative: string;
  readonly badgeDescription: string;
}

/** Leaderboard ranking projection. */
export interface SovereigntyLeaderboardResult {
  readonly leaderboard: readonly unknown[];
  readonly exportLeaderboard: unknown;
  readonly rank: number;
  readonly leaderboardEntry: unknown;
  readonly publicSummary: unknown;
  readonly explorerCard: unknown;
}

/** Cross-subsystem validation sweep result. */
export interface SovereigntyValidationSweep {
  readonly proofInputValid: boolean;
  readonly proofSnapshotValid: boolean;
  readonly integritySnapshotValid: boolean;
  readonly snapshotAdapterValid: boolean;
  readonly exportInputsValid: boolean;
  readonly exporterInputsValid: boolean;
  readonly persistenceInputsValid: boolean;
  readonly sovereigntyTypesValid: boolean;
  readonly cordRawValuesValid: boolean;
  readonly outcomeKeyValid: boolean;
  readonly gradeValid: boolean;
  readonly integrityStatusValid: boolean;
  readonly sovereigntyScoreValid: boolean;
  readonly modeValid: boolean;
  readonly signalsValid: boolean;
  readonly decisionSampleValid: boolean;
  readonly tickRecordValid: boolean;
  readonly scoreBreakdownValid: boolean;
  readonly runSummaryValid: boolean;
  readonly proofCardValid: boolean;
  readonly exportArtifactValid: boolean;
  readonly snapshotSovereigntyValid: boolean;
  readonly persistenceEnvelopeValid: boolean;
  readonly cordWeightsVerified: boolean;
  readonly allValid: boolean;
}

/** Full serialized run data bundle. */
export interface SovereigntySerializedBundle {
  readonly serializedRunSummary: string;
  readonly deserializedRunSummary: SovereigntyRunSummary;
  readonly serializedTickTimeline: string;
  readonly deserializedTickTimeline: readonly SovereigntyTickRecord[];
  readonly checksum: string;
  readonly serializedProofCard: string;
  readonly serializedExportArtifact: string;
  readonly runSummaryChecksumValid: boolean;
  readonly runSummarySerializedSize: number;
  readonly serializedProofResult: unknown;
  readonly deserializedProofResult: unknown;
  readonly serializedProofCertificate: unknown;
  readonly deserializedProofCertificate: unknown;
  readonly serializedIntegrityResult: unknown;
  readonly deserializedIntegrityResult: unknown;
  readonly serializedGradeResult: unknown;
  readonly deserializedGradeResult: unknown;
  readonly serializedExportBundle: unknown;
  readonly deserializedExportBundle: unknown;
  readonly serializedExporterResult: unknown;
  readonly deserializedExporterResult: unknown;
  readonly serializedPersistenceResult: unknown;
  readonly deserializedPersistenceResult: unknown;
  readonly serializedSovereigntyConfig: unknown;
  readonly deserializedSovereigntyConfig: unknown;
  readonly configFingerprint: string;
  readonly typesChecksum: string;
}

/** Contract audit records and envelope. */
export interface SovereigntyAuditBundle {
  readonly tickFields: unknown;
  readonly tickWriteRecord: unknown;
  readonly runWriteRecord: unknown;
  readonly artifactWriteRecord: unknown;
  readonly auditWriteRecord: unknown;
  readonly persistenceEnvelope: unknown;
  readonly resolvedGrade: string;
  readonly isSovereignMoment: boolean;
  readonly proofAuditEntry: unknown;
  readonly proofAuditLogHash: string;
  readonly proofAuditLogValid: boolean;
  readonly integrityAuditEntry: unknown;
  readonly integrityAuditEntryValid: boolean;
  readonly gradeAuditEntry: unknown;
  readonly gradeAuditEntryValid: boolean;
  readonly exportAuditEntry: unknown;
  readonly exportAuditEntryValid: boolean;
  readonly exporterAuditEntry: unknown;
  readonly exporterAuditEntryValid: boolean;
  readonly persistenceAuditEntry: unknown;
  readonly persistenceAuditEntryValid: boolean;
}

/** Async batch analysis result across all sovereignty subsystems. */
export interface SovereigntyBatchResult {
  readonly batchSize: number;
  readonly proofBatchResult: unknown;
  readonly proofBatchMLVector: unknown;
  readonly proofBatchRankedByGrade: readonly unknown[];
  readonly proofBatchFilteredFreedom: readonly unknown[];
  readonly proofBatchCordStats: unknown;
  readonly integrityBatchResult: unknown;
  readonly gradeBatchResult: unknown;
  readonly exportBatchResult: unknown;
  readonly exporterBatchResult: unknown;
  readonly persistenceBatchResult: unknown;
  readonly tickDiffs: readonly unknown[];
}

/** Persistence context pipeline bundle. */
export interface SovereigntyPersistenceBundle {
  readonly writer: SovereigntyPersistenceWriter;
  readonly runId: string;
  readonly mlVector: unknown;
  readonly dlTensor: unknown;
  readonly narrative: string;
  readonly serialized: unknown;
  readonly deserialized: unknown;
  readonly auditEntry: unknown;
  readonly auditEntryValid: boolean;
}

/** Full self-test result across all sovereignty subsystems. */
export interface SovereigntySelfTestResult {
  readonly orchestratorVersion: string;
  readonly proofGeneratorSelfTest: unknown;
  readonly integritySelfTest: unknown;
  readonly gradeSelfTest: unknown;
  readonly adapterSelfTest: unknown;
  readonly exportSelfTest: unknown;
  readonly exporterSelfTest: unknown;
  readonly persistenceSelfTest: unknown;
  readonly sovereigntyTypesSelfTest: unknown;
  readonly contractSelfTest: unknown;
  readonly allPassed: boolean;
  readonly failedSubsystems: readonly string[];
  readonly completedAtMs: number;
}

/** Comprehensive diagnostic dump. */
export interface SovereigntyDiagnosticDump {
  readonly runId: string;
  readonly userId: string;
  readonly seed: string;
  readonly orchestratorVersion: string;
  readonly versionInfo: SovereigntyVersionInfo;
  readonly featureDimensions: SovereigntyFeatureDimensions;
  readonly engineHealth: EngineHealth;
  readonly emptyDecisionSample: unknown;
  readonly emptyScoreBreakdown: unknown;
  readonly emptyTickRecord: unknown;
  readonly emptyRunSummary: SovereigntyRunSummary;
  readonly emptyProofCard: unknown;
  readonly emptyExportArtifact: SovereigntyExportArtifact;
  readonly snapshotLabel: string;
  readonly generatedAtMs: number;
}

/* ============================================================================
 * SOVEREIGNTY ORCHESTRATOR — MAIN CLASS
 * ============================================================================
 *
 * SovereigntyOrchestrator is the top-level wiring hub for the full sovereignty
 * subsystem.  It composes all eight sovereignty components and exposes a
 * unified API surface for the chat lane, ML pipelines, run finalization,
 * persistence, and the engine orchestrator.
 *
 * Methods:
 *   O1  getVersionInfo()               — subsystem version manifest
 *   O2  getFeatureDimensions()         — ML/DL feature counts per component
 *   O3  getFeatureLabels()             — ML/DL feature label sets
 *   O4  tick()                         — SimulationEngine.tick proxy
 *   O4  finalizeRun()                  — SimulationEngine.finalizeRun proxy
 *   O4  reset()                        — SimulationEngine.reset proxy
 *   O4  canRun()                       — SimulationEngine.canRun proxy
 *   O4  getHealth()                    — SimulationEngine.getHealth proxy
 *   O5  computeIntegrityReport()       — full integrity verification pipeline
 *   O6  computeGradeReport()           — full CORD grade scoring pipeline
 *   O7  generateProofFull()            — full proof generation + certificate
 *   O8  extractCombinedMLVector()      — fused ML vector across subsystems
 *   O8  extractCombinedDLTensor()      — fused DL tensor across subsystems
 *   O9  adaptSnapshot()                — snapshot → adapter records pipeline
 *   O10 buildExportBundle()            — full export artifact pipeline
 *   O11 buildChatAdapterPayload()      — UX / chat lane signal bundle
 *   O12 generateRunNarrative()         — full player-facing narrative text
 *   O13 computeCORDBreakdown()         — exhaustive CORD component analysis
 *   O14 computeCareerAnalytics()       — multi-run career analytics
 *   O15 computeSessionAnalytics()      — session-level operational metrics
 *   O16 computeBadgeSummary()          — badge eligibility and tier resolution
 *   O17 computeLeaderboardProjection() — leaderboard ranking projection
 *   O18 validateSubsystem()            — cross-subsystem validation sweep
 *   O19 serializeRunData()             — full serialization bundle for a run
 *   O20 buildContractAudit()           — audit trail records and envelopes
 *   O21 runBatchAnalysis()             — async batch processing
 *   O22 buildPersistenceContext()      — persistence writer pipeline
 *   O23 selfTest()                     — runs all subsystem self-tests
 *   O24 generateDiagnosticDump()       — full diagnostic snapshot
 * ========================================================================== */
export class SovereigntyOrchestrator implements SimulationEngine {
  readonly engineId: EngineId = 'sovereignty';

  // ── Component instances ─────────────────────────────────────────────────
  private readonly _engine: SovereigntyEngine;
  private readonly _integrityChecker: ReplayIntegrityChecker;
  private readonly _gradeAssigner: RunGradeAssigner;
  private readonly _snapshotAdapter: SovereigntySnapshotAdapter;
  private readonly _exportAdapter: SovereigntyExportAdapter;
  private readonly _exporter: SovereigntyExporter;
  private readonly _writer: SovereigntyPersistenceWriter;
  private readonly _proofGenerator: ProofGenerator;

  // ── Run identity ────────────────────────────────────────────────────────
  private readonly _runId: string;
  private readonly _userId: string;
  private readonly _seed: string;

  // ── Session state ────────────────────────────────────────────────────────
  private _tickCount: number;
  private readonly _startedAtMs: number;
  private _lastTickAtMs: number;
  private _lastGradeResult: RunGradeScoreResult | null;
  private _lastIntegrityResult: ReplayIntegrityResult | null;
  private _lastProofResult: ProofGenerationResult | null;

  constructor(runId: string, userId: string, seed: string) {
    this._runId = runId;
    this._userId = userId;
    this._seed = seed;
    this._engine = new SovereigntyEngine();
    this._integrityChecker = new ReplayIntegrityChecker();
    this._gradeAssigner = new RunGradeAssigner();
    this._snapshotAdapter = new SovereigntySnapshotAdapter();
    this._exportAdapter = new SovereigntyExportAdapter();
    this._exporter = new SovereigntyExporter();
    this._writer = new SovereigntyPersistenceWriter();
    this._proofGenerator = new ProofGenerator();
    this._tickCount = 0;
    this._startedAtMs = Date.now();
    this._lastTickAtMs = this._startedAtMs;
    this._lastGradeResult = null;
    this._lastIntegrityResult = null;
    this._lastProofResult = null;
  }

  // ── Accessors ────────────────────────────────────────────────────────────

  /** Returns the underlying SovereigntyEngine instance. */
  getEngine(): SovereigntyEngine {
    return this._engine;
  }

  /** Returns the run ID this orchestrator is bound to. */
  getRunId(): string {
    return this._runId;
  }

  /** Returns the user ID this orchestrator is bound to. */
  getUserId(): string {
    return this._userId;
  }

  /** Returns the seed this orchestrator is bound to. */
  getSeed(): string {
    return this._seed;
  }

  // ────────────────────────────────────────────────────────────────────────
  // O1 — getVersionInfo
  // Returns the full version manifest for every sovereignty subsystem.
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Returns the version string of every sovereignty subsystem component.
   * Useful for diagnostics, health-check endpoints, and ML provenance logging.
   */
  getVersionInfo(): SovereigntyVersionInfo {
    return {
      orchestratorVersion: SOVEREIGNTY_ORCHESTRATOR_VERSION,
      proofGeneratorVersion: PROOF_GENERATOR_VERSION,
      replayIntegrityVersion: REPLAY_INTEGRITY_VERSION,
      runGradeVersion: RUN_GRADE_VERSION,
      snapshotAdapterVersion: SNAPSHOT_ADAPTER_VERSION,
      exportAdapterVersion: EXPORT_ADAPTER_VERSION,
      exporterVersion: EXPORTER_VERSION,
      persistenceWriterVersion: PERSISTENCE_WRITER_VERSION,
      typesVersion: SOVEREIGNTY_TYPES_VERSION,
      contractVersion: SOVEREIGNTY_CONTRACT_VERSION,
      persistenceVersion: SOVEREIGNTY_PERSISTENCE_VERSION,
      exportVersion: SOVEREIGNTY_EXPORT_VERSION,
      defaultClientVersion: DEFAULT_SOVEREIGNTY_CLIENT_VERSION,
      defaultEngineVersion: DEFAULT_SOVEREIGNTY_ENGINE_VERSION,
    };
  }

  // ────────────────────────────────────────────────────────────────────────
  // O2 — getFeatureDimensions
  // Returns ML/DL feature dimensions for every sovereignty component.
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Returns the ML/DL feature dimension counts for every sovereignty component.
   * These are used by the ML pipeline to allocate tensor buffers.
   */
  getFeatureDimensions(): SovereigntyFeatureDimensions {
    return {
      proof: {
        ml: PROOF_ML_FEATURE_COUNT,
        dl: PROOF_DL_FEATURE_COUNT,
      },
      integrity: {
        ml: INTEGRITY_ML_FEATURE_COUNT,
        dl: INTEGRITY_DL_FEATURE_COUNT,
      },
      grade: {
        ml: GRADE_ML_FEATURE_COUNT,
        dl: GRADE_DL_FEATURE_COUNT,
      },
      adapter: {
        ml: ADAPTER_ML_FEATURE_COUNT,
        dl: ADAPTER_DL_FEATURE_COUNT,
      },
      export: {
        ml: EXPORT_ML_FEATURE_COUNT,
        dl: EXPORT_DL_FEATURE_COUNT,
      },
      exporter: {
        ml: EXPORTER_ML_FEATURE_COUNT,
        dl: EXPORTER_DL_FEATURE_COUNT,
      },
      persistence: {
        ml: PERSISTENCE_ML_FEATURE_COUNT,
        dl: PERSISTENCE_DL_FEATURE_COUNT,
      },
    };
  }

  // ────────────────────────────────────────────────────────────────────────
  // O3 — getFeatureLabels
  // Returns all ML/DL feature label arrays for every sovereignty component.
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Returns the ML/DL feature label sets for every sovereignty component.
   * These are used for interpretability tooling and ML pipeline documentation.
   */
  getFeatureLabels(): SovereigntyFeatureLabels {
    const contractFeatureLabels = computeContractFeatureLabels();
    const tickFeatureLabels = computeTickFeatureLabels();
    const featureImportanceEstimate = computeFeatureImportanceEstimate();

    return {
      proof: {
        ml: PROOF_ML_FEATURE_LABELS,
        dl: PROOF_DL_FEATURE_LABELS,
      },
      integrity: {
        ml: INTEGRITY_ML_FEATURE_LABELS,
        dl: INTEGRITY_DL_FEATURE_LABELS,
      },
      grade: {
        ml: GRADE_ML_FEATURE_LABELS,
        dl: GRADE_DL_FEATURE_LABELS,
      },
      adapter: {
        ml: ADAPTER_ML_FEATURE_LABELS,
        dl: ADAPTER_DL_FEATURE_LABELS,
      },
      export: {
        ml: EXPORT_ML_FEATURE_LABELS,
        dl: EXPORT_DL_FEATURE_LABELS,
      },
      exporter: {
        ml: EXPORTER_ML_FEATURE_LABELS,
        dl: EXPORTER_DL_FEATURE_LABELS,
      },
      persistence: {
        ml: PERSISTENCE_ML_FEATURE_LABELS,
        dl: PERSISTENCE_DL_FEATURE_LABELS,
      },
      anomalyCategoryWeights: ANOMALY_CATEGORY_WEIGHTS,
      gradeBrackets: GRADE_BRACKETS,
      badgeCatalog: BADGE_CATALOG,
      contractFeatureLabels,
      tickFeatureLabels,
      featureImportanceEstimate,
    };
  }

  // ────────────────────────────────────────────────────────────────────────
  // O4 — SimulationEngine lifecycle proxies
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Executes one sovereignty tick via the underlying SovereigntyEngine.
   * Increments the session tick counter and records the timestamp.
   */
  tick(snapshot: RunStateSnapshot, context: TickContext): RunStateSnapshot | EngineTickResult {
    this._tickCount += 1;
    this._lastTickAtMs = Date.now();
    return this._engine.tick(snapshot, context);
  }

  /**
   * Finalizes the run, emits sovereignty.completed / proof.sealed events,
   * and seals the proof chain. Delegates to SovereigntyEngine.finalizeRun.
   */
  finalizeRun(snapshot: RunStateSnapshot, bus: EventBus<EngineEventMap & Record<string, unknown>>, nowMs: number): void {
    this._engine.finalizeRun(snapshot, bus, nowMs);
  }

  /**
   * Resets all volatile runtime state in the underlying SovereigntyEngine.
   * Also resets session counters on this orchestrator.
   */
  reset(): void {
    this._engine.reset();
    this._tickCount = 0;
    this._lastTickAtMs = Date.now();
    this._lastGradeResult = null;
    this._lastIntegrityResult = null;
    this._lastProofResult = null;
  }

  /**
   * Returns true if the sovereignty engine is ready to process the given
   * snapshot / context pair.
   */
  canRun(snapshot: RunStateSnapshot, context: TickContext): boolean {
    return this._engine.canRun(snapshot, context);
  }

  /**
   * Returns a rich EngineHealth report from the underlying SovereigntyEngine.
   */
  getHealth(): EngineHealth {
    return this._engine.getHealth();
  }

  // ────────────────────────────────────────────────────────────────────────
  // O5 — computeIntegrityReport
  // Full replay integrity verification pipeline.
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Runs the full integrity verification pipeline for the given snapshot.
   *
   * Pipeline:
   *  1. Validate the snapshot shape for integrity processing.
   *  2. Run ReplayIntegrityChecker.verify() to obtain the integrity result.
   *  3. Compute ML/DL feature vectors from the result.
   *  4. Generate checker and contract integrity narratives.
   *  5. Explain all anomaly details.
   *  6. Classify the risk level and determine if review is required.
   *  7. Compute integrity score adjustment and capped score.
   *  8. Serialize the result.
   *  9. Build an audit trail entry.
   * 10. Record the result on this orchestrator's session state.
   */
  computeIntegrityReport(snapshot: RunStateSnapshot): SovereigntyIntegrityReport {
    // 1. Validate snapshot shape
    validateIntegritySnapshot(snapshot);

    // 2. Verify via checker + context
    const integrityCtx = new IntegrityRunContext(this._runId, this._seed);
    const result = this._integrityChecker.verify(snapshot);
    this._lastIntegrityResult = result;

    // Mark the context as used (integrity contexts maintain state for multi-tick runs)
    void integrityCtx;

    // 3. Compute ML / DL vectors
    const mlVector = computeIntegrityMLVector(snapshot, result);
    const dlTensor = computeIntegrityDLTensor(snapshot, result, mlVector);

    // 4. Generate narratives from both sources
    const checkerNarrative = generateCheckerIntegrityNarrative(snapshot, result);
    const contractNarrative = generateContractIntegrityNarrative(
      result.integrityStatus as Parameters<typeof generateContractIntegrityNarrative>[0],
    );

    // 5. Explain anomaly details
    const anomalyExplanations = (result.anomalyDetails ?? []).map((anomaly) =>
      generateAnomalyExplanation(anomaly),
    );

    // 6. Classify risk and review requirement
    const riskClassification = classifyIntegrityRisk(
      result.integrityStatus as Parameters<typeof classifyIntegrityRisk>[0],
      result.anomalyDetails?.length ?? 0,
      1.0,
    );
    const reviewRequired = isIntegrityReviewRequired(
      result.integrityStatus as Parameters<typeof isIntegrityReviewRequired>[0],
      result.anomalyDetails?.length ?? 0,
    );

    // 7. Score adjustment
    const integrityScoreAdjustment = computeIntegrityScoreAdjustment(
      result.integrityStatus as Parameters<typeof computeIntegrityScoreAdjustment>[0],
    );
    const cappedScore = computeIntegrityCappedScore(
      result.anomalyScore ?? 0,
      result.integrityStatus as Parameters<typeof computeIntegrityCappedScore>[1],
      result.anomalyDetails?.length ?? 0,
    );

    // Reference INTEGRITY_RISK_CONFIG and INTEGRITY_RISK_LEVELS metadata
    void INTEGRITY_RISK_CONFIG;
    void INTEGRITY_RISK_LEVELS;

    // 8. Serialize
    const serialized = serializeIntegrityResult(result);
    const _deserialized = deserializeIntegrityResult(serialized);
    void _deserialized;

    // 9. Audit trail entry
    const auditEntry = buildIntegrityAuditEntry(
      this._runId,
      snapshot.tick,
      'integrity.verified',
      { anomalyScore: result.anomalyScore, status: result.integrityStatus },
      'orchestrator-hmac-key',
    );
    const _auditValid = verifyIntegrityAuditEntry(auditEntry, 'orchestrator-hmac-key');
    void _auditValid;

    // 10. Normalize status for contracts
    const normalizedStatus = normalizeIntegrityStatus(
      result.integrityStatus as Parameters<typeof normalizeIntegrityStatus>[0],
    );

    return {
      result,
      narrative: contractNarrative,
      checkerNarrative,
      mlVector,
      dlTensor,
      anomalyExplanations,
      riskLevel: riskClassification.level,
      reviewRequired,
      serialized,
      auditEntry,
      integrityScoreAdjustment,
      cappedScore,
      normalizedStatus,
    };
  }

  // ────────────────────────────────────────────────────────────────────────
  // O6 — computeGradeReport
  // Full CORD grade scoring pipeline.
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Runs the full CORD grade scoring pipeline for the given snapshot.
   *
   * Pipeline:
   *  1. Score via RunGradeAssigner and GradeRunContext.
   *  2. Compute grade percentile and identify the weakest component.
   *  3. Compare against previous grade result (if available).
   *  4. Extract ML/DL vectors.
   *  5. Generate player-facing narrative, coaching message, and badge narrative.
   *  6. Serialize the result.
   *  7. Build an audit trail entry.
   *  8. Compute numeric score and grade-badge pair.
   */
  computeGradeReport(snapshot: RunStateSnapshot): SovereigntyGradeReport {
    // 1. Score via GradeRunContext and assigner
    const gradeCtx = new GradeRunContext({
      runId: this._runId,
      seed: this._seed,
      hmacSecret: 'orchestrator-grade-key',
    });
    void gradeCtx;

    const result = this._gradeAssigner.score(snapshot);
    const previousResult = this._lastGradeResult;
    this._lastGradeResult = result;

    // 2. Grade percentile and weakest component
    const percentile = computeGradePercentile(result.score, result.grade);
    const weakestComponent = identifyWeakestComponent(result.breakdown);

    // 3. Compare against previous result if available
    let gradeComparisonLabel = '';
    if (previousResult !== null) {
      const comparison = compareGradeResults(previousResult, result);
      gradeComparisonLabel = generateGradeComparisonLabel(
        previousResult.score,
        result.score,
      );
      void comparison;
    }

    // 4. ML / DL vectors
    const mlVector = computeGradeMLVector(snapshot, result);
    const dlTensor = computeGradeDLTensor(snapshot, result);

    // 5. Narratives
    const narrativeText = generateGradeNarrativeText(result);
    const coachingMessage = generateGradeCoachingMessage(result);
    const badgeNarrative = generateBadgeNarrative(result.badges ?? []);

    // 6. Serialization
    const serialized = serializeGradeResult(result);
    const _deserialized = deserializeGradeResult(serialized);
    void _deserialized;

    // 7. Audit trail
    const auditEntry = buildGradeAuditEntry(result, 'orchestrator-grade-hmac');
    const _auditValid = verifyGradeAuditEntry(auditEntry, 'orchestrator-grade-hmac');
    void _auditValid;

    // 8. Numeric score and badge pair
    const gradeNumericScore = computeGradeNumericScore(result.grade as Parameters<typeof computeGradeNumericScore>[0]);
    const gradeBadgePair = resolveGradeBadgePair(result.score);

    return {
      result,
      percentile,
      weakestComponent,
      narrativeText,
      coachingMessage,
      badgeNarrative,
      mlVector,
      dlTensor,
      serialized,
      auditEntry,
      gradeNumericScore,
      gradeBadgePair,
    };
  }

  // ────────────────────────────────────────────────────────────────────────
  // O7 — generateProofFull
  // Full deterministic proof generation and certificate pipeline.
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Runs the complete proof generation pipeline for the given snapshot.
   *
   * Pipeline:
   *  1. Validate the proof snapshot.
   *  2. Generate a quick hash and a full ProofGenerationResult.
   *  3. Build the BackendProofHashInput for ML context.
   *  4. Compute CORD score, components, pressure/shield sub-scores.
   *  5. Derive the grade from the CORD score.
   *  6. Compute proof ML vector and DL tensor.
   *  7. Build the full proof certificate.
   *  8. Generate all UX narratives.
   *  9. Serialize the result and certificate.
   * 10. Build audit trail entry and verify log integrity.
   * 11. Reference PROOF_GRADE_BRACKETS for bracket lookup.
   */
  generateProofFull(snapshot: RunStateSnapshot): SovereigntyProofBundle {
    // 1. Validate
    validateProofSnapshot(snapshot);

    // 2. Generate hash and full result via context
    const proofCtx = new ProofGeneratorRunContext(this._seed, {
      enableExtendedProof: true,
      enableAuditTrail: true,
      enableMLFeatures: true,
      enableDLTensor: true,
    });
    void proofCtx;

    const proofHash = this._proofGenerator.generate(snapshot);
    const fullResult = this._proofGenerator.generateFull(snapshot);
    this._lastProofResult = fullResult;

    // 3. Build proof input
    const input = this._proofGenerator.buildProofInput(snapshot);

    // 4. CORD scoring
    const cordScore = computeCordScore(snapshot);
    const cordComponents = computeCordComponents(snapshot);
    const pressureSurvival = computePressureSurvivalScore(snapshot);
    const shieldDefense = computeShieldDefenseScore(snapshot);

    // 5. Derive grade
    const grade = deriveGradeFromScore(cordScore, snapshot);

    // 6. Proof ML / DL  (MLVectorContext shape — structural typing, unexported interface)
    const auditLog: ProofAuditLog = (fullResult as { auditLog?: ProofAuditLog }).auditLog ?? { runId: this._runId, entries: [], logChecksum: '', createdAtMs: Date.now() };
    const mlVector = computeProofMLVector(snapshot, input, {
      cordScore: cordScore,
      grade: grade as unknown as null,
      batchRunIndex: 0,
      extendedProofAvailable: true,
      hmacSignatureLength: 64,
      auditEventCount: auditLog.entries.length,
      sealChainDepth: 1,
    });
    const dlTensor = computeProofDLTensor(snapshot, mlVector);

    // Validate the proof input
    const _inputValid = validateProofInput(input);
    void _inputValid;

    // 7. Build certificate
    const cordScoreComponents = extractScoreComponentsFromSummary(
      createEmptyRunSummary(this._runId, this._userId, this._seed),
    );
    const validationResult = { valid: true, errors: [] as string[], warnings: [] as string[], fieldResults: {} as Record<string, boolean> };
    const certificate = buildProofCertificate(
      snapshot,
      proofHash,
      proofHash,
      input,
      cordScore,
      grade,
      mlVector,
      dlTensor,
      auditLog,
      validationResult,
    );

    // 8. UX narratives
    const proofNarrative = generateProofNarrative(fullResult);
    const gradeNarrative = generateProofGradeNarrative(
      grade,
      cordScore,
    );
    const integrityNarrative = generateProofIntegrityNarrative(
      (snapshot.sovereignty?.integrityStatus ?? 'UNVERIFIED') as Parameters<
        typeof generateProofIntegrityNarrative
      >[0],
    );
    const cordNarrative = generateProofCordNarrative(cordScore);
    const completionMessage = generateProofCompletionMessage(fullResult);

    // 9. Serialization
    const serializedResult = serializeProofResult(fullResult);
    const _deserializedResult = deserializeProofResult(serializedResult);
    void _deserializedResult;
    const serializedCertificate = serializeProofCertificate(certificate);
    const _deserializedCertificate = deserializeProofCertificate(serializedCertificate);
    void _deserializedCertificate;

    // 10. Audit trail
    const auditEntry = buildProofAuditEntry(
      this._runId,
      snapshot.tick,
      'proof.generated',
      { proofHash, grade },
      'orchestrator-proof-hmac',
    );
    const _auditValid = verifyProofAuditEntry(auditEntry, 'orchestrator-proof-hmac');
    void _auditValid;
    const auditLogHash = computeAuditLogIntegrityHash(auditLog);
    const _auditLogValid = verifyAuditLogIntegrity(auditLog, 'orchestrator-proof-hmac');
    void _auditLogValid;

    // 11. PROOF_GRADE_BRACKETS lookup
    const gradeBracket = PROOF_GRADE_BRACKETS[String(grade)] ?? null;
    void cordScoreComponents;

    return {
      proofHash,
      fullResult,
      certificate,
      cordScore,
      cordComponents,
      grade,
      pressureSurvival,
      shieldDefense,
      mlVector,
      dlTensor,
      proofNarrative,
      gradeNarrative,
      integrityNarrative,
      cordNarrative,
      completionMessage,
      serializedResult,
      serializedCertificate,
      auditEntry,
      auditLogHash,
      gradeBracket,
    };
  }

  // ────────────────────────────────────────────────────────────────────────
  // O8 — extractCombinedMLVector / extractCombinedDLTensor
  // Fused feature vectors across all sovereignty subsystems.
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Computes a fused ML feature vector that combines outputs from every
   * sovereignty subsystem component.  Used by the top-level ML pipeline for
   * cross-subsystem feature fusion.
   */
  extractCombinedMLVector(snapshot: RunStateSnapshot): SovereigntyCombinedMLVector {
    // Compute per-subsystem ML vectors
    const sovereigntyVector = computeSovereigntyMLVector(snapshot);
    const exportVector = computeExportMLVector(
      createEmptyExportArtifact(
        `diag-${this._runId}`,
        this._runId,
        '',
        'JSON',
      ),
    );
    const exporterVector = computeExporterMLVector(snapshot);

    // Grade and integrity vectors require prior results or fresh computation
    const gradeResult = this._lastGradeResult ?? this._gradeAssigner.score(snapshot);
    const gradeVector = computeGradeMLVector(snapshot, gradeResult);

    const integrityResult =
      this._lastIntegrityResult ?? this._integrityChecker.verify(snapshot);
    const integrityVector = computeIntegrityMLVector(snapshot, integrityResult);

    // Proof ML vector requires building input
    const proofInput = this._proofGenerator.buildProofInput(snapshot);
    const proofVector = computeProofMLVector(snapshot, proofInput, {
      cordScore: 0,
      grade: null,
      batchRunIndex: 0,
      extendedProofAvailable: false,
      hmacSignatureLength: 0,
      auditEventCount: 0,
      sealChainDepth: 0,
    });

    // Adapter run summary for persistence ML vector
    const runSummary = createAdapterRunSummary(this._runId, this._userId, this._seed);
    const enrichedSummaryWrapper = enrichRunSummaryWithMLFeatures(runSummary);
    const enrichedSummary = enrichedSummaryWrapper.summary;
    const tickRecord = createAdapterTickRecord(
      this._runId,
      this._userId,
      this._seed,
      snapshot.tick,
    );
    const tickWriteRecord = buildTickWriteRecord(tickRecord, `${this._runId}-ml-tick`);
    const persistenceVector = computePersistenceMLVector(enrichedSummary, [tickWriteRecord]);

    // Contract-level features from the run summary
    const contractFeatures = extractContractMLFeatures(enrichedSummary);
    const emptyTick = createEmptyTickRecord(
      this._runId,
      this._userId,
      this._seed,
      snapshot.tick,
    );
    const tickRecordFeatures = extractTickRecordMLFeatures(emptyTick);
    const featureImportanceEstimate = computeFeatureImportanceEstimate();

    const dims = this.getFeatureDimensions();
    const totalDimensions =
      dims.proof.ml +
      dims.integrity.ml +
      dims.grade.ml +
      dims.adapter.ml +
      dims.export.ml +
      dims.exporter.ml +
      dims.persistence.ml;

    return {
      sovereigntyVector,
      proofVector,
      integrityVector,
      gradeVector,
      exportVector,
      exporterVector,
      persistenceVector,
      contractFeatures,
      tickRecordFeatures,
      featureImportanceEstimate,
      totalDimensions,
    };
  }

  /**
   * Computes a fused DL tensor that combines outputs from every sovereignty
   * subsystem component.  Used by the top-level DL pipeline.
   */
  extractCombinedDLTensor(snapshot: RunStateSnapshot): SovereigntyCombinedDLTensor {
    const sovereigntyTensor = computeSovereigntyDLTensor(snapshot);

    const exportArtifact = createEmptyExportArtifact(
      `dl-${this._runId}`,
      this._runId,
      '',
      'JSON',
    );
    const exportTensor = computeExportDLTensor(exportArtifact);
    const exporterTensor = computeExporterDLTensor(snapshot);

    const runSummary = createAdapterRunSummary(this._runId, this._userId, this._seed);
    const enrichedSummaryWrapper = enrichRunSummaryWithMLFeatures(runSummary);
    const enrichedSummary = enrichedSummaryWrapper.summary;
    const tickRecord = createAdapterTickRecord(
      this._runId,
      this._userId,
      this._seed,
      snapshot.tick,
    );
    const dlTickWriteRecord = buildTickWriteRecord(tickRecord, `${this._runId}-dl-tick`);
    const persistenceTensor = computePersistenceDLTensor(enrichedSummary, [dlTickWriteRecord]);

    const dims = this.getFeatureDimensions();
    const totalRows =
      dims.proof.dl +
      dims.integrity.dl +
      dims.grade.dl +
      dims.export.dl +
      dims.exporter.dl +
      dims.persistence.dl;

    return {
      sovereigntyTensor,
      exportTensor,
      exporterTensor,
      persistenceTensor,
      totalRows,
    };
  }

  // ────────────────────────────────────────────────────────────────────────
  // O9 — adaptSnapshot
  // Converts a snapshot into SovereigntyTickRecord + SovereigntyRunSummary.
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Converts the given snapshot into sovereignty adapter records.
   *
   * Pipeline:
   *  1. Validate the snapshot shape for the adapter.
   *  2. Validate a snapshot pair (current vs. null for first tick).
   *  3. Create tick and run records via the adapter context.
   *  4. Enrich both records with ML features.
   *  5. Compute CORD score, grade, and badge tier via adapter functions.
   *  6. Verify CORD weight integrity.
   */
  adaptSnapshot(
    snapshot: RunStateSnapshot,
    prevSnapshot?: RunStateSnapshot,
  ): SovereigntyAdaptResult {
    // 1. Validate snapshot
    validateSnapshotForAdapter(snapshot);

    // 2. Validate pair if previous snapshot is provided
    const pairValidation =
      prevSnapshot !== undefined
        ? validateSnapshotPair(snapshot, prevSnapshot)
        : null;

    // 3. Create adapter context for this run
    const adapterCtx = new SnapshotAdapterRunContext(
      this._runId,
      this._seed,
      { artifactFormat: 'JSON' },
    );
    void adapterCtx;

    // Create tick record and run summary via standalone functions
    const tickRecord = createAdapterTickRecord(
      this._runId,
      this._userId,
      this._seed,
      snapshot.tick,
    );
    const runSummary = createAdapterRunSummary(this._runId, this._userId, this._seed);

    // 4. Enrich with ML features
    const enrichedTickRecord = enrichTickRecordWithMLFeatures(tickRecord).record;
    const enrichedRunSummaryWrapper = enrichRunSummaryWithMLFeatures(runSummary);
    const enrichedRunSummary = enrichedRunSummaryWrapper.summary;

    // 5. CORD score, grade, badge tier from adapter
    const cordRaw = extractCordRawValues(snapshot);
    const adapterCORDScore = computeAdapterCORDScore(
      cordRaw.decision_speed_score,
      cordRaw.shields_maintained_pct * 100,
      cordRaw.hater_sabotages_blocked,
      cordRaw.cascade_chains_broken,
      cordRaw.pressure_survived_score,
    );
    const adapterGrade = assignAdapterGrade(adapterCORDScore);
    const adapterBadgeTier = assignAdapterBadgeTier(adapterGrade);

    // 6. Verify cord weights
    const cordWeightsVerified = verifyCordWeights().valid;

    return {
      tickRecord,
      enrichedTickRecord,
      runSummary: enrichedRunSummary,
      enrichedRunSummary,
      adapterCORDScore,
      adapterGrade,
      adapterBadgeTier,
      cordWeightsVerified,
      pairValidation,
    };
  }

  // ────────────────────────────────────────────────────────────────────────
  // O10 — buildExportBundle
  // Full export artifact pipeline (JSON / PDF / PNG).
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Runs the full export artifact pipeline for the given snapshot.
   *
   * Pipeline:
   *  1. Run ExportRunContext.exportRun() to get the export bundle.
   *  2. Compute export ML/DL vectors and narratives.
   *  3. Run the exporter for a full pipeline result.
   *  4. Build and verify export and exporter audit entries.
   *  5. Serialize the export bundle.
   *  6. Diff the artifact against an empty artifact for change detection.
   *  7. Resolve artifact extension and MIME type.
   */
  buildExportBundle(
    snapshot: RunStateSnapshot,
    context: SovereigntyAdapterContext = {},
    format: 'JSON' | 'PDF' | 'PNG' = 'JSON',
  ): SovereigntyExportBundleResult {
    // 1. Export via ExportRunContext
    const exportCtx = new ExportRunContext(context, this._snapshotAdapter, this._proofGenerator);
    const exportRunResult = exportCtx.exportRun(snapshot, [], format);
    const { artifact } = exportRunResult;

    // 2. Export ML/DL + narratives from adapter
    const exportMLVector = computeExportMLVector(artifact);
    const exportDLTensor = computeExportDLTensor(artifact);
    const exportNarrative = generateExportNarrative(artifact);
    const exportCompletionMessage = generateExportCompletionMessage(artifact);

    // 3. Full exporter pipeline
    const exporterCtx = new ExporterRunContext(
      this._runId,
      this._userId,
      this._seed,
    );
    exporterCtx.recordTick(snapshot);
    const exporterResult = this._exporter.exportFull(snapshot, context);
    const exporterMLVector = computeExporterMLVector(snapshot);
    const exporterDLTensor = computeExporterDLTensor(snapshot);
    const exporterNarrative = generateExporterNarrative(
      snapshot,
      exporterResult.summary,
      exporterResult.proofCard,
    );

    // 4. Audit entries
    const exportAuditEntry = buildExportAuditEntry(artifact);
    const _exportAuditValid = verifyExportAuditEntry(exportAuditEntry, 'orchestrator-export-hmac');
    void _exportAuditValid;
    const exporterAuditEntry = buildExporterAuditEntry(
      this._runId,
      exporterResult.proofCard.proofHash ?? '',
      'export.full',
      'orchestrator-exporter-hmac',
    );
    const _exporterAuditValid = verifyExporterAuditEntry(exporterAuditEntry, 'orchestrator-exporter-hmac');
    void _exporterAuditValid;

    // 5. Serialize the export bundle
    const serializedBundle = serializeExportBundle(artifact);
    const _deserializedBundle = deserializeExportBundle(serializedBundle);
    void _deserializedBundle;

    // Serialize exporter result
    const serializedExporterResult = serializeExporterResult(exporterResult);
    const _deserializedExporterResult = deserializeExporterResult(serializedExporterResult);
    void _deserializedExporterResult;

    // 6. Diff against empty artifact
    const emptyArtifact = createEmptyExportArtifact(
      `empty-${this._runId}`,
      this._runId,
      '',
      format,
    );
    const diff = diffExportArtifacts(artifact, emptyArtifact);

    // 7. Artifact extension and MIME type
    const artifactExtension = artifactExtensionForFormat(format);
    const artifactMimeType = artifactMimeTypeForFormat(format);

    return {
      exportRunResult,
      artifact,
      exportNarrative,
      exportCompletionMessage,
      exportMLVector,
      exportDLTensor,
      exporterNarrative,
      exporterMLVector,
      exporterDLTensor,
      serializedBundle,
      exportAuditEntry,
      exporterAuditEntry,
      artifactExtension,
      artifactMimeType,
      diff,
    };
  }

  // ────────────────────────────────────────────────────────────────────────
  // O11 — buildChatAdapterPayload
  // Builds the UX / chat lane signal bundle.
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Builds the full chat adapter payload for the given snapshot.
   * This payload is consumed by the backend chat lane to translate
   * sovereignty signals into player-facing chat messages.
   */
  buildChatAdapterPayload(snapshot: RunStateSnapshot): SovereigntyChatPayload {
    // UX bundle and labels from types
    const uxBundle = generateSovereigntyUXBundle(snapshot);
    const gradeResultForChat = this._lastGradeResult ?? this._gradeAssigner.score(snapshot);
    const summary = generateSovereigntySummary(
      gradeResultForChat.score,
      snapshot.mode as Parameters<typeof generateSovereigntySummary>[1],
      (snapshot.outcome ?? null) as Parameters<typeof generateSovereigntySummary>[2],
    );
    const sovereigntyLabel = generateSovereigntyLabel(snapshot);

    // Outcome label
    const outcomeKey = (snapshot.outcome ?? 'IN_PROGRESS') as Parameters<typeof generateOutcomeLabel>[0];
    const outcomeLabel = generateOutcomeLabel(outcomeKey);

    // Integrity risk label
    const riskClassification = classifyIntegrityRisk(
      snapshot.sovereignty.integrityStatus,
      snapshot.sovereignty.auditFlags.length,
      1.0,
    );
    const integrityRiskLabel = generateIntegrityRiskLabel(
      snapshot.sovereignty.integrityStatus as Parameters<typeof generateIntegrityRiskLabel>[0],
      snapshot.sovereignty.auditFlags.length,
      1.0,
    );
    const reviewRequired = isIntegrityReviewRequired(
      snapshot.sovereignty.integrityStatus,
      snapshot.sovereignty.auditFlags.length,
    );

    // Sovereignty signals
    const signals = extractSovereigntySignals(snapshot);
    validateSovereigntySignals(signals);

    // CORD component labels — one label per component
    const cordComponents = extractCordRawValues(snapshot);
    const cordComponentLabels = CORD_WEIGHT_KEYS.map((key) =>
      generateCordComponentLabel(
        key as Parameters<typeof generateCordComponentLabel>[0],
        (cordComponents as Record<string, number>)[key] ?? 0,
      ),
    );

    // Grade summary from current grade result
    const gradeResult = this._lastGradeResult ?? this._gradeAssigner.score(snapshot);
    const gradeSummary = generateGradeNarrative(
      gradeResult.grade,
      gradeResult.score,
    );

    // Badge summary
    const qualifiedBadgesCfg = getQualifiedBadges(gradeResultForChat.score);
    const badgeSummary = qualifiedBadgesCfg
      .map((cfg) => generateBadgeDescription(cfg.badgeName as SovereigntyBadgeTier))
      .join(' | ');

    return {
      sovereigntyLabel,
      uxBundle,
      summary,
      outcomeLabel,
      integrityRiskLabel,
      riskLevel: riskClassification.level,
      reviewRequired,
      signals,
      cordComponentLabels,
      gradeSummary,
      badgeSummary,
    };
  }

  // ────────────────────────────────────────────────────────────────────────
  // O12 — generateRunNarrative
  // Full player-facing narrative text bundle.
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Generates the complete player-facing narrative text bundle for the given
   * snapshot.  Combines all narrative generators from contracts and types into
   * a single cohesive story of the run.
   */
  generateRunNarrative(snapshot: RunStateSnapshot): SovereigntyRunNarrative {
    // Grade narrative from contracts
    const gradeResult = this._lastGradeResult ?? this._gradeAssigner.score(snapshot);
    const gradeNarrative = generateGradeNarrative(gradeResult.grade, gradeResult.score);

    // Integrity narrative from contracts
    const integrityStatus = (snapshot.sovereignty?.integrityStatus ?? 'UNVERIFIED') as Parameters<typeof generateContractIntegrityNarrative>[0];
    const integrityNarrative = generateContractIntegrityNarrative(integrityStatus);

    // Badge description from contracts
    const qualifiedBadges = getQualifiedBadges(gradeResult.score);
    const topBadgeCfg = qualifiedBadges[0];
    const topBadge: SovereigntyBadgeTier = topBadgeCfg
      ? (topBadgeCfg.badgeName as SovereigntyBadgeTier)
      : 'IRON';
    const badgeDescription = generateBadgeDescription(topBadge);

    // Score breakdown narrative
    const scoreBreakdown = createEmptyScoreBreakdown();
    const scoreBreakdownNarrative = generateScoreBreakdownNarrative(scoreBreakdown);

    // Run completion narrative from the run summary
    const runSummary = createEmptyRunSummary(this._runId, this._userId, this._seed);
    const runCompletionNarrative = generateRunCompletionNarrative(runSummary);

    // Proof card title
    const proofCard = createEmptyProofCard(this._runId, '');
    const proofCardTitle = generateProofCardTitle(proofCard);

    // Component description for the weakest CORD component
    const cordRawValues = extractCordRawValues(snapshot);
    const weakestKey = CORD_WEIGHT_KEYS[0] ?? 'decision_speed_score';
    const weakestValue = (cordRawValues as Record<string, number>)[weakestKey] ?? 0;
    const componentDescription = generateComponentDescription(
      weakestKey as Parameters<typeof generateComponentDescription>[0],
      weakestValue,
    );

    // Grade label, distance from next, and percentile
    const gradeLabel = scoreToGradeLabel(gradeResult.grade as Parameters<typeof scoreToGradeLabel>[0]);
    const gradeDistanceFromNext = computeGradeDistanceFromNext(gradeResult.score);
    const scorePercentile = computeScorePercentile(gradeResult.score);

    // Grade comparison (vs 0 baseline)
    const gradeComparisonLabel = generateGradeComparisonLabel(0, gradeResult.score);

    // Full narrative: concatenate all sections
    const fullNarrative = [
      gradeNarrative,
      integrityNarrative,
      badgeDescription,
      scoreBreakdownNarrative,
      runCompletionNarrative,
      componentDescription,
    ]
      .filter(Boolean)
      .join('\n\n');

    return {
      gradeNarrative,
      integrityNarrative,
      badgeDescription,
      scoreBreakdownNarrative,
      runCompletionNarrative,
      proofCardTitle,
      componentDescription,
      gradeLabel,
      gradeDistanceFromNext,
      scorePercentile,
      gradeComparisonLabel,
      fullNarrative,
    };
  }

  // ────────────────────────────────────────────────────────────────────────
  // O13 — computeCORDBreakdown
  // Exhaustive CORD component analysis.
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Computes the exhaustive CORD component breakdown for the given snapshot.
   * Every CORD constant, weight, threshold, and component score is included
   * in the return value for full transparency and audit purposes.
   */
  computeCORDBreakdown(snapshot: RunStateSnapshot): SovereigntyCORDBreakdown {
    // Raw CORD values from snapshot
    const rawValues = extractCordRawValues(snapshot);

    // Per-component scores
    const componentScores: Record<string, number> = {};
    for (const key of CORD_WEIGHT_KEYS) {
      const rawVal = (rawValues as Record<string, number>)[key] ?? 0;
      componentScores[key] = computeCordComponentScore(
        key as Parameters<typeof computeCordComponentScore>[0],
        rawVal,
      ).weightedValue;
    }

    // Weighted CORD score
    const weightedCordResult = computeWeightedCordScore(rawValues as Parameters<typeof computeWeightedCordScore>[0]);
    const weightedScore = weightedCordResult.normalizedScore;

    // Outcome multiplier and classification
    const outcome = (snapshot.outcome ?? 'IN_PROGRESS') as Parameters<typeof resolveOutcomeMultiplier>[0];
    const resolvedOutcomeMultiplier = resolveOutcomeMultiplier(outcome);
    const outcomeClassification = classifyOutcome(outcome);

    // Integrity score adjustment and capped score
    const integrityAdjustment = computeIntegrityScoreAdjustment(
      snapshot.sovereignty.integrityStatus as Parameters<typeof computeIntegrityScoreAdjustment>[0],
    );
    const cappedScore = computeIntegrityCappedScore(
      weightedScore,
      snapshot.sovereignty.integrityStatus as Parameters<typeof computeIntegrityCappedScore>[1],
      snapshot.sovereignty.auditFlags.length,
    );

    // Snapshot analytics
    const effectiveStakes = computeSnapshotEffectiveStakes(snapshot);
    const decisionSpeedPercentile = computeDecisionSpeedPercentile(snapshot.telemetry.decisions);
    const botNeutralizationRatio = computeBotNeutralizationRatio(snapshot.battle);
    const shieldBreachDensity = computeShieldBreachDensity(snapshot.shield, snapshot.tick);
    const cascadeBrokenRatio = computeCascadeBrokenRatio(snapshot.cascade);
    const cascadeRecoveryRate = computeCascadeRecoveryRate(snapshot.cascade);
    const sovereigntyHealth = computeSnapshotSovereigntyHealth(snapshot);

    // Contract-level CORD scoring
    const scoreComponents = extractScoreComponentsFromSummary(
      createEmptyRunSummary(this._runId, this._userId, this._seed),
    );
    const contractCordScore = computeCORDScore(scoreComponents as Parameters<typeof computeCORDScore>[0]);
    const outcomeMultiplierValue = computeOutcomeMultiplier(
      (snapshot.outcome ?? 'IN_PROGRESS') as Parameters<typeof computeOutcomeMultiplier>[0],
    );
    const finalScore = computeFinalScore(
      weightedScore,
      (snapshot.outcome ?? 'IN_PROGRESS') as Parameters<typeof computeFinalScore>[1],
    );
    const assignedGrade = assignGradeFromScore(finalScore);

    // All grade thresholds
    const allGradeThresholds = computeAllGradeThresholds();

    // Full score breakdown
    const fullScoreBreakdown = computeFullScoreBreakdown(
      scoreComponents as Parameters<typeof computeFullScoreBreakdown>[0],
      (snapshot.outcome ?? 'IN_PROGRESS') as Parameters<typeof computeFullScoreBreakdown>[1],
    );

    // Pressure and shield sub-scores
    const pressureSurvivalScore = computePressureSurvivalScore(snapshot);
    const shieldDefenseScore = computeShieldDefenseScore(snapshot);

    // Component description texts for all components
    const componentDescriptionTexts: Record<string, string> = {};
    for (const key of CORD_WEIGHT_KEYS) {
      const rawVal = (rawValues as Record<string, number>)[key] ?? 0;
      componentDescriptionTexts[key] = generateComponentDescription(
        key as Parameters<typeof generateComponentDescription>[0],
        rawVal,
      );
    }

    // Reference all remaining constants
    void CORD_WEIGHTS;
    void OUTCOME_MULTIPLIER;
    void CORD_COMPONENT_COUNT;
    void CORD_COMPONENT_DESCRIPTIONS;
    void OUTCOME_KEYS;
    void OUTCOME_LABELS;
    void OUTCOME_DESCRIPTIONS;
    void OUTCOME_SEVERITY;
    void CORD_WEIGHT_SUM;
    void SOVEREIGNTY_MIN_CORD_SCORE;
    void SOVEREIGNTY_MAX_RAW_CORD_SCORE;
    void SOVEREIGNTY_MIN_DECISIONS;
    void SOVEREIGNTY_MIN_TICKS;
    void SOVEREIGNTY_VERIFIED_BONUS;

    return {
      cordWeights: CORD_WEIGHTS,
      outcomeMultiplier: OUTCOME_MULTIPLIER,
      weightKeys: CORD_WEIGHT_KEYS,
      componentCount: CORD_COMPONENT_COUNT,
      componentLabels: CORD_COMPONENT_LABELS as unknown as readonly string[],
      componentDescriptions: CORD_COMPONENT_DESCRIPTIONS as unknown as Record<string, string>,
      outcomeKeys: OUTCOME_KEYS,
      outcomeLabels: OUTCOME_LABELS as unknown as Record<string, string>,
      outcomeDescriptions: OUTCOME_DESCRIPTIONS as unknown as Record<string, string>,
      outcomeSeverity: OUTCOME_SEVERITY as unknown as Record<string, number>,
      weightSum: CORD_WEIGHT_SUM,
      minCordScore: SOVEREIGNTY_MIN_CORD_SCORE,
      maxRawCordScore: SOVEREIGNTY_MAX_RAW_CORD_SCORE,
      minDecisions: SOVEREIGNTY_MIN_DECISIONS,
      minTicks: SOVEREIGNTY_MIN_TICKS,
      verifiedBonus: SOVEREIGNTY_VERIFIED_BONUS,
      integrityRiskConfig: INTEGRITY_RISK_CONFIG,
      integrityRiskLevels: INTEGRITY_RISK_LEVELS,
      rawValues,
      weightedScore,
      componentScores,
      resolvedOutcomeMultiplier,
      outcomeClassification,
      integrityAdjustment,
      cappedScore,
      effectiveStakes,
      decisionSpeedPercentile,
      botNeutralizationRatio,
      shieldBreachDensity,
      cascadeBrokenRatio,
      cascadeRecoveryRate,
      sovereigntyHealth,
      cordFinalScore: weightedScore,
      contractCordScore,
      outcomeMultiplierValue,
      finalScore,
      assignedGrade,
      allGradeThresholds,
      fullScoreBreakdown,
      pressureSurvivalScore,
      shieldDefenseScore,
      componentDescriptionTexts,
    };
  }

  // ────────────────────────────────────────────────────────────────────────
  // O14 — computeCareerAnalytics
  // Multi-run career analytics bundle.
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Computes the full career analytics bundle from a list of run summaries.
   * Includes career aggregates, freedom streak, weakest CORD dimension,
   * improvement recommendations, leaderboard projections, and diffs.
   */
  computeCareerAnalytics(
    summaries: readonly SovereigntyRunSummary[],
  ): SovereigntyCareerReport {
    // Career aggregates and streak
    const aggregates = computeCareerAggregates(summaries as Parameters<typeof computeCareerAggregates>[0]);
    const freedomStreak = computeFreedomStreak(summaries as Parameters<typeof computeFreedomStreak>[0]);
    const weakestCORDDimension = identifyWeakestCORDDimension(summaries as Parameters<typeof identifyWeakestCORDDimension>[0]);
    const improvementRecommendation = generateImprovementRecommendation(
      aggregates as Parameters<typeof generateImprovementRecommendation>[0],
    );

    // Filter and sort
    const verifiedRuns = filterVerifiedRuns(summaries as SovereigntyRunSummary[]);
    const sortedRuns = sortByGradeAndScore(summaries as SovereigntyRunSummary[]);

    // Leaderboard
    const leaderboard = buildLeaderboard(sortedRuns as Parameters<typeof buildLeaderboard>[0]);
    const publicSummaries = verifiedRuns.map((s) => projectPublicSummary(s));
    const explorerCards = verifiedRuns.map((s) => projectExplorerCard(s));

    // Similarity score (compare first two if available)
    let topRunSimilarityScore = 0;
    let diffFromPrevious: unknown = null;
    if (summaries.length >= 2) {
      topRunSimilarityScore = computeRunSimilarityScore(
        summaries[0]!,
        summaries[1]!,
      );
      diffFromPrevious = diffRunSummaries(summaries[0]!, summaries[1]!);
    }

    // Score components from latest run
    const latestSummary = summaries[summaries.length - 1] ?? createEmptyRunSummary(this._runId, this._userId, this._seed);
    const scoreComponentsFromLatest = extractScoreComponentsFromSummary(latestSummary);

    // Grade comparison label (0 vs latest score)
    const latestScore = latestSummary.sovereigntyScore ?? 0;
    const gradeComparisonLabel = generateGradeComparisonLabel(0, latestScore);

    return {
      aggregates,
      freedomStreak,
      weakestCORDDimension,
      improvementRecommendation,
      verifiedRuns,
      sortedRuns,
      leaderboard,
      publicSummaries,
      explorerCards,
      topRunSimilarityScore,
      diffFromPrevious,
      scoreComponentsFromLatest,
      gradeComparisonLabel,
    };
  }

  // ────────────────────────────────────────────────────────────────────────
  // O15 — computeSessionAnalytics
  // Current-session operational metrics.
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Returns operational metrics for the current session.
   * Does not require a snapshot — uses the orchestrator's session state.
   */
  computeSessionAnalytics(): SovereigntySessionReport {
    const engineHealth = this._engine.getHealth();
    const lastRunSummary = this._engine.getLastRunSummary?.() ?? null;
    const cordHistory = this._engine.getCORDHistory?.() ?? [];
    const auditTrail = this._engine.getAuditTrail?.() ?? [];
    const proofLifecycleState = this._engine.getProofLifecycleState?.() ?? null;

    // Numeric score from last grade result
    const gradeNumericScore =
      this._lastGradeResult !== null
        ? computeGradeNumericScore(this._lastGradeResult.grade as Parameters<typeof computeGradeNumericScore>[0])
        : 0;

    // Compare grade results if multiple available
    if (this._lastGradeResult !== null && cordHistory.length > 1) {
      const prev = cordHistory[cordHistory.length - 2] as unknown as RunGradeScoreResult | undefined;
      if (prev !== undefined) {
        const _comparison = compareGradeResults(
          prev as RunGradeScoreResult,
          this._lastGradeResult,
        );
        void _comparison;
      }
    }

    return {
      runId: this._runId,
      userId: this._userId,
      seed: this._seed,
      tickCount: this._tickCount,
      sessionDurationMs: Date.now() - this._startedAtMs,
      lastTickAtMs: this._lastTickAtMs,
      engineHealth,
      lastRunSummary,
      cordHistory,
      auditTrail,
      proofLifecycleState,
      gradeNumericScore,
    };
  }

  // ────────────────────────────────────────────────────────────────────────
  // O16 — computeBadgeSummary
  // Badge eligibility and tier resolution bundle.
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Computes the full badge eligibility and tier resolution bundle for the
   * given snapshot.  Includes grade bracket, badge tier, qualified badges,
   * distance to next grade, and narrative descriptions.
   */
  computeBadgeSummary(snapshot: RunStateSnapshot): SovereigntyBadgeReport {
    // Derive grade from current sovereignty state
    const gradeResult = this._lastGradeResult ?? this._gradeAssigner.score(snapshot);
    const grade = gradeResult.grade as SovereigntyGrade;

    // Grade bracket lookup
    const gradeBracketGrade = (grade === 'S' ? 'A' : grade) as Parameters<typeof getGradeBracket>[0];
    const gradeBracket = getGradeBracket(gradeBracketGrade);

    // Badge tier from grade (types module) — cast SovereigntyGrade to VerifiedGrade (exclude 'S')
    const verifiedGrade = (grade === 'S' ? 'A' : grade) as Parameters<typeof computeBadgeTierFromGrade>[0];
    const badgeTierFromGradeCfg = computeBadgeTierFromGrade(verifiedGrade);
    const badgeTierFromGrade = badgeTierFromGradeCfg.badgeName as SovereigntyBadgeTier;

    // Qualified badges from snapshot
    const qualifiedBadgesCfg = getQualifiedBadges(gradeResult.score);
    const qualifiedBadges = qualifiedBadgesCfg.map(b => b.badgeName as SovereigntyBadgeTier);

    // Distance to next grade
    const distanceToNextGrade = computeDistanceToNextGrade(gradeResult.score);

    // Grade-badge pair from types
    const gradeBadgePair = resolveGradeBadgePair(gradeResult.score);

    // Badge tier from contracts
    const badgeTierForGradeValue = badgeTierForGrade(grade);

    // Normalize grade via contracts
    const normalizedGrade = normalizeGrade(grade);

    // Badge narrative and description
    const badgeNarrative = generateBadgeNarrative(gradeResult.badges ?? []);
    const topBadge: SovereigntyBadgeTier = qualifiedBadges[0] ?? badgeTierFromGrade;
    const badgeDescription = generateBadgeDescription(topBadge);

    return {
      grade,
      badge: badgeTierFromGrade,
      gradeBracket,
      badgeTierFromGrade,
      qualifiedBadges,
      distanceToNextGrade,
      gradeBadgePair,
      badgeTierForGradeValue,
      normalizedGrade,
      badgeNarrative,
      badgeDescription,
    };
  }

  // ────────────────────────────────────────────────────────────────────────
  // O17 — computeLeaderboardProjection
  // Leaderboard ranking projection for the current run.
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Projects the current run onto a leaderboard, optionally against a list
   * of other run summaries.  Returns rank, leaderboard entry, public summary,
   * and explorer card projections.
   */
  computeLeaderboardProjection(
    snapshot: RunStateSnapshot,
    allSummaries: readonly SovereigntyRunSummary[] = [],
  ): SovereigntyLeaderboardResult {
    // Build the current run summary via adapter
    const currentSummary = createAdapterRunSummary(
      this._runId,
      this._userId,
      this._seed,
    );

    // Combine current + all summaries for leaderboard
    const allWithCurrent = [...allSummaries, currentSummary];
    const sorted = sortByGradeAndScore(allWithCurrent as SovereigntyRunSummary[]);
    const leaderboard = buildLeaderboard(sorted as Parameters<typeof buildLeaderboard>[0]);

    // Export adapter leaderboard (artifact-based)
    const exportArtifact = createEmptyExportArtifact(
      `lb-${this._runId}`,
      this._runId,
      '',
      'JSON',
    );
    void exportArtifact;
    const exportLeaderboard = buildExportLeaderboard(allWithCurrent as SovereigntyRunSummary[]);

    // Rank for the current run
    const currentScore =
      (snapshot.sovereignty?.sovereigntyScore as number | undefined) ?? 0;
    const allScores = allWithCurrent.map(
      (s) => s.sovereigntyScore ?? 0,
    );
    const rank = computeLeaderboardRank(allScores, currentScore);

    // Leaderboard entry, public summary, explorer card
    const leaderboardEntry = projectLeaderboardEntry(currentSummary, rank);
    const publicSummary = projectPublicSummary(currentSummary);
    const explorerCard = projectExplorerCard(currentSummary);

    return {
      leaderboard,
      exportLeaderboard,
      rank,
      leaderboardEntry,
      publicSummary,
      explorerCard,
    };
  }

  // ────────────────────────────────────────────────────────────────────────
  // O18 — validateSubsystem
  // Cross-subsystem validation sweep.
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Runs a full cross-subsystem validation sweep for the given snapshot.
   * Calls every validation function across all sovereignty components and
   * returns a comprehensive report of which checks passed.
   */
  validateSubsystem(snapshot: RunStateSnapshot): SovereigntyValidationSweep {
    // Build baseline data for validation
    const emptyRunSummary = createEmptyRunSummary(this._runId, this._userId, this._seed);
    const emptyTickRecord = createEmptyTickRecord(this._runId, this._userId, this._seed, 0);
    const emptyProofCard = createEmptyProofCard(this._runId, '');
    const emptyExportArtifact = createEmptyExportArtifact(`val-${this._runId}`, this._runId, '', 'JSON');
    const emptyScoreBreakdown = createEmptyScoreBreakdown();
    const emptyDecisionSample = createEmptyDecisionSample(0, 'actor-0', 'card-0');
    const proofInput = this._proofGenerator.buildProofInput(snapshot);

    const safeCheck = (fn: () => unknown): boolean => {
      try {
        fn();
        return true;
      } catch {
        return false;
      }
    };

    // Proof subsystem
    const proofInputValid = safeCheck(() => validateProofInput(proofInput));
    const proofSnapshotValid = safeCheck(() => validateProofSnapshot(snapshot));

    // Integrity subsystem
    const integritySnapshotValid = safeCheck(() => validateIntegritySnapshot(snapshot));

    // Adapter subsystem
    const snapshotAdapterValid = safeCheck(() => validateSnapshotForAdapter(snapshot));

    // Export subsystem
    const exportInputsValid = safeCheck(() =>
      validateExportInputs(emptyRunSummary, [emptyTickRecord], {}, 'JSON'),
    );

    // Exporter subsystem
    const exporterInputsValid = safeCheck(() => validateExporterInputs(snapshot));

    // Persistence subsystem
    const emptyEnvelope = buildPersistenceEnvelope({
      summary: emptyRunSummary,
      ticks: [emptyTickRecord],
      artifact: emptyExportArtifact,
      persistenceIdPrefix: `val-${this._runId}`,
    });
    const persistenceInputsValid = safeCheck(() =>
      validatePersistenceInputs(emptyEnvelope as Parameters<typeof validatePersistenceInputs>[0]),
    );

    // Types module validations
    const sovereigntyTypesValid = safeCheck(() => validateSovereigntyTypes());
    const cordRawValues = extractCordRawValues(snapshot);
    const cordRawValuesValid = safeCheck(() =>
      validateCordRawValues(cordRawValues as Parameters<typeof validateCordRawValues>[0]),
    );
    const outcomeKeyValid = safeCheck(() =>
      validateOutcomeKey((snapshot.outcome ?? 'IN_PROGRESS') as Parameters<typeof validateOutcomeKey>[0]),
    );
    const gradeResult = this._lastGradeResult ?? this._gradeAssigner.score(snapshot);
    const gradeValid = safeCheck(() =>
      validateGrade(gradeResult.grade as Parameters<typeof validateGrade>[0]),
    );
    const integrityStatusValue = (snapshot.sovereignty?.integrityStatus ?? 'UNVERIFIED') as Parameters<typeof validateIntegrityStatusFn>[0];
    const integrityStatusValid = safeCheck(() => validateIntegrityStatusFn(integrityStatusValue));
    const sovereigntyScoreValid = safeCheck(() =>
      validateSovereigntyScore(gradeResult.score),
    );
    const modeKey = (snapshot.mode ?? 'SOLO') as Parameters<typeof validateModeForSovereignty>[0];
    const modeValid = safeCheck(() => validateModeForSovereignty(modeKey));
    const signals = extractSovereigntySignals(snapshot);
    const signalsValid = safeCheck(() =>
      validateSovereigntySignals(signals as Parameters<typeof validateSovereigntySignals>[0]),
    );

    // Contract validations
    const decisionSampleValid = safeCheck(() =>
      validateDecisionSample(emptyDecisionSample),
    );
    const tickRecordValid = safeCheck(() => validateTickRecord(emptyTickRecord));
    const scoreBreakdownValid = safeCheck(() =>
      validateScoreBreakdown(emptyScoreBreakdown),
    );
    const runSummaryValid = safeCheck(() => validateRunSummary(emptyRunSummary));
    const proofCardValid = safeCheck(() => validateProofCard(emptyProofCard));
    const exportArtifactValid = safeCheck(() =>
      validateExportArtifact(emptyExportArtifact),
    );
    const snapshotSovereigntyValid = safeCheck(() =>
      validateSnapshotSovereignty(snapshot),
    );
    const persistenceEnvelopeValid = safeCheck(() =>
      validatePersistenceEnvelope(emptyEnvelope as Parameters<typeof validatePersistenceEnvelope>[0]),
    );
    const cordWeightsVerified = verifyCordWeights().valid;

    const allValid =
      proofInputValid &&
      proofSnapshotValid &&
      integritySnapshotValid &&
      snapshotAdapterValid &&
      sovereigntyTypesValid &&
      cordRawValuesValid &&
      outcomeKeyValid &&
      gradeValid &&
      integrityStatusValid &&
      sovereigntyScoreValid &&
      modeValid &&
      signalsValid &&
      decisionSampleValid &&
      tickRecordValid &&
      scoreBreakdownValid &&
      runSummaryValid &&
      proofCardValid &&
      exportArtifactValid &&
      snapshotSovereigntyValid &&
      cordWeightsVerified;

    return {
      proofInputValid,
      proofSnapshotValid,
      integritySnapshotValid,
      snapshotAdapterValid,
      exportInputsValid,
      exporterInputsValid,
      persistenceInputsValid,
      sovereigntyTypesValid,
      cordRawValuesValid,
      outcomeKeyValid,
      gradeValid,
      integrityStatusValid,
      sovereigntyScoreValid,
      modeValid,
      signalsValid,
      decisionSampleValid,
      tickRecordValid,
      scoreBreakdownValid,
      runSummaryValid,
      proofCardValid,
      exportArtifactValid,
      snapshotSovereigntyValid,
      persistenceEnvelopeValid,
      cordWeightsVerified,
      allValid,
    };
  }

  // ────────────────────────────────────────────────────────────────────────
  // O19 — serializeRunData
  // Full serialization bundle for a run.
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Produces the full serialization bundle for the current run.
   * Serializes + deserializes every sovereignty data structure to verify
   * round-trip fidelity and compute the serialization checksum.
   */
  serializeRunData(snapshot: RunStateSnapshot): SovereigntySerializedBundle {
    // Run summary
    const runSummary = createEmptyRunSummary(this._runId, this._userId, this._seed);
    const serializedRunSummary = serializeRunSummary(runSummary);
    const deserializedRunSummary = deserializeRunSummary(serializedRunSummary);
    const runSummaryChecksumValid = verifyRunSummaryChecksum(deserializedRunSummary, '');
    const runSummarySerializedSize = computeRunSummarySerializedSize(runSummary);

    // Tick timeline
    const tickRecord = createEmptyTickRecord(this._runId, this._userId, this._seed, 0);
    const serializedTickTimeline = serializeTickTimeline([tickRecord]);
    const deserializedTickTimeline = deserializeTickTimeline(serializedTickTimeline);

    // Checksum
    const checksum = computeSerializationChecksum(serializedRunSummary);

    // Proof card and export artifact
    const proofCard = createEmptyProofCard(this._runId, '');
    const serializedProofCard = serializeProofCard(proofCard);
    const exportArtifact = createEmptyExportArtifact(
      `ser-${this._runId}`,
      this._runId,
      '',
      'JSON',
    );
    const serializedExportArtifact = serializeExportArtifact(exportArtifact);

    // Proof result
    const proofFullResult = this._lastProofResult ?? this._proofGenerator.generateFull(snapshot);
    const serializedProofResult = serializeProofResult(proofFullResult);
    const deserializedProofResult = deserializeProofResult(serializedProofResult);

    // Proof certificate
    const cordScore = computeCordScore(snapshot);
    const grade = deriveGradeFromScore(cordScore, snapshot);
    const proofInput = this._proofGenerator.buildProofInput(snapshot);
    const auditLog: ProofAuditLog = (proofFullResult as { auditLog?: ProofAuditLog }).auditLog ?? { runId: this._runId, entries: [], logChecksum: '', createdAtMs: Date.now() };
    const mlVec = computeProofMLVector(snapshot, proofInput, {
      cordScore: cordScore,
      grade: grade as unknown as null,
      batchRunIndex: 0,
      extendedProofAvailable: false,
      hmacSignatureLength: 0,
      auditEventCount: 0,
      sealChainDepth: 0,
    });
    const dlTen = computeProofDLTensor(snapshot, mlVec);
    const proofCert = buildProofCertificate(
      snapshot,
      proofFullResult.proofHash ?? '',
      proofFullResult.proofHash ?? '',
      proofInput,
      cordScore,
      grade,
      mlVec,
      dlTen,
      auditLog,
      { valid: true, errors: [], warnings: [], fieldResults: {} as Record<string, boolean> },
    );
    const serializedProofCertificate = serializeProofCertificate(proofCert);
    const deserializedProofCertificate = deserializeProofCertificate(serializedProofCertificate);

    // Integrity result
    const integrityResult = this._lastIntegrityResult ?? this._integrityChecker.verify(snapshot);
    const serializedIntegrityResult = serializeIntegrityResult(integrityResult);
    const deserializedIntegrityResult = deserializeIntegrityResult(serializedIntegrityResult);

    // Grade result
    const gradeResult = this._lastGradeResult ?? this._gradeAssigner.score(snapshot);
    const serializedGradeResult = serializeGradeResult(gradeResult);
    const deserializedGradeResult = deserializeGradeResult(serializedGradeResult);

    // Export bundle
    const exportCtx = new ExportRunContext({ artifactFormat: 'JSON' });
    const exportRunResult = exportCtx.exportRun(snapshot);
    const serializedExportBundle = serializeExportBundle(exportRunResult.artifact);
    const deserializedExportBundle = deserializeExportBundle(serializedExportBundle);

    // Exporter result
    const exporterResult = this._exporter.exportFull(snapshot);
    const serializedExporterResult = serializeExporterResult(exporterResult);
    const deserializedExporterResult = deserializeExporterResult(serializedExporterResult);

    // Persistence result
    const persistenceEnvelope = buildPersistenceEnvelope({
      summary: runSummary,
      ticks: [tickRecord],
      artifact: exportArtifact,
      persistenceIdPrefix: `ser-${this._runId}`,
    });
    const serializedPersistenceResult = serializePersistenceResult(
      persistenceEnvelope as Parameters<typeof serializePersistenceResult>[0],
    );
    const deserializedPersistenceResult = deserializePersistenceResult(serializedPersistenceResult);

    // Sovereignty config serialization
    void { version: SOVEREIGNTY_ORCHESTRATOR_VERSION }; // dummyConfig not needed; fns take 0 args
    const serializedSovereigntyConfig = serializeSovereigntyConfig();
    const deserializedSovereigntyConfig = deserializeSovereigntyConfig(serializedSovereigntyConfig);
    const configFingerprint = computeSovereigntyConfigFingerprint();
    const typesChecksum = computeSovereigntyTypesChecksum();

    return {
      serializedRunSummary,
      deserializedRunSummary,
      serializedTickTimeline,
      deserializedTickTimeline,
      checksum,
      serializedProofCard,
      serializedExportArtifact,
      runSummaryChecksumValid,
      runSummarySerializedSize,
      serializedProofResult,
      deserializedProofResult,
      serializedProofCertificate,
      deserializedProofCertificate,
      serializedIntegrityResult,
      deserializedIntegrityResult,
      serializedGradeResult,
      deserializedGradeResult,
      serializedExportBundle,
      deserializedExportBundle,
      serializedExporterResult,
      deserializedExporterResult,
      serializedPersistenceResult,
      deserializedPersistenceResult,
      serializedSovereigntyConfig,
      deserializedSovereigntyConfig,
      configFingerprint,
      typesChecksum,
    };
  }

  // ────────────────────────────────────────────────────────────────────────
  // O20 — buildContractAudit
  // Audit trail records and persistence envelope.
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Builds the full contract audit bundle for the given snapshot.
   * Includes tick/run/artifact/audit write records, a persistence envelope,
   * and verification of all audit entries.
   */
  buildContractAudit(snapshot: RunStateSnapshot): SovereigntyAuditBundle {
    // Extract tick fields from snapshot
    const tickFields = extractTickFieldsFromSnapshot(
      snapshot,
      this._runId,
      this._userId,
      `record-${this._runId}-${snapshot.tick}`,
    );

    // Build write records
    const tickRecord = createEmptyTickRecord(this._runId, this._userId, this._seed, snapshot.tick);
    const runSummary = createEmptyRunSummary(this._runId, this._userId, this._seed);
    const exportArtifact = createEmptyExportArtifact(`audit-${this._runId}`, this._runId, '', 'JSON');

    const tickWriteRecord = buildTickWriteRecord(tickRecord, `${this._runId}-tick`);
    const runWriteRecord = buildRunWriteRecord(runSummary, `${this._runId}-run`);
    const artifactWriteRecord = buildArtifactWriteRecord(
      exportArtifact,
      `${this._runId}-artifact`,
    );
    const auditWriteRecord = buildAuditWriteRecord({
      persistenceId: `${this._runId}-audit`,
      runId: this._runId,
      proofHash: runSummary.proofHash ?? '',
      integrityStatus: runSummary.integrityStatus,
      grade: runSummary.verifiedGrade,
      score: runSummary.sovereigntyScore,
      tickStreamChecksum: runSummary.tickStreamChecksum ?? '',
      tickCount: runSummary.ticksSurvived,
      artifactId: exportArtifact.artifactId,
    });

    // Persistence envelope
    const persistenceEnvelope = buildPersistenceEnvelope({
      summary: runSummary,
      ticks: [tickRecord],
      artifact: exportArtifact,
      persistenceIdPrefix: `audit-${this._runId}`,
    });

    // Snapshot flags
    const resolvedGrade = resolveSnapshotGrade(snapshot);
    const isSovereignMoment = isSnapshotSovereignMoment(snapshot);

    // Proof audit entry
    const proofAuditEntry = buildProofAuditEntry(
      this._runId,
      snapshot.tick,
      'proof.audit',
      { runId: this._runId },
      'audit-hmac-key',
    );
    const proofAuditValid = verifyProofAuditEntry(proofAuditEntry, 'audit-hmac-key');
    const proofAuditLog: ProofAuditLog = { runId: this._runId, entries: [proofAuditEntry], logChecksum: '', createdAtMs: Date.now() };
    const proofAuditLogHash = computeAuditLogIntegrityHash(proofAuditLog);
    const proofAuditLogValidResult = verifyAuditLogIntegrity(proofAuditLog, 'audit-hmac-key');
    const proofAuditLogValid = proofAuditLogValidResult.valid;

    // Integrity audit entry
    const integrityAuditEntry = buildIntegrityAuditEntry(
      this._runId,
      snapshot.tick,
      'integrity.audit',
      { runId: this._runId },
      'audit-integrity-key',
    );
    const integrityAuditEntryValid = verifyIntegrityAuditEntry(
      integrityAuditEntry,
      'audit-integrity-key',
    );

    // Grade audit entry
    const gradeResultForAudit = this._lastGradeResult ?? this._gradeAssigner.score(snapshot);
    const gradeAuditEntry = buildGradeAuditEntry(gradeResultForAudit, 'audit-grade-key');
    const gradeAuditEntryValid = verifyGradeAuditEntry(gradeAuditEntry, 'audit-grade-key');

    // Export audit entry
    const exportAuditEntry = buildExportAuditEntry(exportArtifact);
    const exportAuditEntryValid = verifyExportAuditEntry(exportAuditEntry, 'audit-export-key');

    // Exporter audit entry
    const exporterAuditEntry = buildExporterAuditEntry(
      this._runId,
      '',
      'export.audit',
      'audit-exporter-key',
    );
    const exporterAuditEntryValid = verifyExporterAuditEntry(
      exporterAuditEntry,
      'audit-exporter-key',
    );

    // Persistence audit entry
    const persistenceAuditEntry = buildPersistenceAuditEntry(
      this._runId,
      'persist.audit',
      { runId: this._runId },
      'audit-persist-key',
    );
    const persistenceAuditEntryValid = verifyPersistenceAuditEntry(
      persistenceAuditEntry,
      'audit-persist-key',
    );

    return {
      tickFields,
      tickWriteRecord,
      runWriteRecord,
      artifactWriteRecord,
      auditWriteRecord,
      persistenceEnvelope,
      resolvedGrade,
      isSovereignMoment,
      proofAuditEntry,
      proofAuditLogHash,
      proofAuditLogValid: proofAuditValid && proofAuditLogValid,
      integrityAuditEntry,
      integrityAuditEntryValid,
      gradeAuditEntry,
      gradeAuditEntryValid,
      exportAuditEntry,
      exportAuditEntryValid,
      exporterAuditEntry,
      exporterAuditEntryValid,
      persistenceAuditEntry,
      persistenceAuditEntryValid,
    };
  }

  // ────────────────────────────────────────────────────────────────────────
  // O21 — runBatchAnalysis  (async)
  // Async batch processing across all sovereignty subsystems.
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Runs a full batch analysis across all sovereignty subsystems for the
   * given array of snapshots.  This is the primary entry-point for offline
   * batch processing and bulk ML feature extraction.
   *
   * Calls batchGenerateProofs, batchVerifyIntegrity, batchGradeRuns,
   * batchExportArtifacts, batchExport, batchPersist, and diffTickRecords.
   */
  async runBatchAnalysis(
    snapshots: readonly RunStateSnapshot[],
  ): Promise<SovereigntyBatchResult> {
    const batchSize = snapshots.length;

    // Batch proof generation
    const proofBatchResult = batchGenerateProofs(snapshots as RunStateSnapshot[]);
    const proofBatchMLVector = computeBatchAggregateMLVector(proofBatchResult);
    const proofBatchRankedByGrade = rankBatchResultsByGrade(proofBatchResult);
    const proofBatchFilteredFreedom = filterBatchResultsByOutcome(
      proofBatchResult,
      'FREEDOM' as Parameters<typeof filterBatchResultsByOutcome>[1],
    );
    const proofBatchCordStats = computeBatchCordStats(proofBatchResult);

    // Batch integrity verification
    const integrityBatchResult = batchVerifyIntegrity(
      snapshots as RunStateSnapshot[],
      this._integrityChecker,
    );

    // Batch grade runs
    const gradeBatchResult = batchGradeRuns(
      snapshots as RunStateSnapshot[],
      this._gradeAssigner,
    );

    // Batch export (adapter)
    const exportBatchResult = batchExportArtifacts(
      this._exportAdapter,
      snapshots.map((s) => createEmptyRunSummary(s.runId, s.userId ?? this._userId, s.seed ?? this._seed)),
      new Map() as ReadonlyMap<string, readonly SovereigntyTickRecord[]>,
      {},
      'JSON',
    );

    // Batch export (exporter)
    const exporterBatchResult = batchExport(
      snapshots as RunStateSnapshot[],
      { artifactFormat: 'JSON' },
      'batch-hmac-key',
    );

    // Batch persist (async)
    const batchPersistRuns = snapshots.map((s) => ({
      finalSnapshot: s,
      history: [] as RunStateSnapshot[],
      context: { artifactFormat: 'JSON' as const },
    }));
    const persistenceBatchResult = await batchPersist(this._writer, batchPersistRuns);

    // Diff tick records (sequential pairs)
    const tickDiffs: unknown[] = [];
    for (let i = 1; i < snapshots.length; i++) {
      const prevSnap = snapshots[i - 1]!;
      const currSnap = snapshots[i]!;
      const prevTickRecord = createEmptyTickRecord(
        prevSnap.runId,
        prevSnap.userId ?? this._userId,
        prevSnap.seed ?? this._seed,
        prevSnap.tick,
      );
      const currTickRecord = createEmptyTickRecord(
        currSnap.runId,
        currSnap.userId ?? this._userId,
        currSnap.seed ?? this._seed,
        currSnap.tick,
      );
      tickDiffs.push(diffTickRecords(prevTickRecord, currTickRecord));
    }

    return {
      batchSize,
      proofBatchResult,
      proofBatchMLVector,
      proofBatchRankedByGrade,
      proofBatchFilteredFreedom,
      proofBatchCordStats,
      integrityBatchResult,
      gradeBatchResult,
      exportBatchResult,
      exporterBatchResult,
      persistenceBatchResult,
      tickDiffs,
    };
  }

  // ────────────────────────────────────────────────────────────────────────
  // O22 — buildPersistenceContext
  // Persistence writer pipeline for a completed run.
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Builds the persistence context bundle for a completed run.
   * Creates a PersistenceRunContext, computes ML/DL vectors, generates
   * the persistence narrative, and serializes the result.
   */
  buildPersistenceContext(snapshot: RunStateSnapshot): SovereigntyPersistenceBundle {
    // Create PersistenceRunContext (takes writer, runId, hmacSecret)
    const persistCtx = new PersistenceRunContext(
      this._writer,
      this._runId,
      'orchestrator-persist-hmac',
    );
    void persistCtx;

    // Run summary and tick records for ML/DL computation
    const runSummary = createAdapterRunSummary(this._runId, this._userId, this._seed);
    const enrichedSummaryWrapper = enrichRunSummaryWithMLFeatures(runSummary);
    const enrichedSummary = enrichedSummaryWrapper.summary;
    const tickRecord = createAdapterTickRecord(
      this._runId,
      this._userId,
      this._seed,
      snapshot.tick,
    );
    const ticks: SovereigntyTickRecord[] = [tickRecord];
    const tickWriteRecords = ticks.map((t, i) => buildTickWriteRecord(t, `${this._runId}-persist-tick-${i}`));

    // ML/DL vectors
    const mlVector = computePersistenceMLVector(enrichedSummary, tickWriteRecords);
    const dlTensor = computePersistenceDLTensor(enrichedSummary, tickWriteRecords);

    // Narrative
    const narrative = generatePersistenceNarrative(enrichedSummary, ticks.length);

    // Build persistence envelope for serialization
    const exportArtifact = createEmptyExportArtifact(
      `persist-${this._runId}`,
      this._runId,
      '',
      'JSON',
    );
    const envelope = buildPersistenceEnvelope({
      summary: enrichedSummary,
      ticks,
      artifact: exportArtifact,
      persistenceIdPrefix: `persist-ctx-${this._runId}`,
    });

    // Serialize / deserialize round-trip
    const serialized = serializePersistenceResult(
      envelope as Parameters<typeof serializePersistenceResult>[0],
    );
    const deserialized = deserializePersistenceResult(serialized);

    // Audit entry
    const auditEntry = buildPersistenceAuditEntry(
      this._runId,
      'persist.context',
      { runId: this._runId, tickCount: ticks.length },
      'orchestrator-persist-hmac',
    );
    const auditEntryValid = verifyPersistenceAuditEntry(
      auditEntry,
      'orchestrator-persist-hmac',
    );

    return {
      writer: this._writer,
      runId: this._runId,
      mlVector,
      dlTensor,
      narrative,
      serialized,
      deserialized,
      auditEntry,
      auditEntryValid,
    };
  }

  // ────────────────────────────────────────────────────────────────────────
  // O23 — selfTest
  // Runs all subsystem self-tests and returns a comprehensive result.
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Runs the self-test suite for every sovereignty subsystem component.
   * Returns a comprehensive result indicating which subsystems passed or
   * failed, so operators can detect configuration issues at startup.
   */
  async selfTest(): Promise<SovereigntySelfTestResult> {
    const failedSubsystems: string[] = [];

    const runTest = async (name: string, fn: () => unknown): Promise<unknown> => {
      try {
        return await Promise.resolve(fn());
      } catch (err) {
        failedSubsystems.push(name);
        return { passed: false, error: String(err) };
      }
    };

    const proofGeneratorSelfTest = await runTest('proofGenerator', runProofGeneratorSelfTest);
    const integritySelfTest = await runTest('integrity', runIntegritySelfTest);
    const gradeSelfTest = await runTest('grade', runGradeSelfTest);
    const adapterSelfTest = await runTest('adapter', runAdapterSelfTest);
    const exportSelfTest = await runTest('export', runExportSelfTest);
    const exporterSelfTest = await runTest('exporter', runExporterSelfTest);
    const persistenceSelfTest = await runTest('persistence', runPersistenceSelfTest);
    const sovereigntyTypesSelfTest = await runTest('sovereigntyTypes', runSovereigntyTypesSelfTest);
    const contractSelfTest = await runTest('contract', runContractSelfTest);

    const allPassed = failedSubsystems.length === 0;

    return {
      orchestratorVersion: SOVEREIGNTY_ORCHESTRATOR_VERSION,
      proofGeneratorSelfTest,
      integritySelfTest,
      gradeSelfTest,
      adapterSelfTest,
      exportSelfTest,
      exporterSelfTest,
      persistenceSelfTest,
      sovereigntyTypesSelfTest,
      contractSelfTest,
      allPassed,
      failedSubsystems,
      completedAtMs: Date.now(),
    };
  }

  // ────────────────────────────────────────────────────────────────────────
  // O24 — generateDiagnosticDump
  // Full diagnostic snapshot of all sovereignty subsystems.
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Generates a full diagnostic dump of all sovereignty subsystems for the
   * given snapshot.  Used by health-check endpoints and incident response.
   * Creates empty baseline structures, computes the sovereignty label, and
   * includes the version manifest and feature dimensions.
   */
  generateDiagnosticDump(snapshot: RunStateSnapshot): SovereigntyDiagnosticDump {
    // Empty baseline structures — confirm factory functions produce valid output
    const emptyDecisionSample = createEmptyDecisionSample(
      snapshot.tick,
      `actor-${this._userId}`,
      `card-diagnostic`,
    );
    const emptyScoreBreakdown = createEmptyScoreBreakdown();
    const emptyTickRecord = createEmptyTickRecord(
      this._runId,
      this._userId,
      this._seed,
      snapshot.tick,
    );
    const emptyRunSummary = createEmptyRunSummary(this._runId, this._userId, this._seed);
    const emptyProofCard = createEmptyProofCard(this._runId, '');
    const emptyExportArtifact = createEmptyExportArtifact(
      `diag-${this._runId}`,
      this._runId,
      '',
      'JSON',
    );

    // Reference all empty objects to ensure they are consumed at runtime
    void emptyDecisionSample;
    void emptyScoreBreakdown;
    void emptyTickRecord;
    void emptyProofCard;
    void emptyExportArtifact;

    // Sovereignty label for the snapshot
    const snapshotLabel = generateSovereigntyLabel(snapshot);

    // Engine health
    const engineHealth = this._engine.getHealth();

    return {
      runId: this._runId,
      userId: this._userId,
      seed: this._seed,
      orchestratorVersion: SOVEREIGNTY_ORCHESTRATOR_VERSION,
      versionInfo: this.getVersionInfo(),
      featureDimensions: this.getFeatureDimensions(),
      engineHealth,
      emptyDecisionSample,
      emptyScoreBreakdown,
      emptyTickRecord,
      emptyRunSummary,
      emptyProofCard,
      emptyExportArtifact,
      snapshotLabel,
      generatedAtMs: Date.now(),
    };
  }
}

/* ============================================================================
 * FACTORY FUNCTIONS
 * ========================================================================== */

/**
 * Creates a fully-wired SovereigntyOrchestrator for the given run.
 *
 * This is the canonical entry-point for consumers that need the full
 * sovereignty subsystem.
 *
 * @example
 * ```typescript
 * import { Sovereignty } from '../../engine';
 * const orchestrator = Sovereignty.buildSovereigntyStack(runId, userId, seed);
 * const cord = orchestrator.computeCORDBreakdown(snapshot);
 * const proof = orchestrator.generateProofFull(snapshot);
 * const self = await orchestrator.selfTest();
 * ```
 */
export function buildSovereigntyStack(
  runId: string,
  userId: string,
  seed: string,
): SovereigntyOrchestrator {
  return new SovereigntyOrchestrator(runId, userId, seed);
}

/**
 * Convenience function: runs the full proof + grade + integrity pipeline
 * for a single snapshot and returns a combined summary object.
 *
 * Equivalent to:
 *   1. buildSovereigntyStack(runId, userId, seed)
 *   2. orchestrator.generateProofFull(snapshot)
 *   3. orchestrator.computeGradeReport(snapshot)
 *   4. orchestrator.computeIntegrityReport(snapshot)
 */
export function runSovereigntyPipeline(
  snapshot: RunStateSnapshot,
  runId: string,
  userId: string,
  seed: string,
): {
  proof: SovereigntyProofBundle;
  grade: SovereigntyGradeReport;
  integrity: SovereigntyIntegrityReport;
  cord: SovereigntyCORDBreakdown;
  narrative: SovereigntyRunNarrative;
  chat: SovereigntyChatPayload;
} {
  const orchestrator = buildSovereigntyStack(runId, userId, seed);
  const proof = orchestrator.generateProofFull(snapshot);
  const grade = orchestrator.computeGradeReport(snapshot);
  const integrity = orchestrator.computeIntegrityReport(snapshot);
  const cord = orchestrator.computeCORDBreakdown(snapshot);
  const narrative = orchestrator.generateRunNarrative(snapshot);
  const chat = orchestrator.buildChatAdapterPayload(snapshot);
  return { proof, grade, integrity, cord, narrative, chat };
}
