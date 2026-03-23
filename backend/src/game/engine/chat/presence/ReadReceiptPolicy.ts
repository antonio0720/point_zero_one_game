/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT READ RECEIPT POLICY
 * FILE: backend/src/game/engine/chat/presence/ReadReceiptPolicy.ts
 * VERSION: 2026.03.23-read-receipt.v2
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Authoritative backend law for read-delay pressure, visible vs hidden read
 * receipts, unread-pressure staging, read-head materialization, stare window
 * orchestration, negotiation read sequencing, and batch pressure aggregation.
 *
 * This file is intentionally separate from transport and intentionally separate
 * from the shared contract lane. Shared contracts define what a read receipt is.
 * This file decides when it should exist, whether the player can see it, how
 * long the delay should be, whether leaving a message unread is the stronger
 * gameplay move, and how stare windows should be orchestrated.
 *
 * Design laws
 * -----------
 * 1. Deal-room silence is a mechanic, not a missing feature.
 * 2. Haters may weaponize read-delay and stare windows.
 * 3. Helpers may read, wait, and enter gently rather than instantly.
 * 4. Shadow channels must never leak visible read state.
 * 5. Read policy must stay deterministic enough for replay / proof and varied
 *    enough that timing does not feel robotic.
 * 6. Negotiation read sequences are staged, not monolithic.
 * 7. Unread pressure is an aggregate across channels, not per-message.
 * 8. Stare windows are authored gameplay beats, not UI artifacts.
 * ============================================================================
 */

import type {
  ChatChannelId,
  JsonValue,
  Score01,
  UnixMs,
} from '../types';

import type { ChatActorKind, ChatMessageId } from '../../../../../../shared/contracts/chat/ChatChannels';
import type { ChatAuthority } from '../../../../../../shared/contracts/chat/ChatEvents';

import {
  DEFAULT_NEGOTIATION_READ_POLICY,
  DEFAULT_PUBLIC_READ_POLICY,
  DEFAULT_SHADOW_READ_POLICY,
  type ChatReadPolicyId,
  type ChatReadReceiptPolicy,
} from '../../../../../../shared/contracts/chat/ChatPresence';

import {
  type ChatReadDelayPlan,
  type ChatReadDelayReason,
  type ChatReadHeadId,
  type ChatReadHeadSnapshot,
  type ChatReadPolicyMode,
  type ChatReadReceiptDecision,
  type ChatReadReceiptId,
  type ChatReadReceiptRecord,
  type ChatTypingPolicyId,
} from '../../../../../../shared/contracts/chat/ChatTyping';

import type {
  PresenceStyleResolution,
  PresenceStyleVariantKey,
} from './PresenceStyleResolver';

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

function asAuthority(value?: ChatAuthority | null): ChatAuthority {
  return (value ?? ('BACKEND' as ChatAuthority));
}

