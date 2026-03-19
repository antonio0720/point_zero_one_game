
/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT RIVALRY ESCALATION POLICY
 * FILE: backend/src/game/engine/chat/memory/RivalryEscalationPolicy.ts
 * VERSION: 2026.03.18
 * ============================================================================
 */

import type {
  ChatRelationshipCounterpartState,
  ChatRelationshipEventDescriptor,
  ChatRelationshipEventType,
  ChatRelationshipLegacyProjection,
  ChatRelationshipNpcSignal,
  ChatRelationshipPressureBand,
  ChatRelationshipStance,
} from '../../../../../shared/contracts/chat/relationship';
import { clamp01 } from '../../../../../shared/contracts/chat/relationship';

export type RivalryEscalationTier = 'NONE' | 'GLARE' | 'PROBE' | 'PRESSURE' | 'HUNT' | 'PUBLIC_SWARM' | 'BOSS_WINDOW';
export type RivalrySuppressionReason = 'HELPER_PROTECTION' | 'LOW_SIGNAL' | 'PRIVATE_CONTEXT' | 'NEGOTIATION_DECORUM' | 'POST_RUN_COOLDOWN' | 'REPLAY_ONLY' | 'NONE';

export interface RivalryEscalationContext {
  readonly now: number;
  readonly channelId?: string | null;
  readonly roomId?: string | null;
  readonly pressureBand: ChatRelationshipPressureBand;
  readonly mode: 'DEFAULT' | 'SCENE_COMPOSITION' | 'LIVE_REPLY' | 'REPLAY' | 'POST_RUN' | 'DEAL_ROOM' | 'RESCUE' | 'WORLD_EVENT';
  readonly sourceEvent?: ChatRelationshipEventDescriptor | null;
  readonly allowPublicSwarm: boolean;
  readonly rescueWindowOpen: boolean;
  readonly negotiationWindowOpen: boolean;
  readonly allowDelayedReveal: boolean;
  readonly allowReceipts: boolean;
}

export interface RivalryEscalationCallbackInput {
  readonly tier: 'NONE' | 'LIGHT' | 'MODERATE' | 'HARD' | 'RECEIPT';
  readonly callbackId?: string;
  readonly label?: string;
  readonly text?: string;
  readonly suitability01: number;
  readonly humiliationRisk01: number;
  readonly witnessValue01: number;
  readonly safeForPublic: boolean;
}

export interface RivalryEscalationRequest {
  readonly state: ChatRelationshipCounterpartState;
  readonly signal: ChatRelationshipNpcSignal;
  readonly legacy: ChatRelationshipLegacyProjection;
  readonly context: RivalryEscalationContext;
  readonly callback: RivalryEscalationCallbackInput;
}

export interface RivalryEscalationAssessment {
  readonly hostility01: number;
  readonly rivalry01: number;
  readonly publicStageFit01: number;
  readonly privateStageFit01: number;
  readonly obsessionHeat01: number;
  readonly witnessMagnet01: number;
  readonly rescueCounterweight01: number;
  readonly humiliationValue01: number;
  readonly negotiationDiscipline01: number;
  readonly cooldown01: number;
  readonly bossFightReadiness01: number;
}

export interface RivalryAttackWindow {
  readonly open: boolean;
  readonly startsInMs: number;
  readonly durationMs: number;
  readonly shouldTelegraph: boolean;
  readonly telegraphStrength01: number;
  readonly revealDelayMs: number;
}

export interface RivalryEscalationDecision {
  readonly selectedTier: RivalryEscalationTier;
  readonly selectedScore01: number;
  readonly shadowHeat01: number;
  readonly publicEmbarrassment01: number;
  readonly shouldUseCallback: boolean;
  readonly shouldQuotePlayerBack: boolean;
  readonly shouldPreferSilence: boolean;
  readonly shouldDelayReveal: boolean;
  readonly shouldSuppressHelpers: boolean;
  readonly shouldForcePublicWitness: boolean;
  readonly shouldEscalateToBossFight: boolean;
  readonly preferredWitnessCount: number;
  readonly suppressionReason: RivalrySuppressionReason;
  readonly attackWindow: RivalryAttackWindow;
  readonly tags: readonly string[];
  readonly notes: readonly string[];
  readonly assessment: RivalryEscalationAssessment;
}

export interface RivalryEscalationPolicyConfig {
  readonly glareFloor01: number;
  readonly probeFloor01: number;
  readonly pressureFloor01: number;
  readonly huntFloor01: number;
  readonly publicSwarmFloor01: number;
  readonly bossWindowFloor01: number;
  readonly rescueSuppressionFloor01: number;
  readonly delayedRevealFloor01: number;
  readonly callbackPublicFloor01: number;
  readonly humiliationReceiptFloor01: number;
  readonly negotiationDisciplineFloor01: number;
  readonly cooldownPenalty01: number;
  readonly stanceBiases: Readonly<Record<ChatRelationshipStance, number>>;
  readonly channelBiases: Readonly<Record<string, number>>;
  readonly pressureBiases: Readonly<Record<ChatRelationshipPressureBand, number>>;
  readonly eventHeat: Readonly<Record<ChatRelationshipEventType, number>>;
}

const DEFAULT_STANCE_BIASES: Readonly<Record<ChatRelationshipStance, number>> = Object.freeze({
  DISMISSIVE: 0.08, CLINICAL: 0.17, PROBING: 0.32, PREDATORY: 0.54, HUNTING: 0.72,
  OBSESSED: 0.88, RESPECTFUL: 0.21, WOUNDED: 0.28, PROTECTIVE: 0.14, CURIOUS: 0.19,
});

const DEFAULT_CHANNEL_BIASES: Readonly<Record<string, number>> = Object.freeze({
  GLOBAL: 0.92, SYNDICATE: 0.63, DEAL_ROOM: 0.38, DIRECT: 0.29, SPECTATOR: 0.86, SYSTEM: 0.18,
});

const DEFAULT_PRESSURE_BIASES: Readonly<Record<ChatRelationshipPressureBand, number>> = Object.freeze({
  LOW: 0.12, MEDIUM: 0.33, HIGH: 0.63, CRITICAL: 0.91,
});

