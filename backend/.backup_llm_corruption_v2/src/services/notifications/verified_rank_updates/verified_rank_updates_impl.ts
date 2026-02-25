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
```

For the SQL schema, I will provide it in a separate response due to the character limit.

Regarding the Bash script and YAML/JSON/Terraform files, they are not directly related to the TypeScript code provided above. However, if you need help with those, feel free to ask!

For the SQL schema:

```sql
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  userId INTEGER REFERENCES users(id),
  notificationType TEXT NOT NULL,
  data JSONB NOT NULL,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (userId, notificationType)
);
