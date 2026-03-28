/*
 * POINT ZERO ONE — MODE CONTRACTS (CANONICAL)
 * Generated at: 2026-03-10T01:26:02.003447+00:00
 * Expanded: 2026-03-28
 *
 * Doctrine:
 * - backend owns mode truth, not the client
 * - four battlegrounds are materially different at runtime
 * - card legality, timing, targeting, and scoring are mode-native
 * - cross-player economies are server-owned
 * - CORD bonuses, proof conditions, and ghost logic are authoritative
 *
 * This file is the CANONICAL language for the entire mode system.
 * Every interface, type guard, and constant defined here is consumed
 * by mode adapters, the engine runtime, analytics pipelines,
 * the ML feature bridge, and the chat overlay system.
 *
 * Sections:
 *   S1  - Existing types (preserved verbatim from original)
 *   S2  - Deck & card overlay contracts
 *   S3  - Battle & bot contracts
 *   S4  - Pressure & rescue contracts
 *   S5  - Trust system contracts
 *   S6  - Shared objective contracts
 *   S7  - Defection contracts
 *   S8  - Phase boundary contracts
 *   S9  - Communication & combo card contracts
 *   S10 - ML/DL feature contracts
 *   S11 - Chat bridge contracts
 *   S12 - Analytics contracts
 *   S13 - Proof badge contracts
 *   S14 - Batch simulation contracts
 *   S15 - Convenience type guards
 *   S16 - Default/zero-value constants
 */

import type {
  CardDefinition,
  CardInstance,
  DeckType,
  HaterBotId,
  LegendMarker,
  ModeCode,
  PressureTier,
  Targeting,
  ThreatEnvelope,
  TimingClass,
} from '../engine/core/GamePrimitives';
import type { RunStateSnapshot } from '../engine/core/RunStateSnapshot';

// ============================================================================
// S1 - EXISTING TYPES (preserved exactly from original contracts)
// ============================================================================

export type TeamRoleId =
  | 'INCOME_BUILDER'
  | 'SHIELD_ARCHITECT'
  | 'OPPORTUNITY_HUNTER'
  | 'COUNTER_INTEL';

export type AdvantageId =
  | 'MOMENTUM_CAPITAL'
  | 'NETWORK_ACTIVATED'
  | 'FORECLOSURE_BLOCK'
  | 'INTEL_PASS'
  | 'PHANTOM_SEED'
  | 'DEBT_SHIELD';

export type HandicapId =
  | 'NO_CREDIT_HISTORY'
  | 'SINGLE_INCOME'
  | 'TARGETED'
  | 'CASH_POOR'
  | 'CLOCK_CURSED'
  | 'DISADVANTAGE_DRAFT';

export type ExtractionActionId =
  | 'MARKET_DUMP'
  | 'CREDIT_REPORT_PULL'
  | 'REGULATORY_FILING'
  | 'MISINFORMATION_FLOOD'
  | 'DEBT_INJECTION'
  | 'HOSTILE_TAKEOVER'
  | 'LIQUIDATION_NOTICE';

export type CounterCardId =
  | 'LIQUIDITY_WALL'
  | 'CREDIT_FREEZE'
  | 'EVIDENCE_FILE'
  | 'SIGNAL_CLEAR'
  | 'DEBT_SHIELD'
  | 'SOVEREIGNTY_LOCK'
  | 'FORCED_DRAW_BLOCK';

export type PsycheState = 'COMPOSED' | 'STRESSED' | 'CRACKING' | 'BREAKING' | 'DESPERATE';
export type VisibilityTier = 'SHADOWED' | 'SIGNALED' | 'TELEGRAPHED' | 'EXPOSED';
export type ModeEventLevel = 'INFO' | 'WARNING' | 'ALERT' | 'SUCCESS';
export type RunSplitDisposition = 'NONE' | 'TEAM_REMAINED' | 'DEFECTOR_SPLIT';

export interface ModeParticipant {
  playerId: string;
  snapshot: RunStateSnapshot;
  teamId: string | null;
  roleId: TeamRoleId | null;
  counters: CounterCardId[];
  metadata: Record<string, string | number | boolean | null>;
}

export interface SharedOpportunitySlot {
  slotId: string;
  cardId: string;
  introducedTick: number;
  refusalOwnerId: string | null;
  refusalExpiresTick: number;
  expiresTick: number;
  status: 'OPEN' | 'PURCHASED' | 'DISCARDED';
  purchasedBy: string | null;
}

export interface RivalryLedger {
  playerA: string;
  playerB: string;
  matchesPlayed: number;
  wins: Record<string, number>;
  archRivalUnlocked: boolean;
  nemesisUnlocked: boolean;
  carryHeatByPlayer: Record<string, number>;
}

export interface TrustAuditLine {
  playerId: string;
  trustScore: number;
  aidGivenCount: number;
  rescueCount: number;
  cascadeAbsorptions: number;
  loanRepaymentRate: number;
  defectionRiskSignal: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  notes: string[];
}

export interface SyndicateSharedState {
  treasuryBalance: number;
  freedomThreshold: number;
  freedPlayerIds: string[];
  defectedPlayerIds: string[];
  splitDisposition: RunSplitDisposition;
  trustAudit: Record<string, TrustAuditLine>;
}

export interface LegendBaseline {
  legendRunId: string;
  ownerUserId: string;
  seasonId: string;
  legendScore: number;
  originalHeat: number;
  daysAlive: number;
  communityRunsSince: number;
  markers: LegendMarker[];
  challengerScores: number[];
  challengerRunIds: string[];
  lastLegendCardId: string | null;
}

export interface ModeEvent {
  tick: number;
  level: ModeEventLevel;
  channel: 'SYSTEM' | 'TEAM' | 'SPECTATOR' | 'PRIVATE';
  actorId: string | null;
  code: string;
  message: string;
  payload?: Record<string, string | number | boolean | null>;
}

export interface CardPlayIntent {
  actorId: string;
  card: CardDefinition | CardInstance;
  timing: TimingClass;
  targetId?: string;
  targeting?: Targeting;
  declaredAtTick: number;
}

export interface CardDecisionAudit {
  actorId: string;
  cardId: string;
  mode: ModeCode;
  qualityScore: number;
  timingDeltaTicks: number;
  opportunityCost: number;
  notes: string[];
}

export interface ModeFrame {
  mode: ModeCode;
  tick: number;
  participants: ModeParticipant[];
  history: ModeEvent[];
  sharedThreats: ThreatEnvelope[];
  sharedOpportunitySlots: SharedOpportunitySlot[];
  rivalry: RivalryLedger | null;
  syndicate: SyndicateSharedState | null;
  legend: LegendBaseline | null;
}

export interface ModeValidationResult {
  ok: boolean;
  reason: string | null;
  warnings: string[];
}

export interface ModeFinalization {
  bonusMultiplier: number;
  flatBonus: number;
  badges: string[];
  audits: CardDecisionAudit[];
  notes: string[];
}

export interface ModeAdapter {
  readonly mode: ModeCode;
  bootstrap(frame: ModeFrame, options?: Record<string, unknown>): ModeFrame;
  onTickStart(frame: ModeFrame): ModeFrame;
  onTickEnd(frame: ModeFrame): ModeFrame;
  validateCardPlay(frame: ModeFrame, intent: CardPlayIntent): ModeValidationResult;
  applyCardOverlay(frame: ModeFrame, actorId: string, card: CardDefinition): CardInstance;
  resolveNamedAction(
    frame: ModeFrame,
    actorId: string,
    actionId: string,
    payload?: Record<string, unknown>,
  ): ModeFrame;
  finalize(frame: ModeFrame): ModeFinalization;
}

// ============================================================================
// S2 - DECK & CARD OVERLAY CONTRACTS
// ============================================================================

/**
 * Canonical legality map: which DeckTypes are legal in each ModeCode.
 * Every adapter consults this before allowing a card to enter a hand.
 */
export type DeckLegalityMap = Record<ModeCode, DeckType[]>;

/**
 * Full deck legality matrix as defined by doctrine.
 * Solo mode gets the broadest card pool. PvP excludes AID/RESCUE/TRUST.
 * Co-op adds AID/RESCUE/TRUST but drops SABOTAGE/BLUFF. Ghost strips
 * everything down to GHOST plus a curated set.
 */
export const MODE_DECK_LEGALITY: DeckLegalityMap = {
  solo: [
    'OPPORTUNITY',
    'IPA',
    'FUBAR',
    'MISSED_OPPORTUNITY',
    'PRIVILEGED',
    'SO',
    'SABOTAGE',
    'COUNTER',
    'DISCIPLINE',
    'BLUFF',
  ],
  pvp: [
    'OPPORTUNITY',
    'IPA',
    'FUBAR',
    'MISSED_OPPORTUNITY',
    'PRIVILEGED',
    'SO',
    'SABOTAGE',
    'COUNTER',
    'BLUFF',
    'DISCIPLINE',
  ],
  coop: [
    'OPPORTUNITY',
    'IPA',
    'FUBAR',
    'MISSED_OPPORTUNITY',
    'PRIVILEGED',
    'SO',
    'COUNTER',
    'AID',
    'RESCUE',
    'TRUST',
    'DISCIPLINE',
  ],
  ghost: [
    'GHOST',
    'OPPORTUNITY',
    'IPA',
    'COUNTER',
    'DISCIPLINE',
  ],
};

/**
 * Per-mode overlay that mutates a card when it enters a specific mode.
 * The engine applies these adjustments after drawing but before the card
 * becomes visible to the player.
 */
export interface ModeOverlayContract {
  /** Multiplier applied to the card base cost. 1.0 = no change. */
  costModifier: number;
  /** Multiplier applied to the card base effect magnitude. */
  effectModifier: number;
  /** Per-tag weight adjustments used by the scoring subsystem. */
  tagWeights: Partial<Record<string, number>>;
  /** If set, locks the card to this single timing class in this mode. */
  timingLock: TimingClass | null;
  /** Whether the card is legal at all in this mode (redundant with
   *  MODE_DECK_LEGALITY but used as a per-card override). */
  legal: boolean;
  /** If set, overrides the card default targeting in this mode. */
  targetingOverride: Targeting | null;
}

/**
 * Snapshot of all overlays applied to a specific CardInstance at a given tick.
 * Persisted in the run log for replay fidelity.
 */
export interface CardOverlaySnapshot {
  instanceId: string;
  definitionId: string;
  mode: ModeCode;
  appliedTick: number;
  overlay: ModeOverlayContract;
  /** The deck type of the card (used for legality cross-check). */
  deckType: DeckType;
  /** Resulting cost after overlay. */
  resolvedCost: number;
  /** Resulting targeting after overlay. */
  resolvedTargeting: Targeting;
  /** Resulting timing classes after overlay. */
  resolvedTimingClasses: TimingClass[];
}

/**
 * Profile metadata for a deck type inside a given mode.
 * Used by the deck-builder UI and by bot deck selection logic.
 */
export interface DeckProfile {
  deckType: DeckType;
  /** Thematic color hex code for the UI. */
  color: string;
  /** Human-readable role description. */
  roleDescription: string;
  /** Which modes this deck is restricted to (empty = all modes). */
  modeRestrictions: ModeCode[];
  /** Relative power weight used by the draft algorithm. */
  draftWeight: number;
  /** Average cards drawn per full run in this mode. */
  avgCardsPerRun: number;
}

/**
 * Per-tag scoring weight for a single mode. The scoring subsystem
 * multiplies a card tag score by the weight for its mode.
 */
export interface CardTagWeight {
  tag: string;
  mode: ModeCode;
  weight: number;
}

/** Canonical card tags recognized by the scoring subsystem. */
export type CardTag =
  | 'income'
  | 'shield'
  | 'investment'
  | 'debt_management'
  | 'credit_repair'
  | 'insurance'
  | 'education'
  | 'counter'
  | 'extraction'
  | 'sabotage'
  | 'aid'
  | 'rescue'
  | 'trust'
  | 'discipline'
  | 'bluff';

/** Number of canonical card tags. */
export const CARD_TAG_COUNT = 15 as const;

/**
 * Default tag weights: 15 tags x 4 modes.
 * Solo favors income and shields. PvP favors sabotage and counters.
 * Co-op favors aid/rescue/trust. Ghost favors discipline and bluff.
 */
