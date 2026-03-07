//Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/cards/types.ts

// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — CARDS ENGINE TYPES
// pzo-web/src/engines/cards/types.ts
//
// Single source of truth for the entire card system.
// 12 TimingClass entries · 6 base + 8 mode-exclusive deck types ·
// Base card schema · ModeOverlay interface · Tag taxonomy ·
// All card EventBus event names + payload map
//
// RULES:
//   ✦ Zero imports — this file imports nothing.
//   ✦ Zero runtime logic — pure TypeScript declarations only.
//   ✦ All types consumed by CardEngine sub-components originate here.
//   ✦ Engine 0 types (EngineId, RunLifecycleState, etc.) are NOT imported;
//     compatible primitives are re-declared where needed.
//
// Density6 LLC · Point Zero One · Cards Engine · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

// ── GAME MODES ─────────────────────────────────────────────────────────────────

/**
 * The four game modes. Mode selection at run start determines:
 *   - Which deck types are legal
 *   - Which ModeOverlay is applied at draw time
 *   - Which mode handler plugin is active in CardEngine
 */
export enum GameMode {
  GO_ALONE       = 'GO_ALONE',        // Empire: capital allocation, hold system
  HEAD_TO_HEAD   = 'HEAD_TO_HEAD',    // Predator: battle budget, counter window
  TEAM_UP        = 'TEAM_UP',         // Syndicate: trust score, defection arc
  CHASE_A_LEGEND = 'CHASE_A_LEGEND',  // Phantom: ghost cards, divergence scoring
}

// ── TIMING CLASSES ─────────────────────────────────────────────────────────────

/**
 * The 12 timing classes. A card's timing_class determines when it is legal to
 * play. TimingValidator enforces these windows per tick.
 *
 * IMMEDIATE        — Playable any tick, no restrictions. (e.g. income buffs)
 * REACTIVE         — Must be played within 2 ticks of triggering event.
 * STANDARD         — Normal play window. Always open unless locked by mode.
 * HOLD             — Empire only. Timer paused. Staged for deferred play.
 * COUNTER_WINDOW   — Predator only. Legal only during 5-sec counter window.
 * RESCUE_WINDOW    — Syndicate only. Legal only when teammate is CRITICAL.
 * PHASE_BOUNDARY   — GO_ALONE only. Legal only in 5-tick phase transition window.
 * FORCED           — Cannot be discarded. Must be resolved before other plays.
 * LEGENDARY        — Any mode. Always legal, never blocked by bots.
 * BLUFF            — Predator only. Displays as threat, executes buff/trap.
 * DEFECTION_STEP   — Syndicate only. Part of 3-card betrayal arc sequence.
 * SOVEREIGNTY_DECISION — GO_ALONE only. Final high-stakes card at minute 11:30.
 */
export enum TimingClass {
  IMMEDIATE            = 'IMMEDIATE',
  REACTIVE             = 'REACTIVE',
  STANDARD             = 'STANDARD',
  HOLD                 = 'HOLD',
  COUNTER_WINDOW       = 'COUNTER_WINDOW',
  RESCUE_WINDOW        = 'RESCUE_WINDOW',
  PHASE_BOUNDARY       = 'PHASE_BOUNDARY',
  FORCED               = 'FORCED',
  LEGENDARY            = 'LEGENDARY',
  BLUFF                = 'BLUFF',
  DEFECTION_STEP       = 'DEFECTION_STEP',
  SOVEREIGNTY_DECISION = 'SOVEREIGNTY_DECISION',
}

// ── DECK TYPES ─────────────────────────────────────────────────────────────────

/**
 * The 6 base deck types — appear in multiple modes.
 * Mode legality matrix in CARD_LEGALITY_MATRIX determines which modes include each.
 */
export enum BaseDeckType {
  OPPORTUNITY    = 'OPPORTUNITY',   // Capital deployment — primary growth tool
  IPA            = 'IPA',           // Income-Producing Assets — compounding engine
  FUBAR          = 'FUBAR',         // Market reality — mostly engine-injected
  PRIVILEGED     = 'PRIVILEGED',    // Power moves with heat tradeoff
  SO             = 'SO',            // Systemic Obstacle conversion (cash/time/pain)
  PHASE_BOUNDARY = 'PHASE_BOUNDARY',// Phase transition cards — 5-tick window only
}

/**
 * The 8 mode-exclusive deck types — only legal in specific modes.
 */
export enum ModeDeckType {
  // Predator (HEAD_TO_HEAD) exclusive
  SABOTAGE  = 'SABOTAGE',   // Extraction actions — costs Battle Budget
  COUNTER   = 'COUNTER',    // Counter-play cards — held in advance
  BLUFF     = 'BLUFF',      // Displays as threat; executes buff/trap

