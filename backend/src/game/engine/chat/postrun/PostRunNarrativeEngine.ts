/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT POST-RUN NARRATIVE ENGINE
 * FILE: backend/src/game/engine/chat/postrun/PostRunNarrativeEngine.ts
 * VERSION: 2026.03.22
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Compose the authoritative backend post-run ritual.
 *
 * Frontend staging already gives the pzo-web lane immediate ritual structure.
 * This file is the backend truth layer that can confirm, reshape, and persist
 * the authored reading of the run. Every evaluation this engine produces is
 * the canonical version that downstream systems (socket fanout, storage, world
 * scheduler, reward grant) treat as source of truth.
 *
 * This engine answers:
 * - What kind of post-run rite should this room receive?
 * - What turning point owns the narrative interpretation?
 * - How should blame, directive, and foreshadow be shaped?
 * - Which witness lines survive into the authoritative plan?
 * - Which beats are visible, shadow, replayable, or archivable?
 * - What summary/archive/ledger bundle should downstream transport use?
 * - Is this run eligible for legend escalation, world echo, or replay anchor?
 *
 * Engine profiles
 * ---------------
 * CINEMATIC          Full beat sequence, long witness delays, foreshadow, legend hooks
 * DEBRIEF            Analytical tone, blame-centric, ANALYSIS witness stances, minimal silence
 * COLD_CLOSE         Sparse beats, SILENCE prominent, SHADOW_ONLY preferred
 * GRIEF              Loss-tuned, GRIEF/MERCY stances, rival mockery suppressed
 * SOVEREIGN_CEREMONY Victory-tuned, REWARD_NOTICE and LEGEND_NOTICE beats foregrounded
 * LEGEND_CEREMONY    Legend-escalation focused, AWE stances, maximum depth
 * RAPID              Minimal delays, fast settle, fewest beats for high-throughput rooms
 *
 * Beat kinds authored by this engine
 * ------------------------------------
 * SYSTEM_VERDICT · WITNESS_LINE · HELPER_EPITAPH · RIVAL_MOCKERY
 * CROWD_JUDGMENT · DEBRIEF_FACT · TURNING_POINT_CARD · BLAME_CARD
 * SUMMARY_CARD · LEGEND_NOTICE · REWARD_NOTICE · FORESHADOW_LINE
 * SILENCE · WORLD_REACTION
 *
 * What this file does NOT own
 * ---------------------------
 * - Socket fanout
 * - Reducer delivery mutation
 * - World-event scheduling
 * - Reward grant execution
 * ============================================================================
 */

import type {
  ChatRoomId,
  ChatVisibleChannel,
  JsonObject,
  UnixMs,
} from '../../../../../../shared/contracts/chat/ChatChannels';
import type { ChatMoment } from '../../../../../../shared/contracts/chat/ChatMoment';
import {
  buildDefaultBlameVector,
  buildDefaultPostRunBeat,
  buildDefaultPostRunWitness,
  buildMinimalPostRunPlan,
  buildPostRunArchiveEntry,
  buildPostRunDigest,
  buildPostRunSummaryCard,
  choosePrimaryBlameVector,
  collectPostRunChannels,
  countPostRunBeatsByKind,
  createEmptyPostRunRuntimeState,
  createPostRunReceipt,
  deriveDominantVisibleChannel,
  derivePostRunArchivePolicy,
  derivePostRunClass,
  derivePostRunClosureBand,
  derivePostRunLedgerEntry,
  derivePostRunTone,
  derivePostRunVisibility,
  derivePrimaryWitnessStance,
  deriveSummaryClass,
  normalizePostRunPlan,
  postRunPlanSupportsReplay,
  postRunPlanSupportsWorldEcho,
  projectPostRunThread,
  scoreBlameVector,
  shouldAnchorPostRunMemory,
  shouldBroadcastPostRunPublicly,
  shouldEscalatePostRunToLegend,
  sortPostRunBeats,
  summarizePostRunPlan,
  summarizePrimaryBlame,
  summarizePrimaryDirective,
  summarizePrimaryForeshadow,
  summarizeTurningPoint,
  toPostRunScore01,
  type ChatPostRunArchiveEntry,
  type ChatPostRunBeat,
  type ChatPostRunBlameVector,
  type ChatPostRunDirective,
  type ChatPostRunDigest,
  type ChatPostRunEvidenceSnapshot,
  type ChatPostRunForeshadow,
  type ChatPostRunKind,
  type ChatPostRunLedgerEntry,
  type ChatPostRunPlan,
  type ChatPostRunRuntimeState,
  type ChatPostRunSummaryCard,
  type ChatPostRunSummaryClass,
  type ChatPostRunTone,
  type ChatPostRunVisibilityMode,
  type ChatPostRunWitness,
  type ChatTurningPoint,
  type ChatTurningPointCandidate,
} from '../../../../../../shared/contracts/chat/ChatPostRun';
import {
  createForeshadowPlanner,
  ForeshadowPlanner,
  type ForeshadowPlannerOptions,
  type ForeshadowPlanningContext,
  type ForeshadowPlanningResult,
} from './ForeshadowPlanner';
import {
  createTurningPointResolver,
  TurningPointResolver,
  type TurningPointResolution,
  type TurningPointResolverContext,
  type TurningPointResolverOptions,
} from './TurningPointResolver';

// ============================================================================
// MARK: Engine profile types
// ============================================================================

/**
 * Pre-tuned engine behavior profiles for common post-run scenarios.
 *
 * Profiles change default delays, witness inclusion rules, beat selection,
 * and stance priors. They do not override explicitly provided options.
 */
export type PostRunNarrativeEngineProfile =
  | 'CINEMATIC'           // Full depth: all beats, witnesses, foreshadow, legend hooks
  | 'DEBRIEF'             // Analytical: blame-centric, ANALYSIS stances, no silence
  | 'COLD_CLOSE'          // Sparse: silence-prominent, shadow-only preference
  | 'GRIEF'               // Loss-tuned: GRIEF stances, rival suppressed
  | 'SOVEREIGN_CEREMONY'  // Victory-tuned: REWARD_NOTICE, LEGEND_NOTICE foregrounded
  | 'LEGEND_CEREMONY'     // Legend-escalation: AWE stances, full depth
  | 'RAPID';              // Throughput: minimal delays, fast settle, fewest beats

/** Partial option set that a profile applies on top of defaults. */
export interface PostRunNarrativeProfileConfig {
  readonly label: PostRunNarrativeEngineProfile;
  readonly maxWitnesses: number;
  readonly includeSilenceBeat: boolean;
  readonly includeCrowdWitness: boolean;
  readonly includeHelperWitness: boolean;
  readonly includeRivalWitness: boolean;
  readonly includeSummaryBeat: boolean;
  readonly includeForeshadowBeat: boolean;
  readonly includeDirectiveBeat: boolean;
  readonly includeWorldReactionBeat: boolean;
  readonly includeLegendNoticeBeat: boolean;
  readonly includeRewardNoticeBeat: boolean;
  readonly includeCrowdJudgmentBeat: boolean;
  readonly settleImmediately: boolean;
  readonly verdictDelayMs: number;
  readonly witnessBaseDelayMs: number;
  readonly summaryDelayMs: number;
  readonly foreshadowDelayMs: number;
  readonly directiveDelayMs: number;
  readonly silenceDurationMs: number;
}

export const POST_RUN_NARRATIVE_PROFILE_OPTIONS: Readonly<
  Record<PostRunNarrativeEngineProfile, PostRunNarrativeProfileConfig>
> = Object.freeze({
  CINEMATIC: Object.freeze({
    label: 'CINEMATIC',
    maxWitnesses: 4,
    includeSilenceBeat: true,
    includeCrowdWitness: true,
    includeHelperWitness: true,
    includeRivalWitness: true,
    includeSummaryBeat: true,
    includeForeshadowBeat: true,
    includeDirectiveBeat: true,
    includeWorldReactionBeat: true,
    includeLegendNoticeBeat: true,
    includeRewardNoticeBeat: false,
    includeCrowdJudgmentBeat: true,
    settleImmediately: true,
    verdictDelayMs: 0,
    witnessBaseDelayMs: 1_200,
    summaryDelayMs: 2_800,
    foreshadowDelayMs: 4_000,
    directiveDelayMs: 3_400,
    silenceDurationMs: 1_800,
  }),
  DEBRIEF: Object.freeze({
    label: 'DEBRIEF',
    maxWitnesses: 2,
    includeSilenceBeat: false,
    includeCrowdWitness: false,
    includeHelperWitness: true,
    includeRivalWitness: false,
    includeSummaryBeat: true,
    includeForeshadowBeat: false,
    includeDirectiveBeat: true,
    includeWorldReactionBeat: false,
    includeLegendNoticeBeat: false,
    includeRewardNoticeBeat: false,
    includeCrowdJudgmentBeat: false,
    settleImmediately: true,
    verdictDelayMs: 0,
    witnessBaseDelayMs: 600,
    summaryDelayMs: 1_400,
    foreshadowDelayMs: 2_000,
    directiveDelayMs: 1_800,
    silenceDurationMs: 0,
  }),
  COLD_CLOSE: Object.freeze({
    label: 'COLD_CLOSE',
    maxWitnesses: 1,
    includeSilenceBeat: true,
    includeCrowdWitness: false,
    includeHelperWitness: false,
    includeRivalWitness: false,
    includeSummaryBeat: false,
    includeForeshadowBeat: false,
    includeDirectiveBeat: false,
    includeWorldReactionBeat: false,
    includeLegendNoticeBeat: false,
    includeRewardNoticeBeat: false,
    includeCrowdJudgmentBeat: false,
    settleImmediately: true,
    verdictDelayMs: 0,
    witnessBaseDelayMs: 400,
    summaryDelayMs: 1_000,
    foreshadowDelayMs: 1_400,
    directiveDelayMs: 1_200,
    silenceDurationMs: 2_200,
  }),
  GRIEF: Object.freeze({
    label: 'GRIEF',
    maxWitnesses: 3,
    includeSilenceBeat: true,
    includeCrowdWitness: true,
    includeHelperWitness: true,
    includeRivalWitness: false,
    includeSummaryBeat: true,
    includeForeshadowBeat: true,
    includeDirectiveBeat: true,
    includeWorldReactionBeat: false,
    includeLegendNoticeBeat: false,
    includeRewardNoticeBeat: false,
    includeCrowdJudgmentBeat: false,
    settleImmediately: true,
    verdictDelayMs: 0,
    witnessBaseDelayMs: 1_000,
    summaryDelayMs: 2_400,
    foreshadowDelayMs: 3_400,
    directiveDelayMs: 3_000,
    silenceDurationMs: 2_000,
  }),
  SOVEREIGN_CEREMONY: Object.freeze({
    label: 'SOVEREIGN_CEREMONY',
    maxWitnesses: 4,
    includeSilenceBeat: false,
    includeCrowdWitness: true,
    includeHelperWitness: true,
    includeRivalWitness: true,
    includeSummaryBeat: true,
    includeForeshadowBeat: true,
    includeDirectiveBeat: false,
    includeWorldReactionBeat: true,
    includeLegendNoticeBeat: true,
    includeRewardNoticeBeat: true,
    includeCrowdJudgmentBeat: true,
    settleImmediately: true,
    verdictDelayMs: 0,
    witnessBaseDelayMs: 1_100,
    summaryDelayMs: 2_600,
    foreshadowDelayMs: 3_600,
    directiveDelayMs: 3_200,
    silenceDurationMs: 1_000,
  }),
  LEGEND_CEREMONY: Object.freeze({
    label: 'LEGEND_CEREMONY',
    maxWitnesses: 5,
    includeSilenceBeat: true,
    includeCrowdWitness: true,
    includeHelperWitness: true,
    includeRivalWitness: true,
    includeSummaryBeat: true,
    includeForeshadowBeat: true,
    includeDirectiveBeat: true,
    includeWorldReactionBeat: true,
    includeLegendNoticeBeat: true,
    includeRewardNoticeBeat: true,
    includeCrowdJudgmentBeat: true,
    settleImmediately: true,
    verdictDelayMs: 0,
    witnessBaseDelayMs: 1_400,
    summaryDelayMs: 3_200,
    foreshadowDelayMs: 4_600,
    directiveDelayMs: 4_000,
    silenceDurationMs: 1_600,
  }),
  RAPID: Object.freeze({
    label: 'RAPID',
    maxWitnesses: 1,
    includeSilenceBeat: false,
    includeCrowdWitness: false,
    includeHelperWitness: false,
    includeRivalWitness: false,
    includeSummaryBeat: true,
    includeForeshadowBeat: false,
    includeDirectiveBeat: false,
    includeWorldReactionBeat: false,
    includeLegendNoticeBeat: false,
    includeRewardNoticeBeat: false,
    includeCrowdJudgmentBeat: false,
    settleImmediately: true,
    verdictDelayMs: 0,
    witnessBaseDelayMs: 150,
    summaryDelayMs: 400,
    foreshadowDelayMs: 600,
    directiveDelayMs: 500,
    silenceDurationMs: 0,
  }),
} as const);

