/**
 * FILE: pzo-web/src/features/run/components/__tests__/HoldActionButton.test.tsx
 * Engine 1 — Time Engine
 *
 * Contract coverage:
 * - label, counter, and disabled states
 * - automatic urgent-window targeting
 * - explicit window targeting
 * - fallback browser event dispatch when callback is absent
 * - status messaging for active/used states
 */

import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type TestDecisionCardType = 'FORCED_FATE' | 'HATER_INJECTION' | 'CRISIS_EVENT';

interface DecisionWindow {
  windowId: string;
  cardId: string;
  cardType: TestDecisionCardType;
  durationMs: number;
  remainingMs: number;
  openedAtMs: number;
  expiresAtMs: number;
  isOnHold: boolean;
  holdExpiresAtMs: number | null;
  worstOptionIndex: number;
  isExpired: boolean;
  isResolved: boolean;
}

interface TimeEngineMockState {
  holdsLeft?: number;
  activeWindows?: DecisionWindow[];
  hasHoldAvailable?: boolean;
}

const useTimeEngineMock = vi.fn();
const formatCountdownMock = vi.fn((ms: number) => `${Math.ceil(ms / 1000)}s`);

vi.mock('../../hooks/useTimeEngine', () => {
  return {
    useTimeEngine: () => useTimeEngineMock(),
  };
});

vi.mock('../../hooks/useDecisionWindow', () => {
  return {
    formatCountdown: (ms: number) => formatCountdownMock(ms),
  };
});

import HoldActionButton from '../HoldActionButton';

function makeWindow(overrides: Partial<DecisionWindow> = {}): DecisionWindow {
  return {
    windowId: overrides.windowId ?? 'window-1',
    cardId: overrides.cardId ?? 'card-1',
    cardType: overrides.cardType ?? 'FORCED_FATE',
    durationMs: overrides.durationMs ?? 8_000,
    remainingMs: overrides.remainingMs ?? 8_000,
    openedAtMs: overrides.openedAtMs ?? 1_000,
    expiresAtMs: overrides.expiresAtMs ?? 9_000,
    isOnHold: overrides.isOnHold ?? false,
    holdExpiresAtMs: overrides.holdExpiresAtMs ?? null,
    worstOptionIndex: overrides.worstOptionIndex ?? 0,
    isExpired: overrides.isExpired ?? false,
    isResolved: overrides.isResolved ?? false,
  };
}

function setTimeEngineState(overrides: TimeEngineMockState = {}): void {
  const activeWindows = overrides.activeWindows ?? [];
  const holdsLeft = overrides.holdsLeft ?? 1;

  useTimeEngineMock.mockReturnValue({
    holdsLeft,
    activeWindows,
    hasHoldAvailable: overrides.hasHoldAvailable ?? holdsLeft > 0,
  });
}

