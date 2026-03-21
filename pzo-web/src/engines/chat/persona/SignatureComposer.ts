/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND PERSONA SIGNATURE COMPOSER
 * FILE: pzo-web/src/engines/chat/persona/SignatureComposer.ts
 * VERSION: 2026.03.19
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Frontend-authored but shared-contract-driven signature composition for the
 * social-pressure chat runtime.
 *
 * This file is deliberately not a generic string decorator. It exists to solve
 * a repo-specific gap that is already visible in the current codebase:
 *
 * 1. shared/contracts/chat/ChatNpc.ts now owns long-term voiceprint law,
 * 2. backend/src/game/engine/chat/ChatEngine.ts still composes lines with a
 *    very thin opener/body/closer stitcher,
 * 3. pzo-web/src/engines/chat/types.ts still expects a frontend-friendly
 *    persona/voiceprint adapter surface,
 * 4. the run now wants pressure-aware, callback-aware, relationship-aware, and
 *    crowd-aware language shaping without turning the frontend into a second
 *    source of authored dialogue truth.
 *
 * Design laws
 * -----------
 * - Do not author canonical lines here.
 * - Do not replace backend authority.
 * - Do not flatten shared voiceprint law into a generic chat template.
 * - Do adapt shared voiceprint and persona-evolution signals into render-safe,
 *   latency-aware, presentation-stable output.
 * - Do preserve repo-specific runtime needs: pressure, mood, callback beats,
 *   rescue timing, ambient witness style, and the emotional operating system.
 *
 * Authority roots honored
 * -----------------------
 * - /shared/contracts/chat
 * - /pzo-web/src/engines/chat
 * - /pzo-web/src/components/chat
 * - /backend/src/game/engine/chat
 * - /pzo-server/src/chat
 * ============================================================================
 */

import type {
  ChatAnyNpcDescriptor,
  ChatKnownNpcKey,
  ChatNpcClass,
  ChatNpcVoiceprint,
} from '../../../../../shared/contracts/chat/ChatNpc';
import {
  CHAT_ALL_NPC_DESCRIPTORS,
  CHAT_NPC_VOICEPRINTS,
} from '../../../../../shared/contracts/chat/ChatNpc';
import type { ChatCallbackCandidate } from '../../../../../shared/contracts/chat/ChatCallback';
import type { ChatQuoteSelectionCandidate } from '../../../../../shared/contracts/chat/ChatQuote';
import type {
  ChatPersonaEvolutionSignal,
  ChatPersonaTemperament,
  ChatPersonaTransformBias,
} from '../../../../../shared/contracts/chat/persona-evolution';
import { clamp01 as clampShared01 } from '../../../../../shared/contracts/chat/persona-evolution';
import type {
  ChatAudienceHeat as FrontendChatAudienceHeat,
  ChatChannelId,
  ChatChannelMood as FrontendChatChannelMood,
  ChatNpcDescriptor as FrontendChatNpcDescriptor,
  ChatPersonaTemperature,
  ChatPersonaVoiceprint as FrontendChatPersonaVoiceprint,
  ChatReputationState as FrontendChatReputationState,
  ChatVisibleChannel,
  JsonObject,
  Score01,
  Score100,
  UnixMs,
} from '../types';

// ============================================================================
// MARK: Public composition contracts
// ============================================================================

export type SignatureComposerNarrativeIntent =
  | 'TAUNT'
  | 'TELEGRAPH'
  | 'RETREAT'
  | 'RESCUE'
  | 'WITNESS'
  | 'NEGOTIATE'
  | 'REVEAL'
  | 'DEBRIEF'
  | 'LEGEND'
  | 'SYSTEM_PROXY';

export type SignatureComposerPhase =
  | 'PREP'
  | 'LIVE'
  | 'FOLLOW_THROUGH'
  | 'POST_EVENT'
  | 'POST_RUN';

export type SignatureComposerAudiencePressure =
  | 'LOW'
  | 'RISING'
  | 'HIGH'
  | 'PEAK';

export interface SignatureComposerRelationshipSnapshot {
  readonly respect01?: number;
  readonly fear01?: number;
  readonly contempt01?: number;
  readonly fascination01?: number;
  readonly trust01?: number;
  readonly rivalry01?: number;
  readonly rescueDebt01?: number;
  readonly familiarity01?: number;
}

export interface SignatureComposerInput {
  readonly npcKey?: ChatKnownNpcKey;
  readonly descriptor?: ChatAnyNpcDescriptor;
  readonly body: string;
  readonly channelId?: ChatChannelId;
  readonly visibleChannelId?: ChatVisibleChannel;
  readonly narrativeIntent?: SignatureComposerNarrativeIntent;
  readonly phase?: SignatureComposerPhase;
  readonly momentType?: string;
  readonly now?: UnixMs;
  readonly audienceHeat?: FrontendChatAudienceHeat | null;
  readonly channelMood?: FrontendChatChannelMood | null;
  readonly reputation?: FrontendChatReputationState | null;
  readonly callbackCandidate?: ChatCallbackCandidate | null;
  readonly quoteCandidate?: ChatQuoteSelectionCandidate | null;
  readonly evolutionSignal?: ChatPersonaEvolutionSignal | null;
  readonly relationship?: SignatureComposerRelationshipSnapshot | null;
  readonly pressureScore100?: number | null;
  readonly confidenceScore100?: number | null;
  readonly embarrassmentScore100?: number | null;
  readonly desperationScore100?: number | null;
  readonly trustScore100?: number | null;
  readonly forceLowercase?: boolean;
  readonly forceNoSignature?: boolean;
  readonly allowLexiconInjection?: boolean;
  readonly allowIntentRewrite?: boolean;
  readonly metadata?: JsonObject;
}