  // Syndicate (TEAM_UP) exclusive
  AID       = 'AID',        // Financial contracts with embedded repayment terms
  RESCUE    = 'RESCUE',     // Emergency interventions during CRITICAL pressure
  TRUST     = 'TRUST',      // Trust Score meta-game instruments
  DEFECTION = 'DEFECTION',  // 3-card betrayal arc: Break Pact → Silent Exit → Asset Seizure

  // Phantom (CHASE_A_LEGEND) exclusive
  GHOST     = 'GHOST',      // Interact with Legend Marker data — requires ghost
  DISCIPLINE = 'DISCIPLINE', // Reduce variance — deterministic run stabilization
}

/** Union of all deck types for exhaustive type coverage. */
export type DeckType = BaseDeckType | ModeDeckType;

// ── CARD TAG TAXONOMY ──────────────────────────────────────────────────────────

/**
 * Card tags — the mode routing system.
 * Tags are read by ModeOverlayEngine to apply per-mode scoring weight overrides.
 * The engine does not hardcode "this card is good in Empire" — instead Empire
 * reads liquidity and resilience tags and weights them higher.
 */
export enum CardTag {
  // Financial mechanics
  LIQUIDITY    = 'liquidity',
  INCOME       = 'income',
  COMPOUNDING  = 'compounding',
  RESILIENCE   = 'resilience',
  AUTOMATION   = 'automation',
  TEMPO        = 'tempo',
  LEVERAGE     = 'leverage',
  SABOTAGE     = 'sabotage',
  COUNTER      = 'counter',
  TRUST        = 'trust',
  PRECISION    = 'precision',
  VARIANCE_RED = 'variance_reduction',

  // Mode signals
  CAPITAL_ALLOC  = 'capital_allocation',
  COMBAT         = 'combat',
  COOPERATIVE    = 'cooperative',
  DETERMINISTIC  = 'deterministic',

  // Rarity / power tier
  LEGENDARY_TAG  = 'legendary',
  PRIVILEGED_TAG = 'privileged',

  // Educational mapping
  REAL_WORLD_FINANCE = 'real_world_finance',
}

// ── CARD TARGETING ─────────────────────────────────────────────────────────────

export enum Targeting {
  SELF      = 'SELF',      // Affects only the playing player
  OPPONENT  = 'OPPONENT',  // Affects the opponent (HEAD_TO_HEAD only)
  TEAMMATE  = 'TEAMMATE',  // Affects a specific teammate (TEAM_UP only)
  TEAM_ALL  = 'TEAM_ALL',  // Affects entire team (TEAM_UP)
  GHOST_REF = 'GHOST_REF', // Targets Legend Marker data (CHASE_A_LEGEND only)
  ENGINE    = 'ENGINE',    // Targets a game engine system directly (e.g. shield repair)
}

// ── CARD RARITY ────────────────────────────────────────────────────────────────

export enum CardRarity {
  COMMON    = 'COMMON',    // Base drop rate
  UNCOMMON  = 'UNCOMMON',
  RARE      = 'RARE',
  EPIC      = 'EPIC',
  LEGENDARY = 'LEGENDARY', // 1% drop rate — cannot be blocked by any hater bot
}

// ── LEGEND MARKER TYPES (Phantom mode) ────────────────────────────────────────

export enum LegendMarkerType {
  GOLD   = 'GOLD',   // Highest-CORD decision moments
  RED    = 'RED',    // Crisis recovery points
  PURPLE = 'PURPLE', // Cascade chain interceptions
  SILVER = 'SILVER', // Timing optimization moments
  BLACK  = 'BLACK',  // Risk decisions — volatile outcome
}

// ── DEFECTION STEP IDs (Syndicate mode) ───────────────────────────────────────

export enum DefectionStep {
  BREAK_PACT   = 'BREAK_PACT',    // Step 1 — initiates betrayal arc
  SILENT_EXIT  = 'SILENT_EXIT',   // Step 2 — executed ≥1 tick after step 1
  ASSET_SEIZURE = 'ASSET_SEIZURE',// Step 3 — completes defection ≥1 tick after step 2
}

// ── PHASE IDs (Empire / GO_ALONE mode) ────────────────────────────────────────

export enum RunPhase {
  FOUNDATION  = 'FOUNDATION',   // Phase 1 — ticks 0 to boundary_1
  ESCALATION  = 'ESCALATION',   // Phase 2 — boundary_1 to boundary_2
  SOVEREIGNTY = 'SOVEREIGNTY',  // Phase 3 — boundary_2 to run end
}

