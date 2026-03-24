/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT TYPING SIMULATION ENGINE
 * FILE: backend/src/game/engine/chat/presence/TypingSimulationEngine.ts
 * VERSION: 2026.03.23-typing-engine.v2
 * AUTHORSHIP: Antonio T. Smith Jr.
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
 * - instant strike exceptions,
 * - scene-wide turn sequencing,
 * - diagnostics and audit trails,
 * - profile-driven configuration.
 *
 * Design laws
 * -----------
 * 1. Typing is emotional choreography, not decoration.
 * 2. Presence style decides posture; typing style decides cadence.
 * 3. Silence policy may delay or compress the window.
 * 4. Read policy may mirror into unread pressure.
 * 5. The backend decides the plan; transport and UI merely display it.
 * 6. Scenes are sequenced deterministically; each turn can be previewed.
 * 7. Profiles tune emotional posture across the full engine surface.
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

import type { ChatActorKind } from '../../../../../../shared/contracts/chat/ChatChannels';
import type { ChatAuthority } from '../../../../../../shared/contracts/chat/ChatEvents';

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
    case 'AMBIENT_NPC':
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
 * MARK: Profile system
 * ============================================================================
 */

/**
 * Named configuration profiles for the TypingSimulationEngine.
 * Each profile tunes the timing windows, burst structure, and scene
 * sequencing to produce a different emotional register.
 */
export type TypingSimulationEngineProfile =
  | 'STANDARD'
  | 'AGGRESSIVE_HATER'
  | 'PATIENT_HELPER'
  | 'NEGOTIATION_STALL'
  | 'SHADOW_MINIMAL'
  | 'LIVEOPS_RAPID'
  | 'CINEMATIC';

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
  readonly sceneTurnGapFloorMs: number;
  readonly sceneTurnGapCeilingMs: number;
  readonly sceneLingerMultiplier: number;
  readonly haterBurstBoost: number;
  readonly helperPauseBoost: number;
  readonly negotiationStallMultiplier: number;
  readonly shadowTypingDurationMs: number;
  readonly liveopsRapidBurstMs: number;
}

const DEFAULT_CONFIG: TypingSimulationEngineConfig = Object.freeze({
  version: '2026.03.23',
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
  sceneTurnGapFloorMs: 340,
  sceneTurnGapCeilingMs: 1100,
  sceneLingerMultiplier: 1.0,
  haterBurstBoost: 1.4,
  helperPauseBoost: 1.3,
  negotiationStallMultiplier: 1.6,
  shadowTypingDurationMs: 0,
  liveopsRapidBurstMs: 220,
});

/**
 * Tuned profile configurations.
 */
export const TYPING_ENGINE_PROFILE_OPTIONS: Readonly<
  Record<TypingSimulationEngineProfile, Partial<TypingSimulationEngineConfig>>
