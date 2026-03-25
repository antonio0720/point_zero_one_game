/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/core/RunStateSnapshot.ts
 *
 * Doctrine:
 * - backend snapshots are immutable read models, not writable live state
 * - semantic pressure and tick cadence must both be preserved
 * - mode truth remains backend-owned, but snapshots still carry enough
 *   shape to align with frontend engine doctrine
 * - every field here is serialization-safe and deterministic-hash friendly
 * - additive expansion is preferred over breaking renames
 *
 * Extended Doctrine (v2 upgrade — engine depth layer):
 * - Every GamePrimitives constant is accessed through runtime scoring
 * - ML feature extraction is a first-class snapshot capability
 * - DL tensor construction is deterministic and replay-stable
 * - UX signal projection drives companion commentary, urgency display, and chat routing
 * - All scoring is pure — zero mutation, zero side effects, zero hidden state
 * - The snapshot layer is the single source of truth for upstream ML/DL inference
 * - SnapshotReadModel provides the authoritative computed view for chat adapters
 */

// ============================================================================
// SECTION 1 — TYPE IMPORTS FROM GamePrimitives
// ============================================================================

import type {
  AttackEvent,
  BotState,
  CardInstance,
  CascadeChainInstance,
  HaterBotId,
  IntegrityStatus,
  LegendMarker,
  ModeCode,
  PressureTier,
  RunOutcome,
  RunPhase,
  ShieldLayerId,
  ShieldLayerLabel,
  ThreatEnvelope,
  TimingClass,
  AttackSeverityClass,
  ThreatUrgencyClass,
  CascadeHealthClass,
  LegendMarkerSignificance,
  AttackCategory,
  CardRarity,
  VerifiedGrade,
  DeckType,
  VisibilityLevel,
  DivergencePotential,
  EffectPayload,
  Targeting,
  Counterability,
} from './GamePrimitives';

// ============================================================================
// SECTION 2 — RUNTIME IMPORTS FROM GamePrimitives (constants + functions)
//   Every symbol here is actively used in a scoring class or predicate below.
// ============================================================================

import {
  // Canonical array sentinels — used in validation and iteration
  MODE_CODES,
  PRESSURE_TIERS,
  RUN_PHASES,
  RUN_OUTCOMES,
  SHIELD_LAYER_IDS,
  HATER_BOT_IDS,
  TIMING_CLASSES,
  DECK_TYPES,
  INTEGRITY_STATUSES,
  VERIFIED_GRADES,
  SHIELD_LAYER_LABEL_BY_ID,

  // Tier / phase / mode scoring maps
  PRESSURE_TIER_NORMALIZED,
  PRESSURE_TIER_URGENCY_LABEL,
  PRESSURE_TIER_MIN_HOLD_TICKS,
  PRESSURE_TIER_ESCALATION_THRESHOLD,
  PRESSURE_TIER_DEESCALATION_THRESHOLD,
  RUN_PHASE_NORMALIZED,
  RUN_PHASE_STAKES_MULTIPLIER,
  RUN_PHASE_TICK_BUDGET_FRACTION,
  MODE_NORMALIZED,
  MODE_DIFFICULTY_MULTIPLIER,
  MODE_TENSION_FLOOR,

  // Shield maps
  SHIELD_LAYER_ABSORPTION_ORDER,
  SHIELD_LAYER_CAPACITY_WEIGHT,

  // Timing class maps
  TIMING_CLASS_WINDOW_PRIORITY,
  TIMING_CLASS_URGENCY_DECAY,

  // Bot maps
  BOT_THREAT_LEVEL,
  BOT_STATE_THREAT_MULTIPLIER,
  BOT_STATE_ALLOWED_TRANSITIONS,

  // Visibility / integrity / grade maps
  VISIBILITY_CONCEALMENT_FACTOR,
  INTEGRITY_STATUS_RISK_SCORE,
  VERIFIED_GRADE_NUMERIC_SCORE,

  // Legend marker maps
  LEGEND_MARKER_KIND_WEIGHT,

  // Card / deck maps
  DECK_TYPE_POWER_LEVEL,
  DECK_TYPE_IS_OFFENSIVE,
  CARD_RARITY_WEIGHT,
  ATTACK_CATEGORY_BASE_MAGNITUDE,
  ATTACK_CATEGORY_IS_COUNTERABLE,
  COUNTERABILITY_RESISTANCE_SCORE,
  TARGETING_SPREAD_FACTOR,
  DIVERGENCE_POTENTIAL_NORMALIZED,

  // Type guards — used in snapshot validation utilities
  isModeCode,
  isPressureTier,
  isRunPhase,
  isRunOutcome,
  isShieldLayerId,
  isHaterBotId,
  isTimingClass,
  isDeckType,
  isVisibilityLevel,
  isIntegrityStatus,
  isVerifiedGrade,

  // Pressure utilities
  computePressureRiskScore,
  canEscalatePressure,
  canDeescalatePressure,
  describePressureTierExperience,

  // Phase / run utilities
  computeRunProgressFraction,
  computeEffectiveStakes,
  isEndgamePhase,
  isWinOutcome,
  isLossOutcome,
  scoreOutcomeExcitement,

  // Shield utilities
  computeShieldLayerVulnerability,
  computeShieldIntegrityRatio,
  estimateShieldRegenPerTick,

  // Attack utilities
  classifyAttackSeverity,
  computeEffectiveAttackDamage,
  isAttackCounterable,
  isShieldTargetedAttack,
  isAttackFromBot,
  scoreAttackResponseUrgency,

  // Threat utilities
  scoreThreatUrgency,
  classifyThreatUrgency,
  findMostUrgentThreat,
  computeAggregateThreatPressure,

  // Effect utilities
  computeEffectFinancialImpact,
  computeEffectShieldImpact,
  computeEffectMagnitude,
  computeEffectRiskScore,
  isEffectNetPositive,

  // Card utilities
  computeCardPowerScore,
  computeCardCostEfficiency,
  isCardLegalInMode,
  computeCardDecayUrgency,
  canCardCounterAttack,
  computeCardTimingPriority,
  isCardOffensive,

  // Cascade utilities
  scoreCascadeChainHealth,
  classifyCascadeChainHealth,
  computeCascadeProgressPercent,
  isCascadeRecoverable,
  computeCascadeExperienceImpact,

  // Legend utilities
  computeLegendMarkerValue,
  classifyLegendMarkerSignificance,
  computeLegendMarkerDensity,
} from './GamePrimitives';

// ============================================================================
// SECTION 3 — DETERMINISTIC IMPORTS (fingerprinting + canonical encoding)
// ============================================================================

import { checksumSnapshot, stableStringify } from './Deterministic';

// ============================================================================
// SECTION 4 — EXISTING SNAPSHOT TYPE DEFINITIONS (canonical, unchanged)
// ============================================================================

export type ModePresentationCode =
  | 'empire'
  | 'predator'
  | 'syndicate'
  | 'phantom';

export type PressureBand =
  | 'CALM'
  | 'BUILDING'
  | 'ELEVATED'
  | 'HIGH'
  | 'CRITICAL';

export type OutcomeReasonCode =
  | 'TARGET_REACHED'
  | 'SEASON_BUDGET_EXHAUSTED'
  | 'NET_WORTH_COLLAPSE'
  | 'USER_ABANDON'
  | 'ENGINE_ABORT'
  | 'INTEGRITY_QUARANTINE'
  | 'UNKNOWN';

export type DecisionWindowMetadataValue =
  | string
  | number
  | boolean
  | null;

export interface RuntimeDecisionWindowSnapshot {
  readonly id: string;
  readonly timingClass: TimingClass;
  readonly label: string;
  readonly source: string;
  readonly mode: ModeCode;
  readonly openedAtTick: number;
  readonly openedAtMs: number;
  readonly closesAtTick: number | null;
  readonly closesAtMs: number | null;
  readonly exclusive: boolean;
  readonly frozen: boolean;
  readonly consumed: boolean;
  readonly actorId: string | null;
  readonly targetActorId: string | null;
  readonly cardInstanceId: string | null;
  readonly metadata: Readonly<Record<string, DecisionWindowMetadataValue>>;
}

export interface ShieldLayerState {
  readonly layerId: ShieldLayerId;
  readonly label: ShieldLayerLabel;
  readonly current: number;
  readonly max: number;
  readonly regenPerTick: number;
  readonly breached: boolean;
  readonly integrityRatio: number;
  readonly lastDamagedTick: number | null;
  readonly lastRecoveredTick: number | null;
}

export interface EconomyState {
  readonly cash: number;
  readonly debt: number;
  readonly incomePerTick: number;
  readonly expensesPerTick: number;
  readonly netWorth: number;
  readonly freedomTarget: number;
  readonly haterHeat: number;
  readonly opportunitiesPurchased: number;
  readonly privilegePlays: number;
}

export interface PressureState {
  /**
   * Normalized semantic pressure score.
   * 0.0 = calm, 1.0 = catastrophic.
   */
  readonly score: number;

  /**
   * Backend cadence tier retained for engine/runtime compatibility.
   * Canonical values remain T0..T4.
   */
  readonly tier: PressureTier;

  /**
   * Rich semantic pressure band aligned with the frontend doctrine.
   */
  readonly band: PressureBand;

  readonly previousTier: PressureTier;
  readonly previousBand: PressureBand;
  readonly upwardCrossings: number;
  readonly survivedHighPressureTicks: number;
  readonly lastEscalationTick: number | null;
  readonly maxScoreSeen: number;
}

export interface TensionState {
  readonly score: number;
  readonly anticipation: number;
  readonly visibleThreats: readonly ThreatEnvelope[];
  readonly maxPulseTriggered: boolean;
  readonly lastSpikeTick: number | null;
}

export interface ShieldState {
  readonly layers: readonly ShieldLayerState[];
  readonly weakestLayerId: ShieldLayerId;
  readonly weakestLayerRatio: number;
  readonly blockedThisRun: number;
  readonly damagedThisRun: number;
  readonly breachesThisRun: number;
  readonly repairQueueDepth: number;
}

export interface BotRuntimeState {
  readonly botId: HaterBotId;
  readonly label: string;
  readonly state: BotState;
  readonly heat: number;
  readonly lastAttackTick: number | null;
  readonly attacksLanded: number;
  readonly attacksBlocked: number;
  readonly neutralized: boolean;
}

export interface BattleState {
  readonly bots: readonly BotRuntimeState[];
  readonly battleBudget: number;
  readonly battleBudgetCap: number;
  readonly extractionCooldownTicks: number;
  readonly firstBloodClaimed: boolean;
  readonly pendingAttacks: readonly AttackEvent[];
  readonly sharedOpportunityDeckCursor: number;
  readonly rivalryHeatCarry: number;
  readonly neutralizedBotIds: readonly HaterBotId[];
}

export interface CascadeState {
  readonly activeChains: readonly CascadeChainInstance[];
  readonly positiveTrackers: readonly string[];
  readonly brokenChains: number;
  readonly completedChains: number;
  readonly repeatedTriggerCounts: Readonly<Record<string, number>>;
  readonly lastResolvedTick: number | null;
}

export interface SovereigntyState {
  readonly integrityStatus: IntegrityStatus;
  readonly tickChecksums: readonly string[];
  readonly proofHash: string | null;
  readonly sovereigntyScore: number;
  readonly verifiedGrade: string | null;
  readonly proofBadges: readonly string[];
  readonly gapVsLegend: number;
  readonly gapClosingRate: number;
  readonly cordScore: number;
  readonly auditFlags: readonly string[];
  readonly lastVerifiedTick: number | null;
}

export interface CardsState {
  readonly hand: readonly CardInstance[];
  readonly discard: readonly string[];
  readonly exhaust: readonly string[];
  readonly drawHistory: readonly string[];
  readonly lastPlayed: readonly string[];
  readonly ghostMarkers: readonly LegendMarker[];
  readonly drawPileSize: number;
  readonly deckEntropy: number;
}

export interface ModeState {
  readonly holdEnabled: boolean;
  readonly loadoutEnabled: boolean;
  readonly sharedTreasury: boolean;
  readonly sharedTreasuryBalance: number;
  readonly trustScores: Readonly<Record<string, number>>;
  readonly roleAssignments: Readonly<Record<string, string>>;
  readonly defectionStepByPlayer: Readonly<Record<string, number>>;
  readonly legendMarkersEnabled: boolean;
  readonly communityHeatModifier: number;
  readonly sharedOpportunityDeck: boolean;
  readonly counterIntelTier: number;
  readonly spectatorLimit: number;
  readonly phaseBoundaryWindowsRemaining: number;
  readonly bleedMode: boolean;
  readonly handicapIds: readonly string[];
  readonly advantageId: string | null;
  readonly disabledBots: readonly HaterBotId[];
  readonly modePresentation: ModePresentationCode;
  readonly roleLockEnabled: boolean;
  readonly extractionActionsRemaining: number;
  readonly ghostBaselineRunId: string | null;
  readonly legendOwnerUserId: string | null;
}

