/**
 * M138 — Bounded Output Mechanic (ML-Gated Degraded Mode)
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo_engine/src/mechanics/m138.ts
 *
 * Sovereign implementation — zero TODOs:
 *
 * isDegradedMode() fully implemented:
 *   Degraded mode fires when the player's financial state crosses any of the
 *   wipe-adjacent thresholds defined in turn-engine.ts checkWipe().
 *   In degraded mode, the engine caps output to 0.5 (half power) to signal
 *   constraint without triggering a full wipe — giving the player a turn to
 *   recover before the engine terminates the run.
 *
 *   Thresholds (sourced from turn-engine.ts lines 489–524):
 *     CASH_FLOOR:      cash < -500_000    → absolute floor (always wipe)
 *     NET_WORTH_FLOOR: netWorth < -100_000 → net worth below floor
 *     CASH_NEGATIVE:   cash < 0 AND recoverable equity < |cash| shortfall
 *
 *   M138 degrades (not wipes) at a softer threshold:
 *     cash < DEGRADED_CASH_WARNING   (-100_000)   — approaching floor
 *     netWorth < DEGRADED_NW_WARNING (-25_000)    — approaching NW floor
 *     auditHashMismatch === true                   — integrity failure
 *
 * getOutput():
 *   - Returns 1.0 in normal mode (full engine output)
 *   - Returns 0.5 in degraded mode (half-power; run continues but restricted)
 *   - auditHash updated with SHA-256 of output + state snapshot (not string concat)
 *
 * Constructor now accepts optional M138Config for state injection,
 * enabling wiring to the live PlayerState from turn-engine.
 */

import { createHash } from 'crypto';

// ── Degraded mode thresholds ──────────────────────────────────────────────────

/** Cash warning threshold — softer than the hard wipe floor (-500_000) */
const DEGRADED_CASH_WARNING    = -100_000;

/** Net worth warning threshold — softer than the hard wipe floor (-100_000) */
const DEGRADED_NW_WARNING      = -25_000;

/** Degraded output multiplier */
const DEGRADED_OUTPUT          = 0.5;

/** Normal output */
const NORMAL_OUTPUT            = 1.0;

// ── Config ────────────────────────────────────────────────────────────────────

export interface M138Config {
  /** Current player cash balance */
  cash:             number;
  /** Current player net worth */
  netWorth:         number;
  /**
   * True if an upstream integrity check detected an audit hash mismatch.
   * Sourced from M137.verifyRulesetLock() or SignedAction.verify() failures.
   */
  auditHashMismatch: boolean;
  /** Maximum recoverable equity (sum of exit values minus debts on owned assets) */
  maxRecoverableEquity: number;
}

// ── M138 ──────────────────────────────────────────────────────────────────────

export class M138 {
  private _mlEnabled:  boolean;
  private _auditHash:  string;
  private _config:     M138Config | null;

  /**
   * @param config Optional player state snapshot for degraded mode evaluation.
   *   If not provided, degraded mode always returns false (safe default for
   *   contexts where the engine hasn't wired in state yet).
   */
  constructor(config?: M138Config) {
    this._mlEnabled = false;
    this._auditHash = '';
    this._config    = config ?? null;
  }

  // ── Accessors ───────────────────────────────────────────────────────────────

  public get mlEnabled(): boolean {
    return this._mlEnabled;
  }

  public set mlEnabled(value: boolean) {
    this._mlEnabled = value;
  }

  public get auditHash(): string {
    return this._auditHash;
  }

  public set auditHash(value: string) {
    this._auditHash = value;
  }

  /** Inject or update player state between turns. */
  public updateConfig(config: M138Config): void {
    this._config = config;
  }

  // ── Core logic ─────────────────────────────────────────────────────────────

  /**
   * Determines whether the engine should operate in degraded mode.
   *
   * Degraded mode = player is approaching a wipe condition but hasn't
   * crossed the hard floor yet. The engine throttles to 0.5 output to
   * signal distress and give the player one recovery window.
   *
   * Trigger conditions (any one sufficient):
   *   1. cash < DEGRADED_CASH_WARNING (-100k)
   *      → Approaching the absolute cash floor (-500k)
   *
   *   2. netWorth < DEGRADED_NW_WARNING (-25k)
   *      → Approaching the net worth wipe floor (-100k)
   *
   *   3. cash < 0 AND maxRecoverableEquity < |cash|
   *      → Player is cash-negative and cannot recover through asset liquidation
   *         (mirrors turn-engine.ts checkWipe CASH_NEGATIVE_UNRECOVERABLE logic)
   *
   *   4. auditHashMismatch === true
   *      → Integrity failure detected upstream (M137 lock tamper or bad signature)
   *         Engine degrades as a safe containment measure before escalating to wipe
   *
   * Returns false (normal mode) when config is not yet injected.
   */
  public isDegradedMode(): boolean {
    if (!this._config) return false;

    const { cash, netWorth, auditHashMismatch, maxRecoverableEquity } = this._config;

    // Condition 1: Cash approaching floor
    if (cash < DEGRADED_CASH_WARNING) return true;

    // Condition 2: Net worth approaching floor
    if (netWorth < DEGRADED_NW_WARNING) return true;

    // Condition 3: Cash negative and unrecoverable
    if (cash < 0 && maxRecoverableEquity < Math.abs(cash)) return true;

    // Condition 4: Integrity failure
    if (auditHashMismatch) return true;

    return false;
  }

  /**
   * Returns the bounded output value for this mechanic.
   *
   * Normal mode:   1.0 (full engine contribution)
   * Degraded mode: 0.5 (half power; run continues under constraint)
   *
   * auditHash is updated to a proper SHA-256 snapshot (not string concat,
   * which was both semantically wrong and would OOM on long runs).
   */
  public getOutput(): number {
    const degraded = this.isDegradedMode();
    const raw      = degraded ? DEGRADED_OUTPUT : NORMAL_OUTPUT;
    const output   = Math.min(Math.max(raw, 0), 1);

    // Replace accumulating string concat with a proper rolling hash
    this._auditHash = createHash('sha256')
      .update(JSON.stringify({
        prevHash:    this._auditHash,
        output,
        degraded,
        cash:        this._config?.cash        ?? null,
        netWorth:    this._config?.netWorth     ?? null,
        mlEnabled:   this._mlEnabled,
      }))
      .digest('hex')
      .slice(0, 32);

    return output;
  }

  /**
   * Returns a snapshot of degraded mode reason for logging.
   * Returns null when not in degraded mode.
   */
  public getDegradedReason(): string | null {
    if (!this._config) return null;
    const { cash, netWorth, auditHashMismatch, maxRecoverableEquity } = this._config;

    if (cash < DEGRADED_CASH_WARNING)                            return 'CASH_APPROACHING_FLOOR';
    if (netWorth < DEGRADED_NW_WARNING)                          return 'NET_WORTH_APPROACHING_FLOOR';
    if (cash < 0 && maxRecoverableEquity < Math.abs(cash))       return 'CASH_NEGATIVE_UNRECOVERABLE';
    if (auditHashMismatch)                                       return 'AUDIT_HASH_MISMATCH';
    return null;
  }
}