> = Object.freeze({
  STANDARD: {},

  AGGRESSIVE_HATER: Object.freeze({
    minBurstCount: 2,
    maxBurstCount: 5,
    fakeStartWindowFloorMs: 180,
    fakeStartWindowCeilingMs: 900,
    fakeStopWindowFloorMs: 80,
    fakeStopWindowCeilingMs: 640,
    haterBurstBoost: 2.0,
    sceneTurnGapFloorMs: 240,
    sceneTurnGapCeilingMs: 720,
  }),

  PATIENT_HELPER: Object.freeze({
    minBurstCount: 1,
    maxBurstCount: 2,
    minPauseCount: 1,
    maxPauseCount: 4,
    fakeStartWindowFloorMs: 480,
    fakeStartWindowCeilingMs: 1800,
    helperPauseBoost: 2.0,
    idleTailFloorMs: 280,
    idleTailCeilingMs: 1400,
    sceneLingerMultiplier: 1.4,
  }),

  NEGOTIATION_STALL: Object.freeze({
    minBurstCount: 1,
    maxBurstCount: 3,
    minPauseCount: 1,
    maxPauseCount: 5,
    negotiationStallMultiplier: 2.4,
    fakeStopWindowFloorMs: 200,
    fakeStopWindowCeilingMs: 1400,
    sceneTurnGapFloorMs: 600,
    sceneTurnGapCeilingMs: 2400,
    sceneLingerMultiplier: 1.8,
  }),

  SHADOW_MINIMAL: Object.freeze({
    companionShadowEnabled: false,
    shadowTypingDurationMs: 0,
    minBurstCount: 1,
    maxBurstCount: 1,
    minPauseCount: 0,
    maxPauseCount: 0,
    idleTailFloorMs: 60,
    idleTailCeilingMs: 180,
  }),

  LIVEOPS_RAPID: Object.freeze({
    minBurstCount: 1,
    maxBurstCount: 2,
    fakeStartWindowFloorMs: 80,
    fakeStartWindowCeilingMs: 360,
    liveopsRapidBurstMs: 120,
    sceneTurnGapFloorMs: 160,
    sceneTurnGapCeilingMs: 480,
    sceneLingerMultiplier: 0.6,
  }),

  CINEMATIC: Object.freeze({
    minBurstCount: 2,
    maxBurstCount: 6,
    minPauseCount: 1,
    maxPauseCount: 4,
    fakeStartWindowFloorMs: 400,
    fakeStartWindowCeilingMs: 1600,
    fakeStopWindowFloorMs: 200,
    fakeStopWindowCeilingMs: 1200,
    idleTailFloorMs: 240,
    idleTailCeilingMs: 1200,
    sceneTurnGapFloorMs: 480,
    sceneTurnGapCeilingMs: 1600,
    sceneLingerMultiplier: 1.6,
    haterBurstBoost: 1.8,
    helperPauseBoost: 1.6,
  }),
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

/**
 * Detailed diagnostic breakdown of what drove a single simulation result.
 */
export interface TypingSimulationDiagnostics {
  readonly actorId: string;
  readonly actorKind: ChatActorKind;
  readonly channelId: ChatChannelId;
  readonly channelFamily: 'PUBLIC' | 'NEGOTIATION' | 'LOBBY' | 'SHADOW';
  readonly variantKey: PresenceStyleResolution['variantKey'];
  readonly typingStyleKind: ChatTypingStyleProfile['styleKind'];
  readonly visibilityClass: ChatTypingVisibilityClass;
  readonly signalVector: {
    readonly pressure01: number;
    readonly audienceHeat01: number;
    readonly negotiationPressure01: number;
    readonly helperNeed01: number;
    readonly embarrassment01: number;
    readonly relationshipObsession01: number;
  };
  readonly timingBreakdown: {
    readonly startupDelayMs: number;
    readonly opensAt: number;
    readonly closesAt: number;
    readonly maxVisibleDurationMs: number;
    readonly burstCount: number;
    readonly pauseCount: number;
    readonly idleTailMs: number;
    readonly activeTailMs: number;
    readonly fakeStartsAt: number | undefined;
    readonly fakeStopsAt: number | undefined;
    readonly revealAt: number;
  };
  readonly behaviorFlags: {
    readonly shouldLurk: boolean;
    readonly shouldFakeTypingStart: boolean;
    readonly shouldFakeTypingStop: boolean;
    readonly shouldReadBeforeReply: boolean;
    readonly shouldMirrorShadow: boolean;
    readonly shouldEscalateToInstantStrike: boolean;
  };
  readonly latencyBreakdown: {
    readonly urgency: BackendLatencyResolution['urgency'];
    readonly reason: BackendLatencyResolution['reason'];
    readonly delayMs: number;
    readonly typingDurationMs: number;
    readonly lingerMs: number;
    readonly silenceWindowBeforeMs: number;
    readonly silenceWindowAfterMs: number;
  };
  readonly readReceiptMode: ReadReceiptResolution['decision']['mode'];
  readonly configSnapshot: TypingSimulationEngineConfig;
  readonly computedAt: number;
}

/**
 * A single audit entry for a simulation turn.
 */
export interface TypingSimulationAuditEntry {
  readonly auditId: string;
  readonly actorId: string;
  readonly actorKind: ChatActorKind;
  readonly channelId: ChatChannelId;
  readonly variantKey: PresenceStyleResolution['variantKey'];
  readonly typingStyleKind: ChatTypingStyleProfile['styleKind'];
  readonly visibilityClass: ChatTypingVisibilityClass;
  readonly revealAt: number;
  readonly delayMs: number;
  readonly burstCount: number;
  readonly fakeStartEmitted: boolean;
  readonly fakeStopEmitted: boolean;
  readonly shadowMirrored: boolean;
  readonly readMode: ReadReceiptResolution['decision']['mode'];
  readonly reasons: readonly string[];
  readonly capturedAt: number;
}

/**
 * Aggregate audit report across a batch of simulation turns.
 */
export interface TypingSimulationAuditReport {
  readonly reportId: string;
  readonly generatedAt: number;
  readonly entryCount: number;
  readonly entries: readonly TypingSimulationAuditEntry[];
  readonly totalDelayMs: number;
  readonly averageDelayMs: number;
  readonly averageBurstCount: number;
  readonly fakeStartCount: number;
  readonly fakeStopCount: number;
  readonly shadowMirroredCount: number;
  readonly visibleCount: number;
  readonly hiddenCount: number;
  readonly dominantVariant: PresenceStyleResolution['variantKey'] | undefined;
  readonly dominantTypingStyle: ChatTypingStyleProfile['styleKind'] | undefined;
}

/**
 * Diff between two consecutive simulation results for the same actor.
 */
export interface TypingSimulationDiff {
  readonly changedVariant: boolean;
  readonly changedTypingStyle: boolean;
  readonly changedVisibility: boolean;
  readonly changedFamily: boolean;
  readonly revealDeltaMs: number;
  readonly delayDeltaMs: number;
  readonly burstCountDelta: number;
  readonly previousVariant: PresenceStyleResolution['variantKey'];
  readonly nextVariant: PresenceStyleResolution['variantKey'];
  readonly previousTypingStyle: ChatTypingStyleProfile['styleKind'];
  readonly nextTypingStyle: ChatTypingStyleProfile['styleKind'];
  readonly escalated: boolean;
  readonly deescalated: boolean;
}

/**
 * Stats summary across a batch of simulation results.
 */
export interface TypingSimulationStatsSummary {
  readonly sampleCount: number;
  readonly totalDelayMs: number;
  readonly averageDelayMs: number;
  readonly maxDelayMs: number;
  readonly minDelayMs: number | undefined;
  readonly medianDelayMs: number | undefined;
  readonly averageBurstCount: number;
  readonly fakeStartRate: number;
  readonly fakeStopRate: number;
  readonly shadowMirroredRate: number;
  readonly visibleRate: number;
  readonly variantFrequency: Readonly<Partial<Record<PresenceStyleResolution['variantKey'], number>>>;
  readonly typingStyleFrequency: Readonly<Partial<Record<ChatTypingStyleProfile['styleKind'], number>>>;
  readonly channelFamilyFrequency: Readonly<Record<string, number>>;
  readonly sceneDurationMs: number;
}

/**
 * Plan for a single turn within a scene — a lightweight preview
 * before full simulation is needed.
 */
export interface TypingSceneTurnPlan {
  readonly turnIndex: number;
  readonly actorId: string;
  readonly actorKind: ChatActorKind;
  readonly channelId: ChatChannelId;
  readonly estimatedRevealAt: number;
  readonly estimatedDelayMs: number;
  readonly estimatedBurstCount: number;
  readonly estimatedDurationMs: number;
  readonly expectedVariantKey: PresenceStyleResolution['variantKey'] | undefined;
  readonly shadowMirrored: boolean;
}

/**
 * Full scene plan — a lightweight sequence of turn plans before simulation.
 */
export interface TypingScenePlan {
  readonly sceneId: string;
  readonly generatedAt: number;
  readonly turnCount: number;
  readonly turns: readonly TypingSceneTurnPlan[];
  readonly totalSceneDurationMs: number;
  readonly finalRevealAt: number;
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

  let effective = clamp(base + jitter, config.minBurstCount, config.maxBurstCount);

  if (
    (input.actorKind === 'HATER' || presence.variantKey === 'HATER_STRIKE') &&
    config.haterBurstBoost > 1.0
  ) {
    effective = clamp(Math.round(effective * config.haterBurstBoost), config.minBurstCount, config.maxBurstCount + 2);
  }

  return effective;
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

  let effective = clamp(base + jitter, config.minPauseCount, config.maxPauseCount);

  if (presence.variantKey === 'HELPER_OBSERVE' || presence.variantKey === 'HELPER_SURGE') {
    if (config.helperPauseBoost > 1.0) {
      effective = clamp(Math.round(effective * config.helperPauseBoost), config.minPauseCount, config.maxPauseCount + 2);
    }
  }

  return effective;
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

function typingStyleFamily(
  family: ReturnType<typeof channelFamily>,
): 'PUBLIC' | 'NEGOTIATION' | 'SHADOW' | 'PRIVATE' | 'PRE_RUN' {
  if (family === 'LOBBY') return 'PUBLIC';
  return family;
}

function deriveTypingStyle(
  input: TypingSimulationRequest,
  presence: PresenceStyleResolution,
): ChatTypingStyleProfile {
  const family = channelFamily(input.channelId);
  let typingStyle = resolveTypingStyleForActor(input.actorKind, typingStyleFamily(family));

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

/**
 * Build a fallback latency resolution when no external latency input is
 * provided. Uses presence signal vector as the timing source.
 *
 * Bug fixes applied (v2):
 *  - entryStyle 'DIRECT' → 'TYPING_REVEAL' (valid ChatNpcEntryStyle)
 *  - exitStyle 'CLEAN_EXIT' → 'HARD_STOP' (valid ChatNpcExitStyle)
 */
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
    cadenceBand: (presence.styleProfile as any)?.cadenceBand ?? 'DEFAULT',
    delayMs,
    revealAt,
    entryStyle: presence.behavior.shouldLurk ? 'LURK_THEN_STRIKE' : 'TYPING_REVEAL',
    exitStyle: 'HARD_STOP',
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
 * MARK: Analytics builders
 * ============================================================================
 */

function buildDiagnostics(
  input: TypingSimulationRequest,
  result: TypingSimulationResult,
  config: TypingSimulationEngineConfig,
): TypingSimulationDiagnostics {
  const family = channelFamily(input.channelId);
  const presence = result.presence;
  const latency = result.latency;
  const plan = result.typingPlan;

  const activeTailMs = Math.max(
    (plan.bursts[plan.bursts.length - 1]?.offsetMs ?? 0) +
    (plan.bursts[plan.bursts.length - 1]?.durationMs ?? latency.typing.typingDurationMs),
    (plan.pauses[plan.pauses.length - 1]?.offsetMs ?? 0) +
    (plan.pauses[plan.pauses.length - 1]?.durationMs ?? 0),
  );

  return Object.freeze({
    actorId: input.actorId,
    actorKind: input.actorKind,
    channelId: input.channelId,
    channelFamily: family,
    variantKey: presence.variantKey,
    typingStyleKind: result.typingStyle.styleKind,
    visibilityClass: plan.visibilityClass,
    signalVector: Object.freeze({
      pressure01: clamp01(input.pressure01),
      audienceHeat01: clamp01(input.audienceHeat01),
      negotiationPressure01: clamp01(input.negotiationPressure01),
      helperNeed01: clamp01(input.helperNeed01),
      embarrassment01: clamp01(input.embarrassment01),
      relationshipObsession01: clamp01(input.relationshipObsession01),
    }),
    timingBreakdown: Object.freeze({
      startupDelayMs: plan.window.startupDelayMs,
      opensAt: plan.window.opensAt,
      closesAt: plan.window.closesAt,
      maxVisibleDurationMs: plan.window.maxVisibleDurationMs,
      burstCount: plan.bursts.length,
      pauseCount: plan.pauses.length,
      idleTailMs: config.idleTailFloorMs,
      activeTailMs,
      fakeStartsAt: result.fakeStartsAt,
      fakeStopsAt: result.fakeStopsAt,
      revealAt: result.revealAt,
    }),
    behaviorFlags: Object.freeze({
      shouldLurk: presence.behavior.shouldLurk,
      shouldFakeTypingStart: presence.behavior.shouldFakeTypingStart,
      shouldFakeTypingStop: presence.behavior.shouldFakeTypingStop,
      shouldReadBeforeReply: presence.behavior.shouldReadBeforeReply,
      shouldMirrorShadow: presence.behavior.shouldMirrorShadow,
      shouldEscalateToInstantStrike: presence.behavior.shouldEscalateToInstantStrike,
    }),
    latencyBreakdown: Object.freeze({
      urgency: latency.urgency,
      reason: latency.reason,
      delayMs: latency.delayMs,
      typingDurationMs: latency.typing.typingDurationMs,
      lingerMs: latency.typing.lingerMs,
      silenceWindowBeforeMs: latency.silenceWindowBeforeMs,
      silenceWindowAfterMs: latency.silenceWindowAfterMs,
    }),
    readReceiptMode: result.readResolution.decision.mode,
    configSnapshot: config,
    computedAt: result.generatedAt,
  });
}

function buildAuditEntry(
  result: TypingSimulationResult,
  now: number,
): TypingSimulationAuditEntry {
  const seed = [result.actorId, result.channelId, String(now)].join('::');
  return Object.freeze({
    auditId: `audit:${positiveHash(seed).toString(16)}`,
    actorId: result.actorId,
    actorKind: result.actorKind,
    channelId: result.channelId,
    variantKey: result.presence.variantKey,
    typingStyleKind: result.typingStyle.styleKind,
    visibilityClass: result.typingPlan.visibilityClass,
    revealAt: result.revealAt,
    delayMs: result.latency.delayMs,
    burstCount: result.typingPlan.bursts.length,
    fakeStartEmitted: result.fakeStartsAt != null,
    fakeStopEmitted: result.fakeStopsAt != null,
    shadowMirrored: result.typingPlan.shadowCompanionChannel != null,
    readMode: result.readResolution.decision.mode,
    reasons: result.reasons,
    capturedAt: now,
  });
}

function buildAuditReport(
  entries: readonly TypingSimulationAuditEntry[],
  now: number,
): TypingSimulationAuditReport {
  const reportSeed = entries.map((e) => e.auditId).join(':');
  const reportId = `report:${positiveHash(reportSeed).toString(16)}`;

  let totalDelayMs = 0;
  let totalBurstCount = 0;
  let fakeStartCount = 0;
  let fakeStopCount = 0;
  let shadowMirroredCount = 0;
  let visibleCount = 0;
  let hiddenCount = 0;

  const variantFreq: Partial<Record<PresenceStyleResolution['variantKey'], number>> = {};
  const styleFreq: Partial<Record<ChatTypingStyleProfile['styleKind'], number>> = {};

  for (const entry of entries) {
    totalDelayMs += entry.delayMs;
    totalBurstCount += entry.burstCount;
    if (entry.fakeStartEmitted) fakeStartCount += 1;
    if (entry.fakeStopEmitted) fakeStopCount += 1;
    if (entry.shadowMirrored) shadowMirroredCount += 1;
    if (entry.visibilityClass === 'VISIBLE') visibleCount += 1;
    else hiddenCount += 1;

    variantFreq[entry.variantKey] = (variantFreq[entry.variantKey] ?? 0) + 1;
    styleFreq[entry.typingStyleKind] = (styleFreq[entry.typingStyleKind] ?? 0) + 1;
  }

  const count = entries.length;
  const averageDelayMs = count > 0 ? Math.round(totalDelayMs / count) : 0;
  const averageBurstCount = count > 0 ? Math.round((totalBurstCount / count) * 10) / 10 : 0;

  let dominantVariant: PresenceStyleResolution['variantKey'] | undefined;
  let dominantVariantCount = 0;
  for (const [k, v] of Object.entries(variantFreq)) {
    if ((v ?? 0) > dominantVariantCount) {
      dominantVariantCount = v ?? 0;
      dominantVariant = k as PresenceStyleResolution['variantKey'];
    }
  }

  let dominantTypingStyle: ChatTypingStyleProfile['styleKind'] | undefined;
  let dominantStyleCount = 0;
  for (const [k, v] of Object.entries(styleFreq)) {
    if ((v ?? 0) > dominantStyleCount) {
      dominantStyleCount = v ?? 0;
      dominantTypingStyle = k as ChatTypingStyleProfile['styleKind'];
    }
  }

  return Object.freeze({
    reportId,
    generatedAt: now,
    entryCount: count,
    entries,
    totalDelayMs,
    averageDelayMs,
    averageBurstCount,
    fakeStartCount,
    fakeStopCount,
    shadowMirroredCount,
    visibleCount,
    hiddenCount,
    dominantVariant,
    dominantTypingStyle,
  });
}

function buildStatsSummary(
  results: readonly TypingSimulationResult[],
): TypingSimulationStatsSummary {
  const count = results.length;
  if (count === 0) {
    return Object.freeze({
      sampleCount: 0,
      totalDelayMs: 0,
      averageDelayMs: 0,
      maxDelayMs: 0,
      minDelayMs: undefined,
      medianDelayMs: undefined,
      averageBurstCount: 0,
      fakeStartRate: 0,
      fakeStopRate: 0,
      shadowMirroredRate: 0,
      visibleRate: 0,
      variantFrequency: Object.freeze({}),
      typingStyleFrequency: Object.freeze({}),
      channelFamilyFrequency: Object.freeze({}),
      sceneDurationMs: 0,
    });
  }

  let totalDelayMs = 0;
  let maxDelayMs = 0;
  let minDelayMs: number | undefined;
  let totalBurstCount = 0;
  let fakeStartCount = 0;
  let fakeStopCount = 0;
  let shadowCount = 0;
  let visibleCount = 0;
  const delayValues: number[] = [];
  const variantFreq: Partial<Record<PresenceStyleResolution['variantKey'], number>> = {};
  const styleFreq: Partial<Record<ChatTypingStyleProfile['styleKind'], number>> = {};
  const familyFreq: Record<string, number> = {};

  for (const result of results) {
    totalDelayMs += result.latency.delayMs;
    maxDelayMs = Math.max(maxDelayMs, result.latency.delayMs);
    if (minDelayMs === undefined || result.latency.delayMs < minDelayMs) {
      minDelayMs = result.latency.delayMs;
    }
    delayValues.push(result.latency.delayMs);
    totalBurstCount += result.typingPlan.bursts.length;
    if (result.fakeStartsAt != null) fakeStartCount += 1;
    if (result.fakeStopsAt != null) fakeStopCount += 1;
    if (result.typingPlan.shadowCompanionChannel != null) shadowCount += 1;
    if (result.typingPlan.visibilityClass === 'VISIBLE') visibleCount += 1;

    const vk = result.presence.variantKey;
    variantFreq[vk] = (variantFreq[vk] ?? 0) + 1;

    const sk = result.typingStyle.styleKind;
    styleFreq[sk] = (styleFreq[sk] ?? 0) + 1;

    const fam = result.family;
    familyFreq[fam] = (familyFreq[fam] ?? 0) + 1;
  }

  const averageDelayMs = Math.round(totalDelayMs / count);
  const averageBurstCount = Math.round((totalBurstCount / count) * 10) / 10;

  const sorted = [...delayValues].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const medianDelayMs = sorted.length % 2 === 0
    ? Math.round(((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2)
    : sorted[mid];

  const sceneDurationMs = results.length > 0
    ? Math.max(...results.map((r) => r.revealAt + r.latency.typing.lingerMs + r.latency.silenceWindowAfterMs)) -
      (results[0]?.generatedAt ?? 0)
    : 0;

  return Object.freeze({
    sampleCount: count,
    totalDelayMs,
    averageDelayMs,
    maxDelayMs,
    minDelayMs,
    medianDelayMs,
    averageBurstCount,
    fakeStartRate: count > 0 ? fakeStartCount / count : 0,
    fakeStopRate: count > 0 ? fakeStopCount / count : 0,
    shadowMirroredRate: count > 0 ? shadowCount / count : 0,
    visibleRate: count > 0 ? visibleCount / count : 0,
    variantFrequency: Object.freeze(variantFreq),
    typingStyleFrequency: Object.freeze(styleFreq),
    channelFamilyFrequency: Object.freeze(familyFreq),
    sceneDurationMs: Math.max(0, sceneDurationMs),
  });
}

function computeDiff(
  resultA: TypingSimulationResult,
  resultB: TypingSimulationResult,
): TypingSimulationDiff {
  const changedVariant = resultA.presence.variantKey !== resultB.presence.variantKey;
  const changedTypingStyle = resultA.typingStyle.styleKind !== resultB.typingStyle.styleKind;
  const changedVisibility = resultA.typingPlan.visibilityClass !== resultB.typingPlan.visibilityClass;
  const changedFamily = resultA.family !== resultB.family;

  const revealDeltaMs = resultB.revealAt - resultA.revealAt;
  const delayDeltaMs = resultB.latency.delayMs - resultA.latency.delayMs;
  const burstCountDelta = resultB.typingPlan.bursts.length - resultA.typingPlan.bursts.length;

  const urgencyOrder = ['LOW', 'MEDIUM', 'HIGH', 'IMMEDIATE'];
  const urgencyA = urgencyOrder.indexOf(resultA.latency.urgency);
  const urgencyB = urgencyOrder.indexOf(resultB.latency.urgency);
  const escalated = urgencyB > urgencyA;
  const deescalated = urgencyB < urgencyA;

  return Object.freeze({
    changedVariant,
    changedTypingStyle,
    changedVisibility,
    changedFamily,
    revealDeltaMs,
    delayDeltaMs,
    burstCountDelta,
    previousVariant: resultA.presence.variantKey,
    nextVariant: resultB.presence.variantKey,
    previousTypingStyle: resultA.typingStyle.styleKind,
    nextTypingStyle: resultB.typingStyle.styleKind,
    escalated,
    deescalated,
  });
}

/* ============================================================================
 * MARK: Scene planner
 * ============================================================================
 */

function buildScenePlan(
  requests: readonly TypingSimulationRequest[],
  config: TypingSimulationEngineConfig,
): TypingScenePlan {
  if (requests.length === 0) {
    const now = Date.now();
    return Object.freeze({
      sceneId: `scene:${now}`,
      generatedAt: now,
      turnCount: 0,
      turns: Object.freeze([]),
      totalSceneDurationMs: 0,
      finalRevealAt: now,
    });
  }

  const now = nowMs(requests[0]?.now);
  const sceneSeed = [requests[0]?.actorId, requests[0]?.channelId, String(now)].join('::');
  const sceneId = `scene:${positiveHash(sceneSeed).toString(16)}`;

  const turns: TypingSceneTurnPlan[] = [];
  let cursor = now;

  for (let index = 0; index < requests.length; index += 1) {
    const request = requests[index];
    if (!request) continue;

    const family = channelFamily(request.channelId);
    const pressure01 = clamp01(request.pressure01);
    const negotiationPressure01 = clamp01(request.negotiationPressure01);

    let baseDelayMs = 600;
    if (family === 'NEGOTIATION') {
      baseDelayMs = Math.round(baseDelayMs * config.negotiationStallMultiplier);
      baseDelayMs += Math.round(negotiationPressure01 * 800);
    }

    const turnSeed = `scene-turn:${sceneSeed}:${index}`;
    const estimatedDelayMs = deterministicRange(
      Math.max(200, baseDelayMs - 200),
      baseDelayMs + 600 + Math.round(pressure01 * 400),
      turnSeed,
    );

    const estimatedBurstCount = deterministicRange(
      config.minBurstCount,
      config.maxBurstCount,
      `${turnSeed}::bursts`,
    );

    const estimatedDurationMs = estimatedDelayMs + estimatedBurstCount * deterministicRange(
      200, 900, `${turnSeed}::duration`,
    );

    const gapMs = deterministicRange(
      config.sceneTurnGapFloorMs,
      config.sceneTurnGapCeilingMs,
      `${turnSeed}::gap`,
    );

    const estimatedRevealAt = cursor + estimatedDelayMs;

    turns.push(Object.freeze({
      turnIndex: index,
      actorId: request.actorId,
      actorKind: request.actorKind,
      channelId: request.channelId,
      estimatedRevealAt,
      estimatedDelayMs,
      estimatedBurstCount,
      estimatedDurationMs,
      expectedVariantKey: undefined,
      shadowMirrored: Boolean(request.shouldShadowPrime),
    }));

    cursor = estimatedRevealAt + Math.round(estimatedDurationMs * config.sceneLingerMultiplier) + gapMs;
  }

  return Object.freeze({
    sceneId,
    generatedAt: now,
    turnCount: turns.length,
    turns: Object.freeze(turns),
    totalSceneDurationMs: Math.max(0, cursor - now),
    finalRevealAt: turns[turns.length - 1]?.estimatedRevealAt ?? now,
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

  /**
   * Simulate a single typing turn. Returns a complete result including
   * presence resolution, latency plan, typing plan, cue, and read receipt.
   */
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

  /**
   * Simulate a batch of turns in sequence. Advances time cursor between turns
   * using the linger and silence windows from each result.
   */
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

  /**
   * Preview a scene plan without full simulation. Returns estimated timing
   * for each turn. Useful for pre-loading or scheduling upstream.
   */
  public previewScenePlan(requests: readonly TypingSimulationRequest[]): TypingScenePlan {
    return buildScenePlan(requests, this.config);
  }

  /**
   * Get a full diagnostic breakdown for a single simulation result.
   */
  public getDiagnostics(
    input: TypingSimulationRequest,
    result: TypingSimulationResult,
  ): TypingSimulationDiagnostics {
    return buildDiagnostics(input, result, this.config);
  }

  /**
   * Build an audit report from a batch result.
   */
  public buildAuditReport(batch: TypingSimulationBatchResult): TypingSimulationAuditReport {
    const now = batch.generatedAt;
    const entries = batch.turns.map((turn) => buildAuditEntry(turn, now));
    return buildAuditReport(Object.freeze(entries), now);
  }

  /**
   * Compute a diff between two sequential simulation results.
   */
  public computeDiff(
    resultA: TypingSimulationResult,
    resultB: TypingSimulationResult,
  ): TypingSimulationDiff {
    return computeDiff(resultA, resultB);
  }

  /**
   * Aggregate stats across a batch of results.
   */
  public getStatsSummary(results: readonly TypingSimulationResult[]): TypingSimulationStatsSummary {
    return buildStatsSummary(results);
  }

  /**
   * Serialize the engine configuration for transport or debug.
   */
  public toJSON(): TypingSimulationEngineConfig {
    return this.config;
  }

  /**
   * Clone this engine with optional config overrides applied.
   */
  public clone(overrides: Partial<TypingSimulationEngineConfig> = {}): TypingSimulationEngine {
    return new TypingSimulationEngine({
      config: { ...this.config, ...overrides },
      presenceResolver: this.presenceResolver,
      readPolicy: this.readPolicy,
      silencePolicy: this.silencePolicy,
    });
  }
}

/* ============================================================================
 * MARK: Standalone helpers
 * ============================================================================
 */

/**
 * Quick check: will this request produce a shadow typing window?
 */
export function willProduceShadowTyping(request: TypingSimulationRequest): boolean {
  return (
    channelFamily(request.channelId) === 'SHADOW' ||
    Boolean(request.shouldShadowPrime)
  );
}

/**
 * Quick check: will this request likely produce fake typing start behavior?
 * Based on variant signals without a full simulation pass.
 */
export function likelyFakeTypingStart(request: TypingSimulationRequest): boolean {
  return (
    request.actorKind === 'HATER' ||
    (request.actorKind === 'AMBIENT_NPC' && clamp01(request.pressure01) >= 0.6) ||
    Boolean(request.shouldWeaponizeDelay)
  );
}

/**
 * Derive the expected urgency class from a request without full simulation.
 */
export function estimateUrgencyClass(
  request: TypingSimulationRequest,
): BackendLatencyResolution['urgency'] {
  if (request.actorKind === 'HELPER' && clamp01(request.helperNeed01) >= 0.8) return 'IMMEDIATE';
  if (clamp01(request.pressure01) >= 0.72) return 'HIGH';
  if (clamp01(request.negotiationPressure01) >= 0.5) return 'MEDIUM';
  if (clamp01(request.pressure01) >= 0.4) return 'MEDIUM';
  return 'LOW';
}

/**
 * Estimate the channel family's expected delay multiplier.
 * Used for upstream budget scheduling.
 */
export function channelFamilyDelayMultiplier(channelId: ChatChannelId): number {
  const family = channelFamily(channelId);
  switch (family) {
    case 'NEGOTIATION': return 1.8;
    case 'SHADOW': return 0.0;
    case 'LOBBY': return 0.7;
    default: return 1.0;
  }
}

/* ============================================================================
 * MARK: Factory functions
 * ============================================================================
 */

export function createTypingSimulationEngine(args: {
  config?: Partial<TypingSimulationEngineConfig>;
  presenceResolver?: PresenceStyleResolver;
  readPolicy?: ReadReceiptPolicy;
  silencePolicy?: ChatSilencePolicy;
} = {}): TypingSimulationEngine {
  return new TypingSimulationEngine(args);
}

export function createTypingSimulationEngineFromProfile(
  profile: TypingSimulationEngineProfile,
  args: {
    overrides?: Partial<TypingSimulationEngineConfig>;
    presenceResolver?: PresenceStyleResolver;
    readPolicy?: ReadReceiptPolicy;
    silencePolicy?: ChatSilencePolicy;
  } = {},
): TypingSimulationEngine {
  const profileConfig = TYPING_ENGINE_PROFILE_OPTIONS[profile];
  return new TypingSimulationEngine({
    config: { ...profileConfig, ...(args.overrides ?? {}) },
    presenceResolver: args.presenceResolver,
    readPolicy: args.readPolicy,
    silencePolicy: args.silencePolicy,
  });
}

export function createStandardTypingEngine(
  overrides: Partial<TypingSimulationEngineConfig> = {},
): TypingSimulationEngine {
  return createTypingSimulationEngineFromProfile('STANDARD', { overrides });
}

export function createAggressiveHaterTypingEngine(
  overrides: Partial<TypingSimulationEngineConfig> = {},
): TypingSimulationEngine {
  return createTypingSimulationEngineFromProfile('AGGRESSIVE_HATER', { overrides });
}

export function createPatientHelperTypingEngine(
  overrides: Partial<TypingSimulationEngineConfig> = {},
): TypingSimulationEngine {
  return createTypingSimulationEngineFromProfile('PATIENT_HELPER', { overrides });
}

export function createNegotiationStallTypingEngine(
  overrides: Partial<TypingSimulationEngineConfig> = {},
): TypingSimulationEngine {
  return createTypingSimulationEngineFromProfile('NEGOTIATION_STALL', { overrides });
}

export function createShadowMinimalTypingEngine(
  overrides: Partial<TypingSimulationEngineConfig> = {},
): TypingSimulationEngine {
  return createTypingSimulationEngineFromProfile('SHADOW_MINIMAL', { overrides });
}

export function createLiveopsRapidTypingEngine(
  overrides: Partial<TypingSimulationEngineConfig> = {},
): TypingSimulationEngine {
  return createTypingSimulationEngineFromProfile('LIVEOPS_RAPID', { overrides });
}

export function createCinematicTypingEngine(
  overrides: Partial<TypingSimulationEngineConfig> = {},
): TypingSimulationEngine {
  return createTypingSimulationEngineFromProfile('CINEMATIC', { overrides });
}

/* ============================================================================
 * MARK: Module bundle
 * ============================================================================
 */

export const ChatTypingSimulationEngineModule = Object.freeze({
  TypingSimulationEngine,
  createTypingSimulationEngine,
  createTypingSimulationEngineFromProfile,
  createStandardTypingEngine,
  createAggressiveHaterTypingEngine,
  createPatientHelperTypingEngine,
  createNegotiationStallTypingEngine,
  createShadowMinimalTypingEngine,
  createLiveopsRapidTypingEngine,
  createCinematicTypingEngine,
  willProduceShadowTyping,
  likelyFakeTypingStart,
  estimateUrgencyClass,
  channelFamilyDelayMultiplier,
  TYPING_ENGINE_PROFILE_OPTIONS,
});
