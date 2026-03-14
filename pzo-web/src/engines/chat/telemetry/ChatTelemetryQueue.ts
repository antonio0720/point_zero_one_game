/**
 * ============================================================================
 * POINT ZERO ONE — UNIFIED CHAT TELEMETRY QUEUE
 * FILE: pzo-web/src/engines/chat/telemetry/ChatTelemetryQueue.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Authoritative frontend queue / retry / persistence / transport orchestration
 * layer for chat telemetry.
 *
 * This file is intentionally deeper than a simple `enqueue + flush` helper.
 * It is the operational bridge between:
 *
 * - `ChatTelemetryEmitter.ts` capture,
 * - `ChatTelemetrySchema.ts` validation + normalization + privacy + policy,
 * - future socket / HTTP / beacon handoff into `pzo-server/src/chat`, and
 * - offline-tolerant local durability for replay, diagnostics, and learning.
 *
 * Doctrine
 * --------
 * - emitter owns fast capture,
 * - schema owns shape / validation / normalization,
 * - queue owns delivery mechanics,
 * - backend remains transcript / moderation / learning truth,
 * - queue must be strong enough for burst-heavy chat scenes, invasions,
 *   legend moments, NPC cadence spikes, replay export, and reconnect churn,
 * - queue should degrade gracefully offline without silently destroying the
 *   most valuable gameplay and learning events.
 *
 * Queue Guarantees
 * ----------------
 * 1. every accepted envelope is validated and normalized before transport,
 * 2. replay-worthy / critical / learning-relevant events receive stronger
 *    delivery guarantees and lower drop eligibility,
 * 3. queue supports bounded memory and bounded persistence,
 * 4. queue supports retry with jittered backoff and transport classification,
 * 5. queue supports urgent flush lanes for legend, moderation, failure, and
 *    invasion events,
 * 6. queue supports export snapshots for replay and diagnostics,
 * 7. queue can immediately satisfy the emitter’s `ChatTelemetryQueueLike`
 *    interface while exposing deeper management controls to the rest of the
 *    chat engine.
 *
 * ============================================================================
 */

import type {
  ChatTelemetryConfig,
  ChatTelemetryEnvelope,
  ChatTelemetryEventName,
  ChatTelemetryLoggerLike,
  ChatTelemetryQueueLike,
} from './ChatTelemetryEmitter';

import {
  CHAT_TELEMETRY_SCHEMA_VERSION,
  createChatTelemetryExportSnapshot,
  estimateChatTelemetryBatchSizeBytes,
  estimateChatTelemetryEnvelopeSizeBytes,
  getChatTelemetryFamily,
  getChatTelemetryQueuePolicy,
  isImmediateFlushChatTelemetryEvent,
  normalizeChatTelemetryBatch,
  redactChatTelemetryBatch,
  splitChatTelemetryBatchForTransport,
  summarizeChatTelemetryEnvelope,
  type AnyChatTelemetryEnvelope,
  type ChatTelemetryBatchValidationResult,
  type ChatTelemetryEnvelopeSummary,
  type ChatTelemetryFamily,
  type ChatTelemetryValidationResult,
  validateChatTelemetryBatch,
  validateChatTelemetryEnvelope,
} from './ChatTelemetrySchema';

/* ========================================================================== *
 * Section 1 — Public queue contracts
 * ========================================================================== */

export type ChatTelemetryFlushReason =
  | 'MANUAL'
  | 'INTERVAL'
  | 'IDLE'
  | 'URGENT_EVENT'
  | 'VISIBILITY_HIDDEN'
  | 'PAGE_EXIT'
  | 'CAPACITY_PRESSURE'
  | 'RETRY_TIMER'
  | 'TRANSPORT_READY'
  | 'STARTUP_RESTORE';

export type ChatTelemetryQueueEntryState =
  | 'QUEUED'
  | 'IN_FLIGHT'
  | 'ACKED'
  | 'DROPPED'
  | 'FAILED_RETRYABLE'
  | 'FAILED_TERMINAL';

export type ChatTelemetryQueueDropReason =
  | 'MEMORY_CAP'
  | 'PERSISTENCE_CAP'
  | 'TERMINAL_VALIDATION_FAILURE'
  | 'TERMINAL_TRANSPORT_FAILURE'
  | 'RETRY_BUDGET_EXHAUSTED'
  | 'MANUAL_CLEAR'
  | 'DUPLICATE_REPLACED';

export type ChatTelemetryTransportResultType =
  | 'SUCCESS'
  | 'RETRY'
  | 'DROP';

export interface ChatTelemetryTransportContext {
  flushReason: ChatTelemetryFlushReason;
  batchId: string;
  attempt: number;
  createdAtMs: number;
  startedAtMs: number;
  envelopeCount: number;
  bytes: number;
  families: ChatTelemetryFamily[];
  containsCriticalEvent: boolean;
}

export interface ChatTelemetryTransportResult {
  type: ChatTelemetryTransportResultType;
  statusCode?: number;
  acceptedCount?: number;
  retryAfterMs?: number;
  message?: string;
}

export interface ChatTelemetryTransport {
  send(
    batch: readonly AnyChatTelemetryEnvelope[],
    context: ChatTelemetryTransportContext,
  ): Promise<ChatTelemetryTransportResult> | ChatTelemetryTransportResult;
}

export interface ChatTelemetryUrgentTransport {
  sendUrgent(
    batch: readonly AnyChatTelemetryEnvelope[],
    context: ChatTelemetryTransportContext,
  ): Promise<ChatTelemetryTransportResult> | ChatTelemetryTransportResult;
}

export interface ChatTelemetryBeaconTransport {
  sendBeacon(
    batch: readonly AnyChatTelemetryEnvelope[],
    context: ChatTelemetryTransportContext,
  ): boolean;
}

export interface ChatTelemetryPersistenceSnapshot {
  schemaVersion: typeof CHAT_TELEMETRY_SCHEMA_VERSION;
  savedAtMs: number;
  queueId: string;
  entries: ChatTelemetrySerializedQueueEntry[];
}

export interface ChatTelemetryPersistenceAdapter {
  load(queueId: string): ChatTelemetryPersistenceSnapshot | undefined;
  save(snapshot: ChatTelemetryPersistenceSnapshot): void;
  clear(queueId: string): void;
}

export interface ChatTelemetryQueueObserverEventBase {
  queueId: string;
  nowMs: number;
}

export interface ChatTelemetryQueueBatchEvent extends ChatTelemetryQueueObserverEventBase {
  batchId: string;
  reason: ChatTelemetryFlushReason;
  attempt: number;
  count: number;
  bytes: number;
  families: ChatTelemetryFamily[];
}

export interface ChatTelemetryQueueEntryEvent extends ChatTelemetryQueueObserverEventBase {
  entryId: string;
  eventName: ChatTelemetryEventName;
  family: ChatTelemetryFamily;
  state?: ChatTelemetryQueueEntryState;
  dropReason?: ChatTelemetryQueueDropReason;
}

export interface ChatTelemetryQueueValidationFailureEvent extends ChatTelemetryQueueObserverEventBase {
  envelope: unknown;
  validation: ChatTelemetryValidationResult;
}

