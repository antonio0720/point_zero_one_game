
// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/chat/intelligence/ml/DropOffRiskScorer.ts

/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT ML DROP-OFF RISK SCORER
 * FILE: pzo-web/src/engines/chat/intelligence/ml/DropOffRiskScorer.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical frontend disengagement / churn / rage-quit scorer for the unified
 * chat intelligence lane.
 *
 * This file upgrades the bridge's base drop-off scalar into a deeper runtime
 * decision surface that understands:
 * - silence after visible failure,
 * - composer abandonment,
 * - panel avoidance loops,
 * - channel flight,
 * - public shame withdrawal,
 * - deal-room fatigue and negotiation abandonment,
 * - helper rescue timing,
 * - lobby rerouting and syndicate stabilization.
 *
 * It owns:
 * - advanced drop-off scoring,
 * - risk family breakdowns,
 * - rescue-opportunity and helper-timing hints,
 * - recovery channel recommendations,
 * - conservative profile refinements,
 * - bridge-safe recommendations that keep frontend fast without stealing
 *   backend authority.
 *
 * It does NOT own:
 * - final churn policy,
 * - liveops retention campaigns,
 * - durable backend learning truth,
 * - moderation enforcement,
 * - transcript mutation.
 *
 * Permanent doctrine
 * ------------------
 * - Silence is data, not absence.
 * - Public embarrassment can accelerate churn.
 * - Recovery and rescue are not identical states.
 * - A player may need route safety before motivational copy.
 * - Deal Room abandonment is distinct from Global withdrawal.
 * - Frontend may intervene early; backend owns durable learning truth.
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ============================================================================
 */

import type {
  ChatLearningBridgeInferencePort,
  ChatLearningBridgeProfileState,
  ChatLearningBridgePublicSnapshot,
  ChatLearningBridgeRecommendation,
} from '../ChatLearningBridge';

import {
  CHAT_LEARNING_BRIDGE_MODULE_NAME,
  CHAT_LEARNING_BRIDGE_VERSION,
} from '../ChatLearningBridge';

import type {
  ChatFeatureSnapshot,
  ChatVisibleChannel,
  Score01,
} from '../types';

import {
  deriveChatFeaturePressureTier,
  deriveChatFeatureTickTier,
  summarizeChatFeatureSnapshot,
  type ChatPressureTier,
  type ChatTickTier,
} from './FeatureExtractor';

import {
  scoreChatEngagement,
  type ChatEngagementScoreResult,
} from './EngagementScorer';

import {
  evaluateChatColdStartPolicy,
  type ChatColdStartPolicyDecision,
} from './ColdStartPolicy';

import {
  resolveChatHaterPersona,
  type ChatHaterPersonaDecision,
} from './HaterPersonaPolicy';

import {
  resolveChatHelperIntervention,
  type ChatHelperInterventionDecision,
} from './HelperInterventionPolicy';

import {
  evaluateChatChannelRecommendationPolicy,
  type ChatChannelRecommendationDecision,
} from './ChannelRecommendationPolicy';

/* ========================================================================== */
/* MARK: Public module constants                                              */
/* ========================================================================== */

export const CHAT_DROP_OFF_RISK_SCORER_MODULE_NAME =
  'PZO_CHAT_DROP_OFF_RISK_SCORER' as const;

export const CHAT_DROP_OFF_RISK_SCORER_VERSION =
  '2026.03.13-drop-off-risk-scorer.v1' as const;

export const CHAT_DROP_OFF_RISK_SCORER_RUNTIME_LAWS = Object.freeze([
  'Silence is a first-class churn signal.',
  'Public shame can convert pressure into avoidance.',
  'Recovery routing may outrank performance-maximizing channel choice.',
  'Helper urgency is different from helper spam.',
  'Deal Room abandonment is not equal to Lobby quietness.',
  'Drop-off scoring must remain explainable from live state and context.',
  'Frontend rescue may fire early; backend truth still wins when synced.',
  'A player can be engaged and still be near an avoidance cliff.',
  'Pressure-rich games require rescue timing, not generic retention prompts.',
  'The scorer should reduce churn without flattening dramatic tension.',
] as const);

