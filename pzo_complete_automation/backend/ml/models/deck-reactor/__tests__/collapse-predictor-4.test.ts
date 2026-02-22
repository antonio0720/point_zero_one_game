import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { CollapsePredictor } from '../../models/deck-reactor/CollapsePredictor';
import { MemoryRouter } from 'react-router-dom';

describe('CollapsePredictor', () => {
it('renders without crashing', () => {
const { getByTestId } = render(
<MemoryRouter>
<CollapsePredictor />
</MemoryRouter>
);

expect(getByTestId('collapse-predictor')).toBeInTheDocument();
});

it('handles user input correctly', () => {
const { getByLabelText, getByTestId } = render(
<MemoryRouter>
<CollapsePredictor />
</MemoryRouter>
);

const inputElement = getByLabelText(/enter input/i);
fireEvent.change(inputElement, { target: { value: 'example' } });
fireEvent.click(getByTestId('submit-button'));

// Add assertions for the predicted result here
});
});
