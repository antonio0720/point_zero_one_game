import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Ban, BanDocument } from './schemas/ban.schema';
import { Appeal, AppealDocument } from './schemas/appeal.schema';

@Injectable()
export class AppealsService {
constructor(
@InjectModel(Ban.name) private banModel: Model<BanDocument>,
@InjectModel(Appeal.name) private appealModel: Model<AppealDocument>,
) {}

async createAppeal(userId: string, reason: string): Promise<Appeal> {
const appeal = new this.appealModel({ userId, reason });
return appeal.save();
}

async getUserAppeals(userId: string): Promise<Appeal[]> {
return this.appealModel.find({ userId }).exec();
}

async reviewAppeal(appealId: string, decision: 'accept' | 'deny', moderatorId: string): Promise<void> {
const appeal = await this.appealModel.findById(appealId);

if (!appeal) throw new Error('Appeal not found');

if (appeal.moderatorId) throw new Error('Appeal already reviewed');

appeal.moderatorId = moderatorId;
await appeal.save();

// If the decision is 'accept', unban the user
if (decision === 'accept') {
const ban = await this.banModel.findOne({ userId });
if (ban) await ban.remove();
}
}
}
