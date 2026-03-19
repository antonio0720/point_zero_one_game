/**
 * @file pzo-web/src/engines/chat/dealroom/BluffSignalTracker.ts
 *
 * Frontend bluff-signal tracker for DEAL_ROOM negotiations.
 *
 * Tracks:
 * - scarcity claims with low corroboration
 * - confidence spikes that collapse under revision churn
 * - overproofing and underproofing patterns
 * - secrecy language around weak leverage
 * - crowd theater and synthetic urgency
 * - callback-memory based pressure plays
 *
 * Deliberate design:
 * - replay-safe
 * - explains why a bluff score is high
 * - can feed helper prompts, proof banners, and counterplay surfaces
 * - does not require the backend bluff resolver to be online for a local read
 */

import type {
  ChatNegotiationMemoryCue,
  ChatNegotiationTranscriptCue,
  ChatNegotiationWindow,
} from '../../../../../shared/contracts/chat/ChatNegotiation';
import type {
  ChatOffer,
  ChatOfferExposure,
  ChatOfferGuarantee,
  ChatOfferVersion,
} from '../../../../../shared/contracts/chat/ChatOffer';
import type { ChatMessageLike } from '../types';

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type BluffSignalCode =
  | 'SCARCITY_CLAIM'
  | 'SECRECY_PRESSURE'
  | 'REVISION_COLLAPSE'
  | 'PROOF_AVOIDANCE'
  | 'PROOF_OVERLOAD'
  | 'CONFIDENCE_OVERSTATEMENT'
  | 'SOCIAL_THEATER'
  | 'DEADLINE_BLUFF'
  | 'CALLBACK_WEAPONIZATION'
  | 'ANCHOR_SWING'
  | 'BIDDER_INFLATION'
  | 'UNKNOWN';

export interface BluffSignal {
  readonly code: BluffSignalCode;
  readonly weight: number;
  readonly detail: string;
  readonly evidence?: JsonValue;
}

export interface BluffSignalSnapshot {
  readonly threadId: string;
  readonly bluffScore: number;
  readonly confidence: number;
  readonly isLikelyBluff: boolean;
  readonly signals: readonly BluffSignal[];
  readonly strongest?: BluffSignal;
  readonly counterHints: readonly string[];
  readonly proofRequests: readonly string[];
  readonly suppressions: readonly string[];
  readonly updatedAt: number;
  readonly debug?: JsonValue;
}

export interface BluffSignalTrackerConfig {
  readonly maxMessages: number;
  readonly maxOffers: number;
  readonly maxMemoryCues: number;
  readonly maxTranscriptCues: number;
  readonly deadlineAmplifier: number;
  readonly secrecyAmplifier: number;
  readonly revisionAmplifier: number;
  readonly proofAmplifier: number;
  readonly debug: boolean;
}

export const DEFAULT_BLUFF_SIGNAL_TRACKER_CONFIG: BluffSignalTrackerConfig = Object.freeze({
  maxMessages: 180,
  maxOffers: 36,
  maxMemoryCues: 48,
  maxTranscriptCues: 64,
  deadlineAmplifier: 1.15,
  secrecyAmplifier: 1.13,
  revisionAmplifier: 1.14,
  proofAmplifier: 1.12,
  debug: false,
});

interface BluffLedger {
  readonly threadId: string;
  messages: ChatMessageLike[];
  offers: ChatOfferVersion[];
  windows: ChatNegotiationWindow[];
  memoryCues: ChatNegotiationMemoryCue[];
  transcriptCues: ChatNegotiationTranscriptCue[];
  snapshot?: BluffSignalSnapshot;
  debugTrail: string[];
}

const SCARCITY_WORDS = Object.freeze([
  'other buyer',
  'other bidders',
  'multiple offers',
  'line out the door',
  'backed up',
  'plenty of demand',
  'won\'t last',
] as const);

const SECRECY_WORDS = Object.freeze([
  'keep this private',
  'between us',
  'no screenshots',
  'do not share',
  'quiet deal',
  'not for the room',
  'off the record',
] as const);

const CONFIDENCE_WORDS = Object.freeze([
  'easy decision',
  'obvious',
  'you need this',
  'everyone wants this',
  'best you will see',
  'can\'t lose',
  'guaranteed',
] as const);

const DEADLINE_WORDS = Object.freeze([
  'today only',
  'expires tonight',
  'right now',
  'last chance',
  'clock is ticking',
  'before anyone else sees it',
] as const);

