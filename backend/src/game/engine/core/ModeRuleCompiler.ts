/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/core/ModeRuleCompiler.ts
 *
 * Doctrine:
 * - mode truth is compiled server-side from one canonical ruleset
 * - compilation is deterministic, immutable, and safe to cache
 * - compiled rules should be directly consumable by timing, routing, and proof
 * - card legality must reflect both static mode doctrine and runtime state
 * - this file does not replace backend mode adapters; it feeds them
 *
 * Surface summary:
 *   § 1  — Exported interfaces (ModeLabel, policies, compiled rules, projections)
 *   § 2  — Internal seeds and constants (MODE_SEEDS, pressure multipliers)
 *   § 3  — ModeRuleCompiler (compile, compileSnapshot, isCardLegal, projectCard)
 *   § 4  — ModePlayRecommendation (card play priority + timing recommendation)
 *   § 5  — ModeDefectionAnalyzer (coop defection risk and trust trajectory)
 *   § 6  — ModeBadgeAdvisor (per-run badge achievement projection)
 *   § 7  — ModePhaseBoundaryDetector (phase transition readiness)
 *   § 8  — ModeHandOptimizer (hand ranking against compiled rules)
 *   § 9  — ModePressureAdvisor (pressure curve recommendations)
 *   § 10 — ModeMLFeatureExtractor (ML vector from compiled rules + snapshot)
 *   § 11 — ModeDLInputBuilder (DL tensor from mode rule context)
 *   § 12 — ModeRuleCompilerRollingStats (per-session health analytics)
 *   § 13 — Health grading and module version constants
 *   § 14 — ModeRuleCompilerFacade (single entrypoint wiring all surfaces)
 */

import type {
  CardDefinition,
  CardInstance,
  DeckType,
  HaterBotId,
  IntegrityStatus,
  ModeCode,
  ModeOverlay,
  Targeting,
  TimingClass,
  VisibilityLevel,
} from './GamePrimitives';
import type { RunStateSnapshot } from './RunStateSnapshot';

// ============================================================================
// § 1 — Exported Interfaces
// ============================================================================

export type ModeLabel = 'EMPIRE' | 'PREDATOR' | 'SYNDICATE' | 'PHANTOM';

export interface ModeCompilationOverrides {
  readonly pressureCurveModifier?: number;
  readonly heatCurveModifier?: number;
  readonly holdEnabled?: boolean;
  readonly loadoutEnabled?: boolean;
  readonly sharedTreasury?: boolean;
  readonly sharedOpportunityDeck?: boolean;
  readonly legendMarkersEnabled?: boolean;
  readonly allowAid?: boolean;
  readonly allowDefection?: boolean;
  readonly allowDirectAttacks?: boolean;
  readonly extraDisabledBots?: readonly HaterBotId[];
  readonly spectatorLimit?: number;
  readonly communityHeatModifier?: number;
  readonly gradeBias?: number;
  readonly sharedTreasuryBalance?: number;
  readonly phaseBoundaryWindowsRemaining?: number;
  readonly counterIntelTier?: number;
}

export interface ModeTimingPolicy {
  readonly allowedTimingClasses: readonly TimingClass[];
  readonly priorityTimingClasses: readonly TimingClass[];
  readonly phaseBoundaryWindowsRemaining: number;
  readonly freezeWindowsAllowed: boolean;
  readonly extraDecisionMs: number;
}

export interface ModeEconomyPolicy {
  readonly sharedTreasuryBalance: number;
  readonly sharedTreasury: boolean;
  readonly sharedOpportunityDeck: boolean;
  readonly allowAid: boolean;
  readonly allowDefection: boolean;
  readonly aidTrustBonus: number;
  readonly privilegeEffectMultiplier: number;
  readonly defectionPenalty: number;
}

export interface ModeThreatPolicy {
  readonly counterIntelTier: number;
  readonly threatVisibilityFloor: VisibilityLevel;
  readonly threatVisibilityCeiling: VisibilityLevel;
  readonly disabledBots: readonly HaterBotId[];
  readonly spectatorLimit: number;
  readonly rivalryHeatMultiplier: number;
}

export interface ModeProofPolicy {
  readonly integrityFloor: IntegrityStatus;
  readonly gradeBias: number;
  readonly badgeHints: readonly string[];
  readonly legendGapBias: number;
}

export interface CompiledModeRules {
  readonly mode: ModeCode;
  readonly label: ModeLabel;
  readonly allowedDecks: readonly DeckType[];
  readonly blockedDecks: readonly DeckType[];
  readonly allowedTargetings: readonly Targeting[];
  readonly holdEnabled: boolean;
  readonly loadoutEnabled: boolean;
  readonly sharedTreasury: boolean;
  readonly legendMarkersEnabled: boolean;
  readonly sharedOpportunityDeck: boolean;
  readonly allowAid: boolean;
  readonly allowDefection: boolean;
  readonly allowDirectAttacks: boolean;
  readonly pressureCurveModifier: number;
  readonly heatCurveModifier: number;
  readonly timingPolicy: ModeTimingPolicy;
  readonly economyPolicy: ModeEconomyPolicy;
  readonly threatPolicy: ModeThreatPolicy;
  readonly proofPolicy: ModeProofPolicy;
}

export interface CompiledCardProjection {
  readonly cardId: string;
  readonly deckType: DeckType;
  readonly effectiveCost: number;
  readonly effectMultiplier: number;
  readonly targeting: Targeting;
  readonly allowedTimingClasses: readonly TimingClass[];
  readonly allowedTargetings: readonly Targeting[];
  readonly legalInMode: boolean;
  readonly reasons: readonly string[];
}

export interface ModeCardLegalityResult {
  readonly ok: boolean;
  readonly reasons: readonly string[];
  readonly warnings: readonly string[];
  readonly projection: CompiledCardProjection;
}

/** A scored play recommendation for a single card. */
export interface CardPlayRecommendation {
  readonly cardId: string;
  readonly deckType: DeckType;
  readonly recommendedTimingClass: TimingClass | null;
  readonly recommendedTargeting: Targeting | null;
  readonly priorityScore: number;
  readonly reasons: readonly string[];
  readonly warnings: readonly string[];
  readonly urgency: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'OPTIONAL';
  readonly effectiveCost: number;
  readonly effectMultiplier: number;
}

/** Hand ranking: ordered list of cards to play this tick. */
export interface HandOptimizationResult {
  readonly tick: number;
  readonly mode: ModeCode;
  readonly orderedRecommendations: readonly CardPlayRecommendation[];
  readonly immediatePlayCardIds: readonly string[];
  readonly deferCardIds: readonly string[];
  readonly discardCandidateIds: readonly string[];
  readonly totalHandValue: number;
  readonly estimatedWinContribution: number;
}

/** Defection risk analysis for coop mode. */
export interface DefectionRiskReport {
  readonly mode: ModeCode;
  readonly defectionWindowOpen: boolean;
  readonly riskScore: number;
  readonly riskTier: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'IMMINENT';
  readonly playersAtRisk: readonly string[];
  readonly trustFloor: number;
  readonly avgTrustScore: number;
  readonly activeDefectionCount: number;
  readonly recommendations: readonly string[];
}

/** Phase transition readiness assessment. */
export interface PhaseTransitionReadiness {
  readonly currentPhase: RunStateSnapshot['phase'];
  readonly nextPhase: RunStateSnapshot['phase'] | null;
  readonly readyForTransition: boolean;
  readonly blockers: readonly string[];
  readonly readinessScore: number;
  readonly phaseBoundaryWindowsRemaining: number;
  readonly recommendedActions: readonly string[];
}

/** Pressure curve advisory for the current run state. */
export interface PressureAdvisory {
  readonly tier: RunStateSnapshot['pressure']['tier'];
  readonly pressureCurveModifier: number;
  readonly heatCurveModifier: number;
  readonly recommendedDeckWeights: Readonly<Record<DeckType, number>>;
  readonly timingWindowPriority: readonly TimingClass[];
  readonly costPressureRatio: number;
  readonly recommendedActions: readonly string[];
  readonly urgencyLevel: 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';
}

/** Badge achievement projection for the current run. */
export interface BadgeProjection {
  readonly mode: ModeCode;
  readonly label: ModeLabel;
  readonly achievedBadges: readonly string[];
  readonly inProgressBadges: readonly string[];
  readonly lockedBadges: readonly string[];
  readonly projectedFinalBadges: readonly string[];
  readonly badgeCompletionRatio: number;
}

/** ML feature vector derived from compiled mode rules + snapshot. */
export interface ModeRulesMLVector {
  readonly mode: ModeCode;
  readonly tick: number;
  readonly features: readonly number[];
  readonly labels: readonly string[];
  readonly featureCount: number;
  readonly modelVersion: string;
}

/** DL tensor descriptor from mode rule context. */
export interface ModeRulesDLTensor {
  readonly mode: ModeCode;
  readonly tick: number;
  readonly inputShape: readonly number[];
  readonly inputData: readonly number[];
  readonly contextKey: string;
  readonly modelVersion: string;
}

/** Rolling health stats snapshot. */
export interface ModeCompilerTickStats {
  readonly tick: number;
  readonly compileCount: number;
  readonly legalityCheckCount: number;
  readonly projectionsComputed: number;
  readonly illegalCardCount: number;
  readonly latencyMs: number;
}

/** Health summary for the mode rule compiler. */
export interface ModeCompilerHealthSummary {
  readonly grade: ModeCompilerHealthGrade;
  readonly totalCompiles: number;
  readonly totalLegalityChecks: number;
  readonly illegalCardRatio: number;
  readonly avgLatencyMs: number;
  readonly warningFlags: readonly string[];
}

export type ModeCompilerHealthGrade = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';

// ============================================================================
// § 2 — Internal seeds and constants
// ============================================================================

