// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — ENGINE 0 CORE TYPES
// pzo-web/src/engines/zero/types.ts
//
// Single source of truth for all enums, interfaces, constants, and event payload
// contracts used by the Engine 0 module (Orchestrator, EventBus, RunStateSnapshot,
// EngineRegistry).
//
// RULES:
//   ✦ Zero runtime logic — pure TypeScript declarations only.
//   ✦ Zero imports — this file imports nothing.
//   ✦ All EngineEventName strings must have a matching entry in EngineEventPayloadMap.
//   ✦ All types used by other core files originate here.
//
// PHASE 1 CHANGES:
//   ✦ Added CARD = 'CARD_ENGINE' to EngineId (8th engine).
//   ✦ Added CardReader interface — minimal contract for cross-engine reads.
//     Defined here (not in cards/types.ts) so zero/types.ts stays import-free.
//     The CardEngine.getReader() return value satisfies this interface via
//     structural typing. No import required in either direction.
//   ✦ decisionsThisTick: DecisionRecordField[] already exists in
//     RunStateSnapshotFields — populated by EngineOrchestrator after Step 1.5.
//
// PHASE 5 CHANGES:
//   ✦ Added 14 MECHANIC_* events to EngineEventName union.
//   ✦ Added 14 matching payload definitions to EngineEventPayloadMap.
//   ✦ Mechanics events are emitted by MechanicsBridge and MechanicsRouter.
//
// Density6 LLC · Point Zero One · Engine 0 · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

// ── RUN STATE ──────────────────────────────────────────────────────────────────

/**
 * All possible outcomes when a run ends.
 * Drives sovereignty score multiplier and post-run reward dispatch.
 */
export type RunOutcome = 'FREEDOM' | 'TIMEOUT' | 'BANKRUPT' | 'ABANDONED';

/**
 * The current lifecycle state of the run, managed by EngineOrchestrator.
 * Only the Orchestrator reads and writes this — no other system.
 */
export type RunLifecycleState =
  | 'IDLE'         // No run active. Engines initialized but not running.
  | 'STARTING'     // startRun() called, engines initializing for new run.
  | 'ACTIVE'       // Tick loop is running. Normal play state.
  | 'TICK_LOCKED'  // Mid-tick. No external state changes allowed.
  | 'ENDING'       // endRun() triggered. Pipeline executing. No more ticks.
  | 'ENDED';       // Run fully complete. Sovereignty pipeline done.

/**
 * The result of a single tick — returned by EngineOrchestrator.executeTick().
 * Used by the test harness and the React hook to know what changed.
 */
export interface TickResult {
  tickIndex:          number;
  pressureScore:      number;           // from PressureEngine.computeScore()
  postActionPressure: number;           // from PressureEngine.recomputePostActions()
  attacksFired:       AttackEvent[];    // from BattleEngine.executeAttacks()
  damageResults:      DamageResult[];   // from ShieldEngine.applyAttacks()
  cascadeEffects:     CascadeEffect[];  // from CascadeEngine.executeScheduledLinks()
  recoveryResults:    RecoveryResult[]; // from CascadeEngine.checkRecoveryConditions()
  decisionsThisTick:  DecisionRecordField[]; // from CardEngine.tick() at Step 1.5
  runOutcome:         RunOutcome | null; // non-null if this tick ended the run
  tickDurationMs:     number;           // wall-clock cost of this tick (perf tracking)
}

// ── TICK TIERS ─────────────────────────────────────────────────────────────────

/**
 * TickTier enum — matches TimeEngine.TickTier exactly.
 * Duplicated here so core/types.ts has no engine-specific imports.
 *
 * T0 SOVEREIGN   — Slow, decisive ticks. Player has breathing room.
 * T1 STABLE      — Normal cadence. Standard play state.
 * T2 COMPRESSED  — Pressure building. Tick pace accelerates.
 * T3 CRISIS      — Fast ticks. Decision windows shrink.
 * T4 COLLAPSE_IMMINENT — Maximum speed. Near-failure state.
 */
export enum TickTier {
  SOVEREIGN         = 'T0',
  STABLE            = 'T1',
  COMPRESSED        = 'T2',
  CRISIS            = 'T3',
  COLLAPSE_IMMINENT = 'T4',
}

/**
 * PressureTier enum — matches PressureEngine.PressureTier exactly.
 * Duplicated here so core module has no dependency on the pressure/ module.
 */