// ============================================================================
// MARK: Engine options
// ============================================================================

export interface PostRunNarrativeEngineOptions {
  /** Pre-tuned profile; individual option fields override the profile. */
  readonly profile?: PostRunNarrativeEngineProfile;
  readonly maxWitnesses?: number;
  readonly includeSilenceBeat?: boolean;
  readonly includeCrowdWitness?: boolean;
  readonly includeHelperWitness?: boolean;
  readonly includeRivalWitness?: boolean;
  readonly includeSummaryBeat?: boolean;
  readonly includeForeshadowBeat?: boolean;
  readonly includeDirectiveBeat?: boolean;
  /** Whether to emit a WORLD_REACTION beat when worldEventIds are present. */
  readonly includeWorldReactionBeat?: boolean;
  /** Whether to emit a LEGEND_NOTICE beat when legend escalation is eligible. */
  readonly includeLegendNoticeBeat?: boolean;
  /** Whether to emit a REWARD_NOTICE beat on VICTORY or SOVEREIGNTY outcomes. */
  readonly includeRewardNoticeBeat?: boolean;
  /** Whether to emit a CROWD_JUDGMENT beat after witness staging. */
  readonly includeCrowdJudgmentBeat?: boolean;
  readonly settleImmediately?: boolean;
  readonly defaultVisibleChannel?: ChatVisibleChannel;
  readonly verdictDelayMs?: number;
  readonly witnessBaseDelayMs?: number;
  readonly summaryDelayMs?: number;
  readonly foreshadowDelayMs?: number;
  readonly directiveDelayMs?: number;
  readonly silenceDurationMs?: number;
  readonly turningPointResolver?: TurningPointResolver;
  readonly turningPointResolverOptions?: TurningPointResolverOptions;
  readonly foreshadowPlanner?: ForeshadowPlanner;
  readonly foreshadowPlannerOptions?: ForeshadowPlannerOptions;
}

type ResolvedEngineOptions = Required<
  Omit<
    PostRunNarrativeEngineOptions,
    | 'profile'
    | 'turningPointResolver'
    | 'turningPointResolverOptions'
    | 'foreshadowPlanner'
    | 'foreshadowPlannerOptions'
  >
>;

// ============================================================================
// MARK: Context and evaluation types
// ============================================================================

export interface PostRunNarrativeContext {
  readonly postRunId: ChatPostRunPlan['postRunId'];
  readonly bundleId: ChatPostRunPlan['bundleId'];
  readonly roomId: ChatRoomId;
  readonly kind: ChatPostRunKind;
  readonly evidence: ChatPostRunEvidenceSnapshot;
  readonly moments?: readonly ChatMoment[];
  readonly turningPointCandidates?: readonly ChatTurningPointCandidate[];
  readonly blameVectors?: readonly ChatPostRunBlameVector[];
  readonly directives?: readonly ChatPostRunDirective[];
  readonly foreshadow?: readonly ChatPostRunForeshadow[];
  readonly witnesses?: readonly ChatPostRunWitness[];
  readonly previousPlan?: ChatPostRunPlan | null;
  readonly preferredVisibleChannel?: ChatVisibleChannel;
  readonly relatedNpcIds?: readonly string[];
  readonly payload?: JsonObject;
  readonly createdAt?: UnixMs;
  /**
   * When true, force SOVEREIGN_CEREMONY beat expansion regardless of outcome.
   * Useful for editorial overrides from the live-ops layer.
   */
  readonly forceSOVEREIGNCeremony?: boolean;
  /**
   * When true, suppress rival mockery regardless of outcome or profile.
   */
  readonly suppressRivalMockery?: boolean;
  /**
   * When true, suppress all foreshadow output even if foreshadow planner
   * produces entries.
   */
  readonly suppressForeshadow?: boolean;
}

export interface PostRunNarrativeReasoning {
  readonly turningPointReason: string;
  readonly blameReason: string;
  readonly witnessReason: string;
  readonly beatReason: string;
  readonly visibilityReason: string;
  readonly legendEscalationReason: string;
  readonly profileApplied: PostRunNarrativeEngineProfile | null;
}

export interface PostRunNarrativeEvaluation {
  readonly roomId: ChatRoomId;
  readonly evaluatedAt: UnixMs;
  readonly plan: ChatPostRunPlan;
  readonly archiveEntry: ChatPostRunArchiveEntry;
  readonly digest: ChatPostRunDigest;
  readonly ledgerEntry: ChatPostRunLedgerEntry;
  readonly runtimeState: ChatPostRunRuntimeState;
  readonly dominantChannel?: ChatVisibleChannel;
  readonly dominantTone: ChatPostRunTone;
  readonly summaryClass: ChatPostRunSummaryClass;
  readonly primaryTurningPoint: ChatTurningPoint | null;
  readonly primaryBlame: ChatPostRunBlameVector | null;
  readonly publicBroadcastRecommended: boolean;
  readonly replayPersistenceRecommended: boolean;
  readonly worldEchoRecommended: boolean;
  readonly turningPointResolution: TurningPointResolution;
  readonly foreshadowPlan: ForeshadowPlanningResult;
  readonly reasoning: PostRunNarrativeReasoning;
}

export interface PostRunNarrativeEngineSnapshot {
  readonly snapshotVersion: '1.0';
  readonly capturedAt: UnixMs;
  readonly byRoom: Readonly<Record<ChatRoomId, PostRunNarrativeEvaluation>>;
}

// ============================================================================
// MARK: Validation types
// ============================================================================

export type PostRunNarrativeValidationSeverity = 'ERROR' | 'WARNING' | 'INFO';

export interface PostRunNarrativeValidationIssue {
  readonly code: string;
  readonly message: string;
  readonly severity: PostRunNarrativeValidationSeverity;
  readonly field?: string;
}

export interface PostRunNarrativePlanValidation {
  readonly valid: boolean;
  readonly issues: readonly PostRunNarrativeValidationIssue[];
  readonly errorCount: number;
  readonly warningCount: number;
  readonly infoCount: number;
}

// ============================================================================
// MARK: Diagnostics and audit types
// ============================================================================

export interface PostRunNarrativeDiagnostics {
  readonly roomId: ChatRoomId;
  readonly evaluatedAt: UnixMs;
  readonly beatCount: number;
  readonly witnessCount: number;
  readonly blameVectorCount: number;
  readonly foreshadowCount: number;
  readonly directiveCount: number;
  readonly dominantTone: ChatPostRunTone;
  readonly visibility: ChatPostRunVisibilityMode;
  readonly turningPointResolved: boolean;
  readonly legendEscalationEligible: boolean;
  readonly publicBroadcastRecommended: boolean;
  readonly replayPersistenceRecommended: boolean;
  readonly worldEchoRecommended: boolean;
  readonly beatsByKind: Partial<Record<string, number>>;
  readonly witnessesByRole: Partial<Record<string, number>>;
  readonly profileApplied: PostRunNarrativeEngineProfile | null;
}

export interface PostRunNarrativeAuditReport {
  readonly roomId: ChatRoomId;
  readonly evaluatedAt: UnixMs;
  readonly plan: ChatPostRunPlan;
  readonly diagnostics: PostRunNarrativeDiagnostics;
  readonly validation: PostRunNarrativePlanValidation;
  readonly turningPointResolution: TurningPointResolution;
  readonly foreshadowPlan: ForeshadowPlanningResult;
  readonly reasoning: PostRunNarrativeReasoning;
}

// ============================================================================
// MARK: Diff and stats types
// ============================================================================

