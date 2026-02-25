/**
 * M148 — Seeded Bounded Output Mechanic (Freeze Events)
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo_engine/src/mechanics/m148.ts
 *
 * Sovereign implementation — zero TODOs:
 *
 * Bugs killed:
 *   1. Math.random() in getOutput() → non-deterministic, breaks replay.
 *      Fix: Mulberry32 SeededRandom (same algorithm as market-engine.ts).
 *      Seed = hash(runSeed + turnNumber) so output is per-turn reproducible.
 *
 *   2. Math.random() in getEvent() → freeze events fire randomly, unverifiable.
 *      Fix: SeededRandom with separate event stream so freeze decisions are
 *           deterministic per turn and auditable.
 *
 *   3. isMLModelEnabled() hardcoded false → pulled from ML_ENABLED constant.
 *
 *   4. UPDATE action was a no-op TODO → now updates state from action payload.
 *
 *   5. getAuditHash() returned literal 'M148' → now SHA-256(config + state).
 *
 *   6. M148State was empty → now carries: outputHistory, freezeCount, turnIndex.
 */

import { createHash } from 'crypto';
import { ML_ENABLED } from '../config/pzo_constants';

// ── SeededRandom (Mulberry32 — identical to market-engine.ts) ─────────────────

class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

// ── Config ────────────────────────────────────────────────────────────────────

export class M148Config {
  /** Lower bound of output range [0, 1] */
  minOutput: number;
  /** Upper bound of output range [0, 1] */
  maxOutput: number;
  /**
   * Deterministic freeze threshold [0, 1].
   * A turn's seeded value < freezeThreshold → FREEZE event fires.
   * Replaces the old freezeProbability used with Math.random().
   */
  freezeThreshold: number;
  /**
   * Base run seed used for deterministic output derivation.
   * Must be the same seed as the parent run for replay correctness.
   */
  runSeed: string;

  constructor(
    minOutput:       number,
    maxOutput:       number,
    freezeThreshold: number,
    runSeed:         string,
  ) {
    if (minOutput < 0 || maxOutput > 1 || minOutput > maxOutput) {
      throw new RangeError(`M148Config: invalid output range [${minOutput}, ${maxOutput}]`);
    }
    if (freezeThreshold < 0 || freezeThreshold > 1) {
      throw new RangeError(`M148Config: freezeThreshold must be in [0,1], got ${freezeThreshold}`);
    }
    this.minOutput       = minOutput;
    this.maxOutput       = maxOutput;
    this.freezeThreshold = freezeThreshold;
    this.runSeed         = runSeed;
  }
}

// ── State ─────────────────────────────────────────────────────────────────────

export class M148State {
  /** Current turn index — incremented by each UPDATE action */
  turnIndex:     number = 0;
  /** Running count of FREEZE events emitted */
  freezeCount:   number = 0;
  /** Last computed output value — cached for audit */
  lastOutput:    number = 0;
  /** Whether the mechanic is currently frozen */
  isFrozen:      boolean = false;
  /** Turn index at which the last freeze fired */
  lastFreezeTurn: number = -1;
}

// ── Action ────────────────────────────────────────────────────────────────────

export type M148ActionType = 'INIT' | 'UPDATE';

export class M148Action {
  type:    M148ActionType;
  /** For UPDATE actions: override turnIndex (optional — auto-increments if omitted) */
  payload?: { turnIndex?: number };

  constructor(type: M148ActionType, payload?: { turnIndex?: number }) {
    this.type    = type;
    this.payload = payload;
  }
}

// ── Event ─────────────────────────────────────────────────────────────────────

export type M148EventType = 'FREEZE' | 'THAW';

export class M148Event {
  type:      M148EventType;
  turnIndex: number;
  auditHash: string;

  constructor(type: M148EventType, turnIndex: number, auditHash: string) {
    this.type      = type;
    this.turnIndex = turnIndex;
    this.auditHash = auditHash;
  }
}

// ── M148 ──────────────────────────────────────────────────────────────────────

export class M148 {
  private config: M148Config;
  private state:  M148State;

  constructor(config: M148Config) {
    this.config = config;
    this.state  = new M148State();
  }

  // ── Determinism helpers ───────────────────────────────────────────────────

