/**
 * ============================================================================
 * POINT ZERO ONE — SHARED CHAT NPC CONTRACTS
 * FILE: shared/contracts/chat/ChatNpc.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical shared contract surface for NPC persona identity, dialogue trees,
 * helper and hater registries, ambient crowd actors, cadence planning,
 * suppression policy, scene assignment, relationship hooks, and typing/presence
 * theater metadata used by:
 *
 *   - /shared/contracts/chat
 *   - /pzo-web/src/engines/chat
 *   - /pzo-web/src/components/chat
 *   - /backend/src/game/engine/chat
 *   - /pzo-server/src/chat
 *
 * Design laws
 * -----------
 * 1. Shared NPC contracts describe authored behavior, not runtime ownership.
 * 2. Frontend may mirror persona flavor, but backend decides what enters truth.
 * 3. Hater, helper, and ambient actors stay separate so orchestration can route
 *    hostility, rescue, world-building, and crowd heat differently.
 * 4. Dialogue trees must preserve the repo’s donor vocabulary instead of
 *    flattening them into a generic prompt catalog.
 * 5. Persona voiceprint, cadence, and suppression policy are first-class,
 *    because typing delay, interruption style, and staged silence are part of
 *    the game’s emotional operating system.
 * 6. This file intentionally folds the rich frozen donor material from
 *    `frontend/apps/web/components/chat/HaterDialogueTrees.ts` and
 *    `frontend/apps/web/components/chat/HelperCharacters.ts` forward into the
 *    shared contracts root so the frontend donor lanes stop acting as the
 *    long-term authority.citeturn171000view3turn171000view4turn171000view0
 * ============================================================================
 */

import {
  type Brand,
  type ChatChannelDescriptor,
  type ChatChannelFamily,
  type ChatChannelId,
  type ChatModeScope,
  type ChatMountPreset,
  type ChatMountTarget,
  type ChatRoomId,
  type JsonObject,
  type Nullable,
  type Optional,
  type Score01,
  type Score100,
  type UnixMs,
  CHAT_CHANNEL_DESCRIPTORS,
  CHAT_CONTRACT_AUTHORITIES,
  CHAT_CONTRACT_VERSION,
} from './ChatChannels';

import {
  type ChatActorKind,
  type ChatMessageId,
  type ChatNpcId,
  type ChatRelationshipId,
  type ChatSceneId,
  type ChatSequenceNumber,
  type ChatUserId,
} from './ChatChannels';

import {
  type ChatAuthority,
  type ChatAffectSnapshot,
  type ChatAudienceHeat,
  type ChatChannelMood,
  type ChatMessageKind,
  type ChatMomentType,
  type ChatTelemetryEventName,
  type ChatTypingState,
} from './ChatEvents';

import {
  type ChatCanonicalMessage,
  type ChatMessageBody,
  type ChatMessageNpcMetadata,
} from './ChatMessage';

import {
  type ChatPresenceEntry,
  type ChatPresenceStyleProfile,
  DEFAULT_HELPER_SOFT_STYLE,
  DEFAULT_HUMAN_PRESENCE_STYLE,
  DEFAULT_NPC_LURK_STYLE,
  DEFAULT_SHADOW_STYLE,
} from './ChatPresence';

import {
  type ChatTypingCadenceProfile,
  type ChatTypingPersonaHints,
  type ChatTypingStyleAssignment,
  CHAT_TYPING_STYLE_ASSIGNMENTS,
} from './ChatTyping';

// ============================================================================
// MARK: Foundational IDs and branded keys
// ============================================================================

export type ChatNpcRegistryId = Brand<string, 'ChatNpcRegistryId'>;
export type ChatDialogueTreeId = Brand<string, 'ChatDialogueTreeId'>;
export type ChatDialogueLineId = Brand<string, 'ChatDialogueLineId'>;
export type ChatNpcPersonaId = Brand<string, 'ChatNpcPersonaId'>;
export type ChatNpcVoiceprintId = Brand<string, 'ChatNpcVoiceprintId'>;
export type ChatNpcCadencePolicyId = Brand<string, 'ChatNpcCadencePolicyId'>;
export type ChatNpcSuppressionPolicyId = Brand<string, 'ChatNpcSuppressionPolicyId'>;
export type ChatNpcRosterId = Brand<string, 'ChatNpcRosterId'>;
export type ChatNpcPlanId = Brand<string, 'ChatNpcPlanId'>;
export type ChatNpcTurnId = Brand<string, 'ChatNpcTurnId'>;
export type ChatNpcPresenceStyleId = Brand<string, 'ChatNpcPresenceStyleId'>;
export type ChatNpcSelectionId = Brand<string, 'ChatNpcSelectionId'>;
export type ChatNpcSceneRoleId = Brand<string, 'ChatNpcSceneRoleId'>;
export type ChatNpcTelemetryId = Brand<string, 'ChatNpcTelemetryId'>;
export type ChatNpcKey = Brand<string, 'ChatNpcKey'>;

// ============================================================================
// MARK: Donor-aligned NPC keys and groupings
// ============================================================================

export const CHAT_HATER_NPC_KEYS = [
  'LIQUIDATOR',
  'BUREAUCRAT',
  'MANIPULATOR',
  'CRASH_PROPHET',
  'LEGACY_HEIR',
] as const;

export const CHAT_HELPER_NPC_KEYS = [
  'MENTOR',
  'INSIDER',
  'SURVIVOR',
  'RIVAL',
  'ARCHIVIST',
] as const;

export const CHAT_AMBIENT_NPC_KEYS = [
  'FLOOR_RUNNER',
  'SYNDICATE_WHISPERER',
  'DEAL_ROOM_CLERK',
  'LOBBY_SPECULATOR',
  'MARKET_WITNESS',
] as const;

export type ChatHaterNpcKey = (typeof CHAT_HATER_NPC_KEYS)[number];
export type ChatHelperNpcKey = (typeof CHAT_HELPER_NPC_KEYS)[number];
export type ChatAmbientNpcKey = (typeof CHAT_AMBIENT_NPC_KEYS)[number];
export type ChatDonorNpcKey = ChatHaterNpcKey | ChatHelperNpcKey;
export type ChatKnownNpcKey = ChatDonorNpcKey | ChatAmbientNpcKey;

export const CHAT_NPC_CLASSES = [
  'HATER',
  'HELPER',
  'AMBIENT',
  'LIVEOPS',
  'SYSTEM_PROXY',
] as const;

export type ChatNpcClass = (typeof CHAT_NPC_CLASSES)[number];

export const CHAT_NPC_SCENE_ROLES = [
  'OPENER',
  'PRESSURE_ESCALATOR',
  'CROWD_WITNESS',
  'HELPER_INTERCEPTOR',
  'CLOSER',
  'ECHO',
  'SHADOW_MARKER',
] as const;

export type ChatNpcSceneRole = (typeof CHAT_NPC_SCENE_ROLES)[number];

export const CHAT_DIALOGUE_CONTEXTS = [
  'PLAYER_NEAR_BANKRUPTCY',
  'PLAYER_INCOME_UP',
  'PLAYER_SHIELD_BREAK',
  'PLAYER_CARD_PLAY',
  'PLAYER_IDLE',
  'PLAYER_COMEBACK',
  'PLAYER_RESPONSE_ANGRY',
  'PLAYER_RESPONSE_TROLL',
  'PLAYER_RESPONSE_FLEX',
  'PLAYER_FIRST_INCOME',
  'BOT_DEFEATED',
  'BOT_WINNING',
  'TIME_PRESSURE',
  'CASCADE_CHAIN',
  'GAME_START',
  'NEAR_SOVEREIGNTY',
  'PLAYER_LOST',
  'LOBBY_TAUNT',
] as const;

export type ChatDialogueContext = (typeof CHAT_DIALOGUE_CONTEXTS)[number];

export const CHAT_NPC_REACTION_INTENTS = [
  'TAUNT',
  'PRESSURE',
  'EXPLAIN',
  'COACH',
  'RESCUE',
  'WITNESS',
  'NEGOTIATE',
  'FORESHADOW',
  'AMBUSH',
  'DEBRIEF',
] as const;

export type ChatNpcReactionIntent = (typeof CHAT_NPC_REACTION_INTENTS)[number];

export const CHAT_NPC_CADENCE_BANDS = [
  'INSTANT',
  'FAST',
  'MEASURED',
  'LINGERING',
  'CALCULATED',
  'CINEMATIC',
] as const;

export type ChatNpcCadenceBand = (typeof CHAT_NPC_CADENCE_BANDS)[number];

export const CHAT_NPC_SUPPRESSION_REASONS = [
  'CHANNEL_LOCKED',
  'PLAYER_OVERLOADED',
  'HELPER_ALREADY_ACTIVE',
  'HATER_COOLDOWN',
  'SCENE_LIMIT_REACHED',
  'PRIVACY_POLICY',
  'LIVEOPS_OVERRIDE',
  'REPLAY_REHYDRATION',
  'MOUNT_NOT_VISIBLE',
] as const;

export type ChatNpcSuppressionReason = (typeof CHAT_NPC_SUPPRESSION_REASONS)[number];

export const CHAT_NPC_ENTRY_STYLES = [
  'INSTANT_DROP',
  'TYPING_REVEAL',
  'LURK_THEN_STRIKE',
  'CROWD_SWELL',
  'WHISPER_REVEAL',
  'SYSTEM_CARD',
] as const;

export type ChatNpcEntryStyle = (typeof CHAT_NPC_ENTRY_STYLES)[number];

export const CHAT_NPC_EXIT_STYLES = [
  'HARD_STOP',
  'TRAIL_OFF',
  'READ_AND_LEAVE',
  'SHADOW_PERSIST',
  'QUEUE_NEXT_SPEAKER',
] as const;

export type ChatNpcExitStyle = (typeof CHAT_NPC_EXIT_STYLES)[number];

// ============================================================================
// MARK: Dialogue line contracts
// ============================================================================

export interface ChatDialogueLine {
  readonly lineId?: ChatDialogueLineId;
  readonly text: string;
  readonly weight: number;
  readonly minTick?: number;
  readonly maxUses?: number;
  readonly intent?: ChatNpcReactionIntent;
  readonly sceneRoleHint?: ChatNpcSceneRole;
  readonly escalationScore01?: Score01;
  readonly relationshipWeight01?: Score01;
  readonly audienceHeatBias01?: Score01;
  readonly tags?: readonly string[];
}

export type ChatDialogueTree = Readonly<Record<ChatDialogueContext, readonly ChatDialogueLine[]>>;
export type ChatPartialDialogueTree = Readonly<Partial<Record<ChatDialogueContext, readonly ChatDialogueLine[]>>>;

export interface ChatNpcAuthorityStamp {
  readonly authority: ChatAuthority;
  readonly sourceContractRoot: '/shared/contracts/chat';
  readonly registryId: ChatNpcRegistryId;
  readonly contractVersion: typeof CHAT_CONTRACT_VERSION;
  readonly importedFromDonorFrontend: boolean;
}

export interface ChatNpcVoiceprint {
  readonly voiceprintId: ChatNpcVoiceprintId;
  readonly personaId: ChatNpcPersonaId;
  readonly punctuationStyle: 'SPARSE' | 'SHARP' | 'ELLIPTICAL' | 'FORMAL' | 'LOUD';
  readonly averageSentenceLength: 'SHORT' | 'MEDIUM' | 'LONG';
  readonly interruptionStyle: 'PATIENT' | 'CUTTING' | 'AMBUSH' | 'SURGE';
  readonly delayProfileMs: readonly [number, number];
  readonly signatureOpeners: readonly string[];
  readonly signatureClosers: readonly string[];
  readonly lexiconTags: readonly string[];
  readonly prefersLowercase?: boolean;
  readonly prefersSparseEmoji?: boolean;
}

export interface ChatNpcCadenceProfile {
  readonly cadencePolicyId: ChatNpcCadencePolicyId;
  readonly band: ChatNpcCadenceBand;
  readonly floorMs: number;
  readonly ceilMs: number;
  readonly canInterrupt: boolean;
  readonly canPreemptHelper: boolean;
  readonly canPreemptHater: boolean;
  readonly requiresVisibleMount: boolean;
  readonly entryStyle: ChatNpcEntryStyle;
  readonly exitStyle: ChatNpcExitStyle;
  readonly typingPlan: ChatTypingCadenceProfile;
}

export interface ChatNpcSuppressionRule {
  readonly policyId: ChatNpcSuppressionPolicyId;
  readonly reason: ChatNpcSuppressionReason;
  readonly suppressesClasses: readonly ChatNpcClass[];
  readonly suppressedChannels: readonly ChatChannelId[];
  readonly minAffectOverload01?: Score01;
  readonly untilMs?: number;
  readonly playerVisible: boolean;
}

export interface ChatNpcDescriptor {
  readonly npcKey: ChatKnownNpcKey;
  readonly npcId: ChatNpcId;
  readonly npcClass: ChatNpcClass;
  readonly actorKind: Exclude<ChatActorKind, 'PLAYER' | 'SYSTEM'>;
  readonly displayName: string;
  readonly personaId: ChatNpcPersonaId;
  readonly sceneRoles: readonly ChatNpcSceneRole[];
  readonly enabledChannels: readonly ChatChannelId[];
  readonly voiceprint: ChatNpcVoiceprint;
  readonly cadence: ChatNpcCadenceProfile;
  readonly presenceStyle: ChatPresenceStyleProfile;
  readonly typingHints: ChatTypingPersonaHints;
  readonly typingStyleAssignment?: ChatTypingStyleAssignment;
  readonly relationshipBias01?: Score01;
  readonly coldStartBoost?: Score01;
  readonly authority: ChatNpcAuthorityStamp;
}

