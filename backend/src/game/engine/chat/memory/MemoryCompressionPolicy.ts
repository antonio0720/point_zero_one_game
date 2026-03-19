/**
 * backend/src/game/engine/chat/memory/MemoryCompressionPolicy.ts
 *
 * Backend compression, retention, and summarization policy for Point Zero One
 * chat memory.
 *
 * This module decides what remains hot, what is archived, what is compressed
 * into dense summaries, and what should be deleted outright. It is designed to
 * sit above ConversationMemoryStore and MemorySalienceScorer so every memory
 * lane uses the same retention logic.
 */

import type { ChatCallbackKind } from '../../../../../shared/contracts/chat/ChatCallback';
import type { ChatQuoteKind } from '../../../../../shared/contracts/chat/ChatQuote';
import {
  ConversationMemoryStore,
  type ConversationMemoryCallbackRecord,
  type ConversationMemoryEventRecord,
  type ConversationMemoryQuoteRecord,
  type ConversationMemorySnapshot,
} from './ConversationMemoryStore';
import {
  MemorySalienceScorer,
  type MemorySalienceContext,
  type MemorySalienceScore,
  type MemorySalienceTier,
} from './MemorySalienceScorer';

export type MemoryCompressionAction =
  | 'KEEP_HOT'
  | 'KEEP_WARM'
  | 'ARCHIVE'
  | 'SUMMARIZE'
  | 'DELETE'
  | 'SHADOW_ONLY'
  | 'DEFER';

export type MemoryCompressionDomain = 'EVENT' | 'QUOTE' | 'CALLBACK';
export type MemoryCompressionReasonCode =
  | 'critical_salience'
  | 'legend_salience'
  | 'hot_window'
  | 'warm_window'
  | 'aged_out'
  | 'archived_state'
  | 'spent_state'
  | 'duplicate_fact'
  | 'low_retrieval_value'
  | 'quote_chain_anchor'
  | 'callback_plan_anchor'
  | 'proof_anchor'
  | 'relationship_anchor'
  | 'rescue_anchor'
  | 'rivalry_anchor'
  | 'deal_room_anchor'
  | 'post_run_anchor'
  | 'legend_anchor'
  | 'public_witness_anchor'
  | 'shadow_only_anchor'
  | 'privacy_lock'
  | 'cooldown_window'
  | 'run_boundary'
  | 'mode_boundary'
  | 'scene_boundary'
  | 'same_room_cluster'
  | 'same_actor_cluster'
  | 'same_counterpart_cluster'
  | 'same_quote_cluster'
  | 'same_callback_cluster'
  | 'storage_budget'
  | 'soft_budget'
  | 'hard_budget'
  | 'compression_candidate'
  | 'summary_candidate'
  | 'summary_support'
  | 'orphan_record'
  | 'retention_floor'
  | 'retention_ceiling'
  | 'active_callback'
  | 'future_reveal'
  | 'proofless_noise'
  | 'system_noise'
  | 'lightweight_noise'
  | 'witness_preservation'
  | 'confidence_preservation'
  | 'collapse_preservation'
  | 'comeback_preservation'
  | 'taunt_preservation'
  | 'boast_preservation'
  | 'bluff_preservation'
  | 'threat_preservation'
  | 'advice_preservation'
  | 'confession_preservation'
  | 'triggered_by_policy';

export interface MemoryCompressionConfig {
  readonly hotRecordBudget: number;
  readonly warmRecordBudget: number;
  readonly archiveRecordBudget: number;
  readonly deleteBelowScore01: number;
  readonly summarizeBelowScore01: number;
  readonly keepWarmBelowScore01: number;
  readonly keepHotBelowScore01: number;
  readonly hotWindowMs: number;
  readonly warmWindowMs: number;
  readonly archiveWindowMs: number;
  readonly maxSameActorRetained: number;
  readonly maxSameCounterpartRetained: number;
  readonly maxSameRoomRetained: number;
  readonly maxSameQuoteKindRetained: number;
  readonly maxSameCallbackKindRetained: number;
  readonly maxSummaryMembers: number;
  readonly minimumSummaryMembers: number;
  readonly deleteArchivedAfterMs: number;
  readonly keepProofAnchors: boolean;
  readonly keepRelationshipAnchors: boolean;
  readonly keepRescueAnchors: boolean;
  readonly keepRivalryAnchors: boolean;
  readonly keepLegendAnchors: boolean;
  readonly keepDealRoomAnchors: boolean;
  readonly preserveShadowSignals: boolean;
}

export interface MemoryCompressionContext {
  readonly playerId: string;
  readonly now?: number;
  readonly salienceContext?: Omit<MemorySalienceContext, 'playerId' | 'now'>;
}

