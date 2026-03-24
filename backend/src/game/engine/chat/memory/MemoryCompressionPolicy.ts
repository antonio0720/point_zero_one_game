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


function average(values: readonly number[]): number {
  if (values.length <= 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function maxNumber(values: readonly number[]): number {
  if (values.length <= 0) {
    return 0;
  }
  return values.reduce((max, value) => (value > max ? value : max), values[0] ?? 0);
}

function minNumber(values: readonly number[]): number {
  if (values.length <= 0) {
    return 0;
  }
  return values.reduce((min, value) => (value < min ? value : min), values[0] ?? 0);
}

function histogramIncrement<K extends string>(map: Map<K, number>, key: K): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function sortDecisionsByCreatedAt<T extends { readonly createdAt: number }>(values: readonly T[]): readonly T[] {
  return [...values].sort((left, right) => right.createdAt - left.createdAt);
}

function safeIncludes(values: readonly string[] | undefined, target: string): boolean {
  return Array.isArray(values) && values.includes(target);
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


// ============================================================================
// MARK: Compression analytics, preview, and execution surfaces
// ============================================================================

export interface MemoryCompressionReasonHistogramEntry {
  readonly reason: MemoryCompressionReasonCode;
  readonly count: number;
  readonly domains: readonly MemoryCompressionDomain[];
  readonly actions: readonly MemoryCompressionAction[];
}

export interface MemoryCompressionActionHistogramEntry {
  readonly action: MemoryCompressionAction;
  readonly count: number;
  readonly averageScore01: number;
  readonly hottestId?: string;
}

export interface MemoryCompressionDomainSnapshot {
  readonly domain: MemoryCompressionDomain;
  readonly totalRecords: number;
  readonly keepHotCount: number;
  readonly keepWarmCount: number;
  readonly archiveCount: number;
  readonly summarizeCount: number;
  readonly deleteCount: number;
  readonly shadowOnlyCount: number;
  readonly averageScore01: number;
  readonly hottestId?: string;
  readonly coldestId?: string;
}

export interface MemoryCompressionCounterpartDigest {
  readonly counterpartId: string;
  readonly totalCount: number;
  readonly keepHotCount: number;
  readonly keptCount: number;
  readonly archivedCount: number;
  readonly summarizedCount: number;
  readonly deletedCount: number;
  readonly hottestIds: readonly string[];
}

export interface MemoryCompressionChannelDigest {
  readonly channelId: string;
  readonly totalCount: number;
  readonly keepHotCount: number;
  readonly keepWarmCount: number;
  readonly shadowOnlyCount: number;
  readonly summarizeCount: number;
  readonly deleteCount: number;
  readonly averageScore01: number;
}

export interface MemoryCompressionRoomDigest {
  readonly roomId: string;
  readonly totalCount: number;
  readonly domainMix: Readonly<Record<MemoryCompressionDomain, number>>;
  readonly actionMix: Readonly<Record<MemoryCompressionAction, number>>;
  readonly hottestIds: readonly string[];
}

export interface MemoryCompressionClusterDigest {
  readonly clusterId: string;
  readonly centroidEventId: string;
  readonly eventCount: number;
  readonly avgSalience01: number;
  readonly maxHostility01: number;
  readonly maxEmbarrassment01: number;
  readonly protectedCount: number;
  readonly summarizeCount: number;
  readonly deleteCount: number;
  readonly isNarrativeArc: boolean;
}

export interface MemoryCompressionWindowDigest {
  readonly hotWindowCount: number;
  readonly warmWindowCount: number;
  readonly archiveWindowCount: number;
  readonly olderThanArchiveWindowCount: number;
}

export interface MemoryCompressionBudgetAdvice {
  readonly severity: 'NONE' | 'SOFT' | 'HARD' | 'EMERGENCY';
  readonly recommendedAction: 'NONE' | 'TUNE_CONFIG' | 'RUN_PLAN' | 'RUN_EMERGENCY_PLAN';
  readonly summary: string;
  readonly utilization: MemoryBudgetUtilization;
}

export interface MemoryCompressionAuditEntry {
  readonly id: string;
  readonly domain: MemoryCompressionDomain;
  readonly action: MemoryCompressionAction;
  readonly score01: number;
  readonly tier: MemorySalienceTier;
  readonly reasonCount: number;
  readonly primaryReason?: MemoryCompressionReasonCode;
  readonly actorId?: string;
  readonly counterpartId?: string;
  readonly roomId?: string;
  readonly channelId?: string;
  readonly tags: readonly string[];
}

export interface MemoryCompressionAuditReport {
  readonly playerId: string;
  readonly createdAt: number;
  readonly domains: readonly MemoryCompressionDomainSnapshot[];
  readonly reasons: readonly MemoryCompressionReasonHistogramEntry[];
  readonly actions: readonly MemoryCompressionActionHistogramEntry[];
  readonly counterparts: readonly MemoryCompressionCounterpartDigest[];
  readonly channels: readonly MemoryCompressionChannelDigest[];
  readonly rooms: readonly MemoryCompressionRoomDigest[];
  readonly clusters: readonly MemoryCompressionClusterDigest[];
  readonly windows: MemoryCompressionWindowDigest;
  readonly budgetAdvice: MemoryCompressionBudgetAdvice;
  readonly auditTrail: readonly string[];
}

export interface MemoryCompressionPlanPreview {
  readonly plan: MemoryCompressionPlan;
  readonly diagnostics: MemoryCompressionAuditReport;
  readonly summaryText: string;
}

export interface MemoryCompressionExecutionReceipt {
  readonly playerId: string;
  readonly createdAt: number;
  readonly appliedIds: readonly string[];
  readonly archivedIds: readonly string[];
  readonly summarizedIds: readonly string[];
  readonly deletedIds: readonly string[];
  readonly shadowOnlyIds: readonly string[];
  readonly rehydrationBudget: number;
  readonly auditTrail: readonly string[];
}

export interface MemoryCompressionPlanComparison {
  readonly leftCreatedAt: number;
  readonly rightCreatedAt: number;
  readonly changedIds: readonly string[];
  readonly promotedIds: readonly string[];
  readonly demotedIds: readonly string[];
  readonly newlyDeletedIds: readonly string[];
  readonly newlyProtectedIds: readonly string[];
  readonly summary: string;
}

export interface MemoryCompressionNarrativePacket {
  readonly title: string;
  readonly summary: string;
  readonly hotMoments: readonly string[];
  readonly protectedArcs: readonly string[];
  readonly shadowPreservationNotes: readonly string[];
  readonly deletionWarnings: readonly string[];
}

export interface MemoryCompressionPreset {
  readonly presetId: 'BALANCED' | 'AGGRESSIVE' | 'SHADOW_LOCKED' | 'PROOF_LOCKED' | 'POST_RUN';
  readonly description: string;
  readonly config: Partial<MemoryCompressionConfig>;
}

export interface MemoryCompressionSummaryLedgerEntry {
  readonly summaryKey: string;
  readonly domain: MemoryCompressionDomain;
  readonly memberCount: number;
  readonly latestAt: number;
  readonly privacyCeiling: 'PUBLIC' | 'TEAM' | 'PRIVATE' | 'SHADOW';
  readonly tags: readonly string[];
}

export interface MemoryCompressionRunBridge {
  readonly runId: string;
  readonly capsule: RunMemoryCapsule;
  readonly hotIds: readonly string[];
  readonly summaryIds: readonly string[];
  readonly callbackIds: readonly string[];
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

    const clustered = this.applyClusterProtections(snapshot, decisions, auditTrail);
    const modeAdjusted = this.applyModePressureAdjustments(snapshot, clustered, auditTrail);
    const supportAdjusted = this.applySummarySupportAdjustments(snapshot, modeAdjusted, auditTrail);
    const privacyAdjusted = this.applyPrivacyAndShadowGuards(snapshot, supportAdjusted, auditTrail);
    const budgeted = this.enforceBudgets(privacyAdjusted, auditTrail);
    const summaries = this.buildSummaryGroups(snapshot, budgeted, auditTrail, createdAt);
    const normalized = this.normalizeSummarySupportDecisions(budgeted, summaries, auditTrail);
    return this.buildPlanResult(context.playerId, createdAt, normalized, summaries, auditTrail);
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

        histogramIncrement(actorCounts, record.actor.actorId);
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

    if (isHotTier(score.tier)) {
      reasons.add(score.tier === 'LEGEND' ? 'legend_salience' : 'critical_salience');
      return 'KEEP_HOT';
    }
    if (ageMs <= this.config.hotWindowMs || score.score01 >= this.config.keepHotBelowScore01) {
      reasons.add('hot_window');
      return 'KEEP_HOT';
    }
    if (ageMs <= this.config.warmWindowMs || score.score01 >= this.config.keepWarmBelowScore01 || isWarmTier(score.tier)) {
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
        const maxHostility = maxNumber(cluster.map((e) => e.hostility01));
        const maxEmbarrassment = maxNumber(cluster.map((e) => e.embarrassment01));
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
    for (const e of events) histogramIncrement(counts, e.context.channelId);
    let best = 'GLOBAL'; let bestCount = 0;
    for (const [ch, count] of counts) { if (count > bestCount) { best = ch; bestCount = count; } }
    return best;
  }

  private dominantCounterpart(events: readonly ConversationMemoryEventRecord[]): string | undefined {
    const counts = new Map<string, number>();
    for (const e of events) {
      const cp = e.counterpart?.actorId;
      if (cp) histogramIncrement(counts, cp);
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
    lines.push(`overall=${utilization.overallUtilization01.toFixed(3)}|min_domain=${minNumber([utilization.eventUtilization01, utilization.quoteUtilization01, utilization.callbackUtilization01]).toFixed(3)}|emergency=${utilization.needsEmergencyCompression}|soft=${utilization.needsSoftCompression}`);
    lines.push(`rehydrations_available=${this.availableRehydrations(playerId)}`);
    return lines;
  }

  // ==========================================================================
  // MARK: Deep plan shaping and orchestration
  // ==========================================================================

  private buildPlanResult(
    playerId: string,
    createdAt: number,
    decisions: readonly MemoryCompressionDecision[],
    summaries: readonly MemoryCompressionSummaryGroup[],
    auditTrail: readonly string[],
  ): MemoryCompressionPlan {
    return {
      playerId,
      createdAt,
      decisions,
      summaries,
      keepHotIds: decisions.filter((decision) => decision.action === 'KEEP_HOT').map((decision) => decision.id),
      keepWarmIds: decisions.filter((decision) => decision.action === 'KEEP_WARM').map((decision) => decision.id),
      archiveIds: decisions.filter((decision) => decision.action === 'ARCHIVE').map((decision) => decision.id),
      summarizeIds: decisions.filter((decision) => decision.action === 'SUMMARIZE').map((decision) => decision.id),
      deleteIds: decisions.filter((decision) => decision.action === 'DELETE').map((decision) => decision.id),
      shadowOnlyIds: decisions.filter((decision) => decision.action === 'SHADOW_ONLY').map((decision) => decision.id),
      auditTrail: [...auditTrail],
    };
  }

  private normalizeSummarySupportDecisions(
    decisions: readonly MemoryCompressionDecision[],
    summaries: readonly MemoryCompressionSummaryGroup[],
    auditTrail: string[],
  ): readonly MemoryCompressionDecision[] {
    const summaryMemberIds = new Set<string>();
    const summaryReasonMap = new Map<string, Set<MemoryCompressionReasonCode>>();
    for (const summary of summaries) {
      for (const memberId of summary.memberIds) {
        summaryMemberIds.add(memberId);
        const next = summaryReasonMap.get(memberId) ?? new Set<MemoryCompressionReasonCode>();
        next.add('summary_support');
        for (const reason of summary.reasons) {
          next.add(reason);
        }
        summaryReasonMap.set(memberId, next);
      }
    }
    return decisions.map((decision) => {
      if (!summaryMemberIds.has(decision.id)) {
        return decision;
      }
      const reasons = new Set(decision.reasons);
      for (const reason of summaryReasonMap.get(decision.id) ?? []) {
        reasons.add(reason);
      }
      if (decision.action === 'DELETE') {
        auditTrail.push(`summary_support:${decision.domain}:${decision.id}:DELETE->SUMMARIZE`);
        return {
          ...decision,
          action: 'SUMMARIZE',
          reasons: Array.from(reasons),
        };
      }
      return {
        ...decision,
        reasons: Array.from(reasons),
      };
    });
  }

  private applyClusterProtections(
    snapshot: ConversationMemorySnapshot,
    decisions: readonly MemoryCompressionDecision[],
    auditTrail: string[],
  ): readonly MemoryCompressionDecision[] {
    const clusters = this.clusterEventsForCompression(snapshot.events);
    const protectedIds = new Set<string>();
    const supportIds = new Set<string>();
    for (const cluster of clusters) {
      if (cluster.isNarrativeArc || cluster.avgSalience01 >= 0.62 || cluster.maxHostility01 >= 0.78) {
        for (const event of cluster.events) {
          protectedIds.add(event.memoryId);
        }
      } else if (cluster.eventCount >= this.config.minimumSummaryMembers) {
        for (const event of cluster.events) {
          supportIds.add(event.memoryId);
        }
      }
    }
    return decisions.map((decision) => {
      if (decision.domain !== 'EVENT') {
        return decision;
      }
      const reasons = new Set(decision.reasons);
      if (protectedIds.has(decision.id)) {
        reasons.add('collapse_preservation');
        reasons.add('retention_floor');
        const nextAction = this.promoteAction(decision.action, 'KEEP_WARM');
        if (nextAction !== decision.action) {
          auditTrail.push(`cluster_protect:${decision.id}:${decision.action}->${nextAction}`);
        }
        return { ...decision, action: nextAction, reasons: Array.from(reasons) };
      }
      if (supportIds.has(decision.id) && decision.action === 'DELETE') {
        reasons.add('summary_support');
        auditTrail.push(`cluster_support:${decision.id}:DELETE->SUMMARIZE`);
        return { ...decision, action: 'SUMMARIZE', reasons: Array.from(reasons) };
      }
      return decision;
    });
  }

  private applyModePressureAdjustments(
    snapshot: ConversationMemorySnapshot,
    decisions: readonly MemoryCompressionDecision[],
    auditTrail: string[],
  ): readonly MemoryCompressionDecision[] {
    const modeWeights = new Map<string, ModeCompressionProfile>();
    for (const event of snapshot.events) {
      const modeId = String((event as any).context.modeId ?? 'GO_ALONE');
      if (!modeWeights.has(modeId)) {
        modeWeights.set(modeId, this.getModeCompressionProfile(modeId));
      }
    }
    return decisions.map((decision) => {
      const relatedEvent = snapshot.events.find((event) => event.memoryId === decision.id);
      const modeId = String((relatedEvent as any)?.context?.modeId ?? 'GO_ALONE');
      const profile = modeWeights.get(modeId) ?? this.getModeCompressionProfile(modeId);
      const reasons = new Set(decision.reasons);
      let nextAction = decision.action;
      if (decision.domain === 'CALLBACK' && modeId === 'TEAM_UP' && profile.teamPreservation01 >= 0.9) {
        nextAction = this.promoteAction(nextAction, 'KEEP_WARM');
        reasons.add('retention_floor');
      }
      if (decision.domain === 'QUOTE' && modeId === 'HEAD_TO_HEAD' && profile.postRunAggressiveness01 >= 0.75 && safeIncludes(decision.tags, 'POST_RUN')) {
        nextAction = this.promoteAction(nextAction, 'KEEP_WARM');
        reasons.add('post_run_anchor');
      }
      if (decision.domain === 'EVENT' && profile.rescuePreservation01 >= 0.85 && safeIncludes(decision.tags, 'RESCUE')) {
        nextAction = this.promoteAction(nextAction, 'KEEP_HOT');
        reasons.add('rescue_anchor');
      }
      if (nextAction !== decision.action) {
        auditTrail.push(`mode_adjust:${modeId}:${decision.id}:${decision.action}->${nextAction}`);
        return { ...decision, action: nextAction, reasons: Array.from(reasons) };
      }
      return decision;
    });
  }

  private applySummarySupportAdjustments(
    snapshot: ConversationMemorySnapshot,
    decisions: readonly MemoryCompressionDecision[],
    auditTrail: string[],
  ): readonly MemoryCompressionDecision[] {
    const groupedBySummaryKey = new Map<string, MemoryCompressionDecision[]>();
    for (const decision of decisions) {
      if (!decision.summaryKey) {
        continue;
      }
      const next = groupedBySummaryKey.get(decision.summaryKey) ?? [];
      next.push(decision);
      groupedBySummaryKey.set(decision.summaryKey, next);
    }
    const summarySupportIds = new Set<string>();
    for (const [summaryKey, members] of groupedBySummaryKey.entries()) {
      if (members.length < this.config.minimumSummaryMembers) {
        continue;
      }
      const nonDeletedMembers = members.filter((member) => member.action !== 'DELETE');
      if (nonDeletedMembers.length >= 1) {
        for (const member of members) {
          summarySupportIds.add(member.id);
        }
        auditTrail.push(`summary_support_group:${summaryKey}:members=${members.length}`);
      }
    }
    return decisions.map((decision) => {
      if (!summarySupportIds.has(decision.id)) {
        return decision;
      }
      const reasons = new Set(decision.reasons);
      reasons.add('summary_support');
      if (decision.action === 'DELETE') {
        auditTrail.push(`summary_promote:${decision.id}:DELETE->SUMMARIZE`);
        return { ...decision, action: 'SUMMARIZE', reasons: Array.from(reasons) };
      }
      return { ...decision, reasons: Array.from(reasons) };
    });
  }

  private applyPrivacyAndShadowGuards(
    snapshot: ConversationMemorySnapshot,
    decisions: readonly MemoryCompressionDecision[],
    auditTrail: string[],
  ): readonly MemoryCompressionDecision[] {
    const eventMap = new Map(snapshot.events.map((record) => [record.memoryId, record]));
    const quoteMap = new Map(snapshot.quotes.map((record) => [String((record as any).quoteId), record]));
    const callbackMap = new Map(snapshot.callbacks.map((record) => [record.callbackId, record]));
    return decisions.map((decision) => {
      const reasons = new Set(decision.reasons);
      let nextAction = decision.action;
      const privacyLevel = decision.domain === 'EVENT'
        ? String((eventMap.get(decision.id) as any)?.context?.privacyLevel ?? '')
        : decision.domain === 'QUOTE'
          ? String((quoteMap.get(decision.id) as any)?.context?.privacyLevel ?? '')
          : String((callbackMap.get(decision.id) as any)?.context?.privacyLevel ?? '');
      const channelId = String(decision.channelId ?? '');
      if (privacyLevel === 'PRIVATE' || privacyLevel === 'SHADOW') {
        reasons.add('privacy_lock');
        nextAction = this.promoteAction(nextAction, 'SHADOW_ONLY');
      }
      if (channelId.includes('SHADOW') && this.config.preserveShadowSignals) {
        reasons.add('shadow_only_anchor');
        nextAction = this.promoteAction(nextAction, 'SHADOW_ONLY');
      }
      if (nextAction !== decision.action) {
        auditTrail.push(`privacy_shadow:${decision.id}:${decision.action}->${nextAction}`);
        return { ...decision, action: nextAction, reasons: Array.from(reasons) };
      }
      return decision;
    });
  }

  public planWithDiagnostics(store: ConversationMemoryStore, context: MemoryCompressionContext): MemoryCompressionPlanPreview {
    const plan = this.plan(store, context);
    const diagnostics = this.buildAuditReport(store, plan);
    return {
      plan,
      diagnostics,
      summaryText: this.summarizePlan(plan),
    };
  }

  public preview(store: ConversationMemoryStore, context: MemoryCompressionContext): MemoryCompressionPlanPreview {
    return this.planWithDiagnostics(store, context);
  }

  public executePlan(store: ConversationMemoryStore, context: MemoryCompressionContext): MemoryCompressionExecutionReceipt {
    const plan = this.plan(store, context);
    return this.applyPlanWithReceipt(store, plan);
  }

  public applyPlanWithReceipt(store: ConversationMemoryStore, plan: MemoryCompressionPlan): MemoryCompressionExecutionReceipt {
    const appliedIds: string[] = [];
    const archivedIds: string[] = [];
    const summarizedIds: string[] = [];
    const deletedIds: string[] = [];
    const shadowOnlyIds: string[] = [];
    const before = store.getSnapshot(plan.playerId);
    const eventMap = new Map(before.events.map((record) => [record.memoryId, record]));
    const quoteMap = new Map(before.quotes.map((record) => [String((record as any).quoteId), record]));
    const callbackMap = new Map(before.callbacks.map((record) => [record.callbackId, record]));
    for (const decision of plan.decisions) {
      appliedIds.push(decision.id);
      const originalData = decision.domain === 'EVENT'
        ? JSON.stringify(eventMap.get(decision.id) ?? null)
        : decision.domain === 'QUOTE'
          ? JSON.stringify(quoteMap.get(decision.id) ?? null)
          : JSON.stringify(callbackMap.get(decision.id) ?? null);
      if (decision.action === 'ARCHIVE' || decision.action === 'SUMMARIZE' || decision.action === 'SHADOW_ONLY' || decision.action === 'DELETE') {
        this.logCompression(plan.playerId, decision.id, decision.action, originalData);
      }
      if (decision.action === 'ARCHIVE') {
        archivedIds.push(decision.id);
      }
      if (decision.action === 'SUMMARIZE') {
        summarizedIds.push(decision.id);
      }
      if (decision.action === 'DELETE') {
        deletedIds.push(decision.id);
      }
      if (decision.action === 'SHADOW_ONLY') {
        shadowOnlyIds.push(decision.id);
      }
    }
    this.applyPlan(store, plan);
    return {
      playerId: plan.playerId,
      createdAt: plan.createdAt,
      appliedIds: Object.freeze(appliedIds),
      archivedIds: Object.freeze(archivedIds),
      summarizedIds: Object.freeze(summarizedIds),
      deletedIds: Object.freeze(deletedIds),
      shadowOnlyIds: Object.freeze(shadowOnlyIds),
      rehydrationBudget: this.availableRehydrations(plan.playerId),
      auditTrail: Object.freeze([...plan.auditTrail]),
    };
  }

  public buildAuditReport(store: ConversationMemoryStore, plan: MemoryCompressionPlan): MemoryCompressionAuditReport {
    const snapshot = store.getSnapshot(plan.playerId);
    const domains = this.buildDomainSnapshots(plan.decisions);
    const reasons = this.buildReasonHistogram(plan.decisions);
    const actions = this.buildActionHistogram(plan.decisions);
    const counterparts = this.buildCounterpartDigests(plan.decisions);
    const channels = this.buildChannelDigests(plan.decisions);
    const rooms = this.buildRoomDigests(plan.decisions);
    const clusters = this.buildClusterDigests(snapshot, plan.decisions);
    const windows = this.buildWindowDigest(snapshot, plan.createdAt);
    const budgetAdvice = this.buildBudgetAdvice(store, plan.playerId);
    return {
      playerId: plan.playerId,
      createdAt: plan.createdAt,
      domains,
      reasons,
      actions,
      counterparts,
      channels,
      rooms,
      clusters,
      windows,
      budgetAdvice,
      auditTrail: Object.freeze([...plan.auditTrail]),
    };
  }

  public summarizePlan(plan: MemoryCompressionPlan): string {
    return [
      `hot=${plan.keepHotIds.length}`,
      `warm=${plan.keepWarmIds.length}`,
      `archive=${plan.archiveIds.length}`,
      `summaries=${plan.summarizeIds.length}`,
      `delete=${plan.deleteIds.length}`,
      `shadow=${plan.shadowOnlyIds.length}`,
    ].join(' | ');
  }

  public buildNarrativePacket(store: ConversationMemoryStore, plan: MemoryCompressionPlan): MemoryCompressionNarrativePacket {
    const snapshot = store.getSnapshot(plan.playerId);
    const hottest = sortDecisionsByCreatedAt(plan.decisions)
      .filter((decision) => decision.action === 'KEEP_HOT')
      .slice(0, 8)
      .map((decision) => `${decision.domain}:${decision.id}:${decision.reasons[0] ?? 'none'}`);
    const arcs = this.identifyNarrativeArcs(store, plan.playerId)
      .filter((arc) => arc.isProtected)
      .slice(0, 8)
      .map((arc) => `${arc.arcId}:${arc.eventIds.length}:${arc.arcStrength01.toFixed(3)}`);
    const shadowPreservationNotes = plan.decisions
      .filter((decision) => decision.action === 'SHADOW_ONLY')
      .slice(0, 8)
      .map((decision) => `${decision.domain}:${decision.id}:${decision.channelId ?? 'unknown'}`);
    const deletionWarnings = plan.decisions
      .filter((decision) => decision.action === 'DELETE')
      .slice(0, 8)
      .map((decision) => `${decision.domain}:${decision.id}:${decision.score01.toFixed(3)}`);
    return {
      title: `compression:${plan.playerId}:${plan.createdAt}`,
      summary: `${this.summarizePlan(plan)} | events=${snapshot.events.length} | quotes=${snapshot.quotes.length} | callbacks=${snapshot.callbacks.length}`,
      hotMoments: Object.freeze(hottest),
      protectedArcs: Object.freeze(arcs),
      shadowPreservationNotes: Object.freeze(shadowPreservationNotes),
      deletionWarnings: Object.freeze(deletionWarnings),
    };
  }

  public buildSummaryLedger(plan: MemoryCompressionPlan, store: ConversationMemoryStore): readonly MemoryCompressionSummaryLedgerEntry[] {
    const snapshot = store.getSnapshot(plan.playerId);
    const eventMap = new Map(snapshot.events.map((record) => [record.memoryId, record]));
    return Object.freeze(plan.summaries.map((summary) => ({
      summaryKey: summary.summaryKey,
      domain: summary.domain,
      memberCount: summary.memberIds.length,
      latestAt: summary.latestAt,
      privacyCeiling: summary.domain === 'EVENT'
        ? this.privacyCeilingForSummary(summary.memberIds.map((id) => eventMap.get(id)).filter(Boolean) as ConversationMemoryEventRecord[])
        : 'PUBLIC',
      tags: summary.tags,
    })));
  }

  public buildRunBridge(store: ConversationMemoryStore, playerId: string, runId: string): MemoryCompressionRunBridge {
    const capsule = this.generateRunCapsule(store, playerId, runId);
    const plan = this.plan(store, { playerId });
    return {
      runId,
      capsule,
      hotIds: Object.freeze(plan.keepHotIds.filter((id) => capsule.legendEventIds.includes(id) || capsule.highEventIds.includes(id))),
      summaryIds: Object.freeze(plan.summarizeIds.filter((id) => capsule.highEventIds.includes(id) || capsule.legendEventIds.includes(id))),
      callbackIds: Object.freeze(plan.keepHotIds.filter((id) => capsule.unresolvedCallbackIds.includes(id))),
    };
  }

  public comparePlans(left: MemoryCompressionPlan, right: MemoryCompressionPlan): MemoryCompressionPlanComparison {
    const leftMap = new Map(left.decisions.map((decision) => [decision.id, decision]));
    const rightMap = new Map(right.decisions.map((decision) => [decision.id, decision]));
    const changedIds: string[] = [];
    const promotedIds: string[] = [];
    const demotedIds: string[] = [];
    const newlyDeletedIds: string[] = [];
    const newlyProtectedIds: string[] = [];
    const order: readonly MemoryCompressionAction[] = ['DELETE', 'SUMMARIZE', 'ARCHIVE', 'DEFER', 'SHADOW_ONLY', 'KEEP_WARM', 'KEEP_HOT'];
    for (const [id, next] of rightMap.entries()) {
      const previous = leftMap.get(id);
      if (!previous) {
        changedIds.push(id);
        if (next.action === 'DELETE') {
          newlyDeletedIds.push(id);
        }
        if (next.action === 'KEEP_HOT' || next.action === 'KEEP_WARM') {
          newlyProtectedIds.push(id);
        }
        continue;
      }
      if (previous.action !== next.action) {
        changedIds.push(id);
        if (order.indexOf(next.action) > order.indexOf(previous.action)) {
          promotedIds.push(id);
        }
        if (order.indexOf(next.action) < order.indexOf(previous.action)) {
          demotedIds.push(id);
        }
        if (next.action === 'DELETE' && previous.action !== 'DELETE') {
          newlyDeletedIds.push(id);
        }
        if ((next.action === 'KEEP_HOT' || next.action === 'KEEP_WARM') && previous.action !== 'KEEP_HOT' && previous.action !== 'KEEP_WARM') {
          newlyProtectedIds.push(id);
        }
      }
    }
    return {
      leftCreatedAt: left.createdAt,
      rightCreatedAt: right.createdAt,
      changedIds: Object.freeze(changedIds),
      promotedIds: Object.freeze(promotedIds),
      demotedIds: Object.freeze(demotedIds),
      newlyDeletedIds: Object.freeze(newlyDeletedIds),
      newlyProtectedIds: Object.freeze(newlyProtectedIds),
      summary: `changed=${changedIds.length}|promoted=${promotedIds.length}|demoted=${demotedIds.length}|newlyDeleted=${newlyDeletedIds.length}|newlyProtected=${newlyProtectedIds.length}`,
    };
  }

  public buildBudgetAdvice(store: ConversationMemoryStore, playerId: string): MemoryCompressionBudgetAdvice {
    const utilization = this.currentUtilization(store, playerId);
    if (utilization.needsEmergencyCompression) {
      return {
        severity: 'EMERGENCY',
        recommendedAction: 'RUN_EMERGENCY_PLAN',
        summary: 'memory budgets are near or above the hard operating threshold',
        utilization,
      };
    }
    if (utilization.needsSoftCompression) {
      return {
        severity: 'SOFT',
        recommendedAction: 'RUN_PLAN',
        summary: 'memory budgets are above the preferred operating threshold',
        utilization,
      };
    }
    if (utilization.overallUtilization01 >= 0.55) {
      return {
        severity: 'HARD',
        recommendedAction: 'TUNE_CONFIG',
        summary: 'memory budgets are climbing and should be tuned before the next surge',
        utilization,
      };
    }
    return {
      severity: 'NONE',
      recommendedAction: 'NONE',
      summary: 'memory budgets are healthy',
      utilization,
    };
  }

  public buildReasonHistogram(decisions: readonly MemoryCompressionDecision[]): readonly MemoryCompressionReasonHistogramEntry[] {
    const counts = new Map<MemoryCompressionReasonCode, { count: number; domains: Set<MemoryCompressionDomain>; actions: Set<MemoryCompressionAction> }>();
    for (const decision of decisions) {
      for (const reason of decision.reasons) {
        const next = counts.get(reason) ?? { count: 0, domains: new Set<MemoryCompressionDomain>(), actions: new Set<MemoryCompressionAction>() };
        next.count += 1;
        next.domains.add(decision.domain);
        next.actions.add(decision.action);
        counts.set(reason, next);
      }
    }
    return Object.freeze(
      [...counts.entries()]
        .map(([reason, value]) => ({
          reason,
          count: value.count,
          domains: Object.freeze([...value.domains].sort()),
          actions: Object.freeze([...value.actions]),
        }))
        .sort((left, right) => right.count - left.count),
    );
  }

  public buildActionHistogram(decisions: readonly MemoryCompressionDecision[]): readonly MemoryCompressionActionHistogramEntry[] {
    const actions: MemoryCompressionAction[] = ['KEEP_HOT', 'KEEP_WARM', 'ARCHIVE', 'SUMMARIZE', 'DELETE', 'SHADOW_ONLY', 'DEFER'];
    return Object.freeze(actions.map((action) => {
      const members = decisions.filter((decision) => decision.action === action);
      return {
        action,
        count: members.length,
        averageScore01: average(members.map((member) => member.score01)),
        hottestId: [...members].sort((left, right) => right.score01 - left.score01)[0]?.id,
      };
    }));
  }

  public buildDomainSnapshots(decisions: readonly MemoryCompressionDecision[]): readonly MemoryCompressionDomainSnapshot[] {
    const domains: MemoryCompressionDomain[] = ['EVENT', 'QUOTE', 'CALLBACK'];
    return Object.freeze(domains.map((domain) => {
      const members = decisions.filter((decision) => decision.domain === domain);
      const ordered = [...members].sort((left, right) => right.score01 - left.score01);
      return {
        domain,
        totalRecords: members.length,
        keepHotCount: members.filter((member) => member.action === 'KEEP_HOT').length,
        keepWarmCount: members.filter((member) => member.action === 'KEEP_WARM').length,
        archiveCount: members.filter((member) => member.action === 'ARCHIVE').length,
        summarizeCount: members.filter((member) => member.action === 'SUMMARIZE').length,
        deleteCount: members.filter((member) => member.action === 'DELETE').length,
        shadowOnlyCount: members.filter((member) => member.action === 'SHADOW_ONLY').length,
        averageScore01: average(members.map((member) => member.score01)),
        hottestId: ordered[0]?.id,
        coldestId: ordered[ordered.length - 1]?.id,
      };
    }));
  }

  public buildCounterpartDigests(decisions: readonly MemoryCompressionDecision[]): readonly MemoryCompressionCounterpartDigest[] {
    const ids = uniqueStrings(decisions.map((decision) => decision.counterpartId));
    return Object.freeze(ids.map((counterpartId) => {
      const members = decisions.filter((decision) => decision.counterpartId === counterpartId);
      return {
        counterpartId,
        totalCount: members.length,
        keepHotCount: members.filter((member) => member.action === 'KEEP_HOT').length,
        keptCount: members.filter((member) => member.action === 'KEEP_HOT' || member.action === 'KEEP_WARM').length,
        archivedCount: members.filter((member) => member.action === 'ARCHIVE').length,
        summarizedCount: members.filter((member) => member.action === 'SUMMARIZE').length,
        deletedCount: members.filter((member) => member.action === 'DELETE').length,
        hottestIds: Object.freeze([...members].sort((left, right) => right.score01 - left.score01).slice(0, 5).map((member) => member.id)),
      };
    }).sort((left, right) => right.totalCount - left.totalCount));
  }

  public buildChannelDigests(decisions: readonly MemoryCompressionDecision[]): readonly MemoryCompressionChannelDigest[] {
    const ids = uniqueStrings(decisions.map((decision) => decision.channelId));
    return Object.freeze(ids.map((channelId) => {
      const members = decisions.filter((decision) => decision.channelId === channelId);
      return {
        channelId,
        totalCount: members.length,
        keepHotCount: members.filter((member) => member.action === 'KEEP_HOT').length,
        keepWarmCount: members.filter((member) => member.action === 'KEEP_WARM').length,
        shadowOnlyCount: members.filter((member) => member.action === 'SHADOW_ONLY').length,
        summarizeCount: members.filter((member) => member.action === 'SUMMARIZE').length,
        deleteCount: members.filter((member) => member.action === 'DELETE').length,
        averageScore01: average(members.map((member) => member.score01)),
      };
    }).sort((left, right) => right.totalCount - left.totalCount));
  }

  public buildRoomDigests(decisions: readonly MemoryCompressionDecision[]): readonly MemoryCompressionRoomDigest[] {
    const ids = uniqueStrings(decisions.map((decision) => decision.roomId));
    const domains: MemoryCompressionDomain[] = ['EVENT', 'QUOTE', 'CALLBACK'];
    const actions: MemoryCompressionAction[] = ['KEEP_HOT', 'KEEP_WARM', 'ARCHIVE', 'SUMMARIZE', 'DELETE', 'SHADOW_ONLY', 'DEFER'];
    return Object.freeze(ids.map((roomId) => {
      const members = decisions.filter((decision) => decision.roomId === roomId);
      const domainMix = Object.fromEntries(domains.map((domain) => [domain, members.filter((member) => member.domain === domain).length])) as Readonly<Record<MemoryCompressionDomain, number>>;
      const actionMix = Object.fromEntries(actions.map((action) => [action, members.filter((member) => member.action === action).length])) as Readonly<Record<MemoryCompressionAction, number>>;
      return {
        roomId,
        totalCount: members.length,
        domainMix,
        actionMix,
        hottestIds: Object.freeze([...members].sort((left, right) => right.score01 - left.score01).slice(0, 5).map((member) => member.id)),
      };
    }).sort((left, right) => right.totalCount - left.totalCount));
  }

  public buildClusterDigests(
    snapshot: ConversationMemorySnapshot,
    decisions: readonly MemoryCompressionDecision[],
  ): readonly MemoryCompressionClusterDigest[] {
    const decisionMap = new Map(decisions.map((decision) => [decision.id, decision]));
    return Object.freeze(this.clusterEventsForCompression(snapshot.events).map((cluster) => {
      const members = cluster.events.map((event) => decisionMap.get(event.memoryId)).filter(Boolean) as MemoryCompressionDecision[];
      return {
        clusterId: cluster.clusterId,
        centroidEventId: cluster.centroidEventId,
        eventCount: cluster.eventCount,
        avgSalience01: cluster.avgSalience01,
        maxHostility01: cluster.maxHostility01,
        maxEmbarrassment01: cluster.maxEmbarrassment01,
        protectedCount: members.filter((member) => member.action === 'KEEP_HOT' || member.action === 'KEEP_WARM').length,
        summarizeCount: members.filter((member) => member.action === 'SUMMARIZE').length,
        deleteCount: members.filter((member) => member.action === 'DELETE').length,
        isNarrativeArc: cluster.isNarrativeArc,
      };
    }).sort((left, right) => right.eventCount - left.eventCount));
  }

  public buildWindowDigest(snapshot: ConversationMemorySnapshot, referenceNow: number): MemoryCompressionWindowDigest {
    const allCreatedAt = [
      ...snapshot.events.map((record) => record.createdAt),
      ...snapshot.quotes.map((record) => record.createdAt),
      ...snapshot.callbacks.map((record) => record.createdAt),
    ];
    let hotWindowCount = 0;
    let warmWindowCount = 0;
    let archiveWindowCount = 0;
    let olderThanArchiveWindowCount = 0;
    for (const createdAt of allCreatedAt) {
      const ageMs = Math.max(0, referenceNow - createdAt);
      if (ageMs <= this.config.hotWindowMs) {
        hotWindowCount += 1;
      }
      if (ageMs <= this.config.warmWindowMs) {
        warmWindowCount += 1;
      }
      if (ageMs <= this.config.archiveWindowMs) {
        archiveWindowCount += 1;
      } else {
        olderThanArchiveWindowCount += 1;
      }
    }
    return {
      hotWindowCount,
      warmWindowCount,
      archiveWindowCount,
      olderThanArchiveWindowCount,
    };
  }

  public buildPresets(): readonly MemoryCompressionPreset[] {
    return Object.freeze([
      {
        presetId: 'BALANCED',
        description: 'Default balanced memory retention for mixed play.',
        config: {},
      },
      {
        presetId: 'AGGRESSIVE',
        description: 'Favor compression and summary support when the room is saturated.',
        config: {
          hotRecordBudget: 180,
          warmRecordBudget: 560,
          archiveRecordBudget: 1600,
          summarizeBelowScore01: 0.42,
          deleteBelowScore01: 0.2,
        },
      },
      {
        presetId: 'SHADOW_LOCKED',
        description: 'Preserve hidden and shadow narrative artifacts.',
        config: {
          preserveShadowSignals: true,
          keepRelationshipAnchors: true,
          keepLegendAnchors: true,
        },
      },
      {
        presetId: 'PROOF_LOCKED',
        description: 'Preserve proof-carrying records for audit and replay.',
        config: {
          keepProofAnchors: true,
          deleteBelowScore01: 0.08,
          summarizeBelowScore01: 0.3,
        },
      },
      {
        presetId: 'POST_RUN',
        description: 'Preserve comeback, collapse, and consequence after the run.',
        config: {
          keepLegendAnchors: true,
          keepDealRoomAnchors: true,
          keepWarmBelowScore01: 0.5,
          warmWindowMs: 14 * 24 * 60 * 60 * 1000,
        },
      },
    ]);
  }

  public resolvePreset(presetId: MemoryCompressionPreset['presetId']): MemoryCompressionPreset {
    return this.buildPresets().find((preset) => preset.presetId === presetId) ?? this.buildPresets()[0]!;
  }

  public createConfiguredPolicy(presetId: MemoryCompressionPreset['presetId']): MemoryCompressionPolicy {
    const preset = this.resolvePreset(presetId);
    return new MemoryCompressionPolicy({ ...this.config, ...preset.config }, this.salienceScorer);
  }

  public buildHotsetDigest(plan: MemoryCompressionPlan): readonly string[] {
    return Object.freeze(sortDecisionsByCreatedAt(plan.decisions)
      .filter((decision) => decision.action === 'KEEP_HOT')
      .slice(0, 12)
      .map((decision) => `${decision.domain}:${decision.id}:${decision.score01.toFixed(3)}:${decision.reasons.slice(0, 3).join(',')}`));
  }

  public buildShadowDigest(plan: MemoryCompressionPlan): readonly string[] {
    return Object.freeze(sortDecisionsByCreatedAt(plan.decisions)
      .filter((decision) => decision.action === 'SHADOW_ONLY')
      .slice(0, 12)
      .map((decision) => `${decision.domain}:${decision.id}:${decision.channelId ?? 'unknown'}`));
  }

  public buildDeletionDigest(plan: MemoryCompressionPlan): readonly string[] {
    return Object.freeze(sortDecisionsByCreatedAt(plan.decisions)
      .filter((decision) => decision.action === 'DELETE')
      .slice(0, 12)
      .map((decision) => `${decision.domain}:${decision.id}:${decision.score01.toFixed(3)}`));
  }

  public buildSummarySupportDigest(plan: MemoryCompressionPlan): readonly string[] {
    return Object.freeze(sortDecisionsByCreatedAt(plan.decisions)
      .filter((decision) => decision.reasons.includes('summary_support'))
      .slice(0, 12)
      .map((decision) => `${decision.domain}:${decision.id}:${decision.summaryKey ?? 'none'}`));
  }

  public buildCompressionIndex(plan: MemoryCompressionPlan): Readonly<Record<string, MemoryCompressionDecision>> {
    return Object.freeze(Object.fromEntries(plan.decisions.map((decision) => [decision.id, decision])));
  }

  public buildActionBuckets(plan: MemoryCompressionPlan): Readonly<Record<MemoryCompressionAction, readonly MemoryCompressionDecision[]>> {
    const actions: MemoryCompressionAction[] = ['KEEP_HOT', 'KEEP_WARM', 'ARCHIVE', 'SUMMARIZE', 'DELETE', 'SHADOW_ONLY', 'DEFER'];
    return Object.freeze(Object.fromEntries(actions.map((action) => [action, Object.freeze(plan.decisions.filter((decision) => decision.action === action))])) as Record<MemoryCompressionAction, readonly MemoryCompressionDecision[]>);
  }

  public buildDomainBuckets(plan: MemoryCompressionPlan): Readonly<Record<MemoryCompressionDomain, readonly MemoryCompressionDecision[]>> {
    const domains: MemoryCompressionDomain[] = ['EVENT', 'QUOTE', 'CALLBACK'];
    return Object.freeze(Object.fromEntries(domains.map((domain) => [domain, Object.freeze(plan.decisions.filter((decision) => decision.domain === domain))])) as Record<MemoryCompressionDomain, readonly MemoryCompressionDecision[]>);
  }

  public explainDecision(decision: MemoryCompressionDecision): string {
    return [
      `domain=${decision.domain}`,
      `id=${decision.id}`,
      `action=${decision.action}`,
      `score=${decision.score01.toFixed(3)}`,
      `tier=${decision.tier}`,
      `reasons=${decision.reasons.join(',')}`,
    ].join('|');
  }

  public explainPlan(plan: MemoryCompressionPlan): readonly string[] {
    return Object.freeze(plan.decisions.map((decision) => this.explainDecision(decision)));
  }

  public recommendConfigTuning(store: ConversationMemoryStore, playerId: string): Partial<MemoryCompressionConfig> {
    const utilization = this.currentUtilization(store, playerId);
    if (utilization.needsEmergencyCompression) {
      return {
        hotRecordBudget: Math.max(96, Math.floor(this.config.hotRecordBudget * 0.82)),
        warmRecordBudget: Math.max(240, Math.floor(this.config.warmRecordBudget * 0.8)),
        archiveRecordBudget: Math.max(600, Math.floor(this.config.archiveRecordBudget * 0.85)),
        summarizeBelowScore01: clamp01(this.config.summarizeBelowScore01 + 0.08),
        deleteBelowScore01: clamp01(this.config.deleteBelowScore01 + 0.04),
      };
    }
    if (utilization.needsSoftCompression) {
      return {
        warmRecordBudget: Math.max(360, Math.floor(this.config.warmRecordBudget * 0.9)),
        archiveRecordBudget: Math.max(1200, Math.floor(this.config.archiveRecordBudget * 0.92)),
      };
    }
    return {
      hotRecordBudget: this.config.hotRecordBudget,
      warmRecordBudget: this.config.warmRecordBudget,
      archiveRecordBudget: this.config.archiveRecordBudget,
    };
  }

  public buildPlanDeltaPreview(store: ConversationMemoryStore, context: MemoryCompressionContext, presetId: MemoryCompressionPreset['presetId']): MemoryCompressionPlanComparison {
    const basePlan = this.plan(store, context);
    const alternatePolicy = this.createConfiguredPolicy(presetId);
    const alternatePlan = alternatePolicy.plan(store, context);
    return this.comparePlans(basePlan, alternatePlan);
  }

  public listProtectedArcIds(store: ConversationMemoryStore, playerId: string): readonly string[] {
    return Object.freeze(this.identifyNarrativeArcs(store, playerId).filter((arc) => arc.isProtected).map((arc) => arc.arcId));
  }

  public listProtectedEventIds(store: ConversationMemoryStore, playerId: string): readonly string[] {
    const protectedIds = new Set<string>();
    for (const arc of this.identifyNarrativeArcs(store, playerId)) {
      if (!arc.isProtected) {
        continue;
      }
      for (const id of arc.eventIds) {
        protectedIds.add(id);
      }
    }
    return Object.freeze([...protectedIds]);
  }

  public buildPreservationReport(store: ConversationMemoryStore, playerId: string): readonly string[] {
    const plan = this.plan(store, { playerId });
    const diagnostics = this.buildAuditReport(store, plan);
    return Object.freeze([
      `summary:${this.summarizePlan(plan)}`,
      ...diagnostics.domains.map((domain) => `domain:${domain.domain}:count=${domain.totalRecords}:hot=${domain.keepHotCount}:delete=${domain.deleteCount}`),
      ...this.buildHotsetDigest(plan).map((line) => `hot:${line}`),
      ...this.buildShadowDigest(plan).map((line) => `shadow:${line}`),
      ...this.buildDeletionDigest(plan).map((line) => `delete:${line}`),
    ]);
  }

  public preserveArcIntegrity(plan: MemoryCompressionPlan, arcs: readonly NarrativeArc[]): MemoryCompressionPlan {
    const protectedIds = new Set<string>();
    for (const arc of arcs) {
      if (arc.isProtected) {
        for (const id of arc.eventIds) {
          protectedIds.add(id);
        }
      }
    }
    const adjusted = plan.decisions.map((decision) => {
      if (protectedIds.has(decision.id) && (decision.action === 'DELETE' || decision.action === 'SUMMARIZE' || decision.action === 'ARCHIVE')) {
        const reasons = new Set(decision.reasons);
        reasons.add('collapse_preservation');
        reasons.add('retention_floor');
        return {
          ...decision,
          action: 'KEEP_HOT' as const,
          reasons: Array.from(reasons),
        };
      }
      return decision;
    });
    return this.buildPlanResult(plan.playerId, plan.createdAt, adjusted, plan.summaries, [...plan.auditTrail, 'arc_integrity_applied']);
  }

  public currentUtilization(store: ConversationMemoryStore, playerId: string): MemoryBudgetUtilization {
    const snapshot = store.getSnapshot(playerId);
    const eventBudget = Math.max(1, this.config.hotRecordBudget + this.config.warmRecordBudget + this.config.archiveRecordBudget);
    const quoteBudget = Math.max(1, Math.floor(this.config.warmRecordBudget * 0.75) + this.config.archiveRecordBudget);
    const callbackBudget = Math.max(1, Math.floor(this.config.hotRecordBudget * 0.5) + Math.floor(this.config.warmRecordBudget * 0.5) + Math.floor(this.config.archiveRecordBudget * 0.75));
    const eventUtil = snapshot.events.length / eventBudget;
    const quoteUtil = snapshot.quotes.length / quoteBudget;
    const callbackUtil = snapshot.callbacks.length / callbackBudget;
    const maxUtil = maxNumber([eventUtil, quoteUtil, callbackUtil]);
    return {
      eventUtilization01: clamp01(eventUtil),
      quoteUtilization01: clamp01(quoteUtil),
      callbackUtilization01: clamp01(callbackUtil),
      overallUtilization01: clamp01(maxUtil),
      needsEmergencyCompression: maxUtil >= 0.9,
      needsSoftCompression: maxUtil >= 0.7,
    };
  }

  public emergencyCompressionPlan(store: ConversationMemoryStore, context: MemoryCompressionContext): MemoryCompressionPlan {
    const plan = this.plan(store, context);
    const aggressive = plan.decisions.map((decision) => {
      const reasons = new Set(decision.reasons);
      reasons.add('triggered_by_policy');
      reasons.add('soft_budget');
      if (decision.action === 'KEEP_WARM') {
        return { ...decision, action: 'ARCHIVE' as const, reasons: Array.from(reasons) };
      }
      if (decision.action === 'ARCHIVE') {
        return { ...decision, action: 'SUMMARIZE' as const, reasons: Array.from(reasons) };
      }
      if (decision.action === 'SUMMARIZE' && decision.score01 <= Math.max(this.config.deleteBelowScore01, 0.18)) {
        reasons.add('hard_budget');
        return { ...decision, action: 'DELETE' as const, reasons: Array.from(reasons) };
      }
      return { ...decision, reasons: Array.from(reasons) };
    });
    const rebuiltSummaries = this.buildSummaryGroups(store.getSnapshot(context.playerId), aggressive, [...plan.auditTrail], plan.createdAt);
    return this.buildPlanResult(plan.playerId, plan.createdAt, aggressive, rebuiltSummaries, [...plan.auditTrail, 'emergency_policy_applied']);
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

export function previewConversationMemoryCompression(
  store: ConversationMemoryStore,
  context: MemoryCompressionContext,
  config: Partial<MemoryCompressionConfig> = {},
  salienceScorer: MemorySalienceScorer = new MemorySalienceScorer(),
): MemoryCompressionPlanPreview {
  return new MemoryCompressionPolicy(config, salienceScorer).preview(store, context);
}

export function executeConversationMemoryCompression(
  store: ConversationMemoryStore,
  context: MemoryCompressionContext,
  config: Partial<MemoryCompressionConfig> = {},
  salienceScorer: MemorySalienceScorer = new MemorySalienceScorer(),
): MemoryCompressionExecutionReceipt {
  return new MemoryCompressionPolicy(config, salienceScorer).executePlan(store, context);
}

export function summarizeConversationCompressionPlan(plan: MemoryCompressionPlan): string {
  return new MemoryCompressionPolicy().summarizePlan(plan);
}
