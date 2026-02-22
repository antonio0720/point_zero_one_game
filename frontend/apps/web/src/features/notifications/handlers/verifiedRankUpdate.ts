/**
 * Handles deep-linking into Verified leaderboard entry.
 */

import { NotificationHandler, NotificationPayload } from '@pointzeroonedigital/notifications';
import { VerifiedRank } from '../../models/VerifiedRank';
import { db } from '../../database';

/**
 * Deep-links into the specified Verified leaderboard entry.
 */
export class VerifiedRankUpdateHandler implements NotificationHandler {
  public readonly type = 'verified_rank_update';

  async handle(payload: NotificationPayload): Promise<void> {
    const { rankId } = payload;

    // Fetch the specified Verified leaderboard entry.
    const verifiedRank = await VerifiedRank.findOne({ where: { id: rankId }, include: [{ model: db.User, as: 'user' }] });

    if (!verifiedRank) {
      throw new Error(`No Verified rank found with ID ${rankId}`);
    }

    // Deep-link into the Verified leaderboard entry.
    window.location.href = `/verified/${verifiedRank.id}`;
  }
}
