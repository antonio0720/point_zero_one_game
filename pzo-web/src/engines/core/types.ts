// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — CORE ENGINE TYPES
// FILE: pzo-web/src/engines/core/types.ts
// VERSION: 2026.03.23-sovereign-depth.v2
// AUTHORSHIP: Antonio T. Smith Jr.
// LICENSE: Internal / Proprietary / All Rights Reserved
// ═══════════════════════════════════════════════════════════════════════════════
//
// Purpose
// -------
// Canonical core contracts for Engine 0 and the seven simulation engines that
// coordinate through it. This file is intentionally rich because Point Zero One
// does not treat the core as a thin utility layer. The core is the legal
// boundary for deterministic tick execution, the event envelope, snapshot truth,
// shield combat, bot aggression, cascade sequencing, sabotage, co-op rescue,
// ghost proofing, and mode-specific state surfaces.
//
// Design doctrine
// ---------------
// - Zero runtime logic beyond immutable constants and registries.
// - Preserve existing repo export names so current engine surfaces do not drift.
// - Widen the contract surface instead of flattening it.
// - Let richer engines opt into deeper typing without forcing generic cleanup
//   churn across heterogeneous compatibility lanes.
// - The core must serve both the current extracted engine lane and the longer-
//   horizon seven-engine orchestration doctrine supplied in the design spec.
// ═══════════════════════════════════════════════════════════════════════════════

// ── Scalar helpers ────────────────────────────────────────────────────────────

export type UnixMs = number;
export type TickIndex = number;
export type CurrencyAmount = number;
export type Percentage01 = number;
export type Percentage100 = number;
export type Probability = number;

export interface ValueRange {
  readonly min: number;
  readonly max: number;
}

export interface WeightedSignal {
  readonly key: string;
  readonly label: string;
  readonly weight: number;
  readonly value: number;
  readonly contribution: number;
}

// ── Run lifecycle ─────────────────────────────────────────────────────────────

/** All possible outcomes when a run ends. Drives sovereignty multiplier logic. */
export type RunOutcome = 'FREEDOM' | 'TIMEOUT' | 'BANKRUPT' | 'ABANDONED';

/** Run lifecycle state. EngineOrchestrator is the sole writer. */
export type RunLifecycleState =
  | 'IDLE'
  | 'STARTING'
  | 'ACTIVE'
  | 'TICK_LOCKED'
  | 'ENDING'
  | 'ENDED';

/** The four current playable surfaces. */
export type RunMode = 'solo' | 'asymmetric-pvp' | 'co-op' | 'ghost';

export const RUN_MODE_IDS = Object.freeze([
  'solo',
  'asymmetric-pvp',
  'co-op',
  'ghost',
] as const satisfies readonly RunMode[]);

export const RUN_OUTCOMES = Object.freeze([
  'FREEDOM',
  'TIMEOUT',
  'BANKRUPT',
  'ABANDONED',
] as const satisfies readonly RunOutcome[]);

export const RUN_LIFECYCLE_SEQUENCE = Object.freeze([
  'IDLE',
  'STARTING',
  'ACTIVE',
  'TICK_LOCKED',
  'ENDING',
  'ENDED',
] as const satisfies readonly RunLifecycleState[]);

export interface RunIdentity {
  readonly runId: string;
  readonly userId: string;
  readonly seed: string | number;
  readonly mode: RunMode;
}

export interface RunBudget {
  readonly seasonTickBudget: number;
  readonly freedomThreshold: number;
  readonly startingCash: number;
  readonly startingIncome: number;
  readonly startingExpenses: number;
}

export interface RunLifecycleSnapshot {
  readonly runId: string | null;
  readonly lifecycleState: RunLifecycleState;
  readonly isRunActive: boolean;
  readonly tickIndex: number;
  readonly ticksRemaining: number;
}

// ── Tick, pressure, and timing contracts ──────────────────────────────────────

/** Five tick rate categories. T0 = sovereign speed, T4 = collapse speed. */
export type TickTier = 'T0' | 'T1' | 'T2' | 'T3' | 'T4';

export const TICK_TIERS = Object.freeze([
  'T0',
  'T1',
  'T2',
  'T3',
  'T4',
] as const satisfies readonly TickTier[]);

/** Tick duration in milliseconds per tier. Crisis compresses time. */
export const TICK_DURATION_MS: Record<TickTier, number> = Object.freeze({
  T0: 1800,
  T1: 1200,
  T2: 900,
  T3: 600,
  T4: 350,
});

/** Decision window duration in seconds per tier. */
export const DECISION_WINDOW_S: Record<TickTier, number> = Object.freeze({
  T0: 12,
  T1: 8,
  T2: 5,
  T3: 3,
  T4: 1.5,
});

/** Optional hold budget by tier. Empire-style planning can scale off this. */
export const HOLD_BUDGET_BY_TIER: Record<TickTier, number> = Object.freeze({
  T0: 2,
  T1: 1,
  T2: 1,
  T3: 0,
  T4: 0,
});

/** Five pressure tiers. */
export type PressureTier = 'CALM' | 'BUILDING' | 'ELEVATED' | 'HIGH' | 'CRITICAL';

export const PRESSURE_TIERS = Object.freeze([
  'CALM',
  'BUILDING',
  'ELEVATED',
  'HIGH',
  'CRITICAL',
] as const satisfies readonly PressureTier[]);

/** Pressure score thresholds — transitions fire when score crosses these. */
export const PRESSURE_TIER_THRESHOLDS: Record<PressureTier, number> = Object.freeze({
  CALM: 0.0,
  BUILDING: 0.2,
  ELEVATED: 0.45,
  HIGH: 0.65,
  CRITICAL: 0.85,
});

export interface TickTierDescriptor {
  readonly id: TickTier;
  readonly label: 'SOVEREIGN' | 'STABLE' | 'COMPRESSED' | 'CRISIS' | 'COLLAPSE_IMMINENT';
  readonly tickDurationMs: number;
  readonly decisionWindowSeconds: number;
  readonly holdBudget: number;
}

export const TICK_TIER_DESCRIPTORS: Record<TickTier, TickTierDescriptor> = Object.freeze({
  T0: Object.freeze({
    id: 'T0',
    label: 'SOVEREIGN',
    tickDurationMs: TICK_DURATION_MS.T0,
    decisionWindowSeconds: DECISION_WINDOW_S.T0,
    holdBudget: HOLD_BUDGET_BY_TIER.T0,
  }),
  T1: Object.freeze({
    id: 'T1',
    label: 'STABLE',
    tickDurationMs: TICK_DURATION_MS.T1,
    decisionWindowSeconds: DECISION_WINDOW_S.T1,
    holdBudget: HOLD_BUDGET_BY_TIER.T1,
  }),
  T2: Object.freeze({
    id: 'T2',
    label: 'COMPRESSED',
    tickDurationMs: TICK_DURATION_MS.T2,
    decisionWindowSeconds: DECISION_WINDOW_S.T2,
    holdBudget: HOLD_BUDGET_BY_TIER.T2,
  }),
  T3: Object.freeze({
    id: 'T3',
    label: 'CRISIS',
    tickDurationMs: TICK_DURATION_MS.T3,
    decisionWindowSeconds: DECISION_WINDOW_S.T3,
    holdBudget: HOLD_BUDGET_BY_TIER.T3,
  }),
  T4: Object.freeze({
    id: 'T4',
    label: 'COLLAPSE_IMMINENT',
    tickDurationMs: TICK_DURATION_MS.T4,
    decisionWindowSeconds: DECISION_WINDOW_S.T4,
    holdBudget: HOLD_BUDGET_BY_TIER.T4,
  }),
});

export interface PressureTierDescriptor {
  readonly id: PressureTier;
  readonly threshold: number;
  readonly severity: 0 | 1 | 2 | 3 | 4;
}