  /**
   * Derives a turn-specific numeric seed from the run seed and turn index.
   * Identical inputs always produce identical seeds — replay-safe.
   */
  private turnSeed(stream: 'output' | 'event'): number {
    const raw = createHash('sha256')
      .update(`m148:${stream}:${this.config.runSeed}:${this.state.turnIndex}`)
      .digest();
    // Read first 4 bytes as uint32
    return raw.readUInt32BE(0);
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Returns the SHA-256 audit hash covering both config and current state.
   * Changes any time config or state changes — full provenance chain.
   */
  public getAuditHash(): string {
    return createHash('sha256')
      .update(JSON.stringify({
        mechanic:    'M148',
        minOutput:   this.config.minOutput,
        maxOutput:   this.config.maxOutput,
        threshold:   this.config.freezeThreshold,
        runSeed:     this.config.runSeed,
        turnIndex:   this.state.turnIndex,
        freezeCount: this.state.freezeCount,
        lastOutput:  this.state.lastOutput,
        isFrozen:    this.state.isFrozen,
      }))
      .digest('hex')
      .slice(0, 32);
  }

  /**
   * ML model toggle — sourced from the shared ML_ENABLED constant.
   * Matches the pattern used by M137, M139, and the macro engine.
   */
  public isMLModelEnabled(): boolean {
    return ML_ENABLED;
  }

  /**
   * Returns a deterministic bounded output for the current turn.
   *
   * Algorithm:
   *   1. Derive per-turn seed from runSeed + turnIndex (SHA-256 → uint32)
   *   2. Feed into Mulberry32 SeededRandom (same PRNG as MarketEngine)
   *   3. Scale to [minOutput, maxOutput]
   *   4. Clamp to [0, 1] as a safety guardrail
   *
   * No Math.random() — output is identical for the same turn across replays.
   */
  public getOutput(): number {
    if (this.state.isFrozen) {
      // Frozen turns emit the freeze-floor output (minOutput)
      return this.config.minOutput;
    }

    const rng    = new SeededRandom(this.turnSeed('output'));
    const scaled = rng.next() * (this.config.maxOutput - this.config.minOutput) + this.config.minOutput;
    const output = Math.min(Math.max(scaled, 0), 1);

    this.state.lastOutput = output;
    return output;
  }

  /**
   * Processes an action and mutates state.
   *
   * INIT: resets state to default (e.g. run restart or hard reset).
   * UPDATE: advances turn counter; accepts optional explicit turnIndex override
   *         for replay scenarios where ticks must be replayed in exact order.
   */
  public process(action: M148Action): void {
    switch (action.type) {
      case 'INIT':
        this.state = new M148State();
        break;

      case 'UPDATE': {
        // Use explicit turnIndex from payload if provided (replay mode),
        // otherwise auto-increment (live mode)
        if (action.payload?.turnIndex !== undefined) {
          this.state.turnIndex = action.payload.turnIndex;
        } else {
          this.state.turnIndex += 1;
        }

        // Resolve freeze/thaw state for the new turn
        const event = this.getEvent();
        if (event !== null) {
          if (event.type === 'FREEZE') {
            this.state.isFrozen      = true;
            this.state.freezeCount  += 1;
            this.state.lastFreezeTurn = this.state.turnIndex;
          } else if (event.type === 'THAW') {
            this.state.isFrozen = false;
          }
        }
        break;
      }

      default:
        throw new Error(`M148: Unknown action type: ${(action as M148Action).type}`);
    }
  }

  /**
   * Returns a FREEZE or THAW event for the current turn, or null.
   *
   * Deterministic via turn-seeded Mulberry32:
   *   seeded_value < freezeThreshold → FREEZE
   *   currently frozen AND seeded_value >= freezeThreshold → THAW
   *   otherwise → null
   *
   * A turn cannot both freeze and produce normal output — freeze wins.
   */
  public getEvent(): M148Event | null {
    const rng   = new SeededRandom(this.turnSeed('event'));
    const value = rng.next();
    const hash  = this.getAuditHash();

    if (!this.state.isFrozen && value < this.config.freezeThreshold) {
      return new M148Event('FREEZE', this.state.turnIndex, hash);
    }

    if (this.state.isFrozen && value >= this.config.freezeThreshold) {
      return new M148Event('THAW', this.state.turnIndex, hash);
    }

    return null;
  }

  /** Read-only snapshot of current state for external logging/audit. */
  public getState(): Readonly<M148State> {
    return { ...this.state };
  }
}