// ── BASE CARD SCHEMA ───────────────────────────────────────────────────────────

/**
 * The immutable base definition of every card in the game.
 * Mode overlays mutate runtime behavior — the base definition never changes.
 * Every card in CardRegistry.ts is a CardDefinition.
 */
export interface CardDefinition {
  readonly cardId:          string;          // Unique slug e.g. 'opportunity_rental_001'
  readonly name:            string;          // Display name
  readonly deckType:        DeckType;
  readonly rarity:          CardRarity;
  readonly timingClass:     TimingClass;
  readonly base_cost:       number;          // Cash cost (or BB cost for combat cards)
  readonly base_effect:     CardBaseEffect;
  readonly tags:            CardTag[];
  readonly targeting:       Targeting;
  readonly educational_tag: string;          // Real-world finance principle mapped
  readonly lore:            string;          // Flavor text — one sentence max
  readonly modes_legal:     GameMode[];      // Which modes this card can appear in
  readonly is_forced:       boolean;         // true = cannot be discarded
  readonly drop_weight:     number;          // 0–100 relative weight in deck shuffle
}

/**
 * The mechanical effect of a card before mode overlay scaling.
 * effectType routes to the correct resolver in CardEffectResolver.
 */
export interface CardBaseEffect {
  effectType:   CardEffectType;
  magnitude:    number;       // Primary effect value
  duration?:    number;       // Ticks this effect persists (0 = instant)
  secondary?:   CardBaseEffect; // Optional chained secondary effect
  conditions?:  string[];     // Condition strings evaluated by CardEffectResolver
}

export enum CardEffectType {
  INCOME_BOOST         = 'INCOME_BOOST',
  INCOME_REDUCTION     = 'INCOME_REDUCTION',
  EXPENSE_REDUCTION    = 'EXPENSE_REDUCTION',
  EXPENSE_SPIKE        = 'EXPENSE_SPIKE',
  SHIELD_REPAIR        = 'SHIELD_REPAIR',
  SHIELD_FORTIFY       = 'SHIELD_FORTIFY',
  HATER_HEAT_REDUCE    = 'HATER_HEAT_REDUCE',
  HATER_HEAT_SPIKE     = 'HATER_HEAT_SPIKE',
  BOT_NEUTRALIZE       = 'BOT_NEUTRALIZE',
  CASCADE_INTERRUPT    = 'CASCADE_INTERRUPT',
  CASCADE_ACCELERATE   = 'CASCADE_ACCELERATE',
  BATTLE_BUDGET_GRANT  = 'BATTLE_BUDGET_GRANT',
  BATTLE_BUDGET_DRAIN  = 'BATTLE_BUDGET_DRAIN',
  TRUST_SCORE_BOOST    = 'TRUST_SCORE_BOOST',
  TRUST_SCORE_DRAIN    = 'TRUST_SCORE_DRAIN',
  TREASURY_INJECT      = 'TREASURY_INJECT',
  TREASURY_DRAIN       = 'TREASURY_DRAIN',
  DIVERGENCE_REDUCE    = 'DIVERGENCE_REDUCE',
  VARIANCE_LOCK        = 'VARIANCE_LOCK',
  EXTRACTION_FIRE      = 'EXTRACTION_FIRE',   // Predator — attack opponent
  EXTRACTION_BLOCK     = 'EXTRACTION_BLOCK',  // Predator — counter incoming attack
  BLUFF_DISPLAY        = 'BLUFF_DISPLAY',     // Predator — display fake threat
  PROOF_BADGE_UNLOCK   = 'PROOF_BADGE_UNLOCK',// Phantom — unlock a proof badge condition
  CORD_BONUS_FLAT      = 'CORD_BONUS_FLAT',   // Direct CORD modifier
  HOLD_STAGE           = 'HOLD_STAGE',        // Empire — pause decision timer
  NO_OP                = 'NO_OP',             // Placeholder / testing
}

// ── MODE OVERLAY INTERFACE ─────────────────────────────────────────────────────

/**
 * ModeOverlay — applied to every card at draw time by ModeOverlayEngine.
 * The base CardDefinition never changes.
 * Only the runtime CardInHand instance reflects the overlay.
 */
export interface ModeOverlay {
  cost_modifier:      number;                  // Multiplier on base_cost (0.8 = 20% cheaper)
  effect_modifier:    number;                  // Multiplier on all base_effect magnitudes
  tag_weights:        Partial<Record<CardTag, number>>; // Per-tag CORD scoring weight overrides
  timing_lock:        TimingClass[];           // Additional timing restrictions in this mode
  legal:              boolean;                 // false = card never enters hand in this mode
  targeting_override: Targeting | null;        // Override default targeting if set
  cord_weight:        number;                  // Mode-specific CORD contribution multiplier
}