interface ModeSeed {
  readonly label: ModeLabel;
  readonly allowedDecks: readonly DeckType[];
  readonly defaultBlockedDecks: readonly DeckType[];
  readonly allowedTargetings: readonly Targeting[];
  readonly allowedTimingClasses: readonly TimingClass[];
  readonly priorityTimingClasses: readonly TimingClass[];
  readonly holdEnabled: boolean;
  readonly loadoutEnabled: boolean;
  readonly sharedTreasury: boolean;
  readonly sharedOpportunityDeck: boolean;
  readonly legendMarkersEnabled: boolean;
  readonly allowAid: boolean;
  readonly allowDefection: boolean;
  readonly allowDirectAttacks: boolean;
  readonly defaultSpectatorLimit: number;
  readonly threatVisibilityFloor: VisibilityLevel;
  readonly threatVisibilityCeiling: VisibilityLevel;
  readonly basePressureCurveModifier: number;
  readonly baseHeatCurveModifier: number;
  readonly baseExtraDecisionMs: number;
  readonly baseGradeBias: number;
  readonly baseBadgeHints: readonly string[];
  readonly disabledBots: readonly HaterBotId[];
}

const PRESSURE_TIER_MULTIPLIER: Record<
  RunStateSnapshot['pressure']['tier'],
  number
> = {
  T0: 0.90,
  T1: 1.00,
  T2: 1.12,
  T3: 1.25,
  T4: 1.40,
};

const VISIBILITY_ORDER: Record<VisibilityLevel, number> = {
  HIDDEN: 0,
  SILHOUETTE: 1,
  PARTIAL: 2,
  EXPOSED: 3,
};

const VISIBILITY_BY_ORDER: Record<number, VisibilityLevel> = {
  0: 'HIDDEN',
  1: 'SILHOUETTE',
  2: 'PARTIAL',
  3: 'EXPOSED',
};

/** Deck priority weights by mode — higher = play first in hand optimizer. */
const DECK_PRIORITY_BY_MODE: Record<ModeCode, Partial<Record<DeckType, number>>> = {
  solo: {
    OPPORTUNITY: 0.90,
    DISCIPLINE: 0.85,
    IPA: 0.80,
    SO: 0.75,
    FUBAR: 0.60,
    MISSED_OPPORTUNITY: 0.50,
    PRIVILEGED: 0.70,
    COUNTER: 0.65,
  },
  pvp: {
    SABOTAGE: 0.95,
    COUNTER: 0.90,
    BLUFF: 0.85,
    OPPORTUNITY: 0.70,
    PRIVILEGED: 0.65,
    SO: 0.60,
    DISCIPLINE: 0.55,
    MISSED_OPPORTUNITY: 0.45,
  },
  coop: {
    AID: 0.95,
    RESCUE: 0.90,
    TRUST: 0.85,
    OPPORTUNITY: 0.70,
    COUNTER: 0.65,
    SO: 0.60,
    DISCIPLINE: 0.55,
  },
  ghost: {
    GHOST: 0.95,
    DISCIPLINE: 0.85,
    OPPORTUNITY: 0.75,
    COUNTER: 0.70,
    SO: 0.65,
    MISSED_OPPORTUNITY: 0.55,
  },
};

/** Timing class priority for play ordering — lower index = higher urgency. */
const TIMING_URGENCY_ORDER: readonly TimingClass[] = [
  'CTR', 'GBM', 'PHZ', 'FATE', 'AID', 'RES', 'PSK', 'PRE', 'POST', 'CAS', 'END', 'ANY',
];

/** Phase-specific deck multipliers for scoring. */
const PHASE_DECK_MULTIPLIER: Record<RunStateSnapshot['phase'], Partial<Record<DeckType, number>>> = {
  FOUNDATION: {
    OPPORTUNITY: 1.15,
    IPA: 1.10,
    DISCIPLINE: 1.10,
    TRUST: 1.20,
    AID: 1.15,
    RESCUE: 1.10,
  },
  ESCALATION: {
    SABOTAGE: 1.15,
    COUNTER: 1.20,
    BLUFF: 1.10,
    SO: 1.10,
    GHOST: 1.15,
  },
  SOVEREIGNTY: {
    PRIVILEGED: 1.25,
    GHOST: 1.30,
    DISCIPLINE: 1.20,
    OPPORTUNITY: 1.10,
    SO: 1.15,
    SABOTAGE: 1.20,
  },
};

/** All allowed badge IDs by mode — used for projection. */
const MODE_BADGE_CATALOG: Record<ModeCode, readonly string[]> = {
  solo: [
    'EMPIRE_DISCIPLINE', 'SOLO_EXECUTION', 'PRESSURE_SURVIVOR', 'CHAIN_MASTER',
    'UNBROKEN_SHIELD', 'FOUNDATION_COMPLETE', 'ESCALATION_DOMINANT', 'SOVEREIGNTY_REACHED',
    'UNDER_FIRE', 'CLEAN_RUN', 'MAX_PRESSURE_SURVIVED', 'COUNTER_INTEL_LOCK',
    'ECONOMY_MASTERY', 'OPPORTUNITY_HUNTER', 'ZERO_BREACH',
  ],
  pvp: [
    'PREDATOR_DOMINANCE', 'COUNTERPLAY_READY', 'FIRST_BLOOD', 'SABOTAGE_MASTER',
    'BLUFF_ARTIST', 'RIVALRY_WINNER', 'BOT_NEUTRALIZER', 'HEAT_ESCALATOR',
    'COMBAT_EFFICIENCY', 'EXTRACTION_EXPERT', 'PRESSURE_EXPLOIT',
    'COUNTER_INTEL_LOCK', 'MOMENTUM_STRIKER',
  ],
  coop: [
    'SYNDICATE_SOLIDARITY', 'TRUST_ENGINE', 'AID_CHAMPION', 'RESCUE_MASTER',
    'ZERO_DEFECTION', 'SHARED_VICTORY', 'TREASURY_BUILDER', 'COLLECTIVE_SHIELD',
    'TEAM_PRESSURE_RESIST', 'CHAIN_MASTER', 'SYNDICATE_SOLVENT',
    'UNDER_FIRE', 'COOPERATION_GRADE_A',
  ],
  ghost: [
    'PHANTOM_PARITY', 'LEGEND_PURSUIT', 'GHOST_MASTERY', 'LEGEND_CAUGHT',
    'LEGEND_TRACKING_ACTIVE', 'DIVERGENCE_PEAK', 'PRECISION_STRIKE',
    'PHASE_GHOST', 'PHANTOM_CLEAN', 'COUNTER_INTEL_LOCK',
    'SOVEREIGNTY_REACHED', 'BENCHMARK_MASTER',
  ],
};

/** Trust floor for defection risk tiers. */
const DEFECTION_RISK_THRESHOLDS = Object.freeze({
  NONE: 0.90,
  LOW: 0.70,
  MEDIUM: 0.50,
  HIGH: 0.30,
  IMMINENT: 0,
} as const);

/** Deck cost multiplier overrides per mode — canonical source. */
const DECK_COST_MULTIPLIER_TABLE: Record<ModeCode, Partial<Record<DeckType, number>>> = {
  solo: { OPPORTUNITY: 0.95, DISCIPLINE: 0.90, PRIVILEGED: 1.05 },
  pvp: { SABOTAGE: 0.95, BLUFF: 0.90, COUNTER: 1.05 },
  coop: { AID: 0.85, RESCUE: 0.85, TRUST: 0.85, COUNTER: 0.95 },
  ghost: { GHOST: 0.90, DISCIPLINE: 0.95, MISSED_OPPORTUNITY: 1.10 },
};

/** Deck effect multiplier overrides per mode — canonical source. */
const DECK_EFFECT_MULTIPLIER_TABLE: Record<ModeCode, Partial<Record<DeckType, number>>> = {
  solo: { OPPORTUNITY: 1.10, DISCIPLINE: 1.12 },
  pvp: { SABOTAGE: 1.15, BLUFF: 1.20, COUNTER: 1.08 },
  coop: { AID: 1.20, RESCUE: 1.20, TRUST: 1.20, COUNTER: 1.05 },
  ghost: { GHOST: 1.25, DISCIPLINE: 1.10 },
};

const ML_MODEL_VERSION = '3.1.0' as const;

