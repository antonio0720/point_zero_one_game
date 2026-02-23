/**
 * AllianceWarService.ts
 * Covers: T170 (boost stacking caps), T173 (plunder transfer), T178 (phase scheduler hardening)
 *
 * War lifecycle: DECLARED → PREPARATION (2h) → ACTIVE (24h) → SETTLEMENT (1h) → ENDED
 * Plunder: winner takes 5% of losing alliance vault (capped, transactional)
 * Boosts: deterministic precedence, stacking caps enforced server-side
 * Scheduler: idempotent, advisory-locked, boot-recovery scan
 */

import { EventEmitter } from 'events';

// ─── Types ────────────────────────────────────────────────────────────────────

export type WarPhase = 'DECLARED' | 'PREPARATION' | 'ACTIVE' | 'SETTLEMENT' | 'ENDED';

export type BoostType =
  | 'ATTACK_MULTIPLIER'
  | 'DEFENSE_MULTIPLIER'
  | 'POINT_AMPLIFIER'
  | 'VAULT_SHIELD'
  | 'SPEED_BOOST';

export interface ActiveBoost {
  boostId: string;
  allianceId: string;
  warId: string;
  type: BoostType;
  magnitude: number;        // e.g. 0.25 = 25%
  activatedAt: Date;
  expiresAt: Date;
  stackGroup: string;       // boosts in same group compete for cap
}

export interface War {
  warId: string;
  attackerId: string;
  defenderId: string;
  phase: WarPhase;
  declaredAt: Date;
  phaseStartedAt: Date;
  phaseEndsAt: Date;
  attackerPoints: number;
  defenderPoints: number;
  plunderAmount?: number;
  winnerId?: string;
  proofHash?: string;
  schedulerLockId?: string;
  settlementProcessedAt?: Date;
}

export interface VaultLedgerEntry {
  entryId: string;
  allianceId: string;
  warId: string;
  type: 'PLUNDER_DEBIT' | 'PLUNDER_CREDIT' | 'BOOST_SPEND' | 'CONTRIBUTION';
  amount: number;
  balanceAfter: number;
  createdAt: Date;
  idempotencyKey: string;
}

export interface PlunderResult {
  warId: string;
  winnerId: string;
  loserId: string;
  plunderAmount: number;
  loserVaultBefore: number;
  loserVaultAfter: number;
  winnerVaultBefore: number;
  winnerVaultAfter: number;
  debitEntryId: string;
  creditEntryId: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const WAR_PHASE_DURATIONS_MS: Record<WarPhase, number> = {
  DECLARED:    0,
  PREPARATION: 2  * 60 * 60 * 1000,   // 2h
  ACTIVE:      24 * 60 * 60 * 1000,   // 24h
  SETTLEMENT:  1  * 60 * 60 * 1000,   // 1h
  ENDED:       0,
};

export const WAR_PHASE_SEQUENCE: WarPhase[] = [
  'DECLARED',
  'PREPARATION',
  'ACTIVE',
  'SETTLEMENT',
  'ENDED',
];

export const AUTO_SHIELD_DURATION_MS = 24 * 60 * 60 * 1000; // 24h post-war

/** T170: Boost stacking caps per stack group */
export const BOOST_STACK_CAPS: Record<string, { maxStacks: number; maxMagnitude: number }> = {
  ATTACK:   { maxStacks: 2, maxMagnitude: 0.50 },   // max +50% attack total
  DEFENSE:  { maxStacks: 2, maxMagnitude: 0.50 },
  POINTS:   { maxStacks: 1, maxMagnitude: 0.30 },   // only 1 point amplifier at a time
  VAULT:    { maxStacks: 1, maxMagnitude: 1.00 },   // vault shield: binary
  SPEED:    { maxStacks: 3, maxMagnitude: 0.75 },
};

/** T170: Precedence order — lower index wins if conflict */
export const BOOST_PRECEDENCE: BoostType[] = [
  'VAULT_SHIELD',
  'DEFENSE_MULTIPLIER',
  'ATTACK_MULTIPLIER',
  'POINT_AMPLIFIER',
  'SPEED_BOOST',
];

export const PLUNDER_RATE = 0.05;          // T173: 5% of losing vault
export const PLUNDER_MIN = 0;
export const PLUNDER_MAX = 1_000_000;      // hard ceiling — anomaly flag above this

// ─── Database interface (inject your actual DB client) ────────────────────────

export interface IWarDatabase {
  getWar(warId: string): Promise<War | null>;
  updateWarPhase(warId: string, phase: WarPhase, phaseEndsAt: Date, lockId: string): Promise<boolean>;
  getWarsByPhase(phase: WarPhase): Promise<War[]>;
  getWarsOverdueForTransition(nowMs: number): Promise<War[]>;
  markWarSettled(warId: string, result: Partial<War>): Promise<void>;
  acquireAdvisoryLock(lockKey: string, ttlMs: number): Promise<string | null>;
  releaseAdvisoryLock(lockId: string): Promise<void>;
  getAllianceVaultBalance(allianceId: string): Promise<number>;
  writeVaultLedgerEntry(entry: VaultLedgerEntry): Promise<void>;
  transferVault(debit: VaultLedgerEntry, credit: VaultLedgerEntry): Promise<void>;
  getActiveBoosts(warId: string, allianceId: string): Promise<ActiveBoost[]>;
  writeBoost(boost: ActiveBoost): Promise<void>;
  expireBoost(boostId: string): Promise<void>;
  existsLedgerEntry(idempotencyKey: string): Promise<boolean>;
  setAllianceShield(allianceId: string, expiresAt: Date): Promise<void>;
}

export interface IEventBus {
  emit(event: string, payload: unknown): void;
}

// ─── AllianceWarService ────────────────────────────────────────────────────────

export class AllianceWarService extends EventEmitter {
  private schedulerRunning = false;
  private schedulerTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly db: IWarDatabase,
    private readonly bus: IEventBus,
    private readonly featureFlags: { warEnabled: boolean },
  ) {
    super();
  }

