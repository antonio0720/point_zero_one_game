import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import { ClipStudio13 } from '../../components/ClipStudio13';

describe('ClipStudio13', () => {
it('renders the Clip Studio 13 component', () => {
render(<ClipStudio13 />);
const linkElement = screen.getByText(/Clip Studio 13/i);
expect(linkElement).toBeInTheDocument();
});

it('matches the snapshot', () => {
const { asFragment } = render(<ClipStudio13 />);
expect(asFragment()).toMatchSnapshot();
});
});