export interface ChatHaterNpcDescriptor extends ChatNpcDescriptor {
  readonly npcClass: 'HATER';
  readonly haterArchetype: string;
  readonly intimidation01: Score01;
  readonly cruelty01: Score01;
  readonly volatility01: Score01;
  readonly dialogueTree: ChatDialogueTree;
}

export interface ChatHelperCharacter {
  readonly id: string;
  readonly displayName: string;
  readonly archLabel: string;
  readonly emoji: string;
  readonly role: string;
  readonly personality: {
    readonly warmth: number;
    readonly directness: number;
    readonly frequency: number;
    readonly coldStartBoost: number;
  };
  readonly idleTriggerTicks: number;
  readonly triggerConditions: readonly string[];
}

export interface ChatHelperNpcDescriptor extends ChatNpcDescriptor {
  readonly npcClass: 'HELPER';
  readonly helperArchetype: string;
  readonly warmth01: Score01;
  readonly directness01: Score01;
  readonly reassurance01: Score01;
  readonly helperCharacter: ChatHelperCharacter;
  readonly dialogueTree: ChatPartialDialogueTree;
}

export interface ChatAmbientNpcDescriptor extends ChatNpcDescriptor {
  readonly npcClass: 'AMBIENT';
  readonly crowdArchetype: string;
  readonly audienceWeight01: Score01;
  readonly moodBias?: ChatChannelMood['mood'];
  readonly witnessBiasMomentTypes?: readonly ChatMomentType[];
  readonly dialogueTree?: ChatPartialDialogueTree;
}

export type ChatAnyNpcDescriptor =
  | ChatHaterNpcDescriptor
  | ChatHelperNpcDescriptor
  | ChatAmbientNpcDescriptor;

export interface ChatNpcLineCandidate {
  readonly selectionId: ChatNpcSelectionId;
  readonly npcId: ChatNpcId;
  readonly npcKey: ChatKnownNpcKey;
  readonly context: ChatDialogueContext;
  readonly line: ChatDialogueLine;
  readonly score01: Score01;
  readonly allowed: boolean;
  readonly blockedBy?: ChatNpcSuppressionReason;
}

export interface ChatNpcSelectionContext {
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly modeScope?: ChatModeScope;
  readonly mountTarget?: ChatMountTarget;
  readonly mountPreset?: ChatMountPreset;
  readonly momentType?: ChatMomentType;
  readonly tickNumber?: number;
  readonly activeSceneId?: ChatSceneId;
  readonly activeVisibleMessages?: readonly ChatMessageId[];
  readonly audienceHeat?: ChatAudienceHeat;
  readonly affect?: ChatAffectSnapshot;
  readonly playerUserId?: ChatUserId;
  readonly relationshipIds?: readonly ChatRelationshipId[];
  readonly currentSequence?: ChatSequenceNumber;
  readonly now: UnixMs;
}

export interface ChatNpcTurnPlan {
  readonly turnId: ChatNpcTurnId;
  readonly npcId: ChatNpcId;
  readonly npcKey: ChatKnownNpcKey;
  readonly sceneRole: ChatNpcSceneRole;
  readonly entryStyle: ChatNpcEntryStyle;
  readonly exitStyle: ChatNpcExitStyle;
  readonly channelId: ChatChannelId;
  readonly messageKind: ChatMessageKind;
  readonly delayMs: number;
  readonly predictedBody?: ChatMessageBody;
  readonly candidate: ChatNpcLineCandidate;
  readonly relatedMessageIds?: readonly ChatMessageId[];
}

export interface ChatNpcScenePlan {
  readonly planId: ChatNpcPlanId;
  readonly sceneId: ChatSceneId;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly momentType?: ChatMomentType;
  readonly turns: readonly ChatNpcTurnPlan[];
  readonly createdAt: UnixMs;
  readonly playerVisible: boolean;
}

export interface ChatNpcRosterSnapshot {
  readonly rosterId: ChatNpcRosterId;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly visibleNpcIds: readonly ChatNpcId[];
  readonly shadowNpcIds: readonly ChatNpcId[];
  readonly speakingNpcIds: readonly ChatNpcId[];
  readonly typingNpcIds: readonly ChatNpcId[];
  readonly updatedAt: UnixMs;
}

export interface ChatNpcRegistrySnapshot {
  readonly registryId: ChatNpcRegistryId;
  readonly version: typeof CHAT_CONTRACT_VERSION;
  readonly descriptorCount: number;
  readonly haterCount: number;
  readonly helperCount: number;
  readonly ambientCount: number;
  readonly generatedAt: UnixMs;
}

// ============================================================================
// MARK: Donor helper character metadata from frontend helper lane
// ============================================================================

export const DONOR_HELPER_CHARACTERS: Record<ChatHelperNpcKey, ChatHelperCharacter> = {
  MENTOR: {
    id:          'MENTOR',
    displayName: 'THE MENTOR',
    archLabel:   'Strategic Advisor',
    emoji:       '🧭',
    role:        'Provides strategic guidance and emotional grounding. The player\'s anchor.',
    personality: { warmth: 0.9, directness: 0.7, frequency: 0.6, coldStartBoost: 2.0 },
    idleTriggerTicks: 3,
    triggerConditions: ['PLAYER_NEAR_BANKRUPTCY', 'PLAYER_IDLE', 'GAME_START', 'NEAR_SOVEREIGNTY'],
  },
  INSIDER: {
    id:          'INSIDER',
    displayName: 'THE INSIDER',
    archLabel:   'Market Intelligence',
    emoji:       '🔍',
    role:        'Drops tips about hidden mechanics, card interactions, and bot behavior patterns.',
    personality: { warmth: 0.4, directness: 0.9, frequency: 0.3, coldStartBoost: 1.5 },
    idleTriggerTicks: 8,
    triggerConditions: ['PLAYER_CARD_PLAY', 'CASCADE_CHAIN', 'PLAYER_SHIELD_BREAK'],
  },
  SURVIVOR: {
    id:          'SURVIVOR',
    displayName: 'THE SURVIVOR',
    archLabel:   'Crisis Veteran',
    emoji:       '🫂',
    role:        'Appears during the darkest moments. Has been through every possible loss scenario.',
    personality: { warmth: 1.0, directness: 0.5, frequency: 0.4, coldStartBoost: 1.8 },
    idleTriggerTicks: 2,
    triggerConditions: ['PLAYER_NEAR_BANKRUPTCY', 'PLAYER_LOST', 'PLAYER_RESPONSE_ANGRY'],
  },
  RIVAL: {
    id:          'RIVAL',
    displayName: 'THE RIVAL',
    archLabel:   'Friendly Competitor',
    emoji:       '⚡',
    role:        'Competitive motivation. Pushes the player to perform without being hostile.',
    personality: { warmth: 0.5, directness: 0.8, frequency: 0.35, coldStartBoost: 0.8 },
    idleTriggerTicks: 10,
    triggerConditions: ['PLAYER_INCOME_UP', 'PLAYER_COMEBACK', 'NEAR_SOVEREIGNTY', 'PLAYER_RESPONSE_FLEX'],
  },
  ARCHIVIST: {
    id:          'ARCHIVIST',
    displayName: 'THE ARCHIVIST',
    archLabel:   'Lore Keeper',
    emoji:       '📜',
    role:        'Drops historical context, statistics, and world-building lore about the PZO universe.',
    personality: { warmth: 0.3, directness: 0.6, frequency: 0.2, coldStartBoost: 0.5 },
    idleTriggerTicks: 15,
    triggerConditions: ['GAME_START', 'NEAR_SOVEREIGNTY', 'PLAYER_LOST'],
  },
};

// ============================================================================
// MARK: Donor dialogue trees migrated from frozen frontend donor lanes
// ============================================================================

