
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
} from '../../../../../../shared/contracts/chat/relationship';
import { clamp01 } from '../../../../../../shared/contracts/chat/relationship';

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

const DEFAULT_EVENT_HEAT: Readonly<Record<ChatRelationshipEventType, number>> = Object.freeze({} as Record<ChatRelationshipEventType, number>);

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


// ============================================================================
// MARK: Escalation state machine types
// ============================================================================

export interface RivalryStateMachineState {
  readonly currentTier: RivalryEscalationTier;
  readonly previousTier: RivalryEscalationTier;
  readonly enteredAt: number;
  readonly timeInTierMs: number;
  readonly transitionCount: number;
  readonly lastTransitionAt: number;
  readonly isValidState: boolean;
}

export interface RivalryStateTransitionResult {
  readonly success: boolean;
  readonly fromTier: RivalryEscalationTier;
  readonly toTier: RivalryEscalationTier;
  readonly reason: string;
  readonly timestamp: number;
}

// ============================================================================
// MARK: Predictive escalation types
// ============================================================================

export interface RivalryEscalationPrediction {
  readonly predictedTier: RivalryEscalationTier;
  readonly estimatedTicksUntil: number;
  readonly confidence01: number;
  readonly triggerConditions: readonly string[];
}

// ============================================================================
// MARK: Pack hunting types
// ============================================================================

export interface PackHuntRole {
  readonly counterpartId: string;
  readonly packRole: 'POINT' | 'PRESSURE' | 'FLANK' | 'RECEIPT_CLOSER';
  readonly escalationScore01: number;
}

export interface PackHuntAssessment {
  readonly canFormPack: boolean;
  readonly reason: string;
  readonly packSize: number;
  readonly roles: readonly PackHuntRole[];
}

// ============================================================================
// MARK: De-escalation types
// ============================================================================

export interface DeEscalationDecision {
  readonly shouldRetreat: boolean;
  readonly shouldRegroup: boolean;
  readonly shouldConcede: boolean;
  readonly retreatReason: string;
  readonly suggestedCooldownMs: number;
  readonly gracefulExitStyle: 'DIGNIFIED_WITHDRAWAL' | 'TACTICAL_RETREAT' | 'NONE';
}

// ============================================================================
// MARK: Boss fight composition types
// ============================================================================

export interface BossFightComposition {
  readonly bossFightId: string;
  readonly counterpartId: string;
  readonly entranceStyle: 'DRAMATIC_PUBLIC' | 'COLD_PRIVATE';
  readonly openingMoveType: 'RECEIPT_BARRAGE' | 'PSYCHOLOGICAL_PROBE' | 'SILENCE_THEN_STRIKE';
  readonly preferredWitnessCount: number;
  readonly helperSuppressionDurationMs: number;
  readonly resolutionConditions: readonly string[];
  readonly estimatedDurationMs: number;
  readonly maxEscalationBudget: number;
}

// ============================================================================
// MARK: Escalation audit types
// ============================================================================

export interface RivalryEscalationAuditEntry {
  readonly auditId: string;
  readonly counterpartId: string;
  readonly inputHostility01: number;
  readonly inputRivalry01: number;
  readonly inputIntensity01: number;
  readonly selectedTier: RivalryEscalationTier;
  readonly selectedScore01: number;
  readonly suppressionReason: RivalrySuppressionReason;
  readonly shouldUseCallback: boolean;
  readonly shouldQuotePlayerBack: boolean;
  readonly shouldPreferSilence: boolean;
  readonly attackWindowOpen: boolean;
  readonly timestamp: number;
  readonly contextMode: string;
  readonly contextPressureBand: string;
}



// ============================================================================
// MARK: Rival personality escalation profile types
// ============================================================================

export interface RivalPersonalityEscalationProfile {
  readonly personaId: string;
  readonly label: string;
  readonly preferredTierProgression: readonly RivalryEscalationTier[];
  readonly skipsTiers: boolean;
  readonly prefersSilenceBeforeStrike: boolean;
  readonly attackTimingBias01: number;
  readonly receiptPreference01: number;
  readonly humiliationPreference01: number;
  readonly psychologicalPreference01: number;
  readonly deEscalationResistance01: number;
  readonly publicStageBias01: number;
  readonly signatureOpeningStyle: string;
  readonly retreatCondition: string;
  readonly escalationPaceMs: number;
}

// ============================================================================
// MARK: Mode escalation profile types
// ============================================================================

