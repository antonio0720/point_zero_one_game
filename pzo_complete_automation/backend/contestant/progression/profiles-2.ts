import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContestantProfile } from './contestant-profile.entity';

@Injectable()
export class ContestantProfileService {
constructor(
@InjectRepository(ContestantProfile)
private contestantProfileRepository: Repository<ContestantProfile>,
) {}

async create(contestantId: number, profile: Partial<ContestantProfile>): Promise<ContestantProfile> {
const newProfile = this.contestantProfileRepository.create({ contestantId, ...profile });
return this.contestantProfileRepository.save(newProfile);
}

async findOne(id: number): Promise<ContestantProfile | null> {
return this.contestantProfileRepository.findOneByOrFail({ id });
}

async update(id: number, updates: Partial<ContestantProfile>): Promise<ContestantProfile | null> {
const existingProfile = await this.contestantProfileRepository.preload({ id });
if (!existingProfile) return null;

Object.assign(existingProfile, updates);
return this.contestantProfileRepository.save(existingProfile);
}

async delete(id: number): Promise<void> {
await this.contestantProfileRepository.delete({ id });
}
}
