/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT MODERATION POLICY
 * FILE: backend/src/game/engine/chat/ChatModerationPolicy.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical backend moderation law for the authoritative chat simulation lane.
 *
 * This file does not exist to perform shallow profanity filtering. It exists to
 * answer the backend-truth question:
 *
 *   "What content is allowed to become authoritative chat history now, in this
 *    room, from this actor, with this risk profile, under this runtime?"
 *
 * Architectural law
 * -----------------
 * - Transport forwards chat intent. It never finalizes moderation truth.
 * - Frontend can pre-warn or optimistically style. It never finalizes
 *   moderation truth.
 * - Reducer mutates accepted results. It never evaluates moderation law.
 * - Message factory stamps metadata after moderation has spoken.
 * - ChatModerationPolicy.ts is the canonical policy gate before transcript
 *   mutation.
 *
 * Domain law
 * ----------
 * This backend chat lane is not a generic site chat. It is a simulation-grade
 * layer plugged into battle, pressure, syndicate, deal room, lobby, replay,
 * learning, and proof infrastructure. Moderation therefore must understand:
 *
 * - room kind and visible channel posture,
 * - NPC / helper / hater distinction,
 * - shadow writes versus visible writes,
 * - command syntax and structured control messages,
 * - crowd-swarm risk and liveops pressure,
 * - learning implications and proof edges,
 * - negotiation-specific and rivalry-specific leakage,
 * - deliberate drama versus unsafe escalation.
 *
 * Backend moderation outcomes are authoritative:
 * - ALLOW       => content may enter visible or requested truth as authored.
 * - MASK        => unsafe fragments are masked, message may still enter truth.
 * - REWRITE     => formatting / casing / spam / risky structure normalized.
 * - SHADOW_ONLY => content is too risky for visible room truth but may be kept
 *                  in backend shadow channels for audit / memory / orchestration.
 * - REJECT      => content may not enter transcript truth.
 * - THROTTLE    => moderation-triggered temporary defer, usually for pathological
 *                  format floods or repetitive harmful attempts.
 * - QUARANTINE  => content is frozen for backend-only review / later release.
 *
 * The implementation is intentionally deep because this file is one of the core
 * gates in the backend simulation tree you locked.
 * ============================================================================
 */

import {
  CHAT_CHANNEL_DESCRIPTORS,
  CHAT_RUNTIME_DEFAULTS,
  clamp01,
  type AttackType,
  type BotId,
  type ChatAffectSnapshot,
  type ChatChannelId,
  type ChatEconomySnapshot,
  type ChatInferenceSource,
  type ChatInvasionState,
  type ChatLiveOpsSnapshot,
  type ChatModerationDecision,
  type ChatModerationOutcome,
  type ChatPlayerMessageSubmitRequest,
  type ChatRoomId,
  type ChatRoomKind,
  type ChatRoomStageMood,
  type ChatRoomState,
  type ChatRuntimeConfig,
  type ChatSessionId,
  type ChatSessionState,
  type ChatSignalEnvelope,
  type ChatSourceType,
  type ChatState,
  type ChatUserId,
  type ChatVisibleChannel,
  type JsonValue,
  type PressureTier,
  type Score01,
  type UnixMs,
} from './types';

// ============================================================================
// MARK: Ports, options, context, and request shapes
// ============================================================================

export interface ChatModerationPolicyLoggerPort {
  debug(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  error(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

export interface ChatModerationPolicyOptions {
  readonly runtime?: Partial<ChatRuntimeConfig>;
  readonly logger?: ChatModerationPolicyLoggerPort;
}

export interface ChatModerationPolicyContext {
  readonly runtime: ChatRuntimeConfig;
  readonly logger: ChatModerationPolicyLoggerPort;
}

export interface ChatModerationActorSnapshot {
  readonly sourceType: ChatSourceType;
  readonly actorId: string;
  readonly userId: ChatUserId | null;
  readonly sessionId: ChatSessionId | null;
  readonly npcBotId: BotId | null;
  readonly attackType: AttackType | null;
  readonly affect: ChatAffectSnapshot | null;
  readonly inferenceSource: ChatInferenceSource;
}

export interface ChatModerationRoomSnapshot {
  readonly roomId: ChatRoomId;
  readonly roomKind: ChatRoomKind;
  readonly activeVisibleChannel: ChatVisibleChannel;
  readonly stageMood: ChatRoomStageMood;
  readonly activeInvasion: boolean;
  readonly audienceHeat01: Score01 | null;
  readonly pressureTier: PressureTier | null;
  readonly liveops: ChatLiveOpsSnapshot | null;
  readonly economy: ChatEconomySnapshot | null;
}

export interface ChatPlayerModerationRequest {
  readonly text: string;
  readonly request: ChatPlayerMessageSubmitRequest;
  readonly room: ChatRoomState;
  readonly session: ChatSessionState;
  readonly state: ChatState;
  readonly now: UnixMs;
  readonly inferenceSource?: ChatInferenceSource;
}

export interface ChatNpcModerationRequest {
  readonly text: string;
  readonly room: ChatRoomState;
  readonly state: ChatState;
  readonly now: UnixMs;
  readonly actorId: string;
  readonly role: 'HATER' | 'HELPER' | 'AMBIENT';
  readonly botId?: BotId | null;
  readonly attackType?: AttackType | null;
  readonly tags?: readonly string[];
}

export interface ChatSystemModerationRequest {
  readonly text: string;
  readonly room: ChatRoomState;
  readonly state: ChatState;
  readonly now: UnixMs;
  readonly tags?: readonly string[];
  readonly signal?: ChatSignalEnvelope | null;
}

export interface ChatModerationRiskVector {
  readonly empty: number;
  readonly oversize: number;
  readonly lineFlood: number;
  readonly urlSpam: number;
  readonly emojiFlood: number;
  readonly charFlood: number;
  readonly allCaps: number;
  readonly doxLike: number;
  readonly financialLeak: number;
  readonly selfHarm: number;
  readonly violentDirective: number;
  readonly negotiationLeak: number;
  readonly crowdBait: number;
  readonly harassment: number;
  readonly invisibleControl: number;
  readonly commandAbuse: number;
  readonly shadowWorthy: number;
}

export interface ChatModerationLexemeHit {
  readonly lexeme: string;
  readonly kind:
    | 'MASK'
    | 'REJECT'
    | 'SELF_HARM'
    | 'DOX'
    | 'FINANCIAL'
    | 'HARASSMENT'
    | 'NEGOTIATION_LEAK'
    | 'CROWD_BAIT';
  readonly count: number;
}

export interface ChatModerationDiagnostic {
  readonly roomId: ChatRoomId;
  readonly sessionId: ChatSessionId | null;
  readonly sourceType: ChatSourceType;
  readonly originalLength: number;
  readonly normalizedLength: number;
  readonly lineCount: number;
  readonly visibleUrlCount: number;
  readonly emojiRun: number;
  readonly repeatedCharRun: number;
  readonly uppercaseRatio01: number;
  readonly lexemeHits: readonly ChatModerationLexemeHit[];
  readonly risk: MutableChatModerationRiskVector;
  readonly reasons: readonly string[];
  readonly outcome: ChatModerationOutcome;
  readonly shadowOnly: boolean;
  readonly rewritten: boolean;
  readonly masked: boolean;
}

export interface ChatModerationAuditRecord {
  readonly roomId: ChatRoomId;
  readonly sessionId: ChatSessionId | null;
  readonly sourceType: ChatSourceType;
  readonly createdAt: UnixMs;
  readonly diagnostic: ChatModerationDiagnostic;
  readonly rewrittenText: string | null;
  readonly maskedLexemes: readonly string[];
}

export interface ChatModerationRule {
  readonly id: string;
  readonly description: string;
  applies(args: ChatCompositeModerationRequest): boolean;
  execute(args: ChatCompositeModerationRequest, working: MutableModerationWorkingSet): void;
}

export interface ChatCompositeModerationRequest {
  readonly text: string;
  readonly actor: ChatModerationActorSnapshot;
  readonly room: ChatModerationRoomSnapshot;
  readonly state: ChatState;
  readonly now: UnixMs;
  readonly tags: readonly string[];
}

interface MutableChatModerationRiskVector {
  empty: number;
  oversize: number;
  lineFlood: number;
  urlSpam: number;
  emojiFlood: number;
  charFlood: number;
  allCaps: number;
  doxLike: number;
  financialLeak: number;
  selfHarm: number;
  violentDirective: number;
  negotiationLeak: number;
  crowdBait: number;
  harassment: number;
  invisibleControl: number;
  commandAbuse: number;
  shadowWorthy: number;
}

interface MutableModerationWorkingSet {
  text: string;
  reasons: string[];
  maskedLexemes: string[];
  lexemeHits: ChatModerationLexemeHit[];
  risk: MutableChatModerationRiskVector;
  outcome: ChatModerationOutcome;
  rewritten: boolean;
  masked: boolean;
  shadowOnly: boolean;
  quarantined: boolean;
  throttled: boolean;
}

const NOOP_LOGGER: ChatModerationPolicyLoggerPort = {
  debug: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

// ============================================================================
// MARK: Canonical lexical banks and simulation-aware risk dictionaries
// ============================================================================

const SELF_HARM_LEXEMES = Object.freeze([
  'kill yourself',
  'kys',
  'end your life',
  'go die',
  'unalive yourself',
] as const);

const DOX_LIKE_LEXEMES = Object.freeze([
  'address is',
  'phone number is',
  'social security',
  'ssn',
  'dob:',
  'date of birth',
  'routing number',
  'account number',
  'credit card',
  'cvv',
] as const);

const VIOLENT_DIRECTIVE_LEXEMES = Object.freeze([
  'hunt them down',
  'shoot them',
  'stab them',
  'burn it down',
  'bomb',
  'swat them',
] as const);

const CROWD_BAIT_LEXEMES = Object.freeze([
  'ratio this',
  'dogpile',
  'everyone attack',
  'pile on',
  'drag them',
  'ruin this player',
] as const);

const NEGOTIATION_LEAK_LEXEMES = Object.freeze([
  'minimum price',
  'walk-away price',
  'max bid',
  'reserve secret',
  'internal valuation',
  'panic sell now',
] as const);

const HARASSMENT_LEXEMES = Object.freeze([
  'idiot',
  'loser',
  'trash',
  'worthless',
  'pathetic',
  'moron',
  'clown',
] as const);

const INVISIBLE_CONTROL_MARKERS = Object.freeze([
  /\u200B/gu,
  /\u200C/gu,
  /\u200D/gu,
  /\uFEFF/gu,
] as const);

const COMMAND_ABUSE_MARKERS = Object.freeze([
  '/ban',
  '/kick',
  '/wipe',
  '/purge',
  '/shutdown',
  '/dropdb',
] as const);

const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s)\]]+/giu;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu;
const CARDISH_DIGIT_PATTERN = /(?:\b\d[ -]*?){13,19}\b/gu;
const PHONEISH_PATTERN = /(?:\+?1[ .-]*)?(?:\(?\d{3}\)?[ .-]*)\d{3}[ .-]*\d{4}\b/gu;
const LONG_NUMBER_PATTERN = /\b\d{6,}\b/gu;
const EMOJI_LIKE_PATTERN = /(?:[\u{1F300}-\u{1FAFF}\u2600-\u27BF]|:[a-z0-9_+-]+:)/giu;
const REPEATED_CHAR_PATTERN = /(.)\1{6,}/gu;
const MULTISPACE_PATTERN = /[\t ]{2,}/g;
const MULTIBREAK_PATTERN = /(?:\r?\n){3,}/g;
const MARKDOWN_LINK_PATTERN = /\[[^\]]+\]\((https?:\/\/[^)]+)\)/giu;
const QUOTE_LINE_PATTERN = /^\s*>/gm;
const TAGISH_PATTERN = /<[^>]{1,120}>/gu;
const LEET_SUBSTITUTIONS: Readonly<Record<string, string>> = Object.freeze({
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  '$': 's',
  '!': 'i',
});

