/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT PERSONA VOICEPRINT POLICY
 * FILE: backend/src/game/engine/chat/persona/VoiceprintPolicy.ts
 * VERSION: 2026.03.19
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Backend-authoritative policy layer that turns shared persona voiceprint law
 * into deterministic runtime composition rules for authored chat output.
 *
 * This file does NOT invent persona identity.
 * This file does NOT own registry truth.
 * This file does NOT own frontend presentation.
 *
 * It exists to answer:
 * - How should a backend-selected line be shaped before it enters truth?
 * - How do punctuation, opener/closer cadence, pressure, rescue state,
 *   callback pressure, and room mood alter authored delivery?
 * - How do we preserve donor-specific persona flavor without flattening all
 *   actors into one generic response style?
 *
 * Design laws
 * -----------
 * - Shared contracts own voiceprint law.
 * - Backend registry owns persona identity and selection truth.
 * - This module owns deterministic composition policy only.
 * - No randomness without explicit seed input.
 * - No prompt-like rewriting. Shape authored lines; do not replace their soul.
 * - Rescue lines must remain clear.
 * - Hater lines may sharpen.
 * - Ambient lines may trail or witness.
 * - Helpers may compress aggression and widen reassurance.
 * ============================================================================
 */

import type {
  ChatAnyNpcDescriptor,
  ChatNpcDescriptor,
  ChatNpcEntryStyle,
  ChatNpcExitStyle,
  ChatNpcVoiceprint,
} from '../../../../../../shared/contracts/chat/ChatNpc';
import type { Score01 } from '../../../../../../shared/contracts/chat/ChatChannels';
import type {
  BackendPersonaRegistryEntry,
  BackendPersonaRoomMood,
  BackendPersonaSelectionContext,
} from './PersonaRegistry';

// ============================================================================
// MARK: Public contracts
// ============================================================================

export type BackendVoiceprintIntent =
  | 'TELEGRAPH'
  | 'TAUNT'
  | 'RETREAT'
  | 'RESCUE'
  | 'AMBIENT'
  | 'WITNESS'
  | 'CALLBACK'
  | 'POSTRUN'
  | 'NEGOTIATION'
  | 'SYSTEM_ECHO';

export type BackendVoiceprintAggressionBand =
  | 'SOFT'
  | 'TEMPERED'
  | 'SHARP'
  | 'CUTTING'
  | 'PREDATORY';

export type BackendVoiceprintClarityBand =
  | 'MINIMAL'
  | 'BALANCED'
  | 'EXPLICIT';

export interface BackendVoiceprintContext {
  readonly roomMood?: BackendPersonaRoomMood | null;
  readonly pressureBand?: string | null;
  readonly embarrassment01?: number | null;
  readonly desperation01?: number | null;
  readonly confidence01?: number | null;
  readonly callbackDemand01?: number | null;
  readonly negotiationDemand01?: number | null;
  readonly publicHeat01?: number | null;
  readonly rescueWindowOpen?: boolean | null;
  readonly playerCollapsed?: boolean | null;
  readonly playerComeback?: boolean | null;
}

export interface BackendVoiceprintPolicyInput {
  readonly entry: BackendPersonaRegistryEntry;
  readonly intent: BackendVoiceprintIntent;
  readonly sourceText: string;
  readonly context?: BackendVoiceprintContext | BackendPersonaSelectionContext | null;
  readonly seed?: string | null;
  readonly allowSignatureOpeners?: boolean;
  readonly allowSignatureClosers?: boolean;
  readonly preserveOriginalCasing?: boolean;
}

export interface BackendVoiceprintPolicyResolution {
  readonly text: string;
  readonly originalText: string;
  readonly aggressionBand: BackendVoiceprintAggressionBand;
  readonly clarityBand: BackendVoiceprintClarityBand;
  readonly preferredEntryStyle: ChatNpcEntryStyle;
  readonly preferredExitStyle: ChatNpcExitStyle;
  readonly shouldUseTypingReveal: boolean;
  readonly shouldTrailOff: boolean;
  readonly shouldLowercase: boolean;
  readonly shouldUseSparseEmoji: boolean;
  readonly openerUsed?: string;
  readonly closerUsed?: string;
  readonly transformationFlags: readonly string[];
}

export interface BackendVoiceprintRenderPreview {
  readonly primary: BackendVoiceprintPolicyResolution;
  readonly alternateSharper?: BackendVoiceprintPolicyResolution;
  readonly alternateSofter?: BackendVoiceprintPolicyResolution;
}

// ============================================================================
// MARK: Constants
// ============================================================================

const RESCUE_INTENTS: ReadonlySet<BackendVoiceprintIntent> = new Set([
  'RESCUE',
]);

const HOSTILE_INTENTS: ReadonlySet<BackendVoiceprintIntent> = new Set([
  'TELEGRAPH',
  'TAUNT',
  'CALLBACK',
  'NEGOTIATION',
]);

const REFLECTIVE_INTENTS: ReadonlySet<BackendVoiceprintIntent> = new Set([
  'RETREAT',
  'AMBIENT',
  'WITNESS',
  'POSTRUN',
  'SYSTEM_ECHO',
]);

const CLAUSE_SPLIT_REGEX = /(?<=[.!?…])\s+/g;
const MULTISPACE_REGEX = /\s+/g;
const SPACE_BEFORE_PUNCT_REGEX = /\s+([,.;!?…])/g;

// ============================================================================
// MARK: Public API
// ============================================================================

export function resolveVoiceprintPolicy(
  input: BackendVoiceprintPolicyInput,
): BackendVoiceprintPolicyResolution {
  const entry = input.entry;
  const descriptor = entry.descriptor;
  const voiceprint = descriptor.voiceprint;
  const context = normalizeContext(input.context);
  const seed = input.seed ?? buildPolicySeed(entry, input.intent, input.sourceText, context);

  const aggressionBand = resolveAggressionBand(entry, input.intent, context);
  const clarityBand = resolveClarityBand(entry, input.intent, context);

  const preferredEntryStyle = resolvePreferredEntryStyle(
    descriptor,
    input.intent,
    aggressionBand,
    context,
  );

  const preferredExitStyle = resolvePreferredExitStyle(
    descriptor,
    input.intent,
    aggressionBand,
    context,
  );

  let working = sanitizeBaseText(input.sourceText);

  const transformationFlags: string[] = [];

  if (!input.preserveOriginalCasing && shouldNormalizeLowercase(voiceprint, input.intent, context)) {
    working = applyLowercasePolicy(working, descriptor, input.intent);
    transformationFlags.push('lowercase_policy');
  }

  const openerUsed =
    input.allowSignatureOpeners === false
      ? undefined
      : selectSignatureOpener(voiceprint, input.intent, aggressionBand, seed);

  const closerUsed =
    input.allowSignatureClosers === false
      ? undefined
      : selectSignatureCloser(voiceprint, input.intent, aggressionBand, clarityBand, seed);

  if (openerUsed) {
    working = attachOpener(working, openerUsed, voiceprint);
    transformationFlags.push('signature_opener');
  }

  working = applySentenceLengthPolicy(
    working,
    voiceprint,
    descriptor,
    input.intent,
    clarityBand,
    aggressionBand,
  );
  transformationFlags.push('sentence_length_policy');

  working = applyPunctuationPolicy(
    working,
    voiceprint,
    descriptor,
    input.intent,
    aggressionBand,
    clarityBand,
    context,
  );
  transformationFlags.push('punctuation_policy');

  working = applyIntentSpecificTension(
    working,
    descriptor,
    input.intent,
    aggressionBand,
    clarityBand,
    context,
  );
  transformationFlags.push('intent_tension_policy');

  if (closerUsed) {
    working = attachCloser(working, closerUsed, voiceprint, preferredExitStyle);
    transformationFlags.push('signature_closer');
  }

  const shouldUseSparseEmoji =
    Boolean(voiceprint.prefersSparseEmoji) &&
    descriptor.npcClass !== 'HATER' &&
    clarityBand !== 'EXPLICIT';

  const shouldUseTypingReveal =
    descriptor.cadence.entryStyle === 'TYPING_REVEAL' ||
    preferredEntryStyle === 'TYPING_REVEAL' ||
    preferredEntryStyle === 'LURK_THEN_STRIKE';

  const shouldTrailOff =
    preferredExitStyle === 'TRAIL_OFF' ||
    preferredExitStyle === 'SHADOW_PERSIST';

  return Object.freeze({
    text: finalizeComposedText(working),
    originalText: sanitizeBaseText(input.sourceText),
    aggressionBand,
    clarityBand,
    preferredEntryStyle,
    preferredExitStyle,
    shouldUseTypingReveal,
    shouldTrailOff,
    shouldLowercase: transformationFlags.includes('lowercase_policy'),
    shouldUseSparseEmoji,
    openerUsed,
    closerUsed,
    transformationFlags: Object.freeze(transformationFlags),
  });
}

