import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import ScenarioBuilder from '../../../components/ScenarioBuilder';

describe('ScenarioBuilder', () => {
it('should render ScenarioBuilder correctly', () => {
const { getByTestId } = render(<ScenarioBuilder />);
expect(getByTestId('scenario-builder')).toBeInTheDocument();
});

it('should handle scenario builder events', () => {
const { getByTestId, getAllByTestId } = render(<ScenarioBuilder />);

// Add more specific tests for the events you want to cover.
// For example:
const eventElement = getByTestId('event-element');
fireEvent.click(eventElement);
expect(eventElement).toHaveClass('active');
});
});
