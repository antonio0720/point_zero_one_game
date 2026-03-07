// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — pzo-web/src/game/types/cards.ts
// Sprint 8 — Full Rebuild
//
// CHANGES FROM SPRINT 0:
//   ✦ REMOVED CardArchetype — replaced by DeckType = BaseDeckType | ModeDeckType
//   ✦ REMOVED CardOrigin — replaced by ForcedCardSource enum
//   ✦ REMOVED GameCard monolith — split into CardDefinition (immutable base)
//     + CardInHand (runtime instance in player's hand)
//   ✦ ADD GameMode re-export (string union, no import — avoids circular dep)
//   ✦ ADD TimingClass enum — 12 timing classes from engine
//   ✦ ADD BaseDeckType enum — 6 base deck types (all modes)
//   ✦ ADD ModeDeckType enum — 9 mode-exclusive deck types
//   ✦ ADD DeckType union
//   ✦ ADD CardTag enum — 17 semantic tags (mode routing system)
//   ✦ ADD Targeting enum — 6 targeting modes
//   ✦ ADD CardRarity enum — 5 rarity tiers
//   ✦ ADD LegendMarkerType enum — 5 Phantom marker types
//   ✦ ADD DefectionStep enum — 3 Syndicate betrayal arc steps
//   ✦ ADD RunPhase re-export alias
//   ✦ ADD ForcedCardSource enum — 5 injection sources
//   ✦ ADD CardDefinition interface — immutable base card schema
//   ✦ ADD CardBaseEffect interface — economic effect fields
//   ✦ ADD ModeOverlay interface — per-mode scoring weight overrides
//   ✦ ADD CardInHand interface — runtime hand instance
//   ✦ REBUILD ModeCardMetadata — aligned to engine, all mode fields present
//   ✦ ADD CARD_LEGALITY_MATRIX — which DeckTypes legal per GameMode
//   ✦ ADD TIMING_CLASS_WINDOW_MS — decision window duration per timing class
//   ✦ ADD DEFAULT_MODE_OVERLAYS — default tag weight overrides per mode
//   ✦ ADD CardEventName type — 28 card-layer event strings
//   ✦ ADD CardEventPayloadMap — typed payloads for all 28 events
//   ✦ ADD AidCardTerms — Syndicate AID contract embedded terms
//   ✦ ADD GhostCardRequirement — Phantom GHOST card activation requirement
//   ✦ KEEP CardVisibility (renamed to CardVisibilityScope to distinguish
//     from Targeting enum which handles who the card *affects*)
//
// RULES:
//   ✦ Zero imports — this file imports nothing.
//   ✦ Zero runtime logic — pure TypeScript declarations only.
//   ✦ GameMode is re-declared as a string union (not imported) to
//     prevent circular deps with modes.ts.
//
// Density6 LLC · Confidential · All Rights Reserved
// ═══════════════════════════════════════════════════════════════════════════

// ── Game Mode String Union (no import) ───────────────────────────────────────
/**
 * The four game modes. Declared here as a string union (matching modes.ts)
 * to allow cards.ts to stay import-free and avoid circular dependencies.
 * Mode adapters and the CardEngine use this type for routing decisions.
 */
export type GameMode =
  | 'GO_ALONE'        // Empire: capital allocation, hold system
  | 'HEAD_TO_HEAD'    // Predator: battle budget, counter window
  | 'TEAM_UP'         // Syndicate: trust score, defection arc
  | 'CHASE_A_LEGEND'; // Phantom: ghost cards, divergence scoring

// ── Timing Classes ────────────────────────────────────────────────────────────
/**
 * The 12 timing classes. A card's timing_class determines when it is legal
 * to play. TimingValidator enforces these windows per tick.
 *
 * IMMEDIATE         — Playable any tick, no restrictions (e.g. income buffs)
 * REACTIVE          — Must be played within 2 ticks of triggering event
 * STANDARD          — Normal play window. Always open unless locked by mode
 * HOLD              — GO_ALONE only. Decision timer paused while held
 * COUNTER_WINDOW    — HEAD_TO_HEAD only. Legal only during 5-sec counter window
 * RESCUE_WINDOW     — TEAM_UP only. Legal only when teammate is CRITICAL
 * PHASE_BOUNDARY    — GO_ALONE only. Legal in 5-tick phase transition window only
 * FORCED            — Cannot be discarded. Must resolve before other plays
 * LEGENDARY         — Any mode. Always legal; never blocked by bots
 * BLUFF             — HEAD_TO_HEAD only. Displays as threat; executes buff/trap
 * DEFECTION_STEP    — TEAM_UP only. Part of 3-card betrayal arc sequence
 * SOVEREIGNTY_DECISION — GO_ALONE only. Final high-stakes card at tick 690+
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

// ── Base Deck Types ───────────────────────────────────────────────────────────
/**
 * The 6 base deck types — legal in multiple modes.
 * CARD_LEGALITY_MATRIX determines which modes include each.
 */
