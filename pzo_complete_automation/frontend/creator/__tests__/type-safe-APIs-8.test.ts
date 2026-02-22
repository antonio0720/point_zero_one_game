import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { APIClient, api } from './type-safe-APIs'; // Import the type-safe APIs module
import userEvent from '@testing-library/user-event';
import { act } from 'react-dom/test-utils';

describe('Client foundations - type-safe-APIs', () => {
let client: APIClient;

beforeAll(() => {
// Initialize the API client here, e.g., with a mock implementation for testing purposes
// ...
client = api();
});

test('fetch example endpoint', async () => {
const response = await client.get('/example');

expect(response.status).toEqual(200);
expect(response.data).toBeDefined();
});

test('post example endpoint with data', async () => {
const data = { key: 'value' };
const response = await client.post('/example', data);

expect(response.status).toEqual(201);
expect(response.data).toBeDefined();
});

test('put example endpoint with data', async () => {
const id = '123';
const data = { key: 'value' };
const response = await client.put(`/example/${id}`, data);

expect(response.status).toEqual(200);
expect(response.data).toBeDefined();
});

test('delete example endpoint', async () => {
const id = '123';
const response = await client.delete(`/example/${id}`);

expect(response.status).toEqual(204);
});

test('render a component that fetches data and displays it', () => {
function ExampleComponent() {
const { data: example, isLoading, error } = client.useExample();

if (isLoading) return <div>Loading...</div>;
if (error) return <div>Error: {error.message}</div>;

return <div>{example.data}</div>;
}

const { getByText } = render(<ExampleComponent />);

act(() => {}); // Runs all pending updates in the queue, such as fetching data on mount

expect(getByText('Loading...')).toBeInTheDocument();

// Simulate an asynchronous update with fresh data
client.fetchExample();

act(() => {}); // Flushes the updates to ensure the component has been updated

expect(getByText(example.data)).toBeInTheDocument();
});
});
