
/**
 * ============================================================================
 * POINT ZERO ONE — SHARED CHAT AFFINITY CONTRACTS
 * FILE: shared/contracts/chat/ChatAffinity.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical shared affinity surface for the next-generation chat relationship
 * stack. This file does not replace the current lowercase relationship/memory
 * contracts. It extends them with a stable, transport-safe, runtime-safe
 * vocabulary for:
 *
 * - axis semantics
 * - affinity lane scoring
 * - persona-to-player bond shaping
 * - helper / rival / ambient pressure biasing
 * - scene-role and pressure-tier modulation
 * - deterministic bridge helpers for frontend + backend planners
 *
 * Design laws
 * -----------
 * 1. This file stays dependency-light and runtime-safe.
 * 2. No engine imports. Shared contracts only.
 * 3. Every exported helper must be deterministic and side-effect free.
 * 4. The lowercase `relationship.ts` contract remains the base truth. This file
 *    adds richer authoring and scoring language on top of it.
 * 5. Affinity is not sentiment. It is directional relational pressure.
 * ============================================================================
 */

import type {
  ChatRelationshipAxisId,
  ChatRelationshipCounterpartKind,
  ChatRelationshipEventType,
  ChatRelationshipPressureBand,
  ChatRelationshipStance,
  ChatRelationshipVector,
} from './relationship';
import {
  clamp01 as clampRelationship01,
  emptyRelationshipVector,
} from './relationship';

// ============================================================================
// MARK: Core enums / ids
// ============================================================================

export type ChatAffinityPolarity = 'ATTRACT' | 'REPEL' | 'DESTABILIZE' | 'ANCHOR';

export type ChatAffinityZone =
  | 'RESPECT_ZONE'
  | 'FEAR_ZONE'
  | 'CONTEMPT_ZONE'
  | 'FASCINATION_ZONE'
  | 'TRUST_ZONE'
  | 'RIVALRY_ZONE'
  | 'RESCUE_ZONE'
  | 'TRAUMA_ZONE'
  | 'PREDICTION_ZONE'
  | 'UNFINISHED_ZONE';

export type ChatAffinityIntensityBand =
  | 'TRACE'
  | 'LOW'
  | 'RISING'
  | 'ACTIVE'
  | 'SURGING'
  | 'LOCKED';

export type ChatAffinityDirection =
  | 'TOWARD_BOND'
  | 'TOWARD_CONFLICT'
  | 'TOWARD_CONTROL'
  | 'TOWARD_REPAIR'
  | 'TOWARD_WITHDRAWAL'
  | 'TOWARD_OBSESSION'
  | 'TOWARD_WITNESSING'
  | 'TOWARD_NEGOTIATION';

export type ChatAffinityDriver =
  | 'PLAYER_BEHAVIOR'
  | 'NPC_PERSONA'
  | 'CHANNEL_AUDIENCE'
  | 'PRESSURE_TIER'
  | 'SCENE_ROLE'
  | 'CALLBACK_MEMORY'
  | 'RESCUE_HISTORY'
  | 'NEGOTIATION_POSTURE'
  | 'CROWD_WITNESS'
  | 'LIVEOPS_INTRUSION';

export type ChatAffinityLaneId =
  | 'DOMINANCE'
  | 'DEVOTION'
  | 'RIVALRY'
  | 'TRUST'
  | 'HUMILIATION'
  | 'RESCUE'
  | 'CURIOSITY'
  | 'TRAUMA'
  | 'PREDICTION'
  | 'LEGEND';

export type ChatAffinitySurfaceMode =
  | 'VISIBLE'
  | 'SHADOW'
  | 'MIXED'
  | 'REVEAL_LATER';

export type ChatAffinityResolutionMode =
  | 'ABSOLUTE'
  | 'BLENDED'
  | 'MOMENT_WEIGHTED'
  | 'PRESSURE_WEIGHTED'
  | 'WITNESS_WEIGHTED'
  | 'SCENE_WEIGHTED';

export type ChatAffinityCounterpartClass =
  | 'CORE_HELPER'
  | 'CORE_RIVAL'
  | 'ARCHIVIST'
  | 'BROADCAST_SYSTEM'
  | 'AMBIENT_WITNESS'
  | 'DEAL_ROOM_ENTITY'
  | 'CROWD_SWARM'
  | 'SHADOW_OBSERVER';

export type ChatAffinitySignalFlavor =
  | 'SOFT_PULL'
  | 'COLD_MEASURE'
  | 'PREDATORY_LOCK'
  | 'PUBLIC_SHAME'
  | 'PRIVATE_RESCUE'
  | 'OBSESSIVE_ECHO'
  | 'CEREMONIAL_WITNESS'
  | 'TACTICAL_SUSPICION';

export type ChatAffinitySceneBias =
  | 'OPENING_GRAVITY'
  | 'MOCK_ESCALATION'
  | 'PRESSURE_STACKING'
  | 'DEFENSIVE_COVER'
  | 'CALLBACK_INJECTION'
  | 'REVEAL_DELAY'
  | 'CLOSEOUT_AFTERTASTE'
  | 'SILENCE_HOLD';

// ============================================================================
// MARK: Stable arrays / maps
// ============================================================================

export const CHAT_AFFINITY_LANE_IDS = [
  'DOMINANCE',
  'DEVOTION',
  'RIVALRY',
  'TRUST',
  'HUMILIATION',
  'RESCUE',
  'CURIOSITY',
  'TRAUMA',
  'PREDICTION',
  'LEGEND',
] as const satisfies readonly ChatAffinityLaneId[];

export const CHAT_AFFINITY_ZONES = [
  'RESPECT_ZONE',
  'FEAR_ZONE',
  'CONTEMPT_ZONE',
  'FASCINATION_ZONE',
  'TRUST_ZONE',
  'RIVALRY_ZONE',
  'RESCUE_ZONE',
  'TRAUMA_ZONE',
  'PREDICTION_ZONE',
  'UNFINISHED_ZONE',
] as const satisfies readonly ChatAffinityZone[];

export const CHAT_AFFINITY_INTENSITY_BANDS = [
  'TRACE',
  'LOW',
  'RISING',
  'ACTIVE',
  'SURGING',
  'LOCKED',
] as const satisfies readonly ChatAffinityIntensityBand[];

export const CHAT_AFFINITY_DIRECTIONS = [
  'TOWARD_BOND',
  'TOWARD_CONFLICT',
  'TOWARD_CONTROL',
  'TOWARD_REPAIR',
  'TOWARD_WITHDRAWAL',
  'TOWARD_OBSESSION',
  'TOWARD_WITNESSING',
  'TOWARD_NEGOTIATION',
] as const satisfies readonly ChatAffinityDirection[];

export const CHAT_AFFINITY_SIGNAL_FLAVORS = [
  'SOFT_PULL',
  'COLD_MEASURE',
  'PREDATORY_LOCK',
  'PUBLIC_SHAME',
  'PRIVATE_RESCUE',
  'OBSESSIVE_ECHO',
  'CEREMONIAL_WITNESS',
  'TACTICAL_SUSPICION',
] as const satisfies readonly ChatAffinitySignalFlavor[];

export const CHAT_AFFINITY_DEFAULT_SURFACE_MODE: ChatAffinitySurfaceMode = 'MIXED';
export const CHAT_AFFINITY_DEFAULT_RESOLUTION_MODE: ChatAffinityResolutionMode = 'BLENDED';

// ============================================================================
// MARK: Labels / descriptors
// ============================================================================

export interface ChatAffinityAxisDescriptor {
  readonly axisId: ChatRelationshipAxisId;
  readonly zone: ChatAffinityZone;
  readonly polarity: ChatAffinityPolarity;
  readonly displayName: string;
  readonly summary: string;
  readonly preferredDirection: ChatAffinityDirection;
  readonly witnessSensitive: boolean;
  readonly pressureSensitive: boolean;
  readonly rescueSensitive: boolean;
  readonly predictionSensitive: boolean;
}

export interface ChatAffinityLaneDescriptor {
  readonly laneId: ChatAffinityLaneId;
  readonly displayName: string;
  readonly summary: string;
  readonly primaryAxes: readonly ChatRelationshipAxisId[];
  readonly preferredCounterpartKinds: readonly ChatRelationshipCounterpartKind[];
  readonly defaultPolarity: ChatAffinityPolarity;
  readonly defaultDirection: ChatAffinityDirection;
  readonly signalFlavor: ChatAffinitySignalFlavor;
  readonly sceneBias: readonly ChatAffinitySceneBias[];
}

