/**
 * Experiment Registry and Allocation Engine for Point Zero One Digital's financial roguelike game.
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Document } from 'mongoose';
import { ExperimentDocument } from './schemas/experiment.schema';

/**
 * Experiment document interface.
 */
export interface IExperiment extends Document {
  id: string;
  name: string;
  description: string;
  startDate: Date;
  endDate: Date;
  status: 'active' | 'completed' | 'failed';
}

/**
 * Experiment model.
 */
export type ExperimentModel = Model<IExperiment>;

/**
 * Experiment service interface.
 */
export interface IExperimentService {
  createExperiment(name: string, description: string, startDate: Date, endDate: Date): Promise<IExperiment>;
  getActiveExperiments(): Promise<IExperiment[]>;
  updateExperimentStatus(id: string, status: 'completed' | 'failed'): Promise<void>;
}

/**
 * Experiment service implementation.
 */
@Injectable()
export class ExperimentService implements IExperimentService {
  constructor(@InjectModel('Experiment') private readonly experimentModel: ExperimentModel) {}

  async createExperiment(name: string, description: string, startDate: Date, endDate: Date): Promise<IExperiment> {
    const newExperiment = await this.experimentModel.create({ name, description, startDate, endDate, status: 'active' });
    return newExperiment;
  }

  async getActiveExperiments(): Promise<IExperiment[]> {
    return this.experimentModel.find({ status: 'active' }).exec();
  }

  async updateExperimentStatus(id: string, status: 'completed' | 'failed'): Promise<void> {
    await this.experimentModel.findOneAndUpdate({ id }, { status });
  }
}