export const CHAT_DROP_OFF_RISK_SCORER_DEFAULTS = Object.freeze({
  silenceConcernMs: 12_000,
  silenceCriticalMs: 30_000,
  panelCollapseCritical: 3,
  failedInputCritical: 3,
  channelHopCritical: 5,
  draftCollapseCritical: 4,
  negativeAffectCritical: 0.66,
  rageQuitThreshold: 0.76,
  severeRiskThreshold: 0.74,
  elevatedRiskThreshold: 0.56,
  watchRiskThreshold: 0.34,
  lobbySafetyLift: 0.12,
  syndicateRecoveryLift: 0.08,
  dealRoomWalkawayLift: 0.10,
  publicShamePenalty: 0.10,
  helperRescueLift: 0.12,
  coldStartGuardLift: 0.06,
  lowConfidenceAmplifier: 0.18,
  crowdStressAmplifier: 0.14,
  failurePressureAmplifier: 0.18,
  rescueNeedAmplifier: 0.16,
  queueDepthPenalty: 0.06,
  keepAliveBias: 0.04,
  maxReasonCount: 8,
} as const);

/* ========================================================================== */
/* MARK: Public contracts                                                     */
/* ========================================================================== */

export type ChatDropOffRiskBand =
  | 'NONE'
  | 'LOW'
  | 'WATCH'
  | 'ELEVATED'
  | 'SEVERE';

export type ChatDropOffRecoveryMode =
  | 'NONE'
  | 'SOFT_REASSURE'
  | 'TACTICAL_RECOVERY'
  | 'PRIVATE_REROUTE'
  | 'DIRECT_RESCUE'
  | 'BREATHING_ROOM';

export type ChatDropOffPrimaryDriver =
  | 'SILENCE_STALL'
  | 'FAILURE_FRICTION'
  | 'PUBLIC_WITHDRAWAL'
  | 'CHANNEL_FLIGHT'
  | 'DEALROOM_ABANDON'
  | 'EXHAUSTION'
  | 'MIXED_CONTEXT';

export interface ChatDropOffRuleSpec {
  readonly id: string;
  readonly label: string;
  readonly baseWeight: number;
}

export interface ChatDropOffRiskScorerOptions {
  readonly defaults?: Partial<typeof CHAT_DROP_OFF_RISK_SCORER_DEFAULTS>;
  readonly allowLobbyRecoveryRoute?: boolean;
  readonly allowSyndicateRecoveryRoute?: boolean;
  readonly includeExplanationBreakdown?: boolean;
}

export interface ChatDropOffBreakdownItem {
  readonly id: string;
  readonly label: string;
  readonly contribution01: Score01;
}

export interface ChatDropOffRiskScores {
  readonly dropOffRisk01: Score01;
  readonly rageQuitRisk01: Score01;
  readonly exhaustionRisk01: Score01;
  readonly failureFrictionRisk01: Score01;
  readonly socialWithdrawalRisk01: Score01;
  readonly dealRoomAbandonRisk01: Score01;
  readonly rescueOpportunity01: Score01;
  readonly helperUrgency01: Score01;
}

export interface ChatDropOffRiskBreakdown {
  readonly moduleName: typeof CHAT_DROP_OFF_RISK_SCORER_MODULE_NAME;
  readonly moduleVersion: typeof CHAT_DROP_OFF_RISK_SCORER_VERSION;
  readonly bridgeModuleName: typeof CHAT_LEARNING_BRIDGE_MODULE_NAME;
  readonly bridgeModuleVersion: typeof CHAT_LEARNING_BRIDGE_VERSION;
  readonly pressureTier: ChatPressureTier;
  readonly tickTier: ChatTickTier;
  readonly featureSummary: string;
  readonly primaryDriver: ChatDropOffPrimaryDriver;
  readonly riskBand: ChatDropOffRiskBand;
  readonly recoveryMode: ChatDropOffRecoveryMode;
  readonly explanation: string;
}

export interface ChatDropOffRiskDecision {
  readonly scores: ChatDropOffRiskScores;
  readonly rankedSignals: readonly ChatDropOffBreakdownItem[];
  readonly riskBand: ChatDropOffRiskBand;
  readonly primaryDriver: ChatDropOffPrimaryDriver;
  readonly recoveryMode: ChatDropOffRecoveryMode;
  readonly recommendedChannel: ChatVisibleChannel;
  readonly bridgeRecommendation: ChatLearningBridgeRecommendation;
  readonly profilePatch: Partial<ChatLearningBridgeProfileState>;
  readonly breakdown: ChatDropOffRiskBreakdown;
}

/* ========================================================================== */
/* MARK: Registry                                                             */
/* ========================================================================== */

