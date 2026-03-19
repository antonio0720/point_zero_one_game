/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT PERSONA LATENCY STYLE RESOLVER
 * FILE: backend/src/game/engine/chat/persona/LatencyStyleResolver.ts
 * VERSION: 2026.03.19
 * AUTHORSHIP: OpenAI for Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Authoritative backend timing resolver for persona-driven message reveal,
 * typing theater, interruption rights, linger windows, and staged silence.
 *
 * This module is where persona cadence stops being metadata and starts being
 * simulation behavior.
 *
 * It answers:
 * - How long should this persona wait before speaking?
 * - Should it appear instantly, type first, lurk, or arrive as a swell?
 * - Does this line deserve silence before it lands?
 * - Can this persona interrupt another?
 * - How should rescue, hater pressure, callbacks, and ambient crowd heat alter
 *   the timing envelope?
 *
 * Design laws
 * -----------
 * - Shared contracts own cadence capability.
 * - Backend registry owns persona truth.
 * - This module owns runtime latency resolution.
 * - Delay is authored pressure, not cosmetic garnish.
 * - Silence is a mechanic.
 * - Helpers should feel timely, not spammy.
 * - Haters may weaponize delay.
 * - Ambient crowd should feel alive, but never noisy by accident.
 * ============================================================================
 */

import type {
  ChatAnyNpcDescriptor,
  ChatNpcCadenceBand,
  ChatNpcEntryStyle,
  ChatNpcExitStyle,
} from '../../../../../../shared/contracts/chat/ChatNpc';
import type { Score01, UnixMs } from '../../../../../../shared/contracts/chat/ChatChannels';
import type {
  BackendPersonaRegistryEntry,
  BackendPersonaRoomMood,
  BackendPersonaSelectionContext,
} from './PersonaRegistry';
import type {
  BackendVoiceprintContext,
  BackendVoiceprintIntent,
} from './VoiceprintPolicy';
import {
  resolveAggressionBand,
  resolvePreferredEntryStyle,
  resolvePreferredExitStyle,
} from './VoiceprintPolicy';

// ============================================================================
// MARK: Public contracts
// ============================================================================

export type BackendLatencyUrgencyBand =
  | 'IDLE'
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'CRITICAL'
  | 'IMMEDIATE';

export type BackendLatencyReason =
  | 'DEFAULT_CADENCE'
  | 'HELPER_RESCUE'
  | 'HATER_STALK'
  | 'CALLBACK_STRIKE'
  | 'AMBIENT_SWELL'
  | 'POSTRUN_BREATH'
  | 'PLAYER_COLLAPSE'
  | 'PLAYER_COMEBACK'
  | 'NEGOTIATION_PRESSURE'
  | 'ROOM_MOOD_SHIFT'
  | 'PUBLIC_EMBARRASSMENT'
  | 'SILENCE_WINDOW'
  | 'INTERRUPT_PREEMPT'
  | 'QUEUE_COOLDOWN';

export interface BackendLatencyResolutionInput {
  readonly entry: BackendPersonaRegistryEntry;
  readonly intent: BackendVoiceprintIntent;
  readonly context?: BackendVoiceprintContext | BackendPersonaSelectionContext | null;
  readonly now?: UnixMs | number | null;
  readonly queueDepth?: number | null;
  readonly alreadyTypingNpcIds?: readonly string[] | null;
  readonly activeSpeakerNpcId?: string | null;
  readonly previousSpeakerNpcId?: string | null;
  readonly previousSpeakerExitAt?: number | null;
  readonly sceneTurnIndex?: number | null;
  readonly sceneTurnCount?: number | null;
  readonly allowInterruption?: boolean;
  readonly seed?: string | null;
}

export interface BackendTypingEnvelope {
  readonly shouldType: boolean;
  readonly typingStartAt: number;
  readonly typingEndAt: number;
  readonly typingDurationMs: number;
  readonly revealAt: number;
  readonly lingerMs: number;
}

export interface BackendLatencyResolution {
  readonly urgency: BackendLatencyUrgencyBand;
  readonly reason: BackendLatencyReason;
  readonly delayMs: number;
  readonly revealAt: number;
  readonly entryStyle: ChatNpcEntryStyle;
  readonly exitStyle: ChatNpcExitStyle;
  readonly typing: BackendTypingEnvelope;
  readonly interruptionAllowed: boolean;
  readonly interruptionPriority: number;
  readonly shadowPrimed: boolean;
  readonly silenceWindowBeforeMs: number;
  readonly silenceWindowAfterMs: number;
  readonly queueCooldownMs: number;
}