// ── RUNTIME CARD (IN HAND) ────────────────────────────────────────────────────

/**
 * A card as it exists in the player's hand — base definition + applied overlay.
 * This is the object that TimingValidator, CardEffectResolver, and CardScorer
 * operate on. Never mutate the underlying definition — only CardInHand fields.
 */
export interface CardInHand {
  readonly instanceId:    string;          // UUID — unique per draw instance
  readonly definition:    CardDefinition;  // Immutable base definition
  readonly overlay:       ModeOverlay;     // Applied at draw time
  readonly drawnAtTick:   number;
  readonly isForced:      boolean;         // true = cannot discard
  readonly isHeld:        boolean;         // Empire hold system — timer paused
  readonly isLegendary:   boolean;         // Shortcut for rarity check
  readonly effectiveCost: number;          // definition.base_cost * overlay.cost_modifier
  readonly decisionWindowId: string | null; // Null until window is opened
}

/**
 * A card staged in the Empire hold slot.
 * Timer is paused. Card is not in the active hand count.
 */
export interface HoldSlot {
  readonly card:           CardInHand;
  readonly heldAtTick:     number;
  readonly heldAtMs:       number;          // wall clock ms when hold was activated
  readonly remainingMs:    number;          // time left in decision window at hold time
}

// ── DECISION WINDOW ────────────────────────────────────────────────────────────

export interface DecisionWindow {
  readonly windowId:       string;         // UUID
  readonly cardInstanceId: string;         // Which card this window belongs to
  readonly cardId:         string;         // For logging / event payloads
  readonly openedAtTick:   number;
  readonly openedAtMs:     number;         // wall clock ms
  readonly durationMs:     number;         // total allowed time
  readonly autoResolveChoice: string;      // worst option — used if window expires
  remainingMs:             number;         // mutable — decremented each real-time update
  isResolved:              boolean;
  isExpired:               boolean;
}

// ── CARD PLAY REQUEST ──────────────────────────────────────────────────────────

/**
 * Player intent to play a card — submitted to CardEngine.queuePlay().
 * Validated by TimingValidator before execution.
 */
export interface CardPlayRequest {
  readonly instanceId:  string;    // CardInHand.instanceId
  readonly choiceId:    string;    // Which option the player selected (if multi-choice)
  readonly targetId?:   string;    // Target player ID or engine ID if applicable
  readonly timestamp:   number;    // Unix ms — used for speed score calculation
  readonly isBluff?:    boolean;   // Predator: player declares bluff intent
}

// ── TIMING VALIDATION ─────────────────────────────────────────────────────────

export interface ValidationResult {
  valid:         boolean;
  rejectionCode: TimingRejectionCode | null;
  reason:        string | null;
}

export enum TimingRejectionCode {
  NO_ACTIVE_WINDOW       = 'NO_ACTIVE_WINDOW',
  WINDOW_CLOSED          = 'WINDOW_CLOSED',
  MODE_ILLEGAL           = 'MODE_ILLEGAL',
  TIMING_CLASS_LOCKED    = 'TIMING_CLASS_LOCKED',
  FORCED_CARD_PENDING    = 'FORCED_CARD_PENDING',    // must resolve forced cards first
  COUNTER_WINDOW_CLOSED  = 'COUNTER_WINDOW_CLOSED',
  RESCUE_WINDOW_CLOSED   = 'RESCUE_WINDOW_CLOSED',
  PHASE_BOUNDARY_CLOSED  = 'PHASE_BOUNDARY_CLOSED',
  DEFECTION_OUT_OF_ORDER = 'DEFECTION_OUT_OF_ORDER', // wrong step in betrayal arc
  INSUFFICIENT_BUDGET    = 'INSUFFICIENT_BUDGET',    // not enough BB or cash
  CARD_ON_HOLD           = 'CARD_ON_HOLD',           // card is in hold slot
  ALREADY_RESOLVED       = 'ALREADY_RESOLVED',
}

// ── CARD EFFECT RESULT ────────────────────────────────────────────────────────

/**
 * The mechanical output of resolving a card play.
 * Produced by CardEffectResolver.resolve(). Consumed by CardScorer and
 * emitted via CardUXBridge for EventBus dispatch.
 */
export interface CardEffectResult {
  readonly playId:          string;        // UUID per play event
  readonly cardInstanceId:  string;
  readonly cardId:          string;
  readonly choiceId:        string;
  readonly appliedAt:       number;        // tick index
  readonly effects:         AppliedEffect[];
  readonly totalCordDelta:  number;        // net CORD contribution from this play
  readonly isOptimalChoice: boolean;       // was this the highest-CORD option?
}

