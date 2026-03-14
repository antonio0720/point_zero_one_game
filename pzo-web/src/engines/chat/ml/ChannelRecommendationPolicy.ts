
// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/chat/intelligence/ml/ChannelRecommendationPolicy.ts

/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT ML CHANNEL RECOMMENDATION POLICY
 * FILE: pzo-web/src/engines/chat/intelligence/ml/ChannelRecommendationPolicy.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical visible-channel recommendation policy for the unified frontend chat
 * intelligence lane.
 *
 * This file promotes channel choice from a flat affinity score into a full
 * decision surface that understands:
 * - pressure and tick compression,
 * - helper timing and rescue posture,
 * - hater persona pressure,
 * - crowd heat and shame exposure,
 * - deal-room negotiation risk,
 * - mount-aware stage fit,
 * - cold-start opening laws,
 * - channel safety vs theatricality.
 *
 * It owns:
 * - multi-factor visible-channel scoring,
 * - route explanations,
 * - confidence / rescue / negotiation routing,
 * - channel-specific deterrence and lift rules,
 * - bridge-safe recommendation and profile refinement,
 * - compile-safe decision payloads ChatEngine and UI shells can consume now.
 *
 * It does NOT own:
 * - shadow-channel authority,
 * - transcript truth,
 * - backend room membership truth,
 * - liveops fanout,
 * - moderation enforcement.
 *
 * Permanent doctrine
 * ------------------
 * - One dock, multiple contexts, zero per-screen chat brains.
 * - Channel choice should feel authored, not incidental.
 * - Global is theatrical, not automatically optimal.
 * - Syndicate is trust-biased and tactically intimate.
 * - Deal Room is predatory, private, and negotiation-aware.
 * - Lobby is a valid recovery route, not a downgrade.
 * - Client recommendations remain advisory until backend truth responds.
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
  type ChatChannelRecommendationScores,
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

/* ========================================================================== */
/* MARK: Public module constants                                              */
/* ========================================================================== */

export const CHAT_CHANNEL_RECOMMENDATION_POLICY_MODULE_NAME =
  'PZO_CHAT_CHANNEL_RECOMMENDATION_POLICY' as const;

export const CHAT_CHANNEL_RECOMMENDATION_POLICY_VERSION =
  '2026.03.13-channel-recommendation-policy.v1' as const;

export const CHAT_CHANNEL_RECOMMENDATION_POLICY_RUNTIME_LAWS = Object.freeze([
  'Visible-channel routing is contextual, not static.',
  'Global is a stage, not a default refuge.',
  'Syndicate should absorb tactical and trust-heavy communication.',
  'Deal Room should only gain lift when negotiation logic justifies it.',
  'Lobby remains a legitimate stabilization channel.',
  'Helper rescue can reroute away from performance-maximizing exposure.',
  'Hater pressure may justify deflection rather than escalation.',
  'Cold-start laws constrain early routing.',
  'Every route should be explainable from live state and channel semantics.',
  'Frontend routing is advisory until backend authority confirms.',
] as const);

export const CHAT_CHANNEL_RECOMMENDATION_POLICY_DEFAULTS = Object.freeze({
  routeSmoothingAlpha: 0.16,
  globalStagePenalty: 0.12,
  globalChallengeLift: 0.08,
  globalLegendLift: 0.06,
  syndicateTrustLift: 0.10,
  syndicateRecoveryLift: 0.08,
  dealRoomNegotiationLift: 0.14,
  dealRoomRiskPenalty: 0.12,
  lobbyRescueLift: 0.14,
  lobbyRecoveryLift: 0.10,
  lobbyChallengePenalty: 0.06,
  preferredChannelBias: 0.06,
  activeChannelBias: 0.04,
  mountMatchBias: 0.08,
  crowdContainmentPenalty: 0.12,
  publicShamePenalty: 0.10,
  helperPresenceLift: 0.08,
  haterPressurePenalty: 0.08,
  negotiationGuardLift: 0.10,
  rescueThreshold: 0.66,
  crowdDeflectionThreshold: 0.58,
  negotiationThreshold: 0.58,
  comebackThreshold: 0.62,
  confidenceCollapseThreshold: 0.36,
  lowRiskChallengeFloor: 0.42,
} as const);

/* ========================================================================== */
/* MARK: Public contracts                                                     */
/* ========================================================================== */

export interface ChatChannelRecommendationPolicyOptions {
  readonly defaults?: Partial<typeof CHAT_CHANNEL_RECOMMENDATION_POLICY_DEFAULTS>;
  readonly allowGlobalTheatrics?: boolean;
  readonly allowLobbyRecoveryRoutes?: boolean;
  readonly allowDealRoomGuard?: boolean;
  readonly includeExplanationBreakdown?: boolean;
}

export type ChatChannelRouteReason =
  | 'ACTIVE_MOMENTUM'
  | 'PREFERRED_HABIT'
  | 'CROWD_DEFLECTION'
  | 'NEGOTIATION_PRIVATE'
  | 'RESCUE_ROUTE'
  | 'RECOVERY_ROUTE'
  | 'COMEBACK_STAGE'
  | 'TACTICAL_INTIMACY'
  | 'MOUNT_MATCH'
  | 'COLD_START_GUARD'
  | 'HATER_AVOIDANCE'
  | 'HELPER_ALIGNMENT';

export interface ChatChannelBreakdownItem {
  readonly channel: ChatVisibleChannel;
  readonly score01: Score01;
  readonly reasons: readonly ChatChannelRouteReason[];
}

