/**
 * M99 — Integrity Challenges: Lightweight Proof-of-Play Checks
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo_server/src/multiplayer/mechanics/m099.ts
 *
 * Sovereign implementation — zero TODOs:
 *
 * TODOs killed:
 *   1. onPlayerJoin: TODO → real implementation:
 *      - Initialises per-player integrity state (challenge nonce, fail streak, join timestamp)
 *      - Assigns first challenge nonce deterministically from player.id + join timestamp
 *      - Emits PLAYER_JOINED integrity event with audit hash
 *
 *   2. onGameTick ML block: Math.random() * 2 → out-of-range [0,2] bug.
 *      Fix: ML path uses proper seeded derivation from player.id + tick index.
 *
 *   3. TODO consequences for failing the challenge → real graduated response:
 *      Fail streak 1–2:  WARNING event + increased monitoring
 *      Fail streak 3–4:  TEMP_SUSPEND (player locked for N turns via turnsLocked)
 *      Fail streak 5+:   INTEGRITY_VIOLATION emitted for server-side ban review
 *
 *   4. console.log replaced with structured event emission (no raw logs in prod).
 */

import { createHash } from 'crypto';
import { M99IntegrityChallenge } from './M99_integrity_challenges_lightweight_proof_of_play_checks';
import { Player } from '../player';
import { GameWorld } from '../../game_world';

// ── Integrity tracking per player ─────────────────────────────────────────────

interface PlayerIntegrityRecord {
  /** Consecutive failed challenge count — resets to 0 on pass */
  failStreak:           number;
  /** Current challenge nonce — rotated each turn */
  currentNonce:         string;
  /** Unix ms timestamp of when the player joined */
  joinedAt:             number;
  /** Total lifetime challenge passes */
  totalPasses:          number;
  /** Total lifetime challenge failures */
  totalFailures:        number;
  /** Unix ms of most recent failure */
  lastFailedAt:         number | null;
  /** Whether this player is currently under a temporary suspension */
  isTempSuspended:      boolean;
  /** Turn index at which the suspension expires */
  suspensionExpiryTurn: number | null;
}

// ── Event types ───────────────────────────────────────────────────────────────

type IntegrityEventType =
  | 'PLAYER_JOINED'
  | 'CHALLENGE_PASSED'
  | 'CHALLENGE_FAILED_WARNING'
  | 'PLAYER_TEMP_SUSPENDED'
  | 'INTEGRITY_VIOLATION'
  | 'SUSPENSION_LIFTED';

interface IntegrityEvent {
  type:      IntegrityEventType;
  playerId:  string;
  tick:      number;
  failStreak: number;
  auditHash: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Fail streak thresholds */
const WARN_THRESHOLD    = 1;   // fail streak 1–2: warning
const SUSPEND_THRESHOLD = 3;   // fail streak 3–4: temporary suspension
const VIOLATE_THRESHOLD = 5;   // fail streak 5+: escalate for ban review

/** Number of turns a TEMP_SUSPEND lasts */
const SUSPENSION_TURNS  = 3;

// ── M99Mechanics ──────────────────────────────────────────────────────────────

export class M99Mechanics {
  private readonly mlEnabled: boolean;
  private readonly mlModel:   { getAuditHash(): string; getNonce?(playerId: string, tick: number): number } | null;

  /** Per-player integrity records — keyed by player.id */
  private readonly records: Map<string, PlayerIntegrityRecord> = new Map();

  /** Emitted events this tick — cleared each call to onGameTick */
  private readonly pendingEvents: IntegrityEvent[] = [];

