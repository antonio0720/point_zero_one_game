Here is the TypeScript file `shared/contracts/integrity/run_verification_response.ts` as per your specifications:

```typescript
/**
 * RunVerificationResponse contract
 */

export interface RunVerificationResponse {
  run_id: string;
  proof_hash: string;
  status: 'success' | 'failure';
  sealed_at: Date;
  verified_at?: Date;
  quarantined_at?: Date;
  high_level_reason_category?: string;
  pinned_episode_version?: string;
  pinned_ruleset_id?: string;
  seed_commit_hash?: string;
}
