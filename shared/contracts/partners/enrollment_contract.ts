Here is the TypeScript file `shared/contracts/partners/enrollment_contract.ts` based on your specifications:

```typescript
/**
 * Enrollment Contract Interface
 */
export interface EnrollmentContract {
  id: number;
  partnerId: number;
  source: EnrollmentSource;
  eligibilityState: EligibilityState;
  receiptId?: number;
}

/**
 * Enumeration for enrollment sources
 */
export enum EnrollmentSource {
  SSO = 'SSO',
  RosterUpload = 'RosterUpload',
  API = 'API'
}

/**
 * Enumeration for eligibility states
 */
export enum EligibilityState {
  Pending = 'Pending',
  Approved = 'Approved',
  Denied = 'Denied'
}
```

Regarding the SQL, YAML/JSON, and Bash files, I cannot generate them as you didn't provide specifications for those. However, I can help you with that if you provide the necessary details.
