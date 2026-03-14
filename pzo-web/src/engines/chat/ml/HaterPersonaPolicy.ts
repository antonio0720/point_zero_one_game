// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/chat/intelligence/ml/HaterPersonaPolicy.ts

/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT ML HATER PERSONA POLICY
 * FILE: pzo-web/src/engines/chat/intelligence/ml/HaterPersonaPolicy.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical frontend hater persona selection, targeting, pacing, and channel-fit
 * policy for the unified chat intelligence lane.
 *
 * The repo already implies that hater authority is fragmented across frontend
 * battle lanes, backend battle lanes, legacy chat kernels, and an extra ML
 * controller donor path. This file is the compile-safe frontend policy seam
 * that consolidates persona reasoning without pretending the client is final
 * transcript truth.
 *
 * It owns:
 * - persona registry and aliases,
 * - visible-channel fit scoring,
 * - aggression / cadence shaping,
 * - shame-safe vs public-stage attack posture,
 * - opening attack-style selection,
 * - helper-suppression hints,
 * - first-contact restraint,
 * - bridge-safe recommendation and profile refinement,
 * - persona decision payloads that later planners can consume.
 *
 * It does NOT own:
 * - final transcript truth,
 * - moderation authority,
 * - durable backend targeting memory,
 * - authoritative shadow-channel reveals,
 * - server-side raid scheduling.
 *
 * Permanent doctrine
 * ------------------
 * - Persona selection must feel authored before it feels complex.
 * - Haters escalate based on tolerance, context, and stage fit — not random RNG.
 * - Early contact may test; it should not immediately grief.
 * - Shame-sensitive players require controlled public exposure.
 * - Deal-room pressure is predatory and private; global pressure is theatrical.
 * - Rival memory belongs to the long-term system, but frontend still needs
 *   immediate persona posture to keep the run alive.
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
  CHAT_LEARNING_PROFILE_HATER_SEED_IDS,
} from '../ChatLearningProfile';

import {
  evaluateChatColdStartPolicy,
  type ChatColdStartPolicyDecision,
} from './ColdStartPolicy';

import {
  scoreChatEngagement,
  type ChatEngagementScoreResult,
} from './EngagementScorer';

import {
  deriveChatFeaturePressureTier,
  deriveChatFeatureTickTier,
  summarizeChatFeatureSnapshot,
  type ChatPressureTier,
  type ChatTickTier,
} from './FeatureExtractor';

/* ========================================================================== */
/* MARK: Public module constants                                              */
/* ========================================================================== */

export const CHAT_HATER_PERSONA_POLICY_MODULE_NAME =
  'PZO_CHAT_HATER_PERSONA_POLICY' as const;

export const CHAT_HATER_PERSONA_POLICY_VERSION =
  '2026.03.13-hater-persona-policy.v1' as const;

export const CHAT_HATER_PERSONA_POLICY_RUNTIME_LAWS = Object.freeze([
  'Personas are stable identities, not random labels.',
  'Public shame is a permissioned posture, not a default move.',
  'Cadence rises with tolerance and stage fit, not just with heat.',
  'Helper urgency can suppress hater intrusion without erasing persona continuity.',
  'Deal-room pressure stays psychologically distinct from crowd-stage pressure.',
  'Cold-start windows cap aggression even when targeting fit is high.',
  'Every persona decision should be explainable from live state and persona registry.',
  'Frontend persona policy remains advisory until backend authority responds.',
  'Registry IDs must remain import-stable across migration phases.',
  'Extended metadata may grow; core persona semantics must remain recognizable.',
] as const);

export const CHAT_HATER_PERSONA_POLICY_DEFAULTS = Object.freeze({
  targetingSmoothingAlpha: 0.12,
  haterToleranceFloor: 0.14,
  haterToleranceCeiling: 0.92,
  aggressionFloor: 0.08,
  aggressionCeiling: 0.92,
  cadenceFloor: 0.08,
  cadenceCeiling: 0.88,
  globalSwarmThreshold: 0.58,
  publicShameThreshold: 0.48,
  helperSuppressionThreshold: 0.64,
  rescueSuppressionThreshold: 0.62,
  dropRiskSuppressionThreshold: 0.66,
  coldWindowAggressionCap: 0.72,
  coldWindowCadenceCap: 0.68,
  dealRoomSilenceBias: 0.08,
  syndicateProbeBias: 0.06,
  globalTheaterBias: 0.08,
  embarrassmentSafetyPenalty: 0.10,
  lowConfidencePenalty: 0.08,
  stageHeatBonus: 0.08,
  pressureEscalationBonus: 0.08,
  crisisProphecyBonus: 0.12,
  legendMomentumTauntBonus: 0.08,
  helperPresenceDampener: 0.14,
  neutralReadDelayMs: 780,
  maxReadDelayMs: 3_400,
  minReadDelayMs: 120,
  neutralTypingDelayMs: 480,
  maxTypingDelayMs: 2_600,
  minTypingDelayMs: 100,
  neutralFirstPingMs: 2_800,
  maxFirstPingMs: 9_000,
  minFirstPingMs: 280,
} as const);

/* ========================================================================== */
/* MARK: Public contracts                                                     */
/* ========================================================================== */

export type ChatHaterPersonaId =
  | 'BOT_01_LIQUIDATOR'
  | 'BOT_02_BUREAUCRAT'
  | 'BOT_03_MANIPULATOR'
  | 'BOT_04_CRASH_PROPHET'
  | 'BOT_05_LEGACY_HEIR';

export type ChatHaterPersonaArchetype =
  | 'PREDATOR'
  | 'INSPECTOR'
  | 'TRICKSTER'
  | 'DOOM_SPEAKER'
  | 'ARISTOCRAT';

export type ChatHaterAttackStyle =
  | 'LIQUIDATION_PING'
  | 'RULE_TRAP'
  | 'SHAME_NEEDLE'
  | 'PROPHECY_DROP'
  | 'STATUS_CUT'
  | 'DEALROOM_PRESSURE'
  | 'CROWD_PROBE'
  | 'QUIET_WATCH';

export type ChatHaterPosture =
  | 'SUPPRESSED'
  | 'GLANCING'
  | 'TESTING'
  | 'PRESSURING'
  | 'SWARMING';