function channelFamily(channelId: ChatChannelId): 'PUBLIC' | 'NEGOTIATION' | 'SHADOW' | 'LOBBY' {
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

function receiptReason(
  variantKey: PresenceStyleVariantKey,
  channelId: ChatChannelId,
  stylePolicy: ChatReadReceiptPolicy,
  forceDelay?: boolean,
): ChatReadDelayReason {
  if (channelFamily(channelId) === 'NEGOTIATION') return 'NEGOTIATION_PRESSURE';
  if (stylePolicy.visibilityMode === 'OFF') return 'PRIVACY_REDACTION';
  if (variantKey === 'HATER_STALK' || variantKey === 'HATER_STRIKE') return 'HATER_BAIT';
  if (variantKey === 'HELPER_OBSERVE' || variantKey === 'HELPER_SURGE') return 'HELPER_OBSERVATION';
  if (variantKey === 'LIVEOPS_PULSE') return 'LIVEOPS_DRAMA';
  if (forceDelay) return 'PRESENCE_THEATER';
  return 'NPC_LATENCY';
}

/* ============================================================================
 * MARK: Profile system
 * ============================================================================
 */

/**
 * Named configuration profiles for the ReadReceiptPolicy.
 * Each profile tunes the thresholds and windows in ReadReceiptPolicyConfig
 * to produce a different emotional posture for the system.
 */
export type ReadReceiptPolicyProfile =
  | 'BALANCED'
  | 'NEGOTIATION_HEAVY'
  | 'HATER_WEAPONIZED'
  | 'HELPER_VISIBLE'
  | 'SHADOW_SILENT'
  | 'BATCHED_PRESSURE';

/* ============================================================================
 * MARK: Public contracts
 * ============================================================================
 */

export interface ReadReceiptPolicyConfig {
  readonly version: string;
  readonly minBatchDelayMs: number;
  readonly maxBatchDelayMs: number;
  readonly unreadHoldNegotiationThreshold01: number;
  readonly unreadHoldHaterThreshold01: number;
  readonly helperVisibleThreshold01: number;
  readonly publicReceiptSuppressionThreshold01: number;
  readonly forceImmediateThreshold01: number;
  readonly backlogBatchThreshold: number;
  readonly stareWindowMinMs: number;
  readonly stareWindowMaxMs: number;
  readonly stareWindowHaterMultiplier: number;
  readonly stareWindowNegotiationMultiplier: number;
  readonly negotiationSequenceStageCount: number;
  readonly negotiationSequenceStageDelayMs: number;
  readonly negotiationDecayRatePerStage: number;
  readonly unreadPressureCapacity: number;
  readonly unreadPressureDecayPerMs: number;
  readonly batchWindowMs: number;
  readonly batchWindowMaxCount: number;
}

const DEFAULT_CONFIG: ReadReceiptPolicyConfig = Object.freeze({
  version: '2026.03.23',
  minBatchDelayMs: 1400,
  maxBatchDelayMs: 6200,
  unreadHoldNegotiationThreshold01: 0.62,
  unreadHoldHaterThreshold01: 0.56,
  helperVisibleThreshold01: 0.28,
  publicReceiptSuppressionThreshold01: 0.74,
  forceImmediateThreshold01: 0.88,
  backlogBatchThreshold: 6,
  stareWindowMinMs: 1800,
  stareWindowMaxMs: 7200,
  stareWindowHaterMultiplier: 1.6,
  stareWindowNegotiationMultiplier: 1.4,
  negotiationSequenceStageCount: 3,
  negotiationSequenceStageDelayMs: 2400,
  negotiationDecayRatePerStage: 0.18,
  unreadPressureCapacity: 12,
  unreadPressureDecayPerMs: 0.00004,
  batchWindowMs: 3600,
  batchWindowMaxCount: 8,
});

/**
 * Tuned profile configurations.
 */
export const READ_RECEIPT_POLICY_PROFILE_OPTIONS: Readonly<
  Record<ReadReceiptPolicyProfile, Partial<ReadReceiptPolicyConfig>>
> = Object.freeze({
  BALANCED: {},

  NEGOTIATION_HEAVY: Object.freeze({
    unreadHoldNegotiationThreshold01: 0.44,
    unreadHoldHaterThreshold01: 0.62,
    minBatchDelayMs: 2200,
    maxBatchDelayMs: 8400,
    backlogBatchThreshold: 4,
    stareWindowNegotiationMultiplier: 2.1,
    negotiationSequenceStageCount: 4,
    negotiationSequenceStageDelayMs: 3200,
  }),

  HATER_WEAPONIZED: Object.freeze({
    unreadHoldHaterThreshold01: 0.34,
    publicReceiptSuppressionThreshold01: 0.52,
    stareWindowHaterMultiplier: 2.4,
    minBatchDelayMs: 1800,
    maxBatchDelayMs: 7600,
    helperVisibleThreshold01: 0.38,
  }),

  HELPER_VISIBLE: Object.freeze({
    helperVisibleThreshold01: 0.12,
    forceImmediateThreshold01: 0.72,
    publicReceiptSuppressionThreshold01: 0.88,
    stareWindowHaterMultiplier: 0.8,
    minBatchDelayMs: 800,
    maxBatchDelayMs: 3200,
  }),

  SHADOW_SILENT: Object.freeze({
    unreadHoldNegotiationThreshold01: 0.0,
    unreadHoldHaterThreshold01: 0.0,
    helperVisibleThreshold01: 1.0,
    publicReceiptSuppressionThreshold01: 0.0,
    forceImmediateThreshold01: 1.0,
    backlogBatchThreshold: 0,
    stareWindowMinMs: 0,
    stareWindowMaxMs: 0,
  }),

  BATCHED_PRESSURE: Object.freeze({
    backlogBatchThreshold: 2,
    minBatchDelayMs: 2400,
    maxBatchDelayMs: 9800,
    batchWindowMs: 5400,
    batchWindowMaxCount: 12,
    unreadHoldNegotiationThreshold01: 0.38,
    unreadHoldHaterThreshold01: 0.42,
  }),
});

/* ============================================================================
 * MARK: Extended interfaces
 * ============================================================================
 */

export interface ReadReceiptResolutionInput {
  readonly actorId: string;
  readonly actorKind: ChatActorKind;
  readonly roomId: string;
  readonly channelId: ChatChannelId;
  readonly messageId?: ChatMessageId | string | null;
  readonly authority?: ChatAuthority | null;
  readonly now?: UnixMs | number | null;
  readonly seed?: string | null;
  readonly unreadCount?: number | null;
  readonly lastReadMessageId?: ChatMessageId | string | null;
  readonly lastReadAt?: number | UnixMs | null;
  readonly visibleToPlayer?: boolean;
  readonly forceEmitReceipt?: boolean;
  readonly forceHidden?: boolean;
  readonly forceDelayed?: boolean;
  readonly presence: PresenceStyleResolution;
  readonly pressure01?: number | Score01 | null;
  readonly audienceHeat01?: number | Score01 | null;
  readonly negotiationPressure01?: number | Score01 | null;
  readonly helperNeed01?: number | Score01 | null;
  readonly embarrassment01?: number | Score01 | null;
  readonly relationshipObsession01?: number | Score01 | null;
  readonly callbackOpportunity01?: number | Score01 | null;
  readonly latencyDelayMs?: number | null;
  readonly metadata?: Readonly<Record<string, JsonValue>> | null;
}

export interface ReadReceiptResolution {
  readonly policy: ChatReadReceiptPolicy;
  readonly decision: ChatReadReceiptDecision;
  readonly plan?: ChatReadDelayPlan;
  readonly receipt?: ChatReadReceiptRecord;
  readonly readHead?: ChatReadHeadSnapshot;
  readonly shouldHoldUnreadPressure: boolean;
  readonly shouldEmitVisibleReceipt: boolean;
  readonly shouldAdvanceReadHead: boolean;
  readonly reasons: readonly string[];
  readonly derivedAt: number;
}

/**
 * Diagnostic breakdown of every factor that influenced a single resolution.
 */
export interface ReadReceiptDiagnostics {
  readonly input: ReadReceiptResolutionInput;
  readonly derivedPolicy: ChatReadReceiptPolicy;
  readonly derivedMode: ChatReadPolicyMode;
  readonly derivedDelayMs: number | undefined;
  readonly derivedVisibility: boolean;
  readonly channelFamily: 'PUBLIC' | 'NEGOTIATION' | 'SHADOW' | 'LOBBY';
  readonly signalVector: {
    readonly pressure01: number;
    readonly audienceHeat01: number;
    readonly negotiationPressure01: number;
    readonly helperNeed01: number;
    readonly embarrassment01: number;
    readonly obsession01: number;
    readonly callbackOpportunity01: number;
  };
  readonly thresholdEvaluations: {
    readonly forceImmediateTriggered: boolean;
    readonly unreadHoldNegotiationTriggered: boolean;
    readonly unreadHoldHaterTriggered: boolean;
    readonly helperObserveSuppressed: boolean;
    readonly publicReceiptSuppressed: boolean;
    readonly shadowFamilyLock: boolean;
    readonly forceHiddenOverride: boolean;
    readonly forceEmitOverride: boolean;
    readonly forceDelayedOverride: boolean;
  };
  readonly behaviorFlags: {
    readonly shouldHoldUnreadPressure: boolean;
    readonly shouldDelayReceipt: boolean;
    readonly shouldSuppressVisibleReceipt: boolean;
  };
  readonly configSnapshot: ReadReceiptPolicyConfig;
  readonly computedAt: number;
}

/**
 * A single audit entry capturing one resolution event.
 */
export interface ReadReceiptAuditEntry {
  readonly auditId: string;
  readonly actorId: string;
  readonly actorKind: ChatActorKind;
  readonly channelId: ChatChannelId;
  readonly variantKey: PresenceStyleVariantKey;
  readonly mode: ChatReadPolicyMode;
  readonly delayMs: number | undefined;
  readonly visibleToPlayer: boolean;
  readonly emittedReceipt: boolean;
  readonly heldUnreadPressure: boolean;
  readonly reasons: readonly string[];
  readonly capturedAt: number;
}

/**
 * Aggregate audit report across a series of resolutions.
 */
export interface ReadReceiptAuditReport {
  readonly reportId: string;
  readonly generatedAt: number;
  readonly entryCount: number;
  readonly entries: readonly ReadReceiptAuditEntry[];
  readonly totalDelayMs: number;
  readonly averageDelayMs: number;
  readonly hiddenCount: number;
  readonly immediateCount: number;
  readonly delayedCount: number;
  readonly batchedCount: number;
  readonly authorOnlyCount: number;
  readonly visibleReceiptCount: number;
  readonly suppressedReceiptCount: number;
  readonly heldPressureCount: number;
  readonly dominantMode: ChatReadPolicyMode;
  readonly dominantDelayReason: ChatReadDelayReason | undefined;
}

/**
 * Diff between two consecutive resolutions for the same actor/channel.
 */
export interface ReadReceiptDiff {
  readonly changedMode: boolean;
  readonly changedVisibility: boolean;
  readonly changedDelay: boolean;
  readonly changedPolicy: boolean;
  readonly previousMode: ChatReadPolicyMode;
  readonly nextMode: ChatReadPolicyMode;
  readonly previousDelayMs: number | undefined;
  readonly nextDelayMs: number | undefined;
  readonly previousVisible: boolean;
  readonly nextVisible: boolean;
  readonly movedToHidden: boolean;
  readonly movedToImmediate: boolean;
  readonly delayDeltaMs: number;
  readonly escalated: boolean;
  readonly deescalated: boolean;
}

/**
 * Aggregate stats across many resolutions.
 */
export interface ReadReceiptStatsSummary {
  readonly sampleCount: number;
  readonly emittedCount: number;
  readonly hiddenCount: number;
  readonly visibleCount: number;
  readonly suppressedCount: number;
  readonly delayedCount: number;
  readonly batchedCount: number;
  readonly immediateCount: number;
  readonly authorOnlyCount: number;
  readonly heldPressureCount: number;
  readonly totalDelayMs: number;
  readonly averageDelayMs: number;
  readonly maxDelayMs: number;
  readonly minDelayMs: number | undefined;
  readonly medianDelayMs: number | undefined;
  readonly modePressureIndex: number;
  readonly variantKeyFrequency: Readonly<Partial<Record<PresenceStyleVariantKey, number>>>;
  readonly channelFamilyFrequency: Readonly<Record<string, number>>;
}

/**
 * Result of a batch resolution across many inputs.
 */
export interface ReadReceiptBatchResult {
  readonly generatedAt: number;
  readonly inputs: readonly ReadReceiptResolutionInput[];
  readonly resolutions: readonly ReadReceiptResolution[];
  readonly totalEmitted: number;
  readonly totalHidden: number;
  readonly totalHeldPressure: number;
  readonly totalVisibleEmitted: number;
  readonly totalDelayMs: number;
  readonly audit: ReadReceiptAuditReport;
}

/**
 * A plan for a "stare window" — the NPC has read the message, is visibly
 * sitting on it (the read receipt is visible), but has not started typing.
 * This is a deliberate gameplay beat.
 */
export interface StareWindowPlan {
  readonly stareId: string;
  readonly actorId: string;
  readonly actorKind: ChatActorKind;
  readonly channelId: ChatChannelId;
  readonly messageId: string | undefined;
  readonly opensAt: number;
  readonly closesAt: number;
  readonly durationMs: number;
  readonly visibleToPlayer: boolean;
  readonly reason: 'HATER_PRESSURE' | 'NEGOTIATION_THEATER' | 'HELPER_PATIENCE' | 'AMBIENT_PROCESSING';
  readonly shouldEmitReadBeforeStare: boolean;
  readonly readEmitAt: number;
}

/**
 * A staged read sequence for a negotiation channel — the NPC reads the
 * message in distinct waves, each wave carrying more pressure.
 */
export interface NegotiationReadSequence {
  readonly sequenceId: string;
  readonly actorId: string;
  readonly channelId: ChatChannelId;
  readonly stageCount: number;
  readonly stages: readonly NegotiationReadStage[];
  readonly totalDurationMs: number;
  readonly finalPressure01: number;
  readonly shouldFinalizeWithSeen: boolean;
}

export interface NegotiationReadStage {
  readonly stageIndex: number;
  readonly offsetMs: number;
  readonly durationMs: number;
  readonly pressureAtStage01: number;
  readonly mode: ChatReadPolicyMode;
  readonly visibleAtThisStage: boolean;
  readonly reason: string;
}

/**
 * Aggregate of unread pressure across channels for an actor.
 */
export interface UnreadPressureAggregate {
  readonly actorId: string;
  readonly roomId: string;
  readonly channels: readonly UnreadPressureChannelEntry[];
  readonly totalUnreadCount: number;
  readonly totalPressureScore01: number;
  readonly dominantChannelId: ChatChannelId | undefined;
  readonly dominantPressure01: number;
  readonly computedAt: number;
  readonly shouldTriggerBatch: boolean;
  readonly batchWindowMs: number;
}

export interface UnreadPressureChannelEntry {
  readonly channelId: ChatChannelId;
  readonly unreadCount: number;
  readonly pressureScore01: number;
  readonly lastMessageAt: number | undefined;
  readonly decayedSince: number;
  readonly effectivePressure01: number;
}

/* ============================================================================
 * MARK: Policy law
 * ============================================================================
 */

function derivePolicy(
  input: ReadReceiptResolutionInput,
): ChatReadReceiptPolicy {
  const resolved = input.presence.readPolicy;

  if (input.forceHidden) {
    return Object.freeze({
      ...DEFAULT_SHADOW_READ_POLICY,
      policyId: `${resolved.policyId}-forced-hidden` as ChatReadPolicyId,
    });
  }

  if (channelFamily(input.channelId) === 'NEGOTIATION') {
    return Object.freeze({
      ...DEFAULT_NEGOTIATION_READ_POLICY,
      ...resolved,
      policyId: `${resolved.policyId}-negotiation` as ChatReadPolicyId,
      visibilityMode: resolved.visibilityMode === 'PUBLIC' ? 'SENDER_ONLY' : resolved.visibilityMode,
    });
  }

  if (channelFamily(input.channelId) === 'SHADOW') {
    return Object.freeze({
      ...DEFAULT_SHADOW_READ_POLICY,
      ...resolved,
      policyId: `${resolved.policyId}-shadow` as ChatReadPolicyId,
      visibilityMode: 'OFF',
      allowReadReceipts: false,
      allowSeenReceipts: false,
      playerVisible: false,
    });
  }

  return Object.freeze({
    ...DEFAULT_PUBLIC_READ_POLICY,
    ...resolved,
    policyId: `${resolved.policyId}-runtime` as ChatReadPolicyId,
  });
}

function deriveMode(
  input: ReadReceiptResolutionInput,
  policy: ChatReadReceiptPolicy,
  config: ReadReceiptPolicyConfig,
): ChatReadPolicyMode {
  if (input.forceHidden || policy.visibilityMode === 'OFF') return 'HIDDEN';
  if (!policy.allowReadReceipts) return 'HIDDEN';

  const family = channelFamily(input.channelId);
  const pressure01 = clamp01(input.pressure01);
  const negotiationPressure01 = clamp01(input.negotiationPressure01);
  const obsession01 = clamp01(input.relationshipObsession01);
  const helperNeed01 = clamp01(input.helperNeed01);
  const unreadCount = Math.max(0, Math.floor(input.unreadCount ?? 0));

  if (input.forceEmitReceipt) return 'IMMEDIATE';

  if (
    input.presence.variantKey === 'HELPER_SURGE' &&
    Math.max(helperNeed01, pressure01) >= config.forceImmediateThreshold01
  ) {
    return 'IMMEDIATE';
  }

  if (family === 'NEGOTIATION') {
    if (
      negotiationPressure01 >= config.unreadHoldNegotiationThreshold01 ||
      input.presence.behavior.shouldHoldUnreadPressure
    ) {
      return unreadCount >= config.backlogBatchThreshold ? 'BATCHED' : 'DELAYED';
    }
    return 'DELAYED';
  }

  if (
    (input.presence.variantKey === 'HATER_STALK' || input.presence.variantKey === 'HATER_STRIKE') &&
    Math.max(obsession01, clamp01(input.embarrassment01), pressure01) >= config.unreadHoldHaterThreshold01
  ) {
    return unreadCount >= config.backlogBatchThreshold ? 'BATCHED' : 'DELAYED';
  }

  if (
    input.presence.variantKey === 'HELPER_OBSERVE' &&
    helperNeed01 < config.helperVisibleThreshold01
  ) {
    return 'AUTHOR_ONLY';
  }

  if (input.forceDelayed || input.presence.behavior.shouldDelayReceipt) {
    return 'DELAYED';
  }

  return 'IMMEDIATE';
}

function deriveDelayMs(
  input: ReadReceiptResolutionInput,
  policy: ChatReadReceiptPolicy,
  mode: ChatReadPolicyMode,
  config: ReadReceiptPolicyConfig,
): number | undefined {
  if (mode === 'HIDDEN' || mode === 'IMMEDIATE' || !policy.allowReadReceipts) {
    return undefined;
  }

  const seed = [
    input.seed ?? 'read-delay',
    input.actorId,
    input.messageId ?? 'no-message',
    input.channelId,
    input.presence.variantKey,
    String(Math.floor(clamp01(input.negotiationPressure01) * 1000)),
    String(Math.floor(clamp01(input.pressure01) * 1000)),
  ].join('::');

  const pressure01 = clamp01(input.pressure01);
  const audienceHeat01 = clamp01(input.audienceHeat01);
  const negotiationPressure01 = clamp01(input.negotiationPressure01);
  const obsession01 = clamp01(input.relationshipObsession01);
  const helperNeed01 = clamp01(input.helperNeed01);
  const backlog = Math.max(0, Math.floor(input.unreadCount ?? 0));

  let min = policy.minDelayMs;
  let max = policy.maxDelayMs;

  if (mode === 'BATCHED') {
    min = Math.max(min, config.minBatchDelayMs);
    max = Math.max(max, config.maxBatchDelayMs);
  }

  switch (input.presence.variantKey) {
    case 'DEAL_PREDATOR':
      min += Math.round(negotiationPressure01 * 900 + backlog * 120);
      max += Math.round(negotiationPressure01 * 2200 + backlog * 260);
      break;
    case 'DEAL_SILENT':
      min += Math.round(negotiationPressure01 * 420);
      max += Math.round(negotiationPressure01 * 1100);
      break;
    case 'HATER_STALK':
      min += Math.round(obsession01 * 700 + audienceHeat01 * 380);
      max += Math.round(obsession01 * 1800 + audienceHeat01 * 900);
      break;
    case 'HATER_STRIKE':
      min += Math.round(Math.max(pressure01, clamp01(input.embarrassment01)) * 260);
      max += Math.round(Math.max(pressure01, clamp01(input.embarrassment01)) * 620);
      break;
    case 'HELPER_OBSERVE':
      min += Math.round((1 - helperNeed01) * 180);
      max += Math.round((1 - helperNeed01) * 420);
      break;
    case 'LIVEOPS_PULSE':
      min += 60;
      max += 200;
      break;
    default:
      min += Math.round(pressure01 * 180);
      max += Math.round(pressure01 * 420);
      break;
  }

  if (input.latencyDelayMs != null && Number.isFinite(input.latencyDelayMs)) {
    min += Math.round(Math.max(0, input.latencyDelayMs) * 0.12);
    max += Math.round(Math.max(0, input.latencyDelayMs) * 0.22);
  }

  min = clamp(min, 0, 30_000);
  max = clamp(Math.max(min, max), min, 60_000);
  return deterministicRange(min, max, seed);
}

function deriveVisibility(
  input: ReadReceiptResolutionInput,
  policy: ChatReadReceiptPolicy,
  mode: ChatReadPolicyMode,
  config: ReadReceiptPolicyConfig,
): boolean {
  if (mode === 'HIDDEN') return false;
  if (policy.visibilityMode === 'OFF') return false;
  if (input.forceHidden) return false;
  if (input.visibleToPlayer === false) return false;
  if (input.presence.behavior.shouldSuppressVisibleReceipt) return false;

  const pressure01 = clamp01(input.pressure01);
  const heat01 = clamp01(input.audienceHeat01);
  if (
    input.presence.variantKey === 'HATER_STALK' &&
    Math.max(pressure01, heat01) >= config.publicReceiptSuppressionThreshold01
  ) {
    return false;
  }

  return policy.playerVisible;
}

function buildDecision(
  input: ReadReceiptResolutionInput,
  policy: ChatReadReceiptPolicy,
  config: ReadReceiptPolicyConfig,
): ChatReadReceiptDecision {
  const mode = deriveMode(input, policy, config);
  const delayMs = deriveDelayMs(input, policy, mode, config);
  const visibleToPlayer = deriveVisibility(input, policy, mode, config);
  const delayedByPolicy = mode === 'DELAYED' || mode === 'BATCHED' || mode === 'AUTHOR_ONLY';
  const delayReason = delayedByPolicy
    ? receiptReason(
        input.presence.variantKey,
        input.channelId,
        policy,
        input.forceDelayed || input.presence.behavior.shouldDelayReceipt,
      )
    : undefined;

  return Object.freeze({
    emitReceipt: mode !== 'HIDDEN' && policy.allowReadReceipts,
    mode,
    delayedByPolicy,
    delayReason,
    delayMs,
    visibleToPlayer,
    reason:
      mode === 'HIDDEN'
        ? 'Read state intentionally hidden by backend policy.'
        : mode === 'IMMEDIATE'
          ? 'Receipt should land immediately.'
          : mode === 'BATCHED'
            ? 'Unread pressure held and released in a batch window.'
            : mode === 'AUTHOR_ONLY'
              ? 'Read state should exist without public theater.'
              : 'Receipt delayed to preserve authored pressure.',
  });
}

/* ============================================================================
 * MARK: Materialization helpers
 * ============================================================================
 */

function buildPlan(
  input: ReadReceiptResolutionInput,
  decision: ChatReadReceiptDecision,
  now: number,
): ChatReadDelayPlan | undefined {
  if (!decision.delayedByPolicy || !decision.emitReceipt || !decision.delayReason || decision.delayMs == null) {
    return undefined;
  }

  return Object.freeze({
    policyId: `${input.presence.readPolicy.policyId}-delay` as ChatTypingPolicyId,
    roomId: input.roomId as never,
    channelId: input.channelId as never,
    actorId: input.actorId,
    actorKind: input.actorKind,
    mode: decision.mode,
    delayedByPolicy: true,
    delayReason: decision.delayReason,
    delayMs: decision.delayMs,
    visibleToPlayer: decision.visibleToPlayer,
    createdAt: now as UnixMs,
    expiresAt: (now + decision.delayMs) as UnixMs,
  });
}

function buildReceipt(
  input: ReadReceiptResolutionInput,
  decision: ChatReadReceiptDecision,
  now: number,
): ChatReadReceiptRecord | undefined {
  if (!decision.emitReceipt || !input.messageId) return undefined;

  const readAt = decision.delayMs != null && decision.delayMs > 0 ? now + decision.delayMs : now;
  return Object.freeze({
    receiptId: `read-receipt:${input.roomId}:${input.channelId}:${input.actorId}:${input.messageId}` as ChatReadReceiptId,
    actorId: input.actorId,
    actorKind: input.actorKind,
    roomId: input.roomId as never,
    channelId: input.channelId as never,
    messageId: input.messageId as ChatMessageId,
    readAt: readAt as UnixMs,
    delayedByPolicy: decision.delayedByPolicy,
    delayReason: decision.delayReason,
    visibilityClass: decision.visibleToPlayer ? 'VISIBLE' : 'AUTHOR_ONLY',
    authority: asAuthority(input.authority),
  });
}

function buildReadHead(
  input: ReadReceiptResolutionInput,
  decision: ChatReadReceiptDecision,
  receipt: ChatReadReceiptRecord | undefined,
  now: number,
): ChatReadHeadSnapshot | undefined {
  if (!decision.emitReceipt) return undefined;

  const readAt = receipt?.readAt ?? (now as UnixMs);
  return Object.freeze({
    readHeadId: `read-head:${input.roomId}:${input.channelId}:${input.actorId}` as ChatReadHeadId,
    actorId: input.actorId,
    actorKind: input.actorKind,
    roomId: input.roomId as never,
    channelId: input.channelId as never,
    lastReadMessageId: (input.messageId as ChatMessageId | undefined) ?? (input.lastReadMessageId as ChatMessageId | undefined),
    lastReadAt: readAt,
    unreadCount: 0,
    visibleToPlayer: decision.visibleToPlayer,
    authority: asAuthority(input.authority),
    updatedAt: readAt,
  });
}

/* ============================================================================
 * MARK: Analytics builders
 * ============================================================================
 */

function buildDiagnostics(
  input: ReadReceiptResolutionInput,
  policy: ChatReadReceiptPolicy,
  decision: ChatReadReceiptDecision,
  config: ReadReceiptPolicyConfig,
  now: number,
): ReadReceiptDiagnostics {
  const family = channelFamily(input.channelId);
  const pressure01 = clamp01(input.pressure01);
  const audienceHeat01 = clamp01(input.audienceHeat01);
  const negotiationPressure01 = clamp01(input.negotiationPressure01);
  const helperNeed01 = clamp01(input.helperNeed01);
  const embarrassment01 = clamp01(input.embarrassment01);
  const obsession01 = clamp01(input.relationshipObsession01);
  const callbackOpportunity01 = clamp01(input.callbackOpportunity01);
  const unreadCount = Math.max(0, Math.floor(input.unreadCount ?? 0));

  const forceImmediateTriggered =
    Boolean(input.forceEmitReceipt) ||
    (input.presence.variantKey === 'HELPER_SURGE' &&
      Math.max(helperNeed01, pressure01) >= config.forceImmediateThreshold01);

  const unreadHoldNegotiationTriggered =
    family === 'NEGOTIATION' &&
    (negotiationPressure01 >= config.unreadHoldNegotiationThreshold01 ||
      input.presence.behavior.shouldHoldUnreadPressure);

  const unreadHoldHaterTriggered =
    (input.presence.variantKey === 'HATER_STALK' || input.presence.variantKey === 'HATER_STRIKE') &&
    Math.max(obsession01, embarrassment01, pressure01) >= config.unreadHoldHaterThreshold01;

  const helperObserveSuppressed =
    input.presence.variantKey === 'HELPER_OBSERVE' &&
    helperNeed01 < config.helperVisibleThreshold01;

  const publicReceiptSuppressed =
    input.presence.variantKey === 'HATER_STALK' &&
    Math.max(pressure01, audienceHeat01) >= config.publicReceiptSuppressionThreshold01;

  const shadowFamilyLock = family === 'SHADOW';
  const forceHiddenOverride = Boolean(input.forceHidden);
  const forceEmitOverride = Boolean(input.forceEmitReceipt);
  const forceDelayedOverride = Boolean(input.forceDelayed);

  return Object.freeze({
    input,
    derivedPolicy: policy,
    derivedMode: decision.mode,
    derivedDelayMs: decision.delayMs,
    derivedVisibility: decision.visibleToPlayer,
    channelFamily: family,
    signalVector: Object.freeze({
      pressure01,
      audienceHeat01,
      negotiationPressure01,
      helperNeed01,
      embarrassment01,
      obsession01,
      callbackOpportunity01,
    }),
    thresholdEvaluations: Object.freeze({
      forceImmediateTriggered,
      unreadHoldNegotiationTriggered,
      unreadHoldHaterTriggered,
      helperObserveSuppressed,
      publicReceiptSuppressed,
      shadowFamilyLock,
      forceHiddenOverride,
      forceEmitOverride,
      forceDelayedOverride,
    }),
    behaviorFlags: Object.freeze({
      shouldHoldUnreadPressure: input.presence.behavior.shouldHoldUnreadPressure,
      shouldDelayReceipt: input.presence.behavior.shouldDelayReceipt,
      shouldSuppressVisibleReceipt: input.presence.behavior.shouldSuppressVisibleReceipt,
    }),
    configSnapshot: config,
    computedAt: now,
  });
}

function buildAuditEntry(
  input: ReadReceiptResolutionInput,
  resolution: ReadReceiptResolution,
  now: number,
): ReadReceiptAuditEntry {
  const seed = [input.actorId, input.channelId, String(now)].join('::');
  return Object.freeze({
    auditId: `audit:${positiveHash(seed).toString(16)}`,
    actorId: input.actorId,
    actorKind: input.actorKind,
    channelId: input.channelId,
    variantKey: input.presence.variantKey,
    mode: resolution.decision.mode,
    delayMs: resolution.decision.delayMs,
    visibleToPlayer: resolution.decision.visibleToPlayer,
    emittedReceipt: resolution.decision.emitReceipt,
    heldUnreadPressure: resolution.shouldHoldUnreadPressure,
    reasons: resolution.reasons,
    capturedAt: now,
  });
}

function buildAuditReportFromEntries(
  entries: readonly ReadReceiptAuditEntry[],
  now: number,
): ReadReceiptAuditReport {
  const reportSeed = entries.map((e) => e.auditId).join(':');
  const reportId = `report:${positiveHash(reportSeed).toString(16)}`;

  let totalDelayMs = 0;
  let hiddenCount = 0;
  let immediateCount = 0;
  let delayedCount = 0;
  let batchedCount = 0;
  let authorOnlyCount = 0;
  let visibleReceiptCount = 0;
  let suppressedReceiptCount = 0;
  let heldPressureCount = 0;

  const modeFreq: Partial<Record<ChatReadPolicyMode, number>> = {};
  const delayReasonFreq: Partial<Record<ChatReadDelayReason, number>> = {};

  for (const entry of entries) {
    modeFreq[entry.mode] = (modeFreq[entry.mode] ?? 0) + 1;

    switch (entry.mode) {
      case 'HIDDEN': hiddenCount += 1; break;
      case 'IMMEDIATE': immediateCount += 1; break;
      case 'DELAYED': delayedCount += 1; break;
      case 'BATCHED': batchedCount += 1; break;
      case 'AUTHOR_ONLY': authorOnlyCount += 1; break;
    }

    if (entry.delayMs != null) totalDelayMs += entry.delayMs;
    if (entry.visibleToPlayer) visibleReceiptCount += 1;
    else if (entry.emittedReceipt) suppressedReceiptCount += 1;
    if (entry.heldUnreadPressure) heldPressureCount += 1;

    const primaryReason = entry.reasons.find((r) => r.startsWith('delayReason='));
    if (primaryReason) {
      const key = primaryReason.replace('delayReason=', '') as ChatReadDelayReason;
      delayReasonFreq[key] = (delayReasonFreq[key] ?? 0) + 1;
    }
  }

  let dominantMode: ChatReadPolicyMode = 'HIDDEN';
  let dominantModeCount = 0;
  for (const [mode, count] of Object.entries(modeFreq)) {
    if ((count ?? 0) > dominantModeCount) {
      dominantModeCount = count ?? 0;
      dominantMode = mode as ChatReadPolicyMode;
    }
  }

  let dominantDelayReason: ChatReadDelayReason | undefined;
  let dominantReasonCount = 0;
  for (const [reason, count] of Object.entries(delayReasonFreq)) {
    if ((count ?? 0) > dominantReasonCount) {
      dominantReasonCount = count ?? 0;
      dominantDelayReason = reason as ChatReadDelayReason;
    }
  }

  const averageDelayMs = entries.length > 0 ? Math.round(totalDelayMs / entries.length) : 0;

  return Object.freeze({
    reportId,
    generatedAt: now,
    entryCount: entries.length,
    entries,
    totalDelayMs,
    averageDelayMs,
    hiddenCount,
    immediateCount,
    delayedCount,
    batchedCount,
    authorOnlyCount,
    visibleReceiptCount,
    suppressedReceiptCount,
    heldPressureCount,
    dominantMode,
    dominantDelayReason,
  });
}

function buildStatsSummary(
  inputs: readonly ReadReceiptResolutionInput[],
  resolutions: readonly ReadReceiptResolution[],
): ReadReceiptStatsSummary {
  const sampleCount = resolutions.length;
  let emittedCount = 0;
  let hiddenCount = 0;
  let visibleCount = 0;
  let suppressedCount = 0;
  let delayedCount = 0;
  let batchedCount = 0;
  let immediateCount = 0;
  let authorOnlyCount = 0;
  let heldPressureCount = 0;
  let totalDelayMs = 0;
  let maxDelayMs = 0;
  let minDelayMs: number | undefined;
  const delayValues: number[] = [];
  const variantFreq: Partial<Record<PresenceStyleVariantKey, number>> = {};
  const familyFreq: Record<string, number> = {};

  for (let i = 0; i < sampleCount; i += 1) {
    const resolution = resolutions[i];
    const input = inputs[i];
    if (!resolution || !input) continue;

    if (resolution.decision.emitReceipt) emittedCount += 1;
    else hiddenCount += 1;

    if (resolution.shouldEmitVisibleReceipt) visibleCount += 1;
    else if (resolution.decision.emitReceipt) suppressedCount += 1;

    switch (resolution.decision.mode) {
      case 'DELAYED': delayedCount += 1; break;
      case 'BATCHED': batchedCount += 1; break;
      case 'IMMEDIATE': immediateCount += 1; break;
      case 'AUTHOR_ONLY': authorOnlyCount += 1; break;
      case 'HIDDEN': break;
    }

    if (resolution.shouldHoldUnreadPressure) heldPressureCount += 1;

    if (resolution.decision.delayMs != null) {
      totalDelayMs += resolution.decision.delayMs;
      maxDelayMs = Math.max(maxDelayMs, resolution.decision.delayMs);
      if (minDelayMs === undefined || resolution.decision.delayMs < minDelayMs) {
        minDelayMs = resolution.decision.delayMs;
      }
      delayValues.push(resolution.decision.delayMs);
    }

    const vk = input.presence.variantKey;
    variantFreq[vk] = (variantFreq[vk] ?? 0) + 1;

    const fam = channelFamily(input.channelId);
    familyFreq[fam] = (familyFreq[fam] ?? 0) + 1;
  }

  const averageDelayMs = sampleCount > 0 ? Math.round(totalDelayMs / sampleCount) : 0;

  let medianDelayMs: number | undefined;
  if (delayValues.length > 0) {
    const sorted = [...delayValues].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    medianDelayMs = sorted.length % 2 === 0
      ? Math.round(((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2)
      : sorted[mid];
  }

  const modePressureIndex = sampleCount > 0
    ? clamp01(delayedCount / sampleCount + batchedCount / sampleCount * 0.6)
    : 0;

  return Object.freeze({
    sampleCount,
    emittedCount,
    hiddenCount,
    visibleCount,
    suppressedCount,
    delayedCount,
    batchedCount,
    immediateCount,
    authorOnlyCount,
    heldPressureCount,
    totalDelayMs,
    averageDelayMs,
    maxDelayMs,
    minDelayMs,
    medianDelayMs,
    modePressureIndex,
    variantKeyFrequency: Object.freeze(variantFreq),
    channelFamilyFrequency: Object.freeze(familyFreq),
  });
}

function computeDiff(
  resolutionA: ReadReceiptResolution,
  resolutionB: ReadReceiptResolution,
): ReadReceiptDiff {
  const changedMode = resolutionA.decision.mode !== resolutionB.decision.mode;
  const changedVisibility = resolutionA.decision.visibleToPlayer !== resolutionB.decision.visibleToPlayer;

  const delayA = resolutionA.decision.delayMs;
  const delayB = resolutionB.decision.delayMs;
  const changedDelay = delayA !== delayB;
  const changedPolicy = resolutionA.policy.policyId !== resolutionB.policy.policyId;

  const delayDeltaMs = (delayB ?? 0) - (delayA ?? 0);
  const movedToHidden = resolutionA.decision.mode !== 'HIDDEN' && resolutionB.decision.mode === 'HIDDEN';
  const movedToImmediate = resolutionA.decision.mode !== 'IMMEDIATE' && resolutionB.decision.mode === 'IMMEDIATE';

  const pressureOrderA = ['IMMEDIATE', 'AUTHOR_ONLY', 'DELAYED', 'BATCHED', 'HIDDEN'].indexOf(resolutionA.decision.mode);
  const pressureOrderB = ['IMMEDIATE', 'AUTHOR_ONLY', 'DELAYED', 'BATCHED', 'HIDDEN'].indexOf(resolutionB.decision.mode);
  const escalated = pressureOrderB > pressureOrderA;
  const deescalated = pressureOrderB < pressureOrderA;

  return Object.freeze({
    changedMode,
    changedVisibility,
    changedDelay,
    changedPolicy,
    previousMode: resolutionA.decision.mode,
    nextMode: resolutionB.decision.mode,
    previousDelayMs: delayA,
    nextDelayMs: delayB,
    previousVisible: resolutionA.decision.visibleToPlayer,
    nextVisible: resolutionB.decision.visibleToPlayer,
    movedToHidden,
    movedToImmediate,
    delayDeltaMs,
    escalated,
    deescalated,
  });
}

/* ============================================================================
 * MARK: Stare window planner
 * ============================================================================
 */

function buildStareWindowPlan(
  input: ReadReceiptResolutionInput,
  resolution: ReadReceiptResolution,
  config: ReadReceiptPolicyConfig,
  now: number,
): StareWindowPlan | undefined {
  if (resolution.decision.mode === 'HIDDEN') return undefined;
  if (!resolution.decision.emitReceipt) return undefined;

  const family = channelFamily(input.channelId);
  const variantKey = input.presence.variantKey;
  const pressure01 = clamp01(input.pressure01);
  const obsession01 = clamp01(input.relationshipObsession01);
  const negotiationPressure01 = clamp01(input.negotiationPressure01);

  const shouldStare =
    variantKey === 'HATER_STALK' ||
    variantKey === 'DEAL_PREDATOR' ||
    (variantKey === 'HELPER_OBSERVE' && clamp01(input.helperNeed01) < 0.4) ||
    (family === 'NEGOTIATION' && negotiationPressure01 >= 0.5);

  if (!shouldStare) return undefined;

  const seed = `stare:${input.actorId}:${input.channelId}:${input.seed ?? String(now)}`;

  let baseMinMs = config.stareWindowMinMs;
  let baseMaxMs = config.stareWindowMaxMs;
  let reason: StareWindowPlan['reason'] = 'AMBIENT_PROCESSING';

  if (variantKey === 'HATER_STALK' || variantKey === 'HATER_STRIKE') {
    baseMinMs = Math.round(baseMinMs * config.stareWindowHaterMultiplier);
    baseMaxMs = Math.round(baseMaxMs * config.stareWindowHaterMultiplier);
    baseMinMs += Math.round(obsession01 * 1400);
    baseMaxMs += Math.round(obsession01 * 3200);
    reason = 'HATER_PRESSURE';
  } else if (family === 'NEGOTIATION') {
    baseMinMs = Math.round(baseMinMs * config.stareWindowNegotiationMultiplier);
    baseMaxMs = Math.round(baseMaxMs * config.stareWindowNegotiationMultiplier);
    baseMinMs += Math.round(negotiationPressure01 * 1200);
    baseMaxMs += Math.round(negotiationPressure01 * 2800);
    reason = 'NEGOTIATION_THEATER';
  } else if (variantKey === 'HELPER_OBSERVE') {
    baseMinMs = Math.round(baseMinMs * 0.7);
    baseMaxMs = Math.round(baseMaxMs * 0.7);
    reason = 'HELPER_PATIENCE';
  }

  baseMinMs += Math.round(pressure01 * 600);
  baseMaxMs += Math.round(pressure01 * 1400);

  const durationMs = deterministicRange(
    clamp(baseMinMs, 500, 30_000),
    clamp(Math.max(baseMinMs, baseMaxMs), 500, 60_000),
    seed,
  );

  const readEmitAt = now + (resolution.decision.delayMs ?? 0);
  const opensAt = readEmitAt;
  const closesAt = opensAt + durationMs;

  return Object.freeze({
    stareId: `stare:${positiveHash(seed).toString(16)}`,
    actorId: input.actorId,
    actorKind: input.actorKind,
    channelId: input.channelId,
    messageId: input.messageId ?? undefined,
    opensAt,
    closesAt,
    durationMs,
    visibleToPlayer: resolution.decision.visibleToPlayer,
    reason,
    shouldEmitReadBeforeStare: resolution.decision.visibleToPlayer,
    readEmitAt,
  });
}

/* ============================================================================
 * MARK: Negotiation read sequence planner
 * ============================================================================
 */

function buildNegotiationSequence(
  input: ReadReceiptResolutionInput,
  config: ReadReceiptPolicyConfig,
  now: number,
): NegotiationReadSequence {
  const sequenceSeed = `negotiation-seq:${input.actorId}:${input.channelId}:${input.seed ?? String(now)}`;
  const sequenceId = `neg-seq:${positiveHash(sequenceSeed).toString(16)}`;

  const negotiationPressure01 = clamp01(input.negotiationPressure01);
  const stageCount = clamp(
    config.negotiationSequenceStageCount + (negotiationPressure01 >= 0.8 ? 1 : 0),
    2,
    6,
  );

  const stages: NegotiationReadStage[] = [];
  let cursor = now;
  let stagePressure = clamp01(negotiationPressure01 * 0.4);

  for (let stageIndex = 0; stageIndex < stageCount; stageIndex += 1) {
    const stageDelayMs = deterministicRange(
      Math.floor(config.negotiationSequenceStageDelayMs * 0.7),
      Math.floor(config.negotiationSequenceStageDelayMs * 1.4),
      `${sequenceSeed}::stage::${stageIndex}`,
    );

    const durationMs = stageDelayMs;
    const pressureAtStage = clamp01(stagePressure);

    const mode: ChatReadPolicyMode =
      stageIndex === stageCount - 1
        ? (negotiationPressure01 >= 0.7 ? 'BATCHED' : 'DELAYED')
        : (stageIndex === 0 ? 'AUTHOR_ONLY' : 'DELAYED');

    const visibleAtThisStage =
      stageIndex === stageCount - 1 &&
      !input.presence.behavior.shouldSuppressVisibleReceipt &&
      pressureAtStage < 0.85;

    stages.push(Object.freeze({
      stageIndex,
      offsetMs: cursor - now,
      durationMs,
      pressureAtStage01: pressureAtStage,
      mode,
      visibleAtThisStage,
      reason:
        stageIndex === 0
          ? 'INITIAL_READ_MASK'
          : stageIndex === stageCount - 1
            ? 'FINAL_ACKNOWLEDGMENT'
            : 'PRESSURE_ESCALATION',
    }));

    cursor += durationMs;
    stagePressure = clamp01(stagePressure + config.negotiationDecayRatePerStage * (1 - stagePressure));
  }

  const totalDurationMs = cursor - now;
  const finalPressure01 = clamp01(stagePressure);
  const shouldFinalizeWithSeen = negotiationPressure01 < 0.72 && !input.presence.behavior.shouldHoldUnreadPressure;

  return Object.freeze({
    sequenceId,
    actorId: input.actorId,
    channelId: input.channelId,
    stageCount,
    stages: Object.freeze(stages),
    totalDurationMs,
    finalPressure01,
    shouldFinalizeWithSeen,
  });
}

/* ============================================================================
 * MARK: Unread pressure aggregation
 * ============================================================================
 */

function computeUnreadPressureScore(
  input: ReadReceiptResolutionInput,
  config: ReadReceiptPolicyConfig,
  now: number,
): number {
  const family = channelFamily(input.channelId);
  const unreadCount = Math.max(0, Math.floor(input.unreadCount ?? 0));
  const pressure01 = clamp01(input.pressure01);
  const negotiationPressure01 = clamp01(input.negotiationPressure01);
  const obsession01 = clamp01(input.relationshipObsession01);

  let score = Math.min(unreadCount / config.unreadPressureCapacity, 1.0);

  if (family === 'NEGOTIATION') {
    score = clamp01(score + negotiationPressure01 * 0.38);
  }

  if (
    input.presence.variantKey === 'HATER_STALK' ||
    input.presence.variantKey === 'HATER_STRIKE'
  ) {
    score = clamp01(score + obsession01 * 0.26 + pressure01 * 0.18);
  }

  if (family === 'SHADOW') {
    score = 0;
  }

  const lastReadAt = nowMs(input.lastReadAt);
  const msElapsed = Math.max(0, now - lastReadAt);
  const decay = msElapsed * config.unreadPressureDecayPerMs;
  score = clamp01(score - decay);

  return score;
}

function buildUnreadPressureAggregate(
  inputs: readonly ReadReceiptResolutionInput[],
  config: ReadReceiptPolicyConfig,
  now: number,
): UnreadPressureAggregate {
  if (inputs.length === 0) {
    return Object.freeze({
      actorId: 'unknown',
      roomId: 'unknown',
      channels: Object.freeze([]),
      totalUnreadCount: 0,
      totalPressureScore01: 0,
      dominantChannelId: undefined,
      dominantPressure01: 0,
      computedAt: now,
      shouldTriggerBatch: false,
      batchWindowMs: config.batchWindowMs,
    });
  }

  const actorId = inputs[0]?.actorId ?? 'unknown';
  const roomId = inputs[0]?.roomId ?? 'unknown';

  const channels: UnreadPressureChannelEntry[] = inputs.map((input) => {
    const unreadCount = Math.max(0, Math.floor(input.unreadCount ?? 0));
    const rawPressure = computeUnreadPressureScore(input, config, now);
    const lastMessageAt = input.lastReadAt != null ? nowMs(input.lastReadAt) : undefined;
    const decayedSince = lastMessageAt != null ? now - lastMessageAt : 0;
    const decayFactor = Math.max(0, 1 - decayedSince * config.unreadPressureDecayPerMs * 0.5);
    const effectivePressure = clamp01(rawPressure * decayFactor);

    return Object.freeze({
      channelId: input.channelId,
      unreadCount,
      pressureScore01: rawPressure,
      lastMessageAt,
      decayedSince,
      effectivePressure01: effectivePressure,
    });
  });

  const totalUnreadCount = channels.reduce((sum, ch) => sum + ch.unreadCount, 0);
  const totalPressureScore01 = clamp01(
    channels.reduce((sum, ch) => sum + ch.effectivePressure01, 0) / Math.max(1, channels.length),
  );

  let dominantChannelId: ChatChannelId | undefined;
  let dominantPressure01 = 0;
  for (const ch of channels) {
    if (ch.effectivePressure01 > dominantPressure01) {
      dominantPressure01 = ch.effectivePressure01;
      dominantChannelId = ch.channelId;
    }
  }

  const shouldTriggerBatch =
    totalUnreadCount >= config.unreadPressureCapacity ||
    totalPressureScore01 >= 0.72;

  return Object.freeze({
    actorId,
    roomId,
    channels: Object.freeze(channels),
    totalUnreadCount,
    totalPressureScore01,
    dominantChannelId,
    dominantPressure01,
    computedAt: now,
    shouldTriggerBatch,
    batchWindowMs: config.batchWindowMs,
  });
}

/* ============================================================================
 * MARK: Explanation builder
 * ============================================================================
 */

function explainResolved(
  input: ReadReceiptResolutionInput,
  policy: ChatReadReceiptPolicy,
  decision: ChatReadReceiptDecision,
): readonly string[] {
  const reasons: string[] = [];
  reasons.push(`variant=${input.presence.variantKey}`);
  reasons.push(`mode=${decision.mode}`);
  reasons.push(`visibility=${policy.visibilityMode}`);
  reasons.push(`playerVisible=${decision.visibleToPlayer}`);
  reasons.push(`emitReceipt=${decision.emitReceipt}`);

  if (decision.delayReason) reasons.push(`delayReason=${decision.delayReason}`);
  if (decision.delayMs != null) reasons.push(`delayMs=${decision.delayMs}`);
  if (input.presence.behavior.shouldHoldUnreadPressure) reasons.push('hold-unread-pressure');
  if (input.presence.behavior.shouldSuppressVisibleReceipt) reasons.push('visible-receipt-suppressed');
  if (channelFamily(input.channelId) === 'NEGOTIATION') reasons.push('deal-room-pressure');
  if (channelFamily(input.channelId) === 'SHADOW') reasons.push('shadow-channel-hidden');

  return Object.freeze(reasons);
}

/* ============================================================================
 * MARK: Public class
 * ============================================================================
 */

export class ReadReceiptPolicy {
  private readonly config: ReadReceiptPolicyConfig;

  public constructor(config: Partial<ReadReceiptPolicyConfig> = {}) {
    this.config = Object.freeze({
      ...DEFAULT_CONFIG,
      ...config,
    });
  }

  /**
   * Resolve a single read receipt decision.
   */
  public resolve(input: ReadReceiptResolutionInput): ReadReceiptResolution {
    const derivedAt = nowMs(input.now);
    const policy = derivePolicy(input);
    const decision = buildDecision(input, policy, this.config);
    const plan = buildPlan(input, decision, derivedAt);
    const receipt = buildReceipt(input, decision, derivedAt);
    const readHead = buildReadHead(input, decision, receipt, derivedAt);
    const shouldEmitVisibleReceipt = Boolean(decision.emitReceipt && decision.visibleToPlayer);
    const shouldHoldUnreadPressure = Boolean(
      !decision.emitReceipt ||
        decision.mode === 'DELAYED' ||
        decision.mode === 'BATCHED' ||
        input.presence.behavior.shouldHoldUnreadPressure,
    );
    const reasons = explainResolved(input, policy, decision);

    return Object.freeze({
      policy,
      decision,
      plan,
      receipt,
      readHead,
      shouldHoldUnreadPressure,
      shouldEmitVisibleReceipt,
      shouldAdvanceReadHead: Boolean(readHead),
      reasons,
      derivedAt,
    });
  }

  /**
   * Explain a resolution in human-readable reason strings.
   */
  public explain(input: ReadReceiptResolutionInput): readonly string[] {
    const resolved = this.resolve(input);
    return resolved.reasons;
  }

  /**
   * True when the actor should intentionally leave the message unread as
   * a gameplay pressure mechanic.
   */
  public shouldLeaveUnread(input: ReadReceiptResolutionInput): boolean {
    const resolved = this.resolve(input);
    return resolved.shouldHoldUnreadPressure && !resolved.shouldEmitVisibleReceipt;
  }

  /**
   * Materialize a read head with no public theater — the backend advances
   * its internal cursor without leaking visible state to the player.
   */
  public materializeReadHeadOnly(input: ReadReceiptResolutionInput): ChatReadHeadSnapshot | undefined {
    const resolved = this.resolve({
      ...input,
      forceEmitReceipt: true,
      visibleToPlayer: false,
    });
    return resolved.readHead;
  }

  /**
   * Resolve many inputs in one pass. Returns all resolutions in order.
   */
  public resolveBatch(inputs: readonly ReadReceiptResolutionInput[]): ReadReceiptBatchResult {
    const now = nowMs(inputs[0]?.now);
    const resolutions: ReadReceiptResolution[] = inputs.map((input) => this.resolve(input));

    let totalEmitted = 0;
    let totalHidden = 0;
    let totalHeldPressure = 0;
    let totalVisibleEmitted = 0;
    let totalDelayMs = 0;

    const auditEntries: ReadReceiptAuditEntry[] = [];

    for (let i = 0; i < inputs.length; i += 1) {
      const input = inputs[i];
      const resolution = resolutions[i];
      if (!input || !resolution) continue;

      if (resolution.decision.emitReceipt) totalEmitted += 1;
      else totalHidden += 1;
      if (resolution.shouldHoldUnreadPressure) totalHeldPressure += 1;
      if (resolution.shouldEmitVisibleReceipt) totalVisibleEmitted += 1;
      if (resolution.decision.delayMs != null) totalDelayMs += resolution.decision.delayMs;

      auditEntries.push(buildAuditEntry(input, resolution, now + i));
    }

    const audit = buildAuditReportFromEntries(Object.freeze(auditEntries), now);

    return Object.freeze({
      generatedAt: now,
      inputs,
      resolutions: Object.freeze(resolutions),
      totalEmitted,
      totalHidden,
      totalHeldPressure,
      totalVisibleEmitted,
      totalDelayMs,
      audit,
    });
  }

  /**
   * Resolve a batch with shared unread pressure context — each actor's
   * pressure aggregate informs the other inputs in the same room.
   */
  public resolveBatchForRoom(
    inputs: readonly ReadReceiptResolutionInput[],
  ): ReadReceiptBatchResult {
    if (inputs.length === 0) return this.resolveBatch(inputs);

    const now = nowMs(inputs[0]?.now);
    const aggregate = buildUnreadPressureAggregate(inputs, this.config, now);

    const enriched = inputs.map((input) => {
      const channelEntry = aggregate.channels.find((c) => c.channelId === input.channelId);
      const boostedPressure01 = channelEntry
        ? clamp01((clamp01(input.pressure01) + channelEntry.effectivePressure01) / 2)
        : clamp01(input.pressure01);
      return { ...input, pressure01: boostedPressure01 as Score01 };
    });

    return this.resolveBatch(enriched);
  }

  /**
   * Full diagnostic breakdown of every factor driving a resolution.
   */
  public getDiagnostics(input: ReadReceiptResolutionInput): ReadReceiptDiagnostics {
    const now = nowMs(input.now);
    const policy = derivePolicy(input);
    const decision = buildDecision(input, policy, this.config);
    return buildDiagnostics(input, policy, decision, this.config, now);
  }

  /**
   * Build an audit report from a slice of inputs and their resolutions.
   */
  public buildAuditReport(
    inputs: readonly ReadReceiptResolutionInput[],
    resolutions: readonly ReadReceiptResolution[],
  ): ReadReceiptAuditReport {
    const now = nowMs(inputs[0]?.now);
    const entries: ReadReceiptAuditEntry[] = [];
    const count = Math.min(inputs.length, resolutions.length);
    for (let i = 0; i < count; i += 1) {
      const input = inputs[i];
      const resolution = resolutions[i];
      if (!input || !resolution) continue;
      entries.push(buildAuditEntry(input, resolution, now + i));
    }
    return buildAuditReportFromEntries(Object.freeze(entries), now);
  }

  /**
   * Diff between two resolutions for the same actor/channel.
   */
  public computeDiff(
    resolutionA: ReadReceiptResolution,
    resolutionB: ReadReceiptResolution,
  ): ReadReceiptDiff {
    return computeDiff(resolutionA, resolutionB);
  }

  /**
   * Aggregate stats across a batch of resolutions.
   */
  public getStatsSummary(
    inputs: readonly ReadReceiptResolutionInput[],
    resolutions: readonly ReadReceiptResolution[],
  ): ReadReceiptStatsSummary {
    return buildStatsSummary(inputs, resolutions);
  }

  /**
   * Whether this input should produce a stare window event.
   * A stare window is when the NPC has visibly read the message but
   * sits in silence before responding — authored gameplay pressure.
   */
  public shouldEmitStareWindow(input: ReadReceiptResolutionInput): boolean {
    const resolution = this.resolve(input);
    const plan = buildStareWindowPlan(input, resolution, this.config, nowMs(input.now));
    return plan != null;
  }

  /**
   * Compute the stare window plan for this input if applicable.
   */
  public computeStareWindowPlan(input: ReadReceiptResolutionInput): StareWindowPlan | undefined {
    const now = nowMs(input.now);
    const resolution = this.resolve(input);
    return buildStareWindowPlan(input, resolution, this.config, now);
  }

  /**
   * Compute the aggregate unread pressure score for this actor's input.
   * 0.0 = no pressure, 1.0 = maximum pressure.
   */
  public computeUnreadPressureScore(input: ReadReceiptResolutionInput): number {
    return computeUnreadPressureScore(input, this.config, nowMs(input.now));
  }

  /**
   * Build an aggregate unread pressure view across multiple channel inputs.
   */
  public buildUnreadPressureAggregate(
    inputs: readonly ReadReceiptResolutionInput[],
  ): UnreadPressureAggregate {
    return buildUnreadPressureAggregate(inputs, this.config, nowMs(inputs[0]?.now));
  }

  /**
   * Build all read heads for a batch — one per emittable receipt.
   * Skips inputs where the decision is hidden or suppressed.
   */
  public buildBatchReadHeads(
    inputs: readonly ReadReceiptResolutionInput[],
  ): readonly ChatReadHeadSnapshot[] {
    const now = nowMs(inputs[0]?.now);
    const heads: ChatReadHeadSnapshot[] = [];
    for (const input of inputs) {
      const policy = derivePolicy(input);
      const decision = buildDecision(input, policy, this.config);
      if (!decision.emitReceipt) continue;
      const receipt = buildReceipt(input, decision, now);
      const head = buildReadHead(input, decision, receipt, now);
      if (head) heads.push(head);
    }
    return Object.freeze(heads);
  }

  /**
   * Build a staged negotiation read sequence for a deal-room input.
   * This drives the multi-stage acknowledgment pattern used to manufacture
   * deal room tension.
   */
  public buildNegotiationSequence(input: ReadReceiptResolutionInput): NegotiationReadSequence {
    return buildNegotiationSequence(input, this.config, nowMs(input.now));
  }

  /**
   * Serialize the policy configuration for transport or debug.
   */
  public toJSON(): ReadReceiptPolicyConfig {
    return this.config;
  }
}

/* ============================================================================
 * MARK: Standalone helpers
 * ============================================================================
 */

/**
 * Quick check: will this input suppress visible receipt state?
 */
export function willSuppressVisibleReceipt(input: ReadReceiptResolutionInput): boolean {
  return (
    input.presence.behavior.shouldSuppressVisibleReceipt ||
    channelFamily(input.channelId) === 'SHADOW' ||
    Boolean(input.forceHidden) ||
    input.visibleToPlayer === false
  );
}

/**
 * Quick check: will this input hold unread pressure?
 */
export function willHoldUnreadPressure(input: ReadReceiptResolutionInput): boolean {
  return (
    input.presence.behavior.shouldHoldUnreadPressure ||
    channelFamily(input.channelId) === 'NEGOTIATION' ||
    input.presence.variantKey === 'HATER_STALK' ||
    input.presence.variantKey === 'DEAL_PREDATOR' ||
    input.presence.variantKey === 'DEAL_SILENT'
  );
}

/**
 * Derive a deterministic receipt seed from actor context.
 */
export function deriveReceiptSeed(
  actorId: string,
  channelId: ChatChannelId,
  messageId?: string | null,
  baseSeed?: string | null,
): string {
  return [baseSeed ?? 'receipt-seed', actorId, channelId, messageId ?? 'no-msg'].join('::');
}

/**
 * Classify whether a variant key typically weaponizes read delay.
 */
export function variantWeaponizesReadDelay(variantKey: PresenceStyleVariantKey): boolean {
  return (
    variantKey === 'HATER_STALK' ||
    variantKey === 'HATER_STRIKE' ||
    variantKey === 'DEAL_PREDATOR' ||
    variantKey === 'DEAL_SILENT'
  );
}

/**
 * Classify whether a variant key typically exposes visible read receipts
 * to the player.
 */
export function variantExposesVisibleReceipt(variantKey: PresenceStyleVariantKey): boolean {
  return (
    variantKey === 'HELPER_SURGE' ||
    variantKey === 'HELPER_OBSERVE' ||
    variantKey === 'LIVEOPS_PULSE' ||
    variantKey === 'NPC_AMBIENT'
  );
}

/**
 * Derive the expected read pressure multiplier for a channel family.
 * Used by upstream scheduling to weight the read delay budget.
 */
export function channelFamilyReadPressureMultiplier(channelId: ChatChannelId): number {
  const family = channelFamily(channelId);
  switch (family) {
    case 'NEGOTIATION': return 1.8;
    case 'SHADOW': return 0.0;
    case 'LOBBY': return 0.6;
    default: return 1.0;
  }
}

/* ============================================================================
 * MARK: Factory functions
 * ============================================================================
 */

export function createReadReceiptPolicy(
  config: Partial<ReadReceiptPolicyConfig> = {},
): ReadReceiptPolicy {
  return new ReadReceiptPolicy(config);
}

export function createReadReceiptPolicyFromProfile(
  profile: ReadReceiptPolicyProfile,
  overrides: Partial<ReadReceiptPolicyConfig> = {},
): ReadReceiptPolicy {
  const profileConfig = READ_RECEIPT_POLICY_PROFILE_OPTIONS[profile];
  return new ReadReceiptPolicy({ ...profileConfig, ...overrides });
}

export function createBalancedReadReceiptPolicy(
  overrides: Partial<ReadReceiptPolicyConfig> = {},
): ReadReceiptPolicy {
  return createReadReceiptPolicyFromProfile('BALANCED', overrides);
}

export function createNegotiationHeavyReadReceiptPolicy(
  overrides: Partial<ReadReceiptPolicyConfig> = {},
): ReadReceiptPolicy {
  return createReadReceiptPolicyFromProfile('NEGOTIATION_HEAVY', overrides);
}

export function createHaterWeaponizedReadReceiptPolicy(
  overrides: Partial<ReadReceiptPolicyConfig> = {},
): ReadReceiptPolicy {
  return createReadReceiptPolicyFromProfile('HATER_WEAPONIZED', overrides);
}

export function createHelperVisibleReadReceiptPolicy(
  overrides: Partial<ReadReceiptPolicyConfig> = {},
): ReadReceiptPolicy {
  return createReadReceiptPolicyFromProfile('HELPER_VISIBLE', overrides);
}

export function createShadowSilentReadReceiptPolicy(
  overrides: Partial<ReadReceiptPolicyConfig> = {},
): ReadReceiptPolicy {
  return createReadReceiptPolicyFromProfile('SHADOW_SILENT', overrides);
}

export function createBatchedPressureReadReceiptPolicy(
  overrides: Partial<ReadReceiptPolicyConfig> = {},
): ReadReceiptPolicy {
  return createReadReceiptPolicyFromProfile('BATCHED_PRESSURE', overrides);
}

/* ============================================================================
 * MARK: Module bundle
 * ============================================================================
 */

export const ChatReadReceiptPolicyModule = Object.freeze({
  ReadReceiptPolicy,
  createReadReceiptPolicy,
  createReadReceiptPolicyFromProfile,
  createBalancedReadReceiptPolicy,
  createNegotiationHeavyReadReceiptPolicy,
  createHaterWeaponizedReadReceiptPolicy,
  createHelperVisibleReadReceiptPolicy,
  createShadowSilentReadReceiptPolicy,
  createBatchedPressureReadReceiptPolicy,
  willSuppressVisibleReceipt,
  willHoldUnreadPressure,
  deriveReceiptSeed,
  variantWeaponizesReadDelay,
  variantExposesVisibleReceipt,
  channelFamilyReadPressureMultiplier,
});
