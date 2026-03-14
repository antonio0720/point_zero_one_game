/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT NPC REGISTRY
 * FILE: backend/src/game/engine/chat/npc/HelperDialogueRegistry.ts
 * ============================================================================
 *
 * Doctrine
 * --------
 * - this file is the canonical backend registry for helper and rescue-side voices
 * - helper appearance is supportive, but still policy-bound and cadence-governed
 * - cold-start favor, rescue timing, and late-run restraint belong to backend truth
 * - frontend may mirror warmth and preview interventions, but backend approves lines
 */

export type HelperPersonaId =
  | 'MENTOR'
  | 'INSIDER'
  | 'SURVIVOR'
  | 'RIVAL'
  | 'ARCHIVIST'
;

export type HelperDialogueContext =
  | 'GAME_START'
  | 'PLAYER_NEAR_BANKRUPTCY'
  | 'PLAYER_IDLE'
  | 'PLAYER_CARD_PLAY'
  | 'PLAYER_SHIELD_BREAK'
  | 'CASCADE_CHAIN'
  | 'PLAYER_INCOME_UP'
  | 'PLAYER_COMEBACK'
  | 'PLAYER_RESPONSE_ANGRY'
  | 'PLAYER_RESPONSE_FLEX'
  | 'BOT_DEFEATED'
  | 'NEAR_SOVEREIGNTY'
  | 'PLAYER_LOST'
;

export type HelperChannelAffinity = 'GLOBAL' | 'SYNDICATE' | 'DEAL_ROOM' | 'LOBBY';
export type HelperInterventionAxis = 'grounding' | 'mechanics' | 'resilience' | 'competitive_motivation' | 'memory';

export interface HelperDialogueLine {
  readonly id: string;
  readonly personaId: HelperPersonaId;
  readonly context: HelperDialogueContext;
  readonly text: string;
  readonly weight: number;
  readonly minTick?: number;
  readonly maxUses?: number;
  readonly tags: readonly string[];
  readonly frustrationFit: number;
  readonly confidenceFit: number;
  readonly coldStartFit: number;
  readonly urgencyFit: number;
  readonly cadenceFloorMs: number;
}

export interface HelperPersonaProfile {
  readonly id: HelperPersonaId;
  readonly displayName: string;
  readonly archetypeLabel: string;
  readonly emoji: string;
  readonly role: string;
  readonly warmth: number;
  readonly directness: number;
  readonly frequency: number;
  readonly coldStartBoost: number;
  readonly idleTriggerTicks: number;
  readonly triggerConditions: readonly HelperDialogueContext[];
  readonly axis: HelperInterventionAxis;
  readonly channelAffinity: HelperChannelAffinity;
  readonly tags: readonly string[];
}

export interface HelperSelectionInput {
  readonly personaId?: HelperPersonaId;
  readonly context: HelperDialogueContext;
  readonly tick?: number;
  readonly frustration?: number;
  readonly confidence?: number;
  readonly coldStart?: number;
  readonly urgency?: number;
  readonly useCountByLineId?: Readonly<Record<string, number>>;
  readonly bannedTags?: readonly string[];
}

export interface HelperScenarioCandidate {
  readonly persona: HelperPersonaProfile;
  readonly line: HelperDialogueLine;
  readonly score: number;
}

export interface HelperRegistrySnapshot {
  readonly personas: readonly HelperPersonaProfile[];
  readonly totalLines: number;
  readonly contexts: readonly HelperDialogueContext[];
  readonly linesByPersona: Readonly<Record<HelperPersonaId, number>>;
}

const clamp01 = (value: number | undefined): number => {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
};

const stableHash = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
};

const stableLineId = (personaId: HelperPersonaId, context: HelperDialogueContext, ordinal: number, text: string): string => {
  const suffix = stableHash(`${personaId}:${context}:${ordinal}:${text}`).toString(36);
  return `hlp_${personaId.toLowerCase()}_${context.toLowerCase()}_${ordinal}_${suffix}`;
};

const DEFAULT_CONTEXTS = Object.freeze([
  'GAME_START',
  'PLAYER_NEAR_BANKRUPTCY',
  'PLAYER_IDLE',
  'PLAYER_CARD_PLAY',
  'PLAYER_SHIELD_BREAK',
  'CASCADE_CHAIN',
  'PLAYER_INCOME_UP',
  'PLAYER_COMEBACK',
  'PLAYER_RESPONSE_ANGRY',
  'PLAYER_RESPONSE_FLEX',
  'BOT_DEFEATED',
  'NEAR_SOVEREIGNTY',
  'PLAYER_LOST',
] as const satisfies readonly HelperDialogueContext[]);

const HELPER_PERSONA_PROFILES = Object.freeze({
  MENTOR: Object.freeze({
    id: 'MENTOR',
    displayName: 'THE MENTOR',
    archetypeLabel: 'Strategic Advisor',
    emoji: '🜂',
    role: 'anchor voice for strategy and composure',
    warmth: 0.90,
    directness: 0.72,
    frequency: 0.60,
    coldStartBoost: 2.00,
    idleTriggerTicks: 3,
    triggerConditions: Object.freeze(["PLAYER_NEAR_BANKRUPTCY", "PLAYER_IDLE", "GAME_START", "NEAR_SOVEREIGNTY"] as const satisfies readonly HelperDialogueContext[]),
    axis: 'grounding' as const,
    channelAffinity: 'GLOBAL' as const,
    tags: Object.freeze(["grounding", "global", "helper"]),
  }),
  INSIDER: Object.freeze({
    id: 'INSIDER',
    displayName: 'THE INSIDER',
    archetypeLabel: 'Market Intelligence',
    emoji: '🜁',
    role: 'reveals hidden mechanics, bot windows, and card interactions',
    warmth: 0.42,
    directness: 0.92,
    frequency: 0.30,
    coldStartBoost: 1.50,
    idleTriggerTicks: 8,
    triggerConditions: Object.freeze(["PLAYER_CARD_PLAY", "CASCADE_CHAIN", "PLAYER_SHIELD_BREAK"] as const satisfies readonly HelperDialogueContext[]),
    axis: 'mechanics' as const,
    channelAffinity: 'SYNDICATE' as const,
    tags: Object.freeze(["mechanics", "syndicate", "helper"]),
  }),
  SURVIVOR: Object.freeze({
    id: 'SURVIVOR',
    displayName: 'THE SURVIVOR',
    archetypeLabel: 'Crisis Veteran',
    emoji: '🜃',
    role: 'keeps the player in the run during darkest states',
    warmth: 1.00,
    directness: 0.50,
    frequency: 0.40,
    coldStartBoost: 1.80,
    idleTriggerTicks: 2,
    triggerConditions: Object.freeze(["PLAYER_NEAR_BANKRUPTCY", "PLAYER_LOST", "PLAYER_RESPONSE_ANGRY"] as const satisfies readonly HelperDialogueContext[]),
    axis: 'resilience' as const,
    channelAffinity: 'GLOBAL' as const,
    tags: Object.freeze(["resilience", "global", "helper"]),
  }),
  RIVAL: Object.freeze({
    id: 'RIVAL',
    displayName: 'THE RIVAL',
    archetypeLabel: 'Friendly Competitor',
    emoji: '⚡',
    role: 'competitive push without betrayal',
    warmth: 0.50,
    directness: 0.82,
    frequency: 0.35,
    coldStartBoost: 0.80,
    idleTriggerTicks: 10,
    triggerConditions: Object.freeze(["PLAYER_INCOME_UP", "PLAYER_COMEBACK", "NEAR_SOVEREIGNTY", "PLAYER_RESPONSE_FLEX"] as const satisfies readonly HelperDialogueContext[]),
    axis: 'competitive_motivation' as const,
    channelAffinity: 'SYNDICATE' as const,
    tags: Object.freeze(["competitive_motivation", "syndicate", "helper"]),
  }),
  ARCHIVIST: Object.freeze({
    id: 'ARCHIVIST',
    displayName: 'THE ARCHIVIST',
    archetypeLabel: 'Lore Keeper',
    emoji: '🜄',
    role: 'turns events into history, statistics, and meaning',
    warmth: 0.34,
    directness: 0.63,
    frequency: 0.20,
    coldStartBoost: 0.50,
    idleTriggerTicks: 12,
    triggerConditions: Object.freeze(["GAME_START", "PLAYER_LOST", "CASCADE_CHAIN", "NEAR_SOVEREIGNTY"] as const satisfies readonly HelperDialogueContext[]),
    axis: 'memory' as const,
    channelAffinity: 'LOBBY' as const,
    tags: Object.freeze(["memory", "lobby", "helper"]),
  }),
} as const satisfies Readonly<Record<HelperPersonaId, HelperPersonaProfile>>);

