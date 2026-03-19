/**
 * @file pzo-web/src/engines/chat/dealroom/NegotiationIntentTracker.ts
 *
 * Frontend negotiation-intent authority for DEAL_ROOM chat lanes.
 *
 * This module turns raw chat messages, offer mutations, presence theater, channel pressure,
 * prior rescue state, transcript memory, and local UI behavior into a continuously updated
 * negotiation-intent model that the rest of the chat runtime can consume.
 *
 * Design doctrine:
 * - No generic "sentiment only" reduction.
 * - Keep negotiation as a first-class chat theater lane.
 * - Model bluff, urgency, passivity, aggression, overpay risk, panic selling,
 *   manipulation attempts, leak pressure, and helper intervention demand together.
 * - Stay frontend-safe: optimistic, deterministic, replayable, inspectable.
 * - Integrate with existing chat runtime shape without requiring the backend dealroom
 *   stack to be online for every local inference.
 */

import type {
  ChatNegotiationActorArchetype,
  ChatNegotiationChannel,
  ChatNegotiationConcession,
  ChatNegotiationEscalationState,
  ChatNegotiationInference,
  ChatNegotiationIntent,
  ChatNegotiationMemoryCue,
  ChatNegotiationPressureModel,
  ChatNegotiationRescueState,
  ChatNegotiationStage,
  ChatNegotiationThread,
  ChatNegotiationTranscriptCue,
  ChatNegotiationWindow,
} from '../../../../../shared/contracts/chat/ChatNegotiation';
import type {
  ChatOffer,
  ChatOfferAnchor,
  ChatOfferDirection,
  ChatOfferExposure,
  ChatOfferGuarantee,
  ChatOfferPressureEnvelope,
  ChatOfferTerm,
  ChatOfferVersion,
} from '../../../../../shared/contracts/chat/ChatOffer';
import type { ChatChannel, ChatMessageLike, ChatRuntimeTelemetryEvent, ChatRuntimeViewModel } from '../types';

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type DealroomIntentDimension =
  | 'BLUFF'
  | 'URGENCY'
  | 'PASSIVITY'
  | 'AGGRESSION'
  | 'OVERPAY_RISK'
  | 'PANIC_SELLING'
  | 'MANIPULATION'
  | 'LEAK_RISK'
  | 'WALK_AWAY_RISK'
  | 'HELPER_DEPENDENCY';

export type DealroomIntentReasonCode =
  | 'LANGUAGE_DEADLINE'
  | 'LANGUAGE_SOFTENER'
  | 'LANGUAGE_HARDLINE'
  | 'LANGUAGE_ANCHOR'
  | 'LANGUAGE_WITHDRAWAL'
  | 'LANGUAGE_BLUFF'
  | 'LANGUAGE_PANIC'
  | 'LANGUAGE_CONTROL'
  | 'LANGUAGE_SIGNAL_LEAK'
  | 'LANGUAGE_HELPER_DEPENDENCY'
  | 'TERM_IMBALANCE'
  | 'CONCESSION_BURST'
  | 'CHANNEL_SWITCH'
  | 'READ_DELAY'
  | 'PRESENCE_STALL'
  | 'RAPID_REOFFER'
  | 'MESSAGE_DELETION_PATTERN'
  | 'RESCUE_PRESSURE'
  | 'EMBARRASSMENT_RISK'
  | 'MEMORY_CALLBACK'
  | 'PROOF_AVOIDANCE'
  | 'PROOF_OVERUSE'
  | 'COUNTER_WINDOW_STRESS'
  | 'BOSS_FIGHT_CARRYOVER'
  | 'TYPING_THEATER'
  | 'UNKNOWN';

export interface DealroomIntentReason {
  readonly code: DealroomIntentReasonCode;
  readonly weight: number;
  readonly detail: string;
  readonly evidence?: JsonValue;
}

export interface DealroomIntentScore {
  readonly dimension: DealroomIntentDimension;
  readonly score: number;
  readonly confidence: number;
  readonly direction: 'LOW' | 'MID' | 'HIGH';
  readonly reasons: readonly DealroomIntentReason[];
}

export interface DealroomIntentSnapshot {
  readonly threadId: string;
  readonly stage: ChatNegotiationStage | 'UNKNOWN';
  readonly updatedAt: number;
  readonly scores: Readonly<Record<DealroomIntentDimension, DealroomIntentScore>>;
  readonly recommendedIntent: ChatNegotiationIntent | 'OBSERVE';
  readonly recommendedEscalation: ChatNegotiationEscalationState | 'STEADY';
  readonly negotiationHealth: number;
  readonly rescueRisk: number;
  readonly leakRisk: number;
  readonly overpayRisk: number;
  readonly panicRisk: number;
  readonly manipulationRisk: number;
  readonly explanation: readonly string[];
  readonly debug: JsonValue;
}

