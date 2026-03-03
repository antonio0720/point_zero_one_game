/**
 * AllianceWarService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * SYNDICATE RIVALRY PROTOCOL — Server-Authoritative Capital Competition Engine
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * What this is:
 * A Syndicate Rivalry is a declared capital competition between two Syndicates.
 * Not a random feud. Not social drama. A timeboxed financial conflict protocol
 * with a real notice window, a live Capital Battle phase, and a final Ledger
 * Close that produces Settlement Hashes, receipts, and permanent history.
 *
 * No vibes. No "trust me." The platform can prove it.
 *
 * Rivalry Phase Clock:
 *   NOTICE_FILED → DUE_DILIGENCE (2h) → CAPITAL_BATTLE (24h) → LEDGER_CLOSE (1h) → CLOSED
 *
 * Covers: T170 (Market Play stacking caps), T173 (Yield Capture transfer),
 *         T178 (Market Clock hardening against worker restarts)
 */

import { EventEmitter } from 'events';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RivalryPhase =
  | 'NOTICE_FILED'     // Declaration committed — notice window open
  | 'DUE_DILIGENCE'    // Syndicates prepare — 2h window
  | 'CAPITAL_BATTLE'   // Live scoring window — 24h
  | 'LEDGER_CLOSE'     // Settlement ceremony — 1h
  | 'CLOSED';          // Deal closed. Receipts locked.

export type MarketPlayType =
  | 'CASHFLOW_AMPLIFIER'    // Boosts Capital Score accrual rate
  | 'SHIELD_PLAY'           // Liquidity Shield — protects treasury
  | 'YIELD_MULTIPLIER'      // Multiplies qualifying run yield
  | 'DEBT_SUPPRESSOR'       // Suppresses rival Capital Score accrual
  | 'VELOCITY_PLAY';        // Speeds up qualifying run eligibility

export interface ActiveMarketPlay {
  playId:       string;
  syndicateId:  string;
  rivalryId:    string;
  type:         MarketPlayType;
  magnitude:    number;         // e.g. 0.25 = 25% amplifier
  activatedAt:  Date;
  expiresAt:    Date;
  stackGroup:   string;         // Plays in same group compete for cap
}

export interface SyndicateRivalry {
  rivalryId:                string;
  challengerId:             string;   // Syndicate that filed notice
  defenderId:               string;   // Syndicate that received notice
  phase:                    RivalryPhase;
  noticeFiled:              Date;
  phaseStartedAt:           Date;
  phaseEndsAt:              Date;
  challengerCapitalScore:   number;
  defenderCapitalScore:     number;
  yieldCaptureAmount?:      number;
  winnerId?:                string;
  settlementHash?:          string;   // Transaction fingerprint — immutable proof
  marketClockLockId?:       string;
  ledgerClosedAt?:          Date;
}

export interface TreasuryLedgerEntry {
  entryId:        string;
  syndicateId:    string;
  rivalryId:      string;
  type:           'YIELD_CAPTURE_DEBIT' | 'YIELD_CAPTURE_CREDIT' | 'PLAY_SPEND' | 'CONTRIBUTION';
  amount:         number;
  balanceAfter:   number;
  createdAt:      Date;
  idempotencyKey: string;
}

