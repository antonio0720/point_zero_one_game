/**
 * PivotalTurnsImpl - Implements pivot extraction logic for Point Zero One Digital's financial roguelike game.
 */

import { GameReplay } from "../repositories/game_replay";
import { Turn } from "../models/turn";
import { OpportunityFlip, FubarKilledMe, MissedTheBag } from "../models/pivot";
import { PivotsJson } from "../models/pivots_json";

/**
 * Extracts pivotal turns from a game replay and generates jump-to-turn anchors and impact deltas.
 */
export class PivotalTurnsImpl {
  public async extractPivots(replay: GameReplay): Promise<PivotsJson> {
    const turns = await replay.getTurns();
    let pivots: (OpportunityFlip | FubarKilledMe | MissedTheBag)[] = [];

    for (let i = 1; i < turns.length - 1; i++) {
      const currentTurn = turns[i];
      const nextTurn = turns[i + 1];

      if (currentTurn.outcome === 'opportunity_flip' && nextTurn.outcome === 'success') {
        pivots.push(new OpportunityFlip(currentTurn));
      } else if (currentTurn.outcome === 'fubar_killed_me') {
        pivots.push(new FubarKilledMe(currentTurn));
      } else if (currentTurn.outcome === 'missed_the_bag' && nextTurn.outcome === 'failure') {
        pivots.push(new MissedTheBag(currentTurn));
      }
    }

    const jumpToTurnAnchors = pivots.map((pivot) => pivot.turnNumber);
    const impactDeltas = pivots.map((pivot) => {
      if (pivot instanceof OpportunityFlip) {
        return {
          type: 'opportunity_flip',
          turnNumber: pivot.turnNumber,
          outcome: pivot.outcome,
          gain: pivot.gain,
        };
      } else if (pivot instanceof FubarKilledMe) {
        return {
          type: 'fubar_killed_me',
          turnNumber: pivot.turnNumber,
          outcome: pivot.outcome,
          loss: pivot.loss,
        };
      } else if (pivot instanceof MissedTheBag) {
        return {
          type: 'missed_the_bag',
          turnNumber: pivot.turnNumber,
          outcome: pivot.outcome,
          loss: pivot.loss,
        };
      }
    });

    const pivotsJson = new PivotsJson(jumpToTurnAnchors, impactDeltas);
    return pivotsJson;
  }
}