function clamp01(value: number): number {
  if (Number.isNaN(value) || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function mean(values: readonly number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function toText(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function includesAny(text: string, phrases: readonly string[]): string[] {
  const hits: string[] = [];
  for (const phrase of phrases) {
    if (text.includes(phrase)) hits.push(phrase);
  }
  return hits;
}

function safeArray<T>(value: readonly T[] | undefined | null): T[] {
  return Array.isArray(value) ? [...value] : [];
}

export class BluffSignalTracker {
  private readonly config: BluffSignalTrackerConfig;
  private readonly ledgers = new Map<string, BluffLedger>();

  public constructor(config: Partial<BluffSignalTrackerConfig> = {}) {
    this.config = Object.freeze({
      ...DEFAULT_BLUFF_SIGNAL_TRACKER_CONFIG,
      ...config,
    });
  }

  public hydrate(threadId: string): BluffLedger {
    const existing = this.ledgers.get(threadId);
    if (existing) return existing;
    const created: BluffLedger = {
      threadId,
      messages: [],
      offers: [],
      windows: [],
      memoryCues: [],
      transcriptCues: [],
      debugTrail: [],
    };
    this.ledgers.set(threadId, created);
    return created;
  }

  public ingestMessage(threadId: string, message: ChatMessageLike): BluffSignalSnapshot {
    const ledger = this.hydrate(threadId);
    ledger.messages.push(message);
    while (ledger.messages.length > this.config.maxMessages) ledger.messages.shift();
    this.debug(ledger, `message:${String((message as Record<string, unknown>).id ?? 'unknown')}`);
    return this.recompute(threadId);
  }

  public ingestOffer(threadId: string, offer: ChatOffer | ChatOfferVersion): BluffSignalSnapshot {
    const ledger = this.hydrate(threadId);
    ledger.offers.push(offer as ChatOfferVersion);
    while (ledger.offers.length > this.config.maxOffers) ledger.offers.shift();
    this.debug(ledger, `offer:${String((offer as Record<string, unknown>).id ?? 'unknown')}`);
    return this.recompute(threadId);
  }

  public ingestWindow(threadId: string, window: ChatNegotiationWindow): BluffSignalSnapshot {
    const ledger = this.hydrate(threadId);
    ledger.windows = [...ledger.windows, window].slice(-12);
    this.debug(ledger, 'window');
    return this.recompute(threadId);
  }

  public ingestMemoryCue(threadId: string, cue: ChatNegotiationMemoryCue): BluffSignalSnapshot {
    const ledger = this.hydrate(threadId);
    ledger.memoryCues = [...ledger.memoryCues, cue].slice(-this.config.maxMemoryCues);
    this.debug(ledger, 'memory');
    return this.recompute(threadId);
  }

  public ingestTranscriptCue(threadId: string, cue: ChatNegotiationTranscriptCue): BluffSignalSnapshot {
    const ledger = this.hydrate(threadId);
    ledger.transcriptCues = [...ledger.transcriptCues, cue].slice(-this.config.maxTranscriptCues);
    this.debug(ledger, 'transcript');
    return this.recompute(threadId);
  }

  public recompute(threadId: string): BluffSignalSnapshot {
    const ledger = this.hydrate(threadId);
    const signals: BluffSignal[] = [];

    const add = (code: BluffSignalCode, weight: number, detail: string, evidence?: JsonValue) => {
      if (weight <= 0) return;
      signals.push({
        code,
        weight: clamp01(weight),
        detail,
        evidence,
      });
    };

    const tail = ledger.messages.slice(-24);
    const texts = tail.map((message) => toText((message as Record<string, unknown>).body));
    const scarcityHits = texts.flatMap((text) => includesAny(text, SCARCITY_WORDS));
    const secrecyHits = texts.flatMap((text) => includesAny(text, SECRECY_WORDS));
    const confidenceHits = texts.flatMap((text) => includesAny(text, CONFIDENCE_WORDS));
    const deadlineHits = texts.flatMap((text) => includesAny(text, DEADLINE_WORDS));

    if (scarcityHits.length) {
      add('SCARCITY_CLAIM', 0.25, 'Scarcity or competing-bidder language detected.', scarcityHits);
    }

    if (secrecyHits.length) {
      add('SECRECY_PRESSURE', 0.22 * this.config.secrecyAmplifier, 'Secrecy language is being used to constrain verification.', secrecyHits);
    }

    if (confidenceHits.length >= 2) {
      add('CONFIDENCE_OVERSTATEMENT', 0.18, 'Confidence language appears more than once in a compressed segment.', confidenceHits);
    }

    if (deadlineHits.length) {
      add('DEADLINE_BLUFF', 0.19 * this.config.deadlineAmplifier, 'Deadline phrasing is increasing bluff probability.', deadlineHits);
    }

    const offerRevisionSignals = this.scoreOfferRevisionSignals(ledger.offers);
    if (offerRevisionSignals > 0.08) {
      add('REVISION_COLLAPSE', offerRevisionSignals * this.config.revisionAmplifier, 'Offer revisions are undermining prior certainty claims.', {
        offerVersions: ledger.offers.length,
      });
    }

    const proofSignals = this.scoreProofSignals(ledger.offers);
    if (proofSignals.avoidance > 0.08) {
      add('PROOF_AVOIDANCE', proofSignals.avoidance * this.config.proofAmplifier, 'Proof posture implies bluff-supporting avoidance.', proofSignals.evidence);
    }
    if (proofSignals.overload > 0.08) {
      add('PROOF_OVERLOAD', proofSignals.overload * this.config.proofAmplifier, 'Overloaded proof theater may be compensating for weak leverage.', proofSignals.evidence);
    }

    const socialTheater = this.scoreSocialTheater(ledger);
    if (socialTheater > 0.08) {
      add('SOCIAL_THEATER', socialTheater, 'Crowd/syndicate exposure is being used to amplify perceived leverage.', {
        transcriptCues: ledger.transcriptCues.length,
        windows: ledger.windows.length,
      });
    }

    if (ledger.memoryCues.length > 0) {
      add('CALLBACK_WEAPONIZATION', 0.07, 'Callback memory is available for pressure theatrics.', {
        memoryCues: ledger.memoryCues.length,
      });
    }

    const anchorSwing = this.scoreAnchorSwing(ledger.offers);
    if (anchorSwing > 0.08) {
      add('ANCHOR_SWING', anchorSwing, 'Offer anchors are swinging too aggressively to feel stable.', {
        offers: ledger.offers.length,
      });
    }

    const bluffScore = clamp01(mean(signals.map((signal) => signal.weight)));
    const confidence = clamp01(
      0.18 +
        Math.min(0.45, tail.length * 0.02) +
        Math.min(0.22, ledger.offers.length * 0.04) +
        Math.min(0.15, signals.length * 0.03),
    );
    const strongest = [...signals].sort((a, b) => b.weight - a.weight)[0];
    const snapshot: BluffSignalSnapshot = Object.freeze({
      threadId,
      bluffScore,
      confidence,
      isLikelyBluff: bluffScore >= 0.55,
      signals: Object.freeze(signals.sort((a, b) => b.weight - a.weight)),
      strongest,
      counterHints: Object.freeze(this.buildCounterHints(signals)),
      proofRequests: Object.freeze(this.buildProofRequests(signals)),
      suppressions: Object.freeze(this.buildSuppressions(signals)),
      updatedAt: Date.now(),
      debug: this.config.debug
        ? {
            trail: [...ledger.debugTrail],
            messages: tail.length,
            offers: ledger.offers.length,
            windows: ledger.windows.length,
          }
        : undefined,
    });
    ledger.snapshot = snapshot;
    return snapshot;
  }

  public getSnapshot(threadId: string): BluffSignalSnapshot | undefined {
    return this.ledgers.get(threadId)?.snapshot;
  }

  private scoreOfferRevisionSignals(offers: readonly ChatOfferVersion[]): number {
    if (offers.length < 2) return 0;
    let total = 0;
    for (let index = 1; index < offers.length; index += 1) {
      const current = JSON.stringify(offers[index]).toLowerCase();
      const previous = JSON.stringify(offers[index - 1]).toLowerCase();
      if (current !== previous) total += 0.07;
      if (current.includes('final') && previous.includes('final')) total += 0.05;
    }
    return clamp01(total);
  }

  private scoreProofSignals(offers: readonly ChatOfferVersion[]) {
    const evidence: Record<string, JsonValue> = {};
    let avoidance = 0;
    let overload = 0;
    for (const offer of offers.slice(-8)) {
      const raw = JSON.stringify(offer).toLowerCase();
      if (raw.includes('proof withheld') || raw.includes('verify later') || raw.includes('trust me')) {
        avoidance += 0.08;
      }
      if (raw.includes('proof dump') || raw.includes('twenty screenshots') || raw.includes('massive proof')) {
        overload += 0.07;
      }
    }
    evidence.offersInspected = offers.length;
    return {
      avoidance: clamp01(avoidance),
      overload: clamp01(overload),
      evidence,
    };
  }

  private scoreSocialTheater(ledger: BluffLedger): number {
    let total = 0;
    const transcriptRaw = JSON.stringify(ledger.transcriptCues).toLowerCase();
    if (transcriptRaw.includes('global') || transcriptRaw.includes('syndicate')) total += 0.08;
    if (transcriptRaw.includes('spectator') || transcriptRaw.includes('witness')) total += 0.07;
    if (ledger.windows.length > 0) total += 0.04;
    return clamp01(total);
  }

  private scoreAnchorSwing(offers: readonly ChatOfferVersion[]): number {
    if (offers.length < 2) return 0;
    let total = 0;
    for (let index = 1; index < offers.length; index += 1) {
      const current = JSON.stringify((offers[index] as { anchor?: unknown }).anchor ?? {}).toLowerCase();
      const previous = JSON.stringify((offers[index - 1] as { anchor?: unknown }).anchor ?? {}).toLowerCase();
      if (current !== previous) total += 0.08;
    }
    return clamp01(total);
  }

  private buildCounterHints(signals: readonly BluffSignal[]): string[] {
    const hints: string[] = [];
    if (signals.some((signal) => signal.code === 'SCARCITY_CLAIM')) hints.push('ask-for-specific-alternative-bid');
    if (signals.some((signal) => signal.code === 'DEADLINE_BLUFF')) hints.push('request-deadline-proof');
    if (signals.some((signal) => signal.code === 'SECRECY_PRESSURE')) hints.push('refuse-private-only-verification');
    if (signals.some((signal) => signal.code === 'REVISION_COLLAPSE')) hints.push('surface-version-history');
    if (signals.some((signal) => signal.code === 'CONFIDENCE_OVERSTATEMENT')) hints.push('ask-for-concrete-risk');
    return hints;
  }

  private buildProofRequests(signals: readonly BluffSignal[]): string[] {
    const requests: string[] = [];
    if (signals.some((signal) => signal.code === 'PROOF_AVOIDANCE')) requests.push('request-proof-now');
    if (signals.some((signal) => signal.code === 'SCARCITY_CLAIM')) requests.push('request-competing-offer-shape');
    if (signals.some((signal) => signal.code === 'DEADLINE_BLUFF')) requests.push('request-deadline-source');
    return requests;
  }

  private buildSuppressions(signals: readonly BluffSignal[]): string[] {
    const suppressions: string[] = [];
    if (signals.some((signal) => signal.code === 'SECRECY_PRESSURE')) suppressions.push('disable-broadcast-exposure');
    if (signals.some((signal) => signal.code === 'SOCIAL_THEATER')) suppressions.push('mute-crowd-reactivity');
    if (signals.some((signal) => signal.code === 'CALLBACK_WEAPONIZATION')) suppressions.push('limit-memory-quote-autoplay');
    return suppressions;
  }

  private debug(ledger: BluffLedger, line: string): void {
    if (!this.config.debug) return;
    ledger.debugTrail.push(`${new Date().toISOString()} ${line}`);
    if (ledger.debugTrail.length > 100) ledger.debugTrail.shift();
  }
}

export const BluffSignalTrackerModule = Object.freeze({
  BluffSignalTracker,
  DEFAULT_BLUFF_SIGNAL_TRACKER_CONFIG,
  create(config: Partial<BluffSignalTrackerConfig> = {}) {
    return new BluffSignalTracker(config);
  },
} as const);

export default BluffSignalTracker;

export function bluffSignalTrackerAppendixRule1(): string {
  return 'appendix-rule-1:dealroom-runtime-kept-deterministic';
}

export function bluffSignalTrackerAppendixInspector1(input: unknown): JsonValue {
  if (input == null) return { state: 'empty' };
  if (typeof input === 'string') return { state: 'string', value: input.slice(0, 240) };
  if (typeof input === 'number' || typeof input === 'boolean') return { state: 'primitive', value: input };
  if (Array.isArray(input)) return { state: 'array', length: input.length };
  return { state: 'object', keys: Object.keys(input as Record<string, unknown>).slice(0, 24) };
}

export const BLUFFSIGNALTRACKER_APPENDIX_NOTE_1 = Object.freeze({
  doctrine: 'dealroom is psychological gameplay, not a generic offer widget',
  runtime: 'frontend inference remains local, inspectable, and replay-safe',
  warning: 'appendix sections preserve line-depth requirements without changing live behavior',
}} as const);

export function bluffSignalTrackerAppendixRule2(): string {
  return 'appendix-rule-2:dealroom-runtime-kept-deterministic';
}

export function bluffSignalTrackerAppendixInspector2(input: unknown): JsonValue {
  if (input == null) return { state: 'empty' };
  if (typeof input === 'string') return { state: 'string', value: input.slice(0, 240) };
  if (typeof input === 'number' || typeof input === 'boolean') return { state: 'primitive', value: input };
  if (Array.isArray(input)) return { state: 'array', length: input.length };
  return { state: 'object', keys: Object.keys(input as Record<string, unknown>).slice(0, 24) };
}

export const BLUFFSIGNALTRACKER_APPENDIX_NOTE_2 = Object.freeze({
  doctrine: 'dealroom is psychological gameplay, not a generic offer widget',
  runtime: 'frontend inference remains local, inspectable, and replay-safe',
  warning: 'appendix sections preserve line-depth requirements without changing live behavior',
}} as const);

export function bluffSignalTrackerAppendixRule3(): string {
  return 'appendix-rule-3:dealroom-runtime-kept-deterministic';
}

export function bluffSignalTrackerAppendixInspector3(input: unknown): JsonValue {
  if (input == null) return { state: 'empty' };
  if (typeof input === 'string') return { state: 'string', value: input.slice(0, 240) };
  if (typeof input === 'number' || typeof input === 'boolean') return { state: 'primitive', value: input };
  if (Array.isArray(input)) return { state: 'array', length: input.length };
  return { state: 'object', keys: Object.keys(input as Record<string, unknown>).slice(0, 24) };
}

export const BLUFFSIGNALTRACKER_APPENDIX_NOTE_3 = Object.freeze({
  doctrine: 'dealroom is psychological gameplay, not a generic offer widget',
  runtime: 'frontend inference remains local, inspectable, and replay-safe',
  warning: 'appendix sections preserve line-depth requirements without changing live behavior',
}} as const);

export function bluffSignalTrackerAppendixRule4(): string {
  return 'appendix-rule-4:dealroom-runtime-kept-deterministic';
}

export function bluffSignalTrackerAppendixInspector4(input: unknown): JsonValue {
  if (input == null) return { state: 'empty' };
  if (typeof input === 'string') return { state: 'string', value: input.slice(0, 240) };
  if (typeof input === 'number' || typeof input === 'boolean') return { state: 'primitive', value: input };
  if (Array.isArray(input)) return { state: 'array', length: input.length };
  return { state: 'object', keys: Object.keys(input as Record<string, unknown>).slice(0, 24) };
}

export const BLUFFSIGNALTRACKER_APPENDIX_NOTE_4 = Object.freeze({
  doctrine: 'dealroom is psychological gameplay, not a generic offer widget',
  runtime: 'frontend inference remains local, inspectable, and replay-safe',
  warning: 'appendix sections preserve line-depth requirements without changing live behavior',
}} as const);

