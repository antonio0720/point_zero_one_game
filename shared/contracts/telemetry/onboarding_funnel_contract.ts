/**
 * Onboarding Funnel Contract
 */

export interface OnboardingFunnelEvent {
  funnel_id: number;
  event_type: string;
  run_number: number;
  time_to_first_death?: number | null;
  survival_time?: number | null;
  account_created?: boolean | null;
}

export interface OnboardingFunnel {
  id: number;
  user_id: number;
  funnel_id: number;
  run1_event?: OnboardingFunnelEvent;
  run2_event?: OnboardingFunnelEvent;
  run3_event?: OnboardingFunnelEvent;
}

export function createOnboardingFunnel(userId: number): OnboardingFunnel {
  return { id: 0, user_id: userId, funnel_id: 0 };
}

export function addRun1Event(funnel: OnboardingFunnel, event: OnboardingFunnelEvent) {
  funnel.run1_event = event;
}

export function addRun2Event(funnel: OnboardingFunnel, event: OnboardingFunnelEvent) {
  funnel.run2_event = event;
}

export function addRun3Event(funnel: OnboardingFunnel, event: OnboardingFunnelEvent) {
  funnel.run3_event = event;
}