export interface MemoryCompressionDecision {
  readonly domain: MemoryCompressionDomain;
  readonly id: string;
  readonly action: MemoryCompressionAction;
  readonly score01: number;
  readonly tier: MemorySalienceTier;
  readonly reasons: readonly MemoryCompressionReasonCode[];
  readonly createdAt: number;
  readonly actorId?: string;
  readonly counterpartId?: string;
  readonly roomId?: string;
  readonly channelId?: string;
  readonly tags: readonly string[];
  readonly summaryKey?: string;
}

export interface MemoryCompressionSummaryGroup {
  readonly summaryKey: string;
  readonly domain: MemoryCompressionDomain;
  readonly memberIds: readonly string[];
  readonly createdAt: number;
  readonly latestAt: number;
  readonly actorIds: readonly string[];
  readonly counterpartIds: readonly string[];
  readonly roomIds: readonly string[];
  readonly tags: readonly string[];
  readonly reasons: readonly MemoryCompressionReasonCode[];
  readonly summaryText: string;
}

export interface MemoryCompressionPlan {
  readonly playerId: string;
  readonly createdAt: number;
  readonly decisions: readonly MemoryCompressionDecision[];
  readonly summaries: readonly MemoryCompressionSummaryGroup[];
  readonly keepHotIds: readonly string[];
  readonly keepWarmIds: readonly string[];
  readonly archiveIds: readonly string[];
  readonly summarizeIds: readonly string[];
  readonly deleteIds: readonly string[];
  readonly shadowOnlyIds: readonly string[];
  readonly auditTrail: readonly string[];
}

const DEFAULT_MEMORY_COMPRESSION_CONFIG: MemoryCompressionConfig = Object.freeze({
  hotRecordBudget: 240,
  warmRecordBudget: 800,
  archiveRecordBudget: 2400,
  deleteBelowScore01: 0.14,
  summarizeBelowScore01: 0.36,
  keepWarmBelowScore01: 0.58,
  keepHotBelowScore01: 0.78,
  hotWindowMs: 24 * 60 * 60 * 1000,
  warmWindowMs: 7 * 24 * 60 * 60 * 1000,
  archiveWindowMs: 45 * 24 * 60 * 60 * 1000,
  maxSameActorRetained: 24,
  maxSameCounterpartRetained: 24,
  maxSameRoomRetained: 48,
  maxSameQuoteKindRetained: 40,
  maxSameCallbackKindRetained: 40,
  maxSummaryMembers: 18,
  minimumSummaryMembers: 3,
  deleteArchivedAfterMs: 180 * 24 * 60 * 60 * 1000,
  keepProofAnchors: true,
  keepRelationshipAnchors: true,
  keepRescueAnchors: true,
  keepRivalryAnchors: true,
  keepLegendAnchors: true,
  keepDealRoomAnchors: true,
  preserveShadowSignals: true,
});

function now(): number {
  return Date.now();
}

function clamp01(value: number): number {
  if (Number.isNaN(value) || !Number.isFinite(value)) {
    return 0;
  }
  if (value <= 0) {
    return 0;
  }
  if (value >= 1) {
    return 1;
  }
  return value;
}

function uniqueStrings(values: readonly (string | undefined | null)[]): readonly string[] {
  return Array.from(new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean)));
}

function normalizeText(value: string | undefined | null): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function summarizeText(texts: readonly string[], maxSegments: number = 4): string {
  return texts
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, maxSegments)
    .join(' • ')
    .slice(0, 400);
}

function groupKey(parts: readonly (string | undefined | null)[]): string {
  return parts.map((part) => normalizeText(part)).filter(Boolean).join('::') || 'default';
}

function isHotTier(tier: MemorySalienceTier): boolean {
  return tier === 'LEGEND' || tier === 'CRITICAL';
}

function isWarmTier(tier: MemorySalienceTier): boolean {
  return tier === 'HIGH' || tier === 'MEDIUM';
}

export class MemoryCompressionPolicy {
  private readonly config: MemoryCompressionConfig;
  private readonly salienceScorer: MemorySalienceScorer;

  public constructor(
    config: Partial<MemoryCompressionConfig> = {},
    salienceScorer: MemorySalienceScorer = new MemorySalienceScorer(),
  ) {
    this.config = Object.freeze({
      ...DEFAULT_MEMORY_COMPRESSION_CONFIG,
      ...config,
    });
    this.salienceScorer = salienceScorer;
  }

