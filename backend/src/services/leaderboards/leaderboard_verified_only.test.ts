import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Leaderboard Verified Only', () => {
  let leaderboardService;

  beforeEach(() => {
    leaderboardService = new LeaderboardVerifiedOnlyService();
  });

  afterEach(() => {
    // Reset any state or data that needs to be reset between tests
  });

  it('should return only verified users when filtering the leaderboard', () => {
    const leaderboardData = [
      { id: 1, username: 'user1', isVerified: true, score: 100 },
      { id: 2, username: 'user2', isVerified: false, score: 200 },
      { id: 3, username: 'user3', isVerified: true, score: 300 }
    ];

    const filteredLeaderboard = leaderboardService.filter(leaderboardData);

    expect(filteredLeaderboard).toEqual([
      { id: 1, username: 'user1', isVerified: true, score: 100 },
      { id: 3, username: 'user3', isVerified: true, score: 300 }
    ]);
  });

  it('should remove quarantined users from the leaderboard when filtering', () => {
    const leaderboardData = [
      { id: 1, username: 'user1', isVerified: true, score: 100 },
      { id: 2, username: 'user2', isQuarantined: true, score: 200 },
      { id: 3, username: 'user3', isVerified: true, score: 300 }
    ];

    const filteredLeaderboard = leaderboardService.filter(leaderboardData);

    expect(filteredLeaderboard).toEqual([
      { id: 1, username: 'user1', isVerified: true, score: 100 },
      { id: 3, username: 'user3', isVerified: true, score: 300 }
    ]);
  });

  it('should reinstate a user on the leaderboard after an appeal has been resolved', () => {
    const leaderboardData = [
      { id: 1, username: 'user1', isVerified: true, score: 100 },
      { id: 2, username: 'user2', isQuarantined: true, score: 200 },
      { id: 3, username: 'user3', isVerified: true, score: 300 }
    ];

    // Simulate a resolved appeal for user2
    leaderboardData[1].isQuarantined = false;

    const filteredLeaderboard = leaderboardService.filter(leaderboardData);

    expect(filteredLeaderboard).toEqual([
      { id: 1, username: 'user1', isVerified: true, score: 100 },
      { id: 2, username: 'user2', isQuarantined: false, score: 200 },
      { id: 3, username: 'user3', isVerified: true, score: 300 }
    ]);
  });

  it('should handle empty leaderboard correctly', () => {
    const filteredLeaderboard = leaderboardService.filter([]);
    expect(filteredLeaderboard).toEqual([]);
  });

  it('should handle null leaderboard correctly', () => {
    const filteredLeaderboard = leaderboardService.filter(null);
    expect(filteredLeaderboard).toEqual(null);
  });

  it('should handle undefined leaderboard correctly', () => {
    const filteredLeaderboard = leaderboardService.filter(undefined);
    expect(filteredLeaderboard).toEqual(undefined);
  });
});
