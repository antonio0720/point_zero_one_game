/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT PERSONA LATENCY STYLE RESOLVER
 * FILE: backend/src/game/engine/chat/persona/LatencyStyleResolver.ts
 * VERSION: 2026.03.19
 * AUTHORSHIP: Antonio T. Smith Jr.
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

// ============================================================================
// MARK: Timing profiles
// ============================================================================

export interface BackendLatencyTimingProfile {
  readonly npcClass: 'HATER' | 'HELPER' | 'AMBIENT';
  readonly defaultFloorMs: number;
  readonly defaultCeilMs: number;
  readonly interruptionCapable: boolean;
  readonly typingTheaterDefault: boolean;
  readonly urgencyBias: BackendLatencyUrgencyBand;
  readonly queuePenaltyMultiplier: number;
  readonly silenceBeforeDefaultMs: number;
  readonly silenceAfterDefaultMs: number;
  readonly lingerDefaultMs: number;
  readonly maxTypingDurationMs: number;
}

export const LATENCY_TIMING_PROFILES: Readonly<Record<'HATER' | 'HELPER' | 'AMBIENT', BackendLatencyTimingProfile>> = Object.freeze({
  HATER: Object.freeze({
    npcClass: 'HATER' as const,
    defaultFloorMs: 320,
    defaultCeilMs: 960,
    interruptionCapable: true,
    typingTheaterDefault: true,
    urgencyBias: 'MEDIUM' as const,
    queuePenaltyMultiplier: 1.2,
    silenceBeforeDefaultMs: 0,
    silenceAfterDefaultMs: 180,
    lingerDefaultMs: 200,
    maxTypingDurationMs: 900,
  }),
  HELPER: Object.freeze({
    npcClass: 'HELPER' as const,
    defaultFloorMs: 120,
    defaultCeilMs: 520,
    interruptionCapable: true,
    typingTheaterDefault: true,
    urgencyBias: 'LOW' as const,
    queuePenaltyMultiplier: 0.5,
    silenceBeforeDefaultMs: 0,
    silenceAfterDefaultMs: 80,
    lingerDefaultMs: 80,
    maxTypingDurationMs: 420,
  }),
  AMBIENT: Object.freeze({
    npcClass: 'AMBIENT' as const,
    defaultFloorMs: 480,
    defaultCeilMs: 1200,
    interruptionCapable: false,
    typingTheaterDefault: false,
    urgencyBias: 'IDLE' as const,
    queuePenaltyMultiplier: 0.8,
    silenceBeforeDefaultMs: 90,
    silenceAfterDefaultMs: 160,
    lingerDefaultMs: 180,
    maxTypingDurationMs: 600,
  }),
});

export function getTimingProfileForEntry(
  entry: BackendPersonaRegistryEntry,
): BackendLatencyTimingProfile {
  const c = entry.descriptor.npcClass as 'HATER' | 'HELPER' | 'AMBIENT';
  return LATENCY_TIMING_PROFILES[c] ?? LATENCY_TIMING_PROFILES.AMBIENT;
}

export function getTimingProfileForClass(
  npcClass: string,
): BackendLatencyTimingProfile {
  if (npcClass === 'HATER') return LATENCY_TIMING_PROFILES.HATER;
  if (npcClass === 'HELPER') return LATENCY_TIMING_PROFILES.HELPER;
  return LATENCY_TIMING_PROFILES.AMBIENT;
}

// ============================================================================
// MARK: Extended contracts
// ============================================================================

export interface BackendLatencyBatchResult {
  readonly resolutions: readonly BackendLatencyResolution[];
  readonly totalInputs: number;
  readonly successCount: number;
  readonly failureCount: number;
  readonly averageDelayMs: number;
  readonly fastestDelayMs: number;
  readonly slowestDelayMs: number;
  readonly immediateCount: number;
  readonly criticalCount: number;
  readonly typingCount: number;
}

export interface BackendLatencyDiagnostic {
  readonly npcId: string;
  readonly intent: BackendVoiceprintIntent;
  readonly urgency: BackendLatencyUrgencyBand;
  readonly reason: BackendLatencyReason;
  readonly delayMs: number;
  readonly typingDurationMs: number;
  readonly silenceBefore: number;
  readonly silenceAfter: number;
  readonly interruptionAllowed: boolean;
  readonly interruptionPriority: number;
  readonly shadowPrimed: boolean;
  readonly entryStyle: ChatNpcEntryStyle;
  readonly exitStyle: ChatNpcExitStyle;
  readonly notes: readonly string[];
}

export interface BackendLatencySceneAnalysis {
  readonly turnCount: number;
  readonly totalDurationMs: number;
  readonly averageDelayMs: number;
  readonly longestDelayMs: number;
  readonly shortestDelayMs: number;
  readonly immediateCount: number;
  readonly criticalCount: number;
  readonly typingCount: number;
  readonly interruptionCount: number;
  readonly silencePressureMs: number;
  readonly densityScore01: number;
  readonly notes: readonly string[];
}

