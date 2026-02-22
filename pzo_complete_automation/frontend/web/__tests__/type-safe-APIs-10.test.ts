import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';

import { ClientFoundationsProvider } from './ClientFoundations';
import { useFetchData, FetchDataResponse } from './useFetchData';

describe('ClientFoundations', () => {
const mockData = { id: 1, name: 'Test Data' };

it('should provide useFetchData hook with type-safe API', () => {
const FetchDataMock = jest.fn().mockResolvedValueOnce(mockData as FetchDataResponse<typeof mockData>);

function TestComponent() {
const data = useFetchData('/api/test');

if (data.loading) return <div>Loading...</div>;
if (data.error) return <div>{`Error: ${data.error}`}</div>;
return <div>{JSON.stringify(data.data)}</div>;
}

const { getByText } = render(
<ClientFoundationsProvider apiBase="/api">
<TestComponent />
</ClientFoundationsProvider>
);

expect(FetchDataMock).toHaveBeenCalledTimes(1);
expect(FetchDataMock).toHaveBeenCalledWith('/api/test');
expect(getByText(JSON.stringify(mockData))).toBeInTheDocument();
});
});
