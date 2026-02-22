import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RolloutDashboard, RolloutDashboardDocument } from './schemas/rollout-dashboard.schema';

@Injectable()
export class RolloutDashboardsService {
constructor(
@InjectModel(RolloutDashboard.name) private readonly rolloutDashboardModel: Model<RolloutDashboardDocument>,
) {}

async createRolloutDashboard(rolloutDashboardData: any): Promise<RolloutDashboardDocument> {
const newRolloutDashboard = new this.rolloutDashboardModel(rolloutDashboardData);
return newRolloutDashboard.save();
}

async findOneRolloutDashboardById(id: string): Promise<RolloutDashboardDocument | null> {
return this.rolloutDashboardModel.findOne({ _id: id }).exec();
}

async updateRolloutDashboardById(id: string, updates: any): Promise<RolloutDashboardDocument | null> {
return this.rolloutDashboardModel.findOneAndUpdate({ _id: id }, updates, { new: true }).exec();
}

async deleteRolloutDashboardById(id: string): Promise<RolloutDashboardDocument | null> {
const rolloutDashboard = await this.rolloutDashboardModel.findOneAndDelete({ _id: id }).exec();
return rolloutDashboard;
}
}