const MODE_SEEDS: Record<ModeCode, ModeSeed> = {
  solo: {
    label: 'EMPIRE',
    allowedDecks: [
      'OPPORTUNITY', 'IPA', 'FUBAR', 'MISSED_OPPORTUNITY', 'PRIVILEGED', 'SO', 'COUNTER', 'DISCIPLINE',
    ],
    defaultBlockedDecks: ['AID', 'RESCUE', 'TRUST', 'BLUFF', 'GHOST', 'SABOTAGE'],
    allowedTargetings: ['SELF', 'GLOBAL'],
    allowedTimingClasses: ['PRE', 'POST', 'CTR', 'RES', 'PHZ', 'END', 'ANY'],
    priorityTimingClasses: ['PRE', 'RES', 'END'],
    holdEnabled: true,
    loadoutEnabled: true,
    sharedTreasury: false,
    sharedOpportunityDeck: false,
    legendMarkersEnabled: false,
    allowAid: false,
    allowDefection: false,
    allowDirectAttacks: false,
    defaultSpectatorLimit: 0,
    threatVisibilityFloor: 'PARTIAL',
    threatVisibilityCeiling: 'EXPOSED',
    basePressureCurveModifier: 1.00,
    baseHeatCurveModifier: 1.00,
    baseExtraDecisionMs: 1000,
    baseGradeBias: 0.00,
    baseBadgeHints: ['EMPIRE_DISCIPLINE', 'SOLO_EXECUTION'],
    disabledBots: [],
  },
  pvp: {
    label: 'PREDATOR',
    allowedDecks: [
      'OPPORTUNITY', 'PRIVILEGED', 'SABOTAGE', 'COUNTER', 'BLUFF', 'SO', 'DISCIPLINE', 'MISSED_OPPORTUNITY',
    ],
    defaultBlockedDecks: ['AID', 'RESCUE', 'TRUST', 'GHOST'],
    allowedTargetings: ['SELF', 'OPPONENT', 'GLOBAL'],
    allowedTimingClasses: ['PRE', 'POST', 'CTR', 'RES', 'PHZ', 'END', 'ANY'],
    priorityTimingClasses: ['CTR', 'PHZ', 'POST'],
    holdEnabled: false,
    loadoutEnabled: false,
    sharedTreasury: false,
    sharedOpportunityDeck: true,
    legendMarkersEnabled: false,
    allowAid: false,
    allowDefection: false,
    allowDirectAttacks: true,
    defaultSpectatorLimit: 50,
    threatVisibilityFloor: 'SILHOUETTE',
    threatVisibilityCeiling: 'EXPOSED',
    basePressureCurveModifier: 1.12,
    baseHeatCurveModifier: 1.18,
    baseExtraDecisionMs: 250,
    baseGradeBias: 0.03,
    baseBadgeHints: ['PREDATOR_DOMINANCE', 'COUNTERPLAY_READY'],
    disabledBots: [],
  },
  coop: {
    label: 'SYNDICATE',
    allowedDecks: [
      'OPPORTUNITY', 'AID', 'RESCUE', 'TRUST', 'COUNTER', 'SO', 'DISCIPLINE',
    ],
    defaultBlockedDecks: ['BLUFF', 'GHOST'],
    allowedTargetings: ['SELF', 'TEAMMATE', 'TEAM', 'GLOBAL'],
    allowedTimingClasses: ['PRE', 'POST', 'AID', 'RES', 'PHZ', 'END', 'ANY'],
    priorityTimingClasses: ['AID', 'RES', 'PHZ'],
    holdEnabled: false,
    loadoutEnabled: false,
    sharedTreasury: true,
    sharedOpportunityDeck: false,
    legendMarkersEnabled: false,
    allowAid: true,
    allowDefection: true,
    allowDirectAttacks: false,
    defaultSpectatorLimit: 10,
    threatVisibilityFloor: 'PARTIAL',
    threatVisibilityCeiling: 'EXPOSED',
    basePressureCurveModifier: 0.95,
    baseHeatCurveModifier: 1.05,
    baseExtraDecisionMs: 1250,
    baseGradeBias: 0.05,
    baseBadgeHints: ['SYNDICATE_SOLIDARITY', 'TRUST_ENGINE'],
    disabledBots: [],
  },
  ghost: {
    label: 'PHANTOM',
    allowedDecks: [
      'OPPORTUNITY', 'GHOST', 'COUNTER', 'SO', 'DISCIPLINE', 'MISSED_OPPORTUNITY',
    ],
    defaultBlockedDecks: ['AID', 'RESCUE', 'TRUST', 'BLUFF', 'SABOTAGE'],
    allowedTargetings: ['SELF', 'GLOBAL'],
    allowedTimingClasses: ['PRE', 'POST', 'GBM', 'RES', 'PHZ', 'END', 'ANY'],
    priorityTimingClasses: ['GBM', 'PHZ', 'END'],
    holdEnabled: false,
    loadoutEnabled: false,
    sharedTreasury: false,
    sharedOpportunityDeck: false,
    legendMarkersEnabled: true,
    allowAid: false,
    allowDefection: false,
    allowDirectAttacks: false,
    defaultSpectatorLimit: 0,
    threatVisibilityFloor: 'PARTIAL',
    threatVisibilityCeiling: 'EXPOSED',
    basePressureCurveModifier: 1.08,
    baseHeatCurveModifier: 1.10,
    baseExtraDecisionMs: 500,
    baseGradeBias: 0.04,
    baseBadgeHints: ['PHANTOM_PARITY', 'LEGEND_PURSUIT'],
    disabledBots: [],
  },
};

// ============================================================================
// § 3 — ModeRuleCompiler
// ============================================================================

/**
 * Canonical backend authority for mode rule compilation.
 *
 * Produces immutable `CompiledModeRules` from mode seeds + overrides.
 * The compiled rules govern:
 * - Card deck legality
 * - Allowed targeting surfaces
 * - Timing windows and phase boundary availability
 * - Economy policy (shared treasury, aid, defection)
 * - Threat visibility and counter-intel tier
 * - Proof integrity floor and badge seeding
 */
export class ModeRuleCompiler {
  public compile(
    mode: ModeCode,
    overrides: ModeCompilationOverrides = {},
  ): CompiledModeRules {
    const seed = MODE_SEEDS[mode];
    const disabledBots = this.unique(seed.disabledBots, overrides.extraDisabledBots ?? []);
    const blockedDecks = this.unique(
      seed.defaultBlockedDecks,
      this.computeDerivedBlockedDecks(mode),
    );
    const counterIntelTier = Math.max(1, overrides.counterIntelTier ?? 1);
    const communityHeatModifier = overrides.communityHeatModifier ?? 0;

    return {
      mode,
      label: seed.label,
      allowedDecks: [...seed.allowedDecks],
      blockedDecks,
      allowedTargetings: [...seed.allowedTargetings],
      holdEnabled: overrides.holdEnabled ?? seed.holdEnabled,
      loadoutEnabled: overrides.loadoutEnabled ?? seed.loadoutEnabled,
      sharedTreasury: overrides.sharedTreasury ?? seed.sharedTreasury,
      legendMarkersEnabled: overrides.legendMarkersEnabled ?? seed.legendMarkersEnabled,
      sharedOpportunityDeck: overrides.sharedOpportunityDeck ?? seed.sharedOpportunityDeck,
      allowAid: overrides.allowAid ?? seed.allowAid,
      allowDefection: overrides.allowDefection ?? seed.allowDefection,
      allowDirectAttacks: overrides.allowDirectAttacks ?? seed.allowDirectAttacks,
      pressureCurveModifier: this.round(
        seed.basePressureCurveModifier * (overrides.pressureCurveModifier ?? 1),
      ),
      heatCurveModifier: this.round(
        seed.baseHeatCurveModifier *
          (overrides.heatCurveModifier ?? 1) *
          (1 + communityHeatModifier / 100),
      ),
      timingPolicy: {
        allowedTimingClasses: [...seed.allowedTimingClasses],
        priorityTimingClasses: [...seed.priorityTimingClasses],
        phaseBoundaryWindowsRemaining: overrides.phaseBoundaryWindowsRemaining ?? 0,
        freezeWindowsAllowed: (overrides.holdEnabled ?? seed.holdEnabled) || mode === 'ghost',
        extraDecisionMs: seed.baseExtraDecisionMs,
      },
      economyPolicy: {
        sharedTreasuryBalance: overrides.sharedTreasuryBalance ?? 0,
        sharedTreasury: overrides.sharedTreasury ?? seed.sharedTreasury,
        sharedOpportunityDeck: overrides.sharedOpportunityDeck ?? seed.sharedOpportunityDeck,
        allowAid: overrides.allowAid ?? seed.allowAid,
        allowDefection: overrides.allowDefection ?? seed.allowDefection,
        aidTrustBonus: mode === 'coop' ? 0.20 : 0.00,
        privilegeEffectMultiplier: mode === 'pvp' ? 1.10 : mode === 'solo' ? 1.05 : 1.00,
        defectionPenalty: mode === 'coop' ? 0.30 : 0.00,
      },
      threatPolicy: {
        counterIntelTier,
        threatVisibilityFloor: seed.threatVisibilityFloor,
        threatVisibilityCeiling: seed.threatVisibilityCeiling,
        disabledBots,
        spectatorLimit: overrides.spectatorLimit ?? seed.defaultSpectatorLimit,
        rivalryHeatMultiplier: mode === 'pvp' ? 1.25 : 0.50,
      },
      proofPolicy: {
        integrityFloor: 'UNVERIFIED',
        gradeBias: this.round(seed.baseGradeBias + (overrides.gradeBias ?? 0)),
        badgeHints: [...seed.baseBadgeHints],
        legendGapBias: mode === 'ghost' ? 1.00 : 0.00,
      },
    };
  }

  public compileSnapshot(
    snapshot: RunStateSnapshot,
    overrides: ModeCompilationOverrides = {},
  ): CompiledModeRules {
    const tierScalar = PRESSURE_TIER_MULTIPLIER[snapshot.pressure.tier];

    const compiled = this.compile(snapshot.mode, {
      ...overrides,
      pressureCurveModifier: (overrides.pressureCurveModifier ?? 1) * tierScalar,
      heatCurveModifier:
        (overrides.heatCurveModifier ?? 1) *
        tierScalar *
        (1 + snapshot.modeState.communityHeatModifier / 100),
      holdEnabled: overrides.holdEnabled ?? snapshot.modeState.holdEnabled,
      loadoutEnabled: overrides.loadoutEnabled ?? snapshot.modeState.loadoutEnabled,
      sharedTreasury: overrides.sharedTreasury ?? snapshot.modeState.sharedTreasury,
      sharedOpportunityDeck:
        overrides.sharedOpportunityDeck ?? snapshot.modeState.sharedOpportunityDeck,
      legendMarkersEnabled:
        overrides.legendMarkersEnabled ?? snapshot.modeState.legendMarkersEnabled,
      communityHeatModifier:
        overrides.communityHeatModifier ?? snapshot.modeState.communityHeatModifier,
      sharedTreasuryBalance:
        overrides.sharedTreasuryBalance ?? snapshot.modeState.sharedTreasuryBalance,
      phaseBoundaryWindowsRemaining:
        overrides.phaseBoundaryWindowsRemaining ??
        snapshot.modeState.phaseBoundaryWindowsRemaining,
      counterIntelTier:
        overrides.counterIntelTier ?? snapshot.modeState.counterIntelTier,
      spectatorLimit: overrides.spectatorLimit ?? snapshot.modeState.spectatorLimit,
      extraDisabledBots: this.unique(
        snapshot.modeState.disabledBots as readonly HaterBotId[],
        overrides.extraDisabledBots ?? [],
      ),
    });

    const dynamicBlockedDecks: DeckType[] = [];

    if (!compiled.allowAid) {
      dynamicBlockedDecks.push('AID', 'RESCUE', 'TRUST');
    }

    if (!compiled.legendMarkersEnabled) {
      dynamicBlockedDecks.push('GHOST');
    }

    if (!compiled.allowDirectAttacks) {
      dynamicBlockedDecks.push('SABOTAGE', 'BLUFF');
    }

    const allowDefection =
      compiled.allowDefection && this.detectDefectionWindow(snapshot);

    const threatVisibilityFloor =
      snapshot.modeState.counterIntelTier >= 3
        ? this.raiseVisibility(compiled.threatPolicy.threatVisibilityFloor, 1)
        : compiled.threatPolicy.threatVisibilityFloor;

    const runtimeBadgeHints = this.unique(
      compiled.proofPolicy.badgeHints,
      this.computeRuntimeBadgeHints(snapshot),
    );

    return {
      ...compiled,
      blockedDecks: this.unique(compiled.blockedDecks, dynamicBlockedDecks),
      allowDefection,
      timingPolicy: {
        ...compiled.timingPolicy,
        phaseBoundaryWindowsRemaining: snapshot.modeState.phaseBoundaryWindowsRemaining,
      },
      economyPolicy: {
        ...compiled.economyPolicy,
        sharedTreasuryBalance: snapshot.modeState.sharedTreasuryBalance,
        allowDefection,
      },
      threatPolicy: {
        ...compiled.threatPolicy,
        counterIntelTier: snapshot.modeState.counterIntelTier,
        threatVisibilityFloor,
        disabledBots: this.unique(
          compiled.threatPolicy.disabledBots,
          snapshot.modeState.disabledBots as readonly HaterBotId[],
        ),
        spectatorLimit: snapshot.modeState.spectatorLimit,
      },
      proofPolicy: {
        ...compiled.proofPolicy,
        badgeHints: runtimeBadgeHints,
        legendGapBias: snapshot.modeState.legendMarkersEnabled
          ? this.round(
              Math.max(
                1,
                snapshot.cards.ghostMarkers.length > 0
                  ? snapshot.cards.ghostMarkers.length * 0.10
                  : snapshot.sovereignty.gapVsLegend || 1,
              ),
            )
          : 0,
      },
    };
  }

