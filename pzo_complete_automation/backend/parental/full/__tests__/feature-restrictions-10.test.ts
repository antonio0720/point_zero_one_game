import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import ParentalControlsAgeGating from '../../components/ParentalControlsAgeGating';

describe('Parental controls + age gating', () => {
it('displays the feature-restrictions-10 component', () => {
render(<ParentalControlsAgeGating feature="feature-restrictions-10" />);
const linkElement = screen.getByText(/Feature Restrictions 10/i);
expect(linkElement).toBeInTheDocument();
});

it('allows access to Feature Restrictions 10 for users above the age limit', async () => {
const user = userEvent.setup();
render(<ParentalControlsAgeGating feature="feature-restrictions-10" />);

const ageInput = screen.getByLabelText(/age/i);
const ageButton = screen.getByRole('button', { name: /submit/i });

await user.type(ageInput, 'overAgeLimit');
await user.click(ageButton);

const linkElement = screen.getByText(/Feature Restrictions 10/i);
expect(linkElement).toBeInTheDocument();
});

it('denies access to Feature Restrictions 10 for users below the age limit', async () => {
const user = userEvent.setup();
render(<ParentalControlsAgeGating feature="feature-restrictions-10" />);

const ageInput = screen.getByLabelText(/age/i);
const ageButton = screen.getByRole('button', { name: /submit/i });

await user.type(ageInput, 'underAgeLimit');
await user.click(ageButton);

const linkElement = screen.queryByText(/Feature Restrictions 10/i);
expect(linkElement).not.toBeInTheDocument();
});
});
