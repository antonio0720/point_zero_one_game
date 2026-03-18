/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT ENGINE PHASE 1 BRIDGE
 * FILE: pzo-web/src/engines/chat/phase1/ChatEnginePhaseOneBridge.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Bridge between the existing backend ChatEngine.ts and the new Phase 1
 * novelty / episodic memory stack.
 *
 * This file is deliberately additive:
 * - it does not assume reducer ownership
 * - it does not rewrite the existing engine
 * - it expects ChatEngine.ts to call into it at four safe seams:
 *   1) constructor hydration
 *   2) committed message append
 *   3) reaction candidate ranking
 *   4) periodic / authoritative sync
 * ============================================================================
 */

import type {
  ChatMessage,
  ChatScenePlan,
  ChatUpstreamSignal,
  ChatVisibleChannel,
  UnixMs,
} from '../types';

import type { BotId } from '../../battle/types';

import {
  ChatNoveltyLedger,
  type ChatNoveltyLedgerCandidate,
  type ChatNoveltyLedgerScore,
} from '../intelligence/ChatNoveltyLedger';

import {
  ChatEpisodicMemory,
  type ChatEpisodicCallbackCandidate,
} from '../intelligence/ChatEpisodicMemory';

import {
  type ChatStateWithPhaseOne,
  applyConversationalFingerprintDeltaInState,
  getPhaseOneState,
  notePhaseOneCarryoverSummaryInState,
  
  setPhaseOneEpisodicMemoryInState,
  setPhaseOneNoveltyLedgerInState,
  setPhaseOneRecommendedCandidateIdInState,
} from './ChatStatePhaseOne';

export interface ChatEnginePhaseOneBridgeOptions {
  readonly playerId?: string;
  readonly now?: UnixMs;
}

export interface ChatPhaseOneResponseCandidate extends ChatNoveltyLedgerCandidate {
  readonly callbackCandidates?: readonly ChatEpisodicCallbackCandidate[];
  readonly baseWeight01?: number;
}

export interface ChatPhaseOneRankedCandidate {
  readonly candidateId: string;
  readonly novelty: ChatNoveltyLedgerScore;
  readonly callback?: ChatEpisodicCallbackCandidate;
  readonly compositeScore01: number;
  readonly notes: readonly string[];
}

export class ChatEnginePhaseOneBridge {
  private readonly novelty: ChatNoveltyLedger;
  private readonly memory: ChatEpisodicMemory;
  private readonly playerId?: string;
  private hydrated = false;

  public constructor(options: ChatEnginePhaseOneBridgeOptions = {}) {
    const now = options.now ?? (Date.now() as UnixMs);
    this.playerId = options.playerId;
    this.novelty = new ChatNoveltyLedger({}, now);
    this.memory = new ChatEpisodicMemory({}, now);
  }

  public hydrateFromState(state: ChatStateWithPhaseOne): void {
    const phaseOne = getPhaseOneState(state);
    if (phaseOne.noveltyLedger) this.novelty.restore(phaseOne.noveltyLedger);
    if (phaseOne.episodicMemory) this.memory.restore(phaseOne.episodicMemory);
    this.hydrated = true;
  }

  public ensureHydrated(state: ChatStateWithPhaseOne): void {
    if (this.hydrated) return;
    this.hydrateFromState(state);
  }

  public noteCommittedMessage(
    state: ChatStateWithPhaseOne,
    message: ChatMessage,
    now: UnixMs = message.ts as UnixMs,
  ): ChatStateWithPhaseOne {
    this.ensureHydrated(state);
    this.novelty.noteMessage(message, now);
    this.memory.noteMessage(message, now);

    let next = state;
    next = setPhaseOneNoveltyLedgerInState(next, this.novelty.snapshot(now), now);
    next = setPhaseOneEpisodicMemoryInState(next, this.memory.snapshot(), now);

    const fingerprintDelta = this.deriveFingerprintDeltaFromMessage(message, now);
    next = applyConversationalFingerprintDeltaInState(next, fingerprintDelta, now);
    next = notePhaseOneCarryoverSummaryInState(next, this.memory.buildCarryoverSummary(), now);
    return next;
  }