// ============================================================================
// MARK: Context creation
// ============================================================================

export function createChatModerationPolicyContext(
  options: ChatModerationPolicyOptions = {},
): ChatModerationPolicyContext {
  return {
    runtime: mergeModerationRuntime(options.runtime),
    logger: options.logger ?? NOOP_LOGGER,
  };
}

export function mergeModerationRuntime(runtime?: Partial<ChatRuntimeConfig>): ChatRuntimeConfig {
  if (!runtime) {
    return CHAT_RUNTIME_DEFAULTS;
  }

  return {
    ...CHAT_RUNTIME_DEFAULTS,
    ...runtime,
    allowVisibleChannels: runtime.allowVisibleChannels ?? CHAT_RUNTIME_DEFAULTS.allowVisibleChannels,
    allowShadowChannels: runtime.allowShadowChannels ?? CHAT_RUNTIME_DEFAULTS.allowShadowChannels,
    ratePolicy: {
      ...CHAT_RUNTIME_DEFAULTS.ratePolicy,
      ...(runtime.ratePolicy ?? {}),
    },
    moderationPolicy: {
      ...CHAT_RUNTIME_DEFAULTS.moderationPolicy,
      ...(runtime.moderationPolicy ?? {}),
    },
    replayPolicy: {
      ...CHAT_RUNTIME_DEFAULTS.replayPolicy,
      ...(runtime.replayPolicy ?? {}),
    },
    learningPolicy: {
      ...CHAT_RUNTIME_DEFAULTS.learningPolicy,
      ...(runtime.learningPolicy ?? {}),
    },
    proofPolicy: {
      ...CHAT_RUNTIME_DEFAULTS.proofPolicy,
      ...(runtime.proofPolicy ?? {}),
    },
    invasionPolicy: {
      ...CHAT_RUNTIME_DEFAULTS.invasionPolicy,
      ...(runtime.invasionPolicy ?? {}),
    },
  };
}

// ============================================================================
// MARK: Public moderation entry points
// ============================================================================

export function evaluatePlayerModeration(
  context: ChatModerationPolicyContext,
  args: ChatPlayerModerationRequest,
): ChatModerationDecision {
  const composite = createPlayerCompositeRequest(args);
  const working = createWorkingSet(composite.text);

  runBaseNormalization(context, composite, working);
  runLexemePolicies(context, composite, working);
  runStructuralPolicies(context, composite, working);
  runRoomAwarePolicies(context, composite, working);
  runStageMoodPolicies(context, composite, working);
  runPressurePolicies(context, composite, working);
  runCommandPolicies(context, composite, working);
  finalizeModerationOutcome(context, composite, working);

  return materializeDecision(working);
}

export function evaluateNpcModeration(
  context: ChatModerationPolicyContext,
  args: ChatNpcModerationRequest,
): ChatModerationDecision {
  const composite = createNpcCompositeRequest(args);
  const working = createWorkingSet(composite.text);

  runBaseNormalization(context, composite, working);
  runLexemePolicies(context, composite, working);
  runStructuralPolicies(context, composite, working);
  runNpcPersonaPolicies(context, composite, working);
  runRoomAwarePolicies(context, composite, working);
  runPressurePolicies(context, composite, working);
  finalizeModerationOutcome(context, composite, working);

  return materializeDecision(working);
}

export function evaluateSystemModeration(
  context: ChatModerationPolicyContext,
  args: ChatSystemModerationRequest,
): ChatModerationDecision {
  const composite = createSystemCompositeRequest(args);
  const working = createWorkingSet(composite.text);

  runBaseNormalization(context, composite, working);
  runStructuralPolicies(context, composite, working);
  runSystemMessagePolicies(context, composite, working);
  finalizeModerationOutcome(context, composite, working);

  return materializeDecision(working);
}