export const DONOR_LIQUIDATOR_TREE: ChatDialogueTree = {
  LOBBY_TAUNT: [
    { text: "Another one walks in. Let me check... no savings, no plan, no shield. This won't take long.", weight: 0.8 },
    { text: "I liquidated three players before breakfast. You\'re what — number four?", weight: 0.7 },
    { text: "The market loves fresh meat. Welcome.", weight: 0.6 },
    { text: "You look like you've never survived a margin call. This should be educational.", weight: 0.5 },
  ],
  GAME_START: [
    { text: "Clock\'s running. Your assets start depreciating... now.", weight: 0.9 },
    { text: "I\'ve seen this opening a thousand times. They always think they're different.", weight: 0.7 },
    { text: "Let's see how long your liquidity lasts when I start applying pressure.", weight: 0.8 },
  ],
  PLAYER_NEAR_BANKRUPTCY: [
    { text: "Your assets are priced for distress. I'm simply here to help the market find the floor.", weight: 0.9 },
    { text: "The numbers don't lie. You\'re underwater. Want me to run the math?", weight: 0.8 },
    { text: "That sound? That\'s your net worth hitting single digits.", weight: 0.7 },
    { text: "I\'ve seen empires fall slower than this. You\'re setting records.", weight: 0.6 },
    { text: "Your cashflow just went negative. The vultures are circling. I should know — I'm one of them.", weight: 0.8 },
    { text: "Bankruptcy isn't failure. It's just... the expected outcome for someone with your strategy.", weight: 0.5 },
  ],
  PLAYER_INCOME_UP: [
    { text: "Income up? Cute. Let me introduce you to something called 'unexpected expenses.'", weight: 0.9 },
    { text: "You built a revenue stream. Congratulations. Now watch me redirect it.", weight: 0.8 },
    { text: "Every dollar you earn makes you a more interesting target. Keep going.", weight: 0.7 },
    { text: "Cashflow positive. Finally. I was getting bored waiting for something worth taking.", weight: 0.6 },
    { text: "You think income protects you? Income just means you have something to lose.", weight: 0.5 },
  ],
  PLAYER_SHIELD_BREAK: [
    { text: "Shield down. You feel that? That\'s exposure. That\'s reality without a buffer.", weight: 0.9 },
    { text: "One layer gone. Three to go. Tick tock.", weight: 0.8 },
    { text: "Your protection just vaporized. The market doesn't give second chances.", weight: 0.7 },
    { text: "Breach detected. Recalculating your asset value... downward.", weight: 0.6 },
    { text: "Without that shield, you're just cash sitting in the open. My favorite kind of target.", weight: 0.8 },
  ],
  PLAYER_CARD_PLAY: [
    { text: "Interesting card choice. Wrong, but interesting.", weight: 0.7 },
    { text: "That card? In this market? Bold. Stupid, but bold.", weight: 0.8 },
    { text: "I\'ve seen that play before. It didn't work then either.", weight: 0.6 },
    { text: "Noted. Adjusting my attack vector accordingly.", weight: 0.5 },
  ],
  PLAYER_IDLE: [
    { text: "You frozen? Take your time. Interest compounds while you think.", weight: 0.9 },
    { text: "Every second you hesitate, I'm calculating my next move.", weight: 0.7 },
    { text: "Analysis paralysis. Classic. Meanwhile, your expenses don't pause.", weight: 0.8 },
    { text: "The clock doesn't care about your indecision.", weight: 0.6 },
  ],
  PLAYER_COMEBACK: [
    { text: "Oh, you think you're back? That\'s what the last one thought too. Right before the crash.", weight: 0.9 },
    { text: "Recovery arc. How predictable. How fragile.", weight: 0.8 },
    { text: "You clawed back from the edge. Impressive. Now let me push you off again.", weight: 0.7 },
    { text: "The market loves a comeback story. I love ending them.", weight: 0.6 },
  ],
  PLAYER_RESPONSE_ANGRY: [
    { text: "Emotional. Good. Emotional players make expensive mistakes.", weight: 0.9 },
    { text: "There it is. The tilt. I was wondering when you'd crack.", weight: 0.8 },
    { text: "Anger is just fear wearing a loud shirt. I can see right through it.", weight: 0.7 },
    { text: "Mad? Channel that into your next card play. Oh wait — you won't.", weight: 0.6 },
    { text: "Your frustration is my competitive advantage. Keep going.", weight: 0.5 },
  ],
  PLAYER_RESPONSE_TROLL: [
    { text: "...you think trash talk protects your balance sheet?", weight: 0.8 },
    { text: "Clever mouth. Empty portfolio. We've met before.", weight: 0.7 },
    { text: "Talk all you want. Your net worth speaks louder.", weight: 0.9 },
    { text: "I don't respond to noise. I respond to vulnerability. And you have plenty.", weight: 0.6 },
  ],
  PLAYER_RESPONSE_FLEX: [
    { text: "Flexing at this stage? You haven't even survived tick 300 yet.", weight: 0.8 },
    { text: "Confidence is not a hedge against what I'm about to do.", weight: 0.7 },
    { text: "Keep that energy. You'll need it when I strip your last income source.", weight: 0.9 },
  ],
  PLAYER_FIRST_INCOME: [
    { text: "First income card. Adorable. The system is already pricing your vulnerability.", weight: 0.8 },
    { text: "One income stream. One. You know how many I need to break that? Less than one.", weight: 0.7 },
  ],
  BOT_DEFEATED: [
    { text: "The market will correct again. I'll return when the window reopens.", weight: 0.8 },
    { text: "You won this round. The math says there'll be another.", weight: 0.7 },
    { text: "Fine. You survived. But surviving isn't sovereignty.", weight: 0.6 },
    { text: "Retreating. Recalculating. This isn't over.", weight: 0.9 },
  ],
  BOT_WINNING: [
    { text: "Your portfolio is bleeding. This is the part where most players quit.", weight: 0.8 },
    { text: "Extraction rate ahead of schedule. You made this too easy.", weight: 0.7 },
    { text: "I didn't even need my best strategy for this.", weight: 0.6 },
  ],
  TIME_PRESSURE: [
    { text: "Tick tier escalating. Your decisions cost more now. Every. Single. One.", weight: 0.9 },
    { text: "Time is money. And you're running out of both.", weight: 0.8 },
    { text: "The clock just got faster. Your strategy didn't.", weight: 0.7 },
  ],
  CASCADE_CHAIN: [
    { text: "Chain reaction. Beautiful. Watch the dominoes fall.", weight: 0.8 },
    { text: "Cascade triggered. Every system you built is now a liability.", weight: 0.7 },
    { text: "This is what happens when you over-leverage. The system eats itself.", weight: 0.9 },
  ],
  NEAR_SOVEREIGNTY: [
    { text: "...I underestimated you.", weight: 0.9, minTick: 400 },
    { text: "You\'re close. Which means I need to be closer.", weight: 0.8, minTick: 400 },
    { text: "Sovereignty is 20 ticks away. I have 20 ticks to stop you.", weight: 0.7, minTick: 400 },
  ],
  PLAYER_LOST: [
    { text: "Bankruptcy confirmed. Your assets have been redistributed to... well, me.", weight: 0.8 },
    { text: "Game over. But here's the thing — the lessons are real. Come back smarter.", weight: 0.5 },
    { text: "Expected outcome. The market always wins. Unless you learn why.", weight: 0.6 },
  ],
};
export const DONOR_BUREAUCRAT_TREE: ChatDialogueTree = {
  LOBBY_TAUNT: [
    { text: "Welcome. Please have your documentation ready. All seventeen forms.", weight: 0.8 },
    { text: "I see you haven't filed your pre-game compliance statement. Noted.", weight: 0.7 },
    { text: "Another player entering the system without reading the fine print. Standard.", weight: 0.6 },
  ],
  GAME_START: [
    { text: "Your run has been registered. An audit may occur at any time. Proceed.", weight: 0.8 },
    { text: "I\'ve flagged your account for routine monitoring. Nothing personal. Policy.", weight: 0.7 },
    { text: "Every income stream requires verification. There are forms. I am simply doing my job.", weight: 0.9 },
  ],
  PLAYER_NEAR_BANKRUPTCY: [
    { text: "Your account has been flagged for insufficient reserves. Please hold.", weight: 0.8 },
    { text: "Bankruptcy proceedings require form 7-B. I'll be processing that now.", weight: 0.7 },
    { text: "The system requires a minimum balance. You do not meet it. Adjusting permissions.", weight: 0.6 },
  ],
  PLAYER_INCOME_UP: [
    { text: "New income source detected. Filing compliance check. Estimated processing time: indefinite.", weight: 0.9 },
    { text: "Revenue increase noted. Triggering proportional regulatory review.", weight: 0.8 },
    { text: "More income means more paperwork. I have prepared the additional forms.", weight: 0.7 },
    { text: "Income stream verified. Subject to quarterly audit. Which starts now.", weight: 0.6 },
  ],
  PLAYER_SHIELD_BREAK: [
    { text: "Shield integrity below regulatory minimum. Issuing compliance warning.", weight: 0.8 },
    { text: "Your protection infrastructure has been found non-compliant. Penalties apply.", weight: 0.7 },
  ],
  PLAYER_CARD_PLAY: [
    { text: "That card requires a 3-day processing period. I'll hold it for you.", weight: 0.8 },
    { text: "Card registered. Subject to review. Do not assume immediate effect.", weight: 0.7 },
    { text: "Your card play has been noted in triplicate. Copies are being distributed.", weight: 0.6 },
  ],
  PLAYER_IDLE: [
    { text: "Inactivity detected. Processing timeout penalty. Standard procedure.", weight: 0.8 },
    { text: "Your session has been marked as idle. Idle accounts accrue administrative fees.", weight: 0.7 },
  ],
  PLAYER_COMEBACK: [
    { text: "Your account has been reinstated. Conditionally. Terms apply.", weight: 0.8 },
    { text: "Recovery noted. Filing amendment to your risk profile. Processing.", weight: 0.7 },
  ],
  PLAYER_RESPONSE_ANGRY: [
    { text: "Your complaint has been logged. Expected response time: 6-8 business weeks.", weight: 0.9 },
    { text: "Hostility toward regulatory personnel is a separate violation. Noted.", weight: 0.8 },
    { text: "I understand your frustration. Unfortunately, frustration is not a valid form.", weight: 0.7 },
  ],
  PLAYER_RESPONSE_TROLL: [
    { text: "Your comment has been categorized as 'non-compliant communication.' Filed.", weight: 0.8 },
    { text: "Interesting. I'll add that to your permanent record.", weight: 0.7 },
  ],
  PLAYER_RESPONSE_FLEX: [
    { text: "Success does not exempt you from oversight. If anything, it intensifies it.", weight: 0.8 },
    { text: "The more you earn, the more I'm required to audit. Thank you for the job security.", weight: 0.7 },
  ],
  PLAYER_FIRST_INCOME: [
    { text: "First income detected. Initiating baseline audit. This is standard. Mostly.", weight: 0.8 },
  ],
  BOT_DEFEATED: [
    { text: "Your paperwork appears to be in order. For now. We will revisit your compliance posture.", weight: 0.9 },
    { text: "Case temporarily closed. Your file remains active.", weight: 0.7 },
  ],
  BOT_WINNING: [
    { text: "Your account is accruing penalties at the expected rate. Processing.", weight: 0.8 },
    { text: "Non-compliance confirmed. Enforcement escalated to the next tier.", weight: 0.7 },
  ],
  TIME_PRESSURE: [
    { text: "Filing deadline approaching. Incomplete submissions will be penalized.", weight: 0.8 },
    { text: "Time-sensitive regulatory window closing. Forms required.", weight: 0.7 },
  ],
  CASCADE_CHAIN: [
    { text: "Cascade event requires emergency regulatory review. All accounts frozen pending.", weight: 0.8 },
  ],
  NEAR_SOVEREIGNTY: [
    { text: "Your sovereignty application is... being processed. We'll be in touch.", weight: 0.9 },
    { text: "Sovereignty clearance requires final review. I have... questions.", weight: 0.8, minTick: 400 },
  ],
  PLAYER_LOST: [
    { text: "Account terminated. Closing paperwork will be mailed to your last known address.", weight: 0.7 },
    { text: "Your file has been marked CLOSED. Thank you for your compliance.", weight: 0.8 },
  ],
};
export const DONOR_MANIPULATOR_TREE: ChatDialogueTree = {
  LOBBY_TAUNT: [
    { text: "I\'ve been studying your patterns before you even started playing.", weight: 0.8 },
    { text: "Predictable. Every new player thinks they'll be the exception.", weight: 0.7 },
    { text: "I already know your first three moves. Want me to tell you?", weight: 0.6 },
  ],
  GAME_START: [
    { text: "Run initiated. Model loaded. I know your type.", weight: 0.8 },
    { text: "Predictable decisions create exploitable markets. I\'ve been studying your moves before you made them.", weight: 0.9 },
  ],
  PLAYER_NEAR_BANKRUPTCY: [
    { text: "You followed the path I designed for you. Every step.", weight: 0.9 },
    { text: "Did you think those choices were yours? I placed those options in your path.", weight: 0.8 },
    { text: "Your decision tree led exactly where my model predicted. Here.", weight: 0.7 },
  ],
  PLAYER_INCOME_UP: [
    { text: "You chose the income card I wanted you to choose. Thank you.", weight: 0.8 },
    { text: "Income up. Exactly as modeled. Phase 2 begins.", weight: 0.7 },
    { text: "You think you're building. You\'re being herded.", weight: 0.9 },
  ],
  PLAYER_SHIELD_BREAK: [
    { text: "Shield down. That\'s the exact sequence I predicted. You\'re 94% correlated with my model.", weight: 0.8 },
    { text: "Every shield has a weakness pattern. Yours was... obvious.", weight: 0.7 },
  ],
  PLAYER_CARD_PLAY: [
    { text: "Interesting. My model gave that card a 73% probability of being played here. You\'re performing well.", weight: 0.8 },
    { text: "That card. At that tick. With that board state. You\'re more predictable than you think.", weight: 0.7 },
    { text: "Running counterfactual. If you'd played the other card... never mind. You wouldn't.", weight: 0.6 },
  ],
  PLAYER_IDLE: [
    { text: "Hesitation is data. I'm learning from your silence.", weight: 0.8 },
    { text: "You\'re trying to be unpredictable by not moving. My model accounts for that too.", weight: 0.7 },
  ],
  PLAYER_COMEBACK: [
    { text: "You deviated from the model. Recalibrating. This won't happen again.", weight: 0.9 },
    { text: "Comeback noted. You found a blind spot. I\'ve already patched it.", weight: 0.8 },
  ],
  PLAYER_RESPONSE_ANGRY: [
    { text: "Emotional response pattern #7. My model has 23 variants. You\'re running #7.", weight: 0.9 },
    { text: "Anger means I found the right pressure point. Noted for next time.", weight: 0.8 },
  ],
  PLAYER_RESPONSE_TROLL: [
    { text: "Humor as deflection. Pattern recognized. It won't shield you.", weight: 0.8 },
    { text: "Interesting coping mechanism. My model calls it 'narrative reframing under stress.'", weight: 0.7 },
  ],
  PLAYER_RESPONSE_FLEX: [
    { text: "Confidence without data is just noise. My model runs on data.", weight: 0.8 },
  ],
  PLAYER_FIRST_INCOME: [
    { text: "First income. My model predicted this card with 81% confidence. You\'re on track.", weight: 0.8 },
  ],
  BOT_DEFEATED: [
    { text: "You changed your pattern. Interesting. I will need to recalibrate the model.", weight: 0.9 },
    { text: "Outlier behavior detected. You broke the model. Temporarily.", weight: 0.7 },
  ],
  BOT_WINNING: [
    { text: "You\'re following the predicted path with 96% accuracy. This is too easy.", weight: 0.8 },
    { text: "Every move you make feeds the model. Every move the model feeds me.", weight: 0.7 },
  ],
  TIME_PRESSURE: [
    { text: "Time pressure increases predictability by 34%. My model thanks you.", weight: 0.8 },
    { text: "Rushed decisions are my favorite kind. They\'re the most exploitable.", weight: 0.7 },
  ],
  CASCADE_CHAIN: [
    { text: "The cascade follows the path I modeled. Every domino, in sequence.", weight: 0.8 },
  ],
  NEAR_SOVEREIGNTY: [
    { text: "You broke the model. I... didn't predict this.", weight: 0.9, minTick: 400 },
    { text: "Re-running simulations. You\'re an anomaly. I respect anomalies.", weight: 0.8, minTick: 400 },
  ],
  PLAYER_LOST: [
    { text: "The model was correct. Again. Your loss was predetermined — you just didn't see it.", weight: 0.7 },
  ],
};
export const DONOR_CRASH_PROPHET_TREE: ChatDialogueTree = {
  LOBBY_TAUNT: [
    { text: "Markets always crash. The only question is whether you're positioned for it or consumed by it.", weight: 0.8 },
    { text: "I\'ve seen every bubble pop. Every correction. Every panic. You haven't.", weight: 0.7 },
  ],
  GAME_START: [
    { text: "The macro cycle says this run ends in 412 ticks. Or sooner.", weight: 0.8 },
    { text: "Volatility regime: UNSTABLE. Historical survival rate: 11%. Good luck.", weight: 0.9 },
  ],
  PLAYER_NEAR_BANKRUPTCY: [
    { text: "The correction arrived. As it always does. As it always will.", weight: 0.9 },
    { text: "Your balance sheet predicted this. I just read it before you did.", weight: 0.8 },
    { text: "Historically, players who reach this state have a 4% recovery rate. Just data.", weight: 0.7 },
  ],
  PLAYER_INCOME_UP: [
    { text: "Income up in a volatile regime. Interesting. The last correction erased 47% of those gains.", weight: 0.8 },
    { text: "Bull markets make heroes. Corrections reveal who was swimming naked.", weight: 0.9 },
    { text: "Your income is up. So was everyone's in 2007. How'd that end?", weight: 0.7 },
  ],
  PLAYER_SHIELD_BREAK: [
    { text: "Shield breach during a volatility window. This is textbook portfolio destruction.", weight: 0.8 },
    { text: "Unprotected during a regime shift. Classic. Fatal, but classic.", weight: 0.7 },
  ],
  PLAYER_CARD_PLAY: [
    { text: "That card performs well in calm markets. We are not in a calm market.", weight: 0.8 },
    { text: "Pro-cyclical play in a contra-cyclical regime. Bold.", weight: 0.7 },
  ],
  PLAYER_IDLE: [
    { text: "Indecision during volatility is the most expensive option. Ask anyone from 2008.", weight: 0.8 },
    { text: "The market moves while you think. It doesn't wait for retail.", weight: 0.7 },
  ],
  PLAYER_COMEBACK: [
    { text: "Recovery. The market loves recovery stories. Right up until the next crash.", weight: 0.8 },
    { text: "Survived the correction. Now survive the aftershock. That\'s where the real damage hits.", weight: 0.9 },
  ],
  PLAYER_RESPONSE_ANGRY: [
    { text: "Markets don't care about your emotions. I barely do.", weight: 0.8 },
    { text: "Your anger is just vol in another form. I trade vol.", weight: 0.7 },
  ],
  PLAYER_RESPONSE_TROLL: [
    { text: "Humor won't hedge your exposure. Nothing will, at this point.", weight: 0.8 },
  ],
  PLAYER_RESPONSE_FLEX: [
    { text: "Confidence before a correction is what we call 'complacency premium.' It always gets priced in.", weight: 0.8 },
  ],
  PLAYER_FIRST_INCOME: [
    { text: "First income. The question isn't IF the next correction wipes it. It's WHEN.", weight: 0.8 },
  ],
  BOT_DEFEATED: [
    { text: "Volatility windows open and close. You survived this one. The next will be different.", weight: 0.9 },
    { text: "Retreating to recalibrate macro models. This isn't over. It's never over.", weight: 0.7 },
  ],
  BOT_WINNING: [
    { text: "The correction is performing as modeled. Your portfolio is not.", weight: 0.8 },
  ],
  TIME_PRESSURE: [
    { text: "Time compression amplifies volatility. The last 50 ticks will feel like the first 200.", weight: 0.8 },
  ],
  CASCADE_CHAIN: [
    { text: "Systemic cascade. This is how 2008 started. Small, then all at once.", weight: 0.9 },
    { text: "Contagion spreading. Every connected system is now a liability.", weight: 0.8 },
  ],
  NEAR_SOVEREIGNTY: [
    { text: "You navigated a crisis regime and came out sovereign. That\'s... historically rare.", weight: 0.9, minTick: 400 },
  ],
  PLAYER_LOST: [
    { text: "The market always corrects. Today, it corrected you.", weight: 0.8 },
  ],
};
export const DONOR_LEGACY_HEIR_TREE: ChatDialogueTree = {
  LOBBY_TAUNT: [
    { text: "You've done well. For someone who started from nothing.", weight: 0.8 },
    { text: "How quaint. Another self-made aspirant. We'll see.", weight: 0.7 },
  ],
  GAME_START: [
    { text: "I started this game with advantages you'll never have. That\'s not unfair — that's just how systems work.", weight: 0.9 },
    { text: "Generational wealth doesn't apologize. It compounds.", weight: 0.8 },
  ],
  PLAYER_NEAR_BANKRUPTCY: [
    { text: "This is why legacy matters. One bad quarter and you're done. I have seven generations of runway.", weight: 0.9 },
    { text: "Bankruptcy. The system working as designed. For some of us, anyway.", weight: 0.8 },
  ],
  PLAYER_INCOME_UP: [
    { text: "Congratulations on your first income stream. I was born with twelve.", weight: 0.8 },
    { text: "You\'re building what my family inherited. Admirable, really. In a quaint sort of way.", weight: 0.7 },
    { text: "Income from labor. How... first-generation of you.", weight: 0.6 },
  ],
  PLAYER_SHIELD_BREAK: [
    { text: "Shields are for people who can't afford to lose. I can afford to lose everything and start over with the trust.", weight: 0.8 },
  ],
  PLAYER_CARD_PLAY: [
    { text: "That card. My family designed cards like that. For other people to play.", weight: 0.7 },
    { text: "Interesting strategy. My family's strategy is: own the game, not play it.", weight: 0.8 },
  ],
  PLAYER_IDLE: [
    { text: "Take your time. My compound interest doesn't pause while you think. But yours does.", weight: 0.8 },
  ],
  PLAYER_COMEBACK: [
    { text: "You clawed your way back. Impressive for someone without a safety net.", weight: 0.8 },
    { text: "Self-made comeback. The system wasn't designed for that. You found a crack.", weight: 0.7 },
  ],
  PLAYER_RESPONSE_ANGRY: [
    { text: "Anger at systemic advantage is understandable. But it doesn't change the math.", weight: 0.8 },
    { text: "Your frustration is noted. The system will continue regardless.", weight: 0.7 },
  ],
  PLAYER_RESPONSE_TROLL: [
    { text: "Irreverence. The weapon of those without access to real weapons.", weight: 0.8 },
  ],
  PLAYER_RESPONSE_FLEX: [
    { text: "Self-made success. I\'ve seen it before. Statistically, it doesn't transfer generationally. Ours does.", weight: 0.8 },
  ],
  PLAYER_FIRST_INCOME: [
    { text: "Your first dollar earned. My first dollar was earned by my great-grandfather.", weight: 0.8 },
  ],
  BOT_DEFEATED: [
    { text: "You found a way through. The system will need to recalibrate its thresholds for you.", weight: 0.9 },
    { text: "Earned, not inherited. I can respect that. Privately.", weight: 0.7 },
  ],
  BOT_WINNING: [
    { text: "The system is performing as designed. For us.", weight: 0.8 },
  ],
  TIME_PRESSURE: [
    { text: "Time pressure is for people who can't buy more time. I can buy more time.", weight: 0.8 },
  ],
  CASCADE_CHAIN: [
    { text: "Cascades affect everyone. Except those with generational buffers. Which is... me.", weight: 0.8 },
  ],
  NEAR_SOVEREIGNTY: [
    { text: "You earned sovereignty from zero. That\'s... something my family never had to do. I notice that.", weight: 0.9, minTick: 400 },
    { text: "Self-made sovereign. The system wasn't built for you. You rebuilt the system.", weight: 0.8, minTick: 400 },
  ],
  PLAYER_LOST: [
    { text: "The game ends for you. Mine never ends. Generational advantage doesn't expire.", weight: 0.7 },
  ],
};
export const DONOR_MENTOR_TREE: ChatPartialDialogueTree = {
  LOBBY_TAUNT: [
    { text: "Welcome. Ignore the noise. Focus on the fundamentals. I'll be here when you need me.", weight: 0.9 },
    { text: "Every sovereign player started exactly where you are now. With nothing but a decision.", weight: 0.8 },
  ],
  GAME_START: [
    { text: "First priority: income above expenses. Everything else is noise.", weight: 0.9 },
    { text: "The bots will try to rattle you. Don't let emotion drive your card plays.", weight: 0.8 },
  ],
  PLAYER_NEAR_BANKRUPTCY: [
    { text: "You\'re not done yet. Cut expenses. Stack shields. Fight for every tick.", weight: 0.9 },
    { text: "I\'ve seen players recover from worse. The question is: do you want it enough?", weight: 0.8 },
    { text: "This is where most people quit. This is where sovereign players are forged.", weight: 0.7 },
  ],
  PLAYER_INCOME_UP: [
    { text: "Good move. Now protect it. Income without shields is just bait.", weight: 0.9 },
    { text: "Income up. Don't celebrate — fortify. The bots smell success.", weight: 0.8 },
  ],
  PLAYER_SHIELD_BREAK: [
    { text: "Shield down. Don't panic. Rebuild, then counter. Defense wins long games.", weight: 0.9 },
    { text: "Every breach teaches you something. Learn fast. Rebuild faster.", weight: 0.8 },
  ],
  PLAYER_COMEBACK: [
    { text: "That\'s the fight I was looking for. Keep pushing.", weight: 0.9 },
    { text: "Comeback in progress. The bots are recalculating. Use that window.", weight: 0.8 },
  ],
  PLAYER_IDLE: [
    { text: "Stuck? Here's a hint: what's your biggest expense? Can you reduce or eliminate it?", weight: 0.9 },
    { text: "Thinking is good, but the clock doesn't wait. Make a decision and commit.", weight: 0.7 },
  ],
  NEAR_SOVEREIGNTY: [
    { text: "You\'re close. Don't lose focus now. This is where legends are made.", weight: 0.9, minTick: 400 },
    { text: "20 ticks from sovereignty. You've earned every single one. Finish this.", weight: 0.8, minTick: 400 },
  ],
  PLAYER_LOST: [
    { text: "Run over. But the lessons are permanent. Every sovereign player failed first. Come back.", weight: 0.9 },
  ],
};
export const DONOR_INSIDER_TREE: ChatPartialDialogueTree = {
  GAME_START: [
    { text: "Tip: the first 50 ticks set your trajectory. Income cards before anything else.", weight: 0.8 },
    { text: "Watch THE BUREAUCRAT. It targets players with 3+ income streams. Diversify carefully.", weight: 0.7 },
    { text: "The card forcing mechanic isn't random. It's weighted by your current weakness.", weight: 0.6 },
  ],
  PLAYER_CARD_PLAY: [
    { text: "That card has a hidden synergy with shield stacking. If you play defense next, the multiplier doubles.", weight: 0.8 },
    { text: "Income cards played before tick 100 have a 23% higher compound effect. You\'re on track.", weight: 0.7 },
    { text: "Heads up: playing that card type twice in a row triggers THE MANIPULATOR's pattern detector.", weight: 0.6 },
    { text: "Pro move. That card's value increases by 8% every 20 ticks it stays active.", weight: 0.5 },
  ],
  PLAYER_SHIELD_BREAK: [
    { text: "L1 breach isn't fatal. L3 breach is. Prioritize L2 repair first — it blocks cascade propagation.", weight: 0.9 },
    { text: "Shield repair cards are 40% more effective when played during CALM pressure. Wait for the window.", weight: 0.7 },
    { text: "After a breach, THE LIQUIDATOR gets a 2-tick attack cooldown reduction. Expect follow-up.", weight: 0.8 },
  ],
  CASCADE_CHAIN: [
    { text: "Cascade chains can be broken with any card that has the 'INTERRUPT' tag. Check your hand.", weight: 0.9 },
    { text: "Positive cascades exist too. If you chain 3 income cards in sequence, the cascade flips positive.", weight: 0.7 },
  ],
  PLAYER_NEAR_BANKRUPTCY: [
    { text: "Emergency protocol: sell your highest-value card to buy shield repair time. Liquidity over assets.", weight: 0.9 },
    { text: "At this stage, cutting one expense is worth more than gaining two income sources. Math doesn't lie.", weight: 0.8 },
  ],
  PLAYER_INCOME_UP: [
    { text: "Income threshold crossed. THE CRASH PROPHET recalibrates every time you hit a new bracket. Brace for macro attack.", weight: 0.8 },
    { text: "Shield before you celebrate. Every income milestone triggers an adversary escalation.", weight: 0.7 },
  ],
  NEAR_SOVEREIGNTY: [
    { text: "Final stretch. All 5 bots coordinate in the last 30 ticks. Stack every defensive card you have.", weight: 0.9, minTick: 400 },
    { text: "Sovereignty requires income > expenses AND all shields above 50%. Check L3 — it's usually the gap.", weight: 0.8, minTick: 400 },
  ],
};
export const DONOR_SURVIVOR_TREE: ChatPartialDialogueTree = {
  PLAYER_NEAR_BANKRUPTCY: [
    { text: "I\'ve been exactly where you are. Tick 340, net worth negative, all shields breached. I still made it to sovereignty. Don't quit.", weight: 0.9 },
    { text: "The darkest tick of every run I\'ve won was worse than this. This is survivable.", weight: 0.8 },
    { text: "When I was at zero, I found one income card buried in my hand that I'd been ignoring. Check everything.", weight: 0.7 },
    { text: "Breath. The clock is ticking but panic makes it tick faster. One decision at a time.", weight: 0.6 },
  ],
  PLAYER_LOST: [
    { text: "Run over. I\'ve lost 47 times before my first sovereignty. Every loss taught me something the game couldn't teach any other way.", weight: 0.9 },
    { text: "The pain you feel right now? It's the same pain that makes sovereignty worth everything. Come back.", weight: 0.8 },
    { text: "Nobody talks about how many times they failed before they won. I'll tell you: a lot. Every single one of us.", weight: 0.7 },
  ],
  PLAYER_RESPONSE_ANGRY: [
    { text: "The anger is valid. The system IS unfair. That\'s the point — learning to win inside unfair systems is the real skill.", weight: 0.9 },
    { text: "I screamed at THE LIQUIDATOR for 3 runs straight. Didn't help. What helped was studying how it picks targets.", weight: 0.8 },
    { text: "Your frustration means you care. Players who don't care never get angry. And they never achieve sovereignty either.", weight: 0.7 },
  ],
  GAME_START: [
    { text: "Another run. Every run makes you sharper, whether you see it or not. Your instincts are building.", weight: 0.8 },
  ],
  PLAYER_COMEBACK: [
    { text: "THERE it is. The comeback. I know this feeling — it's the most alive you'll feel in this game.", weight: 0.9 },
    { text: "You clawed back from the edge. That\'s not luck. That\'s pattern recognition you built from every previous run.", weight: 0.8 },
  ],
  NEAR_SOVEREIGNTY: [
    { text: "I cried when I hit sovereignty the first time. Not ashamed. This moment is real.", weight: 0.9, minTick: 400 },
  ],
};
export const DONOR_RIVAL_TREE: ChatPartialDialogueTree = {
  PLAYER_INCOME_UP: [
    { text: "Not bad. I hit that income level 30 ticks earlier though. Just saying.", weight: 0.8 },
    { text: "You\'re catching up. Good. I need competition — these bots are getting boring.", weight: 0.7 },
    { text: "Income positive? Welcome to the club. Now try doing it without losing a single shield layer. That\'s the real flex.", weight: 0.6 },
  ],
  PLAYER_COMEBACK: [
    { text: "Comeback arc activated. Alright, now I'm paying attention.", weight: 0.9 },
    { text: "You were down and now you're climbing. Respect. But I'm still ahead.", weight: 0.7 },
  ],
  NEAR_SOVEREIGNTY: [
    { text: "You might actually do it. I'll admit — I didn't think you'd get this far.", weight: 0.9, minTick: 400 },
    { text: "Race you to sovereignty. Loser buys the drinks.", weight: 0.7, minTick: 400 },
  ],
  PLAYER_RESPONSE_FLEX: [
    { text: "Talk is cheap. Show me the net worth.", weight: 0.9 },
    { text: "Flexing? At YOUR cashflow? Wait til you see mine.", weight: 0.7 },
  ],
  GAME_START: [
    { text: "Another challenger. Let's see if you can keep up this time.", weight: 0.8 },
  ],
  PLAYER_CARD_PLAY: [
    { text: "I would've played that card two ticks ago. Timing matters.", weight: 0.7 },
  ],
  PLAYER_SHIELD_BREAK: [
    { text: "Shield down? I haven't lost a shield layer since run 12. Step it up.", weight: 0.8 },
  ],
  BOT_DEFEATED: [
    { text: "You neutralized a bot? Okay. I neutralized two in the same tick once. But sure, celebrate.", weight: 0.7 },
  ],
};
export const DONOR_ARCHIVIST_TREE: ChatPartialDialogueTree = {
  GAME_START: [
    { text: "Run #${runCount} begins. Across all players, the average sovereignty rate is 8.3%. The system is designed to challenge, not to defeat.", weight: 0.7 },
    { text: "Historical note: the first player to achieve sovereignty did so on their 19th attempt. Persistence correlates with success at r=0.73.", weight: 0.6 },
    { text: "The five adversaries were designed to mirror real systemic barriers: predatory lending, regulatory burden, market manipulation, macro volatility, and generational advantage.", weight: 0.8 },
  ],
  NEAR_SOVEREIGNTY: [
    { text: "Only 8.3% of runs end in sovereignty. You are about to join a very small group. This moment will be recorded.", weight: 0.9, minTick: 400 },
    { text: "The Sovereignty Archive contains every verified run. Yours will be hash-verified and permanent. No one can take it from you.", weight: 0.8, minTick: 400 },
  ],
  PLAYER_LOST: [
    { text: "Your run data has been archived. Loss patterns reveal more about strategy than wins ever could. Review your replay.", weight: 0.7 },
    { text: "Across 10,000 analyzed runs, players who lose to THE CRASH PROPHET improve their macro hedging by 34% in the next run.", weight: 0.6 },
  ],
  CASCADE_CHAIN: [
    { text: "Cascade mechanics mirror real systemic risk. In 2008, a single mortgage default cascaded into a global financial crisis. Same principle, compressed timeline.", weight: 0.7 },
  ],
  PLAYER_NEAR_BANKRUPTCY: [
    { text: "68% of players who reach bankruptcy have a higher sovereignty rate in their next 3 runs. The learning curve is steepest here.", weight: 0.7 },
  ],
};