export interface ChatAffinityWeightSet {
  readonly respect: number;
  readonly fear: number;
  readonly contempt: number;
  readonly fascination: number;
  readonly patience: number;
  readonly familiarity: number;
  readonly prediction: number;
  readonly trauma: number;
  readonly unfinished: number;
  readonly obsession: number;
}

export interface ChatAffinityPressureWeightSet {
  readonly low: number;
  readonly medium: number;
  readonly high: number;
  readonly critical: number;
}

export interface ChatAffinityWitnessWeightSet {
  readonly privateWitness: number;
  readonly partialWitness: number;
  readonly publicWitness: number;
  readonly swarmWitness: number;
}

export interface ChatAffinitySceneRoleWeightSet {
  readonly open: number;
  readonly pressure: number;
  readonly mock: number;
  readonly defend: number;
  readonly witness: number;
  readonly callback: number;
  readonly reveal: number;
  readonly silence: number;
  readonly echo: number;
  readonly close: number;
}

export interface ChatAffinityIntentProfile {
  readonly profileId: string;
  readonly laneId: ChatAffinityLaneId;
  readonly zone: ChatAffinityZone;
  readonly counterpartClass: ChatAffinityCounterpartClass;
  readonly signalFlavor: ChatAffinitySignalFlavor;
  readonly preferredStances: readonly ChatRelationshipStance[];
  readonly primaryWeights: ChatAffinityWeightSet;
  readonly pressureWeights: ChatAffinityPressureWeightSet;
  readonly witnessWeights: ChatAffinityWitnessWeightSet;
  readonly sceneRoleWeights: ChatAffinitySceneRoleWeightSet;
  readonly helperBias01: number;
  readonly rivalBias01: number;
  readonly archivistBias01: number;
  readonly negotiationBias01: number;
  readonly silenceBias01: number;
  readonly revealBias01: number;
  readonly legendBias01: number;
  readonly notes: readonly string[];
}

export interface ChatAffinitySignal {
  readonly laneId: ChatAffinityLaneId;
  readonly zone: ChatAffinityZone;
  readonly direction: ChatAffinityDirection;
  readonly intensity01: number;
  readonly intensityBand: ChatAffinityIntensityBand;
  readonly polarity: ChatAffinityPolarity;
  readonly flavor: ChatAffinitySignalFlavor;
  readonly counterpartKind?: ChatRelationshipCounterpartKind;
  readonly pressureBand?: ChatRelationshipPressureBand;
  readonly surfaceMode: ChatAffinitySurfaceMode;
  readonly sceneBiases: readonly ChatAffinitySceneBias[];
  readonly notes: readonly string[];
}

export interface ChatAffinityEvaluationInput {
  readonly vector: ChatRelationshipVector;
  readonly counterpartKind?: ChatRelationshipCounterpartKind;
  readonly pressureBand?: ChatRelationshipPressureBand;
  readonly sceneRole?:
    | 'OPEN'
    | 'PRESSURE'
    | 'MOCK'
    | 'DEFEND'
    | 'WITNESS'
    | 'CALLBACK'
    | 'REVEAL'
    | 'SILENCE'
    | 'ECHO'
    | 'CLOSE';
  readonly witness01?: number;
  readonly unresolvedMemoryCount?: number;
  readonly callbackDensity01?: number;
  readonly rescueDebt01?: number;
  readonly negotiationHeat01?: number;
  readonly publicPressureBias01?: number;
  readonly privatePressureBias01?: number;
  readonly legendPotential01?: number;
  readonly notes?: readonly string[];
}

export interface ChatAffinityLaneScore {
  readonly laneId: ChatAffinityLaneId;
  readonly rawScore01: number;
  readonly adjustedScore01: number;
  readonly intensityBand: ChatAffinityIntensityBand;
  readonly direction: ChatAffinityDirection;
  readonly polarity: ChatAffinityPolarity;
  readonly triggeredAxes: readonly ChatRelationshipAxisId[];
  readonly notes: readonly string[];
}

export interface ChatAffinityEvaluation {
  readonly dominantLaneId: ChatAffinityLaneId;
  readonly dominantZone: ChatAffinityZone;
  readonly dominantDirection: ChatAffinityDirection;
  readonly dominantPolarity: ChatAffinityPolarity;
  readonly aggregateIntensity01: number;
  readonly aggregateIntensityBand: ChatAffinityIntensityBand;
  readonly scores: readonly ChatAffinityLaneScore[];
  readonly surfacedSignals: readonly ChatAffinitySignal[];
  readonly notes: readonly string[];
}

// ============================================================================
// MARK: Axis descriptors
// ============================================================================

export const CHAT_AFFINITY_AXIS_DESCRIPTORS: Readonly<
  Record<ChatRelationshipAxisId, ChatAffinityAxisDescriptor>
> = Object.freeze({
  CONTEMPT: {
    axisId: 'CONTEMPT',
    zone: 'CONTEMPT_ZONE',
    polarity: 'REPEL',
    displayName: 'Contempt',
    summary: 'Devaluation, dismissal, mockery, and social belittling pressure.',
    preferredDirection: 'TOWARD_CONFLICT',
    witnessSensitive: true,
    pressureSensitive: true,
    rescueSensitive: false,
    predictionSensitive: false,
  },
  FASCINATION: {
    axisId: 'FASCINATION',
    zone: 'FASCINATION_ZONE',
    polarity: 'ATTRACT',
    displayName: 'Fascination',
    summary: 'Compelled attention, fixation, and myth-building interest.',
    preferredDirection: 'TOWARD_BOND',
    witnessSensitive: true,
    pressureSensitive: false,
    rescueSensitive: false,
    predictionSensitive: true,
  },
  RESPECT: {
    axisId: 'RESPECT',
    zone: 'RESPECT_ZONE',
    polarity: 'ANCHOR',
    displayName: 'Respect',
    summary: 'Measured esteem, earned credibility, and disciplined recognition.',
    preferredDirection: 'TOWARD_BOND',
    witnessSensitive: true,
    pressureSensitive: false,
    rescueSensitive: true,
    predictionSensitive: false,
  },
  FEAR: {
    axisId: 'FEAR',
    zone: 'FEAR_ZONE',
    polarity: 'DESTABILIZE',
    displayName: 'Fear',
    summary: 'Threat sensitivity, caution, and anticipated damage from the bond.',
    preferredDirection: 'TOWARD_CONTROL',
    witnessSensitive: false,
    pressureSensitive: true,
    rescueSensitive: false,
    predictionSensitive: false,
  },
  OBSESSION: {
    axisId: 'OBSESSION',
    zone: 'RIVALRY_ZONE',
    polarity: 'DESTABILIZE',
    displayName: 'Obsession',
    summary: 'Compulsive repeat focus that intensifies callbacks and escalation.',
    preferredDirection: 'TOWARD_OBSESSION',
    witnessSensitive: true,
    pressureSensitive: true,
    rescueSensitive: false,
    predictionSensitive: true,
  },
  PATIENCE: {
    axisId: 'PATIENCE',
    zone: 'TRUST_ZONE',
    polarity: 'ANCHOR',
    displayName: 'Patience',
    summary: 'Tolerance for delay, repair, or measured observation before action.',
    preferredDirection: 'TOWARD_REPAIR',
    witnessSensitive: false,
    pressureSensitive: true,
    rescueSensitive: true,
    predictionSensitive: false,
  },
  FAMILIARITY: {
    axisId: 'FAMILIARITY',
    zone: 'TRUST_ZONE',
    polarity: 'ATTRACT',
    displayName: 'Familiarity',
    summary: 'Known history, repeated contact, and lower uncertainty in interaction.',
    preferredDirection: 'TOWARD_BOND',
    witnessSensitive: false,
    pressureSensitive: false,
    rescueSensitive: true,
    predictionSensitive: true,
  },
  PREDICTIVE_CONFIDENCE: {
    axisId: 'PREDICTIVE_CONFIDENCE',
    zone: 'PREDICTION_ZONE',
    polarity: 'ANCHOR',
    displayName: 'Predictive Confidence',
    summary: 'Confidence in reading the player and pre-empting future choices.',
    preferredDirection: 'TOWARD_CONTROL',
    witnessSensitive: false,
    pressureSensitive: true,
    rescueSensitive: false,
    predictionSensitive: true,
  },
  TRAUMA_DEBT: {
    axisId: 'TRAUMA_DEBT',
    zone: 'TRAUMA_ZONE',
    polarity: 'DESTABILIZE',
    displayName: 'Trauma Debt',
    summary: 'Accumulated unresolved damage that shapes future reactions.',
    preferredDirection: 'TOWARD_WITHDRAWAL',
    witnessSensitive: true,
    pressureSensitive: true,
    rescueSensitive: true,
    predictionSensitive: false,
  },
  UNFINISHED_BUSINESS: {
    axisId: 'UNFINISHED_BUSINESS',
    zone: 'UNFINISHED_ZONE',
    polarity: 'DESTABILIZE',
    displayName: 'Unfinished Business',
    summary: 'Open loops, unresolved scenes, and pressure for re-entry.',
    preferredDirection: 'TOWARD_WITNESSING',
    witnessSensitive: true,
    pressureSensitive: false,
    rescueSensitive: false,
    predictionSensitive: true,
  },
});

