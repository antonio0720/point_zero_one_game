/**
 * PlayerProgressSignals Service for Point Zero One Digital's financial roguelike game.
 * Generates personal progress signals based on player actions and events.
 */

import { Injectable } from '@nestjs/common';
import { PlayerEntity } from '../player/player.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

/**
 * PlayerProgressSignals Service interface.
 */
@Injectable()
export class PlayerProgressSignalsService {
  constructor(
    @InjectRepository(PlayerEntity)
    private readonly playerRepository: Repository<PlayerEntity>,
  ) {}

  /**
   * Generates a progress signal for a stabilized burn event.
   * @param playerId The ID of the player who performed the stabilized burn.
   */
  async generateStabilizedBurnSignal(playerId: number): Promise<void> {
    const player = await this.playerRepository.findOne({ where: { id: playerId } });

    if (!player) {
      throw new Error('Player not found');
    }

    // Assuming there's a ProgressSignal entity with properties: id, playerId, eventType, timestamp
    const progressSignal = new ProgressSignal();
    progressSignal.playerId = playerId;
    progressSignal.eventType = 'Stabilized Burn';
    progressSignal.timestamp = new Date();

    await this.playerRepository.save(player); // Update the player's record with the new signal
    await this.playerRepository.save(progressSignal); // Save the new progress signal
  }
}
