/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT PERSONA DELAY PROFILE RUNTIME
 * FILE: pzo-web/src/engines/chat/persona/PersonaDelayProfile.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Frontend runtime authority for deterministic persona-timing projection. This
 * module turns shared NPC cadence / presence / typing law into stageable reply,
 * hover, typing, pause, interruption, silence, and reveal timing for the
 * frontend chat runtime without claiming backend truth ownership.
 *
 * It is designed for:
 * - typing theater previsualization
 * - staged reveal timing
 * - channel-specific tempo shaping
 * - social-heat-aware swarm pacing
 * - helper / hater / ambient cadence differentiation
 * - weaponized silence support
 * - abortable typing sequences
 * - continuity-safe preview timing across mounts and scenes
 *
 * Design laws
 * -----------
 * 1. Shared contracts own the base cadence and presence law.
 * 2. Backend still decides what actually emits into truth.
 * 3. Frontend timing exists to stage authored behavior faithfully.
 * 4. Delay is not cosmetic. Delay is part of pressure, rescue, intimidation,
 *    ceremony, and witness design.
 * 5. Public channels should feel more exposed; private channels should feel
 *    more intimate and calculating.
 * 6. Silence windows must remain first-class because not every event deserves
 *    immediate text.
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ============================================================================
 */

import type {
  ChatAudienceHeat,
  ChatChannelMood,
  ChatEngineState,
  ChatMessage,
  ChatRelationshipState,
  ChatVisibleChannel,
} from '../types';

import {
  getNpcDescriptor,
  type ChatAnyNpcDescriptor,
  type ChatKnownNpcKey,
} from '../../../../../shared/contracts/chat/ChatNpc';

import type {
  ChatPresenceStyleProfile,
  ChatTypingBurstSegment,
  ChatTypingTheaterPlan,
} from '../../../../../shared/contracts/chat/ChatPresence';

import {
  resolvePersonaStage,
  type ChatPersonaStageId,
} from '../../../../../shared/contracts/chat/persona-evolution';

// ============================================================================
// MARK: Local runtime types
// ============================================================================

export type PersonaDelayCause =
  | 'BASE_CADENCE'
  | 'CHANNEL_HEAT'
  | 'CHANNEL_MOOD'
  | 'RELATIONSHIP_PRESSURE'
  | 'REPUTATION_EXPOSURE'
  | 'SCENE_WITNESS'
  | 'PENDING_REVEAL_QUEUE'
  | 'ACTIVE_SILENCE'
  | 'WEAPONIZED_SILENCE'
  | 'HELPER_PROTECTION'
  | 'RIVALRY_ESCALATION'
  | 'LIVEOPS_BOOST'
  | 'LIVEOPS_BLACKOUT'
  | 'INTERRUPTION_RIGHT'
  | 'ABORTABLE_TYPING'
  | 'HOVER_STALL'
  | 'SHORT_FORM_COMPRESSION'
  | 'LONG_FORM_EXPANSION'
  | 'CEREMONY_STRETCH'
  | 'DEAL_ROOM_CALCULATION';

export type PersonaEntryMode =
  | 'INSTANT_DROP'
  | 'TYPING_REVEAL'
  | 'LURK_THEN_STRIKE'
  | 'CROWD_SWELL'
  | 'WHISPER_REVEAL'
  | 'SYSTEM_CARD';

export type PersonaExitMode =
  | 'HARD_STOP'
  | 'TRAIL_OFF'
  | 'READ_AND_LEAVE'
  | 'SHADOW_PERSIST'
  | 'QUEUE_NEXT_SPEAKER';

export type PersonaInterruptBand = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'ABSOLUTE';

export interface PersonaDelayFactor {
  readonly cause: PersonaDelayCause;
  readonly deltaMs: number;
  readonly weight01: number;
  readonly note: string;
}

export interface PersonaTypingBurstPreview extends ChatTypingBurstSegment {
  readonly emphasis: 'QUIET' | 'BALANCED' | 'AGGRESSIVE' | 'CEREMONIAL';
  readonly revealsPartialText: boolean;
}

export interface PersonaAbortWindow {
  readonly opensAtMs: number;
  readonly closesAtMs: number;
  readonly playerVisible: boolean;
  readonly reason: string;
}

export interface PersonaDelayPlan {
  readonly npcKey: ChatKnownNpcKey;
  readonly npcId: string;
  readonly channelId: ChatVisibleChannel;
  readonly stage: ChatPersonaStageId;
  readonly entryMode: PersonaEntryMode;
  readonly exitMode: PersonaExitMode;
  readonly interruptBand: PersonaInterruptBand;
  readonly floorMs: number;
  readonly ceilMs: number;
  readonly resolvedDelayMs: number;
  readonly hoverMs: number;
  readonly typingLeadInMs: number;
  readonly typingTotalMs: number;
  readonly trailingHoldMs: number;
  readonly readAfterMs: number;
  readonly canInterrupt: boolean;
  readonly canPreemptHelper: boolean;
  readonly canPreemptHater: boolean;
  readonly requiresVisibleMount: boolean;
  readonly respectsActiveSilence: boolean;
  readonly canAbortTyping: boolean;
  readonly abortWindow?: PersonaAbortWindow;
  readonly typingPlan: ChatTypingTheaterPlan;
  readonly burstPreview: readonly PersonaTypingBurstPreview[];
  readonly factors: readonly PersonaDelayFactor[];
  readonly notes: readonly string[];
}