export function previewVoiceprintPolicy(
  input: BackendVoiceprintPolicyInput,
): BackendVoiceprintRenderPreview {
  const primary = resolveVoiceprintPolicy(input);

  const sharper =
    input.entry.descriptor.npcClass === 'HATER' || input.intent === 'NEGOTIATION'
      ? resolveVoiceprintPolicy({
          ...input,
          seed: `${input.seed ?? 'seed'}::sharper`,
          context: {
            ...normalizeContext(input.context),
            embarrassment01: clamp01(
              (normalizeContext(input.context).embarrassment01 ?? 0) + 0.18,
            ),
            publicHeat01: clamp01(
              (normalizeContext(input.context).publicHeat01 ?? 0) + 0.12,
            ),
          },
        })
      : undefined;

  const softer =
    input.entry.descriptor.npcClass !== 'HATER'
      ? resolveVoiceprintPolicy({
          ...input,
          seed: `${input.seed ?? 'seed'}::softer`,
          context: {
            ...normalizeContext(input.context),
            rescueWindowOpen: true,
            desperation01: clamp01(
              (normalizeContext(input.context).desperation01 ?? 0) + 0.16,
            ),
          },
        })
      : undefined;

  return Object.freeze({
    primary,
    alternateSharper: sharper,
    alternateSofter: softer,
  });
}

export function composePersonaLine(
  entry: BackendPersonaRegistryEntry,
  sourceText: string,
  intent: BackendVoiceprintIntent,
  context?: BackendVoiceprintContext | BackendPersonaSelectionContext | null,
  seed?: string | null,
): string {
  return resolveVoiceprintPolicy({
    entry,
    sourceText,
    intent,
    context,
    seed,
  }).text;
}

// ============================================================================
// MARK: Aggression / clarity resolution
// ============================================================================

export function resolveAggressionBand(
  entry: BackendPersonaRegistryEntry,
  intent: BackendVoiceprintIntent,
  context?: BackendVoiceprintContext | null,
): BackendVoiceprintAggressionBand {
  const descriptor = entry.descriptor;
  const embarrassment01 = clamp01(context?.embarrassment01);
  const publicHeat01 = clamp01(context?.publicHeat01);
  const desperation01 = clamp01(context?.desperation01);
  const confidence01 = clamp01(context?.confidence01);

  if (descriptor.npcClass === 'HELPER') {
    if (intent === 'RESCUE') return 'SOFT';
    if (context?.playerCollapsed) return 'SOFT';
    if (context?.playerComeback) return 'TEMPERED';
    return embarrassment01 >= 0.75 ? 'TEMPERED' : 'SOFT';
  }

  if (descriptor.npcClass === 'AMBIENT') {
    if (publicHeat01 >= 0.84) return 'SHARP';
    if (intent === 'WITNESS' && embarrassment01 >= 0.62) return 'TEMPERED';
    return 'TEMPERED';
  }

  if (intent === 'NEGOTIATION' && confidence01 < 0.28) return 'PREDATORY';
  if (intent === 'CALLBACK' && embarrassment01 >= 0.52) return 'CUTTING';
  if (publicHeat01 >= 0.90 || desperation01 >= 0.82) return 'PREDATORY';
  if (HOSTILE_INTENTS.has(intent) && embarrassment01 >= 0.34) return 'CUTTING';
  if (HOSTILE_INTENTS.has(intent)) return 'SHARP';
  return 'TEMPERED';
}

export function resolveClarityBand(
  entry: BackendPersonaRegistryEntry,
  intent: BackendVoiceprintIntent,
  context?: BackendVoiceprintContext | null,
): BackendVoiceprintClarityBand {
  const descriptor = entry.descriptor;
  const desperation01 = clamp01(context?.desperation01);

  if (descriptor.npcClass === 'HELPER') {
    if (RESCUE_INTENTS.has(intent)) return 'EXPLICIT';
    if (desperation01 >= 0.65) return 'EXPLICIT';
    return 'BALANCED';
  }

  if (descriptor.npcClass === 'AMBIENT') {
    if (intent === 'WITNESS' || intent === 'POSTRUN') return 'BALANCED';
    return 'MINIMAL';
  }

  if (intent === 'NEGOTIATION') return 'BALANCED';
  if (intent === 'TELEGRAPH') return 'BALANCED';
  if (intent === 'RETREAT') return 'MINIMAL';
  return 'MINIMAL';
}

// ============================================================================
// MARK: Entry / exit style resolution
// ============================================================================

export function resolvePreferredEntryStyle(
  descriptor: ChatNpcDescriptor,
  intent: BackendVoiceprintIntent,
  aggressionBand: BackendVoiceprintAggressionBand,
  context?: BackendVoiceprintContext | null,
): ChatNpcEntryStyle {
  if (descriptor.npcClass === 'HELPER' && RESCUE_INTENTS.has(intent)) {
    return context?.playerCollapsed ? 'SYSTEM_CARD' : 'TYPING_REVEAL';
  }

  if (descriptor.npcClass === 'AMBIENT') {
    if (intent === 'WITNESS') return 'CROWD_SWELL';
    if (intent === 'AMBIENT') return 'WHISPER_REVEAL';
  }

  if (descriptor.npcClass === 'HATER') {
    if (aggressionBand === 'PREDATORY') return 'LURK_THEN_STRIKE';
    if (intent === 'TELEGRAPH') return 'TYPING_REVEAL';
    if (intent === 'CALLBACK') return 'INSTANT_DROP';
  }

  return descriptor.cadence.entryStyle;
}

export function resolvePreferredExitStyle(
  descriptor: ChatNpcDescriptor,
  intent: BackendVoiceprintIntent,
  aggressionBand: BackendVoiceprintAggressionBand,
  context?: BackendVoiceprintContext | null,
): ChatNpcExitStyle {
  if (descriptor.npcClass === 'HELPER' && RESCUE_INTENTS.has(intent)) {
    return context?.rescueWindowOpen ? 'QUEUE_NEXT_SPEAKER' : 'READ_AND_LEAVE';
  }

  if (descriptor.npcClass === 'AMBIENT' && (intent === 'AMBIENT' || intent === 'WITNESS')) {
    return 'TRAIL_OFF';
  }

  if (descriptor.npcClass === 'HATER') {
    if (aggressionBand === 'PREDATORY') return 'SHADOW_PERSIST';
    if (intent === 'RETREAT') return 'HARD_STOP';
  }

  return descriptor.cadence.exitStyle;
}

