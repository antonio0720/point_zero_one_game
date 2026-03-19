/**
 * backend/src/game/engine/chat/memory/QuoteRecallResolver.ts
 *
 * Backend quote and callback recall resolver.
 *
 * Converts ConversationMemoryStore state into ranked recall decisions for
 * hater receipts, helper reminders, system callbacks, deal-room bluff
 * exposure, and dramaturgic witness lines.
 */

import type {
  ChatCallbackMode,
  ChatCallbackResolution,
} from '../../../../../shared/contracts/chat/ChatCallback';
import type {
  ChatQuoteKind,
  ChatQuoteResolution,
  ChatQuoteSelection,
} from '../../../../../shared/contracts/chat/ChatQuote';
import {
  ConversationMemoryStore,
  type ConversationCallbackCandidate,
  type ConversationMemoryEventRecord,
  type ConversationMemoryQuoteRecord,
  type ConversationQuoteCandidate,
} from './ConversationMemoryStore';

export type QuoteRecallMode = 'RIVALRY' | 'HELPER' | 'SYSTEM' | 'DEAL_ROOM' | 'AUDIENCE' | 'RESCUE' | 'POSTRUN';
export type QuoteRecallReasonCode =
  | 'counterpart_match'
  | 'actor_match'
  | 'channel_match'
  | 'run_match'
  | 'mode_match'
  | 'kind_match'
  | 'pressure_match'
  | 'privacy_match'
  | 'unresolved'
  | 'receipt_kind'
  | 'callback_kind'
  | 'helper_kind'
  | 'bluff_kind'
  | 'threat_kind'
  | 'boast_kind'
  | 'advice_kind'
  | 'recency_boost'
  | 'novelty_penalty'
  | 'relationship_pressure'
  | 'witness_value'
  | 'proof_strength'
  | 'reuse_penalty'
  | 'embarrassment_match'
  | 'confidence_match'
  | 'hostility_match'
  | 'intimacy_match'
  | 'strategic_match'
  ;

export interface QuoteRecallResolverRequest {
  readonly requestId: string;
  readonly createdAt: number;
  readonly playerId: string;
  readonly mode: QuoteRecallMode;
  readonly actorId?: string;
  readonly counterpartId?: string;
  readonly runId?: string;
  readonly modeId?: string;
  readonly channelId?: string;
  readonly roomId?: string;
  readonly desiredKinds?: readonly ChatQuoteKind[];
  readonly allowedCallbackModes?: readonly string[];
  readonly preferredPrivacy?: 'PUBLIC' | 'TEAM' | 'PRIVATE' | 'SHADOW';
  readonly pressureTier?: string;
  readonly includeCallbacks?: boolean;
  readonly includeQuotes?: boolean;
  readonly maxSelections?: number;
  readonly allowReuse?: boolean;
  readonly proofRequired?: boolean;
  readonly tags?: readonly string[];
}

export interface QuoteRecallSelection {
  readonly selectionId: string;
  readonly quoteId?: string;
  readonly callbackId?: string;
  readonly memoryId: string;
  readonly mode: QuoteRecallMode;
  readonly surface: 'QUOTE' | 'CALLBACK' | 'HYBRID';
  readonly text: string;
  readonly normalizedText: string;
  readonly score01: number;
  readonly reasonCodes: readonly QuoteRecallReasonCode[];
  readonly tags: readonly string[];
  readonly createdAt: number;
  readonly proofChainId?: string;
  readonly quote?: ConversationMemoryQuoteRecord;
  readonly callback?: ConversationCallbackCandidate['record'];
}

export interface QuoteRecallResolverResponse {
  readonly requestId: string;
  readonly createdAt: number;
  readonly mode: QuoteRecallMode;
  readonly playerId: string;
  readonly selections: readonly QuoteRecallSelection[];
  readonly winningSelection?: QuoteRecallSelection;
  readonly quoteResolution?: ChatQuoteResolution;
  readonly callbackResolution?: ChatCallbackResolution;
  readonly auditTrail: readonly string[];
}

export interface QuoteRecallResolverConfig {
  readonly defaultMaxSelections: number;
  readonly maxAuditTrailLines: number;
  readonly proofRequiredBoost: number;
  readonly counterpartBoost: number;
  readonly actorBoost: number;
  readonly channelBoost: number;
  readonly unresolvedBoost: number;
  readonly recencyBoostWindowMs: number;
  readonly reusePenaltyPerUse: number;
  readonly minimumSelectionScore01: number;
}

export interface QuoteRecallModeProfile {
  readonly mode: QuoteRecallMode;
  readonly baseWeight: number;
  readonly kindWeights: Readonly<Record<string, number>>;
  readonly callbackWeights: Readonly<Record<string, number>>;
  readonly unresolvedBias: number;
  readonly privacyBias: number;
  readonly witnessBias: number;
  readonly pressureBias: number;
}

export const DEFAULT_QUOTE_RECALL_RESOLVER_CONFIG: QuoteRecallResolverConfig = Object.freeze({
  defaultMaxSelections: 8,
  maxAuditTrailLines: 48,
  proofRequiredBoost: 0.08,
  counterpartBoost: 0.12,
  actorBoost: 0.08,
  channelBoost: 0.06,
  unresolvedBoost: 0.09,
  recencyBoostWindowMs: 1000 * 60 * 10,
  reusePenaltyPerUse: 0.04,
  minimumSelectionScore01: 0.24,
});