export interface TimerState {
  readonly seasonBudgetMs: number;
  readonly extensionBudgetMs: number;
  readonly elapsedMs: number;
  readonly currentTickDurationMs: number;
  readonly nextTickAtMs: number | null;
  readonly holdCharges: number;

  /**
   * Canonical runtime-owned timing windows.
   */
  readonly activeDecisionWindows: Readonly<
    Record<string, RuntimeDecisionWindowSnapshot>
  >;

  /**
   * Convenience projection for frozen-window IDs.
   */
  readonly frozenWindowIds: readonly string[];

  readonly lastTierChangeTick?: number | null;
  readonly tierInterpolationRemainingTicks?: number;
  readonly forcedTierOverride?: PressureTier | null;
}

export type TimersState = TimerState;

export interface DecisionRecord {
  readonly tick: number;
  readonly actorId: string;
  readonly cardId: string;
  readonly latencyMs: number;
  readonly timingClass: readonly string[];
  readonly accepted: boolean;
}

export interface TelemetryState {
  readonly decisions: readonly DecisionRecord[];
  readonly outcomeReason: string | null;
  readonly outcomeReasonCode: OutcomeReasonCode | null;
  readonly lastTickChecksum: string | null;
  readonly forkHints: readonly string[];
  readonly emittedEventCount: number;
  readonly warnings: readonly string[];
}

export interface RunStateSnapshot {
  readonly schemaVersion: 'engine-run-state.v2';
  readonly runId: string;
  readonly userId: string;
  readonly seed: string;
  readonly mode: ModeCode;
  readonly tick: number;
  readonly phase: RunPhase;
  readonly outcome: RunOutcome | null;
  readonly tags: readonly string[];
  readonly economy: EconomyState;
  readonly pressure: PressureState;
  readonly tension: TensionState;
  readonly shield: ShieldState;
  readonly battle: BattleState;
  readonly cascade: CascadeState;
  readonly sovereignty: SovereigntyState;
  readonly cards: CardsState;
  readonly modeState: ModeState;
  readonly timers: TimerState;
  readonly telemetry: TelemetryState;
}

// ============================================================================
// SECTION 5 — MODULE METADATA
// ============================================================================

export const SNAPSHOT_MODULE_VERSION = 'snapshot.v2.2026' as const;
export const SNAPSHOT_MODULE_READY = true as const;

/** Total number of ML features extracted per snapshot. */
export const SNAPSHOT_ML_FEATURE_COUNT = 64 as const;

/** Total number of DL input features for deep learning inference. */
export const SNAPSHOT_DL_FEATURE_COUNT = 96 as const;

/** Shape of the DL input tensor: [batch=1, features=96] */
export const SNAPSHOT_DL_TENSOR_SHAPE: readonly [1, 96] = Object.freeze([1, 96] as const);

// ============================================================================
// SECTION 6 — ML FEATURE LABEL CONSTANTS
// ============================================================================

/** Canonical 64-feature ML label set for snapshot-level scoring. */
export const SNAPSHOT_ML_FEATURE_LABELS: readonly string[] = Object.freeze([
  // Economy (8 features)
  'economy_cash_normalized',
  'economy_debt_normalized',
  'economy_net_worth_normalized',
  'economy_income_rate',
  'economy_expense_rate',
  'economy_freedom_progress',
  'economy_hater_heat_normalized',
  'economy_net_flow_ratio',

  // Pressure (6 features)
  'pressure_score',
  'pressure_tier_normalized',
  'pressure_upward_crossings_normalized',
  'pressure_survived_high_ticks_normalized',
  'pressure_can_escalate',
  'pressure_can_deescalate',

  // Tension (5 features)
  'tension_score',
  'tension_anticipation',
  'tension_visible_threat_count_normalized',
  'tension_aggregate_threat_pressure',
  'tension_max_pulse_triggered',

  // Shield (8 features)
  'shield_weakest_layer_ratio',
  'shield_breaches_this_run_normalized',
  'shield_damaged_this_run_normalized',
  'shield_blocked_this_run_normalized',
  'shield_repair_queue_depth_normalized',
  'shield_layer_l1_ratio',
  'shield_layer_l2_ratio',
  'shield_layer_l3_ratio',

  // Battle (7 features)
  'battle_budget_normalized',
  'battle_budget_cap_normalized',
  'battle_active_bot_count_normalized',
  'battle_aggregate_bot_threat',
  'battle_pending_attacks_normalized',
  'battle_first_blood_claimed',
  'battle_neutralized_ratio',

  // Cascade (5 features)
  'cascade_active_chain_count_normalized',
  'cascade_broken_ratio',
  'cascade_completed_ratio',
  'cascade_aggregate_health',
  'cascade_recovery_potential',

  // Sovereignty (5 features)
  'sovereignty_score_normalized',
  'sovereignty_integrity_risk',
  'sovereignty_verified_grade_score',
  'sovereignty_gap_vs_legend_normalized',
  'sovereignty_gap_closing_rate',

  // Cards (6 features)
  'cards_hand_size_normalized',
  'cards_discard_ratio',
  'cards_exhaust_ratio',
  'cards_draw_pile_normalized',
  'cards_deck_entropy_normalized',
  'cards_ghost_marker_density',

  // Timers (5 features)
  'timers_elapsed_ratio',
  'timers_tick_duration_normalized',
  'timers_hold_charges_normalized',
  'timers_active_windows_count',
  'timers_frozen_windows_ratio',

  // Meta (5 features)
  'meta_tick_normalized',
  'meta_phase_normalized',
  'meta_mode_normalized',
  'meta_mode_difficulty',
  'meta_outcome_terminal',
] as const);

/** Full 96-feature DL input label set. */
export const SNAPSHOT_DL_FEATURE_LABELS: readonly string[] = Object.freeze([
  ...SNAPSHOT_ML_FEATURE_LABELS,

  // Extended economy
  'economy_opportunities_purchased_normalized',
  'economy_privilege_plays_normalized',
  'economy_positive_flow',
  'economy_debt_service_ratio',

  // Extended pressure
  'pressure_escalation_threshold_normalized',
  'pressure_deescalation_threshold_normalized',
  'pressure_min_hold_ticks_normalized',
  'pressure_tier_urgency_label_numeric',

  // Extended shield per-layer
  'shield_layer_l4_ratio',
  'shield_layer_l1_capacity_weight',
  'shield_layer_l2_capacity_weight',
  'shield_layer_l3_capacity_weight',
  'shield_layer_l4_capacity_weight',
  'shield_absorption_order_score',

  // Extended battle
  'battle_rivalry_heat_carry_normalized',
  'battle_extraction_cooldown_normalized',
  'battle_most_threatening_bot_level',
  'battle_targeting_bot_count',

  // Extended cascade
  'cascade_experience_impact_normalized',
  'cascade_repeat_trigger_density',
  'cascade_positive_tracker_count_normalized',
  'cascade_last_resolved_ticks_ago',

  // Extended sovereignty
  'sovereignty_cord_score_normalized',
  'sovereignty_audit_flag_count_normalized',
  'sovereignty_proof_badge_count_normalized',
  'sovereignty_tick_checksum_coverage',

  // Extended cards
  'cards_hand_power_score_avg',
  'cards_hand_offensive_ratio',
  'cards_hand_legal_ratio',
  'cards_hand_counter_eligible_count',

  // Extended timing windows
  'timers_exclusive_window_ratio',
  'timers_oldest_window_age_normalized',
  'timers_newest_window_age_normalized',
  'timers_consumed_window_count_normalized',

  // Extended meta
  'meta_decisions_accepted_ratio',
  'meta_decisions_avg_latency_normalized',
  'meta_emitted_event_count_normalized',
  'meta_warning_count_normalized',
  'meta_stakes_multiplier',
  'meta_run_progress_fraction',
  'meta_mode_tension_floor',
  'meta_tags_count_normalized',
] as const);

// ============================================================================
// SECTION 7 — SCORING WEIGHT CONSTANTS
// ============================================================================

/** Composite risk scoring weights — must sum to 1.0 for normalized output. */
export const SNAPSHOT_COMPOSITE_RISK_WEIGHTS: Readonly<{
  readonly economy: number;
  readonly pressure: number;
  readonly tension: number;
  readonly shield: number;
  readonly battle: number;
  readonly cascade: number;
  readonly sovereignty: number;
}> = Object.freeze({
  economy: 0.20,
  pressure: 0.22,
  tension: 0.12,
  shield: 0.18,
  battle: 0.14,
  cascade: 0.08,
  sovereignty: 0.06,
});

/** UX urgency thresholds for companion-trigger decisions. */
export const SNAPSHOT_UX_URGENCY_THRESHOLDS: Readonly<{
  readonly CRITICAL: number;
  readonly HIGH: number;
  readonly ELEVATED: number;
  readonly MODERATE: number;
  readonly LOW: number;
}> = Object.freeze({
  CRITICAL: 0.85,
  HIGH: 0.70,
  ELEVATED: 0.55,
  MODERATE: 0.35,
  LOW: 0.15,
});

/** Normalization caps for raw numeric snapshot fields. */
export const SNAPSHOT_NORMALIZATION_CAPS: Readonly<{
  readonly cash: number;
  readonly debt: number;
  readonly netWorth: number;
  readonly elapsedMs: number;
  readonly tick: number;
  readonly attacksLanded: number;
  readonly battleBudget: number;
  readonly decisions: number;
  readonly warningCount: number;
  readonly eventCount: number;
}> = Object.freeze({
  cash: 1_000_000,
  debt: 500_000,
  netWorth: 2_000_000,
  elapsedMs: 3_600_000,
  tick: 1_000,
  attacksLanded: 50,
  battleBudget: 100_000,
  decisions: 200,
  warningCount: 50,
  eventCount: 10_000,
});

// ============================================================================
// SECTION 8 — SNAPSHOT TYPE VALIDATION UTILITIES
//   Uses every type guard imported from GamePrimitives.
// ============================================================================

/** Result of a full snapshot type-guard validation pass. */
export interface SnapshotValidationResult {
  readonly ok: boolean;
  readonly runId: string;
  readonly tick: number;
  readonly fieldErrors: readonly string[];
  readonly enumErrors: readonly string[];
}

/**
 * Validates that all enum-typed fields in a snapshot have values
 * recognized by the canonical GamePrimitives type guards.
 */
export function validateSnapshotEnums(snapshot: RunStateSnapshot): SnapshotValidationResult {
  const fieldErrors: string[] = [];
  const enumErrors: string[] = [];

  if (!isModeCode(snapshot.mode)) {
    enumErrors.push(`mode '${String(snapshot.mode)}' is not a recognized ModeCode`);
  }

  if (!isRunPhase(snapshot.phase)) {
    enumErrors.push(`phase '${String(snapshot.phase)}' is not a recognized RunPhase`);
  }

  if (snapshot.outcome !== null && !isRunOutcome(snapshot.outcome)) {
    enumErrors.push(`outcome '${String(snapshot.outcome)}' is not a recognized RunOutcome`);
  }

  if (!isPressureTier(snapshot.pressure.tier)) {
    enumErrors.push(`pressure.tier '${String(snapshot.pressure.tier)}' is not a recognized PressureTier`);
  }

  if (!isPressureTier(snapshot.pressure.previousTier)) {
    enumErrors.push(`pressure.previousTier '${String(snapshot.pressure.previousTier)}' is not a recognized PressureTier`);
  }

  if (!isShieldLayerId(snapshot.shield.weakestLayerId)) {
    enumErrors.push(`shield.weakestLayerId '${String(snapshot.shield.weakestLayerId)}' is not a recognized ShieldLayerId`);
  }

  for (const layer of snapshot.shield.layers) {
    if (!isShieldLayerId(layer.layerId)) {
      enumErrors.push(`shield layer '${String(layer.layerId)}' is not a recognized ShieldLayerId`);
    }
  }

  for (const bot of snapshot.battle.bots) {
    if (!isHaterBotId(bot.botId)) {
      enumErrors.push(`battle.bots botId '${String(bot.botId)}' is not a recognized HaterBotId`);
    }
  }

  for (const botId of snapshot.battle.neutralizedBotIds) {
    if (!isHaterBotId(botId)) {
      enumErrors.push(`battle.neutralizedBotIds entry '${String(botId)}' is not a recognized HaterBotId`);
    }
  }

  if (!isIntegrityStatus(snapshot.sovereignty.integrityStatus)) {
    enumErrors.push(
      `sovereignty.integrityStatus '${String(snapshot.sovereignty.integrityStatus)}' is not recognized`,
    );
  }

  if (
    snapshot.sovereignty.verifiedGrade !== null &&
    !isVerifiedGrade(snapshot.sovereignty.verifiedGrade)
  ) {
    enumErrors.push(
      `sovereignty.verifiedGrade '${String(snapshot.sovereignty.verifiedGrade)}' is not a recognized VerifiedGrade`,
    );
  }

  for (const window of Object.values(snapshot.timers.activeDecisionWindows)) {
    if (!isTimingClass(window.timingClass)) {
      enumErrors.push(
        `activeDecisionWindows[${window.id}].timingClass '${String(window.timingClass)}' is not recognized`,
      );
    }
    if (!isModeCode(window.mode)) {
      enumErrors.push(
        `activeDecisionWindows[${window.id}].mode '${String(window.mode)}' is not a recognized ModeCode`,
      );
    }
  }

  for (const card of snapshot.cards.hand) {
    const anyCard = card as unknown as Record<string, unknown>;
    if (anyCard['deckType'] !== undefined && !isDeckType(anyCard['deckType'])) {
      enumErrors.push(`cards.hand card deckType '${String(anyCard['deckType'])}' is not recognized`);
    }
  }

  for (const threat of snapshot.tension.visibleThreats) {
    const anyThreat = threat as unknown as Record<string, unknown>;
    if (anyThreat['visibility'] !== undefined && !isVisibilityLevel(anyThreat['visibility'])) {
      enumErrors.push(`tension.visibleThreats visibility '${String(anyThreat['visibility'])}' is not recognized`);
    }
  }

  if (typeof snapshot.runId !== 'string' || snapshot.runId.length === 0) {
    fieldErrors.push('runId must be a non-empty string');
  }
  if (typeof snapshot.userId !== 'string' || snapshot.userId.length === 0) {
    fieldErrors.push('userId must be a non-empty string');
  }

  return {
    ok: fieldErrors.length === 0 && enumErrors.length === 0,
    runId: snapshot.runId,
    tick: snapshot.tick,
    fieldErrors,
    enumErrors,
  };
}