  public isCardLegal(
    card: CardDefinition | CardInstance,
    rules: CompiledModeRules,
    options: {
      readonly timing?: TimingClass;
      readonly targeting?: Targeting;
    } = {},
  ): ModeCardLegalityResult {
    const projection = this.projectCard(card, rules);
    const reasons: string[] = [...projection.reasons];
    const warnings: string[] = [];

    if (!projection.legalInMode) {
      reasons.push('Card is not legal in the compiled mode rules.');
    }

    if (options.timing !== undefined) {
      if (!projection.allowedTimingClasses.includes(options.timing)) {
        reasons.push(`Timing ${options.timing} is not legal for this card in mode.`);
      } else if (!rules.timingPolicy.priorityTimingClasses.includes(options.timing)) {
        warnings.push(`Timing ${options.timing} is legal but not priority-optimized.`);
      }
    }

    if (options.targeting !== undefined) {
      if (!projection.allowedTargetings.includes(options.targeting)) {
        reasons.push(`Targeting ${options.targeting} is not legal for this card in mode.`);
      }
    }

    return { ok: reasons.length === 0, reasons, warnings, projection };
  }

  public projectCard(
    card: CardDefinition | CardInstance,
    rules: CompiledModeRules,
  ): CompiledCardProjection {
    const definition = this.toDefinition(card);
    const overlay = this.resolveOverlay(definition, rules.mode);
    const baseCost = 'cost' in card ? card.cost : definition.baseCost;
    const baseTargeting = overlay?.targetingOverride ?? definition.targeting;

    const deckMultiplier = this.deckCostMultiplier(rules.mode, definition.deckType);
    const effectMultiplier =
      this.deckEffectMultiplier(rules.mode, definition.deckType) *
      (overlay?.effectModifier ?? 1);

    const effectiveCost = this.round3(
      Math.max(0, baseCost * deckMultiplier * (overlay?.costModifier ?? 1)),
    );

    const legalTimingSurface =
      overlay?.timingLock !== undefined && overlay.timingLock.length > 0
        ? definition.timingClass.filter((timing) => overlay.timingLock!.includes(timing))
        : definition.timingClass;

    const allowedTimingClasses = legalTimingSurface.filter((timing) =>
      rules.timingPolicy.allowedTimingClasses.includes(timing),
    );

    const allowedTargetings = rules.allowedTargetings.filter((targeting) =>
      this.isTargetAllowedByCard(baseTargeting, targeting),
    );

    const reasons: string[] = [];

    if (!definition.modeLegal.includes(rules.mode)) {
      reasons.push(`Card definition does not list mode=${rules.mode} as legal.`);
    }

    if (rules.blockedDecks.includes(definition.deckType)) {
      reasons.push(`Deck type ${definition.deckType} is blocked for mode=${rules.mode}.`);
    }

    if (overlay?.legal === false) {
      reasons.push(`Mode overlay marks card illegal for mode=${rules.mode}.`);
    }

    if (allowedTimingClasses.length === 0) {
      reasons.push('No timing classes survive mode compilation.');
    }

    if (allowedTargetings.length === 0) {
      reasons.push('No legal targets survive mode compilation.');
    }

    return {
      cardId: definition.id,
      deckType: definition.deckType,
      effectiveCost,
      effectMultiplier: this.round3(effectMultiplier),
      targeting: baseTargeting,
      allowedTimingClasses,
      allowedTargetings,
      legalInMode: reasons.length === 0,
      reasons,
    };
  }

  public computeTagWeights(
    definition: CardDefinition,
    rules: CompiledModeRules,
    overlay?: Partial<ModeOverlay> | null,
  ): Record<string, number> {
    const MODE_TAG_WEIGHTS: Record<ModeCode, Record<string, number>> = {
      solo: { liquidity: 2.0, income: 2.2, resilience: 1.8, scale: 2.5, tempo: 1.0, cascade: 1.8, momentum: 2.0 },
      pvp: { tempo: 2.4, sabotage: 2.8, counter: 2.2, heat: 1.5, cascade: 1.2, momentum: 1.5 },
      coop: { trust: 3.0, aid: 2.5, resilience: 2.0, income: 1.8, cascade: 1.6 },
      ghost: { precision: 2.6, divergence: 3.0, tempo: 1.8, cascade: 1.5 },
    };
    const base = { ...MODE_TAG_WEIGHTS[rules.mode] };
    for (const tag of definition.tags) {
      if (base[tag] === undefined) base[tag] = 1;
    }
    if (overlay?.tagWeights) {
      for (const [tag, weight] of Object.entries(overlay.tagWeights)) {
        base[tag] = weight;
      }
    }
    return base;
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private detectDefectionWindow(snapshot: RunStateSnapshot): boolean {
    if (snapshot.mode !== 'coop') return false;
    const trustScores = Object.values(snapshot.modeState.trustScores)
      .filter((value): value is number => typeof value === 'number');
    const activeDefection = Object.values(snapshot.modeState.defectionStepByPlayer)
      .some((value) => typeof value === 'number' && value > 0);
    return activeDefection || trustScores.some((score) => score < 0.35);
  }

  private computeDerivedBlockedDecks(mode: ModeCode): DeckType[] {
    switch (mode) {
      case 'solo': return [];
      case 'pvp': return [];
      case 'coop': return ['PRIVILEGED'];
      case 'ghost': return ['PRIVILEGED', 'AID', 'RESCUE', 'TRUST'];
      default: return [];
    }
  }

  private computeRuntimeBadgeHints(snapshot: RunStateSnapshot): string[] {
    const hints: string[] = [];
    if (snapshot.modeState.sharedTreasury && snapshot.modeState.sharedTreasuryBalance > 0) {
      hints.push('SHARED_TREASURY_ACTIVE');
    }
    if (snapshot.modeState.legendMarkersEnabled && snapshot.cards.ghostMarkers.length > 0) {
      hints.push('LEGEND_MARKERS_ACTIVE');
    }
    if (snapshot.modeState.counterIntelTier >= 4) hints.push('COUNTER_INTEL_TIER_4');
    if (snapshot.modeState.bleedMode) hints.push('BLEED_MODE_ENABLED');
    if (snapshot.pressure.tier === 'T4') hints.push('MAX_PRESSURE');
    return hints;
  }

  private resolveOverlay(
    definition: CardDefinition,
    mode: ModeCode,
  ): Partial<ModeOverlay> | undefined {
    return definition.modeOverlay?.[mode];
  }

  private toDefinition(card: CardDefinition | CardInstance): CardDefinition {
    return 'card' in card ? card.card : card;
  }

  public deckCostMultiplier(mode: ModeCode, deckType: DeckType): number {
    return DECK_COST_MULTIPLIER_TABLE[mode][deckType] ?? 1.00;
  }

  public deckEffectMultiplier(mode: ModeCode, deckType: DeckType): number {
    return DECK_EFFECT_MULTIPLIER_TABLE[mode][deckType] ?? 1.00;
  }

  private isTargetAllowedByCard(
    cardTargeting: Targeting,
    requestedTargeting: Targeting,
  ): boolean {
    if (cardTargeting === requestedTargeting) return true;
    if (cardTargeting === 'GLOBAL') return requestedTargeting === 'GLOBAL';
    if (cardTargeting === 'TEAM') return requestedTargeting === 'TEAM' || requestedTargeting === 'TEAMMATE';
    return false;
  }

  private raiseVisibility(value: VisibilityLevel, levels: number): VisibilityLevel {
    const next = Math.min(3, VISIBILITY_ORDER[value] + levels);
    return VISIBILITY_BY_ORDER[next];
  }

  private unique<T>(...groups: ReadonlyArray<readonly T[]>): T[] {
    const set = new Set<T>();
    for (const group of groups) for (const item of group) set.add(item);
    return [...set];
  }

  private round(value: number): number { return Number(value.toFixed(6)); }
  private round3(value: number): number { return Number(value.toFixed(3)); }
}

// ============================================================================
// § 4 — ModePlayRecommendation
// ============================================================================

/**
 * Produces a scored play recommendation for a card given compiled mode rules
 * and live snapshot context.
 */
export class ModePlayRecommendationEngine {
  private readonly compiler: ModeRuleCompiler;

