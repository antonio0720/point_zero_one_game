/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND PERSONA REGISTRY
 * FILE: backend/src/game/engine/chat/persona/PersonaRegistry.ts
 * VERSION: 2026.03.19
 * AUTHORSHIP: OpenAI for Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical backend authority for chat persona identity, runtime aliases,
 * corpus ownership, selection ordering, and donor-compatible bridging between:
 *
 * - shared/contracts/chat/ChatNpc.ts
 * - shared/contracts/chat/persona-evolution.ts
 * - backend/src/game/engine/chat/ChatEngine.ts
 * - backend/src/game/engine/chat/index.ts
 * - backend/src/game/engine/chat/phase4_index.ts
 *
 * Why this file exists
 * --------------------
 * The current backend ChatEngine still contains a hard-coded local PERSONAS map
 * and a very small composeWithVoiceprint helper. That was sufficient for
 * phase-one authority, but not for the upgraded stack that now wants:
 *
 * - stable registry lookups,
 * - shared-contract convergence,
 * - runtime aliases that preserve current repo behavior,
 * - corpora richer than one-off local arrays,
 * - helper/hater candidate ordering with deterministic rules,
 * - evolution-aware identity metadata,
 * - future compatibility with relationship, callback, crowd heat, and liveops.
 *
 * Design laws
 * -----------
 * - Shared contracts own persona law.
 * - Backend registry owns runtime truth.
 * - Frontend may mirror persona flavor, but backend chooses what enters truth.
 * - Current repo aliases (helper_anchor, helper_mercy, ambient_floor, BOT_01,
 *   BOT_02, BOT_03) remain valid.
 * - Future canonical shared keys (MENTOR, SURVIVOR, FLOOR_RUNNER, etc.) are the
 *   long-term identity layer.
 * - This file is deterministic and side-effect free.
 * ============================================================================
 */

import type {
  ChatAmbientNpcDescriptor,
  ChatAnyNpcDescriptor,
  ChatDialogueLine,
  ChatDialogueTree,
  ChatHelperNpcDescriptor,
  ChatHaterNpcDescriptor,
  ChatKnownNpcKey,
  ChatNpcClass,
  ChatNpcDescriptor,
  ChatNpcVoiceprint,
} from '../../../../../../shared/contracts/chat/ChatNpc';
import {
  CHAT_ALL_NPC_DESCRIPTORS,
  CHAT_AMBIENT_NPC_KEYS,
  CHAT_HATER_NPC_KEYS,
  CHAT_HELPER_NPC_KEYS,
  CHAT_NPC_CADENCE_PROFILES,
  CHAT_NPC_VOICEPRINTS,
} from '../../../../../../shared/contracts/chat/ChatNpc';
import type { Score01, UnixMs } from '../../../../../../shared/contracts/chat/ChatChannels';
import type { ChatTypingStyleAssignment } from '../../../../../../shared/contracts/chat/ChatTyping';
import { CHAT_TYPING_STYLE_ASSIGNMENTS } from '../../../../../../shared/contracts/chat/ChatTyping';
import type { ChatPersonaEvolutionProfile } from '../../../../../../shared/contracts/chat/persona-evolution';
import {
  buildDefaultPersonaEvolutionProfile,
  clamp01 as clampEvolution01,
  resolvePersonaStage,
} from '../../../../../../shared/contracts/chat/persona-evolution';

// ============================================================================
// MARK: Public registry contracts
// ============================================================================

export type BackendPersonaAliasKey =
  | 'hater_liquidator'
  | 'hater_bureaucrat'
  | 'hater_manipulator'
  | 'helper_anchor'
  | 'helper_mercy'
  | 'ambient_floor';

export type BackendPersonaLineCategory =
  | 'telegraphs'
  | 'taunts'
  | 'retreats'
  | 'rescues'
  | 'ambient'
  | 'witness'
  | 'callbacks'
  | 'postrun';

export type BackendPersonaRoomMood =
  | 'CALM'
  | 'WATCHFUL'
  | 'TENSE'
  | 'HOSTILE'
  | 'PREDATORY'
  | 'MOURNFUL';

export interface BackendPersonaRuntimePresentation {
  readonly runtimePersonaId: string;
  readonly runtimeActorId: string;
  readonly runtimeDisplayName: string;
  readonly runtimeBotId: string | null;
  readonly aliasKeys: readonly string[];
}

export interface BackendPersonaLineBank {
  readonly telegraphs: readonly string[];
  readonly taunts: readonly string[];
  readonly retreats: readonly string[];
  readonly rescues: readonly string[];
  readonly ambient: readonly string[];
  readonly witness: readonly string[];
  readonly callbacks: readonly string[];
  readonly postrun: readonly string[];
}

export interface BackendPersonaSelectionWeights {
  readonly publicPressure01: number;
  readonly privatePressure01: number;
  readonly rescueBias01: number;
  readonly callbackBias01: number;
  readonly negotiationBias01: number;
  readonly witnessBias01: number;
}

