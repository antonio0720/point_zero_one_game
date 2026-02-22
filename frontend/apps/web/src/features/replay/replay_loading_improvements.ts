/**
 * Replay Loading Improvements
 */

import { Action, createAction, on } from '@ngrx/store';
import { createEntityAdapter, EntityAdapter, EntityState } from '@ngrx/entity';
import { createReducer, onInitialize } from '@ngrx/entity/runtime-checks';
import { Replay } from '../replays/replays.model';
import { loadReplaysSuccess } from './replay-loading.actions';

export interface State extends EntityState<Replay> {
  loading: boolean;
}

export const adapter: EntityAdapter<Replay> = createEntityAdapter<Replay>();

export const initialState: State = adapter.getInitialState({
  loading: false,
});

export const loadReplaysRequest = createAction('[Replay] Load Replays Request');
export const loadReplaysSuccessAction = createAction(
  '[Replay] Load Replays Success',
  loadReplaysSuccess
);
export const loadReplaysFailure = createAction('[Replay] Load Replays Failure');

export const replayLoadingReducer = createReducer(
  initialState,
  on(loadReplaysRequest, state => ({ ...state, loading: true })),
  on(loadReplaysSuccessAction, (state, { replays }) => adapter.setAll(replays, { ...state, loading: false })),
  onInitialize(() => initialState)
);