export interface BackendLatencyStats {
  readonly count: number;
  readonly averageDelayMs: number;
  readonly medianDelayMs: number;
  readonly p90DelayMs: number;
  readonly minDelayMs: number;
  readonly maxDelayMs: number;
  readonly urgencyDistribution: Readonly<Record<BackendLatencyUrgencyBand, number>>;
  readonly reasonDistribution: Readonly<Partial<Record<BackendLatencyReason, number>>>;
  readonly typingRate01: number;
  readonly interruptionRate01: number;
  readonly shadowPrimedRate01: number;
}

export interface BackendLatencyResolutionDiff {
  readonly delayDeltaMs: number;
  readonly urgencyChanged: boolean;
  readonly reasonChanged: boolean;
  readonly entryStyleChanged: boolean;
  readonly exitStyleChanged: boolean;
  readonly interruptionChanged: boolean;
  readonly typingChanged: boolean;
  readonly silenceBeforeDeltaMs: number;
  readonly silenceAfterDeltaMs: number;
  readonly priorityDelta: number;
  readonly summary: string;
}

export interface BackendLatencyChannelContext {
  readonly channelId: string;
  readonly isPublic: boolean;
  readonly isSyndicate: boolean;
  readonly isGlobal: boolean;
  readonly isShadow: boolean;
  readonly publicnessBias: number;
  readonly urgencyAmplifier: number;
  readonly silenceAmplifier: number;
}

export interface BackendLatencyRankEntry {
  readonly input: BackendLatencyResolutionInput;
  readonly interruptionPriority: number;
  readonly urgency: BackendLatencyUrgencyBand;
  readonly estimatedDelayMs: number;
}

// ============================================================================
// MARK: Safe and batch resolution
// ============================================================================

export function resolveLatencyStyleSafe(
  input: BackendLatencyResolutionInput,
): BackendLatencyResolution | null {
  try {
    return resolveLatencyStyle(input);
  } catch {
    return null;
  }
}

export function resolveLatencyBatch(
  inputs: readonly BackendLatencyResolutionInput[],
): BackendLatencyBatchResult {
  const resolutions: BackendLatencyResolution[] = [];
  let successCount = 0;
  let failureCount = 0;
  let immediateCount = 0;
  let criticalCount = 0;
  let typingCount = 0;
  let totalDelay = 0;
  let fastestDelayMs = Number.MAX_SAFE_INTEGER;
  let slowestDelayMs = 0;

  for (const input of inputs) {
    const result = resolveLatencyStyleSafe(input);
    if (!result) {
      failureCount += 1;
      continue;
    }
    resolutions.push(result);
    successCount += 1;
    totalDelay += result.delayMs;
    if (result.delayMs < fastestDelayMs) fastestDelayMs = result.delayMs;
    if (result.delayMs > slowestDelayMs) slowestDelayMs = result.delayMs;
    if (result.urgency === 'IMMEDIATE') immediateCount += 1;
    if (result.urgency === 'CRITICAL') criticalCount += 1;
    if (result.typing.shouldType) typingCount += 1;
  }

  return Object.freeze({
    resolutions: Object.freeze(resolutions),
    totalInputs: inputs.length,
    successCount,
    failureCount,
    averageDelayMs: successCount > 0 ? Math.round(totalDelay / successCount) : 0,
    fastestDelayMs: fastestDelayMs === Number.MAX_SAFE_INTEGER ? 0 : fastestDelayMs,
    slowestDelayMs,
    immediateCount,
    criticalCount,
    typingCount,
  });
}

// ============================================================================
// MARK: Diagnostics
// ============================================================================

export function buildLatencyDiagnostic(
  input: BackendLatencyResolutionInput,
  resolution?: BackendLatencyResolution | null,
): BackendLatencyDiagnostic {
  const resolved = resolution ?? resolveLatencyStyle(input);
  const descriptor = input.entry.descriptor;
  const notes: string[] = [];

  if (resolved.shadowPrimed) {
    notes.push('Shadow primed: entry style promotes stealth reveal.');
  }
  if (resolved.interruptionAllowed) {
    notes.push(`Interruption allowed at priority ${resolved.interruptionPriority}.`);
  }
  if (resolved.silenceWindowBeforeMs > 0) {
    notes.push(`Pre-silence: ${resolved.silenceWindowBeforeMs}ms before delivery.`);
  }
  if (resolved.silenceWindowAfterMs > 0) {
    notes.push(`Post-silence: ${resolved.silenceWindowAfterMs}ms after delivery.`);
  }
  if (resolved.queueCooldownMs > 0) {
    notes.push(`Queue cooldown adds ${resolved.queueCooldownMs}ms.`);
  }
  if (resolved.typing.shouldType) {
    notes.push(`Typing theater: ${resolved.typing.typingDurationMs}ms before reveal.`);
  }
  if (resolved.urgency === 'IMMEDIATE') {
    notes.push('IMMEDIATE urgency: shortest possible delivery path.');
  }

  return Object.freeze({
    npcId: descriptor.npcId,
    intent: input.intent,
    urgency: resolved.urgency,
    reason: resolved.reason,
    delayMs: resolved.delayMs,
    typingDurationMs: resolved.typing.typingDurationMs,
    silenceBefore: resolved.silenceWindowBeforeMs,
    silenceAfter: resolved.silenceWindowAfterMs,
    interruptionAllowed: resolved.interruptionAllowed,
    interruptionPriority: resolved.interruptionPriority,
    shadowPrimed: resolved.shadowPrimed,
    entryStyle: resolved.entryStyle,
    exitStyle: resolved.exitStyle,
    notes: Object.freeze(notes),
  });
}

