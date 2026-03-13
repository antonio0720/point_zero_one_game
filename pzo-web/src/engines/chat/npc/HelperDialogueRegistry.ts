
// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/chat/npc/HelperDialogueRegistry.ts

/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT HELPER DIALOGUE REGISTRY
 * FILE: pzo-web/src/engines/chat/npc/HelperDialogueRegistry.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical helper registry for the new frontend chat engine lane.
 *
 * This file absorbs the frozen donor helper metadata from
 * frontend/apps/web/components/chat/HelperCharacters.ts and the mentor helper
 * tree that previously lived inside HaterDialogueTrees.ts, then upgrades the
 * helper lane into a first-class registry with:
 *
 * - stable helper descriptors for ChatNpcDirector and future HelperResponsePlanner,
 * - persona voiceprints and cadence envelopes aligned with the hater registry,
 * - run-mode and channel policy instead of ad-hoc helper popping,
 * - cold-start support weighting that preserves the current kernel doctrine,
 * - weighted, context-aware line selection with usage guards and proactive logic,
 * - helper-specific intervention bias for rescue, stabilization, coaching, lore,
 *   and post-run recovery.
 *
 * Design laws
 * -----------
 * - Preserve the canonical five helpers already present in the donor lane:
 *   THE MENTOR, THE INSIDER, THE SURVIVOR, THE RIVAL, and THE ARCHIVIST.
 * - Use the same context vocabulary as the hater registry so event bridges and
 *   directors do not need context translation glue.
 * - Keep helpers supportive without making them soft; they exist to stabilize,
 *   sharpen, warn, and occasionally pressure the player back into action.
 * - Stay frontend-safe today while leaving obvious parity seams for the future
 *   backend helper authority lane.
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

export type HelperCharacterId =
  | 'MENTOR'
  | 'INSIDER'
  | 'SURVIVOR'
  | 'RIVAL'
  | 'ARCHIVIST';

export interface HelperPersonalityProfile {
  readonly warmth: Score01;
  readonly directness: Score01;
  readonly frequency: Score01;
  readonly coldStartBoost: number;
}

export interface HelperInterventionProfile {
  readonly rescueBias: Score01;
  readonly coachingBias: Score01;
  readonly moraleBias: Score01;
  readonly intelBias: Score01;
  readonly loreBias: Score01;
  readonly rivalryBias: Score01;
  readonly postLossBias: Score01;
}

export interface HelperChannelPresencePolicy {
  readonly primaryChannels: readonly ChatChannelId[];
  readonly allowedChannels: readonly ChatChannelId[];
  readonly mayInterruptPublicSwarm: boolean;
  readonly mayWhisperPrivately: boolean;
  readonly mayEnterLobby: boolean;
  readonly mayProjectIntoShadow: boolean;
}

export interface HelperModeAffinityPolicy {
  readonly solo: number;
  readonly asymmetricPvp: number;
  readonly coop: number;
  readonly ghost: number;
}

export type HelperDialogueTree = Partial<
  Record<HaterDialogueContext, readonly HaterDialogueLine[]>
>;

export interface HelperRegistryEntry {
  readonly helperId: HelperCharacterId;
  readonly displayName: string;
  readonly archLabel: string;
  readonly emoji: string;
  readonly role: string;
  readonly npcDescriptor: ChatNpcDescriptor;
  readonly personality: HelperPersonalityProfile;
  readonly intervention: HelperInterventionProfile;
  readonly voiceprint: ChatPersonaVoiceprint;
  readonly idleTriggerTicks: number;
  readonly triggerConditions: readonly HaterDialogueContext[];
  readonly channelPolicy: HelperChannelPresencePolicy;
  readonly modeAffinity: HelperModeAffinityPolicy;
  readonly dialogueTree: HelperDialogueTree;
}

export interface HelperDialogueSelectionInput {
  readonly helperId: HelperCharacterId;
  readonly requestedContext: HaterDialogueContext;
  readonly currentTick: number;
  readonly currentRunCount: number;
  readonly channelId: ChatChannelId;
  readonly runMode: FrontendRunMode;
  readonly usedLineTexts?: ReadonlySet<string>;
  readonly playerSilenceTicks?: number;
  readonly playerTiltScore?: number;
  readonly playerConfidenceScore?: number;
  readonly rng?: () => number;
}

export interface HelperDialogueSelectionResult {
  readonly helperId: HelperCharacterId;
  readonly resolvedContext: HaterDialogueContext;
  readonly line: HaterDialogueLine | null;
  readonly candidatesConsidered: number;
  readonly coldStartApplied: boolean;
}