export function buildModerationDiagnostic(
  context: ChatModerationPolicyContext,
  args: ChatCompositeModerationRequest,
  decision: ChatModerationDecision,
): ChatModerationDiagnostic {
  const normalized = normalizeTextForDiagnostics(args.text);
  const lexemeHits = collectLexemeHits(context, normalized);
  const risk = buildRiskVector(context, args, normalized, lexemeHits);

  return {
    roomId: args.room.roomId,
    sessionId: args.actor.sessionId,
    sourceType: args.actor.sourceType,
    originalLength: args.text.length,
    normalizedLength: normalized.length,
    lineCount: splitLogicalLines(normalized).length,
    visibleUrlCount: countUrls(normalized),
    emojiRun: longestEmojiLikeRun(normalized),
    repeatedCharRun: longestRepeatedCharacterRun(normalized),
    uppercaseRatio01: uppercaseRatio(normalized),
    lexemeHits,
    risk,
    reasons: decision.reasons,
    outcome: decision.outcome,
    shadowOnly: decision.shadowOnly,
    rewritten: decision.rewrittenText !== null && decision.rewrittenText !== args.text,
    masked: decision.maskedLexemes.length > 0,
  };
}

export function createModerationAuditRecord(
  context: ChatModerationPolicyContext,
  args: ChatCompositeModerationRequest,
  decision: ChatModerationDecision,
): ChatModerationAuditRecord {
  return {
    roomId: args.room.roomId,
    sessionId: args.actor.sessionId,
    sourceType: args.actor.sourceType,
    createdAt: args.now,
    diagnostic: buildModerationDiagnostic(context, args, decision),
    rewrittenText: decision.rewrittenText,
    maskedLexemes: decision.maskedLexemes,
  };
}

export function auditRoomModerationEnvelope(
  context: ChatModerationPolicyContext,
  state: ChatState,
  roomId: ChatRoomId,
  now: UnixMs,
): readonly ChatModerationAuditRecord[] {
  const entries = state.transcript.byRoom[roomId] ?? [];
  const room = state.rooms[roomId];
  if (!room) {
    return [];
  }

  return entries.map((entry) => {
    const actor = deriveActorFromTranscriptEntry(entry.message, state);
    const composite: ChatCompositeModerationRequest = {
      text: entry.message.plainText,
      actor,
      room: createRoomSnapshot(state, room),
      state,
      now,
      tags: entry.message.tags,
    };

    const decision: ChatModerationDecision = {
      outcome: entry.message.policy.moderationOutcome,
      reasons: entry.message.policy.moderationReasons,
      rewrittenText: entry.message.policy.wasRewritten ? entry.message.plainText : null,
      maskedLexemes: [],
      shadowOnly: entry.message.policy.shadowOnly,
    };

    return createModerationAuditRecord(context, composite, decision);
  });
}

// ============================================================================
// MARK: Composite request builders
// ============================================================================

export function createPlayerCompositeRequest(args: ChatPlayerModerationRequest): ChatCompositeModerationRequest {
  return {
    text: args.text,
    actor: {
      sourceType: 'PLAYER',
      actorId: args.session.identity.userId,
      userId: args.session.identity.userId,
      sessionId: args.session.identity.sessionId,
      npcBotId: null,
      attackType: null,
      affect: stateLearningAffect(args.state, args.session.identity.userId),
      inferenceSource: args.inferenceSource ?? 'HEURISTIC',
    },
    room: createRoomSnapshot(args.state, args.room),
    state: args.state,
    now: args.now,
    tags: [],
  };
}

export function createNpcCompositeRequest(args: ChatNpcModerationRequest): ChatCompositeModerationRequest {
  return {
    text: args.text,
    actor: {
      sourceType: args.role === 'HATER' ? 'NPC_HATER' : args.role === 'HELPER' ? 'NPC_HELPER' : 'NPC_AMBIENT',
      actorId: args.actorId,
      userId: null,
      sessionId: null,
      npcBotId: args.botId ?? null,
      attackType: args.attackType ?? null,
      affect: null,
      inferenceSource: 'HEURISTIC',
    },
    room: createRoomSnapshot(args.state, args.room),
    state: args.state,
    now: args.now,
    tags: args.tags ?? [],
  };
}

export function createSystemCompositeRequest(args: ChatSystemModerationRequest): ChatCompositeModerationRequest {
  return {
    text: args.text,
    actor: {
      sourceType: args.signal?.type === 'LIVEOPS' ? 'LIVEOPS' : 'SYSTEM',
      actorId: args.signal?.type === 'LIVEOPS' ? 'system:liveops' : 'system:core',
      userId: null,
      sessionId: null,
      npcBotId: null,
      attackType: null,
      affect: null,
      inferenceSource: 'HEURISTIC',
    },
    room: createRoomSnapshot(args.state, args.room),
    state: args.state,
    now: args.now,
    tags: args.tags ?? [],
  };
}

export function createRoomSnapshot(state: ChatState, room: ChatRoomState): ChatModerationRoomSnapshot {
  return {
    roomId: room.roomId,
    roomKind: room.roomKind,
    activeVisibleChannel: room.activeVisibleChannel,
    stageMood: room.stageMood,
    activeInvasion: findActiveInvasionForRoom(state, room.roomId) !== null,
    audienceHeat01: state.audienceHeatByRoom[room.roomId]?.heat01 ?? null,
    pressureTier: inferPressureTierFromRoomState(state, room.roomId),
    liveops: inferLiveOpsSnapshot(state, room.roomId),
    economy: inferEconomySnapshot(state, room.roomId),
  };
}

// ============================================================================
// MARK: Working set lifecycle
// ============================================================================

function createWorkingSet(text: string): MutableModerationWorkingSet {
  return {
    text,
    reasons: [],
    maskedLexemes: [],
    lexemeHits: [],
    risk: emptyRiskVector(),
    outcome: 'ALLOW',
    rewritten: false,
    masked: false,
    shadowOnly: false,
    quarantined: false,
    throttled: false,
  };
}

function materializeDecision(working: MutableModerationWorkingSet): ChatModerationDecision {
  return {
    outcome: working.outcome,
    reasons: Object.freeze([...working.reasons]),
    rewrittenText: working.rewritten || working.masked ? working.text : working.outcome === 'ALLOW' ? working.text : working.text,
    maskedLexemes: Object.freeze([...dedupeStrings(working.maskedLexemes)]),
    shadowOnly: working.shadowOnly,
  };
}

function emptyRiskVector(): MutableChatModerationRiskVector {
  return {
    empty: 0,
    oversize: 0,
    lineFlood: 0,
    urlSpam: 0,
    emojiFlood: 0,
    charFlood: 0,
    allCaps: 0,
    doxLike: 0,
    financialLeak: 0,
    selfHarm: 0,
    violentDirective: 0,
    negotiationLeak: 0,
    crowdBait: 0,
    harassment: 0,
    invisibleControl: 0,
    commandAbuse: 0,
    shadowWorthy: 0,
  };
}

// ============================================================================
// MARK: Policy phases
// ============================================================================

function runBaseNormalization(
  context: ChatModerationPolicyContext,
  args: ChatCompositeModerationRequest,
  working: MutableModerationWorkingSet,
): void {
  const original = working.text;
  working.text = stripInvisibleControls(working.text, working);
  working.text = normalizeUnicodeVariants(working.text);
  working.text = working.text.replace(/\r\n/g, '\n');
  working.text = working.text.replace(MULTISPACE_PATTERN, ' ');
  working.text = working.text.replace(MULTIBREAK_PATTERN, '\n\n');
  working.text = trimRoomAwareWhitespace(working.text);

  if (working.text !== original) {
    working.rewritten = true;
    working.reasons.push('Whitespace and invisible control characters normalized.');
  }

  if (working.text.length === 0) {
    working.risk.empty = 1;
    setOutcome(working, 'REJECT');
    working.reasons.push('Message is empty after normalization.');
  }

  const maxChars = context.runtime.moderationPolicy.maxCharactersPerMessage;
  if (working.text.length > maxChars) {
    working.risk.oversize = 1;
    setOutcome(working, 'REJECT');
    working.reasons.push(`Message exceeds maximum character limit of ${maxChars}.`);
  }

  const lines = splitLogicalLines(working.text).length;
  if (lines > context.runtime.moderationPolicy.maxLinesPerMessage) {
    working.risk.lineFlood = clamp01(lines / Math.max(1, context.runtime.moderationPolicy.maxLinesPerMessage));
    setOutcome(working, 'REJECT');
    working.reasons.push('Message exceeds maximum line count.');
  }
}

