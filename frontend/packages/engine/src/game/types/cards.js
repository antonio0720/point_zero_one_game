"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_MODE_OVERLAYS = exports.TIMING_CLASS_WINDOW_MS = exports.DECK_TYPE_MANUALLY_PLAYABLE = exports.CARD_LEGALITY_MATRIX = exports.ForcedCardSource = exports.DefectionStep = exports.LegendMarkerType = exports.CardRarity = exports.Targeting = exports.CardTag = exports.ModeDeckType = exports.BaseDeckType = exports.TimingClass = void 0;
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
var TimingClass;
(function (TimingClass) {
    TimingClass["IMMEDIATE"] = "IMMEDIATE";
    TimingClass["REACTIVE"] = "REACTIVE";
    TimingClass["STANDARD"] = "STANDARD";
    TimingClass["HOLD"] = "HOLD";
    TimingClass["COUNTER_WINDOW"] = "COUNTER_WINDOW";
    TimingClass["RESCUE_WINDOW"] = "RESCUE_WINDOW";
    TimingClass["PHASE_BOUNDARY"] = "PHASE_BOUNDARY";
    TimingClass["FORCED"] = "FORCED";
    TimingClass["LEGENDARY"] = "LEGENDARY";
    TimingClass["BLUFF"] = "BLUFF";
    TimingClass["DEFECTION_STEP"] = "DEFECTION_STEP";
    TimingClass["SOVEREIGNTY_DECISION"] = "SOVEREIGNTY_DECISION";
})(TimingClass || (exports.TimingClass = TimingClass = {}));
// ── Base Deck Types ───────────────────────────────────────────────────────────
/**
 * The 6 base deck types — legal in multiple modes.
 * CARD_LEGALITY_MATRIX determines which modes include each.
 */
var BaseDeckType;
(function (BaseDeckType) {
    BaseDeckType["OPPORTUNITY"] = "OPPORTUNITY";
    BaseDeckType["IPA"] = "IPA";
    BaseDeckType["FUBAR"] = "FUBAR";
    BaseDeckType["PRIVILEGED"] = "PRIVILEGED";
    BaseDeckType["SO"] = "SO";
    BaseDeckType["PHASE_BOUNDARY"] = "PHASE_BOUNDARY";
})(BaseDeckType || (exports.BaseDeckType = BaseDeckType = {}));
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
var ModeDeckType;
(function (ModeDeckType) {
    ModeDeckType["SABOTAGE"] = "SABOTAGE";
    ModeDeckType["COUNTER"] = "COUNTER";
    ModeDeckType["BLUFF"] = "BLUFF";
    ModeDeckType["AID"] = "AID";
    ModeDeckType["RESCUE"] = "RESCUE";
    ModeDeckType["TRUST"] = "TRUST";
    ModeDeckType["DEFECTION"] = "DEFECTION";
    ModeDeckType["GHOST"] = "GHOST";
    ModeDeckType["DISCIPLINE"] = "DISCIPLINE";
})(ModeDeckType || (exports.ModeDeckType = ModeDeckType = {}));
// ── Card Tag Taxonomy ─────────────────────────────────────────────────────────
/**
 * Card tags — the mode routing system.
 * ModeOverlayEngine reads tags to apply per-mode scoring weight overrides.
 * The engine does NOT hardcode "this card is good in Empire" — instead,
 * GO_ALONE reads LIQUIDITY and RESILIENCE tags and weights them higher.
 * Tags are additive; a card can have multiple tags.
 */
var CardTag;
(function (CardTag) {
    // Financial mechanics
    CardTag["LIQUIDITY"] = "liquidity";
    CardTag["INCOME"] = "income";
    CardTag["COMPOUNDING"] = "compounding";
    CardTag["RESILIENCE"] = "resilience";
    CardTag["AUTOMATION"] = "automation";
    CardTag["TEMPO"] = "tempo";
    CardTag["LEVERAGE"] = "leverage";
    CardTag["SABOTAGE"] = "sabotage";
    CardTag["COUNTER"] = "counter";
    CardTag["TRUST"] = "trust";
    CardTag["PRECISION"] = "precision";
    CardTag["VARIANCE_RED"] = "variance_reduction";
    // Mode signal tags
    CardTag["CAPITAL_ALLOC"] = "capital_allocation";
    CardTag["COMBAT"] = "combat";
    CardTag["COOPERATIVE"] = "cooperative";
    CardTag["DETERMINISTIC"] = "deterministic";
    // Rarity / power tags
    CardTag["LEGENDARY_TAG"] = "legendary";
    CardTag["PRIVILEGED_TAG"] = "privileged";
    // Educational mapping
    CardTag["REAL_WORLD_FINANCE"] = "real_world_finance";
})(CardTag || (exports.CardTag = CardTag = {}));
// ── Card Targeting ────────────────────────────────────────────────────────────
/**
 * Who or what a card's effect applies to when played.
 * Distinct from CardVisibilityScope (who can SEE the card).
 */