export interface BackendPersonaRegistryEntry {
  readonly sharedKey: ChatKnownNpcKey;
  readonly descriptor: ChatAnyNpcDescriptor;
  readonly runtime: BackendPersonaRuntimePresentation;
  readonly lineBank: BackendPersonaLineBank;
  readonly selectionWeights: BackendPersonaSelectionWeights;
  readonly preferredRoomMoods: readonly BackendPersonaRoomMood[];
  readonly preferredPressureBands: readonly string[];
  readonly typingAssignments: readonly ChatTypingStyleAssignment[];
  readonly evolutionSeed: ChatPersonaEvolutionProfile;
  readonly canonicalTags: readonly string[];
}

export interface BackendPersonaRegistrySnapshot {
  readonly version: string;
  readonly createdAt: number;
  readonly totalPersonas: number;
  readonly haterCount: number;
  readonly helperCount: number;
  readonly ambientCount: number;
  readonly aliasCount: number;
  readonly liveBotBindings: readonly string[];
}

export interface BackendPersonaLookupResult {
  readonly entry: BackendPersonaRegistryEntry;
  readonly matchedBy:
    | 'sharedKey'
    | 'aliasKey'
    | 'runtimePersonaId'
    | 'runtimeActorId'
    | 'runtimeBotId';
}

export interface BackendPersonaSelectionContext {
  readonly roomMood?: BackendPersonaRoomMood | null;
  readonly pressureBand?: string | null;
  readonly embarrassment01?: number | null;
  readonly desperation01?: number | null;
  readonly confidence01?: number | null;
  readonly callbackDemand01?: number | null;
  readonly negotiationDemand01?: number | null;
}

// ============================================================================
// MARK: Internal helpers
// ============================================================================

