import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PracticeSandbox5 } from '../../components/onboarding/PracticeSandbox5';

describe('PracticeSandbox5', () => {
it('renders correctly', () => {
render(<PracticeSandbox5 />);
const practiceSandbox5 = screen.getByTestId('practice-sandbox-5');
expect(practiceSandbox5).toBeInTheDocument();
});

it('checks if input values are correct', () => {
const { getByLabelText } = render(<PracticeSandbox5 />);

const input1 = getByLabelText(/input 1/i);
expect(input1).toHaveValue('');

const input2 = getByLabelText(/input 2/i);
expect(input2).toHaveValue('');

fireEvent.change(input1, { target: { value: 'test1' } });
fireEvent.change(input2, { target: { value: 'test2' } });

const submitButton = screen.getByRole('button', { name: /submit/i });
fireEvent.click(submitButton);

// Add assertions for the expected behavior after form submission
});
});
