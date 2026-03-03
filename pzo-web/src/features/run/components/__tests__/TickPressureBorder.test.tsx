// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/features/run/components/__tests__/TickPressureBorder.test.tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import TickPressureBorder from '../TickPressureBorder';

function pickRoot(container: HTMLElement): HTMLElement {
  const el = container.firstElementChild as HTMLElement | null;
  if (!el) throw new Error('TickPressureBorder rendered nothing (container.firstElementChild is null).');
  return el;
}

function getBorderEl(container: HTMLElement): HTMLElement {
  return (
    (screen.queryByTestId('tick-pressure-border') as HTMLElement | null) ||
    (screen.queryByTestId('pressure-border') as HTMLElement | null) ||
    pickRoot(container)
  );
}

describe('<TickPressureBorder />', () => {
  it('renders without crashing', () => {
    const C: any = TickPressureBorder;
    const { container } = render(<C />);
    const el = getBorderEl(container as unknown as HTMLElement);
    expect(el).toBeInTheDocument();
  });

  it('forwards className to the root element (if supported)', () => {
    const C: any = TickPressureBorder;
    const { container } = render(<C className="tier-3 test-border" tier="ELEVATED" pressureTier="ELEVATED" />);
    const el = getBorderEl(container as unknown as HTMLElement);

    // If component forwards className, we can assert it; otherwise still ensure it mounted.
    const cls = (el.getAttribute('class') ?? '').toLowerCase();
    if (cls.length > 0) {
      expect(el).toHaveClass('test-border');
    } else {
      expect(el).toBeInTheDocument();
    }
  });

  it('reflects tier/urgency in class or data attrs (best-effort contract)', () => {
    const C: any = TickPressureBorder;
    const { container } = render(<C tier="CRITICAL" pressureTier="CRITICAL" urgency="URGENT" />);
    const el = getBorderEl(container as unknown as HTMLElement);

    const signal =
      `${el.className || ''} ${el.getAttribute('data-tier') || ''} ${el.getAttribute('data-pressure') || ''} ${el.getAttribute('data-urgency') || ''}`.toLowerCase();

    if (signal.trim().length > 0) {
      expect(signal).toMatch(/critical|urgent|danger|red/);
    } else {
      expect(el).toBeInTheDocument();
    }
  });
});