/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT COUNTERPLAY BRIDGE
 * FILE: pzo-web/src/engines/chat/combat/ChatCounterplayBridge.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Connects chat boss-fight planning to the live frontend chat state.
 *
 * This bridge is intentionally state-centric. It does not own the entire chat
 * engine; it uses the existing ChatState helpers so combat sequencing flows
 * through the same transcript, scene, silence, reveal, and relationship lanes
 * already used by the rest of the chat runtime.
 *
 * Responsibilities
 * ----------------
 * - open conversational boss fights from game/chat signals,
 * - stage system / hater / helper / crowd beats into the visible transcript,
 * - store pending reveal payloads keyed to ChatState reveal schedules,
 * - accept player replies during counter windows,
 * - resolve success, weakness, failure, and expiry,
 * - keep composer, scene, silence, and relationship state in sync.
 *
 * This file is frontend-responsive and non-authoritative. Backend combat logic
 * will later confirm authoritative outcomes. Until then, this bridge gives the
 * player a coherent local encounter that respects the repo's present runtime.
 * ============================================================================
 */

import {
  beginSilenceInState,
  endSilenceInState,
  popDueRevealsFromState,
  pushMessageToState,
  scheduleRevealInState,
  setActiveSceneInState,
  setAudienceHeatInState,
  setChannelMoodInState,
  setComposerDisabledInState,
  upsertRelationshipInState,
} from '../ChatState';
import type {
  ChatEngineState,
  ChatMessage,
  ChatRelationshipState,
  ChatRevealSchedule,
  ChatVisibleChannel,
  UnixMs,
} from '../types';
import {
  ChatBossFightController,
  applyRelationshipDelta,
  createChatBossFightController,
  type ChatBossFightControllerOptions,
  type ChatBossFightDescriptor,
  type ChatBossFightPlan,
  type ChatBossFightPlanningInput,
  type ChatBossFightReplyInput,
  type ChatBossFightResolution,
  type ChatCounterIntent,
  type ChatCounterQuality,
} from './ChatBossFightController';

// ============================================================================
// MARK: Public contracts
// ============================================================================

export interface ChatCounterplayBridgeOpenInput extends ChatBossFightPlanningInput {
  readonly state: ChatEngineState;
}

export interface ChatCounterplayBridgeReplyInput {
  readonly state: ChatEngineState;
  readonly playerMessage: ChatMessage;
  readonly now?: UnixMs;
}

export interface ChatCounterplayBridgeTickInput {
  readonly state: ChatEngineState;
  readonly now?: UnixMs;
}

export interface ChatCounterplayBridgeApplyResult {
  readonly state: ChatEngineState;
  readonly openedFightId?: string;
  readonly resolvedFightId?: string;
  readonly resolutionQuality?: ChatCounterQuality;
  readonly resolutionIntent?: ChatCounterIntent;
  readonly notes: readonly string[];
}

export interface ChatCounterplayBridgeTickResult {
  readonly state: ChatEngineState;
  readonly flushedReveals: readonly ChatRevealSchedule[];
  readonly expiredFightIds: readonly string[];
  readonly notes: readonly string[];
}

export interface ChatCounterplayBridgeSnapshot {
  readonly active: readonly ChatCounterplayActiveFightSnapshot[];
  readonly revealPayloads: readonly ChatCounterplayRevealPayloadSnapshot[];
}

export interface ChatCounterplayActiveFightSnapshot {
  readonly descriptor: ChatBossFightDescriptor;
  readonly counterWindow: {
    readonly opensAt: number;
    readonly closesAt: number;
    readonly reason: 'OFFER_BAIT' | 'HATER_TELEGRAPH' | 'DEAL_ROOM_TRAP';
    readonly playerFacingHint?: string;
  };
  readonly createdAt: number;
  readonly lastUpdatedAt: number;
  readonly sceneSettled: boolean;
}

export interface ChatCounterplayRevealPayloadSnapshot {
  readonly revealReason: ChatRevealSchedule['revealReason'];
  readonly revealAt: number;
  readonly payloadRef: string;
  readonly channel: ChatVisibleChannel;
  readonly message: ChatMessage;
}

export interface ChatCounterplayBridgeOptions {
  readonly controller?: ChatBossFightController;
  readonly controllerOptions?: ChatBossFightControllerOptions;
  readonly now?: () => number;
}

// ============================================================================
// MARK: Internal state
// ============================================================================

interface ActiveFightRecord {
  readonly descriptor: ChatBossFightDescriptor;
  readonly counterWindow: ChatBossFightPlan['counterWindow'];
  readonly createdAt: UnixMs;
  readonly lastUpdatedAt: UnixMs;
  readonly sceneSettled: boolean;
}