export interface PostRunNarrativePlanDiff {
  readonly roomId: ChatRoomId;
  readonly previousPlanId: string | null;
  readonly currentPlanId: string;
  readonly beatCountDelta: number;
  readonly witnessCountDelta: number;
  readonly blameCountDelta: number;
  readonly foreshadowCountDelta: number;
  readonly toneChanged: boolean;
  readonly visibilityChanged: boolean;
  readonly turningPointChanged: boolean;
  readonly previousTone: ChatPostRunTone | null;
  readonly currentTone: ChatPostRunTone;
  readonly previousVisibility: ChatPostRunVisibilityMode | null;
  readonly currentVisibility: ChatPostRunVisibilityMode;
  readonly addedBeatKinds: readonly string[];
  readonly removedBeatKinds: readonly string[];
}

export interface PostRunNarrativeStatsSummary {
  readonly totalEvaluations: number;
  readonly roomCount: number;
  readonly outcomeBreakdown: Readonly<Record<string, number>>;
  readonly legendEscalationCount: number;
  readonly publicBroadcastCount: number;
  readonly replayCount: number;
  readonly worldEchoCount: number;
  readonly averageBeatCount: number;
  readonly averageWitnessCount: number;
  readonly averageBlameCount: number;
  readonly averageForeshadowCount: number;
}

// ============================================================================
// MARK: Serialization types
// ============================================================================

export interface PostRunNarrativeEngineSerializedState {
  readonly version: '1.0';
  readonly serializedAt: UnixMs;
  readonly profile: PostRunNarrativeEngineProfile | null;
  readonly roomCount: number;
  readonly evaluations: readonly PostRunNarrativeEvaluation[];
}

// ============================================================================
// MARK: Default options
// ============================================================================

const DEFAULT_OPTIONS: ResolvedEngineOptions = Object.freeze({
  maxWitnesses: 4,
  includeSilenceBeat: true,
  includeCrowdWitness: true,
  includeHelperWitness: true,
  includeRivalWitness: true,
  includeSummaryBeat: true,
  includeForeshadowBeat: true,
  includeDirectiveBeat: true,
  includeWorldReactionBeat: false,
  includeLegendNoticeBeat: false,
  includeRewardNoticeBeat: false,
  includeCrowdJudgmentBeat: false,
  settleImmediately: true,
  defaultVisibleChannel: 'GLOBAL',
  verdictDelayMs: 0,
  witnessBaseDelayMs: 900,
  summaryDelayMs: 2_250,
  foreshadowDelayMs: 3_250,
  directiveDelayMs: 2_850,
  silenceDurationMs: 1_150,
});

// ============================================================================
// MARK: Internal helpers
// ============================================================================

function nowMs(): UnixMs {
  return Date.now() as UnixMs;
}

function compact<TValue>(values: readonly (TValue | null | undefined | false)[]): TValue[] {
  return values.filter(Boolean) as TValue[];
}

