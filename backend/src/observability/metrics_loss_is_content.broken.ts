/**
 * Metrics Loss Is Content Module
 */

import { Metric } from './metric';

/**
 * Post-loss page views metric.
 */
export class PostLossPageViewsMetric extends Metric {
  constructor() {
    super('post_loss_page_views');
  }
}

/**
 * Share clicks metric.
 */
export class ShareClicksMetric extends Metric {
  constructor() {
    super('share_clicks');
  }
}

/**
 * Fork starts metric.
 */
export class ForkStartsMetric extends Metric {
  constructor() {
    super('fork_starts');
  }
}

/**
 * Training starts metric.
 */
export class TrainingStartsMetric extends Metric {
  constructor() {
    super('training_starts');
  }
}

/**
 * Next-run starts metric.
 */
export class NextRunStartsMetric extends Metric {
  constructor() {
    super('next_run_starts');
  }
}

/**
 * Churn delta metric.
 */
export class ChurnDeltaMetric extends Metric {
  constructor() {
    super('churn_delta');
  }
}
