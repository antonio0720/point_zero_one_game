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


// ============================================================================
// MARK: Semantic memory cluster types
// ============================================================================

export interface SemanticMemoryCluster {
  readonly clusterId: string;
  readonly events: readonly ConversationMemoryEventRecord[];
  readonly centroidEventId: string;
  readonly counterpartIds: readonly string[];
  readonly channelId: string;
  readonly timeSpanMs: number;
  readonly avgSalience01: number;
  readonly maxHostility01: number;
  readonly maxEmbarrassment01: number;
  readonly eventCount: number;
  readonly isNarrativeArc: boolean;
}

export interface NarrativeArc {
  readonly arcId: string;
  readonly clusterId: string;
  readonly eventIds: readonly string[];
  readonly centroidEventId: string;
  readonly arcStrength01: number;
  readonly isProtected: boolean;
}

// ============================================================================
// MARK: Mode compression profile
// ============================================================================

export interface ModeCompressionProfile {
  readonly modeId: string;
  readonly ambientAggressiveness01: number;
  readonly rescuePreservation01: number;
  readonly postRunAggressiveness01: number;
  readonly teamPreservation01: number;
}

// ============================================================================
// MARK: Budget utilization types
// ============================================================================

export interface MemoryBudgetUtilization {
  readonly eventUtilization01: number;
  readonly quoteUtilization01: number;
  readonly callbackUtilization01: number;
  readonly overallUtilization01: number;
  readonly needsEmergencyCompression: boolean;
  readonly needsSoftCompression: boolean;
}

// ============================================================================
// MARK: Run memory capsule
// ============================================================================

export interface RunMemoryCapsule {
  readonly capsuleId: string;
  readonly playerId: string;
  readonly runId: string;
  readonly createdAt: number;
  readonly eventCount: number;
  readonly quoteCount: number;
  readonly callbackCount: number;
  readonly legendEventIds: readonly string[];
  readonly highEventIds: readonly string[];
  readonly unresolvedCallbackIds: readonly string[];
  readonly avgHostility01: number;
  readonly avgEmbarrassment01: number;
  readonly avgConfidence01: number;
  readonly dominantChannel: string;
  readonly dominantCounterpartId?: string;
}



// ============================================================================
// MARK: Compression undo types
// ============================================================================

export interface CompressionUndoEntry {
  entityId: string;
  action: MemoryCompressionAction;
  originalData: string;
  compressedAt: number;
  rehydrated: boolean;
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
      quote: (record as any).quoteId ? store.getQuote(context.playerId, (record as any).quoteId) : undefined,
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

