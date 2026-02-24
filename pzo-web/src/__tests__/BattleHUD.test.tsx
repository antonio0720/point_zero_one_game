/**
 * BattleHUD.test.tsx — PZO_FE_T0156
 * Unit tests for BattleHUD component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BattleHUD, BattleParticipant } from '../components/BattleHUD';

const mockParticipants: BattleParticipant[] = [
  {
    id: 'player-local',
    displayName: 'SOVEREIGN',
    netWorth: 250000,
    haterHeat: 12,
    isLocal: true,
  },
  {
    id: 'opponent-1',
    displayName: 'RIVAL_X',
    netWorth: 180000,
    haterHeat: 8,
    isLocal: false,
  },
];

const defaultProps = {
  phase: 'ACTIVE' as const,
  participants: mockParticipants,
  ticksRemaining: 45,
  roundNumber: 2,
  totalRounds: 5,
  localScore: 3,
  opponentScore: 1,
};

describe('BattleHUD', () => {
  it('renders BATTLE ACTIVE phase label', () => {
    render(<BattleHUD {...defaultProps} />);
    expect(screen.getByText('BATTLE ACTIVE')).toBeDefined();
  });

  it('renders all phase labels correctly', () => {
    const phases = ['PREP', 'ACTIVE', 'RESOLUTION', 'ENDED'] as const;
    const labels = ['PREP PHASE', 'BATTLE ACTIVE', 'RESOLVING', 'BATTLE ENDED'];
    phases.forEach((phase, i) => {
      const { unmount } = render(<BattleHUD {...defaultProps} phase={phase} />);
      expect(screen.getByText(labels[i])).toBeDefined();
      unmount();
    });
  });

  it('displays round number and total rounds', () => {
    render(<BattleHUD {...defaultProps} />);
    expect(screen.getByText(/R2\/5/)).toBeDefined();
  });

  it('displays ticks remaining', () => {
    render(<BattleHUD {...defaultProps} />);
    expect(screen.getByText(/45t/)).toBeDefined();
  });

  it('displays local player name and net worth', () => {
    render(<BattleHUD {...defaultProps} />);
    expect(screen.getByText('SOVEREIGN')).toBeDefined();
    expect(screen.getByText('$250K')).toBeDefined();
  });

  it('displays opponent name and net worth', () => {
    render(<BattleHUD {...defaultProps} />);
    expect(screen.getByText('RIVAL_X')).toBeDefined();
    expect(screen.getByText('$180K')).toBeDefined();
  });

  it('displays scores', () => {
    render(<BattleHUD {...defaultProps} />);
    expect(screen.getByText('3')).toBeDefined();
    expect(screen.getByText('1')).toBeDefined();
  });

  it('shows forfeit button during ACTIVE phase when handler provided', () => {
    const onForfeit = vi.fn();
    render(<BattleHUD {...defaultProps} onForfeit={onForfeit} />);
    expect(screen.getByText('FORFEIT MATCH')).toBeDefined();
  });

  it('does not show forfeit button when phase is not ACTIVE', () => {
    const onForfeit = vi.fn();
    render(<BattleHUD {...defaultProps} phase="PREP" onForfeit={onForfeit} />);
    expect(screen.queryByText('FORFEIT MATCH')).toBeNull();
  });

  it('calls onForfeit when forfeit button is clicked', () => {
    const onForfeit = vi.fn();
    render(<BattleHUD {...defaultProps} onForfeit={onForfeit} />);
    fireEvent.click(screen.getByText('FORFEIT MATCH'));
    expect(onForfeit).toHaveBeenCalledOnce();
  });

  it('does not show forfeit button when onForfeit not provided', () => {
    render(<BattleHUD {...defaultProps} />);
    expect(screen.queryByText('FORFEIT MATCH')).toBeNull();
  });

  it('displays hater heat for both participants', () => {
    render(<BattleHUD {...defaultProps} />);
    expect(screen.getByText('Heat: 12')).toBeDefined();
    expect(screen.getByText('Heat: 8')).toBeDefined();
  });
});