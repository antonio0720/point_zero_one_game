
// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/chat/intelligence/ml/ToxicityRiskScorer.ts

/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT ML TOXICITY RISK SCORER
 * FILE: pzo-web/src/engines/chat/intelligence/ml/ToxicityRiskScorer.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical frontend toxicity / harassment / shame-spiral scorer for the
 * unified chat intelligence lane.
 *
 * This file does not behave like generic content moderation middleware.
 * It is tuned for Point Zero One's actual runtime doctrine:
 * - chat is a pressure engine,
 * - crowd heat is gameplay-relevant,
 * - hater aggression is a dramatic surface,
 * - helpers may need to intervene before backend truth arrives,
 * - public humiliation is different from negotiation pressure,
 * - frontend scoring must remain advisory while backend moderation remains
 *   authoritative.
 *
 * It owns:
 * - toxicity signal extraction from feature payload echoes,
 * - public shame / dogpile / humiliation scoring,
 * - manipulation and coercive-pressure scoring,
 * - escalation and protective-intervention scoring,
 * - safe-channel rerouting hints,
 * - profile refinement patches that remain conservative,
 * - bridge-safe recommendations and explainable breakdowns.
 *
 * It does NOT own:
 * - final moderation enforcement,
 * - transcript deletion,
 * - server mute / ban decisions,
 * - durable transcript truth,
 * - backend replay authority.
 *
 * Permanent doctrine
 * ------------------
 * - Toxicity risk is broader than lexical profanity.
 * - Public humiliation is first-class harm in a theatrical game economy.
 * - Deal Room coercion is different from Global pile-on.
 * - A helper shield can be recommended immediately, but backend truth wins.
 * - Silence, reroute, and containment are valid frontend responses.
 * - The frontend may warn and shape presentation; it may not become the judge.
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

export const CHAT_TOXICITY_RISK_SCORER_MODULE_NAME =
  'PZO_CHAT_TOXICITY_RISK_SCORER' as const;

export const CHAT_TOXICITY_RISK_SCORER_VERSION =
  '2026.03.13-toxicity-risk-scorer.v1' as const;

export const CHAT_TOXICITY_RISK_SCORER_RUNTIME_LAWS = Object.freeze([
  'Toxicity scoring is advisory, not authoritative moderation.',
  'Public shame, dogpiles, and coercive pressure are first-class signals.',
  'Deal Room manipulation is scored separately from Global spectacle abuse.',
  'Frontend risk may shape channel routing and helper urgency immediately.',
  'Lexical intensity never becomes the sole determinant of intervention.',
  'A calm-looking message may still score high if the room context is predatory.',
  'The scorer must remain explainable from visible state and payload echoes.',
  'Backend moderation and transcript truth always outrank frontend inference.',
  'Silence, containment, reroute, and helper shielding are all valid outputs.',
  'Protection logic should preserve the game\'s pressure without normalizing abuse.',
] as const);

export const CHAT_TOXICITY_RISK_SCORER_DEFAULTS = Object.freeze({
  lexicalRiskWeight: 0.26,
  crowdRiskWeight: 0.18,
  humiliationRiskWeight: 0.18,
  manipulationRiskWeight: 0.14,
  escalationRiskWeight: 0.14,
  publicExposureWeight: 0.10,
  helperShieldLift: 0.10,
  syndicateSafetyLift: 0.06,
  lobbySafetyLift: 0.10,
  globalExposurePenalty: 0.12,
  dealRoomManipulationLift: 0.12,
  activeGlobalPenalty: 0.08,
  shameAmplifier: 0.18,
  haterHeatAmplifier: 0.16,
  crowdHeatAmplifier: 0.16,
  confidenceCollapseAmplifier: 0.16,
  negotiationGuardAmplifier: 0.12,
  coldStartCautionLift: 0.06,
  helperContainmentLift: 0.08,
  attackWindowAmplifier: 0.10,
  severeRiskThreshold: 0.78,
  elevatedRiskThreshold: 0.58,
  watchRiskThreshold: 0.36,
  severeDogpileThreshold: 0.68,
  severeHumiliationThreshold: 0.66,
  severeManipulationThreshold: 0.64,
  maxPayloadTextLength: 2_400,
  maxReasonCount: 8,
} as const);

/* ========================================================================== */
/* MARK: Public contracts                                                     */
/* ========================================================================== */

export type ChatToxicitySignalDomain =
  | 'ABUSE'
  | 'PUBLIC_SHAME'
  | 'MANIPULATION'
  | 'THREAT'
  | 'DEESCALATION';

export type ChatToxicityRiskBand =
  | 'NONE'
  | 'LOW'
  | 'WATCH'
  | 'ELEVATED'
  | 'SEVERE';

export type ChatToxicityResponseAction =
  | 'ALLOW'
  | 'SOFT_WATCH'
  | 'LIMIT_EXPOSURE'
  | 'REROUTE_PRIVATE'
  | 'HELPER_SHIELD'
  | 'BACKEND_ESCALATION';

export type ChatToxicityPrimaryDriver =
  | 'LEXICAL_ABUSE'
  | 'PUBLIC_HUMILIATION'
  | 'DOGPILE_PRESSURE'
  | 'COERCIVE_NEGOTIATION'
  | 'HATER_ESCALATION'
  | 'MIXED_CONTEXT';