const RAW_HELPER_DIALOGUE = Object.freeze({
  MENTOR: Object.freeze({
    GAME_START: Object.freeze([
      Object.freeze({
        text: 'THE MENTOR: Opening ticks are for shape, not panic. Establish rhythm before the board starts arguing back.',
        weight: 0.96,
        maxUses: 3,
        tags: Object.freeze(["grounding", "game_start", "global"]),
        frustrationFit: 0.32,
        confidenceFit: 0.42,
        coldStartFit: 0.90,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE MENTOR: New run. Read the room, read your hand, then let the first move serve a plan instead of a mood.',
        weight: 0.85,
        maxUses: 3,
        tags: Object.freeze(["grounding", "game_start", "global"]),
        frustrationFit: 0.32,
        confidenceFit: 0.42,
        coldStartFit: 0.90,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE MENTOR: Start clean. grounding matters most before pressure gets loud.',
        weight: 0.74,
        maxUses: 3,
        tags: Object.freeze(["grounding", "game_start", "global"]),
        frustrationFit: 0.32,
        confidenceFit: 0.42,
        coldStartFit: 0.90,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
    ]),
    PLAYER_NEAR_BANKRUPTCY: Object.freeze([
      Object.freeze({
        text: 'THE MENTOR: This state is dangerous, not final. Shrink the problem until the next good decision fits in your hands.',
        weight: 0.96,
        maxUses: 3,
        tags: Object.freeze(["grounding", "player_near_bankruptcy", "global"]),
        frustrationFit: 0.72,
        confidenceFit: 0.42,
        coldStartFit: 0.90,
        urgencyFit: 0.80,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE MENTOR: Protect breathing room first. You do not need brilliance here. You need one correct step that buys the second.',
        weight: 0.85,
        maxUses: 3,
        tags: Object.freeze(["grounding", "player_near_bankruptcy", "global"]),
        frustrationFit: 0.72,
        confidenceFit: 0.42,
        coldStartFit: 0.90,
        urgencyFit: 0.80,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE MENTOR: Don\'t negotiate with panic. Rebuild sequence: stabilize, restore cash, then reopen ambition.',
        weight: 0.74,
        maxUses: 3,
        tags: Object.freeze(["grounding", "player_near_bankruptcy", "global"]),
        frustrationFit: 0.72,
        confidenceFit: 0.42,
        coldStartFit: 0.90,
        urgencyFit: 0.80,
        cadenceFloorMs: 2200,
      }),
    ]),
    PLAYER_IDLE: Object.freeze([
      Object.freeze({
        text: 'THE MENTOR: If you\'re pausing to think, make the pause useful. Name the immediate threat and the next safe card.',
        weight: 0.96,
        maxUses: 3,
        tags: Object.freeze(["grounding", "player_idle", "global"]),
        frustrationFit: 0.32,
        confidenceFit: 0.42,
        coldStartFit: 0.90,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE MENTOR: Delay can help if it clarifies priority. It hurts if it keeps you emotionally attached to a dead line.',
        weight: 0.85,
        maxUses: 3,
        tags: Object.freeze(["grounding", "player_idle", "global"]),
        frustrationFit: 0.32,
        confidenceFit: 0.42,
        coldStartFit: 0.90,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE MENTOR: Freeze less. Filter more. What matters in the next two ticks?',
        weight: 0.74,
        maxUses: 3,
        tags: Object.freeze(["grounding", "player_idle", "global"]),
        frustrationFit: 0.32,
        confidenceFit: 0.42,
        coldStartFit: 0.90,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
    ]),
    PLAYER_CARD_PLAY: Object.freeze([
      Object.freeze({
        text: 'THE MENTOR: Good. Now ask what this card enables, what it exposes, and what it dares the room to do next.',
        weight: 0.96,
        maxUses: 3,
        tags: Object.freeze(["grounding", "player_card_play", "global"]),
        frustrationFit: 0.32,
        confidenceFit: 0.42,
        coldStartFit: 0.90,
        urgencyFit: 0.35,
        cadenceFloorMs: 1600,
      }),
      Object.freeze({
        text: 'THE MENTOR: Cards are not isolated. Every play edits tempo, threat, and what the opposition thinks you value.',
        weight: 0.85,
        maxUses: 3,
        tags: Object.freeze(["grounding", "player_card_play", "global"]),
        frustrationFit: 0.32,
        confidenceFit: 0.42,
        coldStartFit: 0.90,
        urgencyFit: 0.35,
        cadenceFloorMs: 1600,
      }),
      Object.freeze({
        text: 'THE MENTOR: Strong move if you follow it correctly. Weak move if you admire it too long.',
        weight: 0.74,
        maxUses: 3,
        tags: Object.freeze(["grounding", "player_card_play", "global"]),
        frustrationFit: 0.32,
        confidenceFit: 0.42,
        coldStartFit: 0.90,
        urgencyFit: 0.35,
        cadenceFloorMs: 1600,
      }),
    ]),
    PLAYER_SHIELD_BREAK: Object.freeze([
      Object.freeze({
        text: 'THE MENTOR: Breach hurts because it narrows options. Repair the layer that restores choice, not just the layer that looks dramatic.',
        weight: 0.96,
        maxUses: 3,
        tags: Object.freeze(["grounding", "player_shield_break", "global"]),
        frustrationFit: 0.32,
        confidenceFit: 0.42,
        coldStartFit: 0.90,
        urgencyFit: 0.80,
        cadenceFloorMs: 1600,
      }),
      Object.freeze({
        text: 'THE MENTOR: Broken shielding is information. The board just told you where it believes you are thin.',
        weight: 0.85,
        maxUses: 3,
        tags: Object.freeze(["grounding", "player_shield_break", "global"]),
        frustrationFit: 0.32,
        confidenceFit: 0.42,
        coldStartFit: 0.90,
        urgencyFit: 0.80,
        cadenceFloorMs: 1600,
      }),
      Object.freeze({
        text: 'THE MENTOR: Don\'t answer a breach with ego. Answer it with sequence and stack discipline.',
        weight: 0.74,
        maxUses: 3,
        tags: Object.freeze(["grounding", "player_shield_break", "global"]),
        frustrationFit: 0.32,
        confidenceFit: 0.42,
        coldStartFit: 0.90,
        urgencyFit: 0.80,
        cadenceFloorMs: 1600,
      }),
    ]),
    CASCADE_CHAIN: Object.freeze([
      Object.freeze({
        text: 'THE MENTOR: Cascades are momentum with honesty attached. Interrupt the bad one or route it into something you can survive.',
        weight: 0.96,
        maxUses: 3,
        tags: Object.freeze(["grounding", "cascade_chain", "global"]),
        frustrationFit: 0.32,
        confidenceFit: 0.42,
        coldStartFit: 0.90,
        urgencyFit: 0.80,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE MENTOR: Count dependencies fast. The chain only feels magical when you haven\'t mapped the bridges.',
        weight: 0.85,
        maxUses: 3,
        tags: Object.freeze(["grounding", "cascade_chain", "global"]),
        frustrationFit: 0.32,
        confidenceFit: 0.42,
        coldStartFit: 0.90,
        urgencyFit: 0.80,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE MENTOR: This is where calm players outperform clever players.',
        weight: 0.74,
        maxUses: 3,
        tags: Object.freeze(["grounding", "cascade_chain", "global"]),
        frustrationFit: 0.32,
        confidenceFit: 0.42,
        coldStartFit: 0.90,
        urgencyFit: 0.80,
        cadenceFloorMs: 2200,
      }),
    ]),
    PLAYER_INCOME_UP: Object.freeze([
      Object.freeze({
        text: 'THE MENTOR: Nice lift. Now prove the gain is durable by defending it before you celebrate it.',
        weight: 0.96,
        maxUses: 3,
        tags: Object.freeze(["grounding", "player_income_up", "global"]),
        frustrationFit: 0.32,
        confidenceFit: 0.92,
        coldStartFit: 0.90,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE MENTOR: Growth expands possibility and visibility at the same time. Secure one, expect the other.',
        weight: 0.85,
        maxUses: 3,
        tags: Object.freeze(["grounding", "player_income_up", "global"]),
        frustrationFit: 0.32,
        confidenceFit: 0.92,
        coldStartFit: 0.90,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE MENTOR: Income is momentum. Convert some of it into stability before the room taxes your joy.',
        weight: 0.74,
        maxUses: 3,
        tags: Object.freeze(["grounding", "player_income_up", "global"]),
        frustrationFit: 0.32,
        confidenceFit: 0.92,
        coldStartFit: 0.90,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
    ]),
    PLAYER_COMEBACK: Object.freeze([
      Object.freeze({
        text: 'THE MENTOR: Good recovery. Don\'t rush to make the comeback feel poetic. Make it hard to reverse.',
        weight: 0.96,
        maxUses: 3,
        tags: Object.freeze(["grounding", "player_comeback", "global"]),
        frustrationFit: 0.32,
        confidenceFit: 0.92,
        coldStartFit: 0.90,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE MENTOR: Climbing out matters. What matters more is whether you changed the structure that put you there.',
        weight: 0.85,
        maxUses: 3,
        tags: Object.freeze(["grounding", "player_comeback", "global"]),
        frustrationFit: 0.32,
        confidenceFit: 0.92,
        coldStartFit: 0.90,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE MENTOR: Momentum returned. Protect the engine, not your pride.',
        weight: 0.74,
        maxUses: 3,
        tags: Object.freeze(["grounding", "player_comeback", "global"]),
        frustrationFit: 0.32,
        confidenceFit: 0.92,
        coldStartFit: 0.90,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
    ]),
    PLAYER_RESPONSE_ANGRY: Object.freeze([
      Object.freeze({
        text: 'THE MENTOR: Anger is allowed. Let it speak once, then put it to work somewhere measurable.',
        weight: 0.96,
        maxUses: 3,
        tags: Object.freeze(["grounding", "player_response_angry", "global"]),
        frustrationFit: 0.72,
        confidenceFit: 0.42,
        coldStartFit: 0.90,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE MENTOR: The board wants emotional overcommitment from you. Deny it that luxury.',
        weight: 0.85,
        maxUses: 3,
        tags: Object.freeze(["grounding", "player_response_angry", "global"]),
        frustrationFit: 0.72,
        confidenceFit: 0.42,
        coldStartFit: 0.90,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE MENTOR: Keep the fire. Lose the blur.',
        weight: 0.74,
        maxUses: 3,
        tags: Object.freeze(["grounding", "player_response_angry", "global"]),
        frustrationFit: 0.72,
        confidenceFit: 0.42,
        coldStartFit: 0.90,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
    ]),
    PLAYER_RESPONSE_FLEX: Object.freeze([
      Object.freeze({
        text: 'THE MENTOR: Confidence is earned twice — once by the gain, again by how quietly you can hold it.',
        weight: 0.96,
        maxUses: 3,
        tags: Object.freeze(["grounding", "player_response_flex", "global"]),
        frustrationFit: 0.32,
        confidenceFit: 0.92,
        coldStartFit: 0.90,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE MENTOR: Flex later. Stabilize now.',
        weight: 0.85,
        maxUses: 3,
        tags: Object.freeze(["grounding", "player_response_flex", "global"]),
        frustrationFit: 0.32,
        confidenceFit: 0.92,
        coldStartFit: 0.90,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE MENTOR: I like the energy. I love it more when it survives the next counter.',
        weight: 0.74,
        maxUses: 3,
        tags: Object.freeze(["grounding", "player_response_flex", "global"]),
        frustrationFit: 0.32,
        confidenceFit: 0.92,
        coldStartFit: 0.90,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
    ]),
    BOT_DEFEATED: Object.freeze([
      Object.freeze({
        text: 'THE MENTOR: Good neutralization. Treat the opening as brief and profitable, not permanent and safe.',
        weight: 0.96,
        maxUses: 3,
        tags: Object.freeze(["grounding", "bot_defeated", "global"]),
        frustrationFit: 0.32,
        confidenceFit: 0.42,
        coldStartFit: 0.90,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE MENTOR: One adversary down means one doctrine solved. Stay awake for the doctrine you haven\'t seen yet.',
        weight: 0.85,
        maxUses: 3,
        tags: Object.freeze(["grounding", "bot_defeated", "global"]),
        frustrationFit: 0.32,
        confidenceFit: 0.42,
        coldStartFit: 0.90,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE MENTOR: Earn the space you just created.',
        weight: 0.74,
        maxUses: 3,
        tags: Object.freeze(["grounding", "bot_defeated", "global"]),
        frustrationFit: 0.32,
        confidenceFit: 0.42,
        coldStartFit: 0.90,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
    ]),
    NEAR_SOVEREIGNTY: Object.freeze([
      Object.freeze({
        text: 'THE MENTOR: Late run now. Shrink every move to the minimum error surface and let discipline finish what ambition started.',
        weight: 0.96,
        minTick: 400,
        maxUses: 1,
        tags: Object.freeze(["grounding", "near_sovereignty", "global"]),
        frustrationFit: 0.32,
        confidenceFit: 0.92,
        coldStartFit: 0.90,
        urgencyFit: 0.80,
        cadenceFloorMs: 3000,
      }),
      Object.freeze({
        text: 'THE MENTOR: You\'re close enough that the room will try to rush you. Refuse the tempo it offers.',
        weight: 0.85,
        minTick: 400,
        maxUses: 3,
        tags: Object.freeze(["grounding", "near_sovereignty", "global"]),
        frustrationFit: 0.32,
        confidenceFit: 0.92,
        coldStartFit: 0.90,
        urgencyFit: 0.80,
        cadenceFloorMs: 3000,
      }),
      Object.freeze({
        text: 'THE MENTOR: Finish clean. Not loud. Clean.',
        weight: 0.74,
        minTick: 400,
        maxUses: 3,
        tags: Object.freeze(["grounding", "near_sovereignty", "global"]),
        frustrationFit: 0.32,
        confidenceFit: 0.92,
        coldStartFit: 0.90,
        urgencyFit: 0.80,
        cadenceFloorMs: 3000,
      }),
    ]),
    PLAYER_LOST: Object.freeze([
      Object.freeze({
        text: 'THE MENTOR: Archive the run honestly. Painful data becomes leverage if you keep it intact.',
        weight: 0.96,
        maxUses: 1,
        tags: Object.freeze(["grounding", "player_lost", "global"]),
        frustrationFit: 0.72,
        confidenceFit: 0.42,
        coldStartFit: 0.90,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE MENTOR: Loss is not a verdict here. It\'s a revealed model. Study the reveal.',
        weight: 0.85,
        maxUses: 3,
        tags: Object.freeze(["grounding", "player_lost", "global"]),
        frustrationFit: 0.72,
        confidenceFit: 0.42,
        coldStartFit: 0.90,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE MENTOR: Let the ending teach sequence, not identity.',
        weight: 0.74,
        maxUses: 3,
        tags: Object.freeze(["grounding", "player_lost", "global"]),
        frustrationFit: 0.72,
        confidenceFit: 0.42,
        coldStartFit: 0.90,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
    ]),
  }),
  INSIDER: Object.freeze({
    GAME_START: Object.freeze([
      Object.freeze({
        text: 'THE INSIDER: Opening ticks are for shape, not panic. Establish rhythm before the board starts arguing back.',
        weight: 0.96,
        maxUses: 3,
        tags: Object.freeze(["mechanics", "game_start", "syndicate"]),
        frustrationFit: 0.42,
        confidenceFit: 0.48,
        coldStartFit: 0.60,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE INSIDER: New run. Read the room, read your hand, then let the first move serve a plan instead of a mood.',
        weight: 0.85,
        maxUses: 3,
        tags: Object.freeze(["mechanics", "game_start", "syndicate"]),
        frustrationFit: 0.42,
        confidenceFit: 0.48,
        coldStartFit: 0.60,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE INSIDER: Start clean. mechanics matters most before pressure gets loud.',
        weight: 0.74,
        maxUses: 3,
        tags: Object.freeze(["mechanics", "game_start", "syndicate"]),
        frustrationFit: 0.42,
        confidenceFit: 0.48,
        coldStartFit: 0.60,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
    ]),
    PLAYER_NEAR_BANKRUPTCY: Object.freeze([
      Object.freeze({
        text: 'THE INSIDER: This state is dangerous, not final. Shrink the problem until the next good decision fits in your hands.',
        weight: 0.96,
        maxUses: 3,
        tags: Object.freeze(["mechanics", "player_near_bankruptcy", "syndicate"]),
        frustrationFit: 0.82,
        confidenceFit: 0.48,
        coldStartFit: 0.60,
        urgencyFit: 0.80,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE INSIDER: Protect breathing room first. You do not need brilliance here. You need one correct step that buys the second.',
        weight: 0.85,
        maxUses: 3,
        tags: Object.freeze(["mechanics", "player_near_bankruptcy", "syndicate"]),
        frustrationFit: 0.82,
        confidenceFit: 0.48,
        coldStartFit: 0.60,
        urgencyFit: 0.80,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE INSIDER: Don\'t negotiate with panic. Rebuild sequence: stabilize, restore cash, then reopen ambition.',
        weight: 0.74,
        maxUses: 3,
        tags: Object.freeze(["mechanics", "player_near_bankruptcy", "syndicate"]),
        frustrationFit: 0.82,
        confidenceFit: 0.48,
        coldStartFit: 0.60,
        urgencyFit: 0.80,
        cadenceFloorMs: 2200,
      }),
    ]),
    PLAYER_IDLE: Object.freeze([
      Object.freeze({
        text: 'THE INSIDER: If you\'re pausing to think, make the pause useful. Name the immediate threat and the next safe card.',
        weight: 0.96,
        maxUses: 3,
        tags: Object.freeze(["mechanics", "player_idle", "syndicate"]),
        frustrationFit: 0.42,
        confidenceFit: 0.48,
        coldStartFit: 0.60,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE INSIDER: Delay can help if it clarifies priority. It hurts if it keeps you emotionally attached to a dead line.',
        weight: 0.85,
        maxUses: 3,
        tags: Object.freeze(["mechanics", "player_idle", "syndicate"]),
        frustrationFit: 0.42,
        confidenceFit: 0.48,
        coldStartFit: 0.60,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE INSIDER: Freeze less. Filter more. What matters in the next two ticks?',
        weight: 0.74,
        maxUses: 3,
        tags: Object.freeze(["mechanics", "player_idle", "syndicate"]),
        frustrationFit: 0.42,
        confidenceFit: 0.48,
        coldStartFit: 0.60,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
    ]),
    PLAYER_CARD_PLAY: Object.freeze([
      Object.freeze({
        text: 'THE INSIDER: Good. Now ask what this card enables, what it exposes, and what it dares the room to do next.',
        weight: 0.96,
        maxUses: 3,
        tags: Object.freeze(["mechanics", "player_card_play", "syndicate"]),
        frustrationFit: 0.42,
        confidenceFit: 0.48,
        coldStartFit: 0.60,
        urgencyFit: 0.35,
        cadenceFloorMs: 1600,
      }),
      Object.freeze({
        text: 'THE INSIDER: Cards are not isolated. Every play edits tempo, threat, and what the opposition thinks you value.',
        weight: 0.85,
        maxUses: 3,
        tags: Object.freeze(["mechanics", "player_card_play", "syndicate"]),
        frustrationFit: 0.42,
        confidenceFit: 0.48,
        coldStartFit: 0.60,
        urgencyFit: 0.35,
        cadenceFloorMs: 1600,
      }),
      Object.freeze({
        text: 'THE INSIDER: Strong move if you follow it correctly. Weak move if you admire it too long.',
        weight: 0.74,
        maxUses: 3,
        tags: Object.freeze(["mechanics", "player_card_play", "syndicate"]),
        frustrationFit: 0.42,
        confidenceFit: 0.48,
        coldStartFit: 0.60,
        urgencyFit: 0.35,
        cadenceFloorMs: 1600,
      }),
    ]),
    PLAYER_SHIELD_BREAK: Object.freeze([
      Object.freeze({
        text: 'THE INSIDER: Breach hurts because it narrows options. Repair the layer that restores choice, not just the layer that looks dramatic.',
        weight: 0.96,
        maxUses: 3,
        tags: Object.freeze(["mechanics", "player_shield_break", "syndicate"]),
        frustrationFit: 0.42,
        confidenceFit: 0.48,
        coldStartFit: 0.60,
        urgencyFit: 0.80,
        cadenceFloorMs: 1600,
      }),
      Object.freeze({
        text: 'THE INSIDER: Broken shielding is information. The board just told you where it believes you are thin.',
        weight: 0.85,
        maxUses: 3,
        tags: Object.freeze(["mechanics", "player_shield_break", "syndicate"]),
        frustrationFit: 0.42,
        confidenceFit: 0.48,
        coldStartFit: 0.60,
        urgencyFit: 0.80,
        cadenceFloorMs: 1600,
      }),
      Object.freeze({
        text: 'THE INSIDER: Don\'t answer a breach with ego. Answer it with sequence and stack discipline.',
        weight: 0.74,
        maxUses: 3,
        tags: Object.freeze(["mechanics", "player_shield_break", "syndicate"]),
        frustrationFit: 0.42,
        confidenceFit: 0.48,
        coldStartFit: 0.60,
        urgencyFit: 0.80,
        cadenceFloorMs: 1600,
      }),
    ]),
    CASCADE_CHAIN: Object.freeze([
      Object.freeze({
        text: 'THE INSIDER: Cascades are momentum with honesty attached. Interrupt the bad one or route it into something you can survive.',
        weight: 0.96,
        maxUses: 3,
        tags: Object.freeze(["mechanics", "cascade_chain", "syndicate"]),
        frustrationFit: 0.42,
        confidenceFit: 0.48,
        coldStartFit: 0.60,
        urgencyFit: 0.80,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE INSIDER: Count dependencies fast. The chain only feels magical when you haven\'t mapped the bridges.',
        weight: 0.85,
        maxUses: 3,
        tags: Object.freeze(["mechanics", "cascade_chain", "syndicate"]),
        frustrationFit: 0.42,
        confidenceFit: 0.48,
        coldStartFit: 0.60,
        urgencyFit: 0.80,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE INSIDER: This is where calm players outperform clever players.',
        weight: 0.74,
        maxUses: 3,
        tags: Object.freeze(["mechanics", "cascade_chain", "syndicate"]),
        frustrationFit: 0.42,
        confidenceFit: 0.48,
        coldStartFit: 0.60,
        urgencyFit: 0.80,
        cadenceFloorMs: 2200,
      }),
    ]),
    PLAYER_INCOME_UP: Object.freeze([
      Object.freeze({
        text: 'THE INSIDER: Nice lift. Now prove the gain is durable by defending it before you celebrate it.',
        weight: 0.96,
        maxUses: 3,
        tags: Object.freeze(["mechanics", "player_income_up", "syndicate"]),
        frustrationFit: 0.42,
        confidenceFit: 0.95,
        coldStartFit: 0.60,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE INSIDER: Growth expands possibility and visibility at the same time. Secure one, expect the other.',
        weight: 0.85,
        maxUses: 3,
        tags: Object.freeze(["mechanics", "player_income_up", "syndicate"]),
        frustrationFit: 0.42,
        confidenceFit: 0.95,
        coldStartFit: 0.60,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE INSIDER: Income is momentum. Convert some of it into stability before the room taxes your joy.',
        weight: 0.74,
        maxUses: 3,
        tags: Object.freeze(["mechanics", "player_income_up", "syndicate"]),
        frustrationFit: 0.42,
        confidenceFit: 0.95,
        coldStartFit: 0.60,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
    ]),
    PLAYER_COMEBACK: Object.freeze([
      Object.freeze({
        text: 'THE INSIDER: Good recovery. Don\'t rush to make the comeback feel poetic. Make it hard to reverse.',
        weight: 0.96,
        maxUses: 3,
        tags: Object.freeze(["mechanics", "player_comeback", "syndicate"]),
        frustrationFit: 0.42,
        confidenceFit: 0.95,
        coldStartFit: 0.60,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE INSIDER: Climbing out matters. What matters more is whether you changed the structure that put you there.',
        weight: 0.85,
        maxUses: 3,
        tags: Object.freeze(["mechanics", "player_comeback", "syndicate"]),
        frustrationFit: 0.42,
        confidenceFit: 0.95,
        coldStartFit: 0.60,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE INSIDER: Momentum returned. Protect the engine, not your pride.',
        weight: 0.74,
        maxUses: 3,
        tags: Object.freeze(["mechanics", "player_comeback", "syndicate"]),
        frustrationFit: 0.42,
        confidenceFit: 0.95,
        coldStartFit: 0.60,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
    ]),
    PLAYER_RESPONSE_ANGRY: Object.freeze([
      Object.freeze({
        text: 'THE INSIDER: Anger is allowed. Let it speak once, then put it to work somewhere measurable.',
        weight: 0.96,
        maxUses: 3,
        tags: Object.freeze(["mechanics", "player_response_angry", "syndicate"]),
        frustrationFit: 0.82,
        confidenceFit: 0.48,
        coldStartFit: 0.60,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE INSIDER: The board wants emotional overcommitment from you. Deny it that luxury.',
        weight: 0.85,
        maxUses: 3,
        tags: Object.freeze(["mechanics", "player_response_angry", "syndicate"]),
        frustrationFit: 0.82,
        confidenceFit: 0.48,
        coldStartFit: 0.60,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE INSIDER: Keep the fire. Lose the blur.',
        weight: 0.74,
        maxUses: 3,
        tags: Object.freeze(["mechanics", "player_response_angry", "syndicate"]),
        frustrationFit: 0.82,
        confidenceFit: 0.48,
        coldStartFit: 0.60,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
    ]),
    PLAYER_RESPONSE_FLEX: Object.freeze([
      Object.freeze({
        text: 'THE INSIDER: Confidence is earned twice — once by the gain, again by how quietly you can hold it.',
        weight: 0.96,
        maxUses: 3,
        tags: Object.freeze(["mechanics", "player_response_flex", "syndicate"]),
        frustrationFit: 0.42,
        confidenceFit: 0.95,
        coldStartFit: 0.60,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE INSIDER: Flex later. Stabilize now.',
        weight: 0.85,
        maxUses: 3,
        tags: Object.freeze(["mechanics", "player_response_flex", "syndicate"]),
        frustrationFit: 0.42,
        confidenceFit: 0.95,
        coldStartFit: 0.60,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE INSIDER: I like the energy. I love it more when it survives the next counter.',
        weight: 0.74,
        maxUses: 3,
        tags: Object.freeze(["mechanics", "player_response_flex", "syndicate"]),
        frustrationFit: 0.42,
        confidenceFit: 0.95,
        coldStartFit: 0.60,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
    ]),
    BOT_DEFEATED: Object.freeze([
      Object.freeze({
        text: 'THE INSIDER: Good neutralization. Treat the opening as brief and profitable, not permanent and safe.',
        weight: 0.96,
        maxUses: 3,
        tags: Object.freeze(["mechanics", "bot_defeated", "syndicate"]),
        frustrationFit: 0.42,
        confidenceFit: 0.48,
        coldStartFit: 0.60,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE INSIDER: One adversary down means one doctrine solved. Stay awake for the doctrine you haven\'t seen yet.',
        weight: 0.85,
        maxUses: 3,
        tags: Object.freeze(["mechanics", "bot_defeated", "syndicate"]),
        frustrationFit: 0.42,
        confidenceFit: 0.48,
        coldStartFit: 0.60,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE INSIDER: Earn the space you just created.',
        weight: 0.74,
        maxUses: 3,
        tags: Object.freeze(["mechanics", "bot_defeated", "syndicate"]),
        frustrationFit: 0.42,
        confidenceFit: 0.48,
        coldStartFit: 0.60,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
    ]),
    NEAR_SOVEREIGNTY: Object.freeze([
      Object.freeze({
        text: 'THE INSIDER: Late run now. Shrink every move to the minimum error surface and let discipline finish what ambition started.',
        weight: 0.96,
        minTick: 400,
        maxUses: 1,
        tags: Object.freeze(["mechanics", "near_sovereignty", "syndicate"]),
        frustrationFit: 0.42,
        confidenceFit: 0.95,
        coldStartFit: 0.60,
        urgencyFit: 0.80,
        cadenceFloorMs: 3000,
      }),
      Object.freeze({
        text: 'THE INSIDER: You\'re close enough that the room will try to rush you. Refuse the tempo it offers.',
        weight: 0.85,
        minTick: 400,
        maxUses: 3,
        tags: Object.freeze(["mechanics", "near_sovereignty", "syndicate"]),
        frustrationFit: 0.42,
        confidenceFit: 0.95,
        coldStartFit: 0.60,
        urgencyFit: 0.80,
        cadenceFloorMs: 3000,
      }),
      Object.freeze({
        text: 'THE INSIDER: Finish clean. Not loud. Clean.',
        weight: 0.74,
        minTick: 400,
        maxUses: 3,
        tags: Object.freeze(["mechanics", "near_sovereignty", "syndicate"]),
        frustrationFit: 0.42,
        confidenceFit: 0.95,
        coldStartFit: 0.60,
        urgencyFit: 0.80,
        cadenceFloorMs: 3000,
      }),
    ]),
    PLAYER_LOST: Object.freeze([
      Object.freeze({
        text: 'THE INSIDER: Archive the run honestly. Painful data becomes leverage if you keep it intact.',
        weight: 0.96,
        maxUses: 1,
        tags: Object.freeze(["mechanics", "player_lost", "syndicate"]),
        frustrationFit: 0.82,
        confidenceFit: 0.48,
        coldStartFit: 0.60,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE INSIDER: Loss is not a verdict here. It\'s a revealed model. Study the reveal.',
        weight: 0.85,
        maxUses: 3,
        tags: Object.freeze(["mechanics", "player_lost", "syndicate"]),
        frustrationFit: 0.82,
        confidenceFit: 0.48,
        coldStartFit: 0.60,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE INSIDER: Let the ending teach sequence, not identity.',
        weight: 0.74,
        maxUses: 3,
        tags: Object.freeze(["mechanics", "player_lost", "syndicate"]),
        frustrationFit: 0.82,
        confidenceFit: 0.48,
        coldStartFit: 0.60,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
    ]),
  }),
  SURVIVOR: Object.freeze({
    GAME_START: Object.freeze([
      Object.freeze({
        text: 'THE SURVIVOR: Opening ticks are for shape, not panic. Establish rhythm before the board starts arguing back.',
        weight: 0.96,
        maxUses: 3,
        tags: Object.freeze(["resilience", "game_start", "global"]),
        frustrationFit: 0.30,
        confidenceFit: 0.35,
        coldStartFit: 0.72,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE SURVIVOR: New run. Read the room, read your hand, then let the first move serve a plan instead of a mood.',
        weight: 0.85,
        maxUses: 3,
        tags: Object.freeze(["resilience", "game_start", "global"]),
        frustrationFit: 0.30,
        confidenceFit: 0.35,
        coldStartFit: 0.72,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE SURVIVOR: Start clean. resilience matters most before pressure gets loud.',
        weight: 0.74,
        maxUses: 3,
        tags: Object.freeze(["resilience", "game_start", "global"]),
        frustrationFit: 0.30,
        confidenceFit: 0.35,
        coldStartFit: 0.72,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
    ]),
    PLAYER_NEAR_BANKRUPTCY: Object.freeze([
      Object.freeze({
        text: 'THE SURVIVOR: This state is dangerous, not final. Shrink the problem until the next good decision fits in your hands.',
        weight: 0.96,
        maxUses: 3,
        tags: Object.freeze(["resilience", "player_near_bankruptcy", "global"]),
        frustrationFit: 0.70,
        confidenceFit: 0.35,
        coldStartFit: 0.72,
        urgencyFit: 0.80,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE SURVIVOR: Protect breathing room first. You do not need brilliance here. You need one correct step that buys the second.',
        weight: 0.85,
        maxUses: 3,
        tags: Object.freeze(["resilience", "player_near_bankruptcy", "global"]),
        frustrationFit: 0.70,
        confidenceFit: 0.35,
        coldStartFit: 0.72,
        urgencyFit: 0.80,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE SURVIVOR: Don\'t negotiate with panic. Rebuild sequence: stabilize, restore cash, then reopen ambition.',
        weight: 0.74,
        maxUses: 3,
        tags: Object.freeze(["resilience", "player_near_bankruptcy", "global"]),
        frustrationFit: 0.70,
        confidenceFit: 0.35,
        coldStartFit: 0.72,
        urgencyFit: 0.80,
        cadenceFloorMs: 2200,
      }),
    ]),
    PLAYER_IDLE: Object.freeze([
      Object.freeze({
        text: 'THE SURVIVOR: If you\'re pausing to think, make the pause useful. Name the immediate threat and the next safe card.',
        weight: 0.96,
        maxUses: 3,
        tags: Object.freeze(["resilience", "player_idle", "global"]),
        frustrationFit: 0.30,
        confidenceFit: 0.35,
        coldStartFit: 0.72,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE SURVIVOR: Delay can help if it clarifies priority. It hurts if it keeps you emotionally attached to a dead line.',
        weight: 0.85,
        maxUses: 3,
        tags: Object.freeze(["resilience", "player_idle", "global"]),
        frustrationFit: 0.30,
        confidenceFit: 0.35,
        coldStartFit: 0.72,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE SURVIVOR: Freeze less. Filter more. What matters in the next two ticks?',
        weight: 0.74,
        maxUses: 3,
        tags: Object.freeze(["resilience", "player_idle", "global"]),
        frustrationFit: 0.30,
        confidenceFit: 0.35,
        coldStartFit: 0.72,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
    ]),
    PLAYER_CARD_PLAY: Object.freeze([
      Object.freeze({
        text: 'THE SURVIVOR: Good. Now ask what this card enables, what it exposes, and what it dares the room to do next.',
        weight: 0.96,
        maxUses: 3,
        tags: Object.freeze(["resilience", "player_card_play", "global"]),
        frustrationFit: 0.30,
        confidenceFit: 0.35,
        coldStartFit: 0.72,
        urgencyFit: 0.35,
        cadenceFloorMs: 1600,
      }),
      Object.freeze({
        text: 'THE SURVIVOR: Cards are not isolated. Every play edits tempo, threat, and what the opposition thinks you value.',
        weight: 0.85,
        maxUses: 3,
        tags: Object.freeze(["resilience", "player_card_play", "global"]),
        frustrationFit: 0.30,
        confidenceFit: 0.35,
        coldStartFit: 0.72,
        urgencyFit: 0.35,
        cadenceFloorMs: 1600,
      }),
      Object.freeze({
        text: 'THE SURVIVOR: Strong move if you follow it correctly. Weak move if you admire it too long.',
        weight: 0.74,
        maxUses: 3,
        tags: Object.freeze(["resilience", "player_card_play", "global"]),
        frustrationFit: 0.30,
        confidenceFit: 0.35,
        coldStartFit: 0.72,
        urgencyFit: 0.35,
        cadenceFloorMs: 1600,
      }),
    ]),
    PLAYER_SHIELD_BREAK: Object.freeze([
      Object.freeze({
        text: 'THE SURVIVOR: Breach hurts because it narrows options. Repair the layer that restores choice, not just the layer that looks dramatic.',
        weight: 0.96,
        maxUses: 3,
        tags: Object.freeze(["resilience", "player_shield_break", "global"]),
        frustrationFit: 0.30,
        confidenceFit: 0.35,
        coldStartFit: 0.72,
        urgencyFit: 0.80,
        cadenceFloorMs: 1600,
      }),
      Object.freeze({
        text: 'THE SURVIVOR: Broken shielding is information. The board just told you where it believes you are thin.',
        weight: 0.85,
        maxUses: 3,
        tags: Object.freeze(["resilience", "player_shield_break", "global"]),
        frustrationFit: 0.30,
        confidenceFit: 0.35,
        coldStartFit: 0.72,
        urgencyFit: 0.80,
        cadenceFloorMs: 1600,
      }),
      Object.freeze({
        text: 'THE SURVIVOR: Don\'t answer a breach with ego. Answer it with sequence and stack discipline.',
        weight: 0.74,
        maxUses: 3,
        tags: Object.freeze(["resilience", "player_shield_break", "global"]),
        frustrationFit: 0.30,
        confidenceFit: 0.35,
        coldStartFit: 0.72,
        urgencyFit: 0.80,
        cadenceFloorMs: 1600,
      }),
    ]),
    CASCADE_CHAIN: Object.freeze([
      Object.freeze({
        text: 'THE SURVIVOR: Cascades are momentum with honesty attached. Interrupt the bad one or route it into something you can survive.',
        weight: 0.96,
        maxUses: 3,
        tags: Object.freeze(["resilience", "cascade_chain", "global"]),
        frustrationFit: 0.30,
        confidenceFit: 0.35,
        coldStartFit: 0.72,
        urgencyFit: 0.80,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE SURVIVOR: Count dependencies fast. The chain only feels magical when you haven\'t mapped the bridges.',
        weight: 0.85,
        maxUses: 3,
        tags: Object.freeze(["resilience", "cascade_chain", "global"]),
        frustrationFit: 0.30,
        confidenceFit: 0.35,
        coldStartFit: 0.72,
        urgencyFit: 0.80,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE SURVIVOR: This is where calm players outperform clever players.',
        weight: 0.74,
        maxUses: 3,
        tags: Object.freeze(["resilience", "cascade_chain", "global"]),
        frustrationFit: 0.30,
        confidenceFit: 0.35,
        coldStartFit: 0.72,
        urgencyFit: 0.80,
        cadenceFloorMs: 2200,
      }),
    ]),
    PLAYER_INCOME_UP: Object.freeze([
      Object.freeze({
        text: 'THE SURVIVOR: Nice lift. Now prove the gain is durable by defending it before you celebrate it.',
        weight: 0.96,
        maxUses: 3,
        tags: Object.freeze(["resilience", "player_income_up", "global"]),
        frustrationFit: 0.30,
        confidenceFit: 0.85,
        coldStartFit: 0.72,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE SURVIVOR: Growth expands possibility and visibility at the same time. Secure one, expect the other.',
        weight: 0.85,
        maxUses: 3,
        tags: Object.freeze(["resilience", "player_income_up", "global"]),
        frustrationFit: 0.30,
        confidenceFit: 0.85,
        coldStartFit: 0.72,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE SURVIVOR: Income is momentum. Convert some of it into stability before the room taxes your joy.',
        weight: 0.74,
        maxUses: 3,
        tags: Object.freeze(["resilience", "player_income_up", "global"]),
        frustrationFit: 0.30,
        confidenceFit: 0.85,
        coldStartFit: 0.72,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
    ]),
    PLAYER_COMEBACK: Object.freeze([
      Object.freeze({
        text: 'THE SURVIVOR: Good recovery. Don\'t rush to make the comeback feel poetic. Make it hard to reverse.',
        weight: 0.96,
        maxUses: 3,
        tags: Object.freeze(["resilience", "player_comeback", "global"]),
        frustrationFit: 0.30,
        confidenceFit: 0.85,
        coldStartFit: 0.72,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE SURVIVOR: Climbing out matters. What matters more is whether you changed the structure that put you there.',
        weight: 0.85,
        maxUses: 3,
        tags: Object.freeze(["resilience", "player_comeback", "global"]),
        frustrationFit: 0.30,
        confidenceFit: 0.85,
        coldStartFit: 0.72,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE SURVIVOR: Momentum returned. Protect the engine, not your pride.',
        weight: 0.74,
        maxUses: 3,
        tags: Object.freeze(["resilience", "player_comeback", "global"]),
        frustrationFit: 0.30,
        confidenceFit: 0.85,
        coldStartFit: 0.72,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
    ]),
    PLAYER_RESPONSE_ANGRY: Object.freeze([
      Object.freeze({
        text: 'THE SURVIVOR: Anger is allowed. Let it speak once, then put it to work somewhere measurable.',
        weight: 0.96,
        maxUses: 3,
        tags: Object.freeze(["resilience", "player_response_angry", "global"]),
        frustrationFit: 0.70,
        confidenceFit: 0.35,
        coldStartFit: 0.72,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE SURVIVOR: The board wants emotional overcommitment from you. Deny it that luxury.',
        weight: 0.85,
        maxUses: 3,
        tags: Object.freeze(["resilience", "player_response_angry", "global"]),
        frustrationFit: 0.70,
        confidenceFit: 0.35,
        coldStartFit: 0.72,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE SURVIVOR: Keep the fire. Lose the blur.',
        weight: 0.74,
        maxUses: 3,
        tags: Object.freeze(["resilience", "player_response_angry", "global"]),
        frustrationFit: 0.70,
        confidenceFit: 0.35,
        coldStartFit: 0.72,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
    ]),
    PLAYER_RESPONSE_FLEX: Object.freeze([
      Object.freeze({
        text: 'THE SURVIVOR: Confidence is earned twice — once by the gain, again by how quietly you can hold it.',
        weight: 0.96,
        maxUses: 3,
        tags: Object.freeze(["resilience", "player_response_flex", "global"]),
        frustrationFit: 0.30,
        confidenceFit: 0.85,
        coldStartFit: 0.72,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE SURVIVOR: Flex later. Stabilize now.',
        weight: 0.85,
        maxUses: 3,
        tags: Object.freeze(["resilience", "player_response_flex", "global"]),
        frustrationFit: 0.30,
        confidenceFit: 0.85,
        coldStartFit: 0.72,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE SURVIVOR: I like the energy. I love it more when it survives the next counter.',
        weight: 0.74,
        maxUses: 3,
        tags: Object.freeze(["resilience", "player_response_flex", "global"]),
        frustrationFit: 0.30,
        confidenceFit: 0.85,
        coldStartFit: 0.72,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
    ]),
    BOT_DEFEATED: Object.freeze([
      Object.freeze({
        text: 'THE SURVIVOR: Good neutralization. Treat the opening as brief and profitable, not permanent and safe.',
        weight: 0.96,
        maxUses: 3,
        tags: Object.freeze(["resilience", "bot_defeated", "global"]),
        frustrationFit: 0.30,
        confidenceFit: 0.35,
        coldStartFit: 0.72,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE SURVIVOR: One adversary down means one doctrine solved. Stay awake for the doctrine you haven\'t seen yet.',
        weight: 0.85,
        maxUses: 3,
        tags: Object.freeze(["resilience", "bot_defeated", "global"]),
        frustrationFit: 0.30,
        confidenceFit: 0.35,
        coldStartFit: 0.72,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE SURVIVOR: Earn the space you just created.',
        weight: 0.74,
        maxUses: 3,
        tags: Object.freeze(["resilience", "bot_defeated", "global"]),
        frustrationFit: 0.30,
        confidenceFit: 0.35,
        coldStartFit: 0.72,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
    ]),
    NEAR_SOVEREIGNTY: Object.freeze([
      Object.freeze({
        text: 'THE SURVIVOR: Late run now. Shrink every move to the minimum error surface and let discipline finish what ambition started.',
        weight: 0.96,
        minTick: 400,
        maxUses: 1,
        tags: Object.freeze(["resilience", "near_sovereignty", "global"]),
        frustrationFit: 0.30,
        confidenceFit: 0.85,
        coldStartFit: 0.72,
        urgencyFit: 0.80,
        cadenceFloorMs: 3000,
      }),
      Object.freeze({
        text: 'THE SURVIVOR: You\'re close enough that the room will try to rush you. Refuse the tempo it offers.',
        weight: 0.85,
        minTick: 400,
        maxUses: 3,
        tags: Object.freeze(["resilience", "near_sovereignty", "global"]),
        frustrationFit: 0.30,
        confidenceFit: 0.85,
        coldStartFit: 0.72,
        urgencyFit: 0.80,
        cadenceFloorMs: 3000,
      }),
      Object.freeze({
        text: 'THE SURVIVOR: Finish clean. Not loud. Clean.',
        weight: 0.74,
        minTick: 400,
        maxUses: 3,
        tags: Object.freeze(["resilience", "near_sovereignty", "global"]),
        frustrationFit: 0.30,
        confidenceFit: 0.85,
        coldStartFit: 0.72,
        urgencyFit: 0.80,
        cadenceFloorMs: 3000,
      }),
    ]),
    PLAYER_LOST: Object.freeze([
      Object.freeze({
        text: 'THE SURVIVOR: Archive the run honestly. Painful data becomes leverage if you keep it intact.',
        weight: 0.96,
        maxUses: 1,
        tags: Object.freeze(["resilience", "player_lost", "global"]),
        frustrationFit: 0.70,
        confidenceFit: 0.35,
        coldStartFit: 0.72,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE SURVIVOR: Loss is not a verdict here. It\'s a revealed model. Study the reveal.',
        weight: 0.85,
        maxUses: 3,
        tags: Object.freeze(["resilience", "player_lost", "global"]),
        frustrationFit: 0.70,
        confidenceFit: 0.35,
        coldStartFit: 0.72,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE SURVIVOR: Let the ending teach sequence, not identity.',
        weight: 0.74,
        maxUses: 3,
        tags: Object.freeze(["resilience", "player_lost", "global"]),
        frustrationFit: 0.70,
        confidenceFit: 0.35,
        coldStartFit: 0.72,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
    ]),
  }),
  RIVAL: Object.freeze({
    GAME_START: Object.freeze([
      Object.freeze({
        text: 'THE RIVAL: Opening ticks are for shape, not panic. Establish rhythm before the board starts arguing back.',
        weight: 0.96,
        maxUses: 3,
        tags: Object.freeze(["competitive_motivation", "game_start", "syndicate"]),
        frustrationFit: 0.40,
        confidenceFit: 0.45,
        coldStartFit: 0.32,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE RIVAL: New run. Read the room, read your hand, then let the first move serve a plan instead of a mood.',
        weight: 0.85,
        maxUses: 3,
        tags: Object.freeze(["competitive_motivation", "game_start", "syndicate"]),
        frustrationFit: 0.40,
        confidenceFit: 0.45,
        coldStartFit: 0.32,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE RIVAL: Start clean. competitive motivation matters most before pressure gets loud.',
        weight: 0.74,
        maxUses: 3,
        tags: Object.freeze(["competitive_motivation", "game_start", "syndicate"]),
        frustrationFit: 0.40,
        confidenceFit: 0.45,
        coldStartFit: 0.32,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
    ]),
    PLAYER_NEAR_BANKRUPTCY: Object.freeze([
      Object.freeze({
        text: 'THE RIVAL: This state is dangerous, not final. Shrink the problem until the next good decision fits in your hands.',
        weight: 0.96,
        maxUses: 3,
        tags: Object.freeze(["competitive_motivation", "player_near_bankruptcy", "syndicate"]),
        frustrationFit: 0.80,
        confidenceFit: 0.45,
        coldStartFit: 0.32,
        urgencyFit: 0.80,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE RIVAL: Protect breathing room first. You do not need brilliance here. You need one correct step that buys the second.',
        weight: 0.85,
        maxUses: 3,
        tags: Object.freeze(["competitive_motivation", "player_near_bankruptcy", "syndicate"]),
        frustrationFit: 0.80,
        confidenceFit: 0.45,
        coldStartFit: 0.32,
        urgencyFit: 0.80,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE RIVAL: Don\'t negotiate with panic. Rebuild sequence: stabilize, restore cash, then reopen ambition.',
        weight: 0.74,
        maxUses: 3,
        tags: Object.freeze(["competitive_motivation", "player_near_bankruptcy", "syndicate"]),
        frustrationFit: 0.80,
        confidenceFit: 0.45,
        coldStartFit: 0.32,
        urgencyFit: 0.80,
        cadenceFloorMs: 2200,
      }),
    ]),
    PLAYER_IDLE: Object.freeze([
      Object.freeze({
        text: 'THE RIVAL: If you\'re pausing to think, make the pause useful. Name the immediate threat and the next safe card.',
        weight: 0.96,
        maxUses: 3,
        tags: Object.freeze(["competitive_motivation", "player_idle", "syndicate"]),
        frustrationFit: 0.40,
        confidenceFit: 0.45,
        coldStartFit: 0.32,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE RIVAL: Delay can help if it clarifies priority. It hurts if it keeps you emotionally attached to a dead line.',
        weight: 0.85,
        maxUses: 3,
        tags: Object.freeze(["competitive_motivation", "player_idle", "syndicate"]),
        frustrationFit: 0.40,
        confidenceFit: 0.45,
        coldStartFit: 0.32,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE RIVAL: Freeze less. Filter more. What matters in the next two ticks?',
        weight: 0.74,
        maxUses: 3,
        tags: Object.freeze(["competitive_motivation", "player_idle", "syndicate"]),
        frustrationFit: 0.40,
        confidenceFit: 0.45,
        coldStartFit: 0.32,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
    ]),
    PLAYER_CARD_PLAY: Object.freeze([
      Object.freeze({
        text: 'THE RIVAL: Good. Now ask what this card enables, what it exposes, and what it dares the room to do next.',
        weight: 0.96,
        maxUses: 3,
        tags: Object.freeze(["competitive_motivation", "player_card_play", "syndicate"]),
        frustrationFit: 0.40,
        confidenceFit: 0.45,
        coldStartFit: 0.32,
        urgencyFit: 0.35,
        cadenceFloorMs: 1600,
      }),
      Object.freeze({
        text: 'THE RIVAL: Cards are not isolated. Every play edits tempo, threat, and what the opposition thinks you value.',
        weight: 0.85,
        maxUses: 3,
        tags: Object.freeze(["competitive_motivation", "player_card_play", "syndicate"]),
        frustrationFit: 0.40,
        confidenceFit: 0.45,
        coldStartFit: 0.32,
        urgencyFit: 0.35,
        cadenceFloorMs: 1600,
      }),
      Object.freeze({
        text: 'THE RIVAL: Strong move if you follow it correctly. Weak move if you admire it too long.',
        weight: 0.74,
        maxUses: 3,
        tags: Object.freeze(["competitive_motivation", "player_card_play", "syndicate"]),
        frustrationFit: 0.40,
        confidenceFit: 0.45,
        coldStartFit: 0.32,
        urgencyFit: 0.35,
        cadenceFloorMs: 1600,
      }),
    ]),
    PLAYER_SHIELD_BREAK: Object.freeze([
      Object.freeze({
        text: 'THE RIVAL: Breach hurts because it narrows options. Repair the layer that restores choice, not just the layer that looks dramatic.',
        weight: 0.96,
        maxUses: 3,
        tags: Object.freeze(["competitive_motivation", "player_shield_break", "syndicate"]),
        frustrationFit: 0.40,
        confidenceFit: 0.45,
        coldStartFit: 0.32,
        urgencyFit: 0.80,
        cadenceFloorMs: 1600,
      }),
      Object.freeze({
        text: 'THE RIVAL: Broken shielding is information. The board just told you where it believes you are thin.',
        weight: 0.85,
        maxUses: 3,
        tags: Object.freeze(["competitive_motivation", "player_shield_break", "syndicate"]),
        frustrationFit: 0.40,
        confidenceFit: 0.45,
        coldStartFit: 0.32,
        urgencyFit: 0.80,
        cadenceFloorMs: 1600,
      }),
      Object.freeze({
        text: 'THE RIVAL: Don\'t answer a breach with ego. Answer it with sequence and stack discipline.',
        weight: 0.74,
        maxUses: 3,
        tags: Object.freeze(["competitive_motivation", "player_shield_break", "syndicate"]),
        frustrationFit: 0.40,
        confidenceFit: 0.45,
        coldStartFit: 0.32,
        urgencyFit: 0.80,
        cadenceFloorMs: 1600,
      }),
    ]),
    CASCADE_CHAIN: Object.freeze([
      Object.freeze({
        text: 'THE RIVAL: Cascades are momentum with honesty attached. Interrupt the bad one or route it into something you can survive.',
        weight: 0.96,
        maxUses: 3,
        tags: Object.freeze(["competitive_motivation", "cascade_chain", "syndicate"]),
        frustrationFit: 0.40,
        confidenceFit: 0.45,
        coldStartFit: 0.32,
        urgencyFit: 0.80,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE RIVAL: Count dependencies fast. The chain only feels magical when you haven\'t mapped the bridges.',
        weight: 0.85,
        maxUses: 3,
        tags: Object.freeze(["competitive_motivation", "cascade_chain", "syndicate"]),
        frustrationFit: 0.40,
        confidenceFit: 0.45,
        coldStartFit: 0.32,
        urgencyFit: 0.80,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE RIVAL: This is where calm players outperform clever players.',
        weight: 0.74,
        maxUses: 3,
        tags: Object.freeze(["competitive_motivation", "cascade_chain", "syndicate"]),
        frustrationFit: 0.40,
        confidenceFit: 0.45,
        coldStartFit: 0.32,
        urgencyFit: 0.80,
        cadenceFloorMs: 2200,
      }),
    ]),
    PLAYER_INCOME_UP: Object.freeze([
      Object.freeze({
        text: 'THE RIVAL: Nice lift. Now prove the gain is durable by defending it before you celebrate it.',
        weight: 0.96,
        maxUses: 3,
        tags: Object.freeze(["competitive_motivation", "player_income_up", "syndicate"]),
        frustrationFit: 0.40,
        confidenceFit: 0.95,
        coldStartFit: 0.32,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE RIVAL: Growth expands possibility and visibility at the same time. Secure one, expect the other.',
        weight: 0.85,
        maxUses: 3,
        tags: Object.freeze(["competitive_motivation", "player_income_up", "syndicate"]),
        frustrationFit: 0.40,
        confidenceFit: 0.95,
        coldStartFit: 0.32,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE RIVAL: Income is momentum. Convert some of it into stability before the room taxes your joy.',
        weight: 0.74,
        maxUses: 3,
        tags: Object.freeze(["competitive_motivation", "player_income_up", "syndicate"]),
        frustrationFit: 0.40,
        confidenceFit: 0.95,
        coldStartFit: 0.32,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
    ]),
    PLAYER_COMEBACK: Object.freeze([
      Object.freeze({
        text: 'THE RIVAL: Good recovery. Don\'t rush to make the comeback feel poetic. Make it hard to reverse.',
        weight: 0.96,
        maxUses: 3,
        tags: Object.freeze(["competitive_motivation", "player_comeback", "syndicate"]),
        frustrationFit: 0.40,
        confidenceFit: 0.95,
        coldStartFit: 0.32,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE RIVAL: Climbing out matters. What matters more is whether you changed the structure that put you there.',
        weight: 0.85,
        maxUses: 3,
        tags: Object.freeze(["competitive_motivation", "player_comeback", "syndicate"]),
        frustrationFit: 0.40,
        confidenceFit: 0.95,
        coldStartFit: 0.32,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE RIVAL: Momentum returned. Protect the engine, not your pride.',
        weight: 0.74,
        maxUses: 3,
        tags: Object.freeze(["competitive_motivation", "player_comeback", "syndicate"]),
        frustrationFit: 0.40,
        confidenceFit: 0.95,
        coldStartFit: 0.32,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
    ]),
    PLAYER_RESPONSE_ANGRY: Object.freeze([
      Object.freeze({
        text: 'THE RIVAL: Anger is allowed. Let it speak once, then put it to work somewhere measurable.',
        weight: 0.96,
        maxUses: 3,
        tags: Object.freeze(["competitive_motivation", "player_response_angry", "syndicate"]),
        frustrationFit: 0.80,
        confidenceFit: 0.45,
        coldStartFit: 0.32,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE RIVAL: The board wants emotional overcommitment from you. Deny it that luxury.',
        weight: 0.85,
        maxUses: 3,
        tags: Object.freeze(["competitive_motivation", "player_response_angry", "syndicate"]),
        frustrationFit: 0.80,
        confidenceFit: 0.45,
        coldStartFit: 0.32,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE RIVAL: Keep the fire. Lose the blur.',
        weight: 0.74,
        maxUses: 3,
        tags: Object.freeze(["competitive_motivation", "player_response_angry", "syndicate"]),
        frustrationFit: 0.80,
        confidenceFit: 0.45,
        coldStartFit: 0.32,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
    ]),
    PLAYER_RESPONSE_FLEX: Object.freeze([
      Object.freeze({
        text: 'THE RIVAL: Confidence is earned twice — once by the gain, again by how quietly you can hold it.',
        weight: 0.96,
        maxUses: 3,
        tags: Object.freeze(["competitive_motivation", "player_response_flex", "syndicate"]),
        frustrationFit: 0.40,
        confidenceFit: 0.95,
        coldStartFit: 0.32,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE RIVAL: Flex later. Stabilize now.',
        weight: 0.85,
        maxUses: 3,
        tags: Object.freeze(["competitive_motivation", "player_response_flex", "syndicate"]),
        frustrationFit: 0.40,
        confidenceFit: 0.95,
        coldStartFit: 0.32,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE RIVAL: I like the energy. I love it more when it survives the next counter.',
        weight: 0.74,
        maxUses: 3,
        tags: Object.freeze(["competitive_motivation", "player_response_flex", "syndicate"]),
        frustrationFit: 0.40,
        confidenceFit: 0.95,
        coldStartFit: 0.32,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
    ]),
    BOT_DEFEATED: Object.freeze([
      Object.freeze({
        text: 'THE RIVAL: Good neutralization. Treat the opening as brief and profitable, not permanent and safe.',
        weight: 0.96,
        maxUses: 3,
        tags: Object.freeze(["competitive_motivation", "bot_defeated", "syndicate"]),
        frustrationFit: 0.40,
        confidenceFit: 0.45,
        coldStartFit: 0.32,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE RIVAL: One adversary down means one doctrine solved. Stay awake for the doctrine you haven\'t seen yet.',
        weight: 0.85,
        maxUses: 3,
        tags: Object.freeze(["competitive_motivation", "bot_defeated", "syndicate"]),
        frustrationFit: 0.40,
        confidenceFit: 0.45,
        coldStartFit: 0.32,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE RIVAL: Earn the space you just created.',
        weight: 0.74,
        maxUses: 3,
        tags: Object.freeze(["competitive_motivation", "bot_defeated", "syndicate"]),
        frustrationFit: 0.40,
        confidenceFit: 0.45,
        coldStartFit: 0.32,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
    ]),
    NEAR_SOVEREIGNTY: Object.freeze([
      Object.freeze({
        text: 'THE RIVAL: Late run now. Shrink every move to the minimum error surface and let discipline finish what ambition started.',
        weight: 0.96,
        minTick: 400,
        maxUses: 1,
        tags: Object.freeze(["competitive_motivation", "near_sovereignty", "syndicate"]),
        frustrationFit: 0.40,
        confidenceFit: 0.95,
        coldStartFit: 0.32,
        urgencyFit: 0.80,
        cadenceFloorMs: 3000,
      }),
      Object.freeze({
        text: 'THE RIVAL: You\'re close enough that the room will try to rush you. Refuse the tempo it offers.',
        weight: 0.85,
        minTick: 400,
        maxUses: 3,
        tags: Object.freeze(["competitive_motivation", "near_sovereignty", "syndicate"]),
        frustrationFit: 0.40,
        confidenceFit: 0.95,
        coldStartFit: 0.32,
        urgencyFit: 0.80,
        cadenceFloorMs: 3000,
      }),
      Object.freeze({
        text: 'THE RIVAL: Finish clean. Not loud. Clean.',
        weight: 0.74,
        minTick: 400,
        maxUses: 3,
        tags: Object.freeze(["competitive_motivation", "near_sovereignty", "syndicate"]),
        frustrationFit: 0.40,
        confidenceFit: 0.95,
        coldStartFit: 0.32,
        urgencyFit: 0.80,
        cadenceFloorMs: 3000,
      }),
    ]),
    PLAYER_LOST: Object.freeze([
      Object.freeze({
        text: 'THE RIVAL: Archive the run honestly. Painful data becomes leverage if you keep it intact.',
        weight: 0.96,
        maxUses: 1,
        tags: Object.freeze(["competitive_motivation", "player_lost", "syndicate"]),
        frustrationFit: 0.80,
        confidenceFit: 0.45,
        coldStartFit: 0.32,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE RIVAL: Loss is not a verdict here. It\'s a revealed model. Study the reveal.',
        weight: 0.85,
        maxUses: 3,
        tags: Object.freeze(["competitive_motivation", "player_lost", "syndicate"]),
        frustrationFit: 0.80,
        confidenceFit: 0.45,
        coldStartFit: 0.32,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE RIVAL: Let the ending teach sequence, not identity.',
        weight: 0.74,
        maxUses: 3,
        tags: Object.freeze(["competitive_motivation", "player_lost", "syndicate"]),
        frustrationFit: 0.80,
        confidenceFit: 0.45,
        coldStartFit: 0.32,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
    ]),
  }),
  ARCHIVIST: Object.freeze({
    GAME_START: Object.freeze([
      Object.freeze({
        text: 'THE ARCHIVIST: Opening ticks are for shape, not panic. Establish rhythm before the board starts arguing back.',
        weight: 0.96,
        maxUses: 3,
        tags: Object.freeze(["memory", "game_start", "lobby"]),
        frustrationFit: 0.43,
        confidenceFit: 0.39,
        coldStartFit: 0.20,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE ARCHIVIST: New run. Read the room, read your hand, then let the first move serve a plan instead of a mood.',
        weight: 0.85,
        maxUses: 3,
        tags: Object.freeze(["memory", "game_start", "lobby"]),
        frustrationFit: 0.43,
        confidenceFit: 0.39,
        coldStartFit: 0.20,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE ARCHIVIST: Start clean. memory matters most before pressure gets loud.',
        weight: 0.74,
        maxUses: 3,
        tags: Object.freeze(["memory", "game_start", "lobby"]),
        frustrationFit: 0.43,
        confidenceFit: 0.39,
        coldStartFit: 0.20,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
    ]),
    PLAYER_NEAR_BANKRUPTCY: Object.freeze([
      Object.freeze({
        text: 'THE ARCHIVIST: This state is dangerous, not final. Shrink the problem until the next good decision fits in your hands.',
        weight: 0.96,
        maxUses: 3,
        tags: Object.freeze(["memory", "player_near_bankruptcy", "lobby"]),
        frustrationFit: 0.83,
        confidenceFit: 0.39,
        coldStartFit: 0.20,
        urgencyFit: 0.80,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE ARCHIVIST: Protect breathing room first. You do not need brilliance here. You need one correct step that buys the second.',
        weight: 0.85,
        maxUses: 3,
        tags: Object.freeze(["memory", "player_near_bankruptcy", "lobby"]),
        frustrationFit: 0.83,
        confidenceFit: 0.39,
        coldStartFit: 0.20,
        urgencyFit: 0.80,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE ARCHIVIST: Don\'t negotiate with panic. Rebuild sequence: stabilize, restore cash, then reopen ambition.',
        weight: 0.74,
        maxUses: 3,
        tags: Object.freeze(["memory", "player_near_bankruptcy", "lobby"]),
        frustrationFit: 0.83,
        confidenceFit: 0.39,
        coldStartFit: 0.20,
        urgencyFit: 0.80,
        cadenceFloorMs: 2200,
      }),
    ]),
    PLAYER_IDLE: Object.freeze([
      Object.freeze({
        text: 'THE ARCHIVIST: If you\'re pausing to think, make the pause useful. Name the immediate threat and the next safe card.',
        weight: 0.96,
        maxUses: 3,
        tags: Object.freeze(["memory", "player_idle", "lobby"]),
        frustrationFit: 0.43,
        confidenceFit: 0.39,
        coldStartFit: 0.20,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE ARCHIVIST: Delay can help if it clarifies priority. It hurts if it keeps you emotionally attached to a dead line.',
        weight: 0.85,
        maxUses: 3,
        tags: Object.freeze(["memory", "player_idle", "lobby"]),
        frustrationFit: 0.43,
        confidenceFit: 0.39,
        coldStartFit: 0.20,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE ARCHIVIST: Freeze less. Filter more. What matters in the next two ticks?',
        weight: 0.74,
        maxUses: 3,
        tags: Object.freeze(["memory", "player_idle", "lobby"]),
        frustrationFit: 0.43,
        confidenceFit: 0.39,
        coldStartFit: 0.20,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
    ]),
    PLAYER_CARD_PLAY: Object.freeze([
      Object.freeze({
        text: 'THE ARCHIVIST: Good. Now ask what this card enables, what it exposes, and what it dares the room to do next.',
        weight: 0.96,
        maxUses: 3,
        tags: Object.freeze(["memory", "player_card_play", "lobby"]),
        frustrationFit: 0.43,
        confidenceFit: 0.39,
        coldStartFit: 0.20,
        urgencyFit: 0.35,
        cadenceFloorMs: 1600,
      }),
      Object.freeze({
        text: 'THE ARCHIVIST: Cards are not isolated. Every play edits tempo, threat, and what the opposition thinks you value.',
        weight: 0.85,
        maxUses: 3,
        tags: Object.freeze(["memory", "player_card_play", "lobby"]),
        frustrationFit: 0.43,
        confidenceFit: 0.39,
        coldStartFit: 0.20,
        urgencyFit: 0.35,
        cadenceFloorMs: 1600,
      }),
      Object.freeze({
        text: 'THE ARCHIVIST: Strong move if you follow it correctly. Weak move if you admire it too long.',
        weight: 0.74,
        maxUses: 3,
        tags: Object.freeze(["memory", "player_card_play", "lobby"]),
        frustrationFit: 0.43,
        confidenceFit: 0.39,
        coldStartFit: 0.20,
        urgencyFit: 0.35,
        cadenceFloorMs: 1600,
      }),
    ]),
    PLAYER_SHIELD_BREAK: Object.freeze([
      Object.freeze({
        text: 'THE ARCHIVIST: Breach hurts because it narrows options. Repair the layer that restores choice, not just the layer that looks dramatic.',
        weight: 0.96,
        maxUses: 3,
        tags: Object.freeze(["memory", "player_shield_break", "lobby"]),
        frustrationFit: 0.43,
        confidenceFit: 0.39,
        coldStartFit: 0.20,
        urgencyFit: 0.80,
        cadenceFloorMs: 1600,
      }),
      Object.freeze({
        text: 'THE ARCHIVIST: Broken shielding is information. The board just told you where it believes you are thin.',
        weight: 0.85,
        maxUses: 3,
        tags: Object.freeze(["memory", "player_shield_break", "lobby"]),
        frustrationFit: 0.43,
        confidenceFit: 0.39,
        coldStartFit: 0.20,
        urgencyFit: 0.80,
        cadenceFloorMs: 1600,
      }),
      Object.freeze({
        text: 'THE ARCHIVIST: Don\'t answer a breach with ego. Answer it with sequence and stack discipline.',
        weight: 0.74,
        maxUses: 3,
        tags: Object.freeze(["memory", "player_shield_break", "lobby"]),
        frustrationFit: 0.43,
        confidenceFit: 0.39,
        coldStartFit: 0.20,
        urgencyFit: 0.80,
        cadenceFloorMs: 1600,
      }),
    ]),
    CASCADE_CHAIN: Object.freeze([
      Object.freeze({
        text: 'THE ARCHIVIST: Cascades are momentum with honesty attached. Interrupt the bad one or route it into something you can survive.',
        weight: 0.96,
        maxUses: 3,
        tags: Object.freeze(["memory", "cascade_chain", "lobby"]),
        frustrationFit: 0.43,
        confidenceFit: 0.39,
        coldStartFit: 0.20,
        urgencyFit: 0.80,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE ARCHIVIST: Count dependencies fast. The chain only feels magical when you haven\'t mapped the bridges.',
        weight: 0.85,
        maxUses: 3,
        tags: Object.freeze(["memory", "cascade_chain", "lobby"]),
        frustrationFit: 0.43,
        confidenceFit: 0.39,
        coldStartFit: 0.20,
        urgencyFit: 0.80,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE ARCHIVIST: This is where calm players outperform clever players.',
        weight: 0.74,
        maxUses: 3,
        tags: Object.freeze(["memory", "cascade_chain", "lobby"]),
        frustrationFit: 0.43,
        confidenceFit: 0.39,
        coldStartFit: 0.20,
        urgencyFit: 0.80,
        cadenceFloorMs: 2200,
      }),
    ]),
    PLAYER_INCOME_UP: Object.freeze([
      Object.freeze({
        text: 'THE ARCHIVIST: Nice lift. Now prove the gain is durable by defending it before you celebrate it.',
        weight: 0.96,
        maxUses: 3,
        tags: Object.freeze(["memory", "player_income_up", "lobby"]),
        frustrationFit: 0.43,
        confidenceFit: 0.89,
        coldStartFit: 0.20,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE ARCHIVIST: Growth expands possibility and visibility at the same time. Secure one, expect the other.',
        weight: 0.85,
        maxUses: 3,
        tags: Object.freeze(["memory", "player_income_up", "lobby"]),
        frustrationFit: 0.43,
        confidenceFit: 0.89,
        coldStartFit: 0.20,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE ARCHIVIST: Income is momentum. Convert some of it into stability before the room taxes your joy.',
        weight: 0.74,
        maxUses: 3,
        tags: Object.freeze(["memory", "player_income_up", "lobby"]),
        frustrationFit: 0.43,
        confidenceFit: 0.89,
        coldStartFit: 0.20,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
    ]),
    PLAYER_COMEBACK: Object.freeze([
      Object.freeze({
        text: 'THE ARCHIVIST: Good recovery. Don\'t rush to make the comeback feel poetic. Make it hard to reverse.',
        weight: 0.96,
        maxUses: 3,
        tags: Object.freeze(["memory", "player_comeback", "lobby"]),
        frustrationFit: 0.43,
        confidenceFit: 0.89,
        coldStartFit: 0.20,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE ARCHIVIST: Climbing out matters. What matters more is whether you changed the structure that put you there.',
        weight: 0.85,
        maxUses: 3,
        tags: Object.freeze(["memory", "player_comeback", "lobby"]),
        frustrationFit: 0.43,
        confidenceFit: 0.89,
        coldStartFit: 0.20,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE ARCHIVIST: Momentum returned. Protect the engine, not your pride.',
        weight: 0.74,
        maxUses: 3,
        tags: Object.freeze(["memory", "player_comeback", "lobby"]),
        frustrationFit: 0.43,
        confidenceFit: 0.89,
        coldStartFit: 0.20,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
    ]),
    PLAYER_RESPONSE_ANGRY: Object.freeze([
      Object.freeze({
        text: 'THE ARCHIVIST: Anger is allowed. Let it speak once, then put it to work somewhere measurable.',
        weight: 0.96,
        maxUses: 3,
        tags: Object.freeze(["memory", "player_response_angry", "lobby"]),
        frustrationFit: 0.83,
        confidenceFit: 0.39,
        coldStartFit: 0.20,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE ARCHIVIST: The board wants emotional overcommitment from you. Deny it that luxury.',
        weight: 0.85,
        maxUses: 3,
        tags: Object.freeze(["memory", "player_response_angry", "lobby"]),
        frustrationFit: 0.83,
        confidenceFit: 0.39,
        coldStartFit: 0.20,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE ARCHIVIST: Keep the fire. Lose the blur.',
        weight: 0.74,
        maxUses: 3,
        tags: Object.freeze(["memory", "player_response_angry", "lobby"]),
        frustrationFit: 0.83,
        confidenceFit: 0.39,
        coldStartFit: 0.20,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
    ]),
    PLAYER_RESPONSE_FLEX: Object.freeze([
      Object.freeze({
        text: 'THE ARCHIVIST: Confidence is earned twice — once by the gain, again by how quietly you can hold it.',
        weight: 0.96,
        maxUses: 3,
        tags: Object.freeze(["memory", "player_response_flex", "lobby"]),
        frustrationFit: 0.43,
        confidenceFit: 0.89,
        coldStartFit: 0.20,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE ARCHIVIST: Flex later. Stabilize now.',
        weight: 0.85,
        maxUses: 3,
        tags: Object.freeze(["memory", "player_response_flex", "lobby"]),
        frustrationFit: 0.43,
        confidenceFit: 0.89,
        coldStartFit: 0.20,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE ARCHIVIST: I like the energy. I love it more when it survives the next counter.',
        weight: 0.74,
        maxUses: 3,
        tags: Object.freeze(["memory", "player_response_flex", "lobby"]),
        frustrationFit: 0.43,
        confidenceFit: 0.89,
        coldStartFit: 0.20,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
    ]),
    BOT_DEFEATED: Object.freeze([
      Object.freeze({
        text: 'THE ARCHIVIST: Good neutralization. Treat the opening as brief and profitable, not permanent and safe.',
        weight: 0.96,
        maxUses: 3,
        tags: Object.freeze(["memory", "bot_defeated", "lobby"]),
        frustrationFit: 0.43,
        confidenceFit: 0.39,
        coldStartFit: 0.20,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE ARCHIVIST: One adversary down means one doctrine solved. Stay awake for the doctrine you haven\'t seen yet.',
        weight: 0.85,
        maxUses: 3,
        tags: Object.freeze(["memory", "bot_defeated", "lobby"]),
        frustrationFit: 0.43,
        confidenceFit: 0.39,
        coldStartFit: 0.20,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE ARCHIVIST: Earn the space you just created.',
        weight: 0.74,
        maxUses: 3,
        tags: Object.freeze(["memory", "bot_defeated", "lobby"]),
        frustrationFit: 0.43,
        confidenceFit: 0.39,
        coldStartFit: 0.20,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
    ]),
    NEAR_SOVEREIGNTY: Object.freeze([
      Object.freeze({
        text: 'THE ARCHIVIST: Late run now. Shrink every move to the minimum error surface and let discipline finish what ambition started.',
        weight: 0.96,
        minTick: 400,
        maxUses: 1,
        tags: Object.freeze(["memory", "near_sovereignty", "lobby"]),
        frustrationFit: 0.43,
        confidenceFit: 0.89,
        coldStartFit: 0.20,
        urgencyFit: 0.80,
        cadenceFloorMs: 3000,
      }),
      Object.freeze({
        text: 'THE ARCHIVIST: You\'re close enough that the room will try to rush you. Refuse the tempo it offers.',
        weight: 0.85,
        minTick: 400,
        maxUses: 3,
        tags: Object.freeze(["memory", "near_sovereignty", "lobby"]),
        frustrationFit: 0.43,
        confidenceFit: 0.89,
        coldStartFit: 0.20,
        urgencyFit: 0.80,
        cadenceFloorMs: 3000,
      }),
      Object.freeze({
        text: 'THE ARCHIVIST: Finish clean. Not loud. Clean.',
        weight: 0.74,
        minTick: 400,
        maxUses: 3,
        tags: Object.freeze(["memory", "near_sovereignty", "lobby"]),
        frustrationFit: 0.43,
        confidenceFit: 0.89,
        coldStartFit: 0.20,
        urgencyFit: 0.80,
        cadenceFloorMs: 3000,
      }),
    ]),
    PLAYER_LOST: Object.freeze([
      Object.freeze({
        text: 'THE ARCHIVIST: Archive the run honestly. Painful data becomes leverage if you keep it intact.',
        weight: 0.96,
        maxUses: 1,
        tags: Object.freeze(["memory", "player_lost", "lobby"]),
        frustrationFit: 0.83,
        confidenceFit: 0.39,
        coldStartFit: 0.20,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE ARCHIVIST: Loss is not a verdict here. It\'s a revealed model. Study the reveal.',
        weight: 0.85,
        maxUses: 3,
        tags: Object.freeze(["memory", "player_lost", "lobby"]),
        frustrationFit: 0.83,
        confidenceFit: 0.39,
        coldStartFit: 0.20,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
      Object.freeze({
        text: 'THE ARCHIVIST: Let the ending teach sequence, not identity.',
        weight: 0.74,
        maxUses: 3,
        tags: Object.freeze(["memory", "player_lost", "lobby"]),
        frustrationFit: 0.83,
        confidenceFit: 0.39,
        coldStartFit: 0.20,
        urgencyFit: 0.35,
        cadenceFloorMs: 2200,
      }),
    ]),
  }),
} as const);

const materializeLines = (): Readonly<Record<HelperPersonaId, Readonly<Record<HelperDialogueContext, readonly HelperDialogueLine[]>>>> => {
  const personaEntries = Object.entries(RAW_HELPER_DIALOGUE) as Array<[HelperPersonaId, typeof RAW_HELPER_DIALOGUE[HelperPersonaId]]>;
  const personas: Partial<Record<HelperPersonaId, Readonly<Record<HelperDialogueContext, readonly HelperDialogueLine[]>>>> = {};
  for (const [personaId, byContext] of personaEntries) {
    const contextsOut: Partial<Record<HelperDialogueContext, readonly HelperDialogueLine[]>> = {};
    for (const context of DEFAULT_CONTEXTS) {
      const lines = (byContext[context] ?? []).map((line, index) => Object.freeze({
        id: stableLineId(personaId, context, index + 1, line.text),
        personaId,
        context,
        text: line.text,
        weight: line.weight,
        minTick: line.minTick,
        maxUses: line.maxUses,
        tags: line.tags,
        frustrationFit: line.frustrationFit,
        confidenceFit: line.confidenceFit,
        coldStartFit: line.coldStartFit,
        urgencyFit: line.urgencyFit,
        cadenceFloorMs: line.cadenceFloorMs,
      }) satisfies HelperDialogueLine);
      contextsOut[context] = Object.freeze(lines);
    }
    personas[personaId] = Object.freeze(contextsOut as Record<HelperDialogueContext, readonly HelperDialogueLine[]>);
  }
  return Object.freeze(personas as Record<HelperPersonaId, Readonly<Record<HelperDialogueContext, readonly HelperDialogueLine[]>>>);
};

const HELPER_DIALOGUE_LINES = materializeLines();

const scoreLine = (line: HelperDialogueLine, input: HelperSelectionInput): number => {
  const tick = input.tick ?? 0;
  if (typeof line.minTick === 'number' && tick < line.minTick) return -Infinity;
  const uses = input.useCountByLineId?.[line.id] ?? 0;
  if (typeof line.maxUses === 'number' && uses >= line.maxUses) return -Infinity;
  const banned = new Set(input.bannedTags ?? []);
  if (line.tags.some((tag) => banned.has(tag))) return -Infinity;
  const frustration = clamp01(input.frustration);
  const confidence = clamp01(input.confidence);
  const coldStart = clamp01(input.coldStart);
  const urgency = clamp01(input.urgency);
  const noveltyPenalty = uses * 0.12;
  const frustrationFit = frustration * line.frustrationFit;
  const confidenceFit = confidence * line.confidenceFit;
  const coldStartFit = coldStart * line.coldStartFit;
  const urgencyFit = urgency * line.urgencyFit;
  return line.weight + frustrationFit + confidenceFit + coldStartFit + urgencyFit - noveltyPenalty;
};

export class HelperDialogueRegistry {
  private readonly profiles = HELPER_PERSONA_PROFILES;
  private readonly lines = HELPER_DIALOGUE_LINES;

  public listPersonaIds(): readonly HelperPersonaId[] {
    return Object.freeze(Object.keys(this.profiles) as HelperPersonaId[]);
  }

  public listProfiles(): readonly HelperPersonaProfile[] {
    return Object.freeze(this.listPersonaIds().map((id) => this.profiles[id] as HelperPersonaProfile));
  }

  public hasPersona(personaId: string): personaId is HelperPersonaId {
    return Object.prototype.hasOwnProperty.call(this.profiles, personaId);
  }

  public getProfile(personaId: HelperPersonaId): HelperPersonaProfile {
    return this.profiles[personaId] as HelperPersonaProfile;
  }

  public listContexts(): readonly HelperDialogueContext[] {
    return DEFAULT_CONTEXTS;
  }

  public getLines(personaId: HelperPersonaId, context: HelperDialogueContext): readonly HelperDialogueLine[] {
    return this.lines[personaId][context];
  }

  public getAllLinesForPersona(personaId: HelperPersonaId): readonly HelperDialogueLine[] {
    return Object.freeze(DEFAULT_CONTEXTS.flatMap((context) => this.lines[personaId][context]));
  }

  public selectBestLine(input: HelperSelectionInput): HelperDialogueLine | null {
    const personas = input.personaId ? [input.personaId] : this.listPersonaIds();
    let best: HelperDialogueLine | null = null;
    let bestScore = -Infinity;
    for (const personaId of personas) {
      for (const line of this.lines[personaId][input.context]) {
        const score = scoreLine(line, input);
        if (score > bestScore) {
          best = line;
          bestScore = score;
        }
      }
    }
    return best;
  }

  public rankScenario(input: HelperSelectionInput): readonly HelperScenarioCandidate[] {
    const personas = input.personaId ? [input.personaId] : this.listPersonaIds();
    const candidates: HelperScenarioCandidate[] = [];
    for (const personaId of personas) {
      for (const line of this.lines[personaId][input.context]) {
        const score = scoreLine(line, input);
        if (Number.isFinite(score)) {
          candidates.push({ persona: this.profiles[personaId] as HelperPersonaProfile, line, score });
        }
      }
    }
    candidates.sort((left, right) => right.score - left.score || left.line.id.localeCompare(right.line.id));
    return Object.freeze(candidates);
  }

  public resolveInterventionPersona(input: HelperSelectionInput): HelperPersonaId {
    const frustration = clamp01(input.frustration);
    const confidence = clamp01(input.confidence);
    const coldStart = clamp01(input.coldStart);
    const urgency = clamp01(input.urgency);
    if (input.context === 'PLAYER_NEAR_BANKRUPTCY' || input.context === 'PLAYER_LOST') return frustration >= 0.55 ? 'SURVIVOR' : 'MENTOR';
    if (input.context === 'PLAYER_SHIELD_BREAK' || input.context === 'PLAYER_CARD_PLAY' || input.context === 'CASCADE_CHAIN') return 'INSIDER';
    if (input.context === 'PLAYER_INCOME_UP' || input.context === 'PLAYER_COMEBACK' || input.context === 'PLAYER_RESPONSE_FLEX') return confidence >= 0.45 ? 'RIVAL' : 'MENTOR';
    if (input.context === 'NEAR_SOVEREIGNTY') return urgency >= 0.65 ? 'MENTOR' : 'ARCHIVIST';
    if (coldStart >= 0.55) return 'MENTOR';
    return 'ARCHIVIST';
  }

  public getSnapshot(): HelperRegistrySnapshot {
    const linesByPersona = {} as Record<HelperPersonaId, number>;
    let totalLines = 0;
    for (const personaId of this.listPersonaIds()) {
      const count = this.getAllLinesForPersona(personaId).length;
      linesByPersona[personaId] = count;
      totalLines += count;
    }
    return Object.freeze({
      personas: this.listProfiles(),
      totalLines,
      contexts: this.listContexts(),
      linesByPersona: Object.freeze(linesByPersona),
    });
  }

  public buildTriggerMatrix(): Readonly<Record<HelperPersonaId, Readonly<Record<HelperDialogueContext, boolean>>>> {
    const output: Partial<Record<HelperPersonaId, Readonly<Record<HelperDialogueContext, boolean>>>> = {};
    for (const personaId of this.listPersonaIds()) {
      const profile = this.profiles[personaId];
      const perContext: Partial<Record<HelperDialogueContext, boolean>> = {};
      for (const context of DEFAULT_CONTEXTS) {
        perContext[context] = (profile.triggerConditions as readonly HelperDialogueContext[]).includes(context);
      }
      output[personaId] = Object.freeze(perContext as Record<HelperDialogueContext, boolean>);
    }
    return Object.freeze(output as Record<HelperPersonaId, Readonly<Record<HelperDialogueContext, boolean>>>);
  }
}

export const createHelperDialogueRegistry = (): HelperDialogueRegistry => new HelperDialogueRegistry();
export const helperDialogueRegistry = new HelperDialogueRegistry();