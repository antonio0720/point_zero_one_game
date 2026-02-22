import { render, screen } from '@testing-library/react';
import OfflineMode14 from './OfflineMode14'; // replace with the correct path to your component

describe('OfflineMode14', () => {
it('renders correctly', () => {
render(<OfflineMode14 />);

const offlineMode14Element = screen.getByTestId('offline-mode-14');
expect(offlineMode14Element).toBeInTheDocument();
});

// Add more test cases as needed
});