export function describeUrgencyBand(urgency: BackendLatencyUrgencyBand): string {
  switch (urgency) {
    case 'IMMEDIATE': return 'Immediate — bypass all queuing and deliver at once';
    case 'CRITICAL': return 'Critical — extreme pressure, heavily compressed delay';
    case 'HIGH': return 'High — elevated pressure, shortened timing window';
    case 'MEDIUM': return 'Medium — standard competitive delivery window';
    case 'LOW': return 'Low — relaxed timing, gentle delivery';
    case 'IDLE': return 'Idle — ambient pacing, unhurried crowd presence';
    default: return 'Unknown urgency band';
  }
}

export function describeLatencyReason(reason: BackendLatencyReason): string {
  switch (reason) {
    case 'DEFAULT_CADENCE': return 'Default cadence — no special timing trigger applied';
    case 'HELPER_RESCUE': return 'Helper rescue — timely delivery to support player';
    case 'HATER_STALK': return 'Hater stalk — lurk window applied before strike';
    case 'CALLBACK_STRIKE': return 'Callback strike — receipted memory triggers accelerated delivery';
    case 'AMBIENT_SWELL': return 'Ambient swell — crowd energy rising, delayed natural entry';
    case 'POSTRUN_BREATH': return 'Post-run breath — extended silence to let the result settle';
    case 'PLAYER_COLLAPSE': return 'Player collapse — immediate delivery in crisis window';
    case 'PLAYER_COMEBACK': return 'Player comeback — measured timing to acknowledge recovery';
    case 'NEGOTIATION_PRESSURE': return 'Negotiation pressure — applied tension before offer lands';
    case 'ROOM_MOOD_SHIFT': return 'Room mood shift — timing altered by emotional environment change';
    case 'PUBLIC_EMBARRASSMENT': return 'Public embarrassment — crowd-aware pressure delivery';
    case 'SILENCE_WINDOW': return 'Silence window — deliberate pause as authored mechanic';
    case 'INTERRUPT_PREEMPT': return 'Interrupt preempt — challenger bypassed incumbent speaker';
    case 'QUEUE_COOLDOWN': return 'Queue cooldown — depth-based penalty slowing emission';
    default: return 'Unknown latency reason';
  }
}

export function describeTypingEnvelope(envelope: BackendTypingEnvelope): string {
  if (!envelope.shouldType) return 'No typing theater — instant reveal';
  return [
    `Typing: ${envelope.typingDurationMs}ms`,
    `starts at t=${envelope.typingStartAt}`,
    `reveals at t=${envelope.revealAt}`,
    `lingers ${envelope.lingerMs}ms`,
  ].join(', ');
}

export function describeLatencyResolution(resolution: BackendLatencyResolution): string {
  const parts: string[] = [
    `urgency=${resolution.urgency}`,
    `delay=${resolution.delayMs}ms`,
    `entry=${resolution.entryStyle}`,
    `exit=${resolution.exitStyle}`,
    `reason=${resolution.reason}`,
  ];
  if (resolution.interruptionAllowed) parts.push(`interrupt@${resolution.interruptionPriority}`);
  if (resolution.shadowPrimed) parts.push('shadow');
  if (resolution.typing.shouldType) parts.push(`typing=${resolution.typing.typingDurationMs}ms`);
  return parts.join(' | ');
}

// ============================================================================
// MARK: Scene analysis
// ============================================================================

