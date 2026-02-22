import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Provider } from 'react-redux';
import { createMemoryHistory } from 'history';
import { Router } from 'react-router-dom';
import { EconomyDashboard4, mapStateToProps } from '../../../components/admin/dashboards/EconomyDashboard4';
import configureStore from '../../../store';

const initialState = {
// your state here
};

const store = configureStore(initialState);
const history = createMemoryHistory();

describe('Economy Dashboard 4', () => {
it('renders without crashing', () => {
const wrapper = (
<Provider store={store}>
<Router history={history}>
<EconomyDashboard4 />
</Router>
</Provider>
);

render(wrapper);
});

it('matches snapshot', () => {
// Add your snapshot testing code here
});

describe('mapStateToProps', () => {
it('maps the state correctly', () => {
// Add your mapping tests here
});
});
});