export const PRESSURE_TIER_DESCRIPTORS: Record<PressureTier, PressureTierDescriptor> = Object.freeze({
  CALM: Object.freeze({ id: 'CALM', threshold: PRESSURE_TIER_THRESHOLDS.CALM, severity: 0 }),
  BUILDING: Object.freeze({ id: 'BUILDING', threshold: PRESSURE_TIER_THRESHOLDS.BUILDING, severity: 1 }),
  ELEVATED: Object.freeze({ id: 'ELEVATED', threshold: PRESSURE_TIER_THRESHOLDS.ELEVATED, severity: 2 }),
  HIGH: Object.freeze({ id: 'HIGH', threshold: PRESSURE_TIER_THRESHOLDS.HIGH, severity: 3 }),
  CRITICAL: Object.freeze({ id: 'CRITICAL', threshold: PRESSURE_TIER_THRESHOLDS.CRITICAL, severity: 4 }),
});

export interface DecisionTelemetryRecord {
  readonly cardId: string;
  readonly decisionWindowMs: number;
  readonly resolvedInMs: number;
  readonly wasAutoResolved: boolean;
  readonly wasOptimalChoice: boolean;
  readonly speedScore: number;
}

export interface DecisionWindowState {
  readonly cardId: string;
  readonly openedAtTick: TickIndex;
  readonly openedAtMs: UnixMs;
  readonly expiresAtTick: TickIndex;
  readonly durationMs: number;
  readonly holdAllowed: boolean;
  readonly isHeld: boolean;
  readonly mode: RunMode;
}

export interface DecisionWindowResolution {
  readonly cardId: string;
  readonly choiceId: string;
  readonly resolvedAtTick: TickIndex;
  readonly resolvedInMs: number;
  readonly wasOptimalChoice: boolean;
  readonly wasAutoResolved: boolean;
}

// ── Shield architecture ───────────────────────────────────────────────────────

/** Four financial protection layers. */
export type ShieldLayerId =
  | 'L1_LIQUIDITY_BUFFER'
  | 'L2_CREDIT_LINE'
  | 'L3_ASSET_FLOOR'
  | 'L4_NETWORK_CORE';

export const SHIELD_LAYER_IDS = Object.freeze([
  'L1_LIQUIDITY_BUFFER',
  'L2_CREDIT_LINE',
  'L3_ASSET_FLOOR',
  'L4_NETWORK_CORE',
] as const satisfies readonly ShieldLayerId[]);

export const SHIELD_LAYER_ORDER = Object.freeze(SHIELD_LAYER_IDS);

export const SHIELD_LAYER_LABELS: Record<ShieldLayerId, string> = Object.freeze({
  L1_LIQUIDITY_BUFFER: 'Liquidity Buffer',
  L2_CREDIT_LINE: 'Credit Line',
  L3_ASSET_FLOOR: 'Asset Floor',
  L4_NETWORK_CORE: 'Network Core',
});

/** Shield layer max integrity values. */
export const SHIELD_MAX_INTEGRITY: Record<ShieldLayerId, number> = Object.freeze({
  L1_LIQUIDITY_BUFFER: 100,
  L2_CREDIT_LINE: 120,
  L3_ASSET_FLOOR: 150,
  L4_NETWORK_CORE: 200,
});

/** Passive regen per tick per layer. */
export const SHIELD_REGEN_PER_TICK: Record<ShieldLayerId, number> = Object.freeze({
  L1_LIQUIDITY_BUFFER: 2,
  L2_CREDIT_LINE: 2,
  L3_ASSET_FLOOR: 1,
  L4_NETWORK_CORE: 1,
});

export interface ShieldLayer {
  readonly id: ShieldLayerId;
  readonly label: string;
  readonly current: number;
  readonly max: number;
  readonly breached: boolean;
  readonly lastBreach: number | null;
  readonly regenActive: boolean;
}

export interface ShieldState {
  readonly layers: Record<ShieldLayerId, ShieldLayer>;
  readonly overallIntegrityPct: number;
  readonly l4BreachCount: number;
}

export interface ShieldIntegrityDelta {
  readonly layerId: ShieldLayerId;
  readonly before: number;
  readonly after: number;
  readonly delta: number;
  readonly breached: boolean;
}

export interface ShieldSnapshotSurface {
  readonly shieldAvgIntegrityPct: number;
  readonly shieldL1Integrity: number;
  readonly shieldL2Integrity: number;
  readonly shieldL3Integrity: number;
  readonly shieldL4Integrity: number;
  readonly shieldL1Max: number;
  readonly shieldL2Max: number;
  readonly shieldL3Max: number;
  readonly shieldL4Max: number;
}

// ── Adversary / hater bot system ─────────────────────────────────────────────

/** Five adversary identities. */
export type BotId =
  | 'BOT_01_LIQUIDATOR'
  | 'BOT_02_BUREAUCRAT'
  | 'BOT_03_MANIPULATOR'
  | 'BOT_04_CRASH_PROPHET'
  | 'BOT_05_LEGACY_HEIR';

export const BOT_IDS = Object.freeze([
  'BOT_01_LIQUIDATOR',
  'BOT_02_BUREAUCRAT',
  'BOT_03_MANIPULATOR',
  'BOT_04_CRASH_PROPHET',
  'BOT_05_LEGACY_HEIR',
] as const satisfies readonly BotId[]);

export type BotState =
  | 'DORMANT'
  | 'WATCHING'
  | 'TARGETING'
  | 'ATTACKING'
  | 'RETREATING'
  | 'NEUTRALIZED';

export interface BotProfile {
  readonly id: BotId;
  readonly name: string;
  readonly archetype: string;
  readonly escalationHeat: number;
  readonly targetingHeat: number;
  readonly attackingHeat: number;
  readonly primaryAttack: AttackType;
  readonly secondaryAttack: AttackType;
  readonly dialogue: {
    readonly activate: string;
    readonly targeting: string;
    readonly attack: string;
    readonly retreat: string;
    readonly neutralized: string;
  };
}

export interface BotRuntimeState {
  readonly id: BotId;
  readonly state: BotState;
  readonly ticksInState: number;
  readonly preloadedArrival: number | null;
  readonly isCritical: boolean;
  readonly lastAttackTick: number | null;
}

export interface BotThreatProjection {
  readonly botId: BotId;
  readonly currentState: BotState;
  readonly nextLikelyAttackType: AttackType | null;
  readonly projectedArrivalTick: number | null;
  readonly projectedHeatBand: PressureTier | 'UNKNOWN';
}

// ── Attack system ─────────────────────────────────────────────────────────────

export type AttackType =
  | 'FINANCIAL_SABOTAGE'
  | 'EXPENSE_INJECTION'
  | 'DEBT_ATTACK'
  | 'ASSET_STRIP'
  | 'REPUTATION_ATTACK'
  | 'REGULATORY_ATTACK'
  | 'HATER_INJECTION'
  | 'OPPORTUNITY_KILL';

export const ATTACK_TYPES = Object.freeze([
  'FINANCIAL_SABOTAGE',
  'EXPENSE_INJECTION',
  'DEBT_ATTACK',
  'ASSET_STRIP',
  'REPUTATION_ATTACK',
  'REGULATORY_ATTACK',
  'HATER_INJECTION',
  'OPPORTUNITY_KILL',
] as const satisfies readonly AttackType[]);

