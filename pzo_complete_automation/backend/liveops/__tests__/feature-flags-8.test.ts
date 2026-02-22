import React from 'react';
import { renderHook } from '@testing-library/react-hooks';
import { useFeatureFlags } from '../../../backend/liveops';

jest.mock('../../../backend/liveops'); // Mock the liveops module

describe('LiveOps control plane - feature-flags', () => {
const mockUseFeatureFlags = jest.fn().mockReturnValue({
isFlagEnabled: jest.fn().mockReturnValue(true),
});

beforeAll(() => {
// Set up the mock for useFeatureFlags
jest.doMock('../../../backend/liveops', () => ({
useFeatureFlags: mockUseFeatureFlags,
}));
});

it('should return true when flag is enabled', () => {
const { result } = renderHook(() => useFeatureFlags('flagName'));

expect(mockUseFeatureFlags).toHaveBeenCalledWith('flagName');
expect(result.current.isFlagEnabled).toHaveBeenCalledTimes(1);
expect(result.current.isFlagEnabled).toBeCalledWith('flagName');
expect(result.current.isFlagEnabled).toEqual(jest.fn().mockReturnValue(true));
});

it('should return false when flag is disabled', () => {
mockUseFeatureFlags.mockReturnValue({ isFlagEnabled: jest.fn().mockReturnValue(false) });

const { result } = renderHook(() => useFeatureFlags('flagName'));

expect(result.current.isFlagEnabled).toEqual(jest.fn().mockReturnValue(false));
});
});
