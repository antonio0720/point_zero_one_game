/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT PRESENCE STYLE RESOLVER
 * FILE: backend/src/game/engine/chat/presence/PresenceStyleResolver.ts
 * VERSION: 2026.03.23-presence-resolver.v2
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Backend authority for NPC / helper / hater / deal-room / world-event
 * presence theater. This module does not own transport fanout and does not own
 * the transcript. It owns one thing only: deciding how an actor should feel in
 * the room before the line lands.
 *
 * Why this file exists
 * --------------------
 * The shared contract lane already owns the canonical presence vocabularies in
 * /shared/contracts/chat/ChatPresence.ts and the canonical typing vocabulary in
 * /shared/contracts/chat/ChatTyping.ts. What the repo still needs is the
 * backend runtime law that uses those vocabularies to choose an authored style
 * for a specific moment:
 *
 * - rivals sometimes lurk before striking,
 * - helpers sometimes read and wait,
 * - ambient crowd actors should pulse without spamming,
 * - deal-room entities should weaponize unread pressure,
 * - some enemies should answer instantly,
 * - others should hover, type, abort, and arrive late on purpose.
 *
 * Design laws
 * -----------
 * 1. Shared contracts stay authoritative for allowed style kinds.
 * 2. This resolver may author many runtime variants, but every variant must
 *    collapse to legal shared-contract enums.
 * 3. Delay is not random noise. It is gameplay pressure.
 * 4. Presence theater must respect channel family, actor role, pressure,
 *    relationship intensity, audience heat, and silence windows.
 * 5. Shadow channels remain first-class.
 *
 * Subsystem surface
 * -----------------
 * - 14 presence style variants across 4 channel families
 * - 6 configuration profiles (BALANCED, HATER_HEAVY, HELPER_PRIORITY,
 *   NEGOTIATION_FOCUS, LIVEOPS_RESPONSIVE, SHADOW_HEAVY)
 * - Full signal vector: 13 behavioral axes
 * - Behavior flags: 10 behavioral flags derived from variant + signal
 * - Diagnostics, audit reports, diff, stats, serialization
 * - Batch and room-level resolution
 * ============================================================================
 */

import type {
  ChatChannelId,
  ChatShadowChannel,
  ChatVisibleChannel,
  JsonValue,
  Score01,
  UnixMs,
} from '../types';

import type { ChatActorKind } from '../../../../../../shared/contracts/chat/ChatChannels';
import type { ChatAuthority } from '../../../../../../shared/contracts/chat/ChatEvents';

import {
  DEFAULT_HELPER_SOFT_STYLE,
  DEFAULT_HUMAN_PRESENCE_STYLE,
  DEFAULT_NPC_LURK_STYLE,
  DEFAULT_PUBLIC_READ_POLICY,
  DEFAULT_NEGOTIATION_READ_POLICY,
  DEFAULT_SHADOW_READ_POLICY,
  DEFAULT_SHADOW_STYLE,
  deriveDefaultPresenceStyle,
  deriveDefaultReadPolicy,
  type ChatPresenceStyleId,
  type ChatPresenceStyleProfile,
  type ChatPresenceVisibilityClass,
  type ChatReadDelayPolicyKind,
  type ChatReadPolicyId,
  type ChatReadReceiptPolicy,
  type ChatTypingTheaterKind,
} from '../../../../../../shared/contracts/chat/ChatPresence';

import type {
  BackendLatencyReason,
  BackendLatencyResolution,
  BackendLatencyUrgencyBand,
} from '../persona/LatencyStyleResolver';

import type { ChatSilenceDecision } from '../experience/ChatSilencePolicy';

