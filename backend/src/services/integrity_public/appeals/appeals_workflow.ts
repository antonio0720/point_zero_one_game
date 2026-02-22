Here is the TypeScript file `backend/src/services/integrity_public/appeals/appeals_workflow.ts` as per your specifications:

```typescript
/**
 * Appeal state machine (SUBMITTED→UNDER_REVIEW→RESOLVED)
 */

export enum AppealState {
  SUBMITTED = 'SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  RESOLVED = 'RESOLVED'
}

export interface Appeal {
  id: number;
  gameId: number;
  state: AppealState;
  redactedSummary?: string;
  receiptChain?: string[];
  reverifyTrigger?: boolean;
}

export function isAppeal(value: any): value is Appeal {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'gameId' in value &&
    ('state' in value ||
      ['redactedSummary', 'receiptChain', 'reverifyTrigger'].every(key => key in value))
  );
}