interface RevealPayloadRecord {
  readonly schedule: ChatRevealSchedule;
  readonly message: ChatMessage;
}

// ============================================================================
// MARK: Bridge
// ============================================================================

export class ChatCounterplayBridge {
  private readonly controller: ChatBossFightController;
  private readonly nowFn: () => number;
  private readonly activeFights = new Map<string, ActiveFightRecord>();
  private readonly revealPayloads = new Map<string, RevealPayloadRecord>();

  constructor(options: ChatCounterplayBridgeOptions = {}) {
    this.nowFn = options.now ?? (() => Date.now());
    this.controller = options.controller ?? createChatBossFightController(options.controllerOptions);
  }

  openEncounter(input: ChatCounterplayBridgeOpenInput): ChatCounterplayBridgeApplyResult {
    const plan = this.controller.planEncounter(input);
    const now = (input.now ?? this.nowFn()) as UnixMs;

    let next = input.state;
    next = this.applyPlan(next, plan, now);

    this.activeFights.set(plan.descriptor.fightId, {
      descriptor: plan.descriptor,
      counterWindow: plan.counterWindow,
      createdAt: now,
      lastUpdatedAt: now,
      sceneSettled: false,
    });

    return {
      state: next,
      openedFightId: plan.descriptor.fightId,
      notes: [
        ...plan.notes,
        `fight-opened:${plan.descriptor.fightId}`,
      ],
    };
  }

  ingestPlayerReply(input: ChatCounterplayBridgeReplyInput): ChatCounterplayBridgeApplyResult {
    const now = (input.now ?? this.nowFn()) as UnixMs;
    const active = this.findFightForPlayerMessage(input.playerMessage, now);

    if (!active) {
      return {
        state: input.state,
        notes: ['no-active-fight-for-message'],
      };
    }

    const resolution = this.controller.evaluateReply({
      descriptor: active.descriptor,
      counterWindow: active.counterWindow,
      playerMessage: input.playerMessage,
      state: input.state,
      now,
    });

    let next = input.state;
    next = this.applyResolution(next, resolution, now);

    this.removeFight(active.descriptor.fightId);

    return {
      state: next,
      resolvedFightId: active.descriptor.fightId,
      resolutionQuality: resolution.quality,
      resolutionIntent: resolution.intent,
      notes: [
        ...resolution.notes,
        `fight-resolved:${active.descriptor.fightId}`,
      ],
    };
  }

  tick(input: ChatCounterplayBridgeTickInput): ChatCounterplayBridgeTickResult {
    const now = (input.now ?? this.nowFn()) as UnixMs;
    let next = input.state;
    const notes: string[] = [];
    const expiredFightIds: string[] = [];

    for (const [fightId, record] of [...this.activeFights.entries()]) {
      if (now <= record.counterWindow.closesAt) continue;

      const resolution = this.controller.resolveExpiry({
        descriptor: record.descriptor,
        counterWindow: record.counterWindow,
        state: next,
        now,
      });

      next = this.applyResolution(next, resolution, now);
      this.removeFight(fightId);
      expiredFightIds.push(fightId);
      notes.push(`fight-expired:${fightId}`);
    }

    const popped = popDueRevealsFromState(next, now);
    next = popped.state;

    for (const due of popped.due) {
      const payload = this.revealPayloads.get(due.payloadRef);
      if (!payload) {
        notes.push(`missing-reveal-payload:${due.payloadRef}`);
        continue;
      }

      next = pushMessageToState(next, {
        channelId: payload.message.channel,
        message: payload.message,
        markUnreadWhenBackgrounded: true,
      });

      this.revealPayloads.delete(due.payloadRef);
      notes.push(`flushed-reveal:${due.payloadRef}`);
    }

    if (popped.due.length > 0 && next.currentSilence && this.shouldBreakSilenceFromReveal(popped.due)) {
      next = endSilenceInState(next);
      next = setComposerDisabledInState(next, false);
      notes.push('silence-ended-after-reveal');
    }

    return {
      state: next,
      flushedReveals: popped.due,
      expiredFightIds,
      notes,
    };
  }

  snapshot(): ChatCounterplayBridgeSnapshot {
    return {
      active: [...this.activeFights.values()].map((record) => ({
        descriptor: record.descriptor,
        counterWindow: {
          opensAt: record.counterWindow.opensAt,
          closesAt: record.counterWindow.closesAt,
          reason: record.counterWindow.reason,
          playerFacingHint: record.counterWindow.playerFacingHint,
        },
        createdAt: record.createdAt,
        lastUpdatedAt: record.lastUpdatedAt,
        sceneSettled: record.sceneSettled,
      })),
      revealPayloads: [...this.revealPayloads.values()].map((payload) => ({
        revealReason: payload.schedule.revealReason,
        revealAt: payload.schedule.revealAt,
        payloadRef: payload.schedule.payloadRef,
        channel: payload.message.channel,
        message: payload.message,
      })),
    };
  }

