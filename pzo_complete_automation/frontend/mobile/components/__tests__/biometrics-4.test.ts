import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import Biometrics4 from '../../components/Biometrics4';

describe('Biometrics4', () => {
it('renders correctly', () => {
const { getByTestId } = render(<Biometrics4 testID="biometrics-4" />);
expect(getByTestId('biometrics-4')).toBeTruthy();
});

it('handles biometric event', () => {
const mockOnComplete = jest.fn();
const { getByTestId } = render(<Biometrics4 testID="biometrics-4" onComplete={mockOnComplete} />);
fireEvent.press(getByTestId('biometrics-4'));
expect(mockOnComplete).toHaveBeenCalledTimes(1);
});
});