function clamp01(value: number | null | undefined): number {
  if (value == null || Number.isNaN(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return Number(value.toFixed(6));
}

function asScore01(value: number): Score01 {
  return clamp01(value) as Score01;
}

function normalizeLine(line: string): string {
  return line.replace(/\s+/g, ' ').replace(/\s+([,.;!?…])/g, '$1').trim();
}

function uniqueLines(lines: readonly string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const line of lines) {
    const normalized = normalizeLine(line);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(normalized);
  }
  return next;
}

function positiveHash(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function pickDeterministic<T>(values: readonly T[], seed: string): T | null {
  if (values.length === 0) return null;
  const index = positiveHash(seed) % values.length;
  return values[index] ?? null;
}

function isHaterDescriptor(descriptor: ChatAnyNpcDescriptor): descriptor is ChatHaterNpcDescriptor {
  return descriptor.npcClass === 'HATER';
}

function isHelperDescriptor(descriptor: ChatAnyNpcDescriptor): descriptor is ChatHelperNpcDescriptor {
  return descriptor.npcClass === 'HELPER';
}

function isAmbientDescriptor(descriptor: ChatAnyNpcDescriptor): descriptor is ChatAmbientNpcDescriptor {
  return descriptor.npcClass === 'AMBIENT';
}

function flattenDialogueTree(tree: ChatDialogueTree | Readonly<Record<string, readonly ChatDialogueLine[]>> | undefined): string[] {
  if (!tree) return [];
  const buckets = Object.values(tree) as readonly (readonly ChatDialogueLine[])[];
  const lines: string[] = [];
  for (const bucket of buckets) {
    for (const line of bucket) {
      if (!line?.text) continue;
      lines.push(line.text);
    }
  }
  return uniqueLines(lines);
}

function ensureLineBank(input: Partial<BackendPersonaLineBank>): BackendPersonaLineBank {
  return Object.freeze({
    telegraphs: uniqueLines(input.telegraphs ?? []),
    taunts: uniqueLines(input.taunts ?? []),
    retreats: uniqueLines(input.retreats ?? []),
    rescues: uniqueLines(input.rescues ?? []),
    ambient: uniqueLines(input.ambient ?? []),
    witness: uniqueLines(input.witness ?? []),
    callbacks: uniqueLines(input.callbacks ?? []),
    postrun: uniqueLines(input.postrun ?? []),
  });
}

function createDefaultSelectionWeights(descriptor: ChatAnyNpcDescriptor): BackendPersonaSelectionWeights {
  if (descriptor.npcClass === 'HATER') {
    return Object.freeze({
      publicPressure01: 0.88,
      privatePressure01: 0.54,
      rescueBias01: 0.06,
      callbackBias01: 0.74,
      negotiationBias01: 0.68,
      witnessBias01: 0.36,
    });
  }
  if (descriptor.npcClass === 'HELPER') {
    return Object.freeze({
      publicPressure01: 0.42,
      privatePressure01: 0.76,
      rescueBias01: 0.90,
      callbackBias01: 0.38,
      negotiationBias01: 0.24,
      witnessBias01: 0.28,
    });
  }
  return Object.freeze({
    publicPressure01: 0.52,
    privatePressure01: 0.28,
    rescueBias01: 0.10,
    callbackBias01: 0.30,
    negotiationBias01: 0.44,
    witnessBias01: 0.82,
  });
}

function createDefaultRuntimePresentation(sharedKey: ChatKnownNpcKey, descriptor: ChatAnyNpcDescriptor): BackendPersonaRuntimePresentation {
  return Object.freeze({
    runtimePersonaId: descriptor.personaId,
    runtimeActorId: descriptor.npcId,
    runtimeDisplayName: descriptor.displayName,
    runtimeBotId: isHaterDescriptor(descriptor)
      ? resolveDefaultBotBinding(sharedKey)
      : null,
    aliasKeys: [String(sharedKey).toLowerCase()],
  });
}

function resolveDefaultBotBinding(sharedKey: ChatKnownNpcKey): string | null {
  switch (sharedKey) {
    case 'LIQUIDATOR':
      return 'BOT_01';
    case 'BUREAUCRAT':
      return 'BOT_02';
    case 'MANIPULATOR':
      return 'BOT_03';
    default:
      return null;
  }
}

function createDefaultPreferredMoods(descriptor: ChatAnyNpcDescriptor): readonly BackendPersonaRoomMood[] {
  if (descriptor.npcClass === 'HATER') return ['TENSE', 'HOSTILE', 'PREDATORY'];
  if (descriptor.npcClass === 'HELPER') return ['TENSE', 'HOSTILE', 'MOURNFUL'];
  return ['WATCHFUL', 'TENSE', 'HOSTILE'];
}

function createDefaultPreferredPressureBands(descriptor: ChatAnyNpcDescriptor): readonly string[] {
  if (descriptor.npcClass === 'HATER') return ['PRESSURED', 'CRITICAL', 'BREAKPOINT'];
  if (descriptor.npcClass === 'HELPER') return ['WATCHFUL', 'PRESSURED', 'CRITICAL'];
  return ['WATCHFUL', 'PRESSURED'];
}

function deriveTypingAssignments(descriptor: ChatAnyNpcDescriptor): readonly ChatTypingStyleAssignment[] {
  return CHAT_TYPING_STYLE_ASSIGNMENTS.filter((assignment) => {
    if (descriptor.npcClass === 'HATER') {
      return assignment.actorKind === 'HATER' || assignment.actorKind === 'NPC';
    }
    if (descriptor.npcClass === 'HELPER') {
      return assignment.actorKind === 'HELPER';
    }
    return assignment.actorKind === 'NPC';
  });
}

function buildDefaultLineBank(descriptor: ChatAnyNpcDescriptor): BackendPersonaLineBank {
  if (isHaterDescriptor(descriptor)) {
    const source = flattenDialogueTree(descriptor.dialogueTree);
    return ensureLineBank({
      telegraphs: source.slice(0, 12),
      taunts: source.slice(12, 24),
      retreats: source.slice(24, 32),
      callbacks: source.slice(32, 40),
      witness: source.slice(40, 48),
      ambient: source.slice(48, 56),
      postrun: source.slice(56, 64),
    });
  }

  if (isHelperDescriptor(descriptor)) {
    const source = flattenDialogueTree(descriptor.dialogueTree);
    return ensureLineBank({
      rescues: source.slice(0, 16),
      callbacks: source.slice(16, 24),
      witness: source.slice(24, 32),
      ambient: source.slice(32, 40),
      postrun: source.slice(40, 48),
    });
  }

  const source = flattenDialogueTree(isAmbientDescriptor(descriptor) ? descriptor.dialogueTree : undefined);
  return ensureLineBank({
    ambient: source.slice(0, 16),
    witness: source.slice(16, 28),
    callbacks: source.slice(28, 36),
    postrun: source.slice(36, 44),
  });
}

// ============================================================================
// MARK: Repo-specific runtime overrides lifted from backend ChatEngine.ts
// ============================================================================

const RUNTIME_OVERRIDES: Readonly<Record<ChatKnownNpcKey, Partial<BackendPersonaRuntimePresentation>>> = Object.freeze({
  LIQUIDATOR: {
    runtimePersonaId: 'persona:hater:liquidator',
    runtimeActorId: 'npc:hater:liquidator',
    runtimeDisplayName: 'THE LIQUIDATOR',
    runtimeBotId: 'BOT_01',
    aliasKeys: ['hater_liquidator', 'bot_01', 'liquidator'],
  },
  BUREAUCRAT: {
    runtimePersonaId: 'persona:hater:bureaucrat',
    runtimeActorId: 'npc:hater:bureaucrat',
    runtimeDisplayName: 'THE BUREAUCRAT',
    runtimeBotId: 'BOT_02',
    aliasKeys: ['hater_bureaucrat', 'bot_02', 'bureaucrat'],
  },
  MANIPULATOR: {
    runtimePersonaId: 'persona:hater:manipulator',
    runtimeActorId: 'npc:hater:manipulator',
    runtimeDisplayName: 'THE MANIPULATOR',
    runtimeBotId: 'BOT_03',
    aliasKeys: ['hater_manipulator', 'bot_03', 'manipulator'],
  },
  MENTOR: {
    runtimePersonaId: 'persona:helper:anchor',
    runtimeActorId: 'npc:helper:anchor',
    runtimeDisplayName: 'Kade Anchor',
    runtimeBotId: null,
    aliasKeys: ['helper_anchor', 'mentor', 'kade_anchor'],
  },
  SURVIVOR: {
    runtimePersonaId: 'persona:helper:mercy',
    runtimeActorId: 'npc:helper:mercy',
    runtimeDisplayName: 'Mercy Vale',
    runtimeBotId: null,
    aliasKeys: ['helper_mercy', 'survivor', 'mercy_vale'],
  },
  FLOOR_RUNNER: {
    runtimePersonaId: 'persona:ambient:floor',
    runtimeActorId: 'npc:ambient:floor',
    runtimeDisplayName: 'Floor Chorus',
    runtimeBotId: null,
    aliasKeys: ['ambient_floor', 'floor_runner', 'floor_chorus'],
  },
});

const LEGACY_RUNTIME_CORPORA: Readonly<Record<string, Partial<BackendPersonaLineBank>>> = Object.freeze({
  LIQUIDATOR: {
    telegraphs: [
      'The floor is visible from here.',
      'Stress reprices confidence faster than confidence can defend itself.',
      'You are one weak layer away from a clearance event.',
      'The room can smell thinning liquidity.',
      'Your buffer is already being discussed like it belongs to the past.',
      'Thin protection always looks normal one move before the break.',
      'The window is smaller than your posture suggests.',
      'Public confidence leaves before price makes it official.',
      'You are not early. You are almost late.',
      'Fragility advertises itself to prepared predators.',
    ],
    taunts: [
      'Your assets are priced for distress.',
      'You built momentum. I built a window to extract it.',
      'Public confidence drops first. Then numbers follow.',
      'The room sees your optimism as unsecured inventory.',
      'You are defending the story, not the position.',
      'Your shield is not failing quietly enough to save your pride.',
      'I do not need a crash. I need one public wobble.',
      'Exposure always denies it is exposure until the market applauds the proof.',
      'There is a version of you that survives this. It is not the loud one.',
      'You confuse surviving the minute with owning the turn.',
    ],
    retreats: [
      'This window closes. Another opens.',
      'You absorbed this round. The market keeps memory.',
      'Temporary resilience is still useful data.',
      'You stabilized the edge. I logged the route.',
      'The extraction failed. The reading did not.',
      'You bought time. I study what you paid for it.',
    ],
    callbacks: [
      'Earlier you called this stable. The room kept that line.',
      'You said you had room. I kept the receipt.',
      'Your confidence had a timestamp. So does this correction.',
      'You bragged about durability in public. I answer in public too.',
    ],
    witness: [
      'The floor watched that risk print itself.',
      'Crowd memory just priced your hesitation.',
      'That move did not stay private long enough to protect you.',
    ],
    postrun: [
      'Turning point: you defended posture after the room had already shifted.',
      'Post-run note: the loss began when exposure became visible.',
    ],
  },
  BUREAUCRAT: {
    telegraphs: [
      'A filing issue has entered review.',
      'Compliance friction is still friction, even when it smiles.',
      'Everything is provisionally approved until it is not.',
      'You are being delayed by procedure wearing polite language.',
      'Forms are just elegant pressure gates with nicer fonts.',
      'Approval does not equal clearance.',
      'The queue remembers who arrived unprepared.',
      'Nothing is denied yet. That is not the comfort you think it is.',
    ],
    taunts: [
      'Every income stream requires verification. There are forms.',
      'The system requires reserves. You appear to prefer improvisation.',
      'Please hold while your optimism is processed.',
      'Delay is a weapon when your structure depends on rhythm.',
      'Your signature is missing at the worst possible time.',
      'A clean record would have moved faster than this.',
      'I do not need to block you. I need to hold you in review.',
      'Process integrity at your expense remains process integrity.',
    ],
    retreats: [
      'Your paperwork appears to be in order. For now.',
      'We will revisit your compliance posture.',
      'Order was restored before delay matured into damage.',
      'Inconvenient. You closed the form gap.',
    ],
    callbacks: [
      'You said administration would not matter. Administration logged the claim.',
      'Earlier you mocked process. You are moving inside it now.',
      'Your old impatience just became audit material.',
    ],
    witness: [
      'The record shows the hold clearly.',
      'Everyone saw the pause; not everyone understood the cause.',
    ],
    postrun: [
      'Turning point: delay gained leverage before you respected it.',
      'Post-run note: procedural friction outlived your tempo.',
    ],
  },
  MANIPULATOR: {
    telegraphs: [
      'Predictable players become readable players.',
      'You left a pattern. I left a trap inside it.',
      'Behavior is inventory to the prepared mind.',
      'Your cadence has weight. I trade that weight.',
      'I saw the pause before you called it strategy.',
      'A readable bluff is just volunteered inventory.',
      'The room thinks you are adapting. I think you are looping.',
      'Your decision timing has already become public geometry.',
    ],
    taunts: [
      'You did not lose to chance. You lost to readability.',
      'Your panic cadence is a better signal than any chart.',
      'I have been studying your moves before you made them.',
      'Your best bluff has a rhythm. I have clocked it twice.',
      'You call it intuition when I call it a repeated tell.',
      'Noise and signal are sharing your face right now.',
      'You keep changing tactics and preserving the same tell.',
      'The trap worked because it looked like your own idea.',
    ],
    retreats: [
      'You changed your pattern. Interesting.',
      'I will need to recalibrate the model.',
      'That broke the read cleanly enough to matter.',
      'You hid the cadence this time. That is expensive discipline.',
    ],
    callbacks: [
      'You said this was easy three minutes ago.',
      'Last time you hesitated here, your shield broke.',
      'You ignored the cleaner exit twice. I noticed both.',
      'I already have a model for your delay time between stimulus and decision.',
    ],
    witness: [
      'The room heard the lie before you finished wearing it.',
      'A public bluff leaves fingerprints.',
    ],
    postrun: [
      'Turning point: your signal and your theater stopped being separable.',
      'Post-run note: pattern discipline arrived one beat too late.',
    ],
  },
  MENTOR: {
    rescues: [
      'Take the clean line. Do not answer the whole room.',
      'One move. Stabilize first. Style can wait.',
      'Mute the crowd in your head. Solve the next thing only.',
      'Breathe. Then reduce the board to one decision.',
      'Your dignity survives if your sequence survives.',
      'You do not owe the room a speech. You owe yourself a clean move.',
      'Protect structure first. Interpretation can wait.',
      'You still have options because panic has not been allowed to choose for you.',
    ],
    callbacks: [
      'You already know this lane. Use what worked before.',
      'The last time you kept it small, the turn came back to you.',
      'You do not need a miracle. You need the discipline you already practiced.',
    ],
    witness: [
      'The hit landed, but you are still inside the run.',
      'The crowd is loud; that does not make it right.',
    ],
    ambient: [
      'You still have a narrow exit.',
      'There is still a recoverable line.',
    ],
    postrun: [
      'Turning point: when you stopped answering the room and started answering the board.',
    ],
  },
  SURVIVOR: {
    rescues: [
      'You do not need brilliance here. You need sequence.',
      'Let the hit land without giving it your identity.',
      'The room is loud. Your next move should be quiet.',
      'I have seen worse boards than this one recover.',
      'Stay with me for one clean step. Not the whole future.',
      'Loss is content only if you survive long enough to read it.',
      'You are not out yet. You are under pressure.',
      'Recoverable is not comfortable. It is still recoverable.',
    ],
    callbacks: [
      'You survived the last collapse because you kept moving.',
      'You already know what shame sounds like. Do not let it drive.',
      'This is not your first dark board. Use that.',
    ],
    witness: [
      'The room thinks this is over. Rooms are often early.',
      'Pain landed. Finality has not.',
    ],
    ambient: [
      'There is still a recoverable line.',
      'You can still take the next clean breath.',
    ],
    postrun: [
      'Turning point: when endurance became more useful than argument.',
    ],
  },
  FLOOR_RUNNER: {
    ambient: [
      'The room can smell the break forming.',
      'The crowd moved before the scoreboard explained why.',
      'Buzz just changed temperature.',
      'That reaction was faster than the numbers.',
      'The floor is already trading the story.',
      'Public pressure just found a voice.',
    ],
    witness: [
      'The room saw it.',
      'Crowd note: that landed publicly.',
      'Everyone in the lane felt that shift.',
    ],
    callbacks: [
      'Lobby memory already clipped that moment.',
      'That line will come back later.',
    ],
    postrun: [
      'Post-run note: public mood moved before the final state settled.',
    ],
  },
});

// ============================================================================
// MARK: Registry construction
// ============================================================================

function buildRuntimePresentation(sharedKey: ChatKnownNpcKey, descriptor: ChatAnyNpcDescriptor): BackendPersonaRuntimePresentation {
  const defaults = createDefaultRuntimePresentation(sharedKey, descriptor);
  const override = RUNTIME_OVERRIDES[sharedKey];
  if (!override) return defaults;
  return Object.freeze({
    runtimePersonaId: override.runtimePersonaId ?? defaults.runtimePersonaId,
    runtimeActorId: override.runtimeActorId ?? defaults.runtimeActorId,
    runtimeDisplayName: override.runtimeDisplayName ?? defaults.runtimeDisplayName,
    runtimeBotId: override.runtimeBotId ?? defaults.runtimeBotId,
    aliasKeys: Object.freeze(uniqueLines([...(override.aliasKeys ?? []), ...defaults.aliasKeys])),
  });
}

function buildLineBank(sharedKey: ChatKnownNpcKey, descriptor: ChatAnyNpcDescriptor): BackendPersonaLineBank {
  const base = buildDefaultLineBank(descriptor);
  const overrides = LEGACY_RUNTIME_CORPORA[sharedKey] ?? {};
  return ensureLineBank({
    telegraphs: [...base.telegraphs, ...(overrides.telegraphs ?? [])],
    taunts: [...base.taunts, ...(overrides.taunts ?? [])],
    retreats: [...base.retreats, ...(overrides.retreats ?? [])],
    rescues: [...base.rescues, ...(overrides.rescues ?? [])],
    ambient: [...base.ambient, ...(overrides.ambient ?? [])],
    witness: [...base.witness, ...(overrides.witness ?? [])],
    callbacks: [...base.callbacks, ...(overrides.callbacks ?? [])],
    postrun: [...base.postrun, ...(overrides.postrun ?? [])],
  });
}

function buildEvolutionSeed(sharedKey: ChatKnownNpcKey, descriptor: ChatAnyNpcDescriptor): ChatPersonaEvolutionProfile {
  const now = Date.UTC(2026, 2, 19);
  const seed = buildDefaultPersonaEvolutionProfile(descriptor.personaId, now, null);
  const lineBank = buildLineBank(sharedKey, descriptor);
  const meaningfulEvents =
    lineBank.callbacks.length +
    lineBank.postrun.length +
    lineBank.witness.length +
    (descriptor.npcClass === 'HATER' ? 24 : descriptor.npcClass === 'HELPER' ? 16 : 10);
  const careerRuns = descriptor.npcClass === 'HATER'
    ? 18
    : descriptor.npcClass === 'HELPER'
      ? 12
      : 8;
  const stage = resolvePersonaStage(careerRuns, meaningfulEvents);

  return {
    ...seed,
    botId: descriptor.personaId,
    stage,
    careerRuns,
    meaningfulEvents,
    callbackUsageCount: lineBank.callbacks.length,
    collapseWitnessCount: lineBank.witness.length,
    comebackWitnessCount: Math.max(1, Math.floor(lineBank.postrun.length / 2)),
    vector: {
      ...seed.vector,
      callbackAggression01: clampEvolution01(
        seed.vector.callbackAggression01 + (descriptor.npcClass === 'HATER' ? 0.22 : descriptor.npcClass === 'HELPER' ? 0.04 : 0.08),
      ),
      playerSpecificity01: clampEvolution01(seed.vector.playerSpecificity01 + lineBank.callbacks.length * 0.03),
      vocabularyWidening01: clampEvolution01(seed.vector.vocabularyWidening01 + lineBank.ambient.length * 0.01),
      prophecyCadence01: clampEvolution01(seed.vector.prophecyCadence01 + lineBank.postrun.length * 0.02),
    },
    activeTransformBiases: descriptor.npcClass === 'HATER'
      ? ['SHORTER_COLDER', 'MORE_DIRECT', 'CALLBACK_REWRITE']
      : descriptor.npcClass === 'HELPER'
        ? ['MORE_INTIMATE', 'PERSONAL_HISTORY_REWRITE']
        : ['MORE_PUBLIC', 'MORE_POST_EVENT'],
    temperament: descriptor.npcClass === 'HATER'
      ? 'PREDATORY'
      : descriptor.npcClass === 'HELPER'
        ? 'ADMIRING'
        : 'CEREMONIAL',
  };
}

function buildEntry(sharedKey: ChatKnownNpcKey, descriptor: ChatAnyNpcDescriptor): BackendPersonaRegistryEntry {
  const runtime = buildRuntimePresentation(sharedKey, descriptor);
  const lineBank = buildLineBank(sharedKey, descriptor);
  const selectionWeights = createDefaultSelectionWeights(descriptor);
  const evolutionSeed = buildEvolutionSeed(sharedKey, descriptor);
  return Object.freeze({
    sharedKey,
    descriptor,
    runtime,
    lineBank,
    selectionWeights,
    preferredRoomMoods: createDefaultPreferredMoods(descriptor),
    preferredPressureBands: createDefaultPreferredPressureBands(descriptor),
    typingAssignments: deriveTypingAssignments(descriptor),
    evolutionSeed,
    canonicalTags: Object.freeze(uniqueLines([
      descriptor.npcClass,
      sharedKey,
      runtime.runtimeDisplayName,
      ...runtime.aliasKeys,
      ...CHAT_NPC_VOICEPRINTS[sharedKey].lexiconTags,
    ])),
  });
}

const ALL_SHARED_KEYS: readonly ChatKnownNpcKey[] = Object.freeze([
  ...CHAT_HATER_NPC_KEYS,
  ...CHAT_HELPER_NPC_KEYS,
  ...CHAT_AMBIENT_NPC_KEYS,
]);

export const BACKEND_PERSONA_REGISTRY_VERSION = '2026.03.19.persona.registry.v1' as const;

export const BACKEND_PERSONA_REGISTRY: Readonly<Record<ChatKnownNpcKey, BackendPersonaRegistryEntry>> = Object.freeze(
  ALL_SHARED_KEYS.reduce<Record<ChatKnownNpcKey, BackendPersonaRegistryEntry>>((accumulator, key) => {
    accumulator[key] = buildEntry(key, CHAT_ALL_NPC_DESCRIPTORS[key]);
    return accumulator;
  }, {} as Record<ChatKnownNpcKey, BackendPersonaRegistryEntry>),
);

const ALIAS_LOOKUP: Readonly<Record<string, ChatKnownNpcKey>> = Object.freeze(
  Object.values(BACKEND_PERSONA_REGISTRY).reduce<Record<string, ChatKnownNpcKey>>((accumulator, entry) => {
    accumulator[String(entry.sharedKey).toLowerCase()] = entry.sharedKey;
    accumulator[entry.runtime.runtimePersonaId.toLowerCase()] = entry.sharedKey;
    accumulator[entry.runtime.runtimeActorId.toLowerCase()] = entry.sharedKey;
    if (entry.runtime.runtimeBotId) {
      accumulator[entry.runtime.runtimeBotId.toLowerCase()] = entry.sharedKey;
    }
    for (const alias of entry.runtime.aliasKeys) {
      accumulator[alias.toLowerCase()] = entry.sharedKey;
    }
    return accumulator;
  }, {}),
);

// ============================================================================
// MARK: Public lookup API
// ============================================================================

export function listPersonaEntries(): readonly BackendPersonaRegistryEntry[] {
  return Object.values(BACKEND_PERSONA_REGISTRY);
}

export function listPersonaKeys(): readonly ChatKnownNpcKey[] {
  return ALL_SHARED_KEYS;
}

export function getPersonaEntry(sharedKey: ChatKnownNpcKey): BackendPersonaRegistryEntry {
  return BACKEND_PERSONA_REGISTRY[sharedKey];
}

export function resolvePersonaLookup(identity: string): BackendPersonaLookupResult | null {
  const normalized = identity.trim().toLowerCase();
  if (!normalized) return null;
  const sharedKey = ALIAS_LOOKUP[normalized];
  if (!sharedKey) return null;
  const entry = BACKEND_PERSONA_REGISTRY[sharedKey];
  if (normalized === String(sharedKey).toLowerCase()) {
    return { entry, matchedBy: 'sharedKey' };
  }
  if (normalized === entry.runtime.runtimePersonaId.toLowerCase()) {
    return { entry, matchedBy: 'runtimePersonaId' };
  }
  if (normalized === entry.runtime.runtimeActorId.toLowerCase()) {
    return { entry, matchedBy: 'runtimeActorId' };
  }
  if (entry.runtime.runtimeBotId && normalized === entry.runtime.runtimeBotId.toLowerCase()) {
    return { entry, matchedBy: 'runtimeBotId' };
  }
  return { entry, matchedBy: 'aliasKey' };
}

export function resolvePersonaEntry(identity: string | ChatKnownNpcKey): BackendPersonaRegistryEntry | null {
  if (typeof identity === 'string' && identity in BACKEND_PERSONA_REGISTRY) {
    return BACKEND_PERSONA_REGISTRY[identity as ChatKnownNpcKey];
  }
  return resolvePersonaLookup(String(identity))?.entry ?? null;
}

export function getPersonaByRuntimePersonaId(runtimePersonaId: string): BackendPersonaRegistryEntry | null {
  return resolvePersonaLookup(runtimePersonaId)?.entry ?? null;
}

export function getPersonaByRuntimeActorId(runtimeActorId: string): BackendPersonaRegistryEntry | null {
  return resolvePersonaLookup(runtimeActorId)?.entry ?? null;
}

export function getPersonaByBotId(botId: string): BackendPersonaRegistryEntry | null {
  return resolvePersonaLookup(botId)?.entry ?? null;
}

// ============================================================================
// MARK: Candidate ordering
// ============================================================================

function scoreEntryForContext(entry: BackendPersonaRegistryEntry, context: BackendPersonaSelectionContext): number {
  const roomMood = context.roomMood ?? null;
  const pressureBand = context.pressureBand ?? null;
  const embarrassment01 = clamp01(context.embarrassment01);
  const desperation01 = clamp01(context.desperation01);
  const confidence01 = clamp01(context.confidence01);
  const callbackDemand01 = clamp01(context.callbackDemand01);
  const negotiationDemand01 = clamp01(context.negotiationDemand01);

  let score = 0.2;

  if (roomMood && entry.preferredRoomMoods.includes(roomMood)) score += 0.28;
  if (pressureBand && entry.preferredPressureBands.includes(pressureBand)) score += 0.18;

  if (entry.descriptor.npcClass === 'HATER') {
    score += entry.selectionWeights.publicPressure01 * 0.20;
    score += callbackDemand01 * entry.selectionWeights.callbackBias01 * 0.22;
    score += negotiationDemand01 * entry.selectionWeights.negotiationBias01 * 0.18;
    score += confidence01 * 0.12;
    score += (1 - embarrassment01) * 0.08;
  } else if (entry.descriptor.npcClass === 'HELPER') {
    score += entry.selectionWeights.rescueBias01 * 0.24;
    score += embarrassment01 * 0.18;
    score += desperation01 * 0.20;
    score += (1 - confidence01) * 0.12;
    score += callbackDemand01 * 0.08;
  } else {
    score += entry.selectionWeights.witnessBias01 * 0.18;
    score += callbackDemand01 * 0.06;
    score += negotiationDemand01 * 0.10;
  }

  return Number(score.toFixed(6));
}

export function rankPersonaEntries(
  entries: readonly BackendPersonaRegistryEntry[],
  context: BackendPersonaSelectionContext,
): readonly BackendPersonaRegistryEntry[] {
  return [...entries]
    .map((entry) => ({ entry, score: scoreEntryForContext(entry, context) }))
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.entry.sharedKey.localeCompare(right.entry.sharedKey);
    })
    .map((item) => item.entry);
}