const DEFAULT_EVENT_SEVERITY: Readonly<Record<ChatRelationshipEventType, number>> = Object.freeze({
  'PLAYER_MESSAGE': 0.26,
  'PLAYER_QUESTION': 0.24,
  'PLAYER_ANGER': 0.54,
  'PLAYER_TROLL': 0.58,
  'PLAYER_FLEX': 0.61,
  'PLAYER_CALM': 0.19,
  'PLAYER_HESITATION': 0.33,
  'PLAYER_DISCIPLINE': 0.42,
  'PLAYER_GREED': 0.57,
  'PLAYER_BLUFF': 0.52,
  'PLAYER_OVERCONFIDENCE': 0.68,
  'PLAYER_COMEBACK': 0.76,
  'PLAYER_COLLAPSE': 0.72,
  'PLAYER_BREACH': 0.81,
  'PLAYER_PERFECT_DEFENSE': 0.73,
  'PLAYER_FAILED_GAMBLE': 0.66,
  'PLAYER_NEAR_SOVEREIGNTY': 0.88,
  'NEGOTIATION_WINDOW': 0.44,
  'MARKET_ALERT': 0.39,
  'BOT_TAUNT_EMITTED': 0.37,
  'BOT_RETREAT_EMITTED': 0.41,
  'HELPER_RESCUE_EMITTED': 0.63,
  'RIVAL_WITNESS_EMITTED': 0.47,
  'ARCHIVIST_WITNESS_EMITTED': 0.29,
  'AMBIENT_WITNESS_EMITTED': 0.25,
  'PUBLIC_WITNESS': 0.48,
  'PRIVATE_WITNESS': 0.27,
  'RUN_START': 0.22,
  'RUN_END': 0.51,
});

export const DEFAULT_RIVALRY_ESCALATION_POLICY_CONFIG: RivalryEscalationPolicyConfig = Object.freeze({
  glareFloor01: 0.18,
  probeFloor01: 0.29,
  pressureFloor01: 0.44,
  huntFloor01: 0.59,
  publicSwarmFloor01: 0.72,
  bossWindowFloor01: 0.84,
  rescueSuppressionFloor01: 0.57,
  delayedRevealFloor01: 0.53,
  callbackPublicFloor01: 0.49,
  humiliationReceiptFloor01: 0.67,
  negotiationDisciplineFloor01: 0.54,
  cooldownPenalty01: 0.18,
  stanceBiases: DEFAULT_STANCE_BIASES,
  channelBiases: DEFAULT_CHANNEL_BIASES,
  pressureBiases: DEFAULT_PRESSURE_BIASES,
  eventHeat: DEFAULT_EVENT_HEAT,
});

function eventTypeOr(request: RivalryEscalationRequest): ChatRelationshipEventType { return request.context.sourceEvent?.eventType ?? 'PLAYER_MESSAGE'; }
function channelKey(request: RivalryEscalationRequest): string { return (request.context.channelId ?? request.state.lastChannelId ?? 'GLOBAL').toUpperCase(); }
function isPrivateChannel(channelId: string): boolean { return channelId === 'DIRECT'; }
function isDealRoom(channelId: string): boolean { return channelId === 'DEAL_ROOM'; }
function isPublicArena(channelId: string): boolean { return channelId === 'GLOBAL' || channelId === 'SPECTATOR'; }

function hostility01(request: RivalryEscalationRequest, config: RivalryEscalationPolicyConfig): number {
  const state = request.state;
  const signal = request.signal;
  const eventHeat = config.eventHeat[eventTypeOr(request)];
  return clamp01(state.vector.contempt01 * 0.28 + state.vector.obsession01 * 0.19 + state.vector.unfinishedBusiness01 * 0.19 + signal.predictiveConfidence01 * 0.09 + eventHeat * 0.11 + config.stanceBiases[state.stance] * 0.14);
}

function rivalry01(request: RivalryEscalationRequest): number {
  const state = request.state;
  return clamp01(state.intensity01 * 0.34 + state.vector.contempt01 * 0.17 + state.vector.fascination01 * 0.12 + state.vector.obsession01 * 0.16 + state.vector.unfinishedBusiness01 * 0.21);
}

function publicStageFit01(request: RivalryEscalationRequest, config: RivalryEscalationPolicyConfig): number {
  const channelBias = config.channelBiases[channelKey(request)] ?? 0.5;
  const eventHeat = config.eventHeat[eventTypeOr(request)];
  return clamp01(request.state.publicPressureBias01 * 0.48 + request.callback.witnessValue01 * 0.16 + request.signal.obsession01 * 0.09 + eventHeat * 0.12 + channelBias * 0.15);
}

function privateStageFit01(request: RivalryEscalationRequest): number {
  const channel = channelKey(request);
  return clamp01(request.state.privatePressureBias01 * 0.63 + request.state.vector.familiarity01 * 0.14 + request.state.vector.predictiveConfidence01 * 0.09 + (isPrivateChannel(channel) ? 0.24 : 0) + (isDealRoom(channel) ? 0.14 : 0));
}

function rescueCounterweight01(request: RivalryEscalationRequest): number {
  const state = request.state;
  return clamp01(state.vector.traumaDebt01 * 0.34 + state.vector.familiarity01 * 0.23 + state.vector.respect01 * 0.17 + (request.context.rescueWindowOpen ? 0.17 : 0));
}

function humiliationValue01(request: RivalryEscalationRequest): number {
  return clamp01(request.callback.humiliationRisk01 * 0.34 + request.callback.suitability01 * 0.18 + (request.legacy.rivalryIntensity / 100) * 0.22 + (request.legacy.contempt / 100) * 0.14 + (request.legacy.fascination / 100) * 0.12);
}

function negotiationDiscipline01(request: RivalryEscalationRequest): number {
  const channel = channelKey(request);
  return clamp01((isDealRoom(channel) ? 0.34 : 0) + request.state.vector.predictiveConfidence01 * 0.24 + request.state.vector.patience01 * 0.18 + request.state.vector.familiarity01 * 0.06);
}

