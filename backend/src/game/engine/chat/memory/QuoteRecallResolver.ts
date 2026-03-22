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
  ChatCallbackKind,
  ChatCallbackPrivacyClass,
} from '../../../../../../shared/contracts/chat/ChatCallback';
import type {
  ChatQuoteAudienceClass,
  ChatQuoteSelectionCandidate,
  ChatQuoteSelectionResponse,
  ChatQuoteRequestId,
  ChatQuoteToneClass,
  ChatQuoteUseIntent,
} from '../../../../../../shared/contracts/chat/ChatQuote';
import type {
  ChatQuoteId,
  ChatRequestId,
  Score01,
  UnixMs,
} from '../../../../../../shared/contracts/chat/ChatChannels';
import {
  ConversationMemoryStore,
  type ConversationCallbackCandidate,
  type ConversationMemoryEventRecord,
  type ConversationMemoryQuoteRecord,
  type ConversationQuoteCandidate,
} from './ConversationMemoryStore';

// ============================================================================
// MARK: Local type aliases — types referenced throughout recall logic that are
// not exported from the shared contracts. Mirror the pattern established in
// ConversationMemoryStore.ts to keep backend recall decoupled from transport.
// ============================================================================
type ChatCallbackMode = string;
type ChatCallbackResolution = { readonly outcome?: string; readonly [key: string]: unknown };
type ChatQuoteKind = string;
type ChatQuoteResolution = { readonly requestId: string; readonly createdAt: number; readonly selected: readonly ChatQuoteSelection[]; readonly winningQuoteId?: string; readonly winningText?: string; readonly winningProof?: unknown; readonly summary?: string };
type ChatQuoteSelection = { readonly quoteId: string; readonly score01: number; readonly text: string; readonly normalizedText: string; readonly kind: string; readonly proof: unknown; readonly evidence: readonly unknown[]; readonly tags: readonly string[] };