export function listHelperCandidates(context: BackendPersonaSelectionContext = {}): readonly BackendPersonaRegistryEntry[] {
  const helpers = Object.values(BACKEND_PERSONA_REGISTRY).filter((entry) => entry.descriptor.npcClass === 'HELPER');
  return rankPersonaEntries(helpers, context);
}

export function listHaterCandidates(context: BackendPersonaSelectionContext = {}): readonly BackendPersonaRegistryEntry[] {
  const haters = Object.values(BACKEND_PERSONA_REGISTRY).filter((entry) => entry.descriptor.npcClass === 'HATER');
  return rankPersonaEntries(haters, context);
}

export function listAmbientCandidates(context: BackendPersonaSelectionContext = {}): readonly BackendPersonaRegistryEntry[] {
  const ambient = Object.values(BACKEND_PERSONA_REGISTRY).filter((entry) => entry.descriptor.npcClass === 'AMBIENT');
  return rankPersonaEntries(ambient, context);
}

// ============================================================================
// MARK: Line-bank access
// ============================================================================

export function getPersonaLineBank(identity: string | ChatKnownNpcKey): BackendPersonaLineBank | null {
  return resolvePersonaEntry(identity)?.lineBank ?? null;
}

export function getPersonaLineCategory(
  identity: string | ChatKnownNpcKey,
  category: BackendPersonaLineCategory,
): readonly string[] {
  const entry = resolvePersonaEntry(identity);
  if (!entry) return [];
  return entry.lineBank[category];
}

