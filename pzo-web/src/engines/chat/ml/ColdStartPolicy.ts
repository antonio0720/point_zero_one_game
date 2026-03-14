// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/chat/intelligence/ml/ColdStartPolicy.ts

/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT ML COLD-START POLICY
 * FILE: pzo-web/src/engines/chat/intelligence/ml/ColdStartPolicy.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * First-contact policy surface for the unified chat intelligence lane.
 *
 * This module exists because a cold-start profile by itself is not enough.
 * Point Zero One needs a runtime policy layer that converts cold-start biases,
 * early telemetry, mount targets, visible-channel semantics, and pressure state
 * into immediate first-contact behavior that still respects backend authority.
 *
 * This file is intentionally deeper than:
 * - "pick an opening channel"
 * - "be gentle first"
 * - "use helper if player seems quiet"
 *
 * It owns a full bootstrap policy package:
 * - opening-channel selection,
 * - silence discipline,
 * - helper posture,
 * - hater posture,
 * - negotiation guarding,
 * - stage-pressure containment,
 * - mount-aware opening styles,
 * - bridge-safe recommendation and profile refinement,
 * - first-scene bootstrap bundles for later ChatEngine / NPC planners.
 *
 * Permanent doctrine
 * ------------------
 * - Frontend cold-start policy exists to make the first thirty seconds feel
 *   authored instead of generic.
 * - The client may personalize quickly, but must stay merge-safe with backend
 *   truth.
 * - Early helper timing, crowd containment, and hater restraint are not flavor;
 *   they are part of gameplay integrity.
 * - Silence is a valid opening move.
 * - Lower-pressure openings stay available even for strong players.
 * - Deal-room caution is distinct from crowd caution.
 * - Mount targets matter; lobby, battle, and empire surfaces are not the same.
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
  CHAT_LEARNING_BRIDGE_CHANNEL_KEYS,
  CHAT_LEARNING_BRIDGE_MODULE_NAME,
  CHAT_LEARNING_BRIDGE_VERSION,
} from '../ChatLearningBridge';

import {
  CHAT_COLD_START_DEFAULTS,
  CHAT_COLD_START_PROFILE_VERSION,
  computeChatColdStartHeuristics,
  createChatColdStartProfile,
  createChatColdStartRecommendation,
  mergeChatColdStartProfiles,
  type ChatColdStartHeuristicSnapshot,
  type ChatColdStartProfile,
  type ChatColdStartRecommendation,
  type ChatColdStartSeedContext,
} from '../ChatColdStartProfile';

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

/* ========================================================================== */
/* MARK: Public module constants                                              */
/* ========================================================================== */

export const CHAT_COLD_START_POLICY_MODULE_NAME =
  'PZO_CHAT_COLD_START_POLICY' as const;

export const CHAT_COLD_START_POLICY_VERSION =
  '2026.03.13-cold-start-policy.v1' as const;

export const CHAT_COLD_START_POLICY_RUNTIME_LAWS = Object.freeze([
  'Cold-start policy is fast, local, and merge-safe.',
  'Silence may be an opening strategy, not an absence of logic.',
  'Helper-first does not mean helper-spam.',
  'Hater pressure must be earned by tolerance, confidence, and stage fit.',
  'Visible channels remain the only first-class public channel targets.',
  'Battle and high-pressure mounts require stronger guardrails than lobby mounts.',
  'Negotiation caution is independent from crowd caution.',
  'Any profile refinement must preserve backend override compatibility.',
  'Bootstrap policy must remain useful before DL memory lanes arrive.',
  'Opening recommendations must be explainable from live state.',
] as const);

export const CHAT_COLD_START_POLICY_DEFAULTS = Object.freeze({
  coldWindowMessageBudget: 6,
  coldWindowDurationMs: 90_000,
  coldWindowOpenCountBudget: 2,
  coldWindowRunBudget: 2,

  silenceFirstThreshold: 0.56,
  silenceFirstCriticalThreshold: 0.72,
  helperSoftThreshold: 0.46,
  helperHardThreshold: 0.66,
  haterSoftThreshold: 0.44,
  haterHardThreshold: 0.68,
  rescueLobbyShiftThreshold: 0.62,
  dealRoomGuardThreshold: 0.58,
  crowdContainmentThreshold: 0.56,
  embarrassmentContainmentThreshold: 0.52,
  globalStagePenalty: 0.10,
  syndicateSafetyBias: 0.08,
  lobbySafetyBias: 0.14,
  dealRoomPenalty: 0.12,
  lowerPressureOpeningBias: 0.12,
  preferredChannelBias: 0.05,
  activeChannelBias: 0.04,
  lowConfidenceLobbyBias: 0.08,
  helperCadenceFloor: 0.22,
  helperCadenceCeiling: 0.92,
  haterCadenceFloor: 0.08,
  haterCadenceCeiling: 0.84,
  negotiationGuardFloor: 0.18,
  negotiationGuardCeiling: 0.92,
  profileSmoothingAlpha: 0.16,
  channelAffinitySmoothingAlpha: 0.14,
  earlyToleranceCap: 0.76,
  earlyAggressionSuppression: 0.12,
  mountPressureBattleBonus: 0.10,
  mountPressureEmpireBonus: 0.06,
  mountPressureLobbyReduction: 0.08,
} as const);

/* ========================================================================== */
/* MARK: Public contracts                                                     */
/* ========================================================================== */

export type ChatColdStartOpeningStyle =
  | 'SILENCE_FIRST'
  | 'SYSTEM_PRIMER'
  | 'HELPER_SOFTEN'
  | 'SYNDICATE_GUIDE'
  | 'DEALROOM_GUARD'
  | 'STAGE_TEST'
  | 'HATER_PING';

export type ChatColdStartPressureDisposition =
  | 'CONTAIN'
  | 'STEADY'
  | 'TEST'
  | 'ESCALATE';

export type ChatColdStartSceneHint =
  | 'QUIET_OBSERVE'
  | 'RECOVERY_CUSHION'
  | 'PUBLIC_STAGE'
  | 'NEGOTIATION_CAUTION'
  | 'HELPER_RAMP'
  | 'HATER_RESTRAINT'
  | 'HATER_TEST'
  | 'COMEBACK_SPACE'
  | 'CROWD_SHIELD'
  | 'BATTLE_GUARD'
  | 'EMPIRE_TENSION'
  | 'LOBBY_SOFT_START';

export interface ChatColdStartPolicyOptions {
  readonly defaults?: Partial<typeof CHAT_COLD_START_POLICY_DEFAULTS>;
  readonly mountTargetHints?: Readonly<Record<string, Partial<ChatColdStartMountHint>>>;
  readonly includeExplanationBreakdown?: boolean;
  readonly allowSilenceFirst?: boolean;
  readonly allowDealRoomOpenings?: boolean;
  readonly allowStageTests?: boolean;
}

export interface ChatColdStartMountHint {
  readonly preferredOpeningChannel?: ChatVisibleChannel;
  readonly lowerPressureBias?: boolean;
  readonly pressureLift?: number;
  readonly helperLift?: number;
  readonly haterLift?: number;
  readonly sceneHint?: ChatColdStartSceneHint;
}

export interface ChatColdStartOpeningPlan {
  readonly openingChannel: ChatVisibleChannel;
  readonly openingStyle: ChatColdStartOpeningStyle;
  readonly pressureDisposition: ChatColdStartPressureDisposition;
  readonly respectSilenceFirst: boolean;
  readonly silenceHoldMs: number;
  readonly initialMessageDelayMs: number;
  readonly sceneHints: readonly ChatColdStartSceneHint[];
}