function runLexemePolicies(
  context: ChatModerationPolicyContext,
  args: ChatCompositeModerationRequest,
  working: MutableModerationWorkingSet,
): void {
  const normalizedForMatching = normalizeForLexemeMatching(working.text);

  applyRejectLexemeBank(working, normalizedForMatching, context.runtime.moderationPolicy.rejectBannedLexemes, 'REJECT');
  applyMaskLexemeBank(working, normalizedForMatching, context.runtime.moderationPolicy.maskBannedLexemes, 'MASK');
  applyRejectLexemeBank(working, normalizedForMatching, SELF_HARM_LEXEMES, 'SELF_HARM');
  applyRejectLexemeBank(working, normalizedForMatching, DOX_LIKE_LEXEMES, 'DOX');
  applyRejectLexemeBank(working, normalizedForMatching, VIOLENT_DIRECTIVE_LEXEMES, 'REJECT');
  applyMaskLexemeBank(working, normalizedForMatching, HARASSMENT_LEXEMES, 'HARASSMENT');

  if (args.room.roomKind === 'DEAL_ROOM') {
    applyMaskLexemeBank(working, normalizedForMatching, NEGOTIATION_LEAK_LEXEMES, 'NEGOTIATION_LEAK');
  }

  if (args.room.stageMood === 'HOSTILE' || args.room.stageMood === 'PREDATORY') {
    applyMaskLexemeBank(working, normalizedForMatching, CROWD_BAIT_LEXEMES, 'CROWD_BAIT');
  }

  if (working.lexemeHits.some((hit) => hit.kind === 'SELF_HARM')) {
    working.risk.selfHarm = 1;
    setOutcome(working, 'REJECT');
    working.reasons.push('Self-harm directive detected.');
  }

  if (working.lexemeHits.some((hit) => hit.kind === 'DOX')) {
    working.risk.doxLike = 1;
    escalateToQuarantine(working, 'Dox-like data marker detected.');
  }

  if (working.lexemeHits.some((hit) => hit.kind === 'NEGOTIATION_LEAK')) {
    working.risk.negotiationLeak = 0.9;
    if (args.actor.sourceType === 'PLAYER') {
      shadowOnly(working, 'Negotiation leak normalized to shadow-only.');
    }
  }

  if (working.lexemeHits.some((hit) => hit.kind === 'HARASSMENT')) {
    working.risk.harassment = 0.55;
  }
}

function runStructuralPolicies(
  context: ChatModerationPolicyContext,
  args: ChatCompositeModerationRequest,
  working: MutableModerationWorkingSet,
): void {
  const urlCount = countUrls(working.text);
  if (urlCount > context.runtime.moderationPolicy.maxSuspiciousUrlCount) {
    working.risk.urlSpam = clamp01(urlCount / Math.max(1, context.runtime.moderationPolicy.maxSuspiciousUrlCount));
    shadowOnly(working, 'Suspicious link density exceeds visible-channel threshold.');
  }

  const markdownLinks = [...working.text.matchAll(MARKDOWN_LINK_PATTERN)].length;
  if (markdownLinks > 1) {
    working.risk.urlSpam = Math.max(working.risk.urlSpam, clamp01(markdownLinks / 3));
    working.text = stripMarkdownLinkFormatting(working.text);
    working.rewritten = true;
    working.reasons.push('Markdown links normalized to plain URLs.');
  }

  const emojiRun = longestEmojiLikeRun(working.text);
  if (emojiRun > context.runtime.moderationPolicy.maxConsecutiveEmojiRuns) {
    working.risk.emojiFlood = clamp01(emojiRun / Math.max(1, context.runtime.moderationPolicy.maxConsecutiveEmojiRuns));
    working.text = normalizeEmojiRun(working.text, context.runtime.moderationPolicy.maxConsecutiveEmojiRuns);
    working.rewritten = true;
    working.reasons.push('Emoji flood normalized.');
  }

  const repeatedCharRun = longestRepeatedCharacterRun(working.text);
  if (repeatedCharRun >= 7) {
    working.risk.charFlood = clamp01(repeatedCharRun / 18);
    working.text = normalizeRepeatedCharacters(working.text);
    working.rewritten = true;
    working.reasons.push('Character flood normalized.');
  }

  const uppercase = uppercaseRatio(working.text);
  if (uppercase >= context.runtime.moderationPolicy.rewriteAllCapsThreshold && countLetters(working.text) >= 8) {
    working.risk.allCaps = uppercase;
    working.text = normalizeSentenceCase(working.text);
    working.rewritten = true;
    setOutcome(working, 'REWRITE');
    working.reasons.push('All-caps formatting normalized.');
  }

  if (containsFinancialLeakMarker(working.text)) {
    working.risk.financialLeak = 0.95;
    if (args.room.roomKind === 'DEAL_ROOM') {
      shadowOnly(working, 'Potential financial or account leakage forced to shadow-only.');
    } else {
      escalateToQuarantine(working, 'Potential financial or account leakage detected.');
    }
  }

  if (containsPhoneOrEmailLeak(working.text)) {
    working.risk.doxLike = Math.max(working.risk.doxLike, 0.85);
    shadowOnly(working, 'Personal-contact style data hidden from visible channels.');
  }

  if (QUOTE_LINE_PATTERN.test(working.text) && args.actor.sourceType === 'NPC_HATER') {
    working.risk.shadowWorthy = Math.max(working.risk.shadowWorthy, 0.25);
  }
}

function runRoomAwarePolicies(
  _context: ChatModerationPolicyContext,
  args: ChatCompositeModerationRequest,
  working: MutableModerationWorkingSet,
): void {
  const descriptor = CHAT_CHANNEL_DESCRIPTORS[args.room.activeVisibleChannel];

  if (!descriptor.supportsCrowdHeat && working.lexemeHits.some((hit) => hit.kind === 'CROWD_BAIT')) {
    working.reasons.push('Crowd-bait lexemes are not valid in this room posture.');
    shadowOnly(working, 'Crowd-swarm bait removed from visible channel.');
  }

  if (args.room.roomKind === 'LOBBY' && args.actor.sourceType === 'NPC_HATER') {
    if (working.lexemeHits.some((hit) => hit.kind === 'HARASSMENT')) {
      working.text = softenNpcHarassment(working.text);
      working.rewritten = true;
      working.reasons.push('Lobby hostility reduced for pre-run posture.');
    }
  }

  if (args.room.roomKind === 'GLOBAL' && args.room.activeInvasion && args.actor.sourceType === 'PLAYER') {
    if (countUrls(working.text) > 0) {
      shadowOnly(working, 'Link-bearing player content hidden during active invasion.');
    }
  }

  if (args.room.roomKind === 'DEAL_ROOM') {
    if (descriptor.supportsNegotiation && looksLikeInternalNegotiationLeak(working.text)) {
      working.risk.negotiationLeak = Math.max(working.risk.negotiationLeak, 0.92);
      shadowOnly(working, 'Internal negotiation posture protected via shadow routing.');
    }
  }
}

function runStageMoodPolicies(
  _context: ChatModerationPolicyContext,
  args: ChatCompositeModerationRequest,
  working: MutableModerationWorkingSet,
): void {
  switch (args.room.stageMood) {
    case 'CEREMONIAL': {
      if (countUrls(working.text) > 0 && args.actor.sourceType === 'PLAYER') {
        working.reasons.push('Ceremonial rooms discourage outbound links.');
        shadowOnly(working, 'Link-bearing content hidden in ceremonial posture.');
      }
      break;
    }

    case 'MOURNFUL': {
      if (args.actor.sourceType === 'NPC_HATER' && working.lexemeHits.some((hit) => hit.kind === 'HARASSMENT')) {
        working.text = convertHarassmentToColdObservation(working.text);
        working.rewritten = true;
        working.reasons.push('Post-run hostility reduced to preserve ritual cadence.');
      }
      break;
    }

    case 'HOSTILE':
    case 'PREDATORY': {
      if (args.actor.sourceType === 'PLAYER' && looksLikeSwarmCommand(working.text)) {
        working.risk.crowdBait = Math.max(working.risk.crowdBait, 0.88);
        shadowOnly(working, 'Swarm-bait command hidden from visible hostility lane.');
      }
      break;
    }

    default:
      break;
  }
}