export interface ChatHaterVoiceprint {
  readonly sentencePace:
    | 'CLIPPED'
    | 'FORMAL'
    | 'VELVET'
    | 'ORACULAR'
    | 'CUTTING';
  readonly punctuationSignature: readonly string[];
  readonly slangLevel01: Score01;
  readonly cruelty01: Score01;
  readonly theatricality01: Score01;
  readonly delayDiscipline01: Score01;
  readonly quoteRecall01: Score01;
}

export interface ChatHaterCadenceProfile {
  readonly probeCadence01: Score01;
  readonly pressureCadence01: Score01;
  readonly swarmCadence01: Score01;
  readonly readDelayMs: number;
  readonly typingDelayMs: number;
  readonly firstPingDelayMs: number;
}

export interface ChatHaterChannelAffinity {
  readonly GLOBAL: Score01;
  readonly SYNDICATE: Score01;
  readonly DEAL_ROOM: Score01;
  readonly LOBBY: Score01;
}

export interface ChatHaterPressureAffinity {
  readonly CALM: Score01;
  readonly BUILDING: Score01;
  readonly ELEVATED: Score01;
  readonly HIGH: Score01;
  readonly CRITICAL: Score01;
}

export interface ChatHaterTickAffinity {
  readonly SOVEREIGN: Score01;
  readonly STABLE: Score01;
  readonly COMPRESSED: Score01;
  readonly CRISIS: Score01;
  readonly COLLAPSE_IMMINENT: Score01;
}

export interface ChatHaterPersonaSpec {
  readonly id: ChatHaterPersonaId;
  readonly archetype: ChatHaterPersonaArchetype;
  readonly displayName: string;
  readonly summary: string;
  readonly signatureOpener: string;
  readonly signatureCloser: string;
  readonly preferredAttackStyles: readonly ChatHaterAttackStyle[];
  readonly voiceprint: ChatHaterVoiceprint;
  readonly cadence: ChatHaterCadenceProfile;
  readonly channelAffinity: ChatHaterChannelAffinity;
  readonly pressureAffinity: ChatHaterPressureAffinity;
  readonly tickAffinity: ChatHaterTickAffinity;
  readonly crowdTheaterAffinity01: Score01;
  readonly negotiationAffinity01: Score01;
  readonly shameTargeting01: Score01;
  readonly comebackPunish01: Score01;
  readonly rescueCounterAffinity01: Score01;
  readonly helperSuppression01: Score01;
}

export interface ChatHaterPersonaTargetScore {
  readonly personaId: ChatHaterPersonaId;
  readonly fit01: Score01;
  readonly aggression01: Score01;
  readonly cadence01: Score01;
  readonly channel: ChatVisibleChannel;
  readonly posture: ChatHaterPosture;
  readonly primaryAttackStyle: ChatHaterAttackStyle;
  readonly shouldUseCrowdAssist: boolean;
  readonly shouldUsePublicShame: boolean;
  readonly shouldSuppressHelper: boolean;
  readonly explanation: string;
}

export interface ChatHaterPersonaPolicyBreakdown {
  readonly moduleName: typeof CHAT_HATER_PERSONA_POLICY_MODULE_NAME;
  readonly moduleVersion: typeof CHAT_HATER_PERSONA_POLICY_VERSION;
  readonly bridgeModuleName: typeof CHAT_LEARNING_BRIDGE_MODULE_NAME;
  readonly bridgeModuleVersion: typeof CHAT_LEARNING_BRIDGE_VERSION;
  readonly pressureTier: ChatPressureTier;
  readonly tickTier: ChatTickTier;
  readonly featureSummary: string;
  readonly coldWindow: boolean;
  readonly chosenPersonaId: ChatHaterPersonaId;
  readonly explanation: string;
}

export interface ChatHaterPersonaDecision {
  readonly persona: ChatHaterPersonaSpec;
  readonly score: ChatHaterPersonaTargetScore;
  readonly ranked: readonly ChatHaterPersonaTargetScore[];
  readonly bridgeRecommendation: ChatLearningBridgeRecommendation;
  readonly profilePatch: Partial<ChatLearningBridgeProfileState>;
  readonly attackWindow: {
    readonly readDelayMs: number;
    readonly typingDelayMs: number;
    readonly firstPingDelayMs: number;
  };
  readonly breakdown: ChatHaterPersonaPolicyBreakdown;
}