export interface ChatColdStartHelperPlan {
  readonly shouldPrime: boolean;
  readonly helperCadence01: Score01;
  readonly helperUrgency01: Score01;
  readonly helperHoldMs: number;
  readonly helperEscalationMs: number;
  readonly helperPersonaHint:
    | 'MENTOR'
    | 'INSIDER'
    | 'SURVIVOR'
    | 'RIVAL'
    | 'ARCHIVIST';
  readonly interventionStyle:
    | 'SOFT_GUIDE'
    | 'DIRECT_RESCUE'
    | 'QUIET_COMPANION'
    | 'TACTICAL_ASSIST'
    | 'DEBRIEF_READY';
}

export interface ChatColdStartHaterPlan {
  readonly allowHaterEntry: boolean;
  readonly haterCadence01: Score01;
  readonly haterAggressionCap01: Score01;
  readonly haterFirstPingDelayMs: number;
  readonly crowdAssistAllowed: boolean;
  readonly publicShameAllowed: boolean;
  readonly intrusionStyle:
    | 'NONE'
    | 'GLANCE'
    | 'TEST'
    | 'CROWD_POKE'
    | 'CONTROLLED_INTRUSION';
}

export interface ChatColdStartNegotiationPlan {
  readonly guard01: Score01;
  readonly shouldDeflectDealRoom: boolean;
  readonly shouldWarnAgainstOverexposure: boolean;
  readonly preferredCounterChannel: ChatVisibleChannel;
  readonly offerFrictionLift01: Score01;
  readonly explanation: string;
}

export interface ChatColdStartPresencePlan {
  readonly stageHeatLimit01: Score01;
  readonly crowdContainment01: Score01;
  readonly readDelayMs: number;
  readonly typingDelayMs: number;
  readonly allowAmbientTypingTheater: boolean;
  readonly explanation: string;
}

export interface ChatColdStartPolicyBreakdown {
  readonly moduleName: typeof CHAT_COLD_START_POLICY_MODULE_NAME;
  readonly moduleVersion: typeof CHAT_COLD_START_POLICY_VERSION;
  readonly bridgeModuleName: typeof CHAT_LEARNING_BRIDGE_MODULE_NAME;
  readonly bridgeModuleVersion: typeof CHAT_LEARNING_BRIDGE_VERSION;
  readonly pressureTier: ChatPressureTier;
  readonly tickTier: ChatTickTier;
  readonly mountTarget: string | null;
  readonly coldWindow: boolean;
  readonly heuristics: ChatColdStartHeuristicSnapshot;
  readonly channelScores: ChatChannelRecommendationScores;
  readonly featureSummary: string;
  readonly explanation: string;
}

export interface ChatColdStartPolicyDecision {
  readonly profile: ChatColdStartProfile;
  readonly recommendation: ChatColdStartRecommendation;
  readonly engagement: ChatEngagementScoreResult;
  readonly openingPlan: ChatColdStartOpeningPlan;
  readonly helperPlan: ChatColdStartHelperPlan;
  readonly haterPlan: ChatColdStartHaterPlan;
  readonly negotiationPlan: ChatColdStartNegotiationPlan;
  readonly presencePlan: ChatColdStartPresencePlan;
  readonly recommendedChannel: ChatVisibleChannel;
  readonly bridgeRecommendation: ChatLearningBridgeRecommendation;
  readonly profilePatch: Partial<ChatLearningBridgeProfileState>;
  readonly breakdown: ChatColdStartPolicyBreakdown;
}

/* ========================================================================== */
/* MARK: Utility helpers                                                      */
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

function safeString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeVisibleChannel(
  value: unknown,
  fallback: ChatVisibleChannel = 'GLOBAL',
): ChatVisibleChannel {
  if (
    value === 'GLOBAL' ||
    value === 'SYNDICATE' ||
    value === 'DEAL_ROOM' ||
    value === 'LOBBY'
  ) {
    return value;
  }

  return fallback;
}

function lerp01(current: number, next: number, alpha: number): number {
  return clamp01(current + (next - current) * clamp01(alpha));
}

function clampMs(value: number, floor = 0, ceiling = 120_000): number {
  if (!Number.isFinite(value)) return floor;
  return Math.max(floor, Math.min(ceiling, Math.round(value)));
}

function ensureChannelScores(seed = 0): ChatChannelRecommendationScores {
  return {
    GLOBAL: asScore01(seed),
    SYNDICATE: asScore01(seed),
    DEAL_ROOM: asScore01(seed),
    LOBBY: asScore01(seed),
  };
}

function pickBestChannel(scores: ChatChannelRecommendationScores): ChatVisibleChannel {
  let winner: ChatVisibleChannel = 'GLOBAL';
  let value = scores.GLOBAL;

  for (const channel of CHAT_LEARNING_BRIDGE_CHANNEL_KEYS) {
    if (scores[channel] > value) {
      winner = channel;
      value = scores[channel];
    }
  }

  return winner;
}

function uniqHints(
  hints: readonly ChatColdStartSceneHint[],
): readonly ChatColdStartSceneHint[] {
  return Object.freeze([...new Set(hints)]);
}

function isColdWindow(
  snapshot: ChatLearningBridgePublicSnapshot,
  defaults = CHAT_COLD_START_POLICY_DEFAULTS,
): boolean {
  const profile = snapshot.profile;
  const totalMessages =
    safeNumber(profile.totalMessagesInbound, 0) +
    safeNumber(profile.totalMessagesOutbound, 0);

  return (
    totalMessages <= defaults.coldWindowMessageBudget &&
    safeNumber(profile.totalChatOpens, 0) <= defaults.coldWindowOpenCountBudget &&
    safeNumber(profile.totalRunsSeen, 0) <= defaults.coldWindowRunBudget
  );
}

function getLatestFeatureSnapshot(
  snapshot: ChatLearningBridgePublicSnapshot,
): ChatFeatureSnapshot | null {
  const candidate = snapshot.latestFeatureSnapshot;
  return candidate && isRecord(candidate) ? (candidate as ChatFeatureSnapshot) : null;
}

function getFeatureNumber(
  snapshot: ChatFeatureSnapshot | null,
  key: string,
  fallback = 0,
): number {
  if (!snapshot || !isRecord(snapshot)) return fallback;
  return safeNumber((snapshot as Record<string, unknown>)[key], fallback);
}

function getScalarFeature(
  snapshot: ChatFeatureSnapshot | null,
  key: string,
  fallback = 0,
): number {
  const scalarFeatures = snapshot && isRecord((snapshot as Record<string, unknown>).scalarFeatures)
    ? ((snapshot as Record<string, unknown>).scalarFeatures as Record<string, unknown>)
    : null;

  if (!scalarFeatures) return getFeatureNumber(snapshot, key, fallback);
  return safeNumber(scalarFeatures[key], fallback);
}

function getSocialFeature(
  snapshot: ChatFeatureSnapshot | null,
  key: string,
  fallback = 0,
): number {
  const socialFeatures = snapshot && isRecord((snapshot as Record<string, unknown>).socialFeatures)
    ? ((snapshot as Record<string, unknown>).socialFeatures as Record<string, unknown>)
    : null;

  if (!socialFeatures) return fallback;
  return safeNumber(socialFeatures[key], fallback);
}

