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
const newAppeal = new this.appealModel({ userId, reason });
return newAppeal.save();
}

async updateBanStatus(banId: string, status: boolean): Promise<void> {
await this.banModel.findByIdAndUpdate(banId, { status });
}

async reviewAppeal(appealId: string, decision: boolean): Promise<void> {
const appeal = await this.appealModel.findById(appealId);
if (decision) {
await this.updateBanStatus(appeal.banId, false);
await this.appealModel.findByIdAndRemove(appealId);
} else {
// You can consider adding a reason for the rejection or further actions here
}
}
}