export interface BackendInterruptionDecision {
  readonly allowed: boolean;
  readonly challengerPriority: number;
  readonly incumbentPriority: number;
  readonly winningNpcId: string | null;
  readonly reason:
    | 'CHALLENGER_PREEMPTS'
    | 'INCUMBENT_HOLDS'
    | 'NO_ACTIVE_SPEAKER'
    | 'INTERRUPTION_DISABLED';
}

export interface BackendLatencyBatchPreview {
  readonly turns: readonly BackendLatencyResolution[];
  readonly totalSceneDurationMs: number;
  readonly finalRevealAt: number;
}

// ============================================================================
// MARK: Public API
// ============================================================================

export function resolveLatencyStyle(
  input: BackendLatencyResolutionInput,
): BackendLatencyResolution {
  const context = normalizeLatencyContext(input.context);
  const entry = input.entry;
  const descriptor = entry.descriptor;
  const now = normalizeNow(input.now);
  const seed = input.seed ?? buildLatencySeed(input, context);

  const aggressionBand = resolveAggressionBand(entry, input.intent, context);
  const entryStyle = resolvePreferredEntryStyle(
    descriptor,
    input.intent,
    aggressionBand,
    context,
  );
  const exitStyle = resolvePreferredExitStyle(
    descriptor,
    input.intent,
    aggressionBand,
    context,
  );

  const urgency = resolveUrgencyBand(entry, input.intent, context);
  const interruptionPriority = resolveInterruptionPriority(
    descriptor,
    input.intent,
    urgency,
    context,
    input.sceneTurnIndex ?? 0,
  );

  const interruptionAllowed = Boolean(
    input.allowInterruption !== false &&
      canInterrupt(descriptor, input.intent, context, urgency),
  );

  const silenceWindowBeforeMs = resolveSilenceWindowBefore(
    descriptor,
    input.intent,
    context,
    urgency,
    entryStyle,
  );

  const baseDelayMs = resolveBaseDelayMs(
    descriptor,
    input.intent,
    context,
    urgency,
    entryStyle,
    input.queueDepth ?? 0,
    seed,
  );

  const interruptionAdjustedDelayMs =
    interruptionAllowed &&
    input.activeSpeakerNpcId &&
    input.activeSpeakerNpcId !== descriptor.npcId
      ? Math.max(0, Math.floor(baseDelayMs * 0.42))
      : baseDelayMs;

  const queueCooldownMs = resolveQueueCooldownMs(
    descriptor,
    input.intent,
    context,
    input.queueDepth ?? 0,
  );

  const delayMs = Math.max(0, silenceWindowBeforeMs + interruptionAdjustedDelayMs + queueCooldownMs);
  const revealAt = now + delayMs;

  const typing = resolveTypingEnvelope(
    descriptor,
    input.intent,
    context,
    urgency,
    entryStyle,
    revealAt,
    seed,
  );

  const silenceWindowAfterMs = resolveSilenceWindowAfter(
    descriptor,
    input.intent,
    context,
    urgency,
    exitStyle,
  );

  const reason = resolveLatencyReason(entry, input.intent, context, urgency, entryStyle);

  const shadowPrimed =
    entryStyle === 'LURK_THEN_STRIKE' ||
    entryStyle === 'WHISPER_REVEAL' ||
    urgency === 'CRITICAL';

  return Object.freeze({
    urgency,
    reason,
    delayMs,
    revealAt,
    entryStyle,
    exitStyle,
    typing,
    interruptionAllowed,
    interruptionPriority,
    shadowPrimed,
    silenceWindowBeforeMs,
    silenceWindowAfterMs,
    queueCooldownMs,
  });
}