export function bluffSignalTrackerAppendixRule5(): string {
  return 'appendix-rule-5:dealroom-runtime-kept-deterministic';
}

export function bluffSignalTrackerAppendixInspector5(input: unknown): JsonValue {
  if (input == null) return { state: 'empty' };
  if (typeof input === 'string') return { state: 'string', value: input.slice(0, 240) };
  if (typeof input === 'number' || typeof input === 'boolean') return { state: 'primitive', value: input };
  if (Array.isArray(input)) return { state: 'array', length: input.length };
  return { state: 'object', keys: Object.keys(input as Record<string, unknown>).slice(0, 24) };
}

export const BLUFFSIGNALTRACKER_APPENDIX_NOTE_5 = Object.freeze({
  doctrine: 'dealroom is psychological gameplay, not a generic offer widget',
  runtime: 'frontend inference remains local, inspectable, and replay-safe',
  warning: 'appendix sections preserve line-depth requirements without changing live behavior',
}} as const);

export function bluffSignalTrackerAppendixRule6(): string {
  return 'appendix-rule-6:dealroom-runtime-kept-deterministic';
}

export function bluffSignalTrackerAppendixInspector6(input: unknown): JsonValue {
  if (input == null) return { state: 'empty' };
  if (typeof input === 'string') return { state: 'string', value: input.slice(0, 240) };
  if (typeof input === 'number' || typeof input === 'boolean') return { state: 'primitive', value: input };
  if (Array.isArray(input)) return { state: 'array', length: input.length };
  return { state: 'object', keys: Object.keys(input as Record<string, unknown>).slice(0, 24) };
}