export const CHAT_DROP_OFF_RULE_REGISTRY = Object.freeze([

Object.freeze({
  id: 'SILENCE_AFTER_COLLAPSE',
  label: 'long silence after a collapse or embarrassment spike',
  baseWeight: 0.22,
}),

Object.freeze({
  id: 'FAILED_INPUT_CLUSTER',
  label: 'failed input cluster or repeated send friction',
  baseWeight: 0.16,
}),

Object.freeze({
  id: 'COMPOSER_ABANDON',
  label: 'typing without resolution or repeated delete churn',
  baseWeight: 0.14,
}),

Object.freeze({
  id: 'PANEL_COLLAPSE_LOOP',
  label: 'panel open-close avoidance pattern',
  baseWeight: 0.14,
}),

Object.freeze({
  id: 'CHANNEL_FLIGHT',
  label: 'channel hopping instead of committing',
  baseWeight: 0.12,
}),

Object.freeze({
  id: 'PUBLIC_SHAME_WITHDRAWAL',
  label: 'public shame withdrawal pressure',
  baseWeight: 0.14,
}),

Object.freeze({
  id: 'DEALROOM_WALKAWAY',
  label: 'deal room pressure causing abandonment',
  baseWeight: 0.12,
}),

Object.freeze({
  id: 'EXHAUSTION_DECAY',
  label: 'slow exhaustion and reduced willingness to respond',
  baseWeight: 0.12,
}),
] as const);

/* ========================================================================== */
/* MARK: Utility types                                                        */
/* ========================================================================== */

interface DropOffDerivedContext {
  readonly feature: ChatFeatureSnapshot | null;
  readonly engagement: ChatEngagementScoreResult;
  readonly coldStart: ChatColdStartPolicyDecision;
  readonly hater: ChatHaterPersonaDecision;
  readonly helper: ChatHelperInterventionDecision;
  readonly channel: ChatChannelRecommendationDecision;
  readonly pressureTier: ChatPressureTier;
  readonly tickTier: ChatTickTier;
  readonly featureSummary: string;
  readonly activeChannel: ChatVisibleChannel;
  readonly silenceWindowMs: number;
  readonly panelOpen: boolean;
  readonly composerLength: number;
  readonly avgResponseDelayMs: number;
  readonly avgTypingDurationMs: number;
  readonly repeatedComposerDeletes: number;
  readonly panelCollapseCount: number;
  readonly channelHopCount: number;
  readonly failedInputCount: number;
  readonly negativeEmotionScore: number;
  readonly quietness01: number;
  readonly churnPressure01: number;
  readonly confidence01: number;
  readonly shameSensitivity01: number;
  readonly audienceHeat01: number;
  readonly crowdStress01: number;
  readonly rescueNeed01: number;
  readonly negotiationGuard01: number;
  readonly haterHeat01: number;
  readonly helperHeat01: number;
  readonly queueDepth: number;
}

/* ========================================================================== */
/* MARK: Small utilities                                                      */
/* ========================================================================== */

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function asScore01(value: number): Score01 {
  return clamp01(value) as Score01;
}

function safeNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function safeBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function ratio(part: number, total: number): number {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return 0;
  return part / total;
}

