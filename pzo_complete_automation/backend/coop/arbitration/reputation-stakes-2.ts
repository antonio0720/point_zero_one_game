import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Player } from './player.entity';
import { Game } from './game.entity';
import { ReputationStake } from './reputation-stakes.entity';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ReputationStakesService {
constructor(
@InjectRepository(Player)
private playerRepository: Repository<Player>,
@InjectRepository(Game)
private gameRepository: Repository<Game>,
@InjectRepository(ReputationStake)
private reputationStakeRepository: Repository<ReputationStake>,
) {}

async createNewStake(playerId: string, gameId: string): Promise<ReputationStake> {
const player = await this.playerRepository.findOneBy({ id: playerId });
if (!player) throw new Error('Player not found');

const game = await this.gameRepository.findOneBy({ id: gameId });
if (!game) throw new Error('Game not found');

const reputationStake = this.reputationStakeRepository.create({
playerId,
gameId,
stakeId: uuidv4(),
reputationPoints: player.reputationPoints || 0,
gameReputationBonus: game.gameReputationBonus || 0,
});

return this.reputationStakeRepository.save(reputationStake);
}

async updateStake(stakeId: string, reputationPointsChange: number): Promise<ReputationStake> {
const stake = await this.reputationStakeRepository.findOneBy({ stakeId });
if (!stake) throw new Error('Stake not found');

const newReputationPoints = stake.reputationPoints + reputationPointsChange;

return this.reputationStakeRepository.save({ ...stake, reputationPoints: newReputationPoints });
}
}
