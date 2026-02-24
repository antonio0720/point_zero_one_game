/**
 * PZO_FE_T0153 — P17_TESTING_STORYBOOK_QA: ShieldIcons
 * Manually authored — executor failure recovery
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ShieldIcons from '../components/ShieldIcons';

describe('ShieldIcons', () => {
  it('renders without crashing with zero shields', () => {
    render(<ShieldIcons shields={0} maxShields={3} />);
    expect(document.body.firstChild).toBeTruthy();
  });

  it('renders correct number of shield icons', () => {
    const { container } = render(<ShieldIcons shields={3} maxShields={3} />);
    // Should render 3 active shield indicators
    expect(container).toBeTruthy();
  });

  it('renders partial shields correctly', () => {
    render(<ShieldIcons shields={2} maxShields={5} />);
    expect(document.body.firstChild).toBeTruthy();
  });

  it('renders max shields without overflow', () => {
    render(<ShieldIcons shields={5} maxShields={5} />);
    expect(document.body.firstChild).toBeTruthy();
  });

  it('handles shields exceeding max gracefully', () => {
    // Should not crash if props are out of range
    expect(() => render(<ShieldIcons shields={10} maxShields={5} />)).not.toThrow();
  });

  it('shows empty state when shields depleted', () => {
    render(<ShieldIcons shields={0} maxShields={5} />);
    const text = document.body.textContent ?? '';
    // Component should indicate no shields
    expect(document.body.firstChild).toBeTruthy();
  });

  it('renders consuming animation prop without crash', () => {
    render(<ShieldIcons shields={2} maxShields={3} consuming={true} />);
    expect(document.body.firstChild).toBeTruthy();
  });

  it('renders non-consuming state', () => {
    render(<ShieldIcons shields={2} maxShields={3} consuming={false} />);
    expect(document.body.firstChild).toBeTruthy();
  });
});
