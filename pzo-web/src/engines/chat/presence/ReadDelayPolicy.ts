/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT READ DELAY POLICY
 * FILE: pzo-web/src/engines/chat/presence/ReadDelayPolicy.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Deterministic read-delay and read-receipt policy for human-feeling chat
 * presence theater.
 *
 * This file exists because read state in Point Zero One is not neutral metadata.
 * It is part of social pressure, negotiation pressure, rescue timing, witness
 * pacing, and ambient intimidation.
 *
 * It bridges:
 * - /shared/contracts/chat/ChatPresenceStyle.ts
 * - /pzo-web/src/engines/chat/presence/NpcPresenceStyle.ts
 * - /pzo-web/src/engines/chat/types.ts
 *
 * Design doctrine
 * ---------------
 * 1. DEAL_ROOM unread is pressure.
 * 2. HELPER unread is care timing, not abandonment.
 * 3. RIVAL unread can be a weapon.
 * 4. SYSTEM and LIVEOPS read state should be fast and legible.
 * 5. Shadow channels may track read logic without emitting visible receipts.
 * 6. Delay decisions must be deterministic, inspectable, and replay-safe.
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ============================================================================
 */

import type {
  ChatPresenceIntent,
  ChatPresenceReadBehavior,
} from '../../../../../shared/contracts/chat/ChatPresenceStyle';

import type {
  ChatActorKind,
  ChatChannelId,
  ChatMessageId,
  ChatReadReceipt,
  JsonObject,
  PressureTier,
  TickTier,
  UnixMs,
} from '../types';

import {
  NpcPresenceStyleRegistry,
  type NpcPresenceRuntimeContext,
} from './NpcPresenceStyle';

// ============================================================================
// MARK: Public policy contracts
// ============================================================================

export type ReadDelayReasonCode =
  | 'IMMEDIATE_SYSTEM'
  | 'HELPER_GENTLE_DELAY'
  | 'RIVAL_PRESSURE_DELAY'
  | 'NEGOTIATION_STALL'
  | 'NEGOTIATION_REVIEW'
  | 'COUNTERPLAY_WINDOW'
  | 'RESCUE_PROTECTED_WINDOW'
  | 'WORLD_EVENT_PULSE'
  | 'CROWD_WITNESS_DELAY'
  | 'SHADOW_SUPPRESSED'
  | 'DEFAULT_DELAY';

export interface ReadDelayEvaluationInput {
  readonly now: UnixMs;
  readonly actorId: string;
  readonly actorKind: ChatActorKind;
  readonly channelId: ChatChannelId;
  readonly messageId: ChatMessageId;
  readonly trigger?: NpcPresenceRuntimeContext['trigger'];
  readonly preferredIntent?: ChatPresenceIntent;
  readonly pressureTier?: PressureTier;
  readonly tickTier?: TickTier;
  readonly pressureScore?: number;
  readonly urgencyScore?: number;
  readonly rescueRiskScore?: number;
  readonly embarrassmentScore?: number;
  readonly rivalryScore?: number;
  readonly crowdHeatScore?: number;
  readonly negotiationRiskScore?: number;
  readonly worldEventWeight?: number;
  readonly helperProtectionWindowActive?: boolean;
  readonly counterplayWindowOpen?: boolean;
  readonly unreadStreak?: number;
  readonly messageAgeMs?: number;
  readonly metadata?: JsonObject;
}

export interface ReadDelayDecision {
  readonly actorId: string;
  readonly actorKind: ChatActorKind;
  readonly channelId: ChatChannelId;
  readonly messageId: ChatMessageId;
  readonly behavior: ChatPresenceReadBehavior;
  readonly reasonCode: ReadDelayReasonCode;
  readonly delayMs: number;
  readonly holdUnreadMs: number;
  readonly markReadAt: UnixMs;
  readonly shouldEmitReceipt: boolean;
  readonly delayedByPolicy: boolean;
  readonly suppressReceipt: boolean;
  readonly visibleToPlayer: boolean;
  readonly debug: ReadDelayDebugBreakdown;
}

