// pzo-server/src/modules/h2h/extraction.service.ts
// Sprint 4 — Extraction resolution backend service

import { Injectable } from '@nestjs/common';
import { buildExtractionAction, resolveExtraction } from '../../../../pzo-web/src/game/modes/predator/extractionEngine';
import type { ExtractionType, CounterplayAction, ExtractionAction } from '../../../../pzo-web/src/game/modes/predator/extractionEngine';

@Injectable()
export class ExtractionService {
  private extractions = new Map<string, ExtractionAction>();
  // matchId → { playerAState, playerBState } (lightweight visible snapshot)
  private matchStates = new Map<string, Record<string, { cash: number; income: number; shields: number }>>();

  updatePlayerState(matchId: string, playerId: string, cash: number, income: number, shields: number) {
    const current = this.matchStates.get(matchId) ?? {};
    this.matchStates.set(matchId, { ...current, [playerId]: { cash, income, shields } });
  }

  async fireExtraction(
    matchId: string,
    attackerId: string,
    type: ExtractionType,
    tick: number,
  ): Promise<ExtractionAction> {
    const states = this.matchStates.get(matchId) ?? {};
    // Find opponent from match — simplified; Sprint 7 wires real DB lookup
    const opponentState = Object.entries(states).find(([id]) => id !== attackerId)?.[1]
      ?? { cash: 28_000, income: 4_200, shields: 1 };

    const extraction = buildExtractionAction(
      type, attackerId, 'opponent',
      tick,
      opponentState.cash, opponentState.income, opponentState.shields,
    );
    this.extractions.set(extraction.id, extraction);
    return extraction;
  }

  async resolveCounterplay(
    matchId: string,
    windowId: string,
    action: CounterplayAction,
    tick: number,
  ): Promise<{ outcome: string; cashDelta: number; incomeDelta: number; shieldDelta: number; attackerBBReward: number }> {
    const extraction = this.extractions.get(windowId);
    if (!extraction) return { outcome: 'NOT_FOUND', cashDelta: 0, incomeDelta: 0, shieldDelta: 0, attackerBBReward: 0 };

    const { resolved, defenderImpact, attackerBBReward } = resolveExtraction(extraction, action, tick);
    this.extractions.set(windowId, resolved);

    return {
      outcome:          resolved.outcome,
      cashDelta:        defenderImpact.cashDelta,
      incomeDelta:      defenderImpact.incomeDelta,
      shieldDelta:      defenderImpact.shieldDelta,
      attackerBBReward,
    };
  }
}
