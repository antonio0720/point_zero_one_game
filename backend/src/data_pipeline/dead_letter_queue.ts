/**
 * Dead Letter Queue Contracts
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/src/data_pipeline/dead_letter_queue.ts
 *
 * Transport-agnostic DLQ contracts for the data pipeline.
 * This file is intentionally small and dependency-light so the
 * EventConsumer can remain aligned with the current backend stack.
 */

export interface DeadLetterQueueMessage {
  consumerGroupId: string;
  topic: string;
  partition: number;
  offset: string;
  key: string | null;
  payload: unknown;
  headers: Record<string, string>;
  timestamp: string;
  idempotencyKey: string;
  reason: string;
  errorName: string;
  errorMessage: string;
  errorStack?: string;
  occurredAt: string;
}

export interface DeadLetterQueue {
  enqueue(message: DeadLetterQueueMessage): Promise<void>;
}

export class InMemoryDeadLetterQueue implements DeadLetterQueue {
  private readonly entries: DeadLetterQueueMessage[] = [];

  public async enqueue(message: DeadLetterQueueMessage): Promise<void> {
    this.entries.push({ ...message });
  }

  public getEntries(): DeadLetterQueueMessage[] {
    return this.entries.map((entry) => ({ ...entry }));
  }

  public clear(): void {
    this.entries.length = 0;
  }
}

export class LoggingDeadLetterQueue implements DeadLetterQueue {
  public async enqueue(message: DeadLetterQueueMessage): Promise<void> {
    console.error('[data-pipeline][dlq]', {
      consumerGroupId: message.consumerGroupId,
      topic: message.topic,
      partition: message.partition,
      offset: message.offset,
      idempotencyKey: message.idempotencyKey,
      reason: message.reason,
      errorName: message.errorName,
      errorMessage: message.errorMessage,
      occurredAt: message.occurredAt,
    });
  }
}