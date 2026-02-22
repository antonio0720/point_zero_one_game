import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import clientFoundations from '../client-foundations';
import typeSafeAPIs7 from './type-safe-apis-7';

jest.mock('../client-foundations');

describe('Type-Safe APIs - Type Safe APIs 7', () => {
let store;
let mockClientFoundations;

beforeEach(() => {
mockClientFoundations = jest.mocked(clientFoundations);
store = createStore(() => ({ clientFoundations }));
});

it('should render Type Safe APIs 7 component', () => {
const { getByText } = render(
<Provider store={store}>
<typeSafeAPIs7 />
</Provider>
);

expect(getByText(/Type-Safe APIs 7/i)).toBeInTheDocument();
});

it('should call fetchData on mount and update when data changes', () => {
const mockFetchData = jest.fn(() => Promise.resolve({ data: 'test' }));
mockClientFoundations.useFetchData.mockReturnValue([mockFetchData, {}, []]);

let component;

render(
<Provider store={store}>
<typeSafeAPIs7 />
</Provider>
);

expect(mockFetchData).toHaveBeenCalledTimes(1);

mockFetchData.mockReset();

const updateButton = screen.getByRole('button', { name: /update/i });
userEvent.click(updateButton);

expect(mockFetchData).toHaveBeenCalledTimes(2);
});

it('should handle error during data fetching', () => {
const mockFetchData = jest.fn(() => Promise.reject(new Error('Test Error')));
mockClientFoundations.useFetchData.mockReturnValue([mockFetchData, {}, []]);

let component;

render(
<Provider store={store}>
<typeSafeAPIs7 />
</Provider>
);

const errorElement = screen.getByText(/Error: Test Error/i);
expect(errorElement).toBeInTheDocument();
});
});
