import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Document, Schema, Types } from 'mongoose';
import * as _ from 'lodash';

export interface ReferralDocument extends Document {
userId: Types.ObjectId;
referredByUserId: Types.ObjectId;
reward: number;
}

const referralSchema = new Schema({
userId: { type: Schema.Types.ObjectId, required: true },
referredByUserId: { type: Schema.Types.ObjectId, required: true },
reward: { type: Number, default: 0 },
});

@Injectable()
export class ReferralService {
constructor(
@InjectModel('Referral') private readonly referralModel: Model<ReferralDocument>,
) {}

async createReferral(userId: Types.ObjectId, referredByUserId: Types.ObjectId) {
const newReferral = await this.referralModel.create({ userId, referredByUserId });
return newReferral;
}

async updateReferralReward(userId: Types.ObjectId, reward: number) {
const referral = await this.referralModel.findOneAndUpdate(
{ userId },
{ reward },
{ new: true },
);
return referral;
}

async findReferralsByUserId(userId: Types.ObjectId) {
const referrals = await this.referralModel.find({ referredByUserId: userId });
return referrals;
}
}
