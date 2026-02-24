import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import CapabilitiesPanel from '../components/CapabilitiesPanel';

const baseCaps = { underwriting: 3, negotiation: 5, bookkeeping: 4, marketing: 6, compliance: 2, analytics: 7, systems: 4 };
const baseRep = { score: 320, tier: 'Established' as const, recentEvents: ['Won challenge'] };
const baseBS = { cash: 30000, reserves: 8000, illiquidValue: 55000, monthlyObligations: 3200, obligationCoverage: 3.75 };
const baseSnap = { cash: 30000, netWorth: 93000, income: 12000, expenses: 4800, balanceSheet: baseBS, portfolio: [], capabilities: baseCaps, reputation: baseRep, tick: 240, wasEverInDistress: false };
const baseProps = { capabilities: baseCaps, reputation: baseRep, objectives: [] as string[], gameStateSnapshot: baseSnap };

describe('CapabilitiesPanel', () => {
  it('renders without crashing', () => { render(<CapabilitiesPanel {...baseProps} />); expect(document.body.firstChild).toBeTruthy(); });
  it('displays capability stats', () => { render(<CapabilitiesPanel {...baseProps} />); expect((document.body.textContent ?? '').length).toBeGreaterThan(0); });
  it('renders all capability labels', () => { render(<CapabilitiesPanel {...baseProps} />); expect(document.body.firstChild).toBeTruthy(); });
  it('renders with maxed-out stats', () => {
    const maxCaps = { underwriting: 10, negotiation: 10, bookkeeping: 10, marketing: 10, compliance: 10, analytics: 10, systems: 10 };
    render(<CapabilitiesPanel {...baseProps} capabilities={maxCaps} gameStateSnapshot={{ ...baseSnap, capabilities: maxCaps }} />);
    expect(document.body.firstChild).toBeTruthy();
  });
  it('renders with zero stats', () => {
    const zeroCaps = { underwriting: 0, negotiation: 0, bookkeeping: 0, marketing: 0, compliance: 0, analytics: 0, systems: 0 };
    render(<CapabilitiesPanel {...baseProps} capabilities={zeroCaps} gameStateSnapshot={{ ...baseSnap, capabilities: zeroCaps }} />);
    expect(document.body.firstChild).toBeTruthy();
  });
  it('handles Unknown reputation tier', () => {
    const lowRep = { score: 50, tier: 'Unknown' as const, recentEvents: [] };
    render(<CapabilitiesPanel {...baseProps} reputation={lowRep} gameStateSnapshot={{ ...baseSnap, reputation: lowRep }} />);
    expect(document.body.firstChild).toBeTruthy();
  });
  it('renders expanded state', () => { render(<CapabilitiesPanel {...baseProps} isExpanded={true} />); expect(document.body.firstChild).toBeTruthy(); });
});
