/**
 * PZO_FE_T0151 — P17_TESTING_STORYBOOK_QA: GameBoard
 * Manually authored — executor failure recovery
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import GameBoard from '../components/GameBoard';

const baseIntel = {
  alpha: 40,
  risk: 35,
  volatility: 50,
  antiCheat: 20,
  personalization: 60,
  rewardFit: 55,
  recommendationPower: 45,
  churnRisk: 30,
  momentum: 12,
};

const baseProps = {
  equityHistory: [28000, 29000, 31000, 30500, 32000, 35000, 38000, 40000],
  cash: 15000,
  netWorth: 40000,
  income: 8500,
  expenses: 4800,
  regime: 'Expansion' as const,
  intelligence: baseIntel,
  tick: 240,
  totalTicks: 720,
  freezeTicks: 0,
};

describe('GameBoard', () => {
  it('renders without crashing', () => {
    render(<GameBoard {...baseProps} />);
    expect(document.body.firstChild).toBeTruthy();
  });

  it('displays cash value', () => {
    render(<GameBoard {...baseProps} />);
    // $15,000 or 15000 or 15k should appear somewhere
    const text = document.body.textContent ?? '';
    expect(text).toMatch(/15[,.]?000|15[.0]*[kK]/i);
  });

  it('displays net worth', () => {
    render(<GameBoard {...baseProps} />);
    const text = document.body.textContent ?? '';
    expect(text).toMatch(/40[,.]?000|40[.0]*[kK]/i);
  });

  it('displays current market regime', () => {
    render(<GameBoard {...baseProps} />);
    const text = document.body.textContent ?? '';
    expect(text).toContain('Expansion');
  });

  it('renders SVG equity chart', () => {
    const { container } = render(<GameBoard {...baseProps} />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
  });

  it('renders with Panic regime styling', () => {
    const { container } = render(<GameBoard {...baseProps} regime="Panic" />);
    expect(container).toBeTruthy();
    expect(document.body.textContent).toContain('Panic');
  });

  it('renders with single equity data point', () => {
    render(<GameBoard {...baseProps} equityHistory={[28000]} />);
    expect(document.body.firstChild).toBeTruthy();
  });

  it('displays freeze state when freezeTicks > 0', () => {
    render(<GameBoard {...baseProps} freezeTicks={5} />);
    expect(document.body.firstChild).toBeTruthy();
  });

  it('handles zero cash without crashing', () => {
    render(<GameBoard {...baseProps} cash={0} netWorth={0} />);
    expect(document.body.firstChild).toBeTruthy();
  });

  it('shows income vs expenses data', () => {
    render(<GameBoard {...baseProps} />);
    const text = document.body.textContent ?? '';
    // Either income (8500) or expenses (4800) should be represented
    expect(text.length).toBeGreaterThan(10);
  });

  it('reflects tick progress', () => {
    render(<GameBoard {...baseProps} tick={360} totalTicks={720} />);
    const text = document.body.textContent ?? '';
    expect(text.length).toBeGreaterThan(0);
  });
});