export enum BaseDeckType {
  OPPORTUNITY    = 'OPPORTUNITY',    // Capital deployment — primary growth tool
  IPA            = 'IPA',            // Income-Producing Assets — compounding engine
  FUBAR          = 'FUBAR',          // Market reality — mostly engine-injected
  PRIVILEGED     = 'PRIVILEGED',     // Power moves with hater heat tradeoff
  SO             = 'SO',             // Systemic Obstacle — convert cash/time/pain
  PHASE_BOUNDARY = 'PHASE_BOUNDARY', // Phase transition cards — 5-tick window only
}

// ── Mode-Exclusive Deck Types ─────────────────────────────────────────────────
/**
 * The 9 mode-exclusive deck types — legal in ONE mode only.
 *
 * HEAD_TO_HEAD (Predator):
 *   SABOTAGE   — Extraction actions. Costs Battle Budget.
 *   COUNTER    — Counter-play cards. Held in advance for defense.
 *   BLUFF      — Displays as threat; executes buff or trap on resolve.
 *
 * TEAM_UP (Syndicate):
 *   AID        — Financial contracts with embedded repayment terms.
 *   RESCUE     — Emergency interventions during teammate CRITICAL state.
 *   TRUST      — Trust Score meta-game instruments.
 *   DEFECTION  — 3-card betrayal arc: Break Pact → Silent Exit → Asset Seizure.
 *
 * CHASE_A_LEGEND (Phantom):
 *   GHOST      — Interact with Legend Marker data. Requires ghost reference.
 *   DISCIPLINE — Reduce variance. Deterministic run stabilization.
 */
export enum ModeDeckType {
  SABOTAGE   = 'SABOTAGE',
  COUNTER    = 'COUNTER',
  BLUFF      = 'BLUFF',
  AID        = 'AID',
  RESCUE     = 'RESCUE',
  TRUST      = 'TRUST',
  DEFECTION  = 'DEFECTION',
  GHOST      = 'GHOST',
  DISCIPLINE = 'DISCIPLINE',
}

/** Union of all 15 deck types. */
export type DeckType = BaseDeckType | ModeDeckType;

// ── Card Tag Taxonomy ─────────────────────────────────────────────────────────
/**
 * Card tags — the mode routing system.
 * ModeOverlayEngine reads tags to apply per-mode scoring weight overrides.
 * The engine does NOT hardcode "this card is good in Empire" — instead,
 * GO_ALONE reads LIQUIDITY and RESILIENCE tags and weights them higher.
 * Tags are additive; a card can have multiple tags.
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

  // Mode signal tags
  CAPITAL_ALLOC  = 'capital_allocation',
  COMBAT         = 'combat',
  COOPERATIVE    = 'cooperative',
  DETERMINISTIC  = 'deterministic',

  // Rarity / power tags
  LEGENDARY_TAG  = 'legendary',
  PRIVILEGED_TAG = 'privileged',

  // Educational mapping
  REAL_WORLD_FINANCE = 'real_world_finance',
}

// ── Card Targeting ────────────────────────────────────────────────────────────
/**
 * Who or what a card's effect applies to when played.
 * Distinct from CardVisibilityScope (who can SEE the card).
 */
export enum Targeting {
  SELF      = 'SELF',       // Affects only the playing player
  OPPONENT  = 'OPPONENT',   // Affects the opponent (HEAD_TO_HEAD only)
  TEAMMATE  = 'TEAMMATE',   // Affects a specific teammate (TEAM_UP only)
  TEAM_ALL  = 'TEAM_ALL',   // Affects entire team (TEAM_UP)
  GHOST_REF = 'GHOST_REF',  // Targets Legend Marker data (CHASE_A_LEGEND only)
  ENGINE    = 'ENGINE',     // Targets a game engine system (e.g. shield repair)
}

