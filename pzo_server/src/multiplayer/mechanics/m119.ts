// tslint:disable:no-any strict-type-checking no-object-literal-types

import { M119_RivalryLedgerNemesisTrackingOverSeasons } from './m119_rivalry_ledger_nemesis_tracking_over_seasons';
import { Game } from '../game';
import { Player } from '../player';
import { Season } from '../season';

export class M119_Mechanics {
  private ml_enabled: boolean;
  private ml_model: any;

  constructor(game: Game, ml_enabled: boolean) {
    this.ml_enabled = ml_enabled;
    if (ml_enabled) {
      // Load ML model
      this.ml_model = require('./m119_ml_model');
    }
  }

  public getRivalryLedger(player1: Player, player2: Player): M119_RivalryLedgerNemesisTrackingOverSeasons {
    const ledger = new M119_RivalryLedgerNemesisTrackingOverSeasons();
    this.updateRivalryLedger(ledger, player1, player2);
    return ledger;
  }

  private updateRivalryLedger(ledger: M119_RivalryLedgerNemesisTrackingOverSeasons, player1: Player, player2: Player): void {
    const season = player1.season;
    if (season === null) {
      // No current season
      return;
    }

    const nemesisScore1 = this.getNemesisScore(player1);
    const nemesisScore2 = this.getNemesisScore(player2);

    ledger.update(player1, player2, nemesisScore1, nemesisScore2);

    if (this.ml_enabled) {
      // Use ML model to predict rivalry strength
      const mlOutput = this.ml_model.predict([nemesisScore1, nemesisScore2]);
      ledger.setRivalryStrength(mlOutput[0]);
    }
  }

  private getNemesisScore(player: Player): number {
    if (player.nemesis === null) {
      // No nemesis set
      return 0;
    }

    const season = player.season;
    if (season === null) {
      // No current season
      return 0;
    }

    const nemesisScore = season.getNemesisScore(player.nemesis);
    return Math.min(nemesisScore, 1.0); // Bounded output
  }
}

export function getAuditHash(game: Game): string {
  const auditHash = game.players.reduce((hash, player) => {
    const nemesis = player.nemesis;
    if (nemesis !== null) {
      return hash + player.id + nemesis.id;
    } else {
      return hash + player.id;
    }
  }, '');
  return auditHash;
}