export function buildSceneTimingAnalysis(
  inputs: readonly BackendLatencyResolutionInput[],
): BackendLatencySceneAnalysis {
  if (inputs.length === 0) {
    return Object.freeze({
      turnCount: 0,
      totalDurationMs: 0,
      averageDelayMs: 0,
      longestDelayMs: 0,
      shortestDelayMs: 0,
      immediateCount: 0,
      criticalCount: 0,
      typingCount: 0,
      interruptionCount: 0,
      silencePressureMs: 0,
      densityScore01: 0,
      notes: Object.freeze([]),
    });
  }

  const preview = previewSceneLatencyBatch(inputs);
  const turns = preview.turns;
  const notes: string[] = [];

  let totalDelay = 0;
  let longestDelayMs = 0;
  let shortestDelayMs = Number.MAX_SAFE_INTEGER;
  let immediateCount = 0;
  let criticalCount = 0;
  let typingCount = 0;
  let interruptionCount = 0;
  let silencePressureMs = 0;

  for (const turn of turns) {
    totalDelay += turn.delayMs;
    if (turn.delayMs > longestDelayMs) longestDelayMs = turn.delayMs;
    if (turn.delayMs < shortestDelayMs) shortestDelayMs = turn.delayMs;
    if (turn.urgency === 'IMMEDIATE') immediateCount += 1;
    if (turn.urgency === 'CRITICAL') criticalCount += 1;
    if (turn.typing.shouldType) typingCount += 1;
    if (turn.interruptionAllowed) interruptionCount += 1;
    silencePressureMs += turn.silenceWindowBeforeMs + turn.silenceWindowAfterMs;
  }

  const averageDelayMs = Math.round(totalDelay / turns.length);
  const densityScore01 = clamp01(1 - silencePressureMs / Math.max(1, preview.totalSceneDurationMs));

  if (immediateCount >= Math.ceil(turns.length * 0.4)) {
    notes.push('High urgency density — multiple IMMEDIATE turns in scene.');
  }
  if (silencePressureMs > preview.totalSceneDurationMs * 0.3) {
    notes.push('High silence pressure — silence windows consume significant scene time.');
  }
  if (typingCount === turns.length) {
    notes.push('All turns use typing theater — full theatrical delivery chain.');
  }
  if (interruptionCount > 1) {
    notes.push(`${interruptionCount} turns are interruption-eligible.`);
  }

  return Object.freeze({
    turnCount: turns.length,
    totalDurationMs: preview.totalSceneDurationMs,
    averageDelayMs,
    longestDelayMs,
    shortestDelayMs: shortestDelayMs === Number.MAX_SAFE_INTEGER ? 0 : shortestDelayMs,
    immediateCount,
    criticalCount,
    typingCount,
    interruptionCount,
    silencePressureMs,
    densityScore01: densityScore01 as number,
    notes: Object.freeze(notes),
  });
}

export function estimateSceneDuration(
  inputs: readonly BackendLatencyResolutionInput[],
): number {
  if (inputs.length === 0) return 0;
  return previewSceneLatencyBatch(inputs).totalSceneDurationMs;
}

export function buildChannelTimingContext(channelId: string): BackendLatencyChannelContext {
  const isGlobal = channelId === 'GLOBAL';
  const isSyndicate = channelId === 'SYNDICATE';
  const isShadow = channelId === 'SYSTEM_SHADOW' || channelId === 'NPC_SHADOW';
  const isPublic = isGlobal || channelId === 'LOBBY' || channelId === 'DEAL_ROOM';

  return Object.freeze({
    channelId,
    isPublic,
    isSyndicate,
    isGlobal,
    isShadow,
    publicnessBias: isGlobal ? 0.18 : isSyndicate ? -0.08 : isShadow ? -0.24 : 0.06,
    urgencyAmplifier: isGlobal ? 1.12 : isSyndicate ? 0.94 : isShadow ? 0.72 : 1.0,
    silenceAmplifier: isShadow ? 0.5 : isSyndicate ? 0.88 : 1.0,
  });
}

export function resolveLatencyForChannel(
  input: BackendLatencyResolutionInput,
  channelId: string,
): BackendLatencyResolution {
  const channelCtx = buildChannelTimingContext(channelId);
  const base = normalizeLatencyContext(input.context);
  const adjustedContext: BackendVoiceprintContext = {
    ...base,
    publicHeat01: clamp01((base.publicHeat01 ?? 0) + channelCtx.publicnessBias) as number,
  };
  return resolveLatencyStyle({ ...input, context: adjustedContext });
}

// ============================================================================
// MARK: Comparison and diff
// ============================================================================

export function compareLatencyResolutions(
  a: BackendLatencyResolution,
  b: BackendLatencyResolution,
): number {
  if (a.delayMs !== b.delayMs) return a.delayMs - b.delayMs;
  return b.interruptionPriority - a.interruptionPriority;
}

export function diffLatencyResolutions(
  baseline: BackendLatencyResolution,
  updated: BackendLatencyResolution,
): BackendLatencyResolutionDiff {
  const delayDeltaMs = updated.delayMs - baseline.delayMs;
  const priorityDelta = updated.interruptionPriority - baseline.interruptionPriority;
  const urgencyChanged = updated.urgency !== baseline.urgency;
  const reasonChanged = updated.reason !== baseline.reason;
  const entryStyleChanged = updated.entryStyle !== baseline.entryStyle;
  const exitStyleChanged = updated.exitStyle !== baseline.exitStyle;
  const interruptionChanged = updated.interruptionAllowed !== baseline.interruptionAllowed;
  const typingChanged = updated.typing.shouldType !== baseline.typing.shouldType;
  const silenceBeforeDeltaMs = updated.silenceWindowBeforeMs - baseline.silenceWindowBeforeMs;
  const silenceAfterDeltaMs = updated.silenceWindowAfterMs - baseline.silenceWindowAfterMs;

  const changes: string[] = [];
  if (delayDeltaMs !== 0) changes.push(`delay${delayDeltaMs > 0 ? '+' : ''}${delayDeltaMs}ms`);
  if (urgencyChanged) changes.push(`urgency:${baseline.urgency}→${updated.urgency}`);
  if (reasonChanged) changes.push(`reason:${baseline.reason}→${updated.reason}`);
  if (entryStyleChanged) changes.push(`entry:${baseline.entryStyle}→${updated.entryStyle}`);
  if (exitStyleChanged) changes.push(`exit:${baseline.exitStyle}→${updated.exitStyle}`);
  if (interruptionChanged) changes.push(`interrupt:${String(baseline.interruptionAllowed)}→${String(updated.interruptionAllowed)}`);
  if (typingChanged) changes.push(`typing:${String(baseline.typing.shouldType)}→${String(updated.typing.shouldType)}`);

  return Object.freeze({
    delayDeltaMs,
    urgencyChanged,
    reasonChanged,
    entryStyleChanged,
    exitStyleChanged,
    interruptionChanged,
    typingChanged,
    silenceBeforeDeltaMs,
    silenceAfterDeltaMs,
    priorityDelta,
    summary: changes.length > 0 ? changes.join(', ') : 'no change',
  });
}