  public plan(store: ConversationMemoryStore, context: MemoryCompressionContext): MemoryCompressionPlan {
    const createdAt = context.now ?? now();
    const snapshot = store.getSnapshot(context.playerId);
    const salienceContext: MemorySalienceContext = {
      playerId: context.playerId,
      now: createdAt,
      ...(context.salienceContext ?? {}),
    };

    const eventScores = snapshot.events.map((record) => this.salienceScorer.scoreEvent({ record, context: salienceContext }));
    const quoteScores = snapshot.quotes.map((record) => this.salienceScorer.scoreQuote({
      record,
      context: salienceContext,
      parentEvent: record.memoryId ? store.getEvent(context.playerId, record.memoryId) : undefined,
    }));
    const callbackScores = snapshot.callbacks.map((record) => this.salienceScorer.scoreCallback({
      record,
      context: salienceContext,
      event: record.memoryId ? store.getEvent(context.playerId, record.memoryId) : undefined,
      quote: record.quoteId ? store.getQuote(context.playerId, record.quoteId) : undefined,
    }));

    const decisions: MemoryCompressionDecision[] = [];
    const auditTrail: string[] = [];

    decisions.push(
      ...this.buildEventDecisions(snapshot.events, eventScores, createdAt, auditTrail),
      ...this.buildQuoteDecisions(snapshot.quotes, quoteScores, createdAt, auditTrail),
      ...this.buildCallbackDecisions(snapshot.callbacks, callbackScores, createdAt, auditTrail),
    );

    const budgeted = this.enforceBudgets(decisions, auditTrail);
    const summaries = this.buildSummaryGroups(snapshot, budgeted, auditTrail, createdAt);

    return {
      playerId: context.playerId,
      createdAt,
      decisions: budgeted,
      summaries,
      keepHotIds: budgeted.filter((decision) => decision.action === 'KEEP_HOT').map((decision) => decision.id),
      keepWarmIds: budgeted.filter((decision) => decision.action === 'KEEP_WARM').map((decision) => decision.id),
      archiveIds: budgeted.filter((decision) => decision.action === 'ARCHIVE').map((decision) => decision.id),
      summarizeIds: budgeted.filter((decision) => decision.action === 'SUMMARIZE').map((decision) => decision.id),
      deleteIds: budgeted.filter((decision) => decision.action === 'DELETE').map((decision) => decision.id),
      shadowOnlyIds: budgeted.filter((decision) => decision.action === 'SHADOW_ONLY').map((decision) => decision.id),
      auditTrail,
    };
  }

  public applyPlan(store: ConversationMemoryStore, plan: MemoryCompressionPlan): void {
    for (const decision of plan.decisions) {
      switch (decision.domain) {
        case 'EVENT':
          this.applyEventDecision(store, plan.playerId, decision);
          break;
        case 'QUOTE':
          this.applyQuoteDecision(store, plan.playerId, decision);
          break;
        case 'CALLBACK':
          this.applyCallbackDecision(store, plan.playerId, decision);
          break;
        default:
          break;
      }
    }
  }