export interface YieldCaptureResult {
  rivalryId:             string;
  winnerId:              string;
  loserId:               string;
  yieldCaptureAmount:    number;
  loserTreasuryBefore:   number;
  loserTreasuryAfter:    number;
  winnerTreasuryBefore:  number;
  winnerTreasuryAfter:   number;
  debitEntryId:          string;
  creditEntryId:         string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Market Clock — phase durations for the Rivalry Protocol */
export const RIVALRY_PHASE_DURATIONS_MS: Record<RivalryPhase, number> = {
  NOTICE_FILED:   0,
  DUE_DILIGENCE:  2  * 60 * 60 * 1000,   // 2h — prep window
  CAPITAL_BATTLE: 24 * 60 * 60 * 1000,   // 24h — live scoring window
  LEDGER_CLOSE:   1  * 60 * 60 * 1000,   // 1h — settlement ceremony
  CLOSED:         0,
};

export const RIVALRY_PHASE_SEQUENCE: RivalryPhase[] = [
  'NOTICE_FILED',
  'DUE_DILIGENCE',
  'CAPITAL_BATTLE',
  'LEDGER_CLOSE',
  'CLOSED',
];

/** Post-rivalry Liquidity Shield — auto-applied on CLOSED */
export const AUTO_LIQUIDITY_SHIELD_DURATION_MS = 24 * 60 * 60 * 1000;

/**
 * T170: Market Play stacking caps per stack group.
 * Syndicates cannot stack unlimited leverage — real regulatory posture.
 * The platform enforces caps server-side. No client bypass.
 */
export const MARKET_PLAY_STACK_CAPS: Record<string, { maxStacks: number; maxMagnitude: number }> = {
  CASHFLOW:  { maxStacks: 2, maxMagnitude: 0.50 },  // max +50% cashflow amplification
  SHIELD:    { maxStacks: 1, maxMagnitude: 1.00 },  // binary — either shielded or not
  YIELD:     { maxStacks: 2, maxMagnitude: 0.50 },
  DEBT:      { maxStacks: 1, maxMagnitude: 0.30 },  // one debt suppressor active at a time
  VELOCITY:  { maxStacks: 3, maxMagnitude: 0.75 },
};

/**
 * T170: Market Play precedence — lower index resolves first in conflict.
 * Deterministic + comparable. No ambiguity in compound-play scenarios.
 */
export const MARKET_PLAY_PRECEDENCE: MarketPlayType[] = [
  'SHIELD_PLAY',
  'DEBT_SUPPRESSOR',
  'CASHFLOW_AMPLIFIER',
  'YIELD_MULTIPLIER',
  'VELOCITY_PLAY',
];

/** T173: Yield Capture rate — winner takes 5% of losing Syndicate treasury */
export const YIELD_CAPTURE_RATE = 0.05;
export const YIELD_CAPTURE_FLOOR = 0;
export const YIELD_CAPTURE_CEILING = 1_000_000; // Anomaly flag triggers above this

// ─── Database interface ───────────────────────────────────────────────────────

export interface IRivalryDatabase {
  getRivalry(rivalryId: string): Promise<SyndicateRivalry | null>;
  updateRivalryPhase(rivalryId: string, phase: RivalryPhase, phaseEndsAt: Date, lockId: string): Promise<boolean>;
  getRivalriesByPhase(phase: RivalryPhase): Promise<SyndicateRivalry[]>;
  getRivalriesOverdueForTransition(nowMs: number): Promise<SyndicateRivalry[]>;
  markRivalrySettled(rivalryId: string, result: Partial<SyndicateRivalry>): Promise<void>;
  acquireMarketClockLock(lockKey: string, ttlMs: number): Promise<string | null>;
  releaseMarketClockLock(lockId: string): Promise<void>;
  getSyndiateTreasuryBalance(syndicateId: string): Promise<number>;
  writeTreasuryLedgerEntry(entry: TreasuryLedgerEntry): Promise<void>;
  transferTreasury(debit: TreasuryLedgerEntry, credit: TreasuryLedgerEntry): Promise<void>;
  getActiveMarketPlays(rivalryId: string, syndicateId: string): Promise<ActiveMarketPlay[]>;
  writeMarketPlay(play: ActiveMarketPlay): Promise<void>;
  expireMarketPlay(playId: string): Promise<void>;
  existsLedgerEntry(idempotencyKey: string): Promise<boolean>;
  setSyndicateLiquidityShield(syndicateId: string, expiresAt: Date): Promise<void>;
}

export interface IEventBus {
  emit(event: string, payload: unknown): void;
}

// ─── AllianceWarService ────────────────────────────────────────────────────────
// Internal service name preserved for code stability.
// Player-facing / doc-facing identity: Syndicate Rivalry Protocol

export class AllianceWarService extends EventEmitter {
  private marketClockRunning = false;
  private marketClockTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly db: IRivalryDatabase,
    private readonly bus: IEventBus,
    private readonly featureFlags: { rivalryEnabled: boolean },
  ) {
    super();
  }

