import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { BiometricsScreen } from '../../../frontend/mobile/screens/BiometricsScreen';
import { NavigationActions } from 'react-navigation';

jest.mock('../../../frontend/mobile/components/CustomButton', () => 'CustomButton');

describe('Biometrics Screen', () => {
let getByTestId;
let navigate;

beforeEach(() => {
const nav = jest.genMockFunction();
navigate = nav;

const renderer = create( BiometricsScreen ).wrapRenderer((instance) => ({
...renderer.wrapRoot(instance),
getByTestId,
}));

getByTestId = renderer.getByTestId;
});

it('renders correctly', () => {
const { toJSON } = render(<BiometricsScreen navigation={nav} />);
// Add assertions for the expected structure of the component here
});

it('handles biometric authentication', () => {
const mockAuthenticate = jest.fn(() => Promise.resolve());

jest.spyOn(BiometricsScreen.prototype, 'authenticate').mockImplementation(mockAuthenticate);

render(<BiometricsScreen navigation={nav} />);

const biometricButton = getByTestId('biometric-button');
fireEvent.press(biometricButton);

expect(mockAuthenticate).toHaveBeenCalled();
});

it('handles error during biometric authentication', () => {
const mockAuthenticate = jest.fn(() => Promise.reject(new Error('Authentication failed')));

jest.spyOn(BiometricsScreen.prototype, 'authenticate').mockImplementation(mockAuthenticate);

render(<BiometricsScreen navigation={nav} />);

const biometricButton = getByTestId('biometric-button');
fireEvent.press(biometricButton);

expect(mockAuthenticate).toHaveBeenCalled();
});
});
