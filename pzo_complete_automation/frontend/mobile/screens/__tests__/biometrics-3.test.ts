import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import Biometrics3 from '../Biometrics3';
import { Provider as MockNavProvider } from 'react-navigation-mock';

jest.mock('expo', () => ({
...jest.requireActual('expo'),
Biometrics: jest.fn(() => <div>Mock Biometrics</div>),
}));

describe('Biometrics3', () => {
it('renders correctly', () => {
const { getByTestId } = render(
<MockNavProvider>
<Biometrics3 testID="Biometrics3" />
</MockNavProvider>,
);

expect(getByTestId('Biometrics3')).toBeDefined();
});

it('calls biometric authentication function', () => {
const mockAuthentication = jest.fn(() => Promise.resolve());
(expo.Biometrics as jest.Mock).mockImplementationOnce(() => mockAuthentication);

const { getByTestId } = render(
<MockNavProvider>
<Biometrics3 testID="Biometrics3" />
</MockNavProvider>,
);

fireEvent.press(getByTestId(' Biometrics3'));

expect(mockAuthentication).toHaveBeenCalled();
});
});