  public constructor(compiler?: ModeRuleCompiler) {
    this.compiler = compiler ?? new ModeRuleCompiler();
  }

  /** Score a single card for priority of play this tick. */
  public scoreCard(
    card: CardDefinition | CardInstance,
    rules: CompiledModeRules,
    snapshot: RunStateSnapshot,
  ): CardPlayRecommendation {
    const definition = 'card' in card ? card.card : card;
    const result = this.compiler.isCardLegal(card, rules);
    const projection = result.projection;

    if (!result.ok) {
      return {
        cardId: definition.id,
        deckType: definition.deckType,
        recommendedTimingClass: null,
        recommendedTargeting: null,
        priorityScore: 0,
        reasons: result.reasons,
        warnings: result.warnings,
        urgency: 'OPTIONAL',
        effectiveCost: projection.effectiveCost,
        effectMultiplier: projection.effectMultiplier,
      };
    }

    const basePriority = DECK_PRIORITY_BY_MODE[rules.mode][definition.deckType] ?? 0.5;
    const phaseMultiplier = PHASE_DECK_MULTIPLIER[snapshot.phase][definition.deckType] ?? 1.0;
    const pressureTier = ['T0', 'T1', 'T2', 'T3', 'T4'].indexOf(snapshot.pressure.tier) / 4;

    // Economy pressure bonus: if cost is feasible relative to cash, boost play value
    const cashAvailable = snapshot.economy.cash;
    const affordabilityRatio = projection.effectiveCost <= 0 ? 1 :
      Math.min(1, cashAvailable / Math.max(1, projection.effectiveCost * 3));

    // Shield pressure: reward defensive cards when shields are low
    const totalShield = snapshot.shield.layers.reduce((s, l) => s + l.current, 0);
    const totalShieldMax = snapshot.shield.layers.reduce((s, l) => s + l.max, 0);
    const shieldPct = totalShieldMax <= 0 ? 1 : totalShield / totalShieldMax;
    const shieldBonus =
      (definition.tags.includes('resilience') || definition.tags.includes('shield'))
        ? (1 - shieldPct) * 0.2
        : 0;

    // Cascade bonus: if active chains exist, cascade-tagged cards are premium
    const cascadeBonus =
      definition.tags.includes('cascade') && snapshot.cascade.activeChains.length > 0
        ? 0.15
        : 0;

    // Bleed mode: force time-sensitive cards higher
    const bleedBonus = snapshot.modeState.bleedMode ? pressureTier * 0.1 : 0;

    // Timing urgency: CTR/GBM/AID/RES window slots have time-based priority
    const recommendedTiming = this.pickBestTiming(projection.allowedTimingClasses, rules, snapshot);
    const timingUrgencyBonus = recommendedTiming
      ? Math.max(0, 1 - TIMING_URGENCY_ORDER.indexOf(recommendedTiming) / TIMING_URGENCY_ORDER.length) * 0.15
      : 0;

    // Tag weights from the mode
    const tagWeights = this.compiler.computeTagWeights(definition, rules);
    const tagScore = definition.tags.reduce((sum, tag) => {
      return sum + (tagWeights[tag] ?? 1.0) / 3.0;
    }, 0) / Math.max(1, definition.tags.length);

    const raw =
      basePriority * 0.30 +
      phaseMultiplier * 0.15 +
      affordabilityRatio * 0.15 +
      shieldBonus * 0.10 +
      cascadeBonus * 0.10 +
      bleedBonus * 0.05 +
      timingUrgencyBonus * 0.10 +
      tagScore * 0.05;

    const priorityScore = Math.max(0, Math.min(1, raw));

    const urgency: CardPlayRecommendation['urgency'] =
      priorityScore >= 0.85 ? 'CRITICAL'
      : priorityScore >= 0.70 ? 'HIGH'
      : priorityScore >= 0.50 ? 'MEDIUM'
      : priorityScore >= 0.30 ? 'LOW'
      : 'OPTIONAL';

    const recommendedTargeting = projection.allowedTargetings[0] ?? null;

    const reasons: string[] = [];
    const warnings: string[] = [...result.warnings];

    if (urgency === 'CRITICAL') reasons.push('Critical play window — highest priority this tick.');
    if (bleedBonus > 0) reasons.push('Bleed mode active — time-sensitive card.');
    if (cascadeBonus > 0) reasons.push('Active cascade chains detected — cascade tags amplify value.');
    if (shieldBonus > 0.05) reasons.push('Shield degraded — defensive cards prioritized.');
    if (!rules.timingPolicy.priorityTimingClasses.includes(recommendedTiming ?? 'ANY')) {
      warnings.push(`Timing ${recommendedTiming} is not a priority timing for this mode.`);
    }

    return {
      cardId: definition.id,
      deckType: definition.deckType,
      recommendedTimingClass: recommendedTiming,
      recommendedTargeting,
      priorityScore: Number(priorityScore.toFixed(4)),
      reasons,
      warnings,
      urgency,
      effectiveCost: projection.effectiveCost,
      effectMultiplier: projection.effectMultiplier,
    };
  }

  private pickBestTiming(
    allowed: readonly TimingClass[],
    rules: CompiledModeRules,
    _snapshot: RunStateSnapshot,
  ): TimingClass | null {
    // Priority: rule priority classes → urgency order
    for (const t of rules.timingPolicy.priorityTimingClasses) {
      if (allowed.includes(t)) return t;
    }
    for (const t of TIMING_URGENCY_ORDER) {
      if (allowed.includes(t)) return t;
    }
    return allowed[0] ?? null;
  }
}

// ============================================================================
// § 5 — ModeDefectionAnalyzer
// ============================================================================

/**
 * Analyzes defection risk and trust dynamics in coop mode.
 * Feeds into ProofSealer badge derivation and chat signal routing.
 */
export class ModeDefectionAnalyzer {
  public analyze(snapshot: RunStateSnapshot): DefectionRiskReport {
    if (snapshot.mode !== 'coop') {
      return {
        mode: snapshot.mode,
        defectionWindowOpen: false,
        riskScore: 0,
        riskTier: 'NONE',
        playersAtRisk: [],
        trustFloor: 1,
        avgTrustScore: 1,
        activeDefectionCount: 0,
        recommendations: [],
      };
    }

    const trustScores = Object.entries(snapshot.modeState.trustScores)
      .filter(([, v]) => typeof v === 'number') as [string, number][];

    const defectionSteps = Object.entries(snapshot.modeState.defectionStepByPlayer)
      .filter(([, v]) => typeof v === 'number' && v > 0) as [string, number][];

    const avgTrust =
      trustScores.length > 0
        ? trustScores.reduce((s, [, v]) => s + v, 0) / trustScores.length / 100
        : 1;

    const trustFloor =
      trustScores.length > 0
        ? Math.min(...trustScores.map(([, v]) => v)) / 100
        : 1;

    const playersAtRisk = trustScores
      .filter(([, v]) => v / 100 < DEFECTION_RISK_THRESHOLDS.MEDIUM)
      .map(([k]) => k);

    const activeDefectionCount = defectionSteps.length;
    const defectionWindowOpen = activeDefectionCount > 0 || trustFloor < 0.35;

    // Risk score: blend of average trust deficit and active defection pressure
    const trustDeficit = Math.max(0, 1 - avgTrust);
    const defectionPressure = Math.min(1, activeDefectionCount / Math.max(1, trustScores.length));
    const riskScore = Number(Math.min(1, trustDeficit * 0.6 + defectionPressure * 0.4).toFixed(4));

    const riskTier: DefectionRiskReport['riskTier'] =
      riskScore >= 0.80 ? 'IMMINENT'
      : riskScore >= 0.60 ? 'HIGH'
      : riskScore >= 0.40 ? 'MEDIUM'
      : riskScore >= 0.20 ? 'LOW'
      : 'NONE';

    const recommendations: string[] = [];
    if (riskTier === 'IMMINENT' || riskTier === 'HIGH') {
      recommendations.push('Play TRUST or AID cards immediately to shore up trust scores.');
      recommendations.push('Avoid FUBAR or MISSED_OPPORTUNITY draws — they amplify heat.');
    }
    if (riskTier === 'MEDIUM') {
      recommendations.push('Monitor trust scores — prioritize TRUST/AID deck plays.');
    }
    if (playersAtRisk.length > 0) {
      recommendations.push(`Players below trust threshold: ${playersAtRisk.join(', ')}`);
    }
    if (activeDefectionCount > 0) {
      recommendations.push(`${activeDefectionCount} active defection event(s) in progress.`);
    }

    return {
      mode: snapshot.mode,
      defectionWindowOpen,
      riskScore,
      riskTier,
      playersAtRisk,
      trustFloor: Number(trustFloor.toFixed(4)),
      avgTrustScore: Number(avgTrust.toFixed(4)),
      activeDefectionCount,
      recommendations,
    };
  }

