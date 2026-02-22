/**
 * VerificationNotifier service for handling notifications related to user account verification.
 */

import { Injectable } from '@nestjs/common';
import { Notification, NotificationType } from './notification.interface';

/**
 * VerificationNotifier service interface.
 */
export interface VerificationNotifierService {
  sendPendingConfirmationNotification(userId: number): Promise<void>;
  sendVerifiedCelebrationNotification(userId: number): Promise<void>;
  sendQuarantinedNotification(userId: number): Promise<void>;
}

/**
 * VerificationNotifier service implementation.
 */
@Injectable()
export class VerificationNotifierService implements VerificationNotifierService {
  async sendPendingConfirmationNotification(userId: number) {
    // Implement sending a notification with PENDING confirmation and ETA.
  }

  async sendVerifiedCelebrationNotification(userId: number) {
    // Implement sending a 'Stamped. Your run is now official.' celebration push.
  }

  async sendQuarantinedNotification(userId: number) {
    // Implement sending a non-accusatory QUARANTINED notification.
  }
}
