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
