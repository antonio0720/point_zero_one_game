/**
 * FILE: pzo-web/src/ml/index.ts
 * Point Zero One · Density6 LLC · Confidential
 *
 * ML module barrel — single import point for all 15 ML upgrades.
 *
 * Usage:
 *   import { KnowledgeTracer, HaterBotController } from '../ml';
 *
 * Architecture summary:
 *   #1  PlayerModelEngine         — real-time intelligence bars from run state
 *   #2  KnowledgeTracer           — BKT mastery per financial principle
 *   #3  HaterBotController        — RL-constrained adversarial bot behavior
 *   #4  PhantomGhostEngine        — imitation learning + legend style clusters
 *   #5  DivergenceEngine          — 3-cause forensic ghost gap verdict
 *   #6  TrustSimulator            — GNN-lite Syndicate trust + defection model
 *   #7  BehavioralAnomalyDetector — ML ensemble anti-cheat (replaces heuristics)
 *   #8  ModelProofChain           — ModelPackHash bound into run proof bundle
 *   #9  CoachModel                — deterministic cinematic run journal
 *   #10 CardRecommender           — contextual bandit, advisory only
 *   #11 CounterfactualSimulator   — 3 alternate timeline branch analysis
 *   #12 WindowMasteryTracker      — per-window-type mastery prestige stat
 *   #13 RunEmbedder               — 12-dim skill signature + matchmaking
 *   #14 TagWeightOptimizer        — Bayesian tag weight tuning, season-locked
 *   #15 VerifiedRunIndex          — mastery search engine over VERIFIED runs
 */

// ── #1 Player Model Engine ────────────────────────────────────────────────────
export { computeIntelligence } from './PlayerModelEngine';
export type { RunSnapshot, IntelligenceOutput } from './PlayerModelEngine';

// ── #2 Knowledge Tracer ───────────────────────────────────────────────────────
export { KnowledgeTracer } from './KnowledgeTracer';
export type {
  KnowledgeTag,
  KnowledgeState,
  PlayOutcome,
  TrainingRecommendation,
} from './KnowledgeTracer';

// ── #3 Hater Bot Controller ───────────────────────────────────────────────────
export { HaterBotController } from './HaterBotController';
export type { BotAction, BotDecision, BotConstraints } from './HaterBotController';

// ── #4 Phantom Ghost Engine ───────────────────────────────────────────────────
export { LEGEND_STYLES, generateGhostTrajectory, matchLegendStyle } from './PhantomGhostEngine';
export type {
  LegendStyleId,
  LegendStyle,
  GhostCheckpoint,
  GhostTrajectory,
} from './PhantomGhostEngine';

// ── #5 Divergence Engine ──────────────────────────────────────────────────────
export { computeDivergence } from './DivergenceEngine';
export type {
  DivergenceInput,
  DivergenceCause,
  DivergenceVerdict,
  PlayerCheckpoint,
} from './DivergenceEngine';

// ── #6 Trust Simulator ────────────────────────────────────────────────────────
export { TrustSimulator } from './TrustSimulator';
export type {
  InteractionType,
  TeamInteraction,
  PlayerTrustNode,
  TrustAuditEntry,
  TrustAudit,
} from './TrustSimulator';

// ── #7 Behavioral Anomaly Detector ────────────────────────────────────────────
export { BehavioralAnomalyDetector } from './BehavioralAnomalyDetector';
export type { AnomalyReport, AnomalyFlag } from './BehavioralAnomalyDetector';

// ── #8 Model Proof Chain ──────────────────────────────────────────────────────
export {
  buildModelPackHash,
  buildBundleHash,
  createModelProofBundle,
  SEASON0_MODEL_PACKS,
} from './ModelProofChain';
export type { ModelRole, ModelPack, ModelProofBundle } from './ModelProofChain';

// ── #9 Coach Model ────────────────────────────────────────────────────────────
export { generateRunJournal } from './CoachModel';
export type { RunJournalInput, RunJournal } from './CoachModel';

// ── #10 Card Recommender ──────────────────────────────────────────────────────
export { CardRecommender } from './CardRecommender';
export type { TimingClass, CardContext, CardOption, Recommendation } from './CardRecommender';

// ── #11 Counterfactual Simulator ──────────────────────────────────────────────
// NOTE: explicit extension fixes TS2307 in edge-resolution cases.
export { computeCounterfactuals } from './CounterfactualSimulator.ts';
export type { RunStateAtBranch, BranchScenario, CounterfactualReport } from './CounterfactualSimulator.ts';

// ── #12 Window Mastery Tracker ────────────────────────────────────────────────
export { WindowMasteryTracker } from './WindowMasteryTracker';
export type { WindowType, WindowResult, WindowMastery } from './WindowMasteryTracker';

// ── #13 Run Embedder ──────────────────────────────────────────────────────────
export { computeRunEmbedding, cosineSimilarity, findClosestRivals } from './RunEmbedder';
export type { RunEmbeddingInput, SkillSignature, SkillDimension, DimName } from './RunEmbedder';

// ── #14 Tag Weight Optimizer ──────────────────────────────────────────────────
export { TagWeightOptimizer, buildWeightsHash, buildSeason0LockedWeights } from './TagWeightOptimizer';
export type {
  OptimizationObjective,
  TagWeightConfig,
  ModeTagWeights,
  WeightUpdateSignal,
} from './TagWeightOptimizer';

// ── #15 Verified Run Index ────────────────────────────────────────────────────
export { VerifiedRunIndex, buildEntryHash } from './VerifiedRunIndex';
export type {
  VerifiedRunRecord,
  RunSearchQuery,
  RunSearchResult,
  IndexStats,
} from './VerifiedRunIndex';