export function compareByDelay(
  a: BackendLatencyResolution,
  b: BackendLatencyResolution,
): number {
  return a.delayMs - b.delayMs;
}

export function compareByInterruptionPriority(
  a: BackendLatencyResolution,
  b: BackendLatencyResolution,
): number {
  return b.interruptionPriority - a.interruptionPriority;
}

// ============================================================================
// MARK: Stats and aggregation
// ============================================================================

export function buildLatencyStats(
  resolutions: readonly BackendLatencyResolution[],
): BackendLatencyStats {
  if (resolutions.length === 0) {
    return Object.freeze({
      count: 0,
      averageDelayMs: 0,
      medianDelayMs: 0,
      p90DelayMs: 0,
      minDelayMs: 0,
      maxDelayMs: 0,
      urgencyDistribution: Object.freeze({ IDLE: 0, LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0, IMMEDIATE: 0 }),
      reasonDistribution: Object.freeze({}),
      typingRate01: 0,
      interruptionRate01: 0,
      shadowPrimedRate01: 0,
    });
  }

  const delays = resolutions.map((r) => r.delayMs).sort((a, b) => a - b);
  const totalDelay = delays.reduce((sum, d) => sum + d, 0);
  const averageDelayMs = Math.round(totalDelay / delays.length);
  const medianDelayMs = delays[Math.floor(delays.length / 2)] ?? 0;
  const p90DelayMs = delays[Math.floor(delays.length * 0.9)] ?? 0;
  const minDelayMs = delays[0] ?? 0;
  const maxDelayMs = delays[delays.length - 1] ?? 0;

  const urgencyDist: Record<BackendLatencyUrgencyBand, number> = {
    IDLE: 0, LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0, IMMEDIATE: 0,
  };
  const reasonDist: Partial<Record<BackendLatencyReason, number>> = {};
  let typingCount = 0;
  let interruptionCount = 0;
  let shadowCount = 0;

  for (const r of resolutions) {
    urgencyDist[r.urgency] = (urgencyDist[r.urgency] ?? 0) + 1;
    reasonDist[r.reason] = (reasonDist[r.reason] ?? 0) + 1;
    if (r.typing.shouldType) typingCount += 1;
    if (r.interruptionAllowed) interruptionCount += 1;
    if (r.shadowPrimed) shadowCount += 1;
  }

  return Object.freeze({
    count: resolutions.length,
    averageDelayMs,
    medianDelayMs,
    p90DelayMs,
    minDelayMs,
    maxDelayMs,
    urgencyDistribution: Object.freeze(urgencyDist),
    reasonDistribution: Object.freeze(reasonDist),
    typingRate01: clamp01(typingCount / resolutions.length) as number,
    interruptionRate01: clamp01(interruptionCount / resolutions.length) as number,
    shadowPrimedRate01: clamp01(shadowCount / resolutions.length) as number,
  });
}

export function computeAverageDelay(resolutions: readonly BackendLatencyResolution[]): number {
  if (!resolutions.length) return 0;
  return Math.round(resolutions.reduce((sum, r) => sum + r.delayMs, 0) / resolutions.length);
}

export function computeAverageTypingDuration(resolutions: readonly BackendLatencyResolution[]): number {
  const withTyping = resolutions.filter((r) => r.typing.shouldType);
  if (!withTyping.length) return 0;
  return Math.round(withTyping.reduce((sum, r) => sum + r.typing.typingDurationMs, 0) / withTyping.length);
}

export function summarizeUrgencyDistribution(
  resolutions: readonly BackendLatencyResolution[],
): string {
  if (!resolutions.length) return 'no resolutions';
  const bands: BackendLatencyUrgencyBand[] = ['IMMEDIATE', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'IDLE'];
  return bands
    .map((band) => ({ band, count: resolutions.filter((r) => r.urgency === band).length }))
    .filter((item) => item.count > 0)
    .map((item) => `${item.band}:${item.count}`)
    .join(', ');
}

// ============================================================================
// MARK: Interruption scoring
// ============================================================================

export function computeInterruptionScore(
  input: BackendLatencyResolutionInput,
): number {
  const resolution = resolveLatencyStyle(input);
  if (!resolution.interruptionAllowed) return 0;
  return resolution.interruptionPriority;
}

