/**
 * The four game modes. Declared here as a string union (matching modes.ts)
 * to allow cards.ts to stay import-free and avoid circular dependencies.
 * Mode adapters and the CardEngine use this type for routing decisions.
 */
export type GameMode = 'GO_ALONE' | 'HEAD_TO_HEAD' | 'TEAM_UP' | 'CHASE_A_LEGEND';
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
export declare enum TimingClass {
    IMMEDIATE = "IMMEDIATE",
    REACTIVE = "REACTIVE",
    STANDARD = "STANDARD",
    HOLD = "HOLD",
    COUNTER_WINDOW = "COUNTER_WINDOW",
    RESCUE_WINDOW = "RESCUE_WINDOW",
    PHASE_BOUNDARY = "PHASE_BOUNDARY",
    FORCED = "FORCED",
    LEGENDARY = "LEGENDARY",
    BLUFF = "BLUFF",
    DEFECTION_STEP = "DEFECTION_STEP",
    SOVEREIGNTY_DECISION = "SOVEREIGNTY_DECISION"
}
/**
 * The 6 base deck types — legal in multiple modes.
 * CARD_LEGALITY_MATRIX determines which modes include each.
 */
export declare enum BaseDeckType {
    OPPORTUNITY = "OPPORTUNITY",// Capital deployment — primary growth tool
    IPA = "IPA",// Income-Producing Assets — compounding engine
    FUBAR = "FUBAR",// Market reality — mostly engine-injected
    PRIVILEGED = "PRIVILEGED",// Power moves with hater heat tradeoff
    SO = "SO",// Systemic Obstacle — convert cash/time/pain
    PHASE_BOUNDARY = "PHASE_BOUNDARY"
}
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
export declare enum ModeDeckType {
    SABOTAGE = "SABOTAGE",
    COUNTER = "COUNTER",
    BLUFF = "BLUFF",
    AID = "AID",
    RESCUE = "RESCUE",
    TRUST = "TRUST",
    DEFECTION = "DEFECTION",
    GHOST = "GHOST",
    DISCIPLINE = "DISCIPLINE"
}
/** Union of all 15 deck types. */
export type DeckType = BaseDeckType | ModeDeckType;
/**
 * Card tags — the mode routing system.
 * ModeOverlayEngine reads tags to apply per-mode scoring weight overrides.
 * The engine does NOT hardcode "this card is good in Empire" — instead,
 * GO_ALONE reads LIQUIDITY and RESILIENCE tags and weights them higher.
 * Tags are additive; a card can have multiple tags.
 */
export declare enum CardTag {
    LIQUIDITY = "liquidity",
    INCOME = "income",
    COMPOUNDING = "compounding",
    RESILIENCE = "resilience",
    AUTOMATION = "automation",
    TEMPO = "tempo",
    LEVERAGE = "leverage",
    SABOTAGE = "sabotage",
    COUNTER = "counter",
    TRUST = "trust",
    PRECISION = "precision",
    VARIANCE_RED = "variance_reduction",
    CAPITAL_ALLOC = "capital_allocation",
    COMBAT = "combat",
    COOPERATIVE = "cooperative",
    DETERMINISTIC = "deterministic",
    LEGENDARY_TAG = "legendary",
    PRIVILEGED_TAG = "privileged",
    REAL_WORLD_FINANCE = "real_world_finance"
}
/**
 * Who or what a card's effect applies to when played.
 * Distinct from CardVisibilityScope (who can SEE the card).
 */
export declare enum Targeting {
    SELF = "SELF",// Affects only the playing player
    OPPONENT = "OPPONENT",// Affects the opponent (HEAD_TO_HEAD only)
    TEAMMATE = "TEAMMATE",// Affects a specific teammate (TEAM_UP only)
    TEAM_ALL = "TEAM_ALL",// Affects entire team (TEAM_UP)
    GHOST_REF = "GHOST_REF",// Targets Legend Marker data (CHASE_A_LEGEND only)
    ENGINE = "ENGINE"
}
/**
 * Who can see this card in multiplayer contexts.
 * Distinct from Targeting (who is AFFECTED by it).
 */
export type CardVisibilityScope = 'SELF' | 'ALL' | 'OPPONENT_ONLY';
/** @deprecated Use CardVisibilityScope. Preserved for backward compat. */
export type CardVisibility = CardVisibilityScope;
/**
 * Card rarity tier. Drives drop rate and visual treatment.
 * LEGENDARY — 1% drop rate. Cannot be blocked by any hater bot.
 */
