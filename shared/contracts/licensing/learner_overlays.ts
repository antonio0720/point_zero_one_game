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
