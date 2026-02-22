// tslint:disable:no-any strict-type-checking
// tslint:disable:no-console

import { M127ProofBoundCraftingConfig } from './M127ProofBoundCraftingConfig';
import { M127ProofBoundCraftingState } from './M127ProofBoundCraftingState';

export class M127ProofBoundCraftingMechanic {
  private config: M127ProofBoundCraftingConfig;
  private state: M127ProofBoundCraftingState;

  constructor(config: M127ProofBoundCraftingConfig, state: M127ProofBoundCraftingState) {
    this.config = config;
    this.state = state;
  }

  public async craftFromVerifiedFragments(
    playerUuid: string,
    fragmentIds: number[],
    proofHashes: string[]
  ): Promise<[boolean, string]> {
    if (!this.mlEnabled()) {
      return [true, ''];
    }

    const input = { playerUuid, fragmentIds, proofHashes };
    const output = await this.m127ProofBoundCraftingModel.predict(input);
    const auditHash = this.auditHash(output);

    if (output === null || output < 0 || output > 1) {
      return [false, `Invalid output from model: ${output}`];
    }

    if (!this.state.isPlayerEligible(playerUuid)) {
      return [false, 'Player is not eligible for crafting'];
    }

    const result = await this.config.craftFromVerifiedFragments(
      playerUuid,
      fragmentIds,
      proofHashes
    );

    if (result === null) {
      return [false, `Failed to craft from verified fragments: ${auditHash}`];
    }

    this.state.updatePlayerState(playerUuid);
    return [true, result];
  }

  private mlEnabled(): boolean {
    // Implement your logic here to determine whether ML is enabled or not
    return true;
  }

  private auditHash(output: number): string {
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(output));
    return hash.digest('hex');
  }
}

export function createM127ProofBoundCraftingMechanic(
  config: M127ProofBoundCraftingConfig,
  state: M127ProofBoundCraftingState
): M127ProofBoundCraftingMechanic {
  return new M127ProofBoundCraftingMechanic(config, state);
}