  private buildEventDecisions(
    records: readonly ConversationMemoryEventRecord[],
    scores: readonly MemorySalienceScore[],
    referenceNow: number,
    auditTrail: string[],
  ): readonly MemoryCompressionDecision[] {
    const scoreMap = new Map(scores.map((score) => [score.id, score]));
    const actorCounts = new Map<string, number>();
    const counterpartCounts = new Map<string, number>();
    const roomCounts = new Map<string, number>();

    return [...records]
      .sort((left, right) => right.createdAt - left.createdAt)
      .map((record) => {
        const score = scoreMap.get(record.memoryId)!;
        const reasons = new Set<MemoryCompressionReasonCode>();
        let action = this.baseActionFromScore(score, record.createdAt, referenceNow, reasons);

        if (record.context.proofChainId && this.config.keepProofAnchors) {
          action = this.promoteAction(action, 'KEEP_WARM');
          reasons.add('proof_anchor');
        }
        if (this.isRelationshipAnchorEvent(record) && this.config.keepRelationshipAnchors) {
          action = this.promoteAction(action, 'KEEP_WARM');
          reasons.add('relationship_anchor');
        }
        if (this.isRescueAnchorEvent(record) && this.config.keepRescueAnchors) {
          action = this.promoteAction(action, 'KEEP_HOT');
          reasons.add('rescue_anchor');
        }
        if (this.isRivalryAnchorEvent(record) && this.config.keepRivalryAnchors) {
          action = this.promoteAction(action, 'KEEP_HOT');
          reasons.add('rivalry_anchor');
        }
        if (this.isLegendAnchorEvent(record) && this.config.keepLegendAnchors) {
          action = this.promoteAction(action, 'KEEP_HOT');
          reasons.add('legend_anchor');
        }
        if (this.isDealRoomAnchorEvent(record) && this.config.keepDealRoomAnchors) {
          action = this.promoteAction(action, 'KEEP_WARM');
          reasons.add('deal_room_anchor');
        }
        if (record.context.channelId?.includes('SHADOW') && this.config.preserveShadowSignals) {
          action = this.promoteAction(action, 'SHADOW_ONLY');
          reasons.add('shadow_only_anchor');
        }
        if (record.status === 'ARCHIVED') {
          reasons.add('archived_state');
        }

        this.applyCountCaps(actorCounts, record.actor.actorId, this.config.maxSameActorRetained, reasons, (nextAction) => {
          action = this.demoteAction(action, nextAction);
        }, 'same_actor_cluster');
        this.applyCountCaps(counterpartCounts, record.counterpart?.actorId, this.config.maxSameCounterpartRetained, reasons, (nextAction) => {
          action = this.demoteAction(action, nextAction);
        }, 'same_counterpart_cluster');
        this.applyCountCaps(roomCounts, record.context.roomId, this.config.maxSameRoomRetained, reasons, (nextAction) => {
          action = this.demoteAction(action, nextAction);
        }, 'same_room_cluster');

        this.increment(actorCounts, record.actor.actorId);
        this.increment(counterpartCounts, record.counterpart?.actorId);
        this.increment(roomCounts, record.context.roomId);

        const decision = this.toDecision('EVENT', record.memoryId, action, score, reasons, {
          createdAt: record.createdAt,
          actorId: record.actor.actorId,
          counterpartId: record.counterpart?.actorId,
          roomId: record.context.roomId,
          channelId: record.context.channelId,
          tags: record.context.tags ?? [],
          summaryKey: this.eventSummaryKey(record),
        });
        auditTrail.push(`event:${record.memoryId}:${action}:${score.score01.toFixed(3)}`);
        return decision;
      });
  }

  private buildQuoteDecisions(
    records: readonly ConversationMemoryQuoteRecord[],
    scores: readonly MemorySalienceScore[],
    referenceNow: number,
    auditTrail: string[],
  ): readonly MemoryCompressionDecision[] {
    const scoreMap = new Map(scores.map((score) => [score.id, score]));
    const quoteKindCounts = new Map<string, number>();
    const counterpartCounts = new Map<string, number>();

    return [...records]
      .sort((left, right) => right.createdAt - left.createdAt)
      .map((record) => {
        const score = scoreMap.get(record.quoteId)!;
        const reasons = new Set<MemoryCompressionReasonCode>();
        let action = this.baseActionFromScore(score, record.createdAt, referenceNow, reasons);

        if ((record.proofHashes?.length ?? 0) > 0 && this.config.keepProofAnchors) {
          action = this.promoteAction(action, 'KEEP_WARM');
          reasons.add('proof_anchor');
        }
        if (this.isRelationshipAnchorQuote(record) && this.config.keepRelationshipAnchors) {
          action = this.promoteAction(action, 'KEEP_WARM');
          reasons.add('relationship_anchor');
        }
        if (this.isLegendAnchorQuote(record) && this.config.keepLegendAnchors) {
          action = this.promoteAction(action, 'KEEP_HOT');
          reasons.add('legend_anchor');
        }
        if (this.isPostRunAnchorQuote(record)) {
          action = this.promoteAction(action, 'KEEP_WARM');
          reasons.add('post_run_anchor');
        }
        if (record.audienceClass === 'PUBLIC' || record.audienceClass === 'SYNDICATE') {
          action = this.promoteAction(action, 'KEEP_WARM');
          reasons.add('public_witness_anchor');
        }
        if (record.audienceClass === 'SHADOW' && this.config.preserveShadowSignals) {
          action = this.promoteAction(action, 'SHADOW_ONLY');
          reasons.add('shadow_only_anchor');
        }
        if (record.lifecycle === 'SPENT') {
          reasons.add('spent_state');
        }
        if (record.lifecycle === 'ARCHIVED') {
          reasons.add('archived_state');
        }

        this.applyCountCaps(quoteKindCounts, record.kind, this.config.maxSameQuoteKindRetained, reasons, (nextAction) => {
          action = this.demoteAction(action, nextAction);
        }, 'same_quote_cluster');
        this.applyCountCaps(counterpartCounts, record.counterpartId, this.config.maxSameCounterpartRetained, reasons, (nextAction) => {
          action = this.demoteAction(action, nextAction);
        }, 'same_counterpart_cluster');

        this.increment(quoteKindCounts, record.kind);
        this.increment(counterpartCounts, record.counterpartId);

        const decision = this.toDecision('QUOTE', record.quoteId, action, score, reasons, {
          createdAt: record.createdAt,
          actorId: record.actorId,
          counterpartId: record.counterpartId,
          roomId: record.context.roomId,
          channelId: record.context.channelId,
          tags: record.tags ?? [],
          summaryKey: this.quoteSummaryKey(record),
        });
        auditTrail.push(`quote:${record.quoteId}:${action}:${score.score01.toFixed(3)}`);
        return decision;
      });
  }

