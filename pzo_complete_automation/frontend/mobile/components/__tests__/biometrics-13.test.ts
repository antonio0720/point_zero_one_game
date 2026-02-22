import React from 'react';
import { render } from '@testing-library/react-native';
import { Biometrics13 } from '../../../components/Biometrics13';
import userEvent from '@testing-library/user-event';

describe('Biometrics13', () => {
it('renders correctly', () => {
const { getByTestId } = render(<Biometrics13 />);
expect(getByTestId('biometrics-13')).toBeInTheDocument();
});

it('handles biometric authentication successfully', async () => {
const mockOnAuthenticate = jest.fn(() => Promise.resolve());
const component = render(<Biometrics13 onAuthenticate={mockOnAuthenticate} />);

userEvent.press(component.getByTestId('biometrics-13'));
await mockOnAuthenticate();
expect(mockOnAuthenticate).toHaveBeenCalledTimes(1);
});

it('handles biometric authentication failure', async () => {
const mockOnAuthenticate = jest.fn(() => Promise.reject(new Error('Authentication failed')));
const component = render(<Biometrics13 onAuthenticate={mockOnAuthenticate} />);

userEvent.press(component.getByTestId('biometrics-13'));
await expect(mockOnAuthenticate).toThrow('Authentication failed');
});
});