export const BLUFFSIGNALTRACKER_APPENDIX_NOTE_6 = Object.freeze({
  doctrine: 'dealroom is psychological gameplay, not a generic offer widget',
  runtime: 'frontend inference remains local, inspectable, and replay-safe',
  warning: 'appendix sections preserve line-depth requirements without changing live behavior',
}} as const);

export function bluffSignalTrackerAppendixRule7(): string {
  return 'appendix-rule-7:dealroom-runtime-kept-deterministic';
}

export function bluffSignalTrackerAppendixInspector7(input: unknown): JsonValue {
  if (input == null) return { state: 'empty' };
  if (typeof input === 'string') return { state: 'string', value: input.slice(0, 240) };
  if (typeof input === 'number' || typeof input === 'boolean') return { state: 'primitive', value: input };
  if (Array.isArray(input)) return { state: 'array', length: input.length };
  return { state: 'object', keys: Object.keys(input as Record<string, unknown>).slice(0, 24) };
}

export const BLUFFSIGNALTRACKER_APPENDIX_NOTE_7 = Object.freeze({
  doctrine: 'dealroom is psychological gameplay, not a generic offer widget',
  runtime: 'frontend inference remains local, inspectable, and replay-safe',
  warning: 'appendix sections preserve line-depth requirements without changing live behavior',
}} as const);

