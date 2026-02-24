/**
 * AidContractComposer.test.tsx — PZO_FE_T0154
 * Unit tests for AidContractComposer component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AidContractComposer } from '../components/AidContractComposer';

const mockMembers = [
  { id: 'member-1', displayName: 'CIPHER_9', netWorth: 42000 },
  { id: 'member-2', displayName: 'APEX_7',   netWorth: 18000 },
];

const defaultProps = {
  allianceMembers: mockMembers,
  senderCash: 100000,
  maxAidPct: 0.3,
};

describe('AidContractComposer', () => {
  it('renders AID CONTRACT header', () => {
    render(<AidContractComposer {...defaultProps} />);
    expect(screen.getByText('AID CONTRACT')).toBeDefined();
  });

  it('renders all alliance members in recipient select', () => {
    render(<AidContractComposer {...defaultProps} />);
    expect(screen.getByText(/CIPHER_9/)).toBeDefined();
    expect(screen.getByText(/APEX_7/)).toBeDefined();
  });

  it('renders all aid type buttons', () => {
    render(<AidContractComposer {...defaultProps} />);
    expect(screen.getByText('💰 Cash Transfer')).toBeDefined();
    expect(screen.getByText('🛡 Defensive Shield')).toBeDefined();
    expect(screen.getByText('🔍 Market Intel')).toBeDefined();
    expect(screen.getByText('🚫 Sabotage Block')).toBeDefined();
  });

  it('shows max amount label', () => {
    render(<AidContractComposer {...defaultProps} />);
    expect(screen.getByText('max $30K')).toBeDefined();
  });

  it('shows SEND AID button', () => {
    render(<AidContractComposer {...defaultProps} />);
    expect(screen.getByText('SEND AID')).toBeDefined();
  });

  it('shows CANCEL button when onCancel provided', () => {
    const onCancel = vi.fn();
    render(<AidContractComposer {...defaultProps} onCancel={onCancel} />);
    expect(screen.getByText('CANCEL')).toBeDefined();
  });

  it('calls onCancel when CANCEL clicked', () => {
    const onCancel = vi.fn();
    render(<AidContractComposer {...defaultProps} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('CANCEL'));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('shows error when submitting with zero amount', () => {
    const onSubmit = vi.fn();
    render(<AidContractComposer {...defaultProps} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByText('SEND AID'));
    expect(screen.getByText('Amount must be > 0')).toBeDefined();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows error when amount exceeds max', () => {
    const onSubmit = vi.fn();
    render(<AidContractComposer {...defaultProps} onSubmit={onSubmit} />);
    const input = screen.getByPlaceholderText('0');
    fireEvent.change(input, { target: { value: '99999' } });
    fireEvent.click(screen.getByText('SEND AID'));
    expect(screen.getByText('Max aid: $30K')).toBeDefined();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('calls onSubmit with correct contract when valid', () => {
    const onSubmit = vi.fn();
    render(<AidContractComposer {...defaultProps} onSubmit={onSubmit} />);
    const input = screen.getByPlaceholderText('0');
    fireEvent.change(input, { target: { value: '10000' } });
    fireEvent.click(screen.getByText('SEND AID'));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: 'member-1',
        aidType: 'CASH',
        amount: 10000,
      })
    );
  });

  it('hides amount input when non-CASH aid type selected', () => {
    render(<AidContractComposer {...defaultProps} />);
    fireEvent.click(screen.getByText('🛡 Defensive Shield'));
    expect(screen.queryByPlaceholderText('0')).toBeNull();
  });

  it('renders SEND AID without CANCEL when no onCancel prop', () => {
    render(<AidContractComposer {...defaultProps} />);
    expect(screen.queryByText('CANCEL')).toBeNull();
  });
});