export interface DealroomMessageSample {
  readonly id: string;
  readonly authorId: string;
  readonly authorRole?: string;
  readonly body: string;
  readonly channel?: ChatChannel | ChatNegotiationChannel | string;
  readonly sentAt: number;
  readonly metadata?: Record<string, JsonValue>;
}

export interface DealroomPresenceSample {
  readonly actorId: string;
  readonly typingStartedAt?: number;
  readonly typingStoppedAt?: number;
  readonly readAt?: number;
  readonly leftUnreadMs?: number;
  readonly hoverCount?: number;
  readonly panelReopenCount?: number;
  readonly channelSwitchCount?: number;
}

export interface DealroomTelemetrySample {
  readonly kind:
    | 'MESSAGE_SENT'
    | 'MESSAGE_FAILED'
    | 'OFFER_OPENED'
    | 'OFFER_RETRACTED'
    | 'OFFER_REVISED'
    | 'COUNTER_SELECTED'
    | 'HELPER_OPENED'
    | 'HELPER_IGNORED'
    | 'READ_RECEIPT'
    | 'THREAD_EXPOSED'
    | 'THREAD_HIDDEN'
    | 'PANEL_FLAP'
    | 'UNKNOWN';
  readonly at: number;
  readonly payload?: Record<string, JsonValue>;
}

export interface DealroomIntentTrackerConfig {
  readonly maxMessageSamples: number;
  readonly maxOfferVersions: number;
  readonly maxTelemetrySamples: number;
  readonly urgencyHalfLifeMs: number;
  readonly leakRiskAmplifier: number;
  readonly panicAmplifier: number;
  readonly manipulationAmplifier: number;
  readonly passivityDecayMs: number;
  readonly readDelayPenaltyMs: number;
  readonly helperDependencyAmplifier: number;
  readonly debug: boolean;
}

export const DEFAULT_DEALROOM_INTENT_TRACKER_CONFIG: DealroomIntentTrackerConfig = Object.freeze({
  maxMessageSamples: 240,
  maxOfferVersions: 48,
  maxTelemetrySamples: 320,
  urgencyHalfLifeMs: 90_000,
  leakRiskAmplifier: 1.18,
  panicAmplifier: 1.12,
  manipulationAmplifier: 1.16,
  passivityDecayMs: 180_000,
  readDelayPenaltyMs: 22_500,
  helperDependencyAmplifier: 1.21,
  debug: false,
});

interface DealroomThreadLedger {
  readonly threadId: string;
  stage: ChatNegotiationStage | 'UNKNOWN';
  actorArchetypes: Map<string, ChatNegotiationActorArchetype | string>;
  messages: DealroomMessageSample[];
  offers: ChatOfferVersion[];
  presence: Map<string, DealroomPresenceSample>;
  telemetry: DealroomTelemetrySample[];
  windows: ChatNegotiationWindow[];
  memoryCues: ChatNegotiationMemoryCue[];
  transcriptCues: ChatNegotiationTranscriptCue[];
  rescueState?: ChatNegotiationRescueState | null;
  pressureModel?: ChatNegotiationPressureModel | null;
  lastSnapshot?: DealroomIntentSnapshot;
  lastUpdatedAt: number;
  debugTrail: string[];
}

const DEALROOM_DIMENSIONS: readonly DealroomIntentDimension[] = Object.freeze([
  'BLUFF',
  'URGENCY',
  'PASSIVITY',
  'AGGRESSION',
  'OVERPAY_RISK',
  'PANIC_SELLING',
  'MANIPULATION',
  'LEAK_RISK',
  'WALK_AWAY_RISK',
  'HELPER_DEPENDENCY',
]);

const HARDLINE_WORDS = Object.freeze([
  'final',
  'firm',
  'non-negotiable',
  'last chance',
  'take it or leave it',
  'done here',
  'walk',
  'withdraw',
  'expiring',
  'hard stop',
] as const);

const SOFTENER_WORDS = Object.freeze([
  'maybe',
  'possibly',
  'roughly',
  'around',
  'approximately',
  'if that helps',
  'happy to discuss',
  'open to',
  'can explore',
  'not fixed',
] as const);

const BLUFF_WORDS = Object.freeze([
  'other buyer',
  'other bidders',
  'many offers',
  'not worried',
  'can sell elsewhere',
  'plenty of interest',
  'already covered',
  'no pressure on my side',
  'totally fine either way',
] as const);

const PANIC_WORDS = Object.freeze([
  'need it now',
  'right now',
  'today only',
  'cannot wait',
  'desperate',
  'please just take it',
  'i need cash',
  'i need it gone',
  'immediately',
  'any price',
] as const);

const CONTROL_WORDS = Object.freeze([
  'don\'t tell',
  'keep this quiet',
  'no screenshots',
  'between us',
  'do not share',
  'off record',
  'private only',
  'say nothing',
  'keep it hidden',
] as const);

const HELPER_DEPENDENCY_WORDS = Object.freeze([
  'what should i do',
  'is this okay',
  'can you help',
  'i don\'t know',
  'not sure what to say',
  'need advice',
  'need an out',
  'give me a line',
] as const);

