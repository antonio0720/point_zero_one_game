import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CohortAnalysisDto, User } from './interfaces';

interface CohortAnalysisDocument extends Document, CohortAnalysisDto {}

@Injectable()
export class CohortAnalysisService {
constructor(
@InjectModel('CohortAnalysis')
private cohortAnalysisModel: Model<CohortAnalysisDocument>,
) {}

async create(cohortAnalysis: CohortAnalysisDto): Promise<CohortAnalysisDto> {
const createdCohortAnalysis = new this.cohortAnalysisModel(cohortAnalysis);
return createdCohortAnalysis.save();
}

async findOne(id: string): Promise<CohortAnalysisDto | null> {
return this.cohortAnalysisModel.findById(id).exec();
}

async findAll(): Promise<Array<CohortAnalysisDto>> {
return this.cohortAnalysisModel.find().exec();
}

async update(id: string, updates: Partial<CohortAnalysisDto>): Promise<CohortAnalysisDto | null> {
return this.cohortAnalysisModel.findByIdAndUpdate(id, updates, { new: true }).exec();
}

async delete(id: string): Promise<CohortAnalysisDto | null> {
const deletedCohortAnalysis = await this.cohortAnalysisModel.findByIdAndDelete(id).exec();
return deletedCohortAnalysis;
}

async calculateRetentionRate(userId: Types.ObjectId, startDate: Date, endDate: Date): Promise<number> {
const activeUsersQuery = await this.cohortAnalysisModel.findOne({ cohortDate: startDate });
if (!activeUsersQuery) {
throw new Error('No active users found for the given start date.');
}

const activeUsersCount = activeUsersQuery.activeUserCount;
const retainedUsersQuery = await this.cohortAnalysisModel.countDocuments({
cohortDate: startDate,
lastActiveDate: { $gte: endDate },
userId,
});

if (retainedUsersQuery === 0 && activeUsersCount === 0) {
return 1; // No user churn if there are no active users in the first place
}

const retainedUserPercentage = (retainedUsersQuery / activeUsersCount) * 100;
return Number(retainedUserPercentage.toFixed(2));
}
}
