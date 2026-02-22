import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';

import FeatureRestrictions5 from './FeatureRestrictions5';

describe('Feature Restrictions 5', () => {
it('should not allow access if age is below the required limit', () => {
render(<FeatureRestrictions5 age={17} />);

const submitButton = screen.getByRole('button', { name: /submit/i });
expect(submitButton).toBeInTheDocument();
expect(screen.queryByText(/access granted/i)).not.toBeInTheDocument();

userEvent.click(submitButton);
expect(screen.getByText(/you are not old enough to access this feature/i));
});

it('should allow access if age is equal or above the required limit', () => {
render(<FeatureRestrictions5 age={20} />);

const submitButton = screen.getByRole('button', { name: /submit/i });
expect(submitButton).toBeInTheDocument();

userEvent.click(submitButton);
expect(screen.getByText(/access granted/i));
});
});