export declare enum CardRarity {
    COMMON = "COMMON",
    UNCOMMON = "UNCOMMON",
    RARE = "RARE",
    EPIC = "EPIC",
    LEGENDARY = "LEGENDARY"
}
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
export declare enum LegendMarkerType {
    GOLD = "GOLD",
    RED = "RED",
    PURPLE = "PURPLE",
    SILVER = "SILVER",
    BLACK = "BLACK"
}
/**
 * The 3-card betrayal arc in TEAM_UP mode.
 * Each step must be played ≥1 tick after the previous.
 * Completing all 3 triggers full asset seizure and CORD penalty.
 */
export declare enum DefectionStep {
    BREAK_PACT = "BREAK_PACT",// Step 1 — initiates betrayal arc
    SILENT_EXIT = "SILENT_EXIT",// Step 2 — ≥1 tick after step 1
    ASSET_SEIZURE = "ASSET_SEIZURE"
}
/**
 * Three-phase run structure for GO_ALONE mode.
 * Re-declared here (not imported) to keep cards.ts import-free.
 * Canonical definition lives in modes.ts.
 */
export type RunPhase = 'FOUNDATION' | 'ESCALATION' | 'SOVEREIGNTY';
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
export declare enum ForcedCardSource {
    HATER_BOT = "HATER_BOT",
    PHASE_BOUNDARY = "PHASE_BOUNDARY",
    TENSION_ENGINE = "TENSION_ENGINE",
    OPPONENT_SABOTAGE = "OPPONENT_SABOTAGE",
    GHOST_PRESSURE = "GHOST_PRESSURE"
}
/**
 * The economic effect of playing a card.
 * All fields optional — a FUBAR card may only have a freezeTicks field.
 * Null/undefined means "this field is not affected by this card."
 */
export interface CardBaseEffect {
    /** One-time cash change (positive = gain, negative = cost) */
    cashDelta?: number;
    /** Monthly income change (persists for run duration unless conditional) */
    incomeDelta?: number;
    /** Monthly expenses change */
    expensesDelta?: number;
    /** Shield layer integrity repair (points restored to a specific layer) */
    shieldRepair?: number;
    /** Which shield layer is repaired (ShieldLayerId string) */
    shieldLayerTarget?: string;
    /** Hater heat change (negative = cool down, positive = increase) */
    haterHeatDelta?: number;
    /** Number of ticks to freeze (player cannot play cards) */
    freezeTicks?: number;
    /** Battle Budget generated (HEAD_TO_HEAD only) */
    bbGeneration?: number;
    /** Trust score delta (TEAM_UP only, 0.0–1.0 scale) */
    trustDelta?: number;
    /** CORD basis point delta applied to final score */
    cordDeltaBasis?: number;
    /** Duration in ticks for income/expense changes (null = permanent) */
    durationTicks?: number | null;
}
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
    scoringMultiplier: number;
    /** Modes where this overlay is active (usually one mode) */
    legalInModes: GameMode[];
    /** +/- ms adjustment to timing window. 0 = no change. */
    timingModifier: number;
}
/**
 * The immutable base definition of every card in the game.
 * Mode overlays mutate runtime behavior — the base definition never changes.
 * Every entry in CardRegistry.ts is a CardDefinition.
 *
 * cardId must be unique across ALL cards. Convention: '{type}_{name}_{3-digit-num}'
 * e.g. 'opportunity_rental_001', 'fubar_audit_002'
 */
