import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import ParentalDashboard8 from '../../../components/parental/ParentalDashboard8';

describe('Parental Dashboard 8', () => {
it('renders correctly', () => {
const { getByTestId } = render(<ParentalDashboard8 />);
expect(getByTestId('parental-dashboard-8')).toBeInTheDocument();
});

// Add more test cases as needed
});