// ============================================================================
// MARK: Text shaping
// ============================================================================

function applySentenceLengthPolicy(
  input: string,
  voiceprint: ChatNpcVoiceprint,
  descriptor: ChatAnyNpcDescriptor,
  intent: BackendVoiceprintIntent,
  clarityBand: BackendVoiceprintClarityBand,
  aggressionBand: BackendVoiceprintAggressionBand,
): string {
  const clauses = splitClauses(input);

  if (voiceprint.averageSentenceLength === 'SHORT') {
    return joinClauses(clauses.slice(0, Math.max(1, clarityBand === 'EXPLICIT' ? 2 : 1)));
  }

  if (voiceprint.averageSentenceLength === 'MEDIUM') {
    if (descriptor.npcClass === 'HELPER' && clarityBand === 'EXPLICIT') {
      return joinClauses(clauses.slice(0, Math.min(3, clauses.length)));
    }
    return joinClauses(clauses.slice(0, Math.min(2, clauses.length)));
  }

  if (descriptor.npcClass === 'HATER' && aggressionBand === 'PREDATORY' && intent !== 'RETREAT') {
    return input;
  }

  if (descriptor.npcClass === 'AMBIENT' && intent === 'AMBIENT') {
    return joinClauses(clauses.slice(0, Math.min(2, clauses.length)));
  }

  return input;
}

function applyPunctuationPolicy(
  input: string,
  voiceprint: ChatNpcVoiceprint,
  descriptor: ChatAnyNpcDescriptor,
  intent: BackendVoiceprintIntent,
  aggressionBand: BackendVoiceprintAggressionBand,
  clarityBand: BackendVoiceprintClarityBand,
  context?: BackendVoiceprintContext | null,
): string {
  let next = sanitizeBaseText(input);

  switch (voiceprint.punctuationStyle) {
    case 'SPARSE':
      next = next.replace(/[;:]/g, '.').replace(/,{2,}/g, ',');
      next = collapseExclamations(next, 0);
      break;
    case 'SHARP':
      next = sharpenPunctuation(next, aggressionBand, intent);
      break;
    case 'ELLIPTICAL':
      next = addEllipsisCadence(next, descriptor, intent, context);
      break;
    case 'FORMAL':
      next = formalizePunctuation(next);
      break;
    case 'LOUD':
      next = amplifyPunctuation(next, aggressionBand, clarityBand);
      break;
    default:
      break;
  }

  if (descriptor.npcClass === 'HELPER' && RESCUE_INTENTS.has(intent)) {
    next = collapseExclamations(next, 0);
    next = stripTrailingThreatCadence(next);
  }

  if (descriptor.npcClass === 'AMBIENT' && intent === 'WITNESS') {
    next = softenTerminalPunctuation(next);
  }

  return sanitizeBaseText(next);
}

function applyIntentSpecificTension(
  input: string,
  descriptor: ChatAnyNpcDescriptor,
  intent: BackendVoiceprintIntent,
  aggressionBand: BackendVoiceprintAggressionBand,
  clarityBand: BackendVoiceprintClarityBand,
  context?: BackendVoiceprintContext | null,
): string {
  let next = input;

  if (descriptor.npcClass === 'HELPER') {
    if (RESCUE_INTENTS.has(intent) && !endsWithDirective(next) && clarityBand === 'EXPLICIT') {
      next = ensureDirectiveClarity(next);
    }
    if (context?.playerCollapsed) {
      next = removeMockingCadence(next);
    }
    return next;
  }

  if (descriptor.npcClass === 'AMBIENT') {
    if (intent === 'AMBIENT' || intent === 'WITNESS') {
      return softenClaimEdges(next);
    }
    return next;
  }

  if (aggressionBand === 'CUTTING' || aggressionBand === 'PREDATORY') {
    next = tightenThreatCadence(next);
  }

  if (intent === 'CALLBACK') {
    next = ensureReceiptFrame(next);
  }

  if (intent === 'NEGOTIATION') {
    next = shapePredatoryNegotiation(next, aggressionBand);
  }

  return next;
}

// ============================================================================
// MARK: Signature selection
// ============================================================================

export function selectSignatureOpener(
  voiceprint: ChatNpcVoiceprint,
  intent: BackendVoiceprintIntent,
  aggressionBand: BackendVoiceprintAggressionBand,
  seed: string,
): string | undefined {
  const candidates = voiceprint.signatureOpeners ?? [];
  if (!candidates.length) return undefined;
  if (intent === 'RETREAT') return undefined;
  if (intent === 'AMBIENT' && aggressionBand === 'SOFT') return undefined;
  return deterministicPick(candidates, `${seed}::opener`) ?? undefined;
}

export function selectSignatureCloser(
  voiceprint: ChatNpcVoiceprint,
  intent: BackendVoiceprintIntent,
  aggressionBand: BackendVoiceprintAggressionBand,
  clarityBand: BackendVoiceprintClarityBand,
  seed: string,
): string | undefined {
  const candidates = voiceprint.signatureClosers ?? [];
  if (!candidates.length) return undefined;
  if (RESCUE_INTENTS.has(intent) && clarityBand === 'EXPLICIT') return undefined;
  if (intent === 'RETREAT' && aggressionBand !== 'PREDATORY') return undefined;
  return deterministicPick(candidates, `${seed}::closer`) ?? undefined;
}

// ============================================================================
// MARK: Utility transforms
// ============================================================================

function shouldNormalizeLowercase(
  voiceprint: ChatNpcVoiceprint,
  intent: BackendVoiceprintIntent,
  context?: BackendVoiceprintContext | null,
): boolean {
  if (!voiceprint.prefersLowercase) return false;
  if (RESCUE_INTENTS.has(intent)) return false;
  if (context?.playerCollapsed) return false;
  return true;
}

function applyLowercasePolicy(
  text: string,
  descriptor: ChatAnyNpcDescriptor,
  intent: BackendVoiceprintIntent,
): string {
  if (descriptor.npcClass === 'HELPER' && RESCUE_INTENTS.has(intent)) return text;
  return text.toLowerCase();
}

function attachOpener(
  text: string,
  opener: string,
  voiceprint: ChatNpcVoiceprint,
): string {
  const normalizedOpener = sanitizeBaseText(opener);
  if (!normalizedOpener) return text;
  if (voiceprint.punctuationStyle === 'ELLIPTICAL') {
    return `${normalizedOpener}… ${text}`;
  }
  return `${normalizedOpener} ${text}`;
}

function attachCloser(
  text: string,
  closer: string,
  voiceprint: ChatNpcVoiceprint,
  exitStyle: ChatNpcExitStyle,
): string {
  const normalizedCloser = sanitizeBaseText(closer);
  if (!normalizedCloser) return text;
  if (exitStyle === 'TRAIL_OFF' || exitStyle === 'SHADOW_PERSIST') {
    return `${stripTerminalPunctuation(text)} ${normalizedCloser}…`;
  }
  if (voiceprint.punctuationStyle === 'SPARSE') {
    return `${stripTerminalPunctuation(text)}. ${normalizedCloser}`;
  }
  return `${stripTerminalPunctuation(text)} — ${normalizedCloser}`;
}

