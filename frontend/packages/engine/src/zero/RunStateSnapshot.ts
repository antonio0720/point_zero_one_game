//Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/zero/RunStateSnapshot.ts

// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — ENGINE 0 RUN STATE SNAPSHOT
// pzo-web/src/engines/zero/RunStateSnapshot.ts
//
// Read-only run state assembled ONCE per tick by EngineOrchestrator, before
// Step 1. Passed as a parameter to every engine method that needs game state.
//
// IMMUTABILITY CONTRACT:
//   ✦ All fields are readonly at the TypeScript level.
//   ✦ Object.freeze(this) is called in the constructor — runtime enforcement.
//   ✦ Any engine that writes to a snapshot field gets a runtime TypeError.
//   ✦ Engines track mutable state internally; the snapshot is what they READ
//     about the world, not what they write.
//
// LIFETIME:
//   ✦ Built once per tick before Step 1. NOT rebuilt between steps.
//   ✦ Does not persist between ticks. Next tick = fresh snapshot.
//   ✦ Never store a snapshot reference — always use the argument passed to you.
//
// DERIVED GETTERS:
//   ✦ hasCrossedFreedomThreshold — win condition check
//   ✦ isBankrupt                 — loss condition check
//   ✦ isTimedOut                 — timeout condition check
//   ✦ shieldHealthNormalized     — overall shield health 0.0–1.0
//
// Density6 LLC · Point Zero One · Engine 0 · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import type { RunStateSnapshotFields, DecisionRecordField, TickTier, PressureTier } from './types';

/**
 * Read-only run state snapshot.
 *
 * Assembled once per tick by EngineOrchestrator before Step 1.
 * Passed as a parameter to every engine method that needs game state.
 * NEVER passed by reference to be stored — always fresh per tick.
 *
 * Shield layer maximums are fixed constants defined in the spec:
 *   L1 (LIQUIDITY_BUFFER) max = 100
 *   L2 (CREDIT_LINE)      max = 80
 *   L3 (ASSET_FLOOR)      max = 60
 *   L4 (NETWORK_CORE)     max = 40
 *   Total max              = 280
 */
export class RunStateSnapshot implements Readonly<RunStateSnapshotFields> {

  // ── Tick metadata ──────────────────────────────────────────────────────────
  readonly runId:                   string;
  readonly userId:                  string;
  readonly seed:                    string;
  readonly tickIndex:               number;
  readonly seasonTickBudget:        number;
  readonly ticksRemaining:          number;
  readonly freedomThreshold:        number;

  // ── Financial state ────────────────────────────────────────────────────────
  readonly netWorth:                number;
  readonly cashBalance:             number;
  readonly monthlyIncome:           number;
  readonly monthlyExpenses:         number;
  readonly cashflow:                number; // pre-computed: monthlyIncome - monthlyExpenses

  // ── Time Engine state ──────────────────────────────────────────────────────
  readonly currentTickTier:         TickTier;
  readonly currentTickDurationMs:   number;
  readonly activeDecisionWindows:   number;
  readonly holdsRemaining:          number;

  // ── Pressure Engine state ──────────────────────────────────────────────────
  readonly pressureScore:           number;
  readonly pressureTier:            PressureTier;
  readonly ticksWithoutIncomeGrowth: number;

  // ── Tension Engine state ───────────────────────────────────────────────────
  readonly tensionScore:            number;
  readonly anticipationQueueDepth:  number;
  readonly threatVisibilityState:   string;

  // ── Shield Engine state ────────────────────────────────────────────────────
  readonly shieldAvgIntegrityPct:   number;
  readonly shieldL1Integrity:       number;
  readonly shieldL2Integrity:       number;
  readonly shieldL3Integrity:       number;
  readonly shieldL4Integrity:       number;
  readonly shieldL1Max:             number; // 100
  readonly shieldL2Max:             number; // 80
  readonly shieldL3Max:             number; // 60
  readonly shieldL4Max:             number; // 40

  // ── Battle Engine state ────────────────────────────────────────────────────
  readonly haterHeat:               number;
  readonly activeBotCount:          number;
  readonly haterAttemptsThisTick:   number;
  readonly haterBlockedThisTick:    number;
  readonly haterDamagedThisTick:    number;
  readonly activeThreatCardCount:   number;

  // ── Cascade Engine state ───────────────────────────────────────────────────
  readonly activeCascadeChains:       number;
  readonly cascadesTriggeredThisTick: number;
  readonly cascadesBrokenThisTick:    number;

  // ── Decision tracking ──────────────────────────────────────────────────────
  readonly decisionsThisTick: DecisionRecordField[];