describe('HoldActionButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setTimeEngineState();
  });

  it('renders with default label and hold counter', () => {
    const target = makeWindow({
      windowId: 'w-ready',
      cardId: 'card-ready',
      remainingMs: 4_000,
    });

    setTimeEngineState({
      activeWindows: [target],
      holdsLeft: 1,
      hasHoldAvailable: true,
    });

    render(<HoldActionButton />);

    expect(screen.getByRole('button', { name: /hold/i })).toBeInTheDocument();
    expect(screen.getByText('1/1')).toBeInTheDocument();
    expect(screen.getByText(/targets card-ready/i)).toBeInTheDocument();
  });

  it('disables itself and shows NO WINDOW when no target window exists', () => {
    setTimeEngineState({
      activeWindows: [],
      holdsLeft: 1,
      hasHoldAvailable: true,
    });

    render(<HoldActionButton />);

    const button = screen.getByRole('button', { name: /no window/i });
    expect(button).toBeDisabled();
    expect(screen.getByText(/no active forced-decision window is available/i)).toBeInTheDocument();
  });

  it('auto-selects the most urgent eligible window and passes it to onApplyHold', async () => {
    const urgent = makeWindow({
      windowId: 'w-urgent',
      cardId: 'urgent-card',
      remainingMs: 1_200,
      openedAtMs: 50,
    });

    const slower = makeWindow({
      windowId: 'w-slower',
      cardId: 'slower-card',
      remainingMs: 5_000,
      openedAtMs: 10,
    });

    const held = makeWindow({
      windowId: 'w-held',
      cardId: 'held-card',
      remainingMs: 300,
      isOnHold: true,
      holdExpiresAtMs: Date.now() + 5_000,
    });

    const onApplyHold = vi.fn().mockResolvedValue(undefined);

    setTimeEngineState({
      activeWindows: [slower, held, urgent],
      holdsLeft: 1,
      hasHoldAvailable: true,
    });

    render(<HoldActionButton onApplyHold={onApplyHold} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^hold$/i }));
      await Promise.resolve();
    });

    expect(onApplyHold).toHaveBeenCalledTimes(1);
    expect(onApplyHold).toHaveBeenCalledWith(
      'w-urgent',
      expect.objectContaining({
        windowId: 'w-urgent',
        cardId: 'urgent-card',
      }),
    );
  });

  it('uses explicit windowId targeting when provided', async () => {
    const first = makeWindow({
      windowId: 'w-first',
      cardId: 'first-card',
      remainingMs: 1_000,
    });

    const explicit = makeWindow({
      windowId: 'w-explicit',
      cardId: 'explicit-card',
      remainingMs: 7_000,
    });

    const onApplyHold = vi.fn().mockResolvedValue(undefined);

    setTimeEngineState({
      activeWindows: [first, explicit],
      holdsLeft: 1,
      hasHoldAvailable: true,
    });

    render(<HoldActionButton windowId="w-explicit" onApplyHold={onApplyHold} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^hold$/i }));
      await Promise.resolve();
    });

    expect(onApplyHold).toHaveBeenCalledTimes(1);
    expect(onApplyHold).toHaveBeenCalledWith(
      'w-explicit',
      expect.objectContaining({
        cardId: 'explicit-card',
      }),
    );
  });

  it('dispatches the fallback browser event when no callback is supplied', () => {
    const target = makeWindow({
      windowId: 'w-browser',
      cardId: 'browser-card',
      cardType: 'CRISIS_EVENT',
      remainingMs: 1_500,
    });

    setTimeEngineState({
      activeWindows: [target],
      holdsLeft: 1,
      hasHoldAvailable: true,
    });

    const eventListener = vi.fn();
    window.addEventListener('pzo:time:apply-hold', eventListener as EventListener);

    render(<HoldActionButton />);

    fireEvent.click(screen.getByRole('button', { name: /^hold$/i }));

    expect(eventListener).toHaveBeenCalledTimes(1);

    const customEvent = eventListener.mock.calls[0]?.[0] as CustomEvent<{
      windowId: string;
      cardId: string;
      cardType: string;
      remainingMs: number;
      timestamp: number;
    }>;

    expect(customEvent.detail.windowId).toBe('w-browser');
    expect(customEvent.detail.cardId).toBe('browser-card');
    expect(customEvent.detail.cardType).toBe('CRISIS_EVENT');
    expect(customEvent.detail.remainingMs).toBe(1_500);
  });

  it('shows active and used states correctly', () => {
    const held = makeWindow({
      windowId: 'w-held',
      cardId: 'held-card',
      isOnHold: true,
      holdExpiresAtMs: Date.now() + 10_000,
    });

    setTimeEngineState({
      activeWindows: [held],
      holdsLeft: 1,
      hasHoldAvailable: true,
    });

    const { rerender } = render(<HoldActionButton />);

    expect(screen.getByRole('button', { name: /hold active/i })).toBeDisabled();
    expect(screen.getByText(/frozen until/i)).toBeInTheDocument();

    setTimeEngineState({
      activeWindows: [makeWindow({ windowId: 'w-used', cardId: 'used-card' })],
      holdsLeft: 0,
      hasHoldAvailable: false,
    });

    rerender(<HoldActionButton />);

    expect(screen.getByRole('button', { name: /hold used/i })).toBeDisabled();
    expect(screen.getByText(/already been consumed this run/i)).toBeInTheDocument();
  });
});