/**
 * FacilitatorGuide schema (objective, watch_fors, debrief_questions, next_run_recommendation)
 */

export interface FacilitatorGuide {
  objective: string;
  watch_fors: WatchFor[];
  debrief_questions: DebriefQuestion[];
  next_run_recommendation?: NextRunRecommendation;
}

export interface WatchFor {
  id: number;
  description: string;
}

export interface DebriefQuestion {
  id: number;
  question: string;
}

export interface NextRunRecommendation {
  objective: string;
  watch_fors: WatchFor[];
}