export function resolveInterruptionDecision(
  challenger: BackendLatencyResolutionInput,
  incumbent: BackendLatencyResolutionInput,
): BackendInterruptionDecision {
  if (challenger.allowInterruption === false) {
    return Object.freeze({
      allowed: false,
      challengerPriority: 0,
      incumbentPriority: 0,
      winningNpcId: incumbent.entry.descriptor.npcId,
      reason: 'INTERRUPTION_DISABLED',
    });
  }

  const incumbentId = incumbent.entry.descriptor.npcId;
  if (!incumbentId) {
    return Object.freeze({
      allowed: true,
      challengerPriority: 0,
      incumbentPriority: 0,
      winningNpcId: challenger.entry.descriptor.npcId,
      reason: 'NO_ACTIVE_SPEAKER',
    });
  }

  const challengerResolved = resolveLatencyStyle(challenger);
  const incumbentResolved = resolveLatencyStyle({ ...incumbent, allowInterruption: false });

  const challengerPriority = challengerResolved.interruptionPriority;
  const incumbentPriority = incumbentResolved.interruptionPriority;

  if (!challengerResolved.interruptionAllowed) {
    return Object.freeze({
      allowed: false,
      challengerPriority,
      incumbentPriority,
      winningNpcId: incumbentId,
      reason: 'INTERRUPTION_DISABLED',
    });
  }

  if (challengerPriority > incumbentPriority) {
    return Object.freeze({
      allowed: true,
      challengerPriority,
      incumbentPriority,
      winningNpcId: challenger.entry.descriptor.npcId,
      reason: 'CHALLENGER_PREEMPTS',
    });
  }

  return Object.freeze({
    allowed: false,
    challengerPriority,
    incumbentPriority,
    winningNpcId: incumbentId,
    reason: 'INCUMBENT_HOLDS',
  });
}

export function previewSceneLatencyBatch(
  inputs: readonly BackendLatencyResolutionInput[],
): BackendLatencyBatchPreview {
  let cursor = 0;
  const turns: BackendLatencyResolution[] = [];

  for (let index = 0; index < inputs.length; index += 1) {
    const input = inputs[index];
    const resolved = resolveLatencyStyle({
      ...input,
      now: cursor,
      sceneTurnIndex: index,
      sceneTurnCount: inputs.length,
    });
    turns.push(resolved);
    cursor =
      resolved.revealAt +
      resolved.typing.lingerMs +
      resolved.silenceWindowAfterMs;
  }

  return Object.freeze({
    turns: Object.freeze(turns),
    totalSceneDurationMs: cursor,
    finalRevealAt: turns.at(-1)?.revealAt ?? 0,
  });
}

// ============================================================================
// MARK: Urgency / priority
// ============================================================================

export function resolveUrgencyBand(
  entry: BackendPersonaRegistryEntry,
  intent: BackendVoiceprintIntent,
  context?: BackendVoiceprintContext | null,
): BackendLatencyUrgencyBand {
  const descriptor = entry.descriptor;
  const embarrassment01 = clamp01(context?.embarrassment01);
  const desperation01 = clamp01(context?.desperation01);
  const publicHeat01 = clamp01(context?.publicHeat01);
  const callbackDemand01 = clamp01(context?.callbackDemand01);
  const negotiationDemand01 = clamp01(context?.negotiationDemand01);

  if (descriptor.npcClass === 'HELPER') {
    if (context?.playerCollapsed || intent === 'RESCUE') return 'IMMEDIATE';
    if (desperation01 >= 0.70) return 'CRITICAL';
    if (context?.playerComeback) return 'MEDIUM';
    return 'LOW';
  }

  if (descriptor.npcClass === 'AMBIENT') {
    if (publicHeat01 >= 0.78) return 'HIGH';
    if (intent === 'WITNESS' && embarrassment01 >= 0.52) return 'MEDIUM';
    if (intent === 'POSTRUN') return 'LOW';
    return 'IDLE';
  }

  if (intent === 'CALLBACK' && callbackDemand01 >= 0.45) return 'CRITICAL';
  if (intent === 'NEGOTIATION' && negotiationDemand01 >= 0.48) return 'HIGH';
  if (publicHeat01 >= 0.88) return 'CRITICAL';
  if (desperation01 >= 0.80) return 'HIGH';
  if (embarrassment01 >= 0.60) return 'HIGH';
  return 'MEDIUM';
}

export function resolveInterruptionPriority(
  descriptor: ChatAnyNpcDescriptor,
  intent: BackendVoiceprintIntent,
  urgency: BackendLatencyUrgencyBand,
  context?: BackendVoiceprintContext | null,
  sceneTurnIndex = 0,
): number {
  let priority = 0;

  switch (urgency) {
    case 'IMMEDIATE':
      priority += 100;
      break;
    case 'CRITICAL':
      priority += 80;
      break;
    case 'HIGH':
      priority += 60;
      break;
    case 'MEDIUM':
      priority += 40;
      break;
    case 'LOW':
      priority += 20;
      break;
    case 'IDLE':
    default:
      priority += 10;
      break;
  }

  if (descriptor.npcClass === 'HELPER' && (intent === 'RESCUE' || context?.playerCollapsed)) {
    priority += 24;
  }

  if (descriptor.npcClass === 'HATER' && intent === 'CALLBACK') {
    priority += 18;
  }

  if (descriptor.npcClass === 'AMBIENT' && intent === 'WITNESS') {
    priority += 8;
  }

  priority -= Math.min(10, sceneTurnIndex);

  return priority;
}

