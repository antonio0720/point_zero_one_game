/**
 * Event Consumer Framework
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/src/data_pipeline/event_consumer.ts
 *
 * Per-topic consumers with:
 * - schema validation on consume
 * - application-level exactly-once boundaries via idempotency store
 * - dead-letter queue handling
 * - lag metric emission
 *
 * Repo-aligned rewrite:
 * - removes direct dependency on KafkaJS, which is not currently declared
 * - removes direct dependency on @pointzeroonedigital/metrics, which is not currently declared
 * - keeps transport pluggable so this can be wired to Kafka, BullMQ, Redis streams,
 *   or another broker without rewriting business logic
 */

import * as Joi from 'joi';
import {
  DeadLetterQueue,
  type DeadLetterQueueMessage,
} from './dead_letter_queue';

export type EventHeaders = Record<string, string | Buffer | undefined>;

export interface EventSourceMessage {
  topic: string;
  partition: number;
  offset: string;
  key?: string | Buffer | null;
  value: unknown;
  headers?: EventHeaders;
  timestamp?: string | number | Date;
  ack?: () => Promise<void> | void;
  heartbeat?: () => Promise<void> | void;
}

export interface EventSource {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  subscribe(topics: string[]): Promise<void>;
  run(handler: (message: EventSourceMessage) => Promise<void>): Promise<void>;
  getLag(topic: string, consumerGroupId: string): Promise<number | null>;
}

export interface EventConsumerLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export interface EventConsumerMetricsSink {
  increment(
    metricName: string,
    value?: number,
    tags?: Record<string, string>,
  ): void | Promise<void>;

  gauge(
    metricName: string,
    value: number,
    tags?: Record<string, string>,
  ): void | Promise<void>;
}

export type IdempotencyDisposition = 'completed' | 'dead-lettered';

export interface ConsumerIdempotencyStore {
  begin(
    key: string,
    ttlMs: number,
  ): Promise<'acquired' | 'duplicate'>;

  complete(
    key: string,
    disposition: IdempotencyDisposition,
    metadata?: Record<string, string>,
  ): Promise<void>;

  release(key: string): Promise<void>;
}

export interface EventConsumerContext<TPayload> {
  topic: string;
  consumerGroupId: string;
  partition: number;
  offset: string;
  key: string | null;
  headers: Record<string, string>;
  timestamp: string;
  idempotencyKey: string;
  rawMessage: EventSourceMessage;
  payload: TPayload;
  heartbeat(): Promise<void>;
}

export interface TopicConfig<TPayload = unknown> {
  topic: string;
  schemaValidator: Joi.Schema<TPayload>;
  handler: (payload: TPayload, context: EventConsumerContext<TPayload>) => Promise<void>;
  resolveIdempotencyKey?: (
    payload: TPayload,
    message: EventSourceMessage,
  ) => string | null;
}

export interface EventConsumerOptions {
  topics: TopicConfig[];
  consumerGroupId: string;
  source: EventSource;
  deadLetterQueue: DeadLetterQueue;
  idempotencyStore: ConsumerIdempotencyStore;
  metrics?: EventConsumerMetricsSink;
  logger?: EventConsumerLogger;
  lagMetricIntervalMs?: number;
  idempotencyTtlMs?: number;
}

type JsonRecord = Record<string, unknown>;

const DEFAULT_LAG_METRIC_INTERVAL_MS = 15_000;
const DEFAULT_IDEMPOTENCY_TTL_MS = 10 * 60 * 1000;
const METRIC_CONSUMER_LAG = 'CONSUMER_LAG';
const METRIC_CONSUMED = 'EVENT_CONSUMED_TOTAL';
const METRIC_DUPLICATE = 'EVENT_DUPLICATE_TOTAL';
const METRIC_FAILED = 'EVENT_FAILED_TOTAL';
const METRIC_DLQ = 'EVENT_DLQ_TOTAL';
const METRIC_VALIDATION_FAILED = 'EVENT_VALIDATION_FAILED_TOTAL';

class NoopMetricsSink implements EventConsumerMetricsSink {
  public increment(): void {
    // no-op
  }

  public gauge(): void {
    // no-op
  }
}

class ConsoleEventConsumerLogger implements EventConsumerLogger {
  public info(message: string, meta?: Record<string, unknown>): void {
    if (meta) {
      console.info(message, meta);
      return;
    }

    console.info(message);
  }