  hydrate(snapshot: ChatCounterplayBridgeSnapshot): void {
    this.activeFights.clear();
    this.revealPayloads.clear();

    for (const fight of snapshot.active) {
      this.activeFights.set(fight.descriptor.fightId, {
        descriptor: fight.descriptor,
        counterWindow: {
          opensAt: fight.counterWindow.opensAt as UnixMs,
          closesAt: fight.counterWindow.closesAt as UnixMs,
          reason: fight.counterWindow.reason,
          playerFacingHint: fight.counterWindow.playerFacingHint,
        },
        createdAt: fight.createdAt as UnixMs,
        lastUpdatedAt: fight.lastUpdatedAt as UnixMs,
        sceneSettled: fight.sceneSettled,
      });
    }

    for (const payload of snapshot.revealPayloads) {
      this.revealPayloads.set(payload.payloadRef, {
        schedule: {
          revealAt: payload.revealAt as UnixMs,
          revealChannel: payload.channel,
          revealReason: payload.revealReason,
          payloadRef: payload.payloadRef,
        },
        message: payload.message,
      });
    }
  }

  getActiveFight(fightId: string): ChatCounterplayActiveFightSnapshot | undefined {
    const record = this.activeFights.get(fightId);
    if (!record) return undefined;
    return {
      descriptor: record.descriptor,
      counterWindow: {
        opensAt: record.counterWindow.opensAt,
        closesAt: record.counterWindow.closesAt,
        reason: record.counterWindow.reason,
        playerFacingHint: record.counterWindow.playerFacingHint,
      },
      createdAt: record.createdAt,
      lastUpdatedAt: record.lastUpdatedAt,
      sceneSettled: record.sceneSettled,
    };
  }

  listActiveFights(): readonly ChatCounterplayActiveFightSnapshot[] {
    return this.snapshot().active;
  }

  clear(): void {
    this.activeFights.clear();
    this.revealPayloads.clear();
  }

  private applyPlan(state: ChatEngineState, plan: ChatBossFightPlan, now: UnixMs): ChatEngineState {
    let next = state;

    next = setActiveSceneInState(next, plan.scene);
    next = setComposerDisabledInState(next, false);

    if (plan.silence?.enforced) {
      next = beginSilenceInState(next, plan.silence);
      next = setComposerDisabledInState(next, true, 'Counterplay window staging. Hold the line.');
    }

    for (const message of plan.immediateMessages) {
      next = pushMessageToState(next, {
        channelId: message.channel,
        message,
        markUnreadWhenBackgrounded: true,
      });
    }

    for (const delayed of plan.delayedMessages) {
      this.revealPayloads.set(delayed.schedule.payloadRef, {
        schedule: delayed.schedule,
        message: delayed.message,
      });
      next = scheduleRevealInState(next, delayed.schedule);
    }

    if (plan.audienceHeatPatch) {
      for (const [channelId, patch] of Object.entries(plan.audienceHeatPatch) as Array<[
        ChatVisibleChannel,
        NonNullable<ChatBossFightPlan['audienceHeatPatch']>[ChatVisibleChannel]
      ]>) {
        if (!patch) continue;
        next = setAudienceHeatInState(next, channelId, patch);
      }
    }

    if (plan.moodPatch) {
      for (const mood of plan.moodPatch) {
        next = setChannelMoodInState(next, mood.channelId, mood.mood, mood.reason, mood.updatedAt);
      }
    }

    this.markSceneSettled(plan.descriptor.fightId, false, now);
    return next;
  }

  private applyResolution(
    state: ChatEngineState,
    resolution: ChatBossFightResolution,
    now: UnixMs,
  ): ChatEngineState {
    let next = state;

    if (next.currentSilence) {
      next = endSilenceInState(next);
    }
    next = setComposerDisabledInState(next, false);

    for (const message of resolution.immediateMessages) {
      next = pushMessageToState(next, {
        channelId: message.channel,
        message,
        markUnreadWhenBackgrounded: true,
      });
    }

    for (const delayed of resolution.delayedMessages) {
      this.revealPayloads.set(delayed.schedule.payloadRef, {
        schedule: delayed.schedule,
        message: delayed.message,
      });
      next = scheduleRevealInState(next, delayed.schedule);
    }

    if (resolution.audienceHeatPatch) {
      for (const [channelId, patch] of Object.entries(resolution.audienceHeatPatch) as Array<[
        ChatVisibleChannel,
        NonNullable<ChatBossFightResolution['audienceHeatPatch']>[ChatVisibleChannel]
      ]>) {
        if (!patch) continue;
        next = setAudienceHeatInState(next, channelId, patch);
      }
    }

    if (resolution.moodPatch) {
      for (const mood of resolution.moodPatch) {
        next = setChannelMoodInState(next, mood.channelId, mood.mood, mood.reason, mood.updatedAt);
      }
    }

    if (resolution.relationshipShift?.length) {
      next = this.applyRelationshipShift(next, resolution.relationshipShift, now);
    }

    if (resolution.sceneComplete) {
      next = setActiveSceneInState(next, undefined);
    }

    return next;
  }