export interface ChatChannelRecommendationBreakdown {
  readonly moduleName: typeof CHAT_CHANNEL_RECOMMENDATION_POLICY_MODULE_NAME;
  readonly moduleVersion: typeof CHAT_CHANNEL_RECOMMENDATION_POLICY_VERSION;
  readonly bridgeModuleName: typeof CHAT_LEARNING_BRIDGE_MODULE_NAME;
  readonly bridgeModuleVersion: typeof CHAT_LEARNING_BRIDGE_VERSION;
  readonly pressureTier: ChatPressureTier;
  readonly tickTier: ChatTickTier;
  readonly featureSummary: string;
  readonly dominantRoute:
    | 'TACTICAL_SAFETY'
    | 'THEATRICAL_PRESSURE'
    | 'NEGOTIATION_PRIVACY'
    | 'RECOVERY'
    | 'COMEBACK'
    | 'DEFAULT';
  readonly explanation: string;
}

export interface ChatChannelRecommendationDecision {
  readonly recommendedChannel: ChatVisibleChannel;
  readonly channelScores: ChatChannelRecommendationScores;
  readonly ranked: readonly ChatChannelBreakdownItem[];
  readonly bridgeRecommendation: ChatLearningBridgeRecommendation;
  readonly profilePatch: Partial<ChatLearningBridgeProfileState>;
  readonly breakdown: ChatChannelRecommendationBreakdown;
}

/* ========================================================================== */
/* MARK: Utility types                                                        */
/* ========================================================================== */

type RouteScores = ChatChannelRecommendationScores;

interface ChannelDerivedContext {
  readonly featureSnapshot: ChatFeatureSnapshot | null;
  readonly engagement: ChatEngagementScoreResult;
  readonly coldStart: ChatColdStartPolicyDecision;
  readonly hater: ChatHaterPersonaDecision | null;
  readonly helper: ChatHelperInterventionDecision | null;
  readonly pressureTier: ChatPressureTier;
  readonly tickTier: ChatTickTier;
  readonly featureSummary: string;
  readonly crowdContainment01: Score01;
  readonly publicStageRisk01: Score01;
  readonly negotiationNeed01: Score01;
  readonly recoveryNeed01: Score01;
  readonly comebackPotential01: Score01;
  readonly coldWindow: boolean;
}

/* ========================================================================== */
/* MARK: Small primitives                                                     */
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

