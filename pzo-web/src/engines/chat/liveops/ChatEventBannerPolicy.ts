/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT LIVEOPS EVENT BANNER POLICY
 * FILE: pzo-web/src/engines/chat/liveops/ChatEventBannerPolicy.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Queueing and presentation policy for world-event banners that sit above or
 * beside the chat shell.
 *
 * This file does not decide what the world event is. That belongs to shared
 * contracts and the SeasonalChatEventDirector. It decides how event overlays
 * become player-facing banners without creating spam, jitter, or priority drift.
 *
 * Design laws
 * -----------
 * 1. Banner policy is deterministic and side-effect free except for queue state.
 * 2. Severe events preempt soft events, but never erase them silently.
 * 3. Shadow-only events should influence queue posture without necessarily
 *    forcing a visible banner.
 * 4. Sticky banners require explicit acknowledgement or expiry.
 * 5. Quiet periods should collapse the queue quickly and predictably.
 * 6. Whisper-only and helper-blackout events deserve special pacing rules.
 * 7. Queue state is a read model; transcript truth remains elsewhere.
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ============================================================================
 */

import type { ChatBridgeMountTarget } from '../ChatEventBridge';
import type { ChatChannelId } from '../../../../../shared/contracts/chat/ChatChannels';
import type { SeasonalChatEventDirectorSnapshot } from './SeasonalChatEventDirector';
import {
  buildOverlayHeadline,
  buildOverlaySubline,
  buildWorldEventOverlayStack,
  type ChatWorldEventOverlayCard,
  type ChatWorldEventOverlayStack,
} from './WorldEventOverlayPolicy';

export type ChatEventBannerState = 'QUEUED' | 'ACTIVE' | 'ACKNOWLEDGED' | 'EXPIRED';
export type ChatEventBannerKind = 'PRIMARY' | 'SECONDARY' | 'SHADOW' | 'SYSTEM';

export interface ChatEventBannerModel {
  readonly bannerId: string;
  readonly overlayId: string;
  readonly eventId: string;
  readonly kind: ChatEventBannerKind;
  readonly state: ChatEventBannerState;
  readonly headline: string;
  readonly body: string;
  readonly detailLines: readonly string[];
  readonly mounts: readonly ChatBridgeMountTarget[];
  readonly visibleChannels: readonly ChatChannelId[];
  readonly shadowChannels: readonly ChatChannelId[];
  readonly priorityScore: number;
  readonly sticky: boolean;
  readonly dismissible: boolean;
  readonly pulse: boolean;
  readonly helperSuppressed: boolean;
  readonly whisperOnly: boolean;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly ackedAt?: number;
}

export interface ChatEventBannerQueueSnapshot {
  readonly updatedAt: number;
  readonly active: ChatEventBannerModel | null;
  readonly queued: readonly ChatEventBannerModel[];
  readonly shadow: readonly ChatEventBannerModel[];
  readonly helperBlackoutActive: boolean;
  readonly quietWorld: boolean;
  readonly bannerHeadline: string;
  readonly bannerSubline: string;
}

export interface ChatEventBannerPolicyOptions {
  readonly activeBannerMs?: number;
  readonly stickyBannerMs?: number;
  readonly shadowBannerMs?: number;
  readonly dedupeWindowMs?: number;
  readonly maxQueued?: number;
  readonly maxShadowQueued?: number;
}

const DEFAULT_OPTIONS: Required<ChatEventBannerPolicyOptions> = {
  activeBannerMs: 8_000,
  stickyBannerMs: 18_000,
  shadowBannerMs: 6_000,
  dedupeWindowMs: 45_000,
  maxQueued: 6,
  maxShadowQueued: 4,
};

function nowMs(): number {
  return Date.now();
}

function buildBannerKind(card: ChatWorldEventOverlayCard): ChatEventBannerKind {
  if (card.whisperOnly || card.visibilityMode === 'SHADOW_ONLY') {
    return 'SHADOW';
  }
  if (card.sticky) {
    return 'PRIMARY';
  }
  return 'SECONDARY';
}