export interface ChatTelemetryQueueTransportFailureEvent extends ChatTelemetryQueueBatchEvent {
  result: ChatTelemetryTransportResult;
}

export interface ChatTelemetryQueueObserver {
  onEnqueued?(event: ChatTelemetryQueueEntryEvent): void;
  onDropped?(event: ChatTelemetryQueueEntryEvent): void;
  onBatchStarted?(event: ChatTelemetryQueueBatchEvent): void;
  onBatchSucceeded?(event: ChatTelemetryQueueBatchEvent): void;
  onBatchRetried?(event: ChatTelemetryQueueTransportFailureEvent): void;
  onBatchFailedTerminal?(event: ChatTelemetryQueueTransportFailureEvent): void;
  onValidationFailure?(event: ChatTelemetryQueueValidationFailureEvent): void;
  onPersisted?(event: ChatTelemetryQueueObserverEventBase & { count: number; bytes: number }): void;
  onRestored?(event: ChatTelemetryQueueObserverEventBase & { count: number; bytes: number }): void;
  onCleared?(event: ChatTelemetryQueueObserverEventBase & { count: number; reason: ChatTelemetryQueueDropReason | 'MANUAL' }): void;
}

export interface ChatTelemetryQueueConfig {
  enabled: boolean;
  queueIdPrefix: string;
  autoStart: boolean;
  autoFlushOnUrgentEvent: boolean;
  flushIntervalMs: number;
  idleFlushIntervalMs: number;
  urgentFlushDebounceMs: number;
  maxBatchCount: number;
  maxBatchBytes: number;
  maxMemoryEntries: number;
  maxMemoryBytes: number;
  maxPersistenceEntries: number;
  maxPersistenceBytes: number;
  maxRetryAttempts: number;
  retryBaseDelayMs: number;
  retryMaxDelayMs: number;
  retryJitterRatio: number;
  persistenceDebounceMs: number;
  dropLowestPriorityFirst: boolean;
  persistOfflineEligibleOnly: boolean;
  allowVisibilityFlush: boolean;
  allowExitFlush: boolean;
  ackOnPartialSuccess: boolean;
  offlineAssumeDisconnected: boolean;
  loggerVerbose: boolean;
}

export interface ChatTelemetryQueueDependencies {
  transport?: ChatTelemetryTransport;
  urgentTransport?: ChatTelemetryUrgentTransport;
  beaconTransport?: ChatTelemetryBeaconTransport;
  persistence?: ChatTelemetryPersistenceAdapter;
  logger?: ChatTelemetryLoggerLike;
  observers?: ChatTelemetryQueueObserver[];
  now?: () => number;
  random?: () => number;
  config?: Partial<ChatTelemetryQueueConfig>;
  emitterConfig?: Pick<ChatTelemetryConfig, 'privacy' | 'includeSafePreview' | 'safePreviewMaxChars'>;
  queueId?: string;
}

export interface ChatTelemetryQueueStats {
  queueId: string;
  queuedCount: number;
  inFlightCount: number;
  droppedCount: number;
  queuedBytes: number;
  persistedBytes: number;
  oldestQueuedAtMs?: number;
  newestQueuedAtMs?: number;
  lastFlushAtMs?: number;
  lastPersistAtMs?: number;
  lastTransportStatus?: ChatTelemetryTransportResultType;
  totalAccepted: number;
  totalAcked: number;
  totalDropped: number;
  totalRetried: number;
  totalValidationFailures: number;
  totalTerminalFailures: number;
}

export interface ChatTelemetryQueueSnapshot {
  queueId: string;
  stats: ChatTelemetryQueueStats;
  queued: ChatTelemetrySerializedQueueEntry[];
  inFlight: ChatTelemetrySerializedQueueBatch[];
}

/* ========================================================================== *
 * Section 2 — Internal queue record shapes
 * ========================================================================== */

interface ChatTelemetryQueueEntry {
  entryId: string;
  envelope: AnyChatTelemetryEnvelope;
  summary: ChatTelemetryEnvelopeSummary;
  state: ChatTelemetryQueueEntryState;
  createdAtMs: number;
  updatedAtMs: number;
  attempt: number;
  availableAtMs: number;
  lastError?: string;
  lastStatusCode?: number;
  bytes: number;
}

interface ChatTelemetryQueueBatch {
  batchId: string;
  createdAtMs: number;
  startedAtMs: number;
  reason: ChatTelemetryFlushReason;
  attempt: number;
  entries: ChatTelemetryQueueEntry[];
  bytes: number;
}

export interface ChatTelemetrySerializedQueueEntry {
  entryId: string;
  envelope: AnyChatTelemetryEnvelope;
  state: ChatTelemetryQueueEntryState;
  createdAtMs: number;
  updatedAtMs: number;
  attempt: number;
  availableAtMs: number;
  lastError?: string;
  lastStatusCode?: number;
  bytes: number;
}

export interface ChatTelemetrySerializedQueueBatch {
  batchId: string;
  createdAtMs: number;
  startedAtMs: number;
  reason: ChatTelemetryFlushReason;
  attempt: number;
  entries: ChatTelemetrySerializedQueueEntry[];
  bytes: number;
}

/* ========================================================================== *
 * Section 3 — Defaults / helpers / adapters
 * ========================================================================== */

const DEFAULT_QUEUE_CONFIG: ChatTelemetryQueueConfig = {
  enabled: true,
  queueIdPrefix: 'chat_tq',
  autoStart: true,
  autoFlushOnUrgentEvent: true,
  flushIntervalMs: 3_000,
  idleFlushIntervalMs: 10_000,
  urgentFlushDebounceMs: 50,
  maxBatchCount: 64,
  maxBatchBytes: 256 * 1024,
  maxMemoryEntries: 4_096,
  maxMemoryBytes: 8 * 1024 * 1024,
  maxPersistenceEntries: 4_096,
  maxPersistenceBytes: 16 * 1024 * 1024,
  maxRetryAttempts: 6,
  retryBaseDelayMs: 1_500,
  retryMaxDelayMs: 60_000,
  retryJitterRatio: 0.2,
  persistenceDebounceMs: 400,
  dropLowestPriorityFirst: true,
  persistOfflineEligibleOnly: true,
  allowVisibilityFlush: true,
  allowExitFlush: true,
  ackOnPartialSuccess: true,
  offlineAssumeDisconnected: true,
  loggerVerbose: false,
};

const DEFAULT_REDACTION_CONFIG: Pick<
  ChatTelemetryConfig,
  'privacy' | 'includeSafePreview' | 'safePreviewMaxChars'
> = {
  privacy: {
    includeRoomIds: true,
    includeProfileIds: false,
    includePlayerIds: false,
    includeOfferValues: true,
    includeReplyTargets: true,
  },
  includeSafePreview: true,
  safePreviewMaxChars: 64,
};

const DEFAULT_LOGGER: ChatTelemetryLoggerLike = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

function mergeQueueConfig(
  override?: Partial<ChatTelemetryQueueConfig>,
): ChatTelemetryQueueConfig {
  return {
    ...DEFAULT_QUEUE_CONFIG,
    ...override,
  };
}

