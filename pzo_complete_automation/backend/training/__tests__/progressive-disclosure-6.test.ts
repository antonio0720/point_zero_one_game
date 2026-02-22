import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import userEvent from '@testing-library/user-event';
import { act } from 'react-test-renderer';

import ProgressiveDisclosure6 from './ProgressiveDisclosure6';
import { PROVIDER_DATA } from '../../providers/__fixtures__/providerData';

describe('ProgressiveDisclosure6', () => {
it('renders the component with initial state', () => {
const { container } = render(
<ProgressiveDisclosure6 providerData={PROVIDER_DATA} />
);

expect(container).toMatchSnapshot();
});

it('displays the first step when clicked', async () => {
const { getByText } = render(
<ProgressiveDisclosure6 providerData={PROVIDER_DATA} />
);

const firstStepButton = getByText(/First Step/i);
await act(() => userEvent.click(firstStepButton));

expect(screen.getByText(/Step 1 content/i)).toBeInTheDocument();
});

it('displays the second step when clicked', async () => {
const { getByText } = render(
<ProgressiveDisclosure6 providerData={PROVIDER_DATA} />
);

const firstStepButton = getByText(/First Step/i);
await act(() => userEvent.click(firstStepButton));

const secondStepButton = getByText(/Second Step/i);
await act(() => userEvent.click(secondStepButton));

expect(screen.getByText(/Step 2 content/i)).toBeInTheDocument();
});
});