export interface ReadDelayDebugBreakdown {
  readonly baseDelayMs: number;
  readonly pressureAdjustmentMs: number;
  readonly urgencyAdjustmentMs: number;
  readonly negotiationAdjustmentMs: number;
  readonly rescueAdjustmentMs: number;
  readonly crowdAdjustmentMs: number;
  readonly unreadAdjustmentMs: number;
  readonly worldEventAdjustmentMs: number;
  readonly deterministicJitterMs: number;
}

export interface ReadDelayPolicyMetrics {
  readonly evaluatedCount: number;
  readonly suppressedCount: number;
  readonly immediateCount: number;
  readonly delayedCount: number;
  readonly strategicDelayCount: number;
  readonly helperDeferenceCount: number;
  readonly negotiationDelayCount: number;
}

export interface ReadDelayPolicyOptions {
  readonly registry?: NpcPresenceStyleRegistry;
  readonly log?: (message: string, context?: Record<string, unknown>) => void;
}

const DEFAULT_METRICS: ReadDelayPolicyMetrics = Object.freeze({
  evaluatedCount: 0,
  suppressedCount: 0,
  immediateCount: 0,
  delayedCount: 0,
  strategicDelayCount: 0,
  helperDeferenceCount: 0,
  negotiationDelayCount: 0,
});

// ============================================================================
// MARK: Helpers
// ============================================================================

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toNumber(value: unknown, fallback = 0): number {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function stableHash(input: string): number {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = Math.imul(31, hash) + input.charCodeAt(index) | 0;
  }
  return Math.abs(hash);
}

function channelSupportsVisibleReceipt(channelId: ChatChannelId): boolean {
  return !channelId.endsWith('_SHADOW');
}

function asUnixMs(value: number): UnixMs {
  return value as UnixMs;
}

function mapReasonToReceiptDelayReason(reasonCode: ReadDelayReasonCode): ChatReadReceipt['delayReason'] {
  switch (reasonCode) {
    case 'NEGOTIATION_STALL':
    case 'NEGOTIATION_REVIEW':
      return 'NEGOTIATION_PRESSURE';
    case 'SHADOW_SUPPRESSED':
      return 'NPC_LATENCY';
    default:
      return 'PRESENCE_THEATER';
  }
}

// ============================================================================
// MARK: Policy
// ============================================================================

export class ReadDelayPolicy {
  private readonly registry: NpcPresenceStyleRegistry;
  private readonly log?: (message: string, context?: Record<string, unknown>) => void;
  private metrics: ReadDelayPolicyMetrics = { ...DEFAULT_METRICS };

  public constructor(options: ReadDelayPolicyOptions = {}) {
    this.registry = options.registry ?? new NpcPresenceStyleRegistry();
    this.log = options.log;
  }

  public getMetrics(): ReadDelayPolicyMetrics {
    return { ...this.metrics };
  }