export function canInterrupt(
  descriptor: ChatAnyNpcDescriptor,
  intent: BackendVoiceprintIntent,
  context: BackendVoiceprintContext,
  urgency: BackendLatencyUrgencyBand,
): boolean {
  if (!descriptor.cadence.canInterrupt) return false;

  if (descriptor.npcClass === 'HELPER') {
    return intent === 'RESCUE' || Boolean(context.playerCollapsed);
  }

  if (descriptor.npcClass === 'AMBIENT') {
    return false;
  }

  return urgency === 'CRITICAL' || urgency === 'IMMEDIATE' || intent === 'CALLBACK';
}

// ============================================================================
// MARK: Delay resolution
// ============================================================================

export function resolveBaseDelayMs(
  descriptor: ChatAnyNpcDescriptor,
  intent: BackendVoiceprintIntent,
  context: BackendVoiceprintContext,
  urgency: BackendLatencyUrgencyBand,
  entryStyle: ChatNpcEntryStyle,
  queueDepth: number,
  seed: string,
): number {
  const [floorMs, ceilMs] = descriptor.voiceprint.delayProfileMs;
  const cadenceFloor = descriptor.cadence.floorMs;
  const cadenceCeil = descriptor.cadence.ceilMs;

  let lower = Math.max(0, Math.min(floorMs, cadenceFloor));
  let upper = Math.max(lower, Math.max(ceilMs, cadenceCeil));

  const moodScale = resolveRoomMoodScale(context.roomMood);
  const urgencyScale = resolveUrgencyScale(urgency);
  const queuePenalty = Math.max(0, queueDepth) * resolveQueuePenalty(descriptor, intent);
  const heatCompression = descriptor.npcClass !== 'HELPER'
    ? Math.floor(140 * clamp01(context.publicHeat01))
    : 0;

  let span = Math.max(0, upper - lower);
  let rolled = deterministicRange(lower, upper, `${seed}::delay`);

  rolled = Math.floor(rolled * moodScale * urgencyScale);
  rolled += queuePenalty;
  rolled -= heatCompression;

  if (descriptor.npcClass === 'HELPER' && (intent === 'RESCUE' || context.playerCollapsed)) {
    rolled = Math.min(rolled, Math.max(70, lower));
  }

  if (descriptor.npcClass === 'HATER' && entryStyle === 'LURK_THEN_STRIKE') {
    rolled = Math.max(rolled, lower + Math.floor(span * 0.35));
  }

  if (descriptor.npcClass === 'AMBIENT' && entryStyle === 'CROWD_SWELL') {
    rolled = Math.max(rolled, lower + Math.floor(span * 0.18));
  }

  return clampMs(rolled);
}

export function resolveQueueCooldownMs(
  descriptor: ChatAnyNpcDescriptor,
  intent: BackendVoiceprintIntent,
  context: BackendVoiceprintContext,
  queueDepth: number,
): number {
  if (queueDepth <= 0) return 0;

  if (descriptor.npcClass === 'HELPER' && (intent === 'RESCUE' || context.playerCollapsed)) {
    return 0;
  }

  if (descriptor.npcClass === 'AMBIENT') {
    return Math.min(220, queueDepth * 32);
  }

  return Math.min(420, queueDepth * 58);
}

export function resolveSilenceWindowBefore(
  descriptor: ChatAnyNpcDescriptor,
  intent: BackendVoiceprintIntent,
  context: BackendVoiceprintContext,
  urgency: BackendLatencyUrgencyBand,
  entryStyle: ChatNpcEntryStyle,
): number {
  if (descriptor.npcClass === 'HELPER' && (intent === 'RESCUE' || context.playerCollapsed)) {
    return 0;
  }

  if (entryStyle === 'LURK_THEN_STRIKE') {
    return urgency === 'CRITICAL' ? 140 : 260;
  }

  if (descriptor.npcClass === 'AMBIENT' && entryStyle === 'CROWD_SWELL') {
    return 90;
  }

  if (intent === 'POSTRUN') {
    return 220;
  }

  return 0;
}

