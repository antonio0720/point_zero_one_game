/**
 * ============================================================================
 * POINT ZERO ONE — SHARED CHAT SCENE CONTRACTS
 * FILE: shared/contracts/chat/scene.ts
 * ============================================================================
 *
 * Shared contract surface for authored scene planning across frontend/runtime
 * and backend/authoritative orchestration.
 * ============================================================================
 */

export type SharedChatMomentType =
  | 'RUN_START'
  | 'RUN_END'
  | 'PRESSURE_SURGE'
  | 'SHIELD_BREACH'
  | 'CASCADE_TRIGGER'
  | 'CASCADE_BREAK'
  | 'BOT_ATTACK'
  | 'BOT_RETREAT'
  | 'HELPER_RESCUE'
  | 'DEAL_ROOM_STANDOFF'
  | 'SOVEREIGN_APPROACH'
  | 'SOVEREIGN_ACHIEVED'
  | 'LEGEND_MOMENT'
  | 'WORLD_EVENT';

export type SharedChatSceneArchetype =
  | 'BREACH_SCENE'
  | 'TRAP_SCENE'
  | 'RESCUE_SCENE'
  | 'PUBLIC_HUMILIATION_SCENE'
  | 'COMEBACK_WITNESS_SCENE'
  | 'DEAL_ROOM_PRESSURE_SCENE'
  | 'FALSE_CALM_SCENE'
  | 'END_OF_RUN_RECKONING_SCENE'
  | 'LONG_ARC_CALLBACK_SCENE'
  | 'SEASON_EVENT_INTRUSION_SCENE';

export type SharedChatSceneRole =
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

export type SharedChatSceneBeatType =
  | 'SYSTEM_NOTICE'
  | 'HATER_ENTRY'
  | 'CROWD_SWARM'
  | 'HELPER_INTERVENTION'
  | 'PLAYER_REPLY_WINDOW'
  | 'SILENCE'
  | 'REVEAL'
  | 'POST_BEAT_ECHO';

export type SharedChatChannelId =
  | 'GLOBAL'
  | 'SYNDICATE'
  | 'DEAL_ROOM'
  | 'LOBBY';

export type SharedPressureTier =
  | 'CALM'
  | 'WATCHFUL'
  | 'PRESSURED'
  | 'CRITICAL'
  | 'BREAKPOINT';

export interface SharedChatRelationshipVector {
  readonly respect: number;
  readonly fear: number;
  readonly contempt: number;
  readonly fascination: number;
  readonly trust: number;
  readonly familiarity: number;
  readonly rivalryIntensity: number;
  readonly rescueDebt: number;
  readonly adviceObedience: number;
}

export interface SharedChatRelationshipState {
  readonly relationshipId: string;
  readonly playerId: string;
  readonly counterpartId: string;
  readonly counterpartKind: string;
  readonly vector: SharedChatRelationshipVector;
  readonly lastMeaningfulShiftAt: number;
  readonly callbacksAvailable: readonly string[];
  readonly escalationTier: 'NONE' | 'MILD' | 'ACTIVE' | 'OBSESSIVE';
}

export interface SharedChatMemoryAnchor {
  readonly anchorId: string;
  readonly anchorType:
    | 'QUOTE'
    | 'BREACH'
    | 'RESCUE'
    | 'COMEBACK'
    | 'DEAL_ROOM'
    | 'SOVEREIGNTY'
    | 'HUMILIATION';
  readonly roomId: string;
  readonly channelId: SharedChatChannelId;
  readonly messageIds: readonly string[];
  readonly salience: number;
  readonly createdAt: number;
  readonly embeddingKey?: string;
}

export interface SharedChatSceneBeat {
  readonly beatId: string;
  readonly beatType: SharedChatSceneBeatType;
  readonly sceneRole: SharedChatSceneRole;
  readonly actorId?: string;
  readonly actorKind?: string;
  readonly delayMs: number;
  readonly requiredChannel: SharedChatChannelId;
  readonly skippable: boolean;
  readonly canInterrupt: boolean;
  readonly payloadHint?: string;
  readonly targetPressure?: SharedPressureTier;
  readonly callbackAnchorIds?: readonly string[];
  readonly rhetoricalTemplateIds?: readonly string[];
  readonly semanticClusterIds?: readonly string[];
}

export interface SharedChatScenePlan {
  readonly sceneId: string;
  readonly momentId: string;
  readonly momentType: SharedChatMomentType;
  readonly archetype: SharedChatSceneArchetype;
  readonly primaryChannel: SharedChatChannelId;
  readonly beats: readonly SharedChatSceneBeat[];
  readonly startedAt: number;
  readonly expectedDurationMs: number;
  readonly allowPlayerComposerDuringScene: boolean;
  readonly cancellableByAuthoritativeEvent: boolean;
  readonly speakerOrder: readonly string[];
  readonly escalationPoints: readonly number[];
  readonly silenceWindowsMs: readonly number[];
  readonly callbackAnchorIds: readonly string[];
  readonly possibleBranchPoints: readonly string[];
  readonly planningTags: readonly string[];
}

export interface SharedChatScenePlannerInput {
  readonly playerId: string;
  readonly roomId: string;
  readonly now: number;
  readonly momentId: string;
  readonly momentType: SharedChatMomentType;
  readonly primaryChannel: SharedChatChannelId;
  readonly pressureTier?: SharedPressureTier;
  readonly relationshipState?: readonly SharedChatRelationshipState[];
  readonly memoryAnchors?: readonly SharedChatMemoryAnchor[];
  readonly unresolvedMomentIds?: readonly string[];
  readonly carriedPersonaIds?: readonly string[];
  readonly pendingRevealPayloadIds?: readonly string[];
  readonly candidateBotIds?: readonly string[];
  readonly helperIds?: readonly string[];
  readonly worldTags?: readonly string[];
}

export interface SharedChatScenePlannerDecision {
  readonly plan: SharedChatScenePlan;
  readonly chosenSpeakerIds: readonly string[];
  readonly chosenCallbackAnchorIds: readonly string[];
  readonly chosenTags: readonly string[];
}
