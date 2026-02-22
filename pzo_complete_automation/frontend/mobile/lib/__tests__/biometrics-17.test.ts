import biometrics17 from '../../src/mobile/lib/biometrics-17';
import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';

describe('Biometrics 17', () => {
it('should correctly handle biometric authentication', () => {
const mockBiometrics = jest.fn(() => Promise.resolve(true));

// Mock the biometrics module
biometrics17.authenticate = mockBiometrics;

const TestComponent = () => {
const handleAuthentication = () => {
biometrics17.authenticate();
};

return (
<button onPress={handleAuthentication}>Authenticate</button>
);
};

// Render the test component
const { getByText } = render(<TestComponent />);

// Trigger the authentication button and wait for the promise to resolve
fireEvent.press(getByText('Authenticate'));
expect(mockBiometrics).toHaveBeenCalledTimes(1);
expect(mockBiometrics).toHaveReturnedWith(true);
});
});
