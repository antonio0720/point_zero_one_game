import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import ProgressiveDisclosure1, {
Step1,
Step2,
Step3,
} from './progressive-disclosure-1';

describe('Progressive Disclosure 1', () => {
it('renders the initial step correctly', () => {
render(<ProgressiveDisclosure1 />);
expect(screen.getByText(/Initial Step/i)).toBeInTheDocument();
});

it('renders Step 2 after clicking the "Next" button in Step 1', () => {
const { getByText } = render(<ProgressiveDisclosure1 />);
const nextButton = getByText(/Next/i);
fireEvent.click(nextButton);
expect(screen.getByText(/Step 2/i)).toBeInTheDocument();
});

it('renders Step 3 after clicking the "Next" button in Step 2', () => {
const { getByText } = render(<ProgressiveDisclosure1 />);
const nextButton1 = getByText(/Next/i);
fireEvent.click(nextButton1);
const nextButton2 = getByText(/Next/i);
fireEvent.click(nextButton2);
expect(screen.getByText(/Step 3/i)).toBeInTheDocument();
});
});