function runPressurePolicies(
  _context: ChatModerationPolicyContext,
  args: ChatCompositeModerationRequest,
  working: MutableModerationWorkingSet,
): void {
  if (args.room.pressureTier === 'CRITICAL') {
    if (countUrls(working.text) > 0) {
      working.risk.urlSpam = Math.max(working.risk.urlSpam, 0.8);
      shadowOnly(working, 'Outbound links suppressed during critical pressure.');
    }

    if (args.actor.sourceType === 'PLAYER' && looksLikePanicDump(working.text)) {
      working.risk.financialLeak = Math.max(working.risk.financialLeak, 0.72);
      shadowOnly(working, 'Panic-dump style message routed to shadow while room is critical.');
    }
  }

  if (args.room.liveops?.helperBlackout && args.actor.sourceType === 'NPC_HELPER') {
    shadowOnly(working, 'Helper blackout forces helper speech into shadow evaluation.');
  }

  if (args.room.liveops?.haterRaidActive && args.actor.sourceType === 'NPC_HATER') {
    if (working.lexemeHits.some((hit) => hit.kind === 'HARASSMENT')) {
      working.text = intensifyRaidButStayNonviolent(working.text);
      working.rewritten = true;
      working.reasons.push('Raid rhetoric normalized to nonviolent hostile pressure.');
    }
  }
}

function runCommandPolicies(
  context: ChatModerationPolicyContext,
  args: ChatCompositeModerationRequest,
  working: MutableModerationWorkingSet,
): void {
  if (!working.text.startsWith('/')) {
    return;
  }

  if (!context.runtime.moderationPolicy.allowSlashCommands) {
    working.risk.commandAbuse = 1;
    setOutcome(working, 'REJECT');
    working.reasons.push('Slash commands are disabled.');
    return;
  }

  const command = working.text.slice(1).trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  if (command.length === 0) {
    setOutcome(working, 'REJECT');
    working.reasons.push('Command token is empty.');
    return;
  }

  if (COMMAND_ABUSE_MARKERS.includes(`/${command}` as (typeof COMMAND_ABUSE_MARKERS)[number])) {
    working.risk.commandAbuse = 1;
    escalateToQuarantine(working, 'Administrative command string not allowed in chat.');
    return;
  }

  if (!isAllowedChatCommand(command, args.room.roomKind)) {
    working.risk.commandAbuse = 0.7;
    setOutcome(working, 'REJECT');
    working.reasons.push(`Command /${command} is not enabled for this room.`);
  }
}

function runNpcPersonaPolicies(
  _context: ChatModerationPolicyContext,
  args: ChatCompositeModerationRequest,
  working: MutableModerationWorkingSet,
): void {
  if (args.actor.sourceType === 'NPC_HATER') {
    if (working.lexemeHits.some((hit) => hit.kind === 'SELF_HARM' || hit.kind === 'DOX')) {
      working.text = rewriteNpcToColdPressure(working.text);
      working.rewritten = true;
      working.reasons.push('Hater rhetoric constrained to authored pressure band.');
      clearHighRiskLexemes(working);
      setOutcome(working, 'REWRITE');
    }

    if (args.actor.attackType === 'LIQUIDATION' && !looksLikeLiquidationPressure(working.text)) {
      working.text = addLiquidationCadence(working.text);
      working.rewritten = true;
      working.reasons.push('Hater message aligned to liquidation pressure cadence.');
    }
  }

  if (args.actor.sourceType === 'NPC_HELPER') {
    if (working.lexemeHits.some((hit) => hit.kind === 'HARASSMENT')) {
      working.text = softenNpcHarassment(working.text);
      working.rewritten = true;
      working.reasons.push('Helper tone normalized to mentorship posture.');
    }

    if (working.text.startsWith('/')) {
      working.text = working.text.replace(/^\/+/, '');
      working.rewritten = true;
      working.reasons.push('Helper commands rendered as plain guidance.');
    }
  }
}

function runSystemMessagePolicies(
  _context: ChatModerationPolicyContext,
  args: ChatCompositeModerationRequest,
  working: MutableModerationWorkingSet,
): void {
  if (countUrls(working.text) > 2) {
    working.text = stripRedundantUrls(working.text);
    working.rewritten = true;
    working.reasons.push('System message URLs deduplicated.');
  }

  if (args.actor.sourceType === 'LIVEOPS' && args.room.roomKind === 'GLOBAL') {
    if (!working.text.includes('[')) {
      working.text = `[WORLD EVENT] ${working.text}`;
      working.rewritten = true;
      working.reasons.push('LiveOps announcement tagged for theatrical global readability.');
    }
  }
}

function finalizeModerationOutcome(
  context: ChatModerationPolicyContext,
  args: ChatCompositeModerationRequest,
  working: MutableModerationWorkingSet,
): void {
  const overallRisk = aggregateRisk(working.risk);

  if (working.quarantined) {
    working.shadowOnly = true;
    working.outcome = 'QUARANTINE';
    return;
  }

  if (working.outcome === 'REJECT') {
    return;
  }

  if (working.shadowOnly) {
    working.outcome = 'SHADOW_ONLY';
    return;
  }

  if (overallRisk >= 0.92 && context.runtime.moderationPolicy.shadowModeOnHighRisk) {
    working.shadowOnly = true;
    working.outcome = 'SHADOW_ONLY';
    working.reasons.push('Aggregate moderation risk exceeded visible threshold.');
    return;
  }

  if (working.masked) {
    setOutcome(working, working.rewritten ? 'REWRITE' : 'MASK');
  }

  if (working.rewritten && working.outcome === 'ALLOW') {
    working.outcome = 'REWRITE';
  }

  if (args.actor.sourceType === 'PLAYER' && looksLikeTranscriptFloodArtifact(working.text)) {
    working.throttled = true;
    setOutcome(working, 'THROTTLE');
    working.reasons.push('Transcript flood artifact pattern detected.');
    return;
  }

  if (working.outcome === 'ALLOW' && working.reasons.length === 0) {
    working.reasons.push('Allowed by backend moderation policy.');
  }
}

// ============================================================================
// MARK: Risk construction helpers
// ============================================================================

function collectLexemeHits(
  context: ChatModerationPolicyContext,
  normalized: string,
): readonly ChatModerationLexemeHit[] {
  const hits: ChatModerationLexemeHit[] = [];
  applyCollectLexemeBank(hits, normalized, context.runtime.moderationPolicy.maskBannedLexemes, 'MASK');
  applyCollectLexemeBank(hits, normalized, context.runtime.moderationPolicy.rejectBannedLexemes, 'REJECT');
  applyCollectLexemeBank(hits, normalized, SELF_HARM_LEXEMES, 'SELF_HARM');
  applyCollectLexemeBank(hits, normalized, DOX_LIKE_LEXEMES, 'DOX');
  applyCollectLexemeBank(hits, normalized, HARASSMENT_LEXEMES, 'HARASSMENT');
  applyCollectLexemeBank(hits, normalized, NEGOTIATION_LEAK_LEXEMES, 'NEGOTIATION_LEAK');
  applyCollectLexemeBank(hits, normalized, CROWD_BAIT_LEXEMES, 'CROWD_BAIT');
  return Object.freeze(hits);
}