  public noteScene(
    state: ChatStateWithPhaseOne,
    scene: ChatScenePlan,
    summary: string,
    now: UnixMs = scene.startedAt,
  ): ChatStateWithPhaseOne {
    this.ensureHydrated(state);
    this.novelty.noteScene(scene, scene.primaryChannel, now);
    this.memory.noteScene(scene, summary, now);

    let next = state;
    next = setPhaseOneNoveltyLedgerInState(next, this.novelty.snapshot(now), now);
    next = setPhaseOneEpisodicMemoryInState(next, this.memory.snapshot(), now);
    next = notePhaseOneCarryoverSummaryInState(next, this.memory.buildCarryoverSummary(), now);
    return next;
  }

  public noteSignal(
    state: ChatStateWithPhaseOne,
    signal: ChatUpstreamSignal,
    now: UnixMs = signal.emittedAt,
  ): ChatStateWithPhaseOne {
    this.ensureHydrated(state);

    const summary = this.describeSignal(signal);
    if (!summary) return state;

    this.memory.recordEvent(summary.eventType, {
      roomId: null,
      channelId: summary.channelId,
      summary: summary.summary,
      rawText: summary.summary,
      botId: summary.botId ?? null,
      counterpartId: summary.counterpartId ?? null,
      pressureBand: summary.pressureBand,
      tags: ['signal', String(signal.signalType).toLowerCase()],
    }, now);

    let next = state;
    next = setPhaseOneEpisodicMemoryInState(next, this.memory.snapshot(), now);
    next = notePhaseOneCarryoverSummaryInState(next, this.memory.buildCarryoverSummary(), now);
    return next;
  }

  public rankResponseCandidates(
    state: ChatStateWithPhaseOne,
    candidates: readonly ChatPhaseOneResponseCandidate[],
    channelId: ChatVisibleChannel,
    sceneRole: string | null,
    now: UnixMs = Date.now() as UnixMs,
  ): readonly ChatPhaseOneRankedCandidate[] {
    this.ensureHydrated(state);
    const novelty = this.novelty.rankCandidates(candidates, now);

    const ranked = novelty.map((noveltyScore) => {
      const candidate = candidates.find((item) => item.candidateId === noveltyScore.candidateId);
      const callback = candidate?.callbackCandidates?.[0] ??
        this.memory.queryCallbacks({
          botId: candidate?.botId,
          counterpartId: candidate?.counterpartId ?? null,
          roomId: candidate?.roomId ?? null,
          channelId,
          sceneRole,
          maxResults: 1,
        })[0];

      let composite = noveltyScore.noveltyScore01;
      composite += (candidate?.baseWeight01 ?? 0) * 0.25;
      composite += (callback?.score01 ?? 0) * 0.20;

      const notes = [...noveltyScore.notes];
      if (callback) notes.push(`callback:${callback.eventType.toLowerCase()}`);

      return {
        candidateId: noveltyScore.candidateId,
        novelty: noveltyScore,
        callback,
        compositeScore01: Math.max(0, Math.min(1, Number(composite.toFixed(6)))),
        notes,
      };
    }).sort((a, b) => b.compositeScore01 - a.compositeScore01 || a.candidateId.localeCompare(b.candidateId));

    return ranked;
  }

  public syncIntoState(
    state: ChatStateWithPhaseOne,
    recommendedCandidateId: string | undefined,
    now: UnixMs = Date.now() as UnixMs,
  ): ChatStateWithPhaseOne {
    this.ensureHydrated(state);
    let next = state;
    next = setPhaseOneNoveltyLedgerInState(next, this.novelty.snapshot(now), now);
    next = setPhaseOneEpisodicMemoryInState(next, this.memory.snapshot(), now);
    next = setPhaseOneRecommendedCandidateIdInState(next, recommendedCandidateId, now);
    next = notePhaseOneCarryoverSummaryInState(next, this.memory.buildCarryoverSummary(), now);
    return next;
  }

