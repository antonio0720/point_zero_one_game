import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import { PWA3 } from './PWA-3';

describe('PWA-3', () => {
it('renders correctly', () => {
const { getByTestId } = render(<PWA3 data-testid="pwa3" />);
expect(getByTestId('pwa3')).toBeInTheDocument();
});

it('handles click event on button', () => {
const handleClick = jest.fn();
const { getByTestId } = render(<PWA3 data-testid="pwa3" onClick={handleClick} />);
const button = getByTestId('button');
fireEvent.click(button);
expect(handleClick).toHaveBeenCalledTimes(1);
});
});