export interface CardDefinition {
    readonly cardId: string;
    readonly name: string;
    readonly deckType: DeckType;
    readonly rarity: CardRarity;
    readonly timingClass: TimingClass;
    readonly base_cost: number;
    readonly base_effect: CardBaseEffect;
    readonly tags: CardTag[];
    readonly targeting: Targeting;
    readonly visibility: CardVisibilityScope;
    /** Per-mode scoring/timing overrides. Key = GameMode string. */
    readonly mode_overrides: Partial<Record<GameMode, ModeOverlay>>;
    /** Lore or real-world finance educational note (shown on card flip) */
    readonly educational_note: string;
    /** Defection step this card represents (DEFECTION deck only) */
    readonly defectionStep?: DefectionStep;
    /** Legend marker requirement for activation (GHOST deck only) */
    readonly ghostRequirement?: GhostCardRequirement;
    /** Phase this card is legal in (PHASE_BOUNDARY deck only) */
    readonly legalPhase?: RunPhase;
    /** AID contract terms embedded in this card (AID deck only) */
    readonly aidTerms?: Omit<AidCardTerms, 'lenderId' | 'receiverId' | 'isRepaid' | 'dueAtTick'>;
}
/**
 * Runtime metadata appended by mode adapters when a card enters the hand.
 * Modifies how the card scores and resolves for the active mode.
 * Stored in CardInHand.modeMetadata — not on CardDefinition.
 */
export interface ModeCardMetadata {
    mode: GameMode;
    /** Economy gain to self if played optimally */
    selfValue?: number;
    /** Value of denying opponent this card */
    denyValue?: number;
    /** Battle Budget generated when this card is played as attacker */
    bbGeneration?: number;
    /** BB cost to play this card as a sabotage action */
    bbCost?: number;
    /** True if this card is currently displayed as a bluff (BLUFF deck) */
    isDisplayedAsBluff?: boolean;
    /** Trust score delta on play (+/-) */
    trustImpact?: number;
    /** Description of effect applied to receiving teammate */
    recipientPreview?: string;
    /** True if this card is part of an active defection sequence */
    defectionSignature?: boolean;
    /** Which defection step this card represents */
    defectionStepValue?: DefectionStep;
    /** AID contract terms if this is an active AID card */
    activeAidTerms?: AidCardTerms;
    /** Change in CORD basis points vs legend path when played */
    cordDelta?: number;
    /** True if card counters an active legend pressure event */
    legendPressureResponse?: boolean;
    /** Legend marker type this card targets */
    ghostMarkerTarget?: LegendMarkerType;
    /** CORD gap change expected on play (positive = closing gap) */
    expectedGapChange?: number;
    /** Multiplier on isolation tax for the tick this card is played */
    isolationTaxModifier?: number;
    /** True if card is amplified while in Bleed Mode */
    bleedAmplifier?: boolean;
    /** True if eligible for Comeback Surge bonus */
    comebackEligible?: boolean;
    /** Decision quality tag: fast+correct = OPTIMAL, late = LATE, etc. */
    decisionTag?: 'FAST' | 'LATE' | 'OPTIMAL' | 'RISKY' | 'AUTO';
    /** CORD basis point contribution recorded for sovereignty score */
    cordContribution?: number;
}
/**
 * A card currently in the player's hand — a runtime instance of a CardDefinition.
 * Replaces the monolithic GameCard from Sprint 0.
 *
 * instanceId is unique per deal — the same CardDefinition can produce multiple
 * CardInHand instances in the same run (multiple copies in deck).
 */
export interface CardInHand {
    /** UUID — unique per instance. Used for event tracking + replay. */
    instanceId: string;
    /** References CardDefinition.cardId in CardRegistry. */
    cardId: string;
    /** Full immutable definition — embedded at draw time for determinism. */
    definition: CardDefinition;
    /** Tick when this card was drawn or injected into hand. */
    drawnAtTick: number;
    /**
     * Tick when player activated Hold (GO_ALONE only).
     * Null = not currently held.
     */
    heldSince: number | null;
    /** True if this card was force-injected (not drawn by player). */
    forcedEntry: boolean;
    /** Source if forced; null if normal draw. */
    forcedSource: ForcedCardSource | null;
    /** Mode adapter metadata. Applied at draw time by ModeOverlayEngine. */
    modeMetadata: ModeCardMetadata | null;
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
    id: string;
    name: string;
    type: string;
    subtype: string;
    description: string;
    origin: string;
    visibility: CardVisibilityScope;
    cost: number | null;
    leverage: number | null;
    downPayment: number | null;
    cashflowMonthly: number | null;
    roiPct: number | null;
    cashImpact: number | null;
    turnsLost: number | null;
    value: number | null;
    energyCost: number;
    synergies: string[];
    modeMetadata?: ModeCardMetadata;
}
/**
 * Context fed into cardValuation.ts for mode-aware scoring.
 * Unchanged from Sprint 0 (engine still uses this shape).
 */