export function isInterruptEligible(
  input: BackendLatencyResolutionInput,
  activeSpeakerNpcId: string,
): boolean {
  if (input.allowInterruption === false) return false;
  if (input.entry.descriptor.npcId === activeSpeakerNpcId) return false;
  const resolution = resolveLatencyStyle({ ...input, activeSpeakerNpcId });
  return resolution.interruptionAllowed;
}

export function buildInterruptionMatrix(
  inputs: readonly BackendLatencyResolutionInput[],
): ReadonlyArray<{
  readonly challengerId: string;
  readonly incumbentId: string;
  readonly decision: BackendInterruptionDecision;
}> {
  const results: Array<{
    readonly challengerId: string;
    readonly incumbentId: string;
    readonly decision: BackendInterruptionDecision;
  }> = [];

  for (let i = 0; i < inputs.length; i += 1) {
    for (let j = 0; j < inputs.length; j += 1) {
      if (i === j) continue;
      const challenger = inputs[i];
      const incumbent = inputs[j];
      if (!challenger || !incumbent) continue;
      results.push({
        challengerId: challenger.entry.descriptor.npcId,
        incumbentId: incumbent.entry.descriptor.npcId,
        decision: resolveInterruptionDecision(challenger, incumbent),
      });
    }
  }

  return Object.freeze(results);
}

export function resolveSceneInterruptionOrder(
  inputs: readonly BackendLatencyResolutionInput[],
): readonly BackendLatencyResolutionInput[] {
  return [...inputs].sort((a, b) => {
    const ctxA = normalizeLatencyContext(a.context);
    const ctxB = normalizeLatencyContext(b.context);
    const urgencyA = resolveUrgencyBand(a.entry, a.intent, ctxA);
    const urgencyB = resolveUrgencyBand(b.entry, b.intent, ctxB);
    const pA = resolveInterruptionPriority(a.entry.descriptor, a.intent, urgencyA, ctxA, a.sceneTurnIndex ?? 0);
    const pB = resolveInterruptionPriority(b.entry.descriptor, b.intent, urgencyB, ctxB, b.sceneTurnIndex ?? 0);
    return pB - pA;
  });
}

// ============================================================================
// MARK: Ranking
// ============================================================================

export function rankInputsByPriority(
  inputs: readonly BackendLatencyResolutionInput[],
): readonly BackendLatencyRankEntry[] {
  return [...inputs]
    .map((input) => {
      const context = normalizeLatencyContext(input.context);
      const urgency = resolveUrgencyBand(input.entry, input.intent, context);
      const aggrBand = resolveAggressionBand(input.entry, input.intent, context);
      const entryStyle = resolvePreferredEntryStyle(input.entry.descriptor, input.intent, aggrBand, context);
      const interruptionPriority = resolveInterruptionPriority(
        input.entry.descriptor,
        input.intent,
        urgency,
        context,
        input.sceneTurnIndex ?? 0,
      );
      const seed = input.seed ?? buildLatencySeed(input, context);
      const estimatedDelayMs = resolveBaseDelayMs(
        input.entry.descriptor,
        input.intent,
        context,
        urgency,
        entryStyle,
        input.queueDepth ?? 0,
        seed,
      );
      return Object.freeze({ input, interruptionPriority, urgency, estimatedDelayMs });
    })
    .sort((a, b) => b.interruptionPriority - a.interruptionPriority);
}

export function rankInputsByUrgency(
  inputs: readonly BackendLatencyResolutionInput[],
): readonly BackendLatencyRankEntry[] {
  const urgencyOrder: Record<BackendLatencyUrgencyBand, number> = {
    IMMEDIATE: 6, CRITICAL: 5, HIGH: 4, MEDIUM: 3, LOW: 2, IDLE: 1,
  };
  return [...rankInputsByPriority(inputs)].sort(
    (a, b) => (urgencyOrder[b.urgency] ?? 0) - (urgencyOrder[a.urgency] ?? 0),
  );
}

export function rankResolutionsByDelay(
  resolutions: readonly BackendLatencyResolution[],
): readonly BackendLatencyResolution[] {
  return [...resolutions].sort(compareByDelay);
}

export function findFastestResolution(
  resolutions: readonly BackendLatencyResolution[],
): BackendLatencyResolution | null {
  if (!resolutions.length) return null;
  return resolutions.reduce((fastest, r) => (r.delayMs < fastest.delayMs ? r : fastest));
}

export function findSlowestResolution(
  resolutions: readonly BackendLatencyResolution[],
): BackendLatencyResolution | null {
  if (!resolutions.length) return null;
  return resolutions.reduce((slowest, r) => (r.delayMs > slowest.delayMs ? r : slowest));
}

// ============================================================================
// MARK: Serialization
// ============================================================================

export function serializeLatencyResolution(resolution: BackendLatencyResolution): string {
  return JSON.stringify({
    urgency: resolution.urgency,
    reason: resolution.reason,
    delayMs: resolution.delayMs,
    revealAt: resolution.revealAt,
    entryStyle: resolution.entryStyle,
    exitStyle: resolution.exitStyle,
    typing: {
      shouldType: resolution.typing.shouldType,
      typingDurationMs: resolution.typing.typingDurationMs,
      lingerMs: resolution.typing.lingerMs,
    },
    interruptionAllowed: resolution.interruptionAllowed,
    interruptionPriority: resolution.interruptionPriority,
    shadowPrimed: resolution.shadowPrimed,
    silenceWindowBeforeMs: resolution.silenceWindowBeforeMs,
    silenceWindowAfterMs: resolution.silenceWindowAfterMs,
    queueCooldownMs: resolution.queueCooldownMs,
  });
}

