import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Provider } from 'react-redux';
import { createMemoryHistory } from 'history';
import { Router } from 'react-router-dom';
import configureStore from 'redux-mock-store';
import DeckBalance, { getDeckBalance } from '../../decks/DeckBalance';
import mockData from '../mocks/deckMockData';

const mockStore = configureStore();
const history = createMemoryHistory();

describe('Deck systems - deck-balance-1', () => {
let store;

beforeEach(() => {
store = mockStore({
decks: {
activeDeckId: 'deck1',
decksData: mockData,
},
});
});

it('renders DeckBalance with correct data', () => {
render(
<Provider store={store}>
<Router history={history}>
<DeckBalance />
</Router>
</Provider>
);

const balance = screen.getByText(/balance: \$[0-9,.]+/);
expect(balance).toBeInTheDocument();
});

it('calculates the correct deck balance', () => {
expect(getDeckBalance(mockData)).toEqual({
// Add expected balance value here based on your mock data
});
});
});
