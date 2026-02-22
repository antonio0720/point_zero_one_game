// tslint:disable:no-any strict-type-checking no-empty-interface
import { M124SpeedrunModeTimerIsEvenHarsher } from './M124_speedrun_mode_timer_is_even_harsher';
import { GameMechanic, GameMechanicType } from '../GameMechanic';

export class M124SpeedrunModeTimerIsEvenHarsher extends GameMechanic {
  public static readonly TYPE: GameMechanicType = new GameMechanicType('M124_SPEEDRUN_MODE_TIMER_IS_EVEN_HARSHER');

  private mlEnabled: boolean;
  private auditHash: string;

  constructor() {
    super(M124SpeedrunModeTimerIsEvenHarsher.TYPE);
    this.mlEnabled = false;
    this.auditHash = '0';
  }

  public getAuditHash(): string {
    return this.auditHash;
  }

  public setMLModelEnabled(enabled: boolean): void {
    this.mlEnabled = enabled;
  }

  public isMLModelEnabled(): boolean {
    return this.mlEnabled;
  }

  public getBoundedOutput(output: number, min: number, max: number): number {
    if (output < min) {
      return min;
    } else if (output > max) {
      return max;
    }
    return output;
  }

  public apply(gameState: any): void {
    // Preserve determinism
    gameState = JSON.parse(JSON.stringify(gameState));

    const timer = gameState.timer;

    if (timer % 2 === 0) {
      gameState.speedrunModeTimerIsEvenHarsher = true;
    } else {
      gameState.speedrunModeTimerIsEvenHarsher = false;
    }
  }

  public reset(): void {
    // Preserve determinism
    const gameState = JSON.parse(JSON.stringify(this.gameState));

    gameState.timer = 0;

    this.apply(gameState);
  }
}