export interface CardValuationContext {
    mode: GameMode;
    cash: number;
    netWorth: number;
    income: number;
    expenses: number;
    tick: number;
    shields: number;
    pressureScore: number;
    battleBudget?: number;
    opponentCash?: number;
    cordGap?: number;
    inBleedMode?: boolean;
    trustScore?: number;
}
/**
 * Financial contract terms embedded in a TEAM_UP AID card.
 * Created when the AID card is played. Stored in modeMetadata.activeAidTerms.
 */
export interface AidCardTerms {
    readonly lenderId: string;
    readonly receiverId: string;
    readonly amount: number;
    readonly repaymentTicks: number;
    readonly dueAtTick: number;
    readonly penaltyOnDefault: number;
    isRepaid: boolean;
}
/**
 * Activation requirement for a CHASE_A_LEGEND GHOST card.
 * Card cannot be played unless the required legend markers exist on the timeline.
 */
export interface GhostCardRequirement {
    readonly markerType: LegendMarkerType;
    readonly minMarkerCount: number;
    readonly divergenceThreshold?: number;
}
/**
 * Metadata for PHASE_BOUNDARY timing class cards.
 * Window opens for 5 ticks at each Empire phase transition.
 */
export interface PhaseBoundaryWindow {
    readonly phase: RunPhase;
    readonly openedAtTick: number;
    readonly closesAtTick: number;
    readonly cardsAvailable: string[];
    isConsumed: boolean;
}
/**
 * Which DeckTypes are legal in each GameMode.
 * Read by DeckBuilder at run start to construct the mode-appropriate draw stack.
 * Mode adapters inject mode-exclusive deck types on top of the base set.
 */
export declare const CARD_LEGALITY_MATRIX: Record<GameMode, DeckType[]>;
/** Whether a DeckType can be manually played by the player (vs engine-injected). */
export declare const DECK_TYPE_MANUALLY_PLAYABLE: Partial<Record<DeckType, boolean>>;
/**
 * Base decision window duration per timing class in milliseconds.
 * Final duration = base * tick duration modifier from TimeEngine.
 * 0 = always playable / no countdown.
 */
export declare const TIMING_CLASS_WINDOW_MS: Record<TimingClass, number>;
/**
 * Default tag weight overrides per mode.
 * Applied when no card-specific override exists.
 * Per-card mode_overrides.tagWeightOverrides merge with (override) these defaults.
 */
export declare const DEFAULT_MODE_OVERLAYS: Record<GameMode, ModeOverlay>;
/**
 * All event names emitted by CardUXBridge on the EventBus.
 * CARD-LAYER events only — distinct from Engine 0 core events.
 * Consumed by engineStore and ResultScreen.
 */
export type CardEventName = 'CARD_DRAWN' | 'CARD_PLAYED' | 'CARD_DISCARDED' | 'CARD_HELD' | 'CARD_UNHELD' | 'CARD_AUTO_RESOLVED' | 'FORCED_CARD_INJECTED' | 'FORCED_CARD_RESOLVED' | 'MISSED_OPPORTUNITY' | 'PHASE_BOUNDARY_CARD_AVAILABLE' | 'PHASE_BOUNDARY_WINDOW_CLOSED' | 'LEGENDARY_CARD_DRAWN' | 'BLUFF_CARD_DISPLAYED' | 'COUNTER_WINDOW_OPENED' | 'COUNTER_WINDOW_CLOSED' | 'RESCUE_WINDOW_OPENED' | 'RESCUE_WINDOW_CLOSED' | 'DEFECTION_STEP_PLAYED' | 'DEFECTION_COMPLETED' | 'AID_TERMS_ACTIVATED' | 'AID_REPAID' | 'AID_DEFAULTED' | 'GHOST_CARD_ACTIVATED' | 'PROOF_BADGE_CONDITION_MET' | 'CARD_HAND_SNAPSHOT' | 'DECISION_WINDOW_OPENED' | 'DECISION_WINDOW_EXPIRED' | 'DECISION_WINDOW_RESOLVED';
/**
 * Typed payload shapes for all 28 card-layer events.
 * Used by CardUXBridge for type-safe emission and by engineStore for consumption.
 */
