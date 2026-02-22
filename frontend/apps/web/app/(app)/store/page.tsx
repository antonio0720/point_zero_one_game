/**
 * Store for managing page trust badges in Point Zero One Digital's financial roguelike game.
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface TrustBadge {
  id: string;
  imageUrl: string;
}

interface PageState {
  trustBadges: TrustBadge[];
}

const initialState: PageState = {
  trustBadges: [],
};

const pageSlice = createSlice({
  name: 'page',
  initialState,
  reducers: {
    addTrustBadge(state, action: PayloadAction<TrustBadge>) {
      state.trustBadges.push(action.payload);
    },
  },
});

export const { addTrustBadge } = pageSlice.actions;
export default pageSlice.reducer;