export interface SignatureComposerDelayWindow {
  readonly floorMs: number;
  readonly ceilMs: number;
  readonly recommendedMs: number;
  readonly varianceMs: number;
}

export interface SignatureComposerRewriteFlags {
  readonly expandedForCeremony: boolean;
  readonly compressedForPressure: boolean;
  readonly sharpenedForHostility: boolean;
  readonly softenedForRescue: boolean;
  readonly callbackTinted: boolean;
  readonly quoteTinted: boolean;
  readonly lexiconInjected: boolean;
  readonly loweredCase: boolean;
  readonly openerSuppressed: boolean;
  readonly closerSuppressed: boolean;
}

export interface SignatureComposerOutput {
  readonly npcKey: ChatKnownNpcKey;
  readonly npcClass: ChatNpcClass;
  readonly personaId: string;
  readonly displayName: string;
  readonly opener: string;
  readonly body: string;
  readonly closer: string;
  readonly fullText: string;
  readonly frontendVoiceprint: FrontendChatPersonaVoiceprint;
  readonly frontendDescriptor: FrontendChatNpcDescriptor;
  readonly delayWindow: SignatureComposerDelayWindow;
  readonly flags: SignatureComposerRewriteFlags;
  readonly tags: readonly string[];
  readonly debug: {
    readonly audiencePressure: SignatureComposerAudiencePressure;
    readonly hostilty01: number;
    readonly rescueSoftness01: number;
    readonly callbackPressure01: number;
    readonly relationshipPull01: number;
    readonly evolutionHeat01: number;
    readonly transformBiases: readonly ChatPersonaTransformBias[];
    readonly temperature: ChatPersonaTemperature;
  };
}

export interface SignatureComposerPolicy {
  readonly openerWeight01: number;
  readonly closerWeight01: number;
  readonly callbackWeight01: number;
  readonly quoteWeight01: number;
  readonly rescueSofteningWeight01: number;
  readonly publicPressureSharpenWeight01: number;
  readonly ritualExpansionWeight01: number;
  readonly maxLexiconInsertions: number;
  readonly maxCompressionPasses: number;
  readonly maxExpansionPasses: number;
}

// ============================================================================
// MARK: Policy defaults
// ============================================================================

export const DEFAULT_SIGNATURE_COMPOSER_POLICY: SignatureComposerPolicy = Object.freeze({
  openerWeight01: 0.78,
  closerWeight01: 0.82,
  callbackWeight01: 0.76,
  quoteWeight01: 0.64,
  rescueSofteningWeight01: 0.88,
  publicPressureSharpenWeight01: 0.91,
  ritualExpansionWeight01: 0.72,
  maxLexiconInsertions: 2,
  maxCompressionPasses: 3,
  maxExpansionPasses: 2,
});

const CLASS_TEMPERATURE_DEFAULTS: Readonly<Record<ChatNpcClass, ChatPersonaTemperature>> = Object.freeze({
  HATER: 'COLD',
  HELPER: 'WARM',
  AMBIENT: 'CONTROLLED',
  LIVEOPS: 'VOLCANIC',
  SYSTEM_PROXY: 'CONTROLLED',
});

const PUNCTUATION_ENDINGS: readonly string[] = ['.', '!', '?', '…'];

const CONTRACTION_REWRITES: ReadonlyArray<readonly [RegExp, string]> = Object.freeze([
  [/\bdo not\b/gi, "don't"],
  [/\bcannot\b/gi, "can't"],
  [/\bwill not\b/gi, "won't"],
  [/\bit is\b/gi, "it's"],
]);

const PRESSURE_SHARPEN_REWRITES: ReadonlyArray<readonly [RegExp, string]> = Object.freeze([
  [/\bvery\s+/gi, ''],
  [/\breally\s+/gi, ''],
  [/\bperhaps\b/gi, 'maybe'],
  [/\bI think\b/gi, 'I know'],
  [/\byou should\b/gi, 'you need to'],
]);

const RESCUE_SOFTEN_REWRITES: ReadonlyArray<readonly [RegExp, string]> = Object.freeze([
  [/\byou need to\b/gi, 'take'],
  [/\byou must\b/gi, 'try to'],
  [/\bright now\b/gi, 'next'],
  [/\bimmediately\b/gi, 'cleanly'],
]);

const CEREMONIAL_EXPANSIONS: ReadonlyArray<readonly [RegExp, string]> = Object.freeze([
  [/\bwon\b/gi, 'secured the turn'],
  [/\blost\b/gi, 'took the hit'],
  [/\bproved it\b/gi, 'proved it in public'],
  [/\bthe room\b/gi, 'the room and its memory'],
]);