export interface AppliedEffect {
  readonly effectType:   CardEffectType;
  readonly magnitude:    number;            // actual value applied (post-overlay scaling)
  readonly targetEngine: string;            // which engine received the effect
  readonly eventEmitted: string;            // EventBus event name dispatched
}

// ── CARD SCORING / DECISION RECORD ────────────────────────────────────────────

/**
 * Decision quality record per card play.
 * Produced by CardScorer. Fed into RunStateSnapshot.decisionsThisTick.
 * Stored in SovereigntyEngine accumulator for post-run Case File.
 */
export interface DecisionRecord {
  readonly cardId:           string;
  readonly instanceId:       string;
  readonly decisionWindowMs: number;    // total window duration
  readonly resolvedInMs:     number;    // how quickly player resolved
  readonly wasAutoResolved:  boolean;
  readonly wasOptimalChoice: boolean;
  readonly speedScore:       number;    // 0.0–1.0 — faster = higher
  readonly timingScore:      number;    // 0.0–1.0 — inside ideal window = 1.0
  readonly choiceScore:      number;    // 0.0–1.0 — optimal = 1.0
  readonly compositeScore:   number;    // weighted average of all three
  readonly cordContribution: number;    // CORD delta this decision generated
}

// ── FORCED CARD ENTRY ──────────────────────────────────────────────────────────

/**
 * A card injected by TensionEngine (threat) or BattleEngine (bot attack).
 * Forced cards cannot be discarded. They must be resolved before standard plays.
 */
export interface ForcedCardEntry {
  readonly entryId:        string;     // UUID
  readonly cardId:         string;     // CardDefinition.cardId to materialize
  readonly sourceEngine:   ForcedCardSource;
  readonly sourceEventId:  string;     // threatId or attackId that triggered injection
  readonly injectedAtTick: number;
  readonly resolvedByTick: number | null;
  readonly isResolved:     boolean;
}

export enum ForcedCardSource {
  TENSION_ENGINE = 'TENSION_ENGINE',  // THREAT_ARRIVED → FUBAR card
  BATTLE_ENGINE  = 'BATTLE_ENGINE',   // BOT_ATTACK_FIRED → damage card
  CASCADE_ENGINE = 'CASCADE_ENGINE',  // CASCADE_LINK_FIRED → consequence card
  FATE_DECK      = 'FATE_DECK',       // Engine-driven random fate injection
}

// ── MISSED OPPORTUNITY ────────────────────────────────────────────────────────

export interface MissedOpportunityRecord {
  readonly cardId:       string;
  readonly instanceId:   string;
  readonly missedAtTick: number;
  readonly cordLost:     number;     // estimated CORD cost of the miss
  readonly streakCount:  number;     // consecutive misses when this was recorded
}

// ── PHASE BOUNDARY (Empire) ───────────────────────────────────────────────────

export interface PhaseBoundaryWindow {
  readonly phase:         RunPhase;
  readonly openedAtTick:  number;
  readonly closesAtTick:  number;  // openedAtTick + 5
  readonly cardsAvailable: string[]; // cardIds available in this window
  isConsumed:             boolean;
}

// ── AID CARD TERMS (Syndicate) ────────────────────────────────────────────────

export interface AidCardTerms {
  readonly lenderId:        string;     // player ID
  readonly receiverId:      string;     // player ID
  readonly amount:          number;
  readonly repaymentTicks:  number;     // ticks until repayment due
  readonly dueAtTick:       number;     // absolute tick
  readonly penaltyOnDefault:number;     // Trust Score penalty if unpaid
  readonly isRepaid:        boolean;
}

// ── GHOST CARD REQUIREMENT (Phantom) ─────────────────────────────────────────

export interface GhostCardRequirement {
  readonly markerType:    LegendMarkerType;
  readonly minMarkerCount: number;     // how many markers of this type needed
  readonly divergenceThreshold?: number; // optional: only legal if gap is within range
}

// ── CARD ENGINE INIT PARAMS ───────────────────────────────────────────────────

export interface CardEngineInitParams {
  runId:            string;
  userId:           string;
  seed:             string;
  gameMode:         GameMode;
  seasonTickBudget: number;
  maxHandSize:      number;         // typically 5
  decisionWindowMs: number;         // base window duration per card
  freedomThreshold: number;
  // Mode-specific
  battleBudgetMax?: number;         // HEAD_TO_HEAD — default 200
  trustScoreInit?:  number;         // TEAM_UP — initial trust score 0–100
  legendRunId?:     string;         // CHASE_A_LEGEND — which legend to chase
}

// ── CARD READER INTERFACE ─────────────────────────────────────────────────────

