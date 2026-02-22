/**
 * MomentBridge service for mapping GameEngine moment events to HOS moment codes and emitting host_moment_fired event.
 */

import { EventEmitter } from 'events';
import { GameEngineEvent, HostMomentFiredEvent } from './interfaces';

interface MomentMap {
  [GameEngineEvent: string]: string;
}

const momentMap: MomentMap = {
  FUBAR_KILLED_ME: 'B01',
  OPPORTUNITY_FLIP: 'A01',
  MISSED_THE_BAG: 'C01',
};

class MomentBridge extends EventEmitter {
  private gameEngineEvents: GameEngineEvent[];

  constructor() {
    super();
    this.gameEngineEvents = Object.keys(momentMap);
  }

  /**
   * Listens to the specified game engine event and emits a host_moment_fired event with the corresponding HOS moment code, tick, and player.
   * @param event - The game engine event to listen to.
   * @param tick - The current game tick.
   * @param player - The player associated with the event.
   */
  public listenToGameEngineEvent(event: GameEngineEvent, tick: number, player: string) {
    this.emit('host_moment_fired', {
      code: momentMap[event],
      tick,
      player,
    });
  }
}

export default MomentBridge;