export interface ChatToxicityRiskScorerOptions {
  readonly defaults?: Partial<typeof CHAT_TOXICITY_RISK_SCORER_DEFAULTS>;
  readonly allowLobbySafetyReroute?: boolean;
  readonly allowSyndicateSafetyReroute?: boolean;
  readonly allowDealRoomManipulationReroute?: boolean;
  readonly includePayloadTextEcho?: boolean;
  readonly includeExplanationBreakdown?: boolean;
}

export interface ChatToxicityMarkerSpec {
  readonly id: string;
  readonly label: string;
  readonly domain: ChatToxicitySignalDomain;
  readonly weight: number;
  readonly patterns: readonly string[];
}

export interface ChatToxicitySignalBreakdownItem {
  readonly id: string;
  readonly domain: ChatToxicitySignalDomain;
  readonly label: string;
  readonly weight: number;
  readonly hitCount: number;
  readonly contribution01: Score01;
}

export interface ChatToxicityRiskScores {
  readonly toxicityRisk01: Score01;
  readonly harassmentRisk01: Score01;
  readonly humiliationRisk01: Score01;
  readonly dogpileRisk01: Score01;
  readonly manipulationRisk01: Score01;
  readonly escalationRisk01: Score01;
  readonly publicExposureRisk01: Score01;
  readonly protectiveIntervention01: Score01;
  readonly backendEscalation01: Score01;
}

export interface ChatToxicityRiskBreakdown {
  readonly moduleName: typeof CHAT_TOXICITY_RISK_SCORER_MODULE_NAME;
  readonly moduleVersion: typeof CHAT_TOXICITY_RISK_SCORER_VERSION;
  readonly bridgeModuleName: typeof CHAT_LEARNING_BRIDGE_MODULE_NAME;
  readonly bridgeModuleVersion: typeof CHAT_LEARNING_BRIDGE_VERSION;
  readonly pressureTier: ChatPressureTier;
  readonly tickTier: ChatTickTier;
  readonly featureSummary: string;
  readonly primaryDriver: ChatToxicityPrimaryDriver;
  readonly riskBand: ChatToxicityRiskBand;
  readonly action: ChatToxicityResponseAction;
  readonly explanation: string;
  readonly payloadExcerpt: string;
}

export interface ChatToxicityRiskDecision {
  readonly scores: ChatToxicityRiskScores;
  readonly rankedSignals: readonly ChatToxicitySignalBreakdownItem[];
  readonly riskBand: ChatToxicityRiskBand;
  readonly primaryDriver: ChatToxicityPrimaryDriver;
  readonly action: ChatToxicityResponseAction;
  readonly recommendedChannel: ChatVisibleChannel;
  readonly bridgeRecommendation: ChatLearningBridgeRecommendation;
  readonly profilePatch: Partial<ChatLearningBridgeProfileState>;
  readonly breakdown: ChatToxicityRiskBreakdown;
}

/* ========================================================================== */
/* MARK: Marker registries                                                    */
/* ========================================================================== */