// ============================================================================
// MARK: Lane descriptors
// ============================================================================

export const CHAT_AFFINITY_LANE_DESCRIPTORS: Readonly<
  Record<ChatAffinityLaneId, ChatAffinityLaneDescriptor>
> = Object.freeze({
  DOMINANCE: {
    laneId: 'DOMINANCE',
    displayName: 'Dominance',
    summary: 'Control, intimidation, and pressure-over-the-player behavior.',
    primaryAxes: ['FEAR', 'PREDICTIVE_CONFIDENCE', 'CONTEMPT'],
    preferredCounterpartKinds: ['BOT', 'RIVAL', 'SYSTEM'],
    defaultPolarity: 'DESTABILIZE',
    defaultDirection: 'TOWARD_CONTROL',
    signalFlavor: 'PREDATORY_LOCK',
    sceneBias: ['PRESSURE_STACKING', 'REVEAL_DELAY'],
  },
  DEVOTION: {
    laneId: 'DEVOTION',
    displayName: 'Devotion',
    summary: 'Protective attachment and belief that the player can recover.',
    primaryAxes: ['RESPECT', 'FAMILIARITY', 'PATIENCE'],
    preferredCounterpartKinds: ['HELPER', 'ARCHIVIST', 'NPC'],
    defaultPolarity: 'ATTRACT',
    defaultDirection: 'TOWARD_REPAIR',
    signalFlavor: 'PRIVATE_RESCUE',
    sceneBias: ['DEFENSIVE_COVER', 'CLOSEOUT_AFTERTASTE'],
  },
  RIVALRY: {
    laneId: 'RIVALRY',
    displayName: 'Rivalry',
    summary: 'Escalating competitive fixation with personal callback weight.',
    primaryAxes: ['OBSESSION', 'CONTEMPT', 'RESPECT'],
    preferredCounterpartKinds: ['RIVAL', 'BOT', 'NPC'],
    defaultPolarity: 'DESTABILIZE',
    defaultDirection: 'TOWARD_OBSESSION',
    signalFlavor: 'OBSESSIVE_ECHO',
    sceneBias: ['MOCK_ESCALATION', 'CALLBACK_INJECTION'],
  },
  TRUST: {
    laneId: 'TRUST',
    displayName: 'Trust',
    summary: 'Belief in the player, the bond, or the integrity of the exchange.',
    primaryAxes: ['RESPECT', 'PATIENCE', 'FAMILIARITY'],
    preferredCounterpartKinds: ['HELPER', 'ARCHIVIST', 'NPC'],
    defaultPolarity: 'ANCHOR',
    defaultDirection: 'TOWARD_BOND',
    signalFlavor: 'SOFT_PULL',
    sceneBias: ['OPENING_GRAVITY', 'DEFENSIVE_COVER'],
  },
  HUMILIATION: {
    laneId: 'HUMILIATION',
    displayName: 'Humiliation',
    summary: 'Public witness pressure, shame, ridicule, and status injury.',
    primaryAxes: ['CONTEMPT', 'FEAR', 'UNFINISHED_BUSINESS'],
    preferredCounterpartKinds: ['RIVAL', 'AMBIENT', 'SYSTEM'],
    defaultPolarity: 'REPEL',
    defaultDirection: 'TOWARD_CONFLICT',
    signalFlavor: 'PUBLIC_SHAME',
    sceneBias: ['MOCK_ESCALATION', 'PRESSURE_STACKING', 'REVEAL_DELAY'],
  },
  RESCUE: {
    laneId: 'RESCUE',
    displayName: 'Rescue',
    summary: 'Intervention energy that seeks stabilization and re-entry.',
    primaryAxes: ['PATIENCE', 'RESPECT', 'TRAUMA_DEBT'],
    preferredCounterpartKinds: ['HELPER', 'ARCHIVIST', 'SYSTEM'],
    defaultPolarity: 'ANCHOR',
    defaultDirection: 'TOWARD_REPAIR',
    signalFlavor: 'PRIVATE_RESCUE',
    sceneBias: ['SILENCE_HOLD', 'DEFENSIVE_COVER', 'CLOSEOUT_AFTERTASTE'],
  },
  CURIOSITY: {
    laneId: 'CURIOSITY',
    displayName: 'Curiosity',
    summary: 'Studying, probing, or testing without full commitment.',
    primaryAxes: ['FASCINATION', 'PREDICTIVE_CONFIDENCE', 'FAMILIARITY'],
    preferredCounterpartKinds: ['NPC', 'ARCHIVIST', 'BOT'],
    defaultPolarity: 'ATTRACT',
    defaultDirection: 'TOWARD_WITNESSING',
    signalFlavor: 'TACTICAL_SUSPICION',
    sceneBias: ['OPENING_GRAVITY', 'REVEAL_DELAY', 'CALLBACK_INJECTION'],
  },
  TRAUMA: {
    laneId: 'TRAUMA',
    displayName: 'Trauma',
    summary: 'Relational damage that alters timing, trust, and escalation.',
    primaryAxes: ['TRAUMA_DEBT', 'FEAR', 'UNFINISHED_BUSINESS'],
    preferredCounterpartKinds: ['HELPER', 'RIVAL', 'SYSTEM'],
    defaultPolarity: 'DESTABILIZE',
    defaultDirection: 'TOWARD_WITHDRAWAL',
    signalFlavor: 'COLD_MEASURE',
    sceneBias: ['SILENCE_HOLD', 'REVEAL_DELAY'],
  },
  PREDICTION: {
    laneId: 'PREDICTION',
    displayName: 'Prediction',
    summary: 'Pattern lock and anticipatory control over the player.',
    primaryAxes: ['PREDICTIVE_CONFIDENCE', 'FAMILIARITY', 'FEAR'],
    preferredCounterpartKinds: ['BOT', 'SYSTEM', 'ARCHIVIST'],
    defaultPolarity: 'ANCHOR',
    defaultDirection: 'TOWARD_CONTROL',
    signalFlavor: 'COLD_MEASURE',
    sceneBias: ['REVEAL_DELAY', 'PRESSURE_STACKING'],
  },
  LEGEND: {
    laneId: 'LEGEND',
    displayName: 'Legend',
    summary: 'Mythic weight, witness memory, and prestige carryover.',
    primaryAxes: ['FASCINATION', 'RESPECT', 'UNFINISHED_BUSINESS'],
    preferredCounterpartKinds: ['ARCHIVIST', 'AMBIENT', 'SYSTEM'],
    defaultPolarity: 'ATTRACT',
    defaultDirection: 'TOWARD_WITNESSING',
    signalFlavor: 'CEREMONIAL_WITNESS',
    sceneBias: ['CALLBACK_INJECTION', 'CLOSEOUT_AFTERTASTE'],
  },
});

// ============================================================================
// MARK: Defaults / seeds
// ============================================================================

export function createNeutralAffinityWeightSet(): ChatAffinityWeightSet {
  return {
    respect: 0,
    fear: 0,
    contempt: 0,
    fascination: 0,
    patience: 0,
    familiarity: 0,
    prediction: 0,
    trauma: 0,
    unfinished: 0,
    obsession: 0,
  };
}

export function createUnitPressureWeightSet(): ChatAffinityPressureWeightSet {
  return {
    low: 1,
    medium: 1,
    high: 1,
    critical: 1,
  };
}

export function createUnitWitnessWeightSet(): ChatAffinityWitnessWeightSet {
  return {
    privateWitness: 0.85,
    partialWitness: 1,
    publicWitness: 1.15,
    swarmWitness: 1.3,
  };
}

