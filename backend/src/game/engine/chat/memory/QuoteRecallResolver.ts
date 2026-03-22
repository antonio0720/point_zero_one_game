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


// ============================================================================
// MARK: Quote chain types
// ============================================================================

export interface QuoteChain {
  readonly chainId: string;
  readonly playerId: string;
  readonly counterpartId: string;
  readonly quoteIds: readonly string[];
  readonly currentDepth: number;
  readonly maxDepth: number;
  readonly startedAt: number;
  readonly lastAdvancedAt: number;
  readonly exhausted: boolean;
  readonly escalating: boolean;
}

// ============================================================================
// MARK: Quote mutation strategy
// ============================================================================

export type QuoteMutationStrategy = 'VERBATIM' | 'PARAPHRASE' | 'TRUNCATE' | 'WEAPONIZE' | 'SOFT_REFERENCE';

// ============================================================================
// MARK: Recall fusion types
// ============================================================================

export interface RecallFusionCandidate {
  readonly fusionId: string;
  readonly quoteSelection: QuoteRecallSelection;
  readonly callbackSelection: QuoteRecallSelection;
  readonly fusedScore01: number;
  readonly narrativeTemplate: string;
}

// ============================================================================
// MARK: Mode recall profile
// ============================================================================

export interface ModeRecallProfile {
  readonly modeId: string;
  readonly preferredMutation: QuoteMutationStrategy;
  readonly timingMultiplier: number;
  readonly isolationEmphasis: boolean;
  readonly dealEmphasis: boolean;
  readonly trustEmphasis: boolean;
  readonly fragmentary: boolean;
}



// ============================================================================
// MARK: Recall history types
// ============================================================================

export interface RecallHistoryEntry {
  readonly timestamp: number;
  readonly selectionId: string;
  readonly surface: string;
  readonly score01: number;
  readonly text: string;
  readonly mutationStrategy: QuoteMutationStrategy;
  readonly fatigueAtRecall: number;
}

export interface RecallEffectivenessEntry {
  readonly timestamp: number;
  readonly selectionId: string;
  readonly effective: boolean;
}

// ============================================================================
// MARK: Recall diagnostic report type
// ============================================================================

