/**
 * POINT ZERO ONE — DETERMINISTIC REPLAY ENGINE
 * /backend/src/game/engine/replay_engine.ts
 *
 * Purpose:
 * - Reconstruct byte-identical run state from seed + event log
 * - Provide deterministic replay bytes and replay hash
 * - Serve as the canonical backend replay substrate for proof, audit, and tests
 */

import { createHash } from 'crypto';

export type Seed = number;

export interface Ledger {
  readonly cash: number;
  readonly income: number;
  readonly expenses: number;
  readonly shield: number;
  readonly heat: number;
  readonly trust: number;
  readonly divergence: number;
  readonly cords: number;
  readonly turn: number;
}

export type EffectTarget =
  | 'cash'
  | 'income'
  | 'expenses'
  | 'shield'
  | 'heat'
  | 'trust'
  | 'divergence'
  | 'cords';

export interface DecisionEffect {
  readonly target: EffectTarget;
  readonly delta: number;
}

export interface RunCreatedEvent {
  readonly type: 'RUN_CREATED';
  readonly runId: string;
  readonly seed: Seed;
  readonly createdAt: number;
  readonly ledger: Ledger;
}

export interface TurnSubmittedEvent {
  readonly type: 'TURN_SUBMITTED';
  readonly runId: string;
  readonly turnIndex: number;
  readonly decisionId: string;
  readonly choiceId: string;
  readonly submittedAt: number;
  readonly sourceCardInstanceId?: string;
  readonly effects: readonly DecisionEffect[];
}

export interface RunFinalizedEvent {
  readonly type: 'RUN_FINALIZED';
  readonly runId: string;
  readonly finalizedAt: number;
}

export type RunEvent =
  | RunCreatedEvent
  | TurnSubmittedEvent
  | RunFinalizedEvent;

export interface ReplaySnapshot {
  readonly runId: string;
  readonly seed: Seed;
  readonly finalized: boolean;
  readonly ledger: Ledger;
  readonly eventsApplied: number;
  readonly turnCount: number;
}

export function createDefaultLedger(
  overrides: Partial<Ledger> = {},
): Ledger {
  return {
    cash: 0,
    income: 0,
    expenses: 0,
    shield: 0,
    heat: 0,
    trust: 50,
    divergence: 0,
    cords: 0,
    turn: 0,
    ...overrides,
  };
}

function roundTo6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }

  if (value !== null && typeof value === 'object') {
    const input = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};

    for (const key of Object.keys(input).sort()) {
      output[key] = sortKeysDeep(input[key]);
    }

    return output;
  }

  return value;
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

export function sha256Hex(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

export class GameState {
  private readonly seed: Seed;
  private runId: string | null;
  private finalized: boolean;
  private ledger: Ledger;
  private eventsApplied: number;

  public constructor(seed: Seed) {
    this.seed = seed;
    this.runId = null;
    this.finalized = false;
    this.ledger = createDefaultLedger();
    this.eventsApplied = 0;
  }

  public applyEvent(event: RunEvent): void {
    switch (event.type) {
      case 'RUN_CREATED': {
        this.runId = event.runId;
        this.ledger = { ...event.ledger };
        this.finalized = false;
        this.eventsApplied += 1;
        return;
      }

      case 'TURN_SUBMITTED': {
        this.assertRunInitialized();

        const updated: Ledger = { ...this.ledger };

        for (const effect of event.effects) {
          switch (effect.target) {
            case 'cash':
              updated.cash = roundTo6(updated.cash + effect.delta);
              break;
            case 'income':
              updated.income = roundTo6(updated.income + effect.delta);
              break;
            case 'expenses':
              updated.expenses = roundTo6(updated.expenses + effect.delta);
              break;
            case 'shield':
              updated.shield = roundTo6(updated.shield + effect.delta);
              break;
            case 'heat':
              updated.heat = roundTo6(updated.heat + effect.delta);
              break;
            case 'trust':
              updated.trust = roundTo6(updated.trust + effect.delta);
              break;
            case 'divergence':
              updated.divergence = roundTo6(updated.divergence + effect.delta);
              break;
            case 'cords':
              updated.cords = roundTo6(updated.cords + effect.delta);
              break;
            default: {
              const exhaustiveCheck: never = effect.target;
              throw new Error(`Unsupported effect target: ${String(exhaustiveCheck)}`);
            }
          }
        }

        updated.turn = event.turnIndex + 1;
        this.ledger = updated;
        this.eventsApplied += 1;
        return;
      }

      case 'RUN_FINALIZED': {
        this.assertRunInitialized();
        this.finalized = true;
        this.eventsApplied += 1;
        return;
      }

      default: {
        const exhaustiveCheck: never = event;
        throw new Error(`Unsupported run event: ${String(exhaustiveCheck)}`);
      }
    }
  }

  public getCurrentTurn(): number {
    return this.ledger.turn;
  }

  public isFinalized(): boolean {
    return this.finalized;
  }

  public snapshot(): ReplaySnapshot {
    this.assertRunInitialized();

    return {
      runId: this.runId as string,
      seed: this.seed,
      finalized: this.finalized,
      ledger: { ...this.ledger },
      eventsApplied: this.eventsApplied,
      turnCount: this.ledger.turn,
    };
  }

  private assertRunInitialized(): void {
    if (!this.runId) {
      throw new Error('GameState has not been initialized with a RUN_CREATED event.');
    }
  }
}

export class ReplayEngine {
  private readonly seed: Seed;
  private readonly eventLog: readonly RunEvent[];

  public constructor(seed: Seed, eventLog: readonly RunEvent[]) {
    this.seed = seed;
    this.eventLog = [...eventLog];
  }

  public getEvents(): readonly RunEvent[] {
    return [...this.eventLog];
  }

  public getGameStateAtTurn(turn: number): GameState {
    const state = new GameState(this.seed);

    for (const event of this.eventLog) {
      state.applyEvent(event);

      if (state.getCurrentTurn() >= turn) {
        break;
      }
    }

    return state;
  }

  public replayAll(): ReplaySnapshot {
    const state = new GameState(this.seed);

    for (const event of this.eventLog) {
      state.applyEvent(event);
    }

    return state.snapshot();
  }

  public toReplayBytes(): Buffer {
    const snapshot = this.replayAll();
    return Buffer.from(stableStringify(snapshot), 'utf8');
  }

  public getReplayHash(): string {
    return sha256Hex(this.toReplayBytes());
  }
}