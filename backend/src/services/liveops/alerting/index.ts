/**
 * Alerting service for Point Zero One Digital's financial roguelike game.
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

/**
 * Alert document schema.
 */
export type AlertDocument = Omit<Alert, 'id'> & { id: string };

/**
 * Alert schema.
 */
export const alertSchema = new mongoose.Schema<AlertDocument>({
  gameId: { type: String, required: true },
  severity: { type: Number, enum: [1, 2, 3], required: true },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});
alertSchema.index({ gameId: 1, severity: 1, timestamp: -1 });

/**
 * Alert model.
 */
export const Alert = mongoose.model<AlertDocument>('Alert', alertSchema);

/**
 * Alerting service.
 */
@Injectable()
export class AlertingService {
  constructor(@InjectModel(Alert.name) private readonly alertModel: Model<AlertDocument>) {}

  /**
   * Create an alert for a given game with the specified severity and message.
   * @param gameId The ID of the game to which the alert pertains.
   * @param severity The severity level of the alert (1, 2, or 3).
   * @param message The text of the alert.
   */
  async createAlert(gameId: string, severity: number, message: string): Promise<AlertDocument> {
    const alert = new this.alertModel({ gameId, severity, message });
    return await alert.save();
  }
}
