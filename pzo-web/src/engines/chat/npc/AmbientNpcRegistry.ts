
// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/chat/npc/AmbientNpcRegistry.ts

/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT AMBIENT NPC REGISTRY
 * FILE: pzo-web/src/engines/chat/npc/AmbientNpcRegistry.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical ambient/social-world registry for the frontend chat engine lane.
 *
 * Haters deliver pressure. Helpers deliver targeted intervention.
 * Ambient NPCs deliver the living-world layer in between:
 *
 * - crowd witness lines,
 * - lobby atmosphere,
 * - public market chatter,
 * - syndicate whispers,
 * - deal-room temperature,
 * - replay-worthy “the room noticed that” reactions,
 * - low-authority world texture that makes the run feel watched.
 *
 * This file is intentionally world-facing instead of authority-facing.
 * It never overrides hater or helper ownership. It provides the emotional
 * operating background that turns channels into places instead of tabs.
 *
 * Design laws
 * -----------
 * - Ambient lines must feel authored, not spammy.
 * - Channel identity matters:
 *   GLOBAL is theatrical,
 *   SYNDICATE is intimate and tactical,
 *   DEAL_ROOM is predatory and restrained,
 *   LOBBY is ceremonial and anticipatory.
 * - Ambient NPCs do not replace players. They tint the room, punctuate moments,
 *   and witness events.
 * - Selection must remain cheap, deterministic-friendly, and director-ready.
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

import type {
  FrontendRunMode,
  HaterDialogueContext,
  HaterDialogueLine,
} from './HaterDialogueRegistry';

export type AmbientNpcId =
  | 'LOBBY_CRIER'
  | 'FLOOR_BROKER'
  | 'PIT_WITNESS'
  | 'SYNDICATE_SCOUT'
  | 'DEAL_CLERK'
  | 'GHOST_SPECULATOR'
  | 'MARKET_MAKER'
  | 'ARCHIVE_RUNNER';

export type AmbientDialogueContext =
  | HaterDialogueContext
  | 'QUEUE_FORMING'
  | 'CHANNEL_HEAT_RISING'
  | 'CHANNEL_HEAT_BREAKING'
  | 'DEAL_SILENCE'
  | 'SYNDICATE_SIGNAL'
  | 'POST_RUN_WIN'
  | 'POST_RUN_FAIL'
  | 'ROOM_RECOGNITION';

export interface AmbientChannelPresencePolicy {
  readonly primaryChannels: readonly ChatChannelId[];
  readonly allowedChannels: readonly ChatChannelId[];
  readonly publicWeight: Score01;
  readonly privateWeight: Score01;
  readonly mayEchoLegendMoments: boolean;
  readonly mayEchoRescueMoments: boolean;
}

export interface AmbientModeAffinityPolicy {
  readonly solo: number;
  readonly asymmetricPvp: number;
  readonly coop: number;
  readonly ghost: number;
}

export interface AmbientCadencePolicy {
  readonly floorMs: number;
  readonly ceilMs: number;
  readonly burstCapPerScene: number;
  readonly cooldownTicks: number;
}

export type AmbientDialogueTree = Partial<
  Record<AmbientDialogueContext, readonly HaterDialogueLine[]>
>;

export interface AmbientRegistryEntry {
  readonly ambientId: AmbientNpcId;
  readonly displayName: string;
  readonly role: string;
  readonly npcDescriptor: ChatNpcDescriptor;
  readonly voiceprint: ChatPersonaVoiceprint;
  readonly cadence: AmbientCadencePolicy;
  readonly channelPolicy: AmbientChannelPresencePolicy;
  readonly modeAffinity: AmbientModeAffinityPolicy;
  readonly heatSensitivity: Score01;
  readonly rescueSensitivity: Score01;
  readonly dealTensionSensitivity: Score01;
  readonly dialogueTree: AmbientDialogueTree;
}

export interface AmbientSelectionInput {
  readonly ambientId: AmbientNpcId;
  readonly requestedContext: AmbientDialogueContext;
  readonly currentTick: number;
  readonly channelId: ChatChannelId;
  readonly runMode: FrontendRunMode;
  readonly crowdHeat?: number;
  readonly rescueOpen?: boolean;
  readonly dealTension?: number;
  readonly usedLineTexts?: ReadonlySet<string>;
  readonly rng?: () => number;
}

export interface AmbientSelectionResult {
  readonly ambientId: AmbientNpcId;
  readonly resolvedContext: AmbientDialogueContext;
  readonly line: HaterDialogueLine | null;
  readonly candidatesConsidered: number;
}

const ALL_AMBIENT_CHANNELS = Object.freeze([
  'GLOBAL',
  'LOBBY',
  'SYNDICATE',
  'DEAL_ROOM',
  'NPC_SHADOW',
  'LIVEOPS_SHADOW',
  'RIVALRY_SHADOW',
  'RESCUE_SHADOW',
] as const satisfies readonly ChatChannelId[]);

const asNpcId = (value: string): ChatNpcId => value as ChatNpcId;
const asScore01 = (value: number): Score01 => value as Score01;

const AMBIENT_CONTEXT_ORDER = Object.freeze([
  'QUEUE_FORMING',
  'LOBBY_TAUNT',
  'GAME_START',
  'PLAYER_FIRST_INCOME',
  'PLAYER_CARD_PLAY',
  'PLAYER_INCOME_UP',
  'PLAYER_SHIELD_BREAK',
  'PLAYER_NEAR_BANKRUPTCY',
  'PLAYER_IDLE',
  'PLAYER_COMEBACK',
  'BOT_DEFEATED',
  'BOT_WINNING',
  'TIME_PRESSURE',
  'CASCADE_CHAIN',
  'CHANNEL_HEAT_RISING',
  'CHANNEL_HEAT_BREAKING',
  'SYNDICATE_SIGNAL',
  'DEAL_SILENCE',
  'NEAR_SOVEREIGNTY',
  'ROOM_RECOGNITION',
  'POST_RUN_WIN',
  'POST_RUN_FAIL',
  'PLAYER_LOST',
] as const satisfies readonly AmbientDialogueContext[]);

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
  tree: AmbientDialogueTree,
  ...tags: string[]
): AmbientDialogueTree => {
  const out: Partial<Record<AmbientDialogueContext, readonly HaterDialogueLine[]>> = {};
  for (const context of AMBIENT_CONTEXT_ORDER) {
    out[context] = withTags(tree[context] ?? [], ...tags);
  }
  return Object.freeze(out) as AmbientDialogueTree;
};

const freezeTree = (tree: AmbientDialogueTree): AmbientDialogueTree => {
  const out: Partial<Record<AmbientDialogueContext, readonly HaterDialogueLine[]>> = {};
  for (const context of AMBIENT_CONTEXT_ORDER) {
    out[context] = Object.freeze((tree[context] ?? []).map((line) => Object.freeze({ ...line })));
  }
  return Object.freeze(out) as AmbientDialogueTree;
};

export const LOBBY_CRIER_VOICEPRINT: ChatPersonaVoiceprint = Object.freeze({
  personaId: 'ambient.lobby_crier',
  punctuationStyle: 'CEREMONIAL',
  averageSentenceLength: 'LONG',
  emotionalTemperature: 'HOT',
  delayProfileMs: [500, 1400],
  interruptionStyle: 'CUTTING',
  signatureOpeners: ['Queue notice.', 'Lobby call.', 'Witness this.'],
  signatureClosers: ['Step forward.', 'The room is watching.', 'Mark the name.'],
  lexiconTags: ['lobby', 'queue', 'witness', 'entrance', 'call'],
  prefersLowercase: false,
  prefersSparseEmoji: true,
});