export function resolveSilenceWindowAfter(
  descriptor: ChatAnyNpcDescriptor,
  intent: BackendVoiceprintIntent,
  context: BackendVoiceprintContext,
  urgency: BackendLatencyUrgencyBand,
  exitStyle: ChatNpcExitStyle,
): number {
  if (descriptor.npcClass === 'HELPER' && intent === 'RESCUE') {
    return context.rescueWindowOpen ? 60 : 140;
  }

  if (descriptor.npcClass === 'AMBIENT' && exitStyle === 'TRAIL_OFF') {
    return 160;
  }

  if (descriptor.npcClass === 'HATER' && exitStyle === 'SHADOW_PERSIST') {
    return urgency === 'CRITICAL' ? 240 : 180;
  }

  if (intent === 'POSTRUN') {
    return 260;
  }

  return 80;
}

// ============================================================================
// MARK: Typing theater
// ============================================================================

export function resolveTypingEnvelope(
  descriptor: ChatAnyNpcDescriptor,
  intent: BackendVoiceprintIntent,
  context: BackendVoiceprintContext,
  urgency: BackendLatencyUrgencyBand,
  entryStyle: ChatNpcEntryStyle,
  revealAt: number,
  seed: string,
): BackendTypingEnvelope {
  const shouldType = shouldUseTypingTheater(descriptor, intent, context, urgency, entryStyle);

  if (!shouldType) {
    return Object.freeze({
      shouldType: false,
      typingStartAt: revealAt,
      typingEndAt: revealAt,
      typingDurationMs: 0,
      revealAt,
      lingerMs: resolveLingerMs(descriptor, intent, urgency),
    });
  }

  const typingDurationMs = resolveTypingDurationMs(descriptor, intent, urgency, seed);
  const typingStartAt = Math.max(0, revealAt - typingDurationMs);
  const typingEndAt = revealAt;

  return Object.freeze({
    shouldType: true,
    typingStartAt,
    typingEndAt,
    typingDurationMs,
    revealAt,
    lingerMs: resolveLingerMs(descriptor, intent, urgency),
  });
}

export function shouldUseTypingTheater(
  descriptor: ChatAnyNpcDescriptor,
  intent: BackendVoiceprintIntent,
  context: BackendVoiceprintContext,
  urgency: BackendLatencyUrgencyBand,
  entryStyle: ChatNpcEntryStyle,
): boolean {
  if (entryStyle === 'INSTANT_DROP' || entryStyle === 'SYSTEM_CARD') return false;
  if (entryStyle === 'TYPING_REVEAL') return true;
  if (entryStyle === 'LURK_THEN_STRIKE') return true;
  if (entryStyle === 'WHISPER_REVEAL') return true;
  if (descriptor.npcClass === 'HELPER' && (intent === 'RESCUE' || context.playerCollapsed)) {
    return urgency !== 'IMMEDIATE';
  }
  if (descriptor.npcClass === 'AMBIENT') return entryStyle === 'CROWD_SWELL';
  return urgency !== 'IMMEDIATE';
}

export function resolveTypingDurationMs(
  descriptor: ChatAnyNpcDescriptor,
  intent: BackendVoiceprintIntent,
  urgency: BackendLatencyUrgencyBand,
  seed: string,
): number {
  const [floor, ceil] = descriptor.voiceprint.delayProfileMs;

  let minMs = Math.max(60, Math.min(floor, descriptor.cadence.floorMs));
  let maxMs = Math.max(minMs + 40, Math.min(ceil, descriptor.cadence.ceilMs));

  if (descriptor.npcClass === 'HELPER' && intent === 'RESCUE') {
    maxMs = Math.min(maxMs, 420);
  }

  if (descriptor.npcClass === 'HATER' && intent === 'CALLBACK') {
    minMs += 90;
    maxMs += 120;
  }

  if (urgency === 'IMMEDIATE') {
    minMs = Math.min(minMs, 90);
    maxMs = Math.min(maxMs, 180);
  }

  return deterministicRange(minMs, maxMs, `${seed}::typing`);
}

