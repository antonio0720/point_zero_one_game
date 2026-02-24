/**
 * ReplayTimeline.test.tsx — PZO_FE_T0159
 * Unit tests for ReplayTimeline component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReplayTimeline, ReplayEvent } from '../components/ReplayTimeline';

const mockEvents: ReplayEvent[] = [
  { tick: 10,  kind: 'CARD_PLAYED',     label: 'Played: LEVERAGE LOAN',   netWorthAtTick: 32000, emoji: '💳' },
  { tick: 45,  kind: 'FATE',            label: 'FATE: Medical Emergency',  netWorthAtTick: 18000, emoji: '💀' },
  { tick: 100, kind: 'REGIME_CHANGE',   label: 'Regime → PANIC',           netWorthAtTick: 12000, emoji: '📉' },
  { tick: 200, kind: 'MILESTONE',       label: 'First $100K crossed',      netWorthAtTick: 102000, emoji: '🎯' },
  { tick: 350, kind: 'BANKRUPTCY_NEAR', label: 'Near bankruptcy warning',  netWorthAtTick: 1200  },
];

const defaultProps = {
  events: mockEvents,
  totalTicks: 720,
  finalNetWorth: 87000,
  seed: 1771904674,
};

describe('ReplayTimeline', () => {
  it('renders REPLAY FORENSICS header', () => {
    render(<ReplayTimeline {...defaultProps} />);
    expect(screen.getByText('REPLAY FORENSICS')).toBeDefined();
  });

  it('displays seed number', () => {
    render(<ReplayTimeline {...defaultProps} />);
    expect(screen.getByText('SEED 1771904674')).toBeDefined();
  });

  it('displays final net worth formatted', () => {
    render(<ReplayTimeline {...defaultProps} />);
    expect(screen.getByText('$87K')).toBeDefined();
  });

  it('displays negative final net worth with minus sign', () => {
    render(<ReplayTimeline {...defaultProps} finalNetWorth={-5000} />);
    expect(screen.getByText('-$5K')).toBeDefined();
  });

  it('shows click prompt when no event selected', () => {
    render(<ReplayTimeline {...defaultProps} />);
    expect(screen.getByText('CLICK TIMELINE TO INSPECT EVENT')).toBeDefined();
  });

  it('shows event detail when timeline marker clicked', () => {
    render(<ReplayTimeline {...defaultProps} />);
    const buttons = document.querySelectorAll('button[title]');
    fireEvent.click(buttons[0]);
    expect(screen.getByText('Played: LEVERAGE LOAN')).toBeDefined();
  });

  it('shows net worth at tick when event clicked', () => {
    render(<ReplayTimeline {...defaultProps} />);
    const buttons = document.querySelectorAll('button[title]');
    fireEvent.click(buttons[0]); // tick 10, netWorth 32000
    expect(screen.getByText('$32K')).toBeDefined();
  });

  it('shows tick number when event clicked', () => {
    render(<ReplayTimeline {...defaultProps} />);
    const buttons = document.querySelectorAll('button[title]');
    fireEvent.click(buttons[0]); // tick 10
    expect(screen.getByText('T+10')).toBeDefined();
  });

  it('calls onScrub with correct tick when marker clicked', () => {
    const onScrub = vi.fn();
    render(<ReplayTimeline {...defaultProps} onScrub={onScrub} />);
    const buttons = document.querySelectorAll('button[title]');
    fireEvent.click(buttons[1]); // tick 45
    expect(onScrub).toHaveBeenCalledWith(45);
  });

  it('renders correct number of event markers', () => {
    render(<ReplayTimeline {...defaultProps} />);
    const buttons = document.querySelectorAll('button[title]');
    expect(buttons.length).toBe(mockEvents.length);
  });

  it('renders legend for all event kinds', () => {
    render(<ReplayTimeline {...defaultProps} />);
    expect(screen.getByText('CARD PLAYED')).toBeDefined();
    expect(screen.getByText('FATE')).toBeDefined();
    expect(screen.getByText('REGIME CHANGE')).toBeDefined();
    expect(screen.getByText('MILESTONE')).toBeDefined();
    expect(screen.getByText('BANKRUPTCY NEAR')).toBeDefined();
  });

  it('renders empty timeline gracefully', () => {
    render(<ReplayTimeline {...defaultProps} events={[]} />);
    expect(screen.getByText('REPLAY FORENSICS')).toBeDefined();
    expect(screen.getByText('CLICK TIMELINE TO INSPECT EVENT')).toBeDefined();
  });
});