  private buildCallbackDecisions(
    records: readonly ConversationMemoryCallbackRecord[],
    scores: readonly MemorySalienceScore[],
    referenceNow: number,
    auditTrail: string[],
  ): readonly MemoryCompressionDecision[] {
    const scoreMap = new Map(scores.map((score) => [score.id, score]));
    const callbackKindCounts = new Map<string, number>();
    const counterpartCounts = new Map<string, number>();

    return [...records]
      .sort((left, right) => right.createdAt - left.createdAt)
      .map((record) => {
        const score = scoreMap.get(record.callbackId)!;
        const reasons = new Set<MemoryCompressionReasonCode>();
        let action = this.baseActionFromScore(score, record.createdAt, referenceNow, reasons);

        if (record.evidenceCount > 0 && this.config.keepProofAnchors) {
          action = this.promoteAction(action, 'KEEP_WARM');
          reasons.add('proof_anchor');
        }
        if (record.mode === 'RESCUE' && this.config.keepRescueAnchors) {
          action = this.promoteAction(action, 'KEEP_HOT');
          reasons.add('rescue_anchor');
        }
        if (record.mode === 'RIVAL_ONLY' || record.kind === 'RELATIONSHIP') {
          action = this.promoteAction(action, 'KEEP_WARM');
          reasons.add('relationship_anchor');
        }
        if (record.mode === 'LEGEND' && this.config.keepLegendAnchors) {
          action = this.promoteAction(action, 'KEEP_HOT');
          reasons.add('legend_anchor');
        }
        if (record.mode === 'POST_RUN') {
          action = this.promoteAction(action, 'KEEP_WARM');
          reasons.add('post_run_anchor');
        }
        if (record.channelHint?.includes('SHADOW') && this.config.preserveShadowSignals) {
          action = this.promoteAction(action, 'SHADOW_ONLY');
          reasons.add('shadow_only_anchor');
        }
        if (record.lifecycle === 'PENDING' || record.lifecycle === 'PLANNED') {
          action = this.promoteAction(action, 'KEEP_HOT');
          reasons.add('active_callback');
          reasons.add('future_reveal');
        }
        if (record.lifecycle === 'SPENT') {
          reasons.add('spent_state');
        }
        if (record.lifecycle === 'ARCHIVED') {
          reasons.add('archived_state');
        }

        this.applyCountCaps(callbackKindCounts, record.kind, this.config.maxSameCallbackKindRetained, reasons, (nextAction) => {
          action = this.demoteAction(action, nextAction);
        }, 'same_callback_cluster');
        this.applyCountCaps(counterpartCounts, record.counterpartId, this.config.maxSameCounterpartRetained, reasons, (nextAction) => {
          action = this.demoteAction(action, nextAction);
        }, 'same_counterpart_cluster');

        this.increment(callbackKindCounts, record.kind);
        this.increment(counterpartCounts, record.counterpartId);

        const decision = this.toDecision('CALLBACK', record.callbackId, action, score, reasons, {
          createdAt: record.createdAt,
          actorId: record.actorId,
          counterpartId: record.counterpartId,
          roomId: record.context.roomId,
          channelId: record.context.channelId,
          tags: record.tags ?? [],
          summaryKey: this.callbackSummaryKey(record),
        });
        auditTrail.push(`callback:${record.callbackId}:${action}:${score.score01.toFixed(3)}`);
        return decision;
      });
  }

  private baseActionFromScore(
    score: MemorySalienceScore,
    createdAt: number,
    referenceNow: number,
    reasons: Set<MemoryCompressionReasonCode>,
  ): MemoryCompressionAction {
    const ageMs = Math.max(0, referenceNow - createdAt);

    if (score.tier === 'LEGEND') {
      reasons.add('legend_salience');
      return 'KEEP_HOT';
    }
    if (score.tier === 'CRITICAL') {
      reasons.add('critical_salience');
      return 'KEEP_HOT';
    }
    if (ageMs <= this.config.hotWindowMs || score.score01 >= this.config.keepHotBelowScore01) {
      reasons.add('hot_window');
      return 'KEEP_HOT';
    }
    if (ageMs <= this.config.warmWindowMs || score.score01 >= this.config.keepWarmBelowScore01) {
      reasons.add('warm_window');
      return 'KEEP_WARM';
    }
    if (score.score01 <= this.config.deleteBelowScore01) {
      reasons.add('aged_out');
      reasons.add('lightweight_noise');
      return 'DELETE';
    }
    if (score.score01 <= this.config.summarizeBelowScore01) {
      reasons.add('compression_candidate');
      reasons.add('summary_candidate');
      return 'SUMMARIZE';
    }
    if (ageMs >= this.config.archiveWindowMs) {
      reasons.add('aged_out');
      return 'ARCHIVE';
    }
    return 'KEEP_WARM';
  }