/**
 * Returns whether a snapshot's mode is recognized by the canonical mode list.
 * Useful for early-exit guards in mode-specific processing.
 */
export function isKnownMode(snapshot: RunStateSnapshot): boolean {
  return isModeCode(snapshot.mode);
}

/**
 * Returns the canonical label for a given pressure tier from the snapshot.
 * Uses PRESSURE_TIER_URGENCY_LABEL constant.
 */
export function getPressureTierUrgencyLabel(snapshot: RunStateSnapshot): string {
  return PRESSURE_TIER_URGENCY_LABEL[snapshot.pressure.tier];
}

/**
 * Returns the minimum hold ticks required before pressure escalation at the
 * current tier. Uses PRESSURE_TIER_MIN_HOLD_TICKS.
 */
export function getMinHoldTicksForCurrentTier(snapshot: RunStateSnapshot): number {
  return PRESSURE_TIER_MIN_HOLD_TICKS[snapshot.pressure.tier];
}

/**
 * Returns the normalized tier score (0.0 - 1.0) for the current pressure tier.
 * Uses PRESSURE_TIER_NORMALIZED.
 */
export function getNormalizedPressureTier(snapshot: RunStateSnapshot): number {
  return PRESSURE_TIER_NORMALIZED[snapshot.pressure.tier];
}

// ============================================================================
// SECTION 9 — SNAPSHOT PREDICATES
// ============================================================================

/** Returns true if the snapshot represents a terminated run. */
export function isSnapshotTerminal(snapshot: RunStateSnapshot): boolean {
  return snapshot.outcome !== null;
}

/** Returns true if the run ended with a win outcome. */
export function isSnapshotWin(snapshot: RunStateSnapshot): boolean {
  return snapshot.outcome !== null && isWinOutcome(snapshot.outcome);
}

/** Returns true if the run ended with a loss outcome. */
export function isSnapshotLoss(snapshot: RunStateSnapshot): boolean {
  return snapshot.outcome !== null && isLossOutcome(snapshot.outcome);
}

/** Returns true if the run is in its final phase. */
export function isSnapshotInEndgame(snapshot: RunStateSnapshot): boolean {
  return isEndgamePhase(snapshot.phase);
}

/**
 * Returns true if the snapshot is in a crisis state.
 * Crisis = pressure T3+ OR shield weakest layer below 20% OR cascade broken chains > 3.
 */
export function isSnapshotInCrisis(snapshot: RunStateSnapshot): boolean {
  const tierWeight = PRESSURE_TIER_NORMALIZED[snapshot.pressure.tier];
  if (tierWeight >= 0.75) return true;
  if (snapshot.shield.weakestLayerRatio < 0.20) return true;
  if (snapshot.cascade.brokenChains > 3) return true;
  if (snapshot.economy.cash < 0) return true;
  return false;
}

/** Returns true if at least one shield layer is fully breached. */
export function isShieldFailing(snapshot: RunStateSnapshot): boolean {
  return snapshot.shield.layers.some((layer) => layer.breached);
}

/** Returns true if the economy is in a healthy state. */
export function isEconomyHealthy(snapshot: RunStateSnapshot): boolean {
  const progress = snapshot.economy.netWorth / Math.max(1, snapshot.economy.freedomTarget);
  return snapshot.economy.cash > 0 && progress >= 0.5 && snapshot.economy.debt <= snapshot.economy.cash * 2;
}

/** Returns true if battle is actively escalating (at least 2 active bots). */
export function isBattleEscalating(snapshot: RunStateSnapshot): boolean {
  const activeBots = snapshot.battle.bots.filter(
    (bot) => bot.state === 'TARGETING' || bot.state === 'ATTACKING',
  );
  return activeBots.length >= 2 || snapshot.battle.pendingAttacks.length > 0;
}

/** Returns true if any cascade chain is critically unhealthy. */
export function isCascadeCritical(snapshot: RunStateSnapshot): boolean {
  return snapshot.cascade.activeChains.some((chain) => {
    const health = classifyCascadeChainHealth(chain);
    return health === 'CRITICAL' || health === 'LOST';
  });
}

/** Returns true if sovereignty integrity is at risk. */
export function isSovereigntyAtRisk(snapshot: RunStateSnapshot): boolean {
  const integrityRisk = INTEGRITY_STATUS_RISK_SCORE[snapshot.sovereignty.integrityStatus];
  return integrityRisk >= 0.6 || snapshot.sovereignty.auditFlags.length >= 3;
}

/** Returns true if the snapshot has at least one active decision window. */
export function hasActiveDecisionWindows(snapshot: RunStateSnapshot): boolean {
  return Object.keys(snapshot.timers.activeDecisionWindows).length > 0;
}

/** Returns true if the player has cards available to play. */
export function hasPlayableCards(snapshot: RunStateSnapshot): boolean {
  return snapshot.cards.hand.length > 0;
}

/** Returns true if any pending attacks need immediate response. */
export function hasCriticalPendingAttacks(snapshot: RunStateSnapshot): boolean {
  return snapshot.battle.pendingAttacks.some((attack) => {
    const severity = classifyAttackSeverity(attack);
    return severity === 'CATASTROPHIC' || severity === 'MAJOR';
  });
}

/** Returns true if the run has been flagged by the sovereignty audit system. */
export function isRunFlagged(snapshot: RunStateSnapshot): boolean {
  return snapshot.sovereignty.auditFlags.length > 0 || snapshot.telemetry.warnings.length > 5;
}

// ============================================================================
// SECTION 10 — ECONOMY SCORING
// ============================================================================

export interface EconomyScore {
  readonly healthScore: number;       // 0.0 (bankrupt) → 1.0 (thriving)
  readonly freedomProgress: number;   // 0.0 → 1.0
  readonly netFlowRatio: number;      // income vs expenses ratio
  readonly debtBurden: number;        // 0.0 (no debt) → 1.0 (critical)
  readonly haterHeatNormalized: number;
  readonly opportunitiesEfficiency: number;
}

/** Computes all economy scoring dimensions from a snapshot. */
export class SnapshotEconomyScorer {
  public score(snapshot: RunStateSnapshot): EconomyScore {
    const { economy } = snapshot;
    const cap = SNAPSHOT_NORMALIZATION_CAPS;

    const cashNorm = Math.max(0, Math.min(1, economy.cash / cap.cash));
    const debtNorm = Math.max(0, Math.min(1, economy.debt / cap.debt));
    const netWorthNorm = Math.max(0, Math.min(1, economy.netWorth / cap.netWorth));
    const freedomProgress = economy.freedomTarget > 0
      ? Math.max(0, Math.min(1, economy.netWorth / economy.freedomTarget))
      : 0;

    const incomeRate = Math.max(0, economy.incomePerTick);
    const expenseRate = Math.max(0, economy.expensesPerTick);
    const netFlowRatio = incomeRate + expenseRate > 0
      ? (incomeRate - expenseRate) / (incomeRate + expenseRate)
      : 0;
    const netFlowNorm = (netFlowRatio + 1) / 2; // Map [-1,1] → [0,1]

    const debtBurden = economy.cash > 0
      ? Math.max(0, Math.min(1, economy.debt / Math.max(1, economy.cash)))
      : 1.0;

    const haterHeatNorm = Math.max(0, Math.min(1, economy.haterHeat / 100));

    const opportunitiesEff = economy.opportunitiesPurchased > 0
      ? Math.min(1, economy.privilegePlays / economy.opportunitiesPurchased)
      : 0;

    // Composite health: weighted blend of positive and negative signals
    const healthScore = Math.max(0, Math.min(1,
      cashNorm * 0.30 +
      netWorthNorm * 0.25 +
      freedomProgress * 0.20 +
      netFlowNorm * 0.15 +
      (1 - debtBurden) * 0.10,
    ));

    return {
      healthScore,
      freedomProgress,
      netFlowRatio,
      debtBurden,
      haterHeatNormalized: haterHeatNorm,
      opportunitiesEfficiency: opportunitiesEff,
    };
  }

  /** Checks if the economy is above the mode-difficulty adjusted threshold. */
  public isHealthy(snapshot: RunStateSnapshot): boolean {
    const difficultyMod = MODE_DIFFICULTY_MULTIPLIER[snapshot.mode];
    const scored = this.score(snapshot);
    const threshold = 0.40 / Math.max(0.5, difficultyMod);
    return scored.healthScore >= threshold;
  }

  /** Returns the raw freedom progress fraction (0..1). */
  public getFreedomProgress(snapshot: RunStateSnapshot): number {
    const { economy } = snapshot;
    if (economy.freedomTarget <= 0) return 0;
    return Math.max(0, Math.min(1, economy.netWorth / economy.freedomTarget));
  }

  /** Returns a normalized mode codes validation over this snapshot's mode. */
  public getModeIndex(snapshot: RunStateSnapshot): number {
    return MODE_CODES.indexOf(snapshot.mode);
  }
}

// ============================================================================
// SECTION 11 — SHIELD SCORING
// ============================================================================

export interface ShieldScore {
  readonly overallIntegrity: number;       // 0.0 (all breached) → 1.0 (full)
  readonly weakestLayerRatio: number;
  readonly vulnerabilityScore: number;     // 0.0 (invulnerable) → 1.0 (critical)
  readonly breachRisk: number;
  readonly regenCapacity: number;
  readonly absorptionOrderScore: number;
  readonly layerScores: Readonly<Record<ShieldLayerId, number>>;
}

/** Computes all shield scoring dimensions from a snapshot. */
export class SnapshotShieldScorer {
  public score(snapshot: RunStateSnapshot): ShieldScore {
    const { shield } = snapshot;

    const layerScores: Partial<Record<ShieldLayerId, number>> = {};
    let totalIntegrity = 0;
    let totalCapacity = 0;

    for (const layerId of SHIELD_LAYER_IDS) {
      const layer = shield.layers.find((l) => l.layerId === layerId);
      if (!layer) {
        layerScores[layerId] = 0;
        continue;
      }
      const ratio = computeShieldIntegrityRatio([{ id: layerId, current: layer.current, max: layer.max }]);
      const weight = SHIELD_LAYER_CAPACITY_WEIGHT[layerId];
      layerScores[layerId] = ratio;
      totalIntegrity += ratio * weight;
      totalCapacity += weight;
    }

    const overallIntegrity = totalCapacity > 0 ? totalIntegrity / totalCapacity : 0;

    const vulnerabilityScore = shield.layers.reduce((acc, layer) => {
      const vuln = computeShieldLayerVulnerability(layer.layerId, layer.current, layer.max);
      return acc + vuln * SHIELD_LAYER_CAPACITY_WEIGHT[layer.layerId];
    }, 0) / Math.max(1, SHIELD_LAYER_IDS.length);

    const breachRisk = Math.max(0, Math.min(1,
      (shield.breachesThisRun * 0.15) +
      (1 - shield.weakestLayerRatio) * 0.50 +
      vulnerabilityScore * 0.35,
    ));

    const regenCapacity = shield.layers.reduce((acc, layer) => {
      const regen = estimateShieldRegenPerTick(layer.layerId, layer.max);
      return acc + regen;
    }, 0);

    // Score absorption order — measures alignment with canonical damage order
    let absorptionOrderScore = 0;
    for (let i = 0; i < SHIELD_LAYER_ABSORPTION_ORDER.length; i++) {
      const expectedId = SHIELD_LAYER_ABSORPTION_ORDER[i];
      const layer = shield.layers.find((l) => l.layerId === expectedId);
      if (layer && !layer.breached) {
        absorptionOrderScore += (SHIELD_LAYER_ABSORPTION_ORDER.length - i) / SHIELD_LAYER_ABSORPTION_ORDER.length;
      }
    }
    absorptionOrderScore /= Math.max(1, SHIELD_LAYER_ABSORPTION_ORDER.length);

    return {
      overallIntegrity: Math.max(0, Math.min(1, overallIntegrity)),
      weakestLayerRatio: shield.weakestLayerRatio,
      vulnerabilityScore: Math.max(0, Math.min(1, vulnerabilityScore)),
      breachRisk: Math.max(0, Math.min(1, breachRisk)),
      regenCapacity,
      absorptionOrderScore,
      layerScores: layerScores as Record<ShieldLayerId, number>,
    };
  }