export interface CardEventPayloadMap {
    'CARD_DRAWN': {
        instanceId: string;
        cardId: string;
        deckType: DeckType;
        rarity: CardRarity;
        tickIndex: number;
    };
    'CARD_PLAYED': {
        instanceId: string;
        cardId: string;
        choiceId: string;
        resolvedInMs: number;
        wasOptimal: boolean;
        cordDelta: number;
        tickIndex: number;
    };
    'CARD_DISCARDED': {
        instanceId: string;
        cardId: string;
        reason: string;
        tickIndex: number;
    };
    'CARD_HELD': {
        instanceId: string;
        cardId: string;
        remainingMs: number;
        tickIndex: number;
    };
    'CARD_UNHELD': {
        instanceId: string;
        cardId: string;
        tickIndex: number;
    };
    'CARD_AUTO_RESOLVED': {
        instanceId: string;
        cardId: string;
        autoChoice: string;
        speedScore: number;
        tickIndex: number;
    };
    'FORCED_CARD_INJECTED': {
        entryId: string;
        cardId: string;
        source: ForcedCardSource;
        instanceId: string;
        tickIndex: number;
    };
    'FORCED_CARD_RESOLVED': {
        entryId: string;
        cardId: string;
        instanceId: string;
        tickIndex: number;
    };
    'MISSED_OPPORTUNITY': {
        instanceId: string;
        cardId: string;
        cordLost: number;
        streakCount: number;
        tickIndex: number;
    };
    'PHASE_BOUNDARY_CARD_AVAILABLE': {
        phase: RunPhase;
        cardsAvailable: string[];
        closesAtTick: number;
        tickIndex: number;
    };
    'PHASE_BOUNDARY_WINDOW_CLOSED': {
        phase: RunPhase;
        wasConsumed: boolean;
        tickIndex: number;
    };
    'LEGENDARY_CARD_DRAWN': {
        instanceId: string;
        cardId: string;
        tickIndex: number;
    };
    'BLUFF_CARD_DISPLAYED': {
        instanceId: string;
        cardId: string;
        displayedAsCardId: string;
        tickIndex: number;
    };
    'COUNTER_WINDOW_OPENED': {
        triggerAttackId: string;
        durationMs: number;
        tickIndex: number;
    };
    'COUNTER_WINDOW_CLOSED': {
        triggerAttackId: string;
        wasCountered: boolean;
        tickIndex: number;
    };
    'RESCUE_WINDOW_OPENED': {
        teammateId: string;
        durationMs: number;
        tickIndex: number;
    };
    'RESCUE_WINDOW_CLOSED': {
        teammateId: string;
        wasRescued: boolean;
        effectivenessMultiplier: number;
        tickIndex: number;
    };
    'DEFECTION_STEP_PLAYED': {
        step: DefectionStep;
        defectorId: string;
        tickIndex: number;
    };
    'DEFECTION_COMPLETED': {
        defectorId: string;
        cordPenalty: number;
        tickIndex: number;
    };
    'AID_TERMS_ACTIVATED': {
        terms: AidCardTerms;
        tickIndex: number;
    };
    'AID_REPAID': {
        lenderId: string;
        receiverId: string;
        amount: number;
        tickIndex: number;
    };
    'AID_DEFAULTED': {
        receiverId: string;
        penaltyApplied: number;
        tickIndex: number;
    };
    'GHOST_CARD_ACTIVATED': {
        instanceId: string;
        cardId: string;
        markerType: LegendMarkerType;
        divergenceDelta: number;
        tickIndex: number;
    };
    'PROOF_BADGE_CONDITION_MET': {
        badgeId: string;
        cardId: string;
        tickIndex: number;
    };
    'CARD_HAND_SNAPSHOT': {
        handSize: number;
        forcedCount: number;
        windowsActive: number;
        tickIndex: number;
    };
    'DECISION_WINDOW_OPENED': {
        windowId: string;
        cardId: string;
        cardInstanceId: string;
        durationMs: number;
        autoResolveChoice: string;
        tickIndex: number;
    };
    'DECISION_WINDOW_EXPIRED': {
        windowId: string;
        cardId: string;
        cardInstanceId: string;
        autoChoice: string;
        speedScore: number;
        tickIndex: number;
    };
    'DECISION_WINDOW_RESOLVED': {
        windowId: string;
        cardId: string;
        cardInstanceId: string;
        choiceId: string;
        resolvedInMs: number;
        wasOptimal: boolean;
        tickIndex: number;
    };
}
//# sourceMappingURL=cards.d.ts.map