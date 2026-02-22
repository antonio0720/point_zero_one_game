import { act, renderHook } from '@testing-library/react-hooks';
import { inflation3 } from '../macro/inflation-3';
import { unstable_History as History } from 'history';

jest.mock('../router', () => ({
useRouter: () => ({
push: jest.fn(),
}),
}));

describe('inflation-3 macro', () => {
let history: Partial<History>;

beforeEach(() => {
history = { createMemoryHistory: () => history };
});

it('should navigate to the correct path on click', () => {
const { result } = renderHook(() => inflation3());

act(() => {
result.current.click();
});

expect(history.push).toHaveBeenCalledWith('/path/to/inflation-3');
});

it('should show the correct message when hovering', () => {
const { result } = renderHook(() => inflation3());
const { getByText } = renderHook(() => ({ current: result.current }));

act(() => {
jest.runAllTimers();
jest.advanceTimersByTime(2000); // Simulate hover delay
});

expect(getByText('Inflation 3')).toBeInTheDocument();
});
});