  public warn(message: string, meta?: Record<string, unknown>): void {
    if (meta) {
      console.warn(message, meta);
      return;
    }

    console.warn(message);
  }

  public error(message: string, meta?: Record<string, unknown>): void {
    if (meta) {
      console.error(message, meta);
      return;
    }

    console.error(message);
  }
}

interface InMemoryIdempotencyState {
  state: 'processing' | 'completed' | 'dead-lettered';
  expiresAt: number;
}

export class InMemoryConsumerIdempotencyStore
  implements ConsumerIdempotencyStore
{
  private readonly states = new Map<string, InMemoryIdempotencyState>();

  public async begin(
    key: string,
    ttlMs: number,
  ): Promise<'acquired' | 'duplicate'> {
    const now = Date.now();
    const current = this.states.get(key);

    if (current && current.expiresAt > now) {
      return 'duplicate';
    }

    this.states.set(key, {
      state: 'processing',
      expiresAt: now + ttlMs,
    });

    return 'acquired';
  }

  public async complete(
    key: string,
    disposition: IdempotencyDisposition,
  ): Promise<void> {
    this.states.set(key, {
      state: disposition,
      expiresAt: Number.MAX_SAFE_INTEGER,
    });
  }

  public async release(key: string): Promise<void> {
    const current = this.states.get(key);

    if (!current) {
      return;
    }

    if (current.state === 'processing') {
      this.states.delete(key);
    }
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeTimestamp(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'number') {
    return new Date(value).toISOString();
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  return new Date().toISOString();
}

function normalizeKey(value: unknown): string | null {
  if (Buffer.isBuffer(value)) {
    const asString = value.toString('utf8').trim();
    return asString.length > 0 ? asString : null;
  }

  return normalizeString(value);
}

function normalizeHeaders(headers?: EventHeaders): Record<string, string> {
  const normalized: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers ?? {})) {
    if (typeof value === 'string') {
      normalized[key] = value;
      continue;
    }

    if (Buffer.isBuffer(value)) {
      normalized[key] = value.toString('utf8');
    }
  }

  return normalized;
}

function safeErrorName(error: unknown): string {
  return error instanceof Error ? error.name : 'UnknownError';
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'Unknown error';
}

function safeErrorStack(error: unknown): string | undefined {
  return error instanceof Error ? error.stack : undefined;
}

function extractEventId(payload: unknown): string | null {
  if (!isRecord(payload)) {
    return null;
  }

  const candidateKeys = ['eventId', 'id', 'messageId'];

  for (const key of candidateKeys) {
    const value = normalizeString(payload[key]);
    if (value) {
      return value;
    }
  }

  return null;
}

function parseMessageValue(value: unknown): unknown {
  if (Buffer.isBuffer(value)) {
    const raw = value.toString('utf8').trim();
    if (raw.length === 0) {
      return null;
    }

    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return raw;
    }
  }

  if (typeof value === 'string') {
    const raw = value.trim();
    if (raw.length === 0) {
      return null;
    }

    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return raw;
    }
  }

  return value;
}

export class EventConsumer {
  private readonly topicsByName: Map<string, TopicConfig>;
  private readonly source: EventSource;
  private readonly metrics: EventConsumerMetricsSink;
  private readonly logger: EventConsumerLogger;
  private readonly deadLetterQueue: DeadLetterQueue;
  private readonly idempotencyStore: ConsumerIdempotencyStore;
  private readonly consumerGroupId: string;
  private readonly lagMetricIntervalMs: number;
  private readonly idempotencyTtlMs: number;
  private lagMetricTimer: ReturnType<typeof setInterval> | null = null;
  private started = false;

  constructor(private readonly options: EventConsumerOptions) {
    this.topicsByName = new Map(
      options.topics.map((topicConfig) => [topicConfig.topic, topicConfig]),
    );
    this.source = options.source;
    this.deadLetterQueue = options.deadLetterQueue;
    this.idempotencyStore = options.idempotencyStore;
    this.consumerGroupId = options.consumerGroupId;
    this.metrics = options.metrics ?? new NoopMetricsSink();
    this.logger = options.logger ?? new ConsoleEventConsumerLogger();
    this.lagMetricIntervalMs =
      options.lagMetricIntervalMs ?? DEFAULT_LAG_METRIC_INTERVAL_MS;
    this.idempotencyTtlMs =
      options.idempotencyTtlMs ?? DEFAULT_IDEMPOTENCY_TTL_MS;
  }

