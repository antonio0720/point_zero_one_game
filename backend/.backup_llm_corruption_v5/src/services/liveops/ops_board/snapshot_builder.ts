/**
 * Snapshot Builder Service for Point Zero One Digital's financial roguelike game.
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DailySnapshot, DailySnapshotDocument } from './schemas/daily-snapshot.schema';

/**
 * Interface for the daily snapshot document.
 */
export interface IDailySnapshot {
  date: Date;
  notes?: string;
  drilldownLinks?: string[];
}

/**
 * Service for building and storing daily snapshots of the ops board.
 */
@Injectable()
export class SnapshotBuilderService {
  constructor(
    @InjectModel(DailySnapshot.name) private readonly dailySnapshotModel: Model<DailySnapshotDocument>,
  ) {}

  /**
   * Builds a new daily snapshot object with the given data and saves it to the database.
   *
   * @param {IDailySnapshot} data - The data for the new daily snapshot.
   */
  async createSnapshot(data: IDailySnapshot): Promise<DailySnapshotDocument> {
    const snapshot = new this.dailySnapshotModel(data);
    return snapshot.save();
  }
}

/**
 * Mongoose schema for the daily snapshots collection.
 */
const DailySnapshotSchema = new mongoose.Schema<DailySnapshotDocument>({
  date: { type: Date, required: true },
  notes: String,
  drilldownLinks: [{ type: String }],
});

/**
 * Indexes and foreign keys for the daily snapshots collection.
 */
DailySnapshotSchema.index({ date: 1 });
DailySnapshotSchema.index({ 'drilldownLinks': 1 }, { sparse: true });

export default DailySnapshotSchema;

-- Create the daily_snapshots table if it doesn't exist