export function createSceneRoleWeightSet(): ChatAffinitySceneRoleWeightSet {
  return {
    open: 1,
    pressure: 1,
    mock: 1,
    defend: 1,
    witness: 1,
    callback: 1,
    reveal: 1,
    silence: 1,
    echo: 1,
    close: 1,
  };
}

export function createDominanceIntentProfile(): ChatAffinityIntentProfile {
  return {
    profileId: 'dominance/default/v1',
    laneId: 'DOMINANCE',
    zone: 'FEAR_ZONE',
    counterpartClass: 'CORE_RIVAL',
    signalFlavor: 'PREDATORY_LOCK',
    preferredStances: ['PREDATORY', 'HUNTING', 'CLINICAL'],
    primaryWeights: {
      respect: -0.15,
      fear: 0.9,
      contempt: 0.6,
      fascination: 0.15,
      patience: -0.2,
      familiarity: 0.15,
      prediction: 0.75,
      trauma: 0.35,
      unfinished: 0.3,
      obsession: 0.55,
    },
    pressureWeights: {
      low: 0.8,
      medium: 1,
      high: 1.15,
      critical: 1.3,
    },
    witnessWeights: {
      privateWitness: 0.95,
      partialWitness: 1,
      publicWitness: 1.12,
      swarmWitness: 1.24,
    },
    sceneRoleWeights: {
      open: 0.9,
      pressure: 1.2,
      mock: 1.18,
      defend: 0.65,
      witness: 0.9,
      callback: 1.05,
      reveal: 1.1,
      silence: 0.82,
      echo: 1.08,
      close: 0.88,
    },
    helperBias01: 0.08,
    rivalBias01: 0.92,
    archivistBias01: 0.22,
    negotiationBias01: 0.36,
    silenceBias01: 0.28,
    revealBias01: 0.74,
    legendBias01: 0.26,
    notes: [
      'Optimized for rivals that want to contain or humiliate under pressure.',
      'Public witness slightly amplifies dominance theater.',
    ],
  };
}

export function createDevotionIntentProfile(): ChatAffinityIntentProfile {
  return {
    profileId: 'devotion/default/v1',
    laneId: 'DEVOTION',
    zone: 'TRUST_ZONE',
    counterpartClass: 'CORE_HELPER',
    signalFlavor: 'PRIVATE_RESCUE',
    preferredStances: ['PROTECTIVE', 'CURIOUS', 'RESPECTFUL'],
    primaryWeights: {
      respect: 0.9,
      fear: -0.25,
      contempt: -0.4,
      fascination: 0.38,
      patience: 0.82,
      familiarity: 0.72,
      prediction: 0.2,
      trauma: 0.48,
      unfinished: 0.3,
      obsession: 0.1,
    },
    pressureWeights: {
      low: 0.82,
      medium: 1,
      high: 1.16,
      critical: 1.28,
    },
    witnessWeights: {
      privateWitness: 1.1,
      partialWitness: 1,
      publicWitness: 0.9,
      swarmWitness: 0.84,
    },
    sceneRoleWeights: {
      open: 1,
      pressure: 0.9,
      mock: 0.45,
      defend: 1.2,
      witness: 0.8,
      callback: 0.95,
      reveal: 0.9,
      silence: 1.08,
      echo: 0.86,
      close: 1.16,
    },
    helperBias01: 0.97,
    rivalBias01: 0.06,
    archivistBias01: 0.4,
    negotiationBias01: 0.18,
    silenceBias01: 0.62,
    revealBias01: 0.35,
    legendBias01: 0.41,
    notes: [
      'Helpers lean private when devotion is active.',
      'Critical pressure increases rescue-compatible attachment energy.',
    ],
  };
}

export function createRivalryIntentProfile(): ChatAffinityIntentProfile {
  return {
    profileId: 'rivalry/default/v1',
    laneId: 'RIVALRY',
    zone: 'RIVALRY_ZONE',
    counterpartClass: 'CORE_RIVAL',
    signalFlavor: 'OBSESSIVE_ECHO',
    preferredStances: ['OBSESSED', 'HUNTING', 'PREDATORY', 'RESPECTFUL'],
    primaryWeights: {
      respect: 0.28,
      fear: 0.32,
      contempt: 0.7,
      fascination: 0.55,
      patience: -0.15,
      familiarity: 0.48,
      prediction: 0.36,
      trauma: 0.22,
      unfinished: 0.58,
      obsession: 0.95,
    },
    pressureWeights: {
      low: 0.9,
      medium: 1,
      high: 1.12,
      critical: 1.18,
    },
    witnessWeights: {
      privateWitness: 0.9,
      partialWitness: 1,
      publicWitness: 1.1,
      swarmWitness: 1.18,
    },
    sceneRoleWeights: {
      open: 0.96,
      pressure: 1.02,
      mock: 1.22,
      defend: 0.54,
      witness: 1,
      callback: 1.28,
      reveal: 1.14,
      silence: 0.7,
      echo: 1.25,
      close: 0.92,
    },
    helperBias01: 0.04,
    rivalBias01: 0.96,
    archivistBias01: 0.18,
    negotiationBias01: 0.31,
    silenceBias01: 0.2,
    revealBias01: 0.8,
    legendBias01: 0.62,
    notes: [
      'Rivalry heavily rewards callbacks and unresolved business.',
      'Public humiliation moments can convert into obsession-driven echo loops.',
    ],
  };
}

export function createTrustIntentProfile(): ChatAffinityIntentProfile {
  return {
    profileId: 'trust/default/v1',
    laneId: 'TRUST',
    zone: 'TRUST_ZONE',
    counterpartClass: 'CORE_HELPER',
    signalFlavor: 'SOFT_PULL',
    preferredStances: ['RESPECTFUL', 'PROTECTIVE', 'CURIOUS'],
    primaryWeights: {
      respect: 0.84,
      fear: -0.2,
      contempt: -0.42,
      fascination: 0.2,
      patience: 0.78,
      familiarity: 0.8,
      prediction: 0.12,
      trauma: 0.2,
      unfinished: 0.18,
      obsession: -0.08,
    },
    pressureWeights: {
      low: 1,
      medium: 1,
      high: 0.96,
      critical: 0.9,
    },
    witnessWeights: {
      privateWitness: 1.08,
      partialWitness: 1,
      publicWitness: 0.94,
      swarmWitness: 0.86,
    },
    sceneRoleWeights: {
      open: 1.1,
      pressure: 0.86,
      mock: 0.35,
      defend: 1.2,
      witness: 0.88,
      callback: 0.9,
      reveal: 0.84,
      silence: 0.92,
      echo: 0.76,
      close: 1.22,
    },
    helperBias01: 0.94,
    rivalBias01: 0.02,
    archivistBias01: 0.24,
    negotiationBias01: 0.12,
    silenceBias01: 0.48,
    revealBias01: 0.26,
    legendBias01: 0.3,
    notes: [
      'Trust is strongest when patience and familiarity reinforce respect.',
      'Crowd-heavy scenes slightly suppress intimate trust expression.',
    ],
  };
}

export function createHumiliationIntentProfile(): ChatAffinityIntentProfile {
  return {
    profileId: 'humiliation/default/v1',
    laneId: 'HUMILIATION',
    zone: 'CONTEMPT_ZONE',
    counterpartClass: 'CROWD_SWARM',
    signalFlavor: 'PUBLIC_SHAME',
    preferredStances: ['DISMISSIVE', 'PREDATORY', 'HUNTING'],
    primaryWeights: {
      respect: -0.22,
      fear: 0.46,
      contempt: 0.95,
      fascination: 0.18,
      patience: -0.35,
      familiarity: 0.12,
      prediction: 0.28,
      trauma: 0.56,
      unfinished: 0.62,
      obsession: 0.3,
    },
    pressureWeights: {
      low: 0.74,
      medium: 1,
      high: 1.22,
      critical: 1.34,
    },
    witnessWeights: {
      privateWitness: 0.62,
      partialWitness: 0.92,
      publicWitness: 1.2,
      swarmWitness: 1.4,
    },
    sceneRoleWeights: {
      open: 0.84,
      pressure: 1.12,
      mock: 1.3,
      defend: 0.3,
      witness: 1.26,
      callback: 1.08,
      reveal: 1.06,
      silence: 0.46,
      echo: 1.15,
      close: 0.74,
    },
    helperBias01: 0.01,
    rivalBias01: 0.74,
    archivistBias01: 0.16,
    negotiationBias01: 0.22,
    silenceBias01: 0.12,
    revealBias01: 0.78,
    legendBias01: 0.68,
    notes: [
      'Humiliation scales hardest under crowd witness and critical pressure.',
      'Strong unresolved business keeps the wound narratively alive.',
    ],
  };
}