const CALLBACK_PREFIXES: readonly string[] = Object.freeze([
  'Earlier, you said',
  'You already claimed',
  'Publicly, you said',
  'A few moves ago, you said',
]);

const WITNESS_PREFIXES: readonly string[] = Object.freeze([
  'The room saw it.',
  'That landed publicly.',
  'Everyone in the channel felt that.',
  'That did not happen in private.',
]);

const RESCUE_PREFIXES: readonly string[] = Object.freeze([
  'Stay with the next move.',
  'Keep it small.',
  'Breathe, then move.',
  'One clean action.',
]);

const LEXICON_FALLBACKS: Readonly<Record<ChatNpcClass, readonly string[]>> = Object.freeze({
  HATER: ['pressure', 'window', 'fragility', 'readability'],
  HELPER: ['anchor', 'sequence', 'breath', 'clean line'],
  AMBIENT: ['room', 'crowd', 'witness', 'buzz'],
  LIVEOPS: ['event', 'surge', 'world', 'interval'],
  SYSTEM_PROXY: ['notice', 'state', 'transition', 'authority'],
});

// ============================================================================
// MARK: Branded-number helpers
// ============================================================================

function asScore01(value: number): Score01 {
  return clamp01(value) as Score01;
}

function asScore100(value: number): Score100 {
  return clamp100(value) as Score100;
}

