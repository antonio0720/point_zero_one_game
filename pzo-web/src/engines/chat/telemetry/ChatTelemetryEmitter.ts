/**
 * ============================================================================
 * POINT ZERO ONE — UNIFIED CHAT TELEMETRY EMITTER
 * FILE: pzo-web/src/engines/chat/telemetry/ChatTelemetryEmitter.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Frontend authority for chat telemetry capture inside the new canonical
 * pzo-web/src/engines/chat lane.
 *
 * This emitter is intentionally deeper than a generic analytics helper.
 * It is the chat-side instrumentation spine that:
 *
 * 1. captures real player, NPC, system, replay, channel, invasion, rescue,
 *    learning, and moderation moments,
 * 2. normalizes them into stable envelopes for queue / transport / storage,
 * 3. snapshots the surrounding run state without making the telemetry layer
 *    own the engine stores,
 * 4. protects privacy by default while still preserving gameplay-meaningful
 *    learning signals,
 * 5. supports cold-start / learning handoff from second-one behavior,
 * 6. bridges engine events into chat-domain telemetry without flattening
 *    existing event contracts,
 * 7. keeps enough local history for optimistic UI, retry, diagnostics, and
 *    replay-side inspection,
 * 8. remains transport-agnostic so pzo-server/src/chat and backend chat
 *    authority can stay authoritative.
 *
 * Design Doctrine
 * ---------------
 * - frontend owns capture, batching, local buffering, optimistic fanout,
 *   and fast feature assembly
 * - backend owns transcript truth, learning profile truth, moderation truth,
 *   and permanent storage
 * - this emitter must be able to run with real queue + schema companions later,
 *   but it also needs to be useful immediately while those files are still
 *   landing in the canonical chat tree
 * - stores are read through injected accessors, not imported as ownership
 * - raw chat text is never emitted by default; only safe summaries, counts,
 *   hashes, classifications, and compact previews
 * - replay, legend, rescue, negotiation, and learning handoff are first-class
 *   telemetry domains, not afterthoughts
 *
 * Repo Alignment
 * --------------
 * This file is shaped against the currently visible repo surfaces:
 * - pzo-web/src/components/chat/useChatEngine.ts
 * - pzo-web/src/components/chat/ChatPanel.tsx
 * - frontend/apps/web/components/chat/SovereignChatKernel.ts
 * - frontend/apps/web/components/chat/GameEventChatBridge.ts
 * - frontend/apps/web/components/chat/HaterDialogueTrees.ts
 * - frontend/apps/web/components/chat/HelperCharacters.ts
 * - pzo-web/src/telemetry/runTimeTelemetry.ts
 * - pzo-web/src/telemetry/pressureTelemetry.ts
 * - pzo-web/src/engines/core/EventBus.ts
 *
 * This emitter therefore understands:
 * - engine event names already in the EventBus bridge
 * - bot / hater pressure language already used in current chat donors
 * - cold-start / helper cadence logic described in the older kernel lane
 * - run / pressure / shield / sovereignty context already central to the repo
 *
 * ============================================================================
 */

import type { EventBus, EngineEventName } from '../../core/EventBus';

/* ========================================================================== *
 * Section 1 — Stable public telemetry types
 * ========================================================================== */

export type ChatTelemetryChannel =
  | 'GLOBAL'
  | 'SYNDICATE'
  | 'DEAL_ROOM'
  | 'LOBBY'
  | 'SYSTEM_SHADOW'
  | 'NPC_SHADOW'
  | 'RIVALRY_SHADOW'
  | 'RESCUE_SHADOW'
  | 'LIVEOPS_SHADOW'
  | (string & {});

export type ChatTelemetrySenderRole =
  | 'PLAYER'
  | 'NPC'
  | 'HELPER'
  | 'HATER'
  | 'SYSTEM'
  | 'LIVEOPS'
  | 'MODERATOR'
  | 'UNKNOWN';

export type ChatTelemetrySeverity =
  | 'TRACE'
  | 'INFO'
  | 'NOTICE'
  | 'WARNING'
  | 'CRITICAL';

export type ChatTelemetryOrigin =
  | 'UI'
  | 'ENGINE'
  | 'EVENT_BUS'
  | 'SOCKET'
  | 'NPC'
  | 'SYSTEM'
  | 'REPLAY'
  | 'LEARNING'
  | 'QUEUE'
  | 'MANUAL';

export type ChatTelemetryEventName =
  | 'CHAT_SESSION_STARTED'
  | 'CHAT_SESSION_ENDED'
  | 'CHAT_OPENED'
  | 'CHAT_CLOSED'
  | 'CHAT_COLLAPSED'
  | 'CHAT_EXPANDED'
  | 'CHAT_RENDERED'
  | 'CHANNEL_SELECTED'
  | 'CHANNEL_VIEWED'
  | 'CHANNEL_MUTED'
  | 'CHANNEL_UNMUTED'
  | 'ROOM_BOUND'
  | 'ROOM_UNBOUND'
  | 'COMPOSER_FOCUSED'
  | 'COMPOSER_BLURRED'
  | 'COMPOSER_DRAFT_CHANGED'
  | 'COMPOSER_COMMAND_DETECTED'
  | 'COMPOSER_ATTACHMENT_STAGED'
  | 'MESSAGE_SEND_REQUESTED'
  | 'MESSAGE_SEND_QUEUED'
  | 'MESSAGE_SENT'
  | 'MESSAGE_SEND_FAILED'
  | 'MESSAGE_RECEIVED'
  | 'MESSAGE_RENDERED'
  | 'MESSAGE_SUPPRESSED'
  | 'MESSAGE_REDACTED'
  | 'MESSAGE_ACTION_TRIGGERED'
  | 'THREAD_OPENED'
  | 'THREAD_CLOSED'
  | 'TYPING_STARTED'
  | 'TYPING_STOPPED'
  | 'PRESENCE_CHANGED'
  | 'READ_RECEIPT_RENDERED'
  | 'DELIVERY_RECEIPT_RENDERED'
  | 'NPC_TYPING_STARTED'
  | 'NPC_TYPING_STOPPED'
  | 'NPC_MESSAGE_PLANNED'
  | 'NPC_MESSAGE_RENDERED'
  | 'NPC_RESPONSE_SKIPPED'
  | 'NPC_CADENCE_ESCALATED'
  | 'NPC_CADENCE_DAMPENED'
  | 'HATER_TARGET_LOCKED'
  | 'HATER_TAUNT_RENDERED'
  | 'HELPER_INTERVENTION_TRIGGERED'
  | 'HELPER_INTERVENTION_SKIPPED'
  | 'AUDIENCE_HEAT_CHANGED'
  | 'INVASION_TRIGGERED'
  | 'INVASION_RESOLVED'
  | 'NEGOTIATION_SIGNAL_CAPTURED'
  | 'NEGOTIATION_COUNTER_WINDOW_OPENED'
  | 'RECOVERY_PROMPT_TRIGGERED'
  | 'RECOVERY_PROMPT_ACCEPTED'
  | 'RECOVERY_PROMPT_DISMISSED'
  | 'LEGEND_MOMENT_CAPTURED'
  | 'PROOF_BADGE_RENDERED'
  | 'PROOF_HASH_EXPOSED'
  | 'REPLAY_OPENED'
  | 'REPLAY_CLOSED'
  | 'REPLAY_RANGE_REQUESTED'
  | 'REPLAY_RANGE_LOADED'
  | 'REPLAY_SLICE_EXPORTED'
  | 'REPLAY_LEGEND_JUMPED'
  | 'LEARNING_FEATURE_SNAPSHOT'
  | 'LEARNING_HANDOFF_REQUESTED'
  | 'LEARNING_HANDOFF_ACKED'
  | 'INFERENCE_REQUESTED'
  | 'INFERENCE_COMPLETED'
  | 'INFERENCE_FAILED'
  | 'MODERATION_WARNING_RENDERED'
  | 'MODERATION_ENFORCEMENT_APPLIED'
  | 'SOCKET_CONNECTED'
  | 'SOCKET_DISCONNECTED'
  | 'SOCKET_RECONNECTING'
  | 'QUEUE_ENQUEUED'
  | 'QUEUE_FLUSHED'
  | 'QUEUE_DROPPED'
  | 'QUEUE_RETRIED'
  | 'ENGINE_EVENT_INGESTED'
  | 'ENGINE_EVENT_IGNORED'
  | 'PERFORMANCE_MARK'
  | 'DIAGNOSTIC';

export interface ChatTelemetryHash {
  algorithm: 'fnv1a-32';
  value: string;
}

export interface ChatTelemetrySafeTextSummary {
  charCount: number;
  tokenEstimate: number;
  lineCount: number;
  mentionCount: number;
  emojiCount: number;
  looksLikeCommand: boolean;
  containsUrl: boolean;
  containsQuestion: boolean;
  containsNumericOffer: boolean;
  containsProfanityRisk: boolean;
  firstWordLowerHash?: ChatTelemetryHash;
  bodyHash?: ChatTelemetryHash;
  preview?: string;
}

export interface ChatTelemetryRunSnapshot {
  runId?: string;
  playerId?: string;
  profileId?: string;
  roomId?: string;
  modeId?: string;
  modeVariantId?: string;
  tickIndex?: number;
  tickTier?: string;
  pressureScore?: number;
  pressureTier?: string;
  tensionScore?: number;
  tensionQueueDepth?: number;
  battleHeat?: number;
  battleWave?: number;
  battlePhase?: string;
  shieldIntegrityTotal?: number;
  shieldBreachedLayerCount?: number;
  shieldFortified?: boolean;
  sovereigntyScore?: number;
  sovereigntyGrade?: string;
  income?: number;
  expenses?: number;
  cash?: number;
  netWorth?: number;
  activeCardWindow?: boolean;
  activeDecisionWindow?: boolean;
  activeChannel?: ChatTelemetryChannel;
  activeNpcId?: string;
  activeHaterId?: string;
  activeHelperId?: string;
  activeLegendMomentId?: string;
  isInReplay?: boolean;
  isInRecoveryFlow?: boolean;
  isInNegotiationFlow?: boolean;
  isOffline?: boolean;
}

export interface ChatTelemetryLearningSnapshot {
  coldStartProfileId?: string;
  engagementScore?: number;
  dropOffRisk?: number;
  toxicityRisk?: number;
  confidenceScore?: number;
  embarrassmentScore?: number;
  intimidationScore?: number;
  curiosityScore?: number;
  attachmentScore?: number;
  helperUrgency?: number;
  haterAggression?: number;
  channelAffinityGlobal?: number;
  channelAffinitySyndicate?: number;
  channelAffinityDealRoom?: number;
  featureRevision?: number;
}

