import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Arbitrator, ArbitratorDocument } from './arbitrator.schema';
import { CreateArbitratorDto } from './dto/create-arbitrator.dto';

@Injectable()
export class ArbitrationService {
constructor(
@InjectModel(Arbitrator.name) private arbitratorModel: Model<ArbitratorDocument>,
) {}

async create(createArbitratorDto: CreateArbitratorDto): Promise<Arbitrator> {
const createdArbitrator = new this.arbitratorModel(createArbitratorDto);
return createdArbitrator.save();
}

findAll(): Promise<Arbitrator[]> {
return this.arbitratorModel.find().exec();
}

findOne(id: string): Promise<Arbitrator> {
return this.arbitratorModel.findById(id).exec();
}

async update(id: string, updates: Partial<CreateArbitratorDto>): Promise<Arbitrator> {
const arbitrator = await this.findOne(id);

if (!arbitrator) throw new Error('Arbitrator not found');

Object.assign(arbitrator, updates);
return arbitrator.save();
}

async remove(id: string): Promise<Arbitrator> {
const arbitrator = await this.findOne(id);

if (!arbitrator) throw new Error('Arbitrator not found');

return arbitrator.remove();
}
}
