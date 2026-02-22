import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import { ScenarioBuilder } from '../../../components/ScenarioBuilder';

describe('Scenario Builder', () => {
it('renders correctly', () => {
render(<ScenarioBuilder />);
const scenarioBuilder = screen.getByTestId('scenario-builder');
expect(scenarioBuilder).toBeInTheDocument();
});

// Add more test cases as needed to cover different scenarios of the Scenario Builder component
});
