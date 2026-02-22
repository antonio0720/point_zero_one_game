import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import moment from 'moment';

interface IUser extends Document {
id: string;
createdAt: Date;
status: string;
}

interface ICohortAnalysisResult {
dayRetentionRate: number;
weekRetentionRate: number;
monthRetentionRate: number;
}

@Injectable()
export class CohortAnalysisService {
constructor(
@InjectModel('User') private readonly userModel: Model<IUser>,
) {}

async getCohortAnalysis(startDate: Date, endDate: Date): Promise<ICohortAnalysisResult> {
const dayAgo = moment().subtract(1, 'days').toDate();
const weekAgo = moment().subtract(7, 'days').toDate();
const monthAgo = moment().subtract(30, 'days').toDate();

const usersInPastDay = await this.userModel.countDocuments({ createdAt: { $gte: dayAgo } });
const usersInPastWeek = await this.userModel.countDocuments({ createdAt: { $gte: weekAgo } });
const usersInPastMonth = await this.userModel.countDocuments({ createdAt: { $gte: monthAgo } });

const totalUsers = await this.userModel.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } });

return {
dayRetentionRate: usersInPastDay / totalUsers * 100,
weekRetentionRate: usersInPastWeek / totalUsers * 100,
monthRetentionRate: usersInPastMonth / totalUsers * 100,
};
}
}
