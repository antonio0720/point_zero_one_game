/**
 * ============================================================================
 * POINT ZERO ONE — SHARED CHAT AUDIENCE HEAT CONTRACT
 * FILE: shared/contracts/chat/ChatAudienceHeat.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Shared law for social-atmosphere state across chat channels.
 *
 * This contract exists to make audience behavior first-class instead of leaving
 * crowd pressure implicit inside runtime heuristics. The file defines:
 *
 * 1. canonical heat dimensions,
 * 2. visible vs latent audience pressure,
 * 3. per-channel atmosphere state,
 * 4. witness and swarm pressure envelopes,
 * 5. derived severity / volatility / intimidation models,
 * 6. event deltas and fold/reduce rules,
 * 7. storage-safe snapshots,
 * 8. preview-ready summaries for frontend, backend, and transport.
 *
 * Design doctrine
 * ---------------
 * 1. Shared contracts define law and structure, never runtime side effects.
 * 2. Audience heat is not only "how loud the room is"; it is social force.
 * 3. Visible crowd reaction and shadow pressure must both be tracked.
 * 4. Channel identity matters: GLOBAL, SYNDICATE, DEAL_ROOM, DIRECT, and
 *    shadow rooms do not react the same way.
 * 5. Atmosphere must be serializable, replayable, and explainable.
 * 6. The same event may create different heat in different channels.
 * 7. Pressure must support authored drama without becoming random noise.
 * 8. The contract must remain additive to existing repo authorities.
 * ============================================================================
 */

export type ChatAudienceHeatVersion = 1;

export const CHAT_AUDIENCE_HEAT_VERSION: ChatAudienceHeatVersion = 1;

/**
 * Channel identifiers are kept string-based on purpose so this contract can
 * remain additive even while the channel authority evolves elsewhere.
 */
export type ChatAudienceChannelId = string;
export type ChatAudienceRoomId = string;
export type ChatAudienceParticipantId = string;
export type ChatAudienceNpcId = string;
export type ChatAudienceMomentId = string;
export type ChatAudienceSceneId = string;
export type ChatAudienceEventId = string;
export type ChatAudienceRunId = string;
export type ChatAudienceTurnId = string;
export type ChatAudienceProofId = string;

/**
 * Surface-level atmosphere bands used by UI and orchestration systems to decide
 * whether the room feels quiet, tense, mocking, celebratory, predatory, etc.
 */
export type ChatAudienceMood =
  | 'VACUUM'
  | 'QUIET'
  | 'WATCHFUL'
  | 'CURIOUS'
  | 'TENSE'
  | 'PREDATORY'
  | 'MOCKING'
  | 'HOSTILE'
  | 'EXCITED'
  | 'CELEBRATORY'
  | 'HYPED'
  | 'PANICKED'
  | 'CONSPIRATORIAL'
  | 'JUDGMENTAL'
  | 'REVERENT'
  | 'MERCILESS';

/**
 * Heat phases give directional meaning to the current room atmosphere.
 */
export type ChatAudienceHeatPhase =
  | 'PRE_TRIGGER'
  | 'TRIGGERED'
  | 'CLIMBING'
  | 'PEAK'
  | 'HOLD'
  | 'DISPERSING'
  | 'AFTERMATH'
  | 'LATENT';

/**
 * Which dimension primarily explains why the room currently feels hot.
 */
export type ChatAudienceHeatDriver =
  | 'NONE'
  | 'PERFORMANCE'
  | 'COMEBACK'
  | 'COLLAPSE'
  | 'SHAME'
  | 'HUMILIATION'
  | 'DOMINANCE'
  | 'BLUFF_EXPOSURE'
  | 'RESCUE'
  | 'WITNESSING'
  | 'RIVALRY'
  | 'LIVEOPS'
  | 'SYSTEM_ALERT'
  | 'LEGEND_MOMENT'
  | 'NEGOTIATION'
  | 'SOVEREIGNTY'
  | 'THREAT';

/**
 * Pressure vectors are intentionally separated because "loud" and "dangerous"
 * are not the same thing.
 */
export interface ChatAudienceHeatVector {
  readonly volume: number;
  readonly volatility: number;
  readonly ridicule: number;
  readonly hostility: number;
  readonly intimidation: number;
  readonly fascination: number;
  readonly hype: number;
  readonly witnessPressure: number;
  readonly judgment: number;
  readonly predation: number;
  readonly intimacy: number;
  readonly conspiratorialPressure: number;
  readonly rescuePull: number;
  readonly legendCharge: number;
}

export interface ChatAudienceHeatBudget {
  readonly current: number;
  readonly max: number;
  readonly reserve: number;
  readonly shadowReserve: number;
}

export type ChatAudienceWitnessDensityBand =
  | 'NONE'
  | 'TRACE'
  | 'LIGHT'
  | 'MODERATE'
  | 'HEAVY'
  | 'SATURATED';

export type ChatAudienceExposureBand =
  | 'PRIVATE'
  | 'LOW'
  | 'LIMITED'
  | 'PUBLIC'
  | 'BROADCAST'
  | 'SPECTACLE';

