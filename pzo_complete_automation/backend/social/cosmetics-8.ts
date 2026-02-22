import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LeaderboardDocument, Leaderboard } from './schemas/leaderboard.schema';

@Injectable()
export class LeaderboardsService {
constructor(
@InjectModel(Leaderboard.name) private leaderboardModel: Model<LeaderboardDocument>,
) {}

async createLeaderboard(name: string): Promise<Leaderboard> {
const newLeaderboard = new this.leaderboardModel({ name });
return newLeaderboard.save();
}

async getLeaderboards(): Promise<Leaderboard[]> {
return this.leaderboardModel.find().exec();
}

async getLeaderboard(id: string): Promise<Leaderboard | null> {
return this.leaderboardModel.findById(id).exec();
}

async updateLeaderboard(id: string, updates: Partial<Leaderboard>): Promise<Leaderboard | null> {
return this.leaderboardModel.findByIdAndUpdate(id, updates, { new: true }).exec();
}
}