export function createRescueIntentProfile(): ChatAffinityIntentProfile {
  return {
    profileId: 'rescue/default/v1',
    laneId: 'RESCUE',
    zone: 'RESCUE_ZONE',
    counterpartClass: 'CORE_HELPER',
    signalFlavor: 'PRIVATE_RESCUE',
    preferredStances: ['PROTECTIVE', 'WOUNDED', 'CURIOUS'],
    primaryWeights: {
      respect: 0.66,
      fear: 0.14,
      contempt: -0.2,
      fascination: 0.24,
      patience: 0.9,
      familiarity: 0.52,
      prediction: 0.15,
      trauma: 0.82,
      unfinished: 0.36,
      obsession: 0.05,
    },
    pressureWeights: {
      low: 0.62,
      medium: 0.9,
      high: 1.16,
      critical: 1.38,
    },
    witnessWeights: {
      privateWitness: 1.18,
      partialWitness: 1,
      publicWitness: 0.84,
      swarmWitness: 0.76,
    },
    sceneRoleWeights: {
      open: 0.9,
      pressure: 1,
      mock: 0.2,
      defend: 1.28,
      witness: 0.82,
      callback: 0.88,
      reveal: 0.72,
      silence: 1.18,
      echo: 0.64,
      close: 1.24,
    },
    helperBias01: 0.99,
    rivalBias01: 0.01,
    archivistBias01: 0.2,
    negotiationBias01: 0.08,
    silenceBias01: 0.82,
    revealBias01: 0.24,
    legendBias01: 0.22,
    notes: [
      'Rescue tolerates silence before comfort when trauma debt is high.',
      'Critical pressure dramatically increases helper intervention value.',
    ],
  };
}

export function createCuriosityIntentProfile(): ChatAffinityIntentProfile {
  return {
    profileId: 'curiosity/default/v1',
    laneId: 'CURIOSITY',
    zone: 'FASCINATION_ZONE',
    counterpartClass: 'ARCHIVIST',
    signalFlavor: 'TACTICAL_SUSPICION',
    preferredStances: ['CURIOUS', 'CLINICAL', 'PROBING'],
    primaryWeights: {
      respect: 0.22,
      fear: 0.06,
      contempt: -0.08,
      fascination: 0.9,
      patience: 0.48,
      familiarity: 0.42,
      prediction: 0.68,
      trauma: 0.1,
      unfinished: 0.54,
      obsession: 0.25,
    },
    pressureWeights: {
      low: 1.12,
      medium: 1,
      high: 0.94,
      critical: 0.88,
    },
    witnessWeights: {
      privateWitness: 1,
      partialWitness: 1,
      publicWitness: 0.98,
      swarmWitness: 0.92,
    },
    sceneRoleWeights: {
      open: 1.18,
      pressure: 0.82,
      mock: 0.42,
      defend: 0.52,
      witness: 1.12,
      callback: 1.08,
      reveal: 1.14,
      silence: 0.76,
      echo: 0.92,
      close: 0.88,
    },
    helperBias01: 0.16,
    rivalBias01: 0.28,
    archivistBias01: 0.92,
    negotiationBias01: 0.36,
    silenceBias01: 0.34,
    revealBias01: 0.82,
    legendBias01: 0.56,
    notes: [
      'Curiosity is strongest in authored witness / reveal moments.',
      'Predictive confidence converts curiosity into tactical probing.',
    ],
  };
}

export function createTraumaIntentProfile(): ChatAffinityIntentProfile {
  return {
    profileId: 'trauma/default/v1',
    laneId: 'TRAUMA',
    zone: 'TRAUMA_ZONE',
    counterpartClass: 'SHADOW_OBSERVER',
    signalFlavor: 'COLD_MEASURE',
    preferredStances: ['WOUNDED', 'DISMISSIVE', 'CLINICAL'],
    primaryWeights: {
      respect: -0.06,
      fear: 0.62,
      contempt: 0.16,
      fascination: 0.12,
      patience: 0.08,
      familiarity: 0.24,
      prediction: 0.2,
      trauma: 0.98,
      unfinished: 0.72,
      obsession: 0.14,
    },
    pressureWeights: {
      low: 0.9,
      medium: 1,
      high: 1.16,
      critical: 1.26,
    },
    witnessWeights: {
      privateWitness: 1.08,
      partialWitness: 1,
      publicWitness: 1.04,
      swarmWitness: 1.08,
    },
    sceneRoleWeights: {
      open: 0.7,
      pressure: 1.04,
      mock: 0.82,
      defend: 0.74,
      witness: 1.12,
      callback: 1.24,
      reveal: 1.02,
      silence: 1.26,
      echo: 1.08,
      close: 0.82,
    },
    helperBias01: 0.34,
    rivalBias01: 0.42,
    archivistBias01: 0.44,
    negotiationBias01: 0.14,
    silenceBias01: 0.9,
    revealBias01: 0.46,
    legendBias01: 0.18,
    notes: [
      'Trauma energy favors callbacks, witness beats, and held silence.',
      'It should rarely present as noisy chatter unless humiliation is also high.',
    ],
  };
}

export function createPredictionIntentProfile(): ChatAffinityIntentProfile {
  return {
    profileId: 'prediction/default/v1',
    laneId: 'PREDICTION',
    zone: 'PREDICTION_ZONE',
    counterpartClass: 'BROADCAST_SYSTEM',
    signalFlavor: 'COLD_MEASURE',
    preferredStances: ['CLINICAL', 'PREDATORY', 'PROBING'],
    primaryWeights: {
      respect: 0.04,
      fear: 0.38,
      contempt: 0.12,
      fascination: 0.24,
      patience: 0.22,
      familiarity: 0.46,
      prediction: 0.98,
      trauma: 0.08,
      unfinished: 0.3,
      obsession: 0.18,
    },
    pressureWeights: {
      low: 0.96,
      medium: 1,
      high: 1.1,
      critical: 1.18,
    },
    witnessWeights: {
      privateWitness: 1,
      partialWitness: 1,
      publicWitness: 0.96,
      swarmWitness: 0.92,
    },
    sceneRoleWeights: {
      open: 0.92,
      pressure: 1.08,
      mock: 0.76,
      defend: 0.52,
      witness: 1,
      callback: 1.02,
      reveal: 1.18,
      silence: 0.84,
      echo: 0.94,
      close: 0.9,
    },
    helperBias01: 0.06,
    rivalBias01: 0.38,
    archivistBias01: 0.68,
    negotiationBias01: 0.54,
    silenceBias01: 0.3,
    revealBias01: 0.88,
    legendBias01: 0.24,
    notes: [
      'Prediction is reveal-heavy but should stay cold and measured.',
      'High familiarity and confidence turn this into anticipatory control.',
    ],
  };
}

export function createLegendIntentProfile(): ChatAffinityIntentProfile {
  return {
    profileId: 'legend/default/v1',
    laneId: 'LEGEND',
    zone: 'FASCINATION_ZONE',
    counterpartClass: 'ARCHIVIST',
    signalFlavor: 'CEREMONIAL_WITNESS',
    preferredStances: ['RESPECTFUL', 'CURIOUS', 'OBSESSED'],
    primaryWeights: {
      respect: 0.72,
      fear: 0.05,
      contempt: -0.06,
      fascination: 0.94,
      patience: 0.2,
      familiarity: 0.4,
      prediction: 0.18,
      trauma: 0.18,
      unfinished: 0.74,
      obsession: 0.32,
    },
    pressureWeights: {
      low: 0.9,
      medium: 1,
      high: 1.06,
      critical: 1.12,
    },
    witnessWeights: {
      privateWitness: 0.9,
      partialWitness: 1,
      publicWitness: 1.18,
      swarmWitness: 1.28,
    },
    sceneRoleWeights: {
      open: 0.94,
      pressure: 0.9,
      mock: 0.52,
      defend: 0.68,
      witness: 1.24,
      callback: 1.3,
      reveal: 1.02,
      silence: 0.8,
      echo: 1.18,
      close: 1.14,
    },
    helperBias01: 0.18,
    rivalBias01: 0.2,
    archivistBias01: 0.96,
    negotiationBias01: 0.16,
    silenceBias01: 0.26,
    revealBias01: 0.66,
    legendBias01: 1,
    notes: [
      'Legend should be witness-driven and callback-rich.',
      'Unfinished business converts singular events into saga continuity.',
    ],
  };
}