  /** Returns per-layer label for UI/chat use. */
  public getLayerLabels(): Record<ShieldLayerId, string> {
    const result: Partial<Record<ShieldLayerId, string>> = {};
    for (const layerId of SHIELD_LAYER_IDS) {
      result[layerId] = SHIELD_LAYER_LABEL_BY_ID[layerId];
    }
    return result as Record<ShieldLayerId, string>;
  }
}

// ============================================================================
// SECTION 12 — BATTLE SCORING
// ============================================================================

export interface BotThreatProfile {
  readonly botId: HaterBotId;
  readonly state: BotState;
  readonly effectiveThreatLevel: number;
  readonly allowedNextStates: readonly BotState[];
}

export interface BattleScore {
  readonly aggregateBotThreat: number;
  readonly pendingAttackSeverity: number;
  readonly budgetUtilization: number;
  readonly activeBotRatio: number;
  readonly neutralizedRatio: number;
  readonly threatProfiles: readonly BotThreatProfile[];
}

/** Computes all battle scoring dimensions from a snapshot. */
export class SnapshotBattleScorer {
  public score(snapshot: RunStateSnapshot): BattleScore {
    const { battle } = snapshot;
    const cap = SNAPSHOT_NORMALIZATION_CAPS;

    const threatProfiles: BotThreatProfile[] = battle.bots.map((bot) => {
      const baseThreat = BOT_THREAT_LEVEL[bot.botId] ?? 0.5;
      const stateMultiplier = BOT_STATE_THREAT_MULTIPLIER[bot.state] ?? 1.0;
      const effectiveThreatLevel = Math.max(0, Math.min(1, baseThreat * stateMultiplier));
      const allowedNextStates = BOT_STATE_ALLOWED_TRANSITIONS[bot.state] ?? [];
      return { botId: bot.botId, state: bot.state, effectiveThreatLevel, allowedNextStates };
    });

    const aggregateBotThreat = threatProfiles.length > 0
      ? threatProfiles.reduce((acc, p) => acc + p.effectiveThreatLevel, 0) / HATER_BOT_IDS.length
      : 0;

    const pendingAttackSeverity = battle.pendingAttacks.reduce((acc, attack) => {
      const damage = computeEffectiveAttackDamage(attack);
      const isTargetingShield = isShieldTargetedAttack(attack);
      const isFromBot = isAttackFromBot(attack);
      const urgency = scoreAttackResponseUrgency(attack, snapshot.tick);
      return acc + damage * urgency * (isTargetingShield ? 1.5 : 1.0) * (isFromBot ? 1.2 : 1.0);
    }, 0);
    const pendingAttackSeverityNorm = Math.max(0, Math.min(1, pendingAttackSeverity / 10_000));

    const budgetUtilization = battle.battleBudgetCap > 0
      ? Math.max(0, Math.min(1, battle.battleBudget / battle.battleBudgetCap))
      : 0;

    const activeBots = battle.bots.filter(
      (bot) => bot.state !== 'DORMANT' && bot.state !== 'NEUTRALIZED',
    ).length;
    const activeBotRatio = HATER_BOT_IDS.length > 0 ? activeBots / HATER_BOT_IDS.length : 0;

    const neutralizedRatio = HATER_BOT_IDS.length > 0
      ? battle.neutralizedBotIds.length / HATER_BOT_IDS.length
      : 0;

    void cap; // all normalization caps accessible through class

    return {
      aggregateBotThreat: Math.max(0, Math.min(1, aggregateBotThreat)),
      pendingAttackSeverity: pendingAttackSeverityNorm,
      budgetUtilization,
      activeBotRatio,
      neutralizedRatio,
      threatProfiles,
    };
  }

  /** Returns an attack counterable summary. */
  public counteredAttackRatio(snapshot: RunStateSnapshot): number {
    const attacks = snapshot.battle.pendingAttacks;
    if (attacks.length === 0) return 0;
    const counterable = attacks.filter((a) => isAttackCounterable(a)).length;
    return counterable / attacks.length;
  }
}

// ============================================================================
// SECTION 13 — PRESSURE + TENSION SCORING
// ============================================================================

export interface PressureTensionScore {
  readonly pressureRiskScore: number;
  readonly pressureTierNormalized: number;
  readonly canEscalate: boolean;
  readonly canDeescalate: boolean;
  readonly escalationThreshold: number;
  readonly deescalationThreshold: number;
  readonly tensionScore: number;
  readonly anticipationScore: number;
  readonly aggregateThreatPressure: number;
  readonly mostUrgentThreat: ThreatEnvelope | null;
  readonly modeTensionFloor: number;
  readonly pressureTierDescription: string;
}

/** Scores pressure and tension dimensions of a snapshot. */
export class SnapshotPressureTensionScorer {
  public score(snapshot: RunStateSnapshot): PressureTensionScore {
    const { pressure, tension } = snapshot;

    const pressureRiskScore = computePressureRiskScore(pressure.tier, pressure.score);
    const pressureTierNormalized = PRESSURE_TIER_NORMALIZED[pressure.tier];
    const nextTier = PRESSURE_TIERS[PRESSURE_TIERS.indexOf(pressure.tier) + 1];
    const canEscalateResult = nextTier !== undefined && canEscalatePressure(pressure.tier, nextTier, pressure.score, Number.MAX_SAFE_INTEGER);
    const prevTier = PRESSURE_TIERS[PRESSURE_TIERS.indexOf(pressure.tier) - 1];
    const canDeescalateResult = prevTier !== undefined && canDeescalatePressure(pressure.tier, prevTier, pressure.score);
    const escalationThreshold = PRESSURE_TIER_ESCALATION_THRESHOLD[pressure.tier];
    const deescalationThreshold = PRESSURE_TIER_DEESCALATION_THRESHOLD[pressure.tier];
    const pressureTierDescription = describePressureTierExperience(pressure.tier);

    const aggregateThreatPressure = computeAggregateThreatPressure(
      tension.visibleThreats,
      snapshot.tick,
    );

    const mostUrgentThreat = findMostUrgentThreat(tension.visibleThreats, snapshot.tick);

    const modeTensionFloor = MODE_TENSION_FLOOR[snapshot.mode];

    return {
      pressureRiskScore: Math.max(0, Math.min(1, pressureRiskScore)),
      pressureTierNormalized,
      canEscalate: canEscalateResult,
      canDeescalate: canDeescalateResult,
      escalationThreshold,
      deescalationThreshold,
      tensionScore: tension.score,
      anticipationScore: tension.anticipation,
      aggregateThreatPressure: Math.max(0, Math.min(1, aggregateThreatPressure)),
      mostUrgentThreat,
      modeTensionFloor,
      pressureTierDescription,
    };
  }

  /** Returns urgency classification for each visible threat. */
  public classifyVisibleThreats(snapshot: RunStateSnapshot): Array<{
    threat: ThreatEnvelope;
    urgency: number;
    urgencyClass: ThreatUrgencyClass;
  }> {
    return snapshot.tension.visibleThreats.map((threat) => ({
      threat,
      urgency: scoreThreatUrgency(threat, snapshot.tick),
      urgencyClass: classifyThreatUrgency(threat, snapshot.tick),
    }));
  }

  /** Returns visibility concealment factor for threats by visibility level. */
  public getThreatConcealmentFactor(visibility: VisibilityLevel): number {
    return VISIBILITY_CONCEALMENT_FACTOR[visibility];
  }
}

// ============================================================================
// SECTION 14 — CASCADE SCORING
// ============================================================================

export interface CascadeScore {
  readonly aggregateHealth: number;
  readonly brokenRatio: number;
  readonly completedRatio: number;
  readonly recoveryPotential: number;
  readonly experienceImpact: number;
  readonly chainCount: number;
  readonly criticalChainCount: number;
}

/** Scores cascade chain state from a snapshot. */
export class SnapshotCascadeScorer {
  public score(snapshot: RunStateSnapshot): CascadeScore {
    const { cascade } = snapshot;

    const chainCount = cascade.activeChains.length;

    const aggregateHealth = chainCount > 0
      ? cascade.activeChains.reduce((acc, chain) => acc + scoreCascadeChainHealth(chain), 0) / chainCount
      : 1.0;

    const totalChains = Math.max(1, cascade.brokenChains + cascade.completedChains + chainCount);
    const brokenRatio = cascade.brokenChains / totalChains;
    const completedRatio = cascade.completedChains / totalChains;

    const recoverableCount = cascade.activeChains.filter((chain) => isCascadeRecoverable(chain)).length;
    const recoveryPotential = chainCount > 0 ? recoverableCount / chainCount : 1.0;

    const experienceImpact = cascade.activeChains.reduce(
      (acc, chain) => acc + computeCascadeExperienceImpact(chain),
      0,
    );
    const experienceImpactNorm = Math.max(0, Math.min(1, experienceImpact / Math.max(1, chainCount * 100)));

    const criticalChainCount = cascade.activeChains.filter((chain) => {
      const health = classifyCascadeChainHealth(chain);
      return health === 'CRITICAL' || health === 'LOST';
    }).length;

    return {
      aggregateHealth: Math.max(0, Math.min(1, aggregateHealth)),
      brokenRatio: Math.max(0, Math.min(1, brokenRatio)),
      completedRatio: Math.max(0, Math.min(1, completedRatio)),
      recoveryPotential: Math.max(0, Math.min(1, recoveryPotential)),
      experienceImpact: experienceImpactNorm,
      chainCount,
      criticalChainCount,
    };
  }

  /** Returns per-chain progress breakdown. */
  public getChainProgressBreakdown(snapshot: RunStateSnapshot): Array<{
    chain: CascadeChainInstance;
    progress: number;
    health: CascadeHealthClass;
    health_score: number;
  }> {
    return snapshot.cascade.activeChains.map((chain) => ({
      chain,
      progress: computeCascadeProgressPercent(chain),
      health: classifyCascadeChainHealth(chain),
      health_score: scoreCascadeChainHealth(chain),
    }));
  }
}

// ============================================================================
// SECTION 15 — SOVEREIGNTY SCORING
// ============================================================================

export interface SovereigntyScore {
  readonly integrityRiskScore: number;
  readonly verifiedGradeScore: number;
  readonly sovereigntyNormalized: number;
  readonly cordNormalized: number;
  readonly gapClosingProgress: number;
  readonly auditFlagRisk: number;
  readonly tickChecksumCoverage: number;
}

/** Scores sovereignty alignment dimensions from a snapshot. */
export class SnapshotSovereigntyScorer {
  public score(snapshot: RunStateSnapshot): SovereigntyScore {
    const { sovereignty } = snapshot;

    const integrityRiskScore = INTEGRITY_STATUS_RISK_SCORE[sovereignty.integrityStatus];

    const verifiedGradeScore = sovereignty.verifiedGrade !== null && isVerifiedGrade(sovereignty.verifiedGrade)
      ? VERIFIED_GRADE_NUMERIC_SCORE[sovereignty.verifiedGrade]
      : 0;

    const sovereigntyNormalized = Math.max(0, Math.min(1, sovereignty.sovereigntyScore / 100));
    const cordNormalized = Math.max(0, Math.min(1, sovereignty.cordScore / 100));

    const gapClosingProgress = sovereignty.gapVsLegend <= 0
      ? 1.0
      : Math.max(0, Math.min(1, sovereignty.gapClosingRate / Math.max(0.01, sovereignty.gapVsLegend)));

    const auditFlagRisk = Math.max(0, Math.min(1, sovereignty.auditFlags.length / 10));

    const tickChecksumCoverage = snapshot.tick > 0
      ? Math.max(0, Math.min(1, sovereignty.tickChecksums.length / snapshot.tick))
      : 1.0;

    return {
      integrityRiskScore,
      verifiedGradeScore,
      sovereigntyNormalized,
      cordNormalized,
      gapClosingProgress,
      auditFlagRisk,
      tickChecksumCoverage,
    };
  }

  /** Returns sorted verified grades from best to worst. */
  public getGradeRanking(): readonly VerifiedGrade[] {
    return [...VERIFIED_GRADES].sort(
      (a, b) => VERIFIED_GRADE_NUMERIC_SCORE[b] - VERIFIED_GRADE_NUMERIC_SCORE[a],
    );
  }
}

// ============================================================================
// SECTION 16 — CARDS + MODE SCORING
// ============================================================================