export function serializeTypingEnvelope(envelope: BackendTypingEnvelope): string {
  return JSON.stringify({
    shouldType: envelope.shouldType,
    typingStartAt: envelope.typingStartAt,
    typingEndAt: envelope.typingEndAt,
    typingDurationMs: envelope.typingDurationMs,
    revealAt: envelope.revealAt,
    lingerMs: envelope.lingerMs,
  });
}

export function serializeBatchPreview(preview: BackendLatencyBatchPreview): string {
  return JSON.stringify({
    turns: preview.turns.map((t) => ({
      urgency: t.urgency,
      delayMs: t.delayMs,
      entryStyle: t.entryStyle,
      typingDurationMs: t.typing.typingDurationMs,
    })),
    totalSceneDurationMs: preview.totalSceneDurationMs,
    finalRevealAt: preview.finalRevealAt,
  });
}

// ============================================================================
// MARK: Utility exports
// ============================================================================

export function resolveUrgencyBandFromScore(score01: number): BackendLatencyUrgencyBand {
  if (score01 >= 0.92) return 'IMMEDIATE';
  if (score01 >= 0.78) return 'CRITICAL';
  if (score01 >= 0.62) return 'HIGH';
  if (score01 >= 0.44) return 'MEDIUM';
  if (score01 >= 0.24) return 'LOW';
  return 'IDLE';
}

export function urgencyBandToScore(urgency: BackendLatencyUrgencyBand): number {
  switch (urgency) {
    case 'IMMEDIATE': return 1.0;
    case 'CRITICAL': return 0.85;
    case 'HIGH': return 0.70;
    case 'MEDIUM': return 0.52;
    case 'LOW': return 0.32;
    case 'IDLE': return 0.12;
    default: return 0;
  }
}

export function clampLatencyDelayMs(value: number, floorMs: number, ceilMs: number): number {
  if (Number.isNaN(value)) return floorMs;
  return Math.max(floorMs, Math.min(ceilMs, Math.floor(value)));
}

export function buildMinimalLatencyInput(
  entry: BackendPersonaRegistryEntry,
  intent: BackendVoiceprintIntent,
  now?: number,
): BackendLatencyResolutionInput {
  return Object.freeze({ entry, intent, now: now ?? Date.now() });
}

export function latencyResolutionIsImmediate(resolution: BackendLatencyResolution): boolean {
  return resolution.urgency === 'IMMEDIATE';
}

export function latencyResolutionIsCritical(resolution: BackendLatencyResolution): boolean {
  return resolution.urgency === 'CRITICAL' || resolution.urgency === 'IMMEDIATE';
}

export function latencyResolutionNeedsTyping(resolution: BackendLatencyResolution): boolean {
  return resolution.typing.shouldType;
}

export function resolveLatencyReasonFromContext(
  entry: BackendPersonaRegistryEntry,
  intent: BackendVoiceprintIntent,
  context: BackendVoiceprintContext,
): BackendLatencyReason {
  const urgency = resolveUrgencyBand(entry, intent, context);
  const entryStyle = resolvePreferredEntryStyle(
    entry.descriptor,
    intent,
    resolveAggressionBand(entry, intent, context),
    context,
  );
  return resolveLatencyReason(entry, intent, context, urgency, entryStyle);
}

export function buildLatencyPresenceSummary(
  entry: BackendPersonaRegistryEntry,
  intent: BackendVoiceprintIntent,
  context?: BackendVoiceprintContext | null,
  now?: number,
): string {
  const resolution = resolveLatencyStyle({
    entry,
    intent,
    context,
    now: now ?? Date.now(),
  });
  const parts: string[] = [
    `[${entry.descriptor.npcClass}:${entry.runtime.runtimeDisplayName}]`,
    `intent=${intent}`,
    describeLatencyResolution(resolution),
  ];
  return parts.join(' ');
}

export function buildLatencyReport(
  entries: readonly BackendPersonaRegistryEntry[],
  intent: BackendVoiceprintIntent,
  context?: BackendVoiceprintContext | null,
  now?: number,
): string {
  const t = now ?? Date.now();
  const lines = entries.map((entry) =>
    buildLatencyPresenceSummary(entry, intent, context, t),
  );
  return lines.join('\n');
}

export function compareLatencyInputsByClass(
  a: BackendLatencyResolutionInput,
  b: BackendLatencyResolutionInput,
): number {
  const classOrder: Record<string, number> = { HELPER: 0, HATER: 1, AMBIENT: 2 };
  const ca = classOrder[a.entry.descriptor.npcClass] ?? 3;
  const cb = classOrder[b.entry.descriptor.npcClass] ?? 3;
  return ca - cb;
}