/**
 * Read-only interface exposed by CardEngine to other engines via constructor injection.
 * No engine may import CardEngine directly — only this interface.
 */
export interface CardReader {
  getHandSize(): number;
  getForcedCardCount(): number;
  getActiveThreatCardCount(): number;
  getDecisionWindowsActive(): number;
  getHoldsRemaining(): number;          // Empire only — 0 if not Empire mode
  getMissedOpportunityStreak(): number;
  getLastPlayedCard(): CardInHand | null;
}

// ── CARD ENGINE EVENTBUS EVENTS ───────────────────────────────────────────────

/**
 * All event names emitted by CardUXBridge on the EventBus.
 * These are CARD-LAYER events only — distinct from Engine 0 core events.
 * They are dispatched via the shared EventBus and consumed by engineStore.
 */
export type CardEventName =
  | 'CARD_DRAWN'
  | 'CARD_PLAYED'
  | 'CARD_DISCARDED'
  | 'CARD_HELD'                       // Empire hold system
  | 'CARD_UNHELD'                     // Card released from hold slot
  | 'CARD_AUTO_RESOLVED'             // Decision window expired — worst option taken
  | 'FORCED_CARD_INJECTED'           // Threat/bot card materialized into hand
  | 'FORCED_CARD_RESOLVED'
  | 'MISSED_OPPORTUNITY'             // Player passed a card — miss logged
  | 'PHASE_BOUNDARY_CARD_AVAILABLE'  // Empire phase transition window opened
  | 'PHASE_BOUNDARY_WINDOW_CLOSED'
  | 'LEGENDARY_CARD_DRAWN'           // 1% drop rate — special fanfare event
  | 'BLUFF_CARD_DISPLAYED'           // Predator — fake threat shown to opponent
  | 'COUNTER_WINDOW_OPENED'          // Predator — 5-sec counter window
  | 'COUNTER_WINDOW_CLOSED'
  | 'RESCUE_WINDOW_OPENED'           // Syndicate — teammate hit CRITICAL
  | 'RESCUE_WINDOW_CLOSED'
  | 'DEFECTION_STEP_PLAYED'          // Syndicate — betrayal arc progress
  | 'DEFECTION_COMPLETED'            // All 3 defection cards played
  | 'AID_TERMS_ACTIVATED'            // Syndicate — AID card terms locked in
  | 'AID_REPAID'
  | 'AID_DEFAULTED'                  // Trust Score penalty fires
  | 'GHOST_CARD_ACTIVATED'           // Phantom — ghost card used Legend Marker
  | 'PROOF_BADGE_CONDITION_MET'      // Phantom — proof badge unlocked
  | 'CARD_HAND_SNAPSHOT'             // Full hand state — emitted each tick
  | 'DECISION_WINDOW_OPENED'         // Re-export: card layer owns this
  | 'DECISION_WINDOW_EXPIRED'
  | 'DECISION_WINDOW_RESOLVED';

/**
 * Payload shapes for all card-layer events.
 */