export interface PersonaDelayContext {
  readonly channelId: ChatVisibleChannel;
  readonly now: number;
  readonly bodyPreview?: string;
  readonly sceneId?: string;
  readonly momentId?: string;
  readonly preferInterrupt?: boolean;
  readonly preferSilence?: boolean;
  readonly preferShortForm?: boolean;
  readonly preferLongForm?: boolean;
  readonly authorIntent?: 'TELEGRAPH' | 'TAUNT' | 'RETREAT' | 'HELP' | 'WITNESS' | 'DEAL' | 'SYSTEM';
}

export interface PersonaDelayDiagnostics {
  readonly planCacheEntries: number;
  readonly lastPlanKeys: readonly string[];
}

interface PersonaDelayCacheEntry {
  readonly key: string;
  readonly plan: PersonaDelayPlan;
  readonly createdAt: number;
}

// ============================================================================
// MARK: Constants
// ============================================================================

const DELAY_CACHE_LIMIT = 512;

const CADENCE_BAND_MULTIPLIER = Object.freeze<Record<string, number>>({
  INSTANT: 0.55,
  FAST: 0.80,
  MEASURED: 1.00,
  LINGERING: 1.24,
  CALCULATED: 1.36,
  CINEMATIC: 1.62,
});

const ENTRY_MODE_MULTIPLIER = Object.freeze<Record<PersonaEntryMode, number>>({
  INSTANT_DROP: 0.66,
  TYPING_REVEAL: 1.00,
  LURK_THEN_STRIKE: 1.22,
  CROWD_SWELL: 1.28,
  WHISPER_REVEAL: 1.14,
  SYSTEM_CARD: 0.88,
});

const EXIT_HOLD_MULTIPLIER = Object.freeze<Record<PersonaExitMode, number>>({
  HARD_STOP: 0.20,
  TRAIL_OFF: 0.48,
  READ_AND_LEAVE: 0.34,
  SHADOW_PERSIST: 0.62,
  QUEUE_NEXT_SPEAKER: 0.42,
});

const CHANNEL_DELAY_BIAS = Object.freeze<Record<ChatVisibleChannel, number>>({
  GLOBAL: 1.05,
  SYNDICATE: 1.12,
  DEAL_ROOM: 1.22,
  LOBBY: 0.96,
});

const CHANNEL_TYPING_MULTIPLIER = Object.freeze<Record<ChatVisibleChannel, number>>({
  GLOBAL: 0.96,
  SYNDICATE: 1.08,
  DEAL_ROOM: 1.16,
  LOBBY: 0.90,
});

const MOOD_DELAY_DELTA = Object.freeze<Record<string, number>>({
  CALM: -60,
  SUSPICIOUS: 120,
  HOSTILE: -140,
  ECSTATIC: -90,
  PREDATORY: 180,
  MOURNFUL: 140,
});

const HEAT_TO_DELAY_CURVE = Object.freeze({
  ridiculeWeight: -1.5,
  scrutinyWeight: 1.7,
  hypeWeight: -0.8,
  volatilityWeight: 0.9,
});

const AUTHOR_INTENT_DELAY = Object.freeze<Record<NonNullable<PersonaDelayContext['authorIntent']>, number>>({
  TELEGRAPH: -80,
  TAUNT: -50,
  RETREAT: 40,
  HELP: 90,
  WITNESS: 110,
  DEAL: 180,
  SYSTEM: 0,
});

// ============================================================================
// MARK: Utilities
// ============================================================================

function clampMs(value: number, floor: number, ceil: number): number {
  if (Number.isNaN(value)) return floor;
  if (value <= floor) return Math.round(floor);
  if (value >= ceil) return Math.round(ceil);
  return Math.round(value);
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return Number(value.toFixed(6));
}

function average(values: readonly number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function hashString(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16);
}