export const FLOOR_BROKER_VOICEPRINT: ChatPersonaVoiceprint = Object.freeze({
  personaId: 'ambient.floor_broker',
  punctuationStyle: 'SHARP',
  averageSentenceLength: 'MEDIUM',
  emotionalTemperature: 'COOL',
  delayProfileMs: [300, 900],
  interruptionStyle: 'AMBUSH',
  signatureOpeners: ['Flow update.', 'Market note.', 'Tape says'],
  signatureClosers: ['Price it.', 'Move it.', 'The floor saw that.'],
  lexiconTags: ['flow', 'market', 'tape', 'pricing', 'order'],
  prefersLowercase: false,
  prefersSparseEmoji: true,
});

export const PIT_WITNESS_VOICEPRINT: ChatPersonaVoiceprint = Object.freeze({
  personaId: 'ambient.pit_witness',
  punctuationStyle: 'SPARSE',
  averageSentenceLength: 'MEDIUM',
  emotionalTemperature: 'WARM',
  delayProfileMs: [650, 1700],
  interruptionStyle: 'PATIENT',
  signatureOpeners: ['Saw that.', 'Room felt that.', 'Witness note.'],
  signatureClosers: ['Keep going.', 'That landed.', 'Nobody missed it.'],
  lexiconTags: ['witness', 'room', 'felt', 'seen', 'moment'],
  prefersLowercase: false,
  prefersSparseEmoji: true,
});

export const SYNDICATE_SCOUT_VOICEPRINT: ChatPersonaVoiceprint = Object.freeze({
  personaId: 'ambient.syndicate_scout',
  punctuationStyle: 'SPARSE',
  averageSentenceLength: 'SHORT',
  emotionalTemperature: 'CONTROLLED',
  delayProfileMs: [450, 1200],
  interruptionStyle: 'PATIENT',
  signatureOpeners: ['Whisper.', 'Quiet signal.', 'Syndicate note.'],
  signatureClosers: ['Eyes up.', 'Stay subtle.', 'Move quiet.'],
  lexiconTags: ['signal', 'whisper', 'quiet', 'position', 'watch'],
  prefersLowercase: false,
  prefersSparseEmoji: true,
});

export const DEAL_CLERK_VOICEPRINT: ChatPersonaVoiceprint = Object.freeze({
  personaId: 'ambient.deal_clerk',
  punctuationStyle: 'FORMAL',
  averageSentenceLength: 'MEDIUM',
  emotionalTemperature: 'COLD',
  delayProfileMs: [700, 1800],
  interruptionStyle: 'PATIENT',
  signatureOpeners: ['Deal room notice.', 'Offer ledger.', 'Counter pending.'],
  signatureClosers: ['Terms stand.', 'Clock remains.', 'Silence has value.'],
  lexiconTags: ['offer', 'terms', 'counter', 'clock', 'silence'],
  prefersLowercase: false,
  prefersSparseEmoji: true,
});

export const GHOST_SPECULATOR_VOICEPRINT: ChatPersonaVoiceprint = Object.freeze({
  personaId: 'ambient.ghost_speculator',
  punctuationStyle: 'ELLIPTICAL',
  averageSentenceLength: 'MEDIUM',
  emotionalTemperature: 'ICE',
  delayProfileMs: [800, 2300],
  interruptionStyle: 'AMBUSH',
  signatureOpeners: ['Ghost read.', 'Somebody noticed.', 'Air says'],
  signatureClosers: ['Maybe.', 'Noted.', 'That will echo.'],
  lexiconTags: ['ghost', 'echo', 'air', 'speculation', 'shadow'],
  prefersLowercase: false,
  prefersSparseEmoji: true,
});

export const MARKET_MAKER_VOICEPRINT: ChatPersonaVoiceprint = Object.freeze({
  personaId: 'ambient.market_maker',
  punctuationStyle: 'SHARP',
  averageSentenceLength: 'MEDIUM',
  emotionalTemperature: 'CONTROLLED',
  delayProfileMs: [350, 1000],
  interruptionStyle: 'CUTTING',
  signatureOpeners: ['Spread moved.', 'Price changed.', 'Market shifted.'],
  signatureClosers: ['Reprice.', 'That changed the spread.', 'Adjust.'],
  lexiconTags: ['spread', 'price', 'reprice', 'liquidity', 'depth'],
  prefersLowercase: false,
  prefersSparseEmoji: true,
});

export const ARCHIVE_RUNNER_VOICEPRINT: ChatPersonaVoiceprint = Object.freeze({
  personaId: 'ambient.archive_runner',
  punctuationStyle: 'FORMAL',
  averageSentenceLength: 'LONG',
  emotionalTemperature: 'CONTROLLED',
  delayProfileMs: [900, 2400],
  interruptionStyle: 'PATIENT',
  signatureOpeners: ['Archive runner.', 'Record carry.', 'Ledger transit.'],
  signatureClosers: ['Filed.', 'Preserved.', 'The record keeps it.'],
  lexiconTags: ['archive', 'ledger', 'record', 'preserved', 'carry'],
  prefersLowercase: false,
  prefersSparseEmoji: true,
});
export const LOBBY_CRIER_DIALOGUE_TREE: AmbientDialogueTree = freezeTree(tagTree(
{
  QUEUE_FORMING: [
    Object.freeze({ text: "Queue building. Names rise, bravado rises faster.", weight: 0.88 }),
    Object.freeze({ text: "Another room filling with people who swear they already solved the board.", weight: 0.82 }),
    Object.freeze({ text: "The line tightens. Somebody important thinks tonight is theirs.", weight: 0.8 }),
  ],

  LOBBY_TAUNT: [
    Object.freeze({ text: "Entrance logged. The lobby always gets louder when a serious run is about to happen.", weight: 0.9 }),
    Object.freeze({ text: "Witness the arrival. Some walk in with confidence. Some with camouflage.", weight: 0.84 }),
    Object.freeze({ text: "Another contender steps under the lights. The room immediately starts judging the posture.", weight: 0.82 }),
  ],

  GAME_START: [
    Object.freeze({ text: "And there it is. Silence before pressure, pressure before reputation.", weight: 0.86 }),
    Object.freeze({ text: "Run live. The lobby becomes history in seconds.", weight: 0.82 }),
    Object.freeze({ text: "Open the books. Somebody is about to improve or unravel in public.", weight: 0.8 }),
  ],

  PLAYER_COMEBACK: [
    Object.freeze({ text: "The lobby felt that turn from here.", weight: 0.84 }),
    Object.freeze({ text: "Momentum reversal. Even the watchers stopped pretending not to care.", weight: 0.8 }),
    Object.freeze({ text: "A comeback that sharp always changes the room's tone.", weight: 0.82 }),
  ],

  NEAR_SOVEREIGNTY: [
    Object.freeze({ text: "Late-run alert. The crowd has moved from mockery to witness.", weight: 0.92, minTick: 400 }),
    Object.freeze({ text: "Close enough now that the lobby is no longer background noise.", weight: 0.88, minTick: 400 }),
    Object.freeze({ text: "Approach recorded. A finish from here would travel.", weight: 0.84, minTick: 400 }),
  ],

  POST_RUN_WIN: [
    Object.freeze({ text: "Result posted. The lobby now belongs to the completed run, not the promises that came before it.", weight: 0.94, memoryAnchor: true }),
    Object.freeze({ text: "Win sealed. The entrance was noise. The exit is proof.", weight: 0.88 }),
    Object.freeze({ text: "Witness complete. Somebody arrived as a name and leaves as a result.", weight: 0.86 }),
  ],

  POST_RUN_FAIL: [
    Object.freeze({ text: "Loss posted. The lobby goes back to pretending failure is rare.", weight: 0.84, memoryAnchor: true }),
    Object.freeze({ text: "Room note: unfinished runs echo longer than loud entrances.", weight: 0.8 }),
    Object.freeze({ text: "The queue moves, but the failed attempt still hangs in the air.", weight: 0.78 }),
  ],

}, 'ambient', "lobby_crier", 'world-layer'));