export type ChatAudienceSwarmRisk =
  | 'NONE'
  | 'LOW'
  | 'ELEVATED'
  | 'HIGH'
  | 'SEVERE'
  | 'OVERWHELMING';

export type ChatAudienceStabilityBand =
  | 'LOCKED'
  | 'STABLE'
  | 'FLUID'
  | 'UNSTABLE'
  | 'BREAKING';

export type ChatAudienceHeatSeverity =
  | 'COLD'
  | 'WARM'
  | 'HOT'
  | 'SEVERE'
  | 'EXTREME';

export type ChatAudienceSourceKind =
  | 'SYSTEM'
  | 'PLAYER'
  | 'NPC'
  | 'HATER'
  | 'HELPER'
  | 'CROWD'
  | 'LIVEOPS'
  | 'SCENE'
  | 'MOMENT'
  | 'NEGOTIATION'
  | 'RIVALRY'
  | 'SHADOW'
  | 'TRANSPORT';

export type ChatAudienceWitnessRole =
  | 'BYSTANDER'
  | 'RIVAL'
  | 'ALLY'
  | 'HELPER'
  | 'SPECTATOR'
  | 'MODERATOR'
  | 'SYSTEM'
  | 'DEAL_PARTY'
  | 'FACTION'
  | 'UNKNOWN';

export interface ChatAudienceWitness {
  readonly witnessId: string;
  readonly participantId?: ChatAudienceParticipantId;
  readonly npcId?: ChatAudienceNpcId;
  readonly role: ChatAudienceWitnessRole;
  readonly weight: number;
  readonly hostileWeight: number;
  readonly supportiveWeight: number;
  readonly visible: boolean;
  readonly active: boolean;
  readonly enteredAt: string;
  readonly lastSeenAt: string;
}

export interface ChatAudienceWitnessEnvelope {
  readonly totalWitnesses: number;
  readonly visibleWitnesses: number;
  readonly latentWitnesses: number;
  readonly hostileWitnessWeight: number;
  readonly supportiveWitnessWeight: number;
  readonly neutralWitnessWeight: number;
  readonly densityBand: ChatAudienceWitnessDensityBand;
  readonly exposureBand: ChatAudienceExposureBand;
  readonly swarmRisk: ChatAudienceSwarmRisk;
  readonly crowdCanPileOn: boolean;
  readonly roomFeelsObserved: boolean;
}

export interface ChatAudienceHeatAnchor {
  readonly anchorId: string;
  readonly sourceKind: ChatAudienceSourceKind;
  readonly sourceId?: string;
  readonly momentId?: ChatAudienceMomentId;
  readonly sceneId?: ChatAudienceSceneId;
  readonly eventId?: ChatAudienceEventId;
  readonly proofId?: ChatAudienceProofId;
  readonly label: string;
  readonly startedAt: string;
  readonly lastTouchedAt: string;
  readonly magnitude: number;
  readonly decays: boolean;
  readonly hidden: boolean;
}

export type ChatAudienceHeatDecayMode =
  | 'NONE'
  | 'LINEAR'
  | 'CURVED'
  | 'STEP'
  | 'STICKY'
  | 'SHADOW_PERSISTENT';

export interface ChatAudienceHeatDecayProfile {
  readonly mode: ChatAudienceHeatDecayMode;
  readonly halfLifeMs: number;
  readonly floor: number;
  readonly ceiling: number;
  readonly quietRecoveryMs: number;
  readonly spikeCooldownMs: number;
  readonly shadowRetentionMs: number;
}

export interface ChatAudienceHeatThresholds {
  readonly warm: number;
  readonly hot: number;
  readonly severe: number;
  readonly extreme: number;
  readonly swarm: number;
  readonly panic: number;
  readonly intimidation: number;
  readonly predation: number;
  readonly spectacle: number;
}

export interface ChatAudienceReactionLaw {
  readonly channelId: ChatAudienceChannelId;
  readonly allowsSwarm: boolean;
  readonly allowsLegendCharge: boolean;
  readonly allowsPredation: boolean;
  readonly allowsConspiracy: boolean;
  readonly prefersWitnessPressure: boolean;
  readonly prefersQuietJudgment: boolean;
  readonly prefersExplosiveMockery: boolean;
  readonly helperInterventionSuppression: number;
  readonly rivalryAmplifier: number;
  readonly systemOverrideWeight: number;
}

/**
 * Channel atmosphere snapshot. This is the canonical cross-runtime record.
 */
