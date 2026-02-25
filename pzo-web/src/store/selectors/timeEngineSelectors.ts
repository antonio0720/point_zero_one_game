// pzo-web/src/store/selectors/timeEngineSelectors.ts
import { createSelector } from 'reselect';
import type { RootState } from 'pzo-web/src/store';

// Extract only the necessary parts of the time engine state
export const getTimeEngineState = (state: RootState) => state.timeEngine;

// Selector for decision countdown (optimized for minimal subscription)
export const getDecisionCountdown = createSelector(
  getTimeEngineState,
  (timeEngine) => timeEngine.decisionCountdown
);

// Selector for active windows (if needed for multiple windows)
export const getActiveWindows = createSelector(
  getTimeEngineState,
  (timeEngine) => timeEngine.activeWindows
);
