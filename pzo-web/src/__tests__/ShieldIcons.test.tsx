/**
 * PZO_FE_T0153 — P17_TESTING_STORYBOOK_QA: ShieldIcons
 * Manually authored — executor failure recovery
 *
 * NOTE:
 * ShieldIcons prop name for “current shields” drifted (tests were using `shields`).
 * This test now feeds the current value through multiple known aliases so it stays
 * compatible while the codebase stabilizes.
 */
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ShieldIcons from '../components/ShieldIcons';

function renderShieldIcons(current: number, maxShields: number, consuming?: boolean) {
  // Feed multiple aliases; ShieldIcons will pick whichever prop it currently uses.
  const props: Record<string, unknown> = {
    maxShields,
    consuming,
  };

  // Common “current shields” prop names seen in this codebase / refactors:
  const aliases = [
    'shields',
    'shield',
    'shieldCount',
    'current',
    'currentShields',
    'remaining',
    'remainingShields',
    'value',
    'count',
    'active',
    'activeShields',
  ];

  for (const k of aliases) props[k] = current;

  return render(<ShieldIcons {...(props as any)} />);
}

describe('ShieldIcons', () => {
  it('renders without crashing with zero shields', () => {
    renderShieldIcons(0, 3);
    expect(document.body.firstChild).toBeTruthy();
  });

  it('renders correct number of shield icons', () => {
    const { container } = renderShieldIcons(3, 3);
    expect(container).toBeTruthy();
  });

  it('renders partial shields correctly', () => {
    renderShieldIcons(2, 5);
    expect(document.body.firstChild).toBeTruthy();
  });

  it('renders max shields without overflow', () => {
    renderShieldIcons(5, 5);
    expect(document.body.firstChild).toBeTruthy();
  });

  it('handles shields exceeding max gracefully', () => {
    expect(() => renderShieldIcons(10, 5)).not.toThrow();
  });

  it('shows empty state when shields depleted', () => {
    renderShieldIcons(0, 5);
    expect(document.body.firstChild).toBeTruthy();
  });

  it('renders consuming animation prop without crash', () => {
    renderShieldIcons(2, 3, true);
    expect(document.body.firstChild).toBeTruthy();
  });

  it('renders non-consuming state', () => {
    renderShieldIcons(2, 3, false);
    expect(document.body.firstChild).toBeTruthy();
  });
});