  private enforceBudgets(
    decisions: readonly MemoryCompressionDecision[],
    auditTrail: string[],
  ): readonly MemoryCompressionDecision[] {
    const sorted = [...decisions].sort((left, right) => {
      if (right.score01 !== left.score01) {
        return right.score01 - left.score01;
      }
      return right.createdAt - left.createdAt;
    });

    let hotCount = 0;
    let warmCount = 0;
    let archiveCount = 0;

    return sorted.map((decision) => {
      let action = decision.action;
      const reasons = new Set(decision.reasons);

      if (action === 'KEEP_HOT') {
        hotCount += 1;
        if (hotCount > this.config.hotRecordBudget) {
          action = 'KEEP_WARM';
          reasons.add('storage_budget');
          reasons.add('soft_budget');
        }
      }
      if (action === 'KEEP_WARM') {
        warmCount += 1;
        if (warmCount > this.config.warmRecordBudget) {
          action = 'ARCHIVE';
          reasons.add('storage_budget');
          reasons.add('soft_budget');
        }
      }
      if (action === 'ARCHIVE') {
        archiveCount += 1;
        if (archiveCount > this.config.archiveRecordBudget) {
          action = 'DELETE';
          reasons.add('storage_budget');
          reasons.add('hard_budget');
        }
      }

      if (action !== decision.action) {
        auditTrail.push(`budget:${decision.domain}:${decision.id}:${decision.action}->${action}`);
      }

      return {
        ...decision,
        action,
        reasons: Array.from(reasons),
      };
    });
  }

  private buildSummaryGroups(
    snapshot: ConversationMemorySnapshot,
    decisions: readonly MemoryCompressionDecision[],
    auditTrail: string[],
    createdAt: number,
  ): readonly MemoryCompressionSummaryGroup[] {
    const decisionMap = new Map(decisions.map((decision) => [decision.id, decision]));
    const groups = new Map<string, {
      domain: MemoryCompressionDomain;
      members: string[];
      createdAt: number;
      latestAt: number;
      actorIds: string[];
      counterpartIds: string[];
      roomIds: string[];
      tags: string[];
      reasons: Set<MemoryCompressionReasonCode>;
      texts: string[];
    }>();

    const pushGroupMember = (
      summaryKey: string | undefined,
      domain: MemoryCompressionDomain,
      id: string,
      createdAtValue: number,
      actorId: string | undefined,
      counterpartId: string | undefined,
      roomId: string | undefined,
      tags: readonly string[],
      text: string,
      reasons: readonly MemoryCompressionReasonCode[],
    ): void => {
      if (!summaryKey) {
        return;
      }
      let group = groups.get(summaryKey);
      if (!group) {
        group = {
          domain,
          members: [],
          createdAt: createdAtValue,
          latestAt: createdAtValue,
          actorIds: [],
          counterpartIds: [],
          roomIds: [],
          tags: [],
          reasons: new Set(),
          texts: [],
        };
        groups.set(summaryKey, group);
      }
      if (group.members.length >= this.config.maxSummaryMembers) {
        return;
      }
      group.members.push(id);
      group.createdAt = Math.min(group.createdAt, createdAtValue);
      group.latestAt = Math.max(group.latestAt, createdAtValue);
      if (actorId) group.actorIds.push(actorId);
      if (counterpartId) group.counterpartIds.push(counterpartId);
      if (roomId) group.roomIds.push(roomId);
      group.tags.push(...tags);
      group.texts.push(text);
      for (const reason of reasons) {
        group.reasons.add(reason);
      }
    };

    for (const event of snapshot.events) {
      const decision = decisionMap.get(event.memoryId);
      if (!decision || decision.action !== 'SUMMARIZE') {
        continue;
      }
      pushGroupMember(
        decision.summaryKey,
        'EVENT',
        event.memoryId,
        event.createdAt,
        event.actor.actorId,
        event.counterpart?.actorId,
        event.context.roomId,
        event.context.tags ?? [],
        event.body,
        decision.reasons,
      );
    }

    for (const quote of snapshot.quotes) {
      const decision = decisionMap.get(quote.quoteId);
      if (!decision || decision.action !== 'SUMMARIZE') {
        continue;
      }
      pushGroupMember(
        decision.summaryKey,
        'QUOTE',
        quote.quoteId,
        quote.createdAt,
        quote.actorId,
        quote.counterpartId,
        quote.context.roomId,
        quote.tags ?? [],
        quote.text,
        decision.reasons,
      );
    }

    for (const callback of snapshot.callbacks) {
      const decision = decisionMap.get(callback.callbackId);
      if (!decision || decision.action !== 'SUMMARIZE') {
        continue;
      }
      pushGroupMember(
        decision.summaryKey,
        'CALLBACK',
        callback.callbackId,
        callback.createdAt,
        callback.actorId,
        callback.counterpartId,
        callback.context.roomId,
        callback.tags ?? [],
        callback.text,
        decision.reasons,
      );
    }

    const summaries: MemoryCompressionSummaryGroup[] = [];
    for (const [summaryKey, group] of groups.entries()) {
      if (group.members.length < this.config.minimumSummaryMembers) {
        auditTrail.push(`summary:skip:${summaryKey}:members=${group.members.length}`);
        continue;
      }
      summaries.push({
        summaryKey,
        domain: group.domain,
        memberIds: group.members,
        createdAt,
        latestAt: group.latestAt,
        actorIds: uniqueStrings(group.actorIds),
        counterpartIds: uniqueStrings(group.counterpartIds),
        roomIds: uniqueStrings(group.roomIds),
        tags: uniqueStrings(group.tags),
        reasons: Array.from(group.reasons),
        summaryText: summarizeText(group.texts),
      });
      auditTrail.push(`summary:${summaryKey}:members=${group.members.length}`);
    }

    return summaries.sort((left, right) => right.latestAt - left.latestAt);
  }

