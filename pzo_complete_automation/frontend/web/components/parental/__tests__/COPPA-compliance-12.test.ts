import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import ParentalControlsAgeGate from '../ParentalControlsAgeGate'; // Import the component you want to test

describe('COPPA-compliance-12', () => {
it('should render age gate for users below the minimum allowed age', () => {
const { getByText } = render(<ParentalControlsAgeGate isAllowed={false} />);
expect(getByText(/You must be of legal age/i)).toBeInTheDocument();
});

it('should not render age gate for users above the minimum allowed age', () => {
const { queryByText } = render(<ParentalControlsAgeGate isAllowed={true} />);
expect(queryByText(/You must be of legal age/i)).toBeNull();
});
});