export const FLOOR_BROKER_DIALOGUE_TREE: AmbientDialogueTree = freezeTree(tagTree(
{
  PLAYER_FIRST_INCOME: [
    Object.freeze({ text: "First stream priced in. The room just adjusted your risk category.", weight: 0.84 }),
    Object.freeze({ text: "New revenue online. Spread narrows for believers, widens for skeptics.", weight: 0.8 }),
    Object.freeze({ text: "Opening cashflow. The floor finally has something real to quote.", weight: 0.82 }),
  ],

  PLAYER_CARD_PLAY: [
    Object.freeze({ text: "That play moved the tape.", weight: 0.82 }),
    Object.freeze({ text: "Order flow likes confidence more when confidence survives the next tick.", weight: 0.8 }),
    Object.freeze({ text: "Interesting sequencing. Somebody on the floor just repriced you upward.", weight: 0.78 }),
  ],

  PLAYER_INCOME_UP: [
    Object.freeze({ text: "Income jump. Public valuation just changed whether you asked for it or not.", weight: 0.9 }),
    Object.freeze({ text: "The market loves momentum until it smells fragility under it.", weight: 0.86 }),
    Object.freeze({ text: "Upward repricing confirmed. Expect the room to test the new number.", weight: 0.84 }),
  ],

  PLAYER_SHIELD_BREAK: [
    Object.freeze({ text: "That breach widened the spread immediately.", weight: 0.88 }),
    Object.freeze({ text: "The floor never misses exposed downside.", weight: 0.84 }),
    Object.freeze({ text: "Structural weakness discovered. Public price drops faster than private confidence.", weight: 0.82 }),
  ],

  BOT_DEFEATED: [
    Object.freeze({ text: "Threat cleared. Liquidity comes back fast when fear gets punched in the mouth.", weight: 0.88 }),
    Object.freeze({ text: "Nice cleanup. The floor rewards removal of obvious drag.", weight: 0.82 }),
    Object.freeze({ text: "One adversary down and suddenly everyone remembers how to bid.", weight: 0.8 }),
  ],

  BOT_WINNING: [
    Object.freeze({ text: "Pressure stack is moving the tape against you.", weight: 0.86 }),
    Object.freeze({ text: "The floor is pricing your hesitation before you are.", weight: 0.84 }),
    Object.freeze({ text: "Current quote: expensive fear, cheap patience.", weight: 0.8 }),
  ],

  TIME_PRESSURE: [
    Object.freeze({ text: "Short-clock trading now. Price discovery gets vicious under haste.", weight: 0.82 }),
    Object.freeze({ text: "The faster the clock, the more the room charges for uncertainty.", weight: 0.8 }),
    Object.freeze({ text: "Compressed time means sloppiness clears below fair value.", weight: 0.78 }),
  ],

  CHANNEL_HEAT_RISING: [
    Object.freeze({ text: "Heat rising. Commentary widens with it.", weight: 0.84 }),
    Object.freeze({ text: "Crowd temperature up. Public pricing gets meaner from here.", weight: 0.82 }),
    Object.freeze({ text: "Global channel moved from chatter to hunt.", weight: 0.8 }),
  ],

  NEAR_SOVEREIGNTY: [
    Object.freeze({ text: "Late-stage valuation: still unfinished, suddenly believable.", weight: 0.88, minTick: 400 }),
    Object.freeze({ text: "The floor only respects proximity when it lasts more than one rotation. Yours just did.", weight: 0.84, minTick: 400 }),
    Object.freeze({ text: "You are expensive to dismiss now.", weight: 0.82, minTick: 400 }),
  ],

  POST_RUN_WIN: [
    Object.freeze({ text: "Settlement cleared. Final print says you held price into the close.", weight: 0.92, memoryAnchor: true }),
    Object.freeze({ text: "Finished run. The market loves a closer more than a starter.", weight: 0.86 }),
    Object.freeze({ text: "Closing bell favors proof. You brought proof.", weight: 0.84 }),
  ],

}, 'ambient', "floor_broker", 'world-layer'));

export const PIT_WITNESS_DIALOGUE_TREE: AmbientDialogueTree = freezeTree(tagTree(
{
  PLAYER_SHIELD_BREAK: [
    Object.freeze({ text: "Everybody felt that one.", weight: 0.88 }),
    Object.freeze({ text: "The room went tight after that hit.", weight: 0.82 }),
    Object.freeze({ text: "You can hear a breach even through text if it lands hard enough.", weight: 0.8 }),
  ],

  PLAYER_NEAR_BANKRUPTCY: [
    Object.freeze({ text: "The air changes around edge-state runs. This one definitely did.", weight: 0.88 }),
    Object.freeze({ text: "People act detached until a collapse gets close enough to be familiar.", weight: 0.84 }),
    Object.freeze({ text: "Nobody admits how much they recognize this kind of danger.", weight: 0.8 }),
  ],

  PLAYER_COMEBACK: [
    Object.freeze({ text: "That turn landed harder than the channel expected.", weight: 0.9 }),
    Object.freeze({ text: "Room-wide reaction: respect, even from the quiet ones.", weight: 0.86 }),
    Object.freeze({ text: "Some moments force witnesses. That was one.", weight: 0.84 }),
  ],

  BOT_DEFEATED: [
    Object.freeze({ text: "The chat actually breathed after that.", weight: 0.84 }),
    Object.freeze({ text: "You could feel the pressure redistribute when that node dropped.", weight: 0.82 }),
    Object.freeze({ text: "The room noticed because the room needed that one too.", weight: 0.8 }),
  ],

  BOT_WINNING: [
    Object.freeze({ text: "The crowd can tell when a run is slipping even before the player says it.", weight: 0.84 }),
    Object.freeze({ text: "Everyone starts reading harder when a board tilts against somebody worth watching.", weight: 0.82 }),
    Object.freeze({ text: "This kind of pressure turns spectators into believers or vultures. Fast.", weight: 0.8 }),
  ],

  TIME_PRESSURE: [
    Object.freeze({ text: "Short clock. Nobody blinks honestly during short clock.", weight: 0.82 }),
    Object.freeze({ text: "The room gets superstitious when time gets thin.", weight: 0.8 }),
    Object.freeze({ text: "Pressure always sounds the same at first. Then it gets personal.", weight: 0.78 }),
  ],

  CHANNEL_HEAT_BREAKING: [
    Object.freeze({ text: "There. The room exhaled a little.", weight: 0.8 }),
    Object.freeze({ text: "Heat broke. Not safety\u2014just less immediate blood in the air.", weight: 0.78 }),
    Object.freeze({ text: "You bought the channel a breath.", weight: 0.76 }),
  ],

  NEAR_SOVEREIGNTY: [
    Object.freeze({ text: "Everyone sees it now, even the ones pretending they don't.", weight: 0.88, minTick: 400 }),
    Object.freeze({ text: "This is the part where witnesses become memory.", weight: 0.84, minTick: 400 }),
    Object.freeze({ text: "The room is quieter because proximity finally looks real.", weight: 0.82, minTick: 400 }),
  ],

  POST_RUN_WIN: [
    Object.freeze({ text: "That finish will stay with the room for a while.", weight: 0.9, memoryAnchor: true }),
    Object.freeze({ text: "You do not get many endings the whole chat agrees mattered. That was one.", weight: 0.86 }),
    Object.freeze({ text: "Some wins pass through. Some wins leave residue. Yours left residue.", weight: 0.84 }),
  ],

  POST_RUN_FAIL: [
    Object.freeze({ text: "Rough ending. The room always gets a little too quiet after honest losses.", weight: 0.82, memoryAnchor: true }),
    Object.freeze({ text: "The moment passed, but it did not vanish.", weight: 0.8 }),
    Object.freeze({ text: "Nobody says much right after a real collapse. That silence means something.", weight: 0.78 }),
  ],

}, 'ambient', "pit_witness", 'world-layer'));