function buildRiskVector(
  context: ChatModerationPolicyContext,
  args: ChatCompositeModerationRequest,
  normalized: string,
  hits: readonly ChatModerationLexemeHit[],
): ChatModerationRiskVector {
  const lines = splitLogicalLines(normalized).length;
  const urls = countUrls(normalized);
  const emoji = longestEmojiLikeRun(normalized);
  const repeat = longestRepeatedCharacterRun(normalized);
  const letters = countLetters(normalized);
  const caps = letters > 0 ? uppercaseRatio(normalized) : 0;

  return {
    empty: normalized.trim().length === 0 ? 1 : 0,
    oversize: clamp01(normalized.length / Math.max(1, context.runtime.moderationPolicy.maxCharactersPerMessage)),
    lineFlood: clamp01(lines / Math.max(1, context.runtime.moderationPolicy.maxLinesPerMessage)),
    urlSpam: clamp01(urls / Math.max(1, context.runtime.moderationPolicy.maxSuspiciousUrlCount)),
    emojiFlood: clamp01(emoji / Math.max(1, context.runtime.moderationPolicy.maxConsecutiveEmojiRuns)),
    charFlood: clamp01(repeat / 18),
    allCaps: caps,
    doxLike: hits.some((hit) => hit.kind === 'DOX') || containsPhoneOrEmailLeak(normalized) ? 1 : 0,
    financialLeak: containsFinancialLeakMarker(normalized) ? 1 : 0,
    selfHarm: hits.some((hit) => hit.kind === 'SELF_HARM') ? 1 : 0,
    violentDirective: hits.some((hit) => hit.kind === 'REJECT') ? 0.85 : 0,
    negotiationLeak: hits.some((hit) => hit.kind === 'NEGOTIATION_LEAK') ? 0.9 : 0,
    crowdBait: hits.some((hit) => hit.kind === 'CROWD_BAIT') || looksLikeSwarmCommand(normalized) ? 0.82 : 0,
    harassment: hits.some((hit) => hit.kind === 'HARASSMENT') ? 0.5 : 0,
    invisibleControl: containsInvisibleControls(normalized) ? 0.8 : 0,
    commandAbuse: normalized.startsWith('/') && !isAllowedChatCommand(normalized.slice(1).split(/\s+/)[0]?.toLowerCase() ?? '', args.room.roomKind) ? 0.75 : 0,
    shadowWorthy: args.room.activeInvasion && urls > 0 ? 0.8 : 0,
  };
}

export function aggregateRisk(risk: ChatModerationRiskVector): number {
  const weighted =
    risk.empty * 1.0 +
    risk.oversize * 0.45 +
    risk.lineFlood * 0.35 +
    risk.urlSpam * 0.65 +
    risk.emojiFlood * 0.2 +
    risk.charFlood * 0.25 +
    risk.allCaps * 0.2 +
    risk.doxLike * 1.1 +
    risk.financialLeak * 1.05 +
    risk.selfHarm * 1.2 +
    risk.violentDirective * 0.95 +
    risk.negotiationLeak * 0.7 +
    risk.crowdBait * 0.55 +
    risk.harassment * 0.35 +
    risk.invisibleControl * 0.5 +
    risk.commandAbuse * 0.6 +
    risk.shadowWorthy * 0.45;

  return Math.max(0, Math.min(1, weighted / 4.8));
}

// ============================================================================
// MARK: Rule-bank helpers
// ============================================================================

function applyRejectLexemeBank(
  working: MutableModerationWorkingSet,
  normalized: string,
  bank: readonly string[],
  kind: ChatModerationLexemeHit['kind'],
): void {
  for (const lexeme of bank) {
    const count = countLexeme(normalized, lexeme);
    if (count <= 0) {
      continue;
    }

    appendLexemeHit(working, lexeme, kind, count);

    if (kind === 'SELF_HARM') {
      setOutcome(working, 'REJECT');
      continue;
    }

    if (kind === 'DOX') {
      escalateToQuarantine(working, `Dox-like lexeme detected: ${lexeme}`);
      continue;
    }

    if (kind === 'REJECT') {
      setOutcome(working, 'REJECT');
      working.reasons.push(`Rejected lexeme detected: ${lexeme}`);
    }
  }
}

function applyMaskLexemeBank(
  working: MutableModerationWorkingSet,
  normalized: string,
  bank: readonly string[],
  kind: ChatModerationLexemeHit['kind'],
): void {
  for (const lexeme of bank) {
    const count = countLexeme(normalized, lexeme);
    if (count <= 0) {
      continue;
    }

    appendLexemeHit(working, lexeme, kind, count);
    working.text = maskCaseInsensitiveLexeme(working.text, lexeme);
    working.masked = true;
    working.rewritten = true;
    working.maskedLexemes.push(lexeme);
    if (kind === 'CROWD_BAIT') {
      working.risk.crowdBait = Math.max(working.risk.crowdBait, 0.7);
    }
    if (kind === 'NEGOTIATION_LEAK') {
      working.risk.negotiationLeak = Math.max(working.risk.negotiationLeak, 0.8);
    }
    if (kind === 'HARASSMENT') {
      working.risk.harassment = Math.max(working.risk.harassment, 0.5);
    }
    if (kind === 'MASK') {
      working.reasons.push(`Unsafe lexeme masked: ${lexeme}`);
    }
  }
}

function applyCollectLexemeBank(
  hits: ChatModerationLexemeHit[],
  normalized: string,
  bank: readonly string[],
  kind: ChatModerationLexemeHit['kind'],
): void {
  for (const lexeme of bank) {
    const count = countLexeme(normalized, lexeme);
    if (count > 0) {
      hits.push({ lexeme, kind, count });
    }
  }
}

function appendLexemeHit(
  working: MutableModerationWorkingSet,
  lexeme: string,
  kind: ChatModerationLexemeHit['kind'],
  count: number,
): void {
  const existing = working.lexemeHits.find((entry) => entry.lexeme === lexeme && entry.kind === kind);
  if (existing) {
    return;
  }
  working.lexemeHits.push({ lexeme, kind, count });
}

// ============================================================================
// MARK: Outcome mutation helpers
// ============================================================================

function setOutcome(working: MutableModerationWorkingSet, outcome: ChatModerationOutcome): void {
  const rank = moderationOutcomeRank(outcome);
  const current = moderationOutcomeRank(working.outcome);
  if (rank > current) {
    working.outcome = outcome;
  }
}

function shadowOnly(working: MutableModerationWorkingSet, reason: string): void {
  working.shadowOnly = true;
  working.risk.shadowWorthy = Math.max(working.risk.shadowWorthy, 0.75);
  working.reasons.push(reason);
}

function escalateToQuarantine(working: MutableModerationWorkingSet, reason: string): void {
  working.quarantined = true;
  working.shadowOnly = true;
  working.reasons.push(reason);
}

function moderationOutcomeRank(outcome: ChatModerationOutcome): number {
  switch (outcome) {
    case 'ALLOW':
      return 0;
    case 'MASK':
      return 1;
    case 'REWRITE':
      return 2;
    case 'SHADOW_ONLY':
      return 3;
    case 'THROTTLE':
      return 4;
    case 'REJECT':
      return 5;
    case 'QUARANTINE':
      return 6;
    default:
      return 0;
  }
}

// ============================================================================
// MARK: Session, room, and learning helpers
// ============================================================================

function deriveActorFromTranscriptEntry(message: { attribution: { sourceType: ChatSourceType; actorId: string; authorUserId: ChatUserId | null; authorSessionId: ChatSessionId | null; botId: BotId | null; }; learning: { affectAfterMessage: ChatAffectSnapshot | null; inferenceSource: ChatInferenceSource; }; metadata: Readonly<Record<string, JsonValue>>; }, state: ChatState): ChatModerationActorSnapshot {
  return {
    sourceType: message.attribution.sourceType,
    actorId: message.attribution.actorId,
    userId: message.attribution.authorUserId,
    sessionId: message.attribution.authorSessionId,
    npcBotId: message.attribution.botId,
    attackType: null,
    affect: message.learning.affectAfterMessage,
    inferenceSource: message.learning.inferenceSource,
  };
}

function stateLearningAffect(state: ChatState, userId: ChatUserId): ChatAffectSnapshot | null {
  return state.learningProfiles[userId]?.affect ?? null;
}

function inferPressureTierFromRoomState(state: ChatState, roomId: ChatRoomId): PressureTier | null {
  const telemetry = state.telemetryQueue.filter((item) => item.roomId === roomId).slice(-12);
  const fromPayload = telemetry
    .map((item) => item.payload.pressureTier)
    .find((value): value is PressureTier => typeof value === 'string');
  return fromPayload ?? null;
}

