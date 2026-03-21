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
  ChatNpcCadenceBand,
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