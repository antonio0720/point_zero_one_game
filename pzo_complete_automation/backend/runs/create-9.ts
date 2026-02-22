import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Run } from './entities/run.entity';

@Injectable()
export class RunsService {
constructor(
@InjectRepository(Run)
private runRepository: Repository<Run>,
) {}

async create(createRunDto: any): Promise<Run> {
const newRun = this.runRepository.create(createRunDto);
return this.runRepository.save(newRun);
}
}
