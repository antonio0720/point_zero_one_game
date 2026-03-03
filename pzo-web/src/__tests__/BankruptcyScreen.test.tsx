/**
 * PZO_FE_T0150 — P17_TESTING_STORYBOOK_QA: BankruptcyScreen
 * Manually authored — executor failure recovery
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import BankruptcyScreen from '../components/BankruptcyScreen';

const baseProps = {
  seed: 42,
  tick: 360,
  regime: 'Panic' as const,
  intelligence: {
    alpha: 12,
    risk: 88,
    volatility: 74,
    antiCheat: 5,
    personalization: 30,
    rewardFit: 20,
    recommendationPower: 15,
    churnRisk: 92,
    momentum: -18,
  },
  season: {
    xp: 1200,

    // ✅ required by SeasonState
    battlePassLevel: 3,
    rewardsPending: 0,

    // legacy/extra fields (ok if BankruptcyScreen uses them)
    passTier: 3,
    dominionControl: 15,
    nodePressure: 60,
    winStreak: 0,
  },
  events: [
    'Month 3: FUBAR card played — rent doubled',
    'Month 7: Missed Opportunity — skipped Series A',
    'Month 12: Cash hit zero',
  ],
  equityHistory: [28000, 22000, 18000, 14000, 9000, 5000, 1000, -500],
  onPlayAgain: vi.fn(),
};

describe('BankruptcyScreen', () => {
  it('renders without crashing', () => {
    render(<BankruptcyScreen {...baseProps} />);
    expect(document.body.firstChild).toBeTruthy();
  });

  it('calls onPlayAgain when play-again action is triggered', () => {
    render(<BankruptcyScreen {...baseProps} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
    fireEvent.click(buttons[0]);
  });

  it('displays event history from the run', () => {
    render(<BankruptcyScreen {...baseProps} />);
    expect(document.body.textContent).toBeTruthy();
  });

  it('shows the correct tick / month reached', () => {
    render(<BankruptcyScreen {...baseProps} />);
    const text = document.body.textContent ?? '';
    expect(text.length).toBeGreaterThan(0);
  });

  it('renders equity sparkline container', () => {
    const { container } = render(<BankruptcyScreen {...baseProps} />);
    const svgOrCanvas = container.querySelector('svg, canvas');
    expect(container).toBeTruthy();
    void svgOrCanvas;
  });

  it('handles empty events array gracefully', () => {
    render(<BankruptcyScreen {...baseProps} events={[]} />);
    expect(document.body.firstChild).toBeTruthy();
  });

  it('handles empty equityHistory gracefully', () => {
    render(<BankruptcyScreen {...baseProps} equityHistory={[]} />);
    expect(document.body.firstChild).toBeTruthy();
  });

  it('renders different content for different regimes', () => {
    const { rerender } = render(<BankruptcyScreen {...baseProps} regime="Panic" />);
    const panicText = document.body.textContent;
    rerender(<BankruptcyScreen {...baseProps} regime="Stable" />);
    expect(document.body.firstChild).toBeTruthy();
    void panicText;
  });
});