function nowMs(): number {
  return Date.now();
}

function clamp01(value: number): number {
  if (Number.isNaN(value) || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function clampSigned(value: number, magnitude = 1): number {
  if (Number.isNaN(value) || !Number.isFinite(value)) return 0;
  return Math.max(-magnitude, Math.min(magnitude, value));
}

function mean(values: readonly number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sum(values: readonly number[]): number {
  return values.reduce((acc, value) => acc + value, 0);
}

function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

function toText(value: unknown): string {
  return typeof value === 'string' ? normalizeWhitespace(value.toLowerCase()) : '';
}

function includesAny(text: string, phrases: readonly string[]): string[] {
  const hits: string[] = [];
  for (const phrase of phrases) {
    if (text.includes(phrase)) hits.push(phrase);
  }
  return hits;
}

function ageDecay(ageMs: number, halfLifeMs: number): number {
  if (ageMs <= 0) return 1;
  if (halfLifeMs <= 0) return 0;
  return Math.pow(0.5, ageMs / halfLifeMs);
}

function directionOf(score: number): 'LOW' | 'MID' | 'HIGH' {
  if (score >= 0.66) return 'HIGH';
  if (score >= 0.33) return 'MID';
  return 'LOW';
}

function safeArray<T>(value: readonly T[] | undefined | null): T[] {
  return Array.isArray(value) ? [...value] : [];
}

function safeObject<T extends object>(value: T | null | undefined): T | undefined {
  return value ?? undefined;
}

function immutableRecord<T extends string, V>(keys: readonly T[], factory: (key: T) => V): Readonly<Record<T, V>> {
  return Object.freeze(
    keys.reduce((acc, key) => {
      acc[key] = factory(key);
      return acc;
    }, {} as Record<T, V>),
  );
}

function deriveRecommendedIntent(scores: Readonly<Record<DealroomIntentDimension, DealroomIntentScore>>): ChatNegotiationIntent | 'OBSERVE' {
  if (scores.PANIC_SELLING.score > 0.72) return 'SLOW_DOWN';
  if (scores.OVERPAY_RISK.score > 0.68) return 'HARD_COUNTER';
  if (scores.MANIPULATION.score > 0.65) return 'VERIFY_AND_DELAY';
  if (scores.BLUFF.score > 0.62) return 'CALL_BLUFF';
  if (scores.URGENCY.score > 0.58 && scores.AGGRESSION.score > 0.58) return 'TIME_PRESSURE_COUNTER';
  if (scores.PASSIVITY.score > 0.65) return 'PRESS_FOR_CLARITY';
  if (scores.WALK_AWAY_RISK.score > 0.7) return 'RETENTION_REFRAME';
  return 'OBSERVE';
}

function deriveEscalation(scores: Readonly<Record<DealroomIntentDimension, DealroomIntentScore>>): ChatNegotiationEscalationState | 'STEADY' {
  const hot = Math.max(
    scores.URGENCY.score,
    scores.MANIPULATION.score,
    scores.PANIC_SELLING.score,
    scores.LEAK_RISK.score,
  );
  if (hot > 0.8) return 'CRITICAL';
  if (hot > 0.62) return 'RAISED';
  if (hot > 0.42) return 'WATCHFUL';
  return 'STEADY';
}

function scoreOfferImbalance(offer: ChatOffer | ChatOfferVersion | undefined | null): number {
  if (!offer) return 0;
  const terms = safeArray((offer as { terms?: ChatOfferTerm[] }).terms);
  if (!terms.length) return 0;
  let imbalance = 0;
  for (const term of terms) {
    const label = toText((term as { label?: string }).label);
    const value = toText((term as { valueText?: string }).valueText);
    if (label.includes('exclusive') || value.includes('exclusive')) imbalance += 0.14;
    if (label.includes('refund') || value.includes('non-refundable')) imbalance += 0.18;
    if (label.includes('deadline') || value.includes('today')) imbalance += 0.13;
    if (label.includes('visibility') || value.includes('private')) imbalance += 0.12;
  }
  return clamp01(imbalance);
}

function scoreConcessionBurst(concessions: readonly ChatNegotiationConcession[] | undefined | null): number {
  const items = safeArray(concessions);
  if (items.length === 0) return 0;
  const weights = items.map((item) => {
    const label = toText((item as { label?: string }).label);
    let weight = 0.12;
    if (label.includes('price')) weight += 0.1;
    if (label.includes('deadline')) weight += 0.08;
    if (label.includes('warranty') || label.includes('guarantee')) weight += 0.09;
    return weight;
  });
  return clamp01(sum(weights));
}

export class NegotiationIntentTracker {
  private readonly config: DealroomIntentTrackerConfig;
  private readonly threads = new Map<string, DealroomThreadLedger>();

  public constructor(config: Partial<DealroomIntentTrackerConfig> = {}) {
    this.config = Object.freeze({
      ...DEFAULT_DEALROOM_INTENT_TRACKER_CONFIG,
      ...config,
    });
  }

  public hydrateThread(thread: Partial<ChatNegotiationThread> & { id: string }): DealroomThreadLedger {
    const existing = this.threads.get(thread.id);
    if (existing) {
      existing.stage = (thread.stage as ChatNegotiationStage | undefined) ?? existing.stage;
      existing.lastUpdatedAt = nowMs();
      return existing;
    }
    const created: DealroomThreadLedger = {
      threadId: thread.id,
      stage: (thread.stage as ChatNegotiationStage | undefined) ?? 'UNKNOWN',
      actorArchetypes: new Map(),
      messages: [],
      offers: [],
      presence: new Map(),
      telemetry: [],
      windows: safeArray(thread.windows as readonly ChatNegotiationWindow[] | undefined),
      memoryCues: safeArray(thread.memoryCues as readonly ChatNegotiationMemoryCue[] | undefined),
      transcriptCues: safeArray(thread.transcriptCues as readonly ChatNegotiationTranscriptCue[] | undefined),
      rescueState: (thread.rescueState as ChatNegotiationRescueState | undefined) ?? null,
      pressureModel: (thread.pressureModel as ChatNegotiationPressureModel | undefined) ?? null,
      lastUpdatedAt: nowMs(),
      debugTrail: [],
    };
    this.threads.set(thread.id, created);
    return created;
  }

  public ingestMessage(threadId: string, message: DealroomMessageSample | ChatMessageLike): DealroomIntentSnapshot {
    const ledger = this.hydrateThread({ id: threadId });
    const sample = this.normalizeMessage(message);
    ledger.messages.push(sample);
    while (ledger.messages.length > this.config.maxMessageSamples) ledger.messages.shift();
    ledger.lastUpdatedAt = nowMs();
    this.pushDebug(ledger, `message:${sample.id}:${sample.authorId}`);
    return this.recompute(threadId);
  }

  public ingestOffer(threadId: string, offer: ChatOffer | ChatOfferVersion): DealroomIntentSnapshot {
    const ledger = this.hydrateThread({ id: threadId });
    const version = this.normalizeOffer(offer);
    ledger.offers.push(version);
    while (ledger.offers.length > this.config.maxOfferVersions) ledger.offers.shift();
    ledger.lastUpdatedAt = nowMs();
    this.pushDebug(ledger, `offer:${(version as { id?: string }).id ?? 'unknown'}`);
    return this.recompute(threadId);
  }

  public ingestTelemetry(threadId: string, telemetry: DealroomTelemetrySample | ChatRuntimeTelemetryEvent): DealroomIntentSnapshot {
    const ledger = this.hydrateThread({ id: threadId });
    const sample = this.normalizeTelemetry(telemetry);
    ledger.telemetry.push(sample);
    while (ledger.telemetry.length > this.config.maxTelemetrySamples) ledger.telemetry.shift();
    ledger.lastUpdatedAt = nowMs();
    this.pushDebug(ledger, `telemetry:${sample.kind}`);
    return this.recompute(threadId);
  }

  public ingestPresence(threadId: string, presence: DealroomPresenceSample): DealroomIntentSnapshot {
    const ledger = this.hydrateThread({ id: threadId });
    ledger.presence.set(presence.actorId, presence);
    ledger.lastUpdatedAt = nowMs();
    this.pushDebug(ledger, `presence:${presence.actorId}`);
    return this.recompute(threadId);
  }

  public ingestMemoryCue(threadId: string, cue: ChatNegotiationMemoryCue): DealroomIntentSnapshot {
    const ledger = this.hydrateThread({ id: threadId });
    ledger.memoryCues = [...ledger.memoryCues, cue].slice(-64);
    ledger.lastUpdatedAt = nowMs();
    this.pushDebug(ledger, `memory:${String((cue as { type?: string }).type ?? 'unknown')}`);
    return this.recompute(threadId);
  }

  public ingestTranscriptCue(threadId: string, cue: ChatNegotiationTranscriptCue): DealroomIntentSnapshot {
    const ledger = this.hydrateThread({ id: threadId });
    ledger.transcriptCues = [...ledger.transcriptCues, cue].slice(-96);
    ledger.lastUpdatedAt = nowMs();
    this.pushDebug(ledger, `transcript:${String((cue as { type?: string }).type ?? 'unknown')}`);
    return this.recompute(threadId);
  }

  public updateRescueState(threadId: string, rescueState: ChatNegotiationRescueState | null | undefined): DealroomIntentSnapshot {
    const ledger = this.hydrateThread({ id: threadId });
    ledger.rescueState = rescueState ?? null;
    ledger.lastUpdatedAt = nowMs();
    this.pushDebug(ledger, `rescue:${rescueState ? 'active' : 'clear'}`);
    return this.recompute(threadId);
  }

  public updatePressureModel(threadId: string, pressureModel: ChatNegotiationPressureModel | null | undefined): DealroomIntentSnapshot {
    const ledger = this.hydrateThread({ id: threadId });
    ledger.pressureModel = pressureModel ?? null;
    ledger.lastUpdatedAt = nowMs();
    this.pushDebug(ledger, `pressure:${pressureModel ? 'active' : 'clear'}`);
    return this.recompute(threadId);
  }

  public getSnapshot(threadId: string): DealroomIntentSnapshot | undefined {
    return this.threads.get(threadId)?.lastSnapshot;
  }

  public listSnapshots(): readonly DealroomIntentSnapshot[] {
    return Array.from(this.threads.values())
      .map((entry) => entry.lastSnapshot)
      .filter((snapshot): snapshot is DealroomIntentSnapshot => Boolean(snapshot));
  }

  public recompute(threadId: string): DealroomIntentSnapshot {
    const ledger = this.hydrateThread({ id: threadId });
    const context = this.buildContext(ledger);

    const scores = immutableRecord(DEALROOM_DIMENSIONS, (dimension) => {
      const reasons = this.collectReasonsForDimension(dimension, context);
      const rawScore = clamp01(sum(reasons.map((reason) => reason.weight)));
      const confidence = clamp01(
        0.2 +
          Math.min(0.5, reasons.length * 0.08) +
          Math.min(0.3, context.dataRichness * 0.3),
      );
      return Object.freeze({
        dimension,
        score: rawScore,
        confidence,
        direction: directionOf(rawScore),
        reasons: Object.freeze(reasons),
      } satisfies DealroomIntentScore);
    });

    const recommendedIntent = deriveRecommendedIntent(scores);
    const recommendedEscalation = deriveEscalation(scores);
    const overpayRisk = scores.OVERPAY_RISK.score;
    const panicRisk = scores.PANIC_SELLING.score;
    const manipulationRisk = scores.MANIPULATION.score;
    const leakRisk = scores.LEAK_RISK.score;
    const rescueRisk = clamp01(
      mean([
        scores.PANIC_SELLING.score,
        scores.HELPER_DEPENDENCY.score,
        scores.WALK_AWAY_RISK.score,
      ]),
    );

    const explanation = this.buildExplanation(scores, recommendedIntent, recommendedEscalation);
    const snapshot: DealroomIntentSnapshot = Object.freeze({
      threadId: ledger.threadId,
      stage: ledger.stage,
      updatedAt: nowMs(),
      scores,
      recommendedIntent,
      recommendedEscalation,
      negotiationHealth: clamp01(1 - mean([panicRisk, manipulationRisk, leakRisk])),
      rescueRisk,
      leakRisk,
      overpayRisk,
      panicRisk,
      manipulationRisk,
      explanation,
      debug: this.config.debug
        ? {
            context,
            trail: [...ledger.debugTrail],
          }
        : {
            summary: context.summary,
            counts: context.counts,
          },
    });
    ledger.lastSnapshot = snapshot;
    return snapshot;
  }

  public projectViewModel(threadId: string, viewModel?: ChatRuntimeViewModel | null): JsonValue {
    const snapshot = this.getSnapshot(threadId) ?? this.recompute(threadId);
    return {
      threadId,
      stage: snapshot.stage,
      recommendedIntent: snapshot.recommendedIntent,
      recommendedEscalation: snapshot.recommendedEscalation,
      rescueRisk: snapshot.rescueRisk,
      leakRisk: snapshot.leakRisk,
      overpayRisk: snapshot.overpayRisk,
      panicRisk: snapshot.panicRisk,
      manipulationRisk: snapshot.manipulationRisk,
      hasViewModel: Boolean(viewModel),
      offerHints: this.buildViewHints(snapshot),
    };
  }

  private normalizeMessage(message: DealroomMessageSample | ChatMessageLike): DealroomMessageSample {
    const base = message as unknown as Record<string, unknown>;
    return Object.freeze({
      id: String(base.id ?? `${base.authorId ?? 'unknown'}:${base.sentAt ?? nowMs()}`),
      authorId: String(base.authorId ?? base.senderId ?? 'unknown'),
      authorRole: typeof base.authorRole === 'string' ? base.authorRole : undefined,
      body: typeof base.body === 'string' ? base.body : String(base.text ?? ''),
      channel: typeof base.channel === 'string' ? base.channel : undefined,
      sentAt: typeof base.sentAt === 'number' ? base.sentAt : nowMs(),
      metadata: safeObject(base.metadata as Record<string, JsonValue> | undefined),
    });
  }

  private normalizeOffer(offer: ChatOffer | ChatOfferVersion): ChatOfferVersion {
    return Object.freeze({
      ...(offer as Record<string, unknown>),
      id: String((offer as Record<string, unknown>).id ?? `offer:${nowMs()}`),
      versionId: String((offer as Record<string, unknown>).versionId ?? `version:${nowMs()}`),
    }) as ChatOfferVersion;
  }

  private normalizeTelemetry(telemetry: DealroomTelemetrySample | ChatRuntimeTelemetryEvent): DealroomTelemetrySample {
    const raw = telemetry as unknown as Record<string, unknown>;
    const kind = typeof raw.kind === 'string' ? raw.kind : typeof raw.eventName === 'string' ? raw.eventName : 'UNKNOWN';
    return Object.freeze({
      kind: kind as DealroomTelemetrySample['kind'],
      at: typeof raw.at === 'number' ? raw.at : nowMs(),
      payload: safeObject(raw.payload as Record<string, JsonValue> | undefined),
    });
  }

  private buildContext(ledger: DealroomThreadLedger) {
    const messages = ledger.messages.slice(-48);
    const offers = ledger.offers.slice(-12);
    const telemetries = ledger.telemetry.slice(-64);
    const presence = Array.from(ledger.presence.values());
    const recentTexts = messages.map((message) => toText(message.body));
    const lastOffer = offers[offers.length - 1];
    const ageWeightedTexts = recentTexts.map((text, index) => ({
      text,
      decay: ageDecay(messages.length - index, Math.max(1, messages.length / 2)),
    }));

    const wordHits = {
      hardline: ageWeightedTexts.flatMap(({ text }) => includesAny(text, HARDLINE_WORDS)),
      softener: ageWeightedTexts.flatMap(({ text }) => includesAny(text, SOFTENER_WORDS)),
      bluff: ageWeightedTexts.flatMap(({ text }) => includesAny(text, BLUFF_WORDS)),
      panic: ageWeightedTexts.flatMap(({ text }) => includesAny(text, PANIC_WORDS)),
      control: ageWeightedTexts.flatMap(({ text }) => includesAny(text, CONTROL_WORDS)),
      helperDependency: ageWeightedTexts.flatMap(({ text }) => includesAny(text, HELPER_DEPENDENCY_WORDS)),
    };

    const presenceWaits = presence.map((sample) => sample.leftUnreadMs ?? 0);
    const panelFlaps = telemetries.filter((item) => item.kind === 'PANEL_FLAP').length;
    const failedSends = telemetries.filter((item) => item.kind === 'MESSAGE_FAILED').length;
    const revisedOffers = telemetries.filter((item) => item.kind === 'OFFER_REVISED').length;
    const helperOpened = telemetries.filter((item) => item.kind === 'HELPER_OPENED').length;
    const helperIgnored = telemetries.filter((item) => item.kind === 'HELPER_IGNORED').length;
    const threadExposed = telemetries.filter((item) => item.kind === 'THREAD_EXPOSED').length;

    const dataRichness = clamp01(
      mean([
        Math.min(1, messages.length / 12),
        Math.min(1, offers.length / 4),
        Math.min(1, telemetries.length / 16),
        Math.min(1, presence.length / 4),
      ]),
    );

    return {
      messages,
      offers,
      telemetries,
      presence,
      recentTexts,
      lastOffer,
      wordHits,
      presenceWaits,
      panelFlaps,
      failedSends,
      revisedOffers,
      helperOpened,
      helperIgnored,
      threadExposed,
      dataRichness,
      offerImbalance: scoreOfferImbalance(lastOffer),
      concessionBurst: scoreConcessionBurst((lastOffer as { concessions?: ChatNegotiationConcession[] } | undefined)?.concessions),
      rescueState: ledger.rescueState,
      pressureModel: ledger.pressureModel,
      memoryCues: ledger.memoryCues.slice(-24),
      transcriptCues: ledger.transcriptCues.slice(-24),
      counts: {
        messages: messages.length,
        offers: offers.length,
        telemetries: telemetries.length,
        presence: presence.length,
      },
      summary: {
        hardlineHits: wordHits.hardline.length,
        bluffHits: wordHits.bluff.length,
        panicHits: wordHits.panic.length,
        helperDependencyHits: wordHits.helperDependency.length,
        panelFlaps,
        failedSends,
        revisedOffers,
        helperOpened,
        helperIgnored,
        threadExposed,
      },
    };
  }

  private collectReasonsForDimension(
    dimension: DealroomIntentDimension,
    context: ReturnType<NegotiationIntentTracker['buildContext']>,
  ): DealroomIntentReason[] {
    const reasons: DealroomIntentReason[] = [];
    const add = (code: DealroomIntentReasonCode, weight: number, detail: string, evidence?: JsonValue) => {
      if (weight <= 0) return;
      reasons.push({
        code,
        weight: clamp01(weight),
        detail,
        evidence,
      });
    };

    switch (dimension) {
      case 'BLUFF': {
        if (context.wordHits.bluff.length) {
          add('LANGUAGE_BLUFF', 0.28, 'Transcript contains bluff-framed scarcity language.', context.wordHits.bluff);
        }
        if ((context.revisedOffers >= 2) && (context.wordHits.hardline.length > 0)) {
          add('RAPID_REOFFER', 0.18, 'Hardline language paired with repeated offer revisions weakens credibility.', {
            revisedOffers: context.revisedOffers,
            hardlineHits: context.wordHits.hardline.length,
          });
        }
        if (context.threadExposed > 0 && context.wordHits.control.length > 0) {
          add('LANGUAGE_SIGNAL_LEAK', 0.11, 'Leak-control language paired with exposure hints suggests performative pressure.', {
            threadExposed: context.threadExposed,
          });
        }
        if (context.offerImbalance > 0.26 && context.wordHits.softener.length > 0) {
          add('TERM_IMBALANCE', 0.09, 'Soft framing may be hiding term imbalance.', {
            offerImbalance: context.offerImbalance,
          });
        }
        break;
      }

      case 'URGENCY': {
        if (context.wordHits.panic.length) {
          add('LANGUAGE_DEADLINE', 0.28, 'Deadline/panic phrasing detected.', context.wordHits.panic);
        }
        if (mean(context.presenceWaits) > this.config.readDelayPenaltyMs) {
          add('READ_DELAY', 0.16, 'High unread delay is increasing time pressure on participants.', {
            presenceWaits: context.presenceWaits,
          });
        }
        if (context.revisedOffers > 1) {
          add('RAPID_REOFFER', 0.15, 'Offer revisions are arriving in a compressed time span.', {
            revisedOffers: context.revisedOffers,
          });
        }
        if (context.pressureModel) {
          add('COUNTER_WINDOW_STRESS', 0.12, 'Pressure model signals active timing stress.', context.pressureModel as unknown as JsonValue);
        }
        break;
      }

      case 'PASSIVITY': {
        if (context.wordHits.softener.length > context.wordHits.hardline.length + 1) {
          add('LANGUAGE_SOFTENER', 0.22, 'Softener language outweighs commitment language.', context.wordHits.softener);
        }
        if (context.helperOpened > context.helperIgnored && context.wordHits.helperDependency.length > 0) {
          add('LANGUAGE_HELPER_DEPENDENCY', 0.18, 'Participant is outsourcing agency to helper prompts.', {
            helperOpened: context.helperOpened,
            helperDependencyHits: context.wordHits.helperDependency.length,
          });
        }
        if (context.panelFlaps > 1) {
          add('PRESENCE_STALL', 0.1, 'Panel flapping indicates indecision before commitment.', {
            panelFlaps: context.panelFlaps,
          });
        }
        break;
      }

      case 'AGGRESSION': {
        if (context.wordHits.hardline.length) {
          add('LANGUAGE_HARDLINE', 0.24, 'Hardline phrasing detected in transcript.', context.wordHits.hardline);
        }
        if (context.offerImbalance > 0.22) {
          add('TERM_IMBALANCE', 0.15, 'Offer structure leans toward coercive control.', {
            offerImbalance: context.offerImbalance,
          });
        }
        if (context.failedSends > 0 && context.wordHits.control.length > 0) {
          add('PROOF_AVOIDANCE', 0.1, 'Control language under messaging instability can mask escalation pressure.', {
            failedSends: context.failedSends,
          });
        }
        break;
      }

      case 'OVERPAY_RISK': {
        if (context.offerImbalance > 0.18) {
          add('TERM_IMBALANCE', 0.26, 'Offer terms indicate imbalance risk.', {
            offerImbalance: context.offerImbalance,
          });
        }
        if (context.wordHits.panic.length && context.wordHits.hardline.length) {
          add('LANGUAGE_DEADLINE', 0.16, 'Deadline pressure paired with hardline language elevates overpay risk.', {
            panicHits: context.wordHits.panic.length,
            hardlineHits: context.wordHits.hardline.length,
          });
        }
        if (context.concessionBurst > 0.18) {
          add('CONCESSION_BURST', 0.15, 'Fast concession churn can pull the counterparty above fair value.', {
            concessionBurst: context.concessionBurst,
          });
        }
        break;
      }

      case 'PANIC_SELLING': {
        if (context.wordHits.panic.length) {
          add('LANGUAGE_PANIC', 0.34 * this.config.panicAmplifier, 'Panic phrasing indicates unstable negotiation footing.', context.wordHits.panic);
        }
        if (context.failedSends > 1) {
          add('MESSAGE_DELETION_PATTERN', 0.08, 'Repeated send instability suggests flustered behavior.', {
            failedSends: context.failedSends,
          });
        }
        if (context.rescueState) {
          add('RESCUE_PRESSURE', 0.12, 'Existing rescue state amplifies panic interpretation.', context.rescueState as unknown as JsonValue);
        }
        break;
      }

      case 'MANIPULATION': {
        if (context.wordHits.control.length) {
          add('LANGUAGE_CONTROL', 0.27 * this.config.manipulationAmplifier, 'Control/secrecy language suggests manipulation attempts.', context.wordHits.control);
        }
        if (context.threadExposed > 0) {
          add('LANGUAGE_SIGNAL_LEAK', 0.13, 'Thread exposure increases social manipulation pressure.', {
            threadExposed: context.threadExposed,
          });
        }
        if (context.memoryCues.length > 0) {
          add('MEMORY_CALLBACK', 0.07, 'Callback memory can be used as a pressure tactic in negotiation.', {
            cues: context.memoryCues.length,
          });
        }
        break;
      }

      case 'LEAK_RISK': {
        if (context.wordHits.control.length) {
          add('LANGUAGE_SIGNAL_LEAK', 0.22 * this.config.leakRiskAmplifier, 'Explicit secrecy language correlates with leak-sensitive terms.', context.wordHits.control);
        }
        if (context.threadExposed > 0) {
          add('CHANNEL_SWITCH', 0.18, 'Exposure telemetry suggests leak-surface expansion.', {
            threadExposed: context.threadExposed,
          });
        }
        const exposedOffer = context.lastOffer as { exposure?: ChatOfferExposure } | undefined;
        if (exposedOffer?.exposure) {
          add('PROOF_OVERUSE', 0.09, 'Offer exposure settings imply visible spread risk.', exposedOffer.exposure as unknown as JsonValue);
        }
        break;
      }

      case 'WALK_AWAY_RISK': {
        if (context.wordHits.hardline.length && context.wordHits.softener.length === 0) {
          add('LANGUAGE_WITHDRAWAL', 0.21, 'Conversation tone is hardline without stabilizing softeners.', context.wordHits.hardline);
        }
        if (context.presenceWaits.some((ms) => ms > this.config.passivityDecayMs)) {
          add('READ_DELAY', 0.12, 'Long unread delays are increasing abandonment probability.', {
            presenceWaits: context.presenceWaits,
          });
        }
        if (context.helperIgnored > context.helperOpened) {
          add('RESCUE_PRESSURE', 0.1, 'Ignored helper interventions suggest lower attachment to keeping the thread alive.', {
            helperOpened: context.helperOpened,
            helperIgnored: context.helperIgnored,
          });
        }
        break;
      }

      case 'HELPER_DEPENDENCY': {
        if (context.wordHits.helperDependency.length) {
          add('LANGUAGE_HELPER_DEPENDENCY', 0.25 * this.config.helperDependencyAmplifier, 'Player is explicitly leaning on helper guidance.', context.wordHits.helperDependency);
        }
        if (context.helperOpened > 0) {
          add('RESCUE_PRESSURE', 0.13, 'Helper surfaces are being opened during negotiation.', {
            helperOpened: context.helperOpened,
          });
        }
        if (context.rescueState) {
          add('EMBARRASSMENT_RISK', 0.08, 'Active rescue state can push player toward helper dependence.', context.rescueState as unknown as JsonValue);
        }
        break;
      }

      default:
        add('UNKNOWN', 0.01, 'No strong evidence found; retaining low baseline for inspection.');
    }

    return reasons.sort((a, b) => b.weight - a.weight);
  }

  private buildExplanation(
    scores: Readonly<Record<DealroomIntentDimension, DealroomIntentScore>>,
    recommendedIntent: ChatNegotiationIntent | 'OBSERVE',
    recommendedEscalation: ChatNegotiationEscalationState | 'STEADY',
  ): readonly string[] {
    const lines: string[] = [];
    lines.push(`recommendedIntent=${recommendedIntent}`);
    lines.push(`recommendedEscalation=${recommendedEscalation}`);
    for (const dimension of DEALROOM_DIMENSIONS) {
      const item = scores[dimension];
      if (item.score < 0.18) continue;
      const top = item.reasons[0];
      lines.push(`${dimension}:${item.score.toFixed(2)} via ${top?.code ?? 'UNKNOWN'} (${top?.detail ?? 'no detail'})`);
    }
    if (!lines.length) lines.push('No elevated negotiation intent signals detected.');
    return Object.freeze(lines);
  }

  private buildViewHints(snapshot: DealroomIntentSnapshot): readonly string[] {
    const hints: string[] = [];
    if (snapshot.overpayRisk > 0.65) hints.push('show-overpay-warning');
    if (snapshot.leakRisk > 0.6) hints.push('hide-proof-by-default');
    if (snapshot.rescueRisk > 0.58) hints.push('arm-helper-rescue');
    if (snapshot.manipulationRisk > 0.62) hints.push('require-proof-before-send');
    if (snapshot.panicRisk > 0.64) hints.push('slow-user-send');
    return Object.freeze(hints);
  }

  private pushDebug(ledger: DealroomThreadLedger, line: string): void {
    if (!this.config.debug) return;
    ledger.debugTrail.push(`${new Date().toISOString()} ${line}`);
    if (ledger.debugTrail.length > 120) ledger.debugTrail.shift();
  }
}

export const NegotiationIntentTrackerModule = Object.freeze({
  NegotiationIntentTracker,
  DEFAULT_DEALROOM_INTENT_TRACKER_CONFIG,
  DEALROOM_DIMENSIONS,
  create(config: Partial<DealroomIntentTrackerConfig> = {}) {
    return new NegotiationIntentTracker(config);
  },
} as const);

export default NegotiationIntentTracker;