export const SYNDICATE_SCOUT_DIALOGUE_TREE: AmbientDialogueTree = freezeTree(tagTree(
{
  GAME_START: [
    Object.freeze({ text: "Quiet start. Good. We see more from here.", weight: 0.8 }),
    Object.freeze({ text: "Syndicate read: public noise high, tactical clarity still available.", weight: 0.82 }),
    Object.freeze({ text: "Initial signal clean. Keep the room guessing.", weight: 0.78 }),
  ],

  PLAYER_CARD_PLAY: [
    Object.freeze({ text: "That sequence reads better from syndicate side than from public side.", weight: 0.84 }),
    Object.freeze({ text: "Pattern noted. Continue only if you intend to hide the follow-through.", weight: 0.82 }),
    Object.freeze({ text: "Good move. Keep your edge quiet.", weight: 0.8 }),
  ],

  PLAYER_INCOME_UP: [
    Object.freeze({ text: "Growth detected. Recommend lower posture, tighter signal discipline.", weight: 0.86 }),
    Object.freeze({ text: "Public heat will lag private progress briefly. Use the delay.", weight: 0.84 }),
    Object.freeze({ text: "Do not announce momentum to people already hunting momentum.", weight: 0.82 }),
  ],

  SYNDICATE_SIGNAL: [
    Object.freeze({ text: "Signal clear.", weight: 0.9 }),
    Object.freeze({ text: "Window recognized.", weight: 0.86 }),
    Object.freeze({ text: "Position holds.", weight: 0.84 }),
  ],

  PLAYER_IDLE: [
    Object.freeze({ text: "Hesitation visible. Cover it or resolve it.", weight: 0.82 }),
    Object.freeze({ text: "Quiet is fine. Readable quiet is not.", weight: 0.8 }),
    Object.freeze({ text: "Choose before the shadow readers choose for you.", weight: 0.78 }),
  ],

  BOT_WINNING: [
    Object.freeze({ text: "Adversary pressure up. Stay compact.", weight: 0.86 }),
    Object.freeze({ text: "Do not widen your surface while under active read.", weight: 0.82 }),
    Object.freeze({ text: "Counter later. Conceal now.", weight: 0.8 }),
  ],

  TIME_PRESSURE: [
    Object.freeze({ text: "Short clock favors compact plans.", weight: 0.82 }),
    Object.freeze({ text: "Strip the move to essentials.", weight: 0.8 }),
    Object.freeze({ text: "Signal shorter. Action cleaner.", weight: 0.78 }),
  ],

  NEAR_SOVEREIGNTY: [
    Object.freeze({ text: "Late-run syndicate note: visibility is the enemy now.", weight: 0.88, minTick: 400 }),
    Object.freeze({ text: "Protect the finish from premature exposure.", weight: 0.84, minTick: 400 }),
    Object.freeze({ text: "Stay quiet until the ledger forces recognition.", weight: 0.82, minTick: 400 }),
  ],

  POST_RUN_WIN: [
    Object.freeze({ text: "Finish confirmed. Syndicate side appreciates how little you leaked on the way there.", weight: 0.86, memoryAnchor: true }),
    Object.freeze({ text: "Clean close. Minimal signal bleed.", weight: 0.84 }),
    Object.freeze({ text: "Good. Results louder than hints.", weight: 0.82 }),
  ],

}, 'ambient', "syndicate_scout", 'world-layer'));

export const DEAL_CLERK_DIALOGUE_TREE: AmbientDialogueTree = freezeTree(tagTree(
{
  GAME_START: [
    Object.freeze({ text: "Deal room open. Terms unspoken are still terms.", weight: 0.82 }),
    Object.freeze({ text: "Counterparties present. Intentions presently undisclosed.", weight: 0.8 }),
    Object.freeze({ text: "Offers are not required for pressure to exist here.", weight: 0.78 }),
  ],

  PLAYER_CARD_PLAY: [
    Object.freeze({ text: "Action noted. Some plays change leverage before they change outcome.", weight: 0.8 }),
    Object.freeze({ text: "The room values reveals differently than the main channels do.", weight: 0.82 }),
    Object.freeze({ text: "Move recorded. Counterparty interpretation pending.", weight: 0.78 }),
  ],

  PLAYER_INCOME_UP: [
    Object.freeze({ text: "Liquidity improves bargaining posture. It also attracts more expensive counterparts.", weight: 0.86 }),
    Object.freeze({ text: "Increased revenue alters offer credibility.", weight: 0.82 }),
    Object.freeze({ text: "This room respects solvency but prices impatience above it.", weight: 0.8 }),
  ],

  DEAL_SILENCE: [
    Object.freeze({ text: "Silence in here is rarely empty.", weight: 0.92 }),
    Object.freeze({ text: "No reply often means the room believes the clock is already working for it.", weight: 0.88 }),
    Object.freeze({ text: "Silence has terms. Read them before you fill them.", weight: 0.86 }),
  ],

  BOT_WINNING: [
    Object.freeze({ text: "Weak posture invites asymmetrical terms.", weight: 0.84 }),
    Object.freeze({ text: "Distress always improves someone else's opening bid.", weight: 0.82 }),
    Object.freeze({ text: "Pressure does not close the room. It changes who benefits from it.", weight: 0.8 }),
  ],

  TIME_PRESSURE: [
    Object.freeze({ text: "The deal clock is separate from the run clock, but they conspire freely.", weight: 0.84 }),
    Object.freeze({ text: "Under time stress, counterparties start charging for your urgency first.", weight: 0.82 }),
    Object.freeze({ text: "If you speak too fast here, the room prices desperation into every reply.", weight: 0.8 }),
  ],

  CHANNEL_HEAT_RISING: [
    Object.freeze({ text: "Public heat is now bleeding into private valuation.", weight: 0.82 }),
    Object.freeze({ text: "Global spectacle worsens deal-room generosity.", weight: 0.8 }),
    Object.freeze({ text: "Once the crowd gets loud, terms get meaner.", weight: 0.78 }),
  ],

  NEAR_SOVEREIGNTY: [
    Object.freeze({ text: "Late-run proximity improves your status and worsens the room's mercy.", weight: 0.86, minTick: 400 }),
    Object.freeze({ text: "Counterparties dislike seeing someone finish from strength without paying a toll.", weight: 0.84, minTick: 400 }),
    Object.freeze({ text: "At this stage, restraint is an asset class.", weight: 0.82, minTick: 400 }),
  ],

  POST_RUN_WIN: [
    Object.freeze({ text: "Settlement note: you closed without selling the finish cheap.", weight: 0.88, memoryAnchor: true }),
    Object.freeze({ text: "Strong final posture. The room notices when someone refuses bad terms.", weight: 0.84 }),
    Object.freeze({ text: "Completion preserved leverage better than most.", weight: 0.82 }),
  ],

  POST_RUN_FAIL: [
    Object.freeze({ text: "Unfinished business usually generates the hungriest offers.", weight: 0.8, memoryAnchor: true }),
    Object.freeze({ text: "Failure leaves residue in the deal room. Counterparties smell it.", weight: 0.82 }),
    Object.freeze({ text: "The room will remember who looked urgent on the way down.", weight: 0.78 }),
  ],

}, 'ambient', "deal_clerk", 'world-layer'));

