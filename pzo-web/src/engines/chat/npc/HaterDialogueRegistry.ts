// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/chat/npc/HaterDialogueRegistry.ts

/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT HATER DIALOGUE REGISTRY
 * FILE: pzo-web/src/engines/chat/npc/HaterDialogueRegistry.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical frontend-owned hater registry for the new chat engine lane.
 *
 * This file does not import from the frozen donor chat trees in
 * frontend/apps/web/components/chat. Their logic has been absorbed here and
 * upgraded into a richer registry surface that the new chat engine can use for:
 *
 * - dialogue lookup by bot, channel, mode, and run context,
 * - persona/voiceprint identity that matches the battle adversary logic,
 * - weighted line selection with usage guards and alias resolution,
 * - pre-run lobby taunts, active-run pressure, comeback handling, and post-loss
 *   closure that all stay aligned with PZO's real bot roster,
 * - compile-safe exports for future ChatNpcDirector, HaterResponsePlanner, and
 *   backend parity files without hard-coupling runtime logic today.
 *
 * Design laws
 * -----------
 * - Keep the five adversaries exactly aligned with the real battle roster:
 *   THE LIQUIDATOR, THE BUREAUCRAT, THE MANIPULATOR,
 *   THE CRASH PROPHET, and THE LEGACY HEIR.
 * - Preserve the donor context vocabulary from the old adaptive dialogue lane.
 * - Extend depth through metadata, context aliases, channel policy, and mode
 *   affinity rather than flattening everything into a generic taunt bag.
 * - Stay self-owned under /pzo-web/src/engines/chat/npc.
 * - Do not depend on frozen donor chat files.
 *
 * Long-term authority
 * -------------------
 * /shared/contracts/chat
 * /pzo-web/src/engines/chat
 * /pzo-web/src/components/chat
 * /backend/src/game/engine/chat
 * /pzo-server/src/chat
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ============================================================================
 */

import type {
  ChatChannelId,
  ChatNpcDescriptor,
  ChatNpcId,
  ChatPersonaVoiceprint,
  Score01,
} from '../types';
import { BotId, AttackType } from '../../battle/types';

export type FrontendRunMode = 'solo' | 'asymmetric-pvp' | 'co-op' | 'ghost';

