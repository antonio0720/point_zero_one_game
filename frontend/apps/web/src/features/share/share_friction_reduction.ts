/**
 * Reduce share artifact friction (copy link, explorer link, one-tap share); telemetry around share dropoffs.
 */

import { Action, createReducer, on } from '@ngrx/store';
import { createEntityAdapter } from '@ngrx/entity';
import { Store } from '@ngxs/store';
import { tap, map } from 'rxjs/operators';
import { ofType } from 'redux-observable';

// Actions
export const LOAD_SHARE_DATA = '[Share] Load Share Data';
export const LOAD_SHARE_DATA_SUCCESS = '[Share] Load Share Data Success';
export const LOAD_SHARE_DATA_FAILURE = '[Share] Load Share Data Failure';

export class LoadShareData implements Action {
  readonly type = LOAD_SHARE_DATA;
}

export class LoadShareDataSuccess implements Action {
  readonly type = LOAD_SHARE_DATA_SUCCESS;

  constructor(public payload: any) {}
}

export class LoadShareDataFailure implements Action {
  readonly type = LOAD_SHARE_DATA_FAILURE;

  constructor(public error: any) {}
}

// Adapter
const shareAdapter = createEntityAdapter<any>();

// Reducer
export const initialState = shareAdapter.getInitialState({});

export const shareReducer = createReducer(
  initialState,
  on(LoadShareDataSuccess, (state, action) => shareAdapter.setAll(action.payload, { ...state, ids: action.payload.ids })),
  on(LoadShareDataFailure, state => shareAdapter.removeAll({ ...state, ids: [] }))
);

// Effects
import { ofType } from 'redux-observable';
import { of } from 'rxjs';
import { ajax } from 'rxjs/ajax';
import { catchError, map } from 'rxjs/operators';

export class LoadShareDataEffect implements ActionObservable<LoadShareDataSuccess | LoadShareDataFailure> {
  readonly type = ofType(LOAD_SHARE_DATA);

  constructor(private store: Store) {}

  operator$ = this.type.pipe(
    map(() => ajax.getJSON('api/share').pipe(
      map((data: any) => new LoadShareDataSuccess(data)),
      catchError(error => of(new LoadShareDataFailure(error)))
    )),
    tap(() => this.store.dispatch(new LoadShareData()))
  );
}

// Selectors
export const getAllShares = shareAdapter.getSelectors().selectAll;
export const getShareById = shareAdapter.getSelectors().selectEntity;