function buildBannerModel(card: ChatWorldEventOverlayCard, createdAt: number, options: Required<ChatEventBannerPolicyOptions>): ChatEventBannerModel {
  const lifetime = card.sticky ? options.stickyBannerMs : (card.whisperOnly ? options.shadowBannerMs : options.activeBannerMs);
  return {
    bannerId: `banner:${card.overlayId}:${createdAt}`,
    overlayId: card.overlayId,
    eventId: card.eventId,
    kind: buildBannerKind(card),
    state: 'QUEUED',
    headline: card.headline,
    body: card.body,
    detailLines: card.detailLines,
    mounts: card.mounts,
    visibleChannels: card.visibleChannels,
    shadowChannels: card.shadowChannels,
    priorityScore: card.priorityScore,
    sticky: card.sticky,
    dismissible: card.dismissible,
    pulse: card.shouldPulse,
    helperSuppressed: card.helperSuppressed,
    whisperOnly: card.whisperOnly,
    createdAt,
    expiresAt: createdAt + lifetime,
  };
}

function sortBanners(left: ChatEventBannerModel, right: ChatEventBannerModel): number {
  return (right.priorityScore - left.priorityScore)
    || (Number(right.sticky) - Number(left.sticky))
    || (right.createdAt - left.createdAt);
}

function withinDedupeWindow(left: ChatEventBannerModel, right: ChatEventBannerModel, dedupeWindowMs: number): boolean {
  return left.eventId === right.eventId
    && Math.abs(left.createdAt - right.createdAt) <= dedupeWindowMs;
}

export class ChatEventBannerPolicy {
  private readonly options: Required<ChatEventBannerPolicyOptions>;
  private snapshot: ChatEventBannerQueueSnapshot;

  public constructor(options: ChatEventBannerPolicyOptions = {}) {
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
    };