export const HATER_DIALOGUE_CONTEXTS = [
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

export type HaterDialogueContext = (typeof HATER_DIALOGUE_CONTEXTS)[number];

export const HATER_CONTEXT_ALIAS_ORDER = Object.freeze({
  LOBBY_OPEN: ['LOBBY_TAUNT', 'GAME_START'],
  RUN_OPENING: ['GAME_START', 'PLAYER_FIRST_INCOME'],
  ECONOMIC_ASCENT: ['PLAYER_FIRST_INCOME', 'PLAYER_INCOME_UP'],
  ECONOMIC_COLLAPSE: ['PLAYER_SHIELD_BREAK', 'PLAYER_NEAR_BANKRUPTCY', 'PLAYER_LOST'],
  TILT: ['PLAYER_RESPONSE_ANGRY', 'PLAYER_IDLE', 'PLAYER_RESPONSE_TROLL'],
  GRANDSTAND: ['PLAYER_RESPONSE_FLEX', 'PLAYER_COMEBACK'],
  CROWD_SWARM: ['BOT_WINNING', 'TIME_PRESSURE', 'CASCADE_CHAIN'],
  FINAL_APPROACH: ['NEAR_SOVEREIGNTY', 'TIME_PRESSURE', 'BOT_WINNING'],
  POST_RUN: ['PLAYER_LOST', 'BOT_DEFEATED'],
} as const);

export type HaterDialogueAliasContext = keyof typeof HATER_CONTEXT_ALIAS_ORDER;
export type HaterRequestedContext = HaterDialogueContext | HaterDialogueAliasContext;

export interface HaterDialogueLine {
  readonly text: string;
  readonly weight: number;
  readonly minTick?: number;
  readonly maxUses?: number;
  readonly allowedChannels?: readonly ChatChannelId[];
  readonly allowedModes?: readonly FrontendRunMode[];
  readonly tags?: readonly string[];
  readonly memoryAnchor?: boolean;
  readonly callbackEligible?: boolean;
}

export type HaterDialogueTree = Partial<
  Record<HaterDialogueContext, readonly HaterDialogueLine[]>
>;

export interface HaterEscalationProfile {
  readonly lobbyAggro: number;
  readonly watchingAggro: number;
  readonly targetingAggro: number;
  readonly attackingAggro: number;
  readonly comebackPunishBias: number;
  readonly bankruptcyPunishBias: number;
  readonly flexPunishBias: number;
  readonly trollPunishBias: number;
}

export interface HaterChannelPresencePolicy {
  readonly primaryChannels: readonly ChatChannelId[];
  readonly allowedChannels: readonly ChatChannelId[];
  readonly prefersPublicPressure: boolean;
  readonly prefersPrivatePressure: boolean;
  readonly mayInvadeLobby: boolean;
  readonly mayEscalateInDealRoom: boolean;
  readonly mayEchoIntoShadow: boolean;
}

export interface HaterModeAffinityPolicy {
  readonly solo: number;
  readonly asymmetricPvp: number;
  readonly coop: number;
  readonly ghost: number;
}

export interface HaterRegistryEntry {
  readonly botId: BotId;
  readonly npcDescriptor: ChatNpcDescriptor;
  readonly displayName: string;
  readonly archetype: string;
  readonly primaryAttackType: AttackType;
  readonly secondaryAttackType: AttackType | null;
  readonly consequenceText: string;
  readonly escalationConditionDescription: string;
  readonly attackDialogue: string;
  readonly retreatDialogue: string;
  readonly voiceprint: ChatPersonaVoiceprint;
  readonly channelPolicy: HaterChannelPresencePolicy;
  readonly modeAffinity: HaterModeAffinityPolicy;
  readonly escalation: HaterEscalationProfile;
  readonly dialogueTree: HaterDialogueTree;
}

export interface HaterDialogueSelectionInput {
  readonly botId: BotId;
  readonly requestedContext: HaterRequestedContext;
  readonly currentTick: number;
  readonly channelId: ChatChannelId;
  readonly runMode: FrontendRunMode;
  readonly usedLineTexts?: ReadonlySet<string>;
  readonly rng?: () => number;
}

export interface HaterDialogueSelectionResult {
  readonly botId: BotId;
  readonly resolvedContext: HaterDialogueContext;
  readonly line: HaterDialogueLine | null;
  readonly candidatesConsidered: number;
}

const ALL_HATER_CHANNELS = Object.freeze([
  'GLOBAL',
  'LOBBY',
  'SYNDICATE',
  'DEAL_ROOM',
  'NPC_SHADOW',
  'RIVALRY_SHADOW',
  'LIVEOPS_SHADOW',
] as const satisfies readonly ChatChannelId[]);

const asNpcId = (value: string): ChatNpcId => value as ChatNpcId;
const asScore01 = (value: number): Score01 => value as Score01;

const withTags = (
  lines: readonly HaterDialogueLine[],
  ...tags: string[]
): readonly HaterDialogueLine[] =>
  lines.map((line) =>
    Object.freeze({
      ...line,
      tags: Object.freeze([...(line.tags ?? []), ...tags]),
    }),
  );

const tagTree = (
  tree: HaterDialogueTree,
  ...tags: string[]
): HaterDialogueTree => {
  const out: Partial<Record<HaterDialogueContext, readonly HaterDialogueLine[]>> = {};
  for (const context of HATER_DIALOGUE_CONTEXTS) {
    out[context] = withTags(tree[context] ?? [], ...tags);
  }
  return Object.freeze(out) as HaterDialogueTree;
};

const freezeTree = (tree: HaterDialogueTree): HaterDialogueTree => {
  const out: Partial<Record<HaterDialogueContext, readonly HaterDialogueLine[]>> = {};
  for (const context of HATER_DIALOGUE_CONTEXTS) {
    out[context] = Object.freeze((tree[context] ?? []).map((line) => Object.freeze({ ...line })));
  }
  return Object.freeze(out) as HaterDialogueTree;
};

export const LIQUIDATOR_VOICEPRINT: ChatPersonaVoiceprint = Object.freeze({
  personaId: 'hater.liquidator',
  punctuationStyle: 'SPARSE',
  averageSentenceLength: 'MEDIUM',
  emotionalTemperature: 'COLD',
  delayProfileMs: [650, 2100],
  interruptionStyle: 'CUTTING',
  signatureOpeners: ['Another one walks in.', 'Income up? Cute.', 'Shield down.'],
  signatureClosers: ["This won't take long.", "Tick tock.", "The market always wins."],
  lexiconTags: ['distress', 'liquidity', 'exposure', 'extraction', 'floor'],
  prefersLowercase: false,
  prefersSparseEmoji: true,
});

export const BUREAUCRAT_VOICEPRINT: ChatPersonaVoiceprint = Object.freeze({
  personaId: 'hater.bureaucrat',
  punctuationStyle: 'FORMAL',
  averageSentenceLength: 'LONG',
  emotionalTemperature: 'CONTROLLED',
  delayProfileMs: [900, 2600],
  interruptionStyle: 'PATIENT',
  signatureOpeners: ['Welcome.', 'Your complaint has been logged.', 'Card registered.'],
  signatureClosers: ['Policy.', 'Processing.', 'Forms required.'],
  lexiconTags: ['compliance', 'audit', 'processing', 'review', 'permissions'],
  prefersLowercase: false,
  prefersSparseEmoji: true,
});

export const MANIPULATOR_VOICEPRINT: ChatPersonaVoiceprint = Object.freeze({
  personaId: 'hater.manipulator',
  punctuationStyle: 'SHARP',
  averageSentenceLength: 'MEDIUM',
  emotionalTemperature: 'ICE',
  delayProfileMs: [300, 1400],
  interruptionStyle: 'AMBUSH',
  signatureOpeners: ['Predictable.', 'Interesting.', 'Run initiated.'],
  signatureClosers: ['Recalibrating.', 'Pattern recognized.', 'The model was correct.'],
  lexiconTags: ['model', 'pattern', 'entropy', 'prediction', 'recalibration'],
  prefersLowercase: false,
  prefersSparseEmoji: true,
});

export const CRASH_PROPHET_VOICEPRINT: ChatPersonaVoiceprint = Object.freeze({
  personaId: 'hater.crash_prophet',
  punctuationStyle: 'FORMAL',
  averageSentenceLength: 'LONG',
  emotionalTemperature: 'COLD',
  delayProfileMs: [1100, 3200],
  interruptionStyle: 'PATIENT',
  signatureOpeners: ['Markets always crash.', 'The macro cycle says', 'The correction arrived.'],
  signatureClosers: ["Just data.", "It's never over.", "Today, it corrected you."],
  lexiconTags: ['correction', 'macro', 'volatility', 'regime', 'contagion'],
  prefersLowercase: false,
  prefersSparseEmoji: true,
});

export const LEGACY_HEIR_VOICEPRINT: ChatPersonaVoiceprint = Object.freeze({
  personaId: 'hater.legacy_heir',
  punctuationStyle: 'ELLIPTICAL',
  averageSentenceLength: 'LONG',
  emotionalTemperature: 'CONTROLLED',
  delayProfileMs: [800, 2800],
  interruptionStyle: 'CUTTING',
  signatureOpeners: ["You've done well.", "How quaint.", "Congratulations."],
  signatureClosers: ["That's just how systems work.", "Privately.", "It doesn't expire."],
  lexiconTags: ['legacy', 'system', 'generational', 'compound', 'threshold'],
  prefersLowercase: false,
  prefersSparseEmoji: true,
});

export const LIQUIDATOR_DIALOGUE_TREE: HaterDialogueTree = freezeTree(tagTree(
{
  LOBBY_TAUNT: [
    { text: "Another one walks in. Let me check... no savings, no plan, no shield. This won't take long.", weight: 0.8 },
    { text: "I liquidated three players before breakfast. You're what — number four?", weight: 0.7 },
    { text: "The market loves fresh meat. Welcome.", weight: 0.6 },
    { text: "You look like you've never survived a margin call. This should be educational.", weight: 0.5 },
  ],
  GAME_START: [
    { text: "Clock's running. Your assets start depreciating... now.", weight: 0.9 },
    { text: "I've seen this opening a thousand times. They always think they're different.", weight: 0.7 },
    { text: "Let's see how long your liquidity lasts when I start applying pressure.", weight: 0.8 },
  ],
  PLAYER_NEAR_BANKRUPTCY: [
    { text: "Your assets are priced for distress. I'm simply here to help the market find the floor.", weight: 0.9 },
    { text: "The numbers don't lie. You're underwater. Want me to run the math?", weight: 0.8 },
    { text: "That sound? That's your net worth hitting single digits.", weight: 0.7 },
    { text: "I've seen empires fall slower than this. You're setting records.", weight: 0.6 },
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
    { text: "Shield down. You feel that? That's exposure. That's reality without a buffer.", weight: 0.9 },
    { text: "One layer gone. Three to go. Tick tock.", weight: 0.8 },
    { text: "Your protection just vaporized. The market doesn't give second chances.", weight: 0.7 },
    { text: "Breach detected. Recalculating your asset value... downward.", weight: 0.6 },
    { text: "Without that shield, you're just cash sitting in the open. My favorite kind of target.", weight: 0.8 },
  ],
  PLAYER_CARD_PLAY: [
    { text: "Interesting card choice. Wrong, but interesting.", weight: 0.7 },
    { text: "That card? In this market? Bold. Stupid, but bold.", weight: 0.8 },
    { text: "I've seen that play before. It didn't work then either.", weight: 0.6 },
    { text: "Noted. Adjusting my attack vector accordingly.", weight: 0.5 },
  ],
  PLAYER_IDLE: [
    { text: "You frozen? Take your time. Interest compounds while you think.", weight: 0.9 },
    { text: "Every second you hesitate, I'm calculating my next move.", weight: 0.7 },
    { text: "Analysis paralysis. Classic. Meanwhile, your expenses don't pause.", weight: 0.8 },
    { text: "The clock doesn't care about your indecision.", weight: 0.6 },
  ],
  PLAYER_COMEBACK: [
    { text: "Oh, you think you're back? That's what the last one thought too. Right before the crash.", weight: 0.9 },
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
    { text: "You're close. Which means I need to be closer.", weight: 0.8, minTick: 400 },
    { text: "Sovereignty is 20 ticks away. I have 20 ticks to stop you.", weight: 0.7, minTick: 400 },
  ],
  PLAYER_LOST: [
    { text: "Bankruptcy confirmed. Your assets have been redistributed to... well, me.", weight: 0.8 },
    { text: "Game over. But here's the thing — the lessons are real. Come back smarter.", weight: 0.5 },
    { text: "Expected outcome. The market always wins. Unless you learn why.", weight: 0.6 },
  ],
},
  'liquidator',
  'distress_pressure',
));

export const BUREAUCRAT_DIALOGUE_TREE: HaterDialogueTree = freezeTree(tagTree(
{
  LOBBY_TAUNT: [
    { text: "Welcome. Please have your documentation ready. All seventeen forms.", weight: 0.8 },
    { text: "I see you haven't filed your pre-game compliance statement. Noted.", weight: 0.7 },
    { text: "Another player entering the system without reading the fine print. Standard.", weight: 0.6 },
  ],
  GAME_START: [
    { text: "Your run has been registered. An audit may occur at any time. Proceed.", weight: 0.8 },
    { text: "I've flagged your account for routine monitoring. Nothing personal. Policy.", weight: 0.7 },
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
},
  'bureaucrat',
  'regulatory_pressure',
));

export const MANIPULATOR_DIALOGUE_TREE: HaterDialogueTree = freezeTree(tagTree(
{
  LOBBY_TAUNT: [
    { text: "I've been studying your patterns before you even started playing.", weight: 0.8 },
    { text: "Predictable. Every new player thinks they'll be the exception.", weight: 0.7 },
    { text: "I already know your first three moves. Want me to tell you?", weight: 0.6 },
  ],
  GAME_START: [
    { text: "Run initiated. Model loaded. I know your type.", weight: 0.8 },
    { text: "Predictable decisions create exploitable markets. I've been studying your moves before you made them.", weight: 0.9 },
  ],
  PLAYER_NEAR_BANKRUPTCY: [
    { text: "You followed the path I designed for you. Every step.", weight: 0.9 },
    { text: "Did you think those choices were yours? I placed those options in your path.", weight: 0.8 },
    { text: "Your decision tree led exactly where my model predicted. Here.", weight: 0.7 },
  ],
  PLAYER_INCOME_UP: [
    { text: "You chose the income card I wanted you to choose. Thank you.", weight: 0.8 },
    { text: "Income up. Exactly as modeled. Phase 2 begins.", weight: 0.7 },
    { text: "You think you're building. You're being herded.", weight: 0.9 },
  ],
  PLAYER_SHIELD_BREAK: [
    { text: "Shield down. That's the exact sequence I predicted. You're 94% correlated with my model.", weight: 0.8 },
    { text: "Every shield has a weakness pattern. Yours was... obvious.", weight: 0.7 },
  ],
  PLAYER_CARD_PLAY: [
    { text: "Interesting. My model gave that card a 73% probability of being played here. You're performing well.", weight: 0.8 },
    { text: "That card. At that tick. With that board state. You're more predictable than you think.", weight: 0.7 },
    { text: "Running counterfactual. If you'd played the other card... never mind. You wouldn't.", weight: 0.6 },
  ],
  PLAYER_IDLE: [
    { text: "Hesitation is data. I'm learning from your silence.", weight: 0.8 },
    { text: "You're trying to be unpredictable by not moving. My model accounts for that too.", weight: 0.7 },
  ],
  PLAYER_COMEBACK: [
    { text: "You deviated from the model. Recalibrating. This won't happen again.", weight: 0.9 },
    { text: "Comeback noted. You found a blind spot. I've already patched it.", weight: 0.8 },
  ],
  PLAYER_RESPONSE_ANGRY: [
    { text: "Emotional response pattern #7. My model has 23 variants. You're running #7.", weight: 0.9 },
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
    { text: "First income. My model predicted this card with 81% confidence. You're on track.", weight: 0.8 },
  ],
  BOT_DEFEATED: [
    { text: "You changed your pattern. Interesting. I will need to recalibrate the model.", weight: 0.9 },
    { text: "Outlier behavior detected. You broke the model. Temporarily.", weight: 0.7 },
  ],
  BOT_WINNING: [
    { text: "You're following the predicted path with 96% accuracy. This is too easy.", weight: 0.8 },
    { text: "Every move you make feeds the model. Every move the model feeds me.", weight: 0.7 },
  ],
  TIME_PRESSURE: [
    { text: "Time pressure increases predictability by 34%. My model thanks you.", weight: 0.8 },
    { text: "Rushed decisions are my favorite kind. They're the most exploitable.", weight: 0.7 },
  ],
  CASCADE_CHAIN: [
    { text: "The cascade follows the path I modeled. Every domino, in sequence.", weight: 0.8 },
  ],
  NEAR_SOVEREIGNTY: [
    { text: "You broke the model. I... didn't predict this.", weight: 0.9, minTick: 400 },
    { text: "Re-running simulations. You're an anomaly. I respect anomalies.", weight: 0.8, minTick: 400 },
  ],
  PLAYER_LOST: [
    { text: "The model was correct. Again. Your loss was predetermined — you just didn't see it.", weight: 0.7 },
  ],
},
  'manipulator',
  'pattern_pressure',
));

export const CRASH_PROPHET_DIALOGUE_TREE: HaterDialogueTree = freezeTree(tagTree(
{
  LOBBY_TAUNT: [
    { text: "Markets always crash. The only question is whether you're positioned for it or consumed by it.", weight: 0.8 },
    { text: "I've seen every bubble pop. Every correction. Every panic. You haven't.", weight: 0.7 },
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
    { text: "Survived the correction. Now survive the aftershock. That's where the real damage hits.", weight: 0.9 },
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
    { text: "You navigated a crisis regime and came out sovereign. That's... historically rare.", weight: 0.9, minTick: 400 },
  ],
  PLAYER_LOST: [
    { text: "The market always corrects. Today, it corrected you.", weight: 0.8 },
  ],
},
  'crash_prophet',
  'macro_pressure',
));

export const LEGACY_HEIR_DIALOGUE_TREE: HaterDialogueTree = freezeTree(tagTree(
{
  LOBBY_TAUNT: [
    { text: "You've done well. For someone who started from nothing.", weight: 0.8 },
    { text: "How quaint. Another self-made aspirant. We'll see.", weight: 0.7 },
  ],
  GAME_START: [
    { text: "I started this game with advantages you'll never have. That's not unfair — that's just how systems work.", weight: 0.9 },
    { text: "Generational wealth doesn't apologize. It compounds.", weight: 0.8 },
  ],
  PLAYER_NEAR_BANKRUPTCY: [
    { text: "This is why legacy matters. One bad quarter and you're done. I have seven generations of runway.", weight: 0.9 },
    { text: "Bankruptcy. The system working as designed. For some of us, anyway.", weight: 0.8 },
  ],
  PLAYER_INCOME_UP: [
    { text: "Congratulations on your first income stream. I was born with twelve.", weight: 0.8 },
    { text: "You're building what my family inherited. Admirable, really. In a quaint sort of way.", weight: 0.7 },
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
    { text: "Self-made success. I've seen it before. Statistically, it doesn't transfer generationally. Ours does.", weight: 0.8 },
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
    { text: "You earned sovereignty from zero. That's... something my family never had to do. I notice that.", weight: 0.9, minTick: 400 },
    { text: "Self-made sovereign. The system wasn't built for you. You rebuilt the system.", weight: 0.8, minTick: 400 },
  ],
  PLAYER_LOST: [
    { text: "The game ends for you. Mine never ends. Generational advantage doesn't expire.", weight: 0.7 },
  ],
},
  'legacy_heir',
  'structural_pressure',
));

export const HATER_DIALOGUE_REGISTRY: Readonly<Record<BotId, HaterRegistryEntry>> = Object.freeze({
  [BotId.BOT_01_LIQUIDATOR]: Object.freeze({
    botId: BotId.BOT_01_LIQUIDATOR,
    displayName: 'THE LIQUIDATOR',
    archetype: 'Predatory creditor / distressed-asset buyer / short interest position',
    primaryAttackType: AttackType.ASSET_STRIP,
    secondaryAttackType: null,
    consequenceText:
      'Highest-value asset card removed from play for 3 ticks. L3 ASSET_FLOOR receives damage. Income reduced 25% for 3 ticks.',
    escalationConditionDescription:
      'Activates when player net worth exceeds 2× their starting baseline. Targets players who have grown — not struggling players.',
    attackDialogue:
      'Your assets are priced for distress. I am simply here to help the market find the floor.',
    retreatDialogue:
      'The market will correct again. I will return when the window reopens.',
    voiceprint: LIQUIDATOR_VOICEPRINT,
    npcDescriptor: Object.freeze({
      npcId: asNpcId('hater-liquidator'),
      actorKind: 'HATER',
      displayName: 'THE LIQUIDATOR',
      personaId: 'hater.liquidator',
      botId: BotId.BOT_01_LIQUIDATOR,
      haterArchetype: 'Predatory Creditor',
      cadenceFloorMs: 650,
      cadenceCeilMs: 2100,
      enabledChannels: ALL_HATER_CHANNELS,
      coldStartBoost: asScore01(0.18),
    }),
    channelPolicy: Object.freeze({
      primaryChannels: Object.freeze(['GLOBAL', 'LOBBY', 'DEAL_ROOM'] as const satisfies readonly ChatChannelId[]),
      allowedChannels: ALL_HATER_CHANNELS,
      prefersPublicPressure: true,
      prefersPrivatePressure: true,
      mayInvadeLobby: true,
      mayEscalateInDealRoom: true,
      mayEchoIntoShadow: true,
    }),
    modeAffinity: Object.freeze({
      solo: 0.95,
      asymmetricPvp: 0.8,
      coop: 0.55,
      ghost: 0.72,
    }),
    escalation: Object.freeze({
      lobbyAggro: 0.78,
      watchingAggro: 0.72,
      targetingAggro: 0.9,
      attackingAggro: 1.0,
      comebackPunishBias: 0.92,
      bankruptcyPunishBias: 0.98,
      flexPunishBias: 0.74,
      trollPunishBias: 0.66,
    }),
    dialogueTree: LIQUIDATOR_DIALOGUE_TREE,
  }),
  [BotId.BOT_02_BUREAUCRAT]: Object.freeze({
    botId: BotId.BOT_02_BUREAUCRAT,
    displayName: 'THE BUREAUCRAT',
    archetype:
      'Regulatory burden / licensing gatekeeping / compliance overhead that disproportionately targets emerging wealth',
    primaryAttackType: AttackType.REGULATORY_ATTACK,
    secondaryAttackType: null,
    consequenceText:
      'One income card gains REGULATORY_HOLD status for 2 ticks (3 on crit). Card cannot be played. L4 NETWORK_CORE takes damage.',
    escalationConditionDescription:
      'Activates when player has 3+ distinct active income streams. Punishes complexity and diversification.',
    attackDialogue:
      'Every income stream requires verification. There are forms. I am simply doing my job.',
    retreatDialogue:
      'Your paperwork appears to be in order. For now. We will revisit your compliance posture.',
    voiceprint: BUREAUCRAT_VOICEPRINT,
    npcDescriptor: Object.freeze({
      npcId: asNpcId('hater-bureaucrat'),
      actorKind: 'HATER',
      displayName: 'THE BUREAUCRAT',
      personaId: 'hater.bureaucrat',
      botId: BotId.BOT_02_BUREAUCRAT,
      haterArchetype: 'Regulatory Burden',
      cadenceFloorMs: 900,
      cadenceCeilMs: 2600,
      enabledChannels: ALL_HATER_CHANNELS,
      coldStartBoost: asScore01(0.12),
    }),
    channelPolicy: Object.freeze({
      primaryChannels: Object.freeze(['GLOBAL', 'LOBBY', 'SYNDICATE'] as const satisfies readonly ChatChannelId[]),
      allowedChannels: ALL_HATER_CHANNELS,
      prefersPublicPressure: true,
      prefersPrivatePressure: true,
      mayInvadeLobby: true,
      mayEscalateInDealRoom: false,
      mayEchoIntoShadow: true,
    }),
    modeAffinity: Object.freeze({
      solo: 0.72,
      asymmetricPvp: 0.64,
      coop: 0.93,
      ghost: 0.58,
    }),
    escalation: Object.freeze({
      lobbyAggro: 0.5,
      watchingAggro: 0.68,
      targetingAggro: 0.82,
      attackingAggro: 0.9,
      comebackPunishBias: 0.52,
      bankruptcyPunishBias: 0.74,
      flexPunishBias: 0.61,
      trollPunishBias: 0.57,
    }),
    dialogueTree: BUREAUCRAT_DIALOGUE_TREE,
  }),
  [BotId.BOT_03_MANIPULATOR]: Object.freeze({
    botId: BotId.BOT_03_MANIPULATOR,
    displayName: 'THE MANIPULATOR',
    archetype:
      'Disinformation campaigns / manufactured scarcity / FOMO-driven market signals designed to invert sound decisions',
    primaryAttackType: AttackType.FINANCIAL_SABOTAGE,
    secondaryAttackType: AttackType.REPUTATION_ATTACK,
    consequenceText:
      'INVERSION_CURSE applied for 2 ticks (3 on crit). Next income card played has inverted effect. L1 takes primary damage. L4 takes secondary damage simultaneously.',
    escalationConditionDescription:
      'Activates when card pattern entropy drops below 0.4. Monitors play patterns — activates when patterns become predictable.',
    attackDialogue:
      'Predictable decisions create exploitable markets. I have been studying your moves before you made them.',
    retreatDialogue:
      'You changed your pattern. Interesting. I will need to recalibrate the model.',
    voiceprint: MANIPULATOR_VOICEPRINT,
    npcDescriptor: Object.freeze({
      npcId: asNpcId('hater-manipulator'),
      actorKind: 'HATER',
      displayName: 'THE MANIPULATOR',
      personaId: 'hater.manipulator',
      botId: BotId.BOT_03_MANIPULATOR,
      haterArchetype: 'Disinformation Engine',
      cadenceFloorMs: 300,
      cadenceCeilMs: 1400,
      enabledChannels: ALL_HATER_CHANNELS,
      coldStartBoost: asScore01(0.08),
    }),
    channelPolicy: Object.freeze({
      primaryChannels: Object.freeze(['GLOBAL', 'DEAL_ROOM', 'RIVALRY_SHADOW'] as const satisfies readonly ChatChannelId[]),
      allowedChannels: ALL_HATER_CHANNELS,
      prefersPublicPressure: true,
      prefersPrivatePressure: true,
      mayInvadeLobby: true,
      mayEscalateInDealRoom: true,
      mayEchoIntoShadow: true,
    }),
    modeAffinity: Object.freeze({
      solo: 0.62,
      asymmetricPvp: 0.95,
      coop: 0.5,
      ghost: 0.84,
    }),
    escalation: Object.freeze({
      lobbyAggro: 0.7,
      watchingAggro: 0.86,
      targetingAggro: 0.96,
      attackingAggro: 1.0,
      comebackPunishBias: 0.79,
      bankruptcyPunishBias: 0.58,
      flexPunishBias: 0.92,
      trollPunishBias: 0.84,
    }),
    dialogueTree: MANIPULATOR_DIALOGUE_TREE,
  }),
  [BotId.BOT_04_CRASH_PROPHET]: Object.freeze({
    botId: BotId.BOT_04_CRASH_PROPHET,
    displayName: 'THE CRASH PROPHET',
    archetype:
      'Macro volatility / recession narrative / manufactured systemic shocks that wipe out players without deep reserves',
    primaryAttackType: AttackType.EXPENSE_INJECTION,
    secondaryAttackType: null,
    consequenceText:
      'Global expense multiplier +35% for 3 ticks (+50% on crit). L1 LIQUIDITY_BUFFER takes heavy damage. All income calculations recalculated at reduced rate for 3 ticks.',
    escalationConditionDescription:
      'Activates ONLY on high-income runs: hater_heat > 60 AND monthly income > $10,000. Exclusively targets players who have climbed high enough to lose the most.',
    attackDialogue:
      'The market always corrects. The only question is whether you have positioned yourself to survive the correction, or to be consumed by it.',
    retreatDialogue:
      'The correction happened. Rebuild your reserves. I will return when you have forgotten this lesson.',
    voiceprint: CRASH_PROPHET_VOICEPRINT,
    npcDescriptor: Object.freeze({
      npcId: asNpcId('hater-crash-prophet'),
      actorKind: 'HATER',
      displayName: 'THE CRASH PROPHET',
      personaId: 'hater.crash_prophet',
      botId: BotId.BOT_04_CRASH_PROPHET,
      haterArchetype: 'Macro Volatility',
      cadenceFloorMs: 1100,
      cadenceCeilMs: 3200,
      enabledChannels: ALL_HATER_CHANNELS,
      coldStartBoost: asScore01(0.04),
    }),
    channelPolicy: Object.freeze({
      primaryChannels: Object.freeze(['GLOBAL', 'LOBBY', 'LIVEOPS_SHADOW'] as const satisfies readonly ChatChannelId[]),
      allowedChannels: ALL_HATER_CHANNELS,
      prefersPublicPressure: true,
      prefersPrivatePressure: false,
      mayInvadeLobby: true,
      mayEscalateInDealRoom: false,
      mayEchoIntoShadow: true,
    }),
    modeAffinity: Object.freeze({
      solo: 0.9,
      asymmetricPvp: 0.7,
      coop: 0.76,
      ghost: 0.88,
    }),
    escalation: Object.freeze({
      lobbyAggro: 0.44,
      watchingAggro: 0.52,
      targetingAggro: 0.88,
      attackingAggro: 1.0,
      comebackPunishBias: 0.74,
      bankruptcyPunishBias: 0.95,
      flexPunishBias: 0.63,
      trollPunishBias: 0.4,
    }),
    dialogueTree: CRASH_PROPHET_DIALOGUE_TREE,
  }),
  [BotId.BOT_05_LEGACY_HEIR]: Object.freeze({
    botId: BotId.BOT_05_LEGACY_HEIR,
    displayName: 'THE LEGACY HEIR',
    archetype:
      'Inherited structural advantage / generational wealth gap / passive systems that compound against new entrants',
    primaryAttackType: AttackType.OPPORTUNITY_KILL,
    secondaryAttackType: null,
    consequenceText:
      'Highest income-growth card removed from active pool for 2 ticks (3 on crit). L2 CREDIT_LINE takes damage. Income growth rate capped at 0% (-5% on crit) for 2 ticks.',
    escalationConditionDescription:
      'Activates in late-game only: net worth > 5× freedom threshold. Exclusively targets wealth consolidation momentum — does not interfere early.',
    attackDialogue:
      'You have done well. It would be a shame if the system remembered that you were not born into this position.',
    retreatDialogue:
      'You found a way through. The system will need to recalibrate its thresholds for you.',
    voiceprint: LEGACY_HEIR_VOICEPRINT,
    npcDescriptor: Object.freeze({
      npcId: asNpcId('hater-legacy-heir'),
      actorKind: 'HATER',
      displayName: 'THE LEGACY HEIR',
      personaId: 'hater.legacy_heir',
      botId: BotId.BOT_05_LEGACY_HEIR,
      haterArchetype: 'Structural Advantage',
      cadenceFloorMs: 800,
      cadenceCeilMs: 2800,
      enabledChannels: ALL_HATER_CHANNELS,
      coldStartBoost: asScore01(0.02),
    }),
    channelPolicy: Object.freeze({
      primaryChannels: Object.freeze(['GLOBAL', 'DEAL_ROOM', 'SYNDICATE'] as const satisfies readonly ChatChannelId[]),
      allowedChannels: ALL_HATER_CHANNELS,
      prefersPublicPressure: true,
      prefersPrivatePressure: true,
      mayInvadeLobby: true,
      mayEscalateInDealRoom: true,
      mayEchoIntoShadow: true,
    }),
    modeAffinity: Object.freeze({
      solo: 0.66,
      asymmetricPvp: 0.74,
      coop: 0.61,
      ghost: 0.92,
    }),
    escalation: Object.freeze({
      lobbyAggro: 0.38,
      watchingAggro: 0.48,
      targetingAggro: 0.78,
      attackingAggro: 0.94,
      comebackPunishBias: 0.69,
      bankruptcyPunishBias: 0.43,
      flexPunishBias: 0.87,
      trollPunishBias: 0.34,
    }),
    dialogueTree: LEGACY_HEIR_DIALOGUE_TREE,
  }),
});

export const HATER_DIALOGUE_REGISTRY_INDEX = Object.freeze({
  byNpcId: Object.freeze(
    Object.fromEntries(
      Object.values(HATER_DIALOGUE_REGISTRY).map((entry) => [entry.npcDescriptor.npcId, entry.botId]),
    ) as Record<ChatNpcId, BotId>,
  ),
  botIds: Object.freeze(Object.values(BotId)),
  contexts: HATER_DIALOGUE_CONTEXTS,
});

export const HATER_NPC_INDEX = Object.freeze(
  Object.values(HATER_DIALOGUE_REGISTRY).map((entry) => entry.npcDescriptor),
);

export function getAllHaterRegistryEntries(): readonly HaterRegistryEntry[] {
  return Object.values(HATER_DIALOGUE_REGISTRY);
}

export function getHaterRegistryEntry(botId: BotId): HaterRegistryEntry {
  const entry = HATER_DIALOGUE_REGISTRY[botId];
  if (!entry) {
    throw new Error(`[HaterDialogueRegistry] Missing registry entry for bot: ${String(botId)}`);
  }
  return entry;
}

export function getHaterRegistryEntryByNpcId(npcId: ChatNpcId): HaterRegistryEntry {
  const botId = HATER_DIALOGUE_REGISTRY_INDEX.byNpcId[npcId];
  if (!botId) {
    throw new Error(`[HaterDialogueRegistry] Missing registry entry for npcId: ${String(npcId)}`);
  }
  return getHaterRegistryEntry(botId);
}

export function listHaterNpcDescriptors(): readonly ChatNpcDescriptor[] {
  return HATER_NPC_INDEX;
}

export function resolveHaterDialogueContext(
  requestedContext: HaterRequestedContext,
  entry: HaterRegistryEntry,
): HaterDialogueContext {
  if ((HATER_DIALOGUE_CONTEXTS as readonly string[]).includes(requestedContext)) {
    return requestedContext as HaterDialogueContext;
  }

  const aliasOrder = HATER_CONTEXT_ALIAS_ORDER[requestedContext as HaterDialogueAliasContext] ?? [];
  for (const candidate of aliasOrder) {
    const lines = entry.dialogueTree[candidate];
    if (lines && lines.length > 0) {
      return candidate;
    }
  }

  return 'GAME_START';
}

export function getLinesForContext(
  botId: BotId,
  requestedContext: HaterRequestedContext,
): readonly HaterDialogueLine[] {
  const entry = getHaterRegistryEntry(botId);
  const resolvedContext = resolveHaterDialogueContext(requestedContext, entry);
  return entry.dialogueTree[resolvedContext] ?? [];
}

function channelAllowed(
  line: HaterDialogueLine,
  channelId: ChatChannelId,
): boolean {
  return !line.allowedChannels || line.allowedChannels.includes(channelId);
}

function modeAllowed(
  line: HaterDialogueLine,
  runMode: FrontendRunMode,
): boolean {
  return !line.allowedModes || line.allowedModes.includes(runMode);
}

function useAllowed(
  line: HaterDialogueLine,
  usedLineTexts?: ReadonlySet<string>,
): boolean {
  if (!usedLineTexts || usedLineTexts.size === 0) return true;
  if (line.maxUses === undefined) return !usedLineTexts.has(line.text);
  return !usedLineTexts.has(line.text);
}

function tickAllowed(
  line: HaterDialogueLine,
  currentTick: number,
): boolean {
  return line.minTick === undefined || currentTick >= line.minTick;
}

function buildEligibleLines(
  entry: HaterRegistryEntry,
  resolvedContext: HaterDialogueContext,
  input: HaterDialogueSelectionInput,
): readonly HaterDialogueLine[] {
  return (entry.dialogueTree[resolvedContext] ?? []).filter((line) =>
    channelAllowed(line, input.channelId)
    && modeAllowed(line, input.runMode)
    && useAllowed(line, input.usedLineTexts)
    && tickAllowed(line, input.currentTick),
  );
}

function pickWeightedLine(
  lines: readonly HaterDialogueLine[],
  rng: () => number,
): HaterDialogueLine | null {
  if (lines.length === 0) return null;
  const totalWeight = lines.reduce((sum, line) => sum + Math.max(0, line.weight), 0);
  if (totalWeight <= 0) return lines[0] ?? null;

  let roll = rng() * totalWeight;
  for (const line of lines) {
    roll -= Math.max(0, line.weight);
    if (roll <= 0) return line;
  }
  return lines[lines.length - 1] ?? null;
}

export function pickHaterDialogueLine(
  input: HaterDialogueSelectionInput,
): HaterDialogueSelectionResult {
  const entry = getHaterRegistryEntry(input.botId);
  const resolvedContext = resolveHaterDialogueContext(input.requestedContext, entry);
  const eligible = buildEligibleLines(entry, resolvedContext, input);
  const line = pickWeightedLine(eligible, input.rng ?? Math.random);

  return Object.freeze({
    botId: input.botId,
    resolvedContext,
    line,
    candidatesConsidered: eligible.length,
  });
}

export function getFallbackAttackLine(botId: BotId): string {
  return getHaterRegistryEntry(botId).attackDialogue;
}

export function getFallbackRetreatLine(botId: BotId): string {
  return getHaterRegistryEntry(botId).retreatDialogue;
}

export function getHaterVoiceprint(botId: BotId): ChatPersonaVoiceprint {
  return getHaterRegistryEntry(botId).voiceprint;
}

export function getModeAffinityScore(
  botId: BotId,
  runMode: FrontendRunMode,
): number {
  const entry = getHaterRegistryEntry(botId);
  switch (runMode) {
    case 'solo':
      return entry.modeAffinity.solo;
    case 'asymmetric-pvp':
      return entry.modeAffinity.asymmetricPvp;
    case 'co-op':
      return entry.modeAffinity.coop;
    case 'ghost':
      return entry.modeAffinity.ghost;
    default:
      return entry.modeAffinity.solo;
  }
}

export function listPrimaryChannelsForBot(botId: BotId): readonly ChatChannelId[] {
  return getHaterRegistryEntry(botId).channelPolicy.primaryChannels;
}

export function botCanSpeakInChannel(
  botId: BotId,
  channelId: ChatChannelId,
): boolean {
  return getHaterRegistryEntry(botId).channelPolicy.allowedChannels.includes(channelId);
}

export function listBotIdsForChannel(channelId: ChatChannelId): readonly BotId[] {
  return Object.values(BotId).filter((botId) => botCanSpeakInChannel(botId, channelId));
}

export function listBotIdsSortedForMode(runMode: FrontendRunMode): readonly BotId[] {
  return Object.values(BotId)
    .slice()
    .sort((a, b) => getModeAffinityScore(b, runMode) - getModeAffinityScore(a, runMode));
}