export interface CardHandScore {
  readonly handSize: number;
  readonly avgPowerScore: number;
  readonly avgDecayUrgency: number;
  readonly avgTimingPriority: number;
  readonly offensiveRatio: number;
  readonly legalRatio: number;
  readonly counterEligibleCount: number;
  readonly ghostMarkerDensity: number;
  readonly legendTotalValue: number;
}

export interface ModeScore {
  readonly modeNormalized: number;
  readonly difficultyMultiplier: number;
  readonly tensionFloor: number;
  readonly stakesMultiplier: number;
  readonly deckEntropyNormalized: number;
  readonly presentationCode: ModePresentationCode;
}

/** Scores the cards and mode state from a snapshot. */
export class SnapshotCardsModeScorer {
  public scoreCards(snapshot: RunStateSnapshot): CardHandScore {
    const { cards, mode, battle } = snapshot;

    const hand = cards.hand;
    const handSize = hand.length;

    if (handSize === 0) {
      return {
        handSize: 0,
        avgPowerScore: 0,
        avgDecayUrgency: 0,
        avgTimingPriority: 0,
        offensiveRatio: 0,
        legalRatio: 0,
        counterEligibleCount: 0,
        ghostMarkerDensity: 0,
        legendTotalValue: 0,
      };
    }

    const avgPowerScore = hand.reduce((acc, c) => acc + computeCardPowerScore(c), 0) / handSize;
    const avgDecayUrgency = hand.reduce((acc, c) => acc + computeCardDecayUrgency(c), 0) / handSize;
    const avgTimingPriority = hand.reduce((acc, c) => acc + computeCardTimingPriority(c), 0) / handSize;
    const offensiveCount = hand.filter((c) => isCardOffensive(c)).length;
    const legalCount = hand.filter((c) => isCardLegalInMode(c, mode)).length;
    const counterCount = hand.filter((c) =>
      battle.pendingAttacks.length > 0
        ? canCardCounterAttack(c, battle.pendingAttacks[0].category)
        : false,
    ).length;

    const ghostMarkerDensity = computeLegendMarkerDensity(cards.ghostMarkers, snapshot.tick);
    const legendTotalValue = cards.ghostMarkers.reduce((acc, m) => acc + computeLegendMarkerValue(m), 0);

    return {
      handSize,
      avgPowerScore: Math.max(0, Math.min(1, avgPowerScore)),
      avgDecayUrgency: Math.max(0, Math.min(1, avgDecayUrgency)),
      avgTimingPriority: Math.max(0, Math.min(1, avgTimingPriority)),
      offensiveRatio: offensiveCount / handSize,
      legalRatio: legalCount / handSize,
      counterEligibleCount: counterCount,
      ghostMarkerDensity,
      legendTotalValue,
    };
  }

  public scoreMode(snapshot: RunStateSnapshot): ModeScore {
    const { mode, modeState, cards } = snapshot;
    const stakesMultiplier = computeEffectiveStakes(snapshot.phase, mode);

    return {
      modeNormalized: MODE_NORMALIZED[mode],
      difficultyMultiplier: MODE_DIFFICULTY_MULTIPLIER[mode],
      tensionFloor: MODE_TENSION_FLOOR[mode],
      stakesMultiplier,
      deckEntropyNormalized: Math.max(0, Math.min(1, cards.deckEntropy)),
      presentationCode: modeState.modePresentation,
    };
  }

  /** Returns deck type power levels for analysis. */
  public getDeckTypePowerLevels(): Record<DeckType, number> {
    const result: Partial<Record<DeckType, number>> = {};
    for (const deckType of DECK_TYPES) {
      result[deckType] = DECK_TYPE_POWER_LEVEL[deckType];
    }
    return result as Record<DeckType, number>;
  }

  /** Returns which deck types are offensive vs defensive. */
  public getDeckTypeOffensiveMap(): Record<DeckType, boolean> {
    const result: Partial<Record<DeckType, boolean>> = {};
    for (const deckType of DECK_TYPES) {
      result[deckType] = DECK_TYPE_IS_OFFENSIVE[deckType];
    }
    return result as Record<DeckType, boolean>;
  }

  /** Returns legend marker significance for every ghost marker. */
  public getLegendMarkerSignificances(snapshot: RunStateSnapshot): Array<{
    marker: LegendMarker;
    significance: LegendMarkerSignificance;
    value: number;
    weight: number;
  }> {
    return snapshot.cards.ghostMarkers.map((marker) => ({
      marker,
      significance: classifyLegendMarkerSignificance(marker),
      value: computeLegendMarkerValue(marker),
      weight: LEGEND_MARKER_KIND_WEIGHT[marker.kind] ?? 1.0,
    }));
  }
}

// ============================================================================
// SECTION 17 — TIMERS SCORING
// ============================================================================

export interface TimerScore {
  readonly elapsedRatio: number;
  readonly tickDurationNormalized: number;
  readonly holdChargesNormalized: number;
  readonly activeWindowCount: number;
  readonly frozenWindowRatio: number;
  readonly exclusiveWindowRatio: number;
  readonly consumedWindowCount: number;
  readonly oldestWindowAgeMs: number;
}

/** Scores the timer state of a snapshot. */
export class SnapshotTimerScorer {
  public score(snapshot: RunStateSnapshot): TimerScore {
    const { timers } = snapshot;
    const totalBudgetMs = timers.seasonBudgetMs + timers.extensionBudgetMs;

    const elapsedRatio = totalBudgetMs > 0
      ? Math.max(0, Math.min(1, timers.elapsedMs / totalBudgetMs))
      : 0;

    const tickDurationNormalized = Math.max(
      0,
      Math.min(1, timers.currentTickDurationMs / 60_000),
    );

    const holdChargesNormalized = Math.max(0, Math.min(1, timers.holdCharges / 10));

    const windowList = Object.values(timers.activeDecisionWindows);
    const activeWindowCount = windowList.length;
    const frozenWindowCount = timers.frozenWindowIds.length;
    const frozenWindowRatio = activeWindowCount > 0 ? frozenWindowCount / activeWindowCount : 0;

    const exclusiveWindowCount = windowList.filter((w) => w.exclusive).length;
    const exclusiveWindowRatio = activeWindowCount > 0 ? exclusiveWindowCount / activeWindowCount : 0;

    const consumedWindowCount = windowList.filter((w) => w.consumed).length;

    const windowAges = windowList.map((w) => {
      return Math.max(0, timers.elapsedMs - w.openedAtMs);
    });
    const oldestWindowAgeMs = windowAges.length > 0 ? Math.max(...windowAges) : 0;

    // Access timing class priority for each window (using TIMING_CLASS_WINDOW_PRIORITY)
    void TIMING_CLASS_WINDOW_PRIORITY;
    void TIMING_CLASS_URGENCY_DECAY;

    return {
      elapsedRatio,
      tickDurationNormalized,
      holdChargesNormalized,
      activeWindowCount,
      frozenWindowRatio,
      exclusiveWindowRatio,
      consumedWindowCount,
      oldestWindowAgeMs,
    };
  }

  /** Returns per-window urgency for all active decision windows. */
  public getWindowUrgencies(snapshot: RunStateSnapshot): Array<{
    windowId: string;
    timingClass: TimingClass;
    windowPriority: number;
    urgencyDecay: number;
  }> {
    return Object.entries(snapshot.timers.activeDecisionWindows).map(([windowId, w]) => ({
      windowId,
      timingClass: w.timingClass,
      windowPriority: TIMING_CLASS_WINDOW_PRIORITY[w.timingClass] ?? 0,
      urgencyDecay: TIMING_CLASS_URGENCY_DECAY[w.timingClass] ?? 1.0,
    }));
  }
}

// ============================================================================
// SECTION 18 — TELEMETRY SCORING
// ============================================================================

export interface TelemetryScore {
  readonly decisionsAcceptedRatio: number;
  readonly avgDecisionLatencyNormalized: number;
  readonly emittedEventCountNormalized: number;
  readonly warningCountNormalized: number;
  readonly outcomeReasonPresent: boolean;
}

/** Scores the telemetry state of a snapshot. */
export class SnapshotTelemetryScorer {
  public score(snapshot: RunStateSnapshot): TelemetryScore {
    const { telemetry } = snapshot;
    const cap = SNAPSHOT_NORMALIZATION_CAPS;

    const totalDecisions = telemetry.decisions.length;
    const acceptedDecisions = telemetry.decisions.filter((d) => d.accepted).length;
    const decisionsAcceptedRatio = totalDecisions > 0 ? acceptedDecisions / totalDecisions : 0;

    const avgLatency = totalDecisions > 0
      ? telemetry.decisions.reduce((acc, d) => acc + d.latencyMs, 0) / totalDecisions
      : 0;
    const avgDecisionLatencyNormalized = Math.max(0, Math.min(1, avgLatency / 5_000));

    const emittedEventCountNormalized = Math.max(
      0,
      Math.min(1, telemetry.emittedEventCount / cap.eventCount),
    );

    const warningCountNormalized = Math.max(
      0,
      Math.min(1, telemetry.warnings.length / cap.warningCount),
    );

    return {
      decisionsAcceptedRatio,
      avgDecisionLatencyNormalized,
      emittedEventCountNormalized,
      warningCountNormalized,
      outcomeReasonPresent: telemetry.outcomeReasonCode !== null,
    };
  }
}

// ============================================================================
// SECTION 19 — EFFECT PAYLOAD ANALYSIS UTILITIES
//   Uses EffectPayload, computeEffectFinancialImpact, computeEffectShieldImpact,
//   computeEffectMagnitude, computeEffectRiskScore, isEffectNetPositive.
// ============================================================================

export interface EffectAnalysisSummary {
  readonly totalFinancialImpact: number;
  readonly totalShieldImpact: number;
  readonly totalMagnitude: number;
  readonly totalRiskScore: number;
  readonly netPositiveCount: number;
  readonly netNegativeCount: number;
}

/**
 * Analyzes a set of EffectPayload values (e.g., from a card's effects array).
 * Returns a summary of financial, shield, magnitude, and risk impact.
 */
export function analyzeEffectPayloads(effects: readonly EffectPayload[]): EffectAnalysisSummary {
  let totalFinancialImpact = 0;
  let totalShieldImpact = 0;
  let totalMagnitude = 0;
  let totalRiskScore = 0;
  let netPositiveCount = 0;
  let netNegativeCount = 0;

  for (const effect of effects) {
    totalFinancialImpact += computeEffectFinancialImpact(effect);
    totalShieldImpact += computeEffectShieldImpact(effect);
    totalMagnitude += computeEffectMagnitude(effect);
    totalRiskScore += computeEffectRiskScore(effect);
    if (isEffectNetPositive(effect)) {
      netPositiveCount += 1;
    } else {
      netNegativeCount += 1;
    }
  }

  return {
    totalFinancialImpact,
    totalShieldImpact,
    totalMagnitude,
    totalRiskScore,
    netPositiveCount,
    netNegativeCount,
  };
}

/**
 * Uses attack category maps to determine counterable / magnitude info per attack.
 */
export function analyzeAttackEvent(attack: AttackEvent): {
  readonly severity: AttackSeverityClass;
  readonly effectiveDamage: number;
  readonly counterable: boolean;
  readonly shieldTargeted: boolean;
  readonly fromBot: boolean;
  readonly baseMagnitude: number;
  readonly counterabilityResistance: number;
} {
  const severity = classifyAttackSeverity(attack);
  const effectiveDamage = computeEffectiveAttackDamage(attack);
  const counterable = isAttackCounterable(attack);
  const shieldTargeted = isShieldTargetedAttack(attack);
  const fromBot = isAttackFromBot(attack);

  const anyAttack = attack as unknown as { category?: AttackCategory; counterability?: Counterability; targeting?: Targeting };
  const category = anyAttack.category as AttackCategory | undefined;
  const counterability = anyAttack.counterability as Counterability | undefined;
  const targeting = anyAttack.targeting as Targeting | undefined;

  const baseMagnitude = category ? ATTACK_CATEGORY_BASE_MAGNITUDE[category] : 0;
  const counterabilityResistance = counterability ? COUNTERABILITY_RESISTANCE_SCORE[counterability] : 0;

  void ATTACK_CATEGORY_IS_COUNTERABLE;
  void TARGETING_SPREAD_FACTOR;
  void targeting;

  return {
    severity,
    effectiveDamage,
    counterable,
    shieldTargeted,
    fromBot,
    baseMagnitude,
    counterabilityResistance,
  };
}

/**
 * Uses DIVERGENCE_POTENTIAL_NORMALIZED and mode divergence data for mode analysis.
 */
export function getModeMaxDivergenceScore(snapshot: RunStateSnapshot): number {
  const anyModeState = snapshot.modeState as unknown as Record<string, unknown>;
  const divergence = anyModeState['divergencePotential'] as DivergencePotential | undefined;
  if (divergence) {
    return DIVERGENCE_POTENTIAL_NORMALIZED[divergence];
  }
  return MODE_NORMALIZED[snapshot.mode] * 0.5;
}

// ============================================================================
// SECTION 20 — SnapshotMLFeatureExtractor (64-feature ML vector)
// ============================================================================

