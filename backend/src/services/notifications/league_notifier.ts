/**
 * League Notifier Service
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LeagueDocument, League } from './league.schema';
import { UserDocument, User } from '../user/user.schema';
import { NotificationService } from '../notification/notification.service';
import { GameEvent } from '../../game-engine/game-event';
import { Replay } from '../../game-engine/replay';

/**
 * League Document Type
 */
export type LeagueType = LeagueDocument & {
  user: UserDocument;
}

@Injectable()
export class LeagueNotifierService {
  constructor(
    @InjectModel(League.name) private leagueModel: Model<LeagueType>,
    private notificationService: NotificationService,
  ) {}

  async notifyNewWeek(): Promise<void> {
    const leagues = await this.leagueModel.find({});
    leagues.forEach(async (league) => {
      this.notificationService.sendNotification(
        league.user._id,
        'New week, fresh ladder',
      );
    });
  }

  async notifyRankChange(userId: string, oldRank: number, newRank: number): Promise<void> {
    const user = await this.getUserById(userId);
    if (user) {
      const leagues = await this.leagueModel.find({ user: userId });
      leagues.forEach(async (league) => {
        const oldRankIndex = league.rankings.findIndex((rank) => rank.userId === userId && rank.rank === oldRank);
        if (oldRankIndex !== -1) {
          const newRankIndex = league.rankings.findIndex((rank) => rank.userId === userId && rank.rank === newRank);
          if (newRankIndex !== -1) {
            this.notificationService.sendNotification(
              userId,
              `Your rank has changed from ${oldRank} to ${newRank} in league "${league.name}"`,
            );
          }
        }
      });
    }
  }

  async notifySeasonEndingCountdown(seasonEndTimestamp: number): Promise<void> {
    const currentTime = new Date().getTime();
    const remainingDays = Math.floor((seasonEndTimestamp - currentTime) / (1000 * 60 * 60 * 24));
    if (remainingDays <= 7) {
      this.notificationService.sendCountdownNotification(7, 'Season ending in', seasonEndTimestamp);
    }
  }

  async notifyFounderNightReminder(): Promise<void> {
    // Implement logic to check if it's Founder Night and send reminders accordingly
  }

  async notifyGhostRunChallengeAvailable(replay: Replay): Promise<void> {
    const ghostRunReplay = replay.toJSON();
    ghostRunReplay.isGhostRun = true;
    const leagues = await this.leagueModel.find({});
    leagues.forEach(async (league) => {
      this.notificationService.sendNotification(
        league.user._id,
        `A new ghost run challenge is available! Check out the replay: ${JSON.stringify(ghostRunReplay)}`,
      );
    });
  }

  private async getUserById(userId: string): Promise<User | null> {
    return User.findOne({ _id: userId }).exec();
  }
}