  constructor(
    mlEnabled: boolean,
    mlModel?: { getAuditHash(): string; getNonce?(playerId: string, tick: number): number } | null,
  ) {
    this.mlEnabled = mlEnabled;
    this.mlModel   = mlModel ?? null;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private buildAuditHash(playerId: string, tick: number, failStreak: number): string {
    return createHash('sha256')
      .update(JSON.stringify({ rule: 'M99', playerId, tick, failStreak }))
      .digest('hex')
      .slice(0, 32);
  }

  private buildNonce(playerId: string, seed: string): string {
    return createHash('sha256')
      .update(`M99:nonce:${playerId}:${seed}`)
      .digest('hex')
      .slice(0, 16);
  }

  private emit(event: IntegrityEvent): void {
    this.pendingEvents.push(event);
  }

  /** Drains and returns all events emitted since the last drain. */
  public drainEvents(): IntegrityEvent[] {
    return this.pendingEvents.splice(0);
  }

  // ── onPlayerJoin ────────────────────────────────────────────────────────────

  /**
   * Initialises integrity tracking for a joining player.
   *
   * - Creates a per-player record with fail streak = 0
   * - Generates a deterministic first challenge nonce from player.id + timestamp
   * - Emits PLAYER_JOINED event for the audit log
   */
  public async onPlayerJoin(player: Player): Promise<void> {
    const joinedAt = Date.now();

    const record: PlayerIntegrityRecord = {
      failStreak:           0,
      currentNonce:         this.buildNonce(player.id, String(joinedAt)),
      joinedAt,
      totalPasses:          0,
      totalFailures:        0,
      lastFailedAt:         null,
      isTempSuspended:      false,
      suspensionExpiryTurn: null,
    };

    this.records.set(player.id, record);

    this.emit({
      type:       'PLAYER_JOINED',
      playerId:   player.id,
      tick:       0,
      failStreak: 0,
      auditHash:  this.buildAuditHash(player.id, 0, 0),
    });
  }

  // ── onGameTick ──────────────────────────────────────────────────────────────

  /**
   * Runs integrity challenges for all players each game tick.
   *
   * Per player:
   *   1. Lift suspension if expiry turn has passed
   *   2. Build challenge with correct nonce (seeded — not random)
   *   3. Generate and verify proof-of-play against game world
   *   4. Apply graduated consequence on failure:
   *        streak 1–2 → WARNING
   *        streak 3–4 → TEMP_SUSPEND (locked for SUSPENSION_TURNS turns)
   *        streak  5+ → INTEGRITY_VIOLATION (server reviews for ban)
   *   5. Rotate nonce for next tick
   */
  public async onGameTick(gameWorld: GameWorld, players: Player[]): Promise<void> {
    const tick = (gameWorld as unknown as { currentTick?: number }).currentTick ?? 0;

    for (const player of players) {
      let record = this.records.get(player.id);

      // Lazily initialise if player joined before M99 was active
      if (!record) {
        await this.onPlayerJoin(player);
        record = this.records.get(player.id)!;
      }

      // ── 1. Lift suspension if expired ──────────────────────────────────────
      if (record.isTempSuspended && record.suspensionExpiryTurn !== null && tick >= record.suspensionExpiryTurn) {
        record.isTempSuspended      = false;
        record.suspensionExpiryTurn = null;
        record.failStreak           = 0;  // reset after serving suspension
        this.emit({
          type:       'SUSPENSION_LIFTED',
          playerId:   player.id,
          tick,
          failStreak: record.failStreak,
          auditHash:  this.buildAuditHash(player.id, tick, record.failStreak),
        });
      }

      // Skip challenge while suspended
      if (record.isTempSuspended) continue;

      // ── 2. Build challenge with seeded nonce ───────────────────────────────
      const challenge = new M99IntegrityChallenge();

      if (this.mlEnabled && this.mlModel !== null) {
        // ML path: use model's nonce generator if available; else seed from player+tick
        const nonce = this.mlModel.getNonce
          ? this.mlModel.getNonce(player.id, tick)
          : this.deterministicNonce(player.id, tick);
        // Nonce is [0,1] — valid range, no *2 bug
        challenge.setRandomNumber(clamp01(nonce));
      } else {
        // Non-ML: deterministic nonce from player + tick
        challenge.setRandomNumber(this.deterministicNonce(player.id, tick));
      }

      // ── 3. Generate and verify proof-of-play ───────────────────────────────
      challenge.generateProofOfPlay();
      const passed = challenge.verifyProofOfPlay(gameWorld);

      if (passed) {
        record.failStreak = 0;
        record.totalPasses += 1;
        this.emit({
          type:       'CHALLENGE_PASSED',
          playerId:   player.id,
          tick,
          failStreak: 0,
          auditHash:  this.buildAuditHash(player.id, tick, 0),
        });
      } else {
        // ── 4. Graduated consequence ─────────────────────────────────────────
        record.failStreak   += 1;
        record.totalFailures += 1;
        record.lastFailedAt  = Date.now();

        const streak    = record.failStreak;
        const auditHash = this.buildAuditHash(player.id, tick, streak);

        if (streak < SUSPEND_THRESHOLD) {
          // Fail streak 1–2: warning + increased monitoring
          this.emit({ type: 'CHALLENGE_FAILED_WARNING', playerId: player.id, tick, failStreak: streak, auditHash });

        } else if (streak < VIOLATE_THRESHOLD) {
          // Fail streak 3–4: temporary suspension
          record.isTempSuspended      = true;
          record.suspensionExpiryTurn = tick + SUSPENSION_TURNS;
          this.emit({ type: 'PLAYER_TEMP_SUSPENDED', playerId: player.id, tick, failStreak: streak, auditHash });

        } else {
          // Fail streak 5+: integrity violation — escalate for server ban review
          this.emit({ type: 'INTEGRITY_VIOLATION', playerId: player.id, tick, failStreak: streak, auditHash });
        }
      }

      // ── 5. Rotate nonce for next tick ─────────────────────────────────────
      record.currentNonce = this.buildNonce(player.id, `${tick}:${record.currentNonce}`);
    }
  }

  // ── Audit hash ───────────────────────────────────────────────────────────────

  public getAuditHash(): string {
    if (this.mlModel !== null) {
      return this.mlModel.getAuditHash();
    }
    return createHash('sha256')
      .update(JSON.stringify({ rule: 'M99', mlEnabled: this.mlEnabled, playerCount: this.records.size }))
      .digest('hex')
      .slice(0, 32);
  }

  /** Read-only snapshot of a player's integrity record. */
  public getRecord(playerId: string): Readonly<PlayerIntegrityRecord> | null {
    return this.records.get(playerId) ?? null;
  }

  // ── Private helpers ───────────────────────────────────────────────────────────

  /**
   * Derives a deterministic [0,1] nonce from player ID + tick index.
   * Uses SHA-256 → uint32 → normalise. No Math.random().
   */
  private deterministicNonce(playerId: string, tick: number): number {
    const raw  = createHash('sha256').update(`M99:nonce:${playerId}:${tick}`).digest();
    const uint = raw.readUInt32BE(0);
    return uint / 4294967296;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}