export function pickPersonaLine(
  identity: string | ChatKnownNpcKey,
  category: BackendPersonaLineCategory,
  seed: string,
): string | null {
  const lines = getPersonaLineCategory(identity, category);
  return pickDeterministic(lines, `${String(identity)}|${category}|${seed}`);
}

// ============================================================================
// MARK: Snapshot, bundles, and convenience exports
// ============================================================================

export function buildPersonaRegistrySnapshot(now: number = Date.now()): BackendPersonaRegistrySnapshot {
  const entries = Object.values(BACKEND_PERSONA_REGISTRY);
  return Object.freeze({
    version: BACKEND_PERSONA_REGISTRY_VERSION,
    createdAt: now,
    totalPersonas: entries.length,
    haterCount: entries.filter((entry) => entry.descriptor.npcClass === 'HATER').length,
    helperCount: entries.filter((entry) => entry.descriptor.npcClass === 'HELPER').length,
    ambientCount: entries.filter((entry) => entry.descriptor.npcClass === 'AMBIENT').length,
    aliasCount: entries.reduce((sum, entry) => sum + entry.runtime.aliasKeys.length, 0),
    liveBotBindings: entries
      .map((entry) => entry.runtime.runtimeBotId)
      .filter((value): value is string => Boolean(value)),
  });
}

export const PERSONA_REGISTRY_PUBLIC_SURFACE = Object.freeze({
  version: BACKEND_PERSONA_REGISTRY_VERSION,
  registry: BACKEND_PERSONA_REGISTRY,
  listPersonaEntries,
  listPersonaKeys,
  getPersonaEntry,
  resolvePersonaLookup,
  resolvePersonaEntry,
  getPersonaByRuntimePersonaId,
  getPersonaByRuntimeActorId,
  getPersonaByBotId,
  listHelperCandidates,
  listHaterCandidates,
  listAmbientCandidates,
  getPersonaLineBank,
  getPersonaLineCategory,
  pickPersonaLine,
  buildPersonaRegistrySnapshot,
});
