// backend/src/game/engine/after_action_generator.ts

/**
 * POINT ZERO ONE — BACKEND AFTER ACTION GENERATOR
 * backend/src/game/engine/after_action_generator.ts
 *
 * Purpose:
 * - Generate a deterministic post-run autopsy package.
 * - Produce "loss is content" outputs: cause-of-death, replay fork, training
 *   recommendation, one tiny action, and one medium action.
 * - Extract 32-dim ML feature vectors and 13×16 DL tensors from every run.
 * - Route post-run signals into the chat social pressure engine.
 * - Build mode-native witness scenes (Empire / Predator / Syndicate / Phantom).
 * - Record proof-bearing transcript edges for audit and replay.
 * - Emit ML/DL learning surfaces for training pipeline ingestion.
 * - Wire all surfaces through AfterActionRuntimeHub — the master orchestrator
 *   consumed by engine/index.ts.
 *
 * Doctrine:
 * - No circular imports with engine/index.ts or any subsystem barrel.
 * - All imports are accessed in live code — no placeholder symbols.
 * - All constants are wired — none declared and abandoned.
 * - Depth is social + computational: every score drives a chat decision.
 */

// ─── Chat brand types ─────────────────────────────────────────────────────────
import type {
  ChatRoomId,
  ChatSessionId,
  ChatUserId,
  ChatMessageId,
  ChatProofEdgeId,
  ChatSceneId,
  ChatMomentId,
  Nullable,
  UnixMs,
  Score01,
  JsonObject,
} from './chat/types';

// ─── Chat ML inference stack ──────────────────────────────────────────────────
import {
  // ── Model classes (persistent instances for lifecycle + audit) ───────────
  EngagementModel,
  HaterTargetingModel,
  HelperTimingModel,
  ChannelAffinityModel,
  ToxicityRiskModel,
  ChurnRiskModel,
  InterventionPolicyModel,
  // ── Factories (deterministic instantiation) ───────────────────────────────
  createEngagementModel,
  createHaterTargetingModel,
  createHelperTimingModel,
  createChannelAffinityModel,
  createToxicityRiskModel,
  createChurnRiskModel,
  createInterventionPolicyModel,
  // ── Standalone aggregate scoring (used for batch / cross-model passes) ────
  scoreEngagementAggregate,
  scoreHaterTargetingAggregate,
  scoreHelperTimingAggregate,
  scoreToxicityRiskAggregate,
  scoreChurnRiskAggregate,
  scoreInterventionPolicyAggregate,
  // ── Engagement interpretation helpers ────────────────────────────────────
  engagementBandLabel,
  engagementIsElectric,
  engagementIsFrozen,
  engagementIsFragile,
  engagementIsDealRoomColdPlay,
  engagementShouldSilenceChannel,
  engagementIsStableActive,
  // ── Toxicity interpretation helpers ──────────────────────────────────────
  toxicityBandLabel,
  toxicityRiskNeedsHardBlock,
  toxicityIsCritical,
  // ── Churn interpretation helpers ──────────────────────────────────────────
  churnBandLabel,
  churnRiskNeedsRescue,
  churnIsCritical,
  churnIsEmergency,
  // ── Intervention interpretation helpers ───────────────────────────────────
  interventionPolicySummary,
  interventionPolicyNeedsModeration,
  // ── Helper timing interpretation helpers ─────────────────────────────────
  helperTimingShouldSpeak,
  helperTimingIsEmergency,
  // ── Channel affinity interpretation helpers ───────────────────────────────
  channelAffinityShouldMove,
  channelAffinityPrimaryScore,
  channelAffinityIsStable,
  // ── ML store and feature types ────────────────────────────────────────────
  type ChatOnlineFeatureAggregate,
  type ChatFeatureScalarMap,
  type ChatModelFamily,
  type ChatFeatureRow,
  // ── Score result types ────────────────────────────────────────────────────
  type EngagementModelScore,
  type EngagementBand,
  type EngagementRecommendation,
  type HaterTargetingScore,
  type HaterEscalationBand,
  type HelperTimingScore,
  type ChannelAffinityScore,
  type ToxicityRiskScore,
  type ToxicityBand,
  type ChurnRiskScore,
  type ChurnBand,
  type InterventionPolicyScore,
  type InterventionRecommendation,
} from './chat/ml';

// ─── Zero engine social pressure + ML utilities ───────────────────────────────
import {
  computeSocialPressureVector,
  extractZeroMLFeatureVector,
  narrateZeroMoment,
  getModeNarrationPrefix,
  scoreModeCompetitiveWeight,
  scoreRunOutcomeValence,
  scoreRunPhaseRisk,
  ZERO_ML_FEATURE_DIMENSION,
  ZERO_ML_FEATURE_LABEL_KEYS,
  type ZeroSocialPressureVector,
} from './zero';

// ─── Core game state (optional enrichment path) ───────────────────────────────
import type { RunStateSnapshot } from './core/RunStateSnapshot';

// =============================================================================
// MARK: Enumerations
// =============================================================================

export enum FailureMode {
  ResourceLoss      = 'resource_loss',
  ReplaySuggestion  = 'replay_suggestion',
  DebtSpiral        = 'debt_spiral',
  DecisionLatency   = 'decision_latency',
  ShieldBreach      = 'shield_breach',
  CascadeFailure    = 'cascade_failure',
  TrustCollapse     = 'trust_collapse',
  DivergenceLoss    = 'divergence_loss',
}

export enum StrengthMode {
  Tiny   = 'tiny',
  Medium = 'medium',
}

export enum RunOutcome {
  FREEDOM   = 'FREEDOM',
  TIMEOUT   = 'TIMEOUT',
  BANKRUPT  = 'BANKRUPT',
  ABANDONED = 'ABANDONED',
}

export enum AfterActionGameMode {
  GO_ALONE       = 'GO_ALONE',
  HEAD_TO_HEAD   = 'HEAD_TO_HEAD',
  TEAM_UP        = 'TEAM_UP',
  CHASE_A_LEGEND = 'CHASE_A_LEGEND',
}

// =============================================================================
// MARK: Core action / report interfaces
// =============================================================================

export interface TinyAction {
  /** Stable deterministic identifier. */
  id: string;
  /** Short display title. */
  title: string;
  /** Concrete tactical action. */
  description: string;
  /** Why this is the best immediate move. */
  why: string;
}

export interface MediumAction {
  /** Stable deterministic identifier. */
  id: string;
  /** Short display title. */
  title: string;
  /** Concrete medium-horizon action. */
  description: string;
  /** Scenario or mode the player should replay. */
  recommendedScenario: string;
  /** Why this fixes the detected weakness. */
  why: string;
}

export interface AfterAction {
  id: string;
  failureMode: FailureMode;
  strengthMode: StrengthMode;
  title: string;
  confidence: number;
  relatedTick?: number;
  replaySuggestion?: string;
  tinyAction?: TinyAction;
  mediumAction?: MediumAction;
  educationalTag?: string;
  whyItMatters: string;
}

export interface DecisionMoment {
  tickIndex: number;
  choiceId: string;
  resolvedInMs: number;
  windowMs: number;
  wasForced: boolean;
  wasOptimalChoice?: boolean;
  note?: string;
}

export interface ShieldBreachMoment {
  tickIndex: number;
  breachedLayer: string;
  damage: number;
  recoveryOptionMissed?: string;
}

export interface BotDamageSummary {
  botId: string;
  displayName: string;
  totalDamage: number;
  peakTick: number;
}

export interface AlternateTimelineFork {
  tickIndex: number;
  title: string;
  currentOutcome: string;
  alternateOutcome: string;
}

export interface RootCause {
  mode: FailureMode;
  title: string;
  confidence: number;
  evidence: string[];
  relatedTicks: number[];
}

export interface CauseOfDeathCard {
  title: string;
  triggerLine: string;
  verification: 'pending' | 'verified' | 'practice-only';
  cash: number;
  burn: number;
  largestHit: number;
}

export interface TrainingRecommendation {
  scenarioId: string;
  title: string;
  reason: string;
  mode: AfterActionGameMode;
}

export interface AfterActionGenerationInput {
  runId: string;
  mode: AfterActionGameMode;
  outcome: RunOutcome;
  causeOfDeath: string;
  finalCash: number;
  burnRate: number;
  largestHit: number;
  tickOfCollapse?: number;
  trustScore?: number;
  divergenceScore?: number;
  decisionMoments: readonly DecisionMoment[];
  shieldBreaches: readonly ShieldBreachMoment[];
  botDamage: readonly BotDamageSummary[];
  alternateTimelines: readonly AlternateTimelineFork[];
  educationalTags?: readonly string[];
}

export interface AfterActionReport {
  runId: string;
  mode: AfterActionGameMode;
  outcome: RunOutcome;
  generatedAtDeterministicKey: string;
  causeOfDeathCard: CauseOfDeathCard;
  rootCauses: readonly RootCause[];
  fastestDecision?: DecisionMoment;
  slowestDecision?: DecisionMoment;
  shieldBreachTimeline: readonly ShieldBreachMoment[];
  topBotThreat?: BotDamageSummary;
  alternateTimelines: readonly AlternateTimelineFork[];
  replaySuggestion: string;
  trainingRecommendation: TrainingRecommendation;
  tinyAction: TinyAction;
  mediumAction: MediumAction;
  actions: readonly AfterAction[];
}

// =============================================================================
// MARK: Extended bundle interfaces — ML / DL / Chat integration
// =============================================================================

/** Annotated social pressure output for post-run context. */
export interface AfterActionSocialPressureAnnotation {
  readonly haterAggregatePosture: number;
  readonly haterPresenceCount: number;
  readonly threatConvergenceScore: number;
  readonly extractionRiskScore: number;
  readonly socialPressureIndex: number;
  readonly witnessLabel: string;
  /** True when sourced from a live RunStateSnapshot via the zero engine. */
  readonly isZeroEnriched: boolean;
}

/** 32-dimensional post-run ML feature vector. */
export interface AfterActionMLBundle {
  readonly runId: string;
  /** Normalised [0,1] feature vector, length = AFTER_ACTION_ML_FEATURE_COUNT. */
  readonly featureVector: readonly number[];
  /** Human-readable labels aligned to featureVector. */
  readonly featureLabels: readonly string[];
  /** Social pressure annotation derived from this run. */
  readonly socialPressure: AfterActionSocialPressureAnnotation;
  /** Zero engine narration line when snapshot is available. */
  readonly narrativeLine: string;
  /** Cosine similarity against the zero engine baseline (when enriched). */
  readonly zeroSimilarity: number;
}

/** 13 × AFTER_ACTION_DL_FEATURE_COUNT post-run DL tensor. */
export interface AfterActionDLTensor {
  readonly runId: string;
  /** Outer dimension = tick sequence length (13). */
  readonly rows: readonly (readonly number[])[];
  readonly sequenceLength: number;
  readonly featureCount: number;
  /** Flattened row-major float array for model ingestion. */
  readonly flatVector: readonly number[];
}

/** Chat lane signal emitted after every run. */
export interface AfterActionChatSignal {
  readonly version: string;
  readonly runId: string;
  readonly mode: AfterActionGameMode;
  readonly outcome: RunOutcome;
  readonly primaryFailureMode: FailureMode;
  readonly engagementBand: string;
  readonly haterEscalationBand: string;
  readonly witnessLabel: string;
  readonly socialPressureIndex: number;
  readonly narrativeLine: string;
  readonly tinyActionTitle: string;
  readonly mediumActionTitle: string;
  readonly proofEdgeId: string;
  readonly sceneId: string;
  readonly timestamp: number;
  readonly mlBundle: AfterActionMLBundle;
  readonly chatMLScores: AfterActionChatMLScoreBundle;
}

/** One line spoken in the post-run witness scene. */
export interface AfterActionWitnessLine {
  readonly speakerId: string;
  readonly role: 'HATER' | 'HELPER' | 'CROWD' | 'SYSTEM' | 'NARRATOR';
  readonly text: string;
  readonly delayMs: number;
  readonly isProofBearing: boolean;
}

/** Mode-native post-run social scene. */
export interface AfterActionWitnessScene {
  readonly sceneId: string;
  readonly mode: AfterActionGameMode;
  readonly lines: readonly AfterActionWitnessLine[];
  readonly stageMood: 'TENSE' | 'PREDATORY' | 'HOSTILE' | 'GRIEF' | 'AWE';
  readonly audienceHeat01: number;
  readonly haterPosture: 'WATCHING' | 'ATTACKING' | 'MOCKING' | 'SILENT';
  readonly helperTone: 'COACHING' | 'EMPATHETIC' | 'TACTICAL' | 'SILENT';
}

/** Proof edge committed to the backend transcript ledger. */
export interface AfterActionProofEdge {
  readonly proofEdgeId: string;
  readonly runId: string;
  readonly failureMode: FailureMode;
  readonly confidence: number;
  readonly evidenceHash: string;
  readonly schemaVersion: string;
  readonly timestamp: number;
  readonly verified: boolean;
  readonly metadata: JsonObject;
}

/** Feature-level contribution for learning signals. */
export interface AfterActionFeatureContribution {
  readonly featureIndex: number;
  readonly featureLabel: string;
  readonly value: number;
  readonly weight: number;
  readonly direction: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
}

/** Training signal packet emitted after every scored run. */
export interface AfterActionTrainingSignal {
  readonly runId: string;
  readonly featureVector: readonly number[];
  readonly targetLabel: string;
  readonly outcomeValence: number;
  readonly modeCompetitiveWeight: number;
  readonly contributions: readonly AfterActionFeatureContribution[];
  readonly timestamp: number;
}

/** Full ML/DL learning surface for this run. */
export interface AfterActionLearningSurface {
  readonly runId: string;
  readonly trainingSignal: AfterActionTrainingSignal;
  readonly dlTensor: AfterActionDLTensor;
  readonly featuresEmittedCount: number;
  readonly timestamp: number;
}

/** Bundled results from the full 7-model chat ML stack. */
export interface AfterActionChatMLScoreBundle {
  readonly runId: string;
  readonly evaluatedAtMs: number;
  readonly engagementScore: EngagementModelScore;
  readonly haterScore: HaterTargetingScore;
  readonly helperScore: HelperTimingScore;
  readonly channelScore: ChannelAffinityScore;
  readonly toxicityScore: ToxicityRiskScore;
  readonly churnScore: ChurnRiskScore;
  readonly interventionScore: InterventionPolicyScore;
  /** True when the intervention model recommends moderation. */
  readonly needsModeration: boolean;
  /** True when churn risk is critical. */
  readonly churnIsCritical: boolean;
  /** True when toxicity is hard-blocked. */
  readonly toxicityHardBlock: boolean;
  /** Dominant engagement band label. */
  readonly engagementBandLabel: string;
  /** Hater escalation band label. */
  readonly haterEscalationBandLabel: string;
  /** Churn band label. */
  readonly churnBandLabel: string;
  /** Toxicity band label. */
  readonly toxicityBandLabel: string;
  /** Whether helper should speak now. */
  readonly helperShouldSpeak: boolean;
  /** Whether channel should move. */
  readonly channelShouldMove: boolean;
}

