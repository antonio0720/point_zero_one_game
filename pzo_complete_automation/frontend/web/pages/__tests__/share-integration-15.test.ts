import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { YourComponent } from '../../components/YourComponent'; // replace with the correct component path
import userEvent from '@testing-library/user-event';
import { act } from 'react-dom/test-utils';

describe('Share Integration - Test 15', () => {
it('should render share button and trigger correct action', async () => {
const { getByTestId, getByText } = render(<YourComponent />);

// Find the share button
const shareButton = getByTestId('share-button');

// Click the share button
await act(async () => userEvent.click(shareButton));

// Check if correct action is triggered (e.g., confirm URL is shared, check for an event to be fired)
const sharedUrl = getByText(/your-shared-url/);
expect(sharedUrl).toBeInTheDocument();
});
});