export const ATTACK_PRIMARY_TARGET: Record<AttackType, ShieldLayerId | 'WEAKEST'> = Object.freeze({
  FINANCIAL_SABOTAGE: 'L1_LIQUIDITY_BUFFER',
  EXPENSE_INJECTION: 'L1_LIQUIDITY_BUFFER',
  DEBT_ATTACK: 'L2_CREDIT_LINE',
  ASSET_STRIP: 'L3_ASSET_FLOOR',
  REPUTATION_ATTACK: 'L4_NETWORK_CORE',
  REGULATORY_ATTACK: 'L4_NETWORK_CORE',
  HATER_INJECTION: 'WEAKEST',
  OPPORTUNITY_KILL: 'L3_ASSET_FLOOR',
});

export const CRITICAL_BYPASS_ATTACK_TYPES = Object.freeze([
  'REGULATORY_ATTACK',
  'HATER_INJECTION',
] as const satisfies readonly AttackType[]);

export interface AttackEvent {
  readonly id: string;
  readonly sourceBot: BotId;
  readonly attackType: AttackType;
  readonly damage: number;
  readonly isCritical: boolean;
  readonly targetLayer: ShieldLayerId;
  readonly arrivalTick: number;
  readonly label: string;
}

export interface DamageResult {
  readonly attackId: string;
  readonly sourceBot: BotId;
  readonly attackType: AttackType;
  readonly targetLayer: ShieldLayerId;
  readonly resolvedLayer: ShieldLayerId;
  readonly damageRequested: number;
  readonly damageApplied: number;
  readonly integrityAfter: number;
  readonly breachOccurred: boolean;
  readonly cascadeTriggered: boolean;
  readonly cascadeEventId?: string;
}

export interface CounterIntelWindow {
  readonly botId: BotId;
  readonly tier: PressureTier;
  readonly attackType: AttackType;
  readonly readableUntilTick: TickIndex;
  readonly confidence: number;
}

// ── Cascade chain system ──────────────────────────────────────────────────────

export type CascadeChainId =
  | 'CHAIN_01_LOAN_DEFAULT'
  | 'CHAIN_02_LIQUIDITY_BREACH'
  | 'CHAIN_03_NETWORK_COLLAPSE'
  | 'CHAIN_04_EXTRACTION_COMPOUND'
  | 'CHAIN_05_NET_WORTH_COLLAPSE'
  | 'CHAIN_06_TOTAL_SYSTEMIC'
  | 'CHAIN_07_PATTERN_EXPLOITATION'
  | 'CHAIN_08_POSITIVE_MOMENTUM';

export type CascadeChainState = 'PENDING' | 'ACTIVE' | 'INTERCEPTED' | 'COMPLETED' | 'DISSOLVED';
export type CascadeSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CATASTROPHIC';
export type CascadeEffectType =
  | 'INCOME_DRAIN'
  | 'EXPENSE_SURGE'
  | 'HEAT_DELTA'
  | 'SHIELD_DAMAGE'
  | 'CARD_INJECT'
  | 'INCOME_BOOST'
  | 'EXPENSE_RELIEF';

export const CASCADE_SEVERITY_WEIGHT: Record<CascadeSeverity, number> = Object.freeze({
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CATASTROPHIC: 5,
});

export interface CascadeLink {
  readonly tickOffset: number;
  readonly effectType: CascadeEffectType;
  readonly magnitude: number;
  readonly label: string;
}

export interface CascadeChainInstance {
  readonly id: string;
  readonly chainId: CascadeChainId;
  readonly triggerTick: number;
  readonly links: CascadeLink[];
  readonly state: CascadeChainState;
  readonly severity: CascadeSeverity;
}

export interface CascadeEffect {
  readonly chainId: CascadeChainId;
  readonly instanceId: string;
  readonly linkIndex: number;
  readonly effectType: CascadeEffectType;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly tickFired: TickIndex;
}

export interface RecoveryResult {
  readonly chainId: CascadeChainId;
  readonly instanceId: string;
  readonly recoveryCard: string;
  readonly linksSkipped: number;
}

// ── Snapshot fields and surfaces ──────────────────────────────────────────────

/**
 * Current repo-facing snapshot surface. Preserve this shape for existing core
 * and mode engine consumers.
 */
export interface RunStateSnapshot {
  readonly tick: number;
  readonly cash: number;
  readonly income: number;
  readonly expenses: number;
  readonly netWorth: number;
  readonly shields: ShieldState;
  readonly haterHeat: number;
  readonly botStates: Readonly<Record<BotId, BotRuntimeState>>;
  readonly pressureScore: number;
  readonly pressureTier: PressureTier;
  readonly tickTier: TickTier;
  readonly activeCascades: CascadeChainInstance[];
  readonly runMode: RunMode;
  readonly seed: number;
  readonly lifecycleState: RunLifecycleState;

  // sovereignty-authored aliases / counters
  readonly tickIndex: number;
  readonly shieldAvgIntegrityPct: number;
  readonly activeCascadeChains: number;
  readonly haterAttemptsThisTick: number;
  readonly haterBlockedThisTick: number;
  readonly haterDamagedThisTick: number;
  readonly cascadesTriggeredThisTick: number;
  readonly cascadesBrokenThisTick: number;
  readonly decisionsThisTick: readonly DecisionTelemetryRecord[];

  // Engine 0-compatible optional overlays.
  readonly runId?: string;
  readonly userId?: string;
  readonly seasonTickBudget?: number;
  readonly ticksRemaining?: number;
  readonly freedomThreshold?: number;
  readonly cashflow?: number;
  readonly currentTickTier?: TickTier;
  readonly currentTickDurationMs?: number;
  readonly activeDecisionWindows?: number;
  readonly holdsRemaining?: number;
  readonly ticksWithoutIncomeGrowth?: number;
  readonly tensionScore?: number;
  readonly anticipationQueueDepth?: number;
  readonly threatVisibilityState?: string;
  readonly activeBotCount?: number;
  readonly activeThreatCardCount?: number;
}

/**
 * Engine 0 canonical snapshot field surface from the supplied orchestration
 * doctrine. This stays separate so current repo consumers are not forced to
 * migrate immediately, but the shape is available now for zero-engine parity.
 */
export interface RunStateSnapshotFields {
  readonly runId: string;
  readonly userId: string;
  readonly seed: string;
  readonly tickIndex: number;
  readonly seasonTickBudget: number;
  readonly ticksRemaining: number;
  readonly freedomThreshold: number;

  readonly netWorth: number;
  readonly cashBalance: number;
  readonly monthlyIncome: number;
  readonly monthlyExpenses: number;
  readonly cashflow: number;

  readonly currentTickTier: TickTier;
  readonly currentTickDurationMs: number;
  readonly activeDecisionWindows: number;
  readonly holdsRemaining: number;

  readonly pressureScore: number;
  readonly pressureTier: PressureTier;
  readonly ticksWithoutIncomeGrowth: number;

  readonly tensionScore: number;
  readonly anticipationQueueDepth: number;
  readonly threatVisibilityState: string;

  readonly shieldAvgIntegrityPct: number;
  readonly shieldL1Integrity: number;
  readonly shieldL2Integrity: number;
  readonly shieldL3Integrity: number;
  readonly shieldL4Integrity: number;
  readonly shieldL1Max: number;
  readonly shieldL2Max: number;
  readonly shieldL3Max: number;
  readonly shieldL4Max: number;

  readonly haterHeat: number;
  readonly activeBotCount: number;
  readonly haterAttemptsThisTick: number;
  readonly haterBlockedThisTick: number;
  readonly haterDamagedThisTick: number;
  readonly activeThreatCardCount: number;

  readonly activeCascadeChains: number;
  readonly cascadesTriggeredThisTick: number;
  readonly cascadesBrokenThisTick: number;

  readonly decisionsThisTick: readonly DecisionTelemetryRecord[];
}

export interface Engine0SnapshotEnvelope extends RunStateSnapshotFields {
  readonly outcomeCheckPriority?: readonly RunOutcome[];
}