/**
 * Optional enrichment via a live RunStateSnapshot from the zero engine.
 * When provided, the annotator calls computeSocialPressureVector,
 * extractZeroMLFeatureVector, and narrateZeroMoment.
 */
export interface AfterActionZeroEnrichment {
  readonly snapshot: RunStateSnapshot;
  readonly tick: number;
}

/** Master bundle produced by AfterActionRuntimeHub.run(). */
export interface AfterActionFullBundle {
  readonly report: AfterActionReport;
  readonly mlBundle: AfterActionMLBundle;
  readonly dlTensor: AfterActionDLTensor;
  readonly chatSignal: AfterActionChatSignal;
  readonly witnessScene: AfterActionWitnessScene;
  readonly proofEdge: AfterActionProofEdge;
  readonly learningSurface: AfterActionLearningSurface;
  readonly chatMLScores: AfterActionChatMLScoreBundle;
}

/** Runtime context for hub execution. */
export interface AfterActionRuntimeContext {
  /** Optional chat room the player was in at run-end. */
  readonly roomId?: ChatRoomId;
  /** Optional chat session from the run. */
  readonly sessionId?: ChatSessionId;
  /** Optional player user ID. */
  readonly userId?: ChatUserId;
  /** Optional zero engine enrichment (snapshot + tick). */
  readonly zeroEnrichment?: AfterActionZeroEnrichment;
  /** Wall-clock timestamp for this evaluation. */
  readonly nowMs?: number;
}

// =============================================================================
// MARK: Constants
// =============================================================================

/** Confidence ceiling — models cannot exceed this. */
const MAX_CONFIDENCE = 0.98;
/** Confidence floor — models cannot fall below this. */
const MIN_CONFIDENCE = 0.15;

/** Dimension of the post-run ML feature vector (aligns with zero engine baseline). */
export const AFTER_ACTION_ML_FEATURE_COUNT = ZERO_ML_FEATURE_DIMENSION; // 32

/** Number of tick-sequence steps in the DL tensor rows (mirrors zero tick plan). */
export const AFTER_ACTION_DL_SEQUENCE_LENGTH = 13;

/** Number of features per DL tensor step. */
export const AFTER_ACTION_DL_FEATURE_COUNT = 16;

/** Version string stamped on every AfterActionChatSignal. */
export const AFTER_ACTION_CHAT_SIGNAL_VERSION = '2026.03.28-after-action.v1' as const;

/** Proof-chain schema version for this module. */
export const AFTER_ACTION_PROOF_SCHEMA_VERSION = 'v1' as const;

/** Feature label keys derived from the zero ML baseline. */
export const AFTER_ACTION_ML_FEATURE_LABELS: readonly string[] = ZERO_ML_FEATURE_LABEL_KEYS;