export interface ChatAudienceHeatSnapshot {
  readonly version: ChatAudienceHeatVersion;
  readonly runId?: ChatAudienceRunId;
  readonly roomId: ChatAudienceRoomId;
  readonly channelId: ChatAudienceChannelId;
  readonly updatedAt: string;
  readonly phase: ChatAudienceHeatPhase;
  readonly mood: ChatAudienceMood;
  readonly driver: ChatAudienceHeatDriver;
  readonly severity: ChatAudienceHeatSeverity;
  readonly stability: ChatAudienceStabilityBand;
  readonly netHeat: number;
  readonly visibleHeat: number;
  readonly latentHeat: number;
  readonly shadowHeat: number;
  readonly burstHeat: number;
  readonly sustainedHeat: number;
  readonly pressure: ChatAudienceHeatVector;
  readonly budget: ChatAudienceHeatBudget;
  readonly thresholds: ChatAudienceHeatThresholds;
  readonly decay: ChatAudienceHeatDecayProfile;
  readonly witnesses: ChatAudienceWitnessEnvelope;
  readonly anchors: readonly ChatAudienceHeatAnchor[];
  readonly law?: ChatAudienceReactionLaw;
  readonly lastEventId?: ChatAudienceEventId;
  readonly lastSceneId?: ChatAudienceSceneId;
  readonly lastMomentId?: ChatAudienceMomentId;
  readonly lastTurnId?: ChatAudienceTurnId;
  readonly notes?: readonly string[];
}

/**
 * Foldable delta contract for event-driven heat changes.
 */
export interface ChatAudienceHeatDelta {
  readonly deltaId: string;
  readonly channelId: ChatAudienceChannelId;
  readonly roomId: ChatAudienceRoomId;
  readonly issuedAt: string;
  readonly sourceKind: ChatAudienceSourceKind;
  readonly sourceId?: string;
  readonly eventId?: ChatAudienceEventId;
  readonly momentId?: ChatAudienceMomentId;
  readonly sceneId?: ChatAudienceSceneId;
  readonly turnId?: ChatAudienceTurnId;
  readonly label: string;
  readonly reason: string;
  readonly heatDelta: number;
  readonly visibleDelta: number;
  readonly latentDelta: number;
  readonly shadowDelta: number;
  readonly burstDelta: number;
  readonly sustainedDelta: number;
  readonly vectorDelta: Partial<ChatAudienceHeatVector>;
  readonly witnessDelta?: Partial<ChatAudienceWitnessEnvelope>;
  readonly driver?: ChatAudienceHeatDriver;
  readonly forceMood?: ChatAudienceMood;
  readonly forcePhase?: ChatAudienceHeatPhase;
  readonly hidden?: boolean;
  readonly sticky?: boolean;
  readonly tags?: readonly string[];
}

/**
 * Reputation linkage to atmosphere. This keeps room pressure and public standing
 * related but not merged into one primitive.
 */
export interface ChatAudienceReputationLink {
  readonly participantId: ChatAudienceParticipantId;
  readonly reputationExposure: number;
  readonly shameExposure: number;
  readonly aweExposure: number;
  readonly notorietyExposure: number;
  readonly trustExposure: number;
  readonly threatExposure: number;
  readonly lastUpdatedAt: string;
}

/**
 * Summary payload for UI surfaces and logs.
 */
export interface ChatAudienceHeatSummary {
  readonly channelId: ChatAudienceChannelId;
  readonly roomId: ChatAudienceRoomId;
  readonly mood: ChatAudienceMood;
  readonly driver: ChatAudienceHeatDriver;
  readonly severity: ChatAudienceHeatSeverity;
  readonly netHeat: number;
  readonly visibleHeat: number;
  readonly latentHeat: number;
  readonly witnessBand: ChatAudienceWitnessDensityBand;
  readonly exposureBand: ChatAudienceExposureBand;
  readonly swarmRisk: ChatAudienceSwarmRisk;
  readonly headline: string;
  readonly shortReason: string;
  readonly heatLabel: string;
}

/**
 * Preview rail support for frontend renderers.
 */
export interface ChatAudiencePreviewRail {
  readonly headline: string;
  readonly chips: readonly string[];
  readonly emphasis: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly canEscalate: boolean;
  readonly canCool: boolean;
  readonly recommendSilence: boolean;
  readonly recommendWitnessLine: boolean;
  readonly recommendHelperShielding: boolean;
}

/**
 * Canonical defaults
 */
export const CHAT_AUDIENCE_HEAT_VECTOR_ZERO: ChatAudienceHeatVector = Object.freeze({
  volume: 0,
  volatility: 0,
  ridicule: 0,
  hostility: 0,
  intimidation: 0,
  fascination: 0,
  hype: 0,
  witnessPressure: 0,
  judgment: 0,
  predation: 0,
  intimacy: 0,
  conspiratorialPressure: 0,
  rescuePull: 0,
  legendCharge: 0,
});

export const CHAT_AUDIENCE_HEAT_THRESHOLDS_DEFAULT: ChatAudienceHeatThresholds = Object.freeze({
  warm: 15,
  hot: 35,
  severe: 60,
  extreme: 85,
  swarm: 55,
  panic: 70,
  intimidation: 50,
  predation: 45,
  spectacle: 65,
});

export const CHAT_AUDIENCE_HEAT_DECAY_DEFAULT: ChatAudienceHeatDecayProfile = Object.freeze({
  mode: 'CURVED',
  halfLifeMs: 30_000,
  floor: 0,
  ceiling: 100,
  quietRecoveryMs: 10_000,
  spikeCooldownMs: 4_000,
  shadowRetentionMs: 120_000,
});

