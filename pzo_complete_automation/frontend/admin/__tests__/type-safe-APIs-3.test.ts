import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { client } from '../../../src/services/client';
import { typeSafeAPI } from '../../../src/services/typeSafeAPI';

jest.mock('../../../src/services/client');

describe('Client foundations - type-safe-APIs-3', () => {
it('should make a GET request to the correct endpoint and return the expected data', async () => {
const mockResponse = { data: ['item1', 'item2'] };
client.get.mockResolvedValue(mockResponse);

const result = await typeSafeAPI({
url: '/endpoint',
method: 'GET' as const,
});

expect(client.get).toHaveBeenCalledWith('/endpoint');
expect(result).toEqual(mockResponse.data);
});

it('should make a POST request to the correct endpoint with the expected data', async () => {
const mockData = { key: 'value' };
const mockResponse = { data: 'Success!' };
client.post.mockResolvedValue(mockResponse);

await typeSafeAPI({
url: '/endpoint',
method: 'POST' as const,
body: mockData,
});

expect(client.post).toHaveBeenCalledWith('/endpoint', mockData);
});

it('should handle a non-200 response from the server', async () => {
const mockResponse = { response: { status: 404 } };
client.get.mockRejectedValue(mockResponse);

try {
await typeSafeAPI({
url: '/endpoint',
method: 'GET' as const,
});
} catch (error) {
expect(client.get).toHaveBeenCalledWith('/endpoint');
expect(error.message).toBe('Request failed with status code 404');
}
});
});