function cooldown01(request: RivalryEscalationRequest, config: RivalryEscalationPolicyConfig): number {
  const ageMs = Math.max(0, request.context.now - request.state.lastTouchedAt);
  const base = ageMs <= 5_000 ? config.cooldownPenalty01 : ageMs <= 20_000 ? config.cooldownPenalty01 * 0.78 : ageMs <= 60_000 ? config.cooldownPenalty01 * 0.42 : 0;
  return clamp01(base + (request.context.mode === 'POST_RUN' ? 0.09 : 0));
}

function bossFightReadiness01(request: RivalryEscalationRequest, hostility: number, rivalry: number, publicFit: number): number {
  return clamp01(hostility * 0.24 + rivalry * 0.22 + request.state.vector.obsession01 * 0.18 + request.state.vector.predictiveConfidence01 * 0.10 + request.state.vector.unfinishedBusiness01 * 0.12 + publicFit * 0.14);
}

function buildAssessment(request: RivalryEscalationRequest, config: RivalryEscalationPolicyConfig): RivalryEscalationAssessment {
  const host = hostility01(request, config);
  const rivalry = rivalry01(request);
  const publicFit = publicStageFit01(request, config);
  const privateFit = privateStageFit01(request);
  const obsessionHeat = clamp01(request.state.vector.obsession01 * 0.63 + request.state.vector.fascination01 * 0.19 + request.state.vector.unfinishedBusiness01 * 0.18);
  const rescue = rescueCounterweight01(request);
  const humiliation = humiliationValue01(request);
  const discipline = negotiationDiscipline01(request);
  const cool = cooldown01(request, config);
  return { hostility01: host, rivalry01: rivalry, publicStageFit01: publicFit, privateStageFit01: privateFit, obsessionHeat01: obsessionHeat, witnessMagnet01: clamp01(publicFit * 0.62 + request.callback.witnessValue01 * 0.38), rescueCounterweight01: rescue, humiliationValue01: humiliation, negotiationDiscipline01: discipline, cooldown01: cool, bossFightReadiness01: bossFightReadiness01(request, host, rivalry, publicFit) };
}

function selectedScore01(request: RivalryEscalationRequest, assessment: RivalryEscalationAssessment, config: RivalryEscalationPolicyConfig): number {
  const pressureBias = config.pressureBiases[request.context.pressureBand];
  const publicBoost = request.context.allowPublicSwarm ? assessment.publicStageFit01 * 0.09 : 0;
  const receiptBoost = request.callback.tier === 'RECEIPT' && request.context.allowReceipts ? 0.07 : 0;
  return clamp01(assessment.hostility01 * 0.28 + assessment.rivalry01 * 0.19 + assessment.obsessionHeat01 * 0.14 + assessment.humiliationValue01 * 0.09 + assessment.bossFightReadiness01 * 0.08 + pressureBias * 0.10 + publicBoost + receiptBoost - assessment.rescueCounterweight01 * 0.08 - assessment.negotiationDiscipline01 * 0.07 - assessment.cooldown01 * 0.07);
}

function chooseTier(request: RivalryEscalationRequest, assessment: RivalryEscalationAssessment, score: number, config: RivalryEscalationPolicyConfig): RivalryEscalationTier {
  const channel = channelKey(request);
  if (score >= config.bossWindowFloor01 && assessment.bossFightReadiness01 >= config.bossWindowFloor01 && !request.context.rescueWindowOpen && !isDealRoom(channel)) return 'BOSS_WINDOW';
  if (request.context.allowPublicSwarm && assessment.publicStageFit01 >= config.publicSwarmFloor01 && score >= config.publicSwarmFloor01 && isPublicArena(channel)) return 'PUBLIC_SWARM';
  if (score >= config.huntFloor01) return 'HUNT';
  if (score >= config.pressureFloor01) return 'PRESSURE';
  if (score >= config.probeFloor01) return 'PROBE';
  if (score >= config.glareFloor01) return 'GLARE';
  return 'NONE';
}

function suppressionReason(request: RivalryEscalationRequest, assessment: RivalryEscalationAssessment, tier: RivalryEscalationTier, config: RivalryEscalationPolicyConfig): RivalrySuppressionReason {
  if (tier !== 'NONE') return 'NONE';
  if (request.context.mode === 'REPLAY') return 'REPLAY_ONLY';
  if (request.context.mode === 'POST_RUN') return 'POST_RUN_COOLDOWN';
  if (assessment.rescueCounterweight01 >= config.rescueSuppressionFloor01) return 'HELPER_PROTECTION';
  if (assessment.negotiationDiscipline01 >= config.negotiationDisciplineFloor01) return 'NEGOTIATION_DECORUM';
  if (assessment.publicStageFit01 < 0.18 && assessment.privateStageFit01 < 0.18) return 'PRIVATE_CONTEXT';
  return 'LOW_SIGNAL';
}

function attackWindow(request: RivalryEscalationRequest, tier: RivalryEscalationTier, assessment: RivalryEscalationAssessment): RivalryAttackWindow {
  const immediate = tier === 'PUBLIC_SWARM' || tier === 'BOSS_WINDOW';
  const startsInMs = !request.context.allowDelayedReveal ? 0 : immediate ? Math.round(50 + assessment.cooldown01 * 80) : Math.round(280 + (1 - assessment.hostility01) * 520 + assessment.cooldown01 * 320);
  const durationMs = tier === 'BOSS_WINDOW' ? 3800 : tier === 'PUBLIC_SWARM' ? 2600 : tier === 'HUNT' ? 2200 : tier === 'PRESSURE' ? 1600 : tier === 'PROBE' ? 1200 : tier === 'GLARE' ? 900 : 0;
  return { open: tier !== 'NONE', startsInMs, durationMs, shouldTelegraph: tier === 'HUNT' || tier === 'PUBLIC_SWARM' || tier === 'BOSS_WINDOW', telegraphStrength01: clamp01((tier === 'BOSS_WINDOW' ? 0.88 : tier === 'PUBLIC_SWARM' ? 0.76 : tier === 'HUNT' ? 0.58 : 0.24) + assessment.obsessionHeat01 * 0.12), revealDelayMs: tier === 'NONE' ? 0 : tier === 'GLARE' ? Math.round(220 + assessment.cooldown01 * 200) : tier === 'PROBE' ? Math.round(340 + assessment.cooldown01 * 260) : Math.round(120 + assessment.cooldown01 * 120) };
}

