import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BootRun8 } from '../../BootRun8';

describe('BootRun8', () => {
it('renders correctly', () => {
render(<BootRun8 />);
const component = screen.getByTestId('boot-run-8');
expect(component).toBeInTheDocument();
});

it('matches the snapshot', () => {
const { asFragment } = render(<BootRun8 />);
expect(asFragment()).toMatchSnapshot();
});
});