  public markCallbackUsed(
    state: ChatStateWithPhaseOne,
    memoryId: string,
    callbackId?: string,
    now: UnixMs = Date.now() as UnixMs,
  ): ChatStateWithPhaseOne {
    this.ensureHydrated(state);
    this.memory.markReused(memoryId, callbackId, now);
    return setPhaseOneEpisodicMemoryInState(state, this.memory.snapshot(), now);
  }

  private deriveFingerprintDeltaFromMessage(
    message: ChatMessage,
    now: UnixMs,
  ): Partial<ReturnType<typeof getPhaseOneState>['conversationalFingerprint']> {
    const body = String(message.body ?? '').toLowerCase();
    const activeChannel = message.channel;
    const tags = new Set((message.tags ?? []).map((item) => String(item).toLowerCase()));
    const base = {
      noveltySeeking01: 0.50,
      stabilitySeeking01: 0.50,
    };

    return {
      impulsive01: body.length < 28 ? 0.52 : undefined,
      patient01: body.length > 72 ? 0.64 : undefined,
      greedy01: tags.has('offer') || activeChannel === 'DEAL_ROOM' ? 0.58 : undefined,
      defensive01: tags.has('shield') || body.includes('hold') ? 0.62 : undefined,
      bluffHeavy01: body.includes('bluff') || body.includes('think') ? 0.57 : undefined,
      literal01: body.includes('proof') || body.includes('show') ? 0.68 : undefined,
      publicPerformer01: activeChannel === 'GLOBAL' || activeChannel === 'LOBBY' ? 0.60 : undefined,
      silentOperator01: activeChannel === 'SYNDICATE' ? 0.64 : undefined,
      procedureAware01: body.includes('review') || body.includes('terms') || body.includes('sequence') ? 0.72 : undefined,
      noveltySeeking01: base.noveltySeeking01,
      stabilitySeeking01: base.stabilitySeeking01,
      updatedAt: now,
    };
  }

  private describeSignal(signal: ChatUpstreamSignal): {
    readonly eventType: Parameters<ChatEpisodicMemory['recordEvent']>[0];
    readonly summary: string;
    readonly channelId?: ChatVisibleChannel;
    readonly botId?: BotId | string | null;
    readonly counterpartId?: string | null;
    readonly pressureBand?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  } | null {
    switch (signal.signalType) {
      case 'SHIELD_LAYER_BREACHED':
        return {
          eventType: 'BREACH',
          summary: `Shield layer ${'layerId' in signal ? signal.layerId : 'unknown'} breached.`,
          channelId: 'GLOBAL',
          pressureBand: 'HIGH',
        };
      case 'BOT_ATTACK_FIRED':
        return {
          eventType: 'PUBLIC_WITNESS',
          summary: `Bot attack fired by ${'botId' in signal ? String(signal.botId) : 'unknown'}.`,
          channelId: 'GLOBAL',
          botId: 'botId' in signal ? signal.botId : null,
          pressureBand: 'HIGH',
        };
      case 'CASCADE_CHAIN_STARTED':
        return {
          eventType: 'COLLAPSE',
          summary: `Cascade chain ${'chainId' in signal ? signal.chainId : 'unknown'} started.`,
          channelId: 'GLOBAL',
          pressureBand: 'CRITICAL',
        };
      case 'CASCADE_CHAIN_BROKEN':
        return {
          eventType: 'COMEBACK',
          summary: `Cascade chain ${'chainId' in signal ? signal.chainId : 'unknown'} broken.`,
          channelId: 'GLOBAL',
          pressureBand: 'MEDIUM',
        };
      case 'SOVEREIGNTY_ACHIEVED':
        return {
          eventType: 'SOVEREIGNTY',
          summary: 'Sovereignty achieved.',
          channelId: 'GLOBAL',
          pressureBand: 'LOW',
        };
      default:
        return null;
    }
  }
}

export function createChatEnginePhaseOneBridge(
  options: ChatEnginePhaseOneBridgeOptions = {},
): ChatEnginePhaseOneBridge {
  return new ChatEnginePhaseOneBridge(options);
}
