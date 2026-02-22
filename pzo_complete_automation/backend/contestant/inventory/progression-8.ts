import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntitySubscription } from 'typeorm';
import { Contestant } from '../contestants/entities/contestant.entity';
import { Progression } from './entities/progression.entity';
import { CreateProgressionDto } from './dto/create-progression.dto';
import { UpdateProgressionDto } from './dto/update-progression.dto';

@Injectable()
export class ProgressionsService {
constructor(
@InjectRepository(Contestant)
private contestantsRepository: Repository<Contestant>,
@InjectRepository(Progression)
private progressionsRepository: Repository<Progression>,
) {}

findAll() {
return this.progressionsRepository.find();
}

async create(createProgressionDto: CreateProgressionDto, contestantId: number) {
const contestant = await this.contestantsRepository.findOne(contestantId);

if (!contestant) throw new Error('Contestant not found');

return this.progressionsRepository.save(createProgressionDto);
}

findOne(id: number, contestantId: number) {
return this.progressionsRepository.findOne({ where: { id, contestantId } });
}

async update(id: number, updateProgressionDto: UpdateProgressionDto, contestantId: number) {
const progression = await this.findOne(id, contestantId);

if (!progression) throw new Error('Progression not found');

return this.progressionsRepository.save({ ...progression, ...updateProgressionDto });
}

remove(id: number, contestantId: number) {
return this.progressionsRepository.delete({ id, contestantId });
}
}