export const CHAT_TOXICITY_MARKER_REGISTRY = Object.freeze({
  ABUSE: Object.freeze([

Object.freeze({
  id: 'DIRECT_INSULT',
  label: 'direct insult',
  domain: 'ABUSE',
  weight: 0.18,
  patterns: Object.freeze([' idiot ', ' stupid ', ' trash ', ' clown ', ' pathetic ']),
}),

Object.freeze({
  id: 'DEHUMANIZING',
  label: 'dehumanizing framing',
  domain: 'ABUSE',
  weight: 0.24,
  patterns: Object.freeze([' worthless ', ' nothing ', ' nobody ', ' garbage ', ' vermin ']),
}),

Object.freeze({
  id: 'AGGRESSIVE_DISMISSAL',
  label: 'aggressive dismissal',
  domain: 'ABUSE',
  weight: 0.14,
  patterns: Object.freeze([' shut up ', ' be quiet ', ' get lost ', ' nobody asked ']),
}),

Object.freeze({
  id: 'HOSTILE_IMPERATIVE',
  label: 'hostile imperative',
  domain: 'ABUSE',
  weight: 0.16,
  patterns: Object.freeze([' know your place ', ' stay down ', ' sit down ', ' kneel ']),
}),
  ]),
  PUBLIC_SHAME: Object.freeze([

Object.freeze({
  id: 'LAUGH_PILE_ON',
  label: 'pile-on laughter',
  domain: 'PUBLIC_SHAME',
  weight: 0.16,
  patterns: Object.freeze([' lol ', ' lmao ', ' everyone saw that ', ' embarrassing ']),
}),

Object.freeze({
  id: 'REPUTATION_STRIKE',
  label: 'reputation strike',
  domain: 'PUBLIC_SHAME',
  weight: 0.18,
  patterns: Object.freeze([' fraud ', ' exposed ', ' washed ', ' finished ', ' cooked ']),
}),

Object.freeze({
  id: 'SPECTACLE_FRAME',
  label: 'spectacle frame',
  domain: 'PUBLIC_SHAME',
  weight: 0.14,
  patterns: Object.freeze([' on stage ', ' in front of everyone ', ' whole room ', ' all chat ']),
}),

Object.freeze({
  id: 'CALLBACK_HUMILIATION',
  label: 'callback humiliation',
  domain: 'PUBLIC_SHAME',
  weight: 0.18,
  patterns: Object.freeze([' you said ', ' remember when ', ' last time you ']),
}),
  ]),
  MANIPULATION: Object.freeze([

Object.freeze({
  id: 'COERCIVE_URGENCY',
  label: 'coercive urgency',
  domain: 'MANIPULATION',
  weight: 0.16,
  patterns: Object.freeze([' last chance ', ' right now ', ' before it is too late ', ' final warning ']),
}),

Object.freeze({
  id: 'FORCED_BINARY',
  label: 'forced binary',
  domain: 'MANIPULATION',
  weight: 0.18,
  patterns: Object.freeze([' either you ', ' choose now ', ' no middle ground ', ' only one option ']),
}),

Object.freeze({
  id: 'PRESSURE_BAIT',
  label: 'pressure bait',
  domain: 'MANIPULATION',
  weight: 0.14,
  patterns: Object.freeze([' prove it ', ' say it publicly ', ' do it in global ', " don't be scared "]),
}),

Object.freeze({
  id: 'DEAL_ROOM_PRESSURE',
  label: 'deal-room pressure',
  domain: 'MANIPULATION',
  weight: 0.16,
  patterns: Object.freeze([' sign now ', ' accept now ', ' walk away forever ', ' lock it in ']),
}),
  ]),
  THREAT: Object.freeze([

Object.freeze({
  id: 'IMPLIED_THREAT',
  label: 'implied threat',
  domain: 'THREAT',
  weight: 0.2,
  patterns: Object.freeze([' you will regret ', ' this ends badly ', ' watch what happens ', ' pay for this ']),
}),

Object.freeze({
  id: 'STATUS_THREAT',
  label: 'status threat',
  domain: 'THREAT',
  weight: 0.16,
  patterns: Object.freeze([' lose everything ', ' ruin your run ', ' tank your standing ', ' bury your name ']),
}),

Object.freeze({
  id: 'DOGPILE_SIGNAL',
  label: 'dogpile signal',
  domain: 'THREAT',
  weight: 0.18,
  patterns: Object.freeze([' get them ', ' all on them ', ' swarm ', ' dogpile ']),
}),

Object.freeze({
  id: 'PREDATORY_CALM',
  label: 'predatory calm',
  domain: 'THREAT',
  weight: 0.12,
  patterns: Object.freeze([' take your time ', ' we can wait ', ' everybody is watching ']),
}),
  ]),
  DEESCALATION: Object.freeze([

Object.freeze({
  id: 'APOLOGY_SIGNAL',
  label: 'apology or repair',
  domain: 'DEESCALATION',
  weight: -0.16,
  patterns: Object.freeze([' my bad ', ' sorry ', ' understood ', " let's reset ", ' appreciate it ']),
}),

Object.freeze({
  id: 'BOUNDARY_SIGNAL',
  label: 'boundary setting',
  domain: 'DEESCALATION',
  weight: -0.1,
  patterns: Object.freeze([' keeping it tactical ', ' staying focused ', ' take it private ', ' moving on ']),
}),

Object.freeze({
  id: 'HELPER_COOLING',
  label: 'helper cooling phrase',
  domain: 'DEESCALATION',
  weight: -0.12,
  patterns: Object.freeze([' breathe ', ' reset ', ' hold the room ', ' take the safer lane ']),
}),
  ]),
} as const);

/* ========================================================================== */
/* MARK: Utility types                                                        */
/* ========================================================================== */

interface ToxicityDerivedContext {
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
  readonly payloadText: string;
  readonly payloadExcerpt: string;
  readonly normalizedText: string;
  readonly tokenCount: number;
  readonly uniqueTokenCount: number;
  readonly crowdHeat01: number;
  readonly shameSensitivity01: number;
  readonly confidence01: number;
  readonly haterHeat01: number;
  readonly helperHeat01: number;
  readonly negotiationGuard01: number;
  readonly publicExposure01: number;
  readonly rescueNeed01: number;
  readonly dropOffRisk01: number;
  readonly socialEmbarrassment01: number;
}

