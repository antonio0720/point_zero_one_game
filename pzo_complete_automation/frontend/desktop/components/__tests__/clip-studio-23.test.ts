import React from 'react';
import { render } from '@testing-library/react';
import { ClipStudio23 } from '../../components/ClipStudio23';

describe('ClipStudio23', () => {
it('renders correctly', () => {
const { getByTestId } = render(<ClipStudio23 data-testid="clip-studio" />);
expect(getByTestId('clip-studio')).toBeInTheDocument();
});

// Add more test cases as needed
});