function getChannelShare(
  snapshot: ChatFeatureSnapshot | null,
  family:
    | 'channelViewShare01'
    | 'channelOutboundShare01'
    | 'channelInboundShare01'
    | 'channelDwellShare01'
    | 'channelSwitchShare01',
  channel: ChatVisibleChannel,
  fallback = 0,
): number {
  const channelFeatures = snapshot && isRecord((snapshot as Record<string, unknown>).channelFeatures)
    ? ((snapshot as Record<string, unknown>).channelFeatures as Record<string, unknown>)
    : null;

  if (!channelFeatures) return fallback;
  const shareMap = channelFeatures[family];
  if (!isRecord(shareMap)) return fallback;
  return safeNumber(shareMap[channel], fallback);
}

function getDiagnosticsString(
  snapshot: ChatFeatureSnapshot | null,
  key: 'pressureTier' | 'tickTier',
  fallback: string,
): string {
  const diagnostics = snapshot && isRecord((snapshot as Record<string, unknown>).diagnostics)
    ? ((snapshot as Record<string, unknown>).diagnostics as Record<string, unknown>)
    : null;

  if (!diagnostics) return fallback;
  return safeString(diagnostics[key], fallback);
}

function derivePressureTier(
  featureSnapshot: ChatFeatureSnapshot | null,
): ChatPressureTier {
  const raw = getDiagnosticsString(featureSnapshot, 'pressureTier', '');
  switch (raw) {
    case 'CALM':
    case 'BUILDING':
    case 'ELEVATED':
    case 'HIGH':
    case 'CRITICAL':
      return raw;
    default:
      return deriveChatFeaturePressureTier(featureSnapshot ?? ({} as ChatFeatureSnapshot));
  }
}

function deriveTickTier(
  featureSnapshot: ChatFeatureSnapshot | null,
): ChatTickTier {
  const raw = getDiagnosticsString(featureSnapshot, 'tickTier', '');
  switch (raw) {
    case 'SOVEREIGN':
    case 'STABLE':
    case 'COMPRESSED':
    case 'CRISIS':
    case 'COLLAPSE_IMMINENT':
      return raw;
    default:
      return deriveChatFeatureTickTier(featureSnapshot ?? ({} as ChatFeatureSnapshot));
  }
}

function summarizeFeatures(featureSnapshot: ChatFeatureSnapshot | null): string {
  if (!featureSnapshot) return 'feature:none';
  try {
    return summarizeChatFeatureSnapshot(featureSnapshot);
  } catch {
    return [
      `channel:${safeString((featureSnapshot as Record<string, unknown>).activeChannel, 'GLOBAL')}`,
      `eng:${getScalarFeature(featureSnapshot, 'engagement01', 0).toFixed(2)}`,
      `drop:${getScalarFeature(featureSnapshot, 'dropOffRisk01', 0).toFixed(2)}`,
      `helper:${getScalarFeature(featureSnapshot, 'helperNeed01', 0).toFixed(2)}`,
      `hater:${getScalarFeature(featureSnapshot, 'haterTolerance01', 0).toFixed(2)}`,
    ].join(' | ');
  }
}

function profilePreferredChannel(
  snapshot: ChatLearningBridgePublicSnapshot,
): ChatVisibleChannel {
  return normalizeVisibleChannel(snapshot.profile.preferredChannel, snapshot.activeChannel);
}

function resolveMountTarget(
  snapshot: ChatLearningBridgePublicSnapshot,
  featureSnapshot: ChatFeatureSnapshot | null,
): string | null {
  const mountFromFeature = safeString(
    featureSnapshot && (featureSnapshot as Record<string, unknown>).mountTarget,
    '',
  );

  if (mountFromFeature) return mountFromFeature;

  const maybeMount = snapshot.latestFeatureSnapshot &&
    isRecord(snapshot.latestFeatureSnapshot)
    ? safeString((snapshot.latestFeatureSnapshot as Record<string, unknown>).mountTarget, '')
    : '';

  return maybeMount || null;
}

function scorePressureDisposition(
  pressureTier: ChatPressureTier,
  tickTier: ChatTickTier,
  helperNeed01: number,
  haterTolerance01: number,
): ChatColdStartPressureDisposition {
  const risk =
    scoreByTier(
      pressureTier,
      {
        CALM: 0.06,
        BUILDING: 0.18,
        ELEVATED: 0.36,
        HIGH: 0.62,
        CRITICAL: 0.88,
      },
      0.20,
    ) * 0.56 +
    scoreByTier(
      tickTier,
      {
        SOVEREIGN: 0.02,
        STABLE: 0.10,
        COMPRESSED: 0.34,
        CRISIS: 0.60,
        COLLAPSE_IMMINENT: 0.86,
      },
      0.18,
    ) * 0.28 +
    clamp01(helperNeed01) * 0.10 +
    clamp01(1 - haterTolerance01) * 0.06;

  if (risk >= 0.74) return 'CONTAIN';
  if (risk >= 0.48) return 'STEADY';
  if (risk >= 0.28) return 'TEST';
  return 'ESCALATE';
}

function scoreByTier<T extends string>(
  tier: T | string,
  map: Record<T, number>,
  fallback: number,
): number {
  return safeNumber((map as Record<string, number>)[tier], fallback);
}

function mountTargetCategory(mountTarget: string | null): 'LOBBY' | 'BATTLE' | 'EMPIRE' | 'OTHER' {
  const lower = (mountTarget ?? '').toLowerCase();
  if (!lower) return 'OTHER';
  if (
    lower.includes('lobby') ||
    lower.includes('club') ||
    lower.includes('league')
  ) {
    return 'LOBBY';
  }

  if (
    lower.includes('battle') ||
    lower.includes('predator') ||
    lower.includes('phantom') ||
    lower.includes('hud')
  ) {
    return 'BATTLE';
  }

  if (
    lower.includes('empire') ||
    lower.includes('board') ||
    lower.includes('syndicate')
  ) {
    return 'EMPIRE';
  }

  return 'OTHER';
}

function createMountHint(
  mountTarget: string | null,
  options: ChatColdStartPolicyOptions,
): ChatColdStartMountHint | null {
  if (!mountTarget) return null;
  return (options.mountTargetHints?.[mountTarget] ??
    options.mountTargetHints?.[mountTarget.toLowerCase()] ??
    null) as ChatColdStartMountHint | null;
}

function chooseHelperPersonaHint(
  openingChannel: ChatVisibleChannel,
  helperUrgency01: number,
  confidence01: number,
  negotiationGuard01: number,
): ChatColdStartHelperPlan['helperPersonaHint'] {
  if (negotiationGuard01 >= 0.58) return 'ARCHIVIST';
  if (helperUrgency01 >= 0.72) return 'MENTOR';
  if (openingChannel === 'SYNDICATE') return 'INSIDER';
  if (openingChannel === 'LOBBY' && confidence01 < 0.44) return 'SURVIVOR';
  if (confidence01 >= 0.62) return 'RIVAL';
  return 'MENTOR';
}

function chooseHelperInterventionStyle(
  helperUrgency01: number,
  rescueNeed01: number,
  openingStyle: ChatColdStartOpeningStyle,
): ChatColdStartHelperPlan['interventionStyle'] {
  if (rescueNeed01 >= 0.72) return 'DIRECT_RESCUE';
  if (helperUrgency01 >= 0.64) return 'TACTICAL_ASSIST';
  if (openingStyle === 'SILENCE_FIRST') return 'QUIET_COMPANION';
  if (openingStyle === 'HELPER_SOFTEN') return 'SOFT_GUIDE';
  return 'DEBRIEF_READY';
}