var Targeting;
(function (Targeting) {
    Targeting["SELF"] = "SELF";
    Targeting["OPPONENT"] = "OPPONENT";
    Targeting["TEAMMATE"] = "TEAMMATE";
    Targeting["TEAM_ALL"] = "TEAM_ALL";
    Targeting["GHOST_REF"] = "GHOST_REF";
    Targeting["ENGINE"] = "ENGINE";
})(Targeting || (exports.Targeting = Targeting = {}));
// ── Card Rarity ───────────────────────────────────────────────────────────────
/**
 * Card rarity tier. Drives drop rate and visual treatment.
 * LEGENDARY — 1% drop rate. Cannot be blocked by any hater bot.
 */
var CardRarity;
(function (CardRarity) {
    CardRarity["COMMON"] = "COMMON";
    CardRarity["UNCOMMON"] = "UNCOMMON";
    CardRarity["RARE"] = "RARE";
    CardRarity["EPIC"] = "EPIC";
    CardRarity["LEGENDARY"] = "LEGENDARY";
})(CardRarity || (exports.CardRarity = CardRarity = {}));
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
var LegendMarkerType;
(function (LegendMarkerType) {
    LegendMarkerType["GOLD"] = "GOLD";
    LegendMarkerType["RED"] = "RED";
    LegendMarkerType["PURPLE"] = "PURPLE";
    LegendMarkerType["SILVER"] = "SILVER";
    LegendMarkerType["BLACK"] = "BLACK";
})(LegendMarkerType || (exports.LegendMarkerType = LegendMarkerType = {}));
// ── Defection Step (Syndicate mode) ──────────────────────────────────────────
/**
 * The 3-card betrayal arc in TEAM_UP mode.
 * Each step must be played ≥1 tick after the previous.
 * Completing all 3 triggers full asset seizure and CORD penalty.
 */
var DefectionStep;
(function (DefectionStep) {
    DefectionStep["BREAK_PACT"] = "BREAK_PACT";
    DefectionStep["SILENT_EXIT"] = "SILENT_EXIT";
    DefectionStep["ASSET_SEIZURE"] = "ASSET_SEIZURE";
})(DefectionStep || (exports.DefectionStep = DefectionStep = {}));
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
var ForcedCardSource;
(function (ForcedCardSource) {
    ForcedCardSource["HATER_BOT"] = "HATER_BOT";
    ForcedCardSource["PHASE_BOUNDARY"] = "PHASE_BOUNDARY";
    ForcedCardSource["TENSION_ENGINE"] = "TENSION_ENGINE";
    ForcedCardSource["OPPONENT_SABOTAGE"] = "OPPONENT_SABOTAGE";
    ForcedCardSource["GHOST_PRESSURE"] = "GHOST_PRESSURE";
})(ForcedCardSource || (exports.ForcedCardSource = ForcedCardSource = {}));
// ── Card Legality Matrix ──────────────────────────────────────────────────────
/**
 * Which DeckTypes are legal in each GameMode.
 * Read by DeckBuilder at run start to construct the mode-appropriate draw stack.
 * Mode adapters inject mode-exclusive deck types on top of the base set.
 */
