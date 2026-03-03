/**
 * GameWorld
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo_server/src/game_world.ts
 */

export type GameWorldStatus = 'LOBBY' | 'ACTIVE' | 'PAUSED' | 'ENDED' | 'CORRUPTED';

export type MarketRegime = 'Stable' | 'Expansion' | 'Compression' | 'Panic' | 'Euphoria';

export interface GameWorld {
  /** Unique run identifier */
  runId:        string;

  /** Current game tick */
  currentTick:  number;

  /** Total ticks in this run */
  totalTicks:   number;

  /** Current world status */
  status:       GameWorldStatus;

  /** Active market regime */
  regime:       MarketRegime;

  /** Run seed — used for deterministic mechanic derivation */
  seed:         number;

  /**
   * Returns true when the world is in a state that accepts player actions.
   * M99 verifyProofOfPlay() calls this as part of challenge verification.
   */
  isActive(): boolean;
}

/** Concrete implementation usable in tests and the server runtime */
export class GameWorldImpl implements GameWorld {
  public runId:       string;
  public currentTick: number;
  public totalTicks:  number;
  public status:      GameWorldStatus;
  public regime:      MarketRegime;
  public seed:        number;

  constructor(params: Omit<GameWorld, 'isActive'>) {
    this.runId       = params.runId;
    this.currentTick = params.currentTick;
    this.totalTicks  = params.totalTicks;
    this.status      = params.status;
    this.regime      = params.regime;
    this.seed        = params.seed;
  }

  public isActive(): boolean {
    return this.status === 'ACTIVE' && this.currentTick < this.totalTicks;
  }
}