  constructor(fields: RunStateSnapshotFields) {
    // Assign all fields from the input plain object
    this.runId                    = fields.runId;
    this.userId                   = fields.userId;
    this.seed                     = fields.seed;
    this.tickIndex                = fields.tickIndex;
    this.seasonTickBudget         = fields.seasonTickBudget;
    this.ticksRemaining           = fields.ticksRemaining;
    this.freedomThreshold         = fields.freedomThreshold;

    this.netWorth                 = fields.netWorth;
    this.cashBalance              = fields.cashBalance;
    this.monthlyIncome            = fields.monthlyIncome;
    this.monthlyExpenses          = fields.monthlyExpenses;
    // cashflow is always computed at construction — never trust an incoming value
    this.cashflow                 = fields.monthlyIncome - fields.monthlyExpenses;

    this.currentTickTier          = fields.currentTickTier;
    this.currentTickDurationMs    = fields.currentTickDurationMs;
    this.activeDecisionWindows    = fields.activeDecisionWindows;
    this.holdsRemaining           = fields.holdsRemaining;

    this.pressureScore            = fields.pressureScore;
    this.pressureTier             = fields.pressureTier;
    this.ticksWithoutIncomeGrowth = fields.ticksWithoutIncomeGrowth;

    this.tensionScore             = fields.tensionScore;
    this.anticipationQueueDepth   = fields.anticipationQueueDepth;
    this.threatVisibilityState    = fields.threatVisibilityState;

    this.shieldAvgIntegrityPct    = fields.shieldAvgIntegrityPct;
    this.shieldL1Integrity        = fields.shieldL1Integrity;
    this.shieldL2Integrity        = fields.shieldL2Integrity;
    this.shieldL3Integrity        = fields.shieldL3Integrity;
    this.shieldL4Integrity        = fields.shieldL4Integrity;
    this.shieldL1Max              = 100; // immutable spec constant
    this.shieldL2Max              = 80;  // immutable spec constant
    this.shieldL3Max              = 60;  // immutable spec constant
    this.shieldL4Max              = 40;  // immutable spec constant

    this.haterHeat                = fields.haterHeat;
    this.activeBotCount           = fields.activeBotCount;
    this.haterAttemptsThisTick    = fields.haterAttemptsThisTick;
    this.haterBlockedThisTick     = fields.haterBlockedThisTick;
    this.haterDamagedThisTick     = fields.haterDamagedThisTick;
    this.activeThreatCardCount    = fields.activeThreatCardCount;

    this.activeCascadeChains        = fields.activeCascadeChains;
    this.cascadesTriggeredThisTick  = fields.cascadesTriggeredThisTick;
    this.cascadesBrokenThisTick     = fields.cascadesBrokenThisTick;

    this.decisionsThisTick        = fields.decisionsThisTick;

    // Runtime immutability enforcement — any write attempt throws TypeError
    Object.freeze(this);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DERIVED GETTERS — computed from frozen fields, never stored
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Has the player achieved the freedom threshold (FREEDOM win condition)?
   * Checked by EngineOrchestrator after Step 12, before Step 13.
   * Priority: FREEDOM > BANKRUPT > TIMEOUT.
   */
  get hasCrossedFreedomThreshold(): boolean {
    return this.netWorth >= this.freedomThreshold;
  }

  /**
   * Is the player in a bankrupt state (BANKRUPT loss condition)?
   * Bankrupt = negative cash balance AND negative cashflow simultaneously.
   * A player with negative balance but positive cashflow is recovering — not bankrupt.
   */
  get isBankrupt(): boolean {
    return this.cashBalance < 0 && this.cashflow < 0;
  }

  /**
   * Has the run exhausted its tick budget (TIMEOUT loss condition)?
   */
  get isTimedOut(): boolean {
    return this.ticksRemaining <= 0;
  }

  /**
   * Overall shield health as a normalized float 0.0–1.0.
   * Computed from per-layer integrity vs per-layer max.
   *
   * Total max = 100 + 80 + 60 + 40 = 280.
   */
  get shieldHealthNormalized(): number {
    const totalCurrent =
      this.shieldL1Integrity +
      this.shieldL2Integrity +
      this.shieldL3Integrity +
      this.shieldL4Integrity;
    const totalMax =
      this.shieldL1Max +
      this.shieldL2Max +
      this.shieldL3Max +
      this.shieldL4Max; // 280
    return totalMax > 0 ? totalCurrent / totalMax : 0;
  }

  /**
   * Is any shield layer fully breached (integrity === 0)?
   * Convenience check for engines that need to know before routing attacks.
   */
  get hasAnyBreachedLayer(): boolean {
    return (
      this.shieldL1Integrity === 0 ||
      this.shieldL2Integrity === 0 ||
      this.shieldL3Integrity === 0 ||
      this.shieldL4Integrity === 0
    );
  }

  /**
   * Pressure as a 0–100 integer percentage (display helper).
   */
  get pressurePct(): number {
    return Math.round(this.pressureScore * 100);
  }

  /**
   * Tension as a 0–100 integer percentage (display helper).
   */
  get tensionPct(): number {
    return Math.round(this.tensionScore * 100);
  }
}