function lerp01(a: number, b: number, alpha: number): number {
  return clamp01(a + (b - a) * clamp01(alpha));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function asFiniteNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeVisibleChannel(
  value: unknown,
  fallback: ChatVisibleChannel = 'GLOBAL',
): ChatVisibleChannel {
  switch (value) {
    case 'GLOBAL':
    case 'SYNDICATE':
    case 'DEAL_ROOM':
    case 'LOBBY':
      return value;
    default:
      return fallback;
  }
}

function createChannelScoreMap(seed = 0): RouteScores {
  return {
    GLOBAL: asScore01(seed),
    SYNDICATE: asScore01(seed),
    DEAL_ROOM: asScore01(seed),
    LOBBY: asScore01(seed),
  };
}

function getFeatureSnapshot(
  snapshot: ChatLearningBridgePublicSnapshot,
): ChatFeatureSnapshot | null {
  const candidate = snapshot.latestFeatureSnapshot;
  return candidate && isRecord(candidate) ? (candidate as ChatFeatureSnapshot) : null;
}

function getActiveChannel(snapshot: ChatLearningBridgePublicSnapshot): ChatVisibleChannel {
  return normalizeVisibleChannel(snapshot.activeChannel, 'GLOBAL');
}

function getPreferredChannel(snapshot: ChatLearningBridgePublicSnapshot): ChatVisibleChannel {
  return normalizeVisibleChannel(snapshot.profile.preferredChannel, getActiveChannel(snapshot));
}

function getMountTarget(snapshot: ChatLearningBridgePublicSnapshot): string {
  const feature = snapshot.latestFeatureSnapshot as Record<string, unknown> | null;
  const value = feature?.['mountTarget'];
  return typeof value === 'string' && value.trim().length ? value.trim() : 'UNKNOWN';
}

function mountCategory(mountTarget: string): 'LOBBY' | 'BATTLE' | 'EMPIRE' | 'BOARD' | 'OTHER' {
  const upper = mountTarget.toUpperCase();
  if (upper.includes('LOBBY')) return 'LOBBY';
  if (upper.includes('BATTLE') || upper.includes('HUD')) return 'BATTLE';
  if (upper.includes('EMPIRE') || upper.includes('SYNDICATE')) return 'EMPIRE';
  if (upper.includes('BOARD') || upper.includes('GAME')) return 'BOARD';
  return 'OTHER';
}

function safePressureTier(featureSnapshot: ChatFeatureSnapshot | null): ChatPressureTier {
  if (!featureSnapshot) return 'CALM';
  try {
    return deriveChatFeaturePressureTier(featureSnapshot);
  } catch {
    return 'CALM';
  }
}

function safeTickTier(featureSnapshot: ChatFeatureSnapshot | null): ChatTickTier {
  if (!featureSnapshot) return 'STABLE';
  try {
    return deriveChatFeatureTickTier(featureSnapshot);
  } catch {
    return 'STABLE';
  }
}

function safeSummary(featureSnapshot: ChatFeatureSnapshot | null): string {
  if (!featureSnapshot) return 'feature:none';
  try {
    return summarizeChatFeatureSnapshot(featureSnapshot);
  } catch {
    return 'feature:unavailable';
  }
}

function getChannelShare(
  featureSnapshot: ChatFeatureSnapshot | null,
  key: string,
  channel: ChatVisibleChannel,
  fallback = 0,
): number {
  if (!featureSnapshot || !isRecord(featureSnapshot)) return fallback;
  const source = featureSnapshot[key];
  if (!isRecord(source)) return fallback;
  return asFiniteNumber(source[channel], fallback);
}

function getScalarFeature(
  featureSnapshot: ChatFeatureSnapshot | null,
  key: string,
  fallback = 0,
): number {
  if (!featureSnapshot || !isRecord(featureSnapshot)) return fallback;
  const direct = featureSnapshot[key];
  if (typeof direct === 'number' && Number.isFinite(direct)) return direct;

  for (const bucketKey of ['scalar', 'scalars', 'scalarFeatures', 'core', 'scores']) {
    const bucket = featureSnapshot[bucketKey];
    if (!isRecord(bucket)) continue;
    const value = bucket[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }

  return fallback;
}

function getSocialFeature(
  featureSnapshot: ChatFeatureSnapshot | null,
  key: string,
  fallback = 0,
): number {
  if (!featureSnapshot || !isRecord(featureSnapshot)) return fallback;

  for (const bucketKey of ['social', 'socialFeatures', 'audience', 'crowd', 'stage']) {
    const bucket = featureSnapshot[bucketKey];
    if (!isRecord(bucket)) continue;
    const value = bucket[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }

  const direct = featureSnapshot[key];
  return typeof direct === 'number' && Number.isFinite(direct) ? direct : fallback;
}

function sortChannelScores(
  scores: RouteScores,
  reasons: Readonly<Record<ChatVisibleChannel, readonly ChatChannelRouteReason[]>>,
): readonly ChatChannelBreakdownItem[] {
  return (Object.keys(scores) as ChatVisibleChannel[])
    .map((channel) =>
      Object.freeze({
        channel,
        score01: scores[channel],
        reasons: reasons[channel] ?? [],
      }),
    )
    .sort((a, b) => {
      if (b.score01 !== a.score01) return b.score01 - a.score01;
      if (a.channel < b.channel) return -1;
      if (a.channel > b.channel) return 1;
      return 0;
    });
}

function coldWindow(snapshot: ChatLearningBridgePublicSnapshot): boolean {
  return (
    snapshot.profile.totalChatOpens <= 2 ||
    snapshot.profile.totalMessagesOutbound <= 3 ||
    snapshot.profile.totalSessionsSeen <= 2
  );
}

/* ========================================================================== */
/* MARK: Need scores                                                          */
/* ========================================================================== */

function scoreCrowdContainmentNeed(
  featureSnapshot: ChatFeatureSnapshot | null,
  engagement: ChatEngagementScoreResult,
): Score01 {
  return asScore01(
    clamp01(
      getSocialFeature(featureSnapshot, 'publicStagePressure01', engagement.vector.socialPressure01 * 0.82) * 0.42 +
        getSocialFeature(featureSnapshot, 'embarrassmentRisk01', engagement.vector.shameSensitivity01 * 0.78) * 0.32 +
        getChannelShare(featureSnapshot, 'channelOutboundShare01', 'GLOBAL', 0) * 0.10 +
        engagement.vector.rescueNeed01 * 0.08 +
        engagement.vector.dropOffRisk01 * 0.08,
    ),
  );
}

function scoreNegotiationNeed(
  featureSnapshot: ChatFeatureSnapshot | null,
  engagement: ChatEngagementScoreResult,
): Score01 {
  return asScore01(
    clamp01(
      engagement.vector.negotiationGuard01 * 0.58 +
        getSocialFeature(featureSnapshot, 'negotiationExposure01', 0) * 0.28 +
        getChannelShare(featureSnapshot, 'channelViewShare01', 'DEAL_ROOM', 0) * 0.14,
    ),
  );
}

function scoreRecoveryNeed(
  snapshot: ChatLearningBridgePublicSnapshot,
  featureSnapshot: ChatFeatureSnapshot | null,
  engagement: ChatEngagementScoreResult,
): Score01 {
  return asScore01(
    clamp01(
      (1 - snapshot.profile.confidence01) * 0.28 +
        engagement.vector.rescueNeed01 * 0.24 +
        engagement.vector.dropOffRisk01 * 0.16 +
        getScalarFeature(featureSnapshot, 'quietness01', 0) * 0.10 +
        getScalarFeature(featureSnapshot, 'recoveryPressure01', 0) * 0.10 +
        getSocialFeature(featureSnapshot, 'socialRecoveryNeed01', 0) * 0.12,
    ),
  );
}

function scoreComebackPotential(
  snapshot: ChatLearningBridgePublicSnapshot,
  featureSnapshot: ChatFeatureSnapshot | null,
  engagement: ChatEngagementScoreResult,
): Score01 {
  return asScore01(
    clamp01(
      snapshot.profile.confidence01 * 0.18 +
        getScalarFeature(featureSnapshot, 'legendMomentum01', 0) * 0.20 +
        getScalarFeature(featureSnapshot, 'engagement01', engagement.vector.engagement01) * 0.16 +
        clamp01(1 - engagement.vector.dropOffRisk01) * 0.18 +
        clamp01(1 - engagement.vector.rescueNeed01) * 0.12 +
        getChannelShare(featureSnapshot, 'channelOutboundShare01', 'GLOBAL', 0) * 0.16,
    ),
  );
}

function createDerivedContext(
  snapshot: ChatLearningBridgePublicSnapshot,
): ChannelDerivedContext {
  const featureSnapshot = getFeatureSnapshot(snapshot);
  const engagement = scoreChatEngagement(snapshot);
  const coldStart = evaluateChatColdStartPolicy(snapshot);
  const hater = resolveChatHaterPersona(snapshot);
  const helper = resolveChatHelperIntervention(snapshot);

  const crowdContainment01 = scoreCrowdContainmentNeed(
    featureSnapshot,
    engagement,
  );

  const publicStageRisk01 = asScore01(
    clamp01(
      getSocialFeature(featureSnapshot, 'publicStagePressure01', engagement.vector.socialPressure01) * 0.56 +
        getSocialFeature(featureSnapshot, 'embarrassmentRisk01', engagement.vector.shameSensitivity01) * 0.44,
    ),
  );

  const negotiationNeed01 = scoreNegotiationNeed(featureSnapshot, engagement);
  const recoveryNeed01 = scoreRecoveryNeed(snapshot, featureSnapshot, engagement);
  const comebackPotential01 = scoreComebackPotential(snapshot, featureSnapshot, engagement);

  return Object.freeze({
    featureSnapshot,
    engagement,
    coldStart,
    hater,
    helper,
    pressureTier: safePressureTier(featureSnapshot),
    tickTier: safeTickTier(featureSnapshot),
    featureSummary: safeSummary(featureSnapshot),
    crowdContainment01,
    publicStageRisk01,
    negotiationNeed01,
    recoveryNeed01,
    comebackPotential01,
    coldWindow: coldWindow(snapshot),
  });
}

/* ========================================================================== */
/* MARK: Route reasoning                                                      */
/* ========================================================================== */

function scoreGlobalRoute(
  snapshot: ChatLearningBridgePublicSnapshot,
  context: ChannelDerivedContext,
  defaults: typeof CHAT_CHANNEL_RECOMMENDATION_POLICY_DEFAULTS,
  options: ChatChannelRecommendationPolicyOptions,
): { score01: Score01; reasons: readonly ChatChannelRouteReason[] } {
  const reasons: ChatChannelRouteReason[] = [];
  const active = getActiveChannel(snapshot);
  const preferred = getPreferredChannel(snapshot);
  const feature = context.featureSnapshot;
  const mount = mountCategory(getMountTarget(snapshot));

  let score =
    snapshot.profile.globalAffinity01 * 0.20 +
    getChannelShare(feature, 'channelViewShare01', 'GLOBAL', 0) * 0.10 +
    getChannelShare(feature, 'channelOutboundShare01', 'GLOBAL', 0) * 0.08 +
    context.engagement.vector.engagement01 * 0.08 +
    getScalarFeature(feature, 'legendMomentum01', 0) * 0.08 +
    context.comebackPotential01 * 0.10;

  if (active === 'GLOBAL') {
    score += defaults.activeChannelBias;
    reasons.push('ACTIVE_MOMENTUM');
  }

  if (preferred === 'GLOBAL') {
    score += defaults.preferredChannelBias;
    reasons.push('PREFERRED_HABIT');
  }

  if (mount === 'BATTLE' || mount === 'BOARD') {
    score += defaults.mountMatchBias * 0.6;
    reasons.push('MOUNT_MATCH');
  }

  if (context.comebackPotential01 >= defaults.comebackThreshold) {
    score += defaults.globalChallengeLift;
    reasons.push('COMEBACK_STAGE');
  }

  if (getScalarFeature(feature, 'legendMomentum01', 0) >= 0.58) {
    score += defaults.globalLegendLift;
    reasons.push('COMEBACK_STAGE');
  }

  if (context.crowdContainment01 >= defaults.crowdDeflectionThreshold) {
    score -= defaults.crowdContainmentPenalty;
    reasons.push('CROWD_DEFLECTION');
  }

  if (context.publicStageRisk01 >= defaults.crowdDeflectionThreshold) {
    score -= defaults.publicShamePenalty;
    reasons.push('HATER_AVOIDANCE');
  }

  if (context.helper?.plan.shouldProtectFromPublicStage) {
    score -= defaults.publicShamePenalty * 0.8;
    reasons.push('HELPER_ALIGNMENT');
  }

  if (context.helper?.plan.shouldUsePrivateAdvice) {
    score -= 0.06;
  }

  if (context.hater && context.hater.score.shouldUsePublicShame) {
    score -= defaults.haterPressurePenalty;
    reasons.push('HATER_AVOIDANCE');
  }

  if (options.allowGlobalTheatrics === false) {
    score -= 0.10;
  }

  return {
    score01: asScore01(clamp01(score)),
    reasons: Object.freeze(reasons),
  };
}

function scoreSyndicateRoute(
  snapshot: ChatLearningBridgePublicSnapshot,
  context: ChannelDerivedContext,
  defaults: typeof CHAT_CHANNEL_RECOMMENDATION_POLICY_DEFAULTS,
): { score01: Score01; reasons: readonly ChatChannelRouteReason[] } {
  const reasons: ChatChannelRouteReason[] = [];
  const active = getActiveChannel(snapshot);
  const preferred = getPreferredChannel(snapshot);
  const feature = context.featureSnapshot;
  const mount = mountCategory(getMountTarget(snapshot));

  let score =
    snapshot.profile.syndicateAffinity01 * 0.24 +
    getChannelShare(feature, 'channelViewShare01', 'SYNDICATE', 0) * 0.12 +
    getChannelShare(feature, 'channelOutboundShare01', 'SYNDICATE', 0) * 0.08 +
    context.recoveryNeed01 * 0.10 +
    context.engagement.vector.helperUrgency01 * 0.10 +
    context.helper?.plan.confidenceRepair01 ?? 0 * 0.00;  // preserve precedence below

  score += (context.helper?.plan.confidenceRepair01 ?? 0) * 0.10;

  if (active === 'SYNDICATE') {
    score += defaults.activeChannelBias;
    reasons.push('ACTIVE_MOMENTUM');
  }

  if (preferred === 'SYNDICATE') {
    score += defaults.preferredChannelBias;
    reasons.push('PREFERRED_HABIT');
  }

  if (mount === 'EMPIRE' || mount === 'BATTLE') {
    score += defaults.mountMatchBias * 0.5;
    reasons.push('MOUNT_MATCH');
  }

  if (context.recoveryNeed01 >= 0.46) {
    score += defaults.syndicateRecoveryLift;
    reasons.push('RECOVERY_ROUTE');
  }

  if (context.helper?.plan.channel === 'SYNDICATE') {
    score += defaults.syndicateTrustLift;
    reasons.push('HELPER_ALIGNMENT');
  }

  if (context.coldStart.plan.openingChannel === 'SYNDICATE') {
    score += 0.05;
    reasons.push('COLD_START_GUARD');
  }

  reasons.push('TACTICAL_INTIMACY');

  return {
    score01: asScore01(clamp01(score)),
    reasons: Object.freeze(reasons),
  };
}

function scoreDealRoomRoute(
  snapshot: ChatLearningBridgePublicSnapshot,
  context: ChannelDerivedContext,
  defaults: typeof CHAT_CHANNEL_RECOMMENDATION_POLICY_DEFAULTS,
  options: ChatChannelRecommendationPolicyOptions,
): { score01: Score01; reasons: readonly ChatChannelRouteReason[] } {
  const reasons: ChatChannelRouteReason[] = [];
  const active = getActiveChannel(snapshot);
  const preferred = getPreferredChannel(snapshot);
  const feature = context.featureSnapshot;

  let score =
    snapshot.profile.dealRoomAffinity01 * 0.22 +
    getChannelShare(feature, 'channelViewShare01', 'DEAL_ROOM', 0) * 0.12 +
    getChannelShare(feature, 'channelOutboundShare01', 'DEAL_ROOM', 0) * 0.10 +
    context.negotiationNeed01 * 0.16 +
    (context.helper?.plan.negotiationSupport01 ?? 0) * 0.10;

  if (active === 'DEAL_ROOM') {
    score += defaults.activeChannelBias;
    reasons.push('ACTIVE_MOMENTUM');
  }

  if (preferred === 'DEAL_ROOM') {
    score += defaults.preferredChannelBias;
    reasons.push('PREFERRED_HABIT');
  }

  if (context.negotiationNeed01 >= defaults.negotiationThreshold) {
    score += defaults.dealRoomNegotiationLift;
    reasons.push('NEGOTIATION_PRIVATE');
  }

  if (context.helper?.plan.shouldUsePrivateAdvice) {
    score += 0.06;
    reasons.push('HELPER_ALIGNMENT');
  }

  if (context.crowdContainment01 >= defaults.crowdDeflectionThreshold) {
    score += 0.04;
    reasons.push('CROWD_DEFLECTION');
  }

  if (
    context.engagement.vector.rescueNeed01 >= defaults.rescueThreshold &&
    options.allowDealRoomGuard !== true
  ) {
    score -= defaults.dealRoomRiskPenalty;
    reasons.push('RESCUE_ROUTE');
  }

  if (context.coldStart.plan.shouldDeflectDealRoom) {
    score -= defaults.dealRoomRiskPenalty;
    reasons.push('COLD_START_GUARD');
  }

  if (options.allowDealRoomGuard === false) {
    score -= 0.08;
  }

  return {
    score01: asScore01(clamp01(score)),
    reasons: Object.freeze(reasons),
  };
}

function scoreLobbyRoute(
  snapshot: ChatLearningBridgePublicSnapshot,
  context: ChannelDerivedContext,
  defaults: typeof CHAT_CHANNEL_RECOMMENDATION_POLICY_DEFAULTS,
  options: ChatChannelRecommendationPolicyOptions,
): { score01: Score01; reasons: readonly ChatChannelRouteReason[] } {
  const reasons: ChatChannelRouteReason[] = [];
  const active = getActiveChannel(snapshot);
  const preferred = getPreferredChannel(snapshot);
  const feature = context.featureSnapshot;
  const mount = mountCategory(getMountTarget(snapshot));

  let score =
    0.12 +
    getChannelShare(feature, 'channelViewShare01', 'LOBBY', 0) * 0.10 +
    getChannelShare(feature, 'channelOutboundShare01', 'LOBBY', 0) * 0.08 +
    context.recoveryNeed01 * 0.16 +
    context.engagement.vector.rescueNeed01 * 0.14 +
    (context.helper?.plan.confidenceRepair01 ?? 0) * 0.10;

  if (active === 'LOBBY') {
    score += defaults.activeChannelBias;
    reasons.push('ACTIVE_MOMENTUM');
  }

  if (preferred === 'LOBBY') {
    score += defaults.preferredChannelBias;
    reasons.push('PREFERRED_HABIT');
  }

  if (mount === 'LOBBY') {
    score += defaults.mountMatchBias;
    reasons.push('MOUNT_MATCH');
  }

  if (context.engagement.vector.rescueNeed01 >= defaults.rescueThreshold) {
    score += defaults.lobbyRescueLift;
    reasons.push('RESCUE_ROUTE');
  }

  if (context.recoveryNeed01 >= 0.46) {
    score += defaults.lobbyRecoveryLift;
    reasons.push('RECOVERY_ROUTE');
  }

  if (snapshot.profile.confidence01 <= defaults.confidenceCollapseThreshold) {
    score += defaults.lobbyRecoveryLift * 0.8;
    reasons.push('RECOVERY_ROUTE');
  }

  if (context.comebackPotential01 >= defaults.comebackThreshold) {
    score -= defaults.lobbyChallengePenalty;
  }

  if (context.helper?.plan.channel === 'LOBBY') {
    score += 0.06;
    reasons.push('HELPER_ALIGNMENT');
  }

  if (options.allowLobbyRecoveryRoutes === false) {
    score -= 0.10;
  }

  return {
    score01: asScore01(clamp01(score)),
    reasons: Object.freeze(reasons),
  };
}

/* ========================================================================== */
/* MARK: Decision helpers                                                     */
/* ========================================================================== */

function createRouteScores(
  snapshot: ChatLearningBridgePublicSnapshot,
  context: ChannelDerivedContext,
  defaults: typeof CHAT_CHANNEL_RECOMMENDATION_POLICY_DEFAULTS,
  options: ChatChannelRecommendationPolicyOptions,
): {
  readonly scores: RouteScores;
  readonly reasons: Readonly<Record<ChatVisibleChannel, readonly ChatChannelRouteReason[]>>;
} {
  const global = scoreGlobalRoute(snapshot, context, defaults, options);
  const syndicate = scoreSyndicateRoute(snapshot, context, defaults);
  const dealRoom = scoreDealRoomRoute(snapshot, context, defaults, options);
  const lobby = scoreLobbyRoute(snapshot, context, defaults, options);

  const scores: RouteScores = {
    GLOBAL: global.score01,
    SYNDICATE: syndicate.score01,
    DEAL_ROOM: dealRoom.score01,
    LOBBY: lobby.score01,
  };

  const reasons = Object.freeze({
    GLOBAL: global.reasons,
    SYNDICATE: syndicate.reasons,
    DEAL_ROOM: dealRoom.reasons,
    LOBBY: lobby.reasons,
  } satisfies Readonly<Record<ChatVisibleChannel, readonly ChatChannelRouteReason[]>>);

  return Object.freeze({ scores, reasons });
}

function pickRecommendedChannel(scores: RouteScores): ChatVisibleChannel {
  let best: ChatVisibleChannel = 'GLOBAL';
  let bestScore = scores.GLOBAL;

  for (const channel of ['SYNDICATE', 'DEAL_ROOM', 'LOBBY'] as const) {
    if (scores[channel] > bestScore) {
      best = channel;
      bestScore = scores[channel];
    }
  }

  return best;
}

function dominantRoute(
  channel: ChatVisibleChannel,
  context: ChannelDerivedContext,
  defaults: typeof CHAT_CHANNEL_RECOMMENDATION_POLICY_DEFAULTS,
): ChatChannelRecommendationBreakdown['dominantRoute'] {
  if (
    context.engagement.vector.rescueNeed01 >= defaults.rescueThreshold ||
    context.recoveryNeed01 >= 0.48
  ) {
    return 'RECOVERY';
  }

  if (context.negotiationNeed01 >= defaults.negotiationThreshold) {
    return 'NEGOTIATION_PRIVACY';
  }

  if (
    channel === 'GLOBAL' &&
    context.comebackPotential01 >= defaults.comebackThreshold &&
    context.engagement.vector.dropOffRisk01 <= defaults.lowRiskChallengeFloor
  ) {
    return 'COMEBACK';
  }

  if (channel === 'SYNDICATE') return 'TACTICAL_SAFETY';
  if (channel === 'GLOBAL') return 'THEATRICAL_PRESSURE';
  return 'DEFAULT';
}

function createBridgeRecommendation(
  channel: ChatVisibleChannel,
  context: ChannelDerivedContext,
): ChatLearningBridgeRecommendation {
  return Object.freeze({
    recommendedChannel: channel,
    helperUrgency01: context.helper?.plan.urgency01 ?? context.engagement.vector.helperUrgency01,
    rescueNeeded:
      context.engagement.vector.rescueNeed01 >= CHAT_CHANNEL_RECOMMENDATION_POLICY_DEFAULTS.rescueThreshold,
    haterAggression01: context.hater?.score.aggression01 ?? context.engagement.vector.haterAggression01,
    dropOffRisk01: context.engagement.vector.dropOffRisk01,
    explanation: [
      `channel:${channel}`,
      `pressure:${context.pressureTier}`,
      `tick:${context.tickTier}`,
      `neg:${context.negotiationNeed01.toFixed(2)}`,
      `recover:${context.recoveryNeed01.toFixed(2)}`,
    ].join(' | '),
  });
}

function createProfilePatch(
  snapshot: ChatLearningBridgePublicSnapshot,
  channel: ChatVisibleChannel,
  context: ChannelDerivedContext,
  defaults: typeof CHAT_CHANNEL_RECOMMENDATION_POLICY_DEFAULTS,
): Partial<ChatLearningBridgeProfileState> {
  return {
    preferredChannel: channel,
    globalAffinity01: asScore01(
      lerp01(
        snapshot.profile.globalAffinity01,
        channel === 'GLOBAL'
          ? clamp01(snapshot.profile.globalAffinity01 + 0.04)
          : snapshot.profile.globalAffinity01,
        defaults.routeSmoothingAlpha,
      ),
    ),
    syndicateAffinity01: asScore01(
      lerp01(
        snapshot.profile.syndicateAffinity01,
        channel === 'SYNDICATE'
          ? clamp01(snapshot.profile.syndicateAffinity01 + 0.04)
          : snapshot.profile.syndicateAffinity01,
        defaults.routeSmoothingAlpha,
      ),
    ),
    dealRoomAffinity01: asScore01(
      lerp01(
        snapshot.profile.dealRoomAffinity01,
        channel === 'DEAL_ROOM'
          ? clamp01(snapshot.profile.dealRoomAffinity01 + 0.04)
          : snapshot.profile.dealRoomAffinity01,
        defaults.routeSmoothingAlpha,
      ),
    ),
    rescueNeed01: asScore01(
      lerp01(
        snapshot.profile.rescueNeed01,
        clamp01(
          context.engagement.vector.rescueNeed01 +
            (channel === 'LOBBY' ? 0.02 : 0) +
            (channel === 'GLOBAL' && context.crowdContainment01 >= defaults.crowdDeflectionThreshold
              ? 0.03
              : 0),
        ),
        defaults.routeSmoothingAlpha,
      ),
    ),
    confidence01: asScore01(
      lerp01(
        snapshot.profile.confidence01,
        clamp01(
          snapshot.profile.confidence01 +
            (channel === 'SYNDICATE' ? 0.03 : 0) +
            (channel === 'LOBBY' ? 0.02 : 0) +
            (channel === 'GLOBAL' && context.comebackPotential01 >= defaults.comebackThreshold
              ? 0.03
              : 0) -
            (channel === 'GLOBAL' && context.publicStageRisk01 >= defaults.crowdDeflectionThreshold
              ? 0.02
              : 0),
        ),
        defaults.routeSmoothingAlpha,
      ),
    ),
    shameSensitivity01: asScore01(
      lerp01(
        snapshot.profile.shameSensitivity01,
        clamp01(
          snapshot.profile.shameSensitivity01 -
            (channel === 'SYNDICATE' ? 0.03 : 0) -
            (channel === 'LOBBY' ? 0.04 : 0) +
            (channel === 'GLOBAL' ? 0.02 : 0),
        ),
        defaults.routeSmoothingAlpha,
      ),
    ),
  };
}

/* ========================================================================== */
/* MARK: Policy class                                                         */
/* ========================================================================== */

export class ChatChannelRecommendationPolicy
  implements ChatLearningBridgeInferencePort
{
  public readonly options: ChatChannelRecommendationPolicyOptions;

  public readonly defaults: typeof CHAT_CHANNEL_RECOMMENDATION_POLICY_DEFAULTS;

  public constructor(options: ChatChannelRecommendationPolicyOptions = {}) {
    this.options = options;
    this.defaults = Object.freeze({
      ...CHAT_CHANNEL_RECOMMENDATION_POLICY_DEFAULTS,
      ...(options.defaults ?? {}),
    });
  }

  public evaluate(
    snapshot: ChatLearningBridgePublicSnapshot,
  ): ChatChannelRecommendationDecision {
    const context = createDerivedContext(snapshot);
    const routeScores = createRouteScores(
      snapshot,
      context,
      this.defaults,
      this.options,
    );

    const recommendedChannel = pickRecommendedChannel(routeScores.scores);
    const ranked = sortChannelScores(routeScores.scores, routeScores.reasons);
    const bridgeRecommendation = createBridgeRecommendation(
      recommendedChannel,
      context,
    );
    const profilePatch = createProfilePatch(
      snapshot,
      recommendedChannel,
      context,
      this.defaults,
    );

    const route = dominantRoute(recommendedChannel, context, this.defaults);

    const explanation = [
      `channel:${recommendedChannel}`,
      `route:${route}`,
      `pressure:${context.pressureTier}`,
      `tick:${context.tickTier}`,
      `recover:${context.recoveryNeed01.toFixed(2)}`,
      `neg:${context.negotiationNeed01.toFixed(2)}`,
      `comeback:${context.comebackPotential01.toFixed(2)}`,
      context.coldWindow ? 'cold:cap' : 'cold:off',
    ].join(' | ');

    const breakdown: ChatChannelRecommendationBreakdown = Object.freeze({
      moduleName: CHAT_CHANNEL_RECOMMENDATION_POLICY_MODULE_NAME,
      moduleVersion: CHAT_CHANNEL_RECOMMENDATION_POLICY_VERSION,
      bridgeModuleName: CHAT_LEARNING_BRIDGE_MODULE_NAME,
      bridgeModuleVersion: CHAT_LEARNING_BRIDGE_VERSION,
      pressureTier: context.pressureTier,
      tickTier: context.tickTier,
      featureSummary: context.featureSummary,
      dominantRoute: route,
      explanation,
    });

    return Object.freeze({
      recommendedChannel,
      channelScores: routeScores.scores,
      ranked,
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

  public getChannelScores(
    snapshot: ChatLearningBridgePublicSnapshot,
  ): ChatChannelRecommendationScores {
    return this.evaluate(snapshot).channelScores;
  }
}

/* ========================================================================== */
/* MARK: Public helpers                                                       */
/* ========================================================================== */

export function createChatChannelRecommendationPolicy(
  options: ChatChannelRecommendationPolicyOptions = {},
): ChatChannelRecommendationPolicy {
  return new ChatChannelRecommendationPolicy(options);
}

export function evaluateChatChannelRecommendationPolicy(
  snapshot: ChatLearningBridgePublicSnapshot,
  options: ChatChannelRecommendationPolicyOptions = {},
): ChatChannelRecommendationDecision {
  return createChatChannelRecommendationPolicy(options).evaluate(snapshot);
}

export function recommendChatChannelRecommendation(
  snapshot: ChatLearningBridgePublicSnapshot,
  options: ChatChannelRecommendationPolicyOptions = {},
): ChatLearningBridgeRecommendation {
  return createChatChannelRecommendationPolicy(options).recommend(snapshot);
}

export function refineChannelRecommendationProfileState(
  snapshot: ChatLearningBridgePublicSnapshot,
  options: ChatChannelRecommendationPolicyOptions = {},
): Partial<ChatLearningBridgeProfileState> {
  return createChatChannelRecommendationPolicy(options).refineProfile(snapshot);
}

export function getChatChannelRecommendationScores(
  snapshot: ChatLearningBridgePublicSnapshot,
  options: ChatChannelRecommendationPolicyOptions = {},
): ChatChannelRecommendationScores {
  return createChatChannelRecommendationPolicy(options).getChannelScores(snapshot);
}

export function buildChannelRecommendationBundle(
  snapshot: ChatLearningBridgePublicSnapshot,
  options: ChatChannelRecommendationPolicyOptions = {},
): {
  readonly bridgeModule: typeof CHAT_LEARNING_BRIDGE_MODULE_NAME;
  readonly bridgeVersion: typeof CHAT_LEARNING_BRIDGE_VERSION;
  readonly routePolicyModule: typeof CHAT_CHANNEL_RECOMMENDATION_POLICY_MODULE_NAME;
  readonly routePolicyVersion: typeof CHAT_CHANNEL_RECOMMENDATION_POLICY_VERSION;
  readonly decision: ChatChannelRecommendationDecision;
} {
  return Object.freeze({
    bridgeModule: CHAT_LEARNING_BRIDGE_MODULE_NAME,
    bridgeVersion: CHAT_LEARNING_BRIDGE_VERSION,
    routePolicyModule: CHAT_CHANNEL_RECOMMENDATION_POLICY_MODULE_NAME,
    routePolicyVersion: CHAT_CHANNEL_RECOMMENDATION_POLICY_VERSION,
    decision: evaluateChatChannelRecommendationPolicy(snapshot, options),
  });
}

export const CHAT_CHANNEL_RECOMMENDATION_POLICY_NAMESPACE = Object.freeze({
  moduleName: CHAT_CHANNEL_RECOMMENDATION_POLICY_MODULE_NAME,
  version: CHAT_CHANNEL_RECOMMENDATION_POLICY_VERSION,
  runtimeLaws: CHAT_CHANNEL_RECOMMENDATION_POLICY_RUNTIME_LAWS,
  defaults: CHAT_CHANNEL_RECOMMENDATION_POLICY_DEFAULTS,
  create: createChatChannelRecommendationPolicy,
  evaluate: evaluateChatChannelRecommendationPolicy,
  recommend: recommendChatChannelRecommendation,
  refineProfile: refineChannelRecommendationProfileState,
  getScores: getChatChannelRecommendationScores,
  buildBundle: buildChannelRecommendationBundle,
} as const);

export default ChatChannelRecommendationPolicy;


/* ========================================================================== */
/* MARK: Compatibility helpers                                                */
/* ========================================================================== */

export interface ChatChannelRecommendationSnapshotCompat {
  readonly recommendedChannel: ChatVisibleChannel;
  readonly global01: Score01;
  readonly syndicate01: Score01;
  readonly dealRoom01: Score01;
  readonly lobby01: Score01;
  readonly helperUrgency01: Score01;
  readonly rescueNeeded: boolean;
  readonly dropOffRisk01: Score01;
}

export function createChatChannelRecommendationSnapshotCompat(
  decision: ChatChannelRecommendationDecision,
): ChatChannelRecommendationSnapshotCompat {
  return Object.freeze({
    recommendedChannel: decision.recommendedChannel,
    global01: decision.channelScores.GLOBAL,
    syndicate01: decision.channelScores.SYNDICATE,
    dealRoom01: decision.channelScores.DEAL_ROOM,
    lobby01: decision.channelScores.LOBBY,
    helperUrgency01: decision.bridgeRecommendation.helperUrgency01 as Score01,
    rescueNeeded: decision.bridgeRecommendation.rescueNeeded,
    dropOffRisk01: decision.bridgeRecommendation.dropOffRisk01 as Score01,
  });
}

export function explainChatChannelRoute(
  decision: ChatChannelRecommendationDecision,
): string {
  return decision.breakdown.explanation;
}

export function listRankedChannelOrder(
  decision: ChatChannelRecommendationDecision,
): readonly ChatVisibleChannel[] {
  return Object.freeze(decision.ranked.map((item) => item.channel));
}

export const CHAT_CHANNEL_RECOMMENDATION_POLICY_README = Object.freeze({
  importPaths: Object.freeze({
    intelligenceBarrel: '/pzo-web/src/engines/chat/intelligence/ml',
    file: '/pzo-web/src/engines/chat/intelligence/ml/ChannelRecommendationPolicy.ts',
  }),
  recommendedConsumers: Object.freeze([
    'pzo-web/src/engines/chat/ChatEngine.ts',
    'pzo-web/src/engines/chat/ChatEventBridge.ts',
    'pzo-web/src/components/chat/useUnifiedChat.ts',
    'future channel policy adapters',
  ] as const),
  immediateOutputs: Object.freeze([
    'visible-channel recommendation',
    'ranked route reasons',
    'bridge-safe channel patch',
    'pressure-aware explanation',
  ] as const),
  integrationRule: Object.freeze([
    'Use evaluate() when UI or engine needs full ranking and reasons.',
    'Use recommend() when only the bridge recommendation is needed.',
    'Use refineProfile() to update local route affinity safely.',
  ] as const),
} as const);

export type ChatChannelRecommendationPolicyNamespace =
  typeof CHAT_CHANNEL_RECOMMENDATION_POLICY_NAMESPACE;