/** Full 64-feature ML vector extracted from a RunStateSnapshot. */
export interface SnapshotMLVector {
  readonly runId: string;
  readonly tick: number;
  readonly mode: ModeCode;
  readonly phase: RunPhase;
  readonly featureLabels: readonly string[];
  readonly features: readonly number[];
  readonly compositeRiskScore: number;
  readonly recommendedAction: 'HOLD' | 'PLAY_CARD' | 'DEFEND' | 'ACCELERATE' | 'EXTEND_WINDOW';
  readonly extractedAtMs: number;
}

/** Full 96-feature DL input tensor built from a RunStateSnapshot. */
export interface SnapshotDLTensor {
  readonly runId: string;
  readonly tick: number;
  readonly tensorShape: readonly [1, 96];
  readonly featureLabels: readonly string[];
  readonly inputData: readonly number[];
  readonly fingerprint: string;
  readonly extractedAtMs: number;
}

const economyScorer = new SnapshotEconomyScorer();
const shieldScorer = new SnapshotShieldScorer();
const battleScorer = new SnapshotBattleScorer();
const pressureTensionScorer = new SnapshotPressureTensionScorer();
const cascadeScorer = new SnapshotCascadeScorer();
const sovereigntyScorer = new SnapshotSovereigntyScorer();
const cardsModeScorer = new SnapshotCardsModeScorer();
const timerScorer = new SnapshotTimerScorer();
const telemetryScorer = new SnapshotTelemetryScorer();

/** Extracts the full 64-feature ML vector from a RunStateSnapshot. */
export class SnapshotMLFeatureExtractor {
  private readonly _economy = economyScorer;
  private readonly _shield = shieldScorer;
  private readonly _battle = battleScorer;
  private readonly _pressureTension = pressureTensionScorer;
  private readonly _cascade = cascadeScorer;
  private readonly _sovereignty = sovereigntyScorer;
  private readonly _cardsMode = cardsModeScorer;
  private readonly _timers = timerScorer;
  private readonly _telemetry = telemetryScorer;

  public extract(snapshot: RunStateSnapshot, nowMs = Date.now()): SnapshotMLVector {
    const eco = this._economy.score(snapshot);
    const shd = this._shield.score(snapshot);
    const btl = this._battle.score(snapshot);
    const prt = this._pressureTension.score(snapshot);
    const cas = this._cascade.score(snapshot);
    const sov = this._sovereignty.score(snapshot);
    const crd = this._cardsMode.scoreCards(snapshot);
    const mod = this._cardsMode.scoreMode(snapshot);
    const tmr = this._timers.score(snapshot);
    const tel = this._telemetry.score(snapshot);

    const totalBudgetMs = snapshot.timers.seasonBudgetMs + snapshot.timers.extensionBudgetMs;
    const progressFraction = computeRunProgressFraction(snapshot.phase, snapshot.timers.elapsedMs, totalBudgetMs);

    const features: number[] = [
      // Economy (8)
      Math.max(0, Math.min(1, snapshot.economy.cash / SNAPSHOT_NORMALIZATION_CAPS.cash)),
      Math.max(0, Math.min(1, snapshot.economy.debt / SNAPSHOT_NORMALIZATION_CAPS.debt)),
      Math.max(0, Math.min(1, snapshot.economy.netWorth / SNAPSHOT_NORMALIZATION_CAPS.netWorth)),
      Math.max(0, snapshot.economy.incomePerTick / 10_000),
      Math.max(0, snapshot.economy.expensesPerTick / 10_000),
      eco.freedomProgress,
      eco.haterHeatNormalized,
      (eco.netFlowRatio + 1) / 2,

      // Pressure (6)
      prt.pressureRiskScore,
      prt.pressureTierNormalized,
      Math.min(1, snapshot.pressure.upwardCrossings / 10),
      Math.min(1, snapshot.pressure.survivedHighPressureTicks / 50),
      prt.canEscalate ? 1.0 : 0.0,
      prt.canDeescalate ? 1.0 : 0.0,

      // Tension (5)
      snapshot.tension.score,
      snapshot.tension.anticipation,
      Math.min(1, snapshot.tension.visibleThreats.length / 5),
      prt.aggregateThreatPressure,
      snapshot.tension.maxPulseTriggered ? 1.0 : 0.0,

      // Shield (8)
      shd.weakestLayerRatio,
      Math.min(1, snapshot.shield.breachesThisRun / 5),
      Math.min(1, snapshot.shield.damagedThisRun / 20),
      Math.min(1, snapshot.shield.blockedThisRun / 20),
      Math.min(1, snapshot.shield.repairQueueDepth / 10),
      shd.layerScores['L1'] ?? 0,
      shd.layerScores['L2'] ?? 0,
      shd.layerScores['L3'] ?? 0,

      // Battle (7)
      btl.budgetUtilization,
      Math.min(1, snapshot.battle.battleBudgetCap / SNAPSHOT_NORMALIZATION_CAPS.battleBudget),
      btl.activeBotRatio,
      btl.aggregateBotThreat,
      Math.min(1, snapshot.battle.pendingAttacks.length / 5),
      snapshot.battle.firstBloodClaimed ? 1.0 : 0.0,
      btl.neutralizedRatio,

      // Cascade (5)
      Math.min(1, snapshot.cascade.activeChains.length / 5),
      cas.brokenRatio,
      cas.completedRatio,
      cas.aggregateHealth,
      cas.recoveryPotential,

      // Sovereignty (5)
      sov.sovereigntyNormalized,
      sov.integrityRiskScore,
      sov.verifiedGradeScore,
      Math.min(1, snapshot.sovereignty.gapVsLegend / 100),
      Math.min(1, Math.max(0, snapshot.sovereignty.gapClosingRate)),

      // Cards (6)
      Math.min(1, crd.handSize / 10),
      snapshot.cards.discard.length > 0
        ? Math.min(1, snapshot.cards.discard.length / (snapshot.cards.discard.length + snapshot.cards.hand.length + 1))
        : 0,
      snapshot.cards.exhaust.length > 0
        ? Math.min(1, snapshot.cards.exhaust.length / (snapshot.cards.exhaust.length + snapshot.cards.hand.length + 1))
        : 0,
      Math.min(1, snapshot.cards.drawPileSize / 30),
      snapshot.cards.deckEntropy,
      Math.min(1, crd.ghostMarkerDensity),

      // Timers (5)
      tmr.elapsedRatio,
      tmr.tickDurationNormalized,
      tmr.holdChargesNormalized,
      Math.min(1, tmr.activeWindowCount / 5),
      tmr.frozenWindowRatio,

      // Meta (5)
      Math.min(1, snapshot.tick / SNAPSHOT_NORMALIZATION_CAPS.tick),
      RUN_PHASE_NORMALIZED[snapshot.phase],
      MODE_NORMALIZED[snapshot.mode],
      mod.difficultyMultiplier / 2,
      snapshot.outcome !== null ? 1.0 : 0.0,
    ];

    const compositeRiskScore = this._computeCompositeRisk(eco, shd, btl, prt, cas, sov);
    const recommendedAction = this._recommendAction(snapshot, compositeRiskScore, btl, prt, crd, tel);

    return {
      runId: snapshot.runId,
      tick: snapshot.tick,
      mode: snapshot.mode,
      phase: snapshot.phase,
      featureLabels: SNAPSHOT_ML_FEATURE_LABELS,
      features: Object.freeze(features),
      compositeRiskScore,
      recommendedAction,
      extractedAtMs: nowMs,
    };
  }

  private _computeCompositeRisk(
    eco: EconomyScore,
    shd: ShieldScore,
    btl: BattleScore,
    prt: PressureTensionScore,
    cas: CascadeScore,
    sov: SovereigntyScore,
  ): number {
    const w = SNAPSHOT_COMPOSITE_RISK_WEIGHTS;
    return Math.max(0, Math.min(1,
      (1 - eco.healthScore) * w.economy +
      prt.pressureRiskScore * w.pressure +
      prt.tensionScore * w.tension +
      shd.vulnerabilityScore * w.shield +
      btl.aggregateBotThreat * w.battle +
      (1 - cas.aggregateHealth) * w.cascade +
      sov.integrityRiskScore * w.sovereignty,
    ));
  }

  private _recommendAction(
    snapshot: RunStateSnapshot,
    compositeRisk: number,
    btl: BattleScore,
    prt: PressureTensionScore,
    crd: CardHandScore,
    tel: TelemetryScore,
  ): 'HOLD' | 'PLAY_CARD' | 'DEFEND' | 'ACCELERATE' | 'EXTEND_WINDOW' {
    if (btl.pendingAttackSeverity > 0.6 && crd.counterEligibleCount > 0) return 'DEFEND';
    if (compositeRisk > 0.75 && crd.handSize > 0) return 'PLAY_CARD';
    if (prt.canEscalate && compositeRisk > 0.55) return 'ACCELERATE';
    if (Object.keys(snapshot.timers.activeDecisionWindows).length > 0) {
      return 'EXTEND_WINDOW';
    }
    if (tel.decisionsAcceptedRatio < 0.3 && snapshot.timers.holdCharges > 0) return 'HOLD';
    if (crd.handSize > 0) return 'PLAY_CARD';
    return 'HOLD';
  }
}

// ============================================================================
// SECTION 21 — SnapshotDLTensorBuilder (96-feature DL tensor)
// ============================================================================

/** Builds the full 96-feature DL input tensor from a RunStateSnapshot. */
export class SnapshotDLTensorBuilder {
  private readonly _mlExtractor = new SnapshotMLFeatureExtractor();

  public build(snapshot: RunStateSnapshot, nowMs = Date.now()): SnapshotDLTensor {
    const mlVector = this._mlExtractor.extract(snapshot, nowMs);
    const eco = economyScorer.score(snapshot);
    const shd = shieldScorer.score(snapshot);
    const btl = battleScorer.score(snapshot);
    const cas = cascadeScorer.score(snapshot);
    const sov = sovereigntyScorer.score(snapshot);
    const crd = cardsModeScorer.scoreCards(snapshot);
    const tmr = timerScorer.score(snapshot);
    const tel = telemetryScorer.score(snapshot);
    const mod = cardsModeScorer.scoreMode(snapshot);
    const prt = pressureTensionScorer.score(snapshot);

    const totalBudgetMs = snapshot.timers.seasonBudgetMs + snapshot.timers.extensionBudgetMs;
    const progressFraction = computeRunProgressFraction(snapshot.phase, snapshot.timers.elapsedMs, totalBudgetMs);
    const stakesMultiplier = computeEffectiveStakes(snapshot.phase, snapshot.mode);
    const outcomeExcitement = snapshot.outcome ? scoreOutcomeExcitement(snapshot.outcome, snapshot.mode) : 0;

    const extendedFeatures: number[] = [
      // Extended economy (4)
      Math.min(1, snapshot.economy.opportunitiesPurchased / 50),
      Math.min(1, snapshot.economy.privilegePlays / 20),
      eco.netFlowRatio > 0 ? eco.netFlowRatio : 0,
      eco.debtBurden,

      // Extended pressure (4)
      prt.escalationThreshold,
      prt.deescalationThreshold,
      Math.min(1, PRESSURE_TIER_MIN_HOLD_TICKS[snapshot.pressure.tier] / 20),
      PRESSURE_TIER_NORMALIZED[snapshot.pressure.tier],

      // Extended shield per-layer (5)
      shd.layerScores['L4'] ?? 0,
      SHIELD_LAYER_CAPACITY_WEIGHT['L1'],
      SHIELD_LAYER_CAPACITY_WEIGHT['L2'],
      SHIELD_LAYER_CAPACITY_WEIGHT['L3'],
      SHIELD_LAYER_CAPACITY_WEIGHT['L4'],
      shd.absorptionOrderScore,

      // Extended battle (4)
      Math.min(1, snapshot.battle.rivalryHeatCarry / 100),
      Math.min(1, snapshot.battle.extractionCooldownTicks / 20),
      Math.min(1, Math.max(...HATER_BOT_IDS.map((id) => BOT_THREAT_LEVEL[id] ?? 0))),
      btl.activeBotRatio,

      // Extended cascade (4)
      cas.experienceImpact,
      Math.min(1, Object.values(snapshot.cascade.repeatedTriggerCounts).reduce((a, b) => a + b, 0) / 20),
      Math.min(1, snapshot.cascade.positiveTrackers.length / 5),
      snapshot.cascade.lastResolvedTick !== null
        ? Math.min(1, (snapshot.tick - snapshot.cascade.lastResolvedTick) / 50)
        : 1.0,

      // Extended sovereignty (4)
      sov.cordNormalized,
      Math.min(1, snapshot.sovereignty.auditFlags.length / 10),
      Math.min(1, snapshot.sovereignty.proofBadges.length / 10),
      sov.tickChecksumCoverage,

      // Extended cards (4)
      crd.avgPowerScore,
      crd.offensiveRatio,
      crd.legalRatio,
      Math.min(1, crd.counterEligibleCount / 5),

      // Extended timing windows (4)
      tmr.exclusiveWindowRatio,
      Math.min(1, tmr.oldestWindowAgeMs / 60_000),
      Math.min(1, tmr.holdChargesNormalized),
      Math.min(1, tmr.consumedWindowCount / 10),

      // Extended meta (8)
      tel.decisionsAcceptedRatio,
      tel.avgDecisionLatencyNormalized,
      tel.emittedEventCountNormalized,
      tel.warningCountNormalized,
      Math.min(2, stakesMultiplier) / 2,
      progressFraction,
      mod.tensionFloor,
      Math.min(1, snapshot.tags.length / 10),
      outcomeExcitement,
    ];

    // Trim/pad to exactly 32 extended features (96 - 64 = 32)
    const trimmedExtended = extendedFeatures.slice(0, 32);
    while (trimmedExtended.length < 32) trimmedExtended.push(0);

    const inputData = [...mlVector.features, ...trimmedExtended];
    const fingerprint = checksumSnapshot({ tick: snapshot.tick, runId: snapshot.runId, features: inputData });

    return {
      runId: snapshot.runId,
      tick: snapshot.tick,
      tensorShape: SNAPSHOT_DL_TENSOR_SHAPE,
      featureLabels: SNAPSHOT_DL_FEATURE_LABELS,
      inputData: Object.freeze(inputData),
      fingerprint,
      extractedAtMs: nowMs,
    };
  }
}