  public evaluate(input: ReadDelayEvaluationInput): ReadDelayDecision {
    const plannedCue = this.registry.planCue({
      now: input.now,
      actorId: input.actorId,
      actorKind: input.actorKind,
      channelId: input.channelId,
      trigger: input.trigger ?? 'READ_RECEIPT',
      preferredIntent: input.preferredIntent,
      currentPressureTier: input.pressureTier,
      currentTickTier: input.tickTier,
      pressureScore: input.pressureScore,
      urgencyScore: input.urgencyScore,
      embarrassmentScore: input.embarrassmentScore,
      rescueRiskScore: input.rescueRiskScore,
      rivalryScore: input.rivalryScore,
      crowdHeatScore: input.crowdHeatScore,
      negotiationRiskScore: input.negotiationRiskScore,
      worldEventWeight: input.worldEventWeight,
      helperProtectionWindowActive: input.helperProtectionWindowActive,
      counterplayWindowOpen: input.counterplayWindowOpen,
      unreadStreak: input.unreadStreak,
      metadata: input.metadata,
    });

    const behavior = plannedCue.readPolicy?.behavior ?? this.defaultBehaviorForActor(input);
    const baseDelayMs = this.resolveBaseDelayMs(behavior, plannedCue, input);
    const holdUnreadMs = this.resolveHoldUnreadMs(behavior, plannedCue, input);
    const breakdown = this.resolveAdjustments(plannedCue, input, baseDelayMs);
    const computedDelayMs = clamp(
      baseDelayMs
        + breakdown.pressureAdjustmentMs
        + breakdown.urgencyAdjustmentMs
        + breakdown.negotiationAdjustmentMs
        + breakdown.rescueAdjustmentMs
        + breakdown.crowdAdjustmentMs
        + breakdown.unreadAdjustmentMs
        + breakdown.worldEventAdjustmentMs
        + breakdown.deterministicJitterMs,
      0,
      Math.max(0, holdUnreadMs > 0 ? holdUnreadMs : 12_000),
    );

    const reasonCode = this.resolveReasonCode(plannedCue, input, behavior);
    const suppressReceipt = this.shouldSuppressReceipt(plannedCue, input, behavior);
    const visibleToPlayer = channelSupportsVisibleReceipt(input.channelId);
    const shouldEmitReceipt = !suppressReceipt && visibleToPlayer;
    const markReadAt = asUnixMs(Number(input.now) + computedDelayMs);

    this.metrics = {
      evaluatedCount: this.metrics.evaluatedCount + 1,
      suppressedCount: this.metrics.suppressedCount + (suppressReceipt ? 1 : 0),
      immediateCount: this.metrics.immediateCount + (computedDelayMs === 0 ? 1 : 0),
      delayedCount: this.metrics.delayedCount + (computedDelayMs > 0 ? 1 : 0),
      strategicDelayCount:
        this.metrics.strategicDelayCount + (behavior === 'STRATEGIC_DELAY' ? 1 : 0),
      helperDeferenceCount:
        this.metrics.helperDeferenceCount + (reasonCode === 'HELPER_GENTLE_DELAY' ? 1 : 0),
      negotiationDelayCount:
        this.metrics.negotiationDelayCount
          + (reasonCode === 'NEGOTIATION_STALL' || reasonCode === 'NEGOTIATION_REVIEW' ? 1 : 0),
    };

    this.log?.('read_delay_evaluated', {
      actorId: input.actorId,
      actorKind: input.actorKind,
      channelId: input.channelId,
      messageId: input.messageId,
      behavior,
      reasonCode,
      delayMs: computedDelayMs,
      suppressReceipt,
    });

    return {
      actorId: input.actorId,
      actorKind: input.actorKind,
      channelId: input.channelId,
      messageId: input.messageId,
      behavior,
      reasonCode,
      delayMs: computedDelayMs,
      holdUnreadMs,
      markReadAt,
      shouldEmitReceipt,
      delayedByPolicy: computedDelayMs > 0,
      suppressReceipt,
      visibleToPlayer,
      debug: {
        baseDelayMs,
        ...breakdown,
      },
    };
  }

  public buildReadReceipt(input: ReadDelayEvaluationInput): ChatReadReceipt {
    const decision = this.evaluate(input);
    return {
      actorId: decision.actorId,
      actorKind: decision.actorKind,
      messageId: decision.messageId,
      readAt: decision.markReadAt,
      delayedByPolicy: decision.delayedByPolicy,
      delayReason: mapReasonToReceiptDelayReason(decision.reasonCode),
    };
  }

  private defaultBehaviorForActor(input: ReadDelayEvaluationInput): ChatPresenceReadBehavior {
    switch (input.actorKind) {
      case 'SYSTEM':
      case 'LIVEOPS':
        return 'IMMEDIATE';
      case 'HELPER':
        return 'DELAYED';
      case 'DEAL_AGENT':
        return 'AFTER_OFFER_REVIEW';
      case 'HATER':
        return 'STRATEGIC_DELAY';
      case 'CROWD':
      case 'AMBIENT_NPC':
        return 'DELAYED';
      case 'PLAYER':
      default:
        return 'IMMEDIATE';
    }
  }