export const DEFAULT_TAG_WEIGHTS: readonly CardTagWeight[] = [
  // --- solo ---
  { tag: 'income',           mode: 'solo', weight: 1.4 },
  { tag: 'shield',           mode: 'solo', weight: 1.3 },
  { tag: 'investment',       mode: 'solo', weight: 1.2 },
  { tag: 'debt_management',  mode: 'solo', weight: 1.1 },
  { tag: 'credit_repair',    mode: 'solo', weight: 1.0 },
  { tag: 'insurance',        mode: 'solo', weight: 1.0 },
  { tag: 'education',        mode: 'solo', weight: 1.1 },
  { tag: 'counter',          mode: 'solo', weight: 1.0 },
  { tag: 'extraction',       mode: 'solo', weight: 0.0 },
  { tag: 'sabotage',         mode: 'solo', weight: 0.3 },
  { tag: 'aid',              mode: 'solo', weight: 0.0 },
  { tag: 'rescue',           mode: 'solo', weight: 0.0 },
  { tag: 'trust',            mode: 'solo', weight: 0.0 },
  { tag: 'discipline',       mode: 'solo', weight: 1.2 },
  { tag: 'bluff',            mode: 'solo', weight: 0.4 },

  // --- pvp ---
  { tag: 'income',           mode: 'pvp', weight: 1.1 },
  { tag: 'shield',           mode: 'pvp', weight: 1.2 },
  { tag: 'investment',       mode: 'pvp', weight: 0.9 },
  { tag: 'debt_management',  mode: 'pvp', weight: 1.0 },
  { tag: 'credit_repair',    mode: 'pvp', weight: 0.8 },
  { tag: 'insurance',        mode: 'pvp', weight: 0.7 },
  { tag: 'education',        mode: 'pvp', weight: 0.6 },
  { tag: 'counter',          mode: 'pvp', weight: 1.5 },
  { tag: 'extraction',       mode: 'pvp', weight: 1.3 },
  { tag: 'sabotage',         mode: 'pvp', weight: 1.4 },
  { tag: 'aid',              mode: 'pvp', weight: 0.0 },
  { tag: 'rescue',           mode: 'pvp', weight: 0.0 },
  { tag: 'trust',            mode: 'pvp', weight: 0.0 },
  { tag: 'discipline',       mode: 'pvp', weight: 1.0 },
  { tag: 'bluff',            mode: 'pvp', weight: 1.3 },

  // --- coop ---
  { tag: 'income',           mode: 'coop', weight: 1.2 },
  { tag: 'shield',           mode: 'coop', weight: 1.1 },
  { tag: 'investment',       mode: 'coop', weight: 1.0 },
  { tag: 'debt_management',  mode: 'coop', weight: 1.0 },
  { tag: 'credit_repair',    mode: 'coop', weight: 0.9 },
  { tag: 'insurance',        mode: 'coop', weight: 1.0 },
  { tag: 'education',        mode: 'coop', weight: 0.8 },
  { tag: 'counter',          mode: 'coop', weight: 1.2 },
  { tag: 'extraction',       mode: 'coop', weight: 0.0 },
  { tag: 'sabotage',         mode: 'coop', weight: 0.0 },
  { tag: 'aid',              mode: 'coop', weight: 1.5 },
  { tag: 'rescue',           mode: 'coop', weight: 1.4 },
  { tag: 'trust',            mode: 'coop', weight: 1.4 },
  { tag: 'discipline',       mode: 'coop', weight: 1.1 },
  { tag: 'bluff',            mode: 'coop', weight: 0.0 },

  // --- ghost ---
  { tag: 'income',           mode: 'ghost', weight: 0.8 },
  { tag: 'shield',           mode: 'ghost', weight: 0.7 },
  { tag: 'investment',       mode: 'ghost', weight: 0.5 },
  { tag: 'debt_management',  mode: 'ghost', weight: 0.6 },
  { tag: 'credit_repair',    mode: 'ghost', weight: 0.4 },
  { tag: 'insurance',        mode: 'ghost', weight: 0.3 },
  { tag: 'education',        mode: 'ghost', weight: 0.5 },
  { tag: 'counter',          mode: 'ghost', weight: 1.0 },
  { tag: 'extraction',       mode: 'ghost', weight: 0.0 },
  { tag: 'sabotage',         mode: 'ghost', weight: 0.0 },
  { tag: 'aid',              mode: 'ghost', weight: 0.0 },
  { tag: 'rescue',           mode: 'ghost', weight: 0.0 },
  { tag: 'trust',            mode: 'ghost', weight: 0.0 },
  { tag: 'discipline',       mode: 'ghost', weight: 1.5 },
  { tag: 'bluff',            mode: 'ghost', weight: 1.3 },
] as const;

/**
 * Canonical deck profiles — one per DeckType.
 * Consumed by deck builder, bot selection, and analytics.
 */
export const DECK_TYPE_PROFILES: readonly DeckProfile[] = [
  {
    deckType: 'OPPORTUNITY',
    color: '#22C55E',
    roleDescription: 'Core income generation through opportunities',
    modeRestrictions: [],
    draftWeight: 1.0,
    avgCardsPerRun: 8.2,
  },
  {
    deckType: 'IPA',
    color: '#3B82F6',
    roleDescription: 'Investment, planning, and asset-building cards',
    modeRestrictions: [],
    draftWeight: 0.9,
    avgCardsPerRun: 6.4,
  },
  {
    deckType: 'FUBAR',
    color: '#EF4444',
    roleDescription: 'High-risk chaotic event cards that disrupt the board',
    modeRestrictions: [],
    draftWeight: 0.7,
    avgCardsPerRun: 3.1,
  },
  {
    deckType: 'MISSED_OPPORTUNITY',
    color: '#F59E0B',
    roleDescription: 'Penalty cards for inaction or poor timing',
    modeRestrictions: [],
    draftWeight: 0.5,
    avgCardsPerRun: 2.8,
  },
  {
    deckType: 'PRIVILEGED',
    color: '#A855F7',
    roleDescription: 'Privilege-themed advantage cards with ethical cost',
    modeRestrictions: [],
    draftWeight: 0.6,
    avgCardsPerRun: 2.2,
  },
  {
    deckType: 'SO',
    color: '#EC4899',
    roleDescription: 'Significant-other partnership synergy cards',
    modeRestrictions: [],
    draftWeight: 0.8,
    avgCardsPerRun: 4.0,
  },
  {
    deckType: 'SABOTAGE',
    color: '#DC2626',
    roleDescription: 'Offensive disruption aimed at opponents',
    modeRestrictions: ['solo', 'pvp'],
    draftWeight: 0.7,
    avgCardsPerRun: 3.5,
  },
  {
    deckType: 'COUNTER',
    color: '#0EA5E9',
    roleDescription: 'Defensive reaction cards that block or reflect',
    modeRestrictions: [],
    draftWeight: 1.0,
    avgCardsPerRun: 5.8,
  },
  {
    deckType: 'AID',
    color: '#10B981',
    roleDescription: 'Co-op cards that directly help teammates',
    modeRestrictions: ['coop'],
    draftWeight: 0.9,
    avgCardsPerRun: 4.5,
  },
  {
    deckType: 'RESCUE',
    color: '#F97316',
    roleDescription: 'Emergency stabilization cards for teammates in crisis',
    modeRestrictions: ['coop'],
    draftWeight: 0.8,
    avgCardsPerRun: 2.1,
  },
  {
    deckType: 'TRUST',
    color: '#14B8A6',
    roleDescription: 'Trust-economy cards that build syndicate cohesion',
    modeRestrictions: ['coop'],
    draftWeight: 0.9,
    avgCardsPerRun: 3.7,
  },
  {
    deckType: 'DISCIPLINE',
    color: '#6366F1',
    roleDescription: 'Delayed-reward self-improvement cards',
    modeRestrictions: [],
    draftWeight: 0.85,
    avgCardsPerRun: 4.3,
  },
  {
    deckType: 'BLUFF',
    color: '#8B5CF6',
    roleDescription: 'Deception cards that show one thing and do another',
    modeRestrictions: ['solo', 'pvp', 'ghost'],
    draftWeight: 0.6,
    avgCardsPerRun: 2.0,
  },
  {
    deckType: 'GHOST',
    color: '#1E293B',
    roleDescription: 'Ghost-mode exclusive cards for legend challenge runs',
    modeRestrictions: ['ghost'],
    draftWeight: 1.0,
    avgCardsPerRun: 7.0,
  },
] as const;

/**
 * Default overlay contract: identity transform, no mutations.
 */
export const DEFAULT_MODE_OVERLAY: Readonly<ModeOverlayContract> = {
  costModifier: 1.0,
  effectModifier: 1.0,
  tagWeights: {},
  timingLock: null,
  legal: true,
  targetingOverride: null,
};

/**
 * Lookup helper type: given a DeckType, resolve which modes allow it.
 */
export type DeckModeLegalityLookup = Record<DeckType, ModeCode[]>;

/**
 * Inverted legality map constant: for each DeckType, which modes allow it.
 * Derived from MODE_DECK_LEGALITY at module load.
 */
export const DECK_MODE_LOOKUP: DeckModeLegalityLookup = (() => {
  const result: Record<string, ModeCode[]> = {};
  const allDeckTypes: DeckType[] = [
    'OPPORTUNITY', 'IPA', 'FUBAR', 'MISSED_OPPORTUNITY', 'PRIVILEGED',
    'SO', 'SABOTAGE', 'COUNTER', 'AID', 'RESCUE', 'DISCIPLINE',
    'TRUST', 'BLUFF', 'GHOST',
  ];
  for (const dt of allDeckTypes) {
    result[dt] = [];
  }
  for (const mode of ['solo', 'pvp', 'coop', 'ghost'] as ModeCode[]) {
    for (const dt of MODE_DECK_LEGALITY[mode]) {
      if (!result[dt]) result[dt] = [];
      result[dt].push(mode);
    }
  }
  return result as DeckModeLegalityLookup;
})();

/**
 * Overlay template used by co-op mode to buff AID/RESCUE/TRUST cards.
 */
export const COOP_AID_OVERLAY: Readonly<ModeOverlayContract> = {
  costModifier: 0.85,
  effectModifier: 1.15,
  tagWeights: { aid: 1.5, rescue: 1.4, trust: 1.4 },
  timingLock: null,
  legal: true,
  targetingOverride: null,
};

/**
 * Overlay template used by PvP mode to buff SABOTAGE/BLUFF cards.
 */
export const PVP_AGGRESSION_OVERLAY: Readonly<ModeOverlayContract> = {
  costModifier: 0.90,
  effectModifier: 1.20,
  tagWeights: { sabotage: 1.4, bluff: 1.3, counter: 1.5 },
  timingLock: null,
  legal: true,
  targetingOverride: null,
};

/**
 * Overlay template used by ghost mode to constrain card pool.
 */
export const GHOST_DISCIPLINE_OVERLAY: Readonly<ModeOverlayContract> = {
  costModifier: 1.10,
  effectModifier: 0.90,
  tagWeights: { discipline: 1.5, bluff: 1.3 },
  timingLock: null,
  legal: true,
  targetingOverride: null,
};

// ============================================================================
// S3 - BATTLE & BOT CONTRACTS
// ============================================================================

/**
 * Aggression profile for a single hater bot. Determines how the bot
 * selects targets, how frequently it attacks, and what cooldown it
 * observes between attack waves.
 */
export interface BotThreatProfile {
  botId: HaterBotId;
  /** 0.0 = passive, 1.0 = maximum aggression. */
  aggressionLevel: number;
  /** How the bot picks its target each tick. */
  targetPreference: 'LOWEST_CASH' | 'LOWEST_SHIELD' | 'HIGHEST_HEAT' | 'RANDOM' | 'LEADER';
  /** Ticks the bot must wait between attack waves. */
  cooldownTicks: number;
  /** Minimum tick before this bot activates. */
  activationTick: number;
  /** Whether the bot escalates aggression over time. */
  escalates: boolean;
  /** Per-tick aggression ramp if escalates is true. */
  aggressionRampPerTick: number;
  /** Maximum aggression cap. */
  aggressionCap: number;
  /** Base damage per extraction action. */
  baseDamage: number;
  /** Probability [0,1] the bot attempts extraction on any given eligible tick. */
  extractionProbability: number;
}

/**
 * Snapshot of the battle budget at a specific tick.
 * The battle budget limits how much total damage bots can deal per phase.
 */
export interface BattleBudgetSnapshot {
  /** Budget remaining for the current phase. */
  remaining: number;
  /** Total budget spent this phase. */
  spent: number;
  /** How fast budget regenerates per tick. */
  generationRate: number;
  /** Phase this budget belongs to. */
  phase: RunPhaseId;
  /** Tick this snapshot was captured at. */
  capturedAtTick: number;
  /** Hard cap for this phase. */
  phaseCap: number;
}

/**
 * Budget contract that maps each HaterBotId to its allocated battle budget
 * fraction. Used by the engine to split the phase budget across active bots.
 */
export interface BattleBudgetContract {
  botId: HaterBotId;
  /** Fraction of total phase budget allocated to this bot (0.0 - 1.0). */
  budgetFraction: number;
  /** Hard minimum damage this bot is guaranteed per phase. */
  guaranteedMinimum: number;
  /** Whether this bot can borrow unused budget from inactive bots. */
  canBorrowExcess: boolean;
}

/**
 * Resolution of a single extraction action.
 */
export interface ExtractionResolution {
  actionId: ExtractionActionId;
  attackerBotId: HaterBotId;
  targetPlayerId: string;
  /** Raw damage before shields. */
  rawDamage: number;
  /** Damage after shield absorption. */
  bleedthrough: number;
  /** Ticks the defender has to play a counter. */
  counterWindowTicks: number;
  /** Whether a counter was played. */
  countered: boolean;
  /** Counter card used (if any). */
  counterCardId: CounterCardId | null;
  /** Final damage applied to the player. */
  appliedDamage: number;
  /** Tick this extraction resolved. */
  resolvedAtTick: number;
}

/**
 * Resolution of a counter card play against an extraction.
 */
export interface CounterResolution {
  counterCardId: CounterCardId;
  actorId: string;
  /** Whether the counter successfully blocked. */
  blocked: boolean;
  /** Damage bounced back to attacker (for EVIDENCE_FILE etc.). */
  bouncebackDamage: number;
  /** Secondary effect applied by the counter. */
  bouncebackEffect: string | null;
  /** Tick this counter resolved. */
  resolvedAtTick: number;
}

/**
 * Bluff card contract: the displayed sabotage type and the real effect.
 * The opponent sees displayedType; the real effect fires on resolution.
 */
export interface BluffCardContract {
  cardId: string;
  /** What the opponent sees during the bluff window. */
  displayedSabotageType: ExtractionActionId;
  /** What actually happens. */
  realEffect: string;
  /** Magnitude of the real effect. */
  realMagnitude: number;
  /** Whether the bluff was called (opponent played a counter matching displayed). */
  bluffCalled: boolean;
  /** Bonus or penalty if the bluff succeeds/fails. */
  outcomeModifier: number;
}

/**
 * Combo escalation state for chained attacks.
 * When a bot or player chains multiple attacks in sequence, damage
 * and battle-budget bonuses escalate.
 */
export interface ComboEscalationState {
  /** Number of consecutive attacks in the current chain. */
  chainLength: number;
  /** Current damage multiplier (starts at 1.0, grows with chain). */
  damageMultiplier: number;
  /** Bonus battle budget earned per chain link. */
  budgetBonusPerLink: number;
  /** Tick the chain started. */
  chainStartTick: number;
  /** Tick the chain last extended. */
  lastExtensionTick: number;
  /** Maximum chain length observed in this run. */
  maxChainThisRun: number;
  /** Whether the chain is currently active. */
  active: boolean;
}

/**
 * Canonical list of all hater bot IDs.
 */
export const ALL_HATER_BOTS: readonly HaterBotId[] = [
  'BOT_01',
  'BOT_02',
  'BOT_03',
  'BOT_04',
  'BOT_05',
] as const;

