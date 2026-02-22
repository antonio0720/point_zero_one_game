import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Season, SeasonDocument } from './schemas/season.schema';

@Injectable()
export class SeasonSchedulerService {
constructor(
@InjectModel(Season.name) private readonly seasonModel: Model<SeasonDocument>,
) {}

async getNextSeason(): Promise<Season | null> {
const seasons = await this.seasonModel.find({}).sort({ startDate: 1 });
if (!seasons.length) return null;
const currentSeasonIndex = seasons.findIndex(
(s) => s.startDate <= new Date() && s.endDate >= new Date(),
);
if (currentSeasonIndex === seasons.length - 1) {
throw new NotFoundException('Current season has ended.');
}
return seasons[currentSeasonIndex + 1];
}
}