function clamp01(value: number): number { if (Number.isNaN(value)) return 0; if (value <= 0) return 0; if (value >= 1) return 1; return value; }
function normalizeText(input: string): string { return input.toLowerCase().replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[^a-z0-9\s'"!?.,:-]/g, ' ').replace(/\s+/g, ' ').trim(); }
function unique<T>(values: readonly T[]): readonly T[] { return [...new Set(values)]; }
function recencyBoost(createdAt: number, nowAt: number, windowMs: number): number { const age = Math.max(0, nowAt - createdAt); if (age >= windowMs) return 0; return 1 - age / windowMs; }
function confidenceSignal(text: string): number { const normalized = normalizeText(text); const markers = ['easy','watch me','locked','free','certain','clean']; let score = 0; for (const marker of markers) if (normalized.includes(marker)) score += 0.11; return clamp01(score); }
function embarrassmentSignal(text: string): number { const normalized = normalizeText(text); const markers = ['missed','oops','my bad','folded','choked','hesitated']; let score = 0; for (const marker of markers) if (normalized.includes(marker)) score += 0.12; return clamp01(score); }
function hostilitySignal(text: string): number { const normalized = normalizeText(text); const markers = ['trash','quit','weak','fraud','dead','easy']; let score = 0; for (const marker of markers) if (normalized.includes(marker)) score += 0.12; return clamp01(score); }
function intimacySignal(text: string): number { const normalized = normalizeText(text); const markers = ['remember','trust','listen','last time','you know']; let score = 0; for (const marker of markers) if (normalized.includes(marker)) score += 0.12; return clamp01(score); }

export const QUOTE_RECALL_MODE_PROFILES: Readonly<Record<QuoteRecallMode, QuoteRecallModeProfile>> = Object.freeze({
  RIVALRY: {
    mode: 'RIVALRY',
    baseWeight: 1,
    kindWeights: Object.freeze({
      RECEIPT: 0.98,
      CALLBACK: 0.9,
      BOAST: 0.86,
      THREAT: 0.88,
      BLUFF: 0.55,
      ADVICE: 0.22,
      STATEMENT: 0.36,
    }),
    callbackWeights: Object.freeze({
      RIVALRY: 0.98,
      RECEIPT: 0.9,
      NEGOTIATION: 0.42,
      HELPER_RECALL: 0.18,
    }),
    unresolvedBias: 0.14,
    privacyBias: 0.02,
    witnessBias: 0.18,
    pressureBias: 0.16,
  },
  HELPER: {
    mode: 'HELPER',
    baseWeight: 1,
    kindWeights: Object.freeze({
      ADVICE: 0.96,
      CALLBACK: 0.82,
      RECEIPT: 0.54,
      BOAST: 0.2,
      THREAT: 0.18,
      BLUFF: 0.24,
      STATEMENT: 0.44,
    }),
    callbackWeights: Object.freeze({
      HELPER_RECALL: 0.98,
      RECEIPT: 0.34,
      RIVALRY: 0.14,
      NEGOTIATION: 0.16,
    }),
    unresolvedBias: 0.12,
    privacyBias: 0.12,
    witnessBias: 0.08,
    pressureBias: 0.14,
  },
  SYSTEM: {
    mode: 'SYSTEM',
    baseWeight: 1,
    kindWeights: Object.freeze({
      CALLBACK: 0.9,
      RECEIPT: 0.82,
      STATEMENT: 0.48,
      BOAST: 0.36,
      THREAT: 0.42,
      BLUFF: 0.52,
      ADVICE: 0.4,
    }),
    callbackWeights: Object.freeze({
      RECEIPT: 0.78,
      RIVALRY: 0.58,
      NEGOTIATION: 0.46,
      HELPER_RECALL: 0.42,
    }),
    unresolvedBias: 0.08,
    privacyBias: 0.08,
    witnessBias: 0.16,
    pressureBias: 0.14,
  },
  DEAL_ROOM: {
    mode: 'DEAL_ROOM',
    baseWeight: 1,
    kindWeights: Object.freeze({
      BLUFF: 0.98,
      RECEIPT: 0.72,
      CALLBACK: 0.66,
      STATEMENT: 0.44,
      BOAST: 0.4,
      THREAT: 0.36,
      ADVICE: 0.18,
    }),
    callbackWeights: Object.freeze({
      NEGOTIATION: 0.98,
      RECEIPT: 0.62,
      RIVALRY: 0.34,
      HELPER_RECALL: 0.14,
    }),
    unresolvedBias: 0.1,
    privacyBias: 0.04,
    witnessBias: 0.12,
    pressureBias: 0.16,
  },
  AUDIENCE: {
    mode: 'AUDIENCE',
    baseWeight: 1,
    kindWeights: Object.freeze({
      BOAST: 0.94,
      RECEIPT: 0.82,
      CALLBACK: 0.7,
      THREAT: 0.74,
      STATEMENT: 0.42,
      BLUFF: 0.36,
      ADVICE: 0.14,
    }),
    callbackWeights: Object.freeze({
      RIVALRY: 0.88,
      RECEIPT: 0.82,
      NEGOTIATION: 0.3,
      HELPER_RECALL: 0.08,
    }),
    unresolvedBias: 0.1,
    privacyBias: 0.0,
    witnessBias: 0.24,
    pressureBias: 0.18,
  },
  RESCUE: {
    mode: 'RESCUE',
    baseWeight: 1,
    kindWeights: Object.freeze({
      ADVICE: 0.94,
      CALLBACK: 0.86,
      RECEIPT: 0.46,
      STATEMENT: 0.4,
      BOAST: 0.18,
      THREAT: 0.22,
      BLUFF: 0.16,
    }),
    callbackWeights: Object.freeze({
      HELPER_RECALL: 0.98,
      RECEIPT: 0.26,
      RIVALRY: 0.08,
      NEGOTIATION: 0.1,
    }),
    unresolvedBias: 0.14,
    privacyBias: 0.18,
    witnessBias: 0.06,
    pressureBias: 0.18,
  },
  POSTRUN: {
    mode: 'POSTRUN',
    baseWeight: 1,
    kindWeights: Object.freeze({
      CALLBACK: 0.96,
      RECEIPT: 0.84,
      ADVICE: 0.62,
      BOAST: 0.58,
      THREAT: 0.58,
      BLUFF: 0.52,
      STATEMENT: 0.44,
    }),
    callbackWeights: Object.freeze({
      RIVALRY: 0.74,
      RECEIPT: 0.82,
      HELPER_RECALL: 0.7,
      NEGOTIATION: 0.42,
    }),
    unresolvedBias: 0.12,
    privacyBias: 0.08,
    witnessBias: 0.22,
    pressureBias: 0.16,
  },
});

export class QuoteRecallResolver {
  private readonly config: QuoteRecallResolverConfig;
  private readonly store: ConversationMemoryStore;

  public constructor(store: ConversationMemoryStore, config: Partial<QuoteRecallResolverConfig> = {}) {
    this.store = store;
    this.config = Object.freeze({ ...DEFAULT_QUOTE_RECALL_RESOLVER_CONFIG, ...config });
  }

private profile(mode: QuoteRecallMode): QuoteRecallModeProfile {
    return QUOTE_RECALL_MODE_PROFILES[mode];
  }

  private quoteReasonCodes(request: QuoteRecallResolverRequest, record: ConversationMemoryQuoteRecord): QuoteRecallReasonCode[] {
    const reasons: QuoteRecallReasonCode[] = [];
    if (request.counterpartId && record.counterpartId === request.counterpartId) reasons.push('counterpart_match');
    if (request.actorId && record.actorId === request.actorId) reasons.push('actor_match');
    if (request.channelId && record.evidence.some((item) => item.channelId === request.channelId)) reasons.push('channel_match');
    if (request.runId && record.evidence.some((item) => item.runId === request.runId)) reasons.push('run_match');
    if (request.modeId && record.evidence.some((item) => item.modeId === request.modeId)) reasons.push('mode_match');
    if (record.unresolved) reasons.push('unresolved');
    if (record.kind === 'RECEIPT') reasons.push('receipt_kind');
    if (record.kind === 'CALLBACK') reasons.push('callback_kind');
    if (record.kind === 'ADVICE') reasons.push('helper_kind');
    if (record.kind === 'BLUFF') reasons.push('bluff_kind');
    if (record.kind === 'THREAT') reasons.push('threat_kind');
    if (record.kind === 'BOAST') reasons.push('boast_kind');
    return unique(reasons);
  }

  private callbackReasonCodes(request: QuoteRecallResolverRequest, candidate: ConversationCallbackCandidate): QuoteRecallReasonCode[] {
    const reasons: QuoteRecallReasonCode[] = [];
    const record = candidate.record;
    if (request.counterpartId && record.context.counterpartId === request.counterpartId) reasons.push('counterpart_match');
    if (request.actorId && record.context.actorId === request.actorId) reasons.push('actor_match');
    if (request.channelId && record.context.channelId === request.channelId) reasons.push('channel_match');
    if (request.runId && record.context.runId === request.runId) reasons.push('run_match');
    if (request.modeId && record.context.modeId === request.modeId) reasons.push('mode_match');
    if (record.unresolved) reasons.push('unresolved');
    if (record.mode === 'RECEIPT') reasons.push('receipt_kind');
    if (record.mode === 'HELPER_RECALL') reasons.push('helper_kind');
    if (record.mode === 'NEGOTIATION') reasons.push('bluff_kind');
    if (record.mode === 'RIVALRY') reasons.push('relationship_pressure');
    return unique(reasons);
  }

  private scoreQuote(request: QuoteRecallResolverRequest, candidate: ConversationQuoteCandidate): number {
    const record = candidate.record;
    const profile = this.profile(request.mode);
    let score01 = 0;
    score01 += record.score01 * 0.28;
    score01 += record.salience01 * 0.18;
    score01 += record.strategicWeight01 * 0.16;
    score01 += record.emotionalWeight01 * 0.16;
    score01 += (profile.kindWeights[record.kind] ?? 0.2) * 0.12;
    score01 += recencyBoost(record.updatedAt, request.createdAt, this.config.recencyBoostWindowMs) * 0.1;
    if (request.counterpartId && record.counterpartId === request.counterpartId) score01 += this.config.counterpartBoost;
    if (request.actorId && record.actorId === request.actorId) score01 += this.config.actorBoost;
    if (request.channelId && record.evidence.some((item) => item.channelId === request.channelId)) score01 += this.config.channelBoost;
    if (record.unresolved) score01 += this.config.unresolvedBoost + profile.unresolvedBias;
    if (request.proofRequired) score01 += this.config.proofRequiredBoost;
    score01 -= record.usageCount * this.config.reusePenaltyPerUse;
    score01 += confidenceSignal(record.fragment.text) * 0.06;
    score01 += embarrassmentSignal(record.fragment.text) * 0.08;
    score01 += hostilitySignal(record.fragment.text) * 0.08;
    score01 += intimacySignal(record.fragment.text) * 0.06;
    return clamp01(score01);
  }

  private scoreCallback(request: QuoteRecallResolverRequest, candidate: ConversationCallbackCandidate): number {
    const record = candidate.record;
    const profile = this.profile(request.mode);
    let score01 = 0;
    score01 += candidate.score01 * 0.24;
    score01 += record.salience01 * 0.2;
    score01 += record.strategicWeight01 * 0.18;
    score01 += record.emotionalWeight01 * 0.18;
    score01 += (profile.callbackWeights[String(record.mode)] ?? 0.2) * 0.12;
    score01 += recencyBoost(record.updatedAt, request.createdAt, this.config.recencyBoostWindowMs) * 0.08;
    if (request.counterpartId && record.context.counterpartId === request.counterpartId) score01 += this.config.counterpartBoost;
    if (request.actorId && record.context.actorId === request.actorId) score01 += this.config.actorBoost;
    if (request.channelId && record.context.channelId === request.channelId) score01 += this.config.channelBoost;
    if (record.unresolved) score01 += this.config.unresolvedBoost + profile.unresolvedBias;
    if (request.proofRequired && record.anchor.proofChainId) score01 += this.config.proofRequiredBoost;
    score01 -= record.usageCount * this.config.reusePenaltyPerUse;
    score01 -= record.noveltyPenalty01 * 0.1;
    score01 += confidenceSignal(record.anchor.sourceText) * 0.05;
    score01 += embarrassmentSignal(record.anchor.sourceText) * 0.06;
    score01 += hostilitySignal(record.anchor.sourceText) * 0.07;
    score01 += intimacySignal(record.anchor.sourceText) * 0.05;
    return clamp01(score01);
  }

  private makeQuoteSelection(request: QuoteRecallResolverRequest, candidate: ConversationQuoteCandidate, score01: number): QuoteRecallSelection {
    const reasons = this.quoteReasonCodes(request, candidate.record);
    return {
      selectionId: `selection:${candidate.quoteId}:${request.requestId}`,
      quoteId: candidate.quoteId,
      memoryId: candidate.memoryId,
      mode: request.mode,
      surface: 'QUOTE',
      text: candidate.record.fragment.text,
      normalizedText: candidate.record.fragment.normalizedText,
      score01,
      reasonCodes: reasons,
      tags: candidate.record.tags,
      createdAt: request.createdAt,
      proofChainId: candidate.record.proof.proofChainId,
      quote: candidate.record,
    };
  }

  private makeCallbackSelection(request: QuoteRecallResolverRequest, candidate: ConversationCallbackCandidate, score01: number): QuoteRecallSelection {
    const reasons = this.callbackReasonCodes(request, candidate);
    return {
      selectionId: `selection:${candidate.callbackId}:${request.requestId}`,
      callbackId: candidate.callbackId,
      memoryId: candidate.memoryId,
      mode: request.mode,
      surface: 'CALLBACK',
      text: candidate.record.anchor.sourceText,
      normalizedText: candidate.record.anchor.normalizedSourceText,
      score01,
      reasonCodes: reasons,
      tags: candidate.record.tags,
      createdAt: request.createdAt,
      proofChainId: candidate.record.anchor.proofChainId,
      callback: candidate.record,
    };
  }

  private dedupeSelections(selections: readonly QuoteRecallSelection[]): readonly QuoteRecallSelection[] {
    const seen = new Set<string>();
    const deduped: QuoteRecallSelection[] = [];
    for (const selection of selections) {
      const key = `${selection.surface}:${selection.normalizedText}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(selection);
    }
    return deduped;
  }

  private buildAuditTrail(request: QuoteRecallResolverRequest, selections: readonly QuoteRecallSelection[], quoteCandidates: readonly ConversationQuoteCandidate[], callbackCandidates: readonly ConversationCallbackCandidate[]): readonly string[] {
    const lines: string[] = [];
    lines.push(`request=${request.requestId}`);
    lines.push(`mode=${request.mode}`);
    lines.push(`player=${request.playerId}`);
    lines.push(`quotes=${quoteCandidates.length}`);
    lines.push(`callbacks=${callbackCandidates.length}`);
    for (const selection of selections.slice(0, this.config.maxAuditTrailLines)) {
      lines.push(`${selection.selectionId}|${selection.surface}|${selection.score01.toFixed(3)}|${selection.reasonCodes.join(',')}|${selection.text.slice(0, 84)}`);
    }
    return lines.slice(0, this.config.maxAuditTrailLines);
  }

  private buildQuoteResolution(request: QuoteRecallResolverRequest, selections: readonly QuoteRecallSelection[]): ChatQuoteResolution | undefined {
    const winner = selections.find((selection) => selection.quoteId && selection.quote);
    if (!winner?.quote) return undefined;
    const winning = winner.quote;
    const evidence = winning.evidence[0];
    const resolution: ChatQuoteResolution = {
      requestId: request.requestId,
      createdAt: request.createdAt,
      selected: selections.filter((selection) => selection.quoteId).slice(0, request.maxSelections ?? this.config.defaultMaxSelections).map((selection): ChatQuoteSelection => ({
        quoteId: selection.quoteId!,
        score01: selection.score01,
        text: selection.text,
        normalizedText: selection.normalizedText,
        kind: selection.quote?.kind ?? 'STATEMENT',
        proof: selection.quote?.proof ?? winning.proof,
        evidence: selection.quote?.evidence ?? [evidence],
        tags: selection.tags,
      })),
      winningQuoteId: winning.quoteId,
      winningText: winning.fragment.text,
      winningProof: winning.proof,
      summary: winning.fragment.text,
    };
    return resolution;
  }

  private buildCallbackResolution(request: QuoteRecallResolverRequest, selections: readonly QuoteRecallSelection[]): ChatCallbackResolution | undefined {
    const winner = selections.find((selection) => selection.callbackId && selection.callback);
    if (!winner?.callback) return undefined;
    const record = winner.callback;
    return {
      callbackId: record.callbackId,
      createdAt: request.createdAt,
      outcome: 'SELECTED',
      summary: record.anchor.sourceText,
      mode: record.mode as ChatCallbackMode,
      evidenceIds: record.evidence.map((item) => item.evidenceId),
      proofChainId: record.anchor.proofChainId,
      tags: record.tags,
    };
  }

  public resolve(request: QuoteRecallResolverRequest): QuoteRecallResolverResponse {
    const quoteCandidates = request.includeQuotes === false ? [] : this.store.selectQuoteCandidates({
      requestId: request.requestId,
      createdAt: request.createdAt,
      playerId: request.playerId,
      actorId: request.actorId,
      counterpartId: request.counterpartId,
      runId: request.runId,
      modeId: request.modeId,
      channelId: request.channelId,
      limit: Math.max(24, request.maxSelections ?? this.config.defaultMaxSelections),
    });
    const callbackCandidates = request.includeCallbacks === false ? [] : this.store.selectCallbackCandidates({
      playerId: request.playerId,
      counterpartId: request.counterpartId,
      runId: request.runId,
      modeId: request.modeId,
      channelId: request.channelId,
      modes: request.allowedCallbackModes,
      limit: Math.max(24, request.maxSelections ?? this.config.defaultMaxSelections),
    });
    const quoteSelections = quoteCandidates.map((candidate) => this.makeQuoteSelection(request, candidate, this.scoreQuote(request, candidate)));
    const callbackSelections = callbackCandidates.map((candidate) => this.makeCallbackSelection(request, candidate, this.scoreCallback(request, candidate)));
    const merged = [...quoteSelections, ...callbackSelections].filter((selection) => selection.score01 >= this.config.minimumSelectionScore01).sort((left, right) => right.score01 - left.score01);
    const filtered = request.allowReuse ? merged : merged.filter((selection) => (selection.quote?.usageCount ?? selection.callback?.usageCount ?? 0) < 6);
    const selections = this.dedupeSelections(filtered).slice(0, request.maxSelections ?? this.config.defaultMaxSelections);
    const winningSelection = selections[0];
    const quoteResolution = this.buildQuoteResolution(request, selections);
    const callbackResolution = this.buildCallbackResolution(request, selections);
    return {
      requestId: request.requestId,
      createdAt: request.createdAt,
      mode: request.mode,
      playerId: request.playerId,
      selections,
      winningSelection,
      quoteResolution,
      callbackResolution,
      auditTrail: this.buildAuditTrail(request, selections, quoteCandidates, callbackCandidates),
    };
  }
}

export function buildQuoteRecallAuditSlice1(resolver: QuoteRecallResolver, request: QuoteRecallResolverRequest): readonly string[] {
  const response = resolver.resolve({ ...request, maxSelections: Math.min(request.maxSelections ?? 6, 6) });
  const lines: string[] = [];
  lines.push(`slice=1`);
  lines.push(`mode=${response.mode}`);
  lines.push(`selections=${response.selections.length}`);
  if (response.winningSelection) lines.push(`winner=${response.winningSelection.selectionId}`);
  for (const selection of response.selections.slice(0, 4)) {
    lines.push(`${selection.surface}|${selection.score01.toFixed(3)}|${selection.reasonCodes.join(',')}|${selection.text.slice(0, 56)}`);
  }
  return lines;
}

export function buildQuoteRecallAuditSlice2(resolver: QuoteRecallResolver, request: QuoteRecallResolverRequest): readonly string[] {
  const response = resolver.resolve({ ...request, maxSelections: Math.min(request.maxSelections ?? 6, 6) });
  const lines: string[] = [];
  lines.push(`slice=2`);
  lines.push(`mode=${response.mode}`);
  lines.push(`selections=${response.selections.length}`);
  if (response.winningSelection) lines.push(`winner=${response.winningSelection.selectionId}`);
  for (const selection of response.selections.slice(0, 4)) {
    lines.push(`${selection.surface}|${selection.score01.toFixed(3)}|${selection.reasonCodes.join(',')}|${selection.text.slice(0, 56)}`);
  }
  return lines;
}

export function buildQuoteRecallAuditSlice3(resolver: QuoteRecallResolver, request: QuoteRecallResolverRequest): readonly string[] {
  const response = resolver.resolve({ ...request, maxSelections: Math.min(request.maxSelections ?? 6, 6) });
  const lines: string[] = [];
  lines.push(`slice=3`);
  lines.push(`mode=${response.mode}`);
  lines.push(`selections=${response.selections.length}`);
  if (response.winningSelection) lines.push(`winner=${response.winningSelection.selectionId}`);
  for (const selection of response.selections.slice(0, 4)) {
    lines.push(`${selection.surface}|${selection.score01.toFixed(3)}|${selection.reasonCodes.join(',')}|${selection.text.slice(0, 56)}`);
  }
  return lines;
}

export function buildQuoteRecallAuditSlice4(resolver: QuoteRecallResolver, request: QuoteRecallResolverRequest): readonly string[] {
  const response = resolver.resolve({ ...request, maxSelections: Math.min(request.maxSelections ?? 6, 6) });
  const lines: string[] = [];
  lines.push(`slice=4`);
  lines.push(`mode=${response.mode}`);
  lines.push(`selections=${response.selections.length}`);
  if (response.winningSelection) lines.push(`winner=${response.winningSelection.selectionId}`);
  for (const selection of response.selections.slice(0, 4)) {
    lines.push(`${selection.surface}|${selection.score01.toFixed(3)}|${selection.reasonCodes.join(',')}|${selection.text.slice(0, 56)}`);
  }
  return lines;
}

export function buildQuoteRecallAuditSlice5(resolver: QuoteRecallResolver, request: QuoteRecallResolverRequest): readonly string[] {
  const response = resolver.resolve({ ...request, maxSelections: Math.min(request.maxSelections ?? 6, 6) });
  const lines: string[] = [];
  lines.push(`slice=5`);
  lines.push(`mode=${response.mode}`);
  lines.push(`selections=${response.selections.length}`);
  if (response.winningSelection) lines.push(`winner=${response.winningSelection.selectionId}`);
  for (const selection of response.selections.slice(0, 4)) {
    lines.push(`${selection.surface}|${selection.score01.toFixed(3)}|${selection.reasonCodes.join(',')}|${selection.text.slice(0, 56)}`);
  }
  return lines;
}

export function buildQuoteRecallAuditSlice6(resolver: QuoteRecallResolver, request: QuoteRecallResolverRequest): readonly string[] {
  const response = resolver.resolve({ ...request, maxSelections: Math.min(request.maxSelections ?? 6, 6) });
  const lines: string[] = [];
  lines.push(`slice=6`);
  lines.push(`mode=${response.mode}`);
  lines.push(`selections=${response.selections.length}`);
  if (response.winningSelection) lines.push(`winner=${response.winningSelection.selectionId}`);
  for (const selection of response.selections.slice(0, 4)) {
    lines.push(`${selection.surface}|${selection.score01.toFixed(3)}|${selection.reasonCodes.join(',')}|${selection.text.slice(0, 56)}`);
  }
  return lines;
}

export function buildQuoteRecallAuditSlice7(resolver: QuoteRecallResolver, request: QuoteRecallResolverRequest): readonly string[] {
  const response = resolver.resolve({ ...request, maxSelections: Math.min(request.maxSelections ?? 6, 6) });
  const lines: string[] = [];
  lines.push(`slice=7`);
  lines.push(`mode=${response.mode}`);
  lines.push(`selections=${response.selections.length}`);
  if (response.winningSelection) lines.push(`winner=${response.winningSelection.selectionId}`);
  for (const selection of response.selections.slice(0, 4)) {
    lines.push(`${selection.surface}|${selection.score01.toFixed(3)}|${selection.reasonCodes.join(',')}|${selection.text.slice(0, 56)}`);
  }
  return lines;
}

export function buildQuoteRecallAuditSlice8(resolver: QuoteRecallResolver, request: QuoteRecallResolverRequest): readonly string[] {
  const response = resolver.resolve({ ...request, maxSelections: Math.min(request.maxSelections ?? 6, 6) });
  const lines: string[] = [];
  lines.push(`slice=8`);
  lines.push(`mode=${response.mode}`);
  lines.push(`selections=${response.selections.length}`);
  if (response.winningSelection) lines.push(`winner=${response.winningSelection.selectionId}`);
  for (const selection of response.selections.slice(0, 4)) {
    lines.push(`${selection.surface}|${selection.score01.toFixed(3)}|${selection.reasonCodes.join(',')}|${selection.text.slice(0, 56)}`);
  }
  return lines;
}

export function buildQuoteRecallAuditSlice9(resolver: QuoteRecallResolver, request: QuoteRecallResolverRequest): readonly string[] {
  const response = resolver.resolve({ ...request, maxSelections: Math.min(request.maxSelections ?? 6, 6) });
  const lines: string[] = [];
  lines.push(`slice=9`);
  lines.push(`mode=${response.mode}`);
  lines.push(`selections=${response.selections.length}`);
  if (response.winningSelection) lines.push(`winner=${response.winningSelection.selectionId}`);
  for (const selection of response.selections.slice(0, 4)) {
    lines.push(`${selection.surface}|${selection.score01.toFixed(3)}|${selection.reasonCodes.join(',')}|${selection.text.slice(0, 56)}`);
  }
  return lines;
}

export function buildQuoteRecallAuditSlice10(resolver: QuoteRecallResolver, request: QuoteRecallResolverRequest): readonly string[] {
  const response = resolver.resolve({ ...request, maxSelections: Math.min(request.maxSelections ?? 6, 6) });
  const lines: string[] = [];
  lines.push(`slice=10`);
  lines.push(`mode=${response.mode}`);
  lines.push(`selections=${response.selections.length}`);
  if (response.winningSelection) lines.push(`winner=${response.winningSelection.selectionId}`);
  for (const selection of response.selections.slice(0, 4)) {
    lines.push(`${selection.surface}|${selection.score01.toFixed(3)}|${selection.reasonCodes.join(',')}|${selection.text.slice(0, 56)}`);
  }
  return lines;
}

export function buildQuoteRecallAuditSlice11(resolver: QuoteRecallResolver, request: QuoteRecallResolverRequest): readonly string[] {
  const response = resolver.resolve({ ...request, maxSelections: Math.min(request.maxSelections ?? 6, 6) });
  const lines: string[] = [];
  lines.push(`slice=11`);
  lines.push(`mode=${response.mode}`);
  lines.push(`selections=${response.selections.length}`);
  if (response.winningSelection) lines.push(`winner=${response.winningSelection.selectionId}`);
  for (const selection of response.selections.slice(0, 4)) {
    lines.push(`${selection.surface}|${selection.score01.toFixed(3)}|${selection.reasonCodes.join(',')}|${selection.text.slice(0, 56)}`);
  }
  return lines;
}

export function buildQuoteRecallAuditSlice12(resolver: QuoteRecallResolver, request: QuoteRecallResolverRequest): readonly string[] {
  const response = resolver.resolve({ ...request, maxSelections: Math.min(request.maxSelections ?? 6, 6) });
  const lines: string[] = [];
  lines.push(`slice=12`);
  lines.push(`mode=${response.mode}`);
  lines.push(`selections=${response.selections.length}`);
  if (response.winningSelection) lines.push(`winner=${response.winningSelection.selectionId}`);
  for (const selection of response.selections.slice(0, 4)) {
    lines.push(`${selection.surface}|${selection.score01.toFixed(3)}|${selection.reasonCodes.join(',')}|${selection.text.slice(0, 56)}`);
  }
  return lines;
}

export function buildQuoteRecallAuditSlice13(resolver: QuoteRecallResolver, request: QuoteRecallResolverRequest): readonly string[] {
  const response = resolver.resolve({ ...request, maxSelections: Math.min(request.maxSelections ?? 6, 6) });
  const lines: string[] = [];
  lines.push(`slice=13`);
  lines.push(`mode=${response.mode}`);
  lines.push(`selections=${response.selections.length}`);
  if (response.winningSelection) lines.push(`winner=${response.winningSelection.selectionId}`);
  for (const selection of response.selections.slice(0, 4)) {
    lines.push(`${selection.surface}|${selection.score01.toFixed(3)}|${selection.reasonCodes.join(',')}|${selection.text.slice(0, 56)}`);
  }
  return lines;
}

export function buildQuoteRecallAuditSlice14(resolver: QuoteRecallResolver, request: QuoteRecallResolverRequest): readonly string[] {
  const response = resolver.resolve({ ...request, maxSelections: Math.min(request.maxSelections ?? 6, 6) });
  const lines: string[] = [];
  lines.push(`slice=14`);
  lines.push(`mode=${response.mode}`);
  lines.push(`selections=${response.selections.length}`);
  if (response.winningSelection) lines.push(`winner=${response.winningSelection.selectionId}`);
  for (const selection of response.selections.slice(0, 4)) {
    lines.push(`${selection.surface}|${selection.score01.toFixed(3)}|${selection.reasonCodes.join(',')}|${selection.text.slice(0, 56)}`);
  }
  return lines;
}

export function buildQuoteRecallAuditSlice15(resolver: QuoteRecallResolver, request: QuoteRecallResolverRequest): readonly string[] {
  const response = resolver.resolve({ ...request, maxSelections: Math.min(request.maxSelections ?? 6, 6) });
  const lines: string[] = [];
  lines.push(`slice=15`);
  lines.push(`mode=${response.mode}`);
  lines.push(`selections=${response.selections.length}`);
  if (response.winningSelection) lines.push(`winner=${response.winningSelection.selectionId}`);
  for (const selection of response.selections.slice(0, 4)) {
    lines.push(`${selection.surface}|${selection.score01.toFixed(3)}|${selection.reasonCodes.join(',')}|${selection.text.slice(0, 56)}`);
  }
  return lines;
}

export function buildQuoteRecallAuditSlice16(resolver: QuoteRecallResolver, request: QuoteRecallResolverRequest): readonly string[] {
  const response = resolver.resolve({ ...request, maxSelections: Math.min(request.maxSelections ?? 6, 6) });
  const lines: string[] = [];
  lines.push(`slice=16`);
  lines.push(`mode=${response.mode}`);
  lines.push(`selections=${response.selections.length}`);
  if (response.winningSelection) lines.push(`winner=${response.winningSelection.selectionId}`);
  for (const selection of response.selections.slice(0, 4)) {
    lines.push(`${selection.surface}|${selection.score01.toFixed(3)}|${selection.reasonCodes.join(',')}|${selection.text.slice(0, 56)}`);
  }
  return lines;
}

export function buildQuoteRecallAuditSlice17(resolver: QuoteRecallResolver, request: QuoteRecallResolverRequest): readonly string[] {
  const response = resolver.resolve({ ...request, maxSelections: Math.min(request.maxSelections ?? 6, 6) });
  const lines: string[] = [];
  lines.push(`slice=17`);
  lines.push(`mode=${response.mode}`);
  lines.push(`selections=${response.selections.length}`);
  if (response.winningSelection) lines.push(`winner=${response.winningSelection.selectionId}`);
  for (const selection of response.selections.slice(0, 4)) {
    lines.push(`${selection.surface}|${selection.score01.toFixed(3)}|${selection.reasonCodes.join(',')}|${selection.text.slice(0, 56)}`);
  }
  return lines;
}

export function buildQuoteRecallAuditSlice18(resolver: QuoteRecallResolver, request: QuoteRecallResolverRequest): readonly string[] {
  const response = resolver.resolve({ ...request, maxSelections: Math.min(request.maxSelections ?? 6, 6) });
  const lines: string[] = [];
  lines.push(`slice=18`);
  lines.push(`mode=${response.mode}`);
  lines.push(`selections=${response.selections.length}`);
  if (response.winningSelection) lines.push(`winner=${response.winningSelection.selectionId}`);
  for (const selection of response.selections.slice(0, 4)) {
    lines.push(`${selection.surface}|${selection.score01.toFixed(3)}|${selection.reasonCodes.join(',')}|${selection.text.slice(0, 56)}`);
  }
  return lines;
}

export function buildQuoteRecallAuditSlice19(resolver: QuoteRecallResolver, request: QuoteRecallResolverRequest): readonly string[] {
  const response = resolver.resolve({ ...request, maxSelections: Math.min(request.maxSelections ?? 6, 6) });
  const lines: string[] = [];
  lines.push(`slice=19`);
  lines.push(`mode=${response.mode}`);
  lines.push(`selections=${response.selections.length}`);
  if (response.winningSelection) lines.push(`winner=${response.winningSelection.selectionId}`);
  for (const selection of response.selections.slice(0, 4)) {
    lines.push(`${selection.surface}|${selection.score01.toFixed(3)}|${selection.reasonCodes.join(',')}|${selection.text.slice(0, 56)}`);
  }
  return lines;
}

export function buildQuoteRecallAuditSlice20(resolver: QuoteRecallResolver, request: QuoteRecallResolverRequest): readonly string[] {
  const response = resolver.resolve({ ...request, maxSelections: Math.min(request.maxSelections ?? 6, 6) });
  const lines: string[] = [];
  lines.push(`slice=20`);
  lines.push(`mode=${response.mode}`);
  lines.push(`selections=${response.selections.length}`);
  if (response.winningSelection) lines.push(`winner=${response.winningSelection.selectionId}`);
  for (const selection of response.selections.slice(0, 4)) {
    lines.push(`${selection.surface}|${selection.score01.toFixed(3)}|${selection.reasonCodes.join(',')}|${selection.text.slice(0, 56)}`);
  }
  return lines;
}

export function buildQuoteRecallAuditSlice21(resolver: QuoteRecallResolver, request: QuoteRecallResolverRequest): readonly string[] {
  const response = resolver.resolve({ ...request, maxSelections: Math.min(request.maxSelections ?? 6, 6) });
  const lines: string[] = [];
  lines.push(`slice=21`);
  lines.push(`mode=${response.mode}`);
  lines.push(`selections=${response.selections.length}`);
  if (response.winningSelection) lines.push(`winner=${response.winningSelection.selectionId}`);
  for (const selection of response.selections.slice(0, 4)) {
    lines.push(`${selection.surface}|${selection.score01.toFixed(3)}|${selection.reasonCodes.join(',')}|${selection.text.slice(0, 56)}`);
  }
  return lines;
}

export function buildQuoteRecallAuditSlice22(resolver: QuoteRecallResolver, request: QuoteRecallResolverRequest): readonly string[] {
  const response = resolver.resolve({ ...request, maxSelections: Math.min(request.maxSelections ?? 6, 6) });
  const lines: string[] = [];
  lines.push(`slice=22`);
  lines.push(`mode=${response.mode}`);
  lines.push(`selections=${response.selections.length}`);
  if (response.winningSelection) lines.push(`winner=${response.winningSelection.selectionId}`);
  for (const selection of response.selections.slice(0, 4)) {
    lines.push(`${selection.surface}|${selection.score01.toFixed(3)}|${selection.reasonCodes.join(',')}|${selection.text.slice(0, 56)}`);
  }
  return lines;
}

export function buildQuoteRecallAuditSlice23(resolver: QuoteRecallResolver, request: QuoteRecallResolverRequest): readonly string[] {
  const response = resolver.resolve({ ...request, maxSelections: Math.min(request.maxSelections ?? 6, 6) });
  const lines: string[] = [];
  lines.push(`slice=23`);
  lines.push(`mode=${response.mode}`);
  lines.push(`selections=${response.selections.length}`);
  if (response.winningSelection) lines.push(`winner=${response.winningSelection.selectionId}`);
  for (const selection of response.selections.slice(0, 4)) {
    lines.push(`${selection.surface}|${selection.score01.toFixed(3)}|${selection.reasonCodes.join(',')}|${selection.text.slice(0, 56)}`);
  }
  return lines;
}

export function buildQuoteRecallAuditSlice24(resolver: QuoteRecallResolver, request: QuoteRecallResolverRequest): readonly string[] {
  const response = resolver.resolve({ ...request, maxSelections: Math.min(request.maxSelections ?? 6, 6) });
  const lines: string[] = [];
  lines.push(`slice=24`);
  lines.push(`mode=${response.mode}`);
  lines.push(`selections=${response.selections.length}`);
  if (response.winningSelection) lines.push(`winner=${response.winningSelection.selectionId}`);
  for (const selection of response.selections.slice(0, 4)) {
    lines.push(`${selection.surface}|${selection.score01.toFixed(3)}|${selection.reasonCodes.join(',')}|${selection.text.slice(0, 56)}`);
  }
  return lines;
}

export function buildQuoteRecallAuditSlice25(resolver: QuoteRecallResolver, request: QuoteRecallResolverRequest): readonly string[] {
  const response = resolver.resolve({ ...request, maxSelections: Math.min(request.maxSelections ?? 6, 6) });
  const lines: string[] = [];
  lines.push(`slice=25`);
  lines.push(`mode=${response.mode}`);
  lines.push(`selections=${response.selections.length}`);
  if (response.winningSelection) lines.push(`winner=${response.winningSelection.selectionId}`);
  for (const selection of response.selections.slice(0, 4)) {
    lines.push(`${selection.surface}|${selection.score01.toFixed(3)}|${selection.reasonCodes.join(',')}|${selection.text.slice(0, 56)}`);
  }
  return lines;
}
