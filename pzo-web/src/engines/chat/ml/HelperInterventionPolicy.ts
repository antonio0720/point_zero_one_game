
// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/chat/intelligence/ml/HelperInterventionPolicy.ts

/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT ML HELPER INTERVENTION POLICY
 * FILE: pzo-web/src/engines/chat/intelligence/ml/HelperInterventionPolicy.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical frontend helper-intervention policy for the unified chat
 * intelligence lane.
 *
 * This file converts live bridge state, extracted feature state, cold-start
 * posture, and hater-persona pressure into a concrete helper decision surface.
 *
 * It owns:
 * - helper persona registry and aliases,
 * - intervention urgency scoring,
 * - silence-vs-interruption discipline,
 * - rescue / stabilization / challenge posture,
 * - per-channel helper fit,
 * - cadence and delay planning,
 * - crowd-containment / deal-room advisory modes,
 * - bridge-safe recommendation and profile refinement,
 * - compile-safe helper bundles that ChatNpcDirector / ChatEngine can consume.
 *
 * It does NOT own:
 * - transcript truth,
 * - durable backend helper-memory authority,
 * - final moderation decisions,
 * - liveops scheduling,
 * - replay persistence,
 * - permanent relationship graphs.
 *
 * Permanent doctrine
 * ------------------
 * - A helper should feel timely, not spammy.
 * - Silence is sometimes the best intervention.
 * - Rescue is different from confidence-building.
 * - Challenge from a trusted helper is not the same as pressure from a hater.
 * - Public-stage containment is a valid helper task.
 * - Deal-room advisory logic is private and surgical.
 * - The client can stage a rescue plan immediately, but backend truth still
 *   wins when it arrives.
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

import {
  CHAT_LEARNING_PROFILE_HELPER_SEED_IDS,
} from '../ChatLearningProfile';

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

/* ========================================================================== */
/* MARK: Public module constants                                              */
/* ========================================================================== */

export const CHAT_HELPER_INTERVENTION_POLICY_MODULE_NAME =
  'PZO_CHAT_HELPER_INTERVENTION_POLICY' as const;

export const CHAT_HELPER_INTERVENTION_POLICY_VERSION =
  '2026.03.13-helper-intervention-policy.v1' as const;

export const CHAT_HELPER_INTERVENTION_POLICY_RUNTIME_LAWS = Object.freeze([
  'Helpers arrive with purpose, not chatter.',
  'Silence is a first-class helper tactic.',
  'Rescue and coaching are distinct intervention families.',
  'Crowd containment may override performance-maximizing channel choices.',
  'Deal-room help should be private whenever possible.',
  'A trusted helper may challenge; an untrusted helper should stabilize first.',
  'Cold-start respect remains active until player behavior earns bolder cadence.',
  'Frontend helper policy remains advisory until backend truth responds.',
  'Helper selection should feel authored before it feels algorithmic.',
  'Every intervention should be explainable from live state and helper registry.',
] as const);

export const CHAT_HELPER_INTERVENTION_POLICY_DEFAULTS = Object.freeze({
  interventionSmoothingAlpha: 0.16,
  helperUrgencyFloor: 0.10,
  helperUrgencyCeiling: 0.96,
  rescueThreshold: 0.66,
  softInterventionThreshold: 0.42,
  silenceHoldThreshold: 0.58,
  challengeThreshold: 0.62,
  crowdContainmentThreshold: 0.60,
  publicShameProtectionThreshold: 0.56,
  confidenceCollapseThreshold: 0.36,
  frustrationSpikeThreshold: 0.62,
  negotiationGuardThreshold: 0.58,
  haterSuppressionThreshold: 0.61,
  mentorBias: 0.08,
  insiderBias: 0.06,
  survivorBias: 0.06,
  rivalBias: 0.03,
  archivistBias: 0.04,
  lobbySafetyBias: 0.08,
  syndicateTrustBias: 0.08,
  dealRoomPrivacyBias: 0.10,
  globalContainmentPenalty: 0.10,
  preferredChannelBias: 0.06,
  activeChannelBias: 0.04,
  lowConfidenceLobbyLift: 0.08,
  rescueLobbyLift: 0.10,
  rescueSyndicateLift: 0.06,
  privateAdviceDealRoomLift: 0.06,
  maxTypingHoldMs: 7_500,
  minTypingHoldMs: 650,
  maxRevealDelayMs: 12_000,
  minRevealDelayMs: 0,
  maxInterventionBurst: 3,
  minInterventionBurst: 0,
} as const);

/* ========================================================================== */
/* MARK: Public contracts                                                     */
/* ========================================================================== */

export type ChatHelperPersonaId =
  | 'MENTOR'
  | 'INSIDER'
  | 'SURVIVOR'
  | 'RIVAL'
  | 'ARCHIVIST';

export type ChatHelperInterventionFamily =
  | 'NONE'
  | 'STABILIZE'
  | 'REASSURE'
  | 'COACH'
  | 'CHALLENGE'
  | 'CONTAIN'
  | 'NEGOTIATE'
  | 'POST_COLLAPSE_RESCUE'
  | 'COMEBACK_PRIMER'
  | 'SILENCE_HOLD';

export type ChatHelperToneStyle =
  | 'WARM'
  | 'STEADY'
  | 'CUTTING'
  | 'TACTICAL'
  | 'ARCHIVAL'
  | 'QUIET';

export type ChatHelperPresenceStyle =
  | 'INSTANT'
  | 'SOFT_DELAY'
  | 'WATCHFUL_DELAY'
  | 'AFTER_HATER'
  | 'AFTER_SILENCE'
  | 'HOLD';

export type ChatHelperInterventionPosture =
  | 'NONE'
  | 'SHIELDING'
  | 'COACHING'
  | 'RECALIBRATING'
  | 'CHALLENGING'
  | 'NEGOTIATING'
  | 'CONTAINING'
  | 'WITNESSING';

export interface ChatHelperInterventionPolicyOptions {
  readonly defaults?: Partial<typeof CHAT_HELPER_INTERVENTION_POLICY_DEFAULTS>;
  readonly helperRegistry?: readonly ChatHelperPersonaSpec[];
  readonly allowChallengeFromLowTrustHelpers?: boolean;
  readonly allowPublicContainment?: boolean;
  readonly allowDealRoomIntervention?: boolean;
  readonly allowSilenceHold?: boolean;
  readonly includeExplanationBreakdown?: boolean;
}

export interface ChatHelperPersonaSpec {
  readonly id: ChatHelperPersonaId;
  readonly displayName: string;
  readonly archetype: string;
  readonly tone: ChatHelperToneStyle;
  readonly specialties: readonly string[];
  readonly preferredChannels: readonly ChatVisibleChannel[];
  readonly fallbackChannels: readonly ChatVisibleChannel[];
  readonly confidenceRepairBias01: Score01;
  readonly rescueBias01: Score01;
  readonly challengeBias01: Score01;
  readonly containmentBias01: Score01;
  readonly negotiationBias01: Score01;
  readonly publicStageTolerance01: Score01;
  readonly dealRoomTolerance01: Score01;
  readonly haterSuppressionBias01: Score01;
  readonly signature: readonly string[];
}

export interface ChatHelperInterventionWindow {
  readonly presenceStyle: ChatHelperPresenceStyle;
  readonly initialDelayMs: number;
  readonly typingHoldMs: number;
  readonly revealDelayMs: number;
  readonly burstCount: number;
}

export interface ChatHelperInterventionPlan {
  readonly personaId: ChatHelperPersonaId;
  readonly family: ChatHelperInterventionFamily;
  readonly posture: ChatHelperInterventionPosture;
  readonly channel: ChatVisibleChannel;
  readonly shouldIntervene: boolean;
  readonly shouldRespectSilence: boolean;
  readonly shouldSuppressHater: boolean;
  readonly shouldProtectFromPublicStage: boolean;
  readonly shouldUsePrivateAdvice: boolean;
  readonly shouldPromoteRecovery: boolean;
  readonly shouldPrimeComeback: boolean;
  readonly urgency01: Score01;
  readonly confidenceRepair01: Score01;
  readonly crowdContainment01: Score01;
  readonly challengePressure01: Score01;
  readonly negotiationSupport01: Score01;
  readonly haterSuppression01: Score01;
  readonly window: ChatHelperInterventionWindow;
  readonly explanation: string;
}

