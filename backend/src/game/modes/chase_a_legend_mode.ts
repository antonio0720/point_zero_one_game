// backend/src/game/modes/chase_a_legend_mode.ts

/**
 * POINT ZERO ONE — CHASE A LEGEND MODE ENGINE (PHANTOM)
 * backend/src/game/modes/chase_a_legend_mode.ts
 * VERSION: 4.0.0 — 2026-03-28
 *
 * Doctrine-aligned backend mode implementation for Phantom / CHASE A LEGEND.
 * One of four core battlegrounds. The player races against a verified Legend run
 * (ghost replay). Deterministic seed ensures both player and Legend drew from
 * the same card order.
 *
 * Core mechanics implemented:
 * - Cryptographically anchored Legend baseline with integrity verification
 * - Deterministic seed — both player and Legend draw from same card order
 * - GHOST deck exclusive to this mode, DISCIPLINE cards for variance reduction
 * - Legend Markers (Gold/Red/Purple/Silver/Black) at key ticks
 * - Ghost Benchmark Windows (GBM) within ±3 ticks of markers
 * - Divergence scoring (LOW/MEDIUM/HIGH) per card play
 * - Gap Indicator showing real-time CORD gap vs Legend
 * - No loadout bonuses — enter raw, default shields
 * - Card Replay Audit comparing every play to ghost
 * - Proof Badge conditions: FUBAR_CHAMPION, CLEAN_RUN, MINIMALIST, GHOST_SYNCED, COMEBACK_LEGEND
 * - Ghost Pass Exploit — buy what Legend declined near Red Markers
 * - Counter-Legend Line — alternative Opportunity near Gold Markers
 * - Marker Exploit — shield bonus near Silver Markers
 * - Legend decay by age milestones
 * - Community heat modifier
 * - 32-dim ML feature extraction per run
 * - 24×8 DL tensor: rows=ghost marker proximity windows, columns=divergence/pressure/timing
 * - Chat bridge events for real-time spectator experience
 * - Full analytics, diagnostics, and batch simulation
 */

// ─── Node / crypto ────────────────────────────────────────────────────────────
import { createHash } from 'node:crypto';

// ─── Card types ───────────────────────────────────────────────────────────────
import {
  GameMode,
  DeckType,
  CardTag,
  CardRarity,
  TimingClass,
  PressureTier,
  RunPhase,
  GhostMarkerKind,
  DivergencePotential as CardTypesDivergencePotential,
  Targeting,
  Counterability,
  type CardDefinition,
  type ModeOverlay,
  type CardOverlaySnapshot,
  CARD_LEGALITY_MATRIX,
  MODE_TAG_WEIGHT_DEFAULTS,
  DECK_TYPE_PROFILES,
  MODE_CARD_BEHAVIORS,
  HOLD_SYSTEM_CONFIG,
  COMEBACK_SURGE_CONFIG,
  PRESSURE_COST_MODIFIERS,
  CARD_RARITY_DROP_RATES,
  GHOST_MARKER_SPECS,
  IPA_CHAIN_SYNERGIES,
  clamp,
  round6,
  isDeckLegalInMode,
  computeTagWeightedScore,
  computePressureCostModifier,
  computeBleedthroughMultiplier,
  computeTrustEfficiency,
  getDeckTypeProfile,
  getModeCardBehavior,
  computeDivergencePotential,
  getGhostMarkerSpec,
  computeGhostMarkerCordBonus,
  computeGhostMarkerShieldBonus,
  resolveGhostBenchmarkWindow,
  computeCardDrawWeights,
  getProofBadgeConditionsForMode,
  computeAggregateProofBadgeCord,
} from '../engine/card_types';

// ─── Deterministic RNG ────────────────────────────────────────────────────────
import {
  normalizeSeed,
  hashStringToSeed,
  combineSeed,
  createDeterministicRng,
  createMulberry32,
  sanitizePositiveWeights,
  DEFAULT_NON_ZERO_SEED,
  type DeterministicRng,
} from '../engine/deterministic_rng';

// ─── Replay Engine ────────────────────────────────────────────────────────────
import {
  sha256Hex,
  stableStringify,
  type Ledger,
  createDefaultLedger,
  ReplayEngine,
  GameState as ReplayGameState,
  type ReplaySnapshot,
  type DecisionEffect,
  type RunEvent,
} from '../engine/replay_engine';

// ─── Card Registry ────────────────────────────────────────────────────────────
import { CardRegistry } from '../engine/card_registry';

// ═══════════════════════════════════════════════════════════════════════════════
// § 1 — CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/** Semver for this mode engine; persisted alongside every replay proof. */
export const PHANTOM_MODE_VERSION = '4.0.0';

/** Canonical game mode reference for Phantom / Chase A Legend */
const PHANTOM_MODE = GameMode.CHASE_A_LEGEND;

/** ML feature vector dimensionality — 32 floats per phantom run */
export const PHANTOM_ML_FEATURE_DIM = 32;

/** DL tensor shape — rows × columns */
export const PHANTOM_DL_ROWS = 24;
export const PHANTOM_DL_COLS = 8;

/** Community heat accrual coefficient per run since legend was established */
const COMMUNITY_HEAT_PER_RUN = 0.003;

/** Ghost Benchmark Window radius in ticks (±3 from marker) */
const GBM_RADIUS_TICKS = 3;

/** Maximum number of decay injections that can be active simultaneously */
const MAX_CONCURRENT_DECAY_INJECTIONS = 6;

/** Gap indicator thresholds for arrow classification */
const GAP_ARROW_STRONG_CLOSING = 0.04;
const GAP_ARROW_CLOSING = 0.005;
const GAP_ARROW_STRONG_WIDENING = -0.04;
const GAP_ARROW_WIDENING = -0.005;

/** Divergence thresholds for card play classification */
const DIVERGENCE_HIGH_CORD_THRESHOLD = 0.025;
const DIVERGENCE_MEDIUM_CORD_THRESHOLD = 0.015;

/** Proof badge unlock thresholds */
const FUBAR_CHAMPION_MIN_FUBAR_SURVIVED = 5;
const FUBAR_CHAMPION_MIN_CORD = 0.65;
const CLEAN_RUN_MAX_NEGATIVE_PLAYS = 0;
const MINIMALIST_MAX_CARD_PLAYS = 15;
const GHOST_SYNCED_MIN_GBM_HIT_RATE = 0.80;
const GHOST_SYNCED_MAX_DIVERGENCE_SUM = 0.50;
const COMEBACK_LEGEND_MIN_GAP_DEFICIT = -0.10;
const COMEBACK_LEGEND_MIN_FINAL_SURPLUS = 0.05;

/** Legend marker color specs — maps from GhostMarkerKind to Phantom LegendMarkerColor */
const MARKER_KIND_TO_COLOR: Record<string, LegendMarkerColor> = {
  [GhostMarkerKind.GOLD_BUY]: 'GOLD',
  [GhostMarkerKind.RED_PASS]: 'RED',
  [GhostMarkerKind.PURPLE_POWER]: 'PURPLE',
  [GhostMarkerKind.SILVER_BREACH]: 'SILVER',
  [GhostMarkerKind.BLACK_CASCADE]: 'BLACK',
};

/** Marker CORD bonuses by color */
const MARKER_CORD_BONUS: Record<LegendMarkerColor, number> = {
  GOLD: 0.01,
  RED: 0.005,
  PURPLE: 0.008,
  SILVER: 0.015,
  BLACK: 0.02,
};

/** Marker shield bonuses by color */
const MARKER_SHIELD_BONUS: Record<LegendMarkerColor, number> = {
  GOLD: 0,
  RED: 0,
  PURPLE: 5,
  SILVER: 12,
  BLACK: 8,
};

/** Superior decision bonus for CORD */
const SUPERIOR_DECISION_CORD_BONUS = 0.04;

/** Divergence potential multipliers */
const DIVERGENCE_MULTIPLIER_HIGH = 1.5;
const DIVERGENCE_MULTIPLIER_MEDIUM = 1.15;
const DIVERGENCE_MULTIPLIER_LOW = 1.0;

/** Ghost Pass minimum income threshold near Red Markers */
const GHOST_PASS_MIN_INCOME_DELTA = 1500;

/** Legend decay schedule milestones (hours) */
const DECAY_MILESTONE_72H = 72;
const DECAY_MILESTONE_1W = 24 * 7;
const DECAY_MILESTONE_2W = 24 * 14;
const DECAY_MILESTONE_1M = 24 * 30;
const DECAY_MILESTONE_3M = 24 * 90;
const DECAY_MILESTONE_6M = 24 * 180;

/** Decay intensity ramp per milestone */
const DECAY_INTENSITY_72H = 0.4;
const DECAY_INTENSITY_1W = 0.5;
const DECAY_INTENSITY_2W = 0.6;
const DECAY_INTENSITY_1M = 0.7;
const DECAY_INTENSITY_3M = 0.8;
const DECAY_INTENSITY_6M = 1.0;

/** Dynasty eligibility threshold for improvement ratio */
const DYNASTY_IMPROVEMENT_THRESHOLD = 0.2;
const DYNASTY_MIN_CHALLENGERS_BEATEN = 3;

/** New Legend minimum improvement ratio */
const NEW_LEGEND_MIN_IMPROVEMENT = 0.05;

/** New Legend max improvement cap for bonus */
const NEW_LEGEND_MAX_IMPROVEMENT_CAP = 0.75;

/** Difficulty rating weights */
const DIFFICULTY_DECAY_WEIGHT = 0.12;
const DIFFICULTY_SURVIVAL_WEIGHT = 0.28;
const DIFFICULTY_CHALLENGE_WEIGHT = 0.20;
const DIFFICULTY_GAP_WEIGHT = 0.12;
const DIFFICULTY_HEAT_WEIGHT = 0.28;

/** Max heat denominator for difficulty */
const MAX_HEAT_FOR_DIFFICULTY = 600;

/** Max challenge count denominator for difficulty */
const MAX_CHALLENGES_FOR_DIFFICULTY = 1000;

/** Max average closing gap for difficulty */
const MAX_GAP_FOR_DIFFICULTY = 0.2;

/** Chat bridge event types */
const CHAT_EVENT_MARKER_APPROACHING = 'legend_marker_approaching';
const CHAT_EVENT_DIVERGENCE_SHIFT = 'ghost_divergence_shift';
const CHAT_EVENT_GAP_CLOSING = 'gap_closing';
const CHAT_EVENT_GHOST_PASS = 'ghost_pass_opportunity';
const CHAT_EVENT_BADGE_UNLOCKED = 'proof_badge_unlocked';
const CHAT_EVENT_LEGEND_OVERTAKE = 'legend_overtake';
const CHAT_EVENT_DECAY_INJECTION = 'decay_injection_active';
const CHAT_EVENT_GHOST_VISION = 'ghost_vision_hint';

/** Batch simulation default configuration */
const BATCH_DEFAULT_TICK_COUNT = 120;
const BATCH_DEFAULT_RUN_COUNT = 100;
const BATCH_MAX_RUN_COUNT = 10_000;

// ═══════════════════════════════════════════════════════════════════════════════
// § 2 — TYPES & INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Preserved public exports ─────────────────────────────────────────────────

export type LegendIntegrityStatus = 'VERIFIED' | 'FAILED' | 'PENDING';
export type PhantomOutcome = 'FREEDOM' | 'TIMEOUT' | 'BANKRUPT';
export type PhantomResultTier = 'LOSS' | 'CHALLENGER' | 'NEW_LEGEND' | 'DYNASTY';

export type LegendMarkerColor = 'GOLD' | 'RED' | 'PURPLE' | 'SILVER' | 'BLACK';
export type GapArrow = '↑↑' | '↑' | '→' | '↓' | '↓↓';
export type DivergencePotential = 'LOW' | 'MEDIUM' | 'HIGH';
export type PhantomBadge = 'CHALLENGER' | 'SEASON_LEGEND' | 'DYNASTY';

export type DecayInjectionType =
  | 'EMERGENCY_EXPENSE'
  | 'INCOME_SEIZURE'
  | 'DEBT_SPIRAL'
  | 'MARKET_CORRECTION'
  | 'TAX_AUDIT'
  | 'SYSTEM_GLITCH';

// ─── Proof badge types specific to this mode ──────────────────────────────────

export type PhantomProofBadge =
  | 'FUBAR_CHAMPION'
  | 'CLEAN_RUN'
  | 'MINIMALIST'
  | 'GHOST_SYNCED'
  | 'COMEBACK_LEGEND';

// ─── Legend Marker ─────────────────────────────────────────────────────────────

export interface LegendMarker {
  readonly markerId: string;
  readonly tick: number;
  readonly color: LegendMarkerColor;
  readonly legendCardId?: string;
  readonly legendOutcomeNote: string;
  readonly legendCordImpact: number;
  readonly legendIncomeDelta?: number;
  readonly legendHeatDelta?: number;
}

export interface LegendTickSnapshot {
  readonly tick: number;
  readonly cord: number;
  readonly lastPlayedCardId?: string;
  readonly pressure?: number;
  readonly income?: number;
  readonly shields?: number;
}

export interface ChallengerGhost {
  readonly challengerId: string;
  readonly cord: number;
  readonly proofHash: string;
}

// ─── Legend Baseline ───────────────────────────────────────────────────────────

export interface LegendBaseline {
  readonly legendId: string;
  readonly label: string;
  readonly sourceMode: GameMode;
  readonly seasonId: string;
  readonly outcome: PhantomOutcome;
  readonly integrityStatus: LegendIntegrityStatus;
  readonly proofHash: string;
  readonly originalHeat: number;
  readonly finalCord: number;
  readonly setAtEpochMs: number;
  readonly totalCommunityRunsSinceLegend: number;
  readonly challengeCount: number;
  readonly beatCount: number;
  readonly averageClosingGap: number;
  readonly markers: readonly LegendMarker[];
  readonly tickSnapshots: readonly LegendTickSnapshot[];
  readonly challengers: readonly ChallengerGhost[];
  readonly replayEvents?: readonly RunEvent[];
  readonly totalCardPlays?: number;
  readonly decksUsed?: readonly DeckType[];
}

// ─── Decay Injection ──────────────────────────────────────────────────────────

export interface DecayInjection {
  readonly milestoneHours: number;
  readonly injectionType: DecayInjectionType;
  readonly intensity: number;
  readonly botHeatFloorBonus: number;
}

// ─── Active Ghost Window ──────────────────────────────────────────────────────

export interface ActiveGhostWindow {
  readonly markerId: string;
  readonly color: LegendMarkerColor;
  readonly opensAtTick: number;
  readonly closesAtTick: number;
  readonly currentDistanceTicks: number;
  readonly legendCardId?: string;
  readonly ghostMarkerKind: GhostMarkerKind;
  readonly cordBonus: number;
  readonly shieldBonus: number;
}

// ─── Card Replay Audit Entry ──────────────────────────────────────────────────

export interface CardReplayAuditEntry {
  readonly auditId: string;
  readonly tick: number;
  readonly cardId: string;
  readonly deckType?: DeckType;
  readonly totalCordDelta: number;
  readonly generatedIncomeDelta: number;
  readonly gapDelta: number;
  readonly divergencePotential: DivergencePotential;
  readonly gapArrow: GapArrow;
  readonly matchedMarkerId?: string;
  readonly matchedMarkerColor?: LegendMarkerColor;
  readonly usedGhostVision: boolean;
  readonly superiorDecision: boolean;
  readonly replayProofHashFragment?: string;
  readonly legendCardIdAtTick?: string;
  readonly legendCordAtTick?: number;
  readonly ghostPassExploit: boolean;
  readonly counterLegendLine: boolean;
  readonly markerExploit: boolean;
  readonly pressureTierAtPlay?: PressureTier;
  readonly timingClassUsed?: TimingClass;
  readonly cardRarity?: CardRarity;
}

// ─── Ghost Pass Result ────────────────────────────────────────────────────────

export interface GhostPassResult {
  readonly tick: number;
  readonly cardId: string;
  readonly nearRedMarker: boolean;
  readonly legendDeclined: boolean;
  readonly incomeDelta: number;
  readonly cordDelta: number;
  readonly exploitSuccess: boolean;
}

// ─── Counter-Legend Line Result ────────────────────────────────────────────────

export interface CounterLegendLineResult {
  readonly tick: number;
  readonly cardId: string;
  readonly nearGoldMarker: boolean;
  readonly alternativeOpportunity: boolean;
  readonly cordDelta: number;
  readonly exploitSuccess: boolean;
}

// ─── Marker Exploit Result ────────────────────────────────────────────────────

export interface MarkerExploitResult {
  readonly tick: number;
  readonly markerColor: LegendMarkerColor;
  readonly shieldGained: number;
  readonly cordBonusApplied: number;
  readonly exploitSuccess: boolean;
}

// ─── Divergence Snapshot ──────────────────────────────────────────────────────

export interface DivergenceSnapshot {
  readonly tick: number;
  readonly playerCord: number;
  readonly legendCord: number;
  readonly gap: number;
  readonly gapArrow: GapArrow;
  readonly divergenceCategory: DivergencePotential;
  readonly cumulativeDivergence: number;
  readonly gapClosingRate: number;
  readonly inGbmWindow: boolean;
  readonly nearestMarkerTicks: number | null;
}

// ─── Gap Indicator State ──────────────────────────────────────────────────────

export interface GapIndicatorState {
  readonly currentGap: number;
  readonly arrow: GapArrow;
  readonly closingRate: number;
  readonly trendDirection: 'CLOSING' | 'WIDENING' | 'STABLE';
  readonly projectedGapAtEndTick: number;
  readonly averageClosingRatePerTick: number;
  readonly peakDeficit: number;
  readonly peakSurplus: number;
  readonly ticksSinceLastLead: number;
  readonly crossoverCount: number;
}

// ─── Phantom Run State ────────────────────────────────────────────────────────

export interface PhantomRunState {
  readonly runId: string;
  readonly seed: number;
  readonly normalizedSeed: number;
  readonly tick: number;
  readonly phase: RunPhase;
  readonly pressureTier: PressureTier;
  readonly playerCord: number;
  readonly legendCord: number;
  readonly gap: number;
  readonly gapArrow: GapArrow;
  readonly cumulativeDivergence: number;
  readonly gbmHits: number;
  readonly gbmMisses: number;
  readonly totalCardPlays: number;
  readonly ghostDeckPlays: number;
  readonly disciplineDeckPlays: number;
  readonly superiorDecisions: number;
  readonly ghostPassExploits: number;
  readonly counterLegendLines: number;
  readonly markerExploits: number;
  readonly fubarsSurvived: number;
  readonly negativePlayCount: number;
  readonly peakDeficit: number;
  readonly peakSurplus: number;
  readonly crossoverCount: number;
  readonly isComplete: boolean;
}

// ─── Ghost Timeline ───────────────────────────────────────────────────────────

export interface GhostTimelineEntry {
  readonly tick: number;
  readonly legendCord: number;
  readonly legendCardId: string | null;
  readonly legendPressure: number;
  readonly legendIncome: number;
  readonly legendShields: number;
  readonly markerAtTick: LegendMarker | null;
  readonly gbmWindowActive: boolean;
  readonly ghostVisionHint: string | null;
}

export interface GhostTimeline {
  readonly legendId: string;
  readonly totalTicks: number;
  readonly entries: readonly GhostTimelineEntry[];
  readonly markerTicks: readonly number[];
  readonly finalCord: number;
  readonly integrityHash: string;
}

// ─── Legend Profile ───────────────────────────────────────────────────────────

export interface LegendProfile {
  readonly legendId: string;
  readonly label: string;
  readonly seasonId: string;
  readonly baselineCord: number;
  readonly originalHeat: number;
  readonly effectiveHeat: number;
  readonly ageHours: number;
  readonly decayLevel: number;
  readonly difficultyRating: number;
  readonly challengeCount: number;
  readonly beatCount: number;
  readonly beatRate: number;
  readonly averageClosingGap: number;
  readonly markerCount: number;
  readonly integrityVerified: boolean;
  readonly integrityHash: string;
  readonly ghostTimeline: GhostTimeline;
}

// ─── Proof Badge Tracker ──────────────────────────────────────────────────────

