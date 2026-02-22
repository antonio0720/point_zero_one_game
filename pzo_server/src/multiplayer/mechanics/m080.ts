// tslint:disable:no-any strict-type-checking no-object-literal-types

import { M80ContractReceiptCard } from './M80_contract_receipt_card';
import { M80GameMechanic } from './M80_game_mechanic';
import { M80PlayerState } from './M80_player_state';
import { M80GameState } from './M80_game_state';

export class M80ContractReceiptCardsPortableVerifiableCoopProofs extends M80GameMechanic {
  private mlEnabled: boolean;
  private auditHash: string;

  constructor(
    gameMechanics: M80GameMechanic[],
    playerStates: M80PlayerState[],
    gameState: M80GameState,
    mlEnabled: boolean = false
  ) {
    super(gameMechanics, playerStates, gameState);
    this.mlEnabled = mlEnabled;
    this.auditHash = '';
  }

  public async onEvent(event: any): Promise<void> {
    if (this.mlEnabled) {
      const output = await this.calculateOutput();
      this.gameState.output = output;
      this.auditHash = await this.getAuditHash(output);
    }
  }

  private async calculateOutput(): Promise<number[]> {
    // implement logic to calculate output based on game state and player states
    return [0, 1]; // placeholder implementation
  }

  private async getAuditHash(output: number[]): Promise<string> {
    // implement logic to generate audit hash based on output
    return 'audit_hash_placeholder'; // placeholder implementation
  }
}

export { M80ContractReceiptCard };