function createQueueId(
  prefix: string,
  now: () => number,
  random: () => number,
): string {
  const entropy = Math.floor(random() * 1_000_000_000)
    .toString(36)
    .padStart(6, '0');
  return `${prefix}_${now().toString(36)}_${entropy}`;
}

function createEntryId(
  now: () => number,
  random: () => number,
): string {
  return `tqe_${now().toString(36)}_${Math.floor(random() * 0xfffffff).toString(16)}`;
}

function createBatchId(
  now: () => number,
  random: () => number,
): string {
  return `tqb_${now().toString(36)}_${Math.floor(random() * 0xfffffff).toString(16)}`;
}

function uniqueFamilies(
  envelopes: readonly AnyChatTelemetryEnvelope[],
): ChatTelemetryFamily[] {
  const seen = new Set<ChatTelemetryFamily>();
  const output: ChatTelemetryFamily[] = [];
  for (const envelope of envelopes) {
    const family = getChatTelemetryFamily(envelope.eventName);
    if (seen.has(family)) continue;
    seen.add(family);
    output.push(family);
  }
  return output;
}

function nowSafe(depsNow?: () => number): () => number {
  return depsNow ?? (() => Date.now());
}

function randomSafe(depsRandom?: () => number): () => number {
  return depsRandom ?? (() => Math.random());
}

function isDocumentHidden(): boolean {
  if (typeof document === 'undefined' || typeof document.visibilityState === 'undefined') {
    return false;
  }
  return document.visibilityState === 'hidden';
}

function toSerializedEntry(entry: ChatTelemetryQueueEntry): ChatTelemetrySerializedQueueEntry {
  return {
    entryId: entry.entryId,
    envelope: entry.envelope,
    state: entry.state,
    createdAtMs: entry.createdAtMs,
    updatedAtMs: entry.updatedAtMs,
    attempt: entry.attempt,
    availableAtMs: entry.availableAtMs,
    lastError: entry.lastError,
    lastStatusCode: entry.lastStatusCode,
    bytes: entry.bytes,
  };
}

function fromSerializedEntry(serialized: ChatTelemetrySerializedQueueEntry): ChatTelemetryQueueEntry {
  return {
    entryId: serialized.entryId,
    envelope: serialized.envelope,
    summary: summarizeChatTelemetryEnvelope(serialized.envelope),
    state: serialized.state,
    createdAtMs: serialized.createdAtMs,
    updatedAtMs: serialized.updatedAtMs,
    attempt: serialized.attempt,
    availableAtMs: serialized.availableAtMs,
    lastError: serialized.lastError,
    lastStatusCode: serialized.lastStatusCode,
    bytes: serialized.bytes,
  };
}

/* ========================================================================== *
 * Section 4 — Persistence adapters
 * ========================================================================== */

export class InMemoryChatTelemetryPersistenceAdapter
  implements ChatTelemetryPersistenceAdapter
{
  private readonly snapshots = new Map<string, ChatTelemetryPersistenceSnapshot>();

  public load(queueId: string): ChatTelemetryPersistenceSnapshot | undefined {
    return this.snapshots.get(queueId);
  }

  public save(snapshot: ChatTelemetryPersistenceSnapshot): void {
    this.snapshots.set(snapshot.queueId, snapshot);
  }

  public clear(queueId: string): void {
    this.snapshots.delete(queueId);
  }
}

export class LocalStorageChatTelemetryPersistenceAdapter
  implements ChatTelemetryPersistenceAdapter
{
  private readonly storageKeyPrefix: string;

  constructor(storageKeyPrefix: string = 'pzo_chat_telemetry_queue') {
    this.storageKeyPrefix = storageKeyPrefix;
  }

  public load(queueId: string): ChatTelemetryPersistenceSnapshot | undefined {
    if (typeof localStorage === 'undefined') return undefined;
    const raw = localStorage.getItem(this.storageKey(queueId));
    if (!raw) return undefined;
    try {
      return JSON.parse(raw) as ChatTelemetryPersistenceSnapshot;
    } catch {
      return undefined;
    }
  }

  public save(snapshot: ChatTelemetryPersistenceSnapshot): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(this.storageKey(snapshot.queueId), JSON.stringify(snapshot));
  }

  public clear(queueId: string): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(this.storageKey(queueId));
  }

  private storageKey(queueId: string): string {
    return `${this.storageKeyPrefix}:${queueId}`;
  }
}

/* ========================================================================== *
 * Section 5 — Queue implementation
 * ========================================================================== */

export class ChatTelemetryQueue implements ChatTelemetryQueueLike {
  private readonly queueId: string;
  private readonly now: () => number;
  private readonly random: () => number;
  private readonly logger: ChatTelemetryLoggerLike;
  private readonly config: ChatTelemetryQueueConfig;
  private readonly transport?: ChatTelemetryTransport;
  private readonly urgentTransport?: ChatTelemetryUrgentTransport;
  private readonly beaconTransport?: ChatTelemetryBeaconTransport;
  private readonly persistence?: ChatTelemetryPersistenceAdapter;
  private readonly redactionConfig: Pick<
    ChatTelemetryConfig,
    'privacy' | 'includeSafePreview' | 'safePreviewMaxChars'
  >;
  private readonly observers = new Set<ChatTelemetryQueueObserver>();

  private readonly queued = new Map<string, ChatTelemetryQueueEntry>();
  private readonly inFlight = new Map<string, ChatTelemetryQueueBatch>();
  private readonly ackedHistory: ChatTelemetrySerializedQueueEntry[] = [];
  private readonly droppedHistory: ChatTelemetrySerializedQueueEntry[] = [];
  private readonly recentlySeenEventIds = new Set<string>();
  private readonly recentlySeenDedupeKeys = new Set<string>();

  private flushTimer: ReturnType<typeof setTimeout> | undefined;
  private idleTimer: ReturnType<typeof setTimeout> | undefined;
  private persistTimer: ReturnType<typeof setTimeout> | undefined;
  private urgentFlushTimer: ReturnType<typeof setTimeout> | undefined;
  private started = false;

  private queuedBytes = 0;
  private persistedBytes = 0;
  private totalAccepted = 0;
  private totalAcked = 0;
  private totalDropped = 0;
  private totalRetried = 0;
  private totalValidationFailures = 0;
  private totalTerminalFailures = 0;
  private lastFlushAtMs: number | undefined;
  private lastPersistAtMs: number | undefined;
  private lastTransportStatus: ChatTelemetryTransportResultType | undefined;

  constructor(deps: ChatTelemetryQueueDependencies = {}) {
    this.now = nowSafe(deps.now);
    this.random = randomSafe(deps.random);
    this.logger = deps.logger ?? DEFAULT_LOGGER;
    this.config = mergeQueueConfig(deps.config);
    this.transport = deps.transport;
    this.urgentTransport = deps.urgentTransport;
    this.beaconTransport = deps.beaconTransport;
    this.persistence = deps.persistence;
    this.redactionConfig = deps.emitterConfig ?? DEFAULT_REDACTION_CONFIG;
    this.queueId = deps.queueId ?? createQueueId(this.config.queueIdPrefix, this.now, this.random);

    for (const observer of deps.observers ?? []) {
      this.observers.add(observer);
    }

    this.attachWindowLifecycleHooks();
    this.restoreFromPersistence();

    if (this.config.autoStart) {
      this.start();
    }
  }