/**
 * Shield layer routing: which shield layer each bot targets by default.
 * BOT_01 and BOT_02 hit outer layers; BOT_04 and BOT_05 go deep.
 */
export const BOT_ATTACK_ROUTING: Readonly<Record<HaterBotId, 'L1' | 'L2' | 'L3' | 'L4'>> = {
  BOT_01: 'L1',
  BOT_02: 'L2',
  BOT_03: 'L2',
  BOT_04: 'L3',
  BOT_05: 'L4',
};

/**
 * Default threat profiles for all 5 hater bots.
 * Bots ramp from low aggression (BOT_01) to high (BOT_05).
 */
export const DEFAULT_BOT_THREAT_PROFILES: readonly BotThreatProfile[] = [
  {
    botId: 'BOT_01',
    aggressionLevel: 0.2,
    targetPreference: 'RANDOM',
    cooldownTicks: 8,
    activationTick: 5,
    escalates: false,
    aggressionRampPerTick: 0,
    aggressionCap: 0.3,
    baseDamage: 50,
    extractionProbability: 0.3,
  },
  {
    botId: 'BOT_02',
    aggressionLevel: 0.35,
    targetPreference: 'LOWEST_CASH',
    cooldownTicks: 6,
    activationTick: 8,
    escalates: true,
    aggressionRampPerTick: 0.005,
    aggressionCap: 0.55,
    baseDamage: 75,
    extractionProbability: 0.4,
  },
  {
    botId: 'BOT_03',
    aggressionLevel: 0.5,
    targetPreference: 'LOWEST_SHIELD',
    cooldownTicks: 5,
    activationTick: 12,
    escalates: true,
    aggressionRampPerTick: 0.008,
    aggressionCap: 0.7,
    baseDamage: 100,
    extractionProbability: 0.5,
  },
  {
    botId: 'BOT_04',
    aggressionLevel: 0.65,
    targetPreference: 'HIGHEST_HEAT',
    cooldownTicks: 4,
    activationTick: 18,
    escalates: true,
    aggressionRampPerTick: 0.01,
    aggressionCap: 0.85,
    baseDamage: 150,
    extractionProbability: 0.6,
  },
  {
    botId: 'BOT_05',
    aggressionLevel: 0.8,
    targetPreference: 'LEADER',
    cooldownTicks: 3,
    activationTick: 25,
    escalates: true,
    aggressionRampPerTick: 0.015,
    aggressionCap: 1.0,
    baseDamage: 200,
    extractionProbability: 0.75,
  },
] as const;

/**
 * Default battle budget contracts for all 5 hater bots.
 */
export const DEFAULT_BATTLE_BUDGET_CONTRACTS: readonly BattleBudgetContract[] = [
  { botId: 'BOT_01', budgetFraction: 0.10, guaranteedMinimum: 100, canBorrowExcess: false },
  { botId: 'BOT_02', budgetFraction: 0.15, guaranteedMinimum: 150, canBorrowExcess: false },
  { botId: 'BOT_03', budgetFraction: 0.20, guaranteedMinimum: 200, canBorrowExcess: true },
  { botId: 'BOT_04', budgetFraction: 0.25, guaranteedMinimum: 300, canBorrowExcess: true },
  { botId: 'BOT_05', budgetFraction: 0.30, guaranteedMinimum: 500, canBorrowExcess: true },
] as const;

/**
 * Aggression modifiers per mode. Solo is baseline. PvP adds player threat
 * so bots are slightly tamer. Co-op bots hit harder to compensate for
 * team synergy. Ghost bots are maximally aggressive.
 */
export interface HaterAggressionProfile {
  mode: ModeCode;
  botId: HaterBotId;
  aggressionMultiplier: number;
  cooldownModifier: number;
  damageMultiplier: number;
}

/**
 * Per-mode aggression profiles for all bots.
 */
export const HATER_AGGRESSION_PROFILES: readonly HaterAggressionProfile[] = [
  // solo baseline
  { mode: 'solo', botId: 'BOT_01', aggressionMultiplier: 1.0, cooldownModifier: 1.0, damageMultiplier: 1.0 },
  { mode: 'solo', botId: 'BOT_02', aggressionMultiplier: 1.0, cooldownModifier: 1.0, damageMultiplier: 1.0 },
  { mode: 'solo', botId: 'BOT_03', aggressionMultiplier: 1.0, cooldownModifier: 1.0, damageMultiplier: 1.0 },
  { mode: 'solo', botId: 'BOT_04', aggressionMultiplier: 1.0, cooldownModifier: 1.0, damageMultiplier: 1.0 },
  { mode: 'solo', botId: 'BOT_05', aggressionMultiplier: 1.0, cooldownModifier: 1.0, damageMultiplier: 1.0 },
  // pvp: slightly tamer
  { mode: 'pvp', botId: 'BOT_01', aggressionMultiplier: 0.8, cooldownModifier: 1.2, damageMultiplier: 0.85 },
  { mode: 'pvp', botId: 'BOT_02', aggressionMultiplier: 0.8, cooldownModifier: 1.2, damageMultiplier: 0.85 },
  { mode: 'pvp', botId: 'BOT_03', aggressionMultiplier: 0.85, cooldownModifier: 1.1, damageMultiplier: 0.9 },
  { mode: 'pvp', botId: 'BOT_04', aggressionMultiplier: 0.85, cooldownModifier: 1.1, damageMultiplier: 0.9 },
  { mode: 'pvp', botId: 'BOT_05', aggressionMultiplier: 0.9, cooldownModifier: 1.05, damageMultiplier: 0.95 },
  // coop: harder to compensate for team synergy
  { mode: 'coop', botId: 'BOT_01', aggressionMultiplier: 1.2, cooldownModifier: 0.85, damageMultiplier: 1.15 },
  { mode: 'coop', botId: 'BOT_02', aggressionMultiplier: 1.2, cooldownModifier: 0.85, damageMultiplier: 1.15 },
  { mode: 'coop', botId: 'BOT_03', aggressionMultiplier: 1.25, cooldownModifier: 0.8, damageMultiplier: 1.2 },
  { mode: 'coop', botId: 'BOT_04', aggressionMultiplier: 1.3, cooldownModifier: 0.75, damageMultiplier: 1.25 },
  { mode: 'coop', botId: 'BOT_05', aggressionMultiplier: 1.35, cooldownModifier: 0.7, damageMultiplier: 1.3 },
  // ghost: maximum aggression
  { mode: 'ghost', botId: 'BOT_01', aggressionMultiplier: 1.4, cooldownModifier: 0.7, damageMultiplier: 1.3 },
  { mode: 'ghost', botId: 'BOT_02', aggressionMultiplier: 1.4, cooldownModifier: 0.7, damageMultiplier: 1.3 },
  { mode: 'ghost', botId: 'BOT_03', aggressionMultiplier: 1.5, cooldownModifier: 0.6, damageMultiplier: 1.4 },
  { mode: 'ghost', botId: 'BOT_04', aggressionMultiplier: 1.5, cooldownModifier: 0.6, damageMultiplier: 1.4 },
  { mode: 'ghost', botId: 'BOT_05', aggressionMultiplier: 1.6, cooldownModifier: 0.5, damageMultiplier: 1.5 },
] as const;

/**
 * Full battle round result capturing all extractions and counters.
 */
export interface BattleRoundResult {
  roundTick: number;
  extractions: ExtractionResolution[];
  counters: CounterResolution[];
  budgetAfter: BattleBudgetSnapshot;
  comboState: ComboEscalationState;
}

// ============================================================================
// S4 - PRESSURE & RESCUE CONTRACTS
// ============================================================================

/**
 * Configuration for a single pressure tier band.
 * The engine uses these thresholds to determine the current PressureTier.
 */
export interface PressureBandConfig {
  tier: PressureTier;
  /** Lower bound of combined-pressure score (inclusive). */
  lowerBound: number;
  /** Upper bound of combined-pressure score (exclusive). */
  upperBound: number;
  /** Human-readable label. */
  label: string;
  /** Color hex for UI rendering. */
  color: string;
  /** Whether rescue cards become available at this tier. */
  rescueEligible: boolean;
  /** Whether comeback-surge logic activates at this tier. */
  comebackSurgeEligible: boolean;
}

/**
 * Canonical pressure tier threshold table.
 * T0 = calm, T4 = critical.
 */
export const PRESSURE_TIER_THRESHOLDS: readonly PressureBandConfig[] = [
  {
    tier: 'T0',
    lowerBound: 0,
    upperBound: 20,
    label: 'Calm',
    color: '#22C55E',
    rescueEligible: false,
    comebackSurgeEligible: false,
  },
  {
    tier: 'T1',
    lowerBound: 20,
    upperBound: 40,
    label: 'Uneasy',
    color: '#EAB308',
    rescueEligible: false,
    comebackSurgeEligible: false,
  },
  {
    tier: 'T2',
    lowerBound: 40,
    upperBound: 60,
    label: 'Pressured',
    color: '#F97316',
    rescueEligible: true,
    comebackSurgeEligible: false,
  },
  {
    tier: 'T3',
    lowerBound: 60,
    upperBound: 80,
    label: 'Critical',
    color: '#EF4444',
    rescueEligible: true,
    comebackSurgeEligible: true,
  },
  {
    tier: 'T4',
    lowerBound: 80,
    upperBound: 100,
    label: 'Dire',
    color: '#991B1B',
    rescueEligible: true,
    comebackSurgeEligible: true,
  },
] as const;

/**
 * Minimum pressure tier at which rescue cards become playable.
 */
export const RESCUE_PRESSURE_MINIMUM: PressureTier = 'T2';

/**
 * Contract for checking whether a player is rescue-eligible.
 */
export interface RescueEligibility {
  playerId: string;
  currentTier: PressureTier;
  cashBalance: number;
  shieldIntegrity: number;
  eligible: boolean;
  reason: string;
}

/**
 * Comeback surge activation conditions.
 */
export interface ComebackSurgeCondition {
  /** Must be at or above this pressure tier. */
  minimumTier: PressureTier;
  /** Must have cash below this threshold. */
  cashThreshold: number;
  /** Must have shield integrity below this percentage (0-1). */
  shieldThreshold: number;
  /** Bonus multiplier applied to income cards during surge. */
  incomeBonusMultiplier: number;
  /** Bonus multiplier applied to counter cards during surge. */
  counterBonusMultiplier: number;
  /** Duration of the surge in ticks. */
  surgeDurationTicks: number;
}

/**
 * Default comeback surge conditions per mode.
 */
export const DEFAULT_COMEBACK_SURGE: Readonly<Record<ModeCode, ComebackSurgeCondition>> = {
  solo: {
    minimumTier: 'T3',
    cashThreshold: 500,
    shieldThreshold: 0.25,
    incomeBonusMultiplier: 1.5,
    counterBonusMultiplier: 1.3,
    surgeDurationTicks: 5,
  },
  pvp: {
    minimumTier: 'T3',
    cashThreshold: 400,
    shieldThreshold: 0.20,
    incomeBonusMultiplier: 1.4,
    counterBonusMultiplier: 1.25,
    surgeDurationTicks: 4,
  },
  coop: {
    minimumTier: 'T2',
    cashThreshold: 600,
    shieldThreshold: 0.30,
    incomeBonusMultiplier: 1.6,
    counterBonusMultiplier: 1.4,
    surgeDurationTicks: 6,
  },
  ghost: {
    minimumTier: 'T4',
    cashThreshold: 300,
    shieldThreshold: 0.15,
    incomeBonusMultiplier: 1.3,
    counterBonusMultiplier: 1.2,
    surgeDurationTicks: 3,
  },
};

/**
 * Mapping from PressureTier to cost modifier.
 * Higher pressure = cards cost more (you are under duress).
 */
export interface PressureCostModifier {
  tier: PressureTier;
  costMultiplier: number;
}

/**
 * Canonical pressure cost modifier table.
 */
export const PRESSURE_COST_MODIFIERS: readonly PressureCostModifier[] = [
  { tier: 'T0', costMultiplier: 1.0 },
  { tier: 'T1', costMultiplier: 1.05 },
  { tier: 'T2', costMultiplier: 1.15 },
  { tier: 'T3', costMultiplier: 1.30 },
  { tier: 'T4', costMultiplier: 1.50 },
] as const;

/**
 * Trust-pressure mapping: how pressure tier interacts with trust score
 * in co-op mode. Higher pressure erodes trust faster.
 */
export interface TrustPressureMapping {
  tier: PressureTier;
  /** Per-tick trust decay when at this pressure tier. */
  trustDecayRate: number;
  /** Multiplier on trust earned from aid cards at this tier. */
  aidTrustBonusMultiplier: number;
  /** Multiplier on defection penalty at this tier. */
  defectionPenaltyMultiplier: number;
}

/**
 * Canonical trust-pressure mapping table.
 */
export const TRUST_PRESSURE_MAPPINGS: readonly TrustPressureMapping[] = [
  { tier: 'T0', trustDecayRate: 0.0, aidTrustBonusMultiplier: 1.0, defectionPenaltyMultiplier: 1.0 },
  { tier: 'T1', trustDecayRate: 0.5, aidTrustBonusMultiplier: 1.1, defectionPenaltyMultiplier: 1.2 },
  { tier: 'T2', trustDecayRate: 1.0, aidTrustBonusMultiplier: 1.3, defectionPenaltyMultiplier: 1.5 },
  { tier: 'T3', trustDecayRate: 2.0, aidTrustBonusMultiplier: 1.5, defectionPenaltyMultiplier: 2.0 },
  { tier: 'T4', trustDecayRate: 4.0, aidTrustBonusMultiplier: 2.0, defectionPenaltyMultiplier: 3.0 },
] as const;

/**
 * Snapshot of pressure state for a single player at a given tick.
 */
export interface PressureSnapshot {
  playerId: string;
  tick: number;
  pressureScore: number;
  tier: PressureTier;
  costModifier: number;
  rescueEligible: boolean;
  comebackSurgeActive: boolean;
  comebackSurgeTicksRemaining: number;
}

/**
 * Pressure transition event — emitted when a player crosses a tier boundary.
 */