export enum PressureTier {
  CALM     = 'CALM',
  BUILDING = 'BUILDING',
  ELEVATED = 'ELEVATED',
  HIGH     = 'HIGH',
  CRITICAL = 'CRITICAL',
}

// ── SHIELD ─────────────────────────────────────────────────────────────────────

/**
 * ShieldLayerId — the four shield layers in order from outer to inner.
 * Order matters: LIQUIDITY_BUFFER is first-hit. NETWORK_CORE is last-resort.
 *
 * L1 LIQUIDITY_BUFFER  max=100  — Cash reserves. Absorbs financial sabotage.
 * L2 CREDIT_LINE       max=80   — Debt headroom. Absorbs debt attacks.
 * L3 ASSET_FLOOR       max=60   — Hard asset base. Absorbs asset stripping.
 * L4 NETWORK_CORE      max=40   — Reputation + relationships. Last line.
 */
export enum ShieldLayerId {
  LIQUIDITY_BUFFER = 'L1',
  CREDIT_LINE      = 'L2',
  ASSET_FLOOR      = 'L3',
  NETWORK_CORE     = 'L4',
}

// ── BATTLE / BOTS ──────────────────────────────────────────────────────────────

/**
 * BotId — the five hater bots.
 * Each bot has a distinct attack profile and targeting logic.
 */
export enum BotId {
  LIQUIDATOR    = 'BOT_01',
  BUREAUCRAT    = 'BOT_02',
  MANIPULATOR   = 'BOT_03',
  CRASH_PROPHET = 'BOT_04',
  LEGACY_HEIR   = 'BOT_05',
}

// ── CROSS-ENGINE PAYLOAD TYPES ─────────────────────────────────────────────────
// These types are the contracts between engines.
// They travel as event payloads on the EventBus.

/**
 * Attack types — each routes to a primary shield layer in AttackRouter.
 *
 * FINANCIAL_SABOTAGE   → L1  EXPENSE_INJECTION → L1
 * DEBT_ATTACK          → L2
 * ASSET_STRIP          → L3  OPPORTUNITY_KILL  → L3
 * REPUTATION_ATTACK    → L4  REGULATORY_ATTACK → L4
 * HATER_INJECTION      → weakest layer (dynamic routing)
 */
export enum AttackType {
  FINANCIAL_SABOTAGE = 'FINANCIAL_SABOTAGE',
  EXPENSE_INJECTION  = 'EXPENSE_INJECTION',
  DEBT_ATTACK        = 'DEBT_ATTACK',
  ASSET_STRIP        = 'ASSET_STRIP',
  REPUTATION_ATTACK  = 'REPUTATION_ATTACK',
  REGULATORY_ATTACK  = 'REGULATORY_ATTACK',
  HATER_INJECTION    = 'HATER_INJECTION',
  OPPORTUNITY_KILL   = 'OPPORTUNITY_KILL',
}

/**
 * An attack event — generated by BattleEngine.executeAttacks().
 * Consumed by ShieldEngine.applyAttacks().
 * Travels from Step 6 → Step 7 of the tick sequence.
 */
export interface AttackEvent {
  attackId:      string;        // UUID — unique per attack instance
  botId:         BotId;         // Which bot fired this
  attackType:    AttackType;    // Determines shield routing
  damageAmount:  number;        // Points of integrity to remove from target layer
  targetLayerId: ShieldLayerId; // Primary target — may be overridden by AttackRouter
  timestamp:     number;        // Unix ms — for telemetry and replay
}

/**
 * Result of applying an AttackEvent to a shield layer.
 * Produced by ShieldEngine.applyAttacks() at Step 7.
 * Consumed by CascadeEngine at Steps 8–9.
 */
export interface DamageResult {
  attackId:         string;        // Matches the AttackEvent that caused this
  layerId:          ShieldLayerId; // Which layer was actually hit (may differ from attack target)
  damageApplied:    number;        // Points actually removed (no overflow between layers)
  integrityAfter:   number;        // Layer integrity after damage
  breachOccurred:   boolean;       // true if layer transitioned from >0 to 0
  cascadeTriggered: boolean;       // true if L4 breach caused full cascade trigger
  cascadeEventId?:  string;        // UUID of the cascade chain instance spawned (if any)
}

/**
 * A cascade effect that fired during CascadeEngine.executeScheduledLinks().
 * Used in TickResult and for RunStateSnapshot construction next tick.
 */