function tokenize(body?: string): readonly string[] {
  if (!body) return [];
  return body
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function stageFromState(
  state: ChatEngineState,
  descriptor: ChatAnyNpcDescriptor,
  channelId: ChatVisibleChannel,
): ChatPersonaStageId {
  const relationship = resolveRelationship(state, descriptor);
  const messages = state.messagesByChannel[channelId].filter(
    (message) => message.senderId === descriptor.npcId || message.senderName === descriptor.displayName,
  );
  const careerRuns =
    state.continuity.unresolvedMomentIds.length +
    (state.continuity.carriedPersonaIds.includes(descriptor.personaId) ? 10 : 0) +
    Math.floor(messages.length / 3);
  const meaningfulEvents =
    messages.length +
    (relationship?.callbacksAvailable.length ?? 0) +
    (relationship ? 6 : 0) +
    state.liveOps.activeWorldEvents.length * 3;
  return resolvePersonaStage(careerRuns, meaningfulEvents);
}

function resolveRelationship(
  state: ChatEngineState,
  descriptor: ChatAnyNpcDescriptor,
): ChatRelationshipState | undefined {
  return (
    state.relationshipsByCounterpartId[descriptor.npcId] ??
    state.relationshipsByCounterpartId[descriptor.personaId] ??
    state.relationshipsByCounterpartId[descriptor.displayName]
  );
}

function currentHeat(state: ChatEngineState, channelId: ChatVisibleChannel): ChatAudienceHeat {
  return state.audienceHeat[channelId];
}

function currentMood(state: ChatEngineState, channelId: ChatVisibleChannel): ChatChannelMood {
  return state.channelMoodByChannel[channelId];
}

function estimateBodyComplexity(bodyPreview?: string): number {
  const tokens = tokenize(bodyPreview);
  if (!tokens.length) return 0;
  const unique = new Set(tokens).size;
  const punctuationBurden = (bodyPreview?.match(/[,:;!?-]/g) ?? []).length;
  return average([
    Math.min(1, tokens.length / 24),
    Math.min(1, unique / 18),
    Math.min(1, punctuationBurden / 10),
  ]);
}

function toPersonaEntryMode(descriptor: ChatAnyNpcDescriptor): PersonaEntryMode {
  switch (descriptor.cadence.entryStyle) {
    case 'INSTANT_DROP':
      return 'INSTANT_DROP';
    case 'TYPING_REVEAL':
      return 'TYPING_REVEAL';
    case 'LURK_THEN_STRIKE':
      return 'LURK_THEN_STRIKE';
    case 'CROWD_SWELL':
      return 'CROWD_SWELL';
    case 'WHISPER_REVEAL':
      return 'WHISPER_REVEAL';
    case 'SYSTEM_CARD':
      return 'SYSTEM_CARD';
    default:
      return 'TYPING_REVEAL';
  }
}

function toPersonaExitMode(descriptor: ChatAnyNpcDescriptor): PersonaExitMode {
  switch (descriptor.cadence.exitStyle) {
    case 'HARD_STOP':
      return 'HARD_STOP';
    case 'TRAIL_OFF':
      return 'TRAIL_OFF';
    case 'READ_AND_LEAVE':
      return 'READ_AND_LEAVE';
    case 'SHADOW_PERSIST':
      return 'SHADOW_PERSIST';
    case 'QUEUE_NEXT_SPEAKER':
      return 'QUEUE_NEXT_SPEAKER';
    default:
      return 'TRAIL_OFF';
  }
}

function resolveInterruptBand(
  descriptor: ChatAnyNpcDescriptor,
  state: ChatEngineState,
  channelId: ChatVisibleChannel,
  context: PersonaDelayContext,
): PersonaInterruptBand {
  const relationship = resolveRelationship(state, descriptor);
  const heat = currentHeat(state, channelId);

  if (context.preferInterrupt && descriptor.cadence.canInterrupt) {
    if (descriptor.cadence.canPreemptHelper || descriptor.cadence.canPreemptHater) return 'ABSOLUTE';
    return 'HIGH';
  }

  const pressure01 = clamp01(
    (heat.ridicule / 100) * 0.28 +
      (heat.scrutiny / 100) * 0.20 +
      ((relationship?.vector.rivalryIntensity ?? 0) / 100) * 0.26 +
      ('haterArchetype' in descriptor ? 0.14 : 0),
  );

  if (!descriptor.cadence.canInterrupt) return 'NONE';
  if (pressure01 >= 0.80) return 'HIGH';
  if (pressure01 >= 0.56) return 'MEDIUM';
  if (pressure01 >= 0.28) return 'LOW';
  return 'LOW';
}

function deriveCadenceMultiplier(descriptor: ChatAnyNpcDescriptor): number {
  const fromBand = CADENCE_BAND_MULTIPLIER[descriptor.cadence.band] ?? 1;
  const fromVoiceprint = average([
    descriptor.voiceprint.delayProfileMs[0] / Math.max(1, descriptor.cadence.floorMs),
    descriptor.voiceprint.delayProfileMs[1] / Math.max(1, descriptor.cadence.ceilMs),
  ]);
  return clamp01(fromBand * 0.6 + Math.min(2, fromVoiceprint) * 0.4);
}

function resolvePresenceStyleLatency(style: ChatPresenceStyleProfile): number {
  return style.typicalLatencyMs;
}

function buildFactors(
  state: ChatEngineState,
  descriptor: ChatAnyNpcDescriptor,
  context: PersonaDelayContext,
): readonly PersonaDelayFactor[] {
  const factors: PersonaDelayFactor[] = [];
  const relationship = resolveRelationship(state, descriptor);
  const heat = currentHeat(state, context.channelId);
  const mood = currentMood(state, context.channelId);
  const stage = stageFromState(state, descriptor, context.channelId);
  const bodyComplexity = estimateBodyComplexity(context.bodyPreview);

  factors.push({
    cause: 'BASE_CADENCE',
    deltaMs: 0,
    weight01: 1,
    note: `Base cadence band ${descriptor.cadence.band} with floor ${descriptor.cadence.floorMs} and ceil ${descriptor.cadence.ceilMs}.`,
  });

  const heatDelta = Math.round(
    heat.ridicule * HEAT_TO_DELAY_CURVE.ridiculeWeight +
      heat.scrutiny * HEAT_TO_DELAY_CURVE.scrutinyWeight +
      heat.hype * HEAT_TO_DELAY_CURVE.hypeWeight +
      heat.volatility * HEAT_TO_DELAY_CURVE.volatilityWeight,
  );
  factors.push({
    cause: 'CHANNEL_HEAT',
    deltaMs: heatDelta,
    weight01: clamp01(Math.abs(heatDelta) / 300),
    note: `Heat pressure adjusts timing from ridicule ${heat.ridicule}, scrutiny ${heat.scrutiny}, hype ${heat.hype}, volatility ${heat.volatility}.`,
  });

  const moodDelta = MOOD_DELAY_DELTA[mood.mood] ?? 0;
  factors.push({
    cause: 'CHANNEL_MOOD',
    deltaMs: moodDelta,
    weight01: clamp01(Math.abs(moodDelta) / 220),
    note: `Mood ${mood.mood} changes channel tempo.` ,
  });

  const relationshipDelta = Math.round(
    ((relationship?.vector.rivalryIntensity ?? 0) / 100) * -180 +
      ((relationship?.vector.trust ?? 0) / 100) * 120 +
      ((relationship?.vector.fear ?? 0) / 100) * -90 +
      ((relationship?.vector.familiarity ?? 0) / 100) * 70,
  );
  factors.push({
    cause: 'RELATIONSHIP_PRESSURE',
    deltaMs: relationshipDelta,
    weight01: clamp01(Math.abs(relationshipDelta) / 220),
    note: 'Relationship vector changes how quickly this persona chooses to appear.',
  });

  const reputationDelta = Math.round(
    (state.reputation.publicAura / 100) * -80 +
      (state.reputation.humiliationRisk / 100) * 100 +
      (state.reputation.negotiationFear / 100) * 70,
  );
  factors.push({
    cause: 'REPUTATION_EXPOSURE',
    deltaMs: reputationDelta,
    weight01: clamp01(Math.abs(reputationDelta) / 180),
    note: 'Public aura, humiliation risk, and negotiation fear alter entry pressure.',
  });

  if (state.activeScene?.sceneId || context.sceneId) {
    const witnessDelta = Math.round(
      (state.activeScene?.deliveryPressure01 ?? 0) * 220 +
        (state.activeScene?.audienceWeight01 ?? 0) * 160,
    );
    factors.push({
      cause: 'SCENE_WITNESS',
      deltaMs: witnessDelta,
      weight01: clamp01(Math.abs(witnessDelta) / 300),
      note: 'Active scene witness pressure is stretching delay windows.',
    });
  }

  if (state.pendingReveals.length > 0) {
    const revealDelta = Math.min(360, state.pendingReveals.length * 44);
    factors.push({
      cause: 'PENDING_REVEAL_QUEUE',
      deltaMs: revealDelta,
      weight01: clamp01(revealDelta / 360),
      note: 'Pending reveal queue defers this speaker to preserve ordering.',
    });
  }

  if (state.currentSilence) {
    const silenceDelta = Math.min(520, Math.max(120, (state.currentSilence.untilMs ?? context.now) - context.now));
    factors.push({
      cause: 'ACTIVE_SILENCE',
      deltaMs: silenceDelta,
      weight01: clamp01(silenceDelta / 520),
      note: 'An active silence window is still in force.',
    });
  }

  if (descriptor.typingHints.usesWeaponizedSilence) {
    const delta = 90 + Math.round(heat.scrutiny * 0.8);
    factors.push({
      cause: 'WEAPONIZED_SILENCE',
      deltaMs: delta,
      weight01: clamp01(delta / 220),
      note: 'This persona uses silence as a pressure instrument.',
    });
  }

  if ('helperArchetype' in descriptor && state.liveOps.helperBlackoutActive) {
    factors.push({
      cause: 'LIVEOPS_BLACKOUT',
      deltaMs: 420,
      weight01: 1,
      note: 'Helper blackout is active, stretching helper response timing.',
    });
  }

  if (state.liveOps.boostedCrowdChannels.includes(context.channelId)) {
    factors.push({
      cause: 'LIVEOPS_BOOST',
      deltaMs: -110,
      weight01: 0.66,
      note: 'World event is boosting crowd tempo in this channel.',
    });
  }

  if (resolveInterruptBand(descriptor, state, context.channelId, context) !== 'NONE') {
    const interruptDelta = context.preferInterrupt ? -160 : -60;
    factors.push({
      cause: 'INTERRUPTION_RIGHT',
      deltaMs: interruptDelta,
      weight01: clamp01(Math.abs(interruptDelta) / 180),
      note: 'This persona has a lawful interruption lane.',
    });
  }

  if (descriptor.typingHints.supportsTypingAbortTheater) {
    factors.push({
      cause: 'ABORTABLE_TYPING',
      deltaMs: 70,
      weight01: 0.42,
      note: 'Typing plan reserves an abort window for staged intimidation or hesitation.',
    });
  }

  if (descriptor.typingHints.tendsToHoverBeforeReply) {
    factors.push({
      cause: 'HOVER_STALL',
      deltaMs: 80,
      weight01: 0.38,
      note: 'Persona usually hovers before committing to a reply.',
    });
  }

  if (context.preferShortForm) {
    factors.push({
      cause: 'SHORT_FORM_COMPRESSION',
      deltaMs: -70,
      weight01: 0.50,
      note: 'Context requested short-form output.',
    });
  }

  if (context.preferLongForm) {
    factors.push({
      cause: 'LONG_FORM_EXPANSION',
      deltaMs: 120,
      weight01: 0.58,
      note: 'Context requested long-form output.',
    });
  }

  if (stage === 'MYTHIC' || stage === 'RIVALRIC') {
    factors.push({
      cause: 'CEREMONY_STRETCH',
      deltaMs: 90,
      weight01: stage === 'MYTHIC' ? 0.70 : 0.42,
      note: `Persona stage ${stage} increases ceremony and posture-aware timing.`,
    });
  }

  if (context.channelId === 'DEAL_ROOM') {
    factors.push({
      cause: 'DEAL_ROOM_CALCULATION',
      deltaMs: 150,
      weight01: 0.66,
      note: 'Deal room messages benefit from predatory quiet and calculation time.',
    });
  }

  if (context.authorIntent) {
    const delta = AUTHOR_INTENT_DELAY[context.authorIntent];
    factors.push({
      cause:
        context.authorIntent === 'HELP'
          ? 'HELPER_PROTECTION'
          : context.authorIntent === 'TELEGRAPH' || context.authorIntent === 'TAUNT'
            ? 'RIVALRY_ESCALATION'
            : 'BASE_CADENCE',
      deltaMs: delta,
      weight01: clamp01(Math.abs(delta) / 180),
      note: `Author intent ${context.authorIntent} shapes timing directly.`,
    });
  }

  if (bodyComplexity > 0) {
    const complexityDelta = Math.round(bodyComplexity * 180);
    factors.push({
      cause: 'LONG_FORM_EXPANSION',
      deltaMs: complexityDelta,
      weight01: clamp01(bodyComplexity),
      note: 'Preview body complexity requires more staged typing time.',
    });
  }

  return factors;
}

function resolveBaseBounds(
  descriptor: ChatAnyNpcDescriptor,
  channelId: ChatVisibleChannel,
): { floorMs: number; ceilMs: number } {
  const cadenceMultiplier = deriveCadenceMultiplier(descriptor);
  const channelMultiplier = CHANNEL_DELAY_BIAS[channelId];
  const presenceLatency = resolvePresenceStyleLatency(descriptor.presenceStyle);

  const floorMs = Math.round(
    descriptor.cadence.floorMs * cadenceMultiplier * channelMultiplier +
      descriptor.voiceprint.delayProfileMs[0] * 0.18 +
      presenceLatency * 0.12,
  );

  const ceilMs = Math.round(
    descriptor.cadence.ceilMs * cadenceMultiplier * channelMultiplier +
      descriptor.voiceprint.delayProfileMs[1] * 0.24 +
      presenceLatency * 0.16,
  );

  return {
    floorMs: Math.max(80, floorMs),
    ceilMs: Math.max(floorMs + 80, ceilMs),
  };
}

function buildTypingSegments(
  descriptor: ChatAnyNpcDescriptor,
  context: PersonaDelayContext,
  resolvedDelayMs: number,
): readonly PersonaTypingBurstPreview[] {
  const style = descriptor.presenceStyle;
  const typingMultiplier = CHANNEL_TYPING_MULTIPLIER[context.channelId];
  const tokenCount = Math.max(1, tokenize(context.bodyPreview).length);
  const bodyComplexity = estimateBodyComplexity(context.bodyPreview);
  const segmentCount =
    descriptor.voiceprint.averageSentenceLength === 'LONG'
      ? 3
      : descriptor.voiceprint.averageSentenceLength === 'MEDIUM'
        ? 2
        : 1;

  const previews: PersonaTypingBurstPreview[] = [];
  const baseTypingBudget = Math.max(
    style.typingBurstMinMs,
    Math.round(
      (Math.min(resolvedDelayMs, style.typingBurstMaxMs * segmentCount) * 0.64 +
        tokenCount * 18 +
        bodyComplexity * 240) * typingMultiplier,
    ),
  );

  let remainingTyping = baseTypingBudget;
  for (let index = 0; index < segmentCount; index += 1) {
    const isLast = index === segmentCount - 1;
    const segmentTyping = isLast
      ? Math.max(style.typingBurstMinMs, remainingTyping)
      : Math.max(
          style.typingBurstMinMs,
          Math.min(
            style.typingBurstMaxMs,
            Math.round(baseTypingBudget / segmentCount * (index === 0 ? 1.08 : 0.92)),
          ),
        );

    remainingTyping -= segmentTyping;

    const pauseAfterMs = isLast
      ? 0
      : clampMs(
          Math.round(average([style.pauseMinMs, style.pauseMaxMs]) * (descriptor.typingHints.usesWeaponizedSilence ? 1.2 : 1)),
          style.pauseMinMs,
          style.pauseMaxMs,
        );

    previews.push({
      segmentIndex: index,
      typingMs: segmentTyping,
      pauseAfterMs,
      previewLengthHint: Math.max(2, Math.round((tokenCount / segmentCount) * (index + 1))),
      emphasis:
        descriptor.voiceprint.interruptionStyle === 'SURGE'
          ? 'AGGRESSIVE'
          : descriptor.voiceprint.averageSentenceLength === 'LONG'
            ? 'CEREMONIAL'
            : descriptor.typingHints.tendsToHoverBeforeReply
              ? 'QUIET'
              : 'BALANCED',
      revealsPartialText: !isLast && descriptor.typingHints.supportsTypingAbortTheater,
    });
  }

  return previews;
}

function buildTypingTheaterPlan(
  descriptor: ChatAnyNpcDescriptor,
  previews: readonly PersonaTypingBurstPreview[],
  context: PersonaDelayContext,
): ChatTypingTheaterPlan {
  let running = context.now;
  const expiresAt = previews.reduce((cursor, preview) => cursor + preview.typingMs + preview.pauseAfterMs, context.now);

  return {
    kind: descriptor.presenceStyle.typingTheater,
    token: `${descriptor.npcId}:${context.channelId}:${context.now}` as never,
    startedAt: running as never,
    expiresAt: expiresAt as never,
    segments: previews.map((preview) => {
      running += preview.typingMs + preview.pauseAfterMs;
      return {
        segmentIndex: preview.segmentIndex,
        typingMs: preview.typingMs,
        pauseAfterMs: preview.pauseAfterMs,
        previewLengthHint: preview.previewLengthHint,
      };
    }),
    simulatedByStyleId: descriptor.presenceStyle.styleId,
    playerVisible: descriptor.cadence.requiresVisibleMount,
  };
}

function buildAbortWindow(
  descriptor: ChatAnyNpcDescriptor,
  typingLeadInMs: number,
  typingTotalMs: number,
): PersonaAbortWindow | undefined {
  if (!descriptor.typingHints.supportsTypingAbortTheater) return undefined;
  const openAt = Math.max(0, Math.round(typingLeadInMs + typingTotalMs * 0.24));
  const closeAt = Math.max(openAt + 50, Math.round(typingLeadInMs + typingTotalMs * 0.74));
  return {
    opensAtMs: openAt,
    closesAtMs: closeAt,
    playerVisible: descriptor.cadence.requiresVisibleMount,
    reason: descriptor.typingHints.usesWeaponizedSilence
      ? 'Typing may abort to weaponize uncertainty.'
      : 'Typing may abort for authored hesitation theater.',
  };
}

function deriveReadDelay(descriptor: ChatAnyNpcDescriptor, resolvedDelayMs: number, context: PersonaDelayContext): number {
  const fromStyle = descriptor.presenceStyle.readDelayPolicy === 'VISIBLE_DELAYED'
    ? 220
    : descriptor.presenceStyle.readDelayPolicy === 'HIDDEN'
      ? 0
      : 110;
  const fromChannel = context.channelId === 'DEAL_ROOM' ? 180 : context.channelId === 'SYNDICATE' ? 140 : 90;
  return Math.max(0, Math.round(resolvedDelayMs * 0.18 + fromStyle + fromChannel));
}

function deriveNotes(
  descriptor: ChatAnyNpcDescriptor,
  plan: Omit<PersonaDelayPlan, 'notes'>,
  context: PersonaDelayContext,
): readonly string[] {
  const notes: string[] = [];
  notes.push(`Cadence band ${descriptor.cadence.band} resolved to ${plan.resolvedDelayMs}ms.`);
  notes.push(`Entry ${plan.entryMode}, exit ${plan.exitMode}, interrupt ${plan.interruptBand}.`);
  notes.push(`Typing lead-in ${plan.typingLeadInMs}ms, typing total ${plan.typingTotalMs}ms, trailing hold ${plan.trailingHoldMs}ms.`);
  if (plan.canInterrupt) notes.push('Persona currently retains interruption rights.');
  if (plan.requiresVisibleMount) notes.push('Persona requires a visible mount before reveal.');
  if (plan.respectsActiveSilence) notes.push('Plan respects an active silence window.');
  if (plan.canAbortTyping) notes.push('Typing theater may abort before final reveal.');
  if (context.preferInterrupt) notes.push('Context explicitly requested interrupt posture.');
  if (context.preferSilence) notes.push('Context explicitly requested silence-friendly pacing.');
  if (context.authorIntent) notes.push(`Author intent ${context.authorIntent} influenced plan.`);
  return notes;
}

function finalizeDelay(
  descriptor: ChatAnyNpcDescriptor,
  state: ChatEngineState,
  context: PersonaDelayContext,
  factors: readonly PersonaDelayFactor[],
): PersonaDelayPlan {
  const stage = stageFromState(state, descriptor, context.channelId);
  const baseBounds = resolveBaseBounds(descriptor, context.channelId);
  const entryMode = toPersonaEntryMode(descriptor);
  const exitMode = toPersonaExitMode(descriptor);
  const interruptBand = resolveInterruptBand(descriptor, state, context.channelId, context);

  let resolvedDelay = average([baseBounds.floorMs, baseBounds.ceilMs]);
  for (const factor of factors) {
    resolvedDelay += factor.deltaMs;
  }

  resolvedDelay *= ENTRY_MODE_MULTIPLIER[entryMode];
  if (context.preferSilence) resolvedDelay += 180;

  const floorMs = baseBounds.floorMs;
  const ceilMs = Math.max(baseBounds.ceilMs, floorMs + 100);
  const resolvedDelayMs = clampMs(resolvedDelay, floorMs, ceilMs);

  const previews = buildTypingSegments(descriptor, context, resolvedDelayMs);
  const typingLeadInMs = entryMode === 'INSTANT_DROP' ? 0 : Math.round(resolvedDelayMs * 0.18);
  const typingTotalMs = previews.reduce((sum, preview) => sum + preview.typingMs + preview.pauseAfterMs, 0);
  const trailingHoldMs = Math.round((resolvedDelayMs + typingTotalMs) * EXIT_HOLD_MULTIPLIER[exitMode]);
  const readAfterMs = deriveReadDelay(descriptor, resolvedDelayMs, context);
  const typingPlan = buildTypingTheaterPlan(descriptor, previews, context);
  const abortWindow = buildAbortWindow(descriptor, typingLeadInMs, typingTotalMs);

  const planCore = {
    npcKey: descriptor.npcKey,
    npcId: descriptor.npcId,
    channelId: context.channelId,
    stage,
    entryMode,
    exitMode,
    interruptBand,
    floorMs,
    ceilMs,
    resolvedDelayMs,
    hoverMs: descriptor.typingHints.tendsToHoverBeforeReply ? Math.round(resolvedDelayMs * 0.10) : 0,
    typingLeadInMs,
    typingTotalMs,
    trailingHoldMs,
    readAfterMs,
    canInterrupt: descriptor.cadence.canInterrupt,
    canPreemptHelper: descriptor.cadence.canPreemptHelper,
    canPreemptHater: descriptor.cadence.canPreemptHater,
    requiresVisibleMount: descriptor.cadence.requiresVisibleMount,
    respectsActiveSilence: Boolean(state.currentSilence),
    canAbortTyping: descriptor.typingHints.supportsTypingAbortTheater,
    abortWindow,
    typingPlan,
    burstPreview: previews,
    factors,
  } satisfies Omit<PersonaDelayPlan, 'notes'>;

  return {
    ...planCore,
    notes: deriveNotes(descriptor, planCore, context),
  };
}

export function resolvePersonaDelayPlan(
  state: ChatEngineState,
  npcKey: ChatKnownNpcKey,
  context: PersonaDelayContext,
): PersonaDelayPlan {
  const descriptor = getNpcDescriptor(npcKey);
  const factors = buildFactors(state, descriptor, context);
  return finalizeDelay(descriptor, state, context, factors);
}

export function resolvePersonaDelayPlanForDescriptor(
  state: ChatEngineState,
  descriptor: ChatAnyNpcDescriptor,
  context: PersonaDelayContext,
): PersonaDelayPlan {
  const factors = buildFactors(state, descriptor, context);
  return finalizeDelay(descriptor, state, context, factors);
}

export function resolvePersonaDelayPlanForMessage(
  state: ChatEngineState,
  npcKey: ChatKnownNpcKey,
  message: ChatMessage,
  now: number = Date.now(),
): PersonaDelayPlan {
  return resolvePersonaDelayPlan(state, npcKey, {
    channelId: message.channel,
    now,
    bodyPreview: message.body,
    sceneId: message.sceneId,
    momentId: message.momentId,
    authorIntent: message.kind === 'SYSTEM' ? 'SYSTEM' : 'WITNESS',
  });
}

// ============================================================================
// MARK: Engine class
// ============================================================================

export class PersonaDelayProfiler {
  private readonly cache = new Map<string, PersonaDelayCacheEntry>();
  private readonly lastPlanKeys: string[] = [];

  resolve(
    state: ChatEngineState,
    npcKey: ChatKnownNpcKey,
    context: PersonaDelayContext,
  ): PersonaDelayPlan {
    const key = this.buildCacheKey(state, npcKey, context);
    const cached = this.cache.get(key);
    if (cached) return cached.plan;

    const plan = resolvePersonaDelayPlan(state, npcKey, context);
    this.write(key, plan, context.now);
    return plan;
  }

  resolveForDescriptor(
    state: ChatEngineState,
    descriptor: ChatAnyNpcDescriptor,
    context: PersonaDelayContext,
  ): PersonaDelayPlan {
    const key = this.buildCacheKey(state, descriptor.npcKey, context);
    const cached = this.cache.get(key);
    if (cached) return cached.plan;

    const plan = resolvePersonaDelayPlanForDescriptor(state, descriptor, context);
    this.write(key, plan, context.now);
    return plan;
  }

  resolveForMessage(
    state: ChatEngineState,
    npcKey: ChatKnownNpcKey,
    message: ChatMessage,
    now: number = Date.now(),
  ): PersonaDelayPlan {
    return this.resolve(state, npcKey, {
      channelId: message.channel,
      now,
      bodyPreview: message.body,
      sceneId: message.sceneId,
      momentId: message.momentId,
      authorIntent: message.kind === 'SYSTEM' ? 'SYSTEM' : 'WITNESS',
    });
  }

  clear(): void {
    this.cache.clear();
    this.lastPlanKeys.length = 0;
  }

  diagnostics(): PersonaDelayDiagnostics {
    return {
      planCacheEntries: this.cache.size,
      lastPlanKeys: [...this.lastPlanKeys],
    };
  }

  private buildCacheKey(
    state: ChatEngineState,
    npcKey: ChatKnownNpcKey,
    context: PersonaDelayContext,
  ): string {
    const descriptor = getNpcDescriptor(npcKey);
    const relationship = resolveRelationship(state, descriptor);
    const heat = currentHeat(state, context.channelId);
    const mood = currentMood(state, context.channelId);
    return [
      npcKey,
      context.channelId,
      descriptor.cadence.band,
      descriptor.cadence.entryStyle,
      descriptor.cadence.exitStyle,
      heat.heat,
      heat.hype,
      heat.ridicule,
      heat.scrutiny,
      heat.volatility,
      mood.mood,
      state.reputation.publicAura,
      state.reputation.negotiationFear,
      state.reputation.humiliationRisk,
      relationship?.vector.rivalryIntensity ?? 0,
      relationship?.vector.trust ?? 0,
      relationship?.vector.familiarity ?? 0,
      relationship?.callbacksAvailable.length ?? 0,
      state.currentSilence ? 'silence' : 'open',
      state.pendingReveals.length,
      state.liveOps.activeWorldEvents.length,
      state.liveOps.helperBlackoutActive ? 'helper-blackout' : 'helpers-live',
      state.liveOps.boostedCrowdChannels.includes(context.channelId) ? 'boosted' : 'normal',
      context.preferInterrupt ? 'interrupt' : 'normal',
      context.preferSilence ? 'silence-pref' : 'normal',
      context.preferShortForm ? 'short' : 'normal',
      context.preferLongForm ? 'long' : 'normal',
      context.authorIntent ?? 'none',
      hashString(context.bodyPreview ?? ''),
    ].join('::');
  }

  private write(key: string, plan: PersonaDelayPlan, createdAt: number): void {
    this.cache.set(key, { key, plan, createdAt });
    this.lastPlanKeys.unshift(key);
    if (this.lastPlanKeys.length > 32) this.lastPlanKeys.pop();
    while (this.cache.size > DELAY_CACHE_LIMIT) {
      const oldest = this.cache.keys().next().value;
      if (!oldest) break;
      this.cache.delete(oldest);
    }
  }
}

export const personaDelayProfiler = new PersonaDelayProfiler();

// ============================================================================
// MARK: Convenience helpers
// ============================================================================

export function createPersonaDelayContext(
  channelId: ChatVisibleChannel,
  now: number,
  overrides: Omit<Partial<PersonaDelayContext>, 'channelId' | 'now'> = {},
): PersonaDelayContext {
  return {
    channelId,
    now,
    ...overrides,
  };
}

export function resolvePersonaTypingPreview(
  state: ChatEngineState,
  npcKey: ChatKnownNpcKey,
  context: PersonaDelayContext,
): readonly PersonaTypingBurstPreview[] {
  return personaDelayProfiler.resolve(state, npcKey, context).burstPreview;
}

export function resolvePersonaInterruptBand(
  state: ChatEngineState,
  npcKey: ChatKnownNpcKey,
  context: PersonaDelayContext,
): PersonaInterruptBand {
  return personaDelayProfiler.resolve(state, npcKey, context).interruptBand;
}

export function resolvePersonaAbortWindow(
  state: ChatEngineState,
  npcKey: ChatKnownNpcKey,
  context: PersonaDelayContext,
): PersonaAbortWindow | undefined {
  return personaDelayProfiler.resolve(state, npcKey, context).abortWindow;
}

export function resolvePersonaDelayNotes(
  state: ChatEngineState,
  npcKey: ChatKnownNpcKey,
  context: PersonaDelayContext,
): readonly string[] {
  return personaDelayProfiler.resolve(state, npcKey, context).notes;
}
