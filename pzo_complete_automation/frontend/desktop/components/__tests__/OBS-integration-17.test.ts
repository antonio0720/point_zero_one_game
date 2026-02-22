import React from 'react';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import rootReducer from '../../../reducers';
import OBSIntegration17Component from '../OBS-integration-17';
import userEvent from '@testing-library/user-event';

const store = createStore(rootReducer);

describe('OBS Integration 17', () => {
beforeEach(() => {
render(
<Provider store={store}>
<OBSIntegration17Component />
</Provider>
);
});

it('should display the OBS-integration-17 component', () => {
const obsIntegration17Element = screen.getByTestId('obs-integration-17');
expect(obsIntegration17Element).toBeInTheDocument();
});

it('should handle user interaction with the OBS-integration-17 component', async () => {
// Add your test cases for user interaction here
});
});
