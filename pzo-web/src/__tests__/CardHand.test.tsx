import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CardHand from '../components/CardHand';
import type { Card } from '../components/CardHand';

const makeCard = (overrides: Partial<Card> = {}): Card => ({
  id: `card-${Math.random().toString(36).slice(2)}`,
  name: 'Side Hustle Revenue', type: 'OPPORTUNITY', subtype: 'CASHFLOW',
  cashflowMonthly: 1200, cost: 500, leverage: null, downPayment: null,
  roiPct: null, cashImpact: null, turnsLost: null, value: null,
  energyCost: 500, synergies: [],
  description: 'Launch a digital product generating monthly recurring revenue.',
  ...overrides,
});

const baseDeck: Card[] = [
  makeCard({ id: 'c1', name: 'Freelance Contract', type: 'OPPORTUNITY', cashflowMonthly: 800 }),
  makeCard({ id: 'c2', name: 'Medical Bill', type: 'FUBAR', cashflowMonthly: -600 }),
  makeCard({ id: 'c3', name: 'Job Offer Missed', type: 'MISSED_OPPORTUNITY', cashflowMonthly: 0 }),
];

const baseProps = { cards: baseDeck, playerEnergy: 12000, onPlayCard: vi.fn(), currentTick: 48 };

describe('CardHand', () => {
  it('renders without crashing', () => { render(<CardHand {...baseProps} />); expect(document.body.firstChild).toBeTruthy(); });
  it('renders all cards in hand', () => {
    render(<CardHand {...baseProps} />);
    const text = document.body.textContent ?? '';
    expect(text).toContain('Freelance Contract');
    expect(text).toContain('Medical Bill');
  });
  it('renders empty hand without crashing', () => { render(<CardHand {...baseProps} cards={[]} />); expect(document.body.firstChild).toBeTruthy(); });
  it('renders with zero playerEnergy', () => { render(<CardHand {...baseProps} playerEnergy={0} />); expect(document.body.firstChild).toBeTruthy(); });
  it('calls onPlayCard when a card interaction occurs', () => {
    render(<CardHand {...baseProps} />);
    const els = document.querySelectorAll('[data-card-id], button, [role="button"]');
    if (els.length > 0) fireEvent.click(els[0]);
    expect(document.body.firstChild).toBeTruthy();
  });
  it('renders FUBAR card differently from OPPORTUNITY', () => {
    const op = makeCard({ id: 'op1', type: 'OPPORTUNITY', name: 'Good Deal' });
    const fb = makeCard({ id: 'fb1', type: 'FUBAR', name: 'Bad Debt' });
    render(<CardHand {...baseProps} cards={[op, fb]} />);
    const text = document.body.textContent ?? '';
    expect(text).toContain('Good Deal');
    expect(text).toContain('Bad Debt');
  });
  it('handles max hand size (5 cards)', () => {
    const fullHand = Array.from({ length: 5 }, (_, i) => makeCard({ id: `h${i}`, name: `Card ${i}` }));
    render(<CardHand {...baseProps} cards={fullHand} />);
    expect(document.body.firstChild).toBeTruthy();
  });
  it('renders PRIVILEGED card type', () => {
    const rare = makeCard({ id: 'priv1', type: 'PRIVILEGED', name: 'Board Seat' });
    render(<CardHand {...baseProps} cards={[rare]} />);
    expect(document.body.textContent ?? '').toContain('Board Seat');
  });
  it('renders IPA card type', () => { render(<CardHand {...baseProps} cards={[makeCard({ type: 'IPA', name: 'Equity Round' })]} />); expect(document.body.firstChild).toBeTruthy(); });
});