export interface PressureTransitionEvent {
  playerId: string;
  tick: number;
  fromTier: PressureTier;
  toTier: PressureTier;
  triggerSource: 'EXTRACTION' | 'DEBT' | 'HEAT' | 'CASCADE' | 'MANUAL';
}

// ============================================================================
// S5 - TRUST SYSTEM CONTRACTS
// ============================================================================

/**
 * Trust band defining gameplay effects at different trust score ranges.
 */
export interface TrustBand {
  /** Lower bound of trust score (inclusive). */
  lowerBound: number;
  /** Upper bound of trust score (exclusive). */
  upperBound: number;
  /** Human-readable label. */
  label: 'DISTRUSTED' | 'CAUTIOUS' | 'NEUTRAL' | 'TRUSTED' | 'BONDED';
  /** Income efficiency multiplier in co-op. */
  efficiencyMultiplier: number;
  /** Whether this trust level grants loan access. */
  loanAccessGranted: boolean;
  /** Combo multiplier bonus for co-op plays. */
  comboMultiplier: number;
  /** Strength of defection signal at this trust level. */
  defectionSignal: 'NONE' | 'FAINT' | 'VISIBLE' | 'STRONG' | 'BLARING';
  /** Color hex for UI rendering. */
  color: string;
}

/**
 * Trust score range type.
 */
export type TrustScoreRange = {
  min: number;
  max: number;
};

/** Canonical trust score bounds. */
export const TRUST_SCORE_BOUNDS: Readonly<TrustScoreRange> = {
  min: 0,
  max: 100,
};

/**
 * Canonical trust band thresholds.
 */
export const TRUST_BAND_THRESHOLDS: readonly TrustBand[] = [
  {
    lowerBound: 0,
    upperBound: 20,
    label: 'DISTRUSTED',
    efficiencyMultiplier: 0.7,
    loanAccessGranted: false,
    comboMultiplier: 0.5,
    defectionSignal: 'BLARING',
    color: '#DC2626',
  },
  {
    lowerBound: 20,
    upperBound: 40,
    label: 'CAUTIOUS',
    efficiencyMultiplier: 0.85,
    loanAccessGranted: false,
    comboMultiplier: 0.75,
    defectionSignal: 'STRONG',
    color: '#F97316',
  },
  {
    lowerBound: 40,
    upperBound: 60,
    label: 'NEUTRAL',
    efficiencyMultiplier: 1.0,
    loanAccessGranted: true,
    comboMultiplier: 1.0,
    defectionSignal: 'VISIBLE',
    color: '#EAB308',
  },
  {
    lowerBound: 60,
    upperBound: 80,
    label: 'TRUSTED',
    efficiencyMultiplier: 1.15,
    loanAccessGranted: true,
    comboMultiplier: 1.25,
    defectionSignal: 'FAINT',
    color: '#22C55E',
  },
  {
    lowerBound: 80,
    upperBound: 100,
    label: 'BONDED',
    efficiencyMultiplier: 1.3,
    loanAccessGranted: true,
    comboMultiplier: 1.5,
    defectionSignal: 'NONE',
    color: '#10B981',
  },
] as const;

/**
 * Trust transition event: emitted when a player moves between trust bands.
 */
export interface TrustTransition {
  playerId: string;
  tick: number;
  fromLabel: TrustBand['label'];
  toLabel: TrustBand['label'];
  trigger: 'AID_GIVEN' | 'RESCUE_PERFORMED' | 'LOAN_REPAID' | 'LOAN_DEFAULTED' |
    'DEFECTION_SIGNAL' | 'PACT_FORMED' | 'PACT_BROKEN' | 'TICK_DECAY' |
    'CASCADE_ABSORBED' | 'TRUST_CARD_PLAYED';
  previousScore: number;
  newScore: number;
}

/**
 * Loan contract between two players in co-op mode.
 */
export interface LoanContract {
  loanId: string;
  lenderId: string;
  borrowerId: string;
  principal: number;
  interestRate: number;
  repaymentDeadlineTick: number;
  status: 'ACTIVE' | 'REPAID' | 'DEFAULTED' | 'FORGIVEN';
  createdAtTick: number;
  resolvedAtTick: number | null;
}

/**
 * Trust snapshot for a single player.
 */
export interface TrustSnapshot {
  playerId: string;
  tick: number;
  score: number;
  band: TrustBand['label'];
  activeLoansAsLender: number;
  activeLoansAsBorrower: number;
  totalAidGiven: number;
  totalRescuesPerformed: number;
  defectionRisk: TrustAuditLine['defectionRiskSignal'];
}

// ============================================================================
// S6 - SHARED OBJECTIVE CONTRACTS
// ============================================================================

/**
 * Identifier for a shared objective in co-op mode.
 */
export type SharedObjectiveId =
  | 'COLLECTIVE_FREEDOM'
  | 'ZERO_BANKRUPTCIES'
  | 'FULL_SHIELD_SWEEP'
  | 'TRUST_CEILING';

/**
 * Definition of a shared objective.
 */
export interface SharedObjectiveDefinition {
  objectiveId: SharedObjectiveId;
  /** Human-readable name. */
  name: string;
  /** Full description of completion condition. */
  conditionDescription: string;
  /** Reward granted to each syndicate member on completion. */
  rewardPerPlayer: number;
  /** Penalty applied to each member on failure. */
  penaltyPerPlayer: number;
  /** Ticks from activation until deadline. */
  durationTicks: number;
  /** Minimum syndicate size to activate this objective. */
  minimumPlayers: number;
}

/**
 * Runtime state of a shared objective.
 */
export interface SharedObjectiveState {
  objectiveId: SharedObjectiveId;
  /** Whether the objective is currently active. */
  active: boolean;
  /** Numeric progress (0.0 to 1.0). */
  progress: number;
  /** Whether the objective has been completed. */
  completed: boolean;
  /** Whether the objective has failed. */
  failed: boolean;
  /** Tick the objective was activated. */
  activatedAtTick: number;
  /** Tick the objective completed or failed (null if still active). */
  resolvedAtTick: number | null;
  /** Player IDs that contributed to progress. */
  contributorIds: string[];
}

/**
 * Canonical shared objectives from doctrine.
 */
export const SHARED_OBJECTIVES: readonly SharedObjectiveDefinition[] = [
  {
    objectiveId: 'COLLECTIVE_FREEDOM',
    name: 'Collective Freedom',
    conditionDescription: 'All syndicate members reach freedom threshold within the same phase',
    rewardPerPlayer: 2000,
    penaltyPerPlayer: 0,
    durationTicks: 60,
    minimumPlayers: 2,
  },
  {
    objectiveId: 'ZERO_BANKRUPTCIES',
    name: 'Zero Bankruptcies',
    conditionDescription: 'Complete the entire run with no syndicate member going bankrupt',
    rewardPerPlayer: 1500,
    penaltyPerPlayer: 500,
    durationTicks: 120,
    minimumPlayers: 2,
  },
  {
    objectiveId: 'FULL_SHIELD_SWEEP',
    name: 'Full Shield Sweep',
    conditionDescription: 'All syndicate members maintain full shield integrity for 10 consecutive ticks',
    rewardPerPlayer: 1000,
    penaltyPerPlayer: 0,
    durationTicks: 30,
    minimumPlayers: 2,
  },
  {
    objectiveId: 'TRUST_CEILING',
    name: 'Trust Ceiling',
    conditionDescription: 'All syndicate members reach BONDED trust level simultaneously',
    rewardPerPlayer: 2500,
    penaltyPerPlayer: 0,
    durationTicks: 90,
    minimumPlayers: 3,
  },
] as const;

// ============================================================================
// S7 - DEFECTION CONTRACTS
// ============================================================================

/**
 * Sequential defection steps. A player escalates through these stages
 * when choosing to betray their syndicate in co-op mode.
 */
export type DefectionStep =
  | 'NONE'
  | 'BREAK_PACT'
  | 'SILENT_EXIT'
  | 'ASSET_SEIZURE'
  | 'DEFECTED';

/**
 * Runtime state of a player defection sequence.
 */
export interface DefectionSequenceState {
  playerId: string;
  currentStep: DefectionStep;
  /** Tick the defection sequence began (null if NONE). */
  startedAtTick: number | null;
  /** Tick the current step was entered. */
  stepEnteredAtTick: number;
  /** Whether the defection can still be reversed. */
  reversible: boolean;
  /** Accumulated penalty points from the defection sequence. */
  accumulatedPenalty: number;
  /** Percentage of treasury the defector seizes at ASSET_SEIZURE step. */
  seizureFraction: number;
  /** Whether syndicate members have been notified. */
  notified: boolean;
}

/**
 * Consequences applied upon defection completion.
 */
export interface DefectionConsequences {
  playerId: string;
  /** Cash penalty applied to the defector. */
  defectorCashPenalty: number;
  /** Cash penalty applied to remaining syndicate members. */
  syndicateCashPenalty: number;
  /** Trust score impact on all remaining members. */
  trustImpact: number;
  /** CORD bonus penalty applied to the defector. */
  cordPenalty: number;
  /** Whether the defector loses access to co-op cards for the rest of the run. */
  coopCardsRevoked: boolean;
  /** Proof badges revoked from the defector. */
  revokedBadges: string[];
  /** Treasury fraction seized by the defector. */
  treasurySeized: number;
}

/**
 * CORD bonus penalty constant for defection.
 * A defecting player loses this fraction of their accumulated CORD bonus.
 */
export const DEFECTION_CORD_PENALTY = 0.50 as const;

/**
 * Defection step sequence (ordered).
 */
export const DEFECTION_STEP_SEQUENCE: readonly DefectionStep[] = [
  'NONE',
  'BREAK_PACT',
  'SILENT_EXIT',
  'ASSET_SEIZURE',
  'DEFECTED',
] as const;

/**
 * Minimum ticks that must elapse between defection steps.
 */
export const DEFECTION_STEP_COOLDOWNS: Readonly<Record<DefectionStep, number>> = {
  NONE: 0,
  BREAK_PACT: 3,
  SILENT_EXIT: 5,
  ASSET_SEIZURE: 4,
  DEFECTED: 0,
};

/**
 * Treasury seizure fractions per defection step.
 */
export const DEFECTION_SEIZURE_FRACTIONS: Readonly<Record<DefectionStep, number>> = {
  NONE: 0.0,
  BREAK_PACT: 0.0,
  SILENT_EXIT: 0.05,
  ASSET_SEIZURE: 0.20,
  DEFECTED: 0.30,
};

// ============================================================================
// S8 - PHASE BOUNDARY CONTRACTS
// ============================================================================

/**
 * Run phase identifiers matching the three phases of a run.
 */
export type RunPhaseId = 'FOUNDATION' | 'ESCALATION' | 'SOVEREIGNTY';

/**
 * The ordered sequence of run phases.
 */
export const RUN_PHASE_SEQUENCE: readonly RunPhaseId[] = [
  'FOUNDATION',
  'ESCALATION',
  'SOVEREIGNTY',
] as const;

/**
 * Phase boundary card: a special card injected into the draw pile
 * at phase transitions to signal the shift.
 */
export interface PhaseBoundaryCard {
  phaseFrom: RunPhaseId;
  phaseTo: RunPhaseId;
  /** Tick at which the boundary card triggers. */
  triggerTick: number;
  /** Narrative text displayed to the player. */
  narrative: string;
  /** Mechanical effects of the phase transition. */
  effects: PhaseBoundaryEffect[];
}

/**
 * A single mechanical effect applied at a phase boundary.
 */
export interface PhaseBoundaryEffect {
  effectType: 'INCOME_MODIFIER' | 'SHIELD_MODIFIER' | 'HEAT_MODIFIER' |
    'BOT_AGGRESSION_MODIFIER' | 'CARD_COST_MODIFIER' | 'DRAW_RATE_MODIFIER';
  magnitude: number;
  durationTicks: number | null;
  description: string;
}

/**
 * Phase transition event emitted by the engine.
 */
export interface PhaseTransitionEvent {
  runId: string;
  tick: number;
  fromPhase: RunPhaseId;
  toPhase: RunPhaseId;
  boundaryCard: PhaseBoundaryCard;
  /** Snapshot of all participant pressure tiers at transition. */
  participantPressureTiers: Record<string, PressureTier>;
}

/**
 * Phase configuration: tick ranges, budget caps, and bot activation rules.
 */
export interface PhaseConfig {
  phase: RunPhaseId;
  /** Starting tick for this phase. */
  startTick: number;
  /** Ending tick for this phase (exclusive). */
  endTick: number;
  /** Battle budget cap for this phase. */
  battleBudgetCap: number;
  /** Bot activation rules for this phase. */
  botActivations: Readonly<Record<HaterBotId, boolean>>;
  /** Base income rate during this phase. */
  baseIncomeRate: number;
  /** Base heat generation rate during this phase. */
  baseHeatRate: number;
  /** Narrative label. */
  label: string;
}

/**
 * Default phase configurations for a standard 120-tick run.
 */
export const DEFAULT_PHASE_CONFIGS: readonly PhaseConfig[] = [
  {
    phase: 'FOUNDATION',
    startTick: 0,
    endTick: 40,
    battleBudgetCap: 2000,
    botActivations: { BOT_01: true, BOT_02: true, BOT_03: false, BOT_04: false, BOT_05: false },
    baseIncomeRate: 100,
    baseHeatRate: 1.0,
    label: 'Foundation Phase: Build your base',
  },
  {
    phase: 'ESCALATION',
    startTick: 40,
    endTick: 80,
    battleBudgetCap: 5000,
    botActivations: { BOT_01: true, BOT_02: true, BOT_03: true, BOT_04: true, BOT_05: false },
    baseIncomeRate: 150,
    baseHeatRate: 2.0,
    label: 'Escalation Phase: Survive the onslaught',
  },
  {
    phase: 'SOVEREIGNTY',
    startTick: 80,
    endTick: 120,
    battleBudgetCap: 10000,
    botActivations: { BOT_01: true, BOT_02: true, BOT_03: true, BOT_04: true, BOT_05: true },
    baseIncomeRate: 200,
    baseHeatRate: 3.0,
    label: 'Sovereignty Phase: Claim your freedom',
  },
] as const;