  /* ------------------------------------------------------------------------ *
   * Public lifecycle
   * ------------------------------------------------------------------------ */

  public start(): void {
    if (this.started || !this.config.enabled) return;
    this.started = true;
    this.armFlushTimer();
    this.armIdleTimer();
    this.debug('queue.started', { queueId: this.queueId });
  }

  public stop(options: { flush?: boolean } = {}): void {
    if (!this.started) return;
    if (options.flush) {
      void this.flush('MANUAL');
    }
    this.started = false;
    this.clearTimers();
    this.persistNow();
    this.debug('queue.stopped', { queueId: this.queueId });
  }

  public destroy(options: { clearPersistence?: boolean } = {}): void {
    this.stop({ flush: false });
    this.detachWindowLifecycleHooks();
    if (options.clearPersistence) {
      this.clearAll('MANUAL_CLEAR');
      this.persistence?.clear(this.queueId);
    }
  }

  /* ------------------------------------------------------------------------ *
   * Public acceptance lane
   * ------------------------------------------------------------------------ */

  public enqueue(batch: readonly ChatTelemetryEnvelope[]): void {
    if (!this.config.enabled || batch.length === 0) return;

    const validation = validateChatTelemetryBatch(batch);
    this.handleValidationFailures(validation);
    if (validation.valid.length === 0) return;

    const normalized = redactChatTelemetryBatch(
      normalizeChatTelemetryBatch(validation.valid),
      this.redactionConfig,
    );

    for (const envelope of normalized) {
      this.acceptEnvelope(envelope);
    }

    this.schedulePostEnqueueWork(normalized);
  }

  public enqueueOne(envelope: ChatTelemetryEnvelope): void {
    this.enqueue([envelope]);
  }

  /* ------------------------------------------------------------------------ *
   * Public flushing lane
   * ------------------------------------------------------------------------ */

  public async flush(
    reason: ChatTelemetryFlushReason = 'MANUAL',
  ): Promise<void> {
    if (!this.config.enabled) return;
    if (this.queued.size === 0) return;

    const ready = this.getReadyEntries(this.now());
    if (ready.length === 0) return;

    const chunks = splitChatTelemetryBatchForTransport(
      ready.map((entry) => entry.envelope),
      {
        maxBatchCount: this.config.maxBatchCount,
        maxBatchBytes: this.config.maxBatchBytes,
      },
    );

    for (const chunk of chunks) {
      const entries = chunk
        .map((envelope) => this.findQueuedEntryByEventId(envelope.eventId))
        .filter((entry): entry is ChatTelemetryQueueEntry => Boolean(entry));
      if (entries.length === 0) continue;
      await this.dispatchBatch(entries, reason);
    }

    this.lastFlushAtMs = this.now();
    this.armFlushTimer();
    this.armIdleTimer();
  }

  public async flushCritical(): Promise<void> {
    await this.flush('URGENT_EVENT');
  }

  public flushWithBeacon(reason: ChatTelemetryFlushReason = 'PAGE_EXIT'): boolean {
    if (!this.beaconTransport || this.queued.size === 0) return false;

    const ready = this.getReadyEntries(this.now())
      .filter((entry) => isImmediateFlushChatTelemetryEvent(entry.envelope.eventName));

    if (ready.length === 0) return false;

    const envelopes = ready.map((entry) => entry.envelope);
    const context = this.createTransportContext(
      createBatchId(this.now, this.random),
      envelopes,
      reason,
      0,
      this.now(),
    );

    const sent = this.beaconTransport.sendBeacon(envelopes, context);
    if (!sent) return false;

    for (const entry of ready) {
      this.ackEntry(entry);
    }

    this.persistNow();
    return true;
  }

  /* ------------------------------------------------------------------------ *
   * Public inspection / export lane
   * ------------------------------------------------------------------------ */

  public getStats(): ChatTelemetryQueueStats {
    const queuedEntries = [...this.queued.values()];
    const queuedAtValues = queuedEntries.map((entry) => entry.createdAtMs);

    return {
      queueId: this.queueId,
      queuedCount: queuedEntries.length,
      inFlightCount: this.countInFlightEntries(),
      droppedCount: this.droppedHistory.length,
      queuedBytes: this.queuedBytes,
      persistedBytes: this.persistedBytes,
      oldestQueuedAtMs: queuedAtValues.length > 0 ? Math.min(...queuedAtValues) : undefined,
      newestQueuedAtMs: queuedAtValues.length > 0 ? Math.max(...queuedAtValues) : undefined,
      lastFlushAtMs: this.lastFlushAtMs,
      lastPersistAtMs: this.lastPersistAtMs,
      lastTransportStatus: this.lastTransportStatus,
      totalAccepted: this.totalAccepted,
      totalAcked: this.totalAcked,
      totalDropped: this.totalDropped,
      totalRetried: this.totalRetried,
      totalValidationFailures: this.totalValidationFailures,
      totalTerminalFailures: this.totalTerminalFailures,
    };
  }

  public getSnapshot(): ChatTelemetryQueueSnapshot {
    return {
      queueId: this.queueId,
      stats: this.getStats(),
      queued: [...this.queued.values()].map(toSerializedEntry),
      inFlight: [...this.inFlight.values()].map((batch) => ({
        batchId: batch.batchId,
        createdAtMs: batch.createdAtMs,
        startedAtMs: batch.startedAtMs,
        reason: batch.reason,
        attempt: batch.attempt,
        entries: batch.entries.map(toSerializedEntry),
        bytes: batch.bytes,
      })),
    };
  }

  public exportQueuedEnvelopes(): AnyChatTelemetryEnvelope[] {
    return [...this.queued.values()]
      .sort((a, b) => a.createdAtMs - b.createdAtMs)
      .map((entry) => entry.envelope);
  }

  public exportQueuedSnapshot() {
    return createChatTelemetryExportSnapshot(this.exportQueuedEnvelopes(), this.now());
  }

  public peekQueued(count: number = 25): ChatTelemetryEnvelopeSummary[] {
    return [...this.queued.values()]
      .sort((a, b) => a.createdAtMs - b.createdAtMs)
      .slice(0, count)
      .map((entry) => entry.summary);
  }

  public hasQueuedEvent(eventName: ChatTelemetryEventName): boolean {
    for (const entry of this.queued.values()) {
      if (entry.envelope.eventName === eventName) return true;
    }
    return false;
  }

  /* ------------------------------------------------------------------------ *
   * Public maintenance lane
   * ------------------------------------------------------------------------ */

  public clearAll(reason: ChatTelemetryQueueDropReason | 'MANUAL' = 'MANUAL'): void {
    const allEntries = [...this.queued.values()];
    this.queued.clear();
    this.inFlight.clear();
    this.queuedBytes = 0;

    for (const entry of allEntries) {
      this.recordDroppedEntry(entry, reason === 'MANUAL' ? 'MANUAL_CLEAR' : reason);
    }

    this.persistence?.clear(this.queueId);
    this.persistedBytes = 0;
    this.emitCleared(allEntries.length, reason);
  }

