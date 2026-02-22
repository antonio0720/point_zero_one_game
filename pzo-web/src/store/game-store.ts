import { create } from 'zustand';
import { devtools } from 'zustand/devtools';
import { GameEngineEventBus } from '../engine/game-engine-event-bus';

interface State {
  runState: string;
  marketState: string;
  energy: number;
  timer: number;
  actionLog: string[];
  mlEnabled: boolean;
  auditHash: string;
}

const useGameStore = create<State>(
  (set) => ({
    runState: 'initial',
    marketState: 'initial',
    energy: 100,
    timer: 0,
    actionLog: [],
    mlEnabled: false,
    auditHash: '',
    dispatch: (action: string) => {
      switch (action) {
        case 'start_game':
          set((state) => ({ ...state, runState: 'running' }));
          break;
        case 'end_game':
          set((state) => ({ ...state, runState: 'ended' }));
          break;
        case 'buy_asset':
          set((state) => ({
            ...state,
            marketState: 'bought',
            energy: state.energy - 10,
          }));
          break;
        case 'sell_asset':
          set((state) => ({
            ...state,
            marketState: 'sold',
            energy: state.energy + 5,
          }));
          break;
        default:
          console.error('Unknown action:', action);
      }
    },
  }),
  devtools()
);

GameEngineEventBus.on('game_start', () => {
  useGameStore.setState({ runState: 'running' });
});

GameEngineEventBus.on('game_end', () => {
  useGameStore.setState({ runState: 'ended' });
});

export { useGameStore };
