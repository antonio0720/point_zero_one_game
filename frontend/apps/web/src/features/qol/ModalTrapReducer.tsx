/**
 * Modal Trap Reducer for Point Zero One Digital's financial roguelike game.
 * Strict TypeScript, no 'any', export all public symbols, include JSDoc.
 */

import { createAction, handleActions } from 'redux-actions';
import produce from 'immer';

// Actions
export const SET_MODAL_TRAP = 'SET_MODAL_TRAP';
export const CLEAR_MODAL_TRAP = 'CLEAR_MODAL_TRAP';
export const UPDATE_ESCAPE_PATHS = 'UPDATE_ESCAPE_PATHS';
export const INCREMENT_TELEMETRY_COUNT = 'INCREMENT_TELEMETRY_COUNT';

// Action Creators
export const setModalTrap = createAction(SET_MODAL_TRAP, (modalTrap: ModalTrap) => ({ modalTrap }));
export const clearModalTrap = createAction(CLEAR_MODAL_TRAP);
export const updateEscapePaths = createAction(UPDATE_ESCAPE_PATHS, (escapePaths: EscapePath[]) => ({ escapePaths }));
export const incrementTelemetryCount = createAction(INCREMENT_TELEMETRY_COUNT);

// Initial State
export interface ModalTrap {
  id: number;
  isActive: boolean;
  timer?: number; // in seconds
}

export interface EscapePath {
  id: number;
  x: number;
  y: number;
}

export const initialState: ModalTrap = {
  id: 0,
  isActive: false,
};

// Reducer
const modalTrapReducer = handleActions(
  {
    [SET_MODAL_TRAP]: (state, action) => produce(state, (draft) => {
      draft.id = action.payload.modalTrap.id;
      draft.isActive = true;
      draft.timer = action.payload.modalTrap.timer || 0;
    }),
    [CLEAR_MODAL_TRAP]: (state) => produce(state, (draft) => {
      draft.isActive = false;
      draft.timer = undefined;
    }),
    [UPDATE_ESCAPE_PATHS]: (state, action) => produce(state, (draft) => {
      // Implement escape paths logic here
    }),
    [INCREMENT_TELEMETRY_COUNT]: () => ({ telemetryCount: 1 }) as ModalTrap,
  },
  initialState
);

export default modalTrapReducer;