        if ((record as any).context.proofChainId && this.config.keepProofAnchors) {
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
        if ((record as any).context.channelId?.includes('SHADOW') && this.config.preserveShadowSignals) {
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
        this.applyCountCaps(roomCounts, (record as any).context.roomId, this.config.maxSameRoomRetained, reasons, (nextAction) => {
          action = this.demoteAction(action, nextAction);
        }, 'same_room_cluster');

        this.increment(actorCounts, record.actor.actorId);
        this.increment(counterpartCounts, record.counterpart?.actorId);
        this.increment(roomCounts, (record as any).context.roomId);

        const decision = this.toDecision('EVENT', record.memoryId, action, score, reasons, {
          createdAt: record.createdAt,
          actorId: record.actor.actorId,
          counterpartId: record.counterpart?.actorId,
          roomId: (record as any).context.roomId,
          channelId: (record as any).context.channelId,
          tags: (record as any).context.tags ?? [],
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
        const score = scoreMap.get((record as any).quoteId)!;
        const reasons = new Set<MemoryCompressionReasonCode>();
        let action = this.baseActionFromScore(score, record.createdAt, referenceNow, reasons);

        if (((record as any).proofHashes?.length ?? 0) > 0 && this.config.keepProofAnchors) {
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
        if ((record as any).audienceClass === 'PUBLIC' || (record as any).audienceClass === 'SYNDICATE') {
          action = this.promoteAction(action, 'KEEP_WARM');
          reasons.add('public_witness_anchor');
        }
        if ((record as any).audienceClass === 'SHADOW' && this.config.preserveShadowSignals) {
          action = this.promoteAction(action, 'SHADOW_ONLY');
          reasons.add('shadow_only_anchor');
        }
        if ((record as any).lifecycle === 'SPENT') {
          reasons.add('spent_state');
        }
        if ((record as any).lifecycle === 'ARCHIVED') {
          reasons.add('archived_state');
        }

        this.applyCountCaps(quoteKindCounts, (record as any).kind, this.config.maxSameQuoteKindRetained, reasons, (nextAction) => {
          action = this.demoteAction(action, nextAction);
        }, 'same_quote_cluster');
        this.applyCountCaps(counterpartCounts, (record as any).counterpartId, this.config.maxSameCounterpartRetained, reasons, (nextAction) => {
          action = this.demoteAction(action, nextAction);
        }, 'same_counterpart_cluster');

        this.increment(quoteKindCounts, (record as any).kind);
        this.increment(counterpartCounts, (record as any).counterpartId);

        const decision = this.toDecision('QUOTE', (record as any).quoteId, action, score, reasons, {
          createdAt: record.createdAt,
          actorId: (record as any).actorId,
          counterpartId: (record as any).counterpartId,
          roomId: (record as any).context.roomId,
          channelId: (record as any).context.channelId,
          tags: record.tags ?? [],
          summaryKey: this.quoteSummaryKey(record),
        });
        auditTrail.push(`quote:${(record as any).quoteId}:${action}:${score.score01.toFixed(3)}`);
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

        if ((record as any).evidenceCount > 0 && this.config.keepProofAnchors) {
          action = this.promoteAction(action, 'KEEP_WARM');
          reasons.add('proof_anchor');
        }
        if (record.mode === 'RESCUE' && this.config.keepRescueAnchors) {
          action = this.promoteAction(action, 'KEEP_HOT');
          reasons.add('rescue_anchor');
        }
        if (record.mode === 'RIVAL_ONLY' || (record as any).kind === 'RELATIONSHIP') {
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
        if ((record as any).channelHint?.includes('SHADOW') && this.config.preserveShadowSignals) {
          action = this.promoteAction(action, 'SHADOW_ONLY');
          reasons.add('shadow_only_anchor');
        }
        if ((record as any).lifecycle === 'PENDING' || (record as any).lifecycle === 'PLANNED') {
          action = this.promoteAction(action, 'KEEP_HOT');
          reasons.add('active_callback');
          reasons.add('future_reveal');
        }
        if ((record as any).lifecycle === 'SPENT') {
          reasons.add('spent_state');
        }
        if ((record as any).lifecycle === 'ARCHIVED') {
          reasons.add('archived_state');
        }

        this.applyCountCaps(callbackKindCounts, (record as any).kind, this.config.maxSameCallbackKindRetained, reasons, (nextAction) => {
          action = this.demoteAction(action, nextAction);
        }, 'same_callback_cluster');
        this.applyCountCaps(counterpartCounts, (record as any).counterpartId, this.config.maxSameCounterpartRetained, reasons, (nextAction) => {
          action = this.demoteAction(action, nextAction);
        }, 'same_counterpart_cluster');

        this.increment(callbackKindCounts, (record as any).kind);
        this.increment(counterpartCounts, (record as any).counterpartId);

        const decision = this.toDecision('CALLBACK', record.callbackId, action, score, reasons, {
          createdAt: record.createdAt,
          actorId: (record as any).actorId,
          counterpartId: (record as any).counterpartId,
          roomId: (record as any).context.roomId,
          channelId: (record as any).context.channelId,
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
        (event as any).context.roomId,
        (event as any).context.tags ?? [],
        event.body,
        decision.reasons,
      );
    }

    for (const quote of snapshot.quotes) {
      const decision = decisionMap.get((quote as any).quoteId);
      if (!decision || decision.action !== 'SUMMARIZE') {
        continue;
      }
      pushGroupMember(
        decision.summaryKey,
        'QUOTE',
        (quote as any).quoteId,
        quote.createdAt,
        (quote as any).actorId,
        (quote as any).counterpartId,
        (quote as any).context.roomId,
        quote.tags ?? [],
        (quote as any).text,
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
        (callback as any).actorId,
        (callback as any).counterpartId,
        (callback as any).context.roomId,
        callback.tags ?? [],
        (callback as any).text,
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
      (record as any).context.runId,
      (record as any).context.modeId,
      (record as any).context.roomId,
      (record as any).context.eventType,
      record.actor.actorId,
      record.counterpart?.actorId,
    ]);
  }

  private quoteSummaryKey(record: ConversationMemoryQuoteRecord): string {
    return groupKey([
      'quote',
      (record as any).context.runId,
      (record as any).context.roomId,
      (record as any).kind,
      (record as any).actorId,
      (record as any).counterpartId,
    ]);
  }

  private callbackSummaryKey(record: ConversationMemoryCallbackRecord): string {
    return groupKey([
      'callback',
      (record as any).context.runId,
      (record as any).context.roomId,
      (record as any).kind,
      record.mode,
      (record as any).actorId,
      (record as any).counterpartId,
    ]);
  }

  private isRelationshipAnchorEvent(record: ConversationMemoryEventRecord): boolean {
    return (record as any).context.eventType === 'RIVALRY_ESCALATION' || (record as any).context.eventType === 'HELPER_INTERVENTION';
  }

  private isRescueAnchorEvent(record: ConversationMemoryEventRecord): boolean {
    return (record as any).context.eventType === 'RESCUE_INTERVENTION' || (record as any).context.channelId === 'RESCUE_SHADOW';
  }

  private isRivalryAnchorEvent(record: ConversationMemoryEventRecord): boolean {
    return (record as any).context.eventType === 'RIVALRY_ESCALATION' || (record as any).context.channelId === 'RIVALRY_SHADOW';
  }

  private isLegendAnchorEvent(record: ConversationMemoryEventRecord): boolean {
    return (record as any).context.eventType === 'RUN_END' && normalizeText(record.body).includes('legend');
  }

  private isDealRoomAnchorEvent(record: ConversationMemoryEventRecord): boolean {
    return (record as any).context.eventType === 'DEAL_ROOM_PRESSURE' || (record as any).context.channelId === 'DEAL_ROOM';
  }

  private isRelationshipAnchorQuote(record: ConversationMemoryQuoteRecord): boolean {
    return (record as any).kind === 'RECEIPT' || (record as any).kind === 'PROMISE' || (record as any).kind === 'CONFESSION';
  }

  private isLegendAnchorQuote(record: ConversationMemoryQuoteRecord): boolean {
    return (record as any).intent === 'LEGEND_ARCHIVE' || (record as any).context.tags?.includes('LEGEND') === true;
  }

  private isPostRunAnchorQuote(record: ConversationMemoryQuoteRecord): boolean {
    return (record as any).intent === 'POST_RUN_RECKONING' || (record as any).context.tags?.includes('POST_RUN') === true;
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


  // ==========================================================================
  // MARK: Semantic clustering before compression
  // ==========================================================================

  /** Cluster related events before compression to avoid fragmenting narratives. */
  public clusterEventsForCompression(events: readonly ConversationMemoryEventRecord[]): readonly SemanticMemoryCluster[] {
    const clusters: SemanticMemoryCluster[] = [];
    const assigned = new Set<string>();
    const sorted = [...events].sort((a, b) => a.createdAt - b.createdAt);

    for (const event of sorted) {
      if (assigned.has(event.memoryId)) continue;
      const cluster: ConversationMemoryEventRecord[] = [event];
      assigned.add(event.memoryId);

      for (const candidate of sorted) {
        if (assigned.has(candidate.memoryId)) continue;
        if (this.shouldClusterTogether(event, candidate)) {
          cluster.push(candidate);
          assigned.add(candidate.memoryId);
        }
      }

      if (cluster.length >= 2) {
        const avgSalience = cluster.reduce((s, e) => s + e.salience01, 0) / cluster.length;
        const maxHostility = Math.max(...cluster.map((e) => e.hostility01));
        const maxEmbarrassment = Math.max(...cluster.map((e) => e.embarrassment01));
        const counterparts = [...new Set(cluster.map((e) => e.counterpart?.actorId).filter(Boolean))];
        clusters.push({
          clusterId: `cluster:${event.memoryId}:${cluster.length}`,
          events: Object.freeze(cluster),
          centroidEventId: cluster.sort((a, b) => b.salience01 - a.salience01)[0]!.memoryId,
          counterpartIds: Object.freeze(counterparts as string[]),
          channelId: (event as any).context.channelId,
          timeSpanMs: cluster[cluster.length - 1]!.createdAt - cluster[0]!.createdAt,
          avgSalience01: avgSalience,
          maxHostility01: maxHostility,
          maxEmbarrassment01: maxEmbarrassment,
          eventCount: cluster.length,
          isNarrativeArc: this.isNarrativeArc(cluster),
        });
      }
    }
    return Object.freeze(clusters);
  }

  /** Determine if two events should be clustered together. */
  private shouldClusterTogether(a: ConversationMemoryEventRecord, b: ConversationMemoryEventRecord): boolean {
    const timeDelta = Math.abs(a.createdAt - b.createdAt);
    if (timeDelta > 1000 * 60 * 15) return false;
    if (a.counterpart?.actorId && a.counterpart.actorId === b.counterpart?.actorId) return true;
    if (a.context.channelId === b.context.channelId && a.context.sceneId && a.context.sceneId === b.context.sceneId) return true;
    const emotionDelta = Math.abs(a.hostility01 - b.hostility01) + Math.abs(a.embarrassment01 - b.embarrassment01);
    if (emotionDelta < 0.3 && a.context.channelId === b.context.channelId) return true;
    return false;
  }

  // ==========================================================================
  // MARK: Narrative arc detection and preservation
  // ==========================================================================

  /** Detect if a cluster of events forms a narrative arc. */
  private isNarrativeArc(events: readonly ConversationMemoryEventRecord[]): boolean {
    if (events.length < 3) return false;
    const sorted = [...events].sort((a, b) => a.createdAt - b.createdAt);
    const hasRise = sorted.some((e) => e.hostility01 >= 0.5 || e.confidence01 >= 0.6);
    const hasClimax = sorted.some((e) => e.salience01 >= 0.6);
    const hasResolution = sorted.some((e) => e.context.eventType === 'RESCUE_INTERVENTION' || e.context.eventType === 'RUN_END' || e.embarrassment01 >= 0.5);
    return hasRise && hasClimax && (hasResolution || events.length >= 5);
  }

  /** Identify narrative arcs in the memory and protect them from compression. */
  public identifyNarrativeArcs(store: ConversationMemoryStore, playerId: string): readonly NarrativeArc[] {
    const snapshot = store.getSnapshot(playerId);
    const clusters = this.clusterEventsForCompression(snapshot.events);
    return Object.freeze(clusters.filter((c) => c.isNarrativeArc).map((c) => ({
      arcId: `arc:${c.clusterId}`,
      clusterId: c.clusterId,
      eventIds: Object.freeze(c.events.map((e) => e.memoryId)),
      centroidEventId: c.centroidEventId,
      arcStrength01: c.avgSalience01,
      isProtected: c.avgSalience01 >= 0.35,
    })));
  }

  /** Override compression decisions to protect narrative arc integrity. */
  public preserveArcIntegrity(plan: MemoryCompressionPlan, arcs: readonly NarrativeArc[]): MemoryCompressionPlan {
    const protectedIds = new Set<string>();
    for (const arc of arcs) {
      if (arc.isProtected) {
        for (const id of arc.eventIds) protectedIds.add(id);
      }
    }
    const adjusted = plan.decisions.map((d) => {
      if (protectedIds.has((d as any).entityId) && (d.action === 'DELETE' || d.action === 'SUMMARIZE')) {
        return { ...d, action: 'KEEP_HOT' as const, reasonCodes: [...(d as any).reasonCodes, 'arc_integrity_protection'] };
      }
      return d;
    });
    return { ...plan, decisions: adjusted };
  }

  // ==========================================================================
  // MARK: Mode-specific compression rates
  // ==========================================================================

  private static readonly MODE_COMPRESSION: Readonly<Record<string, ModeCompressionProfile>> = Object.freeze({
    'GO_ALONE': { modeId: 'GO_ALONE', ambientAggressiveness01: 0.7, rescuePreservation01: 0.95, postRunAggressiveness01: 0.45, teamPreservation01: 0.2 },
    'HEAD_TO_HEAD': { modeId: 'HEAD_TO_HEAD', ambientAggressiveness01: 0.35, rescuePreservation01: 0.6, postRunAggressiveness01: 0.8, teamPreservation01: 0.1 },
    'TEAM_UP': { modeId: 'TEAM_UP', ambientAggressiveness01: 0.5, rescuePreservation01: 0.85, postRunAggressiveness01: 0.4, teamPreservation01: 0.95 },
    'CHASE_A_LEGEND': { modeId: 'CHASE_A_LEGEND', ambientAggressiveness01: 0.55, rescuePreservation01: 0.5, postRunAggressiveness01: 0.65, teamPreservation01: 0.15 },
  });

  /** Get mode-specific compression profile. */
  public getModeCompressionProfile(modeId: string | undefined): ModeCompressionProfile {
    return MemoryCompressionPolicy.MODE_COMPRESSION[modeId ?? ''] ?? MemoryCompressionPolicy.MODE_COMPRESSION['GO_ALONE']!;
  }

  // ==========================================================================
  // MARK: Privacy-aware compression
  // ==========================================================================

  /** Compute the maximum privacy class any memory in a summary group can have. */
  public privacyCeilingForSummary(events: readonly ConversationMemoryEventRecord[]): 'PUBLIC' | 'TEAM' | 'PRIVATE' | 'SHADOW' {
    const levels = events.map((e) => e.context.privacyLevel ?? 'PUBLIC');
    if (levels.includes('SHADOW')) return 'SHADOW';
    if (levels.includes('PRIVATE')) return 'PRIVATE';
    if (levels.includes('TEAM')) return 'TEAM';
    return 'PUBLIC';
  }

  // ==========================================================================
  // MARK: Real-time budget monitoring
  // ==========================================================================

  /** Check current memory utilization and whether emergency compression is needed. */
  public currentUtilization(store: ConversationMemoryStore, playerId: string): MemoryBudgetUtilization {
    const snapshot = store.getSnapshot(playerId);
    const eventUtil = snapshot.events.length / (this.config as any).eventBudget;
    const quoteUtil = snapshot.quotes.length / (this.config as any).quoteBudget;
    const callbackUtil = snapshot.callbacks.length / (this.config as any).callbackBudget;
    const maxUtil = Math.max(eventUtil, quoteUtil, callbackUtil);
    return {
      eventUtilization01: Math.min(1, eventUtil),
      quoteUtilization01: Math.min(1, quoteUtil),
      callbackUtilization01: Math.min(1, callbackUtil),
      overallUtilization01: Math.min(1, maxUtil),
      needsEmergencyCompression: maxUtil >= 0.9,
      needsSoftCompression: maxUtil >= 0.7,
    };
  }

  /** Generate an emergency compression plan for when budgets are about to overflow. */
  public emergencyCompressionPlan(store: ConversationMemoryStore, context: MemoryCompressionContext): MemoryCompressionPlan {
    const plan = this.plan(store, context);
    const aggressive = plan.decisions.map((d) => {
      if (d.action === 'KEEP_WARM') return { ...d, action: 'ARCHIVE' as const, reasonCodes: [...(d as any).reasonCodes, 'emergency_compression'] };
      if (d.action === 'ARCHIVE') return { ...d, action: 'SUMMARIZE' as const, reasonCodes: [...(d as any).reasonCodes, 'emergency_compression'] };
      return d;
    });
    return { ...plan, decisions: aggressive };
  }

  // ==========================================================================
  // MARK: Post-run compression ritual
  // ==========================================================================

  /** Generate a compressed narrative capsule of an entire run for cross-run bridging. */
  public generateRunCapsule(store: ConversationMemoryStore, playerId: string, runId: string): RunMemoryCapsule {
    const snapshot = store.getSnapshot(playerId);
    const runEvents = snapshot.events.filter((e) => e.context.runId === runId);
    const runQuotes = snapshot.quotes.filter((q) => q.evidence.some((e) => e.runId === runId));
    const runCallbacks = snapshot.callbacks.filter((c) => c.context.runId === runId);

    const legendEvents = runEvents.filter((e) => e.salience01 >= 0.85);
    const highEvents = runEvents.filter((e) => e.salience01 >= 0.55 && e.salience01 < 0.85);
    const totalHostility = runEvents.reduce((s, e) => s + e.hostility01, 0);
    const totalEmbarrassment = runEvents.reduce((s, e) => s + e.embarrassment01, 0);
    const totalConfidence = runEvents.reduce((s, e) => s + e.confidence01, 0);

    return {
      capsuleId: `capsule:${playerId}:${runId}`,
      playerId, runId,
      createdAt: Date.now(),
      eventCount: runEvents.length,
      quoteCount: runQuotes.length,
      callbackCount: runCallbacks.length,
      legendEventIds: Object.freeze(legendEvents.map((e) => e.memoryId)),
      highEventIds: Object.freeze(highEvents.map((e) => e.memoryId)),
      unresolvedCallbackIds: Object.freeze(runCallbacks.filter((c) => c.unresolved).map((c) => c.callbackId)),
      avgHostility01: runEvents.length > 0 ? totalHostility / runEvents.length : 0,
      avgEmbarrassment01: runEvents.length > 0 ? totalEmbarrassment / runEvents.length : 0,
      avgConfidence01: runEvents.length > 0 ? totalConfidence / runEvents.length : 0,
      dominantChannel: this.dominantChannel(runEvents),
      dominantCounterpartId: this.dominantCounterpart(runEvents),
    };
  }

  private dominantChannel(events: readonly ConversationMemoryEventRecord[]): string {
    const counts = new Map<string, number>();
    for (const e of events) counts.set(e.context.channelId, (counts.get(e.context.channelId) ?? 0) + 1);
    let best = 'GLOBAL'; let bestCount = 0;
    for (const [ch, count] of counts) { if (count > bestCount) { best = ch; bestCount = count; } }
    return best;
  }

  private dominantCounterpart(events: readonly ConversationMemoryEventRecord[]): string | undefined {
    const counts = new Map<string, number>();
    for (const e of events) {
      const cp = e.counterpart?.actorId;
      if (cp) counts.set(cp, (counts.get(cp) ?? 0) + 1);
    }
    let best: string | undefined; let bestCount = 0;
    for (const [cp, count] of counts) { if (count > bestCount) { best = cp; bestCount = count; } }
    return best;
  }




  // ==========================================================================
  // MARK: Compression undo / rehydration
  // ==========================================================================

  private readonly _compressionLog = new Map<string, CompressionUndoEntry[]>();

  /** Log a compression action for potential undo. */
  public logCompression(playerId: string, entityId: string, action: MemoryCompressionAction, originalData: string): void {
    const entries = this._compressionLog.get(playerId) ?? [];
    entries.push({ entityId, action, originalData, compressedAt: Date.now(), rehydrated: false });
    if (entries.length > 512) entries.splice(0, entries.length - 512);
    this._compressionLog.set(playerId, entries);
  }

  /** Attempt to rehydrate a compressed memory. */
  public attemptRehydration(playerId: string, entityId: string): CompressionUndoEntry | undefined {
    const entries = this._compressionLog.get(playerId) ?? [];
    const entry = entries.find((e) => e.entityId === entityId && !e.rehydrated);
    if (entry) { entry.rehydrated = true; }
    return entry;
  }

  /** Count available rehydrations for a player. */
  public availableRehydrations(playerId: string): number {
    return (this._compressionLog.get(playerId) ?? []).filter((e) => !e.rehydrated).length;
  }

  // ==========================================================================
  // MARK: Compression diagnostics
  // ==========================================================================

  /** Generate a diagnostic summary of compression state. */
  public buildCompressionDiagnostic(store: ConversationMemoryStore, playerId: string): readonly string[] {
    const utilization = this.currentUtilization(store, playerId);
    const lines: string[] = [];
    lines.push(`compression_diagnostic|player=${playerId}`);
    lines.push(`events=${utilization.eventUtilization01.toFixed(3)}|quotes=${utilization.quoteUtilization01.toFixed(3)}|callbacks=${utilization.callbackUtilization01.toFixed(3)}`);
    lines.push(`overall=${utilization.overallUtilization01.toFixed(3)}|emergency=${utilization.needsEmergencyCompression}|soft=${utilization.needsSoftCompression}`);
    lines.push(`rehydrations_available=${this.availableRehydrations(playerId)}`);
    return lines;
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
