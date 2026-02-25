/**
 * Macro Shock Notifier Service
 */

import { Injectable } from '@nestjs/common';
import { Client, Transport } from '@nestjs/microservices';
import { MacroShockEvent } from './macro-shock.event';

/**
 * Macro Shock Notifier Service Interface
 */
export interface IMacroShockNotifierService {
  notifyBreakingNews(macroShock: MacroShockEvent): Promise<void>;
  broadcastLiveShock(macroShock: MacroShockEvent): Promise<void>;
  engagePostShock(playerId: string, macroShock: MacroShockEvent): Promise<void>;
}

/**
 * Macro Shock Notifier Service Implementation
 */
@Injectable()
export class MacroShockNotifierService implements IMacroShockNotifierService {
  private readonly gameGrpc: Client;

  constructor() {
    this.gameGrpc = new Client({
      transport: Transport.GRPC,
      options: {
        url: 'grpc://game-service:50051',
      },
    });
  }

  /**
   * Notify Macro Insurance subscribers about an upcoming macro shock event (24h advance)
   * @param macroShock The macro shock event details
   */
  async notifyBreakingNews(macroShock: MacroShockEvent): Promise<void> {
    // Implement notification logic for Macro Insurance subscribers
  }

  /**
   * Broadcast the upcoming macro shock event to active players (live)
   * @param macroShock The macro shock event details
   */
  async broadcastLiveShock(macroShock: MacroShockEvent): Promise<void> {
    // Implement live broadcast logic for active players
  }

  /**
   * Engage players with a post-shock questionnaire after the event has occurred
   * @param playerId The unique identifier of the player to engage
   * @param macroShock The macro shock event details
   */
  async engagePostShock(playerId: string, macroShock: MacroShockEvent): Promise<void> {
    // Implement post-shock engagement logic for players
  }
}