function shouldUseCallback(request: RivalryEscalationRequest, assessment: RivalryEscalationAssessment, config: RivalryEscalationPolicyConfig): boolean {
  if (!request.context.allowReceipts) return false;
  if (request.callback.tier === 'NONE') return false;
  if (request.callback.tier === 'RECEIPT') return assessment.humiliationValue01 >= config.humiliationReceiptFloor01;
  return request.callback.suitability01 >= config.callbackPublicFloor01 || assessment.privateStageFit01 >= 0.52;
}

function tags(request: RivalryEscalationRequest, tier: RivalryEscalationTier, assessment: RivalryEscalationAssessment): readonly string[] {
  const out = new Set<string>();
  out.add(`tier:${tier.toLowerCase()}`);
  out.add(`stance:${request.state.stance.toLowerCase()}`);
  out.add(`objective:${request.state.objective.toLowerCase()}`);
  out.add(`channel:${channelKey(request).toLowerCase()}`);
  out.add(`pressure:${request.context.pressureBand.toLowerCase()}`);
  if (assessment.obsessionHeat01 >= 0.62) out.add('obsession:hot');
  if (assessment.humiliationValue01 >= 0.61) out.add('humiliation:valuable');
  if (assessment.rescueCounterweight01 >= 0.57) out.add('rescue:counterweight');
  if (request.callback.tier !== 'NONE') out.add(`callback:${request.callback.tier.toLowerCase()}`);
  return Object.freeze([...out]);
}

function notes(request: RivalryEscalationRequest, assessment: RivalryEscalationAssessment, score: number, tier: RivalryEscalationTier): readonly string[] {
  const lines = [`tier=${tier}`, `score=${score.toFixed(3)}`, `hostility=${assessment.hostility01.toFixed(3)}`, `rivalry=${assessment.rivalry01.toFixed(3)}`, `public_fit=${assessment.publicStageFit01.toFixed(3)}`, `private_fit=${assessment.privateStageFit01.toFixed(3)}`, `boss_readiness=${assessment.bossFightReadiness01.toFixed(3)}`, `cooldown=${assessment.cooldown01.toFixed(3)}`, `event=${eventTypeOr(request)}`];
  if (request.callback.tier !== 'NONE') lines.push(`callback=${request.callback.tier}:${request.callback.label ?? 'latest'}`);
  return Object.freeze(lines);
}

export class RivalryEscalationPolicy {
  private readonly config: RivalryEscalationPolicyConfig;

  public constructor(config: Partial<RivalryEscalationPolicyConfig> = {}) {
    this.config = Object.freeze({
      ...DEFAULT_RIVALRY_ESCALATION_POLICY_CONFIG,
      ...config,
      stanceBiases: Object.freeze({ ...DEFAULT_RIVALRY_ESCALATION_POLICY_CONFIG.stanceBiases, ...(config.stanceBiases ?? {}) }),
      channelBiases: Object.freeze({ ...DEFAULT_RIVALRY_ESCALATION_POLICY_CONFIG.channelBiases, ...(config.channelBiases ?? {}) }),
      pressureBiases: Object.freeze({ ...DEFAULT_RIVALRY_ESCALATION_POLICY_CONFIG.pressureBiases, ...(config.pressureBiases ?? {}) }),
      eventHeat: Object.freeze({ ...DEFAULT_RIVALRY_ESCALATION_POLICY_CONFIG.eventHeat, ...(config.eventHeat ?? {}) }),
    });
  }

  public assess(request: RivalryEscalationRequest): RivalryEscalationAssessment { return buildAssessment(request, this.config); }

  public resolve(request: RivalryEscalationRequest): RivalryEscalationDecision {
    const assessment = this.assess(request);
    const score = selectedScore01(request, assessment, this.config);
    const tier = chooseTier(request, assessment, score, this.config);
    const suppression = suppressionReason(request, assessment, tier, this.config);
    const window = attackWindow(request, tier, assessment);
    const shouldUse = shouldUseCallback(request, assessment, this.config);
    const shouldForcePublicWitness = request.context.allowPublicSwarm && (tier === 'PUBLIC_SWARM' || tier === 'BOSS_WINDOW' || assessment.witnessMagnet01 >= 0.72);
    const shouldDelayReveal = request.context.allowDelayedReveal && (tier === 'GLARE' || tier === 'PROBE' || (tier === 'PRESSURE' && assessment.cooldown01 >= 0.07));
    const shouldPreferSilence = suppression !== 'NONE' || (assessment.privateStageFit01 > assessment.publicStageFit01 + 0.18 && tier !== 'BOSS_WINDOW');
    return Object.freeze({
      selectedTier: tier,
      selectedScore01: score,
      shadowHeat01: clamp01(assessment.hostility01 * 0.38 + assessment.obsessionHeat01 * 0.22 + assessment.witnessMagnet01 * 0.16 + assessment.cooldown01 * 0.06 + (shouldDelayReveal ? 0.10 : 0) + (shouldPreferSilence ? 0.08 : 0)),
      publicEmbarrassment01: clamp01(assessment.humiliationValue01 * 0.52 + assessment.publicStageFit01 * 0.28 + (shouldForcePublicWitness ? 0.12 : 0) + (shouldUse && request.callback.tier === 'RECEIPT' ? 0.08 : 0)),
      shouldUseCallback: shouldUse,
      shouldQuotePlayerBack: shouldUse && (request.callback.tier === 'HARD' || request.callback.tier === 'RECEIPT'),
      shouldPreferSilence,
      shouldDelayReveal,
      shouldSuppressHelpers: request.context.rescueWindowOpen && assessment.rescueCounterweight01 >= this.config.rescueSuppressionFloor01 && tier !== 'NONE',
      shouldForcePublicWitness,
      shouldEscalateToBossFight: tier === 'BOSS_WINDOW',
      preferredWitnessCount: tier === 'BOSS_WINDOW' ? 3 : tier === 'PUBLIC_SWARM' ? 3 : tier === 'HUNT' ? 2 : tier === 'PRESSURE' ? 1 : 0,
      suppressionReason: suppression,
      attackWindow: window,
      tags: tags(request, tier, assessment),
      notes: notes(request, assessment, score, tier),
      assessment,
    });
  }
}

