// backend/src/types/cohort_calendars.types.ts

export interface CohortAssignmentRuleRecord {
  id: number;
  cohortId: number;
  name: string;
  rule: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SeasonCalendarRecord {
  id: number;
  cohortId: number;
  name: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EventCalendarRecord {
  id: number;
  seasonCalendarId: number;
  name: string;
  startsAt: string;
  endsAt: string;
  eventKind: string;
  packId: number | null;
  benchmarkId: number | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CohortMetricSnapshotRecord {
  id: number;
  cohortId: number;
  eventCalendarId: number | null;
  metricName: string;
  metricValue: string;
  snapshotTime: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}