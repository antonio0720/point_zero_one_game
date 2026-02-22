import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { VerifiedRankUpdatesService } from '../../services/notifications/verified_rank_updates/verified_rank_updates.service';
import { Notification } from '../../interfaces/notification.interface';
import { User } from '../../interfaces/user.interface';
import { Rank } from '../../enums/rank.enum';

let service: VerifiedRankUpdatesService;
let user1: User;
let user2: User;

beforeEach(() => {
  service = new VerifiedRankUpdatesService();
  user1 = { id: 1, rank: Rank.Unverified };
  user2 = { id: 2, rank: Rank.Unverified };
});

afterEach(() => {
  // Reset any state needed for the next test
});

describe('VerifiedRankUpdatesService - Single Notification per Published Entry', () => {
  it('should handle a single user rank update', () => {
    const notification: Notification = service.handleRankUpdate(user1);
    expect(notification).not.toBeNull();
    expect(user1.rank).toEqual(Rank.Verified);
  });

  it('should not send a notification if the user is already verified', () => {
    user1.rank = Rank.Verified;
    const notification: Notification | null = service.handleRankUpdate(user1);
    expect(notification).toBeNull();
  });

  it('should handle multiple users with different rank updates', () => {
    const notifications: Notification[] = service.handleRankUpdates([user1, user2]);
    expect(notifications.length).toEqual(2);
    expect(user1.rank).toEqual(Rank.Verified);
    expect(user2.rank).toEqual(Rank.Unverified);
  });

  it('should not send duplicate notifications for the same user', () => {
    service.handleRankUpdate(user1);
    const notification: Notification | null = service.handleRankUpdate(user1);
    expect(notification).toBeNull();
  });

  it('should handle a user rank update after being verified', () => {
    user1.rank = Rank.Verified;
    service.handleRankUpdate(user1); // No notification sent since user is already verified

    user1.rank = Rank.Unverified;
    const notification: Notification = service.handleRankUpdate(user1);
    expect(notification).not.toBeNull();
    expect(user1.rank).toEqual(Rank.Verified);
  });
});