exports.CARD_LEGALITY_MATRIX = {
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
};
/** Whether a DeckType can be manually played by the player (vs engine-injected). */
exports.DECK_TYPE_MANUALLY_PLAYABLE = {
    [BaseDeckType.OPPORTUNITY]: true,
    [BaseDeckType.IPA]: true,
    [BaseDeckType.FUBAR]: false, // forcedEventEngine only
    [BaseDeckType.PRIVILEGED]: true,
    [BaseDeckType.SO]: false, // forcedEventEngine only
    [BaseDeckType.PHASE_BOUNDARY]: true, // but only during phase window
    [ModeDeckType.SABOTAGE]: true,
    [ModeDeckType.COUNTER]: true, // held in advance
    [ModeDeckType.BLUFF]: true,
    [ModeDeckType.AID]: true,
    [ModeDeckType.RESCUE]: true,
    [ModeDeckType.TRUST]: true,
    [ModeDeckType.DEFECTION]: true, // intentional — player initiates
    [ModeDeckType.GHOST]: true,
    [ModeDeckType.DISCIPLINE]: true,
};
// ── Timing Class Window Durations ─────────────────────────────────────────────
/**
 * Base decision window duration per timing class in milliseconds.
 * Final duration = base * tick duration modifier from TimeEngine.
 * 0 = always playable / no countdown.
 */
exports.TIMING_CLASS_WINDOW_MS = {
    [TimingClass.IMMEDIATE]: 0,
    [TimingClass.REACTIVE]: 4_000,
    [TimingClass.STANDARD]: 12_000,
    [TimingClass.HOLD]: 0, // paused — no countdown while held
    [TimingClass.COUNTER_WINDOW]: 5_000, // HEAD_TO_HEAD 5-sec window
    [TimingClass.RESCUE_WINDOW]: 15_000, // TEAM_UP — decays with delay
    [TimingClass.PHASE_BOUNDARY]: 45_000, // 5 ticks × ~9s at T1
    [TimingClass.FORCED]: 10_000, // worst option on expiry
    [TimingClass.LEGENDARY]: 20_000, // generous — landmark event
    [TimingClass.BLUFF]: 8_000, // display + execute
    [TimingClass.DEFECTION_STEP]: 30_000, // detectable delay is intentional
    [TimingClass.SOVEREIGNTY_DECISION]: 20_000,
};
// ── Default Mode Overlays ─────────────────────────────────────────────────────
/**
 * Default tag weight overrides per mode.
 * Applied when no card-specific override exists.
 * Per-card mode_overrides.tagWeightOverrides merge with (override) these defaults.
 */
exports.DEFAULT_MODE_OVERLAYS = {
    'GO_ALONE': {
        tagWeightOverrides: {
            [CardTag.LIQUIDITY]: 1.40,
            [CardTag.RESILIENCE]: 1.35,
            [CardTag.COMPOUNDING]: 1.20,
            [CardTag.LEVERAGE]: 0.85,
            [CardTag.COMBAT]: 0.50,
            [CardTag.COOPERATIVE]: 0.20,
        },
        scoringMultiplier: 1.0,
        legalInModes: ['GO_ALONE'],
        timingModifier: 0,
    },
    'HEAD_TO_HEAD': {
        tagWeightOverrides: {
            [CardTag.COMBAT]: 1.50,
            [CardTag.TEMPO]: 1.40,
            [CardTag.SABOTAGE]: 1.35,
            [CardTag.COUNTER]: 1.30,
            [CardTag.LEVERAGE]: 1.20,
            [CardTag.LIQUIDITY]: 0.80,
            [CardTag.COOPERATIVE]: 0.30,
        },
        scoringMultiplier: 1.1,
        legalInModes: ['HEAD_TO_HEAD'],
        timingModifier: -1000, // shorter windows under combat pressure
    },
    'TEAM_UP': {
        tagWeightOverrides: {
            [CardTag.TRUST]: 1.50,
            [CardTag.COOPERATIVE]: 1.45,
            [CardTag.RESILIENCE]: 1.30,
            [CardTag.INCOME]: 1.20,
            [CardTag.COMBAT]: 0.60,
            [CardTag.SABOTAGE]: 0.40,
        },
        scoringMultiplier: 1.0,
        legalInModes: ['TEAM_UP'],
        timingModifier: 2000, // more time — coordination requires deliberation
    },
    'CHASE_A_LEGEND': {
        tagWeightOverrides: {
            [CardTag.PRECISION]: 1.50,
            [CardTag.VARIANCE_RED]: 1.45,
            [CardTag.DETERMINISTIC]: 1.40,
            [CardTag.COMPOUNDING]: 1.25,
            [CardTag.TEMPO]: 1.15,
            [CardTag.COMBAT]: 0.70,
            [CardTag.COOPERATIVE]: 0.50,
        },
        scoringMultiplier: 1.05,
        legalInModes: ['CHASE_A_LEGEND'],
        timingModifier: 1000,
    },
};
//# sourceMappingURL=cards.js.map