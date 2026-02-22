/**
 * ReplayTimeline component for Point Zero One Digital's financial roguelike game.
 */

import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Pagination, Timeline } from '@material-ui/core';
import moment from 'moment';

// Actions
export const FETCH_REPLAY_WINDOW = 'FETCH_REPLAY_WINDOW';
export const SET_CURRENT_TIME = 'SET_CURRENT_TIME';

// Types
interface ReplayWindow {
  id: number;
  startTime: string;
  endTime: string;
  data: any[]; // TODO: replace with specific types when available
}

interface State {
  replayWindows: ReplayWindow[];
  currentReplayWindowId: number | null;
  currentTime: string;
}

const initialState: State = {
  replayWindows: [],
  currentReplayWindowId: null,
  currentTime: moment().format(),
};

// Reducer
type Action =
  | { type: typeof FETCH_REPLAY_WINDOW; payload: ReplayWindow[] }
  | { type: typeof SET_CURRENT_TIME; payload: string };

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case FETCH_REPLAY_WINDOW:
      return { ...state, replayWindows: action.payload };
    case SET_CURRENT_TIME:
      return { ...state, currentTime: action.payload };
    default:
      throw new Error(`Unhandled action type: ${action.type}`);
  }
};

// Selectors
const useAppState = () => useSelector((state: any) => state.replayTimeline);

// Hooks
export const useReplayWindows = () => useAppState().replayWindows;
export const useCurrentReplayWindowId = () => useAppState().currentReplayWindowId;
export const useCurrentTime = () => useAppState().currentTime;

// Actions Creators
const fetchReplayWindow = (replayWindows: ReplayWindow[]) => ({
  type: FETCH_REPLAY_WINDOW,
  payload: replayWindows,
});

const setCurrentTime = (currentTime: string) => ({
  type: SET_CURRENT_TIME,
  payload: currentTime,
});

// Component
const ReplayTimeline: React.FC = () => {
  const dispatch = useDispatch();
  const replayWindows = useReplayWindows();
  const currentReplayWindowId = useCurrentReplayWindowId();
  const currentTime = useCurrentTime();

  // Fetch initial data and set current replay window
  useEffect(() => {
    if (replayWindows.length === 0) {
      dispatch(fetchReplayWindow([]));
    } else if (!currentReplayWindowId) {
      dispatch(setCurrentTime(replayWindows[0].startTime));
    }
  }, [dispatch, replayWindows]);

  // Handle timeline change and set current time
  const handleChange = (event: React.ChangeEvent<unknown>, value: number) => {
    const newWindowId = replayWindows.findIndex(
      (window) => moment(window.startTime).isSame(moment.utc(value), 'minute')
    );

    if (newWindowId !== -1) {
      dispatch(setCurrentTime(replayWindows[newWindowId].startTime));
    }
  };

  return (
    <div>
      <Timeline
        value={currentTime}
        onChange={handleChange}
        className="timeline"
      />
      <Pagination
        count={replayWindows.length}
        page={replayWindows.findIndex((window) => moment(window.startTime).isSame(moment.utc(currentTime), 'minute')) + 1}
        color="primary"
      />
    </div>
  );
};

// Initial state and reducer export
export { initialState, reducer };
export default ReplayTimeline;