export const CHAT_AUDIENCE_WITNESS_ENVELOPE_ZERO: ChatAudienceWitnessEnvelope = Object.freeze({
  totalWitnesses: 0,
  visibleWitnesses: 0,
  latentWitnesses: 0,
  hostileWitnessWeight: 0,
  supportiveWitnessWeight: 0,
  neutralWitnessWeight: 0,
  densityBand: 'NONE',
  exposureBand: 'PRIVATE',
  swarmRisk: 'NONE',
  crowdCanPileOn: false,
  roomFeelsObserved: false,
});

export const CHAT_AUDIENCE_HEAT_BUDGET_DEFAULT: ChatAudienceHeatBudget = Object.freeze({
  current: 0,
  max: 100,
  reserve: 20,
  shadowReserve: 25,
});

/** Audience band — witness density alias used by social planners. */
export type ChatAudienceBand = ChatAudienceWitnessDensityBand;

/** Swarm risk band — alias for ChatAudienceSwarmRisk used by social planners. */
export type ChatSwarmRiskBand = ChatAudienceSwarmRisk;

/**
 * Channel heat profile shape for real-time social planner consumption.
 * Build via buildChannelHeatProfileFromSummary() from a ChatAudienceHeatSummary.
 */
export interface ChatChannelHeatProfile {
  readonly totalHeat: number;
  readonly witnessDensity: number;
  readonly predationShare: number;
  readonly volatilityScore: number;
  readonly intensityBand: 'QUIET' | 'BUILDING' | 'ELEVATED' | 'INTENSE' | 'MYTHIC';
  readonly audienceBand: ChatAudienceBand;
  readonly swarmRiskBand: ChatSwarmRiskBand;
  readonly mood: ChatAudienceMood;
}

export function clampAudienceUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 100) return 100;
  return value;
}

export function clampAudienceSigned(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= -100) return -100;
  if (value >= 100) return 100;
  return value;
}

export function normalizeAudienceHeatVector(
  vector?: Partial<ChatAudienceHeatVector> | null,
): ChatAudienceHeatVector {
  return {
    volume: clampAudienceUnit(vector?.volume ?? 0),
    volatility: clampAudienceUnit(vector?.volatility ?? 0),
    ridicule: clampAudienceUnit(vector?.ridicule ?? 0),
    hostility: clampAudienceUnit(vector?.hostility ?? 0),
    intimidation: clampAudienceUnit(vector?.intimidation ?? 0),
    fascination: clampAudienceUnit(vector?.fascination ?? 0),
    hype: clampAudienceUnit(vector?.hype ?? 0),
    witnessPressure: clampAudienceUnit(vector?.witnessPressure ?? 0),
    judgment: clampAudienceUnit(vector?.judgment ?? 0),
    predation: clampAudienceUnit(vector?.predation ?? 0),
    intimacy: clampAudienceUnit(vector?.intimacy ?? 0),
    conspiratorialPressure: clampAudienceUnit(vector?.conspiratorialPressure ?? 0),
    rescuePull: clampAudienceUnit(vector?.rescuePull ?? 0),
    legendCharge: clampAudienceUnit(vector?.legendCharge ?? 0),
  };
}

export function mergeAudienceHeatVectors(
  base: ChatAudienceHeatVector,
  delta?: Partial<ChatAudienceHeatVector> | null,
): ChatAudienceHeatVector {
  if (!delta) return base;
  return normalizeAudienceHeatVector({
    volume: base.volume + (delta.volume ?? 0),
    volatility: base.volatility + (delta.volatility ?? 0),
    ridicule: base.ridicule + (delta.ridicule ?? 0),
    hostility: base.hostility + (delta.hostility ?? 0),
    intimidation: base.intimidation + (delta.intimidation ?? 0),
    fascination: base.fascination + (delta.fascination ?? 0),
    hype: base.hype + (delta.hype ?? 0),
    witnessPressure: base.witnessPressure + (delta.witnessPressure ?? 0),
    judgment: base.judgment + (delta.judgment ?? 0),
    predation: base.predation + (delta.predation ?? 0),
    intimacy: base.intimacy + (delta.intimacy ?? 0),
    conspiratorialPressure:
      base.conspiratorialPressure + (delta.conspiratorialPressure ?? 0),
    rescuePull: base.rescuePull + (delta.rescuePull ?? 0),
    legendCharge: base.legendCharge + (delta.legendCharge ?? 0),
  });
}

export function determineAudienceSeverity(
  netHeat: number,
  thresholds: ChatAudienceHeatThresholds = CHAT_AUDIENCE_HEAT_THRESHOLDS_DEFAULT,
): ChatAudienceHeatSeverity {
  const value = clampAudienceUnit(netHeat);
  if (value >= thresholds.extreme) return 'EXTREME';
  if (value >= thresholds.severe) return 'SEVERE';
  if (value >= thresholds.hot) return 'HOT';
  if (value >= thresholds.warm) return 'WARM';
  return 'COLD';
}

export function determineAudienceWitnessDensityBand(
  totalWitnesses: number,
): ChatAudienceWitnessDensityBand {
  if (totalWitnesses <= 0) return 'NONE';
  if (totalWitnesses <= 2) return 'TRACE';
  if (totalWitnesses <= 6) return 'LIGHT';
  if (totalWitnesses <= 14) return 'MODERATE';
  if (totalWitnesses <= 30) return 'HEAVY';
  return 'SATURATED';
}