export function filterInputsByUrgency(
  inputs: readonly BackendLatencyResolutionInput[],
  minUrgency: BackendLatencyUrgencyBand,
): readonly BackendLatencyResolutionInput[] {
  const threshold = urgencyBandToScore(minUrgency);
  return inputs.filter((input) => {
    const ctx = normalizeLatencyContext(input.context);
    const urgency = resolveUrgencyBand(input.entry, input.intent, ctx);
    return urgencyBandToScore(urgency) >= threshold;
  });
}

export function filterResolutionsByUrgency(
  resolutions: readonly BackendLatencyResolution[],
  minUrgency: BackendLatencyUrgencyBand,
): readonly BackendLatencyResolution[] {
  const threshold = urgencyBandToScore(minUrgency);
  return resolutions.filter((r) => urgencyBandToScore(r.urgency) >= threshold);
}

export function groupResolutionsByUrgency(
  resolutions: readonly BackendLatencyResolution[],
): Readonly<Partial<Record<BackendLatencyUrgencyBand, readonly BackendLatencyResolution[]>>> {
  const grouped: Partial<Record<BackendLatencyUrgencyBand, BackendLatencyResolution[]>> = {};
  for (const r of resolutions) {
    if (!grouped[r.urgency]) grouped[r.urgency] = [];
    grouped[r.urgency]!.push(r);
  }
  return Object.freeze(grouped);
}

export function groupResolutionsByReason(
  resolutions: readonly BackendLatencyResolution[],
): Readonly<Partial<Record<BackendLatencyReason, readonly BackendLatencyResolution[]>>> {
  const grouped: Partial<Record<BackendLatencyReason, BackendLatencyResolution[]>> = {};
  for (const r of resolutions) {
    if (!grouped[r.reason]) grouped[r.reason] = [];
    grouped[r.reason]!.push(r);
  }
  return Object.freeze(grouped);
}

export function buildTimingProfileSummary(profile: BackendLatencyTimingProfile): string {
  return [
    `[${profile.npcClass}]`,
    `floor=${profile.defaultFloorMs}ms`,
    `ceil=${profile.defaultCeilMs}ms`,
    `interrupt=${String(profile.interruptionCapable)}`,
    `typing=${String(profile.typingTheaterDefault)}`,
    `urgencyBias=${profile.urgencyBias}`,
    `queuePenalty=x${profile.queuePenaltyMultiplier}`,
  ].join(' | ');
}

// ============================================================================
// MARK: Namespace export
// ============================================================================

export const LatencyStyleResolverNS = Object.freeze({
  // Core API
  resolveLatencyStyle,
  resolveInterruptionDecision,
  previewSceneLatencyBatch,

  // Timing profiles
  LATENCY_TIMING_PROFILES,
  getTimingProfileForEntry,
  getTimingProfileForClass,
  buildTimingProfileSummary,

  // Urgency and priority
  resolveUrgencyBand,
  resolveInterruptionPriority,
  canInterrupt,
  resolveUrgencyBandFromScore,
  urgencyBandToScore,

  // Delay resolution
  resolveBaseDelayMs,
  resolveQueueCooldownMs,
  resolveSilenceWindowBefore,
  resolveSilenceWindowAfter,
  clampLatencyDelayMs,

  // Typing theater
  resolveTypingEnvelope,
  shouldUseTypingTheater,
  resolveTypingDurationMs,
  resolveLingerMs,

  // Reason routing
  resolveLatencyReason,
  resolveLatencyReasonFromContext,

  // Safe and batch resolution
  resolveLatencyStyleSafe,
  resolveLatencyBatch,

  // Diagnostics
  buildLatencyDiagnostic,
  describeUrgencyBand,
  describeLatencyReason,
  describeTypingEnvelope,
  describeLatencyResolution,
  buildLatencyPresenceSummary,
  buildLatencyReport,

  // Scene analysis
  buildSceneTimingAnalysis,
  estimateSceneDuration,
  buildChannelTimingContext,
  resolveLatencyForChannel,

  // Comparison and diff
  compareLatencyResolutions,
  diffLatencyResolutions,
  compareByDelay,
  compareByInterruptionPriority,
  compareLatencyInputsByClass,

  // Stats and aggregation
  buildLatencyStats,
  computeAverageDelay,
  computeAverageTypingDuration,
  summarizeUrgencyDistribution,

  // Interruption scoring
  computeInterruptionScore,
  isInterruptEligible,
  buildInterruptionMatrix,
  resolveSceneInterruptionOrder,

  // Ranking
  rankInputsByPriority,
  rankInputsByUrgency,
  rankResolutionsByDelay,
  findFastestResolution,
  findSlowestResolution,

  // Filtering and grouping
  filterInputsByUrgency,
  filterResolutionsByUrgency,
  groupResolutionsByUrgency,
  groupResolutionsByReason,

  // Serialization
  serializeLatencyResolution,
  serializeTypingEnvelope,
  serializeBatchPreview,

  // Utility
  buildMinimalLatencyInput,
  latencyResolutionIsImmediate,
  latencyResolutionIsCritical,
  latencyResolutionNeedsTyping,
});