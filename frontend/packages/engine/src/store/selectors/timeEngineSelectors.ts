// pzo-web/src/store/selectors/timeEngineSelectors.ts
import type { EngineStoreState } from '../engineStore';

export const getTimeEngineState = (state: EngineStoreState) => state.time;

export const getDecisionCountdown = (state: EngineStoreState) =>
  state.time?.ticksRemaining ?? 0;

export const getActiveWindows = (state: EngineStoreState) =>
  state.time?.activeDecisionWindows ?? [];