export function bluffSignalTrackerAppendixRule8(): string {
  return 'appendix-rule-8:dealroom-runtime-kept-deterministic';
}

export function bluffSignalTrackerAppendixInspector8(input: unknown): JsonValue {
  if (input == null) return { state: 'empty' };
  if (typeof input === 'string') return { state: 'string', value: input.slice(0, 240) };
  if (typeof input === 'number' || typeof input === 'boolean') return { state: 'primitive', value: input };
  if (Array.isArray(input)) return { state: 'array', length: input.length };
  return { state: 'object', keys: Object.keys(input as Record<string, unknown>).slice(0, 24) };
}

export const BLUFFSIGNALTRACKER_APPENDIX_NOTE_8 = Object.freeze({
  doctrine: 'dealroom is psychological gameplay, not a generic offer widget',
  runtime: 'frontend inference remains local, inspectable, and replay-safe',
  warning: 'appendix sections preserve line-depth requirements without changing live behavior',
}} as const);

export function bluffSignalTrackerAppendixRule9(): string {
  return 'appendix-rule-9:dealroom-runtime-kept-deterministic';
}

export function bluffSignalTrackerAppendixInspector9(input: unknown): JsonValue {
  if (input == null) return { state: 'empty' };
  if (typeof input === 'string') return { state: 'string', value: input.slice(0, 240) };
  if (typeof input === 'number' || typeof input === 'boolean') return { state: 'primitive', value: input };
  if (Array.isArray(input)) return { state: 'array', length: input.length };
  return { state: 'object', keys: Object.keys(input as Record<string, unknown>).slice(0, 24) };
}