  private resolveBaseDelayMs(
    behavior: ChatPresenceReadBehavior,
    plannedCue: ReturnType<NpcPresenceStyleRegistry['planCue']>,
    input: ReadDelayEvaluationInput,
  ): number {
    const seed = [input.actorId, input.channelId, input.messageId, behavior].join('|');
    const policy = plannedCue.readPolicy;
    const markWindow = policy?.markReadWindow;
    const window = markWindow ?? (() => {
      switch (behavior) {
        case 'IMMEDIATE':
          return { minMs: 0, maxMs: 180, jitterMs: 25 };
        case 'DELAYED':
          return { minMs: 180, maxMs: 1400, jitterMs: 120 };
        case 'STRATEGIC_DELAY':
          return { minMs: 900, maxMs: 4200, jitterMs: 260 };
        case 'AFTER_COUNTERPLAY_WINDOW':
          return { minMs: 900, maxMs: 2600, jitterMs: 140 };
        case 'AFTER_HELPER_INTERVENTION':
          return { minMs: 220, maxMs: 1300, jitterMs: 100 };
        case 'AFTER_OFFER_REVIEW':
          return { minMs: 1200, maxMs: 6800, jitterMs: 320 };
        case 'AFTER_PRESSURE_SPIKE':
          return { minMs: 450, maxMs: 2200, jitterMs: 160 };
        case 'SHADOW_ONLY':
          return { minMs: 0, maxMs: 0, jitterMs: 0 };
        case 'NEVER_MARK_READ':
        default:
          return { minMs: 0, maxMs: 0, jitterMs: 0 };
      }
    })();

    return this.jitterWithinWindow(seed, window);
  }

  private resolveHoldUnreadMs(
    behavior: ChatPresenceReadBehavior,
    plannedCue: ReturnType<NpcPresenceStyleRegistry['planCue']>,
    input: ReadDelayEvaluationInput,
  ): number {
    const seed = [input.actorId, input.channelId, input.messageId, 'hold', behavior].join('|');
    const holdWindow = plannedCue.readPolicy?.holdUnreadWindow;
    if (holdWindow) {
      return this.jitterWithinWindow(seed, holdWindow);
    }

    switch (behavior) {
      case 'AFTER_OFFER_REVIEW':
        return this.jitterWithinWindow(seed, { minMs: 2400, maxMs: 12000, jitterMs: 420 });
      case 'STRATEGIC_DELAY':
        return this.jitterWithinWindow(seed, { minMs: 1100, maxMs: 5400, jitterMs: 220 });
      case 'SHADOW_ONLY':
      case 'NEVER_MARK_READ':
        return 0;
      default:
        return 0;
    }
  }

  private resolveAdjustments(
    plannedCue: ReturnType<NpcPresenceStyleRegistry['planCue']>,
    input: ReadDelayEvaluationInput,
    baseDelayMs: number,
  ): ReadDelayDebugBreakdown {
    const pressure = clamp(toNumber(input.pressureScore), 0, 100);
    const urgency = clamp(toNumber(input.urgencyScore), 0, 100);
    const rescue = clamp(toNumber(input.rescueRiskScore), 0, 100);
    const crowd = clamp(toNumber(input.crowdHeatScore), 0, 100);
    const negotiation = clamp(toNumber(input.negotiationRiskScore), 0, 100);
    const unread = clamp(toNumber(input.unreadStreak), 0, 12);
    const worldEvent = clamp(toNumber(input.worldEventWeight), 0, 100);

    const pressureAdjustmentMs = Math.round(
      plannedCue.style.actorKind === 'RIVAL'
        ? pressure * 7
        : plannedCue.style.actorKind === 'HELPER'
          ? pressure * -2
          : pressure * 2,
    );

    const urgencyAdjustmentMs = Math.round(
      plannedCue.style.actorKind === 'HELPER' || plannedCue.style.actorKind === 'SYSTEM'
        ? urgency * -6
        : urgency * -1,
    );

    const negotiationAdjustmentMs = Math.round(
      plannedCue.style.actorKind === 'DEAL_AGENT'
        ? negotiation * 14
        : plannedCue.channelProfile.pressureMode === 'DEAL_ROOM'
          ? negotiation * 6
          : 0,
    );

    const rescueAdjustmentMs = Math.round(
      plannedCue.style.actorKind === 'HELPER'
        ? rescue * -7
        : input.helperProtectionWindowActive
          ? -260
          : 0,
    );

    const crowdAdjustmentMs = Math.round(
      plannedCue.channelProfile.pressureMode === 'CROWD'
        ? crowd * 3
        : plannedCue.style.actorKind === 'SPECTATOR_NPC'
          ? crowd * 5
          : 0,
    );

    const unreadAdjustmentMs = Math.round(
      unread * (plannedCue.style.actorKind === 'DEAL_AGENT' || plannedCue.style.actorKind === 'RIVAL' ? 120 : 20),
    );

    const worldEventAdjustmentMs = Math.round(
      plannedCue.style.actorKind === 'LIVEOPS_AGENT' || input.actorKind === 'LIVEOPS'
        ? worldEvent * -3
        : worldEvent * 1,
    );

    const deterministicJitterMs = this.deterministicSignedJitter(
      [input.actorId, input.messageId, input.channelId, String(baseDelayMs)].join('|'),
      180,
    );

    return {
      baseDelayMs,
      pressureAdjustmentMs,
      urgencyAdjustmentMs,
      negotiationAdjustmentMs,
      rescueAdjustmentMs,
      crowdAdjustmentMs,
      unreadAdjustmentMs,
      worldEventAdjustmentMs,
      deterministicJitterMs,
    };
  }