export function determineAudienceExposureBand(
  envelope: Pick<
    ChatAudienceWitnessEnvelope,
    'totalWitnesses' | 'visibleWitnesses' | 'latentWitnesses'
  >,
): ChatAudienceExposureBand {
  const visible = Math.max(0, envelope.visibleWitnesses);
  const total = Math.max(0, envelope.totalWitnesses);
  if (total <= 1 && visible <= 1) return 'PRIVATE';
  if (visible <= 2) return 'LOW';
  if (visible <= 6) return 'LIMITED';
  if (visible <= 16) return 'PUBLIC';
  if (visible <= 40) return 'BROADCAST';
  return 'SPECTACLE';
}

export function determineAudienceSwarmRisk(
  envelope: ChatAudienceWitnessEnvelope,
  pressure: ChatAudienceHeatVector,
  thresholds: ChatAudienceHeatThresholds = CHAT_AUDIENCE_HEAT_THRESHOLDS_DEFAULT,
): ChatAudienceSwarmRisk {
  const hostile = envelope.hostileWitnessWeight;
  const ridicule = pressure.ridicule;
  const hostility = pressure.hostility;
  const heatComposite = (ridicule + hostility + pressure.volume) / 3;
  const hostileComposite = hostile + heatComposite;
  if (hostileComposite >= thresholds.extreme + 25) return 'OVERWHELMING';
  if (hostileComposite >= thresholds.severe + 20) return 'SEVERE';
  if (hostileComposite >= thresholds.swarm) return 'HIGH';
  if (hostileComposite >= thresholds.warm) return 'ELEVATED';
  if (hostileComposite > 0) return 'LOW';
  return 'NONE';
}

export function determineAudienceMood(
  snapshotLike: Pick<
    ChatAudienceHeatSnapshot,
    'pressure' | 'severity' | 'driver' | 'witnesses' | 'visibleHeat' | 'latentHeat'
  >,
): ChatAudienceMood {
  const p = snapshotLike.pressure;
  if (snapshotLike.visibleHeat <= 2 && snapshotLike.latentHeat <= 3) return 'VACUUM';
  if (p.predation >= 60) return 'PREDATORY';
  if (p.hostility >= 75) return 'HOSTILE';
  if (p.ridicule >= 60) return 'MOCKING';
  if (p.hype >= 75 || p.legendCharge >= 70) return 'HYPED';
  if (p.hype >= 45) return 'CELEBRATORY';
  if (p.conspiratorialPressure >= 55 || p.intimacy >= 55) return 'CONSPIRATORIAL';
  if (p.judgment >= 55 && snapshotLike.witnesses.visibleWitnesses > 3) return 'JUDGMENTAL';
  if (p.witnessPressure >= 45 && p.hostility < 30) return 'WATCHFUL';
  if (p.fascination >= 55) return 'CURIOUS';
  if (snapshotLike.driver === 'RESCUE') return 'WATCHFUL';
  if (snapshotLike.driver === 'COLLAPSE') return 'TENSE';
  if (snapshotLike.driver === 'COMEBACK') return 'EXCITED';
  if (snapshotLike.driver === 'LIVEOPS') return 'PANICKED';
  if (snapshotLike.severity === 'COLD') return 'QUIET';
  return 'TENSE';
}

export function determineAudiencePhase(
  previous: ChatAudienceHeatPhase | undefined,
  heatBefore: number,
  heatAfter: number,
): ChatAudienceHeatPhase {
  const before = clampAudienceUnit(heatBefore);
  const after = clampAudienceUnit(heatAfter);
  if (after <= 0) return 'PRE_TRIGGER';
  if (before <= 0 && after > 0) return 'TRIGGERED';
  if (after > before + 5) return 'CLIMBING';
  if (after >= 80) return 'PEAK';
  if (Math.abs(after - before) <= 3 && after > 0) return 'HOLD';
  if (after < before && after > 10) return 'DISPERSING';
  if (after <= 10 && after > 0) return 'AFTERMATH';
  return previous ?? 'LATENT';
}

export function determineAudienceStability(
  pressure: ChatAudienceHeatVector,
  netHeat: number,
): ChatAudienceStabilityBand {
  const volatilityComposite = (pressure.volatility + pressure.volume + clampAudienceUnit(netHeat)) / 3;
  if (volatilityComposite >= 80) return 'BREAKING';
  if (volatilityComposite >= 60) return 'UNSTABLE';
  if (volatilityComposite >= 35) return 'FLUID';
  if (volatilityComposite >= 10) return 'STABLE';
  return 'LOCKED';
}