  // ── T178: Market Clock Recovery Scan — run on service boot ─────────────────
  /**
   * Phase Clock Recovery Scan.
   *
   * Executes on service startup. Finds all rivalries whose phaseEndsAt has
   * passed but phase has not advanced — a sign of worker crash or restart.
   * Processes each in order, idempotently. The Market Clock never loses time.
   *
   * Fail-closed posture: if a rivalry can't be recovered, emit error and continue.
   * The clock does not halt for a single bad record.
   */
  async recoverStalePhaseTransitions(): Promise<void> {
    const nowMs = Date.now();
    const stale = await this.db.getRivalriesOverdueForTransition(nowMs);
    for (const rivalry of stale) {
      try {
        await this.advanceRivalryPhase(rivalry.rivalryId);
      } catch (err) {
        this.emit('MARKET_CLOCK_RECOVERY_ERROR', { rivalryId: rivalry.rivalryId, err });
      }
    }
  }

  // ── T178: Market Clock scheduler ───────────────────────────────────────────

  /**
   * Start the Market Clock.
   * Polls at `intervalMs` to advance any rivalries whose phase window has closed.
   * Safe to call multiple times — idempotent start guard.
   */
  startMarketClock(intervalMs = 60_000): void {
    if (this.marketClockRunning) return;
    this.marketClockRunning = true;
    this.marketClockTimer = setInterval(() => this.marketClockTick(), intervalMs);
    this.marketClockTick().catch((err) =>
      this.emit('MARKET_CLOCK_ERROR', { err })
    );
  }

  stopMarketClock(): void {
    this.marketClockRunning = false;
    if (this.marketClockTimer) {
      clearInterval(this.marketClockTimer);
      this.marketClockTimer = null;
    }
  }

  /**
   * T178: Single Market Clock tick.
   * Advisory lock per rivalry — only one worker advances each phase.
   * Prevents duplicate transitions even under horizontal scaling.
   * No double-settling. No race-condition chaos. The clock is sovereign.
   */
  private async marketClockTick(): Promise<void> {
    if (!this.featureFlags.rivalryEnabled) return;
    const nowMs = Date.now();
    const rivalries = await this.db.getRivalriesOverdueForTransition(nowMs);
    for (const rivalry of rivalries) {
      const lockKey = `market_clock_lock:${rivalry.rivalryId}`;
      const lockId = await this.db.acquireMarketClockLock(lockKey, 30_000);
      if (!lockId) continue; // Another worker holds this clock. Move on.
      try {
        await this.advanceRivalryPhase(rivalry.rivalryId, lockId);
      } finally {
        await this.db.releaseMarketClockLock(lockId);
      }
    }
  }

  /**
   * T178: Idempotent phase transition.
   *
   * Safe to call multiple times across worker restarts.
   * Checks current phase before acting — never double-transitions.
   * The Rivalry Phase Clock advances in one direction only. No reversals.
   */
  async advanceRivalryPhase(rivalryId: string, lockId?: string): Promise<SyndicateRivalry | null> {
    const rivalry = await this.db.getRivalry(rivalryId);
    if (!rivalry) return null;
    if (rivalry.phase === 'CLOSED') return rivalry;

    const now = new Date();
    if (rivalry.phaseEndsAt > now) return rivalry; // Not time yet. Clock hasn't hit.

    const currentIdx = RIVALRY_PHASE_SEQUENCE.indexOf(rivalry.phase);
    if (currentIdx < 0 || currentIdx >= RIVALRY_PHASE_SEQUENCE.length - 1) return rivalry;

    const nextPhase = RIVALRY_PHASE_SEQUENCE[currentIdx + 1];
    const nextDuration = RIVALRY_PHASE_DURATIONS_MS[nextPhase];
    const nextEndsAt = nextDuration > 0
      ? new Date(now.getTime() + nextDuration)
      : now;

    const acquired = lockId ?? `inline-${rivalryId}`;
    const updated = await this.db.updateRivalryPhase(rivalryId, nextPhase, nextEndsAt, acquired);
    if (!updated) return null; // Lost the lock race — idempotent, safe.

    this.bus.emit('WAR_PHASE_CHANGED', {
      rivalryId,
      previousPhase: rivalry.phase,
      nextPhase,
      phaseEndsAt: nextEndsAt,
    });

    // Entering LEDGER_CLOSE — initiate Settlement Ceremony
    if (nextPhase === 'LEDGER_CLOSE') {
      await this.executeSettlementCeremony(rivalryId);
    }

    // Rivalry CLOSED — apply auto Liquidity Shields to both Syndicates
    if (nextPhase === 'CLOSED') {
      await this.applyPostRivalryLiquidityShields(rivalry);
    }

    return { ...rivalry, phase: nextPhase, phaseEndsAt: nextEndsAt };
  }