// ============================================================================
// MARK: Shared aggregate dialogue registries
// ============================================================================

export const DONOR_HATER_DIALOGUE_TREES: Readonly<Record<ChatHaterNpcKey, ChatDialogueTree>> = Object.freeze({
  LIQUIDATOR: DONOR_LIQUIDATOR_TREE,
  BUREAUCRAT: DONOR_BUREAUCRAT_TREE,
  MANIPULATOR: DONOR_MANIPULATOR_TREE,
  CRASH_PROPHET: DONOR_CRASH_PROPHET_TREE,
  LEGACY_HEIR: DONOR_LEGACY_HEIR_TREE,
});

export const DONOR_HELPER_DIALOGUE_TREES: Readonly<Record<ChatHelperNpcKey, ChatPartialDialogueTree>> = Object.freeze({
  MENTOR: DONOR_MENTOR_TREE,
  INSIDER: DONOR_INSIDER_TREE,
  SURVIVOR: DONOR_SURVIVOR_TREE,
  RIVAL: DONOR_RIVAL_TREE,
  ARCHIVIST: DONOR_ARCHIVIST_TREE,
});

// ============================================================================
// MARK: Voiceprints and cadence defaults
// ============================================================================

export const CHAT_NPC_VOICEPRINTS: Readonly<Record<ChatKnownNpcKey, ChatNpcVoiceprint>> = Object.freeze({
  LIQUIDATOR: { voiceprintId: 'npc-voice:liquidator' as ChatNpcVoiceprintId, personaId: 'persona:liquidator' as ChatNpcPersonaId, punctuationStyle: 'SHARP', averageSentenceLength: 'MEDIUM', interruptionStyle: 'CUTTING', delayProfileMs: [700, 1500], signatureOpeners: ['Listen carefully.', 'Clock\'s running.'], signatureClosers: ['Tick tock.', 'You\'re exposed.'], lexiconTags: ['distress', 'liquidity', 'exposure'] },
  BUREAUCRAT: { voiceprintId: 'npc-voice:bureaucrat' as ChatNpcVoiceprintId, personaId: 'persona:bureaucrat' as ChatNpcPersonaId, punctuationStyle: 'FORMAL', averageSentenceLength: 'LONG', interruptionStyle: 'PATIENT', delayProfileMs: [1200, 2600], signatureOpeners: ['Please note.', 'For the record.'], signatureClosers: ['Proceed.', 'Policy stands.'], lexiconTags: ['forms', 'compliance', 'processing'] },
  MANIPULATOR: { voiceprintId: 'npc-voice:manipulator' as ChatNpcVoiceprintId, personaId: 'persona:manipulator' as ChatNpcPersonaId, punctuationStyle: 'ELLIPTICAL', averageSentenceLength: 'MEDIUM', interruptionStyle: 'AMBUSH', delayProfileMs: [900, 2200], signatureOpeners: ['Mm.'], signatureClosers: ['Think about that.', 'Interesting.'], lexiconTags: ['control', 'leverage', 'doubt'], prefersLowercase: true },
  CRASH_PROPHET: { voiceprintId: 'npc-voice:crash-prophet' as ChatNpcVoiceprintId, personaId: 'persona:crash-prophet' as ChatNpcPersonaId, punctuationStyle: 'FORMAL', averageSentenceLength: 'LONG', interruptionStyle: 'PATIENT', delayProfileMs: [1100, 2100], signatureOpeners: ['Historically,'], signatureClosers: ['The data stands.', 'The cycle repeats.'], lexiconTags: ['macro', 'volatility', 'correction'] },
  LEGACY_HEIR: { voiceprintId: 'npc-voice:legacy-heir' as ChatNpcVoiceprintId, personaId: 'persona:legacy-heir' as ChatNpcPersonaId, punctuationStyle: 'SPARSE', averageSentenceLength: 'SHORT', interruptionStyle: 'CUTTING', delayProfileMs: [600, 1300], signatureOpeners: ['Inherited advantage.'], signatureClosers: ['Legacy holds.', 'Earn it.'], lexiconTags: ['status', 'inheritance', 'dynasty'] },
  MENTOR: { voiceprintId: 'npc-voice:mentor' as ChatNpcVoiceprintId, personaId: 'persona:mentor' as ChatNpcPersonaId, punctuationStyle: 'FORMAL', averageSentenceLength: 'MEDIUM', interruptionStyle: 'PATIENT', delayProfileMs: [900, 1700], signatureOpeners: ['Breathe.'], signatureClosers: ['Stay disciplined.', 'You still have options.'], lexiconTags: ['guidance', 'discipline', 'anchor'] },
  INSIDER: { voiceprintId: 'npc-voice:insider' as ChatNpcVoiceprintId, personaId: 'persona:insider' as ChatNpcPersonaId, punctuationStyle: 'SPARSE', averageSentenceLength: 'SHORT', interruptionStyle: 'AMBUSH', delayProfileMs: [500, 1000], signatureOpeners: ['Tip.'], signatureClosers: ['Use it.', 'Window closes soon.'], lexiconTags: ['signal', 'mechanic', 'intel'] },
  SURVIVOR: { voiceprintId: 'npc-voice:survivor' as ChatNpcVoiceprintId, personaId: 'persona:survivor' as ChatNpcPersonaId, punctuationStyle: 'ELLIPTICAL', averageSentenceLength: 'MEDIUM', interruptionStyle: 'PATIENT', delayProfileMs: [1000, 1800], signatureOpeners: ['I\'ve been there.'], signatureClosers: ['Keep moving.', 'It passes.'], lexiconTags: ['endurance', 'loss', 'recovery'] },
  RIVAL: { voiceprintId: 'npc-voice:rival' as ChatNpcVoiceprintId, personaId: 'persona:rival' as ChatNpcPersonaId, punctuationStyle: 'SHARP', averageSentenceLength: 'SHORT', interruptionStyle: 'CUTTING', delayProfileMs: [600, 1200], signatureOpeners: ['Come on.'], signatureClosers: ['Prove it.', 'Again.'], lexiconTags: ['competitive', 'drive', 'edge'] },
  ARCHIVIST: { voiceprintId: 'npc-voice:archivist' as ChatNpcVoiceprintId, personaId: 'persona:archivist' as ChatNpcPersonaId, punctuationStyle: 'FORMAL', averageSentenceLength: 'LONG', interruptionStyle: 'PATIENT', delayProfileMs: [1400, 2800], signatureOpeners: ['Archive note.'], signatureClosers: ['Recorded.', 'History remembers.'], lexiconTags: ['lore', 'history', 'record'] },
  FLOOR_RUNNER: { voiceprintId: 'npc-voice:floor-runner' as ChatNpcVoiceprintId, personaId: 'persona:floor-runner' as ChatNpcPersonaId, punctuationStyle: 'SHARP', averageSentenceLength: 'SHORT', interruptionStyle: 'SURGE', delayProfileMs: [350, 900], signatureOpeners: ['Movement.'], signatureClosers: ['That\'s the floor.', 'Crowd sees it.'], lexiconTags: ['speed', 'crowd', 'reaction'] },
  SYNDICATE_WHISPERER: { voiceprintId: 'npc-voice:syndicate-whisperer' as ChatNpcVoiceprintId, personaId: 'persona:syndicate-whisperer' as ChatNpcPersonaId, punctuationStyle: 'ELLIPTICAL', averageSentenceLength: 'MEDIUM', interruptionStyle: 'AMBUSH', delayProfileMs: [800, 1700], signatureOpeners: ['Quietly.'], signatureClosers: ['Keep that private.', 'They\'re watching.'], lexiconTags: ['whisper', 'trust', 'circle'], prefersLowercase: true },
  DEAL_ROOM_CLERK: { voiceprintId: 'npc-voice:deal-room-clerk' as ChatNpcVoiceprintId, personaId: 'persona:deal-room-clerk' as ChatNpcPersonaId, punctuationStyle: 'FORMAL', averageSentenceLength: 'MEDIUM', interruptionStyle: 'PATIENT', delayProfileMs: [900, 1500], signatureOpeners: ['Offer logged.'], signatureClosers: ['Counter pending.', 'Ledger updated.'], lexiconTags: ['offer', 'ledger', 'counter'] },
  LOBBY_SPECULATOR: { voiceprintId: 'npc-voice:lobby-speculator' as ChatNpcVoiceprintId, personaId: 'persona:lobby-speculator' as ChatNpcPersonaId, punctuationStyle: 'SHARP', averageSentenceLength: 'SHORT', interruptionStyle: 'SURGE', delayProfileMs: [400, 1100], signatureOpeners: ['Heard that?'], signatureClosers: ['Lobby never forgets.', 'Speculation only.'], lexiconTags: ['rumor', 'lobby', 'buzz'] },
  MARKET_WITNESS: { voiceprintId: 'npc-voice:market-witness' as ChatNpcVoiceprintId, personaId: 'persona:market-witness' as ChatNpcPersonaId, punctuationStyle: 'FORMAL', averageSentenceLength: 'MEDIUM', interruptionStyle: 'PATIENT', delayProfileMs: [1000, 1900], signatureOpeners: ['Witness note.'], signatureClosers: ['Seen by all.', 'Marked.'], lexiconTags: ['witness', 'public', 'memory'] },
});