  /** Build the trust trajectory from a sequence of trust score histories. */
  public buildTrustTrajectory(
    current: Readonly<Record<string, number>>,
    previous: Readonly<Record<string, number>>,
  ): Readonly<Record<string, { current: number; previous: number; delta: number; improving: boolean }>> {
    const result: Record<string, { current: number; previous: number; delta: number; improving: boolean }> = {};
    for (const [playerId, currentScore] of Object.entries(current)) {
      const previousScore = previous[playerId] ?? currentScore;
      const delta = currentScore - previousScore;
      result[playerId] = {
        current: currentScore,
        previous: previousScore,
        delta: Number(delta.toFixed(4)),
        improving: delta > 0,
      };
    }
    return Object.freeze(result);
  }
}

// ============================================================================
// § 6 — ModeBadgeAdvisor
// ============================================================================

/**
 * Projects which badges are achievable, in progress, or locked for the current run.
 */
export class ModeBadgeAdvisor {
  public project(snapshot: RunStateSnapshot, rules: CompiledModeRules): BadgeProjection {
    const catalog = MODE_BADGE_CATALOG[snapshot.mode];
    const achieved = new Set(snapshot.sovereignty.proofBadges);
    const hints = new Set(rules.proofPolicy.badgeHints);

    const achievedBadges: string[] = [];
    const inProgressBadges: string[] = [];
    const lockedBadges: string[] = [];

    for (const badge of catalog) {
      if (achieved.has(badge)) {
        achievedBadges.push(badge);
      } else if (hints.has(badge) || this.isBadgeInProgress(badge, snapshot)) {
        inProgressBadges.push(badge);
      } else {
        lockedBadges.push(badge);
      }
    }

    // Add dynamic badges from proof sealer that are not in catalog
    for (const badge of snapshot.sovereignty.proofBadges) {
      if (!catalog.includes(badge) && !achievedBadges.includes(badge)) {
        achievedBadges.push(badge);
      }
    }

    const projectedFinal = [...achievedBadges, ...inProgressBadges];
    const completionRatio = catalog.length > 0
      ? achievedBadges.length / catalog.length
      : 0;

    return {
      mode: snapshot.mode,
      label: rules.label,
      achievedBadges,
      inProgressBadges,
      lockedBadges,
      projectedFinalBadges: projectedFinal,
      badgeCompletionRatio: Number(completionRatio.toFixed(4)),
    };
  }

  private isBadgeInProgress(badge: string, snapshot: RunStateSnapshot): boolean {
    if (badge === 'UNBROKEN_SHIELD' && snapshot.shield.breachesThisRun === 0) return true;
    if (badge === 'CHAIN_MASTER' && snapshot.cascade.completedChains > 0) return true;
    if (badge === 'UNDER_FIRE' && snapshot.pressure.survivedHighPressureTicks > 5) return true;
    if (badge === 'SYNDICATE_SOLVENT' && snapshot.modeState.sharedTreasuryBalance > 0) return true;
    if (badge === 'LEGEND_TRACKING_ACTIVE' && snapshot.modeState.legendMarkersEnabled) return true;
    if (badge === 'COUNTER_INTEL_LOCK' && snapshot.modeState.counterIntelTier >= 3) return true;
    if (badge === 'ZERO_DEFECTION' && snapshot.mode === 'coop' &&
        Object.values(snapshot.modeState.defectionStepByPlayer).every((v) => v === 0)) return true;
    if (badge === 'FIRST_BLOOD' && snapshot.battle.firstBloodClaimed) return true;
    if (badge === 'ECONOMY_MASTERY' && snapshot.economy.netWorth > snapshot.economy.freedomTarget * 0.5) return true;
    return false;
  }
}

// ============================================================================
// § 7 — ModePhaseBoundaryDetector
// ============================================================================

const PHASE_TRANSITION_THRESHOLDS: Record<RunStateSnapshot['phase'], {
  economyRatioMin: number;
  shieldIntegrityMin: number;
  tickMin: number;
}> = {
  FOUNDATION: {
    economyRatioMin: 0.20,
    shieldIntegrityMin: 0.60,
    tickMin: 10,
  },
  ESCALATION: {
    economyRatioMin: 0.50,
    shieldIntegrityMin: 0.40,
    tickMin: 30,
  },
  SOVEREIGNTY: {
    economyRatioMin: 0.90,
    shieldIntegrityMin: 0.20,
    tickMin: 60,
  },
};

/**
 * Determines readiness for phase transitions (FOUNDATION → ESCALATION → SOVEREIGNTY).
 */
export class ModePhaseBoundaryDetector {
  public assess(snapshot: RunStateSnapshot, rules: CompiledModeRules): PhaseTransitionReadiness {
    const nextPhase = this.getNextPhase(snapshot.phase);
    const blockers: string[] = [];
    const recommendations: string[] = [];

    if (!nextPhase) {
      return {
        currentPhase: snapshot.phase,
        nextPhase: null,
        readyForTransition: false,
        blockers: ['Run is already in final phase (SOVEREIGNTY).'],
        readinessScore: 0,
        phaseBoundaryWindowsRemaining: rules.timingPolicy.phaseBoundaryWindowsRemaining,
        recommendedActions: [],
      };
    }

    const thresholds = PHASE_TRANSITION_THRESHOLDS[snapshot.phase];
    const economyRatio = Math.max(0, snapshot.economy.netWorth / Math.max(1, snapshot.economy.freedomTarget));
    const totalShield = snapshot.shield.layers.reduce((s, l) => s + l.current, 0);
    const totalShieldMax = snapshot.shield.layers.reduce((s, l) => s + l.max, 0);
    const shieldIntegrity = totalShieldMax <= 0 ? 1 : totalShield / totalShieldMax;

    let readinessScore = 1.0;

    if (economyRatio < thresholds.economyRatioMin) {
      blockers.push(`Economy progress (${(economyRatio * 100).toFixed(1)}%) below minimum (${thresholds.economyRatioMin * 100}%) for phase transition.`);
      readinessScore -= 0.30;
      recommendations.push('Increase net worth — play OPPORTUNITY and INCOME decks.');
    }

    if (shieldIntegrity < thresholds.shieldIntegrityMin) {
      blockers.push(`Shield integrity (${(shieldIntegrity * 100).toFixed(1)}%) below minimum (${thresholds.shieldIntegrityMin * 100}%) for phase transition.`);
      readinessScore -= 0.25;
      recommendations.push('Restore shield integrity before advancing phase.');
    }

    if (snapshot.tick < thresholds.tickMin) {
      blockers.push(`Minimum tick count (${thresholds.tickMin}) not reached — current tick ${snapshot.tick}.`);
      readinessScore -= 0.15;
    }

    if (rules.timingPolicy.phaseBoundaryWindowsRemaining <= 0) {
      blockers.push('No phase boundary window slots remaining.');
      readinessScore -= 0.30;
      recommendations.push('A PHZ timing card is required to open a new boundary window.');
    }

    if (snapshot.cascade.brokenChains > snapshot.cascade.completedChains) {
      blockers.push('More broken cascade chains than completed — resolve cascades before transitioning.');
      readinessScore -= 0.10;
    }

    const readyForTransition = blockers.length === 0;
    readinessScore = Math.max(0, Math.min(1, readinessScore));

    return {
      currentPhase: snapshot.phase,
      nextPhase,
      readyForTransition,
      blockers,
      readinessScore: Number(readinessScore.toFixed(4)),
      phaseBoundaryWindowsRemaining: rules.timingPolicy.phaseBoundaryWindowsRemaining,
      recommendedActions: recommendations,
    };
  }

  private getNextPhase(
    phase: RunStateSnapshot['phase'],
  ): RunStateSnapshot['phase'] | null {
    switch (phase) {
      case 'FOUNDATION': return 'ESCALATION';
      case 'ESCALATION': return 'SOVEREIGNTY';
      case 'SOVEREIGNTY': return null;
      default: return null;
    }
  }
}

// ============================================================================
// § 8 — ModeHandOptimizer
// ============================================================================

/**
 * Ranks all cards in the player's hand against compiled rules and snapshot context.
 * Produces a `HandOptimizationResult` consumed by chat adapters and decision windows.
 */
export class ModeHandOptimizer {
  private readonly recommendationEngine: ModePlayRecommendationEngine;

  public constructor(recommendationEngine?: ModePlayRecommendationEngine) {
    this.recommendationEngine = recommendationEngine ?? new ModePlayRecommendationEngine();
  }