export const CHAT_AFFINITY_INTENT_PROFILES: Readonly<
  Record<ChatAffinityLaneId, ChatAffinityIntentProfile>
> = Object.freeze({
  DOMINANCE: createDominanceIntentProfile(),
  DEVOTION: createDevotionIntentProfile(),
  RIVALRY: createRivalryIntentProfile(),
  TRUST: createTrustIntentProfile(),
  HUMILIATION: createHumiliationIntentProfile(),
  RESCUE: createRescueIntentProfile(),
  CURIOSITY: createCuriosityIntentProfile(),
  TRAUMA: createTraumaIntentProfile(),
  PREDICTION: createPredictionIntentProfile(),
  LEGEND: createLegendIntentProfile(),
});

// ============================================================================
// MARK: Helpers
// ============================================================================

export function clamp01(value: number): number {
  return clampRelationship01(value);
}

export function clampSignedUnit(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value <= -1) return -1;
  if (value >= 1) return 1;
  return Number(value.toFixed(6));
}

export function pickAffinityIntensityBand(value01: number): ChatAffinityIntensityBand {
  const value = clamp01(value01);
  if (value < 0.08) return 'TRACE';
  if (value < 0.22) return 'LOW';
  if (value < 0.42) return 'RISING';
  if (value < 0.66) return 'ACTIVE';
  if (value < 0.86) return 'SURGING';
  return 'LOCKED';
}

export function normalizePressureBand(
  value?: ChatRelationshipPressureBand,
): ChatRelationshipPressureBand {
  return value ?? 'MEDIUM';
}

export function pressureBandWeight(
  set: ChatAffinityPressureWeightSet,
  pressureBand?: ChatRelationshipPressureBand,
): number {
  switch (normalizePressureBand(pressureBand)) {
    case 'LOW':
      return set.low;
    case 'MEDIUM':
      return set.medium;
    case 'HIGH':
      return set.high;
    case 'CRITICAL':
      return set.critical;
    default:
      return set.medium;
  }
}

export function witnessWeight(
  set: ChatAffinityWitnessWeightSet,
  witness01 = 0,
): number {
  const v = clamp01(witness01);
  if (v < 0.1) return set.privateWitness;
  if (v < 0.45) return set.partialWitness;
  if (v < 0.8) return set.publicWitness;
  return set.swarmWitness;
}

export function sceneRoleWeight(
  set: ChatAffinitySceneRoleWeightSet,
  sceneRole?: ChatAffinityEvaluationInput['sceneRole'],
): number {
  switch (sceneRole ?? 'PRESSURE') {
    case 'OPEN':
      return set.open;
    case 'PRESSURE':
      return set.pressure;
    case 'MOCK':
      return set.mock;
    case 'DEFEND':
      return set.defend;
    case 'WITNESS':
      return set.witness;
    case 'CALLBACK':
      return set.callback;
    case 'REVEAL':
      return set.reveal;
    case 'SILENCE':
      return set.silence;
    case 'ECHO':
      return set.echo;
    case 'CLOSE':
      return set.close;
    default:
      return 1;
  }
}

export function vectorToWeightInputs(vector: ChatRelationshipVector): ChatAffinityWeightSet {
  return {
    respect: vector.respect01,
    fear: vector.fear01,
    contempt: vector.contempt01,
    fascination: vector.fascination01,
    patience: vector.patience01,
    familiarity: vector.familiarity01,
    prediction: vector.predictiveConfidence01,
    trauma: vector.traumaDebt01,
    unfinished: vector.unfinishedBusiness01,
    obsession: vector.obsession01,
  };
}

export function createEmptyAffinitySignal(
  laneId: ChatAffinityLaneId,
): ChatAffinitySignal {
  const lane = CHAT_AFFINITY_LANE_DESCRIPTORS[laneId];
  return {
    laneId,
    zone: lane.primaryAxes.length
      ? CHAT_AFFINITY_AXIS_DESCRIPTORS[lane.primaryAxes[0]].zone
      : 'TRUST_ZONE',
    direction: lane.defaultDirection,
    intensity01: 0,
    intensityBand: 'TRACE',
    polarity: lane.defaultPolarity,
    flavor: lane.signalFlavor,
    surfaceMode: CHAT_AFFINITY_DEFAULT_SURFACE_MODE,
    sceneBiases: lane.sceneBias,
    notes: [],
  };
}

export function createNeutralAffinityEvaluation(): ChatAffinityEvaluation {
  const neutral = CHAT_AFFINITY_LANE_IDS.map((laneId) => ({
    laneId,
    rawScore01: 0,
    adjustedScore01: 0,
    intensityBand: 'TRACE' as const,
    direction: CHAT_AFFINITY_LANE_DESCRIPTORS[laneId].defaultDirection,
    polarity: CHAT_AFFINITY_LANE_DESCRIPTORS[laneId].defaultPolarity,
    triggeredAxes: [] as readonly ChatRelationshipAxisId[],
    notes: [] as readonly string[],
  }));

  return {
    dominantLaneId: 'TRUST',
    dominantZone: 'TRUST_ZONE',
    dominantDirection: 'TOWARD_BOND',
    dominantPolarity: 'ANCHOR',
    aggregateIntensity01: 0,
    aggregateIntensityBand: 'TRACE',
    scores: neutral,
    surfacedSignals: [],
    notes: ['No affinity signal exceeded threshold.'],
  };
}

export function dominantAxesFromVector(
  vector: ChatRelationshipVector,
  limit = 3,
): readonly ChatRelationshipAxisId[] {
  const tuples: Array<readonly [ChatRelationshipAxisId, number]> = [
    ['CONTEMPT', vector.contempt01],
    ['FASCINATION', vector.fascination01],
    ['RESPECT', vector.respect01],
    ['FEAR', vector.fear01],
    ['OBSESSION', vector.obsession01],
    ['PATIENCE', vector.patience01],
    ['FAMILIARITY', vector.familiarity01],
    ['PREDICTIVE_CONFIDENCE', vector.predictiveConfidence01],
    ['TRAUMA_DEBT', vector.traumaDebt01],
    ['UNFINISHED_BUSINESS', vector.unfinishedBusiness01],
  ];

  return tuples
    .slice()
    .sort((a, b) => b[1] - a[1])
    .slice(0, Math.max(1, Math.floor(limit)))
    .map((entry) => entry[0]);
}

export function preferredAffinityLaneForCounterpartKind(
  kind?: ChatRelationshipCounterpartKind,
): ChatAffinityLaneId {
  switch (kind) {
    case 'HELPER':
      return 'RESCUE';
    case 'RIVAL':
      return 'RIVALRY';
    case 'ARCHIVIST':
      return 'LEGEND';
    case 'AMBIENT':
      return 'HUMILIATION';
    case 'SYSTEM':
      return 'PREDICTION';
    case 'BOT':
      return 'DOMINANCE';
    case 'NPC':
      return 'CURIOSITY';
    default:
      return 'TRUST';
  }
}

export function affinityDirectionForLane(
  laneId: ChatAffinityLaneId,
): ChatAffinityDirection {
  return CHAT_AFFINITY_LANE_DESCRIPTORS[laneId].defaultDirection;
}

export function affinityPolarityForLane(
  laneId: ChatAffinityLaneId,
): ChatAffinityPolarity {
  return CHAT_AFFINITY_LANE_DESCRIPTORS[laneId].defaultPolarity;
}

export function axisZone(axisId: ChatRelationshipAxisId): ChatAffinityZone {
  return CHAT_AFFINITY_AXIS_DESCRIPTORS[axisId].zone;
}

export function mergeAffinityWeightSets(
  base: ChatAffinityWeightSet,
  patch: Partial<ChatAffinityWeightSet>,
): ChatAffinityWeightSet {
  return {
    respect: patch.respect ?? base.respect,
    fear: patch.fear ?? base.fear,
    contempt: patch.contempt ?? base.contempt,
    fascination: patch.fascination ?? base.fascination,
    patience: patch.patience ?? base.patience,
    familiarity: patch.familiarity ?? base.familiarity,
    prediction: patch.prediction ?? base.prediction,
    trauma: patch.trauma ?? base.trauma,
    unfinished: patch.unfinished ?? base.unfinished,
    obsession: patch.obsession ?? base.obsession,
  };
}