export interface RivalryEventPreset { readonly eventType: ChatRelationshipEventType; readonly severity01: number; readonly publicness01: number; readonly hostility01: number; readonly prestige01: number; }
export const RIVALRY_EVENT_PRESETS: Readonly<Record<ChatRelationshipEventType, RivalryEventPreset>> = Object.freeze({
  'PLAYER_MESSAGE': { eventType: 'PLAYER_MESSAGE', severity01: 0.26, publicness01: 0.42, hostility01: 0.12, prestige01: 0.16 },
  'PLAYER_QUESTION': { eventType: 'PLAYER_QUESTION', severity01: 0.24, publicness01: 0.34, hostility01: 0.07, prestige01: 0.14 },
  'PLAYER_ANGER': { eventType: 'PLAYER_ANGER', severity01: 0.54, publicness01: 0.77, hostility01: 0.63, prestige01: 0.36 },
  'PLAYER_TROLL': { eventType: 'PLAYER_TROLL', severity01: 0.58, publicness01: 0.82, hostility01: 0.79, prestige01: 0.33 },
  'PLAYER_FLEX': { eventType: 'PLAYER_FLEX', severity01: 0.61, publicness01: 0.86, hostility01: 0.74, prestige01: 0.41 },
  'PLAYER_CALM': { eventType: 'PLAYER_CALM', severity01: 0.19, publicness01: 0.31, hostility01: 0.02, prestige01: 0.11 },
  'PLAYER_HESITATION': { eventType: 'PLAYER_HESITATION', severity01: 0.33, publicness01: 0.38, hostility01: 0.1, prestige01: 0.09 },
  'PLAYER_DISCIPLINE': { eventType: 'PLAYER_DISCIPLINE', severity01: 0.42, publicness01: 0.44, hostility01: 0.11, prestige01: 0.48 },
  'PLAYER_GREED': { eventType: 'PLAYER_GREED', severity01: 0.57, publicness01: 0.66, hostility01: 0.35, prestige01: 0.18 },
  'PLAYER_BLUFF': { eventType: 'PLAYER_BLUFF', severity01: 0.52, publicness01: 0.71, hostility01: 0.29, prestige01: 0.37 },
  'PLAYER_OVERCONFIDENCE': { eventType: 'PLAYER_OVERCONFIDENCE', severity01: 0.68, publicness01: 0.85, hostility01: 0.58, prestige01: 0.34 },
  'PLAYER_COMEBACK': { eventType: 'PLAYER_COMEBACK', severity01: 0.76, publicness01: 0.93, hostility01: 0.44, prestige01: 0.86 },
  'PLAYER_COLLAPSE': { eventType: 'PLAYER_COLLAPSE', severity01: 0.72, publicness01: 0.91, hostility01: 0.18, prestige01: 0.41 },
  'PLAYER_BREACH': { eventType: 'PLAYER_BREACH', severity01: 0.81, publicness01: 0.89, hostility01: 0.5, prestige01: 0.69 },
  'PLAYER_PERFECT_DEFENSE': { eventType: 'PLAYER_PERFECT_DEFENSE', severity01: 0.73, publicness01: 0.88, hostility01: 0.31, prestige01: 0.81 },
  'PLAYER_FAILED_GAMBLE': { eventType: 'PLAYER_FAILED_GAMBLE', severity01: 0.66, publicness01: 0.79, hostility01: 0.23, prestige01: 0.22 },
  'PLAYER_NEAR_SOVEREIGNTY': { eventType: 'PLAYER_NEAR_SOVEREIGNTY', severity01: 0.88, publicness01: 0.95, hostility01: 0.69, prestige01: 0.97 },
  'NEGOTIATION_WINDOW': { eventType: 'NEGOTIATION_WINDOW', severity01: 0.44, publicness01: 0.51, hostility01: 0.17, prestige01: 0.31 },
  'MARKET_ALERT': { eventType: 'MARKET_ALERT', severity01: 0.39, publicness01: 0.57, hostility01: 0.09, prestige01: 0.17 },
  'BOT_TAUNT_EMITTED': { eventType: 'BOT_TAUNT_EMITTED', severity01: 0.37, publicness01: 0.73, hostility01: 0.46, prestige01: 0.2 },
  'BOT_RETREAT_EMITTED': { eventType: 'BOT_RETREAT_EMITTED', severity01: 0.41, publicness01: 0.49, hostility01: 0.12, prestige01: 0.42 },
  'HELPER_RESCUE_EMITTED': { eventType: 'HELPER_RESCUE_EMITTED', severity01: 0.63, publicness01: 0.58, hostility01: 0.03, prestige01: 0.63 },
  'RIVAL_WITNESS_EMITTED': { eventType: 'RIVAL_WITNESS_EMITTED', severity01: 0.47, publicness01: 0.69, hostility01: 0.26, prestige01: 0.29 },
  'ARCHIVIST_WITNESS_EMITTED': { eventType: 'ARCHIVIST_WITNESS_EMITTED', severity01: 0.29, publicness01: 0.41, hostility01: 0.0, prestige01: 0.26 },
  'AMBIENT_WITNESS_EMITTED': { eventType: 'AMBIENT_WITNESS_EMITTED', severity01: 0.25, publicness01: 0.45, hostility01: 0.05, prestige01: 0.22 },
  'PUBLIC_WITNESS': { eventType: 'PUBLIC_WITNESS', severity01: 0.48, publicness01: 0.92, hostility01: 0.21, prestige01: 0.38 },
  'PRIVATE_WITNESS': { eventType: 'PRIVATE_WITNESS', severity01: 0.27, publicness01: 0.12, hostility01: 0.04, prestige01: 0.15 },
  'RUN_START': { eventType: 'RUN_START', severity01: 0.22, publicness01: 0.54, hostility01: 0.0, prestige01: 0.12 },
  'RUN_END': { eventType: 'RUN_END', severity01: 0.51, publicness01: 0.74, hostility01: 0.14, prestige01: 0.58 },
});

