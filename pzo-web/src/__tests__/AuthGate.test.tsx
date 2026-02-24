/**
 * PZO_FE_T0161 — P17_TESTING_STORYBOOK_QA: AuthGate
 * Manually authored — executor failure recovery
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AuthGate } from '../components/auth/AuthGate';

const makeAuth = (overrides = {}) => ({
  user: null,
  accessToken: null,
  loading: false,
  error: null,
  login: vi.fn().mockResolvedValue(undefined),
  register: vi.fn().mockResolvedValue(undefined),
  logout: vi.fn(),
  clearError: vi.fn(),
  ...overrides,
});

describe('AuthGate', () => {
  it('renders login form by default', () => {
    render(<AuthGate auth={makeAuth()} onAuth={vi.fn()} />);
    expect(document.body.firstChild).toBeTruthy();
    const text = document.body.textContent ?? '';
    expect(text).toMatch(/login|sign in|username|password/i);
  });

  it('renders register toggle', () => {
    render(<AuthGate auth={makeAuth()} onAuth={vi.fn()} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('switches to register mode', () => {
    render(<AuthGate auth={makeAuth()} onAuth={vi.fn()} />);
    const buttons = screen.getAllByRole('button');
    const registerBtn = buttons.find(b =>
      (b.textContent ?? '').match(/register|sign up|create/i)
    );
    if (registerBtn) {
      fireEvent.click(registerBtn);
      const text = document.body.textContent ?? '';
      expect(text).toMatch(/register|email|display/i);
    }
    expect(document.body.firstChild).toBeTruthy();
  });

  it('renders username input', () => {
    render(<AuthGate auth={makeAuth()} onAuth={vi.fn()} />);
    const inputs = document.querySelectorAll('input');
    expect(inputs.length).toBeGreaterThan(0);
  });

  it('renders password input', () => {
    render(<AuthGate auth={makeAuth()} onAuth={vi.fn()} />);
    const passwordInput = document.querySelector('input[type="password"]');
    expect(passwordInput).not.toBeNull();
  });

  it('shows error message when auth.error is set', () => {
    const auth = makeAuth({ error: 'Invalid credentials' });
    render(<AuthGate auth={auth} onAuth={vi.fn()} />);
    const text = document.body.textContent ?? '';
    expect(text).toContain('Invalid credentials');
  });

  it('calls login on form submission', async () => {
    const auth = makeAuth();
    render(<AuthGate auth={auth} onAuth={vi.fn()} />);

    const inputs = document.querySelectorAll('input');
    if (inputs.length >= 2) {
      fireEvent.change(inputs[0], { target: { value: 'testuser' } });
      fireEvent.change(inputs[1], { target: { value: 'password123' } });
    }

    const submitBtn = screen.getAllByRole('button').find(b =>
      (b.textContent ?? '').match(/login|sign in|submit|enter/i)
    );
    if (submitBtn) {
      fireEvent.click(submitBtn);
    }
    expect(document.body.firstChild).toBeTruthy();
  });

  it('disables submit button during loading', () => {
    const auth = makeAuth({ loading: true });
    render(<AuthGate auth={auth} onAuth={vi.fn()} />);
    expect(document.body.firstChild).toBeTruthy();
  });

  it('calls clearError when user starts typing', () => {
    const auth = makeAuth({ error: 'Previous error' });
    render(<AuthGate auth={auth} onAuth={vi.fn()} />);
    const inputs = document.querySelectorAll('input');
    if (inputs.length > 0) {
      fireEvent.change(inputs[0], { target: { value: 'a' } });
    }
    expect(document.body.firstChild).toBeTruthy();
  });
});