export interface TickResult {
  readonly tickIndex: number;
  readonly pressureScore: number;
  readonly postActionPressure: number;
  readonly attacksFired: AttackEvent[];
  readonly damageResults: DamageResult[];
  readonly cascadeEffects: CascadeEffect[];
  readonly recoveryResults: RecoveryResult[];
  readonly runOutcome: RunOutcome | null;
  readonly tickDurationMs: number;
}

export interface SnapshotDiff<T = unknown> {
  readonly key: string;
  readonly before: T;
  readonly after: T;
}

export interface SnapshotReceipt {
  readonly tickIndex: number;
  readonly runId?: string;
  readonly mode: RunMode;
  readonly seed: number;
  readonly pressureTier: PressureTier;
  readonly tickTier: TickTier;
  readonly activeBotCount: number;
  readonly activeCascadeChains: number;
  readonly integrityPct: number;
}

// ── Engine registry and orchestration contracts ───────────────────────────────

export enum EngineId {
  TIME = 'TIME_ENGINE',
  PRESSURE = 'PRESSURE_ENGINE',
  TENSION = 'TENSION_ENGINE',
  SHIELD = 'SHIELD_ENGINE',
  BATTLE = 'BATTLE_ENGINE',
  CASCADE = 'CASCADE_ENGINE',
  SOVEREIGNTY = 'SOVEREIGNTY_ENGINE',
}

export enum EngineHealth {
  UNREGISTERED = 'UNREGISTERED',
  REGISTERED = 'REGISTERED',
  INITIALIZED = 'INITIALIZED',
  ERROR = 'ERROR',
  DISABLED = 'DISABLED',
}

export interface IEngine {
  readonly engineId: EngineId;
  init(params: EngineInitParams): void;
  reset(): void;
}

export interface EngineInitParams {
  readonly runId: string;
  readonly userId: string;
  readonly seed: string;
  readonly seasonTickBudget: number;
  readonly freedomThreshold: number;
  readonly clientVersion: string;
  readonly engineVersion: string;
}

export interface EngineEntry {
  readonly id: EngineId;
  readonly instance: IEngine;
  readonly registeredAt: UnixMs;
  readonly lastError?: string;
  health: EngineHealth;
}

// ── Engine-to-engine reader interfaces ───────────────────────────────────────

export interface PressureReader {
  getCurrentScore(): number;
  getCurrentTier(): PressureTier;
  getStagnationCount(): number;
}

export interface ShieldReader {
  getOverallIntegrityPct(): number;
  getLayerIntegrity(layerId: ShieldLayerId): number;
  getLayerIntegrityPct(layerId: ShieldLayerId): number;
  isLayerBreached(layerId: ShieldLayerId): boolean;
  getWeakestLayer(): ShieldLayerId;
}

export interface TensionReader {
  getCurrentTensionScore(): number;
  getQueueDepth(): number;
  getVisibilityState(): string;
}

export interface CascadeReader {
  getActiveChainCount(): number;
  hasActiveChainsAboveSeverity(severity: CascadeSeverity): boolean;
}

// ── Event bus contract surfaces ───────────────────────────────────────────────

/** Existing repo-facing EventBus payload surface. */
export type PZOEventType =
  | 'RUN_STARTED'
  | 'RUN_ENDED'
  | 'TICK_START'
  | 'TICK_END'
  | 'PRESSURE_TIER_CHANGED'
  | 'PRESSURE_SCORE_UPDATE'
  | 'SHIELD_DAMAGED'
  | 'SHIELD_LAYER_BREACHED'
  | 'SHIELD_L4_BREACH'
  | 'SHIELD_REPAIRED'
  | 'BOT_STATE_CHANGED'
  | 'BOT_ATTACK_FIRED'
  | 'BOT_NEUTRALIZED'
  | 'HATER_HEAT_CHANGED'
  | 'CASCADE_TRIGGERED'
  | 'CASCADE_LINK_FIRED'
  | 'CASCADE_INTERCEPTED'
  | 'CASCADE_COMPLETED'
  | 'INCOME_CHANGED'
  | 'EXPENSE_CHANGED'
  | 'CASH_CHANGED'
  | 'NET_WORTH_CHANGED'
  | 'SABOTAGE_FIRED'
  | 'SABOTAGE_BLOCKED'
  | 'PARTNER_DISTRESS'
  | 'RESCUE_WINDOW_OPENED'
  | 'RESCUE_WINDOW_EXPIRED'
  | 'AID_CONTRACT_SIGNED'
  | 'GHOST_DELTA_UPDATE'
  | 'GHOST_AHEAD'
  | 'GHOST_BEHIND'
  | 'PROOF_BADGE_EARNED'
  | 'PROOF_HASH_GENERATED'
  | 'RUN_GRADED'
  | 'PROOF_EXPORT_READY'
  | 'decision:window_opened'
  | 'decision:resolve_failed'
  | 'decision:hold_denied'
  | 'decision:hold_applied'
  | 'decision:hold_released'
  | 'decision:resolved';

export interface PZOEvent<T = unknown> {
  readonly type: PZOEventType;
  readonly tick: number;
  readonly payload: T;
}

/** Engine 0 doctrine-facing event registry. */
export type EngineEventName =
  | 'TICK_START'
  | 'TICK_COMPLETE'
  | 'TICK_TIER_CHANGED'
  | 'TICK_TIER_FORCED'
  | 'DECISION_WINDOW_OPENED'
  | 'DECISION_WINDOW_EXPIRED'
  | 'DECISION_WINDOW_RESOLVED'
  | 'SEASON_TIMEOUT_IMMINENT'
  | 'PRESSURE_TIER_CHANGED'
  | 'PRESSURE_CRITICAL'
  | 'PRESSURE_SCORE_UPDATED'
  | 'TENSION_SCORE_UPDATED'
  | 'ANTICIPATION_PULSE'
  | 'THREAT_VISIBILITY_CHANGED'
  | 'THREAT_QUEUED'
  | 'THREAT_ARRIVED'
  | 'THREAT_MITIGATED'
  | 'THREAT_EXPIRED'
  | 'SHIELD_LAYER_DAMAGED'
  | 'SHIELD_LAYER_BREACHED'
  | 'SHIELD_REPAIRED'
  | 'SHIELD_PASSIVE_REGEN'
  | 'BOT_STATE_CHANGED'
  | 'BOT_ATTACK_FIRED'
  | 'BOT_NEUTRALIZED'
  | 'COUNTER_INTEL_AVAILABLE'
  | 'BATTLE_BUDGET_UPDATED'
  | 'SYNDICATE_DUEL_RESULT'
  | 'CASCADE_CHAIN_TRIGGERED'
  | 'CASCADE_LINK_FIRED'
  | 'CASCADE_CHAIN_BROKEN'
  | 'CASCADE_CHAIN_COMPLETED'
  | 'POSITIVE_CASCADE_ACTIVATED'
  | 'RUN_COMPLETED'
  | 'PROOF_VERIFICATION_FAILED'
  | 'RUN_REWARD_DISPATCHED'
  | 'PROOF_ARTIFACT_READY'
  | 'RUN_STARTED'
  | 'RUN_ENDED'
  | 'ENGINE_ERROR'
  | 'TICK_STEP_ERROR';

export interface EngineEvent<T extends EngineEventName = EngineEventName, P = unknown> {
  readonly eventType: T;
  readonly payload: P;
  readonly tickIndex: number;
  readonly timestamp: number;
  readonly sourceEngine?: EngineId;
}

