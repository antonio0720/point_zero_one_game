
// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/chat/intelligence/dl/DialogueIntentEncoder.ts

/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT DL DIALOGUE INTENT ENCODER
 * FILE: pzo-web/src/engines/chat/intelligence/dl/DialogueIntentEncoder.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * This module turns raw player / NPC / system chat inputs into structured,
 * tactical intent state for the frontend chat intelligence lane.
 *
 * It is not a generic "sentiment analyzer."
 *
 * It exists because the Point Zero One chat stack is already more than a box
 * for text:
 * - channels are socially different,
 * - helpers and haters carry tactical timing,
 * - silence matters,
 * - negotiation matters,
 * - rescue timing matters,
 * - the frontend must react before backend truth returns.
 *
 * This encoder therefore combines:
 * - lexical intent heuristics,
 * - event and channel context,
 * - bridge/profile state,
 * - optional message embeddings,
 * - explainable weighting,
 * - bounded output that the UI and later DL lanes can consume immediately.
 *
 * It does NOT:
 * - replace backend intent sequencing,
 * - replace moderation,
 * - decide transcript truth,
 * - become final ranking authority.
 *
 * It DOES:
 * - prepare rich intent packets,
 * - support optimistic helper/hater pacing,
 * - shape local previews and routing,
 * - supply structured features to future response ranking clients,
 * - remain deterministic enough to replay and debug.
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ============================================================================
 */

import type {
  ChatLearningBridgePublicSnapshot,
} from '../ChatLearningBridge';

import type {
  ChatFeatureSnapshot,
  ChatLearningProfile,
  ChatMessage,
  ChatVisibleChannel,
  JsonObject,
  Nullable,
  Score01,
  UnixMs,
} from '../../types';

import {
  MessageEmbeddingClient,
  type ChatEmbeddingClientPort,
  type ChatEmbeddingInput,
  type ChatEmbeddingSimilarityResult,
  type ChatEmbeddingTelemetryPort,
  type ChatEmbeddingVectorRecord,
  buildDeterministicMessageEmbedding,
  compareEmbeddingVectors,
  createPrototypeEmbeddingBank,
} from './MessageEmbeddingClient';

/* ========================================================================== */
/* MARK: Module constants                                                     */
/* ========================================================================== */

export const CHAT_DIALOGUE_INTENT_ENCODER_MODULE_NAME =
  'PZO_CHAT_DIALOGUE_INTENT_ENCODER' as const;

export const CHAT_DIALOGUE_INTENT_ENCODER_VERSION =
  '2026.03.13-dialogue-intent-encoder.v1' as const;

export const CHAT_DIALOGUE_INTENT_ENCODER_RUNTIME_LAWS = Object.freeze([
  'Intent encoding is advisory and explainable.',
  'Lexical cues matter, but context must refine them.',
  'Embeddings may enrich intent, but cannot erase obvious signals.',
  'Channels are socially asymmetric and must influence intent fit.',
  'Helper / rescue / negotiation / taunt are first-class, not edge tags.',
  'No single keyword may dominate the final result.',
  'Silence, hesitation, and embarrassment must remain encodeable.',
  'The encoder should remain useful even without remote DL transport.',
] as const);

export const CHAT_DIALOGUE_INTENT_ENCODER_DEFAULTS = Object.freeze({
  prototypeDimensions: 192,
  topSecondaryIntentCount: 4,
  maxRecentMessages: 6,
  lexicalWeight: 0.60,
  embeddingWeight: 0.24,
  contextWeight: 0.16,
  minimumIntentConfidence01: 0.22,
  minimumSecondaryIntent01: 0.20,
  bluffEscalationThreshold: 0.56,
  rescueEscalationThreshold: 0.62,
  negotiationEscalationThreshold: 0.58,
  tauntEscalationThreshold: 0.54,
  silenceAppealThreshold: 0.66,
  helperSuitabilityThreshold: 0.58,
  haterBaitThreshold: 0.57,
  strongSimilarityThreshold: 0.72,
  weakSimilarityThreshold: 0.48,
  textPreviewChars: 220,
} as const);

/* ========================================================================== */
/* MARK: Public contracts                                                     */
/* ========================================================================== */

export type ChatDialogueIntent =
  | 'TAUNT'
  | 'COUNTERPLAY'
  | 'HELP_REQUEST'
  | 'RESCUE_SIGNAL'
  | 'NEGOTIATE'
  | 'OFFER'
  | 'BLUFF'
  | 'DE_ESCALATE'
  | 'BRAG'
  | 'RALLY'
  | 'CONFESS'
  | 'OBSERVE'
  | 'STALL'
  | 'THREAT'
  | 'PLEAD'
  | 'REPORT'
  | 'SYSTEM_ACK'
  | 'QUIET_PROCESS'
  | 'SOCIAL_REPAIR'
  | 'OTHER';

export type ChatDialogueStance =
  | 'AGGRESSIVE'
  | 'DEFENSIVE'
  | 'COOPERATIVE'
  | 'CAUTIOUS'
  | 'PREDATORY'
  | 'HUMILIATED'
  | 'COMPOSED'
  | 'DESPERATE'
  | 'UNCLEAR';

export type ChatDialogueUrgencyTier =
  | 'CALM'
  | 'RISING'
  | 'HIGH'
  | 'CRITICAL';

export interface ChatDialogueIntentTelemetryPort
  extends ChatEmbeddingTelemetryPort {}

export interface ChatDialogueIntentEncodingInput {
  readonly text?: string | null;
  readonly message?: Partial<ChatMessage> | null;
  readonly recentMessages?: readonly Partial<ChatMessage>[];
  readonly featureSnapshot?: Nullable<ChatFeatureSnapshot>;
  readonly learningProfile?: Nullable<ChatLearningProfile>;
  readonly bridgeSnapshot?: Nullable<ChatLearningBridgePublicSnapshot>;
  readonly activeChannel?: Nullable<ChatVisibleChannel>;
  readonly eventName?: string | null;
  readonly senderRole?: string | null;
  readonly senderId?: string | null;
  readonly roomId?: string | null;
  readonly modeId?: string | null;
  readonly mountTarget?: string | null;
  readonly requestId?: string | null;
  readonly metadata?: JsonObject;
}

export interface ChatDialogueIntentScores {
  readonly TAUNT: Score01;
  readonly COUNTERPLAY: Score01;
  readonly HELP_REQUEST: Score01;
  readonly RESCUE_SIGNAL: Score01;
  readonly NEGOTIATE: Score01;
  readonly OFFER: Score01;
  readonly BLUFF: Score01;
  readonly DE_ESCALATE: Score01;
  readonly BRAG: Score01;
  readonly RALLY: Score01;
  readonly CONFESS: Score01;
  readonly OBSERVE: Score01;
  readonly STALL: Score01;
  readonly THREAT: Score01;
  readonly PLEAD: Score01;
  readonly REPORT: Score01;
  readonly SYSTEM_ACK: Score01;
  readonly QUIET_PROCESS: Score01;
  readonly SOCIAL_REPAIR: Score01;
  readonly OTHER: Score01;
}