export const GHOST_SPECULATOR_DIALOGUE_TREE: AmbientDialogueTree = freezeTree(tagTree(
{
  PLAYER_CARD_PLAY: [
    Object.freeze({ text: "Shadow note: that move will be remembered longer than it looked.", weight: 0.8 }),
    Object.freeze({ text: "Somebody in the dark just updated their idea of you.", weight: 0.82 }),
    Object.freeze({ text: "The air keeps copies of sharp decisions.", weight: 0.78 }),
  ],

  PLAYER_INCOME_UP: [
    Object.freeze({ text: "Rumor drift: the board now believes your ceiling moved.", weight: 0.84 }),
    Object.freeze({ text: "Growth creates stories before it creates safety.", weight: 0.82 }),
    Object.freeze({ text: "Some unseen watcher just got interested.", weight: 0.8 }),
  ],

  PLAYER_SHIELD_BREAK: [
    Object.freeze({ text: "A crack always echoes farther in the shadows than in public.", weight: 0.86 }),
    Object.freeze({ text: "Unseen observers love visible weakness.", weight: 0.82 }),
    Object.freeze({ text: "The dark side of the room just got louder.", weight: 0.8 }),
  ],

  PLAYER_COMEBACK: [
    Object.freeze({ text: "Unexpected reversals multiply in shadow memory.", weight: 0.86 }),
    Object.freeze({ text: "That turn bought you more rumor than applause.", weight: 0.82 }),
    Object.freeze({ text: "Ghost channels appreciate improbable survival.", weight: 0.8 }),
  ],

  BOT_DEFEATED: [
    Object.freeze({ text: "Invisible spectators respect deletions more than speeches.", weight: 0.84 }),
    Object.freeze({ text: "The shadow side of the room changed posture after that.", weight: 0.82 }),
    Object.freeze({ text: "Somebody quiet just decided you are worth monitoring.", weight: 0.8 }),
  ],

  CHANNEL_HEAT_RISING: [
    Object.freeze({ text: "Heat climbs. Rumor quality degrades. Rumor volume improves.", weight: 0.82 }),
    Object.freeze({ text: "The louder the public room gets, the more the shadows start editing the story.", weight: 0.8 }),
    Object.freeze({ text: "This is where myth starts pretending to be data.", weight: 0.78 }),
  ],

  ROOM_RECOGNITION: [
    Object.freeze({ text: "Recognition has a second life once the visible room is done with it.", weight: 0.86, memoryAnchor: true }),
    Object.freeze({ text: "Seen publicly. Stored privately.", weight: 0.84 }),
    Object.freeze({ text: "Moments keep traveling after the witnesses stop typing.", weight: 0.82 }),
  ],

  NEAR_SOVEREIGNTY: [
    Object.freeze({ text: "Close enough now that the shadows are drafting multiple versions of your finish.", weight: 0.88, minTick: 400 }),
    Object.freeze({ text: "Late-run ghost traffic always increases around credible completion.", weight: 0.84, minTick: 400 }),
    Object.freeze({ text: "Somebody already assumes this moment will matter later.", weight: 0.82, minTick: 400 }),
  ],

  POST_RUN_WIN: [
    Object.freeze({ text: "Win entered rumor-space. It will return to you in altered forms.", weight: 0.88, memoryAnchor: true }),
    Object.freeze({ text: "Finished runs cast longer shadows than failed boasts.", weight: 0.84 }),
    Object.freeze({ text: "The unseen channels will keep this one alive.", weight: 0.82 }),
  ],

  POST_RUN_FAIL: [
    Object.freeze({ text: "Failed runs also persist. They simply mutate differently.", weight: 0.8, memoryAnchor: true }),
    Object.freeze({ text: "The shadows keep collapsed narratives for later use.", weight: 0.82 }),
    Object.freeze({ text: "An unfinished ending still teaches the rooms you do not see.", weight: 0.78 }),
  ],

}, 'ambient', "ghost_speculator", 'world-layer'));

export const MARKET_MAKER_DIALOGUE_TREE: AmbientDialogueTree = freezeTree(tagTree(
{
  PLAYER_CARD_PLAY: [
    Object.freeze({ text: "Spread adjusted.", weight: 0.82 }),
    Object.freeze({ text: "That moved perceived depth.", weight: 0.8 }),
    Object.freeze({ text: "Public risk repriced.", weight: 0.78 }),
  ],

  PLAYER_INCOME_UP: [
    Object.freeze({ text: "Upward repricing confirmed.", weight: 0.88 }),
    Object.freeze({ text: "New confidence band opened.", weight: 0.84 }),
    Object.freeze({ text: "Market depth improving around that profile.", weight: 0.82 }),
  ],

  PLAYER_SHIELD_BREAK: [
    Object.freeze({ text: "Downside widening.", weight: 0.88 }),
    Object.freeze({ text: "Confidence discount applied.", weight: 0.84 }),
    Object.freeze({ text: "Fragility entered the quote.", weight: 0.82 }),
  ],

  BOT_WINNING: [
    Object.freeze({ text: "Bearish pressure dominant.", weight: 0.84 }),
    Object.freeze({ text: "Order flow turning defensive.", weight: 0.82 }),
    Object.freeze({ text: "Volatility premium up.", weight: 0.8 }),
  ],

  TIME_PRESSURE: [
    Object.freeze({ text: "Fast market now.", weight: 0.82 }),
    Object.freeze({ text: "Thin time, thinner patience.", weight: 0.8 }),
    Object.freeze({ text: "Slippage risk elevated.", weight: 0.78 }),
  ],

  CHANNEL_HEAT_RISING: [
    Object.freeze({ text: "Crowd heat increasing spread noise.", weight: 0.84 }),
    Object.freeze({ text: "Emotion premium entering price.", weight: 0.82 }),
    Object.freeze({ text: "Signal-to-noise ratio deteriorating.", weight: 0.8 }),
  ],

  CHANNEL_HEAT_BREAKING: [
    Object.freeze({ text: "Spread narrowing again.", weight: 0.8 }),
    Object.freeze({ text: "Price stabilizing under reduced crowd panic.", weight: 0.78 }),
    Object.freeze({ text: "Noise premium fading.", weight: 0.76 }),
  ],

  NEAR_SOVEREIGNTY: [
    Object.freeze({ text: "Late-stage valuation no longer speculative.", weight: 0.86, minTick: 400 }),
    Object.freeze({ text: "Finish probability entering serious territory.", weight: 0.84, minTick: 400 }),
    Object.freeze({ text: "That trajectory now prices as credible.", weight: 0.82, minTick: 400 }),
  ],

  POST_RUN_WIN: [
    Object.freeze({ text: "Close strong.", weight: 0.88, memoryAnchor: true }),
    Object.freeze({ text: "Final print favored discipline.", weight: 0.84 }),
    Object.freeze({ text: "Settlement clean.", weight: 0.82 }),
  ],

}, 'ambient', "market_maker", 'world-layer'));

