Here is the TypeScript file `shared/contracts/partners/cohorts_contract.ts` based on your specifications:

```typescript
/**
 * Cohort Contract Interface
 */
export interface CohortContract {
  id: number;
  name: string;
  deptId: number;
  locationId: number;
  benefitClassId: number;
  branchId: number;
  seasonCalendarId: number;
  eventScheduleId: number;
}

/**
 * Assignment Rules Interface
 */
export interface AssignmentRules {
  deptId: number;
  locationId: number;
  benefitClassId: number;
  branchId: number;
}

/**
 * Cohort Interface
 */
export interface Cohort {
  id: number;
  name: string;
  assignmentRules: AssignmentRules;
  seasonCalendar: SeasonCalendar;
  eventSchedule: EventSchedule;
}

/**
 * Season Calendar Interface
 */
export interface SeasonCalendar {
  id: number;
  startDate: Date;
  endDate: Date;
}

/**
 * Event Schedule Interface
 */
export interface EventSchedule {
  id: number;
  name: string;
  date: Date;
}
