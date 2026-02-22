/**
 * Metrics Integrity Module
 */

import { Metric } from './metric';

/**
 * Represents a specific metric type with its corresponding event name and description.
 */
export enum MetricType {
  PageViews = 'page_views',
  CtaClicks = 'cta_clicks',
  VerificationLookups = 'verification_lookups',
  AppealSubmits = 'appeal_submits',
  QuarantineViews = 'quarantine_views',
  TransparencyFetches = 'transparency_fetches'
}

/**
 * Metrics Integrity class for tracking and verifying various game events.
 */
export class MetricsIntegrity {
  private metrics: Map<MetricType, Metric>;

  constructor() {
    this.metrics = new Map();
    this.initializeMetrics();
  }

  /**
   * Initializes all metrics with zero values.
   */
  private initializeMetrics(): void {
    for (const metricType of Object.values(MetricType)) {
      this.metrics.set(metricType, new Metric(metricType));
    }
  }

  /**
   * Increment the given metric by 1.
   * @param metricType The type of the metric to increment.
   */
  public incrementMetric(metricType: MetricType): void {
    const metric = this.metrics.get(metricType);
    if (metric) {
      metric.increment();
    }
  }

  /**
   * Get the current value of a specific metric.
   * @param metricType The type of the metric to get the value for.
   */
  public getMetricValue(metricType: MetricType): number {
    const metric = this.metrics.get(metricType);
    return metric ? metric.value : 0;
  }
}

/**
 * Metric class for tracking and managing a single metric value.
 */
class Metric {
  private readonly type: MetricType;
  private value: number = 0;

  constructor(type: MetricType) {
    this.type = type;
  }

  /**
   * Increment the current value of the metric by 1.
   */
  public increment(): void {
    this.value++;
  }

  /**
   * Get the current value of the metric.
   */
  public get value(): number {
    return this.value;
  }
}