function clamp01(value: number | null | undefined): number {
  if (value == null || Number.isNaN(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return Number(value.toFixed(6));
}

function clamp100(value: number | null | undefined): number {
  if (value == null || Number.isNaN(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 100) return 100;
  return Number(value.toFixed(3));
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function uniqueStrings(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(normalized);
  }
  return next;
}

function pickDeterministic<T>(values: readonly T[], seed: string): T | null {
  if (!values.length) return null;
  const index = positiveHash(seed) % values.length;
  return values[index] ?? null;
}

function positiveHash(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, ' ').replace(/\s+([,.;!?…])/g, '$1').trim();
}

function ensureTerminalPunctuation(input: string, style: ChatNpcVoiceprint['punctuationStyle']): string {
  const trimmed = input.trim();
  if (!trimmed) return trimmed;
  if (PUNCTUATION_ENDINGS.some((ending) => trimmed.endsWith(ending))) return trimmed;
  switch (style) {
    case 'ELLIPTICAL':
      return `${trimmed}…`;
    case 'SHARP':
      return `${trimmed}.`;
    case 'FORMAL':
      return `${trimmed}.`;
    case 'LOUD':
      return `${trimmed}!`;
    case 'SPARSE':
    default:
      return `${trimmed}.`;
  }
}

function sentenceSplit(input: string): string[] {
  return normalizeWhitespace(input)
    .split(/(?<=[.!?…])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function compressSentences(input: string, passes: number): string {
  let output = input;
  for (let pass = 0; pass < passes; pass += 1) {
    output = output
      .replace(/\bthat\s+is\b/gi, "that's")
      .replace(/\byou\s+are\b/gi, "you're")
      .replace(/\bit\s+is\b/gi, "it's")
      .replace(/\s{2,}/g, ' ');
    for (const [pattern, replacement] of CONTRACTION_REWRITES) {
      output = output.replace(pattern, replacement);
    }
    output = output.replace(/\bjust\b/gi, '').replace(/\s{2,}/g, ' ').trim();
  }
  return normalizeWhitespace(output);
}

function expandSentences(input: string, passes: number): string {
  let output = input;
  for (let pass = 0; pass < passes; pass += 1) {
    for (const [pattern, replacement] of CEREMONIAL_EXPANSIONS) {
      output = output.replace(pattern, replacement);
    }
    output = normalizeWhitespace(output);
  }
  return output;
}

function rewriteForPressure(input: string): string {
  let output = input;
  for (const [pattern, replacement] of PRESSURE_SHARPEN_REWRITES) {
    output = output.replace(pattern, replacement);
  }
  return normalizeWhitespace(output);
}

function rewriteForRescue(input: string): string {
  let output = input;
  for (const [pattern, replacement] of RESCUE_SOFTEN_REWRITES) {
    output = output.replace(pattern, replacement);
  }
  return normalizeWhitespace(output);
}

function maybeLowercase(input: string, force: boolean): string {
  if (!force) return input;
  return input.toLowerCase();
}

function injectLexicon(
  baseBody: string,
  lexicon: readonly string[],
  injectionCount: number,
  seed: string,
): { readonly text: string; readonly injected: readonly string[] } {
  if (injectionCount <= 0 || lexicon.length === 0) {
    return { text: baseBody, injected: [] };
  }

  const injected: string[] = [];
  let text = baseBody;
  const uniqueLexicon = uniqueStrings(lexicon);

  for (let index = 0; index < Math.min(injectionCount, uniqueLexicon.length); index += 1) {
    const pick = pickDeterministic(uniqueLexicon, `${seed}:${index}`);
    if (!pick) continue;
    const lowered = text.toLowerCase();
    if (lowered.includes(pick.toLowerCase())) continue;
    injected.push(pick);

    if (/[,.;!?…]$/.test(text.trim())) {
      text = `${text.trim()} ${pick}.`;
    } else {
      text = `${text.trim()} ${pick}`;
    }
  }

  return { text: normalizeWhitespace(text), injected };
}

function deriveAudiencePressure(
  heat: FrontendChatAudienceHeat | null | undefined,
  mood: FrontendChatChannelMood | null | undefined,
): SignatureComposerAudiencePressure {
  const heatScore = Number((heat as FrontendChatAudienceHeat | undefined)?.heat ?? 0);
  const volatility = Number((heat as FrontendChatAudienceHeat | undefined)?.volatility ?? 0);
  const moodName = mood?.mood ?? 'CALM';
  const scalar = average([heatScore, volatility]);

  if (scalar >= 78 || moodName === 'PREDATORY' || moodName === 'HOSTILE') return 'PEAK';
  if (scalar >= 58) return 'HIGH';
  if (scalar >= 28 || moodName === 'SUSPICIOUS') return 'RISING';
  return 'LOW';
}

function deriveHostility01(
  descriptor: ChatAnyNpcDescriptor,
  mood: FrontendChatChannelMood | null | undefined,
  heat: FrontendChatAudienceHeat | null | undefined,
): number {
  const classBias = descriptor.npcClass === 'HATER'
    ? 0.82
    : descriptor.npcClass === 'AMBIENT'
      ? 0.34
      : 0.12;
  const moodBias = mood?.mood === 'HOSTILE'
    ? 0.82
    : mood?.mood === 'PREDATORY'
      ? 0.94
      : mood?.mood === 'SUSPICIOUS'
        ? 0.46
        : 0.18;
  const heatBias = Number(heat?.heat ?? 0) / 100;
  return clamp01(average([classBias, moodBias, heatBias]));
}

function deriveRescueSoftness01(
  descriptor: ChatAnyNpcDescriptor,
  confidenceScore100: number,
  embarrassmentScore100: number,
  desperationScore100: number,
): number {
  const classBias = descriptor.npcClass === 'HELPER' ? 0.76 : 0.08;
  const distress = average([
    clamp01(embarrassmentScore100 / 100),
    clamp01(desperationScore100 / 100),
    clamp01(1 - confidenceScore100 / 100),
  ]);
  return clamp01(average([classBias, distress]));
}

function deriveCallbackPressure01(candidate: ChatCallbackCandidate | null | undefined): number {
  if (!candidate) return 0;
  return clamp01(average([
    Number(candidate.score01 ?? 0),
    Number(candidate.confidence01 ?? 0),
    candidate.callbackKind === 'QUOTE' || candidate.callbackKind === 'RELATIONSHIP' ? 0.72 : 0.44,
  ]));
}

function deriveRelationshipPull01(
  relationship: SignatureComposerRelationshipSnapshot | null | undefined,
): number {
  if (!relationship) return 0;
  return clamp01(average([
    relationship.respect01 ?? 0,
    relationship.fascination01 ?? 0,
    relationship.trust01 ?? 0,
    relationship.rivalry01 ?? 0,
    relationship.familiarity01 ?? 0,
  ]));
}

function deriveEvolutionHeat01(signal: ChatPersonaEvolutionSignal | null | undefined): number {
  if (!signal) return 0;
  return clamp01(average([
    Number(signal.callbackAggression01 ?? 0),
    Number(signal.playerSpecificity01 ?? 0),
    Number(signal.seasonalAbsorption01 ?? 0),
    Number(signal.prophecyCadence01 ?? 0),
  ]));
}

function mapSharedVoiceprintToFrontend(
  descriptor: ChatAnyNpcDescriptor,
  voiceprint: ChatNpcVoiceprint,
  evolutionSignal: ChatPersonaEvolutionSignal | null | undefined,
  hostility01: number,
  rescueSoftness01: number,
): FrontendChatPersonaVoiceprint {
  const interruptionStyle = voiceprint.interruptionStyle === 'SURGE'
    ? 'CUTTING'
    : voiceprint.interruptionStyle;

  const emotionalTemperature = resolveFrontendTemperature(
    descriptor.npcClass,
    evolutionSignal?.temperament,
    hostility01,
    rescueSoftness01,
  );

  return {
    personaId: voiceprint.personaId,
    punctuationStyle:
      voiceprint.punctuationStyle === 'LOUD'
        ? 'SHARP'
        : voiceprint.punctuationStyle,
    averageSentenceLength: voiceprint.averageSentenceLength,
    emotionalTemperature,
    delayProfileMs: [...voiceprint.delayProfileMs] as readonly [number, number],
    interruptionStyle,
    signatureOpeners: [...voiceprint.signatureOpeners],
    signatureClosers: [...voiceprint.signatureClosers],
    lexiconTags: [...voiceprint.lexiconTags],
    prefersLowercase: voiceprint.prefersLowercase,
    prefersSparseEmoji: voiceprint.prefersSparseEmoji,
  };
}

function resolveFrontendTemperature(
  npcClass: ChatNpcClass,
  temperament: ChatPersonaTemperament | undefined,
  hostility01: number,
  rescueSoftness01: number,
): ChatPersonaTemperature {
  if (temperament === 'CEREMONIAL') return 'CONTROLLED';
  if (temperament === 'ADMIRING') return 'WARM';
  if (temperament === 'HUNTING') return 'VOLCANIC';
  if (temperament === 'PREDATORY') return hostility01 >= 0.8 ? 'VOLCANIC' : 'COLD';
  if (npcClass === 'HELPER') return rescueSoftness01 >= 0.68 ? 'WARM' : 'CONTROLLED';
  return CLASS_TEMPERATURE_DEFAULTS[npcClass];
}

function adaptDescriptorToFrontend(descriptor: ChatAnyNpcDescriptor): FrontendChatNpcDescriptor {
  return {
    npcId: descriptor.npcId,
    actorKind: descriptor.actorKind,
    displayName: descriptor.displayName,
    personaId: descriptor.personaId,
    cadenceFloorMs: descriptor.cadence.floorMs,
    cadenceCeilMs: descriptor.cadence.ceilMs,
    enabledChannels: [...descriptor.enabledChannels],
    coldStartBoost: descriptor.coldStartBoost,
    helperArchetype: descriptor.npcClass === 'HELPER' ? descriptor.helperArchetype : undefined,
    haterArchetype: descriptor.npcClass === 'HATER' ? descriptor.haterArchetype : undefined,
    crowdArchetype: descriptor.npcClass === 'AMBIENT' ? descriptor.crowdArchetype : undefined,
  };
}

function computeDelayWindow(
  descriptor: ChatAnyNpcDescriptor,
  voiceprint: ChatNpcVoiceprint,
  hostility01: number,
  rescueSoftness01: number,
  callbackPressure01: number,
  audiencePressure: SignatureComposerAudiencePressure,
): SignatureComposerDelayWindow {
  const [baseFloor, baseCeil] = voiceprint.delayProfileMs;
  const cadenceFloor = descriptor.cadence.floorMs;
  const cadenceCeil = descriptor.cadence.ceilMs;

  const floor = Math.max(
    120,
    Math.round((baseFloor + cadenceFloor) / 2 - hostility01 * 180 - rescueSoftness01 * 120),
  );

  const ceilScalar = audiencePressure === 'PEAK'
    ? -260
    : audiencePressure === 'HIGH'
      ? -140
      : audiencePressure === 'RISING'
        ? -60
        : 0;

  const ceil = Math.max(
    floor + 120,
    Math.round((baseCeil + cadenceCeil) / 2 + ceilScalar - callbackPressure01 * 180),
  );

  const recommendedMs = Math.round(
    floor + (ceil - floor) * clamp01(0.42 + callbackPressure01 * 0.18 + hostility01 * 0.16 - rescueSoftness01 * 0.12),
  );

  return {
    floorMs: floor,
    ceilMs: ceil,
    recommendedMs,
    varianceMs: Math.max(40, Math.round((ceil - floor) / 4)),
  };
}

function maybeChooseOpener(
  voiceprint: ChatNpcVoiceprint,
  npcClass: ChatNpcClass,
  audiencePressure: SignatureComposerAudiencePressure,
  callbackCandidate: ChatCallbackCandidate | null | undefined,
  rescueSoftness01: number,
  seed: string,
): string {
  const pool: string[] = [];

  if (callbackCandidate && (callbackCandidate.callbackKind === 'QUOTE' || callbackCandidate.callbackKind === 'RELATIONSHIP')) {
    const callbackPrefix = pickDeterministic(CALLBACK_PREFIXES, `${seed}:callback-prefix`);
    if (callbackPrefix) pool.push(callbackPrefix);
  }

  if (npcClass === 'AMBIENT' && audiencePressure !== 'LOW') {
    const witnessPrefix = pickDeterministic(WITNESS_PREFIXES, `${seed}:witness-prefix`);
    if (witnessPrefix) pool.push(witnessPrefix);
  }

  if (npcClass === 'HELPER' && rescueSoftness01 >= 0.52) {
    const rescuePrefix = pickDeterministic(RESCUE_PREFIXES, `${seed}:rescue-prefix`);
    if (rescuePrefix) pool.push(rescuePrefix);
  }

  pool.push(...voiceprint.signatureOpeners);
  return pickDeterministic(uniqueStrings(pool), `${seed}:opener`) ?? '';
}

function maybeChooseCloser(
  voiceprint: ChatNpcVoiceprint,
  descriptor: ChatAnyNpcDescriptor,
  audiencePressure: SignatureComposerAudiencePressure,
  evolutionSignal: ChatPersonaEvolutionSignal | null | undefined,
  seed: string,
): string {
  const pool: string[] = [...voiceprint.signatureClosers];

  if (descriptor.npcClass === 'AMBIENT' && audiencePressure !== 'LOW') {
    pool.push('Marked publicly.', 'The room keeps that.');
  }

  if (descriptor.npcClass === 'HELPER' && evolutionSignal?.playerSpecificity01 && Number(evolutionSignal.playerSpecificity01) > 0.55) {
    pool.push('You know this line already.', 'Use what you learned.');
  }

  if (descriptor.npcClass === 'HATER' && evolutionSignal?.callbackAggression01 && Number(evolutionSignal.callbackAggression01) > 0.48) {
    pool.push('I remember your pattern.', 'That still counts against you.');
  }

  return pickDeterministic(uniqueStrings(pool), `${seed}:closer`) ?? '';
}

function tintBodyWithCallback(
  body: string,
  candidate: ChatCallbackCandidate | null | undefined,
  quote: ChatQuoteSelectionCandidate | null | undefined,
  seed: string,
): { readonly text: string; readonly callbackTinted: boolean; readonly quoteTinted: boolean } {
  if (!candidate && !quote) {
    return { text: body, callbackTinted: false, quoteTinted: false };
  }

  let text = body;
  let callbackTinted = false;
  let quoteTinted = false;

  if (quote?.excerpt) {
    const trimmed = normalizeWhitespace(quote.excerpt.replace(/^['"]+|['"]+$/g, ''));
    if (trimmed && !text.toLowerCase().includes(trimmed.toLowerCase())) {
      const lead = candidate?.narrativeIntent === 'HUMILIATE'
        ? 'Receipt:'
        : 'Remember:';
      text = `${lead} “${trimmed}” ${text}`;
      quoteTinted = true;
    }
  }

  if (candidate?.narrativeIntent === 'FORESHADOW') {
    text = `${text} This is not where that ends.`;
    callbackTinted = true;
  } else if (candidate?.narrativeIntent === 'WITNESS') {
    text = `${text} Public memory matters.`;
    callbackTinted = true;
  } else if (candidate?.narrativeIntent === 'GUIDE') {
    text = `Use the remembered pattern. ${text}`;
    callbackTinted = true;
  }

  return {
    text: normalizeWhitespace(text),
    callbackTinted,
    quoteTinted,
  };
}

function applyTransformBiases(
  body: string,
  biases: readonly ChatPersonaTransformBias[],
  policy: SignatureComposerPolicy,
): { readonly text: string; readonly expanded: boolean; readonly compressed: boolean } {
  let text = body;
  let expanded = false;
  let compressed = false;

  if (biases.includes('SHORTER_COLDER') || biases.includes('MORE_DIRECT') || biases.includes('PRESSURE_REWRITE')) {
    text = compressSentences(text, policy.maxCompressionPasses);
    compressed = true;
  }

  if (biases.includes('LONGER_CEREMONIAL') || biases.includes('MORE_POST_EVENT') || biases.includes('PERSONAL_HISTORY_REWRITE')) {
    text = expandSentences(text, policy.maxExpansionPasses);
    expanded = true;
  }

  if (biases.includes('MORE_MOCKING')) {
    text = normalizeWhitespace(`${text} That was public.`);
  }

  if (biases.includes('MORE_INTIMATE')) {
    text = normalizeWhitespace(text.replace(/\bthe player\b/gi, 'you'));
  }

  return { text, expanded, compressed };
}

function resolveDescriptor(input: SignatureComposerInput): ChatAnyNpcDescriptor {
  if (input.descriptor) return input.descriptor;
  if (input.npcKey) return CHAT_ALL_NPC_DESCRIPTORS[input.npcKey];
  throw new Error('SignatureComposer requires either descriptor or npcKey.');
}

// ============================================================================
// MARK: SignatureComposer class
// ============================================================================

export class SignatureComposer {
  public readonly policy: SignatureComposerPolicy;

  public constructor(policy?: Partial<SignatureComposerPolicy>) {
    this.policy = Object.freeze({
      ...DEFAULT_SIGNATURE_COMPOSER_POLICY,
      ...(policy ?? {}),
    });
  }

  public compose(input: SignatureComposerInput): SignatureComposerOutput {
    const descriptor = resolveDescriptor(input);
    const voiceprint = CHAT_NPC_VOICEPRINTS[descriptor.npcKey];
    const audiencePressure = deriveAudiencePressure(input.audienceHeat, input.channelMood);
    const hostility01 = deriveHostility01(descriptor, input.channelMood, input.audienceHeat);
    const rescueSoftness01 = deriveRescueSoftness01(
      descriptor,
      Number(input.confidenceScore100 ?? 50),
      Number(input.embarrassmentScore100 ?? 0),
      Number(input.desperationScore100 ?? 0),
    );
    const callbackPressure01 = deriveCallbackPressure01(input.callbackCandidate);
    const relationshipPull01 = deriveRelationshipPull01(input.relationship);
    const evolutionHeat01 = deriveEvolutionHeat01(input.evolutionSignal);

    const seed = [
      descriptor.npcKey,
      descriptor.personaId,
      input.narrativeIntent ?? 'UNKNOWN',
      input.phase ?? 'LIVE',
      input.body,
      input.callbackCandidate?.candidateId ?? 'no-callback',
      input.quoteCandidate?.quoteId ?? 'no-quote',
      input.visibleChannelId ?? input.channelId ?? 'no-channel',
    ].join('|');

    const biases = input.evolutionSignal?.transformBiases ?? [];

    let body = normalizeWhitespace(input.body);

    if (input.allowIntentRewrite !== false) {
      if (descriptor.npcClass === 'HATER' && (audiencePressure === 'HIGH' || audiencePressure === 'PEAK')) {
        body = rewriteForPressure(body);
      }
      if (descriptor.npcClass === 'HELPER' && rescueSoftness01 >= this.policy.rescueSofteningWeight01 * 0.45) {
        body = rewriteForRescue(body);
      }
    }

    const transformResult = applyTransformBiases(body, biases, this.policy);
    body = transformResult.text;

    const callbackTint = tintBodyWithCallback(body, input.callbackCandidate, input.quoteCandidate, seed);
    body = callbackTint.text;

    const lexiconBank = uniqueStrings([
      ...voiceprint.lexiconTags,
      ...(LEXICON_FALLBACKS[descriptor.npcClass] ?? []),
    ]);

    const lexiconInsertionCount = input.allowLexiconInjection === false
      ? 0
      : callbackPressure01 >= 0.65 || relationshipPull01 >= 0.62
        ? Math.min(this.policy.maxLexiconInsertions, 2)
        : hostility01 >= 0.75 || rescueSoftness01 >= 0.60
          ? 1
          : 0;

    const lexiconResult = injectLexicon(body, lexiconBank, lexiconInsertionCount, seed);
    body = lexiconResult.text;

    const opener = input.forceNoSignature
      ? ''
      : maybeChooseOpener(
          voiceprint,
          descriptor.npcClass,
          audiencePressure,
          input.callbackCandidate,
          rescueSoftness01,
          seed,
        );

    const closer = input.forceNoSignature
      ? ''
      : maybeChooseCloser(
          voiceprint,
          descriptor,
          audiencePressure,
          input.evolutionSignal,
          seed,
        );

    const shouldLowercase = Boolean(input.forceLowercase || voiceprint.prefersLowercase);
    body = maybeLowercase(body, shouldLowercase);

    const appliedBody = ensureTerminalPunctuation(body, voiceprint.punctuationStyle);
    const appliedOpener = maybeLowercase(normalizeWhitespace(opener), shouldLowercase);
    const appliedCloser = maybeLowercase(normalizeWhitespace(closer), shouldLowercase);

    const openerAllowed = Boolean(appliedOpener) && this.policy.openerWeight01 >= 0.5 && audiencePressure !== 'PEAK';
    const closerAllowed = Boolean(appliedCloser) && this.policy.closerWeight01 >= 0.5 && !(descriptor.npcClass === 'HELPER' && rescueSoftness01 >= 0.88);

    const parts = [
      openerAllowed ? appliedOpener : '',
      appliedBody,
      closerAllowed ? appliedCloser : '',
    ].filter(Boolean);

    const fullText = normalizeWhitespace(parts.join(' '));

    const frontendVoiceprint = mapSharedVoiceprintToFrontend(
      descriptor,
      voiceprint,
      input.evolutionSignal,
      hostility01,
      rescueSoftness01,
    );

    const frontendDescriptor = adaptDescriptorToFrontend(descriptor);

    const delayWindow = computeDelayWindow(
      descriptor,
      voiceprint,
      hostility01,
      rescueSoftness01,
      callbackPressure01,
      audiencePressure,
    );

    const tags = uniqueStrings([
      descriptor.npcKey,
      descriptor.npcClass,
      input.narrativeIntent ?? 'UNSPECIFIED',
      input.phase ?? 'LIVE',
      audiencePressure,
      ...(lexiconResult.injected.map((value) => `lexicon:${value}`)),
      ...(input.callbackCandidate ? [`callback:${input.callbackCandidate.callbackKind}`] : []),
      ...(input.quoteCandidate ? [`quote:${input.quoteCandidate.toneClass}`] : []),
      ...(biases.map((bias) => `bias:${bias}`)),
    ]);

    return {
      npcKey: descriptor.npcKey,
      npcClass: descriptor.npcClass,
      personaId: descriptor.personaId,
      displayName: descriptor.displayName,
      opener: openerAllowed ? appliedOpener : '',
      body: appliedBody,
      closer: closerAllowed ? appliedCloser : '',
      fullText,
      frontendVoiceprint,
      frontendDescriptor,
      delayWindow,
      flags: {
        expandedForCeremony: transformResult.expanded,
        compressedForPressure: transformResult.compressed,
        sharpenedForHostility: hostility01 >= 0.64,
        softenedForRescue: rescueSoftness01 >= 0.48,
        callbackTinted: callbackTint.callbackTinted,
        quoteTinted: callbackTint.quoteTinted,
        lexiconInjected: lexiconResult.injected.length > 0,
        loweredCase: shouldLowercase,
        openerSuppressed: !openerAllowed && Boolean(appliedOpener),
        closerSuppressed: !closerAllowed && Boolean(appliedCloser),
      },
      tags,
      debug: {
        audiencePressure,
        hostilty01: hostility01,
        rescueSoftness01,
        callbackPressure01,
        relationshipPull01,
        evolutionHeat01,
        transformBiases: biases,
        temperature: frontendVoiceprint.emotionalTemperature,
      },
    };
  }

  public composeForKey(npcKey: ChatKnownNpcKey, body: string, partial?: Omit<SignatureComposerInput, 'npcKey' | 'body'>): SignatureComposerOutput {
    return this.compose({
      npcKey,
      body,
      ...(partial ?? {}),
    });
  }

  public toFrontendVoiceprint(
    descriptorOrKey: ChatAnyNpcDescriptor | ChatKnownNpcKey,
    evolutionSignal?: ChatPersonaEvolutionSignal | null,
    hostility01 = 0,
    rescueSoftness01 = 0,
  ): FrontendChatPersonaVoiceprint {
    const descriptor = typeof descriptorOrKey === 'string'
      ? CHAT_ALL_NPC_DESCRIPTORS[descriptorOrKey]
      : descriptorOrKey;
    return mapSharedVoiceprintToFrontend(
      descriptor,
      CHAT_NPC_VOICEPRINTS[descriptor.npcKey],
      evolutionSignal,
      hostility01,
      rescueSoftness01,
    );
  }

  public toFrontendDescriptor(descriptorOrKey: ChatAnyNpcDescriptor | ChatKnownNpcKey): FrontendChatNpcDescriptor {
    const descriptor = typeof descriptorOrKey === 'string'
      ? CHAT_ALL_NPC_DESCRIPTORS[descriptorOrKey]
      : descriptorOrKey;
    return adaptDescriptorToFrontend(descriptor);
  }

  public previewDelay(
    descriptorOrKey: ChatAnyNpcDescriptor | ChatKnownNpcKey,
    partial?: Pick<SignatureComposerInput, 'audienceHeat' | 'channelMood' | 'callbackCandidate' | 'confidenceScore100' | 'embarrassmentScore100' | 'desperationScore100'>,
  ): SignatureComposerDelayWindow {
    const descriptor = typeof descriptorOrKey === 'string'
      ? CHAT_ALL_NPC_DESCRIPTORS[descriptorOrKey]
      : descriptorOrKey;
    const hostility01 = deriveHostility01(descriptor, partial?.channelMood, partial?.audienceHeat);
    const rescueSoftness01 = deriveRescueSoftness01(
      descriptor,
      Number(partial?.confidenceScore100 ?? 50),
      Number(partial?.embarrassmentScore100 ?? 0),
      Number(partial?.desperationScore100 ?? 0),
    );
    const callbackPressure01 = deriveCallbackPressure01(partial?.callbackCandidate);
    const audiencePressure = deriveAudiencePressure(partial?.audienceHeat, partial?.channelMood);
    return computeDelayWindow(
      descriptor,
      CHAT_NPC_VOICEPRINTS[descriptor.npcKey],
      hostility01,
      rescueSoftness01,
      callbackPressure01,
      audiencePressure,
    );
  }
}

// ============================================================================
// MARK: Singleton helpers and convenience API
// ============================================================================

export const signatureComposer = new SignatureComposer();

export function composeNpcSignature(input: SignatureComposerInput): SignatureComposerOutput {
  return signatureComposer.compose(input);
}

export function composeNpcSignatureForKey(
  npcKey: ChatKnownNpcKey,
  body: string,
  partial?: Omit<SignatureComposerInput, 'npcKey' | 'body'>,
): SignatureComposerOutput {
  return signatureComposer.composeForKey(npcKey, body, partial);
}

export function resolveFrontendVoiceprint(
  descriptorOrKey: ChatAnyNpcDescriptor | ChatKnownNpcKey,
  evolutionSignal?: ChatPersonaEvolutionSignal | null,
  hostility01 = 0,
  rescueSoftness01 = 0,
): FrontendChatPersonaVoiceprint {
  return signatureComposer.toFrontendVoiceprint(
    descriptorOrKey,
    evolutionSignal,
    hostility01,
    rescueSoftness01,
  );
}

export function resolveFrontendNpcDescriptor(
  descriptorOrKey: ChatAnyNpcDescriptor | ChatKnownNpcKey,
): FrontendChatNpcDescriptor {
  return signatureComposer.toFrontendDescriptor(descriptorOrKey);
}

export function previewNpcDelayWindow(
  descriptorOrKey: ChatAnyNpcDescriptor | ChatKnownNpcKey,
  partial?: Pick<SignatureComposerInput, 'audienceHeat' | 'channelMood' | 'callbackCandidate' | 'confidenceScore100' | 'embarrassmentScore100' | 'desperationScore100'>,
): SignatureComposerDelayWindow {
  return signatureComposer.previewDelay(descriptorOrKey, partial);
}

export function makeSignatureComposerPolicy(
  partial?: Partial<SignatureComposerPolicy>,
): SignatureComposerPolicy {
  return Object.freeze({
    ...DEFAULT_SIGNATURE_COMPOSER_POLICY,
    ...(partial ?? {}),
  });
}

export const SIGNATURE_COMPOSER_PUBLIC_SURFACE = Object.freeze({
  composeNpcSignature,
  composeNpcSignatureForKey,
  resolveFrontendVoiceprint,
  resolveFrontendNpcDescriptor,
  previewNpcDelayWindow,
  makeSignatureComposerPolicy,
});
