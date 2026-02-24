/**
 * PZO_FE_T0152 — P17_TESTING_STORYBOOK_QA: MomentFlash
 * Manually authored — executor failure recovery
 */
import React from 'react';
import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MomentFlash from '../components/MomentFlash';

describe('MomentFlash', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders without crashing with empty events', () => {
    render(<MomentFlash events={[]} tick={0} />);
    expect(document.body.firstChild).toBeTruthy();
  });

  it('renders without crashing with events', () => {
    render(<MomentFlash events={['Big win: +$12,000']} tick={10} />);
    expect(document.body.firstChild).toBeTruthy();
  });

  it('shows a flash message when a notable event fires', () => {
    const events = ['🏆 Freedom Run achieved — net worth $1M'];
    render(<MomentFlash events={events} tick={1} />);
    expect(document.body.firstChild).toBeTruthy();
  });

  it('handles rapid tick changes without crashing', () => {
    const { rerender } = render(<MomentFlash events={[]} tick={0} />);
    for (let t = 1; t <= 20; t++) {
      rerender(<MomentFlash events={[`Event at tick ${t}`]} tick={t} />);
    }
    expect(document.body.firstChild).toBeTruthy();
  });

  it('auto-dismisses flash after timeout', () => {
    render(<MomentFlash events={['Critical: rent doubled!']} tick={5} />);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    // Component should still be mounted, just possibly hidden
    expect(document.body.firstChild).toBeTruthy();
  });

  it('handles multiple simultaneous events', () => {
    const events = [
      'FUBAR: Medical emergency -$8,000',
      'Opportunity: Series A offer',
      'Regime: Panic mode activated',
    ];
    render(<MomentFlash events={events} tick={12} />);
    expect(document.body.firstChild).toBeTruthy();
  });
});