// ── Card Visibility Scope ─────────────────────────────────────────────────────
/**
 * Who can see this card in multiplayer contexts.
 * Distinct from Targeting (who is AFFECTED by it).
 */
export type CardVisibilityScope = 'SELF' | 'ALL' | 'OPPONENT_ONLY';

/** @deprecated Use CardVisibilityScope. Preserved for backward compat. */
export type CardVisibility = CardVisibilityScope;

// ── Card Rarity ───────────────────────────────────────────────────────────────
/**
 * Card rarity tier. Drives drop rate and visual treatment.
 * LEGENDARY — 1% drop rate. Cannot be blocked by any hater bot.
 */
export enum CardRarity {
  COMMON    = 'COMMON',
  UNCOMMON  = 'UNCOMMON',
  RARE      = 'RARE',
  EPIC      = 'EPIC',
  LEGENDARY = 'LEGENDARY',
}

// ── Legend Marker Types (Phantom mode) ───────────────────────────────────────
/**
 * Five marker types recorded on the legend's replay timeline.
 * GHOST cards require specific marker types and counts to activate.
 *
 * GOLD   — Highest-CORD decision moments on legend's run
 * RED    — Crisis recovery points (L4 breach survived)
 * PURPLE — Cascade chain interceptions
 * SILVER — Timing optimization moments (fast + correct decisions)
 * BLACK  — High-risk decisions with volatile outcomes
 */
export enum LegendMarkerType {
  GOLD   = 'GOLD',
  RED    = 'RED',
  PURPLE = 'PURPLE',
  SILVER = 'SILVER',
  BLACK  = 'BLACK',
}

// ── Defection Step (Syndicate mode) ──────────────────────────────────────────
/**
 * The 3-card betrayal arc in TEAM_UP mode.
 * Each step must be played ≥1 tick after the previous.
 * Completing all 3 triggers full asset seizure and CORD penalty.
 */
export enum DefectionStep {
  BREAK_PACT    = 'BREAK_PACT',    // Step 1 — initiates betrayal arc
  SILENT_EXIT   = 'SILENT_EXIT',   // Step 2 — ≥1 tick after step 1
  ASSET_SEIZURE = 'ASSET_SEIZURE', // Step 3 — ≥1 tick after step 2
}

// ── Run Phase (re-export alias) ───────────────────────────────────────────────
/**
 * Three-phase run structure for GO_ALONE mode.
 * Re-declared here (not imported) to keep cards.ts import-free.
 * Canonical definition lives in modes.ts.
 */
export type RunPhase = 'FOUNDATION' | 'ESCALATION' | 'SOVEREIGNTY';

// ── Forced Card Source ────────────────────────────────────────────────────────
/**
 * Where a card entered the game state via forced injection (not player draw).
 * Replaces CardOrigin from Sprint 0 (too vague, not engine-aligned).
 *
 * HATER_BOT        — BattleEngine bot attack materializes card in hand
 * PHASE_BOUNDARY   — Empire phase transition window opened
 * TENSION_ENGINE   — TensionEngine queued threat forced card
 * OPPONENT_SABOTAGE — HEAD_TO_HEAD: opponent's extraction action
 * GHOST_PRESSURE   — CHASE_A_LEGEND: legend gap threshold triggered injection
 */
export enum ForcedCardSource {
  HATER_BOT         = 'HATER_BOT',
  PHASE_BOUNDARY    = 'PHASE_BOUNDARY',
  TENSION_ENGINE    = 'TENSION_ENGINE',
  OPPONENT_SABOTAGE = 'OPPONENT_SABOTAGE',
  GHOST_PRESSURE    = 'GHOST_PRESSURE',
}

// ── Card Base Effect ──────────────────────────────────────────────────────────
/**
 * The economic effect of playing a card.
 * All fields optional — a FUBAR card may only have a freezeTicks field.
 * Null/undefined means "this field is not affected by this card."
 */