function max0(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function getFeature(snapshot: ChatLearningBridgePublicSnapshot): ChatFeatureSnapshot | null {
  return snapshot.latestFeatureSnapshot ?? null;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function bandFromScore(score01: number, defaults: typeof CHAT_DROP_OFF_RISK_SCORER_DEFAULTS): ChatDropOffRiskBand {
  if (score01 >= defaults.severeRiskThreshold) return 'SEVERE';
  if (score01 >= defaults.elevatedRiskThreshold) return 'ELEVATED';
  if (score01 >= defaults.watchRiskThreshold) return 'WATCH';
  if (score01 > 0.04) return 'LOW';
  return 'NONE';
}

function getRule(id: string): ChatDropOffRuleSpec {
  return (
    CHAT_DROP_OFF_RULE_REGISTRY.find((rule) => rule.id === id) ??
    CHAT_DROP_OFF_RULE_REGISTRY[0]
  ) as ChatDropOffRuleSpec;
}

function buildItem(id: string, contribution01: number): ChatDropOffBreakdownItem {
  const rule = getRule(id);
  return Object.freeze({
    id: rule.id,
    label: rule.label,
    contribution01: asScore01(contribution01),
  });
}

/* ========================================================================== */
/* MARK: Context builder                                                      */
/* ========================================================================== */

function buildContext(
  snapshot: ChatLearningBridgePublicSnapshot,
): DropOffDerivedContext {
  const feature = getFeature(snapshot);
  const pressureTier = deriveChatFeaturePressureTier(feature);
  const tickTier = deriveChatFeatureTickTier(feature);
  const featureSummary = summarizeChatFeatureSnapshot(feature);
  const engagement = scoreChatEngagement(snapshot);
  const coldStart = evaluateChatColdStartPolicy(snapshot);
  const hater = resolveChatHaterPersona(snapshot);
  const helper = resolveChatHelperIntervention(snapshot);
  const channel = evaluateChatChannelRecommendationPolicy(snapshot);

  const featureRecord = asRecord(feature as unknown);
  const scalarFeatures = asRecord(featureRecord.scalarFeatures);
  const socialFeatures = asRecord(featureRecord.socialFeatures);
  const dropOffSignals = asRecord(featureRecord.dropOffSignals);

  return Object.freeze({
    feature,
    engagement,
    coldStart,
    hater,
    helper,
    channel,
    pressureTier,
    tickTier,
    featureSummary,
    activeChannel: snapshot.activeChannel,
    silenceWindowMs: max0(safeNumber(featureRecord.silenceWindowMs, safeNumber(dropOffSignals.silenceAfterCollapseMs, 0))),
    panelOpen: safeBoolean(featureRecord.panelOpen, snapshot.isOpen),
    composerLength: max0(safeNumber(featureRecord.composerLength, 0)),
    avgResponseDelayMs: max0(safeNumber(featureRecord.avgResponseDelayMs, 0)),
    avgTypingDurationMs: max0(safeNumber(featureRecord.avgTypingDurationMs, 0)),
    repeatedComposerDeletes: max0(safeNumber(dropOffSignals.repeatedComposerDeletes, 0)),
    panelCollapseCount: max0(safeNumber(dropOffSignals.panelCollapseCount, 0)),
    channelHopCount: max0(safeNumber(dropOffSignals.channelHopCount, 0)),
    failedInputCount: max0(safeNumber(dropOffSignals.failedInputCount, 0)),
    negativeEmotionScore: clamp01(safeNumber(dropOffSignals.negativeEmotionScore, 0)),
    quietness01: clamp01(safeNumber(scalarFeatures.quietness01, 0)),
    churnPressure01: clamp01(safeNumber(dropOffSignals.churnPressure01, snapshot.profile.dropOffRisk01)),
    confidence01: clamp01(safeNumber(featureRecord.confidence01, snapshot.profile.confidence01)),
    shameSensitivity01: clamp01(safeNumber(featureRecord.shameSensitivity01, snapshot.profile.shameSensitivity01)),
    audienceHeat01: clamp01(safeNumber(featureRecord.audienceHeat01, 0)),
    crowdStress01: clamp01(safeNumber(socialFeatures.crowdStress01, 0)),
    rescueNeed01: clamp01(safeNumber(featureRecord.rescueNeed01, snapshot.profile.rescueNeed01)),
    negotiationGuard01: clamp01(safeNumber(scalarFeatures.negotiationGuard01, 0)),
    haterHeat01: clamp01(ratio(safeNumber(featureRecord.haterHeat, 0), 100)),
    helperHeat01: clamp01(ratio(safeNumber(featureRecord.helperHeat, 0), 100)),
    queueDepth: max0(safeNumber(featureRecord.queueDepth, snapshot.queueDepth)),
  });
}

/* ========================================================================== */
/* MARK: Scoring primitives                                                   */
/* ========================================================================== */

function scoreSilenceStall(
  context: DropOffDerivedContext,
  defaults: typeof CHAT_DROP_OFF_RISK_SCORER_DEFAULTS,
): Score01 {
  const silenceSeverity = clamp01(
    ratio(context.silenceWindowMs - defaults.silenceConcernMs, defaults.silenceCriticalMs - defaults.silenceConcernMs),
  );
  return asScore01(
    clamp01(
      silenceSeverity * 0.46 +
        context.quietness01 * 0.18 +
        clamp01(context.avgResponseDelayMs / defaults.silenceCriticalMs) * 0.16 +
        clamp01(1 - context.confidence01) * 0.12 +
        context.churnPressure01 * 0.08,
    ),
  );
}

function scoreFailureFriction(
  context: DropOffDerivedContext,
  defaults: typeof CHAT_DROP_OFF_RISK_SCORER_DEFAULTS,
): Score01 {
  return asScore01(
    clamp01(
      clamp01(ratio(context.failedInputCount, defaults.failedInputCritical)) * 0.34 +
        clamp01(ratio(context.repeatedComposerDeletes, defaults.draftCollapseCritical)) * 0.24 +
        clamp01(ratio(context.queueDepth, 8)) * defaults.queueDepthPenalty +
        context.churnPressure01 * 0.18 +
        context.helper.bridgeRecommendation.helperUrgency01 * 0.06 +
        context.coldStart.helperPlan.helperUrgency01 * 0.06,
    ),
  );
}

function scoreSocialWithdrawal(
  context: DropOffDerivedContext,
  defaults: typeof CHAT_DROP_OFF_RISK_SCORER_DEFAULTS,
): Score01 {
  const globalBias = context.activeChannel === 'GLOBAL' ? defaults.publicShamePenalty : 0;
  return asScore01(
    clamp01(
      context.shameSensitivity01 * 0.22 +
        clamp01(1 - context.confidence01) * defaults.lowConfidenceAmplifier +
        context.audienceHeat01 * 0.14 +
        context.crowdStress01 * defaults.crowdStressAmplifier +
        context.haterHeat01 * 0.12 +
        globalBias,
    ),
  );
}

function scoreDealRoomAbandon(
  context: DropOffDerivedContext,
  defaults: typeof CHAT_DROP_OFF_RISK_SCORER_DEFAULTS,
): Score01 {
  const dealBias = context.activeChannel === 'DEAL_ROOM' ? defaults.dealRoomWalkawayLift : 0;
  return asScore01(
    clamp01(
      context.negotiationGuard01 * 0.26 +
        context.churnPressure01 * 0.22 +
        context.haterHeat01 * 0.08 +
        clamp01(1 - context.confidence01) * 0.16 +
        context.coldStart.negotiationPlan.offerFrictionLift01 * 0.12 +
        dealBias,
    ),
  );
}

function scoreExhaustion(
  context: DropOffDerivedContext,
): Score01 {
  return asScore01(
    clamp01(
      clamp01(context.avgTypingDurationMs / 8_000) * 0.20 +
        clamp01(context.avgResponseDelayMs / 14_000) * 0.24 +
        context.quietness01 * 0.18 +
        context.churnPressure01 * 0.18 +
        context.negativeEmotionScore * 0.12 +
        clamp01(1 - context.confidence01) * 0.08,
    ),
  );
}

function scoreRescueOpportunity(
  context: DropOffDerivedContext,
  socialWithdrawalRisk01: number,
  failureFrictionRisk01: number,
  defaults: typeof CHAT_DROP_OFF_RISK_SCORER_DEFAULTS,
): Score01 {
  return asScore01(
    clamp01(
      context.rescueNeed01 * defaults.rescueNeedAmplifier +
        context.helper.bridgeRecommendation.helperUrgency01 * defaults.helperRescueLift +
        socialWithdrawalRisk01 * 0.16 +
        failureFrictionRisk01 * 0.14 +
        context.coldStart.helperPlan.helperUrgency01 * 0.12 +
        context.helperHeat01 * 0.08,
    ),
  );
}

function scoreRageQuit(
  context: DropOffDerivedContext,
  silenceRisk01: number,
  failureFrictionRisk01: number,
  socialWithdrawalRisk01: number,
  defaults: typeof CHAT_DROP_OFF_RISK_SCORER_DEFAULTS,
): Score01 {
  return asScore01(
    clamp01(
      silenceRisk01 * 0.24 +
        failureFrictionRisk01 * defaults.failurePressureAmplifier +
        socialWithdrawalRisk01 * 0.18 +
        context.negativeEmotionScore * 0.14 +
        context.haterHeat01 * 0.10 +
        clamp01(1 - context.confidence01) * 0.08,
    ),
  );
}

function choosePrimaryDriver(
  silenceRisk01: number,
  failureFrictionRisk01: number,
  socialWithdrawalRisk01: number,
  dealRoomAbandonRisk01: number,
  exhaustionRisk01: number,
  context: DropOffDerivedContext,
): ChatDropOffPrimaryDriver {
  const pairs: Array<[ChatDropOffPrimaryDriver, number]> = [
    ['SILENCE_STALL', silenceRisk01],
    ['FAILURE_FRICTION', failureFrictionRisk01],
    ['PUBLIC_WITHDRAWAL', socialWithdrawalRisk01],
    ['DEALROOM_ABANDON', dealRoomAbandonRisk01],
    ['EXHAUSTION', exhaustionRisk01],
    ['CHANNEL_FLIGHT', clamp01(ratio(context.channelHopCount, 5))],
  ];
  pairs.sort((a, b) => b[1] - a[1]);
  const best = pairs[0];
  if (!best || best[1] <= 0.20) return 'MIXED_CONTEXT';
  return best[0];
}

function chooseRecoveryMode(
  riskBand: ChatDropOffRiskBand,
  primaryDriver: ChatDropOffPrimaryDriver,
  rescueOpportunity01: number,
  context: DropOffDerivedContext,
): ChatDropOffRecoveryMode {
  if (riskBand === 'SEVERE' && rescueOpportunity01 >= 0.66) return 'DIRECT_RESCUE';
  if (primaryDriver === 'PUBLIC_WITHDRAWAL' || primaryDriver === 'CHANNEL_FLIGHT') return 'PRIVATE_REROUTE';
  if (primaryDriver === 'DEALROOM_ABANDON') return 'TACTICAL_RECOVERY';
  if (riskBand === 'ELEVATED') return 'SOFT_REASSURE';
  if (context.coldStart.openingPlan.respectSilenceFirst && context.quietness01 >= 0.56) return 'BREATHING_ROOM';
  return 'NONE';
}

function chooseRecommendedChannel(
  recoveryMode: ChatDropOffRecoveryMode,
  context: DropOffDerivedContext,
  defaults: typeof CHAT_DROP_OFF_RISK_SCORER_DEFAULTS,
  options: ChatDropOffRiskScorerOptions,
): ChatVisibleChannel {
  if (
    safeBoolean(options.allowLobbyRecoveryRoute, true) &&
    (recoveryMode === 'DIRECT_RESCUE' || recoveryMode === 'BREATHING_ROOM')
  ) {
    return 'LOBBY';
  }

  if (
    safeBoolean(options.allowSyndicateRecoveryRoute, true) &&
    (recoveryMode === 'PRIVATE_REROUTE' || recoveryMode === 'TACTICAL_RECOVERY') &&
    context.channel.channelScores.SYNDICATE >= context.channel.channelScores.GLOBAL - defaults.syndicateRecoveryLift
  ) {
    return 'SYNDICATE';
  }

  if (recoveryMode === 'TACTICAL_RECOVERY' && context.activeChannel === 'DEAL_ROOM') return 'SYNDICATE';
  if (recoveryMode === 'NONE') return context.channel.recommendedChannel;
  return context.activeChannel;
}

function buildBridgeRecommendation(
  channel: ChatVisibleChannel,
  scores: ChatDropOffRiskScores,
  recoveryMode: ChatDropOffRecoveryMode,
  explanation: string,
): ChatLearningBridgeRecommendation {
  return Object.freeze({
    recommendedChannel: channel,
    helperUrgency01: scores.helperUrgency01,
    rescueNeeded:
      recoveryMode === 'DIRECT_RESCUE' ||
      scores.rageQuitRisk01 >= 0.70 ||
      scores.dropOffRisk01 >= 0.72,
    haterAggression01: asScore01(scores.dropOffRisk01 * 0.36),
    dropOffRisk01: scores.dropOffRisk01,
    explanation,
  });
}

function buildProfilePatch(
  snapshot: ChatLearningBridgePublicSnapshot,
  scores: ChatDropOffRiskScores,
  channel: ChatVisibleChannel,
  recoveryMode: ChatDropOffRecoveryMode,
): Partial<ChatLearningBridgeProfileState> {
  const profile = snapshot.profile;
  return Object.freeze({
    preferredChannel:
      recoveryMode === 'NONE' ? profile.preferredChannel : channel,
    dropOffRisk01: asScore01(
      profile.dropOffRisk01 * 0.78 + scores.dropOffRisk01 * 0.22,
    ),
    helperNeed01: asScore01(
      profile.helperNeed01 + scores.helperUrgency01 * 0.08,
    ),
    rescueNeed01: asScore01(
      profile.rescueNeed01 + scores.rescueOpportunity01 * 0.08,
    ),
    confidence01: asScore01(
      profile.confidence01 - scores.failureFrictionRisk01 * 0.08,
    ),
    globalAffinity01: asScore01(
      profile.globalAffinity01 - scores.socialWithdrawalRisk01 * 0.08,
    ),
    syndicateAffinity01: asScore01(
      profile.syndicateAffinity01 + (channel === 'SYNDICATE' ? 0.04 : 0),
    ),
  });
}

function buildExplanation(
  scores: ChatDropOffRiskScores,
  primaryDriver: ChatDropOffPrimaryDriver,
  recoveryMode: ChatDropOffRecoveryMode,
  band: ChatDropOffRiskBand,
  context: DropOffDerivedContext,
): string {
  const parts: string[] = [
    `drop=${scores.dropOffRisk01.toFixed(2)}`,
    `band=${band.toLowerCase()}`,
    `driver=${primaryDriver.toLowerCase()}`,
    `mode=${recoveryMode.toLowerCase()}`,
  ];
  if (scores.rageQuitRisk01 >= 0.50) parts.push(`rage=${scores.rageQuitRisk01.toFixed(2)}`);
  if (scores.failureFrictionRisk01 >= 0.48) parts.push(`friction=${scores.failureFrictionRisk01.toFixed(2)}`);
  if (scores.socialWithdrawalRisk01 >= 0.48) parts.push(`withdraw=${scores.socialWithdrawalRisk01.toFixed(2)}`);
  if (context.activeChannel === 'GLOBAL') parts.push('global-stage');
  if (context.activeChannel === 'DEAL_ROOM') parts.push('deal-room');
  return parts.join(' | ');
}

/* ========================================================================== */
/* MARK: Policy class                                                         */
/* ========================================================================== */

export class ChatDropOffRiskScorer
  implements ChatLearningBridgeInferencePort
{
  private readonly defaults: typeof CHAT_DROP_OFF_RISK_SCORER_DEFAULTS;
  private readonly options: ChatDropOffRiskScorerOptions;

  public constructor(options: ChatDropOffRiskScorerOptions = {}) {
    this.options = options;
    this.defaults = Object.freeze({
      ...CHAT_DROP_OFF_RISK_SCORER_DEFAULTS,
      ...(options.defaults ?? {}),
    });
  }

  public evaluate(snapshot: ChatLearningBridgePublicSnapshot): ChatDropOffRiskDecision {
    const context = buildContext(snapshot);
    const silenceRisk01 = scoreSilenceStall(context, this.defaults);
    const failureFrictionRisk01 = scoreFailureFriction(context, this.defaults);
    const socialWithdrawalRisk01 = scoreSocialWithdrawal(context, this.defaults);
    const dealRoomAbandonRisk01 = scoreDealRoomAbandon(context, this.defaults);
    const exhaustionRisk01 = scoreExhaustion(context);
    const rescueOpportunity01 = scoreRescueOpportunity(
      context,
      socialWithdrawalRisk01,
      failureFrictionRisk01,
      this.defaults,
    );
    const rageQuitRisk01 = scoreRageQuit(
      context,
      silenceRisk01,
      failureFrictionRisk01,
      socialWithdrawalRisk01,
      this.defaults,
    );

    const helperUrgency01 = asScore01(
      Math.max(
        rescueOpportunity01,
        context.helper.bridgeRecommendation.helperUrgency01,
        context.coldStart.helperPlan.helperUrgency01,
      ),
    );

    const dropOffRisk01 = asScore01(
      clamp01(
        silenceRisk01 * 0.20 +
          failureFrictionRisk01 * 0.18 +
          socialWithdrawalRisk01 * 0.18 +
          dealRoomAbandonRisk01 * 0.12 +
          exhaustionRisk01 * 0.12 +
          rageQuitRisk01 * 0.12 +
          context.churnPressure01 * 0.08,
      ),
    );

    const scores: ChatDropOffRiskScores = Object.freeze({
      dropOffRisk01,
      rageQuitRisk01,
      exhaustionRisk01,
      failureFrictionRisk01,
      socialWithdrawalRisk01,
      dealRoomAbandonRisk01,
      rescueOpportunity01,
      helperUrgency01,
    });

    const riskBand = bandFromScore(dropOffRisk01, this.defaults);
    const primaryDriver = choosePrimaryDriver(
      silenceRisk01,
      failureFrictionRisk01,
      socialWithdrawalRisk01,
      dealRoomAbandonRisk01,
      exhaustionRisk01,
      context,
    );
    const recoveryMode = chooseRecoveryMode(
      riskBand,
      primaryDriver,
      rescueOpportunity01,
      context,
    );
    const recommendedChannel = chooseRecommendedChannel(
      recoveryMode,
      context,
      this.defaults,
      this.options,
    );
    const explanation = buildExplanation(
      scores,
      primaryDriver,
      recoveryMode,
      riskBand,
      context,
    );
    const bridgeRecommendation = buildBridgeRecommendation(
      recommendedChannel,
      scores,
      recoveryMode,
      explanation,
    );
    const profilePatch = buildProfilePatch(
      snapshot,
      scores,
      recommendedChannel,
      recoveryMode,
    );

    const rankedSignals = Object.freeze([
      buildItem('SILENCE_AFTER_COLLAPSE', silenceRisk01),
      buildItem('FAILED_INPUT_CLUSTER', failureFrictionRisk01),
      buildItem('COMPOSER_ABANDON', clamp01(ratio(context.repeatedComposerDeletes, this.defaults.draftCollapseCritical))),
      buildItem('PANEL_COLLAPSE_LOOP', clamp01(ratio(context.panelCollapseCount, this.defaults.panelCollapseCritical))),
      buildItem('CHANNEL_FLIGHT', clamp01(ratio(context.channelHopCount, this.defaults.channelHopCritical))),
      buildItem('PUBLIC_SHAME_WITHDRAWAL', socialWithdrawalRisk01),
      buildItem('DEALROOM_WALKAWAY', dealRoomAbandonRisk01),
      buildItem('EXHAUSTION_DECAY', exhaustionRisk01),
    ].sort((a, b) => b.contribution01 - a.contribution01).slice(0, this.defaults.maxReasonCount));

    const breakdown: ChatDropOffRiskBreakdown = Object.freeze({
      moduleName: CHAT_DROP_OFF_RISK_SCORER_MODULE_NAME,
      moduleVersion: CHAT_DROP_OFF_RISK_SCORER_VERSION,
      bridgeModuleName: CHAT_LEARNING_BRIDGE_MODULE_NAME,
      bridgeModuleVersion: CHAT_LEARNING_BRIDGE_VERSION,
      pressureTier: context.pressureTier,
      tickTier: context.tickTier,
      featureSummary: context.featureSummary,
      primaryDriver,
      riskBand,
      recoveryMode,
      explanation,
    });

    return Object.freeze({
      scores,
      rankedSignals,
      riskBand,
      primaryDriver,
      recoveryMode,
      recommendedChannel,
      bridgeRecommendation,
      profilePatch,
      breakdown,
    });
  }

  public recommend(
    snapshot: ChatLearningBridgePublicSnapshot,
  ): ChatLearningBridgeRecommendation {
    return this.evaluate(snapshot).bridgeRecommendation;
  }

  public refineProfile(
    snapshot: ChatLearningBridgePublicSnapshot,
  ): Partial<ChatLearningBridgeProfileState> {
    return this.evaluate(snapshot).profilePatch;
  }
}

/* ========================================================================== */
/* MARK: Public helpers                                                       */
/* ========================================================================== */

export function createChatDropOffRiskScorer(
  options: ChatDropOffRiskScorerOptions = {},
): ChatDropOffRiskScorer {
  return new ChatDropOffRiskScorer(options);
}

export function evaluateChatDropOffRisk(
  snapshot: ChatLearningBridgePublicSnapshot,
  options: ChatDropOffRiskScorerOptions = {},
): ChatDropOffRiskDecision {
  return createChatDropOffRiskScorer(options).evaluate(snapshot);
}

export function recommendChatDropOffRecovery(
  snapshot: ChatLearningBridgePublicSnapshot,
  options: ChatDropOffRiskScorerOptions = {},
): ChatLearningBridgeRecommendation {
  return createChatDropOffRiskScorer(options).recommend(snapshot);
}

export function refineDropOffRiskProfileState(
  snapshot: ChatLearningBridgePublicSnapshot,
  options: ChatDropOffRiskScorerOptions = {},
): Partial<ChatLearningBridgeProfileState> {
  return createChatDropOffRiskScorer(options).refineProfile(snapshot);
}

export const CHAT_DROP_OFF_RISK_SCORER_NAMESPACE = Object.freeze({
  moduleName: CHAT_DROP_OFF_RISK_SCORER_MODULE_NAME,
  version: CHAT_DROP_OFF_RISK_SCORER_VERSION,
  runtimeLaws: CHAT_DROP_OFF_RISK_SCORER_RUNTIME_LAWS,
  defaults: CHAT_DROP_OFF_RISK_SCORER_DEFAULTS,
  rules: CHAT_DROP_OFF_RULE_REGISTRY,
  create: createChatDropOffRiskScorer,
  evaluate: evaluateChatDropOffRisk,
  recommend: recommendChatDropOffRecovery,
  refineProfile: refineDropOffRiskProfileState,
} as const);

export default ChatDropOffRiskScorer;
