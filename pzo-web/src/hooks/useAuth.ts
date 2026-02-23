/**
 * pzo-web/src/hooks/useAuth.ts
 * Production auth state — JWT access token in memory, refresh via HttpOnly cookie
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export interface AuthUser {
  id:               string;
  username:         string;
  email:            string;
  displayName:      string;
  avatarEmoji:      string;
  totalRuns:        number;
  bestNetWorth:     number;
  totalFreedomRuns: number;
  haterHeat:        number;
}

interface AuthState {
  user:        AuthUser | null;
  accessToken: string | null;
  loading:     boolean;
  error:       string | null;
}

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

// Access token lives in memory only (not localStorage — XSS protection)
let _inMemoryToken: string | null = null;

export function getAccessToken() { return _inMemoryToken; }

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user:        null,
    accessToken: null,
    loading:     true,
    error:       null,
  });

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Schedule access token refresh before it expires ────────────────────

  const scheduleRefresh = useCallback((delayMs: number) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    // Refresh 2 min before expiry (token is 15m, so refresh at ~13m)
    const refreshAt = Math.max(delayMs - 120_000, 30_000);
    refreshTimerRef.current = setTimeout(async () => {
      try {
        const res  = await fetch(`${API}/auth/refresh`, { method: 'POST', credentials: 'include' });
        const data = await res.json();
        if (res.ok && data.accessToken) {
          _inMemoryToken = data.accessToken;
          setState((prev) => ({ ...prev, accessToken: data.accessToken }));
          scheduleRefresh(15 * 60 * 1000);
        } else {
          // Refresh failed — force logout
          setState({ user: null, accessToken: null, loading: false, error: null });
          _inMemoryToken = null;
        }
      } catch {
        // Network error — keep state, retry later
        scheduleRefresh(60_000);
      }
    }, refreshAt);
  }, []);

  // ── Attempt silent refresh on mount (restore session from cookie) ────────

  useEffect(() => {
    let cancelled = false;

    async function tryRestore() {
      try {
        const res  = await fetch(`${API}/auth/refresh`, { method: 'POST', credentials: 'include' });
        const data = await res.json();

        if (!cancelled && res.ok && data.accessToken) {
          _inMemoryToken = data.accessToken;

          // Fetch profile
          const profileRes = await fetch(`${API}/auth/me`, {
            headers: { Authorization: `Bearer ${data.accessToken}` },
            credentials: 'include',
          });
          const profileData = await profileRes.json();

          if (!cancelled && profileRes.ok) {
            setState({ user: profileData.user, accessToken: data.accessToken, loading: false, error: null });
            scheduleRefresh(15 * 60 * 1000);
          } else {
            setState({ user: null, accessToken: null, loading: false, error: null });
          }
        } else {
          if (!cancelled) setState({ user: null, accessToken: null, loading: false, error: null });
        }
      } catch {
        if (!cancelled) setState({ user: null, accessToken: null, loading: false, error: null });
      }
    }

    tryRestore();
    return () => { cancelled = true; };
  }, [scheduleRefresh]);

  // ── Register ─────────────────────────────────────────────────────────────

  const register = useCallback(async (
    username: string,
    email: string,
    password: string,
    displayName?: string,
  ) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const res  = await fetch(`${API}/auth/register`, {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({ username, email, password, displayName }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? 'Registration failed.');

      _inMemoryToken = data.accessToken;
      setState({ user: data.user, accessToken: data.accessToken, loading: false, error: null });
      scheduleRefresh(15 * 60 * 1000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Registration failed.';
      setState((prev) => ({ ...prev, loading: false, error: msg }));
      throw err;
    }
  }, [scheduleRefresh]);

  // ── Login ─────────────────────────────────────────────────────────────────

  const login = useCallback(async (usernameOrEmail: string, password: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const res  = await fetch(`${API}/auth/login`, {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({ usernameOrEmail, password }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? 'Login failed.');

      _inMemoryToken = data.accessToken;
      setState({ user: data.user, accessToken: data.accessToken, loading: false, error: null });
      scheduleRefresh(15 * 60 * 1000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed.';
      setState((prev) => ({ ...prev, loading: false, error: msg }));
      throw err;
    }
  }, [scheduleRefresh]);

  // ── Logout ────────────────────────────────────────────────────────────────

  const logout = useCallback(async () => {
    try {
      await fetch(`${API}/auth/logout`, { method: 'POST', credentials: 'include' });
    } catch { /* ignore */ }

    _inMemoryToken = null;
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    setState({ user: null, accessToken: null, loading: false, error: null });
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    user:         state.user,
    accessToken:  state.accessToken,
    loading:      state.loading,
    error:        state.error,
    isAuthed:     !!state.user,
    register,
    login,
    logout,
    clearError,
  };
}