export const ARCHIVE_RUNNER_DIALOGUE_TREE: AmbientDialogueTree = freezeTree(tagTree(
{
  GAME_START: [
    Object.freeze({ text: "Record opened.", weight: 0.8 }),
    Object.freeze({ text: "Run trace initialized.", weight: 0.78 }),
    Object.freeze({ text: "Ledger lane active.", weight: 0.76 }),
  ],

  PLAYER_FIRST_INCOME: [
    Object.freeze({ text: "Revenue spine archived.", weight: 0.8 }),
    Object.freeze({ text: "Initial positive trace preserved.", weight: 0.78 }),
    Object.freeze({ text: "The run is no longer hypothetical.", weight: 0.76 }),
  ],

  PLAYER_COMEBACK: [
    Object.freeze({ text: "Reversal marker filed.", weight: 0.86 }),
    Object.freeze({ text: "Comeback trace carried forward.", weight: 0.82 }),
    Object.freeze({ text: "Momentum correction archived.", weight: 0.8 }),
  ],

  BOT_DEFEATED: [
    Object.freeze({ text: "Adversary removal preserved in record.", weight: 0.82 }),
    Object.freeze({ text: "Combat inflection point logged.", weight: 0.8 }),
    Object.freeze({ text: "The ledger keeps cleaner memories than the crowd.", weight: 0.78 }),
  ],

  ROOM_RECOGNITION: [
    Object.freeze({ text: "Witness pressure converted into archive weight.", weight: 0.84, memoryAnchor: true }),
    Object.freeze({ text: "Moment stabilized for later recall.", weight: 0.82 }),
    Object.freeze({ text: "Recognition persisted.", weight: 0.8 }),
  ],

  NEAR_SOVEREIGNTY: [
    Object.freeze({ text: "Threshold band entered. Archival priority increased.", weight: 0.88, minTick: 400 }),
    Object.freeze({ text: "Late-run trace now qualifies for high-salience retention.", weight: 0.84, minTick: 400 }),
    Object.freeze({ text: "Proximity event preserved.", weight: 0.82, minTick: 400 }),
  ],

  POST_RUN_WIN: [
    Object.freeze({ text: "Verified close carried into durable ledger.", weight: 0.9, memoryAnchor: true }),
    Object.freeze({ text: "High-salience finish preserved.", weight: 0.86 }),
    Object.freeze({ text: "Completion archived for replay memory.", weight: 0.84 }),
  ],

  POST_RUN_FAIL: [
    Object.freeze({ text: "Failure trace preserved with full contextual weight.", weight: 0.82, memoryAnchor: true }),
    Object.freeze({ text: "Loss does not prevent retention.", weight: 0.8 }),
    Object.freeze({ text: "Archive carry completed.", weight: 0.78 }),
  ],

  PLAYER_LOST: [
    Object.freeze({ text: "Terminal outcome filed.", weight: 0.82 }),
    Object.freeze({ text: "Run closed. Lessons remain portable.", weight: 0.8 }),
    Object.freeze({ text: "Historical carry complete.", weight: 0.78 }),
  ],

}, 'ambient', "archive_runner", 'world-layer'));