function uniqueBy<TValue, TKey>(
  values: readonly TValue[],
  keyFn: (value: TValue) => TKey,
): TValue[] {
  const seen = new Set<TKey>();
  const result: TValue[] = [];
  for (const value of values) {
    const key = keyFn(value);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function isCollapse(outcome: ChatPostRunEvidenceSnapshot['runOutcome']): boolean {
  return outcome === 'LOSS' || outcome === 'BANKRUPTCY';
}

function isVictory(outcome: ChatPostRunEvidenceSnapshot['runOutcome']): boolean {
  return outcome === 'VICTORY' || outcome === 'SOVEREIGNTY';
}

function isSovereignty(outcome: ChatPostRunEvidenceSnapshot['runOutcome']): boolean {
  return outcome === 'SOVEREIGNTY';
}

function isBankruptcy(outcome: ChatPostRunEvidenceSnapshot['runOutcome']): boolean {
  return outcome === 'BANKRUPTCY';
}

function isLoss(outcome: ChatPostRunEvidenceSnapshot['runOutcome']): boolean {
  return outcome === 'LOSS';
}

/**
 * Resolve the best witness stance for a given actor role and outcome.
 * All returned values are valid `ChatPostRunWitnessStance` members.
 */
function resolveHelperStance(
  outcome: ChatPostRunEvidenceSnapshot['runOutcome'],
): ChatPostRunWitness['stance'] {
  if (isCollapse(outcome)) return 'GRIEF';
  if (isSovereignty(outcome)) return 'AWE';
  if (isVictory(outcome)) return 'RESPECT';
  return 'ANALYSIS';
}

function resolveRivalStance(
  outcome: ChatPostRunEvidenceSnapshot['runOutcome'],
): ChatPostRunWitness['stance'] {
  if (isCollapse(outcome)) return 'OPPORTUNISM';
  if (isSovereignty(outcome)) return 'FEAR';
  if (isVictory(outcome)) return 'CONTEMPT';
  return 'CONTEMPT';
}

function resolveCrowdStance(
  outcome: ChatPostRunEvidenceSnapshot['runOutcome'],
  derivedFromWitnesses: ChatPostRunWitness['stance'] | null,
): ChatPostRunWitness['stance'] {
  if (derivedFromWitnesses) return derivedFromWitnesses;
  if (isCollapse(outcome)) return 'CONTEMPT';
  if (isSovereignty(outcome)) return 'AWE';
  if (isVictory(outcome)) return 'RESPECT';
  return 'ANALYSIS';
}

/**
 * Merge profile options into the provided options. Explicit option overrides
 * always win over the profile.
 */
function resolveOptions(options: PostRunNarrativeEngineOptions): ResolvedEngineOptions {
  const profileConfig = options.profile
    ? POST_RUN_NARRATIVE_PROFILE_OPTIONS[options.profile]
    : null;

  return Object.freeze({
    maxWitnesses: options.maxWitnesses ?? profileConfig?.maxWitnesses ?? DEFAULT_OPTIONS.maxWitnesses,
    includeSilenceBeat: options.includeSilenceBeat ?? profileConfig?.includeSilenceBeat ?? DEFAULT_OPTIONS.includeSilenceBeat,
    includeCrowdWitness: options.includeCrowdWitness ?? profileConfig?.includeCrowdWitness ?? DEFAULT_OPTIONS.includeCrowdWitness,
    includeHelperWitness: options.includeHelperWitness ?? profileConfig?.includeHelperWitness ?? DEFAULT_OPTIONS.includeHelperWitness,
    includeRivalWitness: options.includeRivalWitness ?? profileConfig?.includeRivalWitness ?? DEFAULT_OPTIONS.includeRivalWitness,
    includeSummaryBeat: options.includeSummaryBeat ?? profileConfig?.includeSummaryBeat ?? DEFAULT_OPTIONS.includeSummaryBeat,
    includeForeshadowBeat: options.includeForeshadowBeat ?? profileConfig?.includeForeshadowBeat ?? DEFAULT_OPTIONS.includeForeshadowBeat,
    includeDirectiveBeat: options.includeDirectiveBeat ?? profileConfig?.includeDirectiveBeat ?? DEFAULT_OPTIONS.includeDirectiveBeat,
    includeWorldReactionBeat: options.includeWorldReactionBeat ?? profileConfig?.includeWorldReactionBeat ?? DEFAULT_OPTIONS.includeWorldReactionBeat,
    includeLegendNoticeBeat: options.includeLegendNoticeBeat ?? profileConfig?.includeLegendNoticeBeat ?? DEFAULT_OPTIONS.includeLegendNoticeBeat,
    includeRewardNoticeBeat: options.includeRewardNoticeBeat ?? profileConfig?.includeRewardNoticeBeat ?? DEFAULT_OPTIONS.includeRewardNoticeBeat,
    includeCrowdJudgmentBeat: options.includeCrowdJudgmentBeat ?? profileConfig?.includeCrowdJudgmentBeat ?? DEFAULT_OPTIONS.includeCrowdJudgmentBeat,
    settleImmediately: options.settleImmediately ?? profileConfig?.settleImmediately ?? DEFAULT_OPTIONS.settleImmediately,
    defaultVisibleChannel: options.defaultVisibleChannel ?? DEFAULT_OPTIONS.defaultVisibleChannel,
    verdictDelayMs: options.verdictDelayMs ?? profileConfig?.verdictDelayMs ?? DEFAULT_OPTIONS.verdictDelayMs,
    witnessBaseDelayMs: options.witnessBaseDelayMs ?? profileConfig?.witnessBaseDelayMs ?? DEFAULT_OPTIONS.witnessBaseDelayMs,
    summaryDelayMs: options.summaryDelayMs ?? profileConfig?.summaryDelayMs ?? DEFAULT_OPTIONS.summaryDelayMs,
    foreshadowDelayMs: options.foreshadowDelayMs ?? profileConfig?.foreshadowDelayMs ?? DEFAULT_OPTIONS.foreshadowDelayMs,
    directiveDelayMs: options.directiveDelayMs ?? profileConfig?.directiveDelayMs ?? DEFAULT_OPTIONS.directiveDelayMs,
    silenceDurationMs: options.silenceDurationMs ?? profileConfig?.silenceDurationMs ?? DEFAULT_OPTIONS.silenceDurationMs,
  });
}

function chooseNarrativeVisibility(
  evidence: ChatPostRunEvidenceSnapshot,
  turningPoint: ChatTurningPoint | null,
  preferredChannel?: ChatVisibleChannel,
): ChatPostRunVisibilityMode {
  return derivePostRunVisibility({
    preferredChannel: preferredChannel ?? turningPoint?.compactMoment?.visibleChannel,
    outcome: evidence.runOutcome,
    primaryTurningPoint: turningPoint ?? undefined,
    dominantHeat: (preferredChannel ?? turningPoint?.compactMoment?.visibleChannel)
      ? evidence.audienceHeat[
          (preferredChannel ?? turningPoint?.compactMoment?.visibleChannel)!
        ]
      : undefined,
    replayId: evidence.replayId,
    legendId: evidence.legendId,
  });
}

function dominantBeatChannel(
  beats: readonly ChatPostRunBeat[],
  fallback: ChatVisibleChannel,
): ChatVisibleChannel {
  return deriveDominantVisibleChannel(beats) ?? fallback;
}

function beatVisible(
  visibility: ChatPostRunVisibilityMode,
  dominantChannel: ChatVisibleChannel,
  override?: ChatVisibleChannel | null,
): ChatVisibleChannel | null {
  if (visibility === 'PRIVATE' || visibility === 'SHADOW_ONLY') return null;
  return override ?? dominantChannel;
}

// ============================================================================
// MARK: Context validation
// ============================================================================

function validateContext(context: PostRunNarrativeContext): PostRunNarrativePlanValidation {
  const issues: PostRunNarrativeValidationIssue[] = [];

  if (!context.postRunId) {
    issues.push({
      code: 'MISSING_POST_RUN_ID',
      message: 'postRunId is required',
      severity: 'ERROR',
      field: 'postRunId',
    });
  }

  if (!context.roomId) {
    issues.push({
      code: 'MISSING_ROOM_ID',
      message: 'roomId is required',
      severity: 'ERROR',
      field: 'roomId',
    });
  }

  if (!context.evidence) {
    issues.push({
      code: 'MISSING_EVIDENCE',
      message: 'evidence snapshot is required',
      severity: 'ERROR',
      field: 'evidence',
    });
  }

  if (!context.kind) {
    issues.push({
      code: 'MISSING_KIND',
      message: 'post-run kind is required',
      severity: 'ERROR',
      field: 'kind',
    });
  }

  if (context.evidence && !context.evidence.runOutcome) {
    issues.push({
      code: 'MISSING_RUN_OUTCOME',
      message: 'evidence.runOutcome must be set',
      severity: 'ERROR',
      field: 'evidence.runOutcome',
    });
  }

  if (context.turningPointCandidates && context.turningPointCandidates.length === 0) {
    issues.push({
      code: 'EMPTY_TURNING_POINT_CANDIDATES',
      message: 'turningPointCandidates is empty — engine will attempt generic fallback',
      severity: 'WARNING',
      field: 'turningPointCandidates',
    });
  }

  if (context.moments && context.moments.length === 0) {
    issues.push({
      code: 'EMPTY_MOMENTS',
      message: 'moments array is empty — narrative depth will be limited',
      severity: 'WARNING',
      field: 'moments',
    });
  }

  if (!context.bundleId) {
    issues.push({
      code: 'MISSING_BUNDLE_ID',
      message: 'bundleId is missing — audit trail will be incomplete',
      severity: 'INFO',
      field: 'bundleId',
    });
  }

  const errorCount = issues.filter((issue) => issue.severity === 'ERROR').length;
  const warningCount = issues.filter((issue) => issue.severity === 'WARNING').length;
  const infoCount = issues.filter((issue) => issue.severity === 'INFO').length;

  return Object.freeze({
    valid: errorCount === 0,
    issues: Object.freeze(issues),
    errorCount,
    warningCount,
    infoCount,
  });
}

// ============================================================================
// MARK: Witness construction
// ============================================================================

function buildWitnesses(
  context: PostRunNarrativeContext,
  options: ResolvedEngineOptions,
  turningPoint: ChatTurningPoint | null,
  foreshadowPlan: ForeshadowPlanningResult,
  visibility: ChatPostRunVisibilityMode,
  dominantChannel: ChatVisibleChannel,
): readonly ChatPostRunWitness[] {
  const outcome = context.evidence.runOutcome;
  const seeded = [...(context.witnesses ?? []), ...foreshadowPlan.witnessSeeds];
  const witnesses: ChatPostRunWitness[] = [...seeded];

  const includeRival = options.includeRivalWitness && !context.suppressRivalMockery;

  if (options.includeHelperWitness && !seeded.some((w) => w.actorRole === 'HELPER')) {
    const helperStance = resolveHelperStance(outcome);
    witnesses.push(
      buildDefaultPostRunWitness({
        witnessId: (`postrun:witness:${context.postRunId}:helper` as unknown) as ChatPostRunWitness['witnessId'],
        actorRole: 'HELPER',
        stance: helperStance,
        displayName: 'Helper',
        line: isCollapse(outcome)
          ? `Name the break correctly${turningPoint ? ` — the ${turningPoint.label} pivot is what ended this.` : '.'} The next room will not own you so easily.`
          : isSovereignty(outcome)
            ? `This was total. Remember the shape of it${turningPoint ? ` — ${turningPoint.label} is a reproducible signature.` : ' — sovereignty has a reproducible signature.'}`
            : `Protect the line that worked${turningPoint ? ` — the ${turningPoint.label} moment is worth studying.` : '.'} Winning still leaves a trace the next room can target.`,
        intensity01: isCollapse(outcome) ? 0.74 : isSovereignty(outcome) ? 0.90 : 0.58,
        personal01: 0.62,
        timingMs: options.witnessBaseDelayMs + 250,
        visibleChannel: beatVisible(visibility, dominantChannel),
        npcId: context.relatedNpcIds?.[0] as ChatPostRunWitness['npcId'],
        proofHash: context.evidence.proofHash,
        tags: Object.freeze(['postrun', 'helper', helperStance.toLowerCase()]),
      }),
    );
  }

  if (includeRival && !seeded.some((w) => w.actorRole === 'RIVAL')) {
    const rivalStance = resolveRivalStance(outcome);
    witnesses.push(
      buildDefaultPostRunWitness({
        witnessId: (`postrun:witness:${context.postRunId}:rival` as unknown) as ChatPostRunWitness['witnessId'],
        actorRole: 'RIVAL',
        stance: rivalStance,
        displayName: 'Rival',
        line: isCollapse(outcome)
          ? 'This did not end in the final tick. It ended when you stopped governing the room.'
          : isSovereignty(outcome)
            ? 'You closed it cleanly. I will need to study that.'
            : 'The room saw the win. That only makes your next mistake more valuable to watch.',
        intensity01: 0.84,
        personal01: 0.46,
        timingMs: options.witnessBaseDelayMs,
        visibleChannel: beatVisible(visibility, dominantChannel),
        npcId: context.relatedNpcIds?.[1] as ChatPostRunWitness['npcId'],
        proofHash: context.evidence.proofHash,
        tags: Object.freeze(['postrun', 'rival', rivalStance.toLowerCase()]),
      }),
    );
  }

  if (options.includeCrowdWitness && !seeded.some((w) => w.actorRole === 'CROWD')) {
    const derivedStance = derivePrimaryWitnessStance(witnesses);
    const crowdStance = resolveCrowdStance(outcome, derivedStance);
    witnesses.push(
      buildDefaultPostRunWitness({
        witnessId: (`postrun:witness:${context.postRunId}:crowd` as unknown) as ChatPostRunWitness['witnessId'],
        actorRole: 'CROWD',
        stance: crowdStance,
        displayName: 'Channel',
        line: isCollapse(outcome)
          ? 'The room saw the turning point and kept it.'
          : isSovereignty(outcome)
            ? 'The room witnessed sovereign authority close the run.'
            : 'The room saw the turn and will carry it forward.',
        intensity01: 0.60,
        personal01: 0.18,
        timingMs: options.witnessBaseDelayMs + 700,
        visibleChannel: beatVisible(visibility, dominantChannel),
        proofHash: context.evidence.proofHash,
        tags: Object.freeze(['postrun', 'crowd', crowdStance.toLowerCase()]),
      }),
    );
  }

  return uniqueBy(
    witnesses,
    (w) => `${w.actorRole}|${w.displayName}|${w.line}`,
  ).slice(0, options.maxWitnesses);
}

// ============================================================================
// MARK: Blame construction
// ============================================================================

function buildBlameVectors(
  context: PostRunNarrativeContext,
  turningPoint: ChatTurningPoint | null,
): readonly ChatPostRunBlameVector[] {
  const supplied = [...(context.blameVectors ?? [])];
  if (supplied.length > 0) {
    return supplied
      .slice()
      .sort(
        (left, right) =>
          scoreBlameVector(right) - scoreBlameVector(left) ||
          left.label.localeCompare(right.label),
      );
  }

  return Object.freeze([
    buildDefaultBlameVector({
      blameId: (`postrun:blame:${context.postRunId}:primary` as unknown) as ChatPostRunBlameVector['blameId'],
      outcome: context.evidence.runOutcome,
      turningPoint: turningPoint ?? undefined,
      affect: context.evidence.affect,
      heat: (turningPoint?.compactMoment?.visibleChannel ??
        context.preferredVisibleChannel)
        ? context.evidence.audienceHeat[
            (turningPoint?.compactMoment?.visibleChannel ??
              context.preferredVisibleChannel)!
          ]
        : undefined,
      sourceMomentIds: turningPoint?.compactMoment
        ? [turningPoint.compactMoment.momentId]
        : [],
    }),
  ]);
}

// ============================================================================
// MARK: Summary card construction
// ============================================================================

function buildSummaryCard(
  context: PostRunNarrativeContext,
  planInputs: {
    readonly tone: ChatPostRunTone;
    readonly visibility: ChatPostRunVisibilityMode;
    readonly turningPoint: ChatTurningPoint | null;
    readonly blameVectors: readonly ChatPostRunBlameVector[];
    readonly directives: readonly ChatPostRunDirective[];
    readonly foreshadow: readonly ChatPostRunForeshadow[];
    readonly legendEscalationEligible: boolean;
    readonly shouldAnchorMemory: boolean;
  },
): ChatPostRunSummaryCard {
  const closureBand = derivePostRunClosureBand({
    outcome: context.evidence.runOutcome,
    affect: context.evidence.affect,
    turningPoint: planInputs.turningPoint ?? undefined,
    foreshadowCount: planInputs.foreshadow.length,
    directiveCount: planInputs.directives.length,
  });

  const archivePolicy = derivePostRunArchivePolicy({
    closureBand,
    replayId: context.evidence.replayId,
    proofHash: context.evidence.proofHash,
    legendEligible: planInputs.legendEscalationEligible,
    shouldAnchorMemory: planInputs.shouldAnchorMemory,
  });

  const outcome = context.evidence.runOutcome;
  const title = isSovereignty(outcome)
    ? 'The room closed under authored control.'
    : isVictory(outcome)
      ? 'The room closed with witnesses and residue.'
      : isBankruptcy(outcome)
        ? 'The room collapsed before the line could hold.'
        : isLoss(outcome)
          ? 'The room ended against the protagonist.'
          : 'The room ended, but the meaning stayed open.';

  return buildPostRunSummaryCard({
    summaryId: (`postrun:summary:${context.postRunId}` as unknown) as ChatPostRunSummaryCard['summaryId'],
    cardId: (`postrun:card:${context.postRunId}` as unknown) as ChatPostRunSummaryCard['cardId'],
    title,
    subtitle:
      summarizeTurningPoint(planInputs.turningPoint ?? undefined) ??
      'No single visible pivot outranked the total pressure field.',
    body: compact([
      summarizePrimaryBlame(planInputs.blameVectors),
      summarizePrimaryDirective(planInputs.directives),
      summarizePrimaryForeshadow(planInputs.foreshadow),
    ]).join(' '),
    tone: planInputs.tone,
    closureBand,
    kind: context.kind,
    archiveClass: context.evidence.finalSceneSummary?.archiveClass,
    archivePolicy,
    turningPoint: planInputs.turningPoint ?? undefined,
    blameVectors: planInputs.blameVectors,
    directives: planInputs.directives,
    foreshadow: planInputs.foreshadow,
    legendId: context.evidence.legendId,
    replayId: context.evidence.replayId,
    proofHash: context.evidence.proofHash,
  });
}

// ============================================================================
// MARK: Beat construction
// ============================================================================

function buildBeats(
  context: PostRunNarrativeContext,
  options: ResolvedEngineOptions,
  tone: ChatPostRunTone,
  visibility: ChatPostRunVisibilityMode,
  dominantChannel: ChatVisibleChannel,
  turningPoint: ChatTurningPoint | null,
  witnesses: readonly ChatPostRunWitness[],
  blameVectors: readonly ChatPostRunBlameVector[],
  directives: readonly ChatPostRunDirective[],
  foreshadow: readonly ChatPostRunForeshadow[],
  summaryCard: ChatPostRunSummaryCard,
  legendEscalationEligible: boolean,
): readonly ChatPostRunBeat[] {
  const primaryBlame = choosePrimaryBlameVector(blameVectors);
  const outcome = context.evidence.runOutcome;
  const beats: ChatPostRunBeat[] = [];

  const ch = (override?: ChatVisibleChannel | null): ChatVisibleChannel | null =>
    beatVisible(visibility, dominantChannel, override);

  // ── System verdict ──────────────────────────────────────────────────────
  beats.push(
    buildDefaultPostRunBeat({
      beatId: (`postrun:beat:verdict:${context.postRunId}` as unknown) as ChatPostRunBeat['beatId'],
      kind: 'SYSTEM_VERDICT',
      actorRole: 'SYSTEM',
      tone,
      line: summaryCard.subtitle,
      summary: summaryCard.title,
      visibleChannel: ch(),
      visibility,
      delayMs: options.verdictDelayMs,
      replayId: context.evidence.replayId,
      proofHash: context.evidence.proofHash,
      legendId: context.evidence.legendId,
      turningPointId: turningPoint?.turningPointId,
      sourceMomentIds: turningPoint?.compactMoment
        ? [turningPoint.compactMoment.momentId]
        : [],
      tags: Object.freeze(['postrun', 'verdict', outcome.toLowerCase()]),
    }),
  );

  // ── Witness beats ────────────────────────────────────────────────────────
  for (const witness of witnesses) {
    const witnessKind =
      witness.actorRole === 'HELPER'
        ? 'HELPER_EPITAPH'
        : witness.actorRole === 'RIVAL'
          ? 'RIVAL_MOCKERY'
          : 'WITNESS_LINE';

    beats.push(
      buildDefaultPostRunBeat({
        beatId: (`postrun:beat:witness:${context.postRunId}:${witness.witnessId}` as unknown) as ChatPostRunBeat['beatId'],
        kind: witnessKind,
        actorRole: witness.actorRole,
        tone,
        line: witness.line,
        visibleChannel: ch(witness.visibleChannel),
        visibility,
        delayMs: witness.timingMs,
        proofHash: witness.proofHash,
        sourceMomentIds: turningPoint?.compactMoment
          ? [turningPoint.compactMoment.momentId]
          : [],
        tags: compact<string>([
          'postrun',
          'witness',
          ...((witness.tags ?? []) as string[]),
        ]),
      }),
    );
  }

  // ── Crowd judgment ───────────────────────────────────────────────────────
  if (options.includeCrowdJudgmentBeat && witnesses.some((w) => w.actorRole === 'CROWD')) {
    const crowdLine = isCollapse(outcome)
      ? 'The channel registered the break. Its pressure index shifted.'
      : isSovereignty(outcome)
        ? 'The channel recorded sovereign authority. This will affect future heat calculations.'
        : 'The channel absorbed the outcome. Witness pressure will recalibrate.';
    beats.push(
      buildDefaultPostRunBeat({
        beatId: (`postrun:beat:crowd_judgment:${context.postRunId}` as unknown) as ChatPostRunBeat['beatId'],
        kind: 'CROWD_JUDGMENT',
        actorRole: 'CROWD',
        tone,
        line: crowdLine,
        visibleChannel: ch(),
        visibility,
        delayMs: options.witnessBaseDelayMs + 1_100,
        sourceMomentIds: turningPoint?.compactMoment
          ? [turningPoint.compactMoment.momentId]
          : [],
        tags: Object.freeze(['postrun', 'crowd_judgment', outcome.toLowerCase()]),
      }),
    );
  }

  // ── Turning point card ───────────────────────────────────────────────────
  beats.push(
    buildDefaultPostRunBeat({
      beatId: (`postrun:beat:turning:${context.postRunId}` as unknown) as ChatPostRunBeat['beatId'],
      kind: 'TURNING_POINT_CARD',
      actorRole: 'NARRATOR',
      tone,
      line: summarizeTurningPoint(turningPoint ?? undefined),
      summary: turningPoint?.label,
      visibleChannel: ch(),
      visibility,
      delayMs: options.summaryDelayMs - 400,
      turningPointId: turningPoint?.turningPointId,
      replayId: context.evidence.replayId,
      proofHash: context.evidence.proofHash,
      sourceMomentIds: turningPoint?.compactMoment
        ? [turningPoint.compactMoment.momentId]
        : [],
      tags: Object.freeze(['postrun', 'turning_point']),
    }),
  );

  // ── Blame card ───────────────────────────────────────────────────────────
  beats.push(
    buildDefaultPostRunBeat({
      beatId: (`postrun:beat:blame:${context.postRunId}` as unknown) as ChatPostRunBeat['beatId'],
      kind: 'BLAME_CARD',
      actorRole: 'SYSTEM',
      tone,
      line: summarizePrimaryBlame(blameVectors),
      summary: primaryBlame?.label,
      visibleChannel: ch(),
      visibility,
      delayMs: options.summaryDelayMs - 150,
      blameId: primaryBlame?.blameId,
      sourceMomentIds: turningPoint?.compactMoment
        ? [turningPoint.compactMoment.momentId]
        : [],
      tags: Object.freeze(['postrun', 'blame']),
    }),
  );

  // ── Debrief / directive beat ─────────────────────────────────────────────
  if (options.includeDirectiveBeat) {
    const primaryDirective = directives[0];
    if (primaryDirective) {
      beats.push(
        buildDefaultPostRunBeat({
          beatId: (`postrun:beat:directive:${context.postRunId}` as unknown) as ChatPostRunBeat['beatId'],
          kind: 'DEBRIEF_FACT',
          actorRole: 'NARRATOR',
          tone,
          line: primaryDirective.explanation,
          summary: primaryDirective.label,
          visibleChannel: ch(),
          visibility,
          delayMs: options.directiveDelayMs,
          sourceMomentIds: primaryDirective.sourceMomentIds,
          tags: Object.freeze([
            'postrun',
            'directive',
            primaryDirective.kind.toLowerCase(),
          ]),
        }),
      );
    }
  }

  // ── Summary card beat ────────────────────────────────────────────────────
  if (options.includeSummaryBeat) {
    beats.push(
      buildDefaultPostRunBeat({
        beatId: (`postrun:beat:summary:${context.postRunId}` as unknown) as ChatPostRunBeat['beatId'],
        kind: 'SUMMARY_CARD',
        actorRole: 'NARRATOR',
        tone,
        line: summaryCard.body,
        summary: summaryCard.subtitle,
        visibleChannel: ch(),
        visibility,
        delayMs: options.summaryDelayMs,
        replayId: context.evidence.replayId,
        proofHash: context.evidence.proofHash,
        legendId: context.evidence.legendId,
        sourceMomentIds: turningPoint?.compactMoment
          ? [turningPoint.compactMoment.momentId]
          : [],
        tags: Object.freeze(['postrun', 'summary']),
      }),
    );
  }

  // ── Foreshadow beat ──────────────────────────────────────────────────────
  if (options.includeForeshadowBeat && !context.suppressForeshadow) {
    const primaryForeshadow = foreshadow[0];
    if (primaryForeshadow) {
      beats.push(
        buildDefaultPostRunBeat({
          beatId: (`postrun:beat:foreshadow:${context.postRunId}` as unknown) as ChatPostRunBeat['beatId'],
          kind: 'FORESHADOW_LINE',
          actorRole: 'NARRATOR',
          tone,
          line: primaryForeshadow.line,
          summary: primaryForeshadow.label,
          visibleChannel: ch(),
          visibility,
          delayMs: options.foreshadowDelayMs,
          foreshadowId: primaryForeshadow.foreshadowId,
          tags: Object.freeze([
            'postrun',
            'foreshadow',
            primaryForeshadow.kind.toLowerCase(),
          ]),
        }),
      );
    }
  }

  // ── World reaction beat ──────────────────────────────────────────────────
  if (
    options.includeWorldReactionBeat &&
    context.evidence.worldEventIds.length > 0
  ) {
    beats.push(
      buildDefaultPostRunBeat({
        beatId: (`postrun:beat:world_reaction:${context.postRunId}` as unknown) as ChatPostRunBeat['beatId'],
        kind: 'WORLD_REACTION',
        actorRole: 'SYSTEM',
        tone,
        line: `World pressure echoed through ${context.evidence.worldEventIds.length} active event${context.evidence.worldEventIds.length > 1 ? 's' : ''} during this run.`,
        summary: 'World reaction',
        visibleChannel: ch(),
        visibility,
        delayMs: options.foreshadowDelayMs + 200,
        sourceMomentIds: turningPoint?.compactMoment
          ? [turningPoint.compactMoment.momentId]
          : [],
        tags: Object.freeze([
          'postrun',
          'world_reaction',
          ...context.evidence.worldEventIds.map(String),
        ]),
      }),
    );
  }

  // ── Legend notice beat ───────────────────────────────────────────────────
  if (options.includeLegendNoticeBeat && legendEscalationEligible) {
    beats.push(
      buildDefaultPostRunBeat({
        beatId: (`postrun:beat:legend_notice:${context.postRunId}` as unknown) as ChatPostRunBeat['beatId'],
        kind: 'LEGEND_NOTICE',
        actorRole: 'SYSTEM',
        tone,
        line: context.evidence.legendId
          ? 'This run reached the legend threshold. The archive will carry it forward.'
          : 'Legend escalation criteria met. The run will be flagged for canonical review.',
        summary: 'Legend escalation',
        visibleChannel: ch(),
        visibility,
        delayMs: options.summaryDelayMs + 400,
        legendId: context.evidence.legendId,
        replayId: context.evidence.replayId,
        proofHash: context.evidence.proofHash,
        sourceMomentIds: turningPoint?.compactMoment
          ? [turningPoint.compactMoment.momentId]
          : [],
        tags: Object.freeze([
          'postrun',
          'legend_notice',
          context.evidence.legendId ? 'legend_confirmed' : 'legend_candidate',
        ]),
      }),
    );
  }

  // ── Reward notice beat ───────────────────────────────────────────────────
  if (options.includeRewardNoticeBeat && isVictory(outcome)) {
    const rewardLine = isSovereignty(outcome)
      ? 'Sovereignty claimed. Full reward tier released.'
      : 'Victory confirmed. Reward grant authorized.';
    beats.push(
      buildDefaultPostRunBeat({
        beatId: (`postrun:beat:reward_notice:${context.postRunId}` as unknown) as ChatPostRunBeat['beatId'],
        kind: 'REWARD_NOTICE',
        actorRole: 'SYSTEM',
        tone,
        line: rewardLine,
        summary: 'Reward notice',
        visibleChannel: ch(),
        visibility,
        delayMs: options.summaryDelayMs + 200,
        replayId: context.evidence.replayId,
        proofHash: context.evidence.proofHash,
        legendId: context.evidence.legendId,
        sourceMomentIds: turningPoint?.compactMoment
          ? [turningPoint.compactMoment.momentId]
          : [],
        tags: Object.freeze([
          'postrun',
          'reward_notice',
          outcome.toLowerCase(),
        ]),
      }),
    );
  }

  // ── Silence beat ─────────────────────────────────────────────────────────
  if (options.includeSilenceBeat && options.silenceDurationMs > 0) {
    beats.push(
      buildDefaultPostRunBeat({
        beatId: (`postrun:beat:silence:${context.postRunId}` as unknown) as ChatPostRunBeat['beatId'],
        kind: 'SILENCE',
        actorRole: 'SYSTEM',
        tone,
        visibleChannel: ch(),
        visibility,
        delayMs: options.foreshadowDelayMs + 450,
        durationMs: options.silenceDurationMs,
        sourceMomentIds: turningPoint?.compactMoment
          ? [turningPoint.compactMoment.momentId]
          : [],
        tags: Object.freeze(['postrun', 'silence']),
      }),
    );
  }

  return sortPostRunBeats(beats);
}

// ============================================================================
// MARK: Diagnostics helpers
// ============================================================================

function computeDiagnosticsFromEvaluation(
  evaluation: PostRunNarrativeEvaluation,
  profile: PostRunNarrativeEngineProfile | null,
): PostRunNarrativeDiagnostics {
  const { plan, turningPointResolution } = evaluation;

  const witnessesByRole: Partial<Record<string, number>> = {};
  for (const witness of plan.witnesses) {
    witnessesByRole[witness.actorRole] =
      (witnessesByRole[witness.actorRole] ?? 0) + 1;
  }

  return Object.freeze({
    roomId: evaluation.roomId,
    evaluatedAt: evaluation.evaluatedAt,
    beatCount: plan.beats.length,
    witnessCount: plan.witnesses.length,
    blameVectorCount: plan.blameVectors.length,
    foreshadowCount: plan.foreshadow.length,
    directiveCount: plan.directives.length,
    dominantTone: evaluation.dominantTone,
    visibility: plan.visibility,
    turningPointResolved: turningPointResolution.primary !== null,
    legendEscalationEligible: plan.legendEscalationEligible,
    publicBroadcastRecommended: evaluation.publicBroadcastRecommended,
    replayPersistenceRecommended: evaluation.replayPersistenceRecommended,
    worldEchoRecommended: evaluation.worldEchoRecommended,
    beatsByKind: Object.freeze(countPostRunBeatsByKind(plan.beats) as Partial<Record<string, number>>),
    witnessesByRole: Object.freeze(witnessesByRole),
    profileApplied: profile,
  });
}

function buildValidationFromEvaluation(
  evaluation: PostRunNarrativeEvaluation,
): PostRunNarrativePlanValidation {
  const issues: PostRunNarrativeValidationIssue[] = [];
  const { plan } = evaluation;

  if (plan.beats.length === 0) {
    issues.push({
      code: 'NO_BEATS',
      message: 'Post-run plan has no beats — downstream will have nothing to deliver',
      severity: 'ERROR',
    });
  }

  if (!plan.turningPoint) {
    issues.push({
      code: 'NO_TURNING_POINT',
      message: 'No turning point resolved — narrative interpretation will be generic',
      severity: 'WARNING',
    });
  }

  if (plan.blameVectors.length === 0) {
    issues.push({
      code: 'NO_BLAME_VECTOR',
      message: 'No blame vectors present — blame card will be empty',
      severity: 'WARNING',
    });
  }

  if (
    plan.visibility === 'CHANNEL' ||
    plan.visibility === 'MULTI_CHANNEL'
  ) {
    const hasChannelBeats = plan.beats.some((beat) => beat.visibleChannel != null);
    if (!hasChannelBeats) {
      issues.push({
        code: 'NO_CHANNEL_BEATS',
        message: 'Plan visibility is CHANNEL but no beats have a visible channel assigned',
        severity: 'WARNING',
      });
    }
  }

  if (plan.legendEscalationEligible && !plan.evidence.legendId) {
    issues.push({
      code: 'LEGEND_ESCALATION_WITHOUT_LEGEND_ID',
      message: 'Plan is legend-escalation eligible but evidence.legendId is not set',
      severity: 'INFO',
    });
  }

  if (plan.replayRecommended && !plan.evidence.replayId) {
    issues.push({
      code: 'REPLAY_RECOMMENDED_WITHOUT_REPLAY_ID',
      message: 'Plan recommends replay persistence but evidence.replayId is not set',
      severity: 'INFO',
    });
  }

  const errorCount = issues.filter((i) => i.severity === 'ERROR').length;
  const warningCount = issues.filter((i) => i.severity === 'WARNING').length;
  const infoCount = issues.filter((i) => i.severity === 'INFO').length;

  return Object.freeze({
    valid: errorCount === 0,
    issues: Object.freeze(issues),
    errorCount,
    warningCount,
    infoCount,
  });
}

function computePlanDiff(
  current: PostRunNarrativeEvaluation,
  previous: PostRunNarrativeEvaluation | null,
): PostRunNarrativePlanDiff {
  const prevPlan = previous?.plan ?? null;
  const currPlan = current.plan;

  const prevBeatKinds = new Set((prevPlan?.beats ?? []).map((b) => b.kind));
  const currBeatKinds = new Set(currPlan.beats.map((b) => b.kind));

  const addedBeatKinds = [...currBeatKinds].filter((k) => !prevBeatKinds.has(k));
  const removedBeatKinds = [...prevBeatKinds].filter((k) => !currBeatKinds.has(k));

  return Object.freeze({
    roomId: current.roomId,
    previousPlanId: prevPlan ? String(prevPlan.postRunId) : null,
    currentPlanId: String(currPlan.postRunId),
    beatCountDelta: currPlan.beats.length - (prevPlan?.beats.length ?? 0),
    witnessCountDelta: currPlan.witnesses.length - (prevPlan?.witnesses.length ?? 0),
    blameCountDelta: currPlan.blameVectors.length - (prevPlan?.blameVectors.length ?? 0),
    foreshadowCountDelta: currPlan.foreshadow.length - (prevPlan?.foreshadow.length ?? 0),
    toneChanged: prevPlan != null && prevPlan.tone !== currPlan.tone,
    visibilityChanged: prevPlan != null && prevPlan.visibility !== currPlan.visibility,
    turningPointChanged:
      prevPlan != null &&
      (prevPlan.turningPoint?.turningPointId ?? null) !==
        (currPlan.turningPoint?.turningPointId ?? null),
    previousTone: prevPlan?.tone ?? null,
    currentTone: currPlan.tone,
    previousVisibility: prevPlan?.visibility ?? null,
    currentVisibility: currPlan.visibility,
    addedBeatKinds: Object.freeze(addedBeatKinds),
    removedBeatKinds: Object.freeze(removedBeatKinds),
  });
}

function buildStatsSummaryFromEvaluations(
  evaluations: readonly PostRunNarrativeEvaluation[],
): PostRunNarrativeStatsSummary {
  if (evaluations.length === 0) {
    return Object.freeze({
      totalEvaluations: 0,
      roomCount: 0,
      outcomeBreakdown: Object.freeze({}),
      legendEscalationCount: 0,
      publicBroadcastCount: 0,
      replayCount: 0,
      worldEchoCount: 0,
      averageBeatCount: 0,
      averageWitnessCount: 0,
      averageBlameCount: 0,
      averageForeshadowCount: 0,
    });
  }

  const outcomeBreakdown: Record<string, number> = {};
  let legendEscalationCount = 0;
  let publicBroadcastCount = 0;
  let replayCount = 0;
  let worldEchoCount = 0;
  let totalBeats = 0;
  let totalWitnesses = 0;
  let totalBlame = 0;
  let totalForeshadow = 0;

  for (const evaluation of evaluations) {
    const outcome = evaluation.plan.evidence.runOutcome;
    outcomeBreakdown[outcome] = (outcomeBreakdown[outcome] ?? 0) + 1;
    if (evaluation.plan.legendEscalationEligible) legendEscalationCount++;
    if (evaluation.publicBroadcastRecommended) publicBroadcastCount++;
    if (evaluation.replayPersistenceRecommended) replayCount++;
    if (evaluation.worldEchoRecommended) worldEchoCount++;
    totalBeats += evaluation.plan.beats.length;
    totalWitnesses += evaluation.plan.witnesses.length;
    totalBlame += evaluation.plan.blameVectors.length;
    totalForeshadow += evaluation.plan.foreshadow.length;
  }

  const n = evaluations.length;

  return Object.freeze({
    totalEvaluations: n,
    roomCount: new Set(evaluations.map((e) => e.roomId)).size,
    outcomeBreakdown: Object.freeze(outcomeBreakdown),
    legendEscalationCount,
    publicBroadcastCount,
    replayCount,
    worldEchoCount,
    averageBeatCount: totalBeats / n,
    averageWitnessCount: totalWitnesses / n,
    averageBlameCount: totalBlame / n,
    averageForeshadowCount: totalForeshadow / n,
  });
}

// ============================================================================
// MARK: Engine implementation
// ============================================================================

export class PostRunNarrativeEngine {
  private readonly options: ResolvedEngineOptions;
  private readonly profile: PostRunNarrativeEngineProfile | null;
  private readonly turningPointResolver: TurningPointResolver;
  private readonly foreshadowPlanner: ForeshadowPlanner;
  private readonly byRoom = new Map<ChatRoomId, PostRunNarrativeEvaluation>();

  public constructor(options: PostRunNarrativeEngineOptions = {}) {
    this.profile = options.profile ?? null;
    this.options = resolveOptions(options);
    this.turningPointResolver =
      options.turningPointResolver ??
      createTurningPointResolver(options.turningPointResolverOptions ?? {});
    this.foreshadowPlanner =
      options.foreshadowPlanner ??
      createForeshadowPlanner(options.foreshadowPlannerOptions ?? {});
  }

  // ── Core evaluation ───────────────────────────────────────────────────────

  public evaluate(context: PostRunNarrativeContext): PostRunNarrativeEvaluation {
    const turningPointResolution = this.turningPointResolver.resolve({
      roomId: context.roomId,
      evidence: context.evidence,
      moments: context.moments,
      turningPointCandidates: context.turningPointCandidates,
      previousTurningPoint: context.previousPlan?.turningPoint,
      previousPlanId: context.previousPlan?.postRunId,
      preferredNpcIds: context.relatedNpcIds as TurningPointResolverContext['preferredNpcIds'],
      preferredVisibleChannels: context.preferredVisibleChannel
        ? [context.preferredVisibleChannel]
        : undefined,
      preferredMessageIds: context.evidence.relatedMessageIds,
    });

    const primaryTurningPoint = turningPointResolution.primary;

    const visibility = chooseNarrativeVisibility(
      context.evidence,
      primaryTurningPoint,
      context.preferredVisibleChannel,
    );

    const dominantChannel =
      primaryTurningPoint?.compactMoment?.visibleChannel ??
      dominantBeatChannel(context.previousPlan?.beats ?? [], this.options.defaultVisibleChannel) ??
      context.preferredVisibleChannel ??
      this.options.defaultVisibleChannel;

    const tone = derivePostRunTone({
      outcome: context.evidence.runOutcome,
      affect: context.evidence.affect,
      reputation: context.evidence.reputation,
    });

    const foreshadowPlan = this.foreshadowPlanner.plan({
      roomId: context.roomId,
      evidence: context.evidence,
      turningPoint: primaryTurningPoint,
      blameVectors: context.blameVectors,
      moments: context.moments,
      existingForeshadow: context.foreshadow,
      existingDirectives: context.directives,
      preferredVisibleChannel: dominantChannel,
      relatedNpcIds: context.relatedNpcIds as ForeshadowPlanningContext['relatedNpcIds'],
    });

    const blameVectors = buildBlameVectors(context, primaryTurningPoint);
    const witnesses = buildWitnesses(
      context,
      this.options,
      primaryTurningPoint,
      foreshadowPlan,
      visibility,
      dominantChannel,
    );

    const shouldAnchorMemory = shouldAnchorPostRunMemory({
      turningPoint: primaryTurningPoint ?? undefined,
      blameVectors,
      foreshadow: foreshadowPlan.foreshadow,
      outcome: context.evidence.runOutcome,
    });

    const legendEscalationEligible = shouldEscalatePostRunToLegend({
      turningPoint: primaryTurningPoint ?? undefined,
      outcome: context.evidence.runOutcome,
      replayId: context.evidence.replayId,
      proofHash: context.evidence.proofHash,
    });

    const summaryCard = buildSummaryCard(context, {
      tone,
      visibility,
      turningPoint: primaryTurningPoint,
      blameVectors,
      directives: foreshadowPlan.directives,
      foreshadow: foreshadowPlan.foreshadow,
      legendEscalationEligible,
      shouldAnchorMemory,
    });

    const effectiveOptions: ResolvedEngineOptions =
      context.forceSOVEREIGNCeremony
        ? resolveOptions({ ...this.options, ...POST_RUN_NARRATIVE_PROFILE_OPTIONS.SOVEREIGN_CEREMONY })
        : this.options;

    const beats = buildBeats(
      context,
      effectiveOptions,
      tone,
      visibility,
      dominantChannel,
      primaryTurningPoint,
      witnesses,
      blameVectors,
      foreshadowPlan.directives,
      context.suppressForeshadow ? [] : foreshadowPlan.foreshadow,
      summaryCard,
      legendEscalationEligible,
    );

    const basePlan = buildMinimalPostRunPlan({
      postRunId: context.postRunId,
      bundleId: context.bundleId,
      roomId: context.roomId,
      kind: context.kind,
      evidence: context.evidence,
      turningPointCandidates: turningPointResolution.candidates,
      moments: context.moments,
      witnesses,
      blameVectors,
      directives: foreshadowPlan.directives,
      foreshadow: foreshadowPlan.foreshadow,
      beats,
      createdAt: context.createdAt,
      payload: context.payload,
    });

    const normalizedPlan = normalizePostRunPlan({
      ...basePlan,
      stage: this.options.settleImmediately ? 'SETTLED' : basePlan.stage,
      class: derivePostRunClass(context.evidence.runOutcome, visibility, tone),
      tone,
      visibility,
      turningPoint: primaryTurningPoint ?? undefined,
      summaryCard,
      witnesses,
      beats,
      blameVectors,
      directives: foreshadowPlan.directives,
      foreshadow: foreshadowPlan.foreshadow,
      threads: [projectPostRunThread({ beats, witnesses, visibility })],
      legendEscalationEligible,
      replayRecommended: postRunPlanSupportsReplay(basePlan),
      shouldAnchorMemory,
      shouldPersistShadowArchive:
        visibility === 'SHADOW_ONLY' || shouldAnchorMemory,
      authoredAt: nowMs(),
      settledAt: this.options.settleImmediately ? nowMs() : undefined,
    });

    const receipt = createPostRunReceipt({
      receiptId: (`postrun:receipt:${context.postRunId}` as unknown) as ChatPostRunPlan['receipt']['receiptId'],
      createdAt: nowMs(),
      visibility: normalizedPlan.visibility,
      beats: normalizedPlan.beats,
      messageIds: context.evidence.relatedMessageIds,
      replayId: normalizedPlan.evidence.replayId,
      proofHash: normalizedPlan.evidence.proofHash,
      legendId: normalizedPlan.evidence.legendId,
    });

    const plan: ChatPostRunPlan = normalizePostRunPlan({
      ...normalizedPlan,
      receipt,
    });

    const runtimeState: ChatPostRunRuntimeState = Object.freeze({
      ...createEmptyPostRunRuntimeState(plan.postRunId),
      stage: plan.stage,
      deliveredBeatIds: plan.receipt?.beatIds ?? [],
      deliveredChannels: collectPostRunChannels({
        beats: plan.beats,
        visibility: plan.visibility,
      }),
      openedAt: plan.window.opensAt,
      completedAt: this.options.settleImmediately ? nowMs() : undefined,
    });

    const archiveEntry = buildPostRunArchiveEntry({
      archiveId: (`postrun:archive:${context.postRunId}` as unknown) as ChatPostRunArchiveEntry['archiveId'],
      plan,
      archivedAt: nowMs(),
    });

    const digest = buildPostRunDigest(plan);

    const ledgerEntry = derivePostRunLedgerEntry({
      ledgerId: (`postrun:ledger:${context.postRunId}` as unknown) as ChatPostRunLedgerEntry['ledgerId'],
      plan,
      archivedAt: nowMs(),
    });

    const summaryClass: ChatPostRunSummaryClass = deriveSummaryClass({
      tone,
      kind: plan.kind,
      outcome: plan.evidence.runOutcome,
      closureBand: summaryCard.closureBand,
    });

    const reasoning: PostRunNarrativeReasoning = Object.freeze({
      turningPointReason:
        turningPointResolution.reasoning.topReasons.join('|') ||
        'turning_point_unresolved',
      blameReason: summarizePrimaryBlame(blameVectors) ?? 'no_blame_vector',
      witnessReason: `witness_count:${witnesses.length}|stance:${derivePrimaryWitnessStance(witnesses) ?? 'NONE'}`,
      beatReason: `beat_count:${plan.beats.length}|beat_classes:${JSON.stringify(
        countPostRunBeatsByKind(plan.beats),
      )}`,
      visibilityReason: `visibility:${visibility}|dominant_channel:${dominantChannel}`,
      legendEscalationReason: legendEscalationEligible
        ? `eligible|legend_id:${plan.evidence.legendId ?? 'none'}`
        : 'ineligible',
      profileApplied: this.profile,
    });

    const evaluation: PostRunNarrativeEvaluation = Object.freeze({
      roomId: context.roomId,
      evaluatedAt: nowMs(),
      plan,
      archiveEntry,
      digest,
      ledgerEntry,
      runtimeState,
      dominantChannel,
      dominantTone: tone,
      summaryClass,
      primaryTurningPoint,
      primaryBlame: choosePrimaryBlameVector(blameVectors),
      publicBroadcastRecommended: shouldBroadcastPostRunPublicly(plan),
      replayPersistenceRecommended: postRunPlanSupportsReplay(plan),
      worldEchoRecommended: postRunPlanSupportsWorldEcho(plan),
      turningPointResolution,
      foreshadowPlan,
      reasoning,
    });

    this.byRoom.set(context.roomId, evaluation);
    return evaluation;
  }

  // ── Batch evaluation ──────────────────────────────────────────────────────

  public evaluateBatch(
    contexts: readonly PostRunNarrativeContext[],
  ): readonly PostRunNarrativeEvaluation[] {
    return contexts.map((context) => this.evaluate(context));
  }

  // ── Pre-evaluation validation ─────────────────────────────────────────────

  public validateContext(context: PostRunNarrativeContext): PostRunNarrativePlanValidation {
    return validateContext(context);
  }

  // ── Room state accessors ──────────────────────────────────────────────────

  public getLastEvaluation(roomId: ChatRoomId): PostRunNarrativeEvaluation | null {
    return this.byRoom.get(roomId) ?? null;
  }

  public hasEvaluation(roomId: ChatRoomId): boolean {
    return this.byRoom.has(roomId);
  }

  public listRooms(): readonly ChatRoomId[] {
    return Object.freeze([...this.byRoom.keys()]);
  }

  public getAllEvaluations(): readonly PostRunNarrativeEvaluation[] {
    return Object.freeze([...this.byRoom.values()]);
  }

  public clear(roomId?: ChatRoomId): void {
    if (roomId != null) {
      this.byRoom.delete(roomId);
      return;
    }
    this.byRoom.clear();
  }

  // ── Diagnostics and audit ─────────────────────────────────────────────────

  public getDiagnostics(roomId: ChatRoomId): PostRunNarrativeDiagnostics | null {
    const evaluation = this.byRoom.get(roomId);
    if (!evaluation) return null;
    return computeDiagnosticsFromEvaluation(evaluation, this.profile);
  }

  public getAllDiagnostics(): readonly PostRunNarrativeDiagnostics[] {
    return Object.freeze(
      [...this.byRoom.values()].map((ev) =>
        computeDiagnosticsFromEvaluation(ev, this.profile),
      ),
    );
  }

  public buildAuditReport(roomId: ChatRoomId): PostRunNarrativeAuditReport | null {
    const evaluation = this.byRoom.get(roomId);
    if (!evaluation) return null;

    const diagnostics = computeDiagnosticsFromEvaluation(evaluation, this.profile);
    const validation = buildValidationFromEvaluation(evaluation);

    return Object.freeze({
      roomId,
      evaluatedAt: evaluation.evaluatedAt,
      plan: evaluation.plan,
      diagnostics,
      validation,
      turningPointResolution: evaluation.turningPointResolution,
      foreshadowPlan: evaluation.foreshadowPlan,
      reasoning: evaluation.reasoning,
    });
  }

  // ── Diff ──────────────────────────────────────────────────────────────────

  public computeDiff(
    roomId: ChatRoomId,
    previousEvaluation: PostRunNarrativeEvaluation | null,
  ): PostRunNarrativePlanDiff | null {
    const current = this.byRoom.get(roomId);
    if (!current) return null;
    return computePlanDiff(current, previousEvaluation);
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  public getStatsSummary(): PostRunNarrativeStatsSummary {
    return buildStatsSummaryFromEvaluations([...this.byRoom.values()]);
  }

  // ── Snapshot ──────────────────────────────────────────────────────────────

  public getSnapshot(): PostRunNarrativeEngineSnapshot {
    return Object.freeze({
      snapshotVersion: '1.0',
      capturedAt: nowMs(),
      byRoom: Object.freeze(
        Object.fromEntries(this.byRoom.entries()),
      ) as Readonly<Record<ChatRoomId, PostRunNarrativeEvaluation>>,
    });
  }

  public restore(snapshot: PostRunNarrativeEngineSnapshot): void {
    this.byRoom.clear();
    for (const [roomId, evaluation] of Object.entries(snapshot.byRoom) as [
      ChatRoomId,
      PostRunNarrativeEvaluation,
    ][]) {
      this.byRoom.set(roomId, evaluation);
    }
  }

  // ── Serialization ─────────────────────────────────────────────────────────

  public serialize(): PostRunNarrativeEngineSerializedState {
    const evaluations = [...this.byRoom.values()];
    return Object.freeze({
      version: '1.0',
      serializedAt: nowMs(),
      profile: this.profile,
      roomCount: evaluations.length,
      evaluations: Object.freeze(evaluations),
    });
  }

  public static hydrate(
    state: PostRunNarrativeEngineSerializedState,
    options: PostRunNarrativeEngineOptions = {},
  ): PostRunNarrativeEngine {
    const engine = new PostRunNarrativeEngine({
      profile: state.profile ?? undefined,
      ...options,
    });
    for (const evaluation of state.evaluations) {
      engine.byRoom.set(evaluation.roomId, evaluation);
    }
    return engine;
  }

  // ── Plan summarization ────────────────────────────────────────────────────

  public summarizePlan(roomId: ChatRoomId): JsonObject | null {
    const evaluation = this.byRoom.get(roomId);
    if (!evaluation) return null;
    return summarizePostRunPlan(evaluation.plan);
  }

  // ── Score access ──────────────────────────────────────────────────────────

  public getPostRunScore(roomId: ChatRoomId): number | null {
    const evaluation = this.byRoom.get(roomId);
    if (!evaluation) return null;
    const outcome = evaluation.plan.evidence.runOutcome;
    const raw =
      outcome === 'SOVEREIGNTY' ? 1.0
      : outcome === 'VICTORY' ? 0.8
      : outcome === 'UNSETTLED' ? 0.5
      : outcome === 'TIMEOUT' ? 0.35
      : outcome === 'LOSS' ? 0.2
      : 0.05; // BANKRUPTCY
    return toPostRunScore01(raw);
  }

  // ── Profile identity ──────────────────────────────────────────────────────

  public getProfile(): PostRunNarrativeEngineProfile | null {
    return this.profile;
  }
}

// ============================================================================
// MARK: Factory functions
// ============================================================================

export function createPostRunNarrativeEngine(
  options: PostRunNarrativeEngineOptions = {},
): PostRunNarrativeEngine {
  return new PostRunNarrativeEngine(options);
}

export function createPostRunNarrativeEngineFromProfile(
  profile: PostRunNarrativeEngineProfile,
  overrides: Omit<PostRunNarrativeEngineOptions, 'profile'> = {},
): PostRunNarrativeEngine {
  return new PostRunNarrativeEngine({ profile, ...overrides });
}

export function createCinematicPostRunNarrativeEngine(
  overrides: Omit<PostRunNarrativeEngineOptions, 'profile'> = {},
): PostRunNarrativeEngine {
  return createPostRunNarrativeEngineFromProfile('CINEMATIC', overrides);
}

export function createDebriefPostRunNarrativeEngine(
  overrides: Omit<PostRunNarrativeEngineOptions, 'profile'> = {},
): PostRunNarrativeEngine {
  return createPostRunNarrativeEngineFromProfile('DEBRIEF', overrides);
}

export function createColdClosePostRunNarrativeEngine(
  overrides: Omit<PostRunNarrativeEngineOptions, 'profile'> = {},
): PostRunNarrativeEngine {
  return createPostRunNarrativeEngineFromProfile('COLD_CLOSE', overrides);
}

export function createGriefPostRunNarrativeEngine(
  overrides: Omit<PostRunNarrativeEngineOptions, 'profile'> = {},
): PostRunNarrativeEngine {
  return createPostRunNarrativeEngineFromProfile('GRIEF', overrides);
}

export function createSovereignCeremonyPostRunNarrativeEngine(
  overrides: Omit<PostRunNarrativeEngineOptions, 'profile'> = {},
): PostRunNarrativeEngine {
  return createPostRunNarrativeEngineFromProfile('SOVEREIGN_CEREMONY', overrides);
}

export function createLegendCeremonyPostRunNarrativeEngine(
  overrides: Omit<PostRunNarrativeEngineOptions, 'profile'> = {},
): PostRunNarrativeEngine {
  return createPostRunNarrativeEngineFromProfile('LEGEND_CEREMONY', overrides);
}

export function createRapidPostRunNarrativeEngine(
  overrides: Omit<PostRunNarrativeEngineOptions, 'profile'> = {},
): PostRunNarrativeEngine {
  return createPostRunNarrativeEngineFromProfile('RAPID', overrides);
}

// ============================================================================
// MARK: Standalone utility exports
// ============================================================================

/**
 * Validate a context without instantiating an engine.
 */
export { validateContext as validatePostRunNarrativeContext };

/**
 * Compute diagnostics from an already-produced evaluation.
 * Useful for reporting tools that receive evaluations from external sources.
 */
export function computePostRunNarrativeDiagnostics(
  evaluation: PostRunNarrativeEvaluation,
  profile: PostRunNarrativeEngineProfile | null = null,
): PostRunNarrativeDiagnostics {
  return computeDiagnosticsFromEvaluation(evaluation, profile);
}

/**
 * Build an audit report from an already-produced evaluation.
 */
export function buildPostRunNarrativeAuditReport(
  evaluation: PostRunNarrativeEvaluation,
  profile: PostRunNarrativeEngineProfile | null = null,
): PostRunNarrativeAuditReport {
  return Object.freeze({
    roomId: evaluation.roomId,
    evaluatedAt: evaluation.evaluatedAt,
    plan: evaluation.plan,
    diagnostics: computeDiagnosticsFromEvaluation(evaluation, profile),
    validation: buildValidationFromEvaluation(evaluation),
    turningPointResolution: evaluation.turningPointResolution,
    foreshadowPlan: evaluation.foreshadowPlan,
    reasoning: evaluation.reasoning,
  });
}

/**
 * Compute a diff between two evaluations without needing an engine instance.
 */
export function computePostRunNarrativePlanDiff(
  current: PostRunNarrativeEvaluation,
  previous: PostRunNarrativeEvaluation | null,
): PostRunNarrativePlanDiff {
  return computePlanDiff(current, previous);
}

/**
 * Build a stats summary from an arbitrary set of evaluations.
 */
export function buildPostRunNarrativeStatsSummary(
  evaluations: readonly PostRunNarrativeEvaluation[],
): PostRunNarrativeStatsSummary {
  return buildStatsSummaryFromEvaluations(evaluations);
}

// ============================================================================
// MARK: Module bundle
// ============================================================================

export const ChatPostRunNarrativeEngineModule = Object.freeze({
  // Engine class and primary factory
  PostRunNarrativeEngine,
  createPostRunNarrativeEngine,

  // Profile factories
  createPostRunNarrativeEngineFromProfile,
  createCinematicPostRunNarrativeEngine,
  createDebriefPostRunNarrativeEngine,
  createColdClosePostRunNarrativeEngine,
  createGriefPostRunNarrativeEngine,
  createSovereignCeremonyPostRunNarrativeEngine,
  createLegendCeremonyPostRunNarrativeEngine,
  createRapidPostRunNarrativeEngine,

  // Profile constants
  POST_RUN_NARRATIVE_PROFILE_OPTIONS,

  // Standalone utilities
  validatePostRunNarrativeContext: validateContext,
  computePostRunNarrativeDiagnostics,
  buildPostRunNarrativeAuditReport,
  computePostRunNarrativePlanDiff,
  buildPostRunNarrativeStatsSummary,
} as const);
