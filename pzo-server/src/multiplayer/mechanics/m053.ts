// tslint:disable:no-any strict-type-checking no-object-literal-types

import { M53ReputationStakeCollateralizedTrustInCoopContracts } from './m053';
import { CoopContract } from '../coop_contract';
import { Player } from '../../player';
import { Game } from '../../../game';

export class M53Mechanics {
  public static readonly mlEnabled: boolean = false;
  public static readonly auditHash: string = 'some_audit_hash';

  public static getReputationStakeCollateralizedTrustInCoopContracts(
    game: Game,
    coopContract: CoopContract
  ): number[] | null {
    if (!game || !coopContract) return null;

    const players = coopContract.getPlayers();
    if (players.length < 2) return null;

    const player1 = players[0];
    const player2 = players[1];

    if (
      player1.reputationStakeCollateralizedTrustInCoopContracts ===
        undefined ||
      player2.reputationStakeCollateralizedTrustInCoopContracts ===
        undefined
    ) {
      return null;
    }

    const reputationStakeCollateralizedTrustInCoopContracts = [
      player1.reputationStakeCollateralizedTrustInCoopContracts,
      player2.reputationStakeCollateralizedTrustInCoopContracts,
    ];

    if (reputationStakeCollateralizedTrustInCoopContracts.length < 2) {
      return null;
    }

    const boundedReputationStakeCollateralizedTrustInCoopContracts =
      reputationStakeCollateralizedTrustInCoopContracts.map((value) => Math.min(1, Math.max(0, value)));

    if (boundedReputationStakeCollateralizedTrustInCoopContracts.length < 2) {
      return null;
    }

    const output = boundedReputationStakeCollateralizedTrustInCoopContracts;

    return output;
  }
}

export class M53 extends M53Mechanics {
  public static readonly mlEnabled: boolean = false;
  public static readonly auditHash: string = 'some_audit_hash';

  constructor(
    private game: Game,
    private coopContract: CoopContract
  ) {
    super();
  }

  public getReputationStakeCollateralizedTrustInCoopContracts(): number[] | null {
    return M53Mechanics.getReputationStakeCollateralizedTrustInCoopContracts(
      this.game,
      this.coopContract
    );
  }
}

export class M053 extends M53 {
  public static readonly mlEnabled: boolean = false;
  public static readonly auditHash: string = 'some_audit_hash';

  constructor(
    private game: Game,
    private coopContract: CoopContract
  ) {
    super(game, coopContract);
  }

  public getReputationStakeCollateralizedTrustInCoopContracts(): number[] | null {
    return M53Mechanics.getReputationStakeCollateralizedTrustInCoopContracts(
      this.game,
      this.coopContract
    );
  }
}