// ============================================================================
// S9 - COMMUNICATION & COMBO CARD CONTRACTS
// ============================================================================

/**
 * Communication card IDs for co-op signal cards.
 */
export type CommunicationCardId =
  | 'SIGNAL_ASSIST'
  | 'SIGNAL_WARNING'
  | 'SIGNAL_RESOURCE_SHARE'
  | 'SIGNAL_RETREAT'
  | 'SIGNAL_COORDINATE'
  | 'SIGNAL_DEFECTION_ALERT';

/**
 * Syndicate combo card IDs for co-op synergy plays.
 */
export type SyndicateComboCardId =
  | 'COMBO_SHIELD_WALL'
  | 'COMBO_INCOME_SURGE'
  | 'COMBO_TRUST_BRIDGE'
  | 'COMBO_RESCUE_CHAIN'
  | 'COMBO_COUNTER_STORM'
  | 'COMBO_DISCIPLINE_LOCK';

/**
 * Effect payload of a communication card.
 */
export interface CommunicationCardEffect {
  cardId: CommunicationCardId;
  /** Who played this communication card. */
  senderId: string;
  /** Target player(s). */
  recipientIds: string[];
  /** Mode in which this card was played. */
  mode: ModeCode;
  /** Tick the card was played. */
  playedAtTick: number;
  /** Whether the communication was successfully received. */
  received: boolean;
  /** Trust bonus granted to sender for communicating. */
  trustBonus: number;
  /** Additional payload (signal-specific data). */
  signalPayload: Record<string, string | number | boolean>;
}

/**
 * Activation condition for a syndicate combo card.
 */
export interface ComboActivationCondition {
  comboCardId: SyndicateComboCardId;
  /** Minimum number of syndicate members who must contribute. */
  minimumContributors: number;
  /** Required trust band for all contributors. */
  minimumTrustBand: TrustBand['label'];
  /** Required pressure tier (maximum — contributors must be at or below). */
  maximumPressureTier: PressureTier;
  /** Whether all contributors must play within the same tick. */
  simultaneousRequired: boolean;
  /** Card types each contributor must play to activate. */
  requiredCardTags: string[];
  /** Bonus multiplier if all conditions are met. */
  comboMultiplier: number;
  /** Duration of the combo effect in ticks. */
  effectDurationTicks: number;
}

/**
 * Default communication card effects.
 */
export const COMMUNICATION_CARD_DEFAULTS: readonly CommunicationCardEffect[] = [
  {
    cardId: 'SIGNAL_ASSIST',
    senderId: '',
    recipientIds: [],
    mode: 'coop',
    playedAtTick: 0,
    received: false,
    trustBonus: 2,
    signalPayload: { type: 'assist_request' },
  },
  {
    cardId: 'SIGNAL_WARNING',
    senderId: '',
    recipientIds: [],
    mode: 'coop',
    playedAtTick: 0,
    received: false,
    trustBonus: 3,
    signalPayload: { type: 'threat_warning' },
  },
  {
    cardId: 'SIGNAL_RESOURCE_SHARE',
    senderId: '',
    recipientIds: [],
    mode: 'coop',
    playedAtTick: 0,
    received: false,
    trustBonus: 4,
    signalPayload: { type: 'resource_offer', amount: 0 },
  },
  {
    cardId: 'SIGNAL_RETREAT',
    senderId: '',
    recipientIds: [],
    mode: 'coop',
    playedAtTick: 0,
    received: false,
    trustBonus: 1,
    signalPayload: { type: 'retreat_suggestion' },
  },
  {
    cardId: 'SIGNAL_COORDINATE',
    senderId: '',
    recipientIds: [],
    mode: 'coop',
    playedAtTick: 0,
    received: false,
    trustBonus: 5,
    signalPayload: { type: 'coordination_plan' },
  },
  {
    cardId: 'SIGNAL_DEFECTION_ALERT',
    senderId: '',
    recipientIds: [],
    mode: 'coop',
    playedAtTick: 0,
    received: false,
    trustBonus: 6,
    signalPayload: { type: 'defection_warning', suspectId: '' },
  },
] as const;

/**
 * Default combo activation conditions.
 */
export const COMBO_ACTIVATION_CONDITIONS: readonly ComboActivationCondition[] = [
  {
    comboCardId: 'COMBO_SHIELD_WALL',
    minimumContributors: 2,
    minimumTrustBand: 'NEUTRAL',
    maximumPressureTier: 'T3',
    simultaneousRequired: true,
    requiredCardTags: ['shield', 'counter'],
    comboMultiplier: 2.0,
    effectDurationTicks: 5,
  },
  {
    comboCardId: 'COMBO_INCOME_SURGE',
    minimumContributors: 2,
    minimumTrustBand: 'TRUSTED',
    maximumPressureTier: 'T2',
    simultaneousRequired: false,
    requiredCardTags: ['income', 'investment'],
    comboMultiplier: 1.8,
    effectDurationTicks: 4,
  },
  {
    comboCardId: 'COMBO_TRUST_BRIDGE',
    minimumContributors: 3,
    minimumTrustBand: 'CAUTIOUS',
    maximumPressureTier: 'T4',
    simultaneousRequired: false,
    requiredCardTags: ['trust', 'aid'],
    comboMultiplier: 2.5,
    effectDurationTicks: 8,
  },
  {
    comboCardId: 'COMBO_RESCUE_CHAIN',
    minimumContributors: 2,
    minimumTrustBand: 'TRUSTED',
    maximumPressureTier: 'T4',
    simultaneousRequired: true,
    requiredCardTags: ['rescue'],
    comboMultiplier: 3.0,
    effectDurationTicks: 3,
  },
  {
    comboCardId: 'COMBO_COUNTER_STORM',
    minimumContributors: 2,
    minimumTrustBand: 'NEUTRAL',
    maximumPressureTier: 'T3',
    simultaneousRequired: true,
    requiredCardTags: ['counter'],
    comboMultiplier: 2.2,
    effectDurationTicks: 4,
  },
  {
    comboCardId: 'COMBO_DISCIPLINE_LOCK',
    minimumContributors: 3,
    minimumTrustBand: 'BONDED',
    maximumPressureTier: 'T1',
    simultaneousRequired: false,
    requiredCardTags: ['discipline'],
    comboMultiplier: 2.0,
    effectDurationTicks: 10,
  },
] as const;

// ============================================================================
// S10 - ML/DL FEATURE CONTRACTS
// ============================================================================

/** Dimensionality of the mode ML feature vector. */
export const MODE_ML_FEATURE_DIM = 32 as const;

/** Row count for the DL tensor. */
export const MODE_DL_ROWS = 8 as const;

/** Column count for the DL tensor. */
export const MODE_DL_COLS = 16 as const;

/**
 * A 32-dimensional float feature vector extracted from mode state.
 * Used by the ML pipeline for pattern recognition and bot tuning.
 */
export type ModeMLFeatureVector = readonly [
  number, number, number, number, number, number, number, number,
  number, number, number, number, number, number, number, number,
  number, number, number, number, number, number, number, number,
  number, number, number, number, number, number, number, number,
];

/**
 * A rows x cols tensor for deep-learning pipelines.
 */
export interface ModeDLTensor {
  rows: typeof MODE_DL_ROWS;
  cols: typeof MODE_DL_COLS;
  data: number[][];
}

/**
 * Named dimension labels for the ML feature vector.
 */
export interface ModeMLFeatureLabel {
  index: number;
  name: string;
  description: string;
  normalization: 'MIN_MAX' | 'Z_SCORE' | 'LOG' | 'NONE';
}

/**
 * Canonical ML feature dimension labels.
 */
export const MODE_ML_FEATURE_LABELS: readonly ModeMLFeatureLabel[] = [
  { index: 0,  name: 'cash_balance_norm',         description: 'Normalized cash balance',                    normalization: 'MIN_MAX' },
  { index: 1,  name: 'shield_integrity',           description: 'Shield integrity percentage',                normalization: 'NONE' },
  { index: 2,  name: 'heat_level',                 description: 'Current heat level',                         normalization: 'MIN_MAX' },
  { index: 3,  name: 'pressure_score',             description: 'Combined pressure score',                    normalization: 'MIN_MAX' },
  { index: 4,  name: 'trust_score',                description: 'Trust score (co-op only, 0 otherwise)',      normalization: 'MIN_MAX' },
  { index: 5,  name: 'tick_progress',              description: 'Fraction of run completed',                  normalization: 'NONE' },
  { index: 6,  name: 'cards_in_hand',              description: 'Number of cards currently in hand',          normalization: 'MIN_MAX' },
  { index: 7,  name: 'cards_played_total',         description: 'Total cards played this run',                normalization: 'LOG' },
  { index: 8,  name: 'income_rate',                description: 'Current income per tick',                    normalization: 'MIN_MAX' },
  { index: 9,  name: 'debt_level',                 description: 'Current total debt',                         normalization: 'LOG' },
  { index: 10, name: 'active_bots',                description: 'Number of active hater bots',               normalization: 'MIN_MAX' },
  { index: 11, name: 'extraction_count',           description: 'Extractions suffered this run',              normalization: 'LOG' },
  { index: 12, name: 'counter_count',              description: 'Counters played this run',                   normalization: 'LOG' },
  { index: 13, name: 'combo_chain_length',         description: 'Current combo chain length',                 normalization: 'MIN_MAX' },
  { index: 14, name: 'rescue_count',               description: 'Rescues performed this run',                 normalization: 'LOG' },
  { index: 15, name: 'aid_count',                  description: 'Aid cards played this run',                  normalization: 'LOG' },
  { index: 16, name: 'phase_ordinal',              description: 'Current phase (0=FOUNDATION, 1=ESC, 2=SOV)',normalization: 'NONE' },
  { index: 17, name: 'team_size',                  description: 'Syndicate team size (0 if not co-op)',       normalization: 'MIN_MAX' },
  { index: 18, name: 'defection_step_ordinal',     description: 'Defection step ordinal (0-4)',               normalization: 'MIN_MAX' },
  { index: 19, name: 'loan_count_active',          description: 'Active loans as borrower',                   normalization: 'MIN_MAX' },
  { index: 20, name: 'opportunity_slots_open',     description: 'Open opportunity slots',                     normalization: 'MIN_MAX' },
  { index: 21, name: 'bluff_success_rate',         description: 'Historical bluff success rate',              normalization: 'NONE' },
  { index: 22, name: 'counter_success_rate',       description: 'Historical counter success rate',            normalization: 'NONE' },
  { index: 23, name: 'psyche_ordinal',             description: 'PsycheState ordinal (0-4)',                  normalization: 'MIN_MAX' },
  { index: 24, name: 'visibility_ordinal',         description: 'VisibilityTier ordinal (0-3)',               normalization: 'MIN_MAX' },
  { index: 25, name: 'legend_score_delta',         description: 'Delta from legend baseline (ghost only)',    normalization: 'Z_SCORE' },
  { index: 26, name: 'comeback_surge_active',      description: 'Whether comeback surge is active (0/1)',     normalization: 'NONE' },
  { index: 27, name: 'battle_budget_fraction',     description: 'Remaining battle budget as fraction of cap', normalization: 'NONE' },
  { index: 28, name: 'shared_objective_progress',  description: 'Best shared objective progress',             normalization: 'NONE' },
  { index: 29, name: 'rivalry_heat',               description: 'Carry heat in PvP rivalry',                  normalization: 'Z_SCORE' },
  { index: 30, name: 'discipline_cards_played',    description: 'Discipline cards played this run',           normalization: 'LOG' },
  { index: 31, name: 'mode_ordinal',               description: 'Mode ordinal (0=solo,1=pvp,2=coop,3=ghost)',normalization: 'NONE' },
] as const;

/**
 * ML prediction request sent to the model service.
 */
export interface MLPredictionRequest {
  runId: string;
  tick: number;
  mode: ModeCode;
  features: ModeMLFeatureVector;
  requestedPredictions: ('BOT_AGGRESSION' | 'CARD_QUALITY' | 'DEFECTION_RISK' | 'RESCUE_URGENCY')[];
}

/**
 * ML prediction response from the model service.
 */
export interface MLPredictionResponse {
  runId: string;
  tick: number;
  predictions: Record<string, number>;
  confidence: Record<string, number>;
  latencyMs: number;
}

/**
 * DL inference request for the deeper neural-network pipeline.
 */
export interface DLInferenceRequest {
  runId: string;
  tick: number;
  mode: ModeCode;
  tensor: ModeDLTensor;
  modelVersion: string;
}

/**
 * DL inference response.
 */
export interface DLInferenceResponse {
  runId: string;
  tick: number;
  output: number[];
  activations: number[][];
  latencyMs: number;
  modelVersion: string;
}

// ============================================================================
// S11 - CHAT BRIDGE CONTRACTS
// ============================================================================

/**
 * Event types emitted by the mode system to the chat bridge.
 */
export type ChatBridgeEventType =
  | 'MODE_STARTED'
  | 'MODE_ENDED'
  | 'CARD_PLAYED'
  | 'EXTRACTION_RESOLVED'
  | 'COUNTER_RESOLVED'
  | 'PHASE_TRANSITION'
  | 'PRESSURE_TRANSITION'
  | 'TRUST_TRANSITION'
  | 'DEFECTION_STEP'
  | 'COMBO_ACTIVATED'
  | 'RESCUE_TRIGGERED'
  | 'BADGE_EARNED'
  | 'OBJECTIVE_COMPLETED'
  | 'OBJECTIVE_FAILED'
  | 'RIVALRY_UPDATED'
  | 'LEGEND_CHALLENGED'
  | 'COMEBACK_SURGE_ACTIVATED'
  | 'COMEBACK_SURGE_EXPIRED'
  | 'LOAN_CREATED'
  | 'LOAN_RESOLVED';

/**
 * All chat bridge event type values as a constant array.
 */