    this.snapshot = {
      updatedAt: nowMs(),
      active: null,
      queued: [],
      shadow: [],
      helperBlackoutActive: false,
      quietWorld: true,
      bannerHeadline: 'World pressure stable',
      bannerSubline: 'No active liveops surge.',
    };
  }

  public ingest(snapshot: SeasonalChatEventDirectorSnapshot): ChatEventBannerQueueSnapshot {
    const stack = buildWorldEventOverlayStack(snapshot);
    const timestamp = snapshot.now;

    const newPublicBanners = [stack.primary, ...stack.secondary]
      .filter(Boolean)
      .map((card) => buildBannerModel(card as ChatWorldEventOverlayCard, timestamp, this.options));

    const newShadowBanners = stack.shadow
      .map((card) => buildBannerModel(card, timestamp, this.options));

    const queued = this.mergeQueued(this.snapshot.active, this.snapshot.queued, newPublicBanners, this.options.maxQueued);
    const shadow = this.mergeShadow(this.snapshot.shadow, newShadowBanners);
    const active = this.resolveActive(this.snapshot.active, queued, timestamp);

    this.snapshot = {
      updatedAt: timestamp,
      active,
      queued: queued.filter((banner) => active?.bannerId !== banner.bannerId),
      shadow,
      helperBlackoutActive: stack.helperBlackoutActive,
      quietWorld: stack.quietWorld,
      bannerHeadline: buildOverlayHeadline(snapshot.summary, stack),
      bannerSubline: buildOverlaySubline(snapshot.summary, stack),
    };

    return this.snapshot;
  }

  public acknowledge(bannerId: string, acknowledgedAt: number = nowMs()): ChatEventBannerQueueSnapshot {
    const active = this.snapshot.active;
    if (!active || active.bannerId !== bannerId) {
      return this.snapshot;
    }

    const acknowledged: ChatEventBannerModel = {
      ...active,
      state: 'ACKNOWLEDGED',
      ackedAt: acknowledgedAt,
      expiresAt: acknowledgedAt,
    };

    const nextQueued = [...this.snapshot.queued];
    const nextActive = this.resolveActive(acknowledged, nextQueued, acknowledgedAt);

    this.snapshot = {
      ...this.snapshot,
      updatedAt: acknowledgedAt,
      active: nextActive,
      queued: nextQueued.filter((banner) => nextActive?.bannerId !== banner.bannerId),
    };

    return this.snapshot;
  }

  public expire(now: number = nowMs()): ChatEventBannerQueueSnapshot {
    const active = this.snapshot.active && this.snapshot.active.expiresAt > now
      ? this.snapshot.active
      : null;

    const queued = this.snapshot.queued.filter((banner) => banner.expiresAt > now);
    const shadow = this.snapshot.shadow.filter((banner) => banner.expiresAt > now);

    const nextActive = this.resolveActive(active, queued, now);

    this.snapshot = {
      ...this.snapshot,
      updatedAt: now,
      active: nextActive,
      queued: queued.filter((banner) => nextActive?.bannerId !== banner.bannerId),
      shadow,
    };

    return this.snapshot;
  }

  public clear(): ChatEventBannerQueueSnapshot {
    this.snapshot = {
      updatedAt: nowMs(),
      active: null,
      queued: [],
      shadow: [],
      helperBlackoutActive: false,
      quietWorld: true,
      bannerHeadline: 'World pressure stable',
      bannerSubline: 'No active liveops surge.',
    };
    return this.snapshot;
  }

  public getSnapshot(): ChatEventBannerQueueSnapshot {
    return this.snapshot;
  }

  private mergeQueued(
    active: ChatEventBannerModel | null,
    existing: readonly ChatEventBannerModel[],
    incoming: readonly ChatEventBannerModel[],
    maxQueued: number,
  ): ChatEventBannerModel[] {
    const merged = [...existing];

    for (const banner of incoming) {
      if (active && withinDedupeWindow(active, banner, this.options.dedupeWindowMs)) {
        continue;
      }
      if (merged.some((entry) => withinDedupeWindow(entry, banner, this.options.dedupeWindowMs))) {
        continue;
      }
      merged.push(banner);
    }

    return merged
      .filter((banner) => banner.kind !== 'SHADOW')
      .sort(sortBanners)
      .slice(0, maxQueued);
  }

  private mergeShadow(existing: readonly ChatEventBannerModel[], incoming: readonly ChatEventBannerModel[]): readonly ChatEventBannerModel[] {
    const merged = [...existing];
    for (const banner of incoming) {
      if (merged.some((entry) => withinDedupeWindow(entry, banner, this.options.dedupeWindowMs))) {
        continue;
      }
      merged.push(banner);
    }
    return merged
      .filter((banner) => banner.kind === 'SHADOW')
      .sort(sortBanners)
      .slice(0, this.options.maxShadowQueued);
  }

  private resolveActive(
    currentActive: ChatEventBannerModel | null,
    queued: readonly ChatEventBannerModel[],
    timestamp: number,
  ): ChatEventBannerModel | null {
    if (currentActive && currentActive.expiresAt > timestamp && currentActive.state !== 'ACKNOWLEDGED') {
      const higherPriorityQueued = queued[0];
      if (!higherPriorityQueued || higherPriorityQueued.priorityScore <= currentActive.priorityScore || currentActive.sticky) {
        return currentActive;
      }
    }

    const next = queued[0];
    if (!next) {
      return null;
    }

    return {
      ...next,
      state: 'ACTIVE',
    };
  }
}

export function createChatEventBannerPolicy(options: ChatEventBannerPolicyOptions = {}): ChatEventBannerPolicy {
  return new ChatEventBannerPolicy(options);
}

export function buildBannerQueueSnapshot(
  directorSnapshot: SeasonalChatEventDirectorSnapshot,
  options: ChatEventBannerPolicyOptions = {},
): ChatEventBannerQueueSnapshot {
  const policy = new ChatEventBannerPolicy(options);
  return policy.ingest(directorSnapshot);
}