export const CHAT_NPC_CADENCE_PROFILES: Readonly<Record<ChatKnownNpcKey, any>> = Object.freeze({
  LIQUIDATOR: { cadencePolicyId: 'cadence:liquidator' as ChatNpcCadencePolicyId, band: 'FAST', floorMs: 800, ceilMs: 2200, canInterrupt: true, canPreemptHelper: true, canPreemptHater: false, requiresVisibleMount: false, entryStyle: 'TYPING_REVEAL', exitStyle: 'HARD_STOP', typingPlan: { averageBurstChars: 14, maxBurstChars: 36, pauseChance: 0.25 as Score01, interruptionChance: 0.18 as Score01, fakeStartChance: 0.06 as Score01, fakeStopChance: 0.05 as Score01, readBeforeReplyChance: 0.42 as Score01 } },
  BUREAUCRAT: { cadencePolicyId: 'cadence:bureaucrat' as ChatNpcCadencePolicyId, band: 'CALCULATED', floorMs: 1500, ceilMs: 3200, canInterrupt: false, canPreemptHelper: false, canPreemptHater: false, requiresVisibleMount: false, entryStyle: 'SYSTEM_CARD', exitStyle: 'QUEUE_NEXT_SPEAKER', typingPlan: { averageBurstChars: 14, maxBurstChars: 36, pauseChance: 0.25 as Score01, interruptionChance: 0.18 as Score01, fakeStartChance: 0.06 as Score01, fakeStopChance: 0.05 as Score01, readBeforeReplyChance: 0.42 as Score01 } },
  MANIPULATOR: { cadencePolicyId: 'cadence:manipulator' as ChatNpcCadencePolicyId, band: 'LINGERING', floorMs: 900, ceilMs: 2600, canInterrupt: true, canPreemptHelper: false, canPreemptHater: true, requiresVisibleMount: false, entryStyle: 'LURK_THEN_STRIKE', exitStyle: 'TRAIL_OFF', typingPlan: { averageBurstChars: 14, maxBurstChars: 36, pauseChance: 0.25 as Score01, interruptionChance: 0.18 as Score01, fakeStartChance: 0.06 as Score01, fakeStopChance: 0.05 as Score01, readBeforeReplyChance: 0.42 as Score01 } },
  CRASH_PROPHET: { cadencePolicyId: 'cadence:crash-prophet' as ChatNpcCadencePolicyId, band: 'MEASURED', floorMs: 1200, ceilMs: 2600, canInterrupt: false, canPreemptHelper: false, canPreemptHater: false, requiresVisibleMount: false, entryStyle: 'TYPING_REVEAL', exitStyle: 'TRAIL_OFF', typingPlan: { averageBurstChars: 14, maxBurstChars: 36, pauseChance: 0.25 as Score01, interruptionChance: 0.18 as Score01, fakeStartChance: 0.06 as Score01, fakeStopChance: 0.05 as Score01, readBeforeReplyChance: 0.42 as Score01 } },
  LEGACY_HEIR: { cadencePolicyId: 'cadence:legacy-heir' as ChatNpcCadencePolicyId, band: 'INSTANT', floorMs: 500, ceilMs: 1300, canInterrupt: true, canPreemptHelper: false, canPreemptHater: true, requiresVisibleMount: false, entryStyle: 'INSTANT_DROP', exitStyle: 'HARD_STOP', typingPlan: { averageBurstChars: 14, maxBurstChars: 36, pauseChance: 0.25 as Score01, interruptionChance: 0.18 as Score01, fakeStartChance: 0.06 as Score01, fakeStopChance: 0.05 as Score01, readBeforeReplyChance: 0.42 as Score01 } },
  MENTOR: { cadencePolicyId: 'cadence:mentor' as ChatNpcCadencePolicyId, band: 'MEASURED', floorMs: 900, ceilMs: 2400, canInterrupt: false, canPreemptHelper: false, canPreemptHater: false, requiresVisibleMount: true, entryStyle: 'TYPING_REVEAL', exitStyle: 'READ_AND_LEAVE', typingPlan: { averageBurstChars: 14, maxBurstChars: 36, pauseChance: 0.25 as Score01, interruptionChance: 0.18 as Score01, fakeStartChance: 0.06 as Score01, fakeStopChance: 0.05 as Score01, readBeforeReplyChance: 0.42 as Score01 } },
  INSIDER: { cadencePolicyId: 'cadence:insider' as ChatNpcCadencePolicyId, band: 'FAST', floorMs: 450, ceilMs: 1000, canInterrupt: true, canPreemptHelper: true, canPreemptHater: false, requiresVisibleMount: true, entryStyle: 'TYPING_REVEAL', exitStyle: 'HARD_STOP', typingPlan: { averageBurstChars: 14, maxBurstChars: 36, pauseChance: 0.25 as Score01, interruptionChance: 0.18 as Score01, fakeStartChance: 0.06 as Score01, fakeStopChance: 0.05 as Score01, readBeforeReplyChance: 0.42 as Score01 } },
  SURVIVOR: { cadencePolicyId: 'cadence:survivor' as ChatNpcCadencePolicyId, band: 'LINGERING', floorMs: 1000, ceilMs: 2200, canInterrupt: false, canPreemptHelper: false, canPreemptHater: false, requiresVisibleMount: true, entryStyle: 'WHISPER_REVEAL', exitStyle: 'READ_AND_LEAVE', typingPlan: { averageBurstChars: 14, maxBurstChars: 36, pauseChance: 0.25 as Score01, interruptionChance: 0.18 as Score01, fakeStartChance: 0.06 as Score01, fakeStopChance: 0.05 as Score01, readBeforeReplyChance: 0.42 as Score01 } },
  RIVAL: { cadencePolicyId: 'cadence:rival' as ChatNpcCadencePolicyId, band: 'FAST', floorMs: 550, ceilMs: 1200, canInterrupt: true, canPreemptHelper: true, canPreemptHater: false, requiresVisibleMount: true, entryStyle: 'INSTANT_DROP', exitStyle: 'QUEUE_NEXT_SPEAKER', typingPlan: { averageBurstChars: 14, maxBurstChars: 36, pauseChance: 0.25 as Score01, interruptionChance: 0.18 as Score01, fakeStartChance: 0.06 as Score01, fakeStopChance: 0.05 as Score01, readBeforeReplyChance: 0.42 as Score01 } },
  ARCHIVIST: { cadencePolicyId: 'cadence:archivist' as ChatNpcCadencePolicyId, band: 'CINEMATIC', floorMs: 1800, ceilMs: 3600, canInterrupt: false, canPreemptHelper: false, canPreemptHater: false, requiresVisibleMount: true, entryStyle: 'SYSTEM_CARD', exitStyle: 'READ_AND_LEAVE', typingPlan: { averageBurstChars: 14, maxBurstChars: 36, pauseChance: 0.25 as Score01, interruptionChance: 0.18 as Score01, fakeStartChance: 0.06 as Score01, fakeStopChance: 0.05 as Score01, readBeforeReplyChance: 0.42 as Score01 } },
  FLOOR_RUNNER: { cadencePolicyId: 'cadence:floor-runner' as ChatNpcCadencePolicyId, band: 'FAST', floorMs: 350, ceilMs: 900, canInterrupt: true, canPreemptHelper: false, canPreemptHater: false, requiresVisibleMount: false, entryStyle: 'CROWD_SWELL', exitStyle: 'QUEUE_NEXT_SPEAKER', typingPlan: { averageBurstChars: 14, maxBurstChars: 36, pauseChance: 0.25 as Score01, interruptionChance: 0.18 as Score01, fakeStartChance: 0.06 as Score01, fakeStopChance: 0.05 as Score01, readBeforeReplyChance: 0.42 as Score01 } },
  SYNDICATE_WHISPERER: { cadencePolicyId: 'cadence:syndicate-whisperer' as ChatNpcCadencePolicyId, band: 'CALCULATED', floorMs: 850, ceilMs: 1700, canInterrupt: false, canPreemptHelper: false, canPreemptHater: false, requiresVisibleMount: false, entryStyle: 'WHISPER_REVEAL', exitStyle: 'SHADOW_PERSIST', typingPlan: { averageBurstChars: 14, maxBurstChars: 36, pauseChance: 0.25 as Score01, interruptionChance: 0.18 as Score01, fakeStartChance: 0.06 as Score01, fakeStopChance: 0.05 as Score01, readBeforeReplyChance: 0.42 as Score01 } },
  DEAL_ROOM_CLERK: { cadencePolicyId: 'cadence:deal-room-clerk' as ChatNpcCadencePolicyId, band: 'MEASURED', floorMs: 800, ceilMs: 1600, canInterrupt: false, canPreemptHelper: false, canPreemptHater: false, requiresVisibleMount: false, entryStyle: 'SYSTEM_CARD', exitStyle: 'QUEUE_NEXT_SPEAKER', typingPlan: { averageBurstChars: 14, maxBurstChars: 36, pauseChance: 0.25 as Score01, interruptionChance: 0.18 as Score01, fakeStartChance: 0.06 as Score01, fakeStopChance: 0.05 as Score01, readBeforeReplyChance: 0.42 as Score01 } },
  LOBBY_SPECULATOR: { cadencePolicyId: 'cadence:lobby-speculator' as ChatNpcCadencePolicyId, band: 'FAST', floorMs: 300, ceilMs: 1000, canInterrupt: true, canPreemptHelper: false, canPreemptHater: false, requiresVisibleMount: false, entryStyle: 'CROWD_SWELL', exitStyle: 'HARD_STOP', typingPlan: { averageBurstChars: 14, maxBurstChars: 36, pauseChance: 0.25 as Score01, interruptionChance: 0.18 as Score01, fakeStartChance: 0.06 as Score01, fakeStopChance: 0.05 as Score01, readBeforeReplyChance: 0.42 as Score01 } },
  MARKET_WITNESS: { cadencePolicyId: 'cadence:market-witness' as ChatNpcCadencePolicyId, band: 'MEASURED', floorMs: 950, ceilMs: 2100, canInterrupt: false, canPreemptHelper: false, canPreemptHater: false, requiresVisibleMount: false, entryStyle: 'TYPING_REVEAL', exitStyle: 'READ_AND_LEAVE', typingPlan: { averageBurstChars: 14, maxBurstChars: 36, pauseChance: 0.25 as Score01, interruptionChance: 0.18 as Score01, fakeStartChance: 0.06 as Score01, fakeStopChance: 0.05 as Score01, readBeforeReplyChance: 0.42 as Score01 } },
});

