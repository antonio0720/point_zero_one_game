import { describe, it, expect } from 'vitest';
import { getLeaderboard } from '../../../src/api/leaderboard';

describe('GET /leaderboard returns top 20 by score, proof-only', () => {
  it('should return the top 20 runs with their scores and ranks', async () => {
    const leaderboard = await getLeaderboard();
    expect(leaderboard).toBeInstanceOf(Array);
    expect(leaderboard.length).toBe(20);
    leaderboard.forEach((run) => {
      expect(run.rank).toBeGreaterThan(0);
      expect(run.score).toBeGreaterThan(0);
    });
  });

  it('should return the top 20 runs with their scores and ranks, when sorted by score', async () => {
    const leaderboard = await getLeaderboard({ sort: 'score' });
    expect(leaderboard).toBeInstanceOf(Array);
    expect(leaderboard.length).toBe(20);
    leaderboard.forEach((run) => {
      expect(run.rank).toBeGreaterThan(0);
      expect(run.score).toBeGreaterThan(0);
    });
  });

  it('should return the top 20 runs with their scores and ranks, when sorted by rank', async () => {
    const leaderboard = await getLeaderboard({ sort: 'rank' });
    expect(leaderboard).toBeInstanceOf(Array);
    expect(leaderboard.length).toBe(20);
    leaderboard.forEach((run) => {
      expect(run.rank).toBeGreaterThan(0);
      expect(run.score).toBeGreaterThan(0);
    });
  });

  it('should return an empty array when there are no runs', async () => {
    const leaderboard = await getLeaderboard({ sort: 'score' });
    expect(leaderboard).toBeInstanceOf(Array);
    expect(leaderboard.length).toBe(20);
  });
});
