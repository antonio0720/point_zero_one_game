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