  // ── T178: Boot recovery scan ────────────────────────────────────────────────

  /**
   * Call on service startup. Finds all wars whose phaseEndsAt has passed
   * but phase has not advanced. Processes them in order, idempotently.
   */
  async recoverStaleTransitions(): Promise<void> {
    const nowMs = Date.now();
    const stale = await this.db.getWarsOverdueForTransition(nowMs);
    for (const war of stale) {
      try {
        await this.advanceWarPhase(war.warId);
      } catch (err) {
        this.emit('SCHEDULER_RECOVERY_ERROR', { warId: war.warId, err });
      }
    }
  }

  // ── T178: Phase scheduler ───────────────────────────────────────────────────

  startScheduler(intervalMs = 60_000): void {
    if (this.schedulerRunning) return;
    this.schedulerRunning = true;
    this.schedulerTimer = setInterval(() => this.schedulerTick(), intervalMs);
    // Run immediately on start
    this.schedulerTick().catch((err) =>
      this.emit('SCHEDULER_ERROR', { err })
    );
  }

  stopScheduler(): void {
    this.schedulerRunning = false;
    if (this.schedulerTimer) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
  }

  /**
   * T178: Single scheduler tick — finds wars ready to advance.
   * Uses advisory lock so only one worker processes each war.
   */
  private async schedulerTick(): Promise<void> {
    if (!this.featureFlags.warEnabled) return;
    const nowMs = Date.now();
    const wars = await this.db.getWarsOverdueForTransition(nowMs);
    for (const war of wars) {
      // Advisory lock per war — prevents duplicate transitions across workers
      const lockKey = `war_phase_lock:${war.warId}`;
      const lockId = await this.db.acquireAdvisoryLock(lockKey, 30_000);
      if (!lockId) continue; // another worker has it
      try {
        await this.advanceWarPhase(war.warId, lockId);
      } finally {
        await this.db.releaseAdvisoryLock(lockId);
      }
    }
  }