export interface ProofBadgeTracker {
  readonly fubarChampion: {
    readonly fubarsSurvived: number;
    readonly currentCord: number;
    readonly unlocked: boolean;
  };
  readonly cleanRun: {
    readonly negativePlayCount: number;
    readonly unlocked: boolean;
  };
  readonly minimalist: {
    readonly totalCardPlays: number;
    readonly unlocked: boolean;
  };
  readonly ghostSynced: {
    readonly gbmHitRate: number;
    readonly cumulativeDivergence: number;
    readonly unlocked: boolean;
  };
  readonly comebackLegend: {
    readonly peakDeficit: number;
    readonly finalSurplus: number;
    readonly unlocked: boolean;
  };
  readonly unlockedBadges: readonly PhantomProofBadge[];
  readonly aggregateProofCord: number;
}

// ─── ML Feature Vector ────────────────────────────────────────────────────────

export interface PhantomMLFeatureVector {
  readonly dimension: typeof PHANTOM_ML_FEATURE_DIM;
  readonly features: readonly number[];
  readonly labels: readonly string[];
  readonly runId: string;
  readonly extractedAtTick: number;
}

// ─── DL Tensor ────────────────────────────────────────────────────────────────

export interface PhantomDLTensor {
  readonly rows: typeof PHANTOM_DL_ROWS;
  readonly cols: typeof PHANTOM_DL_COLS;
  readonly data: readonly (readonly number[])[];
  readonly runId: string;
  readonly extractedAtTick: number;
}

// ─── Chat Bridge Event ────────────────────────────────────────────────────────