export interface EngineEventPayloadMap {
  'TICK_START': { tickIndex: number; tickDurationMs: number };
  'TICK_COMPLETE': { tickIndex: number; tickDurationMs: number; outcome: RunOutcome | null };
  'TICK_TIER_CHANGED': { from: TickTier; to: TickTier; transitionTicks: number };
  'TICK_TIER_FORCED': { tier: TickTier; durationTicks: number };
  'DECISION_WINDOW_OPENED': { cardId: string; durationMs: number; autoResolveResult: string };
  'DECISION_WINDOW_EXPIRED': { cardId: string; result: string; speedScore: number };
  'DECISION_WINDOW_RESOLVED': { cardId: string; choiceId: string; resolvedInMs: number; wasOptimal: boolean };
  'SEASON_TIMEOUT_IMMINENT': { ticksRemaining: number };
  'PRESSURE_TIER_CHANGED': { from: PressureTier; to: PressureTier; score: number };
  'PRESSURE_CRITICAL': { score: number; triggerSignals: string[] };
  'PRESSURE_SCORE_UPDATED': { score: number; tier: PressureTier; tickIndex: number };
  'TENSION_SCORE_UPDATED': { score: number; tickIndex: number };
  'ANTICIPATION_PULSE': { tensionScore: number; queueDepth: number };
  'THREAT_VISIBILITY_CHANGED': { from: string; to: string };
  'THREAT_QUEUED': { threatId: string; threatType: string; arrivalTick: number };
  'THREAT_ARRIVED': { threatId: string; threatType: string };
  'THREAT_MITIGATED': { threatId: string; cardUsed: string };
  'THREAT_EXPIRED': { threatId: string; unmitigated: boolean };
  'SHIELD_LAYER_DAMAGED': { layer: ShieldLayerId; damage: number; integrity: number; attackId: string };
  'SHIELD_LAYER_BREACHED': { layer: ShieldLayerId; cascadeEventId?: string };
  'SHIELD_REPAIRED': { layer: ShieldLayerId; amount: number; newIntegrity: number };
  'SHIELD_PASSIVE_REGEN': { layer: ShieldLayerId; amount: number; newIntegrity: number };
  'BOT_STATE_CHANGED': { botId: BotId; from: string; to: string };
  'BOT_ATTACK_FIRED': { botId: BotId; attackType: AttackType; targetLayer: ShieldLayerId };
  'BOT_NEUTRALIZED': { botId: BotId; immunityTicks: number };
  'COUNTER_INTEL_AVAILABLE': { botId: BotId; attackProfile: object; tier: string };
  'BATTLE_BUDGET_UPDATED': { remaining: number; spent: number; tickBudget: number };
  'SYNDICATE_DUEL_RESULT': { duelId: string; winnerId: string; loserId: string; reward: object };
  'CASCADE_CHAIN_TRIGGERED': { chainId: CascadeChainId; instanceId: string; severity: CascadeSeverity };
  'CASCADE_LINK_FIRED': { chainId: CascadeChainId; instanceId: string; linkIndex: number; effect: CascadeEffect };
  'CASCADE_CHAIN_BROKEN': { chainId: CascadeChainId; instanceId: string; recoveryCard: string; linksSkipped: number };
  'CASCADE_CHAIN_COMPLETED': { chainId: CascadeChainId; instanceId: string; allLinksResolved: boolean };
  'POSITIVE_CASCADE_ACTIVATED': { chainId: CascadeChainId; instanceId: string; type: string };
  'RUN_COMPLETED': { runId: string; proofHash: string; grade: string; sovereigntyScore: number; integrityStatus: string; reward: object };
  'PROOF_VERIFICATION_FAILED': { runId: string; step: number; reason: string };
  'RUN_REWARD_DISPATCHED': { runId: string; userId: string; grade: string; xp: number; cosmetics: string[] };
  'PROOF_ARTIFACT_READY': { runId: string; exportUrl: string; format: string };
  'RUN_STARTED': { runId: string; userId: string; seed: string; tickBudget: number };
  'RUN_ENDED': { runId: string; outcome: RunOutcome; finalNetWorth: number };
  'ENGINE_ERROR': { engineId: EngineId; error: string; step: number };
  'TICK_STEP_ERROR': { step: number; engineId?: EngineId; error: string };
}

// ── Sovereignty / proof ───────────────────────────────────────────────────────

export type RunGrade = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';

export const OUTCOME_MULTIPLIERS: Record<RunOutcome, number> = Object.freeze({
  FREEDOM: 1.0,
  TIMEOUT: 0.7,
  BANKRUPT: 0.3,
  ABANDONED: 0.0,
});

export const GRADE_THRESHOLDS: ReadonlyArray<{ min: number; grade: RunGrade }> = Object.freeze([
  { min: 900, grade: 'S' },
  { min: 750, grade: 'A' },
  { min: 600, grade: 'B' },
  { min: 450, grade: 'C' },
  { min: 300, grade: 'D' },
  { min: 0, grade: 'F' },
]);

export interface ProofArtifactDescriptor {
  readonly runId: string;
  readonly outcome: RunOutcome;
  readonly grade: RunGrade;
  readonly proofHash: string;
  readonly exportUrl?: string;
}

// ── Mode-level engine interface ───────────────────────────────────────────────

export interface IGameModeEngine {
  readonly mode: RunMode;
  readonly runId: string;
  init(config: ModeInitConfig): void;
  onTick(snapshot: RunStateSnapshot): void;
  onRunEnd(outcome: RunOutcome): void;
  getState(): GameModeState;
  subscribe(handler: (event: PZOEvent) => void): () => void;
}

export interface ModeInitConfig {
  readonly seed: number;
  readonly startingCash: number;
  readonly startingIncome: number;
  readonly startingExpenses: number;
  readonly runTicks: number;
  readonly ghostChampionRunId?: string;
  readonly partnerPlayerId?: string;
  readonly haterPlayerId?: string;
  readonly localRole?: 'builder' | 'hater';
}

export interface GameModeState {
  readonly mode: RunMode;
  readonly empire?: {
    readonly currentWave: number;
    readonly haterHeat: number;
    readonly activeBotCount: number;
    readonly highestBotThreat: string;
    readonly nextThreatTick: number | null;
    readonly cascadeChainCount: number;
    readonly momentumScore: number;
  };
  readonly predator?: {
    readonly localRole: 'builder' | 'hater';
    readonly builderNetWorth: number;
    readonly haterSabotageAmmo: number;
    readonly counterplayWindow: boolean;
    readonly counterplayTicksLeft: number;
    readonly haterComboCount: number;
    readonly builderShieldPct: number;
    readonly phase: 'early' | 'mid' | 'endgame';
  };
  readonly syndicate?: {
    readonly partnerCash: number;
    readonly partnerIncome: number;
    readonly partnerNetWorth: number;
    readonly partnerShieldPct: number;
    readonly partnerInDistress: boolean;
    readonly rescueWindowOpen: boolean;
    readonly rescueWindowTicksLeft: number;
    readonly activeAidContracts: AidContractRecord[];
    readonly synergyBonus: number;
    readonly combinedNetWorth: number;
  };
  readonly phantom?: {
    readonly ghostNetWorth: number;
    readonly localNetWorth: number;
    readonly delta: number;
    readonly deltaPct: number;
    readonly ghostIsAlive: boolean;
    readonly ghostWonAt: number | null;
    readonly proofBadgeEarned: boolean;
    readonly divergencePoints: DivergencePoint[];
    readonly championGrade: RunGrade;
  };
}

// ── Co-op aid contracts ───────────────────────────────────────────────────────

export interface AidContractRecord {
  readonly id: string;
  readonly type: 'INCOME_SHARE' | 'DEBT_TRANSFER' | 'SHIELD_LEND' | 'EMERGENCY_CAPITAL';
  readonly initiatorRole: 'local' | 'partner';
  readonly terms: {
    readonly amount: number;
    readonly durationTicks: number | null;
    readonly interestRate: number;
  };
  readonly signedAtTick: number;
  readonly expiresAtTick: number | null;
  readonly status: 'ACTIVE' | 'COMPLETED' | 'DEFAULTED';
}

