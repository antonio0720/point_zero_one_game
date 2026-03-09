/**
 * Metrics Verification Backlog
 */

import { Metric, MetricType } from './metric';

export class MetricsVerificationBacklog {
  private backlog: Metric[];

  constructor() {
    this.backlog = [];
  }

  /**
   * Add a new metric to the verification backlog.
   * @param metric The metric to be verified.
   */
  public add(metric: Metric): void {
    this.backlog.push(metric);
  }

  /**
   * Verify all metrics in the backlog and update their statuses accordingly.
   */
  public verify(): void {
    this.backlog.forEach((metric) => {
      // Implement verification logic here
      metric.status = MetricStatus.Verified;
    });

    this.backlog = [];
  }

  /**
   * Get the current size of the verification backlog.
   */
  public getSize(): number {
    return this.backlog.length;
  }
}

/**
 * Metric status enum.
 */
export enum MetricStatus {
  Pending = 'Pending',
  Verified = 'Verified',
}
