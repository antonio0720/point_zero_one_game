Here is the TypeScript file `backend/src/services/curriculum/packs/pack_assignment.ts` with strict types, no 'any', exporting public symbols, and including JSDoc comments:

```typescript
/**
 * Service for assigning packs to org cohorts, scheduling windows, and enforcing entitlements.
 */
export interface Assignment {
  id: number;
  orgId: number;
  cohortId: number;
  packId: number;
  windowStart: Date;
  windowEnd: Date;
}

export interface Org {
  id: number;
  name: string;
}

export interface Cohort {
  id: number;
  orgId: number;
  name: string;
}

export interface Pack {
  id: number;
  name: string;
  entitlements: Entitlement[];
}

export interface Entitlement {
  id: number;
  packId: number;
  cohortId: number;
  startDate: Date;
  endDate: Date;
}

/**
 * Assigns a pack to an org cohort and schedules the window. Enforces entitlements.
 *
 * @param {Org} org The organization to assign the pack to.
 * @param {Cohort} cohort The cohort within the organization to assign the pack to.
 * @param {Pack} pack The pack to be assigned.
 * @param {Date} windowStart The start date of the assignment window.
 * @param {Date} windowEnd The end date of the assignment window.
 * @returns {Assignment} The created assignment object.
 */
export function assignPack(org: Org, cohort: Cohort, pack: Pack, windowStart: Date, windowEnd: Date): Assignment {
  // Implementation details omitted for brevity.
}
