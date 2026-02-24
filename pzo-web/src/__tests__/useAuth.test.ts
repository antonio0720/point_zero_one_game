/**
 * PZO_FE_T0157 — P17_TESTING_STORYBOOK_QA: useAuth hook
 * Manually authored — executor failure recovery
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAuth, getAccessToken } from '../hooks/useAuth';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

const makeAuthResponse = (overrides = {}) => ({
  ok: true,
  json: async () => ({
    accessToken: 'mock-jwt-token-abc123',
    user: {
      id: 'user-001',
      username: 'testplayer',
      email: 'test@pzo.game',
      displayName: 'Test Player',
      avatarEmoji: '🎮',
      totalRuns: 5,
      bestNetWorth: 280000,
      totalFreedomRuns: 1,
      haterHeat: 15,
    },
    ...overrides,
  }),
});

describe('useAuth', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    // Default: session check returns 401 (not logged in)
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Unauthorized' }),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with loading: true', () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.loading).toBe(true);
  });

  it('resolves to unauthenticated state when no session exists', async () => {
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(result.current.accessToken).toBeNull();
  });

  it('exposes login function', () => {
    const { result } = renderHook(() => useAuth());
    expect(typeof result.current.login).toBe('function');
  });

  it('exposes register function', () => {
    const { result } = renderHook(() => useAuth());
    expect(typeof result.current.register).toBe('function');
  });

  it('exposes logout function', () => {
    const { result } = renderHook(() => useAuth());
    expect(typeof result.current.logout).toBe('function');
  });

  it('exposes clearError function', () => {
    const { result } = renderHook(() => useAuth());
    expect(typeof result.current.clearError).toBe('function');
  });

  it('sets user state on successful login', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) }) // session check
      .mockResolvedValueOnce(makeAuthResponse()); // login call

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.login('testplayer', 'password123');
    });

    expect(result.current.user?.username).toBe('testplayer');
    expect(result.current.accessToken).toBe('mock-jwt-token-abc123');
  });

  it('sets error on failed login', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Invalid credentials' }),
      });

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      try { await result.current.login('baduser', 'badpass'); } catch (_) {}
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.user).toBeNull();
  });

  it('clears error state via clearError', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) });
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => { result.current.clearError(); });
    expect(result.current.error).toBeNull();
  });

  it('getAccessToken returns null before login', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) });
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { try { await result.current.logout(); } catch(_) {} });
    expect(result.current.accessToken).toBeNull();
  });

  it('clears user on logout', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
      .mockResolvedValueOnce(makeAuthResponse())
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) }); // logout

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.login('testplayer', 'pass'); });
    expect(result.current.user).not.toBeNull();

    await act(async () => { await result.current.logout(); });
    expect(result.current.user).toBeNull();
  });
});
