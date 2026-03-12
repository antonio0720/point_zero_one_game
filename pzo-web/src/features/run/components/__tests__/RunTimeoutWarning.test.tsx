// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/features/run/components/__tests__/RunTimeoutWarning.test.tsx

/**
 * FILE: pzo-web/src/features/run/components/__tests__/RunTimeoutWarning.test.tsx
 * Engine 1 — Time Engine timeout surface
 *
 * Contract coverage:
 * - safe state hidden by default
 * - warning state near timeout
 * - collapse state near terminal timeout
 * - inactive run suppression
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useTimeEngineMock = vi.fn();

vi.mock('../../hooks/useTimeEngine', () => {
  return {
    useTimeEngine: () => useTimeEngineMock(),
  };
});

import * as RunTimeoutWarningModule from '../RunTimeoutWarning';

const RunTimeoutWarning =
  ((RunTimeoutWarningModule as unknown as Record<string, unknown>).default ??
    (RunTimeoutWarningModule as unknown as Record<string, unknown>).RunTimeoutWarning) as React.ComponentType<{
    showWhenSafe?: boolean;
    warnAtTicksRemaining?: number;
    criticalAtTicksRemaining?: number;
    collapseAtTicksRemaining?: number;
  }>;

interface TimeStateOverrides {
  isRunActive?: boolean;
  currentTier?: 'T0' | 'T1' | 'T2' | 'T3' | 'T4';
  ticksRemaining?: number;
  ticksElapsed?: number;
  tickProgressPct?: number;
  secondsPerTick?: number;
  tickBudget?: number;
  activeDecisionCount?: number;
  hasActiveDecision?: boolean;
}

function setTimeEngineState(overrides: TimeStateOverrides = {}): void {
  useTimeEngineMock.mockReturnValue({
    isRunActive: overrides.isRunActive ?? true,
    currentTier: overrides.currentTier ?? 'T1',
    ticksRemaining: overrides.ticksRemaining ?? 48,
    ticksElapsed: overrides.ticksElapsed ?? 252,
    tickProgressPct: overrides.tickProgressPct ?? 0.84,
    secondsPerTick: overrides.secondsPerTick ?? 13,
    tickBudget: overrides.tickBudget ?? 300,
    activeDecisionCount: overrides.activeDecisionCount ?? 0,
    hasActiveDecision: overrides.hasActiveDecision ?? false,
  });
}

describe('RunTimeoutWarning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setTimeEngineState();
  });

  it('does not render an alert when the run is comfortably inside the budget', () => {
    setTimeEngineState({
      ticksRemaining: 60,
      tickProgressPct: 0.6,
      currentTier: 'T1',
    });

    render(<RunTimeoutWarning />);

    expect(screen.queryByTestId('run-timeout-warning')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders a warning state when the run approaches timeout', () => {
    setTimeEngineState({
      ticksRemaining: 18,
      tickProgressPct: 0.94,
      currentTier: 'T2',
      secondsPerTick: 8,
    });

    render(<RunTimeoutWarning />);

    const el = screen.getByTestId('run-timeout-warning');
    expect(el).toBeInTheDocument();

    const text = (el.textContent ?? '').toLowerCase();
    expect(text).toContain('18');
    expect(text).toContain('tick');
  });

  it('renders a critical collapse state near timeout', () => {
    setTimeEngineState({
      ticksRemaining: 4,
      tickProgressPct: 0.986,
      currentTier: 'T4',
      secondsPerTick: 2,
    });

    render(<RunTimeoutWarning />);

    const el = screen.getByTestId('run-timeout-warning');
    expect(el).toBeInTheDocument();

    const text = (el.textContent ?? '').toLowerCase();
    expect(text).toContain('4');
    expect(text).toContain('tick');
    expect(text).toContain('timeout');
  });

  it('does not render when the run is not active', () => {
    setTimeEngineState({
      isRunActive: false,
      ticksRemaining: 3,
      tickProgressPct: 0.99,
    });

    render(<RunTimeoutWarning />);

    expect(screen.queryByTestId('run-timeout-warning')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});