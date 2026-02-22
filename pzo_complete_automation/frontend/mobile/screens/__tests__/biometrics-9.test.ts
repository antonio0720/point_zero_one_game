import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import Biometrics9 from '../biometrics-9';
import { Provider as MockProvider } from 'react-native/Libraries/TestingUtilities/render-helpers';
import { mockNavigation } from '../../../__mocks__/navigation';

jest.mock('react-native', () => ({
...jest.requireActual('react-native'),
Alert: jest.requireActual('react-native').Alert, // Mock Alert if needed
}));

describe('Biometrics9', () => {
it('renders correctly', () => {
const { getByText } = render(
<MockProvider mockedNavigator={mockNavigation}>
<Biometrics9 />
</MockProvider>
);

expect(getByText('Expected Text')).toBeDefined();
});

it('handles biometric authentication correctly', () => {
const { getByTestId } = render(
<MockProvider mockedNavigator={mockNavigation}>
<Biometrics9 />
</MockProvider>
);

// Simulate biometric auth event
fireEvent.press(getByTestId('biometric-auth-button'));

// Assert that authentication was handled correctly
expect(Alert).toHaveBeenCalledWith(
'Authentication Successful', // or any expected message
{
// other assertions if necessary
}
);
});
});