  private applyRelationshipShift(
    state: ChatEngineState,
    deltas: readonly NonNullable<ChatBossFightResolution['relationshipShift']>[number][],
    now: UnixMs,
  ): ChatEngineState {
    let next = state;

    for (const delta of deltas) {
      const existing = next.relationshipsByCounterpartId[delta.counterpartId];
      const base = existing ?? this.buildDefaultRelationship(delta.counterpartId, now);
      const updated = applyRelationshipDelta(base, delta, now);
      next = upsertRelationshipInState(next, updated);
    }

    return next;
  }

  private buildDefaultRelationship(counterpartId: string, now: UnixMs): ChatRelationshipState {
    return {
      relationshipId: (`relationship:${counterpartId}`) as ChatRelationshipState['relationshipId'],
      playerId: 'player:self' as ChatRelationshipState['playerId'],
      counterpartId,
      counterpartKind: counterpartId.includes('helper') ? 'HELPER' : 'HATER',
      vector: {
        respect: 25 as ChatRelationshipState['vector']['respect'],
        fear: 20 as ChatRelationshipState['vector']['fear'],
        contempt: 20 as ChatRelationshipState['vector']['contempt'],
        fascination: 15 as ChatRelationshipState['vector']['fascination'],
        trust: counterpartId.includes('helper') ? (40 as ChatRelationshipState['vector']['trust']) : (5 as ChatRelationshipState['vector']['trust']),
        familiarity: 10 as ChatRelationshipState['vector']['familiarity'],
        rivalryIntensity: counterpartId.includes('helper') ? (0 as ChatRelationshipState['vector']['rivalryIntensity']) : (20 as ChatRelationshipState['vector']['rivalryIntensity']),
        rescueDebt: 0 as ChatRelationshipState['vector']['rescueDebt'],
        adviceObedience: 25 as ChatRelationshipState['vector']['adviceObedience'],
      },
      lastMeaningfulShiftAt: now,
      callbacksAvailable: [],
      escalationTier: 'MILD',
    };
  }

  private findFightForPlayerMessage(message: ChatMessage, now: UnixMs): ActiveFightRecord | undefined {
    const sceneId = message.sceneId;

    if (sceneId) {
      for (const record of this.activeFights.values()) {
        if (record.descriptor.sceneId === sceneId) return record;
      }
    }

    const inChannel = [...this.activeFights.values()]
      .filter((record) => record.descriptor.channel === message.channel)
      .sort((a, b) => b.createdAt - a.createdAt);

    for (const record of inChannel) {
      if (now < record.counterWindow.opensAt) continue;
      if (now > record.counterWindow.closesAt + 350) continue;
      return record;
    }

    return undefined;
  }

  private shouldBreakSilenceFromReveal(reveals: readonly ChatRevealSchedule[]): boolean {
    return reveals.some((reveal) => reveal.revealReason === 'DELAYED_HELPER' || reveal.revealReason === 'SCENE_STAGING');
  }

  private markSceneSettled(fightId: string, sceneSettled: boolean, now: UnixMs): void {
    const existing = this.activeFights.get(fightId);
    if (!existing) return;
    this.activeFights.set(fightId, {
      ...existing,
      sceneSettled,
      lastUpdatedAt: now,
    });
  }

  private removeFight(fightId: string): void {
    const existing = this.activeFights.get(fightId);
    if (existing) {
      for (const [payloadRef, payload] of [...this.revealPayloads.entries()]) {
        if (payload.message.sceneId === existing.descriptor.sceneId) {
          this.revealPayloads.delete(payloadRef);
        }
      }
    }
    this.activeFights.delete(fightId);
  }
}

export function createChatCounterplayBridge(
  options: ChatCounterplayBridgeOptions = {},
): ChatCounterplayBridge {
  return new ChatCounterplayBridge(options);
}

// ============================================================================
// MARK: End
// ============================================================================
