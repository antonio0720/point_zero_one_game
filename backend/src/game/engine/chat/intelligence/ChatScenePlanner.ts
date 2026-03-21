/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT SCENE PLANNER
 * FILE: backend/src/game/engine/chat/intelligence/ChatScenePlanner.ts
 * VERSION: 2026.03.21-backend-scene-planner-sovereign.v1
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Authoritative backend scene composition engine for the chat social runtime.
 *
 * ChatScenePlanner does NOT replay lines, pick random taunts, or emit messages.
 * It produces a fully authored ChatScenePlannerDecision — the directorial
 * blueprint that HaterResponseOrchestrator, HelperResponseOrchestrator, and
 * ChatInvasionOrchestrator consume to construct transcript-grade turns.
 *
 * Seven jobs in order:
 *
 * 1. CAST — Select lead, support, helper, and ambient actors from the canonical
 *    NPC registry, weighted by relationship state, mode policy, audience heat,
 *    channel affinity, and anti-repeat cooldown.
 *
 * 2. ARCHETYPE — Map moment type + mode to one of 14 scene archetypes. Each
 *    archetype has a distinct beat grammar, silence policy, and escalation map.
 *
 * 3. BUILD BEATS — Construct the beat sequence: entry, player window, callback
 *    reveal, escalation, crowd witness, resolution. Beat timing is derived from
 *    cadence profiles pulled from shared NPC contracts.
 *
 * 4. MODE OVERLAY — Apply mode-specific scene mutations:
 *    EMPIRE   → isolation premium, sparse crowd, single hater focus
 *    PREDATOR → deal-room pressure, silences weaponized, double-agent beats
 *    SYNDICATE → trust channel beats, defection signals, rescue debt callbacks
 *    PHANTOM  → ghost divergence witness, legend callback, silence before entry
 *
 * 5. MEMORY SPLICE — Identify top callback anchors from episodic memory and
 *    bind them to beats that carry the 'callback-weaponization' payload hint.
 *
 * 6. RELATIONSHIP WEIGHT — Boost cast weights for known counterparts, reduce
 *    weights for NPCs recently suppressed, and flag rivalry-intensified actors
 *    for high-escalation lead role.
 *
 * 7. ARCHIVE PAYLOAD — Produce a replay-safe, proof-chainable scene record
 *    for ChatSceneArchiveService and the ChatProofChain.
 *
 * Architecture laws
 * -----------------
 * - This file imports from shared/contracts/chat (types + descriptors only).
 * - This file imports from ./types (backend branded primitives only).
 * - This file does NOT import from ChatEngine, HaterResponseOrchestrator,
 *   ChatTranscriptLedger, or any other backend orchestration module.
 * - All beat delay values reference CHAT_NPC_CADENCE_PROFILES — never hardcode.
 * - Mode policies are tables, not conditionals scattered through methods.
 * - hashSeed is deterministic; same input → same output for replay safety.
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ============================================================================
 */

// ─── Backend primitive types ──────────────────────────────────────────────────
import type {
  ChatRoomId,
  ChatSceneId,
  ChatMomentId,
  ChatUserId,
  ChatMemoryAnchorId,
  ChatRelationshipId,
  Score01,
  UnixMs,
} from '../types';

// ─── Shared channel contracts ─────────────────────────────────────────────────
import type {
  ChatChannelId,
  ChatModeScope,
} from '../../../../../../shared/contracts/chat/ChatChannels';

// ─── Shared event contracts ───────────────────────────────────────────────────
import type {
  ChatMomentType,
  ChatPressureTier,
  ChatTickTier,
  ChatRelationshipState,
  ChatMemoryAnchor,
  ChatAudienceHeat,
  ChatChannelMood,
} from '../../../../../../shared/contracts/chat/ChatEvents';

// ─── Shared NPC contracts — the canonical cast ────────────────────────────────
import {
  type ChatHaterNpcKey,
  type ChatHelperNpcKey,
  type ChatAmbientNpcKey,
  type ChatKnownNpcKey,
  type ChatNpcDescriptor,
  type ChatHaterNpcDescriptor,
  type ChatHelperNpcDescriptor,
  type ChatAmbientNpcDescriptor,
  type ChatNpcSceneRole,
  type ChatNpcCadenceBand,
  type ChatNpcTurnPlan,
  type ChatNpcScenePlan,
  CHAT_HATER_NPC_KEYS,
  CHAT_HELPER_NPC_KEYS,
  CHAT_AMBIENT_NPC_KEYS,
  CHAT_HATER_NPC_DESCRIPTORS,
  CHAT_HELPER_NPC_DESCRIPTORS,
  CHAT_AMBIENT_NPC_DESCRIPTORS,
  CHAT_ALL_NPC_DESCRIPTORS,
  CHAT_NPC_CADENCE_PROFILES,
  isHaterNpcKey,
  isHelperNpcKey,
} from '../../../../../../shared/contracts/chat/ChatNpc';

// ─── Shared message contracts ─────────────────────────────────────────────────
import type {
  ChatMessageBody,
} from '../../../../../../shared/contracts/chat/ChatMessage';

// ============================================================================
// MARK: Module identity
// ============================================================================

export const CHAT_SCENE_PLANNER_MODULE_NAME =
  'PZO_BACKEND_CHAT_SCENE_PLANNER' as const;

export const CHAT_SCENE_PLANNER_VERSION =
  '2026.03.21-backend-scene-planner-sovereign.v1' as const;

export const CHAT_SCENE_PLANNER_RUNTIME_LAWS = Object.freeze([
  'Scene plans are directorial blueprints, not transcript mutations.',
  'Beat delays reference cadence profiles from shared NPC contracts — never hardcoded.',
  'Cast selection is deterministic for the same seed, relationship state, and mode.',
  'Mode overlays are tables applied after base planning — never scattered conditionals.',
  'Memory anchors bind to callback beats; they do not drive lead selection.',
  'Silence windows are first-class beats; empty space is authored, not accidental.',
  'Archive payloads carry scene identity for proof chain and replay rehydration.',
  'Anti-repeat suppression is tracked at scene level, not at line level.',
  'Audience heat may boost cast weights but never overrides mode policy.',
  'No orchestrator method is called from within this file.',
] as const);

export const CHAT_SCENE_PLANNER_DEFAULTS = Object.freeze({
  maxCallbackAnchors:         3,
  maxBeatsPerScene:           7,
  maxCastSize:                5,
  defaultSceneDurationMs:     8_500,
  falseCalmSilenceMs:          1_200,
  dealRoomSilenceMs:          2_200,
  phantomGhostRevealDelayMs:  3_400,
  syndicateWarAlertDelayMs:     600,
  antiRepeatCooldownMs:       45_000,
  maxCachedSceneIds:          128,
} as const);

// ============================================================================
// MARK: Scene archetype vocabulary
// ============================================================================

export const CHAT_SCENE_ARCHETYPES = [
  'BREACH_SCENE',
  'TRAP_SCENE',
  'RESCUE_SCENE',
  'DEAL_ROOM_PRESSURE_SCENE',
  'COMEBACK_WITNESS_SCENE',
  'END_OF_RUN_RECKONING_SCENE',
  'SEASON_EVENT_INTRUSION_SCENE',
  'LONG_ARC_CALLBACK_SCENE',
  'FALSE_CALM_SCENE',
  'PUBLIC_HUMILIATION_SCENE',
  'PHANTOM_GHOST_DIVERGENCE_SCENE',
  'SYNDICATE_DEFECTION_SIGNAL_SCENE',
  'EMPIRE_ISOLATION_RECKONING_SCENE',
  'PREDATOR_DOUBLE_AGENT_SCENE',
] as const;

export type ChatSceneArchetype = (typeof CHAT_SCENE_ARCHETYPES)[number];

// ============================================================================
// MARK: Beat type vocabulary
// ============================================================================

export const CHAT_SCENE_BEAT_TYPES = [
  'HATER_ENTRY',
  'HELPER_INTERVENTION',
  'PLAYER_REPLY_WINDOW',
  'CROWD_WITNESS_BURST',
  'CALLBACK_REVEAL',
  'ESCALATION_SPIKE',
  'SILENCE_WINDOW',
  'AMBIENT_ECHO',
  'DEAL_ROOM_PRESSURE',
  'GHOST_MARKER_REVEAL',
  'RESCUE_OFFER',
  'WAR_ALERT',
  'DEFECTION_SIGNAL',
  'RECKONING_CLOSE',
] as const;

export type ChatSceneBeatType = (typeof CHAT_SCENE_BEAT_TYPES)[number];

// ============================================================================
// MARK: Scene beat contract
// ============================================================================

export interface ChatSceneBeat {
  readonly beatId:                  string;
  readonly beatType:                ChatSceneBeatType;
  readonly sceneRole:               ChatNpcSceneRole | 'OPEN' | 'DEFEND' | 'CALLBACK' | 'CLOSE' | 'WITNESS' | 'SILENCE';
  readonly actorId?:                ChatKnownNpcKey;
  readonly actorKind?:              'HATER' | 'HELPER' | 'AMBIENT' | 'SYSTEM';
  readonly npcKey?:                 ChatKnownNpcKey;
  readonly delayMs:                 number;
  readonly durationMs?:             number;
  readonly requiredChannel:         ChatChannelId;
  readonly fallbackChannel?:        ChatChannelId;
  readonly skippable:               boolean;
  readonly canInterrupt:            boolean;
  readonly canBeInterrupted:        boolean;
  readonly payloadHint:             string;
  readonly targetPressure?:         ChatPressureTier;
  readonly callbackAnchorIds?:      readonly ChatMemoryAnchorId[];
  readonly rhetoricalTemplateIds?:  readonly string[];
  readonly semanticClusterIds?:     readonly string[];
  readonly messageKind?:            ChatMessageBody;
  readonly typingTheaterEnabled:    boolean;
  readonly silenceIntentional:      boolean;
  readonly audienceHeatBoost?:      Score01;
  readonly modeExclusive?:          ChatModeScope;
  readonly proofBindable:           boolean;
}

// ============================================================================
// MARK: Planner input contract
// ============================================================================

export interface ChatScenePlannerInput {
  readonly playerId:          ChatUserId;
  readonly roomId:            ChatRoomId;
  readonly momentId:          ChatMomentId;
  readonly momentType:        ChatMomentType;
  readonly primaryChannel:    ChatChannelId;
  readonly pressureTier:      ChatPressureTier;
  readonly tickTier?:         ChatTickTier;
  readonly modeScope?:        ChatModeScope;
  readonly now:               UnixMs;
  readonly relationshipState?: readonly ChatRelationshipState[];
  readonly memoryAnchors?:     readonly ChatMemoryAnchor[];
  readonly audienceHeat?:      Readonly<Partial<Record<string, ChatAudienceHeat>>>;
  readonly channelMoods?:      Readonly<Partial<Record<string, ChatChannelMood>>>;
  readonly recentSceneIds?:    readonly ChatSceneId[];
  readonly suppressedNpcKeys?: readonly ChatKnownNpcKey[];
  readonly proofContext?: {
    readonly runId?:   string;
    readonly tickNumber?: number;
    readonly proofHash?: string;
  };
}