export const RIVALRY_SCENARIO_GLOBAL_LOW = Object.freeze({
  channelId: 'GLOBAL' as const,
  pressureBand: 'LOW' as const,
  publicBias01: 0.9,
  pressureBias01: 0.12,
});

export const RIVALRY_SCENARIO_GLOBAL_MEDIUM = Object.freeze({
  channelId: 'GLOBAL' as const,
  pressureBand: 'MEDIUM' as const,
  publicBias01: 0.9,
  pressureBias01: 0.33,
});

export const RIVALRY_SCENARIO_GLOBAL_HIGH = Object.freeze({
  channelId: 'GLOBAL' as const,
  pressureBand: 'HIGH' as const,
  publicBias01: 0.9,
  pressureBias01: 0.63,
});

export const RIVALRY_SCENARIO_GLOBAL_CRITICAL = Object.freeze({
  channelId: 'GLOBAL' as const,
  pressureBand: 'CRITICAL' as const,
  publicBias01: 0.9,
  pressureBias01: 0.91,
});

export const RIVALRY_SCENARIO_SYNDICATE_LOW = Object.freeze({
  channelId: 'SYNDICATE' as const,
  pressureBand: 'LOW' as const,
  publicBias01: 0.65,
  pressureBias01: 0.12,
});

export const RIVALRY_SCENARIO_SYNDICATE_MEDIUM = Object.freeze({
  channelId: 'SYNDICATE' as const,
  pressureBand: 'MEDIUM' as const,
  publicBias01: 0.65,
  pressureBias01: 0.33,
});

export const RIVALRY_SCENARIO_SYNDICATE_HIGH = Object.freeze({
  channelId: 'SYNDICATE' as const,
  pressureBand: 'HIGH' as const,
  publicBias01: 0.65,
  pressureBias01: 0.63,
});

export const RIVALRY_SCENARIO_SYNDICATE_CRITICAL = Object.freeze({
  channelId: 'SYNDICATE' as const,
  pressureBand: 'CRITICAL' as const,
  publicBias01: 0.65,
  pressureBias01: 0.91,
});

export const RIVALRY_SCENARIO_DEAL_ROOM_LOW = Object.freeze({
  channelId: 'DEAL_ROOM' as const,
  pressureBand: 'LOW' as const,
  publicBias01: 0.4,
  pressureBias01: 0.12,
});

export const RIVALRY_SCENARIO_DEAL_ROOM_MEDIUM = Object.freeze({
  channelId: 'DEAL_ROOM' as const,
  pressureBand: 'MEDIUM' as const,
  publicBias01: 0.4,
  pressureBias01: 0.33,
});

export const RIVALRY_SCENARIO_DEAL_ROOM_HIGH = Object.freeze({
  channelId: 'DEAL_ROOM' as const,
  pressureBand: 'HIGH' as const,
  publicBias01: 0.4,
  pressureBias01: 0.63,
});

export const RIVALRY_SCENARIO_DEAL_ROOM_CRITICAL = Object.freeze({
  channelId: 'DEAL_ROOM' as const,
  pressureBand: 'CRITICAL' as const,
  publicBias01: 0.4,
  pressureBias01: 0.91,
});

export const RIVALRY_SCENARIO_DIRECT_LOW = Object.freeze({
  channelId: 'DIRECT' as const,
  pressureBand: 'LOW' as const,
  publicBias01: 0.25,
  pressureBias01: 0.12,
});

export const RIVALRY_SCENARIO_DIRECT_MEDIUM = Object.freeze({
  channelId: 'DIRECT' as const,
  pressureBand: 'MEDIUM' as const,
  publicBias01: 0.25,
  pressureBias01: 0.33,
});

export const RIVALRY_SCENARIO_DIRECT_HIGH = Object.freeze({
  channelId: 'DIRECT' as const,
  pressureBand: 'HIGH' as const,
  publicBias01: 0.25,
  pressureBias01: 0.63,
});

export const RIVALRY_SCENARIO_DIRECT_CRITICAL = Object.freeze({
  channelId: 'DIRECT' as const,
  pressureBand: 'CRITICAL' as const,
  publicBias01: 0.25,
  pressureBias01: 0.91,
});

export const RIVALRY_SCENARIO_SPECTATOR_LOW = Object.freeze({
  channelId: 'SPECTATOR' as const,
  pressureBand: 'LOW' as const,
  publicBias01: 0.9,
  pressureBias01: 0.12,
});

export const RIVALRY_SCENARIO_SPECTATOR_MEDIUM = Object.freeze({
  channelId: 'SPECTATOR' as const,
  pressureBand: 'MEDIUM' as const,
  publicBias01: 0.9,
  pressureBias01: 0.33,
});

export const RIVALRY_SCENARIO_SPECTATOR_HIGH = Object.freeze({
  channelId: 'SPECTATOR' as const,
  pressureBand: 'HIGH' as const,
  publicBias01: 0.9,
  pressureBias01: 0.63,
});

export const RIVALRY_SCENARIO_SPECTATOR_CRITICAL = Object.freeze({
  channelId: 'SPECTATOR' as const,
  pressureBand: 'CRITICAL' as const,
  publicBias01: 0.9,
  pressureBias01: 0.91,
});

export const RIVALRY_SCENARIO_SYSTEM_LOW = Object.freeze({
  channelId: 'SYSTEM' as const,
  pressureBand: 'LOW' as const,
  publicBias01: 0.1,
  pressureBias01: 0.12,
});

export const RIVALRY_SCENARIO_SYSTEM_MEDIUM = Object.freeze({
  channelId: 'SYSTEM' as const,
  pressureBand: 'MEDIUM' as const,
  publicBias01: 0.1,
  pressureBias01: 0.33,
});