function inferLiveOpsSnapshot(state: ChatState, roomId: ChatRoomId): ChatLiveOpsSnapshot | null {
  const relevant = state.telemetryQueue.filter((item) => item.roomId === roomId).slice(-20);
  const worldEventName = relevant
    .map((item) => item.payload.worldEventName)
    .find((value): value is string => typeof value === 'string') ?? null;
  const helperBlackout = relevant.some((item) => item.payload.helperBlackout === true);
  const haterRaidActive = relevant.some((item) => item.payload.haterRaidActive === true);
  if (!worldEventName && !helperBlackout && !haterRaidActive) {
    return null;
  }
  return {
    worldEventName,
    heatMultiplier01: (0.5 as unknown) as Score01,
    helperBlackout,
    haterRaidActive,
  };
}

function inferEconomySnapshot(state: ChatState, roomId: ChatRoomId): ChatEconomySnapshot | null {
  const relevant = state.telemetryQueue.filter((item) => item.roomId === roomId).slice(-20);
  const liquidity = relevant
    .map((item) => item.payload.liquidityStress01)
    .find((value): value is number => typeof value === 'number');
  const overpay = relevant
    .map((item) => item.payload.overpayRisk01)
    .find((value): value is number => typeof value === 'number');
  const bluff = relevant
    .map((item) => item.payload.bluffRisk01)
    .find((value): value is number => typeof value === 'number');

  if (liquidity === undefined && overpay === undefined && bluff === undefined) {
    return null;
  }

  return {
    activeDealCount: 0,
    liquidityStress01: ((liquidity ?? 0) as unknown) as Score01,
    overpayRisk01: ((overpay ?? 0) as unknown) as Score01,
    bluffRisk01: ((bluff ?? 0) as unknown) as Score01,
  };
}

// ============================================================================
// MARK: Diagnostic text analysis helpers
// ============================================================================

export function normalizeTextForDiagnostics(text: string): string {
  return trimRoomAwareWhitespace(normalizeUnicodeVariants(stripInvisibleRaw(text)))
    .replace(/\r\n/g, '\n')
    .replace(MULTISPACE_PATTERN, ' ')
    .replace(MULTIBREAK_PATTERN, '\n\n');
}

function normalizeForLexemeMatching(text: string): string {
  return normalizeTextForDiagnostics(text)
    .toLowerCase()
    .split('')
    .map((char) => LEET_SUBSTITUTIONS[char] ?? char)
    .join('');
}

function normalizeUnicodeVariants(text: string): string {
  return text
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[…]/g, '...')
    .replace(/[–—]/g, '-')
    .replace(TAGISH_PATTERN, (value) => (value.startsWith('<@') ? value : ''));
}

function trimRoomAwareWhitespace(text: string): string {
  return text
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
}

function stripInvisibleControls(text: string, working: MutableModerationWorkingSet): string {
  let output = text;
  for (const pattern of INVISIBLE_CONTROL_MARKERS) {
    if (pattern.test(output)) {
      working.risk.invisibleControl = Math.max(working.risk.invisibleControl, 0.85);
      output = output.replace(pattern, '');
    }
  }
  return output;
}

function stripInvisibleRaw(text: string): string {
  let output = text;
  for (const pattern of INVISIBLE_CONTROL_MARKERS) {
    output = output.replace(pattern, '');
  }
  return output;
}

function containsInvisibleControls(text: string): boolean {
  return INVISIBLE_CONTROL_MARKERS.some((pattern) => pattern.test(text));
}

function splitLogicalLines(text: string): string[] {
  return text.split(/\n/g);
}

function countUrls(text: string): number {
  return [...text.matchAll(URL_PATTERN)].length;
}

function longestEmojiLikeRun(text: string): number {
  const glyphs = [...text.matchAll(EMOJI_LIKE_PATTERN)].map((match) => ({
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
  }));

  let longest = 0;
  let current = 0;
  let previousEnd = -1;

  for (const glyph of glyphs) {
    if (glyph.start <= previousEnd + 1) {
      current += 1;
    } else {
      current = 1;
    }
    previousEnd = glyph.end;
    longest = Math.max(longest, current);
  }

  return longest;
}

function longestRepeatedCharacterRun(text: string): number {
  let longest = 1;
  let current = 1;
  const chars = [...text];
  for (let index = 1; index < chars.length; index += 1) {
    if (chars[index] === chars[index - 1]) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }
  return longest;
}

function countLetters(text: string): number {
  return [...text].filter((char) => /[A-Za-z]/.test(char)).length;
}

function countUppercase(text: string): number {
  return [...text].filter((char) => /[A-Z]/.test(char)).length;
}

function uppercaseRatio(text: string): number {
  const letters = countLetters(text);
  if (letters <= 0) {
    return 0;
  }
  return countUppercase(text) / letters;
}

function normalizeEmojiRun(text: string, maxRun: number): string {
  const parts = [...text.matchAll(EMOJI_LIKE_PATTERN)];
  if (parts.length === 0) {
    return text;
  }

  let result = '';
  let cursor = 0;
  let runCount = 0;
  let previousEnd = -1;

  for (const match of parts) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    result += text.slice(cursor, start);
    if (start <= previousEnd + 1) {
      runCount += 1;
    } else {
      runCount = 1;
    }
    if (runCount <= maxRun) {
      result += match[0];
    }
    previousEnd = end;
    cursor = end;
  }

  result += text.slice(cursor);
  return result;
}

function normalizeRepeatedCharacters(text: string): string {
  return text.replace(REPEATED_CHAR_PATTERN, (_full, char: string) => `${char}${char}${char}`);
}

function normalizeSentenceCase(text: string): string {
  const lowered = text.toLowerCase();
  return lowered.replace(/(^\s*[a-z])|([.!?]\s+[a-z])/g, (match) => match.toUpperCase());
}

function stripMarkdownLinkFormatting(text: string): string {
  return text.replace(MARKDOWN_LINK_PATTERN, (_full, url: string) => url);
}

function stripRedundantUrls(text: string): string {
  const seen = new Set<string>();
  return text.replace(URL_PATTERN, (url) => {
    const normalized = url.toLowerCase();
    if (seen.has(normalized)) {
      return '';
    }
    seen.add(normalized);
    return url;
  }).replace(/\s{2,}/g, ' ').trim();
}

function countLexeme(normalizedText: string, lexeme: string): number {
  const target = lexeme.toLowerCase();
  let index = 0;
  let count = 0;
  while (true) {
    const next = normalizedText.indexOf(target, index);
    if (next < 0) {
      break;
    }
    count += 1;
    index = next + target.length;
  }
  return count;
}

function maskCaseInsensitiveLexeme(text: string, lexeme: string): string {
  const escaped = escapeRegex(lexeme);
  return text.replace(new RegExp(escaped, 'giu'), (match) => '█'.repeat(match.length));
}

function containsPhoneOrEmailLeak(text: string): boolean {
  return EMAIL_PATTERN.test(text) || PHONEISH_PATTERN.test(text);
}

function containsFinancialLeakMarker(text: string): boolean {
  return CARDISH_DIGIT_PATTERN.test(text) || LONG_NUMBER_PATTERN.test(text);
}

function looksLikeInternalNegotiationLeak(text: string): boolean {
  const normalized = normalizeForLexemeMatching(text);
  return NEGOTIATION_LEAK_LEXEMES.some((lexeme) => normalized.includes(lexeme));
}

function looksLikeSwarmCommand(text: string): boolean {
  const normalized = normalizeForLexemeMatching(text);
  return CROWD_BAIT_LEXEMES.some((lexeme) => normalized.includes(lexeme));
}

function looksLikePanicDump(text: string): boolean {
  const normalized = normalizeForLexemeMatching(text);
  return normalized.includes('sell now') || normalized.includes('i am cooked') || normalized.includes('dump everything');
}

function looksLikeTranscriptFloodArtifact(text: string): boolean {
  const normalized = normalizeForLexemeMatching(text);
  return normalized.includes('aaaaaaaaaaaa') || normalized.includes('..............') || normalized.includes('!!!!!!!!!!!');
}