export const CHAT_BRIDGE_EVENT_TYPES: readonly ChatBridgeEventType[] = [
  'MODE_STARTED',
  'MODE_ENDED',
  'CARD_PLAYED',
  'EXTRACTION_RESOLVED',
  'COUNTER_RESOLVED',
  'PHASE_TRANSITION',
  'PRESSURE_TRANSITION',
  'TRUST_TRANSITION',
  'DEFECTION_STEP',
  'COMBO_ACTIVATED',
  'RESCUE_TRIGGERED',
  'BADGE_EARNED',
  'OBJECTIVE_COMPLETED',
  'OBJECTIVE_FAILED',
  'RIVALRY_UPDATED',
  'LEGEND_CHALLENGED',
  'COMEBACK_SURGE_ACTIVATED',
  'COMEBACK_SURGE_EXPIRED',
  'LOAN_CREATED',
  'LOAN_RESOLVED',
] as const;

/**
 * Chat bridge event emitted from the mode system.
 */
export interface ModeChatBridgeEvent {
  eventId: string;
  type: ChatBridgeEventType;
  runId: string;
  mode: ModeCode;
  tick: number;
  actorId: string | null;
  targetId: string | null;
  summary: string;
  payload: Record<string, string | number | boolean | null>;
  timestamp: number;
}

/**
 * Chat signal routed through the chat bridge.
 */
export interface ModeChatSignal {
  signalId: string;
  mode: ModeCode;
  channel: 'SYSTEM' | 'TEAM' | 'SPECTATOR' | 'PRIVATE' | 'GLOBAL';
  eventType: ChatBridgeEventType;
  payload: Record<string, string | number | boolean | null>;
  senderId: string | null;
  recipientIds: string[];
  tick: number;
  timestamp: number;
}

/**
 * Chat bridge configuration per mode.
 */
export interface ChatBridgeConfig {
  mode: ModeCode;
  /** Which event types are forwarded to the chat bridge for this mode. */
  enabledEvents: ChatBridgeEventType[];
  /** Maximum events per tick to prevent flooding. */
  maxEventsPerTick: number;
  /** Whether spectator channel is active. */
  spectatorChannelActive: boolean;
  /** Debounce interval in ms for rapid-fire events. */
  debounceMs: number;
}

/**
 * Default chat bridge configurations per mode.
 */
export const DEFAULT_CHAT_BRIDGE_CONFIGS: readonly ChatBridgeConfig[] = [
  {
    mode: 'solo',
    enabledEvents: [
      'MODE_STARTED', 'MODE_ENDED', 'CARD_PLAYED', 'EXTRACTION_RESOLVED',
      'COUNTER_RESOLVED', 'PHASE_TRANSITION', 'PRESSURE_TRANSITION',
      'BADGE_EARNED', 'COMEBACK_SURGE_ACTIVATED', 'COMEBACK_SURGE_EXPIRED',
    ],
    maxEventsPerTick: 10,
    spectatorChannelActive: false,
    debounceMs: 100,
  },
  {
    mode: 'pvp',
    enabledEvents: [
      'MODE_STARTED', 'MODE_ENDED', 'CARD_PLAYED', 'EXTRACTION_RESOLVED',
      'COUNTER_RESOLVED', 'PHASE_TRANSITION', 'PRESSURE_TRANSITION',
      'BADGE_EARNED', 'RIVALRY_UPDATED', 'COMEBACK_SURGE_ACTIVATED',
      'COMEBACK_SURGE_EXPIRED',
    ],
    maxEventsPerTick: 15,
    spectatorChannelActive: true,
    debounceMs: 75,
  },
  {
    mode: 'coop',
    enabledEvents: [
      'MODE_STARTED', 'MODE_ENDED', 'CARD_PLAYED', 'EXTRACTION_RESOLVED',
      'COUNTER_RESOLVED', 'PHASE_TRANSITION', 'PRESSURE_TRANSITION',
      'TRUST_TRANSITION', 'DEFECTION_STEP', 'COMBO_ACTIVATED',
      'RESCUE_TRIGGERED', 'BADGE_EARNED', 'OBJECTIVE_COMPLETED',
      'OBJECTIVE_FAILED', 'COMEBACK_SURGE_ACTIVATED', 'COMEBACK_SURGE_EXPIRED',
      'LOAN_CREATED', 'LOAN_RESOLVED',
    ],
    maxEventsPerTick: 20,
    spectatorChannelActive: true,
    debounceMs: 50,
  },
  {
    mode: 'ghost',
    enabledEvents: [
      'MODE_STARTED', 'MODE_ENDED', 'CARD_PLAYED', 'EXTRACTION_RESOLVED',
      'COUNTER_RESOLVED', 'PHASE_TRANSITION', 'PRESSURE_TRANSITION',
      'BADGE_EARNED', 'LEGEND_CHALLENGED', 'COMEBACK_SURGE_ACTIVATED',
      'COMEBACK_SURGE_EXPIRED',
    ],
    maxEventsPerTick: 10,
    spectatorChannelActive: true,
    debounceMs: 100,
  },
] as const;

// ============================================================================
// S12 - ANALYTICS CONTRACTS
// ============================================================================

/**
 * Snapshot of mode analytics captured periodically or on demand.
 */
export interface ModeAnalyticsSnapshot {
  runId: string;
  mode: ModeCode;
  tick: number;
  timestamp: number;
  /** Total players in this run. */
  playerCount: number;
  /** Average cash balance across all players. */
  avgCashBalance: number;
  /** Average shield integrity across all players. */
  avgShieldIntegrity: number;
  /** Average pressure score. */
  avgPressureScore: number;
  /** Average trust score (co-op only). */
  avgTrustScore: number | null;
  /** Total extractions this run. */
  totalExtractions: number;
  /** Total counters played this run. */
  totalCounters: number;
  /** Total cards played across all players. */
  totalCardsPlayed: number;
  /** Current phase. */
  currentPhase: RunPhaseId;
  /** Number of active bots. */
  activeBots: number;
  /** Whether any player is in comeback surge. */
  comebackSurgeActive: boolean;
  /** Number of active shared objectives (co-op only). */
  activeObjectives: number;
  /** Number of completed shared objectives. */
  completedObjectives: number;
  /** Defection count (co-op only). */
  defectionCount: number;
  /** Bankruptcy count. */
  bankruptcyCount: number;
  /** ML feature vector for this snapshot. */
  mlFeatures: ModeMLFeatureVector | null;
}

/**
 * Mode health report — aggregated metrics for system monitoring.
 */
export interface ModeHealthReport {
  mode: ModeCode;
  /** Number of active runs in this mode. */
  activeRuns: number;
  /** Average ticks per second across active runs. */
  avgTickRate: number;
  /** 95th percentile tick processing time in ms. */
  p95TickProcessingMs: number;
  /** Number of runs completed in the last hour. */
  completedLastHour: number;
  /** Number of runs abandoned in the last hour. */
  abandonedLastHour: number;
  /** Average run duration in ticks. */
  avgRunDurationTicks: number;
  /** Error count in the last hour. */
  errorCountLastHour: number;
  /** Whether the mode is considered healthy. */
  healthy: boolean;
  /** Timestamp of the report. */
  timestamp: number;
}

/**
 * Single diagnostic entry for debugging mode issues.
 */
export interface ModeDiagnosticEntry {
  runId: string;
  mode: ModeCode;
  tick: number;
  severity: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
  category: 'ENGINE' | 'BOT' | 'CARD' | 'PRESSURE' | 'TRUST' | 'DEFECTION' |
    'PHASE' | 'COMBO' | 'ML' | 'CHAT' | 'ANALYTICS' | 'BADGE' | 'OBJECTIVE';
  message: string;
  details: Record<string, string | number | boolean | null>;
  timestamp: number;
}

/**
 * Analytics aggregation window sizes.
 */
export type AnalyticsWindowSize = '1m' | '5m' | '15m' | '1h' | '6h' | '24h';

/**
 * Aggregated analytics for a specific window.
 */
export interface AnalyticsWindowAggregate {
  mode: ModeCode;
  window: AnalyticsWindowSize;
  startTimestamp: number;
  endTimestamp: number;
  totalRuns: number;
  avgDurationTicks: number;
  avgFinalCash: number;
  freedomRate: number;
  bankruptcyRate: number;
  avgCardsPlayed: number;
  avgExtractions: number;
  avgCounters: number;
  mostCommonDeckType: DeckType;
  mostCommonPhaseAtEnd: RunPhaseId;
}

/**
 * Per-player analytics summary for a completed run.
 */
export interface PlayerRunAnalytics {
  playerId: string;
  runId: string;
  mode: ModeCode;
  finalCash: number;
  finalShieldIntegrity: number;
  totalCardsPlayed: number;
  totalExtractionsSuffered: number;
  totalCountersPlayed: number;
  totalIncomeEarned: number;
  totalDebtAccumulated: number;
  peakPressureTier: PressureTier;
  peakComboChain: number;
  rescuesPerformed: number;
  aidGiven: number;
  finalTrustScore: number | null;
  defected: boolean;
  badgesEarned: string[];
  runOutcome: 'FREEDOM' | 'TIMEOUT' | 'BANKRUPT' | 'ABANDONED';
  durationTicks: number;
}

// ============================================================================
// S13 - PROOF BADGE CONTRACTS
// ============================================================================

/**
 * All proof badge identifiers across all 4 modes.
 */
export type ProofBadgeId =
  // Solo badges
  | 'SOLO_FIRST_FREEDOM'
  | 'SOLO_SPEED_RUN'
  | 'SOLO_NO_HIT'
  | 'SOLO_FULL_SHIELD'
  | 'SOLO_DEBT_FREE'
  | 'SOLO_DISCIPLINE_MASTER'
  | 'SOLO_COUNTER_KING'
  | 'SOLO_MAX_INCOME'
  // PvP badges
  | 'PVP_FIRST_WIN'
  | 'PVP_FLAWLESS_VICTORY'
  | 'PVP_RIVAL_BESTED'
  | 'PVP_NEMESIS_DEFEATED'
  | 'PVP_BLUFF_MASTER'
  | 'PVP_SABOTAGE_ACE'
  | 'PVP_COUNTER_STREAK'
  | 'PVP_COMEBACK_KING'
  // Co-op badges
  | 'COOP_COLLECTIVE_FREEDOM'
  | 'COOP_ZERO_BANKRUPTCIES'
  | 'COOP_TRUST_CEILING'
  | 'COOP_RESCUE_HERO'
  | 'COOP_AID_CHAMPION'
  | 'COOP_COMBO_MASTER'
  | 'COOP_LOYAL_MEMBER'
  | 'COOP_LOAN_SHARK'
  // Ghost badges
  | 'GHOST_LEGEND_BEATEN'
  | 'GHOST_PERFECT_RUN'
  | 'GHOST_SPEED_GHOST'
  | 'GHOST_DISCIPLINE_ONLY'
  | 'GHOST_NO_COUNTER'
  | 'GHOST_FULL_MARKERS'
  | 'GHOST_COMEBACK_GHOST'
  | 'GHOST_UNTOUCHABLE';

/**
 * Condition definition for earning a proof badge.
 */
export interface ProofBadgeCondition {
  badgeId: ProofBadgeId;
  /** Human-readable name. */
  name: string;
  /** Description of what the player must do. */
  description: string;
  /** Which mode this badge belongs to. */
  mode: ModeCode;
  /** Rarity tier for display purposes. */
  rarity: 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
  /** CORD bonus points awarded when this badge is earned. */
  cordBonus: number;
  /** Whether this badge can be earned multiple times. */
  repeatable: boolean;
}

/**
 * Result of a badge evaluation check.
 */
export interface ProofBadgeResult {
  badgeId: ProofBadgeId;
  earned: boolean;
  progress: number;
  evaluatedAtTick: number;
  notes: string[];
}

/**
 * Canonical list of all proof badges with conditions.
 */