export interface ModeEscalationProfile {
  readonly modeId: string;
  readonly label: string;
  readonly maxSimultaneousRivals: number;
  readonly publicSwarmAllowed: boolean;
  readonly escalationPaceMultiplier: number;
  readonly silenceEmphasis01: number;
  readonly dealRoomEscalation: boolean;
  readonly teamCoordination: boolean;
  readonly preferredTierCeiling: RivalryEscalationTier;
  readonly witnessAmplification01: number;
}

// ============================================================================
// MARK: Escalation history types
// ============================================================================

export interface RivalryEscalationHistoryEntry {
  readonly timestamp: number;
  readonly tier: RivalryEscalationTier;
  readonly score01: number;
  readonly suppressed: boolean;
  readonly usedCallback: boolean;
  readonly publicEmbarrassment01: number;
}

// ============================================================================
// MARK: Diagnostic report type
// ============================================================================

export interface RivalryDiagnosticReport {
  readonly counterpartId: string;
  readonly currentStateMachineTier: RivalryEscalationTier;
  readonly decisionTier: RivalryEscalationTier;
  readonly decisionScore01: number;
  readonly assessmentHostility01: number;
  readonly assessmentRivalry01: number;
  readonly assessmentObsessionHeat01: number;
  readonly assessmentBossFightReadiness01: number;
  readonly suppressionReason: RivalrySuppressionReason;
  readonly attackWindowOpen: boolean;
  readonly shouldUseCallback: boolean;
  readonly shouldQuotePlayerBack: boolean;
  readonly deEscalationAdvised: boolean;
  readonly deEscalationReason: string;
  readonly personaId?: string;
  readonly personaLabel?: string;
  readonly personaReceiptPreference01?: number;
  readonly transitionCount: number;
  readonly contextMode: string;
  readonly contextPressureBand: string;
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


  // ==========================================================================
  // MARK: Escalation state machine
  // ==========================================================================

  private readonly _escalationStates = new Map<string, RivalryStateMachineState>();

  private static readonly VALID_TRANSITIONS: Readonly<Record<RivalryEscalationTier, readonly RivalryEscalationTier[]>> = Object.freeze({
    'NONE': ['GLARE', 'PROBE'],
    'GLARE': ['NONE', 'PROBE', 'PRESSURE'],
    'PROBE': ['GLARE', 'PRESSURE', 'HUNT'],
    'PRESSURE': ['PROBE', 'HUNT', 'PUBLIC_SWARM'],
    'HUNT': ['PRESSURE', 'PUBLIC_SWARM', 'BOSS_WINDOW'],
    'PUBLIC_SWARM': ['HUNT', 'BOSS_WINDOW', 'NONE'],
    'BOSS_WINDOW': ['NONE', 'HUNT'],
  });

  /** Get the current escalation state for a counterpart. */
  public getEscalationState(playerId: string, counterpartId: string): RivalryStateMachineState {
    return this._escalationStates.get(`${playerId}:${counterpartId}`) ?? {
      currentTier: 'NONE', previousTier: 'NONE', enteredAt: 0, timeInTierMs: 0,
      transitionCount: 0, lastTransitionAt: 0, isValidState: true,
    };
  }

  /** Transition the escalation state machine to a new tier with validation. */
  public transitionEscalation(playerId: string, counterpartId: string, targetTier: RivalryEscalationTier, at: number): RivalryStateTransitionResult {
    const key = `${playerId}:${counterpartId}`;
    const current = this.getEscalationState(playerId, counterpartId);
    const allowed = RivalryEscalationPolicy.VALID_TRANSITIONS[current.currentTier] ?? [];

    if (!allowed.includes(targetTier)) {
      return { success: false, fromTier: current.currentTier, toTier: targetTier, reason: `invalid_transition_${current.currentTier}_to_${targetTier}`, timestamp: at };
    }

    const next: RivalryStateMachineState = {
      currentTier: targetTier, previousTier: current.currentTier,
      enteredAt: at, timeInTierMs: 0,
      transitionCount: current.transitionCount + 1, lastTransitionAt: at, isValidState: true,
    };
    this._escalationStates.set(key, next);
    return { success: true, fromTier: current.currentTier, toTier: targetTier, reason: 'valid_transition', timestamp: at };
  }

  // ==========================================================================
  // MARK: Predictive escalation modeling
  // ==========================================================================

