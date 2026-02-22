// tslint:disable:no-any strict-type-checking no-object-literal-types

import { M128Mechanics } from './m128';
import { SeasonSinksBurnToKeepEconomyCleanConfig } from '../config/season_sinks_burn_to_keep_economy_clean_config';
import { M128SeasonSinksBurnToKeepEconomyCleanMLModel } from './ml/m128_season_sinks_burn_to_keep_economy_clean_ml_model';

export class M128SeasonSinksBurnToKeepEconomyCleanMechanics extends M128Mechanics {
  private config: SeasonSinksBurnToKeepEconomyCleanConfig;
  private mlModel: M128SeasonSinksBurnToKeepEconomyCleanMLModel;

  constructor(config: SeasonSinksBurnToKeepEconomyCleanConfig, mlModel: M128SeasonSinksBurnToKeepEconomyCleanMLModel) {
    super();
    this.config = config;
    this.mlModel = mlModel;
  }

  public async onPlayerDeath(playerId: string): Promise<void> {
    const playerData = await this.getPlayerData(playerId);
    if (playerData.seasonSinksBurnToKeepEconomyCleanEnabled) {
      const burnAmount = this.config.burnAmount;
      const playerCurrency = playerData.currency;
      const newCurrency = Math.max(0, playerCurrency - burnAmount);

      // Update player data
      await this.updatePlayerData(playerId, { currency: newCurrency });

      // Trigger event for UI to update
      await this.triggerEvent('player_currency_updated', { playerId, newCurrency });
    }
  }

  public async onSeasonEnd(): Promise<void> {
    const players = await this.getPlayers();
    for (const player of players) {
      if (this.config.seasonSinksBurnToKeepEconomyCleanEnabled) {
        // Reset season sinks burn to keep economy clean flag
        await this.updatePlayerData(player.id, { seasonSinksBurnToKeepEconomyCleanEnabled: false });
      }
    }

    // Trigger event for UI to update
    await this.triggerEvent('season_end');
  }

  public async onPlayerJoin(playerId: string): Promise<void> {
    const playerData = await this.getPlayerData(playerId);
    if (this.config.seasonSinksBurnToKeepEconomyCleanEnabled) {
      // Reset season sinks burn to keep economy clean flag
      await this.updatePlayerData(playerId, { seasonSinksBurnToKeepEconomyCleanEnabled: false });
    }
  }

  public async onPlayerLeave(playerId: string): Promise<void> {}

  private async getPlayerData(playerId: string): Promise<any> {
    const player = await this.getPlayer(playerId);
    return player.data;
  }

  private async updatePlayerData(playerId: string, data: any): Promise<void> {
    const player = await this.updatePlayer(playerId, data);
    return player;
  }

  private async triggerEvent(eventName: string, data?: any): Promise<void> {
    // Trigger event for UI to update
    console.log(`Triggering event ${eventName} with data`, data);
  }
}

export class M128SeasonSinksBurnToKeepEconomyCleanMLModel extends M128SeasonSinksBurnToKeepEconomyCleanMLModel {
  public async predict(playerData: any): Promise<number> {
    if (!this.mlEnabled) return 0;

    const input = this.preprocessInput(playerData);
    const output = await this.model.predict(input);

    // Ensure output is within bounds
    return Math.min(1, Math.max(0, output));
  }

  private preprocessInput(data: any): any {
    // Preprocess data for ML model
    return data;
  }
}

export class M128SeasonSinksBurnToKeepEconomyCleanConfig extends SeasonSinksBurnToKeepEconomyCleanConfig {
  public burnAmount = 1000; // Default burn amount

  public seasonSinksBurnToKeepEconomyCleanEnabled = true;

  public auditHash: string;
}