function chooseIntrusionStyle(
  allowHaterEntry: boolean,
  haterCadence01: number,
  publicShameAllowed: boolean,
  crowdAssistAllowed: boolean,
): ChatColdStartHaterPlan['intrusionStyle'] {
  if (!allowHaterEntry || haterCadence01 <= 0.12) return 'NONE';
  if (haterCadence01 <= 0.28) return 'GLANCE';
  if (publicShameAllowed && crowdAssistAllowed && haterCadence01 >= 0.54) {
    return 'CROWD_POKE';
  }
  if (haterCadence01 >= 0.44) return 'CONTROLLED_INTRUSION';
  return 'TEST';
}

function openingStyleFromSignals(
  channel: ChatVisibleChannel,
  respectSilenceFirst: boolean,
  helperShouldPrime: boolean,
  allowHaterEntry: boolean,
  negotiationGuard01: number,
  pressureDisposition: ChatColdStartPressureDisposition,
  options: Required<
    Pick<
      ChatColdStartPolicyOptions,
      'allowSilenceFirst' | 'allowDealRoomOpenings' | 'allowStageTests'
    >
  >,
): ChatColdStartOpeningStyle {
  if (respectSilenceFirst && options.allowSilenceFirst) return 'SILENCE_FIRST';
  if (channel === 'DEAL_ROOM' && options.allowDealRoomOpenings && negotiationGuard01 >= 0.52) {
    return 'DEALROOM_GUARD';
  }
  if (channel === 'SYNDICATE') return 'SYNDICATE_GUIDE';
  if (helperShouldPrime) return 'HELPER_SOFTEN';
  if (allowHaterEntry && pressureDisposition === 'TEST' && options.allowStageTests) {
    return 'STAGE_TEST';
  }
  if (allowHaterEntry && pressureDisposition === 'ESCALATE') return 'HATER_PING';
  return 'SYSTEM_PRIMER';
}

function safeOpeningChannel(
  channel: ChatVisibleChannel,
  allowDealRoomOpenings: boolean,
): ChatVisibleChannel {
  if (channel === 'DEAL_ROOM' && !allowDealRoomOpenings) {
    return 'SYNDICATE';
  }
  return channel;
}

function buildExplanation(parts: readonly string[]): string {
  return parts.filter(Boolean).join(' | ');
}

/* ========================================================================== */
/* MARK: Seed-context derivation                                              */
/* ========================================================================== */

interface DerivedColdStartInputs {
  readonly profile: ChatColdStartProfile;
  readonly recommendation: ChatColdStartRecommendation;
  readonly heuristics: ChatColdStartHeuristicSnapshot;
  readonly pressureTier: ChatPressureTier;
  readonly tickTier: ChatTickTier;
  readonly featureSummary: string;
  readonly mountTarget: string | null;
  readonly coldWindow: boolean;
}

function deriveColdStartSeedContext(
  snapshot: ChatLearningBridgePublicSnapshot,
  featureSnapshot: ChatFeatureSnapshot | null,
  hint: ChatColdStartMountHint | null,
): ChatColdStartSeedContext {
  const profile = snapshot.profile;
  const activeChannel = snapshot.activeChannel;

  const helperNeed01 = getScalarFeature(featureSnapshot, 'helperNeed01', profile.helperNeed01);
  const haterTolerance01 = getScalarFeature(
    featureSnapshot,
    'haterTolerance01',
    profile.haterTolerance01,
  );
  const dropOffRisk01 = getScalarFeature(
    featureSnapshot,
    'dropOffRisk01',
    profile.dropOffRisk01,
  );
  const crowdStress01 = getSocialFeature(featureSnapshot, 'crowdStress01', 0.20);
  const quietRisk01 = getScalarFeature(featureSnapshot, 'quietness01', 0.24);

  const lowerPressureOpeningHint =
    hint?.lowerPressureBias ??
    (activeChannel === 'LOBBY' || activeChannel === 'SYNDICATE');

  const hintBiases = {
    helperFrequencyBias: clamp01(
      CHAT_COLD_START_DEFAULTS.helperFrequencyBias +
        helperNeed01 * 0.20 -
        haterTolerance01 * 0.06 +
        (hint?.helperLift ?? 0),
    ),
    haterAggressionBias: clamp01(
      CHAT_COLD_START_DEFAULTS.haterAggressionBias +
        haterTolerance01 * 0.22 +
        crowdStress01 * 0.08 -
        helperNeed01 * 0.10 +
        (hint?.haterLift ?? 0),
    ),
    negotiationRiskBias: clamp01(
      CHAT_COLD_START_DEFAULTS.negotiationRiskBias +
        getSocialFeature(featureSnapshot, 'negotiationExposure01', 0.16) * 0.16 +
        dropOffRisk01 * 0.06 +
        crowdStress01 * 0.04,
    ),
    crowdHeatTolerance: clamp01(
      CHAT_COLD_START_DEFAULTS.crowdHeatTolerance +
        getSocialFeature(featureSnapshot, 'audienceHeat01', 0.18) * 0.18 -
        getSocialFeature(featureSnapshot, 'embarrassmentRisk01', 0.12) * 0.10 +
        (hint?.pressureLift ?? 0) * 0.10,
    ),
    prefersLowerPressureOpenings: Boolean(
      lowerPressureOpeningHint ||
        quietRisk01 >= 0.52 ||
        dropOffRisk01 >= 0.54 ||
        getSocialFeature(featureSnapshot, 'embarrassmentRisk01', 0) >= 0.50,
    ),
  } as const;

  return {
    now: Date.now(),
    playerId: snapshot.userId,
    activeChannel: hint?.preferredOpeningChannel ?? activeChannel,
    featureSnapshot: featureSnapshot ?? undefined,
    hints: hintBiases,
  };
}

function deriveColdStartInputs(
  snapshot: ChatLearningBridgePublicSnapshot,
  options: ChatColdStartPolicyOptions,
): DerivedColdStartInputs {
  const featureSnapshot = getLatestFeatureSnapshot(snapshot);
  const mountTarget = resolveMountTarget(snapshot, featureSnapshot);
  const mountHint = createMountHint(mountTarget, options);
  const seedContext = deriveColdStartSeedContext(snapshot, featureSnapshot, mountHint);

  const profile = createChatColdStartProfile(seedContext);
  const mergedProfile =
    snapshot.profile.totalChatOpens > 0 && featureSnapshot
      ? mergeChatColdStartProfiles(profile, {
          helperFrequencyBias: clamp01(
            profile.helperFrequencyBias * 0.82 +
              getScalarFeature(featureSnapshot, 'helperNeed01', 0.24) * 0.18,
          ),
          haterAggressionBias: clamp01(
            profile.haterAggressionBias * 0.80 +
              getScalarFeature(featureSnapshot, 'haterTolerance01', 0.28) * 0.20,
          ),
          negotiationRiskBias: clamp01(
            profile.negotiationRiskBias * 0.86 +
              getSocialFeature(featureSnapshot, 'negotiationExposure01', 0.18) * 0.14,
          ),
          crowdHeatTolerance: clamp01(
            profile.crowdHeatTolerance * 0.84 +
              getSocialFeature(featureSnapshot, 'audienceHeat01', 0.22) * 0.16,
          ),
          prefersLowerPressureOpenings:
            profile.prefersLowerPressureOpenings ||
            getScalarFeature(featureSnapshot, 'rescueNeed01', 0.20) >= 0.48,
        })
      : profile;

  const recommendation = createChatColdStartRecommendation(mergedProfile, seedContext);
  const heuristics = computeChatColdStartHeuristics(seedContext);
  const pressureTier = derivePressureTier(featureSnapshot);
  const tickTier = deriveTickTier(featureSnapshot);
  const coldWindow = isColdWindow(snapshot);
  const featureSummary = summarizeFeatures(featureSnapshot);

  return {
    profile: mergedProfile,
    recommendation,
    heuristics,
    pressureTier,
    tickTier,
    featureSummary,
    mountTarget,
    coldWindow,
  };
}