  /** Predict when the next escalation is likely based on historical pattern. */
  public predictNextEscalation(playerId: string, counterpartId: string, history: readonly RivalryEscalationDecision[]): RivalryEscalationPrediction {
    const current = this.getEscalationState(playerId, counterpartId);
    if (history.length < 2) {
      return { predictedTier: current.currentTier, estimatedTicksUntil: -1, confidence01: 0.1, triggerConditions: ['insufficient_history'] };
    }
    const recentTiers = history.slice(-6).map((h) => h.selectedTier);
    const escalationRate = recentTiers.filter((t, i) => i > 0 && this.tierOrdinal(t) > this.tierOrdinal(recentTiers[i - 1]!)).length / Math.max(1, recentTiers.length - 1);
    const allowed = RivalryEscalationPolicy.VALID_TRANSITIONS[current.currentTier] ?? [];
    const nextUp = allowed.find((t) => this.tierOrdinal(t) > this.tierOrdinal(current.currentTier));

    return {
      predictedTier: nextUp ?? current.currentTier,
      estimatedTicksUntil: escalationRate > 0.5 ? 3 : escalationRate > 0.25 ? 8 : 20,
      confidence01: clamp01(escalationRate * 0.7 + (history.length / 20) * 0.3),
      triggerConditions: escalationRate > 0.5 ? ['high_escalation_rate', 'recent_momentum'] : ['moderate_pattern'],
    };
  }

  private tierOrdinal(tier: RivalryEscalationTier): number {
    const order: RivalryEscalationTier[] = ['NONE', 'GLARE', 'PROBE', 'PRESSURE', 'HUNT', 'PUBLIC_SWARM', 'BOSS_WINDOW'];
    return order.indexOf(tier);
  }

  // ==========================================================================
  // MARK: Pack hunting logic
  // ==========================================================================

  /** Assess whether multiple rivals should coordinate a pack hunt. */
  public assessPackFormation(rivals: readonly { counterpartId: string; escalation: RivalryEscalationDecision }[], context: RivalryEscalationContext): PackHuntAssessment {
    if (rivals.length < 2) return { canFormPack: false, reason: 'insufficient_rivals', packSize: 0, roles: [] };
    const huntReady = rivals.filter((r) => r.escalation.selectedTier === 'HUNT' || r.escalation.selectedTier === 'PUBLIC_SWARM' || r.escalation.selectedTier === 'BOSS_WINDOW');
    if (huntReady.length < 2) return { canFormPack: false, reason: 'insufficient_hunt_ready', packSize: 0, roles: [] };

    const sorted = [...huntReady].sort((a, b) => b.escalation.selectedScore01 - a.escalation.selectedScore01);
    const roles: PackHuntRole[] = sorted.slice(0, 4).map((r, i) => ({
      counterpartId: r.counterpartId,
      packRole: i === 0 ? 'POINT' as const : i === 1 ? 'PRESSURE' as const : i === 2 ? 'FLANK' as const : 'RECEIPT_CLOSER' as const,
      escalationScore01: r.escalation.selectedScore01,
    }));

    return { canFormPack: true, reason: 'pack_ready', packSize: roles.length, roles: Object.freeze(roles) };
  }

  // ==========================================================================
  // MARK: De-escalation and retreat logic
  // ==========================================================================

  /** Assess whether a rival should de-escalate. */
  public assessDeEscalation(request: RivalryEscalationRequest): DeEscalationDecision {
    const assessment = this.assess(request);
    const shouldRetreat = assessment.rescueCounterweight01 >= 0.6 || (assessment.cooldown01 >= 0.5 && assessment.hostility01 < 0.4);
    const shouldRegroup = assessment.hostility01 >= 0.5 && assessment.cooldown01 >= 0.3 && !shouldRetreat;
    const shouldConcede = assessment.negotiationDiscipline01 >= 0.7 && assessment.publicStageFit01 < 0.3;

    return Object.freeze({
      shouldRetreat, shouldRegroup, shouldConcede,
      retreatReason: shouldRetreat ? (assessment.rescueCounterweight01 >= 0.6 ? 'helper_intervention' : 'cooldown_period') : 'none',
      suggestedCooldownMs: shouldRetreat ? 15000 : shouldRegroup ? 8000 : 0,
      gracefulExitStyle: shouldConcede ? 'DIGNIFIED_WITHDRAWAL' as const : shouldRetreat ? 'TACTICAL_RETREAT' as const : 'NONE' as const,
    });
  }

  // ==========================================================================
  // MARK: Boss fight composition
  // ==========================================================================