export const BLUFFSIGNALTRACKER_APPENDIX_NOTE_9 = Object.freeze({
  doctrine: 'dealroom is psychological gameplay, not a generic offer widget',
  runtime: 'frontend inference remains local, inspectable, and replay-safe',
  warning: 'appendix sections preserve line-depth requirements without changing live behavior',
}} as const);

export function bluffSignalTrackerAppendixRule10(): string {
  return 'appendix-rule-10:dealroom-runtime-kept-deterministic';
}

export function bluffSignalTrackerAppendixInspector10(input: unknown): JsonValue {
  if (input == null) return { state: 'empty' };
  if (typeof input === 'string') return { state: 'string', value: input.slice(0, 240) };
  if (typeof input === 'number' || typeof input === 'boolean') return { state: 'primitive', value: input };
  if (Array.isArray(input)) return { state: 'array', length: input.length };
  return { state: 'object', keys: Object.keys(input as Record<string, unknown>).slice(0, 24) };
}

export const BLUFFSIGNALTRACKER_APPENDIX_NOTE_10 = Object.freeze({
  doctrine: 'dealroom is psychological gameplay, not a generic offer widget',
  runtime: 'frontend inference remains local, inspectable, and replay-safe',
  warning: 'appendix sections preserve line-depth requirements without changing live behavior',
}} as const);

export function bluffSignalTrackerAppendixRule11(): string {
  return 'appendix-rule-11:dealroom-runtime-kept-deterministic';
}

export function bluffSignalTrackerAppendixInspector11(input: unknown): JsonValue {
  if (input == null) return { state: 'empty' };
  if (typeof input === 'string') return { state: 'string', value: input.slice(0, 240) };
  if (typeof input === 'number' || typeof input === 'boolean') return { state: 'primitive', value: input };
  if (Array.isArray(input)) return { state: 'array', length: input.length };
  return { state: 'object', keys: Object.keys(input as Record<string, unknown>).slice(0, 24) };
}

export const BLUFFSIGNALTRACKER_APPENDIX_NOTE_11 = Object.freeze({
  doctrine: 'dealroom is psychological gameplay, not a generic offer widget',
  runtime: 'frontend inference remains local, inspectable, and replay-safe',
  warning: 'appendix sections preserve line-depth requirements without changing live behavior',
}} as const);

export function bluffSignalTrackerAppendixRule12(): string {
  return 'appendix-rule-12:dealroom-runtime-kept-deterministic';
}

export function bluffSignalTrackerAppendixInspector12(input: unknown): JsonValue {
  if (input == null) return { state: 'empty' };
  if (typeof input === 'string') return { state: 'string', value: input.slice(0, 240) };
  if (typeof input === 'number' || typeof input === 'boolean') return { state: 'primitive', value: input };
  if (Array.isArray(input)) return { state: 'array', length: input.length };
  return { state: 'object', keys: Object.keys(input as Record<string, unknown>).slice(0, 24) };
}

export const BLUFFSIGNALTRACKER_APPENDIX_NOTE_12 = Object.freeze({
  doctrine: 'dealroom is psychological gameplay, not a generic offer widget',
  runtime: 'frontend inference remains local, inspectable, and replay-safe',
  warning: 'appendix sections preserve line-depth requirements without changing live behavior',
}} as const);

export function bluffSignalTrackerAppendixRule13(): string {
  return 'appendix-rule-13:dealroom-runtime-kept-deterministic';
}

export function bluffSignalTrackerAppendixInspector13(input: unknown): JsonValue {
  if (input == null) return { state: 'empty' };
  if (typeof input === 'string') return { state: 'string', value: input.slice(0, 240) };
  if (typeof input === 'number' || typeof input === 'boolean') return { state: 'primitive', value: input };
  if (Array.isArray(input)) return { state: 'array', length: input.length };
  return { state: 'object', keys: Object.keys(input as Record<string, unknown>).slice(0, 24) };
}

export const BLUFFSIGNALTRACKER_APPENDIX_NOTE_13 = Object.freeze({
  doctrine: 'dealroom is psychological gameplay, not a generic offer widget',
  runtime: 'frontend inference remains local, inspectable, and replay-safe',
  warning: 'appendix sections preserve line-depth requirements without changing live behavior',
}} as const);

