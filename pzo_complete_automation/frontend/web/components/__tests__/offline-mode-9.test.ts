import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { OfflineModeComponent } from '../../OfflineModeComponent';
import userEvent from '@testing-library/user-event';

jest.mock('react-router-dom', () => ({
// You can mock your router components here if needed
}));

describe('OfflineModeComponent', () => {
it('renders the offline mode component with a message', async () => {
const { getByText } = render(<OfflineModeComponent />);
expect(getByText(/Your offline message/i)).toBeInTheDocument();
});

it('attempts to go online after clicking the reconnect button', async () => {
const { getByText, simulate } = render(<OfflineModeComponent />);
const reconnectButton = getByText(/Reconnect/i);

userEvent.click(reconnectButton);

await waitFor(() => {
// You can add an expectation here for the online event or whatever indicates that the component is trying to go online
});
});
});