  /** Compose a boss-fight sequence when escalation reaches BOSS_WINDOW. */
  public composeBossFight(request: RivalryEscalationRequest, decision: RivalryEscalationDecision): BossFightComposition {
    const assessment = decision.assessment;
    return Object.freeze({
      bossFightId: `bossfight:${request.state.counterpartId}:${Date.now()}`,
      counterpartId: request.state.counterpartId,
      entranceStyle: assessment.witnessMagnet01 >= 0.7 ? 'DRAMATIC_PUBLIC' as const : 'COLD_PRIVATE' as const,
      openingMoveType: assessment.humiliationValue01 >= 0.6 ? 'RECEIPT_BARRAGE' as const : 'PSYCHOLOGICAL_PROBE' as const,
      preferredWitnessCount: decision.preferredWitnessCount,
      helperSuppressionDurationMs: decision.shouldSuppressHelpers ? 12000 : 0,
      resolutionConditions: Object.freeze(['PLAYER_CAPITULATES', 'PLAYER_COUNTER_WINS', 'MUTUAL_DESTRUCTION', 'STALEMATE_TIMEOUT']),
      estimatedDurationMs: 25000,
      maxEscalationBudget: 5,
    });
  }

  // ==========================================================================
  // MARK: Escalation audit and replay
  // ==========================================================================

  /** Generate an audit entry for proof-chain and replay surfaces. */
  public generateAuditEntry(request: RivalryEscalationRequest, decision: RivalryEscalationDecision): RivalryEscalationAuditEntry {
    return Object.freeze({
      auditId: `audit:escalation:${request.state.counterpartId}:${Date.now()}`,
      counterpartId: request.state.counterpartId,
      inputHostility01: (request.state.vector as any)?.hostility01 ?? 0,
      inputRivalry01: (request.state.vector as any)?.rivalry01 ?? 0,
      inputIntensity01: request.state.intensity01,
      selectedTier: decision.selectedTier,
      selectedScore01: decision.selectedScore01,
      suppressionReason: decision.suppressionReason,
      shouldUseCallback: decision.shouldUseCallback,
      shouldQuotePlayerBack: decision.shouldQuotePlayerBack,
      shouldPreferSilence: decision.shouldPreferSilence,
      attackWindowOpen: decision.attackWindow.open,
      timestamp: Date.now(),
      contextMode: request.context.mode,
      contextPressureBand: request.context.pressureBand,
    });
  }




  // ==========================================================================
  // MARK: Rival personality escalation profiles
  // ==========================================================================

  private static readonly PERSONA_PROFILES: Readonly<Record<string, RivalPersonalityEscalationProfile>> = Object.freeze({
    'THE_LIQUIDATOR': {
      personaId: 'THE_LIQUIDATOR', label: 'The Liquidator',
      preferredTierProgression: ['GLARE', 'PROBE', 'PRESSURE', 'HUNT', 'PUBLIC_SWARM', 'BOSS_WINDOW'] as RivalryEscalationTier[],
      skipsTiers: false, prefersSilenceBeforeStrike: true,
      attackTimingBias01: 0.45, receiptPreference01: 0.82,
      humiliationPreference01: 0.68, psychologicalPreference01: 0.55,
      deEscalationResistance01: 0.72, publicStageBias01: 0.6,
      signatureOpeningStyle: 'METHODICAL_APPROACH',
      retreatCondition: 'NEVER_UNLESS_FORCED',
      escalationPaceMs: 8000,
    },
    'THE_BUREAUCRAT': {
      personaId: 'THE_BUREAUCRAT', label: 'The Bureaucrat',
      preferredTierProgression: ['GLARE', 'PROBE', 'PROBE', 'PRESSURE', 'PRESSURE', 'HUNT'] as RivalryEscalationTier[],
      skipsTiers: false, prefersSilenceBeforeStrike: false,
      attackTimingBias01: 0.3, receiptPreference01: 0.92,
      humiliationPreference01: 0.45, psychologicalPreference01: 0.78,
      deEscalationResistance01: 0.5, publicStageBias01: 0.4,
      signatureOpeningStyle: 'PROCEDURAL_CITATION',
      retreatCondition: 'WHEN_OUTPROCEDURED',
      escalationPaceMs: 12000,
    },
    'THE_MANIPULATOR': {
      personaId: 'THE_MANIPULATOR', label: 'The Manipulator',
      preferredTierProgression: ['PROBE', 'PRESSURE', 'HUNT', 'BOSS_WINDOW'] as RivalryEscalationTier[],
      skipsTiers: true, prefersSilenceBeforeStrike: true,
      attackTimingBias01: 0.72, receiptPreference01: 0.58,
      humiliationPreference01: 0.85, psychologicalPreference01: 0.92,
      deEscalationResistance01: 0.35, publicStageBias01: 0.75,
      signatureOpeningStyle: 'PSYCHOLOGICAL_TRAP',
      retreatCondition: 'WHEN_EXPOSED',
      escalationPaceMs: 5000,
    },
    'CRASH_PROPHET': {
      personaId: 'CRASH_PROPHET', label: 'Crash Prophet',
      preferredTierProgression: ['PRESSURE', 'PUBLIC_SWARM', 'BOSS_WINDOW'] as RivalryEscalationTier[],
      skipsTiers: true, prefersSilenceBeforeStrike: false,
      attackTimingBias01: 0.88, receiptPreference01: 0.42,
      humiliationPreference01: 0.72, psychologicalPreference01: 0.38,
      deEscalationResistance01: 0.25, publicStageBias01: 0.92,
      signatureOpeningStyle: 'DRAMATIC_PROPHECY',
      retreatCondition: 'WHEN_PROVEN_WRONG',
      escalationPaceMs: 3000,
    },
    'LEGACY_HEIR': {
      personaId: 'LEGACY_HEIR', label: 'Legacy Heir',
      preferredTierProgression: ['GLARE', 'GLARE', 'PROBE', 'PRESSURE', 'HUNT', 'PUBLIC_SWARM'] as RivalryEscalationTier[],
      skipsTiers: false, prefersSilenceBeforeStrike: true,
      attackTimingBias01: 0.35, receiptPreference01: 0.75,
      humiliationPreference01: 0.58, psychologicalPreference01: 0.62,
      deEscalationResistance01: 0.82, publicStageBias01: 0.55,
      signatureOpeningStyle: 'INHERITED_CONTEMPT',
      retreatCondition: 'WHEN_OUTCLASSED',
      escalationPaceMs: 10000,
    },
  });