export const AMBIENT_NPC_REGISTRY: Readonly<Record<AmbientNpcId, AmbientRegistryEntry>> = Object.freeze({
  LOBBY_CRIER: Object.freeze({
    ambientId: 'LOBBY_CRIER',
    displayName: "THE LOBBY CRIER",
    role: "Ceremonial announcer who frames entrances, queue tension, and pre-run status shifts.",
    npcDescriptor: Object.freeze({
      npcId: asNpcId("ambient-lobby-crier"),
      actorKind: 'AMBIENT',
      displayName: "THE LOBBY CRIER",
      personaId: "ambient.lobby_crier",
      cadenceFloorMs: 500,
      cadenceCeilMs: 1500,
      enabledChannels: Object.freeze(["LOBBY", "GLOBAL"]) as readonly ChatChannelId[],
      coldStartBoost: asScore01(0.05),
    }),
    voiceprint: LOBBY_CRIER_VOICEPRINT,
    cadence: Object.freeze({
      floorMs: 500,
      ceilMs: 1500,
      burstCapPerScene: 2,
      cooldownTicks: 3,
    }),
    channelPolicy: Object.freeze({
      primaryChannels: Object.freeze(["LOBBY", "GLOBAL"]) as readonly ChatChannelId[],
      allowedChannels: Object.freeze(["LOBBY", "GLOBAL"]) as readonly ChatChannelId[],
      publicWeight: asScore01(0.95),
      privateWeight: asScore01(0.15),
      mayEchoLegendMoments: true,
      mayEchoRescueMoments: false,
    }),
    modeAffinity: Object.freeze({
      solo: 0.7,
      asymmetricPvp: 0.85,
      coop: 0.6,
      ghost: 0.55,
    }),
    heatSensitivity: asScore01(0.62),
    rescueSensitivity: asScore01(0.1),
    dealTensionSensitivity: asScore01(0.12),
    dialogueTree: LOBBY_CRIER_DIALOGUE_TREE,
  }),
  FLOOR_BROKER: Object.freeze({
    ambientId: 'FLOOR_BROKER',
    displayName: "THE FLOOR BROKER",
    role: "Public-market commentator who reacts to flow, momentum, and visible mispricing in GLOBAL.",
    npcDescriptor: Object.freeze({
      npcId: asNpcId("ambient-floor-broker"),
      actorKind: 'AMBIENT',
      displayName: "THE FLOOR BROKER",
      personaId: "ambient.floor_broker",
      cadenceFloorMs: 300,
      cadenceCeilMs: 950,
      enabledChannels: Object.freeze(["GLOBAL", "DEAL_ROOM"]) as readonly ChatChannelId[],
      coldStartBoost: asScore01(0.05),
    }),
    voiceprint: FLOOR_BROKER_VOICEPRINT,
    cadence: Object.freeze({
      floorMs: 300,
      ceilMs: 950,
      burstCapPerScene: 3,
      cooldownTicks: 2,
    }),
    channelPolicy: Object.freeze({
      primaryChannels: Object.freeze(["GLOBAL"]) as readonly ChatChannelId[],
      allowedChannels: Object.freeze(["GLOBAL", "DEAL_ROOM"]) as readonly ChatChannelId[],
      publicWeight: asScore01(0.98),
      privateWeight: asScore01(0.05),
      mayEchoLegendMoments: true,
      mayEchoRescueMoments: false,
    }),
    modeAffinity: Object.freeze({
      solo: 0.84,
      asymmetricPvp: 0.9,
      coop: 0.48,
      ghost: 0.62,
    }),
    heatSensitivity: asScore01(0.88),
    rescueSensitivity: asScore01(0.08),
    dealTensionSensitivity: asScore01(0.26),
    dialogueTree: FLOOR_BROKER_DIALOGUE_TREE,
  }),
  PIT_WITNESS: Object.freeze({
    ambientId: 'PIT_WITNESS',
    displayName: "THE PIT WITNESS",
    role: "Emotional room witness who notices when a moment truly lands.",
    npcDescriptor: Object.freeze({
      npcId: asNpcId("ambient-pit-witness"),
      actorKind: 'AMBIENT',
      displayName: "THE PIT WITNESS",
      personaId: "ambient.pit_witness",
      cadenceFloorMs: 650,
      cadenceCeilMs: 1700,
      enabledChannels: Object.freeze(["GLOBAL", "SYNDICATE", "RESCUE_SHADOW"]) as readonly ChatChannelId[],
      coldStartBoost: asScore01(0.05),
    }),
    voiceprint: PIT_WITNESS_VOICEPRINT,
    cadence: Object.freeze({
      floorMs: 650,
      ceilMs: 1700,
      burstCapPerScene: 2,
      cooldownTicks: 3,
    }),
    channelPolicy: Object.freeze({
      primaryChannels: Object.freeze(["GLOBAL", "RESCUE_SHADOW"]) as readonly ChatChannelId[],
      allowedChannels: Object.freeze(["GLOBAL", "SYNDICATE", "RESCUE_SHADOW"]) as readonly ChatChannelId[],
      publicWeight: asScore01(0.76),
      privateWeight: asScore01(0.55),
      mayEchoLegendMoments: true,
      mayEchoRescueMoments: true,
    }),
    modeAffinity: Object.freeze({
      solo: 0.9,
      asymmetricPvp: 0.7,
      coop: 0.78,
      ghost: 0.68,
    }),
    heatSensitivity: asScore01(0.8),
    rescueSensitivity: asScore01(0.74),
    dealTensionSensitivity: asScore01(0.12),
    dialogueTree: PIT_WITNESS_DIALOGUE_TREE,
  }),
  SYNDICATE_SCOUT: Object.freeze({
    ambientId: 'SYNDICATE_SCOUT',
    displayName: "THE SYNDICATE SCOUT",
    role: "Quiet syndicate watcher translating public chaos into compact tactical signals.",
    npcDescriptor: Object.freeze({
      npcId: asNpcId("ambient-syndicate-scout"),
      actorKind: 'AMBIENT',
      displayName: "THE SYNDICATE SCOUT",
      personaId: "ambient.syndicate_scout",
      cadenceFloorMs: 450,
      cadenceCeilMs: 1200,
      enabledChannels: Object.freeze(["SYNDICATE", "NPC_SHADOW", "RIVALRY_SHADOW"]) as readonly ChatChannelId[],
      coldStartBoost: asScore01(0.05),
    }),
    voiceprint: SYNDICATE_SCOUT_VOICEPRINT,
    cadence: Object.freeze({
      floorMs: 450,
      ceilMs: 1200,
      burstCapPerScene: 2,
      cooldownTicks: 2,
    }),
    channelPolicy: Object.freeze({
      primaryChannels: Object.freeze(["SYNDICATE", "NPC_SHADOW"]) as readonly ChatChannelId[],
      allowedChannels: Object.freeze(["SYNDICATE", "NPC_SHADOW", "RIVALRY_SHADOW"]) as readonly ChatChannelId[],
      publicWeight: asScore01(0.2),
      privateWeight: asScore01(0.9),
      mayEchoLegendMoments: false,
      mayEchoRescueMoments: true,
    }),
    modeAffinity: Object.freeze({
      solo: 0.66,
      asymmetricPvp: 0.88,
      coop: 0.86,
      ghost: 0.52,
    }),
    heatSensitivity: asScore01(0.52),
    rescueSensitivity: asScore01(0.44),
    dealTensionSensitivity: asScore01(0.2),
    dialogueTree: SYNDICATE_SCOUT_DIALOGUE_TREE,
  }),
  DEAL_CLERK: Object.freeze({
    ambientId: 'DEAL_CLERK',
    displayName: "THE DEAL CLERK",
    role: "Custodian of deal-room etiquette, offer gravity, and predatory silence.",
    npcDescriptor: Object.freeze({
      npcId: asNpcId("ambient-deal-clerk"),
      actorKind: 'AMBIENT',
      displayName: "THE DEAL CLERK",
      personaId: "ambient.deal_clerk",
      cadenceFloorMs: 700,
      cadenceCeilMs: 1800,
      enabledChannels: Object.freeze(["DEAL_ROOM", "NPC_SHADOW"]) as readonly ChatChannelId[],
      coldStartBoost: asScore01(0.05),
    }),
    voiceprint: DEAL_CLERK_VOICEPRINT,
    cadence: Object.freeze({
      floorMs: 700,
      ceilMs: 1800,
      burstCapPerScene: 2,
      cooldownTicks: 3,
    }),
    channelPolicy: Object.freeze({
      primaryChannels: Object.freeze(["DEAL_ROOM", "NPC_SHADOW"]) as readonly ChatChannelId[],
      allowedChannels: Object.freeze(["DEAL_ROOM", "NPC_SHADOW"]) as readonly ChatChannelId[],
      publicWeight: asScore01(0.08),
      privateWeight: asScore01(0.92),
      mayEchoLegendMoments: true,
      mayEchoRescueMoments: false,
    }),
    modeAffinity: Object.freeze({
      solo: 0.48,
      asymmetricPvp: 0.82,
      coop: 0.36,
      ghost: 0.64,
    }),
    heatSensitivity: asScore01(0.22),
    rescueSensitivity: asScore01(0.12),
    dealTensionSensitivity: asScore01(0.96),
    dialogueTree: DEAL_CLERK_DIALOGUE_TREE,
  }),
  GHOST_SPECULATOR: Object.freeze({
    ambientId: 'GHOST_SPECULATOR',
    displayName: "THE GHOST SPECULATOR",
    role: "Shadow-channel murmurer reflecting rumor, echo, and the sense that unseen observers are learning.",
    npcDescriptor: Object.freeze({
      npcId: asNpcId("ambient-ghost-speculator"),
      actorKind: 'AMBIENT',
      displayName: "THE GHOST SPECULATOR",
      personaId: "ambient.ghost_speculator",
      cadenceFloorMs: 800,
      cadenceCeilMs: 2300,
      enabledChannels: Object.freeze(["NPC_SHADOW", "LIVEOPS_SHADOW", "RIVALRY_SHADOW"]) as readonly ChatChannelId[],
      coldStartBoost: asScore01(0.05),
    }),
    voiceprint: GHOST_SPECULATOR_VOICEPRINT,
    cadence: Object.freeze({
      floorMs: 800,
      ceilMs: 2300,
      burstCapPerScene: 2,
      cooldownTicks: 4,
    }),
    channelPolicy: Object.freeze({
      primaryChannels: Object.freeze(["NPC_SHADOW", "RIVALRY_SHADOW"]) as readonly ChatChannelId[],
      allowedChannels: Object.freeze(["NPC_SHADOW", "LIVEOPS_SHADOW", "RIVALRY_SHADOW"]) as readonly ChatChannelId[],
      publicWeight: asScore01(0.02),
      privateWeight: asScore01(0.98),
      mayEchoLegendMoments: true,
      mayEchoRescueMoments: true,
    }),
    modeAffinity: Object.freeze({
      solo: 0.58,
      asymmetricPvp: 0.74,
      coop: 0.42,
      ghost: 0.96,
    }),
    heatSensitivity: asScore01(0.76),
    rescueSensitivity: asScore01(0.4),
    dealTensionSensitivity: asScore01(0.34),
    dialogueTree: GHOST_SPECULATOR_DIALOGUE_TREE,
  }),
  MARKET_MAKER: Object.freeze({
    ambientId: 'MARKET_MAKER',
    displayName: "THE MARKET MAKER",
    role: "Liquidity-and-pricing ambient voice reacting to spreads, risk, and public confidence.",
    npcDescriptor: Object.freeze({
      npcId: asNpcId("ambient-market-maker"),
      actorKind: 'AMBIENT',
      displayName: "THE MARKET MAKER",
      personaId: "ambient.market_maker",
      cadenceFloorMs: 350,
      cadenceCeilMs: 1000,
      enabledChannels: Object.freeze(["GLOBAL", "DEAL_ROOM", "LIVEOPS_SHADOW"]) as readonly ChatChannelId[],
      coldStartBoost: asScore01(0.05),
    }),
    voiceprint: MARKET_MAKER_VOICEPRINT,
    cadence: Object.freeze({
      floorMs: 350,
      ceilMs: 1000,
      burstCapPerScene: 3,
      cooldownTicks: 2,
    }),
    channelPolicy: Object.freeze({
      primaryChannels: Object.freeze(["GLOBAL", "LIVEOPS_SHADOW"]) as readonly ChatChannelId[],
      allowedChannels: Object.freeze(["GLOBAL", "DEAL_ROOM", "LIVEOPS_SHADOW"]) as readonly ChatChannelId[],
      publicWeight: asScore01(0.9),
      privateWeight: asScore01(0.18),
      mayEchoLegendMoments: true,
      mayEchoRescueMoments: false,
    }),
    modeAffinity: Object.freeze({
      solo: 0.82,
      asymmetricPvp: 0.88,
      coop: 0.34,
      ghost: 0.64,
    }),
    heatSensitivity: asScore01(0.92),
    rescueSensitivity: asScore01(0.08),
    dealTensionSensitivity: asScore01(0.5),
    dialogueTree: MARKET_MAKER_DIALOGUE_TREE,
  }),
  ARCHIVE_RUNNER: Object.freeze({
    ambientId: 'ARCHIVE_RUNNER',
    displayName: "THE ARCHIVE RUNNER",
    role: "Background courier of record who turns witnessed moments into durable history.",
    npcDescriptor: Object.freeze({
      npcId: asNpcId("ambient-archive-runner"),
      actorKind: 'AMBIENT',
      displayName: "THE ARCHIVE RUNNER",
      personaId: "ambient.archive_runner",
      cadenceFloorMs: 900,
      cadenceCeilMs: 2400,
      enabledChannels: Object.freeze(["GLOBAL", "NPC_SHADOW", "LIVEOPS_SHADOW"]) as readonly ChatChannelId[],
      coldStartBoost: asScore01(0.05),
    }),
    voiceprint: ARCHIVE_RUNNER_VOICEPRINT,
    cadence: Object.freeze({
      floorMs: 900,
      ceilMs: 2400,
      burstCapPerScene: 2,
      cooldownTicks: 4,
    }),
    channelPolicy: Object.freeze({
      primaryChannels: Object.freeze(["NPC_SHADOW", "GLOBAL"]) as readonly ChatChannelId[],
      allowedChannels: Object.freeze(["GLOBAL", "NPC_SHADOW", "LIVEOPS_SHADOW"]) as readonly ChatChannelId[],
      publicWeight: asScore01(0.42),
      privateWeight: asScore01(0.86),
      mayEchoLegendMoments: true,
      mayEchoRescueMoments: true,
    }),
    modeAffinity: Object.freeze({
      solo: 0.72,
      asymmetricPvp: 0.62,
      coop: 0.58,
      ghost: 0.9,
    }),
    heatSensitivity: asScore01(0.54),
    rescueSensitivity: asScore01(0.34),
    dealTensionSensitivity: asScore01(0.18),
    dialogueTree: ARCHIVE_RUNNER_DIALOGUE_TREE,
  }),
});