/* ============================================================================
 * MARK: Local scalar helpers
 * ============================================================================
 */

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function clamp01(value: number | null | undefined): number {
  if (value == null || Number.isNaN(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return Number(value.toFixed(6));
}

function round(value: number): number {
  return Math.round(value);
}

function average(...values: ReadonlyArray<number | null | undefined>): number {
  const filtered = values.filter((value): value is number => value != null && Number.isFinite(value));
  if (!filtered.length) return 0;
  return filtered.reduce((total, value) => total + value, 0) / filtered.length;
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

function nowMs(now?: number | UnixMs | null): number {
  if (typeof now === 'number' && Number.isFinite(now)) return Math.floor(now);
  return Date.now();
}

function uniq(values: readonly string[]): readonly string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function asAuthority(value?: ChatAuthority | null): ChatAuthority {
  return (value ?? ('BACKEND' as ChatAuthority));
}

function normalizeVisibleChannel(value: ChatChannelId): ChatVisibleChannel {
  switch (value) {
    case 'GLOBAL':
    case 'SYNDICATE':
    case 'DEAL_ROOM':
    case 'LOBBY':
      return value;
    default:
      return 'GLOBAL';
  }
}

function normalizeShadowChannel(value: ChatChannelId): ChatShadowChannel {
  switch (value) {
    case 'SYSTEM_SHADOW':
    case 'NPC_SHADOW':
    case 'RIVALRY_SHADOW':
    case 'RESCUE_SHADOW':
    case 'LIVEOPS_SHADOW':
      return value;
    default:
      return 'SYSTEM_SHADOW';
  }
}

function isShadowChannel(value: ChatChannelId): value is ChatShadowChannel {
  switch (value) {
    case 'SYSTEM_SHADOW':
    case 'NPC_SHADOW':
    case 'RIVALRY_SHADOW':
    case 'RESCUE_SHADOW':
    case 'LIVEOPS_SHADOW':
      return true;
    default:
      return false;
  }
}

/* ============================================================================
 * MARK: Channel family
 * ============================================================================
 */

export type PresenceStyleChannelFamily =
  | 'PUBLIC'
  | 'NEGOTIATION'
  | 'LOBBY'
  | 'SHADOW';

function channelFamily(channelId: ChatChannelId): PresenceStyleChannelFamily {
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

/* ============================================================================
 * MARK: Resolver contracts
 * ============================================================================
 */

export type PresenceStyleVariantKey =
  | 'PLAYER_BASELINE'
  | 'PLAYER_NEGOTIATION'
  | 'NPC_AMBIENT'
  | 'NPC_DIRECT'
  | 'NPC_LURK'
  | 'HATER_STALK'
  | 'HATER_STRIKE'
  | 'HELPER_OBSERVE'
  | 'HELPER_SURGE'
  | 'DEAL_SILENT'
  | 'DEAL_PREDATOR'
  | 'SYSTEM_BANNER'
  | 'LIVEOPS_PULSE'
  | 'SHADOW_VEIL';

export type PresenceStyleVariantClass =
  | 'LURKING'
  | 'HOSTILE'
  | 'HELPER'
  | 'NEGOTIATION'
  | 'AMBIENT'
  | 'PLAYER'
  | 'SYSTEM'
  | 'SHADOW';

export interface PresenceStyleSignalVector {
  readonly pressure01: number;
  readonly audienceHeat01: number;
  readonly negotiationPressure01: number;
  readonly helperNeed01: number;
  readonly relationshipIntensity01: number;
  readonly obsession01: number;
  readonly respect01: number;
  readonly fear01: number;
  readonly contempt01: number;
  readonly embarrassment01: number;
  readonly urgency01: number;
  readonly silenceWeight01: number;
  readonly callbackOpportunity01: number;
}

export interface PresenceStyleResolutionInput {
  readonly actorId: string;
  readonly actorKind: ChatActorKind;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly authority?: ChatAuthority | null;
  readonly now?: UnixMs | number | null;
  readonly seed?: string | null;
  readonly displayName?: string | null;
  readonly relationshipId?: string | null;
  readonly intent?:
    | 'AMBIENT'
    | 'WITNESS'
    | 'RESCUE'
    | 'TAUNT'
    | 'COUNTER'
    | 'NEGOTIATION'
    | 'SYSTEM_NOTICE'
    | 'LIVEOPS'
    | 'CALLBACK'
    | 'POSTRUN'
    | 'UNKNOWN';
  readonly pressure01?: number | Score01 | null;
  readonly audienceHeat01?: number | Score01 | null;
  readonly negotiationPressure01?: number | Score01 | null;
  readonly helperNeed01?: number | Score01 | null;
  readonly relationshipIntensity01?: number | Score01 | null;
  readonly relationshipObsession01?: number | Score01 | null;
  readonly relationshipRespect01?: number | Score01 | null;
  readonly relationshipFear01?: number | Score01 | null;
  readonly relationshipContempt01?: number | Score01 | null;
  readonly embarrassment01?: number | Score01 | null;
  readonly callbackOpportunity01?: number | Score01 | null;
  readonly worldEventActive?: boolean;
  readonly shouldWeaponizeDelay?: boolean;
  readonly shouldSuppressVisibleReceipt?: boolean;
  readonly shouldShadowPrime?: boolean;
  readonly allowInstantStrike?: boolean;
  readonly latency?: BackendLatencyResolution | null;
  readonly latencyReason?: BackendLatencyReason | null;
  readonly urgency?: BackendLatencyUrgencyBand | null;
  readonly silenceDecision?: ChatSilenceDecision | null;
  readonly tags?: readonly string[] | null;
  readonly metadata?: Readonly<Record<string, JsonValue>> | null;
}

export interface PresenceStyleBehaviorFlags {
  readonly shouldLurk: boolean;
  readonly shouldReadBeforeReply: boolean;
  readonly shouldFakeTypingStart: boolean;
  readonly shouldFakeTypingStop: boolean;
  readonly shouldDelayReceipt: boolean;
  readonly shouldSuppressVisibleReceipt: boolean;
  readonly shouldMirrorShadow: boolean;
  readonly shouldHoldUnreadPressure: boolean;
  readonly shouldEscalateToInstantStrike: boolean;
  readonly shouldAppearAsAudience: boolean;
}

export interface PresenceStyleResolution {
  readonly actorId: string;
  readonly actorKind: ChatActorKind;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly variantKey: PresenceStyleVariantKey;
  readonly styleProfile: ChatPresenceStyleProfile;
  readonly readPolicy: ChatReadReceiptPolicy;
  readonly channelFamily: PresenceStyleChannelFamily;
  readonly signalVector: PresenceStyleSignalVector;
  readonly behavior: PresenceStyleBehaviorFlags;
  readonly confidence01: number;
  readonly reasons: readonly string[];
  readonly tags: readonly string[];
  readonly derivedAt: number;
}

export interface PresenceStyleResolverConfig {
  readonly version: string;
  readonly helperUrgencyThreshold01: number;
  readonly haterStrikeThreshold01: number;
  readonly dealPressureThreshold01: number;
  readonly ambientAudienceThreshold01: number;
  readonly silenceLurkThreshold01: number;
  readonly embarrassmentStrikeWeight: number;
  readonly obsessionStrikeWeight: number;
  readonly callbackStrikeWeight: number;
  readonly respectSoftenWeight: number;
  readonly helperNeedSoftenWeight: number;
  readonly negotiationDelayAmplifier: number;
  readonly shadowConfidenceBoost01: number;
  readonly instantStrikeLatencyThresholdMs: number;
}

const DEFAULT_CONFIG: PresenceStyleResolverConfig = Object.freeze({
  version: '2026.03.23',
  helperUrgencyThreshold01: 0.72,
  haterStrikeThreshold01: 0.78,
  dealPressureThreshold01: 0.64,
  ambientAudienceThreshold01: 0.58,
  silenceLurkThreshold01: 0.55,
  embarrassmentStrikeWeight: 0.85,
  obsessionStrikeWeight: 0.92,
  callbackStrikeWeight: 0.64,
  respectSoftenWeight: 0.22,
  helperNeedSoftenWeight: 0.48,
  negotiationDelayAmplifier: 1.18,
  shadowConfidenceBoost01: 0.18,
  instantStrikeLatencyThresholdMs: 520,
});

/* ============================================================================
 * MARK: Configuration profiles
 * ============================================================================
 */

export type PresenceStyleResolverProfile =
  | 'BALANCED'
  | 'HATER_HEAVY'
  | 'HELPER_PRIORITY'
  | 'NEGOTIATION_FOCUS'
  | 'LIVEOPS_RESPONSIVE'
  | 'SHADOW_HEAVY';

export interface PresenceStyleResolverProfileDescriptor {
  readonly profile: PresenceStyleResolverProfile;
  readonly config: PresenceStyleResolverConfig;
  readonly description: string;
}

export const PRESENCE_STYLE_RESOLVER_PROFILE_OPTIONS: Readonly<
  Record<PresenceStyleResolverProfile, PresenceStyleResolverProfileDescriptor>
> = Object.freeze({
  BALANCED: Object.freeze({
    profile: 'BALANCED',
    config: DEFAULT_CONFIG,
    description: 'Default balanced variant selection. All NPC types equally weighted. No amplifiers.',
  }),
  HATER_HEAVY: Object.freeze({
    profile: 'HATER_HEAVY',
    config: Object.freeze({
      ...DEFAULT_CONFIG,
      haterStrikeThreshold01: 0.66,
      obsessionStrikeWeight: 1.0,
      embarrassmentStrikeWeight: 0.96,
      callbackStrikeWeight: 0.82,
      instantStrikeLatencyThresholdMs: 700,
    }),
    description: 'Raises aggression ceiling — haters escalate earlier with more ferocity. Use in rivalry-heavy runs.',
  }),
  HELPER_PRIORITY: Object.freeze({
    profile: 'HELPER_PRIORITY',
    config: Object.freeze({
      ...DEFAULT_CONFIG,
      helperUrgencyThreshold01: 0.56,
      helperNeedSoftenWeight: 0.64,
      respectSoftenWeight: 0.30,
    }),
    description: 'Helpers surge more readily. Lower frustration is enough to trigger a surge. Use in rescue-heavy sessions.',
  }),
  NEGOTIATION_FOCUS: Object.freeze({
    profile: 'NEGOTIATION_FOCUS',
    config: Object.freeze({
      ...DEFAULT_CONFIG,
      dealPressureThreshold01: 0.48,
      negotiationDelayAmplifier: 1.52,
      silenceLurkThreshold01: 0.44,
    }),
    description: 'Deal-room presence becomes oppressive. Rivals linger longer before arriving. Silent rooms amplify.',
  }),
  LIVEOPS_RESPONSIVE: Object.freeze({
    profile: 'LIVEOPS_RESPONSIVE',
    config: Object.freeze({
      ...DEFAULT_CONFIG,
      ambientAudienceThreshold01: 0.40,
    }),
    description: 'World events immediately shift audience behavior. Crowd swells at lower heat thresholds.',
  }),
  SHADOW_HEAVY: Object.freeze({
    profile: 'SHADOW_HEAVY',
    config: Object.freeze({
      ...DEFAULT_CONFIG,
      shadowConfidenceBoost01: 0.34,
      silenceLurkThreshold01: 0.38,
    }),
    description: 'Shadow channel actors earn higher confidence. Heavy backstage staging. Wide silence tolerance.',
  }),
} as const);

/* ============================================================================
 * MARK: Analytics and diagnostics types
 * ============================================================================
 */

export interface PresenceStyleDiagnostics {
  readonly actorId: string;
  readonly actorKind: ChatActorKind;
  readonly channelId: ChatChannelId;
  readonly channelFamily: PresenceStyleChannelFamily;
  readonly resolvedVariant: PresenceStyleVariantKey;
  readonly variantClass: PresenceStyleVariantClass;
  readonly confidence01: number;
  readonly signalVector: PresenceStyleSignalVector;
  readonly behaviorFlags: PresenceStyleBehaviorFlags;
  readonly instantStrikeEligible: boolean;
  readonly shadowMirrorEligible: boolean;
  readonly lurking: boolean;
  readonly weaponizedDelay: boolean;
  readonly styleId: string;
  readonly typingTheater: ChatTypingTheaterKind;
  readonly readDelayPolicy: ChatReadDelayPolicyKind;
  readonly playerVisibleReceipt: boolean;
  readonly reasons: readonly string[];
  readonly tags: readonly string[];
  readonly derivedAt: number;
}

export interface PresenceStyleAuditEntry {
  readonly actorId: string;
  readonly actorKind: ChatActorKind;
  readonly channelId: ChatChannelId;
  readonly resolvedVariant: PresenceStyleVariantKey;
  readonly confidence01: number;
  readonly durationSinceLastMs: number;
  readonly topReasons: readonly string[];
  readonly derivedAt: number;
}

export interface PresenceStyleAuditReport {
  readonly generatedAt: number;
  readonly entryCount: number;
  readonly variantDistribution: Readonly<Partial<Record<PresenceStyleVariantKey, number>>>;
  readonly channelDistribution: Readonly<Partial<Record<PresenceStyleChannelFamily, number>>>;
  readonly actorKindDistribution: Readonly<Partial<Record<string, number>>>;
  readonly averageConfidence01: number;
  readonly lurkingRate01: number;
  readonly shadowRate01: number;
  readonly instantStrikeRate01: number;
  readonly helperSurgeRate01: number;
  readonly entries: readonly PresenceStyleAuditEntry[];
  readonly topVariant: PresenceStyleVariantKey | null;
  readonly dominantChannelFamily: PresenceStyleChannelFamily | null;
  readonly diagnosticFlags: readonly string[];
}

export interface PresenceStyleDiff {
  readonly beforeVariant: PresenceStyleVariantKey;
  readonly afterVariant: PresenceStyleVariantKey;
  readonly variantChanged: boolean;
  readonly channelFamilyChanged: boolean;
  readonly confidenceDelta: number;
  readonly behaviorChanges: readonly string[];
  readonly signalDeltas: Readonly<Partial<Record<keyof PresenceStyleSignalVector, number>>>;
  readonly lurkingChanged: boolean;
  readonly shadowChanged: boolean;
  readonly instantStrikeChanged: boolean;
  readonly readPolicyChanged: boolean;
  readonly derivedAt: number;
}

export interface PresenceStyleStatsSummary {
  readonly totalResolutions: number;
  readonly variantCounts: Readonly<Partial<Record<PresenceStyleVariantKey, number>>>;
  readonly averageConfidence01: number;
  readonly minConfidence01: number;
  readonly maxConfidence01: number;
  readonly lurkingCount: number;
  readonly shadowCount: number;
  readonly instantStrikeCount: number;
  readonly helperSurgeCount: number;
  readonly haterStrikeCount: number;
  readonly negotiationCount: number;
  readonly pressureDistribution: { readonly low: number; readonly mid: number; readonly high: number };
}

export interface PresenceStyleSerializedState {
  readonly version: string;
  readonly config: PresenceStyleResolverConfig;
  readonly profile?: PresenceStyleResolverProfile;
  readonly serializedAt: number;
}

export interface PresenceStyleBatchResult {
  readonly generatedAt: number;
  readonly totalCount: number;
  readonly results: readonly PresenceStyleResolution[];
  readonly stats: PresenceStyleStatsSummary;
}

export interface PresenceStyleRoomInput {
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly now?: UnixMs | number | null;
  readonly actors: readonly {
    readonly actorId: string;
    readonly actorKind: ChatActorKind;
    readonly intent?: PresenceStyleResolutionInput['intent'];
    readonly pressure01?: number | null;
    readonly helperNeed01?: number | null;
    readonly negotiationPressure01?: number | null;
    readonly relationshipObsession01?: number | null;
    readonly relationshipIntensity01?: number | null;
    readonly embarrassment01?: number | null;
    readonly urgency?: BackendLatencyUrgencyBand | null;
    readonly allowInstantStrike?: boolean;
    readonly shouldShadowPrime?: boolean;
    readonly metadata?: Readonly<Record<string, JsonValue>> | null;
  }[];
  readonly audienceHeat01?: number | null;
  readonly worldEventActive?: boolean;
  readonly silenceDecision?: ChatSilenceDecision | null;
}

export interface PresenceStyleRoomResult {
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly family: PresenceStyleChannelFamily;
  readonly generatedAt: number;
  readonly resolutions: readonly PresenceStyleResolution[];
  readonly primaryActor: PresenceStyleResolution | null;
  readonly dominantVariant: PresenceStyleVariantKey | null;
  readonly hasActiveHater: boolean;
  readonly hasHelperSurge: boolean;
  readonly hasNegotiationPressure: boolean;
  readonly hasShadowPresence: boolean;
}

export interface PresenceStyleNpcTurnInput {
  readonly actorId: string;
  readonly actorKind: ChatActorKind;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly turnIndex: number;
  readonly turnCount: number;
  readonly now?: UnixMs | number | null;
  readonly intent?: PresenceStyleResolutionInput['intent'];
  readonly pressure01?: number | null;
  readonly helperNeed01?: number | null;
  readonly negotiationPressure01?: number | null;
  readonly embarrassment01?: number | null;
  readonly audienceHeat01?: number | null;
  readonly allowInstantStrike?: boolean;
  readonly seed?: string | null;
  readonly silenceDecision?: ChatSilenceDecision | null;
  readonly latency?: BackendLatencyResolution | null;
}

/* ============================================================================
 * MARK: Runtime style builders
 * ============================================================================
 */

function cloneStyle(
  base: ChatPresenceStyleProfile,
  overrides: Partial<ChatPresenceStyleProfile>,
): ChatPresenceStyleProfile {
  return Object.freeze({
    ...base,
    ...overrides,
  });
}

function cloneReadPolicy(
  base: ChatReadReceiptPolicy,
  overrides: Partial<ChatReadReceiptPolicy>,
): ChatReadReceiptPolicy {
  return Object.freeze({
    ...base,
    ...overrides,
  });
}

function buildVariantStyle(
  key: PresenceStyleVariantKey,
  input: PresenceStyleResolutionInput,
  vector: PresenceStyleSignalVector,
): ChatPresenceStyleProfile {
  const derived = deriveDefaultPresenceStyle(input.actorKind, input.channelId);

  switch (key) {
    case 'PLAYER_NEGOTIATION':
      return cloneStyle(DEFAULT_HUMAN_PRESENCE_STYLE, {
        styleId: 'presence-style-player-negotiation' as ChatPresenceStyleId,
        typingTheater: 'HESITANT',
        readDelayPolicy: 'THINKING_DELAY',
        typicalLatencyMs: 120,
        typingBurstMinMs: 520,
        typingBurstMaxMs: 2600,
        pauseMinMs: 280,
        pauseMaxMs: 1450,
        notes: 'Players slow down in predatory negotiation chambers.',
      });

    case 'NPC_AMBIENT':
      return cloneStyle(derived, {
        styleId: 'presence-style-npc-ambient' as ChatPresenceStyleId,
        styleKind: 'NPC_AMBIENT',
        typingTheater: 'AMBIENT_DRIFT',
        readDelayPolicy: 'SHORT_DELAY',
        typicalLatencyMs: 180,
        typingBurstMinMs: 620,
        typingBurstMaxMs: 2100,
        pauseMinMs: 220,
        pauseMaxMs: 980,
        notes: 'Ambient crowd witness that keeps the room alive without stealing focus.',
      });

    case 'NPC_DIRECT':
      return cloneStyle(derived, {
        styleId: 'presence-style-npc-direct' as ChatPresenceStyleId,
        styleKind: 'NPC_DIRECT',
        typingTheater: 'BURSTY',
        readDelayPolicy: 'SHORT_DELAY',
        typicalLatencyMs: 90,
        typingBurstMinMs: 350,
        typingBurstMaxMs: 1500,
        pauseMinMs: 140,
        pauseMaxMs: 680,
        notes: 'Direct NPC arrival used when the room needs immediate visible witness.',
      });

    case 'HATER_STALK':
      return cloneStyle(DEFAULT_NPC_LURK_STYLE, {
        styleId: 'presence-style-hater-stalk' as ChatPresenceStyleId,
        styleKind: 'HATER_STALK',
        typingTheater: 'WEAPONIZED_DELAY',
        readDelayPolicy: 'HATER_STARE',
        typicalLatencyMs: clamp(round(240 + vector.pressure01 * 260 + vector.audienceHeat01 * 110) + deterministicRange(0, 80, input.seed ?? input.actorId), 240, 690),
        typingBurstMinMs: 1150,
        typingBurstMaxMs: 3900,
        pauseMinMs: 920,
        pauseMaxMs: 2800,
        notes: 'Rival hovers, reads, and chooses the most humiliating arrival window.',
      });

    case 'HATER_STRIKE':
      return cloneStyle(DEFAULT_NPC_LURK_STYLE, {
        styleId: 'presence-style-hater-strike' as ChatPresenceStyleId,
        styleKind: 'HATER_STALK',
        typingTheater: input.allowInstantStrike ? 'INSTANT' : 'WEAPONIZED_DELAY',
        readDelayPolicy: 'HATER_STARE',
        typicalLatencyMs: input.allowInstantStrike ? 40 : 120,
        typingBurstMinMs: input.allowInstantStrike ? 0 : 460,
        typingBurstMaxMs: input.allowInstantStrike ? 1000 : 1800,
        pauseMinMs: 0,
        pauseMaxMs: input.allowInstantStrike ? 180 : 660,
        notes: 'Hostile strike variant for humiliations, counters, and callback stabs.',
      });

    case 'HELPER_OBSERVE':
      return cloneStyle(DEFAULT_HELPER_SOFT_STYLE, {
        styleId: 'presence-style-helper-observe' as ChatPresenceStyleId,
        styleKind: 'HELPER_WATCH',
        typingTheater: 'HELPER_SOFT',
        readDelayPolicy: 'HELPER_SOFTEN',
        typicalLatencyMs: 150,
        typingBurstMinMs: 560,
        typingBurstMaxMs: 2100,
        pauseMinMs: 240,
        pauseMaxMs: 1240,
        notes: 'Helper reads, waits, and enters without smothering the player.',
      });

    case 'HELPER_SURGE':
      return cloneStyle(DEFAULT_HELPER_SOFT_STYLE, {
        styleId: 'presence-style-helper-surge' as ChatPresenceStyleId,
        styleKind: 'HELPER_WATCH',
        typingTheater: 'INSTANT',
        readDelayPolicy: 'SHORT_DELAY',
        typicalLatencyMs: 60,
        typingBurstMinMs: 240,
        typingBurstMaxMs: 900,
        pauseMinMs: 0,
        pauseMaxMs: 200,
        notes: 'Fast helper interception used when frustration or collapse is acute.',
      });

    case 'DEAL_SILENT':
      return cloneStyle(DEFAULT_HUMAN_PRESENCE_STYLE, {
        styleId: 'presence-style-deal-silent' as ChatPresenceStyleId,
        styleKind: 'NPC_DIRECT',
        typingTheater: 'HESITANT',
        readDelayPolicy: 'NEGOTIATION_PRESSURE',
        typicalLatencyMs: 180,
        typingBurstMinMs: 700,
        typingBurstMaxMs: 2400,
        pauseMinMs: 300,
        pauseMaxMs: 1600,
        notes: 'Predatory silence in deal rooms before the other party shows its hand.',
      });

    case 'DEAL_PREDATOR':
      return cloneStyle(DEFAULT_NPC_LURK_STYLE, {
        styleId: 'presence-style-deal-predator' as ChatPresenceStyleId,
        styleKind: 'NPC_LURK',
        typingTheater: 'WEAPONIZED_DELAY',
        readDelayPolicy: 'NEGOTIATION_PRESSURE',
        typicalLatencyMs: clamp(round(260 + vector.negotiationPressure01 * 420) + deterministicRange(0, 60, input.seed ?? input.actorId), 260, 740),
        typingBurstMinMs: 980,
        typingBurstMaxMs: 3200,
        pauseMinMs: 860,
        pauseMaxMs: 2400,
        notes: 'Negotiation entity reads the room and leaves the offer hanging.',
      });

    case 'SYSTEM_BANNER':
      return cloneStyle(DEFAULT_SHADOW_STYLE, {
        styleId: 'presence-style-system-banner' as ChatPresenceStyleId,
        styleKind: 'SYSTEM_BANNER',
        typingTheater: 'NONE',
        readDelayPolicy: 'NEVER',
        presenceVisibilityClass: isShadowChannel(input.channelId) ? 'SHADOW' : 'VISIBLE',
        typicalLatencyMs: 0,
        notes: 'Ceremonial system layer for notices, foreshadowing, and scene punctuation.',
      });

    case 'LIVEOPS_PULSE':
      return cloneStyle(DEFAULT_HUMAN_PRESENCE_STYLE, {
        styleId: 'presence-style-liveops-pulse' as ChatPresenceStyleId,
        styleKind: 'LIVEOPS_PULSE',
        typingTheater: 'BURSTY',
        readDelayPolicy: 'SHORT_DELAY',
        typicalLatencyMs: 70,
        typingBurstMinMs: 180,
        typingBurstMaxMs: 900,
        pauseMinMs: 0,
        pauseMaxMs: 280,
        simulated: true,
        notes: 'World-event pulse that should feel immediate but still staged.',
      });

    case 'SHADOW_VEIL':
      return cloneStyle(DEFAULT_SHADOW_STYLE, {
        styleId: 'presence-style-shadow-veil' as ChatPresenceStyleId,
        styleKind: 'SYSTEM_BANNER',
        typingTheater: 'NONE',
        readDelayPolicy: 'NEVER',
        presenceVisibilityClass: 'SHADOW',
        simulated: true,
        notes: 'Hidden preparatory state for deferred reveal, callback anchors, and suppressed witness pressure.',
      });

    case 'PLAYER_BASELINE':
      return cloneStyle(DEFAULT_HUMAN_PRESENCE_STYLE, {
        styleId: 'presence-style-player-baseline' as ChatPresenceStyleId,
        notes: 'Default player presence surface.',
      });

    case 'NPC_LURK':
    default:
      return cloneStyle(DEFAULT_NPC_LURK_STYLE, {
        styleId: 'presence-style-npc-lurk-runtime' as ChatPresenceStyleId,
        notes: 'Default lurking NPC runtime style.',
      });
  }
}

function buildVariantReadPolicy(
  key: PresenceStyleVariantKey,
  input: PresenceStyleResolutionInput,
  styleProfile: ChatPresenceStyleProfile,
  vector: PresenceStyleSignalVector,
): ChatReadReceiptPolicy {
  const derived = deriveDefaultReadPolicy(input.channelId);

  switch (key) {
    case 'SHADOW_VEIL':
    case 'SYSTEM_BANNER':
      return cloneReadPolicy(DEFAULT_SHADOW_READ_POLICY, {
        policyId: `${styleProfile.styleId}-read` as ChatReadPolicyId,
      });

    case 'DEAL_SILENT':
    case 'DEAL_PREDATOR':
      return cloneReadPolicy(DEFAULT_NEGOTIATION_READ_POLICY, {
        policyId: `${styleProfile.styleId}-read` as ChatReadPolicyId,
        visibilityMode: 'SENDER_ONLY',
        minDelayMs: clamp(round(900 + vector.negotiationPressure01 * 1100), 900, 2000),
        maxDelayMs: clamp(round(3200 + vector.negotiationPressure01 * 2800), 3200, 6000),
        playerVisible: true,
      });

    case 'HATER_STALK':
      return cloneReadPolicy(DEFAULT_PUBLIC_READ_POLICY, {
        policyId: `${styleProfile.styleId}-read` as ChatReadPolicyId,
        visibilityMode: input.shouldSuppressVisibleReceipt ? 'SENDER_ONLY' : 'PUBLIC',
        minDelayMs: clamp(round(850 + vector.pressure01 * 1300), 850, 2150),
        maxDelayMs: clamp(round(2200 + vector.pressure01 * 2600), 2200, 4800),
        playerVisible: !input.shouldSuppressVisibleReceipt,
      });

    case 'HATER_STRIKE':
      return cloneReadPolicy(DEFAULT_PUBLIC_READ_POLICY, {
        policyId: `${styleProfile.styleId}-read` as ChatReadPolicyId,
        visibilityMode: input.allowInstantStrike ? 'PUBLIC' : 'SENDER_ONLY',
        minDelayMs: input.allowInstantStrike ? 0 : 280,
        maxDelayMs: input.allowInstantStrike ? 120 : 900,
        playerVisible: Boolean(input.allowInstantStrike),
      });

    case 'HELPER_OBSERVE':
      return cloneReadPolicy(DEFAULT_PUBLIC_READ_POLICY, {
        policyId: `${styleProfile.styleId}-read` as ChatReadPolicyId,
        visibilityMode: 'SENDER_ONLY',
        minDelayMs: 320,
        maxDelayMs: round(900 + vector.helperNeed01 * 1000),
        playerVisible: true,
      });

    case 'HELPER_SURGE':
      return cloneReadPolicy(DEFAULT_PUBLIC_READ_POLICY, {
        policyId: `${styleProfile.styleId}-read` as ChatReadPolicyId,
        visibilityMode: 'PUBLIC',
        minDelayMs: 80,
        maxDelayMs: 320,
        playerVisible: true,
      });

    case 'NPC_AMBIENT':
      return cloneReadPolicy(DEFAULT_PUBLIC_READ_POLICY, {
        policyId: `${styleProfile.styleId}-read` as ChatReadPolicyId,
        visibilityMode: 'PUBLIC',
        minDelayMs: 180,
        maxDelayMs: 1400,
        playerVisible: false,
      });

    default:
      return cloneReadPolicy(derived, {
        policyId: `${styleProfile.styleId}-read` as ChatReadPolicyId,
      });
  }
}

/* ============================================================================
 * MARK: Signal synthesis
 * ============================================================================
 */

function urgency01(
  urgency?: BackendLatencyUrgencyBand | null,
  reason?: BackendLatencyReason | null,
): number {
  switch (urgency) {
    case 'IMMEDIATE':
      return 1;
    case 'CRITICAL':
      return 0.9;
    case 'HIGH':
      return 0.72;
    case 'MEDIUM':
      return 0.52;
    case 'LOW':
      return 0.28;
    case 'IDLE':
    default:
      break;
  }

  switch (reason) {
    case 'HELPER_RESCUE':
      return 0.82;
    case 'HATER_STALK':
      return 0.74;
    case 'CALLBACK_STRIKE':
      return 0.68;
    case 'NEGOTIATION_PRESSURE':
      return 0.66;
    case 'PLAYER_COLLAPSE':
      return 0.88;
    case 'PLAYER_COMEBACK':
      return 0.64;
    default:
      return 0.2;
  }
}

function buildSignalVector(input: PresenceStyleResolutionInput): PresenceStyleSignalVector {
  const silenceWeight01 = clamp01(input.silenceDecision?.score01 ?? 0);
  const urgencySignal01 = clamp01(
    average(
      urgency01(input.urgency ?? input.latency?.urgency ?? null, input.latencyReason ?? input.latency?.reason ?? null),
      input.latency?.reason === 'INTERRUPT_PREEMPT' ? 0.88 : null,
      input.latency?.reason === 'HELPER_RESCUE' ? 0.82 : null,
      input.latency?.reason === 'HATER_STALK' ? 0.7 : null,
    ),
  );

  return Object.freeze({
    pressure01: clamp01(input.pressure01),
    audienceHeat01: clamp01(input.audienceHeat01),
    negotiationPressure01: clamp01(input.negotiationPressure01),
    helperNeed01: clamp01(input.helperNeed01),
    relationshipIntensity01: clamp01(input.relationshipIntensity01),
    obsession01: clamp01(input.relationshipObsession01),
    respect01: clamp01(input.relationshipRespect01),
    fear01: clamp01(input.relationshipFear01),
    contempt01: clamp01(input.relationshipContempt01),
    embarrassment01: clamp01(input.embarrassment01),
    urgency01: urgencySignal01,
    silenceWeight01,
    callbackOpportunity01: clamp01(input.callbackOpportunity01),
  });
}

function buildConfidence(
  key: PresenceStyleVariantKey,
  vector: PresenceStyleSignalVector,
  input: PresenceStyleResolutionInput,
): number {
  let confidence = 0.5;

  switch (key) {
    case 'HATER_STRIKE':
      confidence += average(vector.obsession01, vector.embarrassment01, vector.urgency01) * 0.46;
      break;
    case 'HATER_STALK':
      confidence += average(vector.pressure01, vector.audienceHeat01, vector.silenceWeight01) * 0.38;
      break;
    case 'HELPER_SURGE':
      confidence += average(vector.helperNeed01, vector.urgency01) * 0.42;
      break;
    case 'DEAL_PREDATOR':
      confidence += average(vector.negotiationPressure01, vector.silenceWeight01) * 0.36;
      break;
    case 'SHADOW_VEIL':
      confidence += 0.18;
      break;
    default:
      confidence += average(vector.pressure01, vector.audienceHeat01, vector.negotiationPressure01) * 0.18;
      break;
  }

  if (isShadowChannel(input.channelId)) confidence += DEFAULT_CONFIG.shadowConfidenceBoost01;
  return clamp01(confidence);
}

function buildReasons(
  key: PresenceStyleVariantKey,
  input: PresenceStyleResolutionInput,
  vector: PresenceStyleSignalVector,
): readonly string[] {
  const reasons: string[] = [];

  reasons.push(`variant=${key}`);
  reasons.push(`family=${channelFamily(input.channelId)}`);

  if (vector.pressure01 >= 0.7) reasons.push('room-pressure-elevated');
  if (vector.audienceHeat01 >= 0.65) reasons.push('audience-heat-elevated');
  if (vector.negotiationPressure01 >= 0.62) reasons.push('deal-pressure-elevated');
  if (vector.helperNeed01 >= 0.62) reasons.push('helper-need-elevated');
  if (vector.obsession01 >= 0.66) reasons.push('rival-obsession-elevated');
  if (vector.embarrassment01 >= 0.58) reasons.push('public-embarrassment-active');
  if (vector.callbackOpportunity01 >= 0.55) reasons.push('callback-opportunity-open');
  if (vector.silenceWeight01 >= 0.55) reasons.push('silence-window-favors-lurk');
  if (input.worldEventActive) reasons.push('world-event-active');
  if (input.latency?.shadowPrimed || input.shouldShadowPrime) reasons.push('shadow-prime-ready');
  if (input.allowInstantStrike) reasons.push('instant-strike-authorized');
  if (input.shouldSuppressVisibleReceipt) reasons.push('visible-receipt-suppressed');

  return uniq(reasons);
}

function buildTags(
  key: PresenceStyleVariantKey,
  input: PresenceStyleResolutionInput,
  styleProfile: ChatPresenceStyleProfile,
): readonly string[] {
  const tags = [
    `presence:${styleProfile.styleKind}`,
    `presence-variant:${key.toLowerCase()}`,
    `channel:${String(input.channelId).toLowerCase()}`,
    `actor:${String(input.actorKind).toLowerCase()}`,
  ];

  if (isShadowChannel(input.channelId)) tags.push('shadow');
  if (input.intent) tags.push(`intent:${input.intent.toLowerCase()}`);
  if (input.tags?.length) tags.push(...input.tags);
  return uniq(tags);
}

/* ============================================================================
 * MARK: Variant selection law
 * ============================================================================
 */

function chooseVariant(
  input: PresenceStyleResolutionInput,
  vector: PresenceStyleSignalVector,
  config: PresenceStyleResolverConfig,
): PresenceStyleVariantKey {
  const family = channelFamily(input.channelId);
  const latencyMs = input.latency?.delayMs ?? input.latency?.typing.typingDurationMs ?? 0;
  const instantStrikeAuthorized = Boolean(
    input.allowInstantStrike ||
      input.latency?.urgency === 'IMMEDIATE' ||
      latencyMs <= config.instantStrikeLatencyThresholdMs,
  );

  if (family === 'SHADOW' || input.shouldShadowPrime) {
    return 'SHADOW_VEIL';
  }

  if (input.actorKind === 'SYSTEM') {
    return 'SYSTEM_BANNER';
  }

  if (input.actorKind === 'LIVEOPS' || input.worldEventActive || input.intent === 'LIVEOPS') {
    return 'LIVEOPS_PULSE';
  }

  if (family === 'NEGOTIATION') {
    if (
      input.actorKind === 'HATER' ||
      vector.negotiationPressure01 >= config.dealPressureThreshold01 ||
      input.shouldWeaponizeDelay
    ) {
      return 'DEAL_PREDATOR';
    }
    if (input.actorKind === 'PLAYER') {
      return 'PLAYER_NEGOTIATION';
    }
    return 'DEAL_SILENT';
  }

  if (input.actorKind === 'HELPER') {
    if (
      input.intent === 'RESCUE' ||
      vector.helperNeed01 >= config.helperUrgencyThreshold01 ||
      vector.urgency01 >= config.helperUrgencyThreshold01
    ) {
      return 'HELPER_SURGE';
    }
    return 'HELPER_OBSERVE';
  }

  if (input.actorKind === 'HATER') {
    const strikeScore = average(
      vector.pressure01,
      vector.obsession01 * config.obsessionStrikeWeight,
      vector.embarrassment01 * config.embarrassmentStrikeWeight,
      vector.callbackOpportunity01 * config.callbackStrikeWeight,
      vector.urgency01,
    );

    if (
      strikeScore >= config.haterStrikeThreshold01 ||
      instantStrikeAuthorized ||
      input.intent === 'COUNTER' ||
      input.intent === 'CALLBACK'
    ) {
      return 'HATER_STRIKE';
    }
    return 'HATER_STALK';
  }

  if (['AMBIENT_NPC', 'CROWD', 'DEAL_AGENT'].includes(String(input.actorKind))) {
    if (
      input.intent === 'AMBIENT' ||
      vector.audienceHeat01 >= config.ambientAudienceThreshold01 ||
      input.metadata?.['crowdWitness'] === true
    ) {
      return 'NPC_AMBIENT';
    }

    if (
      input.intent === 'WITNESS' ||
      vector.silenceWeight01 < config.silenceLurkThreshold01 ||
      vector.urgency01 >= 0.72
    ) {
      return 'NPC_DIRECT';
    }

    return 'NPC_LURK';
  }

  if (input.actorKind === 'PLAYER') {
    return channelFamily(input.channelId) === 'NEGOTIATION' ? 'PLAYER_NEGOTIATION' : 'PLAYER_BASELINE';
  }

  return 'PLAYER_BASELINE';
}

function buildBehavior(
  key: PresenceStyleVariantKey,
  input: PresenceStyleResolutionInput,
  styleProfile: ChatPresenceStyleProfile,
  readPolicy: ChatReadReceiptPolicy,
  vector: PresenceStyleSignalVector,
): PresenceStyleBehaviorFlags {
  const shouldLurk =
    key === 'NPC_LURK' ||
    key === 'HATER_STALK' ||
    key === 'DEAL_PREDATOR' ||
    isShadowChannel(input.channelId);

  const shouldEscalateToInstantStrike =
    key === 'HATER_STRIKE' &&
    Boolean(
      input.allowInstantStrike ||
        input.latency?.urgency === 'IMMEDIATE' ||
        input.urgency === 'IMMEDIATE',
    );

  const shouldReadBeforeReply =
    key === 'HELPER_OBSERVE' ||
    key === 'HATER_STALK' ||
    key === 'DEAL_PREDATOR' ||
    key === 'DEAL_SILENT';

  const shouldFakeTypingStart =
    shouldLurk &&
    (styleProfile.typingTheater === 'WEAPONIZED_DELAY' || styleProfile.typingTheater === 'HESITANT');

  const shouldFakeTypingStop =
    shouldLurk &&
    styleProfile.typingTheater === 'WEAPONIZED_DELAY' &&
    vector.silenceWeight01 >= 0.42;

  const shouldDelayReceipt =
    readPolicy.minDelayMs > 0 &&
    (styleProfile.readDelayPolicy !== 'INSTANT' || Boolean(input.shouldWeaponizeDelay));

  const shouldSuppressVisibleReceipt =
    input.shouldSuppressVisibleReceipt === true || !readPolicy.playerVisible;

  const shouldMirrorShadow =
    Boolean(input.shouldShadowPrime || input.latency?.shadowPrimed || isShadowChannel(input.channelId));

  const readDelay = String(styleProfile.readDelayPolicy);

  const shouldHoldUnreadPressure =
    readDelay === 'NEGOTIATION_PRESSURE' ||
    readDelay === 'HATER_STARE' ||
    (readPolicy.allowReadReceipts &&
      (readDelay === 'NEGOTIATION_PRESSURE' ||
        readDelay === 'HATER_STARE' ||
        readDelay === 'HELPER_SOFTEN'));

  return Object.freeze({
    shouldLurk,
    shouldReadBeforeReply,
    shouldFakeTypingStart,
    shouldFakeTypingStop,
    shouldDelayReceipt,
    shouldSuppressVisibleReceipt,
    shouldMirrorShadow,
    shouldHoldUnreadPressure,
    shouldEscalateToInstantStrike,
    shouldAppearAsAudience:
      key === 'NPC_AMBIENT' ||
      (key === 'LIVEOPS_PULSE' && channelFamily(input.channelId) === 'PUBLIC'),
  });
}

/* ============================================================================
 * MARK: Variant classification helpers
 * ============================================================================
 */

/**
 * Returns the class of the variant for analytics and routing.
 */
export function classifyPresenceVariant(key: PresenceStyleVariantKey): PresenceStyleVariantClass {
  switch (key) {
    case 'NPC_LURK':
    case 'HATER_STALK':
    case 'DEAL_PREDATOR':
      return 'LURKING';
    case 'HATER_STRIKE':
      return 'HOSTILE';
    case 'HELPER_OBSERVE':
    case 'HELPER_SURGE':
      return 'HELPER';
    case 'DEAL_SILENT':
    case 'PLAYER_NEGOTIATION':
      return 'NEGOTIATION';
    case 'NPC_AMBIENT':
    case 'NPC_DIRECT':
      return 'AMBIENT';
    case 'PLAYER_BASELINE':
      return 'PLAYER';
    case 'SYSTEM_BANNER':
      return 'SYSTEM';
    case 'LIVEOPS_PULSE':
    case 'SHADOW_VEIL':
    default:
      return 'SHADOW';
  }
}

/** Returns true if the variant is fundamentally a lurking/silent entry. */
export function isLurkingVariant(key: PresenceStyleVariantKey): boolean {
  return key === 'NPC_LURK' || key === 'HATER_STALK' || key === 'DEAL_PREDATOR';
}

/** Returns true if the variant operates on a shadow channel. */
export function isShadowVariant(key: PresenceStyleVariantKey): boolean {
  return key === 'SHADOW_VEIL';
}

/** Returns true if the variant represents a hostile NPC actor. */
export function isHostileVariant(key: PresenceStyleVariantKey): boolean {
  return key === 'HATER_STALK' || key === 'HATER_STRIKE' || key === 'DEAL_PREDATOR';
}

/** Returns true if the variant is a helper-class actor. */
export function isHelperVariant(key: PresenceStyleVariantKey): boolean {
  return key === 'HELPER_OBSERVE' || key === 'HELPER_SURGE';
}

/** Returns true if the variant is in a deal-room / negotiation family. */
export function isNegotiationVariant(key: PresenceStyleVariantKey): boolean {
  return key === 'DEAL_SILENT' || key === 'DEAL_PREDATOR' || key === 'PLAYER_NEGOTIATION';
}

/** Returns true if the variant is capable of instant strike delivery. */
export function isInstantStrikeCapableVariant(key: PresenceStyleVariantKey): boolean {
  return key === 'HATER_STRIKE' || key === 'HELPER_SURGE' || key === 'LIVEOPS_PULSE';
}

/** Returns true if the variant produces visible read receipts for the player. */
export function isPlayerVisibleReceiptVariant(key: PresenceStyleVariantKey): boolean {
  return key === 'HELPER_SURGE' || key === 'HELPER_OBSERVE' || key === 'NPC_AMBIENT';
}

/* ============================================================================
 * MARK: Diagnostics and analytics builders
 * ============================================================================
 */

function buildPresenceDiagnostics(
  input: PresenceStyleResolutionInput,
  result: PresenceStyleResolution,
): PresenceStyleDiagnostics {
  return Object.freeze({
    actorId: result.actorId,
    actorKind: result.actorKind,
    channelId: result.channelId,
    channelFamily: result.channelFamily,
    resolvedVariant: result.variantKey,
    variantClass: classifyPresenceVariant(result.variantKey),
    confidence01: result.confidence01,
    signalVector: result.signalVector,
    behaviorFlags: result.behavior,
    instantStrikeEligible: result.behavior.shouldEscalateToInstantStrike || Boolean(input.allowInstantStrike),
    shadowMirrorEligible: result.behavior.shouldMirrorShadow,
    lurking: result.behavior.shouldLurk,
    weaponizedDelay: result.styleProfile.typingTheater === 'WEAPONIZED_DELAY',
    styleId: result.styleProfile.styleId as string,
    typingTheater: result.styleProfile.typingTheater,
    readDelayPolicy: result.styleProfile.readDelayPolicy,
    playerVisibleReceipt: result.readPolicy.playerVisible,
    reasons: result.reasons,
    tags: result.tags,
    derivedAt: result.derivedAt,
  });
}

function computePresenceDiff(
  before: PresenceStyleResolution,
  after: PresenceStyleResolution,
): PresenceStyleDiff {
  const behaviorChanges: string[] = [];

  const flagKeys: (keyof PresenceStyleBehaviorFlags)[] = [
    'shouldLurk', 'shouldReadBeforeReply', 'shouldFakeTypingStart', 'shouldFakeTypingStop',
    'shouldDelayReceipt', 'shouldSuppressVisibleReceipt', 'shouldMirrorShadow',
    'shouldHoldUnreadPressure', 'shouldEscalateToInstantStrike', 'shouldAppearAsAudience',
  ];

  for (const flag of flagKeys) {
    if (before.behavior[flag] !== after.behavior[flag]) {
      behaviorChanges.push(`${flag}:${String(before.behavior[flag])}→${String(after.behavior[flag])}`);
    }
  }

  const signalKeys: (keyof PresenceStyleSignalVector)[] = [
    'pressure01', 'audienceHeat01', 'negotiationPressure01', 'helperNeed01',
    'obsession01', 'embarrassment01', 'urgency01', 'silenceWeight01', 'callbackOpportunity01',
    'relationshipIntensity01', 'respect01', 'fear01', 'contempt01',
  ];

  const signalDeltas: Partial<Record<keyof PresenceStyleSignalVector, number>> = {};
  for (const key of signalKeys) {
    const delta = after.signalVector[key] - before.signalVector[key];
    if (Math.abs(delta) > 0.001) {
      signalDeltas[key] = Number(delta.toFixed(4));
    }
  }

  return Object.freeze({
    beforeVariant: before.variantKey,
    afterVariant: after.variantKey,
    variantChanged: before.variantKey !== after.variantKey,
    channelFamilyChanged: before.channelFamily !== after.channelFamily,
    confidenceDelta: Number((after.confidence01 - before.confidence01).toFixed(4)),
    behaviorChanges: Object.freeze(behaviorChanges),
    signalDeltas: Object.freeze(signalDeltas),
    lurkingChanged: before.behavior.shouldLurk !== after.behavior.shouldLurk,
    shadowChanged: before.behavior.shouldMirrorShadow !== after.behavior.shouldMirrorShadow,
    instantStrikeChanged: before.behavior.shouldEscalateToInstantStrike !== after.behavior.shouldEscalateToInstantStrike,
    readPolicyChanged:
      before.readPolicy.policyId !== after.readPolicy.policyId ||
      before.readPolicy.visibilityMode !== after.readPolicy.visibilityMode,
    derivedAt: nowMs(),
  });
}

function buildPresenceStatsSummary(
  results: readonly PresenceStyleResolution[],
): PresenceStyleStatsSummary {
  if (!results.length) {
    return Object.freeze({
      totalResolutions: 0,
      variantCounts: Object.freeze({}),
      averageConfidence01: 0,
      minConfidence01: 0,
      maxConfidence01: 0,
      lurkingCount: 0,
      shadowCount: 0,
      instantStrikeCount: 0,
      helperSurgeCount: 0,
      haterStrikeCount: 0,
      negotiationCount: 0,
      pressureDistribution: Object.freeze({ low: 0, mid: 0, high: 0 }),
    });
  }

  const variantCounts: Partial<Record<PresenceStyleVariantKey, number>> = {};
  let confidenceSum = 0;
  let minConfidence = 1;
  let maxConfidence = 0;
  let lurkingCount = 0;
  let shadowCount = 0;
  let instantStrikeCount = 0;
  let helperSurgeCount = 0;
  let haterStrikeCount = 0;
  let negotiationCount = 0;
  let pressureLow = 0;
  let pressureMid = 0;
  let pressureHigh = 0;

  for (const result of results) {
    variantCounts[result.variantKey] = (variantCounts[result.variantKey] ?? 0) + 1;
    confidenceSum += result.confidence01;
    if (result.confidence01 < minConfidence) minConfidence = result.confidence01;
    if (result.confidence01 > maxConfidence) maxConfidence = result.confidence01;
    if (result.behavior.shouldLurk) lurkingCount += 1;
    if (result.behavior.shouldMirrorShadow) shadowCount += 1;
    if (result.behavior.shouldEscalateToInstantStrike) instantStrikeCount += 1;
    if (result.variantKey === 'HELPER_SURGE') helperSurgeCount += 1;
    if (result.variantKey === 'HATER_STRIKE') haterStrikeCount += 1;
    if (isNegotiationVariant(result.variantKey)) negotiationCount += 1;
    const p = result.signalVector.pressure01;
    if (p < 0.33) pressureLow += 1;
    else if (p < 0.66) pressureMid += 1;
    else pressureHigh += 1;
  }

  return Object.freeze({
    totalResolutions: results.length,
    variantCounts: Object.freeze(variantCounts),
    averageConfidence01: Number((confidenceSum / results.length).toFixed(4)),
    minConfidence01: minConfidence,
    maxConfidence01: maxConfidence,
    lurkingCount,
    shadowCount,
    instantStrikeCount,
    helperSurgeCount,
    haterStrikeCount,
    negotiationCount,
    pressureDistribution: Object.freeze({ low: pressureLow, mid: pressureMid, high: pressureHigh }),
  });
}

function buildAuditReport(
  entries: readonly {
    readonly input: PresenceStyleResolutionInput;
    readonly result: PresenceStyleResolution;
    readonly durationSinceLastMs?: number;
  }[],
): PresenceStyleAuditReport {
  const variantDist: Partial<Record<PresenceStyleVariantKey, number>> = {};
  const channelDist: Partial<Record<PresenceStyleChannelFamily, number>> = {};
  const actorKindDist: Partial<Record<string, number>> = {};
  let confidenceSum = 0;
  let lurkingCount = 0;
  let shadowCount = 0;
  let instantStrikeCount = 0;
  let helperSurgeCount = 0;

  const auditEntries: PresenceStyleAuditEntry[] = [];

  for (const entry of entries) {
    const { result, input, durationSinceLastMs = 0 } = entry;
    variantDist[result.variantKey] = (variantDist[result.variantKey] ?? 0) + 1;
    channelDist[result.channelFamily] = (channelDist[result.channelFamily] ?? 0) + 1;
    actorKindDist[result.actorKind] = (actorKindDist[result.actorKind] ?? 0) + 1;
    confidenceSum += result.confidence01;
    if (result.behavior.shouldLurk) lurkingCount += 1;
    if (result.behavior.shouldMirrorShadow) shadowCount += 1;
    if (result.behavior.shouldEscalateToInstantStrike) instantStrikeCount += 1;
    if (result.variantKey === 'HELPER_SURGE') helperSurgeCount += 1;

    auditEntries.push(Object.freeze({
      actorId: result.actorId,
      actorKind: result.actorKind,
      channelId: input.channelId,
      resolvedVariant: result.variantKey,
      confidence01: result.confidence01,
      durationSinceLastMs,
      topReasons: result.reasons.slice(0, 4),
      derivedAt: result.derivedAt,
    }));
  }

  const count = entries.length || 1;
  const topVariantEntry = Object.entries(variantDist).sort(([, a], [, b]) => (b ?? 0) - (a ?? 0))[0];
  const topChannelEntry = Object.entries(channelDist).sort(([, a], [, b]) => (b ?? 0) - (a ?? 0))[0];

  const diagnosticFlags: string[] = [];
  if (lurkingCount / count > 0.5) diagnosticFlags.push('majority-lurking');
  if (shadowCount / count > 0.3) diagnosticFlags.push('heavy-shadow-traffic');
  if (helperSurgeCount / count > 0.4) diagnosticFlags.push('high-helper-surge-rate');
  if (instantStrikeCount / count > 0.3) diagnosticFlags.push('high-instant-strike-rate');

  return Object.freeze({
    generatedAt: nowMs(),
    entryCount: entries.length,
    variantDistribution: Object.freeze(variantDist),
    channelDistribution: Object.freeze(channelDist),
    actorKindDistribution: Object.freeze(actorKindDist),
    averageConfidence01: Number((confidenceSum / count).toFixed(4)),
    lurkingRate01: Number((lurkingCount / count).toFixed(4)),
    shadowRate01: Number((shadowCount / count).toFixed(4)),
    instantStrikeRate01: Number((instantStrikeCount / count).toFixed(4)),
    helperSurgeRate01: Number((helperSurgeCount / count).toFixed(4)),
    entries: Object.freeze(auditEntries),
    topVariant: (topVariantEntry?.[0] ?? null) as PresenceStyleVariantKey | null,
    dominantChannelFamily: (topChannelEntry?.[0] ?? null) as PresenceStyleChannelFamily | null,
    diagnosticFlags: Object.freeze(diagnosticFlags),
  });
}

/* ============================================================================
 * MARK: Public resolver
 * ============================================================================
 */

export class PresenceStyleResolver {
  private readonly config: PresenceStyleResolverConfig;

  public constructor(config: Partial<PresenceStyleResolverConfig> = {}) {
    this.config = Object.freeze({
      ...DEFAULT_CONFIG,
      ...config,
    });
  }

  public resolve(input: PresenceStyleResolutionInput): PresenceStyleResolution {
    const derivedAt = nowMs(input.now);
    const vector = buildSignalVector(input);
    const variantKey = chooseVariant(input, vector, this.config);
    const styleProfile = buildVariantStyle(variantKey, input, vector);
    const readPolicy = buildVariantReadPolicy(variantKey, input, styleProfile, vector);
    const behavior = buildBehavior(variantKey, input, styleProfile, readPolicy, vector);
    const reasons = buildReasons(variantKey, input, vector);
    const tags = buildTags(variantKey, input, styleProfile);
    const confidence01 = buildConfidence(variantKey, vector, input);

    return Object.freeze({
      actorId: input.actorId,
      actorKind: input.actorKind,
      roomId: input.roomId,
      channelId: input.channelId,
      variantKey,
      styleProfile,
      readPolicy,
      channelFamily: channelFamily(input.channelId),
      signalVector: vector,
      behavior,
      confidence01,
      reasons,
      tags,
      derivedAt,
    });
  }

  public resolveBatch(inputs: readonly PresenceStyleResolutionInput[]): PresenceStyleBatchResult {
    const generatedAt = nowMs();
    const results = inputs.map((input) => this.resolve(input));
    const stats = buildPresenceStatsSummary(results);

    return Object.freeze({
      generatedAt,
      totalCount: results.length,
      results: Object.freeze(results),
      stats,
    });
  }

  public resolveForRoom(roomInput: PresenceStyleRoomInput): PresenceStyleRoomResult {
    const generatedAt = nowMs(roomInput.now);
    const family = channelFamily(roomInput.channelId);

    const resolutions = roomInput.actors.map((actor) =>
      this.resolve({
        actorId: actor.actorId,
        actorKind: actor.actorKind,
        roomId: roomInput.roomId,
        channelId: roomInput.channelId,
        now: generatedAt,
        intent: actor.intent,
        pressure01: actor.pressure01,
        helperNeed01: actor.helperNeed01,
        negotiationPressure01: actor.negotiationPressure01,
        audienceHeat01: roomInput.audienceHeat01,
        relationshipObsession01: actor.relationshipObsession01,
        relationshipIntensity01: actor.relationshipIntensity01,
        embarrassment01: actor.embarrassment01,
        worldEventActive: roomInput.worldEventActive,
        urgency: actor.urgency,
        allowInstantStrike: actor.allowInstantStrike,
        shouldShadowPrime: actor.shouldShadowPrime,
        silenceDecision: roomInput.silenceDecision,
        metadata: actor.metadata,
      }),
    );

    const primaryActor = resolutions.reduce<PresenceStyleResolution | null>(
      (best, current) => (!best || current.confidence01 > best.confidence01 ? current : best),
      null,
    );

    const dominantVariant = primaryActor?.variantKey ?? null;
    const hasActiveHater = resolutions.some((resolution) => isHostileVariant(resolution.variantKey));
    const hasHelperSurge = resolutions.some((resolution) => resolution.variantKey === 'HELPER_SURGE');
    const hasNegotiationPressure = resolutions.some((resolution) => isNegotiationVariant(resolution.variantKey));
    const hasShadowPresence = resolutions.some((resolution) => isShadowVariant(resolution.variantKey));

    return Object.freeze({
      roomId: roomInput.roomId,
      channelId: roomInput.channelId,
      family,
      generatedAt,
      resolutions: Object.freeze(resolutions),
      primaryActor,
      dominantVariant,
      hasActiveHater,
      hasHelperSurge,
      hasNegotiationPressure,
      hasShadowPresence,
    });
  }

  public resolveForNpcTurn(turnInput: PresenceStyleNpcTurnInput): PresenceStyleResolution {
    const turnFactor = turnInput.turnIndex / Math.max(1, turnInput.turnCount - 1);
    const escalatedPressure = clamp01((turnInput.pressure01 ?? 0) + turnFactor * 0.18);

    return this.resolve({
      actorId: turnInput.actorId,
      actorKind: turnInput.actorKind,
      roomId: turnInput.roomId,
      channelId: turnInput.channelId,
      now: turnInput.now,
      intent: turnInput.intent,
      seed: turnInput.seed,
      pressure01: escalatedPressure,
      helperNeed01: turnInput.helperNeed01,
      negotiationPressure01: turnInput.negotiationPressure01,
      embarrassment01: turnInput.embarrassment01,
      audienceHeat01: turnInput.audienceHeat01,
      allowInstantStrike:
        turnInput.allowInstantStrike ||
        (turnInput.turnIndex === turnInput.turnCount - 1 && escalatedPressure >= 0.72),
      silenceDecision: turnInput.silenceDecision,
      latency: turnInput.latency,
    });
  }

  public previewVariants(
    input: Omit<PresenceStyleResolutionInput, 'actorId'> & { readonly actorId?: string },
  ): readonly PresenceStyleResolution[] {
    const actorId = input.actorId ?? 'preview-actor';
    const candidates: PresenceStyleVariantKey[] = [
      'PLAYER_BASELINE',
      'PLAYER_NEGOTIATION',
      'NPC_AMBIENT',
      'NPC_DIRECT',
      'NPC_LURK',
      'HATER_STALK',
      'HATER_STRIKE',
      'HELPER_OBSERVE',
      'HELPER_SURGE',
      'DEAL_SILENT',
      'DEAL_PREDATOR',
      'SYSTEM_BANNER',
      'LIVEOPS_PULSE',
      'SHADOW_VEIL',
    ];

    return Object.freeze(
      candidates.map((candidate) => {
        const withActor: PresenceStyleResolutionInput = {
          ...input,
          actorId,
          channelId: input.channelId,
          actorKind: input.actorKind,
          roomId: input.roomId,
        };
        const vector = buildSignalVector(withActor);
        const styleProfile = buildVariantStyle(candidate, withActor, vector);
        const readPolicy = buildVariantReadPolicy(candidate, withActor, styleProfile, vector);
        return Object.freeze({
          actorId,
          actorKind: withActor.actorKind,
          roomId: withActor.roomId,
          channelId: withActor.channelId,
          variantKey: candidate,
          styleProfile,
          readPolicy,
          channelFamily: channelFamily(withActor.channelId),
          signalVector: vector,
          behavior: buildBehavior(candidate, withActor, styleProfile, readPolicy, vector),
          confidence01: buildConfidence(candidate, vector, withActor),
          reasons: buildReasons(candidate, withActor, vector),
          tags: buildTags(candidate, withActor, styleProfile),
          derivedAt: nowMs(withActor.now),
        });
      }),
    );
  }

  public explain(input: PresenceStyleResolutionInput): readonly string[] {
    const resolved = this.resolve(input);
    return Object.freeze([
      `variant=${resolved.variantKey}`,
      `styleKind=${resolved.styleProfile.styleKind}`,
      `typingTheater=${resolved.styleProfile.typingTheater}`,
      `readDelayPolicy=${resolved.styleProfile.readDelayPolicy}`,
      `playerVisibleReceipt=${resolved.readPolicy.playerVisible}`,
      `lurk=${resolved.behavior.shouldLurk}`,
      `fakeStart=${resolved.behavior.shouldFakeTypingStart}`,
      `fakeStop=${resolved.behavior.shouldFakeTypingStop}`,
      `shadowMirror=${resolved.behavior.shouldMirrorShadow}`,
      `instantStrike=${resolved.behavior.shouldEscalateToInstantStrike}`,
      ...resolved.reasons,
    ]);
  }

  public resolvePresenceVisibilityClass(
    input: PresenceStyleResolutionInput,
  ): ChatPresenceVisibilityClass {
    return this.resolve(input).styleProfile.presenceVisibilityClass;
  }

  public resolveTypingTheater(
    input: PresenceStyleResolutionInput,
  ): ChatTypingTheaterKind {
    return this.resolve(input).styleProfile.typingTheater;
  }

  public resolveReadDelayPolicy(
    input: PresenceStyleResolutionInput,
  ): ChatReadDelayPolicyKind {
    return this.resolve(input).styleProfile.readDelayPolicy;
  }

  public getDiagnostics(input: PresenceStyleResolutionInput): PresenceStyleDiagnostics {
    const result = this.resolve(input);
    return buildPresenceDiagnostics(input, result);
  }

  public computeDiff(
    before: PresenceStyleResolution,
    after: PresenceStyleResolution,
  ): PresenceStyleDiff {
    return computePresenceDiff(before, after);
  }

  public getStatsSummary(results: readonly PresenceStyleResolution[]): PresenceStyleStatsSummary {
    return buildPresenceStatsSummary(results);
  }

  public buildAuditReport(
    entries: readonly {
      readonly input: PresenceStyleResolutionInput;
      readonly result: PresenceStyleResolution;
      readonly durationSinceLastMs?: number;
    }[],
  ): PresenceStyleAuditReport {
    return buildAuditReport(entries);
  }

  public canInstantStrike(input: PresenceStyleResolutionInput): boolean {
    if (input.allowInstantStrike) return true;
    if (input.latency?.urgency === 'IMMEDIATE') return true;
    const latencyMs = input.latency?.delayMs ?? input.latency?.typing.typingDurationMs ?? 0;
    if (latencyMs <= this.config.instantStrikeLatencyThresholdMs) return true;
    if (input.urgency === 'IMMEDIATE' || input.urgency === 'CRITICAL') return true;
    return false;
  }

  public isLurkingVariant(key: PresenceStyleVariantKey): boolean {
    return isLurkingVariant(key);
  }

  public isShadowVariant(key: PresenceStyleVariantKey): boolean {
    return isShadowVariant(key);
  }

  public isHostileVariant(key: PresenceStyleVariantKey): boolean {
    return isHostileVariant(key);
  }

  public isHelperVariant(key: PresenceStyleVariantKey): boolean {
    return isHelperVariant(key);
  }

  public isNegotiationVariant(key: PresenceStyleVariantKey): boolean {
    return isNegotiationVariant(key);
  }

  public toJSON(): PresenceStyleSerializedState {
    return Object.freeze({
      version: this.config.version,
      config: this.config,
      serializedAt: nowMs(),
    });
  }

  public clone(overrides: Partial<PresenceStyleResolverConfig> = {}): PresenceStyleResolver {
    return new PresenceStyleResolver({ ...this.config, ...overrides });
  }

  public buildPresenceMetadata(
    input: PresenceStyleResolutionInput,
  ): Readonly<Record<string, JsonValue>> {
    const resolved = this.resolve(input);
    const visibleChannel = isShadowChannel(input.channelId)
      ? normalizeVisibleChannel('GLOBAL')
      : normalizeVisibleChannel(input.channelId);
    const shadowChannel = isShadowChannel(input.channelId)
      ? normalizeShadowChannel(input.channelId)
      : normalizeShadowChannel('NPC_SHADOW');

    return Object.freeze({
      authority: asAuthority(input.authority),
      actorId: resolved.actorId,
      actorKind: resolved.actorKind,
      roomId: resolved.roomId,
      channelId: resolved.channelId,
      visibleChannel,
      shadowChannel,
      variantKey: resolved.variantKey,
      styleId: resolved.styleProfile.styleId as string,
      styleKind: resolved.styleProfile.styleKind,
      typingTheater: resolved.styleProfile.typingTheater,
      readDelayPolicy: resolved.styleProfile.readDelayPolicy,
      behavior: Object.freeze({
        shouldLurk: resolved.behavior.shouldLurk,
        shouldReadBeforeReply: resolved.behavior.shouldReadBeforeReply,
        shouldFakeTypingStart: resolved.behavior.shouldFakeTypingStart,
        shouldFakeTypingStop: resolved.behavior.shouldFakeTypingStop,
        shouldDelayReceipt: resolved.behavior.shouldDelayReceipt,
        shouldSuppressVisibleReceipt: resolved.behavior.shouldSuppressVisibleReceipt,
        shouldMirrorShadow: resolved.behavior.shouldMirrorShadow,
        shouldHoldUnreadPressure: resolved.behavior.shouldHoldUnreadPressure,
        shouldEscalateToInstantStrike: resolved.behavior.shouldEscalateToInstantStrike,
        shouldAppearAsAudience: resolved.behavior.shouldAppearAsAudience,
      }),
      confidence01: resolved.confidence01,
      signals: Object.freeze({
        pressure01: resolved.signalVector.pressure01,
        audienceHeat01: resolved.signalVector.audienceHeat01,
        negotiationPressure01: resolved.signalVector.negotiationPressure01,
        helperNeed01: resolved.signalVector.helperNeed01,
        relationshipIntensity01: resolved.signalVector.relationshipIntensity01,
        obsession01: resolved.signalVector.obsession01,
        respect01: resolved.signalVector.respect01,
        fear01: resolved.signalVector.fear01,
        contempt01: resolved.signalVector.contempt01,
        embarrassment01: resolved.signalVector.embarrassment01,
        urgency01: resolved.signalVector.urgency01,
        silenceWeight01: resolved.signalVector.silenceWeight01,
        callbackOpportunity01: resolved.signalVector.callbackOpportunity01,
      }),
      reasons: resolved.reasons,
      tags: resolved.tags,
      derivedAt: resolved.derivedAt,
    });
  }
}

/* ============================================================================
 * MARK: Profile factory functions
 * ============================================================================
 */

export function createPresenceStyleResolver(
  config: Partial<PresenceStyleResolverConfig> = {},
): PresenceStyleResolver {
  return new PresenceStyleResolver(config);
}

export function createPresenceStyleResolverFromProfile(
  profile: PresenceStyleResolverProfile,
  overrides: Partial<PresenceStyleResolverConfig> = {},
): PresenceStyleResolver {
  const profileConfig = PRESENCE_STYLE_RESOLVER_PROFILE_OPTIONS[profile].config;
  return new PresenceStyleResolver({ ...profileConfig, ...overrides });
}

export function createBalancedPresenceStyleResolver(): PresenceStyleResolver {
  return createPresenceStyleResolverFromProfile('BALANCED');
}

export function createHaterHeavyPresenceStyleResolver(): PresenceStyleResolver {
  return createPresenceStyleResolverFromProfile('HATER_HEAVY');
}

export function createHelperPriorityPresenceStyleResolver(): PresenceStyleResolver {
  return createPresenceStyleResolverFromProfile('HELPER_PRIORITY');
}

export function createNegotiationFocusPresenceStyleResolver(): PresenceStyleResolver {
  return createPresenceStyleResolverFromProfile('NEGOTIATION_FOCUS');
}

export function createLiveopsResponsivePresenceStyleResolver(): PresenceStyleResolver {
  return createPresenceStyleResolverFromProfile('LIVEOPS_RESPONSIVE');
}

export function createShadowHeavyPresenceStyleResolver(): PresenceStyleResolver {
  return createPresenceStyleResolverFromProfile('SHADOW_HEAVY');
}

/** Standalone variant classification helper — does not require a resolver instance. */
export function resolvePresenceVariantClass(
  actorKind: ChatActorKind,
  channelId: ChatChannelId,
  signals: Partial<PresenceStyleSignalVector>,
): PresenceStyleVariantClass {
  const resolver = new PresenceStyleResolver();
  const result = resolver.resolve({
    actorId: 'classification-probe',
    actorKind,
    roomId: 'classification-probe-room',
    channelId,
    pressure01: signals.pressure01,
    audienceHeat01: signals.audienceHeat01,
    negotiationPressure01: signals.negotiationPressure01,
    helperNeed01: signals.helperNeed01,
    relationshipObsession01: signals.obsession01,
    embarrassment01: signals.embarrassment01,
    callbackOpportunity01: signals.callbackOpportunity01,
  });
  return classifyPresenceVariant(result.variantKey);
}

/** Returns true if the given signal vector is likely to trigger a lurking variant. */
export function signalVectorFavorsLurk(
  vector: PresenceStyleSignalVector,
  config: Partial<PresenceStyleResolverConfig> = {},
): boolean {
  const threshold = config.silenceLurkThreshold01 ?? DEFAULT_CONFIG.silenceLurkThreshold01;
  return (
    vector.silenceWeight01 >= threshold ||
    vector.obsession01 >= 0.6 ||
    vector.negotiationPressure01 >= 0.55
  );
}

/** Deterministically selects a presence seed from actorId + roomId + now bucket. */
export function derivePresenceSeed(actorId: string, roomId: string, now: number): string {
  const bucket = Math.floor(now / 30_000);
  return `${actorId}::${roomId}::${bucket}`;
}

/* ============================================================================
 * MARK: Module export
 * ============================================================================
 */

export const ChatPresenceStyleResolverModule = Object.freeze({
  // Class
  PresenceStyleResolver,

  // Factories
  createPresenceStyleResolver,
  createPresenceStyleResolverFromProfile,
  createBalancedPresenceStyleResolver,
  createHaterHeavyPresenceStyleResolver,
  createHelperPriorityPresenceStyleResolver,
  createNegotiationFocusPresenceStyleResolver,
  createLiveopsResponsivePresenceStyleResolver,
  createShadowHeavyPresenceStyleResolver,

  // Profile constants
  PRESENCE_STYLE_RESOLVER_PROFILE_OPTIONS,

  // Standalone helpers
  classifyPresenceVariant,
  isLurkingVariant,
  isShadowVariant,
  isHostileVariant,
  isHelperVariant,
  isNegotiationVariant,
  isInstantStrikeCapableVariant,
  isPlayerVisibleReceiptVariant,
  resolvePresenceVariantClass,
  signalVectorFavorsLurk,
  derivePresenceSeed,
} as const);
