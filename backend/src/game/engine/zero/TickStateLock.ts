// backend/src/game/engine/zero/TickStateLock.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE ZERO
 * /backend/src/game/engine/zero/TickStateLock.ts
 *
 * Doctrine:
 * - Engine 0 owns authoritative lifecycle lock state for backend execution
 * - overlapping ticks are forbidden
 * - transitions are explicit, validated, and lease-based
 * - callers receive a lock token and must release the same token
 * - this is orchestration law, not UI state
 */

export type TickRuntimeState =
  | 'IDLE'
  | 'STARTING'
  | 'ACTIVE'
  | 'TICK_LOCKED'
  | 'ENDING'
  | 'ENDED';

export interface TickLockLease {
  readonly token: string;
  readonly state: 'TICK_LOCKED';
  readonly acquiredAtMs: number;
  readonly runId: string | null;
  readonly tick: number | null;
}

export interface TickStateSnapshot {
  readonly state: TickRuntimeState;
  readonly runId: string | null;
  readonly tick: number | null;
  readonly activeToken: string | null;
  readonly lockedAtMs: number | null;
  readonly updatedAtMs: number;
}

function createToken(nowMs: number, runId: string | null, tick: number | null): string {
  return `${nowMs}:${runId ?? 'none'}:${tick ?? -1}:${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

export class TickStateLock {
  private state: TickRuntimeState = 'IDLE';

  private runId: string | null = null;

  private tick: number | null = null;

  private activeToken: string | null = null;

  private lockedAtMs: number | null = null;

  private updatedAtMs = Date.now();

  private readonly now: () => number;

  public constructor(options: { readonly now?: () => number } = {}) {
    this.now = options.now ?? (() => Date.now());
  }

  public snapshot(): TickStateSnapshot {
    return Object.freeze({
      state: this.state,
      runId: this.runId,
      tick: this.tick,
      activeToken: this.activeToken,
      lockedAtMs: this.lockedAtMs,
      updatedAtMs: this.updatedAtMs,
    });
  }

  public getState(): TickRuntimeState {
    return this.state;
  }

  public isActive(): boolean {
    return this.state === 'ACTIVE' || this.state === 'TICK_LOCKED';
  }

  public isTickLocked(): boolean {
    return this.state === 'TICK_LOCKED';
  }

  public startRun(runId: string): void {
    if (this.state !== 'IDLE' && this.state !== 'ENDED') {
      throw new Error(`Cannot start run from state ${this.state}.`);
    }

    this.state = 'STARTING';
    this.runId = runId;
    this.tick = 0;
    this.activeToken = null;
    this.lockedAtMs = null;
    this.touch();
  }

  public activate(runId?: string): void {
    if (this.state !== 'STARTING' && this.state !== 'ACTIVE') {
      throw new Error(`Cannot activate from state ${this.state}.`);
    }

    if (runId !== undefined && this.runId !== null && this.runId !== runId) {
      throw new Error(
        `TickStateLock activate runId mismatch. Expected ${this.runId}, received ${runId}.`,
      );
    }

    this.state = 'ACTIVE';
    this.touch();
  }

  public acquire(runId: string | null, tick: number | null): TickLockLease {
    if (this.state !== 'ACTIVE') {
      throw new Error(`Cannot acquire tick lock from state ${this.state}.`);
    }

    if (this.activeToken !== null) {
      throw new Error('Tick lock is already held.');
    }

    const nowMs = this.now();
    const token = createToken(nowMs, runId, tick);

    this.state = 'TICK_LOCKED';
    this.runId = runId ?? this.runId;
    this.tick = tick;
    this.activeToken = token;
    this.lockedAtMs = nowMs;
    this.touch(nowMs);

    return Object.freeze({
      token,
      state: 'TICK_LOCKED',
      acquiredAtMs: nowMs,
      runId: this.runId,
      tick: this.tick,
    });
  }

  public release(
    leaseOrToken: TickLockLease | string,
    nextState: 'ACTIVE' | 'ENDING' | 'ENDED' = 'ACTIVE',
    nextTick?: number | null,
  ): void {
    const token =
      typeof leaseOrToken === 'string' ? leaseOrToken : leaseOrToken.token;

    if (this.state !== 'TICK_LOCKED') {
      throw new Error(`Cannot release tick lock from state ${this.state}.`);
    }

    if (this.activeToken === null || this.activeToken !== token) {
      throw new Error('Tick lock release token mismatch.');
    }

    this.activeToken = null;
    this.lockedAtMs = null;
    this.state = nextState;

    if (nextTick !== undefined) {
      this.tick = nextTick;
    }

    this.touch();
  }

  public beginEnding(): void {
    if (
      this.state !== 'ACTIVE' &&
      this.state !== 'TICK_LOCKED' &&
      this.state !== 'STARTING'
    ) {
      throw new Error(`Cannot begin ending from state ${this.state}.`);
    }

    this.state = 'ENDING';
    this.activeToken = null;
    this.lockedAtMs = null;
    this.touch();
  }

  public markEnded(): void {
    if (this.state !== 'ENDING' && this.state !== 'ACTIVE') {
      throw new Error(`Cannot mark ended from state ${this.state}.`);
    }

    this.state = 'ENDED';
    this.activeToken = null;
    this.lockedAtMs = null;
    this.touch();
  }

  public reset(): void {
    this.state = 'IDLE';
    this.runId = null;
    this.tick = null;
    this.activeToken = null;
    this.lockedAtMs = null;
    this.touch();
  }

  public assertState(expected: TickRuntimeState): void {
    if (this.state !== expected) {
      throw new Error(`Expected state ${expected} but current state is ${this.state}.`);
    }
  }

  private touch(nowMs = this.now()): void {
    this.updatedAtMs = nowMs;
  }
}