export function mergeAffinityPressureWeightSets(
  base: ChatAffinityPressureWeightSet,
  patch: Partial<ChatAffinityPressureWeightSet>,
): ChatAffinityPressureWeightSet {
  return {
    low: patch.low ?? base.low,
    medium: patch.medium ?? base.medium,
    high: patch.high ?? base.high,
    critical: patch.critical ?? base.critical,
  };
}

export function mergeAffinityWitnessWeightSets(
  base: ChatAffinityWitnessWeightSet,
  patch: Partial<ChatAffinityWitnessWeightSet>,
): ChatAffinityWitnessWeightSet {
  return {
    privateWitness: patch.privateWitness ?? base.privateWitness,
    partialWitness: patch.partialWitness ?? base.partialWitness,
    publicWitness: patch.publicWitness ?? base.publicWitness,
    swarmWitness: patch.swarmWitness ?? base.swarmWitness,
  };
}

export function mergeAffinitySceneRoleWeightSets(
  base: ChatAffinitySceneRoleWeightSet,
  patch: Partial<ChatAffinitySceneRoleWeightSet>,
): ChatAffinitySceneRoleWeightSet {
  return {
    open: patch.open ?? base.open,
    pressure: patch.pressure ?? base.pressure,
    mock: patch.mock ?? base.mock,
    defend: patch.defend ?? base.defend,
    witness: patch.witness ?? base.witness,
    callback: patch.callback ?? base.callback,
    reveal: patch.reveal ?? base.reveal,
    silence: patch.silence ?? base.silence,
    echo: patch.echo ?? base.echo,
    close: patch.close ?? base.close,
  };
}

export function normalizeAffinityProfile(
  profile: ChatAffinityIntentProfile,
): ChatAffinityIntentProfile {
  return {
    ...profile,
    helperBias01: clamp01(profile.helperBias01),
    rivalBias01: clamp01(profile.rivalBias01),
    archivistBias01: clamp01(profile.archivistBias01),
    negotiationBias01: clamp01(profile.negotiationBias01),
    silenceBias01: clamp01(profile.silenceBias01),
    revealBias01: clamp01(profile.revealBias01),
    legendBias01: clamp01(profile.legendBias01),
    primaryWeights: mergeAffinityWeightSets(createNeutralAffinityWeightSet(), profile.primaryWeights),
    pressureWeights: mergeAffinityPressureWeightSets(createUnitPressureWeightSet(), profile.pressureWeights),
    witnessWeights: mergeAffinityWitnessWeightSets(createUnitWitnessWeightSet(), profile.witnessWeights),
    sceneRoleWeights: mergeAffinitySceneRoleWeightSets(createSceneRoleWeightSet(), profile.sceneRoleWeights),
  };
}

export function evaluateAffinityLane(
  laneId: ChatAffinityLaneId,
  input: ChatAffinityEvaluationInput,
): ChatAffinityLaneScore {
  const profile = CHAT_AFFINITY_INTENT_PROFILES[laneId];
  const weights = profile.primaryWeights;
  const values = vectorToWeightInputs(input.vector);

  let raw = 0;
  raw += values.respect * Math.max(0, weights.respect);
  raw += values.fear * Math.max(0, weights.fear);
  raw += values.contempt * Math.max(0, weights.contempt);
  raw += values.fascination * Math.max(0, weights.fascination);
  raw += values.patience * Math.max(0, weights.patience);
  raw += values.familiarity * Math.max(0, weights.familiarity);
  raw += values.prediction * Math.max(0, weights.prediction);
  raw += values.trauma * Math.max(0, weights.trauma);
  raw += values.unfinished * Math.max(0, weights.unfinished);
  raw += values.obsession * Math.max(0, weights.obsession);

  raw += (1 - values.respect) * Math.max(0, -weights.respect);
  raw += (1 - values.fear) * Math.max(0, -weights.fear);
  raw += (1 - values.contempt) * Math.max(0, -weights.contempt);
  raw += (1 - values.fascination) * Math.max(0, -weights.fascination);
  raw += (1 - values.patience) * Math.max(0, -weights.patience);
  raw += (1 - values.familiarity) * Math.max(0, -weights.familiarity);
  raw += (1 - values.prediction) * Math.max(0, -weights.prediction);
  raw += (1 - values.trauma) * Math.max(0, -weights.trauma);
  raw += (1 - values.unfinished) * Math.max(0, -weights.unfinished);
  raw += (1 - values.obsession) * Math.max(0, -weights.obsession);

  const pressureWeightValue = pressureBandWeight(profile.pressureWeights, input.pressureBand);
  const witnessWeightValue = witnessWeight(profile.witnessWeights, input.witness01 ?? 0);
  const sceneWeightValue = sceneRoleWeight(profile.sceneRoleWeights, input.sceneRole);

  let adjusted = raw / 5;
  adjusted *= pressureWeightValue;
  adjusted *= witnessWeightValue;
  adjusted *= sceneWeightValue;

  adjusted *= 1 + clamp01(input.callbackDensity01 ?? 0) * 0.12;
  adjusted *= 1 + clamp01(input.negotiationHeat01 ?? 0) * profile.negotiationBias01 * 0.15;
  adjusted *= 1 + clamp01(input.legendPotential01 ?? 0) * profile.legendBias01 * 0.14;

  if (laneId === 'RESCUE') {
    adjusted *= 1 + clamp01(input.rescueDebt01 ?? 0) * 0.2;
  }
  if (laneId === 'HUMILIATION') {
    adjusted *= 1 + clamp01(input.publicPressureBias01 ?? 0) * 0.16;
  }
  if (laneId === 'TRUST' || laneId === 'DEVOTION') {
    adjusted *= 1 + clamp01(input.privatePressureBias01 ?? 0) * 0.08;
  }

  const score01 = clamp01(adjusted);
  const triggeredAxes = dominantAxesFromVector(input.vector, 4).filter((axis) =>
    profile.primaryWeights[
      axis === 'RESPECT'
        ? 'respect'
        : axis === 'FEAR'
          ? 'fear'
          : axis === 'CONTEMPT'
            ? 'contempt'
            : axis === 'FASCINATION'
              ? 'fascination'
              : axis === 'PATIENCE'
                ? 'patience'
                : axis === 'FAMILIARITY'
                  ? 'familiarity'
                  : axis === 'PREDICTIVE_CONFIDENCE'
                    ? 'prediction'
                    : axis === 'TRAUMA_DEBT'
                      ? 'trauma'
                      : axis === 'UNFINISHED_BUSINESS'
                        ? 'unfinished'
                        : 'obsession'
    ] !== 0,
  );

  const notes: string[] = [];
  if ((input.callbackDensity01 ?? 0) > 0.5) notes.push('Callback density amplified lane weight.');
  if ((input.negotiationHeat01 ?? 0) > 0.5) notes.push('Negotiation heat influenced lane expression.');
  if ((input.legendPotential01 ?? 0) > 0.5) notes.push('Legend potential elevated witness-facing value.');
  if ((input.unresolvedMemoryCount ?? 0) > 0) notes.push('Unresolved memory count present.');
  if (triggeredAxes.length) notes.push(`Triggered axes: ${triggeredAxes.join(', ')}.`);

  return {
    laneId,
    rawScore01: clamp01(raw / 5),
    adjustedScore01: score01,
    intensityBand: pickAffinityIntensityBand(score01),
    direction: CHAT_AFFINITY_LANE_DESCRIPTORS[laneId].defaultDirection,
    polarity: CHAT_AFFINITY_LANE_DESCRIPTORS[laneId].defaultPolarity,
    triggeredAxes,
    notes,
  };
}

