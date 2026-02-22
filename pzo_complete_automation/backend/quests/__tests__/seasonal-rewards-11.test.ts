import { renderHook } from '@testing-library/react-hooks';
import { provideMockStore, MockStoreEnhancerWithInitialState } from 'zedux';
import { configureMockStore } from '@jedmao/redux-mock-store';
import thunk from 'redux-thunk';

import { fetchSeasonalRewards11 } from '../../../services/api/seasonal-rewards-11';
import { questsSlice, achievementsSlice, battlePassSlice } from '../../../services/slices';

const middlewares = [thunk];
const mockStore = configureMockStore({ seed: 0 }, middlewares);

describe('seasonal-rewards-11', () => {
let store: MockStoreEnhancerWithInitialState;

beforeEach(() => {
store = provideMockStore({
quests: {},
achievements: {},
battlePass: {},
});
});

it('should fetch and update seasonal rewards data', async () => {
const initialState = {
quests: {
data: [],
loading: false,
error: null,
},
achievements: {
data: [],
loading: false,
error: null,
},
battlePass: {
data: {},
loading: false,
error: null,
},
};

const mockedData = {
quests: [...],
achievements: [...],
battlePass: {},
};

jest.spyOn(fetchSeasonalRewards11, 'default').mockImplementation(() =>
Promise.resolve({
json: () => Promise.resolve(mockedData),
})
);

const { result, waitForNextUpdate } = renderHook(() => questsSlice.useSelector((state) => state.data), {
wrapper: ({ children }) => store.provideStore(children),
});

await waitForNextUpdate();
expect(result.current).toEqual(initialState.quests.data);

store.dispatch(fetchSeasonalRewards11());

await waitForNextUpdate();
expect(result.current).toEqual(mockedData.quests);
});

it('should handle fetch error', async () => {
const initialState = {
quests: {
data: [],
loading: false,
error: null,
},
achievements: {
data: [],
loading: false,
error: null,
},
battlePass: {
data: {},
loading: false,
error: null,
},
};

const error = new Error('Test Error');
jest.spyOn(fetchSeasonalRewards11, 'default').mockImplementation(() =>
Promise.reject(error)
);

const { result } = renderHook(() => questsSlice.useSelector((state) => state.data), {
wrapper: ({ children }) => store.provideStore(children),
});

await store.dispatch(fetchSeasonalRewards11());

expect(result.current).toEqual(initialState.quests.data);
expect(store.getActions()).toContainEqual({ type: 'SET_ERROR', payload: error });
});
});