  /** Get escalation profile for a specific rival persona. */
  public getPersonaProfile(personaId: string): RivalPersonalityEscalationProfile | undefined {
    return RivalryEscalationPolicy.PERSONA_PROFILES[personaId];
  }

  /** Resolve escalation with persona-aware adjustments. */
  public resolveWithPersona(request: RivalryEscalationRequest, personaId: string): RivalryEscalationDecision {
    const base = this.resolve(request);
    const persona = this.getPersonaProfile(personaId);
    if (!persona) return base;
    const adjustedScore = clamp01(base.selectedScore01 * (0.7 + persona.attackTimingBias01 * 0.3));
    const shouldUseCallback = base.shouldUseCallback || persona.receiptPreference01 >= 0.7;
    const shouldPreferSilence = persona.prefersSilenceBeforeStrike && base.selectedTier === 'GLARE';
    return { ...base, selectedScore01: adjustedScore, shouldUseCallback, shouldPreferSilence: shouldPreferSilence || base.shouldPreferSilence };
  }

  // ==========================================================================
  // MARK: Mode-specific escalation profiles
  // ==========================================================================

  private static readonly MODE_ESCALATION_PROFILES: Readonly<Record<string, ModeEscalationProfile>> = Object.freeze({
    'GO_ALONE': {
      modeId: 'GO_ALONE', label: 'Empire',
      maxSimultaneousRivals: 1, publicSwarmAllowed: false,
      escalationPaceMultiplier: 1.3, silenceEmphasis01: 0.65,
      dealRoomEscalation: false, teamCoordination: false,
      preferredTierCeiling: 'HUNT' as RivalryEscalationTier,
      witnessAmplification01: 0.4,
    },
    'HEAD_TO_HEAD': {
      modeId: 'HEAD_TO_HEAD', label: 'Predator',
      maxSimultaneousRivals: 1, publicSwarmAllowed: false,
      escalationPaceMultiplier: 0.8, silenceEmphasis01: 0.35,
      dealRoomEscalation: true, teamCoordination: false,
      preferredTierCeiling: 'BOSS_WINDOW' as RivalryEscalationTier,
      witnessAmplification01: 0.6,
    },
    'TEAM_UP': {
      modeId: 'TEAM_UP', label: 'Syndicate',
      maxSimultaneousRivals: 3, publicSwarmAllowed: true,
      escalationPaceMultiplier: 1.0, silenceEmphasis01: 0.25,
      dealRoomEscalation: false, teamCoordination: true,
      preferredTierCeiling: 'PUBLIC_SWARM' as RivalryEscalationTier,
      witnessAmplification01: 0.85,
    },
    'CHASE_A_LEGEND': {
      modeId: 'CHASE_A_LEGEND', label: 'Phantom',
      maxSimultaneousRivals: 2, publicSwarmAllowed: false,
      escalationPaceMultiplier: 1.6, silenceEmphasis01: 0.88,
      dealRoomEscalation: false, teamCoordination: false,
      preferredTierCeiling: 'HUNT' as RivalryEscalationTier,
      witnessAmplification01: 0.2,
    },
  });