export interface CascadeEffect {
  chainId:    string; // Which chain definition produced this
  instanceId: string; // UUID of the specific chain instance
  linkIndex:  number; // Which link in the chain fired
  effectType: string; // INCOME_MODIFIER | EXPENSE_MODIFIER | etc.
  payload:    object; // Effect-specific data (shape varies by effectType)
  tickFired:  number; // Which tick this link executed on
}

/**
 * Result from CascadeEngine.checkRecoveryConditions().
 * Tracks chains that were broken by player actions this tick.
 */
export interface RecoveryResult {
  chainId:      string;
  instanceId:   string;
  recoveryCard: string; // The card type that triggered recovery
  linksSkipped: number; // How many future links were avoided
}

// ── ENGINE REGISTRY ────────────────────────────────────────────────────────────

/**
 * Unique string identifiers for all eight engines.
 * Used as keys in EngineRegistry.
 *
 * PHASE 1: Added CARD = 'CARD_ENGINE' as the 8th engine.
 * EngineRegistry.REQUIRED_ENGINES and allEnginesReady() validate all 8.
 */
export enum EngineId {
  TIME        = 'TIME_ENGINE',
  PRESSURE    = 'PRESSURE_ENGINE',
  TENSION     = 'TENSION_ENGINE',
  SHIELD      = 'SHIELD_ENGINE',
  BATTLE      = 'BATTLE_ENGINE',
  CASCADE     = 'CASCADE_ENGINE',
  SOVEREIGNTY = 'SOVEREIGNTY_ENGINE',
  CARD        = 'CARD_ENGINE',            // ← Phase 1: 8th engine
}

/**
 * The health/readiness state of a registered engine.
 */
export enum EngineHealth {
  UNREGISTERED = 'UNREGISTERED', // Not in registry
  REGISTERED   = 'REGISTERED',   // In registry, not yet initialized
  INITIALIZED  = 'INITIALIZED',  // Ready to run
  ERROR        = 'ERROR',        // Threw during init or tick — needs inspection
  DISABLED     = 'DISABLED',     // Intentionally disabled (test mode only)
}

/**
 * Entry in the EngineRegistry — one row per engine.
 */
export interface EngineEntry {
  id:           EngineId;
  health:       EngineHealth;
  instance:     IEngine;   // Reference to the engine class instance
  registeredAt: number;    // Unix ms
  lastError?:   string;    // Set if health === ERROR
}

/**
 * Minimal interface that every engine must satisfy to be registered.
 * All eight engines implement this interface.
 *
 * NOTE: CardEngine does not directly implement IEngine (its init signature
 * requires CardEngineInitParams which is a superset of EngineInitParams).
 * CardEngineAdapter wraps CardEngine and satisfies IEngine. The adapter is
 * what gets registered. See engines/cards/CardEngineAdapter.ts.
 */
export interface IEngine {
  readonly engineId: EngineId;
  init(params: EngineInitParams): void;
  reset(): void;
}

/**
 * Parameters passed to every engine on init().
 * Contains run configuration that engines need at start time.
 *
 * PHASE 1: cardReader is optional — injected by Orchestrator into engines that
 * need cross-engine card state reads. Engines that don't need card reads ignore it.
 * cardReader is typed as CardReader (defined below) which is structurally
 * compatible with the CardReader from engines/cards/types.ts.
 */
export interface EngineInitParams {
  runId:            string;
  userId:           string;
  seed:             string;
  seasonTickBudget: number;
  freedomThreshold: number;    // target net worth for FREEDOM win condition
  clientVersion:    string;
  engineVersion:    string;
  cardReader?:      CardReader; // optional — wired after CardEngine init
}

// ── CARD READER (defined here to preserve zero-import rule) ───────────────────

/**
 * Cross-engine read interface for the CardEngine.
 *
 * Defined in zero/types.ts (NOT in cards/types.ts) so engines can reference it
 * through EngineInitParams without importing from the cards/ module.
 *
 * CardEngine.getReader() returns an object that satisfies this interface via
 * TypeScript structural typing — no explicit relationship is required.
 *
 * Engines that receive CardReader through EngineInitParams.cardReader use it
 * to read card state without holding a direct reference to CardEngine.
 *
 * RULE: CardReader methods are read-only. Never pass a mutable reference to
 * card state into an engine — always expose a getter function.
 */
export interface CardReader {
  /** Current number of cards in the player's hand. */
  getHandSize(): number;

  /** Number of forced (injected) cards currently in hand. */
  getForcedCardCount(): number;

