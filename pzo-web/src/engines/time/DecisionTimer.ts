// pzo-web/src/store/engineStore.ts
import { configureStore, createAction, createReducer } from '@reduxjs/toolkit';

interface DecisionTimerState {
  seconds: number;
}

const initialState: DecisionTimerState = {
  seconds: 10,
};

export const updateDecisionTimer = createAction('time/updateDecisionTimer', (seconds: number) => ({
  payload: { seconds },
}));

const decisionTimerReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(updateDecisionTimer, (state, action) => {
      state.seconds = action.payload.seconds;
    });
});

const store = configureStore({
  reducer: {
    decisionTimer: decisionTimerReducer,
  },
});

export default store;