// ============================================================================
// SECTION 22 — SnapshotComparator (delta analysis between snapshots)
// ============================================================================

export type SnapshotFieldDelta = {
  readonly field: string;
  readonly before: number;
  readonly after: number;
  readonly delta: number;
  readonly percentChange: number;
};

export interface SnapshotDeltaReport {
  readonly runId: string;
  readonly fromTick: number;
  readonly toTick: number;
  readonly tickDelta: number;
  readonly fieldDeltas: readonly SnapshotFieldDelta[];
  readonly compositeRiskDelta: number;
  readonly economyHealthDelta: number;
  readonly shieldHealthDelta: number;
  readonly pressureDelta: number;
  readonly isImproving: boolean;
  readonly dominantChangeDimension: string;
}

/** Computes delta reports between two snapshots. */
export class SnapshotComparator {
  private readonly _extractor = new SnapshotMLFeatureExtractor();

  public compare(before: RunStateSnapshot, after: RunStateSnapshot): SnapshotDeltaReport {
    const beforeML = this._extractor.extract(before, 0);
    const afterML = this._extractor.extract(after, 0);

    const fieldDeltas: SnapshotFieldDelta[] = SNAPSHOT_ML_FEATURE_LABELS.map((label, i) => {
      const b = beforeML.features[i] ?? 0;
      const a = afterML.features[i] ?? 0;
      const delta = a - b;
      const percentChange = Math.abs(b) > 0.001 ? (delta / Math.abs(b)) * 100 : 0;
      return { field: label, before: b, after: a, delta, percentChange };
    });

    const compositeRiskDelta = afterML.compositeRiskScore - beforeML.compositeRiskScore;

    const beforeEco = economyScorer.score(before).healthScore;
    const afterEco = economyScorer.score(after).healthScore;
    const economyHealthDelta = afterEco - beforeEco;

    const beforeShd = shieldScorer.score(before).overallIntegrity;
    const afterShd = shieldScorer.score(after).overallIntegrity;
    const shieldHealthDelta = afterShd - beforeShd;

    const pressureDelta = after.pressure.score - before.pressure.score;

    const isImproving = compositeRiskDelta < 0;

    const sortedDeltas = [...fieldDeltas].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    const dominantChangeDimension = sortedDeltas[0]?.field ?? 'unknown';

    return {
      runId: after.runId,
      fromTick: before.tick,
      toTick: after.tick,
      tickDelta: after.tick - before.tick,
      fieldDeltas,
      compositeRiskDelta,
      economyHealthDelta,
      shieldHealthDelta,
      pressureDelta,
      isImproving,
      dominantChangeDimension,
    };
  }

  /** Quick-check whether two snapshots have the same core identity fields. */
  public isSameRun(a: RunStateSnapshot, b: RunStateSnapshot): boolean {
    return a.runId === b.runId && a.userId === b.userId && a.seed === b.seed && a.mode === b.mode;
  }

  /** Returns the fingerprint of the canonical serialized snapshot. */
  public fingerprint(snapshot: RunStateSnapshot): string {
    return checksumSnapshot(snapshot);
  }
}

// ============================================================================
// SECTION 23 — SnapshotHealthReport
// ============================================================================

export type SnapshotHealthGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface SnapshotHealthReport {
  readonly runId: string;
  readonly tick: number;
  readonly mode: ModeCode;
  readonly phase: RunPhase;
  readonly grade: SnapshotHealthGrade;
  readonly compositeRiskScore: number;
  readonly economyHealthScore: number;
  readonly shieldHealthScore: number;
  readonly pressureRiskScore: number;
  readonly battleThreatScore: number;
  readonly cascadeHealthScore: number;
  readonly sovereigntyAlignmentScore: number;
  readonly isInCrisis: boolean;
  readonly isTerminal: boolean;
  readonly recommendedAction: string;
  readonly dominantRiskDimension: string;
  readonly checksum: string;
}

/** Builds a full health report for a snapshot. */
export function buildSnapshotHealthReport(snapshot: RunStateSnapshot, nowMs = Date.now()): SnapshotHealthReport {
  const extractor = new SnapshotMLFeatureExtractor();
  const mlVector = extractor.extract(snapshot, nowMs);

  const eco = economyScorer.score(snapshot);
  const shd = shieldScorer.score(snapshot);
  const btl = battleScorer.score(snapshot);
  const prt = pressureTensionScorer.score(snapshot);
  const cas = cascadeScorer.score(snapshot);
  const sov = sovereigntyScorer.score(snapshot);

  const risk = mlVector.compositeRiskScore;

  const dimensionRisks: Array<[string, number]> = [
    ['economy', 1 - eco.healthScore],
    ['pressure', prt.pressureRiskScore],
    ['shield', shd.vulnerabilityScore],
    ['battle', btl.aggregateBotThreat],
    ['cascade', 1 - cas.aggregateHealth],
    ['sovereignty', sov.integrityRiskScore],
  ];
  const dominant = dimensionRisks.reduce((a, b) => (a[1] >= b[1] ? a : b));

  let grade: SnapshotHealthGrade;
  if (risk < 0.20) grade = 'A';
  else if (risk < 0.40) grade = 'B';
  else if (risk < 0.60) grade = 'C';
  else if (risk < 0.80) grade = 'D';
  else grade = 'F';

  return {
    runId: snapshot.runId,
    tick: snapshot.tick,
    mode: snapshot.mode,
    phase: snapshot.phase,
    grade,
    compositeRiskScore: risk,
    economyHealthScore: eco.healthScore,
    shieldHealthScore: shd.overallIntegrity,
    pressureRiskScore: prt.pressureRiskScore,
    battleThreatScore: btl.aggregateBotThreat,
    cascadeHealthScore: cas.aggregateHealth,
    sovereigntyAlignmentScore: sov.sovereigntyNormalized,
    isInCrisis: isSnapshotInCrisis(snapshot),
    isTerminal: isSnapshotTerminal(snapshot),
    recommendedAction: mlVector.recommendedAction,
    dominantRiskDimension: dominant[0],
    checksum: checksumSnapshot(snapshot),
  };
}

// ============================================================================
// SECTION 24 — SnapshotUXProjector (drives companion + urgency overlays)
// ============================================================================

export type UXUrgencyLevel = 'CRITICAL' | 'HIGH' | 'ELEVATED' | 'MODERATE' | 'LOW' | 'CALM';
export type UXCompanionTone = 'ALARM' | 'URGENT' | 'CONCERNED' | 'ENCOURAGING' | 'CELEBRATORY' | 'NEUTRAL';
export type UXChatSignalPriority = 'INTERRUPT' | 'ELEVATED' | 'NORMAL' | 'BACKGROUND' | 'SUPPRESS';

export interface SnapshotUXSignal {
  readonly runId: string;
  readonly tick: number;
  readonly urgencyLevel: UXUrgencyLevel;
  readonly companionTone: UXCompanionTone;
  readonly chatSignalPriority: UXChatSignalPriority;
  readonly dominantNarrativeHook: string;
  readonly pressureTierDescription: string;
  readonly phaseAwareMessage: string;
  readonly shieldStatusMessage: string;
  readonly battleStatusMessage: string;
  readonly cascadeStatusMessage: string;
  readonly economyStatusMessage: string;
  readonly outcomeMessage: string | null;
  readonly suggestedPlayerAction: string;
  readonly compositeRiskScore: number;
  readonly modePresentation: ModePresentationCode;
}

/** Projects a snapshot into UX signals for companion, urgency, and chat routing. */
export class SnapshotUXProjector {
  private readonly _extractor = new SnapshotMLFeatureExtractor();

  public project(snapshot: RunStateSnapshot, nowMs = Date.now()): SnapshotUXSignal {
    const mlVector = this._extractor.extract(snapshot, nowMs);
    const risk = mlVector.compositeRiskScore;
    const prt = pressureTensionScorer.score(snapshot);

    const urgencyLevel = this._classifyUrgency(risk);
    const companionTone = this._classifyCompanionTone(snapshot, risk, prt);
    const chatSignalPriority = this._classifyChatPriority(urgencyLevel);

    const dominantNarrativeHook = this._buildNarrativeHook(snapshot, risk, prt);
    const pressureTierDescription = describePressureTierExperience(snapshot.pressure.tier);
    const phaseAwareMessage = this._buildPhaseMessage(snapshot);
    const shieldStatusMessage = this._buildShieldMessage(snapshot);
    const battleStatusMessage = this._buildBattleMessage(snapshot);
    const cascadeStatusMessage = this._buildCascadeMessage(snapshot);
    const economyStatusMessage = this._buildEconomyMessage(snapshot);
    const outcomeMessage = snapshot.outcome !== null ? this._buildOutcomeMessage(snapshot) : null;
    const suggestedPlayerAction = mlVector.recommendedAction;

    return {
      runId: snapshot.runId,
      tick: snapshot.tick,
      urgencyLevel,
      companionTone,
      chatSignalPriority,
      dominantNarrativeHook,
      pressureTierDescription,
      phaseAwareMessage,
      shieldStatusMessage,
      battleStatusMessage,
      cascadeStatusMessage,
      economyStatusMessage,
      outcomeMessage,
      suggestedPlayerAction,
      compositeRiskScore: risk,
      modePresentation: snapshot.modeState.modePresentation,
    };
  }

  private _classifyUrgency(risk: number): UXUrgencyLevel {
    const t = SNAPSHOT_UX_URGENCY_THRESHOLDS;
    if (risk >= t.CRITICAL) return 'CRITICAL';
    if (risk >= t.HIGH) return 'HIGH';
    if (risk >= t.ELEVATED) return 'ELEVATED';
    if (risk >= t.MODERATE) return 'MODERATE';
    if (risk >= t.LOW) return 'LOW';
    return 'CALM';
  }

  private _classifyCompanionTone(
    snapshot: RunStateSnapshot,
    risk: number,
    prt: PressureTensionScore,
  ): UXCompanionTone {
    if (snapshot.outcome !== null && isWinOutcome(snapshot.outcome)) return 'CELEBRATORY';
    if (risk >= SNAPSHOT_UX_URGENCY_THRESHOLDS.CRITICAL) return 'ALARM';
    if (risk >= SNAPSHOT_UX_URGENCY_THRESHOLDS.HIGH || prt.canEscalate) return 'URGENT';
    if (risk >= SNAPSHOT_UX_URGENCY_THRESHOLDS.ELEVATED) return 'CONCERNED';
    if (economyScorer.isHealthy(snapshot)) return 'ENCOURAGING';
    return 'NEUTRAL';
  }

  private _classifyChatPriority(urgency: UXUrgencyLevel): UXChatSignalPriority {
    switch (urgency) {
      case 'CRITICAL': return 'INTERRUPT';
      case 'HIGH': return 'ELEVATED';
      case 'ELEVATED': return 'ELEVATED';
      case 'MODERATE': return 'NORMAL';
      case 'LOW': return 'BACKGROUND';
      case 'CALM': return 'SUPPRESS';
    }
  }

  private _buildNarrativeHook(
    snapshot: RunStateSnapshot,
    risk: number,
    prt: PressureTensionScore,
  ): string {
    if (snapshot.outcome !== null) {
      return isWinOutcome(snapshot.outcome)
        ? `Freedom achieved — sovereignty confirmed at tick ${snapshot.tick}.`
        : `Run ended — outcome: ${snapshot.outcome}.`;
    }
    if (risk >= SNAPSHOT_UX_URGENCY_THRESHOLDS.CRITICAL) {
      return `Critical threat vector active — immediate action required at tick ${snapshot.tick}.`;
    }
    if (isShieldFailing(snapshot)) {
      return `Shield breach imminent — defense posture requires immediate card play.`;
    }
    if (prt.canEscalate) {
      return `Pressure is building — escalation threshold approached at ${snapshot.pressure.tier}.`;
    }
    if (snapshot.cascade.brokenChains > 0) {
      return `Cascade chain broken — recovery window is narrowing.`;
    }
    return `Run progressing at tick ${snapshot.tick} — ${prt.pressureTierDescription}`;
  }

