Here is the TypeScript file `shared/contracts/licensing/learner_overlays.ts` as per your specifications:

```typescript
/**
 * Learner Overlay Contract Interface
 */
export interface LearnerOverlay {
  programId: number;
  cohortId: number;
  activePack: string;
  nextAssignment?: string;
  benchmarkStatus?: string;
  debriefEnabled?: boolean;
}
