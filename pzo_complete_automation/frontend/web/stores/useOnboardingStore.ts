/**
 * useOnboardingStore
 * pzo_complete_automation/frontend/web/stores/useOnboardingStore.ts
 *
 * Zustand store tracking onboarding step progress.
 * incrementCompletedStep() is the contract required by PracticeSandbox8.
 */

import { create } from 'zustand';

interface OnboardingState {
  completedSteps:       number;
  currentStep:          number;
  incrementCompletedStep: () => void;
  setCurrentStep:       (step: number) => void;
  reset:                () => void;
}

const useOnboardingStore = create<OnboardingState>((set) => ({
  completedSteps: 0,
  currentStep:    0,

  incrementCompletedStep: () =>
    set(state => ({
      completedSteps: state.completedSteps + 1,
      currentStep:    state.currentStep + 1,
    })),

  setCurrentStep: (step: number) => set({ currentStep: step }),

  reset: () => set({ completedSteps: 0, currentStep: 0 }),
}));

export default useOnboardingStore;
