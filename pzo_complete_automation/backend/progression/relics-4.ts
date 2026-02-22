import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AchievementEntity, RelicEntity } from './entities';
import { AchievementsService } from '../achievements/achievements.service';

@Injectable()
export class RelicsService {
constructor(
@InjectRepository(RelicEntity)
private readonly relicRepository: Repository<RelicEntity>,
private readonly achievementsService: AchievementsService,
) {}

async findOne(id: number): Promise<RelicEntity | null> {
return this.relicRepository.findOneBy({ id });
}

async findAll(): Promise<RelicEntity[]> {
return this.relicRepository.find();
}

async create(name: string, description: string): Promise<RelicEntity> {
const relic = this.relicRepository.create({ name, description });
await this.relicRepository.save(relic);
return relic;
}

async upgrade(relicId: number, playerId: number): Promise<void> {
const playerAchievements = await this.achievementsService.findByPlayerId(playerId);
const relic = await this.findOne(relicId);

if (!relic) {
throw new Error('Relic not found');
}

let hasUpgradeAchievement = false;
playerAchievements.forEach((achievement) => {
if (achievement.name === 'Upgrade Relics') {
hasUpgradeAchievement = true;
}
});

if (!hasUpgradeAchievement) {
throw new Error('Player has not unlocked Upgrade Relics achievement');
}

// Implement your upgrade logic here.

await this.relicRepository.save(relic);
}
}