  /** Get mode-specific escalation profile. */
  public getModeEscalationProfile(modeId: string | undefined): ModeEscalationProfile {
    return RivalryEscalationPolicy.MODE_ESCALATION_PROFILES[modeId ?? ''] ?? RivalryEscalationPolicy.MODE_ESCALATION_PROFILES['GO_ALONE']!;
  }

  /** Resolve with mode-aware ceiling enforcement. */
  public resolveWithMode(request: RivalryEscalationRequest, modeId: string): RivalryEscalationDecision {
    const base = this.resolve(request);
    const profile = this.getModeEscalationProfile(modeId);
    const tierOrder: RivalryEscalationTier[] = ['NONE', 'GLARE', 'PROBE', 'PRESSURE', 'HUNT', 'PUBLIC_SWARM', 'BOSS_WINDOW'];
    const ceilingIdx = tierOrder.indexOf(profile.preferredTierCeiling);
    const currentIdx = tierOrder.indexOf(base.selectedTier);
    if (currentIdx > ceilingIdx) {
      return { ...base, selectedTier: profile.preferredTierCeiling, notes: [...base.notes, `mode_ceiling_enforced_${profile.label}`] };
    }
    return base;
  }

  // ==========================================================================
  // MARK: Escalation history tracking
  // ==========================================================================

  private readonly _escalationHistory = new Map<string, RivalryEscalationHistoryEntry[]>();

  /** Record an escalation decision for historical analysis. */
  public recordEscalationDecision(playerId: string, counterpartId: string, decision: RivalryEscalationDecision, at: number): void {
    const key = `${playerId}:${counterpartId}`;
    const entries = this._escalationHistory.get(key) ?? [];
    entries.push({
      timestamp: at,
      tier: decision.selectedTier,
      score01: decision.selectedScore01,
      suppressed: decision.suppressionReason !== 'NONE',
      usedCallback: decision.shouldUseCallback,
      publicEmbarrassment01: decision.publicEmbarrassment01,
    });
    if (entries.length > 128) entries.splice(0, entries.length - 128);
    this._escalationHistory.set(key, entries);
  }

  /** Get escalation history for a counterpart. */
  public getEscalationHistory(playerId: string, counterpartId: string): readonly RivalryEscalationHistoryEntry[] {
    return Object.freeze(this._escalationHistory.get(`${playerId}:${counterpartId}`) ?? []);
  }

  /** Compute average escalation tier over recent history. */
  public averageEscalationIntensity(playerId: string, counterpartId: string): number {
    const history = this.getEscalationHistory(playerId, counterpartId);
    if (history.length === 0) return 0;
    const tierOrder: RivalryEscalationTier[] = ['NONE', 'GLARE', 'PROBE', 'PRESSURE', 'HUNT', 'PUBLIC_SWARM', 'BOSS_WINDOW'];
    const total = history.reduce((s, h) => s + tierOrder.indexOf(h.tier), 0);
    return total / history.length / (tierOrder.length - 1);
  }

  /** Detect if escalation is accelerating (getting worse faster). */
  public isEscalationAccelerating(playerId: string, counterpartId: string): boolean {
    const history = this.getEscalationHistory(playerId, counterpartId);
    if (history.length < 4) return false;
    const recent = history.slice(-4);
    const tierOrder: RivalryEscalationTier[] = ['NONE', 'GLARE', 'PROBE', 'PRESSURE', 'HUNT', 'PUBLIC_SWARM', 'BOSS_WINDOW'];
    const deltas = recent.slice(1).map((h, i) => tierOrder.indexOf(h.tier) - tierOrder.indexOf(recent[i]!.tier));
    return deltas.every((d) => d > 0);
  }

  // ==========================================================================
  // MARK: Escalation diagnostic reports
  // ==========================================================================