export function createAudienceHeatSnapshot(
  input: Omit<
    ChatAudienceHeatSnapshot,
    'severity' | 'mood' | 'phase' | 'stability' | 'pressure' | 'budget' | 'thresholds' | 'decay' | 'witnesses'
  > & {
    pressure?: Partial<ChatAudienceHeatVector>;
    budget?: Partial<ChatAudienceHeatBudget>;
    thresholds?: Partial<ChatAudienceHeatThresholds>;
    decay?: Partial<ChatAudienceHeatDecayProfile>;
    witnesses?: Partial<ChatAudienceWitnessEnvelope>;
    mood?: ChatAudienceMood;
    phase?: ChatAudienceHeatPhase;
    severity?: ChatAudienceHeatSeverity;
    stability?: ChatAudienceStabilityBand;
  },
): ChatAudienceHeatSnapshot {
  const pressure = normalizeAudienceHeatVector(input.pressure);
  const thresholds = {
    ...CHAT_AUDIENCE_HEAT_THRESHOLDS_DEFAULT,
    ...(input.thresholds ?? {}),
  };
  const budget = {
    ...CHAT_AUDIENCE_HEAT_BUDGET_DEFAULT,
    ...(input.budget ?? {}),
  };
  const decay = {
    ...CHAT_AUDIENCE_HEAT_DECAY_DEFAULT,
    ...(input.decay ?? {}),
  };
  const witnesses = {
    ...CHAT_AUDIENCE_WITNESS_ENVELOPE_ZERO,
    ...(input.witnesses ?? {}),
  };
  const severity = input.severity ?? determineAudienceSeverity(input.netHeat, thresholds);
  const mood =
    input.mood ??
    determineAudienceMood({
      pressure,
      severity,
      driver: input.driver,
      witnesses,
      visibleHeat: input.visibleHeat,
      latentHeat: input.latentHeat,
    });
  const phase =
    input.phase ?? determineAudiencePhase(undefined, 0, input.netHeat);
  const stability = input.stability ?? determineAudienceStability(pressure, input.netHeat);

  return {
    version: CHAT_AUDIENCE_HEAT_VERSION,
    runId: input.runId,
    roomId: input.roomId,
    channelId: input.channelId,
    updatedAt: input.updatedAt,
    phase,
    mood,
    driver: input.driver,
    severity,
    stability,
    netHeat: clampAudienceUnit(input.netHeat),
    visibleHeat: clampAudienceUnit(input.visibleHeat),
    latentHeat: clampAudienceUnit(input.latentHeat),
    shadowHeat: clampAudienceUnit(input.shadowHeat),
    burstHeat: clampAudienceUnit(input.burstHeat),
    sustainedHeat: clampAudienceUnit(input.sustainedHeat),
    pressure,
    budget,
    thresholds,
    decay,
    witnesses: {
      ...witnesses,
      densityBand: determineAudienceWitnessDensityBand(witnesses.totalWitnesses),
      exposureBand: determineAudienceExposureBand(witnesses),
      swarmRisk: determineAudienceSwarmRisk(
        {
          ...witnesses,
          densityBand: determineAudienceWitnessDensityBand(witnesses.totalWitnesses),
          exposureBand: determineAudienceExposureBand(witnesses),
          swarmRisk: witnesses.swarmRisk ?? 'NONE',
        } as ChatAudienceWitnessEnvelope,
        pressure,
        thresholds,
      ),
    },
    anchors: input.anchors ?? [],
    law: input.law,
    lastEventId: input.lastEventId,
    lastSceneId: input.lastSceneId,
    lastMomentId: input.lastMomentId,
    lastTurnId: input.lastTurnId,
    notes: input.notes,
  };
}

export function applyAudienceHeatDelta(
  current: ChatAudienceHeatSnapshot,
  delta: ChatAudienceHeatDelta,
): ChatAudienceHeatSnapshot {
  const nextNetHeat = clampAudienceUnit(current.netHeat + delta.heatDelta);
  const nextVisibleHeat = clampAudienceUnit(current.visibleHeat + delta.visibleDelta);
  const nextLatentHeat = clampAudienceUnit(current.latentHeat + delta.latentDelta);
  const nextShadowHeat = clampAudienceUnit(current.shadowHeat + delta.shadowDelta);
  const nextBurstHeat = clampAudienceUnit(current.burstHeat + delta.burstDelta);
  const nextSustainedHeat = clampAudienceUnit(current.sustainedHeat + delta.sustainedDelta);
  const pressure = mergeAudienceHeatVectors(current.pressure, delta.vectorDelta);

  const witnessSource = delta.witnessDelta
    ? {
        ...current.witnesses,
        ...delta.witnessDelta,
      }
    : current.witnesses;

  const witnesses: ChatAudienceWitnessEnvelope = {
    ...witnessSource,
    densityBand: determineAudienceWitnessDensityBand(witnessSource.totalWitnesses),
    exposureBand: determineAudienceExposureBand(witnessSource),
    swarmRisk: determineAudienceSwarmRisk(
      {
        ...witnessSource,
        densityBand: determineAudienceWitnessDensityBand(witnessSource.totalWitnesses),
        exposureBand: determineAudienceExposureBand(witnessSource),
        swarmRisk: witnessSource.swarmRisk ?? 'NONE',
      } as ChatAudienceWitnessEnvelope,
      pressure,
      current.thresholds,
    ),
  };

  const phase = delta.forcePhase ?? determineAudiencePhase(current.phase, current.netHeat, nextNetHeat);
  const severity = determineAudienceSeverity(nextNetHeat, current.thresholds);
  const mood =
    delta.forceMood ??
    determineAudienceMood({
      pressure,
      severity,
      driver: delta.driver ?? current.driver,
      witnesses,
      visibleHeat: nextVisibleHeat,
      latentHeat: nextLatentHeat,
    });

  const stability = determineAudienceStability(pressure, nextNetHeat);

  return {
    ...current,
    updatedAt: delta.issuedAt,
    driver: delta.driver ?? current.driver,
    phase,
    mood,
    severity,
    stability,
    netHeat: nextNetHeat,
    visibleHeat: nextVisibleHeat,
    latentHeat: nextLatentHeat,
    shadowHeat: nextShadowHeat,
    burstHeat: nextBurstHeat,
    sustainedHeat: nextSustainedHeat,
    pressure,
    witnesses,
    lastEventId: delta.eventId ?? current.lastEventId,
    lastSceneId: delta.sceneId ?? current.lastSceneId,
    lastMomentId: delta.momentId ?? current.lastMomentId,
    lastTurnId: delta.turnId ?? current.lastTurnId,
    anchors: current.anchors,
  };
}