export interface CardEventPayloadMap {
  'CARD_DRAWN':                  { instanceId: string; cardId: string; deckType: DeckType; rarity: CardRarity; tickIndex: number };
  'CARD_PLAYED':                 { instanceId: string; cardId: string; choiceId: string; resolvedInMs: number; wasOptimal: boolean; cordDelta: number; tickIndex: number };
  'CARD_DISCARDED':              { instanceId: string; cardId: string; reason: string; tickIndex: number };
  'CARD_HELD':                   { instanceId: string; cardId: string; remainingMs: number; tickIndex: number };
  'CARD_UNHELD':                 { instanceId: string; cardId: string; tickIndex: number };
  'CARD_AUTO_RESOLVED':          { instanceId: string; cardId: string; autoChoice: string; speedScore: number; tickIndex: number };
  'FORCED_CARD_INJECTED':        { entryId: string; cardId: string; source: ForcedCardSource; instanceId: string; tickIndex: number };
  'FORCED_CARD_RESOLVED':        { entryId: string; cardId: string; instanceId: string; tickIndex: number };
  'MISSED_OPPORTUNITY':          { instanceId: string; cardId: string; cordLost: number; streakCount: number; tickIndex: number };
  'PHASE_BOUNDARY_CARD_AVAILABLE':{ phase: RunPhase; cardsAvailable: string[]; closesAtTick: number; tickIndex: number };
  'PHASE_BOUNDARY_WINDOW_CLOSED':{ phase: RunPhase; wasConsumed: boolean; tickIndex: number };
  'LEGENDARY_CARD_DRAWN':        { instanceId: string; cardId: string; tickIndex: number };
  'BLUFF_CARD_DISPLAYED':        { instanceId: string; cardId: string; displayedAsCardId: string; tickIndex: number };
  'COUNTER_WINDOW_OPENED':       { triggerAttackId: string; durationMs: number; tickIndex: number };
  'COUNTER_WINDOW_CLOSED':       { triggerAttackId: string; wasCountered: boolean; tickIndex: number };
  'RESCUE_WINDOW_OPENED':        { teammateId: string; durationMs: number; tickIndex: number };
  'RESCUE_WINDOW_CLOSED':        { teammateId: string; wasRescued: boolean; effectivenessMultiplier: number; tickIndex: number };
  'DEFECTION_STEP_PLAYED':       { step: DefectionStep; defectorId: string; tickIndex: number };
  'DEFECTION_COMPLETED':         { defectorId: string; cordPenalty: number; tickIndex: number };
  'AID_TERMS_ACTIVATED':         { terms: AidCardTerms; tickIndex: number };
  'AID_REPAID':                  { lenderId: string; receiverId: string; amount: number; tickIndex: number };
  'AID_DEFAULTED':               { receiverId: string; penaltyApplied: number; tickIndex: number };
  'GHOST_CARD_ACTIVATED':        { instanceId: string; cardId: string; markerType: LegendMarkerType; divergenceDelta: number; tickIndex: number };
  'PROOF_BADGE_CONDITION_MET':   { badgeId: string; cardId: string; tickIndex: number };
  'CARD_HAND_SNAPSHOT':          { handSize: number; forcedCount: number; windowsActive: number; tickIndex: number };
  'DECISION_WINDOW_OPENED':      { windowId: string; cardId: string; cardInstanceId: string; durationMs: number; autoResolveChoice: string; tickIndex: number };
  'DECISION_WINDOW_EXPIRED':     { windowId: string; cardId: string; cardInstanceId: string; autoChoice: string; speedScore: number; tickIndex: number };
  'DECISION_WINDOW_RESOLVED':    { windowId: string; cardId: string; cardInstanceId: string; choiceId: string; resolvedInMs: number; wasOptimal: boolean; tickIndex: number };
}

// ── CARD LEGALITY MATRIX ───────────────────────────────────────────────────────

/**
 * Defines which DeckTypes are legal in each GameMode.
 * Read by DeckBuilder at run start to construct the mode-appropriate draw stack.
 */
export const CARD_LEGALITY_MATRIX: Record<GameMode, DeckType[]> = {
  [GameMode.GO_ALONE]: [
    BaseDeckType.OPPORTUNITY,
    BaseDeckType.IPA,
    BaseDeckType.FUBAR,
    BaseDeckType.PRIVILEGED,
    BaseDeckType.SO,
    BaseDeckType.PHASE_BOUNDARY,
  ],
  [GameMode.HEAD_TO_HEAD]: [
    BaseDeckType.OPPORTUNITY,
    BaseDeckType.IPA,
    BaseDeckType.FUBAR,
    BaseDeckType.PRIVILEGED,
    BaseDeckType.SO,
    ModeDeckType.SABOTAGE,
    ModeDeckType.COUNTER,
    ModeDeckType.BLUFF,
  ],
  [GameMode.TEAM_UP]: [
    BaseDeckType.OPPORTUNITY,
    BaseDeckType.IPA,
    BaseDeckType.FUBAR,
    BaseDeckType.PRIVILEGED,
    BaseDeckType.SO,
    ModeDeckType.AID,
    ModeDeckType.RESCUE,
    ModeDeckType.TRUST,
    ModeDeckType.DEFECTION,
  ],
  [GameMode.CHASE_A_LEGEND]: [
    BaseDeckType.OPPORTUNITY,
    BaseDeckType.IPA,
    BaseDeckType.FUBAR,
    BaseDeckType.PRIVILEGED,
    BaseDeckType.SO,
    ModeDeckType.GHOST,
    ModeDeckType.DISCIPLINE,
  ],
};

/**
 * Base decision window duration per timing class.
 * Final duration = base * tickDurationMs modifier.
 */
