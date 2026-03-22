/**
 * backend/src/game/engine/chat/memory/MemorySalienceScorer.ts
 *
 * Backend salience scoring authority for Point Zero One chat memory.
 *
 * This module ranks conversation events, extracted quotes, and projected
 * callbacks so downstream memory compression, quote recall, callback planning,
 * rescue timing, rivalry escalation, helper trust, and post-run ritual systems
 * can reason from one canonical notion of importance.
 */

import type {
  ChatCallbackKind,
  ChatCallbackPrivacyClass,
} from '../../../../../../shared/contracts/chat/ChatCallback';
import type {
  ChatQuoteAudienceClass,
  ChatQuoteToneClass,
  ChatQuoteUseIntent,
} from '../../../../../../shared/contracts/chat/ChatQuote';
type ChatCallbackMode = string;
type ChatCallbackTrigger = string;
type ChatQuoteKind = string;
import {
  ConversationMemoryStore,
  type ConversationCallbackCandidate,
  type ConversationMemoryCallbackRecord,
  type ConversationMemoryChannelId,
  type ConversationMemoryContext,
  type ConversationMemoryEventRecord,
  type ConversationMemoryEventType,
  type ConversationMemoryQuoteRecord,
  type ConversationQuoteCandidate,
} from './ConversationMemoryStore';

export type MemorySalienceDomain = 'EVENT' | 'QUOTE' | 'CALLBACK';
export type MemorySalienceTier = 'DORMANT' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'LEGEND';
export type MemorySalienceReasonCode =
  | 'recent'
  | 'run_match'
  | 'mode_match'
  | 'channel_match'
  | 'room_match'
  | 'actor_match'
  | 'counterpart_match'
  | 'proof_present'
  | 'proof_absent'
  | 'callback_kind_match'
  | 'quote_kind_match'
  | 'privacy_match'
  | 'privacy_penalty'
  | 'public_witness'
  | 'shadow_signal'
  | 'rescue_pressure'
  | 'rivalry_pressure'
  | 'helper_trust'
  | 'deal_room_pressure'
  | 'post_run_value'
  | 'legend_value'
  | 'witness_value'
  | 'collapse_value'
  | 'comeback_value'
  | 'boast_value'
  | 'taunt_value'
  | 'bluff_value'
  | 'threat_value'
  | 'confession_value'
  | 'advice_value'
  | 'humiliation_value'
  | 'guidance_value'
  | 'callback_projected'
  | 'callback_used_penalty'
  | 'quote_used_penalty'
  | 'archived_penalty'
  | 'duplicate_penalty'
  | 'novelty_bonus'
  | 'relationship_bonus'
  | 'scene_anchor_bonus'
  | 'pressure_tier_match'
  | 'tick_proximity'
  | 'body_length_bonus'
  | 'body_length_penalty'
  | 'tag_match'
  | 'tag_penalty'
  | 'tone_match'
  | 'tone_penalty'
  | 'intent_match'
  | 'trigger_match'
  | 'quote_quality'
  | 'callback_coverage'
  | 'callback_delay_penalty'
  | 'room_witness_bonus'
  | 'actor_diversity_bonus'
  | 'quiet_room_bonus'
  | 'already_spent_penalty'
  | 'active_status'
  | 'dormant_status'
  | 'critical_event_type'
  | 'surface_alignment'
  | 'relevance_decay';

export interface MemorySalienceContext {
  readonly playerId: string;
  readonly runId?: string;
  readonly modeId?: string;
  readonly channelId?: ConversationMemoryChannelId;
  readonly roomId?: string;
  readonly actorId?: string;
  readonly counterpartId?: string;
  readonly pressureTier?: string;
  readonly tick?: number;
  readonly preferredPrivacy?: 'PUBLIC' | 'TEAM' | 'PRIVATE' | 'SHADOW';
  readonly preferredQuoteKinds?: readonly ChatQuoteKind[];
  readonly preferredCallbackKinds?: readonly ChatCallbackKind[];
  readonly preferredCallbackModes?: readonly ChatCallbackMode[];
  readonly preferredTriggers?: readonly ChatCallbackTrigger[];
  readonly preferredTones?: readonly ChatQuoteToneClass[];
  readonly preferredIntents?: readonly ChatQuoteUseIntent[];
  readonly requiredTags?: readonly string[];
  readonly suppressedTags?: readonly string[];
  readonly now?: number;
}

export interface MemorySalienceBreakdown {
  readonly relevance01: number;
  readonly recency01: number;
  readonly proof01: number;
  readonly relationship01: number;
  readonly witness01: number;
  readonly dramaturgy01: number;
  readonly privacyFit01: number;
  readonly novelty01: number;
  readonly compressionRisk01: number;
  readonly retrievalValue01: number;
}

export interface MemorySalienceScore {
  readonly domain: MemorySalienceDomain;
  readonly id: string;
  readonly playerId: string;
  readonly score01: number;
  readonly tier: MemorySalienceTier;
  readonly reasons: readonly MemorySalienceReasonCode[];
  readonly breakdown: MemorySalienceBreakdown;
  readonly createdAt: number;
  readonly updatedAt?: number;
  readonly actorId?: string;
  readonly counterpartId?: string;
  readonly roomId?: string;
  readonly channelId?: string;
  readonly tags: readonly string[];
  readonly snapshot: Readonly<Record<string, unknown>>;
}

export interface MemorySalienceBatch {
  readonly playerId: string;
  readonly createdAt: number;
  readonly context: MemorySalienceContext;
  readonly eventScores: readonly MemorySalienceScore[];
  readonly quoteScores: readonly MemorySalienceScore[];
  readonly callbackScores: readonly MemorySalienceScore[];
}

export interface MemorySalienceScorerConfig {
  readonly recencyWindowMs: number;
  readonly proofBoost: number;
  readonly proofPenalty: number;
  readonly runMatchBoost: number;
  readonly modeMatchBoost: number;
  readonly channelMatchBoost: number;
  readonly roomMatchBoost: number;
  readonly actorMatchBoost: number;
  readonly counterpartMatchBoost: number;
  readonly pressureTierBoost: number;
  readonly tickWindow: number;
  readonly tickBoost: number;
  readonly bodyLengthSoftMin: number;
  readonly bodyLengthSoftMax: number;
  readonly shortBodyPenalty: number;
  readonly longBodyPenalty: number;
  readonly tagMatchBoost: number;
  readonly tagPenalty: number;
  readonly preferredToneBoost: number;
  readonly preferredIntentBoost: number;
  readonly privacyMismatchPenalty: number;
  readonly archivedPenalty: number;
  readonly spentPenalty: number;
  readonly usedPenalty: number;
  readonly shadowBoost: number;
  readonly publicWitnessBoost: number;
  readonly rescueBoost: number;
  readonly rivalryBoost: number;
  readonly dealRoomBoost: number;
  readonly postRunBoost: number;
  readonly legendBoost: number;
  readonly collapseBoost: number;
  readonly comebackBoost: number;
  readonly boastBoost: number;
  readonly tauntBoost: number;
  readonly bluffBoost: number;
  readonly threatBoost: number;
  readonly confessionBoost: number;
  readonly adviceBoost: number;
  readonly callbackCoverageBoost: number;
  readonly callbackDelayPenaltyPerSecond: number;
  readonly quoteQualityBoost: number;
  readonly noveltyBonus: number;
  readonly duplicatePenalty: number;
  readonly relationshipBonus: number;
  readonly sceneAnchorBonus: number;
  readonly actorDiversityBonus: number;
  readonly quietRoomBonus: number;
  readonly relevanceWeight: number;
  readonly recencyWeight: number;
  readonly proofWeight: number;
  readonly relationshipWeight: number;
  readonly witnessWeight: number;
  readonly dramaturgyWeight: number;
  readonly privacyWeight: number;
  readonly noveltyWeight: number;
  readonly compressionRiskWeight: number;
  readonly retrievalWeight: number;
}

