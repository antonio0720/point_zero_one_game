import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import COPPACompliance2 from './COPPA-compliance-2';

describe('COPPA Compliance 2', () => {
test('renders age gate for users under 13', () => {
render(<COPPACompliance2 age={12} />);
const ageGateHeader = screen.getByText(/you must be at least 13 years old/i);
expect(ageGateHeader).toBeInTheDocument();
});

test('does not render age gate for users 13 or older', () => {
render(<COPPACompliance2 age={14} />);
const ageGateHeader = screen.queryByText(/you must be at least 13 years old/i);
expect(ageGateHeader).not.toBeInTheDocument();
});
});
