// tslint:disable:no-any strict-type-checking no-object-literal-types

import { IGameContext } from '../game_context';
import { IMechanic } from './mechanic';

export class M16LiveTableTriggerHotSeatVote implements IMechanic {
  public readonly mlEnabled: boolean = false;
  public readonly auditHash: string;

  constructor() {
    this.auditHash = 'hot_seat_vote_mechanic';
  }

  public async onGameStart(gameContext: IGameContext): Promise<void> {
    gameContext.gameState.hotSeatVoteCount = 0;
  }

  public async onPlayerJoin(gameContext: IGameContext, playerIndex: number): Promise<void> {
    if (gameContext.gameState.hotSeatVoteCount < 3) {
      await this.voteOnLiveTable(gameContext, playerIndex);
    }
  }

  private async voteOnLiveTable(gameContext: IGameContext, playerIndex: number): Promise<void> {
    const vote = Math.random() > 0.5 ? true : false;
    gameContext.gameState.hotSeatVoteCount++;
    await this.updatePlayerVote(gameContext, playerIndex, vote);
  }

  private async updatePlayerVote(gameContext: IGameContext, playerIndex: number, vote: boolean): Promise<void> {
    const player = gameContext.players[playerIndex];
    if (vote) {
      player.hotSeatVotes++;
    } else {
      player.hotSeatVotes--;
    }
  }

  public async onLiveTableTrigger(gameContext: IGameContext): Promise<void> {
    if (gameContext.gameState.hotSeatVoteCount >= 3) {
      const votes = gameContext.players.map((player, index) => ({ playerIndex: index, vote: player.hotSeatVotes }));
      votes.sort((a, b) => b.vote - a.vote);
      const winnerIndex = votes[0].playerIndex;
      await this.resolveLiveTable(gameContext, winnerIndex);
    }
  }

  private async resolveLiveTable(gameContext: IGameContext, winnerIndex: number): Promise<void> {
    gameContext.gameState.hotSeatVoteCount = 0;
    for (const player of gameContext.players) {
      player.hotSeatVotes = 0;
    }
  }
}
