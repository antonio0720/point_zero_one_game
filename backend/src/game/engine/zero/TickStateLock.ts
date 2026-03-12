// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/src/game/engine/zero/TickStateLock.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE ZERO
 * /backend/src/game/engine/zero/TickStateLock.ts
 *
 * Doctrine:
 * - lifecycle transition control must be explicit and queryable
 * - the lock protects against overlapping ticks and illegal run transitions
 * - zero owns lifecycle guarding; simulation engines do not
 */

import type {
  RunLifecycleCheckpoint,
  RunLifecycleState,
} from './zero.types';

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

function checkpoint(
  lifecycleState: RunLifecycleState,
  tick: number | null,
  note: string | null,
): RunLifecycleCheckpoint {
  return Object.freeze({
    lifecycleState,
    changedAtMs: Date.now(),
    tick,
    note,
  });
}

export class TickStateLock {
  private state: RunLifecycleState = 'IDLE';
  private readonly history: RunLifecycleCheckpoint[] = [
    checkpoint('IDLE', null, 'Lock initialized.'),
  ];

  public getState(): RunLifecycleState {
    return this.state;
  }

  public historySnapshot(): readonly RunLifecycleCheckpoint[] {
    return freezeArray(this.history);
  }

  public isTickLocked(): boolean {
    return this.state === 'TICK_LOCKED';
  }

  public isRunActive(): boolean {
    return this.state === 'ACTIVE';
  }

  public canStartRun(): boolean {
    return this.state === 'IDLE' || this.state === 'ENDED';
  }

  public canExecuteTick(): boolean {
    return this.state === 'ACTIVE';
  }

  public enterStarting(note: string | null = null): void {
    this.transition('STARTING', null, note ?? 'Run bootstrapping started.');
  }

  public enterActive(tick: number | null = null, note: string | null = null): void {
    this.transition('ACTIVE', tick, note ?? 'Run is active.');
  }

  public enterTickLocked(tick: number, note: string | null = null): void {
    this.transition('TICK_LOCKED', tick, note ?? 'Tick execution locked.');
  }

  public enterEnding(tick: number | null = null, note: string | null = null): void {
    this.transition('ENDING', tick, note ?? 'Run shutdown started.');
  }

  public enterEnded(tick: number | null = null, note: string | null = null): void {
    this.transition('ENDED', tick, note ?? 'Run ended.');
  }

  public reset(note: string | null = null): void {
    this.transition('IDLE', null, note ?? 'Lock reset.');
  }

  private transition(
    next: RunLifecycleState,
    tick: number | null,
    note: string | null,
  ): void {
    this.assertTransitionAllowed(this.state, next);
    this.state = next;
    this.history.push(checkpoint(next, tick, note));
  }

  private assertTransitionAllowed(
    current: RunLifecycleState,
    next: RunLifecycleState,
  ): void {
    const allowed: Readonly<Record<RunLifecycleState, readonly RunLifecycleState[]>> = Object.freeze({
      IDLE: ['STARTING', 'IDLE'] as readonly RunLifecycleState[],
      STARTING: ['ACTIVE', 'ENDING', 'IDLE'] as readonly RunLifecycleState[],
      ACTIVE: ['TICK_LOCKED', 'ENDING', 'ACTIVE'] as readonly RunLifecycleState[],
      TICK_LOCKED: ['ACTIVE', 'ENDING'] as readonly RunLifecycleState[],
      ENDING: ['ENDED', 'IDLE'] as readonly RunLifecycleState[],
      ENDED: ['IDLE', 'STARTING', 'ENDED'] as readonly RunLifecycleState[],
    });

    if (!allowed[current].includes(next)) {
      throw new Error(
        `[TickStateLock] Illegal lifecycle transition ${current} -> ${next}.`,
      );
    }
  }
}