  /**
   * Count of unmitigated threat cards currently active.
   * Replaces store.activeThreatCardCount in RunStateSnapshot after Phase 1.
   */
  getActiveThreatCardCount(): number;

  /** Number of decision windows currently open (awaiting player choice). */
  getDecisionWindowsActive(): number;

  /** Holds remaining this tick (0 or 1 — Empire mode only). */
  getHoldsRemaining(): number;

  /** Consecutive missed optimal plays — used by tension and battle scoring. */
  getMissedOpportunityStreak(): number;

  /**
   * The most recently played card's definition ID, or null if no card has been
   * played this run. Returns unknown to avoid importing CardInHand here.
   */
  getLastPlayedCardId(): string | null;
}

// ── EVENTBUS TYPES ─────────────────────────────────────────────────────────────

/**
 * The master event name union — every event string that can travel on the bus.
 * Adding a new event REQUIRES adding it here AND in EngineEventPayloadMap.
 */
export type EngineEventName =
  // ── Time events (8)
  | 'TICK_START'
  | 'TICK_COMPLETE'
  | 'TICK_TIER_CHANGED'
  | 'TICK_TIER_FORCED'
  | 'DECISION_WINDOW_OPENED'
  | 'DECISION_WINDOW_EXPIRED'
  | 'DECISION_WINDOW_RESOLVED'
  | 'SEASON_TIMEOUT_IMMINENT'
  // ── Pressure events (3)
  | 'PRESSURE_TIER_CHANGED'
  | 'PRESSURE_CRITICAL'
  | 'PRESSURE_SCORE_UPDATED'
  // ── Tension events (7)
  | 'TENSION_SCORE_UPDATED'
  | 'ANTICIPATION_PULSE'
  | 'THREAT_VISIBILITY_CHANGED'
  | 'THREAT_QUEUED'
  | 'THREAT_ARRIVED'
  | 'THREAT_MITIGATED'
  | 'THREAT_EXPIRED'
  // ── Shield events (6)
  | 'SHIELD_LAYER_DAMAGED'
  | 'SHIELD_LAYER_BREACHED'
  | 'SHIELD_REPAIRED'
  | 'SHIELD_PASSIVE_REGEN'
  // Extended shield events used by ShieldUXBridge
  | 'SHIELD_FORTIFIED'
  | 'SHIELD_SNAPSHOT_UPDATED'
  // ── Battle events (8)
  | 'BOT_STATE_CHANGED'
  | 'BOT_ATTACK_FIRED'
  | 'BOT_NEUTRALIZED'
  | 'COUNTER_INTEL_AVAILABLE'
  | 'BATTLE_BUDGET_UPDATED'
  | 'SYNDICATE_DUEL_RESULT'
  // Extended battle events used by BattleUXBridge
  | 'BUDGET_ACTION_EXECUTED'
  | 'BATTLE_SNAPSHOT_UPDATED'
  // ── Cascade events (12)
  | 'CASCADE_CHAIN_TRIGGERED'
  | 'CASCADE_LINK_FIRED'
  | 'CASCADE_CHAIN_BROKEN'
  | 'CASCADE_CHAIN_COMPLETED'
  | 'POSITIVE_CASCADE_ACTIVATED'
  // Extended cascade events used by CascadeUXBridge
  | 'CASCADE_POSITIVE_ACTIVATED'
  | 'CASCADE_POSITIVE_DISSOLVED'
  | 'CASCADE_POSITIVE_PAUSED'
  | 'CASCADE_POSITIVE_RESUMED'
  | 'NEMESIS_BROKEN'
  | 'HATER_HEAT_WRITE_QUEUED'
  | 'CASCADE_TRIGGER_CAPPED'
  | 'CASCADE_SNAPSHOT_UPDATED'
  // ── Card layer events (28) — emitted by CardUXBridge via CardEventPayloadMap
  | 'CARD_DRAWN'
  | 'CARD_PLAYED'
  | 'CARD_DISCARDED'
  | 'CARD_HELD'
  | 'CARD_UNHELD'
  | 'CARD_AUTO_RESOLVED'
  | 'FORCED_CARD_INJECTED'
  | 'FORCED_CARD_RESOLVED'
  | 'MISSED_OPPORTUNITY'
  | 'PHASE_BOUNDARY_CARD_AVAILABLE'
  | 'PHASE_BOUNDARY_WINDOW_CLOSED'
  | 'LEGENDARY_CARD_DRAWN'
  | 'BLUFF_CARD_DISPLAYED'
  | 'COUNTER_WINDOW_OPENED'
  | 'COUNTER_WINDOW_CLOSED'
  | 'RESCUE_WINDOW_OPENED'
  | 'RESCUE_WINDOW_CLOSED'
  | 'DEFECTION_STEP_PLAYED'
  | 'DEFECTION_COMPLETED'
  | 'AID_TERMS_ACTIVATED'
  | 'AID_REPAID'
  | 'AID_DEFAULTED'
  | 'GHOST_CARD_ACTIVATED'
  | 'PROOF_BADGE_CONDITION_MET'
  | 'CARD_HAND_SNAPSHOT'
  // ── Sovereignty events (4)
  | 'RUN_COMPLETED'
  | 'PROOF_VERIFICATION_FAILED'
  | 'RUN_REWARD_DISPATCHED'
  | 'PROOF_ARTIFACT_READY'
  // ── Orchestrator lifecycle events (4)
  | 'RUN_STARTED'
  | 'RUN_ENDED'
  | 'ENGINE_ERROR'
  | 'TICK_STEP_ERROR'
  // ── Mechanics events (14) — emitted by MechanicsBridge and MechanicsRouter
  | 'MECHANIC_INCOME_DELTA'
  | 'MECHANIC_EXPENSE_DELTA'
  | 'MECHANIC_CASH_DELTA'
  | 'MECHANIC_NET_WORTH_DELTA'
  | 'MECHANIC_SHIELD_DELTA'
  | 'MECHANIC_HEAT_DELTA'
  | 'MECHANIC_PRESSURE_DELTA'
  | 'MECHANIC_TENSION_DELTA'
  | 'MECHANIC_CORD_DELTA'
  | 'MECHANIC_FREEZE_TICKS'
  | 'MECHANIC_CUSTOM_PAYLOAD'
  | 'MECHANIC_FIRED'
  | 'MECHANIC_CASCADE_LINK'
  | 'MECHANICS_TICK_COMPLETE';