export interface ChatHaterPersonaPolicyOptions {
  readonly defaults?: Partial<typeof CHAT_HATER_PERSONA_POLICY_DEFAULTS>;
  readonly registry?: readonly ChatHaterPersonaSpec[];
  readonly includeExplanationBreakdown?: boolean;
  readonly allowCrowdAssist?: boolean;
  readonly allowPublicShame?: boolean;
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

function clampMs(value: number, floor: number, ceiling: number): number {
  if (!Number.isFinite(value)) return floor;
  return Math.max(floor, Math.min(ceiling, Math.round(value)));
}

function scoreByTier<T extends string>(
  tier: T | string,
  map: Record<T, number>,
  fallback: number,
): number {
  return safeNumber((map as Record<string, number>)[tier], fallback);
}

function getLatestFeatureSnapshot(
  snapshot: ChatLearningBridgePublicSnapshot,
): ChatFeatureSnapshot | null {
  const candidate = snapshot.latestFeatureSnapshot;
  return candidate && isRecord(candidate) ? (candidate as ChatFeatureSnapshot) : null;
}

function getScalarFeature(
  snapshot: ChatFeatureSnapshot | null,
  key: string,
  fallback = 0,
): number {
  const scalarFeatures = snapshot && isRecord((snapshot as Record<string, unknown>).scalarFeatures)
    ? ((snapshot as Record<string, unknown>).scalarFeatures as Record<string, unknown>)
    : null;

  if (!scalarFeatures) {
    return snapshot && isRecord(snapshot)
      ? safeNumber((snapshot as Record<string, unknown>)[key], fallback)
      : fallback;
  }

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
  snapshot: ChatFeatureSnapshot | null,
): ChatPressureTier {
  const raw = getDiagnosticsString(snapshot, 'pressureTier', '');
  switch (raw) {
    case 'CALM':
    case 'BUILDING':
    case 'ELEVATED':
    case 'HIGH':
    case 'CRITICAL':
      return raw;
    default:
      return deriveChatFeaturePressureTier(snapshot ?? ({} as ChatFeatureSnapshot));
  }
}

function deriveTickTier(
  snapshot: ChatFeatureSnapshot | null,
): ChatTickTier {
  const raw = getDiagnosticsString(snapshot, 'tickTier', '');
  switch (raw) {
    case 'SOVEREIGN':
    case 'STABLE':
    case 'COMPRESSED':
    case 'CRISIS':
    case 'COLLAPSE_IMMINENT':
      return raw;
    default:
      return deriveChatFeatureTickTier(snapshot ?? ({} as ChatFeatureSnapshot));
  }
}

function summarizeFeatures(snapshot: ChatFeatureSnapshot | null): string {
  if (!snapshot) return 'feature:none';
  try {
    return summarizeChatFeatureSnapshot(snapshot);
  } catch {
    return [
      `eng:${getScalarFeature(snapshot, 'engagement01', 0).toFixed(2)}`,
      `drop:${getScalarFeature(snapshot, 'dropOffRisk01', 0).toFixed(2)}`,
      `helper:${getScalarFeature(snapshot, 'helperNeed01', 0).toFixed(2)}`,
      `hater:${getScalarFeature(snapshot, 'haterTolerance01', 0).toFixed(2)}`,
      `heat:${getSocialFeature(snapshot, 'audienceHeat01', 0).toFixed(2)}`,
    ].join(' | ');
  }
}

function pickPosture(
  aggression01: number,
  cadence01: number,
  publicShame: boolean,
  crowdAssist: boolean,
): ChatHaterPosture {
  const combined =
    clamp01(aggression01) * 0.58 +
    clamp01(cadence01) * 0.32 +
    (publicShame ? 0.06 : 0) +
    (crowdAssist ? 0.04 : 0);

  if (combined >= 0.78) return 'SWARMING';
  if (combined >= 0.56) return 'PRESSURING';
  if (combined >= 0.34) return 'TESTING';
  if (combined >= 0.18) return 'GLANCING';
  return 'SUPPRESSED';
}

function chooseAttackStyle(
  persona: ChatHaterPersonaSpec,
  channel: ChatVisibleChannel,
  socialPressure01: number,
  negotiationGuard01: number,
  publicShame: boolean,
): ChatHaterAttackStyle {
  if (channel === 'DEAL_ROOM' && persona.negotiationAffinity01 >= 0.50) {
    return 'DEALROOM_PRESSURE';
  }
  if (publicShame && persona.crowdTheaterAffinity01 >= 0.58) {
    return 'CROWD_PROBE';
  }
  if (persona.id === 'BOT_02_BUREAUCRAT') return 'RULE_TRAP';
  if (persona.id === 'BOT_03_MANIPULATOR') return 'SHAME_NEEDLE';
  if (persona.id === 'BOT_04_CRASH_PROPHET') return 'PROPHECY_DROP';
  if (persona.id === 'BOT_05_LEGACY_HEIR' && socialPressure01 >= 0.42) {
    return 'STATUS_CUT';
  }
  if (negotiationGuard01 >= 0.54 && persona.id === 'BOT_01_LIQUIDATOR') {
    return 'DEALROOM_PRESSURE';
  }
  return persona.preferredAttackStyles[0] ?? 'QUIET_WATCH';
}

function selectBestChannel(
  affinity: ChatHaterChannelAffinity,
  activeChannel: ChatVisibleChannel,
  rescueNeed01: number,
  helperUrgency01: number,
): ChatVisibleChannel {
  const adjusted: Record<ChatVisibleChannel, number> = {
    GLOBAL: affinity.GLOBAL,
    SYNDICATE: affinity.SYNDICATE,
    DEAL_ROOM: affinity.DEAL_ROOM,
    LOBBY: affinity.LOBBY,
  };

  if (rescueNeed01 >= 0.62 || helperUrgency01 >= 0.64) {
    adjusted.GLOBAL -= 0.10;
    adjusted.LOBBY -= 0.04;
    adjusted.SYNDICATE += 0.05;
  }

  adjusted[activeChannel] += 0.04;

  let winner: ChatVisibleChannel = 'GLOBAL';
  let value = adjusted.GLOBAL;
  const channels: readonly ChatVisibleChannel[] = ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM', 'LOBBY'];

  for (const channel of channels) {
    if (adjusted[channel] > value) {
      value = adjusted[channel];
      winner = channel;
    }
  }

  return winner;
}

function lookupHaterSeedScore(
  snapshot: ChatLearningBridgePublicSnapshot,
  personaId: ChatHaterPersonaId,
  fallback = 0.50,
): number {
  const profile = snapshot.profile as unknown as Record<string, unknown>;
  const maybe = profile.haterTargetingByPersona;
  if (!isRecord(maybe)) return fallback;
  return clamp01(safeNumber(maybe[personaId], fallback * 100) / 100);
}

/* ========================================================================== */
/* MARK: Persona registry                                                     */
/* ========================================================================== */

export const CHAT_HATER_PERSONA_REGISTRY = Object.freeze([
  Object.freeze({
    id: 'BOT_01_LIQUIDATOR',
    archetype: 'PREDATOR',
    displayName: 'The Liquidator',
    summary:
      'Fast-closing pressure predator that punishes hesitation, collapse, and exposed recovery states.',
    signatureOpener: 'You are already underwater. I am only naming the depth.',
    signatureCloser: 'I do not chase. I collect.',
    preferredAttackStyles: Object.freeze([
      'LIQUIDATION_PING',
      'DEALROOM_PRESSURE',
      'CROWD_PROBE',
    ] as const),
    voiceprint: Object.freeze({
      sentencePace: 'CLIPPED',
      punctuationSignature: Object.freeze(['.', '—']),
      slangLevel01: asScore01(0.10),
      cruelty01: asScore01(0.72),
      theatricality01: asScore01(0.42),
      delayDiscipline01: asScore01(0.60),
      quoteRecall01: asScore01(0.44),
    }),
    cadence: Object.freeze({
      probeCadence01: asScore01(0.42),
      pressureCadence01: asScore01(0.70),
      swarmCadence01: asScore01(0.84),
      readDelayMs: 640,
      typingDelayMs: 320,
      firstPingDelayMs: 1_820,
    }),
    channelAffinity: Object.freeze({
      GLOBAL: asScore01(0.88),
      SYNDICATE: asScore01(0.56),
      DEAL_ROOM: asScore01(0.72),
      LOBBY: asScore01(0.34),
    }),
    pressureAffinity: Object.freeze({
      CALM: asScore01(0.18),
      BUILDING: asScore01(0.42),
      ELEVATED: asScore01(0.66),
      HIGH: asScore01(0.82),
      CRITICAL: asScore01(0.92),
    }),
    tickAffinity: Object.freeze({
      SOVEREIGN: asScore01(0.22),
      STABLE: asScore01(0.40),
      COMPRESSED: asScore01(0.70),
      CRISIS: asScore01(0.86),
      COLLAPSE_IMMINENT: asScore01(0.96),
    }),
    crowdTheaterAffinity01: asScore01(0.70),
    negotiationAffinity01: asScore01(0.64),
    shameTargeting01: asScore01(0.52),
    comebackPunish01: asScore01(0.62),
    rescueCounterAffinity01: asScore01(0.56),
    helperSuppression01: asScore01(0.54),
  } satisfies ChatHaterPersonaSpec),

  Object.freeze({
    id: 'BOT_02_BUREAUCRAT',
    archetype: 'INSPECTOR',
    displayName: 'The Bureaucrat',
    summary:
      'Slow, procedural attacker that weaponizes rules, friction, disqualification anxiety, and formal pressure.',
    signatureOpener: 'There is always a clause for your kind of mistake.',
    signatureCloser: 'The system will remember what you hoped it forgot.',
    preferredAttackStyles: Object.freeze([
      'RULE_TRAP',
      'DEALROOM_PRESSURE',
      'QUIET_WATCH',
    ] as const),
    voiceprint: Object.freeze({
      sentencePace: 'FORMAL',
      punctuationSignature: Object.freeze([':', ';']),
      slangLevel01: asScore01(0.02),
      cruelty01: asScore01(0.60),
      theatricality01: asScore01(0.28),
      delayDiscipline01: asScore01(0.78),
      quoteRecall01: asScore01(0.58),
    }),
    cadence: Object.freeze({
      probeCadence01: asScore01(0.34),
      pressureCadence01: asScore01(0.56),
      swarmCadence01: asScore01(0.42),
      readDelayMs: 980,
      typingDelayMs: 560,
      firstPingDelayMs: 2_900,
    }),
    channelAffinity: Object.freeze({
      GLOBAL: asScore01(0.48),
      SYNDICATE: asScore01(0.44),
      DEAL_ROOM: asScore01(0.90),
      LOBBY: asScore01(0.20),
    }),
    pressureAffinity: Object.freeze({
      CALM: asScore01(0.34),
      BUILDING: asScore01(0.54),
      ELEVATED: asScore01(0.62),
      HIGH: asScore01(0.70),
      CRITICAL: asScore01(0.76),
    }),
    tickAffinity: Object.freeze({
      SOVEREIGN: asScore01(0.18),
      STABLE: asScore01(0.42),
      COMPRESSED: asScore01(0.62),
      CRISIS: asScore01(0.72),
      COLLAPSE_IMMINENT: asScore01(0.80),
    }),
    crowdTheaterAffinity01: asScore01(0.26),
    negotiationAffinity01: asScore01(0.92),
    shameTargeting01: asScore01(0.38),
    comebackPunish01: asScore01(0.44),
    rescueCounterAffinity01: asScore01(0.50),
    helperSuppression01: asScore01(0.40),
  } satisfies ChatHaterPersonaSpec),

  Object.freeze({
    id: 'BOT_03_MANIPULATOR',
    archetype: 'TRICKSTER',
    displayName: 'The Manipulator',
    summary:
      'Soft-voiced shame predator that exploits uncertainty, social embarrassment, and unstable deal-room posture.',
    signatureOpener: 'You do not need to panic. You only need to reveal yourself.',
    signatureCloser: 'I never force a confession. I simply make silence expensive.',
    preferredAttackStyles: Object.freeze([
      'SHAME_NEEDLE',
      'DEALROOM_PRESSURE',
      'QUIET_WATCH',
    ] as const),
    voiceprint: Object.freeze({
      sentencePace: 'VELVET',
      punctuationSignature: Object.freeze(['...', '?']),
      slangLevel01: asScore01(0.22),
      cruelty01: asScore01(0.68),
      theatricality01: asScore01(0.54),
      delayDiscipline01: asScore01(0.58),
      quoteRecall01: asScore01(0.74),
    }),
    cadence: Object.freeze({
      probeCadence01: asScore01(0.46),
      pressureCadence01: asScore01(0.60),
      swarmCadence01: asScore01(0.36),
      readDelayMs: 720,
      typingDelayMs: 680,
      firstPingDelayMs: 2_260,
    }),
    channelAffinity: Object.freeze({
      GLOBAL: asScore01(0.58),
      SYNDICATE: asScore01(0.72),
      DEAL_ROOM: asScore01(0.86),
      LOBBY: asScore01(0.26),
    }),
    pressureAffinity: Object.freeze({
      CALM: asScore01(0.26),
      BUILDING: asScore01(0.44),
      ELEVATED: asScore01(0.62),
      HIGH: asScore01(0.76),
      CRITICAL: asScore01(0.80),
    }),
    tickAffinity: Object.freeze({
      SOVEREIGN: asScore01(0.20),
      STABLE: asScore01(0.36),
      COMPRESSED: asScore01(0.58),
      CRISIS: asScore01(0.74),
      COLLAPSE_IMMINENT: asScore01(0.82),
    }),
    crowdTheaterAffinity01: asScore01(0.46),
    negotiationAffinity01: asScore01(0.82),
    shameTargeting01: asScore01(0.88),
    comebackPunish01: asScore01(0.52),
    rescueCounterAffinity01: asScore01(0.64),
    helperSuppression01: asScore01(0.62),
  } satisfies ChatHaterPersonaSpec),

  Object.freeze({
    id: 'BOT_04_CRASH_PROPHET',
    archetype: 'DOOM_SPEAKER',
    displayName: 'The Crash Prophet',
    summary:
      'Mythic collapse narrator that appears strongest in compression, crisis, and fragile comeback windows.',
    signatureOpener: 'I have seen this ending wearing your face.',
    signatureCloser: 'When the room finally agrees with me, call it coincidence.',
    preferredAttackStyles: Object.freeze([
      'PROPHECY_DROP',
      'CROWD_PROBE',
      'QUIET_WATCH',
    ] as const),
    voiceprint: Object.freeze({
      sentencePace: 'ORACULAR',
      punctuationSignature: Object.freeze(['—', '.']),
      slangLevel01: asScore01(0.04),
      cruelty01: asScore01(0.64),
      theatricality01: asScore01(0.86),
      delayDiscipline01: asScore01(0.66),
      quoteRecall01: asScore01(0.62),
    }),
    cadence: Object.freeze({
      probeCadence01: asScore01(0.28),
      pressureCadence01: asScore01(0.58),
      swarmCadence01: asScore01(0.68),
      readDelayMs: 1_180,
      typingDelayMs: 860,
      firstPingDelayMs: 3_020,
    }),
    channelAffinity: Object.freeze({
      GLOBAL: asScore01(0.92),
      SYNDICATE: asScore01(0.60),
      DEAL_ROOM: asScore01(0.44),
      LOBBY: asScore01(0.22),
    }),
    pressureAffinity: Object.freeze({
      CALM: asScore01(0.12),
      BUILDING: asScore01(0.34),
      ELEVATED: asScore01(0.62),
      HIGH: asScore01(0.84),
      CRITICAL: asScore01(0.96),
    }),
    tickAffinity: Object.freeze({
      SOVEREIGN: asScore01(0.18),
      STABLE: asScore01(0.30),
      COMPRESSED: asScore01(0.72),
      CRISIS: asScore01(0.92),
      COLLAPSE_IMMINENT: asScore01(0.98),
    }),
    crowdTheaterAffinity01: asScore01(0.88),
    negotiationAffinity01: asScore01(0.28),
    shameTargeting01: asScore01(0.42),
    comebackPunish01: asScore01(0.84),
    rescueCounterAffinity01: asScore01(0.54),
    helperSuppression01: asScore01(0.34),
  } satisfies ChatHaterPersonaSpec),

  Object.freeze({
    id: 'BOT_05_LEGACY_HEIR',
    archetype: 'ARISTOCRAT',
    displayName: 'The Legacy Heir',
    summary:
      'Status attacker that weaponizes hierarchy, composure, and prestige humiliation in public or elite tactical rooms.',
    signatureOpener: 'You perform courage like it was inherited.',
    signatureCloser: 'What you call resilience, lineage would call rehearsal.',
    preferredAttackStyles: Object.freeze([
      'STATUS_CUT',
      'CROWD_PROBE',
      'SHAME_NEEDLE',
    ] as const),
    voiceprint: Object.freeze({
      sentencePace: 'CUTTING',
      punctuationSignature: Object.freeze(['.', ',']),
      slangLevel01: asScore01(0.08),
      cruelty01: asScore01(0.70),
      theatricality01: asScore01(0.66),
      delayDiscipline01: asScore01(0.52),
      quoteRecall01: asScore01(0.58),
    }),
    cadence: Object.freeze({
      probeCadence01: asScore01(0.36),
      pressureCadence01: asScore01(0.62),
      swarmCadence01: asScore01(0.60),
      readDelayMs: 760,
      typingDelayMs: 420,
      firstPingDelayMs: 2_040,
    }),
    channelAffinity: Object.freeze({
      GLOBAL: asScore01(0.84),
      SYNDICATE: asScore01(0.76),
      DEAL_ROOM: asScore01(0.52),
      LOBBY: asScore01(0.18),
    }),
    pressureAffinity: Object.freeze({
      CALM: asScore01(0.28),
      BUILDING: asScore01(0.48),
      ELEVATED: asScore01(0.66),
      HIGH: asScore01(0.78),
      CRITICAL: asScore01(0.82),
    }),
    tickAffinity: Object.freeze({
      SOVEREIGN: asScore01(0.32),
      STABLE: asScore01(0.42),
      COMPRESSED: asScore01(0.58),
      CRISIS: asScore01(0.70),
      COLLAPSE_IMMINENT: asScore01(0.74),
    }),
    crowdTheaterAffinity01: asScore01(0.72),
    negotiationAffinity01: asScore01(0.36),
    shameTargeting01: asScore01(0.70),
    comebackPunish01: asScore01(0.66),
    rescueCounterAffinity01: asScore01(0.46),
    helperSuppression01: asScore01(0.50),
  } satisfies ChatHaterPersonaSpec),
] as const);

export const CHAT_HATER_PERSONA_ALIASES = Object.freeze({
  LIQUIDATOR: 'BOT_01_LIQUIDATOR',
  BUREAUCRAT: 'BOT_02_BUREAUCRAT',
  MANIPULATOR: 'BOT_03_MANIPULATOR',
  CRASH_PROPHET: 'BOT_04_CRASH_PROPHET',
  LEGACY_HEIR: 'BOT_05_LEGACY_HEIR',
} as const);

/* ========================================================================== */
/* MARK: Internal scoring helpers                                             */
/* ========================================================================== */

function registryToMap(
  registry: readonly ChatHaterPersonaSpec[],
): Readonly<Record<ChatHaterPersonaId, ChatHaterPersonaSpec>> {
  const next = {} as Record<ChatHaterPersonaId, ChatHaterPersonaSpec>;
  for (const persona of registry) {
    next[persona.id] = persona;
  }
  return Object.freeze(next);
}

function resolveChannelAffinity(
  persona: ChatHaterPersonaSpec,
  channel: ChatVisibleChannel,
): number {
  return persona.channelAffinity[channel];
}

function resolvePressureAffinity(
  persona: ChatHaterPersonaSpec,
  pressureTier: ChatPressureTier,
): number {
  return persona.pressureAffinity[pressureTier];
}

function resolveTickAffinity(
  persona: ChatHaterPersonaSpec,
  tickTier: ChatTickTier,
): number {
  return persona.tickAffinity[tickTier];
}

function normalizeSeedScore(score100: number): number {
  if (!Number.isFinite(score100)) return 0.50;
  return clamp01(score100 / 100);
}

function coldWindow(snapshot: ChatLearningBridgePublicSnapshot): boolean {
  const profile = snapshot.profile;
  const totalMessages =
    safeNumber(profile.totalMessagesInbound, 0) +
    safeNumber(profile.totalMessagesOutbound, 0);

  return totalMessages <= 8 && safeNumber(profile.totalChatOpens, 0) <= 2;
}

function computePersonaFit(
  persona: ChatHaterPersonaSpec,
  snapshot: ChatLearningBridgePublicSnapshot,
  featureSnapshot: ChatFeatureSnapshot | null,
  engagement: ChatEngagementScoreResult,
  coldStart: ChatColdStartPolicyDecision,
  defaults: typeof CHAT_HATER_PERSONA_POLICY_DEFAULTS,
  options: Required<
    Pick<
      ChatHaterPersonaPolicyOptions,
      'allowCrowdAssist' | 'allowPublicShame'
    >
  >,
): ChatHaterPersonaTargetScore {
  const pressureTier = coldStart.breakdown.pressureTier;
  const tickTier = coldStart.breakdown.tickTier;
  const activeChannel = snapshot.activeChannel;

  const audienceHeat01 = getSocialFeature(featureSnapshot, 'audienceHeat01', 0.18);
  const crowdStress01 = getSocialFeature(featureSnapshot, 'crowdStress01', 0.18);
  const embarrassmentRisk01 = getSocialFeature(featureSnapshot, 'embarrassmentRisk01', 0.12);
  const negotiationExposure01 = getSocialFeature(featureSnapshot, 'negotiationExposure01', 0.14);
  const publicStagePressure01 = getSocialFeature(featureSnapshot, 'publicStagePressure01', 0.14);

  const seedScore01 = lookupHaterSeedScore(snapshot, persona.id, 0.50);

  const helperSuppression = Math.max(
    coldStart.helperPlan.helperUrgency01,
    engagement.vector.rescueNeed01,
  ) >= defaults.helperSuppressionThreshold;

  const rawFit =
    seedScore01 * 0.20 +
    resolveChannelAffinity(persona, activeChannel) * 0.16 +
    resolvePressureAffinity(persona, pressureTier) * 0.14 +
    resolveTickAffinity(persona, tickTier) * 0.12 +
    engagement.vector.haterAggression01 * 0.10 +
    getScalarFeature(featureSnapshot, 'haterTolerance01', snapshot.profile.haterTolerance01) * 0.12 +
    persona.crowdTheaterAffinity01 * audienceHeat01 * 0.06 +
    persona.negotiationAffinity01 * negotiationExposure01 * 0.05 +
    persona.shameTargeting01 * engagement.vector.shameSensitivity01 * 0.05;

  const fit01 = asScore01(
    clamp01(
      rawFit -
        (helperSuppression ? defaults.helperPresenceDampener : 0) -
        (coldWindow(snapshot) ? 0.06 : 0),
    ),
  );

  const shouldUsePublicShame = Boolean(
    options.allowPublicShame &&
      activeChannel === 'GLOBAL' &&
      persona.shameTargeting01 >= 0.50 &&
      engagement.vector.shameSensitivity01 < defaults.publicShameThreshold &&
      embarrassmentRisk01 < defaults.publicShameThreshold &&
      coldStart.presencePlan.crowdContainment01 < 0.48,
  );

  const shouldUseCrowdAssist = Boolean(
    options.allowCrowdAssist &&
      shouldUsePublicShame &&
      persona.crowdTheaterAffinity01 >= 0.56 &&
      audienceHeat01 >= defaults.globalSwarmThreshold &&
      publicStagePressure01 >= 0.42,
  );

  const aggression01 = asScore01(
    clamp01(
      defaults.aggressionFloor +
        fit01 * 0.34 +
        engagement.vector.haterAggression01 * 0.22 +
        resolvePressureAffinity(persona, pressureTier) * 0.10 +
        resolveTickAffinity(persona, tickTier) * 0.08 +
        (shouldUsePublicShame ? 0.06 : 0) +
        (shouldUseCrowdAssist ? 0.08 : 0) -
        (engagement.vector.rescueNeed01 >= defaults.rescueSuppressionThreshold
          ? 0.10
          : 0) -
        (engagement.vector.dropOffRisk01 >= defaults.dropRiskSuppressionThreshold
          ? 0.08
          : 0) -
        (engagement.vector.confidence01 < 0.42 ? defaults.lowConfidencePenalty : 0) -
        (engagement.vector.shameSensitivity01 >= 0.62 ? defaults.embarrassmentSafetyPenalty : 0),
    ),
  );

  const cadence01 = asScore01(
    clamp01(
      defaults.cadenceFloor +
        fit01 * 0.28 +
        engagement.vector.haterAggression01 * 0.14 +
        crowdStress01 * 0.08 +
        (activeChannel === 'GLOBAL' ? defaults.globalTheaterBias : 0) +
        (activeChannel === 'SYNDICATE' ? defaults.syndicateProbeBias : 0) +
        (activeChannel === 'DEAL_ROOM' ? defaults.dealRoomSilenceBias : 0) +
        (pressureTier === 'CRITICAL' ? defaults.pressureEscalationBonus : 0) +
        (tickTier === 'CRISIS' || tickTier === 'COLLAPSE_IMMINENT'
          ? defaults.crisisProphecyBonus
          : 0) +
        (engagement.vector.legendMomentum01 >= 0.56
          ? defaults.legendMomentumTauntBonus
          : 0) -
        (helperSuppression ? defaults.helperPresenceDampener : 0),
    ),
  );

  const channel = selectBestChannel(
    persona.channelAffinity,
    activeChannel,
    engagement.vector.rescueNeed01,
    coldStart.helperPlan.helperUrgency01,
  );

  const posture = pickPosture(
    aggression01,
    cadence01,
    shouldUsePublicShame,
    shouldUseCrowdAssist,
  );

  const primaryAttackStyle = chooseAttackStyle(
    persona,
    channel,
    engagement.vector.socialPressure01,
    engagement.vector.negotiationGuard01,
    shouldUsePublicShame,
  );

  const shouldSuppressHelper = Boolean(
    persona.helperSuppression01 >= 0.54 &&
      fit01 >= 0.52 &&
      coldStart.helperPlan.helperUrgency01 < defaults.helperSuppressionThreshold &&
      engagement.vector.rescueNeed01 < defaults.rescueSuppressionThreshold,
  );

  const explanation = [
    `persona:${persona.id}`,
    `fit:${fit01.toFixed(2)}`,
    `agg:${aggression01.toFixed(2)}`,
    `cad:${cadence01.toFixed(2)}`,
    `channel:${channel}`,
    `posture:${posture}`,
    `attack:${primaryAttackStyle}`,
    shouldUseCrowdAssist ? 'crowd:yes' : 'crowd:no',
    shouldUsePublicShame ? 'shame:yes' : 'shame:no',
  ].join(' | ');

  return Object.freeze({
    personaId: persona.id,
    fit01,
    aggression01: asScore01(
      Math.min(
        coldWindow(snapshot) ? defaults.coldWindowAggressionCap : defaults.aggressionCeiling,
        aggression01,
      ),
    ),
    cadence01: asScore01(
      Math.min(
        coldWindow(snapshot) ? defaults.coldWindowCadenceCap : defaults.cadenceCeiling,
        cadence01,
      ),
    ),
    channel,
    posture,
    primaryAttackStyle,
    shouldUseCrowdAssist,
    shouldUsePublicShame,
    shouldSuppressHelper,
    explanation,
  });
}

function sortScores(
  scores: readonly ChatHaterPersonaTargetScore[],
): readonly ChatHaterPersonaTargetScore[] {
  return Object.freeze(
    [...scores].sort((a, b) => {
      const primary = b.fit01 - a.fit01;
      if (primary !== 0) return primary;

      const secondary = b.aggression01 - a.aggression01;
      if (secondary !== 0) return secondary;

      return b.cadence01 - a.cadence01;
    }),
  );
}

function resolveAttackWindow(
  persona: ChatHaterPersonaSpec,
  score: ChatHaterPersonaTargetScore,
  defaults: typeof CHAT_HATER_PERSONA_POLICY_DEFAULTS,
): { readonly readDelayMs: number; readonly typingDelayMs: number; readonly firstPingDelayMs: number } {
  const readDelayMs = clampMs(
    persona.cadence.readDelayMs +
      (1 - score.fit01) * 880 +
      (score.posture === 'SUPPRESSED' ? 420 : 0) -
      (score.posture === 'SWARMING' ? 180 : 0),
    defaults.minReadDelayMs,
    defaults.maxReadDelayMs,
  );

  const typingDelayMs = clampMs(
    persona.cadence.typingDelayMs +
      (1 - score.cadence01) * 720 +
      (score.primaryAttackStyle === 'QUIET_WATCH' ? 200 : 0),
    defaults.minTypingDelayMs,
    defaults.maxTypingDelayMs,
  );

  const firstPingDelayMs = clampMs(
    persona.cadence.firstPingDelayMs +
      (1 - score.aggression01) * 2_200 +
      (score.posture === 'SUPPRESSED' ? 1_600 : 0) -
      (score.posture === 'SWARMING' ? 620 : 0),
    defaults.minFirstPingMs,
    defaults.maxFirstPingMs,
  );

  return Object.freeze({
    readDelayMs,
    typingDelayMs,
    firstPingDelayMs,
  });
}

/* ========================================================================== */
/* MARK: Policy implementation                                                */
/* ========================================================================== */

export class ChatHaterPersonaPolicy
  implements ChatLearningBridgeInferencePort
{
  private readonly defaults: typeof CHAT_HATER_PERSONA_POLICY_DEFAULTS;
  private readonly options: Required<
    Pick<
      ChatHaterPersonaPolicyOptions,
      'includeExplanationBreakdown' | 'allowCrowdAssist' | 'allowPublicShame'
    >
  > &
    Omit<
      ChatHaterPersonaPolicyOptions,
      'includeExplanationBreakdown' | 'allowCrowdAssist' | 'allowPublicShame'
    >;
  private readonly registry: readonly ChatHaterPersonaSpec[];
  private readonly registryMap: Readonly<Record<ChatHaterPersonaId, ChatHaterPersonaSpec>>;

  constructor(options: ChatHaterPersonaPolicyOptions = {}) {
    this.defaults = {
      ...CHAT_HATER_PERSONA_POLICY_DEFAULTS,
      ...(options.defaults ?? {}),
    };

    this.options = {
      ...options,
      includeExplanationBreakdown: options.includeExplanationBreakdown ?? true,
      allowCrowdAssist: options.allowCrowdAssist ?? true,
      allowPublicShame: options.allowPublicShame ?? true,
    };

    this.registry = Object.freeze(
      (options.registry?.length ? options.registry : CHAT_HATER_PERSONA_REGISTRY).slice(),
    );
    this.registryMap = registryToMap(this.registry);
  }

  public resolve(
    snapshot: ChatLearningBridgePublicSnapshot,
  ): ChatHaterPersonaDecision {
    const featureSnapshot = getLatestFeatureSnapshot(snapshot);
    const engagement = scoreChatEngagement(snapshot);
    const coldStart = evaluateChatColdStartPolicy(snapshot);
    const pressureTier = derivePressureTier(featureSnapshot);
    const tickTier = deriveTickTier(featureSnapshot);
    const featureSummary = summarizeFeatures(featureSnapshot);

    const rawScores = this.registry.map((persona) =>
      computePersonaFit(
        persona,
        snapshot,
        featureSnapshot,
        engagement,
        coldStart,
        this.defaults,
        this.options,
      ),
    );

    const ranked = sortScores(rawScores);
    const score = ranked[0];
    const persona = this.registryMap[score.personaId];
    const attackWindow = resolveAttackWindow(persona, score, this.defaults);

    const bridgeRecommendation: ChatLearningBridgeRecommendation = Object.freeze({
      recommendedChannel: score.channel,
      helperUrgency01: coldStart.helperPlan.helperUrgency01,
      rescueNeeded:
        engagement.vector.rescueNeed01 >= this.defaults.rescueSuppressionThreshold,
      haterAggression01: score.aggression01,
      dropOffRisk01: engagement.vector.dropOffRisk01,
      explanation: [
        `persona:${persona.id}`,
        `fit:${score.fit01.toFixed(2)}`,
        `channel:${score.channel}`,
        `posture:${score.posture}`,
        `attack:${score.primaryAttackStyle}`,
      ].join(' | '),
    });

    const profilePatch: Partial<ChatLearningBridgeProfileState> = {
      preferredChannel: score.channel,
      haterTolerance01: asScore01(
        lerp01(
          snapshot.profile.haterTolerance01,
          clamp01(score.aggression01 * 0.58 + score.fit01 * 0.42),
          this.defaults.targetingSmoothingAlpha,
        ),
      ),
      shameSensitivity01: asScore01(
        lerp01(
          snapshot.profile.shameSensitivity01,
          clamp01(
            engagement.vector.shameSensitivity01 +
              (score.shouldUsePublicShame ? 0.04 : -0.02),
          ),
          this.defaults.targetingSmoothingAlpha,
        ),
      ),
      confidence01: asScore01(
        lerp01(
          snapshot.profile.confidence01,
          clamp01(
            engagement.vector.confidence01 -
              (score.posture === 'PRESSURING' ? 0.03 : 0) -
              (score.posture === 'SWARMING' ? 0.05 : 0),
          ),
          this.defaults.targetingSmoothingAlpha,
        ),
      ),
      globalAffinity01: asScore01(
        lerp01(
          snapshot.profile.globalAffinity01,
          score.channel === 'GLOBAL' ? 0.62 : snapshot.profile.globalAffinity01,
          this.defaults.targetingSmoothingAlpha,
        ),
      ),
      syndicateAffinity01: asScore01(
        lerp01(
          snapshot.profile.syndicateAffinity01,
          score.channel === 'SYNDICATE' ? 0.60 : snapshot.profile.syndicateAffinity01,
          this.defaults.targetingSmoothingAlpha,
        ),
      ),
      dealRoomAffinity01: asScore01(
        lerp01(
          snapshot.profile.dealRoomAffinity01,
          score.channel === 'DEAL_ROOM' ? 0.64 : snapshot.profile.dealRoomAffinity01,
          this.defaults.targetingSmoothingAlpha,
        ),
      ),
      rescueNeed01: asScore01(
        lerp01(
          snapshot.profile.rescueNeed01,
          clamp01(
            engagement.vector.rescueNeed01 +
              (score.posture === 'SWARMING' ? 0.04 : 0) +
              (score.shouldUsePublicShame ? 0.03 : 0),
          ),
          this.defaults.targetingSmoothingAlpha,
        ),
      ),
    };

    const explanation = [
      `persona:${persona.id}`,
      `archetype:${persona.archetype}`,
      `fit:${score.fit01.toFixed(2)}`,
      `agg:${score.aggression01.toFixed(2)}`,
      `cad:${score.cadence01.toFixed(2)}`,
      `channel:${score.channel}`,
      `posture:${score.posture}`,
      `attack:${score.primaryAttackStyle}`,
      coldWindow(snapshot) ? 'cold:cap' : 'cold:off',
      `pressure:${pressureTier}`,
      `tick:${tickTier}`,
    ].join(' | ');

    const breakdown: ChatHaterPersonaPolicyBreakdown = Object.freeze({
      moduleName: CHAT_HATER_PERSONA_POLICY_MODULE_NAME,
      moduleVersion: CHAT_HATER_PERSONA_POLICY_VERSION,
      bridgeModuleName: CHAT_LEARNING_BRIDGE_MODULE_NAME,
      bridgeModuleVersion: CHAT_LEARNING_BRIDGE_VERSION,
      pressureTier,
      tickTier,
      featureSummary,
      coldWindow: coldWindow(snapshot),
      chosenPersonaId: persona.id,
      explanation,
    });

    return Object.freeze({
      persona,
      score,
      ranked,
      bridgeRecommendation,
      profilePatch,
      attackWindow,
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
}

/* ========================================================================== */
/* MARK: Public helpers                                                       */
/* ========================================================================== */

export function createChatHaterPersonaPolicy(
  options: ChatHaterPersonaPolicyOptions = {},
): ChatHaterPersonaPolicy {
  return new ChatHaterPersonaPolicy(options);
}

export function resolveChatHaterPersona(
  snapshot: ChatLearningBridgePublicSnapshot,
  options: ChatHaterPersonaPolicyOptions = {},
): ChatHaterPersonaDecision {
  return createChatHaterPersonaPolicy(options).resolve(snapshot);
}

export function recommendChatHaterPersona(
  snapshot: ChatLearningBridgePublicSnapshot,
  options: ChatHaterPersonaPolicyOptions = {},
): ChatLearningBridgeRecommendation {
  return createChatHaterPersonaPolicy(options).recommend(snapshot);
}

export function refineHaterPersonaProfileState(
  snapshot: ChatLearningBridgePublicSnapshot,
  options: ChatHaterPersonaPolicyOptions = {},
): Partial<ChatLearningBridgeProfileState> {
  return createChatHaterPersonaPolicy(options).refineProfile(snapshot);
}

export function getChatHaterPersonaById(
  id: ChatHaterPersonaId,
  registry: readonly ChatHaterPersonaSpec[] = CHAT_HATER_PERSONA_REGISTRY,
): ChatHaterPersonaSpec {
  const found = registry.find((persona) => persona.id === id);
  if (found) return found;
  return registry[0];
}

export function getChatHaterPersonaIdAlias(
  value: string,
): ChatHaterPersonaId | null {
  if (
    value === 'BOT_01_LIQUIDATOR' ||
    value === 'BOT_02_BUREAUCRAT' ||
    value === 'BOT_03_MANIPULATOR' ||
    value === 'BOT_04_CRASH_PROPHET' ||
    value === 'BOT_05_LEGACY_HEIR'
  ) {
    return value;
  }

  const normalized = value.trim().toUpperCase();
  const alias = (CHAT_HATER_PERSONA_ALIASES as Record<string, ChatHaterPersonaId>)[normalized];
  return alias ?? null;
}

export const CHAT_HATER_PERSONA_POLICY_NAMESPACE = Object.freeze({
  moduleName: CHAT_HATER_PERSONA_POLICY_MODULE_NAME,
  version: CHAT_HATER_PERSONA_POLICY_VERSION,
  runtimeLaws: CHAT_HATER_PERSONA_POLICY_RUNTIME_LAWS,
  defaults: CHAT_HATER_PERSONA_POLICY_DEFAULTS,
  seedIds: CHAT_LEARNING_PROFILE_HATER_SEED_IDS,
  registry: CHAT_HATER_PERSONA_REGISTRY,
  aliases: CHAT_HATER_PERSONA_ALIASES,
  create: createChatHaterPersonaPolicy,
  resolve: resolveChatHaterPersona,
  recommend: recommendChatHaterPersona,
  refineProfile: refineHaterPersonaProfileState,
  getById: getChatHaterPersonaById,
  resolveAlias: getChatHaterPersonaIdAlias,
} as const);

export default ChatHaterPersonaPolicy;
