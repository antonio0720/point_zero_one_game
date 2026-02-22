/**
 * Metrics Run Explorer
 */

import { Metric, MetricType } from './metrics';

/**
 * Explorer QPS metric
 */
export class ExplorerQpsMetric extends Metric {
  constructor(name: string) {
    super(name, MetricType.GAUGE);
  }
}

/**
 * Cache hit rate metric
 */
export class CacheHitRateMetric extends Metric {
  constructor(name: string) {
    super(name, MetricType.GAUGE);
  }
}

/**
 * P95 latency metric
 */
export class P95LatencyMetric extends Metric {
  constructor(name: string) {
    super(name, MetricType.HISTOGRAM);
  }
}

/**
 * Verification status mix metric
 */
export class VerificationStatusMixMetric extends Metric {
  constructor(name: string) {
    super(name, MetricType.GAUGE);
  }
}

/**
 * Quarantined rate metric
 */
export class QuarantinedRateMetric extends Metric {
  constructor(name: string) {
    super(name, MetricType.GAUGE);
  }
}
