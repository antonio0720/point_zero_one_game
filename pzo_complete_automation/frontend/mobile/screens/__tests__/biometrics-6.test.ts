import React from 'react';
import { render } from '@testing-library/react-native';
import Biometrics6 from '../Biometrics6';
import { Provider as PaperProvider } from 'react-native-paper';

describe('Biometrics6', () => {
it('renders correctly', () => {
const tree = render(
<PaperProvider>
<Biometrics6 />
</PaperProvider>
).toJSON();
expect(tree).toMatchSnapshot();
});

// Add more test cases as needed
});