// ============================================================================
// MARK: Planner output contract
// ============================================================================

export interface ChatScenePlannerDecision {
  readonly plan:                    ChatScenePlan;
  readonly chosenSpeakerIds:        readonly ChatKnownNpcKey[];
  readonly chosenCallbackAnchorIds: readonly ChatMemoryAnchorId[];
  readonly chosenTags:              readonly string[];
  readonly archiveMeta:             ChatSceneArchiveMeta;
  readonly telemetry:               ChatScenePlannerTelemetry;
}

export interface ChatScenePlan {
  readonly sceneId:                    ChatSceneId;
  readonly momentId:                   ChatMomentId;
  readonly momentType:                 ChatMomentType;
  readonly archetype:                  ChatSceneArchetype;
  readonly primaryChannel:             ChatChannelId;
  readonly modeScope?:                 ChatModeScope;
  readonly beats:                      readonly ChatSceneBeat[];
  readonly startedAt:                  UnixMs;
  readonly expectedDurationMs:         number;
  readonly allowPlayerComposerDuringScene: boolean;
  readonly cancellableByAuthoritativeEvent: boolean;
  readonly speakerOrder:               readonly ChatKnownNpcKey[];
  readonly escalationPoints:           readonly number[];
  readonly silenceWindowsMs:           readonly number[];
  readonly callbackAnchorIds:          readonly ChatMemoryAnchorId[];
  readonly possibleBranchPoints:       readonly string[];
  readonly planningTags:               readonly string[];
  readonly modePolicy:                 ChatSceneModePolicy;
  readonly castManifest:               readonly ChatSceneCastEntry[];
  readonly archivable:                 boolean;
  readonly proofBindable:              boolean;
  readonly replayEligible:             boolean;
}

export interface ChatSceneCastEntry {
  readonly npcKey:       ChatKnownNpcKey;
  readonly role:         ChatNpcSceneRole | 'OPENER' | 'PRESSURE_ESCALATOR' | 'CROWD_WITNESS' | 'HELPER_INTERCEPTOR' | 'CLOSER' | 'ECHO' | 'SHADOW_MARKER';
  readonly weight:       number;
  readonly channel:      ChatChannelId;
  readonly suppressed:   boolean;
  readonly suppressionReason?: string;
  readonly relationshipDriven: boolean;
}

export interface ChatSceneArchiveMeta {
  readonly sceneId:       ChatSceneId;
  readonly version:       string;
  readonly momentType:    ChatMomentType;
  readonly archetype:     ChatSceneArchetype;
  readonly plannerSeed:   number;
  readonly generatedAt:   UnixMs;
  readonly proofContext?:  { readonly runId?: string; readonly tickNumber?: number; readonly proofHash?: string; };
  readonly beatCount:      number;
  readonly castKeys:       readonly ChatKnownNpcKey[];
  readonly anchorIds:      readonly ChatMemoryAnchorId[];
  readonly durationMs:     number;
  readonly replayPayload?: string;
}

export interface ChatScenePlannerTelemetry {
  readonly planDurationMs:      number;
  readonly archetypeChosen:     ChatSceneArchetype;
  readonly castSize:            number;
  readonly suppressedCount:     number;
  readonly anchorCount:         number;
  readonly modePolicied:        boolean;
  readonly relationshipDriven:  boolean;
  readonly heatBoosted:         boolean;
  readonly antiRepeatApplied:   boolean;
}

// ============================================================================
// MARK: Mode scene policy
// ============================================================================

export interface ChatSceneModePolicy {
  readonly modeScope:                    ChatModeScope | string | 'DEFAULT';
  readonly crowdDensity:                 'SPARSE' | 'STANDARD' | 'DENSE';
  readonly primaryHaterSlots:            number;
  readonly helperEnabled:                boolean;
  readonly ambientEnabled:               boolean;
  readonly composerSuppressedDuring:     boolean;
  readonly weaponizedSilence:            boolean;
  readonly dealRoomDefaultChannel:       boolean;
  readonly callbackMemoryIntensity:      'LOW' | 'STANDARD' | 'HIGH';
  readonly ghostDivergenceEnabled:       boolean;
  readonly defectionSignalEnabled:       boolean;
  readonly isolationMultiplier:          number;
  readonly escalationSpeedMultiplier:    number;
  readonly presenceTheaterEnabled:       boolean;
  readonly audienceHeatInfluence:        'NONE' | 'MINOR' | 'MAJOR';
}

const MODE_SCENE_POLICIES: Readonly<Record<string, ChatSceneModePolicy>> = Object.freeze({
  GO_ALONE: Object.freeze({
    modeScope:                  'GO_ALONE',
    crowdDensity:               'SPARSE',
    primaryHaterSlots:          1,
    helperEnabled:              true,
    ambientEnabled:             false,
    composerSuppressedDuring:   false,
    weaponizedSilence:          false,
    dealRoomDefaultChannel:     false,
    callbackMemoryIntensity:    'STANDARD',
    ghostDivergenceEnabled:     false,
    defectionSignalEnabled:     false,
    isolationMultiplier:        1.45,
    escalationSpeedMultiplier:  0.85,
    presenceTheaterEnabled:     true,
    audienceHeatInfluence:      'MINOR',
  }),
  HEAD_TO_HEAD: Object.freeze({
    modeScope:                  'HEAD_TO_HEAD',
    crowdDensity:               'STANDARD',
    primaryHaterSlots:          2,
    helperEnabled:              false,
    ambientEnabled:             true,
    composerSuppressedDuring:   true,
    weaponizedSilence:          true,
    dealRoomDefaultChannel:     true,
    callbackMemoryIntensity:    'HIGH',
    ghostDivergenceEnabled:     false,
    defectionSignalEnabled:     false,
    isolationMultiplier:        1.0,
    escalationSpeedMultiplier:  1.60,
    presenceTheaterEnabled:     true,
    audienceHeatInfluence:      'MAJOR',
  }),
  TEAM_UP: Object.freeze({
    modeScope:                  'TEAM_UP',
    crowdDensity:               'DENSE',
    primaryHaterSlots:          1,
    helperEnabled:              true,
    ambientEnabled:             true,
    composerSuppressedDuring:   false,
    weaponizedSilence:          false,
    dealRoomDefaultChannel:     false,
    callbackMemoryIntensity:    'HIGH',
    ghostDivergenceEnabled:     false,
    defectionSignalEnabled:     true,
    isolationMultiplier:        0.75,
    escalationSpeedMultiplier:  1.0,
    presenceTheaterEnabled:     true,
    audienceHeatInfluence:      'MAJOR',
  }),
  CHASE_A_LEGEND: Object.freeze({
    modeScope:                  'CHASE_A_LEGEND',
    crowdDensity:               'SPARSE',
    primaryHaterSlots:          1,
    helperEnabled:              true,
    ambientEnabled:             false,
    composerSuppressedDuring:   false,
    weaponizedSilence:          true,
    dealRoomDefaultChannel:     false,
    callbackMemoryIntensity:    'HIGH',
    ghostDivergenceEnabled:     true,
    defectionSignalEnabled:     false,
    isolationMultiplier:        1.20,
    escalationSpeedMultiplier:  0.90,
    presenceTheaterEnabled:     true,
    audienceHeatInfluence:      'MINOR',
  }),
  DEFAULT: Object.freeze({
    modeScope:                  'DEFAULT',
    crowdDensity:               'STANDARD',
    primaryHaterSlots:          1,
    helperEnabled:              true,
    ambientEnabled:             false,
    composerSuppressedDuring:   false,
    weaponizedSilence:          false,
    dealRoomDefaultChannel:     false,
    callbackMemoryIntensity:    'STANDARD',
    ghostDivergenceEnabled:     false,
    defectionSignalEnabled:     false,
    isolationMultiplier:        1.0,
    escalationSpeedMultiplier:  1.0,
    presenceTheaterEnabled:     true,
    audienceHeatInfluence:      'MINOR',
  }),
});

// ============================================================================
// MARK: Archetype → moment type mapping
// ============================================================================

const MOMENT_TYPE_TO_ARCHETYPE: Readonly<Record<ChatMomentType, ChatSceneArchetype>> = Object.freeze({
  RUN_START:           'FALSE_CALM_SCENE',
  RUN_END:             'END_OF_RUN_RECKONING_SCENE',
  PRESSURE_SPIKE:      'PUBLIC_HUMILIATION_SCENE',
  SHIELD_BREAK:        'BREACH_SCENE',
  COMEBACK:            'COMEBACK_WITNESS_SCENE',
  DEAL_TENSION:        'DEAL_ROOM_PRESSURE_SCENE',
  HATER_SWARM:         'TRAP_SCENE',
  HELPER_RESCUE:       'RESCUE_SCENE',
  SOVEREIGNTY_NEAR:    'LONG_ARC_CALLBACK_SCENE',
  SOVEREIGNTY_ACHIEVED:'END_OF_RUN_RECKONING_SCENE',
  WORLD_EVENT:         'SEASON_EVENT_INTRUSION_SCENE',
  POST_RUN:            'END_OF_RUN_RECKONING_SCENE',
});

// Mode-specific archetype overrides: [modeScope][momentType] = override
const MODE_ARCHETYPE_OVERRIDES: Readonly<Partial<Record<string, Partial<Record<ChatMomentType, ChatSceneArchetype>>>>> = Object.freeze({
  GO_ALONE: Object.freeze({
    PRESSURE_SPIKE:   'EMPIRE_ISOLATION_RECKONING_SCENE',
    SHIELD_BREAK:     'EMPIRE_ISOLATION_RECKONING_SCENE',
  }),
  HEAD_TO_HEAD: Object.freeze({
    DEAL_TENSION:     'PREDATOR_DOUBLE_AGENT_SCENE',
    PRESSURE_SPIKE:   'DEAL_ROOM_PRESSURE_SCENE',
  }),
  TEAM_UP: Object.freeze({
    HATER_SWARM:      'SYNDICATE_DEFECTION_SIGNAL_SCENE',
  }),
  CHASE_A_LEGEND: Object.freeze({
    SOVEREIGNTY_NEAR: 'PHANTOM_GHOST_DIVERGENCE_SCENE',
    COMEBACK:         'PHANTOM_GHOST_DIVERGENCE_SCENE',
  }),
});

// ============================================================================
// MARK: Per-archetype beat grammars
// ============================================================================

