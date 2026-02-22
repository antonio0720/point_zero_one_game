import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Run, RunDocument } from './schemas/run.schema';

@Injectable()
export class RunsService {
constructor(
@InjectModel(Run.name) private readonly runModel: Model<RunDocument>,
) {}

async create(createRunDto: any): Promise<Run> {
const createdRun = new this.runModel(createRunDto);
return createdRun.save();
}
}