  public optimize(
    hand: readonly (CardDefinition | CardInstance)[],
    rules: CompiledModeRules,
    snapshot: RunStateSnapshot,
  ): HandOptimizationResult {
    const recommendations: CardPlayRecommendation[] = hand.map((card) =>
      this.recommendationEngine.scoreCard(card, rules, snapshot),
    );

    recommendations.sort((a, b) => b.priorityScore - a.priorityScore);

    const immediatePlayCardIds = recommendations
      .filter((r) => r.urgency === 'CRITICAL' || r.urgency === 'HIGH')
      .map((r) => r.cardId);

    const deferCardIds = recommendations
      .filter((r) => r.urgency === 'LOW' || r.urgency === 'OPTIONAL')
      .map((r) => r.cardId);

    // Identify discard candidates: illegal cards or cards with zero priority
    const discardCandidateIds = recommendations
      .filter((r) => r.priorityScore <= 0 || r.recommendedTimingClass === null)
      .map((r) => r.cardId);

    const totalHandValue = recommendations.reduce((s, r) => s + r.priorityScore, 0);
    const maxPossibleValue = recommendations.length;

    // Estimate win contribution: how much of the hand serves the win condition
    const economyProgress = snapshot.economy.netWorth / Math.max(1, snapshot.economy.freedomTarget);
    const winContribution = Number(
      Math.min(1, (totalHandValue / Math.max(1, maxPossibleValue)) * (1 - economyProgress * 0.3)).toFixed(4),
    );

    return {
      tick: snapshot.tick,
      mode: snapshot.mode,
      orderedRecommendations: Object.freeze(recommendations),
      immediatePlayCardIds: Object.freeze(immediatePlayCardIds),
      deferCardIds: Object.freeze(deferCardIds),
      discardCandidateIds: Object.freeze(discardCandidateIds),
      totalHandValue: Number(totalHandValue.toFixed(4)),
      estimatedWinContribution: winContribution,
    };
  }
}

// ============================================================================
// § 9 — ModePressureAdvisor
// ============================================================================

/**
 * Advises on deck composition and timing strategy given current pressure state.
 */
export class ModePressureAdvisor {
  /** Build a pressure advisory from compiled rules + snapshot. */
  public advise(rules: CompiledModeRules, snapshot: RunStateSnapshot): PressureAdvisory {
    const tier = snapshot.pressure.tier;
    const tierIndex = ['T0', 'T1', 'T2', 'T3', 'T4'].indexOf(tier);

    // Build deck weights: pressure elevates reactive/defensive decks
    const recommendedDeckWeights: Partial<Record<DeckType, number>> = {};
    for (const deck of rules.allowedDecks) {
      const basePriority = DECK_PRIORITY_BY_MODE[rules.mode][deck] ?? 0.5;
      const phaseMultiplier = PHASE_DECK_MULTIPLIER[snapshot.phase][deck] ?? 1.0;
      const pressureFactor =
        (deck === 'COUNTER' || deck === 'RESCUE' || deck === 'DISCIPLINE')
          ? 1 + (tierIndex / 4) * 0.5
          : 1 + (tierIndex / 4) * 0.1;
      recommendedDeckWeights[deck] = Number(Math.min(1, basePriority * phaseMultiplier * pressureFactor).toFixed(4));
    }

    // Fill blocked decks with 0 weight
    for (const deck of rules.blockedDecks) {
      recommendedDeckWeights[deck] = 0;
    }

    // Timing priority is the same as mode priority but with pressure-based bumps
    const timingWindowPriority: TimingClass[] = [...rules.timingPolicy.priorityTimingClasses];
    if (tier === 'T3' || tier === 'T4') {
      if (!timingWindowPriority.includes('CTR')) timingWindowPriority.unshift('CTR');
    }

    const costPressureRatio = Number(
      (rules.pressureCurveModifier * PRESSURE_TIER_MULTIPLIER[tier]).toFixed(4),
    );

    const urgencyLevel: PressureAdvisory['urgencyLevel'] =
      tier === 'T4' ? 'RED'
      : tier === 'T3' ? 'ORANGE'
      : tier === 'T2' ? 'YELLOW'
      : 'GREEN';

    const recommendedActions: string[] = [];
    if (urgencyLevel === 'RED') {
      recommendedActions.push('Maximum pressure — play only essential cards. Conserve cash.');
      recommendedActions.push('Counter and Rescue decks are cost-amplified. Use strategically.');
    } else if (urgencyLevel === 'ORANGE') {
      recommendedActions.push('High pressure — prioritize shield recovery and income decks.');
    } else if (urgencyLevel === 'YELLOW') {
      recommendedActions.push('Elevated pressure — maintain balanced play, watch cascade chains.');
    } else {
      recommendedActions.push('Low pressure — invest in long-horizon income and scale decks.');
    }

    if (snapshot.modeState.bleedMode) {
      recommendedActions.push('Bleed mode active — forced faster decisions, reduce hand size.');
    }

    return {
      tier,
      pressureCurveModifier: rules.pressureCurveModifier,
      heatCurveModifier: rules.heatCurveModifier,
      recommendedDeckWeights: Object.freeze(recommendedDeckWeights as Record<DeckType, number>),
      timingWindowPriority: Object.freeze(timingWindowPriority),
      costPressureRatio,
      recommendedActions: Object.freeze(recommendedActions),
      urgencyLevel,
    };
  }
}

// ============================================================================
// § 10 — ModeMLFeatureExtractor
// ============================================================================

const ML_FEATURE_LABELS: readonly string[] = Object.freeze([
  // Mode encoding (4 binary features)
  'mode_solo', 'mode_pvp', 'mode_coop', 'mode_ghost',
  // Phase encoding (3 binary features)
  'phase_foundation', 'phase_escalation', 'phase_sovereignty',
  // Pressure tier (5 binary features)
  'tier_t0', 'tier_t1', 'tier_t2', 'tier_t3', 'tier_t4',
  // Modifier surfaces
  'pressure_curve_modifier', 'heat_curve_modifier',
  // Economy policy
  'shared_treasury', 'allow_aid', 'allow_defection', 'shared_treasury_balance_01',
  // Threat policy
  'counter_intel_tier_01', 'rivalry_heat_multiplier_01', 'disabled_bot_count_01',
  // Timing policy
  'allowed_timing_count_01', 'priority_timing_count_01', 'phase_boundary_windows_01',
  // Card surface
  'allowed_deck_count_01', 'blocked_deck_count_01',
  // Proof policy
  'grade_bias_01', 'legend_gap_bias_01',
  // Snapshot context
  'economy_progress_01', 'shield_integrity_01', 'cascade_active_01',
  'pressure_score', 'tension_score', 'bleed_mode',
  'time_budget_consumed_01', 'decision_count_01',
]);

export const MODE_RULE_ML_FEATURE_COUNT = ML_FEATURE_LABELS.length as number;

/**
 * Extracts an ML feature vector from compiled mode rules + snapshot.
 */
export class ModeMLFeatureExtractor {
  public extract(
    rules: CompiledModeRules,
    snapshot: RunStateSnapshot,
  ): ModeRulesMLVector {
    const modes: ModeCode[] = ['solo', 'pvp', 'coop', 'ghost'];
    const phases: RunStateSnapshot['phase'][] = ['FOUNDATION', 'ESCALATION', 'SOVEREIGNTY'];
    const tiers: RunStateSnapshot['pressure']['tier'][] = ['T0', 'T1', 'T2', 'T3', 'T4'];

    const shieldCurrent = snapshot.shield.layers.reduce((s, l) => s + l.current, 0);
    const shieldMax = snapshot.shield.layers.reduce((s, l) => s + l.max, 0);
    const shieldIntegrity = shieldMax <= 0 ? 1 : shieldCurrent / shieldMax;
    const economyProgress = snapshot.economy.netWorth / Math.max(1, snapshot.economy.freedomTarget);
    const totalBudget = snapshot.timers.seasonBudgetMs + snapshot.timers.extensionBudgetMs;
    const timeConsumed = totalBudget <= 0 ? 0 : snapshot.timers.elapsedMs / totalBudget;

    const features: number[] = [
      // Mode one-hot
      ...modes.map((m) => m === rules.mode ? 1 : 0),
      // Phase one-hot
      ...phases.map((p) => p === snapshot.phase ? 1 : 0),
      // Tier one-hot
      ...tiers.map((t) => t === snapshot.pressure.tier ? 1 : 0),
      // Modifiers
      Math.min(2, rules.pressureCurveModifier) / 2,
      Math.min(2, rules.heatCurveModifier) / 2,
      // Economy policy
      rules.economyPolicy.sharedTreasury ? 1 : 0,
      rules.economyPolicy.allowAid ? 1 : 0,
      rules.economyPolicy.allowDefection ? 1 : 0,
      Math.min(1, rules.economyPolicy.sharedTreasuryBalance / 100_000),
      // Threat policy
      Math.min(1, rules.threatPolicy.counterIntelTier / 4),
      Math.min(1, rules.threatPolicy.rivalryHeatMultiplier / 2),
      Math.min(1, rules.threatPolicy.disabledBots.length / 5),
      // Timing policy
      Math.min(1, rules.timingPolicy.allowedTimingClasses.length / 12),
      Math.min(1, rules.timingPolicy.priorityTimingClasses.length / 12),
      Math.min(1, rules.timingPolicy.phaseBoundaryWindowsRemaining / 5),
      // Card surface
      Math.min(1, rules.allowedDecks.length / 14),
      Math.min(1, rules.blockedDecks.length / 14),
      // Proof policy
      Math.min(1, rules.proofPolicy.gradeBias),
      Math.min(1, rules.proofPolicy.legendGapBias),
      // Snapshot context
      Math.min(1.5, economyProgress),
      Math.min(1, shieldIntegrity),
      Math.min(1, snapshot.cascade.activeChains.length / 10),
      snapshot.pressure.score,
      snapshot.tension.score,
      snapshot.modeState.bleedMode ? 1 : 0,
      Math.min(1, timeConsumed),
      Math.min(1, snapshot.telemetry.decisions.length / 100),
    ];

    return {
      mode: rules.mode,
      tick: snapshot.tick,
      features: Object.freeze(features),
      labels: ML_FEATURE_LABELS,
      featureCount: features.length,
      modelVersion: ML_MODEL_VERSION,
    };
  }
}

// ============================================================================
// § 11 — ModeDLInputBuilder
// ============================================================================

/**
 * Builds a DL tensor descriptor from mode rule context.
 * Tensors are used for deeper inference (policy networks, value functions).
 */
export class ModeDLInputBuilder {
  private readonly extractor: ModeMLFeatureExtractor;

  public constructor(extractor?: ModeMLFeatureExtractor) {
    this.extractor = extractor ?? new ModeMLFeatureExtractor();
  }

  public build(rules: CompiledModeRules, snapshot: RunStateSnapshot): ModeRulesDLTensor {
    const mlVector = this.extractor.extract(rules, snapshot);
    const inputData = [...mlVector.features];

    // Append card hand context: deck type distribution in hand
    const DECK_ORDER: readonly DeckType[] = [
      'OPPORTUNITY', 'IPA', 'FUBAR', 'MISSED_OPPORTUNITY', 'PRIVILEGED',
      'SO', 'SABOTAGE', 'COUNTER', 'AID', 'RESCUE', 'DISCIPLINE', 'TRUST', 'BLUFF', 'GHOST',
    ];
    const handByDeck: Record<string, number> = {};
    for (const card of snapshot.cards.hand) {
      handByDeck[card.card.deckType] = (handByDeck[card.card.deckType] ?? 0) + 1;
    }
    const handTotal = Math.max(1, snapshot.cards.hand.length);
    for (const deck of DECK_ORDER) {
      inputData.push((handByDeck[deck] ?? 0) / handTotal);
    }

    // Append ghost marker proximity (for ghost mode)
    const nearestMarker = snapshot.cards.ghostMarkers.length > 0
      ? Math.min(...snapshot.cards.ghostMarkers.map((m) => Math.abs(m.tick - snapshot.tick)))
      : 999;
    inputData.push(Math.min(1, 1 / Math.max(1, nearestMarker)));

    // Append sovereignty progress
    inputData.push(Math.min(1, snapshot.sovereignty.sovereigntyScore));
    inputData.push(Math.min(1, Math.abs(snapshot.sovereignty.gapVsLegend)));

    return {
      mode: rules.mode,
      tick: snapshot.tick,
      inputShape: Object.freeze([1, inputData.length]),
      inputData: Object.freeze(inputData),
      contextKey: `mode_rules_${rules.mode}_t${snapshot.tick}`,
      modelVersion: ML_MODEL_VERSION,
    };
  }
}

// ============================================================================
// § 12 — ModeRuleCompilerRollingStats
// ============================================================================

/** Per-tick record for the rolling stats tracker. */
export interface ModeCompilerRollingEntry {
  readonly tick: number;
  readonly compileCount: number;
  readonly legalityCheckCount: number;
  readonly projectionsComputed: number;
  readonly illegalCardCount: number;
  readonly latencyMs: number;
  readonly capturedAtMs: number;
}

export const MODE_RULE_COMPILER_ROLLING_CAPACITY = 256 as const;

/**
 * Rolling analytics tracker for the mode rule compiler.
 * Tracks compile latency, legality result ratios, and projection volume.
 */
export class ModeRuleCompilerRollingStats {
  private readonly capacity: number;
  private readonly entries: ModeCompilerRollingEntry[] = [];
  private _totalCompiles = 0;
  private _totalLegalityChecks = 0;
  private _totalProjections = 0;
  private _totalIllegal = 0;
  private _totalLatencyMs = 0;