/**
 * Generic event envelope — every event on the bus has this shape.
 * T is narrowed to a specific EngineEventName; P is the matching payload.
 */
export interface EngineEvent<
  T extends EngineEventName = EngineEventName,
  P = unknown,
> {
  eventType:     T;
  payload:       P;
  tickIndex:     number;      // Which tick this event was queued on
  timestamp:     number;      // Unix ms when queued
  sourceEngine?: EngineId;    // Which engine emitted this (optional telemetry)
}

/**
 * Typed payload definitions for all known events.
 * Every entry in EngineEventName MUST have a corresponding entry here.
 */
export interface EngineEventPayloadMap {
  // ── Time (8) ──────────────────────────────────────────────────────────────
  'TICK_START':               { tickIndex: number; tickDurationMs: number };
  'TICK_COMPLETE':            { tickIndex: number; tickDurationMs: number; outcome: RunOutcome | null };
  'TICK_TIER_CHANGED':        { from: TickTier; to: TickTier; transitionTicks: number };
  'TICK_TIER_FORCED':         { tier: TickTier; durationTicks: number };
  'DECISION_WINDOW_OPENED':   { cardId: string; durationMs: number; autoResolveResult: string };
  'DECISION_WINDOW_EXPIRED':  { cardId: string; result: string; speedScore: number };
  'DECISION_WINDOW_RESOLVED': { cardId: string; choiceId: string; resolvedInMs: number; wasOptimal: boolean };
  'SEASON_TIMEOUT_IMMINENT':  { ticksRemaining: number };

  // ── Pressure (3) ──────────────────────────────────────────────────────────
  'PRESSURE_TIER_CHANGED':    { from: PressureTier; to: PressureTier; score: number };
  'PRESSURE_CRITICAL':        { score: number; triggerSignals: string[] };
  'PRESSURE_SCORE_UPDATED':   { score: number; tier: PressureTier; tickIndex: number };

  // ── Tension (7) ───────────────────────────────────────────────────────────
  'TENSION_SCORE_UPDATED':    { score: number; tickIndex: number };
  'ANTICIPATION_PULSE':       { tensionScore: number; queueDepth: number };
  'THREAT_VISIBILITY_CHANGED':{ from: string; to: string };
  'THREAT_QUEUED':            { threatId: string; threatType: string; arrivalTick: number };
  'THREAT_ARRIVED':           { threatId: string; threatType: string };
  'THREAT_MITIGATED':         { threatId: string; cardUsed: string };
  'THREAT_EXPIRED':           { threatId: string; unmitigated: boolean };

