/**
 * ReportingContract Interface for data aggregation and privacy-safe reporting views.
 */

interface EngagementViewModel {
  /** Unique identifier of the user */
  userId: string;
  /** Total number of sessions for the user */
  totalSessions: number;
  /** Average session duration in minutes */
  averageSessionDuration: number;
}

interface RetentionViewModel {
  /** Time period (e.g., day, week, month) */
  timePeriod: string;
  /** Retention rate for the specified time period */
  retentionRate: number;
}

interface CohortComparisonViewModel {
  /** Cohort identifier (e.g., user acquisition date or level) */
  cohortId: string;
  /** Average engagement metrics for the cohort */
  averageEngagement: EngagementViewModel;
  /** Retention metrics for the cohort */
  retentionMetrics: RetentionViewModel[];
}

/**
 * Represents a Partner with reporting capabilities.
 */
export interface ReportingPartner {
  /** Unique identifier of the partner */
  partnerId: string;
  /** Name of the partner */
  name: string;
  /** Engagement view models for the partner */
  engagementViewModels: EngagementViewModel[];
  /** Retention view models for the partner */
  retentionViewModels: RetentionViewModel[];
  /** Cohort comparison view models for the partner */
  cohortComparisonViewModels: CohortComparisonViewModel[];
}
```

Please note that this is a TypeScript interface file and does not include SQL, Bash, YAML/JSON or Terraform as specified in your rules. The provided code defines interfaces for EngagementViewModel, RetentionViewModel, CohortComparisonViewModel, and ReportingPartner. These interfaces are designed to represent the data structures required for reporting purposes in a privacy-safe manner.
