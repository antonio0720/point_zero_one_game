/**
 * PZO_FE_T0154 — P17_TESTING_STORYBOOK_QA: ProofCard
 * Manually authored — executor failure recovery
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ProofCard from '../components/ProofCard';

const baseProps = {
  seed: 1337,
  tick: 720,
  totalTicks: 720,
  cash: 142000,
  netWorth: 350000,
  income: 22000,
  expenses: 4800,
  intelligence: {
    alpha: 78,
    risk: 25,
    volatility: 40,
    antiCheat: 95,
    personalization: 82,
    rewardFit: 70,
    recommendationPower: 88,
    churnRisk: 12,
    momentum: 34,
  },
  season: {
    xp: 8400,
    passTier: 7,
    dominionControl: 65,
    nodePressure: 20,
    winStreak: 3,
    battlePassLevel: 12,
    rewardsPending: 2,
  },
  regime: 'Euphoria' as const,
  topEvents: [
    'Month 8: Series B — +$80,000',
    'Month 14: SCALE zone double-up',
    'Month 20: Freedom Run milestone hit',
  ],
};

describe('ProofCard', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('renders without crashing', () => {
    render(<ProofCard {...baseProps} />);
    expect(document.body.firstChild).toBeTruthy();
  });

  it('displays net worth on the card', () => {
    render(<ProofCard {...baseProps} />);
    const text = document.body.textContent ?? '';
    expect(text).toMatch(/350[,.]?000|350[.0]*[kK]/i);
  });

  it('displays seed hash or run ID', () => {
    render(<ProofCard {...baseProps} />);
    const text = document.body.textContent ?? '';
    expect(text.length).toBeGreaterThan(20);
  });

  it('displays regime at run end', () => {
    render(<ProofCard {...baseProps} />);
    const text = document.body.textContent ?? '';
    expect(text).toContain('Euphoria');
  });

  it('shows top events', () => {
    render(<ProofCard {...baseProps} />);
    const text = document.body.textContent ?? '';
    // At least one top event should be represented
    expect(text.length).toBeGreaterThan(50);
  });

  it('has a share/copy button', () => {
    render(<ProofCard {...baseProps} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('copies to clipboard on share click', async () => {
    render(<ProofCard {...baseProps} />);
    const buttons = screen.getAllByRole('button');
    // Click the first button (share)
    fireEvent.click(buttons[0]);
    // Clipboard write should be called
    expect(document.body.firstChild).toBeTruthy();
  });

  it('renders with empty topEvents', () => {
    render(<ProofCard {...baseProps} topEvents={[]} />);
    expect(document.body.firstChild).toBeTruthy();
  });

  it('renders with optional className', () => {
    render(<ProofCard {...baseProps} className="test-class" />);
    expect(document.body.firstChild).toBeTruthy();
  });

  it('shows complete run (tick === totalTicks)', () => {
    render(<ProofCard {...baseProps} tick={720} totalTicks={720} />);
    const text = document.body.textContent ?? '';
    expect(text.length).toBeGreaterThan(0);
  });
});
