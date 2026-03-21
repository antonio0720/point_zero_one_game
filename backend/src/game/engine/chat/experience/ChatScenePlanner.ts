/**
 * @file backend/src/game/engine/chat/experience/ChatScenePlanner.ts
 * @description
 * Backend scene planner for the Point Zero One chat runtime.
 *
 * This planner is intentionally pure. It does not mutate backend state, does not
 * mint messages, and does not talk to transport. Its only job is to translate a
 * moment + relationship + memory + world context into a durable scene plan that
 * can be archived, materialized, replayed, and mirrored into frontend runtime
 * experience lanes.
 *
 * Design goals:
 * - Stay anchored to shared/contracts/chat/scene as canonical cross-stack contract.
 * - Preserve repo authority separation: planner here, materialization elsewhere.
 * - Prefer deterministic planning with bounded heuristics instead of opaque randomness.
 * - Expose telemetry so later learning lanes can score planning quality.
 * - Preserve mode identity by treating channel + moment + relationship pressure as one scene problem.
 */

import type {
  SharedChatMomentType,
  SharedChatSceneArchetype,
  SharedChatSceneBeat,
  SharedChatSceneBeatType,
  SharedChatScenePlan,
  SharedChatScenePlannerDecision,
  SharedChatScenePlannerInput,
} from '../../../../../../shared/contracts/chat/scene';

import type { ChatStageMood as SharedChatSceneStageMood } from '../../../../../../shared/contracts/chat/ChatChannels';

/* ========================================================================== *
 * MARK: Planner telemetry + config
 * ========================================================================== */

export type ChatScenePlannerReason =
  | 'MOMENT_ARCHETYPE_MATCH'
  | 'PRESSURE_ESCALATION'
  | 'RELATIONSHIP_PRESSURE'
  | 'HELPER_RESCUE_NEED'
  | 'CALLBACK_AVAILABLE'
  | 'CROWD_AMPLIFICATION'
  | 'FALSE_CALM_WINDOW'
  | 'SILENCE_IS_STRONGER'
  | 'PUBLIC_WITNESS_REQUIRED'
  | 'DEALROOM_PREDATORY_TONE'
  | 'POST_RUN_RECKONING'
  | 'WORLD_EVENT_INTRUSION'
  | 'LEGEND_ESCALATION'
  | 'UNRESOLVED_BUSINESS'
  | 'CARRYOVER_CONTINUITY'
  | 'RESPECT_COLLAPSE'
  | 'TRUST_RECOVERY'
  | 'RIVALRY_ACTIVE'
  | 'RESCUE_DEBT_ACTIVE'
  | 'CHANNEL_STAGE_LOCK'
  | 'ARCHIVE_FRIENDLY_BRANCHES';

export interface ChatScenePlannerTelemetry {
  readonly pressure01: number;
  readonly relationshipPressure01: number;
  readonly rescueNeed01: number;
  readonly callbackOpportunity01: number;
  readonly crowdHeat01: number;
  readonly silencePreference01: number;
  readonly witnessNeed01: number;
  readonly revealNeed01: number;
  readonly predation01: number;
  readonly legendHeat01: number;
  readonly continuityWeight01: number;
  readonly confidence01: number;
  readonly expectedDurationMs: number;
  readonly expectedVisibleBeats: number;
  readonly expectedShadowBeats: number;
  readonly stageMood: SharedChatSceneStageMood;
  readonly archetype: SharedChatSceneArchetype;
  readonly reasons: readonly ChatScenePlannerReason[];
  readonly scoreBreakdown: Readonly<Record<SharedChatSceneArchetype, number>>;
  readonly branchPressureTags: readonly string[];
}

export interface ChatScenePlannerDecisionWithTelemetry extends SharedChatScenePlannerDecision {
  readonly telemetry: ChatScenePlannerTelemetry;
}


export interface ChatScenePlanValidationIssue {
  readonly code:
    | 'EMPTY_BEATS'
    | 'CHANNEL_MISMATCH'
    | 'DUPLICATE_BEAT_ID'
    | 'MISSING_SPEAKER_ORDER'
    | 'MISSING_CALLBACK_TAGS'
    | 'NON_ASCENDING_ESCALATION'
    | 'INVALID_DURATION';
  readonly message: string;
  readonly beatId?: string;
}

export interface ChatScenePlanValidationReport {
  readonly ok: boolean;
  readonly issues: readonly ChatScenePlanValidationIssue[];
  readonly beatTypes: readonly SharedChatSceneBeatType[];
  readonly stageMood: SharedChatSceneStageMood;
  readonly archetype: SharedChatSceneArchetype;
  readonly primaryChannel: SharedChatScenePlan['primaryChannel'];
}

export interface ChatSceneDecisionExplanation {
  readonly momentType: SharedChatMomentType;
  readonly archetype: SharedChatSceneArchetype;
  readonly stageMood: SharedChatSceneStageMood;
  readonly beatTypes: readonly SharedChatSceneBeatType[];
  readonly speakerOrder: readonly string[];
  readonly callbackAnchorIds: readonly string[];
  readonly planningTags: readonly string[];
  readonly branchPoints: readonly string[];
  readonly confidence01: number;
  readonly reasons: readonly ChatScenePlannerReason[];
}

export interface ChatScenePlannerConfig {
  readonly maxChosenSpeakerIds: number;
  readonly maxChosenCallbackAnchorIds: number;
  readonly maxChosenTags: number;
  readonly maxBeats: number;
  readonly minBeats: number;
  readonly allowFalseCalmScenes: boolean;
  readonly allowPlayerReplyWindow: boolean;
  readonly allowPostBeatEcho: boolean;
  readonly enableSilenceWindows: boolean;
  readonly enableSecondaryReveal: boolean;
  readonly allowCrowdSwarmOutsideGlobal: boolean;
  readonly silenceBeatFloorMs: number;
  readonly silenceBeatCeilingMs: number;
  readonly baseBeatDelayMs: number;
  readonly revealBeatBonusDelayMs: number;
  readonly playerReplyWindowDelayMs: number;
  readonly crowdBiasInGlobal01: number;
  readonly rescueBiasInCritical01: number;
  readonly callbackBiasWhenAnchorsPresent01: number;
  readonly worldEventIntrusionBias01: number;
  readonly postRunReckoningBias01: number;
  readonly legendEscalationBias01: number;
  readonly witnessBiasForPublicScenes01: number;
  readonly continuityBiasForCarryover01: number;
  readonly planConfidenceFloor01: number;
}

export const DEFAULT_CHAT_SCENE_PLANNER_CONFIG: ChatScenePlannerConfig = {
  maxChosenSpeakerIds: 5,
  maxChosenCallbackAnchorIds: 4,
  maxChosenTags: 14,
  maxBeats: 8,
  minBeats: 3,
  allowFalseCalmScenes: true,
  allowPlayerReplyWindow: true,
  allowPostBeatEcho: true,
  enableSilenceWindows: true,
  enableSecondaryReveal: true,
  allowCrowdSwarmOutsideGlobal: false,
  silenceBeatFloorMs: 900,
  silenceBeatCeilingMs: 3_250,
  baseBeatDelayMs: 650,
  revealBeatBonusDelayMs: 380,
  playerReplyWindowDelayMs: 540,
  crowdBiasInGlobal01: 0.85,
  rescueBiasInCritical01: 0.92,
  callbackBiasWhenAnchorsPresent01: 0.72,
  worldEventIntrusionBias01: 0.82,
  postRunReckoningBias01: 0.8,
  legendEscalationBias01: 0.88,
  witnessBiasForPublicScenes01: 0.78,
  continuityBiasForCarryover01: 0.74,
  planConfidenceFloor01: 0.56,
};

/* ========================================================================== *
 * MARK: Local planner contracts
 * ========================================================================== */

type SharedPressureTier = NonNullable<SharedChatScenePlannerInput['pressureTier']>;
type SharedSceneRole = SharedChatSceneBeat['sceneRole'];
type SharedChannelId = SharedChatScenePlannerInput['primaryChannel'];

type SpeakerRole = 'SYSTEM' | 'HATER' | 'HELPER' | 'CROWD' | 'CALLBACK' | 'CARRYOVER';

interface RelationshipDigest {
  readonly relationshipIds: readonly string[];
  readonly counterpartIds: readonly string[];
  readonly trust01: number;
  readonly fear01: number;
  readonly contempt01: number;
  readonly rivalry01: number;
  readonly respect01: number;
  readonly rescueDebt01: number;
  readonly familiarity01: number;
  readonly relationshipPressure01: number;
  readonly callbacksAvailable: readonly string[];
  readonly activeEscalationCount: number;
}

interface AnchorCandidate {
  readonly anchorId: string;
  readonly anchorType: string;
  readonly roomId: string;
  readonly channelId: SharedChannelId;
  readonly salience01: number;
  readonly callbackWeight01: number;
  readonly ageMs: number;
  readonly unresolved: boolean;
  readonly embeddingKey?: string;
  readonly tags: readonly string[];
}

interface SpeakerCandidate {
  readonly speakerId: string;
  readonly actorKind?: string;
  readonly role: SpeakerRole;
  readonly score01: number;
  readonly callbackAnchorIds?: readonly string[];
  readonly semanticClusterIds?: readonly string[];
}

interface ScenePressureVector {
  readonly pressure01: number;
  readonly relationshipPressure01: number;
  readonly rescueNeed01: number;
  readonly callbackOpportunity01: number;
  readonly crowdHeat01: number;
  readonly silencePreference01: number;
  readonly witnessNeed01: number;
  readonly revealNeed01: number;
  readonly predation01: number;
  readonly legendHeat01: number;
  readonly continuityWeight01: number;
}

interface ArchetypeScoreCard {
  readonly scores: Readonly<Record<SharedChatSceneArchetype, number>>;
  readonly winner: SharedChatSceneArchetype;
  readonly confidence01: number;
}

interface BeatBlueprint {
  readonly beatType: SharedChatSceneBeatType;
  readonly sceneRole: SharedSceneRole;
  readonly requiredRole?: SpeakerRole;
  readonly skippable: boolean;
  readonly canInterrupt: boolean;
  readonly payloadHint?: string;
  readonly pressureBias: number;
  readonly revealBias: number;
  readonly callbackBias: number;
  readonly silenceBias: number;
  readonly targetPressure: SharedPressureTier;
  readonly rhetoricalTemplateIds: readonly string[];
}

interface PlannerContext {
  readonly input: SharedChatScenePlannerInput;
  readonly relationship: RelationshipDigest;
  readonly anchors: readonly AnchorCandidate[];
  readonly chosenAnchors: readonly AnchorCandidate[];
  readonly chosenCallbackAnchorIds: readonly string[];
  readonly vector: ScenePressureVector;
  readonly stageMood: SharedChatSceneStageMood;
  readonly archetypeScores: ArchetypeScoreCard;
  readonly archetype: SharedChatSceneArchetype;
  readonly chosenSpeakerIds: readonly string[];
  readonly chosenSpeakers: readonly SpeakerCandidate[];
  readonly reasons: readonly ChatScenePlannerReason[];
}

