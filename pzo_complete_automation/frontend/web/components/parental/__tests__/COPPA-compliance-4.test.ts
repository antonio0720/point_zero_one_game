import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import ParentalCOPPACompliance4 from '../../ParentalCOPPACompliance4';

describe('Parental controls + consent - COPPA-compliance-4', () => {
it('displays the parental controls page', () => {
render(<ParentalCOPPACompliance4 />);
// screen.getByText(/Your Child's Account/i);
// Add more assertions as needed
});

it('handles parental consent submission correctly', async () => {
const mockOnSubmit = jest.fn();

render(<ParentalCOPPACompliance4 onSubmit={mockOnSubmit} />);

// Find the elements and simulate user interactions as needed
const consentCheckbox = screen.getByLabelText(/I agree to these terms/i);
userEvent.click(consentCheckbox);

// Find a submit button and simulate click event
const submitButton = screen.getByRole('button', { name: /submit/i });
userEvent.click(submitButton);

expect(mockOnSubmit).toHaveBeenCalledTimes(1);
});
});