  public registerObserver(observer: ChatTelemetryQueueObserver): () => void {
    this.observers.add(observer);
    return () => {
      this.observers.delete(observer);
    };
  }

  /* ------------------------------------------------------------------------ *
   * Internal acceptance logic
   * ------------------------------------------------------------------------ */

  private handleValidationFailures(
    validation: ChatTelemetryBatchValidationResult,
  ): void {
    if (validation.invalid.length === 0) return;

    for (const invalid of validation.invalid) {
      this.totalValidationFailures += 1;
      const nowMs = this.now();
      for (const observer of this.observers) {
        observer.onValidationFailure?.({
          queueId: this.queueId,
          nowMs,
          envelope: invalid.envelope,
          validation: invalid.validation,
        });
      }
      this.warn('queue.validation_failed', {
        issues: invalid.validation.issues,
      });
    }
  }

  private acceptEnvelope(envelope: AnyChatTelemetryEnvelope): void {
    const envelopeValidation = validateChatTelemetryEnvelope(envelope);
    if (!envelopeValidation.ok) {
      this.handleValidationFailures({
        valid: [],
        invalid: [{ envelope, validation: envelopeValidation }],
      });
      return;
    }

    if (this.recentlySeenEventIds.has(envelope.eventId)) {
      return;
    }

    if (envelope.dedupeKey && this.recentlySeenDedupeKeys.has(envelope.dedupeKey)) {
      this.replaceDuplicateByDedupeKey(envelope.dedupeKey, envelope);
      return;
    }

    const entry = this.createQueueEntry(envelope);
    this.queued.set(entry.entryId, entry);
    this.queuedBytes += entry.bytes;
    this.totalAccepted += 1;
    this.recentlySeenEventIds.add(envelope.eventId);
    if (envelope.dedupeKey) {
      this.recentlySeenDedupeKeys.add(envelope.dedupeKey);
    }

    this.enforceCapacity();
    this.emitEnqueued(entry);
  }

  private createQueueEntry(
    envelope: AnyChatTelemetryEnvelope,
  ): ChatTelemetryQueueEntry {
    const nowMs = this.now();
    return {
      entryId: createEntryId(this.now, this.random),
      envelope,
      summary: summarizeChatTelemetryEnvelope(envelope),
      state: 'QUEUED',
      createdAtMs: nowMs,
      updatedAtMs: nowMs,
      attempt: 0,
      availableAtMs: nowMs,
      bytes: estimateChatTelemetryEnvelopeSizeBytes(envelope),
    };
  }

  private replaceDuplicateByDedupeKey(
    dedupeKey: string,
    envelope: AnyChatTelemetryEnvelope,
  ): void {
    for (const [entryId, entry] of this.queued.entries()) {
      if (entry.envelope.dedupeKey !== dedupeKey) continue;
      this.queuedBytes -= entry.bytes;
      this.queued.delete(entryId);
      this.recordDroppedEntry(entry, 'DUPLICATE_REPLACED');
      break;
    }
    this.acceptEnvelope(envelope);
  }

  private schedulePostEnqueueWork(
    accepted: readonly AnyChatTelemetryEnvelope[],
  ): void {
    this.schedulePersistence();

    if (!this.started && this.config.autoStart) {
      this.start();
    }

    const shouldUrgentFlush =
      this.config.autoFlushOnUrgentEvent &&
      accepted.some((envelope) => isImmediateFlushChatTelemetryEvent(envelope.eventName));

    if (shouldUrgentFlush) {
      this.armUrgentFlushTimer();
      return;
    }

    this.armFlushTimer();
    this.armIdleTimer();
  }

  /* ------------------------------------------------------------------------ *
   * Internal dispatch logic
   * ------------------------------------------------------------------------ */

  private async dispatchBatch(
    entries: readonly ChatTelemetryQueueEntry[],
    reason: ChatTelemetryFlushReason,
  ): Promise<void> {
    const envelopes = entries.map((entry) => entry.envelope);
    const attempt = Math.max(...entries.map((entry) => entry.attempt), 0);
    const batchId = createBatchId(this.now, this.random);
    const startedAtMs = this.now();
    const batch: ChatTelemetryQueueBatch = {
      batchId,
      createdAtMs: startedAtMs,
      startedAtMs,
      reason,
      attempt,
      entries: [...entries],
      bytes: estimateChatTelemetryBatchSizeBytes(envelopes),
    };

    for (const entry of entries) {
      entry.state = 'IN_FLIGHT';
      entry.updatedAtMs = startedAtMs;
      this.queued.delete(entry.entryId);
      this.queuedBytes -= entry.bytes;
    }

    this.inFlight.set(batchId, batch);
    const context = this.createTransportContext(
      batchId,
      envelopes,
      reason,
      attempt,
      startedAtMs,
    );

    this.emitBatchStarted(context);

    const useUrgentTransport = reason === 'URGENT_EVENT' && Boolean(this.urgentTransport);

    if (!this.transport && !useUrgentTransport) {
      this.requeueBatch(batch, {
        type: 'RETRY',
        message: 'No transport configured.',
      });
      return;
    }

    try {
      const result = useUrgentTransport
        ? await this.urgentTransport!.sendUrgent(envelopes, context)
        : await this.transport!.send(envelopes, context);
      this.lastTransportStatus = result.type;

      switch (result.type) {
        case 'SUCCESS':
          this.ackBatch(batch, context, result);
          break;
        case 'RETRY':
          this.requeueBatch(batch, result, context);
          break;
        case 'DROP':
          this.dropBatch(batch, result, context);
          break;
      }
    } catch (error) {
      this.requeueBatch(
        batch,
        {
          type: 'RETRY',
          message: error instanceof Error ? error.message : 'Unknown transport failure.',
        },
        context,
      );
    }
  }

  private ackBatch(
    batch: ChatTelemetryQueueBatch,
    context: ChatTelemetryTransportContext,
    result: ChatTelemetryTransportResult,
  ): void {
    this.inFlight.delete(batch.batchId);

    if (
      this.config.ackOnPartialSuccess &&
      typeof result.acceptedCount === 'number' &&
      result.acceptedCount >= 0 &&
      result.acceptedCount < batch.entries.length
    ) {
      const acked = batch.entries.slice(0, result.acceptedCount);
      const retried = batch.entries.slice(result.acceptedCount);
      for (const entry of acked) {
        this.ackEntry(entry);
      }
      if (retried.length > 0) {
        this.scheduleRetry(retried, {
          type: 'RETRY',
          message: 'Transport partially accepted batch.',
          statusCode: result.statusCode,
        }, context.flushReason);
      }
    } else {
      for (const entry of batch.entries) {
        this.ackEntry(entry);
      }
    }

    this.emitBatchSucceeded(context);
    this.persistNow();
  }

