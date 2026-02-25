/**
 * Notification service for handling verified rank updates.
 */

import { Notification, NotificationRepository } from '../notifications';

/**
 * Verified Rank Update Notification implementation.
 */
export class VerifiedRankUpdatesImpl implements Notification {
  private readonly notificationRepository: NotificationRepository;

  /**
   * Create a new instance of the VerifiedRankUpdatesImpl class.
   * @param notificationRepository The repository for storing notifications.
   */
  constructor(notificationRepository: NotificationRepository) {
    this.notificationRepository = notificationRepository;
  }

  /**
   * Publish a verified rank update notification.
   * @param userId The ID of the user who has been ranked up.
   * @param newRank The new rank of the user.
   */
  public async publish(userId: number, newRank: number): Promise<void> {
    const notification = new Notification('Verified ✅ — you're now #', userId, newRank);
    await this.notificationRepository.save(notification);
  }
}