  // ── Shield (6) ────────────────────────────────────────────────────────────
  'SHIELD_LAYER_DAMAGED':     { layer: ShieldLayerId; damage: number; integrity: number; attackId: string };
  'SHIELD_LAYER_BREACHED':    { layer: ShieldLayerId; cascadeEventId?: string };
  'SHIELD_REPAIRED':          { layer: ShieldLayerId; amount: number; newIntegrity: number };
  'SHIELD_PASSIVE_REGEN':     { layer: ShieldLayerId; amount: number; newIntegrity: number };
  'SHIELD_FORTIFIED':         object;  // no payload fields — presence is the signal
  'SHIELD_SNAPSHOT_UPDATED':  { snapshot: object };

  // ── Battle (8) ────────────────────────────────────────────────────────────
  'BOT_STATE_CHANGED':        { botId: BotId; from: string; to: string };
  'BOT_ATTACK_FIRED':         { botId: BotId; attackType: AttackType; targetLayer: ShieldLayerId };
  'BOT_NEUTRALIZED':          { botId: BotId; immunityTicks: number };
  'COUNTER_INTEL_AVAILABLE':  { botId: BotId; attackProfile: object; tier: string };
  'BATTLE_BUDGET_UPDATED':    { remaining: number; spent: number; tickBudget: number };
  'SYNDICATE_DUEL_RESULT':    { duelId: string; winnerId: string; loserId: string; reward: object };
  'BUDGET_ACTION_EXECUTED':   { action: object; remainingBudget: number };
  'BATTLE_SNAPSHOT_UPDATED':  { snapshot: object };

  // ── Cascade (12) ──────────────────────────────────────────────────────────
  'CASCADE_CHAIN_TRIGGERED':  { chainId: string; instanceId: string; severity: string };
  'CASCADE_LINK_FIRED':       { chainId: string; instanceId: string; linkIndex: number; effect: CascadeEffect };
  'CASCADE_CHAIN_BROKEN':     { chainId: string; instanceId: string; recoveryCard: string; linksSkipped: number };
  'CASCADE_CHAIN_COMPLETED':  { chainId: string; instanceId: string; allLinksResolved: boolean };
  'POSITIVE_CASCADE_ACTIVATED':{ chainId: string; instanceId: string; type: string };
  // Extended cascade payloads
  'CASCADE_POSITIVE_ACTIVATED':  { pchainId: string; chainName: string; effectDescription: string };
  'CASCADE_POSITIVE_DISSOLVED':  { pchainId: string; dissolutionReason: string };
  'CASCADE_POSITIVE_PAUSED':     { pchainId: string; pauseReason: string };
  'CASCADE_POSITIVE_RESUMED':    { pchainId: string };
  'NEMESIS_BROKEN':              { botId: string; haterHeatReset: boolean; immunityTicks: number };
  'HATER_HEAT_WRITE_QUEUED':     { delta: number; sourceChainId: string };
  'CASCADE_TRIGGER_CAPPED':      { chainId: string; currentInstanceCount: number };
  'CASCADE_SNAPSHOT_UPDATED':    { snapshot: object };