export const TIMING_CLASS_WINDOW_MS: Record<TimingClass, number> = {
  [TimingClass.IMMEDIATE]:            0,        // always playable — no countdown
  [TimingClass.REACTIVE]:         4_000,        // 4 seconds from trigger
  [TimingClass.STANDARD]:        12_000,        // 12 seconds default
  [TimingClass.HOLD]:                 0,        // paused — no countdown while held
  [TimingClass.COUNTER_WINDOW]:   5_000,        // 5 seconds — Predator only
  [TimingClass.RESCUE_WINDOW]:   15_000,        // 15 seconds — decays with delay
  [TimingClass.PHASE_BOUNDARY]:  45_000,        // 5-tick window (≈45s at T1)
  [TimingClass.FORCED]:          10_000,        // must resolve — worst option on expiry
  [TimingClass.LEGENDARY]:       20_000,        // generous window — landmark event
  [TimingClass.BLUFF]:            8_000,        // Predator — display + execute
  [TimingClass.DEFECTION_STEP]:  30_000,        // Syndicate — detectable delay intentional
  [TimingClass.SOVEREIGNTY_DECISION]: 20_000,  // GO_ALONE only — final card
};

/**
 * Default mode overlays applied when no card-specific override exists.
 * Per-card tag_weight entries merge with (override) these defaults.
 */
export const DEFAULT_MODE_OVERLAYS: Record<GameMode, ModeOverlay> = {
  [GameMode.GO_ALONE]: {
    cost_modifier:      1.0,
    effect_modifier:    1.0,
    tag_weights: {
      [CardTag.LIQUIDITY]:    1.3,
      [CardTag.RESILIENCE]:   1.2,
      [CardTag.INCOME]:       2.2,
      [CardTag.COMPOUNDING]:  1.8,
      [CardTag.AUTOMATION]:   1.5,
      [CardTag.CAPITAL_ALLOC]:1.6,
    },
    timing_lock:        [],
    legal:              true,
    targeting_override: null,
    cord_weight:        1.0,
  },
  [GameMode.HEAD_TO_HEAD]: {
    cost_modifier:      1.0,
    effect_modifier:    1.0,
    tag_weights: {
      [CardTag.INCOME]:       0.6,   // down from 2.2 — burst beats compounding
      [CardTag.TEMPO]:        2.4,
      [CardTag.SABOTAGE]:     2.0,
      [CardTag.COUNTER]:      1.8,
      [CardTag.LEVERAGE]:     1.5,
      [CardTag.COMBAT]:       2.2,
    },
    timing_lock:        [TimingClass.PHASE_BOUNDARY, TimingClass.SOVEREIGNTY_DECISION],
    legal:              true,
    targeting_override: null,
    cord_weight:        1.0,
  },
  [GameMode.TEAM_UP]: {
    cost_modifier:      0.9,   // slight discount — cooperation model
    effect_modifier:    1.0,
    tag_weights: {
      [CardTag.TRUST]:        2.0,
      [CardTag.COOPERATIVE]:  1.8,
      [CardTag.INCOME]:       1.4,
      [CardTag.RESILIENCE]:   1.5,
    },
    timing_lock:        [TimingClass.PHASE_BOUNDARY, TimingClass.SOVEREIGNTY_DECISION, TimingClass.HOLD],
    legal:              true,
    targeting_override: null,
    cord_weight:        1.0,
  },
  [GameMode.CHASE_A_LEGEND]: {
    cost_modifier:      1.0,
    effect_modifier:    1.0,
    tag_weights: {
      [CardTag.PRECISION]:    2.0,
      [CardTag.VARIANCE_RED]: 1.9,
      [CardTag.DETERMINISTIC]:1.8,
      [CardTag.INCOME]:       1.0,
    },
    timing_lock:        [TimingClass.PHASE_BOUNDARY, TimingClass.SOVEREIGNTY_DECISION, TimingClass.HOLD],
    legal:              true,
    targeting_override: null,
    cord_weight:        1.0,
  },
};

/**
 * Maximum hand size per mode.
 */
export const MAX_HAND_SIZE: Record<GameMode, number> = {
  [GameMode.GO_ALONE]:       5,
  [GameMode.HEAD_TO_HEAD]:   6,  // extra slot for counter card retention
  [GameMode.TEAM_UP]:        5,
  [GameMode.CHASE_A_LEGEND]: 4,  // smaller hand — precision over volume
};

/**
 * Predator Battle Budget configuration.
 */
export const BATTLE_BUDGET_CONFIG = {
  MAX:       200,
  REGEN_PER_TICK: 3,
  UNUSED_CARRY:   false,  // unused BB does NOT carry to next round
} as const;

/**
 * Trust Score range configuration for TEAM_UP mode.
 */
export const TRUST_SCORE_CONFIG = {
  MIN:   0,
  MAX:   100,
  INIT:  50,
  DEFECTION_PENALTY: 15,  // flat CORD penalty on defector's run score
} as const;

/**
 * CORD penalty for defection — flat subtraction from final CORD.
 */
export const DEFECTION_CORD_PENALTY = 0.15;

/**
 * Legendary card drop rate — 1 in 100 weighted draws.
 */
export const LEGENDARY_DROP_WEIGHT = 1;