interface ArchetypeBeatGrammar {
  readonly openBeat:         ChatSceneBeatType;
  readonly midBeats:         readonly ChatSceneBeatType[];
  readonly closeBeat:        ChatSceneBeatType;
  readonly silenceWindowsMs: readonly number[];
  readonly escalationPoints: readonly number[];
  readonly composerAllowed:  boolean;
  readonly cancellable:      boolean;
  readonly minDurationMs:    number;
  readonly maxDurationMs:    number;
}

const ARCHETYPE_BEAT_GRAMMARS: Readonly<Record<ChatSceneArchetype, ArchetypeBeatGrammar>> = Object.freeze({
  BREACH_SCENE: {
    openBeat:       'HATER_ENTRY',
    midBeats:       ['CROWD_WITNESS_BURST', 'PLAYER_REPLY_WINDOW', 'ESCALATION_SPIKE'],
    closeBeat:      'CALLBACK_REVEAL',
    silenceWindowsMs: [],
    escalationPoints: [0, 3],
    composerAllowed: true,
    cancellable:    true,
    minDurationMs:  4_000,
    maxDurationMs:  9_000,
  },
  TRAP_SCENE: {
    openBeat:       'SILENCE_WINDOW',
    midBeats:       ['HATER_ENTRY', 'ESCALATION_SPIKE', 'CROWD_WITNESS_BURST'],
    closeBeat:      'CALLBACK_REVEAL',
    silenceWindowsMs: [800],
    escalationPoints: [1, 2],
    composerAllowed: true,
    cancellable:    true,
    minDurationMs:  5_500,
    maxDurationMs:  11_000,
  },
  RESCUE_SCENE: {
    openBeat:       'SILENCE_WINDOW',
    midBeats:       ['HELPER_INTERVENTION', 'RESCUE_OFFER'],
    closeBeat:      'HELPER_INTERVENTION',
    silenceWindowsMs: [600],
    escalationPoints: [],
    composerAllowed: true,
    cancellable:    false,
    minDurationMs:  3_500,
    maxDurationMs:  7_000,
  },
  DEAL_ROOM_PRESSURE_SCENE: {
    openBeat:       'DEAL_ROOM_PRESSURE',
    midBeats:       ['SILENCE_WINDOW', 'CALLBACK_REVEAL', 'PLAYER_REPLY_WINDOW'],
    closeBeat:      'DEAL_ROOM_PRESSURE',
    silenceWindowsMs: [2_200],
    escalationPoints: [0, 2],
    composerAllowed: false,
    cancellable:    false,
    minDurationMs:  6_000,
    maxDurationMs:  14_000,
  },
  COMEBACK_WITNESS_SCENE: {
    openBeat:       'CROWD_WITNESS_BURST',
    midBeats:       ['AMBIENT_ECHO', 'CALLBACK_REVEAL'],
    closeBeat:      'HELPER_INTERVENTION',
    silenceWindowsMs: [],
    escalationPoints: [],
    composerAllowed: true,
    cancellable:    true,
    minDurationMs:  3_000,
    maxDurationMs:  7_500,
  },
  END_OF_RUN_RECKONING_SCENE: {
    openBeat:       'RECKONING_CLOSE',
    midBeats:       ['CALLBACK_REVEAL', 'AMBIENT_ECHO', 'SILENCE_WINDOW'],
    closeBeat:      'RECKONING_CLOSE',
    silenceWindowsMs: [1_000],
    escalationPoints: [],
    composerAllowed: false,
    cancellable:    false,
    minDurationMs:  5_000,
    maxDurationMs:  12_000,
  },
  SEASON_EVENT_INTRUSION_SCENE: {
    openBeat:       'WAR_ALERT',
    midBeats:       ['CROWD_WITNESS_BURST', 'AMBIENT_ECHO'],
    closeBeat:      'HATER_ENTRY',
    silenceWindowsMs: [],
    escalationPoints: [0],
    composerAllowed: true,
    cancellable:    true,
    minDurationMs:  3_500,
    maxDurationMs:  8_000,
  },
  LONG_ARC_CALLBACK_SCENE: {
    openBeat:       'SILENCE_WINDOW',
    midBeats:       ['CALLBACK_REVEAL', 'HATER_ENTRY', 'CROWD_WITNESS_BURST'],
    closeBeat:      'CALLBACK_REVEAL',
    silenceWindowsMs: [1_400],
    escalationPoints: [1, 3],
    composerAllowed: true,
    cancellable:    true,
    minDurationMs:  5_000,
    maxDurationMs:  10_000,
  },
  FALSE_CALM_SCENE: {
    openBeat:       'SILENCE_WINDOW',
    midBeats:       ['AMBIENT_ECHO', 'HATER_ENTRY'],
    closeBeat:      'PLAYER_REPLY_WINDOW',
    silenceWindowsMs: [1_200, 700],
    escalationPoints: [],
    composerAllowed: true,
    cancellable:    true,
    minDurationMs:  3_000,
    maxDurationMs:  7_000,
  },
  PUBLIC_HUMILIATION_SCENE: {
    openBeat:       'HATER_ENTRY',
    midBeats:       ['ESCALATION_SPIKE', 'CROWD_WITNESS_BURST', 'PLAYER_REPLY_WINDOW'],
    closeBeat:      'CALLBACK_REVEAL',
    silenceWindowsMs: [],
    escalationPoints: [0, 1, 3],
    composerAllowed: true,
    cancellable:    true,
    minDurationMs:  4_500,
    maxDurationMs:  9_500,
  },
  PHANTOM_GHOST_DIVERGENCE_SCENE: {
    openBeat:       'GHOST_MARKER_REVEAL',
    midBeats:       ['SILENCE_WINDOW', 'CALLBACK_REVEAL', 'AMBIENT_ECHO'],
    closeBeat:      'PLAYER_REPLY_WINDOW',
    silenceWindowsMs: [3_400],
    escalationPoints: [2],
    composerAllowed: true,
    cancellable:    true,
    minDurationMs:  5_500,
    maxDurationMs:  11_000,
  },
  SYNDICATE_DEFECTION_SIGNAL_SCENE: {
    openBeat:       'DEFECTION_SIGNAL',
    midBeats:       ['WAR_ALERT', 'PLAYER_REPLY_WINDOW', 'CROWD_WITNESS_BURST'],
    closeBeat:      'RESCUE_OFFER',
    silenceWindowsMs: [],
    escalationPoints: [0, 1],
    composerAllowed: true,
    cancellable:    false,
    minDurationMs:  4_000,
    maxDurationMs:  9_000,
  },
  EMPIRE_ISOLATION_RECKONING_SCENE: {
    openBeat:       'SILENCE_WINDOW',
    midBeats:       ['HATER_ENTRY', 'PLAYER_REPLY_WINDOW'],
    closeBeat:      'CALLBACK_REVEAL',
    silenceWindowsMs: [900],
    escalationPoints: [1],
    composerAllowed: false,
    cancellable:    true,
    minDurationMs:  4_500,
    maxDurationMs:  9_000,
  },
  PREDATOR_DOUBLE_AGENT_SCENE: {
    openBeat:       'DEAL_ROOM_PRESSURE',
    midBeats:       ['SILENCE_WINDOW', 'ESCALATION_SPIKE', 'CALLBACK_REVEAL'],
    closeBeat:      'DEAL_ROOM_PRESSURE',
    silenceWindowsMs: [2_200],
    escalationPoints: [0, 3],
    composerAllowed: false,
    cancellable:    false,
    minDurationMs:  7_000,
    maxDurationMs:  15_000,
  },
});

// ============================================================================
// MARK: Hater cast weight table — per-archetype targeting logic
// ============================================================================

interface HaterWeightEntry {
  readonly npcKey:         ChatHaterNpcKey;
  readonly baseWeight:     number;
  readonly archetypeBias:  Readonly<Partial<Record<ChatSceneArchetype, number>>>;
  readonly modeBias:       Readonly<Partial<Record<string, number>>>;
  readonly pressureBias:   Readonly<Partial<Record<ChatPressureTier, number>>>;
  readonly channelBias:    Readonly<Partial<Record<string, number>>>;
}

const HATER_WEIGHT_TABLE: readonly HaterWeightEntry[] = Object.freeze([
  {
    npcKey:       'LIQUIDATOR',
    baseWeight:   92,
    archetypeBias: {
      BREACH_SCENE:                    +18,
      PUBLIC_HUMILIATION_SCENE:        +14,
      TRAP_SCENE:                      +10,
      EMPIRE_ISOLATION_RECKONING_SCENE: +22,
    },
    modeBias: {
      GO_ALONE:     +15,
      HEAD_TO_HEAD: +8,
    },
    pressureBias: {
      CRITICAL:    +20,
      BREAKPOINT:  +25,
    },
    channelBias: {
      DEAL_ROOM: +12,
    },
  },
  {
    npcKey:       'BUREAUCRAT',
    baseWeight:   88,
    archetypeBias: {
      EMPIRE_ISOLATION_RECKONING_SCENE: +16,
      LONG_ARC_CALLBACK_SCENE:          +12,
      FALSE_CALM_SCENE:                 +10,
    },
    modeBias: {
      GO_ALONE: +10,
      TEAM_UP:  +6,
    },
    pressureBias: {
      CALM:      +8,
      WATCHFUL:  +12,
    },
    channelBias: {
      SYNDICATE: +10,
    },
  },
  {
    npcKey:       'MANIPULATOR',
    baseWeight:   94,
    archetypeBias: {
      TRAP_SCENE:                    +24,
      PREDATOR_DOUBLE_AGENT_SCENE:   +28,
      DEAL_ROOM_PRESSURE_SCENE:      +20,
      PUBLIC_HUMILIATION_SCENE:      +14,
    },
    modeBias: {
      HEAD_TO_HEAD: +20,
      CHASE_A_LEGEND: +8,
    },
    pressureBias: {
      WATCHFUL:  +10,
      PRESSURED: +14,
    },
    channelBias: {
      DEAL_ROOM: +16,
      GLOBAL:    +8,
    },
  },
  {
    npcKey:       'CRASH_PROPHET',
    baseWeight:   90,
    archetypeBias: {
      PHANTOM_GHOST_DIVERGENCE_SCENE:   +22,
      LONG_ARC_CALLBACK_SCENE:          +18,
      SEASON_EVENT_INTRUSION_SCENE:     +16,
      END_OF_RUN_RECKONING_SCENE:       +20,
    },
    modeBias: {
      CHASE_A_LEGEND: +18,
      GO_ALONE:       +8,
    },
    pressureBias: {
      CRITICAL:   +18,
      BREAKPOINT: +22,
    },
    channelBias: {
      GLOBAL: +10,
    },
  },
  {
    npcKey:       'LEGACY_HEIR',
    baseWeight:   86,
    archetypeBias: {
      COMEBACK_WITNESS_SCENE:           +16,
      SYNDICATE_DEFECTION_SIGNAL_SCENE: +14,
      PUBLIC_HUMILIATION_SCENE:         +12,
      FALSE_CALM_SCENE:                 +8,
    },
    modeBias: {
      TEAM_UP: +12,
      GO_ALONE: +6,
    },
    pressureBias: {
      CALM:    +10,
      WATCHFUL: +8,
    },
    channelBias: {
      SYNDICATE: +14,
      LOBBY:     +10,
    },
  },
]);