  private requeueBatch(
    batch: ChatTelemetryQueueBatch,
    result: ChatTelemetryTransportResult,
    context?: ChatTelemetryTransportContext,
  ): void {
    this.inFlight.delete(batch.batchId);
    this.totalRetried += batch.entries.length;

    this.scheduleRetry(batch.entries, result, context?.flushReason ?? batch.reason);

    const eventContext = context ?? this.createTransportContext(
      batch.batchId,
      batch.entries.map((entry) => entry.envelope),
      batch.reason,
      batch.attempt,
      batch.startedAtMs,
    );

    const nowMs = this.now();
    for (const observer of this.observers) {
      observer.onBatchRetried?.({
        queueId: this.queueId,
        nowMs,
        batchId: eventContext.batchId,
        reason: eventContext.flushReason,
        attempt: eventContext.attempt,
        count: eventContext.envelopeCount,
        bytes: eventContext.bytes,
        families: eventContext.families,
        result,
      });
    }

    this.warn('queue.batch_retry', {
      batchId: eventContext.batchId,
      reason: eventContext.flushReason,
      result,
    });
    this.persistNow();
  }

  private dropBatch(
    batch: ChatTelemetryQueueBatch,
    result: ChatTelemetryTransportResult,
    context?: ChatTelemetryTransportContext,
  ): void {
    this.inFlight.delete(batch.batchId);
    this.totalTerminalFailures += batch.entries.length;

    for (const entry of batch.entries) {
      entry.state = 'FAILED_TERMINAL';
      entry.updatedAtMs = this.now();
      entry.lastError = result.message;
      entry.lastStatusCode = result.statusCode;
      this.recordDroppedEntry(entry, 'TERMINAL_TRANSPORT_FAILURE');
    }

    const eventContext = context ?? this.createTransportContext(
      batch.batchId,
      batch.entries.map((entry) => entry.envelope),
      batch.reason,
      batch.attempt,
      batch.startedAtMs,
    );

    const nowMs = this.now();
    for (const observer of this.observers) {
      observer.onBatchFailedTerminal?.({
        queueId: this.queueId,
        nowMs,
        batchId: eventContext.batchId,
        reason: eventContext.flushReason,
        attempt: eventContext.attempt,
        count: eventContext.envelopeCount,
        bytes: eventContext.bytes,
        families: eventContext.families,
        result,
      });
    }

    this.error('queue.batch_drop', {
      batchId: eventContext.batchId,
      reason: eventContext.flushReason,
      result,
    });
    this.persistNow();
  }

  private scheduleRetry(
    entries: readonly ChatTelemetryQueueEntry[],
    result: ChatTelemetryTransportResult,
    reason: ChatTelemetryFlushReason,
  ): void {
    const nowMs = this.now();
    for (const entry of entries) {
      entry.attempt += 1;
      entry.updatedAtMs = nowMs;
      entry.lastError = result.message;
      entry.lastStatusCode = result.statusCode;

      if (entry.attempt > this.config.maxRetryAttempts) {
        entry.state = 'FAILED_TERMINAL';
        this.totalTerminalFailures += 1;
        this.recordDroppedEntry(entry, 'RETRY_BUDGET_EXHAUSTED');
        continue;
      }

      entry.state = 'FAILED_RETRYABLE';
      entry.availableAtMs = nowMs + this.computeRetryDelay(entry.attempt, result.retryAfterMs);
      this.queued.set(entry.entryId, entry);
      this.queuedBytes += entry.bytes;
    }

    this.armFlushTimer();
    this.armIdleTimer();
    this.schedulePersistence();
    this.debug('queue.retry_scheduled', {
      reason,
      retryAt: Math.min(...entries.map((entry) => entry.availableAtMs)),
    });
  }

  private ackEntry(entry: ChatTelemetryQueueEntry): void {
    entry.state = 'ACKED';
    entry.updatedAtMs = this.now();
    this.totalAcked += 1;
    this.ackedHistory.push(toSerializedEntry(entry));
    if (this.ackedHistory.length > 1_024) {
      this.ackedHistory.shift();
    }
  }

  /* ------------------------------------------------------------------------ *
   * Capacity / drop control
   * ------------------------------------------------------------------------ */

  private enforceCapacity(): void {
    while (
      this.queued.size > this.config.maxMemoryEntries ||
      this.queuedBytes > this.config.maxMemoryBytes
    ) {
      const candidate = this.pickDropCandidate();
      if (!candidate) break;
      this.queued.delete(candidate.entryId);
      this.queuedBytes -= candidate.bytes;
      this.recordDroppedEntry(candidate, 'MEMORY_CAP');
    }
  }

  private pickDropCandidate(): ChatTelemetryQueueEntry | undefined {
    const entries = [...this.queued.values()];
    if (entries.length === 0) return undefined;

    if (!this.config.dropLowestPriorityFirst) {
      return entries.sort((a, b) => a.createdAtMs - b.createdAtMs)[0];
    }

    return entries.sort((a, b) => {
      const pa = this.priorityWeight(a.envelope.eventName);
      const pb = this.priorityWeight(b.envelope.eventName);
      if (pa !== pb) return pa - pb;
      return a.createdAtMs - b.createdAtMs;
    })[0];
  }

  private priorityWeight(eventName: ChatTelemetryEventName): number {
    const priority = getChatTelemetryQueuePolicy(eventName).priority;
    switch (priority) {
      case 'BACKGROUND':
        return 0;
      case 'STANDARD':
        return 1;
      case 'HIGH':
        return 2;
      case 'CRITICAL':
        return 3;
    }
  }

  private recordDroppedEntry(
    entry: ChatTelemetryQueueEntry,
    dropReason: ChatTelemetryQueueDropReason,
  ): void {
    entry.state = 'DROPPED';
    entry.updatedAtMs = this.now();
    this.totalDropped += 1;
    this.droppedHistory.push(toSerializedEntry(entry));
    if (this.droppedHistory.length > 1_024) {
      this.droppedHistory.shift();
    }

    const nowMs = this.now();
    for (const observer of this.observers) {
      observer.onDropped?.({
        queueId: this.queueId,
        nowMs,
        entryId: entry.entryId,
        eventName: entry.envelope.eventName,
        family: getChatTelemetryFamily(entry.envelope.eventName),
        state: entry.state,
        dropReason,
      });
    }

    this.error('queue.entry_dropped', {
      entryId: entry.entryId,
      eventName: entry.envelope.eventName,
      dropReason,
    });
  }

  /* ------------------------------------------------------------------------ *
   * Persistence
   * ------------------------------------------------------------------------ */

  private restoreFromPersistence(): void {
    if (!this.persistence) return;

    const snapshot = this.persistence.load(this.queueId);
    if (!snapshot || !Array.isArray(snapshot.entries)) return;

    const entries = snapshot.entries
      .map((serialized) => {
        const validation = validateChatTelemetryEnvelope(serialized.envelope);
        if (!validation.ok) return undefined;
        return fromSerializedEntry(serialized);
      })
      .filter((entry): entry is ChatTelemetryQueueEntry => Boolean(entry));

    for (const entry of entries) {
      this.queued.set(entry.entryId, entry);
      this.queuedBytes += entry.bytes;
      this.totalAccepted += 1;
      this.recentlySeenEventIds.add(entry.envelope.eventId);
      if (entry.envelope.dedupeKey) {
        this.recentlySeenDedupeKeys.add(entry.envelope.dedupeKey);
      }
    }

    this.persistedBytes = estimateChatTelemetryBatchSizeBytes(entries.map((entry) => entry.envelope));
    this.lastPersistAtMs = snapshot.savedAtMs;

    const nowMs = this.now();
    for (const observer of this.observers) {
      observer.onRestored?.({
        queueId: this.queueId,
        nowMs,
        count: entries.length,
        bytes: this.persistedBytes,
      });
    }

    this.debug('queue.restored', {
      count: entries.length,
      bytes: this.persistedBytes,
    });
  }