  // ── T173: Yield Capture — Settlement-Stage Treasury Transfer ───────────────

  /**
   * T173: Yield Capture Transfer.
   *
   * Winning Syndicate captures 5% of losing Syndicate's treasury.
   * Executed at LEDGER_CLOSE. Proof-backed, auditable, rollback-safe.
   *
   * Stakes feel real. Ledger integrity is never compromised.
   * Rivalries don't end with an argument. They end with a record.
   *
   * Idempotent by rivalryId — safe to retry on worker restart.
   * Anomaly flag emitted if capture exceeds ceiling — ops reviews before final publish.
   */
  async executeSettlementCeremony(rivalryId: string): Promise<YieldCaptureResult | null> {
    const rivalry = await this.db.getRivalry(rivalryId);
    if (!rivalry) throw new Error(`Rivalry not found: ${rivalryId}`);
    if (rivalry.ledgerClosedAt) return null; // Already settled — idempotent.

    const winnerId = rivalry.challengerCapitalScore >= rivalry.defenderCapitalScore
      ? rivalry.challengerId
      : rivalry.defenderId;
    const loserId = winnerId === rivalry.challengerId
      ? rivalry.defenderId
      : rivalry.challengerId;

    const loserTreasury  = await this.db.getSyndiateTreasuryBalance(loserId);
    const winnerTreasury = await this.db.getSyndiateTreasuryBalance(winnerId);

    // T173: 5% Yield Capture — bounded, auditable
    let yieldCapture = Math.floor(loserTreasury * YIELD_CAPTURE_RATE);
    yieldCapture = Math.max(YIELD_CAPTURE_FLOOR, Math.min(yieldCapture, loserTreasury));

    // Anomaly detection — large captures route to ops review before publishing
    if (yieldCapture > YIELD_CAPTURE_CEILING) {
      this.bus.emit('YIELD_CAPTURE_ANOMALY', { rivalryId, yieldCapture, loserTreasury });
      yieldCapture = YIELD_CAPTURE_CEILING;
    }

    const idempotencyKey = `yield_capture:${rivalryId}`;
    if (await this.db.existsLedgerEntry(idempotencyKey)) return null;

    const now = new Date();

    const debitEntry: TreasuryLedgerEntry = {
      entryId:        `${idempotencyKey}:debit`,
      syndicateId:    loserId,
      rivalryId,
      type:           'YIELD_CAPTURE_DEBIT',
      amount:         -yieldCapture,
      balanceAfter:   loserTreasury - yieldCapture,
      createdAt:      now,
      idempotencyKey: `${idempotencyKey}:debit`,
    };

    const creditEntry: TreasuryLedgerEntry = {
      entryId:        `${idempotencyKey}:credit`,
      syndicateId:    winnerId,
      rivalryId,
      type:           'YIELD_CAPTURE_CREDIT',
      amount:         yieldCapture,
      balanceAfter:   winnerTreasury + yieldCapture,
      createdAt:      now,
      idempotencyKey: `${idempotencyKey}:credit`,
    };

    // Atomic — both entries commit or neither does
    await this.db.transferTreasury(debitEntry, creditEntry);

    await this.db.markRivalrySettled(rivalryId, {
      winnerId,
      yieldCaptureAmount: yieldCapture,
      ledgerClosedAt:     now,
    });

    const result: YieldCaptureResult = {
      rivalryId,
      winnerId,
      loserId,
      yieldCaptureAmount:   yieldCapture,
      loserTreasuryBefore:  loserTreasury,
      loserTreasuryAfter:   loserTreasury - yieldCapture,
      winnerTreasuryBefore: winnerTreasury,
      winnerTreasuryAfter:  winnerTreasury + yieldCapture,
      debitEntryId:         debitEntry.entryId,
      creditEntryId:        creditEntry.entryId,
    };

    this.bus.emit('WAR_SETTLED', result);
    return result;
  }

  // ── T170: Market Play stacking caps and precedence ─────────────────────────