export function evaluateAffinity(
  input: ChatAffinityEvaluationInput,
): ChatAffinityEvaluation {
  const scores = CHAT_AFFINITY_LANE_IDS.map((laneId) => evaluateAffinityLane(laneId, input)).sort(
    (a, b) => b.adjustedScore01 - a.adjustedScore01,
  );

  const dominant = scores[0];
  if (!dominant || dominant.adjustedScore01 <= 0.01) {
    return createNeutralAffinityEvaluation();
  }

  const topLane = CHAT_AFFINITY_LANE_DESCRIPTORS[dominant.laneId];
  const dominantAxis = topLane.primaryAxes[0] ?? 'RESPECT';
  const zone = axisZone(dominantAxis);
  const aggregateIntensity01 = clamp01(
    scores.slice(0, 3).reduce((sum, score) => sum + score.adjustedScore01, 0) / 2.2,
  );
  const surfacedSignals = scores
    .filter((score) => score.adjustedScore01 >= 0.22)
    .slice(0, 4)
    .map((score) => ({
      laneId: score.laneId,
      zone: axisZone(CHAT_AFFINITY_LANE_DESCRIPTORS[score.laneId].primaryAxes[0] ?? 'RESPECT'),
      direction: score.direction,
      intensity01: score.adjustedScore01,
      intensityBand: score.intensityBand,
      polarity: score.polarity,
      flavor: CHAT_AFFINITY_LANE_DESCRIPTORS[score.laneId].signalFlavor,
      counterpartKind: input.counterpartKind,
      pressureBand: input.pressureBand,
      surfaceMode:
        score.laneId === 'TRAUMA' || score.laneId === 'PREDICTION'
          ? 'REVEAL_LATER'
          : score.laneId === 'RESCUE' || score.laneId === 'TRUST'
            ? 'MIXED'
            : 'VISIBLE',
      sceneBiases: CHAT_AFFINITY_LANE_DESCRIPTORS[score.laneId].sceneBias,
      notes: score.notes,
    } satisfies ChatAffinitySignal));

  return {
    dominantLaneId: dominant.laneId,
    dominantZone: zone,
    dominantDirection: dominant.direction,
    dominantPolarity: dominant.polarity,
    aggregateIntensity01,
    aggregateIntensityBand: pickAffinityIntensityBand(aggregateIntensity01),
    scores,
    surfacedSignals,
    notes: [
      `Dominant lane: ${dominant.laneId}.`,
      `Surface count: ${surfacedSignals.length}.`,
      ...(input.notes ?? []),
    ],
  };
}

export function relationshipVectorFromSeed(
  patch?: Partial<ChatRelationshipVector>,
): ChatRelationshipVector {
  return {
    ...emptyRelationshipVector(),
    ...(patch ?? {}),
    contempt01: clamp01(patch?.contempt01 ?? emptyRelationshipVector().contempt01),
    fascination01: clamp01(patch?.fascination01 ?? emptyRelationshipVector().fascination01),
    respect01: clamp01(patch?.respect01 ?? emptyRelationshipVector().respect01),
    fear01: clamp01(patch?.fear01 ?? emptyRelationshipVector().fear01),
    obsession01: clamp01(patch?.obsession01 ?? emptyRelationshipVector().obsession01),
    patience01: clamp01(patch?.patience01 ?? emptyRelationshipVector().patience01),
    familiarity01: clamp01(patch?.familiarity01 ?? emptyRelationshipVector().familiarity01),
    predictiveConfidence01: clamp01(
      patch?.predictiveConfidence01 ?? emptyRelationshipVector().predictiveConfidence01,
    ),
    traumaDebt01: clamp01(patch?.traumaDebt01 ?? emptyRelationshipVector().traumaDebt01),
    unfinishedBusiness01: clamp01(
      patch?.unfinishedBusiness01 ?? emptyRelationshipVector().unfinishedBusiness01,
    ),
  };
}

export function vectorAffinitySignature(vector: ChatRelationshipVector): string {
  const dominant = dominantAxesFromVector(vector, 3);
  return dominant.join('>');
}

export function eventTypePreferredAffinityLane(
  eventType: ChatRelationshipEventType,
): ChatAffinityLaneId {
  switch (eventType) {
    case 'PLAYER_COMEBACK':
      return 'LEGEND';
    case 'PLAYER_COLLAPSE':
      return 'TRAUMA';
    case 'PLAYER_BREACH':
      return 'DOMINANCE';
    case 'PLAYER_PERFECT_DEFENSE':
      return 'TRUST';
    case 'PLAYER_FAILED_GAMBLE':
      return 'HUMILIATION';
    case 'PLAYER_OVERCONFIDENCE':
      return 'RIVALRY';
    case 'HELPER_RESCUE_EMITTED':
      return 'RESCUE';
    case 'RIVAL_WITNESS_EMITTED':
      return 'RIVALRY';
    case 'ARCHIVIST_WITNESS_EMITTED':
      return 'LEGEND';
    case 'NEGOTIATION_WINDOW':
      return 'PREDICTION';
    case 'RUN_END':
      return 'LEGEND';
    case 'RUN_START':
      return 'CURIOSITY';
    default:
      return 'TRUST';
  }
}

export function safePreferredLaneForEventType(
  eventType: ChatRelationshipEventType,
): ChatAffinityLaneId {
  const preferred = eventTypePreferredAffinityLane(eventType);
  return preferred === ('RESPECT' as ChatAffinityLaneId) ? 'TRUST' : preferred;
}

export function laneSupportsCounterpartKind(
  laneId: ChatAffinityLaneId,
  kind?: ChatRelationshipCounterpartKind,
): boolean {
  if (!kind) return true;
  return CHAT_AFFINITY_LANE_DESCRIPTORS[laneId].preferredCounterpartKinds.includes(kind);
}

export function buildAffinitySignalForLane(
  laneId: ChatAffinityLaneId,
  input: ChatAffinityEvaluationInput,
): ChatAffinitySignal {
  const score = evaluateAffinityLane(laneId, input);
  const lane = CHAT_AFFINITY_LANE_DESCRIPTORS[laneId];
  return {
    laneId,
    zone: axisZone(lane.primaryAxes[0] ?? 'RESPECT'),
    direction: score.direction,
    intensity01: score.adjustedScore01,
    intensityBand: score.intensityBand,
    polarity: score.polarity,
    flavor: lane.signalFlavor,
    counterpartKind: input.counterpartKind,
    pressureBand: input.pressureBand,
    surfaceMode:
      laneId === 'TRAUMA' || laneId === 'PREDICTION'
        ? 'REVEAL_LATER'
        : laneId === 'RESCUE' || laneId === 'TRUST'
          ? 'MIXED'
          : 'VISIBLE',
    sceneBiases: lane.sceneBias,
    notes: score.notes,
  };
}

export function sortAffinitySignals(
  signals: readonly ChatAffinitySignal[],
): readonly ChatAffinitySignal[] {
  return signals
    .slice()
    .sort((a, b) => b.intensity01 - a.intensity01 || a.laneId.localeCompare(b.laneId));
}

export function strongestVisibleAffinitySignal(
  evaluation: ChatAffinityEvaluation,
): ChatAffinitySignal | undefined {
  return evaluation.surfacedSignals.find((signal) => signal.surfaceMode !== 'REVEAL_LATER');
}

export function strongestShadowAffinitySignal(
  evaluation: ChatAffinityEvaluation,
): ChatAffinitySignal | undefined {
  return evaluation.surfacedSignals.find((signal) => signal.surfaceMode === 'REVEAL_LATER');
}

export function createAffinityEvaluationInputFromVector(
  vector: ChatRelationshipVector,
  patch?: Omit<Partial<ChatAffinityEvaluationInput>, 'vector'>,
): ChatAffinityEvaluationInput {
  return {
    vector,
    counterpartKind: patch?.counterpartKind,
    pressureBand: patch?.pressureBand,
    sceneRole: patch?.sceneRole,
    witness01: patch?.witness01,
    unresolvedMemoryCount: patch?.unresolvedMemoryCount,
    callbackDensity01: patch?.callbackDensity01,
    rescueDebt01: patch?.rescueDebt01,
    negotiationHeat01: patch?.negotiationHeat01,
    publicPressureBias01: patch?.publicPressureBias01,
    privatePressureBias01: patch?.privatePressureBias01,
    legendPotential01: patch?.legendPotential01,
    notes: patch?.notes,
  };
}

export const CHAT_AFFINITY_FILE_PATH = 'shared/contracts/chat/ChatAffinity.ts' as const;
export const CHAT_AFFINITY_VERSION = '1.0.0' as const;
export const CHAT_AFFINITY_REGISTRY = Object.freeze({
  filePath: CHAT_AFFINITY_FILE_PATH,
  version: CHAT_AFFINITY_VERSION,
  laneIds: CHAT_AFFINITY_LANE_IDS,
  zones: CHAT_AFFINITY_ZONES,
  intensityBands: CHAT_AFFINITY_INTENSITY_BANDS,
  directions: CHAT_AFFINITY_DIRECTIONS,
  signalFlavors: CHAT_AFFINITY_SIGNAL_FLAVORS,
  descriptors: CHAT_AFFINITY_LANE_DESCRIPTORS,
  profiles: CHAT_AFFINITY_INTENT_PROFILES,
  axisDescriptors: CHAT_AFFINITY_AXIS_DESCRIPTORS,
});