  /**
   * T178: Idempotent phase transition.
   * Safe to call multiple times — checks current phase before acting.
   */
  async advanceWarPhase(warId: string, lockId?: string): Promise<War | null> {
    const war = await this.db.getWar(warId);
    if (!war) return null;
    if (war.phase === 'ENDED') return war;

    const now = new Date();
    if (war.phaseEndsAt > now) return war; // not time yet

    const currentIdx = WAR_PHASE_SEQUENCE.indexOf(war.phase);
    if (currentIdx < 0 || currentIdx >= WAR_PHASE_SEQUENCE.length - 1) return war;

    const nextPhase = WAR_PHASE_SEQUENCE[currentIdx + 1];
    const nextDuration = WAR_PHASE_DURATIONS_MS[nextPhase];
    const nextEndsAt = nextDuration > 0
      ? new Date(now.getTime() + nextDuration)
      : now;

    const acquired = lockId ?? war.schedulerLockId ?? `inline-${warId}`;
    const updated = await this.db.updateWarPhase(warId, nextPhase, nextEndsAt, acquired);
    if (!updated) return null; // lost the lock race — idempotent, OK

    this.bus.emit('WAR_PHASE_CHANGED', {
      warId,
      previousPhase: war.phase,
      nextPhase,
      phaseEndsAt: nextEndsAt,
    });

    // Trigger settlement when entering SETTLEMENT phase
    if (nextPhase === 'SETTLEMENT') {
      await this.processSettlement(warId);
    }

    // Apply auto-shield when war ENDS
    if (nextPhase === 'ENDED') {
      await this.applyPostWarShields(war);
    }

    return { ...war, phase: nextPhase, phaseEndsAt: nextEndsAt };
  }

  // ── T173: Plunder transfer ──────────────────────────────────────────────────

  /**
   * T173: Transactionally compute and transfer plunder.
   * Idempotent — safe to retry via idempotencyKey.
   * Anomaly flag if plunder exceeds PLUNDER_MAX.
   */
  async processSettlement(warId: string): Promise<PlunderResult | null> {
    const war = await this.db.getWar(warId);
    if (!war) throw new Error(`War not found: ${warId}`);
    if (war.settlementProcessedAt) {
      // Already settled — idempotent return
      return null;
    }

    const winnerId = war.attackerPoints >= war.defenderPoints
      ? war.attackerId
      : war.defenderId;
    const loserId = winnerId === war.attackerId ? war.defenderId : war.attackerId;

    const loserVault = await this.db.getAllianceVaultBalance(loserId);
    const winnerVault = await this.db.getAllianceVaultBalance(winnerId);

    // T173: 5% plunder, capped, floored at 0
    let plunder = Math.floor(loserVault * PLUNDER_RATE);
    plunder = Math.max(PLUNDER_MIN, Math.min(plunder, loserVault)); // can't take more than exists

    const isAnomaly = plunder > PLUNDER_MAX;
    if (isAnomaly) {
      this.bus.emit('WAR_SETTLEMENT_ANOMALY', { warId, plunder, loserVault });
      plunder = PLUNDER_MAX; // cap and continue; ops team reviews async
    }

    const idempotencyKey = `plunder:${warId}`;
    const alreadyProcessed = await this.db.existsLedgerEntry(idempotencyKey);
    if (alreadyProcessed) return null;

    const now = new Date();
    const debitEntry: VaultLedgerEntry = {
      entryId:        `${idempotencyKey}:debit`,
      allianceId:     loserId,
      warId,
      type:           'PLUNDER_DEBIT',
      amount:         -plunder,
      balanceAfter:   loserVault - plunder,
      createdAt:      now,
      idempotencyKey: `${idempotencyKey}:debit`,
    };

    const creditEntry: VaultLedgerEntry = {
      entryId:        `${idempotencyKey}:credit`,
      allianceId:     winnerId,
      warId,
      type:           'PLUNDER_CREDIT',
      amount:         plunder,
      balanceAfter:   winnerVault + plunder,
      createdAt:      now,
      idempotencyKey: `${idempotencyKey}:credit`,
    };

    // Atomic transfer — both entries written or neither
    await this.db.transferVault(debitEntry, creditEntry);

    await this.db.markWarSettled(warId, {
      winnerId,
      plunderAmount: plunder,
      settlementProcessedAt: now,
    });

    const result: PlunderResult = {
      warId,
      winnerId,
      loserId,
      plunderAmount:    plunder,
      loserVaultBefore: loserVault,
      loserVaultAfter:  loserVault - plunder,
      winnerVaultBefore: winnerVault,
      winnerVaultAfter:  winnerVault + plunder,
      debitEntryId:     debitEntry.entryId,
      creditEntryId:    creditEntry.entryId,
    };

    this.bus.emit('WAR_SETTLED', result);
    return result;
  }

