import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Document, Schema, Types } from 'mongoose';

export type FeatureRestrictionDocument = FeatureRestriction & Document;

@Injectable()
export class FeatureRestrictionsService {
constructor(
@InjectModel('FeatureRestriction')
private featureRestrictionModel: Model<FeatureRestrictionDocument>,
) {}

async create(restriction: Partial<FeatureRestrictionDocument>) {
return this.featureRestrictionModel.create(restriction);
}

async findById(id: string): Promise<FeatureRestrictionDocument | null> {
return this.featureRestrictionModel.findById(id).exec();
}

async findByUser(userId: string): Promise<FeatureRestrictionDocument[]> {
return this.featureRestrictionModel.find({ user: userId }).exec();
}
}

export const featureRestrictionSchema = new Schema({
user: { type: Types.ObjectId, ref: 'User', required: true },
features: [
{
featureName: { type: String, required: true },
allowed: { type: Boolean, default: false },
},
],
});

export interface FeatureRestriction {
user: string;
features: { featureName: string; allowed: boolean }[];
}