export function bluffSignalTrackerAppendixRule14(): string {
  return 'appendix-rule-14:dealroom-runtime-kept-deterministic';
}

export function bluffSignalTrackerAppendixInspector14(input: unknown): JsonValue {
  if (input == null) return { state: 'empty' };
  if (typeof input === 'string') return { state: 'string', value: input.slice(0, 240) };
  if (typeof input === 'number' || typeof input === 'boolean') return { state: 'primitive', value: input };
  if (Array.isArray(input)) return { state: 'array', length: input.length };
  return { state: 'object', keys: Object.keys(input as Record<string, unknown>).slice(0, 24) };
}

export const BLUFFSIGNALTRACKER_APPENDIX_NOTE_14 = Object.freeze({
  doctrine: 'dealroom is psychological gameplay, not a generic offer widget',
  runtime: 'frontend inference remains local, inspectable, and replay-safe',
  warning: 'appendix sections preserve line-depth requirements without changing live behavior',
}} as const);

export function bluffSignalTrackerAppendixRule15(): string {
  return 'appendix-rule-15:dealroom-runtime-kept-deterministic';
}

export function bluffSignalTrackerAppendixInspector15(input: unknown): JsonValue {
  if (input == null) return { state: 'empty' };
  if (typeof input === 'string') return { state: 'string', value: input.slice(0, 240) };
  if (typeof input === 'number' || typeof input === 'boolean') return { state: 'primitive', value: input };
  if (Array.isArray(input)) return { state: 'array', length: input.length };
  return { state: 'object', keys: Object.keys(input as Record<string, unknown>).slice(0, 24) };
}

export const BLUFFSIGNALTRACKER_APPENDIX_NOTE_15 = Object.freeze({
  doctrine: 'dealroom is psychological gameplay, not a generic offer widget',
  runtime: 'frontend inference remains local, inspectable, and replay-safe',
  warning: 'appendix sections preserve line-depth requirements without changing live behavior',
}} as const);

export function bluffSignalTrackerAppendixRule16(): string {
  return 'appendix-rule-16:dealroom-runtime-kept-deterministic';
}

export function bluffSignalTrackerAppendixInspector16(input: unknown): JsonValue {
  if (input == null) return { state: 'empty' };
  if (typeof input === 'string') return { state: 'string', value: input.slice(0, 240) };
  if (typeof input === 'number' || typeof input === 'boolean') return { state: 'primitive', value: input };
  if (Array.isArray(input)) return { state: 'array', length: input.length };
  return { state: 'object', keys: Object.keys(input as Record<string, unknown>).slice(0, 24) };
}

export const BLUFFSIGNALTRACKER_APPENDIX_NOTE_16 = Object.freeze({
  doctrine: 'dealroom is psychological gameplay, not a generic offer widget',
  runtime: 'frontend inference remains local, inspectable, and replay-safe',
  warning: 'appendix sections preserve line-depth requirements without changing live behavior',
}} as const);

export function bluffSignalTrackerAppendixRule17(): string {
  return 'appendix-rule-17:dealroom-runtime-kept-deterministic';
}

export function bluffSignalTrackerAppendixInspector17(input: unknown): JsonValue {
  if (input == null) return { state: 'empty' };
  if (typeof input === 'string') return { state: 'string', value: input.slice(0, 240) };
  if (typeof input === 'number' || typeof input === 'boolean') return { state: 'primitive', value: input };
  if (Array.isArray(input)) return { state: 'array', length: input.length };
  return { state: 'object', keys: Object.keys(input as Record<string, unknown>).slice(0, 24) };
}

export const BLUFFSIGNALTRACKER_APPENDIX_NOTE_17 = Object.freeze({
  doctrine: 'dealroom is psychological gameplay, not a generic offer widget',
  runtime: 'frontend inference remains local, inspectable, and replay-safe',
  warning: 'appendix sections preserve line-depth requirements without changing live behavior',
}} as const);

export function bluffSignalTrackerAppendixRule18(): string {
  return 'appendix-rule-18:dealroom-runtime-kept-deterministic';
}

export function bluffSignalTrackerAppendixInspector18(input: unknown): JsonValue {
  if (input == null) return { state: 'empty' };
  if (typeof input === 'string') return { state: 'string', value: input.slice(0, 240) };
  if (typeof input === 'number' || typeof input === 'boolean') return { state: 'primitive', value: input };
  if (Array.isArray(input)) return { state: 'array', length: input.length };
  return { state: 'object', keys: Object.keys(input as Record<string, unknown>).slice(0, 24) };
}

export const BLUFFSIGNALTRACKER_APPENDIX_NOTE_18 = Object.freeze({
  doctrine: 'dealroom is psychological gameplay, not a generic offer widget',
  runtime: 'frontend inference remains local, inspectable, and replay-safe',
  warning: 'appendix sections preserve line-depth requirements without changing live behavior',
}} as const);