// ── Ghost divergence ──────────────────────────────────────────────────────────

export interface DivergencePoint {
  readonly tick: number;
  readonly label: string;
  readonly localDeltaAfter: number;
  readonly impactScore: number;
}

// ── Sabotage system (asymmetric-pvp) ─────────────────────────────────────────

export type SabotageType =
  | 'FREEZE_INCOME'
  | 'PHANTOM_EXPENSE'
  | 'CREDIT_LOCK'
  | 'MARKET_RUMOR'
  | 'AUDIT_TRIGGER'
  | 'SHIELD_CORRODE'
  | 'OPPORTUNITY_SNIPE'
  | 'DEBT_INJECTION';

export interface SabotageCard {
  readonly id: string;
  readonly type: SabotageType;
  readonly cooldownTicks: number;
  readonly label: string;
  readonly description: string;
  readonly magnitude: number;
  readonly durationTicks: number;
}

export const SABOTAGE_DECK: ReadonlyArray<SabotageCard> = Object.freeze([
  {
    id: 'SAB_01',
    type: 'FREEZE_INCOME',
    cooldownTicks: 36,
    label: 'Income Freeze',
    magnitude: 1.0,
    durationTicks: 6,
    description: 'All income streams stop. Builder earns zero for 6 ticks.',
  },
  {
    id: 'SAB_02',
    type: 'PHANTOM_EXPENSE',
    cooldownTicks: 24,
    label: 'Ghost Invoice',
    magnitude: 800,
    durationTicks: 12,
    description: 'A fake obligation drains $800/month for 12 ticks.',
  },
  {
    id: 'SAB_03',
    type: 'CREDIT_LOCK',
    cooldownTicks: 48,
    label: 'Credit Freeze',
    magnitude: 1.0,
    durationTicks: 8,
    description: 'L2 Credit Line shield disabled — cannot absorb attacks.',
  },
  {
    id: 'SAB_04',
    type: 'MARKET_RUMOR',
    cooldownTicks: 30,
    label: 'Market Rumor',
    magnitude: 0.5,
    durationTicks: 10,
    description: 'Income at half efficiency while the rumor spreads.',
  },
  {
    id: 'SAB_05',
    type: 'AUDIT_TRIGGER',
    cooldownTicks: 60,
    label: 'Regulatory Hit',
    magnitude: 4500,
    durationTicks: 0,
    description: 'Immediate $4,500 compliance expense. Cannot be shielded.',
  },
  {
    id: 'SAB_06',
    type: 'SHIELD_CORRODE',
    cooldownTicks: 18,
    label: 'Shield Erosion',
    magnitude: 8,
    durationTicks: 15,
    description: 'Drains 8 pts/tick from weakest shield layer for 15 ticks.',
  },
  {
    id: 'SAB_07',
    type: 'OPPORTUNITY_SNIPE',
    cooldownTicks: 42,
    label: 'Opportunity Kill',
    magnitude: 1.0,
    durationTicks: 0,
    description: 'Destroys top card in builder\'s hand. Gone permanently.',
  },
  {
    id: 'SAB_08',
    type: 'DEBT_INJECTION',
    cooldownTicks: 72,
    label: 'Debt Plant',
    magnitude: 1200,
    durationTicks: 0,
    description: 'Permanent $1,200/month obligation added to builder\'s ledger.',
  },
]);

// ── Bot profile registry ──────────────────────────────────────────────────────

export const BOT_PROFILES: Record<BotId, BotProfile> = Object.freeze({
  BOT_01_LIQUIDATOR: Object.freeze({
    id: 'BOT_01_LIQUIDATOR',
    name: 'The Liquidator',
    archetype: 'Forces asset sales at the worst possible time. Preys on overleveraged positions.',
    escalationHeat: 20,
    targetingHeat: 41,
    attackingHeat: 61,
    primaryAttack: 'ASSET_STRIP',
    secondaryAttack: 'DEBT_ATTACK',
    dialogue: Object.freeze({
      activate: 'The Liquidator has noticed your position.',
      targeting: 'Your leverage ratio is… unfortunate. Preparing forced sale.',
      attack: 'Margin call. Liquidate now or lose everything.',
      retreat: 'You survived. For now.',
      neutralized: 'Evidence filed. The Liquidator backs down.',
    }),
  }),
  BOT_02_BUREAUCRAT: Object.freeze({
    id: 'BOT_02_BUREAUCRAT',
    name: 'The Bureaucrat',
    archetype: 'Red tape, compliance costs, and regulatory pressure designed to stall your growth.',
    escalationHeat: 25,
    targetingHeat: 45,
    attackingHeat: 65,
    primaryAttack: 'REGULATORY_ATTACK',
    secondaryAttack: 'EXPENSE_INJECTION',
    dialogue: Object.freeze({
      activate: 'The Bureaucrat has found some paperwork issues.',
      targeting: 'Your compliance record is under review.',
      attack: 'Audit initiated. Full operational review required.',
      retreat: 'Filing noted. We will be in touch.',
      neutralized: 'Counter-evidence submitted. Audit closed.',
    }),
  }),
  BOT_03_MANIPULATOR: Object.freeze({
    id: 'BOT_03_MANIPULATOR',
    name: 'The Manipulator',
    archetype: 'Manufactures fear in the market. Spreads rumors that collapse your income streams.',
    escalationHeat: 15,
    targetingHeat: 35,
    attackingHeat: 55,
    primaryAttack: 'REPUTATION_ATTACK',
    secondaryAttack: 'FINANCIAL_SABOTAGE',
    dialogue: Object.freeze({
      activate: 'The Manipulator is watching your network.',
      targeting: 'Word is spreading about your instability.',
      attack: 'The narrative has shifted. Market confidence collapsing.',
      retreat: 'The story has served its purpose.',
      neutralized: 'Your reputation held. The Manipulator retreats.',
    }),
  }),
  BOT_04_CRASH_PROPHET: Object.freeze({
    id: 'BOT_04_CRASH_PROPHET',
    name: 'The Crash Prophet',
    archetype: 'Exploits fear cycles. Profits when you sell in panic. Manufactured collapses.',
    escalationHeat: 30,
    targetingHeat: 50,
    attackingHeat: 70,
    primaryAttack: 'HATER_INJECTION',
    secondaryAttack: 'OPPORTUNITY_KILL',
    dialogue: Object.freeze({
      activate: 'The Crash Prophet is seeding the market with fear.',
      targeting: 'Panic is spreading. Your assets look dangerous.',
      attack: 'Manufactured collapse. Everything is falling at once.',
      retreat: 'The panic cycle has run its course.',
      neutralized: 'You didn\'t flinch. The Prophet retreats.',
    }),
  }),
  BOT_05_LEGACY_HEIR: Object.freeze({
    id: 'BOT_05_LEGACY_HEIR',
    name: 'The Legacy Heir',
    archetype: 'Old money protecting its position. Monopolizes the opportunities your income needs.',
    escalationHeat: 35,
    targetingHeat: 55,
    attackingHeat: 75,
    primaryAttack: 'OPPORTUNITY_KILL',
    secondaryAttack: 'REPUTATION_ATTACK',
    dialogue: Object.freeze({
      activate: 'The Legacy Heir has noticed a new competitor.',
      targeting: 'Your best opportunities are being acquired.',
      attack: 'The market has been closed to your income class.',
      retreat: 'This isn\'t worth the Heir\'s time. Yet.',
      neutralized: 'You played at their level. The Heir steps back.',
    }),
  }),
});

// ── Core doctrine registries ──────────────────────────────────────────────────

