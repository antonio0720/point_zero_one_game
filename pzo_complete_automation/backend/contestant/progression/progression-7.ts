import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Contestant, ContestantDocument } from '../contestants/schemas/contestant.schema';

@Injectable()
export class Progression7Service {
constructor(
@InjectModel(Contestant.name) private contestantModel: Model<ContestantDocument>,
) {}

async updateProgression7(contestantId: string, data: any): Promise<ContestantDocument> {
const contestant = await this.contestantModel.findOneAndUpdate(
{ _id: contestantId },
{ progression7: data },
{ new: true },
);

if (!contestant) {
throw new Error('Contestant not found');
}

return contestant;
}
}