// ============================================================================
// MARK: Helper cast weight table
// ============================================================================

interface HelperWeightEntry {
  readonly npcKey:         ChatHelperNpcKey;
  readonly baseWeight:     number;
  readonly archetypeBias:  Readonly<Partial<Record<ChatSceneArchetype, number>>>;
  readonly modeBias:       Readonly<Partial<Record<string, number>>>;
  readonly pressureBias:   Readonly<Partial<Record<ChatPressureTier, number>>>;
}

const HELPER_WEIGHT_TABLE: readonly HelperWeightEntry[] = Object.freeze([
  {
    npcKey:       'MENTOR',
    baseWeight:   88,
    archetypeBias: {
      RESCUE_SCENE:                     +28,
      EMPIRE_ISOLATION_RECKONING_SCENE: +20,
      FALSE_CALM_SCENE:                 +12,
      END_OF_RUN_RECKONING_SCENE:       +16,
    },
    modeBias: {
      GO_ALONE: +18,
      CHASE_A_LEGEND: +10,
    },
    pressureBias: {
      CRITICAL:   +22,
      BREAKPOINT: +28,
    },
  },
  {
    npcKey:       'INSIDER',
    baseWeight:   76,
    archetypeBias: {
      BREACH_SCENE:          +16,
      TRAP_SCENE:            +20,
      PREDATOR_DOUBLE_AGENT_SCENE: +14,
    },
    modeBias: {
      HEAD_TO_HEAD: +14,
      GO_ALONE:     +8,
    },
    pressureBias: {
      PRESSURED: +12,
      CRITICAL:  +8,
    },
  },
  {
    npcKey:       'SURVIVOR',
    baseWeight:   82,
    archetypeBias: {
      RESCUE_SCENE:                     +30,
      END_OF_RUN_RECKONING_SCENE:       +22,
      EMPIRE_ISOLATION_RECKONING_SCENE: +18,
    },
    modeBias: {
      GO_ALONE: +10,
    },
    pressureBias: {
      BREAKPOINT: +30,
      CRITICAL:   +24,
    },
  },
  {
    npcKey:       'RIVAL',
    baseWeight:   74,
    archetypeBias: {
      COMEBACK_WITNESS_SCENE:        +24,
      LONG_ARC_CALLBACK_SCENE:       +16,
      PHANTOM_GHOST_DIVERGENCE_SCENE: +18,
    },
    modeBias: {
      CHASE_A_LEGEND: +22,
      HEAD_TO_HEAD:   +10,
    },
    pressureBias: {
      CALM:    +10,
      WATCHFUL: +8,
    },
  },
  {
    npcKey:       'ARCHIVIST',
    baseWeight:   64,
    archetypeBias: {
      END_OF_RUN_RECKONING_SCENE:     +20,
      LONG_ARC_CALLBACK_SCENE:        +18,
      PHANTOM_GHOST_DIVERGENCE_SCENE: +14,
    },
    modeBias: {
      CHASE_A_LEGEND: +16,
    },
    pressureBias: {
      CALM: +12,
    },
  },
]);

// ============================================================================
// MARK: Utility — FNV-1a deterministic hash
// ============================================================================