export interface ChatHelperPersonaScore {
  readonly personaId: ChatHelperPersonaId;
  readonly fit01: Score01;
  readonly urgency01: Score01;
  readonly trustProxy01: Score01;
  readonly family: ChatHelperInterventionFamily;
  readonly posture: ChatHelperInterventionPosture;
  readonly channel: ChatVisibleChannel;
  readonly shouldIntervene: boolean;
  readonly shouldRespectSilence: boolean;
  readonly shouldSuppressHater: boolean;
  readonly shouldProtectFromPublicStage: boolean;
  readonly shouldUsePrivateAdvice: boolean;
  readonly shouldPromoteRecovery: boolean;
  readonly shouldPrimeComeback: boolean;
  readonly confidenceRepair01: Score01;
  readonly crowdContainment01: Score01;
  readonly challengePressure01: Score01;
  readonly negotiationSupport01: Score01;
  readonly haterSuppression01: Score01;
  readonly presenceStyle: ChatHelperPresenceStyle;
}

export interface ChatHelperInterventionPolicyBreakdown {
  readonly moduleName: typeof CHAT_HELPER_INTERVENTION_POLICY_MODULE_NAME;
  readonly moduleVersion: typeof CHAT_HELPER_INTERVENTION_POLICY_VERSION;
  readonly bridgeModuleName: typeof CHAT_LEARNING_BRIDGE_MODULE_NAME;
  readonly bridgeModuleVersion: typeof CHAT_LEARNING_BRIDGE_VERSION;
  readonly pressureTier: ChatPressureTier;
  readonly tickTier: ChatTickTier;
  readonly featureSummary: string;
  readonly coldWindow: boolean;
  readonly chosenPersonaId: ChatHelperPersonaId;
  readonly dominantNeed:
    | 'NONE'
    | 'RESCUE'
    | 'CONFIDENCE_REPAIR'
    | 'CROWD_CONTAINMENT'
    | 'NEGOTIATION_SUPPORT'
    | 'CHALLENGE'
    | 'SILENCE_HOLD';
  readonly explanation: string;
}

export interface ChatHelperInterventionDecision {
  readonly persona: ChatHelperPersonaSpec;
  readonly plan: ChatHelperInterventionPlan;
  readonly ranked: readonly ChatHelperPersonaScore[];
  readonly bridgeRecommendation: ChatLearningBridgeRecommendation;
  readonly profilePatch: Partial<ChatLearningBridgeProfileState>;
  readonly breakdown: ChatHelperInterventionPolicyBreakdown;
}

export interface ChatHelperInterventionInferencePort
  extends ChatLearningBridgeInferencePort {
  resolve(
    snapshot: ChatLearningBridgePublicSnapshot,
  ): ChatHelperInterventionDecision;
}

/* ========================================================================== */
/* MARK: Registry                                                             */
/* ========================================================================== */

export const CHAT_HELPER_PERSONA_REGISTRY = Object.freeze([
  Object.freeze({
    id: 'MENTOR',
    displayName: 'Mentor',
    archetype: 'Guiding strategist',
    tone: 'STEADY',
    specialties: Object.freeze([
      'confidence repair',
      'pressure framing',
      'run stabilization',
      'structured recovery',
    ] as const),
    preferredChannels: Object.freeze(['SYNDICATE', 'LOBBY'] as const),
    fallbackChannels: Object.freeze(['GLOBAL', 'DEAL_ROOM'] as const),
    confidenceRepairBias01: 0.92 as Score01,
    rescueBias01: 0.82 as Score01,
    challengeBias01: 0.54 as Score01,
    containmentBias01: 0.72 as Score01,
    negotiationBias01: 0.42 as Score01,
    publicStageTolerance01: 0.42 as Score01,
    dealRoomTolerance01: 0.36 as Score01,
    haterSuppressionBias01: 0.84 as Score01,
    signature: Object.freeze([
      'names the actual pivot',
      'cuts panic into steps',
      'keeps dignity intact',
    ] as const),
  }),
  Object.freeze({
    id: 'INSIDER',
    displayName: 'Insider',
    archetype: 'Back-channel operator',
    tone: 'TACTICAL',
    specialties: Object.freeze([
      'private information',
      'channel routing',
      'quiet corrections',
      'deal-room warning',
    ] as const),
    preferredChannels: Object.freeze(['SYNDICATE', 'DEAL_ROOM'] as const),
    fallbackChannels: Object.freeze(['LOBBY', 'GLOBAL'] as const),
    confidenceRepairBias01: 0.62 as Score01,
    rescueBias01: 0.58 as Score01,
    challengeBias01: 0.46 as Score01,
    containmentBias01: 0.66 as Score01,
    negotiationBias01: 0.90 as Score01,
    publicStageTolerance01: 0.26 as Score01,
    dealRoomTolerance01: 0.88 as Score01,
    haterSuppressionBias01: 0.70 as Score01,
    signature: Object.freeze([
      'moves the player off the stage',
      'treats information like leverage',
      'shifts danger into positioning',
    ] as const),
  }),
  Object.freeze({
    id: 'SURVIVOR',
    displayName: 'Survivor',
    archetype: 'Resilience witness',
    tone: 'WARM',
    specialties: Object.freeze([
      'post-collapse rescue',
      'shame recovery',
      'momentum rebuild',
      'emotional grounding',
    ] as const),
    preferredChannels: Object.freeze(['LOBBY', 'SYNDICATE'] as const),
    fallbackChannels: Object.freeze(['GLOBAL', 'DEAL_ROOM'] as const),
    confidenceRepairBias01: 0.80 as Score01,
    rescueBias01: 0.94 as Score01,
    challengeBias01: 0.34 as Score01,
    containmentBias01: 0.60 as Score01,
    negotiationBias01: 0.32 as Score01,
    publicStageTolerance01: 0.22 as Score01,
    dealRoomTolerance01: 0.28 as Score01,
    haterSuppressionBias01: 0.66 as Score01,
    signature: Object.freeze([
      'tells the player they are not done',
      'protects without patronizing',
      'makes survival feel active',
    ] as const),
  }),
  Object.freeze({
    id: 'RIVAL',
    displayName: 'Rival',
    archetype: 'Sharp-edged ally',
    tone: 'CUTTING',
    specialties: Object.freeze([
      'challenge under pressure',
      'ego reset',
      'anti-spiral disruption',
      'comeback ignition',
    ] as const),
    preferredChannels: Object.freeze(['GLOBAL', 'SYNDICATE'] as const),
    fallbackChannels: Object.freeze(['LOBBY', 'DEAL_ROOM'] as const),
    confidenceRepairBias01: 0.48 as Score01,
    rescueBias01: 0.44 as Score01,
    challengeBias01: 0.94 as Score01,
    containmentBias01: 0.34 as Score01,
    negotiationBias01: 0.36 as Score01,
    publicStageTolerance01: 0.74 as Score01,
    dealRoomTolerance01: 0.32 as Score01,
    haterSuppressionBias01: 0.48 as Score01,
    signature: Object.freeze([
      'provokes a sharper answer',
      'uses friction as medicine',
      'rejects self-pity fast',
    ] as const),
  }),
  Object.freeze({
    id: 'ARCHIVIST',
    displayName: 'Archivist',
    archetype: 'Memory and pattern keeper',
    tone: 'ARCHIVAL',
    specialties: Object.freeze([
      'receipts',
      'pattern recall',
      'turning-point naming',
      'comeback foreshadowing',
    ] as const),
    preferredChannels: Object.freeze(['SYNDICATE', 'GLOBAL'] as const),
    fallbackChannels: Object.freeze(['LOBBY', 'DEAL_ROOM'] as const),
    confidenceRepairBias01: 0.60 as Score01,
    rescueBias01: 0.56 as Score01,
    challengeBias01: 0.58 as Score01,
    containmentBias01: 0.46 as Score01,
    negotiationBias01: 0.38 as Score01,
    publicStageTolerance01: 0.52 as Score01,
    dealRoomTolerance01: 0.34 as Score01,
    haterSuppressionBias01: 0.52 as Score01,
    signature: Object.freeze([
      'quotes the right moment back to the player',
      'makes memory feel alive',
      'names the shape of the run',
    ] as const),
  }),
] as const satisfies readonly ChatHelperPersonaSpec[]);

export const CHAT_HELPER_PERSONA_ALIASES = Object.freeze({
  MENTOR: 'MENTOR',
  GUIDE: 'MENTOR',
  COACH: 'MENTOR',
  INSIDER: 'INSIDER',
  FIXER: 'INSIDER',
  OPERATOR: 'INSIDER',
  SURVIVOR: 'SURVIVOR',
  RESCUER: 'SURVIVOR',
  RIVAL: 'RIVAL',
  SPAR: 'RIVAL',
  ARCHIVIST: 'ARCHIVIST',
  SCRIBE: 'ARCHIVIST',
} as const satisfies Readonly<Record<string, ChatHelperPersonaId>>);

/* ========================================================================== */
/* MARK: Utility types                                                        */
/* ========================================================================== */

type ChannelScoreMap = ChatChannelRecommendationScores;