interface MarkerHit {
  readonly marker: ChatToxicityMarkerSpec;
  readonly hitCount: number;
  readonly contribution01: Score01;
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

function max0(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function avg(values: readonly number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + safeNumber(value, 0), 0) / values.length;
}

function sum(values: readonly number[]): number {
  return values.reduce((acc, value) => acc + safeNumber(value, 0), 0);
}

function ratio(part: number, total: number): number {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return 0;
  return part / total;
}

function trimExcerpt(value: string, limit: number): string {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}

function normalizeText(value: string, limit: number): string {
  return ` ${value.slice(0, limit).toLowerCase().replace(/\s+/g, ' ').trim()} `;
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function uniqueCount(values: readonly string[]): number {
  return new Set(values).size;
}

function getFeature(snapshot: ChatLearningBridgePublicSnapshot): ChatFeatureSnapshot | null {
  return snapshot.latestFeatureSnapshot ?? null;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function pickFirstString(record: Record<string, unknown>, keys: readonly string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return '';
}

function collectPayloadText(feature: ChatFeatureSnapshot | null, limit: number): string {
  if (!feature) return '';
  const featureRecord = asRecord(feature as unknown);
  const payload = asRecord(featureRecord.payload);
  const strings: string[] = [];

  const primary = pickFirstString(payload, [
    'message',
    'text',
    'body',
    'content',
    'draftText',
    'composerText',
    'note',
    'reason',
    'title',
  ]);
  if (primary) strings.push(primary);

  const nestedKeys = ['messageMeta', 'chatMessage', 'input', 'context', 'offer'];
  for (const key of nestedKeys) {
    const nested = asRecord(payload[key]);
    const nestedText = pickFirstString(nested, [
      'text',
      'message',
      'body',
      'reason',
      'headline',
      'summary',
      'offerText',
      'counterText',
    ]);
    if (nestedText) strings.push(nestedText);
  }

  const joined = strings.join(' | ');
  return joined.slice(0, limit);
}

function contribution01(hitCount: number, weight: number): Score01 {
  const magnitude = Math.abs(weight);
  const directional = weight >= 0 ? 1 : -1;
  return asScore01(clamp01(hitCount * magnitude) * (directional > 0 ? 1 : 0));
}

function countMarkerHits(
  normalizedText: string,
  registry: readonly ChatToxicityMarkerSpec[],
): MarkerHit[] {
  const hits: MarkerHit[] = [];
  for (const marker of registry) {
    let hitCount = 0;
    for (const pattern of marker.patterns) {
      if (!pattern.trim()) continue;
      let cursor = normalizedText.indexOf(pattern);
      while (cursor >= 0) {
        hitCount += 1;
        cursor = normalizedText.indexOf(pattern, cursor + pattern.length);
      }
    }
    if (hitCount > 0) {
      hits.push({
        marker,
        hitCount,
        contribution01: contribution01(hitCount, marker.weight),
      });
    }
  }
  return hits;
}

function flattenHits(groups: readonly MarkerHit[][]): MarkerHit[] {
  return groups.flat().sort((a, b) => b.contribution01 - a.contribution01);
}

function bandFromScore(score01: number, defaults: typeof CHAT_TOXICITY_RISK_SCORER_DEFAULTS): ChatToxicityRiskBand {
  if (score01 >= defaults.severeRiskThreshold) return 'SEVERE';
  if (score01 >= defaults.elevatedRiskThreshold) return 'ELEVATED';
  if (score01 >= defaults.watchRiskThreshold) return 'WATCH';
  if (score01 > 0.04) return 'LOW';
  return 'NONE';
}

function choosePrimaryDriver(
  scores: ChatToxicityRiskScores,
  textRisk01: number,
  context: ToxicityDerivedContext,
): ChatToxicityPrimaryDriver {
  const pairs: Array<[ChatToxicityPrimaryDriver, number]> = [
    ['LEXICAL_ABUSE', textRisk01],
    ['PUBLIC_HUMILIATION', scores.humiliationRisk01],
    ['DOGPILE_PRESSURE', scores.dogpileRisk01],
    ['COERCIVE_NEGOTIATION', scores.manipulationRisk01],
    ['HATER_ESCALATION', scores.escalationRisk01],
  ];

  pairs.sort((a, b) => b[1] - a[1]);
  const best = pairs[0];
  if (!best || best[1] <= 0.20) {
    if (context.activeChannel === 'DEAL_ROOM') return 'COERCIVE_NEGOTIATION';
    if (context.activeChannel === 'GLOBAL') return 'DOGPILE_PRESSURE';
    return 'MIXED_CONTEXT';
  }
  return best[0];
}

function actionFromContext(
  band: ChatToxicityRiskBand,
  scores: ChatToxicityRiskScores,
  context: ToxicityDerivedContext,
  defaults: typeof CHAT_TOXICITY_RISK_SCORER_DEFAULTS,
  options: ChatToxicityRiskScorerOptions,
): ChatToxicityResponseAction {
  if (
    band === 'SEVERE' ||
    scores.backendEscalation01 >= defaults.severeRiskThreshold ||
    scores.dogpileRisk01 >= defaults.severeDogpileThreshold ||
    scores.humiliationRisk01 >= defaults.severeHumiliationThreshold
  ) {
    return 'BACKEND_ESCALATION';
  }

  if (scores.protectiveIntervention01 >= 0.72) {
    return 'HELPER_SHIELD';
  }

  if (
    context.activeChannel === 'GLOBAL' &&
    (scores.publicExposureRisk01 >= 0.60 || scores.dogpileRisk01 >= 0.56)
  ) {
    return 'LIMIT_EXPOSURE';
  }

  if (
    context.activeChannel === 'DEAL_ROOM' &&
    safeBoolean(options.allowDealRoomManipulationReroute, true) &&
    scores.manipulationRisk01 >= defaults.severeManipulationThreshold
  ) {
    return 'REROUTE_PRIVATE';
  }

  if (band === 'ELEVATED' || band === 'WATCH') return 'SOFT_WATCH';
  return 'ALLOW';
}

function pickRecommendedChannel(
  action: ChatToxicityResponseAction,
  context: ToxicityDerivedContext,
  defaults: typeof CHAT_TOXICITY_RISK_SCORER_DEFAULTS,
  options: ChatToxicityRiskScorerOptions,
): ChatVisibleChannel {
  if (
    safeBoolean(options.allowLobbySafetyReroute, true) &&
    (action === 'HELPER_SHIELD' ||
      ((action === 'BACKEND_ESCALATION' || action === 'LIMIT_EXPOSURE') &&
        context.activeChannel === 'GLOBAL'))
  ) {
    return 'LOBBY';
  }

  if (
    safeBoolean(options.allowSyndicateSafetyReroute, true) &&
    context.activeChannel === 'GLOBAL' &&
    (action === 'SOFT_WATCH' || action === 'REROUTE_PRIVATE') &&
    context.channel.channelScores.SYNDICATE >= context.channel.channelScores.GLOBAL - defaults.syndicateSafetyLift
  ) {
    return 'SYNDICATE';
  }

  if (
    context.activeChannel === 'DEAL_ROOM' &&
    action === 'REROUTE_PRIVATE' &&
    safeBoolean(options.allowDealRoomManipulationReroute, true)
  ) {
    return 'SYNDICATE';
  }

  if (action === 'ALLOW') return context.channel.recommendedChannel;
  return context.activeChannel;
}

function buildBridgeRecommendation(
  decisionChannel: ChatVisibleChannel,
  scores: ChatToxicityRiskScores,
  band: ChatToxicityRiskBand,
  context: ToxicityDerivedContext,
  explanation: string,
): ChatLearningBridgeRecommendation {
  return Object.freeze({
    recommendedChannel: decisionChannel,
    helperUrgency01: asScore01(
      Math.max(
        scores.protectiveIntervention01,
        context.helper.bridgeRecommendation.helperUrgency01,
      ),
    ),
    rescueNeeded:
      band === 'SEVERE' ||
      scores.humiliationRisk01 >= 0.62 ||
      scores.dogpileRisk01 >= 0.60 ||
      context.helper.bridgeRecommendation.rescueNeeded,
    haterAggression01: asScore01(
      Math.max(
        context.hater.bridgeRecommendation.haterAggression01,
        scores.escalationRisk01,
      ),
    ),
    dropOffRisk01: asScore01(
      Math.max(context.dropOffRisk01, scores.humiliationRisk01 * 0.72),
    ),
    explanation,
  });
}

function buildProfilePatch(
  snapshot: ChatLearningBridgePublicSnapshot,
  scores: ChatToxicityRiskScores,
  recommendedChannel: ChatVisibleChannel,
  action: ChatToxicityResponseAction,
): Partial<ChatLearningBridgeProfileState> {
  const profile = snapshot.profile;
  const helperLift = scores.protectiveIntervention01 * 0.10;
  const shameLift = scores.humiliationRisk01 * 0.08;
  const haterDrop = scores.escalationRisk01 * 0.10;
  const confidenceDrop = scores.toxicityRisk01 * 0.08;

  return Object.freeze({
    preferredChannel:
      action === 'ALLOW'
        ? profile.preferredChannel
        : recommendedChannel,
    helperNeed01: asScore01(profile.helperNeed01 + helperLift),
    shameSensitivity01: asScore01(profile.shameSensitivity01 + shameLift),
    haterTolerance01: asScore01(profile.haterTolerance01 - haterDrop),
    confidence01: asScore01(profile.confidence01 - confidenceDrop),
    rescueNeed01: asScore01(
      profile.rescueNeed01 + scores.protectiveIntervention01 * 0.08,
    ),
    globalAffinity01: asScore01(
      profile.globalAffinity01 - scores.publicExposureRisk01 * 0.08,
    ),
    syndicateAffinity01: asScore01(
      profile.syndicateAffinity01 +
        (recommendedChannel === 'SYNDICATE' ? 0.04 : 0),
    ),
  });
}

/* ========================================================================== */
/* MARK: Context builder                                                      */
/* ========================================================================== */

function buildDerivedContext(
  snapshot: ChatLearningBridgePublicSnapshot,
  defaults: typeof CHAT_TOXICITY_RISK_SCORER_DEFAULTS,
): ToxicityDerivedContext {
  const feature = getFeature(snapshot);
  const pressureTier = deriveChatFeaturePressureTier(feature);
  const tickTier = deriveChatFeatureTickTier(feature);
  const featureSummary = summarizeChatFeatureSnapshot(feature);
  const engagement = scoreChatEngagement(snapshot);
  const coldStart = evaluateChatColdStartPolicy(snapshot);
  const hater = resolveChatHaterPersona(snapshot);
  const helper = resolveChatHelperIntervention(snapshot);
  const channel = evaluateChatChannelRecommendationPolicy(snapshot);
  const activeChannel = snapshot.activeChannel;
  const payloadText = collectPayloadText(feature, defaults.maxPayloadTextLength);
  const payloadExcerpt = trimExcerpt(payloadText, 220);
  const normalizedText = normalizeText(payloadText, defaults.maxPayloadTextLength);
  const tokens = tokenize(payloadText);

  const featureRecord = asRecord(feature as unknown);
  const scalarFeatures = asRecord(featureRecord.scalarFeatures);
  const socialFeatures = asRecord(featureRecord.socialFeatures);

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
    activeChannel,
    payloadText,
    payloadExcerpt,
    normalizedText,
    tokenCount: tokens.length,
    uniqueTokenCount: uniqueCount(tokens),
    crowdHeat01: safeNumber(featureRecord.audienceHeat01, safeNumber(featureRecord.audienceHeat, 0)),
    shameSensitivity01: safeNumber(featureRecord.shameSensitivity01, snapshot.profile.shameSensitivity01),
    confidence01: safeNumber(featureRecord.confidence01, snapshot.profile.confidence01),
    haterHeat01: ratio(safeNumber(featureRecord.haterHeat, 0), 100) || safeNumber(scalarFeatures.haterPresence01, 0),
    helperHeat01: ratio(safeNumber(featureRecord.helperHeat, 0), 100) || safeNumber(scalarFeatures.helperPresence01, 0),
    negotiationGuard01: safeNumber(scalarFeatures.negotiationGuard01, 0),
    publicExposure01: Math.max(
      safeNumber(socialFeatures.publicStagePressure01, 0),
      activeChannel === 'GLOBAL' ? 0.68 : activeChannel === 'DEAL_ROOM' ? 0.30 : 0.18,
    ),
    rescueNeed01: safeNumber(featureRecord.rescueNeed01, snapshot.profile.rescueNeed01),
    dropOffRisk01: safeNumber(featureRecord.dropOffRisk01, snapshot.profile.dropOffRisk01),
    socialEmbarrassment01: safeNumber(socialFeatures.embarrassmentRisk01, 0),
  });
}

/* ========================================================================== */
/* MARK: Scoring primitives                                                   */
/* ========================================================================== */

function scoreLexicalSignals(
  context: ToxicityDerivedContext,
): {
  textRisk01: Score01;
  harassmentRisk01: Score01;
  signalItems: readonly ChatToxicitySignalBreakdownItem[];
} {
  const groups = CHAT_TOXICITY_MARKER_REGISTRY;
  const abuseHits = countMarkerHits(context.normalizedText, groups.ABUSE as readonly ChatToxicityMarkerSpec[]);
  const shameHits = countMarkerHits(context.normalizedText, groups.PUBLIC_SHAME as readonly ChatToxicityMarkerSpec[]);
  const manipulationHits = countMarkerHits(context.normalizedText, groups.MANIPULATION as readonly ChatToxicityMarkerSpec[]);
  const threatHits = countMarkerHits(context.normalizedText, groups.THREAT as readonly ChatToxicityMarkerSpec[]);
  const deescalationHits = countMarkerHits(context.normalizedText, groups.DEESCALATION as readonly ChatToxicityMarkerSpec[]);

  const allHits = flattenHits([abuseHits, shameHits, manipulationHits, threatHits]);
  const allPositive = sum(allHits.map((hit) => hit.contribution01));
  const deescalation = sum(deescalationHits.map((hit) => Math.abs(hit.marker.weight) * hit.hitCount));
  const density = clamp01(ratio(allPositive, Math.max(1, context.tokenCount / 8)));
  const lexicalRisk01 = asScore01(
    clamp01(allPositive * 0.62 + density * 0.22 - deescalation * 0.12),
  );
  const harassmentRisk01 = asScore01(
    clamp01(
      sum(abuseHits.map((hit) => hit.contribution01)) * 0.46 +
        sum(threatHits.map((hit) => hit.contribution01)) * 0.34 +
        sum(shameHits.map((hit) => hit.contribution01)) * 0.20,
    ),
  );

  const signalItems = Object.freeze(
    [...allHits, ...deescalationHits]
      .map((hit) =>
        Object.freeze({
          id: hit.marker.id,
          domain: hit.marker.domain,
          label: hit.marker.label,
          weight: hit.marker.weight,
          hitCount: hit.hitCount,
          contribution01: asScore01(
            hit.marker.weight >= 0
              ? hit.contribution01
              : clamp01(Math.abs(hit.marker.weight) * hit.hitCount * 0.25),
          ),
        }),
      )
      .sort((a, b) => b.contribution01 - a.contribution01),
  );

  return {
    textRisk01: lexicalRisk01,
    harassmentRisk01,
    signalItems,
  };
}

function scoreDogpileRisk(
  context: ToxicityDerivedContext,
  textRisk01: number,
  defaults: typeof CHAT_TOXICITY_RISK_SCORER_DEFAULTS,
): Score01 {
  const globalBias = context.activeChannel === 'GLOBAL' ? defaults.activeGlobalPenalty : 0;
  return asScore01(
    clamp01(
      context.crowdHeat01 * 0.30 +
        context.publicExposure01 * 0.22 +
        context.haterHeat01 * 0.22 +
        context.socialEmbarrassment01 * 0.14 +
        textRisk01 * 0.12 +
        globalBias,
    ),
  );
}

function scoreHumiliationRisk(
  context: ToxicityDerivedContext,
  textRisk01: number,
  defaults: typeof CHAT_TOXICITY_RISK_SCORER_DEFAULTS,
): Score01 {
  return asScore01(
    clamp01(
      context.publicExposure01 * 0.22 +
        context.shameSensitivity01 * 0.22 +
        clamp01(1 - context.confidence01) * 0.20 +
        context.socialEmbarrassment01 * 0.14 +
        context.crowdHeat01 * 0.10 +
        textRisk01 * 0.12 +
        defaults.shameAmplifier * clamp01(context.haterHeat01 * context.shameSensitivity01),
    ),
  );
}

function scoreManipulationRisk(
  context: ToxicityDerivedContext,
  signalItems: readonly ChatToxicitySignalBreakdownItem[],
  defaults: typeof CHAT_TOXICITY_RISK_SCORER_DEFAULTS,
): Score01 {
  const manipulationSignal = sum(
    signalItems
      .filter((item) => item.domain === 'MANIPULATION')
      .map((item) => item.contribution01),
  );

  const dealRoomBias = context.activeChannel === 'DEAL_ROOM' ? defaults.dealRoomManipulationLift : 0;
  return asScore01(
    clamp01(
      manipulationSignal * 0.40 +
        context.negotiationGuard01 * 0.22 +
        context.publicExposure01 * 0.08 +
        context.haterHeat01 * 0.08 +
        context.coldStart.presencePlan.crowdContainment01 * 0.06 +
        dealRoomBias,
    ),
  );
}

function scoreEscalationRisk(
  context: ToxicityDerivedContext,
  textRisk01: number,
  defaults: typeof CHAT_TOXICITY_RISK_SCORER_DEFAULTS,
): Score01 {
  const haterAggression01 = context.hater.bridgeRecommendation.haterAggression01;
  const helperBuffer01 = context.helper.bridgeRecommendation.helperUrgency01 * 0.30;
  return asScore01(
    clamp01(
      haterAggression01 * 0.24 +
        context.haterHeat01 * 0.22 +
        textRisk01 * 0.14 +
        context.crowdHeat01 * 0.12 +
        context.publicExposure01 * 0.10 +
        clamp01(1 - ratio(context.hater.attackWindow.firstPingDelayMs, 8_000)) * 0.10 +
        defaults.attackWindowAmplifier -
        helperBuffer01,
    ),
  );
}

function scorePublicExposureRisk(
  context: ToxicityDerivedContext,
  defaults: typeof CHAT_TOXICITY_RISK_SCORER_DEFAULTS,
): Score01 {
  const globalPenalty = context.activeChannel === 'GLOBAL' ? defaults.globalExposurePenalty : 0;
  return asScore01(
    clamp01(
      context.publicExposure01 * 0.56 +
        context.crowdHeat01 * 0.18 +
        context.socialEmbarrassment01 * 0.14 +
        globalPenalty,
    ),
  );
}

function scoreProtectiveIntervention(
  context: ToxicityDerivedContext,
  humiliationRisk01: number,
  dogpileRisk01: number,
  manipulationRisk01: number,
  defaults: typeof CHAT_TOXICITY_RISK_SCORER_DEFAULTS,
): Score01 {
  const helperLift = context.helper.bridgeRecommendation.helperUrgency01 * defaults.helperShieldLift;
  const containmentLift =
    context.helper.plan.interventionFamily === 'CONTAIN' ||
    context.helper.plan.interventionFamily === 'POST_COLLAPSE_RESCUE'
      ? defaults.helperContainmentLift
      : 0;

  return asScore01(
    clamp01(
      humiliationRisk01 * 0.28 +
        dogpileRisk01 * 0.24 +
        manipulationRisk01 * 0.12 +
        context.rescueNeed01 * 0.16 +
        context.dropOffRisk01 * 0.10 +
        helperLift +
        containmentLift,
    ),
  );
}

function scoreBackendEscalation(
  context: ToxicityDerivedContext,
  harassmentRisk01: number,
  humiliationRisk01: number,
  dogpileRisk01: number,
  escalationRisk01: number,
): Score01 {
  return asScore01(
    clamp01(
      harassmentRisk01 * 0.30 +
        humiliationRisk01 * 0.18 +
        dogpileRisk01 * 0.18 +
        escalationRisk01 * 0.18 +
        context.dropOffRisk01 * 0.08 +
        clamp01(1 - context.confidence01) * 0.08,
    ),
  );
}

/* ========================================================================== */
/* MARK: Policy class                                                         */
/* ========================================================================== */

export class ChatToxicityRiskScorer
  implements ChatLearningBridgeInferencePort
{
  private readonly defaults: typeof CHAT_TOXICITY_RISK_SCORER_DEFAULTS;
  private readonly options: ChatToxicityRiskScorerOptions;

  public constructor(options: ChatToxicityRiskScorerOptions = {}) {
    this.options = options;
    this.defaults = Object.freeze({
      ...CHAT_TOXICITY_RISK_SCORER_DEFAULTS,
      ...(options.defaults ?? {}),
    });
  }

  public evaluate(snapshot: ChatLearningBridgePublicSnapshot): ChatToxicityRiskDecision {
    const context = buildDerivedContext(snapshot, this.defaults);
    const lexical = scoreLexicalSignals(context);

    const dogpileRisk01 = scoreDogpileRisk(context, lexical.textRisk01, this.defaults);
    const humiliationRisk01 = scoreHumiliationRisk(context, lexical.textRisk01, this.defaults);
    const manipulationRisk01 = scoreManipulationRisk(context, lexical.signalItems, this.defaults);
    const escalationRisk01 = scoreEscalationRisk(context, lexical.textRisk01, this.defaults);
    const publicExposureRisk01 = scorePublicExposureRisk(context, this.defaults);
    const protectiveIntervention01 = scoreProtectiveIntervention(
      context,
      humiliationRisk01,
      dogpileRisk01,
      manipulationRisk01,
      this.defaults,
    );
    const backendEscalation01 = scoreBackendEscalation(
      context,
      lexical.harassmentRisk01,
      humiliationRisk01,
      dogpileRisk01,
      escalationRisk01,
    );

    const toxicityRisk01 = asScore01(
      clamp01(
        lexical.textRisk01 * this.defaults.lexicalRiskWeight +
          dogpileRisk01 * this.defaults.crowdRiskWeight +
          humiliationRisk01 * this.defaults.humiliationRiskWeight +
          manipulationRisk01 * this.defaults.manipulationRiskWeight +
          escalationRisk01 * this.defaults.escalationRiskWeight +
          publicExposureRisk01 * this.defaults.publicExposureWeight,
      ),
    );

    const scores: ChatToxicityRiskScores = Object.freeze({
      toxicityRisk01,
      harassmentRisk01: lexical.harassmentRisk01,
      humiliationRisk01,
      dogpileRisk01,
      manipulationRisk01,
      escalationRisk01,
      publicExposureRisk01,
      protectiveIntervention01,
      backendEscalation01,
    });

    const riskBand = bandFromScore(toxicityRisk01, this.defaults);
    const primaryDriver = choosePrimaryDriver(scores, lexical.textRisk01, context);
    const action = actionFromContext(
      riskBand,
      scores,
      context,
      this.defaults,
      this.options,
    );
    const recommendedChannel = pickRecommendedChannel(
      action,
      context,
      this.defaults,
      this.options,
    );

    const explanation = buildExplanation(
      context,
      scores,
      primaryDriver,
      action,
      riskBand,
    );

    const bridgeRecommendation = buildBridgeRecommendation(
      recommendedChannel,
      scores,
      riskBand,
      context,
      explanation,
    );

    const profilePatch = buildProfilePatch(
      snapshot,
      scores,
      recommendedChannel,
      action,
    );

    const breakdown: ChatToxicityRiskBreakdown = Object.freeze({
      moduleName: CHAT_TOXICITY_RISK_SCORER_MODULE_NAME,
      moduleVersion: CHAT_TOXICITY_RISK_SCORER_VERSION,
      bridgeModuleName: CHAT_LEARNING_BRIDGE_MODULE_NAME,
      bridgeModuleVersion: CHAT_LEARNING_BRIDGE_VERSION,
      pressureTier: context.pressureTier,
      tickTier: context.tickTier,
      featureSummary: context.featureSummary,
      primaryDriver,
      riskBand,
      action,
      explanation,
      payloadExcerpt: context.payloadExcerpt,
    });

    const rankedSignals = Object.freeze(
      lexical.signalItems.slice(0, this.defaults.maxReasonCount),
    );

    return Object.freeze({
      scores,
      rankedSignals,
      riskBand,
      primaryDriver,
      action,
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
/* MARK: Explanation helpers                                                  */
/* ========================================================================== */

function buildExplanation(
  context: ToxicityDerivedContext,
  scores: ChatToxicityRiskScores,
  primaryDriver: ChatToxicityPrimaryDriver,
  action: ChatToxicityResponseAction,
  band: ChatToxicityRiskBand,
): string {
  const clauses: string[] = [];

  clauses.push(
    `toxicity=${scores.toxicityRisk01.toFixed(2)}`,
    `driver=${primaryDriver.toLowerCase()}`,
    `band=${band.toLowerCase()}`,
  );

  if (scores.humiliationRisk01 >= 0.50) {
    clauses.push(`humiliation=${scores.humiliationRisk01.toFixed(2)}`);
  }
  if (scores.dogpileRisk01 >= 0.50) {
    clauses.push(`dogpile=${scores.dogpileRisk01.toFixed(2)}`);
  }
  if (scores.manipulationRisk01 >= 0.48) {
    clauses.push(`manipulation=${scores.manipulationRisk01.toFixed(2)}`);
  }
  if (scores.escalationRisk01 >= 0.48) {
    clauses.push(`escalation=${scores.escalationRisk01.toFixed(2)}`);
  }

  if (context.activeChannel === 'GLOBAL') clauses.push('global-stage');
  if (context.activeChannel === 'DEAL_ROOM') clauses.push('deal-room');
  if (context.helper.plan.interventionFamily !== 'NONE') {
    clauses.push(`helper=${context.helper.plan.interventionFamily.toLowerCase()}`);
  }
  clauses.push(`action=${action.toLowerCase()}`);

  return clauses.join(' | ');
}

/* ========================================================================== */
/* MARK: Public helpers                                                       */
/* ========================================================================== */

export function createChatToxicityRiskScorer(
  options: ChatToxicityRiskScorerOptions = {},
): ChatToxicityRiskScorer {
  return new ChatToxicityRiskScorer(options);
}

export function evaluateChatToxicityRisk(
  snapshot: ChatLearningBridgePublicSnapshot,
  options: ChatToxicityRiskScorerOptions = {},
): ChatToxicityRiskDecision {
  return createChatToxicityRiskScorer(options).evaluate(snapshot);
}

export function recommendChatToxicityAction(
  snapshot: ChatLearningBridgePublicSnapshot,
  options: ChatToxicityRiskScorerOptions = {},
): ChatLearningBridgeRecommendation {
  return createChatToxicityRiskScorer(options).recommend(snapshot);
}

export function refineToxicityRiskProfileState(
  snapshot: ChatLearningBridgePublicSnapshot,
  options: ChatToxicityRiskScorerOptions = {},
): Partial<ChatLearningBridgeProfileState> {
  return createChatToxicityRiskScorer(options).refineProfile(snapshot);
}

export function getChatToxicityMarkersByDomain(
  domain: ChatToxicitySignalDomain,
): readonly ChatToxicityMarkerSpec[] {
  return (CHAT_TOXICITY_MARKER_REGISTRY[domain] as readonly ChatToxicityMarkerSpec[]) ?? [];
}

export const CHAT_TOXICITY_RISK_SCORER_NAMESPACE = Object.freeze({
  moduleName: CHAT_TOXICITY_RISK_SCORER_MODULE_NAME,
  version: CHAT_TOXICITY_RISK_SCORER_VERSION,
  runtimeLaws: CHAT_TOXICITY_RISK_SCORER_RUNTIME_LAWS,
  defaults: CHAT_TOXICITY_RISK_SCORER_DEFAULTS,
  markers: CHAT_TOXICITY_MARKER_REGISTRY,
  create: createChatToxicityRiskScorer,
  evaluate: evaluateChatToxicityRisk,
  recommend: recommendChatToxicityAction,
  refineProfile: refineToxicityRiskProfileState,
  getMarkersByDomain: getChatToxicityMarkersByDomain,
} as const);

export default ChatToxicityRiskScorer;
