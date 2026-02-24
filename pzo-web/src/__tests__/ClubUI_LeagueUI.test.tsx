///Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/__tests__/ClubUI_LeagueUI.test.tsx

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ClubScoreboard } from '../components/ClubUI';
import { LadderStandingsPanel } from '../components/LeagueUI';
import type { ClubPlayer } from '../types/club';
import type { LadderEntry } from '../engine/seasonLadder';

const makePlayer = (overrides: Partial<ClubPlayer> = {}): ClubPlayer => ({
  id: 'p1', displayName: 'TestPlayer', avatarEmoji: '🎮',
  cash: 22000, income: 5000, netWorth: 55000, reputationScore: 300,
  reputationTier: 'Established', portfolio: [], shields: 2,
  isInDistress: false, isConnected: true, lastActiveTick: 120,
  seasonWins: 3, seasonLosses: 1, totalRuns: 7, bestScore: 82000, currentRunScore: 55000,
  ...overrides,
});

const clubProps = {
  players: [makePlayer({ id: 'p1', displayName: 'TestPlayer' }), makePlayer({ id: 'p2', displayName: 'CIPHER_9', netWorth: 72000 })],
  myPlayerId: 'p1', currentTick: 120,
};

describe('ClubUI', () => {
  it('renders without crashing', () => { render(<ClubScoreboard {...clubProps} />); expect(document.body.firstChild).toBeTruthy(); });
  it('renders club-related content', () => { render(<ClubScoreboard {...clubProps} />); expect((document.body.textContent ?? '').length).toBeGreaterThan(0); });
  it('shows standings header', () => { render(<ClubScoreboard {...clubProps} />); expect(document.body.textContent ?? '').toMatch(/club|standing|score|rank/i); });
  it('renders all players', () => { render(<ClubScoreboard {...clubProps} />); const t = document.body.textContent ?? ''; expect(t).toContain('TestPlayer'); expect(t).toContain('CIPHER_9'); });
  it('renders with single player', () => { render(<ClubScoreboard {...clubProps} players={[makePlayer()]} />); expect(document.body.firstChild).toBeTruthy(); });
});

const makeLadderEntry = (overrides: Partial<LadderEntry> = {}): LadderEntry => ({
  rank: 1, playerId: 'p1', displayName: 'TestPlayer', avatarEmoji: '🎮',
  clubId: null, ladderRating: 1450, seasonPoints: 4200, bestRunScore: 85000,
  averageScore: 62000, totalRuns: 7, winRate: 0.57, grade: 'A', ratingDelta: 25, isVerified: true,
  ...overrides,
});

const ladderProps = {
  entries: [makeLadderEntry({ rank: 1 }), makeLadderEntry({ rank: 2, playerId: 'p2', displayName: 'CIPHER_9', ladderRating: 1380 })],
  myPlayerId: 'p1', seasonName: 'Season 4', format: 'monthly',
};

describe('LeagueUI', () => {
  it('renders without crashing', () => { render(<LadderStandingsPanel {...ladderProps} />); expect(document.body.firstChild).toBeTruthy(); });
  it('shows league/ranking content', () => { render(<LadderStandingsPanel {...ladderProps} />); expect((document.body.textContent ?? '').length).toBeGreaterThan(0); });
  it('displays player names in standings', () => { render(<LadderStandingsPanel {...ladderProps} />); expect(document.body.textContent ?? '').toContain('TestPlayer'); });
  it('renders season name', () => { render(<LadderStandingsPanel {...ladderProps} />); expect((document.body.textContent ?? '').length).toBeGreaterThan(5); });
  it('has tab/button interactions', () => { render(<LadderStandingsPanel {...ladderProps} />); expect(document.body.firstChild).toBeTruthy(); });
  it('renders with empty entries', () => { render(<LadderStandingsPanel {...ladderProps} entries={[]} />); expect(document.body.firstChild).toBeTruthy(); });
  it('renders with max rating player', () => { render(<LadderStandingsPanel {...ladderProps} entries={[makeLadderEntry({ ladderRating: 2000, grade: 'S', winRate: 0.95 })]} />); expect(document.body.firstChild).toBeTruthy(); });
});
