/**
 * RescueWindowBanner.test.tsx — PZO_FE_T0155
 * Unit tests for RescueWindowBanner component
 * Co-located in src/components/ alongside RescueWindowBanner.tsx
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RescueWindowBanner } from '../components/RescueWindowBanner';

const defaultProps = {
  rescueeDisplayName: 'CIPHER_9',
  rescueeNetWorth: 3200,
  ticksRemaining: 24,
  allianceName: 'APEX SYNDICATE',
  contributionRequired: 20000,
  totalContributed: 8000,
};

describe('RescueWindowBanner', () => {
  it('renders RESCUE WINDOW OPEN header', () => {
    render(<RescueWindowBanner {...defaultProps} />);
    expect(screen.getByText('RESCUE WINDOW OPEN')).toBeDefined();
  });

  it('displays rescuee display name', () => {
    render(<RescueWindowBanner {...defaultProps} />);
    expect(screen.getByText('CIPHER_9')).toBeDefined();
  });

  it('displays alliance name', () => {
    render(<RescueWindowBanner {...defaultProps} />);
    expect(screen.getByText(/APEX SYNDICATE/)).toBeDefined();
  });

  it('displays ticks remaining', () => {
    render(<RescueWindowBanner {...defaultProps} />);
    expect(screen.getByText('24t remaining')).toBeDefined();
  });

  it('displays formatted contribution totals', () => {
    render(<RescueWindowBanner {...defaultProps} />);
    expect(screen.getByText('$8K raised')).toBeDefined();
    expect(screen.getByText('$20K target')).toBeDefined();
  });

  it('shows CONTRIBUTE button when not fully funded and onContribute provided', () => {
    const onContribute = vi.fn();
    render(<RescueWindowBanner {...defaultProps} onContribute={onContribute} />);
    expect(screen.getByText('CONTRIBUTE TO RESCUE')).toBeDefined();
  });

  it('calls onContribute when contribute button clicked', () => {
    const onContribute = vi.fn();
    render(<RescueWindowBanner {...defaultProps} onContribute={onContribute} />);
    fireEvent.click(screen.getByText('CONTRIBUTE TO RESCUE'));
    expect(onContribute).toHaveBeenCalledOnce();
  });

  it('hides CONTRIBUTE button when fully funded', () => {
    render(
      <RescueWindowBanner
        {...defaultProps}
        totalContributed={20000}
        contributionRequired={20000}
        onContribute={vi.fn()}
      />
    );
    expect(screen.queryByText('CONTRIBUTE TO RESCUE')).toBeNull();
  });

  it('shows FUNDED badge when fully funded', () => {
    render(
      <RescueWindowBanner
        {...defaultProps}
        totalContributed={20000}
        contributionRequired={20000}
      />
    );
    expect(screen.getByText('FUNDED ✓')).toBeDefined();
  });

  it('does not show FUNDED badge when partially funded', () => {
    render(<RescueWindowBanner {...defaultProps} totalContributed={8000} />);
    expect(screen.queryByText('FUNDED ✓')).toBeNull();
  });

  it('shows dismiss button when onDismiss provided', () => {
    const onDismiss = vi.fn();
    render(<RescueWindowBanner {...defaultProps} onDismiss={onDismiss} />);
    expect(screen.getByText('✕')).toBeDefined();
  });

  it('calls onDismiss when dismiss button clicked', () => {
    const onDismiss = vi.fn();
    render(<RescueWindowBanner {...defaultProps} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByText('✕'));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('does not show dismiss button when onDismiss not provided', () => {
    render(<RescueWindowBanner {...defaultProps} />);
    expect(screen.queryByText('✕')).toBeNull();
  });

  it('does not show CONTRIBUTE button when onContribute not provided', () => {
    render(<RescueWindowBanner {...defaultProps} />);
    expect(screen.queryByText('CONTRIBUTE TO RESCUE')).toBeNull();
  });

  it('handles zero contribution gracefully (empty progress bar)', () => {
    render(
      <RescueWindowBanner
        {...defaultProps}
        totalContributed={0}
        contributionRequired={20000}
      />
    );
    expect(screen.getByText('$0 raised')).toBeDefined();
  });

  it('formats large rescuee net worth correctly', () => {
    render(<RescueWindowBanner {...defaultProps} rescueeNetWorth={1_500_000} />);
    const text = document.body.textContent ?? '';
    expect(text).toContain('$1.5M');
  });

  it('caps progress bar at 100% even if over-contributed', () => {
    // progress = Math.min(totalContributed / contributionRequired, 1)
    // This ensures the bar never exceeds 100%
    const { container } = render(
      <RescueWindowBanner
        {...defaultProps}
        totalContributed={99999}
        contributionRequired={20000}
      />
    );
    // Progress bar div should have width capped at 100%
    const progressBar = container.querySelector('[style*="width: 100%"]');
    expect(progressBar).not.toBeNull();
  });
});