  private resolveReasonCode(
    plannedCue: ReturnType<NpcPresenceStyleRegistry['planCue']>,
    input: ReadDelayEvaluationInput,
    behavior: ChatPresenceReadBehavior,
  ): ReadDelayReasonCode {
    if (plannedCue.visibleToPlayer === false) {
      return 'SHADOW_SUPPRESSED';
    }
    if (input.actorKind === 'SYSTEM' || input.actorKind === 'LIVEOPS') {
      return 'IMMEDIATE_SYSTEM';
    }
    if (input.actorKind === 'HELPER' && (input.helperProtectionWindowActive || toNumber(input.rescueRiskScore) >= 40)) {
      return 'HELPER_GENTLE_DELAY';
    }
    if (input.actorKind === 'DEAL_AGENT') {
      return toNumber(input.negotiationRiskScore) >= 60
        ? 'NEGOTIATION_STALL'
        : 'NEGOTIATION_REVIEW';
    }
    if (input.counterplayWindowOpen || behavior === 'AFTER_COUNTERPLAY_WINDOW') {
      return 'COUNTERPLAY_WINDOW';
    }
    if (input.helperProtectionWindowActive && input.actorKind !== 'HELPER') {
      return 'RESCUE_PROTECTED_WINDOW';
    }
    if (input.worldEventWeight && input.worldEventWeight >= 55) {
      return 'WORLD_EVENT_PULSE';
    }
    if (input.actorKind === 'CROWD' || input.actorKind === 'AMBIENT_NPC') {
      return 'CROWD_WITNESS_DELAY';
    }
    if (input.actorKind === 'HATER') {
      return 'RIVAL_PRESSURE_DELAY';
    }
    return 'DEFAULT_DELAY';
  }

  private shouldSuppressReceipt(
    plannedCue: ReturnType<NpcPresenceStyleRegistry['planCue']>,
    input: ReadDelayEvaluationInput,
    behavior: ChatPresenceReadBehavior,
  ): boolean {
    if (!channelSupportsVisibleReceipt(input.channelId)) {
      return true;
    }
    if (behavior === 'NEVER_MARK_READ' || behavior === 'SHADOW_ONLY') {
      return true;
    }
    if (plannedCue.readPolicy?.maySuppressReadReceipt && input.actorKind === 'DEAL_AGENT') {
      return true;
    }
    if (plannedCue.readPolicy?.maySuppressReadReceipt && input.actorKind === 'HATER' && toNumber(input.negotiationRiskScore) >= 40) {
      return true;
    }
    return false;
  }

  private jitterWithinWindow(
    seed: string,
    window: { minMs: number; maxMs: number; jitterMs?: number },
  ): number {
    const hash = stableHash(seed);
    const min = Math.max(0, Math.round(window.minMs));
    const max = Math.max(min, Math.round(window.maxMs));
    const range = Math.max(0, max - min);
    const offset = range === 0 ? 0 : hash % (range + 1);
    const jitterCap = Math.max(0, Math.round(window.jitterMs ?? 0));
    const signed = jitterCap === 0 ? 0 : (hash % (jitterCap * 2 + 1)) - jitterCap;
    return clamp(min + offset + signed, min, max);
  }

  private deterministicSignedJitter(seed: string, magnitude: number): number {
    const hash = stableHash(seed);
    return magnitude === 0 ? 0 : (hash % (magnitude * 2 + 1)) - magnitude;
  }
}

export function createReadDelayPolicy(options: ReadDelayPolicyOptions = {}): ReadDelayPolicy {
  return new ReadDelayPolicy(options);
}