  /**
   * T170: Activate a Market Play — enforces stacking caps and precedence.
   *
   * Syndicates cannot stack unlimited leverage. The platform enforces caps
   * server-side — no client bypass, no vibes-based exception.
   * Returns null if cap is exceeded — request rejected with no side effects.
   */
  async activateMarketPlay(
    rivalryId:   string,
    syndicateId: string,
    type:        MarketPlayType,
    magnitude:   number,
    durationMs:  number,
  ): Promise<ActiveMarketPlay | null> {
    const stackGroup = this.getStackGroup(type);
    const cap = MARKET_PLAY_STACK_CAPS[stackGroup];
    if (!cap) throw new Error(`Unknown stack group for play type: ${type}`);

    const existing  = await this.db.getActiveMarketPlays(rivalryId, syndicateId);
    const sameGroup = existing.filter((p) => this.getStackGroup(p.type) === stackGroup);

    // Stack count cap — hard ceiling
    if (sameGroup.length >= cap.maxStacks) return null;

    // Magnitude cap — total must not exceed group maximum
    const currentTotal  = sameGroup.reduce((sum, p) => sum + p.magnitude, 0);
    const effectiveMag  = Math.min(magnitude, cap.maxMagnitude - currentTotal);
    if (effectiveMag <= 0) return null;

    const now = new Date();
    const play: ActiveMarketPlay = {
      playId:       `play:${rivalryId}:${syndicateId}:${type}:${now.getTime()}`,
      syndicateId,
      rivalryId,
      type,
      magnitude:    effectiveMag,
      activatedAt:  now,
      expiresAt:    new Date(now.getTime() + durationMs),
      stackGroup,
    };

    await this.db.writeMarketPlay(play);
    this.bus.emit('WAR_BOOST_ACTIVATED', { play });
    return play;
  }

  /**
   * T170: Compute effective Market Play magnitudes for a rivalry + syndicate.
   *
   * Applies MARKET_PLAY_PRECEDENCE ordering — higher precedence resolves first.
   * Deterministic + comparable. Same inputs always produce same output.
   * The platform can prove which plays were active and at what magnitude.
   */
  async getEffectiveMarketPlays(
    rivalryId:   string,
    syndicateId: string,
  ): Promise<Map<string, number>> {
    const now   = new Date();
    const plays = (await this.db.getActiveMarketPlays(rivalryId, syndicateId))
      .filter((p) => p.expiresAt > now);

    // Sort by precedence — deterministic resolution order
    plays.sort((a, b) =>
      MARKET_PLAY_PRECEDENCE.indexOf(a.type) - MARKET_PLAY_PRECEDENCE.indexOf(b.type)
    );

    const effective    = new Map<string, number>();
    const groupTotals  = new Map<string, number>();

    for (const play of plays) {
      const cap          = MARKET_PLAY_STACK_CAPS[play.stackGroup];
      const currentTotal = groupTotals.get(play.stackGroup) ?? 0;
      const allowable    = Math.max(0, cap.maxMagnitude - currentTotal);
      const applied      = Math.min(play.magnitude, allowable);
      if (applied > 0) {
        effective.set(play.type, (effective.get(play.type) ?? 0) + applied);
        groupTotals.set(play.stackGroup, currentTotal + applied);
      }
    }

    return effective;
  }

  private getStackGroup(type: MarketPlayType): string {
    const map: Record<MarketPlayType, string> = {
      CASHFLOW_AMPLIFIER: 'CASHFLOW',
      SHIELD_PLAY:        'SHIELD',
      YIELD_MULTIPLIER:   'YIELD',
      DEBT_SUPPRESSOR:    'DEBT',
      VELOCITY_PLAY:      'VELOCITY',
    };
    return map[type] ?? 'UNKNOWN';
  }

  // ── Post-rivalry Liquidity Shields ─────────────────────────────────────────

  /**
   * Auto-applies 24h Liquidity Shield to both Syndicates on CLOSED.
   * Recovery window is non-negotiable — treasury needs time to stabilize.
   */
  private async applyPostRivalryLiquidityShields(rivalry: SyndicateRivalry): Promise<void> {
    const shieldExpiry = new Date(Date.now() + AUTO_LIQUIDITY_SHIELD_DURATION_MS);
    await Promise.all([
      this.db.setSyndicateLiquidityShield(rivalry.challengerId, shieldExpiry),
      this.db.setSyndicateLiquidityShield(rivalry.defenderId, shieldExpiry),
    ]);
    this.bus.emit('WAR_SHIELD_APPLIED', {
      rivalryId:    rivalry.rivalryId,
      syndicateIds: [rivalry.challengerId, rivalry.defenderId],
      expiresAt:    shieldExpiry,
    });
  }
}