export function resolveLingerMs(
  descriptor: ChatAnyNpcDescriptor,
  intent: BackendVoiceprintIntent,
  urgency: BackendLatencyUrgencyBand,
): number {
  if (descriptor.npcClass === 'HELPER' && intent === 'RESCUE') return 90;
  if (descriptor.npcClass === 'AMBIENT' && (intent === 'AMBIENT' || intent === 'WITNESS')) {
    return 180;
  }
  if (descriptor.npcClass === 'HATER' && urgency === 'CRITICAL') return 220;
  return 120;
}

// ============================================================================
// MARK: Reason routing
// ============================================================================

export function resolveLatencyReason(
  entry: BackendPersonaRegistryEntry,
  intent: BackendVoiceprintIntent,
  context: BackendVoiceprintContext,
  urgency: BackendLatencyUrgencyBand,
  entryStyle: ChatNpcEntryStyle,
): BackendLatencyReason {
  const descriptor = entry.descriptor;

  if (descriptor.npcClass === 'HELPER' && (intent === 'RESCUE' || context.playerCollapsed)) {
    return context.playerCollapsed ? 'PLAYER_COLLAPSE' : 'HELPER_RESCUE';
  }

  if (descriptor.npcClass === 'HATER' && entryStyle === 'LURK_THEN_STRIKE') {
    return 'HATER_STALK';
  }

  if (intent === 'CALLBACK') return 'CALLBACK_STRIKE';
  if (intent === 'NEGOTIATION') return 'NEGOTIATION_PRESSURE';
  if (descriptor.npcClass === 'AMBIENT' && entryStyle === 'CROWD_SWELL') return 'AMBIENT_SWELL';
  if (intent === 'POSTRUN') return 'POSTRUN_BREATH';
  if (urgency === 'CRITICAL' && clamp01(context.publicHeat01) >= 0.75) {
    return 'PUBLIC_EMBARRASSMENT';
  }
  if (context.roomMood && context.roomMood !== 'CALM') return 'ROOM_MOOD_SHIFT';
  return 'DEFAULT_CADENCE';
}

// ============================================================================
// MARK: Utility
// ============================================================================

function normalizeLatencyContext(
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

function normalizeNow(now?: number | null): number {
  if (now == null || Number.isNaN(now)) return Date.now();
  return Math.max(0, Math.floor(now));
}

function buildLatencySeed(
  input: BackendLatencyResolutionInput,
  context: BackendVoiceprintContext,
): string {
  return [
    input.entry.sharedKey,
    input.entry.runtime.runtimePersonaId,
    input.intent,
    context.roomMood ?? 'room:none',
    context.pressureBand ?? 'pressure:none',
    String(context.embarrassment01 ?? 0),
    String(context.publicHeat01 ?? 0),
    String(input.queueDepth ?? 0),
    String(input.sceneTurnIndex ?? 0),
  ].join('::');
}

function resolveRoomMoodScale(roomMood?: BackendPersonaRoomMood | null): number {
  switch (roomMood) {
    case 'HOSTILE':
      return 0.84;
    case 'PREDATORY':
      return 0.78;
    case 'TENSE':
      return 0.90;
    case 'WATCHFUL':
      return 0.96;
    case 'MOURNFUL':
      return 1.08;
    case 'CALM':
    default:
      return 1;
  }
}

function resolveUrgencyScale(urgency: BackendLatencyUrgencyBand): number {
  switch (urgency) {
    case 'IMMEDIATE':
      return 0.22;
    case 'CRITICAL':
      return 0.42;
    case 'HIGH':
      return 0.68;
    case 'MEDIUM':
      return 0.92;
    case 'LOW':
      return 1.08;
    case 'IDLE':
    default:
      return 1.24;
  }
}

function resolveQueuePenalty(
  descriptor: ChatAnyNpcDescriptor,
  intent: BackendVoiceprintIntent,
): number {
  if (descriptor.npcClass === 'HELPER' && intent === 'RESCUE') return 0;
  if (descriptor.npcClass === 'AMBIENT') return 24;
  return 48;
}

function deterministicRange(min: number, max: number, seed: string): number {
  if (max <= min) return min;
  const span = max - min;
  return min + (positiveHash(seed) % (span + 1));
}

function positiveHash(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Mathul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

/**
 * Small wrapper to avoid accidental typo duplication in hot utility code.
 */
function Mathul(a: number, b: number): number {
  return Math.imul(a, b);
}

function clampMs(value: number): number {
  if (Number.isNaN(value) || value <= 0) return 0;
  return Math.floor(value);
}

function clamp01(value: number | null | undefined): Score01 | number {
  if (value == null || Number.isNaN(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return Number(value.toFixed(6));
}