  public async start(): Promise<void> {
    if (this.started) {
      return;
    }

    const topics = Array.from(this.topicsByName.keys());

    if (topics.length === 0) {
      throw new Error('EventConsumer requires at least one topic configuration');
    }

    await this.source.connect();
    await this.source.subscribe(topics);
    this.startLagMetricsEmitter();

    this.started = true;

    this.logger.info('[event-consumer] started', {
      consumerGroupId: this.consumerGroupId,
      topics,
    });

    await this.source.run(async (message) => {
      await this.consume(message);
    });
  }

  public async stop(): Promise<void> {
    if (!this.started) {
      return;
    }

    if (this.lagMetricTimer) {
      clearInterval(this.lagMetricTimer);
      this.lagMetricTimer = null;
    }

    await this.source.disconnect();
    this.started = false;

    this.logger.info('[event-consumer] stopped', {
      consumerGroupId: this.consumerGroupId,
    });
  }

  private startLagMetricsEmitter(): void {
    if (this.lagMetricTimer) {
      clearInterval(this.lagMetricTimer);
    }

    const emit = async () => {
      const topics = Array.from(this.topicsByName.keys());

      await Promise.all(
        topics.map(async (topic) => {
          try {
            const lag = await this.source.getLag(topic, this.consumerGroupId);

            if (typeof lag === 'number' && Number.isFinite(lag)) {
              await this.metrics.gauge(METRIC_CONSUMER_LAG, lag, {
                consumer_group_id: this.consumerGroupId,
                topic,
              });
            }
          } catch (error) {
            this.logger.warn('[event-consumer] failed to emit lag metric', {
              consumerGroupId: this.consumerGroupId,
              topic,
              errorName: safeErrorName(error),
              errorMessage: safeErrorMessage(error),
            });
          }
        }),
      );
    };

    void emit();
    this.lagMetricTimer = setInterval(() => {
      void emit();
    }, this.lagMetricIntervalMs);
  }

  private async consume(message: EventSourceMessage): Promise<void> {
    const topicConfig = this.topicsByName.get(message.topic);

    if (!topicConfig) {
      const error = new Error(`No topic configuration found for topic "${message.topic}"`);
      await this.handleFailure(message, 'topic_configuration_missing', error, 'unconfigured-topic');
      await this.safeAck(message);
      return;
    }

    let parsedPayload: unknown;

    try {
      parsedPayload = parseMessageValue(message.value);
    } catch (error) {
      await this.handleFailure(message, 'payload_parse_failed', error, 'payload-parse-failed');
      await this.safeAck(message);
      return;
    }

    let validatedPayload: unknown;

    try {
      validatedPayload = this.validateEventSchema(topicConfig, parsedPayload);
    } catch (error) {
      await this.metrics.increment(METRIC_VALIDATION_FAILED, 1, {
        consumer_group_id: this.consumerGroupId,
        topic: message.topic,
      });

      await this.handleFailure(message, 'schema_validation_failed', error, 'schema-validation-failed');
      await this.safeAck(message);
      return;
    }

    const idempotencyKey = this.resolveIdempotencyKey(
      topicConfig,
      validatedPayload,
      message,
    );

    const acquireResult = await this.idempotencyStore.begin(
      idempotencyKey,
      this.idempotencyTtlMs,
    );

    if (acquireResult === 'duplicate') {
      await this.metrics.increment(METRIC_DUPLICATE, 1, {
        consumer_group_id: this.consumerGroupId,
        topic: message.topic,
      });

      this.logger.info('[event-consumer] duplicate skipped', {
        consumerGroupId: this.consumerGroupId,
        topic: message.topic,
        partition: message.partition,
        offset: message.offset,
        idempotencyKey,
      });

      await this.safeAck(message);
      return;
    }

    const context: EventConsumerContext<unknown> = {
      topic: message.topic,
      consumerGroupId: this.consumerGroupId,
      partition: message.partition,
      offset: message.offset,
      key: normalizeKey(message.key),
      headers: normalizeHeaders(message.headers),
      timestamp: normalizeTimestamp(message.timestamp),
      idempotencyKey,
      rawMessage: message,
      payload: validatedPayload,
      heartbeat: async () => {
        if (message.heartbeat) {
          await message.heartbeat();
        }
      },
    };

    try {
      await context.heartbeat();
      await topicConfig.handler(validatedPayload, context);
      await this.idempotencyStore.complete(idempotencyKey, 'completed', {
        topic: message.topic,
        offset: message.offset,
      });

      await this.metrics.increment(METRIC_CONSUMED, 1, {
        consumer_group_id: this.consumerGroupId,
        topic: message.topic,
      });

      await this.safeAck(message);
    } catch (error) {
      await this.metrics.increment(METRIC_FAILED, 1, {
        consumer_group_id: this.consumerGroupId,
        topic: message.topic,
      });

      await this.handleFailure(message, 'handler_failed', error, idempotencyKey);
      await this.idempotencyStore.complete(idempotencyKey, 'dead-lettered', {
        topic: message.topic,
        offset: message.offset,
      });
      await this.safeAck(message);
    }
  }

