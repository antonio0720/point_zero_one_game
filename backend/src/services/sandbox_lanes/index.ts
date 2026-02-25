/**
 * Sandbox lanes distribution service
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Document } from 'mongoose';
import { SandboxLaneDocument } from './sandbox-lane.schema';
import { SandboxLaneCreateDto } from './dto/sandbox-lane.create.dto';

export interface SandboxLane extends Document {
  privateId: string;
  cohortId?: string;
  eventId?: string;
}

@Injectable()
export class SandboxLanesService {
  constructor(
    @InjectModel('SandboxLane') private readonly sandboxLaneModel: Model<SandboxLane>,
  ) {}

  async createPrivate(createDto: SandboxLaneCreateDto): Promise<SandboxLane> {
    const createdSandboxLane = new this.sandboxLaneModel({ ...createDto, cohortId: null, eventId: null });
    return createdSandboxLane.save();
  }

  async createCohort(privateId: string, cohortId: string): Promise<SandboxLane> {
    const sandboxLane = await this.sandboxLaneModel.findOneAndUpdate(
      { privateId },
      { $set: { privateId, cohortId, eventId: null } },
      { new: true },
    );

    if (!sandboxLane) {
      throw new Error('Sandbox lane not found');
    }

    return sandboxLane;
  }

  async createEvent(privateId: string, eventId: string): Promise<SandboxLane> {
    const sandboxLane = await this.sandboxLaneModel.findOneAndUpdate(
      { privateId },
      { $set: { privateId, cohortId: null, eventId } },
      { new: true },
    );

    if (!sandboxLane) {
      throw new Error('Sandbox lane not found');
    }

    return sandboxLane;
  }
}