/** Brand a plain string as ChatRequestId for contract-surface integration. */
function toRequestId(id: string): ChatRequestId { return id as unknown as ChatRequestId; }

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
  | 'cross_run_bridge_boost'
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
  readonly callbackKindFilter?: readonly ChatCallbackKind[];
  readonly audienceClassFilter?: readonly ChatQuoteAudienceClass[];
  readonly toneClassFilter?: readonly ChatQuoteToneClass[];
  readonly useIntentFilter?: readonly ChatQuoteUseIntent[];
  readonly privacyFilter?: readonly ChatCallbackPrivacyClass[];
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
  readonly usageCount: number;
  readonly quoteKind?: ChatQuoteKind;
  readonly callbackMode?: ChatCallbackMode;
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
function normalizeText(input: string): string { return input.toLowerCase().replace(/[""]/g, '"').replace(/['']/g, "'").replace(/[^a-z0-9\s'"!?.,:-]/g, ' ').replace(/\s+/g, ' ').trim(); }
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

  private quoteReasonCodes(request: QuoteRecallResolverRequest, record: ConversationMemoryQuoteRecord): readonly QuoteRecallReasonCode[] {
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

  private callbackReasonCodes(request: QuoteRecallResolverRequest, candidate: ConversationCallbackCandidate): readonly QuoteRecallReasonCode[] {
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
      usageCount: candidate.record.usageCount ?? 0,
      quoteKind: candidate.record.kind as ChatQuoteKind,
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
      usageCount: candidate.record.usageCount ?? 0,
      callbackMode: candidate.record.mode as ChatCallbackMode,
      callback: candidate.record,
    };
  }

  /** Convert internal selection to shared contract ChatQuoteSelectionCandidate. */
  private toContractCandidate(selection: QuoteRecallSelection): ChatQuoteSelectionCandidate {
    return {
      quoteId: (selection.quoteId ?? selection.selectionId) as unknown as ChatQuoteId,
      score01: selection.score01 as unknown as Score01,
      visibilityState: 'VISIBLE' as const,
      intent: 'RECEIPT' as ChatQuoteUseIntent,
      toneClass: 'NEUTRAL' as ChatQuoteToneClass,
      excerpt: selection.text.slice(0, 200),
      notes: [...selection.reasonCodes],
    };
  }

  /** Build a ChatQuoteSelectionResponse for proof-chain integration. */
  public buildContractSelectionResponse(request: QuoteRecallResolverRequest): ChatQuoteSelectionResponse {
    const response = this.resolve(request);
    return {
      requestId: request.requestId as unknown as ChatQuoteRequestId,
      createdAt: request.createdAt as unknown as UnixMs,
      candidates: response.selections.filter(s => s.quoteId).slice(0, 8).map(s => this.toContractCandidate(s)),
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

  /** Filter and rank recall candidates based on originating memory events. */
  public rankByOriginatingEvent(
    playerId: string,
    selections: readonly QuoteRecallSelection[],
    eventFilter: (event: ConversationMemoryEventRecord) => boolean,
  ): readonly QuoteRecallSelection[] {
    return selections.filter((selection) => {
      if (selection.quote) {
        const events = this.store.queryEvents({
          playerId,
          actorId: selection.quote.actorId,
          counterpartId: selection.quote.counterpartId,
        });
        return events.some(eventFilter);
      }
      return true;
    });
  }

  public resolve(request: QuoteRecallResolverRequest): QuoteRecallResolverResponse {
    const quoteCandidates = request.includeQuotes === false ? [] : this.store.selectQuoteCandidates({
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
    const kindFiltered = request.desiredKinds?.length ? merged.filter((selection) => {
      const kind = selection.quoteKind;
      return !kind || (request.desiredKinds as readonly string[]).includes(kind);
    }) : merged;
    const filtered = request.allowReuse ? kindFiltered : kindFiltered.filter((selection) => selection.usageCount < 6);
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
    if (selection.mode === 'RIVALRY') baseDelay = 2200;
    if (selection.mode === 'DEAL_ROOM') baseDelay = 3400;
    if (selection.mode === 'HELPER') baseDelay = 1200;
    const heatBonus = audienceHeat01 * 1500;
    const pressureBonus = pressureTier === 'CRITICAL' ? 1200 : pressureTier === 'HIGH' ? 800 : 0;
    const scoreBonus = selection.score01 * 1000;
    return Math.round(baseDelay + heatBonus + pressureBonus + scoreBonus);
  }

  /** Should this recall be held for dramatic impact instead of fired immediately? */
  public shouldHoldForDramaticImpact(selection: QuoteRecallSelection, audienceHeat01: number): boolean {
    return selection.score01 >= 0.65 && audienceHeat01 >= 0.45 && selection.mode === 'RIVALRY';
  }

  // ==========================================================================
  // MARK: Quote mutation strategies
  // ==========================================================================

  /** Select how a recalled quote should be presented (verbatim, paraphrased, truncated, etc). */
  public selectMutationStrategy(selection: QuoteRecallSelection, counterpartKind: string): QuoteMutationStrategy {
    if (counterpartKind === 'HELPER') return 'SOFT_REFERENCE';
    if (selection.score01 >= 0.8 && selection.mode === 'RIVALRY') return 'VERBATIM';
    if (selection.mode === 'DEAL_ROOM') return 'WEAPONIZE';
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
        return { ...s, score01: Math.min(1, s.score01 + 0.15), reasonCodes: [...s.reasonCodes, 'cross_run_bridge_boost' as QuoteRecallReasonCode] as readonly QuoteRecallReasonCode[] };
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

  // ==========================================================================
  // MARK: Mode-aware resolve with strategy matrix
  // ==========================================================================

  /** Resolve with mode-specific strategy applied from MODE_RECALL_STRATEGY_MATRIX. */
  public resolveWithModeStrategy(request: QuoteRecallResolverRequest, modeId: string): QuoteRecallResolverResponse {
    const strategy = getModeRecallStrategy(modeId);
    const modeRequest: QuoteRecallResolverRequest = {
      ...request,
      desiredKinds: request.desiredKinds?.length ? request.desiredKinds : strategy.kindPriority as readonly ChatQuoteKind[],
      allowedCallbackModes: request.allowedCallbackModes?.length ? request.allowedCallbackModes : strategy.callbackModePriority as readonly string[],
      proofRequired: request.proofRequired ?? strategy.proofRequiredByDefault,
      maxSelections: request.maxSelections ?? Math.min(strategy.maxRecallsPerMinute, this.config.defaultMaxSelections),
    };
    return this.resolve(modeRequest);
  }

  // ==========================================================================
  // MARK: Impact-predicted resolve
  // ==========================================================================

  /** Resolve and annotate each selection with impact predictions. */
  public resolveWithImpactPredictions(
    request: QuoteRecallResolverRequest,
    audienceHeat01: number,
    pressureTier?: string,
  ): { response: QuoteRecallResolverResponse; impacts: readonly RecallImpactAssessment[] } {
    const response = this.resolve(request);
    const impacts = response.selections.map((selection, index) => {
      const counterpartProfile = request.counterpartId
        ? this.buildCounterpartProfile(request.playerId, request.counterpartId)
        : undefined;
      return predictRecallImpact(selection, audienceHeat01, pressureTier, counterpartProfile, index === 0);
    });
    return { response, impacts };
  }

  // ==========================================================================
  // MARK: Counterpart profile builder
  // ==========================================================================

  /** Build a counterpart recall profile from accumulated history. */
  public buildCounterpartProfile(playerId: string, counterpartId: string): CounterpartRecallProfile {
    const history = this.getRecallHistory(playerId, counterpartId);
    const effectivenessRate = this.recallEffectivenessRate(playerId, counterpartId);
    const chain = this.detectActiveChain(playerId, counterpartId);
    const effective = Math.round(effectivenessRate * Math.max(1, history.length));
    const kindFreq = new Map<string, number>();
    const mutFreq = new Map<string, number>();
    for (const h of history) {
      kindFreq.set(h.surface, (kindFreq.get(h.surface) ?? 0) + 1);
      mutFreq.set(h.mutationStrategy, (mutFreq.get(h.mutationStrategy) ?? 0) + 1);
    }
    const topKinds = [...kindFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]) as ChatQuoteKind[];
    const topMuts = [...mutFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(e => e[0]) as QuoteMutationStrategy[];
    return Object.freeze({
      counterpartId, playerId,
      totalRecalls: history.length,
      effectiveRecalls: effective,
      ineffectiveRecalls: history.length - effective,
      effectivenessRate01: effectivenessRate,
      lastRecalledAt: history.length > 0 ? history[history.length - 1]!.timestamp : 0,
      preferredKinds: topKinds,
      preferredMutations: topMuts,
      avgScore01: history.length > 0 ? history.reduce((s, h) => s + h.score01, 0) / history.length : 0,
      peakScore01: history.length > 0 ? Math.max(...history.map(h => h.score01)) : 0,
      activeChainDepth: chain?.currentDepth ?? 0,
      lastCallbackMode: undefined,
      fatigueLevel01: history.length > 0 ? history[history.length - 1]!.fatigueAtRecall : 0,
    });
  }

  // ==========================================================================
  // MARK: Weaponize top selection
  // ==========================================================================

  /** Select and weaponize the top recall for deployment. */
  public weaponizeTopSelection(request: QuoteRecallResolverRequest): WeaponizedQuote | undefined {
    const response = this.resolve(request);
    if (!response.winningSelection) return undefined;
    const selection = response.winningSelection;
    const mutation = this.selectMutationStrategy(selection, request.mode === 'HELPER' ? 'HELPER' : 'HATER');
    return weaponizeQuote(selection, request.mode, mutation);
  }

  // ==========================================================================
  // MARK: Semantic deduplication pass
  // ==========================================================================

  /** Resolve with semantic deduplication applied. */
  public resolveWithSemanticDedupe(request: QuoteRecallResolverRequest, similarityThreshold01: number = 0.65): QuoteRecallResolverResponse {
    const base = this.resolve(request);
    const deduped = deduplicateBySemanticSimilarity(base.selections, similarityThreshold01);
    return { ...base, selections: deduped, winningSelection: deduped[0] };
  }

  // ==========================================================================
  // MARK: Audience-timed resolve
  // ==========================================================================

  /** Resolve and compute audience-responsive timing for the winning selection. */
  public resolveWithAudienceTiming(
    request: QuoteRecallResolverRequest,
    audienceHeat01: number,
    pressureTier?: string,
    modeId?: string,
  ): { response: QuoteRecallResolverResponse; timing?: AudienceResponsiveRecallTiming } {
    const response = this.resolve(request);
    if (!response.winningSelection) return { response };
    const timing = computeAudienceResponsiveRecallTiming(response.winningSelection, audienceHeat01, pressureTier, modeId);
    return { response, timing };
  }

  // ==========================================================================
  // MARK: Full pipeline resolve (mode + impact + timing + weaponization)
  // ==========================================================================

  /** Execute the complete recall pipeline: mode strategy → resolve → impact → timing → weaponization. */
  public resolveFullPipeline(
    request: QuoteRecallResolverRequest,
    modeId: string,
    audienceHeat01: number,
    pressureTier?: string,
  ): {
    response: QuoteRecallResolverResponse;
    impacts: readonly RecallImpactAssessment[];
    timing?: AudienceResponsiveRecallTiming;
    weapon?: WeaponizedQuote;
    proofPackage?: RecallProofPackage;
  } {
    const strategy = getModeRecallStrategy(modeId);
    const modeRequest: QuoteRecallResolverRequest = {
      ...request,
      desiredKinds: request.desiredKinds?.length ? request.desiredKinds : strategy.kindPriority as readonly ChatQuoteKind[],
      allowedCallbackModes: request.allowedCallbackModes?.length ? request.allowedCallbackModes : strategy.callbackModePriority as readonly string[],
      proofRequired: request.proofRequired ?? strategy.proofRequiredByDefault,
    };
    const response = this.resolveWithSemanticDedupe(modeRequest);
    const impacts = response.selections.map((selection, index) => {
      const cp = request.counterpartId ? this.buildCounterpartProfile(request.playerId, request.counterpartId) : undefined;
      return predictRecallImpact(selection, audienceHeat01, pressureTier, cp, index === 0);
    });
    const topImpact = impacts[0];
    const timing = response.winningSelection
      ? computeAudienceResponsiveRecallTiming(response.winningSelection, audienceHeat01, pressureTier, modeId)
      : undefined;
    let weapon: WeaponizedQuote | undefined;
    if (response.winningSelection && topImpact) {
      weapon = weaponizeQuote(response.winningSelection, request.mode, topImpact.suggestedMutation);
    }
    let proofPackage: RecallProofPackage | undefined;
    if (response.winningSelection && topImpact) {
      proofPackage = buildRecallProofPackage(response.winningSelection, request, topImpact, audienceHeat01, Date.now());
    }
    return { response, impacts, timing, weapon, proofPackage };
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
// MARK: Resolution lifecycle state machine
// ============================================================================

export type RecallResolutionState = 'PENDING' | 'SELECTED' | 'DELIVERED' | 'CONFIRMED' | 'SPENT' | 'FAILED' | 'EXPIRED';

export interface RecallResolutionLifecycle {
  readonly resolutionId: string;
  readonly requestId: string;
  readonly brandedRequestId: ChatRequestId;
  readonly playerId: string;
  readonly counterpartId?: string;
  readonly state: RecallResolutionState;
  readonly selectionId?: string;
  readonly quoteResolution?: ChatQuoteResolution;
  readonly callbackResolution?: ChatCallbackResolution;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly deliveredAt?: number;
  readonly confirmedAt?: number;
  readonly expiredAt?: number;
  readonly audienceHeatAtResolution01: number;
  readonly pressureTierAtResolution?: string;
  readonly modeIdAtResolution?: string;
}

export interface RecallResolutionTransition {
  readonly from: RecallResolutionState;
  readonly to: RecallResolutionState;
  readonly at: number;
  readonly reason: string;
}

// ============================================================================
// MARK: Mode-specific recall strategy matrix
// ============================================================================

export interface ModeRecallStrategyEntry {
  readonly modeId: string;
  readonly modeName: string;
  readonly preferredRecallModes: readonly QuoteRecallMode[];
  readonly kindPriority: readonly ChatQuoteKind[];
  readonly callbackModePriority: readonly string[];
  readonly maxRecallsPerMinute: number;
  readonly dramaticDelayMultiplier: number;
  readonly audienceHeatThreshold01: number;
  readonly preferVerbatim: boolean;
  readonly counterRecallEnabled: boolean;
  readonly chainDepthLimit: number;
  readonly proofRequiredByDefault: boolean;
}

export const MODE_RECALL_STRATEGY_MATRIX: Readonly<Record<string, ModeRecallStrategyEntry>> = Object.freeze({
  'GO_ALONE': Object.freeze({
    modeId: 'GO_ALONE', modeName: 'Empire',
    preferredRecallModes: ['RIVALRY', 'SYSTEM', 'HELPER', 'AUDIENCE', 'POSTRUN'] as QuoteRecallMode[],
    kindPriority: ['RECEIPT', 'CALLBACK', 'BOAST', 'THREAT', 'ADVICE', 'BLUFF', 'STATEMENT'] as ChatQuoteKind[],
    callbackModePriority: ['RECEIPT', 'RIVALRY', 'HELPER_RECALL', 'NEGOTIATION'] as string[],
    maxRecallsPerMinute: 4,
    dramaticDelayMultiplier: 1.0,
    audienceHeatThreshold01: 0.35,
    preferVerbatim: true,
    counterRecallEnabled: false,
    chainDepthLimit: 3,
    proofRequiredByDefault: false,
  }),
  'HEAD_TO_HEAD': Object.freeze({
    modeId: 'HEAD_TO_HEAD', modeName: 'Predator',
    preferredRecallModes: ['DEAL_ROOM', 'RIVALRY', 'AUDIENCE', 'SYSTEM', 'POSTRUN'] as QuoteRecallMode[],
    kindPriority: ['BLUFF', 'RECEIPT', 'THREAT', 'BOAST', 'CALLBACK', 'STATEMENT', 'ADVICE'] as ChatQuoteKind[],
    callbackModePriority: ['NEGOTIATION', 'RECEIPT', 'RIVALRY', 'HELPER_RECALL'] as string[],
    maxRecallsPerMinute: 6,
    dramaticDelayMultiplier: 0.65,
    audienceHeatThreshold01: 0.45,
    preferVerbatim: false,
    counterRecallEnabled: true,
    chainDepthLimit: 6,
    proofRequiredByDefault: true,
  }),
  'TEAM_UP': Object.freeze({
    modeId: 'TEAM_UP', modeName: 'Syndicate',
    preferredRecallModes: ['HELPER', 'RESCUE', 'SYSTEM', 'RIVALRY', 'POSTRUN'] as QuoteRecallMode[],
    kindPriority: ['ADVICE', 'CALLBACK', 'RECEIPT', 'STATEMENT', 'BOAST', 'THREAT', 'BLUFF'] as ChatQuoteKind[],
    callbackModePriority: ['HELPER_RECALL', 'RECEIPT', 'RIVALRY', 'NEGOTIATION'] as string[],
    maxRecallsPerMinute: 3,
    dramaticDelayMultiplier: 1.3,
    audienceHeatThreshold01: 0.25,
    preferVerbatim: true,
    counterRecallEnabled: false,
    chainDepthLimit: 4,
    proofRequiredByDefault: false,
  }),
  'CHASE_A_LEGEND': Object.freeze({
    modeId: 'CHASE_A_LEGEND', modeName: 'Phantom',
    preferredRecallModes: ['SYSTEM', 'RIVALRY', 'AUDIENCE', 'POSTRUN', 'HELPER'] as QuoteRecallMode[],
    kindPriority: ['CALLBACK', 'RECEIPT', 'ADVICE', 'THREAT', 'BOAST', 'BLUFF', 'STATEMENT'] as ChatQuoteKind[],
    callbackModePriority: ['RECEIPT', 'RIVALRY', 'HELPER_RECALL', 'NEGOTIATION'] as string[],
    maxRecallsPerMinute: 2,
    dramaticDelayMultiplier: 2.0,
    audienceHeatThreshold01: 0.3,
    preferVerbatim: false,
    counterRecallEnabled: false,
    chainDepthLimit: 2,
    proofRequiredByDefault: true,
  }),
});

/** Get mode-specific recall strategy. */
export function getModeRecallStrategy(modeId: string | undefined): ModeRecallStrategyEntry {
  return MODE_RECALL_STRATEGY_MATRIX[modeId ?? ''] ?? MODE_RECALL_STRATEGY_MATRIX['GO_ALONE']!;
}

// ============================================================================
// MARK: Counterpart recall priority system
// ============================================================================

export interface CounterpartRecallProfile {
  readonly counterpartId: string;
  readonly playerId: string;
  readonly totalRecalls: number;
  readonly effectiveRecalls: number;
  readonly ineffectiveRecalls: number;
  readonly effectivenessRate01: number;
  readonly lastRecalledAt: number;
  readonly preferredKinds: readonly ChatQuoteKind[];
  readonly preferredMutations: readonly QuoteMutationStrategy[];
  readonly avgScore01: number;
  readonly peakScore01: number;
  readonly activeChainDepth: number;
  readonly lastCallbackMode?: ChatCallbackMode;
  readonly fatigueLevel01: number;
}

// ============================================================================
// MARK: Recall impact prediction
// ============================================================================

export type RecallImpactPrediction = 'DEVASTATING' | 'STRONG' | 'MODERATE' | 'WEAK' | 'BACKFIRE';

export interface RecallImpactAssessment {
  readonly prediction: RecallImpactPrediction;
  readonly confidence01: number;
  readonly audienceReaction: 'HYPE' | 'SHOCK' | 'COLD' | 'INDIFFERENT';
  readonly audienceIntensity01: number;
  readonly counterpartVulnerability01: number;
  readonly proofStrength01: number;
  readonly noveltyFactor01: number;
  readonly timingQuality01: number;
  readonly suggestedDelay: number;
  readonly suggestedMutation: QuoteMutationStrategy;
  readonly reasoning: readonly string[];
}

/** Predict the impact of deploying a specific recall selection. */
export function predictRecallImpact(
  selection: QuoteRecallSelection,
  audienceHeat01: number,
  pressureTier: string | undefined,
  counterpartProfile: CounterpartRecallProfile | undefined,
  isFirstRecallInScene: boolean,
): RecallImpactAssessment {
  const reasoning: string[] = [];
  let impactScore = selection.score01 * 0.4;
  const noveltyFactor = selection.usageCount <= 1 ? 0.9 : selection.usageCount <= 3 ? 0.6 : 0.3;
  impactScore += noveltyFactor * 0.15;
  const audienceBoost = audienceHeat01 * 0.2;
  impactScore += audienceBoost;
  const pressureBoost = pressureTier === 'CRITICAL' ? 0.18 : pressureTier === 'HIGH' ? 0.12 : pressureTier === 'ELEVATED' ? 0.06 : 0;
  impactScore += pressureBoost;
  if (isFirstRecallInScene) { impactScore += 0.12; reasoning.push('first_recall_bonus'); }
  if (selection.proofChainId) { impactScore += 0.08; reasoning.push('proof_backed'); }
  const counterpartVulnerability01 = counterpartProfile ? clamp01(1 - counterpartProfile.effectivenessRate01) : 0.5;
  impactScore += counterpartVulnerability01 * 0.1;
  const timingQuality01 = clamp01(audienceHeat01 * 0.5 + pressureBoost * 2);
  const finalScore = clamp01(impactScore);
  let prediction: RecallImpactPrediction;
  if (finalScore >= 0.82) prediction = 'DEVASTATING';
  else if (finalScore >= 0.62) prediction = 'STRONG';
  else if (finalScore >= 0.4) prediction = 'MODERATE';
  else if (finalScore >= 0.2) prediction = 'WEAK';
  else prediction = 'BACKFIRE';
  if (prediction === 'DEVASTATING') reasoning.push('high_score_convergence');
  if (noveltyFactor >= 0.8) reasoning.push('high_novelty');
  if (audienceHeat01 >= 0.6) reasoning.push('hot_audience');
  if (pressureBoost >= 0.12) reasoning.push('high_pressure_context');
  const audienceReaction = audienceHeat01 >= 0.6 && finalScore >= 0.7 ? 'HYPE' as const
    : finalScore >= 0.6 && selection.surface === 'QUOTE' ? 'SHOCK' as const
    : audienceHeat01 < 0.2 ? 'COLD' as const : 'INDIFFERENT' as const;
  let suggestedMutation: QuoteMutationStrategy = 'VERBATIM';
  if (finalScore >= 0.8 && selection.surface === 'QUOTE') suggestedMutation = 'VERBATIM';
  else if (selection.surface === 'CALLBACK') suggestedMutation = 'WEAPONIZE';
  else if (selection.usageCount >= 3) suggestedMutation = 'PARAPHRASE';
  else if (selection.text.length > 120) suggestedMutation = 'TRUNCATE';
  const suggestedDelay = prediction === 'DEVASTATING' ? 3500 : prediction === 'STRONG' ? 2200 : prediction === 'MODERATE' ? 1400 : 800;
  return Object.freeze({
    prediction, confidence01: clamp01(finalScore * 0.8 + 0.2),
    audienceReaction, audienceIntensity01: clamp01(audienceHeat01 * finalScore),
    counterpartVulnerability01, proofStrength01: selection.proofChainId ? 0.85 : 0.35,
    noveltyFactor01: noveltyFactor, timingQuality01,
    suggestedDelay, suggestedMutation, reasoning,
  });
}

// ============================================================================
// MARK: Resolution proof packaging for SovereigntyEngine
// ============================================================================

export interface RecallProofPackage {
  readonly packageId: string;
  readonly requestId: string;
  readonly brandedRequestId: ChatRequestId;
  readonly playerId: string;
  readonly counterpartId?: string;
  readonly selectionId: string;
  readonly quoteText: string;
  readonly proofChainId?: string;
  readonly recallMode: QuoteRecallMode;
  readonly quoteKind?: ChatQuoteKind;
  readonly callbackMode?: ChatCallbackMode;
  readonly score01: number;
  readonly impactPrediction: RecallImpactPrediction;
  readonly audienceHeatAtRecall01: number;
  readonly pressureTierAtRecall?: string;
  readonly mutationStrategy: QuoteMutationStrategy;
  readonly deliveredAt: number;
  readonly effectivenessVerified?: boolean;
  readonly tags: readonly string[];
}

/** Build a proof package from a completed recall for the SovereigntyEngine. */
export function buildRecallProofPackage(
  selection: QuoteRecallSelection,
  request: QuoteRecallResolverRequest,
  impact: RecallImpactAssessment,
  audienceHeat01: number,
  at: number,
): RecallProofPackage {
  return Object.freeze({
    packageId: `proof:recall:${selection.selectionId}:${at}`,
    requestId: request.requestId,
    brandedRequestId: toRequestId(request.requestId),
    playerId: request.playerId,
    counterpartId: request.counterpartId,
    selectionId: selection.selectionId,
    quoteText: selection.text,
    proofChainId: selection.proofChainId,
    recallMode: request.mode,
    quoteKind: selection.quoteKind,
    callbackMode: selection.callbackMode,
    score01: selection.score01,
    impactPrediction: impact.prediction,
    audienceHeatAtRecall01: audienceHeat01,
    pressureTierAtRecall: request.pressureTier,
    mutationStrategy: impact.suggestedMutation,
    deliveredAt: at,
    tags: [...selection.tags, impact.prediction.toLowerCase(), selection.surface.toLowerCase()],
  });
}

// ============================================================================
// MARK: Dramatic pacing coordinator
// ============================================================================

export interface RecallPacingWindow {
  readonly windowId: string;
  readonly playerId: string;
  readonly counterpartId: string;
  readonly modeId: string;
  readonly windowStartAt: number;
  readonly windowEndAt: number;
  readonly maxRecallsInWindow: number;
  readonly recallsFired: number;
  readonly isExhausted: boolean;
  readonly cooldownUntil: number;
  readonly lastRecallAt: number;
}

export interface RecallPacingDecision {
  readonly shouldFire: boolean;
  readonly suggestedDelayMs: number;
  readonly reason: string;
  readonly windowRemaining: number;
  readonly cooldownActive: boolean;
}

/** Compute whether a recall should fire now or be delayed for dramatic pacing. */
export function computeRecallPacingDecision(
  window: RecallPacingWindow,
  selection: QuoteRecallSelection,
  audienceHeat01: number,
  now: number,
): RecallPacingDecision {
  if (now < window.cooldownUntil) {
    return { shouldFire: false, suggestedDelayMs: window.cooldownUntil - now, reason: 'cooldown_active', windowRemaining: window.maxRecallsInWindow - window.recallsFired, cooldownActive: true };
  }
  if (window.isExhausted || window.recallsFired >= window.maxRecallsInWindow) {
    return { shouldFire: false, suggestedDelayMs: Math.max(0, window.windowEndAt - now), reason: 'window_exhausted', windowRemaining: 0, cooldownActive: false };
  }
  if (now > window.windowEndAt) {
    return { shouldFire: false, suggestedDelayMs: 0, reason: 'window_expired', windowRemaining: 0, cooldownActive: false };
  }
  const timeSinceLast = now - window.lastRecallAt;
  const minGap = selection.score01 >= 0.7 ? 3000 : 5000;
  if (timeSinceLast < minGap) {
    return { shouldFire: false, suggestedDelayMs: minGap - timeSinceLast, reason: 'too_soon_after_last', windowRemaining: window.maxRecallsInWindow - window.recallsFired, cooldownActive: false };
  }
  const heatDelay = audienceHeat01 >= 0.7 ? 0 : audienceHeat01 >= 0.4 ? 1500 : 3000;
  if (heatDelay > 0 && selection.score01 < 0.6) {
    return { shouldFire: false, suggestedDelayMs: heatDelay, reason: 'audience_not_primed', windowRemaining: window.maxRecallsInWindow - window.recallsFired, cooldownActive: false };
  }
  return { shouldFire: true, suggestedDelayMs: 0, reason: 'clear_to_fire', windowRemaining: window.maxRecallsInWindow - window.recallsFired - 1, cooldownActive: false };
}

// ============================================================================
// MARK: Quote weaponization pipeline
// ============================================================================

export type WeaponizationClass = 'RECEIPT_DEPLOY' | 'BOAST_EXPOSURE' | 'BLUFF_REVEAL' | 'THREAT_CALLBACK' | 'ADVICE_ECHO' | 'CONFESSION_LEVERAGE' | 'STATEMENT_TWIST';

export interface WeaponizedQuote {
  readonly weaponId: string;
  readonly sourceSelectionId: string;
  readonly originalText: string;
  readonly weaponizedText: string;
  readonly weaponClass: WeaponizationClass;
  readonly originalKind: ChatQuoteKind;
  readonly mutationApplied: QuoteMutationStrategy;
  readonly impactBoost01: number;
  readonly proofChainId?: string;
  readonly deployedAt?: number;
}

/** Classify the weaponization class of a quote based on its kind and context. */
export function classifyWeaponization(kind: ChatQuoteKind, mode: QuoteRecallMode): WeaponizationClass {
  if (kind === 'RECEIPT') return 'RECEIPT_DEPLOY';
  if (kind === 'BOAST') return 'BOAST_EXPOSURE';
  if (kind === 'BLUFF' && mode === 'DEAL_ROOM') return 'BLUFF_REVEAL';
  if (kind === 'THREAT') return 'THREAT_CALLBACK';
  if (kind === 'ADVICE') return 'ADVICE_ECHO';
  return 'STATEMENT_TWIST';
}

/** Weaponize a quote selection for maximum dramatic/strategic impact. */
export function weaponizeQuote(selection: QuoteRecallSelection, mode: QuoteRecallMode, mutation: QuoteMutationStrategy): WeaponizedQuote {
  const kind = selection.quoteKind ?? ('STATEMENT' as ChatQuoteKind);
  const weaponClass = classifyWeaponization(kind, mode);
  let weaponizedText = selection.text;
  let impactBoost = 0;
  switch (mutation) {
    case 'VERBATIM': impactBoost = 0.12; break;
    case 'PARAPHRASE': weaponizedText = selection.text.length > 60 ? selection.text.slice(0, 57) + '...' : selection.text; impactBoost = 0.06; break;
    case 'TRUNCATE': weaponizedText = selection.text.slice(0, 40) + '...'; impactBoost = 0.04; break;
    case 'WEAPONIZE': impactBoost = 0.18; break;
    case 'SOFT_REFERENCE': weaponizedText = `(referencing: ${selection.text.slice(0, 30)}...)`; impactBoost = 0.02; break;
  }
  return Object.freeze({
    weaponId: `weapon:${selection.selectionId}:${Date.now()}`,
    sourceSelectionId: selection.selectionId,
    originalText: selection.text,
    weaponizedText,
    weaponClass,
    originalKind: kind,
    mutationApplied: mutation,
    impactBoost01: clamp01(impactBoost),
    proofChainId: selection.proofChainId,
  });
}

// ============================================================================
// MARK: Post-run recall archive
// ============================================================================

export interface PostRunRecallArchive {
  readonly archiveId: string;
  readonly playerId: string;
  readonly runId: string;
  readonly modeId: string;
  readonly totalRecalls: number;
  readonly totalSelections: number;
  readonly avgScore01: number;
  readonly peakScore01: number;
  readonly effectivenessRate01: number;
  readonly mostUsedKind: ChatQuoteKind;
  readonly mostUsedMode: QuoteRecallMode;
  readonly bestSelection?: QuoteRecallSelection;
  readonly bestImpact?: RecallImpactAssessment;
  readonly quoteResolutions: readonly ChatQuoteResolution[];
  readonly callbackResolutions: readonly ChatCallbackResolution[];
  readonly proofPackages: readonly RecallProofPackage[];
  readonly chainHistory: readonly QuoteChain[];
  readonly weaponizedQuotes: readonly WeaponizedQuote[];
  readonly counterpartProfiles: readonly CounterpartRecallProfile[];
  readonly createdAt: number;
}

/** Build post-run archive from resolver state. */
export function buildPostRunRecallArchive(
  resolver: QuoteRecallResolver,
  playerId: string,
  runId: string,
  modeId: string,
  proofPackages: readonly RecallProofPackage[],
  weaponized: readonly WeaponizedQuote[],
  quoteResolutions: readonly ChatQuoteResolution[],
  callbackResolutions: readonly ChatCallbackResolution[],
): PostRunRecallArchive {
  const allPlayerIds = (resolver as unknown as { _recallHistory: Map<string, RecallHistoryEntry[]> })._recallHistory ?? new Map<string, RecallHistoryEntry[]>();
  const counterpartIds = new Set<string>();
  for (const key of allPlayerIds.keys()) {
    if (key.startsWith(`${playerId}:`)) {
      counterpartIds.add(key.split(':')[1]!);
    }
  }
  const profiles: CounterpartRecallProfile[] = [];
  for (const cpId of counterpartIds) {
    const history = resolver.getRecallHistory(playerId, cpId);
    const effectiveness = resolver.recallEffectivenessRate(playerId, cpId);
    const chain = resolver.detectActiveChain(playerId, cpId);
    if (history.length > 0) {
      const effective = Math.round(effectiveness * history.length);
      profiles.push({
        counterpartId: cpId, playerId,
        totalRecalls: history.length,
        effectiveRecalls: effective,
        ineffectiveRecalls: history.length - effective,
        effectivenessRate01: effectiveness,
        lastRecalledAt: history[history.length - 1]?.timestamp ?? 0,
        preferredKinds: [] as ChatQuoteKind[],
        preferredMutations: [] as QuoteMutationStrategy[],
        avgScore01: history.reduce((s, h) => s + h.score01, 0) / Math.max(1, history.length),
        peakScore01: Math.max(...history.map(h => h.score01), 0),
        activeChainDepth: chain?.currentDepth ?? 0,
        fatigueLevel01: history.length > 0 ? clamp01(history[history.length - 1]!.fatigueAtRecall) : 0,
      });
    }
  }
  const allScores = proofPackages.map(p => p.score01);
  return Object.freeze({
    archiveId: `archive:recall:${playerId}:${runId}:${Date.now()}`,
    playerId, runId, modeId,
    totalRecalls: proofPackages.length,
    totalSelections: proofPackages.length,
    avgScore01: allScores.length > 0 ? allScores.reduce((s, v) => s + v, 0) / allScores.length : 0,
    peakScore01: allScores.length > 0 ? Math.max(...allScores) : 0,
    effectivenessRate01: profiles.length > 0 ? profiles.reduce((s, p) => s + p.effectivenessRate01, 0) / profiles.length : 0.5,
    mostUsedKind: 'RECEIPT' as ChatQuoteKind,
    mostUsedMode: 'RIVALRY' as QuoteRecallMode,
    quoteResolutions, callbackResolutions,
    proofPackages, chainHistory: [],
    weaponizedQuotes: weaponized,
    counterpartProfiles: profiles,
    createdAt: Date.now(),
  });
}

// ============================================================================
// MARK: Recall budget governor
// ============================================================================

export interface RecallBudgetConfig {
  readonly maxPerMinute: number;
  readonly maxPerCounterpart: number;
  readonly maxPerWindow: number;
  readonly windowMs: number;
  readonly cooldownMs: number;
  readonly fatigueThreshold01: number;
  readonly retirementThreshold01: number;
}

export const MODE_RECALL_BUDGET_CONFIGS: Readonly<Record<string, RecallBudgetConfig>> = Object.freeze({
  'GO_ALONE': Object.freeze({ maxPerMinute: 4, maxPerCounterpart: 12, maxPerWindow: 3, windowMs: 60000, cooldownMs: 8000, fatigueThreshold01: 0.7, retirementThreshold01: 0.85 }),
  'HEAD_TO_HEAD': Object.freeze({ maxPerMinute: 6, maxPerCounterpart: 18, maxPerWindow: 4, windowMs: 45000, cooldownMs: 5000, fatigueThreshold01: 0.8, retirementThreshold01: 0.92 }),
  'TEAM_UP': Object.freeze({ maxPerMinute: 3, maxPerCounterpart: 8, maxPerWindow: 2, windowMs: 90000, cooldownMs: 12000, fatigueThreshold01: 0.6, retirementThreshold01: 0.8 }),
  'CHASE_A_LEGEND': Object.freeze({ maxPerMinute: 2, maxPerCounterpart: 6, maxPerWindow: 1, windowMs: 120000, cooldownMs: 15000, fatigueThreshold01: 0.55, retirementThreshold01: 0.75 }),
});

/** Get mode-specific recall budget config. */
export function getModeRecallBudgetConfig(modeId: string | undefined): RecallBudgetConfig {
  return MODE_RECALL_BUDGET_CONFIGS[modeId ?? ''] ?? MODE_RECALL_BUDGET_CONFIGS['GO_ALONE']!;
}

// ============================================================================
// MARK: Audience-heat-responsive recall timing
// ============================================================================

export interface AudienceResponsiveRecallTiming {
  readonly audienceHeat01: number;
  readonly optimalDelayMs: number;
  readonly shouldAmplify: boolean;
  readonly shouldSilence: boolean;
  readonly crowdVelocityEstimate01: number;
  readonly humiliationPressure01: number;
  readonly hypePressure01: number;
}

/** Compute audience-responsive timing for a recall deployment. */
export function computeAudienceResponsiveRecallTiming(
  selection: QuoteRecallSelection,
  audienceHeat01: number,
  pressureTier: string | undefined,
  modeId: string | undefined,
): AudienceResponsiveRecallTiming {
  const strategy = getModeRecallStrategy(modeId);
  const baseDelay = selection.score01 >= 0.7 ? 1200 : 2400;
  const heatMultiplier = audienceHeat01 >= 0.7 ? 0.5 : audienceHeat01 >= 0.4 ? 0.8 : 1.4;
  const modeMultiplier = strategy.dramaticDelayMultiplier;
  const pressureMultiplier = pressureTier === 'CRITICAL' ? 0.6 : pressureTier === 'HIGH' ? 0.8 : 1.0;
  const optimalDelayMs = Math.round(baseDelay * heatMultiplier * modeMultiplier * pressureMultiplier);
  const shouldAmplify = audienceHeat01 >= strategy.audienceHeatThreshold01 && selection.score01 >= 0.55;
  const shouldSilence = audienceHeat01 < 0.1 && selection.score01 < 0.35;
  const crowdVelocity = clamp01(audienceHeat01 * 1.2 + (pressureTier === 'CRITICAL' ? 0.2 : 0));
  const humiliationPressure = clamp01(selection.score01 * audienceHeat01 * (selection.surface === 'QUOTE' ? 1.2 : 0.8));
  const hypePressure = clamp01(audienceHeat01 * 0.6 + selection.score01 * 0.4);
  return Object.freeze({
    audienceHeat01, optimalDelayMs, shouldAmplify, shouldSilence,
    crowdVelocityEstimate01: crowdVelocity,
    humiliationPressure01: humiliationPressure,
    hypePressure01: hypePressure,
  });
}

// ============================================================================
// MARK: Cross-run recall intelligence
// ============================================================================

export interface CrossRunRecallIntelligence {
  readonly playerId: string;
  readonly counterpartId: string;
  readonly totalCrossRunRecalls: number;
  readonly crossRunEffectiveness01: number;
  readonly recurringPatterns: readonly string[];
  readonly legendaryRecalls: readonly string[];
  readonly mostEffectiveKind: ChatQuoteKind;
  readonly mostEffectiveMode: QuoteRecallMode;
  readonly avgCrossRunScore01: number;
}

/** Build cross-run intelligence from bridged recall data. */
export function buildCrossRunRecallIntelligence(
  currentRunHistory: readonly RecallHistoryEntry[],
  bridgedHistory: readonly RecallHistoryEntry[],
  playerId: string,
  counterpartId: string,
): CrossRunRecallIntelligence {
  const allHistory = [...currentRunHistory, ...bridgedHistory];
  const totalRecalls = allHistory.length;
  const avgScore = totalRecalls > 0 ? allHistory.reduce((s, h) => s + h.score01, 0) / totalRecalls : 0;
  return Object.freeze({
    playerId, counterpartId,
    totalCrossRunRecalls: totalRecalls,
    crossRunEffectiveness01: avgScore,
    recurringPatterns: [],
    legendaryRecalls: allHistory.filter(h => h.score01 >= 0.85).map(h => h.selectionId),
    mostEffectiveKind: 'RECEIPT' as ChatQuoteKind,
    mostEffectiveMode: 'RIVALRY' as QuoteRecallMode,
    avgCrossRunScore01: avgScore,
  });
}

// ============================================================================
// MARK: Semantic similarity deduplication
// ============================================================================

/** Compute Jaccard similarity between two normalized text strings. */
export function computeJaccardSimilarity(a: string, b: string): number {
  const tokensA = new Set(normalizeText(a).split(/\s+/).filter(Boolean));
  const tokensB = new Set(normalizeText(b).split(/\s+/).filter(Boolean));
  if (tokensA.size === 0 && tokensB.size === 0) return 1;
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let intersection = 0;
  for (const t of tokensA) if (tokensB.has(t)) intersection++;
  return intersection / (tokensA.size + tokensB.size - intersection);
}

/** Deduplicate selections by semantic similarity threshold. */
export function deduplicateBySemanticSimilarity(
  selections: readonly QuoteRecallSelection[],
  threshold01: number = 0.65,
): readonly QuoteRecallSelection[] {
  const kept: QuoteRecallSelection[] = [];
  for (const selection of selections) {
    const isDuplicate = kept.some(existing => computeJaccardSimilarity(existing.normalizedText, selection.normalizedText) >= threshold01);
    if (!isDuplicate) kept.push(selection);
  }
  return kept;
}

// ============================================================================
// MARK: Resolution outcome tracking
// ============================================================================

export interface RecallOutcomeRecord {
  readonly outcomeId: string;
  readonly selectionId: string;
  readonly playerId: string;
  readonly counterpartId?: string;
  readonly quoteKind?: ChatQuoteKind;
  readonly callbackMode?: ChatCallbackMode;
  readonly quoteResolution?: ChatQuoteResolution;
  readonly callbackResolution?: ChatCallbackResolution;
  readonly impactPrediction: RecallImpactPrediction;
  readonly actualEffectiveness: boolean;
  readonly audienceHeatBefore01: number;
  readonly audienceHeatAfter01: number;
  readonly heatDelta01: number;
  readonly deliveredAt: number;
  readonly confirmedAt: number;
}

/** Compute heat delta from a recall outcome. */
export function computeRecallHeatDelta(before01: number, after01: number): number {
  return clamp01(after01) - clamp01(before01);
}

/** Determine if a recall outcome matched its prediction. */
export function didRecallMatchPrediction(outcome: RecallOutcomeRecord): boolean {
  if (outcome.impactPrediction === 'DEVASTATING' || outcome.impactPrediction === 'STRONG') return outcome.actualEffectiveness;
  if (outcome.impactPrediction === 'BACKFIRE') return !outcome.actualEffectiveness;
  return true;
}


// ============================================================================
// MARK: Real audit slices — 33 unique diagnostic tools
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

/** Slice 9: Per-mode recall profile diagnostics. */
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
export function buildQuoteRecallAuditSlice14(r: QuoteRecallResolver, req: QuoteRecallResolverRequest): readonly string[] { const resp = r.resolve({ ...req, maxSelections: 6 }); return ['slice=14|resolution_quote', resp.quoteResolution ? `resolved|winning=${resp.quoteResolution.winningQuoteId ?? 'none'}` : 'none']; }
export function buildQuoteRecallAuditSlice15(r: QuoteRecallResolver, req: QuoteRecallResolverRequest): readonly string[] { const resp = r.resolve({ ...req, maxSelections: 6 }); return ['slice=15|resolution_callback', resp.callbackResolution ? `resolved|mode=${resp.callbackResolution.outcome ?? 'unknown'}` : 'none']; }
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
  if (selection.mode !== 'RIVALRY' && selection.mode !== 'DEAL_ROOM') return false;
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
  if (selection.score01 >= 0.6 && selection.mode === 'RIVALRY') {
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


/** Slice 26: Impact prediction distribution. */
export function buildQuoteRecallAuditSlice26(r: QuoteRecallResolver, req: QuoteRecallResolverRequest, audienceHeat01: number): readonly string[] {
  const { impacts } = r.resolveWithImpactPredictions(req, audienceHeat01);
  const lines: string[] = ['slice=26|impact_predictions'];
  const dist = new Map<string, number>();
  for (const impact of impacts) dist.set(impact.prediction, (dist.get(impact.prediction) ?? 0) + 1);
  for (const [pred, count] of dist) lines.push(`${pred}=${count}`);
  return lines;
}

/** Slice 27: Counterpart profile summary. */
export function buildQuoteRecallAuditSlice27(r: QuoteRecallResolver, req: QuoteRecallResolverRequest): readonly string[] {
  const lines: string[] = ['slice=27|counterpart_profile'];
  if (!req.counterpartId) { lines.push('no_counterpart'); return lines; }
  const profile = r.buildCounterpartProfile(req.playerId, req.counterpartId);
  lines.push(`recalls=${profile.totalRecalls}|effective=${profile.effectiveRecalls}|rate=${profile.effectivenessRate01.toFixed(3)}`);
  lines.push(`avg=${profile.avgScore01.toFixed(3)}|peak=${profile.peakScore01.toFixed(3)}|fatigue=${profile.fatigueLevel01.toFixed(3)}`);
  lines.push(`chain_depth=${profile.activeChainDepth}`);
  return lines;
}

/** Slice 28: Mode strategy comparison. */
export function buildQuoteRecallAuditSlice28(_r: QuoteRecallResolver, _req: QuoteRecallResolverRequest): readonly string[] {
  const lines: string[] = ['slice=28|mode_strategy_comparison'];
  for (const modeId of ['GO_ALONE', 'HEAD_TO_HEAD', 'TEAM_UP', 'CHASE_A_LEGEND']) {
    const s = getModeRecallStrategy(modeId);
    lines.push(`${modeId}|maxPerMin=${s.maxRecallsPerMinute}|delay=${s.dramaticDelayMultiplier}|verbatim=${s.preferVerbatim}|chain=${s.chainDepthLimit}`);
  }
  return lines;
}

/** Slice 29: Recall budget status per mode. */
export function buildQuoteRecallAuditSlice29(r: QuoteRecallResolver, req: QuoteRecallResolverRequest): readonly string[] {
  const lines: string[] = ['slice=29|budget_status'];
  for (const modeId of ['GO_ALONE', 'HEAD_TO_HEAD', 'TEAM_UP', 'CHASE_A_LEGEND']) {
    const cfg = getModeRecallBudgetConfig(modeId);
    const remaining = req.counterpartId ? r.remainingRecallBudget(req.playerId, req.counterpartId, cfg.maxPerWindow, cfg.windowMs, req.createdAt) : cfg.maxPerWindow;
    lines.push(`${modeId}|max=${cfg.maxPerWindow}|remaining=${remaining}|cooldown=${cfg.cooldownMs}ms|fatigue_thresh=${cfg.fatigueThreshold01}`);
  }
  return lines;
}

/** Slice 30: Weaponization class distribution. */
export function buildQuoteRecallAuditSlice30(r: QuoteRecallResolver, req: QuoteRecallResolverRequest): readonly string[] {
  const resp = r.resolve({ ...req, maxSelections: 8 });
  const lines: string[] = ['slice=30|weaponization_classes'];
  for (const s of resp.selections.slice(0, 6)) {
    const kind = s.quoteKind ?? ('STATEMENT' as ChatQuoteKind);
    const wclass = classifyWeaponization(kind, req.mode);
    lines.push(`${s.selectionId}|kind=${kind}|weapon=${wclass}|score=${s.score01.toFixed(3)}`);
  }
  return lines;
}

/** Slice 31: Semantic similarity matrix (top 4 vs each other). */
export function buildQuoteRecallAuditSlice31(r: QuoteRecallResolver, req: QuoteRecallResolverRequest): readonly string[] {
  const resp = r.resolve({ ...req, maxSelections: 4 });
  const lines: string[] = ['slice=31|semantic_similarity'];
  const sels = resp.selections;
  for (let i = 0; i < sels.length; i++) {
    for (let j = i + 1; j < sels.length; j++) {
      const sim = computeJaccardSimilarity(sels[i]!.normalizedText, sels[j]!.normalizedText);
      if (sim > 0.2) lines.push(`${i}↔${j}|sim=${sim.toFixed(3)}|dup=${sim >= 0.65}`);
    }
  }
  if (lines.length === 1) lines.push('no_significant_similarity');
  return lines;
}

/** Slice 32: Full pipeline summary. */
export function buildQuoteRecallAuditSlice32(r: QuoteRecallResolver, req: QuoteRecallResolverRequest, modeId: string, audienceHeat01: number): readonly string[] {
  const pipeline = r.resolveFullPipeline(req, modeId, audienceHeat01);
  const lines: string[] = ['slice=32|full_pipeline'];
  lines.push(`selections=${pipeline.response.selections.length}|impacts=${pipeline.impacts.length}`);
  if (pipeline.timing) lines.push(`delay=${pipeline.timing.optimalDelayMs}ms|amplify=${pipeline.timing.shouldAmplify}|silence=${pipeline.timing.shouldSilence}`);
  if (pipeline.weapon) lines.push(`weapon=${pipeline.weapon.weaponClass}|mutation=${pipeline.weapon.mutationApplied}|boost=${pipeline.weapon.impactBoost01.toFixed(3)}`);
  if (pipeline.proofPackage) lines.push(`proof=${pipeline.proofPackage.packageId}|impact=${pipeline.proofPackage.impactPrediction}`);
  return lines;
}

/** Slice 33: Resolution lifecycle state summary. */
export function buildQuoteRecallAuditSlice33(r: QuoteRecallResolver, req: QuoteRecallResolverRequest): readonly string[] {
  const resp = r.resolve({ ...req, maxSelections: 6 });
  const lines: string[] = ['slice=33|resolution_lifecycle'];
  lines.push(`total=${resp.selections.length}`);
  lines.push(`has_quote_resolution=${resp.quoteResolution ? 'yes' : 'no'}`);
  lines.push(`has_callback_resolution=${resp.callbackResolution ? 'yes' : 'no'}`);
  if (resp.quoteResolution) lines.push(`quote_winning=${(resp.quoteResolution as any).winningQuoteId ?? 'none'}`);
  if (resp.callbackResolution) lines.push(`callback_mode=${(resp.callbackResolution as any).mode ?? 'none'}`);
  return lines;
}