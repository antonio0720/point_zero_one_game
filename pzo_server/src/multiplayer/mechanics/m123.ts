// tslint:disable:no-any strict-type-checking no-object-literal-types

import { M123Mechanics } from './M123Mechanics';
import { GameEngine } from '../GameEngine';
import { Player } from '../../Player';
import { Table } from '../../Table';
import { mlEnabled, auditHash } from '../../../utils/ml';

export class M123KingOfTheHillTableWinnerStaysStakesRotate extends M123Mechanics {
  public static readonly NAME = 'M123_KingOfTheHillTable_WinnerStaysStakesRotate';

  private _winner: Player | null;

  constructor(gameEngine: GameEngine) {
    super(gameEngine);
    this._winner = null;
  }

  public get winner(): Player | null {
    return this._winner;
  }

  public setWinner(winner: Player): void {
    this._winner = winner;
  }

  public onPlayerJoin(player: Player, table: Table): void {
    super.onPlayerJoin(player, table);
    if (this.gameEngine.getGameMode() === 'multiplayer') {
      const otherPlayers = table.getOtherPlayers();
      for (const p of otherPlayers) {
        this._winner = null;
      }
    }
  }

  public onPlayerLeave(player: Player): void {
    super.onPlayerLeave(player);
    if (this.gameEngine.getGameMode() === 'multiplayer') {
      const otherPlayers = this.table.getOtherPlayers();
      for (const p of otherPlayers) {
        this._winner = null;
      }
    }
  }

  public onRoundStart(): void {
    super.onRoundStart();
    if (this.gameEngine.getGameMode() === 'multiplayer' && mlEnabled()) {
      const winner = this.table.getWinner();
      if (winner !== null) {
        this.setWinner(winner);
      } else {
        this._winner = null;
      }
    }
  }

  public onRoundEnd(): void {
    super.onRoundEnd();
    if (this.gameEngine.getGameMode() === 'multiplayer' && mlEnabled()) {
      const winner = this.table.getWinner();
      if (winner !== null) {
        this.setWinner(winner);
      } else {
        this._winner = null;
      }
    }
  }

  public getStakes(): number[] {
    if (!mlEnabled() || !this.gameEngine.getGameMode() === 'multiplayer') {
      return [];
    }
    const stakes: number[] = [];
    for (const player of this.table.getPlayers()) {
      stakes.push(player.stake);
    }
    // Rotate stakes
    const rotatedStakes: number[] = [];
    let sum = 0;
    for (let i = 0; i < stakes.length; i++) {
      sum += stakes[i];
    }
    for (let i = 0; i < stakes.length; i++) {
      rotatedStakes.push(Math.floor((stakes[(i + 1) % stakes.length] / sum) * 100));
    }
    return rotatedStakes;
  }

  public getAuditHash(): string {
    const hash = super.getAuditHash();
    if (this._winner !== null) {
      hash += this._winner.id.toString();
    } else {
      hash += 'null';
    }
    return auditHash(hash);
  }
}