/* ========================================================================== *
 * MARK: Constants and archetype law
 * ========================================================================== */

const ALL_MOMENT_TYPES: readonly SharedChatMomentType[] = [
  'RUN_START',
  'RUN_END',
  'PRESSURE_SURGE',
  'SHIELD_BREACH',
  'CASCADE_TRIGGER',
  'CASCADE_BREAK',
  'BOT_ATTACK',
  'BOT_RETREAT',
  'HELPER_RESCUE',
  'DEAL_ROOM_STANDOFF',
  'SOVEREIGN_APPROACH',
  'SOVEREIGN_ACHIEVED',
  'LEGEND_MOMENT',
  'WORLD_EVENT',
] as const;

const ALL_ARCHETYPES: readonly SharedChatSceneArchetype[] = [
  'BREACH_SCENE',
  'TRAP_SCENE',
  'RESCUE_SCENE',
  'PUBLIC_HUMILIATION_SCENE',
  'COMEBACK_WITNESS_SCENE',
  'DEAL_ROOM_PRESSURE_SCENE',
  'FALSE_CALM_SCENE',
  'END_OF_RUN_RECKONING_SCENE',
  'LONG_ARC_CALLBACK_SCENE',
  'SEASON_EVENT_INTRUSION_SCENE',
] as const;

const MOMENT_BASE_PRESSURE: Readonly<Record<SharedChatMomentType, number>> = {
  RUN_START: 0.22,
  RUN_END: 0.6,
  PRESSURE_SURGE: 0.78,
  SHIELD_BREACH: 0.9,
  CASCADE_TRIGGER: 0.82,
  CASCADE_BREAK: 0.58,
  BOT_ATTACK: 0.8,
  BOT_RETREAT: 0.4,
  HELPER_RESCUE: 0.74,
  DEAL_ROOM_STANDOFF: 0.7,
  SOVEREIGN_APPROACH: 0.68,
  SOVEREIGN_ACHIEVED: 0.94,
  LEGEND_MOMENT: 0.92,
  WORLD_EVENT: 0.76,
};

const MOMENT_DEFAULT_STAGE_MOOD: Readonly<Record<SharedChatMomentType, SharedChatSceneStageMood>> = {
  RUN_START: 'WATCHFUL',
  RUN_END: 'CEREMONIAL',
  PRESSURE_SURGE: 'TENSE',
  SHIELD_BREACH: 'HOSTILE',
  CASCADE_TRIGGER: 'HOSTILE',
  CASCADE_BREAK: 'WATCHFUL',
  BOT_ATTACK: 'HOSTILE',
  BOT_RETREAT: 'WATCHFUL',
  HELPER_RESCUE: 'CONSPIRATORIAL',
  DEAL_ROOM_STANDOFF: 'PREDATORY',
  SOVEREIGN_APPROACH: 'WATCHFUL',
  SOVEREIGN_ACHIEVED: 'CEREMONIAL',
  LEGEND_MOMENT: 'CEREMONIAL',
  WORLD_EVENT: 'TENSE',
};

const MOMENT_PRIMARY_ARCHETYPE: Readonly<Record<SharedChatMomentType, SharedChatSceneArchetype>> = {
  RUN_START: 'FALSE_CALM_SCENE',
  RUN_END: 'END_OF_RUN_RECKONING_SCENE',
  PRESSURE_SURGE: 'TRAP_SCENE',
  SHIELD_BREACH: 'PUBLIC_HUMILIATION_SCENE',
  CASCADE_TRIGGER: 'TRAP_SCENE',
  CASCADE_BREAK: 'COMEBACK_WITNESS_SCENE',
  BOT_ATTACK: 'BREACH_SCENE',
  BOT_RETREAT: 'COMEBACK_WITNESS_SCENE',
  HELPER_RESCUE: 'RESCUE_SCENE',
  DEAL_ROOM_STANDOFF: 'DEAL_ROOM_PRESSURE_SCENE',
  SOVEREIGN_APPROACH: 'COMEBACK_WITNESS_SCENE',
  SOVEREIGN_ACHIEVED: 'COMEBACK_WITNESS_SCENE',
  LEGEND_MOMENT: 'LONG_ARC_CALLBACK_SCENE',
  WORLD_EVENT: 'SEASON_EVENT_INTRUSION_SCENE',
};

const MOMENT_BRANCH_POINTS: Readonly<Record<SharedChatMomentType, readonly string[]>> = {
  RUN_START: ['CONTINUE', 'DRAW_HEAT', 'STAY_QUIET'],
  RUN_END: ['DEBRIEF', 'MOCKERY', 'FORESHADOW', 'RESOLUTION'],
  PRESSURE_SURGE: ['PLAYER_COUNTERS', 'PLAYER_TURTLES', 'PLAYER_BLUFFS'],
  SHIELD_BREACH: ['HELPER_INTERVENES', 'CROWD_SWARMS', 'PLAYER_COLLAPSES'],
  CASCADE_TRIGGER: ['PLAYER_STABILIZES', 'ENEMY_STACKS', 'SYSTEM_LOCKS'],
  CASCADE_BREAK: ['PLAYER_RETAKES', 'CALLBACK_LANDS', 'ROOM_FLIPS'],
  BOT_ATTACK: ['PLAYER_COUNTERS', 'PLAYER_IGNORES', 'PLAYER_RETREATS'],
  BOT_RETREAT: ['PLAYER_PURSUES', 'PLAYER_COLLECTS', 'ROOM_REMEMBERS'],
  HELPER_RESCUE: ['PLAYER_ACCEPTS', 'PLAYER_REJECTS', 'HELPER_OVERRIDES'],
  DEAL_ROOM_STANDOFF: ['PLAYER_ACCEPTS', 'PLAYER_STALLS', 'PLAYER_BLUFFS', 'PLAYER_WALKS'],
  SOVEREIGN_APPROACH: ['PLAYER_SECURES', 'PLAYER_CHOKES', 'HATER_INTERRUPTS'],
  SOVEREIGN_ACHIEVED: ['ROOM_WITNESSES', 'RIVAL_REFRAMES', 'LEGEND_LOCKS'],
  LEGEND_MOMENT: ['CALLBACK_CHAIN', 'MYTH_REWRITE', 'STATUS_LOCK'],
  WORLD_EVENT: ['SYSTEM_INTERRUPTS', 'ROOM_PANICS', 'SYNDICATE_COORDINATES'],
};