function splitClauses(text: string): string[] {
  return text
    .split(CLAUSE_SPLIT_REGEX)
    .map((part) => part.trim())
    .filter(Boolean);
}

function joinClauses(clauses: readonly string[]): string {
  return sanitizeBaseText(clauses.join(' '));
}

function sanitizeBaseText(text: string): string {
  return text
    .replace(MULTISPACE_REGEX, ' ')
    .replace(SPACE_BEFORE_PUNCT_REGEX, '$1')
    .trim();
}

function stripTerminalPunctuation(text: string): string {
  return text.replace(/[.!?…]+$/g, '').trim();
}

function collapseExclamations(text: string, maxAllowed: number): string {
  if (maxAllowed <= 0) return text.replace(/!+/g, '.');
  return text.replace(/!{2,}/g, '!'.repeat(maxAllowed));
}

function formalizePunctuation(text: string): string {
  return text
    .replace(/\s*—\s*/g, '; ')
    .replace(/\.{3,}/g, '.')
    .replace(/!+/g, '.');
}

function amplifyPunctuation(
  text: string,
  aggressionBand: BackendVoiceprintAggressionBand,
  clarityBand: BackendVoiceprintClarityBand,
): string {
  if (clarityBand === 'EXPLICIT') {
    return text.replace(/\.{2,}/g, '.').replace(/\?{2,}/g, '?');
  }
  if (aggressionBand === 'PREDATORY' || aggressionBand === 'CUTTING') {
    return stripTerminalPunctuation(text) + '.';
  }
  return text;
}

function sharpenPunctuation(
  text: string,
  aggressionBand: BackendVoiceprintAggressionBand,
  intent: BackendVoiceprintIntent,
): string {
  if (intent === 'TELEGRAPH') return stripTerminalPunctuation(text) + '.';
  if (aggressionBand === 'PREDATORY') return stripTerminalPunctuation(text) + '.';
  return text.replace(/\.{2,}/g, '.');
}

function addEllipsisCadence(
  text: string,
  descriptor: ChatAnyNpcDescriptor,
  intent: BackendVoiceprintIntent,
  context?: BackendVoiceprintContext | null,
): string {
  if (descriptor.npcClass === 'HELPER' && RESCUE_INTENTS.has(intent)) return text;
  if (context?.playerCollapsed) return stripTerminalPunctuation(text) + '.';
  if (/[.!?…]$/.test(text)) return text.replace(/[.!?]+$/g, '…');
  return `${text}…`;
}

