/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT ML FEATURE INGESTOR
 * FILE: backend/src/game/engine/chat/ml/FeatureIngestor.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: OpenAI for Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical backend online-feature ingestion surface for authoritative chat.
 *
 * This module turns accepted backend chat truth into model-ready feature rows
 * without flattening the repo’s actual doctrine:
 *
 * - transport intent is not enough;
 * - normalized events are still not enough;
 * - only accepted backend chat truth becomes online-learning input;
 * - feature rows stay replayable, attributable, room-aware, and mode-aware;
 * - pressure, rescue, helper, hater, channel, crowd, silence, and room heat
 *   remain first-class;
 * - model families may share one authoritative fact pattern without each
 *   reinventing extraction.
 *
 * This file intentionally sits between reducer truth and ML policy. It does
 * not decide transcript authority, moderation law, or intervention outcomes.
 * It translates accepted authoritative state transitions into bounded rows that
 * the OnlineFeatureStore and downstream models can trust.
 * ============================================================================
 */

import {
  BACKEND_CHAT_ENGINE_VERSION,
  asUnixMs,
  clamp01,
  type ChatAffectSnapshot,
  type ChatAudienceHeat,
  type ChatEngineTransaction,
  type ChatEventKind,
  type ChatFeatureSnapshot,
  type ChatInvasionState,
  type ChatLearningProfile,
  type ChatMessage,
  type ChatMessageId,
  type ChatNormalizedInput,
  type ChatRoomId,
  type ChatRoomState,
  type ChatSessionId,
  type ChatSessionState,
  type ChatSignalEnvelope,
  type ChatState,
  type ChatTranscriptEntry,
  type ChatUserId,
  type ChatVisibleChannel,
  type JsonValue,
  type Nullable,
  type PressureTier,
  type Score01,
  type TickTier,
  type UnixMs,
} from '../types';
import {
  DEFAULT_BACKEND_CHAT_RUNTIME,
  mergeRuntimeConfig,
} from '../ChatRuntimeConfig';

// ============================================================================
// MARK: Module constants
// ============================================================================

export const CHAT_FEATURE_INGESTOR_MODULE_NAME =
  'PZO_BACKEND_CHAT_FEATURE_INGESTOR' as const;

export const CHAT_FEATURE_INGESTOR_VERSION =
  '2026.03.14-feature-ingestor.v1' as const;

export const CHAT_FEATURE_INGESTOR_RUNTIME_LAWS = Object.freeze([
  'Only accepted backend-authoritative chat truth may become online features.',
  'Event-local extraction is rich, but all windows remain bounded.',
  'A feature row must stay attributable to room, session, user, event, and message anchors.',
  'Model families may filter the same authoritative vector, but must not rewrite the underlying facts.',
  'Shadow-only activity may inform backend learning, yet it must remain explicitly tagged.',
  'Silence, rescue pressure, hater intensity, and audience heat are first-class features.',
  'Room mode and mount posture may shape interpretation, but not fabricate state.',
  'Canonical feature snapshots remain narrow and stable while rich rows may expand over time.',
] as const);

export const CHAT_FEATURE_INGESTOR_DEFAULTS = Object.freeze({
  transcriptWindowMessages: 64,
  transcriptWindowMs: 15 * 60_000,
  signalWindowMs: 6 * 60_000,
  staleSilenceMs: 20_000,
  hardSilenceMs: 60_000,
  helperIgnoreMs: 18_000,
  haterBurstMs: 10_000,
  shadowWeight: 0.55,
  maxTags: 20,
  maxScalarFeatures: 96,
  maxCategoricalFeatures: 48,
  includeShadowActivity: true,
  deriveFamilyRows: true,
} as const);

export const CHAT_MODEL_FAMILIES = [
  'ONLINE_CONTEXT',
  'ENGAGEMENT',
  'HATER_TARGETING',
  'HELPER_TIMING',
  'CHANNEL_AFFINITY',
  'TOXICITY',
  'CHURN',
  'INTERVENTION_POLICY',
] as const;

export type ChatModelFamily = (typeof CHAT_MODEL_FAMILIES)[number];

// ============================================================================
// MARK: Ports and public contracts
// ============================================================================