const ARCHETYPE_BLUEPRINTS: Readonly<Record<SharedChatSceneArchetype, readonly BeatBlueprint[]>> = {
  BREACH_SCENE: [
    createBlueprint('SYSTEM_NOTICE', 'OPEN', 'SYSTEM', false, true, 'breach.notice', 0.9, 0.1, 0.1, 0.05, 'CRITICAL', ['BREACH_NOTICE']),
    createBlueprint('HATER_ENTRY', 'PRESSURE', 'HATER', false, true, 'breach.hater', 0.92, 0.14, 0.16, 0.02, 'CRITICAL', ['PRESSURE_ESCALATE', 'BREACH_TAUNT']),
    createBlueprint('HELPER_INTERVENTION', 'DEFEND', 'HELPER', true, true, 'breach.helper', 0.44, 0.15, 0.08, 0.08, 'PRESSURED', ['RESCUE_INTERCEPT']),
    createBlueprint('PLAYER_REPLY_WINDOW', 'CLOSE', undefined, false, true, 'breach.reply', 0.36, 0.08, 0.05, 0.04, 'PRESSURED', ['PLAYER_WINDOW']),
  ],
  TRAP_SCENE: [
    createBlueprint('SILENCE', 'SILENCE', undefined, true, false, 'trap.silence', 0.15, 0.06, 0.05, 1, 'WATCHFUL', ['SILENCE_PREP']),
    createBlueprint('SYSTEM_NOTICE', 'OPEN', 'SYSTEM', false, true, 'trap.notice', 0.62, 0.05, 0.08, 0.15, 'PRESSURED', ['TRAP_NOTICE']),
    createBlueprint('HATER_ENTRY', 'PRESSURE', 'HATER', false, true, 'trap.hater', 0.82, 0.08, 0.1, 0.04, 'CRITICAL', ['AMBUSH_TAUNT', 'PREDATOR_LEAN']),
    createBlueprint('PLAYER_REPLY_WINDOW', 'CLOSE', undefined, false, true, 'trap.reply', 0.38, 0.06, 0.04, 0.03, 'PRESSURED', ['PLAYER_WINDOW']),
  ],
  RESCUE_SCENE: [
    createBlueprint('SYSTEM_NOTICE', 'OPEN', 'SYSTEM', false, true, 'rescue.notice', 0.52, 0.08, 0.04, 0.04, 'PRESSURED', ['RESCUE_NOTICE']),
    createBlueprint('HELPER_INTERVENTION', 'DEFEND', 'HELPER', false, true, 'rescue.helper', 0.26, 0.06, 0.05, 0.08, 'WATCHFUL', ['HELPER_ENTRY', 'RECOVERY_GUIDANCE']),
    createBlueprint('REVEAL', 'REVEAL', 'CALLBACK', true, true, 'rescue.reveal', 0.18, 0.8, 0.88, 0.06, 'WATCHFUL', ['CALLBACK_RESCUE', 'DEBT_RECALL']),
    createBlueprint('PLAYER_REPLY_WINDOW', 'CLOSE', undefined, false, true, 'rescue.reply', 0.18, 0.05, 0.04, 0.04, 'WATCHFUL', ['PLAYER_WINDOW']),
  ],
  PUBLIC_HUMILIATION_SCENE: [
    createBlueprint('SYSTEM_NOTICE', 'OPEN', 'SYSTEM', false, true, 'humiliation.notice', 0.74, 0.1, 0.02, 0.04, 'CRITICAL', ['PUBLIC_FLAG']),
    createBlueprint('HATER_ENTRY', 'MOCK', 'HATER', false, true, 'humiliation.hater', 0.9, 0.1, 0.04, 0.02, 'BREAKPOINT', ['MOCKERY', 'STATUS_STRIKE']),
    createBlueprint('CROWD_SWARM', 'WITNESS', 'CROWD', true, true, 'humiliation.crowd', 0.72, 0.08, 0.02, 0.02, 'BREAKPOINT', ['CROWD_HEAT', 'PUBLIC_ECHO']),
    createBlueprint('HELPER_INTERVENTION', 'DEFEND', 'HELPER', true, true, 'humiliation.helper', 0.32, 0.12, 0.04, 0.04, 'PRESSURED', ['HELPER_TRIAGE']),
    createBlueprint('PLAYER_REPLY_WINDOW', 'CLOSE', undefined, false, true, 'humiliation.reply', 0.26, 0.04, 0.02, 0.02, 'PRESSURED', ['PLAYER_WINDOW']),
  ],
  COMEBACK_WITNESS_SCENE: [
    createBlueprint('SYSTEM_NOTICE', 'OPEN', 'SYSTEM', false, true, 'comeback.notice', 0.4, 0.18, 0.1, 0.08, 'WATCHFUL', ['COMEBACK_NOTICE']),
    createBlueprint('REVEAL', 'CALLBACK', 'CALLBACK', true, true, 'comeback.reveal', 0.22, 0.78, 0.9, 0.08, 'WATCHFUL', ['CALLBACK_PAYOFF', 'MYTH_LOCK']),
    createBlueprint('CROWD_SWARM', 'WITNESS', 'CROWD', true, true, 'comeback.crowd', 0.56, 0.16, 0.08, 0.03, 'PRESSURED', ['WITNESS_ECHO', 'ROOM_FLIP']),
    createBlueprint('POST_BEAT_ECHO', 'ECHO', undefined, true, false, 'comeback.echo', 0.18, 0.12, 0.16, 0.12, 'WATCHFUL', ['ECHO_LOCK']),
    createBlueprint('PLAYER_REPLY_WINDOW', 'CLOSE', undefined, false, true, 'comeback.reply', 0.18, 0.05, 0.04, 0.04, 'WATCHFUL', ['PLAYER_WINDOW']),
  ],
  DEAL_ROOM_PRESSURE_SCENE: [
    createBlueprint('SILENCE', 'SILENCE', undefined, true, false, 'dealroom.silence', 0.08, 0.06, 0.04, 0.96, 'WATCHFUL', ['NEGOTIATION_SILENCE']),
    createBlueprint('SYSTEM_NOTICE', 'OPEN', 'SYSTEM', false, true, 'dealroom.notice', 0.62, 0.06, 0.06, 0.16, 'PRESSURED', ['DEAL_ROOM_NOTICE']),
    createBlueprint('HATER_ENTRY', 'PRESSURE', 'HATER', false, true, 'dealroom.hater', 0.86, 0.04, 0.06, 0.08, 'CRITICAL', ['PREDATORY_READ', 'LEVERAGE_SQUEEZE']),
    createBlueprint('REVEAL', 'REVEAL', 'CALLBACK', true, true, 'dealroom.reveal', 0.14, 0.72, 0.58, 0.16, 'PRESSURED', ['PRICE_MEMORY', 'BLUFF_RECEIPT']),
    createBlueprint('PLAYER_REPLY_WINDOW', 'CLOSE', undefined, false, true, 'dealroom.reply', 0.28, 0.03, 0.03, 0.18, 'PRESSURED', ['PLAYER_WINDOW', 'COUNTER_OFFER_WINDOW']),
  ],
  FALSE_CALM_SCENE: [
    createBlueprint('SILENCE', 'SILENCE', undefined, true, false, 'calm.silence', 0.04, 0.08, 0.05, 0.92, 'CALM', ['FALSE_CALM_SILENCE']),
    createBlueprint('SYSTEM_NOTICE', 'OPEN', 'SYSTEM', false, true, 'calm.notice', 0.22, 0.06, 0.04, 0.24, 'WATCHFUL', ['LOW_BURN_NOTICE']),
    createBlueprint('POST_BEAT_ECHO', 'ECHO', undefined, true, false, 'calm.echo', 0.08, 0.06, 0.06, 0.32, 'WATCHFUL', ['FALSE_CALM_ECHO']),
    createBlueprint('PLAYER_REPLY_WINDOW', 'CLOSE', undefined, false, true, 'calm.reply', 0.18, 0.02, 0.02, 0.18, 'WATCHFUL', ['PLAYER_WINDOW']),
  ],
  END_OF_RUN_RECKONING_SCENE: [
    createBlueprint('SILENCE', 'SILENCE', undefined, true, false, 'reckoning.silence', 0.12, 0.06, 0.12, 0.82, 'WATCHFUL', ['RECKONING_SILENCE']),
    createBlueprint('SYSTEM_NOTICE', 'OPEN', 'SYSTEM', false, true, 'reckoning.notice', 0.56, 0.1, 0.12, 0.18, 'PRESSURED', ['RUN_END_NOTICE']),
    createBlueprint('REVEAL', 'REVEAL', 'CALLBACK', true, true, 'reckoning.reveal', 0.18, 0.82, 0.94, 0.12, 'PRESSURED', ['RUN_END_CALLBACK', 'RECEIPT']),
    createBlueprint('POST_BEAT_ECHO', 'ECHO', undefined, true, false, 'reckoning.echo', 0.16, 0.12, 0.16, 0.28, 'WATCHFUL', ['ROOM_SUMMARY']),
    createBlueprint('PLAYER_REPLY_WINDOW', 'CLOSE', undefined, false, true, 'reckoning.reply', 0.18, 0.04, 0.04, 0.12, 'WATCHFUL', ['PLAYER_WINDOW', 'DEBRIEF_WINDOW']),
  ],
  LONG_ARC_CALLBACK_SCENE: [
    createBlueprint('SYSTEM_NOTICE', 'OPEN', 'SYSTEM', false, true, 'arc.notice', 0.3, 0.16, 0.22, 0.06, 'WATCHFUL', ['ARC_NOTICE']),
    createBlueprint('REVEAL', 'CALLBACK', 'CALLBACK', false, true, 'arc.reveal', 0.18, 0.94, 1, 0.08, 'WATCHFUL', ['LONG_ARC_CALLBACK', 'RECEIPT']),
    createBlueprint('POST_BEAT_ECHO', 'ECHO', undefined, true, false, 'arc.echo', 0.12, 0.12, 0.2, 0.12, 'WATCHFUL', ['LEGEND_ECHO']),
    createBlueprint('CROWD_SWARM', 'WITNESS', 'CROWD', true, true, 'arc.crowd', 0.42, 0.16, 0.08, 0.06, 'PRESSURED', ['PUBLIC_WITNESS']),
    createBlueprint('PLAYER_REPLY_WINDOW', 'CLOSE', undefined, false, true, 'arc.reply', 0.18, 0.03, 0.03, 0.06, 'WATCHFUL', ['PLAYER_WINDOW']),
  ],
  SEASON_EVENT_INTRUSION_SCENE: [
    createBlueprint('SYSTEM_NOTICE', 'OPEN', 'SYSTEM', false, true, 'world.notice', 0.64, 0.12, 0.06, 0.06, 'PRESSURED', ['WORLD_INTRUSION']),
    createBlueprint('CROWD_SWARM', 'WITNESS', 'CROWD', true, true, 'world.crowd', 0.7, 0.08, 0.04, 0.04, 'PRESSURED', ['PANIC_WAVE', 'EVENT_CHATTER']),
    createBlueprint('HELPER_INTERVENTION', 'DEFEND', 'HELPER', true, true, 'world.helper', 0.22, 0.06, 0.04, 0.04, 'WATCHFUL', ['COORDINATE_RESCUE']),
    createBlueprint('PLAYER_REPLY_WINDOW', 'CLOSE', undefined, false, true, 'world.reply', 0.22, 0.03, 0.02, 0.04, 'WATCHFUL', ['PLAYER_WINDOW']),
  ],
};

function createBlueprint(
  beatType: SharedChatSceneBeatType,
  sceneRole: SharedSceneRole,
  requiredRole: SpeakerRole | undefined,
  skippable: boolean,
  canInterrupt: boolean,
  payloadHint: string,
  pressureBias: number,
  revealBias: number,
  callbackBias: number,
  silenceBias: number,
  targetPressure: SharedPressureTier,
  rhetoricalTemplateIds: readonly string[],
): BeatBlueprint {
  return {
    beatType,
    sceneRole,
    requiredRole,
    skippable,
    canInterrupt,
    payloadHint,
    pressureBias,
    revealBias,
    callbackBias,
    silenceBias,
    targetPressure,
    rhetoricalTemplateIds,
  };
}

/* ========================================================================== *
 * MARK: Low-level utilities
 * ========================================================================== */