/* ========================================================================== */
/* MARK: Policy implementation                                                */
/* ========================================================================== */

export class ChatColdStartPolicy
  implements ChatLearningBridgeInferencePort
{
  private readonly defaults: typeof CHAT_COLD_START_POLICY_DEFAULTS;
  private readonly options: Required<
    Pick<
      ChatColdStartPolicyOptions,
      | 'includeExplanationBreakdown'
      | 'allowSilenceFirst'
      | 'allowDealRoomOpenings'
      | 'allowStageTests'
    >
  > &
    Omit<
      ChatColdStartPolicyOptions,
      | 'includeExplanationBreakdown'
      | 'allowSilenceFirst'
      | 'allowDealRoomOpenings'
      | 'allowStageTests'
    >;

  constructor(options: ChatColdStartPolicyOptions = {}) {
    this.defaults = {
      ...CHAT_COLD_START_POLICY_DEFAULTS,
      ...(options.defaults ?? {}),
    };

    this.options = {
      ...options,
      includeExplanationBreakdown: options.includeExplanationBreakdown ?? true,
      allowSilenceFirst: options.allowSilenceFirst ?? true,
      allowDealRoomOpenings: options.allowDealRoomOpenings ?? false,
      allowStageTests: options.allowStageTests ?? true,
    };
  }

  public evaluate(
    snapshot: ChatLearningBridgePublicSnapshot,
  ): ChatColdStartPolicyDecision {
    const featureSnapshot = getLatestFeatureSnapshot(snapshot);
    const cold = deriveColdStartInputs(snapshot, this.options);
    const engagement = scoreChatEngagement(snapshot);
    const mountHint = createMountHint(cold.mountTarget, this.options);
    const activeChannel = snapshot.activeChannel;
    const preferredChannel = profilePreferredChannel(snapshot);
    const mountCategory = mountTargetCategory(cold.mountTarget);

    const pressureDisposition = scorePressureDisposition(
      cold.pressureTier,
      cold.tickTier,
      engagement.vector.helperUrgency01,
      getScalarFeature(featureSnapshot, 'haterTolerance01', snapshot.profile.haterTolerance01),
    );

    const respectSilenceFirst = Boolean(
      cold.recommendation.respectSilenceFirst &&
        this.options.allowSilenceFirst &&
        (cold.coldWindow ||
          engagement.vector.dropOffRisk01 >= this.defaults.silenceFirstThreshold ||
          getScalarFeature(featureSnapshot, 'quietness01', 0) >= this.defaults.silenceFirstThreshold),
    );

    const helperUrgency01 = asScore01(
      clamp01(
        cold.recommendation.helperCadence01 * 0.28 +
          engagement.vector.helperUrgency01 * 0.38 +
          engagement.vector.rescueNeed01 * 0.18 +
          cold.heuristics.helperNeed01 * 0.16,
      ),
    );

    const haterCadence01 = asScore01(
      clamp01(
        cold.recommendation.haterCadence01 * 0.34 +
          engagement.vector.haterAggression01 * 0.26 +
          cold.profile.haterAggressionBias * 0.18 +
          cold.heuristics.haterTolerance01 * 0.12 -
          engagement.vector.helperUrgency01 * 0.06 -
          (pressureDisposition === 'CONTAIN' ? this.defaults.earlyAggressionSuppression : 0),
      ),
    );

    const negotiationGuard01 = asScore01(
      clamp01(
        cold.recommendation.negotiationGuard01 * 0.34 +
          engagement.vector.negotiationGuard01 * 0.30 +
          cold.heuristics.negotiationGuard01 * 0.20 +
          getScalarFeature(featureSnapshot, 'dropOffRisk01', 0) * 0.08 +
          (activeChannel === 'DEAL_ROOM' ? 0.08 : 0),
      ),
    );

    const shouldDeflectDealRoom = Boolean(
      negotiationGuard01 >= this.defaults.dealRoomGuardThreshold &&
        (activeChannel === 'DEAL_ROOM' || cold.recommendation.openingChannel === 'DEAL_ROOM'),
    );

    const stageHeatLimit01 = asScore01(
      clamp01(
        cold.profile.crowdHeatTolerance * 0.30 +
          clamp01(1 - engagement.vector.shameSensitivity01) * 0.14 +
          clamp01(1 - engagement.vector.dropOffRisk01) * 0.10 +
          (mountCategory === 'BATTLE' ? this.defaults.mountPressureBattleBonus : 0) +
          (mountCategory === 'EMPIRE' ? this.defaults.mountPressureEmpireBonus : 0) -
          (mountCategory === 'LOBBY' ? this.defaults.mountPressureLobbyReduction : 0),
      ),
    );

    const crowdContainment01 = asScore01(
      clamp01(
        engagement.vector.dropOffRisk01 * 0.20 +
          engagement.vector.shameSensitivity01 * 0.18 +
          getSocialFeature(featureSnapshot, 'crowdStress01', 0) * 0.22 +
          clamp01(1 - stageHeatLimit01) * 0.16 +
          (activeChannel === 'GLOBAL' ? 0.12 : 0) +
          (mountCategory === 'BATTLE' ? 0.06 : 0),
      ),
    );

    const channelScores = this.computeOpeningChannelScores(
      snapshot,
      featureSnapshot,
      cold,
      engagement,
      {
        preferredChannel,
        activeChannel,
        shouldDeflectDealRoom,
        stageHeatLimit01,
        crowdContainment01,
        helperUrgency01,
      },
    );

    const recommendedChannel = pickBestChannel(channelScores);
    const openingChannel = safeOpeningChannel(
      shouldDeflectDealRoom ? 'SYNDICATE' : recommendedChannel,
      this.options.allowDealRoomOpenings,
    );

    const allowHaterEntry = Boolean(
      haterCadence01 >= this.defaults.haterSoftThreshold &&
        !respectSilenceFirst &&
        pressureDisposition !== 'CONTAIN' &&
        engagement.vector.rescueNeed01 < this.defaults.rescueLobbyShiftThreshold &&
        engagement.vector.shameSensitivity01 < 0.72,
    );

    const publicShameAllowed = Boolean(
      allowHaterEntry &&
        openingChannel === 'GLOBAL' &&
        crowdContainment01 < this.defaults.embarrassmentContainmentThreshold &&
        engagement.vector.shameSensitivity01 < 0.48 &&
        engagement.vector.confidence01 >= 0.50,
    );

    const crowdAssistAllowed = Boolean(
      publicShameAllowed &&
        stageHeatLimit01 >= 0.50 &&
        getSocialFeature(featureSnapshot, 'audienceHeat01', 0) >= 0.32 &&
        pressureDisposition !== 'CONTAIN',
    );

    const openingStyle = openingStyleFromSignals(
      openingChannel,
      respectSilenceFirst,
      helperUrgency01 >= this.defaults.helperSoftThreshold,
      allowHaterEntry,
      negotiationGuard01,
      pressureDisposition,
      this.options,
    );

    const sceneHints = uniqHints(
      [
        respectSilenceFirst ? 'QUIET_OBSERVE' : null,
        engagement.vector.rescueNeed01 >= this.defaults.rescueLobbyShiftThreshold
          ? 'RECOVERY_CUSHION'
          : null,
        openingChannel === 'GLOBAL' ? 'PUBLIC_STAGE' : null,
        openingChannel === 'DEAL_ROOM' || shouldDeflectDealRoom
          ? 'NEGOTIATION_CAUTION'
          : null,
        helperUrgency01 >= this.defaults.helperSoftThreshold ? 'HELPER_RAMP' : null,
        allowHaterEntry ? 'HATER_TEST' : 'HATER_RESTRAINT',
        crowdContainment01 >= this.defaults.crowdContainmentThreshold ? 'CROWD_SHIELD' : null,
        mountCategory === 'BATTLE' ? 'BATTLE_GUARD' : null,
        mountCategory === 'EMPIRE' ? 'EMPIRE_TENSION' : null,
        mountCategory === 'LOBBY' ? 'LOBBY_SOFT_START' : null,
        engagement.vector.legendMomentum01 >= 0.54 ? 'COMEBACK_SPACE' : null,
        mountHint?.sceneHint ?? null,
      ].filter(Boolean) as ChatColdStartSceneHint[],
    );

    const openingPlan: ChatColdStartOpeningPlan = Object.freeze({
      openingChannel,
      openingStyle,
      pressureDisposition,
      respectSilenceFirst,
      silenceHoldMs: clampMs(
        (respectSilenceFirst ? 4_200 : 1_200) +
          engagement.vector.dropOffRisk01 * 3_600 +
          crowdContainment01 * 2_200 +
          (mountCategory === 'BATTLE' ? 1_000 : 0),
        500,
        12_000,
      ),
      initialMessageDelayMs: clampMs(
        700 +
          helperUrgency01 * 1_400 +
          (respectSilenceFirst ? 1_600 : 0) +
          (allowHaterEntry ? 300 : 0),
        180,
        5_600,
      ),
      sceneHints,
    });

    const helperPlan: ChatColdStartHelperPlan = Object.freeze({
      shouldPrime:
        helperUrgency01 >= this.defaults.helperSoftThreshold ||
        openingStyle === 'HELPER_SOFTEN' ||
        openingStyle === 'SYNDICATE_GUIDE',
      helperCadence01: asScore01(
        Math.max(
          this.defaults.helperCadenceFloor,
          Math.min(this.defaults.helperCadenceCeiling, helperUrgency01),
        ),
      ),
      helperUrgency01,
      helperHoldMs: clampMs(
        openingStyle === 'SILENCE_FIRST'
          ? 2_400 + helperUrgency01 * 1_600
          : 1_000 + helperUrgency01 * 1_200,
        320,
        5_000,
      ),
      helperEscalationMs: clampMs(
        5_600 -
          helperUrgency01 * 2_600 -
          engagement.vector.rescueNeed01 * 1_800 +
          crowdContainment01 * 1_000,
        1_400,
        7_200,
      ),
      helperPersonaHint: chooseHelperPersonaHint(
        openingChannel,
        helperUrgency01,
        engagement.vector.confidence01,
        negotiationGuard01,
      ),
      interventionStyle: chooseHelperInterventionStyle(
        helperUrgency01,
        engagement.vector.rescueNeed01,
        openingStyle,
      ),
    });

    const haterPlan: ChatColdStartHaterPlan = Object.freeze({
      allowHaterEntry,
      haterCadence01: asScore01(
        Math.max(
          this.defaults.haterCadenceFloor,
          Math.min(
            Math.min(this.defaults.haterCadenceCeiling, this.defaults.earlyToleranceCap),
            haterCadence01,
          ),
        ),
      ),
      haterAggressionCap01: asScore01(
        clamp01(
          Math.min(
            this.defaults.earlyToleranceCap,
            engagement.vector.haterAggression01 -
              (respectSilenceFirst ? 0.10 : 0) -
              helperUrgency01 * 0.10 -
              crowdContainment01 * 0.08,
          ),
        ),
      ),
      haterFirstPingDelayMs: clampMs(
        (allowHaterEntry ? 2_200 : 5_600) +
          helperUrgency01 * 1_200 +
          (respectSilenceFirst ? 1_800 : 0) +
          (openingChannel === 'GLOBAL' ? 0 : 800),
        800,
        9_000,
      ),
      crowdAssistAllowed,
      publicShameAllowed,
      intrusionStyle: chooseIntrusionStyle(
        allowHaterEntry,
        haterCadence01,
        publicShameAllowed,
        crowdAssistAllowed,
      ),
    });

    const negotiationPlan: ChatColdStartNegotiationPlan = Object.freeze({
      guard01: asScore01(
        Math.max(
          this.defaults.negotiationGuardFloor,
          Math.min(this.defaults.negotiationGuardCeiling, negotiationGuard01),
        ),
      ),
      shouldDeflectDealRoom,
      shouldWarnAgainstOverexposure: Boolean(
        negotiationGuard01 >= 0.56 ||
          getSocialFeature(featureSnapshot, 'negotiationExposure01', 0.18) >= 0.46,
      ),
      preferredCounterChannel:
        negotiationGuard01 >= this.defaults.dealRoomGuardThreshold ? 'SYNDICATE' : openingChannel,
      offerFrictionLift01: asScore01(
        clamp01(
          negotiationGuard01 * 0.62 +
            engagement.vector.dropOffRisk01 * 0.18 +
            engagement.vector.shameSensitivity01 * 0.10 +
            crowdContainment01 * 0.10,
        ),
      ),
      explanation: buildExplanation([
        `guard:${negotiationGuard01.toFixed(2)}`,
        shouldDeflectDealRoom ? 'deal:deflect' : 'deal:open',
        `counter:${negotiationGuard01 >= this.defaults.dealRoomGuardThreshold ? 'SYNDICATE' : openingChannel}`,
      ]),
    });

    const presencePlan: ChatColdStartPresencePlan = Object.freeze({
      stageHeatLimit01,
      crowdContainment01,
      readDelayMs: clampMs(
        380 +
          crowdContainment01 * 820 +
          (respectSilenceFirst ? 420 : 0) +
          (openingChannel === 'GLOBAL' ? 180 : 0),
        120,
        2_000,
      ),
      typingDelayMs: clampMs(
        500 +
          helperUrgency01 * 600 +
          (allowHaterEntry ? 120 : 0) +
          (openingStyle === 'SILENCE_FIRST' ? 280 : 0),
        160,
        1_800,
      ),
      allowAmbientTypingTheater: Boolean(
        !respectSilenceFirst &&
          crowdContainment01 < this.defaults.crowdContainmentThreshold &&
          openingStyle !== 'DEALROOM_GUARD',
      ),
      explanation: buildExplanation([
        `stage:${stageHeatLimit01.toFixed(2)}`,
        `contain:${crowdContainment01.toFixed(2)}`,
        `typing:${openingStyle === 'SILENCE_FIRST' ? 'delayed' : 'normal'}`,
      ]),
    });

    const bridgeRecommendation: ChatLearningBridgeRecommendation = Object.freeze({
      recommendedChannel: openingChannel,
      helperUrgency01: helperPlan.helperUrgency01,
      rescueNeeded: engagement.vector.rescueNeed01 >= this.defaults.rescueLobbyShiftThreshold,
      haterAggression01: haterPlan.haterAggressionCap01,
      dropOffRisk01: engagement.vector.dropOffRisk01,
      explanation: buildExplanation([
        `open:${openingChannel}`,
        `style:${openingStyle}`,
        `helper:${helperPlan.helperUrgency01.toFixed(2)}`,
        `hater:${haterPlan.haterAggressionCap01.toFixed(2)}`,
        `deal:${negotiationPlan.guard01.toFixed(2)}`,
        respectSilenceFirst ? 'silence:first' : 'silence:reactive',
      ]),
    });

    const profilePatch: Partial<ChatLearningBridgeProfileState> = {
      preferredChannel: openingChannel,
      engagement01: asScore01(
        lerp01(
          snapshot.profile.engagement01,
          engagement.vector.engagement01,
          this.defaults.profileSmoothingAlpha,
        ),
      ),
      dropOffRisk01: asScore01(
        lerp01(
          snapshot.profile.dropOffRisk01,
          engagement.vector.dropOffRisk01,
          this.defaults.profileSmoothingAlpha,
        ),
      ),
      helperNeed01: asScore01(
        lerp01(
          snapshot.profile.helperNeed01,
          helperPlan.helperUrgency01,
          this.defaults.profileSmoothingAlpha,
        ),
      ),
      haterTolerance01: asScore01(
        lerp01(
          snapshot.profile.haterTolerance01,
          clamp01(
            haterPlan.haterAggressionCap01 * 0.56 +
              clamp01(1 - engagement.vector.shameSensitivity01) * 0.22 +
              stageHeatLimit01 * 0.22,
          ),
          this.defaults.profileSmoothingAlpha,
        ),
      ),
      shameSensitivity01: asScore01(
        lerp01(
          snapshot.profile.shameSensitivity01,
          engagement.vector.shameSensitivity01,
          this.defaults.profileSmoothingAlpha,
        ),
      ),
      confidence01: asScore01(
        lerp01(
          snapshot.profile.confidence01,
          engagement.vector.confidence01,
          this.defaults.profileSmoothingAlpha,
        ),
      ),
      typingCommitment01: asScore01(
        lerp01(
          snapshot.profile.typingCommitment01,
          getScalarFeature(featureSnapshot, 'composerCommitment01', snapshot.profile.typingCommitment01),
          this.defaults.profileSmoothingAlpha,
        ),
      ),
      rescueNeed01: asScore01(
        lerp01(
          snapshot.profile.rescueNeed01,
          engagement.vector.rescueNeed01,
          this.defaults.profileSmoothingAlpha,
        ),
      ),
      globalAffinity01: asScore01(
        lerp01(
          snapshot.profile.globalAffinity01,
          channelScores.GLOBAL,
          this.defaults.channelAffinitySmoothingAlpha,
        ),
      ),
      syndicateAffinity01: asScore01(
        lerp01(
          snapshot.profile.syndicateAffinity01,
          channelScores.SYNDICATE,
          this.defaults.channelAffinitySmoothingAlpha,
        ),
      ),
      dealRoomAffinity01: asScore01(
        lerp01(
          snapshot.profile.dealRoomAffinity01,
          channelScores.DEAL_ROOM,
          this.defaults.channelAffinitySmoothingAlpha,
        ),
      ),
    };

    const explanation = buildExplanation([
      `open:${openingChannel}`,
      `style:${openingStyle}`,
      `pressure:${cold.pressureTier}`,
      `tick:${cold.tickTier}`,
      `cold:${cold.recommendation.explanation}`,
      `eng:${engagement.explanation}`,
      `mount:${cold.mountTarget ?? 'none'}`,
    ]);

    const breakdown: ChatColdStartPolicyBreakdown = Object.freeze({
      moduleName: CHAT_COLD_START_POLICY_MODULE_NAME,
      moduleVersion: CHAT_COLD_START_POLICY_VERSION,
      bridgeModuleName: CHAT_LEARNING_BRIDGE_MODULE_NAME,
      bridgeModuleVersion: CHAT_LEARNING_BRIDGE_VERSION,
      pressureTier: cold.pressureTier,
      tickTier: cold.tickTier,
      mountTarget: cold.mountTarget,
      coldWindow: cold.coldWindow,
      heuristics: cold.heuristics,
      channelScores,
      featureSummary: cold.featureSummary,
      explanation,
    });

    return Object.freeze({
      profile: cold.profile,
      recommendation: cold.recommendation,
      engagement,
      openingPlan,
      helperPlan,
      haterPlan,
      negotiationPlan,
      presencePlan,
      recommendedChannel: openingChannel,
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

  public computeOpeningChannelScores(
    snapshot: ChatLearningBridgePublicSnapshot,
    featureSnapshot: ChatFeatureSnapshot | null,
    cold: DerivedColdStartInputs,
    engagement: ChatEngagementScoreResult,
    state: {
      preferredChannel: ChatVisibleChannel;
      activeChannel: ChatVisibleChannel;
      shouldDeflectDealRoom: boolean;
      stageHeatLimit01: number;
      crowdContainment01: number;
      helperUrgency01: number;
    },
  ): ChatChannelRecommendationScores {
    const scores = ensureChannelScores(0);
    const mountCategory = mountTargetCategory(cold.mountTarget);

    scores.GLOBAL = asScore01(
      clamp01(
        snapshot.profile.globalAffinity01 * 0.22 +
          getChannelShare(featureSnapshot, 'channelViewShare01', 'GLOBAL', 0) * 0.08 +
          getChannelShare(featureSnapshot, 'channelOutboundShare01', 'GLOBAL', 0) * 0.08 +
          engagement.vector.engagement01 * 0.12 +
          engagement.vector.haterAggression01 * 0.10 +
          engagement.vector.legendMomentum01 * 0.08 +
          state.stageHeatLimit01 * 0.08 +
          cold.profile.crowdHeatTolerance * 0.08 +
          (cold.recommendation.openingChannel === 'GLOBAL'
            ? this.defaults.preferredChannelBias
            : 0) +
          (state.preferredChannel === 'GLOBAL' ? this.defaults.preferredChannelBias : 0) +
          (state.activeChannel === 'GLOBAL' ? this.defaults.activeChannelBias : 0) -
          state.crowdContainment01 * this.defaults.globalStagePenalty -
          (mountCategory === 'LOBBY' ? 0.06 : 0),
      ),
    );

    scores.SYNDICATE = asScore01(
      clamp01(
        snapshot.profile.syndicateAffinity01 * 0.24 +
          getChannelShare(featureSnapshot, 'channelViewShare01', 'SYNDICATE', 0) * 0.10 +
          getChannelShare(featureSnapshot, 'channelOutboundShare01', 'SYNDICATE', 0) * 0.08 +
          state.helperUrgency01 * 0.12 +
          clamp01(1 - state.crowdContainment01) * 0.08 +
          clamp01(1 - engagement.vector.socialPressure01) * 0.10 +
          cold.profile.helperFrequencyBias * 0.08 +
          (cold.recommendation.openingChannel === 'SYNDICATE'
            ? this.defaults.preferredChannelBias
            : 0) +
          (state.preferredChannel === 'SYNDICATE' ? this.defaults.preferredChannelBias : 0) +
          (state.activeChannel === 'SYNDICATE' ? this.defaults.activeChannelBias : 0) +
          (mountCategory === 'EMPIRE' ? 0.06 : 0) +
          this.defaults.syndicateSafetyBias,
      ),
    );

    scores.DEAL_ROOM = asScore01(
      clamp01(
        snapshot.profile.dealRoomAffinity01 * 0.24 +
          getChannelShare(featureSnapshot, 'channelViewShare01', 'DEAL_ROOM', 0) * 0.10 +
          getChannelShare(featureSnapshot, 'channelOutboundShare01', 'DEAL_ROOM', 0) * 0.08 +
          engagement.vector.negotiationGuard01 * 0.12 +
          getSocialFeature(featureSnapshot, 'negotiationExposure01', 0) * 0.12 +
          cold.profile.negotiationRiskBias * 0.08 +
          (cold.recommendation.openingChannel === 'DEAL_ROOM'
            ? this.defaults.preferredChannelBias
            : 0) +
          (state.preferredChannel === 'DEAL_ROOM' ? this.defaults.preferredChannelBias : 0) +
          (state.activeChannel === 'DEAL_ROOM' ? this.defaults.activeChannelBias : 0) -
          (state.shouldDeflectDealRoom ? this.defaults.dealRoomPenalty : 0) -
          state.crowdContainment01 * 0.04,
      ),
    );

    scores.LOBBY = asScore01(
      clamp01(
        0.14 +
          getChannelShare(featureSnapshot, 'channelViewShare01', 'LOBBY', 0) * 0.12 +
          getChannelShare(featureSnapshot, 'channelOutboundShare01', 'LOBBY', 0) * 0.08 +
          state.helperUrgency01 * 0.12 +
          engagement.vector.rescueNeed01 * 0.16 +
          clamp01(1 - engagement.vector.socialPressure01) * 0.10 +
          clamp01(1 - engagement.vector.dropOffRisk01) * 0.08 +
          (cold.profile.prefersLowerPressureOpenings
            ? this.defaults.lowerPressureOpeningBias
            : 0) +
          (engagement.vector.confidence01 < 0.42
            ? this.defaults.lowConfidenceLobbyBias
            : 0) +
          (cold.recommendation.openingChannel === 'LOBBY'
            ? this.defaults.preferredChannelBias
            : 0) +
          (state.preferredChannel === 'LOBBY' ? this.defaults.preferredChannelBias : 0) +
          (state.activeChannel === 'LOBBY' ? this.defaults.activeChannelBias : 0) +
          this.defaults.lobbySafetyBias,
      ),
    );

    if (
      engagement.vector.rescueNeed01 >= this.defaults.rescueLobbyShiftThreshold ||
      state.crowdContainment01 >= this.defaults.crowdContainmentThreshold
    ) {
      scores.GLOBAL = asScore01(clamp01(scores.GLOBAL - 0.08));
      scores.LOBBY = asScore01(clamp01(scores.LOBBY + 0.08));
      scores.SYNDICATE = asScore01(clamp01(scores.SYNDICATE + 0.04));
    }

    if (state.shouldDeflectDealRoom) {
      scores.DEAL_ROOM = asScore01(clamp01(scores.DEAL_ROOM - 0.10));
      scores.SYNDICATE = asScore01(clamp01(scores.SYNDICATE + 0.06));
    }

    if (
      cold.profile.haterAggressionBias >= 0.60 &&
      cold.profile.crowdHeatTolerance >= 0.56 &&
      engagement.vector.confidence01 >= 0.56 &&
      engagement.vector.rescueNeed01 < 0.44
    ) {
      scores.GLOBAL = asScore01(clamp01(scores.GLOBAL + 0.05));
    }

    if (mountCategory === 'BATTLE') {
      scores.GLOBAL = asScore01(clamp01(scores.GLOBAL + 0.04));
      scores.LOBBY = asScore01(clamp01(scores.LOBBY - 0.04));
    }

    if (mountCategory === 'LOBBY') {
      scores.LOBBY = asScore01(clamp01(scores.LOBBY + 0.06));
      scores.GLOBAL = asScore01(clamp01(scores.GLOBAL - 0.04));
    }

    return scores;
  }
}

/* ========================================================================== */
/* MARK: Public helpers                                                       */
/* ========================================================================== */

export function createChatColdStartPolicy(
  options: ChatColdStartPolicyOptions = {},
): ChatColdStartPolicy {
  return new ChatColdStartPolicy(options);
}

export function evaluateChatColdStartPolicy(
  snapshot: ChatLearningBridgePublicSnapshot,
  options: ChatColdStartPolicyOptions = {},
): ChatColdStartPolicyDecision {
  return createChatColdStartPolicy(options).evaluate(snapshot);
}

export function recommendChatColdStartPolicy(
  snapshot: ChatLearningBridgePublicSnapshot,
  options: ChatColdStartPolicyOptions = {},
): ChatLearningBridgeRecommendation {
  return createChatColdStartPolicy(options).recommend(snapshot);
}

export function refineChatColdStartProfileState(
  snapshot: ChatLearningBridgePublicSnapshot,
  options: ChatColdStartPolicyOptions = {},
): Partial<ChatLearningBridgeProfileState> {
  return createChatColdStartPolicy(options).refineProfile(snapshot);
}

export function buildColdStartBootstrapBundle(
  snapshot: ChatLearningBridgePublicSnapshot,
  options: ChatColdStartPolicyOptions = {},
): {
  readonly coldStartVersion: typeof CHAT_COLD_START_PROFILE_VERSION;
  readonly bridgeModule: typeof CHAT_LEARNING_BRIDGE_MODULE_NAME;
  readonly bridgeVersion: typeof CHAT_LEARNING_BRIDGE_VERSION;
  readonly policyModule: typeof CHAT_COLD_START_POLICY_MODULE_NAME;
  readonly policyVersion: typeof CHAT_COLD_START_POLICY_VERSION;
  readonly decision: ChatColdStartPolicyDecision;
} {
  return Object.freeze({
    coldStartVersion: CHAT_COLD_START_PROFILE_VERSION,
    bridgeModule: CHAT_LEARNING_BRIDGE_MODULE_NAME,
    bridgeVersion: CHAT_LEARNING_BRIDGE_VERSION,
    policyModule: CHAT_COLD_START_POLICY_MODULE_NAME,
    policyVersion: CHAT_COLD_START_POLICY_VERSION,
    decision: evaluateChatColdStartPolicy(snapshot, options),
  });
}

export const CHAT_COLD_START_POLICY_NAMESPACE = Object.freeze({
  moduleName: CHAT_COLD_START_POLICY_MODULE_NAME,
  version: CHAT_COLD_START_POLICY_VERSION,
  runtimeLaws: CHAT_COLD_START_POLICY_RUNTIME_LAWS,
  defaults: CHAT_COLD_START_POLICY_DEFAULTS,
  create: createChatColdStartPolicy,
  evaluate: evaluateChatColdStartPolicy,
  recommend: recommendChatColdStartPolicy,
  refineProfile: refineChatColdStartProfileState,
  buildBootstrapBundle: buildColdStartBootstrapBundle,
} as const);

export default ChatColdStartPolicy;
