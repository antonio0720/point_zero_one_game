import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserProgression } from './entities/user-progression.entity';

@Injectable()
export class ProgressDisclosure9Service {
constructor(
@InjectRepository(UserProgression)
private userProgressionRepository: Repository<UserProgression>,
) {}

async updateUserProgression(userId: number, isCompleted: boolean) {
await this.userProgressionRepository.update(
{ userId },
{ progressiveDisclosure9: isCompleted },
);
}
}
