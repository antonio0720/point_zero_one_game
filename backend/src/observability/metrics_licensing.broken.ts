/**
 * Metrics Licensing Module
 */

import { Metric } from './metric';

/**
 * Cohort Enrollment Metric
 */
export class CohortEnrollmentMetric extends Metric {
  constructor(public cohortId: string, public enrolledCount: number) {
    super('CohortEnrollment', 'Number of users enrolled in a specific cohort');
  }
}

/**
 * Weekly Active Rate Metric
 */
export class WeeklyActiveRateMetric extends Metric {
  constructor(public cohortId: string, public activeCount: number, public totalUsers: number) {
    super('WeeklyActiveRate', 'Percentage of users actively participating in a specific cohort');
  }
}

/**
 * Benchmark Completion Metric
 */
export class BenchmarkCompletionMetric extends Metric {
  constructor(public benchmarkId: string, public completedCount: number, public totalAttempts: number) {
    super('BenchmarkCompletion', 'Number of successful benchmark completions');
  }
}

/**
 * Report Generation Success Metric
 */
export class ReportGenerationSuccessMetric extends Metric {
  constructor(public reportId: string, public success: boolean) {
    super('ReportGenerationSuccess', 'Whether a specific report was generated successfully');
  }
}

/**
 * Export Volume Metric
 */
export class ExportVolumeMetric extends Metric {
  constructor(public programTemplateId: string, public exportedBytes: number) {
    super('ExportVolume', 'Amount of data exported for a specific program template');
  }
}

/**
 * Retention by Program Template Metric
 */
export class RetentionByProgramTemplateMetric extends Metric {
  constructor(public programTemplateId: string, public retentionRate: number) {
    super('RetentionByProgramTemplate', 'Retention rate for a specific program template');
  }
}
