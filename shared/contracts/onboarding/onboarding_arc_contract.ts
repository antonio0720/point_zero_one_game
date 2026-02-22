Here is the TypeScript file `shared/contracts/onboarding/onboarding_arc_contract.ts` as per your specifications:

```typescript
/**
 * Onboarding Arc Contract
 */

enum OnboardingStage {
  RUN1,
  RUN2,
  RUN3,
  COMPLETE
}

interface OnboardingProgress {
  stage: OnboardingStage;
  completedAt?: Date;
}

/**
 * Evaluates whether the user has progressed to the specified stage.
 * @param userId - The unique identifier of the user.
 * @param stage - The target onboarding stage.
 */
async function gate(userId: string, stage: OnboardingStage): Promise<boolean> {
  // Implement server-side gate evaluation logic here.
}

/**
 * Saves or updates the onboarding progress for a user.
 * @param userId - The unique identifier of the user.
 * @param progress - The new onboarding progress.
 */
async function saveProgress(userId: string, progress: OnboardingProgress): Promise<void> {
  // Implement saving or updating onboarding progress logic here.
}

export { OnboardingStage, OnboardingProgress, gate, saveProgress };
```

Please note that the implementation details for `gate` and `saveProgress` functions are not provided in this example. You would need to implement these functions based on your specific database schema, game engine, and replay requirements.

Regarding SQL, Bash, YAML/JSON, and Terraform files, they are not included in the TypeScript file as per your request. However, I can help you create those files if needed, following the same strict guidelines.
