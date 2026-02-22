import { Biometrics14Component } from '../../components/Biometrics14Component';
import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';

describe('Biometrics14Component', () => {
it('renders correctly', () => {
const tree = render(<Biometrics14Component />).toJSON();
expect(tree).toMatchSnapshot();
});

it('should handle biometric authentication event', () => {
const mockEvent = {
nativeEvent: {
type: 'Authenticated',
authenticatorData: 'authenticator_data',
clientDataJson: 'client_data_json',
rawClientData: 'raw_client_data',
},
};

const { getByTestId } = render(<Biometrics14Component onAuthentication={jest.fn()} />);
const biometrics14Component = getByTestId('biometrics-14');

fireEvent.nativeScrollEvent({
nativeEvent: mockEvent,
}, biometrics14Component);
});
});
