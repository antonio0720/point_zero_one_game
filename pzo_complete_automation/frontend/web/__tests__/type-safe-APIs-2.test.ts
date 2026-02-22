import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { ClientFoundations } from '../ClientFoundations';
import { APIResponse } from '../interfaces';

describe('type-safe-APIs-2', () => {
it('should handle successful response', () => {
const mockData: APIResponse = {
data: [{ id: 1, name: 'Test' }],
status: 'success',
};

const getMock = jest.fn().mockResolvedValue(mockData);

const { getByTestId } = render(<ClientFoundations api={{ get: getMock }} />);

fireEvent.click(getByTestId('fetch-data-button'));

expect(getMock).toHaveBeenCalledTimes(1);
expect(mockData.data[0].id).toBe(1);
expect(mockData.status).toEqual('success');
});

it('should handle error response', () => {
const mockError: APIResponse = {
data: null,
status: 'error',
error: 'An error occurred',
};

const getMock = jest.fn().mockRejectedValue(mockError);

const { getByTestId } = render(<ClientFoundations api={{ get: getMock }} />);

fireEvent.click(getByTestId('fetch-data-button'));

expect(getMock).toHaveBeenCalledTimes(1);
expect(mockError.error).toEqual('An error occurred');
expect(mockError.status).toEqual('error');
});
});
