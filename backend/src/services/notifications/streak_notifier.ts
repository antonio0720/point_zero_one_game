/**
 * Notification service for handling streak notifications in Point Zero One Digital's financial roguelike game.
 */

import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { StreakDocument } from './streak.model';

/**
 * Streak Document Interface representing the structure of a streak document in MongoDB.
 */
export interface IStreakDocument extends StreakDocument {}

/**
 * Streak Notifier Service class for handling streak notifications.
 */
@Injectable()
export class StreakNotifierService {
  constructor(
    @InjectModel('Streak') private readonly streakModel: Model<IStreakDocument>,
  ) {}

  /**
   * Daily streak reminder notification at a configurable time.
   */
  @Cron(CronExpression.EVERY_DAY)
  async dailyStreakReminder() {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const streaks = await this.streakModel.find({ startDate: startOfDay });

    for (const streak of streaks) {
      if (!streak.endDate && streak.currentStreak < 7) {
        // Send daily streak reminder notification
      }
    }
  }

  /**
   * Streak at risk notification when 23 hours have elapsed since the last activity.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async streakAtRisk() {
    const now = new Date();
    const twentyThreeHoursAgo = new Date(now.getTime() - 23 * 60 * 60 * 1000);

    const streaks = await this.streakModel.find({ lastActivity: { $gt: twentyThreeHoursAgo } });

    for (const streak of streaks) {
      if (!streak.endDate && streak.currentStreak >= 7) {
        // Send streak at risk notification
      }
    }
  }

  /**
   * Streak broken notification and offer a recovery path when the streak is broken.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async streakBroken() {
    const now = new Date();
    const twentyThreeHoursAgo = new Date(now.getTime() - 23 * 60 * 60 * 1000);

    const streaks = await this.streakModel.find({ lastActivity: { $gt: twentyThreeHoursAgo }, endDate: null });

    for (const streak of streaks) {
      if (!streak.endDate && !streak.recoveryPath && streak.currentStreak >= 7) {
        // Send streak broken notification and offer a recovery path
      }
    }
  }

  /**
   * Milestone celebrations for 7-day, 30-day, and 100-day streaks.
   */
  @Cron(CronExpression.EVERY_DAY)
  async milestoneCelebration() {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const streaks = await this.streakModel.find({ startDate: startOfDay });

    for (const streak of streaks) {
      if (streak.currentStreak === 7) {
        // Send 7-day milestone celebration notification
      } else if (streak.currentStreak === 30) {
        // Send 30-day milestone celebration notification
      } else if (streak.currentStreak === 100) {
        // Send 100-day milestone celebration notification
      }
    }
  }
}