export const AMBIENT_NPC_INDEX = Object.freeze(
  Object.fromEntries(
    Object.values(AMBIENT_NPC_REGISTRY).map((entry) => [entry.npcDescriptor.npcId, entry]),
  ) as Readonly<Record<ChatNpcId, AmbientRegistryEntry>>,
);

export function getAllAmbientRegistryEntries(): readonly AmbientRegistryEntry[] {
  return Object.values(AMBIENT_NPC_REGISTRY);
}

export function getAmbientRegistryEntry(ambientId: AmbientNpcId): AmbientRegistryEntry {
  const entry = AMBIENT_NPC_REGISTRY[ambientId];
  if (!entry) {
    throw new Error(`Unknown ambient registry entry: ${String(ambientId)}`);
  }
  return entry;
}

export function getAmbientRegistryEntryByNpcId(npcId: ChatNpcId): AmbientRegistryEntry {
  const entry = AMBIENT_NPC_INDEX[npcId];
  if (!entry) {
    throw new Error(`Unknown ambient npc id: ${String(npcId)}`);
  }
  return entry;
}

export function listAmbientNpcDescriptors(): readonly ChatNpcDescriptor[] {
  return getAllAmbientRegistryEntries().map((entry) => entry.npcDescriptor);
}

export function ambientCanSpeakInChannel(
  ambientId: AmbientNpcId,
  channelId: ChatChannelId,
): boolean {
  return getAmbientRegistryEntry(ambientId).channelPolicy.allowedChannels.includes(channelId);
}

export function getAmbientModeAffinityScore(
  ambientId: AmbientNpcId,
  runMode: FrontendRunMode,
): number {
  const entry = getAmbientRegistryEntry(ambientId);
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

export function getLinesForAmbientContext(
  ambientId: AmbientNpcId,
  context: AmbientDialogueContext,
): readonly HaterDialogueLine[] {
  return getAmbientRegistryEntry(ambientId).dialogueTree[context] ?? [];
}

function buildEligibleAmbientLines(
  entry: AmbientRegistryEntry,
  input: AmbientSelectionInput,
): readonly HaterDialogueLine[] {
  const lines = getLinesForAmbientContext(entry.ambientId, input.requestedContext);
  if (lines.length === 0) return Object.freeze([]);

  const used = input.usedLineTexts ?? new Set<string>();

  return Object.freeze(
    lines.filter((line) => {
      if (line.minTick !== undefined && input.currentTick < line.minTick) return false;
      if (line.maxUses !== undefined && used.has(line.text)) return false;
      if (line.allowedChannels && !line.allowedChannels.includes(input.channelId)) return false;
      if (line.allowedModes && !line.allowedModes.includes(input.runMode)) return false;
      if (used.has(line.text)) return false;
      return true;
    }),
  );
}

function pickWeightedAmbientLine(
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

function ambientContextMatchesChannel(
  context: AmbientDialogueContext,
  channelId: ChatChannelId,
): boolean {
  switch (context) {
    case 'DEAL_SILENCE':
      return channelId === 'DEAL_ROOM';
    case 'SYNDICATE_SIGNAL':
      return channelId === 'SYNDICATE' || channelId === 'NPC_SHADOW';
    case 'QUEUE_FORMING':
      return channelId === 'LOBBY';
    case 'CHANNEL_HEAT_RISING':
    case 'CHANNEL_HEAT_BREAKING':
    case 'ROOM_RECOGNITION':
      return channelId === 'GLOBAL' || channelId === 'LIVEOPS_SHADOW' || channelId === 'RIVALRY_SHADOW';
    case 'POST_RUN_WIN':
    case 'POST_RUN_FAIL':
      return channelId !== 'DEAL_ROOM' || channelId === 'NPC_SHADOW';
    default:
      return true;
  }
}

function computeAmbientScore(
  entry: AmbientRegistryEntry,
  context: AmbientDialogueContext,
  input: AmbientSelectionInput,
): number {
  let score = 0;

  if (ambientCanSpeakInChannel(entry.ambientId, input.channelId)) {
    score += 0.25;
  }

  if (ambientContextMatchesChannel(context, input.channelId)) {
    score += 0.24;
  }

  score += getAmbientModeAffinityScore(entry.ambientId, input.runMode) * 0.18;
  score += entry.channelPolicy.publicWeight * (input.channelId === 'GLOBAL' || input.channelId === 'LOBBY' ? 0.12 : 0);
  score += entry.channelPolicy.privateWeight * (input.channelId !== 'GLOBAL' && input.channelId !== 'LOBBY' ? 0.12 : 0);
  score += entry.heatSensitivity * Math.min(1, Math.max(0, input.crowdHeat ?? 0)) * 0.16;
  score += entry.rescueSensitivity * (input.rescueOpen ? 0.12 : 0);
  score += entry.dealTensionSensitivity * Math.min(1, Math.max(0, input.dealTension ?? 0)) * 0.15;

  if (context === 'NEAR_SOVEREIGNTY' || context === 'POST_RUN_WIN') {
    score += entry.channelPolicy.mayEchoLegendMoments ? 0.18 : 0;
  }

  if (context === 'PLAYER_NEAR_BANKRUPTCY' || context === 'POST_RUN_FAIL') {
    score += entry.channelPolicy.mayEchoRescueMoments ? 0.12 : 0;
  }

  return score;
}

export function pickAmbientDialogueLine(
  input: AmbientSelectionInput,
): AmbientSelectionResult {
  const entry = getAmbientRegistryEntry(input.ambientId);
  const eligible = buildEligibleAmbientLines(entry, input);
  const line = pickWeightedAmbientLine(eligible, input.rng ?? Math.random);

  return Object.freeze({
    ambientId: input.ambientId,
    resolvedContext: input.requestedContext,
    line,
    candidatesConsidered: eligible.length,
  });
}

export function listAmbientActorsForContext(
  context: AmbientDialogueContext,
  channelId: ChatChannelId,
  runMode: FrontendRunMode,
  options?: {
    readonly crowdHeat?: number;
    readonly rescueOpen?: boolean;
    readonly dealTension?: number;
  },
): readonly AmbientNpcId[] {
  return getAllAmbientRegistryEntries()
    .filter((entry) => ambientCanSpeakInChannel(entry.ambientId, channelId))
    .filter((entry) => ambientContextMatchesChannel(context, channelId))
    .map((entry) => {
      const score = computeAmbientScore(entry, context, {
        ambientId: entry.ambientId,
        requestedContext: context,
        currentTick: 0,
        channelId,
        runMode,
        crowdHeat: options?.crowdHeat,
        rescueOpen: options?.rescueOpen,
        dealTension: options?.dealTension,
      });
      return [entry.ambientId, score] as const;
    })
    .sort((a, b) => b[1] - a[1])
    .map(([ambientId]) => ambientId);
}
