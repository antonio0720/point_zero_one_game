import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProgressiveDisclosure11 from './progressive-disclosure-11';

describe('ProgressiveDisclosure11', () => {
it('renders correctly', () => {
render(<ProgressiveDisclosure11 />);
const component = screen.getByTestId('progressive-disclosure-11');
expect(component).toBeInTheDocument();
});

it('checks the presence of onboarding content', () => {
render(<ProgressiveDisclosure11 />);
const onboardingContent = screen.getByText(/your onboarding content here/i);
expect(onboardingContent).toBeInTheDocument();
});

it('checks the presence of training content', () => {
render(<ProgressiveDisclosure11 />);
const trainingContent = screen.getByText(/your training content here/i);
expect(trainingContent).toBeInTheDocument();
});
});