export interface ChatTelemetryPerformanceMark {
  label: string;
  startedAtMs?: number;
  completedAtMs?: number;
  durationMs?: number;
}

export interface ChatTelemetryEnvelope<
  TPayload extends Record<string, unknown> = Record<string, unknown>,
> {
  schemaVersion: 1;
  seq: number;
  eventId: string;
  eventName: ChatTelemetryEventName;
  severity: ChatTelemetrySeverity;
  origin: ChatTelemetryOrigin;
  timestampMs: number;
  sessionId: string;
  traceId?: string;
  dedupeKey?: string;
  sampleRate: number;
  payload: TPayload;
  run: ChatTelemetryRunSnapshot;
  learning?: ChatTelemetryLearningSnapshot;
  performance?: ChatTelemetryPerformanceMark;
  tags: string[];
}

export interface ChatTelemetryListener {
  (envelope: ChatTelemetryEnvelope): void;
}

export interface ChatTelemetryQueueLike {
  enqueue(batch: readonly ChatTelemetryEnvelope[]): Promise<void> | void;
}

export interface ChatTelemetryFeatureSnapshotBuilder {
  (): ChatTelemetryLearningSnapshot | undefined;
}

export interface ChatTelemetryTransportLike {
  send(batch: readonly ChatTelemetryEnvelope[]): Promise<void> | void;
}