export const CORE_ENGINE_ARCHITECTURE_LAWS = Object.freeze([
  'All engines read from RunStateSnapshot — never from live state.',
  'EventBus.flush() is the release boundary for deferred tick events.',
  'EngineOrchestrator is the sole writer of tick lifecycle state.',
  'No engine imports another engine directly. Cross-engine reads use interfaces.',
  'RunStateSnapshot is built once per tick and frozen before Step 1.',
  'Catastrophic failure is the only valid reason to abandon the tick loop.',
] as const);

export const CORE_ENGINE_REQUIRED_FILES = Object.freeze([
  'types.ts',
  'EventBus.ts',
  'RunStateSnapshot.ts',
  'EngineRegistry.ts',
  'EngineOrchestrator.ts',
] as const);

// ═══════════════════════════════════════════════════════════════════════════
// TICK MIDDLEWARE & PHASE SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Mutable context injected into every tick middleware invocation.
 * A middleware may set `aborted = true` to short-circuit the tick.
 * The `meta` bag allows middlewares to communicate with downstream plugins.
 */
export interface TickMiddlewareContext {
  readonly tickIndex:      number;
  readonly tickTier:       TickTier;
  readonly tickDurationMs: number;
  readonly pressureScore:  number;
  readonly lifecycleState: RunLifecycleState;
  readonly phaseStartMs:   number;
  aborted:     boolean;
  abortReason: string | null;
  /** Arbitrary key-value bag for inter-middleware communication. */
  readonly meta: Record<string, unknown>;
}

/**
 * Tick middleware function. Receives the mutable context and a `next` function.
 * Call `next()` to continue the chain; skip it to abort further processing.
 */
export type TickMiddlewareFn = (ctx: TickMiddlewareContext, next: () => void) => void;

/**
 * Immutable record of everything that happened during a single completed tick.
 * Written by EngineOrchestrator after each tick and stored in TickHistory.
 */
