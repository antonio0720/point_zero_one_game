/**
 * Batching service for telemetry data ingestion.
 */

import { BackoffStrategy, ExponentialBackoff } from './backoff';
import { TelemetryEvent } from '../telemetry/event';
import { DatabaseClient } from '../database';

/**
 * BatchWriter interface for telemetry data.
 */
export interface BatchWriter {
  write(events: ReadonlyArray<TelemetryEvent>): Promise<void>;
}

/**
 * ExponentialBackoffBatchWriter implements the BatchWriter interface using an exponential backoff strategy.
 */
export class ExponentialBackoffBatchWriter implements BatchWriter {
  private readonly client: DatabaseClient;
  private readonly backoffStrategy: BackoffStrategy;
  private readonly batchSize: number;

  constructor(client: DatabaseClient, backoffStrategy: BackoffStrategy = new ExponentialBackoff(), batchSize = 100) {
    this.client = client;
    this.backoffStrategy = backoffStrategy;
    this.batchSize = batchSize;
  }

  private async writeBatch(events: ReadonlyArray<TelemetryEvent>): Promise<void> {
    const sql = `
      INSERT INTO telemetry_events (event_id, game_id, timestamp, event_type, data)
      VALUES ${events.map((event) => `(${event.id}, ${event.gameId}, ${event.timestamp}, '${event.type}', ${JSON.stringify(event.data)})`).join(",\n")};
    `;

    try {
      await this.client.query(sql);
    } catch (error) {
      // Handle partial failure and no-stall defaults.
      if (events.length > this.batchSize) {
        throw error;
      }
    }
  }

  public async write(events: ReadonlyArray<TelemetryEvent>): Promise<void> {
    const batches = Array.from({ length: Math.ceil(events.length / this.batchSize) }, (_, index) => events.slice(index * this.batchSize, (index + 1) * this.batchSize));

    for (const batch of batches) {
      try {
        await this.writeBatch(batch);
        break;
      } catch (error) {
        await this.backoffStrategy.wait();
      }
    }
  }
}
