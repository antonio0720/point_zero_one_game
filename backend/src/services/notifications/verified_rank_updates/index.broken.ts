/**
 * Notify user when verified run is published with final rank placement
 */

import axios from 'axios';
import { UserNotification } from '../user-notifications/UserNotification';

export class VerifiedRankUpdatesService {
  private readonly apiUrl = 'https://api.pointzeroonedigital.com/v1/rankings';

  public async notifyUser(userId: number, runId: string): Promise<void> {
    const response = await axios.get(`${this.apiUrl}/${runId}`);
    const rankPlacement = response.data.rankPlacement;

    if (rankPlacement) {
      const userNotification = new UserNotification();
      userNotification.send(userId, `Your verified run #${runId} has been published with a final rank placement of ${rankPlacement}`);
    }
  }
}

/**
 * Represents a user notification
 */
export class UserNotification {
  private readonly apiUrl = 'https://api.pointzeroonedigital.com/v1/notifications';

  public async send(userId: number, message: string): Promise<void> {
    await axios.post(`${this.apiUrl}/${userId}`, { message });
  }
}