export interface CardBaseEffect {
  /** One-time cash change (positive = gain, negative = cost) */
  cashDelta?:          number;
  /** Monthly income change (persists for run duration unless conditional) */
  incomeDelta?:        number;
  /** Monthly expenses change */
  expensesDelta?:      number;
  /** Shield layer integrity repair (points restored to a specific layer) */
  shieldRepair?:       number;
  /** Which shield layer is repaired (ShieldLayerId string) */
  shieldLayerTarget?:  string;
  /** Hater heat change (negative = cool down, positive = increase) */
  haterHeatDelta?:     number;
  /** Number of ticks to freeze (player cannot play cards) */
  freezeTicks?:        number;
  /** Battle Budget generated (HEAD_TO_HEAD only) */
  bbGeneration?:       number;
  /** Trust score delta (TEAM_UP only, 0.0–1.0 scale) */
  trustDelta?:         number;
  /** CORD basis point delta applied to final score */
  cordDeltaBasis?:     number;
  /** Duration in ticks for income/expense changes (null = permanent) */
  durationTicks?:      number | null;
}

// ── Mode Overlay ──────────────────────────────────────────────────────────────
/**
 * Per-mode scoring weight overrides applied at draw time by ModeOverlayEngine.
 * Stored in CardDefinition.mode_overrides keyed by GameMode string.
 *
 * tagWeightOverrides: multiplier applied to CORD score when a tagged card is played.
 *   e.g. GO_ALONE overrides { liquidity: 1.4 } — liquidity cards score 40% more.
 *
 * scoringMultiplier: flat multiplier on total card CORD contribution this mode.
 * timingModifier: ms adjustment to the card's timing window in this mode (positive = more time).
 */
export interface ModeOverlay {
  tagWeightOverrides: Partial<Record<CardTag, number>>;
  scoringMultiplier:  number;
  /** Modes where this overlay is active (usually one mode) */
  legalInModes:       GameMode[];
  /** +/- ms adjustment to timing window. 0 = no change. */
  timingModifier:     number;
}

// ── Card Definition (Immutable Base) ─────────────────────────────────────────
/**
 * The immutable base definition of every card in the game.
 * Mode overlays mutate runtime behavior — the base definition never changes.
 * Every entry in CardRegistry.ts is a CardDefinition.
 *
 * cardId must be unique across ALL cards. Convention: '{type}_{name}_{3-digit-num}'
 * e.g. 'opportunity_rental_001', 'fubar_audit_002'
 */
export interface CardDefinition {
  readonly cardId:           string;            // 'opportunity_rental_001'
  readonly name:             string;            // 'Rental Property'
  readonly deckType:         DeckType;
  readonly rarity:           CardRarity;
  readonly timingClass:      TimingClass;
  readonly base_cost:        number;            // cash cost (or BB cost for combat)
  readonly base_effect:      CardBaseEffect;
  readonly tags:             CardTag[];
  readonly targeting:        Targeting;
  readonly visibility:       CardVisibilityScope;
  /** Per-mode scoring/timing overrides. Key = GameMode string. */
  readonly mode_overrides:   Partial<Record<GameMode, ModeOverlay>>;
  /** Lore or real-world finance educational note (shown on card flip) */
  readonly educational_note: string;
  /** Defection step this card represents (DEFECTION deck only) */
  readonly defectionStep?:   DefectionStep;
  /** Legend marker requirement for activation (GHOST deck only) */
  readonly ghostRequirement?: GhostCardRequirement;
  /** Phase this card is legal in (PHASE_BOUNDARY deck only) */
  readonly legalPhase?:      RunPhase;
  /** AID contract terms embedded in this card (AID deck only) */
  readonly aidTerms?:        Omit<AidCardTerms, 'lenderId' | 'receiverId' | 'isRepaid' | 'dueAtTick'>;
}

// ── Mode-Specific Card Metadata ───────────────────────────────────────────────
/**
 * Runtime metadata appended by mode adapters when a card enters the hand.
 * Modifies how the card scores and resolves for the active mode.
 * Stored in CardInHand.modeMetadata — not on CardDefinition.
 */
export interface ModeCardMetadata {
  mode: GameMode;

  // ── HEAD_TO_HEAD (Predator) ────────────────────────────────────────────
  /** Economy gain to self if played optimally */
  selfValue?:                number;
  /** Value of denying opponent this card */
  denyValue?:                number;
  /** Battle Budget generated when this card is played as attacker */
  bbGeneration?:             number;
  /** BB cost to play this card as a sabotage action */
  bbCost?:                   number;
  /** True if this card is currently displayed as a bluff (BLUFF deck) */
  isDisplayedAsBluff?:       boolean;