  // ── Card layer (28) — typed via CardEventPayloadMap in cards/types.ts ─────
  // Broad types here prevent circular deps; full precision lives in CardUXBridge
  'CARD_DRAWN':                   { instanceId: string; cardId: string; deckType: string; rarity: string; tickIndex: number };
  'CARD_PLAYED':                  { instanceId: string; cardId: string; choiceId: string; resolvedInMs: number; wasOptimal: boolean; cordDelta: number; tickIndex: number };
  'CARD_DISCARDED':               { instanceId: string; cardId: string; reason: string; tickIndex: number };
  'CARD_HELD':                    { instanceId: string; cardId: string; remainingMs: number; tickIndex: number };
  'CARD_UNHELD':                  { instanceId: string; cardId: string; tickIndex: number };
  'CARD_AUTO_RESOLVED':           { instanceId: string; cardId: string; autoChoice: string; speedScore: number; tickIndex: number };
  'FORCED_CARD_INJECTED':         { entryId: string; cardId: string; source: string; instanceId: string; tickIndex: number };
  'FORCED_CARD_RESOLVED':         { entryId: string; cardId: string; instanceId: string; tickIndex: number };
  'MISSED_OPPORTUNITY':           { instanceId: string; cardId: string; cordLost: number; streakCount: number; tickIndex: number };
  'PHASE_BOUNDARY_CARD_AVAILABLE':{ phase: string; cardsAvailable: string[]; closesAtTick: number; tickIndex: number };
  'PHASE_BOUNDARY_WINDOW_CLOSED': { phase: string; wasConsumed: boolean; tickIndex: number };
  'LEGENDARY_CARD_DRAWN':         { instanceId: string; cardId: string; tickIndex: number };
  'BLUFF_CARD_DISPLAYED':         { instanceId: string; cardId: string; displayedAsCardId: string; tickIndex: number };
  'COUNTER_WINDOW_OPENED':        { triggerAttackId: string; durationMs: number; tickIndex: number };
  'COUNTER_WINDOW_CLOSED':        { triggerAttackId: string; wasCountered: boolean; tickIndex: number };
  'RESCUE_WINDOW_OPENED':         { teammateId: string; durationMs: number; tickIndex: number };
  'RESCUE_WINDOW_CLOSED':         { teammateId: string; wasRescued: boolean; effectivenessMultiplier: number; tickIndex: number };
  'DEFECTION_STEP_PLAYED':        { step: string; defectorId: string; tickIndex: number };
  'DEFECTION_COMPLETED':          { defectorId: string; cordPenalty: number; tickIndex: number };
  'AID_TERMS_ACTIVATED':          { terms: object; tickIndex: number };
  'AID_REPAID':                   { lenderId: string; receiverId: string; amount: number; tickIndex: number };
  'AID_DEFAULTED':                { receiverId: string; penaltyApplied: number; tickIndex: number };
  'GHOST_CARD_ACTIVATED':         { instanceId: string; cardId: string; markerType: string; divergenceDelta: number; tickIndex: number };
  'PROOF_BADGE_CONDITION_MET':    { badgeId: string; cardId: string; tickIndex: number };
  'CARD_HAND_SNAPSHOT':           { handSize: number; forcedCount: number; windowsActive: number; tickIndex: number };

  // ── Sovereignty (4) ───────────────────────────────────────────────────────
  'RUN_COMPLETED':            { runId: string; proofHash: string; grade: string; sovereigntyScore: number; integrityStatus: string; reward: object };
  'PROOF_VERIFICATION_FAILED':{ runId: string; step: number; reason: string };
  'RUN_REWARD_DISPATCHED':    { runId: string; userId: string; grade: string; xp: number; cosmetics: string[] };
  'PROOF_ARTIFACT_READY':     { runId: string; exportUrl: string; format: string };

  // ── Orchestrator lifecycle (4) ────────────────────────────────────────────
  'RUN_STARTED':              { runId: string; userId: string; seed: string; tickBudget: number };
  'RUN_ENDED':                { runId: string; outcome: RunOutcome; finalNetWorth: number };
  'ENGINE_ERROR':             { engineId: EngineId; error: string; step: number };
  'TICK_STEP_ERROR':          { step: number; engineId?: EngineId; error: string };

  // ── Mechanics (14) ─────────────────────────────────────────────────────────
  'MECHANIC_INCOME_DELTA':    { mechanicId: string; execHook: string; tickIndex: number; delta: number };
  'MECHANIC_EXPENSE_DELTA':   { mechanicId: string; execHook: string; tickIndex: number; delta: number };
  'MECHANIC_CASH_DELTA':      { mechanicId: string; execHook: string; tickIndex: number; delta: number };
  'MECHANIC_NET_WORTH_DELTA': { mechanicId: string; execHook: string; tickIndex: number; delta: number };
  'MECHANIC_SHIELD_DELTA':    { mechanicId: string; execHook: string; tickIndex: number; layerId: string; delta: number };
  'MECHANIC_HEAT_DELTA':      { mechanicId: string; execHook: string; tickIndex: number; delta: number };
  'MECHANIC_PRESSURE_DELTA':  { mechanicId: string; execHook: string; tickIndex: number; delta: number };
  'MECHANIC_TENSION_DELTA':   { mechanicId: string; execHook: string; tickIndex: number; delta: number };
  'MECHANIC_CORD_DELTA':      { mechanicId: string; execHook: string; tickIndex: number; delta: number };
  'MECHANIC_FREEZE_TICKS':    { mechanicId: string; execHook: string; tickIndex: number; ticks: number };
  'MECHANIC_CUSTOM_PAYLOAD':  { mechanicId: string; execHook: string; tickIndex: number; payload: Record<string, unknown> };
  'MECHANIC_FIRED':           { mechanicId: string; execHook: string; tickIndex: number; priority: number; batch: number; layer: string; family: string; kind: string };
  'MECHANIC_CASCADE_LINK':    { mechanicId: string; execHook: string; tickIndex: number; linkId: string; delayTicks: number; magnitude: number; chainType: string };
  'MECHANICS_TICK_COMPLETE':  { tickIndex: number; mechanicsFired: number; mechanicsSkipped: number; mechanicsErrored: number; totalExecutionMs: number };
}

