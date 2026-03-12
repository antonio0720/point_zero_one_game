// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/features/run/components/__tests__/DecisionWindowStack.test.tsx

/**
 * FILE: pzo-web/src/features/run/components/__tests__/DecisionWindowStack.test.tsx
 * Engine 1 — Time Engine
 *
 * Contract coverage:
 * - empty state behavior when no windows are active
 * - urgency ordering and maxVisible truncation
 * - hold action callback wiring
 * - hold availability messaging
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
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
  activeWindows?: DecisionWindow[];
  holdsLeft?: number;
  currentTier?: string;
  activeDecisionCount?: number;
  hasActiveDecision?: boolean;
}

const useTimeEngineMock = vi.fn();

vi.mock('../../hooks/useTimeEngine', () => {
  return {
    useTimeEngine: () => useTimeEngineMock(),
  };
});

vi.mock('../DecisionTimerRing', () => {
  return {
    DecisionTimerRing: ({
      cardInstanceId,
      children,
    }: {
      cardInstanceId: string;
      children?: React.ReactNode;
    }) => (
      <div data-testid={`decision-timer-ring-${cardInstanceId}`}>
        {cardInstanceId}
        {children}
      </div>
    ),
  };
});

import { DecisionWindowStack } from '../DecisionWindowStack';

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

  useTimeEngineMock.mockReturnValue({
    activeWindows,
    holdsLeft: overrides.holdsLeft ?? 1,
    currentTier: overrides.currentTier ?? 'T3',
    activeDecisionCount: overrides.activeDecisionCount ?? activeWindows.length,
    hasActiveDecision: overrides.hasActiveDecision ?? activeWindows.length > 0,
  });
}

describe('DecisionWindowStack', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setTimeEngineState();
  });

  it('renders custom empty state when no active decision windows exist', () => {
    setTimeEngineState({
      activeWindows: [],
      activeDecisionCount: 0,
      hasActiveDecision: false,
    });

    render(
      <DecisionWindowStack
        emptyState={<div data-testid="decision-window-empty">No active decisions</div>}
      />,
    );

    expect(screen.getByTestId('decision-window-empty')).toBeInTheDocument();
    expect(screen.queryByLabelText('Active decision windows')).not.toBeInTheDocument();
  });

  it('sorts visible windows by remainingMs, then openedAtMs, then windowId', () => {
    const windows = [
      makeWindow({
        windowId: 'window-c',
        cardId: 'card-c',
        remainingMs: 4_000,
        openedAtMs: 300,
      }),
      makeWindow({
        windowId: 'window-a',
        cardId: 'card-a',
        remainingMs: 2_000,
        openedAtMs: 200,
      }),
      makeWindow({
        windowId: 'window-b',
        cardId: 'card-b',
        remainingMs: 2_000,
        openedAtMs: 200,
      }),
      makeWindow({
        windowId: 'window-d',
        cardId: 'card-d',
        remainingMs: 2_000,
        openedAtMs: 100,
      }),
    ];

    setTimeEngineState({
      activeWindows: windows,
      activeDecisionCount: windows.length,
      hasActiveDecision: true,
    });

    render(<DecisionWindowStack title="Decision Queue" />);

    expect(screen.getByText('Decision Queue')).toBeInTheDocument();

    const cardLabels = screen.getAllByTitle(/card-/).map((node) => node.textContent);
    expect(cardLabels).toEqual(['card-d', 'card-a', 'card-b', 'card-c']);
  });

  it('respects maxVisible and excludes resolved or expired windows', () => {
    const windows = [
      makeWindow({ windowId: 'w-1', cardId: 'card-1', remainingMs: 1_000 }),
      makeWindow({ windowId: 'w-2', cardId: 'card-2', remainingMs: 2_000 }),
      makeWindow({ windowId: 'w-3', cardId: 'card-3', remainingMs: 3_000 }),
      makeWindow({ windowId: 'w-4', cardId: 'card-4', remainingMs: 4_000, isResolved: true }),
      makeWindow({ windowId: 'w-5', cardId: 'card-5', remainingMs: 5_000, isExpired: true }),
    ];

    setTimeEngineState({
      activeWindows: windows,
      activeDecisionCount: windows.length,
      hasActiveDecision: true,
    });

    render(<DecisionWindowStack maxVisible={2} />);

    expect(screen.getByText('card-1')).toBeInTheDocument();
    expect(screen.getByText('card-2')).toBeInTheDocument();
    expect(screen.queryByText('card-3')).not.toBeInTheDocument();
    expect(screen.queryByText('card-4')).not.toBeInTheDocument();
    expect(screen.queryByText('card-5')).not.toBeInTheDocument();
  });

  it('invokes onApplyHold with the selected window when a hold is available', () => {
    const onApplyHold = vi.fn();
    const target = makeWindow({
      windowId: 'hold-target',
      cardId: 'critical-card',
      remainingMs: 900,
    });

    setTimeEngineState({
      activeWindows: [target],
      holdsLeft: 1,
      activeDecisionCount: 1,
      hasActiveDecision: true,
    });

    render(<DecisionWindowStack onApplyHold={onApplyHold} />);

    fireEvent.click(screen.getByRole('button', { name: /apply hold/i }));

    expect(onApplyHold).toHaveBeenCalledTimes(1);
    expect(onApplyHold).toHaveBeenCalledWith(
      expect.objectContaining({
        windowId: 'hold-target',
        cardId: 'critical-card',
      }),
    );
  });

  it('shows status messaging when hold cannot be applied', () => {
    const heldWindow = makeWindow({
      windowId: 'held',
      cardId: 'held-card',
      isOnHold: true,
      holdExpiresAtMs: Date.now() + 3_000,
    });

    const closedWindow = makeWindow({
      windowId: 'closed',
      cardId: 'closed-card',
      isOnHold: false,
    });

    setTimeEngineState({
      activeWindows: [heldWindow, closedWindow],
      holdsLeft: 0,
      activeDecisionCount: 2,
      hasActiveDecision: true,
    });

    render(<DecisionWindowStack />);

    expect(screen.getByText(/hold active/i)).toBeInTheDocument();
    expect(screen.getByText(/no holds left/i)).toBeInTheDocument();
  });
});