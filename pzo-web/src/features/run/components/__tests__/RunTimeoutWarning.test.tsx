// FILE: pzo-web/src/features/run/components/__tests__/RunTimeoutWarning.test.tsx

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import * as RunTimeoutWarningModule from '../RunTimeoutWarning';
import { TickTier } from '../../../../engines/time/types';

const RunTimeoutWarning =
  ((RunTimeoutWarningModule as unknown as Record<string, unknown>).default ??
    (RunTimeoutWarningModule as unknown as Record<string, unknown>).RunTimeoutWarning) as React.ComponentType<any>;

function pickRoot(container: HTMLElement): HTMLElement {
  const el = container.firstElementChild as HTMLElement | null;
  if (!el) {
    throw new Error('RunTimeoutWarning rendered nothing (container.firstElementChild is null).');
  }
  return el;
}

function getWarningEl(container: HTMLElement): HTMLElement | null {
  return (
    (screen.queryByTestId('run-timeout-warning') as HTMLElement | null) ||
    (screen.queryByRole('alert') as HTMLElement | null) ||
    (container.firstElementChild as HTMLElement | null)
  );
}

function renderWarning(overrides: Record<string, unknown> = {}) {
  const timeSnapshot = {
    isRunActive: true,
    currentTier: TickTier.STABLE,
    ticksRemaining: 48,
    ticksElapsed: 252,
    tickProgressPct: 0.84,
    secondsPerTick: 13,
    ...overrides,
  };

  return render(
    <RunTimeoutWarning
      timeSnapshot={timeSnapshot}
      warningThresholdTicks={25}
      criticalThresholdTicks={10}
    />,
  );
}

describe('RunTimeoutWarning', () => {
  it('does not render an alert when the run is comfortably inside the budget', () => {
    const { container } = renderWarning({
      ticksRemaining: 60,
      tickProgressPct: 0.6,
      currentTier: TickTier.STABLE,
    });

    const el = getWarningEl(container as unknown as HTMLElement);
    expect(el).toBeNull();
  });

  it('renders a warning state when the run approaches timeout', () => {
    const { container } = renderWarning({
      ticksRemaining: 18,
      tickProgressPct: 0.94,
      currentTier: TickTier.COMPRESSED,
      secondsPerTick: 8,
    });

    const el = getWarningEl(container as unknown as HTMLElement);

    expect(el).toBeInTheDocument();

    const text = (el?.textContent ?? '').toLowerCase();
    expect(text).toContain('18');
    expect(text).toContain('tick');
  });

  it('renders a critical state near timeout collapse', () => {
    const { container } = renderWarning({
      ticksRemaining: 4,
      tickProgressPct: 0.986,
      currentTier: TickTier.COLLAPSE_IMMINENT,
      secondsPerTick: 2,
    });

    const el = getWarningEl(container as unknown as HTMLElement);

    expect(el).toBeInTheDocument();

    const text = (el?.textContent ?? '').toLowerCase();
    expect(text).toContain('4');
    expect(text).toContain('tick');
  });

  it('does not render when the run is not active', () => {
    const { container } = renderWarning({
      isRunActive: false,
      ticksRemaining: 3,
      tickProgressPct: 0.99,
    });

    const el = getWarningEl(container as unknown as HTMLElement);
    expect(el).toBeNull();
  });
});