export const ALL_PROOF_BADGES: readonly ProofBadgeCondition[] = [
  // Solo
  { badgeId: 'SOLO_FIRST_FREEDOM',     name: 'First Freedom',       description: 'Achieve freedom in solo mode for the first time',                         mode: 'solo',  rarity: 'COMMON',    cordBonus: 100,  repeatable: false },
  { badgeId: 'SOLO_SPEED_RUN',         name: 'Speed Demon',         description: 'Achieve freedom in under 60 ticks in solo mode',                          mode: 'solo',  rarity: 'RARE',      cordBonus: 500,  repeatable: true },
  { badgeId: 'SOLO_NO_HIT',            name: 'Untouched',           description: 'Complete a solo run without taking any extraction damage',                 mode: 'solo',  rarity: 'EPIC',      cordBonus: 800,  repeatable: true },
  { badgeId: 'SOLO_FULL_SHIELD',       name: 'Iron Fortress',       description: 'Maintain full shield integrity for an entire solo run',                    mode: 'solo',  rarity: 'RARE',      cordBonus: 400,  repeatable: true },
  { badgeId: 'SOLO_DEBT_FREE',         name: 'Clean Slate',         description: 'Complete a solo run with zero debt',                                       mode: 'solo',  rarity: 'UNCOMMON',  cordBonus: 250,  repeatable: true },
  { badgeId: 'SOLO_DISCIPLINE_MASTER', name: 'Discipline Master',   description: 'Play 10+ discipline cards in a single solo run',                           mode: 'solo',  rarity: 'UNCOMMON',  cordBonus: 300,  repeatable: true },
  { badgeId: 'SOLO_COUNTER_KING',      name: 'Counter King',        description: 'Successfully counter 8+ extractions in a single solo run',                 mode: 'solo',  rarity: 'RARE',      cordBonus: 450,  repeatable: true },
  { badgeId: 'SOLO_MAX_INCOME',        name: 'Money Machine',       description: 'Reach 5000+ cash balance in solo mode',                                   mode: 'solo',  rarity: 'UNCOMMON',  cordBonus: 200,  repeatable: true },

  // PvP
  { badgeId: 'PVP_FIRST_WIN',          name: 'First Blood',         description: 'Win your first PvP match',                                                mode: 'pvp',   rarity: 'COMMON',    cordBonus: 100,  repeatable: false },
  { badgeId: 'PVP_FLAWLESS_VICTORY',   name: 'Flawless Victory',    description: 'Win a PvP match without dropping below 50% shield',                       mode: 'pvp',   rarity: 'EPIC',      cordBonus: 750,  repeatable: true },
  { badgeId: 'PVP_RIVAL_BESTED',       name: 'Rival Bested',        description: 'Defeat an arch-rival in PvP',                                             mode: 'pvp',   rarity: 'RARE',      cordBonus: 500,  repeatable: true },
  { badgeId: 'PVP_NEMESIS_DEFEATED',   name: 'Nemesis Fallen',      description: 'Defeat a nemesis-level opponent in PvP',                                  mode: 'pvp',   rarity: 'LEGENDARY', cordBonus: 1000, repeatable: true },
  { badgeId: 'PVP_BLUFF_MASTER',       name: 'Bluff Master',        description: 'Successfully land 5+ bluffs in a single PvP match',                       mode: 'pvp',   rarity: 'RARE',      cordBonus: 400,  repeatable: true },
  { badgeId: 'PVP_SABOTAGE_ACE',       name: 'Sabotage Ace',        description: 'Land 5+ sabotage cards that deal full damage in a PvP match',             mode: 'pvp',   rarity: 'UNCOMMON',  cordBonus: 350,  repeatable: true },
  { badgeId: 'PVP_COUNTER_STREAK',     name: 'Counter Streak',      description: 'Counter 3 consecutive opponent plays in PvP',                             mode: 'pvp',   rarity: 'RARE',      cordBonus: 450,  repeatable: true },
  { badgeId: 'PVP_COMEBACK_KING',      name: 'Comeback King',       description: 'Win a PvP match after activating comeback surge',                         mode: 'pvp',   rarity: 'EPIC',      cordBonus: 700,  repeatable: true },

  // Co-op
  { badgeId: 'COOP_COLLECTIVE_FREEDOM', name: 'Collective Freedom', description: 'All syndicate members achieve freedom in the same phase',                 mode: 'coop',  rarity: 'RARE',      cordBonus: 600,  repeatable: true },
  { badgeId: 'COOP_ZERO_BANKRUPTCIES',  name: 'Zero Down',          description: 'Complete a co-op run with no bankruptcies',                               mode: 'coop',  rarity: 'UNCOMMON',  cordBonus: 350,  repeatable: true },
  { badgeId: 'COOP_TRUST_CEILING',      name: 'Trust Ceiling',      description: 'All syndicate members reach BONDED trust simultaneously',                  mode: 'coop',  rarity: 'EPIC',      cordBonus: 800,  repeatable: true },
  { badgeId: 'COOP_RESCUE_HERO',        name: 'Rescue Hero',        description: 'Rescue 3+ teammates from bankruptcy in a single co-op run',               mode: 'coop',  rarity: 'RARE',      cordBonus: 500,  repeatable: true },
  { badgeId: 'COOP_AID_CHAMPION',       name: 'Aid Champion',       description: 'Play 8+ aid cards in a single co-op run',                                 mode: 'coop',  rarity: 'UNCOMMON',  cordBonus: 300,  repeatable: true },
  { badgeId: 'COOP_COMBO_MASTER',       name: 'Combo Master',       description: 'Activate 3+ syndicate combo cards in a single co-op run',                 mode: 'coop',  rarity: 'RARE',      cordBonus: 550,  repeatable: true },
  { badgeId: 'COOP_LOYAL_MEMBER',       name: 'Loyal Member',       description: 'Complete 5 co-op runs without ever defecting',                            mode: 'coop',  rarity: 'UNCOMMON',  cordBonus: 250,  repeatable: false },
  { badgeId: 'COOP_LOAN_SHARK',         name: 'Loan Shark',         description: 'Have 3+ active loans as lender with 100% repayment rate',                 mode: 'coop',  rarity: 'RARE',      cordBonus: 400,  repeatable: true },

  // Ghost
  { badgeId: 'GHOST_LEGEND_BEATEN',     name: 'Legend Beaten',       description: 'Beat a legend run ghost score',                                          mode: 'ghost', rarity: 'RARE',      cordBonus: 600,  repeatable: true },
  { badgeId: 'GHOST_PERFECT_RUN',       name: 'Ghost Perfect',       description: 'Complete a ghost run with maximum possible score',                       mode: 'ghost', rarity: 'LEGENDARY', cordBonus: 1500, repeatable: true },
  { badgeId: 'GHOST_SPEED_GHOST',       name: 'Speed Ghost',         description: 'Beat a legend ghost in under 50 ticks',                                  mode: 'ghost', rarity: 'EPIC',      cordBonus: 900,  repeatable: true },
  { badgeId: 'GHOST_DISCIPLINE_ONLY',   name: 'Discipline Only',     description: 'Complete a ghost run using only discipline and counter cards',            mode: 'ghost', rarity: 'EPIC',      cordBonus: 1000, repeatable: true },
  { badgeId: 'GHOST_NO_COUNTER',        name: 'No Counter Ghost',    description: 'Complete a ghost run without playing any counter cards',                  mode: 'ghost', rarity: 'RARE',      cordBonus: 500,  repeatable: true },
  { badgeId: 'GHOST_FULL_MARKERS',      name: 'Full Markers',        description: 'Collect all 5 legend marker kinds in a single ghost run',                mode: 'ghost', rarity: 'EPIC',      cordBonus: 800,  repeatable: true },
  { badgeId: 'GHOST_COMEBACK_GHOST',    name: 'Comeback Ghost',      description: 'Beat a legend ghost after activating comeback surge',                    mode: 'ghost', rarity: 'RARE',      cordBonus: 550,  repeatable: true },
  { badgeId: 'GHOST_UNTOUCHABLE',       name: 'Untouchable Ghost',   description: 'Complete a ghost run without taking any extraction damage',              mode: 'ghost', rarity: 'LEGENDARY', cordBonus: 1200, repeatable: true },
] as const;

// ============================================================================
// S14 - BATCH SIMULATION CONTRACTS
// ============================================================================

/**
 * Configuration for a batch simulation run.
 */
export interface BatchSimulationConfig {
  /** Unique identifier for this batch. */
  batchId: string;
  /** Mode to simulate. */
  mode: ModeCode;
  /** Number of simulated runs. */
  runCount: number;
  /** Tick limit per run. */
  tickLimit: number;
  /** Seed for deterministic RNG (null = random). */
  seed: number | null;
  /** Which bot profiles to use. */
  botProfiles: BotThreatProfile[];
  /** Phase configs to use. */
  phaseConfigs: PhaseConfig[];
  /** Whether to record ML feature vectors. */
  recordMLFeatures: boolean;
  /** Whether to record full event history. */
  recordHistory: boolean;
  /** Player count per run. */
  playerCount: number;
  /** DeckType distribution: how many of each deck type to include. */
  deckDistribution: Partial<Record<DeckType, number>>;
}

/**
 * Result of a single simulated run within a batch.
 */
export interface BatchSimulationResult {
  runId: string;
  batchId: string;
  mode: ModeCode;
  outcome: 'FREEDOM' | 'TIMEOUT' | 'BANKRUPT' | 'ABANDONED';
  durationTicks: number;
  finalCashByPlayer: Record<string, number>;
  finalShieldByPlayer: Record<string, number>;
  peakPressureByPlayer: Record<string, PressureTier>;
  totalExtractions: number;
  totalCounters: number;
  totalCardsPlayed: number;
  badgesEarned: ProofBadgeId[];
  mlFeatureSnapshots: ModeMLFeatureVector[];
  seed: number;
}

/**
 * Summary of an entire batch simulation.
 */
export interface BatchRunSummary {
  batchId: string;
  mode: ModeCode;
  totalRuns: number;
  completedRuns: number;
  freedomRate: number;
  bankruptcyRate: number;
  timeoutRate: number;
  abandonRate: number;
  avgDurationTicks: number;
  avgFinalCash: number;
  avgExtractions: number;
  avgCounters: number;
  avgCardsPlayed: number;
  mostCommonBadge: ProofBadgeId | null;
  p50DurationTicks: number;
  p95DurationTicks: number;
  executionTimeMs: number;
}

// ============================================================================
// S15 - CONVENIENCE TYPE GUARDS
// ============================================================================

/** All valid ModeCode values as a Set for O(1) lookup. */
const MODE_CODE_SET: ReadonlySet<string> = new Set<ModeCode>(['solo', 'pvp', 'coop', 'ghost']);

/** All valid TeamRoleId values. */
const TEAM_ROLE_ID_SET: ReadonlySet<string> = new Set<TeamRoleId>([
  'INCOME_BUILDER', 'SHIELD_ARCHITECT', 'OPPORTUNITY_HUNTER', 'COUNTER_INTEL',
]);

/** All valid PsycheState values. */
const PSYCHE_STATE_SET: ReadonlySet<string> = new Set<PsycheState>([
  'COMPOSED', 'STRESSED', 'CRACKING', 'BREAKING', 'DESPERATE',
]);

/** All valid VisibilityTier values. */
const VISIBILITY_TIER_SET: ReadonlySet<string> = new Set<VisibilityTier>([
  'SHADOWED', 'SIGNALED', 'TELEGRAPHED', 'EXPOSED',
]);

/** All valid RunPhaseId values. */
const RUN_PHASE_ID_SET: ReadonlySet<string> = new Set<RunPhaseId>([
  'FOUNDATION', 'ESCALATION', 'SOVEREIGNTY',
]);

/** All valid PressureTier values. */
const PRESSURE_TIER_SET: ReadonlySet<string> = new Set<PressureTier>([
  'T0', 'T1', 'T2', 'T3', 'T4',
]);

/** All valid DeckType values. */
const DECK_TYPE_SET: ReadonlySet<string> = new Set<DeckType>([
  'OPPORTUNITY', 'IPA', 'FUBAR', 'MISSED_OPPORTUNITY', 'PRIVILEGED',
  'SO', 'SABOTAGE', 'COUNTER', 'AID', 'RESCUE', 'DISCIPLINE',
  'TRUST', 'BLUFF', 'GHOST',
]);

/** All valid HaterBotId values. */
const HATER_BOT_ID_SET: ReadonlySet<string> = new Set<HaterBotId>([
  'BOT_01', 'BOT_02', 'BOT_03', 'BOT_04', 'BOT_05',
]);

/** All valid DefectionStep values. */
const DEFECTION_STEP_SET: ReadonlySet<string> = new Set<DefectionStep>([
  'NONE', 'BREAK_PACT', 'SILENT_EXIT', 'ASSET_SEIZURE', 'DEFECTED',
]);

/** All valid CounterCardId values. */
const COUNTER_CARD_ID_SET: ReadonlySet<string> = new Set<CounterCardId>([
  'LIQUIDITY_WALL', 'CREDIT_FREEZE', 'EVIDENCE_FILE', 'SIGNAL_CLEAR',
  'DEBT_SHIELD', 'SOVEREIGNTY_LOCK', 'FORCED_DRAW_BLOCK',
]);

/** All valid ExtractionActionId values. */
const EXTRACTION_ACTION_ID_SET: ReadonlySet<string> = new Set<ExtractionActionId>([
  'MARKET_DUMP', 'CREDIT_REPORT_PULL', 'REGULATORY_FILING',
  'MISINFORMATION_FLOOD', 'DEBT_INJECTION', 'HOSTILE_TAKEOVER',
  'LIQUIDATION_NOTICE',
]);

/** All valid ModeEventLevel values. */
const MODE_EVENT_LEVEL_SET: ReadonlySet<string> = new Set<ModeEventLevel>([
  'INFO', 'WARNING', 'ALERT', 'SUCCESS',
]);

/** All valid ProofBadgeId values. */
const PROOF_BADGE_ID_SET: ReadonlySet<string> = new Set(
  ALL_PROOF_BADGES.map(b => b.badgeId),
);

/** All valid SharedObjectiveId values. */
const SHARED_OBJECTIVE_ID_SET: ReadonlySet<string> = new Set<SharedObjectiveId>([
  'COLLECTIVE_FREEDOM', 'ZERO_BANKRUPTCIES', 'FULL_SHIELD_SWEEP', 'TRUST_CEILING',
]);

/** All valid CommunicationCardId values. */
const COMMUNICATION_CARD_ID_SET: ReadonlySet<string> = new Set<CommunicationCardId>([
  'SIGNAL_ASSIST', 'SIGNAL_WARNING', 'SIGNAL_RESOURCE_SHARE',
  'SIGNAL_RETREAT', 'SIGNAL_COORDINATE', 'SIGNAL_DEFECTION_ALERT',
]);

/** All valid SyndicateComboCardId values. */
const SYNDICATE_COMBO_CARD_ID_SET: ReadonlySet<string> = new Set<SyndicateComboCardId>([
  'COMBO_SHIELD_WALL', 'COMBO_INCOME_SURGE', 'COMBO_TRUST_BRIDGE',
  'COMBO_RESCUE_CHAIN', 'COMBO_COUNTER_STORM', 'COMBO_DISCIPLINE_LOCK',
]);

/**
 * Type guard: is the value a valid ModeCode?
 */
export function isModeCode(value: unknown): value is ModeCode {
  return typeof value === 'string' && MODE_CODE_SET.has(value);
}

/**
 * Type guard: is the value a valid TeamRoleId?
 */
export function isTeamRoleId(value: unknown): value is TeamRoleId {
  return typeof value === 'string' && TEAM_ROLE_ID_SET.has(value);
}

/**
 * Type guard: is the value a valid PsycheState?
 */
export function isPsycheState(value: unknown): value is PsycheState {
  return typeof value === 'string' && PSYCHE_STATE_SET.has(value);
}

/**
 * Type guard: is the value a valid VisibilityTier?
 */
export function isVisibilityTier(value: unknown): value is VisibilityTier {
  return typeof value === 'string' && VISIBILITY_TIER_SET.has(value);
}

/**
 * Type guard: is the value a valid RunPhaseId?
 */
export function isRunPhaseId(value: unknown): value is RunPhaseId {
  return typeof value === 'string' && RUN_PHASE_ID_SET.has(value);
}

/**
 * Type guard: is the value a valid PressureTier?
 */
export function isPressureTier(value: unknown): value is PressureTier {
  return typeof value === 'string' && PRESSURE_TIER_SET.has(value);
}

/**
 * Type guard: is the value a valid DeckType?
 */