const ALL_HELPER_CHANNELS = Object.freeze([
  'GLOBAL',
  'LOBBY',
  'SYNDICATE',
  'DEAL_ROOM',
  'NPC_SHADOW',
  'RESCUE_SHADOW',
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
  tree: HelperDialogueTree,
  ...tags: string[]
): HelperDialogueTree => {
  const out: Partial<Record<HaterDialogueContext, readonly HaterDialogueLine[]>> = {};
  for (const context of HELPER_CONTEXT_ORDER) {
    out[context] = withTags(tree[context] ?? [], ...tags);
  }
  return Object.freeze(out) as HelperDialogueTree;
};

const freezeTree = (tree: HelperDialogueTree): HelperDialogueTree => {
  const out: Partial<Record<HaterDialogueContext, readonly HaterDialogueLine[]>> = {};
  for (const context of HELPER_CONTEXT_ORDER) {
    out[context] = Object.freeze((tree[context] ?? []).map((line) => Object.freeze({ ...line })));
  }
  return Object.freeze(out) as HelperDialogueTree;
};

export const HELPER_CONTEXT_ORDER = Object.freeze([
  'LOBBY_TAUNT',
  'GAME_START',
  'PLAYER_FIRST_INCOME',
  'PLAYER_CARD_PLAY',
  'PLAYER_INCOME_UP',
  'PLAYER_SHIELD_BREAK',
  'PLAYER_NEAR_BANKRUPTCY',
  'PLAYER_IDLE',
  'PLAYER_COMEBACK',
  'PLAYER_RESPONSE_ANGRY',
  'PLAYER_RESPONSE_TROLL',
  'PLAYER_RESPONSE_FLEX',
  'BOT_DEFEATED',
  'BOT_WINNING',
  'TIME_PRESSURE',
  'CASCADE_CHAIN',
  'NEAR_SOVEREIGNTY',
  'PLAYER_LOST',
] as const satisfies readonly HaterDialogueContext[]);

export const MENTOR_VOICEPRINT: ChatPersonaVoiceprint = Object.freeze({
  personaId: 'helper.mentor',
  punctuationStyle: 'SPARSE',
  averageSentenceLength: 'MEDIUM',
  emotionalTemperature: 'CONTROLLED',
  delayProfileMs: [700, 1800],
  interruptionStyle: 'PATIENT',
  signatureOpeners: ['Focus.', 'Good.', 'Stay with the run.'],
  signatureClosers: ['Protect it.', 'Hold the line.', 'Finish strong.'],
  lexiconTags: ['discipline', 'fundamentals', 'stack', 'shield', 'finish'],
  prefersLowercase: false,
  prefersSparseEmoji: true,
});

export const INSIDER_VOICEPRINT: ChatPersonaVoiceprint = Object.freeze({
  personaId: 'helper.insider',
  punctuationStyle: 'SHARP',
  averageSentenceLength: 'MEDIUM',
  emotionalTemperature: 'COOL',
  delayProfileMs: [350, 1150],
  interruptionStyle: 'AMBUSH',
  signatureOpeners: ['Heads up.', 'Window.', 'Quiet tip.'],
  signatureClosers: ['Use it.', 'That matters.', 'Mark that pattern.'],
  lexiconTags: ['synergy', 'window', 'pattern', 'trigger', 'multiplier'],
  prefersLowercase: false,
  prefersSparseEmoji: true,
});

export const SURVIVOR_VOICEPRINT: ChatPersonaVoiceprint = Object.freeze({
  personaId: 'helper.survivor',
  punctuationStyle: 'WARM',
  averageSentenceLength: 'LONG',
  emotionalTemperature: 'WARM',
  delayProfileMs: [800, 2000],
  interruptionStyle: 'PATIENT',
  signatureOpeners: ['Listen.', 'I know this feeling.', 'Breathe.'],
  signatureClosers: ['Stay in it.', 'You are not done.', 'One more decision.'],
  lexiconTags: ['survive', 'breathe', 'recover', 'endure', 'claw back'],
  prefersLowercase: false,
  prefersSparseEmoji: true,
});

export const RIVAL_VOICEPRINT: ChatPersonaVoiceprint = Object.freeze({
  personaId: 'helper.rival',
  punctuationStyle: 'SHARP',
  averageSentenceLength: 'MEDIUM',
  emotionalTemperature: 'HOT',
  delayProfileMs: [300, 1000],
  interruptionStyle: 'CUTTING',
  signatureOpeners: ['There you go.', 'Finally.', 'Now we are talking.'],
  signatureClosers: ['Keep up.', 'Do it cleaner.', 'Prove it.'],
  lexiconTags: ['pace', 'push', 'clean', 'respect', 'keep up'],
  prefersLowercase: false,
  prefersSparseEmoji: true,
});

export const ARCHIVIST_VOICEPRINT: ChatPersonaVoiceprint = Object.freeze({
  personaId: 'helper.archivist',
  punctuationStyle: 'FORMAL',
  averageSentenceLength: 'LONG',
  emotionalTemperature: 'CONTROLLED',
  delayProfileMs: [950, 2400],
  interruptionStyle: 'PATIENT',
  signatureOpeners: ['Archive note.', 'Historical pattern.', 'Recorded.'],
  signatureClosers: ['For the ledger.', 'It is logged.', 'Data remembers.'],
  lexiconTags: ['archive', 'statistical', 'history', 'ledger', 'pattern'],
  prefersLowercase: false,
  prefersSparseEmoji: true,
});
export const MENTOR_DIALOGUE_TREE: HelperDialogueTree = freezeTree(tagTree(
{
  LOBBY_TAUNT: [
    Object.freeze({ text: "Ignore the room. Fundamentals travel farther than noise.", weight: 0.92 }),
    Object.freeze({ text: "Every sovereign run starts before the first card. It starts with what you refuse to panic about.", weight: 0.84 }),
    Object.freeze({ text: "Walk in steady. The loudest voices here rarely survive their own advice.", weight: 0.78 }),
  ],

  GAME_START: [
    Object.freeze({ text: "Priority one: income above expenses. Priority two: defend what you build.", weight: 0.95 }),
    Object.freeze({ text: "Do not spend the opening proving you are fearless. Spend it building staying power.", weight: 0.88 }),
    Object.freeze({ text: "The bots will chase emotion. Give them math instead.", weight: 0.82 }),
    Object.freeze({ text: "You do not need a flashy opening. You need an opening that still looks smart at tick four hundred.", weight: 0.76 }),
  ],

  PLAYER_FIRST_INCOME: [
    Object.freeze({ text: "Good. First income is not victory; it is permission to compound.", weight: 0.92 }),
    Object.freeze({ text: "Now protect that stream before you broaden it.", weight: 0.88 }),
    Object.freeze({ text: "The first stable dollar is always worth more than the loudest future promise.", weight: 0.8 }),
  ],

  PLAYER_CARD_PLAY: [
    Object.freeze({ text: "That play is viable if you already know the next defensive answer.", weight: 0.82 }),
    Object.freeze({ text: "Sequence matters more than bravado. Think one card past the card in your hand.", weight: 0.86 }),
    Object.freeze({ text: "A strong play is one that improves both survival and tempo. Chase both.", weight: 0.78 }),
  ],

  PLAYER_INCOME_UP: [
    Object.freeze({ text: "Good move. Growth without shielding becomes bait.", weight: 0.93 }),
    Object.freeze({ text: "Do not celebrate in public. Fortify in private.", weight: 0.86 }),
    Object.freeze({ text: "You just crossed into visibility. Expect the room to tighten around you.", weight: 0.8 }),
    Object.freeze({ text: "Income is leverage only if the next hit fails to break you.", weight: 0.78 }),
  ],

  PLAYER_SHIELD_BREAK: [
    Object.freeze({ text: "Breach registered. Slow down, rebuild, then counter.", weight: 0.94 }),
    Object.freeze({ text: "Every cracked layer is a lesson invoice. Pay attention before you pay twice.", weight: 0.86 }),
    Object.freeze({ text: "Defense wins long games because long games punish panic.", weight: 0.82 }),
    Object.freeze({ text: "You are allowed to absorb a hit. You are not allowed to stop thinking.", weight: 0.8 }),
  ],

  PLAYER_NEAR_BANKRUPTCY: [
    Object.freeze({ text: "You are not done. Strip waste, stabilize cashflow, and fight for every remaining tick.", weight: 0.97, memoryAnchor: true }),
    Object.freeze({ text: "Most players quit here. Sovereign players reorganize here.", weight: 0.92 }),
    Object.freeze({ text: "Reduce exposure before you chase heroics.", weight: 0.86 }),
    Object.freeze({ text: "A narrow recovery plan executed now beats a beautiful comeback fantasy executed too late.", weight: 0.84 }),
  ],

  PLAYER_IDLE: [
    Object.freeze({ text: "If you are stuck, audit the largest expense and the weakest shield. Start there.", weight: 0.95 }),
    Object.freeze({ text: "Thinking is useful. Hesitation is taxable.", weight: 0.84 }),
    Object.freeze({ text: "Choose the line that keeps options open two ticks from now.", weight: 0.82 }),
    Object.freeze({ text: "Make the next correct decision. Not the perfect one.", weight: 0.88 }),
  ],

  PLAYER_COMEBACK: [
    Object.freeze({ text: "There it is. Momentum recovered. Use the window before the room closes it.", weight: 0.94, memoryAnchor: true }),
    Object.freeze({ text: "Comebacks are fragile because players mistake relief for safety.", weight: 0.86 }),
    Object.freeze({ text: "Now that the curve turned, do not hand it back for applause.", weight: 0.82 }),
  ],

  PLAYER_RESPONSE_ANGRY: [
    Object.freeze({ text: "Anger is energy. Convert it into sequence discipline before it converts you into a target.", weight: 0.88, callbackEligible: true }),
    Object.freeze({ text: "You can be furious after the run. During the run, be precise.", weight: 0.84, callbackEligible: true }),
    Object.freeze({ text: "The system does not care how offended you are. It does care how cleanly you answer.", weight: 0.82, callbackEligible: true }),
  ],

  PLAYER_RESPONSE_FLEX: [
    Object.freeze({ text: "Save the flex for the verified ledger.", weight: 0.86, callbackEligible: true }),
    Object.freeze({ text: "Public celebration before structural safety is usually an invitation.", weight: 0.8, callbackEligible: true }),
    Object.freeze({ text: "Let the proof speak before you do.", weight: 0.84, callbackEligible: true }),
  ],

  BOT_DEFEATED: [
    Object.freeze({ text: "Good. One pressure source down. Rebalance before the room invents another.", weight: 0.9, memoryAnchor: true }),
    Object.freeze({ text: "Neutralization is not a cue to drift. It is a cue to consolidate.", weight: 0.86 }),
    Object.freeze({ text: "Take the space you earned and turn it into durable advantage.", weight: 0.84 }),
  ],

  BOT_WINNING: [
    Object.freeze({ text: "When the adversary has initiative, shorten your decisions and harden your priorities.", weight: 0.9 }),
    Object.freeze({ text: "You do not need to win the whole run this tick. You need to stop the bleeding this tick.", weight: 0.92 }),
    Object.freeze({ text: "Stability first. Revenge later.", weight: 0.88 }),
  ],

  TIME_PRESSURE: [
    Object.freeze({ text: "The clock is loudest when your hierarchy is weak. Restore hierarchy.", weight: 0.86 }),
    Object.freeze({ text: "Compress the plan: survive, fortify, compound, finish.", weight: 0.88 }),
    Object.freeze({ text: "Urgency should narrow your choices, not scatter them.", weight: 0.84 }),
  ],

  CASCADE_CHAIN: [
    Object.freeze({ text: "Break the cascade at the earliest controllable node, not the loudest one.", weight: 0.9 }),
    Object.freeze({ text: "Secondary effects become primary threats when you admire them instead of severing them.", weight: 0.84 }),
    Object.freeze({ text: "Interrupt the sequence, then rebuild tempo.", weight: 0.82 }),
  ],

  NEAR_SOVEREIGNTY: [
    Object.freeze({ text: "You are close enough now that discipline matters more than inspiration.", weight: 0.96, minTick: 400 }),
    Object.freeze({ text: "Legends lose here when they relax one tick early.", weight: 0.9, minTick: 400 }),
    Object.freeze({ text: "Finish the run you built. Do not improvise because the summit is visible.", weight: 0.88, minTick: 400 }),
    Object.freeze({ text: "The final stretch is not for dreaming. It is for execution.", weight: 0.86, minTick: 400 }),
  ],

  PLAYER_LOST: [
    Object.freeze({ text: "Loss logged. The pain fades. The pattern stays.", weight: 0.92, memoryAnchor: true }),
    Object.freeze({ text: "Come back with cleaner priorities, not a wounded ego.", weight: 0.86 }),
    Object.freeze({ text: "Every sovereign player has a graveyard of unfinished runs. Build from this one.", weight: 0.84 }),
  ],

},
  'helper', "mentor", 'support', "strategic-advisor",
));

export const INSIDER_DIALOGUE_TREE: HelperDialogueTree = freezeTree(tagTree(
{
  LOBBY_TAUNT: [
    Object.freeze({ text: "Quiet brief: the room overestimates swagger and underprices sequencing.", weight: 0.82 }),
    Object.freeze({ text: "Opening rumor: half the lobby still thinks growth is safer than shielding. Let them.", weight: 0.78 }),
    Object.freeze({ text: "Watch who types first. They usually leak their weakness before the run starts.", weight: 0.74 }),
  ],

  GAME_START: [
    Object.freeze({ text: "Opening insight: the first fifty ticks still shape the most stable compound outcomes.", weight: 0.92 }),
    Object.freeze({ text: "Track who is optimizing for optics. The bots punish visible greed faster than quiet discipline.", weight: 0.84 }),
    Object.freeze({ text: "Early card order matters more than raw card strength when the room is still calibrating.", weight: 0.82 }),
  ],

  PLAYER_FIRST_INCOME: [
    Object.freeze({ text: "First stream online. That shifts threat modeling immediately.", weight: 0.88 }),
    Object.freeze({ text: "Expect a pattern response now that the board can identify a revenue spine.", weight: 0.82 }),
    Object.freeze({ text: "Protect the first stream long enough for the second to matter.", weight: 0.8 }),
  ],

  PLAYER_CARD_PLAY: [
    Object.freeze({ text: "That card pairs better with recovery tempo than with expansion tempo. Remember that.", weight: 0.92 }),
    Object.freeze({ text: "Small note: repeating that family of plays is exactly how THE MANIPULATOR builds confidence.", weight: 0.9 }),
    Object.freeze({ text: "The value of that card jumps if you preserve shield integrity through the next rotation.", weight: 0.84 }),
    Object.freeze({ text: "Correct lane, but only if you do not expose liquidity on the follow-through.", weight: 0.82 }),
  ],

  PLAYER_INCOME_UP: [
    Object.freeze({ text: "New bracket crossed. Macro pressure usually re-prices after milestones, not before them.", weight: 0.84 }),
    Object.freeze({ text: "Income spike observed. Public heat trails private growth by a tick or two.", weight: 0.8 }),
    Object.freeze({ text: "You are now rich enough to be worth noticing and not yet rich enough to ignore it.", weight: 0.78 }),
  ],

  PLAYER_SHIELD_BREAK: [
    Object.freeze({ text: "A single layer breach is manageable. Cross-layer cascade is the real killer.", weight: 0.94 }),
    Object.freeze({ text: "Rebuild order matters: close propagation risk before cosmetic repair.", weight: 0.88 }),
    Object.freeze({ text: "Expect follow-up from anyone reading breach timing correctly.", weight: 0.84 }),
    Object.freeze({ text: "Post-breach, the room tends to overreact. Use that overreaction if you stay liquid.", weight: 0.78 }),
  ],

  PLAYER_NEAR_BANKRUPTCY: [
    Object.freeze({ text: "Emergency math: one avoided expense often outperforms two uncertain income hopes.", weight: 0.9, memoryAnchor: true }),
    Object.freeze({ text: "In edge states, liquidity beats elegance every time.", weight: 0.86 }),
    Object.freeze({ text: "You are in optimization-by-survival now. Different game, same ledger.", weight: 0.82 }),
  ],

  PLAYER_IDLE: [
    Object.freeze({ text: "While you pause, the pattern model is still updating.", weight: 0.82 }),
    Object.freeze({ text: "If you are thinking, think in pairings: this play plus what cover?", weight: 0.84 }),
    Object.freeze({ text: "The safest decision often hides in the least glamorous card.", weight: 0.76 }),
  ],

  PLAYER_COMEBACK: [
    Object.freeze({ text: "Comeback window. Pattern readers just lost confidence in their prior forecast.", weight: 0.9, memoryAnchor: true }),
    Object.freeze({ text: "This is the best time to make one clean structural play, not three emotional ones.", weight: 0.86 }),
    Object.freeze({ text: "Recovered tempo creates false safety for the room before it creates true safety for you.", weight: 0.82 }),
  ],

  PLAYER_RESPONSE_ANGRY: [
    Object.freeze({ text: "Rage typing leaks state. State leakage gets priced against you.", weight: 0.84, callbackEligible: true }),
    Object.freeze({ text: "The room loves emotional telemetry. Do not donate yours.", weight: 0.86, callbackEligible: true }),
    Object.freeze({ text: "Keep the anger off the wire and in the decision engine.", weight: 0.8, callbackEligible: true }),
  ],

  PLAYER_RESPONSE_FLEX: [
    Object.freeze({ text: "Flex less. Record more.", weight: 0.84, callbackEligible: true }),
    Object.freeze({ text: "Public overconfidence increases targeting quality.", weight: 0.82, callbackEligible: true }),
    Object.freeze({ text: "If you must brag, do it after your shields can afford witnesses.", weight: 0.8, callbackEligible: true }),
  ],

  BOT_DEFEATED: [
    Object.freeze({ text: "Removal confirmed. Expect adjacency behavior from the remaining threat stack.", weight: 0.86, memoryAnchor: true }),
    Object.freeze({ text: "One bot down does not clear the pattern memory it already built on you.", weight: 0.82 }),
    Object.freeze({ text: "Use the lull for structure, not theater.", weight: 0.84 }),
  ],

  TIME_PRESSURE: [
    Object.freeze({ text: "Under time compression, interaction effects matter more than isolated card value.", weight: 0.84 }),
    Object.freeze({ text: "Short clocks reward prepared heuristics. Use one.", weight: 0.8 }),
    Object.freeze({ text: "Pick the move whose downside you already understand.", weight: 0.78 }),
  ],

  CASCADE_CHAIN: [
    Object.freeze({ text: "Interrupt tags are worth more during a live chain than almost anywhere else.", weight: 0.94 }),
    Object.freeze({ text: "Positive cascades exist, but not if you are still bleeding from the negative one.", weight: 0.82 }),
    Object.freeze({ text: "Break propagation, then search for inversion value.", weight: 0.88 }),
    Object.freeze({ text: "Most players try to overpower a cascade. The smarter players choke its routing.", weight: 0.84 }),
  ],

  NEAR_SOVEREIGNTY: [
    Object.freeze({ text: "Final approach note: all five adversary models tighten near the ledger threshold.", weight: 0.92, minTick: 400 }),
    Object.freeze({ text: "Check for the hidden weakness, not the loud weakness. That is where runs die late.", weight: 0.88, minTick: 400 }),
    Object.freeze({ text: "Do not let visible proximity make you tactically readable.", weight: 0.84, minTick: 400 }),
  ],

  PLAYER_LOST: [
    Object.freeze({ text: "Replay this run for order, not outcome. The order is where the edge hides.", weight: 0.82, memoryAnchor: true }),
    Object.freeze({ text: "Losses archive the cleanest exploit data if you are willing to read them cold.", weight: 0.84 }),
    Object.freeze({ text: "The next run gets stronger only if this run becomes evidence instead of insult.", weight: 0.78 }),
  ],

},
  'helper', "insider", 'support', "market-intelligence",
));

export const SURVIVOR_DIALOGUE_TREE: HelperDialogueTree = freezeTree(tagTree(
{
  LOBBY_TAUNT: [
    Object.freeze({ text: "Do not let the room convince you it was always easy for them. It was not.", weight: 0.8 }),
    Object.freeze({ text: "You do not need to belong to this place before you earn your place in it.", weight: 0.84 }),
    Object.freeze({ text: "I have seen players with worse starts build better endings than anyone expected.", weight: 0.82 }),
  ],

  GAME_START: [
    Object.freeze({ text: "Another run. Another chance to prove you can outlast what was built to shake you loose.", weight: 0.86 }),
    Object.freeze({ text: "You are building instincts even when the board tells you that you are building pain.", weight: 0.8 }),
    Object.freeze({ text: "Stay long enough and the game stops feeling impossible and starts feeling legible.", weight: 0.78 }),
  ],

  PLAYER_FIRST_INCOME: [
    Object.freeze({ text: "Hold onto that. The first real stream changes how hope feels.", weight: 0.84 }),
    Object.freeze({ text: "I remember the first time the board stopped feeling purely hostile. It looked like this.", weight: 0.78 }),
    Object.freeze({ text: "You earned a foothold. Respect footholds.", weight: 0.8 }),
  ],

  PLAYER_CARD_PLAY: [
    Object.freeze({ text: "Good. Tiny smart decisions add up faster than dramatic rescues.", weight: 0.76 }),
    Object.freeze({ text: "It is okay if the play only buys breath. Breath matters.", weight: 0.78 }),
    Object.freeze({ text: "Every clean action under pressure makes the next clean action easier.", weight: 0.8 }),
  ],

  PLAYER_INCOME_UP: [
    Object.freeze({ text: "That matters more than the crowd will admit.", weight: 0.82 }),
    Object.freeze({ text: "Growth after pain always feels unreal the first few times. Trust the ledger.", weight: 0.8 }),
    Object.freeze({ text: "You are not imagining it. The line is turning.", weight: 0.84 }),
  ],

  PLAYER_SHIELD_BREAK: [
    Object.freeze({ text: "I have heard that crack before. It is not the end unless you let it become the story.", weight: 0.94 }),
    Object.freeze({ text: "Breathe first. Repair second. Panic third, if you still think you need it.", weight: 0.9 }),
    Object.freeze({ text: "A broken layer hurts. A broken will costs more.", weight: 0.86 }),
    Object.freeze({ text: "You can take a hit and still remain dangerous.", weight: 0.84 }),
  ],

  PLAYER_NEAR_BANKRUPTCY: [
    Object.freeze({ text: "I have stood on this exact edge and still crossed into sovereignty later. Stay here with me.", weight: 0.98, memoryAnchor: true }),
    Object.freeze({ text: "You are allowed to be scared. You are not allowed to disappear.", weight: 0.94 }),
    Object.freeze({ text: "This is survivable if you keep the next decision smaller than the fear.", weight: 0.9 }),
    Object.freeze({ text: "Do not narrate your funeral while the run is still breathing.", weight: 0.88 }),
  ],

  PLAYER_IDLE: [
    Object.freeze({ text: "Freeze happens. Come back by choosing one manageable thing.", weight: 0.9 }),
    Object.freeze({ text: "Name the next move out loud if you have to. Motion breaks despair.", weight: 0.82 }),
    Object.freeze({ text: "Stillness after damage can become surrender if you let it sit too long.", weight: 0.8 }),
  ],

  PLAYER_COMEBACK: [
    Object.freeze({ text: "There it is. That impossible little turn the room never sees coming in time.", weight: 0.94, memoryAnchor: true }),
    Object.freeze({ text: "This feeling is why survivors keep queueing after the ugly runs.", weight: 0.9 }),
    Object.freeze({ text: "Do not romanticize the comeback so hard that you stop protecting it.", weight: 0.84 }),
  ],

  PLAYER_RESPONSE_ANGRY: [
    Object.freeze({ text: "The anger makes sense. Let it testify, not drive.", weight: 0.88, callbackEligible: true }),
    Object.freeze({ text: "I have cursed every one of these bots. The part that helped came after the cursing.", weight: 0.84, callbackEligible: true }),
    Object.freeze({ text: "You care enough to feel this. Good. Now aim it.", weight: 0.82, callbackEligible: true }),
  ],

  BOT_WINNING: [
    Object.freeze({ text: "When the board leans this hard against you, your job is not elegance. It is endurance.", weight: 0.92 }),
    Object.freeze({ text: "Ugly survival still counts as survival.", weight: 0.88 }),
    Object.freeze({ text: "Make them spend more to finish you than they expected.", weight: 0.86 }),
  ],

  TIME_PRESSURE: [
    Object.freeze({ text: "A short clock can make ordinary fear feel like certainty. It is lying.", weight: 0.84 }),
    Object.freeze({ text: "Shrink the problem until your hands remember how to move.", weight: 0.86 }),
    Object.freeze({ text: "You do not need calm. You need one honest decision.", weight: 0.82 }),
  ],

  CASCADE_CHAIN: [
    Object.freeze({ text: "I know the feeling of watching everything start to fall at once. It can still be interrupted.", weight: 0.88 }),
    Object.freeze({ text: "Sometimes surviving the chain is enough. The rebuild comes after.", weight: 0.84 }),
    Object.freeze({ text: "Do not confuse cascade noise with finality.", weight: 0.8 }),
  ],

  NEAR_SOVEREIGNTY: [
    Object.freeze({ text: "You are close enough now that old pain will try to talk you out of finishing. Ignore it.", weight: 0.92, minTick: 400 }),
    Object.freeze({ text: "Late success can feel unreal to people who learned to expect collapse. Finish anyway.", weight: 0.9, minTick: 400 }),
    Object.freeze({ text: "Take the last stretch seriously. Hope deserves structure too.", weight: 0.86, minTick: 400 }),
  ],

  PLAYER_LOST: [
    Object.freeze({ text: "Run over. Grieve it, then mine it.", weight: 0.94, memoryAnchor: true }),
    Object.freeze({ text: "Nobody tells the truth about how many losses it takes to become dangerous here. It takes many.", weight: 0.9 }),
    Object.freeze({ text: "I am not asking you to feel better right now. I am asking you not to make this the last lesson.", weight: 0.88 }),
    Object.freeze({ text: "Come back after the sting cools. The run will still have something to teach.", weight: 0.84 }),
  ],

},
  'helper', "survivor", 'support', "crisis-veteran",
));

export const RIVAL_DIALOGUE_TREE: HelperDialogueTree = freezeTree(tagTree(
{
  LOBBY_TAUNT: [
    Object.freeze({ text: "You queued again. Good. I was starting to think I scared you off.", weight: 0.86 }),
    Object.freeze({ text: "Keep your standards high. I refuse to race weak competition.", weight: 0.82 }),
    Object.freeze({ text: "The room is noisy because it knows I am here. Try not to slow me down.", weight: 0.78 }),
  ],

  GAME_START: [
    Object.freeze({ text: "Try to keep up this run. I would hate to lap you before the real pressure starts.", weight: 0.84 }),
    Object.freeze({ text: "Clean run or chaotic run? Pick one. I plan to embarrass whichever you choose.", weight: 0.8 }),
    Object.freeze({ text: "Another board, another chance for you to surprise me.", weight: 0.76 }),
  ],

  PLAYER_FIRST_INCOME: [
    Object.freeze({ text: "Good. You finally look like someone worth tracking.", weight: 0.84 }),
    Object.freeze({ text: "First stream online. Now make it pretty.", weight: 0.8 }),
    Object.freeze({ text: "Decent start. Not mine, but decent.", weight: 0.78 }),
  ],

  PLAYER_CARD_PLAY: [
    Object.freeze({ text: "I would have sequenced that one tick earlier, but the instinct is respectable.", weight: 0.82 }),
    Object.freeze({ text: "You are getting faster. Dangerous development.", weight: 0.78 }),
    Object.freeze({ text: "Better. You are starting to make me work for the win.", weight: 0.76 }),
  ],

  PLAYER_INCOME_UP: [
    Object.freeze({ text: "Now we are talking. Growth looks better on you than panic.", weight: 0.92 }),
    Object.freeze({ text: "Income spike noted. I still want cleaner shield discipline from you.", weight: 0.86 }),
    Object.freeze({ text: "You climbed. Good. Stay there if you can.", weight: 0.82 }),
    Object.freeze({ text: "That move deserves respect. I am not saying I am impressed. I am saying I noticed.", weight: 0.8 }),
  ],

  PLAYER_SHIELD_BREAK: [
    Object.freeze({ text: "Ugly. Patch it fast or I am docking style points.", weight: 0.82 }),
    Object.freeze({ text: "Getting tagged is one thing. Letting it define the next three ticks is amateur.", weight: 0.84 }),
    Object.freeze({ text: "I have seen you recover faster than this. Act like it.", weight: 0.8 }),
  ],

  PLAYER_NEAR_BANKRUPTCY: [
    Object.freeze({ text: "Do not fold here. I hate easy wins.", weight: 0.88, memoryAnchor: true }),
    Object.freeze({ text: "If you crawl back from this, I will talk less trash for at least ten seconds.", weight: 0.82 }),
    Object.freeze({ text: "You are better than a quiet collapse. Show me.", weight: 0.84 }),
  ],

  PLAYER_IDLE: [
    Object.freeze({ text: "Thinking is fine. Fossilizing is not.", weight: 0.86 }),
    Object.freeze({ text: "Clock's moving. Catch it.", weight: 0.82 }),
    Object.freeze({ text: "Decide. I cannot compete against a statue.", weight: 0.78 }),
  ],

  PLAYER_COMEBACK: [
    Object.freeze({ text: "There you are. I knew you were still in the run somewhere.", weight: 0.94, memoryAnchor: true }),
    Object.freeze({ text: "Comeback accepted. Now make it cleaner than luck.", weight: 0.88 }),
    Object.freeze({ text: "Respect. I hate admitting that word, so enjoy it quickly.", weight: 0.84 }),
    Object.freeze({ text: "You turned the line. Good. Keep your foot on it.", weight: 0.82 }),
  ],

  PLAYER_RESPONSE_TROLL: [
    Object.freeze({ text: "Cute. Now do something with the board, comedian.", weight: 0.84, callbackEligible: true }),
    Object.freeze({ text: "Trash talk counts more when the ledger helps.", weight: 0.82, callbackEligible: true }),
    Object.freeze({ text: "If you are going to be annoying, at least be profitable too.", weight: 0.8, callbackEligible: true }),
  ],

  PLAYER_RESPONSE_FLEX: [
    Object.freeze({ text: "Talk is cheap. Verified wins cost more.", weight: 0.92, callbackEligible: true }),
    Object.freeze({ text: "Flex later. Execute now.", weight: 0.88, callbackEligible: true }),
    Object.freeze({ text: "I prefer arrogance backed by numbers. Bring numbers.", weight: 0.84, callbackEligible: true }),
  ],

  BOT_DEFEATED: [
    Object.freeze({ text: "Solid. One threat down. Do not get sentimental about it.", weight: 0.88, memoryAnchor: true }),
    Object.freeze({ text: "That was sharp. Annoyingly sharp.", weight: 0.84 }),
    Object.freeze({ text: "Good kill. Make the next one look intentional too.", weight: 0.82 }),
  ],

  BOT_WINNING: [
    Object.freeze({ text: "You letting them push you around now? Embarrassing.", weight: 0.86 }),
    Object.freeze({ text: "Get meaner. The bots already have.", weight: 0.84 }),
    Object.freeze({ text: "I do not mind you losing. I mind you losing soft.", weight: 0.82 }),
  ],

  TIME_PRESSURE: [
    Object.freeze({ text: "Fast hands, clear head. That is the whole assignment.", weight: 0.84 }),
    Object.freeze({ text: "Short clock means ugly courage beats pretty hesitation.", weight: 0.8 }),
    Object.freeze({ text: "You know enough. Move.", weight: 0.82 }),
  ],

  CASCADE_CHAIN: [
    Object.freeze({ text: "Break the chain and steal the tempo back. Basic stuff.", weight: 0.84 }),
    Object.freeze({ text: "If the board is going to get dramatic, answer with something cleaner than drama.", weight: 0.8 }),
    Object.freeze({ text: "Do not admire the collapse. Interrupt it.", weight: 0.82 }),
  ],

  NEAR_SOVEREIGNTY: [
    Object.freeze({ text: "You might actually finish. I hate how much I respect that.", weight: 0.94, minTick: 400 }),
    Object.freeze({ text: "Race condition: you versus the room. Do not lose to your own nerves.", weight: 0.88, minTick: 400 }),
    Object.freeze({ text: "Finish strong and I will stop calling you unfinished. Maybe.", weight: 0.84, minTick: 400 }),
    Object.freeze({ text: "You are close enough now that excuses would be offensive.", weight: 0.82, minTick: 400 }),
  ],

  PLAYER_LOST: [
    Object.freeze({ text: "Bad ending. Queue again.", weight: 0.84, memoryAnchor: true }),
    Object.freeze({ text: "Lose cleaner next time or win. Those are the only options I respect.", weight: 0.8 }),
    Object.freeze({ text: "I am not comforting you. I am reminding you that this is not your ceiling.", weight: 0.78 }),
  ],

},
  'helper', "rival", 'support', "friendly-competitor",
));

export const ARCHIVIST_DIALOGUE_TREE: HelperDialogueTree = freezeTree(tagTree(
{
  LOBBY_TAUNT: [
    Object.freeze({ text: "Archive note: most players who posture loudly in the lobby underperform their own predictions.", weight: 0.76 }),
    Object.freeze({ text: "The ledger remembers that many sovereign runs began without spectacle.", weight: 0.8 }),
    Object.freeze({ text: "Entry marker set. Another contestant enters the archive horizon.", weight: 0.74 }),
  ],

  GAME_START: [
    Object.freeze({ text: "Historical baseline: sovereignty is rare enough to matter and common enough to remain learnable.", weight: 0.88 }),
    Object.freeze({ text: "The five adversaries mirror structural barriers more than personal villains. Study that and the run gets clearer.", weight: 0.9 }),
    Object.freeze({ text: "Every opening generates a trace. Traces become futures when players repeat them long enough.", weight: 0.82 }),
    Object.freeze({ text: "Data note: persistence outperforms talent until talent learns persistence.", weight: 0.8 }),
  ],

  PLAYER_FIRST_INCOME: [
    Object.freeze({ text: "A run usually becomes narratively credible the moment first stable income appears.", weight: 0.8 }),
    Object.freeze({ text: "Recorded: initial revenue spine established.", weight: 0.76 }),
    Object.freeze({ text: "Many failed runs never reach this threshold. That alone is worth acknowledging.", weight: 0.78 }),
  ],

  PLAYER_CARD_PLAY: [
    Object.freeze({ text: "This action will matter less as a singular event than as part of the pattern it reinforces.", weight: 0.78 }),
    Object.freeze({ text: "Cards are never isolated in the archive. They are remembered as sequences.", weight: 0.8 }),
    Object.freeze({ text: "The board teaches in clusters, not headlines.", weight: 0.74 }),
  ],

  PLAYER_INCOME_UP: [
    Object.freeze({ text: "Growth events historically correlate with immediate counter-pressure. The archive suggests caution, not celebration.", weight: 0.86 }),
    Object.freeze({ text: "A new income bracket changes both possibility and visibility.", weight: 0.82 }),
    Object.freeze({ text: "Documented: upward mobility often triggers adversarial recalibration within a narrow window.", weight: 0.8 }),
  ],

  PLAYER_SHIELD_BREAK: [
    Object.freeze({ text: "Breach events are among the most informative data points in any replay.", weight: 0.84 }),
    Object.freeze({ text: "Structural damage clarifies hidden dependencies faster than comfort ever does.", weight: 0.8 }),
    Object.freeze({ text: "The archive treats breaches as revelation, not merely injury.", weight: 0.78 }),
  ],

  PLAYER_NEAR_BANKRUPTCY: [
    Object.freeze({ text: "Many future sovereigns passed through this exact severity band before they learned durable recovery.", weight: 0.86, memoryAnchor: true }),
    Object.freeze({ text: "Edge-state runs generate the richest correction data.", weight: 0.82 }),
    Object.freeze({ text: "This threshold is brutal, but it is also educational in a way easier states never become.", weight: 0.8 }),
  ],

  PLAYER_IDLE: [
    Object.freeze({ text: "Paused cognition is still a form of signal. The question is whether it resolves into action.", weight: 0.76 }),
    Object.freeze({ text: "Archive note: unresolved hesitation compounds more quietly than obvious mistakes.", weight: 0.8 }),
    Object.freeze({ text: "Time records indecision with surprising cruelty.", weight: 0.74 }),
  ],

  PLAYER_COMEBACK: [
    Object.freeze({ text: "Comeback sequences are disproportionately replayed because they compress belief revision into a visible span.", weight: 0.9, memoryAnchor: true }),
    Object.freeze({ text: "The archive values reversals because they reveal adaptation under fire.", weight: 0.84 }),
    Object.freeze({ text: "Recovery events often become identity events later.", weight: 0.82 }),
  ],

  BOT_DEFEATED: [
    Object.freeze({ text: "Hostile node neutralized. The ledger will classify this as a structural inflection point if you capitalize on it.", weight: 0.84, memoryAnchor: true }),
    Object.freeze({ text: "Noted: adversarial pressure reduced, narrative volatility remains.", weight: 0.8 }),
    Object.freeze({ text: "Defeat matters most when it alters the future path rather than the present mood.", weight: 0.78 }),
  ],

  TIME_PRESSURE: [
    Object.freeze({ text: "Compressed clocks produce the cleanest contrast between instinct and training.", weight: 0.8 }),
    Object.freeze({ text: "The archive measures short-clock behavior as a proxy for internal order.", weight: 0.82 }),
    Object.freeze({ text: "Under time stress, philosophy becomes motor pattern.", weight: 0.78 }),
  ],

  CASCADE_CHAIN: [
    Object.freeze({ text: "Cascades are archive-rich because they expose how one weakness licenses another.", weight: 0.86 }),
    Object.freeze({ text: "Systemic events rarely arrive as single events. They arrive as permissions.", weight: 0.8 }),
    Object.freeze({ text: "One broken assumption can route across the whole board faster than intention.", weight: 0.82 }),
  ],

  NEAR_SOVEREIGNTY: [
    Object.freeze({ text: "Only a minority of recorded runs reach this ledger band. Your trace is becoming historically significant.", weight: 0.94, minTick: 400 }),
    Object.freeze({ text: "If completed, this run becomes proof, not merely experience.", weight: 0.88, minTick: 400 }),
    Object.freeze({ text: "The archive reserves a different kind of permanence for verified late-run composure.", weight: 0.84, minTick: 400 }),
    Object.freeze({ text: "Close does not become recorded. Finished does.", weight: 0.82, minTick: 400 }),
  ],

  PLAYER_LOST: [
    Object.freeze({ text: "Run archived. Outcome fixed. Meaning still negotiable.", weight: 0.9, memoryAnchor: true }),
    Object.freeze({ text: "Losses are the most honest narrators in the system.", weight: 0.86 }),
    Object.freeze({ text: "Review this run after the emotion cools. The archive will still be speaking.", weight: 0.84 }),
    Object.freeze({ text: "Evidence remains long after disappointment changes shape.", weight: 0.82 }),
  ],

},
  'helper', "archivist", 'support', "lore-keeper",
));

export const HELPER_DIALOGUE_REGISTRY: Readonly<Record<HelperCharacterId, HelperRegistryEntry>> = Object.freeze({
  MENTOR: Object.freeze({
    helperId: 'MENTOR',
    displayName: "THE MENTOR",
    archLabel: "Strategic Advisor",
    emoji: "\ud83d\udf02",
    role: "Provides strategic guidance and emotional grounding. The player's anchor.",
    npcDescriptor: Object.freeze({
      npcId: asNpcId("helper-mentor"),
      actorKind: 'HELPER',
      displayName: "THE MENTOR",
      personaId: "helper.mentor",
      cadenceFloorMs: 950,
      cadenceCeilMs: 2400,
      enabledChannels: Object.freeze(["GLOBAL", "LOBBY", "SYNDICATE", "RESCUE_SHADOW"]) as unknown as readonly ChatChannelId[],
      coldStartBoost: asScore01(0.80),
    }),
    personality: Object.freeze({
      warmth: asScore01(0.9),
      directness: asScore01(0.7),
      frequency: asScore01(0.6),
      coldStartBoost: 2.0,
    }),
    intervention: Object.freeze({
      rescueBias: asScore01(0.92),
      coachingBias: asScore01(0.95),
      moraleBias: asScore01(0.7),
      intelBias: asScore01(0.55),
      loreBias: asScore01(0.2),
      rivalryBias: asScore01(0.38),
      postLossBias: asScore01(0.88),
    }),
    voiceprint: MENTOR_VOICEPRINT,
    idleTriggerTicks: 3,
    triggerConditions: Object.freeze(["PLAYER_NEAR_BANKRUPTCY", "PLAYER_IDLE", "GAME_START", "NEAR_SOVEREIGNTY"]) as readonly HaterDialogueContext[],
    channelPolicy: Object.freeze({
      primaryChannels: Object.freeze(["LOBBY", "GLOBAL", "RESCUE_SHADOW"]) as readonly ChatChannelId[],
      allowedChannels: Object.freeze(["GLOBAL", "LOBBY", "SYNDICATE", "RESCUE_SHADOW"]) as readonly ChatChannelId[],
      mayInterruptPublicSwarm: true,
      mayWhisperPrivately: true,
      mayEnterLobby: true,
      mayProjectIntoShadow: true,
    }),
    modeAffinity: Object.freeze({
      solo: 0.98,
      asymmetricPvp: 0.72,
      coop: 0.84,
      ghost: 0.65,
    }),
    dialogueTree: MENTOR_DIALOGUE_TREE,
  }),
  INSIDER: Object.freeze({
    helperId: 'INSIDER',
    displayName: "THE INSIDER",
    archLabel: "Market Intelligence",
    emoji: "\u2301",
    role: "Drops tips about hidden mechanics, card interactions, and bot behavior patterns.",
    npcDescriptor: Object.freeze({
      npcId: asNpcId("helper-insider"),
      actorKind: 'HELPER',
      displayName: "THE INSIDER",
      personaId: "helper.insider",
      cadenceFloorMs: 650,
      cadenceCeilMs: 4900,
      enabledChannels: Object.freeze(["GLOBAL", "SYNDICATE", "DEAL_ROOM", "NPC_SHADOW"]) as unknown as readonly ChatChannelId[],
      coldStartBoost: asScore01(0.60),
    }),
    personality: Object.freeze({
      warmth: asScore01(0.4),
      directness: asScore01(0.9),
      frequency: asScore01(0.3),
      coldStartBoost: 1.5,
    }),
    intervention: Object.freeze({
      rescueBias: asScore01(0.55),
      coachingBias: asScore01(0.72),
      moraleBias: asScore01(0.2),
      intelBias: asScore01(0.98),
      loreBias: asScore01(0.35),
      rivalryBias: asScore01(0.18),
      postLossBias: asScore01(0.28),
    }),
    voiceprint: INSIDER_VOICEPRINT,
    idleTriggerTicks: 8,
    triggerConditions: Object.freeze(["PLAYER_CARD_PLAY", "CASCADE_CHAIN", "PLAYER_SHIELD_BREAK"]) as readonly HaterDialogueContext[],
    channelPolicy: Object.freeze({
      primaryChannels: Object.freeze(["SYNDICATE", "NPC_SHADOW", "DEAL_ROOM"]) as readonly ChatChannelId[],
      allowedChannels: Object.freeze(["GLOBAL", "SYNDICATE", "DEAL_ROOM", "NPC_SHADOW"]) as readonly ChatChannelId[],
      mayInterruptPublicSwarm: false,
      mayWhisperPrivately: true,
      mayEnterLobby: false,
      mayProjectIntoShadow: true,
    }),
    modeAffinity: Object.freeze({
      solo: 0.82,
      asymmetricPvp: 0.84,
      coop: 0.74,
      ghost: 0.62,
    }),
    dialogueTree: INSIDER_DIALOGUE_TREE,
  }),
  SURVIVOR: Object.freeze({
    helperId: 'SURVIVOR',
    displayName: "THE SURVIVOR",
    archLabel: "Crisis Veteran",
    emoji: "\u2723",
    role: "Appears during the darkest moments. Has been through every possible loss scenario.",
    npcDescriptor: Object.freeze({
      npcId: asNpcId("helper-survivor"),
      actorKind: 'HELPER',
      displayName: "THE SURVIVOR",
      personaId: "helper.survivor",
      cadenceFloorMs: 750,
      cadenceCeilMs: 1900,
      enabledChannels: Object.freeze(["GLOBAL", "LOBBY", "RESCUE_SHADOW", "SYNDICATE"]) as unknown as readonly ChatChannelId[],
      coldStartBoost: asScore01(0.72),
    }),
    personality: Object.freeze({
      warmth: asScore01(1.0),
      directness: asScore01(0.5),
      frequency: asScore01(0.4),
      coldStartBoost: 1.8,
    }),
    intervention: Object.freeze({
      rescueBias: asScore01(0.98),
      coachingBias: asScore01(0.65),
      moraleBias: asScore01(0.95),
      intelBias: asScore01(0.2),
      loreBias: asScore01(0.18),
      rivalryBias: asScore01(0.12),
      postLossBias: asScore01(0.96),
    }),
    voiceprint: SURVIVOR_VOICEPRINT,
    idleTriggerTicks: 2,
    triggerConditions: Object.freeze(["PLAYER_NEAR_BANKRUPTCY", "PLAYER_LOST", "PLAYER_RESPONSE_ANGRY"]) as readonly HaterDialogueContext[],
    channelPolicy: Object.freeze({
      primaryChannels: Object.freeze(["RESCUE_SHADOW", "GLOBAL", "LOBBY"]) as readonly ChatChannelId[],
      allowedChannels: Object.freeze(["GLOBAL", "LOBBY", "RESCUE_SHADOW", "SYNDICATE"]) as readonly ChatChannelId[],
      mayInterruptPublicSwarm: true,
      mayWhisperPrivately: true,
      mayEnterLobby: true,
      mayProjectIntoShadow: true,
    }),
    modeAffinity: Object.freeze({
      solo: 0.96,
      asymmetricPvp: 0.62,
      coop: 0.78,
      ghost: 0.7,
    }),
    dialogueTree: SURVIVOR_DIALOGUE_TREE,
  }),
  RIVAL: Object.freeze({
    helperId: 'RIVAL',
    displayName: "THE RIVAL",
    archLabel: "Friendly Competitor",
    emoji: "\u26a1",
    role: "Competitive motivation. Pushes the player to perform without being hostile.",
    npcDescriptor: Object.freeze({
      npcId: asNpcId("helper-rival"),
      actorKind: 'HELPER',
      displayName: "THE RIVAL",
      personaId: "helper.rival",
      cadenceFloorMs: 700,
      cadenceCeilMs: 5900,
      enabledChannels: Object.freeze(["GLOBAL", "SYNDICATE", "LOBBY"]) as unknown as readonly ChatChannelId[],
      coldStartBoost: asScore01(0.32),
    }),
    personality: Object.freeze({
      warmth: asScore01(0.5),
      directness: asScore01(0.8),
      frequency: asScore01(0.35),
      coldStartBoost: 0.8,
    }),
    intervention: Object.freeze({
      rescueBias: asScore01(0.25),
      coachingBias: asScore01(0.88),
      moraleBias: asScore01(0.62),
      intelBias: asScore01(0.28),
      loreBias: asScore01(0.08),
      rivalryBias: asScore01(0.98),
      postLossBias: asScore01(0.2),
    }),
    voiceprint: RIVAL_VOICEPRINT,
    idleTriggerTicks: 10,
    triggerConditions: Object.freeze(["PLAYER_INCOME_UP", "PLAYER_COMEBACK", "NEAR_SOVEREIGNTY", "PLAYER_RESPONSE_FLEX"]) as readonly HaterDialogueContext[],
    channelPolicy: Object.freeze({
      primaryChannels: Object.freeze(["GLOBAL", "LOBBY", "SYNDICATE"]) as readonly ChatChannelId[],
      allowedChannels: Object.freeze(["GLOBAL", "SYNDICATE", "LOBBY"]) as readonly ChatChannelId[],
      mayInterruptPublicSwarm: true,
      mayWhisperPrivately: false,
      mayEnterLobby: true,
      mayProjectIntoShadow: false,
    }),
    modeAffinity: Object.freeze({
      solo: 0.7,
      asymmetricPvp: 0.94,
      coop: 0.54,
      ghost: 0.66,
    }),
    dialogueTree: RIVAL_DIALOGUE_TREE,
  }),
  ARCHIVIST: Object.freeze({
    helperId: 'ARCHIVIST',
    displayName: "THE ARCHIVIST",
    archLabel: "Lore Keeper",
    emoji: "\u232c",
    role: "Drops historical context, statistics, and world-building lore about the PZO universe.",
    npcDescriptor: Object.freeze({
      npcId: asNpcId("helper-archivist"),
      actorKind: 'HELPER',
      displayName: "THE ARCHIVIST",
      personaId: "helper.archivist",
      cadenceFloorMs: 550,
      cadenceCeilMs: 8400,
      enabledChannels: Object.freeze(["GLOBAL", "LOBBY", "NPC_SHADOW", "SYNDICATE"]) as unknown as readonly ChatChannelId[],
      coldStartBoost: asScore01(0.20),
    }),
    personality: Object.freeze({
      warmth: asScore01(0.3),
      directness: asScore01(0.6),
      frequency: asScore01(0.2),
      coldStartBoost: 0.5,
    }),
    intervention: Object.freeze({
      rescueBias: asScore01(0.18),
      coachingBias: asScore01(0.32),
      moraleBias: asScore01(0.28),
      intelBias: asScore01(0.48),
      loreBias: asScore01(1.0),
      rivalryBias: asScore01(0.1),
      postLossBias: asScore01(0.56),
    }),
    voiceprint: ARCHIVIST_VOICEPRINT,
    idleTriggerTicks: 15,
    triggerConditions: Object.freeze(["GAME_START", "NEAR_SOVEREIGNTY", "PLAYER_LOST"]) as readonly HaterDialogueContext[],
    channelPolicy: Object.freeze({
      primaryChannels: Object.freeze(["GLOBAL", "NPC_SHADOW", "LOBBY"]) as readonly ChatChannelId[],
      allowedChannels: Object.freeze(["GLOBAL", "LOBBY", "NPC_SHADOW", "SYNDICATE"]) as readonly ChatChannelId[],
      mayInterruptPublicSwarm: false,
      mayWhisperPrivately: true,
      mayEnterLobby: true,
      mayProjectIntoShadow: true,
    }),
    modeAffinity: Object.freeze({
      solo: 0.72,
      asymmetricPvp: 0.58,
      coop: 0.6,
      ghost: 0.94,
    }),
    dialogueTree: ARCHIVIST_DIALOGUE_TREE,
  }),
});

export const HELPER_NPC_INDEX = Object.freeze(
  Object.fromEntries(
    Object.values(HELPER_DIALOGUE_REGISTRY).map((entry) => [entry.npcDescriptor.npcId, entry]),
  ) as Readonly<Record<ChatNpcId, HelperRegistryEntry>>,
);

export function getAllHelperRegistryEntries(): readonly HelperRegistryEntry[] {
  return Object.values(HELPER_DIALOGUE_REGISTRY);
}

export function getHelperRegistryEntry(helperId: HelperCharacterId): HelperRegistryEntry {
  const entry = HELPER_DIALOGUE_REGISTRY[helperId];
  if (!entry) {
    throw new Error(`Unknown helper registry entry: ${String(helperId)}`);
  }
  return entry;
}

export function getHelperRegistryEntryByNpcId(npcId: ChatNpcId): HelperRegistryEntry {
  const entry = HELPER_NPC_INDEX[npcId];
  if (!entry) {
    throw new Error(`Unknown helper npc id: ${String(npcId)}`);
  }
  return entry;
}

export function listHelperNpcDescriptors(): readonly ChatNpcDescriptor[] {
  return getAllHelperRegistryEntries().map((entry) => entry.npcDescriptor);
}

export function getHelperVoiceprint(helperId: HelperCharacterId): ChatPersonaVoiceprint {
  return getHelperRegistryEntry(helperId).voiceprint;
}

export function helperCanSpeakInChannel(
  helperId: HelperCharacterId,
  channelId: ChatChannelId,
): boolean {
  return getHelperRegistryEntry(helperId).channelPolicy.allowedChannels.includes(channelId);
}

export function getHelperModeAffinityScore(
  helperId: HelperCharacterId,
  runMode: FrontendRunMode,
): number {
  const entry = getHelperRegistryEntry(helperId);
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

export function getLinesForHelperContext(
  helperId: HelperCharacterId,
  context: HaterDialogueContext,
): readonly HaterDialogueLine[] {
  return getHelperRegistryEntry(helperId).dialogueTree[context] ?? [];
}

function computeColdStartMultiplier(totalRuns: number, coldStartBoost: number): number {
  if (totalRuns <= 0) return coldStartBoost;
  if (totalRuns < 3) return Math.max(1, coldStartBoost * 0.9);
  if (totalRuns < 5) return Math.max(1, coldStartBoost * 0.75);
  if (totalRuns < 10) return Math.max(1, coldStartBoost * 0.45);
  return 1;
}

function computeHelperUrgency(
  entry: HelperRegistryEntry,
  context: HaterDialogueContext,
  input: HelperDialogueSelectionInput,
): number {
  let score = 0;

  if (entry.triggerConditions.includes(context)) {
    score += 0.42;
  }

  if (input.playerSilenceTicks !== undefined && input.playerSilenceTicks >= entry.idleTriggerTicks) {
    score += 0.16;
  }

  if (context === 'PLAYER_NEAR_BANKRUPTCY') {
    score += entry.intervention.rescueBias * 0.35;
  }

  if (context === 'PLAYER_LOST') {
    score += entry.intervention.postLossBias * 0.28;
  }

  if (context === 'PLAYER_COMEBACK') {
    score += entry.intervention.moraleBias * 0.24;
  }

  if (context === 'PLAYER_CARD_PLAY' || context === 'CASCADE_CHAIN') {
    score += entry.intervention.intelBias * 0.22;
  }

  if (context === 'PLAYER_RESPONSE_FLEX') {
    score += entry.intervention.rivalryBias * 0.20;
  }

  if (context === 'GAME_START' || context === 'NEAR_SOVEREIGNTY') {
    score += entry.intervention.coachingBias * 0.18;
  }

  if ((input.playerTiltScore ?? 0) > 0.66) {
    score += entry.intervention.rescueBias * 0.18;
  }

  if ((input.playerConfidenceScore ?? 0) > 0.72) {
    score += entry.intervention.coachingBias * 0.08;
  }

  if (helperCanSpeakInChannel(entry.helperId, input.channelId)) {
    score += 0.12;
  }

  score += getHelperModeAffinityScore(entry.helperId, input.runMode) * 0.12;
  score += entry.personality.frequency * 0.10;

  const coldStartMultiplier = computeColdStartMultiplier(
    input.currentRunCount,
    entry.personality.coldStartBoost,
  );

  return score * coldStartMultiplier;
}

function buildEligibleHelperLines(
  entry: HelperRegistryEntry,
  input: HelperDialogueSelectionInput,
): readonly HaterDialogueLine[] {
  const lines = getLinesForHelperContext(entry.helperId, input.requestedContext);
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

function pickWeightedHelperLine(
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

export function pickHelperDialogueLine(
  input: HelperDialogueSelectionInput,
): HelperDialogueSelectionResult {
  const entry = getHelperRegistryEntry(input.helperId);
  const eligible = buildEligibleHelperLines(entry, input);
  const line = pickWeightedHelperLine(eligible, input.rng ?? Math.random);

  return Object.freeze({
    helperId: input.helperId,
    resolvedContext: input.requestedContext,
    line,
    candidatesConsidered: eligible.length,
    coldStartApplied: input.currentRunCount < 5,
  });
}

export function listEligibleHelpersForContext(
  context: HaterDialogueContext,
  channelId: ChatChannelId,
  runMode: FrontendRunMode,
): readonly HelperCharacterId[] {
  return getAllHelperRegistryEntries()
    .filter((entry) => entry.triggerConditions.includes(context))
    .filter((entry) => helperCanSpeakInChannel(entry.helperId, channelId))
    .sort((a, b) => getHelperModeAffinityScore(b.helperId, runMode) - getHelperModeAffinityScore(a.helperId, runMode))
    .map((entry) => entry.helperId);
}

export function selectHelpersForContext(
  context: HaterDialogueContext,
  totalRuns: number,
  channelId: ChatChannelId,
  runMode: FrontendRunMode,
  options?: {
    readonly playerSilenceTicks?: number;
    readonly playerTiltScore?: number;
    readonly playerConfidenceScore?: number;
  },
): readonly HelperCharacterId[] {
  const ranked = getAllHelperRegistryEntries()
    .filter((entry) => entry.triggerConditions.includes(context))
    .filter((entry) => helperCanSpeakInChannel(entry.helperId, channelId))
    .map((entry) => {
      const urgency = computeHelperUrgency(entry, context, {
        helperId: entry.helperId,
        requestedContext: context,
        currentTick: 0,
        currentRunCount: totalRuns,
        channelId,
        runMode,
        playerSilenceTicks: options?.playerSilenceTicks,
        playerTiltScore: options?.playerTiltScore,
        playerConfidenceScore: options?.playerConfidenceScore,
      });
      return [entry.helperId, urgency] as const;
    })
    .sort((a, b) => b[1] - a[1]);

  if (ranked.length === 0) return Object.freeze([]);
  if (context === 'PLAYER_NEAR_BANKRUPTCY' || context === 'PLAYER_LOST') {
    return Object.freeze(ranked.slice(0, 2).map(([helperId]) => helperId));
  }
  return Object.freeze(ranked.slice(0, 1).map(([helperId]) => helperId));
}

export function getMentorFallbackLine(context: HaterDialogueContext): string {
  const lines = getLinesForHelperContext('MENTOR', context);
  return lines[0]?.text ?? 'Steady. Keep the run coherent.';
}
