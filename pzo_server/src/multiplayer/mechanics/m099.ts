// tslint:disable:no-any strict-type-checking
// tslint:disable:no-console

import { M99IntegrityChallenge } from './M99_integrity_challenges_lightweight_proof_of_play_checks';
import { Player } from '../player';
import { GameWorld } from '../../game_world';

export class M99Mechanics {
  private mlEnabled: boolean;
  private mlModel: any;

  constructor(mlEnabled: boolean, mlModel?: any) {
    this.mlEnabled = mlEnabled;
    if (mlModel !== undefined && mlModel !== null) {
      this.mlModel = mlModel;
    }
  }

  public async onPlayerJoin(player: Player): Promise<void> {
    // TODO: implement player join logic
  }

  public async onGameTick(gameWorld: GameWorld, players: Player[]): Promise<void> {
    for (const player of players) {
      const challenge = new M99IntegrityChallenge();
      if (this.mlEnabled && this.mlModel !== undefined) {
        // Use ML model to generate a random number between 0 and 1
        const randomNumber = Math.random() * 2;
        challenge.setRandomNumber(randomNumber);
      }
      challenge.generateProofOfPlay();

      // Check the proof of play against the game world state
      if (!challenge.verifyProofOfPlay(gameWorld)) {
        console.log(`Player ${player.id} failed integrity challenge`);
        // TODO: implement consequences for failing the challenge
      } else {
        console.log(`Player ${player.id} passed integrity challenge`);
      }
    }
  }

  public getAuditHash(): string | null {
    if (this.mlModel !== undefined) {
      return this.mlModel.getAuditHash();
    } else {
      return null;
    }
  }
}