  private validateEventSchema<TPayload>(
    topicConfig: TopicConfig<TPayload>,
    payload: unknown,
  ): TPayload {
    const { error, value } = topicConfig.schemaValidator.validate(payload, {
      abortEarly: false,
      convert: true,
      stripUnknown: false,
      presence: 'required',
    });

    if (error) {
      throw error;
    }

    return value as TPayload;
  }

  private resolveIdempotencyKey<TPayload>(
    topicConfig: TopicConfig<TPayload>,
    payload: TPayload,
    message: EventSourceMessage,
  ): string {
    const configured = topicConfig.resolveIdempotencyKey?.(payload, message);
    if (configured && configured.trim().length > 0) {
      return configured.trim();
    }

    const headerEventId = normalizeHeaders(message.headers)['x-event-id'];
    if (headerEventId && headerEventId.trim().length > 0) {
      return headerEventId.trim();
    }

    const payloadEventId = extractEventId(payload);
    if (payloadEventId) {
      return payloadEventId;
    }

    return [
      this.consumerGroupId,
      message.topic,
      String(message.partition),
      String(message.offset),
    ].join(':');
  }

  private async handleFailure(
    message: EventSourceMessage,
    reason: string,
    error: unknown,
    idempotencyKey: string,
  ): Promise<void> {
    const dlqMessage: DeadLetterQueueMessage = {
      consumerGroupId: this.consumerGroupId,
      topic: message.topic,
      partition: message.partition,
      offset: message.offset,
      key: normalizeKey(message.key),
      payload: parseMessageValue(message.value),
      headers: normalizeHeaders(message.headers),
      timestamp: normalizeTimestamp(message.timestamp),
      idempotencyKey,
      reason,
      errorName: safeErrorName(error),
      errorMessage: safeErrorMessage(error),
      errorStack: safeErrorStack(error),
      occurredAt: new Date().toISOString(),
    };

    await this.deadLetterQueue.enqueue(dlqMessage);

    await this.metrics.increment(METRIC_DLQ, 1, {
      consumer_group_id: this.consumerGroupId,
      topic: message.topic,
      reason,
    });

    this.logger.error('[event-consumer] message sent to dead letter queue', {
      consumerGroupId: this.consumerGroupId,
      topic: message.topic,
      partition: message.partition,
      offset: message.offset,
      idempotencyKey,
      reason,
      errorName: dlqMessage.errorName,
      errorMessage: dlqMessage.errorMessage,
    });
  }

  private async safeAck(message: EventSourceMessage): Promise<void> {
    if (message.ack) {
      await message.ack();
    }
  }
}

export class InlineEventSource implements EventSource {
  private readonly subscriptions = new Set<string>();
  private readonly queue: EventSourceMessage[] = [];
  private connected = false;

  public async connect(): Promise<void> {
    this.connected = true;
  }

  public async disconnect(): Promise<void> {
    this.connected = false;
    this.queue.length = 0;
  }

  public async subscribe(topics: string[]): Promise<void> {
    topics.forEach((topic) => this.subscriptions.add(topic));
  }

  public async publish(message: EventSourceMessage): Promise<void> {
    if (!this.connected) {
      throw new Error('InlineEventSource is not connected');
    }

    if (!this.subscriptions.has(message.topic)) {
      return;
    }

    this.queue.push(message);
  }

  public async run(
    handler: (message: EventSourceMessage) => Promise<void>,
  ): Promise<void> {
    while (this.queue.length > 0) {
      const message = this.queue.shift();
      if (!message) {
        continue;
      }

      await handler(message);
    }
  }

  public async getLag(): Promise<number> {
    return this.queue.length;
  }
}