function clamp01(value: number): number {
  if (Number.isNaN(value) || !Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function coerceNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function average(values: readonly number[]): number {
  if (!values.length) return 0;
  return clamp01(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function weightedAverage(weighted: readonly { readonly value: number; readonly weight: number }[]): number {
  let weightedSum = 0;
  let totalWeight = 0;
  for (const entry of weighted) {
    const weight = clamp01(entry.weight);
    weightedSum += clamp01(entry.value) * weight;
    totalWeight += weight;
  }
  return totalWeight > 0 ? clamp01(weightedSum / totalWeight) : 0;
}

function uniq(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function safeArray<T>(value: readonly T[] | undefined | null): readonly T[] {
  return Array.isArray(value) ? value : [];
}

function normalizeTag(value: string): string {
  return value.trim().replace(/\s+/g, '_').replace(/[^A-Z0-9_:.-]/gi, '_').toUpperCase();
}

function normalizeSemanticId(value: string): string {
  return normalizeTag(value).replace(/^_+|_+$/g, '');
}

function byScoreDesc<T extends { readonly score01: number }>(left: T, right: T): number {
  return right.score01 - left.score01;
}

function asMomentType(value: SharedChatScenePlannerInput['momentType']): SharedChatMomentType {
  return value;
}

function nowAgeMs(now: number, createdAt: number): number {
  const delta = Math.max(0, Math.floor(now - createdAt));
  return Number.isFinite(delta) ? delta : 0;
}

function boolToScore(value: boolean, score = 1): number {
  return value ? score : 0;
}

/* ========================================================================== *
 * MARK: Relationship, anchor, and pressure digestion
 * ========================================================================== */

function digestRelationshipState(input: SharedChatScenePlannerInput): RelationshipDigest {
  const relationshipState = safeArray(input.relationshipState);
  if (!relationshipState.length) {
    return {
      relationshipIds: [],
      counterpartIds: [],
      trust01: 0,
      fear01: 0,
      contempt01: 0,
      rivalry01: 0,
      respect01: 0,
      rescueDebt01: 0,
      familiarity01: 0,
      relationshipPressure01: 0,
      callbacksAvailable: [],
      activeEscalationCount: 0,
    };
  }

  const trust01 = average(relationshipState.map((state) => clamp01(state.vector.trust)));
  const fear01 = average(relationshipState.map((state) => clamp01(state.vector.fear)));
  const contempt01 = average(relationshipState.map((state) => clamp01(state.vector.contempt)));
  const rivalry01 = average(relationshipState.map((state) => clamp01(state.vector.rivalryIntensity)));
  const respect01 = average(relationshipState.map((state) => clamp01(state.vector.respect)));
  const rescueDebt01 = average(relationshipState.map((state) => clamp01(state.vector.rescueDebt)));
  const familiarity01 = average(relationshipState.map((state) => clamp01(state.vector.familiarity)));
  const pressureFromEscalation = average(
    relationshipState.map((state) => {
      switch (state.escalationTier) {
        case 'OBSESSIVE':
          return 1;
        case 'ACTIVE':
          return 0.72;
        case 'MILD':
          return 0.34;
        default:
          return 0.08;
      }
    }),
  );

  const relationshipPressure01 = clamp01(
    weightedAverage([
      { value: fear01, weight: 0.22 },
      { value: contempt01, weight: 0.24 },
      { value: rivalry01, weight: 0.26 },
      { value: pressureFromEscalation, weight: 0.18 },
      { value: rescueDebt01, weight: 0.1 },
    ]),
  );

  return {
    relationshipIds: uniq(relationshipState.map((state) => state.relationshipId)),
    counterpartIds: uniq(relationshipState.map((state) => state.counterpartId)),
    trust01,
    fear01,
    contempt01,
    rivalry01,
    respect01,
    rescueDebt01,
    familiarity01,
    relationshipPressure01,
    callbacksAvailable: uniq(relationshipState.flatMap((state) => safeArray(state.callbacksAvailable))),
    activeEscalationCount: relationshipState.filter((state) => state.escalationTier === 'ACTIVE' || state.escalationTier === 'OBSESSIVE').length,
  };
}

function buildAnchorCandidates(input: SharedChatScenePlannerInput, relationship: RelationshipDigest): readonly AnchorCandidate[] {
  const unresolvedMomentIds = new Set(safeArray(input.unresolvedMomentIds));
  const callbackSet = new Set(relationship.callbacksAvailable);

  return safeArray(input.memoryAnchors)
    .map((anchor): AnchorCandidate => {
      const ageMs = nowAgeMs(input.now, anchor.createdAt);
      const freshness01 = clamp01(1 - ageMs / (1000 * 60 * 60 * 24 * 10));
      const anchorTypeBias =
        anchor.anchorType === 'COMEBACK' || anchor.anchorType === 'SOVEREIGNTY'
          ? 0.94
          : anchor.anchorType === 'DEAL_ROOM' || anchor.anchorType === 'RESCUE'
            ? 0.84
            : anchor.anchorType === 'BREACH' || anchor.anchorType === 'HUMILIATION'
              ? 0.8
              : 0.64;
      const unresolved = unresolvedMomentIds.has(anchor.anchorId) || unresolvedMomentIds.has(`MOMENT:${anchor.anchorId}`);
      const callbackWeight01 = clamp01(
        anchor.salience * 0.58 +
          freshness01 * 0.14 +
          anchorTypeBias * 0.18 +
          boolToScore(unresolved, 0.18) +
          boolToScore(callbackSet.has(anchor.anchorId), 0.12),
      );
      return {
        anchorId: anchor.anchorId,
        anchorType: anchor.anchorType,
        roomId: anchor.roomId,
        channelId: anchor.channelId,
        salience01: clamp01(anchor.salience),
        callbackWeight01,
        ageMs,
        unresolved,
        embeddingKey: anchor.embeddingKey,
        tags: uniq([
          `ANCHOR_TYPE:${normalizeTag(anchor.anchorType)}`,
          `ANCHOR_CHANNEL:${normalizeTag(anchor.channelId)}`,
          ...(anchor.embeddingKey ? [`EMBED:${normalizeTag(anchor.embeddingKey)}`] : []),
        ]),
      };
    })
    .sort((left, right) => {
      if (left.unresolved !== right.unresolved) return Number(right.unresolved) - Number(left.unresolved);
      return right.callbackWeight01 - left.callbackWeight01;
    });
}

function pressureScore(input: SharedChatScenePlannerInput, relationship: RelationshipDigest): number {
  const explicitTier = input.pressureTier;
  if (explicitTier) {
    switch (explicitTier) {
      case 'CALM':
        return clamp01(MOMENT_BASE_PRESSURE[asMomentType(input.momentType)] * 0.4 + relationship.relationshipPressure01 * 0.12);
      case 'WATCHFUL':
        return clamp01(MOMENT_BASE_PRESSURE[asMomentType(input.momentType)] * 0.52 + relationship.relationshipPressure01 * 0.18 + 0.04);
      case 'PRESSURED':
        return clamp01(MOMENT_BASE_PRESSURE[asMomentType(input.momentType)] * 0.7 + relationship.relationshipPressure01 * 0.22 + 0.08);
      case 'CRITICAL':
        return clamp01(MOMENT_BASE_PRESSURE[asMomentType(input.momentType)] * 0.88 + relationship.relationshipPressure01 * 0.28 + 0.1);
      case 'BREAKPOINT':
        return clamp01(MOMENT_BASE_PRESSURE[asMomentType(input.momentType)] * 0.96 + relationship.relationshipPressure01 * 0.3 + 0.16);
    }
  }

  return clamp01(
    MOMENT_BASE_PRESSURE[asMomentType(input.momentType)] * 0.82 +
      relationship.relationshipPressure01 * 0.18 +
      boolToScore(safeArray(input.unresolvedMomentIds).length > 0, 0.04),
  );
}

function inferCallbackOpportunity(
  input: SharedChatScenePlannerInput,
  anchors: readonly AnchorCandidate[],
  relationship: RelationshipDigest,
  config: ChatScenePlannerConfig,
): number {
  const topAnchors = anchors.slice(0, config.maxChosenCallbackAnchorIds);
  const anchorValue = average(topAnchors.map((anchor) => anchor.callbackWeight01));
  const unresolvedBonus = topAnchors.some((anchor) => anchor.unresolved) ? 0.12 : 0;
  const relationshipBonus = clamp01(relationship.familiarity01 * 0.08 + relationship.rivalry01 * 0.08 + relationship.rescueDebt01 * 0.08);
  const momentBias =
    input.momentType === 'RUN_END' || input.momentType === 'LEGEND_MOMENT'
      ? 0.18
      : input.momentType === 'SOVEREIGN_APPROACH' || input.momentType === 'CASCADE_BREAK'
        ? 0.14
        : input.momentType === 'DEAL_ROOM_STANDOFF'
          ? 0.1
          : 0.04;
  return clamp01(anchorValue + unresolvedBonus + relationshipBonus + momentBias + config.callbackBiasWhenAnchorsPresent01 * boolToScore(topAnchors.length > 0, 0.12));
}

function inferRescueNeed(
  input: SharedChatScenePlannerInput,
  vectorPressure01: number,
  relationship: RelationshipDigest,
  anchors: readonly AnchorCandidate[],
  config: ChatScenePlannerConfig,
): number {
  const helperCount = safeArray(input.helperIds).length;
  const supportiveTrust = relationship.trust01 + relationship.rescueDebt01 * 0.4;
  const breachBias =
    input.momentType === 'HELPER_RESCUE'
      ? 1
      : input.momentType === 'SHIELD_BREACH'
        ? 0.88
        : input.momentType === 'BOT_ATTACK'
          ? 0.72
          : input.momentType === 'RUN_END'
            ? 0.58
            : input.momentType === 'WORLD_EVENT'
              ? 0.54
              : 0.28;
  const unresolvedRescueBias = average(
    anchors.map((anchor) =>
      anchor.anchorType === 'RESCUE' || anchor.anchorType === 'HUMILIATION'
        ? clamp01(anchor.callbackWeight01 * 0.55)
        : 0,
    ),
  );
  return clamp01(
    breachBias * 0.42 +
      vectorPressure01 * 0.26 +
      relationship.fear01 * 0.12 +
      relationship.rescueDebt01 * 0.16 +
      supportiveTrust * 0.08 +
      unresolvedRescueBias * 0.14 +
      boolToScore(helperCount === 0, 0.08) +
      config.rescueBiasInCritical01 * boolToScore(vectorPressure01 >= 0.8, 0.06),
  );
}

function inferCrowdHeat(input: SharedChatScenePlannerInput, pressure01: number, relationship: RelationshipDigest, config: ChatScenePlannerConfig): number {
  const primaryChannel = String(input.primaryChannel).toUpperCase();
  const publicBias = primaryChannel === 'GLOBAL' ? config.crowdBiasInGlobal01 * 0.22 : primaryChannel === 'LOBBY' ? 0.08 : 0.02;
  const worldBias = safeArray(input.worldTags).some((tag) => /WORLD|SEASON|EVENT|PANIC|WAR|RAID|LEGEND/i.test(String(tag))) ? 0.12 : 0;
  const momentBias =
    input.momentType === 'SOVEREIGN_ACHIEVED' || input.momentType === 'LEGEND_MOMENT'
      ? 1
      : input.momentType === 'SHIELD_BREACH'
        ? 0.88
        : input.momentType === 'PRESSURE_SURGE'
          ? 0.72
          : input.momentType === 'RUN_START'
            ? 0.46
            : 0.34;
  return clamp01(momentBias * 0.42 + pressure01 * 0.24 + relationship.relationshipPressure01 * 0.1 + publicBias + worldBias);
}

function inferSilencePreference(
  input: SharedChatScenePlannerInput,
  pressure01: number,
  callbackOpportunity01: number,
  rescueNeed01: number,
): number {
  const channelBias =
    input.primaryChannel === 'DEAL_ROOM'
      ? 0.24
      : input.primaryChannel === 'SYNDICATE'
        ? 0.1
        : input.primaryChannel === 'GLOBAL'
          ? -0.06
          : 0.04;
  const momentBias =
    input.momentType === 'DEAL_ROOM_STANDOFF'
      ? 0.86
      : input.momentType === 'RUN_END'
        ? 0.74
        : input.momentType === 'SHIELD_BREACH'
          ? 0.66
          : input.momentType === 'RUN_START'
            ? 0.58
            : 0.36;
  return clamp01(momentBias * 0.46 + pressure01 * 0.12 + callbackOpportunity01 * 0.18 - rescueNeed01 * 0.08 + channelBias);
}

function inferWitnessNeed(
  input: SharedChatScenePlannerInput,
  crowdHeat01: number,
  relationship: RelationshipDigest,
  config: ChatScenePlannerConfig,
): number {
  const publicChannel = input.primaryChannel === 'GLOBAL' || input.primaryChannel === 'LOBBY';
  const publicBias = publicChannel ? config.witnessBiasForPublicScenes01 * 0.28 : 0.08;
  const momentBias =
    input.momentType === 'SOVEREIGN_ACHIEVED' || input.momentType === 'LEGEND_MOMENT'
      ? 1
      : input.momentType === 'CASCADE_BREAK' || input.momentType === 'BOT_RETREAT'
        ? 0.72
        : input.momentType === 'SHIELD_BREACH'
          ? 0.82
          : 0.28;
  return clamp01(momentBias * 0.42 + crowdHeat01 * 0.26 + relationship.rivalry01 * 0.08 + publicBias);
}

function inferRevealNeed(
  input: SharedChatScenePlannerInput,
  anchors: readonly AnchorCandidate[],
  callbackOpportunity01: number,
  relationship: RelationshipDigest,
): number {
  const revealAnchorBias = average(
    anchors.map((anchor) => {
      if (anchor.anchorType === 'QUOTE' || anchor.anchorType === 'DEAL_ROOM' || anchor.anchorType === 'SOVEREIGNTY') {
        return clamp01(anchor.callbackWeight01 * 0.9);
      }
      return clamp01(anchor.callbackWeight01 * 0.5);
    }),
  );
  const momentBias =
    input.momentType === 'RUN_END' || input.momentType === 'LEGEND_MOMENT'
      ? 0.24
      : input.momentType === 'DEAL_ROOM_STANDOFF'
        ? 0.18
        : input.momentType === 'CASCADE_BREAK'
          ? 0.16
          : 0.08;
  return clamp01(callbackOpportunity01 * 0.54 + revealAnchorBias * 0.28 + relationship.rivalry01 * 0.08 + momentBias);
}

function inferPredation(input: SharedChatScenePlannerInput, pressure01: number, relationship: RelationshipDigest): number {
  const dealRoomBias = input.primaryChannel === 'DEAL_ROOM' || input.momentType === 'DEAL_ROOM_STANDOFF' ? 0.42 : 0;
  const hostilityBias = relationship.contempt01 * 0.24 + relationship.fear01 * 0.12;
  const momentBias =
    input.momentType === 'DEAL_ROOM_STANDOFF'
      ? 1
      : input.momentType === 'PRESSURE_SURGE'
        ? 0.64
        : input.momentType === 'BOT_ATTACK'
          ? 0.58
          : 0.18;
  return clamp01(momentBias * 0.42 + pressure01 * 0.24 + hostilityBias + dealRoomBias);
}

function inferLegendHeat(input: SharedChatScenePlannerInput, callbackOpportunity01: number, witnessNeed01: number): number {
  const worldTagBonus = safeArray(input.worldTags).some((tag) => /LEGEND|SOVEREIGN|ASCENT|CROWN|MYTH/i.test(String(tag))) ? 0.16 : 0;
  const momentBias =
    input.momentType === 'SOVEREIGN_ACHIEVED' || input.momentType === 'LEGEND_MOMENT'
      ? 1
      : input.momentType === 'SOVEREIGN_APPROACH'
        ? 0.82
        : 0.22;
  return clamp01(momentBias * 0.5 + callbackOpportunity01 * 0.18 + witnessNeed01 * 0.16 + worldTagBonus);
}

function inferContinuityWeight(input: SharedChatScenePlannerInput, relationship: RelationshipDigest, anchors: readonly AnchorCandidate[], config: ChatScenePlannerConfig): number {
  const carryoverBias = safeArray(input.carriedPersonaIds).length > 0 ? config.continuityBiasForCarryover01 * 0.24 : 0;
  const unresolvedBias = Math.min(0.24, safeArray(input.unresolvedMomentIds).length * 0.05);
  const anchorBias = average(anchors.map((anchor) => clamp01(anchor.callbackWeight01 * 0.42)));
  return clamp01(carryoverBias + unresolvedBias + relationship.familiarity01 * 0.18 + relationship.rivalry01 * 0.12 + anchorBias);
}

function buildPressureVector(
  input: SharedChatScenePlannerInput,
  relationship: RelationshipDigest,
  anchors: readonly AnchorCandidate[],
  config: ChatScenePlannerConfig,
): ScenePressureVector {
  const pressure01 = pressureScore(input, relationship);
  const callbackOpportunity01 = inferCallbackOpportunity(input, anchors, relationship, config);
  const rescueNeed01 = inferRescueNeed(input, pressure01, relationship, anchors, config);
  const crowdHeat01 = inferCrowdHeat(input, pressure01, relationship, config);
  const silencePreference01 = inferSilencePreference(input, pressure01, callbackOpportunity01, rescueNeed01);
  const witnessNeed01 = inferWitnessNeed(input, crowdHeat01, relationship, config);
  const revealNeed01 = inferRevealNeed(input, anchors, callbackOpportunity01, relationship);
  const predation01 = inferPredation(input, pressure01, relationship);
  const legendHeat01 = inferLegendHeat(input, callbackOpportunity01, witnessNeed01);
  const continuityWeight01 = inferContinuityWeight(input, relationship, anchors, config);

  return {
    pressure01,
    relationshipPressure01: relationship.relationshipPressure01,
    rescueNeed01,
    callbackOpportunity01,
    crowdHeat01,
    silencePreference01,
    witnessNeed01,
    revealNeed01,
    predation01,
    legendHeat01,
    continuityWeight01,
  };
}

/* ========================================================================== *
 * MARK: Scene scoring and mood selection
 * ========================================================================== */

function stageMoodForMoment(input: SharedChatScenePlannerInput, vector: ScenePressureVector, relationship: RelationshipDigest): SharedChatSceneStageMood {
  const defaultMood = MOMENT_DEFAULT_STAGE_MOOD[asMomentType(input.momentType)];

  if (input.primaryChannel === 'DEAL_ROOM' || vector.predation01 >= 0.72) {
    return 'PREDATORY';
  }
  if (vector.legendHeat01 >= 0.84 || input.momentType === 'SOVEREIGN_ACHIEVED' || input.momentType === 'LEGEND_MOMENT') {
    return 'CEREMONIAL';
  }
  if (input.primaryChannel === 'SYNDICATE' && vector.rescueNeed01 >= 0.42 && relationship.trust01 >= 0.35) {
    return 'CONSPIRATORIAL';
  }
  if (vector.pressure01 >= 0.8 || vector.crowdHeat01 >= 0.82) {
    return 'HOSTILE';
  }
  if (vector.pressure01 >= 0.58 || vector.silencePreference01 >= 0.72) {
    return 'TENSE';
  }
  return defaultMood;
}

function archetypeBaseScore(momentType: SharedChatMomentType, archetype: SharedChatSceneArchetype): number {
  return MOMENT_PRIMARY_ARCHETYPE[momentType] === archetype ? 0.46 : 0.08;
}

function scoreArchetype(archetype: SharedChatSceneArchetype, input: SharedChatScenePlannerInput, vector: ScenePressureVector, relationship: RelationshipDigest, config: ChatScenePlannerConfig): number {
  const momentType = asMomentType(input.momentType);
  const base = archetypeBaseScore(momentType, archetype);

  switch (archetype) {
    case 'BREACH_SCENE':
      return clamp01(base + vector.pressure01 * 0.24 + boolToScore(momentType === 'BOT_ATTACK' || momentType === 'SHIELD_BREACH', 0.24) + relationship.fear01 * 0.1);
    case 'TRAP_SCENE':
      return clamp01(base + vector.pressure01 * 0.18 + vector.predation01 * 0.16 + vector.silencePreference01 * 0.08 + boolToScore(momentType === 'PRESSURE_SURGE' || momentType === 'CASCADE_TRIGGER', 0.22));
    case 'RESCUE_SCENE':
      return clamp01(base + vector.rescueNeed01 * 0.34 + relationship.rescueDebt01 * 0.14 + relationship.trust01 * 0.1 + boolToScore(momentType === 'HELPER_RESCUE', 0.24));
    case 'PUBLIC_HUMILIATION_SCENE':
      return clamp01(base + vector.pressure01 * 0.16 + vector.crowdHeat01 * 0.18 + relationship.contempt01 * 0.14 + boolToScore(momentType === 'SHIELD_BREACH', 0.3));
    case 'COMEBACK_WITNESS_SCENE':
      return clamp01(base + vector.witnessNeed01 * 0.24 + vector.legendHeat01 * 0.12 + vector.callbackOpportunity01 * 0.12 + boolToScore(momentType === 'CASCADE_BREAK' || momentType === 'BOT_RETREAT' || momentType === 'SOVEREIGN_ACHIEVED', 0.22));
    case 'DEAL_ROOM_PRESSURE_SCENE':
      return clamp01(base + vector.predation01 * 0.36 + vector.silencePreference01 * 0.14 + boolToScore(input.primaryChannel === 'DEAL_ROOM' || momentType === 'DEAL_ROOM_STANDOFF', 0.26));
    case 'FALSE_CALM_SCENE':
      return clamp01(base + vector.silencePreference01 * 0.22 + boolToScore(config.allowFalseCalmScenes, 0.08) + boolToScore(momentType === 'RUN_START', 0.2) - vector.pressure01 * 0.08);
    case 'END_OF_RUN_RECKONING_SCENE':
      return clamp01(base + vector.callbackOpportunity01 * 0.18 + vector.continuityWeight01 * 0.2 + boolToScore(momentType === 'RUN_END', config.postRunReckoningBias01 * 0.22));
    case 'LONG_ARC_CALLBACK_SCENE':
      return clamp01(base + vector.callbackOpportunity01 * 0.26 + vector.revealNeed01 * 0.18 + vector.continuityWeight01 * 0.16 + boolToScore(momentType === 'LEGEND_MOMENT', 0.22));
    case 'SEASON_EVENT_INTRUSION_SCENE':
      return clamp01(base + vector.crowdHeat01 * 0.16 + boolToScore(momentType === 'WORLD_EVENT', config.worldEventIntrusionBias01 * 0.22) + average(safeArray(input.worldTags).map((tag) => (/WORLD|SEASON|EVENT|PANIC|WAR/i.test(String(tag)) ? 0.8 : 0.2))) * 0.18);
  }
}

function rankArchetypes(input: SharedChatScenePlannerInput, vector: ScenePressureVector, relationship: RelationshipDigest, config: ChatScenePlannerConfig): ArchetypeScoreCard {
  const scores = Object.create(null) as Record<SharedChatSceneArchetype, number>;
  for (const archetype of ALL_ARCHETYPES) {
    scores[archetype] = scoreArchetype(archetype, input, vector, relationship, config);
  }

  const ranked = [...ALL_ARCHETYPES].sort((left, right) => scores[right] - scores[left]);
  const winner = ranked[0] ?? MOMENT_PRIMARY_ARCHETYPE[asMomentType(input.momentType)];
  const runnerUp = ranked[1] ? scores[ranked[1]] : 0;
  const confidence01 = clamp01(Math.max(config.planConfidenceFloor01, scores[winner] - runnerUp + 0.5 * scores[winner]));

  return { scores, winner, confidence01 };
}

/* ========================================================================== *
 * MARK: Speaker selection
 * ========================================================================== */

function scoreHaterSpeaker(
  input: SharedChatScenePlannerInput,
  relationship: RelationshipDigest,
  vector: ScenePressureVector,
  speakerId: string,
): SpeakerCandidate {
  const hasCarryover = safeArray(input.carriedPersonaIds).includes(speakerId);
  const score01 = clamp01(
    0.32 +
      vector.pressure01 * 0.18 +
      relationship.contempt01 * 0.18 +
      relationship.rivalry01 * 0.16 +
      vector.predation01 * 0.12 +
      boolToScore(hasCarryover, 0.08),
  );
  return {
    speakerId,
    actorKind: 'BOT',
    role: 'HATER',
    score01,
    semanticClusterIds: [`SPEAKER:${normalizeSemanticId(speakerId)}`, 'ROLE:HATER'],
  };
}

function scoreHelperSpeaker(
  input: SharedChatScenePlannerInput,
  relationship: RelationshipDigest,
  vector: ScenePressureVector,
  speakerId: string,
): SpeakerCandidate {
  const channelBias = input.primaryChannel === 'SYNDICATE' ? 0.06 : input.primaryChannel === 'GLOBAL' ? -0.02 : 0.02;
  const score01 = clamp01(
    0.28 +
      vector.rescueNeed01 * 0.26 +
      relationship.trust01 * 0.14 +
      relationship.rescueDebt01 * 0.12 -
      vector.crowdHeat01 * 0.04 +
      channelBias,
  );
  return {
    speakerId,
    actorKind: 'HELPER',
    role: 'HELPER',
    score01,
    semanticClusterIds: [`SPEAKER:${normalizeSemanticId(speakerId)}`, 'ROLE:HELPER'],
  };
}

function scoreCarryoverSpeaker(
  relationship: RelationshipDigest,
  vector: ScenePressureVector,
  speakerId: string,
): SpeakerCandidate {
  const score01 = clamp01(0.22 + vector.continuityWeight01 * 0.22 + relationship.familiarity01 * 0.14 + relationship.rivalry01 * 0.08);
  return {
    speakerId,
    actorKind: 'CARRYOVER',
    role: 'CARRYOVER',
    score01,
    semanticClusterIds: [`SPEAKER:${normalizeSemanticId(speakerId)}`, 'ROLE:CARRYOVER'],
  };
}

function scoreCrowdSpeaker(input: SharedChatScenePlannerInput, vector: ScenePressureVector): SpeakerCandidate | null {
  const publicEnough = input.primaryChannel === 'GLOBAL' || input.primaryChannel === 'LOBBY';
  if (!publicEnough && vector.crowdHeat01 < 0.66) return null;
  return {
    speakerId: 'CROWD',
    actorKind: 'AUDIENCE',
    role: 'CROWD',
    score01: clamp01(0.3 + vector.crowdHeat01 * 0.52),
    semanticClusterIds: ['SPEAKER:CROWD', 'ROLE:CROWD'],
  };
}

function scoreCallbackSpeaker(anchor: AnchorCandidate): SpeakerCandidate {
  return {
    speakerId: `CALLBACK:${anchor.anchorId}`,
    actorKind: anchor.anchorType,
    role: 'CALLBACK',
    score01: clamp01(0.22 + anchor.callbackWeight01 * 0.72),
    callbackAnchorIds: [anchor.anchorId],
    semanticClusterIds: [
      `SPEAKER:CALLBACK:${normalizeSemanticId(anchor.anchorId)}`,
      `ANCHOR:${normalizeSemanticId(anchor.anchorId)}`,
      `ANCHOR_TYPE:${normalizeSemanticId(anchor.anchorType)}`,
    ],
  };
}

function chooseAnchors(anchors: readonly AnchorCandidate[], config: ChatScenePlannerConfig): readonly AnchorCandidate[] {
  return anchors.slice(0, Math.max(0, config.maxChosenCallbackAnchorIds));
}

function chooseSpeakerOrder(
  input: SharedChatScenePlannerInput,
  relationship: RelationshipDigest,
  vector: ScenePressureVector,
  chosenAnchors: readonly AnchorCandidate[],
  config: ChatScenePlannerConfig,
): readonly SpeakerCandidate[] {
  const candidates: SpeakerCandidate[] = [];

  for (const speakerId of safeArray(input.candidateBotIds)) {
    candidates.push(scoreHaterSpeaker(input, relationship, vector, String(speakerId)));
  }
  for (const speakerId of safeArray(input.helperIds)) {
    candidates.push(scoreHelperSpeaker(input, relationship, vector, String(speakerId)));
  }
  for (const speakerId of safeArray(input.carriedPersonaIds)) {
    candidates.push(scoreCarryoverSpeaker(relationship, vector, String(speakerId)));
  }
  for (const anchor of chosenAnchors) {
    candidates.push(scoreCallbackSpeaker(anchor));
  }
  const crowd = scoreCrowdSpeaker(input, vector);
  if (crowd) candidates.push(crowd);

  return candidates
    .sort(byScoreDesc)
    .filter((candidate, index, list) => list.findIndex((value) => value.speakerId === candidate.speakerId) === index)
    .slice(0, config.maxChosenSpeakerIds);
}

/* ========================================================================== *
 * MARK: Reasons, tags, and stage law
 * ========================================================================== */

function collectPlannerReasons(
  input: SharedChatScenePlannerInput,
  relationship: RelationshipDigest,
  vector: ScenePressureVector,
  archetype: SharedChatSceneArchetype,
): readonly ChatScenePlannerReason[] {
  const reasons: ChatScenePlannerReason[] = ['MOMENT_ARCHETYPE_MATCH'];

  if (vector.pressure01 >= 0.6) reasons.push('PRESSURE_ESCALATION');
  if (vector.relationshipPressure01 >= 0.42) reasons.push('RELATIONSHIP_PRESSURE');
  if (vector.rescueNeed01 >= 0.56) reasons.push('HELPER_RESCUE_NEED');
  if (vector.callbackOpportunity01 >= 0.48) reasons.push('CALLBACK_AVAILABLE');
  if (vector.crowdHeat01 >= 0.56) reasons.push('CROWD_AMPLIFICATION');
  if (vector.silencePreference01 >= 0.64) reasons.push('SILENCE_IS_STRONGER');
  if (archetype === 'FALSE_CALM_SCENE') reasons.push('FALSE_CALM_WINDOW');
  if (
    archetype === 'PUBLIC_HUMILIATION_SCENE' ||
    archetype === 'COMEBACK_WITNESS_SCENE' ||
    archetype === 'LONG_ARC_CALLBACK_SCENE'
  ) {
    reasons.push('PUBLIC_WITNESS_REQUIRED');
  }
  if (archetype === 'DEAL_ROOM_PRESSURE_SCENE') reasons.push('DEALROOM_PREDATORY_TONE');
  if (archetype === 'END_OF_RUN_RECKONING_SCENE') reasons.push('POST_RUN_RECKONING');
  if (archetype === 'SEASON_EVENT_INTRUSION_SCENE') reasons.push('WORLD_EVENT_INTRUSION');
  if (input.momentType === 'LEGEND_MOMENT' || input.momentType === 'SOVEREIGN_ACHIEVED') reasons.push('LEGEND_ESCALATION');
  if (safeArray(input.unresolvedMomentIds).length > 0) reasons.push('UNRESOLVED_BUSINESS');
  if (safeArray(input.carriedPersonaIds).length > 0) reasons.push('CARRYOVER_CONTINUITY');
  if (relationship.respect01 <= 0.28 && relationship.contempt01 >= 0.48) reasons.push('RESPECT_COLLAPSE');
  if (relationship.trust01 >= 0.52 && vector.rescueNeed01 >= 0.42) reasons.push('TRUST_RECOVERY');
  if (relationship.rivalry01 >= 0.46) reasons.push('RIVALRY_ACTIVE');
  if (relationship.rescueDebt01 >= 0.36) reasons.push('RESCUE_DEBT_ACTIVE');
  if (input.primaryChannel === 'DEAL_ROOM' || input.primaryChannel === 'SYNDICATE') reasons.push('CHANNEL_STAGE_LOCK');
  reasons.push('ARCHIVE_FRIENDLY_BRANCHES');

  return uniq(reasons) as readonly ChatScenePlannerReason[];
}

function planningTags(
  input: SharedChatScenePlannerInput,
  stageMood: SharedChatSceneStageMood,
  archetype: SharedChatSceneArchetype,
  reasons: readonly ChatScenePlannerReason[],
  relationship: RelationshipDigest,
  chosenAnchors: readonly AnchorCandidate[],
): readonly string[] {
  return uniq([
    `MOMENT:${normalizeTag(input.momentType)}`,
    `CHANNEL:${normalizeTag(input.primaryChannel)}`,
    `ARCHETYPE:${normalizeTag(archetype)}`,
    `STAGE:${normalizeTag(stageMood)}`,
    ...reasons.map((reason) => `REASON:${normalizeTag(reason)}`),
    ...chosenAnchors.map((anchor) => `ANCHOR:${normalizeTag(anchor.anchorId)}`),
    ...chosenAnchors.flatMap((anchor) => anchor.tags),
    ...relationship.relationshipIds.map((relationshipId) => `REL:${normalizeTag(relationshipId)}`),
    ...relationship.counterpartIds.map((counterpartId) => `COUNTERPART:${normalizeTag(counterpartId)}`),
    ...safeArray(input.worldTags).map((tag) => `WORLD:${normalizeTag(String(tag))}`),
  ]);
}

function branchPointsForMoment(input: SharedChatScenePlannerInput, archetype: SharedChatSceneArchetype): readonly string[] {
  const base = MOMENT_BRANCH_POINTS[asMomentType(input.momentType)] ?? ['CONTINUE'];
  const extras: string[] = [];

  if (archetype === 'DEAL_ROOM_PRESSURE_SCENE') {
    extras.push('STALL_WINDOW', 'COUNTER_READ');
  }
  if (archetype === 'LONG_ARC_CALLBACK_SCENE') {
    extras.push('CALLBACK_PAYOFF', 'RECEIPT_LANDS');
  }
  if (archetype === 'END_OF_RUN_RECKONING_SCENE') {
    extras.push('RUN_MEMORY_LOCK');
  }

  return uniq([...base, ...extras]);
}

function semanticClusterIdsForMoment(
  input: SharedChatScenePlannerInput,
  stageMood: SharedChatSceneStageMood,
  archetype: SharedChatSceneArchetype,
  chosenAnchors: readonly AnchorCandidate[],
): readonly string[] {
  return uniq([
    `MOMENT:${normalizeSemanticId(input.momentType)}`,
    `CHANNEL:${normalizeSemanticId(input.primaryChannel)}`,
    `MOOD:${normalizeSemanticId(stageMood)}`,
    `ARCHETYPE:${normalizeSemanticId(archetype)}`,
    ...safeArray(input.worldTags).map((tag) => `WORLD:${normalizeSemanticId(String(tag))}`),
    ...chosenAnchors.flatMap((anchor) => [
      `ANCHOR:${normalizeSemanticId(anchor.anchorId)}`,
      `ANCHOR_TYPE:${normalizeSemanticId(anchor.anchorType)}`,
      ...(anchor.embeddingKey ? [`EMBED:${normalizeSemanticId(anchor.embeddingKey)}`] : []),
    ]),
  ]);
}

/* ========================================================================== *
 * MARK: Beat assembly
 * ========================================================================== */

function shouldIncludeBlueprint(blueprint: BeatBlueprint, context: PlannerContext, config: ChatScenePlannerConfig): boolean {
  if (blueprint.beatType === 'PLAYER_REPLY_WINDOW') {
    return config.allowPlayerReplyWindow;
  }
  if (blueprint.beatType === 'POST_BEAT_ECHO') {
    return config.allowPostBeatEcho && (context.vector.witnessNeed01 >= 0.36 || context.vector.relationshipPressure01 >= 0.46 || context.vector.continuityWeight01 >= 0.46);
  }
  if (blueprint.beatType === 'SILENCE') {
    return config.enableSilenceWindows && context.vector.silencePreference01 >= 0.44 && context.vector.rescueNeed01 < 0.92;
  }
  if (blueprint.beatType === 'CROWD_SWARM') {
    return (
      context.vector.crowdHeat01 >= 0.44 &&
      (context.input.primaryChannel === 'GLOBAL' || context.input.primaryChannel === 'LOBBY' || config.allowCrowdSwarmOutsideGlobal)
    );
  }
  if (blueprint.beatType === 'HELPER_INTERVENTION') {
    return context.vector.rescueNeed01 >= 0.36 && safeArray(context.input.helperIds).length > 0;
  }
  if (blueprint.beatType === 'REVEAL') {
    return context.vector.revealNeed01 >= 0.34 && context.chosenCallbackAnchorIds.length > 0;
  }
  if (blueprint.beatType === 'HATER_ENTRY') {
    return safeArray(context.input.candidateBotIds).length > 0 || context.vector.relationshipPressure01 >= 0.28;
  }
  return true;
}

function selectActorForBlueprint(blueprint: BeatBlueprint, context: PlannerContext): Pick<SharedChatSceneBeat, 'actorId' | 'actorKind' | 'callbackAnchorIds'> {
  if (!blueprint.requiredRole) {
    return {};
  }

  const match = context.chosenSpeakers.find((speaker) => speaker.role === blueprint.requiredRole);
  if (!match) {
    if (blueprint.requiredRole === 'CALLBACK' && context.chosenAnchors[0]) {
      const anchor = context.chosenAnchors[0];
      return {
        actorId: `CALLBACK:${anchor.anchorId}`,
        actorKind: anchor.anchorType,
        callbackAnchorIds: [anchor.anchorId],
      };
    }
    return {};
  }

  return {
    actorId: match.speakerId,
    actorKind: match.actorKind,
    callbackAnchorIds: match.callbackAnchorIds,
  };
}

function beatDelayMs(blueprint: BeatBlueprint, order: number, context: PlannerContext, config: ChatScenePlannerConfig): number {
  const base = config.baseBeatDelayMs;
  if (blueprint.beatType === 'SILENCE') {
    return Math.round(config.silenceBeatFloorMs + (config.silenceBeatCeilingMs - config.silenceBeatFloorMs) * context.vector.silencePreference01 + order * 90);
  }
  if (blueprint.beatType === 'REVEAL') {
    return Math.round(base + config.revealBeatBonusDelayMs + context.vector.revealNeed01 * 240 + order * 140);
  }
  if (blueprint.beatType === 'PLAYER_REPLY_WINDOW') {
    return Math.round(config.playerReplyWindowDelayMs + context.vector.pressure01 * 120 + order * 90);
  }
  if (blueprint.beatType === 'CROWD_SWARM') {
    return Math.round(base * 0.52 + order * 72);
  }
  return Math.round(base + order * 120 + blueprint.pressureBias * 80 + blueprint.silenceBias * 45);
}

function rhetoricalTemplatesForBeat(blueprint: BeatBlueprint, context: PlannerContext): readonly string[] {
  const templates = [...blueprint.rhetoricalTemplateIds];
  if (context.archetype === 'DEAL_ROOM_PRESSURE_SCENE' && blueprint.beatType === 'PLAYER_REPLY_WINDOW') {
    templates.push('NEGOTIATION_COUNTER_WINDOW');
  }
  if (context.stageMood === 'CEREMONIAL' && blueprint.beatType === 'REVEAL') {
    templates.push('LEGEND_REVEAL');
  }
  if (context.vector.crowdHeat01 >= 0.7 && blueprint.beatType === 'CROWD_SWARM') {
    templates.push('HEAT_SURGE');
  }
  if (context.vector.rescueNeed01 >= 0.68 && blueprint.beatType === 'HELPER_INTERVENTION') {
    templates.push('URGENT_RESCUE');
  }
  return uniq(templates);
}

function semanticClustersForBeat(blueprint: BeatBlueprint, context: PlannerContext): readonly string[] {
  return uniq([
    `BEAT:${normalizeSemanticId(blueprint.beatType)}`,
    `ROLE:${normalizeSemanticId(blueprint.sceneRole)}`,
    `PRESSURE:${normalizeSemanticId(blueprint.targetPressure)}`,
    `ARCHETYPE:${normalizeSemanticId(context.archetype)}`,
    ...context.chosenAnchors.slice(0, 2).flatMap((anchor) => [`ANCHOR:${normalizeSemanticId(anchor.anchorId)}`]),
  ]);
}

function buildBeat(
  blueprint: BeatBlueprint,
  order: number,
  context: PlannerContext,
  config: ChatScenePlannerConfig,
): SharedChatSceneBeat {
  const actor = selectActorForBlueprint(blueprint, context);

  return {
    beatId: `${context.input.momentId}:BEAT:${String(order + 1).padStart(2, '0')}:${blueprint.beatType}`,
    beatType: blueprint.beatType,
    sceneRole: blueprint.sceneRole,
    actorId: actor.actorId,
    actorKind: actor.actorKind,
    delayMs: beatDelayMs(blueprint, order, context, config),
    requiredChannel: context.input.primaryChannel,
    skippable: blueprint.skippable,
    canInterrupt: blueprint.canInterrupt,
    payloadHint: blueprint.payloadHint,
    targetPressure: blueprint.targetPressure,
    callbackAnchorIds: actor.callbackAnchorIds ?? (blueprint.callbackBias >= 0.72 ? context.chosenCallbackAnchorIds.slice(0, 2) : undefined),
    rhetoricalTemplateIds: rhetoricalTemplatesForBeat(blueprint, context),
    semanticClusterIds: semanticClustersForBeat(blueprint, context),
  };
}

function buildSceneBeats(context: PlannerContext, config: ChatScenePlannerConfig): readonly SharedChatSceneBeat[] {
  const archetypeBlueprints = ARCHETYPE_BLUEPRINTS[context.archetype];
  const selectedBlueprints = archetypeBlueprints.filter((blueprint) => shouldIncludeBlueprint(blueprint, context, config));

  const beats = selectedBlueprints.map((blueprint, index) => buildBeat(blueprint, index, context, config));

  if (
    config.enableSecondaryReveal &&
    context.vector.revealNeed01 >= 0.82 &&
    context.chosenCallbackAnchorIds.length > 1 &&
    beats.length < config.maxBeats
  ) {
    const extraReveal = buildBeat(
      createBlueprint(
        'REVEAL',
        'REVEAL',
        'CALLBACK',
        true,
        true,
        'secondary.reveal',
        0.12,
        1,
        1,
        0.08,
        context.vector.pressure01 >= 0.8 ? 'CRITICAL' : 'PRESSURED',
        ['SECONDARY_CALLBACK', 'RECEIPT_ESCALATION'],
      ),
      beats.length,
      context,
      config,
    );
    beats.push(extraReveal);
  }

  const trimmed = beats.slice(0, config.maxBeats);
  if (trimmed.length >= config.minBeats) {
    return trimmed;
  }

  const fallbackBlueprints = ARCHETYPE_BLUEPRINTS.FALSE_CALM_SCENE.filter((blueprint) => blueprint.beatType !== 'SILENCE');
  let index = trimmed.length;
  const out = [...trimmed];
  for (const blueprint of fallbackBlueprints) {
    if (out.length >= config.minBeats) break;
    if (out.some((beat) => beat.beatType === blueprint.beatType)) continue;
    out.push(buildBeat(blueprint, index, context, config));
    index += 1;
  }
  return out.slice(0, config.maxBeats);
}

function expectedDurationMs(beats: readonly SharedChatSceneBeat[]): number {
  return beats.reduce((sum, beat) => sum + Math.max(0, coerceNumber(beat.delayMs)), 0);
}

function escalationPointsForBeats(beats: readonly SharedChatSceneBeat[]): readonly number[] {
  const result: number[] = [];
  beats.forEach((beat, index) => {
    if (beat.beatType === 'HATER_ENTRY' || beat.beatType === 'CROWD_SWARM' || beat.beatType === 'REVEAL') {
      result.push(index);
    }
  });
  return result;
}

function silenceWindowsMsForBeats(beats: readonly SharedChatSceneBeat[]): readonly number[] {
  return beats.filter((beat) => beat.beatType === 'SILENCE').map((beat) => beat.delayMs);
}

function validateBeatSequence(beats: readonly SharedChatSceneBeat[]): readonly SharedChatSceneBeat[] {
  if (!beats.length) return beats;

  const normalized: SharedChatSceneBeat[] = [];
  let hasReplyWindow = false;

  for (const beat of beats) {
    if (beat.beatType === 'PLAYER_REPLY_WINDOW') {
      if (hasReplyWindow) continue;
      hasReplyWindow = true;
    }
    normalized.push(beat);
  }

  if (!hasReplyWindow) {
    const last = normalized[normalized.length - 1];
    normalized.push({
      beatId: `${last?.beatId ?? 'SCENE'}:PLAYER_REPLY_WINDOW`,
      beatType: 'PLAYER_REPLY_WINDOW',
      sceneRole: 'CLOSE',
      delayMs: Math.max(420, (last?.delayMs ?? 360) + 120),
      requiredChannel: last?.requiredChannel ?? 'GLOBAL',
      skippable: false,
      canInterrupt: true,
      payloadHint: 'fallback.player.reply',
      targetPressure: last?.targetPressure ?? 'WATCHFUL',
      rhetoricalTemplateIds: ['PLAYER_WINDOW'],
      semanticClusterIds: ['BEAT:PLAYER_REPLY_WINDOW', 'ROLE:CLOSE'],
    });
  }

  return normalized;
}

/* ========================================================================== *
 * MARK: Plan construction
 * ========================================================================== */

function buildPlannerContext(input: SharedChatScenePlannerInput, config: ChatScenePlannerConfig): PlannerContext {
  const relationship = digestRelationshipState(input);
  const anchors = buildAnchorCandidates(input, relationship);
  const chosenAnchors = chooseAnchors(anchors, config);
  const chosenCallbackAnchorIds = chosenAnchors.map((anchor) => anchor.anchorId);
  const vector = buildPressureVector(input, relationship, anchors, config);
  const archetypeScores = rankArchetypes(input, vector, relationship, config);
  const archetype = archetypeScores.winner;
  const stageMood = stageMoodForMoment(input, vector, relationship);
  const chosenSpeakers = chooseSpeakerOrder(input, relationship, vector, chosenAnchors, config);
  const chosenSpeakerIds = chosenSpeakers.map((speaker) => speaker.speakerId);
  const reasons = collectPlannerReasons(input, relationship, vector, archetype);

  return {
    input,
    relationship,
    anchors,
    chosenAnchors,
    chosenCallbackAnchorIds,
    vector,
    stageMood,
    archetypeScores,
    archetype,
    chosenSpeakerIds,
    chosenSpeakers,
    reasons,
  };
}

function buildScenePlan(context: PlannerContext, config: ChatScenePlannerConfig): SharedChatScenePlan {
  const beats = validateBeatSequence(buildSceneBeats(context, config));
  const planningTagsRaw = uniq([
    ...planningTags(
      context.input,
      context.stageMood,
      context.archetype,
      context.reasons,
      context.relationship,
      context.chosenAnchors,
    ),
    ...semanticClusterIdsForMoment(context.input, context.stageMood, context.archetype, context.chosenAnchors),
  ]);

  return {
    sceneId: `SCENE:${context.input.momentId}`,
    momentId: context.input.momentId,
    momentType: context.input.momentType,
    archetype: context.archetype,
    primaryChannel: context.input.primaryChannel,
    beats,
    startedAt: context.input.now,
    expectedDurationMs: expectedDurationMs(beats),
    allowPlayerComposerDuringScene: config.allowPlayerReplyWindow,
    cancellableByAuthoritativeEvent: true,
    speakerOrder: context.chosenSpeakerIds,
    escalationPoints: escalationPointsForBeats(beats),
    silenceWindowsMs: silenceWindowsMsForBeats(beats),
    callbackAnchorIds: context.chosenCallbackAnchorIds,
    possibleBranchPoints: branchPointsForMoment(context.input, context.archetype),
    planningTags: planningTagsRaw.slice(0, config.maxChosenTags),
  };
}

function buildTelemetry(context: PlannerContext, plan: SharedChatScenePlan): ChatScenePlannerTelemetry {
  const beats = plan.beats;
  return {
    pressure01: context.vector.pressure01,
    relationshipPressure01: context.vector.relationshipPressure01,
    rescueNeed01: context.vector.rescueNeed01,
    callbackOpportunity01: context.vector.callbackOpportunity01,
    crowdHeat01: context.vector.crowdHeat01,
    silencePreference01: context.vector.silencePreference01,
    witnessNeed01: context.vector.witnessNeed01,
    revealNeed01: context.vector.revealNeed01,
    predation01: context.vector.predation01,
    legendHeat01: context.vector.legendHeat01,
    continuityWeight01: context.vector.continuityWeight01,
    confidence01: context.archetypeScores.confidence01,
    expectedDurationMs: plan.expectedDurationMs,
    expectedVisibleBeats: beats.filter((beat) => beat.beatType !== 'SILENCE').length,
    expectedShadowBeats: beats.filter((beat) => beat.beatType === 'SILENCE' || beat.beatType === 'REVEAL').length,
    stageMood: context.stageMood,
    archetype: context.archetype,
    reasons: context.reasons,
    scoreBreakdown: context.archetypeScores.scores,
    branchPressureTags: uniq([
      `CONF:${Math.round(context.archetypeScores.confidence01 * 100)}`,
      `P:${Math.round(context.vector.pressure01 * 100)}`,
      `CROWD:${Math.round(context.vector.crowdHeat01 * 100)}`,
      `CALLBACK:${Math.round(context.vector.callbackOpportunity01 * 100)}`,
      `RESCUE:${Math.round(context.vector.rescueNeed01 * 100)}`,
    ]),
  };
}

function buildBaseDecision(plan: SharedChatScenePlan, context: PlannerContext, config: ChatScenePlannerConfig): SharedChatScenePlannerDecision {
  return {
    plan,
    chosenSpeakerIds: context.chosenSpeakerIds.slice(0, config.maxChosenSpeakerIds),
    chosenCallbackAnchorIds: context.chosenCallbackAnchorIds.slice(0, config.maxChosenCallbackAnchorIds),
    chosenTags: plan.planningTags.slice(0, config.maxChosenTags),
  };
}


function validatePlannerInput(input: SharedChatScenePlannerInput): SharedChatScenePlannerInput {
  const momentType = asMomentType(input.momentType);
  if (!ALL_MOMENT_TYPES.includes(momentType)) {
    return { ...input, momentType: 'RUN_START' };
  }
  return input;
}

/* ========================================================================== *
 * MARK: Planner public API
 * ========================================================================== */

export class ChatScenePlanner {
  private readonly config: ChatScenePlannerConfig;

  public constructor(config?: Partial<ChatScenePlannerConfig>) {
    this.config = { ...DEFAULT_CHAT_SCENE_PLANNER_CONFIG, ...(config ?? {}) };
  }

  public plan(input: SharedChatScenePlannerInput): ChatScenePlannerDecisionWithTelemetry {
    const normalizedInput = validatePlannerInput(input);
    const context = buildPlannerContext(normalizedInput, this.config);
    const plan = buildScenePlan(context, this.config);
    const baseDecision = buildBaseDecision(plan, context, this.config);
    const telemetry = buildTelemetry(context, plan);

    return {
      ...baseDecision,
      telemetry,
    };
  }
}

/* ========================================================================== *
 * MARK: Convenience exports
 * ========================================================================== */

export function createChatScenePlanner(config?: Partial<ChatScenePlannerConfig>): ChatScenePlanner {
  return new ChatScenePlanner(config);
}

export function planChatScene(
  input: SharedChatScenePlannerInput,
  config?: Partial<ChatScenePlannerConfig>,
): ChatScenePlannerDecisionWithTelemetry {
  return new ChatScenePlanner(config).plan(input);
}

export function projectSceneArchetype(
  input: SharedChatScenePlannerInput,
  config?: Partial<ChatScenePlannerConfig>,
): SharedChatSceneArchetype {
  return planChatScene(input, config).telemetry.archetype;
}

export function projectSceneStageMood(
  input: SharedChatScenePlannerInput,
  config?: Partial<ChatScenePlannerConfig>,
): SharedChatSceneStageMood {
  return planChatScene(input, config).telemetry.stageMood;
}

export function projectSceneTelemetry(
  input: SharedChatScenePlannerInput,
  config?: Partial<ChatScenePlannerConfig>,
): ChatScenePlannerTelemetry {
  return planChatScene(input, config).telemetry;
}

export function projectScenePlan(
  input: SharedChatScenePlannerInput,
  config?: Partial<ChatScenePlannerConfig>,
): SharedChatScenePlan {
  return planChatScene(input, config).plan;
}

export function projectSceneBranchPoints(
  input: SharedChatScenePlannerInput,
  config?: Partial<ChatScenePlannerConfig>,
): readonly string[] {
  return projectScenePlan(input, config).possibleBranchPoints;
}

export function projectSceneSpeakerOrder(
  input: SharedChatScenePlannerInput,
  config?: Partial<ChatScenePlannerConfig>,
): readonly string[] {
  return projectScenePlan(input, config).speakerOrder;
}

export function projectSceneBeatTypes(
  input: SharedChatScenePlannerInput,
  config?: Partial<ChatScenePlannerConfig>,
): readonly SharedChatSceneBeatType[] {
  return projectScenePlan(input, config).beats.map((beat) => beat.beatType);
}

export function projectSceneCallbackAnchors(
  input: SharedChatScenePlannerInput,
  config?: Partial<ChatScenePlannerConfig>,
): readonly string[] {
  return planChatScene(input, config).chosenCallbackAnchorIds;
}

export function validateScenePlan(
  plan: SharedChatScenePlan,
  stageMood?: SharedChatSceneStageMood,
  archetype?: SharedChatSceneArchetype,
): ChatScenePlanValidationReport {
  const issues: ChatScenePlanValidationIssue[] = [];
  const beatTypes: SharedChatSceneBeatType[] = [];
  const seenBeatIds = new Set<string>();

  if (!Array.isArray(plan.beats) || plan.beats.length === 0) {
    issues.push({ code: 'EMPTY_BEATS', message: 'Scene plan must contain at least one beat.' });
  }

  for (const beat of plan.beats) {
    beatTypes.push(beat.beatType);
    if (seenBeatIds.has(beat.beatId)) {
      issues.push({ code: 'DUPLICATE_BEAT_ID', message: `Duplicate beatId detected: ${beat.beatId}`, beatId: beat.beatId });
    }
    seenBeatIds.add(beat.beatId);

    if (beat.requiredChannel !== plan.primaryChannel && beat.requiredChannel !== 'GLOBAL' && plan.primaryChannel !== 'GLOBAL') {
      issues.push({
        code: 'CHANNEL_MISMATCH',
        message: `Beat ${beat.beatId} requires ${beat.requiredChannel} but scene primary channel is ${plan.primaryChannel}.`,
        beatId: beat.beatId,
      });
    }
  }

  if (!Array.isArray(plan.speakerOrder) || plan.speakerOrder.length === 0) {
    issues.push({ code: 'MISSING_SPEAKER_ORDER', message: 'Scene plan must provide a speakerOrder.' });
  }

  if ((plan.archetype === 'LONG_ARC_CALLBACK_SCENE' || plan.archetype === 'END_OF_RUN_RECKONING_SCENE') && plan.callbackAnchorIds.length === 0) {
    issues.push({ code: 'MISSING_CALLBACK_TAGS', message: 'Callback-centric scenes should carry callbackAnchorIds.' });
  }

  for (let index = 1; index < plan.escalationPoints.length; index += 1) {
    if (plan.escalationPoints[index] < plan.escalationPoints[index - 1]) {
      issues.push({ code: 'NON_ASCENDING_ESCALATION', message: 'Escalation points must be ascending.' });
      break;
    }
  }

  if (!(plan.expectedDurationMs > 0)) {
    issues.push({ code: 'INVALID_DURATION', message: 'Scene plan expectedDurationMs must be greater than zero.' });
  }

  return {
    ok: issues.length === 0,
    issues,
    beatTypes,
    stageMood: stageMood ?? MOMENT_DEFAULT_STAGE_MOOD[plan.momentType],
    archetype: archetype ?? plan.archetype,
    primaryChannel: plan.primaryChannel,
  };
}

export function explainSceneDecision(
  input: SharedChatScenePlannerInput,
  config?: Partial<ChatScenePlannerConfig>,
): ChatSceneDecisionExplanation {
  const decision = planChatScene(input, config);
  return {
    momentType: input.momentType,
    archetype: decision.telemetry.archetype,
    stageMood: decision.telemetry.stageMood,
    beatTypes: decision.plan.beats.map((beat) => beat.beatType),
    speakerOrder: decision.plan.speakerOrder,
    callbackAnchorIds: decision.chosenCallbackAnchorIds,
    planningTags: decision.plan.planningTags,
    branchPoints: decision.plan.possibleBranchPoints,
    confidence01: decision.telemetry.confidence01,
    reasons: decision.telemetry.reasons,
  };
}