export interface ChatFeatureIngestorLoggerPort {
  debug(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  error(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

export interface ChatFeatureIngestorClockPort {
  now(): UnixMs;
}

export interface ChatFeatureIngestorHashPort {
  hash(input: string): string;
}

export interface ChatFeatureIngestorOptions {
  readonly logger?: ChatFeatureIngestorLoggerPort;
  readonly clock?: ChatFeatureIngestorClockPort;
  readonly hash?: ChatFeatureIngestorHashPort;
  readonly defaults?: Partial<typeof CHAT_FEATURE_INGESTOR_DEFAULTS>;
  readonly runtimeOverride?: Partial<typeof DEFAULT_BACKEND_CHAT_RUNTIME>;
}

export interface ChatFeatureAnchorSet {
  readonly eventId: string;
  readonly roomId: Nullable<ChatRoomId>;
  readonly sessionId: Nullable<ChatSessionId>;
  readonly userId: Nullable<ChatUserId>;
  readonly messageIds: readonly ChatMessageId[];
  readonly causalMessageIds: readonly ChatMessageId[];
  readonly replayAnchorKeys: readonly string[];
  readonly telemetryEventNames: readonly string[];
}

export interface ChatFeatureWindowSummary {
  readonly roomMessageCountWindow: number;
  readonly inboundNpcCountWindow: number;
  readonly outboundPlayerCountWindow: number;
  readonly ignoredHelperCountWindow: number;
  readonly haterBurstCountWindow: number;
  readonly helperMessageCountWindow: number;
  readonly visibleMessageCountWindow: number;
  readonly shadowMessageCountWindow: number;
  readonly uniqueSpeakersWindow: number;
  readonly silenceMs: number;
  readonly averageResponseMs: number;
  readonly averageMessageLength: number;
  readonly channelSwitchCountWindow: number;
  readonly roomMemberCount: number;
  readonly activeInvasionCount: number;
}

export interface ChatFeatureScalarMap {
  readonly [key: string]: number;
}

export interface ChatFeatureCategoricalMap {
  readonly [key: string]: string;
}

export interface ChatFeatureDiagnostics {
  readonly pressureTier: PressureTier;
  readonly tickTier: TickTier | 'UNKNOWN';
  readonly activeVisibleChannel: ChatVisibleChannel;
  readonly roomKind: string;
  readonly sourceEventKind: ChatEventKind;
  readonly sourceChannel: string;
  readonly contributorCount: number;
  readonly ingestorVersion: typeof CHAT_FEATURE_INGESTOR_VERSION;
}

export interface ChatFeatureRow {
  readonly rowId: string;
  readonly generatedAt: UnixMs;
  readonly family: ChatModelFamily;
  readonly roomId: Nullable<ChatRoomId>;
  readonly sessionId: Nullable<ChatSessionId>;
  readonly userId: Nullable<ChatUserId>;
  readonly entityKey: string;
  readonly entityKind: 'ROOM' | 'SESSION' | 'USER' | 'ROOM_USER' | 'SESSION_USER';
  readonly channelId: ChatVisibleChannel;
  readonly anchors: ChatFeatureAnchorSet;
  readonly window: ChatFeatureWindowSummary;
  readonly canonicalSnapshot: Nullable<ChatFeatureSnapshot>;
  readonly scalarFeatures: ChatFeatureScalarMap;
  readonly categoricalFeatures: ChatFeatureCategoricalMap;
  readonly tags: readonly string[];
  readonly diagnostics: ChatFeatureDiagnostics;
  readonly metadata: Readonly<Record<string, JsonValue>>;
  readonly signature: string;
}

export interface ChatFeatureIngestResult {
  readonly generatedAt: UnixMs;
  readonly acceptedEventId: string;
  readonly roomId: Nullable<ChatRoomId>;
  readonly sessionId: Nullable<ChatSessionId>;
  readonly userId: Nullable<ChatUserId>;
  readonly rows: readonly ChatFeatureRow[];
  readonly canonicalSnapshot: Nullable<ChatFeatureSnapshot>;
  readonly tags: readonly string[];
}

// ============================================================================
// MARK: Internal helpers
// ============================================================================

interface ChatFeatureContext {
  readonly now: UnixMs;
  readonly state: ChatState;
  readonly event: ChatNormalizedInput;
  readonly transaction: ChatEngineTransaction;
  readonly room: Nullable<ChatRoomState>;
  readonly session: Nullable<ChatSessionState>;
  readonly learningProfile: Nullable<ChatLearningProfile>;
  readonly activeChannel: ChatVisibleChannel;
  readonly transcriptWindow: readonly ChatTranscriptEntry[];
  readonly anchoredMessages: readonly ChatMessage[];
  readonly audienceHeat: Nullable<ChatAudienceHeat>;
  readonly invasions: readonly ChatInvasionState[];
  readonly signal: Nullable<ChatSignalEnvelope>;
  readonly affect: ChatAffectSnapshot;
  readonly pressureTier: PressureTier;
  readonly tickTier: TickTier | 'UNKNOWN';
  readonly contributorCount: number;
}

interface EntitySelection {
  readonly entityKind: ChatFeatureRow['entityKind'];
  readonly entityKey: string;
  readonly roomId: Nullable<ChatRoomId>;
  readonly sessionId: Nullable<ChatSessionId>;
  readonly userId: Nullable<ChatUserId>;
}

const DEFAULT_LOGGER: ChatFeatureIngestorLoggerPort = {
  debug: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

const DEFAULT_CLOCK: ChatFeatureIngestorClockPort = {
  now: () => asUnixMs(Date.now()),
};

const DEFAULT_HASH: ChatFeatureIngestorHashPort = {
  hash: (input) => hashString(input),
};

function safeNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function safeString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function safeBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asScore(value: number): Score01 {
  return clamp01(value) as Score01;
}

function mean(values: readonly number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function ratio(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return numerator / denominator;
}

function unique<T>(values: readonly T[]): readonly T[] {
  return Array.from(new Set(values));
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
}

function hashString(input: string): string {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `cf_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function normalizeChannel(value: Nullable<string>, fallback: ChatVisibleChannel): ChatVisibleChannel {
  if (value === 'GLOBAL' || value === 'SYNDICATE' || value === 'DEAL_ROOM' || value === 'LOBBY') {
    return value;
  }

  return fallback;
}

function roomMemberCount(state: ChatState, roomId: ChatRoomId): number {
  const roomPresence = state.presence.byRoom[roomId];
  return roomPresence ? Object.keys(roomPresence).length : 0;
}

function channelSwitchCount(entries: readonly ChatTranscriptEntry[], userId: Nullable<ChatUserId>): number {
  if (!userId) return 0;
  let lastChannel: Nullable<string> = null;
  let switches = 0;

  for (const entry of entries) {
    if (entry.message.attribution.authorUserId !== userId) continue;
    const current = entry.message.channelId;
    if (lastChannel && lastChannel !== current) {
      switches += 1;
    }
    lastChannel = current;
  }

  return switches;
}

function messageAverageLength(messages: readonly ChatMessage[]): number {
  if (!messages.length) return 0;
  return mean(messages.map((message) => message.plainText.length));
}

function collectResponseIntervals(
  entries: readonly ChatTranscriptEntry[],
  userId: Nullable<ChatUserId>,
): readonly number[] {
  if (!userId) return [];
  const intervals: number[] = [];
  let lastInboundAt: Nullable<number> = null;

  for (const entry of entries) {
    const authoredByUser = entry.message.attribution.authorUserId === userId;
    const inbound = !authoredByUser && entry.message.attribution.sourceType !== 'SYSTEM';

    if (inbound) {
      lastInboundAt = entry.message.createdAt;
      continue;
    }

    if (authoredByUser && lastInboundAt) {
      intervals.push(Math.max(0, entry.message.createdAt - lastInboundAt));
      lastInboundAt = null;
    }
  }

  return intervals;
}

function computeAffect(
  profile: Nullable<ChatLearningProfile>,
  messages: readonly ChatMessage[],
  audienceHeat: Nullable<ChatAudienceHeat>,
  signal: Nullable<ChatSignalEnvelope>,
): ChatAffectSnapshot {
  const base = profile?.affect ?? {
    confidence01: asScore(0.48),
    frustration01: asScore(0.22),
    intimidation01: asScore(0.18),
    attachment01: asScore(0.14),
    curiosity01: asScore(0.22),
    embarrassment01: asScore(0.10),
    relief01: asScore(0.08),
  };

  const helperCount = messages.filter((message) => message.attribution.npcRole === 'HELPER').length;
  const haterCount = messages.filter((message) => message.attribution.npcRole === 'HATER').length;
  const recentNegative = messages.filter((message) => message.tags.includes('negative') || message.tags.includes('attack')).length;
  const recentPositive = messages.filter((message) => message.tags.includes('positive') || message.tags.includes('rescue')).length;
  const heat = audienceHeat?.heat01 ?? asScore(0.18);
  const hostileMomentum = (signal?.battle?.hostileMomentum ?? 20) / 100;
  const rescueOpen = signal?.battle?.rescueWindowOpen ?? false;

  return Object.freeze({
    confidence01: asScore(clamp01(base.confidence01 + recentPositive * 0.04 - recentNegative * 0.03 - hostileMomentum * 0.08)),
    frustration01: asScore(clamp01(base.frustration01 + haterCount * 0.06 + hostileMomentum * 0.14 + heat * 0.12)),
    intimidation01: asScore(clamp01(base.intimidation01 + hostileMomentum * 0.18 + haterCount * 0.08)),
    attachment01: asScore(clamp01(base.attachment01 + helperCount * 0.06 + recentPositive * 0.04)),
    curiosity01: asScore(clamp01(base.curiosity01 + (signal?.liveops?.worldEventName ? 0.12 : 0) + (signal?.economy?.activeDealCount ? 0.04 : 0))),
    embarrassment01: asScore(clamp01(base.embarrassment01 + (audienceHeat?.swarmDirection === 'NEGATIVE' ? 0.16 : 0) + recentNegative * 0.03)),
    relief01: asScore(clamp01(base.relief01 + (rescueOpen ? 0.18 : 0) + helperCount * 0.05 - haterCount * 0.02)),
  });
}

function derivePressureTier(signal: Nullable<ChatSignalEnvelope>): PressureTier {
  return signal?.battle?.pressureTier ?? 'BUILDING';
}

function deriveTickTier(signal: Nullable<ChatSignalEnvelope>): TickTier | 'UNKNOWN' {
  return signal?.run?.tickTier ?? 'UNKNOWN';
}

function deriveHostileMomentum01(signal: Nullable<ChatSignalEnvelope>, entries: readonly ChatTranscriptEntry[]): Score01 {
  const signalMomentum = signal?.battle?.hostileMomentum ? signal.battle.hostileMomentum / 100 : 0;
  const recentHaterShare = ratio(
    entries.filter((entry) => entry.message.attribution.npcRole === 'HATER').length,
    Math.max(entries.length, 1),
  );

  return asScore(clamp01(signalMomentum * 0.68 + recentHaterShare * 0.32));
}

function deriveChurnRisk01(
  profile: Nullable<ChatLearningProfile>,
  silenceMs: number,
  affect: ChatAffectSnapshot,
  entries: readonly ChatTranscriptEntry[],
  defaults: typeof CHAT_FEATURE_INGESTOR_DEFAULTS,
): Score01 {
  const baseline = profile?.churnRisk01 ?? asScore(0.18);
  const silenceRisk = clamp01(ratio(silenceMs, defaults.hardSilenceMs));
  const frustration = affect.frustration01;
  const embarrassment = affect.embarrassment01;
  const helperIgnored = entries.filter((entry) => entry.message.attribution.npcRole === 'HELPER' && entry.message.createdAt <= asUnixMs((entry.appendedAt as number) - defaults.helperIgnoreMs)).length;

  return asScore(
    clamp01(
      baseline * 0.34 +
        silenceRisk * 0.22 +
        frustration * 0.16 +
        embarrassment * 0.14 +
        clamp01(ratio(helperIgnored, 3)) * 0.14,
    ),
  );
}

function selectTranscriptWindow(
  state: ChatState,
  roomId: Nullable<ChatRoomId>,
  now: UnixMs,
  defaults: typeof CHAT_FEATURE_INGESTOR_DEFAULTS,
): readonly ChatTranscriptEntry[] {
  if (!roomId) return [];
  const entries = state.transcript.byRoom[roomId] ?? [];
  const cutoff = (now as number) - defaults.transcriptWindowMs;
  return entries
    .filter((entry) => (entry.appendedAt as number) >= cutoff)
    .slice(-defaults.transcriptWindowMessages);
}

function selectAnchoredMessages(transaction: ChatEngineTransaction): readonly ChatMessage[] {
  return transaction.delta?.appendedMessages ?? [];
}

function selectSignal(event: ChatNormalizedInput): Nullable<ChatSignalEnvelope> {
  return event.kind === 'BATTLE_SIGNAL' ||
    event.kind === 'RUN_SIGNAL' ||
    event.kind === 'MULTIPLAYER_SIGNAL' ||
    event.kind === 'ECONOMY_SIGNAL' ||
    event.kind === 'LIVEOPS_SIGNAL'
    ? (event.payload as ChatSignalEnvelope)
    : null;
}

function inferSourceChannel(event: ChatNormalizedInput, room: Nullable<ChatRoomState>): string {
  if ('requestedVisibleChannel' in event.payload && event.payload.requestedVisibleChannel) {
    return String(event.payload.requestedVisibleChannel);
  }

  if ('channelId' in event.payload && event.payload.channelId) {
    return String(event.payload.channelId);
  }

  return room?.activeVisibleChannel ?? 'GLOBAL';
}

function buildAnchorSet(
  transaction: ChatEngineTransaction,
  roomId: Nullable<ChatRoomId>,
  sessionId: Nullable<ChatSessionId>,
  userId: Nullable<ChatUserId>,
): ChatFeatureAnchorSet {
  const appended = transaction.delta?.appendedMessages ?? [];
  const proofEdges = transaction.delta?.proofEdges ?? [];
  const replayArtifacts = transaction.delta?.replayArtifacts ?? [];
  const telemetry = transaction.delta?.telemetry ?? [];

  return Object.freeze({
    eventId: transaction.event.eventId,
    roomId,
    sessionId,
    userId,
    messageIds: appended.map((message) => message.id),
    causalMessageIds: unique(
      appended.flatMap((message) => message.proof.causalParentMessageIds),
    ),
    replayAnchorKeys: unique(
      replayArtifacts.map((artifact) => artifact.anchorKey),
    ),
    telemetryEventNames: unique(
      telemetry.map((envelope) => envelope.eventName),
    ),
  });
}

function buildWindowSummary(
  context: ChatFeatureContext,
  defaults: typeof CHAT_FEATURE_INGESTOR_DEFAULTS,
): ChatFeatureWindowSummary {
  const entries = context.transcriptWindow;
  const messages = entries.map((entry) => entry.message);
  const authoredByPlayer = messages.filter((message) => message.attribution.authorUserId === context.event.userId);
  const inboundNpc = messages.filter((message) => message.attribution.npcRole !== null);
  const helperMessages = messages.filter((message) => message.attribution.npcRole === 'HELPER');
  const haterMessages = messages.filter((message) => message.attribution.npcRole === 'HATER');
  const visibleMessages = entries.filter((entry) => entry.visibility === 'VISIBLE');
  const shadowMessages = entries.filter((entry) => entry.visibility === 'SHADOW');
  const ignoredHelperCount = helperMessages.filter((message) => {
    const anyPlayerResponseAfter = messages.some(
      (candidate) =>
        candidate.attribution.authorUserId === context.event.userId &&
        (candidate.createdAt as number) > (message.createdAt as number) &&
        (candidate.createdAt as number) <= (message.createdAt as number) + defaults.helperIgnoreMs,
    );
    return !anyPlayerResponseAfter;
  }).length;

  const latestMessageAt = messages.length
    ? Math.max(...messages.map((message) => message.createdAt as number))
    : null;
  const silenceMs = latestMessageAt ? Math.max(0, (context.now as number) - latestMessageAt) : defaults.hardSilenceMs;
  const responseIntervals = collectResponseIntervals(entries, context.event.userId);

  return Object.freeze({
    roomMessageCountWindow: entries.length,
    inboundNpcCountWindow: inboundNpc.length,
    outboundPlayerCountWindow: authoredByPlayer.length,
    ignoredHelperCountWindow: ignoredHelperCount,
    haterBurstCountWindow: haterMessages.filter((message) => (context.now as number) - (message.createdAt as number) <= defaults.haterBurstMs).length,
    helperMessageCountWindow: helperMessages.length,
    visibleMessageCountWindow: visibleMessages.length,
    shadowMessageCountWindow: shadowMessages.length,
    uniqueSpeakersWindow: unique(messages.map((message) => message.attribution.actorId)).length,
    silenceMs,
    averageResponseMs: mean(responseIntervals),
    averageMessageLength: messageAverageLength(messages),
    channelSwitchCountWindow: channelSwitchCount(entries, context.event.userId),
    roomMemberCount: context.room ? roomMemberCount(context.state, context.room.roomId) : 0,
    activeInvasionCount: context.invasions.length,
  });
}

function deriveEntitySelections(context: ChatFeatureContext): readonly EntitySelection[] {
  const entities: EntitySelection[] = [];

  if (context.room?.roomId) {
    entities.push({
      entityKind: 'ROOM',
      entityKey: `ROOM:${context.room.roomId}`,
      roomId: context.room.roomId,
      sessionId: null,
      userId: null,
    });
  }

  if (context.session?.identity.sessionId) {
    entities.push({
      entityKind: 'SESSION',
      entityKey: `SESSION:${context.session.identity.sessionId}`,
      roomId: context.room?.roomId ?? null,
      sessionId: context.session.identity.sessionId,
      userId: null,
    });
  }

  if (context.session?.identity.userId) {
    entities.push({
      entityKind: 'USER',
      entityKey: `USER:${context.session.identity.userId}`,
      roomId: null,
      sessionId: null,
      userId: context.session.identity.userId,
    });
  }

  if (context.room?.roomId && context.session?.identity.userId) {
    entities.push({
      entityKind: 'ROOM_USER',
      entityKey: `ROOM_USER:${context.room.roomId}:${context.session.identity.userId}`,
      roomId: context.room.roomId,
      sessionId: null,
      userId: context.session.identity.userId,
    });
  }

  if (context.session?.identity.sessionId && context.session.identity.userId) {
    entities.push({
      entityKind: 'SESSION_USER',
      entityKey: `SESSION_USER:${context.session.identity.sessionId}:${context.session.identity.userId}`,
      roomId: context.room?.roomId ?? null,
      sessionId: context.session.identity.sessionId,
      userId: context.session.identity.userId,
    });
  }

  return entities;
}

function buildCanonicalSnapshot(
  context: ChatFeatureContext,
  window: ChatFeatureWindowSummary,
): Nullable<ChatFeatureSnapshot> {
  if (!context.room?.roomId || !context.session?.identity.userId) {
    return null;
  }

  return Object.freeze({
    generatedAt: context.now,
    userId: context.session.identity.userId,
    roomId: context.room.roomId,
    messageCountWindow: window.roomMessageCountWindow,
    inboundNpcCountWindow: window.inboundNpcCountWindow,
    outboundPlayerCountWindow: window.outboundPlayerCountWindow,
    ignoredHelperCountWindow: window.ignoredHelperCountWindow,
    pressureTier: context.pressureTier,
    hostileMomentum01: deriveHostileMomentum01(context.signal, context.transcriptWindow),
    roomHeat01: context.audienceHeat?.heat01 ?? asScore(0.16),
    affect: context.affect,
    churnRisk01: deriveChurnRisk01(context.learningProfile, window.silenceMs, context.affect, context.transcriptWindow, CHAT_FEATURE_INGESTOR_DEFAULTS),
  });
}

function buildScalarFeatures(
  context: ChatFeatureContext,
  window: ChatFeatureWindowSummary,
  canonicalSnapshot: Nullable<ChatFeatureSnapshot>,
): ChatFeatureScalarMap {
  const signal = context.signal;
  const roomHeat01 = context.audienceHeat?.heat01 ?? asScore(0.16);
  const hostileMomentum01 = canonicalSnapshot?.hostileMomentum01 ?? asScore(0.18);
  const churnRisk01 = canonicalSnapshot?.churnRisk01 ?? asScore(0.20);
  const helperReceptivity01 = context.learningProfile?.helperReceptivity01 ?? asScore(0.44);
  const haterSusceptibility01 = context.learningProfile?.haterSusceptibility01 ?? asScore(0.36);
  const negotiationAggression01 = context.learningProfile?.negotiationAggression01 ?? asScore(0.42);
  const channelAffinity = context.learningProfile?.channelAffinity;
  const responseCadence01 = asScore(clamp01(1 - ratio(window.averageResponseMs, 14_000)));
  const silenceConcern01 = asScore(clamp01(ratio(window.silenceMs, CHAT_FEATURE_INGESTOR_DEFAULTS.hardSilenceMs)));
  const helperIgnore01 = asScore(clamp01(ratio(window.ignoredHelperCountWindow, 3)));
  const invasionPressure01 = asScore(clamp01(ratio(window.activeInvasionCount, 2)));
  const visibilityExposure01 = asScore(
    clamp01(
      ratio(window.visibleMessageCountWindow, Math.max(window.visibleMessageCountWindow + window.shadowMessageCountWindow, 1)),
    ),
  );
  const recentPlayerShare01 = asScore(
    clamp01(ratio(window.outboundPlayerCountWindow, Math.max(window.roomMessageCountWindow, 1))),
  );
  const recentNpcShare01 = asScore(
    clamp01(ratio(window.inboundNpcCountWindow, Math.max(window.roomMessageCountWindow, 1))),
  );
  const helperDensity01 = asScore(
    clamp01(ratio(window.helperMessageCountWindow, Math.max(window.roomMessageCountWindow, 1))),
  );
  const haterDensity01 = asScore(
    clamp01(ratio(window.haterBurstCountWindow, Math.max(window.roomMessageCountWindow, 1))),
  );
  const roomCrowding01 = asScore(clamp01(ratio(window.roomMemberCount, 12)));
  const switchStress01 = asScore(clamp01(ratio(window.channelSwitchCountWindow, 5)));
  const averageMessageLength01 = asScore(clamp01(ratio(window.averageMessageLength, 280)));
  const rescueOpportunity01 = asScore(
    clamp01(
      signal?.battle?.rescueWindowOpen
        ? 0.82
        : helperReceptivity01 * 0.40 + (1 - silenceConcern01) * 0.16 + (1 - helperIgnore01) * 0.18,
    ),
  );
  const toxicityRisk01 = asScore(
    clamp01(
      hostileMomentum01 * 0.36 +
        haterDensity01 * 0.20 +
        context.affect.frustration01 * 0.16 +
        context.affect.intimidation01 * 0.10 +
        roomHeat01 * (context.audienceHeat?.swarmDirection === 'NEGATIVE' ? 0.18 : 0.08),
    ),
  );

  return Object.freeze(limitScalarFeatures({
    eventAccepted01: 1,
    roomHeat01,
    hostileMomentum01,
    churnRisk01,
    helperReceptivity01,
    haterSusceptibility01,
    negotiationAggression01,
    responseCadence01,
    silenceConcern01,
    helperIgnore01,
    invasionPressure01,
    visibilityExposure01,
    recentPlayerShare01,
    recentNpcShare01,
    helperDensity01,
    haterDensity01,
    roomCrowding01,
    switchStress01,
    averageMessageLength01,
    rescueOpportunity01,
    toxicityRisk01,
    confidence01: context.affect.confidence01,
    frustration01: context.affect.frustration01,
    intimidation01: context.affect.intimidation01,
    attachment01: context.affect.attachment01,
    curiosity01: context.affect.curiosity01,
    embarrassment01: context.affect.embarrassment01,
    relief01: context.affect.relief01,
    pressureNone01: context.pressureTier === 'NONE' ? 1 : 0,
    pressureBuilding01: context.pressureTier === 'BUILDING' ? 1 : 0,
    pressureElevated01: context.pressureTier === 'ELEVATED' ? 1 : 0,
    pressureHigh01: context.pressureTier === 'HIGH' ? 1 : 0,
    pressureCritical01: context.pressureTier === 'CRITICAL' ? 1 : 0,
    tickSetup01: context.tickTier === 'SETUP' ? 1 : 0,
    tickWindow01: context.tickTier === 'WINDOW' ? 1 : 0,
    tickCommit01: context.tickTier === 'COMMIT' ? 1 : 0,
    tickResolution01: context.tickTier === 'RESOLUTION' ? 1 : 0,
    tickSeal01: context.tickTier === 'SEAL' ? 1 : 0,
    battleShieldIntegrity01: signal?.battle?.shieldIntegrity01 ?? 0,
    battleRescueWindowOpen01: signal?.battle?.rescueWindowOpen ? 1 : 0,
    battleLastAttackRecent01: signal?.battle?.lastAttackAt
      ? clamp01(1 - ratio((context.now as number) - (signal.battle.lastAttackAt as number), CHAT_FEATURE_INGESTOR_DEFAULTS.signalWindowMs))
      : 0,
    runElapsedPressure01: signal?.run ? clamp01(ratio(signal.run.elapsedMs, 20 * 60_000)) : 0,
    runBankruptcyWarning01: signal?.run?.bankruptcyWarning ? 1 : 0,
    runNearSovereignty01: signal?.run?.nearSovereignty ? 1 : 0,
    multiplayerRankingPressure01: signal?.multiplayer ? clamp01(signal.multiplayer.rankingPressure / 100) : 0,
    multiplayerPartySize01: signal?.multiplayer ? clamp01(ratio(signal.multiplayer.partySize, 4)) : 0,
    economyLiquidityStress01: signal?.economy?.liquidityStress01 ?? 0,
    economyOverpayRisk01: signal?.economy?.overpayRisk01 ?? 0,
    economyBluffRisk01: signal?.economy?.bluffRisk01 ?? 0,
    liveopsHeatMultiplier01: signal?.liveops?.heatMultiplier01 ?? 0,
    liveopsHelperBlackout01: signal?.liveops?.helperBlackout ? 1 : 0,
    liveopsHaterRaid01: signal?.liveops?.haterRaidActive ? 1 : 0,
    affinityGlobal01: channelAffinity?.GLOBAL ?? 0.25,
    affinitySyndicate01: channelAffinity?.SYNDICATE ?? 0.25,
    affinityDealRoom01: channelAffinity?.DEAL_ROOM ?? 0.25,
    affinityLobby01: channelAffinity?.LOBBY ?? 0.25,
  }, CHAT_FEATURE_INGESTOR_DEFAULTS.maxScalarFeatures));
}

function buildCategoricalFeatures(
  context: ChatFeatureContext,
  window: ChatFeatureWindowSummary,
): ChatFeatureCategoricalMap {
  const sourceChannel = inferSourceChannel(context.event, context.room);
  const signal = context.signal;

  return Object.freeze(limitCategoricalFeatures({
    engineVersion: BACKEND_CHAT_ENGINE_VERSION,
    roomKind: context.room?.roomKind ?? 'UNKNOWN',
    activeVisibleChannel: context.activeChannel,
    sourceEventKind: context.event.kind,
    sourceChannel,
    tickTier: context.tickTier,
    pressureTier: context.pressureTier,
    roomStageMood: context.room?.stageMood ?? 'FOCUSED',
    roomSwarmDirection: context.audienceHeat?.swarmDirection ?? 'NEUTRAL',
    sourceAttackType: signal?.battle?.activeAttackType ?? 'NONE',
    sourceBotId: signal?.battle?.activeBotId ?? 'NONE',
    runPhase: signal?.run?.runPhase ?? 'UNKNOWN',
    runOutcome: signal?.run?.outcome ?? 'UNKNOWN',
    factionName: signal?.multiplayer?.factionName ?? 'NONE',
    worldEventName: signal?.liveops?.worldEventName ?? 'NONE',
    invasionState: window.activeInvasionCount > 0 ? 'ACTIVE' : 'CLEAR',
    contributorBand: window.uniqueSpeakersWindow >= 6 ? 'SWARM' : window.uniqueSpeakersWindow >= 3 ? 'ACTIVE' : 'QUIET',
    silenceBand: window.silenceMs >= CHAT_FEATURE_INGESTOR_DEFAULTS.hardSilenceMs ? 'HARD' : window.silenceMs >= CHAT_FEATURE_INGESTOR_DEFAULTS.staleSilenceMs ? 'STALE' : 'FRESH',
  }, CHAT_FEATURE_INGESTOR_DEFAULTS.maxCategoricalFeatures));
}

function buildTags(
  context: ChatFeatureContext,
  window: ChatFeatureWindowSummary,
  canonicalSnapshot: Nullable<ChatFeatureSnapshot>,
): readonly string[] {
  const tags: string[] = [];

  tags.push(`event:${context.event.kind.toLowerCase()}`);
  tags.push(`room_kind:${(context.room?.roomKind ?? 'unknown').toLowerCase()}`);
  tags.push(`channel:${context.activeChannel.toLowerCase()}`);
  tags.push(`pressure:${context.pressureTier.toLowerCase()}`);

  if (context.tickTier !== 'UNKNOWN') tags.push(`tick:${context.tickTier.toLowerCase()}`);
  if (window.activeInvasionCount > 0) tags.push('active_invasion');
  if (window.ignoredHelperCountWindow > 0) tags.push('helper_ignored');
  if (window.haterBurstCountWindow > 0) tags.push('hater_burst');
  if (window.silenceMs >= CHAT_FEATURE_INGESTOR_DEFAULTS.staleSilenceMs) tags.push('stale_silence');
  if ((canonicalSnapshot?.churnRisk01 ?? 0) >= 0.66) tags.push('churn_watch');
  if ((canonicalSnapshot?.hostileMomentum01 ?? 0) >= 0.66) tags.push('hostile_momentum');
  if ((context.audienceHeat?.swarmDirection ?? 'NEUTRAL') === 'NEGATIVE') tags.push('negative_swarm');
  if (context.signal?.battle?.rescueWindowOpen) tags.push('rescue_window_open');
  if (context.signal?.run?.nearSovereignty) tags.push('near_sovereignty');
  if (context.signal?.run?.bankruptcyWarning) tags.push('bankruptcy_warning');
  if (context.signal?.liveops?.helperBlackout) tags.push('helper_blackout');
  if (context.signal?.liveops?.haterRaidActive) tags.push('hater_raid');
  if (context.room?.activeLegendId) tags.push('legend_room');

  return Object.freeze(tags.slice(0, CHAT_FEATURE_INGESTOR_DEFAULTS.maxTags));
}

function contributorCount(transaction: ChatEngineTransaction): number {
  const delta = transaction.delta;
  if (!delta) return 1;

  return unique([
    ...delta.appendedMessages.map((message) => message.attribution.actorId),
    ...delta.learningProfilesTouched,
    ...delta.proofEdges.map((edge) => edge.edgeType),
    ...delta.telemetry.map((entry) => entry.eventName),
  ]).length;
}

function limitScalarFeatures(
  features: Record<string, number>,
  max: number,
): ChatFeatureScalarMap {
  const entries = Object.entries(features)
    .filter(([, value]) => Number.isFinite(value))
    .slice(0, max)
    .sort(([left], [right]) => left.localeCompare(right));

  return Object.freeze(Object.fromEntries(entries));
}

function limitCategoricalFeatures(
  features: Record<string, string>,
  max: number,
): ChatFeatureCategoricalMap {
  const entries = Object.entries(features)
    .map(([key, value]) => [key, safeString(value, 'UNKNOWN')] as const)
    .slice(0, max)
    .sort(([left], [right]) => left.localeCompare(right));

  return Object.freeze(Object.fromEntries(entries));
}

function filterScalarFeaturesByFamily(
  scalarFeatures: ChatFeatureScalarMap,
  family: ChatModelFamily,
): ChatFeatureScalarMap {
  const prefixesByFamily: Readonly<Record<ChatModelFamily, readonly string[]>> = Object.freeze({
    ONLINE_CONTEXT: ['event', 'room', 'visibility', 'pressure', 'tick', 'battle', 'run', 'multiplayer', 'economy', 'liveops', 'affinity', 'confidence', 'frustration', 'intimidation', 'attachment', 'curiosity', 'embarrassment', 'relief'],
    ENGAGEMENT: ['recent', 'response', 'averageMessageLength', 'roomHeat', 'confidence', 'attachment', 'curiosity', 'affinity'],
    HATER_TARGETING: ['hostileMomentum', 'hater', 'toxicity', 'intimidation', 'frustration', 'visibility', 'pressure'],
    HELPER_TIMING: ['helper', 'rescue', 'silence', 'confidence', 'frustration', 'relief', 'churn'],
    CHANNEL_AFFINITY: ['affinity', 'switch', 'roomCrowding', 'economy', 'multiplayer', 'visibility'],
    TOXICITY: ['toxicity', 'hostileMomentum', 'hater', 'frustration', 'embarrassment', 'roomHeat', 'negative'],
    CHURN: ['churn', 'silence', 'helperIgnore', 'frustration', 'embarrassment', 'response', 'rescue', 'roomHeat'],
    INTERVENTION_POLICY: ['churn', 'helper', 'hater', 'rescue', 'roomHeat', 'hostileMomentum', 'toxicity', 'confidence', 'frustration', 'economy'],
  });

  const prefixes = prefixesByFamily[family];
  const filtered = Object.entries(scalarFeatures).filter(([key]) =>
    prefixes.some((prefix) => key.startsWith(prefix)),
  );

  return Object.freeze(Object.fromEntries(filtered.length ? filtered : Object.entries(scalarFeatures)));
}

function buildRowSignature(row: Omit<ChatFeatureRow, 'signature'>, hash: ChatFeatureIngestorHashPort): string {
  return hash.hash(
    stableStringify({
      family: row.family,
      entityKey: row.entityKey,
      eventId: row.anchors.eventId,
      generatedAt: row.generatedAt,
      scalarFeatures: row.scalarFeatures,
      categoricalFeatures: row.categoricalFeatures,
      tags: row.tags,
    }),
  );
}

// ============================================================================
// MARK: Feature ingestor
// ============================================================================

export class ChatFeatureIngestor {
  private readonly logger: ChatFeatureIngestorLoggerPort;
  private readonly clock: ChatFeatureIngestorClockPort;
  private readonly hash: ChatFeatureIngestorHashPort;
  private readonly defaults: typeof CHAT_FEATURE_INGESTOR_DEFAULTS;
  private readonly runtime: typeof DEFAULT_BACKEND_CHAT_RUNTIME;

  public constructor(options: ChatFeatureIngestorOptions = {}) {
    this.logger = options.logger ?? DEFAULT_LOGGER;
    this.clock = options.clock ?? DEFAULT_CLOCK;
    this.hash = options.hash ?? DEFAULT_HASH;
    this.defaults = Object.freeze({
      ...CHAT_FEATURE_INGESTOR_DEFAULTS,
      ...(options.defaults ?? {}),
    });
    this.runtime = mergeRuntimeConfig(options.runtimeOverride ?? {});
  }

  public ingestTransaction(transaction: ChatEngineTransaction): ChatFeatureIngestResult {
    const now = this.clock.now();
    const state = transaction.state;
    const roomId = transaction.event.roomId;
    const sessionId = transaction.event.sessionId;
    const userId = transaction.event.userId;
    const room = roomId ? state.rooms[roomId] ?? null : null;
    const session = sessionId ? state.sessions[sessionId] ?? null : null;
    const learningProfile = userId ? state.learningProfiles[userId] ?? null : null;
    const transcriptWindow = selectTranscriptWindow(state, roomId, now, this.defaults);
    const audienceHeat = roomId ? state.audienceHeatByRoom[roomId] ?? null : null;
    const invasions = roomId
      ? Object.values(state.activeInvasions).filter((invasion) => invasion.roomId === roomId)
      : [];
    const signal = selectSignal(transaction.event);
    const activeChannel = normalizeChannel(
      inferSourceChannel(transaction.event, room),
      room?.activeVisibleChannel ?? 'GLOBAL',
    );

    const affect = computeAffect(
      learningProfile,
      transcriptWindow.map((entry) => entry.message),
      audienceHeat,
      signal,
    );

    const context: ChatFeatureContext = Object.freeze({
      now,
      state,
      event: transaction.event,
      transaction,
      room,
      session,
      learningProfile,
      activeChannel,
      transcriptWindow,
      anchoredMessages: selectAnchoredMessages(transaction),
      audienceHeat,
      invasions,
      signal,
      affect,
      pressureTier: derivePressureTier(signal),
      tickTier: deriveTickTier(signal),
      contributorCount: contributorCount(transaction),
    });

    const window = buildWindowSummary(context, this.defaults);
    const canonicalSnapshot = buildCanonicalSnapshot(context, window);
    const scalarFeatures = buildScalarFeatures(context, window, canonicalSnapshot);
    const categoricalFeatures = buildCategoricalFeatures(context, window);
    const tags = buildTags(context, window, canonicalSnapshot);
    const anchors = buildAnchorSet(transaction, roomId, sessionId, userId);
    const diagnostics: ChatFeatureDiagnostics = Object.freeze({
      pressureTier: context.pressureTier,
      tickTier: context.tickTier,
      activeVisibleChannel: context.activeChannel,
      roomKind: context.room?.roomKind ?? 'UNKNOWN',
      sourceEventKind: context.event.kind,
      sourceChannel: inferSourceChannel(context.event, context.room),
      contributorCount: context.contributorCount,
      ingestorVersion: CHAT_FEATURE_INGESTOR_VERSION,
    });

    const metadata: Readonly<Record<string, JsonValue>> = Object.freeze({
      transactionAccepted: transaction.accepted,
      transactionRejected: transaction.rejected,
      rejectionReasons: transaction.rejectionReasons,
      fanoutRooms: transaction.fanout.map((packet) => packet.roomId),
      runtimeLearningEnabled: this.runtime.learningPolicy.enabled,
      runtimeShadowChannelsEnabled: this.runtime.allowShadowChannels.length > 0,
    });

    const entities = deriveEntitySelections(context);
    const familyRows = this.defaults.deriveFamilyRows
      ? CHAT_MODEL_FAMILIES
      : (['ONLINE_CONTEXT'] as const);

    const rows: ChatFeatureRow[] = [];

    for (const entity of entities) {
      for (const family of familyRows) {
        const baseRow = {
          rowId: this.hash.hash(`${transaction.event.eventId}:${entity.entityKey}:${family}:${now}`),
          generatedAt: now,
          family,
          roomId: entity.roomId,
          sessionId: entity.sessionId,
          userId: entity.userId,
          entityKey: entity.entityKey,
          entityKind: entity.entityKind,
          channelId: context.activeChannel,
          anchors,
          window,
          canonicalSnapshot,
          scalarFeatures: filterScalarFeaturesByFamily(scalarFeatures, family),
          categoricalFeatures,
          tags,
          diagnostics,
          metadata,
        } as const;

        rows.push(
          Object.freeze({
            ...baseRow,
            signature: buildRowSignature(baseRow, this.hash),
          }),
        );
      }
    }

    if (!rows.length) {
      this.logger.warn('ChatFeatureIngestor emitted no rows for accepted transaction.', {
        eventId: transaction.event.eventId,
        accepted: transaction.accepted,
        roomId: roomId ?? null,
        sessionId: sessionId ?? null,
      });
    }

    return Object.freeze({
      generatedAt: now,
      acceptedEventId: transaction.event.eventId,
      roomId,
      sessionId,
      userId,
      rows: Object.freeze(rows),
      canonicalSnapshot,
      tags,
    });
  }
}

// ============================================================================
// MARK: Public helpers
// ============================================================================

export function createChatFeatureIngestor(
  options: ChatFeatureIngestorOptions = {},
): ChatFeatureIngestor {
  return new ChatFeatureIngestor(options);
}

export function ingestChatFeatures(
  transaction: ChatEngineTransaction,
  options: ChatFeatureIngestorOptions = {},
): ChatFeatureIngestResult {
  return createChatFeatureIngestor(options).ingestTransaction(transaction);
}

export const CHAT_FEATURE_INGESTOR_NAMESPACE = Object.freeze({
  moduleName: CHAT_FEATURE_INGESTOR_MODULE_NAME,
  version: CHAT_FEATURE_INGESTOR_VERSION,
  runtimeLaws: CHAT_FEATURE_INGESTOR_RUNTIME_LAWS,
  defaults: CHAT_FEATURE_INGESTOR_DEFAULTS,
  modelFamilies: CHAT_MODEL_FAMILIES,
  create: createChatFeatureIngestor,
  ingest: ingestChatFeatures,
} as const);

export default ChatFeatureIngestor;
