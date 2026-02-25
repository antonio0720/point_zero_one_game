/**
 * Streak Service for Point Zero One Digital's financial roguelike game.
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Document } from 'mongoose';
import { StreakDocument } from './streak.schema';

/**
 * Streak Interface representing the structure of a streak in the game's database.
 */
export interface IStreak extends Document {
  userId: string;
  startDate: Date;
  currentStreak: number;
  longestStreak: number;
  gracePeriod: number;
  earnedFreezes: number;
  evolutionTriggers: number[];
}

/**
 * Streak Service class for managing streaks in the game.
 */
@Injectable()
export class StreakService {
  constructor(@InjectModel('Streak') private readonly streakModel: Model<IStreak>) {}

  /**
   * Finds a streak by user ID and updates it with the provided data.
   * @param userId The ID of the user whose streak to update.
   * @param data The new data for the streak.
   */
  async updateStreak(userId: string, data: Partial<IStreak>): Promise<IStreak> {
    const streak = await this.streakModel.findOneAndUpdate({ userId }, data, { new: true });
    if (!streak) throw new Error('Streak not found');
    return streak;
  }
}

/**
 * Streak Schema for defining the structure of a streak in MongoDB.
 */
const StreakSchema = new Mongoose.Schema<IStreak>({
  userId: { type: String, required: true },
  startDate: { type: Date, required: true },
  currentStreak: { type: Number, default: 0 },
  longestStreak: { type: Number, default: 0 },
  gracePeriod: { type: Number, default: 0 },
  earnedFreezes: { type: Number, default: 0 },
  evolutionTriggers: [{ type: Number }],
});

/**
 * Indexes for the Streak collection in MongoDB.
 */
StreakSchema.index({ userId: 1 });
StreakSchema.index({ startDate: 1 });

export default StreakSchema;
```

SQL, Bash, YAML/JSON, and Terraform code are not required for this specific task.