export const RIVALRY_SCENARIO_SYSTEM_HIGH = Object.freeze({
  channelId: 'SYSTEM' as const,
  pressureBand: 'HIGH' as const,
  publicBias01: 0.1,
  pressureBias01: 0.63,
});

export const RIVALRY_SCENARIO_SYSTEM_CRITICAL = Object.freeze({
  channelId: 'SYSTEM' as const,
  pressureBand: 'CRITICAL' as const,
  publicBias01: 0.1,
  pressureBias01: 0.91,
});

export interface RivalryTierNarrativeNote { readonly tier: RivalryEscalationTier; readonly note: string; }
export const RIVALRY_TIER_NOTES: Readonly<Record<RivalryEscalationTier, RivalryTierNarrativeNote>> = Object.freeze({
  'NONE': { tier: 'NONE', note: 'No meaningful escalation. Keep heat latent or defer.' },
  'GLARE': { tier: 'GLARE', note: 'The counterpart notices and projects low-grade menace.' },
  'PROBE': { tier: 'PROBE', note: 'Questions, nudges, and setup lines try to expose weakness.' },
  'PRESSURE': { tier: 'PRESSURE', note: 'The counterpart actively corners the player in language.' },
  'HUNT': { tier: 'HUNT', note: 'The counterpart commits to multi-step persecution logic.' },
  'PUBLIC_SWARM': { tier: 'PUBLIC_SWARM', note: 'The moment becomes social and witnessed.' },
  'BOSS_WINDOW': { tier: 'BOSS_WINDOW', note: 'Language itself becomes a combat window.' },
});
export const RIVALRY_POLICY_GUIDE_001 = 'policy guide 001: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_002 = 'policy guide 002: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_003 = 'policy guide 003: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_004 = 'policy guide 004: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_005 = 'policy guide 005: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_006 = 'policy guide 006: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_007 = 'policy guide 007: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_008 = 'policy guide 008: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_009 = 'policy guide 009: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_010 = 'policy guide 010: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_011 = 'policy guide 011: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_012 = 'policy guide 012: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_013 = 'policy guide 013: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_014 = 'policy guide 014: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_015 = 'policy guide 015: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_016 = 'policy guide 016: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_017 = 'policy guide 017: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_018 = 'policy guide 018: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_019 = 'policy guide 019: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_020 = 'policy guide 020: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_021 = 'policy guide 021: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_022 = 'policy guide 022: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_023 = 'policy guide 023: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_024 = 'policy guide 024: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_025 = 'policy guide 025: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_026 = 'policy guide 026: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_027 = 'policy guide 027: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_028 = 'policy guide 028: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_029 = 'policy guide 029: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_030 = 'policy guide 030: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_031 = 'policy guide 031: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_032 = 'policy guide 032: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_033 = 'policy guide 033: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_034 = 'policy guide 034: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_035 = 'policy guide 035: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_036 = 'policy guide 036: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_037 = 'policy guide 037: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_038 = 'policy guide 038: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_039 = 'policy guide 039: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_040 = 'policy guide 040: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_041 = 'policy guide 041: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_042 = 'policy guide 042: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_043 = 'policy guide 043: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_044 = 'policy guide 044: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_045 = 'policy guide 045: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_046 = 'policy guide 046: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_047 = 'policy guide 047: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_048 = 'policy guide 048: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_049 = 'policy guide 049: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_050 = 'policy guide 050: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_051 = 'policy guide 051: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_052 = 'policy guide 052: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_053 = 'policy guide 053: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_054 = 'policy guide 054: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_055 = 'policy guide 055: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_056 = 'policy guide 056: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_057 = 'policy guide 057: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_058 = 'policy guide 058: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_059 = 'policy guide 059: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_060 = 'policy guide 060: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_061 = 'policy guide 061: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_062 = 'policy guide 062: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_063 = 'policy guide 063: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_064 = 'policy guide 064: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_065 = 'policy guide 065: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_066 = 'policy guide 066: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_067 = 'policy guide 067: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_068 = 'policy guide 068: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_069 = 'policy guide 069: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_070 = 'policy guide 070: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_071 = 'policy guide 071: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_072 = 'policy guide 072: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_073 = 'policy guide 073: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_074 = 'policy guide 074: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_075 = 'policy guide 075: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_076 = 'policy guide 076: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_077 = 'policy guide 077: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_078 = 'policy guide 078: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_079 = 'policy guide 079: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_080 = 'policy guide 080: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_081 = 'policy guide 081: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_082 = 'policy guide 082: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_083 = 'policy guide 083: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_084 = 'policy guide 084: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_085 = 'policy guide 085: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_086 = 'policy guide 086: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_087 = 'policy guide 087: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_088 = 'policy guide 088: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_089 = 'policy guide 089: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_090 = 'policy guide 090: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_091 = 'policy guide 091: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_092 = 'policy guide 092: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_093 = 'policy guide 093: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_094 = 'policy guide 094: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_095 = 'policy guide 095: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_096 = 'policy guide 096: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_097 = 'policy guide 097: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_098 = 'policy guide 098: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_099 = 'policy guide 099: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_100 = 'policy guide 100: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_101 = 'policy guide 101: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_102 = 'policy guide 102: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_103 = 'policy guide 103: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_104 = 'policy guide 104: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_105 = 'policy guide 105: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_106 = 'policy guide 106: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_107 = 'policy guide 107: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_108 = 'policy guide 108: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_109 = 'policy guide 109: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_110 = 'policy guide 110: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_111 = 'policy guide 111: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_112 = 'policy guide 112: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_113 = 'policy guide 113: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_114 = 'policy guide 114: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_115 = 'policy guide 115: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_116 = 'policy guide 116: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_117 = 'policy guide 117: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_118 = 'policy guide 118: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_119 = 'policy guide 119: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_120 = 'policy guide 120: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_121 = 'policy guide 121: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_122 = 'policy guide 122: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_123 = 'policy guide 123: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_124 = 'policy guide 124: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_125 = 'policy guide 125: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_126 = 'policy guide 126: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_127 = 'policy guide 127: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_128 = 'policy guide 128: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_129 = 'policy guide 129: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_130 = 'policy guide 130: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_131 = 'policy guide 131: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_132 = 'policy guide 132: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_133 = 'policy guide 133: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_134 = 'policy guide 134: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_135 = 'policy guide 135: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_136 = 'policy guide 136: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_137 = 'policy guide 137: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_138 = 'policy guide 138: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_139 = 'policy guide 139: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_140 = 'policy guide 140: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_141 = 'policy guide 141: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_142 = 'policy guide 142: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_143 = 'policy guide 143: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_144 = 'policy guide 144: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_145 = 'policy guide 145: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_146 = 'policy guide 146: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_147 = 'policy guide 147: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_148 = 'policy guide 148: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_149 = 'policy guide 149: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_150 = 'policy guide 150: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_151 = 'policy guide 151: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_152 = 'policy guide 152: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_153 = 'policy guide 153: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_154 = 'policy guide 154: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_155 = 'policy guide 155: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_156 = 'policy guide 156: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_157 = 'policy guide 157: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_158 = 'policy guide 158: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_159 = 'policy guide 159: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_160 = 'policy guide 160: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_161 = 'policy guide 161: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_162 = 'policy guide 162: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_163 = 'policy guide 163: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_164 = 'policy guide 164: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_165 = 'policy guide 165: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_166 = 'policy guide 166: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_167 = 'policy guide 167: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_168 = 'policy guide 168: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_169 = 'policy guide 169: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_170 = 'policy guide 170: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_171 = 'policy guide 171: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_172 = 'policy guide 172: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_173 = 'policy guide 173: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_174 = 'policy guide 174: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_175 = 'policy guide 175: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_176 = 'policy guide 176: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_177 = 'policy guide 177: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_178 = 'policy guide 178: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_179 = 'policy guide 179: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_180 = 'policy guide 180: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_181 = 'policy guide 181: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_182 = 'policy guide 182: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_183 = 'policy guide 183: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_184 = 'policy guide 184: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_185 = 'policy guide 185: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_186 = 'policy guide 186: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_187 = 'policy guide 187: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_188 = 'policy guide 188: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_189 = 'policy guide 189: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_190 = 'policy guide 190: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_191 = 'policy guide 191: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_192 = 'policy guide 192: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_193 = 'policy guide 193: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_194 = 'policy guide 194: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_195 = 'policy guide 195: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_196 = 'policy guide 196: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_197 = 'policy guide 197: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_198 = 'policy guide 198: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_199 = 'policy guide 199: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_200 = 'policy guide 200: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_201 = 'policy guide 201: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_202 = 'policy guide 202: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_203 = 'policy guide 203: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_204 = 'policy guide 204: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_205 = 'policy guide 205: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_206 = 'policy guide 206: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_207 = 'policy guide 207: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_208 = 'policy guide 208: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_209 = 'policy guide 209: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_210 = 'policy guide 210: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_211 = 'policy guide 211: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_212 = 'policy guide 212: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_213 = 'policy guide 213: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_214 = 'policy guide 214: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_215 = 'policy guide 215: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_216 = 'policy guide 216: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_217 = 'policy guide 217: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_218 = 'policy guide 218: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_219 = 'policy guide 219: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_220 = 'policy guide 220: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_221 = 'policy guide 221: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_222 = 'policy guide 222: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_223 = 'policy guide 223: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_224 = 'policy guide 224: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_225 = 'policy guide 225: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_226 = 'policy guide 226: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_227 = 'policy guide 227: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_228 = 'policy guide 228: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_229 = 'policy guide 229: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_230 = 'policy guide 230: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_231 = 'policy guide 231: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_232 = 'policy guide 232: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_233 = 'policy guide 233: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_234 = 'policy guide 234: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_235 = 'policy guide 235: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_236 = 'policy guide 236: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_237 = 'policy guide 237: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_238 = 'policy guide 238: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_239 = 'policy guide 239: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_240 = 'policy guide 240: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_241 = 'policy guide 241: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_242 = 'policy guide 242: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_243 = 'policy guide 243: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_244 = 'policy guide 244: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_245 = 'policy guide 245: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_246 = 'policy guide 246: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_247 = 'policy guide 247: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_248 = 'policy guide 248: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_249 = 'policy guide 249: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_250 = 'policy guide 250: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_251 = 'policy guide 251: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_252 = 'policy guide 252: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_253 = 'policy guide 253: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_254 = 'policy guide 254: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_255 = 'policy guide 255: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_256 = 'policy guide 256: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_257 = 'policy guide 257: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_258 = 'policy guide 258: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_259 = 'policy guide 259: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_260 = 'policy guide 260: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_261 = 'policy guide 261: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_262 = 'policy guide 262: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_263 = 'policy guide 263: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_264 = 'policy guide 264: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_265 = 'policy guide 265: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_266 = 'policy guide 266: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_267 = 'policy guide 267: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_268 = 'policy guide 268: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_269 = 'policy guide 269: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_270 = 'policy guide 270: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_271 = 'policy guide 271: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_272 = 'policy guide 272: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_273 = 'policy guide 273: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_274 = 'policy guide 274: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_275 = 'policy guide 275: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_276 = 'policy guide 276: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_277 = 'policy guide 277: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_278 = 'policy guide 278: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_279 = 'policy guide 279: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_280 = 'policy guide 280: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_281 = 'policy guide 281: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_282 = 'policy guide 282: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_283 = 'policy guide 283: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_284 = 'policy guide 284: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_285 = 'policy guide 285: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_286 = 'policy guide 286: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_287 = 'policy guide 287: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_288 = 'policy guide 288: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_289 = 'policy guide 289: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_290 = 'policy guide 290: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_291 = 'policy guide 291: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_292 = 'policy guide 292: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_293 = 'policy guide 293: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_294 = 'policy guide 294: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_295 = 'policy guide 295: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_296 = 'policy guide 296: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_297 = 'policy guide 297: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_298 = 'policy guide 298: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_299 = 'policy guide 299: escalation should feel personal, timely, and reconstructible.';
export const RIVALRY_POLICY_GUIDE_300 = 'policy guide 300: escalation should feel personal, timely, and reconstructible.';
