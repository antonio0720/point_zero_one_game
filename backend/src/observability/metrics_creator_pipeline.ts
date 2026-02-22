/**
 * Metrics Creator Pipeline
 */

import { Metric, MetricType } from './metric';
import { DatabaseClient } from '../database/database_client';

export class MetricsCreatorPipeline {
  private db: DatabaseClient;

  constructor() {
    this.db = new DatabaseClient();
  }

  public async createStageLatencies(stageId: number): Promise<void> {
    const stageLatencyMetric = new Metric(MetricType.STAGE_LATENCY, stageId);
    await this.db.saveMetric(stageLatencyMetric);
  }

  public async createFailRates(gameId: number, stageId: number): Promise<void> {
    const failRateMetric = new Metric(MetricType.FAIL_RATE, gameId, stageId);
    await this.db.saveMetric(failRateMetric);
  }

  public async createFixlistCycles(gameId: number): Promise<void> {
    const fixlistCycleMetric = new Metric(MetricType.FIXLIST_CYCLE, gameId);
    await this.db.saveMetric(fixlistCycleMetric);
  }

  public async createPublishRates(gameId: number): Promise<void> {
    const publishRateMetric = new Metric(MetricType.PUBLISH_RATE, gameId);
    await this.db.saveMetric(publishRateMetric);
  }

  public async createSpamThrottles(gameId: number, spammerId: number): Promise<void> {
    const spamThrottleMetric = new Metric(MetricType.SPAM_THROTTLE, gameId, spammerId);
    await this.db.saveMetric(spamThrottleMetric);
  }

  public async createModerationActions(gameId: number, moderatorId: number): Promise<void> {
    const moderationActionMetric = new Metric(MetricType.MODERATION_ACTION, gameId, moderatorId);
    await this.db.saveMetric(moderationActionMetric);
  }
}

/**
 * Database Client for Metrics
 */

import { Db } from 'mongodb';

export class DatabaseClient {
  private db: Db;

  constructor(private url: string) {}

  public async connect(): Promise<void> {
    // Connect to the database using MongoDB driver
  }

  public async saveMetric(metric: Metric): Promise<void> {
    // Save the metric in the database
  }
}
```

Please note that this is a simplified example and does not include actual database connection logic or error handling. Also, the `Metric` class and its type definition are assumed to be defined elsewhere in your project.

Regarding SQL, YAML/JSON/Terraform, and Bash files, they would require specific data structures and syntaxes that are not provided in the given spec. However, I can provide examples for those if needed.