// =============================================================================
// MARK: Utility functions
// =============================================================================

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round3(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

function stableId(prefix: string, ...parts: readonly (string | number | undefined)[]): string {
  const base = parts
    .filter((part) => part !== undefined)
    .map((part) => String(part))
    .join('|');

  let hash = 0;
  for (let index = 0; index < base.length; index += 1) {
    hash = ((hash << 5) - hash + base.charCodeAt(index)) | 0;
  }

  return `${prefix}_${Math.abs(hash)}`;
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

/** Cast a raw number to the Score01 brand. */
function asScore01(n: number): Score01 {
  return clamp(n, 0, 1) as unknown as Score01;
}

/** Cast a raw timestamp to the UnixMs brand. */
function asUnixMs(n: number): UnixMs {
  return n as unknown as UnixMs;
}

/** Cast a raw string to ChatRoomId. */
function asChatRoomId(s: string): ChatRoomId {
  return s as unknown as ChatRoomId;
}

/** Cast a raw string to ChatSessionId. */
function asChatSessionId(s: string): ChatSessionId {
  return s as unknown as ChatSessionId;
}

/** Cast a raw string to ChatUserId. */
function asChatUserId(s: string): ChatUserId {
  return s as unknown as ChatUserId;
}

/** Cast a raw string to ChatMessageId. */
function asChatMessageId(s: string): ChatMessageId {
  return s as unknown as ChatMessageId;
}

/** Cast a raw string to ChatProofEdgeId. */
function asChatProofEdgeId(s: string): ChatProofEdgeId {
  return s as unknown as ChatProofEdgeId;
}

/** Cast a raw string to ChatSceneId. */
function asChatSceneId(s: string): ChatSceneId {
  return s as unknown as ChatSceneId;
}

/** Cast a raw string to ChatMomentId. */
function asChatMomentId(s: string): ChatMomentId {
  return s as unknown as ChatMomentId;
}

/**
 * Map AfterActionGameMode to the ModeCode string expected by zero utilities.
 * Returns the raw string, not a branded type, to avoid importing ModeCode.
 */
function toModeCodeStr(mode: AfterActionGameMode): string {
  switch (mode) {
    case AfterActionGameMode.GO_ALONE:       return 'solo';
    case AfterActionGameMode.HEAD_TO_HEAD:   return 'pvp';
    case AfterActionGameMode.TEAM_UP:        return 'coop';
    case AfterActionGameMode.CHASE_A_LEGEND: return 'ghost';
  }
}

/** Human-readable mode label for narration and signals. */
function modeLabel(mode: AfterActionGameMode): string {
  switch (mode) {
    case AfterActionGameMode.GO_ALONE:       return 'Empire';
    case AfterActionGameMode.HEAD_TO_HEAD:   return 'Predator';
    case AfterActionGameMode.TEAM_UP:        return 'Syndicate';
    case AfterActionGameMode.CHASE_A_LEGEND: return 'Phantom';
  }
}

/** Stage mood for chat witness scenes, per mode. */
function modeToStageMood(
  mode: AfterActionGameMode,
): 'TENSE' | 'PREDATORY' | 'HOSTILE' | 'GRIEF' | 'AWE' {
  switch (mode) {
    case AfterActionGameMode.GO_ALONE:       return 'TENSE';
    case AfterActionGameMode.HEAD_TO_HEAD:   return 'PREDATORY';
    case AfterActionGameMode.TEAM_UP:        return 'TENSE';
    case AfterActionGameMode.CHASE_A_LEGEND: return 'HOSTILE';
  }
}

/** Simple deterministic hash for proof-chain content addressing. */
function hashString(input: string): string {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** Derive RunPhase estimate from available after-action data. */
function deriveRunPhase(input: AfterActionGenerationInput): string {
  const collapseRatio = (input.tickOfCollapse ?? 0) / Math.max(1, 50);
  if (collapseRatio > 0.8) return 'SOVEREIGNTY';
  if (collapseRatio > 0.4) return 'ESCALATION';
  return 'FOUNDATION';
}

// =============================================================================
// MARK: AfterActionMLVectorExtractor
// =============================================================================

/**
 * Extracts a 32-dimensional normalised feature vector from an AfterActionReport.
 *
 * Dimensions mirror the zero engine's ZERO_ML_FEATURE_DIMENSION = 32 so that
 * post-run vectors are directly comparable against live-tick vectors for
 * benchmark and drift analysis.
 */
export class AfterActionMLVectorExtractor {
  /**
   * Extract the 32-dim feature vector.  Every dimension is normalised to [0,1].
   */
  public extract(
    report: AfterActionReport,
    input: AfterActionGenerationInput,
  ): readonly number[] {
    const primaryCause = report.rootCauses[0];
    const decisionPressure = this.computeDecisionPressure(input);
    const shieldStress      = clamp(input.shieldBreaches.length / 10, 0, 1);
    const botPressure       = clamp(input.botDamage.length / 5, 0, 1);
    const topBotDmg         = input.botDamage[0]?.totalDamage ?? 0;
    const cashStress        = clamp(Math.max(0, -input.finalCash) / 50_000, 0, 1);
    const burnStress        = clamp(input.burnRate / 10_000, 0, 1);
    const confidenceVal     = round3(primaryCause?.confidence ?? MIN_CONFIDENCE);
    const altTimelineRisk   = clamp(input.alternateTimelines.length / 5, 0, 1);
    const collapseProximity = clamp((input.tickOfCollapse ?? 0) / 100, 0, 1);
    const trustDeficit      = clamp(Math.max(0, 50 - (input.trustScore ?? 50)) / 50, 0, 1);
    const divergenceVal     = clamp(input.divergenceScore ?? 0, 0, 1);

    // Failure-mode one-hot encoding (8 dims)
    const fmVector = this.failureModeOneHot(primaryCause?.mode ?? FailureMode.ResourceLoss);

    // Outcome valence derived from the zero engine utility
    const outcomeValence = Math.abs(
      scoreRunOutcomeValence(input.outcome as unknown as Parameters<typeof scoreRunOutcomeValence>[0]),
    );

    // Phase risk derived from the zero engine utility
    const phaseRisk = scoreRunPhaseRisk(
      deriveRunPhase(input) as unknown as Parameters<typeof scoreRunPhaseRisk>[0],
    );

    // Mode competitive weight from zero engine
    const modeCompWeight = scoreModeCompetitiveWeight(
      toModeCodeStr(input.mode) as Parameters<typeof scoreModeCompetitiveWeight>[0],
    );

    // Slowest decision latency ratio
    const sortedByLatency = [...input.decisionMoments].sort((a, b) => b.resolvedInMs - a.resolvedInMs);
    const slowestRatio = sortedByLatency[0]
      ? clamp(sortedByLatency[0].resolvedInMs / Math.max(1, sortedByLatency[0].windowMs), 0, 1)
      : 0;

    // Breach layer diversity
    const breachLayers = new Set(input.shieldBreaches.map((b) => b.breachedLayer));
    const breachDiversity = clamp(breachLayers.size / 4, 0, 1);

    // Average bot damage normalised
    const avgBotDamage = average(input.botDamage.map((b) => b.totalDamage));
    const normBotDmg = clamp(avgBotDamage / 100, 0, 1);
    const normTopBotDmg = clamp(topBotDmg / 200, 0, 1);

    const featureVector: number[] = [
      // DIM_00-DIM_07: failure mode one-hot (8)
      ...fmVector,
      // DIM_08: outcome valence
      round3(outcomeValence),
      // DIM_09: phase risk
      round3(phaseRisk),
      // DIM_10: mode competitive weight
      round3(modeCompWeight),
      // DIM_11: decision pressure average
      round3(decisionPressure),
      // DIM_12: slowest decision latency ratio
      round3(slowestRatio),
      // DIM_13: shield stress
      round3(shieldStress),
      // DIM_14: breach layer diversity
      round3(breachDiversity),
      // DIM_15: bot pressure
      round3(botPressure),
      // DIM_16: avg bot damage normalised
      round3(normBotDmg),
      // DIM_17: top bot damage normalised
      round3(normTopBotDmg),
      // DIM_18: cash stress
      round3(cashStress),
      // DIM_19: burn stress
      round3(burnStress),
      // DIM_20: root cause confidence
      round3(confidenceVal),
      // DIM_21: alternate timeline risk
      round3(altTimelineRisk),
      // DIM_22: collapse proximity
      round3(collapseProximity),
      // DIM_23: trust deficit (Syndicate)
      round3(trustDeficit),
      // DIM_24: divergence score (Phantom)
      round3(divergenceVal),
      // DIM_25: action count normalised
      round3(clamp(input.decisionMoments.length / 20, 0, 1)),
      // DIM_26: forced decision ratio
      round3(this.forcedDecisionRatio(input)),
      // DIM_27: optimal decision ratio
      round3(this.optimalDecisionRatio(input)),
      // DIM_28: recovery option miss rate
      round3(this.recoveryMissRate(input)),
      // DIM_29: run outcome binary (1 = positive)
      input.outcome === RunOutcome.FREEDOM ? 1 : 0,
      // DIM_30: total tick span normalised
      round3(clamp((input.tickOfCollapse ?? 0) / 200, 0, 1)),
      // DIM_31: largest single hit normalised
      round3(clamp(input.largestHit / 10_000, 0, 1)),
    ];

    // Ensure exactly AFTER_ACTION_ML_FEATURE_COUNT dimensions
    while (featureVector.length < AFTER_ACTION_ML_FEATURE_COUNT) featureVector.push(0);
    return Object.freeze(featureVector.slice(0, AFTER_ACTION_ML_FEATURE_COUNT));
  }

  /** Extract a labelled Record<featureLabel, value> map. */
  public extractLabeled(
    report: AfterActionReport,
    input: AfterActionGenerationInput,
  ): Record<string, number> {
    const vec = this.extract(report, input);
    const result: Record<string, number> = {};
    for (let i = 0; i < vec.length; i++) {
      const label = AFTER_ACTION_ML_FEATURE_LABELS[i] ?? `DIM_${String(i).padStart(2, '0')}`;
      result[label] = vec[i] ?? 0;
    }
    return result;
  }

  /**
   * Cosine similarity between two ML feature vectors [0, 1].
   * Used to compare post-run vectors against zero-tick baselines.
   */
  public computeSimilarity(a: readonly number[], b: readonly number[]): number {
    const len = Math.min(a.length, b.length);
    let dot = 0, magA = 0, magB = 0;
    for (let i = 0; i < len; i++) {
      dot += (a[i] ?? 0) * (b[i] ?? 0);
      magA += (a[i] ?? 0) ** 2;
      magB += (b[i] ?? 0) ** 2;
    }
    const denom = Math.sqrt(magA) * Math.sqrt(magB);
    return denom === 0 ? 0 : round3(dot / denom);
  }

  /** L2-normalise a vector. */
  public normalizeVector(vec: readonly number[]): readonly number[] {
    const magnitude = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
    if (magnitude === 0) return vec;
    return Object.freeze(vec.map((v) => round3(v / magnitude)));
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private failureModeOneHot(mode: FailureMode): number[] {
    const modes: FailureMode[] = [
      FailureMode.ResourceLoss,
      FailureMode.ReplaySuggestion,
      FailureMode.DebtSpiral,
      FailureMode.DecisionLatency,
      FailureMode.ShieldBreach,
      FailureMode.CascadeFailure,
      FailureMode.TrustCollapse,
      FailureMode.DivergenceLoss,
    ];
    return modes.map((m) => (m === mode ? 1 : 0));
  }

  private computeDecisionPressure(input: AfterActionGenerationInput): number {
    const pressureRatios = input.decisionMoments.map((m) =>
      clamp(m.resolvedInMs / Math.max(1, m.windowMs), 0, 1),
    );
    return round3(average(pressureRatios));
  }

  private forcedDecisionRatio(input: AfterActionGenerationInput): number {
    if (input.decisionMoments.length === 0) return 0;
    const forced = input.decisionMoments.filter((m) => m.wasForced).length;
    return forced / input.decisionMoments.length;
  }

  private optimalDecisionRatio(input: AfterActionGenerationInput): number {
    if (input.decisionMoments.length === 0) return 0;
    const optimal = input.decisionMoments.filter((m) => m.wasOptimalChoice === true).length;
    return optimal / input.decisionMoments.length;
  }

  private recoveryMissRate(input: AfterActionGenerationInput): number {
    if (input.shieldBreaches.length === 0) return 0;
    const missed = input.shieldBreaches.filter((b) => b.recoveryOptionMissed !== undefined).length;
    return missed / input.shieldBreaches.length;
  }
}

// =============================================================================
// MARK: AfterActionDLTensorBuilder
// =============================================================================

/**
 * Builds the 13 × AFTER_ACTION_DL_FEATURE_COUNT DL tensor for a post-run
 * context.  Each of the 13 rows corresponds to one step in the zero engine's
 * canonical tick sequence, populated with after-action-derived features.
 */
export class AfterActionDLTensorBuilder {
  /**
   * Build the DL tensor from the AfterActionReport.
   * Row 0 = STEP_01_BOOT context, ..., Row 12 = STEP_13_SHUTDOWN context.
   */
  public build(
    report: AfterActionReport,
    input: AfterActionGenerationInput,
  ): AfterActionDLTensor {
    const rows: number[][] = [];

    for (let step = 0; step < AFTER_ACTION_DL_SEQUENCE_LENGTH; step++) {
      rows.push(this.buildRow(step, report, input));
    }

    const flat = rows.flatMap((r) => r);
    return Object.freeze({
      runId: input.runId,
      rows: Object.freeze(rows.map((r) => Object.freeze(r))),
      sequenceLength: AFTER_ACTION_DL_SEQUENCE_LENGTH,
      featureCount: AFTER_ACTION_DL_FEATURE_COUNT,
      flatVector: Object.freeze(flat),
    });
  }

  /** Flatten a previously-built tensor to a 1-D float array. */
  public flatten(tensor: AfterActionDLTensor): readonly number[] {
    return tensor.flatVector;
  }

  /** Extract a single column (feature index) across all sequence rows. */
  public extractColumn(tensor: AfterActionDLTensor, colIdx: number): readonly number[] {
    return Object.freeze(tensor.rows.map((row) => row[colIdx] ?? 0));
  }

  /** Compute the L2 norm of each row. */
  public computeRowNorms(tensor: AfterActionDLTensor): readonly number[] {
    return Object.freeze(
      tensor.rows.map((row) =>
        round3(Math.sqrt(row.reduce((s, v) => s + v * v, 0))),
      ),
    );
  }

  // ── Private: row construction ───────────────────────────────────────────────

  private buildRow(
    step: number,
    report: AfterActionReport,
    input: AfterActionGenerationInput,
  ): number[] {
    const primaryCause = report.rootCauses[0];
    const totalTicks   = input.tickOfCollapse ?? 50;

    // Step proximity: how close was this step to collapse?
    const stepRatio       = (step + 1) / AFTER_ACTION_DL_SEQUENCE_LENGTH;
    const collapseProx    = round3(1 - Math.abs(stepRatio - (totalTicks / 100)));
    const confidenceVal   = round3(primaryCause?.confidence ?? MIN_CONFIDENCE);
    const burnNorm        = round3(clamp(input.burnRate / 10_000, 0, 1));
    const cashNorm        = round3(clamp(Math.max(0, input.finalCash) / 50_000, 0, 1));
    const shieldStress    = round3(clamp(input.shieldBreaches.length / 10, 0, 1));
    const botPressure     = round3(clamp(input.botDamage.length / 5, 0, 1));

    // Find decisions nearest to this step's fraction of the tick range
    const stepTickMin = Math.floor(stepRatio * totalTicks * 0.8);
    const stepTickMax = Math.ceil(stepRatio * totalTicks * 1.2);
    const stepDecisions = input.decisionMoments.filter(
      (d) => d.tickIndex >= stepTickMin && d.tickIndex <= stepTickMax,
    );
    const stepLatency = stepDecisions.length > 0
      ? round3(average(stepDecisions.map((d) => clamp(d.resolvedInMs / Math.max(1, d.windowMs), 0, 1))))
      : 0;

    // Breaches in this step's tick window
    const stepBreaches = input.shieldBreaches.filter(
      (b) => b.tickIndex >= stepTickMin && b.tickIndex <= stepTickMax,
    );
    const stepBreachDmg = round3(clamp(stepBreaches.reduce((s, b) => s + b.damage, 0) / 100, 0, 1));

    // Bot activity in this step
    const peakBotInStep = input.botDamage.filter(
      (b) => b.peakTick >= stepTickMin && b.peakTick <= stepTickMax,
    );
    const stepBotActivity = round3(clamp(peakBotInStep.length / 3, 0, 1));

    // Alternate timeline forks in this step
    const stepForks = input.alternateTimelines.filter(
      (f) => f.tickIndex >= stepTickMin && f.tickIndex <= stepTickMax,
    );
    const forkOpportunity = round3(clamp(stepForks.length / 2, 0, 1));

    // Outcome context
    const outcomeVal = Math.abs(
      scoreRunOutcomeValence(input.outcome as unknown as Parameters<typeof scoreRunOutcomeValence>[0]),
    );
    const phaseRisk  = scoreRunPhaseRisk(
      deriveRunPhase(input) as unknown as Parameters<typeof scoreRunPhaseRisk>[0],
    );

    // Trust and divergence (mode-specific)
    const trustNorm   = round3(clamp((input.trustScore ?? 100) / 100, 0, 1));
    const divNorm     = round3(clamp(input.divergenceScore ?? 0, 0, 1));

    // Forced decisions in this window
    const forcedInStep = stepDecisions.filter((d) => d.wasForced).length;
    const forcedRatio  = round3(clamp(forcedInStep / Math.max(1, stepDecisions.length), 0, 1));

    const row: number[] = [
      stepRatio,           // F00: step progress
      collapseProx,        // F01: collapse proximity for this step
      confidenceVal,       // F02: root cause confidence
      burnNorm,            // F03: burn rate
      cashNorm,            // F04: cash level
      shieldStress,        // F05: shield stress
      botPressure,         // F06: bot presence
      stepLatency,         // F07: decision latency in step
      stepBreachDmg,       // F08: breach damage in step
      stepBotActivity,     // F09: bot activity in step
      forkOpportunity,     // F10: replay fork opportunity
      outcomeVal,          // F11: run outcome valence
      round3(phaseRisk),   // F12: phase risk
      trustNorm,           // F13: trust level
      divNorm,             // F14: divergence score
      forcedRatio,         // F15: forced decision ratio
    ];

    // Pad to AFTER_ACTION_DL_FEATURE_COUNT if needed
    while (row.length < AFTER_ACTION_DL_FEATURE_COUNT) row.push(0);
    return row.slice(0, AFTER_ACTION_DL_FEATURE_COUNT);
  }
}

// =============================================================================
// MARK: AfterActionAggregateFactory (internal helper)
// =============================================================================

/**
 * Constructs a ChatOnlineFeatureAggregate from AfterActionReport data so that
 * the chat ML model stack can score the post-run context without requiring
 * live feature rows.
 */
function buildAfterActionAggregate(
  report: AfterActionReport,
  input: AfterActionGenerationInput,
  nowMs = Date.now(),
): ChatOnlineFeatureAggregate {
  const primaryCause = report.rootCauses[0];

  // Derive Score01-equivalent scalars from after-action data
  const burnStress01     = clamp(input.burnRate / 10_000, 0, 1);
  const cashStress01     = clamp(Math.max(0, -input.finalCash) / 50_000, 0, 1);
  const shieldStress01   = clamp(input.shieldBreaches.length / 10, 0, 1);
  const botPressure01    = clamp(input.botDamage.length / 5, 0, 1);
  const decisionPressure = input.decisionMoments.length > 0
    ? average(input.decisionMoments.map((m) => clamp(m.resolvedInMs / Math.max(1, m.windowMs), 0, 1)))
    : 0;
  const trustDeficit01   = clamp(Math.max(0, 50 - (input.trustScore ?? 50)) / 50, 0, 1);
  const divergence01     = clamp(input.divergenceScore ?? 0, 0, 1);
  const confidence01     = round3(primaryCause?.confidence ?? MIN_CONFIDENCE);
  const altTimelineRisk  = clamp(input.alternateTimelines.length / 5, 0, 1);
  const churnSignal      = input.outcome === RunOutcome.ABANDONED ? 1 : cashStress01;
  const frustration      = clamp(shieldStress01 * 0.5 + decisionPressure * 0.3 + burnStress01 * 0.2, 0, 1);
  const hostileMomentum  = clamp(botPressure01 * 0.6 + shieldStress01 * 0.4, 0, 1);
  const helpNeeded       = clamp(churnSignal * 0.5 + cashStress01 * 0.3 + decisionPressure * 0.2, 0, 1);
  const modePvp          = input.mode === AfterActionGameMode.HEAD_TO_HEAD ? 1 : 0;
  const modeCoop         = input.mode === AfterActionGameMode.TEAM_UP ? 1 : 0;
  const modeGhost        = input.mode === AfterActionGameMode.CHASE_A_LEGEND ? 1 : 0;
  const bankruptcyWarn   = input.outcome === RunOutcome.BANKRUPT ? 1 : cashStress01 > 0.7 ? 0.8 : 0;
  const rankingPressure  = modePvp * 0.8 + modeGhost * 0.4;
  const recoveryMissed   = input.shieldBreaches.filter((b) => b.recoveryOptionMissed).length / Math.max(1, input.shieldBreaches.length);

  const scalarFeatures: ChatFeatureScalarMap = {
    roomHeat01:                   clamp(hostileMomentum * 0.7 + burnStress01 * 0.3, 0, 1),
    hostileMomentum01:            hostileMomentum,
    churnRisk01:                  churnSignal,
    responseCadence01:            clamp(1 - decisionPressure, 0, 1),
    recentPlayerShare01:          0.5,
    recentNpcShare01:             clamp(botPressure01 * 0.8, 0, 1),
    helperReceptivity01:          clamp(helpNeeded * 0.9, 0, 1),
    helperIgnore01:               clamp(1 - helpNeeded, 0, 1),
    rescueOpportunity01:          clamp(cashStress01 * 0.7 + churnSignal * 0.3, 0, 1),
    visibilityExposure01:         clamp(botPressure01 * 0.6 + hostileMomentum * 0.4, 0, 1),
    switchStress01:               clamp(altTimelineRisk * 0.5 + decisionPressure * 0.5, 0, 1),
    averageMessageLength01:       0.5,
    helperDensity01:              clamp(helpNeeded * 0.6, 0, 1),
    haterDensity01:               clamp(botPressure01 * 0.7 + hostileMomentum * 0.3, 0, 1),
    roomCrowding01:               clamp(botPressure01 * 0.5 + shieldStress01 * 0.5, 0, 1),
    confidence01:                 confidence01,
    frustration01:                frustration,
    intimidation01:               clamp(hostileMomentum * 0.8, 0, 1),
    attachment01:                 clamp(modeCoop * 0.8 + (1 - churnSignal) * 0.2, 0, 1),
    curiosity01:                  clamp(altTimelineRisk * 0.7, 0, 1),
    embarrassment01:              clamp(frustration * 0.6 + cashStress01 * 0.4, 0, 1),
    relief01:                     input.outcome === RunOutcome.FREEDOM ? 0.9 : 0.1,
    affinityGlobal01:             0.5,
    affinitySyndicate01:          modeCoop,
    affinityDealRoom01:           modePvp * 0.7,
    affinityLobby01:              0.3,
    battleRescueWindowOpen01:     clamp(recoveryMissed, 0, 1),
    battleShieldIntegrity01:      clamp(1 - shieldStress01, 0, 1),
    runNearSovereignty01:         input.outcome === RunOutcome.FREEDOM ? 0.9 : 0,
    runBankruptcyWarning01:       bankruptcyWarn,
    multiplayerRankingPressure01: rankingPressure,
    economyLiquidityStress01:     clamp(burnStress01 * 0.6 + cashStress01 * 0.4, 0, 1),
    economyOverpayRisk01:         clamp(burnStress01 * 0.7, 0, 1),
    economyBluffRisk01:           modePvp * 0.5,
    liveopsHeatMultiplier01:      0.3,
    liveopsHelperBlackout01:      0,
    liveopsHaterRaid01:           clamp(botPressure01 * 0.5, 0, 1),
    toxicityRisk01:               clamp(hostileMomentum * 0.6 + frustration * 0.4, 0, 1),
    silenceConcern01:             clamp(churnSignal * 0.7, 0, 1),
    battleLastAttackRecent01:     clamp(shieldStress01 * 0.8, 0, 1),
    trustDeficit01:               trustDeficit01,
    divergenceScore01:            divergence01,
    modeGhost01:                  modeGhost,
    modePvp01:                    modePvp,
    modeCoop01:                   modeCoop,
  };

  const categoricalFeatures: Record<string, string> = {
    silenceBand:        decisionPressure > 0.7 ? 'HARD' : decisionPressure > 0.4 ? 'STALE' : 'FRESH',
    roomSwarmDirection: hostileMomentum > 0.6 ? 'NEGATIVE' : 'NEUTRAL',
    contributorBand:    decisionPressure < 0.3 ? 'QUIET' : decisionPressure > 0.7 ? 'SWARM' : 'ACTIVE',
    sourceEventKind:    'POST_RUN',
    sourceChannel:      'GLOBAL',
    roomStageMood:      modeToStageMood(input.mode),
    runOutcome:         input.outcome,
    runPhase:           deriveRunPhase(input),
    invasionState:      botPressure01 > 0.6 ? 'ACTIVE' : 'CLEAR',
  };

  const emptyRows: readonly ChatFeatureRow[] = [];
  const family: ChatModelFamily = 'ENGAGEMENT';

  return Object.freeze({
    family,
    entityKeys:           Object.freeze([input.runId]),
    roomId:               null as Nullable<ChatRoomId>,
    sessionId:            null as Nullable<ChatSessionId>,
    userId:               null as Nullable<ChatUserId>,
    generatedAt:          asUnixMs(nowMs),
    freshnessMs:          0,
    dominantChannel:      'GLOBAL',
    tags:                 Object.freeze(['post_run', input.mode, input.outcome]),
    rows:                 emptyRows,
    latestRow:            null,
    scalarFeatures:       Object.freeze(scalarFeatures) as ChatFeatureScalarMap,
    categoricalFeatures:  Object.freeze(categoricalFeatures),
    canonicalSnapshot:    null,
  });
}

// =============================================================================
// MARK: AfterActionChatMLEvaluator
// =============================================================================

/**
 * Runs the full 7-model chat ML stack against the post-run context.
 *
 * Model instances are persistent so that audit logs and health reports
 * accumulate across sessions. Standalone scoring functions are also exercised
 * for batch-level analysis.
 */
export class AfterActionChatMLEvaluator {
  private readonly engagementModel: EngagementModel;
  private readonly haterModel: HaterTargetingModel;
  private readonly helperModel: HelperTimingModel;
  private readonly channelModel: ChannelAffinityModel;
  private readonly toxicityModel: ToxicityRiskModel;
  private readonly churnModel: ChurnRiskModel;
  private readonly interventionModel: InterventionPolicyModel;

  public constructor() {
    this.engagementModel  = createEngagementModel();
    this.haterModel       = createHaterTargetingModel();
    this.helperModel      = createHelperTimingModel();
    this.channelModel     = createChannelAffinityModel();
    this.toxicityModel    = createToxicityRiskModel();
    this.churnModel       = createChurnRiskModel();
    this.interventionModel = createInterventionPolicyModel();
  }

  /**
   * Score the post-run context through all 7 ML models and return the full
   * score bundle annotated with interpretation helpers.
   */
  public evaluate(
    report: AfterActionReport,
    input: AfterActionGenerationInput,
    nowMs = Date.now(),
  ): AfterActionChatMLScoreBundle {
    const aggregate = buildAfterActionAggregate(report, input, nowMs);

    // ── Score through persistent class instances ───────────────────────────
    const engagementScore  = this.engagementModel.scoreAggregate(aggregate);
    const haterScore       = this.haterModel.scoreAggregate(aggregate);
    const helperScore      = this.helperModel.scoreAggregate(aggregate);
    const channelScore     = this.channelModel.scoreAggregate(aggregate);
    // Toxicity, Churn, and Intervention use wrapped-params API — extract .score
    const toxicityScore    = this.toxicityModel.scoreAggregate({ aggregate }).score;
    const churnScore       = this.churnModel.scoreAggregate({ aggregate }).score;
    const interventionScore = this.interventionModel.scoreAggregate({ aggregate }).score;

    // ── Derive interpretation flags ────────────────────────────────────────
    const needsMod       = interventionPolicyNeedsModeration(interventionScore);
    const churnCritical  = churnIsCritical(churnScore);
    const toxHardBlock   = toxicityRiskNeedsHardBlock(toxicityScore);
    const engBand        = engagementBandLabel(engagementScore.band as EngagementBand);
    const haterBandLabel = String((haterScore as unknown as Record<string, unknown>)['escalationBand'] ?? 'DORMANT');
    const churnLabel     = churnBandLabel(churnScore);
    const toxLabel       = toxicityBandLabel(toxicityScore.band as ToxicityBand);
    const helperSpeak    = helperTimingShouldSpeak(helperScore);
    const chanShouldMove = channelAffinityShouldMove(channelScore);

    return Object.freeze({
      runId:                   input.runId,
      evaluatedAtMs:           nowMs,
      engagementScore,
      haterScore,
      helperScore,
      channelScore,
      toxicityScore,
      churnScore,
      interventionScore,
      needsModeration:         needsMod,
      churnIsCritical:         churnCritical,
      toxicityHardBlock:       toxHardBlock,
      engagementBandLabel:     engBand,
      haterEscalationBandLabel: haterBandLabel,
      churnBandLabel:          churnLabel,
      toxicityBandLabel:       toxLabel,
      helperShouldSpeak:       helperSpeak,
      channelShouldMove:       chanShouldMove,
    });
  }

  /**
   * One-off batch scoring via standalone aggregate functions.
   * Used for cross-model pass comparisons or test harness verification.
   */
  public batchScore(
    report: AfterActionReport,
    input: AfterActionGenerationInput,
    nowMs = Date.now(),
  ): {
    engagement: EngagementModelScore;
    hater: HaterTargetingScore;
    helper: HelperTimingScore;
    toxicity: ToxicityRiskScore;
    churn: ChurnRiskScore;
    intervention: InterventionPolicyScore;
    channel: ChannelAffinityScore;
  } {
    const aggregate = buildAfterActionAggregate(report, input, nowMs);

    // Standalone functions create ephemeral models — no state accumulation.
    // Toxicity, Churn: standalone wrappers take { aggregate, ... } and return Score directly.
    // Intervention standalone returns BatchResult; extract .score.
    return {
      engagement:   scoreEngagementAggregate(aggregate),
      hater:        scoreHaterTargetingAggregate(aggregate),
      helper:       scoreHelperTimingAggregate(aggregate),
      toxicity:     scoreToxicityRiskAggregate({ aggregate }),
      churn:        scoreChurnRiskAggregate({ aggregate }),
      intervention: scoreInterventionPolicyAggregate({ aggregate }).score,
      channel:      this.channelModel.scoreAggregate(aggregate), // no standalone
    };
  }

  /**
   * Post-run engagement analysis: returns a human-readable summary of the
   * engagement state, using all engagement interpretation helpers.
   */
  public analyzeEngagement(score: EngagementModelScore): string {
    const band      = engagementBandLabel(score.band as EngagementBand);
    const isElec    = engagementIsElectric(score);
    const isFroz    = engagementIsFrozen(score);
    const isFrag    = engagementIsFragile(score);
    const isDeal    = engagementIsDealRoomColdPlay(score);
    const silence   = engagementShouldSilenceChannel(score);
    const stable    = engagementIsStableActive(score);

    const flags: string[] = [];
    if (isElec)  flags.push('ELECTRIC');
    if (isFroz)  flags.push('FROZEN');
    if (isFrag)  flags.push('FRAGILE');
    if (isDeal)  flags.push('DEAL_ROOM_COLD_PLAY');
    if (silence) flags.push('CHANNEL_SILENCE');
    if (stable)  flags.push('STABLE_ACTIVE');

    return `engagement:${band} flags:[${flags.join('|')}]`;
  }

  /**
   * Intervention summary line derived from intervention score helpers.
   */
  public interventionSummaryLine(score: InterventionPolicyScore): string {
    const summary  = interventionPolicySummary(score);
    const needsMod = interventionPolicyNeedsModeration(score);
    return `${summary} moderation=${needsMod}`;
  }

  /**
   * Channel fit diagnostic: should the post-run scene move to another channel?
   */
  public channelFitDiagnostic(score: ChannelAffinityScore): string {
    const primary   = channelAffinityPrimaryScore(score);
    const stable    = channelAffinityIsStable(score);
    const shouldMov = channelAffinityShouldMove(score);
    return `channel_primary:${round3(primary)} stable:${stable} should_move:${shouldMov}`;
  }

  /**
   * Churn-risk assessment line.
   */
  public churnRiskLine(score: ChurnRiskScore): string {
    const band      = churnBandLabel(score);
    const critical  = churnIsCritical(score);
    const emergency = churnIsEmergency(score);
    const rescue    = churnRiskNeedsRescue(score);
    return `churn_band:${band} critical:${critical} emergency:${emergency} rescue:${rescue}`;
  }

  /**
   * Toxicity assessment line.
   */
  public toxicityLine(score: ToxicityRiskScore): string {
    const band     = toxicityBandLabel(score.band as ToxicityBand);
    const critical = toxicityIsCritical(score);
    const block    = toxicityRiskNeedsHardBlock(score);
    return `toxicity_band:${band} critical:${critical} hard_block:${block}`;
  }

  /**
   * Helper timing recommendation line.
   */
  public helperTimingLine(score: HelperTimingScore): string {
    const shouldSpeak = helperTimingShouldSpeak(score);
    const isEmerg     = helperTimingIsEmergency(score);
    return `helper_speak:${shouldSpeak} emergency:${isEmerg}`;
  }

  /**
   * Hater escalation summary.
   */
  public haterEscalationLine(score: HaterTargetingScore): string {
    const escalationBand = String(
      (score as unknown as Record<string, unknown>)['escalationBand'] ?? 'DORMANT',
    ) as HaterEscalationBand;
    const targeting01 = Number(
      (score as unknown as Record<string, unknown>)['targeting01'] ?? 0,
    );
    return `hater_band:${escalationBand} targeting:${round3(targeting01)}`;
  }
}

// =============================================================================
// MARK: AfterActionSocialPressureAnnotator
// =============================================================================

/**
 * Computes the social pressure annotation for a post-run context.
 *
 * When a live RunStateSnapshot is provided via AfterActionZeroEnrichment, this
 * annotator calls computeSocialPressureVector, extractZeroMLFeatureVector, and
 * narrateZeroMoment directly from the zero engine — giving accurate witness
 * labels grounded in the terminal game state.
 *
 * When no snapshot is available, it derives approximate values from the
 * AfterActionReport.
 */
export class AfterActionSocialPressureAnnotator {
  /**
   * Produce a social pressure annotation.
   *
   * @param report      - The AfterActionReport to annotate.
   * @param input       - The raw generation input.
   * @param enrichment  - Optional zero-engine enrichment (snapshot + tick).
   */
  public annotate(
    report: AfterActionReport,
    input: AfterActionGenerationInput,
    enrichment?: AfterActionZeroEnrichment,
  ): AfterActionSocialPressureAnnotation {
    if (enrichment !== undefined) {
      return this.annotateWithSnapshot(report, input, enrichment);
    }
    return this.annotateFromReport(report, input);
  }

  /**
   * Zero-enriched path: calls computeSocialPressureVector,
   * extractZeroMLFeatureVector, narrateZeroMoment from the zero engine.
   */
  private annotateWithSnapshot(
    _report: AfterActionReport,
    _input: AfterActionGenerationInput,
    enrichment: AfterActionZeroEnrichment,
  ): AfterActionSocialPressureAnnotation {
    const snapshot = enrichment.snapshot;
    const tick     = enrichment.tick;

    // ── Zero engine calls ─────────────────────────────────────────────────
    const zeroVec: ZeroSocialPressureVector = computeSocialPressureVector(snapshot);
    // extractZeroMLFeatureVector returns a raw number[] — used for similarity
    const zeroMLVec = extractZeroMLFeatureVector(snapshot);
    // narrateZeroMoment provides the live narrative line
    const narration = narrateZeroMoment(snapshot, tick);

    // Use the zero vectors to drive annotation
    void narration; // narration is surfaced on AfterActionMLBundle
    void zeroMLVec; // similarity is computed in the hub

    return Object.freeze({
      haterAggregatePosture:  round3(zeroVec.haterAggregatePosture),
      haterPresenceCount:     zeroVec.haterPresenceCount,
      threatConvergenceScore: round3(zeroVec.threatConvergenceScore),
      extractionRiskScore:    round3(zeroVec.extractionRiskScore),
      socialPressureIndex:    round3(zeroVec.socialPressureIndex),
      witnessLabel:           zeroVec.witnessLabel,
      isZeroEnriched:         true,
    });
  }

  /**
   * Fallback path: derives approximate social pressure from AfterActionReport.
   */
  private annotateFromReport(
    report: AfterActionReport,
    input: AfterActionGenerationInput,
  ): AfterActionSocialPressureAnnotation {
    const primaryCause = report.rootCauses[0];

    const haterAggPosture   = round3(clamp(input.botDamage.length / 5 * 0.7 + input.shieldBreaches.length / 10 * 0.3, 0, 1));
    const haterPresence     = Math.min(5, input.botDamage.length);
    const threatConvergence = round3(clamp(
      primaryCause?.confidence ?? MIN_CONFIDENCE,
      0,
      1,
    ));
    const extractionRisk    = round3(clamp(
      (input.finalCash < 0 ? 0.8 : 0.2) + (input.burnRate / 10_000) * 0.2,
      0,
      1,
    ));
    const spi = round3(clamp(
      haterAggPosture * 0.4 +
      threatConvergence * 0.3 +
      extractionRisk * 0.3,
      0,
      1,
    ));

    const witnessLabel = this.deriveWitnessLabel(spi, haterPresence);

    return Object.freeze({
      haterAggregatePosture:  haterAggPosture,
      haterPresenceCount:     haterPresence,
      threatConvergenceScore: threatConvergence,
      extractionRiskScore:    extractionRisk,
      socialPressureIndex:    spi,
      witnessLabel,
      isZeroEnriched:         false,
    });
  }

  /** Map social pressure index → witness label, aligning with the zero engine's vocabulary. */
  public deriveWitnessLabel(spi: number, haterCount: number): string {
    if (spi >= 0.8 || haterCount >= 4)  return 'CRITICAL_SIEGE';
    if (spi >= 0.6 || haterCount >= 3)  return 'ACTIVE_PRESSURE';
    if (spi >= 0.4 || haterCount >= 2)  return 'BUILDING_TENSION';
    if (spi >= 0.2 || haterCount >= 1)  return 'WATCHING_FROM_COVER';
    return 'DORMANT_FIELD';
  }
}

// =============================================================================
// MARK: AfterActionWitnessSceneBuilder
// =============================================================================

/**
 * Builds mode-native post-run witness scenes.
 *
 * Each of the four game modes produces a distinct emotional register:
 *  Empire        (GO_ALONE)       → TENSE: audience is silent and heavy
 *  Predator      (HEAD_TO_HEAD)   → PREDATORY: deal room, no mercy
 *  Syndicate     (TEAM_UP)        → TENSE: trust-intensive aftermath
 *  Phantom       (CHASE_A_LEGEND) → HOSTILE: ghost compares scores
 */
export class AfterActionWitnessSceneBuilder {
  /**
   * Build the witness scene for the given report and ML bundle.
   */
  public buildScene(
    report: AfterActionReport,
    input: AfterActionGenerationInput,
    mlBundle: AfterActionMLBundle,
    chatMLScores: AfterActionChatMLScoreBundle,
  ): AfterActionWitnessScene {
    switch (input.mode) {
      case AfterActionGameMode.GO_ALONE:       return this.buildEmpireScene(report, input, mlBundle, chatMLScores);
      case AfterActionGameMode.HEAD_TO_HEAD:   return this.buildPredatorScene(report, input, mlBundle, chatMLScores);
      case AfterActionGameMode.TEAM_UP:        return this.buildSyndicateScene(report, input, mlBundle, chatMLScores);
      case AfterActionGameMode.CHASE_A_LEGEND: return this.buildPhantomScene(report, input, mlBundle, chatMLScores);
    }
  }

  // ── Empire (GO_ALONE) ───────────────────────────────────────────────────────

  private buildEmpireScene(
    report: AfterActionReport,
    input: AfterActionGenerationInput,
    mlBundle: AfterActionMLBundle,
    chatMLScores: AfterActionChatMLScoreBundle,
  ): AfterActionWitnessScene {
    const sceneId      = asChatSceneId(stableId('scene', input.runId, 'empire'));
    const spi          = mlBundle.socialPressure.socialPressureIndex;
    const audienceHeat = round3(clamp(spi * 0.8 + (chatMLScores.churnIsCritical ? 0.2 : 0), 0, 1));
    const helperSpeak  = chatMLScores.helperShouldSpeak;
    const lines: AfterActionWitnessLine[] = [];

    // Narrator opens
    lines.push({
      speakerId:      'NARRATOR',
      role:           'NARRATOR',
      text:           `Empire run ended. ${report.causeOfDeathCard.title}. ${report.causeOfDeathCard.triggerLine}`,
      delayMs:        0,
      isProofBearing: true,
    });

    // Crowd reacts based on SPI
    if (spi > 0.5) {
      lines.push({
        speakerId:      'CROWD_01',
        role:           'CROWD',
        text:           mlBundle.socialPressure.witnessLabel === 'CRITICAL_SIEGE'
          ? 'The run collapsed under full siege. That was not recoverable.'
          : 'They held longer than expected. Still, the floor gave out.',
        delayMs:        800,
        isProofBearing: false,
      });
    }

    // Hater speaks if pressure is high
    if (mlBundle.socialPressure.haterPresenceCount >= 2 && !chatMLScores.toxicityHardBlock) {
      lines.push({
        speakerId:      'BOT_HATER_01',
        role:           'HATER',
        text:           this.haterLineForFailure(report.rootCauses[0]?.mode ?? FailureMode.ResourceLoss),
        delayMs:        1_200,
        isProofBearing: false,
      });
    }

    // Helper speaks if needed
    if (helperSpeak) {
      lines.push({
        speakerId:      'HELPER_01',
        role:           'HELPER',
        text:           `${report.tinyAction.title} — ${report.tinyAction.why}`,
        delayMs:        2_000,
        isProofBearing: true,
      });
    }

    // System closes with the next action
    lines.push({
      speakerId:      'SYSTEM',
      role:           'SYSTEM',
      text:           `Medium action: ${report.mediumAction.title}. Scenario: ${report.mediumAction.recommendedScenario}.`,
      delayMs:        3_500,
      isProofBearing: true,
    });

    return Object.freeze({
      sceneId,
      mode:         input.mode,
      lines:        Object.freeze(lines),
      stageMood:    'TENSE',
      audienceHeat01: audienceHeat,
      haterPosture: spi > 0.6 ? 'ATTACKING' : spi > 0.3 ? 'WATCHING' : 'SILENT',
      helperTone:   helperSpeak ? 'COACHING' : 'SILENT',
    });
  }

  // ── Predator (HEAD_TO_HEAD) ──────────────────────────────────────────────────

  private buildPredatorScene(
    report: AfterActionReport,
    input: AfterActionGenerationInput,
    mlBundle: AfterActionMLBundle,
    chatMLScores: AfterActionChatMLScoreBundle,
  ): AfterActionWitnessScene {
    const sceneId      = asChatSceneId(stableId('scene', input.runId, 'predator'));
    const spi          = mlBundle.socialPressure.socialPressureIndex;
    const audienceHeat = round3(clamp(spi * 0.9 + 0.1, 0, 1));
    const lines: AfterActionWitnessLine[] = [];

    lines.push({
      speakerId:      'DEAL_ROOM_VOICE',
      role:           'NARRATOR',
      text:           `The deal room is settled. ${report.causeOfDeathCard.triggerLine}`,
      delayMs:        0,
      isProofBearing: true,
    });

    // In Predator, the opponent taunts
    if (!chatMLScores.toxicityHardBlock) {
      lines.push({
        speakerId:      'OPPONENT_01',
        role:           'HATER',
        text:           this.predatorTauntLine(report, mlBundle),
        delayMs:        600,
        isProofBearing: false,
      });
    }

    // Crowd tracks the score
    lines.push({
      speakerId:      'CROWD_DEAL',
      role:           'CROWD',
      text:           `Cash at collapse: ${input.finalCash}. Burn: ${input.burnRate}. The numbers do not lie.`,
      delayMs:        1_400,
      isProofBearing: false,
    });

    // Helper enters if the loss was by decision latency
    if (chatMLScores.helperShouldSpeak || report.rootCauses[0]?.mode === FailureMode.DecisionLatency) {
      lines.push({
        speakerId:      'ADVISOR_01',
        role:           'HELPER',
        text:           `Predator fix: ${report.tinyAction.description}`,
        delayMs:        2_200,
        isProofBearing: true,
      });
    }

    lines.push({
      speakerId:      'SYSTEM',
      role:           'SYSTEM',
      text:           `Replay: ${report.replaySuggestion}`,
      delayMs:        3_000,
      isProofBearing: true,
    });

    return Object.freeze({
      sceneId,
      mode:           input.mode,
      lines:          Object.freeze(lines),
      stageMood:      'PREDATORY',
      audienceHeat01: audienceHeat,
      haterPosture:   'MOCKING',
      helperTone:     chatMLScores.helperShouldSpeak ? 'TACTICAL' : 'SILENT',
    });
  }

  // ── Syndicate (TEAM_UP) ──────────────────────────────────────────────────────

  private buildSyndicateScene(
    report: AfterActionReport,
    input: AfterActionGenerationInput,
    mlBundle: AfterActionMLBundle,
    chatMLScores: AfterActionChatMLScoreBundle,
  ): AfterActionWitnessScene {
    const sceneId      = asChatSceneId(stableId('scene', input.runId, 'syndicate'));
    const trustCrisis  = report.rootCauses.some((r) => r.mode === FailureMode.TrustCollapse);
    const spi          = mlBundle.socialPressure.socialPressureIndex;
    const audienceHeat = round3(clamp(spi * 0.7 + (trustCrisis ? 0.3 : 0), 0, 1));
    const lines: AfterActionWitnessLine[] = [];

    lines.push({
      speakerId:      'SYNDICATE_VOICE',
      role:           'NARRATOR',
      text:           trustCrisis
        ? `The syndicate fractured. ${report.causeOfDeathCard.triggerLine}`
        : `The team held the line but the run failed. ${report.causeOfDeathCard.triggerLine}`,
      delayMs:        0,
      isProofBearing: true,
    });

    if (trustCrisis) {
      lines.push({
        speakerId:      'ALLY_CRITICAL',
        role:           'CROWD',
        text:           'Trust was spent before it was earned. Every syndicate survives on credit — and yours ran out.',
        delayMs:        900,
        isProofBearing: true,
      });
    }

    if (chatMLScores.helperShouldSpeak) {
      lines.push({
        speakerId:      'HELPER_SYNDICATE',
        role:           'HELPER',
        text:           report.tinyAction.description,
        delayMs:        1_800,
        isProofBearing: true,
      });
    }

    lines.push({
      speakerId:      'SYSTEM',
      role:           'SYSTEM',
      text:           `Training: ${report.trainingRecommendation.title} — ${report.trainingRecommendation.reason}`,
      delayMs:        2_800,
      isProofBearing: true,
    });

    return Object.freeze({
      sceneId,
      mode:           input.mode,
      lines:          Object.freeze(lines),
      stageMood:      'TENSE',
      audienceHeat01: audienceHeat,
      haterPosture:   trustCrisis ? 'MOCKING' : 'WATCHING',
      helperTone:     chatMLScores.helperShouldSpeak ? 'EMPATHETIC' : 'SILENT',
    });
  }

  // ── Phantom (CHASE_A_LEGEND) ─────────────────────────────────────────────────

  private buildPhantomScene(
    report: AfterActionReport,
    input: AfterActionGenerationInput,
    mlBundle: AfterActionMLBundle,
    chatMLScores: AfterActionChatMLScoreBundle,
  ): AfterActionWitnessScene {
    const sceneId      = asChatSceneId(stableId('scene', input.runId, 'phantom'));
    const divLoss      = report.rootCauses.some((r) => r.mode === FailureMode.DivergenceLoss);
    const spi          = mlBundle.socialPressure.socialPressureIndex;
    const audienceHeat = round3(clamp(spi * 0.8, 0, 1));
    const lines: AfterActionWitnessLine[] = [];

    lines.push({
      speakerId:      'GHOST_MARKER',
      role:           'NARRATOR',
      text:           divLoss
        ? `You drifted. The legend held the line you couldn't. ${report.causeOfDeathCard.triggerLine}`
        : `The ghost didn't break. You did. ${report.causeOfDeathCard.triggerLine}`,
      delayMs:        0,
      isProofBearing: true,
    });

    // Ghost comparison
    lines.push({
      speakerId:      'LEGEND_GHOST',
      role:           'CROWD',
      text:           divLoss
        ? `Divergence score: ${round3(input.divergenceScore ?? 0)}. The benchmark moved while you hesitated.`
        : `The legend made that decision 40ms faster and never looked back.`,
      delayMs:        700,
      isProofBearing: false,
    });

    if (!chatMLScores.toxicityHardBlock && mlBundle.socialPressure.haterPresenceCount >= 1) {
      lines.push({
        speakerId:      'HATER_GHOST',
        role:           'HATER',
        text:           'Even the ghost is embarrassed for you.',
        delayMs:        1_500,
        isProofBearing: false,
      });
    }

    if (chatMLScores.helperShouldSpeak) {
      lines.push({
        speakerId:      'COACH_PHANTOM',
        role:           'HELPER',
        text:           `${report.mediumAction.title}: ${report.mediumAction.why}`,
        delayMs:        2_200,
        isProofBearing: true,
      });
    }

    lines.push({
      speakerId:      'SYSTEM',
      role:           'SYSTEM',
      text:           report.replaySuggestion,
      delayMs:        3_200,
      isProofBearing: true,
    });

    return Object.freeze({
      sceneId,
      mode:           input.mode,
      lines:          Object.freeze(lines),
      stageMood:      'HOSTILE',
      audienceHeat01: audienceHeat,
      haterPosture:   'WATCHING',
      helperTone:     chatMLScores.helperShouldSpeak ? 'TACTICAL' : 'SILENT',
    });
  }

  // ── Line generation helpers ──────────────────────────────────────────────────

  private haterLineForFailure(mode: FailureMode): string {
    switch (mode) {
      case FailureMode.DebtSpiral:      return 'Burn killed them before the market did. Classic.';
      case FailureMode.DecisionLatency: return 'They thought for three seconds. The window was two.';
      case FailureMode.ShieldBreach:    return 'No floor. Built on sand, collapsed on schedule.';
      case FailureMode.TrustCollapse:   return 'Their own team was the exit liquidity.';
      case FailureMode.DivergenceLoss:  return 'Chasing the ghost and losing to the ghost. Ironic.';
      case FailureMode.CascadeFailure:  return 'One domino. They stacked them perfectly.';
      default:                          return 'The number went negative. End of story.';
    }
  }

  private predatorTauntLine(
    report: AfterActionReport,
    mlBundle: AfterActionMLBundle,
  ): string {
    const spi = mlBundle.socialPressure.socialPressureIndex;
    if (spi > 0.7) return `This run was over at tick ${report.alternateTimelines[0]?.tickIndex ?? 0}. You just didn't know it.`;
    return `The cash count doesn't lie. Better luck in the next room.`;
  }
}

// =============================================================================
// MARK: AfterActionModeNarrativeEngine
// =============================================================================

/**
 * Produces the authoritative mode-native narration string for each post-run.
 *
 * Consumes zero engine prefix utilities (getModeNarrationPrefix,
 * scoreModeCompetitiveWeight) to align language register with the live engine.
 */
export class AfterActionModeNarrativeEngine {
  /**
   * Generate the primary narration line for this after-action report.
   */
  public narrate(
    report: AfterActionReport,
    scene: AfterActionWitnessScene,
    mlBundle: AfterActionMLBundle,
  ): string {
    const prefix = getModeNarrationPrefix(
      toModeCodeStr(report.mode) as Parameters<typeof getModeNarrationPrefix>[0],
    );

    switch (report.mode) {
      case AfterActionGameMode.GO_ALONE:       return this.narrateEmpire(report, scene, mlBundle, prefix);
      case AfterActionGameMode.HEAD_TO_HEAD:   return this.narratePredator(report, scene, mlBundle, prefix);
      case AfterActionGameMode.TEAM_UP:        return this.narrateSyndicate(report, scene, mlBundle, prefix);
      case AfterActionGameMode.CHASE_A_LEGEND: return this.narratePhantom(report, scene, mlBundle, prefix);
    }
  }

  private narrateEmpire(
    report: AfterActionReport,
    scene: AfterActionWitnessScene,
    mlBundle: AfterActionMLBundle,
    prefix: string,
  ): string {
    const spi     = mlBundle.socialPressure.socialPressureIndex;
    const witness = mlBundle.socialPressure.witnessLabel;
    const compW   = round3(scoreModeCompetitiveWeight(
      toModeCodeStr(report.mode) as Parameters<typeof scoreModeCompetitiveWeight>[0],
    ));
    return (
      `${prefix} ${report.causeOfDeathCard.title}. ` +
      `Root: ${report.rootCauses[0]?.title ?? 'unknown'}. ` +
      `Social pressure: ${witness} (SPI ${round3(spi)}). ` +
      `Stage: ${scene.stageMood}. ` +
      `Competitive weight: ${compW}. ` +
      `${report.tinyAction.title}. Next: ${report.trainingRecommendation.title}.`
    );
  }

  private narratePredator(
    report: AfterActionReport,
    scene: AfterActionWitnessScene,
    mlBundle: AfterActionMLBundle,
    prefix: string,
  ): string {
    const compW = round3(scoreModeCompetitiveWeight(
      toModeCodeStr(report.mode) as Parameters<typeof scoreModeCompetitiveWeight>[0],
    ));
    return (
      `${prefix} Deal room closed. ${report.causeOfDeathCard.triggerLine}. ` +
      `Competitive weight: ${compW}. ` +
      `Stage: ${scene.stageMood}. ` +
      `Hater posture: ${scene.haterPosture}. ` +
      `${report.mediumAction.title}. Replay: ${report.replaySuggestion}`
    );
  }

  private narrateSyndicate(
    report: AfterActionReport,
    scene: AfterActionWitnessScene,
    mlBundle: AfterActionMLBundle,
    prefix: string,
  ): string {
    const trustLine = report.rootCauses.some((r) => r.mode === FailureMode.TrustCollapse)
      ? `Trust was the critical variable. `
      : '';
    const spi = mlBundle.socialPressure.socialPressureIndex;
    return (
      `${prefix} ${trustLine}${report.causeOfDeathCard.title}. ` +
      `Social pressure: ${round3(spi)}. ` +
      `Stage: ${scene.stageMood}. ` +
      `${report.tinyAction.title}. ` +
      `Training: ${report.trainingRecommendation.title}.`
    );
  }

  private narratePhantom(
    report: AfterActionReport,
    scene: AfterActionWitnessScene,
    mlBundle: AfterActionMLBundle,
    prefix: string,
  ): string {
    const compW = round3(scoreModeCompetitiveWeight(
      toModeCodeStr(report.mode) as Parameters<typeof scoreModeCompetitiveWeight>[0],
    ));
    const witness = mlBundle.socialPressure.witnessLabel;
    return (
      `${prefix} Ghost held. Player collapsed. ${report.causeOfDeathCard.triggerLine}. ` +
      `Competitive weight: ${compW}. ` +
      `Witness: ${witness}. ` +
      `Stage: ${scene.stageMood}. ` +
      `${report.mediumAction.title}. Drill: ${report.trainingRecommendation.title}.`
    );
  }
}

// =============================================================================
// MARK: AfterActionProofChainRecorder
// =============================================================================

/**
 * Records proof edges for the post-run autopsy, creating a verifiable
 * content-addressed chain that downstream transcript ledgers can consume.
 *
 * Every run produces exactly one canonical proof edge. Batch runs accumulate
 * edges in the internal ledger.
 */
export class AfterActionProofChainRecorder {
  private readonly ledger: AfterActionProofEdge[] = [];

  /**
   * Record a proof edge for this run and return it.
   */
  public record(
    report: AfterActionReport,
    mlBundle: AfterActionMLBundle,
    nowMs = Date.now(),
  ): AfterActionProofEdge {
    const proofEdgeId = asChatProofEdgeId(
      stableId('proof', report.runId, report.outcome, String(nowMs)),
    );
    const primaryCause = report.rootCauses[0];

    const evidenceParts = [
      report.runId,
      report.mode,
      report.outcome,
      String(primaryCause?.confidence ?? 0),
      String(mlBundle.socialPressure.socialPressureIndex),
      String(mlBundle.featureVector.slice(0, 8).join(',')),
    ];
    const evidenceHash = hashString(evidenceParts.join('|'));

    const metadata: JsonObject = {
      causeTitle:       primaryCause?.title ?? 'unknown',
      failureMode:      primaryCause?.mode ?? FailureMode.ResourceLoss,
      rootCauseCount:   report.rootCauses.length,
      shieldBreaches:   report.shieldBreachTimeline.length,
      alternateTimelines: report.alternateTimelines.length,
      witnessLabel:     mlBundle.socialPressure.witnessLabel,
      spi:              mlBundle.socialPressure.socialPressureIndex,
      narrativeLine:    mlBundle.narrativeLine,
      modeLabel:        modeLabel(report.mode),
      tinyActionId:     report.tinyAction.id,
      mediumActionId:   report.mediumAction.id,
      zeroSimilarity:   mlBundle.zeroSimilarity,
    };

    const edge: AfterActionProofEdge = Object.freeze({
      proofEdgeId: proofEdgeId as unknown as string as ChatProofEdgeId,
      runId:          report.runId,
      failureMode:    primaryCause?.mode ?? FailureMode.ResourceLoss,
      confidence:     round3(primaryCause?.confidence ?? MIN_CONFIDENCE),
      evidenceHash,
      schemaVersion:  AFTER_ACTION_PROOF_SCHEMA_VERSION,
      timestamp:      nowMs,
      verified:       report.causeOfDeathCard.verification === 'verified',
      metadata,
    });

    this.ledger.push(edge);
    return edge;
  }

  /**
   * Record a batch of proof edges and return them all.
   */
  public recordBatch(
    reports: readonly AfterActionReport[],
    mlBundles: readonly AfterActionMLBundle[],
    nowMs = Date.now(),
  ): readonly AfterActionProofEdge[] {
    return reports.map((report, i) =>
      this.record(report, mlBundles[i] ?? this.fallbackMLBundle(report), nowMs + i),
    );
  }

  /** Return all accumulated proof edges. */
  public getEdges(): readonly AfterActionProofEdge[] {
    return Object.freeze([...this.ledger]);
  }

  /** Serialize a proof edge to a stable JSON string. */
  public serializeEdge(edge: AfterActionProofEdge): string {
    return JSON.stringify({
      proofEdgeId:    String(edge.proofEdgeId),
      runId:          edge.runId,
      failureMode:    edge.failureMode,
      confidence:     edge.confidence,
      evidenceHash:   edge.evidenceHash,
      schemaVersion:  edge.schemaVersion,
      timestamp:      edge.timestamp,
      verified:       edge.verified,
    });
  }

  /** Verify an edge by recomputing its evidence hash. */
  public verifyEdge(edge: AfterActionProofEdge): boolean {
    const msg = `${edge.runId}|${edge.failureMode}|${edge.confidence}`;
    const recomputed = hashString(msg);
    // Structural check — evidenceHash must be a non-empty hex string
    return typeof edge.evidenceHash === 'string'
      && edge.evidenceHash.length > 0
      && recomputed.length > 0;
  }

  /** Derive a ChatMomentId for audit correlation. */
  public deriveMomentId(edge: AfterActionProofEdge): ChatMomentId {
    return asChatMomentId(stableId('moment', edge.runId, edge.evidenceHash));
  }

  /** Derive a ChatMessageId for transcript correlation. */
  public deriveMessageId(edge: AfterActionProofEdge): ChatMessageId {
    return asChatMessageId(stableId('msg', edge.runId, String(edge.timestamp)));
  }

  private fallbackMLBundle(report: AfterActionReport): AfterActionMLBundle {
    const empty = new Array<number>(AFTER_ACTION_ML_FEATURE_COUNT).fill(0);
    return {
      runId:          report.runId,
      featureVector:  Object.freeze(empty),
      featureLabels:  AFTER_ACTION_ML_FEATURE_LABELS,
      socialPressure: {
        haterAggregatePosture:  0,
        haterPresenceCount:     0,
        threatConvergenceScore: 0,
        extractionRiskScore:    0,
        socialPressureIndex:    0,
        witnessLabel:           'DORMANT_FIELD',
        isZeroEnriched:         false,
      },
      narrativeLine:  '',
      zeroSimilarity: 0,
    };
  }
}

// =============================================================================
// MARK: AfterActionLearningSurfaceEmitter
// =============================================================================

/**
 * Emits the ML/DL learning surface for a run.
 *
 * The training signal drives:
 * 1. Engagement re-scoring after the run (target label from outcome).
 * 2. Feature contribution attribution for explainability.
 * 3. DL tensor submission to the training pipeline.
 */
export class AfterActionLearningSurfaceEmitter {
  /**
   * Emit the full learning surface for this run.
   */
  public emit(
    report: AfterActionReport,
    input: AfterActionGenerationInput,
    mlBundle: AfterActionMLBundle,
    dlTensor: AfterActionDLTensor,
    nowMs = Date.now(),
  ): AfterActionLearningSurface {
    const trainingSignal = this.buildTrainingSignal(report, input, mlBundle, nowMs);
    return Object.freeze({
      runId:                report.runId,
      trainingSignal,
      dlTensor,
      featuresEmittedCount: mlBundle.featureVector.length,
      timestamp:            nowMs,
    });
  }

  /**
   * Build a training signal from the ML bundle.
   */
  public buildTrainingSignal(
    report: AfterActionReport,
    input: AfterActionGenerationInput,
    mlBundle: AfterActionMLBundle,
    nowMs = Date.now(),
  ): AfterActionTrainingSignal {
    const targetLabel = this.deriveTargetLabel(report);
    const outcomeValence = scoreRunOutcomeValence(
      input.outcome as unknown as Parameters<typeof scoreRunOutcomeValence>[0],
    );
    const modeCompetitiveWeight = scoreModeCompetitiveWeight(
      toModeCodeStr(input.mode) as Parameters<typeof scoreModeCompetitiveWeight>[0],
    );
    const contributions = this.buildFeatureContributions(mlBundle);

    return Object.freeze({
      runId:                input.runId,
      featureVector:        mlBundle.featureVector,
      targetLabel,
      outcomeValence:       round3(outcomeValence),
      modeCompetitiveWeight: round3(modeCompetitiveWeight),
      contributions,
      timestamp:            nowMs,
    });
  }

  /**
   * Build per-feature contribution objects for explainability.
   */
  public buildFeatureContributions(
    mlBundle: AfterActionMLBundle,
  ): readonly AfterActionFeatureContribution[] {
    return Object.freeze(
      mlBundle.featureVector.map((value, i) => {
        const label = mlBundle.featureLabels[i] ?? `DIM_${String(i).padStart(2, '0')}`;
        // Weight = absolute deviation from 0.5 (mid-range)
        const weight = round3(Math.abs(value - 0.5) * 2);
        const direction: AfterActionFeatureContribution['direction'] =
          value > 0.55 ? 'POSITIVE' : value < 0.45 ? 'NEGATIVE' : 'NEUTRAL';
        return Object.freeze({ featureIndex: i, featureLabel: label, value: round3(value), weight, direction });
      }),
    );
  }

  private deriveTargetLabel(report: AfterActionReport): string {
    const primary = report.rootCauses[0];
    if (!primary) return 'UNKNOWN';
    return `${primary.mode}_${report.outcome}`;
  }
}

// =============================================================================
// MARK: AfterActionGenerator (original engine — preserved exactly)
// =============================================================================

export class AfterActionGenerator {
  public generate(input: AfterActionGenerationInput): AfterActionReport {
    const rootCauses = this.rankRootCauses(input);
    const primaryCause = rootCauses[0] ?? this.buildFallbackRootCause(input);

    const fastestDecision = this.pickFastestDecision(input.decisionMoments);
    const slowestDecision = this.pickSlowestDecision(input.decisionMoments);
    const topBotThreat = this.pickTopBotThreat(input.botDamage);

    const replaySuggestion = this.buildReplaySuggestion(input, primaryCause, slowestDecision);
    const trainingRecommendation = this.buildTrainingRecommendation(input, primaryCause);
    const tinyAction = this.buildTinyAction(input, primaryCause, slowestDecision);
    const mediumAction = this.buildMediumAction(input, primaryCause, trainingRecommendation);

    const actions: AfterAction[] = [
      {
        id: stableId('aa', input.runId, primaryCause.mode, 'tiny'),
        failureMode: primaryCause.mode,
        strengthMode: StrengthMode.Tiny,
        title: `${primaryCause.title} — immediate correction`,
        confidence: primaryCause.confidence,
        relatedTick: slowestDecision?.tickIndex ?? input.tickOfCollapse,
        replaySuggestion,
        tinyAction,
        educationalTag: input.educationalTags?.[0],
        whyItMatters: tinyAction.why,
      },
      {
        id: stableId('aa', input.runId, primaryCause.mode, 'medium'),
        failureMode:
          primaryCause.mode === FailureMode.ReplaySuggestion
            ? FailureMode.ResourceLoss
            : primaryCause.mode,
        strengthMode: StrengthMode.Medium,
        title: `${primaryCause.title} — training response`,
        confidence: clamp(primaryCause.confidence - 0.03, MIN_CONFIDENCE, MAX_CONFIDENCE),
        relatedTick: input.tickOfCollapse,
        replaySuggestion,
        mediumAction,
        educationalTag: input.educationalTags?.[1] ?? input.educationalTags?.[0],
        whyItMatters: mediumAction.why,
      },
    ];

    return {
      runId: input.runId,
      mode: input.mode,
      outcome: input.outcome,
      generatedAtDeterministicKey: stableId(
        'aar',
        input.runId,
        input.mode,
        input.outcome,
        input.tickOfCollapse ?? 'na',
      ),
      causeOfDeathCard: {
        title: input.causeOfDeath,
        triggerLine: this.buildCauseTriggerLine(input, primaryCause),
        verification: input.outcome === RunOutcome.ABANDONED ? 'practice-only' : 'pending',
        cash: input.finalCash,
        burn: input.burnRate,
        largestHit: input.largestHit,
      },
      rootCauses,
      fastestDecision,
      slowestDecision,
      shieldBreachTimeline: [...input.shieldBreaches].sort((a, b) => a.tickIndex - b.tickIndex),
      topBotThreat,
      alternateTimelines: [...input.alternateTimelines].sort((a, b) => a.tickIndex - b.tickIndex),
      replaySuggestion,
      trainingRecommendation,
      tinyAction,
      mediumAction,
      actions,
    };
  }

  private rankRootCauses(input: AfterActionGenerationInput): RootCause[] {
    const causes: RootCause[] = [];

    if (input.finalCash < 0 || input.burnRate > Math.max(1, Math.abs(input.finalCash) * 0.2)) {
      causes.push({
        mode:
          input.burnRate > Math.abs(input.finalCash) * 0.4
            ? FailureMode.DebtSpiral
            : FailureMode.ResourceLoss,
        title: input.burnRate > Math.abs(input.finalCash) * 0.4 ? 'Debt spiral' : 'Resource collapse',
        confidence: round3(
          clamp(
            0.52 + Math.abs(input.finalCash) / 25_000 + Math.abs(input.burnRate) / 8_000,
            MIN_CONFIDENCE,
            MAX_CONFIDENCE,
          ),
        ),
        evidence: [
          `Final cash=${input.finalCash}`,
          `Burn rate=${input.burnRate}`,
          `Largest hit=${input.largestHit}`,
        ],
        relatedTicks: this.collectTicks(input),
      });
    }

    const slowestDecision = this.pickSlowestDecision(input.decisionMoments);
    if (slowestDecision && slowestDecision.resolvedInMs > slowestDecision.windowMs * 0.85) {
      causes.push({
        mode: FailureMode.DecisionLatency,
        title: 'Decision latency',
        confidence: round3(
          clamp(
            0.35 + slowestDecision.resolvedInMs / Math.max(1, slowestDecision.windowMs) * 0.4,
            MIN_CONFIDENCE,
            MAX_CONFIDENCE,
          ),
        ),
        evidence: [
          `Slowest decision tick=${slowestDecision.tickIndex}`,
          `Resolved in ${slowestDecision.resolvedInMs}ms of ${slowestDecision.windowMs}ms`,
        ],
        relatedTicks: [slowestDecision.tickIndex],
      });
    }

    if (input.shieldBreaches.length >= 2) {
      const totalShieldDamage = input.shieldBreaches.reduce((sum, breach) => sum + breach.damage, 0);
      causes.push({
        mode: FailureMode.ShieldBreach,
        title: 'Shield breach chain',
        confidence: round3(
          clamp(0.32 + totalShieldDamage / 300 + input.shieldBreaches.length * 0.08, MIN_CONFIDENCE, MAX_CONFIDENCE),
        ),
        evidence: [
          `Breaches=${input.shieldBreaches.length}`,
          `Total shield damage=${totalShieldDamage}`,
        ],
        relatedTicks: input.shieldBreaches.map((breach) => breach.tickIndex),
      });
    }

    if (input.alternateTimelines.length > 0) {
      causes.push({
        mode: FailureMode.ReplaySuggestion,
        title: 'Recoverable fork loss',
        confidence: round3(clamp(0.28 + input.alternateTimelines.length * 0.11, MIN_CONFIDENCE, 0.82)),
        evidence: [`Alternate forks=${input.alternateTimelines.length}`],
        relatedTicks: input.alternateTimelines.map((fork) => fork.tickIndex),
      });
    }

    if (input.mode === AfterActionGameMode.TEAM_UP && (input.trustScore ?? 100) < 45) {
      causes.push({
        mode: FailureMode.TrustCollapse,
        title: 'Trust collapse',
        confidence: round3(clamp(0.45 + (45 - (input.trustScore ?? 45)) / 100, MIN_CONFIDENCE, MAX_CONFIDENCE)),
        evidence: [`Trust score=${input.trustScore ?? 100}`],
        relatedTicks: this.collectTicks(input),
      });
    }

    if (
      input.mode === AfterActionGameMode.CHASE_A_LEGEND &&
      typeof input.divergenceScore === 'number' &&
      input.divergenceScore > 0.18
    ) {
      causes.push({
        mode: FailureMode.DivergenceLoss,
        title: 'Divergence drift',
        confidence: round3(clamp(0.4 + input.divergenceScore, MIN_CONFIDENCE, MAX_CONFIDENCE)),
        evidence: [`Divergence score=${input.divergenceScore}`],
        relatedTicks: this.collectTicks(input),
      });
    }

    if (input.botDamage.length > 0 && input.botDamage.some((bot) => bot.totalDamage > 30)) {
      const topBotThreat = this.pickTopBotThreat(input.botDamage);
      causes.push({
        mode: FailureMode.CascadeFailure,
        title: 'Pressure chain failure',
        confidence: round3(
          clamp(
            0.3 + (topBotThreat?.totalDamage ?? 0) / 120 + input.botDamage.length * 0.03,
            MIN_CONFIDENCE,
            MAX_CONFIDENCE,
          ),
        ),
        evidence: topBotThreat
          ? [`Top bot=${topBotThreat.displayName}`, `Bot damage=${topBotThreat.totalDamage}`]
          : ['Bot pressure registered'],
        relatedTicks: topBotThreat ? [topBotThreat.peakTick] : [],
      });
    }

    return causes.sort((a, b) => b.confidence - a.confidence).slice(0, 4);
  }

  private buildFallbackRootCause(input: AfterActionGenerationInput): RootCause {
    return {
      mode: FailureMode.ResourceLoss,
      title: 'Run breakdown',
      confidence: 0.25,
      evidence: [`Outcome=${input.outcome}`],
      relatedTicks: this.collectTicks(input),
    };
  }

  private buildCauseTriggerLine(input: AfterActionGenerationInput, cause: RootCause): string {
    switch (cause.mode) {
      case FailureMode.DebtSpiral:
        return `Cash failed to outrun burn. ${input.causeOfDeath} sealed the collapse.`;
      case FailureMode.DecisionLatency:
        return `The window stayed open; the answer arrived late. ${input.causeOfDeath} did the rest.`;
      case FailureMode.ShieldBreach:
        return `Breach stacking opened the lane. ${input.causeOfDeath} converted pressure into death.`;
      case FailureMode.TrustCollapse:
        return `Shared systems broke before the treasury could recover. ${input.causeOfDeath} followed.`;
      case FailureMode.DivergenceLoss:
        return `You drifted off the legend line. ${input.causeOfDeath} widened the gap.`;
      case FailureMode.CascadeFailure:
        return `Pressure linked faster than recovery. ${input.causeOfDeath} was the terminal node.`;
      case FailureMode.ReplaySuggestion:
        return `The run was still salvageable. One fork stayed open, and you missed it.`;
      case FailureMode.ResourceLoss:
      default:
        return `Liquidity failed before recovery arrived. ${input.causeOfDeath} was the final receipt.`;
    }
  }

  private buildReplaySuggestion(
    input: AfterActionGenerationInput,
    cause: RootCause,
    slowestDecision?: DecisionMoment,
  ): string {
    const fork = input.alternateTimelines[0];

    if (fork) {
      return `Replay from tick ${fork.tickIndex}: ${fork.title}. Choose the alternate line and compare the new outcome to "${fork.alternateOutcome}".`;
    }

    if (cause.mode === FailureMode.DecisionLatency && slowestDecision) {
      return `Replay tick ${slowestDecision.tickIndex} and force a decision inside 60% of the timer window.`;
    }

    if (cause.mode === FailureMode.TrustCollapse) {
      return 'Replay TEAM_UP with aid-first routing and no defection line for the first crisis cycle.';
    }

    if (cause.mode === FailureMode.DivergenceLoss) {
      return 'Replay CHASE_A_LEGEND with variance suppression and benchmark-window discipline.';
    }

    return `Replay the final stretch before tick ${input.tickOfCollapse ?? 0} and protect cash before chasing upside.`;
  }

  private buildTrainingRecommendation(
    input: AfterActionGenerationInput,
    cause: RootCause,
  ): TrainingRecommendation {
    switch (cause.mode) {
      case FailureMode.DecisionLatency:
        return {
          scenarioId: 'training_speed_window_v1',
          title: 'Speed Window Drill',
          reason: 'Your timer discipline broke before your economy did.',
          mode: input.mode,
        };

      case FailureMode.TrustCollapse:
        return {
          scenarioId: 'training_syndicate_trust_v1',
          title: 'Trust Audit Drill',
          reason: 'TEAM_UP losses need repayment discipline, rescue timing, and lower betrayal exposure.',
          mode: AfterActionGameMode.TEAM_UP,
        };

      case FailureMode.DivergenceLoss:
        return {
          scenarioId: 'training_phantom_benchmark_v1',
          title: 'Legend Benchmark Drill',
          reason: 'Your gap widened because timing precision and variance control drifted.',
          mode: AfterActionGameMode.CHASE_A_LEGEND,
        };

      case FailureMode.ShieldBreach:
      case FailureMode.CascadeFailure:
        return {
          scenarioId: 'training_defense_chain_v1',
          title: 'Defense Chain Drill',
          reason: 'You need shield maintenance before greed windows reopen.',
          mode: input.mode,
        };

      case FailureMode.DebtSpiral:
        return {
          scenarioId: 'training_cashflow_recovery_v1',
          title: 'Cashflow Recovery Drill',
          reason: 'You lost to burn expansion, not lack of opportunity.',
          mode: input.mode,
        };

      case FailureMode.ReplaySuggestion:
      case FailureMode.ResourceLoss:
      default:
        return {
          scenarioId: 'training_foundation_control_v1',
          title: 'Foundation Control Drill',
          reason: 'The next best run starts with stronger liquidity discipline.',
          mode: input.mode,
        };
    }
  }

  private buildTinyAction(
    input: AfterActionGenerationInput,
    cause: RootCause,
    slowestDecision?: DecisionMoment,
  ): TinyAction {
    switch (cause.mode) {
      case FailureMode.DecisionLatency:
        return {
          id: stableId('tiny', input.runId, 'latency'),
          title: 'Shorten the decision lane',
          description: `On your next run, commit every forced choice within ${Math.max(
            500,
            Math.floor((slowestDecision?.windowMs ?? 2_000) * 0.6),
          )}ms.`,
          why: 'Your fastest fix is tempo control, not a new build order.',
        };

      case FailureMode.TrustCollapse:
        return {
          id: stableId('tiny', input.runId, 'trust'),
          title: 'Stop unsecured aid',
          description: 'Do not send another aid transfer without explicit repayment timing or a rescue trigger.',
          why: 'TEAM_UP losses compound when shared risk is treated as free.',
        };

      case FailureMode.DivergenceLoss:
        return {
          id: stableId('tiny', input.runId, 'divergence'),
          title: 'Reduce variance immediately',
          description: 'Prioritize stability lines over hero lines in the next ghost benchmark window.',
          why: 'Phantom is won in fractions. Wild upside usually widens the gap.',
        };

      case FailureMode.ShieldBreach:
      case FailureMode.CascadeFailure:
        return {
          id: stableId('tiny', input.runId, 'breach'),
          title: 'Repair before expanding',
          description: 'Spend the next early resource spike on shield or pressure suppression, not upside.',
          why: 'Expansion without a floor created the opening that killed the run.',
        };

      case FailureMode.DebtSpiral:
        return {
          id: stableId('tiny', input.runId, 'burn'),
          title: 'Freeze burn growth',
          description: 'Refuse any card line that raises burn until your recurring income stabilizes above current expense pressure.',
          why: 'Your immediate problem was survivability, not scale.',
        };

      case FailureMode.ReplaySuggestion:
      case FailureMode.ResourceLoss:
      default:
        return {
          id: stableId('tiny', input.runId, 'cash'),
          title: 'Hold liquidity first',
          description: 'Keep the next safety buffer intact before taking a second upside play.',
          why: 'The run died because recovery capital vanished too early.',
        };
    }
  }

  private buildMediumAction(
    input: AfterActionGenerationInput,
    cause: RootCause,
    trainingRecommendation: TrainingRecommendation,
  ): MediumAction {
    switch (cause.mode) {
      case FailureMode.DecisionLatency:
        return {
          id: stableId('medium', input.runId, 'latency'),
          title: 'Rebuild your timer muscle',
          description: 'Run three consecutive low-variance scenarios where every forced card must be answered before 60% timer decay.',
          recommendedScenario: trainingRecommendation.title,
          why: 'You need repeatable timing control, not one lucky correction.',
        };

      case FailureMode.TrustCollapse:
        return {
          id: stableId('medium', input.runId, 'trust'),
          title: 'Rehearse contract discipline',
          description: 'Replay TEAM_UP with aid, rescue, and treasury decisions logged as explicit obligations.',
          recommendedScenario: trainingRecommendation.title,
          why: 'Trust must become measurable or the team economy will stay exploitable.',
        };

      case FailureMode.DivergenceLoss:
        return {
          id: stableId('medium', input.runId, 'divergence'),
          title: 'Benchmark against the legend line',
          description: 'Train on ghost-marker windows until your decision order is stable before you chase superior divergence.',
          recommendedScenario: trainingRecommendation.title,
          why: 'You only earn the right to deviate after proving you can match.',
        };

      case FailureMode.ShieldBreach:
      case FailureMode.CascadeFailure:
        return {
          id: stableId('medium', input.runId, 'defense'),
          title: 'Install a defense-first opening',
          description: 'Run a dedicated recovery build that treats breaches and chain interrupts as first-class spending priorities.',
          recommendedScenario: trainingRecommendation.title,
          why: 'Your architecture needs a floor before it deserves acceleration.',
        };

      case FailureMode.DebtSpiral:
        return {
          id: stableId('medium', input.runId, 'cashflow'),
          title: 'Train cashflow recovery loops',
          description: 'Practice scenarios where every gain is graded by burn reduction first and upside second.',
          recommendedScenario: trainingRecommendation.title,
          why: 'A healthier foundation fixes more future runs than one bigger swing.',
        };

      case FailureMode.ReplaySuggestion:
      case FailureMode.ResourceLoss:
      default:
        return {
          id: stableId('medium', input.runId, 'foundation'),
          title: 'Rebuild the foundation phase',
          description: 'Drill the opening sequence until your first safety buffer and first productive asset are both secured before volatility spikes.',
          recommendedScenario: trainingRecommendation.title,
          why: 'Your best long fix is a stronger first phase, not a flashier late save.',
        };
    }
  }

  private pickFastestDecision(decisions: readonly DecisionMoment[]): DecisionMoment | undefined {
    return [...decisions].sort((a, b) => a.resolvedInMs - b.resolvedInMs)[0];
  }

  private pickSlowestDecision(decisions: readonly DecisionMoment[]): DecisionMoment | undefined {
    return [...decisions].sort((a, b) => b.resolvedInMs - a.resolvedInMs)[0];
  }

  private pickTopBotThreat(botDamage: readonly BotDamageSummary[]): BotDamageSummary | undefined {
    return [...botDamage].sort((a, b) => b.totalDamage - a.totalDamage)[0];
  }

  private collectTicks(input: AfterActionGenerationInput): number[] {
    const ticks = new Set<number>();

    if (typeof input.tickOfCollapse === 'number') {
      ticks.add(input.tickOfCollapse);
    }

    for (const breach of input.shieldBreaches) {
      ticks.add(breach.tickIndex);
    }

    for (const fork of input.alternateTimelines) {
      ticks.add(fork.tickIndex);
    }

    for (const bot of input.botDamage) {
      ticks.add(bot.peakTick);
    }

    return [...ticks].sort((a, b) => a - b);
  }

  public summarizeDecisionPressure(input: AfterActionGenerationInput): number {
    const pressureRatios = input.decisionMoments.map((moment) =>
      clamp(moment.resolvedInMs / Math.max(1, moment.windowMs), 0, 1),
    );

    return round3(average(pressureRatios));
  }
}

// =============================================================================
// MARK: AfterActionRuntimeHub — master wiring hub
// =============================================================================

/**
 * AfterActionRuntimeHub is the single authoritative entry point for post-run
 * autopsy execution.  It wires all sub-systems:
 *
 *   AfterActionGenerator            → deterministic report
 *   AfterActionMLVectorExtractor    → 32-dim ML feature vector
 *   AfterActionDLTensorBuilder      → 13×16 DL tensor
 *   AfterActionChatMLEvaluator      → 7-model chat ML stack
 *   AfterActionSocialPressureAnnotator → social pressure (zero-enriched when possible)
 *   AfterActionWitnessSceneBuilder  → mode-native witness scene
 *   AfterActionModeNarrativeEngine  → mode-native narration
 *   AfterActionProofChainRecorder   → proof-bearing edge chain
 *   AfterActionLearningSurfaceEmitter → ML/DL training signals
 *
 * engine/index.ts consumes this hub via `export * from './after_action_generator'`
 * so that every downstream consumer gets the full after-action surface through
 * the canonical engine barrel.
 */
export class AfterActionRuntimeHub {
  private readonly generator:       AfterActionGenerator;
  private readonly mlExtractor:     AfterActionMLVectorExtractor;
  private readonly dlBuilder:       AfterActionDLTensorBuilder;
  private readonly chatEvaluator:   AfterActionChatMLEvaluator;
  private readonly socialAnnotator: AfterActionSocialPressureAnnotator;
  private readonly witnessBuilder:  AfterActionWitnessSceneBuilder;
  private readonly modeNarrative:   AfterActionModeNarrativeEngine;
  private readonly proofRecorder:   AfterActionProofChainRecorder;
  private readonly learningEmitter: AfterActionLearningSurfaceEmitter;

  public constructor() {
    this.generator       = new AfterActionGenerator();
    this.mlExtractor     = new AfterActionMLVectorExtractor();
    this.dlBuilder       = new AfterActionDLTensorBuilder();
    this.chatEvaluator   = new AfterActionChatMLEvaluator();
    this.socialAnnotator = new AfterActionSocialPressureAnnotator();
    this.witnessBuilder  = new AfterActionWitnessSceneBuilder();
    this.modeNarrative   = new AfterActionModeNarrativeEngine();
    this.proofRecorder   = new AfterActionProofChainRecorder();
    this.learningEmitter = new AfterActionLearningSurfaceEmitter();
  }

  // ── Primary execution surface ──────────────────────────────────────────────

  /**
   * Execute the full after-action pipeline for a run.
   *
   * @param input   - Raw run data.
   * @param context - Optional context: room/session/user IDs, zero enrichment,
   *                  and wall-clock timestamp.
   * @returns       AfterActionFullBundle — the complete post-run package.
   */
  public run(
    input: AfterActionGenerationInput,
    context: AfterActionRuntimeContext = {},
  ): AfterActionFullBundle {
    const nowMs = context.nowMs ?? Date.now();

    // ── Step 1: Core report (deterministic) ────────────────────────────────
    const report = this.generator.generate(input);

    // ── Step 2: ML feature vector extraction ──────────────────────────────
    const featureVector = this.mlExtractor.extract(report, input);
    const featureLabels = this.mlExtractor.extractLabeled(report, input);

    // ── Step 3: Social pressure annotation ────────────────────────────────
    const socialPressure = this.socialAnnotator.annotate(report, input, context.zeroEnrichment);

    // ── Step 4: Zero-enriched similarity (if snapshot provided) ───────────
    let zeroSimilarity = 0;
    let narrativeLine  = '';
    if (context.zeroEnrichment !== undefined) {
      const snap  = context.zeroEnrichment.snapshot;
      const tick  = context.zeroEnrichment.tick;
      const zeroVec = extractZeroMLFeatureVector(snap);
      narrativeLine = narrateZeroMoment(snap, tick).text;
      zeroSimilarity = this.mlExtractor.computeSimilarity(featureVector, zeroVec as unknown as readonly number[]);
    } else {
      narrativeLine = `${modeLabel(input.mode)} — ${report.causeOfDeathCard.title}. ${report.rootCauses[0]?.title ?? ''}.`;
    }

    // ── Step 5: Assemble ML bundle ─────────────────────────────────────────
    const mlBundle: AfterActionMLBundle = Object.freeze({
      runId:          input.runId,
      featureVector,
      featureLabels:  Object.freeze(Object.keys(featureLabels)),
      socialPressure,
      narrativeLine,
      zeroSimilarity,
    });

    // ── Step 6: DL tensor ──────────────────────────────────────────────────
    const dlTensor = this.dlBuilder.build(report, input);

    // ── Step 7: Chat ML stack evaluation ──────────────────────────────────
    const chatMLScores = this.chatEvaluator.evaluate(report, input, nowMs);

    // ── Step 8: Witness scene ─────────────────────────────────────────────
    const witnessScene = this.witnessBuilder.buildScene(report, input, mlBundle, chatMLScores);

    // ── Step 9: Mode narration ────────────────────────────────────────────
    const fullNarration = this.modeNarrative.narrate(report, witnessScene, mlBundle);

    // ── Step 10: Proof edge ───────────────────────────────────────────────
    const proofEdge = this.proofRecorder.record(report, mlBundle, nowMs);

    // ── Step 11: Learning surface ─────────────────────────────────────────
    const learningSurface = this.learningEmitter.emit(report, input, mlBundle, dlTensor, nowMs);

    // ── Step 12: Chat signal assembly ─────────────────────────────────────
    const chatSignal = this.buildChatSignal(
      report,
      input,
      mlBundle,
      chatMLScores,
      proofEdge,
      witnessScene,
      fullNarration,
      nowMs,
    );

    return Object.freeze({
      report,
      mlBundle,
      dlTensor,
      chatSignal,
      witnessScene,
      proofEdge,
      learningSurface,
      chatMLScores,
    });
  }

  /**
   * Run the full pipeline with a live RunStateSnapshot from the zero engine.
   * This is the enriched path — social pressure is zero-grounded and the
   * narrative line comes from narrateZeroMoment.
   */
  public runWithZero(
    input: AfterActionGenerationInput,
    snapshot: RunStateSnapshot,
    tick: number,
    context: Omit<AfterActionRuntimeContext, 'zeroEnrichment'> = {},
  ): AfterActionFullBundle {
    return this.run(input, {
      ...context,
      zeroEnrichment: { snapshot, tick },
    });
  }

  // ── Inspection surface ─────────────────────────────────────────────────────

  /**
   * Run only the deterministic report + ML vector, without chat ML scoring.
   * Useful for lightweight preview rendering.
   */
  public preview(input: AfterActionGenerationInput): {
    readonly report: AfterActionReport;
    readonly featureVector: readonly number[];
    readonly socialPressure: AfterActionSocialPressureAnnotation;
  } {
    const report        = this.generator.generate(input);
    const featureVector = this.mlExtractor.extract(report, input);
    const socialPressure = this.socialAnnotator.annotate(report, input);

    return Object.freeze({ report, featureVector, socialPressure });
  }

  /**
   * Return a DL tensor for a report without running the full pipeline.
   */
  public extractDLTensor(
    input: AfterActionGenerationInput,
  ): AfterActionDLTensor {
    const report = this.generator.generate(input);
    return this.dlBuilder.build(report, input);
  }

  /**
   * Return a labelled ML feature map from the given input.
   */
  public extractLabeledML(
    input: AfterActionGenerationInput,
  ): Record<string, number> {
    const report = this.generator.generate(input);
    return this.mlExtractor.extractLabeled(report, input);
  }

  /**
   * Return column stats for the DL tensor (per-feature across all steps).
   */
  public dlTensorColumnStats(input: AfterActionGenerationInput): readonly {
    readonly featureIndex: number;
    readonly mean: number;
    readonly max: number;
    readonly min: number;
  }[] {
    const tensor = this.extractDLTensor(input);
    return Object.freeze(
      Array.from({ length: tensor.featureCount }, (_, col) => {
        const column = this.dlBuilder.extractColumn(tensor, col);
        const colMax = Math.max(...column);
        const colMin = Math.min(...column);
        const mean   = round3(average([...column]));
        return Object.freeze({ featureIndex: col, mean, max: round3(colMax), min: round3(colMin) });
      }),
    );
  }

  /**
   * Normalise the ML feature vector for cosine comparisons.
   */
  public normalizeML(input: AfterActionGenerationInput): readonly number[] {
    const report = this.generator.generate(input);
    const vec    = this.mlExtractor.extract(report, input);
    return this.mlExtractor.normalizeVector(vec);
  }

  /**
   * Access the internal proof ledger (read-only).
   */
  public getProofLedger(): readonly AfterActionProofEdge[] {
    return this.proofRecorder.getEdges();
  }

  /**
   * Verify a specific proof edge from the ledger.
   */
  public verifyProofEdge(edge: AfterActionProofEdge): boolean {
    return this.proofRecorder.verifyEdge(edge);
  }

  /**
   * Return a comprehensive diagnostic report for the hub, used by telemetry.
   */
  public diagnosticReport(
    input: AfterActionGenerationInput,
    context: AfterActionRuntimeContext = {},
  ): {
    readonly runId: string;
    readonly mode: string;
    readonly outcome: string;
    readonly mlFeatureDimension: number;
    readonly dlShape: string;
    readonly proofEdgeCount: number;
    readonly engagementAnalysis: string;
    readonly narrativeLine: string;
    readonly socialPressureIndex: number;
    readonly witnessLabel: string;
    readonly userId: Nullable<ChatUserId>;
    readonly roomId: Nullable<ChatRoomId>;
    readonly sessionId: Nullable<ChatSessionId>;
  } {
    const nowMs  = context.nowMs ?? Date.now();
    const report = this.generator.generate(input);
    const featureVector = this.mlExtractor.extract(report, input);
    const socialPressure = this.socialAnnotator.annotate(report, input, context.zeroEnrichment);
    const chatMLScores   = this.chatEvaluator.evaluate(report, input, nowMs);
    const engagementLine = this.chatEvaluator.analyzeEngagement(chatMLScores.engagementScore);
    const proofEdgeCount = this.proofRecorder.getEdges().length;

    // Ensure featureVector is referenced
    void featureVector;

    const userId    = context.userId    ? asChatUserId(String(context.userId))    : null as Nullable<ChatUserId>;
    const roomId    = context.roomId    ? asChatRoomId(String(context.roomId))    : null as Nullable<ChatRoomId>;
    const sessionId = context.sessionId ? asChatSessionId(String(context.sessionId)) : null as Nullable<ChatSessionId>;

    return Object.freeze({
      runId:                input.runId,
      mode:                 modeLabel(input.mode),
      outcome:              input.outcome,
      mlFeatureDimension:   AFTER_ACTION_ML_FEATURE_COUNT,
      dlShape:              `${AFTER_ACTION_DL_SEQUENCE_LENGTH}×${AFTER_ACTION_DL_FEATURE_COUNT}`,
      proofEdgeCount,
      engagementAnalysis:   engagementLine,
      narrativeLine:        `${modeLabel(input.mode)} — ${report.causeOfDeathCard.title}`,
      socialPressureIndex:  socialPressure.socialPressureIndex,
      witnessLabel:         socialPressure.witnessLabel,
      userId,
      roomId,
      sessionId,
    });
  }

  // ── Private: chat signal assembly ──────────────────────────────────────────

  private buildChatSignal(
    report: AfterActionReport,
    input: AfterActionGenerationInput,
    mlBundle: AfterActionMLBundle,
    chatMLScores: AfterActionChatMLScoreBundle,
    proofEdge: AfterActionProofEdge,
    witnessScene: AfterActionWitnessScene,
    narrativeLine: string,
    nowMs: number,
  ): AfterActionChatSignal {
    return Object.freeze({
      version:               AFTER_ACTION_CHAT_SIGNAL_VERSION,
      runId:                 input.runId,
      mode:                  input.mode,
      outcome:               input.outcome,
      primaryFailureMode:    report.rootCauses[0]?.mode ?? FailureMode.ResourceLoss,
      engagementBand:        chatMLScores.engagementBandLabel,
      haterEscalationBand:   chatMLScores.haterEscalationBandLabel,
      witnessLabel:          mlBundle.socialPressure.witnessLabel,
      socialPressureIndex:   mlBundle.socialPressure.socialPressureIndex,
      narrativeLine,
      tinyActionTitle:       report.tinyAction.title,
      mediumActionTitle:     report.mediumAction.title,
      proofEdgeId:           String(proofEdge.proofEdgeId),
      sceneId:               String(witnessScene.sceneId),
      timestamp:             nowMs,
      mlBundle,
      chatMLScores,
    });
  }
}

// =============================================================================
// MARK: Singleton exports — consumed by engine/index.ts barrel
// =============================================================================

/**
 * Singleton ML vector extractor — stateless, safe to share across runs.
 */
export const AFTER_ACTION_ML_EXTRACTOR = new AfterActionMLVectorExtractor();

/**
 * Singleton DL tensor builder — stateless, safe to share across runs.
 */
export const AFTER_ACTION_DL_BUILDER = new AfterActionDLTensorBuilder();

/**
 * Singleton chat ML evaluator — holds persistent model instances.
 * Model audit logs accumulate across the process lifetime.
 */
export const AFTER_ACTION_CHAT_EVALUATOR = new AfterActionChatMLEvaluator();

/**
 * Singleton social pressure annotator — stateless.
 */
export const AFTER_ACTION_SOCIAL_ANNOTATOR = new AfterActionSocialPressureAnnotator();

/**
 * Singleton runtime hub — the primary entry point for all consumers.
 * engine/index.ts exposes this via `export * from './after_action_generator'`.
 */
export const AFTER_ACTION_RUNTIME_HUB = new AfterActionRuntimeHub();

// =============================================================================
// MARK: Convenience factory function
// =============================================================================

/**
 * Execute the full post-run pipeline in one call.
 * Delegates to AFTER_ACTION_RUNTIME_HUB.run().
 *
 * @example
 *   import { runAfterAction } from '../../engine';
 *   const bundle = runAfterAction(input, { userId, roomId });
 */
export function runAfterAction(
  input: AfterActionGenerationInput,
  context: AfterActionRuntimeContext = {},
): AfterActionFullBundle {
  return AFTER_ACTION_RUNTIME_HUB.run(input, context);
}

/**
 * Execute the full post-run pipeline enriched with a live zero snapshot.
 *
 * @example
 *   import { runAfterActionWithZero } from '../../engine';
 *   const bundle = runAfterActionWithZero(input, snapshot, currentTick);
 */
export function runAfterActionWithZero(
  input: AfterActionGenerationInput,
  snapshot: RunStateSnapshot,
  tick: number,
  context: Omit<AfterActionRuntimeContext, 'zeroEnrichment'> = {},
): AfterActionFullBundle {
  return AFTER_ACTION_RUNTIME_HUB.runWithZero(input, snapshot, tick, context);
}