  private applyEventDecision(store: ConversationMemoryStore, playerId: string, decision: MemoryCompressionDecision): void {
    switch (decision.action) {
      case 'ARCHIVE':
      case 'SHADOW_ONLY':
      case 'SUMMARIZE':
        store.archiveEvent(playerId, decision.id);
        return;
      case 'DELETE':
        store.deleteEvent(playerId, decision.id);
        return;
      default:
        return;
    }
  }

  private applyQuoteDecision(store: ConversationMemoryStore, playerId: string, decision: MemoryCompressionDecision): void {
    switch (decision.action) {
      case 'ARCHIVE':
      case 'SHADOW_ONLY':
      case 'SUMMARIZE':
        store.archiveQuote(playerId, decision.id);
        return;
      case 'DELETE':
        store.deleteQuote(playerId, decision.id);
        return;
      default:
        return;
    }
  }

  private applyCallbackDecision(store: ConversationMemoryStore, playerId: string, decision: MemoryCompressionDecision): void {
    switch (decision.action) {
      case 'ARCHIVE':
      case 'SHADOW_ONLY':
      case 'SUMMARIZE':
        store.archiveCallback(playerId, decision.id);
        return;
      case 'DELETE':
        store.deleteCallback(playerId, decision.id);
        return;
      default:
        return;
    }
  }

  private eventSummaryKey(record: ConversationMemoryEventRecord): string {
    return groupKey([
      'event',
      record.context.runId,
      record.context.modeId,
      record.context.roomId,
      record.context.eventType,
      record.actor.actorId,
      record.counterpart?.actorId,
    ]);
  }

  private quoteSummaryKey(record: ConversationMemoryQuoteRecord): string {
    return groupKey([
      'quote',
      record.context.runId,
      record.context.roomId,
      record.kind,
      record.actorId,
      record.counterpartId,
    ]);
  }

  private callbackSummaryKey(record: ConversationMemoryCallbackRecord): string {
    return groupKey([
      'callback',
      record.context.runId,
      record.context.roomId,
      record.kind,
      record.mode,
      record.actorId,
      record.counterpartId,
    ]);
  }

  private isRelationshipAnchorEvent(record: ConversationMemoryEventRecord): boolean {
    return record.context.eventType === 'RIVALRY_ESCALATION' || record.context.eventType === 'HELPER_INTERVENTION';
  }

  private isRescueAnchorEvent(record: ConversationMemoryEventRecord): boolean {
    return record.context.eventType === 'RESCUE_INTERVENTION' || record.context.channelId === 'RESCUE_SHADOW';
  }

  private isRivalryAnchorEvent(record: ConversationMemoryEventRecord): boolean {
    return record.context.eventType === 'RIVALRY_ESCALATION' || record.context.channelId === 'RIVALRY_SHADOW';
  }

