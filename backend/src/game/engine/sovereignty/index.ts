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
export { SovereigntySnapshotAdapter } from './SovereigntySnapshotAdapter';

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

// ── Types ────────────────────────────────────────────────────────────────────
export { CORD_WEIGHTS, OUTCOME_MULTIPLIER } from './types';

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