export function createAudienceHeatSummary(
  snapshot: ChatAudienceHeatSnapshot,
): ChatAudienceHeatSummary {
  const headline =
    snapshot.mood === 'PREDATORY'
      ? 'The room smells weakness.'
      : snapshot.mood === 'MOCKING'
        ? 'The crowd is starting to laugh.'
        : snapshot.mood === 'CELEBRATORY'
          ? 'The room is leaning into the moment.'
          : snapshot.mood === 'CONSPIRATORIAL'
            ? 'The channel feels quiet, close, and dangerous.'
            : snapshot.mood === 'WATCHFUL'
              ? 'They are paying attention.'
              : snapshot.mood === 'VACUUM'
                ? 'No visible audience pressure.'
                : 'Social pressure is present.';

  const shortReason =
    snapshot.driver === 'COLLAPSE'
      ? 'collapse pressure'
      : snapshot.driver === 'COMEBACK'
        ? 'comeback heat'
        : snapshot.driver === 'RIVALRY'
          ? 'rivalry witnessed'
          : snapshot.driver === 'NEGOTIATION'
            ? 'deal-room tension'
            : snapshot.driver === 'LEGEND_MOMENT'
              ? 'legend charge'
              : snapshot.driver === 'RESCUE'
                ? 'rescue watch'
                : snapshot.driver === 'LIVEOPS'
                  ? 'world event'
                  : 'ambient crowd pressure';

  const heatLabel =
    snapshot.severity === 'EXTREME'
      ? 'extreme heat'
      : snapshot.severity === 'SEVERE'
        ? 'severe heat'
        : snapshot.severity === 'HOT'
          ? 'hot'
          : snapshot.severity === 'WARM'
            ? 'warm'
            : 'cold';

  return {
    channelId: snapshot.channelId,
    roomId: snapshot.roomId,
    mood: snapshot.mood,
    driver: snapshot.driver,
    severity: snapshot.severity,
    netHeat: snapshot.netHeat,
    visibleHeat: snapshot.visibleHeat,
    latentHeat: snapshot.latentHeat,
    witnessBand: snapshot.witnesses.densityBand,
    exposureBand: snapshot.witnesses.exposureBand,
    swarmRisk: snapshot.witnesses.swarmRisk,
    headline,
    shortReason,
    heatLabel,
  };
}

export function createAudiencePreviewRail(
  snapshot: ChatAudienceHeatSnapshot,
): ChatAudiencePreviewRail {
  const summary = createAudienceHeatSummary(snapshot);
  const chips = [
    `mood:${snapshot.mood.toLowerCase()}`,
    `driver:${snapshot.driver.toLowerCase()}`,
    `witness:${snapshot.witnesses.densityBand.toLowerCase()}`,
    `exposure:${snapshot.witnesses.exposureBand.toLowerCase()}`,
    `swarm:${snapshot.witnesses.swarmRisk.toLowerCase()}`,
  ];

  const emphasis: ChatAudiencePreviewRail['emphasis'] =
    snapshot.severity === 'EXTREME' || snapshot.witnesses.swarmRisk === 'OVERWHELMING'
      ? 'CRITICAL'
      : snapshot.severity === 'SEVERE' || snapshot.witnesses.swarmRisk === 'SEVERE'
        ? 'HIGH'
        : snapshot.severity === 'HOT'
          ? 'MEDIUM'
          : 'LOW';

  return {
    headline: summary.headline,
    chips,
    emphasis,
    canEscalate:
      snapshot.phase === 'TRIGGERED' ||
      snapshot.phase === 'CLIMBING' ||
      snapshot.phase === 'HOLD',
    canCool: snapshot.netHeat > 0,
    recommendSilence:
      snapshot.pressure.witnessPressure >= 45 &&
      snapshot.pressure.hostility < 35 &&
      snapshot.witnesses.exposureBand !== 'PRIVATE',
    recommendWitnessLine:
      snapshot.witnesses.visibleWitnesses >= 2 && snapshot.visibleHeat >= 25,
    recommendHelperShielding:
      snapshot.pressure.predation >= 40 ||
      snapshot.pressure.intimidation >= 50 ||
      snapshot.witnesses.swarmRisk === 'HIGH' ||
      snapshot.witnesses.swarmRisk === 'SEVERE' ||
      snapshot.witnesses.swarmRisk === 'OVERWHELMING',
  };
}

