import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EscrowMilestoneEntity } from './escrow-milestone.entity';
import { UserEntity } from '../user/user.entity';
import { CoopEntity } from '../coop/coop.entity';

@Injectable()
export class EscrowMilestonesService {
constructor(
@InjectRepository(EscrowMilestoneEntity)
private escrowMilestoneRepository: Repository<EscrowMilestoneEntity>,
@InjectRepository(UserEntity)
private userRepository: Repository<UserEntity>,
@InjectRepository(CoopEntity)
private coopRepository: Repository<CoopEntity>,
) {}

async createMilestone(userId: number, coopId: number, amount: number, description: string): Promise<EscrowMilestoneEntity> {
const user = await this.userRepository.findOne(userId);
const coop = await this.coopRepository.findOne(coopId);

if (!user || !coop) {
throw new Error('User or Coop not found');
}

const escrowMilestone = new EscrowMilestoneEntity();
escrowMilestone.coop = coop;
escrowMilestone.user = user;
escrowMilestone.amount = amount;
escrowMilestone.description = description;
escrowMilestone.status = 'pending'; // replace with your statuses

return this.escrowMilestoneRepository.save(escrowMilestone);
}

// Add other necessary functions like update, delete, find etc...
}