export interface TickPhaseRecord {
  readonly tickIndex:       number;
  readonly startedAtMs:     number;
  readonly completedAtMs:   number;
  readonly durationMs:      number;
  readonly tier:            TickTier;
  readonly stepDurations:   Readonly<Partial<Record<string, number>>>;
  readonly attacksFired:    number;
  readonly cascadesFired:   number;
  readonly decisionsOpened: number;
  readonly eventsEmitted:   number;
  readonly runOutcome:      RunOutcome | null;
  readonly wasAborted:      boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// ENGINE HEALTH SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

export type EngineHealthAlertCode =
  | 'TICK_DRIFT_HIGH'
  | 'DECISION_WINDOW_BACKLOG'
  | 'EVENT_VOLUME_SPIKE'
  | 'STEP_TIMEOUT'
  | 'ENGINE_STALL'
  | 'REPLAY_DESYNC'
  | 'MIDDLEWARE_ERROR'
  | 'PLUGIN_EXCEPTION'
  | 'SNAPSHOT_INVALID'
  | 'TIER_OSCILLATION'
  | 'RUNAWAY_TICK_LOOP'
  | 'FLUSH_OVERRUN';

export interface EngineHealthAlert {
  readonly code:        EngineHealthAlertCode;
  readonly message:     string;
  readonly severity:    'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
  readonly tickIndex:   number;
  readonly timestampMs: number;
  readonly metadata?:   Readonly<Record<string, unknown>>;
}

export interface EngineHealthStatus {
  readonly isHealthy:           boolean;
  readonly lifecycleState:      RunLifecycleState;
  readonly tickIndex:           number;
  readonly tickTier:            TickTier;
  readonly avgTickDriftMs:      number;
  readonly maxTickDriftMs:      number;
  readonly openDecisionWindows: number;
  readonly pendingEventCount:   number;
  readonly activeEngineCount:   number;
  readonly lastTickTimestampMs: number | null;
  readonly activeAlerts:        ReadonlyArray<EngineHealthAlert>;
  readonly performanceScore:    number; // 0–100
  readonly middlewareDepth:     number;
  readonly pluginCount:         number;
  readonly isReplayActive:      boolean;
  readonly auditLogEntryCount:  number;
}

// ═══════════════════════════════════════════════════════════════════════════
// ENGINE METRICS
// ═══════════════════════════════════════════════════════════════════════════

export interface EngineMetrics {
  readonly totalTicksExecuted:          number;
  readonly totalRunsStarted:            number;
  readonly totalRunsCompleted:          number;
  readonly avgTickDurationMs:           number;
  readonly p95TickDurationMs:           number;
  readonly p99TickDurationMs:           number;
  readonly totalEventsEmitted:          number;
  readonly totalDecisionWindowsOpened:  number;
  readonly totalDecisionWindowsExpired: number;
  readonly totalAttacksFired:           number;
  readonly totalCascadesTriggered:      number;
  readonly uptimeMs:                    number;
  readonly lastResetAtMs:               number;
  readonly emergencyAbortsTotal:        number;
  readonly middlewareCallsTotal:        number;
}

// ═══════════════════════════════════════════════════════════════════════════
// ENGINE CAPABILITIES
// ═══════════════════════════════════════════════════════════════════════════

export interface EngineCapabilityFlags {
  readonly supportsReplay:               boolean;
  readonly supportsMiddleware:           boolean;
  readonly supportsDiagnostics:          boolean;
  readonly supportsPlugins:              boolean;
  readonly supportsEmergencyAbort:       boolean;
  readonly supportsHealthMonitoring:     boolean;
  readonly supportsAuditLog:             boolean;
  readonly maxConcurrentDecisionWindows: number;
  readonly maxMiddlewareDepth:           number;
  readonly tickHistoryDepth:             number;
  readonly maxPlugins:                   number;
}

export const DEFAULT_ENGINE_CAPABILITIES: EngineCapabilityFlags = Object.freeze({
  supportsReplay:               true,
  supportsMiddleware:           true,
  supportsDiagnostics:          true,
  supportsPlugins:              true,
  supportsEmergencyAbort:       true,
  supportsHealthMonitoring:     true,
  supportsAuditLog:             true,
  maxConcurrentDecisionWindows: 8,
  maxMiddlewareDepth:           16,
  tickHistoryDepth:             256,
  maxPlugins:                   32,
});

// ═══════════════════════════════════════════════════════════════════════════
// REPLAY SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

export interface ReplayConfig {
  readonly sourceRunId:             string;
  readonly tickHistory:             ReadonlyArray<TickPhaseRecord>;
  readonly startAtTick:             number;
  readonly endAtTick:               number;
  readonly playbackSpeedMultiplier: number; // 1.0 = real-time, 0.0 = instant
  readonly pauseOnDivergence:       boolean;
  readonly divergenceThresholdMs:   number;
  readonly emitEventsToLiveBus:     boolean;
}

export interface ReplayDivergenceEvent {
  readonly tickIndex:     number;
  readonly field:         string;
  readonly expectedValue: unknown;
  readonly actualValue:   unknown;
  readonly deltaMs:       number;
}

export type ReplayStatus = 'IDLE' | 'RUNNING' | 'PAUSED' | 'DIVERGED' | 'COMPLETE' | 'ABORTED';

export interface ReplayState {
  readonly status:        ReplayStatus;
  readonly currentTick:   number;
  readonly totalTicks:    number;
  readonly divergences:   ReadonlyArray<ReplayDivergenceEvent>;
  readonly completedAtMs: number | null;
  readonly startedAtMs:   number | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// SNAPSHOT FIELD DIFF (extends existing SnapshotDiff<T>)
// ═══════════════════════════════════════════════════════════════════════════

export interface SnapshotFieldDelta {
  readonly field:         string;
  readonly previousValue: unknown;
  readonly currentValue:  unknown;
  readonly deltaNumeric:  number | null; // set when both values are numbers
  readonly changeType:    'INCREASED' | 'DECREASED' | 'CHANGED' | 'UNCHANGED';
}

export interface TickSnapshotDiff {
  readonly fromTick:           number;
  readonly toTick:             number;
  readonly deltas:             ReadonlyArray<SnapshotFieldDelta>;
  readonly hasFinancialChange: boolean;
  readonly hasShieldChange:    boolean;
  readonly hasPressureChange:  boolean;
  readonly hasHeatChange:      boolean;
  readonly hasCascadeChange:   boolean;
  readonly significantChanges: number;
  readonly cashDelta:          number;
  readonly netWorthDelta:      number;
  readonly pressureDelta:      number;
  readonly heatDelta:          number;
}

export interface SnapshotValidationViolation {
  readonly field:    string;
  readonly message:  string;
  readonly severity: 'ERROR' | 'WARN';
  readonly value:    unknown;
}

export interface SnapshotValidationResult {
  readonly isValid:    boolean;
  readonly violations: ReadonlyArray<SnapshotValidationViolation>;
  readonly checkedAt:  number;
}

// ═══════════════════════════════════════════════════════════════════════════
// RUN AUDIT SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

export type RunAuditEventType =
  | 'RUN_STARTED'
  | 'RUN_ENDED'
  | 'TICK_EXECUTED'
  | 'TICK_ABORTED'
  | 'DECISION_WINDOW_OPENED'
  | 'DECISION_WINDOW_RESOLVED'
  | 'DECISION_WINDOW_EXPIRED'
  | 'HOLD_APPLIED'
  | 'ENGINE_REGISTERED'
  | 'MIDDLEWARE_REGISTERED'
  | 'PLUGIN_REGISTERED'
  | 'EMERGENCY_ABORT'
  | 'HEALTH_ALERT_RAISED'
  | 'TIER_TRANSITION'
  | 'REPLAY_STARTED'
  | 'REPLAY_STOPPED'
  | 'REPLAY_DIVERGENCE'
  | 'SNAPSHOT_VALIDATED'
  | 'METRICS_SAMPLED';

export interface RunAuditEntry {
  readonly id:          string;        // UUID
  readonly eventType:   RunAuditEventType;
  readonly tickIndex:   number;
  readonly timestampMs: number;
  readonly payload:     Readonly<Record<string, unknown>>;
  readonly severity:    'INFO' | 'WARN' | 'ERROR';
}

export interface RunAuditLog {
  readonly runId:       string;
  readonly entries:     ReadonlyArray<RunAuditEntry>;
  readonly startedAtMs: number;
  readonly endedAtMs:   number | null;
  readonly totalTicks:  number;
  readonly outcome:     RunOutcome | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// ENGINE PLUGIN SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Engine plugin contract. Plugins receive lifecycle callbacks without owning
 * tick-sequence logic. They observe only — never govern tick execution.
 */
export interface EnginePlugin {
  readonly pluginId: string;
  readonly version:  string;
  onTickStart?(ctx: TickMiddlewareContext): void;
  onTickEnd?(ctx: TickMiddlewareContext, record: TickPhaseRecord): void;
  onRunStart?(runId: string): void;
  onRunEnd?(runId: string, outcome: RunOutcome): void;
  onHealthAlert?(alert: EngineHealthAlert): void;
  onAuditEntry?(entry: RunAuditEntry): void;
  dispose?(): void;
}

// ═══════════════════════════════════════════════════════════════════════════
// DIAGNOSTICS & PERFORMANCE PROFILING
// ═══════════════════════════════════════════════════════════════════════════

export interface StepPerformanceProfile {
  readonly stepName:        string;
  readonly callCount:       number;
  readonly totalDurationMs: number;
  readonly avgDurationMs:   number;
  readonly minDurationMs:   number;
  readonly maxDurationMs:   number;
  readonly p50DurationMs:   number;
  readonly p95DurationMs:   number;
  readonly p99DurationMs:   number;
  readonly errorCount:      number;
  readonly errorRate:       number; // 0.0–1.0
}

export type EngineSystemStatus = 'HEALTHY' | 'DEGRADED' | 'CRITICAL' | 'UNKNOWN';

export interface HealthReport {
  readonly generatedAtMs:         number;
  readonly overallScore:          number; // 0–100
  readonly status:                EngineSystemStatus;
  readonly tickPaceHealth:        number; // 0–100
  readonly eventBusHealth:        number; // 0–100
  readonly decisionWindowHealth:  number; // 0–100
  readonly tierStabilityHealth:   number; // 0–100
  readonly stepPerformanceHealth: number; // 0–100
  readonly activeAlertCount:      number;
  readonly criticalAlertCount:    number;
  readonly recommendations:       ReadonlyArray<string>;
}

export interface DiagnosticsExport {
  readonly exportedAtMs:       number;
  readonly runId:              string | null;
  readonly totalTicksObserved: number;
  readonly avgDriftMs:         number;
  readonly maxDriftMs:         number;
  readonly p95DriftMs:         number;
  readonly avgFlushMs:         number;
  readonly maxFlushMs:         number;
  readonly stepProfiles:       ReadonlyArray<StepPerformanceProfile>;
  readonly healthReport:       HealthReport;
  readonly alerts:             ReadonlyArray<EngineHealthAlert>;
  readonly tierSequence:       ReadonlyArray<TickTier>;
}

// ═══════════════════════════════════════════════════════════════════════════
// EMERGENCY ABORT
// ═══════════════════════════════════════════════════════════════════════════

export type EmergencyAbortReason =
  | 'CRITICAL_HEALTH_FAILURE'
  | 'RUNAWAY_TICK_LOOP'
  | 'MEMORY_PRESSURE'
  | 'UNRECOVERABLE_STEP_ERROR'
  | 'INTEGRITY_VIOLATION'
  | 'EXTERNAL_SIGNAL'
  | 'TIMEOUT_EXCEEDED'
  | 'MIDDLEWARE_INFINITE_LOOP'
  | 'PLUGIN_CRASH_LOOP';

export interface EmergencyAbortEvent {
  readonly reason:              EmergencyAbortReason;
  readonly tickIndex:           number;
  readonly timestampMs:         number;
  readonly message:             string;
  readonly diagnosticsSnapshot: Readonly<Record<string, unknown>>;
}

// ═══════════════════════════════════════════════════════════════════════════
// EVENT BUS EXTENSION TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface BusHealthMetrics {
  readonly totalEmits:                number;
  readonly totalFlushes:              number;
  readonly totalSubscriptions:        number;
  readonly totalDeadLetters:          number;
  readonly avgQueueDepthAtFlush:      number;
  readonly maxQueueDepthObserved:     number;
  readonly totalMiddlewareCalls:      number;
  readonly totalHistoryEntries:       number;
  readonly wildcardSubscriptionCount: number;
  readonly lastFlushDurationMs:       number;
  readonly isCurrentlyFlushing:       boolean;
}

export interface EventHistoryEntry<T = unknown> {
  readonly eventName:      string;
  readonly payload:        T;
  readonly tickIndex:      number;
  readonly timestampMs:    number;
  readonly sequenceNumber: number;
}

export type EventPriority = 'HIGH' | 'NORMAL' | 'LOW';

export interface EventMiddlewareContext {
  readonly eventName: string;
  readonly payload:   unknown;
  readonly tickIndex: number;
  readonly priority:  EventPriority;
  skipped:         boolean;
  replacedPayload: unknown | null;
}

export type EventMiddlewareFn = (ctx: EventMiddlewareContext, next: () => void) => void;

export interface DeadLetterEntry {
  readonly eventName:   string;
  readonly payload:     unknown;
  readonly tickIndex:   number;
  readonly timestampMs: number;
  readonly reason:      'NO_SUBSCRIBERS' | 'MIDDLEWARE_SKIPPED' | 'HANDLER_ERROR';
}