  // ── TEAM_UP (Syndicate) ───────────────────────────────────────────────
  /** Trust score delta on play (+/-) */
  trustImpact?:              number;
  /** Description of effect applied to receiving teammate */
  recipientPreview?:         string;
  /** True if this card is part of an active defection sequence */
  defectionSignature?:       boolean;
  /** Which defection step this card represents */
  defectionStepValue?:       DefectionStep;
  /** AID contract terms if this is an active AID card */
  activeAidTerms?:           AidCardTerms;

  // ── CHASE_A_LEGEND (Phantom) ──────────────────────────────────────────
  /** Change in CORD basis points vs legend path when played */
  cordDelta?:                number;
  /** True if card counters an active legend pressure event */
  legendPressureResponse?:   boolean;
  /** Legend marker type this card targets */
  ghostMarkerTarget?:        LegendMarkerType;
  /** CORD gap change expected on play (positive = closing gap) */
  expectedGapChange?:        number;

  // ── GO_ALONE (Empire) ─────────────────────────────────────────────────
  /** Multiplier on isolation tax for the tick this card is played */
  isolationTaxModifier?:     number;
  /** True if card is amplified while in Bleed Mode */
  bleedAmplifier?:           boolean;
  /** True if eligible for Comeback Surge bonus */
  comebackEligible?:         boolean;

  // ── Universal ─────────────────────────────────────────────────────────
  /** Decision quality tag: fast+correct = OPTIMAL, late = LATE, etc. */
  decisionTag?:              'FAST' | 'LATE' | 'OPTIMAL' | 'RISKY' | 'AUTO';
  /** CORD basis point contribution recorded for sovereignty score */
  cordContribution?:         number;
}

// ── Card In Hand (Runtime Instance) ──────────────────────────────────────────
/**
 * A card currently in the player's hand — a runtime instance of a CardDefinition.
 * Replaces the monolithic GameCard from Sprint 0.
 *
 * instanceId is unique per deal — the same CardDefinition can produce multiple
 * CardInHand instances in the same run (multiple copies in deck).
 */
export interface CardInHand {
  /** UUID — unique per instance. Used for event tracking + replay. */
  instanceId:          string;
  /** References CardDefinition.cardId in CardRegistry. */
  cardId:              string;
  /** Full immutable definition — embedded at draw time for determinism. */
  definition:          CardDefinition;
  /** Tick when this card was drawn or injected into hand. */
  drawnAtTick:         number;
  /**
   * Tick when player activated Hold (GO_ALONE only).
   * Null = not currently held.
   */
  heldSince:           number | null;
  /** True if this card was force-injected (not drawn by player). */
  forcedEntry:         boolean;
  /** Source if forced; null if normal draw. */
  forcedSource:        ForcedCardSource | null;
  /** Mode adapter metadata. Applied at draw time by ModeOverlayEngine. */
  modeMetadata:        ModeCardMetadata | null;
  /**
   * Remaining decision window in ms.
   * Set by DecisionWindowManager when card enters forced state.
   * Null = no countdown active.
   */
  decisionWindowRemainingMs: number | null;
}

/**
 * @deprecated Use CardInHand. GameCard preserved for backward compat with
 * components not yet updated to Sprint 8 types.
 */
export interface GameCard {
  id:               string;
  name:             string;
  type:             string;         // was CardArchetype — use DeckType now
  subtype:          string;
  description:      string;
  origin:           string;         // was CardOrigin — use ForcedCardSource now
  visibility:       CardVisibilityScope;
  cost:             number | null;
  leverage:         number | null;
  downPayment:      number | null;
  cashflowMonthly:  number | null;
  roiPct:           number | null;
  cashImpact:       number | null;
  turnsLost:        number | null;
  value:            number | null;
  energyCost:       number;
  synergies:        string[];
  modeMetadata?:    ModeCardMetadata;
}

// ── Card Valuation Context ────────────────────────────────────────────────────
/**
 * Context fed into cardValuation.ts for mode-aware scoring.
 * Unchanged from Sprint 0 (engine still uses this shape).
 */