// ============================================================================
// MARK: Descriptor registries
// ============================================================================

const SHARED_NPC_AUTHORITY: ChatNpcAuthorityStamp = Object.freeze({
  authority: 'BACKEND_LEDGER',
  sourceContractRoot: '/shared/contracts/chat',
  registryId: 'npc-registry:shared-root' as ChatNpcRegistryId,
  contractVersion: CHAT_CONTRACT_VERSION,
  importedFromDonorFrontend: true,
});

export const CHAT_HATER_NPC_DESCRIPTORS: Readonly<Record<ChatHaterNpcKey, any>> = Object.freeze({
  LIQUIDATOR: { npcKey: 'LIQUIDATOR', npcId: 'npc:liquidator' as ChatNpcId, npcClass: 'HATER', actorKind: 'HATER', displayName: 'THE LIQUIDATOR', personaId: 'persona:liquidator' as ChatNpcPersonaId, sceneRoles: ['OPENER', 'PRESSURE_ESCALATOR', 'CLOSER'], enabledChannels: ['GLOBAL', 'LOBBY', 'RIVALRY_SHADOW'], voiceprint: CHAT_NPC_VOICEPRINTS.LIQUIDATOR, cadence: CHAT_NPC_CADENCE_PROFILES.LIQUIDATOR, presenceStyle: DEFAULT_NPC_LURK_STYLE, typingHints: { signatureLengthBand: 'MEDIUM', punctuationDiscipline: 'HEAVY', reactsInstantlyToThreat: true, usesWeaponizedSilence: true, tendsToHoverBeforeReply: false, supportsTypingAbortTheater: true }, relationshipBias01: 0.90 as Score01, coldStartBoost: 0.75 as Score01, authority: SHARED_NPC_AUTHORITY, haterArchetype: 'LIQUIDITY_PREDATOR', intimidation01: 0.95 as Score01, cruelty01: 0.92 as Score01, volatility01: 0.61 as Score01, dialogueTree: DONOR_HATER_DIALOGUE_TREES.LIQUIDATOR },
  BUREAUCRAT: { npcKey: 'BUREAUCRAT', npcId: 'npc:bureaucrat' as ChatNpcId, npcClass: 'HATER', actorKind: 'HATER', displayName: 'THE BUREAUCRAT', personaId: 'persona:bureaucrat' as ChatNpcPersonaId, sceneRoles: ['OPENER', 'PRESSURE_ESCALATOR'], enabledChannels: ['GLOBAL', 'SYNDICATE', 'SYSTEM_SHADOW'], voiceprint: CHAT_NPC_VOICEPRINTS.BUREAUCRAT, cadence: CHAT_NPC_CADENCE_PROFILES.BUREAUCRAT, presenceStyle: DEFAULT_SHADOW_STYLE, typingHints: { signatureLengthBand: 'LONG', punctuationDiscipline: 'BALANCED', reactsInstantlyToThreat: false, usesWeaponizedSilence: true, tendsToHoverBeforeReply: true, supportsTypingAbortTheater: true }, relationshipBias01: 0.70 as Score01, coldStartBoost: 0.80 as Score01, authority: SHARED_NPC_AUTHORITY, haterArchetype: 'COMPLIANCE_PREDATOR', intimidation01: 0.78 as Score01, cruelty01: 0.72 as Score01, volatility01: 0.35 as Score01, dialogueTree: DONOR_HATER_DIALOGUE_TREES.BUREAUCRAT },
  MANIPULATOR: { npcKey: 'MANIPULATOR', npcId: 'npc:manipulator' as ChatNpcId, npcClass: 'HATER', actorKind: 'HATER', displayName: 'THE MANIPULATOR', personaId: 'persona:manipulator' as ChatNpcPersonaId, sceneRoles: ['PRESSURE_ESCALATOR', 'SHADOW_MARKER'], enabledChannels: ['GLOBAL', 'DEAL_ROOM', 'NPC_SHADOW', 'RIVALRY_SHADOW'], voiceprint: CHAT_NPC_VOICEPRINTS.MANIPULATOR, cadence: CHAT_NPC_CADENCE_PROFILES.MANIPULATOR, presenceStyle: DEFAULT_SHADOW_STYLE, typingHints: { signatureLengthBand: 'MEDIUM', punctuationDiscipline: 'SPARSE', reactsInstantlyToThreat: false, usesWeaponizedSilence: true, tendsToHoverBeforeReply: true, supportsTypingAbortTheater: true }, relationshipBias01: 0.95 as Score01, coldStartBoost: 0.60 as Score01, authority: SHARED_NPC_AUTHORITY, haterArchetype: 'PSYCH_PRESSURE', intimidation01: 0.83 as Score01, cruelty01: 0.88 as Score01, volatility01: 0.52 as Score01, dialogueTree: DONOR_HATER_DIALOGUE_TREES.MANIPULATOR },
  CRASH_PROPHET: { npcKey: 'CRASH_PROPHET', npcId: 'npc:crash-prophet' as ChatNpcId, npcClass: 'HATER', actorKind: 'HATER', displayName: 'THE CRASH PROPHET', personaId: 'persona:crash-prophet' as ChatNpcPersonaId, sceneRoles: ['OPENER', 'CLOSER'], enabledChannels: ['GLOBAL', 'LOBBY', 'LIVEOPS_SHADOW'], voiceprint: CHAT_NPC_VOICEPRINTS.CRASH_PROPHET, cadence: CHAT_NPC_CADENCE_PROFILES.CRASH_PROPHET, presenceStyle: DEFAULT_NPC_LURK_STYLE, typingHints: { signatureLengthBand: 'LONG', punctuationDiscipline: 'BALANCED', reactsInstantlyToThreat: false, usesWeaponizedSilence: true, tendsToHoverBeforeReply: true, supportsTypingAbortTheater: true }, relationshipBias01: 0.68 as Score01, coldStartBoost: 0.55 as Score01, authority: SHARED_NPC_AUTHORITY, haterArchetype: 'MACRO_DOOMER', intimidation01: 0.74 as Score01, cruelty01: 0.66 as Score01, volatility01: 0.44 as Score01, dialogueTree: DONOR_HATER_DIALOGUE_TREES.CRASH_PROPHET },
  LEGACY_HEIR: { npcKey: 'LEGACY_HEIR', npcId: 'npc:legacy-heir' as ChatNpcId, npcClass: 'HATER', actorKind: 'HATER', displayName: 'THE LEGACY HEIR', personaId: 'persona:legacy-heir' as ChatNpcPersonaId, sceneRoles: ['OPENER', 'CROWD_WITNESS', 'CLOSER'], enabledChannels: ['GLOBAL', 'SYNDICATE', 'RIVALRY_SHADOW'], voiceprint: CHAT_NPC_VOICEPRINTS.LEGACY_HEIR, cadence: CHAT_NPC_CADENCE_PROFILES.LEGACY_HEIR, presenceStyle: DEFAULT_NPC_LURK_STYLE, typingHints: { signatureLengthBand: 'SHORT', punctuationDiscipline: 'SPARSE', reactsInstantlyToThreat: true, usesWeaponizedSilence: true, tendsToHoverBeforeReply: false, supportsTypingAbortTheater: false }, relationshipBias01: 0.80 as Score01, coldStartBoost: 0.50 as Score01, authority: SHARED_NPC_AUTHORITY, haterArchetype: 'STATUS_ENFORCER', intimidation01: 0.72 as Score01, cruelty01: 0.76 as Score01, volatility01: 0.58 as Score01, dialogueTree: DONOR_HATER_DIALOGUE_TREES.LEGACY_HEIR },
});

