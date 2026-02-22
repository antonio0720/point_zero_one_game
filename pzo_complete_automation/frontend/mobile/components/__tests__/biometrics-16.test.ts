import React from 'react';
import { render } from '@testing-library/react-native';
import Biometrics16 from './Biometrics16';

describe('Biometrics16', () => {
it('renders correctly', () => {
const { getByTestId } = render(<Biometrics16 testID="biometrics-16" />);
const biometricsComponent = getByTestId('biometrics-16');
expect(biometricsComponent).toBeDefined();
});

it('matches the snapshot', () => {
const { container } = render(<Biometrics16 testID="biometrics-16" />);
expect(container.firstChild).toMatchSnapshot();
});

it('handles press event correctly', () => {
const onPressMock = jest.fn();
const { getByTestId } = render(<Biometrics16 testID="biometrics-16" onPress={onPressMock} />);
const biometricsComponent = getByTestId('biometrics-16');
fireEvent.press(biometricsComponent);
expect(onPressMock).toHaveBeenCalledTimes(1);
});
});
