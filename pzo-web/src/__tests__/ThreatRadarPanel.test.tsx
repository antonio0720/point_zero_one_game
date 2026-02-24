/**
 * ThreatRadarPanel.test.tsx — PZO_FE_T0151
 * Unit tests for ThreatRadarPanel component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThreatRadarPanel, Threat } from '../components/ThreatRadarPanel';

const mockThreats: Threat[] = [
  {
    id: 'threat-1',
    label: 'MARGIN CALL',
    probability: 0.82,
    ticksRemaining: 12,
    level: 'CRITICAL',
    mitigated: false,
  },
  {
    id: 'threat-2',
    label: 'LIQUIDITY SQUEEZE',
    probability: 0.45,
    ticksRemaining: 30,
    level: 'HIGH',
    mitigated: false,
  },
  {
    id: 'threat-3',
    label: 'MARKET DRIFT',
    probability: 0.15,
    ticksRemaining: 60,
    level: 'LOW',
    mitigated: false,
  },
];

describe('ThreatRadarPanel', () => {
  it('renders "NO ACTIVE THREATS" when threat list is empty', () => {
    render(<ThreatRadarPanel threats={[]} tick={0} />);
    expect(screen.getByText('NO ACTIVE THREATS')).toBeDefined();
  });

  it('renders all active threats', () => {
    render(<ThreatRadarPanel threats={mockThreats} tick={42} />);
    expect(screen.getByText('MARGIN CALL')).toBeDefined();
    expect(screen.getByText('LIQUIDITY SQUEEZE')).toBeDefined();
    expect(screen.getByText('MARKET DRIFT')).toBeDefined();
  });

  it('does not render mitigated threats', () => {
    const threats = [
      { ...mockThreats[0], mitigated: true },
      mockThreats[1],
    ];
    render(<ThreatRadarPanel threats={threats} tick={0} />);
    expect(screen.queryByText('MARGIN CALL')).toBeNull();
    expect(screen.getByText('LIQUIDITY SQUEEZE')).toBeDefined();
  });

  it('displays tick counter', () => {
    render(<ThreatRadarPanel threats={mockThreats} tick={99} />);
    expect(screen.getByText('T+99')).toBeDefined();
  });

  it('shows probability percentage', () => {
    render(<ThreatRadarPanel threats={mockThreats} tick={0} />);
    expect(screen.getByText('82% probability')).toBeDefined();
    expect(screen.getByText('45% probability')).toBeDefined();
  });

  it('shows ticks remaining', () => {
    render(<ThreatRadarPanel threats={mockThreats} tick={0} />);
    expect(screen.getByText('12t')).toBeDefined();
    expect(screen.getByText('30t')).toBeDefined();
  });

  it('calls onMitigate with correct id when button clicked', () => {
    const onMitigate = vi.fn();
    render(<ThreatRadarPanel threats={[mockThreats[0]]} tick={0} onMitigate={onMitigate} />);
    fireEvent.click(screen.getByText('MITIGATE'));
    expect(onMitigate).toHaveBeenCalledWith('threat-1');
  });

  it('does not render mitigate buttons when onMitigate not provided', () => {
    render(<ThreatRadarPanel threats={mockThreats} tick={0} />);
    expect(screen.queryByText('MITIGATE')).toBeNull();
  });

  it('sorts threats by probability descending', () => {
    render(<ThreatRadarPanel threats={mockThreats} tick={0} />);
    const labels = screen.getAllByText(/MARGIN CALL|LIQUIDITY SQUEEZE|MARKET DRIFT/);
    expect(labels[0].textContent).toBe('MARGIN CALL');
    expect(labels[1].textContent).toBe('LIQUIDITY SQUEEZE');
    expect(labels[2].textContent).toBe('MARKET DRIFT');
  });
});