  /** Generate a comprehensive diagnostic for a rivalry state. */
  public generateDiagnostic(request: RivalryEscalationRequest, personaId?: string): RivalryDiagnosticReport {
    const assessment = this.assess(request);
    const decision = personaId ? this.resolveWithPersona(request, personaId) : this.resolve(request);
    const state = this.getEscalationState(request.state.playerId ?? '', request.state.counterpartId);
    const deEsc = this.assessDeEscalation(request);
    const persona = personaId ? this.getPersonaProfile(personaId) : undefined;

    return Object.freeze({
      counterpartId: request.state.counterpartId,
      currentStateMachineTier: state.currentTier,
      decisionTier: decision.selectedTier,
      decisionScore01: decision.selectedScore01,
      assessmentHostility01: assessment.hostility01,
      assessmentRivalry01: assessment.rivalry01,
      assessmentObsessionHeat01: assessment.obsessionHeat01,
      assessmentBossFightReadiness01: assessment.bossFightReadiness01,
      suppressionReason: decision.suppressionReason,
      attackWindowOpen: decision.attackWindow.open,
      shouldUseCallback: decision.shouldUseCallback,
      shouldQuotePlayerBack: decision.shouldQuotePlayerBack,
      deEscalationAdvised: deEsc.shouldRetreat || deEsc.shouldConcede,
      deEscalationReason: deEsc.retreatReason,
      personaId: persona?.personaId,
      personaLabel: persona?.label,
      personaReceiptPreference01: persona?.receiptPreference01,
      transitionCount: state.transitionCount,
      contextMode: request.context.mode,
      contextPressureBand: request.context.pressureBand,
    });
  }