  private schedulePersistence(): void {
    if (!this.persistence) return;
    if (this.persistTimer) return;
    this.persistTimer = setTimeout(() => {
      this.persistTimer = undefined;
      this.persistNow();
    }, this.config.persistenceDebounceMs);
  }

  private persistNow(): void {
    if (!this.persistence) return;

    const eligibleEntries = [...this.queued.values()]
      .filter((entry) => {
        if (!this.config.persistOfflineEligibleOnly) return true;
        return getChatTelemetryQueuePolicy(entry.envelope.eventName).allowOfflinePersistence;
      })
      .sort((a, b) => a.createdAtMs - b.createdAtMs);

    const persistedEntries = this.capPersistenceEntries(eligibleEntries)
      .map(toSerializedEntry);

    const snapshot: ChatTelemetryPersistenceSnapshot = {
      schemaVersion: CHAT_TELEMETRY_SCHEMA_VERSION,
      savedAtMs: this.now(),
      queueId: this.queueId,
      entries: persistedEntries,
    };

    this.persistence.save(snapshot);
    this.persistedBytes = estimateChatTelemetryBatchSizeBytes(
      persistedEntries.map((entry) => entry.envelope),
    );
    this.lastPersistAtMs = snapshot.savedAtMs;

    const nowMs = this.now();
    for (const observer of this.observers) {
      observer.onPersisted?.({
        queueId: this.queueId,
        nowMs,
        count: persistedEntries.length,
        bytes: this.persistedBytes,
      });
    }

    this.debug('queue.persisted', {
      count: persistedEntries.length,
      bytes: this.persistedBytes,
    });
  }

  private capPersistenceEntries(
    entries: readonly ChatTelemetryQueueEntry[],
  ): ChatTelemetryQueueEntry[] {
    const output: ChatTelemetryQueueEntry[] = [];
    let totalBytes = 0;

    for (const entry of entries) {
      if (output.length >= this.config.maxPersistenceEntries) break;
      if (totalBytes + entry.bytes > this.config.maxPersistenceBytes && output.length > 0) {
        break;
      }
      output.push(entry);
      totalBytes += entry.bytes;
    }

    return output;
  }

  /* ------------------------------------------------------------------------ *
   * Timers / scheduling
   * ------------------------------------------------------------------------ */

  private armFlushTimer(): void {
    if (!this.started || this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = undefined;
      void this.flush('INTERVAL');
    }, this.config.flushIntervalMs);
  }

  private armIdleTimer(): void {
    if (!this.started || this.idleTimer) return;
    this.idleTimer = setTimeout(() => {
      this.idleTimer = undefined;
      void this.flush('IDLE');
    }, this.config.idleFlushIntervalMs);
  }

  private armUrgentFlushTimer(): void {
    if (this.urgentFlushTimer) return;
    this.urgentFlushTimer = setTimeout(() => {
      this.urgentFlushTimer = undefined;
      void this.flush('URGENT_EVENT');
    }, this.config.urgentFlushDebounceMs);
  }

  private clearTimers(): void {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (this.persistTimer) clearTimeout(this.persistTimer);
    if (this.urgentFlushTimer) clearTimeout(this.urgentFlushTimer);
    this.flushTimer = undefined;
    this.idleTimer = undefined;
    this.persistTimer = undefined;
    this.urgentFlushTimer = undefined;
  }

  private computeRetryDelay(
    attempt: number,
    retryAfterMs?: number,
  ): number {
    if (typeof retryAfterMs === 'number' && retryAfterMs > 0) {
      return retryAfterMs;
    }

    const exponential = Math.min(
      this.config.retryMaxDelayMs,
      this.config.retryBaseDelayMs * 2 ** Math.max(0, attempt - 1),
    );
    const jitter = exponential * this.config.retryJitterRatio * this.random();
    return Math.round(exponential + jitter);
  }

  private getReadyEntries(nowMs: number): ChatTelemetryQueueEntry[] {
    return [...this.queued.values()]
      .filter((entry) => entry.availableAtMs <= nowMs)
      .sort((a, b) => {
        const wa = this.priorityWeight(a.envelope.eventName);
        const wb = this.priorityWeight(b.envelope.eventName);
        if (wa !== wb) return wb - wa;
        if (a.availableAtMs !== b.availableAtMs) return a.availableAtMs - b.availableAtMs;
        return a.createdAtMs - b.createdAtMs;
      });
  }

  private findQueuedEntryByEventId(
    eventId: string,
  ): ChatTelemetryQueueEntry | undefined {
    for (const entry of this.queued.values()) {
      if (entry.envelope.eventId === eventId) return entry;
    }
    return undefined;
  }

  private countInFlightEntries(): number {
    let count = 0;
    for (const batch of this.inFlight.values()) {
      count += batch.entries.length;
    }
    return count;
  }

  /* ------------------------------------------------------------------------ *
   * Transport context / events / logging
   * ------------------------------------------------------------------------ */

  private createTransportContext(
    batchId: string,
    envelopes: readonly AnyChatTelemetryEnvelope[],
    flushReason: ChatTelemetryFlushReason,
    attempt: number,
    startedAtMs: number,
  ): ChatTelemetryTransportContext {
    return {
      flushReason,
      batchId,
      attempt,
      createdAtMs: startedAtMs,
      startedAtMs,
      envelopeCount: envelopes.length,
      bytes: estimateChatTelemetryBatchSizeBytes(envelopes),
      families: uniqueFamilies(envelopes),
      containsCriticalEvent: envelopes.some((envelope) => envelope.severity === 'CRITICAL'),
    };
  }

  private emitEnqueued(entry: ChatTelemetryQueueEntry): void {
    const nowMs = this.now();
    for (const observer of this.observers) {
      observer.onEnqueued?.({
        queueId: this.queueId,
        nowMs,
        entryId: entry.entryId,
        eventName: entry.envelope.eventName,
        family: getChatTelemetryFamily(entry.envelope.eventName),
        state: entry.state,
      });
    }
    this.debug('queue.enqueued', {
      entryId: entry.entryId,
      eventName: entry.envelope.eventName,
      bytes: entry.bytes,
    });
  }

  private emitBatchStarted(context: ChatTelemetryTransportContext): void {
    const nowMs = this.now();
    for (const observer of this.observers) {
      observer.onBatchStarted?.({
        queueId: this.queueId,
        nowMs,
        batchId: context.batchId,
        reason: context.flushReason,
        attempt: context.attempt,
        count: context.envelopeCount,
        bytes: context.bytes,
        families: context.families,
      });
    }
    this.info('queue.batch_started', context as unknown as Record<string, unknown>);
  }

  private emitBatchSucceeded(context: ChatTelemetryTransportContext): void {
    const nowMs = this.now();
    for (const observer of this.observers) {
      observer.onBatchSucceeded?.({
        queueId: this.queueId,
        nowMs,
        batchId: context.batchId,
        reason: context.flushReason,
        attempt: context.attempt,
        count: context.envelopeCount,
        bytes: context.bytes,
        families: context.families,
      });
    }
    this.info('queue.batch_succeeded', context as unknown as Record<string, unknown>);
  }

  private emitCleared(
    count: number,
    reason: ChatTelemetryQueueDropReason | 'MANUAL',
  ): void {
    const nowMs = this.now();
    for (const observer of this.observers) {
      observer.onCleared?.({
        queueId: this.queueId,
        nowMs,
        count,
        reason,
      });
    }
  }

  /* ------------------------------------------------------------------------ *
   * Window lifecycle integration
   * ------------------------------------------------------------------------ */

  private visibilityHandler = () => {
    if (!this.config.allowVisibilityFlush) return;
    if (!isDocumentHidden()) return;
    if (this.queued.size === 0) return;
    void this.flush('VISIBILITY_HIDDEN');
  };

  private pageHideHandler = () => {
    if (!this.config.allowExitFlush) return;
    if (this.queued.size === 0) return;
    if (!this.flushWithBeacon('PAGE_EXIT')) {
      void this.flush('PAGE_EXIT');
    }
  };

  private onlineHandler = () => {
    if (this.queued.size === 0) return;
    void this.flush('TRANSPORT_READY');
  };

  private attachWindowLifecycleHooks(): void {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.visibilityHandler);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', this.pageHideHandler);
      window.addEventListener('online', this.onlineHandler);
    }
  }

  private detachWindowLifecycleHooks(): void {
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('pagehide', this.pageHideHandler);
      window.removeEventListener('online', this.onlineHandler);
    }
  }

  /* ------------------------------------------------------------------------ *
   * Logging helpers
   * ------------------------------------------------------------------------ */

  private debug(message: string, context?: Record<string, unknown>): void {
    if (!this.config.loggerVerbose) return;
    this.logger.debug(message, context);
  }

  private info(message: string, context?: Record<string, unknown>): void {
    this.logger.info(message, context);
  }

  private warn(message: string, context?: Record<string, unknown>): void {
    this.logger.warn(message, context);
  }

  private error(message: string, context?: Record<string, unknown>): void {
    this.logger.error(message, context);
  }
}

