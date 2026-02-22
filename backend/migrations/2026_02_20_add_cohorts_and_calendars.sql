-- Point Zero One Digital - Backend Migrations - 2026_02_20_add_cohorts_and_calendars.sql

CREATE TABLE IF NOT EXISTS partner_cohorts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONES DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cohort_assignment_rules (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    rule JSONB NOT NULL,
    partner_cohort_id INTEGER REFERENCES partner_cohorts(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONES DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS season_calendars (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONES DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS event_calendars (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    start_time TIME WITH TIME ZONE NOT NULL,
    end_time TIME WITH TIME ZONE NOT NULL,
    season_calendar_id INTEGER REFERENCES season_calendars(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONES DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cohort_metrics_snapshots (
    id SERIAL PRIMARY KEY,
    cohort_id INTEGER REFERENCES partner_cohorts(id),
    event_calendar_id INTEGER REFERENCES event_calendars(id),
    metric_name VARCHAR(255) NOT NULL,
    value DECIMAL(10, 2) NOT NULL,
    snapshot_time TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONES DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS partner_cohorts_name_idx ON partner_cohorts(name);
CREATE INDEX IF NOT EXISTS cohort_assignment_rules_partner_cohort_id_idx ON cohort_assignment_rules(partner_cohort_id);
CREATE INDEX IF NOT EXISTS season_calendars_name_start_date_end_date_idx ON season_calendars(name, start_date, end_date);
CREATE INDEX IF NOT EXISTS event_calendars_season_calendar_id_start_time_end_time_idx ON event_calendars(season_calendar_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS cohort_metrics_snapshots_cohort_id_event_calendar_id_metric_name_snapshot_time_idx ON cohort_metrics_snapshots(cohort_id, event_calendar_id, metric_name, snapshot_time);
```

Regarding TypeScript and JSDoc:

```typescript
// partnerCohorts.ts
export interface PartnerCohort {
    id: number;
    name: string;
    description?: string;
    createdAt: Date;
    updatedAt: Date;
}

// cohortAssignmentRules.ts
export interface CohortAssignmentRule {
    id: number;
    name: string;
    rule: any; // This is a temporary solution, replace 'any' with the appropriate type when possible
    partnerCohortId: number;
    createdAt: Date;
    updatedAt: Date;
}

// seasonCalendars.ts
export interface SeasonCalendar {
    id: number;
    name: string;
    startDate: Date;
    endDate: Date;
    createdAt: Date;
    updatedAt: Date;
}

// eventCalendars.ts
export interface EventCalendar {
    id: number;
    name: string;
    startTime: Date;
    endTime: Date;
    seasonCalendarId: number;
    createdAt: Date;
    updatedAt: Date;
}

// cohortMetricsSnapshots.ts
export interface CohortMetricsSnapshot {
    id: number;
    cohortId: number;
    eventCalendarId: number;
    metricName: string;
    value: number;
    snapshotTime: Date;
    createdAt: Date;
    updatedAt: Date;
}
