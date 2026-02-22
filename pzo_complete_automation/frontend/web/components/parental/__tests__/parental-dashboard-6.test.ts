import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import ParentalDashboard6 from '../ParentalDashboard6';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import { createMemoryHistory } from 'history';

const mockStore = configureStore();

describe('Parental Dashboard 6', () => {
let store, history;

beforeEach(() => {
store = mockStore({});
history = createMemoryHistory();
});

it('renders Parental Dashboard 6', () => {
render(
<Provider store={store}>
<ParentalDashboard6 history={history} />
</Provider>
);

expect(screen.getByText(/Parental Dashboard 6/i)).toBeInTheDocument();
});

it('shows consent for content', () => {
const initialState = {
parentalControls: {
contentConsent: [{ id: 1, title: 'Test Content', status: 'pending' }],
},
};

store.replaceReducer({}, initialState);

render(
<Provider store={store}>
<ParentalDashboard6 history={history} />
</Provider>
);

const consentContent = screen.getByText(/Test Content/i);
expect(consentContent).toBeInTheDocument();
});

it('allows a user to grant consent for content', async () => {
const initialState = {
parentalControls: {
contentConsent: [{ id: 1, title: 'Test Content', status: 'pending' }],
},
};

store.replaceReducer({}, initialState);

const { getByText } = render(
<Provider store={store}>
<ParentalDashboard6 history={history} />
</Provider>
);

await userEvent.click(getByText(/Grant Consent/i));

expect(screen.getByText(/Test Content consented/i)).toBeInTheDocument();
});
});
