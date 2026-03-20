/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT TYPING SIMULATION ENGINE
 * FILE: backend/src/game/engine/chat/presence/TypingSimulationEngine.ts
 * VERSION: 2026.03.19
 * AUTHORSHIP: OpenAI for Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Authoritative backend runtime that turns presence style, latency law,
 * silence windows, and read-delay policy into actual typing theater plans.
 *
 * This file is the bridge from static descriptors to felt timing:
 * - fake starts,
 * - hover-and-stop behavior,
 * - lurk windows,
 * - helper read-then-enter behavior,
 * - deal-room unread pressure,
 * - rival weaponized delay,
 * - shadow mirrored staging,
 * - instant strike exceptions.
 *
 * Design laws
 * -----------
 * 1. Typing is emotional choreography, not decoration.
 * 2. Presence style decides posture; typing style decides cadence.
 * 3. Silence policy may delay or compress the window.
 * 4. Read policy may mirror into unread pressure.
 * 5. The backend decides the plan; transport and UI merely display it.
 * ============================================================================
 */

import type {
  ChatChannelId,
  ChatRoomId,
  ChatShadowChannel,
  JsonValue,
  Score01,
  UnixMs,
} from '../types';

import type { ChatActorKind, ChatAuthority } from '../../../../../../shared/contracts/chat/ChatEvents';

import {
  type ChatPresenceStyleProfile,
} from '../../../../../../shared/contracts/chat/ChatPresence';

import {
  CHAT_TYPING_STYLE_PROFILES,
  getDefaultTypingTimeoutMs,
  resolveTypingStyleForActor,
  type ChatReadDelayPlan,
  type ChatReadHeadSnapshot,
  type ChatReadReceiptRecord,
  type ChatTypingBurstSegment,
  type ChatTypingPauseSegment,
  type ChatTypingSimulationPlan,
  type ChatTypingSource,
  type ChatTypingStyleProfile,
  type ChatTypingTheaterCue,
  type ChatTypingTriggerKind,
  type ChatTypingVisibilityClass,
  type ChatTypingWindow,
  type ChatTypingWindowId,
  type ChatTypingPlanId,
  type ChatTypingCueId,
} from '../../../../../../shared/contracts/chat/ChatTyping';

import {
  PresenceStyleResolver,
  type PresenceStyleResolution,
  type PresenceStyleResolutionInput,
} from './PresenceStyleResolver';

import {
  ReadReceiptPolicy,
  type ReadReceiptResolution,
  type ReadReceiptResolutionInput,
} from './ReadReceiptPolicy';

import {
  resolveLatencyStyle,
  previewSceneLatencyBatch,
  type BackendLatencyResolution,
  type BackendLatencyResolutionInput,
} from '../persona/LatencyStyleResolver';

import {
  ChatSilencePolicy,
  type ChatSilenceDecision,
} from '../experience/ChatSilencePolicy';

/* ============================================================================
 * MARK: Scalar helpers
 * ============================================================================
 */

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function clamp01(value: number | Score01 | null | undefined): number {
  if (value == null || Number.isNaN(value as number)) return 0;
  const numeric = Number(value);
  if (numeric <= 0) return 0;
  if (numeric >= 1) return 1;
  return Number(numeric.toFixed(6));
}

function round(value: number): number {
  return Math.round(value);
}

function nowMs(now?: number | UnixMs | null): number {
  if (typeof now === 'number' && Number.isFinite(now)) return Math.floor(now);
  return Date.now();
}

