import React from 'react';
import { render, screen } from '@testing-library/react';
import { ClipStudio3 } from './ClipStudio3';

describe('ClipStudio3', () => {
it('renders correctly', () => {
render(<ClipStudio3 />);
const element = screen.getByTestId('clip-studio-3');
expect(element).toBeInTheDocument();
});

it('matches snapshot', () => {
const { container } = render(<ClipStudio3 />);
expect(container).toMatchSnapshot();
});
});
