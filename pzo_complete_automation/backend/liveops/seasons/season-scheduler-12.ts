import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Document } from 'mongoose';
import { Season, SeasonDocument } from './schemas/season.schema';
import { ScheduledSeasonDocument, ScheduledSeason } from './schemas/scheduled-season.schema';

@Injectable()
export class SeasonSchedulerService {
constructor(
@InjectModel(Season.name) private readonly seasonModel: Model<Document>,
@InjectModel(ScheduledSeason.name) private readonly scheduledSeasonModel: Model<Document>
) {}

async createScheduledSeason(seasonId: string): Promise<ScheduledSeasonDocument> {
const season = await this.seasonModel.findById(seasonId);
if (!season) {
throw new Error('Season not found');
}

const scheduledSeason = new this.scheduledSeasonModel({ season });
return await scheduledSeason.save();
}

async listScheduledSeasons(): Promise<ScheduledSeasonDocument[]> {
return this.scheduledSeasonModel.find().exec();
}
}