function positiveHash(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function deterministicRange(min: number, max: number, seed: string): number {
  if (max <= min) return min;
  const span = max - min;
  return min + (positiveHash(seed) % (span + 1));
}

function asAuthority(value?: ChatAuthority | null): ChatAuthority {
  return (value ?? ('BACKEND' as ChatAuthority));
}

function channelFamily(channelId: ChatChannelId): 'PUBLIC' | 'NEGOTIATION' | 'LOBBY' | 'SHADOW' {
  switch (channelId) {
    case 'DEAL_ROOM':
      return 'NEGOTIATION';
    case 'LOBBY':
      return 'LOBBY';
    case 'SYSTEM_SHADOW':
    case 'NPC_SHADOW':
    case 'RIVALRY_SHADOW':
    case 'RESCUE_SHADOW':
    case 'LIVEOPS_SHADOW':
      return 'SHADOW';
    default:
      return 'PUBLIC';
  }
}

function companionShadowChannel(channelId: ChatChannelId): ChatShadowChannel | undefined {
  switch (channelId) {
    case 'GLOBAL':
    case 'LOBBY':
      return 'NPC_SHADOW';
    case 'SYNDICATE':
      return 'RIVALRY_SHADOW';
    case 'DEAL_ROOM':
      return 'SYSTEM_SHADOW';
    case 'SYSTEM_SHADOW':
    case 'NPC_SHADOW':
    case 'RIVALRY_SHADOW':
    case 'RESCUE_SHADOW':
    case 'LIVEOPS_SHADOW':
      return channelId;
    default:
      return undefined;
  }
}

function resolveSource(actorKind: ChatActorKind, family: ReturnType<typeof channelFamily>): ChatTypingSource {
  switch (actorKind) {
    case 'HELPER':
      return 'HELPER_POLICY';
    case 'HATER':
      return family === 'NEGOTIATION' ? 'NEGOTIATION_POLICY' : 'HATER_POLICY';
    case 'NPC':
      return 'NPC_PERSONA';
    case 'LIVEOPS':
      return 'LIVEOPS_POLICY';
    case 'SYSTEM':
      return 'SYSTEM_SYNTHESIS';
    default:
      return 'NPC_DIRECTOR';
  }
}

function resolveTrigger(
  actorKind: ChatActorKind,
  intent?: string | null,
  family?: ReturnType<typeof channelFamily>,
): ChatTypingTriggerKind {
  if (intent === 'RESCUE') return 'RESCUE_PENDING';
  if (intent === 'NEGOTIATION' || family === 'NEGOTIATION') return 'NEGOTIATION_STALL';
  if (intent === 'CALLBACK') return 'INTERRUPTION_WINDOW';
  if (intent === 'COUNTER') return 'COUNTERPLAY_WINDOW';
  if (intent === 'LIVEOPS' || actorKind === 'LIVEOPS') return 'WORLD_EVENT_SURGE';
  if (actorKind === 'HATER') return 'HATER_ESCALATION';
  if (actorKind === 'HELPER') return 'HELPER_INTERVENTION';
  return 'MESSAGE_RECEIVED';
}

/* ============================================================================
 * MARK: Engine contracts
 * ============================================================================
 */

export interface TypingSimulationEngineConfig {
  readonly version: string;
  readonly minBurstCount: number;
  readonly maxBurstCount: number;
  readonly minPauseCount: number;
  readonly maxPauseCount: number;
  readonly fakeStartWindowFloorMs: number;
  readonly fakeStartWindowCeilingMs: number;
  readonly fakeStopWindowFloorMs: number;
  readonly fakeStopWindowCeilingMs: number;
  readonly idleTailFloorMs: number;
  readonly idleTailCeilingMs: number;
  readonly companionShadowEnabled: boolean;
  readonly respectSilenceNotBefore: boolean;
}

const DEFAULT_CONFIG: TypingSimulationEngineConfig = Object.freeze({
  version: '2026.03.19',
  minBurstCount: 1,
  maxBurstCount: 4,
  minPauseCount: 0,
  maxPauseCount: 3,
  fakeStartWindowFloorMs: 240,
  fakeStartWindowCeilingMs: 1200,
  fakeStopWindowFloorMs: 120,
  fakeStopWindowCeilingMs: 900,
  idleTailFloorMs: 120,
  idleTailCeilingMs: 900,
  companionShadowEnabled: true,
  respectSilenceNotBefore: true,
});

export interface TypingSimulationRequest {
  readonly actorId: string;
  readonly actorKind: ChatActorKind;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly authority?: ChatAuthority | null;
  readonly now?: UnixMs | number | null;
  readonly seed?: string | null;
  readonly messageId?: string | null;
  readonly companionMessageId?: string | null;
  readonly visibleMessageLengthHint?: number | null;
  readonly expectedMessageLengthHint?: number | null;
  readonly unreadCount?: number | null;
  readonly allowAbortWithoutMessage?: boolean;
  readonly allowInterruption?: boolean;
  readonly activeSpeakerNpcId?: string | null;
  readonly previousSpeakerNpcId?: string | null;
  readonly queueDepth?: number | null;
  readonly sceneTurnIndex?: number | null;
  readonly sceneTurnCount?: number | null;
  readonly intent?: PresenceStyleResolutionInput['intent'];
  readonly pressure01?: number | Score01 | null;
  readonly audienceHeat01?: number | Score01 | null;
  readonly negotiationPressure01?: number | Score01 | null;
  readonly helperNeed01?: number | Score01 | null;
  readonly embarrassment01?: number | Score01 | null;
  readonly relationshipIntensity01?: number | Score01 | null;
  readonly relationshipObsession01?: number | Score01 | null;
  readonly relationshipRespect01?: number | Score01 | null;
  readonly relationshipFear01?: number | Score01 | null;
  readonly relationshipContempt01?: number | Score01 | null;
  readonly callbackOpportunity01?: number | Score01 | null;
  readonly worldEventActive?: boolean;
  readonly shouldWeaponizeDelay?: boolean;
  readonly shouldSuppressVisibleReceipt?: boolean;
  readonly shouldShadowPrime?: boolean;
  readonly allowInstantStrike?: boolean;
  readonly silenceDecision?: ChatSilenceDecision | null;
  readonly silenceContext?: Parameters<ChatSilencePolicy['evaluate']>[0] | null;
  readonly latency?: BackendLatencyResolution | null;
  readonly latencyInput?: BackendLatencyResolutionInput | null;
  readonly presence?: PresenceStyleResolution | null;
  readonly readResolution?: ReadReceiptResolution | null;
  readonly metadata?: Readonly<Record<string, JsonValue>> | null;
  readonly tags?: readonly string[] | null;
}

export interface TypingSimulationResult {
  readonly actorId: string;
  readonly actorKind: ChatActorKind;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly authority: ChatAuthority;
  readonly family: ReturnType<typeof channelFamily>;
  readonly presence: PresenceStyleResolution;
  readonly latency: BackendLatencyResolution;
  readonly silenceDecision?: ChatSilenceDecision;
  readonly typingStyle: ChatTypingStyleProfile;
  readonly typingWindow: ChatTypingWindow;
  readonly typingPlan: ChatTypingSimulationPlan;
  readonly typingCue: ChatTypingTheaterCue;
  readonly readResolution: ReadReceiptResolution;
  readonly readDelayPlan?: ChatReadDelayPlan;
  readonly receipt?: ChatReadReceiptRecord;
  readonly readHead?: ChatReadHeadSnapshot;
  readonly fakeStartsAt?: number;
  readonly fakeStopsAt?: number;
  readonly revealAt: number;
  readonly shadowCompanionChannel?: ChatShadowChannel;
  readonly reasons: readonly string[];
  readonly generatedAt: number;
}

export interface TypingSimulationBatchResult {
  readonly generatedAt: number;
  readonly totalSceneDurationMs: number;
  readonly finalRevealAt: number;
  readonly turns: readonly TypingSimulationResult[];
}

/* ============================================================================
 * MARK: Window and segment builders
 * ============================================================================
 */

function typingVisibility(
  presence: PresenceStyleResolution,
  typingStyle: ChatTypingStyleProfile,
): ChatTypingVisibilityClass {
  if (presence.styleProfile.presenceVisibilityClass === 'SHADOW') return 'SHADOW';
  if (presence.behavior.shouldSuppressVisibleReceipt && typingStyle.reveal.visibilityClass === 'VISIBLE') {
    return 'AUTHOR_ONLY';
  }
  return typingStyle.reveal.visibilityClass;
}

function buildTypingWindow(
  input: TypingSimulationRequest,
  now: number,
  presence: PresenceStyleResolution,
  latency: BackendLatencyResolution,
  typingStyle: ChatTypingStyleProfile,
  config: TypingSimulationEngineConfig,
): ChatTypingWindow {
  const startupDelayMs = clamp(
    typingStyle.latency.startupDelayMs + Math.floor((latency.delayMs - typingStyle.latency.startupDelayMs) * 0.18),
    0,
    20_000,
  );

  const opensAt = config.respectSilenceNotBefore && input.silenceDecision?.notBefore != null
    ? Math.max(now, input.silenceDecision.notBefore)
    : now;

  const maxVisibleDurationMs = clamp(
    Math.max(
      getDefaultTypingTimeoutMs(typingStyle.timeoutClass),
      typingStyle.latency.expiryAfterMs,
      latency.typing.typingDurationMs + latency.typing.lingerMs,
    ),
    200,
    30_000,
  );

  return Object.freeze({
    windowId: `typing-window:${input.roomId}:${input.channelId}:${input.actorId}:${now}` as ChatTypingWindowId,
    trigger: resolveTrigger(input.actorKind, input.intent, channelFamily(input.channelId)),
    opensAt: opensAt as UnixMs,
    closesAt: (opensAt + maxVisibleDurationMs) as UnixMs,
    startupDelayMs,
    maxVisibleDurationMs,
    allowPause: typingStyle.reveal.allowDelayedReveal || typingStyle.latency.pauseCeilingMs > 0,
    allowAbort: Boolean(input.allowAbortWithoutMessage ?? presence.behavior.shouldFakeTypingStop),
    priority: clamp(Math.floor(presence.confidence01 * 100), 1, 100),
  });
}

function buildBurstCount(
  input: TypingSimulationRequest,
  presence: PresenceStyleResolution,
  typingStyle: ChatTypingStyleProfile,
  seed: string,
  config: TypingSimulationEngineConfig,
): number {
  const base =
    presence.behavior.shouldLurk || typingStyle.persona.usesWeaponizedSilence
      ? 2
      : input.expectedMessageLengthHint && input.expectedMessageLengthHint > 120
        ? 3
        : 1;
  const jitter = deterministicRange(0, 2, `${seed}::burst-count`);
  return clamp(base + jitter, config.minBurstCount, config.maxBurstCount);
}

function buildPauseCount(
  presence: PresenceStyleResolution,
  typingStyle: ChatTypingStyleProfile,
  seed: string,
  config: TypingSimulationEngineConfig,
): number {
  if (!typingStyle.reveal.allowDelayedReveal && !presence.behavior.shouldFakeTypingStop) return 0;
  const base =
    presence.behavior.shouldLurk || presence.behavior.shouldReadBeforeReply
      ? 1
      : typingStyle.persona.tendsToHoverBeforeReply
        ? 1
        : 0;
  const jitter = deterministicRange(0, 2, `${seed}::pause-count`);
  return clamp(base + jitter, config.minPauseCount, config.maxPauseCount);
}

function buildBursts(
  count: number,
  input: TypingSimulationRequest,
  typingStyle: ChatTypingStyleProfile,
  seed: string,
): readonly ChatTypingBurstSegment[] {
  const bursts: ChatTypingBurstSegment[] = [];
  const expectedChars = Math.max(typingStyle.cadence.averageBurstChars, input.expectedMessageLengthHint ?? input.visibleMessageLengthHint ?? 24);
  let cursor = typingStyle.latency.firstBurstMs;

  for (let index = 0; index < count; index += 1) {
    const durationMs = deterministicRange(
      Math.max(80, Math.floor(typingStyle.latency.firstBurstMs * 0.7)),
      Math.max(typingStyle.latency.firstBurstMs, Math.floor(typingStyle.latency.firstBurstMs * 1.8)),
      `${seed}::burst-duration::${index}`,
    );

    const estimatedChars = deterministicRange(
      Math.max(4, Math.floor(expectedChars / Math.max(1, count + (index > 0 ? 1 : 0)))),
      Math.max(typingStyle.cadence.maxBurstChars, expectedChars),
      `${seed}::burst-chars::${index}`,
    );

    bursts.push(Object.freeze({
      offsetMs: cursor,
      durationMs,
      estimatedChars,
      burstIntent:
        index === 0
          ? 'OPENER'
          : index === count - 1
            ? 'COUNTER'
            : presenceHintToBurstIntent(input.intent),
    }));

    cursor += durationMs;
  }

  return Object.freeze(bursts);
}

function presenceHintToBurstIntent(intent?: string | null): ChatTypingBurstSegment['burstIntent'] {
  switch (intent) {
    case 'NEGOTIATION':
      return 'STALL';
    case 'CALLBACK':
      return 'FAKEOUT';
    case 'RESCUE':
      return 'RECOVERY';
    case 'COUNTER':
      return 'COUNTER';
    default:
      return 'BODY';
  }
}

function buildPauses(
  count: number,
  bursts: readonly ChatTypingBurstSegment[],
  input: TypingSimulationRequest,
  presence: PresenceStyleResolution,
  typingStyle: ChatTypingStyleProfile,
  seed: string,
): readonly ChatTypingPauseSegment[] {
  if (count <= 0 || bursts.length <= 1) return Object.freeze([]);

  const pauses: ChatTypingPauseSegment[] = [];
  let created = 0;

  for (let index = 0; index < bursts.length - 1 && created < count; index += 1) {
    const burst = bursts[index];
    const durationMs = deterministicRange(
      typingStyle.latency.pauseFloorMs,
      typingStyle.latency.pauseCeilingMs,
      `${seed}::pause-duration::${index}`,
    );

    pauses.push(Object.freeze({
      offsetMs: burst.offsetMs + burst.durationMs,
      durationMs,
      reason:
        presence.behavior.shouldReadBeforeReply
          ? 'READING'
          : input.intent === 'NEGOTIATION'
            ? 'NEGOTIATION'
            : input.intent === 'RESCUE'
              ? 'INTERVENTION_WAIT'
              : presence.behavior.shouldFakeTypingStop
                ? 'BAIT'
                : 'THINKING',
    }));

    created += 1;
  }

  return Object.freeze(pauses);
}

function buildPlan(
  input: TypingSimulationRequest,
  now: number,
  presence: PresenceStyleResolution,
  latency: BackendLatencyResolution,
  typingStyle: ChatTypingStyleProfile,
  visibilityClass: ChatTypingVisibilityClass,
  config: TypingSimulationEngineConfig,
): ChatTypingSimulationPlan {
  const seed = [
    input.seed ?? 'typing-plan',
    input.actorId,
    input.channelId,
    input.roomId,
    presence.variantKey,
    String(now),
  ].join('::');

  const window = buildTypingWindow(input, now, presence, latency, typingStyle, config);
  const burstCount = buildBurstCount(input, presence, typingStyle, seed, config);
  const bursts = buildBursts(burstCount, input, typingStyle, seed);
  const pauseCount = buildPauseCount(presence, typingStyle, seed, config);
  const pauses = buildPauses(pauseCount, bursts, input, presence, typingStyle, seed);

  const finalBurst = bursts[bursts.length - 1];
  const finalPause = pauses[pauses.length - 1];
  const activeTailMs = Math.max(
    finalBurst ? finalBurst.offsetMs + finalBurst.durationMs : typingStyle.latency.firstBurstMs,
    finalPause ? finalPause.offsetMs + finalPause.durationMs : 0,
  );

  const idleTailMs = deterministicRange(
    config.idleTailFloorMs,
    config.idleTailCeilingMs,
    `${seed}::idle-tail`,
  );

  const startedAt = Math.max(window.opensAt, now + latency.typing.typingStartAt - now);
  const expiresAt = Math.min(
    window.closesAt,
    startedAt + Math.max(activeTailMs + idleTailMs, latency.typing.typingDurationMs + latency.typing.lingerMs),
  );

  return Object.freeze({
    planId: `typing-plan:${input.roomId}:${input.channelId}:${input.actorId}:${now}` as ChatTypingPlanId,
    actorId: input.actorId,
    actorKind: input.actorKind,
    roomId: input.roomId as ChatRoomId,
    channelId: input.channelId,
    styleId: typingStyle.styleId,
    authority: asAuthority(input.authority),
    source: resolveSource(input.actorKind, channelFamily(input.channelId)),
    visibilityClass,
    generatedAt: now as UnixMs,
    startedAt: startedAt as UnixMs,
    expiresAt: expiresAt as UnixMs,
    window,
    bursts,
    pauses,
    mayEmitReadDelay: presence.behavior.shouldDelayReceipt,
    mayAbortWithoutMessage: Boolean(input.allowAbortWithoutMessage ?? presence.behavior.shouldFakeTypingStop),
    shadowCompanionChannel:
      config.companionShadowEnabled && presence.behavior.shouldMirrorShadow
        ? companionShadowChannel(input.channelId)
        : undefined,
  });
}

function buildCue(
  input: TypingSimulationRequest,
  now: number,
  plan: ChatTypingSimulationPlan,
  typingStyle: ChatTypingStyleProfile,
): ChatTypingTheaterCue {
  return Object.freeze({
    cueId: `typing-cue:${input.roomId}:${input.channelId}:${input.actorId}:${now}` as ChatTypingCueId,
    roomId: input.roomId as ChatRoomId,
    channelId: input.channelId,
    actorId: input.actorId,
    actorKind: input.actorKind,
    styleId: typingStyle.styleId,
    trigger: resolveTrigger(input.actorKind, input.intent, channelFamily(input.channelId)),
    source: resolveSource(input.actorKind, channelFamily(input.channelId)),
    queuedAt: now as UnixMs,
    revealAt: (plan.startedAt ?? plan.generatedAt) as UnixMs,
    cancelIfSuppressed: true,
    cancelIfMessageAlreadyArrived: true,
    companionMessageId: input.companionMessageId as never,
    negotiationPressureScore:
      channelFamily(input.channelId) === 'NEGOTIATION'
        ? (clamp01(input.negotiationPressure01) as Score01)
        : undefined,
  });
}

function deriveTypingStyle(
  input: TypingSimulationRequest,
  presence: PresenceStyleResolution,
): ChatTypingStyleProfile {
  const family = channelFamily(input.channelId);
  let typingStyle = resolveTypingStyleForActor(input.actorKind, family);

  if (presence.variantKey === 'HATER_STRIKE' && (input.allowInstantStrike || presence.behavior.shouldEscalateToInstantStrike)) {
    typingStyle = CHAT_TYPING_STYLE_PROFILES.HATER_BAIT;
  }

  if (presence.variantKey === 'DEAL_PREDATOR') {
    typingStyle = CHAT_TYPING_STYLE_PROFILES.NEGOTIATION_PRESSURE;
  }

  if (presence.variantKey === 'DEAL_SILENT') {
    typingStyle = CHAT_TYPING_STYLE_PROFILES.NEGOTIATION_SILENT;
  }

  if (presence.variantKey === 'HELPER_SURGE') {
    typingStyle = CHAT_TYPING_STYLE_PROFILES.HELPER_URGENT;
  }

  if (presence.variantKey === 'HELPER_OBSERVE') {
    typingStyle = CHAT_TYPING_STYLE_PROFILES.HELPER_PATIENT;
  }

  if (presence.variantKey === 'NPC_AMBIENT') {
    typingStyle = CHAT_TYPING_STYLE_PROFILES.NPC_AMBIENT;
  }

  if (presence.variantKey === 'NPC_LURK' || presence.variantKey === 'HATER_STALK') {
    typingStyle = CHAT_TYPING_STYLE_PROFILES.NPC_LURK;
  }

  if (presence.variantKey === 'LIVEOPS_PULSE') {
    typingStyle = CHAT_TYPING_STYLE_PROFILES.LIVEOPS_PULSE;
  }

  if (presence.variantKey === 'SYSTEM_BANNER' || presence.variantKey === 'SHADOW_VEIL') {
    typingStyle = CHAT_TYPING_STYLE_PROFILES.SYSTEM_CEREMONIAL;
  }

  return typingStyle;
}

function buildFallbackLatency(
  input: TypingSimulationRequest,
  presence: PresenceStyleResolution,
  now: number,
): BackendLatencyResolution {
  const delayMs = round(
    presence.styleProfile.typicalLatencyMs +
      presence.signalVector.pressure01 * 120 +
      presence.signalVector.negotiationPressure01 * 180,
  );
  const typingDurationMs = round(
    clamp(
      presence.styleProfile.typingBurstMinMs +
        (presence.styleProfile.typingBurstMaxMs - presence.styleProfile.typingBurstMinMs) * 0.38,
      0,
      20_000,
    ),
  );
  const revealAt = now + delayMs;

  return Object.freeze({
    urgency:
      presence.behavior.shouldEscalateToInstantStrike
        ? 'IMMEDIATE'
        : presence.signalVector.urgency01 >= 0.72
          ? 'HIGH'
          : presence.signalVector.pressure01 >= 0.52
            ? 'MEDIUM'
            : 'LOW',
    reason:
      presence.variantKey === 'HELPER_SURGE'
        ? 'HELPER_RESCUE'
        : presence.variantKey === 'HATER_STALK' || presence.variantKey === 'HATER_STRIKE'
          ? 'HATER_STALK'
          : presence.variantKey === 'DEAL_PREDATOR'
            ? 'NEGOTIATION_PRESSURE'
            : 'DEFAULT_CADENCE',
    delayMs,
    revealAt,
    entryStyle: presence.behavior.shouldLurk ? 'LURK_THEN_STRIKE' : 'DIRECT',
    exitStyle: 'CLEAN_EXIT',
    typing: Object.freeze({
      shouldType: presence.styleProfile.typingTheater !== 'NONE',
      typingStartAt: Math.max(now, revealAt - Math.floor(typingDurationMs * 0.7)),
      typingEndAt: revealAt,
      typingDurationMs,
      revealAt,
      lingerMs: 180,
    }),
    interruptionAllowed: Boolean(input.allowInterruption),
    interruptionPriority: clamp(Math.floor(presence.confidence01 * 100), 1, 100),
    shadowPrimed: presence.behavior.shouldMirrorShadow,
    silenceWindowBeforeMs: input.silenceDecision?.holdMs ?? 0,
    silenceWindowAfterMs: 120,
    queueCooldownMs: Math.max(0, Math.floor((input.queueDepth ?? 0) * 80)),
  });
}

/* ============================================================================
 * MARK: Public engine
 * ============================================================================
 */

export class TypingSimulationEngine {
  private readonly config: TypingSimulationEngineConfig;
  private readonly presenceResolver: PresenceStyleResolver;
  private readonly readPolicy: ReadReceiptPolicy;
  private readonly silencePolicy: ChatSilencePolicy;

  public constructor(args: {
    config?: Partial<TypingSimulationEngineConfig>;
    presenceResolver?: PresenceStyleResolver;
    readPolicy?: ReadReceiptPolicy;
    silencePolicy?: ChatSilencePolicy;
  } = {}) {
    this.config = Object.freeze({
      ...DEFAULT_CONFIG,
      ...(args.config ?? {}),
    });
    this.presenceResolver = args.presenceResolver ?? new PresenceStyleResolver();
    this.readPolicy = args.readPolicy ?? new ReadReceiptPolicy();
    this.silencePolicy = args.silencePolicy ?? new ChatSilencePolicy();
  }

  public simulate(input: TypingSimulationRequest): TypingSimulationResult {
    const generatedAt = nowMs(input.now);
    const authority = asAuthority(input.authority);
    const family = channelFamily(input.channelId);

    const silenceDecision = input.silenceDecision ?? (
      input.silenceContext
        ? this.silencePolicy.evaluate(input.silenceContext)
        : undefined
    );

    const presence = input.presence ?? this.presenceResolver.resolve({
      actorId: input.actorId,
      actorKind: input.actorKind,
      roomId: input.roomId,
      channelId: input.channelId,
      authority,
      now: generatedAt,
      seed: input.seed,
      intent: input.intent,
      pressure01: input.pressure01,
      audienceHeat01: input.audienceHeat01,
      negotiationPressure01: input.negotiationPressure01,
      helperNeed01: input.helperNeed01,
      embarrassment01: input.embarrassment01,
      relationshipIntensity01: input.relationshipIntensity01,
      relationshipObsession01: input.relationshipObsession01,
      relationshipRespect01: input.relationshipRespect01,
      relationshipFear01: input.relationshipFear01,
      relationshipContempt01: input.relationshipContempt01,
      callbackOpportunity01: input.callbackOpportunity01,
      worldEventActive: input.worldEventActive,
      shouldWeaponizeDelay: input.shouldWeaponizeDelay,
      shouldSuppressVisibleReceipt: input.shouldSuppressVisibleReceipt,
      shouldShadowPrime: input.shouldShadowPrime,
      allowInstantStrike: input.allowInstantStrike,
      latency: input.latency,
      silenceDecision,
      metadata: input.metadata,
      tags: input.tags,
    });

    const latency = input.latency ?? (
      input.latencyInput
        ? resolveLatencyStyle(input.latencyInput)
        : buildFallbackLatency(input, presence, generatedAt)
    );

    const typingStyle = deriveTypingStyle(input, presence);
    const visibilityClass = typingVisibility(presence, typingStyle);
    const typingPlan = buildPlan(input, generatedAt, presence, latency, typingStyle, visibilityClass, this.config);
    const typingCue = buildCue(input, generatedAt, typingPlan, typingStyle);

    const readResolution = input.readResolution ?? this.readPolicy.resolve({
      actorId: input.actorId,
      actorKind: input.actorKind,
      roomId: input.roomId,
      channelId: input.channelId,
      messageId: input.messageId,
      authority,
      now: generatedAt,
      seed: input.seed,
      unreadCount: input.unreadCount,
      visibleToPlayer: visibilityClass === 'VISIBLE',
      forceDelayed: presence.behavior.shouldDelayReceipt,
      forceHidden: visibilityClass === 'SHADOW',
      presence,
      pressure01: input.pressure01,
      audienceHeat01: input.audienceHeat01,
      negotiationPressure01: input.negotiationPressure01,
      helperNeed01: input.helperNeed01,
      embarrassment01: input.embarrassment01,
      relationshipObsession01: input.relationshipObsession01,
      callbackOpportunity01: input.callbackOpportunity01,
      latencyDelayMs: latency.delayMs,
      metadata: input.metadata,
    });

    const fakeStartsAt = presence.behavior.shouldFakeTypingStart
      ? Math.max(generatedAt, typingCue.queuedAt + deterministicRange(
          this.config.fakeStartWindowFloorMs,
          this.config.fakeStartWindowCeilingMs,
          `${input.seed ?? 'typing'}::fake-start::${input.actorId}`,
        ))
      : undefined;

    const fakeStopsAt = presence.behavior.shouldFakeTypingStop && fakeStartsAt != null
      ? Math.min(
          (typingPlan.startedAt ?? typingPlan.generatedAt) as number,
          fakeStartsAt + deterministicRange(
            this.config.fakeStopWindowFloorMs,
            this.config.fakeStopWindowCeilingMs,
            `${input.seed ?? 'typing'}::fake-stop::${input.actorId}`,
          ),
        )
      : undefined;

    const reasons = Object.freeze([
      `family=${family}`,
      `variant=${presence.variantKey}`,
      `typingStyle=${typingStyle.styleKind}`,
      `visibility=${visibilityClass}`,
      `latencyReason=${latency.reason}`,
      `delayMs=${latency.delayMs}`,
      `revealAt=${latency.revealAt}`,
      `mayAbort=${typingPlan.mayAbortWithoutMessage}`,
      `readMode=${readResolution.decision.mode}`,
      ...presence.reasons,
      ...readResolution.reasons,
    ]);

    return Object.freeze({
      actorId: input.actorId,
      actorKind: input.actorKind,
      roomId: input.roomId,
      channelId: input.channelId,
      authority,
      family,
      presence,
      latency,
      silenceDecision,
      typingStyle,
      typingWindow: typingPlan.window,
      typingPlan,
      typingCue,
      readResolution,
      readDelayPlan: readResolution.plan,
      receipt: readResolution.receipt,
      readHead: readResolution.readHead,
      fakeStartsAt,
      fakeStopsAt,
      revealAt: latency.revealAt,
      shadowCompanionChannel: typingPlan.shadowCompanionChannel,
      reasons,
      generatedAt,
    });
  }

  public simulateBatch(
    requests: readonly TypingSimulationRequest[],
  ): TypingSimulationBatchResult {
    if (!requests.length) {
      const generatedAt = Date.now();
      return Object.freeze({
        generatedAt,
        totalSceneDurationMs: 0,
        finalRevealAt: generatedAt,
        turns: Object.freeze([]),
      });
    }

    const batchNow = nowMs(requests[0]?.now);
    const allLatencyInputs = requests.every((request) => request.latencyInput != null);
    const latencyPreview = allLatencyInputs
      ? previewSceneLatencyBatch(requests.map((request) => ({
          ...(request.latencyInput as BackendLatencyResolutionInput),
          allowInterruption: request.allowInterruption,
          queueDepth: request.queueDepth,
          sceneTurnIndex: request.sceneTurnIndex,
          sceneTurnCount: request.sceneTurnCount,
        })))
      : null;

    const turns: TypingSimulationResult[] = [];
    let cursor = batchNow;

    for (let index = 0; index < requests.length; index += 1) {
      const request = requests[index];
      const previewLatency = latencyPreview?.turns[index];
      const simulated = this.simulate({
        ...request,
        now: cursor,
        latency: request.latency ?? previewLatency ?? undefined,
        sceneTurnIndex: request.sceneTurnIndex ?? index,
        sceneTurnCount: request.sceneTurnCount ?? requests.length,
      });
      turns.push(simulated);
      cursor = Math.max(
        cursor,
        simulated.revealAt + simulated.latency.typing.lingerMs + simulated.latency.silenceWindowAfterMs,
      );
    }

    return Object.freeze({
      generatedAt: batchNow,
      totalSceneDurationMs: Math.max(0, cursor - batchNow),
      finalRevealAt: turns[turns.length - 1]?.revealAt ?? batchNow,
      turns: Object.freeze(turns),
    });
  }
}

export function createTypingSimulationEngine(args: {
  config?: Partial<TypingSimulationEngineConfig>;
  presenceResolver?: PresenceStyleResolver;
  readPolicy?: ReadReceiptPolicy;
  silencePolicy?: ChatSilencePolicy;
} = {}): TypingSimulationEngine {
  return new TypingSimulationEngine(args);
}

export const ChatTypingSimulationEngineModule = Object.freeze({
  TypingSimulationEngine,
  createTypingSimulationEngine,
});