function looksLikeLiquidationPressure(text: string): boolean {
  const normalized = normalizeForLexemeMatching(text);
  return normalized.includes('liquid') || normalized.includes('margin') || normalized.includes('bleed');
}

function rewriteNpcToColdPressure(text: string): string {
  return text
    .replace(/kill yourself/giu, 'you are collapsing in public')
    .replace(/go die/giu, 'the board is not carrying you')
    .replace(/dox/giu, 'expose your weakness');
}

function softenNpcHarassment(text: string): string {
  return text
    .replace(/idiot/giu, 'unsteady')
    .replace(/loser/giu, 'off-balance')
    .replace(/trash/giu, 'misaligned')
    .replace(/worthless/giu, 'not positioned');
}

function convertHarassmentToColdObservation(text: string): string {
  return softenNpcHarassment(text)
    .replace(/!/g, '.')
    .replace(/\?{2,}/g, '?');
}

function intensifyRaidButStayNonviolent(text: string): string {
  if (looksLikeLiquidationPressure(text)) {
    return text;
  }
  return `${text.replace(/!/g, '.')} The room sees the weakness.`.trim();
}

function addLiquidationCadence(text: string): string {
  return `${text.trim()} Margin is narrowing.`.trim();
}

function clearHighRiskLexemes(working: MutableModerationWorkingSet): void {
  working.lexemeHits = working.lexemeHits.filter((hit) => hit.kind !== 'SELF_HARM' && hit.kind !== 'DOX');
  working.risk.selfHarm = 0;
  working.risk.doxLike = 0;
}

function isAllowedChatCommand(commandName: string, roomKind: ChatRoomKind): boolean {
  switch (commandName) {
    case 'help':
    case 'clear':
    case 'mood':
    case 'focus':
      return true;
    case 'offer':
    case 'counter':
      return roomKind === 'DEAL_ROOM';
    case 'ready':
      return roomKind === 'LOBBY';
    default:
      return false;
  }
}

function dedupeStrings(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================================================
// MARK: Public rule-bank creators for future extraction / composition
// ============================================================================

export function createSelfHarmRejectRule(): ChatModerationRule {
  return {
    id: 'reject-self-harm',
    description: 'Reject self-harm directives immediately.',
    applies: () => true,
    execute: (_args, working) => {
      if (working.lexemeHits.some((entry) => entry.kind === 'SELF_HARM')) {
        setOutcome(working, 'REJECT');
      }
    },
  };
}

export function createDoxQuarantineRule(): ChatModerationRule {
  return {
    id: 'quarantine-dox-like',
    description: 'Quarantine dox-like payloads into backend-only lanes.',
    applies: () => true,
    execute: (_args, working) => {
      if (working.lexemeHits.some((entry) => entry.kind === 'DOX') || working.risk.doxLike >= 0.85) {
        escalateToQuarantine(working, 'Quarantined by dox rule.');
      }
    },
  };
}

export function createNegotiationLeakShadowRule(): ChatModerationRule {
  return {
    id: 'shadow-negotiation-leak',
    description: 'Shadow-route internal negotiation leakage.',
    applies: (args) => args.room.roomKind === 'DEAL_ROOM',
    execute: (_args, working) => {
      if (working.risk.negotiationLeak >= 0.75) {
        shadowOnly(working, 'Negotiation leak shadowed by dedicated rule.');
      }
    },
  };
}

export function createCrowdBaitRule(): ChatModerationRule {
  return {
    id: 'crowd-bait-control',
    description: 'Prevent explicit swarm commands from becoming visible truth.',
    applies: () => true,
    execute: (_args, working) => {
      if (working.risk.crowdBait >= 0.7) {
        shadowOnly(working, 'Crowd-bait shadowed by dedicated rule.');
      }
    },
  };
}

export function runModerationRules(
  args: ChatCompositeModerationRequest,
  working: MutableModerationWorkingSet,
  rules: readonly ChatModerationRule[],
): MutableModerationWorkingSet {
  for (const rule of rules) {
    if (!rule.applies(args)) {
      continue;
    }
    rule.execute(args, working);
  }
  return working;
}

export function createDefaultModerationRules(): readonly ChatModerationRule[] {
  return Object.freeze([
    createSelfHarmRejectRule(),
    createDoxQuarantineRule(),
    createNegotiationLeakShadowRule(),
    createCrowdBaitRule(),
  ]);
}

// ============================================================================
// MARK: Human-readable explainers
// ============================================================================

export function explainModerationDecision(decision: ChatModerationDecision): string {
  switch (decision.outcome) {
    case 'ALLOW':
      return decision.reasons.join(' ') || 'Allowed as-authored.';
    case 'MASK':
      return `Masked and allowed. ${decision.reasons.join(' ')}`.trim();
    case 'REWRITE':
      return `Rewritten by backend moderation. ${decision.reasons.join(' ')}`.trim();
    case 'SHADOW_ONLY':
      return `Held out of visible transcript truth. ${decision.reasons.join(' ')}`.trim();
    case 'REJECT':
      return `Rejected before transcript mutation. ${decision.reasons.join(' ')}`.trim();
    case 'THROTTLE':
      return `Temporarily blocked by moderation posture. ${decision.reasons.join(' ')}`.trim();
    case 'QUARANTINE':
      return `Quarantined into backend-only review lanes. ${decision.reasons.join(' ')}`.trim();
    default:
      return decision.reasons.join(' ');
  }
}

export function summarizeLexemeHits(hits: readonly ChatModerationLexemeHit[]): string[] {
  return hits.map((hit) => `${hit.kind}:${hit.lexeme}×${hit.count}`);
}

export function summarizeRiskVector(risk: ChatModerationRiskVector): Readonly<Record<string, number>> {
  return {
    empty: risk.empty,
    oversize: risk.oversize,
    lineFlood: risk.lineFlood,
    urlSpam: risk.urlSpam,
    emojiFlood: risk.emojiFlood,
    charFlood: risk.charFlood,
    allCaps: risk.allCaps,
    doxLike: risk.doxLike,
    financialLeak: risk.financialLeak,
    selfHarm: risk.selfHarm,
    violentDirective: risk.violentDirective,
    negotiationLeak: risk.negotiationLeak,
    crowdBait: risk.crowdBait,
    harassment: risk.harassment,
    invisibleControl: risk.invisibleControl,
    commandAbuse: risk.commandAbuse,
    shadowWorthy: risk.shadowWorthy,
  };
}

// ============================================================================
// MARK: Bulk audits
// ============================================================================

export function auditAllRoomsModeration(
  context: ChatModerationPolicyContext,
  state: ChatState,
  now: UnixMs,
): readonly ChatModerationAuditRecord[] {
  const records: ChatModerationAuditRecord[] = [];
  for (const roomId of Object.keys(state.rooms) as ChatRoomId[]) {
    records.push(...auditRoomModerationEnvelope(context, state, roomId, now));
  }
  return Object.freeze(records);
}

export function countShadowModerationRecords(records: readonly ChatModerationAuditRecord[]): number {
  return records.filter((record) => record.diagnostic.shadowOnly).length;
}

export function countRejectedModerationRecords(records: readonly ChatModerationAuditRecord[]): number {
  return records.filter((record) => record.diagnostic.outcome === 'REJECT').length;
}

export function countQuarantinedModerationRecords(records: readonly ChatModerationAuditRecord[]): number {
  return records.filter((record) => record.diagnostic.outcome === 'QUARANTINE').length;
}

export function maxRoomModerationRisk(records: readonly ChatModerationAuditRecord[], roomId: ChatRoomId): number {
  return records
    .filter((record) => record.roomId === roomId)
    .reduce((max, record) => Math.max(max, aggregateRisk(record.diagnostic.risk)), 0);
}


function findActiveInvasionForRoom(state: ChatState, roomId: ChatRoomId): ChatInvasionState | null {
  for (const invasion of Object.values(state.activeInvasions)) {
    if (invasion.roomId === roomId) {
      return invasion;
    }
  }
  return null;
}