function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function stablePickIndex(seed: number, length: number): number {
  if (length <= 0) return 0;
  return Math.abs(seed) % length;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function buildBeatId(sceneId: ChatSceneId, index: number): string {
  return `${sceneId}:beat:${String(index + 1).padStart(2, '0')}`;
}

// ============================================================================
// MARK: Relationship-driven weight boosting
// ============================================================================

function applyRelationshipBoosts(
  weights: Map<ChatKnownNpcKey, number>,
  relationships: readonly ChatRelationshipState[] | undefined,
): void {
  if (!relationships?.length) return;

  // Sort by rivalry + fascination + contempt + fear — most intense first
  const ranked = [...relationships].sort((a, b) => {
    const scoreA = a.rivalryIntensity + a.fascination + a.contempt + a.fear;
    const scoreB = b.rivalryIntensity + b.fascination + b.contempt + b.fear;
    return scoreB - scoreA;
  });

  for (const rel of ranked) {
    const npcKey = rel.counterpartId as ChatKnownNpcKey;
    if (!weights.has(npcKey)) continue;
    const current = weights.get(npcKey) ?? 0;

    // Boost = weighted sum of relationship dimensions
    const rivalBoost   = Math.round(rel.rivalryIntensity * 0.45);
    const fascinBoost  = Math.round(rel.fascination      * 0.28);
    const contemptBoost = Math.round(rel.contempt        * 0.18);
    const fearBoost    = Math.round(rel.fear             * 0.12);
    const totalBoost   = rivalBoost + fascinBoost + contemptBoost + fearBoost;

    weights.set(npcKey, current + totalBoost);
  }
}

// ============================================================================
// MARK: Audience heat weight boosting
// ============================================================================

function applyAudienceHeatBoosts(
  weights: Map<ChatKnownNpcKey, number>,
  audienceHeat: Readonly<Partial<Record<string, ChatAudienceHeat>>> | undefined,
  channelId: ChatChannelId,
  policy: ChatSceneModePolicy,
): void {
  if (policy.audienceHeatInfluence === 'NONE') return;
  const channelHeat = audienceHeat?.[channelId];
  if (!channelHeat) return;

  const multiplier = policy.audienceHeatInfluence === 'MAJOR' ? 0.18 : 0.09;
  const humiliationBoost = Math.round(channelHeat.humiliationPressure * multiplier);
  const hypeBoost        = Math.round(channelHeat.hypePressure        * multiplier * 0.6);

  // Humiliation pressure → boost hostile NPCs
  for (const hKey of CHAT_HATER_NPC_KEYS) {
    const cur = weights.get(hKey);
    if (cur !== undefined) weights.set(hKey, cur + humiliationBoost);
  }
  // Hype pressure → boost helpers
  for (const hKey of CHAT_HELPER_NPC_KEYS) {
    const cur = weights.get(hKey);
    if (cur !== undefined) weights.set(hKey, cur + hypeBoost);
  }
}

// ============================================================================
// MARK: Hater cast selection
// ============================================================================

function selectHaterCast(
  archetype:    ChatSceneArchetype,
  modeScope:    string,
  pressure:     ChatPressureTier,
  channel:      ChatChannelId,
  relationships: readonly ChatRelationshipState[] | undefined,
  audienceHeat:  Readonly<Partial<Record<string, ChatAudienceHeat>>> | undefined,
  suppressed:    readonly ChatKnownNpcKey[],
  policy:        ChatSceneModePolicy,
  seed:          number,
): readonly ChatHaterNpcKey[] {
  const weights = new Map<ChatHaterNpcKey, number>();

  for (const entry of HATER_WEIGHT_TABLE) {
    if (suppressed.includes(entry.npcKey)) {
      weights.set(entry.npcKey, 0);
      continue;
    }

    let w = entry.baseWeight;
    w += entry.archetypeBias[archetype] ?? 0;
    w += entry.modeBias[modeScope]       ?? 0;
    w += entry.pressureBias[pressure]    ?? 0;
    w += entry.channelBias[channel]      ?? 0;
    weights.set(entry.npcKey, Math.max(0, w));
  }

  // Apply relationship and audience heat boosts
  applyRelationshipBoosts(weights as unknown as Map<ChatKnownNpcKey, number>, relationships);
  applyAudienceHeatBoosts(weights as unknown as Map<ChatKnownNpcKey, number>, audienceHeat, channel, policy);

  // Sort by weight desc, stable-sort by npcKey for determinism
  const ranked = [...weights.entries()]
    .filter(([, w]) => w > 0)
    .sort(([ka, wa], [kb, wb]) => wb - wa || ka.localeCompare(kb));

  const slots = Math.max(1, policy.primaryHaterSlots);
  const selected: ChatHaterNpcKey[] = [];

  for (let i = 0; i < slots && i < ranked.length; i += 1) {
    // Stable pick with seed rotation prevents predictable reuse
    const idx = stablePickIndex(seed + i * 7, ranked.length - i);
    const pick = ranked.splice(idx, 1)[0];
    if (pick) selected.push(pick[0]);
  }

  return selected;
}

// ============================================================================
// MARK: Helper cast selection
// ============================================================================

function selectHelperCast(
  archetype:    ChatSceneArchetype,
  modeScope:    string,
  pressure:     ChatPressureTier,
  relationships: readonly ChatRelationshipState[] | undefined,
  suppressed:    readonly ChatKnownNpcKey[],
  policy:        ChatSceneModePolicy,
  seed:          number,
): ChatHelperNpcKey | null {
  if (!policy.helperEnabled) return null;

  const weights = new Map<ChatHelperNpcKey, number>();

  for (const entry of HELPER_WEIGHT_TABLE) {
    if (suppressed.includes(entry.npcKey)) {
      weights.set(entry.npcKey, 0);
      continue;
    }

    let w = entry.baseWeight;
    w += entry.archetypeBias[archetype] ?? 0;
    w += entry.modeBias[modeScope]       ?? 0;
    w += entry.pressureBias[pressure]    ?? 0;
    weights.set(entry.npcKey, Math.max(0, w));
  }

  applyRelationshipBoosts(weights as unknown as Map<ChatKnownNpcKey, number>, relationships);

  const ranked = [...weights.entries()]
    .filter(([, w]) => w > 0)
    .sort(([ka, wa], [kb, wb]) => wb - wa || ka.localeCompare(kb));

  if (!ranked.length) return null;
  const idx = stablePickIndex(seed >> 2, ranked.length);
  return ranked[idx]?.[0] ?? null;
}

// ============================================================================
// MARK: Ambient cast selection
// ============================================================================

function selectAmbientCast(
  policy:     ChatSceneModePolicy,
  suppressed: readonly ChatKnownNpcKey[],
  seed:       number,
): readonly ChatAmbientNpcKey[] {
  if (!policy.ambientEnabled || policy.crowdDensity === 'SPARSE') return [];

  const available = CHAT_AMBIENT_NPC_KEYS.filter((k) => !suppressed.includes(k));
  if (!available.length) return [];

  const count = policy.crowdDensity === 'DENSE' ? Math.min(2, available.length) : 1;
  const selected: ChatAmbientNpcKey[] = [];

  for (let i = 0; i < count; i += 1) {
    const idx = stablePickIndex(seed + i * 13, available.length);
    const pick = available[idx];
    if (pick && !selected.includes(pick)) selected.push(pick);
  }

  return selected;
}

// ============================================================================
// MARK: Top memory anchors selection
// ============================================================================

function selectTopAnchors(
  anchors:    readonly ChatMemoryAnchor[] | undefined,
  count:      number,
): readonly ChatMemoryAnchor[] {
  if (!anchors?.length) return [];
  return [...anchors]
    .sort((a, b) => b.salienceScore - a.salienceScore || b.createdAt - a.createdAt)
    .slice(0, count);
}

// ============================================================================
// MARK: NPC channel resolver
// ============================================================================

function resolveNpcChannel(
  npcKey:          ChatKnownNpcKey,
  primaryChannel:  ChatChannelId,
  modePolicy:      ChatSceneModePolicy,
): ChatChannelId {
  const descriptor = CHAT_ALL_NPC_DESCRIPTORS[npcKey];

  // Deal room default in Predator mode
  if (modePolicy.dealRoomDefaultChannel && descriptor.enabledChannels.includes('DEAL_ROOM')) {
    return 'DEAL_ROOM';
  }

  // Prefer primary channel if the NPC supports it
  if (descriptor.enabledChannels.includes(primaryChannel)) {
    return primaryChannel;
  }

  // Fall back to first enabled non-shadow visible channel
  for (const ch of descriptor.enabledChannels) {
    if (!ch.endsWith('_SHADOW') && ch !== 'LOBBY') return ch as ChatChannelId;
  }

  return primaryChannel;
}

// ============================================================================
// MARK: Beat delay resolver — uses cadence profiles from shared contracts
// ============================================================================

function resolveDelayMs(
  beatType:       ChatSceneBeatType,
  npcKey?:        ChatKnownNpcKey,
  multiplier?:    number,
): number {
  if (!npcKey) {
    // Fixed delays for non-NPC beats
    switch (beatType) {
      case 'SILENCE_WINDOW':      return 1_200;
      case 'CROWD_WITNESS_BURST': return 650;
      case 'WAR_ALERT':           return 400;
      case 'DEFECTION_SIGNAL':    return 550;
      case 'GHOST_MARKER_REVEAL': return 3_400;
      case 'PLAYER_REPLY_WINDOW': return 0;
      case 'RECKONING_CLOSE':     return 1_100;
      default:                    return 900;
    }
  }

  const cadence = CHAT_NPC_CADENCE_PROFILES[npcKey];
  if (!cadence) return 1_000;

  // Use the floor of the cadence band as base delay
  const base = cadence.floorMs + Math.round((cadence.ceilMs - cadence.floorMs) * 0.35);
  const scaled = Math.round(base * (multiplier ?? 1.0));

  // Beat-type modifiers
  switch (beatType) {
    case 'ESCALATION_SPIKE':  return Math.round(scaled * 0.60);
    case 'CALLBACK_REVEAL':   return Math.round(scaled * 1.20);
    case 'AMBIENT_ECHO':      return Math.round(scaled * 0.80);
    case 'RESCUE_OFFER':      return Math.round(scaled * 0.90);
    case 'DEAL_ROOM_PRESSURE': return Math.round(scaled * 1.40);
    default:                  return scaled;
  }
}

// ============================================================================
// MARK: Cast manifest builder
// ============================================================================

function buildCastManifest(
  haters:          readonly ChatHaterNpcKey[],
  helper:          ChatHelperNpcKey | null,
  ambient:         readonly ChatAmbientNpcKey[],
  primaryChannel:  ChatChannelId,
  modePolicy:      ChatSceneModePolicy,
  suppressed:      readonly ChatKnownNpcKey[],
  relationships:   readonly ChatRelationshipState[] | undefined,
): readonly ChatSceneCastEntry[] {
  const entries: ChatSceneCastEntry[] = [];

  const haterRoles: ChatSceneCastEntry['role'][] = ['OPENER', 'PRESSURE_ESCALATOR', 'CLOSER'];

  for (let i = 0; i < haters.length; i += 1) {
    const hKey = haters[i]!;
    const rel  = relationships?.find((r) => r.counterpartId === hKey);
    entries.push({
      npcKey:            hKey,
      role:              haterRoles[i] ?? 'PRESSURE_ESCALATOR',
      weight:            HATER_WEIGHT_TABLE.find((e) => e.npcKey === hKey)?.baseWeight ?? 80,
      channel:           resolveNpcChannel(hKey, primaryChannel, modePolicy),
      suppressed:        suppressed.includes(hKey),
      suppressionReason: suppressed.includes(hKey) ? 'HATER_COOLDOWN' : undefined,
      relationshipDriven: !!rel && (rel.rivalryIntensity + rel.fascination) > 40,
    });
  }

  if (helper) {
    entries.push({
      npcKey:            helper,
      role:              'HELPER_INTERCEPTOR',
      weight:            HELPER_WEIGHT_TABLE.find((e) => e.npcKey === helper)?.baseWeight ?? 70,
      channel:           resolveNpcChannel(helper, primaryChannel, modePolicy),
      suppressed:        suppressed.includes(helper),
      suppressionReason: suppressed.includes(helper) ? 'HELPER_ALREADY_ACTIVE' : undefined,
      relationshipDriven: false,
    });
  }

  for (const aKey of ambient) {
    entries.push({
      npcKey:            aKey,
      role:              'CROWD_WITNESS',
      weight:            60,
      channel:           resolveNpcChannel(aKey, primaryChannel, modePolicy),
      suppressed:        suppressed.includes(aKey),
      suppressionReason: suppressed.includes(aKey) ? 'SCENE_LIMIT_REACHED' : undefined,
      relationshipDriven: false,
    });
  }

  return entries;
}

// ============================================================================
// MARK: Beat sequence builder
// ============================================================================

function buildBeats(
  sceneId:        ChatSceneId,
  archetype:      ChatSceneArchetype,
  grammar:        ArchetypeBeatGrammar,
  haters:         readonly ChatHaterNpcKey[],
  helper:         ChatHelperNpcKey | null,
  ambient:        readonly ChatAmbientNpcKey[],
  anchorIds:      readonly ChatMemoryAnchorId[],
  primaryChannel: ChatChannelId,
  modePolicy:     ChatSceneModePolicy,
  pressure:       ChatPressureTier,
  modeScope:      string,
  escalationMultiplier: number,
): readonly ChatSceneBeat[] {
  const beats: ChatSceneBeat[] = [];
  let beatIndex = 0;
  const leadHater  = haters[0];
  const supportHater = haters[1] ?? haters[0];
  const leadHelper = helper;

  // ── OPEN BEAT ─────────────────────────────────────────────────────────────
  {
    const bt = grammar.openBeat;
    const isHaterBeat = bt === 'HATER_ENTRY' || bt === 'DEAL_ROOM_PRESSURE' || bt === 'DEFECTION_SIGNAL';
    const isSilenceBeat = bt === 'SILENCE_WINDOW';
    const actorKey: ChatKnownNpcKey | undefined = isSilenceBeat
      ? undefined
      : bt === 'WAR_ALERT'
        ? undefined
        : bt === 'GHOST_MARKER_REVEAL'
          ? undefined
          : isHaterBeat && leadHater
            ? leadHater
            : bt === 'CROWD_WITNESS_BURST' && ambient.length
              ? ambient[0]
              : bt === 'RECKONING_CLOSE' && leadHater
                ? leadHater
                : leadHater;

    const delay = resolveDelayMs(bt, actorKey, modePolicy.escalationSpeedMultiplier);

    beats.push({
      beatId:               buildBeatId(sceneId, beatIndex++),
      beatType:             bt,
      sceneRole:            isSilenceBeat ? 'SILENCE' : 'OPEN',
      actorId:              actorKey,
      actorKind:            actorKey
        ? isHaterNpcKey(actorKey) ? 'HATER' : isHelperNpcKey(actorKey) ? 'HELPER' : 'AMBIENT'
        : isSilenceBeat ? 'SYSTEM' : 'SYSTEM',
      npcKey:               actorKey,
      delayMs:              delay,
      durationMs:           isSilenceBeat ? (grammar.silenceWindowsMs[0] ?? 1_200) : undefined,
      requiredChannel:      actorKey ? resolveNpcChannel(actorKey, primaryChannel, modePolicy) : primaryChannel,
      skippable:            false,
      canInterrupt:         isHaterBeat,
      canBeInterrupted:     !isSilenceBeat,
      payloadHint:          `${archetype.toLowerCase()}:open`,
      targetPressure:       pressure,
      callbackAnchorIds:    anchorIds.slice(0, 1),
      rhetoricalTemplateIds: ['scene-open', `archetype:${archetype.toLowerCase()}`],
      semanticClusterIds:   [archetype.toLowerCase(), modeScope.toLowerCase()],
      messageKind:          (isSilenceBeat ? 'SYSTEM' : isHaterBeat ? 'BOT_TAUNT' : 'CROWD_REACTION') as unknown as ChatMessageBody,
      typingTheaterEnabled: actorKey ? (CHAT_ALL_NPC_DESCRIPTORS[actorKey]?.typingHints.supportsTypingAbortTheater ?? false) : false,
      silenceIntentional:   isSilenceBeat,
      audienceHeatBoost:    modePolicy.audienceHeatInfluence !== 'NONE' ? (0.08 as Score01) : undefined,
      proofBindable:        !isSilenceBeat,
    });
  }

  // ── MID BEATS ─────────────────────────────────────────────────────────────
  for (let midIdx = 0; midIdx < grammar.midBeats.length; midIdx += 1) {
    const bt = grammar.midBeats[midIdx]!;
    const isEscalation   = bt === 'ESCALATION_SPIKE';
    const isCallback     = bt === 'CALLBACK_REVEAL';
    const isSilence      = bt === 'SILENCE_WINDOW';
    const isHelper       = bt === 'HELPER_INTERVENTION' || bt === 'RESCUE_OFFER';
    const isPlayerWindow = bt === 'PLAYER_REPLY_WINDOW';
    const isAmbient      = bt === 'AMBIENT_ECHO' || bt === 'CROWD_WITNESS_BURST';
    const isDealRoom     = bt === 'DEAL_ROOM_PRESSURE';
    const isGhost        = bt === 'GHOST_MARKER_REVEAL';
    const isWarAlert     = bt === 'WAR_ALERT';

    let actorKey: ChatKnownNpcKey | undefined;
    if (isHelper && leadHelper)          actorKey = leadHelper;
    else if (isCallback && supportHater) actorKey = supportHater;
    else if (isEscalation && leadHater)  actorKey = leadHater;
    else if (isAmbient && ambient.length) actorKey = ambient[stablePickIndex(midIdx, ambient.length)];
    else if (isDealRoom && leadHater)    actorKey = leadHater;
    else if (!isSilence && !isPlayerWindow && !isGhost && !isWarAlert && leadHater)
                                          actorKey = leadHater;

    const escalMult = isEscalation ? modePolicy.escalationSpeedMultiplier * 0.7 : modePolicy.escalationSpeedMultiplier;
    const delay = resolveDelayMs(bt, actorKey, escalMult);

    beats.push({
      beatId:               buildBeatId(sceneId, beatIndex++),
      beatType:             bt,
      sceneRole:            isHelper         ? 'HELPER_INTERCEPTOR'
                          : isCallback       ? 'ECHO'
                          : isSilence        ? 'SILENCE'
                          : isPlayerWindow   ? 'DEFEND'
                          : isAmbient        ? 'CROWD_WITNESS'
                          : 'PRESSURE_ESCALATOR',
      actorId:              actorKey,
      actorKind:            actorKey
        ? isHaterNpcKey(actorKey)   ? 'HATER'
        : isHelperNpcKey(actorKey) ? 'HELPER'
        : 'AMBIENT'
        : 'SYSTEM',
      npcKey:               actorKey,
      delayMs:              delay,
      durationMs:           isSilence ? (grammar.silenceWindowsMs[midIdx] ?? 800) : undefined,
      requiredChannel:      actorKey ? resolveNpcChannel(actorKey, primaryChannel, modePolicy) : primaryChannel,
      fallbackChannel:      primaryChannel,
      skippable:            isAmbient || isPlayerWindow,
      canInterrupt:         !isSilence && !isPlayerWindow,
      canBeInterrupted:     !isSilence,
      payloadHint:          isCallback   ? 'callback-weaponization'
                          : isHelper     ? 'rescue-offer'
                          : isSilence    ? 'silence-hold'
                          : isGhost      ? 'ghost-divergence-reveal'
                          : isWarAlert   ? 'war-alert'
                          : isEscalation ? 'pressure-spike'
                          : 'response-window',
      targetPressure:       pressure,
      callbackAnchorIds:    isCallback ? anchorIds.slice(0, CHAT_SCENE_PLANNER_DEFAULTS.maxCallbackAnchors) : anchorIds.slice(0, 1),
      rhetoricalTemplateIds: isCallback
        ? ['callback-weaponization', 'memory-cite']
        : isHelper
          ? ['player-window', 'rescue']
          : ['escalation'],
      semanticClusterIds:   isCallback ? ['continuity', 'memory'] : ['pressure'],
      messageKind:          (isHelper  ? 'HELPER_PROMPT'
                          : isCallback ? 'RELATIONSHIP_CALLBACK'
                          : isAmbient  ? 'CROWD_REACTION'
                          : 'BOT_TAUNT') as unknown as ChatMessageBody,
      typingTheaterEnabled: actorKey
        ? (CHAT_ALL_NPC_DESCRIPTORS[actorKey]?.typingHints.supportsTypingAbortTheater ?? false)
        : false,
      silenceIntentional:   isSilence,
      audienceHeatBoost:    isEscalation && modePolicy.audienceHeatInfluence !== 'NONE' ? (0.12 as Score01) : undefined,
      modeExclusive:        bt === 'DEFECTION_SIGNAL' ? ('TEAM_UP' as ChatModeScope)
                          : bt === 'GHOST_MARKER_REVEAL' ? ('CHASE_A_LEGEND' as ChatModeScope)
                          : undefined,
      proofBindable:        isCallback || isHelper,
    });
  }

  // ── CLOSE BEAT ────────────────────────────────────────────────────────────
  {
    const bt = grammar.closeBeat;
    const isHelper   = bt === 'HELPER_INTERVENTION' || bt === 'RESCUE_OFFER';
    const isCallback = bt === 'CALLBACK_REVEAL';
    const isReckoning = bt === 'RECKONING_CLOSE';
    const isDealRoom = bt === 'DEAL_ROOM_PRESSURE';

    const actorKey: ChatKnownNpcKey | undefined = isHelper && leadHelper
      ? leadHelper
      : isCallback && supportHater
        ? supportHater
        : isReckoning && leadHater
          ? leadHater
          : isDealRoom && leadHater
            ? leadHater
            : leadHater;

    const delay = resolveDelayMs(bt, actorKey, modePolicy.escalationSpeedMultiplier * 0.85);

    beats.push({
      beatId:               buildBeatId(sceneId, beatIndex++),
      beatType:             bt,
      sceneRole:            'CLOSE',
      actorId:              actorKey,
      actorKind:            actorKey
        ? isHaterNpcKey(actorKey)   ? 'HATER'
        : isHelperNpcKey(actorKey)  ? 'HELPER'
        : 'AMBIENT'
        : 'SYSTEM',
      npcKey:               actorKey,
      delayMs:              delay,
      requiredChannel:      actorKey ? resolveNpcChannel(actorKey, primaryChannel, modePolicy) : primaryChannel,
      skippable:            false,
      canInterrupt:         !isReckoning,
      canBeInterrupted:     true,
      payloadHint:          isCallback   ? 'callback-close'
                          : isHelper     ? 'rescue-close'
                          : isReckoning  ? 'reckoning-final'
                          : 'scene-close',
      targetPressure:       pressure,
      callbackAnchorIds:    anchorIds,
      rhetoricalTemplateIds: isCallback ? ['callback-close', 'memory-seal'] : ['scene-close'],
      semanticClusterIds:   ['closure', archetype.toLowerCase()],
      messageKind:          (isHelper ? 'HELPER_RESCUE' : isCallback ? 'QUOTE_CALLBACK' : 'BOT_TAUNT') as unknown as ChatMessageBody,
      typingTheaterEnabled: actorKey
        ? (CHAT_ALL_NPC_DESCRIPTORS[actorKey]?.typingHints.supportsTypingAbortTheater ?? false)
        : false,
      silenceIntentional:   false,
      proofBindable:        true,
    });
  }

  return beats;
}

// ============================================================================
// MARK: Archive payload serializer
// ============================================================================

function buildArchiveMeta(
  sceneId:    ChatSceneId,
  plan:       Pick<ChatScenePlan, 'momentType' | 'archetype' | 'expectedDurationMs'>,
  beats:      readonly ChatSceneBeat[],
  cast:       readonly ChatSceneCastEntry[],
  anchors:    readonly ChatMemoryAnchorId[],
  plannerSeed: number,
  now:        UnixMs,
  proofCtx?:  ChatScenePlannerInput['proofContext'],
): ChatSceneArchiveMeta {
  const castKeys = cast.map((c) => c.npcKey);
  const replay   = JSON.stringify({
    v:          1,
    sceneId,
    archetype:  plan.archetype,
    momentType: plan.momentType,
    castKeys,
    anchorIds:  anchors,
    beatCount:  beats.length,
    seed:       plannerSeed,
    generatedAt: now,
  });

  return {
    sceneId,
    version:       CHAT_SCENE_PLANNER_VERSION,
    momentType:    plan.momentType,
    archetype:     plan.archetype,
    plannerSeed,
    generatedAt:   now,
    proofContext:  proofCtx,
    beatCount:     beats.length,
    castKeys,
    anchorIds:     anchors,
    durationMs:    plan.expectedDurationMs,
    replayPayload: replay,
  };
}

// ============================================================================
// MARK: ChatScenePlanner — the sovereign director
// ============================================================================

export interface ChatScenePlannerOptions {
  readonly maxBeatsPerScene?:    number;
  readonly maxCallbackAnchors?:  number;
  readonly antiRepeatEnabled?:   boolean;
  readonly antiRepeatWindowMs?:  number;
  readonly logger?: {
    debug(msg: string, ctx?: Record<string, unknown>): void;
    warn(msg: string,  ctx?: Record<string, unknown>): void;
  };
}

export class ChatScenePlanner {
  private readonly opts: Required<Omit<ChatScenePlannerOptions, 'logger'>>;
  private readonly logger?: ChatScenePlannerOptions['logger'];

  // Anti-repeat LRU: scene archetype → last fired at (UnixMs)
  private readonly archetypeCooldowns = new Map<ChatSceneArchetype, number>();
  private readonly npcCooldowns       = new Map<ChatKnownNpcKey, number>();

  constructor(options: ChatScenePlannerOptions = {}) {
    this.opts = {
      maxBeatsPerScene:   options.maxBeatsPerScene   ?? CHAT_SCENE_PLANNER_DEFAULTS.maxBeatsPerScene,
      maxCallbackAnchors: options.maxCallbackAnchors ?? CHAT_SCENE_PLANNER_DEFAULTS.maxCallbackAnchors,
      antiRepeatEnabled:  options.antiRepeatEnabled  ?? true,
      antiRepeatWindowMs: options.antiRepeatWindowMs ?? CHAT_SCENE_PLANNER_DEFAULTS.antiRepeatCooldownMs,
    };
    this.logger = options.logger;
  }

  // ── PUBLIC: Plan a scene ──────────────────────────────────────────────────

  public plan(input: ChatScenePlannerInput): ChatScenePlannerDecision {
    const planStart = Date.now();

    const modeKey   = input.modeScope ?? 'DEFAULT';
    const policy    = (MODE_SCENE_POLICIES[modeKey] ?? MODE_SCENE_POLICIES.DEFAULT)!;
    const archetype = this.chooseArchetype(input.momentType, modeKey);
    const grammar   = ARCHETYPE_BEAT_GRAMMARS[archetype];

    // Build planner seed from stable inputs for determinism
    const plannerSeed = hashSeed(
      `${input.playerId}|${input.roomId}|${input.momentId}|${input.momentType}|${archetype}|${input.now}`,
    );

    // Anti-repeat suppression
    const antiRepeatSuppressed = this.opts.antiRepeatEnabled
      ? this.buildAntiRepeatSuppressedList(input.now, input.suppressedNpcKeys ?? [])
      : (input.suppressedNpcKeys ?? []);

    // Cast selection
    const haters  = selectHaterCast(archetype, modeKey, input.pressureTier, input.primaryChannel, input.relationshipState, input.audienceHeat, antiRepeatSuppressed, policy, plannerSeed);
    const helper  = selectHelperCast(archetype, modeKey, input.pressureTier, input.relationshipState, antiRepeatSuppressed, policy, plannerSeed);
    const ambient = selectAmbientCast(policy, antiRepeatSuppressed, plannerSeed);

    // Memory anchors
    const topAnchors    = selectTopAnchors(input.memoryAnchors, this.opts.maxCallbackAnchors);
    const callbackAnchorIds = topAnchors.map((a) => a.anchorId);

    // Scene ID
    const sceneId = `scene:${input.roomId}:${input.momentId}:${plannerSeed.toString(16)}` as ChatSceneId;

    // Beat construction
    const beats = buildBeats(
      sceneId, archetype, grammar,
      haters, helper, ambient,
      callbackAnchorIds, input.primaryChannel, policy,
      input.pressureTier, modeKey,
      policy.escalationSpeedMultiplier,
    ).slice(0, this.opts.maxBeatsPerScene);

    // Cast manifest
    const castManifest = buildCastManifest(
      haters, helper, ambient,
      input.primaryChannel, policy,
      antiRepeatSuppressed,
      input.relationshipState,
    );

    const speakerOrder = castManifest.map((e) => e.npcKey);

    const expectedDurationMs = beats.reduce((sum, b) => sum + b.delayMs + (b.durationMs ?? 0), 0)
      + (grammar.minDurationMs * 0.3);

    const planningTags = [
      archetype,
      input.momentType,
      input.primaryChannel,
      modeKey,
      input.pressureTier,
      ...(input.tickTier ? [input.tickTier] : []),
    ];

    const plan: ChatScenePlan = {
      sceneId,
      momentId:                          input.momentId,
      momentType:                        input.momentType,
      archetype,
      primaryChannel:                    input.primaryChannel,
      modeScope:                         input.modeScope,
      beats,
      startedAt:                         input.now,
      expectedDurationMs:                Math.round(expectedDurationMs),
      allowPlayerComposerDuringScene:    grammar.composerAllowed && !policy.composerSuppressedDuring,
      cancellableByAuthoritativeEvent:   grammar.cancellable,
      speakerOrder,
      escalationPoints:                  grammar.escalationPoints,
      silenceWindowsMs:                  grammar.silenceWindowsMs,
      callbackAnchorIds,
      possibleBranchPoints:              [`${sceneId}:branch:1`],
      planningTags,
      modePolicy:                        policy,
      castManifest,
      archivable:                        true,
      proofBindable:                     beats.some((b) => b.proofBindable),
      replayEligible:                    grammar.cancellable,
    };

    // Archive meta
    const archiveMeta = buildArchiveMeta(
      sceneId, plan, beats, castManifest,
      callbackAnchorIds, plannerSeed, input.now, input.proofContext,
    );

    // Update anti-repeat cooldowns
    if (this.opts.antiRepeatEnabled) {
      this.archetypeCooldowns.set(archetype, Number(input.now));
      for (const nKey of speakerOrder) {
        this.npcCooldowns.set(nKey, Number(input.now));
      }
    }

    const planDurationMs = Date.now() - planStart;
    const telemetry: ChatScenePlannerTelemetry = {
      planDurationMs,
      archetypeChosen:    archetype,
      castSize:           speakerOrder.length,
      suppressedCount:    antiRepeatSuppressed.length,
      anchorCount:        callbackAnchorIds.length,
      modePolicied:       modeKey !== 'DEFAULT',
      relationshipDriven: castManifest.some((e) => e.relationshipDriven),
      heatBoosted:        policy.audienceHeatInfluence !== 'NONE' && !!input.audienceHeat,
      antiRepeatApplied:  this.opts.antiRepeatEnabled && antiRepeatSuppressed.length > 0,
    };

    this.logger?.debug('[ChatScenePlanner] plan complete', {
      sceneId,
      archetype,
      modeKey,
      beatCount: beats.length,
      castSize:  speakerOrder.length,
      planDurationMs,
    });

    return {
      plan,
      chosenSpeakerIds:        speakerOrder,
      chosenCallbackAnchorIds: callbackAnchorIds,
      chosenTags:              planningTags,
      archiveMeta,
      telemetry,
    };
  }

  // ── PUBLIC: Look-ahead mode — dry-run without mutating cooldowns ──────────

  public planProbeOnly(input: ChatScenePlannerInput): ChatScenePlannerDecision {
    const saved = new Map(this.archetypeCooldowns);
    const savedNpc = new Map(this.npcCooldowns);
    const result = this.plan(input);
    // Restore cooldowns
    this.archetypeCooldowns.clear();
    for (const [k, v] of saved) this.archetypeCooldowns.set(k, v);
    this.npcCooldowns.clear();
    for (const [k, v] of savedNpc) this.npcCooldowns.set(k, v);
    return result;
  }

  // ── PUBLIC: Export planner state snapshot ────────────────────────────────

  public snapshotCooldowns(): {
    readonly archetypeCooldowns: Readonly<Record<string, number>>;
    readonly npcCooldowns:       Readonly<Record<string, number>>;
  } {
    return {
      archetypeCooldowns: Object.fromEntries(this.archetypeCooldowns),
      npcCooldowns:       Object.fromEntries(this.npcCooldowns),
    };
  }

  // ── PUBLIC: Reset cooldowns (between runs) ───────────────────────────────

  public resetCooldowns(): void {
    this.archetypeCooldowns.clear();
    this.npcCooldowns.clear();
  }

  // ── PUBLIC: Check if archetype is on cooldown ────────────────────────────

  public isArchetypeCooledDown(archetype: ChatSceneArchetype, now: UnixMs): boolean {
    const lastFired = this.archetypeCooldowns.get(archetype);
    if (lastFired === undefined) return true;
    return Number(now) - lastFired >= this.opts.antiRepeatWindowMs;
  }

  // ── PUBLIC: Manual archetype override for authoring tools ────────────────

  public planWithArchetypeOverride(
    input: ChatScenePlannerInput,
    archetypeOverride: ChatSceneArchetype,
  ): ChatScenePlannerDecision {
    const patchedInput: ChatScenePlannerInput = {
      ...input,
      // We encode the override in the momentId to keep the hash stable
      momentId: `${input.momentId}:override:${archetypeOverride}` as ChatMomentId,
    };
    return this.plan(patchedInput);
  }

  // ── PRIVATE: Archetype resolution ─────────────────────────────────────────

  private chooseArchetype(
    momentType: ChatMomentType,
    modeScope:  string,
  ): ChatSceneArchetype {
    // Mode-specific override first
    const modeOverrides = MODE_ARCHETYPE_OVERRIDES[modeScope];
    if (modeOverrides) {
      const override = modeOverrides[momentType];
      if (override) {
        // Anti-repeat: if this archetype is on cooldown, fall back to base
        if (!this.opts.antiRepeatEnabled || this.isArchetypeCooledDown(override, Date.now() as UnixMs)) {
          return override;
        }
      }
    }
    // Base mapping
    return MOMENT_TYPE_TO_ARCHETYPE[momentType] ?? 'PUBLIC_HUMILIATION_SCENE';
  }

  // ── PRIVATE: Anti-repeat suppression list ─────────────────────────────────

  private buildAntiRepeatSuppressedList(
    now:        UnixMs,
    explicit:   readonly ChatKnownNpcKey[],
  ): readonly ChatKnownNpcKey[] {
    const suppressed = new Set<ChatKnownNpcKey>(explicit);

    for (const [npcKey, lastFired] of this.npcCooldowns) {
      if (Number(now) - lastFired < this.opts.antiRepeatWindowMs) {
        suppressed.add(npcKey);
      }
    }

    return [...suppressed];
  }
}

// ============================================================================
// MARK: Factory
// ============================================================================

export function createChatScenePlanner(options?: ChatScenePlannerOptions): ChatScenePlanner {
  return new ChatScenePlanner(options);
}

// ============================================================================
// MARK: Standalone helpers for testing and authoring tools
// ============================================================================

/**
 * Derive the archetype that would be chosen for a given moment + mode
 * without constructing a full planner instance.
 */
export function deriveSceneArchetype(
  momentType: ChatMomentType,
  modeScope?: ChatModeScope | string,
): ChatSceneArchetype {
  const modeKey = modeScope ?? 'DEFAULT';
  const modeOverrides = MODE_ARCHETYPE_OVERRIDES[modeKey];
  if (modeOverrides) {
    const override = modeOverrides[momentType];
    if (override) return override;
  }
  return MOMENT_TYPE_TO_ARCHETYPE[momentType] ?? 'PUBLIC_HUMILIATION_SCENE';
}

/**
 * List all beats in an archetype's grammar — useful for tooling / authoring.
 */
export function getArchetypeBeatGrammar(archetype: ChatSceneArchetype): ArchetypeBeatGrammar {
  return ARCHETYPE_BEAT_GRAMMARS[archetype];
}

/**
 * Get the mode policy for a given mode scope.
 */
export function getModeScenePolicy(modeScope: ChatModeScope | string | 'DEFAULT'): ChatSceneModePolicy {
  return MODE_SCENE_POLICIES[modeScope] ?? MODE_SCENE_POLICIES.DEFAULT;
}

/**
 * Quick weight preview for a hater in a given context — used by HaterResponseOrchestrator
 * to sanity-check selection decisions.
 */
export function previewHaterWeight(
  npcKey:    ChatHaterNpcKey,
  archetype: ChatSceneArchetype,
  modeScope: string,
  pressure:  ChatPressureTier,
  channel:   ChatChannelId,
): number {
  const entry = HATER_WEIGHT_TABLE.find((e) => e.npcKey === npcKey);
  if (!entry) return 0;
  return Math.max(0,
    entry.baseWeight
    + (entry.archetypeBias[archetype] ?? 0)
    + (entry.modeBias[modeScope]       ?? 0)
    + (entry.pressureBias[pressure]    ?? 0)
    + (entry.channelBias[channel]      ?? 0),
  );
}

/**
 * Quick weight preview for a helper in a given context.
 */
export function previewHelperWeight(
  npcKey:    ChatHelperNpcKey,
  archetype: ChatSceneArchetype,
  modeScope: string,
  pressure:  ChatPressureTier,
): number {
  const entry = HELPER_WEIGHT_TABLE.find((e) => e.npcKey === npcKey);
  if (!entry) return 0;
  return Math.max(0,
    entry.baseWeight
    + (entry.archetypeBias[archetype] ?? 0)
    + (entry.modeBias[modeScope]       ?? 0)
    + (entry.pressureBias[pressure]    ?? 0),
  );
}

// ============================================================================
// ============================================================================
// MARK: Scene branching policy
// ============================================================================

export const CHAT_SCENE_BEAT_RESPONSE_ROUTING: Readonly<Record<ChatSceneBeatType, {
  readonly onPlayerResponse:  ChatSceneBeatType | null;
  readonly onPlayerSilence:   ChatSceneBeatType | null;
  readonly onHelperIntercept: ChatSceneBeatType | null;
}>> = Object.freeze({
  HATER_ENTRY:          { onPlayerResponse: 'PLAYER_REPLY_WINDOW', onPlayerSilence: 'ESCALATION_SPIKE', onHelperIntercept: 'HELPER_INTERVENTION' },
  HELPER_INTERVENTION:  { onPlayerResponse: null, onPlayerSilence: null, onHelperIntercept: null },
  PLAYER_REPLY_WINDOW:  { onPlayerResponse: 'CALLBACK_REVEAL', onPlayerSilence: 'ESCALATION_SPIKE', onHelperIntercept: 'HELPER_INTERVENTION' },
  CROWD_WITNESS_BURST:  { onPlayerResponse: null, onPlayerSilence: 'SILENCE_WINDOW', onHelperIntercept: null },
  CALLBACK_REVEAL:      { onPlayerResponse: 'PLAYER_REPLY_WINDOW', onPlayerSilence: 'SILENCE_WINDOW', onHelperIntercept: null },
  ESCALATION_SPIKE:     { onPlayerResponse: 'PLAYER_REPLY_WINDOW', onPlayerSilence: 'CALLBACK_REVEAL', onHelperIntercept: 'HELPER_INTERVENTION' },
  SILENCE_WINDOW:       { onPlayerResponse: 'HATER_ENTRY', onPlayerSilence: 'HATER_ENTRY', onHelperIntercept: null },
  AMBIENT_ECHO:         { onPlayerResponse: null, onPlayerSilence: null, onHelperIntercept: null },
  DEAL_ROOM_PRESSURE:   { onPlayerResponse: 'SILENCE_WINDOW', onPlayerSilence: 'ESCALATION_SPIKE', onHelperIntercept: null },
  GHOST_MARKER_REVEAL:  { onPlayerResponse: 'CALLBACK_REVEAL', onPlayerSilence: 'SILENCE_WINDOW', onHelperIntercept: null },
  RESCUE_OFFER:         { onPlayerResponse: null, onPlayerSilence: null, onHelperIntercept: null },
  WAR_ALERT:            { onPlayerResponse: 'PLAYER_REPLY_WINDOW', onPlayerSilence: 'HATER_ENTRY', onHelperIntercept: null },
  DEFECTION_SIGNAL:     { onPlayerResponse: 'WAR_ALERT', onPlayerSilence: 'ESCALATION_SPIKE', onHelperIntercept: 'HELPER_INTERVENTION' },
  RECKONING_CLOSE:      { onPlayerResponse: null, onPlayerSilence: null, onHelperIntercept: null },
});

// ============================================================================
// MARK: Proof binding policy per beat type
// ============================================================================

export const BEAT_PROOF_BINDING: Readonly<Record<ChatSceneBeatType, {
  readonly bindable:        boolean;
  readonly requiresChain:   boolean;
  readonly transcriptGrade: 'DURABLE' | 'EPHEMERAL' | 'SHADOW_ONLY';
}>> = Object.freeze({
  HATER_ENTRY:          { bindable: true,  requiresChain: false, transcriptGrade: 'DURABLE' },
  HELPER_INTERVENTION:  { bindable: true,  requiresChain: false, transcriptGrade: 'DURABLE' },
  PLAYER_REPLY_WINDOW:  { bindable: false, requiresChain: false, transcriptGrade: 'EPHEMERAL' },
  CROWD_WITNESS_BURST:  { bindable: false, requiresChain: false, transcriptGrade: 'EPHEMERAL' },
  CALLBACK_REVEAL:      { bindable: true,  requiresChain: true,  transcriptGrade: 'DURABLE' },
  ESCALATION_SPIKE:     { bindable: true,  requiresChain: false, transcriptGrade: 'DURABLE' },
  SILENCE_WINDOW:       { bindable: false, requiresChain: false, transcriptGrade: 'SHADOW_ONLY' },
  AMBIENT_ECHO:         { bindable: false, requiresChain: false, transcriptGrade: 'EPHEMERAL' },
  DEAL_ROOM_PRESSURE:   { bindable: true,  requiresChain: true,  transcriptGrade: 'DURABLE' },
  GHOST_MARKER_REVEAL:  { bindable: true,  requiresChain: true,  transcriptGrade: 'DURABLE' },
  RESCUE_OFFER:         { bindable: true,  requiresChain: false, transcriptGrade: 'DURABLE' },
  WAR_ALERT:            { bindable: true,  requiresChain: false, transcriptGrade: 'DURABLE' },
  DEFECTION_SIGNAL:     { bindable: true,  requiresChain: true,  transcriptGrade: 'DURABLE' },
  RECKONING_CLOSE:      { bindable: true,  requiresChain: true,  transcriptGrade: 'DURABLE' },
});

// ============================================================================
// MARK: Typing theater config per beat type
// ============================================================================

export const BEAT_TYPING_THEATER: Readonly<Record<ChatSceneBeatType, {
  readonly fakeStartChance:  number;
  readonly fakeStopChance:   number;
  readonly readBeforeReply:  number;
  readonly hoverBeforeEntry: number;
}>> = Object.freeze({
  HATER_ENTRY:          { fakeStartChance: 0.04, fakeStopChance: 0.03, readBeforeReply: 0.30, hoverBeforeEntry: 0.20 },
  HELPER_INTERVENTION:  { fakeStartChance: 0.06, fakeStopChance: 0.06, readBeforeReply: 0.60, hoverBeforeEntry: 0.40 },
  PLAYER_REPLY_WINDOW:  { fakeStartChance: 0.00, fakeStopChance: 0.00, readBeforeReply: 0.00, hoverBeforeEntry: 0.00 },
  CROWD_WITNESS_BURST:  { fakeStartChance: 0.02, fakeStopChance: 0.02, readBeforeReply: 0.15, hoverBeforeEntry: 0.10 },
  CALLBACK_REVEAL:      { fakeStartChance: 0.08, fakeStopChance: 0.08, readBeforeReply: 0.55, hoverBeforeEntry: 0.60 },
  ESCALATION_SPIKE:     { fakeStartChance: 0.03, fakeStopChance: 0.02, readBeforeReply: 0.20, hoverBeforeEntry: 0.10 },
  SILENCE_WINDOW:       { fakeStartChance: 0.00, fakeStopChance: 0.00, readBeforeReply: 0.00, hoverBeforeEntry: 0.00 },
  AMBIENT_ECHO:         { fakeStartChance: 0.02, fakeStopChance: 0.01, readBeforeReply: 0.10, hoverBeforeEntry: 0.05 },
  DEAL_ROOM_PRESSURE:   { fakeStartChance: 0.10, fakeStopChance: 0.10, readBeforeReply: 0.70, hoverBeforeEntry: 0.80 },
  GHOST_MARKER_REVEAL:  { fakeStartChance: 0.05, fakeStopChance: 0.05, readBeforeReply: 0.40, hoverBeforeEntry: 0.50 },
  RESCUE_OFFER:         { fakeStartChance: 0.06, fakeStopChance: 0.04, readBeforeReply: 0.50, hoverBeforeEntry: 0.35 },
  WAR_ALERT:            { fakeStartChance: 0.00, fakeStopChance: 0.00, readBeforeReply: 0.05, hoverBeforeEntry: 0.05 },
  DEFECTION_SIGNAL:     { fakeStartChance: 0.12, fakeStopChance: 0.12, readBeforeReply: 0.65, hoverBeforeEntry: 0.70 },
  RECKONING_CLOSE:      { fakeStartChance: 0.03, fakeStopChance: 0.03, readBeforeReply: 0.35, hoverBeforeEntry: 0.25 },
});

// ============================================================================
// MARK: Scene telemetry event names and telemetry helpers
// ============================================================================

export const CHAT_SCENE_TELEMETRY_EVENTS = [
  'SCENE_PLANNED',
  'SCENE_STARTED',
  'BEAT_FIRED',
  'BEAT_SKIPPED',
  'BEAT_INTERRUPTED',
  'SCENE_COMPLETED',
  'CAST_SELECTED',
  'ANCHOR_BOUND',
  'ANTI_REPEAT_APPLIED',
  'MODE_POLICY_APPLIED',
  'RELATIONSHIP_BOOST_APPLIED',
] as const;

export type ChatSceneTelemetryEventName = (typeof CHAT_SCENE_TELEMETRY_EVENTS)[number];

export interface ChatSceneTelemetryRecord {
  readonly eventName:   ChatSceneTelemetryEventName;
  readonly sceneId:     ChatSceneId;
  readonly archetype:   ChatSceneArchetype;
  readonly momentType:  ChatMomentType;
  readonly modeScope?:  ChatModeScope;
  readonly beatId?:     string;
  readonly beatType?:   ChatSceneBeatType;
  readonly castKeys?:   readonly ChatKnownNpcKey[];
  readonly anchorIds?:  readonly ChatMemoryAnchorId[];
  readonly durationMs?: number;
  readonly at:          UnixMs;
  readonly extra?:      Readonly<Record<string, unknown>>;
}

export function buildScenePlannedTelemetry(
  decision: ChatScenePlannerDecision,
  now: UnixMs,
): ChatSceneTelemetryRecord {
  return {
    eventName:  'SCENE_PLANNED',
    sceneId:    decision.plan.sceneId,
    archetype:  decision.plan.archetype,
    momentType: decision.plan.momentType,
    modeScope:  decision.plan.modeScope,
    castKeys:   decision.chosenSpeakerIds,
    anchorIds:  decision.chosenCallbackAnchorIds,
    durationMs: decision.plan.expectedDurationMs,
    at:         now,
    extra: {
      beatCount:         decision.plan.beats.length,
      plannerSeed:       decision.archiveMeta.plannerSeed,
      planDurationMs:    decision.telemetry.planDurationMs,
      antiRepeatApplied: decision.telemetry.antiRepeatApplied,
    },
  };
}

export function buildBeatFiredTelemetry(
  sceneId:    ChatSceneId,
  archetype:  ChatSceneArchetype,
  momentType: ChatMomentType,
  beat:       ChatSceneBeat,
  at:         UnixMs,
): ChatSceneTelemetryRecord {
  return {
    eventName:  'BEAT_FIRED',
    sceneId,
    archetype,
    momentType,
    beatId:     beat.beatId,
    beatType:   beat.beatType,
    castKeys:   beat.actorId ? [beat.actorId] : [],
    anchorIds:  beat.callbackAnchorIds ?? [],
    at,
  };
}

// MARK: Namespace export
// ============================================================================

export const CHAT_SCENE_PLANNER_NAMESPACE = Object.freeze({
  moduleName:    CHAT_SCENE_PLANNER_MODULE_NAME,
  version:       CHAT_SCENE_PLANNER_VERSION,
  laws:          CHAT_SCENE_PLANNER_RUNTIME_LAWS,
  defaults:      CHAT_SCENE_PLANNER_DEFAULTS,
  archetypes:    CHAT_SCENE_ARCHETYPES,
  beatTypes:     CHAT_SCENE_BEAT_TYPES,
  // Entry points
  createChatScenePlanner,
  deriveSceneArchetype,
  getArchetypeBeatGrammar,
  getModeScenePolicy,
  previewHaterWeight,
  previewHelperWeight,
} as const);