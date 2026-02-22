import React from 'react';
import { render } from '@testing-library/react-native';
import { mockBiometrics11 } from './biometrics11.mock'; // Assuming you have a mock implementation here
import biometrics11 from './biometrics-11';

jest.mock('./biometrics-11', () => ({
default: jest.fn(() => mockBiometrics11),
}));

// The rest of the test file remains the same