/* ========================================================================== *
 * Section 6 — Built-in transport helpers
 * ========================================================================== */

export class InMemoryChatTelemetryTransport implements ChatTelemetryTransport {
  private readonly sentBatches: Array<{
    batch: AnyChatTelemetryEnvelope[];
    context: ChatTelemetryTransportContext;
  }> = [];

  public send(
    batch: readonly AnyChatTelemetryEnvelope[],
    context: ChatTelemetryTransportContext,
  ): ChatTelemetryTransportResult {
    this.sentBatches.push({ batch: [...batch], context });
    return {
      type: 'SUCCESS',
      acceptedCount: batch.length,
    };
  }

  public drain(): Array<{
    batch: AnyChatTelemetryEnvelope[];
    context: ChatTelemetryTransportContext;
  }> {
    const drained = [...this.sentBatches];
    this.sentBatches.length = 0;
    return drained;
  }
}

export class SendBeaconChatTelemetryTransport implements ChatTelemetryBeaconTransport {
  private readonly endpoint: string;

  constructor(endpoint: string) {
    this.endpoint = endpoint;
  }

  public sendBeacon(
    batch: readonly AnyChatTelemetryEnvelope[],
    _context: ChatTelemetryTransportContext,
  ): boolean {
    if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') {
      return false;
    }

    const payload = JSON.stringify({
      schemaVersion: CHAT_TELEMETRY_SCHEMA_VERSION,
      count: batch.length,
      events: batch,
    });

    return navigator.sendBeacon(
      this.endpoint,
      new Blob([payload], { type: 'application/json' }),
    );
  }
}

export class FetchChatTelemetryTransport implements ChatTelemetryTransport {
  private readonly endpoint: string;
  private readonly headers: Record<string, string>;
  private readonly credentials: RequestCredentials | undefined;

  constructor(options: {
    endpoint: string;
    headers?: Record<string, string>;
    credentials?: RequestCredentials;
  }) {
    this.endpoint = options.endpoint;
    this.headers = options.headers ?? {};
    this.credentials = options.credentials;
  }

  public async send(
    batch: readonly AnyChatTelemetryEnvelope[],
    context: ChatTelemetryTransportContext,
  ): Promise<ChatTelemetryTransportResult> {
    if (typeof fetch === 'undefined') {
      return {
        type: 'RETRY',
        message: 'fetch is unavailable in this environment.',
      };
    }

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...this.headers,
      },
      credentials: this.credentials,
      body: JSON.stringify({
        schemaVersion: CHAT_TELEMETRY_SCHEMA_VERSION,
        count: batch.length,
        context,
        events: batch,
      }),
      keepalive: context.flushReason === 'PAGE_EXIT',
    });

    if (response.ok) {
      return {
        type: 'SUCCESS',
        statusCode: response.status,
        acceptedCount: batch.length,
      };
    }

    if (response.status === 429 || response.status >= 500) {
      const retryAfter = Number(response.headers.get('retry-after'));
      return {
        type: 'RETRY',
        statusCode: response.status,
        retryAfterMs: Number.isFinite(retryAfter) ? retryAfter * 1_000 : undefined,
        message: `Telemetry transport retryable HTTP status ${response.status}.`,
      };
    }

    return {
      type: 'DROP',
      statusCode: response.status,
      message: `Telemetry transport terminal HTTP status ${response.status}.`,
    };
  }
}

/* ========================================================================== *
 * Section 7 — Factory helpers
 * ========================================================================== */

export function createInMemoryChatTelemetryQueue(
  deps: Omit<ChatTelemetryQueueDependencies, 'transport'> = {},
): ChatTelemetryQueue {
  return new ChatTelemetryQueue({
    ...deps,
    transport: new InMemoryChatTelemetryTransport(),
  });
}

export function createLocalDurableChatTelemetryQueue(options: {
  endpoint: string;
  queueId?: string;
  logger?: ChatTelemetryLoggerLike;
  config?: Partial<ChatTelemetryQueueConfig>;
  emitterConfig?: Pick<ChatTelemetryConfig, 'privacy' | 'includeSafePreview' | 'safePreviewMaxChars'>;
}): ChatTelemetryQueue {
  return new ChatTelemetryQueue({
    queueId: options.queueId,
    logger: options.logger,
    config: options.config,
    emitterConfig: options.emitterConfig,
    persistence: new LocalStorageChatTelemetryPersistenceAdapter(),
    transport: new FetchChatTelemetryTransport({
      endpoint: options.endpoint,
    }),
    beaconTransport: new SendBeaconChatTelemetryTransport(options.endpoint),
  });
}