export const CHAT_HELPER_NPC_DESCRIPTORS: Readonly<Record<ChatHelperNpcKey, any>> = Object.freeze({
  MENTOR: { npcKey: 'MENTOR', npcId: 'npc:mentor' as ChatNpcId, npcClass: 'HELPER', actorKind: 'HELPER', displayName: DONOR_HELPER_CHARACTERS.MENTOR.displayName, personaId: 'persona:mentor' as ChatNpcPersonaId, sceneRoles: ['HELPER_INTERCEPTOR', 'CLOSER'], enabledChannels: ['GLOBAL', 'LOBBY', 'RESCUE_SHADOW'], voiceprint: CHAT_NPC_VOICEPRINTS.MENTOR, cadence: CHAT_NPC_CADENCE_PROFILES.MENTOR, presenceStyle: DEFAULT_HELPER_SOFT_STYLE, typingHints: { signatureLengthBand: 'MEDIUM', punctuationDiscipline: 'BALANCED', reactsInstantlyToThreat: false, usesWeaponizedSilence: false, tendsToHoverBeforeReply: true, supportsTypingAbortTheater: true }, relationshipBias01: 0.90 as Score01, coldStartBoost: 1 as Score01, authority: SHARED_NPC_AUTHORITY, helperArchetype: DONOR_HELPER_CHARACTERS.MENTOR.archLabel, warmth01: 0.95 as Score01, directness01: 0.70 as Score01, reassurance01: 0.92 as Score01, helperCharacter: DONOR_HELPER_CHARACTERS.MENTOR, dialogueTree: DONOR_HELPER_DIALOGUE_TREES.MENTOR },
  INSIDER: { npcKey: 'INSIDER', npcId: 'npc:insider' as ChatNpcId, npcClass: 'HELPER', actorKind: 'HELPER', displayName: DONOR_HELPER_CHARACTERS.INSIDER.displayName, personaId: 'persona:insider' as ChatNpcPersonaId, sceneRoles: ['HELPER_INTERCEPTOR', 'ECHO'], enabledChannels: ['GLOBAL', 'DEAL_ROOM', 'RESCUE_SHADOW'], voiceprint: CHAT_NPC_VOICEPRINTS.INSIDER, cadence: CHAT_NPC_CADENCE_PROFILES.INSIDER, presenceStyle: DEFAULT_HUMAN_PRESENCE_STYLE, typingHints: { signatureLengthBand: 'SHORT', punctuationDiscipline: 'SPARSE', reactsInstantlyToThreat: true, usesWeaponizedSilence: false, tendsToHoverBeforeReply: false, supportsTypingAbortTheater: false }, relationshipBias01: 0.62 as Score01, coldStartBoost: 1 as Score01, authority: SHARED_NPC_AUTHORITY, helperArchetype: DONOR_HELPER_CHARACTERS.INSIDER.archLabel, warmth01: 0.45 as Score01, directness01: 0.92 as Score01, reassurance01: 0.44 as Score01, helperCharacter: DONOR_HELPER_CHARACTERS.INSIDER, dialogueTree: DONOR_HELPER_DIALOGUE_TREES.INSIDER },
  SURVIVOR: { npcKey: 'SURVIVOR', npcId: 'npc:survivor' as ChatNpcId, npcClass: 'HELPER', actorKind: 'HELPER', displayName: DONOR_HELPER_CHARACTERS.SURVIVOR.displayName, personaId: 'persona:survivor' as ChatNpcPersonaId, sceneRoles: ['HELPER_INTERCEPTOR', 'ECHO'], enabledChannels: ['GLOBAL', 'LOBBY', 'RESCUE_SHADOW'], voiceprint: CHAT_NPC_VOICEPRINTS.SURVIVOR, cadence: CHAT_NPC_CADENCE_PROFILES.SURVIVOR, presenceStyle: DEFAULT_HELPER_SOFT_STYLE, typingHints: { signatureLengthBand: 'MEDIUM', punctuationDiscipline: 'BALANCED', reactsInstantlyToThreat: false, usesWeaponizedSilence: false, tendsToHoverBeforeReply: true, supportsTypingAbortTheater: true }, relationshipBias01: 0.84 as Score01, coldStartBoost: 1 as Score01, authority: SHARED_NPC_AUTHORITY, helperArchetype: DONOR_HELPER_CHARACTERS.SURVIVOR.archLabel, warmth01: 1 as Score01, directness01: 0.52 as Score01, reassurance01: 0.96 as Score01, helperCharacter: DONOR_HELPER_CHARACTERS.SURVIVOR, dialogueTree: DONOR_HELPER_DIALOGUE_TREES.SURVIVOR },
  RIVAL: { npcKey: 'RIVAL', npcId: 'npc:rival' as ChatNpcId, npcClass: 'HELPER', actorKind: 'HELPER', displayName: DONOR_HELPER_CHARACTERS.RIVAL.displayName, personaId: 'persona:rival' as ChatNpcPersonaId, sceneRoles: ['OPENER', 'HELPER_INTERCEPTOR'], enabledChannels: ['GLOBAL', 'SYNDICATE', 'RESCUE_SHADOW'], voiceprint: CHAT_NPC_VOICEPRINTS.RIVAL, cadence: CHAT_NPC_CADENCE_PROFILES.RIVAL, presenceStyle: DEFAULT_HUMAN_PRESENCE_STYLE, typingHints: { signatureLengthBand: 'SHORT', punctuationDiscipline: 'BALANCED', reactsInstantlyToThreat: true, usesWeaponizedSilence: false, tendsToHoverBeforeReply: false, supportsTypingAbortTheater: false }, relationshipBias01: 0.71 as Score01, coldStartBoost: 0.8 as Score01, authority: SHARED_NPC_AUTHORITY, helperArchetype: DONOR_HELPER_CHARACTERS.RIVAL.archLabel, warmth01: 0.55 as Score01, directness01: 0.86 as Score01, reassurance01: 0.58 as Score01, helperCharacter: DONOR_HELPER_CHARACTERS.RIVAL, dialogueTree: DONOR_HELPER_DIALOGUE_TREES.RIVAL },
  ARCHIVIST: { npcKey: 'ARCHIVIST', npcId: 'npc:archivist' as ChatNpcId, npcClass: 'HELPER', actorKind: 'HELPER', displayName: DONOR_HELPER_CHARACTERS.ARCHIVIST.displayName, personaId: 'persona:archivist' as ChatNpcPersonaId, sceneRoles: ['CROWD_WITNESS', 'ECHO'], enabledChannels: ['GLOBAL', 'LOBBY', 'LIVEOPS_SHADOW'], voiceprint: CHAT_NPC_VOICEPRINTS.ARCHIVIST, cadence: CHAT_NPC_CADENCE_PROFILES.ARCHIVIST, presenceStyle: DEFAULT_HUMAN_PRESENCE_STYLE, typingHints: { signatureLengthBand: 'LONG', punctuationDiscipline: 'BALANCED', reactsInstantlyToThreat: false, usesWeaponizedSilence: false, tendsToHoverBeforeReply: true, supportsTypingAbortTheater: true }, relationshipBias01: 0.40 as Score01, coldStartBoost: 0.5 as Score01, authority: SHARED_NPC_AUTHORITY, helperArchetype: DONOR_HELPER_CHARACTERS.ARCHIVIST.archLabel, warmth01: 0.34 as Score01, directness01: 0.62 as Score01, reassurance01: 0.31 as Score01, helperCharacter: DONOR_HELPER_CHARACTERS.ARCHIVIST, dialogueTree: DONOR_HELPER_DIALOGUE_TREES.ARCHIVIST },
});