function stripTrailingThreatCadence(text: string): string {
  return text
    .replace(/\s*[.…]+\s*(you('re| are) (finished|done|over))\s*[.…!]*$/i, '')
    .replace(/\s*—\s*(watch yourself|mark my words|this isn'?t over)\s*[.…!]*$/i, '')
    .replace(/[.…]{2,}$/, '.')
    .trim();
}

function softenTerminalPunctuation(text: string): string {
  return text.replace(/!+$/g, '.').replace(/\?+$/g, '.');
}

function tightenThreatCadence(text: string): string {
  return text
    .replace(/\bvery\b/gi, '')
    .replace(/\breally\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function removeMockingCadence(text: string): string {
  return text
    .replace(/\bpathetic\b/gi, '')
    .replace(/\bembarrassing\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function softenClaimEdges(text: string): string {
  return text
    .replace(/\balways\b/gi, 'often')
    .replace(/\bnever\b/gi, 'rarely')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function ensureReceiptFrame(text: string): string {
  if (
    /\b(earlier|before|last time|you said|receipt|kept that line|logged)\b/i.test(text)
  ) {
    return text;
  }
  return `Earlier, ${lowercaseInitial(text)}`;
}

function shapePredatoryNegotiation(
  text: string,
  aggressionBand: BackendVoiceprintAggressionBand,
): string {
  if (aggressionBand === 'PREDATORY') {
    return stripTerminalPunctuation(text) + '.';
  }
  return text;
}

function ensureDirectiveClarity(text: string): string {
  if (endsWithDirective(text)) return text;
  return `${stripTerminalPunctuation(text)}. Stay with the clean line.`;
}

function endsWithDirective(text: string): boolean {
  return /\b(stay|hold|breathe|cut|leave|wait|reset|step back|take the exit)\b[.!?…]*$/i.test(
    text.trim(),
  );
}

function lowercaseInitial(text: string): string {
  if (!text) return text;
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function finalizeComposedText(text: string): string {
  const cleaned = sanitizeBaseText(text);
  if (!cleaned) return cleaned;
  return cleaned;
}

// ============================================================================
// MARK: Deterministic helpers
// ============================================================================

function normalizeContext(
  context?: BackendVoiceprintContext | BackendPersonaSelectionContext | null,
): BackendVoiceprintContext {
  return {
    roomMood: context?.roomMood ?? null,
    pressureBand: context?.pressureBand ?? null,
    embarrassment01: clamp01((context as BackendVoiceprintContext | undefined)?.embarrassment01),
    desperation01: clamp01((context as BackendVoiceprintContext | undefined)?.desperation01),
    confidence01: clamp01((context as BackendVoiceprintContext | undefined)?.confidence01),
    callbackDemand01: clamp01((context as BackendVoiceprintContext | undefined)?.callbackDemand01),
    negotiationDemand01: clamp01(
      (context as BackendVoiceprintContext | undefined)?.negotiationDemand01,
    ),
    publicHeat01: clamp01((context as BackendVoiceprintContext | undefined)?.publicHeat01),
    rescueWindowOpen:
      (context as BackendVoiceprintContext | undefined)?.rescueWindowOpen ?? null,
    playerCollapsed:
      (context as BackendVoiceprintContext | undefined)?.playerCollapsed ?? null,
    playerComeback:
      (context as BackendVoiceprintContext | undefined)?.playerComeback ?? null,
  };
}

function buildPolicySeed(
  entry: BackendPersonaRegistryEntry,
  intent: BackendVoiceprintIntent,
  sourceText: string,
  context: BackendVoiceprintContext,
): string {
  return [
    entry.sharedKey,
    entry.runtime.runtimePersonaId,
    intent,
    sourceText,
    context.roomMood ?? 'room:none',
    context.pressureBand ?? 'pressure:none',
    String(context.embarrassment01 ?? 0),
    String(context.publicHeat01 ?? 0),
    String(context.callbackDemand01 ?? 0),
  ].join('::');
}

function deterministicPick<T>(values: readonly T[], seed: string): T | null {
  if (!values.length) return null;
  const index = positiveHash(seed) % values.length;
  return values[index] ?? null;
}

function positiveHash(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function clamp01(value: number | null | undefined): Score01 | number {
  if (value == null || Number.isNaN(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return Number(value.toFixed(6));
}

// ============================================================================
// MARK: Extended contracts
// ============================================================================

export interface BackendVoiceprintCompositionBundle {
  readonly primary: BackendVoiceprintPolicyResolution;
  readonly sharper?: BackendVoiceprintPolicyResolution;
  readonly softer?: BackendVoiceprintPolicyResolution;
  readonly aggressionScore01: number;
  readonly clarityScore01: number;
  readonly intent: BackendVoiceprintIntent;
  readonly npcClass: string;
  readonly notes: readonly string[];
}

export interface BackendVoiceprintBatchEntry {
  readonly entry: BackendPersonaRegistryEntry;
  readonly intent: BackendVoiceprintIntent;
  readonly sourceText: string;
  readonly context?: BackendVoiceprintContext | BackendPersonaSelectionContext | null;
  readonly seed?: string | null;
}

export interface BackendVoiceprintBatchResult {
  readonly resolutions: readonly BackendVoiceprintPolicyResolution[];
  readonly totalInputs: number;
  readonly successCount: number;
  readonly failureCount: number;
  readonly lowercaseCount: number;
  readonly openerCount: number;
  readonly closerCount: number;
}

export interface BackendVoiceprintDiagnostic {
  readonly npcId: string;
  readonly personaId: string;
  readonly npcClass: string;
  readonly intent: BackendVoiceprintIntent;
  readonly aggressionBand: BackendVoiceprintAggressionBand;
  readonly clarityBand: BackendVoiceprintClarityBand;
  readonly preferredEntryStyle: ChatNpcEntryStyle;
  readonly preferredExitStyle: ChatNpcExitStyle;
  readonly transformationFlags: readonly string[];
  readonly openerUsed?: string;
  readonly closerUsed?: string;
  readonly shouldUseSparseEmoji: boolean;
  readonly shouldUseTypingReveal: boolean;
  readonly shouldTrailOff: boolean;
  readonly shouldLowercase: boolean;
  readonly notes: readonly string[];
}

export interface BackendVoiceprintCompositionStats {
  readonly count: number;
  readonly aggressionDistribution: Readonly<Record<BackendVoiceprintAggressionBand, number>>;
  readonly clarityDistribution: Readonly<Record<BackendVoiceprintClarityBand, number>>;
  readonly lowercaseRate01: number;
  readonly openerRate01: number;
  readonly closerRate01: number;
  readonly typingRevealRate01: number;
  readonly trailOffRate01: number;
  readonly sparseEmojiRate01: number;
  readonly averageTransformFlagCount: number;
}

export interface BackendVoiceprintResolutionDiff {
  readonly aggressionChanged: boolean;
  readonly clarityChanged: boolean;
  readonly entryStyleChanged: boolean;
  readonly exitStyleChanged: boolean;
  readonly lowercaseChanged: boolean;
  readonly typingRevealChanged: boolean;
  readonly trailOffChanged: boolean;
  readonly textChanged: boolean;
  readonly textLengthDelta: number;
  readonly openerChanged: boolean;
  readonly closerChanged: boolean;
  readonly summary: string;
}

export interface BackendPersonaVoiceprintProfile {
  readonly npcId: string;
  readonly personaId: string;
  readonly npcClass: string;
  readonly displayName: string;
  readonly punctuationStyle: ChatNpcVoiceprint['punctuationStyle'];
  readonly averageSentenceLength: ChatNpcVoiceprint['averageSentenceLength'];
  readonly prefersLowercase: boolean;
  readonly prefersSparseEmoji: boolean;
  readonly signatureOpenerCount: number;
  readonly signatureCloserCount: number;
  readonly lexiconTagCount: number;
  readonly defaultAggressionBand: BackendVoiceprintAggressionBand;
  readonly defaultClarityBand: BackendVoiceprintClarityBand;
  readonly defaultEntryStyle: ChatNpcEntryStyle;
  readonly defaultExitStyle: ChatNpcExitStyle;
}

// ============================================================================
// MARK: Safe and batch resolution
// ============================================================================

export function resolveVoiceprintPolicySafe(
  input: BackendVoiceprintPolicyInput,
): BackendVoiceprintPolicyResolution | null {
  try {
    return resolveVoiceprintPolicy(input);
  } catch {
    return null;
  }
}

export function resolveVoiceprintBatch(
  inputs: readonly BackendVoiceprintBatchEntry[],
): BackendVoiceprintBatchResult {
  const resolutions: BackendVoiceprintPolicyResolution[] = [];
  let successCount = 0;
  let failureCount = 0;
  let lowercaseCount = 0;
  let openerCount = 0;
  let closerCount = 0;

  for (const item of inputs) {
    const result = resolveVoiceprintPolicySafe({
      entry: item.entry,
      intent: item.intent,
      sourceText: item.sourceText,
      context: item.context,
      seed: item.seed,
    });
    if (!result) {
      failureCount += 1;
      continue;
    }
    resolutions.push(result);
    successCount += 1;
    if (result.shouldLowercase) lowercaseCount += 1;
    if (result.openerUsed) openerCount += 1;
    if (result.closerUsed) closerCount += 1;
  }

  return Object.freeze({
    resolutions: Object.freeze(resolutions),
    totalInputs: inputs.length,
    successCount,
    failureCount,
    lowercaseCount,
    openerCount,
    closerCount,
  });
}

export function batchComposeLines(
  entry: BackendPersonaRegistryEntry,
  lines: readonly string[],
  intent: BackendVoiceprintIntent,
  context?: BackendVoiceprintContext | BackendPersonaSelectionContext | null,
): readonly string[] {
  return lines.map((sourceText, index) =>
    composePersonaLine(entry, sourceText, intent, context, `batch::${index}`),
  );
}

// ============================================================================
// MARK: Aggression and clarity scoring
// ============================================================================

export function computeAggressionScore(band: BackendVoiceprintAggressionBand): number {
  switch (band) {
    case 'PREDATORY': return 1.0;
    case 'CUTTING': return 0.80;
    case 'SHARP': return 0.60;
    case 'TEMPERED': return 0.38;
    case 'SOFT': return 0.12;
    default: return 0;
  }
}

export function computeClarityScore(band: BackendVoiceprintClarityBand): number {
  switch (band) {
    case 'EXPLICIT': return 1.0;
    case 'BALANCED': return 0.55;
    case 'MINIMAL': return 0.15;
    default: return 0;
  }
}

export function aggressionScoreToBand(score01: number): BackendVoiceprintAggressionBand {
  if (score01 >= 0.90) return 'PREDATORY';
  if (score01 >= 0.70) return 'CUTTING';
  if (score01 >= 0.50) return 'SHARP';
  if (score01 >= 0.25) return 'TEMPERED';
  return 'SOFT';
}

export function clarityScoreToBand(score01: number): BackendVoiceprintClarityBand {
  if (score01 >= 0.75) return 'EXPLICIT';
  if (score01 >= 0.35) return 'BALANCED';
  return 'MINIMAL';
}

export function compareAggressionBands(
  a: BackendVoiceprintAggressionBand,
  b: BackendVoiceprintAggressionBand,
): number {
  return computeAggressionScore(a) - computeAggressionScore(b);
}

export function compareClarityBands(
  a: BackendVoiceprintClarityBand,
  b: BackendVoiceprintClarityBand,
): number {
  return computeClarityScore(a) - computeClarityScore(b);
}

// ============================================================================
// MARK: Diagnostics
// ============================================================================

export function buildVoiceprintDiagnostic(
  input: BackendVoiceprintPolicyInput,
  resolution?: BackendVoiceprintPolicyResolution | null,
): BackendVoiceprintDiagnostic {
  const resolved = resolution ?? resolveVoiceprintPolicy(input);
  const descriptor = input.entry.descriptor;
  const notes: string[] = [];

  if (resolved.shouldLowercase) notes.push('Lowercase policy applied — voiceprint prefers lowercase.');
  if (resolved.openerUsed) notes.push(`Signature opener attached: "${resolved.openerUsed}".`);
  if (resolved.closerUsed) notes.push(`Signature closer attached: "${resolved.closerUsed}".`);
  if (resolved.shouldUseSparseEmoji) notes.push('Sparse emoji preference active.');
  if (resolved.shouldUseTypingReveal) notes.push('Typing reveal entry active for this resolution.');
  if (resolved.shouldTrailOff) notes.push('Trail-off exit style active.');
  if (resolved.aggressionBand === 'PREDATORY') notes.push('Predatory aggression — threat cadence enabled.');
  if (resolved.clarityBand === 'EXPLICIT') notes.push('Explicit clarity — directive enforcement active.');

  return Object.freeze({
    npcId: descriptor.npcId,
    personaId: descriptor.personaId,
    npcClass: descriptor.npcClass,
    intent: input.intent,
    aggressionBand: resolved.aggressionBand,
    clarityBand: resolved.clarityBand,
    preferredEntryStyle: resolved.preferredEntryStyle,
    preferredExitStyle: resolved.preferredExitStyle,
    transformationFlags: resolved.transformationFlags,
    openerUsed: resolved.openerUsed,
    closerUsed: resolved.closerUsed,
    shouldUseSparseEmoji: resolved.shouldUseSparseEmoji,
    shouldUseTypingReveal: resolved.shouldUseTypingReveal,
    shouldTrailOff: resolved.shouldTrailOff,
    shouldLowercase: resolved.shouldLowercase,
    notes: Object.freeze(notes),
  });
}

export function describeAggressionBand(band: BackendVoiceprintAggressionBand): string {
  switch (band) {
    case 'SOFT': return 'Soft — supportive, non-threatening delivery';
    case 'TEMPERED': return 'Tempered — measured, controlled tension';
    case 'SHARP': return 'Sharp — direct, pointed delivery';
    case 'CUTTING': return 'Cutting — high-pressure, receipt-oriented delivery';
    case 'PREDATORY': return 'Predatory — maximum threat posture, zero-tolerance cadence';
    default: return 'Unknown aggression band';
  }
}

export function describeClarityBand(band: BackendVoiceprintClarityBand): string {
  switch (band) {
    case 'MINIMAL': return 'Minimal — spare phrasing, implied over stated';
    case 'BALANCED': return 'Balanced — standard clarity, no forced directness';
    case 'EXPLICIT': return 'Explicit — directive, unambiguous, action-oriented';
    default: return 'Unknown clarity band';
  }
}

export function describeTransformationFlags(flags: readonly string[]): string {
  if (!flags.length) return 'no transformations applied';
  return flags.map((f) => f.replace(/_/g, ' ').toLowerCase()).join(', ');
}

export function describeVoiceprintResolution(resolution: BackendVoiceprintPolicyResolution): string {
  const parts: string[] = [
    `aggression=${resolution.aggressionBand}`,
    `clarity=${resolution.clarityBand}`,
    `entry=${resolution.preferredEntryStyle}`,
    `exit=${resolution.preferredExitStyle}`,
  ];
  if (resolution.shouldLowercase) parts.push('lowercase');
  if (resolution.shouldUseTypingReveal) parts.push('typing_reveal');
  if (resolution.shouldTrailOff) parts.push('trail_off');
  if (resolution.openerUsed) parts.push(`opener="${resolution.openerUsed}"`);
  if (resolution.closerUsed) parts.push(`closer="${resolution.closerUsed}"`);
  return parts.join(' | ');
}

// ============================================================================
// MARK: Intent classification
// ============================================================================

export function isHostileIntent(intent: BackendVoiceprintIntent): boolean {
  return HOSTILE_INTENTS.has(intent);
}

export function isReflectiveIntent(intent: BackendVoiceprintIntent): boolean {
  return REFLECTIVE_INTENTS.has(intent);
}

export function isRescueIntent(intent: BackendVoiceprintIntent): boolean {
  return RESCUE_INTENTS.has(intent);
}

export function classifyIntent(intent: BackendVoiceprintIntent): 'HOSTILE' | 'REFLECTIVE' | 'RESCUE' | 'NEUTRAL' {
  if (RESCUE_INTENTS.has(intent)) return 'RESCUE';
  if (HOSTILE_INTENTS.has(intent)) return 'HOSTILE';
  if (REFLECTIVE_INTENTS.has(intent)) return 'REFLECTIVE';
  return 'NEUTRAL';
}

export function intentRequiresClarityEscalation(
  intent: BackendVoiceprintIntent,
  npcClass: string,
): boolean {
  if (npcClass === 'HELPER' && RESCUE_INTENTS.has(intent)) return true;
  if (intent === 'NEGOTIATION') return true;
  return false;
}

// ============================================================================
// MARK: Entry / exit style classification
// ============================================================================

export function classifyEntryStyle(style: ChatNpcEntryStyle): string {
  switch (style) {
    case 'TYPING_REVEAL': return 'Typing reveal — visible composing before message appears';
    case 'INSTANT_DROP': return 'Instant drop — message arrives without typing indicator';
    case 'LURK_THEN_STRIKE': return 'Lurk then strike — shadow presence before sudden delivery';
    case 'CROWD_SWELL': return 'Crowd swell — multiple ambient voices rising together';
    case 'WHISPER_REVEAL': return 'Whisper reveal — quiet appearance, low-profile entry';
    case 'SYSTEM_CARD': return 'System card — structured system-style card format';
    default: return `Unknown entry style: ${String(style)}`;
  }
}

export function classifyExitStyle(style: ChatNpcExitStyle): string {
  switch (style) {
    case 'READ_AND_LEAVE': return 'Read and leave — delivers then exits cleanly';
    case 'TRAIL_OFF': return 'Trail off — message fades out gradually';
    case 'SHADOW_PERSIST': return 'Shadow persist — NPC lingers in shadow after delivery';
    case 'HARD_STOP': return 'Hard stop — abrupt exit, no lingering';
    case 'QUEUE_NEXT_SPEAKER': return 'Queue next speaker — hands off to the next voice';
    default: return `Unknown exit style: ${String(style)}`;
  }
}

// ============================================================================
// MARK: Diff and comparison
// ============================================================================

export function diffPolicyResolutions(
  baseline: BackendVoiceprintPolicyResolution,
  updated: BackendVoiceprintPolicyResolution,
): BackendVoiceprintResolutionDiff {
  const aggressionChanged = updated.aggressionBand !== baseline.aggressionBand;
  const clarityChanged = updated.clarityBand !== baseline.clarityBand;
  const entryStyleChanged = updated.preferredEntryStyle !== baseline.preferredEntryStyle;
  const exitStyleChanged = updated.preferredExitStyle !== baseline.preferredExitStyle;
  const lowercaseChanged = updated.shouldLowercase !== baseline.shouldLowercase;
  const typingRevealChanged = updated.shouldUseTypingReveal !== baseline.shouldUseTypingReveal;
  const trailOffChanged = updated.shouldTrailOff !== baseline.shouldTrailOff;
  const textChanged = updated.text !== baseline.text;
  const textLengthDelta = updated.text.length - baseline.text.length;
  const openerChanged = updated.openerUsed !== baseline.openerUsed;
  const closerChanged = updated.closerUsed !== baseline.closerUsed;

  const changes: string[] = [];
  if (aggressionChanged) changes.push(`aggression:${baseline.aggressionBand}→${updated.aggressionBand}`);
  if (clarityChanged) changes.push(`clarity:${baseline.clarityBand}→${updated.clarityBand}`);
  if (entryStyleChanged) changes.push(`entry:${baseline.preferredEntryStyle}→${updated.preferredEntryStyle}`);
  if (exitStyleChanged) changes.push(`exit:${baseline.preferredExitStyle}→${updated.preferredExitStyle}`);
  if (lowercaseChanged) changes.push(`lowercase:${String(baseline.shouldLowercase)}→${String(updated.shouldLowercase)}`);
  if (typingRevealChanged) changes.push(`typingReveal:${String(baseline.shouldUseTypingReveal)}→${String(updated.shouldUseTypingReveal)}`);
  if (textLengthDelta !== 0) changes.push(`textLen${textLengthDelta > 0 ? '+' : ''}${textLengthDelta}`);
  if (openerChanged) changes.push(`opener changed`);
  if (closerChanged) changes.push(`closer changed`);

  return Object.freeze({
    aggressionChanged,
    clarityChanged,
    entryStyleChanged,
    exitStyleChanged,
    lowercaseChanged,
    typingRevealChanged,
    trailOffChanged,
    textChanged,
    textLengthDelta,
    openerChanged,
    closerChanged,
    summary: changes.length > 0 ? changes.join(', ') : 'no change',
  });
}

// ============================================================================
// MARK: Stats and aggregation
// ============================================================================

export function buildVoiceprintCompositionStats(
  resolutions: readonly BackendVoiceprintPolicyResolution[],
): BackendVoiceprintCompositionStats {
  if (!resolutions.length) {
    return Object.freeze({
      count: 0,
      aggressionDistribution: Object.freeze({ SOFT: 0, TEMPERED: 0, SHARP: 0, CUTTING: 0, PREDATORY: 0 }),
      clarityDistribution: Object.freeze({ MINIMAL: 0, BALANCED: 0, EXPLICIT: 0 }),
      lowercaseRate01: 0,
      openerRate01: 0,
      closerRate01: 0,
      typingRevealRate01: 0,
      trailOffRate01: 0,
      sparseEmojiRate01: 0,
      averageTransformFlagCount: 0,
    });
  }

  const aggrDist: Record<BackendVoiceprintAggressionBand, number> = {
    SOFT: 0, TEMPERED: 0, SHARP: 0, CUTTING: 0, PREDATORY: 0,
  };
  const clarDist: Record<BackendVoiceprintClarityBand, number> = {
    MINIMAL: 0, BALANCED: 0, EXPLICIT: 0,
  };

  let lowercaseCount = 0;
  let openerCount = 0;
  let closerCount = 0;
  let typingRevealCount = 0;
  let trailOffCount = 0;
  let sparseEmojiCount = 0;
  let totalFlags = 0;

  for (const r of resolutions) {
    aggrDist[r.aggressionBand] = (aggrDist[r.aggressionBand] ?? 0) + 1;
    clarDist[r.clarityBand] = (clarDist[r.clarityBand] ?? 0) + 1;
    if (r.shouldLowercase) lowercaseCount += 1;
    if (r.openerUsed) openerCount += 1;
    if (r.closerUsed) closerCount += 1;
    if (r.shouldUseTypingReveal) typingRevealCount += 1;
    if (r.shouldTrailOff) trailOffCount += 1;
    if (r.shouldUseSparseEmoji) sparseEmojiCount += 1;
    totalFlags += r.transformationFlags.length;
  }

  const n = resolutions.length;
  return Object.freeze({
    count: n,
    aggressionDistribution: Object.freeze(aggrDist),
    clarityDistribution: Object.freeze(clarDist),
    lowercaseRate01: clamp01(lowercaseCount / n) as number,
    openerRate01: clamp01(openerCount / n) as number,
    closerRate01: clamp01(closerCount / n) as number,
    typingRevealRate01: clamp01(typingRevealCount / n) as number,
    trailOffRate01: clamp01(trailOffCount / n) as number,
    sparseEmojiRate01: clamp01(sparseEmojiCount / n) as number,
    averageTransformFlagCount: Number((totalFlags / n).toFixed(2)),
  });
}

// ============================================================================
// MARK: Intent-first API
// ============================================================================

export function resolveVoiceprintForIntent(
  entry: BackendPersonaRegistryEntry,
  intent: BackendVoiceprintIntent,
  sourceText: string,
  context?: BackendVoiceprintContext | BackendPersonaSelectionContext | null,
  seed?: string | null,
): BackendVoiceprintPolicyResolution {
  return resolveVoiceprintPolicy({ entry, intent, sourceText, context, seed });
}

export function buildCompositionBundle(
  entry: BackendPersonaRegistryEntry,
  intent: BackendVoiceprintIntent,
  sourceText: string,
  context?: BackendVoiceprintContext | BackendPersonaSelectionContext | null,
  seed?: string | null,
): BackendVoiceprintCompositionBundle {
  const preview = previewVoiceprintPolicy({ entry, intent, sourceText, context, seed });
  const primary = preview.primary;
  const notes: string[] = [];

  const aggressionScore01 = computeAggressionScore(primary.aggressionBand);
  const clarityScore01 = computeClarityScore(primary.clarityBand);

  if (aggressionScore01 >= 0.8) notes.push('High aggression: delivery will be confrontational.');
  if (clarityScore01 >= 0.9) notes.push('Explicit clarity: directive enforcement enabled.');
  if (primary.shouldTrailOff) notes.push('Trail-off exit creates lingering tension.');
  if (primary.shouldUseTypingReveal) notes.push('Typing theater active for this bundle.');

  return Object.freeze({
    primary,
    sharper: preview.alternateSharper,
    softer: preview.alternateSofter,
    aggressionScore01,
    clarityScore01,
    intent,
    npcClass: entry.descriptor.npcClass,
    notes: Object.freeze(notes),
  });
}

// ============================================================================
// MARK: Persona voiceprint profile
// ============================================================================

export function buildPersonaVoiceprintProfile(
  entry: BackendPersonaRegistryEntry,
  context?: BackendVoiceprintContext | null,
): BackendPersonaVoiceprintProfile {
  const descriptor = entry.descriptor;
  const voiceprint = descriptor.voiceprint;
  const defaultIntent: BackendVoiceprintIntent =
    descriptor.npcClass === 'HELPER' ? 'RESCUE' :
    descriptor.npcClass === 'HATER' ? 'TAUNT' : 'AMBIENT';

  const aggrBand = resolveAggressionBand(entry, defaultIntent, context);
  const clarBand = resolveClarityBand(entry, defaultIntent, context);
  const entryStyle = resolvePreferredEntryStyle(descriptor, defaultIntent, aggrBand, context);
  const exitStyle = resolvePreferredExitStyle(descriptor, defaultIntent, aggrBand, context);

  return Object.freeze({
    npcId: descriptor.npcId,
    personaId: descriptor.personaId,
    npcClass: descriptor.npcClass,
    displayName: descriptor.displayName,
    punctuationStyle: voiceprint.punctuationStyle,
    averageSentenceLength: voiceprint.averageSentenceLength,
    prefersLowercase: Boolean(voiceprint.prefersLowercase),
    prefersSparseEmoji: Boolean(voiceprint.prefersSparseEmoji),
    signatureOpenerCount: (voiceprint.signatureOpeners ?? []).length,
    signatureCloserCount: (voiceprint.signatureClosers ?? []).length,
    lexiconTagCount: voiceprint.lexiconTags.length,
    defaultAggressionBand: aggrBand,
    defaultClarityBand: clarBand,
    defaultEntryStyle: entryStyle,
    defaultExitStyle: exitStyle,
  });
}

export function buildVoiceprintSummary(
  entry: BackendPersonaRegistryEntry,
  intent: BackendVoiceprintIntent,
  context?: BackendVoiceprintContext | null,
): string {
  const aggrBand = resolveAggressionBand(entry, intent, context);
  const clarBand = resolveClarityBand(entry, intent, context);
  const entryStyle = resolvePreferredEntryStyle(entry.descriptor, intent, aggrBand, context);
  const exitStyle = resolvePreferredExitStyle(entry.descriptor, intent, aggrBand, context);
  return [
    `[${entry.descriptor.npcClass}:${entry.runtime.runtimeDisplayName}]`,
    `intent=${intent}`,
    `aggression=${aggrBand}`,
    `clarity=${clarBand}`,
    `entry=${entryStyle}`,
    `exit=${exitStyle}`,
  ].join(' | ');
}

// ============================================================================
// MARK: Line selection with voiceprint shaping
// ============================================================================

export function selectBestLine(
  entry: BackendPersonaRegistryEntry,
  candidates: readonly string[],
  intent: BackendVoiceprintIntent,
  context?: BackendVoiceprintContext | BackendPersonaSelectionContext | null,
  seed?: string | null,
): string | null {
  if (!candidates.length) return null;
  const resolvedSeed = seed ?? `select::${entry.sharedKey}::${intent}`;
  const idx = positiveHash(resolvedSeed) % candidates.length;
  const chosen = candidates[idx];
  if (!chosen) return null;
  return composePersonaLine(entry, chosen, intent, context, resolvedSeed);
}

export function selectAndComposeLines(
  entry: BackendPersonaRegistryEntry,
  candidates: readonly string[],
  intent: BackendVoiceprintIntent,
  count: number,
  context?: BackendVoiceprintContext | BackendPersonaSelectionContext | null,
  seed?: string | null,
): readonly string[] {
  if (!candidates.length || count <= 0) return [];
  const results: string[] = [];
  const used = new Set<number>();
  for (let attempt = 0; attempt < Math.min(count * 3, candidates.length * 2); attempt += 1) {
    if (results.length >= count) break;
    const resolvedSeed = seed ?? `selectmulti::${entry.sharedKey}::${intent}`;
    const idx = positiveHash(`${resolvedSeed}::${attempt}`) % candidates.length;
    if (used.has(idx)) continue;
    used.add(idx);
    const chosen = candidates[idx];
    if (!chosen) continue;
    results.push(composePersonaLine(entry, chosen, intent, context, `${resolvedSeed}::${attempt}`));
  }
  return Object.freeze(results);
}

// ============================================================================
// MARK: Scoring helpers
// ============================================================================

export function scoreLineForAggression(
  text: string,
  aggressionBand: BackendVoiceprintAggressionBand,
): number {
  const words = text.split(/\s+/).length;
  const base = computeAggressionScore(aggressionBand);

  // Predatory lines should be shorter and denser
  if (aggressionBand === 'PREDATORY') {
    return base * (words <= 12 ? 1.0 : words <= 20 ? 0.85 : 0.7);
  }
  // Soft lines can be longer
  if (aggressionBand === 'SOFT') {
    return base * (words >= 6 ? 1.0 : 0.8);
  }
  return base;
}

export function scoreLineForClarity(
  text: string,
  clarityBand: BackendVoiceprintClarityBand,
): number {
  const hasDirective = /\b(stay|hold|breathe|cut|leave|wait|reset|step back|take the exit|stop|go|move)\b/i.test(text);
  const base = computeClarityScore(clarityBand);
  if (clarityBand === 'EXPLICIT' && hasDirective) return Math.min(1.0, base + 0.12);
  if (clarityBand === 'MINIMAL' && !hasDirective) return Math.min(1.0, base + 0.08);
  return base;
}

export function rankLinesByFit(
  candidates: readonly string[],
  aggressionBand: BackendVoiceprintAggressionBand,
  clarityBand: BackendVoiceprintClarityBand,
): readonly string[] {
  return [...candidates]
    .map((text) => ({
      text,
      score: scoreLineForAggression(text, aggressionBand) + scoreLineForClarity(text, clarityBand),
    }))
    .sort((a, b) => b.score - a.score)
    .map((item) => item.text);
}

// ============================================================================
// MARK: Filtering
// ============================================================================

export function filterResolutionsByAggression(
  resolutions: readonly BackendVoiceprintPolicyResolution[],
  minBand: BackendVoiceprintAggressionBand,
): readonly BackendVoiceprintPolicyResolution[] {
  const threshold = computeAggressionScore(minBand);
  return resolutions.filter((r) => computeAggressionScore(r.aggressionBand) >= threshold);
}

export function filterResolutionsByClarity(
  resolutions: readonly BackendVoiceprintPolicyResolution[],
  minBand: BackendVoiceprintClarityBand,
): readonly BackendVoiceprintPolicyResolution[] {
  const threshold = computeClarityScore(minBand);
  return resolutions.filter((r) => computeClarityScore(r.clarityBand) >= threshold);
}

export function filterResolutionsByFlag(
  resolutions: readonly BackendVoiceprintPolicyResolution[],
  flag: string,
): readonly BackendVoiceprintPolicyResolution[] {
  return resolutions.filter((r) => r.transformationFlags.includes(flag));
}

export function groupResolutionsByAggression(
  resolutions: readonly BackendVoiceprintPolicyResolution[],
): Readonly<Partial<Record<BackendVoiceprintAggressionBand, readonly BackendVoiceprintPolicyResolution[]>>> {
  const grouped: Partial<Record<BackendVoiceprintAggressionBand, BackendVoiceprintPolicyResolution[]>> = {};
  for (const r of resolutions) {
    if (!grouped[r.aggressionBand]) grouped[r.aggressionBand] = [];
    grouped[r.aggressionBand]!.push(r);
  }
  return Object.freeze(grouped);
}

// ============================================================================
// MARK: Namespace export
// ============================================================================

export const VoiceprintPolicyNS = Object.freeze({
  // Core API
  resolveVoiceprintPolicy,
  previewVoiceprintPolicy,
  composePersonaLine,

  // Aggression / clarity resolution
  resolveAggressionBand,
  resolveClarityBand,
  computeAggressionScore,
  computeClarityScore,
  aggressionScoreToBand,
  clarityScoreToBand,
  compareAggressionBands,
  compareClarityBands,

  // Entry / exit style resolution
  resolvePreferredEntryStyle,
  resolvePreferredExitStyle,
  classifyEntryStyle,
  classifyExitStyle,

  // Signature selection
  selectSignatureOpener,
  selectSignatureCloser,

  // Safe and batch resolution
  resolveVoiceprintPolicySafe,
  resolveVoiceprintBatch,
  batchComposeLines,

  // Intent-first API
  resolveVoiceprintForIntent,
  buildCompositionBundle,

  // Intent classification
  isHostileIntent,
  isReflectiveIntent,
  isRescueIntent,
  classifyIntent,
  intentRequiresClarityEscalation,

  // Diagnostics
  buildVoiceprintDiagnostic,
  describeAggressionBand,
  describeClarityBand,
  describeTransformationFlags,
  describeVoiceprintResolution,

  // Diff and comparison
  diffPolicyResolutions,

  // Stats and aggregation
  buildVoiceprintCompositionStats,

  // Persona voiceprint profile
  buildPersonaVoiceprintProfile,
  buildVoiceprintSummary,

  // Line selection with voiceprint shaping
  selectBestLine,
  selectAndComposeLines,

  // Scoring helpers
  scoreLineForAggression,
  scoreLineForClarity,
  rankLinesByFit,

  // Filtering and grouping
  filterResolutionsByAggression,
  filterResolutionsByClarity,
  filterResolutionsByFlag,
  groupResolutionsByAggression,
});