/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT READ RECEIPT POLICY
 * FILE: backend/src/game/engine/chat/presence/ReadReceiptPolicy.ts
 * VERSION: 2026.03.19
 * AUTHORSHIP: OpenAI for Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Authoritative backend law for read-delay pressure, visible vs hidden read
 * receipts, unread-pressure staging, and read-head materialization.
 *
 * This file is intentionally separate from transport and intentionally separate
 * from the shared contract lane. Shared contracts define what a read receipt is.
 * This file decides when it should exist, whether the player can see it, how
 * long the delay should be, and when leaving a message unread is the stronger
 * gameplay move.
 *
 * Design laws
 * -----------
 * 1. Deal-room silence is a mechanic, not a missing feature.
 * 2. Haters may weaponize read-delay and stare windows.
 * 3. Helpers may read, wait, and enter gently rather than instantly.
 * 4. Shadow channels must never leak visible read state.
 * 5. Read policy must stay deterministic enough for replay / proof and varied
 *    enough that timing does not feel robotic.
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
}

const DEFAULT_CONFIG: ReadReceiptPolicyConfig = Object.freeze({
  version: '2026.03.19',
  minBatchDelayMs: 1400,
  maxBatchDelayMs: 6200,
  unreadHoldNegotiationThreshold01: 0.62,
  unreadHoldHaterThreshold01: 0.56,
  helperVisibleThreshold01: 0.28,
  publicReceiptSuppressionThreshold01: 0.74,
  forceImmediateThreshold01: 0.88,
  backlogBatchThreshold: 6,
});

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
    const reasons = this.explainResolved(input, policy, decision);

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

  public explain(input: ReadReceiptResolutionInput): readonly string[] {
    const resolved = this.resolve(input);
    return resolved.reasons;
  }

  public shouldLeaveUnread(input: ReadReceiptResolutionInput): boolean {
    const resolved = this.resolve(input);
    return resolved.shouldHoldUnreadPressure && !resolved.shouldEmitVisibleReceipt;
  }

  public materializeReadHeadOnly(input: ReadReceiptResolutionInput): ChatReadHeadSnapshot | undefined {
    const resolved = this.resolve({
      ...input,
      forceEmitReceipt: true,
      visibleToPlayer: false,
    });
    return resolved.readHead;
  }

  private explainResolved(
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
}

export function createReadReceiptPolicy(
  config: Partial<ReadReceiptPolicyConfig> = {},
): ReadReceiptPolicy {
  return new ReadReceiptPolicy(config);
}

export const ChatReadReceiptPolicyModule = Object.freeze({
  ReadReceiptPolicy,
  createReadReceiptPolicy,
});