type DominantNeed =
  | 'NONE'
  | 'RESCUE'
  | 'CONFIDENCE_REPAIR'
  | 'CROWD_CONTAINMENT'
  | 'NEGOTIATION_SUPPORT'
  | 'CHALLENGE'
  | 'SILENCE_HOLD';

interface HelperDerivedContext {
  readonly featureSnapshot: ChatFeatureSnapshot | null;
  readonly engagement: ChatEngagementScoreResult;
  readonly coldStart: ChatColdStartPolicyDecision;
  readonly hater: ChatHaterPersonaDecision | null;
  readonly pressureTier: ChatPressureTier;
  readonly tickTier: ChatTickTier;
  readonly featureSummary: string;
  readonly crowdContainment01: Score01;
  readonly negotiationSupport01: Score01;
  readonly confidenceRepair01: Score01;
  readonly challengePressure01: Score01;
  readonly urgency01: Score01;
  readonly trustProxy01: Score01;
  readonly dominantNeed: DominantNeed;
  readonly recommendedChannelScores: ChannelScoreMap;
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

function average(values: readonly number[]): number {
  if (!values.length) return 0;
  const total = values.reduce((sum, value) => sum + asFiniteNumber(value, 0), 0);
  return total / values.length;
}

function pickMax<T extends string>(scores: Readonly<Record<T, number>>, fallback: T): T {
  let bestKey = fallback;
  let bestValue = asFiniteNumber(scores[fallback], 0);

  for (const [key, value] of Object.entries(scores) as [T, number][]) {
    if (value > bestValue) {
      bestKey = key;
      bestValue = value;
    }
  }

  return bestKey;
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

function createChannelScoreMap(seed = 0): ChannelScoreMap {
  return {
    GLOBAL: asScore01(seed),
    SYNDICATE: asScore01(seed),
    DEAL_ROOM: asScore01(seed),
    LOBBY: asScore01(seed),
  };
}

function getActiveChannel(snapshot: ChatLearningBridgePublicSnapshot): ChatVisibleChannel {
  return normalizeVisibleChannel(snapshot.activeChannel, 'GLOBAL');
}

function getPreferredChannel(snapshot: ChatLearningBridgePublicSnapshot): ChatVisibleChannel {
  return normalizeVisibleChannel(snapshot.profile.preferredChannel, getActiveChannel(snapshot));
}

function getFeatureSnapshot(
  snapshot: ChatLearningBridgePublicSnapshot,
): ChatFeatureSnapshot | null {
  const candidate = snapshot.latestFeatureSnapshot;
  return candidate && isRecord(candidate) ? (candidate as ChatFeatureSnapshot) : null;
}

function safeSummarizeFeatureSnapshot(featureSnapshot: ChatFeatureSnapshot | null): string {
  if (!featureSnapshot) return 'feature:none';
  try {
    return summarizeChatFeatureSnapshot(featureSnapshot);
  } catch {
    return 'feature:unavailable';
  }
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

function getMountTarget(snapshot: ChatLearningBridgePublicSnapshot): string {
  const candidate = (snapshot.latestFeatureSnapshot as Record<string, unknown> | null)?.[
    'mountTarget'
  ];
  return typeof candidate === 'string' && candidate.trim().length
    ? candidate.trim()
    : 'UNKNOWN';
}

function mountCategory(mountTarget: string): 'LOBBY' | 'BATTLE' | 'EMPIRE' | 'BOARD' | 'OTHER' {
  const upper = mountTarget.toUpperCase();

  if (upper.includes('LOBBY')) return 'LOBBY';
  if (upper.includes('BATTLE') || upper.includes('HUD')) return 'BATTLE';
  if (upper.includes('EMPIRE') || upper.includes('SYNDICATE')) return 'EMPIRE';
  if (upper.includes('BOARD') || upper.includes('GAME')) return 'BOARD';
  return 'OTHER';
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

  const scalarLikeKeys = ['scalar', 'scalars', 'scalarFeatures', 'core', 'scores'];

  for (const bucketKey of scalarLikeKeys) {
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

  const socialLikeKeys = ['social', 'socialFeatures', 'audience', 'crowd', 'stage'];
  for (const bucketKey of socialLikeKeys) {
    const bucket = featureSnapshot[bucketKey];
    if (!isRecord(bucket)) continue;
    const value = bucket[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }

  const direct = featureSnapshot[key];
  return typeof direct === 'number' && Number.isFinite(direct) ? direct : fallback;
}

function getMessageFeature(
  featureSnapshot: ChatFeatureSnapshot | null,
  key: string,
  fallback = 0,
): number {
  if (!featureSnapshot || !isRecord(featureSnapshot)) return fallback;

  const buckets = ['message', 'messages', 'messageFeatures', 'composer', 'input'];
  for (const bucketKey of buckets) {
    const bucket = featureSnapshot[bucketKey];
    if (!isRecord(bucket)) continue;
    const value = bucket[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }

  const direct = featureSnapshot[key];
  return typeof direct === 'number' && Number.isFinite(direct) ? direct : fallback;
}

function getDropOffFeature(
  featureSnapshot: ChatFeatureSnapshot | null,
  key: string,
  fallback = 0,
): number {
  if (!featureSnapshot || !isRecord(featureSnapshot)) return fallback;

  const buckets = ['dropOffSignals', 'dropOff', 'churn', 'churnRisk'];
  for (const bucketKey of buckets) {
    const bucket = featureSnapshot[bucketKey];
    if (!isRecord(bucket)) continue;
    const value = bucket[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }

  const direct = featureSnapshot[key];
  return typeof direct === 'number' && Number.isFinite(direct) ? direct : fallback;
}

function coldWindow(snapshot: ChatLearningBridgePublicSnapshot): boolean {
  return (
    snapshot.profile.totalChatOpens <= 2 ||
    snapshot.profile.totalMessagesOutbound <= 3 ||
    snapshot.profile.totalSessionsSeen <= 2
  );
}

function sortScores(
  scores: readonly ChatHelperPersonaScore[],
): readonly ChatHelperPersonaScore[] {
  return [...scores].sort((a, b) => {
    if (b.fit01 !== a.fit01) return b.fit01 - a.fit01;
    if (b.urgency01 !== a.urgency01) return b.urgency01 - a.urgency01;
    if (a.personaId < b.personaId) return -1;
    if (a.personaId > b.personaId) return 1;
    return 0;
  });
}

function resolveAlias(value: string): ChatHelperPersonaId | null {
  const normalized = value.trim().toUpperCase();
  return (CHAT_HELPER_PERSONA_ALIASES as Record<string, ChatHelperPersonaId>)[normalized] ?? null;
}

function getHelperPersonaById(
  id: ChatHelperPersonaId,
  registry: readonly ChatHelperPersonaSpec[] = CHAT_HELPER_PERSONA_REGISTRY,
): ChatHelperPersonaSpec {
  const found = registry.find((persona) => persona.id === id);
  return found ?? registry[0];
}

/* ========================================================================== */
/* MARK: Derived needs                                                        */
/* ========================================================================== */

function scoreCrowdContainmentNeed(
  snapshot: ChatLearningBridgePublicSnapshot,
  featureSnapshot: ChatFeatureSnapshot | null,
  engagement: ChatEngagementScoreResult,
  defaults: typeof CHAT_HELPER_INTERVENTION_POLICY_DEFAULTS,
): Score01 {
  const publicStagePressure01 = getSocialFeature(
    featureSnapshot,
    'publicStagePressure01',
    engagement.vector.socialPressure01 * 0.82,
  );

  const embarrassmentRisk01 = getSocialFeature(
    featureSnapshot,
    'embarrassmentRisk01',
    engagement.vector.shameSensitivity01 * 0.78,
  );

  const globalOutboundShare01 = getChannelShare(
    featureSnapshot,
    'channelOutboundShare01',
    'GLOBAL',
    0,
  );

  return asScore01(
    clamp01(
      publicStagePressure01 * 0.34 +
        embarrassmentRisk01 * 0.30 +
        globalOutboundShare01 * 0.12 +
        engagement.vector.dropOffRisk01 * 0.10 +
        engagement.vector.rescueNeed01 * 0.08 +
        (snapshot.profile.confidence01 < defaults.confidenceCollapseThreshold ? 0.06 : 0),
    ),
  );
}

function scoreNegotiationSupportNeed(
  featureSnapshot: ChatFeatureSnapshot | null,
  engagement: ChatEngagementScoreResult,
): Score01 {
  return asScore01(
    clamp01(
      engagement.vector.negotiationGuard01 * 0.52 +
        getSocialFeature(featureSnapshot, 'negotiationExposure01', 0) * 0.26 +
        getScalarFeature(featureSnapshot, 'recoveryPressure01', 0) * 0.08 +
        getChannelShare(featureSnapshot, 'channelViewShare01', 'DEAL_ROOM', 0) * 0.14,
    ),
  );
}

function scoreConfidenceRepairNeed(
  snapshot: ChatLearningBridgePublicSnapshot,
  featureSnapshot: ChatFeatureSnapshot | null,
  engagement: ChatEngagementScoreResult,
): Score01 {
  const negativeAffect01 = getDropOffFeature(
    featureSnapshot,
    'negativeEmotionScore',
    engagement.vector.dropOffRisk01 * 0.74,
  );

  const quietness01 = getScalarFeature(
    featureSnapshot,
    'quietness01',
    getDropOffFeature(featureSnapshot, 'quietness01', 0),
  );

  return asScore01(
    clamp01(
      (1 - snapshot.profile.confidence01) * 0.34 +
        engagement.vector.rescueNeed01 * 0.20 +
        negativeAffect01 * 0.16 +
        quietness01 * 0.10 +
        engagement.vector.helperUrgency01 * 0.20,
    ),
  );
}

function scoreChallengeNeed(
  snapshot: ChatLearningBridgePublicSnapshot,
  featureSnapshot: ChatFeatureSnapshot | null,
  engagement: ChatEngagementScoreResult,
): Score01 {
  const momentum01 = getScalarFeature(featureSnapshot, 'legendMomentum01', 0);
  const pace01 = getMessageFeature(featureSnapshot, 'estimatedResponsePace01', 0);

  return asScore01(
    clamp01(
      snapshot.profile.confidence01 * 0.24 +
        engagement.vector.haterAggression01 * 0.18 +
        momentum01 * 0.12 +
        pace01 * 0.08 +
        clamp01(1 - engagement.vector.rescueNeed01) * 0.20 +
        clamp01(1 - engagement.vector.dropOffRisk01) * 0.18,
    ),
  );
}

function scoreUrgency(
  snapshot: ChatLearningBridgePublicSnapshot,
  featureSnapshot: ChatFeatureSnapshot | null,
  engagement: ChatEngagementScoreResult,
  crowdContainment01: number,
  confidenceRepair01: number,
  negotiationSupport01: number,
): Score01 {
  const silenceAfterCollapse01 = clamp01(
    getDropOffFeature(featureSnapshot, 'silenceAfterCollapseMs', 0) / 30_000,
  );

  return asScore01(
    clamp01(
      engagement.vector.helperUrgency01 * 0.24 +
        engagement.vector.rescueNeed01 * 0.20 +
        confidenceRepair01 * 0.18 +
        crowdContainment01 * 0.12 +
        negotiationSupport01 * 0.08 +
        silenceAfterCollapse01 * 0.08 +
        clamp01(1 - snapshot.profile.confidence01) * 0.10,
    ),
  );
}

function scoreTrustProxy(
  snapshot: ChatLearningBridgePublicSnapshot,
  persona: ChatHelperPersonaSpec,
  featureSnapshot: ChatFeatureSnapshot | null,
): Score01 {
  const syndicateShare01 = getChannelShare(featureSnapshot, 'channelViewShare01', 'SYNDICATE', 0);
  const lobbyShare01 = getChannelShare(featureSnapshot, 'channelViewShare01', 'LOBBY', 0);

  const channelTrustLift =
    (persona.id === 'MENTOR' ? syndicateShare01 * 0.10 + lobbyShare01 * 0.08 : 0) +
    (persona.id === 'SURVIVOR' ? lobbyShare01 * 0.12 : 0) +
    (persona.id === 'INSIDER' ? syndicateShare01 * 0.06 : 0);

  return asScore01(
    clamp01(
      snapshot.profile.helperNeed01 * 0.16 +
        snapshot.profile.confidence01 * 0.08 +
        snapshot.profile.syndicateAffinity01 * 0.08 +
        clamp01(1 - snapshot.profile.dropOffRisk01) * 0.12 +
        channelTrustLift +
        (persona.id === 'MENTOR' ? 0.16 : 0) +
        (persona.id === 'SURVIVOR' ? 0.12 : 0) +
        (persona.id === 'ARCHIVIST' ? 0.08 : 0),
    ),
  );
}

function resolveDominantNeed(
  urgency01: number,
  confidenceRepair01: number,
  crowdContainment01: number,
  negotiationSupport01: number,
  challengePressure01: number,
  engagement: ChatEngagementScoreResult,
  defaults: typeof CHAT_HELPER_INTERVENTION_POLICY_DEFAULTS,
): DominantNeed {
  if (engagement.vector.rescueNeed01 >= defaults.rescueThreshold) return 'RESCUE';
  if (crowdContainment01 >= defaults.crowdContainmentThreshold) {
    return 'CROWD_CONTAINMENT';
  }
  if (negotiationSupport01 >= defaults.negotiationGuardThreshold) {
    return 'NEGOTIATION_SUPPORT';
  }
  if (confidenceRepair01 >= defaults.softInterventionThreshold) {
    return 'CONFIDENCE_REPAIR';
  }
  if (challengePressure01 >= defaults.challengeThreshold) {
    return 'CHALLENGE';
  }
  if (
    urgency01 >= defaults.silenceHoldThreshold &&
    engagement.vector.dropOffRisk01 < defaults.rescueThreshold
  ) {
    return 'SILENCE_HOLD';
  }
  return 'NONE';
}

function resolveFamily(
  dominantNeed: DominantNeed,
  persona: ChatHelperPersonaSpec,
  options: ChatHelperInterventionPolicyOptions,
): ChatHelperInterventionFamily {
  switch (dominantNeed) {
    case 'RESCUE':
      return 'POST_COLLAPSE_RESCUE';
    case 'CROWD_CONTAINMENT':
      return 'CONTAIN';
    case 'NEGOTIATION_SUPPORT':
      return options.allowDealRoomIntervention === false ? 'COACH' : 'NEGOTIATE';
    case 'CONFIDENCE_REPAIR':
      return persona.id === 'SURVIVOR' ? 'REASSURE' : 'COACH';
    case 'CHALLENGE':
      return persona.id === 'RIVAL' ? 'CHALLENGE' : 'COMEBACK_PRIMER';
    case 'SILENCE_HOLD':
      return options.allowSilenceHold === false ? 'COACH' : 'SILENCE_HOLD';
    default:
      return 'NONE';
  }
}

function resolvePosture(family: ChatHelperInterventionFamily): ChatHelperInterventionPosture {
  switch (family) {
    case 'POST_COLLAPSE_RESCUE':
    case 'REASSURE':
      return 'SHIELDING';
    case 'COACH':
      return 'COACHING';
    case 'CHALLENGE':
    case 'COMEBACK_PRIMER':
      return 'CHALLENGING';
    case 'NEGOTIATE':
      return 'NEGOTIATING';
    case 'CONTAIN':
      return 'CONTAINING';
    case 'SILENCE_HOLD':
      return 'WITNESSING';
    default:
      return 'NONE';
  }
}

function resolvePresenceStyle(
  family: ChatHelperInterventionFamily,
  urgency01: number,
  hater: ChatHaterPersonaDecision | null,
): ChatHelperPresenceStyle {
  if (family === 'SILENCE_HOLD') return 'HOLD';
  if (family === 'POST_COLLAPSE_RESCUE' && urgency01 >= 0.74) return 'INSTANT';
  if (family === 'NEGOTIATE') return 'SOFT_DELAY';
  if (hater && hater.score.aggression01 >= 0.58 && family !== 'POST_COLLAPSE_RESCUE') {
    return 'AFTER_HATER';
  }
  if (urgency01 >= 0.62) return 'SOFT_DELAY';
  return 'WATCHFUL_DELAY';
}

function resolveChannelForHelper(
  snapshot: ChatLearningBridgePublicSnapshot,
  featureSnapshot: ChatFeatureSnapshot | null,
  persona: ChatHelperPersonaSpec,
  family: ChatHelperInterventionFamily,
  dominantNeed: DominantNeed,
  defaults: typeof CHAT_HELPER_INTERVENTION_POLICY_DEFAULTS,
): ChannelScoreMap {
  const preferredChannel = getPreferredChannel(snapshot);
  const activeChannel = getActiveChannel(snapshot);
  const mount = mountCategory(getMountTarget(snapshot));
  const scores = createChannelScoreMap(0);

  scores.GLOBAL = asScore01(
    clamp01(
      getChannelShare(featureSnapshot, 'channelViewShare01', 'GLOBAL', 0) * 0.14 +
        getChannelShare(featureSnapshot, 'channelOutboundShare01', 'GLOBAL', 0) * 0.08 +
        persona.publicStageTolerance01 * 0.14 +
        (family === 'CHALLENGE' || family === 'COMEBACK_PRIMER' ? 0.12 : 0) +
        (activeChannel === 'GLOBAL' ? defaults.activeChannelBias : 0) +
        (preferredChannel === 'GLOBAL' ? defaults.preferredChannelBias : 0) -
        (dominantNeed === 'CROWD_CONTAINMENT' ? defaults.globalContainmentPenalty : 0) -
        (family === 'NEGOTIATE' ? 0.08 : 0),
    ),
  );

  scores.SYNDICATE = asScore01(
    clamp01(
      getChannelShare(featureSnapshot, 'channelViewShare01', 'SYNDICATE', 0) * 0.12 +
        getChannelShare(featureSnapshot, 'channelOutboundShare01', 'SYNDICATE', 0) * 0.08 +
        (persona.preferredChannels.includes('SYNDICATE') ? 0.18 : 0) +
        (family === 'COACH' || family === 'REASSURE' ? defaults.syndicateTrustBias : 0) +
        (mount === 'EMPIRE' ? 0.06 : 0) +
        (activeChannel === 'SYNDICATE' ? defaults.activeChannelBias : 0) +
        (preferredChannel === 'SYNDICATE' ? defaults.preferredChannelBias : 0),
    ),
  );

  scores.DEAL_ROOM = asScore01(
    clamp01(
      getChannelShare(featureSnapshot, 'channelViewShare01', 'DEAL_ROOM', 0) * 0.12 +
        getChannelShare(featureSnapshot, 'channelOutboundShare01', 'DEAL_ROOM', 0) * 0.08 +
        persona.dealRoomTolerance01 * 0.16 +
        (family === 'NEGOTIATE' ? defaults.privateAdviceDealRoomLift : 0) +
        (activeChannel === 'DEAL_ROOM' ? defaults.activeChannelBias : 0) +
        (preferredChannel === 'DEAL_ROOM' ? defaults.preferredChannelBias : 0) -
        (dominantNeed === 'CROWD_CONTAINMENT' ? 0.04 : 0),
    ),
  );

  scores.LOBBY = asScore01(
    clamp01(
      getChannelShare(featureSnapshot, 'channelViewShare01', 'LOBBY', 0) * 0.10 +
        getChannelShare(featureSnapshot, 'channelOutboundShare01', 'LOBBY', 0) * 0.08 +
        (persona.preferredChannels.includes('LOBBY') ? 0.14 : 0) +
        (family === 'POST_COLLAPSE_RESCUE' ? defaults.rescueLobbyLift : 0) +
        (dominantNeed === 'CONFIDENCE_REPAIR' ? defaults.lowConfidenceLobbyLift : 0) +
        defaults.lobbySafetyBias +
        (activeChannel === 'LOBBY' ? defaults.activeChannelBias : 0) +
        (preferredChannel === 'LOBBY' ? defaults.preferredChannelBias : 0) +
        (mount === 'LOBBY' ? 0.06 : 0),
    ),
  );

  if (family === 'NEGOTIATE') {
    scores.DEAL_ROOM = asScore01(clamp01(scores.DEAL_ROOM + 0.08));
    scores.GLOBAL = asScore01(clamp01(scores.GLOBAL - 0.06));
  }

  if (family === 'POST_COLLAPSE_RESCUE' || family === 'REASSURE') {
    scores.LOBBY = asScore01(clamp01(scores.LOBBY + 0.06));
    scores.SYNDICATE = asScore01(clamp01(scores.SYNDICATE + 0.04));
  }

  if (family === 'CHALLENGE' && persona.id === 'RIVAL') {
    scores.GLOBAL = asScore01(clamp01(scores.GLOBAL + 0.06));
  }

  return scores;
}

function resolveShouldSuppressHater(
  family: ChatHelperInterventionFamily,
  hater: ChatHaterPersonaDecision | null,
  persona: ChatHelperPersonaSpec,
  urgency01: number,
  defaults: typeof CHAT_HELPER_INTERVENTION_POLICY_DEFAULTS,
): boolean {
  if (!hater) return urgency01 >= defaults.haterSuppressionThreshold && family !== 'NONE';
  return (
    urgency01 >= defaults.haterSuppressionThreshold ||
    family === 'POST_COLLAPSE_RESCUE' ||
    (family === 'CONTAIN' && persona.haterSuppressionBias01 >= 0.64) ||
    hater.score.aggression01 >= defaults.haterSuppressionThreshold
  );
}

function resolveShouldRespectSilence(
  family: ChatHelperInterventionFamily,
  urgency01: number,
  engagement: ChatEngagementScoreResult,
  options: ChatHelperInterventionPolicyOptions,
): boolean {
  if (options.allowSilenceHold === false) return false;
  if (family === 'SILENCE_HOLD') return true;
  return (
    urgency01 >= CHAT_HELPER_INTERVENTION_POLICY_DEFAULTS.silenceHoldThreshold &&
    engagement.vector.dropOffRisk01 < CHAT_HELPER_INTERVENTION_POLICY_DEFAULTS.rescueThreshold &&
    engagement.vector.socialPressure01 < 0.52
  );
}

function resolveTypingHoldMs(
  presenceStyle: ChatHelperPresenceStyle,
  urgency01: number,
  defaults: typeof CHAT_HELPER_INTERVENTION_POLICY_DEFAULTS,
): number {
  switch (presenceStyle) {
    case 'INSTANT':
      return Math.round(
        defaults.minTypingHoldMs +
          (1 - urgency01) * (defaults.maxTypingHoldMs * 0.16),
      );
    case 'SOFT_DELAY':
      return Math.round(defaults.minTypingHoldMs + 900 + (1 - urgency01) * 1_200);
    case 'AFTER_HATER':
      return Math.round(defaults.minTypingHoldMs + 1_250 + (1 - urgency01) * 1_600);
    case 'WATCHFUL_DELAY':
      return Math.round(defaults.minTypingHoldMs + 1_800 + (1 - urgency01) * 2_100);
    case 'AFTER_SILENCE':
      return Math.round(defaults.minTypingHoldMs + 2_100 + (1 - urgency01) * 2_200);
    case 'HOLD':
      return Math.round(defaults.maxTypingHoldMs);
    default:
      return defaults.minTypingHoldMs;
  }
}

function resolveInitialDelayMs(
  presenceStyle: ChatHelperPresenceStyle,
  urgency01: number,
  defaults: typeof CHAT_HELPER_INTERVENTION_POLICY_DEFAULTS,
): number {
  switch (presenceStyle) {
    case 'INSTANT':
      return defaults.minRevealDelayMs;
    case 'SOFT_DELAY':
      return Math.round((1 - urgency01) * 1_500);
    case 'AFTER_HATER':
      return Math.round(850 + (1 - urgency01) * 1_450);
    case 'WATCHFUL_DELAY':
      return Math.round(1_200 + (1 - urgency01) * 2_000);
    case 'AFTER_SILENCE':
      return Math.round(2_000 + (1 - urgency01) * 2_400);
    case 'HOLD':
      return Math.round(2_800 + (1 - urgency01) * 4_000);
    default:
      return 0;
  }
}

function resolveRevealDelayMs(
  family: ChatHelperInterventionFamily,
  urgency01: number,
  defaults: typeof CHAT_HELPER_INTERVENTION_POLICY_DEFAULTS,
): number {
  if (family === 'POST_COLLAPSE_RESCUE') return 0;
  if (family === 'NEGOTIATE') return Math.round(650 + (1 - urgency01) * 1_100);
  if (family === 'SILENCE_HOLD') return Math.round(1_600 + (1 - urgency01) * 2_000);
  return Math.round((1 - urgency01) * defaults.maxRevealDelayMs * 0.28);
}

function resolveBurstCount(
  family: ChatHelperInterventionFamily,
  urgency01: number,
  defaults: typeof CHAT_HELPER_INTERVENTION_POLICY_DEFAULTS,
): number {
  if (family === 'NONE' || family === 'SILENCE_HOLD') return defaults.minInterventionBurst;
  if (family === 'POST_COLLAPSE_RESCUE' && urgency01 >= defaults.rescueThreshold) {
    return Math.min(defaults.maxInterventionBurst, 2);
  }
  if (family === 'CONTAIN' && urgency01 >= 0.74) {
    return Math.min(defaults.maxInterventionBurst, 2);
  }
  return 1;
}

function resolveWindow(
  family: ChatHelperInterventionFamily,
  presenceStyle: ChatHelperPresenceStyle,
  urgency01: number,
  defaults: typeof CHAT_HELPER_INTERVENTION_POLICY_DEFAULTS,
): ChatHelperInterventionWindow {
  return Object.freeze({
    presenceStyle,
    initialDelayMs: resolveInitialDelayMs(presenceStyle, urgency01, defaults),
    typingHoldMs: resolveTypingHoldMs(presenceStyle, urgency01, defaults),
    revealDelayMs: resolveRevealDelayMs(family, urgency01, defaults),
    burstCount: resolveBurstCount(family, urgency01, defaults),
  });
}

/* ========================================================================== */
/* MARK: Score builders                                                       */
/* ========================================================================== */

function createDerivedContext(
  snapshot: ChatLearningBridgePublicSnapshot,
  options: ChatHelperInterventionPolicyOptions,
  defaults: typeof CHAT_HELPER_INTERVENTION_POLICY_DEFAULTS,
): HelperDerivedContext {
  const featureSnapshot = getFeatureSnapshot(snapshot);
  const engagement = scoreChatEngagement(snapshot);
  const coldStart = evaluateChatColdStartPolicy(snapshot);
  const hater = resolveChatHaterPersona(snapshot);
  const pressureTier = safePressureTier(featureSnapshot);
  const tickTier = safeTickTier(featureSnapshot);
  const featureSummary = safeSummarizeFeatureSnapshot(featureSnapshot);

  const crowdContainment01 = scoreCrowdContainmentNeed(
    snapshot,
    featureSnapshot,
    engagement,
    defaults,
  );

  const negotiationSupport01 = scoreNegotiationSupportNeed(
    featureSnapshot,
    engagement,
  );

  const confidenceRepair01 = scoreConfidenceRepairNeed(
    snapshot,
    featureSnapshot,
    engagement,
  );

  const challengePressure01 = scoreChallengeNeed(
    snapshot,
    featureSnapshot,
    engagement,
  );

  const urgency01 = scoreUrgency(
    snapshot,
    featureSnapshot,
    engagement,
    crowdContainment01,
    confidenceRepair01,
    negotiationSupport01,
  );

  const trustProxy01 = asScore01(
    clamp01(
      snapshot.profile.helperNeed01 * 0.14 +
        snapshot.profile.syndicateAffinity01 * 0.10 +
        clamp01(1 - snapshot.profile.dropOffRisk01) * 0.12 +
        coldStart.helperPlan.helperUrgency01 * 0.12 +
        confidenceRepair01 * 0.16 +
        clamp01(1 - challengePressure01) * 0.06 +
        (coldStart.plan.shouldRespectSilence ? 0.06 : 0),
    ),
  );

  const dominantNeed = resolveDominantNeed(
    urgency01,
    confidenceRepair01,
    crowdContainment01,
    negotiationSupport01,
    challengePressure01,
    engagement,
    defaults,
  );

  const tempPersona = getHelperPersonaById('MENTOR');
  const recommendedChannelScores = resolveChannelForHelper(
    snapshot,
    featureSnapshot,
    tempPersona,
    resolveFamily(dominantNeed, tempPersona, options),
    dominantNeed,
    defaults,
  );

  return Object.freeze({
    featureSnapshot,
    engagement,
    coldStart,
    hater,
    pressureTier,
    tickTier,
    featureSummary,
    crowdContainment01,
    negotiationSupport01,
    confidenceRepair01,
    challengePressure01,
    urgency01,
    trustProxy01,
    dominantNeed,
    recommendedChannelScores,
    coldWindow: coldWindow(snapshot),
  });
}

function scoreHelperPersona(
  snapshot: ChatLearningBridgePublicSnapshot,
  persona: ChatHelperPersonaSpec,
  context: HelperDerivedContext,
  defaults: typeof CHAT_HELPER_INTERVENTION_POLICY_DEFAULTS,
  options: ChatHelperInterventionPolicyOptions,
): ChatHelperPersonaScore {
  const family = resolveFamily(context.dominantNeed, persona, options);
  const posture = resolvePosture(family);

  const channelScores = resolveChannelForHelper(
    snapshot,
    context.featureSnapshot,
    persona,
    family,
    context.dominantNeed,
    defaults,
  );

  const channel = pickMax(channelScores, getActiveChannel(snapshot));

  const trustProxy01 = scoreTrustProxy(snapshot, persona, context.featureSnapshot);
  const shouldProtectFromPublicStage =
    context.crowdContainment01 >= defaults.publicShameProtectionThreshold &&
    persona.publicStageTolerance01 < 0.56;

  const shouldUsePrivateAdvice =
    family === 'NEGOTIATE' ||
    channel === 'DEAL_ROOM' ||
    (context.dominantNeed === 'CROWD_CONTAINMENT' && channel !== 'GLOBAL');

  const shouldPromoteRecovery =
    family === 'POST_COLLAPSE_RESCUE' ||
    family === 'REASSURE' ||
    family === 'COACH';

  const shouldPrimeComeback =
    family === 'CHALLENGE' || family === 'COMEBACK_PRIMER';

  const shouldIntervene =
    context.urgency01 >= defaults.softInterventionThreshold ||
    context.dominantNeed === 'CHALLENGE' ||
    context.dominantNeed === 'NEGOTIATION_SUPPORT';

  const presenceStyle = resolvePresenceStyle(family, context.urgency01, context.hater);

  const confidenceRepair01 = asScore01(
    clamp01(
      context.confidenceRepair01 * 0.58 +
        persona.confidenceRepairBias01 * 0.28 +
        trustProxy01 * 0.14,
    ),
  );

  const crowdContainment01 = asScore01(
    clamp01(
      context.crowdContainment01 * 0.62 +
        persona.containmentBias01 * 0.24 +
        (channel === 'GLOBAL' ? -0.04 : 0.06),
    ),
  );

  const challengePressure01 = asScore01(
    clamp01(
      context.challengePressure01 * 0.54 +
        persona.challengeBias01 * 0.30 +
        trustProxy01 * 0.10 +
        (persona.id === 'RIVAL' ? 0.08 : 0),
    ),
  );

  const negotiationSupport01 = asScore01(
    clamp01(
      context.negotiationSupport01 * 0.58 +
        persona.negotiationBias01 * 0.26 +
        (channel === 'DEAL_ROOM' ? 0.10 : 0),
    ),
  );

  const haterSuppression01 = asScore01(
    clamp01(
      context.urgency01 * 0.22 +
        crowdContainment01 * 0.24 +
        persona.haterSuppressionBias01 * 0.32 +
        (context.hater?.score.aggression01 ?? 0) * 0.22,
    ),
  );

  const shouldSuppressHater = resolveShouldSuppressHater(
    family,
    context.hater,
    persona,
    context.urgency01,
    defaults,
  );

  const shouldRespectSilence = resolveShouldRespectSilence(
    family,
    context.urgency01,
    context.engagement,
    options,
  );

  const fit01 = asScore01(
    clamp01(
      context.urgency01 * 0.18 +
        trustProxy01 * 0.16 +
        confidenceRepair01 * 0.12 +
        crowdContainment01 * 0.10 +
        negotiationSupport01 * 0.08 +
        haterSuppression01 * 0.10 +
        asFiniteNumber(channelScores[channel], 0) * 0.14 +
        (family === 'POST_COLLAPSE_RESCUE' ? persona.rescueBias01 * 0.12 : 0) +
        (family === 'CHALLENGE' || family === 'COMEBACK_PRIMER'
          ? challengePressure01 * 0.08
          : 0) +
        (shouldProtectFromPublicStage ? 0.04 : 0),
    ),
  );

  return Object.freeze({
    personaId: persona.id,
    fit01,
    urgency01: context.urgency01,
    trustProxy01,
    family,
    posture,
    channel,
    shouldIntervene,
    shouldRespectSilence,
    shouldSuppressHater,
    shouldProtectFromPublicStage,
    shouldUsePrivateAdvice,
    shouldPromoteRecovery,
    shouldPrimeComeback,
    confidenceRepair01,
    crowdContainment01,
    challengePressure01,
    negotiationSupport01,
    haterSuppression01,
    presenceStyle,
  });
}

function buildInterventionPlan(
  score: ChatHelperPersonaScore,
  defaults: typeof CHAT_HELPER_INTERVENTION_POLICY_DEFAULTS,
): ChatHelperInterventionPlan {
  const window = resolveWindow(
    score.family,
    score.presenceStyle,
    score.urgency01,
    defaults,
  );

  return Object.freeze({
    personaId: score.personaId,
    family: score.family,
    posture: score.posture,
    channel: score.channel,
    shouldIntervene: score.shouldIntervene,
    shouldRespectSilence: score.shouldRespectSilence,
    shouldSuppressHater: score.shouldSuppressHater,
    shouldProtectFromPublicStage: score.shouldProtectFromPublicStage,
    shouldUsePrivateAdvice: score.shouldUsePrivateAdvice,
    shouldPromoteRecovery: score.shouldPromoteRecovery,
    shouldPrimeComeback: score.shouldPrimeComeback,
    urgency01: score.urgency01,
    confidenceRepair01: score.confidenceRepair01,
    crowdContainment01: score.crowdContainment01,
    challengePressure01: score.challengePressure01,
    negotiationSupport01: score.negotiationSupport01,
    haterSuppression01: score.haterSuppression01,
    window,
    explanation: [
      `helper:${score.personaId}`,
      `family:${score.family}`,
      `posture:${score.posture}`,
      `channel:${score.channel}`,
      `urg:${score.urgency01.toFixed(2)}`,
      `fit:${score.fit01.toFixed(2)}`,
    ].join(' | '),
  });
}

function createBridgeRecommendation(
  snapshot: ChatLearningBridgePublicSnapshot,
  score: ChatHelperPersonaScore,
  engagement: ChatEngagementScoreResult,
): ChatLearningBridgeRecommendation {
  return Object.freeze({
    recommendedChannel: score.channel,
    helperUrgency01: score.urgency01,
    rescueNeeded: engagement.vector.rescueNeed01 >= CHAT_HELPER_INTERVENTION_POLICY_DEFAULTS.rescueThreshold,
    haterAggression01: score.shouldSuppressHater
      ? asScore01(clamp01(engagement.vector.haterAggression01 * 0.72))
      : engagement.vector.haterAggression01,
    dropOffRisk01: engagement.vector.dropOffRisk01,
    explanation: [
      `helper:${score.personaId}`,
      `family:${score.family}`,
      `channel:${score.channel}`,
      `silence:${score.shouldRespectSilence ? 'hold' : 'speak'}`,
    ].join(' | '),
  });
}

function createProfilePatch(
  snapshot: ChatLearningBridgePublicSnapshot,
  score: ChatHelperPersonaScore,
  engagement: ChatEngagementScoreResult,
  defaults: typeof CHAT_HELPER_INTERVENTION_POLICY_DEFAULTS,
): Partial<ChatLearningBridgeProfileState> {
  return {
    preferredChannel: score.channel,
    helperNeed01: asScore01(
      lerp01(
        snapshot.profile.helperNeed01,
        clamp01(score.urgency01 * 0.54 + score.confidenceRepair01 * 0.28),
        defaults.interventionSmoothingAlpha,
      ),
    ),
    rescueNeed01: asScore01(
      lerp01(
        snapshot.profile.rescueNeed01,
        clamp01(
          engagement.vector.rescueNeed01 +
            (score.family === 'POST_COLLAPSE_RESCUE' ? 0.06 : 0) -
            (score.shouldRespectSilence ? 0.02 : 0),
        ),
        defaults.interventionSmoothingAlpha,
      ),
    ),
    confidence01: asScore01(
      lerp01(
        snapshot.profile.confidence01,
        clamp01(
          snapshot.profile.confidence01 +
            score.confidenceRepair01 * 0.08 +
            (score.family === 'CHALLENGE' || score.family === 'COMEBACK_PRIMER'
              ? 0.02
              : 0) -
            (score.shouldProtectFromPublicStage ? 0.01 : 0),
        ),
        defaults.interventionSmoothingAlpha,
      ),
    ),
    shameSensitivity01: asScore01(
      lerp01(
        snapshot.profile.shameSensitivity01,
        clamp01(
          snapshot.profile.shameSensitivity01 -
            score.crowdContainment01 * 0.06 +
            (score.shouldProtectFromPublicStage ? 0.02 : 0),
        ),
        defaults.interventionSmoothingAlpha,
      ),
    ),
    globalAffinity01: asScore01(
      lerp01(
        snapshot.profile.globalAffinity01,
        score.channel === 'GLOBAL'
          ? clamp01(snapshot.profile.globalAffinity01 + 0.03)
          : snapshot.profile.globalAffinity01,
        defaults.interventionSmoothingAlpha,
      ),
    ),
    syndicateAffinity01: asScore01(
      lerp01(
        snapshot.profile.syndicateAffinity01,
        score.channel === 'SYNDICATE'
          ? clamp01(snapshot.profile.syndicateAffinity01 + 0.04)
          : snapshot.profile.syndicateAffinity01,
        defaults.interventionSmoothingAlpha,
      ),
    ),
    dealRoomAffinity01: asScore01(
      lerp01(
        snapshot.profile.dealRoomAffinity01,
        score.channel === 'DEAL_ROOM'
          ? clamp01(snapshot.profile.dealRoomAffinity01 + 0.04)
          : snapshot.profile.dealRoomAffinity01,
        defaults.interventionSmoothingAlpha,
      ),
    ),
    haterTolerance01: asScore01(
      lerp01(
        snapshot.profile.haterTolerance01,
        clamp01(
          snapshot.profile.haterTolerance01 -
            (score.shouldSuppressHater ? 0.04 : 0) +
            (score.family === 'CHALLENGE' ? 0.02 : 0),
        ),
        defaults.interventionSmoothingAlpha,
      ),
    ),
  };
}

/* ========================================================================== */
/* MARK: Policy class                                                         */
/* ========================================================================== */

export class ChatHelperInterventionPolicy
  implements ChatHelperInterventionInferencePort
{
  public readonly options: ChatHelperInterventionPolicyOptions;

  public readonly defaults: typeof CHAT_HELPER_INTERVENTION_POLICY_DEFAULTS;

  public readonly registry: readonly ChatHelperPersonaSpec[];

  private readonly registryMap: Record<ChatHelperPersonaId, ChatHelperPersonaSpec>;

  public constructor(options: ChatHelperInterventionPolicyOptions = {}) {
    this.options = options;
    this.defaults = Object.freeze({
      ...CHAT_HELPER_INTERVENTION_POLICY_DEFAULTS,
      ...(options.defaults ?? {}),
    });

    this.registry = Object.freeze(
      [...(options.helperRegistry ?? CHAT_HELPER_PERSONA_REGISTRY)] as readonly ChatHelperPersonaSpec[],
    );

    this.registryMap = this.registry.reduce((acc, persona) => {
      acc[persona.id] = persona;
      return acc;
    }, {} as Record<ChatHelperPersonaId, ChatHelperPersonaSpec>);
  }

  public resolve(
    snapshot: ChatLearningBridgePublicSnapshot,
  ): ChatHelperInterventionDecision {
    const context = createDerivedContext(snapshot, this.options, this.defaults);

    const rawScores = this.registry.map((persona) =>
      scoreHelperPersona(
        snapshot,
        persona,
        context,
        this.defaults,
        this.options,
      ),
    );

    const ranked = sortScores(rawScores);
    const score = ranked[0];
    const persona = this.registryMap[score.personaId];
    const plan = buildInterventionPlan(score, this.defaults);

    const bridgeRecommendation = createBridgeRecommendation(
      snapshot,
      score,
      context.engagement,
    );

    const profilePatch = createProfilePatch(
      snapshot,
      score,
      context.engagement,
      this.defaults,
    );

    const explanation = [
      `helper:${persona.id}`,
      `family:${score.family}`,
      `fit:${score.fit01.toFixed(2)}`,
      `urg:${score.urgency01.toFixed(2)}`,
      `trust:${score.trustProxy01.toFixed(2)}`,
      `channel:${score.channel}`,
      `posture:${score.posture}`,
      `pressure:${context.pressureTier}`,
      `tick:${context.tickTier}`,
      context.coldWindow ? 'cold:cap' : 'cold:off',
    ].join(' | ');

    const breakdown: ChatHelperInterventionPolicyBreakdown = Object.freeze({
      moduleName: CHAT_HELPER_INTERVENTION_POLICY_MODULE_NAME,
      moduleVersion: CHAT_HELPER_INTERVENTION_POLICY_VERSION,
      bridgeModuleName: CHAT_LEARNING_BRIDGE_MODULE_NAME,
      bridgeModuleVersion: CHAT_LEARNING_BRIDGE_VERSION,
      pressureTier: context.pressureTier,
      tickTier: context.tickTier,
      featureSummary: context.featureSummary,
      coldWindow: context.coldWindow,
      chosenPersonaId: persona.id,
      dominantNeed: context.dominantNeed,
      explanation,
    });

    return Object.freeze({
      persona,
      plan,
      ranked,
      bridgeRecommendation,
      profilePatch,
      breakdown,
    });
  }

  public recommend(
    snapshot: ChatLearningBridgePublicSnapshot,
  ): ChatLearningBridgeRecommendation {
    return this.resolve(snapshot).bridgeRecommendation;
  }

  public refineProfile(
    snapshot: ChatLearningBridgePublicSnapshot,
  ): Partial<ChatLearningBridgeProfileState> {
    return this.resolve(snapshot).profilePatch;
  }

  public resolveForPersona(
    snapshot: ChatLearningBridgePublicSnapshot,
    personaId: ChatHelperPersonaId,
  ): ChatHelperPersonaScore {
    const context = createDerivedContext(snapshot, this.options, this.defaults);
    const persona = this.registryMap[personaId];
    return scoreHelperPersona(
      snapshot,
      persona,
      context,
      this.defaults,
      this.options,
    );
  }

  public getRegistry(): readonly ChatHelperPersonaSpec[] {
    return this.registry;
  }

  public resolveAlias(value: string): ChatHelperPersonaId | null {
    return resolveAlias(value);
  }
}

/* ========================================================================== */
/* MARK: Public helpers                                                       */
/* ========================================================================== */

export function createChatHelperInterventionPolicy(
  options: ChatHelperInterventionPolicyOptions = {},
): ChatHelperInterventionPolicy {
  return new ChatHelperInterventionPolicy(options);
}

export function resolveChatHelperIntervention(
  snapshot: ChatLearningBridgePublicSnapshot,
  options: ChatHelperInterventionPolicyOptions = {},
): ChatHelperInterventionDecision {
  return createChatHelperInterventionPolicy(options).resolve(snapshot);
}

export function recommendChatHelperIntervention(
  snapshot: ChatLearningBridgePublicSnapshot,
  options: ChatHelperInterventionPolicyOptions = {},
): ChatLearningBridgeRecommendation {
  return createChatHelperInterventionPolicy(options).recommend(snapshot);
}

export function refineHelperInterventionProfileState(
  snapshot: ChatLearningBridgePublicSnapshot,
  options: ChatHelperInterventionPolicyOptions = {},
): Partial<ChatLearningBridgeProfileState> {
  return createChatHelperInterventionPolicy(options).refineProfile(snapshot);
}

export function getChatHelperPersonaById(
  id: ChatHelperPersonaId,
  registry: readonly ChatHelperPersonaSpec[] = CHAT_HELPER_PERSONA_REGISTRY,
): ChatHelperPersonaSpec {
  return getHelperPersonaById(id, registry);
}

export function getChatHelperPersonaIdAlias(value: string): ChatHelperPersonaId | null {
  return resolveAlias(value);
}

export function buildHelperInterventionBundle(
  snapshot: ChatLearningBridgePublicSnapshot,
  options: ChatHelperInterventionPolicyOptions = {},
): {
  readonly bridgeModule: typeof CHAT_LEARNING_BRIDGE_MODULE_NAME;
  readonly bridgeVersion: typeof CHAT_LEARNING_BRIDGE_VERSION;
  readonly helperPolicyModule: typeof CHAT_HELPER_INTERVENTION_POLICY_MODULE_NAME;
  readonly helperPolicyVersion: typeof CHAT_HELPER_INTERVENTION_POLICY_VERSION;
  readonly seedIds: typeof CHAT_LEARNING_PROFILE_HELPER_SEED_IDS;
  readonly decision: ChatHelperInterventionDecision;
} {
  return Object.freeze({
    bridgeModule: CHAT_LEARNING_BRIDGE_MODULE_NAME,
    bridgeVersion: CHAT_LEARNING_BRIDGE_VERSION,
    helperPolicyModule: CHAT_HELPER_INTERVENTION_POLICY_MODULE_NAME,
    helperPolicyVersion: CHAT_HELPER_INTERVENTION_POLICY_VERSION,
    seedIds: CHAT_LEARNING_PROFILE_HELPER_SEED_IDS,
    decision: resolveChatHelperIntervention(snapshot, options),
  });
}

export const CHAT_HELPER_INTERVENTION_POLICY_NAMESPACE = Object.freeze({
  moduleName: CHAT_HELPER_INTERVENTION_POLICY_MODULE_NAME,
  version: CHAT_HELPER_INTERVENTION_POLICY_VERSION,
  runtimeLaws: CHAT_HELPER_INTERVENTION_POLICY_RUNTIME_LAWS,
  defaults: CHAT_HELPER_INTERVENTION_POLICY_DEFAULTS,
  seedIds: CHAT_LEARNING_PROFILE_HELPER_SEED_IDS,
  registry: CHAT_HELPER_PERSONA_REGISTRY,
  aliases: CHAT_HELPER_PERSONA_ALIASES,
  create: createChatHelperInterventionPolicy,
  resolve: resolveChatHelperIntervention,
  recommend: recommendChatHelperIntervention,
  refineProfile: refineHelperInterventionProfileState,
  getById: getChatHelperPersonaById,
  resolveAlias: getChatHelperPersonaIdAlias,
  buildBundle: buildHelperInterventionBundle,
} as const);

export default ChatHelperInterventionPolicy;


/* ========================================================================== */
/* MARK: Compatibility helpers                                                */
/* ========================================================================== */

export interface ChatHelperInterventionSnapshotCompat {
  readonly recommendedChannel: ChatVisibleChannel;
  readonly urgency01: Score01;
  readonly family: ChatHelperInterventionFamily;
  readonly posture: ChatHelperInterventionPosture;
  readonly helperPersonaId: ChatHelperPersonaId;
  readonly confidenceRepair01: Score01;
  readonly crowdContainment01: Score01;
  readonly challengePressure01: Score01;
  readonly negotiationSupport01: Score01;
  readonly haterSuppression01: Score01;
  readonly shouldIntervene: boolean;
  readonly shouldRespectSilence: boolean;
}

export function createChatHelperInterventionSnapshotCompat(
  decision: ChatHelperInterventionDecision,
): ChatHelperInterventionSnapshotCompat {
  return Object.freeze({
    recommendedChannel: decision.plan.channel,
    urgency01: decision.plan.urgency01,
    family: decision.plan.family,
    posture: decision.plan.posture,
    helperPersonaId: decision.persona.id,
    confidenceRepair01: decision.plan.confidenceRepair01,
    crowdContainment01: decision.plan.crowdContainment01,
    challengePressure01: decision.plan.challengePressure01,
    negotiationSupport01: decision.plan.negotiationSupport01,
    haterSuppression01: decision.plan.haterSuppression01,
    shouldIntervene: decision.plan.shouldIntervene,
    shouldRespectSilence: decision.plan.shouldRespectSilence,
  });
}

export function isChatHelperPersonaId(value: string): value is ChatHelperPersonaId {
  return (
    value === 'MENTOR' ||
    value === 'INSIDER' ||
    value === 'SURVIVOR' ||
    value === 'RIVAL' ||
    value === 'ARCHIVIST'
  );
}

export function listChatHelperPersonaIds(): readonly ChatHelperPersonaId[] {
  return Object.freeze([...CHAT_LEARNING_PROFILE_HELPER_SEED_IDS] as readonly ChatHelperPersonaId[]);
}

export function mapHelperPersonaToVisibleChannels(
  registry: readonly ChatHelperPersonaSpec[] = CHAT_HELPER_PERSONA_REGISTRY,
): Readonly<Record<ChatHelperPersonaId, readonly ChatVisibleChannel[]>> {
  return Object.freeze(
    registry.reduce((acc, persona) => {
      acc[persona.id] = Object.freeze([...persona.preferredChannels, ...persona.fallbackChannels]);
      return acc;
    }, {} as Record<ChatHelperPersonaId, readonly ChatVisibleChannel[]>),
  );
}

export function buildHelperPersonaSignatureIndex(
  registry: readonly ChatHelperPersonaSpec[] = CHAT_HELPER_PERSONA_REGISTRY,
): Readonly<Record<ChatHelperPersonaId, readonly string[]>> {
  return Object.freeze(
    registry.reduce((acc, persona) => {
      acc[persona.id] = Object.freeze([...persona.signature]);
      return acc;
    }, {} as Record<ChatHelperPersonaId, readonly string[]>),
  );
}

export const CHAT_HELPER_INTERVENTION_POLICY_README = Object.freeze({
  importPaths: Object.freeze({
    intelligenceBarrel: '/pzo-web/src/engines/chat/intelligence/ml',
    file: '/pzo-web/src/engines/chat/intelligence/ml/HelperInterventionPolicy.ts',
  }),
  recommendedConsumers: Object.freeze([
    'pzo-web/src/engines/chat/ChatNpcDirector.ts',
    'pzo-web/src/engines/chat/ChatEngine.ts',
    'pzo-web/src/components/chat/useUnifiedChat.ts',
    'future helper response planners',
  ] as const),
  immediateOutputs: Object.freeze([
    'helper persona selection',
    'intervention family',
    'helper cadence window',
    'channel alignment',
    'bridge-safe recommendation',
    'bridge profile patch',
  ] as const),
  integrationRule: Object.freeze([
    'Use resolve() for authored runtime plans.',
    'Use recommend() when only the bridge recommendation is needed.',
    'Use refineProfile() to merge helper state back into the local bridge.',
  ] as const),
} as const);

export type ChatHelperInterventionPolicyNamespace =
  typeof CHAT_HELPER_INTERVENTION_POLICY_NAMESPACE;

export type ChatHelperPersonaRegistry = typeof CHAT_HELPER_PERSONA_REGISTRY;