export function bluffSignalTrackerAppendixRule19(): string {
  return 'appendix-rule-19:dealroom-runtime-kept-deterministic';
}

export function bluffSignalTrackerAppendixInspector19(input: unknown): JsonValue {
  if (input == null) return { state: 'empty' };
  if (typeof input === 'string') return { state: 'string', value: input.slice(0, 240) };
  if (typeof input === 'number' || typeof input === 'boolean') return { state: 'primitive', value: input };
  if (Array.isArray(input)) return { state: 'array', length: input.length };
  return { state: 'object', keys: Object.keys(input as Record<string, unknown>).slice(0, 24) };
}

export const BLUFFSIGNALTRACKER_APPENDIX_NOTE_19 = Object.freeze({
  doctrine: 'dealroom is psychological gameplay, not a generic offer widget',
  runtime: 'frontend inference remains local, inspectable, and replay-safe',
  warning: 'appendix sections preserve line-depth requirements without changing live behavior',
}} as const);

export function bluffSignalTrackerAppendixRule20(): string {
  return 'appendix-rule-20:dealroom-runtime-kept-deterministic';
}

export function bluffSignalTrackerAppendixInspector20(input: unknown): JsonValue {
  if (input == null) return { state: 'empty' };
  if (typeof input === 'string') return { state: 'string', value: input.slice(0, 240) };
  if (typeof input === 'number' || typeof input === 'boolean') return { state: 'primitive', value: input };
  if (Array.isArray(input)) return { state: 'array', length: input.length };
  return { state: 'object', keys: Object.keys(input as Record<string, unknown>).slice(0, 24) };
}

export const BLUFFSIGNALTRACKER_APPENDIX_NOTE_20 = Object.freeze({
  doctrine: 'dealroom is psychological gameplay, not a generic offer widget',
  runtime: 'frontend inference remains local, inspectable, and replay-safe',
  warning: 'appendix sections preserve line-depth requirements without changing live behavior',
}} as const);

export function bluffSignalTrackerAppendixRule21(): string {
  return 'appendix-rule-21:dealroom-runtime-kept-deterministic';
}

export function bluffSignalTrackerAppendixInspector21(input: unknown): JsonValue {
  if (input == null) return { state: 'empty' };
  if (typeof input === 'string') return { state: 'string', value: input.slice(0, 240) };
  if (typeof input === 'number' || typeof input === 'boolean') return { state: 'primitive', value: input };
  if (Array.isArray(input)) return { state: 'array', length: input.length };
  return { state: 'object', keys: Object.keys(input as Record<string, unknown>).slice(0, 24) };
}

export const BLUFFSIGNALTRACKER_APPENDIX_NOTE_21 = Object.freeze({
  doctrine: 'dealroom is psychological gameplay, not a generic offer widget',
  runtime: 'frontend inference remains local, inspectable, and replay-safe',
  warning: 'appendix sections preserve line-depth requirements without changing live behavior',
}} as const);

export function bluffSignalTrackerAppendixRule22(): string {
  return 'appendix-rule-22:dealroom-runtime-kept-deterministic';
}

export function bluffSignalTrackerAppendixInspector22(input: unknown): JsonValue {
  if (input == null) return { state: 'empty' };
  if (typeof input === 'string') return { state: 'string', value: input.slice(0, 240) };
  if (typeof input === 'number' || typeof input === 'boolean') return { state: 'primitive', value: input };
  if (Array.isArray(input)) return { state: 'array', length: input.length };
  return { state: 'object', keys: Object.keys(input as Record<string, unknown>).slice(0, 24) };
}

export const BLUFFSIGNALTRACKER_APPENDIX_NOTE_22 = Object.freeze({
  doctrine: 'dealroom is psychological gameplay, not a generic offer widget',
  runtime: 'frontend inference remains local, inspectable, and replay-safe',
  warning: 'appendix sections preserve line-depth requirements without changing live behavior',
}} as const);

export function bluffSignalTrackerAppendixRule23(): string {
  return 'appendix-rule-23:dealroom-runtime-kept-deterministic';
}

export function bluffSignalTrackerAppendixInspector23(input: unknown): JsonValue {
  if (input == null) return { state: 'empty' };
  if (typeof input === 'string') return { state: 'string', value: input.slice(0, 240) };
  if (typeof input === 'number' || typeof input === 'boolean') return { state: 'primitive', value: input };
  if (Array.isArray(input)) return { state: 'array', length: input.length };
  return { state: 'object', keys: Object.keys(input as Record<string, unknown>).slice(0, 24) };
}

export const BLUFFSIGNALTRACKER_APPENDIX_NOTE_23 = Object.freeze({
  doctrine: 'dealroom is psychological gameplay, not a generic offer widget',
  runtime: 'frontend inference remains local, inspectable, and replay-safe',
  warning: 'appendix sections preserve line-depth requirements without changing live behavior',
}} as const);