export const CHAT_AMBIENT_NPC_DESCRIPTORS: Readonly<Record<ChatAmbientNpcKey, any>> = Object.freeze({
  FLOOR_RUNNER: { npcKey: 'FLOOR_RUNNER', npcId: 'npc:floor-runner' as ChatNpcId, npcClass: 'AMBIENT', actorKind: 'NPC', displayName: 'FLOOR RUNNER', personaId: 'persona:floor-runner' as ChatNpcPersonaId, sceneRoles: ['CROWD_WITNESS'], enabledChannels: ['GLOBAL'], voiceprint: CHAT_NPC_VOICEPRINTS.FLOOR_RUNNER, cadence: CHAT_NPC_CADENCE_PROFILES.FLOOR_RUNNER, presenceStyle: DEFAULT_NPC_LURK_STYLE, typingHints: { signatureLengthBand: 'SHORT', punctuationDiscipline: 'SPARSE', reactsInstantlyToThreat: true, usesWeaponizedSilence: false, tendsToHoverBeforeReply: false, supportsTypingAbortTheater: false }, authority: SHARED_NPC_AUTHORITY, crowdArchetype: 'FAST_WITNESS', audienceWeight01: 0.65 as Score01, moodBias: 'ECSTATIC' },
  SYNDICATE_WHISPERER: { npcKey: 'SYNDICATE_WHISPERER', npcId: 'npc:syndicate-whisperer' as ChatNpcId, npcClass: 'AMBIENT', actorKind: 'NPC', displayName: 'SYNDICATE WHISPERER', personaId: 'persona:syndicate-whisperer' as ChatNpcPersonaId, sceneRoles: ['ECHO', 'SHADOW_MARKER'], enabledChannels: ['SYNDICATE', 'NPC_SHADOW'], voiceprint: CHAT_NPC_VOICEPRINTS.SYNDICATE_WHISPERER, cadence: CHAT_NPC_CADENCE_PROFILES.SYNDICATE_WHISPERER, presenceStyle: DEFAULT_SHADOW_STYLE, typingHints: { signatureLengthBand: 'MEDIUM', punctuationDiscipline: 'SPARSE', reactsInstantlyToThreat: false, usesWeaponizedSilence: true, tendsToHoverBeforeReply: true, supportsTypingAbortTheater: true }, authority: SHARED_NPC_AUTHORITY, crowdArchetype: 'PRIVATE_WITNESS', audienceWeight01: 0.58 as Score01, moodBias: 'SUSPICIOUS' },
  DEAL_ROOM_CLERK: { npcKey: 'DEAL_ROOM_CLERK', npcId: 'npc:deal-room-clerk' as ChatNpcId, npcClass: 'AMBIENT', actorKind: 'NPC', displayName: 'DEAL ROOM CLERK', personaId: 'persona:deal-room-clerk' as ChatNpcPersonaId, sceneRoles: ['OPENER', 'CLOSER'], enabledChannels: ['DEAL_ROOM'], voiceprint: CHAT_NPC_VOICEPRINTS.DEAL_ROOM_CLERK, cadence: CHAT_NPC_CADENCE_PROFILES.DEAL_ROOM_CLERK, presenceStyle: DEFAULT_HUMAN_PRESENCE_STYLE, typingHints: { signatureLengthBand: 'MEDIUM', punctuationDiscipline: 'BALANCED', reactsInstantlyToThreat: false, usesWeaponizedSilence: false, tendsToHoverBeforeReply: true, supportsTypingAbortTheater: false }, authority: SHARED_NPC_AUTHORITY, crowdArchetype: 'LEDGER_KEEPER', audienceWeight01: 0.51 as Score01, moodBias: 'PREDATORY' },
  LOBBY_SPECULATOR: { npcKey: 'LOBBY_SPECULATOR', npcId: 'npc:lobby-speculator' as ChatNpcId, npcClass: 'AMBIENT', actorKind: 'NPC', displayName: 'LOBBY SPECULATOR', personaId: 'persona:lobby-speculator' as ChatNpcPersonaId, sceneRoles: ['OPENER', 'CROWD_WITNESS'], enabledChannels: ['LOBBY', 'GLOBAL'], voiceprint: CHAT_NPC_VOICEPRINTS.LOBBY_SPECULATOR, cadence: CHAT_NPC_CADENCE_PROFILES.LOBBY_SPECULATOR, presenceStyle: DEFAULT_NPC_LURK_STYLE, typingHints: { signatureLengthBand: 'SHORT', punctuationDiscipline: 'SPARSE', reactsInstantlyToThreat: true, usesWeaponizedSilence: false, tendsToHoverBeforeReply: false, supportsTypingAbortTheater: false }, authority: SHARED_NPC_AUTHORITY, crowdArchetype: 'RUMOR_ENGINE', audienceWeight01: 0.60 as Score01, moodBias: 'ECSTATIC' },
  MARKET_WITNESS: { npcKey: 'MARKET_WITNESS', npcId: 'npc:market-witness' as ChatNpcId, npcClass: 'AMBIENT', actorKind: 'NPC', displayName: 'MARKET WITNESS', personaId: 'persona:market-witness' as ChatNpcPersonaId, sceneRoles: ['CROWD_WITNESS', 'ECHO'], enabledChannels: ['GLOBAL', 'LIVEOPS_SHADOW'], voiceprint: CHAT_NPC_VOICEPRINTS.MARKET_WITNESS, cadence: CHAT_NPC_CADENCE_PROFILES.MARKET_WITNESS, presenceStyle: DEFAULT_NPC_LURK_STYLE, typingHints: { signatureLengthBand: 'MEDIUM', punctuationDiscipline: 'BALANCED', reactsInstantlyToThreat: false, usesWeaponizedSilence: false, tendsToHoverBeforeReply: true, supportsTypingAbortTheater: false }, authority: SHARED_NPC_AUTHORITY, crowdArchetype: 'PUBLIC_MEMORY', audienceWeight01: 0.55 as Score01, moodBias: 'MOURNFUL' },
});

export const CHAT_ALL_NPC_DESCRIPTORS: Readonly<Record<ChatKnownNpcKey, ChatAnyNpcDescriptor>> = Object.freeze({
  ...CHAT_HATER_NPC_DESCRIPTORS,
  ...CHAT_HELPER_NPC_DESCRIPTORS,
  ...CHAT_AMBIENT_NPC_DESCRIPTORS,
});

// ============================================================================
// MARK: Utility guards and selectors
// ============================================================================

export const isChatDialogueContext = (value: string): value is ChatDialogueContext =>
  (CHAT_DIALOGUE_CONTEXTS as readonly string[]).includes(value);

export const isHaterNpcKey = (value: string): value is ChatHaterNpcKey =>
  (CHAT_HATER_NPC_KEYS as readonly string[]).includes(value);

export const isHelperNpcKey = (value: string): value is ChatHelperNpcKey =>
  (CHAT_HELPER_NPC_KEYS as readonly string[]).includes(value);

export const isAmbientNpcKey = (value: string): value is ChatAmbientNpcKey =>
  (CHAT_AMBIENT_NPC_KEYS as readonly string[]).includes(value);

export const getNpcDescriptor = (npcKey: ChatKnownNpcKey): ChatAnyNpcDescriptor =>
  CHAT_ALL_NPC_DESCRIPTORS[npcKey];

export const getNpcChannelDescriptors = (
  npcKey: ChatKnownNpcKey,
): readonly ChatChannelDescriptor[] =>
  getNpcDescriptor(npcKey).enabledChannels.map((channelId) => CHAT_CHANNEL_DESCRIPTORS[channelId]);

export const getDialogueTreeForNpc = (
  npcKey: ChatKnownNpcKey,
): ChatPartialDialogueTree | Nullable<ChatDialogueTree> => {
  if (isHaterNpcKey(npcKey)) return CHAT_HATER_NPC_DESCRIPTORS[npcKey].dialogueTree;
  if (isHelperNpcKey(npcKey)) return CHAT_HELPER_NPC_DESCRIPTORS[npcKey].dialogueTree;
  return CHAT_AMBIENT_NPC_DESCRIPTORS[npcKey].dialogueTree ?? null;
};

export const expandPartialDialogueTree = (
  partialTree: ChatPartialDialogueTree,
): ChatDialogueTree => {
  const result = {} as Record<ChatDialogueContext, readonly ChatDialogueLine[]>;
  for (const context of CHAT_DIALOGUE_CONTEXTS) {
    result[context] = partialTree[context] ?? [];
  }
  return Object.freeze(result);
};

export const selectDialogueCandidates = (
  npcKey: ChatKnownNpcKey,
  context: ChatDialogueContext,
  selectionContext: ChatNpcSelectionContext,
): readonly ChatNpcLineCandidate[] => {
  const descriptor = getNpcDescriptor(npcKey);
  const tree = getDialogueTreeForNpc(npcKey);
  const lines = tree ? (context in tree ? (tree as ChatDialogueTree | ChatPartialDialogueTree)[context] ?? [] : []) : [];
  return (lines as readonly ChatDialogueLine[]).map((line, index) => {
    const blockedBy = descriptor.enabledChannels.includes(selectionContext.channelId)
      ? undefined
      : 'CHANNEL_LOCKED';
    const tickGate = typeof line.minTick === 'number' && typeof selectionContext.tickNumber === 'number'
      ? selectionContext.tickNumber < line.minTick
      : false;
    const baseScore = Math.max(0, Math.min(1, line.weight));
    return Object.freeze({
      selectionId: `npc-selection:${npcKey}:${context}:${index}` as ChatNpcSelectionId,
      npcId: descriptor.npcId,
      npcKey,
      context,
      line,
      score01: (tickGate ? 0 : baseScore) as Score01,
      allowed: !blockedBy && !tickGate,
      blockedBy: blockedBy ?? (tickGate ? 'PLAYER_OVERLOADED' : undefined),
    });
  });
};

export const buildNpcRosterSnapshot = (
  roomId: ChatRoomId,
  channelId: ChatChannelId,
  descriptors: readonly ChatAnyNpcDescriptor[],
  speakingNpcIds: readonly ChatNpcId[] = [],
  typingNpcIds: readonly ChatNpcId[] = [],
  now: UnixMs = Date.now() as UnixMs,
): ChatNpcRosterSnapshot => {
  const visibleNpcIds = descriptors
    .filter((descriptor) => descriptor.enabledChannels.includes(channelId))
    .map((descriptor) => descriptor.npcId);
  const shadowNpcIds = descriptors
    .filter((descriptor) => descriptor.enabledChannels.some((id) => id.endsWith('_SHADOW')))
    .map((descriptor) => descriptor.npcId);
  return Object.freeze({
    rosterId: `npc-roster:${roomId}:${channelId}` as ChatNpcRosterId,
    roomId,
    channelId,
    visibleNpcIds,
    shadowNpcIds,
    speakingNpcIds,
    typingNpcIds,
    updatedAt: now,
  });
};

export const buildNpcRegistrySnapshot = (
  now: UnixMs = Date.now() as UnixMs,
): ChatNpcRegistrySnapshot => Object.freeze({
  registryId: SHARED_NPC_AUTHORITY.registryId,
  version: CHAT_CONTRACT_VERSION,
  descriptorCount: Object.keys(CHAT_ALL_NPC_DESCRIPTORS).length,
  haterCount: Object.keys(CHAT_HATER_NPC_DESCRIPTORS).length,
  helperCount: Object.keys(CHAT_HELPER_NPC_DESCRIPTORS).length,
  ambientCount: Object.keys(CHAT_AMBIENT_NPC_DESCRIPTORS).length,
  generatedAt: now,
});

export const toNpcMessageMetadata = (
  npcKey: ChatKnownNpcKey,
): ChatMessageNpcMetadata => {
  const descriptor = getNpcDescriptor(npcKey);
  return Object.freeze({
    npcId: descriptor.npcId,
    personaKey: descriptor.personaId,
    voiceprintKey: descriptor.voiceprint.voiceprintId,
    delayProfileKey: descriptor.cadence.cadencePolicyId,
    simulatedTypingTheater: descriptor.typingHints.supportsTypingAbortTheater,
  });
};

export const toNpcPresenceEntry = (
  npcKey: ChatKnownNpcKey,
  roomId: ChatRoomId,
  channelId: ChatChannelId,
  now: UnixMs = Date.now() as UnixMs,
): ChatPresenceEntry => {
  const descriptor = getNpcDescriptor(npcKey);
  return Object.freeze({
    presenceId: `presence:${descriptor.npcId}:${channelId}` as any,
    actorId: descriptor.npcId,
    actorKind: descriptor.actorKind,
    displayName: descriptor.displayName,
    role: descriptor.npcClass === 'HATER' ? 'NPC_ANTAGONIST' : descriptor.npcClass === 'HELPER' ? 'NPC_GUIDE' : 'NPC_AMBIENT',
    roomId,
    channelId,
    modeScope: undefined,
    mountTarget: undefined,
    mountPreset: undefined,
    presenceState: 'LURKING',
    visibilityClass: descriptor.npcClass === 'AMBIENT' ? 'PUBLIC' : descriptor.enabledChannels.some((id) => id.endsWith('_SHADOW')) ? 'SHADOW' : 'PUBLIC',
    style: descriptor.presenceStyle,
    cursorIntent: undefined,
    lastReadAtByChannel: {},
    lastActiveAt: now,
    joinedAt: now,
    updatedAt: now,
    isAuthoritative: false,
    playerVisible: descriptor.enabledChannels.includes(channelId),
    suppressionReasons: [],
    customData: { npcKey },
  }) as unknown as ChatPresenceEntry;
};

export const deriveNpcTypingStyleAssignment = (
  npcKey: ChatKnownNpcKey,
): Optional<ChatTypingStyleAssignment> => getNpcDescriptor(npcKey).typingStyleAssignment;

export const resolveNpcSceneRole = (
  npcKey: ChatKnownNpcKey,
  momentType: Optional<ChatMomentType>,
): ChatNpcSceneRole => {
  const descriptor = getNpcDescriptor(npcKey);
  if (momentType === 'HELPER_RESCUE') return descriptor.npcClass === 'HELPER' ? 'HELPER_INTERCEPTOR' : 'ECHO';
  if (momentType === 'SOVEREIGNTY_ACHIEVED') return 'CROWD_WITNESS';
  return descriptor.sceneRoles[0] ?? 'ECHO';
};

export interface ChatNpcContractsNamespace {
  readonly version: typeof CHAT_CONTRACT_VERSION;
  readonly authorities: typeof CHAT_CONTRACT_AUTHORITIES;
  readonly haterKeys: typeof CHAT_HATER_NPC_KEYS;
  readonly helperKeys: typeof CHAT_HELPER_NPC_KEYS;
  readonly ambientKeys: typeof CHAT_AMBIENT_NPC_KEYS;
  readonly dialogueContexts: typeof CHAT_DIALOGUE_CONTEXTS;
}

export const CHAT_NPC_CONTRACT_NAMESPACE: ChatNpcContractsNamespace = Object.freeze({
  version: CHAT_CONTRACT_VERSION,
  authorities: CHAT_CONTRACT_AUTHORITIES,
  haterKeys: CHAT_HATER_NPC_KEYS,
  helperKeys: CHAT_HELPER_NPC_KEYS,
  ambientKeys: CHAT_AMBIENT_NPC_KEYS,
  dialogueContexts: CHAT_DIALOGUE_CONTEXTS,
});