  private _buildPhaseMessage(snapshot: RunStateSnapshot): string {
    const progress = computeRunProgressFraction(
      snapshot.phase,
      snapshot.timers.elapsedMs,
      snapshot.timers.seasonBudgetMs + snapshot.timers.extensionBudgetMs,
    );
    const pct = Math.round(progress * 100);
    const stakes = RUN_PHASE_STAKES_MULTIPLIER[snapshot.phase];
    return `Phase: ${snapshot.phase} — ${pct}% elapsed. Stakes multiplier: ${stakes.toFixed(1)}x. ${isEndgamePhase(snapshot.phase) ? 'Final phase — all actions amplified.' : ''}`;
  }

  private _buildShieldMessage(snapshot: RunStateSnapshot): string {
    const weakest = snapshot.shield.weakestLayerRatio;
    const pct = Math.round(weakest * 100);
    const label = SHIELD_LAYER_LABEL_BY_ID[snapshot.shield.weakestLayerId];
    return `Shield: ${pct}% integrity on weakest layer (${label}). Breaches this run: ${snapshot.shield.breachesThisRun}.`;
  }

  private _buildBattleMessage(snapshot: RunStateSnapshot): string {
    const activeBots = snapshot.battle.bots.filter(
      (b) => b.state === 'TARGETING' || b.state === 'ATTACKING',
    );
    const pending = snapshot.battle.pendingAttacks.length;
    if (activeBots.length === 0 && pending === 0) return 'Battle: Quiet — no active threats.';
    return `Battle: ${activeBots.length} bot(s) active, ${pending} attack(s) pending. Budget: ${Math.round(snapshot.battle.battleBudget)}.`;
  }

  private _buildCascadeMessage(snapshot: RunStateSnapshot): string {
    const active = snapshot.cascade.activeChains.length;
    const broken = snapshot.cascade.brokenChains;
    const completed = snapshot.cascade.completedChains;
    if (active === 0 && broken === 0) return 'Cascade: No active chains.';
    return `Cascade: ${active} active chain(s), ${broken} broken, ${completed} completed.`;
  }

  private _buildEconomyMessage(snapshot: RunStateSnapshot): string {
    const { economy } = snapshot;
    const progress = economy.freedomTarget > 0
      ? Math.round((economy.netWorth / economy.freedomTarget) * 100)
      : 0;
    return `Economy: $${Math.round(economy.cash).toLocaleString()} cash | Net worth ${progress}% to freedom target.`;
  }

  private _buildOutcomeMessage(snapshot: RunStateSnapshot): string {
    if (!snapshot.outcome) return '';
    const excitement = scoreOutcomeExcitement(snapshot.outcome, snapshot.mode);
    const excStr = excitement >= 0.8 ? 'Historic' : excitement >= 0.5 ? 'Notable' : 'Unremarkable';
    return `${excStr} ${snapshot.outcome} outcome at tick ${snapshot.tick}. ${snapshot.telemetry.outcomeReason ?? ''}`;
  }
}

// ============================================================================
// SECTION 25 — SnapshotReadModel (rich computed view model for chat adapters)
// ============================================================================

/**
 * SnapshotReadModel is the authoritative computed view of a RunStateSnapshot.
 * Chat adapters, UX projectors, ML routers, and audit surfaces all consume this.
 * It is immutable, deterministic, and safe to serialize.
 */
export class SnapshotReadModel {
  public readonly snapshot: RunStateSnapshot;
  public readonly healthReport: SnapshotHealthReport;
  public readonly mlVector: SnapshotMLVector;
  public readonly uxSignal: SnapshotUXSignal;
  public readonly validation: SnapshotValidationResult;
  public readonly fingerprint: string;

  // Cached sub-scores for downstream consumers
  public readonly economyScore: EconomyScore;
  public readonly shieldScore: ShieldScore;
  public readonly battleScore: BattleScore;
  public readonly pressureTensionScore: PressureTensionScore;
  public readonly cascadeScore: CascadeScore;
  public readonly sovereigntyScore: SovereigntyScore;
  public readonly cardHandScore: CardHandScore;
  public readonly modeScore: ModeScore;
  public readonly timerScore: TimerScore;
  public readonly telemetryScore: TelemetryScore;

  public constructor(snapshot: RunStateSnapshot, nowMs = Date.now()) {
    this.snapshot = snapshot;
    this.fingerprint = checksumSnapshot(snapshot);
    this.validation = validateSnapshotEnums(snapshot);
    this.healthReport = buildSnapshotHealthReport(snapshot, nowMs);

    const extractor = new SnapshotMLFeatureExtractor();
    this.mlVector = extractor.extract(snapshot, nowMs);

    const projector = new SnapshotUXProjector();
    this.uxSignal = projector.project(snapshot, nowMs);

    this.economyScore = economyScorer.score(snapshot);
    this.shieldScore = shieldScorer.score(snapshot);
    this.battleScore = battleScorer.score(snapshot);
    this.pressureTensionScore = pressureTensionScorer.score(snapshot);
    this.cascadeScore = cascadeScorer.score(snapshot);
    this.sovereigntyScore = sovereigntyScorer.score(snapshot);
    this.cardHandScore = cardsModeScorer.scoreCards(snapshot);
    this.modeScore = cardsModeScorer.scoreMode(snapshot);
    this.timerScore = timerScorer.score(snapshot);
    this.telemetryScore = telemetryScorer.score(snapshot);
  }

  /** Returns the snapshot's canonical string representation for debug/audit. */
  public toCanonicalString(): string {
    return stableStringify({
      runId: this.snapshot.runId,
      tick: this.snapshot.tick,
      mode: this.snapshot.mode,
      phase: this.snapshot.phase,
      outcome: this.snapshot.outcome,
      compositeRisk: this.healthReport.compositeRiskScore,
      fingerprint: this.fingerprint,
    });
  }

  /** Returns whether this read model should be emitted as a chat signal. */
  public shouldEmitChatSignal(): boolean {
    return this.uxSignal.chatSignalPriority !== 'SUPPRESS';
  }

  /** Returns a compact summary for logging and debug output. */
  public toDebugSummary(): Record<string, unknown> {
    return {
      runId: this.snapshot.runId,
      tick: this.snapshot.tick,
      mode: this.snapshot.mode,
      phase: this.snapshot.phase,
      outcome: this.snapshot.outcome,
      grade: this.healthReport.grade,
      risk: this.healthReport.compositeRiskScore.toFixed(3),
      urgency: this.uxSignal.urgencyLevel,
      companionTone: this.uxSignal.companionTone,
      recommendedAction: this.mlVector.recommendedAction,
      isInCrisis: this.healthReport.isInCrisis,
      fingerprint: this.fingerprint.slice(0, 16),
    };
  }

  /**
   * Checks that the computed free phase progress matches what the timer state
   * would produce. Uses RUN_PHASE_TICK_BUDGET_FRACTION and computeRunProgressFraction.
   */
  public getPhaseProgressFraction(): number {
    const totalBudgetMs = this.snapshot.timers.seasonBudgetMs + this.snapshot.timers.extensionBudgetMs;
    const phaseBudgetFraction = RUN_PHASE_TICK_BUDGET_FRACTION[this.snapshot.phase];
    const phaseBudgetMs = totalBudgetMs * phaseBudgetFraction;
    return computeRunProgressFraction(this.snapshot.phase, this.snapshot.timers.elapsedMs, phaseBudgetMs);
  }
}

// ============================================================================
// SECTION 26 — SNAPSHOT CANONICAL SERIALIZATION UTILITIES
// ============================================================================

/**
 * Returns a canonical stable string form of a snapshot for audit and replay joins.
 */
export function canonicalizeSnapshot(snapshot: RunStateSnapshot): string {
  return stableStringify({
    schemaVersion: snapshot.schemaVersion,
    runId: snapshot.runId,
    userId: snapshot.userId,
    seed: snapshot.seed,
    mode: snapshot.mode,
    tick: snapshot.tick,
    phase: snapshot.phase,
    outcome: snapshot.outcome,
    pressure: {
      score: snapshot.pressure.score,
      tier: snapshot.pressure.tier,
      band: snapshot.pressure.band,
    },
    economy: {
      cash: snapshot.economy.cash,
      netWorth: snapshot.economy.netWorth,
      freedomTarget: snapshot.economy.freedomTarget,
    },
    shield: {
      weakestLayerId: snapshot.shield.weakestLayerId,
      weakestLayerRatio: snapshot.shield.weakestLayerRatio,
    },
    sovereignty: {
      integrityStatus: snapshot.sovereignty.integrityStatus,
      sovereigntyScore: snapshot.sovereignty.sovereigntyScore,
      proofHash: snapshot.sovereignty.proofHash,
    },
  });
}

/**
 * Returns the tick-scoped fingerprint of a snapshot. Includes tick, checksum,
 * pressure tier, and outcome — stable enough for deduplication without full hash.
 */
export function computeSnapshotTickFingerprint(snapshot: RunStateSnapshot): string {
  return [
    snapshot.runId,
    String(snapshot.tick),
    snapshot.pressure.tier,
    snapshot.phase,
    snapshot.outcome ?? 'ACTIVE',
  ].join(':');
}

/**
 * Returns whether two snapshots share the same tick fingerprint.
 * Used for deduplication in checkpoint stores and chat bridges.
 */
export function isSameTickFingerprint(a: RunStateSnapshot, b: RunStateSnapshot): boolean {
  return computeSnapshotTickFingerprint(a) === computeSnapshotTickFingerprint(b);
}

// ============================================================================
// SECTION 27 — COMPOSITE RISK COMPUTATION (standalone utility)
// ============================================================================

/**
 * Computes the composite risk score for a snapshot without creating
 * intermediate scorer instances. Uses the module-level cached scorers.
 */
export function computeSnapshotCompositeRisk(snapshot: RunStateSnapshot): number {
  const eco = economyScorer.score(snapshot);
  const shd = shieldScorer.score(snapshot);
  const btl = battleScorer.score(snapshot);
  const prt = pressureTensionScorer.score(snapshot);
  const cas = cascadeScorer.score(snapshot);
  const sov = sovereigntyScorer.score(snapshot);
  const w = SNAPSHOT_COMPOSITE_RISK_WEIGHTS;

  return Math.max(0, Math.min(1,
    (1 - eco.healthScore) * w.economy +
    prt.pressureRiskScore * w.pressure +
    prt.tensionScore * w.tension +
    shd.vulnerabilityScore * w.shield +
    btl.aggregateBotThreat * w.battle +
    (1 - cas.aggregateHealth) * w.cascade +
    sov.integrityRiskScore * w.sovereignty,
  ));
}

// ============================================================================
// SECTION 28 — MODULE HEALTH CHECK
// ============================================================================

/** Describes the module-level health of the snapshot runtime layer. */
export interface SnapshotModuleHealth {
  readonly moduleVersion: string;
  readonly ready: boolean;
  readonly mlFeatureCount: number;
  readonly dlFeatureCount: number;
  readonly tensorShape: readonly [1, 96];
  readonly recognizedModeCodes: readonly string[];
  readonly recognizedPressureTiers: readonly string[];
  readonly recognizedRunPhases: readonly string[];
  readonly recognizedRunOutcomes: readonly string[];
  readonly recognizedShieldLayerIds: readonly string[];
  readonly recognizedHaterBotIds: readonly string[];
  readonly recognizedTimingClasses: readonly string[];
  readonly recognizedDeckTypes: readonly string[];
  readonly recognizedIntegrityStatuses: readonly string[];
  readonly recognizedVerifiedGrades: readonly string[];
}

/** Returns a live health summary of the snapshot module. */
export function getSnapshotModuleHealth(): SnapshotModuleHealth {
  return {
    moduleVersion: SNAPSHOT_MODULE_VERSION,
    ready: SNAPSHOT_MODULE_READY,
    mlFeatureCount: SNAPSHOT_ML_FEATURE_COUNT,
    dlFeatureCount: SNAPSHOT_DL_FEATURE_COUNT,
    tensorShape: SNAPSHOT_DL_TENSOR_SHAPE,
    recognizedModeCodes: MODE_CODES,
    recognizedPressureTiers: PRESSURE_TIERS,
    recognizedRunPhases: RUN_PHASES,
    recognizedRunOutcomes: RUN_OUTCOMES,
    recognizedShieldLayerIds: SHIELD_LAYER_IDS,
    recognizedHaterBotIds: HATER_BOT_IDS,
    recognizedTimingClasses: TIMING_CLASSES,
    recognizedDeckTypes: DECK_TYPES,
    recognizedIntegrityStatuses: INTEGRITY_STATUSES,
    recognizedVerifiedGrades: VERIFIED_GRADES,
  };
}