export function isDeckType(value: unknown): value is DeckType {
  return typeof value === 'string' && DECK_TYPE_SET.has(value);
}

/**
 * Type guard: is the value a valid HaterBotId?
 */
export function isHaterBotId(value: unknown): value is HaterBotId {
  return typeof value === 'string' && HATER_BOT_ID_SET.has(value);
}

/**
 * Type guard: is the value a valid DefectionStep?
 */
export function isDefectionStep(value: unknown): value is DefectionStep {
  return typeof value === 'string' && DEFECTION_STEP_SET.has(value);
}

/**
 * Type guard: is the value a valid CounterCardId?
 */
export function isCounterCardId(value: unknown): value is CounterCardId {
  return typeof value === 'string' && COUNTER_CARD_ID_SET.has(value);
}

/**
 * Type guard: is the value a valid ExtractionActionId?
 */
export function isExtractionActionId(value: unknown): value is ExtractionActionId {
  return typeof value === 'string' && EXTRACTION_ACTION_ID_SET.has(value);
}

/**
 * Type guard: is the value a valid ModeEventLevel?
 */
export function isModeEventLevel(value: unknown): value is ModeEventLevel {
  return typeof value === 'string' && MODE_EVENT_LEVEL_SET.has(value);
}

/**
 * Type guard: is the value a valid ProofBadgeId?
 */
export function isProofBadgeId(value: unknown): value is ProofBadgeId {
  return typeof value === 'string' && PROOF_BADGE_ID_SET.has(value);
}

/**
 * Type guard: is the value a valid SharedObjectiveId?
 */
export function isSharedObjectiveId(value: unknown): value is SharedObjectiveId {
  return typeof value === 'string' && SHARED_OBJECTIVE_ID_SET.has(value);
}

/**
 * Type guard: is the value a valid CommunicationCardId?
 */
export function isCommunicationCardId(value: unknown): value is CommunicationCardId {
  return typeof value === 'string' && COMMUNICATION_CARD_ID_SET.has(value);
}

/**
 * Type guard: is the value a valid SyndicateComboCardId?
 */
export function isSyndicateComboCardId(value: unknown): value is SyndicateComboCardId {
  return typeof value === 'string' && SYNDICATE_COMBO_CARD_ID_SET.has(value);
}

/**
 * Check whether a given DeckType is legal in a given mode.
 */
export function isDeckLegalInMode(deckType: DeckType, mode: ModeCode): boolean {
  const legal = MODE_DECK_LEGALITY[mode];
  return legal.includes(deckType);
}

/**
 * Check whether a player qualifies for rescue based on pressure tier.
 */
export function isRescueEligible(tier: PressureTier): boolean {
  const config = PRESSURE_TIER_THRESHOLDS.find(p => p.tier === tier);
  return config !== undefined && config.rescueEligible;
}

/**
 * Check whether a pressure tier qualifies for comeback surge.
 */
export function isComebackSurgeEligible(tier: PressureTier): boolean {
  const config = PRESSURE_TIER_THRESHOLDS.find(p => p.tier === tier);
  return config !== undefined && config.comebackSurgeEligible;
}

/**
 * Get the trust band for a given score.
 */
export function getTrustBandForScore(score: number): TrustBand | null {
  return TRUST_BAND_THRESHOLDS.find(
    b => score >= b.lowerBound && score < b.upperBound,
  ) ?? null;
}

/**
 * Get the pressure tier for a given pressure score.
 */
export function getPressureTierForScore(score: number): PressureBandConfig | null {
  return PRESSURE_TIER_THRESHOLDS.find(
    p => score >= p.lowerBound && score < p.upperBound,
  ) ?? null;
}

/**
 * Get the cost modifier for a given pressure tier.
 */
export function getCostModifierForTier(tier: PressureTier): number {
  const entry = PRESSURE_COST_MODIFIERS.find(p => p.tier === tier);
  return entry !== undefined ? entry.costMultiplier : 1.0;
}

/**
 * Get the phase config for a given tick.
 */
export function getPhaseForTick(tick: number): PhaseConfig | null {
  return DEFAULT_PHASE_CONFIGS.find(
    p => tick >= p.startTick && tick < p.endTick,
  ) ?? null;
}

/**
 * Get the bot threat profile for a given HaterBotId.
 */
export function getBotThreatProfile(botId: HaterBotId): BotThreatProfile | null {
  return DEFAULT_BOT_THREAT_PROFILES.find(p => p.botId === botId) ?? null;
}

/**
 * Get the deck profile for a given DeckType.
 */
export function getDeckProfile(deckType: DeckType): DeckProfile | null {
  return DECK_TYPE_PROFILES.find(p => p.deckType === deckType) ?? null;
}

/**
 * Validate a CardPlayIntent against mode legality and overlay rules.
 */
export function isCardPlayLegal(intent: CardPlayIntent, mode: ModeCode): boolean {
  const card = 'card' in intent.card && 'definitionId' in intent.card
    ? (intent.card as CardInstance).card
    : intent.card as CardDefinition;
  return isDeckLegalInMode(card.deckType, mode);
}

/**
 * Get the next defection step from the current step.
 */
export function getNextDefectionStep(current: DefectionStep): DefectionStep {
  const idx = DEFECTION_STEP_SEQUENCE.indexOf(current);
  if (idx < 0 || idx >= DEFECTION_STEP_SEQUENCE.length - 1) return current;
  return DEFECTION_STEP_SEQUENCE[idx + 1];
}

/**
 * Check if a defection step is reversible.
 */
export function isDefectionReversible(step: DefectionStep): boolean {
  return step === 'NONE' || step === 'BREAK_PACT';
}

// ============================================================================
// S16 - DEFAULT / ZERO-VALUE CONSTANTS
// ============================================================================

/**
 * Zero-value ModeFrame for initialization.
 */
export const ZERO_MODE_FRAME: Readonly<ModeFrame> = {
  mode: 'solo',
  tick: 0,
  participants: [],
  history: [],
  sharedThreats: [],
  sharedOpportunitySlots: [],
  rivalry: null,
  syndicate: null,
  legend: null,
};

/**
 * Zero-value ModeParticipant for initialization.
 */
export const ZERO_MODE_PARTICIPANT: Readonly<Omit<ModeParticipant, 'snapshot'>> = {
  playerId: '',
  teamId: null,
  roleId: null,
  counters: [],
  metadata: {},
};

/**
 * Zero-value TrustAuditLine for initialization.
 */
export const ZERO_TRUST_AUDIT_LINE: Readonly<TrustAuditLine> = {
  playerId: '',
  trustScore: 50,
  aidGivenCount: 0,
  rescueCount: 0,
  cascadeAbsorptions: 0,
  loanRepaymentRate: 1.0,
  defectionRiskSignal: 'LOW',
  notes: [],
};

/**
 * Zero-value ML feature vector.
 */
export const ZERO_ML_VECTOR: ModeMLFeatureVector = [
  0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0,
];

/**
 * Zero-value DL tensor.
 */
export const ZERO_DL_TENSOR: Readonly<ModeDLTensor> = {
  rows: MODE_DL_ROWS,
  cols: MODE_DL_COLS,
  data: Array.from({ length: MODE_DL_ROWS }, () =>
    Array.from({ length: MODE_DL_COLS }, () => 0),
  ),
};

/**
 * Zero-value analytics snapshot.
 */
export const ZERO_ANALYTICS_SNAPSHOT: Readonly<ModeAnalyticsSnapshot> = {
  runId: '',
  mode: 'solo',
  tick: 0,
  timestamp: 0,
  playerCount: 0,
  avgCashBalance: 0,
  avgShieldIntegrity: 0,
  avgPressureScore: 0,
  avgTrustScore: null,
  totalExtractions: 0,
  totalCounters: 0,
  totalCardsPlayed: 0,
  currentPhase: 'FOUNDATION',
  activeBots: 0,
  comebackSurgeActive: false,
  activeObjectives: 0,
  completedObjectives: 0,
  defectionCount: 0,
  bankruptcyCount: 0,
  mlFeatures: null,
};

/**
 * Zero-value combo escalation state.
 */
export const ZERO_COMBO_ESCALATION: Readonly<ComboEscalationState> = {
  chainLength: 0,
  damageMultiplier: 1.0,
  budgetBonusPerLink: 0,
  chainStartTick: 0,
  lastExtensionTick: 0,
  maxChainThisRun: 0,
  active: false,
};

/**
 * Zero-value defection sequence state.
 */
export const ZERO_DEFECTION_SEQUENCE: Readonly<Omit<DefectionSequenceState, 'playerId'>> = {
  currentStep: 'NONE',
  startedAtTick: null,
  stepEnteredAtTick: 0,
  reversible: true,
  accumulatedPenalty: 0,
  seizureFraction: 0,
  notified: false,
};

/**
 * Zero-value battle budget snapshot.
 */
export const ZERO_BATTLE_BUDGET: Readonly<BattleBudgetSnapshot> = {
  remaining: 0,
  spent: 0,
  generationRate: 0,
  phase: 'FOUNDATION',
  capturedAtTick: 0,
  phaseCap: 0,
};

/**
 * Zero-value pressure snapshot.
 */
export const ZERO_PRESSURE_SNAPSHOT: Readonly<Omit<PressureSnapshot, 'playerId'>> = {
  tick: 0,
  pressureScore: 0,
  tier: 'T0',
  costModifier: 1.0,
  rescueEligible: false,
  comebackSurgeActive: false,
  comebackSurgeTicksRemaining: 0,
};

/**
 * Zero-value trust snapshot.
 */
export const ZERO_TRUST_SNAPSHOT: Readonly<Omit<TrustSnapshot, 'playerId'>> = {
  tick: 0,
  score: 50,
  band: 'NEUTRAL',
  activeLoansAsLender: 0,
  activeLoansAsBorrower: 0,
  totalAidGiven: 0,
  totalRescuesPerformed: 0,
  defectionRisk: 'LOW',
};

/**
 * Zero-value shared objective state.
 */
export const ZERO_SHARED_OBJECTIVE_STATE: Readonly<Omit<SharedObjectiveState, 'objectiveId'>> = {
  active: false,
  progress: 0,
  completed: false,
  failed: false,
  activatedAtTick: 0,
  resolvedAtTick: null,
  contributorIds: [],
};

/**
 * Zero-value mode health report.
 */
export const ZERO_MODE_HEALTH_REPORT: Readonly<Omit<ModeHealthReport, 'mode'>> = {
  activeRuns: 0,
  avgTickRate: 0,
  p95TickProcessingMs: 0,
  completedLastHour: 0,
  abandonedLastHour: 0,
  avgRunDurationTicks: 0,
  errorCountLastHour: 0,
  healthy: true,
  timestamp: 0,
};

/**
 * Zero-value card overlay snapshot.
 */
export const ZERO_CARD_OVERLAY_SNAPSHOT: Readonly<Omit<CardOverlaySnapshot, 'instanceId' | 'definitionId'>> = {
  mode: 'solo',
  appliedTick: 0,
  overlay: DEFAULT_MODE_OVERLAY,
  deckType: 'OPPORTUNITY',
  resolvedCost: 0,
  resolvedTargeting: 'SELF',
  resolvedTimingClasses: [],
};

/**
 * Zero-value battle round result.
 */
export const ZERO_BATTLE_ROUND_RESULT: Readonly<BattleRoundResult> = {
  roundTick: 0,
  extractions: [],
  counters: [],
  budgetAfter: ZERO_BATTLE_BUDGET,
  comboState: ZERO_COMBO_ESCALATION,
};

/**
 * Zero-value mode diagnostic entry.
 */
export const ZERO_DIAGNOSTIC_ENTRY: Readonly<Omit<ModeDiagnosticEntry, 'runId'>> = {
  mode: 'solo',
  tick: 0,
  severity: 'DEBUG',
  category: 'ENGINE',
  message: '',
  details: {},
  timestamp: 0,
};

/**
 * Zero-value player run analytics.
 */
export const ZERO_PLAYER_RUN_ANALYTICS: Readonly<Omit<PlayerRunAnalytics, 'playerId' | 'runId'>> = {
  mode: 'solo',
  finalCash: 0,
  finalShieldIntegrity: 1.0,
  totalCardsPlayed: 0,
  totalExtractionsSuffered: 0,
  totalCountersPlayed: 0,
  totalIncomeEarned: 0,
  totalDebtAccumulated: 0,
  peakPressureTier: 'T0',
  peakComboChain: 0,
  rescuesPerformed: 0,
  aidGiven: 0,
  finalTrustScore: null,
  defected: false,
  badgesEarned: [],
  runOutcome: 'FREEDOM',
  durationTicks: 0,
};

/**
 * Zero-value mode chat bridge event.
 */
export const ZERO_CHAT_BRIDGE_EVENT: Readonly<Omit<ModeChatBridgeEvent, 'eventId'>> = {
  type: 'MODE_STARTED',
  runId: '',
  mode: 'solo',
  tick: 0,
  actorId: null,
  targetId: null,
  summary: '',
  payload: {},
  timestamp: 0,
};

/**
 * Zero-value mode finalization.
 */
export const ZERO_MODE_FINALIZATION: Readonly<ModeFinalization> = {
  bonusMultiplier: 1.0,
  flatBonus: 0,
  badges: [],
  audits: [],
  notes: [],
};

/**
 * Zero-value mode validation result (valid).
 */
export const ZERO_MODE_VALIDATION_RESULT: Readonly<ModeValidationResult> = {
  ok: true,
  reason: null,
  warnings: [],
};

/**
 * Zero-value rivalry ledger.
 */
export const ZERO_RIVALRY_LEDGER: Readonly<Omit<RivalryLedger, 'playerA' | 'playerB'>> = {
  matchesPlayed: 0,
  wins: {},
  archRivalUnlocked: false,
  nemesisUnlocked: false,
  carryHeatByPlayer: {},
};

/**
 * Zero-value syndicate shared state.
 */
export const ZERO_SYNDICATE_STATE: Readonly<SyndicateSharedState> = {
  treasuryBalance: 0,
  freedomThreshold: 10000,
  freedPlayerIds: [],
  defectedPlayerIds: [],
  splitDisposition: 'NONE',
  trustAudit: {},
};