export interface ChatTelemetryLoggerLike {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

export interface ChatTelemetryReplayReference {
  replayId?: string;
  sliceId?: string;
  cursorStart?: number;
  cursorEnd?: number;
  momentId?: string;
  legendId?: string;
}

export interface ChatTelemetryDraftSummary {
  safeText: ChatTelemetrySafeTextSummary;
  attachmentCount: number;
  replyToMessageId?: string;
  isWhisper?: boolean;
  isNegotiationOffer?: boolean;
  isCounterplayReply?: boolean;
  draftVersion?: number;
}

export interface ChatTelemetryConfig {
  enabled: boolean;
  debug: boolean;
  sessionPrefix: string;
  tracePrefix: string;
  maxLocalHistory: number;
  maxPendingBatch: number;
  maxFlushBatch: number;
  flushIntervalMs: number;
  idleFlushIntervalMs: number;
  synchronousFlushEventNames: ReadonlySet<ChatTelemetryEventName>;
  dedupeWindowMs: number;
  perEventThrottleMs: Partial<Record<ChatTelemetryEventName, number>>;
  dropOldestWhenFull: boolean;
  includeSafePreview: boolean;
  safePreviewMaxChars: number;
  hashBodies: boolean;
  captureLearningSnapshots: boolean;
  emitQueueLifecycle: boolean;
  emitPerformanceMarks: boolean;
  emitDebugDiagnostics: boolean;
  privacy: {
    includeRoomIds: boolean;
    includeProfileIds: boolean;
    includePlayerIds: boolean;
    includeOfferValues: boolean;
    includeReplyTargets: boolean;
  };
  sampling: Partial<Record<ChatTelemetryEventName, number>>;
}

export interface ChatTelemetrySessionSeed {
  sessionId?: string;
  traceId?: string;
  roomId?: string;
  modeId?: string;
  playerId?: string;
  profileId?: string;
}

export interface ChatTelemetryRuntimeAccessors {
  getRunSnapshot?: () => Partial<ChatTelemetryRunSnapshot> | undefined;
  getRoomId?: () => string | undefined;
  getModeId?: () => string | undefined;
  getPlayerId?: () => string | undefined;
  getProfileId?: () => string | undefined;
  getActiveChannel?: () => ChatTelemetryChannel | undefined;
  getLearningSnapshot?: ChatTelemetryFeatureSnapshotBuilder;
}

export interface ChatTelemetryEmitterDependencies {
  eventBus?: EventBus;
  queue?: ChatTelemetryQueueLike;
  transport?: ChatTelemetryTransportLike;
  logger?: ChatTelemetryLoggerLike;
  runtime?: ChatTelemetryRuntimeAccessors;
  config?: Partial<ChatTelemetryConfig>;
  now?: () => number;
  random?: () => number;
  session?: ChatTelemetrySessionSeed;
}

const DEFAULT_SYNCHRONOUS_EVENTS: ReadonlySet<ChatTelemetryEventName> = new Set([
  'CHAT_SESSION_ENDED',
  'MESSAGE_SEND_FAILED',
  'LEGEND_MOMENT_CAPTURED',
  'MODERATION_ENFORCEMENT_APPLIED',
  'QUEUE_DROPPED',
  'QUEUE_FLUSHED',
  'INFERENCE_FAILED',
]);

const DEFAULT_PER_EVENT_THROTTLE_MS: Partial<Record<ChatTelemetryEventName, number>> = {
  CHAT_RENDERED: 2_500,
  CHANNEL_VIEWED: 1_500,
  TYPING_STARTED: 800,
  TYPING_STOPPED: 800,
  NPC_TYPING_STARTED: 1_200,
  NPC_TYPING_STOPPED: 1_200,
  PRESENCE_CHANGED: 500,
  AUDIENCE_HEAT_CHANGED: 1_000,
  PERFORMANCE_MARK: 250,
};

const DEFAULT_SAMPLING: Partial<Record<ChatTelemetryEventName, number>> = {
  DIAGNOSTIC: 0.2,
  PERFORMANCE_MARK: 0.35,
  CHAT_RENDERED: 0.5,
  CHANNEL_VIEWED: 0.75,
};

const DEFAULT_CHAT_TELEMETRY_CONFIG: ChatTelemetryConfig = {
  enabled: true,
  debug: false,
  sessionPrefix: 'chat_sess',
  tracePrefix: 'chat_trace',
  maxLocalHistory: 4_096,
  maxPendingBatch: 1_024,
  maxFlushBatch: 64,
  flushIntervalMs: 3_000,
  idleFlushIntervalMs: 10_000,
  synchronousFlushEventNames: DEFAULT_SYNCHRONOUS_EVENTS,
  dedupeWindowMs: 180,
  perEventThrottleMs: DEFAULT_PER_EVENT_THROTTLE_MS,
  dropOldestWhenFull: true,
  includeSafePreview: true,
  safePreviewMaxChars: 64,
  hashBodies: true,
  captureLearningSnapshots: true,
  emitQueueLifecycle: true,
  emitPerformanceMarks: true,
  emitDebugDiagnostics: false,
  privacy: {
    includeRoomIds: true,
    includeProfileIds: false,
    includePlayerIds: false,
    includeOfferValues: true,
    includeReplyTargets: true,
  },
  sampling: DEFAULT_SAMPLING,
};

const DEFAULT_LOGGER: ChatTelemetryLoggerLike = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

function mergeChatTelemetryConfig(
  override?: Partial<ChatTelemetryConfig>,
): ChatTelemetryConfig {
  if (!override) {
    return { ...DEFAULT_CHAT_TELEMETRY_CONFIG };
  }

  return {
    ...DEFAULT_CHAT_TELEMETRY_CONFIG,
    ...override,
    synchronousFlushEventNames:
      override.synchronousFlushEventNames ??
      DEFAULT_CHAT_TELEMETRY_CONFIG.synchronousFlushEventNames,
    perEventThrottleMs: {
      ...DEFAULT_CHAT_TELEMETRY_CONFIG.perEventThrottleMs,
      ...override.perEventThrottleMs,
    },
    sampling: {
      ...DEFAULT_CHAT_TELEMETRY_CONFIG.sampling,
      ...override.sampling,
    },
    privacy: {
      ...DEFAULT_CHAT_TELEMETRY_CONFIG.privacy,
      ...override.privacy,
    },
  };
}

function createSessionId(
  prefix: string,
  now: () => number,
  random: () => number,
): string {
  const entropy = Math.floor(random() * 1_000_000_000)
    .toString(36)
    .padStart(6, '0');
  return `${prefix}_${now().toString(36)}_${entropy}`;
}

function createTraceId(
  prefix: string,
  now: () => number,
  random: () => number,
): string {
  const entropyA = Math.floor(random() * 0xfffffff)
    .toString(16)
    .padStart(7, '0');
  const entropyB = Math.floor(random() * 0xfffffff)
    .toString(16)
    .padStart(7, '0');
  return `${prefix}_${now().toString(36)}_${entropyA}${entropyB}`;
}

function fnv1a32(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function summarizeText(
  rawText: string,
  safePreviewMaxChars: number,
  includePreview: boolean,
  includeHash: boolean,
): ChatTelemetrySafeTextSummary {
  const text = compactWhitespace(rawText);
  const wordCount = text.length === 0 ? 0 : text.split(' ').filter(Boolean).length;
  const mentionCount = (text.match(/[@#][\w-]+/g) ?? []).length;
  const emojiCount = (text.match(/[\u{1F300}-\u{1FAFF}]/gu) ?? []).length;
  const containsUrl = /(https?:\/\/|www\.)/i.test(text);
  const containsQuestion = /\?/.test(text);
  const containsNumericOffer = /[$€£]\s?\d|(?:\d[\d,.]*)(?:\s?(?:k|m|b|%))/i.test(text);
  const containsProfanityRisk = /\b(?:damn|hell|shit|fuck|asshole|bitch)\b/i.test(text);
  const looksLikeCommand = /^\/[\w-]+/.test(text);

  return {
    charCount: rawText.length,
    tokenEstimate: wordCount,
    lineCount: rawText.length === 0 ? 0 : rawText.split(/\r?\n/).length,
    mentionCount,
    emojiCount,
    looksLikeCommand,
    containsUrl,
    containsQuestion,
    containsNumericOffer,
    containsProfanityRisk,
    firstWordLowerHash:
      includeHash && wordCount > 0
        ? { algorithm: 'fnv1a-32', value: fnv1a32(text.split(' ')[0].toLowerCase()) }
        : undefined,
    bodyHash:
      includeHash && text.length > 0
        ? { algorithm: 'fnv1a-32', value: fnv1a32(text) }
        : undefined,
    preview:
      includePreview && text.length > 0
        ? text.slice(0, safePreviewMaxChars)
        : undefined,
  };
}

function safeNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function safeString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function clampSampleRate(value: number | undefined): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 1;
  }
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function shouldSample(
  eventName: ChatTelemetryEventName,
  config: ChatTelemetryConfig,
  random: () => number,
): number {
  const eventSampleRate = clampSampleRate(config.sampling[eventName]);
  if (eventSampleRate >= 1) {
    return 1;
  }
  if (random() <= eventSampleRate) {
    return eventSampleRate;
  }
  return 0;
}

function toTagSet(tags: readonly string[]): string[] {
  const unique = new Set<string>();
  for (const tag of tags) {
    const compacted = compactWhitespace(tag);
    if (compacted.length > 0) {
      unique.add(compacted);
    }
  }
  return Array.from(unique.values());
}

function normalizeSeverity(
  eventName: ChatTelemetryEventName,
  explicit?: ChatTelemetrySeverity,
): ChatTelemetrySeverity {
  if (explicit) {
    return explicit;
  }

  switch (eventName) {
    case 'MESSAGE_SEND_FAILED':
    case 'INVASION_TRIGGERED':
    case 'MODERATION_ENFORCEMENT_APPLIED':
    case 'INFERENCE_FAILED':
    case 'QUEUE_DROPPED':
      return 'CRITICAL';
    case 'HELPER_INTERVENTION_TRIGGERED':
    case 'RECOVERY_PROMPT_TRIGGERED':
    case 'SOCKET_RECONNECTING':
    case 'QUEUE_RETRIED':
      return 'WARNING';
    case 'LEGEND_MOMENT_CAPTURED':
    case 'PROOF_BADGE_RENDERED':
    case 'INFERENCE_COMPLETED':
      return 'NOTICE';
    case 'DIAGNOSTIC':
    case 'PERFORMANCE_MARK':
      return 'TRACE';
    default:
      return 'INFO';
  }
}

function toArray<T>(value: readonly T[] | undefined): readonly T[] {
  return Array.isArray(value) ? value : [];
}

export interface ChatOpenedPayload {
  trigger: 'mount' | 'toggle' | 'hotkey' | 'route' | 'system' | 'recovery';
  channel?: ChatTelemetryChannel;
  roomId?: string;
  sourceSurface?: string;
  wasCollapsed?: boolean;
}

export interface ChatClosedPayload {
  trigger: 'toggle' | 'route' | 'system' | 'unmount';
  channel?: ChatTelemetryChannel;
  roomId?: string;
  lifetimeMs?: number;
}

export interface ChannelSelectedPayload {
  fromChannel?: ChatTelemetryChannel;
  toChannel: ChatTelemetryChannel;
  sourceSurface?: string;
  hasUnread?: boolean;
  roomId?: string;
}

export interface MessageSendRequestedPayload {
  channel: ChatTelemetryChannel;
  roomId?: string;
  senderRole: ChatTelemetrySenderRole;
  senderId?: string;
  draft: ChatTelemetryDraftSummary;
  clientMessageId?: string;
  negotiationContext?: {
    offerValue?: number;
    assetId?: string;
    isCounter?: boolean;
  };
}

export interface MessageSendResultPayload {
  clientMessageId?: string;
  serverMessageId?: string;
  channel: ChatTelemetryChannel;
  roomId?: string;
  senderRole: ChatTelemetrySenderRole;
  roundTripMs?: number;
  queueLatencyMs?: number;
  transport: 'socket' | 'http' | 'offline-buffer' | 'local-only';
  failureCode?: string;
}

export interface MessageReceivedPayload {
  serverMessageId?: string;
  channel: ChatTelemetryChannel;
  roomId?: string;
  senderRole: ChatTelemetrySenderRole;
  senderId?: string;
  senderName?: string;
  safeText?: ChatTelemetrySafeTextSummary;
  kind?: string;
  replyToMessageId?: string;
  legendId?: string;
  proofHash?: string;
  replay?: ChatTelemetryReplayReference;
}

export interface NpcResponsePlannedPayload {
  npcId: string;
  npcRole: 'HATER' | 'HELPER' | 'AMBIENT';
  channel: ChatTelemetryChannel;
  roomId?: string;
  reason:
    | 'ENGINE_EVENT'
    | 'CHANNEL_HEAT'
    | 'CADENCE'
    | 'HELPER_RESCUE'
    | 'INVASION'
    | 'NEGOTIATION'
    | 'POSTRUN'
    | 'MANUAL';
  scheduledDelayMs?: number;
  suppressible?: boolean;
  contextEventName?: string;
}

export interface InvasionTriggeredPayload {
  invasionId: string;
  haterId?: string;
  channel: ChatTelemetryChannel;
  roomId?: string;
  triggerEvent?: string;
  intensity?: number;
  sceneId?: string;
  audienceHeat?: number;
}

export interface RecoveryPromptPayload {
  helperId?: string;
  recoveryId: string;
  channel: ChatTelemetryChannel;
  roomId?: string;
  reason:
    | 'DROP_OFF_RISK'
    | 'LONG_SILENCE'
    | 'RAPID_FAILURE'
    | 'NEGATIVE_SIGNAL'
    | 'ALT_CHANNEL_HOP'
    | 'BANKRUPTCY_NEAR';
  predictedDropOffRisk?: number;
  recommendedAction?: string;
}

export interface LegendMomentPayload {
  legendId: string;
  momentType:
    | 'SOVEREIGNTY'
    | 'COUNTERPLAY'
    | 'HUMILIATION_REVERSAL'
    | 'MIRACLE_RESCUE'
    | 'LAST_SECOND_COMEBACK'
    | 'PERFECT_NEGOTIATION'
    | 'OTHER';
  replay?: ChatTelemetryReplayReference;
  proofHash?: string;
  channel?: ChatTelemetryChannel;
  roomId?: string;
}

export interface ReplayOpenedPayload {
  replay: ChatTelemetryReplayReference;
  channel?: ChatTelemetryChannel;
  roomId?: string;
  trigger: 'drawer' | 'legend' | 'result-screen' | 'proof-card' | 'system';
}

export interface LearningFeatureSnapshotPayload {
  featureSet: ChatTelemetryLearningSnapshot;
  reason:
    | 'CHAT_OPEN'
    | 'MESSAGE_SEND'
    | 'MESSAGE_RECEIVE'
    | 'CHANNEL_SWITCH'
    | 'INVASION'
    | 'RECOVERY'
    | 'MANUAL';
}

export interface PerformanceMarkPayload {
  mark: ChatTelemetryPerformanceMark;
  subsystem:
    | 'RENDER'
    | 'QUEUE'
    | 'SOCKET'
    | 'INFERENCE'
    | 'NPC'
    | 'REPLAY'
    | 'COMPOSER'
    | 'GENERAL';
}

export interface EngineEventIngestedPayload {
  engineEventName: string;
  roomId?: string;
  channel?: ChatTelemetryChannel;
  bridgePath:
    | 'EVENT_BUS_TO_CHAT'
    | 'ENGINE_TO_CHAT'
    | 'SOCKET_TO_CHAT'
    | 'MANUAL';
  summary?: string;
}

class InMemoryTelemetryQueue implements ChatTelemetryQueueLike {
  private readonly batches: ChatTelemetryEnvelope[][] = [];

  public enqueue(batch: readonly ChatTelemetryEnvelope[]): void {
    this.batches.push([...batch]);
  }

  public drain(): ChatTelemetryEnvelope[] {
    const drained = this.batches.flatMap((batch) => batch);
    this.batches.length = 0;
    return drained;
  }
}

export class ChatTelemetryEmitter {
  private readonly now: () => number;
  private readonly random: () => number;
  private readonly logger: ChatTelemetryLoggerLike;
  private readonly runtime: ChatTelemetryRuntimeAccessors;
  private readonly config: ChatTelemetryConfig;
  private readonly queue: ChatTelemetryQueueLike;
  private readonly transport?: ChatTelemetryTransportLike;

  private eventBus?: EventBus;
  private readonly listeners = new Set<ChatTelemetryListener>();
  private readonly localHistory: ChatTelemetryEnvelope[] = [];
  private readonly pendingBatch: ChatTelemetryEnvelope[] = [];
  private readonly perfMarks = new Map<string, number>();
  private readonly lastEmitAtByDedupe = new Map<string, number>();
  private readonly lastEmitAtByEvent = new Map<ChatTelemetryEventName, number>();
  private readonly openedAtByChannel = new Map<ChatTelemetryChannel, number>();
  private flushTimer: ReturnType<typeof setTimeout> | undefined;
  private idleFlushTimer: ReturnType<typeof setTimeout> | undefined;
  private sessionId: string;
  private traceId: string;
  private seq = 0;
  private sessionStartedAtMs: number;
  private activeRoomId?: string;
  private activeModeId?: string;
  private activeChannel?: ChatTelemetryChannel;
  private bound = false;
  private disposed = false;

  public constructor(deps: ChatTelemetryEmitterDependencies = {}) {
    this.now = deps.now ?? (() => Date.now());
    this.random = deps.random ?? (() => Math.random());
    this.logger = deps.logger ?? DEFAULT_LOGGER;
    this.runtime = deps.runtime ?? {};
    this.config = mergeChatTelemetryConfig(deps.config);
    this.queue = deps.queue ?? new InMemoryTelemetryQueue();
    this.transport = deps.transport;
    this.sessionId = deps.session?.sessionId ?? createSessionId(this.config.sessionPrefix, this.now, this.random);
    this.traceId = deps.session?.traceId ?? createTraceId(this.config.tracePrefix, this.now, this.random);
    this.activeRoomId = deps.session?.roomId;
    this.activeModeId = deps.session?.modeId;
    this.activeChannel = this.runtime.getActiveChannel?.();
    this.sessionStartedAtMs = this.now();
    if (deps.eventBus) this.bindEventBus(deps.eventBus);
    this.scheduleFlush();
    this.scheduleIdleFlush();
  }

  public bindEventBus(eventBus: EventBus): void {
    if (this.bound || this.disposed) {
      this.eventBus = eventBus;
      return;
    }
    this.eventBus = eventBus;
    this.bound = true;
    const forward = (eventName: EngineEventName, payload: Record<string, unknown>) => {
      this.captureEngineEventIngested({
        engineEventName: eventName,
        bridgePath: 'EVENT_BUS_TO_CHAT',
        summary: this.summarizeEngineEventPayload(eventName, payload),
        roomId: safeString(payload.roomId) ?? this.activeRoomId,
        channel: (safeString(payload.channel) as ChatTelemetryChannel | undefined) ?? this.activeChannel,
      });
      this.handleEngineEventSideEffects(eventName, payload);
    };
    const knownEngineEvents: EngineEventName[] = [
      'RUN_STARTED','RUN_ENDED','TIME_TIER_CHANGED','PRESSURE_TIER_CHANGED','SHIELD_LAYER_BREACHED','SHIELD_FORTIFIED','BATTLE_ATTACK_FIRED','BATTLE_PHASE_CHANGED','CASCADE_CHAIN_STARTED','CASCADE_CHAIN_BROKEN','CARD_PLAYED','CARD_FORCED','CARD_WINDOW_OPENED','CARD_WINDOW_EXPIRED','SOVEREIGNTY_PROOF_GENERATED','SOVEREIGNTY_GRADE_ASSIGNED','MECHANIC_FIRED','MECHANICS_TICK_COMPLETE',
    ];
    for (const eventName of knownEngineEvents) {
      try { eventBus.register(eventName, (payload) => forward(eventName, payload)); } catch (error) {
        this.logger.warn('ChatTelemetryEmitter failed to bind engine event', { eventName, error: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  public startSession(payload: ChatOpenedPayload): ChatTelemetryEnvelope | undefined { return this.emit('CHAT_SESSION_STARTED', payload, { origin: 'UI', tags: ['session', 'chat'], dedupeKey: 'session_started', severity: 'INFO' }); }
  public endSession(reason: ChatClosedPayload['trigger']): ChatTelemetryEnvelope | undefined {
    const envelope = this.emit('CHAT_SESSION_ENDED', { trigger: reason, lifetimeMs: this.now() - this.sessionStartedAtMs, roomId: this.activeRoomId, channel: this.activeChannel }, { origin: 'UI', tags: ['session', 'chat'], dedupeKey: `session_ended:${reason}`, severity: 'NOTICE', flushImmediately: true });
    this.flush(); return envelope;
  }
  public dispose(): void { if (this.disposed) return; this.disposed = true; if (this.flushTimer) clearTimeout(this.flushTimer); if (this.idleFlushTimer) clearTimeout(this.idleFlushTimer); this.flush(); }
  public subscribe(listener: ChatTelemetryListener): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  public getLocalHistory(): readonly ChatTelemetryEnvelope[] { return this.localHistory; }
  public drainPendingForTests(): readonly ChatTelemetryEnvelope[] { const drained = [...this.pendingBatch]; this.pendingBatch.length = 0; return drained; }
  public getSessionId(): string { return this.sessionId; }
  public getTraceId(): string { return this.traceId; }

  public captureChatOpened(payload: ChatOpenedPayload): ChatTelemetryEnvelope | undefined {
    if (payload.roomId) this.activeRoomId = payload.roomId;
    if (payload.channel) { this.activeChannel = payload.channel; this.openedAtByChannel.set(payload.channel, this.now()); }
    const envelope = this.emit('CHAT_OPENED', payload, { origin: 'UI', tags: ['chat', 'open'], dedupeKey: `chat_opened:${payload.trigger}:${payload.channel ?? 'unknown'}` });
    if (this.config.captureLearningSnapshots) this.captureLearningFeatureSnapshot({ featureSet: this.resolveLearningSnapshot() ?? {}, reason: 'CHAT_OPEN' });
    return envelope;
  }

  public captureChatClosed(payload: ChatClosedPayload): ChatTelemetryEnvelope | undefined {
    const openedAt = payload.channel && this.openedAtByChannel.has(payload.channel) ? this.openedAtByChannel.get(payload.channel) : undefined;
    return this.emit('CHAT_CLOSED', { ...payload, lifetimeMs: payload.lifetimeMs ?? (typeof openedAt === 'number' ? this.now() - openedAt : undefined) }, { origin: 'UI', tags: ['chat', 'close'], dedupeKey: `chat_closed:${payload.trigger}:${payload.channel ?? 'unknown'}` });
  }

  public captureCollapsed(sourceSurface?: string): ChatTelemetryEnvelope | undefined { return this.emit('CHAT_COLLAPSED', { sourceSurface, channel: this.activeChannel, roomId: this.activeRoomId }, { origin: 'UI', tags: ['chat', 'collapse'], dedupeKey: `chat_collapsed:${this.activeChannel ?? 'unknown'}` }); }
  public captureExpanded(sourceSurface?: string): ChatTelemetryEnvelope | undefined { return this.emit('CHAT_EXPANDED', { sourceSurface, channel: this.activeChannel, roomId: this.activeRoomId }, { origin: 'UI', tags: ['chat', 'expand'], dedupeKey: `chat_expanded:${this.activeChannel ?? 'unknown'}` }); }
  public captureRendered(sourceSurface?: string): ChatTelemetryEnvelope | undefined { return this.emit('CHAT_RENDERED', { sourceSurface, channel: this.activeChannel, roomId: this.activeRoomId }, { origin: 'UI', tags: ['chat', 'render'], dedupeKey: `chat_rendered:${sourceSurface ?? 'unknown'}:${this.activeChannel ?? 'unknown'}` }); }

  public captureChannelSelected(payload: ChannelSelectedPayload): ChatTelemetryEnvelope | undefined {
    this.activeChannel = payload.toChannel; if (payload.roomId) this.activeRoomId = payload.roomId; this.openedAtByChannel.set(payload.toChannel, this.now());
    const envelope = this.emit('CHANNEL_SELECTED', payload, { origin: 'UI', tags: ['channel', payload.toChannel], dedupeKey: `channel_selected:${payload.fromChannel ?? 'none'}:${payload.toChannel}`, severity: 'NOTICE' });
    if (this.config.captureLearningSnapshots) this.captureLearningFeatureSnapshot({ featureSet: this.resolveLearningSnapshot() ?? {}, reason: 'CHANNEL_SWITCH' });
    return envelope;
  }

  public captureChannelViewed(channel: ChatTelemetryChannel, unreadCount?: number): ChatTelemetryEnvelope | undefined { return this.emit('CHANNEL_VIEWED', { channel, unreadCount, roomId: this.activeRoomId }, { origin: 'UI', tags: ['channel', channel, 'view'], dedupeKey: `channel_viewed:${channel}` }); }
  public captureRoomBound(roomId: string): ChatTelemetryEnvelope | undefined { this.activeRoomId = roomId; return this.emit('ROOM_BOUND', { roomId, channel: this.activeChannel }, { origin: 'SOCKET', tags: ['room', 'bind'], dedupeKey: `room_bound:${roomId}`, severity: 'NOTICE' }); }
  public captureRoomUnbound(roomId: string): ChatTelemetryEnvelope | undefined { if (this.activeRoomId === roomId) this.activeRoomId = undefined; return this.emit('ROOM_UNBOUND', { roomId, channel: this.activeChannel }, { origin: 'SOCKET', tags: ['room', 'unbind'], dedupeKey: `room_unbound:${roomId}` }); }
  public captureComposerFocused(sourceSurface?: string): ChatTelemetryEnvelope | undefined { return this.emit('COMPOSER_FOCUSED', { sourceSurface, channel: this.activeChannel, roomId: this.activeRoomId }, { origin: 'UI', tags: ['composer', 'focus'], dedupeKey: `composer_focused:${this.activeChannel ?? 'unknown'}` }); }
  public captureComposerBlurred(sourceSurface?: string): ChatTelemetryEnvelope | undefined { return this.emit('COMPOSER_BLURRED', { sourceSurface, channel: this.activeChannel, roomId: this.activeRoomId }, { origin: 'UI', tags: ['composer', 'blur'], dedupeKey: `composer_blurred:${this.activeChannel ?? 'unknown'}` }); }

  public captureComposerDraftChanged(channel: ChatTelemetryChannel, roomId: string | undefined, rawText: string, draftVersion?: number): ChatTelemetryEnvelope | undefined {
    return this.emit('COMPOSER_DRAFT_CHANGED', { channel, roomId, safeText: summarizeText(rawText, this.config.safePreviewMaxChars, this.config.includeSafePreview, this.config.hashBodies), draftVersion }, { origin: 'UI', tags: ['composer', 'draft', channel], dedupeKey: `composer_draft:${channel}:${draftVersion ?? 0}` });
  }

  public captureCommandDetected(channel: ChatTelemetryChannel, roomId: string | undefined, rawText: string): ChatTelemetryEnvelope | undefined {
    return this.emit('COMPOSER_COMMAND_DETECTED', { channel, roomId, safeText: summarizeText(rawText, this.config.safePreviewMaxChars, this.config.includeSafePreview, this.config.hashBodies) }, { origin: 'UI', tags: ['composer', 'command', channel], dedupeKey: `composer_command:${channel}:${fnv1a32(rawText)}`, severity: 'NOTICE' });
  }

  public captureMessageSendRequested(payload: MessageSendRequestedPayload): ChatTelemetryEnvelope | undefined {
    this.activeChannel = payload.channel; if (payload.roomId) this.activeRoomId = payload.roomId;
    const envelope = this.emit('MESSAGE_SEND_REQUESTED', payload, { origin: 'UI', tags: ['message', 'send', payload.channel, payload.senderRole.toLowerCase()], dedupeKey: `message_send_requested:${payload.clientMessageId ?? payload.draft.safeText.bodyHash?.value ?? 'nohash'}`, severity: 'NOTICE' });
    if (this.config.captureLearningSnapshots) this.captureLearningFeatureSnapshot({ featureSet: this.resolveLearningSnapshot() ?? {}, reason: 'MESSAGE_SEND' });
    return envelope;
  }

  public captureMessageSendQueued(payload: MessageSendResultPayload): ChatTelemetryEnvelope | undefined { return this.emit('MESSAGE_SEND_QUEUED', payload, { origin: 'QUEUE', tags: ['message', 'queue', payload.channel], dedupeKey: `message_send_queued:${payload.clientMessageId ?? payload.serverMessageId ?? 'unknown'}` }); }
  public captureMessageSent(payload: MessageSendResultPayload): ChatTelemetryEnvelope | undefined { return this.emit('MESSAGE_SENT', payload, { origin: 'SOCKET', tags: ['message', 'sent', payload.channel], dedupeKey: `message_sent:${payload.serverMessageId ?? payload.clientMessageId ?? 'unknown'}`, severity: 'NOTICE' }); }
  public captureMessageSendFailed(payload: MessageSendResultPayload): ChatTelemetryEnvelope | undefined { return this.emit('MESSAGE_SEND_FAILED', payload, { origin: 'SOCKET', tags: ['message', 'failed', payload.channel], dedupeKey: `message_send_failed:${payload.clientMessageId ?? 'unknown'}:${payload.failureCode ?? 'unknown'}`, severity: 'CRITICAL', flushImmediately: true }); }

  public captureMessageReceived(payload: MessageReceivedPayload): ChatTelemetryEnvelope | undefined {
    this.activeChannel = payload.channel; if (payload.roomId) this.activeRoomId = payload.roomId;
    const envelope = this.emit('MESSAGE_RECEIVED', payload, { origin: payload.senderRole === 'SYSTEM' ? 'SYSTEM' : payload.senderRole === 'NPC' || payload.senderRole === 'HATER' || payload.senderRole === 'HELPER' ? 'NPC' : 'SOCKET', tags: ['message', 'received', payload.channel, payload.senderRole.toLowerCase()], dedupeKey: `message_received:${payload.serverMessageId ?? payload.safeText?.bodyHash?.value ?? 'unknown'}` });
    if (this.config.captureLearningSnapshots) this.captureLearningFeatureSnapshot({ featureSet: this.resolveLearningSnapshot() ?? {}, reason: 'MESSAGE_RECEIVE' });
    return envelope;
  }

  public captureMessageRendered(payload: MessageReceivedPayload): ChatTelemetryEnvelope | undefined { return this.emit('MESSAGE_RENDERED', payload, { origin: 'UI', tags: ['message', 'rendered', payload.channel, payload.senderRole.toLowerCase()], dedupeKey: `message_rendered:${payload.serverMessageId ?? payload.safeText?.bodyHash?.value ?? 'unknown'}` }); }

  public captureMessageSuppressed(reason: string, payload: Pick<MessageReceivedPayload, 'serverMessageId' | 'channel' | 'roomId' | 'senderRole'>): ChatTelemetryEnvelope | undefined {
    return this.emit('MESSAGE_SUPPRESSED', { reason, ...payload }, { origin: 'SYSTEM', tags: ['message', 'suppressed', payload.channel], dedupeKey: `message_suppressed:${payload.serverMessageId ?? 'unknown'}:${reason}`, severity: 'WARNING' });
  }

  public captureTypingStarted(channel: ChatTelemetryChannel, roomId?: string): ChatTelemetryEnvelope | undefined { return this.emit('TYPING_STARTED', { channel, roomId }, { origin: 'UI', tags: ['typing', channel], dedupeKey: `typing_started:${channel}:${roomId ?? 'noroom'}` }); }
  public captureTypingStopped(channel: ChatTelemetryChannel, roomId?: string): ChatTelemetryEnvelope | undefined { return this.emit('TYPING_STOPPED', { channel, roomId }, { origin: 'UI', tags: ['typing', channel], dedupeKey: `typing_stopped:${channel}:${roomId ?? 'noroom'}` }); }
  public captureNpcTypingStarted(npcId: string, npcRole: 'HATER' | 'HELPER' | 'AMBIENT', channel: ChatTelemetryChannel, roomId?: string): ChatTelemetryEnvelope | undefined { return this.emit('NPC_TYPING_STARTED', { npcId, npcRole, channel, roomId }, { origin: 'NPC', tags: ['npc', 'typing', npcRole.toLowerCase(), channel], dedupeKey: `npc_typing_started:${npcId}:${channel}:${roomId ?? 'noroom'}` }); }
  public captureNpcTypingStopped(npcId: string, npcRole: 'HATER' | 'HELPER' | 'AMBIENT', channel: ChatTelemetryChannel, roomId?: string): ChatTelemetryEnvelope | undefined { return this.emit('NPC_TYPING_STOPPED', { npcId, npcRole, channel, roomId }, { origin: 'NPC', tags: ['npc', 'typing', 'stop', npcRole.toLowerCase(), channel], dedupeKey: `npc_typing_stopped:${npcId}:${channel}:${roomId ?? 'noroom'}` }); }

  public capturePresenceChanged(subjectId: string, subjectRole: ChatTelemetrySenderRole, state: 'ONLINE' | 'AWAY' | 'BUSY' | 'READING' | 'LURKING' | 'OFFLINE', channel?: ChatTelemetryChannel, roomId?: string): ChatTelemetryEnvelope | undefined {
    return this.emit('PRESENCE_CHANGED', { subjectId, subjectRole, state, channel, roomId }, { origin: 'SYSTEM', tags: ['presence', state.toLowerCase(), subjectRole.toLowerCase()], dedupeKey: `presence_changed:${subjectId}:${state}:${channel ?? 'nochannel'}` });
  }

  public captureNpcMessagePlanned(payload: NpcResponsePlannedPayload): ChatTelemetryEnvelope | undefined { return this.emit('NPC_MESSAGE_PLANNED', payload, { origin: 'NPC', tags: ['npc', payload.npcRole.toLowerCase(), payload.channel], dedupeKey: `npc_message_planned:${payload.npcId}:${payload.reason}:${payload.channel}`, severity: payload.npcRole === 'HATER' ? 'WARNING' : 'INFO' }); }
  public captureNpcMessageRendered(npcId: string, npcRole: 'HATER' | 'HELPER' | 'AMBIENT', channel: ChatTelemetryChannel, roomId: string | undefined, safeText?: ChatTelemetrySafeTextSummary): ChatTelemetryEnvelope | undefined { return this.emit('NPC_MESSAGE_RENDERED', { npcId, npcRole, channel, roomId, safeText }, { origin: 'NPC', tags: ['npc', 'rendered', npcRole.toLowerCase(), channel], dedupeKey: `npc_message_rendered:${npcId}:${channel}:${safeText?.bodyHash?.value ?? 'nohash'}`, severity: npcRole === 'HATER' ? 'WARNING' : 'INFO' }); }
  public captureNpcResponseSkipped(npcId: string, npcRole: 'HATER' | 'HELPER' | 'AMBIENT', reason: string, channel: ChatTelemetryChannel, roomId?: string): ChatTelemetryEnvelope | undefined { return this.emit('NPC_RESPONSE_SKIPPED', { npcId, npcRole, reason, channel, roomId }, { origin: 'NPC', tags: ['npc', 'skipped', npcRole.toLowerCase(), channel], dedupeKey: `npc_response_skipped:${npcId}:${reason}:${channel}` }); }
  public captureHaterTargetLocked(haterId: string, targetPlayerId?: string, intensity?: number, channel?: ChatTelemetryChannel, roomId?: string): ChatTelemetryEnvelope | undefined { return this.emit('HATER_TARGET_LOCKED', { haterId, targetPlayerId: this.config.privacy.includePlayerIds ? targetPlayerId : undefined, intensity, channel, roomId }, { origin: 'NPC', tags: ['hater', 'target-lock', channel ?? 'nochannel'], dedupeKey: `hater_target_locked:${haterId}:${channel ?? 'nochannel'}`, severity: 'WARNING' }); }
  public captureHaterTauntRendered(haterId: string, channel: ChatTelemetryChannel, roomId?: string, safeText?: ChatTelemetrySafeTextSummary): ChatTelemetryEnvelope | undefined { return this.emit('HATER_TAUNT_RENDERED', { haterId, channel, roomId, safeText }, { origin: 'NPC', tags: ['hater', 'taunt', channel], dedupeKey: `hater_taunt_rendered:${haterId}:${channel}:${safeText?.bodyHash?.value ?? 'nohash'}`, severity: 'WARNING' }); }
  public captureHelperInterventionTriggered(helperId: string, reason: RecoveryPromptPayload['reason'] | 'COLD_START' | 'GUIDANCE', channel: ChatTelemetryChannel, roomId?: string, urgency?: number): ChatTelemetryEnvelope | undefined { return this.emit('HELPER_INTERVENTION_TRIGGERED', { helperId, reason, channel, roomId, urgency }, { origin: 'NPC', tags: ['helper', 'intervention', channel], dedupeKey: `helper_intervention_triggered:${helperId}:${reason}:${channel}`, severity: reason === 'BANKRUPTCY_NEAR' ? 'WARNING' : 'NOTICE' }); }
  public captureHelperInterventionSkipped(helperId: string, reason: string, channel: ChatTelemetryChannel, roomId?: string): ChatTelemetryEnvelope | undefined { return this.emit('HELPER_INTERVENTION_SKIPPED', { helperId, reason, channel, roomId }, { origin: 'NPC', tags: ['helper', 'skip', channel], dedupeKey: `helper_intervention_skipped:${helperId}:${reason}:${channel}` }); }
  public captureAudienceHeatChanged(channel: ChatTelemetryChannel, heatBefore: number | undefined, heatAfter: number | undefined, cause?: string, roomId?: string): ChatTelemetryEnvelope | undefined { return this.emit('AUDIENCE_HEAT_CHANGED', { channel, heatBefore, heatAfter, heatDelta: typeof heatBefore === 'number' && typeof heatAfter === 'number' ? heatAfter - heatBefore : undefined, cause, roomId }, { origin: 'SYSTEM', tags: ['audience', 'heat', channel], dedupeKey: `audience_heat_changed:${channel}:${heatAfter ?? 'unknown'}:${cause ?? 'nocause'}`, severity: typeof heatAfter === 'number' && heatAfter >= 0.8 ? 'WARNING' : 'INFO' }); }
  public captureInvasionTriggered(payload: InvasionTriggeredPayload): ChatTelemetryEnvelope | undefined { return this.emit('INVASION_TRIGGERED', payload, { origin: 'ENGINE', tags: ['invasion', payload.channel], dedupeKey: `invasion_triggered:${payload.invasionId}`, severity: 'CRITICAL', flushImmediately: true }); }
  public captureInvasionResolved(invasionId: string, channel: ChatTelemetryChannel, roomId?: string, outcome?: 'DEFENDED' | 'PIERCED' | 'ABORTED' | 'TIMED_OUT'): ChatTelemetryEnvelope | undefined { return this.emit('INVASION_RESOLVED', { invasionId, channel, roomId, outcome }, { origin: 'ENGINE', tags: ['invasion', 'resolved', channel], dedupeKey: `invasion_resolved:${invasionId}`, severity: 'NOTICE' }); }
  public captureRecoveryPromptTriggered(payload: RecoveryPromptPayload): ChatTelemetryEnvelope | undefined { return this.emit('RECOVERY_PROMPT_TRIGGERED', payload, { origin: 'SYSTEM', tags: ['recovery', payload.channel], dedupeKey: `recovery_prompt_triggered:${payload.recoveryId}`, severity: 'WARNING' }); }
  public captureRecoveryPromptAccepted(recoveryId: string, channel: ChatTelemetryChannel, roomId?: string, chosenAction?: string): ChatTelemetryEnvelope | undefined { return this.emit('RECOVERY_PROMPT_ACCEPTED', { recoveryId, channel, roomId, chosenAction }, { origin: 'UI', tags: ['recovery', 'accepted', channel], dedupeKey: `recovery_prompt_accepted:${recoveryId}`, severity: 'NOTICE' }); }
  public captureRecoveryPromptDismissed(recoveryId: string, channel: ChatTelemetryChannel, roomId?: string): ChatTelemetryEnvelope | undefined { return this.emit('RECOVERY_PROMPT_DISMISSED', { recoveryId, channel, roomId }, { origin: 'UI', tags: ['recovery', 'dismissed', channel], dedupeKey: `recovery_prompt_dismissed:${recoveryId}` }); }
  public captureNegotiationSignal(roomId: string | undefined, channel: ChatTelemetryChannel, signal: { offerValue?: number; urgency?: number; bluffRisk?: number; manipulationRisk?: number; overpayRisk?: number; assetId?: string; direction?: 'OPEN' | 'COUNTER' | 'ACCEPT' | 'REJECT' | 'STALL'; }): ChatTelemetryEnvelope | undefined { return this.emit('NEGOTIATION_SIGNAL_CAPTURED', { roomId, channel, signal: { ...signal, offerValue: this.config.privacy.includeOfferValues ? signal.offerValue : undefined } }, { origin: 'LEARNING', tags: ['negotiation', channel], dedupeKey: `negotiation_signal:${roomId ?? 'noroom'}:${signal.direction ?? 'unknown'}:${signal.assetId ?? 'noasset'}`, severity: 'NOTICE' }); }
  public captureLegendMoment(payload: LegendMomentPayload): ChatTelemetryEnvelope | undefined { return this.emit('LEGEND_MOMENT_CAPTURED', payload, { origin: 'ENGINE', tags: ['legend', payload.momentType.toLowerCase()], dedupeKey: `legend_moment_captured:${payload.legendId}`, severity: 'NOTICE', flushImmediately: true }); }
  public captureProofBadgeRendered(proofHash: string, channel?: ChatTelemetryChannel, roomId?: string): ChatTelemetryEnvelope | undefined { return this.emit('PROOF_BADGE_RENDERED', { proofHash, channel, roomId }, { origin: 'UI', tags: ['proof', 'badge'], dedupeKey: `proof_badge_rendered:${proofHash}`, severity: 'NOTICE' }); }
  public captureReplayOpened(payload: ReplayOpenedPayload): ChatTelemetryEnvelope | undefined { return this.emit('REPLAY_OPENED', payload, { origin: 'REPLAY', tags: ['replay', 'open'], dedupeKey: `replay_opened:${payload.replay.replayId ?? payload.replay.legendId ?? 'unknown'}`, severity: 'NOTICE' }); }
  public captureReplayClosed(replay: ChatTelemetryReplayReference): ChatTelemetryEnvelope | undefined { return this.emit('REPLAY_CLOSED', { replay, channel: this.activeChannel, roomId: this.activeRoomId }, { origin: 'REPLAY', tags: ['replay', 'close'], dedupeKey: `replay_closed:${replay.replayId ?? replay.legendId ?? 'unknown'}` }); }
  public captureReplayRangeRequested(replay: ChatTelemetryReplayReference, requestWindow: { start: number; end: number; reason?: string }): ChatTelemetryEnvelope | undefined { return this.emit('REPLAY_RANGE_REQUESTED', { replay, requestWindow, channel: this.activeChannel, roomId: this.activeRoomId }, { origin: 'REPLAY', tags: ['replay', 'range', 'request'], dedupeKey: `replay_range_requested:${replay.replayId ?? 'unknown'}:${requestWindow.start}:${requestWindow.end}` }); }
  public captureReplayRangeLoaded(replay: ChatTelemetryReplayReference, loadedWindow: { start: number; end: number; messageCount?: number; durationMs?: number }): ChatTelemetryEnvelope | undefined { return this.emit('REPLAY_RANGE_LOADED', { replay, loadedWindow, channel: this.activeChannel, roomId: this.activeRoomId }, { origin: 'REPLAY', tags: ['replay', 'range', 'loaded'], dedupeKey: `replay_range_loaded:${replay.replayId ?? 'unknown'}:${loadedWindow.start}:${loadedWindow.end}`, severity: 'NOTICE' }); }
  public captureReplaySliceExported(replay: ChatTelemetryReplayReference, exportFormat: 'JSON' | 'NDJSON' | 'CSV' | 'TEXT', messageCount?: number): ChatTelemetryEnvelope | undefined { return this.emit('REPLAY_SLICE_EXPORTED', { replay, exportFormat, messageCount, channel: this.activeChannel, roomId: this.activeRoomId }, { origin: 'REPLAY', tags: ['replay', 'export', exportFormat.toLowerCase()], dedupeKey: `replay_slice_exported:${replay.replayId ?? 'unknown'}:${exportFormat}`, severity: 'NOTICE' }); }
  public captureLearningFeatureSnapshot(payload: LearningFeatureSnapshotPayload): ChatTelemetryEnvelope | undefined { return this.emit('LEARNING_FEATURE_SNAPSHOT', payload, { origin: 'LEARNING', tags: ['learning', payload.reason.toLowerCase()], dedupeKey: `learning_feature_snapshot:${payload.reason}:${payload.featureSet.featureRevision ?? 0}` }); }
  public captureLearningHandoffRequested(reason: LearningFeatureSnapshotPayload['reason'], summary?: string): ChatTelemetryEnvelope | undefined { return this.emit('LEARNING_HANDOFF_REQUESTED', { reason, summary, roomId: this.activeRoomId, channel: this.activeChannel }, { origin: 'LEARNING', tags: ['learning', 'handoff'], dedupeKey: `learning_handoff_requested:${reason}:${this.activeRoomId ?? 'noroom'}`, severity: 'NOTICE' }); }
  public captureLearningHandoffAcked(reason: LearningFeatureSnapshotPayload['reason'], backendRevision?: number): ChatTelemetryEnvelope | undefined { return this.emit('LEARNING_HANDOFF_ACKED', { reason, backendRevision, roomId: this.activeRoomId, channel: this.activeChannel }, { origin: 'LEARNING', tags: ['learning', 'handoff', 'acked'], dedupeKey: `learning_handoff_acked:${reason}:${backendRevision ?? 0}`, severity: 'NOTICE' }); }
  public captureInferenceRequested(model: string, requestKind: 'RESPONSE_RANKING' | 'INTENT_ENCODING' | 'STATE_ENCODING' | 'EMBEDDING' | 'MEMORY_RETRIEVAL' | 'OTHER', inputSummary?: string): ChatTelemetryEnvelope | undefined { return this.emit('INFERENCE_REQUESTED', { model, requestKind, inputSummary, roomId: this.activeRoomId, channel: this.activeChannel }, { origin: 'LEARNING', tags: ['inference', requestKind.toLowerCase()], dedupeKey: `inference_requested:${model}:${requestKind}`, severity: 'NOTICE' }); }
  public captureInferenceCompleted(model: string, requestKind: 'RESPONSE_RANKING' | 'INTENT_ENCODING' | 'STATE_ENCODING' | 'EMBEDDING' | 'MEMORY_RETRIEVAL' | 'OTHER', durationMs?: number, resultSummary?: string): ChatTelemetryEnvelope | undefined { return this.emit('INFERENCE_COMPLETED', { model, requestKind, durationMs, resultSummary, roomId: this.activeRoomId, channel: this.activeChannel }, { origin: 'LEARNING', tags: ['inference', 'completed', requestKind.toLowerCase()], dedupeKey: `inference_completed:${model}:${requestKind}:${durationMs ?? -1}`, severity: 'NOTICE' }); }
  public captureInferenceFailed(model: string, requestKind: 'RESPONSE_RANKING' | 'INTENT_ENCODING' | 'STATE_ENCODING' | 'EMBEDDING' | 'MEMORY_RETRIEVAL' | 'OTHER', failureCode?: string, durationMs?: number): ChatTelemetryEnvelope | undefined { return this.emit('INFERENCE_FAILED', { model, requestKind, failureCode, durationMs, roomId: this.activeRoomId, channel: this.activeChannel }, { origin: 'LEARNING', tags: ['inference', 'failed', requestKind.toLowerCase()], dedupeKey: `inference_failed:${model}:${requestKind}:${failureCode ?? 'unknown'}`, severity: 'CRITICAL', flushImmediately: true }); }
  public captureModerationWarningRendered(reason: string, roomId?: string, channel?: ChatTelemetryChannel): ChatTelemetryEnvelope | undefined { return this.emit('MODERATION_WARNING_RENDERED', { reason, roomId, channel }, { origin: 'SYSTEM', tags: ['moderation', 'warning'], dedupeKey: `moderation_warning_rendered:${reason}:${roomId ?? 'noroom'}`, severity: 'WARNING' }); }
  public captureModerationEnforcementApplied(reason: string, action: 'BLOCK_SEND' | 'REDACT' | 'MUTE' | 'THROTTLE' | 'ROOM_RESTRICT', roomId?: string, channel?: ChatTelemetryChannel): ChatTelemetryEnvelope | undefined { return this.emit('MODERATION_ENFORCEMENT_APPLIED', { reason, action, roomId, channel }, { origin: 'SYSTEM', tags: ['moderation', 'enforcement', action.toLowerCase()], dedupeKey: `moderation_enforcement_applied:${action}:${reason}:${roomId ?? 'noroom'}`, severity: 'CRITICAL', flushImmediately: true }); }
  public captureSocketConnected(transport: 'socket' | 'polling', roomId?: string): ChatTelemetryEnvelope | undefined { return this.emit('SOCKET_CONNECTED', { transport, roomId, channel: this.activeChannel }, { origin: 'SOCKET', tags: ['socket', 'connected'], dedupeKey: `socket_connected:${transport}:${roomId ?? 'noroom'}`, severity: 'NOTICE' }); }
  public captureSocketDisconnected(transport: 'socket' | 'polling', roomId?: string, reason?: string): ChatTelemetryEnvelope | undefined { return this.emit('SOCKET_DISCONNECTED', { transport, roomId, reason, channel: this.activeChannel }, { origin: 'SOCKET', tags: ['socket', 'disconnected'], dedupeKey: `socket_disconnected:${transport}:${roomId ?? 'noroom'}:${reason ?? 'unknown'}`, severity: 'WARNING' }); }
  public captureSocketReconnecting(transport: 'socket' | 'polling', roomId?: string, attempt?: number): ChatTelemetryEnvelope | undefined { return this.emit('SOCKET_RECONNECTING', { transport, roomId, attempt, channel: this.activeChannel }, { origin: 'SOCKET', tags: ['socket', 'reconnecting'], dedupeKey: `socket_reconnecting:${transport}:${roomId ?? 'noroom'}:${attempt ?? 0}`, severity: 'WARNING' }); }
  public beginPerformanceMark(label: string): void { if (!this.config.emitPerformanceMarks) return; this.perfMarks.set(label, this.now()); }
  public completePerformanceMark(payload: PerformanceMarkPayload): ChatTelemetryEnvelope | undefined {
    const startedAtMs = this.perfMarks.get(payload.mark.label); const completedAtMs = payload.mark.completedAtMs ?? this.now(); const durationMs = payload.mark.durationMs ?? (typeof startedAtMs === 'number' ? completedAtMs - startedAtMs : undefined);
    return this.emit('PERFORMANCE_MARK', { subsystem: payload.subsystem, mark: { ...payload.mark, startedAtMs, completedAtMs, durationMs } }, { origin: 'MANUAL', tags: ['perf', payload.subsystem.toLowerCase()], dedupeKey: `performance_mark:${payload.subsystem}:${payload.mark.label}:${durationMs ?? -1}`, severity: 'TRACE' });
  }
  public captureDiagnostic(label: string, context?: Record<string, unknown>): ChatTelemetryEnvelope | undefined { return this.emit('DIAGNOSTIC', { label, context, roomId: this.activeRoomId, channel: this.activeChannel }, { origin: 'MANUAL', tags: ['diagnostic', label], dedupeKey: `diagnostic:${label}`, severity: 'TRACE' }); }
  public captureEngineEventIngested(payload: EngineEventIngestedPayload): ChatTelemetryEnvelope | undefined { return this.emit('ENGINE_EVENT_INGESTED', payload, { origin: 'EVENT_BUS', tags: ['engine-event', payload.engineEventName], dedupeKey: `engine_event_ingested:${payload.engineEventName}:${payload.roomId ?? 'noroom'}`, severity: 'TRACE' }); }
  public captureEngineEventIgnored(engineEventName: string, reason: string): ChatTelemetryEnvelope | undefined { return this.emit('ENGINE_EVENT_IGNORED', { engineEventName, reason, roomId: this.activeRoomId, channel: this.activeChannel }, { origin: 'EVENT_BUS', tags: ['engine-event', 'ignored', engineEventName], dedupeKey: `engine_event_ignored:${engineEventName}:${reason}`, severity: 'TRACE' }); }

  public flush(): void {
    if (this.pendingBatch.length === 0) return;
    const toFlush = this.pendingBatch.splice(0, this.config.maxFlushBatch);
    try {
      this.queue.enqueue(toFlush);
      if (this.transport) this.transport.send(toFlush);
      if (this.config.emitQueueLifecycle) this.pushLifecycleEnvelope('QUEUE_FLUSHED', { count: toFlush.length, roomId: this.activeRoomId, channel: this.activeChannel }, 'QUEUE', ['queue', 'flush'], `queue_flushed:${toFlush.length}:${this.now()}`, 'NOTICE');
    } catch (error) {
      this.logger.error('ChatTelemetryEmitter flush failed', { error: error instanceof Error ? error.message : String(error), batchSize: toFlush.length });
      if (this.config.emitQueueLifecycle) this.pushLifecycleEnvelope('QUEUE_RETRIED', { count: toFlush.length, roomId: this.activeRoomId, channel: this.activeChannel }, 'QUEUE', ['queue', 'retry'], `queue_retried:${toFlush.length}:${this.now()}`, 'WARNING');
      this.pendingBatch.unshift(...toFlush);
    } finally {
      this.scheduleFlush(); this.scheduleIdleFlush();
    }
  }

  private emit<TPayload extends Record<string, unknown>>(eventName: ChatTelemetryEventName, payload: TPayload, options: { origin: ChatTelemetryOrigin; tags?: readonly string[]; dedupeKey?: string; severity?: ChatTelemetrySeverity; flushImmediately?: boolean; }): ChatTelemetryEnvelope<TPayload> | undefined {
    if (!this.config.enabled || this.disposed) return undefined;
    const sampled = shouldSample(eventName, this.config, this.random); if (sampled === 0) return undefined;
    const dedupeKey = options.dedupeKey; if (dedupeKey && this.isInsideDedupeWindow(dedupeKey)) return undefined; if (this.isInsideThrottleWindow(eventName)) return undefined;
    const envelope: ChatTelemetryEnvelope<TPayload> = { schemaVersion: 1, seq: ++this.seq, eventId: `${this.sessionId}_${this.seq}`, eventName, severity: normalizeSeverity(eventName, options.severity), origin: options.origin, timestampMs: this.now(), sessionId: this.sessionId, traceId: this.traceId, dedupeKey, sampleRate: sampled, payload: this.sanitizePayload(payload), run: this.resolveRunSnapshot(), learning: this.config.captureLearningSnapshots ? this.resolveLearningSnapshot() : undefined, performance: undefined, tags: toTagSet(toArray(options.tags)) };
    this.pushLocalHistory(envelope); this.pushPending(envelope); this.touchEmitWindows(eventName, dedupeKey, envelope.timestampMs); this.notifyListeners(envelope);
    if (options.flushImmediately || this.config.synchronousFlushEventNames.has(eventName)) this.flush(); else { this.scheduleFlush(); this.scheduleIdleFlush(); }
    return envelope;
  }

  private pushLifecycleEnvelope(eventName: Extract<ChatTelemetryEventName,'QUEUE_FLUSHED' | 'QUEUE_DROPPED' | 'QUEUE_RETRIED' | 'QUEUE_ENQUEUED'>, payload: Record<string, unknown>, origin: ChatTelemetryOrigin, tags: readonly string[], dedupeKey: string, severity: ChatTelemetrySeverity): void {
    const envelope: ChatTelemetryEnvelope = { schemaVersion: 1, seq: ++this.seq, eventId: `${this.sessionId}_${this.seq}`, eventName, severity, origin, timestampMs: this.now(), sessionId: this.sessionId, traceId: this.traceId, dedupeKey, sampleRate: 1, payload, run: this.resolveRunSnapshot(), learning: undefined, performance: undefined, tags: toTagSet(tags) };
    this.pushLocalHistory(envelope); this.notifyListeners(envelope);
  }

  private pushPending(envelope: ChatTelemetryEnvelope): void {
    if (this.pendingBatch.length >= this.config.maxPendingBatch) {
      if (this.config.dropOldestWhenFull) this.pendingBatch.shift(); else return;
      if (this.config.emitQueueLifecycle) this.pushLifecycleEnvelope('QUEUE_DROPPED', { eventName: envelope.eventName, roomId: this.activeRoomId, channel: this.activeChannel }, 'QUEUE', ['queue', 'dropped'], `queue_dropped:${envelope.eventName}:${this.now()}`, 'CRITICAL');
    }
    this.pendingBatch.push(envelope);
    if (this.config.emitQueueLifecycle) this.pushLifecycleEnvelope('QUEUE_ENQUEUED', { eventName: envelope.eventName, pendingCount: this.pendingBatch.length, roomId: this.activeRoomId, channel: this.activeChannel }, 'QUEUE', ['queue', 'enqueue'], `queue_enqueued:${envelope.eventName}:${this.pendingBatch.length}`, 'TRACE');
  }

  private pushLocalHistory(envelope: ChatTelemetryEnvelope): void { if (this.localHistory.length >= this.config.maxLocalHistory) this.localHistory.shift(); this.localHistory.push(envelope); }
  private notifyListeners(envelope: ChatTelemetryEnvelope): void { for (const listener of this.listeners) { try { listener(envelope); } catch (error) { this.logger.warn('ChatTelemetryEmitter listener failure', { eventName: envelope.eventName, error: error instanceof Error ? error.message : String(error) }); } } }
  private isInsideDedupeWindow(dedupeKey: string): boolean { const last = this.lastEmitAtByDedupe.get(dedupeKey); return typeof last === 'number' ? this.now() - last <= this.config.dedupeWindowMs : false; }
  private isInsideThrottleWindow(eventName: ChatTelemetryEventName): boolean { const throttleMs = this.config.perEventThrottleMs[eventName]; const last = this.lastEmitAtByEvent.get(eventName); return typeof throttleMs === 'number' && throttleMs > 0 && typeof last === 'number' ? this.now() - last <= throttleMs : false; }
  private touchEmitWindows(eventName: ChatTelemetryEventName, dedupeKey: string | undefined, atMs: number): void { this.lastEmitAtByEvent.set(eventName, atMs); if (dedupeKey) this.lastEmitAtByDedupe.set(dedupeKey, atMs); }
  private scheduleFlush(): void { if (this.flushTimer || this.disposed) return; this.flushTimer = setTimeout(() => { this.flushTimer = undefined; this.flush(); }, this.config.flushIntervalMs); }
  private scheduleIdleFlush(): void { if (this.idleFlushTimer || this.disposed) return; this.idleFlushTimer = setTimeout(() => { this.idleFlushTimer = undefined; this.flush(); }, this.config.idleFlushIntervalMs); }

  private resolveRunSnapshot(): ChatTelemetryRunSnapshot {
    const runtimeSnapshot = this.runtime.getRunSnapshot?.() ?? {};
    const roomId = this.config.privacy.includeRoomIds ? safeString(runtimeSnapshot.roomId) ?? this.runtime.getRoomId?.() ?? this.activeRoomId : undefined;
    const playerId = this.config.privacy.includePlayerIds ? safeString(runtimeSnapshot.playerId) ?? this.runtime.getPlayerId?.() : undefined;
    const profileId = this.config.privacy.includeProfileIds ? safeString(runtimeSnapshot.profileId) ?? this.runtime.getProfileId?.() : undefined;
    const modeId = safeString(runtimeSnapshot.modeId) ?? this.runtime.getModeId?.();
    return { runId: safeString(runtimeSnapshot.runId), playerId, profileId, roomId, modeId, modeVariantId: safeString(runtimeSnapshot.modeVariantId), tickIndex: safeNumber(runtimeSnapshot.tickIndex), tickTier: safeString(runtimeSnapshot.tickTier), pressureScore: safeNumber(runtimeSnapshot.pressureScore), pressureTier: safeString(runtimeSnapshot.pressureTier), tensionScore: safeNumber(runtimeSnapshot.tensionScore), tensionQueueDepth: safeNumber(runtimeSnapshot.tensionQueueDepth), battleHeat: safeNumber(runtimeSnapshot.battleHeat), battleWave: safeNumber(runtimeSnapshot.battleWave), battlePhase: safeString(runtimeSnapshot.battlePhase), shieldIntegrityTotal: safeNumber(runtimeSnapshot.shieldIntegrityTotal), shieldBreachedLayerCount: safeNumber(runtimeSnapshot.shieldBreachedLayerCount), shieldFortified: typeof runtimeSnapshot.shieldFortified === 'boolean' ? runtimeSnapshot.shieldFortified : undefined, sovereigntyScore: safeNumber(runtimeSnapshot.sovereigntyScore), sovereigntyGrade: safeString(runtimeSnapshot.sovereigntyGrade), income: safeNumber(runtimeSnapshot.income), expenses: safeNumber(runtimeSnapshot.expenses), cash: safeNumber(runtimeSnapshot.cash), netWorth: safeNumber(runtimeSnapshot.netWorth), activeCardWindow: typeof runtimeSnapshot.activeCardWindow === 'boolean' ? runtimeSnapshot.activeCardWindow : undefined, activeDecisionWindow: typeof runtimeSnapshot.activeDecisionWindow === 'boolean' ? runtimeSnapshot.activeDecisionWindow : undefined, activeChannel: (safeString(runtimeSnapshot.activeChannel) as ChatTelemetryChannel | undefined) ?? this.runtime.getActiveChannel?.() ?? this.activeChannel, activeNpcId: safeString(runtimeSnapshot.activeNpcId), activeHaterId: safeString(runtimeSnapshot.activeHaterId), activeHelperId: safeString(runtimeSnapshot.activeHelperId), activeLegendMomentId: safeString(runtimeSnapshot.activeLegendMomentId), isInReplay: typeof runtimeSnapshot.isInReplay === 'boolean' ? runtimeSnapshot.isInReplay : undefined, isInRecoveryFlow: typeof runtimeSnapshot.isInRecoveryFlow === 'boolean' ? runtimeSnapshot.isInRecoveryFlow : undefined, isInNegotiationFlow: typeof runtimeSnapshot.isInNegotiationFlow === 'boolean' ? runtimeSnapshot.isInNegotiationFlow : undefined, isOffline: typeof runtimeSnapshot.isOffline === 'boolean' ? runtimeSnapshot.isOffline : undefined };
  }

  private resolveLearningSnapshot(): ChatTelemetryLearningSnapshot | undefined {
    const builder = this.runtime.getLearningSnapshot ?? this.runtime.getRunSnapshot; if (!builder) return undefined; const snapshot = builder(); if (!snapshot || typeof snapshot !== 'object') return undefined;
    return { coldStartProfileId: safeString((snapshot as Record<string, unknown>).coldStartProfileId), engagementScore: safeNumber((snapshot as Record<string, unknown>).engagementScore), dropOffRisk: safeNumber((snapshot as Record<string, unknown>).dropOffRisk), toxicityRisk: safeNumber((snapshot as Record<string, unknown>).toxicityRisk), confidenceScore: safeNumber((snapshot as Record<string, unknown>).confidenceScore), embarrassmentScore: safeNumber((snapshot as Record<string, unknown>).embarrassmentScore), intimidationScore: safeNumber((snapshot as Record<string, unknown>).intimidationScore), curiosityScore: safeNumber((snapshot as Record<string, unknown>).curiosityScore), attachmentScore: safeNumber((snapshot as Record<string, unknown>).attachmentScore), helperUrgency: safeNumber((snapshot as Record<string, unknown>).helperUrgency), haterAggression: safeNumber((snapshot as Record<string, unknown>).haterAggression), channelAffinityGlobal: safeNumber((snapshot as Record<string, unknown>).channelAffinityGlobal), channelAffinitySyndicate: safeNumber((snapshot as Record<string, unknown>).channelAffinitySyndicate), channelAffinityDealRoom: safeNumber((snapshot as Record<string, unknown>).channelAffinityDealRoom), featureRevision: safeNumber((snapshot as Record<string, unknown>).featureRevision) };
  }

  private sanitizePayload<TPayload extends Record<string, unknown>>(payload: TPayload): TPayload {
    const clone = { ...payload } as Record<string, unknown>;
    if ('targetPlayerId' in clone && !this.config.privacy.includePlayerIds) clone.targetPlayerId = undefined;
    if ('roomId' in clone && !this.config.privacy.includeRoomIds) clone.roomId = undefined;
    if ('offerValue' in clone && !this.config.privacy.includeOfferValues) clone.offerValue = undefined;
    if ('replyToMessageId' in clone && !this.config.privacy.includeReplyTargets) clone.replyToMessageId = undefined;
    if ('profileId' in clone && !this.config.privacy.includeProfileIds) clone.profileId = undefined;
    return clone as TPayload;
  }

  private handleEngineEventSideEffects(eventName: EngineEventName, payload: Record<string, unknown>): void {
    switch (eventName) {
      case 'RUN_STARTED':
        this.captureChatOpened({ trigger: 'system', channel: this.activeChannel ?? 'GLOBAL', roomId: safeString(payload.roomId) ?? this.activeRoomId, sourceSurface: 'RUN_STARTED', wasCollapsed: false });
        break;
      case 'RUN_ENDED':
        this.captureChatClosed({ trigger: 'system', channel: this.activeChannel, roomId: safeString(payload.roomId) ?? this.activeRoomId });
        break;
      case 'PRESSURE_TIER_CHANGED':
        this.captureAudienceHeatChanged(this.activeChannel ?? 'GLOBAL', undefined, safeNumber(payload.heatAfter) ?? safeNumber(payload.pressureScore), 'PRESSURE_TIER_CHANGED', safeString(payload.roomId) ?? this.activeRoomId);
        break;
      case 'SHIELD_LAYER_BREACHED':
        this.captureInvasionTriggered({ invasionId: safeString(payload.invasionId) ?? `inv_${this.now().toString(36)}_${this.seq + 1}`, haterId: safeString(payload.botId) ?? safeString(payload.haterId), channel: (safeString(payload.channel) as ChatTelemetryChannel | undefined) ?? this.activeChannel ?? 'GLOBAL', roomId: safeString(payload.roomId) ?? this.activeRoomId, triggerEvent: eventName, intensity: safeNumber(payload.severity), audienceHeat: safeNumber(payload.heatAfter) });
        break;
      case 'BATTLE_ATTACK_FIRED':
        this.captureHaterTargetLocked(safeString(payload.botId) ?? safeString(payload.haterId) ?? 'UNKNOWN_HATER', safeString(payload.targetPlayerId), safeNumber(payload.intensity) ?? safeNumber(payload.attackHeat), (safeString(payload.channel) as ChatTelemetryChannel | undefined) ?? this.activeChannel ?? 'GLOBAL', safeString(payload.roomId) ?? this.activeRoomId);
        break;
      case 'CARD_PLAYED':
        this.captureMessageActionTriggered('CARD_PLAYED', safeString(payload.cardId), safeString(payload.cardName), (safeString(payload.channel) as ChatTelemetryChannel | undefined) ?? this.activeChannel ?? 'GLOBAL', safeString(payload.roomId) ?? this.activeRoomId);
        break;
      case 'CARD_FORCED':
        this.captureMessageActionTriggered('CARD_FORCED', safeString(payload.cardId), safeString(payload.cardName), (safeString(payload.channel) as ChatTelemetryChannel | undefined) ?? this.activeChannel ?? 'GLOBAL', safeString(payload.roomId) ?? this.activeRoomId);
        break;
      case 'SOVEREIGNTY_PROOF_GENERATED':
        if (safeString(payload.proofHash)) this.captureProofBadgeRendered(safeString(payload.proofHash)!, (safeString(payload.channel) as ChatTelemetryChannel | undefined) ?? this.activeChannel, safeString(payload.roomId) ?? this.activeRoomId);
        break;
      case 'SOVEREIGNTY_GRADE_ASSIGNED':
        if (safeString(payload.legendId)) this.captureLegendMoment({ legendId: safeString(payload.legendId)!, momentType: 'SOVEREIGNTY', proofHash: safeString(payload.proofHash), channel: (safeString(payload.channel) as ChatTelemetryChannel | undefined) ?? this.activeChannel, roomId: safeString(payload.roomId) ?? this.activeRoomId, replay: { replayId: safeString(payload.replayId), legendId: safeString(payload.legendId), momentId: safeString(payload.momentId) } });
        break;
      default:
        break;
    }
  }

  private summarizeEngineEventPayload(eventName: EngineEventName, payload: Record<string, unknown>): string {
    switch (eventName) {
      case 'PRESSURE_TIER_CHANGED': return `pressure=${String(payload.newTier ?? payload.tier ?? 'unknown')}`;
      case 'SHIELD_LAYER_BREACHED': return `layer=${String(payload.layerId ?? 'unknown')}`;
      case 'BATTLE_ATTACK_FIRED': return `bot=${String(payload.botId ?? payload.haterId ?? 'unknown')} attack=${String(payload.attackType ?? 'unknown')}`;
      case 'CARD_PLAYED':
      case 'CARD_FORCED': return `card=${String(payload.cardName ?? payload.cardId ?? 'unknown')}`;
      case 'SOVEREIGNTY_PROOF_GENERATED': return `proof=${String(payload.proofHash ?? 'unknown')}`;
      default: return `keys=${Object.keys(payload).slice(0, 8).join(',')}`;
    }
  }

  public captureMessageActionTriggered(actionType: 'CARD_PLAYED' | 'CARD_FORCED' | 'OPEN_REPLAY' | 'JUMP_LEGEND', targetId: string | undefined, targetName: string | undefined, channel: ChatTelemetryChannel, roomId?: string): ChatTelemetryEnvelope | undefined {
    return this.emit('MESSAGE_ACTION_TRIGGERED', { actionType, targetId, targetName, channel, roomId }, { origin: 'UI', tags: ['message-action', actionType.toLowerCase(), channel], dedupeKey: `message_action:${actionType}:${targetId ?? 'unknown'}:${channel}`, severity: 'NOTICE' });
  }
}

export function createChatTelemetryEmitter(deps: ChatTelemetryEmitterDependencies = {}): ChatTelemetryEmitter { return new ChatTelemetryEmitter(deps); }
export function createInMemoryChatTelemetryEmitter(deps: Omit<ChatTelemetryEmitterDependencies, 'queue'> = {}): ChatTelemetryEmitter { return new ChatTelemetryEmitter({ ...deps, queue: new InMemoryTelemetryQueue() }); }
