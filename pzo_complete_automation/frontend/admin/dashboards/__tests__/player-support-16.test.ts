import { render, screen } from '@testing-library/react';
import playerSupport16 from '../player-support-16'; // Import the component you're testing
import { Provider } from 'react-redux';
import store from '../../store'; // Assuming you have a Redux store

describe('Player Support 16', () => {
beforeEach(() => {
render(
<Provider store={store}>
<playerSupport16 />
</Provider>
);
});

it('renders correctly', () => {
const element = screen.getByTestId('player-support-16');
expect(element).toBeInTheDocument();
});

// Add more test cases as needed
});
