import { render, screen } from '@testing-library/react';
import React from 'react';
import App from './App'; // Assuming that App is the main component to be tested.
import { OBSIntegration22 } from './OBS-integration-22'; // Assuming this is the component or function related to OBS-integration-22

describe('OBS-integration-22', () => {
it('should render without crashing', () => {
const { getByTestId } = render(<OBSIntegration22 />);
const obsIntegration22 = getByTestId('obs-integration-22');
expect(obsIntegration22).toBeInTheDocument();
});

// Add more test cases as needed
});
