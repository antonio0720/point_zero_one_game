import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Document } from 'mongoose';

export interface MetricDocument extends Document {
name: string;
description: string;
}

@Injectable()
export class MetricsModelsService {
constructor(
@InjectModel('Metric') private metricModel: Model<MetricDocument>,
) {}

async create(metric: any): Promise<MetricDocument> {
return this.metricModel.create(metric);
}

async findAll(): Promise<MetricDocument[]> {
return this.metricModel.find().exec();
}

async findOne(id: string): Promise<MetricDocument | null> {
return this.metricModel.findById(id).exec();
}

async update(id: string, updates: any): Promise<MetricDocument | null> {
return this.metricModel.findByIdAndUpdate(id, updates, { new: true }).exec();
}

async remove(id: string): Promise<MetricDocument | null> {
const metric = await this.findOne(id);
if (metric) {
return metric.remove().exec();
}
return null;
}
}
