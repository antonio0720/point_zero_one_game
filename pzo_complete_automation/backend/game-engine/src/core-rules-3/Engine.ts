/**
 * Engine — core-rules-3
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo_complete_automation/backend/game-engine/src/core-rules-3/Engine.ts
 *
 * Contract (verified by test suite):
 *   - Same seed → identical tick sequence (determinism)
 *   - netWorth ≤ 0 → outcome='BANKRUPT', isOver=true
 *   - netWorth ≥ FREEDOM_THRESHOLD → outcome='FREEDOM', isOver=true
 *   - Ticks after isOver=true are no-ops
 *   - proofHash generated on run end (SHA-256)
 *   - Deck exhaustion → reshuffle discards, no crash
 */

import { createHash } from 'crypto';
import { GameState }  from '../../__tests__/test-utilities';

export type RunOutcome = 'FREEDOM' | 'BANKRUPT' | 'TIMEOUT' | 'ABANDONED' | null;

export class Engine {
  /** Net worth threshold for FREEDOM outcome */
  public readonly FREEDOM_THRESHOLD = 1_000_000;

  tick(game: GameState): void {
    // No-op after game ends
    if (game.isOver) return;

    // ── 1. Apply queued card effects for each player ───────────────────────
    for (const player of game.players) {
      let incomeMultiplier = 1;
      let incomeModifier   = 0;
      let netWorthBonus    = 0;
      let expenseModifier  = 0;

      const nextEffects: typeof player.activeEffects = [];

      for (const effect of player.activeEffects) {
        switch (effect.type) {
          case 'DOUBLE_INCOME_NEXT_TURN':
            incomeMultiplier = 2;
            break;
          case 'REDUCE_INCOME_40PCT_2TURNS':
            incomeModifier -= player.income * 0.4;
            break;
          case 'BONUS_NET_WORTH_5000':
            netWorthBonus += 5000;
            break;
          case 'HATER_SABOTAGE':
            expenseModifier += 3000;
            break;
        }

        const remaining = effect.turnsRemaining - 1;
        if (remaining > 0) {
          nextEffects.push({ type: effect.type, turnsRemaining: remaining });
        }
      }

      player.activeEffects = nextEffects;

      // ── 2. Apply pending turn card (staged by applyCard) ──────────────
      const pending = game._pendingCards.get(player.id);
      if (pending) {
        game._pendingCards.delete(player.id);

        player.income   += pending.config.incomeEffect;
        player.expenses += pending.config.expenseEffect;

        if (pending.config.specialEffect) {
          switch (pending.config.specialEffect) {
            case 'DOUBLE_INCOME_NEXT_TURN':
              player.activeEffects.push({ type: 'DOUBLE_INCOME_NEXT_TURN', turnsRemaining: 1 });
              break;
            case 'REDUCE_INCOME_40PCT_2TURNS':
              player.activeEffects.push({ type: 'REDUCE_INCOME_40PCT_2TURNS', turnsRemaining: 2 });
              break;
            case 'HATER_SABOTAGE':
              player.activeEffects.push({ type: 'HATER_SABOTAGE', turnsRemaining: 1 });
              break;
            case 'BONUS_NET_WORTH_5000':
              player.activeEffects.push({ type: 'BONUS_NET_WORTH_5000', turnsRemaining: 1 });
              break;
          }
        }

        // Discard to deck's discard pile for reshuffle
        game.deck.discard(pending);
      }

      // ── 3. Compute net worth delta for this tick ───────────────────────
      const effectiveIncome   = (player.income + incomeModifier) * incomeMultiplier;
      const effectiveExpenses =  player.expenses + expenseModifier;

      player.netWorth += effectiveIncome - effectiveExpenses + netWorthBonus;
    }

    // ── 4. Advance turn ────────────────────────────────────────────────────
    game.turn += 1;

    // ── 5. End-of-turn outcome checks ─────────────────────────────────────
    for (const player of game.players) {
      if (player.netWorth <= 0) {
        this._endGame(game, 'BANKRUPT');
        return;
      }
      if (player.netWorth >= this.FREEDOM_THRESHOLD) {
        this._endGame(game, 'FREEDOM');
        return;
      }
    }
  }

  private _endGame(game: GameState, outcome: RunOutcome): void {
    game.outcome = outcome;
    game.isOver  = true;

    // Proof hash: SHA-256 of seed + turn + outcome + all player net worths
    const payload = [
      game.seed,
      game.turn,
      outcome,
      ...game.players.map(p => `${p.id}:${p.netWorth}`),
    ].join('|');

    game.proofHash = createHash('sha256').update(payload).digest('hex');
  }
}
