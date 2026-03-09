/**
 * POINT ZERO ONE — TURN RESOLVER
 * Resolves a single turn in the game engine.
 *
 * Imports game-engine types from the deterministic replay engine
 * and deck manager, keeping the turn resolver self-contained.
 */

import { EventEmitter } from 'events';
import type { Ledger, DecisionEffect } from './replay_engine';
import type { Card } from './deck_manager';

// ── Local types for the turn resolver ────────────────────────────────

export interface Player {
  id: number;
  hand: Card[];
  deckSize: number;
  ledger: Ledger;
}

export interface Choice {
  id: string;
  label: string;
  effects: DecisionEffect[];
}

export interface Deltas {
  cash: number;
  income: number;
  expenses: number;
  shield: number;
  heat: number;
  trust: number;
}

export interface TurnEvent {
  playerId: number;
  choices: Choice[];
  decision: Choice;
  deltas: Deltas;
}

// ── Game state singleton (in-memory, per-run) ────────────────────────

const playerStore = new Map<number, Player>();
const turnEmitter = new EventEmitter();

export const GameState = {
  getPlayer(playerId: number): Player | undefined {
    return playerStore.get(playerId);
  },
  setPlayer(player: Player): void {
    playerStore.set(player.id, player);
  },
  clear(): void {
    playerStore.clear();
  },
};

// ── Deterministic deck draw (simplified for turn resolution) ─────────

function drawCards(hand: Card[], deckSize: number): Card[] {
  const drawCount = Math.min(5, deckSize - hand.length);
  const newCards: Card[] = [];
  for (let i = 0; i < drawCount; i++) {
    newCards.push({ index: hand.length + i, weight: 1 });
  }
  return [...hand, ...newCards];
}

// ── Turn resolver ────────────────────────────────────────────────────

export class TurnResolver {
  public resolveTurn(playerId: number): TurnEvent {
    const player = GameState.getPlayer(playerId);
    if (!player) {
      throw new Error(`No player found with ID ${playerId}`);
    }

    player.hand = drawCards(player.hand, player.deckSize);

    this.applyAutoEffects(player.hand);

    const choices = this.presentChoices(player);

    const decision = this.getPlayerDecision(choices);

    this.applyPlayerDecision(decision, player);

    const deltas = this.computeDeltas(player);

    this.validateTurn(deltas);

    const event: TurnEvent = { playerId, choices, decision, deltas };
    turnEmitter.emit('TurnEvent', event);

    return event;
  }

  private applyAutoEffects(hand: Card[]): void {
    // Auto-effects are applied by the card_effects_executor in the full pipeline.
    // Turn resolver delegates to it at runtime; no-op in isolation.
  }

  private presentChoices(player: Player): Choice[] {
    return player.hand.map((card, i) => ({
      id: `choice_${card.index}`,
      label: `Play card ${card.index}`,
      effects: [{ target: 'cash' as const, delta: card.weight }],
    }));
  }

  private getPlayerDecision(choices: Choice[]): Choice {
    // In production, this awaits player input via WebSocket or HTTP.
    // For deterministic replay, it returns the first choice.
    return choices[0];
  }

  private applyPlayerDecision(decision: Choice, player: Player): void {
    const mutableLedger = { ...player.ledger } as Record<string, number>;
    for (const effect of decision.effects) {
      if (effect.target in mutableLedger) {
        mutableLedger[effect.target] += effect.delta;
      }
    }
    player.ledger = mutableLedger as unknown as Ledger;
  }

  private computeDeltas(player: Player): Deltas {
    return {
      cash: player.ledger.cash,
      income: player.ledger.income,
      expenses: player.ledger.expenses,
      shield: player.ledger.shield,
      heat: player.ledger.heat,
      trust: player.ledger.trust,
    };
  }

  private validateTurn(deltas: Deltas): void {
    if (deltas.heat > 100) {
      throw new Error('Heat threshold exceeded — run should finalize');
    }
  }
}
