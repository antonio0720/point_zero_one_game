import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import AgeGating8 from './AgeGating8';

describe('Age Gating 8', () => {
it('should display the age-gating form and validate input correctly', () => {
const { getByText, getByLabelText } = render(<AgeGating8 />);

// Check if the appropriate title is displayed
expect(getByText(/age-gate/i)).toBeInTheDocument();

// Find and fill out date of birth input
const dateOfBirthInput = getByLabelText(/date of birth/i);
userEvent.type(dateOfBirthInput, '01/01/2017');

// Check if the "Next" button is disabled by default
expect(getByText(/next/i)).toBeDisabled();

// Fill out and validate year of birth input
const yearOfBirthInput = getByLabelText(/year/i);
userEvent.type(yearOfBirthInput, '2017');
userEvent.click(getByText(/next/i));

// Check if the appropriate message is displayed
expect(screen.getByText(/you are old enough to proceed/i)).toBeInTheDocument();
});

it('should handle incorrect date of birth input', () => {
const { getByLabelText, getByText } = render(<AgeGating8 />);

// Find and fill out date of birth input with an invalid format (mm/dd/yyyy)
const dateOfBirthInput = getByLabelText(/date of birth/i);
userEvent.type(dateOfBirthInput, '01/31/2017');

// Check if the "Next" button is disabled due to invalid input format
expect(getByText(/next/i)).toBeDisabled();
});
});
