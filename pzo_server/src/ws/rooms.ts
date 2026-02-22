// room.ts
import { Player } from './player';
import { MarketState } from './market-state';

export interface Room {
  seed: string;
  players: Player[];
  marketState: MarketState;
}

export class RoomImpl implements Room {
  public readonly seed: string;
  public readonly players: Player[];
  public readonly marketState: MarketState;

  constructor(seed: string, players: Player[], marketState: MarketState) {
    this.seed = seed;
    this.players = players;
    this.marketState = marketState;
  }
}

export function createRoom(seed: string): Room {
  return new RoomImpl(seed, [], new MarketState());
}
