/**
 * Verification Health Alerts Service
 */

import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AlertDocument, Alert } from './alerts.schema';

/**
 * Alert Schema
 */
@Injectable()
export class AlertsService {
  constructor(
    @InjectModel(Alert.name) private readonly alertModel: Model<AlertDocument>,
  ) {}

  /**
   * Check for verification latency regressions and quarantine spikes
   */
  @Cron(CronExpression.EVERY_HOUR)
  async checkHealth() {
    const alerts = await this.alertModel.find({ type: 'health' }).exec();

    // Check for verification latency regressions
    const latestVerificationLatencies = await this.getLatestVerificationLatencies();
    const regressionThreshold = 50; // Adjustable threshold in milliseconds
    alerts.forEach((alert) => {
      if (
        alert.data.verificationLatency &&
        latestVerificationLatencies[alert.gameId] > alert.data.verificationLatency + regressionThreshold
      ) {
        this.createAlert(alert.gameId, 'Verification Latency Regression', `Current verification latency: ${latestVerificationLatencies[alert.gameId]}ms`);
      }
    });

    // Check for quarantine spikes
    const maxQuarantineCount = 10; // Adjustable maximum number of games in quarantine
    alerts.forEach((alert) => {
      if (alert.data.quarantineCount && alert.data.quarantineCount > maxQuarantineCount) {
        this.createAlert(alert.gameId, 'Quarantine Spike', `Current number of games in quarantine: ${alert.data.quarantineCount}`);
      }
    });
  }

  /**
   * Get the latest verification latencies for each game
   */
  private async getLatestVerificationLatencies() {
    // Implementation details omitted for brevity
  }

  /**
   * Create a new alert for the specified game and message
   */
  private createAlert(gameId: string, type: string, message: string) {
    const newAlert = new this.alertModel({
      gameId,
      type,
      data: {
        verificationLatency: null,
        quarantineCount: null,
      },
      runbookLink: 'https://runbook.pointzeroonedigital.com/financial-roguelike-game-health-issues',
    });

    newAlert.save();
  }
}

/**
 * Alert Schema
 */
export const AlertSchema = new Mongoose.Schema({
  gameId: { type: String, required: true },
  type: { type: String, enum: ['health'], required: true },
  data: {
    verificationLatency: Number,
    quarantineCount: Number,
  },
  runbookLink: { type: String, default: 'https://runbook.pointzeroonedigital.com/financial-roguelike-game-health-issues' },
});