export interface ChatDialogueIntentSignals {
  readonly aggression01: Score01;
  readonly rescue01: Score01;
  readonly negotiation01: Score01;
  readonly bluff01: Score01;
  readonly embarrassment01: Score01;
  readonly confidence01: Score01;
  readonly desperation01: Score01;
  readonly trust01: Score01;
  readonly publicExposure01: Score01;
  readonly helperSuitability01: Score01;
  readonly haterBait01: Score01;
  readonly silenceNeed01: Score01;
}

export interface ChatDialogueChannelFit {
  readonly GLOBAL: Score01;
  readonly SYNDICATE: Score01;
  readonly DEAL_ROOM: Score01;
  readonly LOBBY: Score01;
}

export interface ChatDialogueIntentBreakdown {
  readonly moduleName: typeof CHAT_DIALOGUE_INTENT_ENCODER_MODULE_NAME;
  readonly moduleVersion: typeof CHAT_DIALOGUE_INTENT_ENCODER_VERSION;
  readonly lexicalScores: ChatDialogueIntentScores;
  readonly embeddingScores: ChatDialogueIntentScores;
  readonly contextualScores: ChatDialogueIntentScores;
  readonly finalScores: ChatDialogueIntentScores;
  readonly stance: ChatDialogueStance;
  readonly urgency: ChatDialogueUrgencyTier;
  readonly channelFit: ChatDialogueChannelFit;
  readonly explanation: string;
}

export interface ChatDialogueIntentEncodingResult {
  readonly requestId: string;
  readonly textPreview: string;
  readonly primaryIntent: ChatDialogueIntent;
  readonly secondaryIntents: readonly ChatDialogueIntent[];
  readonly confidence01: Score01;
  readonly stance: ChatDialogueStance;
  readonly urgency: ChatDialogueUrgencyTier;
  readonly channelFit: ChatDialogueChannelFit;
  readonly signals: ChatDialogueIntentSignals;
  readonly scores: ChatDialogueIntentScores;
  readonly embedding: Nullable<ChatEmbeddingVectorRecord>;
  readonly breakdown: ChatDialogueIntentBreakdown;
  readonly createdAtMs: UnixMs;
}

export interface ChatDialogueIntentEncoderOptions {
  readonly embeddingClient?: Nullable<ChatEmbeddingClientPort>;
  readonly telemetry?: Nullable<ChatDialogueIntentTelemetryPort>;
  readonly defaults?: Partial<typeof CHAT_DIALOGUE_INTENT_ENCODER_DEFAULTS>;
  readonly requestPrefix?: string;
  readonly prototypeBank?: Nullable<Readonly<Record<ChatDialogueIntent, readonly number[]>>>;
}

export interface ChatDialogueIntentEncoderPort {
  encode(
    input: ChatDialogueIntentEncodingInput,
  ): Promise<ChatDialogueIntentEncodingResult>;
  encodeMany(
    inputs: readonly ChatDialogueIntentEncodingInput[],
  ): Promise<readonly ChatDialogueIntentEncodingResult[]>;
}

/* ========================================================================== */
/* MARK: Internal data contracts                                              */
/* ========================================================================== */

interface LexiconRule {
  readonly pattern: RegExp;
  readonly weight: number;
  readonly intents: readonly ChatDialogueIntent[];
}

interface ContextSnapshot {
  readonly featurePressure01: Score01;
  readonly dropRisk01: Score01;
  readonly helperNeed01: Score01;
  readonly haterTolerance01: Score01;
  readonly rescueNeed01: Score01;
  readonly audienceHeat01: Score01;
  readonly confidence01: Score01;
  readonly embarrassment01: Score01;
  readonly desperation01: Score01;
  readonly trust01: Score01;
  readonly preferredChannel: ChatVisibleChannel;
  readonly activeChannel: ChatVisibleChannel;
  readonly eventName: string;
  readonly senderRole: string;
}

type ScoreAccumulator = Record<ChatDialogueIntent, number>;

/* ========================================================================== */
/* MARK: Utility helpers                                                      */
/* ========================================================================== */

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function asScore01(value: number): Score01 {
  return clamp01(value) as Score01;
}

function asUnixMs(value: number): UnixMs {
  return Math.max(0, Math.floor(Number.isFinite(value) ? value : 0)) as UnixMs;
}

function safeNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function safeString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function truncateText(text: string, maxChars: number): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, Math.max(0, maxChars - 1))}…`;
}

function average(values: readonly number[]): number {
  if (!values.length) return 0;
  let sum = 0;
  for (const value of values) sum += safeNumber(value, 0);
  return sum / values.length;
}

function coerceVisibleChannel(
  value: unknown,
  fallback: ChatVisibleChannel = 'GLOBAL',
): ChatVisibleChannel {
  if (
    value === 'GLOBAL' ||
    value === 'SYNDICATE' ||
    value === 'DEAL_ROOM' ||
    value === 'LOBBY'
  ) {
    return value;
  }

  return fallback;
}

function emptyIntentScores(): ChatDialogueIntentScores {
  return {
    TAUNT: asScore01(0),
    COUNTERPLAY: asScore01(0),
    HELP_REQUEST: asScore01(0),
    RESCUE_SIGNAL: asScore01(0),
    NEGOTIATE: asScore01(0),
    OFFER: asScore01(0),
    BLUFF: asScore01(0),
    DE_ESCALATE: asScore01(0),
    BRAG: asScore01(0),
    RALLY: asScore01(0),
    CONFESS: asScore01(0),
    OBSERVE: asScore01(0),
    STALL: asScore01(0),
    THREAT: asScore01(0),
    PLEAD: asScore01(0),
    REPORT: asScore01(0),
    SYSTEM_ACK: asScore01(0),
    QUIET_PROCESS: asScore01(0),
    SOCIAL_REPAIR: asScore01(0),
    OTHER: asScore01(0),
  };
}

function mutableIntentScores(): ScoreAccumulator {
  return {
    TAUNT: 0,
    COUNTERPLAY: 0,
    HELP_REQUEST: 0,
    RESCUE_SIGNAL: 0,
    NEGOTIATE: 0,
    OFFER: 0,
    BLUFF: 0,
    DE_ESCALATE: 0,
    BRAG: 0,
    RALLY: 0,
    CONFESS: 0,
    OBSERVE: 0,
    STALL: 0,
    THREAT: 0,
    PLEAD: 0,
    REPORT: 0,
    SYSTEM_ACK: 0,
    QUIET_PROCESS: 0,
    SOCIAL_REPAIR: 0,
    OTHER: 0,
  };
}

function freezeIntentScores(scores: ScoreAccumulator): ChatDialogueIntentScores {
  return Object.freeze({
    TAUNT: asScore01(scores.TAUNT),
    COUNTERPLAY: asScore01(scores.COUNTERPLAY),
    HELP_REQUEST: asScore01(scores.HELP_REQUEST),
    RESCUE_SIGNAL: asScore01(scores.RESCUE_SIGNAL),
    NEGOTIATE: asScore01(scores.NEGOTIATE),
    OFFER: asScore01(scores.OFFER),
    BLUFF: asScore01(scores.BLUFF),
    DE_ESCALATE: asScore01(scores.DE_ESCALATE),
    BRAG: asScore01(scores.BRAG),
    RALLY: asScore01(scores.RALLY),
    CONFESS: asScore01(scores.CONFESS),
    OBSERVE: asScore01(scores.OBSERVE),
    STALL: asScore01(scores.STALL),
    THREAT: asScore01(scores.THREAT),
    PLEAD: asScore01(scores.PLEAD),
    REPORT: asScore01(scores.REPORT),
    SYSTEM_ACK: asScore01(scores.SYSTEM_ACK),
    QUIET_PROCESS: asScore01(scores.QUIET_PROCESS),
    SOCIAL_REPAIR: asScore01(scores.SOCIAL_REPAIR),
    OTHER: asScore01(scores.OTHER),
  });
}

function addScore(
  scores: ScoreAccumulator,
  intent: ChatDialogueIntent,
  weight: number,
): void {
  scores[intent] = clamp01(scores[intent] + weight);
}

function weightedMerge(
  accum: ScoreAccumulator,
  source: ChatDialogueIntentScores,
  weight: number,
): void {
  for (const key of Object.keys(accum) as ChatDialogueIntent[]) {
    accum[key] = clamp01(accum[key] + safeNumber(source[key], 0) * weight);
  }
}

function normalizePrimaryText(
  input: ChatDialogueIntentEncodingInput,
): string {
  const message = (input.message ?? {}) as Record<string, unknown>;
  const candidate =
    safeString(input.text, '') ||
    safeString(message.body, '') ||
    safeString(message.text, '') ||
    safeString(message.content, '');

  return candidate.replace(/\s+/g, ' ').trim();
}

/* ========================================================================== */
/* MARK: Lexical rule banks                                                   */
/* ========================================================================== */

const TAUNT_RULES: readonly LexiconRule[] = Object.freeze([
  { pattern: /\btrash\b|\bgarbage\b|\bweak\b|\bcooked\b|\bpathetic\b/i, weight: 0.44, intents: ['TAUNT', 'THREAT'] },
  { pattern: /\byou can't\b|\byou cant\b|\byou won'?t\b|\byou will not\b/i, weight: 0.30, intents: ['TAUNT', 'BLUFF'] },
  { pattern: /\bloser\b|\bclown\b|\bfraud\b|\bbum\b/i, weight: 0.28, intents: ['TAUNT'] },
  { pattern: /\bowned\b|\bwashed\b|\bbody bag\b|\bfinished\b/i, weight: 0.28, intents: ['TAUNT', 'BRAG'] },
]);

const COUNTERPLAY_RULES: readonly LexiconRule[] = Object.freeze([
  { pattern: /\bhold\b|\bwait\b|\bnot yet\b|\bangle\b|\bwindow\b/i, weight: 0.28, intents: ['COUNTERPLAY', 'STALL'] },
  { pattern: /\bcounter\b|\bturn it\b|\breverse\b|\bflip this\b/i, weight: 0.42, intents: ['COUNTERPLAY'] },
  { pattern: /\bshield\b|\bproof\b|\btick\b|\btempo\b|\bpressure\b/i, weight: 0.26, intents: ['COUNTERPLAY', 'REPORT'] },
  { pattern: /\bread\b|\bbait\b|\btelegraph\b|\bpunish\b/i, weight: 0.34, intents: ['COUNTERPLAY', 'THREAT'] },
]);

const HELPER_RULES: readonly LexiconRule[] = Object.freeze([
  { pattern: /\bhelp\b|\bneed help\b|\bstuck\b|\bhow do i\b/i, weight: 0.52, intents: ['HELP_REQUEST', 'PLEAD'] },
  { pattern: /\bcan someone\b|\banyone\b|\bwhat should i do\b/i, weight: 0.34, intents: ['HELP_REQUEST'] },
  { pattern: /\bsave me\b|\brescue\b|\bi'?m cooked\b|\bi am cooked\b/i, weight: 0.54, intents: ['RESCUE_SIGNAL', 'HELP_REQUEST'] },
  { pattern: /\bi don't know\b|\bnot sure\b|\blost here\b/i, weight: 0.28, intents: ['HELP_REQUEST', 'QUIET_PROCESS'] },
]);

const NEGOTIATION_RULES: readonly LexiconRule[] = Object.freeze([
  { pattern: /\bdeal\b|\boffer\b|\btrade\b|\bprice\b|\bcost\b/i, weight: 0.46, intents: ['NEGOTIATE', 'OFFER'] },
  { pattern: /\bmy terms\b|\bcounteroffer\b|\bfinal offer\b|\bdiscount\b/i, weight: 0.42, intents: ['OFFER', 'NEGOTIATE'] },
  { pattern: /\bworth\b|\boverpay\b|\bundervalue\b|\bpremium\b/i, weight: 0.30, intents: ['NEGOTIATE', 'BLUFF'] },
  { pattern: /\bwalk away\b|\bmove on\b|\bnot interested\b/i, weight: 0.22, intents: ['NEGOTIATE', 'DE_ESCALATE'] },
]);

const BLUFF_RULES: readonly LexiconRule[] = Object.freeze([
  { pattern: /\bi already have\b|\banother buyer\b|\bother side\b/i, weight: 0.34, intents: ['BLUFF', 'NEGOTIATE'] },
  { pattern: /\blast chance\b|\bonly one\b|\bright now\b|\bclock is running\b/i, weight: 0.28, intents: ['BLUFF', 'THREAT'] },
  { pattern: /\bi know what you need\b|\bi know you're scared\b/i, weight: 0.24, intents: ['BLUFF', 'TAUNT'] },
]);

const DEESCALATE_RULES: readonly LexiconRule[] = Object.freeze([
  { pattern: /\bcalm down\b|\brelax\b|\bwe can fix\b|\bno need\b/i, weight: 0.36, intents: ['DE_ESCALATE', 'SOCIAL_REPAIR'] },
  { pattern: /\bmy fault\b|\bsorry\b|\bapolog/i, weight: 0.52, intents: ['SOCIAL_REPAIR', 'CONFESS'] },
  { pattern: /\blet's reset\b|\blets reset\b|\bstart over\b/i, weight: 0.34, intents: ['DE_ESCALATE', 'SOCIAL_REPAIR'] },
]);

const BRAG_RULES: readonly LexiconRule[] = Object.freeze([
  { pattern: /\bi told you\b|\bcalled it\b|\btoo easy\b|\blight work\b/i, weight: 0.42, intents: ['BRAG', 'TAUNT'] },
  { pattern: /\bwon\b|\bdominated\b|\bperfect\b|\bclean\b/i, weight: 0.24, intents: ['BRAG'] },
  { pattern: /\blook at that\b|\bwatch me\b|\bwatch this\b/i, weight: 0.24, intents: ['BRAG', 'RALLY'] },
]);

const RALLY_RULES: readonly LexiconRule[] = Object.freeze([
  { pattern: /\bwe got this\b|\bstay with me\b|\bpush\b|\bkeep going\b/i, weight: 0.44, intents: ['RALLY'] },
  { pattern: /\bhold the line\b|\bstay sharp\b|\bfocus\b/i, weight: 0.28, intents: ['RALLY', 'COUNTERPLAY'] },
  { pattern: /\bnow\b|\bright now\b|\bthis turn\b/i, weight: 0.18, intents: ['RALLY'] },
]);

const OBSERVE_RULES: readonly LexiconRule[] = Object.freeze([
  { pattern: /\bhmm\b|\bokay\b|\bi see\b|\bnoted\b|\bnoting\b/i, weight: 0.22, intents: ['OBSERVE'] },
  { pattern: /\bwatching\b|\bread that\b|\bi'm listening\b|\bi am listening\b/i, weight: 0.26, intents: ['OBSERVE', 'QUIET_PROCESS'] },
  { pattern: /^\.\.\.$|^…$/i, weight: 0.30, intents: ['QUIET_PROCESS', 'OBSERVE'] },
]);

const THREAT_RULES: readonly LexiconRule[] = Object.freeze([
  { pattern: /\byou're done\b|\byoure done\b|\bfinish you\b|\bend this\b/i, weight: 0.48, intents: ['THREAT', 'TAUNT'] },
  { pattern: /\bhit\b|\battack\b|\bcrush\b|\bbreak\b/i, weight: 0.30, intents: ['THREAT'] },
  { pattern: /\bno mercy\b|\bzero mercy\b|\bdelete\b/i, weight: 0.30, intents: ['THREAT'] },
]);

const PLEAD_RULES: readonly LexiconRule[] = Object.freeze([
  { pattern: /\bplease\b|\bi'm begging\b|\bi am begging\b/i, weight: 0.54, intents: ['PLEAD', 'HELP_REQUEST'] },
  { pattern: /\bdon't\b|\bdont\b|\bnot now\b|\bgive me a second\b/i, weight: 0.24, intents: ['PLEAD', 'STALL'] },
]);

const REPORT_RULES: readonly LexiconRule[] = Object.freeze([
  { pattern: /\bstatus\b|\bupdate\b|\breport\b|\bsummary\b/i, weight: 0.44, intents: ['REPORT'] },
  { pattern: /\bshield\b|\bproof\b|\breplay\b|\brisk\b|\bheat\b/i, weight: 0.22, intents: ['REPORT', 'COUNTERPLAY'] },
  { pattern: /\bobserved\b|\bdetected\b|\bflagged\b/i, weight: 0.26, intents: ['REPORT', 'OBSERVE'] },
]);

const SYSTEM_ACK_RULES: readonly LexiconRule[] = Object.freeze([
  { pattern: /\bok\b|\bokay\b|\back\b|\backnowledged\b|\bcopy\b/i, weight: 0.44, intents: ['SYSTEM_ACK'] },
  { pattern: /\bconfirmed\b|\bunderstood\b|\bgot it\b/i, weight: 0.38, intents: ['SYSTEM_ACK', 'OBSERVE'] },
]);

const QUIET_RULES: readonly LexiconRule[] = Object.freeze([
  { pattern: /^\s*$/i, weight: 0.66, intents: ['QUIET_PROCESS'] },
  { pattern: /\bthinking\b|\bgive me a minute\b|\bone sec\b|\bhold on\b/i, weight: 0.38, intents: ['QUIET_PROCESS', 'STALL'] },
  { pattern: /\bnot ready\b|\bneed a second\b|\bprocessing\b/i, weight: 0.30, intents: ['QUIET_PROCESS'] },
]);

const SOCIAL_REPAIR_RULES: readonly LexiconRule[] = Object.freeze([
  { pattern: /\bmy bad\b|\bsorry\b|\bi overreacted\b/i, weight: 0.54, intents: ['SOCIAL_REPAIR', 'CONFESS'] },
  { pattern: /\blet me fix that\b|\bmake it right\b|\bwe're good\b/i, weight: 0.32, intents: ['SOCIAL_REPAIR', 'DE_ESCALATE'] },
]);

/* ========================================================================== */
/* MARK: Prototype bank                                                       */
/* ========================================================================== */

const INTENT_PROTOTYPE_TEXT: Readonly<Record<ChatDialogueIntent, string>> = Object.freeze({
  TAUNT: 'you are weak trash cooked washed fraudulent pathetic and I want you to feel it',
  COUNTERPLAY: 'hold the window read the angle punish the bait and reverse the pressure',
  HELP_REQUEST: 'i need help i am stuck what should i do please guide me out',
  RESCUE_SIGNAL: 'save me rescue me i am collapsing and need a clean exit now',
  NEGOTIATE: 'let us discuss a deal price value and terms carefully',
  OFFER: 'this is my offer counteroffer premium value and final price terms',
  BLUFF: 'another buyer exists the clock is running and you may miss this',
  DE_ESCALATE: 'calm down reset the tone and let us cool this situation',
  BRAG: 'too easy i called it clean win perfect control dominant finish',
  RALLY: 'stay with me focus push now we can still win this turn',
  CONFESS: 'i was wrong sorry my bad i own the mistake and admit it',
  OBSERVE: 'i see watching reading listening and noting the situation carefully',
  STALL: 'hold on wait give me a second not yet delay the action',
  THREAT: 'you are done i will break this finish you and punish the mistake',
  PLEAD: 'please do not end this give me a second i am begging',
  REPORT: 'status update summary observed heat pressure shield proof and risk',
  SYSTEM_ACK: 'copy acknowledged understood confirmed ok got it',
  QUIET_PROCESS: 'thinking processing not ready one second need silence to decide',
  SOCIAL_REPAIR: 'my bad sorry let me fix that and repair the trust',
  OTHER: 'general dialogue with no single dominant tactical intent',
});

/* ========================================================================== */
/* MARK: Context extraction                                                   */
/* ========================================================================== */

function extractContextSnapshot(
  input: ChatDialogueIntentEncodingInput,
): ContextSnapshot {
  const feature = (input.featureSnapshot ?? {}) as Record<string, unknown>;
  const scalar = isRecord(feature.scalar) ? feature.scalar : {};
  const social = isRecord(feature.social) ? feature.social : {};
  const channel = isRecord(feature.channel) ? feature.channel : {};
  const affect = isRecord(feature.affect) && isRecord((feature.affect as Record<string, unknown>).vector)
    ? ((feature.affect as Record<string, unknown>).vector as Record<string, unknown>)
    : {};

  const profile = (input.learningProfile ?? {}) as Record<string, unknown>;
  const emotion = isRecord(profile.emotionBaseline) ? profile.emotionBaseline : {};
  const bridgeSession = isRecord(input.bridgeSnapshot?.session)
    ? input.bridgeSnapshot?.session as Record<string, unknown>
    : {};

  const activeChannel = coerceVisibleChannel(
    input.activeChannel ??
      channel.activeChannel ??
      bridgeSession.activeChannel,
    'GLOBAL',
  );

  return Object.freeze({
    featurePressure01: asScore01(
      safeNumber(scalar.responseUrgency01) * 0.5 +
        safeNumber(scalar.failurePressure01) * 0.5,
    ),
    dropRisk01: asScore01(
      safeNumber(scalar.dropOffRisk01) ||
        safeNumber((feature.dropOffSignals as Record<string, unknown> | undefined)?.churnPressure01),
    ),
    helperNeed01: asScore01(safeNumber(scalar.helperNeed01)),
    haterTolerance01: asScore01(safeNumber(scalar.haterTolerance01)),
    rescueNeed01: asScore01(safeNumber(scalar.rescueNeed01)),
    audienceHeat01: asScore01(safeNumber(social.audienceHeat01)),
    confidence01: asScore01(
      safeNumber(affect.confidence, safeNumber(emotion.confidence, 0)) / 100 ||
      safeNumber(scalar.confidence01, 0)
    ),
    embarrassment01: asScore01(
      safeNumber(affect.embarrassment, safeNumber(emotion.embarrassment, 0)) / 100 ||
      safeNumber((social as Record<string, unknown>).embarrassmentRisk01, 0)
    ),
    desperation01: asScore01(
      safeNumber(affect.desperation, safeNumber(emotion.desperation, 0)) / 100 ||
      safeNumber(scalar.rescueNeed01, 0)
    ),
    trust01: asScore01(
      safeNumber(affect.trust, safeNumber(emotion.trust, 0)) / 100
    ),
    preferredChannel: coerceVisibleChannel(channel.preferredChannel, activeChannel),
    activeChannel,
    eventName: safeString(input.eventName, ''),
    senderRole:
      safeString(input.senderRole, '') ||
      safeString((input.message as Record<string, unknown> | null)?.senderRole, ''),
  });
}

/* ========================================================================== */
/* MARK: Scoring helpers                                                      */
/* ========================================================================== */

function applyRules(
  text: string,
  rules: readonly LexiconRule[],
  scores: ScoreAccumulator,
): void {
  for (const rule of rules) {
    if (!rule.pattern.test(text)) continue;
    for (const intent of rule.intents) {
      addScore(scores, intent, rule.weight);
    }
  }
}

function computeLexicalScores(
  text: string,
): ChatDialogueIntentScores {
  const scores = mutableIntentScores();

  applyRules(text, TAUNT_RULES, scores);
  applyRules(text, COUNTERPLAY_RULES, scores);
  applyRules(text, HELPER_RULES, scores);
  applyRules(text, NEGOTIATION_RULES, scores);
  applyRules(text, BLUFF_RULES, scores);
  applyRules(text, DEESCALATE_RULES, scores);
  applyRules(text, BRAG_RULES, scores);
  applyRules(text, RALLY_RULES, scores);
  applyRules(text, OBSERVE_RULES, scores);
  applyRules(text, THREAT_RULES, scores);
  applyRules(text, PLEAD_RULES, scores);
  applyRules(text, REPORT_RULES, scores);
  applyRules(text, SYSTEM_ACK_RULES, scores);
  applyRules(text, QUIET_RULES, scores);
  applyRules(text, SOCIAL_REPAIR_RULES, scores);

  if (text.length === 0) {
    addScore(scores, 'QUIET_PROCESS', 0.72);
    addScore(scores, 'OBSERVE', 0.22);
  }

  if (/\?$/.test(text) || /\bhow\b|\bwhat\b|\bwhy\b|\bwhen\b/i.test(text)) {
    addScore(scores, 'HELP_REQUEST', 0.12);
    addScore(scores, 'OBSERVE', 0.08);
  }

  if (/\!/.test(text)) {
    addScore(scores, 'TAUNT', 0.06);
    addScore(scores, 'RALLY', 0.06);
    addScore(scores, 'THREAT', 0.05);
  }

  if (/\$|\bprice\b|\bvalue\b|\boffer\b/i.test(text)) {
    addScore(scores, 'NEGOTIATE', 0.14);
    addScore(scores, 'OFFER', 0.12);
  }

  if (/\bthank(s| you)?\b/i.test(text)) {
    addScore(scores, 'SOCIAL_REPAIR', 0.20);
    addScore(scores, 'DE_ESCALATE', 0.10);
  }

  const values = Object.values(scores);
  const highest = Math.max(...values, 0);

  if (highest < 0.10) {
    addScore(scores, 'OTHER', 0.44);
    addScore(scores, 'OBSERVE', 0.18);
  }

  return freezeIntentScores(scores);
}

function createEmbeddingInput(
  input: ChatDialogueIntentEncodingInput,
  text: string,
): ChatEmbeddingInput {
  return Object.freeze({
    purpose: 'INTENT',
    text,
    message: input.message ?? null,
    recentMessages: input.recentMessages,
    featureSnapshot: input.featureSnapshot ?? null,
    learningProfile: input.learningProfile ?? null,
    bridgeSnapshot: input.bridgeSnapshot ?? null,
    activeChannel: input.activeChannel ?? null,
    eventName: input.eventName ?? null,
    roomId: input.roomId ?? null,
    modeId: input.modeId ?? null,
    mountTarget: input.mountTarget ?? null,
    requestId: input.requestId ?? null,
    metadata: {
      senderRole:
        input.senderRole ??
        safeString((input.message as Record<string, unknown> | null)?.senderRole, ''),
      senderId:
        input.senderId ??
        safeString((input.message as Record<string, unknown> | null)?.senderId, ''),
      ...(input.metadata ?? {}),
    },
  });
}

function scoreAgainstPrototypeBank(
  embedding: readonly number[],
  bank: Readonly<Record<ChatDialogueIntent, readonly number[]>>,
  defaults = CHAT_DIALOGUE_INTENT_ENCODER_DEFAULTS,
): ChatDialogueIntentScores {
  const scores = mutableIntentScores();

  for (const intent of Object.keys(bank) as ChatDialogueIntent[]) {
    const similarity = compareEmbeddingVectors(embedding, bank[intent]).similarity01;
    const lifted =
      similarity >= defaults.strongSimilarityThreshold
        ? similarity
        : similarity >= defaults.weakSimilarityThreshold
        ? similarity * 0.78
        : similarity * 0.52;

    scores[intent] = lifted;
  }

  return freezeIntentScores(scores);
}

function computeContextualScores(
  text: string,
  context: ContextSnapshot,
): ChatDialogueIntentScores {
  const scores = mutableIntentScores();

  if (context.rescueNeed01 >= 0.58) {
    addScore(scores, 'RESCUE_SIGNAL', context.rescueNeed01 * 0.46);
    addScore(scores, 'HELP_REQUEST', context.helperNeed01 * 0.24);
  }

  if (context.dropRisk01 >= 0.50) {
    addScore(scores, 'QUIET_PROCESS', context.dropRisk01 * 0.24);
    addScore(scores, 'PLEAD', context.dropRisk01 * 0.16);
  }

  if (context.haterTolerance01 >= 0.60 && /!|trash|weak|done|finish/i.test(text)) {
    addScore(scores, 'TAUNT', context.haterTolerance01 * 0.22);
    addScore(scores, 'THREAT', context.haterTolerance01 * 0.18);
  }

  if (context.audienceHeat01 >= 0.56 && context.activeChannel === 'GLOBAL') {
    addScore(scores, 'RALLY', context.audienceHeat01 * 0.12);
    addScore(scores, 'BRAG', context.audienceHeat01 * 0.10);
    addScore(scores, 'TAUNT', context.audienceHeat01 * 0.10);
  }

  if (context.activeChannel === 'DEAL_ROOM') {
    addScore(scores, 'NEGOTIATE', 0.16);
    addScore(scores, 'OFFER', 0.14);

    if (/wait|not yet|later|hold/i.test(text)) {
      addScore(scores, 'STALL', 0.14);
    }
  }

  if (context.activeChannel === 'LOBBY') {
    addScore(scores, 'OBSERVE', 0.08);
    addScore(scores, 'RALLY', 0.08);
  }

  if (context.activeChannel === 'SYNDICATE') {
    addScore(scores, 'COUNTERPLAY', 0.10);
    addScore(scores, 'RALLY', 0.08);
  }

  if (context.embarrassment01 >= 0.52) {
    addScore(scores, 'SOCIAL_REPAIR', context.embarrassment01 * 0.18);
    addScore(scores, 'QUIET_PROCESS', context.embarrassment01 * 0.14);
  }

  if (context.confidence01 >= 0.56) {
    addScore(scores, 'BRAG', context.confidence01 * 0.14);
    addScore(scores, 'COUNTERPLAY', context.confidence01 * 0.10);
  }

  if (context.desperation01 >= 0.56) {
    addScore(scores, 'PLEAD', context.desperation01 * 0.22);
    addScore(scores, 'RESCUE_SIGNAL', context.desperation01 * 0.24);
    addScore(scores, 'STALL', context.desperation01 * 0.12);
  }

  if (/sorry|my bad|apolog/i.test(text) && context.trust01 < 0.48) {
    addScore(scores, 'SOCIAL_REPAIR', 0.20);
    addScore(scores, 'CONFESS', 0.16);
  }

  if (context.eventName) {
    if (/bankrupt|collapse|shield|rescue|bleed/i.test(context.eventName)) {
      addScore(scores, 'RESCUE_SIGNAL', 0.18);
      addScore(scores, 'REPORT', 0.12);
    }

    if (/deal|offer|market/i.test(context.eventName)) {
      addScore(scores, 'NEGOTIATE', 0.14);
      addScore(scores, 'OFFER', 0.10);
    }

    if (/invasion|attack|hater|predator|phantom/i.test(context.eventName)) {
      addScore(scores, 'COUNTERPLAY', 0.14);
      addScore(scores, 'THREAT', 0.10);
    }
  }

  return freezeIntentScores(scores);
}

function combineScores(
  lexical: ChatDialogueIntentScores,
  embedding: ChatDialogueIntentScores,
  contextual: ChatDialogueIntentScores,
  defaults = CHAT_DIALOGUE_INTENT_ENCODER_DEFAULTS,
): ChatDialogueIntentScores {
  const scores = mutableIntentScores();

  for (const intent of Object.keys(scores) as ChatDialogueIntent[]) {
    scores[intent] = clamp01(
      safeNumber(lexical[intent]) * defaults.lexicalWeight +
      safeNumber(embedding[intent]) * defaults.embeddingWeight +
      safeNumber(contextual[intent]) * defaults.contextWeight,
    );
  }

  return freezeIntentScores(scores);
}

function rankedIntents(
  scores: ChatDialogueIntentScores,
): readonly [ChatDialogueIntent, number][] {
  return (Object.entries(scores) as Array<[ChatDialogueIntent, number]>)
    .sort((a, b) => b[1] - a[1]);
}

function derivePrimaryIntent(
  scores: ChatDialogueIntentScores,
  defaults = CHAT_DIALOGUE_INTENT_ENCODER_DEFAULTS,
): {
  primaryIntent: ChatDialogueIntent;
  secondaryIntents: readonly ChatDialogueIntent[];
  confidence01: Score01;
} {
  const ranked = rankedIntents(scores);
  const [primaryIntent = 'OTHER', primaryScore = 0] = ranked[0] ?? [];
  const [secondIntent = 'OTHER', secondScore = 0] = ranked[1] ?? [];
  const confidence = clamp01(
    primaryScore * 0.72 + Math.max(0, primaryScore - secondScore) * 0.28,
  );

  const secondaryIntents = ranked
    .slice(1, 1 + defaults.topSecondaryIntentCount)
    .filter(([, score]) => score >= defaults.minimumSecondaryIntent01)
    .map(([intent]) => intent);

  return Object.freeze({
    primaryIntent:
      primaryScore >= defaults.minimumIntentConfidence01 ? primaryIntent : 'OTHER',
    secondaryIntents: Object.freeze(secondaryIntents),
    confidence01: asScore01(confidence),
  });
}

function deriveStance(
  primaryIntent: ChatDialogueIntent,
  scores: ChatDialogueIntentScores,
  context: ContextSnapshot,
): ChatDialogueStance {
  const aggression = average([scores.TAUNT, scores.THREAT, scores.BRAG]);
  const cooperation = average([
    scores.HELP_REQUEST,
    scores.SOCIAL_REPAIR,
    scores.DE_ESCALATE,
    context.trust01,
  ]);
  const desperation = average([scores.PLEAD, scores.RESCUE_SIGNAL, context.desperation01]);
  const caution = average([scores.OBSERVE, scores.QUIET_PROCESS, scores.STALL]);
  const predation = average([scores.BLUFF, scores.NEGOTIATE, scores.OFFER]);

  if (primaryIntent === 'RESCUE_SIGNAL' || desperation >= 0.52) return 'DESPERATE';
  if (context.embarrassment01 >= 0.58 && cooperation >= 0.34) return 'HUMILIATED';
  if (predation >= 0.46 && context.activeChannel === 'DEAL_ROOM') return 'PREDATORY';
  if (aggression >= 0.48) return 'AGGRESSIVE';
  if (cooperation >= 0.42) return 'COOPERATIVE';
  if (caution >= 0.44) return 'CAUTIOUS';
  if (context.confidence01 >= 0.58) return 'COMPOSED';
  if (aggression >= 0.24 && cooperation < 0.22) return 'DEFENSIVE';
  return 'UNCLEAR';
}

function deriveUrgency(
  scores: ChatDialogueIntentScores,
  context: ContextSnapshot,
): ChatDialogueUrgencyTier {
  const urgencyRaw = average([
    context.featurePressure01,
    context.dropRisk01,
    context.rescueNeed01,
    scores.RESCUE_SIGNAL,
    scores.THREAT,
    scores.RALLY,
  ]);

  if (urgencyRaw >= 0.72) return 'CRITICAL';
  if (urgencyRaw >= 0.54) return 'HIGH';
  if (urgencyRaw >= 0.32) return 'RISING';
  return 'CALM';
}

function deriveSignals(
  scores: ChatDialogueIntentScores,
  context: ContextSnapshot,
): ChatDialogueIntentSignals {
  const aggression01 = asScore01(
    average([scores.TAUNT, scores.THREAT, scores.BRAG, scores.BLUFF]),
  );
  const rescue01 = asScore01(
    average([scores.HELP_REQUEST, scores.RESCUE_SIGNAL, context.rescueNeed01]),
  );
  const negotiation01 = asScore01(
    average([scores.NEGOTIATE, scores.OFFER, scores.BLUFF]),
  );
  const bluff01 = asScore01(
    average([scores.BLUFF, scores.THREAT * 0.6, context.haterTolerance01 * 0.4]),
  );
  const embarrassment01 = asScore01(
    average([scores.SOCIAL_REPAIR, scores.CONFESS, context.embarrassment01]),
  );
  const confidence01 = asScore01(
    average([scores.BRAG, scores.COUNTERPLAY, context.confidence01]),
  );
  const desperation01 = asScore01(
    average([scores.PLEAD, scores.RESCUE_SIGNAL, context.desperation01]),
  );
  const trust01 = asScore01(
    average([scores.SOCIAL_REPAIR, scores.DE_ESCALATE, context.trust01]),
  );
  const publicExposure01 = asScore01(
    average([context.audienceHeat01, context.activeChannel === 'GLOBAL' ? 1 : 0]),
  );
  const helperSuitability01 = asScore01(
    average([rescue01, embarrassment01, context.helperNeed01, trust01]),
  );
  const haterBait01 = asScore01(
    average([aggression01, bluff01, context.haterTolerance01, context.audienceHeat01]),
  );
  const silenceNeed01 = asScore01(
    average([scores.QUIET_PROCESS, scores.STALL, context.dropRisk01, embarrassment01]),
  );

  return Object.freeze({
    aggression01,
    rescue01,
    negotiation01,
    bluff01,
    embarrassment01,
    confidence01,
    desperation01,
    trust01,
    publicExposure01,
    helperSuitability01,
    haterBait01,
    silenceNeed01,
  });
}

function deriveChannelFit(
  primaryIntent: ChatDialogueIntent,
  scores: ChatDialogueIntentScores,
  signals: ChatDialogueIntentSignals,
  context: ContextSnapshot,
): ChatDialogueChannelFit {
  const fit = {
    GLOBAL: 0.18,
    SYNDICATE: 0.18,
    DEAL_ROOM: 0.18,
    LOBBY: 0.18,
  };

  fit.GLOBAL += average([scores.RALLY, scores.BRAG, scores.TAUNT, context.audienceHeat01]) * 0.52;
  fit.SYNDICATE += average([scores.COUNTERPLAY, scores.OBSERVE, scores.REPORT, context.confidence01]) * 0.52;
  fit.DEAL_ROOM += average([scores.NEGOTIATE, scores.OFFER, scores.BLUFF, signals.negotiation01]) * 0.58;
  fit.LOBBY += average([scores.HELP_REQUEST, scores.RESCUE_SIGNAL, scores.QUIET_PROCESS, signals.helperSuitability01]) * 0.56;

  if (primaryIntent === 'SOCIAL_REPAIR' || signals.embarrassment01 >= 0.54) {
    fit.LOBBY += 0.10;
    fit.SYNDICATE += 0.08;
    fit.GLOBAL -= 0.06;
  }

  if (primaryIntent === 'THREAT' || primaryIntent === 'TAUNT') {
    fit.GLOBAL += 0.10;
  }

  if (context.activeChannel === 'DEAL_ROOM') {
    fit.DEAL_ROOM += 0.08;
  }

  if (context.preferredChannel === 'SYNDICATE') {
    fit.SYNDICATE += 0.06;
  }

  return Object.freeze({
    GLOBAL: asScore01(fit.GLOBAL),
    SYNDICATE: asScore01(fit.SYNDICATE),
    DEAL_ROOM: asScore01(fit.DEAL_ROOM),
    LOBBY: asScore01(fit.LOBBY),
  });
}

function buildExplanation(
  primaryIntent: ChatDialogueIntent,
  secondaryIntents: readonly ChatDialogueIntent[],
  confidence01: Score01,
  stance: ChatDialogueStance,
  urgency: ChatDialogueUrgencyTier,
  signals: ChatDialogueIntentSignals,
  channelFit: ChatDialogueChannelFit,
): string {
  const topChannel = (Object.entries(channelFit) as Array<[ChatVisibleChannel, number]>)
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'GLOBAL';

  return [
    `primary:${primaryIntent}`,
    secondaryIntents.length ? `secondary:${secondaryIntents.join(',')}` : 'secondary:none',
    `confidence:${confidence01.toFixed(2)}`,
    `stance:${stance}`,
    `urgency:${urgency}`,
    `topChannel:${topChannel}`,
    `rescue:${signals.rescue01.toFixed(2)}`,
    `bluff:${signals.bluff01.toFixed(2)}`,
    `bait:${signals.haterBait01.toFixed(2)}`,
    `silence:${signals.silenceNeed01.toFixed(2)}`,
  ].join(' | ');
}

/* ========================================================================== */
/* MARK: Encoder implementation                                               */
/* ========================================================================== */

export class DialogueIntentEncoder implements ChatDialogueIntentEncoderPort {
  private readonly embeddingClient: ChatEmbeddingClientPort;
  private readonly telemetry: ChatDialogueIntentTelemetryPort;
  private readonly defaults: typeof CHAT_DIALOGUE_INTENT_ENCODER_DEFAULTS;
  private readonly requestPrefix: string;
  private readonly prototypeBank: Readonly<Record<ChatDialogueIntent, readonly number[]>>;

  private requestCounter = 0;

  constructor(options: ChatDialogueIntentEncoderOptions = {}) {
    this.embeddingClient =
      options.embeddingClient ??
      new MessageEmbeddingClient({
        telemetry: options.telemetry ?? null,
        defaults: {
          vectorDimensions:
            options.defaults?.prototypeDimensions ??
            CHAT_DIALOGUE_INTENT_ENCODER_DEFAULTS.prototypeDimensions,
        },
      });

    this.telemetry = options.telemetry ?? {};
    this.defaults = Object.freeze({
      ...CHAT_DIALOGUE_INTENT_ENCODER_DEFAULTS,
      ...(options.defaults ?? {}),
    });
    this.requestPrefix = options.requestPrefix ?? 'pzo-dialogue-intent';
    this.prototypeBank =
      options.prototypeBank ??
      createPrototypeEmbeddingBank(
        Object.fromEntries(
          (Object.keys(INTENT_PROTOTYPE_TEXT) as ChatDialogueIntent[]).map((intent) => [
            intent,
            {
              purpose: 'INTENT',
              text: INTENT_PROTOTYPE_TEXT[intent],
              eventName: `PROTOTYPE:${intent}`,
              activeChannel: intent === 'NEGOTIATE' || intent === 'OFFER' || intent === 'BLUFF'
                ? 'DEAL_ROOM'
                : intent === 'HELP_REQUEST' || intent === 'RESCUE_SIGNAL' || intent === 'QUIET_PROCESS'
                ? 'LOBBY'
                : intent === 'COUNTERPLAY' || intent === 'REPORT'
                ? 'SYNDICATE'
                : 'GLOBAL',
            } satisfies ChatEmbeddingInput,
          ]),
        ) as Record<ChatDialogueIntent, ChatEmbeddingInput>,
        this.defaults.prototypeDimensions,
      );
  }

  public async encodeMany(
    inputs: readonly ChatDialogueIntentEncodingInput[],
  ): Promise<readonly ChatDialogueIntentEncodingResult[]> {
    return Promise.all(inputs.map((input) => this.encode(input)));
  }

  public async encode(
    input: ChatDialogueIntentEncodingInput,
  ): Promise<ChatDialogueIntentEncodingResult> {
    const startedAt = Date.now();
    const requestId = input.requestId ?? this.nextRequestId();
    const text = normalizePrimaryText(input);
    const context = extractContextSnapshot(input);

    this.telemetry.captureInferenceRequested?.(
      'pzo-dialogue-intent-frontline-v1',
      'INTENT_ENCODING',
      `request:${requestId}|text:${truncateText(text, 80)}`,
    );

    const lexicalScores = computeLexicalScores(text);
    const embeddingRecord = await this.embeddingClient.embed(
      createEmbeddingInput(input, text),
    );
    const embeddingScores = scoreAgainstPrototypeBank(
      embeddingRecord.vector,
      this.prototypeBank,
      this.defaults,
    );
    const contextualScores = computeContextualScores(text, context);
    const finalScores = combineScores(
      lexicalScores,
      embeddingScores,
      contextualScores,
      this.defaults,
    );

    const { primaryIntent, secondaryIntents, confidence01 } = derivePrimaryIntent(
      finalScores,
      this.defaults,
    );
    const stance = deriveStance(primaryIntent, finalScores, context);
    const urgency = deriveUrgency(finalScores, context);
    const signals = deriveSignals(finalScores, context);
    const channelFit = deriveChannelFit(
      primaryIntent,
      finalScores,
      signals,
      context,
    );

    const explanation = buildExplanation(
      primaryIntent,
      secondaryIntents,
      confidence01,
      stance,
      urgency,
      signals,
      channelFit,
    );

    const breakdown: ChatDialogueIntentBreakdown = Object.freeze({
      moduleName: CHAT_DIALOGUE_INTENT_ENCODER_MODULE_NAME,
      moduleVersion: CHAT_DIALOGUE_INTENT_ENCODER_VERSION,
      lexicalScores,
      embeddingScores,
      contextualScores,
      finalScores,
      stance,
      urgency,
      channelFit,
      explanation,
    });

    const result: ChatDialogueIntentEncodingResult = Object.freeze({
      requestId,
      textPreview: truncateText(text, this.defaults.textPreviewChars),
      primaryIntent,
      secondaryIntents,
      confidence01,
      stance,
      urgency,
      channelFit,
      signals,
      scores: finalScores,
      embedding: embeddingRecord,
      breakdown,
      createdAtMs: asUnixMs(Date.now()),
    });

    this.telemetry.captureInferenceCompleted?.(
      'pzo-dialogue-intent-frontline-v1',
      'INTENT_ENCODING',
      Math.max(0, Date.now() - startedAt),
      explanation,
    );

    return result;
  }

  private nextRequestId(): string {
    this.requestCounter += 1;
    return `${this.requestPrefix}:${this.requestCounter}`;
  }
}

/* ========================================================================== */
/* MARK: Free helpers                                                         */
/* ========================================================================== */

export function createDialogueIntentEncoder(
  options: ChatDialogueIntentEncoderOptions = {},
): DialogueIntentEncoder {
  return new DialogueIntentEncoder(options);
}

export function createDialogueIntentInput(
  input: ChatDialogueIntentEncodingInput,
): ChatDialogueIntentEncodingInput {
  return Object.freeze({ ...input });
}

export function buildDialogueIntentPrototypeBank(
  dimensions = CHAT_DIALOGUE_INTENT_ENCODER_DEFAULTS.prototypeDimensions,
): Readonly<Record<ChatDialogueIntent, readonly number[]>> {
  return createPrototypeEmbeddingBank(
    Object.fromEntries(
      (Object.keys(INTENT_PROTOTYPE_TEXT) as ChatDialogueIntent[]).map((intent) => [
        intent,
        {
          purpose: 'INTENT',
          text: INTENT_PROTOTYPE_TEXT[intent],
          eventName: `PROTOTYPE:${intent}`,
        } satisfies ChatEmbeddingInput,
      ]),
    ) as Record<ChatDialogueIntent, ChatEmbeddingInput>,
    dimensions,
  );
}

export function encodeDialogueIntentLexically(
  text: string,
): ChatDialogueIntentScores {
  return computeLexicalScores(text);
}

export function encodeDialogueIntentContextually(
  input: ChatDialogueIntentEncodingInput,
): ChatDialogueIntentScores {
  const text = normalizePrimaryText(input);
  const context = extractContextSnapshot(input);
  return computeContextualScores(text, context);
}

export async function encodeDialogueIntentWithDeterministicEmbedding(
  input: ChatDialogueIntentEncodingInput,
  options: Partial<ChatDialogueIntentEncoderOptions> = {},
): Promise<ChatDialogueIntentEncodingResult> {
  const embeddingVector = buildDeterministicMessageEmbedding(
    createEmbeddingInput(input, normalizePrimaryText(input)),
    options.defaults?.prototypeDimensions ??
      CHAT_DIALOGUE_INTENT_ENCODER_DEFAULTS.prototypeDimensions,
  );

  const encoder = new DialogueIntentEncoder({
    ...options,
    embeddingClient: {
      embed: async (): Promise<ChatEmbeddingVectorRecord> =>
        Object.freeze({
          requestId: input.requestId ?? 'deterministic-intent',
          cacheKey: `deterministic:${normalizePrimaryText(input).length}`,
          source: 'LOCAL_DETERMINISTIC',
          model: 'deterministic-intent-local',
          purpose: 'INTENT',
          dimensions: embeddingVector.length,
          vector: embeddingVector,
          magnitude: 1,
          normalized: true,
          createdAtMs: asUnixMs(Date.now()),
          durationMs: 0,
          previewText: truncateText(normalizePrimaryText(input), 140),
          contextSummary: '',
          diagnostics: Object.freeze({ path: 'deterministic' }),
        }),
      embedBatch: async (): Promise<any> => {
        throw new Error('Not implemented in deterministic helper.');
      },
      similarity: compareEmbeddingVectors,
      getPublicSnapshot: (): any => Object.freeze({
        moduleName: 'deterministic-intent-client',
        moduleVersion: '1',
        model: 'deterministic-intent-local',
        queueDepth: 0,
        cacheSize: 0,
        coalescedInflightCount: 0,
        totals: Object.freeze({
          requests: 0,
          batches: 0,
          cacheHits: 0,
          remoteCalls: 0,
          remoteFailures: 0,
          fallbackCalls: 1,
        }),
      }),
    },
  });

  return encoder.encode(input);
}

/* ========================================================================== */
/* MARK: Manifest                                                             */
/* ========================================================================== */

export const CHAT_DIALOGUE_INTENT_ENCODER_MANIFEST = Object.freeze({
  moduleName: CHAT_DIALOGUE_INTENT_ENCODER_MODULE_NAME,
  version: CHAT_DIALOGUE_INTENT_ENCODER_VERSION,
  defaults: CHAT_DIALOGUE_INTENT_ENCODER_DEFAULTS,
  runtimeLaws: CHAT_DIALOGUE_INTENT_ENCODER_RUNTIME_LAWS,
  capabilities: Object.freeze({
    lexicalIntent: true,
    contextualIntent: true,
    embeddingEnrichment: true,
    channelFit: true,
    helperSuitability: true,
    bluffSignal: true,
    rescueSignal: true,
    silenceNeed: true,
  }),
} as const);

export const ChatDialogueIntent = Object.freeze({
  DialogueIntentEncoder,
  createDialogueIntentEncoder,
  createDialogueIntentInput,
  buildDialogueIntentPrototypeBank,
  encodeDialogueIntentLexically,
  encodeDialogueIntentContextually,
  encodeDialogueIntentWithDeterministicEmbedding,
  manifest: CHAT_DIALOGUE_INTENT_ENCODER_MANIFEST,
} as const);

export type ChatDialogueIntentEncoderManifest =
  typeof CHAT_DIALOGUE_INTENT_ENCODER_MANIFEST;