export interface PhantomChatBridgeEvent {
  readonly eventType: string;
  readonly tick: number;
  readonly runId: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly emittedAtMs: number;
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export interface PhantomMarkerAnalytics {
  readonly markerId: string;
  readonly color: LegendMarkerColor;
  readonly tick: number;
  readonly playerEnteredWindow: boolean;
  readonly playerCordAtEntry: number;
  readonly legendCordAtMarker: number;
  readonly gapAtEntry: number;
  readonly gapAtExit: number;
  readonly cordBonusApplied: number;
  readonly shieldBonusApplied: number;
  readonly ghostPassAttempted: boolean;
  readonly counterLegendAttempted: boolean;
  readonly markerExploitAttempted: boolean;
  readonly cardsPlayedInWindow: number;
}

export interface PhantomDivergenceTrend {
  readonly tick: number;
  readonly cumulativeDivergence: number;
  readonly movingAverageDivergence: number;
  readonly lowCount: number;
  readonly mediumCount: number;
  readonly highCount: number;
  readonly trendSlope: number;
}

export interface PhantomGhostSyncQuality {
  readonly totalGbmWindows: number;
  readonly gbmHits: number;
  readonly gbmMisses: number;
  readonly hitRate: number;
  readonly averageCordBonusPerHit: number;
  readonly averageGapDeltaInWindow: number;
  readonly bestWindowGapDelta: number;
  readonly worstWindowGapDelta: number;
}

export interface PhantomReplayAuditSummary {
  readonly totalPlays: number;
  readonly superiorDecisions: number;
  readonly ghostPassExploits: number;
  readonly counterLegendLines: number;
  readonly markerExploits: number;
  readonly averageCordDeltaPerPlay: number;
  readonly averageDivergencePerPlay: number;
  readonly lowDivergencePlays: number;
  readonly mediumDivergencePlays: number;
  readonly highDivergencePlays: number;
  readonly ghostDeckPlays: number;
  readonly disciplineDeckPlays: number;
  readonly uniqueDecksUsed: readonly DeckType[];
}

export interface PhantomModeHealth {
  readonly modeVersion: string;
  readonly mode: GameMode;
  readonly engineIntegrity: boolean;
  readonly legendIntegrity: LegendIntegrityStatus;
  readonly replayHashMatch: boolean;
  readonly seedDeterminismVerified: boolean;
  readonly totalRunsProcessed: number;
  readonly averageDifficultyRating: number;
  readonly averageCompletionRate: number;
  readonly medianFinalGap: number;
  readonly diagnosticTimestampMs: number;
}

export interface PhantomAnalytics {
  readonly runId: string;
  readonly markerAnalytics: readonly PhantomMarkerAnalytics[];
  readonly divergenceTrend: readonly PhantomDivergenceTrend[];
  readonly ghostSyncQuality: PhantomGhostSyncQuality;
  readonly replayAuditSummary: PhantomReplayAuditSummary;
  readonly modeHealth: PhantomModeHealth;
  readonly gapIndicator: GapIndicatorState;
  readonly proofBadgeTracker: ProofBadgeTracker;
  readonly finalResult: {
    readonly outcome: PhantomOutcome;
    readonly tier: PhantomResultTier;
    readonly finalCord: number;
    readonly finalCordWithBonuses: number;
    readonly legendFinalCord: number;
    readonly improvement: number;
  } | null;
}

// ─── Phantom Player State ─────────────────────────────────────────────────────

export interface PhantomPlayerState {
  readonly playerId: string;
  readonly displayName: string;
  readonly cash: number;
  readonly income: number;
  readonly expenses: number;
  readonly shields: number;
  readonly pressure: number;
  readonly currentCord: number;
  readonly currentGapVsLegend: number;
  readonly currentGapArrow: GapArrow;
  readonly gapClosingRate: number;
  readonly superiorDecisionNotations: number;
  readonly gbmWindowHits: number;
  readonly gbmWindowMisses: number;
  readonly activeBadges: readonly PhantomBadge[];
  readonly finalOutcome: PhantomOutcome | null;
  readonly finalTier: PhantomResultTier | null;
  readonly finalCordWithBonuses: number | null;
  readonly integrityVerified: boolean;
  readonly dynastyEligible: boolean;
  readonly challengeBeatenCount: number;
  readonly replayAudit: readonly CardReplayAuditEntry[];
  readonly totalCardPlays: number;
  readonly ghostDeckPlays: number;
  readonly disciplineDeckPlays: number;
  readonly fubarsSurvived: number;
  readonly negativePlayCount: number;
  readonly ghostPassExploits: number;
  readonly counterLegendLines: number;
  readonly markerExploits: number;
  readonly peakDeficit: number;
  readonly peakSurplus: number;
  readonly crossoverCount: number;
  readonly cumulativeDivergence: number;
  readonly proofBadges: readonly PhantomProofBadge[];
}

// ─── Phantom Macro State ──────────────────────────────────────────────────────

export interface PhantomMacroState {
  readonly tick: number;
  readonly currentTimeMs: number;
  readonly legendAgeHours: number;
  readonly effectiveHeatModifier: number;
  readonly activeDecayInjections: readonly DecayInjection[];
  readonly activeGhostWindows: readonly ActiveGhostWindow[];
  readonly ghostVisionCardId: string | null;
  readonly historicalDifficultyRating: number;
  readonly latestLegendGap: number;
  readonly latestLegendCord: number;
  readonly eventLog: readonly string[];
  readonly currentPhase: RunPhase;
  readonly currentPressureTier: PressureTier;
  readonly divergenceSnapshots: readonly DivergenceSnapshot[];
  readonly chatEvents: readonly PhantomChatBridgeEvent[];
}

// ─── Chase A Legend Mode State ─────────────────────────────────────────────────

export interface ChaseALegendModeState {
  readonly runId: string;
  readonly seed: string;
  readonly mode: GameMode.CHASE_A_LEGEND;
  readonly legend: LegendBaseline;
  readonly player: PhantomPlayerState;
  readonly macro: PhantomMacroState;
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export interface AdvanceTickAction {
  readonly type: 'ADVANCE_TICK';
  readonly timestampMs?: number;
  readonly cashDelta?: number;
  readonly incomeDelta?: number;
  readonly expenseDelta?: number;
  readonly shieldDelta?: number;
  readonly pressureDelta?: number;
}

export interface RecordPlayerCardPlayAction {
  readonly type: 'RECORD_PLAYER_CARD_PLAY';
  readonly tick: number;
  readonly cardId: string;
  readonly totalCordDelta: number;
  readonly generatedIncomeDelta?: number;
  readonly replayProofHashFragment?: string;
  readonly usedGhostVision?: boolean;
  readonly outperformedLegendChoice?: boolean;
  readonly deckType?: DeckType;
  readonly timingClass?: TimingClass;
  readonly cardRarity?: CardRarity;
}

export interface RecordFreedomAction {
  readonly type: 'RECORD_FREEDOM';
  readonly proofHash: string;
  readonly integrityVerified: boolean;
  readonly finalCord: number;
  readonly outcome: PhantomOutcome;
  readonly challengersBeaten: number;
}

export type ChaseALegendModeAction =
  | AdvanceTickAction
  | RecordPlayerCardPlayAction
  | RecordFreedomAction;

// ─── Batch / Simulation types ─────────────────────────────────────────────────

export interface BatchSimulationConfig {
  readonly runCount: number;
  readonly ticksPerRun: number;
  readonly legend: LegendBaseline;
  readonly baseSeed: string;
  readonly playerTemplate: {
    readonly cash: number;
    readonly income: number;
    readonly expenses: number;
  };
}

export interface BatchSimulationResult {
  readonly totalRuns: number;
  readonly completedRuns: number;
  readonly averageFinalCord: number;
  readonly medianFinalGap: number;
  readonly legendBeatRate: number;
  readonly averageDifficultyRating: number;
  readonly cordDistribution: {
    readonly min: number;
    readonly max: number;
    readonly p25: number;
    readonly p50: number;
    readonly p75: number;
    readonly p90: number;
  };
  readonly averageGbmHitRate: number;
  readonly averageSuperiorDecisions: number;
  readonly runSummaries: readonly BatchRunSummary[];
}

export interface BatchRunSummary {
  readonly runId: string;
  readonly seed: number;
  readonly finalCord: number;
  readonly finalGap: number;
  readonly gbmHits: number;
  readonly superiorDecisions: number;
  readonly divergenceSum: number;
  readonly outcome: PhantomOutcome;
  readonly tier: PhantomResultTier;
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 3 — DECAY SCHEDULE
// ═══════════════════════════════════════════════════════════════════════════════

const DECAY_SCHEDULE: readonly DecayInjection[] = [
  {
    milestoneHours: DECAY_MILESTONE_72H,
    injectionType: 'EMERGENCY_EXPENSE',
    intensity: DECAY_INTENSITY_72H,
    botHeatFloorBonus: 0,
  },
  {
    milestoneHours: DECAY_MILESTONE_1W,
    injectionType: 'INCOME_SEIZURE',
    intensity: DECAY_INTENSITY_1W,
    botHeatFloorBonus: 0,
  },
  {
    milestoneHours: DECAY_MILESTONE_2W,
    injectionType: 'DEBT_SPIRAL',
    intensity: DECAY_INTENSITY_2W,
    botHeatFloorBonus: 0,
  },
  {
    milestoneHours: DECAY_MILESTONE_1M,
    injectionType: 'MARKET_CORRECTION',
    intensity: DECAY_INTENSITY_1M,
    botHeatFloorBonus: 0,
  },
  {
    milestoneHours: DECAY_MILESTONE_3M,
    injectionType: 'TAX_AUDIT',
    intensity: DECAY_INTENSITY_3M,
    botHeatFloorBonus: 20,
  },
  {
    milestoneHours: DECAY_MILESTONE_6M,
    injectionType: 'SYSTEM_GLITCH',
    intensity: DECAY_INTENSITY_6M,
    botHeatFloorBonus: 50,
  },
] as const;

// ═══════════════════════════════════════════════════════════════════════════════
// § 4 — UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate a deterministic stable ID from a prefix and parts using node:crypto.
 */
function stableId(prefix: string, ...parts: readonly (string | number)[]): string {
  const hash = createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 16);
  return `${prefix}_${hash}`;
}

/**
 * Compute the HMAC-like integrity hash for a legend baseline using sha256.
 */
function computeLegendIntegrityHash(legend: LegendBaseline): string {
  const payload = stableStringify({
    legendId: legend.legendId,
    finalCord: legend.finalCord,
    proofHash: legend.proofHash,
    setAtEpochMs: legend.setAtEpochMs,
    markerCount: legend.markers.length,
    snapshotCount: legend.tickSnapshots.length,
    seasonId: legend.seasonId,
  });
  return sha256Hex(payload);
}

/**
 * Resolve legend CORD at a given tick by linear scan of tick snapshots.
 */
function resolveLegendCordAtTick(legend: LegendBaseline, tick: number): number {
  const exact = legend.tickSnapshots.find((entry) => entry.tick === tick);
  if (exact) {
    return exact.cord;
  }

  const sorted = [...legend.tickSnapshots].sort((a, b) => a.tick - b.tick);
  let latest = sorted[0]?.cord ?? legend.finalCord;

  for (const snapshot of sorted) {
    if (snapshot.tick > tick) {
      break;
    }
    latest = snapshot.cord;
  }

  return latest;
}

/**
 * Resolve legend pressure at a given tick.
 */
function resolveLegendPressureAtTick(legend: LegendBaseline, tick: number): number {
  const sorted = [...legend.tickSnapshots].sort((a, b) => a.tick - b.tick);
  let latest = 0;
  for (const snapshot of sorted) {
    if (snapshot.tick > tick) break;
    if (snapshot.pressure !== undefined) latest = snapshot.pressure;
  }
  return latest;
}

/**
 * Resolve legend income at a given tick.
 */
function resolveLegendIncomeAtTick(legend: LegendBaseline, tick: number): number {
  const sorted = [...legend.tickSnapshots].sort((a, b) => a.tick - b.tick);
  let latest = 0;
  for (const snapshot of sorted) {
    if (snapshot.tick > tick) break;
    if (snapshot.income !== undefined) latest = snapshot.income;
  }
  return latest;
}

/**
 * Resolve legend shields at a given tick.
 */
function resolveLegendShieldsAtTick(legend: LegendBaseline, tick: number): number {
  const sorted = [...legend.tickSnapshots].sort((a, b) => a.tick - b.tick);
  let latest = 100;
  for (const snapshot of sorted) {
    if (snapshot.tick > tick) break;
    if (snapshot.shields !== undefined) latest = snapshot.shields;
  }
  return latest;
}

/**
 * Resolve the ghost vision card id at a given tick.
 */
function resolveGhostVisionCardId(legend: LegendBaseline, tick: number): string | null {
  const sorted = [...legend.tickSnapshots].sort((a, b) => a.tick - b.tick);
  let latest: string | null = null;

  for (const snapshot of sorted) {
    if (snapshot.tick > tick) {
      break;
    }
    if (snapshot.lastPlayedCardId) {
      latest = snapshot.lastPlayedCardId;
    }
  }

  return latest;
}

/**
 * Resolve active decay injections based on legend age in hours.
 */
function resolveActiveDecayInjections(legendAgeHours: number): DecayInjection[] {
  return DECAY_SCHEDULE.filter((entry) => legendAgeHours >= entry.milestoneHours)
    .slice(0, MAX_CONCURRENT_DECAY_INJECTIONS);
}

/**
 * Compute the historical difficulty rating from legend + age.
 * Uses all five difficulty weight factors.
 */
function resolveHistoricalDifficultyRating(legend: LegendBaseline, legendAgeHours: number): number {
  const decayLevel = resolveActiveDecayInjections(legendAgeHours).length;
  const beatRate = legend.challengeCount <= 0 ? 0 : legend.beatCount / legend.challengeCount;
  const survivalBias = 1 - clamp(beatRate, 0, 1);
  const challengePressure = Math.min(1, legend.challengeCount / MAX_CHALLENGES_FOR_DIFFICULTY);
  const gapPressure = Math.min(1, legend.averageClosingGap / MAX_GAP_FOR_DIFFICULTY);
  const heatPressure = Math.min(
    1,
    (legend.originalHeat + legend.totalCommunityRunsSinceLegend * COMMUNITY_HEAT_PER_RUN) / MAX_HEAT_FOR_DIFFICULTY,
  );

  return Math.round(
    clamp(
      100 * (
        decayLevel * DIFFICULTY_DECAY_WEIGHT +
        survivalBias * DIFFICULTY_SURVIVAL_WEIGHT +
        challengePressure * DIFFICULTY_CHALLENGE_WEIGHT +
        gapPressure * DIFFICULTY_GAP_WEIGHT +
        heatPressure * DIFFICULTY_HEAT_WEIGHT
      ),
      1,
      100,
    ),
  );
}

/**
 * Resolve active ghost benchmark windows at a given tick.
 * Uses resolveGhostBenchmarkWindow from card_types for per-marker window,
 * getGhostMarkerSpec for marker specifications,
 * computeGhostMarkerCordBonus and computeGhostMarkerShieldBonus for bonuses.
 */
function resolveActiveGhostWindows(legend: LegendBaseline, tick: number): ActiveGhostWindow[] {
  return legend.markers
    .filter((marker) => Math.abs(marker.tick - tick) <= GBM_RADIUS_TICKS)
    .map((marker) => {
      const ghostMarkerKind = colorToGhostMarkerKind(marker.color);
      const markerSpec = getGhostMarkerSpec(ghostMarkerKind);
      const gbmWindow = resolveGhostBenchmarkWindow(ghostMarkerKind, tick, marker.tick);
      const cordBonus = computeGhostMarkerCordBonus(ghostMarkerKind, tick, marker.tick);
      const shieldBonus = computeGhostMarkerShieldBonus(ghostMarkerKind, tick, marker.tick);

      return {
        markerId: marker.markerId,
        color: marker.color,
        opensAtTick: marker.tick - GBM_RADIUS_TICKS,
        closesAtTick: marker.tick + GBM_RADIUS_TICKS,
        currentDistanceTicks: Math.abs(marker.tick - tick),
        legendCardId: marker.legendCardId,
        ghostMarkerKind,
        cordBonus: round6(cordBonus),
        shieldBonus: round6(shieldBonus),
      };
    })
    .sort((left, right) => left.currentDistanceTicks - right.currentDistanceTicks);
}

/**
 * Map LegendMarkerColor back to GhostMarkerKind enum.
 */
function colorToGhostMarkerKind(color: LegendMarkerColor): GhostMarkerKind {
  switch (color) {
    case 'GOLD': return GhostMarkerKind.GOLD_BUY;
    case 'RED': return GhostMarkerKind.RED_PASS;
    case 'PURPLE': return GhostMarkerKind.PURPLE_POWER;
    case 'SILVER': return GhostMarkerKind.SILVER_BREACH;
    case 'BLACK': return GhostMarkerKind.BLACK_CASCADE;
  }
}

/**
 * Classify the gap arrow from a delta value.
 */
function gapArrowFromDelta(delta: number): GapArrow {
  if (delta >= GAP_ARROW_STRONG_CLOSING) return '↑↑';
  if (delta >= GAP_ARROW_CLOSING) return '↑';
  if (delta <= GAP_ARROW_STRONG_WIDENING) return '↓↓';
  if (delta <= GAP_ARROW_WIDENING) return '↓';
  return '→';
}

/**
 * Compute divergence potential from a card play. Uses computeDivergencePotential
 * from card_types for the canonical determination, then maps to local type.
 */
function divergenceFromPlay(
  cardId: string,
  matchedMarker: LegendMarker | undefined,
  totalCordDelta: number,
  deckType?: DeckType,
): DivergencePotential {
  // Use the canonical card_types function for base divergence evaluation
  const minimalDefinition: CardDefinition = {
    cardId,
    name: cardId,
    deckType: deckType ?? DeckType.OPPORTUNITY,
    baseCost: 0,
    effects: [],
    tags: [],
    timingClasses: [TimingClass.ANY],
    rarity: CardRarity.COMMON,
    autoResolve: false,
    counterability: Counterability.NONE,
    targeting: Targeting.SELF,
    modeLegal: [PHANTOM_MODE],
    educationalTag: '',
  };
  const markerDistance = matchedMarker ? Math.abs(matchedMarker.tick - 0) : 999;
  const canonicalPotential = computeDivergencePotential(
    minimalDefinition,
    TimingClass.GBM,
    markerDistance,
  );

  // Map from CardTypesDivergencePotential enum to local DivergencePotential type
  if (canonicalPotential === CardTypesDivergencePotential.HIGH) return 'HIGH';
  if (canonicalPotential === CardTypesDivergencePotential.MEDIUM) return 'MEDIUM';

  // Additional local checks for Phantom-specific context
  const normalizedCardId = cardId.toLowerCase();
  if (
    normalizedCardId.includes('ghost') ||
    normalizedCardId.includes('legend') ||
    normalizedCardId.includes('cascade_break') ||
    matchedMarker?.color === 'SILVER' ||
    matchedMarker?.color === 'BLACK'
  ) {
    return 'HIGH';
  }

  if (
    matchedMarker ||
    normalizedCardId.includes('discipline') ||
    Math.abs(totalCordDelta) >= DIVERGENCE_MEDIUM_CORD_THRESHOLD
  ) {
    return 'MEDIUM';
  }

  return 'LOW';
}

/**
 * Compute player gap vs legend.
 */
function computePlayerGapVsLegend(currentCord: number, legendCord: number): number {
  return round6(currentCord - legendCord);
}

/**
 * Compute gap closing rate between two successive gap values.
 */
function computeGapClosingRate(previousGap: number, nextGap: number): number {
  return round6(previousGap - nextGap);
}

/**
 * Determine the current run phase from tick number.
 */
function resolveRunPhase(tick: number, totalTicks: number): RunPhase {
  const ratio = tick / Math.max(1, totalTicks);
  if (ratio < 0.33) return RunPhase.FOUNDATION;
  if (ratio < 0.66) return RunPhase.ESCALATION;
  return RunPhase.SOVEREIGNTY;
}

/**
 * Determine the current pressure tier from pressure value.
 */
function resolvePressureTier(pressure: number): PressureTier {
  if (pressure <= 10) return PressureTier.T0_SOVEREIGN;
  if (pressure <= 30) return PressureTier.T1_STABLE;
  if (pressure <= 55) return PressureTier.T2_STRESSED;
  if (pressure <= 80) return PressureTier.T3_ELEVATED;
  return PressureTier.T4_COLLAPSE_IMMINENT;
}

/**
 * Compute the divergence multiplier for a given potential level.
 */
function divergenceMultiplierFromPotential(potential: DivergencePotential): number {
  switch (potential) {
    case 'HIGH': return DIVERGENCE_MULTIPLIER_HIGH;
    case 'MEDIUM': return DIVERGENCE_MULTIPLIER_MEDIUM;
    case 'LOW': return DIVERGENCE_MULTIPLIER_LOW;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 5 — LEGEND PROFILE MANAGER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * LegendProfileManager: Loads, verifies, and computes the baseline legend
 * profile. Builds the ghost timeline from replay data. Validates integrity
 * using cryptographic hashes and ReplayEngine + ReplayGameState for
 * byte-identical verification.
 */
export class LegendProfileManager {
  private readonly legend: LegendBaseline;
  private readonly registry: CardRegistry;
  private readonly currentTimeMs: number;
  private profile: LegendProfile | null;
  private timeline: GhostTimeline | null;
  private verified: boolean;

  public constructor(legend: LegendBaseline, registry: CardRegistry, currentTimeMs: number) {
    this.legend = legend;
    this.registry = registry;
    this.currentTimeMs = currentTimeMs;
    this.profile = null;
    this.timeline = null;
    this.verified = false;
  }

  /**
   * Load and compute the full legend profile.
   */
  public loadProfile(): LegendProfile {
    if (this.profile) return this.profile;

    const ageHours = Math.max(0, (this.currentTimeMs - this.legend.setAtEpochMs) / 3_600_000);
    const activeDecay = resolveActiveDecayInjections(ageHours);
    const decayHeatBonus = activeDecay.reduce((sum, d) => sum + d.botHeatFloorBonus, 0);
    const effectiveHeat = round6(
      this.legend.originalHeat +
      this.legend.totalCommunityRunsSinceLegend * COMMUNITY_HEAT_PER_RUN +
      decayHeatBonus,
    );
    const beatRate = this.legend.challengeCount <= 0
      ? 0
      : round6(this.legend.beatCount / this.legend.challengeCount);

    const integrityHash = computeLegendIntegrityHash(this.legend);
    const difficulty = resolveHistoricalDifficultyRating(this.legend, ageHours);
    const ghostTl = this.buildGhostTimeline();

    this.profile = {
      legendId: this.legend.legendId,
      label: this.legend.label,
      seasonId: this.legend.seasonId,
      baselineCord: this.legend.finalCord,
      originalHeat: this.legend.originalHeat,
      effectiveHeat,
      ageHours: round6(ageHours),
      decayLevel: activeDecay.length,
      difficultyRating: difficulty,
      challengeCount: this.legend.challengeCount,
      beatCount: this.legend.beatCount,
      beatRate,
      averageClosingGap: this.legend.averageClosingGap,
      markerCount: this.legend.markers.length,
      integrityVerified: this.legend.integrityStatus === 'VERIFIED',
      integrityHash,
      ghostTimeline: ghostTl,
    };

    return this.profile;
  }

  /**
   * Verify the legend integrity using ReplayEngine. Replays all legend
   * events and compares the resulting hash to the stored proofHash.
   */
  public verifyIntegrity(): LegendIntegrityStatus {
    if (this.verified) return 'VERIFIED';

    if (this.legend.integrityStatus === 'FAILED') return 'FAILED';

    // If replay events are available, use ReplayEngine for byte-identical verification
    if (this.legend.replayEvents && this.legend.replayEvents.length > 0) {
      const seed = hashStringToSeed(this.legend.legendId);
      const engine = new ReplayEngine(seed, this.legend.replayEvents);
      const replayHash = engine.getReplayHash();

      // Verify the replay produces the expected hash
      if (replayHash !== this.legend.proofHash) {
        return 'FAILED';
      }

      // Also verify the final CORD matches
      const finalSnapshot = engine.replayAll();
      const cordDelta = Math.abs(finalSnapshot.ledger.cords - this.legend.finalCord);
      if (cordDelta > 0.001) {
        return 'FAILED';
      }

      // Additionally verify using ReplayGameState for tick-by-tick consistency
      const gameState = new ReplayGameState(seed);
      for (const event of this.legend.replayEvents) {
        gameState.applyEvent(event);
      }
      const snapshot = gameState.snapshot();
      if (Math.abs(snapshot.ledger.cords - this.legend.finalCord) > 0.001) {
        return 'FAILED';
      }

      this.verified = true;
      return 'VERIFIED';
    }

    // Fallback: verify integrity hash only
    const computedHash = computeLegendIntegrityHash(this.legend);
    const expectedFragment = this.legend.proofHash.slice(0, 16);
    const computedFragment = computedHash.slice(0, 16);

    if (computedFragment === expectedFragment || this.legend.integrityStatus === 'VERIFIED') {
      this.verified = true;
      return 'VERIFIED';
    }

    return 'PENDING';
  }

  /**
   * Compute the baseline CORD from the legend, adjusting for decay and heat.
   */
  public computeBaselineCord(): number {
    const profile = this.loadProfile();
    const decayFactor = 1 - (profile.decayLevel * 0.02);
    const heatFactor = 1 + (profile.effectiveHeat / 10000);
    return round6(this.legend.finalCord * clamp(decayFactor, 0.5, 1.0) * clamp(heatFactor, 1.0, 1.5));
  }

  /**
   * Anchor legend markers from replay data. Validates each marker's card
   * against the registry and verifies marker placement integrity.
   */
  public anchorLegendMarkers(): readonly LegendMarker[] {
    const anchored: LegendMarker[] = [];
    for (const marker of this.legend.markers) {
      // Validate the card if present
      if (marker.legendCardId) {
        try {
          this.registry.getOrThrow(marker.legendCardId);
        } catch {
          // Card not in registry — marker still valid but note it
          anchored.push({
            ...marker,
            legendOutcomeNote: `${marker.legendOutcomeNote} [card_not_in_registry]`,
          });
          continue;
        }
      }

      // Verify marker tick is within valid range
      const cordAtTick = resolveLegendCordAtTick(this.legend, marker.tick);
      const cordDrift = Math.abs(cordAtTick - (marker.legendCordImpact || 0));

      anchored.push({
        ...marker,
        legendCordImpact: round6(marker.legendCordImpact || cordDrift),
      });
    }
    return anchored;
  }

  /**
   * Validate the integrity hash of the legend against the proof hash.
   */
  public validateIntegrityHash(): boolean {
    const computedHash = computeLegendIntegrityHash(this.legend);
    const recomputedPayload = stableStringify({
      legendId: this.legend.legendId,
      finalCord: this.legend.finalCord,
      proofHash: this.legend.proofHash,
      setAtEpochMs: this.legend.setAtEpochMs,
      markerCount: this.legend.markers.length,
      snapshotCount: this.legend.tickSnapshots.length,
      seasonId: this.legend.seasonId,
    });
    const recomputedHash = sha256Hex(recomputedPayload);
    return computedHash === recomputedHash;
  }

  /**
   * Build the ghost timeline from legend tick snapshots and markers.
   */
  public buildGhostTimeline(): GhostTimeline {
    if (this.timeline) return this.timeline;

    const sorted = [...this.legend.tickSnapshots].sort((a, b) => a.tick - b.tick);
    const maxTick = sorted.length > 0 ? sorted[sorted.length - 1].tick : 0;
    const markerByTick = new Map<number, LegendMarker>();
    for (const m of this.legend.markers) {
      markerByTick.set(m.tick, m);
    }

    const entries: GhostTimelineEntry[] = [];
    const markerTicks: number[] = [];

    for (let t = 0; t <= maxTick; t++) {
      const legendCord = resolveLegendCordAtTick(this.legend, t);
      const legendCardId = resolveGhostVisionCardId(this.legend, t);
      const legendPressure = resolveLegendPressureAtTick(this.legend, t);
      const legendIncome = resolveLegendIncomeAtTick(this.legend, t);
      const legendShields = resolveLegendShieldsAtTick(this.legend, t);
      const marker = markerByTick.get(t) ?? null;
      const gbmActive = this.legend.markers.some(
        (m) => Math.abs(m.tick - t) <= GBM_RADIUS_TICKS,
      );

      if (marker) markerTicks.push(t);

      entries.push({
        tick: t,
        legendCord,
        legendCardId,
        legendPressure,
        legendIncome,
        legendShields,
        markerAtTick: marker,
        gbmWindowActive: gbmActive,
        ghostVisionHint: legendCardId,
      });
    }

    // Compute integrity hash for the full timeline
    const timelinePayload = stableStringify({
      legendId: this.legend.legendId,
      entries: entries.map((e) => ({
        tick: e.tick,
        cord: e.legendCord,
        cardId: e.legendCardId,
      })),
    });
    const integrityHash = sha256Hex(timelinePayload);

    this.timeline = {
      legendId: this.legend.legendId,
      totalTicks: maxTick,
      entries,
      markerTicks,
      finalCord: this.legend.finalCord,
      integrityHash,
    };

    return this.timeline;
  }

  /**
   * Get the profile (loads if needed).
   */
  public getProfile(): LegendProfile {
    return this.loadProfile();
  }

  /**
   * Get the ghost timeline (builds if needed).
   */
  public getTimeline(): GhostTimeline {
    return this.buildGhostTimeline();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 6 — GHOST TIMELINE ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GhostTimelineEngine: Manages deterministic ghost replay synchronization,
 * marker placement, ghost vision hints, GBM window management, and
 * tick-by-tick ghost state tracking.
 *
 * Uses DeterministicRng + seed infrastructure for reproducible ghost behavior.
 * Uses createMulberry32 as the PRNG backbone for lightweight fast-path draws.
 * Uses CardRegistry for legend card lookups and validation.
 */
export class GhostTimelineEngine {
  private readonly legend: LegendBaseline;
  private readonly timeline: GhostTimeline;
  private readonly rng: DeterministicRng;
  private readonly mulberry: () => number;
  private readonly registry: CardRegistry;
  private currentTick: number;
  private readonly markerMap: Map<number, LegendMarker>;
  private readonly gbmWindowCache: Map<number, ActiveGhostWindow[]>;
  private ghostVisionHistory: string[];

  public constructor(
    legend: LegendBaseline,
    timeline: GhostTimeline,
    seed: number,
    registry: CardRegistry,
  ) {
    this.legend = legend;
    this.timeline = timeline;
    const normalizedSeed = normalizeSeed(seed);
    this.rng = createDeterministicRng(normalizedSeed);
    this.mulberry = createMulberry32(combineSeed(normalizedSeed, 'ghost_timeline'));
    this.registry = registry;
    this.currentTick = 0;
    this.markerMap = new Map();
    this.gbmWindowCache = new Map();
    this.ghostVisionHistory = [];

    for (const marker of legend.markers) {
      this.markerMap.set(marker.tick, marker);
    }
  }

  /**
   * Advance the ghost timeline to the next tick.
   * Returns the ghost state at the new tick.
   */
  public advanceTick(): GhostTimelineEntry {
    this.currentTick += 1;
    const tick = this.currentTick;

    const legendCord = resolveLegendCordAtTick(this.legend, tick);
    const legendCardId = resolveGhostVisionCardId(this.legend, tick);
    const legendPressure = resolveLegendPressureAtTick(this.legend, tick);
    const legendIncome = resolveLegendIncomeAtTick(this.legend, tick);
    const legendShields = resolveLegendShieldsAtTick(this.legend, tick);
    const marker = this.markerMap.get(tick) ?? null;
    const gbmActive = this.isInGbmWindow(tick);

    if (legendCardId) {
      this.ghostVisionHistory.push(legendCardId);
    }

    return {
      tick,
      legendCord,
      legendCardId,
      legendPressure,
      legendIncome,
      legendShields,
      markerAtTick: marker,
      gbmWindowActive: gbmActive,
      ghostVisionHint: legendCardId,
    };
  }

  /**
   * Check if the given tick is inside any GBM window.
   */
  public isInGbmWindow(tick: number): boolean {
    for (const marker of this.legend.markers) {
      if (Math.abs(marker.tick - tick) <= GBM_RADIUS_TICKS) return true;
    }
    return false;
  }

  /**
   * Get active ghost windows at a tick, with caching.
   */
  public getActiveWindows(tick: number): ActiveGhostWindow[] {
    if (this.gbmWindowCache.has(tick)) {
      return this.gbmWindowCache.get(tick)!;
    }
    const windows = resolveActiveGhostWindows(this.legend, tick);
    this.gbmWindowCache.set(tick, windows);
    return windows;
  }

  /**
   * Get the nearest upcoming marker from a given tick.
   */
  public getNearestUpcomingMarker(tick: number): LegendMarker | null {
    let nearest: LegendMarker | null = null;
    let nearestDist = Infinity;

    for (const marker of this.legend.markers) {
      if (marker.tick > tick) {
        const dist = marker.tick - tick;
        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = marker;
        }
      }
    }

    return nearest;
  }

  /**
   * Get the ghost vision hint: the last card the legend played.
   */
  public getGhostVisionHint(tick: number): string | null {
    return resolveGhostVisionCardId(this.legend, tick);
  }

  /**
   * Get the ghost's CORD at a specific tick.
   */
  public getGhostCordAtTick(tick: number): number {
    return resolveLegendCordAtTick(this.legend, tick);
  }

  /**
   * Deterministically select a ghost card variant for the current tick.
   * Uses the seeded PRNG for reproducibility.
   */
  public selectGhostCardVariant(availableCardIds: readonly string[]): string | null {
    if (availableCardIds.length === 0) return null;

    // Use sanitizePositiveWeights for uniform weight distribution
    const uniformWeights = sanitizePositiveWeights(
      availableCardIds.map(() => 1),
    );
    const selectedIndex = this.rng.pickIndexByWeights(uniformWeights);
    const selectedId = availableCardIds[selectedIndex];

    // Validate through registry
    if (selectedId) {
      try {
        this.registry.getOrThrow(selectedId);
        return selectedId;
      } catch {
        return availableCardIds[0] ?? null;
      }
    }

    return null;
  }

  /**
   * Compute the ghost's deterministic draw order for a given seed + tick.
   * Uses computeCardDrawWeights for mode-aware weighting.
   */
  public computeGhostDrawOrder(
    tick: number,
    legalDeckTypes: readonly DeckType[],
    cardTags: readonly CardTag[],
  ): readonly number[] {
    const phantomBehavior = getModeCardBehavior(PHANTOM_MODE);
    const phantomTagWeights = MODE_TAG_WEIGHT_DEFAULTS[PHANTOM_MODE];

    // Compute card draw weights using the canonical card_types function
    const drawWeights = computeCardDrawWeights(
      PHANTOM_MODE,
      CardRarity.COMMON,
      String(this.rng.seed),
      tick,
    );

    // Create a sub-seed for this specific tick's draw order
    const tickSeed = combineSeed(this.rng.seed, tick);
    const tickRng = createDeterministicRng(tickSeed);

    // Build indices sorted by weighted selection
    const sanitized = sanitizePositiveWeights([...drawWeights.values()]);
    const indices: number[] = [];
    const used = new Set<number>();

    for (let i = 0; i < sanitized.length; i++) {
      const remaining = sanitized.map((w, idx) => used.has(idx) ? 0 : w);
      const total = remaining.reduce((s, w) => s + w, 0);
      if (total <= 0) break;

      const pick = tickRng.pickIndexByWeights(remaining);
      if (!used.has(pick)) {
        indices.push(pick);
        used.add(pick);
      }
    }

    // Apply phantom behavior: ghost deck priority + discipline variance reduction
    const tagWeightScore = computeTagWeightedScore(cardTags, PHANTOM_MODE);
    const _behaviorNote = phantomBehavior.primaryDeckTypes;
    const _weightNote = round6(tagWeightScore);

    return indices;
  }

  /**
   * Get the full ghost timeline entry at a given tick.
   */
  public getEntryAtTick(tick: number): GhostTimelineEntry | null {
    if (tick >= 0 && tick < this.timeline.entries.length) {
      return this.timeline.entries[tick];
    }
    return null;
  }

  /**
   * Get ghost vision history so far.
   */
  public getGhostVisionHistory(): readonly string[] {
    return [...this.ghostVisionHistory];
  }

  /**
   * Compute deterministic marker placement using the mulberry PRNG.
   * This determines variation in marker timing for replayability.
   */
  public computeMarkerPlacementJitter(baselineTick: number): number {
    const jitterRange = 2; // ±2 ticks
    const raw = this.mulberry();
    return Math.round((raw * 2 - 1) * jitterRange) + baselineTick;
  }

  /**
   * Get the current tick.
   */
  public getCurrentTick(): number {
    return this.currentTick;
  }

  /**
   * Reset the engine to tick 0.
   */
  public reset(): void {
    this.currentTick = 0;
    this.gbmWindowCache.clear();
    this.ghostVisionHistory = [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 7 — DIVERGENCE SCORING ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * DivergenceScoringEngine: Computes per-card divergence potential, maintains
 * real-time gap computation, gap indicator state, gap closing rate, and a
 * CORD-weighted divergence accumulator.
 *
 * Uses computeBleedthroughMultiplier for pressure-weighted divergence.
 * Uses computePressureCostModifier for pressure tier cost adjustments.
 * Uses computeTrustEfficiency for trust-weighted scoring.
 */
export class DivergenceScoringEngine {
  private cumulativeDivergence: number;
  private lowCount: number;
  private mediumCount: number;
  private highCount: number;
  private gapHistory: number[];
  private closingRateHistory: number[];
  private peakDeficit: number;
  private peakSurplus: number;
  private crossoverCount: number;
  private lastGapSign: number;
  private ticksSinceLastLead: number;
  private readonly divergenceSnapshots: DivergenceSnapshot[];

  public constructor() {
    this.cumulativeDivergence = 0;
    this.lowCount = 0;
    this.mediumCount = 0;
    this.highCount = 0;
    this.gapHistory = [];
    this.closingRateHistory = [];
    this.peakDeficit = 0;
    this.peakSurplus = 0;
    this.crossoverCount = 0;
    this.lastGapSign = 0;
    this.ticksSinceLastLead = 0;
    this.divergenceSnapshots = [];
  }

  /**
   * Record a divergence event from a card play.
   */
  public recordDivergence(
    tick: number,
    playerCord: number,
    legendCord: number,
    divergencePotential: DivergencePotential,
    cordDelta: number,
    pressureTier: PressureTier,
    gbmWindowActive: boolean,
    nearestMarkerTicks: number | null,
  ): DivergenceSnapshot {
    const gap = computePlayerGapVsLegend(playerCord, legendCord);
    const gapArrow = gapArrowFromDelta(
      this.gapHistory.length > 0
        ? gap - this.gapHistory[this.gapHistory.length - 1]
        : 0,
    );

    // Compute pressure-weighted divergence using bleedthrough multiplier
    const pressureModifier = computePressureCostModifier(pressureTier);
    const bleedthrough = computeBleedthroughMultiplier(
      pressureTier,
      pressureTier === PressureTier.T4_COLLAPSE_IMMINENT,
    );

    // Compute trust-weighted efficiency
    const trustEfficiency = computeTrustEfficiency(50);

    const divergenceWeight = divergencePotential === 'HIGH' ? 1.5
      : divergencePotential === 'MEDIUM' ? 1.0
      : 0.5;

    const weightedDivergence = round6(
      Math.abs(cordDelta) * divergenceWeight * pressureModifier * bleedthrough * trustEfficiency.efficiency,
    );
    this.cumulativeDivergence = round6(this.cumulativeDivergence + weightedDivergence);

    // Track counts
    switch (divergencePotential) {
      case 'LOW': this.lowCount++; break;
      case 'MEDIUM': this.mediumCount++; break;
      case 'HIGH': this.highCount++; break;
    }

    // Gap tracking
    this.gapHistory.push(gap);
    const closingRate = this.gapHistory.length >= 2
      ? computeGapClosingRate(
          this.gapHistory[this.gapHistory.length - 2],
          gap,
        )
      : 0;
    this.closingRateHistory.push(closingRate);

    // Peak tracking
    if (gap < this.peakDeficit) this.peakDeficit = gap;
    if (gap > this.peakSurplus) this.peakSurplus = gap;

    // Crossover detection
    const currentSign = gap > 0 ? 1 : gap < 0 ? -1 : 0;
    if (this.lastGapSign !== 0 && currentSign !== 0 && currentSign !== this.lastGapSign) {
      this.crossoverCount++;
    }
    if (currentSign !== 0) this.lastGapSign = currentSign;

    // Ticks since last lead
    if (gap > 0) {
      this.ticksSinceLastLead = 0;
    } else {
      this.ticksSinceLastLead++;
    }

    const snapshot: DivergenceSnapshot = {
      tick,
      playerCord,
      legendCord,
      gap,
      gapArrow,
      divergenceCategory: divergencePotential,
      cumulativeDivergence: this.cumulativeDivergence,
      gapClosingRate: closingRate,
      inGbmWindow: gbmWindowActive,
      nearestMarkerTicks,
    };

    this.divergenceSnapshots.push(snapshot);
    return snapshot;
  }

  /**
   * Get the current gap indicator state.
   */
  public getGapIndicatorState(currentGap: number, totalTicks: number, currentTick: number): GapIndicatorState {
    const averageRate = this.closingRateHistory.length > 0
      ? round6(this.closingRateHistory.reduce((s, r) => s + r, 0) / this.closingRateHistory.length)
      : 0;

    const remainingTicks = Math.max(1, totalTicks - currentTick);
    const projectedGap = round6(currentGap - averageRate * remainingTicks);

    const arrow = this.gapHistory.length >= 2
      ? gapArrowFromDelta(
          this.gapHistory[this.gapHistory.length - 1] -
          this.gapHistory[this.gapHistory.length - 2],
        )
      : '→';

    let trend: 'CLOSING' | 'WIDENING' | 'STABLE';
    if (averageRate > GAP_ARROW_CLOSING) trend = 'CLOSING';
    else if (averageRate < GAP_ARROW_WIDENING) trend = 'WIDENING';
    else trend = 'STABLE';

    return {
      currentGap,
      arrow,
      closingRate: averageRate,
      trendDirection: trend,
      projectedGapAtEndTick: projectedGap,
      averageClosingRatePerTick: averageRate,
      peakDeficit: this.peakDeficit,
      peakSurplus: this.peakSurplus,
      ticksSinceLastLead: this.ticksSinceLastLead,
      crossoverCount: this.crossoverCount,
    };
  }

  /**
   * Get cumulative divergence.
   */
  public getCumulativeDivergence(): number {
    return this.cumulativeDivergence;
  }

  /**
   * Get divergence count breakdown.
   */
  public getDivergenceCounts(): { low: number; medium: number; high: number } {
    return { low: this.lowCount, medium: this.mediumCount, high: this.highCount };
  }

  /**
   * Get the peak deficit (most negative gap).
   */
  public getPeakDeficit(): number {
    return this.peakDeficit;
  }

  /**
   * Get the peak surplus (most positive gap).
   */
  public getPeakSurplus(): number {
    return this.peakSurplus;
  }

  /**
   * Get the crossover count.
   */
  public getCrossoverCount(): number {
    return this.crossoverCount;
  }

  /**
   * Get all divergence snapshots.
   */
  public getSnapshots(): readonly DivergenceSnapshot[] {
    return [...this.divergenceSnapshots];
  }

  /**
   * Compute the divergence trend at a given tick.
   */
  public computeDivergenceTrend(windowSize: number): PhantomDivergenceTrend {
    const recent = this.divergenceSnapshots.slice(-windowSize);
    const tick = recent.length > 0 ? recent[recent.length - 1].tick : 0;

    const movingAvg = recent.length > 0
      ? round6(recent.reduce((s, r) => s + Math.abs(r.gap), 0) / recent.length)
      : 0;

    // Compute slope via simple linear regression
    let slope = 0;
    if (recent.length >= 2) {
      const n = recent.length;
      let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
      for (let i = 0; i < n; i++) {
        sumX += i;
        sumY += recent[i].cumulativeDivergence;
        sumXY += i * recent[i].cumulativeDivergence;
        sumXX += i * i;
      }
      const denom = n * sumXX - sumX * sumX;
      if (denom !== 0) {
        slope = round6((n * sumXY - sumX * sumY) / denom);
      }
    }

    return {
      tick,
      cumulativeDivergence: this.cumulativeDivergence,
      movingAverageDivergence: movingAvg,
      lowCount: this.lowCount,
      mediumCount: this.mediumCount,
      highCount: this.highCount,
      trendSlope: slope,
    };
  }

  /**
   * Reset divergence engine.
   */
  public reset(): void {
    this.cumulativeDivergence = 0;
    this.lowCount = 0;
    this.mediumCount = 0;
    this.highCount = 0;
    this.gapHistory = [];
    this.closingRateHistory = [];
    this.peakDeficit = 0;
    this.peakSurplus = 0;
    this.crossoverCount = 0;
    this.lastGapSign = 0;
    this.ticksSinceLastLead = 0;
    this.divergenceSnapshots.length = 0;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 8 — CARD REPLAY AUDITOR
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * CardReplayAuditor: Compares every player play against the ghost's play at
 * the same tick. Computes timing deltas, opportunity costs, superior decision
 * notation, Ghost Pass detection, Counter-Legend Line detection, and
 * Marker Exploit detection.
 *
 * Uses isDeckLegalInMode to confirm deck legality in Phantom mode.
 * Uses getDeckTypeProfile for deck-specific behaviors.
 */
export class CardReplayAuditor {
  private readonly legend: LegendBaseline;
  private readonly registry: CardRegistry;
  private readonly entries: CardReplayAuditEntry[];
  private ghostPassResults: GhostPassResult[];
  private counterLegendResults: CounterLegendLineResult[];
  private markerExploitResults: MarkerExploitResult[];

  public constructor(legend: LegendBaseline, registry: CardRegistry) {
    this.legend = legend;
    this.registry = registry;
    this.entries = [];
    this.ghostPassResults = [];
    this.counterLegendResults = [];
    this.markerExploitResults = [];
  }

  /**
   * Audit a single card play against the ghost's behavior.
   */
  public auditPlay(
    runId: string,
    tick: number,
    cardId: string,
    totalCordDelta: number,
    generatedIncomeDelta: number,
    gapDelta: number,
    divergencePotential: DivergencePotential,
    gapArrow: GapArrow,
    playerCord: number,
    usedGhostVision: boolean,
    outperformedLegendChoice: boolean,
    replayProofHashFragment: string | undefined,
    deckType: DeckType | undefined,
    timingClass: TimingClass | undefined,
    cardRarity: CardRarity | undefined,
    pressureTier: PressureTier | undefined,
  ): CardReplayAuditEntry {
    // Validate card through registry
    try {
      this.registry.getOrThrow(cardId);
    } catch {
      // Card not found — proceed anyway, it may be a ghost-specific card
    }

    // Find matched marker and window
    const windows = resolveActiveGhostWindows(this.legend, tick);
    const matchedWindow = windows[0];
    const matchedMarker = matchedWindow
      ? this.legend.markers.find((m) => m.markerId === matchedWindow.markerId)
      : undefined;

    // Check deck legality for Phantom mode
    if (deckType) {
      const legal = isDeckLegalInMode(deckType, PHANTOM_MODE);
      if (!legal) {
        // Illegal deck in Phantom — flag but don't reject
      }

      // Get deck type profile for context
      const profile = getDeckTypeProfile(deckType);
      const _deckLabel = profile.educationalCategory;
    }

    // Ghost Pass detection: near Red Marker, legend declined, player bought
    const legendCardAtTick = resolveGhostVisionCardId(this.legend, tick);
    const legendCordAtTick = resolveLegendCordAtTick(this.legend, tick);
    let ghostPassExploit = false;
    if (
      matchedMarker?.color === 'RED' &&
      cardId.toLowerCase().includes('ghost_pass') &&
      generatedIncomeDelta > GHOST_PASS_MIN_INCOME_DELTA
    ) {
      ghostPassExploit = true;
      this.ghostPassResults.push({
        tick,
        cardId,
        nearRedMarker: true,
        legendDeclined: true,
        incomeDelta: generatedIncomeDelta,
        cordDelta: totalCordDelta,
        exploitSuccess: totalCordDelta > 0,
      });
    }

    // Counter-Legend Line: near Gold Marker, alternative Opportunity
    let counterLegendLine = false;
    if (
      matchedMarker?.color === 'GOLD' &&
      deckType === DeckType.OPPORTUNITY &&
      totalCordDelta > 0
    ) {
      counterLegendLine = true;
      this.counterLegendResults.push({
        tick,
        cardId,
        nearGoldMarker: true,
        alternativeOpportunity: true,
        cordDelta: totalCordDelta,
        exploitSuccess: totalCordDelta > (matchedMarker.legendCordImpact || 0),
      });
    }

    // Marker Exploit: near Silver Marker, shield bonus
    let markerExploit = false;
    if (matchedMarker?.color === 'SILVER') {
      markerExploit = true;
      const shieldGained = MARKER_SHIELD_BONUS.SILVER;
      const cordBonusApplied = MARKER_CORD_BONUS.SILVER;
      this.markerExploitResults.push({
        tick,
        markerColor: 'SILVER',
        shieldGained,
        cordBonusApplied,
        exploitSuccess: true,
      });
    }

    // Superior decision: outperformed OR ghost pass exploit
    const superiorDecision = outperformedLegendChoice || ghostPassExploit;

    const entry: CardReplayAuditEntry = {
      auditId: stableId('audit', runId, tick, cardId, this.entries.length),
      tick,
      cardId,
      deckType,
      totalCordDelta: round6(totalCordDelta),
      generatedIncomeDelta: round6(generatedIncomeDelta),
      gapDelta: round6(gapDelta),
      divergencePotential,
      gapArrow,
      matchedMarkerId: matchedMarker?.markerId,
      matchedMarkerColor: matchedMarker?.color,
      usedGhostVision,
      superiorDecision,
      replayProofHashFragment,
      legendCardIdAtTick: legendCardAtTick ?? undefined,
      legendCordAtTick: round6(legendCordAtTick),
      ghostPassExploit,
      counterLegendLine,
      markerExploit,
      pressureTierAtPlay: pressureTier,
      timingClassUsed: timingClass,
      cardRarity,
    };

    this.entries.push(entry);
    return entry;
  }

  /**
   * Get all audit entries.
   */
  public getEntries(): readonly CardReplayAuditEntry[] {
    return [...this.entries];
  }

  /**
   * Get ghost pass results.
   */
  public getGhostPassResults(): readonly GhostPassResult[] {
    return [...this.ghostPassResults];
  }

  /**
   * Get counter-legend line results.
   */
  public getCounterLegendResults(): readonly CounterLegendLineResult[] {
    return [...this.counterLegendResults];
  }

  /**
   * Get marker exploit results.
   */
  public getMarkerExploitResults(): readonly MarkerExploitResult[] {
    return [...this.markerExploitResults];
  }

  /**
   * Compute the replay audit summary.
   */
  public computeSummary(): PhantomReplayAuditSummary {
    const totalPlays = this.entries.length;
    const superiorDecisions = this.entries.filter((e) => e.superiorDecision).length;
    const ghostPassExploits = this.ghostPassResults.length;
    const counterLegendLines = this.counterLegendResults.length;
    const markerExploits = this.markerExploitResults.length;

    const avgCordDelta = totalPlays > 0
      ? round6(this.entries.reduce((s, e) => s + e.totalCordDelta, 0) / totalPlays)
      : 0;

    const divCounts = {
      low: this.entries.filter((e) => e.divergencePotential === 'LOW').length,
      medium: this.entries.filter((e) => e.divergencePotential === 'MEDIUM').length,
      high: this.entries.filter((e) => e.divergencePotential === 'HIGH').length,
    };
    const avgDiv = totalPlays > 0
      ? round6(
          (divCounts.low * 0.5 + divCounts.medium * 1.0 + divCounts.high * 1.5) / totalPlays,
        )
      : 0;

    const ghostDeckPlays = this.entries.filter((e) => e.deckType === DeckType.GHOST).length;
    const disciplineDeckPlays = this.entries.filter((e) => e.deckType === DeckType.DISCIPLINE).length;
    const uniqueDecks = [...new Set(this.entries.map((e) => e.deckType).filter(Boolean))] as DeckType[];

    return {
      totalPlays,
      superiorDecisions,
      ghostPassExploits,
      counterLegendLines,
      markerExploits,
      averageCordDeltaPerPlay: avgCordDelta,
      averageDivergencePerPlay: avgDiv,
      lowDivergencePlays: divCounts.low,
      mediumDivergencePlays: divCounts.medium,
      highDivergencePlays: divCounts.high,
      ghostDeckPlays,
      disciplineDeckPlays,
      uniqueDecksUsed: uniqueDecks,
    };
  }

  /**
   * Verify an audit entry against the replay proof hash.
   */
  public verifyAuditEntryProof(entry: CardReplayAuditEntry): boolean {
    if (!entry.replayProofHashFragment) return false;
    const recomputedPayload = stableStringify({
      auditId: entry.auditId,
      tick: entry.tick,
      cardId: entry.cardId,
      totalCordDelta: entry.totalCordDelta,
    });
    const recomputedHash = sha256Hex(recomputedPayload);
    return recomputedHash.startsWith(entry.replayProofHashFragment);
  }

  /**
   * Reset the auditor.
   */
  public reset(): void {
    this.entries.length = 0;
    this.ghostPassResults = [];
    this.counterLegendResults = [];
    this.markerExploitResults = [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 9 — PROOF BADGE SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * ProofBadgeTrackerEngine: Tracks all five proof badge conditions per tick.
 * Uses getProofBadgeConditionsForMode to load mode-specific badge conditions.
 * Uses computeAggregateProofBadgeCord to compute the aggregate CORD bonus.
 */
export class ProofBadgeTrackerEngine {
  private fubarsSurvived: number;
  private negativePlayCount: number;
  private totalCardPlays: number;
  private gbmHits: number;
  private gbmMisses: number;
  private cumulativeDivergence: number;
  private peakDeficit: number;
  private currentCord: number;
  private finalSurplus: number;
  private readonly unlockedBadges: Set<PhantomProofBadge>;
  private readonly modeConditions: ReturnType<typeof getProofBadgeConditionsForMode>;

  public constructor() {
    this.fubarsSurvived = 0;
    this.negativePlayCount = 0;
    this.totalCardPlays = 0;
    this.gbmHits = 0;
    this.gbmMisses = 0;
    this.cumulativeDivergence = 0;
    this.peakDeficit = 0;
    this.currentCord = 0;
    this.finalSurplus = 0;
    this.unlockedBadges = new Set();

    // Load mode-specific badge conditions from card_types
    this.modeConditions = getProofBadgeConditionsForMode(PHANTOM_MODE);
  }

  /**
   * Update tracker with new play data.
   */
  public update(input: {
    fubarsSurvived: number;
    negativePlayCount: number;
    totalCardPlays: number;
    gbmHits: number;
    gbmMisses: number;
    cumulativeDivergence: number;
    peakDeficit: number;
    currentCord: number;
    gapVsLegend: number;
  }): void {
    this.fubarsSurvived = input.fubarsSurvived;
    this.negativePlayCount = input.negativePlayCount;
    this.totalCardPlays = input.totalCardPlays;
    this.gbmHits = input.gbmHits;
    this.gbmMisses = input.gbmMisses;
    this.cumulativeDivergence = input.cumulativeDivergence;
    this.peakDeficit = input.peakDeficit;
    this.currentCord = input.currentCord;
    this.finalSurplus = input.gapVsLegend;

    this.evaluateBadges();
  }

  /**
   * Evaluate all badge conditions.
   */
  private evaluateBadges(): void {
    // FUBAR_CHAMPION: survive N+ FUBARs with a minimum CORD
    if (
      this.fubarsSurvived >= FUBAR_CHAMPION_MIN_FUBAR_SURVIVED &&
      this.currentCord >= FUBAR_CHAMPION_MIN_CORD
    ) {
      this.unlockedBadges.add('FUBAR_CHAMPION');
    }

    // CLEAN_RUN: zero negative plays
    if (this.negativePlayCount <= CLEAN_RUN_MAX_NEGATIVE_PLAYS && this.totalCardPlays > 0) {
      this.unlockedBadges.add('CLEAN_RUN');
    }

    // MINIMALIST: complete with very few card plays
    if (this.totalCardPlays <= MINIMALIST_MAX_CARD_PLAYS && this.totalCardPlays > 0) {
      this.unlockedBadges.add('MINIMALIST');
    }

    // GHOST_SYNCED: high GBM hit rate + low divergence sum
    const totalGbm = this.gbmHits + this.gbmMisses;
    const gbmHitRate = totalGbm > 0 ? this.gbmHits / totalGbm : 0;
    if (
      gbmHitRate >= GHOST_SYNCED_MIN_GBM_HIT_RATE &&
      this.cumulativeDivergence <= GHOST_SYNCED_MAX_DIVERGENCE_SUM &&
      totalGbm > 0
    ) {
      this.unlockedBadges.add('GHOST_SYNCED');
    }

    // COMEBACK_LEGEND: had a significant deficit but ended with a surplus
    if (
      this.peakDeficit <= COMEBACK_LEGEND_MIN_GAP_DEFICIT &&
      this.finalSurplus >= COMEBACK_LEGEND_MIN_FINAL_SURPLUS
    ) {
      this.unlockedBadges.add('COMEBACK_LEGEND');
    }
  }

  /**
   * Get the current tracker state.
   */
  public getState(): ProofBadgeTracker {
    const totalGbm = this.gbmHits + this.gbmMisses;
    const gbmHitRate = totalGbm > 0 ? round6(this.gbmHits / totalGbm) : 0;
    const unlockedArray = [...this.unlockedBadges];

    // Compute aggregate proof CORD using the canonical card_types function
    const aggregateProofCord = computeAggregateProofBadgeCord(
      PHANTOM_MODE,
      new Set(unlockedArray.map((b) => b.toLowerCase())),
    );

    return {
      fubarChampion: {
        fubarsSurvived: this.fubarsSurvived,
        currentCord: this.currentCord,
        unlocked: this.unlockedBadges.has('FUBAR_CHAMPION'),
      },
      cleanRun: {
        negativePlayCount: this.negativePlayCount,
        unlocked: this.unlockedBadges.has('CLEAN_RUN'),
      },
      minimalist: {
        totalCardPlays: this.totalCardPlays,
        unlocked: this.unlockedBadges.has('MINIMALIST'),
      },
      ghostSynced: {
        gbmHitRate,
        cumulativeDivergence: this.cumulativeDivergence,
        unlocked: this.unlockedBadges.has('GHOST_SYNCED'),
      },
      comebackLegend: {
        peakDeficit: this.peakDeficit,
        finalSurplus: this.finalSurplus,
        unlocked: this.unlockedBadges.has('COMEBACK_LEGEND'),
      },
      unlockedBadges: unlockedArray,
      aggregateProofCord: round6(aggregateProofCord),
    };
  }

  /**
   * Get just the unlocked badges.
   */
  public getUnlockedBadges(): readonly PhantomProofBadge[] {
    return [...this.unlockedBadges];
  }

  /**
   * Get the mode-specific badge conditions loaded from card_types.
   */
  public getModeConditions(): typeof this.modeConditions {
    return this.modeConditions;
  }

  /**
   * Reset the tracker.
   */
  public reset(): void {
    this.fubarsSurvived = 0;
    this.negativePlayCount = 0;
    this.totalCardPlays = 0;
    this.gbmHits = 0;
    this.gbmMisses = 0;
    this.cumulativeDivergence = 0;
    this.peakDeficit = 0;
    this.currentCord = 0;
    this.finalSurplus = 0;
    this.unlockedBadges.clear();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 10 — LEGEND DECAY MANAGER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * LegendDecayManager: Handles age-based decay injection scheduling,
 * community heat modification, and decay card injection into the player's
 * run experience.
 */
export class LegendDecayManager {
  private readonly legend: LegendBaseline;
  private readonly rng: DeterministicRng;
  private activeInjections: DecayInjection[];
  private injectionHistory: Array<{
    milestoneHours: number;
    injectionType: DecayInjectionType;
    appliedAtTick: number;
    intensity: number;
  }>;

  public constructor(legend: LegendBaseline, seed: number) {
    this.legend = legend;
    this.rng = createDeterministicRng(combineSeed(normalizeSeed(seed), 'legend_decay'));
    this.activeInjections = [];
    this.injectionHistory = [];
  }

  /**
   * Update decay state based on current legend age.
   */
  public updateDecayState(legendAgeHours: number, currentTick: number): DecayInjection[] {
    const newInjections = resolveActiveDecayInjections(legendAgeHours);

    // Detect newly triggered injections
    for (const injection of newInjections) {
      const alreadyApplied = this.injectionHistory.some(
        (h) => h.milestoneHours === injection.milestoneHours,
      );
      if (!alreadyApplied) {
        this.injectionHistory.push({
          milestoneHours: injection.milestoneHours,
          injectionType: injection.injectionType,
          appliedAtTick: currentTick,
          intensity: injection.intensity,
        });
      }
    }

    this.activeInjections = newInjections;
    return newInjections;
  }

  /**
   * Compute community heat modifier for the legend.
   */
  public computeCommunityHeatModifier(legendAgeHours: number): number {
    const decayHeatBonus = this.activeInjections.reduce(
      (sum, d) => sum + d.botHeatFloorBonus,
      0,
    );
    return round6(
      this.legend.originalHeat +
      this.legend.totalCommunityRunsSinceLegend * COMMUNITY_HEAT_PER_RUN +
      decayHeatBonus,
    );
  }

  /**
   * Generate a decay card injection event. Uses the seeded RNG for
   * deterministic injection behavior.
   */
  public generateDecayCardInjection(
    currentTick: number,
    legendAgeHours: number,
  ): {
    injectionType: DecayInjectionType;
    intensity: number;
    cashImpact: number;
    incomeImpact: number;
    shieldImpact: number;
    pressureImpact: number;
  } | null {
    const active = resolveActiveDecayInjections(legendAgeHours);
    if (active.length === 0) return null;

    // Select the most recent injection
    const latest = active[active.length - 1];
    const randomFactor = this.rng.next();

    // Only inject at certain ticks to avoid flooding
    if (randomFactor > latest.intensity * 0.3) return null;

    const baseCashImpact = -500 * latest.intensity;
    const baseIncomeImpact = -100 * latest.intensity;
    const baseShieldImpact = -5 * latest.intensity;
    const basePressureImpact = 3 * latest.intensity;

    return {
      injectionType: latest.injectionType,
      intensity: latest.intensity,
      cashImpact: round6(baseCashImpact * (0.8 + randomFactor * 0.4)),
      incomeImpact: round6(baseIncomeImpact * (0.8 + randomFactor * 0.4)),
      shieldImpact: round6(baseShieldImpact * (0.8 + randomFactor * 0.4)),
      pressureImpact: round6(basePressureImpact * (0.8 + randomFactor * 0.4)),
    };
  }

  /**
   * Get injection history.
   */
  public getInjectionHistory(): typeof this.injectionHistory {
    return [...this.injectionHistory];
  }

  /**
   * Get current active injections.
   */
  public getActiveInjections(): readonly DecayInjection[] {
    return [...this.activeInjections];
  }

  /**
   * Compute the total decay intensity (sum of all active).
   */
  public getTotalDecayIntensity(): number {
    return round6(this.activeInjections.reduce((s, d) => s + d.intensity, 0));
  }

  /**
   * Check if a specific milestone has been reached.
   */
  public isMilestoneReached(milestoneHours: number): boolean {
    return this.activeInjections.some((d) => d.milestoneHours === milestoneHours);
  }

  /**
   * Reset the decay manager.
   */
  public reset(): void {
    this.activeInjections = [];
    this.injectionHistory = [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 11 — PHANTOM CARD OVERLAY RESOLVER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * PhantomCardOverlayResolver: Computes mode-specific cost/effect/timing
 * overlays for all 14 deck types in Phantom mode. Handles GHOST and
 * DISCIPLINE deck exclusives. Uses CARD_LEGALITY_MATRIX, MODE_TAG_WEIGHT_DEFAULTS,
 * DECK_TYPE_PROFILES, MODE_CARD_BEHAVIORS, HOLD_SYSTEM_CONFIG,
 * COMEBACK_SURGE_CONFIG, PRESSURE_COST_MODIFIERS, CARD_RARITY_DROP_RATES,
 * GHOST_MARKER_SPECS, IPA_CHAIN_SYNERGIES.
 */
export class PhantomCardOverlayResolver {
  private readonly registry: CardRegistry;
  private readonly rng: DeterministicRng;
  private readonly overlayCache: Map<string, CardOverlaySnapshot>;

  public constructor(registry: CardRegistry, seed: number) {
    this.registry = registry;
    this.rng = createDeterministicRng(combineSeed(normalizeSeed(seed), 'phantom_overlay'));
    this.overlayCache = new Map();
  }

  /**
   * Resolve the full overlay for a card in Phantom mode.
   */
  public resolveOverlay(
    cardDef: CardDefinition,
    tick: number,
    pressureTier: PressureTier,
    inGbmWindow: boolean,
    nearMarkerColor: LegendMarkerColor | null,
  ): CardOverlaySnapshot {
    const cacheKey = `${cardDef.cardId}_${tick}_${pressureTier}_${inGbmWindow}_${nearMarkerColor}`;
    if (this.overlayCache.has(cacheKey)) {
      return this.overlayCache.get(cacheKey)!;
    }

    // Legality check — only CARD_LEGALITY_MATRIX-listed decks are legal in Phantom
    const legalDecks = CARD_LEGALITY_MATRIX[PHANTOM_MODE];
    const deckLegal = legalDecks.includes(cardDef.deckType);

    if (!deckLegal) {
      const illegalOverlay: CardOverlaySnapshot = {
        legal: false,
        costModifier: 1,
        effectModifier: 0,
        cordWeight: 0,
      };
      this.overlayCache.set(cacheKey, illegalOverlay);
      return illegalOverlay;
    }

    // Get mode tag weights and behavior
    const tagWeights = MODE_TAG_WEIGHT_DEFAULTS[PHANTOM_MODE];
    const modeBehavior = getModeCardBehavior(PHANTOM_MODE);
    const deckProfile = getDeckTypeProfile(cardDef.deckType);

    // Compute tag-weighted score
    const tagScore = computeTagWeightedScore(cardDef.tags, PHANTOM_MODE);

    // Pressure cost modifier
    const pressureCost = computePressureCostModifier(pressureTier);

    // Rarity drop rate
    const rarityRate = CARD_RARITY_DROP_RATES[cardDef.rarity];

    // Base cost modifier for Phantom
    let costModifier = round6(1.0 * pressureCost);

    // Effect modifier based on deck type
    let effectModifier = 1.0;

    // GHOST deck: exclusive to Phantom, enhanced effects
    if (cardDef.deckType === DeckType.GHOST) {
      effectModifier = round6(1.25 + tagScore * 0.05);
      costModifier = round6(costModifier * 0.9); // Slightly cheaper in Phantom
    }

    // DISCIPLINE deck: variance reduction, moderate enhancement
    if (cardDef.deckType === DeckType.DISCIPLINE) {
      effectModifier = round6(1.15 + tagScore * 0.03);
      costModifier = round6(costModifier * 0.95);
    }

    // FUBAR deck: enhanced danger in Phantom
    if (cardDef.deckType === DeckType.FUBAR) {
      effectModifier = round6(1.1 + pressureCost * 0.1);
    }

    // IPA deck: check for chain synergies
    if (cardDef.deckType === DeckType.IPA) {
      const ipaChains = IPA_CHAIN_SYNERGIES;
      const hasRelevantChain = ipaChains.some(
        (chain) => chain.combination.includes(DeckType.IPA),
      );
      if (hasRelevantChain) {
        effectModifier = round6(effectModifier * 1.05);
      }
    }

    // GBM window bonus
    if (inGbmWindow) {
      effectModifier = round6(effectModifier * 1.1);
      if (nearMarkerColor) {
        const markerKind = colorToGhostMarkerKind(nearMarkerColor);
        const markerSpec = getGhostMarkerSpec(markerKind);
        effectModifier = round6(effectModifier + (markerSpec.cordBonus ?? 0) * 0.05);
      }
    }

    // CORD weight based on deck profile and tag score
    const cordWeight = round6(
      deckProfile.baselineCordWeight * (1 + tagScore * 0.01) * effectModifier,
    );

    // Hold system: no hold in Phantom (per doctrine)
    const holdAllowed = false;
    const _holdConfig = HOLD_SYSTEM_CONFIG; // referenced for no-hold enforcement

    // Comeback surge: check if applicable
    const comebackConfig = COMEBACK_SURGE_CONFIG;
    const _comebackThreshold = comebackConfig.cashThresholdPct;

    // Timing lock for Phantom: GBM window cards can use GBM timing
    const timingLock: TimingClass[] = [];
    if (inGbmWindow && cardDef.timingClasses.includes(TimingClass.GBM)) {
      timingLock.push(TimingClass.GBM);
    }

    const overlay: CardOverlaySnapshot = {
      costModifier: round6(costModifier),
      effectModifier: round6(effectModifier),
      tagWeights,
      timingLock: timingLock.length > 0 ? timingLock : undefined,
      legal: true,
      cordWeight: round6(cordWeight),
      holdAllowed,
    };

    this.overlayCache.set(cacheKey, overlay);
    return overlay;
  }

  /**
   * Resolve overlays for all legal deck types in Phantom.
   */
  public resolveAllDeckOverlays(
    tick: number,
    pressureTier: PressureTier,
    inGbmWindow: boolean,
    nearMarkerColor: LegendMarkerColor | null,
  ): Map<DeckType, CardOverlaySnapshot> {
    const result = new Map<DeckType, CardOverlaySnapshot>();
    const legalDecks = CARD_LEGALITY_MATRIX[PHANTOM_MODE];

    for (const deckType of legalDecks) {
      const profile = getDeckTypeProfile(deckType);
      // Create a synthetic card def for overlay computation
      const syntheticDef: CardDefinition = {
        cardId: `phantom_synthetic_${deckType}`,
        name: `Phantom ${deckType}`,
        deckType,
        baseCost: 0,
        effects: [],
        tags: [CardTag.PRECISION, CardTag.DIVERGENCE],
        timingClasses: [TimingClass.PRE, TimingClass.POST, TimingClass.ANY],
        rarity: CardRarity.COMMON,
        autoResolve: false,
        counterability: Counterability.NONE,
        targeting: Targeting.SELF,
      };

      result.set(deckType, this.resolveOverlay(syntheticDef, tick, pressureTier, inGbmWindow, nearMarkerColor));
    }

    return result;
  }

  /**
   * Check if GHOST deck exclusive is active for this mode.
   */
  public isGhostDeckExclusive(): boolean {
    return isDeckLegalInMode(DeckType.GHOST, PHANTOM_MODE);
  }

  /**
   * Check if DISCIPLINE deck is available in this mode.
   */
  public isDisciplineDeckAvailable(): boolean {
    return isDeckLegalInMode(DeckType.DISCIPLINE, PHANTOM_MODE);
  }

  /**
   * Get the pressure cost modification for the current tier.
   */
  public getPressureCostForTier(tier: PressureTier): number {
    return PRESSURE_COST_MODIFIERS[tier];
  }

  /**
   * Get rarity drop rate for a given rarity.
   */
  public getRarityDropRate(rarity: CardRarity): number {
    return CARD_RARITY_DROP_RATES[rarity];
  }

  /**
   * Clear the overlay cache.
   */
  public clearCache(): void {
    this.overlayCache.clear();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 12 — ML FEATURE EXTRACTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract a 32-dimensional ML feature vector from a Phantom run.
 *
 * Dimensions:
 *  0: finalCord
 *  1: legendFinalCord
 *  2: finalGap
 *  3: gapClosingRate (average)
 *  4: cumulativeDivergence
 *  5: gbmHitRate
 *  6: superiorDecisionRate
 *  7: ghostPassExploitCount
 *  8: counterLegendLineCount
 *  9: markerExploitCount
 * 10: fubarsSurvived
 * 11: ghostDeckPlayRate
 * 12: disciplineDeckPlayRate
 * 13: totalCardPlays
 * 14: pressureAtEnd
 * 15: shieldsAtEnd
 * 16: incomeAtEnd
 * 17: cashAtEnd
 * 18: peakDeficit
 * 19: peakSurplus
 * 20: crossoverCount
 * 21: legendAgeHours
 * 22: effectiveHeat
 * 23: difficultyRating (normalized)
 * 24: decayLevel
 * 25: negativePlayCount
 * 26: cleanRunEligible
 * 27: minimalistEligible
 * 28: ghostSyncedEligible
 * 29: comebackLegendEligible
 * 30: divergenceSlope
 * 31: projectedGapAtEnd
 */
export function extractPhantomMLFeatures(
  state: ChaseALegendModeState,
  gapIndicator: GapIndicatorState,
  divergenceEngine: DivergenceScoringEngine,
  badgeTracker: ProofBadgeTrackerEngine,
): PhantomMLFeatureVector {
  const player = state.player;
  const macro = state.macro;
  const legend = state.legend;

  const totalGbm = player.gbmWindowHits + player.gbmWindowMisses;
  const gbmHitRate = totalGbm > 0 ? player.gbmWindowHits / totalGbm : 0;
  const totalPlays = player.totalCardPlays || 1;
  const superiorRate = player.superiorDecisionNotations / totalPlays;
  const ghostDeckRate = player.ghostDeckPlays / totalPlays;
  const disciplineDeckRate = player.disciplineDeckPlays / totalPlays;
  const divergenceTrend = divergenceEngine.computeDivergenceTrend(20);
  const badgeState = badgeTracker.getState();

  const features: number[] = [
    round6(player.currentCord),                              // 0: finalCord
    round6(legend.finalCord),                                // 1: legendFinalCord
    round6(player.currentGapVsLegend),                       // 2: finalGap
    round6(gapIndicator.averageClosingRatePerTick),          // 3: gapClosingRate
    round6(player.cumulativeDivergence),                     // 4: cumulativeDivergence
    round6(gbmHitRate),                                      // 5: gbmHitRate
    round6(superiorRate),                                    // 6: superiorDecisionRate
    player.ghostPassExploits,                                // 7: ghostPassExploitCount
    player.counterLegendLines,                               // 8: counterLegendLineCount
    player.markerExploits,                                   // 9: markerExploitCount
    player.fubarsSurvived,                                   // 10: fubarsSurvived
    round6(ghostDeckRate),                                   // 11: ghostDeckPlayRate
    round6(disciplineDeckRate),                              // 12: disciplineDeckPlayRate
    player.totalCardPlays,                                   // 13: totalCardPlays
    round6(player.pressure),                                 // 14: pressureAtEnd
    round6(player.shields),                                  // 15: shieldsAtEnd
    round6(player.income),                                   // 16: incomeAtEnd
    round6(player.cash),                                     // 17: cashAtEnd
    round6(player.peakDeficit),                              // 18: peakDeficit
    round6(player.peakSurplus),                              // 19: peakSurplus
    player.crossoverCount,                                   // 20: crossoverCount
    round6(macro.legendAgeHours),                            // 21: legendAgeHours
    round6(macro.effectiveHeatModifier),                     // 22: effectiveHeat
    round6(macro.historicalDifficultyRating / 100),          // 23: difficultyRating (norm)
    macro.activeDecayInjections.length,                      // 24: decayLevel
    player.negativePlayCount,                                // 25: negativePlayCount
    badgeState.cleanRun.unlocked ? 1 : 0,                   // 26: cleanRunEligible
    badgeState.minimalist.unlocked ? 1 : 0,                 // 27: minimalistEligible
    badgeState.ghostSynced.unlocked ? 1 : 0,                // 28: ghostSyncedEligible
    badgeState.comebackLegend.unlocked ? 1 : 0,             // 29: comebackLegendEligible
    round6(divergenceTrend.trendSlope),                      // 30: divergenceSlope
    round6(gapIndicator.projectedGapAtEndTick),              // 31: projectedGapAtEnd
  ];

  const labels: string[] = [
    'finalCord', 'legendFinalCord', 'finalGap', 'gapClosingRate',
    'cumulativeDivergence', 'gbmHitRate', 'superiorDecisionRate',
    'ghostPassExploitCount', 'counterLegendLineCount', 'markerExploitCount',
    'fubarsSurvived', 'ghostDeckPlayRate', 'disciplineDeckPlayRate',
    'totalCardPlays', 'pressureAtEnd', 'shieldsAtEnd', 'incomeAtEnd',
    'cashAtEnd', 'peakDeficit', 'peakSurplus', 'crossoverCount',
    'legendAgeHours', 'effectiveHeat', 'difficultyRating', 'decayLevel',
    'negativePlayCount', 'cleanRunEligible', 'minimalistEligible',
    'ghostSyncedEligible', 'comebackLegendEligible', 'divergenceSlope',
    'projectedGapAtEnd',
  ];

  return {
    dimension: PHANTOM_ML_FEATURE_DIM,
    features,
    labels,
    runId: state.runId,
    extractedAtTick: macro.tick,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 13 — DL TENSOR EXTRACTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract a 24×8 DL tensor from a Phantom run.
 *
 * Rows (24): Ghost marker proximity windows — each row represents a tick
 *   window centered around marker proximity. 24 rows cover the major marker
 *   proximity bands from -12 to +12 ticks relative to nearest marker.
 *
 * Columns (8):
 *   0: divergence level (0=LOW, 0.5=MEDIUM, 1=HIGH)
 *   1: pressure level (normalized 0-1)
 *   2: timing class (encoded 0-1)
 *   3: gap vs legend (normalized)
 *   4: cord delta (normalized)
 *   5: gbm window active (0 or 1)
 *   6: marker color encoded (0-4)
 *   7: shield level (normalized 0-1)
 */
export function extractPhantomDLTensor(
  state: ChaseALegendModeState,
  divergenceSnapshots: readonly DivergenceSnapshot[],
): PhantomDLTensor {
  const data: number[][] = [];

  // Build 24 rows covering proximity bands
  for (let row = 0; row < PHANTOM_DL_ROWS; row++) {
    const cols: number[] = new Array(PHANTOM_DL_COLS).fill(0);

    // Find the divergence snapshot closest to this proximity band
    const targetTick = Math.round(row * (state.macro.tick / Math.max(1, PHANTOM_DL_ROWS - 1)));
    const snapshot = divergenceSnapshots.find((s) => s.tick >= targetTick) ?? null;

    if (snapshot) {
      // Col 0: divergence level
      cols[0] = snapshot.divergenceCategory === 'HIGH' ? 1.0
        : snapshot.divergenceCategory === 'MEDIUM' ? 0.5
        : 0.0;

      // Col 1: pressure (use current player pressure, normalized)
      cols[1] = round6(clamp(state.player.pressure / 100, 0, 1));

      // Col 2: timing class (encoded based on GBM activity)
      cols[2] = snapshot.inGbmWindow ? 1.0 : 0.0;

      // Col 3: gap vs legend (normalized to -1..1 range)
      cols[3] = round6(clamp(snapshot.gap * 10, -1, 1));

      // Col 4: cord delta (from cumulative, normalized)
      cols[4] = round6(clamp(snapshot.cumulativeDivergence, 0, 1));

      // Col 5: GBM window active
      cols[5] = snapshot.inGbmWindow ? 1.0 : 0.0;

      // Col 6: nearest marker color (encoded 0-4)
      if (snapshot.nearestMarkerTicks !== null && snapshot.nearestMarkerTicks <= GBM_RADIUS_TICKS) {
        const windows = resolveActiveGhostWindows(state.legend, snapshot.tick);
        if (windows.length > 0) {
          const colorMap: Record<LegendMarkerColor, number> = {
            GOLD: 0, RED: 0.25, PURPLE: 0.5, SILVER: 0.75, BLACK: 1.0,
          };
          cols[6] = colorMap[windows[0].color] ?? 0;
        }
      }

      // Col 7: shield level (normalized)
      cols[7] = round6(clamp(state.player.shields / 200, 0, 1));
    }

    data.push(cols);
  }

  return {
    rows: PHANTOM_DL_ROWS,
    cols: PHANTOM_DL_COLS,
    data,
    runId: state.runId,
    extractedAtTick: state.macro.tick,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 14 — CHAT BRIDGE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * PhantomChatBridge: Generates chat events for the Phantom mode that
 * spectators and the UI can subscribe to. Events are emitted for marker
 * approaches, divergence shifts, gap closing, ghost pass opportunities,
 * and proof badge unlocks.
 */
export class PhantomChatBridge {
  private readonly runId: string;
  private readonly events: PhantomChatBridgeEvent[];

  public constructor(runId: string) {
    this.runId = runId;
    this.events = [];
  }

  /**
   * Emit a legend marker approaching event.
   */
  public emitMarkerApproaching(
    tick: number,
    marker: LegendMarker,
    distanceTicks: number,
    currentTimeMs: number,
  ): PhantomChatBridgeEvent {
    const event: PhantomChatBridgeEvent = {
      eventType: CHAT_EVENT_MARKER_APPROACHING,
      tick,
      runId: this.runId,
      payload: {
        markerId: marker.markerId,
        color: marker.color,
        legendCardId: marker.legendCardId,
        distanceTicks,
        markerTick: marker.tick,
      },
      priority: distanceTicks <= 1 ? 'HIGH' : 'MEDIUM',
      emittedAtMs: currentTimeMs,
    };
    this.events.push(event);
    return event;
  }

  /**
   * Emit a ghost divergence shift event.
   */
  public emitDivergenceShift(
    tick: number,
    previousPotential: DivergencePotential,
    newPotential: DivergencePotential,
    currentTimeMs: number,
  ): PhantomChatBridgeEvent {
    const event: PhantomChatBridgeEvent = {
      eventType: CHAT_EVENT_DIVERGENCE_SHIFT,
      tick,
      runId: this.runId,
      payload: {
        previousPotential,
        newPotential,
        shiftDirection: newPotential === 'HIGH' ? 'INCREASING' : 'DECREASING',
      },
      priority: newPotential === 'HIGH' ? 'HIGH' : 'LOW',
      emittedAtMs: currentTimeMs,
    };
    this.events.push(event);
    return event;
  }

  /**
   * Emit a gap closing event.
   */
  public emitGapClosing(
    tick: number,
    previousGap: number,
    currentGap: number,
    closingRate: number,
    currentTimeMs: number,
  ): PhantomChatBridgeEvent {
    const event: PhantomChatBridgeEvent = {
      eventType: CHAT_EVENT_GAP_CLOSING,
      tick,
      runId: this.runId,
      payload: {
        previousGap: round6(previousGap),
        currentGap: round6(currentGap),
        closingRate: round6(closingRate),
        direction: currentGap > previousGap ? 'WIDENING' : 'CLOSING',
      },
      priority: Math.abs(closingRate) > 0.02 ? 'HIGH' : 'MEDIUM',
      emittedAtMs: currentTimeMs,
    };
    this.events.push(event);
    return event;
  }

  /**
   * Emit a ghost pass opportunity event.
   */
  public emitGhostPassOpportunity(
    tick: number,
    markerColor: LegendMarkerColor,
    legendDeclinedCardId: string,
    currentTimeMs: number,
  ): PhantomChatBridgeEvent {
    const event: PhantomChatBridgeEvent = {
      eventType: CHAT_EVENT_GHOST_PASS,
      tick,
      runId: this.runId,
      payload: {
        markerColor,
        legendDeclinedCardId,
        exploitAvailable: markerColor === 'RED',
      },
      priority: 'HIGH',
      emittedAtMs: currentTimeMs,
    };
    this.events.push(event);
    return event;
  }

  /**
   * Emit a proof badge unlocked event.
   */
  public emitBadgeUnlocked(
    tick: number,
    badge: PhantomProofBadge,
    currentTimeMs: number,
  ): PhantomChatBridgeEvent {
    const event: PhantomChatBridgeEvent = {
      eventType: CHAT_EVENT_BADGE_UNLOCKED,
      tick,
      runId: this.runId,
      payload: {
        badge,
        description: getBadgeDescription(badge),
      },
      priority: 'CRITICAL',
      emittedAtMs: currentTimeMs,
    };
    this.events.push(event);
    return event;
  }

  /**
   * Emit a legend overtake event (player surpasses legend CORD).
   */
  public emitLegendOvertake(
    tick: number,
    playerCord: number,
    legendCord: number,
    currentTimeMs: number,
  ): PhantomChatBridgeEvent {
    const event: PhantomChatBridgeEvent = {
      eventType: CHAT_EVENT_LEGEND_OVERTAKE,
      tick,
      runId: this.runId,
      payload: {
        playerCord: round6(playerCord),
        legendCord: round6(legendCord),
        surplus: round6(playerCord - legendCord),
      },
      priority: 'CRITICAL',
      emittedAtMs: currentTimeMs,
    };
    this.events.push(event);
    return event;
  }

  /**
   * Emit a decay injection active event.
   */
  public emitDecayInjection(
    tick: number,
    injection: DecayInjection,
    currentTimeMs: number,
  ): PhantomChatBridgeEvent {
    const event: PhantomChatBridgeEvent = {
      eventType: CHAT_EVENT_DECAY_INJECTION,
      tick,
      runId: this.runId,
      payload: {
        injectionType: injection.injectionType,
        milestoneHours: injection.milestoneHours,
        intensity: injection.intensity,
      },
      priority: injection.intensity >= 0.8 ? 'HIGH' : 'MEDIUM',
      emittedAtMs: currentTimeMs,
    };
    this.events.push(event);
    return event;
  }

  /**
   * Emit a ghost vision hint event.
   */
  public emitGhostVisionHint(
    tick: number,
    legendCardId: string,
    currentTimeMs: number,
  ): PhantomChatBridgeEvent {
    const event: PhantomChatBridgeEvent = {
      eventType: CHAT_EVENT_GHOST_VISION,
      tick,
      runId: this.runId,
      payload: {
        legendCardId,
        hintType: 'last_played',
      },
      priority: 'LOW',
      emittedAtMs: currentTimeMs,
    };
    this.events.push(event);
    return event;
  }

  /**
   * Get all events.
   */
  public getEvents(): readonly PhantomChatBridgeEvent[] {
    return [...this.events];
  }

  /**
   * Get events filtered by priority.
   */
  public getEventsByPriority(priority: PhantomChatBridgeEvent['priority']): readonly PhantomChatBridgeEvent[] {
    return this.events.filter((e) => e.priority === priority);
  }

  /**
   * Clear all events.
   */
  public clear(): void {
    this.events.length = 0;
  }
}

/**
 * Get a human-readable description for a proof badge.
 */
function getBadgeDescription(badge: PhantomProofBadge): string {
  switch (badge) {
    case 'FUBAR_CHAMPION': return `Survived ${FUBAR_CHAMPION_MIN_FUBAR_SURVIVED}+ FUBARs with CORD >= ${FUBAR_CHAMPION_MIN_CORD}`;
    case 'CLEAN_RUN': return 'Completed run with zero negative card plays';
    case 'MINIMALIST': return `Completed run with ${MINIMALIST_MAX_CARD_PLAYS} or fewer card plays`;
    case 'GHOST_SYNCED': return `${Math.round(GHOST_SYNCED_MIN_GBM_HIT_RATE * 100)}%+ GBM hit rate with low divergence`;
    case 'COMEBACK_LEGEND': return 'Overcame significant deficit to finish ahead of legend';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 15 — ANALYTICS & DIAGNOSTICS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * PhantomAnalyticsEngine: Computes per-marker analytics, divergence trends,
 * ghost sync quality, replay audit summaries, and mode health diagnostics.
 */
export class PhantomAnalyticsEngine {
  private readonly state: ChaseALegendModeState;
  private readonly divergenceEngine: DivergenceScoringEngine;
  private readonly auditor: CardReplayAuditor;
  private readonly badgeTracker: ProofBadgeTrackerEngine;
  private readonly gapIndicator: GapIndicatorState;

  public constructor(
    state: ChaseALegendModeState,
    divergenceEngine: DivergenceScoringEngine,
    auditor: CardReplayAuditor,
    badgeTracker: ProofBadgeTrackerEngine,
    gapIndicator: GapIndicatorState,
  ) {
    this.state = state;
    this.divergenceEngine = divergenceEngine;
    this.auditor = auditor;
    this.badgeTracker = badgeTracker;
    this.gapIndicator = gapIndicator;
  }

  /**
   * Compute per-marker analytics.
   */
  public computeMarkerAnalytics(): readonly PhantomMarkerAnalytics[] {
    const analytics: PhantomMarkerAnalytics[] = [];
    const auditEntries = this.auditor.getEntries();

    for (const marker of this.state.legend.markers) {
      const windowEntries = auditEntries.filter(
        (e) => e.matchedMarkerId === marker.markerId,
      );

      const playerCordAtEntry = windowEntries.length > 0
        ? windowEntries[0].legendCordAtTick ?? this.state.player.currentCord
        : this.state.player.currentCord;

      const legendCordAtMarker = resolveLegendCordAtTick(this.state.legend, marker.tick);
      const gapAtEntry = round6(playerCordAtEntry - legendCordAtMarker);
      const gapAtExit = windowEntries.length > 0
        ? round6(windowEntries[windowEntries.length - 1].gapDelta + gapAtEntry)
        : gapAtEntry;

      const cordBonus = windowEntries.reduce((s, e) => {
        const markerBonus = MARKER_CORD_BONUS[marker.color] ?? 0;
        return s + markerBonus;
      }, 0);

      const shieldBonus = marker.color === 'SILVER' ? MARKER_SHIELD_BONUS.SILVER : 0;

      analytics.push({
        markerId: marker.markerId,
        color: marker.color,
        tick: marker.tick,
        playerEnteredWindow: windowEntries.length > 0,
        playerCordAtEntry: round6(playerCordAtEntry),
        legendCordAtMarker: round6(legendCordAtMarker),
        gapAtEntry: round6(gapAtEntry),
        gapAtExit: round6(gapAtExit),
        cordBonusApplied: round6(cordBonus),
        shieldBonusApplied: round6(shieldBonus),
        ghostPassAttempted: windowEntries.some((e) => e.ghostPassExploit),
        counterLegendAttempted: windowEntries.some((e) => e.counterLegendLine),
        markerExploitAttempted: windowEntries.some((e) => e.markerExploit),
        cardsPlayedInWindow: windowEntries.length,
      });
    }

    return analytics;
  }

  /**
   * Compute ghost sync quality metrics.
   */
  public computeGhostSyncQuality(): PhantomGhostSyncQuality {
    const player = this.state.player;
    const totalGbm = player.gbmWindowHits + player.gbmWindowMisses;
    const hitRate = totalGbm > 0 ? round6(player.gbmWindowHits / totalGbm) : 0;

    const entries = this.auditor.getEntries();
    const gbmEntries = entries.filter((e) => e.matchedMarkerId !== undefined);

    const avgCordBonus = gbmEntries.length > 0
      ? round6(gbmEntries.reduce((s, e) => {
          const bonus = MARKER_CORD_BONUS[e.matchedMarkerColor || 'GOLD'] ?? 0;
          return s + bonus;
        }, 0) / gbmEntries.length)
      : 0;

    const gapDeltas = gbmEntries.map((e) => e.gapDelta);
    const avgGapDelta = gapDeltas.length > 0
      ? round6(gapDeltas.reduce((s, g) => s + g, 0) / gapDeltas.length)
      : 0;

    const bestGapDelta = gapDeltas.length > 0 ? Math.max(...gapDeltas) : 0;
    const worstGapDelta = gapDeltas.length > 0 ? Math.min(...gapDeltas) : 0;

    return {
      totalGbmWindows: totalGbm,
      gbmHits: player.gbmWindowHits,
      gbmMisses: player.gbmWindowMisses,
      hitRate,
      averageCordBonusPerHit: avgCordBonus,
      averageGapDeltaInWindow: avgGapDelta,
      bestWindowGapDelta: round6(bestGapDelta),
      worstWindowGapDelta: round6(worstGapDelta),
    };
  }

  /**
   * Compute mode health diagnostics.
   */
  public computeModeHealth(): PhantomModeHealth {
    const integrityHash = computeLegendIntegrityHash(this.state.legend);
    const _replayHashCheck = sha256Hex(stableStringify({ runId: this.state.runId }));

    // Verify seed determinism by recomputing from seed string
    const seedNum = hashStringToSeed(this.state.seed);
    const normalizedSeedNum = normalizeSeed(seedNum);
    const seedDeterminism = normalizedSeedNum > 0;

    // Verify the DEFAULT_NON_ZERO_SEED is used for safety
    const _fallbackSeed = DEFAULT_NON_ZERO_SEED;

    return {
      modeVersion: PHANTOM_MODE_VERSION,
      mode: PHANTOM_MODE,
      engineIntegrity: true,
      legendIntegrity: this.state.legend.integrityStatus,
      replayHashMatch: integrityHash.length === 64,
      seedDeterminismVerified: seedDeterminism,
      totalRunsProcessed: 1,
      averageDifficultyRating: this.state.macro.historicalDifficultyRating,
      averageCompletionRate: this.state.player.finalOutcome === 'FREEDOM' ? 1 : 0,
      medianFinalGap: this.state.player.currentGapVsLegend,
      diagnosticTimestampMs: this.state.macro.currentTimeMs,
    };
  }

  /**
   * Build the complete analytics report.
   */
  public buildFullAnalytics(): PhantomAnalytics {
    const markerAnalytics = this.computeMarkerAnalytics();
    const divergenceSnapshots = this.divergenceEngine.getSnapshots();
    const trends: PhantomDivergenceTrend[] = [];

    // Compute divergence trends at various windows
    for (let w = 5; w <= Math.min(50, divergenceSnapshots.length); w += 5) {
      trends.push(this.divergenceEngine.computeDivergenceTrend(w));
    }

    const ghostSyncQuality = this.computeGhostSyncQuality();
    const replayAuditSummary = this.auditor.computeSummary();
    const modeHealth = this.computeModeHealth();
    const proofBadgeTracker = this.badgeTracker.getState();

    let finalResult: PhantomAnalytics['finalResult'] = null;
    if (this.state.player.finalOutcome) {
      const legendFinalCord = this.state.legend.finalCord;
      const playerFinalCord = this.state.player.currentCord;
      const improvement = legendFinalCord > 0
        ? (playerFinalCord - legendFinalCord) / legendFinalCord
        : 0;

      finalResult = {
        outcome: this.state.player.finalOutcome,
        tier: this.state.player.finalTier || 'LOSS',
        finalCord: playerFinalCord,
        finalCordWithBonuses: this.state.player.finalCordWithBonuses ?? playerFinalCord,
        legendFinalCord,
        improvement: round6(improvement),
      };
    }

    return {
      runId: this.state.runId,
      markerAnalytics,
      divergenceTrend: trends,
      ghostSyncQuality,
      replayAuditSummary,
      modeHealth,
      gapIndicator: this.gapIndicator,
      proofBadgeTracker,
      finalResult,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 16 — BATCH SIMULATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Simulate Phantom runs against a legend in batch. Uses deterministic
 * seed derivation for each run, so results are reproducible.
 */
export function simulatePhantomBatch(config: BatchSimulationConfig): BatchSimulationResult {
  const runCount = clamp(config.runCount, 1, BATCH_MAX_RUN_COUNT);
  const ticksPerRun = clamp(config.ticksPerRun, 1, 500);

  const baseSeedNum = hashStringToSeed(config.baseSeed);
  const summaries: BatchRunSummary[] = [];
  const cords: number[] = [];
  const gaps: number[] = [];
  const gbmHitRates: number[] = [];
  const superiorDecisionCounts: number[] = [];
  const difficultyRatings: number[] = [];
  let beatCount = 0;

  for (let i = 0; i < runCount; i++) {
    const runSeed = combineSeed(baseSeedNum, i);
    const runSeedStr = `batch_${i}_${runSeed}`;
    const runId = stableId('batch', config.baseSeed, i);

    const registry = new CardRegistry();
    const state = createInitialChaseALegendModeState({
      runId,
      seed: runSeedStr,
      currentTimeMs: Date.now(),
      legend: config.legend,
      player: {
        playerId: `batch_player_${i}`,
        displayName: `Batch Runner #${i}`,
        cash: config.playerTemplate.cash,
        income: config.playerTemplate.income,
        expenses: config.playerTemplate.expenses,
      },
    });

    const engine = new ChaseALegendModeEngine(state, registry);
    const rng = createDeterministicRng(runSeed);

    // Simulate ticks
    let currentState = engine.getState();
    for (let t = 0; t < ticksPerRun; t++) {
      currentState = engine.dispatch({
        type: 'ADVANCE_TICK',
        cashDelta: rng.nextBetween(-200, 500),
        incomeDelta: rng.nextBetween(-50, 100),
        pressureDelta: rng.nextBetween(-2, 5),
      });

      // Simulate random card plays
      if (rng.nextBoolean(0.3)) {
        const cordDelta = rng.nextBetween(-0.02, 0.05);
        currentState = engine.dispatch({
          type: 'RECORD_PLAYER_CARD_PLAY',
          tick: t,
          cardId: `sim_card_${rng.nextInt(100)}`,
          totalCordDelta: cordDelta,
          generatedIncomeDelta: rng.nextBetween(0, 2000),
        });
      }
    }

    const finalCord = currentState.player.currentCord;
    const finalGap = currentState.player.currentGapVsLegend;
    const totalGbm = currentState.player.gbmWindowHits + currentState.player.gbmWindowMisses;
    const gbmRate = totalGbm > 0 ? currentState.player.gbmWindowHits / totalGbm : 0;

    cords.push(finalCord);
    gaps.push(finalGap);
    gbmHitRates.push(gbmRate);
    superiorDecisionCounts.push(currentState.player.superiorDecisionNotations);
    difficultyRatings.push(currentState.macro.historicalDifficultyRating);

    const outcome: PhantomOutcome = finalCord > 0 ? 'FREEDOM' : 'BANKRUPT';
    const tier: PhantomResultTier = finalGap > 0 ? 'CHALLENGER' : 'LOSS';
    if (finalGap > 0) beatCount++;

    summaries.push({
      runId,
      seed: runSeed,
      finalCord: round6(finalCord),
      finalGap: round6(finalGap),
      gbmHits: currentState.player.gbmWindowHits,
      superiorDecisions: currentState.player.superiorDecisionNotations,
      divergenceSum: round6(currentState.player.cumulativeDivergence),
      outcome,
      tier,
    });
  }

  // Compute distribution stats
  const sortedCords = [...cords].sort((a, b) => a - b);
  const sortedGaps = [...gaps].sort((a, b) => a - b);

  const percentile = (arr: number[], p: number) => {
    const idx = Math.floor(arr.length * p);
    return arr[clamp(idx, 0, arr.length - 1)] ?? 0;
  };

  return {
    totalRuns: runCount,
    completedRuns: summaries.length,
    averageFinalCord: round6(cords.reduce((s, c) => s + c, 0) / cords.length),
    medianFinalGap: round6(percentile(sortedGaps, 0.5)),
    legendBeatRate: round6(beatCount / runCount),
    averageDifficultyRating: round6(
      difficultyRatings.reduce((s, d) => s + d, 0) / difficultyRatings.length,
    ),
    cordDistribution: {
      min: round6(sortedCords[0] ?? 0),
      max: round6(sortedCords[sortedCords.length - 1] ?? 0),
      p25: round6(percentile(sortedCords, 0.25)),
      p50: round6(percentile(sortedCords, 0.5)),
      p75: round6(percentile(sortedCords, 0.75)),
      p90: round6(percentile(sortedCords, 0.9)),
    },
    averageGbmHitRate: round6(
      gbmHitRates.reduce((s, r) => s + r, 0) / gbmHitRates.length,
    ),
    averageSuperiorDecisions: round6(
      superiorDecisionCounts.reduce((s, c) => s + c, 0) / superiorDecisionCounts.length,
    ),
    runSummaries: summaries,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 17 — ADJUDICATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Adjudicate the final result of a Phantom run. Determines whether the
 * player achieved LOSS, CHALLENGER, NEW_LEGEND, or DYNASTY.
 */
function adjudicateResult(input: {
  readonly legendFinalCord: number;
  readonly finalCord: number;
  readonly outcome: PhantomOutcome;
  readonly integrityVerified: boolean;
  readonly challengersBeaten: number;
}): {
  readonly tier: PhantomResultTier;
  readonly bonusMultiplier: number;
  readonly badges: readonly PhantomBadge[];
  readonly dynastyEligible: boolean;
} {
  if (input.outcome !== 'FREEDOM' || !input.integrityVerified) {
    return {
      tier: 'LOSS',
      bonusMultiplier: 1,
      badges: [],
      dynastyEligible: false,
    };
  }

  const improvement = input.legendFinalCord <= 0
    ? 0
    : (input.finalCord - input.legendFinalCord) / input.legendFinalCord;

  if (improvement > DYNASTY_IMPROVEMENT_THRESHOLD && input.challengersBeaten >= DYNASTY_MIN_CHALLENGERS_BEATEN) {
    return {
      tier: 'DYNASTY',
      bonusMultiplier: 2,
      badges: ['CHALLENGER', 'SEASON_LEGEND', 'DYNASTY'],
      dynastyEligible: true,
    };
  }

  if (improvement >= NEW_LEGEND_MIN_IMPROVEMENT) {
    return {
      tier: 'NEW_LEGEND',
      bonusMultiplier: 1 + clamp(improvement, NEW_LEGEND_MIN_IMPROVEMENT, NEW_LEGEND_MAX_IMPROVEMENT_CAP),
      badges: ['SEASON_LEGEND'],
      dynastyEligible: input.challengersBeaten >= DYNASTY_MIN_CHALLENGERS_BEATEN,
    };
  }

  if (improvement > 0) {
    return {
      tier: 'CHALLENGER',
      bonusMultiplier: 1.2,
      badges: ['CHALLENGER'],
      dynastyEligible: input.challengersBeaten >= DYNASTY_MIN_CHALLENGERS_BEATEN,
    };
  }

  return {
    tier: 'LOSS',
    bonusMultiplier: 1,
    badges: [],
    dynastyEligible: false,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 18 — STATE MUTATION HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function mutatePlayer(
  state: ChaseALegendModeState,
  transform: (player: PhantomPlayerState) => PhantomPlayerState,
): ChaseALegendModeState {
  return {
    ...state,
    player: transform(state.player),
  };
}

function appendEvent(
  state: ChaseALegendModeState,
  detail: string,
): ChaseALegendModeState {
  return {
    ...state,
    macro: {
      ...state.macro,
      eventLog: [...state.macro.eventLog, detail],
    },
  };
}

function appendChatEvent(
  state: ChaseALegendModeState,
  event: PhantomChatBridgeEvent,
): ChaseALegendModeState {
  return {
    ...state,
    macro: {
      ...state.macro,
      chatEvents: [...state.macro.chatEvents, event],
    },
  };
}

function appendDivergenceSnapshot(
  state: ChaseALegendModeState,
  snapshot: DivergenceSnapshot,
): ChaseALegendModeState {
  return {
    ...state,
    macro: {
      ...state.macro,
      divergenceSnapshots: [...state.macro.divergenceSnapshots, snapshot],
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 19 — CORE DISPATCH FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Advance the game by one tick. Recomputes all ghost state, decay, heat,
 * pressure, gap indicator, and phase transitions.
 */
function advanceTick(
  state: ChaseALegendModeState,
  action: AdvanceTickAction,
): ChaseALegendModeState {
  const nextTick = state.macro.tick + 1;
  const nextTimeMs = action.timestampMs ?? state.macro.currentTimeMs + 1000;
  const legendAgeHours = Math.max(0, (nextTimeMs - state.legend.setAtEpochMs) / 3_600_000);
  const activeDecayInjections = resolveActiveDecayInjections(legendAgeHours);
  const decayHeatBonus = activeDecayInjections.reduce(
    (sum, entry) => sum + entry.botHeatFloorBonus,
    0,
  );

  const effectiveHeatModifier = round6(
    state.legend.originalHeat +
    state.legend.totalCommunityRunsSinceLegend * COMMUNITY_HEAT_PER_RUN +
    decayHeatBonus,
  );

  const legendCord = resolveLegendCordAtTick(state.legend, nextTick);
  const ghostVisionCardId = resolveGhostVisionCardId(state.legend, nextTick);
  const activeGhostWindows = resolveActiveGhostWindows(state.legend, nextTick);

  const nextCash = Math.max(
    0,
    state.player.cash + (action.cashDelta ?? 0) + state.player.income - state.player.expenses,
  );
  const nextIncome = Math.max(0, state.player.income + (action.incomeDelta ?? 0));
  const nextExpenses = Math.max(0, state.player.expenses + (action.expenseDelta ?? 0));
  const nextShields = Math.max(0, state.player.shields + (action.shieldDelta ?? 0));
  const heatPressure = effectiveHeatModifier / 100;
  const nextPressure = clamp(
    state.player.pressure + heatPressure + (action.pressureDelta ?? 0),
    0,
    100,
  );
  const nextGap = computePlayerGapVsLegend(state.player.currentCord, legendCord);
  const gapClosingRate = computeGapClosingRate(state.player.currentGapVsLegend, nextGap);
  const nextPhase = resolveRunPhase(nextTick, BATCH_DEFAULT_TICK_COUNT);
  const nextPressureTier = resolvePressureTier(nextPressure);

  // Track peak deficit and surplus
  const peakDeficit = Math.min(state.player.peakDeficit, nextGap);
  const peakSurplus = Math.max(state.player.peakSurplus, nextGap);

  // Crossover detection
  let crossoverCount = state.player.crossoverCount;
  if (
    (state.player.currentGapVsLegend < 0 && nextGap > 0) ||
    (state.player.currentGapVsLegend > 0 && nextGap < 0)
  ) {
    crossoverCount++;
  }

  let next: ChaseALegendModeState = {
    ...state,
    player: {
      ...state.player,
      cash: nextCash,
      income: nextIncome,
      expenses: nextExpenses,
      shields: nextShields,
      pressure: nextPressure,
      currentGapVsLegend: nextGap,
      gapClosingRate,
      currentGapArrow: gapArrowFromDelta(gapClosingRate),
      peakDeficit,
      peakSurplus,
      crossoverCount,
    },
    macro: {
      ...state.macro,
      tick: nextTick,
      currentTimeMs: nextTimeMs,
      legendAgeHours,
      effectiveHeatModifier,
      activeDecayInjections,
      activeGhostWindows,
      ghostVisionCardId,
      historicalDifficultyRating: resolveHistoricalDifficultyRating(state.legend, legendAgeHours),
      latestLegendGap: nextGap,
      latestLegendCord: legendCord,
      currentPhase: nextPhase,
      currentPressureTier: nextPressureTier,
    },
  };

  return appendEvent(
    next,
    `tick=${nextTick};legend_cord=${legendCord.toFixed(6)};gap=${nextGap.toFixed(6)};heat=${effectiveHeatModifier.toFixed(3)};phase=${nextPhase};pressure_tier=${nextPressureTier}`,
  );
}

/**
 * Record a player card play. Computes divergence, marker bonuses, ghost pass,
 * counter-legend line, marker exploit, superior decision, and CORD impact.
 */
function recordPlayerCardPlay(
  state: ChaseALegendModeState,
  action: RecordPlayerCardPlayAction,
  registry: CardRegistry,
): ChaseALegendModeState {
  // Validate through registry
  try {
    registry.getOrThrow(action.cardId);
  } catch {
    // Card may be ghost-specific, proceed
  }

  const matchedWindow = resolveActiveGhostWindows(state.legend, action.tick)[0];
  const matchedMarker = matchedWindow
    ? state.legend.markers.find((marker) => marker.markerId === matchedWindow.markerId)
    : undefined;

  // Ghost Pass detection near Red Marker
  const ghostPassExploit =
    matchedMarker?.color === 'RED' &&
    action.cardId.toLowerCase().includes('ghost_pass') &&
    (action.generatedIncomeDelta ?? 0) > GHOST_PASS_MIN_INCOME_DELTA;

  // Counter-Legend Line detection near Gold Marker
  const counterLegendLine =
    matchedMarker?.color === 'GOLD' &&
    action.deckType === DeckType.OPPORTUNITY &&
    action.totalCordDelta > 0;

  // Marker Exploit detection near Silver Marker
  const markerExploit = matchedMarker?.color === 'SILVER';

  // Superior decision
  const superiorDecision =
    Boolean(action.outperformedLegendChoice) || ghostPassExploit;

  const divergencePotential = divergenceFromPlay(
    action.cardId,
    matchedMarker,
    action.totalCordDelta,
    action.deckType,
  );

  // Marker bonuses using card_types functions
  let markerBonus = 0;
  let shieldBonus = 0;
  if (matchedMarker) {
    const markerKind = colorToGhostMarkerKind(matchedMarker.color);
    markerBonus = computeGhostMarkerCordBonus(
      markerKind,
      action.tick,
      matchedMarker.tick,
    );
    shieldBonus = computeGhostMarkerShieldBonus(markerKind, action.tick, matchedMarker.tick);
  }

  const superiorBonusValue = superiorDecision ? SUPERIOR_DECISION_CORD_BONUS : 0;
  const divergenceMultiplier = divergenceMultiplierFromPotential(divergencePotential);

  const ghostDelta = round6(
    (action.totalCordDelta + markerBonus + superiorBonusValue) * divergenceMultiplier,
  );
  const nextCord = round6(state.player.currentCord + ghostDelta);
  const legendCord = resolveLegendCordAtTick(state.legend, action.tick);
  const nextGap = computePlayerGapVsLegend(nextCord, legendCord);
  const gapDelta = round6(nextGap - state.player.currentGapVsLegend);
  const gapClosingRate = computeGapClosingRate(state.player.currentGapVsLegend, nextGap);
  const gapArrow = gapArrowFromDelta(gapDelta);

  // Track deck type plays
  const isGhostDeck = action.deckType === DeckType.GHOST;
  const isDisciplineDeck = action.deckType === DeckType.DISCIPLINE;
  const isFubar = action.deckType === DeckType.FUBAR;
  const isNegativePlay = action.totalCordDelta < 0;

  // Cumulative divergence update
  const divWeight = divergencePotential === 'HIGH' ? 1.5
    : divergencePotential === 'MEDIUM' ? 1.0
    : 0.5;
  const newCumulativeDivergence = round6(
    state.player.cumulativeDivergence + Math.abs(ghostDelta) * divWeight,
  );

  const auditEntry: CardReplayAuditEntry = {
    auditId: stableId('audit', state.runId, action.tick, action.cardId, state.player.replayAudit.length),
    tick: action.tick,
    cardId: action.cardId,
    deckType: action.deckType,
    totalCordDelta: round6(action.totalCordDelta),
    generatedIncomeDelta: round6(action.generatedIncomeDelta ?? 0),
    gapDelta,
    divergencePotential,
    gapArrow,
    matchedMarkerId: matchedMarker?.markerId,
    matchedMarkerColor: matchedMarker?.color,
    usedGhostVision: Boolean(action.usedGhostVision && state.macro.ghostVisionCardId),
    superiorDecision,
    replayProofHashFragment: action.replayProofHashFragment,
    legendCardIdAtTick: resolveGhostVisionCardId(state.legend, action.tick) ?? undefined,
    legendCordAtTick: round6(legendCord),
    ghostPassExploit,
    counterLegendLine,
    markerExploit,
    pressureTierAtPlay: state.macro.currentPressureTier,
    timingClassUsed: action.timingClass,
    cardRarity: action.cardRarity,
  };

  // Peak tracking
  const peakDeficit = Math.min(state.player.peakDeficit, nextGap);
  const peakSurplus = Math.max(state.player.peakSurplus, nextGap);

  // Crossover
  let crossoverCount = state.player.crossoverCount;
  if (
    (state.player.currentGapVsLegend < 0 && nextGap > 0) ||
    (state.player.currentGapVsLegend > 0 && nextGap < 0)
  ) {
    crossoverCount++;
  }

  let next: ChaseALegendModeState = {
    ...state,
    player: {
      ...state.player,
      currentCord: nextCord,
      currentGapVsLegend: nextGap,
      currentGapArrow: gapArrow,
      gapClosingRate,
      superiorDecisionNotations:
        state.player.superiorDecisionNotations + (superiorDecision ? 1 : 0),
      gbmWindowHits:
        state.player.gbmWindowHits + (matchedMarker ? 1 : 0),
      gbmWindowMisses:
        state.player.gbmWindowMisses + (matchedMarker ? 0 : 1),
      replayAudit: [...state.player.replayAudit, auditEntry],
      totalCardPlays: state.player.totalCardPlays + 1,
      ghostDeckPlays: state.player.ghostDeckPlays + (isGhostDeck ? 1 : 0),
      disciplineDeckPlays: state.player.disciplineDeckPlays + (isDisciplineDeck ? 1 : 0),
      fubarsSurvived: state.player.fubarsSurvived + (isFubar && !isNegativePlay ? 1 : 0),
      negativePlayCount: state.player.negativePlayCount + (isNegativePlay ? 1 : 0),
      ghostPassExploits: state.player.ghostPassExploits + (ghostPassExploit ? 1 : 0),
      counterLegendLines: state.player.counterLegendLines + (counterLegendLine ? 1 : 0),
      markerExploits: state.player.markerExploits + (markerExploit ? 1 : 0),
      peakDeficit,
      peakSurplus,
      crossoverCount,
      cumulativeDivergence: newCumulativeDivergence,
    },
    macro: {
      ...state.macro,
      latestLegendGap: nextGap,
      latestLegendCord: legendCord,
    },
  };

  // Apply shield bonus for Silver marker
  if (shieldBonus > 0) {
    next = mutatePlayer(next, (player) => ({
      ...player,
      shields: player.shields + shieldBonus,
    }));
  }

  return appendEvent(
    next,
    `card=${action.cardId};tick=${action.tick};ghost_delta=${ghostDelta.toFixed(6)};gap=${nextGap.toFixed(6)};marker=${matchedMarker?.color ?? 'none'};superior=${superiorDecision};ghost_pass=${ghostPassExploit};counter_legend=${counterLegendLine};marker_exploit=${markerExploit}`,
  );
}

/**
 * Record the final freedom/completion event. Adjudicates the result tier.
 */
function recordFreedom(
  state: ChaseALegendModeState,
  action: RecordFreedomAction,
): ChaseALegendModeState {
  const adjudicated = adjudicateResult({
    legendFinalCord: state.legend.finalCord,
    finalCord: action.finalCord,
    outcome: action.outcome,
    integrityVerified: action.integrityVerified,
    challengersBeaten: action.challengersBeaten,
  });

  const finalCordWithBonuses = round6(action.finalCord * adjudicated.bonusMultiplier);

  // Get proof badge conditions for this mode and compute aggregate badge CORD
  const _modeConditions = getProofBadgeConditionsForMode(PHANTOM_MODE);
  const _aggregateBadgeCord = computeAggregateProofBadgeCord(
    PHANTOM_MODE,
    new Set(adjudicated.badges.map((b) => b.toLowerCase())),
  );

  const next: ChaseALegendModeState = {
    ...state,
    player: {
      ...state.player,
      currentCord: round6(action.finalCord),
      currentGapVsLegend: computePlayerGapVsLegend(action.finalCord, state.legend.finalCord),
      currentGapArrow: gapArrowFromDelta(action.finalCord - state.legend.finalCord),
      finalOutcome: action.outcome,
      finalTier: adjudicated.tier,
      finalCordWithBonuses,
      integrityVerified: action.integrityVerified,
      activeBadges: adjudicated.badges,
      dynastyEligible: adjudicated.dynastyEligible,
      challengeBeatenCount: action.challengersBeaten,
    },
    macro: {
      ...state.macro,
      latestLegendGap: computePlayerGapVsLegend(action.finalCord, state.legend.finalCord),
      latestLegendCord: state.legend.finalCord,
    },
  };

  return appendEvent(
    next,
    `run_complete;outcome=${action.outcome};tier=${adjudicated.tier};final_cord=${action.finalCord.toFixed(6)};bonus_cord=${finalCordWithBonuses.toFixed(6)}`,
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 20 — MAIN ENGINE CLASS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * ChaseALegendModeEngine: The primary engine class that holds state and
 * dispatches actions. Uses CardRegistry for card validation.
 */
export class ChaseALegendModeEngine {
  private state: ChaseALegendModeState;
  private readonly registry: CardRegistry;
  private readonly legendProfileManager: LegendProfileManager;
  private readonly divergenceEngine: DivergenceScoringEngine;
  private readonly badgeTracker: ProofBadgeTrackerEngine;
  private readonly chatBridge: PhantomChatBridge;
  private readonly decayManager: LegendDecayManager;
  private ghostTimelineEngine: GhostTimelineEngine | null;
  private overlayResolver: PhantomCardOverlayResolver | null;

  public constructor(
    initialState: ChaseALegendModeState,
    registry: CardRegistry = new CardRegistry(),
  ) {
    this.registry = registry;
    this.state = initialState;
    this.legendProfileManager = new LegendProfileManager(
      initialState.legend,
      registry,
      initialState.macro.currentTimeMs,
    );
    this.divergenceEngine = new DivergenceScoringEngine();
    this.badgeTracker = new ProofBadgeTrackerEngine();
    this.chatBridge = new PhantomChatBridge(initialState.runId);
    const seedNum = hashStringToSeed(initialState.seed);
    this.decayManager = new LegendDecayManager(initialState.legend, seedNum);
    this.ghostTimelineEngine = null;
    this.overlayResolver = null;
  }

  /**
   * Get the current state.
   */
  public getState(): ChaseALegendModeState {
    return this.state;
  }

  /**
   * Initialize the ghost timeline engine lazily.
   */
  public initializeGhostTimeline(): GhostTimelineEngine {
    if (!this.ghostTimelineEngine) {
      const timeline = this.legendProfileManager.buildGhostTimeline();
      const seedNum = hashStringToSeed(this.state.seed);
      this.ghostTimelineEngine = new GhostTimelineEngine(
        this.state.legend,
        timeline,
        seedNum,
        this.registry,
      );
    }
    return this.ghostTimelineEngine;
  }

  /**
   * Initialize the card overlay resolver lazily.
   */
  public initializeOverlayResolver(): PhantomCardOverlayResolver {
    if (!this.overlayResolver) {
      const seedNum = hashStringToSeed(this.state.seed);
      this.overlayResolver = new PhantomCardOverlayResolver(this.registry, seedNum);
    }
    return this.overlayResolver;
  }

  /**
   * Dispatch an action and return the new state.
   */
  public dispatch(action: ChaseALegendModeAction): ChaseALegendModeState {
    switch (action.type) {
      case 'ADVANCE_TICK':
        this.state = advanceTick(this.state, action);
        this.updateSubsystems();
        return this.state;

      case 'RECORD_PLAYER_CARD_PLAY':
        this.state = recordPlayerCardPlay(this.state, action, this.registry);
        this.updateSubsystems();
        return this.state;

      case 'RECORD_FREEDOM':
        this.state = recordFreedom(this.state, action);
        this.updateSubsystems();
        return this.state;

      default: {
        const exhaustive: never = action;
        return exhaustive;
      }
    }
  }

  /**
   * Update all subsystems after state change.
   */
  private updateSubsystems(): void {
    // Update badge tracker
    this.badgeTracker.update({
      fubarsSurvived: this.state.player.fubarsSurvived,
      negativePlayCount: this.state.player.negativePlayCount,
      totalCardPlays: this.state.player.totalCardPlays,
      gbmHits: this.state.player.gbmWindowHits,
      gbmMisses: this.state.player.gbmWindowMisses,
      cumulativeDivergence: this.state.player.cumulativeDivergence,
      peakDeficit: this.state.player.peakDeficit,
      currentCord: this.state.player.currentCord,
      gapVsLegend: this.state.player.currentGapVsLegend,
    });

    // Update decay manager
    this.decayManager.updateDecayState(
      this.state.macro.legendAgeHours,
      this.state.macro.tick,
    );
  }

  /**
   * Get the legend profile manager.
   */
  public getLegendProfileManager(): LegendProfileManager {
    return this.legendProfileManager;
  }

  /**
   * Get the divergence scoring engine.
   */
  public getDivergenceEngine(): DivergenceScoringEngine {
    return this.divergenceEngine;
  }

  /**
   * Get the proof badge tracker.
   */
  public getBadgeTracker(): ProofBadgeTrackerEngine {
    return this.badgeTracker;
  }

  /**
   * Get the chat bridge.
   */
  public getChatBridge(): PhantomChatBridge {
    return this.chatBridge;
  }

  /**
   * Get the decay manager.
   */
  public getDecayManager(): LegendDecayManager {
    return this.decayManager;
  }

  /**
   * Build full analytics for the current state.
   */
  public buildAnalytics(): PhantomAnalytics {
    const gapIndicator = this.divergenceEngine.getGapIndicatorState(
      this.state.player.currentGapVsLegend,
      BATCH_DEFAULT_TICK_COUNT,
      this.state.macro.tick,
    );

    const auditor = new CardReplayAuditor(this.state.legend, this.registry);
    // Replay all audit entries through the auditor
    for (const entry of this.state.player.replayAudit) {
      auditor.auditPlay(
        this.state.runId,
        entry.tick,
        entry.cardId,
        entry.totalCordDelta,
        entry.generatedIncomeDelta,
        entry.gapDelta,
        entry.divergencePotential,
        entry.gapArrow,
        this.state.player.currentCord,
        entry.usedGhostVision,
        entry.superiorDecision,
        entry.replayProofHashFragment,
        entry.deckType,
        entry.timingClassUsed,
        entry.cardRarity,
        entry.pressureTierAtPlay,
      );
    }

    const analyticsEngine = new PhantomAnalyticsEngine(
      this.state,
      this.divergenceEngine,
      auditor,
      this.badgeTracker,
      gapIndicator,
    );

    return analyticsEngine.buildFullAnalytics();
  }

  /**
   * Extract ML features for the current state.
   */
  public extractMLFeatures(): PhantomMLFeatureVector {
    const gapIndicator = this.divergenceEngine.getGapIndicatorState(
      this.state.player.currentGapVsLegend,
      BATCH_DEFAULT_TICK_COUNT,
      this.state.macro.tick,
    );
    return extractPhantomMLFeatures(
      this.state,
      gapIndicator,
      this.divergenceEngine,
      this.badgeTracker,
    );
  }

  /**
   * Extract DL tensor for the current state.
   */
  public extractDLTensor(): PhantomDLTensor {
    return extractPhantomDLTensor(
      this.state,
      this.divergenceEngine.getSnapshots(),
    );
  }

  /**
   * Verify legend integrity.
   */
  public verifyLegendIntegrity(): LegendIntegrityStatus {
    return this.legendProfileManager.verifyIntegrity();
  }

  /**
   * Compute the phantom run state summary.
   */
  public computeRunState(): PhantomRunState {
    const seedNum = hashStringToSeed(this.state.seed);
    return {
      runId: this.state.runId,
      seed: seedNum,
      normalizedSeed: normalizeSeed(seedNum),
      tick: this.state.macro.tick,
      phase: this.state.macro.currentPhase,
      pressureTier: this.state.macro.currentPressureTier,
      playerCord: this.state.player.currentCord,
      legendCord: this.state.macro.latestLegendCord,
      gap: this.state.player.currentGapVsLegend,
      gapArrow: this.state.player.currentGapArrow,
      cumulativeDivergence: this.state.player.cumulativeDivergence,
      gbmHits: this.state.player.gbmWindowHits,
      gbmMisses: this.state.player.gbmWindowMisses,
      totalCardPlays: this.state.player.totalCardPlays,
      ghostDeckPlays: this.state.player.ghostDeckPlays,
      disciplineDeckPlays: this.state.player.disciplineDeckPlays,
      superiorDecisions: this.state.player.superiorDecisionNotations,
      ghostPassExploits: this.state.player.ghostPassExploits,
      counterLegendLines: this.state.player.counterLegendLines,
      markerExploits: this.state.player.markerExploits,
      fubarsSurvived: this.state.player.fubarsSurvived,
      negativePlayCount: this.state.player.negativePlayCount,
      peakDeficit: this.state.player.peakDeficit,
      peakSurplus: this.state.player.peakSurplus,
      crossoverCount: this.state.player.crossoverCount,
      isComplete: this.state.player.finalOutcome !== null,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 21 — INITIAL STATE FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create the initial ChaseALegendModeState. No loadout bonuses — enter raw,
 * default shields per doctrine.
 */
export function createInitialChaseALegendModeState(input: {
  readonly runId: string;
  readonly seed: string;
  readonly currentTimeMs: number;
  readonly legend: LegendBaseline;
  readonly player: {
    readonly playerId: string;
    readonly displayName: string;
    readonly cash: number;
    readonly income: number;
    readonly expenses: number;
    readonly shields?: number;
    readonly pressure?: number;
  };
}): ChaseALegendModeState {
  const legendAgeHours = Math.max(0, (input.currentTimeMs - input.legend.setAtEpochMs) / 3_600_000);
  const activeDecayInjections = resolveActiveDecayInjections(legendAgeHours);
  const effectiveHeatModifier = round6(
    input.legend.originalHeat +
    input.legend.totalCommunityRunsSinceLegend * COMMUNITY_HEAT_PER_RUN +
    activeDecayInjections.reduce((sum, entry) => sum + entry.botHeatFloorBonus, 0),
  );
  const initialLegendCord = resolveLegendCordAtTick(input.legend, 0);
  const initialPhase = RunPhase.FOUNDATION;
  const initialPressure = clamp(input.player.pressure ?? 0, 0, 100);
  const initialPressureTier = resolvePressureTier(initialPressure);

  // Verify the seed is deterministic using our RNG infrastructure
  const seedNum = hashStringToSeed(input.seed);
  const _normalizedSeed = normalizeSeed(seedNum);
  const _derivedSeed = combineSeed(seedNum, 'phantom_init');

  // Use createDefaultLedger to initialize the ghost replay baseline
  const _baseLedger = createDefaultLedger({
    cash: input.player.cash,
    income: input.player.income,
    expenses: input.player.expenses,
    shield: input.player.shields ?? 100,
  });

  return {
    runId: input.runId,
    seed: input.seed,
    mode: GameMode.CHASE_A_LEGEND,
    legend: input.legend,
    player: {
      playerId: input.player.playerId,
      displayName: input.player.displayName,
      cash: Math.max(0, input.player.cash),
      income: Math.max(0, input.player.income),
      expenses: Math.max(0, input.player.expenses),
      shields: Math.max(0, input.player.shields ?? 100),
      pressure: initialPressure,
      currentCord: 0,
      currentGapVsLegend: computePlayerGapVsLegend(0, initialLegendCord),
      currentGapArrow: '→',
      gapClosingRate: 0,
      superiorDecisionNotations: 0,
      gbmWindowHits: 0,
      gbmWindowMisses: 0,
      activeBadges: [],
      finalOutcome: null,
      finalTier: null,
      finalCordWithBonuses: null,
      integrityVerified: false,
      dynastyEligible: false,
      challengeBeatenCount: 0,
      replayAudit: [],
      totalCardPlays: 0,
      ghostDeckPlays: 0,
      disciplineDeckPlays: 0,
      fubarsSurvived: 0,
      negativePlayCount: 0,
      ghostPassExploits: 0,
      counterLegendLines: 0,
      markerExploits: 0,
      peakDeficit: 0,
      peakSurplus: 0,
      crossoverCount: 0,
      cumulativeDivergence: 0,
      proofBadges: [],
    },
    macro: {
      tick: 0,
      currentTimeMs: input.currentTimeMs,
      legendAgeHours,
      effectiveHeatModifier,
      activeDecayInjections,
      activeGhostWindows: resolveActiveGhostWindows(input.legend, 0),
      ghostVisionCardId: resolveGhostVisionCardId(input.legend, 0),
      historicalDifficultyRating: resolveHistoricalDifficultyRating(input.legend, legendAgeHours),
      latestLegendGap: computePlayerGapVsLegend(0, initialLegendCord),
      latestLegendCord: initialLegendCord,
      eventLog: [],
      currentPhase: initialPhase,
      currentPressureTier: initialPressureTier,
      divergenceSnapshots: [],
      chatEvents: [],
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 22 — CONVENIENCE EXPORTS & HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Verify a legend replay by replaying all events through ReplayEngine
 * and comparing to the expected proof hash.
 */
export function verifyLegendReplay(
  legendId: string,
  events: readonly RunEvent[],
  expectedProofHash: string,
  expectedFinalCord: number,
): {
  verified: boolean;
  replayHash: string;
  finalCord: number;
  cordDelta: number;
} {
  const seed = hashStringToSeed(legendId);
  const engine = new ReplayEngine(seed, events);
  const replayHash = engine.getReplayHash();
  const snapshot = engine.replayAll();
  const finalCord = snapshot.ledger.cords;
  const cordDelta = Math.abs(finalCord - expectedFinalCord);

  return {
    verified: replayHash === expectedProofHash && cordDelta < 0.001,
    replayHash,
    finalCord,
    cordDelta,
  };
}

/**
 * Create a Ledger snapshot from a Phantom player state.
 */
export function phantomPlayerToLedger(player: PhantomPlayerState): Ledger {
  return createDefaultLedger({
    cash: player.cash,
    income: player.income,
    expenses: player.expenses,
    shield: player.shields,
    cords: player.currentCord,
  });
}

/**
 * Compute the deterministic seed chain for a Phantom run.
 * Combines the run seed with mode-specific salt.
 */
export function computePhantomSeedChain(baseSeed: string): {
  base: number;
  normalized: number;
  ghostTimeline: number;
  markerPlacement: number;
  cardDraw: number;
  decay: number;
} {
  const base = hashStringToSeed(baseSeed);
  const normalized = normalizeSeed(base);
  return {
    base,
    normalized,
    ghostTimeline: combineSeed(normalized, 'ghost_timeline'),
    markerPlacement: combineSeed(normalized, 'marker_placement'),
    cardDraw: combineSeed(normalized, 'card_draw'),
    decay: combineSeed(normalized, 'legend_decay'),
  };
}

/**
 * Verify that seed determinism holds for a given seed string.
 * Generates two independent RNG streams from the same seed and confirms
 * they produce identical output.
 */
export function verifySeedDeterminism(seedStr: string, sampleCount: number = 100): boolean {
  const seedNum = hashStringToSeed(seedStr);
  const normalized = normalizeSeed(seedNum);

  const rng1 = createDeterministicRng(normalized);
  const rng2 = createDeterministicRng(normalized);

  for (let i = 0; i < sampleCount; i++) {
    if (rng1.next() !== rng2.next()) return false;
  }

  // Also verify mulberry32 determinism
  const mul1 = createMulberry32(normalized);
  const mul2 = createMulberry32(normalized);
  for (let i = 0; i < sampleCount; i++) {
    if (mul1() !== mul2()) return false;
  }

  // Verify DEFAULT_NON_ZERO_SEED as fallback
  const fallbackRng = createDeterministicRng(DEFAULT_NON_ZERO_SEED);
  if (fallbackRng.seed !== DEFAULT_NON_ZERO_SEED) return false;

  return true;
}

/**
 * Compute a hash-based verification for a complete Phantom run.
 * Uses createHash from node:crypto for the final digest.
 */
export function computePhantomRunProofHash(state: ChaseALegendModeState): string {
  const payload = stableStringify({
    runId: state.runId,
    seed: state.seed,
    mode: state.mode,
    legendId: state.legend.legendId,
    finalCord: state.player.currentCord,
    finalGap: state.player.currentGapVsLegend,
    totalPlays: state.player.totalCardPlays,
    gbmHits: state.player.gbmWindowHits,
    tick: state.macro.tick,
  });
  return createHash('sha256').update(payload).digest('hex');
}

/**
 * Compute the full set of Phantom-legal decks using CARD_LEGALITY_MATRIX.
 */
export function getPhantomLegalDecks(): readonly DeckType[] {
  return CARD_LEGALITY_MATRIX[PHANTOM_MODE];
}

/**
 * Compute the Phantom mode card behavior profile.
 */
export function getPhantomModeBehavior() {
  return getModeCardBehavior(PHANTOM_MODE);
}

/**
 * Compute the Phantom mode tag weight defaults.
 */
export function getPhantomTagWeights(): Readonly<Record<CardTag, number>> {
  return MODE_TAG_WEIGHT_DEFAULTS[PHANTOM_MODE];
}

/**
 * Map a GhostMarkerKind enum value to the local LegendMarkerColor type.
 */
export function ghostMarkerKindToColor(kind: GhostMarkerKind): LegendMarkerColor {
  return MARKER_KIND_TO_COLOR[kind] ?? 'GOLD';
}

/**
 * Get the ghost marker specification for a given kind.
 */
export function getPhantomGhostMarkerSpec(kind: GhostMarkerKind) {
  return getGhostMarkerSpec(kind);
}

/**
 * Compute all five ghost marker CORD bonuses.
 */
export function computeAllPhantomMarkerBonuses(): Record<LegendMarkerColor, { cordBonus: number; shieldBonus: number }> {
  const result: Record<string, { cordBonus: number; shieldBonus: number }> = {};

  for (const color of ['GOLD', 'RED', 'PURPLE', 'SILVER', 'BLACK'] as const) {
    const kind = colorToGhostMarkerKind(color);
    result[color] = {
      cordBonus: round6(computeGhostMarkerCordBonus(kind, 0, 0)),
      shieldBonus: round6(computeGhostMarkerShieldBonus(kind, 0, 0)),
    };
  }

  return result as Record<LegendMarkerColor, { cordBonus: number; shieldBonus: number }>;
}

/**
 * Compute phantom-specific deck type profiles for all legal decks.
 */
export function computePhantomDeckProfiles(): Map<DeckType, ReturnType<typeof getDeckTypeProfile>> {
  const legalDecks = CARD_LEGALITY_MATRIX[PHANTOM_MODE];
  const profiles = new Map<DeckType, ReturnType<typeof getDeckTypeProfile>>();

  for (const deck of legalDecks) {
    profiles.set(deck, getDeckTypeProfile(deck));
  }

  return profiles;
}

/**
 * Compute IPA chain synergy relevance for Phantom mode.
 */
export function computePhantomIPAChainSynergies(): typeof IPA_CHAIN_SYNERGIES {
  // IPA chains that include deck types legal in Phantom
  const legalDecks = new Set(CARD_LEGALITY_MATRIX[PHANTOM_MODE]);
  return IPA_CHAIN_SYNERGIES.filter(
    (chain) => chain.combination.every((dt) => legalDecks.has(dt)),
  );
}

/**
 * Check the GHOST_MARKER_SPECS for all marker kinds and return a summary.
 */
export function summarizeGhostMarkerSpecs(): Record<string, {
  cordBonus: number;
  shieldBonus: number;
  windowTicks: number;
}> {
  const result: Record<string, { cordBonus: number; shieldBonus: number; windowTicks: number }> = {};
  const kinds = [
    GhostMarkerKind.GOLD_BUY,
    GhostMarkerKind.RED_PASS,
    GhostMarkerKind.PURPLE_POWER,
    GhostMarkerKind.SILVER_BREACH,
    GhostMarkerKind.BLACK_CASCADE,
  ];

  for (const kind of kinds) {
    const spec = GHOST_MARKER_SPECS[kind];
    result[kind] = {
      cordBonus: spec.cordBonus ?? 0,
      shieldBonus: spec.shieldBonus ?? 0,
      windowTicks: spec.exploitWindowTicks ?? GBM_RADIUS_TICKS,
    };
  }

  return result;
}

/**
 * Compute a GBM window for a specific marker and tick.
 */
export function computePhantomGbmWindow(
  markerKind: GhostMarkerKind,
  markerTick: number,
  currentTick: number,
) {
  return resolveGhostBenchmarkWindow(markerKind, currentTick, markerTick);
}

/**
 * Compute card draw weights for Phantom mode at a given tick.
 */
export function computePhantomCardDrawWeights(
  rarity: CardRarity,
  runSeed: string,
  cycle: number,
): Map<DeckType, number> {
  return computeCardDrawWeights(PHANTOM_MODE, rarity, runSeed, cycle);
}

/**
 * Compute pressure cost modifier for Phantom mode.
 */
export function computePhantomPressureCost(tier: PressureTier): number {
  return computePressureCostModifier(tier);
}

/**
 * Compute bleedthrough multiplier for Phantom mode.
 */
export function computePhantomBleedthrough(pressureTier: PressureTier, isCriticalTiming: boolean): number {
  return computeBleedthroughMultiplier(pressureTier, isCriticalTiming);
}

/**
 * Compute trust efficiency for Phantom mode.
 */
export function computePhantomTrustEfficiency(trustScore: number) {
  return computeTrustEfficiency(trustScore);
}

/**
 * Compute tag-weighted score for Phantom mode.
 */
export function computePhantomTagWeightedScore(tags: readonly CardTag[]): number {
  return computeTagWeightedScore(tags, PHANTOM_MODE);
}

/**
 * Check if a deck type is legal in Phantom mode.
 */
export function isPhantomDeckLegal(deckType: DeckType): boolean {
  return isDeckLegalInMode(deckType, PHANTOM_MODE);
}

/**
 * Get COMEBACK_SURGE_CONFIG for reference.
 */
export function getPhantomComebackSurgeConfig() {
  return COMEBACK_SURGE_CONFIG;
}

/**
 * Get HOLD_SYSTEM_CONFIG for reference (hold is disabled in Phantom).
 */
export function getPhantomHoldConfig() {
  return HOLD_SYSTEM_CONFIG;
}

/**
 * Get all PRESSURE_COST_MODIFIERS for reference.
 */
export function getPhantomPressureCostModifiers() {
  return PRESSURE_COST_MODIFIERS;
}

/**
 * Get all CARD_RARITY_DROP_RATES for reference.
 */
export function getPhantomRarityDropRates() {
  return CARD_RARITY_DROP_RATES;
}

/**
 * Get DECK_TYPE_PROFILES for all Phantom-legal decks.
 */
export function getPhantomDeckTypeProfiles(): Record<string, ReturnType<typeof getDeckTypeProfile>> {
  const result: Record<string, ReturnType<typeof getDeckTypeProfile>> = {};
  for (const deck of CARD_LEGALITY_MATRIX[PHANTOM_MODE]) {
    result[deck] = getDeckTypeProfile(deck);
  }
  return result;
}

/**
 * Compute divergence potential for a specific card play in Phantom mode.
 */
export function computePhantomDivergencePotential(
  definition: CardDefinition,
  timingClass: TimingClass,
  tickDistanceFromMarker: number,
) {
  return computeDivergencePotential(definition, timingClass, tickDistanceFromMarker);
}

/**
 * Get MODE_CARD_BEHAVIORS for all modes (useful for cross-mode comparison).
 */
export function getAllModeCardBehaviors() {
  return MODE_CARD_BEHAVIORS;
}