  public constructor(capacity: number = MODE_RULE_COMPILER_ROLLING_CAPACITY) {
    this.capacity = capacity;
  }

  public record(entry: Omit<ModeCompilerRollingEntry, 'capturedAtMs'>): void {
    const full: ModeCompilerRollingEntry = { ...entry, capturedAtMs: Date.now() };
    this.entries.push(full);
    if (this.entries.length > this.capacity) {
      this.entries.splice(0, this.entries.length - this.capacity);
    }
    this._totalCompiles += entry.compileCount;
    this._totalLegalityChecks += entry.legalityCheckCount;
    this._totalProjections += entry.projectionsComputed;
    this._totalIllegal += entry.illegalCardCount;
    this._totalLatencyMs += entry.latencyMs;
  }

  public buildTickStats(tick: number, latencyMs: number): ModeCompilerTickStats {
    const recent = this.entries.filter((e) => e.tick >= tick - 1);
    return {
      tick,
      compileCount: recent.reduce((s, e) => s + e.compileCount, 0),
      legalityCheckCount: recent.reduce((s, e) => s + e.legalityCheckCount, 0),
      projectionsComputed: recent.reduce((s, e) => s + e.projectionsComputed, 0),
      illegalCardCount: recent.reduce((s, e) => s + e.illegalCardCount, 0),
      latencyMs,
    };
  }

  public buildHealthSummary(): ModeCompilerHealthSummary {
    const grade = gradeModeCompilerHealth(this);
    const illegalRatio =
      this._totalLegalityChecks === 0 ? 0 : this._totalIllegal / this._totalLegalityChecks;
    const avgLatency =
      this._totalCompiles === 0 ? 0 : this._totalLatencyMs / this._totalCompiles;

    const warnings: string[] = [];
    if (illegalRatio > 0.3) warnings.push('High illegal card ratio — review deck composition.');
    if (avgLatency > 5) warnings.push('Compiler latency exceeding 5ms — check rule complexity.');
    if (this._totalCompiles === 0) warnings.push('No compiles recorded yet.');

    return {
      grade,
      totalCompiles: this._totalCompiles,
      totalLegalityChecks: this._totalLegalityChecks,
      illegalCardRatio: Number(illegalRatio.toFixed(4)),
      avgLatencyMs: Number(avgLatency.toFixed(3)),
      warningFlags: Object.freeze(warnings),
    };
  }

  get totalCompiles(): number { return this._totalCompiles; }
  get totalLegalityChecks(): number { return this._totalLegalityChecks; }
  get totalIllegal(): number { return this._totalIllegal; }
  get entryCount(): number { return this.entries.length; }

  public reset(): void {
    this.entries.length = 0;
    this._totalCompiles = 0;
    this._totalLegalityChecks = 0;
    this._totalProjections = 0;
    this._totalIllegal = 0;
    this._totalLatencyMs = 0;
  }

  public snapshot(): readonly ModeCompilerRollingEntry[] {
    return Object.freeze([...this.entries]);
  }
}

// ============================================================================
// § 13 — Health grading and module constants
// ============================================================================

export function gradeModeCompilerHealth(
  stats: ModeRuleCompilerRollingStats,
): ModeCompilerHealthGrade {
  const total = stats.totalLegalityChecks;
  if (total === 0) return 'A';

  const illegalRatio = stats.totalIllegal / total;
  const avgLatency = stats.totalCompiles > 0 ? 0 : 0; // placeholder; real calc from summary
  void avgLatency;

  if (illegalRatio < 0.05) return 'S';
  if (illegalRatio < 0.15) return 'A';
  if (illegalRatio < 0.30) return 'B';
  if (illegalRatio < 0.50) return 'C';
  if (illegalRatio < 0.70) return 'D';
  return 'F';
}

export function buildModeCompilerHealthSummary(
  stats: ModeRuleCompilerRollingStats,
): ModeCompilerHealthSummary {
  return stats.buildHealthSummary();
}

export const MODE_RULE_COMPILER_MODULE_VERSION = '3.1.0' as const;
export const MODE_RULE_COMPILER_MODULE_READY = true as const;
export const MODE_RULE_COMPILER_COMPLETE = true as const;

// ============================================================================
// § 14 — ModeRuleCompilerFacade
// ============================================================================

export interface ModeRuleCompilerFacadeOptions {
  readonly rollingCapacity?: number;
}

/**
 * Single-entrypoint wiring of all mode rule surfaces.
 *
 * Usage:
 *   const facade = new ModeRuleCompilerFacade();
 *   const rules = facade.compiler.compileSnapshot(snapshot);
 *   const hand = facade.handOptimizer.optimize(snapshot.cards.hand, rules, snapshot);
 *   const mlVector = facade.mlExtractor.extract(rules, snapshot);
 *   const dlTensor = facade.dlBuilder.build(rules, snapshot);
 */
export class ModeRuleCompilerFacade {
  public readonly compiler: ModeRuleCompiler;
  public readonly recommendationEngine: ModePlayRecommendationEngine;
  public readonly defectionAnalyzer: ModeDefectionAnalyzer;
  public readonly badgeAdvisor: ModeBadgeAdvisor;
  public readonly phaseDetector: ModePhaseBoundaryDetector;
  public readonly handOptimizer: ModeHandOptimizer;
  public readonly pressureAdvisor: ModePressureAdvisor;
  public readonly mlExtractor: ModeMLFeatureExtractor;
  public readonly dlBuilder: ModeDLInputBuilder;
  public readonly rollingStats: ModeRuleCompilerRollingStats;

  public constructor(options: ModeRuleCompilerFacadeOptions = {}) {
    this.compiler = new ModeRuleCompiler();
    this.recommendationEngine = new ModePlayRecommendationEngine(this.compiler);
    this.defectionAnalyzer = new ModeDefectionAnalyzer();
    this.badgeAdvisor = new ModeBadgeAdvisor();
    this.phaseDetector = new ModePhaseBoundaryDetector();
    this.handOptimizer = new ModeHandOptimizer(this.recommendationEngine);
    this.pressureAdvisor = new ModePressureAdvisor();
    this.mlExtractor = new ModeMLFeatureExtractor();
    this.dlBuilder = new ModeDLInputBuilder(this.mlExtractor);
    this.rollingStats = new ModeRuleCompilerRollingStats(
      options.rollingCapacity ?? MODE_RULE_COMPILER_ROLLING_CAPACITY,
    );
  }

  /**
   * Compile mode rules from a live snapshot and run all analytics surfaces.
   */
  public analyzeSnapshot(snapshot: RunStateSnapshot): {
    readonly rules: CompiledModeRules;
    readonly handOptimization: HandOptimizationResult;
    readonly pressureAdvisory: PressureAdvisory;
    readonly defectionReport: DefectionRiskReport;
    readonly badgeProjection: BadgeProjection;
    readonly phaseReadiness: PhaseTransitionReadiness;
    readonly mlVector: ModeRulesMLVector;
    readonly dlTensor: ModeRulesDLTensor;
  } {
    const startMs = Date.now();
    const rules = this.compiler.compileSnapshot(snapshot);
    const handOptimization = this.handOptimizer.optimize(snapshot.cards.hand, rules, snapshot);
    const pressureAdvisory = this.pressureAdvisor.advise(rules, snapshot);
    const defectionReport = this.defectionAnalyzer.analyze(snapshot);
    const badgeProjection = this.badgeAdvisor.project(snapshot, rules);
    const phaseReadiness = this.phaseDetector.assess(snapshot, rules);
    const mlVector = this.mlExtractor.extract(rules, snapshot);
    const dlTensor = this.dlBuilder.build(rules, snapshot);
    const latencyMs = Date.now() - startMs;

    this.rollingStats.record({
      tick: snapshot.tick,
      compileCount: 1,
      legalityCheckCount: snapshot.cards.hand.length,
      projectionsComputed: snapshot.cards.hand.length,
      illegalCardCount: handOptimization.discardCandidateIds.length,
      latencyMs,
    });

    return Object.freeze({
      rules,
      handOptimization,
      pressureAdvisory,
      defectionReport,
      badgeProjection,
      phaseReadiness,
      mlVector,
      dlTensor,
    });
  }

  /** Validate a specific card against current rules. */
  public validateCard(
    card: CardDefinition | CardInstance,
    snapshot: RunStateSnapshot,
    options: { timing?: TimingClass; targeting?: Targeting } = {},
  ): ModeCardLegalityResult {
    const rules = this.compiler.compileSnapshot(snapshot);
    return this.compiler.isCardLegal(card, rules, options);
  }

  /** Build the rolling health summary. */
  public getHealthSummary(): ModeCompilerHealthSummary {
    return this.rollingStats.buildHealthSummary();
  }
}

export function createModeRuleCompilerFacade(
  options?: ModeRuleCompilerFacadeOptions,
): ModeRuleCompilerFacade {
  return new ModeRuleCompilerFacade(options);
}
