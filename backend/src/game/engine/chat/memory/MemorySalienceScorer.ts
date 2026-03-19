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
  ChatCallbackMode,
  ChatCallbackPrivacyClass,
  ChatCallbackTrigger,
} from '../../../../../shared/contracts/chat/ChatCallback';
import type {
  ChatQuoteAudienceClass,
  ChatQuoteKind,
  ChatQuoteToneClass,
  ChatQuoteUseIntent,
} from '../../../../../shared/contracts/chat/ChatQuote';
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
    const tags = uniqueStrings([...(input.record.context.tags ?? []), ...(input.context.requiredTags ?? [])]);

    const relevance01 = this.computeEventRelevance(input.record, input.context, reasons);
    const recency01 = recencyScore(input.record.createdAt, referenceNow, this.config.recencyWindowMs);
    if (recency01 > 0.66) {
      reasons.add('recent');
    }
    const proof01 = this.computeEventProofScore(input.record, reasons);
    const relationship01 = this.computeRelationshipScore(input.record.context, input.context, reasons);
    const witness01 = this.computeWitnessScore(input.record.context, reasons);
    const dramaturgy01 = this.computeEventDramaturgyScore(input.record, input.context, reasons);
    const privacyFit01 = this.computePrivacyFit(input.record.context.privacyLevel, input.context.preferredPrivacy, reasons);
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
      roomId: input.record.context.roomId,
      channelId: input.record.context.channelId,
      tags,
      snapshot: summarizeSnapshot('EVENT', {
        eventType: input.record.context.eventType,
        channelId: input.record.context.channelId,
        roomId: input.record.context.roomId,
        pressureTier: input.record.context.pressureTier,
        tick: input.record.context.tick,
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
    const relationship01 = this.computeRelationshipScore(input.record.context, input.context, reasons);
    const witness01 = this.computeWitnessScore(input.record.context, reasons);
    const dramaturgy01 = this.computeQuoteDramaturgyScore(input.record, input.context, reasons);
    const privacyFit01 = this.computePrivacyFit(input.record.context.privacyLevel, input.context.preferredPrivacy, reasons);
    const novelty01 = this.computeNoveltyScore(input.record.text, input.seenBodies, reasons);
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
      id: input.record.quoteId,
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
      actorId: input.record.actorId,
      counterpartId: input.record.counterpartId,
      roomId: input.record.context.roomId,
      channelId: input.record.context.channelId,
      tags,
      snapshot: summarizeSnapshot('QUOTE', {
        kind: input.record.kind,
        channelId: input.record.context.channelId,
        roomId: input.record.context.roomId,
        pressureTier: input.record.context.pressureTier,
        audienceClass: input.record.audienceClass,
        lifecycle: input.record.lifecycle,
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
    const proof01 = this.computeCallbackProofScore(input.record, input.quote, reasons);
    const relationship01 = this.computeRelationshipScore(input.record.context, input.context, reasons);
    const witness01 = this.computeWitnessScore(input.record.context, reasons);
    const dramaturgy01 = this.computeCallbackDramaturgyScore(input.record, input.context, reasons);
    const privacyFit01 = this.computePrivacyFit(input.record.context.privacyLevel, input.context.preferredPrivacy, reasons);
    const novelty01 = this.computeNoveltyScore(input.record.text, input.seenBodies, reasons);
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
      actorId: input.record.actorId,
      counterpartId: input.record.counterpartId,
      roomId: input.record.context.roomId,
      channelId: input.record.context.channelId,
      tags,
      snapshot: summarizeSnapshot('CALLBACK', {
        kind: input.record.kind,
        mode: input.record.mode,
        trigger: input.record.trigger,
        channelId: input.record.context.channelId,
        roomId: input.record.context.roomId,
        privacyClass: input.record.privacyClass,
        lifecycle: input.record.lifecycle,
      }),
    };
  }

  public scoreQuoteCandidate(candidate: ConversationQuoteCandidate, context: MemorySalienceContext): MemorySalienceScore {
    return this.scoreQuote({
      record: candidate.record,
      context,
      parentEvent: candidate.event,
      seenBodies: candidate.reasons,
    });
  }

  public scoreCallbackCandidate(candidate: ConversationCallbackCandidate, context: MemorySalienceContext): MemorySalienceScore {
    return this.scoreCallback({
      record: candidate.record,
      context,
      event: candidate.event,
      quote: candidate.quote,
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
      quote: record.quoteId ? store.getQuote(context.playerId, record.quoteId) : undefined,
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
    if (record.context.runId && record.context.runId === context.runId) {
      contributions.push(this.config.runMatchBoost);
      reasons.add('run_match');
    }
    if (record.context.modeId && record.context.modeId === context.modeId) {
      contributions.push(this.config.modeMatchBoost);
      reasons.add('mode_match');
    }
    if (record.context.channelId && record.context.channelId === context.channelId) {
      contributions.push(this.config.channelMatchBoost);
      reasons.add('channel_match');
    }
    if (record.context.roomId && record.context.roomId === context.roomId) {
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
    if (record.context.pressureTier && record.context.pressureTier === context.pressureTier) {
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

    this.applyEventTypeBonuses(record.context.eventType, contributions, reasons);
    this.applyTagBonuses(record.context.tags ?? [], context, contributions, reasons);

    const tickScore = tickProximityScore(context.tick, record.context.tick, this.config.tickWindow);
    if (tickScore > 0) {
      contributions.push(tickScore * this.config.tickBoost);
      reasons.add('tick_proximity');
    }

    return clamp01(contributions.reduce((sum, value) => sum + value, 0));
  }

  private computeQuoteRelevance(record: ConversationMemoryQuoteRecord, context: MemorySalienceContext, reasons: Set<MemorySalienceReasonCode>): number {
    const contributions: number[] = [0.24];

    if (record.context.runId && record.context.runId === context.runId) {
      contributions.push(this.config.runMatchBoost);
      reasons.add('run_match');
    }
    if (record.context.modeId && record.context.modeId === context.modeId) {
      contributions.push(this.config.modeMatchBoost);
      reasons.add('mode_match');
    }
    if (record.context.channelId && record.context.channelId === context.channelId) {
      contributions.push(this.config.channelMatchBoost);
      reasons.add('channel_match');
    }
    if (record.context.roomId && record.context.roomId === context.roomId) {
      contributions.push(this.config.roomMatchBoost);
      reasons.add('room_match');
    }
    if (record.actorId && record.actorId === context.actorId) {
      contributions.push(this.config.actorMatchBoost);
      reasons.add('actor_match');
    }
    if (record.counterpartId && record.counterpartId === context.counterpartId) {
      contributions.push(this.config.counterpartMatchBoost);
      reasons.add('counterpart_match');
    }
    if (arrayIncludes(context.preferredQuoteKinds, record.kind)) {
      contributions.push(0.08);
      reasons.add('quote_kind_match');
    }
    if (arrayIncludes(context.preferredTones, record.tone)) {
      contributions.push(this.config.preferredToneBoost);
      reasons.add('tone_match');
    }
    if (arrayIncludes(context.preferredIntents, record.intent)) {
      contributions.push(this.config.preferredIntentBoost);
      reasons.add('intent_match');
    }
    if (record.context.pressureTier && record.context.pressureTier === context.pressureTier) {
      contributions.push(this.config.pressureTierBoost);
      reasons.add('pressure_tier_match');
    }

    this.applyQuoteKindBonuses(record.kind, contributions, reasons);
    this.applyTagBonuses(record.tags ?? [], context, contributions, reasons);

    const lengthScore = softLengthScore(record.text.length, this.config.bodyLengthSoftMin, this.config.bodyLengthSoftMax);
    contributions.push(lengthScore * this.config.quoteQualityBoost);
    reasons.add('quote_quality');

    return clamp01(contributions.reduce((sum, value) => sum + value, 0));
  }

  private computeCallbackRelevance(record: ConversationMemoryCallbackRecord, context: MemorySalienceContext, reasons: Set<MemorySalienceReasonCode>): number {
    const contributions: number[] = [0.26];

    if (record.context.runId && record.context.runId === context.runId) {
      contributions.push(this.config.runMatchBoost);
      reasons.add('run_match');
    }
    if (record.context.modeId && record.context.modeId === context.modeId) {
      contributions.push(this.config.modeMatchBoost);
      reasons.add('mode_match');
    }
    if (record.context.channelId && record.context.channelId === context.channelId) {
      contributions.push(this.config.channelMatchBoost);
      reasons.add('channel_match');
    }
    if (record.context.roomId && record.context.roomId === context.roomId) {
      contributions.push(this.config.roomMatchBoost);
      reasons.add('room_match');
    }
    if (record.actorId && record.actorId === context.actorId) {
      contributions.push(this.config.actorMatchBoost);
      reasons.add('actor_match');
    }
    if (record.counterpartId && record.counterpartId === context.counterpartId) {
      contributions.push(this.config.counterpartMatchBoost);
      reasons.add('counterpart_match');
    }
    if (arrayIncludes(context.preferredCallbackKinds, record.kind)) {
      contributions.push(0.08);
      reasons.add('callback_kind_match');
    }
    if (arrayIncludes(context.preferredCallbackModes, record.mode)) {
      contributions.push(0.08);
      reasons.add('surface_alignment');
    }
    if (arrayIncludes(context.preferredTriggers, record.trigger)) {
      contributions.push(0.06);
      reasons.add('trigger_match');
    }
    if (record.context.pressureTier && record.context.pressureTier === context.pressureTier) {
      contributions.push(this.config.pressureTierBoost);
      reasons.add('pressure_tier_match');
    }

    this.applyCallbackKindBonuses(record.kind, contributions, reasons);
    this.applyTagBonuses(record.tags ?? [], context, contributions, reasons);

    if (record.delayMs > 0) {
      contributions.push(-Math.min(0.08, (record.delayMs / 1000) * this.config.callbackDelayPenaltyPerSecond));
      reasons.add('callback_delay_penalty');
    }

    return clamp01(contributions.reduce((sum, value) => sum + value, 0));
  }

  private computeEventProofScore(record: ConversationMemoryEventRecord, reasons: Set<MemorySalienceReasonCode>): number {
    if (record.context.proofChainId && record.context.proofChainId.length > 0) {
      reasons.add('proof_present');
      return clamp01(0.7 + this.config.proofBoost);
    }
    reasons.add('proof_absent');
    return clamp01(0.4 + this.config.proofPenalty);
  }

  private computeQuoteProofScore(record: ConversationMemoryQuoteRecord, reasons: Set<MemorySalienceReasonCode>): number {
    const proofCount = record.proofHashes?.length ?? 0;
    if (proofCount > 0) {
      reasons.add('proof_present');
      return clamp01(0.55 + Math.min(0.25, proofCount * 0.05) + this.config.proofBoost);
    }
    reasons.add('proof_absent');
    return clamp01(0.35 + this.config.proofPenalty);
  }

  private computeCallbackProofScore(record: ConversationMemoryCallbackRecord, quote: ConversationMemoryQuoteRecord | undefined, reasons: Set<MemorySalienceReasonCode>): number {
    const quoteProofCount = quote?.proofHashes?.length ?? 0;
    if (quoteProofCount > 0 || record.evidenceCount > 0) {
      reasons.add('proof_present');
      return clamp01(0.56 + Math.min(0.22, quoteProofCount * 0.04 + record.evidenceCount * 0.03) + this.config.proofBoost);
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
    this.applyEventTypeBonuses(record.context.eventType, contributions, reasons);
    if (record.context.sceneId) {
      contributions.push(this.config.sceneAnchorBonus);
      reasons.add('scene_anchor_bonus');
    }
    if (record.context.runId && context.runId && record.context.runId === context.runId) {
      contributions.push(0.05);
    }
    return clamp01(contributions.reduce((sum, value) => sum + value, 0));
  }

  private computeQuoteDramaturgyScore(record: ConversationMemoryQuoteRecord, context: MemorySalienceContext, reasons: Set<MemorySalienceReasonCode>): number {
    const contributions: number[] = [0.16];
    this.applyQuoteKindBonuses(record.kind, contributions, reasons);
    if (record.sceneId) {
      contributions.push(this.config.sceneAnchorBonus);
      reasons.add('scene_anchor_bonus');
    }
    if (record.intent === 'LEGEND_ARCHIVE') {
      contributions.push(this.config.legendBoost);
      reasons.add('legend_value');
    }
    if (record.intent === 'POST_RUN_RECKONING') {
      contributions.push(this.config.postRunBoost);
      reasons.add('post_run_value');
    }
    if (record.context.channelId === context.channelId) {
      contributions.push(0.03);
    }
    return clamp01(contributions.reduce((sum, value) => sum + value, 0));
  }

  private computeCallbackDramaturgyScore(record: ConversationMemoryCallbackRecord, context: MemorySalienceContext, reasons: Set<MemorySalienceReasonCode>): number {
    const contributions: number[] = [0.18];
    this.applyCallbackKindBonuses(record.kind, contributions, reasons);
    if (record.sceneId) {
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
    if (record.channelHint && record.channelHint === context.channelId) {
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
    if (record.context.proofChainId) {
      contributions.push(0.1);
    }
    if (record.context.eventType === 'RUN_END' || record.context.eventType === 'RUN_START') {
      contributions.push(0.12);
    }
    if (record.context.eventType === 'SHIELD_BREAK' || record.context.eventType === 'BANKRUPTCY_WARNING') {
      contributions.push(0.12);
      reasons.add('critical_event_type');
    }
    return clamp01(contributions.reduce((sum, value) => sum + value, 0));
  }

  private computeCompressionRiskForQuote(record: ConversationMemoryQuoteRecord, reasons: Set<MemorySalienceReasonCode>): number {
    const contributions: number[] = [0.18];
    switch (record.lifecycle) {
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
    if ((record.useCount ?? 0) > 0) {
      contributions.push(this.config.usedPenalty);
      reasons.add('quote_used_penalty');
    }
    if (record.proofHashes?.length) {
      contributions.push(0.08);
    }
    if (record.kind === 'RECEIPT' || record.kind === 'BLUFF' || record.kind === 'PROMISE') {
      contributions.push(0.08);
    }
    return clamp01(contributions.reduce((sum, value) => sum + value, 0));
  }

  private computeCompressionRiskForCallback(record: ConversationMemoryCallbackRecord, reasons: Set<MemorySalienceReasonCode>): number {
    const contributions: number[] = [0.2];
    switch (record.lifecycle) {
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
    if ((record.useCount ?? 0) > 0) {
      contributions.push(this.config.usedPenalty);
      reasons.add('callback_used_penalty');
    }
    if (record.evidenceCount > 0) {
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
    if (record.context.channelId === context.channelId) {
      contributions.push(0.06);
    }
    if (record.context.eventType === 'RIVALRY_ESCALATION' || record.context.eventType === 'HELPER_INTERVENTION') {
      contributions.push(this.config.relationshipBonus);
      reasons.add('relationship_bonus');
    }
    return clamp01(contributions.reduce((sum, value) => sum + value, 0));
  }

  private computeQuoteRetrievalValue(record: ConversationMemoryQuoteRecord, context: MemorySalienceContext, reasons: Set<MemorySalienceReasonCode>): number {
    const contributions: number[] = [0.24];
    if (record.actorId === context.actorId) {
      contributions.push(0.08);
    }
    if (record.counterpartId === context.counterpartId) {
      contributions.push(0.1);
    }
    if (arrayIncludes(context.preferredIntents, record.intent)) {
      contributions.push(0.08);
    }
    if (arrayIncludes(context.preferredQuoteKinds, record.kind)) {
      contributions.push(0.08);
    }
    if (record.quoteLength >= 18 && record.quoteLength <= 220) {
      contributions.push(0.06);
    }
    return clamp01(contributions.reduce((sum, value) => sum + value, 0));
  }

  private computeCallbackRetrievalValue(record: ConversationMemoryCallbackRecord, context: MemorySalienceContext, reasons: Set<MemorySalienceReasonCode>): number {
    const contributions: number[] = [0.26];
    if (record.actorId === context.actorId) {
      contributions.push(0.08);
    }
    if (record.counterpartId === context.counterpartId) {
      contributions.push(0.1);
    }
    if (arrayIncludes(context.preferredCallbackKinds, record.kind)) {
      contributions.push(0.08);
    }
    if (arrayIncludes(context.preferredCallbackModes, record.mode)) {
      contributions.push(0.08);
    }
    if (arrayIncludes(context.preferredTriggers, record.trigger)) {
      contributions.push(0.07);
    }
    if (record.evidenceCount > 0) {
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