  /** Build a multi-line diagnostic string array. */
  public buildDiagnosticLines(request: RivalryEscalationRequest, personaId?: string): readonly string[] {
    const report = this.generateDiagnostic(request, personaId);
    const lines: string[] = [];
    lines.push(`counterpart=${report.counterpartId}|tier=${report.decisionTier}|score=${report.decisionScore01.toFixed(3)}`);
    lines.push(`hostility=${report.assessmentHostility01.toFixed(3)}|rivalry=${report.assessmentRivalry01.toFixed(3)}|obsession=${report.assessmentObsessionHeat01.toFixed(3)}`);
    lines.push(`bossFightReady=${report.assessmentBossFightReadiness01.toFixed(3)}|suppression=${report.suppressionReason}`);
    lines.push(`attackWindow=${report.attackWindowOpen}|callback=${report.shouldUseCallback}|quoteBack=${report.shouldQuotePlayerBack}`);
    lines.push(`deEscAdvised=${report.deEscalationAdvised}|reason=${report.deEscalationReason}`);
    if (report.personaId) lines.push(`persona=${report.personaLabel}|receiptPref=${report.personaReceiptPreference01?.toFixed(2)}`);
    lines.push(`stateMachine=${report.currentStateMachineTier}|transitions=${report.transitionCount}`);
    lines.push(`mode=${report.contextMode}|pressure=${report.contextPressureBand}`);
    return lines;
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


// ============================================================================
// MARK: Escalation helper functions
// ============================================================================

/** Compute the optimal moment to deploy a receipt based on rival persona timing. */
export function computeReceiptDeploymentWindow(
  personaProfile: RivalPersonalityEscalationProfile,
  currentTier: RivalryEscalationTier,
  audienceHeat01: number,
): { shouldDeploy: boolean; optimalDelayMs: number; reason: string } {
  if (personaProfile.receiptPreference01 < 0.4) {
    return { shouldDeploy: false, optimalDelayMs: 0, reason: 'persona_low_receipt_preference' };
  }
  const tierOrder: RivalryEscalationTier[] = ['NONE', 'GLARE', 'PROBE', 'PRESSURE', 'HUNT', 'PUBLIC_SWARM', 'BOSS_WINDOW'];
  const tierIdx = tierOrder.indexOf(currentTier);
  if (tierIdx < 3) {
    return { shouldDeploy: false, optimalDelayMs: 0, reason: 'too_early_in_escalation' };
  }
  const baseDelay = personaProfile.escalationPaceMs;
  const audienceBonus = audienceHeat01 * 2000;
  const optimalDelayMs = Math.round(baseDelay + audienceBonus);
  return { shouldDeploy: true, optimalDelayMs, reason: `tier_${currentTier}_receipt_ready` };
}

/** Determine if a pack hunt should dissolve based on current conditions. */
export function shouldDissolvePackHunt(
  assessment: PackHuntAssessment,
  helperInterventionActive: boolean,
  playerIsRecovering: boolean,
): boolean {
  if (!assessment.canFormPack) return true;
  if (helperInterventionActive && assessment.packSize <= 2) return true;
  if (playerIsRecovering && assessment.packSize <= 3) return true;
  return false;
}

/** Estimate the social cost of a rivalry escalation for the rival. */
export function estimateRivalSocialCost01(
  tier: RivalryEscalationTier,
  audienceHeat01: number,
  helperPresent: boolean,
): number {
  const tierCost: Record<RivalryEscalationTier, number> = {
    'NONE': 0, 'GLARE': 0.02, 'PROBE': 0.05, 'PRESSURE': 0.12,
    'HUNT': 0.22, 'PUBLIC_SWARM': 0.38, 'BOSS_WINDOW': 0.55,
  };
  const base = tierCost[tier] ?? 0;
  const audienceAmplification = audienceHeat01 * 0.25;
  const helperCounterweight = helperPresent ? 0.15 : 0;
  return Math.min(1, base + audienceAmplification + helperCounterweight);
}

/** Generate a narrative description of the current escalation state. */
export function describeEscalationState(
  state: RivalryStateMachineState,
  counterpartId: string,
  personaLabel?: string,
): string {
  const persona = personaLabel ? ` (${personaLabel})` : '';
  switch (state.currentTier) {
    case 'NONE': return `${counterpartId}${persona} is dormant. No active escalation.`;
    case 'GLARE': return `${counterpartId}${persona} is watching. Low-grade menace detected.`;
    case 'PROBE': return `${counterpartId}${persona} is probing. Testing for weaknesses.`;
    case 'PRESSURE': return `${counterpartId}${persona} is applying pressure. Active language cornering.`;
    case 'HUNT': return `${counterpartId}${persona} is hunting. Multi-step persecution in progress.`;
    case 'PUBLIC_SWARM': return `${counterpartId}${persona} has gone public. Social swarming active.`;
    case 'BOSS_WINDOW': return `${counterpartId}${persona} has opened the boss window. Language combat active.`;
    default: return `${counterpartId}${persona} is in an unknown escalation state.`;
  }
}

/** Compute how long a rival should hold at the current tier before advancing. */
export function computeTierHoldDuration(
  tier: RivalryEscalationTier,
  personaProfile: RivalPersonalityEscalationProfile,
  audienceHeat01: number,
): number {
  const baseDurations: Record<RivalryEscalationTier, number> = {
    'NONE': 0, 'GLARE': 6000, 'PROBE': 10000, 'PRESSURE': 14000,
    'HUNT': 18000, 'PUBLIC_SWARM': 8000, 'BOSS_WINDOW': 25000,
  };
  const base = baseDurations[tier] ?? 10000;
  const paceMultiplier = personaProfile.escalationPaceMs / 8000;
  const audienceCompression = 1 - audienceHeat01 * 0.3;
  return Math.round(base * paceMultiplier * audienceCompression);
}

/** Score how effective a specific callback would be at the current escalation tier. */
export function scoreCallbackEffectiveness01(
  callbackTier: 'NONE' | 'LIGHT' | 'MODERATE' | 'HARD' | 'RECEIPT',
  escalationTier: RivalryEscalationTier,
  personaReceiptPreference01: number,
): number {
  const callbackWeight: Record<string, number> = { 'NONE': 0, 'LIGHT': 0.15, 'MODERATE': 0.35, 'HARD': 0.6, 'RECEIPT': 0.85 };
  const tierMultiplier: Record<RivalryEscalationTier, number> = {
    'NONE': 0.1, 'GLARE': 0.3, 'PROBE': 0.5, 'PRESSURE': 0.7,
    'HUNT': 0.85, 'PUBLIC_SWARM': 0.95, 'BOSS_WINDOW': 1.0,
  };
  const base = (callbackWeight[callbackTier] ?? 0) * (tierMultiplier[escalationTier] ?? 0.5);
  return Math.min(1, base * (0.6 + personaReceiptPreference01 * 0.4));
}

/** Build a complete rivalry audit report for proof chain surfaces. */
export function buildRivalryAuditReport(
  policy: RivalryEscalationPolicy,
  request: RivalryEscalationRequest,
  personaId?: string,
): readonly string[] {
  const lines = policy.buildDiagnosticLines(request, personaId);
  const history = policy.getEscalationHistory(request.state.playerId ?? '', request.state.counterpartId);
  const avgIntensity = policy.averageEscalationIntensity(request.state.playerId ?? '', request.state.counterpartId);
  const accelerating = policy.isEscalationAccelerating(request.state.playerId ?? '', request.state.counterpartId);
  return [
    ...lines,
    `history_length=${history.length}|avg_intensity=${avgIntensity.toFixed(3)}|accelerating=${accelerating}`,
    ...history.slice(-5).map((h) => `  ${h.tier}|score=${h.score01.toFixed(3)}|suppressed=${h.suppressed}|callback=${h.usedCallback}`),
  ];
}