export interface RecallDiagnosticReport {
  readonly playerId: string;
  readonly counterpartId: string;
  readonly totalSelections: number;
  readonly winningSelectionId?: string;
  readonly winningScore01: number;
  readonly winningText: string;
  readonly totalHistoricalRecalls: number;
  readonly effectivenessRate01: number;
  readonly activeChainId?: string;
  readonly chainDepth: number;
  readonly chainExhausted: boolean;
  readonly avgSelectionScore01: number;
  readonly surfaceDistribution: Readonly<Record<string, number>>;
}


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


  // ==========================================================================
  // MARK: Conversational quote chaining
  // ==========================================================================

  private readonly _activeChains = new Map<string, QuoteChain>();

  /** Detect if a recalled quote should trigger a follow-up chain. */
  public detectActiveChain(playerId: string, counterpartId: string): QuoteChain | undefined {
    return this._activeChains.get(`${playerId}:${counterpartId}`);
  }

  /** Start a new quote chain when a receipt is thrown and the player responds. */
  public startChain(playerId: string, counterpartId: string, initialQuoteId: string, maxDepth = 5): QuoteChain {
    const chain: QuoteChain = {
      chainId: `chain:${playerId}:${counterpartId}:${Date.now()}`,
      playerId, counterpartId, quoteIds: [initialQuoteId],
      currentDepth: 1, maxDepth, startedAt: Date.now(), lastAdvancedAt: Date.now(),
      exhausted: false, escalating: true,
    };
    this._activeChains.set(`${playerId}:${counterpartId}`, chain);
    return chain;
  }

  /** Advance an existing chain with the next receipt. */
  public advanceChain(playerId: string, counterpartId: string, nextQuoteId: string): QuoteChain | undefined {
    const key = `${playerId}:${counterpartId}`;
    const chain = this._activeChains.get(key);
    if (!chain || chain.exhausted) return undefined;
    const next: QuoteChain = {
      ...chain,
      quoteIds: [...chain.quoteIds, nextQuoteId],
      currentDepth: chain.currentDepth + 1,
      lastAdvancedAt: Date.now(),
      exhausted: chain.currentDepth + 1 >= chain.maxDepth,
    };
    this._activeChains.set(key, next);
    return next;
  }

  /** Check if a chain has been exhausted (rival ran out of receipts). */
  public isChainExhausted(playerId: string, counterpartId: string): boolean {
    const chain = this._activeChains.get(`${playerId}:${counterpartId}`);
    return chain?.exhausted ?? true;
  }

  // ==========================================================================
  // MARK: Dramatic timing for recalls
  // ==========================================================================

  /** Compute the optimal delay before delivering a recalled quote for maximum dramatic impact. */
  public computeOptimalDelay(selection: QuoteRecallSelection, audienceHeat01: number, pressureTier?: string): number {
    let baseDelay = 800;
    if (selection.surface === 'RIVALRY') baseDelay = 2200;
    if (selection.surface === 'DEAL_ROOM') baseDelay = 3400;
    if (selection.surface === 'HELPER') baseDelay = 1200;
    const heatBonus = audienceHeat01 * 1500;
    const pressureBonus = pressureTier === 'CRITICAL' ? 1200 : pressureTier === 'HIGH' ? 800 : 0;
    const scoreBonus = selection.score01 * 1000;
    return Math.round(baseDelay + heatBonus + pressureBonus + scoreBonus);
  }

  /** Should this recall be held for dramatic impact instead of fired immediately? */
  public shouldHoldForDramaticImpact(selection: QuoteRecallSelection, audienceHeat01: number): boolean {
    return selection.score01 >= 0.65 && audienceHeat01 >= 0.45 && selection.surface === 'RIVALRY';
  }

  // ==========================================================================
  // MARK: Quote mutation strategies
  // ==========================================================================

  /** Select how a recalled quote should be presented (verbatim, paraphrased, truncated, etc). */
  public selectMutationStrategy(selection: QuoteRecallSelection, counterpartKind: string): QuoteMutationStrategy {
    if (counterpartKind === 'HELPER') return 'SOFT_REFERENCE';
    if (selection.score01 >= 0.8 && selection.surface === 'RIVALRY') return 'VERBATIM';
    if (selection.surface === 'DEAL_ROOM') return 'WEAPONIZE';
    if (selection.text.length > 120) return 'TRUNCATE';
    if (selection.usageCount >= 3) return 'PARAPHRASE';
    return 'VERBATIM';
  }

  // ==========================================================================
  // MARK: Multi-source recall fusion
  // ==========================================================================

  /** Attempt to fuse multiple selections into a composite receipt. */
  public fuseRecallSources(selections: readonly QuoteRecallSelection[]): RecallFusionCandidate | undefined {
    if (selections.length < 2) return undefined;
    const quote = selections.find((s) => s.surface === 'QUOTE');
    const callback = selections.find((s) => s.surface === 'CALLBACK');
    if (!quote || !callback) return undefined;
    const fusedScore = (quote.score01 + callback.score01) / 2 * 1.15;
    return {
      fusionId: `fusion:${quote.selectionId}:${callback.selectionId}`,
      quoteSelection: quote,
      callbackSelection: callback,
      fusedScore01: Math.min(1, fusedScore),
      narrativeTemplate: `Remember when ${quote.text.slice(0, 60)}? That was right before ${callback.text.slice(0, 60)}.`,
    };
  }

  // ==========================================================================
  // MARK: Recall fatigue enforcement
  // ==========================================================================

  /** Compute diminishing returns for a quote that has been recalled multiple times. */
  public computeRecallFatigue(selection: QuoteRecallSelection): number {
    const uses = selection.usageCount;
    if (uses <= 1) return 0;
    if (uses <= 3) return 0.15 * uses;
    if (uses <= 6) return 0.45 + (uses - 3) * 0.12;
    return Math.min(0.95, 0.81 + (uses - 6) * 0.05);
  }

  /** Should this quote be retired from active recall? */
  public shouldRetireQuote(selection: QuoteRecallSelection): boolean {
    return this.computeRecallFatigue(selection) >= 0.85;
  }

  // ==========================================================================
  // MARK: Mode-specific recall profiles
  // ==========================================================================

  private static readonly MODE_RECALL_PROFILES: Readonly<Record<string, ModeRecallProfile>> = Object.freeze({
    'GO_ALONE': { modeId: 'GO_ALONE', preferredMutation: 'VERBATIM' as const, timingMultiplier: 1.0, isolationEmphasis: true, dealEmphasis: false, trustEmphasis: false, fragmentary: false },
    'HEAD_TO_HEAD': { modeId: 'HEAD_TO_HEAD', preferredMutation: 'WEAPONIZE' as const, timingMultiplier: 0.7, isolationEmphasis: false, dealEmphasis: true, trustEmphasis: false, fragmentary: false },
    'TEAM_UP': { modeId: 'TEAM_UP', preferredMutation: 'VERBATIM' as const, timingMultiplier: 1.2, isolationEmphasis: false, dealEmphasis: false, trustEmphasis: true, fragmentary: false },
    'CHASE_A_LEGEND': { modeId: 'CHASE_A_LEGEND', preferredMutation: 'TRUNCATE' as const, timingMultiplier: 1.8, isolationEmphasis: false, dealEmphasis: false, trustEmphasis: false, fragmentary: true },
  });

  /** Get mode-specific recall profile. */
  public getModeRecallProfile(modeId: string | undefined): ModeRecallProfile {
    return QuoteRecallResolver.MODE_RECALL_PROFILES[modeId ?? ''] ?? QuoteRecallResolver.MODE_RECALL_PROFILES['GO_ALONE']!;
  }




  // ==========================================================================
  // MARK: Per-counterpart recall history
  // ==========================================================================

  private readonly _recallHistory = new Map<string, RecallHistoryEntry[]>();

  /** Record a recall event for historical tracking. */
  public recordRecall(playerId: string, counterpartId: string, selection: QuoteRecallSelection, at: number): void {
    const key = `${playerId}:${counterpartId}`;
    const entries = this._recallHistory.get(key) ?? [];
    entries.push({
      timestamp: at,
      selectionId: selection.selectionId,
      surface: selection.surface,
      score01: selection.score01,
      text: selection.text.slice(0, 80),
      mutationStrategy: this.selectMutationStrategy(selection, 'HATER'),
      fatigueAtRecall: this.computeRecallFatigue(selection),
    });
    if (entries.length > 96) entries.splice(0, entries.length - 96);
    this._recallHistory.set(key, entries);
  }

  /** Get recall history for a counterpart. */
  public getRecallHistory(playerId: string, counterpartId: string): readonly RecallHistoryEntry[] {
    return Object.freeze(this._recallHistory.get(`${playerId}:${counterpartId}`) ?? []);
  }

  /** Count how many times any quote has been recalled against this counterpart. */
  public totalRecallCount(playerId: string, counterpartId: string): number {
    return (this._recallHistory.get(`${playerId}:${counterpartId}`) ?? []).length;
  }

  // ==========================================================================
  // MARK: Recall effectiveness tracking
  // ==========================================================================

  private readonly _recallEffectiveness = new Map<string, RecallEffectivenessEntry[]>();

  /** Record whether a recalled quote had the desired effect. */
  public recordRecallEffectiveness(playerId: string, counterpartId: string, selectionId: string, effective: boolean, at: number): void {
    const key = `${playerId}:${counterpartId}`;
    const entries = this._recallEffectiveness.get(key) ?? [];
    entries.push({ timestamp: at, selectionId, effective });
    if (entries.length > 64) entries.splice(0, entries.length - 64);
    this._recallEffectiveness.set(key, entries);
  }

  /** Compute the historical effectiveness rate of recalls against a counterpart. */
  public recallEffectivenessRate(playerId: string, counterpartId: string): number {
    const entries = this._recallEffectiveness.get(`${playerId}:${counterpartId}`) ?? [];
    if (entries.length === 0) return 0.5;
    const effective = entries.filter((e) => e.effective).length;
    return effective / entries.length;
  }

  // ==========================================================================
  // MARK: Recall budget management
  // ==========================================================================

  /** Compute how many recall slots remain for a given context window. */
  public remainingRecallBudget(playerId: string, counterpartId: string, maxPerWindow: number, windowMs: number, now: number): number {
    const history = this.getRecallHistory(playerId, counterpartId);
    const recentCount = history.filter((h) => now - h.timestamp <= windowMs).length;
    return Math.max(0, maxPerWindow - recentCount);
  }

  /** Check if recall budget is exhausted for the current window. */
  public isRecallBudgetExhausted(playerId: string, counterpartId: string, maxPerWindow: number, windowMs: number, now: number): boolean {
    return this.remainingRecallBudget(playerId, counterpartId, maxPerWindow, windowMs, now) <= 0;
  }

  // ==========================================================================
  // MARK: Cross-run recall threading
  // ==========================================================================

  /** Resolve with awareness of cross-run bridged quotes. */
  public resolveWithBridgeAwareness(request: QuoteRecallResolverRequest, bridgedQuoteIds: readonly string[]): QuoteRecallResolverResponse {
    const base = this.resolve(request);
    if (bridgedQuoteIds.length === 0) return base;
    const boosted = base.selections.map((s) => {
      if (bridgedQuoteIds.includes(s.quote?.quoteId ?? '') || bridgedQuoteIds.includes(s.callback?.callbackId ?? '')) {
        return { ...s, score01: Math.min(1, s.score01 + 0.15), reasonCodes: [...s.reasonCodes, 'cross_run_bridge_boost'] };
      }
      return s;
    }).sort((a, b) => b.score01 - a.score01);
    return { ...base, selections: boosted, winningSelection: boosted[0] };
  }

  // ==========================================================================
  // MARK: Recall diagnostic system
  // ==========================================================================

  /** Generate a comprehensive diagnostic for the recall state of a player-counterpart pair. */
  public generateRecallDiagnostic(playerId: string, counterpartId: string, request: QuoteRecallResolverRequest): RecallDiagnosticReport {
    const response = this.resolve(request);
    const history = this.getRecallHistory(playerId, counterpartId);
    const effectivenessRate = this.recallEffectivenessRate(playerId, counterpartId);
    const chain = this.detectActiveChain(playerId, counterpartId);
    const topSelection = response.winningSelection;

    return Object.freeze({
      playerId, counterpartId,
      totalSelections: response.selections.length,
      winningSelectionId: topSelection?.selectionId,
      winningScore01: topSelection?.score01 ?? 0,
      winningText: topSelection?.text.slice(0, 80) ?? '',
      totalHistoricalRecalls: history.length,
      effectivenessRate01: effectivenessRate,
      activeChainId: chain?.chainId,
      chainDepth: chain?.currentDepth ?? 0,
      chainExhausted: chain?.exhausted ?? true,
      avgSelectionScore01: response.selections.length > 0
        ? response.selections.reduce((s, sel) => s + sel.score01, 0) / response.selections.length : 0,
      surfaceDistribution: Object.freeze(
        response.selections.reduce((acc, s) => {
          acc[s.surface] = (acc[s.surface] ?? 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      ),
    });
  }

  /** Build diagnostic lines for logging. */
  public buildDiagnosticLines(playerId: string, counterpartId: string, request: QuoteRecallResolverRequest): readonly string[] {
    const report = this.generateRecallDiagnostic(playerId, counterpartId, request);
    const lines: string[] = [];
    lines.push(`recall_diagnostic|player=${report.playerId}|counterpart=${report.counterpartId}`);
    lines.push(`selections=${report.totalSelections}|winner=${report.winningSelectionId ?? 'none'}|winScore=${report.winningScore01.toFixed(3)}`);
    lines.push(`history=${report.totalHistoricalRecalls}|effectiveness=${report.effectivenessRate01.toFixed(3)}`);
    lines.push(`chain=${report.activeChainId ?? 'none'}|depth=${report.chainDepth}|exhausted=${report.chainExhausted}`);
    lines.push(`avgScore=${report.avgSelectionScore01.toFixed(3)}`);
    if (report.winningText) lines.push(`winText="${report.winningText}"`);
    return lines;
  }


}



// ============================================================================
// MARK: Real audit slices — 25 unique diagnostic tools
// ============================================================================

/** Slice 1: Recall mode distribution — what modes are requesting recalls. */
export function buildQuoteRecallAuditSlice1(resolver: QuoteRecallResolver, request: QuoteRecallResolverRequest): readonly string[] {
  const response = resolver.resolve({ ...request, maxSelections: 8 });
  const lines: string[] = ['slice=1|recall_mode_distribution'];
  lines.push(`mode=${response.mode}|total_selections=${response.selections.length}`);
  const bySurface = new Map<string, number>();
  for (const s of response.selections) bySurface.set(s.surface, (bySurface.get(s.surface) ?? 0) + 1);
  for (const [surface, count] of bySurface) lines.push(`${surface}=${count}`);
  return lines;
}

/** Slice 2: Score distribution of selections. */
export function buildQuoteRecallAuditSlice2(resolver: QuoteRecallResolver, request: QuoteRecallResolverRequest): readonly string[] {
  const response = resolver.resolve({ ...request, maxSelections: 8 });
  const lines: string[] = ['slice=2|score_distribution'];
  for (const s of response.selections) {
    lines.push(`${s.selectionId}|score=${s.score01.toFixed(3)}|surface=${s.surface}|reasons=${s.reasonCodes.slice(0, 4).join(',')}`);
  }
  return lines;
}

/** Slice 3: Quote chain status. */
export function buildQuoteRecallAuditSlice3(resolver: QuoteRecallResolver, request: QuoteRecallResolverRequest): readonly string[] {
  const lines: string[] = ['slice=3|chain_status'];
  const chain = resolver.detectActiveChain(request.playerId, request.counterpartId ?? '');
  if (chain) {
    lines.push(`chain=${chain.chainId}|depth=${chain.currentDepth}/${chain.maxDepth}|exhausted=${chain.exhausted}|quotes=${chain.quoteIds.length}`);
  } else {
    lines.push('no_active_chain');
  }
  return lines;
}

/** Slice 4: Recall fatigue analysis. */
export function buildQuoteRecallAuditSlice4(resolver: QuoteRecallResolver, request: QuoteRecallResolverRequest): readonly string[] {
  const response = resolver.resolve({ ...request, maxSelections: 12 });
  const lines: string[] = ['slice=4|fatigue_analysis'];
  for (const s of response.selections.slice(0, 8)) {
    const fatigue = resolver.computeRecallFatigue(s);
    const shouldRetire = resolver.shouldRetireQuote(s);
    lines.push(`${s.selectionId}|uses=${s.usageCount}|fatigue=${fatigue.toFixed(3)}|retire=${shouldRetire}|"${s.text.slice(0, 40)}"`);
  }
  return lines;
}

/** Slice 5: Mutation strategy recommendations. */
export function buildQuoteRecallAuditSlice5(resolver: QuoteRecallResolver, request: QuoteRecallResolverRequest): readonly string[] {
  const response = resolver.resolve({ ...request, maxSelections: 8 });
  const lines: string[] = ['slice=5|mutation_strategy'];
  for (const s of response.selections.slice(0, 6)) {
    const strategy = resolver.selectMutationStrategy(s, 'HATER');
    lines.push(`${s.selectionId}|strategy=${strategy}|score=${s.score01.toFixed(3)}|"${s.text.slice(0, 40)}"`);
  }
  return lines;
}

/** Slice 6: Dramatic timing recommendations. */
export function buildQuoteRecallAuditSlice6(resolver: QuoteRecallResolver, request: QuoteRecallResolverRequest): readonly string[] {
  const response = resolver.resolve({ ...request, maxSelections: 6 });
  const lines: string[] = ['slice=6|dramatic_timing'];
  for (const s of response.selections.slice(0, 4)) {
    const delay = resolver.computeOptimalDelay(s, 0.5, 'MEDIUM');
    const hold = resolver.shouldHoldForDramaticImpact(s, 0.5);
    lines.push(`${s.selectionId}|delay=${delay}ms|hold=${hold}|score=${s.score01.toFixed(3)}`);
  }
  return lines;
}

/** Slice 7: Fusion candidates. */
export function buildQuoteRecallAuditSlice7(resolver: QuoteRecallResolver, request: QuoteRecallResolverRequest): readonly string[] {
  const response = resolver.resolve({ ...request, maxSelections: 8 });
  const lines: string[] = ['slice=7|fusion_candidates'];
  const fusion = resolver.fuseRecallSources(response.selections);
  if (fusion) {
    lines.push(`fusion=${fusion.fusionId}|score=${fusion.fusedScore01.toFixed(3)}`);
    lines.push(`template="${fusion.narrativeTemplate.slice(0, 80)}"`);
  } else {
    lines.push('no_fusion_possible');
  }
  return lines;
}

/** Slice 8: Winning selection deep inspection. */
export function buildQuoteRecallAuditSlice8(resolver: QuoteRecallResolver, request: QuoteRecallResolverRequest): readonly string[] {
  const response = resolver.resolve({ ...request, maxSelections: 6 });
  const lines: string[] = ['slice=8|winning_selection'];
  if (response.winningSelection) {
    const w = response.winningSelection;
    lines.push(`id=${w.selectionId}|score=${w.score01.toFixed(3)}|surface=${w.surface}`);
    lines.push(`text="${w.text.slice(0, 80)}"`);
    lines.push(`reasons=${w.reasonCodes.join(',')}`);
    lines.push(`uses=${w.usageCount}|fatigue=${resolver.computeRecallFatigue(w).toFixed(3)}`);
  } else {
    lines.push('no_winning_selection');
  }
  return lines;
}

/** Slice 9-25: Per-mode recall profile diagnostics and additional analytics. */
export function buildQuoteRecallAuditSlice9(resolver: QuoteRecallResolver, request: QuoteRecallResolverRequest): readonly string[] {
  const lines: string[] = ['slice=9|mode_profiles'];
  for (const modeId of ['GO_ALONE', 'HEAD_TO_HEAD', 'TEAM_UP', 'CHASE_A_LEGEND']) {
    const p = resolver.getModeRecallProfile(modeId);
    lines.push(`${modeId}|mutation=${p.preferredMutation}|timing=${p.timingMultiplier}|fragment=${p.fragmentary}`);
  }
  return lines;
}

export function buildQuoteRecallAuditSlice10(resolver: QuoteRecallResolver, request: QuoteRecallResolverRequest): readonly string[] {
  const response = resolver.resolve({ ...request, maxSelections: 12, includeQuotes: true, includeCallbacks: false });
  const lines: string[] = ['slice=10|quotes_only'];
  lines.push(`total=${response.selections.length}`);
  for (const s of response.selections.slice(0, 6)) lines.push(`${s.score01.toFixed(3)}|"${s.text.slice(0, 56)}"`);
  return lines;
}

export function buildQuoteRecallAuditSlice11(resolver: QuoteRecallResolver, request: QuoteRecallResolverRequest): readonly string[] {
  const response = resolver.resolve({ ...request, maxSelections: 12, includeQuotes: false, includeCallbacks: true });
  const lines: string[] = ['slice=11|callbacks_only'];
  lines.push(`total=${response.selections.length}`);
  for (const s of response.selections.slice(0, 6)) lines.push(`${s.score01.toFixed(3)}|"${s.text.slice(0, 56)}"`);
  return lines;
}

export function buildQuoteRecallAuditSlice12(resolver: QuoteRecallResolver, request: QuoteRecallResolverRequest): readonly string[] {
  const response = resolver.resolve({ ...request, maxSelections: 8 });
  const lines: string[] = ['slice=12|reason_code_frequency'];
  const freq = new Map<string, number>();
  for (const s of response.selections) for (const r of s.reasonCodes) freq.set(r, (freq.get(r) ?? 0) + 1);
  for (const [code, count] of [...freq.entries()].sort((a, b) => b[1] - a[1])) lines.push(`${code}=${count}`);
  return lines;
}

export function buildQuoteRecallAuditSlice13(r: QuoteRecallResolver, req: QuoteRecallResolverRequest): readonly string[] { const resp = r.resolve({ ...req, maxSelections: 6 }); return ['slice=13|audit_trail', ...resp.auditTrail.slice(0, 10)]; }
export function buildQuoteRecallAuditSlice14(r: QuoteRecallResolver, req: QuoteRecallResolverRequest): readonly string[] { const resp = r.resolve({ ...req, maxSelections: 6 }); return ['slice=14|resolution_quote', resp.quoteResolution ? `resolved|${resp.quoteResolution.outcome}` : 'none']; }
export function buildQuoteRecallAuditSlice15(r: QuoteRecallResolver, req: QuoteRecallResolverRequest): readonly string[] { const resp = r.resolve({ ...req, maxSelections: 6 }); return ['slice=15|resolution_callback', resp.callbackResolution ? `resolved|${resp.callbackResolution.outcome}` : 'none']; }
export function buildQuoteRecallAuditSlice16(r: QuoteRecallResolver, req: QuoteRecallResolverRequest): readonly string[] { return ['slice=16|request_params', `mode=${req.mode}|player=${req.playerId}|actor=${req.actorId ?? 'none'}|cp=${req.counterpartId ?? 'none'}|max=${req.maxSelections ?? 'default'}`]; }
export function buildQuoteRecallAuditSlice17(r: QuoteRecallResolver, req: QuoteRecallResolverRequest): readonly string[] { const resp = r.resolve({ ...req, maxSelections: 4, mode: 'RIVALRY' }); return ['slice=17|rivalry_recall', `selections=${resp.selections.length}`, ...resp.selections.map(s => `${s.score01.toFixed(3)}|"${s.text.slice(0,48)}"`)]; }
export function buildQuoteRecallAuditSlice18(r: QuoteRecallResolver, req: QuoteRecallResolverRequest): readonly string[] { const resp = r.resolve({ ...req, maxSelections: 4, mode: 'HELPER' }); return ['slice=18|helper_recall', `selections=${resp.selections.length}`, ...resp.selections.map(s => `${s.score01.toFixed(3)}|"${s.text.slice(0,48)}"`)]; }
export function buildQuoteRecallAuditSlice19(r: QuoteRecallResolver, req: QuoteRecallResolverRequest): readonly string[] { const resp = r.resolve({ ...req, maxSelections: 4, mode: 'DEAL_ROOM' }); return ['slice=19|deal_room_recall', `selections=${resp.selections.length}`, ...resp.selections.map(s => `${s.score01.toFixed(3)}|"${s.text.slice(0,48)}"`)]; }
export function buildQuoteRecallAuditSlice20(r: QuoteRecallResolver, req: QuoteRecallResolverRequest): readonly string[] { const resp = r.resolve({ ...req, maxSelections: 4, mode: 'AUDIENCE' }); return ['slice=20|audience_recall', `selections=${resp.selections.length}`, ...resp.selections.map(s => `${s.score01.toFixed(3)}|"${s.text.slice(0,48)}"`)]; }
export function buildQuoteRecallAuditSlice21(r: QuoteRecallResolver, req: QuoteRecallResolverRequest): readonly string[] { const resp = r.resolve({ ...req, maxSelections: 4, mode: 'RESCUE' }); return ['slice=21|rescue_recall', `selections=${resp.selections.length}`, ...resp.selections.map(s => `${s.score01.toFixed(3)}|"${s.text.slice(0,48)}"`)]; }
export function buildQuoteRecallAuditSlice22(r: QuoteRecallResolver, req: QuoteRecallResolverRequest): readonly string[] { const resp = r.resolve({ ...req, maxSelections: 4, mode: 'POSTRUN' }); return ['slice=22|postrun_recall', `selections=${resp.selections.length}`, ...resp.selections.map(s => `${s.score01.toFixed(3)}|"${s.text.slice(0,48)}"`)]; }
export function buildQuoteRecallAuditSlice23(r: QuoteRecallResolver, req: QuoteRecallResolverRequest): readonly string[] { const resp = r.resolve({ ...req, maxSelections: 4, mode: 'SYSTEM' }); return ['slice=23|system_recall', `selections=${resp.selections.length}`, ...resp.selections.map(s => `${s.score01.toFixed(3)}|"${s.text.slice(0,48)}"`)]; }
export function buildQuoteRecallAuditSlice24(r: QuoteRecallResolver, req: QuoteRecallResolverRequest): readonly string[] { const resp = r.resolve({ ...req, maxSelections: 8, allowReuse: true }); return ['slice=24|with_reuse', `selections=${resp.selections.length}`, ...resp.selections.slice(0,4).map(s => `${s.score01.toFixed(3)}|uses=${s.usageCount}|"${s.text.slice(0,40)}"`)]; }
export function buildQuoteRecallAuditSlice25(r: QuoteRecallResolver, req: QuoteRecallResolverRequest): readonly string[] { const resp = r.resolve({ ...req, maxSelections: 8, proofRequired: true }); return ['slice=25|proof_required', `selections=${resp.selections.length}`, ...resp.selections.slice(0,4).map(s => `${s.score01.toFixed(3)}|"${s.text.slice(0,48)}"`)]; }


// ============================================================================
// MARK: Recall utility functions
// ============================================================================

/** Compute the narrative weight of a recall — how much story value it adds. */
export function computeRecallNarrativeWeight01(
  selection: QuoteRecallSelection,
  audienceHeat01: number,
  isFirstRecallInScene: boolean,
): number {
  const baseWeight = selection.score01 * 0.4;
  const audienceBoost = audienceHeat01 * 0.25;
  const firstBonus = isFirstRecallInScene ? 0.2 : 0;
  const fatigueDiscount = selection.usageCount > 3 ? -0.15 : 0;
  return Math.min(1, Math.max(0, baseWeight + audienceBoost + firstBonus + fatigueDiscount));
}

/** Determine if a recall should trigger a counter-recall opportunity for the player. */
export function shouldOfferCounterRecall(
  selection: QuoteRecallSelection,
  playerConfidence01: number,
  playerHasReceipts: boolean,
): boolean {
  if (!playerHasReceipts) return false;
  if (selection.surface !== 'RIVALRY' && selection.surface !== 'DEAL_ROOM') return false;
  return playerConfidence01 >= 0.5 && selection.score01 >= 0.4;
}

/** Estimate how the audience will react to a specific recall. */
export function estimateAudienceReaction(
  selection: QuoteRecallSelection,
  audienceHeat01: number,
): { reactionType: 'HYPE' | 'SHOCK' | 'COLD' | 'INDIFFERENT'; intensity01: number } {
  if (selection.score01 >= 0.8 && audienceHeat01 >= 0.6) {
    return { reactionType: 'HYPE', intensity01: Math.min(1, selection.score01 * audienceHeat01 * 1.5) };
  }
  if (selection.score01 >= 0.6 && selection.surface === 'RIVALRY') {
    return { reactionType: 'SHOCK', intensity01: selection.score01 * 0.8 };
  }
  if (audienceHeat01 < 0.2) {
    return { reactionType: 'COLD', intensity01: 0.1 };
  }
  return { reactionType: 'INDIFFERENT', intensity01: 0.3 };
}

/** Build a complete recall audit report for proof chain surfaces. */
export function buildRecallAuditReport(
  resolver: QuoteRecallResolver,
  playerId: string,
  counterpartId: string,
  request: QuoteRecallResolverRequest,
): readonly string[] {
  const diagLines = resolver.buildDiagnosticLines(playerId, counterpartId, request);
  const history = resolver.getRecallHistory(playerId, counterpartId);
  return [
    ...diagLines,
    `recent_recalls=${history.length}`,
    ...history.slice(-6).map((h) => `  ${h.surface}|score=${h.score01.toFixed(3)}|mutation=${h.mutationStrategy}|fatigue=${h.fatigueAtRecall.toFixed(3)}|"${h.text.slice(0, 40)}"`),
  ];
}