export interface ChatAudienceHeatArchiveRecord {
  readonly archiveId: string;
  readonly roomId: ChatAudienceRoomId;
  readonly channelId: ChatAudienceChannelId;
  readonly recordedAt: string;
  readonly summary: ChatAudienceHeatSummary;
  readonly snapshot: ChatAudienceHeatSnapshot;
  readonly tags?: readonly string[];
}

export interface ChatAudienceHeatWindow {
  readonly roomId: ChatAudienceRoomId;
  readonly channelId: ChatAudienceChannelId;
  readonly openedAt: string;
  readonly closedAt?: string;
  readonly peakHeat: number;
  readonly peakMood: ChatAudienceMood;
  readonly peakSeverity: ChatAudienceHeatSeverity;
  readonly peakWitnessExposure: ChatAudienceExposureBand;
  readonly deltas: readonly ChatAudienceHeatDelta[];
}

export interface ChatAudienceHeatTransition {
  readonly from: ChatAudienceMood;
  readonly to: ChatAudienceMood;
  readonly reason: string;
  readonly causedBy: ChatAudienceHeatDriver;
  readonly changedAt: string;
}

export interface ChatAudienceHeatDiagnostics {
  readonly roomId: ChatAudienceRoomId;
  readonly channelId: ChatAudienceChannelId;
  readonly dominantAxis:
    | 'volume'
    | 'volatility'
    | 'ridicule'
    | 'hostility'
    | 'intimidation'
    | 'fascination'
    | 'hype'
    | 'witnessPressure'
    | 'judgment'
    | 'predation'
    | 'intimacy'
    | 'conspiratorialPressure'
    | 'rescuePull'
    | 'legendCharge';
  readonly dominantAxisValue: number;
  readonly mostDangerousAxis:
    | 'hostility'
    | 'intimidation'
    | 'predation'
    | 'ridicule'
    | 'witnessPressure';
  readonly mostDangerousAxisValue: number;
  readonly feelsPublic: boolean;
  readonly feelsPrivate: boolean;
  readonly feelsPredatory: boolean;
  readonly feelsLegendary: boolean;
  readonly feelsRescueSensitive: boolean;
}

export function createAudienceHeatDiagnostics(
  snapshot: ChatAudienceHeatSnapshot,
): ChatAudienceHeatDiagnostics {
  const entries = Object.entries(snapshot.pressure) as Array<
    [keyof ChatAudienceHeatVector, number]
  >;
  const dominant = entries.reduce((best, entry) => (entry[1] > best[1] ? entry : best), entries[0]);
  const dangerAxes: Array<[ChatAudienceHeatDiagnostics['mostDangerousAxis'], number]> = [
    ['hostility', snapshot.pressure.hostility],
    ['intimidation', snapshot.pressure.intimidation],
    ['predation', snapshot.pressure.predation],
    ['ridicule', snapshot.pressure.ridicule],
    ['witnessPressure', snapshot.pressure.witnessPressure],
  ];
  const danger = dangerAxes.reduce((best, entry) => (entry[1] > best[1] ? entry : best), dangerAxes[0]);

  return {
    roomId: snapshot.roomId,
    channelId: snapshot.channelId,
    dominantAxis: dominant[0],
    dominantAxisValue: dominant[1],
    mostDangerousAxis: danger[0],
    mostDangerousAxisValue: danger[1],
    feelsPublic:
      snapshot.witnesses.exposureBand === 'PUBLIC' ||
      snapshot.witnesses.exposureBand === 'BROADCAST' ||
      snapshot.witnesses.exposureBand === 'SPECTACLE',
    feelsPrivate: snapshot.witnesses.exposureBand === 'PRIVATE',
    feelsPredatory: snapshot.pressure.predation >= 45,
    feelsLegendary: snapshot.pressure.legendCharge >= 50,
    feelsRescueSensitive:
      snapshot.pressure.rescuePull >= 35 || snapshot.pressure.intimidation >= 50,
  };
}

export const CHAT_AUDIENCE_HEAT_LAW = Object.freeze({
  version: CHAT_AUDIENCE_HEAT_VERSION,
  defaults: {
    thresholds: CHAT_AUDIENCE_HEAT_THRESHOLDS_DEFAULT,
    decay: CHAT_AUDIENCE_HEAT_DECAY_DEFAULT,
    vector: CHAT_AUDIENCE_HEAT_VECTOR_ZERO,
    witnesses: CHAT_AUDIENCE_WITNESS_ENVELOPE_ZERO,
    budget: CHAT_AUDIENCE_HEAT_BUDGET_DEFAULT,
  },
});
