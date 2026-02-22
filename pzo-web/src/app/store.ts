import { create } from 'zustand';
import { devtools } from 'zustand/devtools';

interface State {
  tick: number;
  hand: string[];
  portfolio: { [key: string]: number };
  macroMeters: { [key: string]: number };
  moments: { [key: string]: number };
  mlEnabled: boolean;
}

const useStore = create<State>(
  (set) => ({
    tick: 0,
    hand: [],
    portfolio: {},
    macroMeters: {},
    moments: {},
    mlEnabled: false,

    setTick: (tick: number) =>
      set((state) => ({ ...state, tick })),
    addHandCard: (card: string) =>
      set((state) => ({ ...state, hand: [...state.hand, card] })),
    removeHandCard: (index: number) =>
      set((state) => ({
        ...state,
        hand: state.hand.filter((_, i) => i !== index),
      })),
    addPortfolioAsset: (asset: string, amount: number) =>
      set((state) => ({ ...state, portfolio: { ...state.portfolio, [asset]: amount } })),
    removePortfolioAsset: (asset: string) =>
      set((state) => ({
        ...state,
        portfolio: {
          ...state.portfolio,
          [asset]: 0,
        },
      })),
    addMacroMeter: (meter: string, value: number) =>
      set((state) => ({ ...state, macroMeters: { ...state.macroMeters, [meter]: value } })),
    removeMacroMeter: (meter: string) =>
      set((state) => ({
        ...state,
        macroMeters: {
          ...state.macroMeters,
          [meter]: 0,
        },
      })),
    addMoment: (moment: string, value: number) =>
      set((state) => ({ ...state, moments: { ...state.moments, [moment]: value } })),
    removeMoment: (moment: string) =>
      set((state) => ({
        ...state,
        moments: {
          ...state.moments,
          [moment]: 0,
        },
      })),
    toggleML: () =>
      set((state) => ({ ...state, mlEnabled: !state.mlEnabled })),
  }),
  devtools()
);

export default useStore;
