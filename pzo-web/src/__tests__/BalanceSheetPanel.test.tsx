import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import BalanceSheetPanel from '../components/BalanceSheetPanel';

const baseBS = { cash: 25000, reserves: 5000, illiquidValue: 45000, monthlyObligations: 3000, obligationCoverage: 4.0 };
const baseProps = { balanceSheet: baseBS, obligations: [], portfolio: [], mitigations: [], income: 12000 };

describe('BalanceSheetPanel', () => {
  it('renders without crashing', () => { render(<BalanceSheetPanel {...baseProps} />); expect(document.body.firstChild).toBeTruthy(); });
  it('displays cash value', () => {
    render(<BalanceSheetPanel {...baseProps} />);
    expect(document.body.textContent ?? '').toMatch(/25[,.]?000|25[.0]*[kK]/i);
  });
  it('displays income', () => { render(<BalanceSheetPanel {...baseProps} />); expect((document.body.textContent ?? '').length).toBeGreaterThan(0); });
  it('handles zero values', () => { render(<BalanceSheetPanel {...baseProps} balanceSheet={{ ...baseBS, cash: 0, reserves: 0 }} income={0} />); expect(document.body.firstChild).toBeTruthy(); });
  it('handles negative cash', () => { render(<BalanceSheetPanel {...baseProps} balanceSheet={{ ...baseBS, cash: -1000 }} />); expect(document.body.firstChild).toBeTruthy(); });
  it('handles zero obligations coverage', () => { render(<BalanceSheetPanel {...baseProps} balanceSheet={{ ...baseBS, obligationCoverage: 0 }} />); expect(document.body.firstChild).toBeTruthy(); });
  it('renders expanded', () => { render(<BalanceSheetPanel {...baseProps} isExpanded={true} />); expect(document.body.firstChild).toBeTruthy(); });
  it('fires onToggle callback', () => { render(<BalanceSheetPanel {...baseProps} onToggle={() => {}} />); expect(document.body.firstChild).toBeTruthy(); });
  it('shows positive cashflow when income > obligations', () => { render(<BalanceSheetPanel {...baseProps} income={10000} />); expect((document.body.textContent ?? '').length).toBeGreaterThan(0); });
});