  // ── T170: Boost stacking caps and precedence ────────────────────────────────

  /**
   * T170: Activate a boost — enforces stacking caps and precedence.
   * Returns null if cap is exceeded (request rejected).
   */
  async activateBoost(
    warId: string,
    allianceId: string,
    type: BoostType,
    magnitude: number,
    durationMs: number,
  ): Promise<ActiveBoost | null> {
    const stackGroup = this.getStackGroup(type);
    const cap = BOOST_STACK_CAPS[stackGroup];
    if (!cap) throw new Error(`Unknown stack group for boost type: ${type}`);

    const existing = await this.db.getActiveBoosts(warId, allianceId);
    const sameGroup = existing.filter((b) => this.getStackGroup(b.type) === stackGroup);

    // T170: Stack count cap
    if (sameGroup.length >= cap.maxStacks) {
      return null; // rejected — too many stacks
    }

    // T170: Magnitude cap — total existing + new must not exceed cap
    const totalMagnitude = sameGroup.reduce((sum, b) => sum + b.magnitude, 0) + magnitude;
    const effectiveMagnitude = Math.min(magnitude, cap.maxMagnitude - (totalMagnitude - magnitude));
    if (effectiveMagnitude <= 0) {
      return null; // rejected — magnitude already maxed
    }

    const now = new Date();
    const boost: ActiveBoost = {
      boostId:     `boost:${warId}:${allianceId}:${type}:${now.getTime()}`,
      allianceId,
      warId,
      type,
      magnitude:   effectiveMagnitude,
      activatedAt: now,
      expiresAt:   new Date(now.getTime() + durationMs),
      stackGroup,
    };

    await this.db.writeBoost(boost);
    this.bus.emit('WAR_BOOST_ACTIVATED', { boost });
    return boost;
  }

  /**
   * T170: Compute effective boost magnitude for a war + alliance.
   * Applies precedence ordering — higher precedence boosts resolve first.
   */
  async getEffectiveBoosts(warId: string, allianceId: string): Promise<Map<string, number>> {
    const now = new Date();
    const boosts = (await this.db.getActiveBoosts(warId, allianceId))
      .filter((b) => b.expiresAt > now);

    // Sort by precedence (lower index = higher priority)
    boosts.sort((a, b) =>
      BOOST_PRECEDENCE.indexOf(a.type) - BOOST_PRECEDENCE.indexOf(b.type)
    );

    const effective = new Map<string, number>();
    const groupTotals = new Map<string, number>();

    for (const boost of boosts) {
      const cap = BOOST_STACK_CAPS[boost.stackGroup];
      const currentTotal = groupTotals.get(boost.stackGroup) ?? 0;
      const allowable = Math.max(0, cap.maxMagnitude - currentTotal);
      const applied = Math.min(boost.magnitude, allowable);
      if (applied > 0) {
        effective.set(boost.type, (effective.get(boost.type) ?? 0) + applied);
        groupTotals.set(boost.stackGroup, currentTotal + applied);
      }
    }

    return effective;
  }

  private getStackGroup(type: BoostType): string {
    const map: Record<BoostType, string> = {
      ATTACK_MULTIPLIER:  'ATTACK',
      DEFENSE_MULTIPLIER: 'DEFENSE',
      POINT_AMPLIFIER:    'POINTS',
      VAULT_SHIELD:       'VAULT',
      SPEED_BOOST:        'SPEED',
    };
    return map[type] ?? 'UNKNOWN';
  }

  // ── Post-war auto-shield ────────────────────────────────────────────────────

  private async applyPostWarShields(war: War): Promise<void> {
    const shieldExpiry = new Date(Date.now() + AUTO_SHIELD_DURATION_MS);
    // Both alliances get auto-shield after war ends
    await Promise.all([
      this.db.setAllianceShield(war.attackerId, shieldExpiry),
      this.db.setAllianceShield(war.defenderId, shieldExpiry),
    ]);
    this.bus.emit('WAR_SHIELD_APPLIED', {
      warId:      war.warId,
      allianceIds: [war.attackerId, war.defenderId],
      expiresAt:  shieldExpiry,
    });
  }
}
