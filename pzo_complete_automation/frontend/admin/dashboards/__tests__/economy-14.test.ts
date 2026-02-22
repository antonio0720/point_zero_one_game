import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import rootReducer from '../../../store'; // Import the root reducer here
import EconomyDashboard14 from './EconomyDashboard14'; // Import the dashboard component here

describe('Admin Console - Economy-14', () => {
let store;

beforeEach(() => {
store = createStore(rootReducer);
});

it('renders the Economy-14 dashboard correctly', () => {
render(
<Provider store={store}>
<EconomyDashboard14 />
</Provider>
);

const economyDashboard14Element = screen.getByTestId('economy-dashboard-14');
expect(economyDashboard14Element).toBeInTheDocument();
});

// Add more test cases as needed
});