  private isLegendAnchorEvent(record: ConversationMemoryEventRecord): boolean {
    return record.context.eventType === 'RUN_END' && normalizeText(record.body).includes('legend');
  }

  private isDealRoomAnchorEvent(record: ConversationMemoryEventRecord): boolean {
    return record.context.eventType === 'DEAL_ROOM_PRESSURE' || record.context.channelId === 'DEAL_ROOM';
  }

  private isRelationshipAnchorQuote(record: ConversationMemoryQuoteRecord): boolean {
    return record.kind === 'RECEIPT' || record.kind === 'PROMISE' || record.kind === 'CONFESSION';
  }

  private isLegendAnchorQuote(record: ConversationMemoryQuoteRecord): boolean {
    return record.intent === 'LEGEND_ARCHIVE' || record.context.tags?.includes('LEGEND') === true;
  }

  private isPostRunAnchorQuote(record: ConversationMemoryQuoteRecord): boolean {
    return record.intent === 'POST_RUN_RECKONING' || record.context.tags?.includes('POST_RUN') === true;
  }

  private promoteAction(current: MemoryCompressionAction, minimum: MemoryCompressionAction): MemoryCompressionAction {
    const order: readonly MemoryCompressionAction[] = ['DELETE', 'SUMMARIZE', 'ARCHIVE', 'DEFER', 'SHADOW_ONLY', 'KEEP_WARM', 'KEEP_HOT'];
    return order.indexOf(current) < order.indexOf(minimum) ? minimum : current;
  }

  private demoteAction(current: MemoryCompressionAction, maximum: MemoryCompressionAction): MemoryCompressionAction {
    const order: readonly MemoryCompressionAction[] = ['DELETE', 'SUMMARIZE', 'ARCHIVE', 'DEFER', 'SHADOW_ONLY', 'KEEP_WARM', 'KEEP_HOT'];
    return order.indexOf(current) > order.indexOf(maximum) ? maximum : current;
  }

  private increment(map: Map<string, number>, key: string | undefined): void {
    if (!key) {
      return;
    }
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  private applyCountCaps(
    map: Map<string, number>,
    key: string | undefined,
    maxAllowed: number,
    reasons: Set<MemoryCompressionReasonCode>,
    apply: (nextAction: MemoryCompressionAction) => void,
    reason: MemoryCompressionReasonCode,
  ): void {
    if (!key) {
      return;
    }
    const nextCount = (map.get(key) ?? 0) + 1;
    if (nextCount <= maxAllowed) {
      return;
    }
    reasons.add(reason);
    reasons.add('compression_candidate');
    apply('SUMMARIZE');
  }

  private toDecision(
    domain: MemoryCompressionDomain,
    id: string,
    action: MemoryCompressionAction,
    score: MemorySalienceScore,
    reasons: Set<MemoryCompressionReasonCode>,
    detail: {
      readonly createdAt: number;
      readonly actorId?: string;
      readonly counterpartId?: string;
      readonly roomId?: string;
      readonly channelId?: string;
      readonly tags: readonly string[];
      readonly summaryKey?: string;
    },
  ): MemoryCompressionDecision {
    return {
      domain,
      id,
      action,
      score01: score.score01,
      tier: score.tier,
      reasons: Array.from(reasons),
      createdAt: detail.createdAt,
      actorId: detail.actorId,
      counterpartId: detail.counterpartId,
      roomId: detail.roomId,
      channelId: detail.channelId,
      tags: detail.tags,
      summaryKey: action === 'SUMMARIZE' ? detail.summaryKey : undefined,
    };
  }
}

export function createMemoryCompressionPolicy(
  config: Partial<MemoryCompressionConfig> = {},
  salienceScorer: MemorySalienceScorer = new MemorySalienceScorer(),
): MemoryCompressionPolicy {
  return new MemoryCompressionPolicy(config, salienceScorer);
}

export function planConversationMemoryCompression(
  store: ConversationMemoryStore,
  context: MemoryCompressionContext,
  config: Partial<MemoryCompressionConfig> = {},
  salienceScorer: MemorySalienceScorer = new MemorySalienceScorer(),
): MemoryCompressionPlan {
  return new MemoryCompressionPolicy(config, salienceScorer).plan(store, context);
}

export function applyConversationMemoryCompression(
  store: ConversationMemoryStore,
  plan: MemoryCompressionPlan,
  config: Partial<MemoryCompressionConfig> = {},
  salienceScorer: MemorySalienceScorer = new MemorySalienceScorer(),
): void {
  new MemoryCompressionPolicy(config, salienceScorer).applyPlan(store, plan);
}