// ── RUNSTATESNAPSHOT FIELDS ────────────────────────────────────────────────────
// Every field on the read-only snapshot passed to engines each tick.
// Defined here so all modules can reference the shape without importing
// RunStateSnapshot directly (which would create a circular dependency).

export interface RunStateSnapshotFields {
  // ── Tick metadata
  readonly runId:                   string;
  readonly userId:                  string;
  readonly seed:                    string;
  readonly tickIndex:               number;  // 0-based current tick
  readonly seasonTickBudget:        number;  // max ticks allowed this run
  readonly ticksRemaining:          number;  // seasonTickBudget - tickIndex
  readonly freedomThreshold:        number;  // target net worth for FREEDOM

  // ── Financial state
  readonly netWorth:                number;
  readonly cashBalance:             number;
  readonly monthlyIncome:           number;
  readonly monthlyExpenses:         number;
  readonly cashflow:                number;  // monthlyIncome - monthlyExpenses (computed)

  // ── Time Engine state
  readonly currentTickTier:         TickTier;
  readonly currentTickDurationMs:   number;
  readonly activeDecisionWindows:   number; // count of open decision timers
  readonly holdsRemaining:          number; // 0 or 1

  // ── Pressure Engine state
  readonly pressureScore:           number;  // 0.0–1.0
  readonly pressureTier:            PressureTier;
  readonly ticksWithoutIncomeGrowth: number;

  // ── Tension Engine state
  readonly tensionScore:            number;  // 0.0–1.0
  readonly anticipationQueueDepth:  number;  // count of queued threats
  readonly threatVisibilityState:   string;  // SHADOWED | SIGNALED | TELEGRAPHED | EXPOSED

  // ── Shield Engine state (per-layer + aggregate)
  readonly shieldAvgIntegrityPct:   number;  // 0–100, time-averaged across all 4 layers
  readonly shieldL1Integrity:       number;  // LIQUIDITY_BUFFER current pts
  readonly shieldL2Integrity:       number;  // CREDIT_LINE current pts
  readonly shieldL3Integrity:       number;  // ASSET_FLOOR current pts
  readonly shieldL4Integrity:       number;  // NETWORK_CORE current pts
  readonly shieldL1Max:             number;  // 100 — immutable
  readonly shieldL2Max:             number;  // 80  — immutable
  readonly shieldL3Max:             number;  // 60  — immutable
  readonly shieldL4Max:             number;  // 40  — immutable

  // ── Battle Engine state
  readonly haterHeat:               number;  // 0–100, from DB
  readonly activeBotCount:          number;  // bots in WATCHING/TARGETING/ATTACKING
  readonly haterAttemptsThisTick:   number;  // attack events dispatched this tick
  readonly haterBlockedThisTick:    number;  // attacks fully absorbed by shields
  readonly haterDamagedThisTick:    number;  // attacks that caused damage
  readonly activeThreatCardCount:   number;  // unmitigated threat cards in hand

  // ── Cascade Engine state
  readonly activeCascadeChains:       number;
  readonly cascadesTriggeredThisTick: number;
  readonly cascadesBrokenThisTick:    number;

  // ── Decision tracking (for Sovereignty Engine)
  // Populated by EngineOrchestrator from CardEngine.tick() output at Step 1.5.
  // Contains decisions resolved during the PREVIOUS tick so they are available
  // to all engines in the current tick's snapshot.
  readonly decisionsThisTick: DecisionRecordField[];
}

/**
 * A single decision record within the snapshot.
 * Projected from cards/types.ts DecisionRecord into the fields needed by
 * zero/types.ts consumers (SovereigntyEngine, TensionEngine, etc.).
 *
 * PHASE 1: Populated by EngineOrchestrator.buildRunStateSnapshot() using
 * this.lastTickDecisions, which is set after cardEngine.tick() completes at Step 1.5.
 */
export interface DecisionRecordField {
  cardId:            string;
  decisionWindowMs:  number;
  resolvedInMs:      number;
  wasAutoResolved:   boolean;
  wasOptimalChoice:  boolean;
  speedScore:        number;
}