export interface CardValuationContext {
  mode:           GameMode;
  cash:           number;
  netWorth:       number;
  income:         number;
  expenses:       number;
  tick:           number;
  shields:        number;
  pressureScore:  number;     // 0.0–1.0 from PressureEngine
  battleBudget?:  number;     // HEAD_TO_HEAD
  opponentCash?:  number;     // HEAD_TO_HEAD
  cordGap?:       number;     // CHASE_A_LEGEND — delta vs legend path
  inBleedMode?:   boolean;    // GO_ALONE
  trustScore?:    number;     // TEAM_UP — 0.0–1.0
}

// ── AID Card Terms (Syndicate) ────────────────────────────────────────────────
/**
 * Financial contract terms embedded in a TEAM_UP AID card.
 * Created when the AID card is played. Stored in modeMetadata.activeAidTerms.
 */
export interface AidCardTerms {
  readonly lenderId:          string;   // player ID
  readonly receiverId:        string;   // player ID
  readonly amount:            number;
  readonly repaymentTicks:    number;   // ticks until repayment due
  readonly dueAtTick:         number;   // absolute tick (openedAtTick + repaymentTicks)
  readonly penaltyOnDefault:  number;   // trust score penalty if unpaid
  isRepaid:                   boolean;
}

// ── Ghost Card Requirement (Phantom) ─────────────────────────────────────────
/**
 * Activation requirement for a CHASE_A_LEGEND GHOST card.
 * Card cannot be played unless the required legend markers exist on the timeline.
 */
export interface GhostCardRequirement {
  readonly markerType:          LegendMarkerType;
  readonly minMarkerCount:      number;
  readonly divergenceThreshold?: number; // optional: card only legal if gap within range
}

// ── Phase Boundary Window ─────────────────────────────────────────────────────
/**
 * Metadata for PHASE_BOUNDARY timing class cards.
 * Window opens for 5 ticks at each Empire phase transition.
 */
export interface PhaseBoundaryWindow {
  readonly phase:          RunPhase;
  readonly openedAtTick:   number;
  readonly closesAtTick:   number;  // openedAtTick + 5
  readonly cardsAvailable: string[]; // cardIds available in this window
  isConsumed:              boolean;
}

// ── Card Legality Matrix ──────────────────────────────────────────────────────
/**
 * Which DeckTypes are legal in each GameMode.
 * Read by DeckBuilder at run start to construct the mode-appropriate draw stack.
 * Mode adapters inject mode-exclusive deck types on top of the base set.
 */