const DEFAULT_MEMORY_SALIENCE_SCORER_CONFIG: MemorySalienceScorerConfig = Object.freeze({
  recencyWindowMs: 7 * 24 * 60 * 60 * 1000,
  proofBoost: 0.12,
  proofPenalty: -0.03,
  runMatchBoost: 0.08,
  modeMatchBoost: 0.05,
  channelMatchBoost: 0.05,
  roomMatchBoost: 0.04,
  actorMatchBoost: 0.07,
  counterpartMatchBoost: 0.09,
  pressureTierBoost: 0.05,
  tickWindow: 42,
  tickBoost: 0.03,
  bodyLengthSoftMin: 18,
  bodyLengthSoftMax: 240,
  shortBodyPenalty: -0.04,
  longBodyPenalty: -0.02,
  tagMatchBoost: 0.03,
  tagPenalty: -0.04,
  preferredToneBoost: 0.04,
  preferredIntentBoost: 0.04,
  privacyMismatchPenalty: -0.09,
  archivedPenalty: -0.15,
  spentPenalty: -0.18,
  usedPenalty: -0.12,
  shadowBoost: 0.05,
  publicWitnessBoost: 0.05,
  rescueBoost: 0.09,
  rivalryBoost: 0.09,
  dealRoomBoost: 0.07,
  postRunBoost: 0.07,
  legendBoost: 0.12,
  collapseBoost: 0.08,
  comebackBoost: 0.08,
  boastBoost: 0.05,
  tauntBoost: 0.06,
  bluffBoost: 0.05,
  threatBoost: 0.05,
  confessionBoost: 0.06,
  adviceBoost: 0.05,
  callbackCoverageBoost: 0.04,
  callbackDelayPenaltyPerSecond: 0.0015,
  quoteQualityBoost: 0.04,
  noveltyBonus: 0.04,
  duplicatePenalty: -0.08,
  relationshipBonus: 0.06,
  sceneAnchorBonus: 0.05,
  actorDiversityBonus: 0.03,
  quietRoomBonus: 0.02,
  relevanceWeight: 0.22,
  recencyWeight: 0.14,
  proofWeight: 0.08,
  relationshipWeight: 0.12,
  witnessWeight: 0.1,
  dramaturgyWeight: 0.12,
  privacyWeight: 0.06,
  noveltyWeight: 0.05,
  compressionRiskWeight: 0.05,
  retrievalWeight: 0.06,
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

function normalizeText(value: string | undefined | null): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqueStrings(values: readonly (string | undefined | null)[]): readonly string[] {
  return Array.from(
    new Set(
      values
        .map((value) => String(value ?? '').trim())
        .filter((value) => value.length > 0),
    ),
  );
}

function average(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function softLengthScore(length: number, min: number, max: number): number {
  if (length <= 0) {
    return 0;
  }
  if (length < min) {
    return clamp01(length / Math.max(min, 1));
  }
  if (length > max) {
    const overflow = Math.min(1, (length - max) / Math.max(max, 1));
    return clamp01(1 - overflow * 0.5);
  }
  return 1;
}

function recencyScore(createdAt: number, referenceNow: number, windowMs: number): number {
  const age = Math.max(0, referenceNow - createdAt);
  if (age <= 0) {
    return 1;
  }
  if (age >= windowMs) {
    return 0;
  }
  return clamp01(1 - age / windowMs);
}

function tickProximityScore(contextTick: number | undefined, sourceTick: number | undefined, window: number): number {
  if (typeof contextTick !== 'number' || typeof sourceTick !== 'number') {
    return 0;
  }
  const delta = Math.abs(contextTick - sourceTick);
  if (delta >= window) {
    return 0;
  }
  return clamp01(1 - delta / window);
}

function arrayIncludes<T extends string>(haystack: readonly T[] | undefined, needle: T | string | undefined): boolean {
  if (!haystack || haystack.length === 0 || !needle) {
    return false;
  }
  return haystack.includes(needle as T);
}

function matchRatio(left: readonly string[], right: readonly string[]): number {
  if (left.length === 0 || right.length === 0) {
    return 0;
  }
  const set = new Set(right.map((value) => value.toLowerCase()));
  let matches = 0;
  for (const value of left) {
    if (set.has(value.toLowerCase())) {
      matches += 1;
    }
  }
  return clamp01(matches / Math.max(left.length, right.length));
}

function estimateDuplicatePenalty(text: string, seen: readonly string[]): number {
  const normalized = normalizeText(text);
  if (!normalized) {
    return 0;
  }
  let strongest = 0;
  for (const prior of seen) {
    const candidate = normalizeText(prior);
    if (!candidate) {
      continue;
    }
    const penalty = candidate === normalized
      ? 1
      : candidate.includes(normalized) || normalized.includes(candidate)
        ? 0.7
        : 0;
    if (penalty > strongest) {
      strongest = penalty;
    }
  }
  return clamp01(strongest);
}

function tierFromScore(score01: number): MemorySalienceTier {
  if (score01 >= 0.92) {
    return 'LEGEND';
  }
  if (score01 >= 0.78) {
    return 'CRITICAL';
  }
  if (score01 >= 0.58) {
    return 'HIGH';
  }
  if (score01 >= 0.36) {
    return 'MEDIUM';
  }
  if (score01 >= 0.16) {
    return 'LOW';
  }
  return 'DORMANT';
}

function normalizePrivacy(value: string | undefined): string {
  switch (value) {
    case 'PUBLIC':
    case 'TEAM':
    case 'PRIVATE':
    case 'SHADOW':
      return value;
    default:
      return 'PUBLIC';
  }
}

function summarizeSnapshot(domain: MemorySalienceDomain, record: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  const base: Record<string, unknown> = { domain };
  for (const [key, value] of Object.entries(record)) {
    if (value === undefined) {
      continue;
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      base[key] = value;
      continue;
    }
    if (Array.isArray(value)) {
      base[key] = value.slice(0, 8);
      continue;
    }
    if (value && typeof value === 'object') {
      base[key] = '[object]';
      continue;
    }
    base[key] = String(value);
  }
  return Object.freeze(base);
}

export interface MemorySalienceScorableEventContext {
  readonly record: ConversationMemoryEventRecord;
  readonly context: MemorySalienceContext;
  readonly seenBodies?: readonly string[];
}

export interface MemorySalienceScorableQuoteContext {
  readonly record: ConversationMemoryQuoteRecord;
  readonly context: MemorySalienceContext;
  readonly parentEvent?: ConversationMemoryEventRecord;
  readonly seenBodies?: readonly string[];
}

export interface MemorySalienceScorableCallbackContext {
  readonly record: ConversationMemoryCallbackRecord;
  readonly context: MemorySalienceContext;
  readonly event?: ConversationMemoryEventRecord;
  readonly quote?: ConversationMemoryQuoteRecord;
  readonly seenBodies?: readonly string[];
}


// ============================================================================
// MARK: Context salience boost types
// ============================================================================

export interface ContextSalienceBoost {
  readonly reasonCode: string;
  readonly boost01: number;
  readonly condition: (record: ConversationMemoryEventRecord, context: MemorySalienceContext) => boolean;
}

/** Pre-built context boost: counterpart proximity. */
export const BOOST_COUNTERPART_PROXIMITY: ContextSalienceBoost = {
  reasonCode: 'counterpart_proximity',
  boost01: 0.18,
  condition: (record, context) => !!(record.counterpart?.actorId && record.counterpart.actorId === context.counterpartId),
};

/** Pre-built context boost: pressure threshold echo. */
export const BOOST_PRESSURE_ECHO: ContextSalienceBoost = {
  reasonCode: 'pressure_threshold_echo',
  boost01: 0.15,
  condition: (record, context) => !!((record as any).context.pressureTier && (record as any).context.pressureTier === context.pressureTier),
};

/** Pre-built context boost: channel revisit. */
export const BOOST_CHANNEL_REVISIT: ContextSalienceBoost = {
  reasonCode: 'channel_revisit',
  boost01: 0.1,
  condition: (record, context) => !!((record as any).context.channelId && (record as any).context.channelId === context.channelId),
};

/** Pre-built context boost: mode re-entry. */
export const BOOST_MODE_REENTRY: ContextSalienceBoost = {
  reasonCode: 'mode_reentry',
  boost01: 0.12,
  condition: (record, context) => !!((record as any).context.modeId && (record as any).context.modeId === context.modeId),
};

export const DEFAULT_CONTEXT_BOOSTS: readonly ContextSalienceBoost[] = Object.freeze([
  BOOST_COUNTERPART_PROXIMITY,
  BOOST_PRESSURE_ECHO,
  BOOST_CHANNEL_REVISIT,
  BOOST_MODE_REENTRY,
]);

// ============================================================================
// MARK: Predictive salience input type
// ============================================================================

export interface PredictiveSalienceInput {
  readonly impendingEscalation: boolean;
  readonly impendingRescue: boolean;
  readonly impendingNegotiation: boolean;
  readonly impendingRunEnd: boolean;
  readonly counterpartReappearing: boolean;
  readonly counterpartId?: string;
  readonly pressureThresholdEcho: boolean;
  readonly echoedPressureTier?: string;
}

// ============================================================================
// MARK: Mode salience weights type
// ============================================================================

export interface ModeSalienceWeights {
  readonly rescueMultiplier: number;
  readonly rivalryMultiplier: number;
  readonly dealRoomMultiplier: number;
  readonly teamMultiplier: number;
  readonly witnessMultiplier: number;
  readonly isolationMultiplier: number;
  readonly comebackMultiplier: number;
}



// ============================================================================
// MARK: Salience trend type
// ============================================================================

export interface SalienceTrend {
  readonly direction: 'RISING' | 'FALLING' | 'STABLE' | 'INSUFFICIENT_DATA';
  readonly recentAvg01: number;
  readonly olderAvg01: number;
  readonly delta01: number;
}


export class MemorySalienceScorer {
  private readonly config: MemorySalienceScorerConfig;

  public constructor(config: Partial<MemorySalienceScorerConfig> = {}) {
    this.config = Object.freeze({
      ...DEFAULT_MEMORY_SALIENCE_SCORER_CONFIG,
      ...config,
    });
  }

  public scoreEvent(input: MemorySalienceScorableEventContext): MemorySalienceScore {
    const referenceNow = input.context.now ?? now();
    const reasons = new Set<MemorySalienceReasonCode>();
    const tags = uniqueStrings([...((input.record as any).context.tags ?? []), ...(input.context.requiredTags ?? [])]);

    const relevance01 = this.computeEventRelevance(input.record, input.context, reasons);
    const recency01 = recencyScore(input.record.createdAt, referenceNow, this.config.recencyWindowMs);
    if (recency01 > 0.66) {
      reasons.add('recent');
    }
    const proof01 = this.computeEventProofScore(input.record, reasons);
    const relationship01 = this.computeRelationshipScore((input.record as any).context, input.context, reasons);
    const witness01 = this.computeWitnessScore((input.record as any).context, reasons);
    const dramaturgy01 = this.computeEventDramaturgyScore(input.record, input.context, reasons);
    const privacyFit01 = this.computePrivacyFit((input.record as any).context.privacyLevel, input.context.preferredPrivacy, reasons);
    const novelty01 = this.computeNoveltyScore(input.record.body, input.seenBodies, reasons);
    const compressionRisk01 = this.computeCompressionRiskForEvent(input.record, reasons);
    const retrievalValue01 = this.computeEventRetrievalValue(input.record, input.context, reasons);

    const score01 = this.combine({
      relevance01,
      recency01,
      proof01,
      relationship01,
      witness01,
      dramaturgy01,
      privacyFit01,
      novelty01,
      compressionRisk01,
      retrievalValue01,
    });

    return {
      domain: 'EVENT',
      id: input.record.memoryId,
      playerId: input.record.playerId,
      score01,
      tier: tierFromScore(score01),
      reasons: Array.from(reasons),
      breakdown: {
        relevance01,
        recency01,
        proof01,
        relationship01,
        witness01,
        dramaturgy01,
        privacyFit01,
        novelty01,
        compressionRisk01,
        retrievalValue01,
      },
      createdAt: input.record.createdAt,
      updatedAt: input.record.updatedAt,
      actorId: input.record.actor.actorId,
      counterpartId: input.record.counterpart?.actorId,
      roomId: (input.record as any).context.roomId,
      channelId: (input.record as any).context.channelId,
      tags,
      snapshot: summarizeSnapshot('EVENT', {
        eventType: (input.record as any).context.eventType,
        channelId: (input.record as any).context.channelId,
        roomId: (input.record as any).context.roomId,
        pressureTier: (input.record as any).context.pressureTier,
        tick: (input.record as any).context.tick,
        status: input.record.status,
      }),
    };
  }

  public scoreQuote(input: MemorySalienceScorableQuoteContext): MemorySalienceScore {
    const referenceNow = input.context.now ?? now();
    const reasons = new Set<MemorySalienceReasonCode>();
    const tags = uniqueStrings([...(input.record.tags ?? []), ...(input.parentEvent?.context.tags ?? []), ...(input.context.requiredTags ?? [])]);

    const relevance01 = this.computeQuoteRelevance(input.record, input.context, reasons);
    const recency01 = recencyScore(input.record.createdAt, referenceNow, this.config.recencyWindowMs);
    if (recency01 > 0.66) {
      reasons.add('recent');
    }
    const proof01 = this.computeQuoteProofScore(input.record, reasons);
    const relationship01 = this.computeRelationshipScore((input.record as any).context, input.context, reasons);
    const witness01 = this.computeWitnessScore((input.record as any).context, reasons);
    const dramaturgy01 = this.computeQuoteDramaturgyScore(input.record, input.context, reasons);
    const privacyFit01 = this.computePrivacyFit((input.record as any).context.privacyLevel, input.context.preferredPrivacy, reasons);
    const novelty01 = this.computeNoveltyScore((input.record as any).text, input.seenBodies, reasons);
    const compressionRisk01 = this.computeCompressionRiskForQuote(input.record, reasons);
    const retrievalValue01 = this.computeQuoteRetrievalValue(input.record, input.context, reasons);

    const score01 = this.combine({
      relevance01,
      recency01,
      proof01,
      relationship01,
      witness01,
      dramaturgy01,
      privacyFit01,
      novelty01,
      compressionRisk01,
      retrievalValue01,
    });

    return {
      domain: 'QUOTE',
      id: (input.record as any).quoteId,
      playerId: input.record.playerId,
      score01,
      tier: tierFromScore(score01),
      reasons: Array.from(reasons),
      breakdown: {
        relevance01,
        recency01,
        proof01,
        relationship01,
        witness01,
        dramaturgy01,
        privacyFit01,
        novelty01,
        compressionRisk01,
        retrievalValue01,
      },
      createdAt: input.record.createdAt,
      updatedAt: input.record.updatedAt,
      actorId: (input.record as any).actorId,
      counterpartId: (input.record as any).counterpartId,
      roomId: (input.record as any).context.roomId,
      channelId: (input.record as any).context.channelId,
      tags,
      snapshot: summarizeSnapshot('QUOTE', {
        kind: (input.record as any).kind,
        channelId: (input.record as any).context.channelId,
        roomId: (input.record as any).context.roomId,
        pressureTier: (input.record as any).context.pressureTier,
        audienceClass: (input.record as any).audienceClass,
        lifecycle: (input.record as any).lifecycle,
      }),
    };
  }

  public scoreCallback(input: MemorySalienceScorableCallbackContext): MemorySalienceScore {
    const referenceNow = input.context.now ?? now();
    const reasons = new Set<MemorySalienceReasonCode>();
    const tags = uniqueStrings([...(input.record.tags ?? []), ...(input.event?.context.tags ?? []), ...(input.context.requiredTags ?? [])]);

    const relevance01 = this.computeCallbackRelevance(input.record, input.context, reasons);
    const recency01 = recencyScore(input.record.createdAt, referenceNow, this.config.recencyWindowMs);
    if (recency01 > 0.66) {
      reasons.add('recent');
    }
    const proof01 = this.computeCallbackProofScore(input.record, (input as any).quote, reasons);
    const relationship01 = this.computeRelationshipScore((input.record as any).context, input.context, reasons);
    const witness01 = this.computeWitnessScore((input.record as any).context, reasons);
    const dramaturgy01 = this.computeCallbackDramaturgyScore(input.record, input.context, reasons);
    const privacyFit01 = this.computePrivacyFit((input.record as any).context.privacyLevel, input.context.preferredPrivacy, reasons);
    const novelty01 = this.computeNoveltyScore((input.record as any).text, input.seenBodies, reasons);
    const compressionRisk01 = this.computeCompressionRiskForCallback(input.record, reasons);
    const retrievalValue01 = this.computeCallbackRetrievalValue(input.record, input.context, reasons);

    const score01 = this.combine({
      relevance01,
      recency01,
      proof01,
      relationship01,
      witness01,
      dramaturgy01,
      privacyFit01,
      novelty01,
      compressionRisk01,
      retrievalValue01,
    });

    return {
      domain: 'CALLBACK',
      id: input.record.callbackId,
      playerId: input.record.playerId,
      score01,
      tier: tierFromScore(score01),
      reasons: Array.from(reasons),
      breakdown: {
        relevance01,
        recency01,
        proof01,
        relationship01,
        witness01,
        dramaturgy01,
        privacyFit01,
        novelty01,
        compressionRisk01,
        retrievalValue01,
      },
      createdAt: input.record.createdAt,
      updatedAt: input.record.updatedAt,
      actorId: (input.record as any).actorId,
      counterpartId: (input.record as any).counterpartId,
      roomId: (input.record as any).context.roomId,
      channelId: (input.record as any).context.channelId,
      tags,
      snapshot: summarizeSnapshot('CALLBACK', {
        kind: (input.record as any).kind,
        mode: input.record.mode,
        trigger: input.record.trigger,
        channelId: (input.record as any).context.channelId,
        roomId: (input.record as any).context.roomId,
        privacyClass: (input.record as any).privacyClass,
        lifecycle: (input.record as any).lifecycle,
      }),
    };
  }

  public scoreQuoteCandidate(candidate: ConversationQuoteCandidate, context: MemorySalienceContext): MemorySalienceScore {
    return this.scoreQuote({
      record: candidate.record,
      context,
      parentEvent: (candidate as any).event,
      seenBodies: candidate.reasons,
    });
  }

  public scoreCallbackCandidate(candidate: ConversationCallbackCandidate, context: MemorySalienceContext): MemorySalienceScore {
    return this.scoreCallback({
      record: candidate.record,
      context,
      event: (candidate as any).event,
      quote: (candidate as any).quote,
      seenBodies: candidate.reasons,
    });
  }

  public scoreBatch(store: ConversationMemoryStore, context: MemorySalienceContext): MemorySalienceBatch {
    const snapshot = store.getSnapshot(context.playerId);
    const events = snapshot.events.map((record) => this.scoreEvent({ record, context }));
    const quotes = snapshot.quotes.map((record) => this.scoreQuote({
      record,
      context,
      parentEvent: record.memoryId ? store.getEvent(context.playerId, record.memoryId) : undefined,
    }));
    const callbacks = snapshot.callbacks.map((record) => this.scoreCallback({
      record,
      context,
      event: record.memoryId ? store.getEvent(context.playerId, record.memoryId) : undefined,
      quote: (record as any).quoteId ? store.getQuote(context.playerId, (record as any).quoteId) : undefined,
    }));

    return {
      playerId: context.playerId,
      createdAt: context.now ?? now(),
      context,
      eventScores: events.sort((left, right) => right.score01 - left.score01),
      quoteScores: quotes.sort((left, right) => right.score01 - left.score01),
      callbackScores: callbacks.sort((left, right) => right.score01 - left.score01),
    };
  }

  public sortScoresDescending<T extends MemorySalienceScore>(scores: readonly T[]): readonly T[] {
    return [...scores].sort((left, right) => {
      if (right.score01 !== left.score01) {
        return right.score01 - left.score01;
      }
      return right.createdAt - left.createdAt;
    });
  }

  private combine(breakdown: MemorySalienceBreakdown): number {
    const weighted =
      breakdown.relevance01 * this.config.relevanceWeight +
      breakdown.recency01 * this.config.recencyWeight +
      breakdown.proof01 * this.config.proofWeight +
      breakdown.relationship01 * this.config.relationshipWeight +
      breakdown.witness01 * this.config.witnessWeight +
      breakdown.dramaturgy01 * this.config.dramaturgyWeight +
      breakdown.privacyFit01 * this.config.privacyWeight +
      breakdown.novelty01 * this.config.noveltyWeight +
      breakdown.compressionRisk01 * this.config.compressionRiskWeight +
      breakdown.retrievalValue01 * this.config.retrievalWeight;
    return clamp01(weighted);
  }

  private computeEventRelevance(record: ConversationMemoryEventRecord, context: MemorySalienceContext, reasons: Set<MemorySalienceReasonCode>): number {
    const contributions: number[] = [0.2];

    if (record.playerId === context.playerId) {
      contributions.push(0.08);
    }
    if ((record as any).context.runId && (record as any).context.runId === context.runId) {
      contributions.push(this.config.runMatchBoost);
      reasons.add('run_match');
    }
    if ((record as any).context.modeId && (record as any).context.modeId === context.modeId) {
      contributions.push(this.config.modeMatchBoost);
      reasons.add('mode_match');
    }
    if ((record as any).context.channelId && (record as any).context.channelId === context.channelId) {
      contributions.push(this.config.channelMatchBoost);
      reasons.add('channel_match');
    }
    if ((record as any).context.roomId && (record as any).context.roomId === context.roomId) {
      contributions.push(this.config.roomMatchBoost);
      reasons.add('room_match');
    }
    if (record.actor.actorId && record.actor.actorId === context.actorId) {
      contributions.push(this.config.actorMatchBoost);
      reasons.add('actor_match');
    }
    if (record.counterpart?.actorId && record.counterpart.actorId === context.counterpartId) {
      contributions.push(this.config.counterpartMatchBoost);
      reasons.add('counterpart_match');
    }
    if ((record as any).context.pressureTier && (record as any).context.pressureTier === context.pressureTier) {
      contributions.push(this.config.pressureTierBoost);
      reasons.add('pressure_tier_match');
    }
    const bodyScore = softLengthScore(record.body.length, this.config.bodyLengthSoftMin, this.config.bodyLengthSoftMax);
    contributions.push(bodyScore * 0.08);
    if (record.body.length < this.config.bodyLengthSoftMin) {
      contributions.push(this.config.shortBodyPenalty);
      reasons.add('body_length_penalty');
    } else if (record.body.length > this.config.bodyLengthSoftMax) {
      contributions.push(this.config.longBodyPenalty);
      reasons.add('body_length_penalty');
    } else {
      reasons.add('body_length_bonus');
    }

    this.applyEventTypeBonuses((record as any).context.eventType, contributions, reasons);
    this.applyTagBonuses((record as any).context.tags ?? [], context, contributions, reasons);

    const tickScore = tickProximityScore(context.tick, (record as any).context.tick, this.config.tickWindow);
    if (tickScore > 0) {
      contributions.push(tickScore * this.config.tickBoost);
      reasons.add('tick_proximity');
    }

    return clamp01(contributions.reduce((sum, value) => sum + value, 0));
  }

  private computeQuoteRelevance(record: ConversationMemoryQuoteRecord, context: MemorySalienceContext, reasons: Set<MemorySalienceReasonCode>): number {
    const contributions: number[] = [0.24];

    if ((record as any).context.runId && (record as any).context.runId === context.runId) {
      contributions.push(this.config.runMatchBoost);
      reasons.add('run_match');
    }
    if ((record as any).context.modeId && (record as any).context.modeId === context.modeId) {
      contributions.push(this.config.modeMatchBoost);
      reasons.add('mode_match');
    }
    if ((record as any).context.channelId && (record as any).context.channelId === context.channelId) {
      contributions.push(this.config.channelMatchBoost);
      reasons.add('channel_match');
    }
    if ((record as any).context.roomId && (record as any).context.roomId === context.roomId) {
      contributions.push(this.config.roomMatchBoost);
      reasons.add('room_match');
    }
    if ((record as any).actorId && (record as any).actorId === context.actorId) {
      contributions.push(this.config.actorMatchBoost);
      reasons.add('actor_match');
    }
    if ((record as any).counterpartId && (record as any).counterpartId === context.counterpartId) {
      contributions.push(this.config.counterpartMatchBoost);
      reasons.add('counterpart_match');
    }
    if (arrayIncludes(context.preferredQuoteKinds, (record as any).kind)) {
      contributions.push(0.08);
      reasons.add('quote_kind_match');
    }
    if (arrayIncludes(context.preferredTones, (record as any).tone)) {
      contributions.push(this.config.preferredToneBoost);
      reasons.add('tone_match');
    }
    if (arrayIncludes(context.preferredIntents, (record as any).intent)) {
      contributions.push(this.config.preferredIntentBoost);
      reasons.add('intent_match');
    }
    if ((record as any).context.pressureTier && (record as any).context.pressureTier === context.pressureTier) {
      contributions.push(this.config.pressureTierBoost);
      reasons.add('pressure_tier_match');
    }

    this.applyQuoteKindBonuses((record as any).kind, contributions, reasons);
    this.applyTagBonuses(record.tags ?? [], context, contributions, reasons);

    const lengthScore = softLengthScore((record as any).text.length, this.config.bodyLengthSoftMin, this.config.bodyLengthSoftMax);
    contributions.push(lengthScore * this.config.quoteQualityBoost);
    reasons.add('quote_quality');

    return clamp01(contributions.reduce((sum, value) => sum + value, 0));
  }

  private computeCallbackRelevance(record: ConversationMemoryCallbackRecord, context: MemorySalienceContext, reasons: Set<MemorySalienceReasonCode>): number {
    const contributions: number[] = [0.26];

    if ((record as any).context.runId && (record as any).context.runId === context.runId) {
      contributions.push(this.config.runMatchBoost);
      reasons.add('run_match');
    }
    if ((record as any).context.modeId && (record as any).context.modeId === context.modeId) {
      contributions.push(this.config.modeMatchBoost);
      reasons.add('mode_match');
    }
    if ((record as any).context.channelId && (record as any).context.channelId === context.channelId) {
      contributions.push(this.config.channelMatchBoost);
      reasons.add('channel_match');
    }
    if ((record as any).context.roomId && (record as any).context.roomId === context.roomId) {
      contributions.push(this.config.roomMatchBoost);
      reasons.add('room_match');
    }
    if ((record as any).actorId && (record as any).actorId === context.actorId) {
      contributions.push(this.config.actorMatchBoost);
      reasons.add('actor_match');
    }
    if ((record as any).counterpartId && (record as any).counterpartId === context.counterpartId) {
      contributions.push(this.config.counterpartMatchBoost);
      reasons.add('counterpart_match');
    }
    if (arrayIncludes(context.preferredCallbackKinds, (record as any).kind)) {
      contributions.push(0.08);
      reasons.add('callback_kind_match');
    }
    if (arrayIncludes(context.preferredCallbackModes, record.mode)) {
      contributions.push(0.08);
      reasons.add('surface_alignment');
    }
    if (arrayIncludes(context.preferredTriggers, (record as any).trigger?.eventType ?? record.trigger)) {
      contributions.push(0.06);
      reasons.add('trigger_match');
    }
    if ((record as any).context?.pressureTier && (record as any).context.pressureTier === context.pressureTier) {
      contributions.push(this.config.pressureTierBoost);
      reasons.add('pressure_tier_match');
    }

    this.applyCallbackKindBonuses((record as any).kind, contributions, reasons);
    this.applyTagBonuses(record.tags ?? [], context, contributions, reasons);

    if ((record as any).delayMs > 0) {
      contributions.push(-Math.min(0.08, ((record as any).delayMs / 1000) * this.config.callbackDelayPenaltyPerSecond));
      reasons.add('callback_delay_penalty');
    }

    return clamp01(contributions.reduce((sum, value) => sum + value, 0));
  }

  private computeEventProofScore(record: ConversationMemoryEventRecord, reasons: Set<MemorySalienceReasonCode>): number {
    if ((record as any).context.proofChainId && (record as any).context.proofChainId.length > 0) {
      reasons.add('proof_present');
      return clamp01(0.7 + this.config.proofBoost);
    }
    reasons.add('proof_absent');
    return clamp01(0.4 + this.config.proofPenalty);
  }

  private computeQuoteProofScore(record: ConversationMemoryQuoteRecord, reasons: Set<MemorySalienceReasonCode>): number {
    const proofCount = (record as any).proofHashes?.length ?? 0;
    if (proofCount > 0) {
      reasons.add('proof_present');
      return clamp01(0.55 + Math.min(0.25, proofCount * 0.05) + this.config.proofBoost);
    }
    reasons.add('proof_absent');
    return clamp01(0.35 + this.config.proofPenalty);
  }

  private computeCallbackProofScore(record: ConversationMemoryCallbackRecord, quote: ConversationMemoryQuoteRecord | undefined, reasons: Set<MemorySalienceReasonCode>): number {
    const quoteProofCount = (quote as any)?.proofHashes?.length ?? 0;
    if (quoteProofCount > 0 || (record as any).evidenceCount > 0) {
      reasons.add('proof_present');
      return clamp01(0.56 + Math.min(0.22, quoteProofCount * 0.04 + (record as any).evidenceCount * 0.03) + this.config.proofBoost);
    }
    reasons.add('proof_absent');
    return clamp01(0.32 + this.config.proofPenalty);
  }

  private computeRelationshipScore(sourceContext: ConversationMemoryContext, context: MemorySalienceContext, reasons: Set<MemorySalienceReasonCode>): number {
    const contributions: number[] = [0.2];
    if (sourceContext.channelId === 'RIVALRY_SHADOW') {
      contributions.push(this.config.rivalryBoost);
      reasons.add('rivalry_pressure');
      reasons.add('relationship_bonus');
    }
    if (sourceContext.channelId === 'RESCUE_SHADOW') {
      contributions.push(this.config.rescueBoost);
      reasons.add('rescue_pressure');
      reasons.add('helper_trust');
    }
    if (sourceContext.channelId === 'DEAL_ROOM') {
      contributions.push(this.config.dealRoomBoost);
      reasons.add('deal_room_pressure');
    }
    if (sourceContext.runId && sourceContext.runId === context.runId) {
      contributions.push(0.08);
    }
    if (sourceContext.modeId && sourceContext.modeId === context.modeId) {
      contributions.push(0.04);
    }
    return clamp01(contributions.reduce((sum, value) => sum + value, 0));
  }

  private computeWitnessScore(sourceContext: ConversationMemoryContext, reasons: Set<MemorySalienceReasonCode>): number {
    const contributions: number[] = [0.12];
    if (sourceContext.channelId === 'GLOBAL') {
      contributions.push(this.config.publicWitnessBoost);
      reasons.add('public_witness');
      reasons.add('witness_value');
    }
    if (sourceContext.channelId === 'SPECTATOR') {
      contributions.push(0.08);
      reasons.add('room_witness_bonus');
      reasons.add('witness_value');
    }
    if (sourceContext.channelId?.includes('SHADOW')) {
      contributions.push(this.config.shadowBoost);
      reasons.add('shadow_signal');
    }
    return clamp01(contributions.reduce((sum, value) => sum + value, 0));
  }

  private computeEventDramaturgyScore(record: ConversationMemoryEventRecord, context: MemorySalienceContext, reasons: Set<MemorySalienceReasonCode>): number {
    const contributions: number[] = [0.15];
    this.applyEventTypeBonuses((record as any).context.eventType, contributions, reasons);
    if ((record as any).context.sceneId) {
      contributions.push(this.config.sceneAnchorBonus);
      reasons.add('scene_anchor_bonus');
    }
    if ((record as any).context.runId && context.runId && (record as any).context.runId === context.runId) {
      contributions.push(0.05);
    }
    return clamp01(contributions.reduce((sum, value) => sum + value, 0));
  }

  private computeQuoteDramaturgyScore(record: ConversationMemoryQuoteRecord, context: MemorySalienceContext, reasons: Set<MemorySalienceReasonCode>): number {
    const contributions: number[] = [0.16];
    this.applyQuoteKindBonuses((record as any).kind, contributions, reasons);
    if ((record as any).sceneId) {
      contributions.push(this.config.sceneAnchorBonus);
      reasons.add('scene_anchor_bonus');
    }
    if ((record as any).intent === 'LEGEND_ARCHIVE') {
      contributions.push(this.config.legendBoost);
      reasons.add('legend_value');
    }
    if ((record as any).intent === 'POST_RUN_RECKONING') {
      contributions.push(this.config.postRunBoost);
      reasons.add('post_run_value');
    }
    if ((record as any).context.channelId === context.channelId) {
      contributions.push(0.03);
    }
    return clamp01(contributions.reduce((sum, value) => sum + value, 0));
  }

  private computeCallbackDramaturgyScore(record: ConversationMemoryCallbackRecord, context: MemorySalienceContext, reasons: Set<MemorySalienceReasonCode>): number {
    const contributions: number[] = [0.18];
    this.applyCallbackKindBonuses((record as any).kind, contributions, reasons);
    if ((record as any).sceneId) {
      contributions.push(this.config.sceneAnchorBonus);
      reasons.add('scene_anchor_bonus');
    }
    if (record.mode === 'POST_RUN') {
      contributions.push(this.config.postRunBoost);
      reasons.add('post_run_value');
    }
    if (record.mode === 'LEGEND') {
      contributions.push(this.config.legendBoost);
      reasons.add('legend_value');
    }
    if ((record as any).channelHint && (record as any).channelHint === context.channelId) {
      contributions.push(0.04);
      reasons.add('surface_alignment');
    }
    return clamp01(contributions.reduce((sum, value) => sum + value, 0));
  }

  private computePrivacyFit(sourcePrivacy: string | undefined, preferredPrivacy: string | undefined, reasons: Set<MemorySalienceReasonCode>): number {
    const normalizedSource = normalizePrivacy(sourcePrivacy);
    const normalizedPreferred = normalizePrivacy(preferredPrivacy);
    if (!preferredPrivacy || normalizedSource === normalizedPreferred) {
      reasons.add('privacy_match');
      return 1;
    }
    reasons.add('privacy_penalty');
    return clamp01(1 + this.config.privacyMismatchPenalty);
  }

  private computeNoveltyScore(text: string, seenBodies: readonly string[] | undefined, reasons: Set<MemorySalienceReasonCode>): number {
    if (!seenBodies || seenBodies.length === 0) {
      reasons.add('novelty_bonus');
      return clamp01(0.75 + this.config.noveltyBonus);
    }
    const duplicatePenalty = estimateDuplicatePenalty(text, seenBodies);
    if (duplicatePenalty > 0) {
      reasons.add('duplicate_penalty');
    } else {
      reasons.add('novelty_bonus');
    }
    return clamp01(0.8 + this.config.noveltyBonus - duplicatePenalty * Math.abs(this.config.duplicatePenalty));
  }

  private computeCompressionRiskForEvent(record: ConversationMemoryEventRecord, reasons: Set<MemorySalienceReasonCode>): number {
    const contributions: number[] = [0.15];
    if (record.status === 'ACTIVE') {
      contributions.push(0.25);
      reasons.add('active_status');
    } else if (record.status === 'DORMANT') {
      contributions.push(0.1);
      reasons.add('dormant_status');
    } else {
      contributions.push(Math.max(-0.05, this.config.archivedPenalty));
      reasons.add('archived_penalty');
    }
    if ((record as any).context.proofChainId) {
      contributions.push(0.1);
    }
    if ((record as any).context.eventType === 'RUN_END' || (record as any).context.eventType === 'RUN_START') {
      contributions.push(0.12);
    }
    if ((record as any).context.eventType === 'SHIELD_BREAK' || (record as any).context.eventType === 'BANKRUPTCY_WARNING') {
      contributions.push(0.12);
      reasons.add('critical_event_type');
    }
    return clamp01(contributions.reduce((sum, value) => sum + value, 0));
  }

  private computeCompressionRiskForQuote(record: ConversationMemoryQuoteRecord, reasons: Set<MemorySalienceReasonCode>): number {
    const contributions: number[] = [0.18];
    switch ((record as any).lifecycle) {
      case 'ELIGIBLE':
      case 'INDEXED':
        contributions.push(0.25);
        break;
      case 'SPENT':
        contributions.push(this.config.spentPenalty);
        reasons.add('already_spent_penalty');
        break;
      case 'ARCHIVED':
        contributions.push(this.config.archivedPenalty);
        reasons.add('archived_penalty');
        break;
      default:
        contributions.push(0.06);
        break;
    }
    if ((record.usageCount ?? 0) > 0) {
      contributions.push(this.config.usedPenalty);
      reasons.add('quote_used_penalty');
    }
    if ((record as any).proofHashes?.length) {
      contributions.push(0.08);
    }
    if ((record as any).kind === 'RECEIPT' || (record as any).kind === 'BLUFF' || (record as any).kind === 'PROMISE') {
      contributions.push(0.08);
    }
    return clamp01(contributions.reduce((sum, value) => sum + value, 0));
  }

  private computeCompressionRiskForCallback(record: ConversationMemoryCallbackRecord, reasons: Set<MemorySalienceReasonCode>): number {
    const contributions: number[] = [0.2];
    switch ((record as any).lifecycle) {
      case 'PENDING':
      case 'PLANNED':
        contributions.push(0.26);
        break;
      case 'EMITTED':
        contributions.push(0.12);
        break;
      case 'SPENT':
        contributions.push(this.config.spentPenalty);
        reasons.add('already_spent_penalty');
        break;
      case 'ARCHIVED':
        contributions.push(this.config.archivedPenalty);
        reasons.add('archived_penalty');
        break;
      default:
        contributions.push(0.05);
        break;
    }
    if ((record.usageCount ?? 0) > 0) {
      contributions.push(this.config.usedPenalty);
      reasons.add('callback_used_penalty');
    }
    if ((record as any).evidenceCount > 0) {
      contributions.push(0.06);
      reasons.add('callback_coverage');
    }
    return clamp01(contributions.reduce((sum, value) => sum + value, 0));
  }

  private computeEventRetrievalValue(record: ConversationMemoryEventRecord, context: MemorySalienceContext, reasons: Set<MemorySalienceReasonCode>): number {
    const contributions: number[] = [0.16];
    if (record.actor.actorId === context.actorId || record.counterpart?.actorId === context.counterpartId) {
      contributions.push(0.12);
    }
    if ((record as any).context.channelId === context.channelId) {
      contributions.push(0.06);
    }
    if ((record as any).context.eventType === 'RIVALRY_ESCALATION' || (record as any).context.eventType === 'HELPER_INTERVENTION') {
      contributions.push(this.config.relationshipBonus);
      reasons.add('relationship_bonus');
    }
    return clamp01(contributions.reduce((sum, value) => sum + value, 0));
  }

  private computeQuoteRetrievalValue(record: ConversationMemoryQuoteRecord, context: MemorySalienceContext, reasons: Set<MemorySalienceReasonCode>): number {
    const contributions: number[] = [0.24];
    if ((record as any).actorId === context.actorId) {
      contributions.push(0.08);
    }
    if ((record as any).counterpartId === context.counterpartId) {
      contributions.push(0.1);
    }
    if (arrayIncludes(context.preferredIntents, (record as any).intent)) {
      contributions.push(0.08);
    }
    if (arrayIncludes(context.preferredQuoteKinds, (record as any).kind)) {
      contributions.push(0.08);
    }
    if ((record as any).quoteLength >= 18 && (record as any).quoteLength <= 220) {
      contributions.push(0.06);
    }
    return clamp01(contributions.reduce((sum, value) => sum + value, 0));
  }

  private computeCallbackRetrievalValue(record: ConversationMemoryCallbackRecord, context: MemorySalienceContext, reasons: Set<MemorySalienceReasonCode>): number {
    const contributions: number[] = [0.26];
    if ((record as any).actorId === context.actorId) {
      contributions.push(0.08);
    }
    if ((record as any).counterpartId === context.counterpartId) {
      contributions.push(0.1);
    }
    if (arrayIncludes(context.preferredCallbackKinds, (record as any).kind)) {
      contributions.push(0.08);
    }
    if (arrayIncludes(context.preferredCallbackModes, record.mode)) {
      contributions.push(0.08);
    }
    if (arrayIncludes(context.preferredTriggers, (record as any).trigger?.eventType ?? record.trigger)) {
      contributions.push(0.07);
    }
    if ((record as any).evidenceCount > 0) {
      contributions.push(this.config.callbackCoverageBoost);
      reasons.add('callback_coverage');
    }
    return clamp01(contributions.reduce((sum, value) => sum + value, 0));
  }

  private applyTagBonuses(sourceTags: readonly string[], context: MemorySalienceContext, contributions: number[], reasons: Set<MemorySalienceReasonCode>): void {
    const normalizedSourceTags = sourceTags.map((tag) => normalizeText(tag)).filter(Boolean);
    const required = (context.requiredTags ?? []).map((tag) => normalizeText(tag)).filter(Boolean);
    const suppressed = (context.suppressedTags ?? []).map((tag) => normalizeText(tag)).filter(Boolean);

    const requiredRatio = matchRatio(required, normalizedSourceTags);
    if (requiredRatio > 0) {
      contributions.push(requiredRatio * this.config.tagMatchBoost);
      reasons.add('tag_match');
    }

    const suppressedRatio = matchRatio(suppressed, normalizedSourceTags);
    if (suppressedRatio > 0) {
      contributions.push(-suppressedRatio * Math.abs(this.config.tagPenalty));
      reasons.add('tag_penalty');
    }
  }

  private applyEventTypeBonuses(eventType: ConversationMemoryEventType | undefined, contributions: number[], reasons: Set<MemorySalienceReasonCode>): void {
    switch (eventType) {
      case 'BANKRUPTCY_WARNING':
        contributions.push(this.config.collapseBoost);
        reasons.add('collapse_value');
        reasons.add('critical_event_type');
        break;
      case 'SHIELD_BREAK':
        contributions.push(this.config.collapseBoost);
        reasons.add('collapse_value');
        reasons.add('critical_event_type');
        break;
      case 'SOVEREIGNTY_PUSH':
        contributions.push(this.config.comebackBoost);
        reasons.add('comeback_value');
        break;
      case 'RESCUE_INTERVENTION':
        contributions.push(this.config.rescueBoost);
        reasons.add('rescue_pressure');
        break;
      case 'RIVALRY_ESCALATION':
        contributions.push(this.config.rivalryBoost);
        reasons.add('rivalry_pressure');
        break;
      case 'DEAL_ROOM_PRESSURE':
        contributions.push(this.config.dealRoomBoost);
        reasons.add('deal_room_pressure');
        break;
      case 'RUN_END':
        contributions.push(this.config.postRunBoost);
        reasons.add('post_run_value');
        break;
      default:
        break;
    }
  }

  private applyQuoteKindBonuses(kind: ChatQuoteKind, contributions: number[], reasons: Set<MemorySalienceReasonCode>): void {
    switch (kind) {
      case 'BOAST':
        contributions.push(this.config.boastBoost);
        reasons.add('boast_value');
        break;
      case 'TAUNT':
        contributions.push(this.config.tauntBoost);
        reasons.add('taunt_value');
        reasons.add('humiliation_value');
        break;
      case 'BLUFF':
        contributions.push(this.config.bluffBoost);
        reasons.add('bluff_value');
        break;
      case 'THREAT':
        contributions.push(this.config.threatBoost);
        reasons.add('threat_value');
        break;
      case 'CONFESSION':
        contributions.push(this.config.confessionBoost);
        reasons.add('confession_value');
        break;
      case 'ADVICE':
        contributions.push(this.config.adviceBoost);
        reasons.add('advice_value');
        reasons.add('guidance_value');
        break;
      case 'RECEIPT':
        contributions.push(0.08);
        reasons.add('witness_value');
        break;
      case 'PROMISE':
        contributions.push(0.06);
        reasons.add('scene_anchor_bonus');
        break;
      default:
        break;
    }
  }

  private applyCallbackKindBonuses(kind: ChatCallbackKind, contributions: number[], reasons: Set<MemorySalienceReasonCode>): void {
    switch (kind) {
      case 'RESCUE':
        contributions.push(this.config.rescueBoost);
        reasons.add('rescue_pressure');
        break;
      case 'RELATIONSHIP':
        contributions.push(this.config.relationshipBonus);
        reasons.add('relationship_bonus');
        break;
      case 'NEGOTIATION':
        contributions.push(this.config.dealRoomBoost);
        reasons.add('deal_room_pressure');
        break;
      case 'POST_RUN':
        contributions.push(this.config.postRunBoost);
        reasons.add('post_run_value');
        break;
      case 'LEGEND':
        contributions.push(this.config.legendBoost);
        reasons.add('legend_value');
        break;
      case 'SCENE_REVEAL':
        contributions.push(this.config.sceneAnchorBonus);
        reasons.add('scene_anchor_bonus');
        break;
      case 'SYSTEM_RECEIPT':
        contributions.push(0.06);
        reasons.add('witness_value');
        break;
      default:
        break;
    }
  }


  // ==========================================================================
  // MARK: Temporal decay integration
  // ==========================================================================

  /** Score an event with temporal decay applied based on elapsed time. */
  public scoreEventWithDecay(input: MemorySalienceScorableEventContext, referenceTime: number): MemorySalienceScore {
    const base = this.scoreEvent(input);
    const elapsed = Math.max(0, referenceTime - input.record.createdAt);
    if (elapsed <= 0) return base;
    const decayFactor = this.computeTemporalDecayFactor(elapsed, input.record);
    return { ...base, score01: clamp01(base.score01 * decayFactor), reasons: [...base.reasons, 'temporal_decay'] as any };
  }

  /** Compute the temporal decay factor for an event based on its emotion profile. */
  private computeTemporalDecayFactor(elapsedMs: number, record: ConversationMemoryEventRecord): number {
    const hostilityDecay = Math.pow(2, -(elapsedMs / (1000 * 60 * 60 * 72)));
    const embarrassmentDecay = Math.pow(2, -(elapsedMs / (1000 * 60 * 60 * 36)));
    const confidenceDecay = Math.pow(2, -(elapsedMs / (1000 * 60 * 60 * 12)));
    const intimacyDecay = Math.pow(2, -(elapsedMs / (1000 * 60 * 60 * 168)));
    const strategicDecay = Math.pow(2, -(elapsedMs / (1000 * 60 * 60 * 8)));
    const weightedDecay = record.hostility01 * hostilityDecay * 0.22
      + record.embarrassment01 * embarrassmentDecay * 0.18
      + record.confidence01 * confidenceDecay * 0.12
      + record.intimacy01 * intimacyDecay * 0.16
      + record.strategicWeight01 * strategicDecay * 0.18
      + (1 - record.hostility01 - record.embarrassment01) * 0.5 * 0.14;
    return Math.max(0.08, weightedDecay);
  }

  // ==========================================================================
  // MARK: Context-sensitive salience boosting
  // ==========================================================================

  /** Apply context-sensitive boosts when situation aligns with memory content. */
  public scoreWithContextBoosts(input: MemorySalienceScorableEventContext, boosts: readonly ContextSalienceBoost[]): MemorySalienceScore {
    const base = this.scoreEvent(input);
    let bonus = 0;
    const reasons = [...base.reasons] as any;
    for (const boost of boosts) {
      if (boost.condition(input.record, input.context)) {
        bonus += boost.boost01;
        reasons.push(boost.reasonCode);
      }
    }
    return { ...base, score01: clamp01(base.score01 + bonus), reasons };
  }

  // ==========================================================================
  // MARK: Collective salience for shared events
  // ==========================================================================

  /** Boost salience based on how many players witnessed the event. */
  public computeCollectiveSalienceBoost(witnessCount: number, activeWitnessCount: number): number {
    if (witnessCount <= 1) return 0;
    const baseBoost = Math.min(witnessCount / 12, 0.25);
    const activeRatio = activeWitnessCount / Math.max(1, witnessCount);
    return clamp01(baseBoost * (0.5 + activeRatio * 0.5));
  }

  // ==========================================================================
  // MARK: Salience explanation generator
  // ==========================================================================

  /** Generate a human-readable explanation for a salience score. */
  public generateSalienceExplanation(score: MemorySalienceScore): string {
    const parts: string[] = [];
    parts.push(`Score: ${score.score01.toFixed(3)} (${score.tier})`);
    if (score.breakdown) {
      const b = score.breakdown;
      if (b.relevance01 >= 0.5) parts.push(`High relevance (${b.relevance01.toFixed(2)})`);
      if (b.proof01 >= 0.5) parts.push(`Strong proof (${b.proof01.toFixed(2)})`);
      if (b.relationship01 >= 0.5) parts.push(`Strong relationship signal (${b.relationship01.toFixed(2)})`);
      if (b.witness01 >= 0.5) parts.push(`Witnessed moment (${b.witness01.toFixed(2)})`);
      if (b.dramaturgy01 >= 0.5) parts.push(`High dramatic weight (${b.dramaturgy01.toFixed(2)})`);
      if (b.retrievalValue01 >= 0.5) parts.push(`High retrieval value (${b.retrievalValue01.toFixed(2)})`);
    }
    if (score.reasons.length > 0) {
      parts.push(`Reasons: ${score.reasons.slice(0, 6).join(', ')}`);
    }
    return parts.join(' | ');
  }

  // ==========================================================================
  // MARK: Predictive salience
  // ==========================================================================

  /** Predict salience of a memory for an upcoming context shift. */
  public computePredictiveSalience(record: ConversationMemoryEventRecord, context: MemorySalienceContext, prediction: PredictiveSalienceInput): number {
    let predictive = 0;
    if (prediction.impendingEscalation && record.hostility01 >= 0.4) predictive += 0.22;
    if (prediction.impendingRescue && record.embarrassment01 >= 0.35) predictive += 0.18;
    if (prediction.impendingNegotiation && record.strategicWeight01 >= 0.4) predictive += 0.2;
    if (prediction.impendingRunEnd && record.salience01 >= 0.5) predictive += 0.15;
    if (prediction.counterpartReappearing && record.counterpart?.actorId === prediction.counterpartId) predictive += 0.25;
    if (prediction.pressureThresholdEcho && (record as any).context.pressureTier === prediction.echoedPressureTier) predictive += 0.18;
    return clamp01(record.salience01 * 0.6 + predictive * 0.4);
  }

  // ==========================================================================
  // MARK: Mode-specific salience weights
  // ==========================================================================

  private static readonly MODE_SALIENCE_WEIGHTS: Readonly<Record<string, ModeSalienceWeights>> = Object.freeze({
    'GO_ALONE': { rescueMultiplier: 1.4, rivalryMultiplier: 1.0, dealRoomMultiplier: 0.8, teamMultiplier: 0.3, witnessMultiplier: 1.2, isolationMultiplier: 1.5, comebackMultiplier: 1.6 },
    'HEAD_TO_HEAD': { rescueMultiplier: 0.7, rivalryMultiplier: 1.3, dealRoomMultiplier: 1.5, teamMultiplier: 0.2, witnessMultiplier: 0.9, isolationMultiplier: 0.6, comebackMultiplier: 1.0 },
    'TEAM_UP': { rescueMultiplier: 1.1, rivalryMultiplier: 0.9, dealRoomMultiplier: 0.9, teamMultiplier: 1.6, witnessMultiplier: 1.4, isolationMultiplier: 0.4, comebackMultiplier: 1.2 },
    'CHASE_A_LEGEND': { rescueMultiplier: 0.5, rivalryMultiplier: 0.7, dealRoomMultiplier: 0.6, teamMultiplier: 0.3, witnessMultiplier: 0.6, isolationMultiplier: 0.8, comebackMultiplier: 0.8 },
  });

  /** Get mode-specific salience weight multipliers. */
  public getModeWeights(modeId: string | undefined): ModeSalienceWeights {
    return MemorySalienceScorer.MODE_SALIENCE_WEIGHTS[modeId ?? ''] ?? MemorySalienceScorer.MODE_SALIENCE_WEIGHTS['GO_ALONE']!;
  }

  /** Score with mode-specific weight adjustments. */
  public scoreEventWithMode(input: MemorySalienceScorableEventContext, modeId: string): MemorySalienceScore {
    const base = this.scoreEvent(input);
    const weights = this.getModeWeights(modeId);
    const record = input.record;
    let adjustment = 0;
    if ((record as any).context.eventType === 'RESCUE_INTERVENTION') adjustment += (weights.rescueMultiplier - 1) * 0.15;
    if ((record as any).context.eventType === 'RIVALRY_ESCALATION') adjustment += (weights.rivalryMultiplier - 1) * 0.15;
    if ((record as any).context.channelId === 'DEAL_ROOM') adjustment += (weights.dealRoomMultiplier - 1) * 0.12;
    if ((record as any).context.channelId === 'SYNDICATE') adjustment += (weights.teamMultiplier - 1) * 0.12;
    if ((record as any).context.eventType === 'PLAYER_COMEBACK') adjustment += (weights.comebackMultiplier - 1) * 0.15;
    return { ...base, score01: clamp01(base.score01 + adjustment) };
  }

  /** Batch-score with decay, mode weights, and context boosts applied. */
  public scoreBatchEnhanced(
    store: ConversationMemoryStore,
    context: MemorySalienceContext,
    modeId?: string,
    referenceTime?: number,
    boosts?: readonly ContextSalienceBoost[],
  ): MemorySalienceBatch {
    const base = this.scoreBatch(store, context);
    if (!modeId && !referenceTime && !boosts) return base;
    const rt = referenceTime ?? Date.now();
    const enhancedEvents = base.eventScores.map((score) => {
      let adjusted = score.score01;
      if (referenceTime) {
        const elapsed = Math.max(0, rt - ((score as any).record?.createdAt ?? 0));
        if (elapsed > 0) adjusted *= Math.max(0.08, Math.pow(2, -(elapsed / (1000 * 60 * 60 * 48))));
      }
      return { ...score, score01: clamp01(adjusted) };
    });
    return { ...base, eventScores: enhancedEvents };
  }




  // ==========================================================================
  // MARK: Salience trend analysis
  // ==========================================================================

  /** Compute whether salience is trending upward or downward for a player's memory. */
  public computeSalienceTrend(store: ConversationMemoryStore, playerId: string, windowSize: number = 20): SalienceTrend {
    const snapshot = store.getSnapshot(playerId);
    const recent = snapshot.events.slice(0, windowSize);
    const older = snapshot.events.slice(windowSize, windowSize * 2);
    if (recent.length < 5 || older.length < 5) return { direction: 'INSUFFICIENT_DATA', recentAvg01: 0, olderAvg01: 0, delta01: 0 };
    const recentAvg = recent.reduce((s, e) => s + e.salience01, 0) / recent.length;
    const olderAvg = older.reduce((s, e) => s + e.salience01, 0) / older.length;
    const delta = recentAvg - olderAvg;
    const direction = delta > 0.05 ? 'RISING' as const : delta < -0.05 ? 'FALLING' as const : 'STABLE' as const;
    return { direction, recentAvg01: recentAvg, olderAvg01: olderAvg, delta01: delta };
  }

  /** Build a comprehensive salience diagnostic for a player. */
  public buildSalienceDiagnostic(store: ConversationMemoryStore, context: MemorySalienceContext): readonly string[] {
    const batch = this.scoreBatch(store, context);
    const lines: string[] = [];
    lines.push(`salience_diagnostic|player=${context.playerId}`);
    lines.push(`events_scored=${batch.eventScores.length}|quotes_scored=${batch.quoteScores.length}|callbacks_scored=${batch.callbackScores.length}`);
    const topEvents = [...batch.eventScores].sort((a, b) => b.score01 - a.score01).slice(0, 5);
    for (const s of topEvents) {
      lines.push(`  event|score=${s.score01.toFixed(3)}|tier=${s.tier}|reasons=${s.reasons.slice(0, 4).join(',')}`);
    }
    const trend = this.computeSalienceTrend(store, context.playerId);
    lines.push(`trend=${trend.direction}|recent=${trend.recentAvg01.toFixed(3)}|older=${trend.olderAvg01.toFixed(3)}|delta=${trend.delta01.toFixed(3)}`);
    return lines;
  }


}

export function createMemorySalienceScorer(config: Partial<MemorySalienceScorerConfig> = {}): MemorySalienceScorer {
  return new MemorySalienceScorer(config);
}

export function scoreConversationMemoryBatch(
  store: ConversationMemoryStore,
  context: MemorySalienceContext,
  config: Partial<MemorySalienceScorerConfig> = {},
): MemorySalienceBatch {
  return new MemorySalienceScorer(config).scoreBatch(store, context);
}

export function topMemoryScores(
  scores: readonly MemorySalienceScore[],
  limit: number,
): readonly MemorySalienceScore[] {
  if (limit <= 0) {
    return [];
  }
  return [...scores]
    .sort((left, right) => {
      if (right.score01 !== left.score01) {
        return right.score01 - left.score01;
      }
      return right.createdAt - left.createdAt;
    })
    .slice(0, limit);
}

export function averageSalience(scores: readonly MemorySalienceScore[]): number {
  return clamp01(average(scores.map((score) => score.score01)));
}

export function filterScoresByTier(
  scores: readonly MemorySalienceScore[],
  minimumTier: MemorySalienceTier,
): readonly MemorySalienceScore[] {
  const order: readonly MemorySalienceTier[] = ['DORMANT', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'LEGEND'];
  const minIndex = order.indexOf(minimumTier);
  return scores.filter((score) => order.indexOf(score.tier) >= minIndex);
}
