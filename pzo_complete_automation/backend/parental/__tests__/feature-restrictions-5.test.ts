import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { createStore, applyMiddleware } from 'redux';
import thunk from 'redux-thunk';
import rootReducer from '../../../reducers';
import ParentalControlsConsent from '../../../../components/ParentalControls/ParentalControlsConsent';
import userEvent from '@testing-library/user-event';
import { initialState } from '../../../store/initialState';

jest.mock('react-router-dom', () => ({
...jest.requireActual('react-router-dom'),
useHistory: () => ({ push: jest.fn() })
}));

const store = createStore(rootReducer, initialState, applyMiddleware(thunk));

describe('ParentalControlsConsent', () => {
it('renders ParentalControlsConsent component', () => {
render(
<Provider store={store}>
<ParentalControlsConsent />
</Provider>
);
// Add expected screen content selectors here, e.g., screen.getByText(/Your consent is required/i)
});

it('handles user acceptance of Parental Controls Consent', async () => {
render(
<Provider store={store}>
<ParentalControlsConsent />
</Provider>
);

const acceptButton = screen.getByText(/Accept/i);
userEvent.click(acceptButton);

// Add expected dispatch actions and history push here, e.g., expect(store.dispatch).toHaveBeenCalledWith(actions.setParentalControlsConsentStatus('ACCEPTED'))
});

it('handles user rejection of Parental Controls Consent', async () => {
render(
<Provider store={store}>
<ParentalControlsConsent />
</Provider>
);

const rejectButton = screen.getByText(/Reject/i);
userEvent.click(rejectButton);

// Add expected dispatch actions and history push here, e.g., expect(store.dispatch).toHaveBeenCalledWith(actions.setParentalControlsConsentStatus('REJECTED'))
});
});