export const CARD_LEGALITY_MATRIX: Record<GameMode, DeckType[]> = {
  'GO_ALONE': [
    BaseDeckType.OPPORTUNITY,
    BaseDeckType.IPA,
    BaseDeckType.FUBAR,
    BaseDeckType.PRIVILEGED,
    BaseDeckType.SO,
    BaseDeckType.PHASE_BOUNDARY,
  ],
  'HEAD_TO_HEAD': [
    BaseDeckType.OPPORTUNITY,
    BaseDeckType.IPA,
    BaseDeckType.FUBAR,
    BaseDeckType.PRIVILEGED,
    BaseDeckType.SO,
    ModeDeckType.SABOTAGE,
    ModeDeckType.COUNTER,
    ModeDeckType.BLUFF,
  ],
  'TEAM_UP': [
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
  'CHASE_A_LEGEND': [
    BaseDeckType.OPPORTUNITY,
    BaseDeckType.IPA,
    BaseDeckType.FUBAR,
    BaseDeckType.PRIVILEGED,
    BaseDeckType.SO,
    ModeDeckType.GHOST,
    ModeDeckType.DISCIPLINE,
  ],
} as const;

/** Whether a DeckType can be manually played by the player (vs engine-injected). */
export const DECK_TYPE_MANUALLY_PLAYABLE: Partial<Record<DeckType, boolean>> = {
  [BaseDeckType.OPPORTUNITY]:    true,
  [BaseDeckType.IPA]:            true,
  [BaseDeckType.FUBAR]:          false, // forcedEventEngine only
  [BaseDeckType.PRIVILEGED]:     true,
  [BaseDeckType.SO]:             false, // forcedEventEngine only
  [BaseDeckType.PHASE_BOUNDARY]: true,  // but only during phase window
  [ModeDeckType.SABOTAGE]:       true,
  [ModeDeckType.COUNTER]:        true,  // held in advance
  [ModeDeckType.BLUFF]:          true,
  [ModeDeckType.AID]:            true,
  [ModeDeckType.RESCUE]:         true,
  [ModeDeckType.TRUST]:          true,
  [ModeDeckType.DEFECTION]:      true,  // intentional — player initiates
  [ModeDeckType.GHOST]:          true,
  [ModeDeckType.DISCIPLINE]:     true,
} as const;

// ── Timing Class Window Durations ─────────────────────────────────────────────
/**
 * Base decision window duration per timing class in milliseconds.
 * Final duration = base * tick duration modifier from TimeEngine.
 * 0 = always playable / no countdown.
 */
export const TIMING_CLASS_WINDOW_MS: Record<TimingClass, number> = {
  [TimingClass.IMMEDIATE]:             0,
  [TimingClass.REACTIVE]:          4_000,
  [TimingClass.STANDARD]:         12_000,
  [TimingClass.HOLD]:                  0,   // paused — no countdown while held
  [TimingClass.COUNTER_WINDOW]:    5_000,   // HEAD_TO_HEAD 5-sec window
  [TimingClass.RESCUE_WINDOW]:    15_000,   // TEAM_UP — decays with delay
  [TimingClass.PHASE_BOUNDARY]:   45_000,   // 5 ticks × ~9s at T1
  [TimingClass.FORCED]:           10_000,   // worst option on expiry
  [TimingClass.LEGENDARY]:        20_000,   // generous — landmark event
  [TimingClass.BLUFF]:             8_000,   // display + execute
  [TimingClass.DEFECTION_STEP]:   30_000,   // detectable delay is intentional
  [TimingClass.SOVEREIGNTY_DECISION]: 20_000,
} as const;

// ── Default Mode Overlays ─────────────────────────────────────────────────────
/**
 * Default tag weight overrides per mode.
 * Applied when no card-specific override exists.
 * Per-card mode_overrides.tagWeightOverrides merge with (override) these defaults.
 */
export const DEFAULT_MODE_OVERLAYS: Record<GameMode, ModeOverlay> = {
  'GO_ALONE': {
    tagWeightOverrides: {
      [CardTag.LIQUIDITY]:    1.40,
      [CardTag.RESILIENCE]:   1.35,
      [CardTag.COMPOUNDING]:  1.20,
      [CardTag.LEVERAGE]:     0.85,
      [CardTag.COMBAT]:       0.50,
      [CardTag.COOPERATIVE]:  0.20,
    },
    scoringMultiplier: 1.0,
    legalInModes: ['GO_ALONE'],
    timingModifier: 0,
  },
  'HEAD_TO_HEAD': {
    tagWeightOverrides: {
      [CardTag.COMBAT]:       1.50,
      [CardTag.TEMPO]:        1.40,
      [CardTag.SABOTAGE]:     1.35,
      [CardTag.COUNTER]:      1.30,
      [CardTag.LEVERAGE]:     1.20,
      [CardTag.LIQUIDITY]:    0.80,
      [CardTag.COOPERATIVE]:  0.30,
    },
    scoringMultiplier: 1.1,
    legalInModes: ['HEAD_TO_HEAD'],
    timingModifier: -1000, // shorter windows under combat pressure
  },
  'TEAM_UP': {
    tagWeightOverrides: {
      [CardTag.TRUST]:        1.50,
      [CardTag.COOPERATIVE]:  1.45,
      [CardTag.RESILIENCE]:   1.30,
      [CardTag.INCOME]:       1.20,
      [CardTag.COMBAT]:       0.60,
      [CardTag.SABOTAGE]:     0.40,
    },
    scoringMultiplier: 1.0,
    legalInModes: ['TEAM_UP'],
    timingModifier: 2000, // more time — coordination requires deliberation
  },
  'CHASE_A_LEGEND': {
    tagWeightOverrides: {
      [CardTag.PRECISION]:    1.50,
      [CardTag.VARIANCE_RED]: 1.45,
      [CardTag.DETERMINISTIC]:1.40,
      [CardTag.COMPOUNDING]:  1.25,
      [CardTag.TEMPO]:        1.15,
      [CardTag.COMBAT]:       0.70,
      [CardTag.COOPERATIVE]:  0.50,
    },
    scoringMultiplier: 1.05,
    legalInModes: ['CHASE_A_LEGEND'],
    timingModifier: 1000,
  },
} as const;

// ── Card Event Names ──────────────────────────────────────────────────────────
/**
 * All event names emitted by CardUXBridge on the EventBus.
 * CARD-LAYER events only — distinct from Engine 0 core events.
 * Consumed by engineStore and ResultScreen.
 */
export type CardEventName =
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
  | 'DECISION_WINDOW_OPENED'
  | 'DECISION_WINDOW_EXPIRED'
  | 'DECISION_WINDOW_RESOLVED';

// ── Card Event Payload Map ────────────────────────────────────────────────────
/**
 * Typed payload shapes for all 28 card-layer events.
 * Used by CardUXBridge for type-safe emission and by engineStore for consumption.
 */
export interface CardEventPayloadMap {
  'CARD_DRAWN':                   { instanceId: string; cardId: string; deckType: DeckType; rarity: CardRarity; tickIndex: number };
  'CARD_PLAYED':                  { instanceId: string; cardId: string; choiceId: string; resolvedInMs: number; wasOptimal: boolean; cordDelta: number; tickIndex: number };
  'CARD_DISCARDED':               { instanceId: string; cardId: string; reason: string; tickIndex: number };
  'CARD_HELD':                    { instanceId: string; cardId: string; remainingMs: number; tickIndex: number };
  'CARD_UNHELD':                  { instanceId: string; cardId: string; tickIndex: number };
  'CARD_AUTO_RESOLVED':           { instanceId: string; cardId: string; autoChoice: string; speedScore: number; tickIndex: number };
  'FORCED_CARD_INJECTED':         { entryId: string; cardId: string; source: ForcedCardSource; instanceId: string; tickIndex: number };
  'FORCED_CARD_RESOLVED':         { entryId: string; cardId: string; instanceId: string; tickIndex: number };
  'MISSED_OPPORTUNITY':           { instanceId: string; cardId: string; cordLost: number; streakCount: number; tickIndex: number };
  'PHASE_BOUNDARY_CARD_AVAILABLE':{ phase: RunPhase; cardsAvailable: string[]; closesAtTick: number; tickIndex: number };
  'PHASE_BOUNDARY_WINDOW_CLOSED': { phase: RunPhase; wasConsumed: boolean; tickIndex: number };
  'LEGENDARY_CARD_DRAWN':         { instanceId: string; cardId: string; tickIndex: number };
  'BLUFF_CARD_DISPLAYED':         { instanceId: string; cardId: string; displayedAsCardId: string; tickIndex: number };
  'COUNTER_WINDOW_OPENED':        { triggerAttackId: string; durationMs: number; tickIndex: number };
  'COUNTER_WINDOW_CLOSED':        { triggerAttackId: string; wasCountered: boolean; tickIndex: number };
  'RESCUE_WINDOW_OPENED':         { teammateId: string; durationMs: number; tickIndex: number };
  'RESCUE_WINDOW_CLOSED':         { teammateId: string; wasRescued: boolean; effectivenessMultiplier: number; tickIndex: number };
  'DEFECTION_STEP_PLAYED':        { step: DefectionStep; defectorId: string; tickIndex: number };
  'DEFECTION_COMPLETED':          { defectorId: string; cordPenalty: number; tickIndex: number };
  'AID_TERMS_ACTIVATED':          { terms: AidCardTerms; tickIndex: number };
  'AID_REPAID':                   { lenderId: string; receiverId: string; amount: number; tickIndex: number };
  'AID_DEFAULTED':                { receiverId: string; penaltyApplied: number; tickIndex: number };
  'GHOST_CARD_ACTIVATED':         { instanceId: string; cardId: string; markerType: LegendMarkerType; divergenceDelta: number; tickIndex: number };
  'PROOF_BADGE_CONDITION_MET':    { badgeId: string; cardId: string; tickIndex: number };
  'CARD_HAND_SNAPSHOT':           { handSize: number; forcedCount: number; windowsActive: number; tickIndex: number };
  'DECISION_WINDOW_OPENED':       { windowId: string; cardId: string; cardInstanceId: string; durationMs: number; autoResolveChoice: string; tickIndex: number };
  'DECISION_WINDOW_EXPIRED':      { windowId: string; cardId: string; cardInstanceId: string; autoChoice: string; speedScore: number; tickIndex: number };
  'DECISION_WINDOW_RESOLVED':     { windowId: string; cardId: string; cardInstanceId: string; choiceId: string; resolvedInMs: number; wasOptimal: boolean; tickIndex: number };
}
