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
export { ReplayIntegrityChecker } from './ReplayIntegrityChecker';
export type { ReplayIntegrityResult } from './ReplayIntegrityChecker';

// ── Run Grade Assigner ───────────────────────────────────────────────────────
export { RunGradeAssigner } from './RunGradeAssigner';
export type {
  RunGradeScoreResult,
  RunGradeComponentBreakdown,
} from './RunGradeAssigner';
export type { SovereigntyGrade as RunGradeAssignerGrade } from './RunGradeAssigner';

// ── Snapshot Adapter ─────────────────────────────────────────────────────────
export { SovereigntySnapshotAdapter } from './SovereigntySnapshotAdapter';

// ── Export Adapter ───────────────────────────────────────────────────────────
export { SovereigntyExportAdapter } from './SovereigntyExportAdapter';

// ── Exporter ─────────────────────────────────────────────────────────────────
export { SovereigntyExporter } from './SovereigntyExporter';

// ── Persistence Writer ───────────────────────────────────────────────────────
export { SovereigntyPersistenceWriter } from './SovereigntyPersistenceWriter';

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
