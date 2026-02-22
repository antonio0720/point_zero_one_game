import { EntityRepository, Repository } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import { PlayerEntity } from './player.entity';
import { GameEntity } from './game.entity';
import { PlayerGameRepository } from './player-game.repository';

@Injectable()
export class GameplayService {
constructor(
private readonly playerRepository: Repository<PlayerEntity>,
private readonly gameRepository: Repository<GameEntity>,
private readonly playerGameRepository: PlayerGameRepository,
) {}

async startNewGame(): Promise<GameEntity> {
const newGame = this.gameRepository.create({ status: 'active' });
await this.gameRepository.persistAndFlush(newGame);
return newGame;
}

async joinGame(player: PlayerEntity, gameId: number): Promise<void> {
const existingPlayerGame = await this.playerGameRepository.findOne({
player,
game: { id: gameId },
});

if (existingPlayerGame) {
throw new Error('Player already in the game');
}

const newPlayerGame = this.playerGameRepository.create({
player,
game: this.gameRepository.findOneOrFail(gameId),
});

await this.playerGameRepository.persistAndFlush(newPlayerGame);
}

async updateGameStatus(gameId: number, newStatus: string): Promise<void> {
const game = await this.gameRepository.findOneOrFail({ id: gameId });
game.status = newStatus;
await this.gameRepository.persistAndFlush(game);
}
}
